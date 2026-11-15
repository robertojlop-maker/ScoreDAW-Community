/* =====================================================================
 *  ScoreDAW — native plugin engine
 *  vst3host.cpp : hosting of VST3 plugins (Steinberg VST3 SDK 3.8, MIT)
 *  ---------------------------------------------------------------------
 *  - scanVst3     : lists the audio classes of a .vst3 bundle / file
 *  - createVst3   : loads one class -> Vst3Instance (PluginInstance)
 *
 *  A VST3 plugin has two parts: the audio Component (processor) and the
 *  EditController (parameters + editor). PlugProvider creates both and
 *  connects them. Knob moves in the editor reach the host through
 *  IComponentHandler::performEdit and are passed to the processor in the
 *  next audio block (ParameterChangeTransfer).
 * ===================================================================== */
#include "plugin.h"

#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/plugprovider.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "public.sdk/source/vst/hosting/processdata.h"
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"
#include "public.sdk/source/common/memorystream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstprocesscontext.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/base/ibstream.h"

#include <atomic>
#include <cstring>
#include <memory>
#include <mutex>

using namespace Steinberg;
using namespace Steinberg::Vst;

namespace sdaw {

/* ------------------------------------------------------------------ host */
static IPtr<HostApplication> gHostApp;

void vst3GlobalInit() {
    if (gHostApp) return;
    gHostApp = owned(new HostApplication());
    PluginContextFactory::instance().setPluginContext(gHostApp);
}

/* Category of a class: instrument when its sub-categories say so */
static bool isInstrumentCategory(const std::string& sub) {
    return sub.find("Instrument") != std::string::npos || sub.find("Synth") != std::string::npos ||
           sub.find("Sampler") != std::string::npos || sub.find("Drum") != std::string::npos;
}

bool scanVst3(const std::string& path, std::vector<PluginDesc>& out, std::string& err) {
    vst3GlobalInit();
    auto module = VST3::Hosting::Module::create(path, err);
    if (!module) return false;
    for (auto& ci : module->getFactory().classInfos()) {
        if (ci.category() != kVstAudioEffectClass) continue;
        PluginDesc d;
        d.format = "VST3";
        d.path = path;
        d.uid = ci.ID().toString();
        d.name = ci.name();
        d.vendor = ci.vendor().empty() ? module->getFactory().info().vendor() : ci.vendor();
        d.category = ci.subCategoriesString();
        d.instrument = isInstrumentCategory(d.category);
        out.push_back(d);
    }
    return true;
}

/* ------------------------------------------------- component handler --
 * Receives the parameter edits made in the plugin editor.               */
class ComponentHandler : public IComponentHandler {
public:
    ParameterChangeTransfer* transfer = nullptr;
    std::function<void()> onRestart;
    tresult PLUGIN_API beginEdit(ParamID) override { return kResultOk; }
    tresult PLUGIN_API performEdit(ParamID id, ParamValue v) override {
        if (transfer) transfer->addChange(id, v, 0);
        return kResultOk;
    }
    tresult PLUGIN_API endEdit(ParamID) override { return kResultOk; }
    tresult PLUGIN_API restartComponent(int32) override { if (onRestart) onRestart(); return kResultOk; }
    tresult PLUGIN_API queryInterface(const TUID iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(iid, IComponentHandler::iid) || FUnknownPrivate::iidEqual(iid, FUnknown::iid)) {
            *obj = this; return kResultOk;
        }
        *obj = nullptr; return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return 1000; }      // owned by the instance
    uint32 PLUGIN_API release() override { return 1000; }
};

/* ------------------------------------------------------- plug frame ---
 * The editor asks the host to resize its window.                        */
class PlugFrame : public IPlugFrame {
public:
    std::function<void(int, int)> onResize;
    tresult PLUGIN_API resizeView(IPlugView* view, ViewRect* r) override {
        if (!r || !view) return kInvalidArgument;
        if (onResize) onResize(r->getWidth(), r->getHeight());
        view->onSize(r);
        return kResultOk;
    }
    tresult PLUGIN_API queryInterface(const TUID iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(iid, IPlugFrame::iid) || FUnknownPrivate::iidEqual(iid, FUnknown::iid)) {
            *obj = this; return kResultOk;
        }
        *obj = nullptr; return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return 1000; }
    uint32 PLUGIN_API release() override { return 1000; }
};

/* -------------------------------------------------------- instance --- */
class Vst3Instance : public PluginInstance {
public:
    VST3::Hosting::Module::Ptr module;
    IPtr<PlugProvider> provider;
    IPtr<IComponent> component;
    IPtr<IAudioProcessor> processor;
    IPtr<IEditController> controller;
    IPtr<IPlugView> view;
    ComponentHandler handler;
    PlugFrame frame;
    ParameterChangeTransfer transfer {1000};
    ParameterChanges inChanges {1000};
    EventList events {512};
    HostProcessData data;
    ProcessContext ctx {};
    bool instrument = false, active = false;
    int numIn = 0, numOut = 0;          // channels of the main buses
    std::vector<float> silence, scratch;
    std::mutex procLock;                // process() vs state changes

    ~Vst3Instance() override {
        closeEditor();
        deactivate();
        if (controller) controller->setComponentHandler(nullptr);
        processor = nullptr; component = nullptr; controller = nullptr;
        provider = nullptr;
        module = nullptr;
    }

    bool isInstrument() const override { return instrument; }

    bool init(const std::string& path, const std::string& uid, std::string& err) {
        vst3GlobalInit();
        module = VST3::Hosting::Module::create(path, err);
        if (!module) return false;
        auto factory = module->getFactory();
        factory.setHostContext(gHostApp);
        for (auto& ci : factory.classInfos()) {
            if (ci.category() != kVstAudioEffectClass) continue;
            if (!uid.empty() && ci.ID().toString() != uid) continue;
            provider = owned(new PlugProvider(factory, ci, true));
            if (!provider->initialize()) { err = "the plugin did not initialize"; provider = nullptr; return false; }
            name = ci.name();
            instrument = isInstrumentCategory(ci.subCategoriesString());
            break;
        }
        if (!provider) { err = "plugin class not found in " + path; return false; }
        component = provider->getComponentPtr();
        controller = provider->getControllerPtr();
        processor = FUnknownPtr<IAudioProcessor>(component);
        if (!component || !processor) { err = "the plugin has no audio processor"; return false; }
        handler.transfer = &transfer;
        if (controller) controller->setComponentHandler(&handler);
        // an instrument has an event input and no audio input
        if (!instrument && component->getBusCount(kEvent, kInput) > 0 && component->getBusCount(kAudio, kInput) == 0) instrument = true;
        return true;
    }

    bool activate(double sr, int maxBlock, std::string& err) override {
        std::lock_guard<std::mutex> g(procLock);
        if (active) return true;
        // stereo main buses where the plugin allows it
        SpeakerArrangement st = SpeakerArr::kStereo;
        int32 nIn = component->getBusCount(kAudio, kInput), nOut = component->getBusCount(kAudio, kOutput);
        std::vector<SpeakerArrangement> ins(nIn, st), outs(nOut, st);
        processor->setBusArrangements(nIn ? ins.data() : nullptr, nIn, nOut ? outs.data() : nullptr, nOut);
        for (int32 i = 0; i < nIn; i++) component->activateBus(kAudio, kInput, i, i == 0);
        for (int32 i = 0; i < nOut; i++) component->activateBus(kAudio, kOutput, i, i == 0);
        int32 nEv = component->getBusCount(kEvent, kInput);
        for (int32 i = 0; i < nEv; i++) component->activateBus(kEvent, kInput, i, i == 0);
        BusInfo bi {};
        numIn = (nIn && component->getBusInfo(kAudio, kInput, 0, bi) == kResultOk) ? bi.channelCount : 0;
        numOut = (nOut && component->getBusInfo(kAudio, kOutput, 0, bi) == kResultOk) ? bi.channelCount : 0;

        ProcessSetup setup {kRealtime, kSample32, maxBlock, sr};
        if (processor->setupProcessing(setup) != kResultOk) { err = "setupProcessing failed"; return false; }
        data.prepare(*component, 0, kSample32);
        data.inputEvents = &events;
        data.inputParameterChanges = &inChanges;
        data.processContext = &ctx;
        ctx.sampleRate = sr;
        silence.assign(maxBlock, 0.f);
        scratch.assign((size_t)maxBlock * 32, 0.f);
        if (component->setActive(true) != kResultOk) { err = "setActive failed"; return false; }
        processor->setProcessing(true);
        active = true;
        return true;
    }

    void deactivate() override {
        std::lock_guard<std::mutex> g(procLock);
        if (!active) return;
        processor->setProcessing(false);
        component->setActive(false);
        data.unprepare();
        active = false;
    }

    int latencySamples() const override { return processor ? (int)processor->getLatencySamples() : 0; }

    void process(float** in, float** out, int n, const NoteEvent* ev, int nev, const Transport& tr) override {
        std::unique_lock<std::mutex> g(procLock, std::try_to_lock);
        if (!g.owns_lock() || !active) { std::memset(out[0], 0, n * 4); std::memset(out[1], 0, n * 4); return; }
        // transport
        ctx.state = ProcessContext::kTempoValid | ProcessContext::kProjectTimeMusicValid | ProcessContext::kContTimeValid |
                    (tr.playing ? ProcessContext::kPlaying : 0);
        ctx.tempo = tr.tempo;
        ctx.projectTimeMusic = tr.ppq;
        ctx.projectTimeSamples = tr.samplePos;
        ctx.continousTimeSamples = tr.samplePos;
        // notes
        events.clear();
        for (int i = 0; i < nev; i++) {
            Event e {};
            e.busIndex = 0;
            e.sampleOffset = ev[i].offset;
            if (ev[i].vel > 0) {
                e.type = Event::kNoteOnEvent;
                e.noteOn.channel = (int16)ev[i].ch; e.noteOn.pitch = (int16)ev[i].key;
                e.noteOn.velocity = ev[i].vel / 127.f; e.noteOn.noteId = -1;
            } else {
                e.type = Event::kNoteOffEvent;
                e.noteOff.channel = (int16)ev[i].ch; e.noteOff.pitch = (int16)ev[i].key;
                e.noteOff.velocity = 0.f; e.noteOff.noteId = -1;
            }
            events.addEvent(e);
        }
        transfer.transferChangesTo(inChanges);
        // buffers: main bus = our stereo in/out; any extra channel / bus gets scratch memory
        size_t sc = 0;
        auto scratchCh = [&]() -> float* { float* p = scratch.data() + sc * n; if ((sc + 1) * n <= scratch.size()) sc++; std::memset(p, 0, n * 4); return p; };
        for (int32 b = 0; b < data.numInputs; b++)
            for (int32 c = 0; c < data.inputs[b].numChannels; c++)
                data.setChannelBuffer(kInput, b, c, (b == 0 && c < 2 && in) ? in[c] : (b == 0 && c < 2 ? silence.data() : scratchCh()));
        for (int32 b = 0; b < data.numOutputs; b++)
            for (int32 c = 0; c < data.outputs[b].numChannels; c++)
                data.setChannelBuffer(kOutput, b, c, (b == 0 && c < 2) ? out[c] : scratchCh());
        data.numSamples = n;
        if (processor->process(data) != kResultOk) { std::memset(out[0], 0, n * 4); std::memset(out[1], 0, n * 4); }
        else if (numOut == 1) std::memcpy(out[1], out[0], n * 4);      // mono plugin -> both sides
        inChanges.clearQueue();
    }

    /* ---------------------------------------------------------- editor */
    bool hasEditor() override { return controller != nullptr; }
    bool openEditor(HWND parent, int& w, int& h) override {
        if (!controller) return false;
        if (view) return true;
        view = owned(controller->createView(ViewType::kEditor));
        if (!view) return false;
        if (view->isPlatformTypeSupported(kPlatformTypeHWND) != kResultTrue) { view = nullptr; return false; }
        frame.onResize = [this](int nw, int nh) { if (onResizeRequest) onResizeRequest(nw, nh); };
        view->setFrame(&frame);
        if (view->attached(parent, kPlatformTypeHWND) != kResultOk) { view = nullptr; return false; }
        ViewRect r {};
        if (view->getSize(&r) == kResultOk) { w = r.getWidth(); h = r.getHeight(); } else { w = 640; h = 420; }
        return true;
    }
    void closeEditor() override {
        if (!view) return;
        view->removed();
        view->setFrame(nullptr);
        view = nullptr;
    }

    /* ----------------------------------------------------------- state
     * blob = "SDV3" | u32 component size | component | u32 controller size | controller */
    bool getState(std::vector<uint8_t>& out) override {
        std::lock_guard<std::mutex> g(procLock);
        auto grab = [](auto&& fn, std::vector<uint8_t>& dst) {
            MemoryStream ms;
            fn(&ms);
            int64 size = 0; ms.seek(0, IBStream::kIBSeekEnd, &size); ms.seek(0, IBStream::kIBSeekSet, nullptr);
            dst.resize((size_t)size);
            int32 got = 0;
            if (size) ms.read(dst.data(), (int32)size, &got);
        };
        std::vector<uint8_t> comp, ctrl;
        grab([&](IBStream* s) { component->getState(s); }, comp);
        if (controller) grab([&](IBStream* s) { controller->getState(s); }, ctrl);
        out.clear();
        const char magic[4] = {'S', 'D', 'V', '3'};
        out.insert(out.end(), magic, magic + 4);
        auto put32 = [&](uint32_t v) { for (int i = 0; i < 4; i++) out.push_back((uint8_t)(v >> (8 * i))); };
        put32((uint32_t)comp.size()); out.insert(out.end(), comp.begin(), comp.end());
        put32((uint32_t)ctrl.size()); out.insert(out.end(), ctrl.begin(), ctrl.end());
        return true;
    }
    bool setState(const uint8_t* d, size_t n) override {
        if (n < 12 || std::memcmp(d, "SDV3", 4) != 0) return false;
        auto get32 = [&](size_t at) { uint32_t v = 0; for (int i = 0; i < 4; i++) v |= (uint32_t)d[at + i] << (8 * i); return v; };
        size_t p = 4;
        uint32_t cs = get32(p); p += 4;
        if (p + cs + 4 > n) return false;
        const uint8_t* comp = d + p; p += cs;
        uint32_t ks = get32(p); p += 4;
        if (p + ks > n) return false;
        const uint8_t* ctrl = d + p;
        std::lock_guard<std::mutex> g(procLock);
        {
            MemoryStream ms((void*)comp, (TSize)cs);
            component->setState(&ms);
        }
        if (controller) {
            MemoryStream ms((void*)comp, (TSize)cs);
            controller->setComponentState(&ms);
            if (ks) { MemoryStream ms2((void*)ctrl, (TSize)ks); controller->setState(&ms2); }
        }
        return true;
    }
};

PluginInstance* createVst3(const std::string& path, const std::string& uid, std::string& err) {
    auto* p = new Vst3Instance();
    if (!p->init(path, uid, err)) { delete p; return nullptr; }
    return p;
}

} // namespace sdaw
