# ScoreDAW for Windows

The same ScoreDAW (identical interface and features) as a Windows program that also
hosts **VST3** and **CLAP** plugins.

```
desktop/
  Build ScoreDAW.cmd     builds dist\ScoreDAW.exe (needs the .NET 8 SDK)
  Run ScoreDAW.cmd       starts it
  ScoreDAW.sln           Visual Studio 2022 solution (C# host)
  host/                  C# .NET 8 WinForms + WebView2 host
  engine/                C++ native plugin engine (VST3 SDK 3.8 + CLAP, both MIT)
  dist/                  local build outputs (ignored by Git)
  licenses/              licenses of the VST3 SDK and CLAP
```

## How it works

```
ScoreDAW.exe (C#)
 ├─ WebView2  → the web interface (index.html, js, css, sounds) from https://app.scoredaw/
 │             built-in sounds keep playing in the web audio engine
 ├─ Bridge.cs ← messages from js/desktop.js (load plugin, notes, editors, states, render)
 └─ ScoreDawEngine.dll (C++)
      ├─ VST3 + CLAP hosting, plugin editor windows
      ├─ WASAPI output: plugin tracks (instrument → effects → volume / pan)
      └─ offline render of plugin tracks for exports
ScoreDawScan.exe       scans one plugin per process (a crashing plugin cannot close ScoreDAW)
```

* **Timing**: both sides share one clock (QueryPerformanceCounter, synced with the page);
  every note is sent with the moment it must be heard, and each side removes its own
  output latency, so plugin tracks and built-in tracks play together.
* **Exports** (WAV / MP3 / stems): plugin tracks are rendered offline by the engine and
  mixed through their ScoreDAW track (volume, pan, automation, sends).
* **Projects**: the state of every plugin is stored inside the song (base64), saved with
  Ctrl+S, in the autosave and when the window closes.
* **Plugin folders**: `C:\Program Files\Common Files\VST3`, `…\CLAP`,
  `%LOCALAPPDATA%\Programs\Common\VST3 / CLAP`, plus folders added in Library → Plugins.
  Scan results are cached in `%APPDATA%\ScoreDAW\plugins.json`.

## Build

1. Install the **.NET 8 SDK** (comes with Visual Studio 2022 17.8+).
2. Double-click **`Build ScoreDAW.cmd`** → `dist\ScoreDAW.exe`.
   `Build ScoreDAW.cmd portable` also makes `dist\ScoreDAW-portable` (exe + engine + a copy of the interface).
3. Double-click **`Run ScoreDAW.cmd`** (or `dist\ScoreDAW.exe`).

The exe looks for the interface in a `web` folder next to it, otherwise in the parent folders
(the MyDAW folder), so the Windows and web versions always share the same files.

For VST3 and CLAP support from a fresh clone, build the native engine with Visual Studio 2022 and CMake from the desktop directory:
`cmake -S engine -B build-engine -G "Visual Studio 17 2022" -A x64` then
`cmake --build build-engine --config Release`; or on Linux with MinGW-w64: `engine/build_mingw.sh`.

## Current limits

* Plugin **effects** go after a plugin instrument on the same track. Effects on tracks that use the
  built-in sounds would need the web audio routed into the native engine (planned).
* The engine uses the default Windows output device (WASAPI shared mode, 20 ms buffer).
