# ScoreDAW — Guitar Lab

Stand-alone test bench for the realistic guitar engines, before they are
integrated into ScoreDAW. Open **Open Guitar Lab.cmd** (Chrome or Edge): it starts a small
local web server (PowerShell, built into Windows) at http://localhost:8765 and opens the lab.
Keep the black window open while you use it.

* **Sound engines:** *Real samples* (recordings of real guitars), *Physical model*
  (synthesized strings) or *Layered* (both).
* **Real amps:** neural captures (NAM) of Fender Deluxe, Roland JC-120, Vox AC10,
  Marshall JCM800, Dumble ODS, EVH 5153 + real cabinet / reverb impulse responses.
* **Your own libraries:** any SFZ sample library (or WAV files named by note) with
  "📂 Load library…". See `CREDITS.md` for the bundled material and free extra libraries.

* **Guitars:** Classical (nylon), Acoustic (steel), Stratocaster, Les Paul, Hollow body.
* **Engine:** physical model — dual-polarization digital-waveguide strings with
  stiffness, pitch-dependent sustain, bridge coupling (sympathetic resonance),
  per-pluck excitation (finger / nail / thumb / pick), magnetic pickups at their
  real positions, body modes + microphone / piezo, tube pre-amp, tone stack,
  cabinet, effects.
* **About 80 settings** per guitar, 4 variants (A B C D) to compare, automatic
  A/B comparison while looping, variation generator, undo, saved experiments.
* **References:** the best variant of each guitar is saved as reference →
  `references/guitar-references.json`.

Files: `presets.js` (data, factory presets) · `engine.js` (physical model + audio graph) ·
`sampler.js` (real recordings) · `nam/` (real amp captures, WebAssembly) · `samples/` (recordings) ·
`app.js` (interface, sequencer, storage) · `serve.ps1` (local server) · `style.css` · `index.html`.
