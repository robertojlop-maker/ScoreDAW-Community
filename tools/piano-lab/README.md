# Piano Lab — realistic keyboard engines for ScoreDAW

A stand-alone test bench (like the Guitar Lab). Tune the sound of each instrument, compare variants,
and save the best one as the **reference** that ScoreDAW will use once the engine is integrated.

## Open it
Double-click **Open Piano Lab.cmd** (or open `index.html` in Chrome / Edge). No server needed:
the recordings are also stored as script "packs" (`packs/`) that a page opened from disk can load.

## Instruments
| Instrument | Sound | How |
|---|---|---|
| Grand Piano | Real recordings of a Yamaha C5 (4 velocity layers, release + pedal noises) **or** a string model | Model: 1 string per note in the low bass, 2 in the bass, 3 from the tenor up (`1 string up to`, `2 strings up to`); each string a waveguide with stiffness (inharmonicity), its own detune and decay (beating, double decay); felt hammer; soundboard; sympathetic resonance with the pedal |
| Electric Piano | Real recordings of a Rhodes Mark I and a Wurlitzer EP200 **or** a tine / reed model | Pickup non-linearity (bark), bell overtone, amp / speaker, drive, tremolo / auto-pan, phaser |
| Synthesizer | Computed | 2 band-limited oscillators + sub + noise, unison up to 7, 4-pole ladder filter, 2 envelopes, LFO, glide, drift |
| Organ | Computed | 91 tonewheels, 9 drawbars with foldback, percussion, key click, leakage, scanner vibrato / chorus, tube drive, rotary speaker (the sustain pedal / Shift = fast) |

## Playing
Mouse (lower on the key = louder) · computer keys `A W S E D F T G Y H U J K O L P` (Z / X octave) ·
MIDI keyboard (button "🎹 MIDI keyboard…", sustain CC64, soft CC67) · Shift = sustain pedal · Space = demo.

## Files
`presets.js` settings + demos · `sampler.js` recordings player · `engine.js` models + effects ·
`app.js` interface · `samples/` recordings · `packs/` same recordings for file:// (`python build_packs.py`).
See **CREDITS.md** for the licences of the recordings.
