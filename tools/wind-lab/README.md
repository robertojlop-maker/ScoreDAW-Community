# Wind Lab — realistic tenor sax and trumpet engines for ScoreDAW

A stand-alone test bench (like the Guitar Lab and the Piano Lab). Tune the sound of each instrument,
compare variants, and save the best one as the **reference** that ScoreDAW will use once the engine
is integrated.

## Open it
Double-click **Open Wind Lab.cmd** (or open `index.html` in Chrome / Edge). No server needed:
the recordings are also stored as script "packs" (`packs/`) that a page opened from disk can load.

## Instruments
| Instrument | Recordings | Articulations |
|---|---|---|
| Tenor Saxophone | VCSL tenor sax, 2 dynamic layers, A♭2 – E6 | sustain, vibrato, staccato (round-robins) |
| Trumpet in B♭ | VSCO-2 CE trumpet, 2–3 dynamic layers, E3 – D6 | sustain, vibrato, staccato (round-robins), harmon mute, straight mute |

Every sustained recording has a seamless loop, so a note can be held as long as you like.

## How it plays like a real player
* **Mono legato**: a horn plays one note at a time. A note that starts while the previous one is held
  (or within "Slur when notes touch within") is slurred — the new note fades in while the pitch glides,
  no new attack. Otherwise the note is tongued (tongue noise + attack).
* **Vibrato**: the real recorded vibrato fades in after a delay on long notes (or a synthetic one).
* **Expression**: swells on long notes, accents, scoops, fall-offs, doits, release sag.
* **Breath, key / valve noise, growl (sax), flutter (trumpet)**, slow pitch drift and human intonation.
* **Section**: up to 3 players, slightly late, detuned and spread in stereo.
* Microphone distance, bell / room, EQ, compressor, drive, delay and reverb.
* **Synth model**: a computed horn, only to compare with the recordings.

## Playing
Mouse (lower on the key = louder) · computer keys `A W S E D F T G Y H U J K O L P` (Z / X octave) ·
MIDI keyboard (button "🎹 MIDI keyboard…", mod wheel = vibrato, pitch wheel = bend ±2) · Space = demo.
The articulation buttons under the keyboard (staccato, accent, scoop, fall, doit, vibrato) apply to
the notes you play. Dimmed keys are outside the real range of the instrument.

## Files
`presets.js` settings, sounds + demos · `engine.js` recordings player, phrasing + effects ·
`app.js` interface · `samples/` recordings · `packs/` same recordings for file:// (`python build_packs.py`).
See **CREDITS.md** for the licences of the recordings.
