# Import plan — sounds, libraries and engines

Inventory made on 2026-11-07 (read only, the original projects were not modified).

## What the two source projects contain

| Project | Technology | Sounds / libraries | Engines worth reusing |
| --- | --- | --- | --- |
| Lemon-Studio (`C:\Proyects\Codex\Windows\Audio-y-musica\Lemon-Studio`) | Rust 2024, GPL-3.0-or-later | `Recursos\FL-Studio-20` (FL Studio 20 factory Patches + Image-Line user folder, copied and SHA-256 verified), `plugins\MT-PowerDrumKit` | Rust plugins (CLAP/VST3): lemon-sampler, lemon-drum-sampler, lemon-3x-osc, reverb, delay, chorus, flanger, phaser, EQ, limiter, filter, distortion, soft clipper, vocoder, slicer… |
| LiveReplica (`…\LiveReplica`) | C# / .NET (WPF), NAudio | `RecursosOriginales\Core Library` (Ableton Live 12 Lite Core Library: 16,172 files, about 2.17 GB, 104 impulse responses) | `AudioEngine.cs`, sampler (zones, velocity, volume), `BuiltinEffects.cs`, `LibraryCatalog.cs`, `OriginalSampleResolver.cs`, metronome, MIDI input, VST3 hosting |

## Proposed architecture for the desktop version

```
ScoreDAW.exe  (.NET 8, C#)
 ├─ WebView2  -> this interface (index.html, css, js)    <- built now
 ├─ Audio engine (C#, NAudio, WASAPI/ASIO)               <- reuse LiveReplica code
 │    ├─ Sampler engine  -> WAV / OGG / AIFF samples of both libraries
 │    ├─ Guitar engine   -> real guitar samples + techniques from the tab
 │    └─ Plugin host     -> VST3 (LiveReplica) / CLAP (Lemon-Studio plugins)
 └─ Library indexer      -> scans the library folders, builds the Library panel
```

The interface already talks to the engine only through `LSS.audio.*`
(`play`, `stop`, `previewNote`, `getTick`, `getLevel`, `updateTrack`), so the native
engine replaces `js/audio.js` without changing the views.

## Steps

1. **Library roots in settings.** The indexer reads the libraries where they already are
   (no duplicate gigabytes). Optional: copy them into `MyDAW\Libraries\` with a verified copy.
2. **Index:** list every WAV/OGG/AIFF, group by instrument family, detect root note and
   velocity layers from file names; save `library-index.json`.
3. **Native host:** .NET 8 + WebView2 window that loads this interface and exposes the
   audio engine through `chrome.webview.postMessage`.
4. **Engine:** port LiveReplica's sampler / mixer into the host; map every track
   "Sound Slot" to a sampled instrument.
5. **Guitar engine:** per string + fret samples, techniques (bend, slide, hammer, pull,
   palm mute, harmonics, vibrato, strum) driven by the tab data.
6. **Effects:** pedalboard pedals mapped to LiveReplica built-in effects or Lemon-Studio
   plugins.

## Notes

- Lemon-Studio is GPL-3.0: code taken from it keeps that license if the program is ever distributed.
- The FL Studio and Ableton sound content is licensed to the owner of those products;
  keep it for personal local use and do not redistribute it with the program.
- LiveReplica's reverse-engineering evidence (REA) is not used by this project.
