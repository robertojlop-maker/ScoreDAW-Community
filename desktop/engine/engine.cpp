/* =====================================================================
 *  ScoreDAW — native plugin engine
 *  engine.cpp : tracks, WASAPI output, editors, offline render, C API
 *  ---------------------------------------------------------------------
 *  Audio path (one audio thread, WASAPI shared mode, event driven):
 *
 *     for every plugin track:  instrument -> fx 1 -> fx 2 ... -> vol / pan
 *     sum of the tracks -> output device
 *
 *  The built-in sounds of ScoreDAW keep playing in the web engine (WebView2);
 *  plugin tracks play here. Both are kept in time because notes carry the
 *  moment they must be heard (see sdaw_note) and each side removes its own
 *  output latency.
 * ===================================================================== */
#define SDAW_BUILD_DLL
#include "sdaw_engine.h"
#include "plugin.h"

#include <audioclient.h>
#include <mmdeviceapi.h>
#include <avrt.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace sdaw {

/* ------------------------------------------------------------ helpers */
std::string toUtf8(const std::wstring& w) {
    if (w.empty()) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string s(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], n, nullptr, nullptr);
    return s;
}
std::wstring fromUtf8(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], n);
    return w;
}
static double qpcMs() {
    static LARGE_INTEGER f = [] { LARGE_INTEGER x; QueryPerformanceFrequency(&x); return x; }();
    LARGE_INTEGER c; QueryPerformanceCounter(&c);
    return (double)c.QuadPart * 1000.0 / (double)f.QuadPart;
}
static std::string gLastError;
static void setError(const std::string& e) { gLastError = e; }

/* ------------------------------------------------------------- tracks */
struct TimedNote { double atMs; int key, vel, ch; };

struct Slot {
    std::unique_ptr<PluginInstance> inst;
    bool bypass = false;
    HWND editor = nullptr;
};

struct Track {
    int id = 0;
    Slot slots[SDAW_MAX_FX + 1];           // 0 = instrument, 1.. = effects
    float vol = 0.8f, pan = 0.f;
    bool mute = false;
    std::mutex lock;                        // audio thread try_locks it: main thread holds it while changing plugins
    std::mutex evLock;                      // pending notes
    std::vector<TimedNote> pending;
    bool held[16][128] = {};                // notes that are sounding (for all-notes-off)
    std::atomic<float> peakL {0}, peakR {0};
};

static std::mutex gTracksLock;
static std::map<int, std::shared_ptr<Track>> gTracks;
static std::shared_ptr<Track> getTrack(int id, bool create) {
    std::lock_guard<std::mutex> g(gTracksLock);
    auto it = gTracks.find(id);
    if (it != gTracks.end()) return it->second;
    if (!create) return nullptr;
    auto t = std::make_shared<Track>(); t->id = id;
    gTracks[id] = t;
    return t;
}

/* ------------------------------------------------------ engine state */
static const int kMaxBlock = 1024;
static std::atomic<bool> gRunning {false};
static std::atomic<bool> gAllOff {false};
static std::thread gAudioThread;
static double gSampleRate = 48000.0;
static double gOutLatencyMs = 20.0;
static std::mutex gTransportLock;
static struct { double tempo = 120, ppq = 0, atMs = 0; bool playing = false; } gTr;
static int64_t gSamplePos = 0;

/* --------------------------------------------- render one block (n) --
 * blockMs = the clock time at which the first sample of this block is heard.
 * dry = true: no volume / pan / mute (offline export).                  */
static void renderTrack(Track& t, float** out, int n, double blockMs, double sr, const Transport& tr,
                        std::vector<NoteEvent>& evs, float** tmp) {
    // notes due in this block
    evs.clear();
    {
        std::lock_guard<std::mutex> g(t.evLock);
        double endMs = blockMs + n * 1000.0 / sr;
        size_t w = 0;
        for (size_t i = 0; i < t.pending.size(); i++) {
            auto& e = t.pending[i];
            if (e.atMs < endMs) {
                int off = (int)std::floor((e.atMs - blockMs) * sr / 1000.0);
                evs.push_back({std::max(0, std::min(n - 1, off)), e.key, e.vel, e.ch});
            } else t.pending[w++] = e;
        }
        t.pending.resize(w);
    }
    if (gAllOff.load()) {
        for (int c = 0; c < 16; c++) for (int k = 0; k < 128; k++) if (t.held[c][k]) evs.push_back({0, k, 0, c});
    }
    std::stable_sort(evs.begin(), evs.end(), [](const NoteEvent& a, const NoteEvent& b) { return a.offset < b.offset; });
    for (auto& e : evs) t.held[e.ch & 15][e.key & 127] = e.vel > 0;
#ifdef SDAW_DEBUG
    for (auto& e : evs) std::printf("[dbg] block %.2fms n=%d off=%d key=%d vel=%d\n", blockMs, n, e.offset, e.key, e.vel);
#endif

    std::memset(out[0], 0, n * 4); std::memset(out[1], 0, n * 4);
    Slot& ins = t.slots[0];
    if (ins.inst && !ins.bypass) ins.inst->process(nullptr, out, n, evs.data(), (int)evs.size(), tr);
    for (int s = 1; s <= SDAW_MAX_FX; s++) {
        Slot& fx = t.slots[s];
        if (!fx.inst || fx.bypass) continue;
        std::memcpy(tmp[0], out[0], n * 4); std::memcpy(tmp[1], out[1], n * 4);
        fx.inst->process(tmp, out, n, nullptr, 0, tr);
    }
}

/* --------------------------------------------------------- WASAPI ---- */
static void audioThreadMain(int bufferMs, HANDLE ready, int* srOut) {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    IMMDeviceEnumerator* en = nullptr; IMMDevice* dev = nullptr; IAudioClient* ac = nullptr; IAudioRenderClient* rc = nullptr;
    HANDLE ev = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    WAVEFORMATEX* mix = nullptr;
    auto fail = [&](const char* m) { setError(m); *srOut = 0; SetEvent(ready); };
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, __uuidof(IMMDeviceEnumerator), (void**)&en))) { fail("no audio device enumerator"); return; }
    if (FAILED(en->GetDefaultAudioEndpoint(eRender, eConsole, &dev))) { fail("no default output device"); return; }
    if (FAILED(dev->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)&ac))) { fail("cannot open the output device"); return; }
    ac->GetMixFormat(&mix);
    // we always render float stereo at the device rate; Windows converts if needed
    WAVEFORMATEXTENSIBLE wf {};
    wf.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
    wf.Format.nChannels = 2;
    wf.Format.nSamplesPerSec = mix ? mix->nSamplesPerSec : 48000;
    wf.Format.wBitsPerSample = 32;
    wf.Format.nBlockAlign = 8;
    wf.Format.nAvgBytesPerSec = wf.Format.nSamplesPerSec * 8;
    wf.Format.cbSize = 22;
    wf.Samples.wValidBitsPerSample = 32;
    wf.dwChannelMask = SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT;
    wf.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
    if (mix) CoTaskMemFree(mix);
    REFERENCE_TIME dur = (REFERENCE_TIME)bufferMs * 10000;
    DWORD flags = AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;
    if (FAILED(ac->Initialize(AUDCLNT_SHAREMODE_SHARED, flags, dur, 0, (WAVEFORMATEX*)&wf, nullptr))) { fail("cannot start the audio stream"); return; }
    ac->SetEventHandle(ev);
    UINT32 bufFrames = 0; ac->GetBufferSize(&bufFrames);
    ac->GetService(__uuidof(IAudioRenderClient), (void**)&rc);
    REFERENCE_TIME lat = 0; ac->GetStreamLatency(&lat);
    gSampleRate = wf.Format.nSamplesPerSec;
    gOutLatencyMs = lat / 10000.0;
    *srOut = (int)gSampleRate;
    // activate the audio task priority (lower dropouts)
    DWORD taskIndex = 0;
    HANDLE task = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);
    ac->Start();
    SetEvent(ready);

    std::vector<float> L(kMaxBlock), R(kMaxBlock), TL(kMaxBlock), TR(kMaxBlock), ML(kMaxBlock), MR(kMaxBlock);
    std::vector<NoteEvent> evs; evs.reserve(256);
    std::vector<std::shared_ptr<Track>> snap;
    float* out2[2] = {L.data(), R.data()};
    float* tmp2[2] = {TL.data(), TR.data()};

    while (gRunning.load()) {
        if (WaitForSingleObject(ev, 200) != WAIT_OBJECT_0) continue;
        UINT32 pad = 0;
        if (FAILED(ac->GetCurrentPadding(&pad))) break;
        UINT32 avail = bufFrames - pad;
        if (!avail) continue;
        BYTE* data = nullptr;
        if (FAILED(rc->GetBuffer(avail, &data))) continue;
        float* dst = (float*)data;
        double heard = qpcMs() + pad * 1000.0 / gSampleRate + gOutLatencyMs;     // when frame 0 of this buffer is heard
        { std::lock_guard<std::mutex> g(gTracksLock); snap.clear(); for (auto& kv : gTracks) snap.push_back(kv.second); }
        Transport trBase;
        { std::lock_guard<std::mutex> g(gTransportLock); trBase.tempo = gTr.tempo; trBase.playing = gTr.playing;
          trBase.ppq = gTr.ppq + (gTr.playing ? (heard - gTr.atMs) / 60000.0 * gTr.tempo : 0.0); }
        UINT32 done = 0;
        while (done < avail) {
            int n = (int)std::min<UINT32>(avail - done, kMaxBlock);
            double blockMs = heard + done * 1000.0 / gSampleRate;
            Transport tr = trBase;
            tr.ppq += trBase.playing ? done / gSampleRate / 60.0 * trBase.tempo : 0.0;
            tr.samplePos = gSamplePos;
            std::fill(ML.begin(), ML.begin() + n, 0.f); std::fill(MR.begin(), MR.begin() + n, 0.f);
            for (auto& tp : snap) {
                Track& t = *tp;
                std::unique_lock<std::mutex> g(t.lock, std::try_to_lock);
                if (!g.owns_lock()) continue;          // being changed / rendered offline
                renderTrack(t, out2, n, blockMs, gSampleRate, tr, evs, tmp2);
                // volume (same curve as the web engine) and constant-power pan
                float gain = t.mute ? 0.f : t.vol * t.vol * 1.2f;
                float a = (t.pan + 1.f) * 0.785398f;
                float gl = gain * std::cos(a) * 1.41421f, gr = gain * std::sin(a) * 1.41421f;
                float pl = 0, pr = 0;
                for (int i = 0; i < n; i++) {
                    float l = L[i] * gl, r = R[i] * gr;
                    ML[i] += l; MR[i] += r;
                    pl = std::max(pl, std::fabs(l)); pr = std::max(pr, std::fabs(r));
                }
                t.peakL = std::max(pl, t.peakL.load() * 0.9f); t.peakR = std::max(pr, t.peakR.load() * 0.9f);
            }
            for (int i = 0; i < n; i++) {
                dst[(done + i) * 2] = std::max(-1.f, std::min(1.f, ML[i]));
                dst[(done + i) * 2 + 1] = std::max(-1.f, std::min(1.f, MR[i]));
            }
            gSamplePos += n;
            done += n;
        }
        gAllOff = false;
        rc->ReleaseBuffer(avail, 0);
    }
    ac->Stop();
    if (task) AvRevertMmThreadCharacteristics(task);
    if (rc) rc->Release();
    if (ac) ac->Release();
    if (dev) dev->Release();
    if (en) en->Release();
    CloseHandle(ev);
    CoUninitialize();
}

/* ------------------------------------------------------ editor windows */
static const wchar_t* kEditorClass = L"ScoreDAWPluginEditor";
struct EditorRef { int track, slot; };
static std::map<HWND, EditorRef> gEditors;

static void closeEditorOf(int track, int slot);

static LRESULT CALLBACK editorProc(HWND h, UINT msg, WPARAM wp, LPARAM lp) {
    if (msg == WM_CLOSE) {
        auto it = gEditors.find(h);
        if (it != gEditors.end()) { closeEditorOf(it->second.track, it->second.slot); return 0; }
    }
    return DefWindowProcW(h, msg, wp, lp);
}
static void registerEditorClass() {
    static bool done = false;
    if (done) return;
    WNDCLASSEXW wc {sizeof(wc)};
    wc.lpfnWndProc = editorProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.lpszClassName = kEditorClass;
    wc.hIcon = LoadIcon(GetModuleHandleW(nullptr), MAKEINTRESOURCE(32512));
    RegisterClassExW(&wc);
    done = true;
}
static void resizeEditorWindow(HWND h, int w, int ht) {
    RECT r {0, 0, w, ht};
    DWORD st = (DWORD)GetWindowLongPtrW(h, GWL_STYLE), ex = (DWORD)GetWindowLongPtrW(h, GWL_EXSTYLE);
    AdjustWindowRectEx(&r, st, FALSE, ex);
    SetWindowPos(h, nullptr, 0, 0, r.right - r.left, r.bottom - r.top, SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
}
static void closeEditorOf(int track, int slot) {
    auto t = getTrack(track, false); if (!t) return;
    Slot& s = t->slots[slot];
    if (!s.editor) return;
    if (s.inst) s.inst->closeEditor();
    gEditors.erase(s.editor);
    DestroyWindow(s.editor);
    s.editor = nullptr;
}

/* -------------------------------------------------------------- WAV */
static bool writeWavFloat(const std::wstring& path, const std::vector<float>& L, const std::vector<float>& R, int sr) {
    FILE* f = _wfopen(path.c_str(), L"wb");
    if (!f) return false;
    uint32_t n = (uint32_t)L.size(), data = n * 8;
    auto w32 = [&](uint32_t v) { fwrite(&v, 4, 1, f); };
    auto w16 = [&](uint16_t v) { fwrite(&v, 2, 1, f); };
    fwrite("RIFF", 1, 4, f); w32(36 + data); fwrite("WAVEfmt ", 1, 8, f);
    w32(16); w16(3); w16(2); w32(sr); w32(sr * 8); w16(8); w16(32);
    fwrite("data", 1, 4, f); w32(data);
    std::vector<float> inter((size_t)n * 2);
    for (uint32_t i = 0; i < n; i++) { inter[i * 2] = L[i]; inter[i * 2 + 1] = R[i]; }
    fwrite(inter.data(), 4, inter.size(), f);
    fclose(f);
    return true;
}

static std::string jsonEsc(const std::string& s) {
    std::string o;
    for (char c : s) {
        if (c == '"' || c == '\\') { o += '\\'; o += c; }
        else if ((unsigned char)c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); o += b; }
        else o += c;
    }
    return o;
}

} // namespace sdaw

using namespace sdaw;

/* ===================================================== C API ======== */
SDAW_API int sdaw_init(int bufferMs) {
    if (gRunning.load()) return (int)gSampleRate;
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);      // UI thread: plugins expect STA (OLE drag & drop, editors)
    vst3GlobalInit();
    registerEditorClass();
    gRunning = true;
    HANDLE ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    static int sr = 0;
    gAudioThread = std::thread(audioThreadMain, std::max(5, std::min(200, bufferMs)), ready, &sr);
    WaitForSingleObject(ready, 5000);
    CloseHandle(ready);
    if (!sr) { gRunning = false; if (gAudioThread.joinable()) gAudioThread.join(); return 0; }
    return sr;
}

SDAW_API void sdaw_shutdown(void) {
    std::vector<int> ids;
    { std::lock_guard<std::mutex> g(gTracksLock); for (auto& kv : gTracks) ids.push_back(kv.first); }
    for (int id : ids) sdaw_remove_track(id);
    gRunning = false;
    if (gAudioThread.joinable()) gAudioThread.join();
}

SDAW_API const char* sdaw_last_error(void) { return gLastError.c_str(); }
SDAW_API double sdaw_now_ms(void) { return qpcMs(); }
SDAW_API int sdaw_sample_rate(void) { return (int)gSampleRate; }
SDAW_API int sdaw_output_latency_ms(void) { return (int)std::lround(gOutLatencyMs); }

SDAW_API int sdaw_load(int track, int slot, const char* path, const char* uid, const char* format) {
    if (slot < 0 || slot > SDAW_MAX_FX) { setError("bad slot"); return 0; }
    std::string err;
    std::string fmt = format ? format : "";
    std::unique_ptr<PluginInstance> inst(fmt == "CLAP" ? createClap(path, uid ? uid : "", err) : createVst3(path, uid ? uid : "", err));
    if (!inst) { setError(err.empty() ? "cannot load the plugin" : err); return 0; }
    if (!inst->activate(gSampleRate, kMaxBlock, err)) { setError(err); return 0; }
    auto t = getTrack(track, true);
    closeEditorOf(track, slot);
    std::unique_ptr<PluginInstance> old;
    {
        std::lock_guard<std::mutex> g(t->lock);              // the audio thread skips the track meanwhile
        old = std::move(t->slots[slot].inst);
        t->slots[slot].inst = std::move(inst);
        t->slots[slot].bypass = false;
    }
    old.reset();                                             // destroyed outside the lock, on the UI thread
    PluginInstance* p = t->slots[slot].inst.get();
    return 1 | (p->isInstrument() ? 2 : 0) | (p->hasEditor() ? 4 : 0);
}

SDAW_API void sdaw_unload(int track, int slot) {
    auto t = getTrack(track, false); if (!t || slot < 0 || slot > SDAW_MAX_FX) return;
    closeEditorOf(track, slot);
    std::unique_ptr<PluginInstance> old;
    { std::lock_guard<std::mutex> g(t->lock); old = std::move(t->slots[slot].inst); }
    old.reset();
}

SDAW_API void sdaw_remove_track(int track) {
    for (int s = 0; s <= SDAW_MAX_FX; s++) sdaw_unload(track, s);
    std::lock_guard<std::mutex> g(gTracksLock);
    gTracks.erase(track);
}

SDAW_API void sdaw_set_track(int track, float vol, float pan, int mute) {
    auto t = getTrack(track, true);
    t->vol = vol; t->pan = std::max(-1.f, std::min(1.f, pan)); t->mute = mute != 0;
}

SDAW_API void sdaw_set_bypass(int track, int slot, int bypass) {
    auto t = getTrack(track, false); if (!t || slot < 0 || slot > SDAW_MAX_FX) return;
    t->slots[slot].bypass = bypass != 0;
}

SDAW_API void sdaw_note(int track, int key, int vel, int channel, double atMs) {
    auto t = getTrack(track, false); if (!t) return;
    std::lock_guard<std::mutex> g(t->evLock);
    if (t->pending.size() < 8192) t->pending.push_back({atMs, key & 127, std::max(0, std::min(127, vel)), channel & 15});
}

SDAW_API void sdaw_all_notes_off(void) {
    std::lock_guard<std::mutex> g(gTracksLock);
    for (auto& kv : gTracks) { std::lock_guard<std::mutex> g2(kv.second->evLock); kv.second->pending.clear(); }
    gAllOff = true;
}

SDAW_API void sdaw_set_transport(double tempo, int playing, double ppq, double atMs) {
    std::lock_guard<std::mutex> g(gTransportLock);
    gTr.tempo = tempo > 0 ? tempo : 120; gTr.playing = playing != 0; gTr.ppq = ppq; gTr.atMs = atMs;
}

SDAW_API int sdaw_open_editor(int track, int slot, HWND owner, const wchar_t* title) {
    auto t = getTrack(track, false); if (!t || slot < 0 || slot > SDAW_MAX_FX) return 0;
    Slot& s = t->slots[slot];
    if (!s.inst || !s.inst->hasEditor()) { setError("this plugin has no editor"); return 0; }
    if (s.editor) { ShowWindow(s.editor, SW_SHOWNORMAL); SetForegroundWindow(s.editor); return 1; }
    HWND h = CreateWindowExW(WS_EX_DLGMODALFRAME, kEditorClass, title ? title : L"Plugin",
                             WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN,
                             CW_USEDEFAULT, CW_USEDEFAULT, 640, 420, owner, nullptr, GetModuleHandleW(nullptr), nullptr);
    if (!h) { setError("cannot create the editor window"); return 0; }
    int w = 640, ht = 420;
    s.inst->onResizeRequest = [h](int nw, int nh) { resizeEditorWindow(h, nw, nh); };
    if (!s.inst->openEditor(h, w, ht)) { DestroyWindow(h); setError("the plugin editor did not open"); return 0; }
    resizeEditorWindow(h, w, ht);
    gEditors[h] = {track, slot};
    s.editor = h;
    ShowWindow(h, SW_SHOWNORMAL);
    return 1;
}

SDAW_API void sdaw_close_editor(int track, int slot) { closeEditorOf(track, slot); }

SDAW_API void sdaw_idle(void) {
    std::vector<std::shared_ptr<Track>> snap;
    { std::lock_guard<std::mutex> g(gTracksLock); for (auto& kv : gTracks) snap.push_back(kv.second); }
    for (auto& t : snap) for (auto& s : t->slots) if (s.inst) s.inst->idle();
}

SDAW_API int sdaw_get_state(int track, int slot, unsigned char* buf, int cap) {
    auto t = getTrack(track, false); if (!t || slot < 0 || slot > SDAW_MAX_FX || !t->slots[slot].inst) return 0;
    std::vector<uint8_t> st;
    if (!t->slots[slot].inst->getState(st)) return 0;
    if (buf && cap >= (int)st.size()) std::memcpy(buf, st.data(), st.size());
    return (int)st.size();
}

SDAW_API int sdaw_set_state(int track, int slot, const unsigned char* buf, int len) {
    auto t = getTrack(track, false); if (!t || slot < 0 || slot > SDAW_MAX_FX || !t->slots[slot].inst || !buf || len <= 0) return 0;
    return t->slots[slot].inst->setState(buf, (size_t)len) ? 1 : 0;
}

SDAW_API int sdaw_get_levels(int* ids, float* peaks, int max) {
    std::lock_guard<std::mutex> g(gTracksLock);
    int i = 0;
    for (auto& kv : gTracks) {
        if (i >= max) break;
        ids[i] = kv.first; peaks[i * 2] = kv.second->peakL.load(); peaks[i * 2 + 1] = kv.second->peakR.load();
        i++;
    }
    return i;
}

SDAW_API int sdaw_render_track(int track, const double* times, const int* notes, int count, double seconds, const wchar_t* wavPath) {
    auto t = getTrack(track, false); if (!t) { setError("unknown track"); return 0; }
    const double sr = gSampleRate;
    const int64_t total = (int64_t)std::ceil(seconds * sr);
    std::vector<float> L((size_t)total), R((size_t)total);
    std::vector<float> bl(kMaxBlock), br(kMaxBlock), tl(kMaxBlock), tr2(kMaxBlock);
    float* out2[2] = {bl.data(), br.data()};
    float* tmp2[2] = {tl.data(), tr2.data()};
    std::vector<NoteEvent> evs;
    std::lock_guard<std::mutex> g(t->lock);                  // live playback of this track pauses
    std::vector<TimedNote> savedPending;
    { std::lock_guard<std::mutex> g2(t->evLock); savedPending.swap(t->pending); }
    // the offline clock: 0 ms = start of the export
    { std::lock_guard<std::mutex> g2(t->evLock);
      for (int i = 0; i < count; i++) t->pending.push_back({times[i] * 1000.0, notes[i * 3], notes[i * 3 + 1], notes[i * 3 + 2]}); }
    Transport trp; { std::lock_guard<std::mutex> g3(gTransportLock); trp.tempo = gTr.tempo; } trp.playing = true;
    for (int64_t pos = 0; pos < total; pos += kMaxBlock) {
        int n = (int)std::min<int64_t>(kMaxBlock, total - pos);
        trp.ppq = pos / sr / 60.0 * trp.tempo; trp.samplePos = pos;
        renderTrack(*t, out2, n, pos * 1000.0 / sr, sr, trp, evs, tmp2);
        std::memcpy(&L[(size_t)pos], bl.data(), n * 4); std::memcpy(&R[(size_t)pos], br.data(), n * 4);
    }
    // release anything still held, then give the live notes back
    { std::lock_guard<std::mutex> g2(t->evLock); t->pending.clear(); }
    for (int c = 0; c < 16; c++) for (int k = 0; k < 128; k++) if (t->held[c][k]) { std::lock_guard<std::mutex> g2(t->evLock); t->pending.push_back({0, k, 0, c}); }
    { std::lock_guard<std::mutex> g2(t->evLock); t->pending.insert(t->pending.end(), savedPending.begin(), savedPending.end()); }
    if (!writeWavFloat(wavPath, L, R, (int)sr)) { setError("cannot write the render file"); return 0; }
    return 1;
}

SDAW_API int sdaw_scan(const char* path, const char* format, char* json, int cap) {
    std::vector<PluginDesc> list;
    std::string err, fmt = format ? format : "";
    bool ok = fmt == "CLAP" ? scanClap(path, list, err) : scanVst3(path, list, err);
    std::string out = "[";
    for (size_t i = 0; i < list.size(); i++) {
        auto& d = list[i];
        if (i) out += ",";
        out += "{\"format\":\"" + d.format + "\",\"path\":\"" + jsonEsc(d.path) + "\",\"uid\":\"" + jsonEsc(d.uid) +
               "\",\"name\":\"" + jsonEsc(d.name) + "\",\"vendor\":\"" + jsonEsc(d.vendor) + "\",\"category\":\"" + jsonEsc(d.category) +
               "\",\"instrument\":" + (d.instrument ? "true" : "false") + "}";
    }
    out += "]";
    if (!ok) setError(err);
    if (json && cap > 0) { size_t n = std::min(out.size(), (size_t)cap - 1); std::memcpy(json, out.data(), n); json[n] = 0; }
    return ok ? (int)out.size() : -1;
}
