/* =====================================================================
 *  WIND LAB — presets.js : DATA (instruments, settings, demos)
 *  ---------------------------------------------------------------------
 *  Stand-alone test bench for ScoreDAW's realistic wind instruments:
 *    tenorsax  Tenor Saxophone   real recordings (VCSL, CC0): sustain,
 *                                 vibrato and staccato, 2 dynamics
 *    trumpet   Trumpet in Bb      real recordings (VSCO-2 CE, CC0): sustain,
 *                                 vibrato, staccato (3 dynamics), harmon and
 *                                 straight mutes
 *  What makes a wind instrument sound real is HOW the notes connect, so the
 *  player (sampler.js) adds what a musician does: real legato (one note at a
 *  time, the next note slurred out of the previous one), delayed vibrato,
 *  breathing dynamics on long notes, breath / tongue / key noises, growl,
 *  scoops and fall-offs, small intonation and timing differences, and a
 *  section of up to 3 players. Everything a setting needs is declared here
 *  (WL.PARAMS): the interface, the storage and the engine read this list.
 * ===================================================================== */
(function () {
  'use strict';
  const WL = window.WL = window.WL || {};

  /* ============================================================ CONFIG == */
  WL.CONFIG = {
    version: 1,                              // settings version (migrations of the factory sounds)
    storageKey: 'scoredaw.windlab.v1',       // localStorage key of the lab state
    exportSampleRate: 48000,                 // WAV export
    decodeRate: 32000,                       // recordings are decoded at this rate
    maxVoices: 24                            // polyphony (poly mode and the section players)
  };

  /* ============================================================ ASSETS == *
   * Recordings (samples/) are loaded with fetch() when the page is served
   * over http(s). A page opened straight from disk (file://) cannot fetch()
   * but CAN run <script> files, so every asset also exists as a script
   * "pack" (packs/*.js, made by build_packs.py) that calls WL.addAsset().
   *   WL.BASE  folder of the lab relative to the page ('' for the lab itself) */
  WL.asset = path => (WL.BASE || '') + path;
  WL.fromDisk = () => location.protocol === 'file:';
  WL.ASSETS = WL.ASSETS || {};
  const packWait = {};
  WL.addAsset = function (path, data, kind) {
    WL.ASSETS[path] = { data, kind };
    if (packWait[path]) { packWait[path].res(); delete packWait[path]; }
  };
  WL.assetsAvailable = () => !WL.fromDisk() || !!WL.PACKS;
  WL.packName = path => 'packs/' + path.replace(/[/\\]/g, '__') + '.js';
  function loadPack(path) {
    if (packWait[path]) return packWait[path].p;
    let res, rej; const p = new Promise((a, b) => { res = a; rej = b; });
    packWait[path] = { p, res };
    const sc = document.createElement('script');
    sc.src = WL.asset(WL.packName(path));
    sc.onerror = () => { delete packWait[path]; rej(new Error('missing ' + WL.packName(path))); };
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
  WL.loadAsset = async function (path, as) {
    if (!WL.fromDisk()) {
      const r = await fetch(WL.asset(path));
      if (!r.ok) throw new Error(path + ' (' + r.status + ')');
      return as === 'text' ? r.text() : as === 'json' ? r.json() : r.arrayBuffer();
    }
    if (!WL.ASSETS[path]) await loadPack(path);
    const a = WL.ASSETS[path];
    if (as === 'buffer') return b64ToBuf(a.data);
    return as === 'json' ? JSON.parse(a.data) : a.data;
  };
  WL.releaseAsset = path => { delete WL.ASSETS[path]; };

  /* ======================================================= INSTRUMENTS == */
  // range = playable sounding range (midi); center = where the demos are played
  WL.TYPES = {
    tenorsax: { name: 'Tenor Saxophone', short: 'Tenor Sax', icon: '🎷', lib: 'tenorsax', range: [44, 88], center: 62, family: 'reed',
      desc: 'Real tenor sax recordings (sustain, vibrato, staccato) played like a saxophonist: slurred legato, delayed vibrato, breath, key noise and growl.' },
    trumpet: { name: 'Trumpet', short: 'Trumpet', icon: '🎺', lib: 'trumpet', range: [52, 86], center: 70, family: 'brass',
      desc: 'Real Bb trumpet recordings (sustain, vibrato, staccato, harmon and straight mutes) with lip slurs, scoops, falls and a brass section.' }
  };
  WL.TYPE_IDS = Object.keys(WL.TYPES);

  /* ========================================================== SETTINGS == */
  WL.SECTIONS = [
    ['source', '🎙 Recordings & dynamics'], ['art', '🎼 Articulation & legato'], ['vib', '〰 Vibrato'], ['expr', '📈 Expression (scoops, falls, swells)'],
    ['breath', '💨 Breath, tongue, keys & growl'], ['section', '👥 Section (players)'], ['mic', '🎙 Microphone & room'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects & output'], ['play', '🎹 Playing (human feel)']
  ];
  const ALL = WL.TYPE_IDS, SX = ['tenorsax'], TR = ['trumpet'];
  const PARAMS = [];
  const S = (id, sec, label, min, max, step, unit, f, tip) => PARAMS.push({ id, sec, label, min, max, step, unit, for: f, tip });
  const C = (id, sec, label, options, f, tip) => PARAMS.push({ id, sec, label, options, for: f, tip });

  // ---- recordings
  C('engine', 'source', 'Sound source', ['Real samples', 'Synth model'], ALL, 'Real samples = recordings of a real player. Synth model = a computed horn (used when the recordings cannot load).');
  C('mute', 'source', 'Mute', ['Open', 'Harmon mute', 'Straight mute'], TR, 'Open bell, harmon mute (Miles Davis) or straight mute.');
  S('sampleLevel', 'source', 'Recordings level', -24, 12, 0.5, 'dB', ALL, '');
  S('dynRange', 'source', 'Dynamic range', 10, 48, 1, 'dB', ALL, 'Loudness difference between the softest and the hardest notes.');
  S('layerBlend', 'source', 'Dynamics crossfade', 0, 1, 0.01, '', ALL, 'Blends the soft and loud recordings in between (smooth timbre change instead of a jump).');
  S('velTone', 'source', 'Velocity → brightness', 0, 1, 0.01, '', ALL, 'Harder notes get brighter (on top of the recorded dynamics).');
  S('attackSoft', 'source', 'Softer attack', 0, 40, 0.5, 'ms', ALL, 'Fades in the start of every note (breathy, less tongued).');
  // ---- articulation
  C('mono', 'art', 'Playing mode', ['Mono legato (real player)', 'Poly (chords)'], ALL, 'A real horn plays one note at a time: overlapping notes are slurred. Poly lets chords sound (like a section).');
  S('legatoTime', 'art', 'Slur speed', 15, 200, 1, 'ms', ALL, 'How long the transition between two slurred notes takes.');
  S('legatoGap', 'art', 'Slur when notes touch within', 0, 80, 1, 'ms', ALL, 'A note starting this close after the previous one ended is still slurred.');
  C('songSlur', 'art', 'Slurs in a ScoreDAW song', ['Overlapping or marked notes', 'Every connected note'], ALL, 'In a song: "Overlapping or marked" = notes that overlap, or are marked hammer-on / pull-off / legato slide, are slurred; notes that only touch are tongued (like a written part). "Every connected note" = one long slurred line. (The lab keyboard always slurs when you hold a key.)');
  S('legatoGlide', 'art', 'Slur pitch glide', 0, 1, 0.01, '', ALL, 'How much the pitch slides between slurred notes (lip / finger portamento).');
  S('stacBelow', 'art', 'Staccato for notes shorter than', 0, 0.5, 0.01, 's', ALL, 'Short notes use the staccato recordings (0 = only notes marked staccato).');
  S('releaseTime', 'art', 'Release', 0.02, 0.6, 0.01, 's', ALL, 'How fast a note stops (the player stops blowing).');
  S('releaseFall', 'art', 'Release pitch drop', 0, 60, 1, 'cents', ALL, 'The pitch sags a little as the air stops (natural on long notes).');
  // ---- vibrato
  C('vibType', 'vib', 'Vibrato', ['Recorded (real)', 'Synthetic', 'Off'], ALL, 'Recorded = crossfade into the recordings played with vibrato. Synthetic = a pitch / loudness wobble added to the straight notes.');
  S('vibDelay', 'vib', 'Vibrato delay', 0, 1.5, 0.01, 's', ALL, 'Players start a long note straight and add vibrato after a moment.');
  S('vibFade', 'vib', 'Vibrato fade-in', 0.05, 1.5, 0.01, 's', ALL, '');
  S('vibMinLen', 'vib', 'Vibrato on notes longer than', 0, 2, 0.01, 's', ALL, 'Short notes stay straight.');
  S('vibDepth', 'vib', 'Synthetic vibrato depth', 0, 60, 0.5, 'cents', ALL, '');
  S('vibRate', 'vib', 'Synthetic vibrato rate', 3, 8, 0.05, 'Hz', ALL, '');
  S('vibAmp', 'vib', 'Synthetic vibrato loudness', 0, 1, 0.01, '', ALL, 'A real vibrato also moves the loudness and brightness a little.');
  // ---- expression
  S('swell', 'expr', 'Breathing swell', 0, 12, 0.1, 'dB', ALL, 'Long notes grow and relax a little (messa di voce) instead of staying flat.');
  S('swellMin', 'expr', 'Swell on notes longer than', 0.3, 4, 0.05, 's', ALL, '');
  S('accent', 'expr', 'Accent strength', 0, 12, 0.1, 'dB', ALL, 'Marked accents: louder and brighter attack.');
  S('scoop', 'expr', 'Scoop (bend into the note)', 0, 200, 1, 'cents', ALL, 'Depth of the scoop from below: marked "slide in from below", and the auto scoops.');
  S('scoopAuto', 'expr', 'Auto scoops', 0, 1, 0.01, '', ALL, 'Chance of a small scoop on accented / long notes after a rest (jazz phrasing).');
  S('fall', 'expr', 'Fall-off length', 1, 12, 0.5, 'st', ALL, 'Marked "slide out down": how far the pitch falls at the end of the note.');
  S('fallTime', 'expr', 'Fall-off time', 0.1, 1, 0.01, 's', ALL, '');
  S('doit', 'expr', 'Doit (rise) length', 1, 12, 0.5, 'st', ALL, 'Marked "slide out up".');
  // ---- breath / noises
  S('breath', 'breath', 'Breath noise', 0, 1, 0.01, '', ALL, 'Air in the sound (more on soft and low notes).');
  S('tongue', 'breath', 'Tongue / air attack', 0, 1, 0.01, '', ALL, 'The little puff at the start of tongued notes.');
  S('keyNoise', 'breath', 'Key / valve noise', 0, 1, 0.01, '', ALL, 'Saxophone pad clicks and trumpet valve noise between notes.');
  S('growl', 'breath', 'Growl', 0, 1, 0.01, '', SX, 'Humming while playing: rough, aggressive tone (rock, R&B, gospel). More on loud notes.');
  S('growlRate', 'breath', 'Growl rate', 20, 80, 1, 'Hz', SX, '');
  S('growlAccents', 'breath', 'Growl only on loud notes', 0, 1, 0.01, '', SX, 'How much the growl depends on the velocity.');
  S('flutter', 'breath', 'Brass edge (blare)', 0, 1, 0.01, '', TR, 'Brassy edge on loud notes (the bell "blares").');
  // ---- section
  S('players', 'section', 'Players', 1, 3, 1, '', ALL, '1 = solo; 2–3 = a section playing the same line (unison).');
  S('secTime', 'section', 'Section timing spread', 0, 40, 0.5, 'ms', ALL, '');
  S('secTune', 'section', 'Section tuning spread', 0, 20, 0.5, 'cents', ALL, '');
  S('secWidth', 'section', 'Section stereo width', 0, 1, 0.01, '', ALL, '');
  // ---- mic
  S('micDist', 'mic', 'Microphone distance', 0, 1, 0.01, '', ALL, 'Close (breath, bass, detail) … far (air, room).');
  S('bell', 'mic', 'Bell brightness (on / off axis)', -1, 1, 0.01, '', ALL, 'Microphone in front of the bell (bright) or to the side (darker, rounder).');
  S('room', 'mic', 'Room ambience', 0, 1, 0.01, '', ALL, 'Early reflections of the room around the player.');
  S('pan', 'mic', 'Position', -1, 1, 0.01, '', ALL, 'Left … right.');
  // ---- eq
  S('eqLow', 'eq', 'Low (120 Hz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqLowMid', 'eq', 'Low-mid (400 Hz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqMid', 'eq', 'Mid (1.2 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqPres', 'eq', 'Presence (3 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('eqAir', 'eq', 'Air (9 kHz)', -12, 12, 0.5, 'dB', ALL, '');
  S('tilt', 'eq', 'Warm ↔ bright', -1, 1, 0.01, '', ALL, '');
  S('lowCut', 'eq', 'Low cut', 20, 400, 1, 'Hz', ALL, '');
  S('highCut', 'eq', 'High cut', 2000, 20000, 50, 'Hz', ALL, '');
  // ---- fx
  S('comp', 'fx', 'Compressor', 0, 1, 0.01, '', ALL, '');
  S('drive', 'fx', 'Tube warmth', 0, 1, 0.01, '', ALL, '');
  S('delayMix', 'fx', 'Delay', 0, 1, 0.01, '', ALL, '');
  S('delayTime', 'fx', 'Delay time', 40, 1200, 1, 'ms', ALL, '');
  S('delayFeedback', 'fx', 'Delay repeats', 0, 0.9, 0.01, '', ALL, '');
  C('reverbType', 'fx', 'Reverb', ['Room', 'Studio', 'Club', 'Hall', 'Plate'], ALL, '');
  S('reverbMix', 'fx', 'Reverb amount', 0, 1, 0.01, '', ALL, '');
  S('reverbSize', 'fx', 'Reverb time', 0.3, 6, 0.05, 's', ALL, '');
  S('predelay', 'fx', 'Reverb pre-delay', 0, 120, 1, 'ms', ALL, '');
  S('width', 'fx', 'Stereo width', 0, 1.6, 0.01, '', ALL, '');
  S('output', 'fx', 'Output level', -24, 12, 0.5, 'dB', ALL, '');
  // ---- play
  S('a4', 'play', 'A4 reference', 430, 450, 0.1, 'Hz', ALL, '');
  S('transpose', 'play', 'Transpose', -12, 12, 1, 'st', ALL, '');
  S('touch', 'play', 'Touch (velocity curve)', 0.4, 2.5, 0.01, '', ALL, '');
  S('humanTime', 'play', 'Human timing', 0, 30, 0.5, 'ms', ALL, '');
  S('humanVel', 'play', 'Human dynamics', 0, 1, 0.01, '', ALL, '');
  S('intonation', 'play', 'Intonation (human tuning)', 0, 20, 0.5, 'cents', ALL, 'Every note is a few cents off, like a real player (random, small).');
  S('drift', 'play', 'Pitch drift on long notes', 0, 20, 0.5, 'cents', ALL, 'Slow pitch wander while a note is held.');
  WL.PARAMS = PARAMS;
  WL.paramFor = (p, type) => !p.for || p.for.includes(type);

  /* =========================================================== FACTORY == */
  const BASE = {
    engine: 'Real samples', mute: 'Open', sampleLevel: 0, dynRange: 26, layerBlend: 0.8, velTone: 0.35, attackSoft: 0,
    mono: 'Mono legato (real player)', songSlur: 'Overlapping or marked notes', legatoTime: 70, legatoGap: 30, legatoGlide: 0.35, stacBelow: 0.18, releaseTime: 0.12, releaseFall: 18,
    vibType: 'Recorded (real)', vibDelay: 0.35, vibFade: 0.5, vibMinLen: 0.6, vibDepth: 16, vibRate: 5.3, vibAmp: 0.3,
    swell: 3, swellMin: 1, accent: 4, scoop: 70, scoopAuto: 0.15, fall: 5, fallTime: 0.35, doit: 4,
    breath: 0.25, tongue: 0.3, keyNoise: 0.25, growl: 0, growlRate: 38, growlAccents: 0.7, flutter: 0.25,
    players: 1, secTime: 14, secTune: 7, secWidth: 0.6,
    micDist: 0.35, bell: 0, room: 0.35, pan: 0,
    eqLow: 0, eqLowMid: 0, eqMid: 0, eqPres: 0, eqAir: 0, tilt: 0, lowCut: 40, highCut: 18000,
    comp: 0.25, drive: 0.1, delayMix: 0, delayTime: 360, delayFeedback: 0.3, reverbType: 'Club', reverbMix: 0.2, reverbSize: 1.8, predelay: 18, width: 1, output: 0,
    a4: 440, transpose: 0, touch: 1, humanTime: 8, humanVel: 0.25, intonation: 4, drift: 4
  };
  const FACTORY = {
    tenorsax: { lowCut: 45 },
    trumpet: { output: 2, lowCut: 90, legatoTime: 55, legatoGlide: 0.25, releaseFall: 12, breath: 0.15, scoop: 60, fall: 7, reverbMix: 0.22 }
  };
  WL.factory = type => Object.assign({}, BASE, FACTORY[type] || {});
  WL.OLD_FACTORY = {};
  WL.sanitize = function (type, s) {
    const f = WL.factory(type), out = {};
    WL.PARAMS.forEach(p => {
      let v = s && s[p.id] !== undefined ? s[p.id] : f[p.id];
      if (p.options) { if (!p.options.includes(v)) v = f[p.id]; }
      else { v = +v; if (!isFinite(v)) v = f[p.id]; v = Math.min(p.max, Math.max(p.min, v)); }
      out[p.id] = v;
    });
    return out;
  };

  /* ================================================== BUILT-IN SOUNDS == */
  WL.SOUNDS = {
    tenorsax: {
      'Jazz tenor (factory)': {},
      'Smoky ballad': { vibType: 'Recorded (real)', vibDelay: 0.25, breath: 0.45, micDist: 0.2, tilt: -0.25, reverbType: 'Hall', reverbMix: 0.3, reverbSize: 2.6, swell: 5 },
      'R&B / rock growl': { growl: 0.55, growlAccents: 0.6, drive: 0.35, tilt: 0.2, comp: 0.5, scoopAuto: 0.35, reverbType: 'Plate', reverbMix: 0.16 },
      'Bebop (fast, straight)': { vibType: 'Synthetic', vibMinLen: 0.9, vibDepth: 10, legatoTime: 45, stacBelow: 0.14, reverbMix: 0.12, reverbType: 'Club' },
      'Funk section (3 saxes)': { players: 3, mono: 'Poly (chords)', stacBelow: 0.22, comp: 0.5, tilt: 0.25, reverbType: 'Room', reverbMix: 0.14 },
      'Pop solo (bright, delay)': { tilt: 0.3, eqPres: 2, delayMix: 0.18, delayTime: 380, reverbType: 'Plate', reverbMix: 0.24 }
    },
    trumpet: {
      'Open trumpet (factory)': {},
      'Harmon mute (cool jazz)': { mute: 'Harmon mute', vibType: 'Synthetic', vibDepth: 9, micDist: 0.15, reverbType: 'Club', reverbMix: 0.2 },
      'Straight mute': { mute: 'Straight mute', reverbMix: 0.18 },
      'Salsa / mambo (bright, section)': { players: 2, mono: 'Poly (chords)', tilt: 0.35, flutter: 0.5, scoopAuto: 0.3, comp: 0.45, reverbType: 'Room', reverbMix: 0.16 },
      'Mariachi (wide vibrato)': { vibType: 'Synthetic', vibDepth: 28, vibRate: 6.2, vibDelay: 0.12, vibMinLen: 0.35, players: 2, secTune: 9, reverbType: 'Hall', reverbMix: 0.26 },
      'Ballad (soft, far)': { micDist: 0.65, tilt: -0.3, swell: 5, dynRange: 30, reverbType: 'Hall', reverbMix: 0.32, reverbSize: 2.8 },
      'Pop horn stabs': { stacBelow: 0.25, fall: 6, comp: 0.55, tilt: 0.2, reverbType: 'Plate', reverbMix: 0.14 }
    }
  };

  /* ============================================================= DEMOS == */
  // build() → items { b: beat, m: midi around 64 (transposed to the instrument), d: beats, v: 0..1, tech: {…} }
  // tech: stacc, accent, fall (slide out down), doit (out up), scoop (in from below), vib (force vibrato)
  const N = (b, m, d, v, tech) => ({ b, m, d, v: v === undefined ? 0.7 : v, tech: tech || {} });
  /** a legato phrase: [beat, note, beats] … each note lasts until the next one starts */
  const slur = (list, v) => list.map(([b, m, d, t], i) => N(b, m, d, v === undefined ? 0.68 + 0.08 * Math.sin(i) : v, t));
  function ballad() {   // original melody, slow
    return slur([[0, 60, 1.5], [1.5, 62, 0.5], [2, 64, 2], [4, 67, 1], [5, 65, 1], [6, 64, 1], [7, 62, 1], [8, 60, 3.5, { vib: true }],
      [12, 64, 1], [13, 67, 1], [14, 69, 2], [16, 71, 1.5], [17.5, 69, 0.5], [18, 67, 1], [19, 64, 1], [20, 65, 4, { vib: true, fall: false }], [24, 64, 4, { vib: true }]], 0.6);
  }
  function bebop() {    // fast eighths, swung
    const line = [60, 62, 64, 65, 67, 69, 70, 69, 67, 66, 65, 64, 62, 61, 60, 59, 57, 60, 64, 67, 71, 69, 67, 64, 65, 64, 62, 60];
    const out = line.map((m, i) => N(i * 0.5 + (i % 2 ? 0.08 : 0), m, i % 2 ? 0.42 : 0.5, i % 4 === 0 ? 0.78 : i % 2 ? 0.55 : 0.68, i === 27 ? {} : {}));
    out.push(N(14, 64, 1.5, 0.8, { scoop: true }), N(16, 60, 3, 0.7, { vib: true }));
    return out;
  }
  function funk() {     // stabs, falls
    const out = [];
    [0, 0.75, 1.5, 2.5, 3.25].forEach((b, i) => out.push(N(b, [64, 64, 67, 64, 62][i], 0.2, 0.85, { stacc: true, accent: i === 2 })));
    out.push(N(4, 69, 1.2, 0.9, { accent: true, fall: true }));
    [6, 6.75, 7.5].forEach(b => out.push(N(b, 67, 0.2, 0.8, { stacc: true })));
    out.push(N(8, 72, 1.5, 0.95, { scoop: true, accent: true }), N(10, 71, 0.5, 0.7), N(10.5, 69, 0.5, 0.7), N(11, 67, 1, 0.75, { doit: true }));
    return out;
  }
  function latin() {    // mambo line
    const out = [], ph = [[0, 67], [0.5, 69], [1, 71], [1.75, 72], [2.5, 71], [3, 69], [3.5, 67], [4, 72, 1.5], [6, 71], [6.5, 69], [7, 67], [7.5, 64], [8, 67, 2.5], [11, 64, 0.4], [11.5, 67, 0.4], [12, 72, 3]];
    ph.forEach(([b, m, d], i) => out.push(N(b, m, d || 0.45, 0.85, i === 15 ? { vib: true, scoop: true } : (d ? {} : { stacc: i % 3 === 0 }))));
    return out;
  }
  function range() { const out = []; for (let i = 0; i < 13; i++) out.push(N(i * 1.25, 46 + i * 3, 1.1, 0.7)); return out; }
  function dynamics() { const out = []; [0.12, 0.3, 0.5, 0.7, 0.9, 1].forEach((v, i) => out.push(N(i * 2.5, 62, 2, v))); return out; }
  function longtone() { return [N(0, 62, 6, 0.6, { vib: true }), N(7, 66, 6, 0.8, { vib: true })]; }
  WL.DEMOS = [
    { id: 'ballad', name: 'Ballad: slurred melody, vibrato on long notes', bpm: 66, build: ballad },
    { id: 'bebop', name: 'Bebop line: fast legato, swing', bpm: 168, build: bebop },
    { id: 'funk', name: 'Funk / pop stabs: staccato, accents, fall, doit', bpm: 104, build: funk },
    { id: 'latin', name: 'Latin mambo line', bpm: 190, build: latin },
    { id: 'longtone', name: 'Long tones (vibrato, swell)', bpm: 70, build: longtone },
    { id: 'dynamics', name: 'Dynamics test: pp → ff', bpm: 90, build: dynamics },
    { id: 'range', name: 'Range test', bpm: 100, build: range }
  ];
  WL.DEMO_ORDER = { tenorsax: ['ballad', 'bebop', 'funk', 'longtone', 'latin', 'dynamics', 'range'], trumpet: ['latin', 'ballad', 'funk', 'bebop', 'longtone', 'dynamics', 'range'] };
  /** demo items → events (seconds from t0), transposed to the instrument, with the human feel */
  WL.demoEvents = function (demo, s, t0, type) {
    const T = WL.TYPES[type], spb = 60 / demo.bpm, ev = [];
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const shift = demo.id === 'range' ? T.range[0] - 46 + Math.round((T.range[1] - T.range[0] - 36) / 2) : T.center - 64;
    let id = 0, end = 0;
    demo.build().forEach(it => {
      const t = Math.max(t0, t0 + it.b * spb + g() * s.humanTime / 1000);
      const vel = Math.min(1, Math.max(0.05, it.v * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.2)));
      const nid = 'd' + (++id), dur = it.d * spb;
      ev.push(Object.assign({ type: 'on', t, midi: it.m + shift, vel, id: nid, dur }, it.tech), { type: 'off', t: t + dur, id: nid });
      end = Math.max(end, t + dur);
    });
    ev.sort((a, b) => a.t - b.t || (a.type === 'off' ? -1 : 1));
    return { events: ev, end };
  };
})();
