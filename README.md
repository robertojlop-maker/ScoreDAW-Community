# ScoreDAW Community

This is the public collaboration repository for ScoreDAW. To report a problem or propose a change, open an [issue](https://github.com/robertojlop-maker/ScoreDAW-Community/issues). To contribute code, fork this repository and open a pull request with a description of the change and how you tested it.

ScoreDAW is a digital audio workstation for the web and Windows with a built-in music score editor and guitar tablature. Edit the same song in the score, tablature, piano roll or arrangement, then record, mix and export it from the same project.

- Compose by hand or generate arrangements in 17 musical styles.
- Play sampled guitars, pianos and winds, use the built-in instruments or connect your own samples.
- Record a microphone or instrument, edit audio clips and mix your tracks with effects.
- Export WAV, MP3, MIDI and MusicXML. The Windows edition also hosts VST3 and CLAP plugins.

## Getting started

- **Web:** Open [index.html](index.html) locally in Chrome or Edge.
- **Windows:** See the [Windows build instructions](desktop/README.md). The Windows host uses .NET 8 and WebView2. Build the native engine for VST3 and CLAP support.
- **Manual en español:** [Manual de usuario de ScoreDAW (PDF)](Manual-ScoreDAW.pdf).

### Build a song with blocks
- Patterns (drums or notes) live in the **Library → Patterns** tab; drag them onto a track.
- Blocks: drag = move (Alt = snap to beats), **Ctrl+drag = copy**, drag the right edge = length
  (the pattern repeats inside), double-click = edit, right-click = make unique / rename / delete.
- Blocks of the same pattern are **linked**: edit once, all change. "Make unique" splits one off.
- Writing notes where there is no block creates one automatically (and extends it bar by bar).
- **SONG / PAT** button (key P): play the whole song, or loop only the selected pattern.

### Optional factory sound packs (Library → Sounds)
Run **`Build Sound Packs.cmd`** once (double-click). It converts the real one-shots and
multisamples of LiveReplica (Ableton Core Library) and Lemon-Studio (FL Studio 20) into
`sounds\` (needs Python 3 and ffmpeg — `winget install Gyan.FFmpeg`). Then **Library → Sounds** shows:
Drum Kits, real instruments (Grand Piano, Upright Piano, Mallet Guitar, Kalimba, synths) and every
drum / percussion category (kicks, snares, hi-hats, toms, crashes, rides, congas, bongos, timbales,
cowbells, shakers, claves…).
- Click = listen · double-click = use (a kick goes to the Kick pad, an instrument to the selected track,
  a kit to the drum track).
- Drag a drum sound onto a **pad name** in the Pattern editor, a **kit** onto a drum track, an
  **instrument** onto a track / the score / the piano roll / the Sound Slot, or any sound onto a
  melodic track = audio block in the song.
- In the Pattern editor, right-click a pad → "Choose a real sound in the Library…".

### Real sounds (your own folders)
- **Library → Samples → Connect sound folder…** reads folders where they are (nothing is copied),
  e.g. `LiveReplica\RecursosOriginales\Core Library\Samples` (Ableton, .aif) and
  `Lemon-Studio\Recursos\FL-Studio-20\Fabrica\Data\Patches` (FL Studio). The folder is
  remembered; after restarting the browser click **Reconnect**.
- Drag a sample to a track = **audio block** (with waveform). Audio files can also be dragged
  straight from Windows Explorer.
- Drag a sample to a **drum pad** (Pattern editor) = that pad plays your sample.
- Drag a sample to the **Sound Slot** (Inspector) = single-sample instrument.
- Right-click a folder → **Use folder as instrument** (multisample, root notes from file names,
  e.g. `Grand Piano`) or **Use folder as drum kit** (kick / snare / hat… by name).
- Samples used in a song are kept in the browser (IndexedDB) and embedded in saved project files.


## 🎼 Auto Generate Full Song (Ctrl+Shift+G)
Button "Auto Generate Full Song" in the Song / Arrange bar. **It replaces every track** (Ctrl+Z restores the previous song).
- **15 genres** (`js/styles.js`): Pop, Rock, Ballad, Country, Blues, Jazz, Funk, Reggae, Bolero, Salsa, Merengue, Bachata, Cumbia, Bossa Nova, Reggaeton. Each has its own band, effects, percussion patterns per section, bass lines, voicings, swing, song forms and a library of progressions (roman numerals, tagged by section).
- **Panel**: genre · key and mode · tempo · form (Short / Standard / Extended) · complexity · density · idea (seed) · progression per section (or Auto) · melody options (complex, fast runs, triplets, mix modes, slides, harmonics, bends, vibrato — the program decides where each fits) · band: include / instrument / how it plays (montuno, arpeggio, chords, pad, jazz comping, strum, power chords, funk, boom-chick, bossa, shuffle, tumbao, walking, boogie, riffs, answers…) / effect chain.
- Real percussion samples are used when the sound packs are built (congas, timbales, bongó, clave, güiro, cowbell, shakers…); the brass, saxes, flute, accordion, fiddle, harmonica, clavinet and 808 are synthesized (Generator presets).
- Blues, jazz, country, reggae and funk play with **swing** (song.swing).
- The welcome-screen templates use the same engine.
- **🎸 Bands** (`js/bands.js`): complete band profiles appear as genres. Each band has its **kinds of song** (e.g. hard rocker, mid-tempo anthem, power ballad) and each kind brings its own line-up (singer and backing vocals, two guitars, piano / strings / synth when the band uses them), tempo, keys, form, progressions, drum and bass patterns, riffs written in the idiom of the band (`bandriff`) and the band's guitarist on the lead. The numbers come from the reference library; the riffs and patterns are original.
- **🎯 Reference artist** (`js/styledata.js`): the band of the genre plays like a real band — drum grooves, bass lines and power-chord rhythms per section, its progressions (★, offered first) and its guitarist on the lead (Slash, Van Halen, Vai, Satriani, Malmsteen, Rhoads / Wylde, Brian May, Sambora, Scholz, Thin Lizzy, Gibbons, Clapton, SRV, B.B. King, Albert King, Chuck Berry, Harrison, Santana, Joe Pass). The library is learned from a local Guitar Pro collection that is **not** in the repository (`tools/style-analysis/`); it keeps statistics and short cells that a player repeats in two or more different songs, never the parts of one song. The lead guitarists also use it without a reference: the `cell` and `dna` gestures of `legends.js`.
"✨ Auto Generate Track" (Ctrl+G) now has a **Genre** and a **Plays** option, and the melody options.

## ✨ Auto Generate Track (Ctrl+G)
Button next to "+ Add Track". It analyzes the song and writes a new part for the chosen track:
1. **Analysis** — key (Krumhansl-Kessler profiles + the song key), chords per half bar (chord symbols or detected from the notes and the bass), groove (accent of every 16th from kick / snare / hats), sections (from the song or detected from repeated chord blocks), structure check (intro, chorus, ending…).
2. **Plan** — every section has a profile (energy, density, register, comping). Sections are split in 4-bar phrases: statement · answer · development · cadence (open, then closed on the tonic). Every section type has its own theme; Intro / Outro quote the chorus theme.
3. **Parts** — Melody, Counter-melody, Harmony (voice-led chords), Guitar strumming, Arpeggio, Bass (locked to the kick, approach notes) and Drums (variations, crashes, fills).
4. **Result** — one pattern per bar, identical bars are linked. Edit them in Pattern / Piano Roll / Score / Tab. One Ctrl+Z undoes everything. Change the seed (🎲) for another idea.
5. **Options** — add a 4-bar **Intro** before the song (everything moves 4 bars right; the intro uses the first chords) or a 4-bar **Outro** with a final cadence. The generators write in 4/4.
The algorithm lives in `js/autogen.js` (settings in `AG.CONFIG`: ranges, section profiles, phrase length).

## Score & tab editing (Guitar Pro style)
- **Select**: drag a rectangle over notes (score or tab). Shift+click adds notes.
- **Change duration**: select notes, click a duration in the palette (🎼 Palette button) or press 1-6.
- **Voices 1-4**: pick a voice before writing to put notes of different lengths in the same bar. Shift+click a voice moves the selected notes.
- **Techniques**: tie, triplet, dot, dynamics, hairpins, accent, staccato, ghost, let ring, P.M., dead note, tremolo, strum, hammer-on, pull-off, tapping, vibrato, harmonics, 6 slide types (shift/legato slide need 2 selected notes), bends ¼ ½ full 1½ 2 with up / release / pre-bend.
- **Bar tools** (act on the bar under the cursor): repeat start/end with times, alternate endings, double bar, segno, coda, To Coda, Fine, D.C., D.S. (click again to cycle *al Fine* / *al Coda*), text. Repeats, endings, D.C. / D.S. al Fine / al Coda are all played back and exported.
- **Ripple (⇥)**: when on, making a note longer pushes the next notes of the same voice (shorter pulls them back); the pattern grows if needed.
- **Time signature** (toolbar → Time Sig.): 2/4 3/4 4/4 5/4 6/8 7/8 9/8 12/8. On a song with blocks you choose *keep each bar* (bars are cut / padded) or *keep the music in time* (bar lines move). Score, rack, metronome, LCD, MIDI and MusicXML follow the meter.

## Recording, MIDI out, block editing, automation
- **Record audio**: arm a track with 🎙 (track header or Inspector) and press Record (R). The input of Settings → Audio is recorded and placed as an audio block where it was played; latency is compensated (fine-tune: Settings → Audio → Recording offset). Without an armed track, Record writes MIDI / PC-keyboard / fretboard notes as before.
- **MIDI out per track**: Inspector → *Recording & MIDI Out* → port, channel (drums 10) and whether the built-in sound plays too. Notes leave with exact timestamps; Stop sends *all notes off*.
- **Audio blocks**: right-click → Fade in / Fade out (beats), ⇆ Reverse, ✂ Split (also **S** at the cursor; works on pattern blocks too). Fades are drawn on the block.
- **Automation**: the **A** button on a track header cycles Volume → Pan → off. Click the lane to add points, drag to move, right-click a point to delete. Played live and in exports.
- **Insert bars**: right-click the ruler → *Insert empty bars before bar N*.

## Generators (F8)
Library → Generators: 3x Osc synth (9 presets), empty Sampler, guitar/bass string models, keys, ensemble, drum synth.
The **Generator** tab (F8) shows the panel of the selected track: oscillators, filter, envelope, LFO, glide; sampler zones (drop sounds); string model tone and technique ranges. Changes are heard live, Ctrl+Z undoes.

## Settings (File → Settings…, Ctrl+,)
- **Audio**: output device (speakers / interface), input device with level test, latency mode, master and metronome volume.
- **MIDI**: enable / disable each MIDI input (activity LED), list of outputs.
- **Library folders**: add folders of sounds or plugins from other programs — they appear in Library → Folders without copying anything. Plugins (.vst3, .clap, .dll) are listed; loading them needs the future desktop engine.

## How to open it

Double-click `index.html` (Chrome or Edge), or run `Open ScoreDAW.cmd`.
No installation and no build step.

## Main idea: one song, many views

A note written on the fretboard appears at the same time in the Tab, the Score, the
Piano Roll and the Arrange view, and plays with the track's instrument.

## Window layout (7 fixed zones)

| Zone | Where | What it does |
| --- | --- | --- |
| Top bar | top | menus, file, transport, tempo / key / meter, Simple / Pro, interface size |
| Library | left | instruments, rhythms, chord progressions, presets, effects; drag & drop anywhere |
| Song / Arrange | center top | tracks and sections over time |
| Input strip | center | fretboard, piano (+ PC keyboard), chord builder; foldable |
| Editor | center bottom | Pattern (F2), Piano Roll (F3), Score (F4), Tab (F5), Score + Tab (F6), Mixer (F7) |
| Inspector | right | sound slot, articulations, guitar techniques, pedalboard, note properties |
| Help bar | bottom | explains the control under the mouse |

## Files

| File | Purpose |
| --- | --- |
| `index.html` | main window (layout of the 7 zones) |
| `css/styles.css` | theme (dark, neon, glass); colours are CSS variables at the top |
| `js/config.js` | **all settings** (`CONFIG`): UI scale, sizes, tempo, tuning, PC keyboard map, library |
| `js/util.js` | helpers + music theory (scales, chords, guitar voicings, string/fret choice) |
| `js/model.js` | the single song model, undo / redo, style generators (grooves, progressions, bass) |
| `js/audio.js` | audio engine (Web Audio): scheduler, clips, sampler, string model, drums, pedalboard |
| `js/pedals.js` | pedal types, simulated models and their DSP |
| `js/factory.js` | real sounds included with the program (sounds\\ packs) |
| `tools/build_sound_packs.py` | builds sounds\\ from the Ableton / FL Studio libraries |
| `js/samples.js` | sound folders (File System Access), AIFF/WAV/OGG/MP3 decoding, sample storage |
| `js/autogen.js` · `js/styles.js` · `js/songgen.js` | Auto Generate Track · genre data · Auto Generate Full Song |
| `js/export.js` | WAV / MP3 / stems ZIP, MIDI, MusicXML, print |
| `js/midiout.js` · `js/recorder.js` | MIDI out per track · audio recording |
| `js/desktop.js` | Windows version only: VST3 / CLAP plugins (Library → Plugins, Inspector → Plugins) |
| `desktop/` | **ScoreDAW for Windows** (ScoreDAW.exe + native plugin engine) — see `desktop/README.md` |
| `js/views/*.js` | library, arrange, input strip, pattern (Channel Rack), piano roll, notation, mixer, inspector, generator |
| `js/layout.js` | resizable / collapsible panels |
| `js/app.js` | startup, scaling, menus, transport, shortcuts, help, welcome screen |

## Pedalboard with simulated models

8 pedals per track: COMP → OD → DIST → AMP → EQ → CHORUS → DELAY → REVERB.
Click a pedal in the Inspector to choose its **Model** (the classic unit it simulates) and set its knobs;
double-click = on/off. Models (in `js/pedals.js`, easy to extend):

| Pedal | Models |
| --- | --- |
| Compressor | Dyna Comp, CS-3, LA-2A (optical) style |
| Overdrive | TS-808, SD-1, BD-2, Klon style |
| Distortion | DS-1, DS-2, RAT, MT-2 Metal Zone, Big Muff, Fuzz Face style |
| Amp | Fender Twin, Vox AC30, Marshall Plexi, Mesa Rectifier, JC-120 style |
| EQ | GE-7 graphic, tilt |
| Chorus | CE-2, Small Clone, Dimension style |
| Delay | DD-3 digital, DM-2 analog, Space Echo tape style |
| Reverb | Spring, Room, Hall, Plate |

The names describe the sound being simulated; they are not the original products.

## Panels: resize and retract

- **Library** and **Inspector**: the ◂ / ▸ button retracts the panel to a thin strip; click the strip to open it.
  Drag the inner edge to change the width.
- **Song / Arrange, Input, Editor**: the ▾ button (or double-click an empty part of the toolbar) folds the panel.
  Drag the bars between them to change the heights; double-click a bar = default size.
- Shortcuts: Alt+1 Library · Alt+2 Arrange · Alt+3 Input · Alt+4 Editor · Alt+5 Inspector · Alt+0 reset.
- The layout is remembered. Default sizes: `CONFIG.ui.layout`.

## Interface scale / resolution

`CONFIG.ui.scaleMode = 'fit'` scales the whole interface (designed at 1920×1080) to any
window. Ctrl + / Ctrl − change the size manually, Ctrl 0 returns to automatic.

## Keyboard shortcuts

Space play/pause · P song/pattern mode · R record · L loop · M metronome · Del / Ctrl+D / Ctrl+C / Ctrl+V on the selected block · F1 help · F2–F7 views ·
Ctrl+Z / Ctrl+Y undo/redo · Ctrl+S / Ctrl+O save/open.
Writing: fretboard click (Shift = chord) · PC keys Z…M / Q…U as piano · [ ] octave ·
Shift+1…7 chords of the key · in the tab: 0–9 fret numbers, ←/→ move, ↑/↓ string,
+/− duration, H P S B V X O K techniques.

## Licences

**ScoreDAW's source code** (HTML, CSS, JavaScript, C#, C++) is released under the **MIT licence** — see [`LICENSE`](LICENSE).
Everything bundled from other authors keeps **its own licence**:

| Material | Where | Licence |
|---|---|---|
| Guitar recordings: FreePats Strat, Karoryfer Emilyguitar / Shinyguitar, Martin HD-28 | `tools/guitar-lab/samples`, `packs` | CC0 1.0 |
| Guitar recording: Stratocaster (Gestalt LUR) | `tools/guitar-lab/samples` | MIT |
| Guitar recording: nylon (quartertone / N. Brosowsky) | `tools/guitar-lab/samples` | CC BY 3.0 — attribution required |
| Amp captures, cabinet / reverb IRs, NAM WebAssembly engine (TONE3000) | `tools/guitar-lab/nam` | MIT |
| Salamander Grand Piano (A. Holm), Wurlitzer EP200 (G. Sullivan) | `tools/piano-lab` | CC BY 3.0 — attribution required |
| **Rhodes jRhodes3d (J. Learman)** | `tools/piano-lab/samples/rhodes.*`, `packs/samples__rhodes.*` | **CC BY-NC-SA 4.0 — non-commercial only** |
| Tenor sax (VCSL), trumpet (VSCO-2 CE) | `tools/wind-lab` | CC0 1.0 |
| lamejs (MP3 export) | `js/lib/lame.min.js` | LGPL-3.0 |
| Steinberg VST 3 SDK, CLAP headers | `desktop/` | MIT |
| Microsoft WebView2 SDK | downloaded by NuGet at build time | Microsoft WebView2 SDK licence |

Full credits and sources: `tools/guitar-lab/CREDITS.md`, `tools/piano-lab/CREDITS.md`, `tools/wind-lab/CREDITS.md`, `desktop/licenses/THIRD_PARTY_NOTICES.md`.

> ⚠ Because of the Rhodes recordings (non-commercial), ScoreDAW **as distributed here** may not be sold.
> To use it commercially, delete the Rhodes files listed above (the Rhodes then plays its tine model).

### Not included in this repository

The **factory sound packs** (`sounds/index.js`, `sounds/packs/`) are built from the **Ableton Live Core Library**
and the **FL Studio** factory content, which are commercial and may not be redistributed. They are not in this
repository. If you own those programs, build your own copy with `Build Sound Packs.cmd`
(set the two local library paths in the launcher or pass your paths directly to `tools/build_sound_packs.py`). Without them ScoreDAW works with its
built-in sounds plus the real guitars, pianos and winds above.

The **Windows build** (`desktop/dist`, `desktop/host/bin`) is not in the repository either: build it with
`desktop/Build ScoreDAW.cmd`, following the [Windows build instructions](desktop/README.md).

*Ableton, FL Studio, Guitar Pro and VST are trademarks of their owners. ScoreDAW is not affiliated with them.*
