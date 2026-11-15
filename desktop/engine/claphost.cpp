/* =====================================================================
 *  ScoreDAW — native plugin engine
 *  claphost.cpp : hosting of CLAP plugins (free-audio/clap, MIT)
 *  ---------------------------------------------------------------------
 *  A .clap file is a DLL exporting `clap_entry`. Its plugin factory lists
 *  the plugins inside; each one is created with our clap_host_t, which
 *  answers the extensions the plugin may ask for (log, thread-check, gui,
 *  state, params, latency, audio / note ports).
 * ===================================================================== */
#include "plugin.h"
#include <clap/clap.h>

#include <algorithm>
#include <atomic>
#include <memory>
#include <cstring>
#include <mutex>

namespace sdaw {

static thread_local bool tlsAudioThread = false;
static DWORD gMainThread = 0;

/* --------------------------------------------------------- the DLL --- */
struct ClapLib {
    HMODULE dll = nullptr;
    const clap_plugin_entry_t* entry = nullptr;
    const clap_plugin_factory_t* factory = nullptr;
    bool open(const std::string& path, std::string& err) {
        dll = LoadLibraryW(fromUtf8(path).c_str());
        if (!dll) { err = "cannot load " + path; return false; }
        entry = (const clap_plugin_entry_t*)GetProcAddress(dll, "clap_entry");
        if (!entry) { err = "not a CLAP plugin (no clap_entry)"; return false; }
        if (!clap_version_is_compatible(entry->clap_version)) { err = "incompatible CLAP version"; return false; }
        if (!entry->init(path.c_str())) { err = "clap_entry.init failed"; entry = nullptr; return false; }
        factory = (const clap_plugin_factory_t*)entry->get_factory(CLAP_PLUGIN_FACTORY_ID);
        if (!factory) { err = "no plugin factory"; return false; }
        return true;
    }
    ~ClapLib() {
        if (entry) entry->deinit();
        if (dll) FreeLibrary(dll);
    }
};

static bool hasFeature(const clap_plugin_descriptor_t* d, const char* f) {
    if (!d->features) return false;
    for (auto p = d->features; *p; ++p) if (std::strcmp(*p, f) == 0) return true;
    return false;
}
static std::string featureList(const clap_plugin_descriptor_t* d) {
    std::string s;
    if (d->features) for (auto p = d->features; *p; ++p) { if (!s.empty()) s += "|"; s += *p; }
    return s;
}

bool scanClap(const std::string& path, std::vector<PluginDesc>& out, std::string& err) {
    ClapLib lib;
    if (!lib.open(path, err)) return false;
    uint32_t n = lib.factory->get_plugin_count(lib.factory);
    for (uint32_t i = 0; i < n; i++) {
        auto d = lib.factory->get_plugin_descriptor(lib.factory, i);
        if (!d) continue;
        PluginDesc pd;
        pd.format = "CLAP"; pd.path = path; pd.uid = d->id ? d->id : "";
        pd.name = d->name ? d->name : pd.uid; pd.vendor = d->vendor ? d->vendor : "";
        pd.category = featureList(d);
        pd.instrument = hasFeature(d, CLAP_PLUGIN_FEATURE_INSTRUMENT);
        out.push_back(pd);
    }
    return true;
}

/* ------------------------------------------------------- event lists -- */
struct InEvents {
    clap_input_events_t api {};
    std::vector<clap_event_note_t> notes;
    clap_event_transport_t transport {};
    std::vector<const clap_event_header_t*> list;
    InEvents() {
        api.ctx = this;
        api.size = [](const clap_input_events_t* l) -> uint32_t { return (uint32_t)((InEvents*)l->ctx)->list.size(); };
        api.get = [](const clap_input_events_t* l, uint32_t i) -> const clap_event_header_t* {
            auto* self = (InEvents*)l->ctx; return i < self->list.size() ? self->list[i] : nullptr; };
    }
};
struct OutEvents {
    clap_output_events_t api {};
    OutEvents() { api.ctx = this; api.try_push = [](const clap_output_events_t*, const clap_event_header_t*) { return true; }; }
};

/* -------------------------------------------------------- instance ---- */
class ClapInstance : public PluginInstance {
public:
    std::unique_ptr<ClapLib> lib;
    const clap_plugin_t* plugin = nullptr;
    clap_host_t host {};
    const clap_plugin_gui_t* gui = nullptr;
    const clap_plugin_state_t* state = nullptr;
    const clap_plugin_audio_ports_t* ports = nullptr;
    const clap_plugin_latency_t* latency = nullptr;
    const clap_plugin_params_t* params = nullptr;
    bool instrument = false, active = false, processing = false, guiOpen = false;
    std::atomic<bool> wantCallback {false};
    std::vector<uint32_t> inCh, outCh;       // channel count of every audio port
    std::vector<float> scratch, silence;
    std::vector<std::vector<float*>> inPtr, outPtr;
    std::vector<clap_audio_buffer_t> inBuf, outBuf;
    InEvents inEv; OutEvents outEv;
    std::mutex procLock;
    int64_t steady = 0;

    /* host callbacks -------------------------------------------------- */
    static ClapInstance* self(const clap_host_t* h) { return (ClapInstance*)h->host_data; }
    static const clap_host_log_t hostLog;
    static const clap_host_thread_check_t hostThreads;
    static const clap_host_gui_t hostGui;
    static const clap_host_state_t hostState;
    static const clap_host_params_t hostParams;
    static const clap_host_latency_t hostLatency;
    static const clap_host_audio_ports_t hostAudioPorts;
    static const clap_host_note_ports_t hostNotePorts;

    ClapInstance() {
        if (!gMainThread) gMainThread = GetCurrentThreadId();
        host.clap_version = CLAP_VERSION;
        host.host_data = this;
        host.name = "ScoreDAW"; host.vendor = "ScoreDAW"; host.url = ""; host.version = "1.0";
        host.get_extension = [](const clap_host_t*, const char* id) -> const void* {
            if (!std::strcmp(id, CLAP_EXT_LOG)) return &hostLog;
            if (!std::strcmp(id, CLAP_EXT_THREAD_CHECK)) return &hostThreads;
            if (!std::strcmp(id, CLAP_EXT_GUI)) return &hostGui;
            if (!std::strcmp(id, CLAP_EXT_STATE)) return &hostState;
            if (!std::strcmp(id, CLAP_EXT_PARAMS)) return &hostParams;
            if (!std::strcmp(id, CLAP_EXT_LATENCY)) return &hostLatency;
            if (!std::strcmp(id, CLAP_EXT_AUDIO_PORTS)) return &hostAudioPorts;
            if (!std::strcmp(id, CLAP_EXT_NOTE_PORTS)) return &hostNotePorts;
            return nullptr;
        };
        host.request_restart = [](const clap_host_t*) {};
        host.request_process = [](const clap_host_t*) {};
        host.request_callback = [](const clap_host_t* h) { self(h)->wantCallback = true; };
    }

    ~ClapInstance() override {
        closeEditor();
        deactivate();
        if (plugin) plugin->destroy(plugin);
        plugin = nullptr;
        lib.reset();
    }

    bool isInstrument() const override { return instrument; }

    bool init(const std::string& path, const std::string& uid, std::string& err) {
        lib = std::make_unique<ClapLib>();
        if (!lib->open(path, err)) return false;
        uint32_t n = lib->factory->get_plugin_count(lib->factory);
        const clap_plugin_descriptor_t* desc = nullptr;
        for (uint32_t i = 0; i < n; i++) {
            auto d = lib->factory->get_plugin_descriptor(lib->factory, i);
            if (d && (uid.empty() || uid == d->id)) { desc = d; break; }
        }
        if (!desc) { err = "plugin id not found: " + uid; return false; }
        plugin = lib->factory->create_plugin(lib->factory, &host, desc->id);
        if (!plugin || !plugin->init(plugin)) { err = "the plugin did not initialize"; if (plugin) plugin->destroy(plugin); plugin = nullptr; return false; }
        name = desc->name ? desc->name : desc->id;
        instrument = hasFeature(desc, CLAP_PLUGIN_FEATURE_INSTRUMENT);
        gui = (const clap_plugin_gui_t*)plugin->get_extension(plugin, CLAP_EXT_GUI);
        state = (const clap_plugin_state_t*)plugin->get_extension(plugin, CLAP_EXT_STATE);
        ports = (const clap_plugin_audio_ports_t*)plugin->get_extension(plugin, CLAP_EXT_AUDIO_PORTS);
        latency = (const clap_plugin_latency_t*)plugin->get_extension(plugin, CLAP_EXT_LATENCY);
        params = (const clap_plugin_params_t*)plugin->get_extension(plugin, CLAP_EXT_PARAMS);
        return true;
    }

    void readPorts() {
        inCh.clear(); outCh.clear();
        if (ports) {
            for (int dir = 0; dir < 2; dir++) {
                uint32_t c = ports->count(plugin, dir == 0);
                for (uint32_t i = 0; i < c; i++) {
                    clap_audio_port_info_t info {};
                    if (ports->get(plugin, i, dir == 0, &info)) (dir == 0 ? inCh : outCh).push_back(info.channel_count);
                }
            }
        } else { if (!instrument) inCh.push_back(2); outCh.push_back(2); }
    }

    bool activate(double sr, int maxBlock, std::string& err) override {
        std::lock_guard<std::mutex> g(procLock);
        if (active) return true;
        readPorts();
        size_t total = 0;
        for (auto c : inCh) total += c;
        for (auto c : outCh) total += c;
        scratch.assign((total + 2) * (size_t)maxBlock, 0.f);
        silence.assign(maxBlock, 0.f);
        inPtr.assign(inCh.size(), {}); outPtr.assign(outCh.size(), {});
        inBuf.assign(inCh.size(), clap_audio_buffer_t {}); outBuf.assign(outCh.size(), clap_audio_buffer_t {});
        if (!plugin->activate(plugin, sr, 1, (uint32_t)maxBlock)) { err = "activate failed"; return false; }
        active = true; processing = false;
        return true;
    }
    void deactivate() override {
        std::lock_guard<std::mutex> g(procLock);
        if (!active) return;
        processing = false;               // stop_processing must run on the audio thread: skipped when deactivating
        plugin->deactivate(plugin);
        active = false;
    }
    int latencySamples() const override { return (latency && active) ? (int)latency->get(plugin) : 0; }

    void process(float** in, float** out, int n, const NoteEvent* ev, int nev, const Transport& tr) override {
        tlsAudioThread = true;
        std::unique_lock<std::mutex> g(procLock, std::try_to_lock);
        if (!g.owns_lock() || !active) { std::memset(out[0], 0, n * 4); std::memset(out[1], 0, n * 4); return; }
        if (!processing) processing = plugin->start_processing(plugin);
        // buffers
        size_t sc = 0;
        auto scr = [&]() { float* p = scratch.data() + sc * n; sc++; std::memset(p, 0, n * 4); return p; };
        for (size_t p = 0; p < inCh.size(); p++) {
            inPtr[p].resize(inCh[p]);
            for (uint32_t c = 0; c < inCh[p]; c++) inPtr[p][c] = (p == 0 && c < 2) ? (in ? in[c] : silence.data()) : scr();
            if (p == 0 && inCh[p] == 1 && in) inPtr[p][0] = in[0];
            inBuf[p] = clap_audio_buffer_t {inPtr[p].data(), nullptr, inCh[p], 0, 0};
        }
        for (size_t p = 0; p < outCh.size(); p++) {
            outPtr[p].resize(outCh[p]);
            for (uint32_t c = 0; c < outCh[p]; c++) outPtr[p][c] = (p == 0 && c < 2) ? out[c] : scr();
            outBuf[p] = clap_audio_buffer_t {outPtr[p].data(), nullptr, outCh[p], 0, 0};
        }
        // events: transport first, then the notes
        inEv.list.clear(); inEv.notes.resize(nev);
        auto& t = inEv.transport;
        t.header = {sizeof(t), 0, CLAP_CORE_EVENT_SPACE_ID, CLAP_EVENT_TRANSPORT, 0};
        t.flags = CLAP_TRANSPORT_HAS_TEMPO | CLAP_TRANSPORT_HAS_BEATS_TIMELINE | (tr.playing ? CLAP_TRANSPORT_IS_PLAYING : 0);
        t.tempo = tr.tempo; t.song_pos_beats = (clap_beattime)(tr.ppq * CLAP_BEATTIME_FACTOR);
        t.tsig_num = 4; t.tsig_denom = 4;
        for (int i = 0; i < nev; i++) {
            auto& e = inEv.notes[i];
            e.header = {sizeof(e), (uint32_t)ev[i].offset, CLAP_CORE_EVENT_SPACE_ID, (uint16_t)(ev[i].vel > 0 ? CLAP_EVENT_NOTE_ON : CLAP_EVENT_NOTE_OFF), 0};
            e.note_id = -1; e.port_index = 0; e.channel = (int16_t)ev[i].ch; e.key = (int16_t)ev[i].key;
            e.velocity = ev[i].vel > 0 ? ev[i].vel / 127.0 : 0.0;
            inEv.list.push_back(&e.header);
        }
        clap_process_t pr {};
        pr.steady_time = steady; pr.frames_count = (uint32_t)n; pr.transport = &t;
        pr.audio_inputs = inBuf.empty() ? nullptr : inBuf.data(); pr.audio_inputs_count = (uint32_t)inBuf.size();
        pr.audio_outputs = outBuf.empty() ? nullptr : outBuf.data(); pr.audio_outputs_count = (uint32_t)outBuf.size();
        pr.in_events = &inEv.api; pr.out_events = &outEv.api;
        if (plugin->process(plugin, &pr) == CLAP_PROCESS_ERROR) { std::memset(out[0], 0, n * 4); std::memset(out[1], 0, n * 4); }
        else if (!outCh.empty() && outCh[0] == 1) std::memcpy(out[1], out[0], n * 4);
        steady += n;
    }

    /* main thread callbacks */
    void idle() override {
        if (wantCallback.exchange(false)) plugin->on_main_thread(plugin);
        if (params && !active) { /* nothing to flush outside processing */ }
    }

    /* ----------------------------------------------------------- editor */
    bool hasEditor() override { return gui && gui->is_api_supported(plugin, CLAP_WINDOW_API_WIN32, false); }
    bool openEditor(HWND parent, int& w, int& h) override {
        if (!hasEditor()) return false;
        if (guiOpen) return true;
        if (!gui->create(plugin, CLAP_WINDOW_API_WIN32, false)) return false;
        clap_window_t win {}; win.api = CLAP_WINDOW_API_WIN32; win.win32 = parent;
        if (!gui->set_parent(plugin, &win)) { gui->destroy(plugin); return false; }
        uint32_t cw = 640, ch = 420;
        gui->get_size(plugin, &cw, &ch);
        w = (int)cw; h = (int)ch;
        gui->show(plugin);
        guiOpen = true;
        return true;
    }
    void closeEditor() override {
        if (!guiOpen) return;
        gui->hide(plugin);
        gui->destroy(plugin);
        guiOpen = false;
    }

    /* ------------------------------------------------------------ state */
    bool getState(std::vector<uint8_t>& out) override {
        out.clear();
        if (!state) return false;
        clap_ostream_t os {};
        os.ctx = &out;
        os.write = [](const clap_ostream_t* s, const void* buf, uint64_t size) -> int64_t {
            auto* v = (std::vector<uint8_t>*)s->ctx; v->insert(v->end(), (const uint8_t*)buf, (const uint8_t*)buf + size); return (int64_t)size; };
        std::lock_guard<std::mutex> g(procLock);
        return state->save(plugin, &os);
    }
    bool setState(const uint8_t* d, size_t n) override {
        if (!state) return false;
        struct R { const uint8_t* d; size_t n, pos; } r {d, n, 0};
        clap_istream_t is {};
        is.ctx = &r;
        is.read = [](const clap_istream_t* s, void* buf, uint64_t size) -> int64_t {
            auto* rr = (R*)s->ctx; size_t k = (size_t)std::min<uint64_t>(size, rr->n - rr->pos);
            std::memcpy(buf, rr->d + rr->pos, k); rr->pos += k; return (int64_t)k; };
        std::lock_guard<std::mutex> g(procLock);
        return state->load(plugin, &is);
    }
};

const clap_host_log_t ClapInstance::hostLog = {
    [](const clap_host_t*, clap_log_severity, const char* msg) { OutputDebugStringA(msg); OutputDebugStringA("\n"); } };
const clap_host_thread_check_t ClapInstance::hostThreads = {
    [](const clap_host_t*) { return GetCurrentThreadId() == gMainThread; },
    [](const clap_host_t*) { return tlsAudioThread; } };
const clap_host_gui_t ClapInstance::hostGui = {
    [](const clap_host_t*) {},
    [](const clap_host_t* h, uint32_t w, uint32_t hh) { auto* s = self(h); if (s->onResizeRequest) s->onResizeRequest((int)w, (int)hh); return true; },
    [](const clap_host_t*) { return true; },
    [](const clap_host_t*) { return true; },
    [](const clap_host_t*, bool) {} };
const clap_host_state_t ClapInstance::hostState = { [](const clap_host_t*) {} };
const clap_host_params_t ClapInstance::hostParams = {
    [](const clap_host_t*, clap_param_rescan_flags) {},
    [](const clap_host_t*, clap_id, clap_param_clear_flags) {},
    [](const clap_host_t*) {} };
const clap_host_latency_t ClapInstance::hostLatency = { [](const clap_host_t*) {} };
const clap_host_audio_ports_t ClapInstance::hostAudioPorts = {
    [](const clap_host_t*, uint32_t) { return false; },
    [](const clap_host_t*, uint32_t) {} };
const clap_host_note_ports_t ClapInstance::hostNotePorts = {
    [](const clap_host_t*) -> uint32_t { return CLAP_NOTE_DIALECT_CLAP | CLAP_NOTE_DIALECT_MIDI; },
    [](const clap_host_t*, uint32_t) {} };

PluginInstance* createClap(const std::string& path, const std::string& uid, std::string& err) {
    auto* p = new ClapInstance();
    if (!p->init(path, uid, err)) { delete p; return nullptr; }
    return p;
}

} // namespace sdaw
