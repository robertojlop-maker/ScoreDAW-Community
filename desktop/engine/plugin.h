/* =====================================================================
 *  ScoreDAW — native plugin engine
 *  plugin.h : common interface for VST3 and CLAP plugin instances
 *  ---------------------------------------------------------------------
 *  Every loaded plugin (instrument or effect) is a PluginInstance. The
 *  engine (engine.cpp) only talks to this interface, so VST3 (vst3host.cpp)
 *  and CLAP (claphost.cpp) look the same to the rest of the program.
 *
 *  Threads
 *    - "main" thread  : the window / UI thread of ScoreDAW.exe. Loading,
 *                       editors, state save/load and idle() run here.
 *    - audio thread   : process() only.
 * ===================================================================== */
#pragma once
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace sdaw {

/** One note event inside an audio block. vel 0 = note off. */
struct NoteEvent {
    int offset;   // sample offset inside the block (0..n-1)
    int key;      // MIDI note 0..127
    int vel;      // 1..127 note on, 0 = note off
    int ch;       // MIDI channel 0..15
};

/** What a plugin file contains (result of a scan). */
struct PluginDesc {
    std::string format;     // "VST3" | "CLAP"
    std::string path;       // UTF-8 path of the .vst3 bundle / .clap file
    std::string uid;        // class ID (VST3) or plugin id (CLAP)
    std::string name;
    std::string vendor;
    std::string category;   // sub-categories (VST3) / features (CLAP)
    bool instrument = false;
};

/** Musical time given to plugins every block (synced delays, arps…). */
struct Transport {
    double tempo = 120.0;
    bool playing = false;
    double ppq = 0.0;       // position in quarter notes at the start of the block
    int64_t samplePos = 0;  // continuous sample counter
};

class PluginInstance {
public:
    virtual ~PluginInstance() = default;

    /** Prepare for processing (main thread). */
    virtual bool activate(double sampleRate, int maxBlock, std::string& err) = 0;
    virtual void deactivate() = 0;

    /**
     * Audio thread. in = 2 channels (may be null for instruments),
     * out = 2 channels, n frames. Effects may be given in == out.
     */
    virtual void process(float** in, float** out, int n, const NoteEvent* ev, int nev, const Transport& tr) = 0;

    /** Editor (main thread). openEditor attaches the plugin view to `parent` and returns its size. */
    virtual bool hasEditor() = 0;
    virtual bool openEditor(HWND parent, int& w, int& h) = 0;
    virtual void closeEditor() = 0;

    /** Whole plugin state (main thread). */
    virtual bool getState(std::vector<uint8_t>& out) = 0;
    virtual bool setState(const uint8_t* data, size_t size) = 0;

    /** Called ~30 times a second on the main thread (CLAP callbacks, VST3 nothing). */
    virtual void idle() {}

    virtual bool isInstrument() const = 0;
    virtual int latencySamples() const { return 0; }

    std::string name;
    /** Set by the engine: the editor wants a new size (w, h in pixels). */
    std::function<void(int, int)> onResizeRequest;
};

/* Factories (implemented in vst3host.cpp / claphost.cpp) */
PluginInstance* createVst3(const std::string& pathUtf8, const std::string& uid, std::string& err);
PluginInstance* createClap(const std::string& pathUtf8, const std::string& uid, std::string& err);
bool scanVst3(const std::string& pathUtf8, std::vector<PluginDesc>& out, std::string& err);
bool scanClap(const std::string& pathUtf8, std::vector<PluginDesc>& out, std::string& err);
void vst3GlobalInit();

/* small helpers (engine.cpp) */
std::string toUtf8(const std::wstring& w);
std::wstring fromUtf8(const std::string& s);

} // namespace sdaw
