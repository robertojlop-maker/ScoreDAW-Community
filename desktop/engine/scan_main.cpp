/* =====================================================================
 *  ScoreDAW — ScoreDawScan.exe
 *  Scans ONE plugin file / bundle in its own process, so a plugin that
 *  crashes while loading cannot take ScoreDAW down.
 *     ScoreDawScan.exe VST3 "C:\Program Files\Common Files\VST3\Synth.vst3"
 *  Prints a JSON array (UTF-8) on stdout; exit code 0 = ok, 1 = error.
 * ===================================================================== */
#include "sdaw_engine.h"
#include "plugin.h"
#include <cstdio>
#include <string>
#include <vector>

int wmain(int argc, wchar_t** argv) {
    if (argc < 3) {
        // opened by double-click: explain instead of closing silently
        MessageBoxW(nullptr,
            L"ScoreDawScan.exe is a helper of ScoreDAW: it checks VST3 / CLAP plugins in the background.\n\n"
            L"To open ScoreDAW, start ScoreDAW.exe in this same folder.\n"
            L"If ScoreDAW.exe is not here yet, build it first: double-click \"Build ScoreDAW.cmd\" in the desktop folder.",
            L"ScoreDAW", MB_OK | MB_ICONINFORMATION);
        return 2;
    }
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    std::string fmt = sdaw::toUtf8(argv[1]), path = sdaw::toUtf8(argv[2]);
    std::vector<char> buf(1 << 20);
    int n = sdaw_scan(path.c_str(), fmt.c_str(), buf.data(), (int)buf.size());
    if (n < 0) { std::fprintf(stderr, "%s\n", sdaw_last_error()); std::fputs("[]", stdout); return 1; }
    std::fputs(buf.data(), stdout);
    std::fflush(stdout);
    return 0;
}
