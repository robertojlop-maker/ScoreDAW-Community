/* =====================================================================
 *  ScoreDAW — native plugin engine : public C API (ScoreDawEngine.dll)
 *  ---------------------------------------------------------------------
 *  Called by ScoreDAW.exe (C#, P/Invoke). Every function except the
 *  audio thread itself is meant to be called from the UI thread.
 *
 *  Tracks are identified by an integer chosen by the caller (one per
 *  ScoreDAW track that uses plugins). Slot 0 = the instrument of the track,
 *  slots 1..8 = its plugin effects, in order.
 *
 *  Time: sdaw_now_ms() is a millisecond clock (QueryPerformanceCounter).
 *  Notes are sent with the time at which they must be HEARD on that clock;
 *  the engine adds its own output latency.
 * ===================================================================== */
#pragma once
#include <windows.h>

#ifdef SDAW_BUILD_DLL
#define SDAW_API extern "C" __declspec(dllexport)
#else
#define SDAW_API extern "C" __declspec(dllimport)
#endif

#define SDAW_MAX_FX 8

/* engine + audio output (default device). Returns the sample rate, 0 on error. */
SDAW_API int    sdaw_init(int bufferMs);
SDAW_API void   sdaw_shutdown(void);
SDAW_API const char* sdaw_last_error(void);
SDAW_API double sdaw_now_ms(void);
SDAW_API int    sdaw_sample_rate(void);
SDAW_API int    sdaw_output_latency_ms(void);

/* plugins. format = "VST3" | "CLAP". Returns flags: 1 = loaded, 2 = instrument, 4 = has editor; 0 = error */
SDAW_API int    sdaw_load(int track, int slot, const char* pathUtf8, const char* uid, const char* format);
SDAW_API void   sdaw_unload(int track, int slot);
SDAW_API void   sdaw_remove_track(int track);
SDAW_API void   sdaw_set_track(int track, float vol, float pan, int mute);
SDAW_API void   sdaw_set_bypass(int track, int slot, int bypass);

/* notes / transport */
SDAW_API void   sdaw_note(int track, int key, int vel, int channel, double atMs);
SDAW_API void   sdaw_all_notes_off(void);
SDAW_API void   sdaw_set_transport(double tempo, int playing, double ppq, double atMs);

/* editors (own top-level window, owned by `owner`) */
SDAW_API int    sdaw_open_editor(int track, int slot, HWND owner, const wchar_t* title);
SDAW_API void   sdaw_close_editor(int track, int slot);
SDAW_API void   sdaw_idle(void);

/* state blobs: call with buf = NULL to get the size */
SDAW_API int    sdaw_get_state(int track, int slot, unsigned char* buf, int cap);
SDAW_API int    sdaw_set_state(int track, int slot, const unsigned char* buf, int len);

/* meters: fills ids[i] and peaks[2*i], [2*i+1]; returns the number of tracks */
SDAW_API int    sdaw_get_levels(int* ids, float* peaks, int max);

/* offline render of one track (dry: no volume / pan) to a 32-bit float WAV.
 * times in seconds from the start; notes = key, vel, channel triples. */
SDAW_API int    sdaw_render_track(int track, const double* times, const int* notes, int count, double seconds, const wchar_t* wavPath);

/* scan one plugin file / bundle; writes a JSON array (UTF-8) */
SDAW_API int    sdaw_scan(const char* pathUtf8, const char* format, char* json, int cap);
