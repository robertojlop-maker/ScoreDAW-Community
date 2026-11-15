/* =====================================================================
 *  PIANO LAB — presets.js : DATA (instruments, settings, demos)
 *  ---------------------------------------------------------------------
 *  Stand-alone test bench for ScoreDAW's realistic keyboard engines:
 *    grand   Grand piano      real recordings (Yamaha C5) and / or a string
 *                             model with 1, 2 or 3 strings per note
 *    epiano  Electric piano   Rhodes (tines) / Wurlitzer (reeds): recordings
 *                             or a tine + pickup model, tremolo, phaser, amp
 *    synth   Synthesizer      2 oscillators + sub + noise, unison, ladder
 *                             filter, 2 envelopes, LFO (analog polysynth)
 *    organ   Organ            tonewheel organ: 9 drawbars, percussion, key
 *                             click, vibrato / chorus scanner, rotary speaker
 *  Everything a setting needs is declared here (PL.PARAMS): the interface,
 *  the storage and the engine all read this list.
 *  To add a setting: add one S(...) line + its factory value.
 * ===================================================================== */
(function () {
  'use strict';
  const PL = window.PL = window.PL || {};

  /* ============================================================ CONFIG == */
  PL.CONFIG = {
    version: 2,                              // settings version (for migrations of the factory sounds)
    storageKey: 'scoredaw.pianolab.v1',      // localStorage key of the lab state
    exportSampleRate: 48000,                 // WAV export
    decodeRate: 32000,                       // recordings are decoded at this rate (memory: 32 kHz keeps everything below 16 kHz)
    maxSampleVoices: 72,                     // polyphony of the recordings player
    maxModelVoices: 40,                      // polyphony of the models (worklet)
    keyboard: { low: 21, high: 108 }         // A0 … C8
  };

  /* ============================================================ ASSETS == *
   * Recordings (samples/) are loaded with fetch() when the page is served
   * over http(s). A page opened straight from disk (file://) cannot fetch()
   * but CAN run <script> files, so every asset also exists as a script
   * "pack" (packs/*.js, made by build_packs.py) that calls PL.addAsset().
   *   PL.BASE  folder of the lab relative to the page ('' for the lab itself) */
  PL.asset = path => (PL.BASE || '') + path;
  PL.fromDisk = () => location.protocol === 'file:';
  PL.ASSETS = PL.ASSETS || {};
  const packWait = {};
  PL.addAsset = function (path, data, kind) {
    PL.ASSETS[path] = { data, kind };
    if (packWait[path]) { packWait[path].res(); delete packWait[path]; }
  };
  PL.assetsAvailable = () => !PL.fromDisk() || !!PL.PACKS;
  PL.packName = path => 'packs/' + path.replace(/[/\\]/g, '__') + '.js';
  function loadPack(path) {
    if (packWait[path]) return packWait[path].p;
    let res, rej; const p = new Promise((a, b) => { res = a; rej = b; });
    packWait[path] = { p, res };
    const sc = document.createElement('script');
    sc.src = PL.asset(PL.packName(path));
    sc.onerror = () => { delete packWait[path]; rej(new Error('missing ' + PL.packName(path))); };
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
  PL.loadAsset = async function (path, as) {
    if (!PL.fromDisk()) {
      const r = await fetch(PL.asset(path));
      if (!r.ok) throw new Error(path + ' (' + r.status + ')');
      return as === 'text' ? r.text() : as === 'json' ? r.json() : r.arrayBuffer();
    }
    if (!PL.ASSETS[path]) await loadPack(path);
    const a = PL.ASSETS[path];
    if (as === 'buffer') return b64ToBuf(a.data);
    return as === 'json' ? JSON.parse(a.data) : a.data;
  };
  PL.releaseAsset = path => { delete PL.ASSETS[path]; };

  /* ======================================================= INSTRUMENTS == */
  PL.TYPES = {
    grand: { name: 'Grand Piano', short: 'Grand', icon: '🎹', model: 'piano', lib: 'salamander',
      desc: 'Concert grand. Real recordings of a Yamaha C5, or a string model: 1 string per note in the low bass, 2 in the bass, 3 from the tenor up.' },
    epiano: { name: 'Electric Piano', short: 'E-Piano', icon: '🎛', model: 'ep',
      desc: 'Rhodes (tines) and Wurlitzer (reeds): real recordings or a tine + pickup model, with tremolo, phaser and amp.' },
    synth: { name: 'Synthesizer', short: 'Synth', icon: '🎚', model: 'synth',
      desc: 'Analog-style polysynth: 2 oscillators + sub + noise, unison, 4-pole ladder filter, two envelopes and an LFO.' },
    organ: { name: 'Organ', short: 'Organ', icon: '⛪', model: 'organ',
      desc: 'Tonewheel organ: 9 drawbars, percussion, key click, vibrato / chorus scanner and a rotary speaker.' }
  };
  PL.TYPE_IDS = Object.keys(PL.TYPES);
  /** recordings used by the electric piano models */
  PL.EP_MODELS = { 'Rhodes (tines)': { lib: 'rhodes', reed: 0 }, 'Wurlitzer (reeds)': { lib: 'wurlitzer', reed: 1 } };
  /** amp / speaker voicings of the electric piano chain: [type, freq, Q, gain] filters */
  PL.EP_AMPS = {
    'Direct (DI)': [],
    'Suitcase (stereo amp)': [['highpass', 60, 0.7, 0], ['peaking', 220, 0.8, 2], ['peaking', 2200, 1, 2.5], ['lowpass', 6500, 0.7, 0]],
    'Tube combo': [['highpass', 80, 0.7, 0], ['peaking', 500, 0.8, 2], ['peaking', 2800, 1.2, 3], ['lowpass', 5200, 0.8, 0]],
    'Small speaker (Wurlitzer)': [['highpass', 110, 0.8, 0], ['peaking', 900, 0.9, 3], ['lowpass', 4200, 0.9, 0]]
  };
  /** drawbar footages (tonewheel organ) and their pitch above the key, in semitones */
  PL.DRAWBARS = [["16'", -12], ["5⅓'", 7], ["8'", 0], ["4'", 12], ["2⅔'", 19], ["2'", 24], ["1⅗'", 28], ["1⅓'", 31], ["1'", 36]];

  /* ========================================================== SETTINGS == */
  PL.SECTIONS = [
    ['source', '🎙 Sound source (recordings / model)'], ['strings', '🧵 Strings & hammers (piano model)'], ['ep', '🧲 Tines & pickups (electric piano)'],
    ['epfx', '🔊 Electric piano amp, tremolo, phaser'], ['osc', '〰 Oscillators (synth)'], ['filter', '🎛 Filter (synth)'], ['env', '📈 Envelopes & LFO (synth)'],
    ['organ', '🎚 Drawbars & percussion (organ)'], ['rotary', '🌀 Vibrato & rotary speaker (organ)'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects & output'], ['play', '🎹 Playing']
  ];
  const ALL = PL.TYPE_IDS, G = ['grand'], E = ['epiano'], GE = ['grand', 'epiano'], SY = ['synth'], O = ['organ'], ES = ['epiano', 'synth'];
  const PARAMS = [];
  /** numeric setting */
  const S = (id, sec, label, min, max, step, unit, f, tip) => PARAMS.push({ id, sec, label, min, max, step, unit, for: f, tip });
  /** options setting */
  const C = (id, sec, label, options, f, tip) => PARAMS.push({ id, sec, label, options, for: f, tip });
  const WAVES = ['Saw', 'Square', 'Pulse', 'Triangle', 'Sine'];

  // ---- source
  C('engine', 'source', 'Sound source', ['Real samples', 'Layered (samples + model)', 'Physical model'], GE, 'Real samples = recordings of a real instrument. Physical model = computed strings / tines. Layered = both.');
  C('epModel', 'source', 'Electric piano', Object.keys(PL.EP_MODELS), E, 'Which electric piano: Rhodes (metal tines, bell-like) or Wurlitzer (steel reeds, more bite).');
  C('sampleLib', 'source', 'Recordings', ['Built-in', 'My library (folder)'], GE, 'Built-in recordings, or an SFZ library you loaded from a folder.');
  S('sampleLevel', 'source', 'Recordings level', -24, 12, 0.5, 'dB', GE, 'Level of the recordings.');
  S('layerMix', 'source', 'Model layer level', 0, 1, 0.01, '', GE, 'Layered mode: level of the model under the recordings.');
  S('dynRange', 'source', 'Dynamic range', 12, 60, 1, 'dB', GE, 'Loudness difference between the softest and the hardest key press.');
  S('velTone', 'source', 'Velocity → brightness', 0, 1, 0.01, '', GE, 'How much brighter harder notes get (on top of the recorded layers).');
  S('sampleTone', 'source', 'Recordings tone', -1, 1, 0.01, '', GE, 'Darker (−) or brighter (+) recordings.');
  S('sampleStart', 'source', 'Sample start', 0, 30, 0.5, 'ms', GE, 'Skips the very beginning of each recording (tighter, softer attack).');
  S('damperTime', 'source', 'Damper time', 0.3, 3, 0.01, '×', GE, 'How fast a note stops when the key is released.');
  S('releaseNoise', 'source', 'Key-release noise', 0, 1, 0.01, '', G, 'Sound of the damper falling back on the strings.');
  S('pedalNoise', 'source', 'Pedal noise', 0, 1, 0.01, '', G, 'Mechanical noise of the sustain pedal.');
  S('symRes', 'source', 'Sympathetic resonance', 0, 1, 0.01, '', G, 'With the sustain pedal down every string of the piano resonates with the notes you play.');
  S('resTime', 'source', 'Resonance length', 0.5, 6, 0.1, 's', G, 'How long the sympathetic resonance rings.');
  // ---- piano model
  S('hammerHard', 'strings', 'Hammer hardness', 0, 1, 0.01, '', G, 'Soft felt (dark, round) … hard felt (bright, percussive).');
  S('hammerNoise', 'strings', 'Hammer knock', 0, 1, 0.01, '', G, 'The "thunk" of the hammer and the soundboard at the start of each note.');
  S('strikePos', 'strings', 'Strike position', 0.05, 0.25, 0.005, '×length', G, 'Where the hammer hits the string (1/8 is typical).');
  S('inharm', 'strings', 'Inharmonicity', 0, 3, 0.01, '×', G, 'Stiffness of the strings: stretches the overtones (the piano "shimmer"). 1 = a real grand.');
  S('stretch', 'strings', 'Stretch tuning', 0, 1.5, 0.01, '×', G, 'Bass tuned slightly flat and treble slightly sharp, like a tuner does.');
  S('unisonDetune', 'strings', 'Unison detune', 0, 4, 0.05, 'cents', G, 'Tiny tuning differences between the 2 or 3 strings of a note: slow beating, long "after-sound".');
  S('unisonSpread', 'strings', 'Unison decay spread', 0, 0.6, 0.01, '', G, 'Each string of a note decays at a slightly different speed (double decay).');
  S('monoTop', 'strings', '1 string up to (key)', 21, 45, 1, 'midi', G, 'Highest key with a single string (wound bass strings).');
  S('biTop', 'strings', '2 strings up to (key)', 30, 60, 1, 'midi', G, 'Highest key with two strings. Keys above have three.');
  S('sustainLow', 'strings', 'Sustain (bass)', 2, 40, 0.5, 's', G, 'Decay time of the lowest notes.');
  S('sustainHigh', 'strings', 'Sustain (treble)', 0.2, 4, 0.05, 's', G, 'Decay time of the highest notes.');
  S('hfDamp', 'strings', 'Overtone damping', 0, 2, 0.01, '', G, 'How much faster the overtones die than the fundamental.');
  S('soundboard', 'strings', 'Soundboard', 0, 1, 0.01, '', G, 'Wood resonance of the soundboard added to the model.');
  S('modelStereo', 'strings', 'Keyboard stereo spread', 0, 1, 0.01, '', G, 'Bass to the left, treble to the right (player position).');
  // ---- electric piano model + chain
  S('epBell', 'ep', 'Bell (tine overtone)', 0, 1, 0.01, '', E, 'Level of the metallic "bell" at the start of each note.');
  S('epBark', 'ep', 'Bark (pickup drive)', 0, 1, 0.01, '', E, 'How close the tine is to the pickup: growl and harmonics on hard notes.');
  S('epSym', 'ep', 'Pickup alignment', -1, 1, 0.01, '', E, 'Tine centred on the pickup (hollow, 2nd harmonic) or offset (rounder).');
  S('epDecay', 'ep', 'Decay', 0.3, 3, 0.01, '×', E, 'Length of the notes.');
  S('epTone', 'ep', 'Tone (bass boost ↔ treble)', -1, 1, 0.01, '', E, 'The tone control of the piano preamp.');
  C('epAmp', 'epfx', 'Amp / speaker', Object.keys(PL.EP_AMPS), ES, 'Speaker voicing after the piano.');
  S('drive', 'epfx', 'Amp drive', 0, 1, 0.01, '', ES, 'Tube-style overdrive.');
  S('tremDepth', 'epfx', 'Tremolo depth', 0, 1, 0.01, '', ES, 'Volume wobble (the classic electric piano vibrato).');
  S('tremRate', 'epfx', 'Tremolo rate', 0.5, 12, 0.1, 'Hz', ES, '');
  S('tremStereo', 'epfx', 'Tremolo stereo (auto-pan)', 0, 1, 0.01, '', ES, '0 = both sides together, 1 = the sound moves left ↔ right (suitcase piano).');
  S('phaserMix', 'epfx', 'Phaser', 0, 1, 0.01, '', ES, 'Swirling phase effect (70s electric piano).');
  S('phaserRate', 'epfx', 'Phaser rate', 0.05, 4, 0.01, 'Hz', ES, '');
  // ---- synth
  C('osc1Wave', 'osc', 'Oscillator 1 wave', WAVES, SY, '');
  C('osc2Wave', 'osc', 'Oscillator 2 wave', WAVES, SY, '');
  S('osc2Semi', 'osc', 'Osc 2 pitch', -24, 24, 1, 'st', SY, 'Oscillator 2 transposition in semitones.');
  S('osc2Fine', 'osc', 'Osc 2 fine tune', -50, 50, 0.5, 'cents', SY, 'Small detune against oscillator 1 (fatness).');
  S('oscMix', 'osc', 'Osc 1 ↔ 2 mix', 0, 1, 0.01, '', SY, '');
  S('pulseWidth', 'osc', 'Pulse width', 0.05, 0.95, 0.01, '', SY, 'Width of the pulse wave.');
  S('subLevel', 'osc', 'Sub oscillator', 0, 1, 0.01, '', SY, 'Square wave one octave below.');
  S('noiseLevel', 'osc', 'Noise', 0, 1, 0.01, '', SY, '');
  S('unison', 'osc', 'Unison voices', 1, 7, 1, '', SY, 'Stacked detuned copies of every note (supersaw at 7).');
  S('unisonSynth', 'osc', 'Unison detune', 0, 60, 0.5, 'cents', SY, '');
  S('unisonWidth', 'osc', 'Unison stereo width', 0, 1, 0.01, '', SY, '');
  S('drift', 'osc', 'Analog drift', 0, 1, 0.01, '', SY, 'Slow random pitch movement of each voice (old analog oscillators).');
  S('glide', 'osc', 'Glide', 0, 1, 0.01, 's', SY, 'Slide from the previous note.');
  S('cutoff', 'filter', 'Cutoff', 40, 18000, 1, 'Hz', SY, 'Low-pass filter frequency.');
  S('reso', 'filter', 'Resonance', 0, 1, 0.01, '', SY, 'Emphasis at the cutoff (self-oscillates near 1).');
  S('envAmt', 'filter', 'Envelope amount', -1, 1, 0.01, '', SY, 'How far the filter envelope opens the filter.');
  S('keyTrack', 'filter', 'Key tracking', 0, 1, 0.01, '', SY, 'Higher notes open the filter more.');
  S('velFilter', 'filter', 'Velocity → filter', 0, 1, 0.01, '', SY, '');
  S('synthDrive', 'filter', 'Filter drive', 0, 1, 0.01, '', SY, 'Overdrives the filter input (thicker).');
  S('fA', 'env', 'Filter attack', 0.001, 4, 0.001, 's', SY, '');
  S('fD', 'env', 'Filter decay', 0.01, 6, 0.01, 's', SY, '');
  S('fS', 'env', 'Filter sustain', 0, 1, 0.01, '', SY, '');
  S('fR', 'env', 'Filter release', 0.01, 6, 0.01, 's', SY, '');
  S('aA', 'env', 'Amp attack', 0.001, 4, 0.001, 's', SY, '');
  S('aD', 'env', 'Amp decay', 0.01, 6, 0.01, 's', SY, '');
  S('aS', 'env', 'Amp sustain', 0, 1, 0.01, '', SY, '');
  S('aR', 'env', 'Amp release', 0.01, 6, 0.01, 's', SY, '');
  S('velAmp', 'env', 'Velocity → volume', 0, 1, 0.01, '', SY, '');
  S('lfoRate', 'env', 'LFO rate', 0.05, 20, 0.05, 'Hz', SY, '');
  S('lfoPitch', 'env', 'LFO → pitch (vibrato)', 0, 100, 0.5, 'cents', SY, '');
  S('lfoFilter', 'env', 'LFO → filter', 0, 1, 0.01, '', SY, '');
  S('lfoPwm', 'env', 'LFO → pulse width', 0, 0.45, 0.01, '', SY, '');
  // ---- organ
  PL.DRAWBARS.forEach((d, i) => S('db' + (i + 1), 'organ', 'Drawbar ' + d[0], 0, 8, 1, '', O, 'Level of the ' + d[0] + ' rank (0 = pushed in, 8 = fully out).'));
  C('perc', 'organ', 'Percussion', ['Off', '2nd harmonic', '3rd harmonic'], O, 'A short "ping" on the first note after all keys are up.');
  C('percDecay', 'organ', 'Percussion decay', ['Fast', 'Slow'], O, '');
  C('percVol', 'organ', 'Percussion volume', ['Normal', 'Soft'], O, '');
  S('keyClick', 'organ', 'Key click', 0, 1, 0.01, '', O, 'The contact click at the start of each note.');
  S('leakage', 'organ', 'Tonewheel leakage', 0, 1, 0.01, '', O, 'Faint bleed of the other tonewheels (the "dirt" of an old organ).');
  C('vibChorus', 'rotary', 'Vibrato / chorus', ['Off', 'V1', 'V2', 'V3', 'C1', 'C2', 'C3'], O, 'The scanner vibrato (V) or chorus (C) of the organ, three depths.');
  S('organDrive', 'rotary', 'Amp overdrive', 0, 1, 0.01, '', O, 'The tube amp of the rotary cabinet.');
  C('rotary', 'rotary', 'Rotary speaker', ['Slow (chorale)', 'Fast (tremolo)', 'Stop', 'Off (direct)'], O, 'Rotating horn + drum. The sustain pedal switches to Fast while it is held.');
  S('rotaryDepth', 'rotary', 'Rotary depth (mic distance)', 0, 1, 0.01, '', O, 'Close microphones = deep effect, far = subtle.');
  S('rotarySpread', 'rotary', 'Rotary stereo spread', 0, 1, 0.01, '', O, 'Angle between the two microphones.');
  S('rotaryBal', 'rotary', 'Horn ↔ drum balance', -1, 1, 0.01, '', O, 'More treble horn (+) or more bass drum (−).');
  // ---- eq
  S('eqLow', 'eq', 'Low (90 Hz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqLowMid', 'eq', 'Low-mid (300 Hz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqMid', 'eq', 'Mid (1 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqPres', 'eq', 'Presence (3.5 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqAir', 'eq', 'Air (10 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('tilt', 'eq', 'Warm ↔ bright', -1, 1, 0.01, '', ALL, 'One knob for the overall colour.');
  S('lowCut', 'eq', 'Low cut', 15, 300, 1, 'Hz', ALL, '');
  S('highCut', 'eq', 'High cut', 2000, 20000, 50, 'Hz', ALL, '');
  // ---- fx
  S('comp', 'fx', 'Compressor', 0, 1, 0.01, '', ALL, '');
  S('chorusMix', 'fx', 'Chorus', 0, 1, 0.01, '', ALL, '');
  S('chorusRate', 'fx', 'Chorus rate', 0.05, 5, 0.01, 'Hz', ALL, '');
  S('chorusDepth', 'fx', 'Chorus depth', 0, 1, 0.01, '', ALL, '');
  S('delayMix', 'fx', 'Delay', 0, 1, 0.01, '', ALL, '');
  S('delayTime', 'fx', 'Delay time', 40, 1200, 1, 'ms', ALL, '');
  S('delayFeedback', 'fx', 'Delay repeats', 0, 0.9, 0.01, '', ALL, '');
  C('reverbType', 'fx', 'Reverb', ['Room', 'Studio', 'Hall', 'Plate'], ALL, '');
  S('reverbMix', 'fx', 'Reverb amount', 0, 1, 0.01, '', ALL, '');
  S('reverbSize', 'fx', 'Reverb time', 0.3, 6, 0.05, 's', ALL, '');
  S('predelay', 'fx', 'Reverb pre-delay', 0, 120, 1, 'ms', ALL, '');
  S('width', 'fx', 'Stereo width', 0, 1.6, 0.01, '', ALL, '0 = mono, 1 = as recorded, more = wider.');
  S('output', 'fx', 'Output level', -24, 12, 0.5, 'dB', ALL, '');
  // ---- play
  C('autoPedal', 'play', 'Auto sustain pedal (ScoreDAW)', ['Off', 'Each bar', 'Each half bar', 'Each beat', 'Always down'], ['grand', 'epiano', 'synth'],
    'ScoreDAW only: presses the sustain pedal for you, lifting and pressing it again at every bar / half bar / beat (the way a pianist changes the pedal with the harmony).');
  S('a4', 'play', 'A4 reference', 430, 450, 0.1, 'Hz', ALL, 'Tuning of the instrument.');
  S('touch', 'play', 'Touch (velocity curve)', 0.4, 2.5, 0.01, '', ALL, '< 1 = light keyboard (loud easily), > 1 = heavy keyboard.');
  S('humanTime', 'play', 'Human timing', 0, 30, 0.5, 'ms', ALL, 'Small timing differences between notes (demos and ScoreDAW).');
  S('humanVel', 'play', 'Human dynamics', 0, 1, 0.01, '', ALL, 'Small loudness differences between notes.');
  PL.PARAMS = PARAMS;
  PL.paramFor = (p, type) => !p.for || p.for.includes(type);

  /* =========================================================== FACTORY == */
  // BASE = neutral value of every setting; FACTORY[type] = the sound of each instrument.
  const BASE = {
    engine: 'Real samples', epModel: 'Rhodes (tines)', sampleLib: 'Built-in', sampleLevel: 0, layerMix: 0.35, dynRange: 38, velTone: 0.5, sampleTone: 0, sampleStart: 0,
    damperTime: 1, releaseNoise: 0.45, pedalNoise: 0.35, symRes: 0.4, resTime: 3,
    hammerHard: 0.55, hammerNoise: 0.35, strikePos: 0.125, inharm: 1, stretch: 1, unisonDetune: 0.6, unisonSpread: 0.25, monoTop: 31, biTop: 45,
    sustainLow: 10, sustainHigh: 1.3, hfDamp: 0.7, soundboard: 0.5, modelStereo: 0.55,
    epBell: 0.5, epBark: 0.5, epSym: 0.25, epDecay: 1, epTone: 0, epAmp: 'Direct (DI)', drive: 0, tremDepth: 0, tremRate: 5.5, tremStereo: 1, phaserMix: 0, phaserRate: 0.4,
    osc1Wave: 'Saw', osc2Wave: 'Saw', osc2Semi: 0, osc2Fine: 8, oscMix: 0.5, pulseWidth: 0.5, subLevel: 0, noiseLevel: 0, unison: 1, unisonSynth: 14, unisonWidth: 0.7, drift: 0.3, glide: 0,
    cutoff: 2400, reso: 0.2, envAmt: 0.45, keyTrack: 0.5, velFilter: 0.4, synthDrive: 0.2,
    fA: 0.005, fD: 0.6, fS: 0.35, fR: 0.5, aA: 0.005, aD: 0.4, aS: 0.8, aR: 0.35, velAmp: 0.6, lfoRate: 5, lfoPitch: 0, lfoFilter: 0, lfoPwm: 0,
    db1: 8, db2: 8, db3: 8, db4: 0, db5: 0, db6: 0, db7: 0, db8: 0, db9: 0, perc: 'Off', percDecay: 'Fast', percVol: 'Normal', keyClick: 0.5, leakage: 0.3,
    vibChorus: 'Off', organDrive: 0.2, rotary: 'Off (direct)', rotaryDepth: 0.7, rotarySpread: 0.7, rotaryBal: 0,
    eqLow: 0, eqLowMid: 0, eqMid: 0, eqPres: 0, eqAir: 0, tilt: 0, lowCut: 20, highCut: 20000,
    comp: 0, chorusMix: 0, chorusRate: 0.6, chorusDepth: 0.4, delayMix: 0, delayTime: 380, delayFeedback: 0.3, reverbType: 'Hall', reverbMix: 0.15, reverbSize: 2, predelay: 15, width: 1, output: 0,
    autoPedal: 'Off', a4: 440, touch: 1, humanTime: 6, humanVel: 0.25
  };
  const FACTORY = {
    grand: { reverbType: 'Hall', reverbMix: 0.16, reverbSize: 2.2 },
    // no drive by default: the amp distortion made chords muddy (intermodulation)
    epiano: { epModel: 'Rhodes (tines)', dynRange: 30, velTone: 0.25, epAmp: 'Suitcase (stereo amp)', tremDepth: 0.25, tremRate: 5.2, tremStereo: 1, drive: 0, reverbType: 'Plate', reverbMix: 0.1, reverbSize: 1.3, chorusMix: 0 },
    synth: { engine: 'Physical model', unison: 3, cutoff: 1800, reso: 0.25, envAmt: 0.5, chorusMix: 0.3, reverbType: 'Hall', reverbMix: 0.2, reverbSize: 2.4, drive: 0, tremDepth: 0 },
    organ: { engine: 'Physical model', db1: 8, db2: 8, db3: 8, db4: 6, db5: 0, db6: 0, db7: 0, db8: 0, db9: 4, perc: '3rd harmonic', vibChorus: 'C3', rotary: 'Slow (chorale)', organDrive: 0.3,
      reverbType: 'Room', reverbMix: 0.14, reverbSize: 1.2, humanTime: 4 }
  };
  PL.factory = type => Object.assign({}, BASE, FACTORY[type] || {});
  /** Earlier factory sounds: a stored value still equal to the old factory value moves to the
   *  new one when the lab opens (your own changes are kept). PL.OLD_FACTORY[version][type] */
  PL.OLD_FACTORY = {
    1: { epiano: { velTone: 0.5, tremDepth: 0.35, drive: 0.12, reverbMix: 0.12, reverbSize: 1.4, chorusMix: 0.1 } }
  };
  /** Fill missing / invalid keys of a stored settings object */
  PL.sanitize = function (type, s) {
    const f = PL.factory(type), out = {};
    PL.PARAMS.forEach(p => {
      let v = s && s[p.id] !== undefined ? s[p.id] : f[p.id];
      if (p.options) { if (!p.options.includes(v)) v = f[p.id]; }
      else { v = +v; if (!isFinite(v)) v = f[p.id]; v = Math.min(p.max, Math.max(p.min, v)); }
      out[p.id] = v;
    });
    return out;
  };

  /* ================================================== BUILT-IN SOUNDS == */
  // Starting points per instrument (only the differences from the factory sound).
  PL.SOUNDS = {
    grand: {
      'Concert grand (factory)': {},
      'Intimate (close, dry)': { reverbMix: 0.06, reverbType: 'Studio', width: 0.8, tilt: -0.1 },
      'Bright pop piano': { tilt: 0.35, comp: 0.45, eqPres: 2, reverbType: 'Plate', reverbMix: 0.12 },
      'Soft felt': { tilt: -0.5, sampleStart: 6, dynRange: 28, releaseNoise: 0.8, reverbMix: 0.2 },
      'Concert hall': { reverbType: 'Hall', reverbMix: 0.3, reverbSize: 3.2, predelay: 30 },
      'String model (no recordings)': { engine: 'Physical model' }
    },
    epiano: {
      'Suitcase Rhodes (factory)': {},
      'Rhodes dry (DI)': { epAmp: 'Direct (DI)', tremDepth: 0, drive: 0, chorusMix: 0, reverbMix: 0.05 },
      'Rhodes + phaser (70s)': { phaserMix: 0.6, phaserRate: 0.35, tremDepth: 0 },
      'Rhodes ballad (chorus)': { chorusMix: 0.5, tremDepth: 0.15, reverbMix: 0.22, reverbSize: 2.2 },
      'Wurlitzer': { epModel: 'Wurlitzer (reeds)', epAmp: 'Small speaker (Wurlitzer)', tremDepth: 0.4, tremStereo: 0, tremRate: 5.8, drive: 0.2, chorusMix: 0 },
      'Wurlitzer overdriven': { epModel: 'Wurlitzer (reeds)', epAmp: 'Tube combo', drive: 0.65, tremDepth: 0.2, tremStereo: 0, chorusMix: 0 },
      'Tine model (no recordings)': { engine: 'Physical model' }
    },
    synth: {
      'Warm poly (factory)': {},
      'Analog pad': { unison: 5, unisonSynth: 22, cutoff: 900, envAmt: 0.25, fA: 1.2, fD: 2, fS: 0.6, aA: 0.8, aR: 1.8, aS: 0.9, chorusMix: 0.5, reverbMix: 0.35, reverbSize: 3.5 },
      'Supersaw lead': { unison: 7, unisonSynth: 28, cutoff: 5200, envAmt: 0.2, reso: 0.15, aA: 0.003, aR: 0.25, delayMix: 0.22, lfoPitch: 6, lfoRate: 5.5 },
      'Brass': { osc2Fine: 5, unison: 2, cutoff: 700, envAmt: 0.75, fA: 0.07, fD: 0.5, fS: 0.55, aA: 0.03, reso: 0.1, velFilter: 0.7, chorusMix: 0.15 },
      'Pluck': { cutoff: 500, envAmt: 0.85, fD: 0.22, fS: 0, aD: 0.5, aS: 0, aR: 0.4, reso: 0.3, delayMix: 0.25, unison: 2 },
      'Synth bass': { osc1Wave: 'Saw', osc2Wave: 'Square', osc2Semi: -12, unison: 1, subLevel: 0.6, cutoff: 380, envAmt: 0.6, fD: 0.25, fS: 0.15, reso: 0.35, aS: 0.9, aR: 0.12, chorusMix: 0, reverbMix: 0.04, synthDrive: 0.6 },
      'PWM strings': { osc1Wave: 'Pulse', osc2Wave: 'Pulse', lfoPwm: 0.3, lfoRate: 0.8, unison: 3, cutoff: 3200, envAmt: 0.1, aA: 0.35, aR: 0.9, chorusMix: 0.45, reverbMix: 0.3 },
      'Square lead (glide)': { osc1Wave: 'Square', osc2Wave: 'Square', osc2Fine: 4, unison: 1, glide: 0.08, cutoff: 2600, lfoPitch: 10, lfoRate: 5.8, delayMix: 0.25, reso: 0.3 },
      'Soft keys': { osc1Wave: 'Triangle', osc2Wave: 'Sine', osc2Semi: 12, oscMix: 0.35, unison: 1, cutoff: 3000, envAmt: 0.3, fD: 1.2, aD: 1.8, aS: 0.3, aR: 0.6, chorusMix: 0.35 }
    },
    organ: {
      'Jazz (888 + percussion)': { db1: 8, db2: 8, db3: 8, db4: 0, db5: 0, db6: 0, db7: 0, db8: 0, db9: 0, perc: '3rd harmonic', vibChorus: 'C3' },
      'Gospel / rock (factory)': {},
      'Full organ': { db1: 8, db2: 8, db3: 8, db4: 8, db5: 8, db6: 8, db7: 8, db8: 8, db9: 8, perc: 'Off', rotary: 'Fast (tremolo)', organDrive: 0.45 },
      'Soft ballad': { db1: 0, db2: 0, db3: 8, db4: 4, db5: 0, db6: 0, db7: 0, db8: 0, db9: 0, perc: 'Off', vibChorus: 'C1', organDrive: 0.05, reverbMix: 0.25 },
      'Reggae bubble': { db1: 0, db2: 0, db3: 8, db4: 8, db5: 0, db6: 0, db7: 0, db8: 0, db9: 0, perc: '2nd harmonic', percDecay: 'Fast', vibChorus: 'Off', rotary: 'Stop' },
      'Rock (overdriven, fast rotary)': { db1: 8, db2: 8, db3: 8, db4: 8, db5: 0, db6: 0, db7: 0, db8: 0, db9: 0, organDrive: 0.8, rotary: 'Fast (tremolo)', perc: 'Off', keyClick: 0.8 },
      'Church-like (no rotary)': { db1: 8, db2: 4, db3: 8, db4: 6, db5: 4, db6: 6, db7: 0, db8: 4, db9: 5, perc: 'Off', vibChorus: 'Off', rotary: 'Off (direct)', organDrive: 0, keyClick: 0.1, reverbType: 'Hall', reverbMix: 0.4, reverbSize: 4 }
    }
  };

  /* ============================================================= DEMOS == */
  // build() → items: { b: beat, m: midi, d: beats, v: 0..1 } notes and { b, ped: 0|1 } sustain pedal.
  const N = (b, m, d, v) => ({ b, m, d, v: v === undefined ? 0.7 : v });
  const chord = (b, ms, d, v, roll) => ms.map((m, i) => N(b + i * (roll || 0), m, d, v));
  function prelude() {
    // J. S. Bach, Prelude in C major BWV 846 (1722, public domain) — first 8 bars
    const bars = [[60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76], [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72]];
    const out = [];
    bars.forEach((n, bi) => {
      for (let h = 0; h < 2; h++) {
        const b0 = bi * 4 + h * 2;
        out.push({ b: b0, ped: 1 });
        [0, 1, 2, 3, 4, 2, 3, 4].forEach((k, i) => out.push(N(b0 + i * 0.25, n[k], i < 2 ? 2 - i * 0.25 : 0.3, 0.42 + 0.1 * Math.sin(bi * 0.8) + (i === 0 ? 0.08 : 0))));
        out.push({ b: b0 + 1.92, ped: 0 });
      }
    });
    out.push(...chord(32, [48, 60, 64, 67, 72], 4, 0.5, 0.03));
    return out;
  }
  function ballad() {
    const prog = [[[36, 48], [60, 64, 67, 71]], [[33, 45], [60, 64, 67, 69]], [[41, 53], [60, 65, 69, 72]], [[43, 55], [59, 62, 67, 71]]];
    const out = [];
    prog.forEach(([lh, rh], i) => {
      const b = i * 4;
      out.push({ b, ped: 1 }, ...chord(b, lh, 3.8, 0.6), ...chord(b, rh, 1.9, 0.55, 0.02), ...chord(b + 2, rh, 0.9, 0.42), N(b + 3, rh[2] + 12, 0.5, 0.62), N(b + 3.5, rh[1] + 12, 0.5, 0.5), { b: b + 3.9, ped: 0 });
    });
    out.push({ b: 16, ped: 1 }, ...chord(16, [36, 48, 55, 60, 64, 67, 72], 6, 0.6, 0.04), { b: 22, ped: 0 });
    return out;
  }
  function range() {
    const out = [];
    [21, 24, 28, 33, 36, 40, 45, 48, 52, 57, 60, 64, 69, 72, 76, 81, 84, 88, 93, 96, 100, 105, 108].forEach((m, i) => out.push(N(i * 1, m, 0.95, 0.7)));
    return out;
  }
  function dynamics() {
    const out = [];
    [0.08, 0.2, 0.32, 0.45, 0.58, 0.7, 0.82, 0.92, 1].forEach((v, i) => { out.push(...chord(i * 2, [48, 60, 64, 67], 1.8, v)); });
    [0.15, 0.4, 0.65, 0.9].forEach((v, i) => out.push(N(18 + i, 36, 0.9, v), N(22 + i, 84, 0.9, v)));
    return out;
  }
  function groove() {
    const out = [], ch = [[[41], [57, 60, 64, 67]], [[40], [55, 59, 62, 67]], [[38], [57, 60, 65, 69]], [[43], [55, 59, 62, 65]]];
    ch.forEach(([lh, rh], i) => {
      const b = i * 4;
      out.push(N(b, lh[0], 0.9, 0.7), N(b + 1.5, lh[0], 0.4, 0.55), N(b + 2.5, lh[0] + 12, 0.4, 0.6), N(b + 3, lh[0] + 7, 0.8, 0.6));
      [[0, 1.3, 0.62], [1.5, 0.4, 0.45], [2, 0.45, 0.7], [2.75, 0.2, 0.4], [3.5, 0.45, 0.6]].forEach(([o, d, v]) => out.push(...chord(b + o, rh, d, v, 0.008)));
    });
    out.push(...chord(16, [41, 57, 60, 64, 67, 72], 4, 0.6, 0.03));
    return out;
  }
  function lead() {
    const out = [], mel = [[0, 72, 1], [1, 75, 0.5], [1.5, 77, 0.5], [2, 79, 1.5], [3.5, 77, 0.5], [4, 75, 1], [5, 72, 0.5], [5.5, 70, 0.5], [6, 72, 2], [8, 79, 1], [9, 82, 0.5], [9.5, 84, 1.5], [11, 82, 0.5], [11.5, 79, 0.5], [12, 77, 1], [13, 75, 1], [14, 72, 2]];
    mel.forEach(([b, m, d]) => out.push(N(b, m, d * 0.95, 0.75)));
    [[0, [48, 55, 60, 63]], [4, [44, 51, 56, 60]], [8, [46, 53, 58, 62]], [12, [43, 50, 55, 58]]].forEach(([b, c]) => out.push(...chord(b, c, 3.9, 0.5)));
    return out;
  }
  function gospel() {
    const out = [];
    [[0, [48, 60, 64, 67, 72], 3.5], [4, [53, 60, 65, 69, 72], 3.5], [8, [55, 59, 62, 67, 71], 2], [10, [55, 59, 62, 65, 71], 1.7], [12, [48, 60, 64, 67, 72, 76], 6]].forEach(([b, c, d]) => out.push(...chord(b, c, d, 0.8)));
    [[2, 76], [2.5, 79], [3, 76], [6, 77], [6.5, 81], [7, 77], [7.5, 76]].forEach(([b, m]) => out.push(N(b, m, 0.45, 0.8)));
    out.push({ b: 13, ped: 1 }, { b: 17, ped: 0 });           // organ: the pedal switches the rotary speaker to fast
    return out;
  }
  PL.DEMOS = [
    { id: 'prelude', name: 'Classical arpeggios with pedal (Bach, Prelude in C)', bpm: 72, build: prelude },
    { id: 'ballad', name: 'Ballad: chords, bass and pedal', bpm: 66, build: ballad },
    { id: 'dynamics', name: 'Dynamics test: pp → ff (same chord)', bpm: 80, build: dynamics },
    { id: 'range', name: 'Range test: A0 → C8', bpm: 100, build: range },
    { id: 'groove', name: 'Electric piano groove', bpm: 92, build: groove },
    { id: 'lead', name: 'Lead melody over pad chords', bpm: 104, build: lead },
    { id: 'gospel', name: 'Organ chords + fills (pedal = fast rotary)', bpm: 76, build: gospel }
  ];
  PL.DEMO_ORDER = {
    grand: ['prelude', 'ballad', 'dynamics', 'range', 'groove', 'lead', 'gospel'], epiano: ['groove', 'ballad', 'dynamics', 'range', 'prelude', 'lead', 'gospel'],
    synth: ['lead', 'groove', 'ballad', 'range', 'dynamics', 'prelude', 'gospel'], organ: ['gospel', 'groove', 'lead', 'range', 'ballad', 'dynamics', 'prelude']
  };
  /** demo items → engine events (seconds from t0), with the human feel of the settings */
  PL.demoEvents = function (demo, s, t0) {
    const spb = 60 / demo.bpm, ev = [];
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    let id = 0, end = 0;
    demo.build().forEach(it => {
      const tb = t0 + it.b * spb;
      if (it.ped !== undefined) { ev.push({ type: 'pedal', t: tb, v: it.ped }); return; }
      const t = Math.max(t0, tb + g() * s.humanTime / 1000);
      const vel = Math.min(1, Math.max(0.03, it.v * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.25)));
      const nid = 'd' + (++id);
      ev.push({ type: 'on', t, midi: it.m, vel, id: nid }, { type: 'off', t: t + it.d * spb, id: nid });
      end = Math.max(end, t + it.d * spb);
    });
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, end };
  };
})();
