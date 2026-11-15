/* =============================================================================
 *  LEMON SCORE STUDIO — GLOBAL CONFIGURATION
 *  -----------------------------------------------------------------------------
 *  Every tunable value of the application lives in this single object.
 *  Change values here instead of hunting through the code.
 *
 *  Sections:
 *    app        - name, version, language
 *    ui         - scaling / resolution control, layout sizes, theme
 *    transport  - default tempo, key, meter, song length
 *    grid       - timing resolution (ticks) used by every editor
 *    guitar     - tuning, frets, strings for fretboard + tab
 *    piano      - range of the on-screen piano and PC-keyboard mapping
 *    audio      - master volume, lookahead scheduler, metronome
 *    library    - categories shown in the left panel (placeholder content
 *                 until the Lemon-Studio / LiveReplica sound packs are imported)
 *    colors     - fixed colour per track type (same colour in every view)
 * ============================================================================= */

window.CONFIG = {

  /* ---------------------------------------------------------------- APP --- */
  app: {
    name: 'ScoreDAW',
    tagline: 'Compose · Arrange · Score · Tab · Play',
    version: '0.2.0',
    storageKey: 'scoreDAW.autosave'   // localStorage key for autosave
  },

  /* ----------------------------------------------------------------- UI --- */
  ui: {
    /* SCALE / RESOLUTION CONTROL
     * The whole interface is designed at designWidth x designHeight and then
     * scaled to fit the window.
     *   scaleMode: 'fit'    -> automatic scale so the design fits the window
     *              'manual' -> use manualScale (also changed with Ctrl +/-)
     *   minScale / maxScale -> clamp for the automatic mode
     */
    designWidth: 1920,
    designHeight: 1080,
    scaleMode: 'fit',
    manualScale: 1.0,
    minScale: 0.55,
    maxScale: 1.6,
    scaleStep: 0.05,

    /* Panel sizes (design pixels) */
    libraryWidth: 280,
    inspectorWidth: 330,
    topBarHeight: 70,
    helpBarHeight: 38,
    trackHeaderWidth: 320,
    trackHeight: 46,
    inputStripHeight: 170,

    /* Resizable / collapsible panels (defaults; the user's layout is remembered) */
    layout: {
      libraryWidth: 280, inspectorWidth: 330,   // side panel widths
      sideMin: 200, sideMax: 560,               // limits when dragging the edge
      sideCollapsed: 38,                        // width of a retracted side panel
      arrangeHeight: 300, inputHeight: 168,     // center panel heights
      minArrange: 110, minInput: 90, minEditor: 140
    },

    /* Start mode: 'simple' or 'pro' */
    startMode: 'pro',

    /* Show the welcome screen on start */
    showWelcome: true,

    /* Pixels per 16th-note tick in the arrange view (zoom) */
    arrangeTickWidth: 7,
    /* Pixels per tick in the piano roll */
    pianoRollTickWidth: 22,
    pianoRollRowHeight: 14,
    /* Bars per line in score / tab view */
    notationBarsPerLine: 4,
    notationBarWidth: 300
  },

  /* ---------------------------------------------------------- TRANSPORT --- */
  transport: {
    tempo: 120,
    minTempo: 30,
    maxTempo: 300,
    key: 'C',            // root note
    scale: 'major',      // 'major' | 'minor'
    timeSig: [4, 4],
    bars: 16,            // song length in bars
    countIn: false
  },

  /* --------------------------------------------------------------- GRID --- */
  grid: {
    ticksPerBeat: 4,     // 1 tick = one 16th note
    defaultDuration: 4,  // quarter note
    /* Durations offered in the palette (in ticks) */
    durations: [
      { ticks: 16, name: 'Whole',     symbol: '𝅝' },
      { ticks: 8,  name: 'Half',      symbol: '𝅗𝅥' },
      { ticks: 4,  name: 'Quarter',   symbol: '♩' },
      { ticks: 2,  name: 'Eighth',    symbol: '♪' },
      { ticks: 1,  name: 'Sixteenth', symbol: '𝅘𝅥𝅯' },
      { ticks: 0.5, name: 'Thirty-second', symbol: '𝅘𝅥𝅰' }
    ]
  },

  /* ------------------------------------------------------------- GUITAR --- */
  guitar: {
    /* MIDI note of each open string, from string 6 (low E) to string 1 (high E) */
    tuning: [40, 45, 50, 55, 59, 64],
    tuningName: 'Standard (E A D G B E)',
    frets: 22,
    maxChordSpan: 4,      // max fret span considered playable
    fretMarkers: [3, 5, 7, 9, 12, 15, 17, 19, 21]
  },

  /* -------------------------------------------------------------- PIANO --- */
  piano: {
    lowNote: 36,   // C2
    highNote: 84,  // C6
    /* PC keyboard -> semitone offset from the current octave base.
     * Lower row = base octave, upper row = base + 12 */
    pcKeyMap: {
      z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
      q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24
    },
    pcBaseNote: 48,   // C3
    /* Number keys 1..7 on the numpad or with Alt insert diatonic chords */
    chordKeysEnabled: true
  },

  /* -------------------------------------------------------------- AUDIO --- */
  audio: {
    masterVolume: 0.8,
    lookaheadMs: 25,         // scheduler timer interval
    prepareTimeoutSec: 20,      // ▶ waits at most this long for real instruments that are still loading
    ceilingKnee: 0.89,          // master ceiling: the signal is untouched below this level (-1 dBFS)…
    ceiling: 0.985,             // …and never goes above this one (-0.13 dBFS): no clipping, live or exported
    scheduleAheadSec: 0.12,  // how far ahead notes are scheduled
    metronome: false,
    metronomeVolume: 0.35,
    previewOnClick: true     // play a note when clicking the fretboard / piano
  },

  /* ---------------------------------------------------------- PIANO RIG --- *
   * Realistic keyboards: the Piano Lab engine (tools/piano-lab) inside ScoreDAW.
   * Grand piano (real recordings or 1–3-string model), electric piano (Rhodes /
   * Wurlitzer), synthesizer, tonewheel organ. Settings per track:
   * track.params.prig (instrument) and track.params.prigS[instrument] (changes).
   * ------------------------------------------------------------------------ */
  pianoRig: {
    base: 'tools/piano-lab/',   // folder of the engine files (presets.js, sampler.js, engine.js, samples/, packs/)
    outputTrim: 0.9,            // engine output → track
    offAheadSec: 0.05           // note-offs are sent this close to their time (time order for the pedal)
  },

  /* ----------------------------------------------------------- WIND RIG --- *
   * Realistic winds: the Wind Lab engine (tools/wind-lab) inside ScoreDAW.
   * Tenor saxophone and trumpet from real recordings, played like a real
   * player (mono legato, delayed vibrato, breath, scoops, falls, mutes,
   * section). Settings per track: track.params.wrig (instrument) and
   * track.params.wrigS[instrument] (only what you changed).
   * ------------------------------------------------------------------------ */
  windRig: {
    base: 'tools/wind-lab/',    // folder of the engine files (presets.js, engine.js, samples/, packs/)
    outputTrim: 0.9,            // engine output → track
    offAheadSec: 0.05           // note-offs are sent this close to their time (time order for the legato)
  },

  /* --------------------------------------------------------- GUITAR RIG --- *
   * Realistic guitars: the Guitar Lab engine (tools/guitar-lab) inside ScoreDAW.
   * Real recordings + real amp captures (NAM) + cabinet IRs, or the physical
   * string model. Settings per track: track.params.rig (model) and
   * track.params.rigS[model] (only what you changed from the factory sound).
   * ------------------------------------------------------------------------ */
  guitarRig: {
    base: 'tools/guitar-lab/',  // folder of the engine files (presets.js, sampler.js, engine.js, samples/, nam/, packs/)
    outputTrim: 0.9,            // engine output → track (the lab runs hot, close to 0 dBFS)
    offAheadSec: 0.05,          // note-offs are sent this close to their time (a slide / hammer-on may cancel them)
    idleSleepSec: 20,           // an engine with no notes for this long stops using CPU (wakes on the next note)
    slideSemis: 4,              // slide into a note from this many semitones below / above
    slideOutSemis: 7,           // slide out of a note: this many semitones
    wideVibrato: 2.2,           // wide vibrato = normal vibrato depth x this
    // natural harmonics: fret → semitones above the open string (other frets = artificial harmonic +12)
    harmonics: { 12: 12, 24: 24, 7: 19, 19: 19, 5: 24, 4: 28, 9: 28, 16: 28, 3: 31, 15: 31 },
    pinchHarmonic: 19           // pinch harmonic: semitones above the fretted note
  },

  /* ------------------------------------------------------------ LIBRARY --- *
   * PLACEHOLDER CONTENT. These entries use the built-in preview engines.
   * When the Lemon-Studio and LiveReplica sound libraries are imported,
   * this list will be generated from their folders (see docs/IMPORT_PLAN.md).
   * engine: 'guitar' | 'bass' | 'keys' | 'strings' | 'synth' | 'drums'
   * ------------------------------------------------------------------------ */
  library: {
    instruments: [
      /* engine 'rig' = Guitar Rig (real recordings + amps). params.rig = guitar model
       * (nylon | steel | strat | lespaul | hollow, see tools/guitar-lab/presets.js GL.TYPES) */
      { group: 'Realistic Guitars (Guitar Rig)', icon: '🎸', items: [
        { name: 'Real Classical Guitar (Nylon)', engine: 'rig', type: 'guitar', source: 'Guitar Rig', params: { rig: 'nylon' } },
        { name: 'Real Acoustic Guitar (Steel)', engine: 'rig', type: 'guitar', source: 'Guitar Rig', params: { rig: 'steel' } },
        { name: 'Real Electric - Stratocaster', engine: 'rig', type: 'guitar', source: 'Guitar Rig', params: { rig: 'strat' } },
        { name: 'Real Electric - Les Paul', engine: 'rig', type: 'guitar', source: 'Guitar Rig', params: { rig: 'lespaul' } },
        { name: 'Real Electric - Hollow Body', engine: 'rig', type: 'guitar', source: 'Guitar Rig', params: { rig: 'hollow' } }
      ]},
      { group: 'Guitars (light string model)', icon: '🎸', items: [
        { name: 'Acoustic Guitar - Steel', engine: 'guitar', type: 'guitar', source: 'LiveReplica', params: { brightness: 0.55, decay: 0.996 } },
        { name: 'Classical Guitar - Nylon', engine: 'guitar', type: 'guitar', source: 'LiveReplica', params: { brightness: 0.35, decay: 0.995 } },
        { name: 'Electric Guitar - Clean', engine: 'guitar', type: 'guitar', source: 'ScoreDAW', params: { brightness: 0.7, decay: 0.997 } },
        { name: 'Electric Guitar - Lead', engine: 'guitar', type: 'guitar', source: 'ScoreDAW', params: { brightness: 0.85, decay: 0.998, drive: true } },
        { name: '12-String Guitar', engine: 'guitar', type: 'guitar', source: 'LiveReplica', params: { brightness: 0.75, decay: 0.996, chorus: true } }
      ]},
      { group: 'Basses', icon: '🎸', items: [
        { name: 'Electric Bass - Finger', engine: 'bass', type: 'bass', source: 'LiveReplica', params: {} },
        { name: 'Electric Bass - Pick', engine: 'bass', type: 'bass', source: 'ScoreDAW', params: { brightness: 0.6 } },
        { name: 'Synth Bass', engine: 'synth', type: 'bass', source: 'ScoreDAW', params: { wave: 'sawtooth', cutoff: 900 } }
      ]},
      /* engine 'pianorig' = Piano Rig (tools/piano-lab). params.prig = instrument (grand | epiano |
       * synth | organ); params.prigSound = a starting sound (PL.SOUNDS) for that library item */
      { group: 'Pianos & Keys (Piano Rig)', icon: '🎹', items: [
        { name: 'Grand Piano', engine: 'pianorig', type: 'keys', source: 'Piano Rig', params: { prig: 'grand' } },
        { name: 'Electric Piano - Rhodes', engine: 'pianorig', type: 'keys', source: 'Piano Rig', params: { prig: 'epiano' } },
        { name: 'Electric Piano - Wurlitzer', engine: 'pianorig', type: 'keys', source: 'Piano Rig', params: { prig: 'epiano', prigSound: 'Wurlitzer' } },
        { name: 'Organ', engine: 'pianorig', type: 'keys', source: 'Piano Rig', params: { prig: 'organ' } },
        { name: 'Synthesizer - Warm Poly', engine: 'pianorig', type: 'synth', source: 'Piano Rig', params: { prig: 'synth' } },
        { name: 'Synthesizer - Analog Pad', engine: 'pianorig', type: 'strings', source: 'Piano Rig', params: { prig: 'synth', prigSound: 'Analog pad' } },
        { name: 'Synthesizer - Supersaw Lead', engine: 'pianorig', type: 'synth', source: 'Piano Rig', params: { prig: 'synth', prigSound: 'Supersaw lead' } },
        { name: 'Synthesizer - Bass', engine: 'pianorig', type: 'bass', source: 'Piano Rig', params: { prig: 'synth', prigSound: 'Synth bass' } }
      ]},
      /* engine 'windrig' = Wind Rig (tools/wind-lab). params.wrig = instrument (tenorsax | trumpet);
       * params.wrigSound = a starting sound (WL.SOUNDS) for that library item */
      { group: 'Saxophone & Trumpet (Wind Rig)', icon: '🎷', items: [
        { name: 'Tenor Sax', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'tenorsax' } },
        { name: 'Tenor Sax - Smoky Ballad', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'tenorsax', wrigSound: 'Smoky ballad' } },
        { name: 'Tenor Sax - R&B Growl', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'tenorsax', wrigSound: 'R&B / rock growl' } },
        { name: 'Tenor Sax - Bebop', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'tenorsax', wrigSound: 'Bebop (fast, straight)' } },
        { name: 'Sax Section (3 players)', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'tenorsax', wrigSound: 'Funk section (3 saxes)' } },
        { name: 'Trumpet', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'trumpet' } },
        { name: 'Trumpet - Harmon Mute', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'trumpet', wrigSound: 'Harmon mute (cool jazz)' } },
        { name: 'Trumpet - Straight Mute', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'trumpet', wrigSound: 'Straight mute' } },
        { name: 'Trumpet - Mariachi', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'trumpet', wrigSound: 'Mariachi (wide vibrato)' } },
        { name: 'Trumpet Section (salsa)', engine: 'windrig', type: 'synth', source: 'Wind Rig', params: { wrig: 'trumpet', wrigSound: 'Salsa / mambo (bright, section)' } }
      ]},
      { group: 'Keys (light engine)', icon: '🎹', items: [
        { name: 'Grand Piano (light)', engine: 'keys', type: 'keys', source: 'LiveReplica', params: {} },
        { name: 'Electric Piano (light)', engine: 'keys', type: 'keys', source: 'ScoreDAW', params: { tone: 'ep' } },
        { name: 'Organ (light)', engine: 'keys', type: 'keys', source: 'ScoreDAW', params: { tone: 'organ' } }
      ]},
      { group: 'Strings & Pads', icon: '🎻', items: [
        { name: 'String Ensemble', engine: 'strings', type: 'strings', source: 'LiveReplica', params: {} },
        { name: 'Warm Pad', engine: 'strings', type: 'strings', source: 'ScoreDAW', params: { cutoff: 1400 } }
      ]},
      { group: 'Synths', icon: '🎛️', items: [
        { name: 'Saw Lead', engine: 'synth', type: 'synth', source: 'ScoreDAW', params: { wave: 'sawtooth', cutoff: 3000 } },
        { name: 'Square Lead', engine: 'synth', type: 'synth', source: 'ScoreDAW', params: { wave: 'square', cutoff: 2400 } }
      ]},
      { group: 'Drums & Percussion', icon: '🥁', items: [
        { name: 'Studio Kit', engine: 'drums', type: 'drums', source: 'ScoreDAW', params: {} },
        { name: 'Latin Percussion Kit', engine: 'drums', type: 'drums', source: 'LiveReplica', params: { latin: true } }
      ]}
    ],
    /* Styles used by the rhythm + progression generators */
    genres: ['Pop', 'Rock', 'Salsa', 'Merengue', 'Bachata', 'Reggaeton', 'Bolero', 'Blues', 'Funk', 'Ballad'],
    effects: ['Compressor', 'Overdrive', 'Distortion', 'Amp', 'EQ', 'Chorus', 'Delay', 'Reverb'],
    /* fx = pedals switched on · models = which simulated unit each pedal uses (pedals.js) */
    presets: [
      { name: 'Clean Fingerstyle', fx: ['Compressor', 'EQ', 'Reverb'], models: { comp: 'studio', reverb: 'room' } },
      { name: 'Jazz Clean', fx: ['Amp', 'Reverb'], models: { amp: 'jc120', reverb: 'plate' } },
      { name: 'Surf Spring', fx: ['Amp', 'Reverb'], models: { amp: 'twin', reverb: 'spring' } },
      { name: 'Blues Lead', fx: ['Compressor', 'Overdrive', 'Amp', 'Delay', 'Reverb'], models: { comp: 'cs3', drive: 'ts808', amp: 'plexi', delay: 'analog', reverb: 'room' } },
      { name: 'Classic Rock (DS-1)', fx: ['Distortion', 'Amp', 'Reverb'], models: { dist: 'ds1', amp: 'plexi', reverb: 'room' } },
      { name: 'Grunge Fuzz', fx: ['Distortion', 'Amp', 'Chorus'], models: { dist: 'muff', amp: 'plexi', chorus: 'clone' } },
      { name: 'Metal Rhythm', fx: ['Overdrive', 'Distortion', 'Amp', 'EQ'], models: { drive: 'ts808', dist: 'mt2', amp: 'rect', eq: 'graphic' } },
      { name: '80s Lead', fx: ['Compressor', 'Distortion', 'Amp', 'Chorus', 'Delay', 'Reverb'], models: { dist: 'ds2', amp: 'plexi', chorus: 'ce2', delay: 'digital', reverb: 'hall' } },
      { name: 'Ambient Pad', fx: ['Chorus', 'Delay', 'Reverb'], models: { chorus: 'dimension', delay: 'tape', reverb: 'hall' } },
      { name: 'Latin Pop', fx: ['Compressor', 'Chorus', 'Reverb'], models: { comp: 'dyna', chorus: 'ce2', reverb: 'plate' } }
    ]
  },

  /* ------------------------------------------------------------- COLORS --- *
   * One colour per track type, used in arrange, mixer, inspector and editors */
  colors: {
    guitar:  '#ff4fd8',
    bass:    '#3fa9ff',
    keys:    '#ffd23f',
    strings: '#b26bff',
    synth:   '#36f1cd',
    drums:   '#7cff4f',
    accent:  '#9b5cff',
    accent2: '#22e0ff'
  }
};
