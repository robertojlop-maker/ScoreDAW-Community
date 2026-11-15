/* =====================================================================
 *  GUITAR LAB — presets.js : guitar types, settings schema, factory
 *  presets, amp / cab / mic models, chord shapes and demo phrases.
 *  ---------------------------------------------------------------------
 *  DATA ONLY. The engine (engine.js) and the UI (app.js) read from here.
 *
 *  Every setting the lab exposes is described ONCE in GL.PARAMS:
 *    { id, sec, label, min, max, step, unit, for, tip }   (sliders)
 *    { id, sec, label, options: [...], for, tip }           (selects)
 *  `for` limits a setting to some guitars:
 *    'all'       every guitar
 *    'acoustic'  nylon + steel
 *    'electric'  strat + lespaul + hollow
 *    'body'      nylon + steel + hollow (instruments with a resonant body)
 *    or an array of type ids.
 *
 *  The saved references (what ScoreDAW will use later) are plain objects
 *  { paramId: value } for each guitar type.
 * ===================================================================== */
(function () {
  'use strict';
  const GL = window.GL = window.GL || {};

  /* ============================================================ CONFIG == */
  GL.CONFIG = {
    version: 9,
    storageKey: 'scoredaw.guitarlab.v1',      // localStorage key of the whole lab state
    slots: ['A', 'B', 'C', 'D'],               // variants per guitar for A/B comparison
    sampleRate: 48000,                         // preferred AudioContext rate
    exportSampleRate: 48000,                   // WAV export rate (the amp captures expect 48 kHz)
    referenceFile: 'guitar-references.json',   // file written into the references folder
    stateFile: 'guitar-lab-state.json',
    ui: { scale: 1, minScale: 0.7, maxScale: 1.4 },
    tunings: {                                 // MIDI notes, low E string first
      'Standard': [40, 45, 50, 55, 59, 64],
      'Half-step down': [39, 44, 49, 54, 58, 63],
      'Drop D': [38, 45, 50, 55, 59, 64],
      'Open G': [38, 43, 50, 55, 59, 62],
      'DADGAD': [38, 45, 50, 55, 57, 62]
    }
  };

  /* ============================================================ ASSETS == *
   * Recordings (samples/), real-amp captures + engine (nam/) and cabinet /
   * reverb IRs (nam/irs/) are loaded with fetch() when the page is served
   * over http(s): the local server, GitHub Pages or the Windows version
   * (https://app.scoredaw/). A page opened straight from disk (file://)
   * cannot fetch() files, but it CAN run <script> files, so every asset also
   * exists as a small script "pack" (packs/*.js, made by build_packs.py) that
   * calls GL.addAsset(). packs/index.js (loaded by index.html) lists them.
   *   GL.BASE   folder of the lab relative to the page: '' for the lab itself,
   *             'tools/guitar-lab/' when ScoreDAW loads these files.        */
  GL.asset = path => (GL.BASE || '') + path;
  GL.fromDisk = () => location.protocol === 'file:';
  GL.ASSETS = GL.ASSETS || {};
  const packWait = {};
  /** called by a pack script: one asset (text, or base64 for binary files) */
  GL.addAsset = function (path, data, kind) {
    GL.ASSETS[path] = { data, kind };
    if (packWait[path]) { packWait[path].res(); delete packWait[path]; }
  };
  /** can the real recordings / amps / IRs be loaded here? */
  GL.assetsAvailable = () => !GL.fromDisk() || !!GL.PACKS;
  GL.packName = path => 'packs/' + path.replace(/[\/\\]/g, '__') + '.js';
  function loadPack(path) {
    if (packWait[path]) return packWait[path].p;
    let res, rej; const p = new Promise((a, b) => { res = a; rej = b; });
    packWait[path] = { p, res };
    const sc = document.createElement('script');
    sc.src = GL.asset(GL.packName(path));
    sc.onerror = () => { delete packWait[path]; rej(new Error('missing ' + GL.packName(path))); };
    sc.onload = () => sc.remove();
    document.head.appendChild(sc);
    return p;
  }
  function b64ToBuf(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  /** Load an asset: as = 'text' | 'json' | 'buffer' (ArrayBuffer) */
  GL.loadAsset = async function (path, as) {
    if (!GL.fromDisk()) {
      const r = await fetch(GL.asset(path));
      if (!r.ok) throw new Error(path + ' (' + r.status + ')');
      return as === 'text' ? r.text() : as === 'json' ? r.json() : r.arrayBuffer();
    }
    if (!GL.ASSETS[path]) await loadPack(path);
    const a = GL.ASSETS[path];
    if (as === 'buffer') return b64ToBuf(a.data);
    return as === 'json' ? JSON.parse(a.data) : a.data;
  };
  /** forget the in-memory copy of a big pack once it has been decoded */
  GL.releaseAsset = path => { delete GL.ASSETS[path]; };

  /* ======================================================= GUITAR TYPES == */
  // body modes: [frequency Hz, Q, gain dB]  (mode 0 = air / Helmholtz, mode 1 = main top plate mode)
  GL.TYPES = {
    nylon: {
      id: 'nylon', name: 'Classical (Nylon)', short: 'Nylon', cat: 'acoustic', icon: '🎼', scale: 650, lib: 'nylon-mic',
      desc: 'Spanish / classical guitar: nylon trebles, silver-wound basses, fingers and nails, warm cedar/spruce body.',
      modes: [[98, 14, 9], [205, 12, 7], [245, 10, 3], [390, 8, -2], [520, 9, 3], [780, 6, -3], [1100, 5, 2], [2200, 3, -5], [4500, 1.5, -6]]
    },
    steel: {
      id: 'steel', name: 'Acoustic (Steel strings)', short: 'Steel', cat: 'acoustic', icon: '🪕', scale: 645, lib: 'martin-mic',
      desc: 'Dreadnought flat-top: phosphor-bronze strings, pick or fingers, deep bass and sparkling highs.',
      modes: [[102, 14, 8], [188, 12, 6], [230, 10, 2], [410, 8, -3], [580, 8, 3], [900, 5, 1], [1500, 4, 2], [3200, 2, -2], [6000, 1.2, -4]]
    },
    strat: {
      id: 'strat', name: 'Electric — Stratocaster', short: 'Strat', cat: 'electric', icon: '⚡', scale: 648, lib: 'fsbs-di', libAlt: 'strat-di',
      desc: 'Solid body, three single-coil pickups, 5-way selector: glassy, bell-like, "quack" in positions 2 and 4.',
      pickups: ['Neck', 'Neck + Middle', 'Middle', 'Middle + Bridge', 'Bridge'],
      modes: [[160, 3, 1], [450, 3, -1], [1200, 2, 1]]
    },
    lespaul: {
      id: 'lespaul', name: 'Electric — Les Paul', short: 'Les Paul', cat: 'electric', icon: '🔥', scale: 628, lib: 'emily-di',
      desc: 'Mahogany/maple solid body, two humbuckers: thick, long sustain, warm neck and biting bridge.',
      pickups: ['Neck', 'Both', 'Bridge'],
      modes: [[140, 3, 1], [380, 3, 1], [1000, 2, -1]]
    },
    hollow: {
      id: 'hollow', name: 'Electric — Hollow Body', short: 'Hollow', cat: 'electric', hollow: true, icon: '🎷', scale: 628, lib: 'shiny-di',
      desc: 'Archtop jazz box (ES-175 style): flatwound strings, neck humbucker, airy body — the jazz guitar sound.',
      pickups: ['Neck', 'Both', 'Bridge'],
      modes: [[118, 10, 5], [235, 8, 4], [460, 6, -2], [900, 4, 2], [1800, 3, -2], [3200, 2, -4]]
    }
  };
  GL.TYPE_IDS = Object.keys(GL.TYPES);

  /** Is a parameter shown / used for this guitar type? */
  GL.paramFor = function (p, type) {
    const T = GL.TYPES[type], f = p.for || 'all';
    if (Array.isArray(f)) return f.includes(type);
    if (f === 'all') return true;
    if (f === 'acoustic') return T.cat === 'acoustic';
    if (f === 'electric') return T.cat === 'electric';
    if (f === 'body') return T.cat === 'acoustic' || !!T.hollow;
    return true;
  };

  /* ===================================================== PICKUP / AMP == */
  // electrical resonance, Q, output and coil width (humbucker: 2 coils ~18 mm apart → fraction of the scale)
  GL.PICKUP_TYPES = {
    'Single coil':       { res: 4800, q: 2.4, out: 0, width: 0, aperture: 0.004 },
    'P-90':              { res: 3300, q: 2.0, out: 3, width: 0, aperture: 0.012 },
    'Humbucker':         { res: 2700, q: 1.6, out: 5, width: 0.029, aperture: 0.006 },
    'Humbucker (split)': { res: 4100, q: 2.1, out: -1, width: 0, aperture: 0.006 },
    'Jazz humbucker':    { res: 2800, q: 1.5, out: 4, width: 0.029, aperture: 0.007 }
  };

  // Tone colour of each selector position and pickup type, used on the REAL (DI) recordings:
  // the recordings were made with one pickup, so the engine applies the DIFFERENCE between
  // the chosen position / type and the guitar's factory one (lo / hi shelf dB, mid peak [Hz, Q, dB]).
  // The physical model does not need this: it computes the real comb filter of each coil.
  GL.PICKUP_VOICE = {
    'Neck':            { lo: 2.5, hi: -3.5, mid: [800, 0.8, 1] },
    'Neck + Middle':   { lo: 1, hi: 1, mid: [1400, 1.3, -3.5] },     // "quack": out-of-phase scoop + sparkle
    'Middle':          { lo: 0, hi: 0, mid: [1000, 0.8, 0] },
    'Middle + Bridge': { lo: -1, hi: 2.5, mid: [1700, 1.3, -4] },
    'Bridge':          { lo: -3, hi: 3.5, mid: [1900, 1.0, 2.5] },
    'Both':            { lo: 0.5, hi: 0.5, mid: [1300, 1.0, -1.5] }
  };
  GL.PICKUP_TYPE_VOICE = {
    'Single coil':       { lo: 0, hi: 0, mid: [1000, 0.8, 0] },
    'P-90':              { lo: 1, hi: -1, mid: [1200, 0.9, 2.5] },
    'Humbucker':         { lo: 2, hi: -3, mid: [600, 0.8, 1.5] },
    'Humbucker (split)': { lo: 0, hi: -0.5, mid: [1000, 0.8, 0] },
    'Jazz humbucker':    { lo: 2.5, hi: -4.5, mid: [500, 0.8, 1] }
  };

  // k = drive of stage 1 at gain 0, kr = extra drive at gain 10, k2/k2r = stage 2,
  // bias = asymmetry (even harmonics), mid = mid knob centre, hp = input high-pass, level = make-up
  GL.AMPS = {
    'Direct (DI)':    { k: 0, kr: 0, k2: 0, k2r: 0, bias: 0, mid: 800, midQ: 0.7, hp: 20, bright: 0, level: 1.0 },
    'Clean (Twin)':   { k: 0.35, kr: 2.0, k2: 0, k2r: 0, bias: 0.04, mid: 450, midQ: 0.7, hp: 60, bright: 2, level: 0.95 },
    'Jazz (JC)':      { k: 0.1, kr: 0.9, k2: 0, k2r: 0, bias: 0, mid: 600, midQ: 0.6, hp: 45, bright: 0, level: 1.0 },
    'Tweed (Bluesy)': { k: 1.2, kr: 7, k2: 0, k2r: 0, bias: 0.12, mid: 800, midQ: 0.6, hp: 90, bright: 1, level: 0.85 },
    'British Crunch': { k: 2, kr: 12, k2: 1.2, k2r: 4, bias: 0.08, mid: 750, midQ: 0.8, hp: 110, bright: 2, level: 0.75 },
    'Hi-Gain':        { k: 4, kr: 28, k2: 3, k2r: 12, bias: 0.06, mid: 700, midQ: 0.9, hp: 160, bright: 3, level: 0.6 }
  };
  // Real amplifiers captured with Neural Amp Modeler (TONE3000, MIT) — nam/models/*.nam
  GL.NAM_MODELS = {
    'NAM · Fender Deluxe Reverb': 'deluxe-a2.nam', 'NAM · Roland JC-120': 'jc.nam', 'NAM · Vox AC10': 'ac10.nam',
    'NAM · Marshall JCM800': 'jcm.nam', 'NAM · Dumble ODS': 'dumble.nam', 'NAM · EVH 5153 (high gain)': '5153.nam'
  };
  // the built-in amp that stands in for a capture while it loads (or when it cannot be loaded)
  GL.NAM_FALLBACK = {
    'NAM · Fender Deluxe Reverb': 'Clean (Twin)', 'NAM · Roland JC-120': 'Jazz (JC)', 'NAM · Vox AC10': 'Tweed (Bluesy)',
    'NAM · Marshall JCM800': 'British Crunch', 'NAM · Dumble ODS': 'Tweed (Bluesy)', 'NAM · EVH 5153 (high gain)': 'Hi-Gain'
  };
  Object.keys(GL.NAM_MODELS).forEach(k => { GL.AMPS[k] = { nam: GL.NAM_MODELS[k], k: 0, kr: 0, k2: 0, k2r: 0, bias: 0, mid: 650, midQ: 0.7, hp: 30, bright: 0, level: 1 }; });
  // Real speaker cabinets / reverbs (impulse responses) — nam/irs/*.wav
  GL.CAB_IRS = { 'IR · Celestion (real cab)': 'celestion.wav', 'IR · Eminence (real cab)': 'eminence.wav', 'IR · Mesa 4x12 (real cab)': 'mesa.wav' };
  GL.REVERB_IRS = { 'Real plate (IR)': 'plate.wav', 'Real spring (IR)': 'spring.wav' };
  // hp/lp Hz, two resonances [f, Q, dB]
  GL.CABS = {
    'None (DI)':   { hp: 20, lp: 20000, p1: [100, 1, 0], p2: [2000, 1, 0] },
    '1x12 Open':   { hp: 75, lp: 5600, p1: [110, 1.2, 3], p2: [2400, 1.5, 4] },
    '2x12 Open':   { hp: 70, lp: 5100, p1: [100, 1.2, 3], p2: [2000, 1.4, 3] },
    '4x12 Closed': { hp: 85, lp: 4600, p1: [120, 1.5, 5], p2: [1700, 1.3, 3] },
    'Jazz 1x15':   { hp: 55, lp: 5200, p1: [95, 1.2, 3], p2: [1600, 1.2, 2] }
  };
  Object.keys(GL.CAB_IRS).forEach(k => { GL.CABS[k] = { ir: GL.CAB_IRS[k], hp: 20, lp: 20000, p1: [100, 1, 0], p2: [2000, 1, 0] }; });
  GL.CAB_MICS = {
    'On-axis':  { f: 3200, q: 1.2, db: 3, lpMul: 1.15 },
    'Off-axis': { f: 3200, q: 1.0, db: -2, lpMul: 0.8 },
    'Ribbon':   { f: 2500, q: 0.8, db: -4, lpMul: 0.65 }
  };
  // acoustic microphone positions: two EQ bands + lowpass multiplier
  GL.MIC_POSITIONS = {
    '12th fret': { lo: [250, 0.8, 2], hi: [3500, 0.7, -1], lpMul: 1 },
    'Soundhole': { lo: [120, 0.9, 5], hi: [3000, 0.7, -3], lpMul: 0.85 },
    'Bridge':    { lo: [180, 0.7, -3], hi: [3200, 0.8, 4], lpMul: 1.1 },
    'Stereo pair (room)': { lo: [200, 0.7, 0], hi: [5000, 0.6, -2], lpMul: 0.75 }
  };

  /* =========================================================== PARAMS == */
  const S = (id, sec, label, min, max, step, unit, forr, tip) => ({ id, sec, label, min, max, step, unit, for: forr, tip });
  const O = (id, sec, label, options, forr, tip) => ({ id, sec, label, options, for: forr, tip });

  GL.SECTIONS = [
    ['source', '🎙 Sound source (real recordings)'], ['attacklab', '🔬 Attack lab (isolate & remove)'], ['strings', '🧵 Strings'], ['pluck', '👆 Pluck / Attack'], ['eq', '🎚 Tone EQ (warm ↔ bright)'],
    ['real', '🧬 Realism / anti-synthetic'], ['body', '🪵 Body'], ['capture', '🎙 Acoustic capture'],
    ['pickups', '🧲 Pickups & knobs'], ['amp', '🔊 Amp & cabinet'], ['fx', '🌫 Space & effects'], ['play', '🤘 Playing / Human feel']
  ];

  GL.PARAMS = [
    // ------------------------------------------------------------- source
    O('engine', 'source', 'Sound engine', ['Real samples', 'Layered (samples + model)', 'Physical model'], 'all',
      'Real samples = recordings of a real guitar (most realistic). Physical model = synthesized strings (fully adjustable). Layered = both together.'),
    O('sampleLib', 'source', 'Sample library', ['Built-in', 'Built-in (alternative)', 'My library (folder)'], 'all', 'Built-in library of this guitar, an alternative recording (Strat: the older, darker one), or a sample library (SFZ / WAV folder) you loaded with "📂 Load library".'),
    S('sampleLevel', 'source', 'Samples level', -18, 12, 0.5, 'dB', 'all', ''),
    S('layerMix', 'source', 'Model layer level', 0, 1, 0.01, '', 'all', 'In "Layered" mode: how much of the physical model is added under the recordings.'),
    S('sampleVelCurve', 'source', 'Dynamics range', 0, 1, 0.01, '', 'all', 'How much softer the soft notes are.'),
    S('sampleVelTone', 'source', 'Velocity → brightness', 0, 1, 0.01, '', 'all', 'For libraries with one velocity layer: soft notes get darker.'),
    S('sampleTone', 'source', 'Samples tone', -1, 0, 0.01, '', 'all', '0 = as recorded, lower = darker.'),
    S('sampleStart', 'source', 'Skip attack start', 0, 40, 0.5, 'ms', 'all', 'Starts the recording a few ms later (softer, less pick).'),
    S('sampleFade', 'source', 'Attack fade-in', 0, 20, 0.1, 'ms', 'all', ''),
    S('sampleRelease', 'source', 'Release noise', 0, 1.5, 0.01, '', 'all', 'Recorded sound of the finger leaving the string (libraries that have it).'),
    S('sampleRestore', 'source', 'DI brightness restore', 0, 1, 0.01, '', 'all', 'Gives back the highs lost when a guitar was recorded into a line input instead of an instrument (Hi-Z) input — dull, "synthetic" DI recordings (Strat alternative library: ~0.8).'),
    S('samplePunch', 'source', 'Pick attack (punch)', 0, 1, 0.01, '', 'all', 'Emphasizes the first milliseconds of every recorded note — gives back the bite of the pick.'),
    S('layerHP', 'source', 'Model layer: only above', 20, 4000, 10, 'Hz', 'all', 'In "Layered" mode the physical model can add only its high harmonics (sparkle, pick) above this frequency.'),
    O('sampleRoute', 'source', 'Library signal', ['Auto', 'Direct input → amp', 'Microphone → mix'], 'all', 'Direct-input libraries must go through the amp + cabinet; microphone recordings go straight to the mix. Auto decides by the guitar type.'),
    // ---------------------------------------------------------- attack lab
    O('attackSolo', 'attacklab', 'Listen to', ['Everything', 'Mute pick / nail click', 'Mute woody knock', 'Mute pluck noise', 'Mute all transients', 'Only transients (no string)'], 'all',
      'Switch off the parts of the attack one by one. When the strange sound disappears you know which part it is — then fix it with the settings of that part. Leave on "Everything" when done.'),
    S('clickDecay', 'attacklab', 'Click length', 0.2, 6, 0.05, 'ms', 'all', 'Duration of the pick / nail click. Long = "tick-tack", short = crisp.'),
    S('clickReso', 'attacklab', 'Click resonance (ping)', 0, 0.97, 0.01, '', 'all', 'High = the click rings like a small bell (metallic). Low = dry noise.'),
    S('knockTone', 'attacklab', 'Knock tone', 150, 2500, 5, 'Hz', 'all', 'Pitch of the woody body knock.'),
    S('knockDecay', 'attacklab', 'Knock length', 2, 40, 0.5, 'ms', 'all', ''),
    S('attackSoft', 'attacklab', 'Attack fade-in', 0, 25, 0.1, 'ms', 'all', 'Softens the very first milliseconds of the string (removes a hard "edge" / click).'),
    S('attackDamp', 'attacklab', 'Attack zing damping', 0, 1, 0.01, '', 'all', 'Extra damping of the high harmonics during the first moments — removes the bright "zing / ping" right after the pluck.'),
    S('attackDampTime', 'attacklab', 'Zing damping time', 5, 300, 1, 'ms', 'all', 'How long that extra damping lasts.'),
    S('transient', 'attacklab', 'Transient shaper', -1, 1, 0.01, '', 'all', 'Negative = softer attacks (smooth), positive = punchier attacks.'),
    // ------------------------------------------------------------ strings
    S('a4', 'strings', 'Tuning reference A4', 415, 466, 0.5, 'Hz', 'all', 'Concert pitch. 440 Hz standard.'),
    O('tuning', 'strings', 'Tuning', Object.keys(GL.CONFIG.tunings), 'all', 'Open-string tuning used by the demos and the fretboard.'),
    S('decayLow', 'strings', 'Sustain — low E', 0.5, 25, 0.1, 's', 'all', 'Time for the low strings to fade 60 dB. Nylon ~5 s, steel ~9 s, solid electric 10–15 s.'),
    S('decayHigh', 'strings', 'Sustain — high E', 0.3, 14, 0.1, 's', 'all', 'Time for the high strings to fade 60 dB. High notes always die faster.'),
    S('brightness', 'strings', 'String brightness', 0, 1, 0.01, '', 'all', 'How long the high harmonics live. Nylon / flatwound low, new steel strings high.'),
    S('brightTrack', 'strings', 'Brightness follows pitch', 0, 1, 0.01, '', 'all', 'Keeps high notes from sounding dull (real strings: the treble strings stay bright).'),
    S('trebleTone', 'strings', 'Treble strings tone', -1, 1, 0.01, '', 'all', 'Only the high notes: left = warmer, less "ringing" (more natural on nylon), right = brighter.'),
    S('inharm', 'strings', 'Stiffness (inharmonicity)', 0, 0.6, 0.005, '', 'all', 'Steel stiffness makes the upper partials slightly sharp — the "metallic" shimmer. Nylon almost 0.'),
    S('inharmStages', 'strings', 'Stiffness filter stages', 1, 4, 1, '', 'all', 'More stages = stronger, smoother dispersion (more CPU).'),
    S('polDetune', 'strings', 'Polarization detune', 0, 6, 0.05, 'cents', 'all', 'A real string vibrates in two planes with slightly different pitch → slow beating, alive tone.'),
    S('polMix', 'strings', 'Polarization mix', 0, 0.5, 0.01, '', 'all', 'How much energy goes into the 2nd plane.'),
    S('polDecay', 'strings', 'Polarization sustain ratio', 0.5, 2.5, 0.01, '×', 'all', 'The vertical plane decays slower → the typical two-stage decay ("aftersound").'),
    S('coupling', 'strings', 'Sympathetic resonance', 0, 1, 0.01, '', 'all', 'The notes played make the free open strings ring softly through the bridge (one-way: no swirl). 0.3 ≈ open strings ringing ~-52 dB after the note stops; 1 ≈ -42 dB (more = audible beating).'),
    S('tuningSpread', 'strings', 'Tuning imperfection', 0, 10, 0.1, 'cents', 'all', 'Small detune per string. Above ~0.5 cent the octaves of a chord beat slowly — heard as a "waah / phaser" in the sustain.'),
    S('stringSpread', 'strings', 'Stereo string spread', 0, 1, 0.01, '', 'all', 'Low strings to the left, high strings to the right (player perspective).'),
    // -------------------------------------------------------------- pluck
    O('pluckMode', 'pluck', 'Plucking', ['finger', 'nail', 'thumb', 'pick'], 'all', 'Flesh, nail, thumb or plectrum: changes hardness, noise and click of the attack.'),
    S('pluckPos', 'pluck', 'Pluck position', 0.04, 0.5, 0.005, '× scale', 'all', 'Distance from the bridge. Near the bridge (0.05–0.1) = bright, nasal; over the neck (0.25+) = round, sweet.'),
    S('hardness', 'pluck', 'Attack hardness', 0, 1, 0.01, '', 'all', 'Soft finger (≈600 Hz) → hard pick (≈9 kHz). Too high = synthetic "fizz" in the attack.'),
    S('noiseMix', 'pluck', 'Attack texture (noise)', 0, 1, 0.01, '', 'all', 'Rough, noisy excitation vs. a smooth pulse.'),
    S('excLen', 'pluck', 'Contact time', 0.2, 1.5, 0.01, '× period', 'all', 'How long the finger/pick touches the string. Longer = softer.'),
    S('attackNoise', 'pluck', 'Pick / nail click', 0, 1, 0.01, '', 'all', 'The acoustic "tick" of the plectrum or nail (heard by the mic, not by pickups).'),
    S('attackTone', 'pluck', 'Click tone', 800, 9000, 10, 'Hz', 'all', 'Centre frequency of the click.'),
    S('velSens', 'pluck', 'Velocity → level', 0, 1, 0.01, '', 'all', 'How much the dynamics change the loudness.'),
    S('velBright', 'pluck', 'Velocity → brightness', 0, 1, 0.01, '', 'all', 'Harder playing = brighter (as on a real guitar).'),
    S('pluckSharp', 'pluck', 'Pluck sharpness', 0, 1, 0.01, '', 'all', 'Shape of the contact: 0 = round push, 1 = sharp snap.'),
    S('fingerWidth', 'pluck', 'Finger / pick width', 0, 1, 0.01, '', 'all', 'A wide fleshy finger rounds off the highest harmonics; a thin pick does not.'),
    S('attackPitch', 'pluck', 'Attack pitch drop', 0, 15, 0.1, 'cents', 'all', 'A hard pluck stretches the string: the note starts slightly sharp and settles in ~0.2 s. Nylon stretches most (5–8), steel 2–4.'),
    S('restrikeKeep', 'pluck', 'Re-pluck keeps old vibration', 0, 1, 0.01, '', 'all', 'When a ringing string is plucked again, part of the old vibration remains.'),
    S('woodiness', 'pluck', 'Woody knock', 0, 1, 0.01, '', 'all', 'Short noisy body knock at the attack.'),
    S('pluckVar', 'pluck', 'Attack variation', 0, 1, 0.01, '', 'all', 'Every pluck slightly different (position, hardness) — kills the "machine gun" effect.'),
    // ----------------------------------------------------------------- eq
    S('eqLow', 'eq', 'Lows (90 Hz)', -15, 15, 0.5, 'dB', 'all', 'Thump / boom of the low strings.'),
    S('eqLowMid', 'eq', 'Low-mids (250 Hz)', -15, 15, 0.5, 'dB', 'all', 'Warmth and fullness — too much = muddy / boxy.'),
    S('eqMid', 'eq', 'Mids (800 Hz)', -15, 15, 0.5, 'dB', 'all', 'Body of the notes, "honk".'),
    S('eqUpMid', 'eq', 'Upper-mids (2 kHz)', -15, 15, 0.5, 'dB', 'all', 'Definition and bite — too much = harsh / nasal.'),
    S('eqPres', 'eq', 'Presence (4.5 kHz)', -15, 15, 0.5, 'dB', 'all', 'Pick attack and clarity.'),
    S('eqAir', 'eq', 'Air (10 kHz)', -15, 15, 0.5, 'dB', 'all', 'Sparkle and string "sheen".'),
    S('tilt', 'eq', 'Warm ↔ Bright', -1, 1, 0.01, '', 'all', 'One knob for the whole colour: left = warm and round, right = bright and open.'),
    S('thickness', 'eq', 'Thickness', 0, 1, 0.01, '', 'all', 'Fat low-mid body (around 170 Hz).'),
    S('mudCut', 'eq', 'Mud cut', 0, 1, 0.01, '', 'all', 'Removes the cardboard / boxy zone (around 320 Hz).'),
    S('harshCut', 'eq', 'Harshness cut', 0, 1, 0.01, '', 'all', 'Removes a piercing frequency (choose it below).'),
    S('harshFreq', 'eq', 'Harshness frequency', 1200, 8000, 10, 'Hz', 'all', 'Sweep it while listening: where the harsh / metallic tone is.'),
    // --------------------------------------------------------------- real
    S('noteDetune', 'real', 'Per-note pitch variation', 0, 8, 0.1, 'cents', 'all', 'Every fretted note slightly different (finger pressure) — a synth is always perfect.'),
    S('drift', 'real', 'Slow pitch drift', 0, 3, 0.01, 'cents', 'all', 'Tiny, slow, random pitch movement of each string while ringing.'),
    S('bodyDiff', 'real', 'Body diffusion (wood density)', 0, 1, 0.01, '', 'body', 'Dense, complex short reflections inside the body — the strongest "not synthetic" control for acoustics.'),
    S('bodyDiffSize', 'real', 'Body diffusion size', 4, 80, 0.5, 'ms', 'body', ''),
    S('saturation', 'real', 'Analog warmth (saturation)', 0, 1, 0.01, '', 'all', 'Gentle tape / pre-amp saturation: glues the sound, rounds digital edges.'),
    S('width', 'real', 'Stereo width', 0, 2, 0.01, '×', 'all', '0 = mono, 1 = normal, 2 = extra wide.'),
    // --------------------------------------------------------------- body
    S('bodyMix', 'body', 'Body resonance amount', 0, 1.5, 0.01, '', 'body', 'Strength of the body modes (wood + air).'),
    S('bodyDetail', 'body', 'Body detail (upper modes)', 0, 1.5, 0.01, '', 'body', 'Dense wood resonances from 300 Hz to 5 kHz — gives the TREBLE strings their natural, non-synthetic colour.'),
    S('bodySize', 'body', 'Body size', 0.7, 1.4, 0.01, '×', 'body', 'Bigger body = lower resonances (parlor 0.85 · dreadnought 1.0 · jumbo 1.15).'),
    S('airFreq', 'body', 'Air resonance (soundhole)', 70, 160, 0.5, 'Hz', 'body', 'Helmholtz "boom" of the body cavity.'),
    S('topFreq', 'body', 'Top plate resonance', 150, 320, 0.5, 'Hz', 'body', 'Main mode of the soundboard.'),
    S('bodyQ', 'body', 'Body ring (Q)', 0.4, 2.5, 0.01, '×', 'body', 'How long and sharp the body resonances ring.'),
    S('bodyLow', 'body', 'Body low end', -12, 12, 0.5, 'dB', 'body', 'Bass of the body.'),
    S('bodyBright', 'body', 'Body brilliance', -12, 12, 0.5, 'dB', 'body', 'Top end of the wood (spruce brighter, cedar/mahogany warmer).'),
    // ------------------------------------------------------------ capture
    O('micPos', 'capture', 'Mic position', Object.keys(GL.MIC_POSITIONS), 'acoustic', 'Where the studio microphone points.'),
    S('micDistance', 'capture', 'Mic distance', 0, 1, 0.01, '', 'acoustic', 'Close = more bass (proximity) and detail; far = airy and softer highs.'),
    S('piezoBlend', 'capture', 'Under-saddle piezo blend', 0, 1, 0.01, '', 'acoustic', 'Electro-acoustic pickup: direct, bright, a bit "quacky". 0 = pure mic.'),
    S('piezoQuack', 'capture', 'Piezo quack', 0, 1, 0.01, '', 'acoustic', 'Typical piezo mid peak.'),
    // ------------------------------------------------------------ pickups
    O('pickupSel', 'pickups', 'Pickup selector', ['Neck', 'Neck + Middle', 'Middle', 'Middle + Bridge', 'Bridge', 'Both'], 'electric', 'Which pickups sound.'),
    O('pickupType', 'pickups', 'Pickup type', Object.keys(GL.PICKUP_TYPES), 'electric', 'Changing it loads typical resonance / Q / output for that type.'),
    S('posNeck', 'pickups', 'Neck pickup position', 0.15, 0.32, 0.001, '× scale', 'electric', 'Distance from the bridge as a fraction of the scale length.'),
    S('posMid', 'pickups', 'Middle pickup position', 0.1, 0.22, 0.001, '× scale', ['strat'], 'Stratocaster middle pickup.'),
    S('posBridge', 'pickups', 'Bridge pickup position', 0.04, 0.12, 0.001, '× scale', 'electric', 'Closer to the bridge = thinner, brighter.'),
    S('pickupRes', 'pickups', 'Pickup resonance', 1500, 7500, 10, 'Hz', 'electric', 'Electrical resonance (inductance + cable). Single coil ~4.5–5 kHz, humbucker ~2.5 kHz.'),
    S('pickupQ', 'pickups', 'Resonance peak (Q)', 0.5, 5, 0.01, '', 'electric', 'Height of the resonance peak.'),
    S('pickupOut', 'pickups', 'Pickup output', -12, 12, 0.5, 'dB', 'electric', 'Hotter pickups drive the amp harder.'),
    S('toneKnob', 'pickups', 'Tone knob', 0, 10, 0.1, '', 'electric', '10 = open; lower = darker, woman tone at 0–2.'),
    S('volumeKnob', 'pickups', 'Volume knob', 0, 10, 0.1, '', 'electric', 'Guitar volume: also cleans up the amp distortion.'),
    S('trebleBleed', 'pickups', 'Treble bleed', 0, 1, 1, '', 'electric', '1 = keeps the highs when the volume knob is lowered.'),
    // ---------------------------------------------------------------- amp
    O('ampModel', 'amp', 'Amp model', Object.keys(GL.NAM_MODELS).concat(Object.keys(GL.AMPS).filter(k => !GL.AMPS[k].nam)), 'electric',
      '"NAM ·" = neural captures of REAL amplifiers (needs the local server). The others are simple built-in amp simulations.'),
    S('namInput', 'amp', 'NAM input (drive)', -24, 24, 0.5, 'dB', 'electric', 'How hard the guitar hits the real amp capture: more = more break-up.'),
    S('gain', 'amp', 'Gain / drive', 0, 10, 0.1, '', 'electric', 'Pre-amp drive.'),
    S('bass', 'amp', 'Bass', 0, 10, 0.1, '', 'electric', ''),
    S('mid', 'amp', 'Middle', 0, 10, 0.1, '', 'electric', ''),
    S('treble', 'amp', 'Treble', 0, 10, 0.1, '', 'electric', ''),
    S('presence', 'amp', 'Presence', 0, 10, 0.1, '', 'electric', 'Upper-mid bite of the power amp.'),
    S('master', 'amp', 'Master', 0, 10, 0.1, '', 'electric', 'Amp output level.'),
    O('cab', 'amp', 'Cabinet', Object.keys(GL.CAB_IRS).concat(Object.keys(GL.CABS).filter(k => !GL.CABS[k].ir)), 'electric', '"IR ·" = impulse responses of real speaker cabinets.'),
    O('cabMic', 'amp', 'Cabinet mic', Object.keys(GL.CAB_MICS), 'electric', 'On-axis = bright, off-axis = warm, ribbon = smooth / dark.'),
    // ----------------------------------------------------------------- fx
    O('reverbType', 'fx', 'Reverb type', ['Room', 'Studio', 'Hall', 'Plate', 'Spring', 'Real plate (IR)', 'Real spring (IR)'], 'all', '"Real" = impulse responses of real reverb units.'),
    S('reverbSize', 'fx', 'Reverb time', 0.2, 5, 0.05, 's', 'all', ''),
    S('reverbMix', 'fx', 'Reverb mix', 0, 1, 0.01, '', 'all', ''),
    S('predelay', 'fx', 'Reverb pre-delay', 0, 80, 1, 'ms', 'all', ''),
    S('chorusMix', 'fx', 'Chorus mix', 0, 1, 0.01, '', 'all', 'Also a 12-string / doubled feel at low depth.'),
    S('chorusRate', 'fx', 'Chorus rate', 0.1, 5, 0.01, 'Hz', 'all', ''),
    S('chorusDepth', 'fx', 'Chorus depth', 0, 1, 0.01, '', 'all', ''),
    S('delayMix', 'fx', 'Delay mix', 0, 1, 0.01, '', 'all', ''),
    S('delayTime', 'fx', 'Delay time', 40, 1200, 1, 'ms', 'all', ''),
    S('delayFeedback', 'fx', 'Delay feedback', 0, 0.9, 0.01, '', 'all', ''),
    S('comp', 'fx', 'Compressor', 0, 1, 0.01, '', 'all', 'Studio compression (evens dynamics, adds sustain).'),
    S('lowCut', 'fx', 'Low cut', 20, 300, 1, 'Hz', 'all', ''),
    S('highCut', 'fx', 'High cut', 2000, 20000, 10, 'Hz', 'all', 'Real recorded acoustics have little above 9–12 kHz. Lower it if the attack sounds fizzy / digital.'),
    S('output', 'fx', 'Output level', -24, 12, 0.5, 'dB', 'all', ''),
    // --------------------------------------------------------------- play
    S('strumSpeed', 'play', 'Strum speed', 2, 60, 0.5, 'ms/string', 'all', 'Delay between strings in a strum. Fast rasgueado ~5, relaxed ~15.'),
    S('humanTime', 'play', 'Timing feel', 0, 30, 0.5, 'ms', 'all', 'Random timing deviation (0 = robotic).'),
    S('humanVel', 'play', 'Dynamics feel', 0, 1, 0.01, '', 'all', 'Random velocity deviation.'),
    S('palmMute', 'play', 'Palm-mute amount', 0, 1, 0.01, '', 'all', 'How hard the palm mutes the notes marked PM in the demos.'),
    S('releaseTime', 'play', 'Finger release (mute)', 10, 400, 1, 'ms', 'all', 'How fast a released note is damped by the fingers.'),
    S('squeak', 'play', 'String squeak level', 0, 1, 0.01, '', 'all', 'Finger squeak when the left hand slides on wound strings.'),
    S('squeakProb', 'play', 'Squeak probability', 0, 1, 0.01, '', 'all', 'How often chord changes squeak.'),
    S('vibDepth', 'play', 'Vibrato depth', 0, 80, 0.5, 'cents', 'all', 'For notes played with vibrato.'),
    S('vibRate', 'play', 'Vibrato rate', 2, 9, 0.05, 'Hz', 'all', ''),
    S('vibDelay', 'play', 'Vibrato delay', 0, 1.5, 0.01, 's', 'all', 'Players start vibrato after the attack.'),
    S('legatoLevel', 'play', 'Hammer-on / pull-off level', 0, 1, 0.01, '', 'all', 'Energy of notes played without picking.')
  ];
  GL.PARAM = {};
  GL.PARAMS.forEach(p => { GL.PARAM[p.id] = p; });

  /* ========================================================== FACTORY == */
  const BASE = {
    a4: 440, tuning: 'Standard', decayLow: 8, decayHigh: 3.5, brightness: 0.6, brightTrack: 0.5, inharm: 0.08, inharmStages: 2,
    polDetune: 0.6, polMix: 0.12, polDecay: 1.3, coupling: 0.2, tuningSpread: 0.3, stringSpread: 0.2,
    pluckMode: 'pick', pluckPos: 0.14, hardness: 0.6, noiseMix: 0.35, excLen: 0.6, attackNoise: 0.2, attackTone: 3500, velSens: 0.5, velBright: 0.5,
    restrikeKeep: 0.35, attackPitch: 3, woodiness: 0.3, pluckVar: 0.3,
    bodyMix: 0.6, bodySize: 1, airFreq: 100, topFreq: 195, bodyQ: 1, bodyLow: 0, bodyBright: 0,
    micPos: '12th fret', micDistance: 0.35, piezoBlend: 0, piezoQuack: 0.4,
    pickupSel: 'Bridge', pickupType: 'Single coil', posNeck: 0.25, posMid: 0.155, posBridge: 0.065, pickupRes: 4800, pickupQ: 2.4, pickupOut: 0,
    toneKnob: 10, volumeKnob: 10, trebleBleed: 1,
    ampModel: 'Clean (Twin)', gain: 3, bass: 5, mid: 5, treble: 6, presence: 5, master: 6, cab: '2x12 Open', cabMic: 'On-axis',
    reverbType: 'Room', reverbSize: 1.2, reverbMix: 0.18, predelay: 12, chorusMix: 0, chorusRate: 0.8, chorusDepth: 0.4,
    delayMix: 0, delayTime: 380, delayFeedback: 0.3, comp: 0.3, lowCut: 60, highCut: 12000, output: 0,
    strumSpeed: 12, humanTime: 8, humanVel: 0.35, palmMute: 0.7, releaseTime: 90, squeak: 0.3, squeakProb: 0.35,
    vibDepth: 22, vibRate: 5.2, vibDelay: 0.25, legatoLevel: 0.45,
    attackSolo: 'Everything', clickDecay: 0.9, clickReso: 0.78, knockTone: 650, knockDecay: 9, attackSoft: 0, attackDamp: 0, attackDampTime: 40, transient: 0,
    pluckSharp: 0.5, fingerWidth: 0.15,
    eqLow: 0, eqLowMid: 0, eqMid: 0, eqUpMid: 0, eqPres: 0, eqAir: 0, tilt: 0, thickness: 0, mudCut: 0, harshCut: 0, harshFreq: 3200,
    sampleRestore: 0, samplePunch: 0, layerHP: 20, sampleRoute: 'Auto',
    engine: 'Physical model', sampleLib: 'Built-in', sampleLevel: 0, layerMix: 0.25, sampleVelCurve: 0.5, sampleVelTone: 0.5, sampleTone: 0, sampleStart: 0, sampleFade: 0, sampleRelease: 0.6, namInput: 0,
    noteDetune: 1, drift: 0, bodyDiff: 0.4, bodyDiffSize: 22, saturation: 0.1, width: 1, bodyDetail: 0.7, trebleTone: 0
  };
  const FACTORY = {
    nylon: {
      decayLow: 5.5, decayHigh: 2.2, brightness: 0.42, brightTrack: 0.45, inharm: 0.015, inharmStages: 1, polDetune: 0.5, polMix: 0.14, polDecay: 1.25,
      engine: 'Real samples', coupling: 0.35, attackPitch: 6, fingerWidth: 0.35, pluckSharp: 0.4, bodyDiff: 0.5, bodyDetail: 0.85, trebleTone: -0.3, pluckMode: 'nail', pluckPos: 0.17, hardness: 0.35, noiseMix: 0.06, excLen: 0.8, attackNoise: 0.05, attackTone: 2800, woodiness: 0.45,
      bodyMix: 0.8, airFreq: 98, topFreq: 205, bodyLow: 1, bodyBright: -2, micPos: '12th fret', micDistance: 0.4,
      reverbType: 'Room', reverbSize: 1.4, reverbMix: 0.2, comp: 0.2, lowCut: 50, highCut: 9500, strumSpeed: 14, squeak: 0.2, releaseTime: 120
    },
    steel: {
      engine: 'Real samples',
      decayLow: 9, decayHigh: 4, brightness: 0.72, brightTrack: 0.55, inharm: 0.12, polDetune: 0.7, polMix: 0.14, polDecay: 1.35, coupling: 0.3, attackPitch: 3.5, trebleTone: -0.15, bodyDetail: 0.75,
      pluckMode: 'pick', pluckPos: 0.13, hardness: 0.58, noiseMix: 0.38, excLen: 0.55, attackNoise: 0.25, attackTone: 4200, woodiness: 0.35,
      bodyMix: 0.65, airFreq: 102, topFreq: 188, bodyLow: 2, bodyBright: 1, micDistance: 0.35, reverbSize: 1.3, reverbMix: 0.18, comp: 0.35,
      strumSpeed: 11, squeak: 0.35
    },
    strat: {
      decayLow: 11, decayHigh: 5.5, brightness: 0.78, inharm: 0.1, polDetune: 0.5, polMix: 0.1, polDecay: 1.4, coupling: 0.12, attackPitch: 2,
      pluckMode: 'pick', pluckPos: 0.12, hardness: 0.6, noiseMix: 0.3, excLen: 0.5, attackNoise: 0.03, woodiness: 0.1,
      pickupSel: 'Neck', pickupType: 'Single coil', posNeck: 0.247, posMid: 0.155, posBridge: 0.068, pickupRes: 4800, pickupQ: 2.4, pickupOut: 0,
      engine: 'Real samples', sampleRestore: 0, samplePunch: 0.15, layerHP: 1500, layerMix: 0.5, sampleVelTone: 0.2,
      ampModel: 'NAM · Fender Deluxe Reverb', namInput: 0, gain: 3, bass: 5, mid: 5, treble: 5, presence: 5, master: 6, cab: 'IR · Celestion (real cab)', cabMic: 'On-axis',
      reverbType: 'Real spring (IR)', reverbSize: 1.6, reverbMix: 0.2, comp: 0.3, squeak: 0.25
    },
    lespaul: {
      decayLow: 14, decayHigh: 7, brightness: 0.68, inharm: 0.1, polDetune: 0.4, polMix: 0.08, polDecay: 1.5, coupling: 0.1, attackPitch: 1.8,
      pluckMode: 'pick', pluckPos: 0.12, hardness: 0.62, noiseMix: 0.3, excLen: 0.5, attackNoise: 0.03, woodiness: 0.08,
      pickupSel: 'Bridge', pickupType: 'Humbucker', posNeck: 0.25, posBridge: 0.072, pickupRes: 2700, pickupQ: 1.6, pickupOut: 4,
      engine: 'Real samples',
      ampModel: 'NAM · Marshall JCM800', namInput: 0, gain: 5.5, bass: 5, mid: 5, treble: 5, presence: 5, master: 6, cab: 'IR · Mesa 4x12 (real cab)', cabMic: 'On-axis',
      reverbType: 'Room', reverbSize: 1.1, reverbMix: 0.14, comp: 0.15, palmMute: 0.75, squeak: 0.3
    },
    hollow: {
      decayLow: 6.5, decayHigh: 2.8, brightness: 0.42, brightTrack: 0.4, inharm: 0.07, polDetune: 0.6, polMix: 0.12, coupling: 0.25, attackPitch: 2.5, bodyDetail: 0.5, trebleTone: -0.1,
      pluckMode: 'pick', pluckPos: 0.2, hardness: 0.42, noiseMix: 0.2, excLen: 0.7, attackNoise: 0.06, woodiness: 0.35,
      bodyMix: 0.35, bodySize: 1.05, airFreq: 118, topFreq: 235, bodyQ: 1.1,
      pickupSel: 'Neck', pickupType: 'Jazz humbucker', posNeck: 0.235, posBridge: 0.08, pickupRes: 2800, pickupQ: 1.5, pickupOut: 3, toneKnob: 8,
      engine: 'Real samples',
      ampModel: 'NAM · Roland JC-120', namInput: 0, gain: 2, bass: 5, mid: 5, treble: 5, presence: 5, master: 6, cab: 'IR · Eminence (real cab)', cabMic: 'Off-axis',
      reverbType: 'Real plate (IR)', reverbSize: 1.5, reverbMix: 0.16, comp: 0.25, strumSpeed: 9, squeak: 0.12, highCut: 10000
    }
  };
  /* Factory values of version 1 (changed in v2 because they produced a slow
   * "rotating speaker" swirl). Variants still holding these exact values are
   * moved to the new factory values when the lab loads. 'coupling' changed its
   * meaning (now 0..1) so it is always reset. */
  GL.V1_FACTORY = {
    nylon: { polDetune: 0.8, polMix: 0.3, coupling: 0.0012, tuningSpread: 2 },
    steel: { polDetune: 1.6, polMix: 0.28, coupling: 0.0015, tuningSpread: 2 },
    strat: { polDetune: 1.0, polMix: 0.2, coupling: 0.1, tuningSpread: 2 },
    lespaul: { polDetune: 0.8, polMix: 0.18, coupling: 0.3, tuningSpread: 2 },
    hollow: { polDetune: 1.2, polMix: 0.25, coupling: 0.001, tuningSpread: 2 }
  };
  /* Version 2 nylon attack (too much noise + nail click → sounded like a metal pick) */
  GL.V2_FACTORY = { nylon: { hardness: 0.38, noiseMix: 0.18, attackNoise: 0.12 } };
  /* Version 3 stereo string spread (wide spread made chord beating swirl between the ears) */
  GL.V3_FACTORY = { all: { stringSpread: 0.35, tuningSpread: [2, 1.2] } };
  /* Version 4 hollow body (too dark: tone knob at 6 + dark pickup + dark amp) */
  GL.V4_FACTORY = { hollow: { pickupRes: 2300, pickupQ: 1.3, toneKnob: 6, bass: 6, mid: 5, treble: 4, presence: 3.5 } };
  /* Version 6 attack brightness (hardness / high cut let a digital "fizz" through) */
  GL.V6_FACTORY = { all: { highCut: [16000, 14000] }, steel: { hardness: [0.66] } };
  /* Version 7 electric amp / cab / reverb factory values (replaced by real amp captures + real cab IRs) */
  GL.V7_FACTORY = {
    strat: { ampModel: 'Clean (Twin)', cab: '2x12 Open', reverbType: 'Spring', master: 7.5 },
    lespaul: { ampModel: 'British Crunch', cab: '4x12 Closed', master: 4.2 },
    hollow: { ampModel: 'Jazz (JC)', cab: 'Jazz 1x15', reverbType: 'Plate', master: 4.5 }
  };
  /* Version 8 Strat values made for the old, dull Strat recording */
  GL.V8_FACTORY = { strat: { sampleRestore: 0.8, samplePunch: 0.5 } };
  /** A fresh copy of the factory settings of a guitar type */
  GL.factory = type => Object.assign({}, BASE, FACTORY[type] || {});
  /** Fill missing / invalid keys of a stored settings object (new params added later) */
  GL.sanitize = function (type, s) {
    const f = GL.factory(type), out = {};
    GL.PARAMS.forEach(p => {
      let v = s && s[p.id] !== undefined ? s[p.id] : f[p.id];
      if (p.options) { if (!p.options.includes(v)) v = f[p.id]; }
      else { v = +v; if (!isFinite(v)) v = f[p.id]; v = Math.min(p.max, Math.max(p.min, v)); }
      out[p.id] = v;
    });
    return out;
  };

  /* ============================================================ CHORDS == */
  // frets low E → high e (-1 = muted string)
  GL.CHORDS = {
    C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 3, 3], D: [-1, -1, 0, 2, 3, 2], Em: [0, 2, 2, 0, 0, 0], Am: [-1, 0, 2, 2, 1, 0],
    F: [1, 3, 3, 2, 1, 1], E: [0, 2, 2, 1, 0, 0], A: [-1, 0, 2, 2, 2, 0], Dm: [-1, -1, 0, 2, 3, 1], G7: [3, 2, 0, 0, 0, 1],
    Am7: [-1, 0, 2, 0, 1, 0], Cmaj7: [-1, 3, 2, 0, 0, 0], Fmaj7: [-1, -1, 3, 2, 1, 0], E7: [0, 2, 0, 1, 0, 0], B7: [-1, 2, 1, 2, 0, 2],
    Dm9: [-1, 5, 3, 5, 5, -1], G13: [3, -1, 3, 4, 5, -1], Cmaj9: [-1, 3, 2, 4, 3, -1],
    'Dm7 (jazz)': [-1, 5, 7, 5, 6, -1], 'G7 (jazz)': [3, -1, 3, 4, 3, -1], 'Cmaj7 (jazz)': [-1, 3, 5, 4, 5, -1], A7b9: [-1, 0, 2, 3, 2, 3],
    E5: [0, 2, 2, -1, -1, -1], G5: [3, 5, 5, -1, -1, -1], A5: [5, 7, 7, -1, -1, -1], C5: [-1, 3, 5, 5, -1, -1], D5: [-1, 5, 7, 7, -1, -1],
    E9: [-1, 7, 6, 7, 7, 7]
  };
  GL.CHORD_PAD = ['C', 'G', 'D', 'Em', 'Am', 'F', 'E', 'A', 'Dm', 'G7', 'Am7', 'Cmaj7', 'Fmaj7', 'E7', 'B7', 'Dm9', 'G13', 'Cmaj9', 'E5', 'A5', 'E9'];

  /* ============================================================= DEMOS == */
  /*
   * A demo returns a list of musical events in BEATS (the sequencer turns them
   * into seconds, adds the human feel and the squeaks):
   *   { k:'n', b, s, f, d, v, pm, vib, bend:{semis, at, dur, back}, legato, glide, harm, dead }
   *   { k:'strum', b, chord, dir:'D'|'U', d, v, pm, strings:[lo,hi], speed }
   *   s = string 0 (low E) … 5 (high e), f = fret, d = duration in beats, v = velocity 0..1
   */
  const N = (b, s, f, d, v, o) => Object.assign({ k: 'n', b, s, f, d, v: v === undefined ? 0.75 : v }, o || {});
  const ST = (b, chord, dir, d, v, o) => Object.assign({ k: 'strum', b, chord, dir, d, v: v === undefined ? 0.75 : v }, o || {});
  function arpeggio(b0, chord, order, step, dur, v) {
    const fr = GL.CHORDS[chord], out = [];
    order.forEach((s, i) => { if (fr[s] >= 0) out.push(N(b0 + i * step, s, fr[s], dur, v + (i === 0 ? 0.08 : 0))); });
    return out;
  }

  GL.DEMOS = [
    { id: 'open', name: 'Open strings + chord sustain', bpm: 60, build() {
      const e = [];
      for (let s = 0; s < 6; s++) e.push(N(s * 2, s, 0, 2.2, 0.75));
      e.push(ST(13, 'E', 'D', 8, 0.8));
      return e;
    } },
    { id: 'scale', name: 'G major scale, 2 octaves', bpm: 100, build() {
      const notes = [[0, 3], [1, 0], [1, 2], [1, 3], [2, 0], [2, 2], [2, 4], [3, 0], [3, 2], [4, 0], [4, 1], [4, 3], [5, 0], [5, 2], [5, 3]];
      const e = [];
      notes.forEach(([s, f], i) => e.push(N(i * 0.5, s, f, 0.6, 0.65 + (i % 4 === 0 ? 0.1 : 0))));
      notes.slice().reverse().forEach(([s, f], i) => e.push(N(8 + i * 0.5, s, f, i === notes.length - 1 ? 3 : 0.6, 0.65)));
      return e;
    } },
    { id: 'strum', name: 'Strummed open chords (G – C – D – Em)', bpm: 92, build() {
      const e = [];
      ['G', 'C', 'D', 'Em', 'G', 'C', 'D', 'G'].forEach((c, bar) => {
        const b = bar * 4;
        [[0, 'D', 0.9], [1, 'D', 0.7], [1.5, 'U', 0.55], [2.5, 'U', 0.55], [3, 'D', 0.75], [3.5, 'U', 0.6]].forEach(([o, dir, v]) => e.push(ST(b + o, c, dir, bar === 7 && o === 0 ? 4 : 0.9, v)));
      });
      return e.filter(x => !(x.b >= 28.5));
    } },
    { id: 'travis', name: 'Fingerpicking — Travis (C – Am – Dm – G7)', bpm: 96, build() {
      const e = [];
      const plan = [['C', [1, 3, 0, 3]], ['Am', [1, 2, 1, 2]], ['Dm', [2, 1, 2, 1]], ['G7', [0, 2, 0, 2]]];
      for (let rep = 0; rep < 2; rep++) plan.forEach(([c, bass], k) => {
        const fr = GL.CHORDS[c], b = (rep * 4 + k) * 4;
        const altBass = s => (fr[s] >= 0 ? fr[s] : (c === 'C' && s === 0 ? 3 : 0));
        bass.forEach((s, i) => e.push(N(b + i, s, altBass(s), 1.1, 0.72, { pm: true })));
        [[0.5, 4], [1.5, 3], [2, 5], [2.5, 4], [3.5, 3]].forEach(([o, s]) => { if (fr[s] >= 0) e.push(N(b + o, s, fr[s], 1.2, 0.6)); });
      });
      return e;
    } },
    { id: 'ballad', name: 'Ballad arpeggio p-i-m-a (Am – F – C – G)', bpm: 72, build() {
      const e = [];
      ['Am', 'Fmaj7', 'C', 'G', 'Am', 'Fmaj7', 'C', 'E'].forEach((c, bar) => {
        const fr = GL.CHORDS[c], root = fr.findIndex(x => x >= 0);
        e.push(...arpeggio(bar * 4, c, [root, 3, 4, 5, 4, 3, 4, 3].map((s, i) => (i === 0 ? root : s)), 0.5, 2.5, 0.62));
      });
      e.push(N(32, 1, 0, 4, 0.7), N(32, 2, 2, 4, 0.6), N(32, 3, 2, 4, 0.6), N(32, 4, 1, 4, 0.6), N(32, 5, 0, 4, 0.6));
      return e;
    } },
    { id: 'rasgueado', name: 'Flamenco rasgueado (Am – G – F – E)', bpm: 100, build() {
      const e = [];
      ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'].forEach((c, bar) => {
        const b = bar * 4;
        // e-a-m-i fan: four fast down-strokes, then accents
        [0, 0.12, 0.24, 0.36].forEach((o, i) => e.push(ST(b + o, c, 'D', 0.6, 0.55 + i * 0.1, { speed: 0.5 })));
        e.push(ST(b + 1, c, 'D', 0.5, 0.95, { speed: 0.6 }), ST(b + 1.5, c, 'U', 0.5, 0.7, { speed: 0.6 }), ST(b + 2, c, 'D', 0.5, 0.85, { speed: 0.6 }),
          ST(b + 3, c, 'D', 1, 1, { speed: 0.5 }), ST(b + 3.5, c, 'U', 0.5, 0.6, { speed: 0.7 }));
      });
      e.push(ST(32, 'E', 'D', 4, 1));
      return e;
    } },
    { id: 'bossa', name: 'Bossa nova (Dm9 – G13 – Cmaj9)', bpm: 128, build() {
      const e = [];
      const prog = ['Dm9', 'G13', 'Cmaj9', 'Cmaj9', 'Dm9', 'G13', 'Cmaj9', 'A7b9'];
      prog.forEach((c, bar) => {
        const fr = GL.CHORDS[c], b = bar * 4, root = fr.findIndex(x => x >= 0);
        // thumb: root on 1 and 3 (alternating 5th on 3)
        e.push(N(b, root, fr[root], 1.6, 0.7, { pm: true }), N(b + 2, root, fr[root], 1.6, 0.66, { pm: true }));
        // fingers: chord pinches on the bossa pattern
        [0, 1.5, 2.5, 3.5].concat(bar % 2 ? [3] : [1]).forEach(o => e.push(ST(b + o, c, 'U', 0.45, 0.55, { strings: [root + 1, 5], speed: 0.15 })));
      });
      return e;
    } },
    { id: 'jazz', name: 'Jazz comping ii – V – I (four to the bar)', bpm: 124, build() {
      const e = [];
      ['Dm7 (jazz)', 'G7 (jazz)', 'Cmaj7 (jazz)', 'Cmaj7 (jazz)', 'Dm7 (jazz)', 'G7 (jazz)', 'Cmaj7 (jazz)', 'A7b9'].forEach((c, bar) => {
        for (let q = 0; q < 4; q++) e.push(ST(bar * 4 + q, c, 'D', 0.8, q === 1 || q === 3 ? 0.72 : 0.62, { speed: 0.6 }));
      });
      e.push(ST(32, 'Cmaj7 (jazz)', 'D', 4, 0.7, { speed: 1.5 }));
      return e;
    } },
    { id: 'blues', name: 'Blues lick in A (bends, vibrato)', bpm: 76, build() {
      return [
        N(0, 3, 7, 1, 0.85, { bend: { semis: 2, at: 0.1, dur: 0.3 }, vib: true }), N(1, 4, 5, 0.5, 0.75), N(1.5, 4, 8, 0.5, 0.8),
        N(2, 4, 5, 0.25, 0.7, { legato: true }), N(2.25, 3, 7, 0.5, 0.7), N(2.75, 3, 5, 0.5, 0.7), N(3.25, 2, 7, 1.5, 0.8, { vib: true }),
        N(5, 5, 8, 1, 0.9, { bend: { semis: 1, at: 0.05, dur: 0.2 }, vib: true }), N(6, 5, 5, 0.5, 0.75), N(6.5, 4, 8, 0.5, 0.75),
        N(7, 4, 5, 0.5, 0.7), N(7.5, 3, 7, 0.75, 0.8, { bend: { semis: 2, at: 0, dur: 0.15, back: 0.5 } }), N(8.25, 3, 5, 0.25, 0.7),
        N(8.5, 2, 7, 0.5, 0.75), N(9, 2, 5, 0.5, 0.7), N(9.5, 1, 7, 0.5, 0.75), N(10, 1, 5, 2.5, 0.85, { vib: true }),
        N(13, 2, 7, 0.25, 0.8, { slideFrom: 5 }), N(13.5, 3, 5, 0.5, 0.7), N(14, 3, 7, 2, 0.9, { bend: { semis: 2, at: 0.25, dur: 0.4 }, vib: true })
      ];
    } },
    { id: 'rock', name: 'Rock riff (power chords, palm mute)', bpm: 124, build() {
      const e = [];
      for (let bar = 0; bar < 4; bar++) {
        const b = bar * 4;
        for (let i = 0; i < 6; i++) e.push(ST(b + i * 0.5, 'E5', 'D', 0.45, 0.8, { pm: true, speed: 0.4 }));
        const end = bar % 2 ? ['A5', 'G5'] : ['G5', 'A5'];
        e.push(ST(b + 3, end[0], 'D', 0.5, 0.95, { speed: 0.4 }), ST(b + 3.5, end[1], 'D', bar === 3 ? 4 : 0.5, 0.95, { speed: 0.4 }));
      }
      e.push(ST(16, 'E5', 'D', 4, 1, { speed: 0.5 }));
      return e;
    } },
    { id: 'funk', name: 'Funk (E9 stabs + dead-note scratch)', bpm: 100, build() {
      const e = [];
      const pat = 'X.x.xX.xX.x.xX.x';   // X = chord stab, x = muted scratch
      for (let bar = 0; bar < 4; bar++) for (let i = 0; i < 16; i++) {
        const ch = pat[i]; if (ch === '.') continue;
        e.push(ST(bar * 4 + i * 0.25, 'E9', i % 2 ? 'U' : 'D', ch === 'X' ? 0.2 : 0.1, ch === 'X' ? 0.85 : 0.55, { strings: [2, 5], speed: 0.25, dead: ch === 'x' }));
      }
      return e;
    } },
    { id: 'lead', name: 'Lead melody (slides, hammer-ons, vibrato)', bpm: 88, build() {
      return [
        N(0, 3, 5, 0.5, 0.75), N(0.5, 3, 7, 0.5, 0.6, { legato: true }), N(1, 4, 5, 1, 0.8, { vib: true }), N(2, 4, 8, 0.5, 0.8),
        N(2.5, 4, 10, 1.5, 0.75, { legato: true, glide: 0.08, vib: true }), N(4, 5, 8, 0.5, 0.8), N(4.5, 5, 10, 0.5, 0.65, { legato: true }),
        N(5, 5, 8, 0.5, 0.65, { legato: true }), N(5.5, 4, 10, 0.5, 0.75), N(6, 4, 8, 2, 0.8, { vib: true }),
        N(8, 4, 13, 0.5, 0.85, { slideFrom: 10 }), N(8.5, 5, 12, 1.5, 0.9, { vib: true }), N(10, 5, 15, 1, 0.9, { bend: { semis: 2, at: 0.1, dur: 0.25 }, vib: true }),
        N(11, 5, 12, 0.5, 0.7), N(11.5, 4, 13, 0.5, 0.7), N(12, 4, 12, 0.5, 0.65, { legato: true }), N(12.5, 4, 10, 0.5, 0.65, { legato: true }),
        N(13, 3, 12, 3, 0.85, { vib: true })
      ];
    } },
    { id: 'attack', name: 'Attack test — repeated single notes', bpm: 60, build() {
      // the same notes again and again at different strengths: listen to the attack only
      const e = [], notes = [[3, 2], [5, 0], [0, 0], [4, 5]];
      notes.forEach(([s, f], k) => [0.45, 0.65, 0.85, 1].forEach((v, i) => e.push(N(k * 4 + i, s, f, 0.85, v))));
      return e;
    } },
    { id: 'harmonics', name: 'Harmonics + long sustain test', bpm: 70, build() {
      const e = [];
      for (let s = 0; s < 6; s++) e.push(N(s * 0.5, s, 12, 4, 0.7, { harm: 12 }));
      [3, 4, 5].forEach((s, i) => e.push(N(5 + i * 0.5, s, 7, 3, 0.65, { harm: 19 })));
      e.push(N(9, 2, 7, 6, 0.85, { vib: true }));
      return e;
    } }
  ];
  // demos recommended first for each guitar
  GL.DEMO_ORDER = {
    nylon: ['ballad', 'rasgueado', 'bossa', 'attack', 'open', 'travis', 'scale', 'harmonics', 'strum', 'lead', 'blues', 'jazz', 'rock', 'funk'],
    steel: ['strum', 'travis', 'open', 'attack', 'ballad', 'scale', 'harmonics', 'blues', 'lead', 'bossa', 'rasgueado', 'jazz', 'rock', 'funk'],
    strat: ['lead', 'funk', 'blues', 'attack', 'strum', 'open', 'ballad', 'scale', 'harmonics', 'rock', 'jazz', 'travis', 'bossa', 'rasgueado'],
    lespaul: ['rock', 'blues', 'lead', 'attack', 'open', 'strum', 'scale', 'harmonics', 'ballad', 'funk', 'jazz', 'travis', 'bossa', 'rasgueado'],
    hollow: ['jazz', 'bossa', 'blues', 'attack', 'lead', 'open', 'scale', 'ballad', 'harmonics', 'strum', 'travis', 'funk', 'rock', 'rasgueado']
  };
})();
