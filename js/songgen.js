/* =============================================================================
 *  SONGGEN.JS — "Auto Generate Full Song" + the genre engine
 *  -----------------------------------------------------------------------------
 *  Builds a complete song of a genre (styles.js) in the chosen key:
 *    1. FORM         sections of the chosen structure (Short / Standard / Extended)
 *    2. HARMONY      a progression per section group (chosen or picked from the
 *                    genre library), written as chord symbols over the score
 *    3. BAND         the instruments of the genre, each with its real sound
 *                    (factory samples when available), effect chain and volume
 *    4. PARTS        every track is generated bar by bar:
 *                      drums / percussion  genre patterns per section, crashes, fills
 *                      bass                tumbao, walking, boogie, one-drop, 808…
 *                      harmony             montuno, rootless jazz voicings, pads,
 *                                          arpeggios, chord rhythms (skank, bubble…)
 *                      guitars             strum, power chords, funk scratch,
 *                                          boom-chick, bossa, shuffle, arpeggios
 *                      melodies            autogen.js (themes, phrases, cadences)
 *                                          with the genre scales and the chosen
 *                                          techniques, placed where they fit
 *                      horns               2-bar riffs / answers + a 2nd voice in 3rds
 *  The same realizers are used by "Auto Generate Track" when a style is chosen.
 *
 *  PATTERN FORMATS used in styles.js (one char = one 16th; 16 = 1 bar, 32 = 2 bars)
 *    drums      X x o - .                    (accent … ghost, rest)
 *    bass       "p:tok:len …"  tok = R root · 5 · 3 · b7 · 6 · 8 octave · N next root
 *                                     (anticipation) · A chromatic approach
 *    chords     "p:len[:N] …"  N = play the NEXT chord (anticipation)
 *    arp        digits = voice of the chord (0 = bass)  "." = hold
 *    strum      D U down/up · d u muted · x scratch · B bass · b alternate bass
 *    power      P palm-muted power chord · O open accent · o open
 *    funk       X chord stab · x muted scratch
 *    montuno    T top note in octaves · M middle note in octaves · C chord · N next chord
 *    bossa      B thumb bass · C fingers chord · X both
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const BAR = 16;
  const SG = {};
  SDAW.songgen = SG;
  const U = () => SDAW.autogen.util;

  /* ======================================================== INSTRUMENTS == */
  /** How every instrument name of styles.js is made */
  SG.INSTR = {
    // Grand Piano / Electric Piano / Organ = the realistic Piano Rig (pianorig.js)
    'Grand Piano': { base: 'Grand Piano' },
    'Upright Piano': { base: 'Grand Piano (light)', factory: 'upright-piano' },
    'Electric Piano': { base: 'Electric Piano - Rhodes' }, 'Organ': { base: 'Organ' },
    'Clavinet': { gen: 'Clavinet', type: 'keys' }, 'Vibraphone': { gen: 'Vibraphone', type: 'keys' },
    'Accordion': { gen: 'Accordion', type: 'synth' }, 'Pluck': { gen: 'Pluck', type: 'synth' },
    'Soft Pad': { gen: 'Soft Pad', type: 'strings' }, 'String Ensemble': { base: 'String Ensemble' }, 'Warm Pad': { base: 'Warm Pad' },
    'Upright Bass': { engine: 'bass', type: 'bass', params: { brightness: 0.22, decay: 0.993 } },
    '808 Bass': { gen: '808 Bass', type: 'bass' },
    // Trumpet / Tenor Sax = the realistic Wind Rig (windrig.js); the others are generator models
    'Trumpet': { base: 'Trumpet' }, 'Trombone': { gen: 'Trombone', type: 'synth' },
    'Alto Sax': { gen: 'Alto Sax', type: 'synth' }, 'Tenor Sax': { base: 'Tenor Sax' },
    'Flute': { gen: 'Flute', type: 'synth' }, 'Fiddle': { gen: 'Fiddle', type: 'strings' },
    'Harmonica': { gen: 'Harmonica', type: 'synth' }, 'Melodica': { gen: 'Melodica', type: 'synth' },
    // voices (formant generator: vowel filters + a singer's delayed vibrato)
    'Lead Vocal': { gen: 'Lead Vocal', type: 'synth' }, 'Female Vocal': { gen: 'Female Vocal', type: 'synth' },
    'Choir Aah': { gen: 'Choir Aah', type: 'synth' }, 'Choir Ooh': { gen: 'Choir Ooh', type: 'synth' }
  };
  SG.instType = function (name) {
    const d = SG.INSTR[name];
    if (d && d.type) return d.type;
    const it = SDAW.findInstrument(d && d.base || name);
    return it ? it.type : 'keys';
  };

  /** Percussion kits: which real sample each pad uses (first match wins, plain acoustic names preferred) */
  SG.KITS = {
    set:      { base: 'Studio Kit', factoryKit: 'acoustic-kit' },
    set808:   { base: 'Studio Kit', factoryKit: '808-kit' },
    congas:   { base: 'Latin Percussion Kit', rows: { tom1: [/conga.*(hi|high|open)/i, /conga/i], tom2: [/conga.*(low|lo\b)/i, /tumba/i], perc: [/conga.*slap/i, /conga 70s 2/i, /conga.*mid/i], hhc: [/conga.*(mute|mid)/i, /conga/i] } },
    timbales: { base: 'Latin Percussion Kit', rows: { tom1: [/timbales? high/i, /timbale/i], tom2: [/timbales? low/i, /timbale skin/i], perc: [/timbale rim/i, /wood block high/i, /^rim/i], ride: [/cowbell/i] } },
    bongo:    { base: 'Latin Percussion Kit', rows: { tom1: [/bongo.*(hi|high)/i, /bongo/i], tom2: [/bongo.*(low|lo\b)/i, /bongo/i], perc: [/cowbell/i] } },
    clave:    { base: 'Latin Percussion Kit', rows: { perc: [/^clave c78$/i, /clave/i] } },
    guiro:    { base: 'Latin Percussion Kit', rows: { hhc: [/guiro.*short$/i, /guiro/i], hho: [/guiro.*long/i, /guiro/i] } },
    guira:    { base: 'Latin Percussion Kit', rows: { hhc: [/cabasa/i, /shaker.*acoustic/i, /shaker/i], hho: [/guiro.*long/i, /guiro/i] } },
    tambora:  { base: 'Latin Percussion Kit', rows: { tom2: [/tom.*(floor|low)/i, /conga.*low/i], tom1: [/conga.*slap/i, /conga.*(hi|high)/i], snare: [/rim/i, /side.?stick/i] } },
    maracas:  { base: 'Latin Percussion Kit', rows: { hhc: [/maracas/i, /shaker/i] } },
    shaker:   { base: 'Latin Percussion Kit', rows: { hhc: [/shaker acoustic/i, /shaker/i] } },
    cowbell:  { base: 'Latin Percussion Kit', rows: { perc: [/cowbell/i] } }
  };
  function findSound(regs) {
    const F = SDAW.factory;
    if (!F || !F.hasSounds()) return null;
    const bad = /808|edm|glitch|processed|chop|fx|lo.?fi|reverse|vinyl|distort|weback|kick/i;
    for (const re of regs) {
      const all = F.index.sounds.filter(s => re.test(s.name));
      const good = all.filter(s => !bad.test(s.name));
      const pick = (good.length ? good : all)[0];
      if (pick) return pick.id;
    }
    return null;
  }

  /** Effect chains offered for every track (pedalboard settings) */
  SG.FX = {
    'Dry': {},
    'Room': { reverb: { on: true, model: 'room', mix: 0.18 } },
    'Hall': { reverb: { on: true, model: 'hall', mix: 0.3 } },
    'Spring': { reverb: { on: true, model: 'spring', mix: 0.25 } },
    'Ballad Hall': { comp: { on: true, model: 'studio', amount: 0.4 }, reverb: { on: true, model: 'hall', mix: 0.34 } },
    'Brass Room': { comp: { on: true, model: 'studio', amount: 0.35 }, eq: { on: true, model: 'tilt', low: -2, mid: 2, high: 1 }, reverb: { on: true, model: 'room', mix: 0.2 } },
    'Clean + Chorus': { comp: { on: true, model: 'cs3', amount: 0.4 }, amp: { on: true, model: 'jc120', gain: 0.3 }, chorus: { on: true, model: 'ce2', mix: 0.45 }, reverb: { on: true, model: 'room', mix: 0.2 } },
    'Jazz Clean': { amp: { on: true, model: 'jc120', gain: 0.25, treble: 0.4, bass: 0.6 }, reverb: { on: true, model: 'room', mix: 0.18 } },
    'Lead Clean (Delay)': { comp: { on: true, model: 'cs3', amount: 0.4 }, amp: { on: true, model: 'twin', gain: 0.35 }, delay: { on: true, model: 'digital', time: 2, feedback: 0.3, mix: 0.22 }, reverb: { on: true, model: 'hall', mix: 0.22 } },
    'Crunch (TS-808 + Plexi)': { drive: { on: true, model: 'ts808', amount: 0.35 }, amp: { on: true, model: 'plexi', gain: 0.5 }, reverb: { on: true, model: 'room', mix: 0.15 } },
    'Blues Overdrive (BD-2)': { drive: { on: true, model: 'bd2', amount: 0.4 }, amp: { on: true, model: 'ac30', gain: 0.45 }, reverb: { on: true, model: 'spring', mix: 0.22 } },
    'Rock Distortion (DS-1)': { dist: { on: true, model: 'ds1', amount: 0.55 }, amp: { on: true, model: 'plexi', gain: 0.55 }, reverb: { on: true, model: 'room', mix: 0.14 } },
    'Lead (TS + Delay)': { drive: { on: true, model: 'ts808', amount: 0.6 }, amp: { on: true, model: 'plexi', gain: 0.6 }, delay: { on: true, model: 'analog', time: 2, feedback: 0.3, mix: 0.22 }, reverb: { on: true, model: 'hall', mix: 0.22 } },
    // Van Halen "brown sound": a cranked Marshall (no distortion pedal), mids forward, a plate; the lead adds a short echo
    'Brown Sound (Plexi)': { drive: { on: true, model: 'ts808', amount: 0.25, level: 0.7 }, amp: { on: true, model: 'plexi', gain: 0.72, mid: 0.6, presence: 0.6 }, reverb: { on: true, model: 'plate', mix: 0.14 } },
    'Brown Sound Lead': { drive: { on: true, model: 'ts808', amount: 0.35, level: 0.7 }, amp: { on: true, model: 'plexi', gain: 0.75, mid: 0.6, presence: 0.6 }, delay: { on: true, model: 'tape', time: 2, feedback: 0.25, mix: 0.18 }, reverb: { on: true, model: 'plate', mix: 0.18 } },
    'Metal (MT-2)': { dist: { on: true, model: 'mt2', amount: 0.6 }, amp: { on: true, model: 'rect', gain: 0.6 }, reverb: { on: true, model: 'room', mix: 0.12 } },
    'Country Twang': { comp: { on: true, model: 'dyna', amount: 0.55 }, amp: { on: true, model: 'twin', gain: 0.35, treble: 0.65 }, delay: { on: true, model: 'digital', time: 0, feedback: 0.1, mix: 0.2 }, reverb: { on: true, model: 'spring', mix: 0.2 } },
    'Reggae Skank (Spring)': { amp: { on: true, model: 'twin', gain: 0.3 }, eq: { on: true, model: 'graphic', low: -6, mid: 2, high: 3 }, reverb: { on: true, model: 'spring', mix: 0.25 } },
    'Dub Delay': { delay: { on: true, model: 'tape', time: 2, feedback: 0.5, mix: 0.3 }, reverb: { on: true, model: 'plate', mix: 0.25 } },
    'Funk (Comp + Clean)': { comp: { on: true, model: 'dyna', amount: 0.6 }, amp: { on: true, model: 'twin', gain: 0.3 }, reverb: { on: true, model: 'room', mix: 0.12 } },
    'Vocal Plate': { comp: { on: true, model: 'studio', amount: 0.5 }, eq: { on: true, model: 'tilt', low: -3, mid: 1, high: 2 }, delay: { on: true, model: 'digital', time: 2, feedback: 0.2, mix: 0.07 }, reverb: { on: true, model: 'plate', mix: 0.15 } },
    'Choir Hall': { comp: { on: true, model: 'studio', amount: 0.35 }, eq: { on: true, model: 'tilt', low: -4, mid: 0, high: 1 }, reverb: { on: true, model: 'hall', mix: 0.38 } },
    'Synth Wide': { chorus: { on: true, model: 'dimension', mix: 0.4 }, delay: { on: true, model: 'digital', time: 2, feedback: 0.25, mix: 0.18 }, reverb: { on: true, model: 'plate', mix: 0.25 } }
  };
  SG.applyFx = function (t, name) {
    const fx = SDAW.defaultPedals();
    Object.keys(fx).forEach(k => { fx[k].on = false; });
    const chain = SG.FX[name] || {};
    Object.keys(chain).forEach(k => Object.assign(fx[k], chain[k]));
    t.fx = fx; t.fxChain = name;
  };

  /** Create the track of a style track spec (inside a song being built) */
  /* ---------------------------------------------- guitars: Guitar Rig --- *
   * Guitar tracks of the genres play the realistic Guitar Rig (guitarrig.js, the Guitar Lab
   * engine) unless the song option "Guitars" is "Light synth". The effect preset of the genre
   * is translated into the rig's own amp / cabinet / effects (real amp captures + real cabinet
   * IRs), so a Rock guitar keeps its distortion and nothing is doubled by the pedalboard.
   */
  SG.RIG_ITEMS = { nylon: 'Real Classical Guitar (Nylon)', steel: 'Real Acoustic Guitar (Steel)', strat: 'Real Electric - Stratocaster', lespaul: 'Real Electric - Les Paul', hollow: 'Real Electric - Hollow Body' };
  SG.RIG_FX = {
    'Dry': { reverbMix: 0.05 },
    'Room': { reverbType: 'Room', reverbMix: 0.16 },
    'Hall': { reverbType: 'Hall', reverbMix: 0.26 },
    'Spring': { reverbType: 'Real spring (IR)', reverbMix: 0.22 },
    'Ballad Hall': { comp: 0.4, reverbType: 'Hall', reverbMix: 0.3 },
    'Clean + Chorus': { ampModel: 'NAM · Fender Deluxe Reverb', gain: 2.5, comp: 0.4, chorusMix: 0.45, chorusRate: 0.8, chorusDepth: 0.45, reverbType: 'Room', reverbMix: 0.2 },
    'Jazz Clean': { ampModel: 'NAM · Roland JC-120', gain: 2, comp: 0.2, reverbType: 'Room', reverbMix: 0.15 },
    'Lead Clean (Delay)': { ampModel: 'NAM · Fender Deluxe Reverb', comp: 0.4, delayMix: 0.22, delayTime: 380, delayFeedback: 0.3, reverbType: 'Real plate (IR)', reverbMix: 0.2 },
    'Crunch (TS-808 + Plexi)': { ampModel: 'NAM · Marshall JCM800', namInput: 6, gain: 6, cab: 'IR · Mesa 4x12 (real cab)', reverbType: 'Room', reverbMix: 0.14 },
    'Blues Overdrive (BD-2)': { ampModel: 'NAM · Vox AC10', namInput: 6, gain: 6, cab: 'IR · Celestion (real cab)', reverbType: 'Real spring (IR)', reverbMix: 0.2 },
    'Rock Distortion (DS-1)': { ampModel: 'NAM · Marshall JCM800', namInput: 12, gain: 8, cab: 'IR · Mesa 4x12 (real cab)', reverbType: 'Room', reverbMix: 0.12 },
    'Lead (TS + Delay)': { ampModel: 'NAM · Dumble ODS', namInput: 9, gain: 7.5, cab: 'IR · Celestion (real cab)', delayMix: 0.22, delayTime: 420, delayFeedback: 0.3, reverbType: 'Room', reverbMix: 0.16 },
    'Brown Sound (Plexi)': { ampModel: 'NAM · Marshall JCM800', namInput: 10, gain: 7.5, mid: 6, presence: 6, cab: 'IR · Celestion (real cab)', reverbType: 'Real plate (IR)', reverbMix: 0.14 },
    'Brown Sound Lead': { ampModel: 'NAM · Marshall JCM800', namInput: 11, gain: 8, mid: 6, presence: 6, cab: 'IR · Celestion (real cab)', delayMix: 0.16, delayTime: 320, delayFeedback: 0.22, reverbType: 'Real plate (IR)', reverbMix: 0.18 },
    'Metal (MT-2)': { ampModel: 'NAM · EVH 5153 (high gain)', namInput: 6, gain: 8, mid: 4.5, cab: 'IR · Mesa 4x12 (real cab)', reverbType: 'Room', reverbMix: 0.1, palmMute: 0.85 },
    'Country Twang': { ampModel: 'NAM · Fender Deluxe Reverb', pickupSel: 'Bridge', comp: 0.55, treble: 6.5, delayMix: 0.18, delayTime: 110, delayFeedback: 0.1, reverbType: 'Real spring (IR)', reverbMix: 0.14 },
    'Funk (Comp + Clean)': { ampModel: 'NAM · Roland JC-120', pickupSel: 'Middle + Bridge', comp: 0.6, reverbType: 'Room', reverbMix: 0.1 },
    'Reggae Skank (Spring)': { ampModel: 'NAM · Fender Deluxe Reverb', eqLow: -6, eqUpMid: 2, reverbType: 'Real spring (IR)', reverbMix: 0.25 },
    'Dub Delay': { delayMix: 0.3, delayTime: 500, delayFeedback: 0.5, reverbType: 'Real plate (IR)', reverbMix: 0.25 }
  };
  const DIST_FX = /Distortion|Metal|Crunch|Lead \(TS|Brown Sound/;
  /** which Guitar Rig guitar plays a guitar instrument of a genre (null = not a guitar) */
  SG.rigModelFor = function (instName, fxName) {
    const item = Object.keys(SG.RIG_ITEMS).find(m => SG.RIG_ITEMS[m] === instName);
    if (item) return item;
    if (/Nylon|Classical|Requinto/i.test(instName)) return 'nylon';
    if (/Acoustic|12-String/i.test(instName)) return 'steel';
    if (/Electric Guitar/i.test(instName)) return /Jazz/.test(fxName || '') ? 'hollow' : DIST_FX.test(fxName || '') ? 'lespaul' : 'strat';
    return null;
  };
  /** the rig settings of a genre's effect preset (only what this guitar has) */
  SG.rigDiffFor = function (model, instName, fxName) {
    const GL = window.GL, d = Object.assign({}, SG.RIG_FX[fxName] || SG.RIG_FX.Room);
    const electric = GL && GL.TYPES[model] && GL.TYPES[model].cat === 'electric';
    if (!electric) Object.keys(d).forEach(k => { if (!/^(reverb|delay|chorus|comp|eq|predelay)/.test(k)) delete d[k]; });
    if (d.pickupSel && model !== 'strat') delete d.pickupSel;
    if (/12-String/i.test(instName)) Object.assign(d, { chorusMix: 0.35, chorusDepth: 0.25, chorusRate: 0.6 });
    return d;
  };
  /** can the Guitar Rig play here? */
  SG.rigAvailable = () => !!(SDAW.guitarRig && SDAW.guitarRig.ok());

  /**
   * MIX BALANCE of a generated band (the mixer volume of every new track). The genre gives each
   * instrument its volume (styles.js `vol`); on top of it the bass sits a little lower and the
   * melody a little higher, so the lead line stands out of the band. Only new songs: a saved
   * project keeps the volumes it was saved with.
   */
  SG.MIX = { bass: 0.86, lead: 1.2, vocal: 1.12, max: 1 };      // the fader is quadratic: 0.86 = −2.6 dB, 1.2 = +3.2 dB, 1.12 = +2 dB
  SG.mixVolume = function (spec) {
    let v = spec.vol || 0.75;
    if (spec.role === 'bass') v *= SG.MIX.bass;
    else if (spec.role === 'vocal') v *= SG.MIX.vocal;
    else if (spec.lead) v *= SG.MIX.lead;
    return Math.min(SG.MIX.max, Math.round(v * 100) / 100);
  };

  SG.makeTrackFor = function (spec, instName) {
    instName = instName || spec.inst;
    let t;
    const rigModel = spec.role !== 'drums' && spec.guitarEngine !== 'light' && SG.rigAvailable() ? SG.rigModelFor(instName, spec.fxChoice || spec.fx) : null;
    if (rigModel) {
      // a real guitar (Guitar Rig) with the genre's amp / effects translated into the rig
      const R = SDAW.guitarRig, fxName = spec.fxChoice || spec.fx;
      t = SDAW.makeTrack(SDAW.findInstrument(SG.RIG_ITEMS[rigModel]), spec.name);
      t.instrument = SG.RIG_ITEMS[rigModel];
      R.setDiff(t, Object.assign({}, R.labReference(rigModel) || {}, SG.rigDiffFor(rigModel, instName, fxName)), rigModel);
      t.rigFx = fxName || null;               // which genre preset the rig settings came from (shown in the Inspector)
    } else if (spec.role === 'drums') {
      const kit = SG.KITS[spec.kit] || SG.KITS.set;
      t = SDAW.makeTrack(SDAW.findInstrument(kit.base), spec.name);
      t.instrument = instName;
      const F = SDAW.factory;
      if (F && F.hasSounds()) {
        if (kit.factoryKit) { const fk = F.index.kits.find(k => k.id === kit.factoryKit); if (fk) Object.keys(fk.pads).forEach(pad => { t.drumMap[pad] = F.addToSong(fk.pads[pad]); }); }
        if (kit.rows) Object.keys(kit.rows).forEach(row => { const id = findSound(kit.rows[row]); if (id) t.drumMap[row] = F.addToSong(id); });
        if (Object.keys(t.drumMap).length) t.source = 'Real samples';
      }
    } else {
      const d = SG.INSTR[instName] || { base: instName };
      let inst;
      if (d.gen) inst = { name: instName, engine: 'gen', type: d.type, source: 'Generator', params: { gen: SDAW.genPreset(d.gen) } };
      else if (d.engine) inst = { name: instName, engine: d.engine, type: d.type, source: 'Built-in', params: SDAW.deepCopy(d.params || {}) };
      else inst = SDAW.findInstrument(d.base || instName);
      t = SDAW.makeTrack(inst, spec.name);
      t.instrument = instName;
      const F = SDAW.factory;
      if (d.factory && F && F.hasSounds()) {
        const fi = F.index.instruments.find(i => i.id === d.factory);
        if (fi) { t.sampler = { zones: fi.zones.map(z => ({ sampleId: F.addToSong(z.id), root: z.root })) }; t.source = 'Real samples'; }
      }
    }
    t.styleTrack = spec.id;
    if (spec.kit) t.kit = spec.kit;
    t.vol = SG.mixVolume(spec); t.pan = spec.pan || 0;
    SG.applyFx(t, spec.fxChoice || spec.fx || (spec.role === 'drums' ? 'Room' : 'Room'));
    // Piano / Guitar / Wind Rig: the rig has its own reverb and effects — no second reverb from the pedalboard
    if (SDAW.isRigEngine(t.engine)) { Object.keys(t.fx).forEach(k => { t.fx[k].on = false; }); t.sendRev = 0; }
    if (spec.role === 'drums') { t.fx.reverb.on = /set/.test(spec.kit) ? false : true; t.fx.reverb.mix = 0.1; }
    return t;
  };

  /* ======================================================= PROGRESSIONS == */
  const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
  /** Roman numeral → { root (pc), type }   e.g. "bVII7", "iiø", "#ivo7", "Imaj7" */
  SG.parseRoman = function (tok, keyRoot) {
    const m = /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(tok.trim());
    if (!m) return null;
    const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
    const upper = m[2] === m[2].toUpperCase();
    const root = ((keyRoot + ROMAN[m[2].toUpperCase()] + acc) % 12 + 12) % 12;
    let suf = m[3], type;
    if (suf === '' ) type = upper ? '' : 'm';
    else if (suf === '7') type = upper ? '7' : 'm7';
    else if (suf === '9') type = upper ? '9' : 'm9';
    else if (suf === '6') type = upper ? '6' : 'm6';
    else if (suf === 'ø' || suf === 'ø7') type = 'm7b5';
    else if (suf === 'o') type = 'dim';
    else if (suf === 'o7') type = 'dim7';
    else if (suf === 'm7' || suf === 'm9' || suf === 'm6' || suf === 'maj7' || suf === 'maj9' || suf === '13' || suf === 'sus4' || suf === 'sus2' || suf === '7sus4' || suf === 'add9' || suf === '7b9') type = suf;
    else if (suf === 'm') type = 'm';
    else if (suf === '69') type = upper ? '69' : 'm69';                              // jazz colours (endings)
    else if (suf === 'maj7#11' || suf === 'maj13' || suf === '7#9' || suf === '9#11' || suf === 'mMaj7' || suf === 'm69') type = suf;
    else type = upper ? '' : 'm';
    return { root, type, flat: acc < 0, sharp: acc > 0 };
  };
  /** Chord symbol of a roman token in a key ("bVII" in C → "Bb") */
  SG.romanToName = function (tok, keyRoot, preferFlats) {
    const [main, over] = tok.split('/');                 // "IV/I" = IV chord over the I bass
    const r = SG.parseRoman(main, keyRoot);
    if (!r) return tok;
    const names = r.sharp ? SDAW.NOTE_NAMES : (r.flat || preferFlats ? SDAW.FLAT_NAMES : SDAW.NOTE_NAMES);
    let name = names[r.root] + r.type;
    if (over) { const b = SG.parseRoman(over, keyRoot); if (b && b.root !== r.root) name += '/' + (preferFlats || b.flat ? SDAW.FLAT_NAMES : SDAW.NOTE_NAMES)[b.root]; }
    return name;
  };
  /** is this Roman numeral the tonic chord (same root as the key, bass on the root)? "IV", "ii", "bIII", "I/V" → false */
  SG.isTonic = function (tok, keyRoot) {
    const [main, over] = String(tok).split('/');
    const r = SG.parseRoman(main, keyRoot);
    if (!r || r.root !== keyRoot) return false;
    if (over) { const b = SG.parseRoman(over, keyRoot); if (!b || b.root !== keyRoot) return false; }
    return true;
  };
  SG.prefersFlats = (keyRoot, mode) => mode === 'minor' ? [2, 7, 0, 5, 10, 3, 8].includes(keyRoot) : [5, 10, 3, 8, 1, 6].includes(keyRoot);

  /** The section group a progression is chosen for */
  SG.groupOf = type => ({ intro: 'intro', verse: 'verse', part: 'verse', pre: 'pre', chorus: 'chorus', bridge: 'bridge', solo: 'solo', outro: 'outro' }[type] || 'verse');
  /** Progressions of a style usable for a group in a mode */
  SG.progsFor = function (style, group, mode) {
    return style.progs.filter(p => p.m === mode && p.use.split(' ').includes(group));
  };
  const GENERIC = { major: { verse: 'I V vi IV', chorus: 'I V vi IV', pre: 'IV V IV V', bridge: 'vi IV I V', solo: 'I IV V IV' }, minor: { verse: 'i bVI bIII bVII', chorus: 'i bVI bIII bVII', pre: 'bVI bVII bVI bVII', bridge: 'iv bVI bVII bVII', solo: 'i bVII bVI bVII' } };
  /** Choose the progression (roman string) of every group */
  SG.chooseProgs = function (style, mode, chosen, seed, lens) {
    const R = U().makeRand(seed ^ 0x51ED);
    const out = {};
    // a progression must fit the section: its bars divide the section length
    // (12-bar blues for 12-bar verses — never an 8-bar progression cut at bar 12)
    const fits = (p, g) => {
      const n = p.c.split(/\s+/).filter(Boolean).length, L = lens && lens[g];
      return !L || L % n === 0;
    };
    ['verse', 'chorus', 'pre', 'bridge', 'solo'].forEach(g => {
      if (chosen && chosen[g] && chosen[g] !== 'auto') { out[g] = chosen[g]; return; }
      const all = SG.progsFor(style, g, mode), ok = all.filter(p => fits(p, g));
      const list = ok.length ? ok : all;
      // the first progression of a style is its signature (12-bar blues, montuno…): chosen half of the time
      if (list.length) out[g] = (R.chance(0.5) ? list[0] : R.pick(list)).c;
    });
    if (!out.verse) out.verse = GENERIC[mode].verse;
    if (!out.chorus) out.chorus = SG.progsFor(style, 'verse', mode).length ? out.verse : GENERIC[mode].chorus;
    if (!out.solo) out.solo = out.chorus;
    if (!out.pre) out.pre = GENERIC[mode].pre;
    if (!out.bridge) out.bridge = SG.progsFor(style, 'chorus', mode).filter(p => p.c !== out.chorus).map(p => p.c)[0] || GENERIC[mode].bridge;
    const intro = SG.progsFor(style, 'intro', mode).find(p => !p.use.includes('verse') && !p.use.includes('chorus') && !p.use.includes('solo'));
    out.intro = intro ? intro.c : out.chorus;
    const outro = SG.progsFor(style, 'outro', mode)[0];
    if (outro) out.outro = outro.c;
    else { const toks = out.chorus.split(' '); toks[toks.length - 1] = mode === 'minor' ? 'i' : 'I'; out.outro = toks.join(' '); }
    return out;
  };

  /* ======================================================== REALIZERS == */
  const VEL = { X: 1, x: 0.78, o: 0.5, '-': 0.3 };
  const FALLBACK = { pre: 'verse', solo: 'chorus', bridge: 'verse', intro: 'verse', outro: 'chorus', part: 'verse', chorus: 'verse' };
  function pick(obj, type) {
    if (!obj) return null;
    let t = type, guard = 0;
    while (t && guard++ < 4) { if (obj[t] !== undefined) return obj[t]; t = FALLBACK[t]; }
    return obj.verse !== undefined ? obj.verse : null;
  }
  /** Default patterns when a style track does not define one */
  const DEF = {
    style: { verse: '0:R:6 6:R:2 8:5:4 12:R:4', chorus: '0:R:2 2:R:2 4:R:2 6:8:2 8:R:2 10:R:2 12:5:2 14:A:2', intro: '0:R:8 8:5:8' },
    roots: { verse: '0:R:8 8:R:8' }, '8ths': { verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2' },
    tumbao: { verse: '6:R:6 12:N:4' }, boogie: { verse: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' },
    chords: { verse: '0:6 6:4 10:6', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', intro: '0:16', bridge: '0:8 8:8' },
    arp: { verse: '0.1.2.3.2.1.2.3.' }, strum: { verse: 'D...D.U...U.D.U.', chorus: 'D.DU.UDUD.DU.UDU' },
    power: { verse: 'P.P.P.P.P.P.P.P.', chorus: 'O.....O.O...O.P.' }, funk: { verse: 'x.xXx.x.x.xXx.x.' },
    boomchick: { verse: 'B...D.U.b...D.U.' }, bossa: { verse: 'X..C..C.B.C..C..B.C...C.B..C..C.' },
    montuno: { verse: 'A...A.B...B.A.N...B.A...A.B...N.' },
    'montuno-light': { verse: 'A.....B.....A.N...A...B.....A.N.' }
  };
  const DEFAULT_MIX = { intro: 'arp', verse: 'arp', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' };

  /** Which style track spec describes a song track */
  SG.specFor = function (track, style, role) {
    if (!style) return null;
    if (track.styleTrack) { const sp = style.tracks.find(t => t.id === track.styleTrack); if (sp) return sp; }
    if (role === 'drums') {
      const kits = style.tracks.filter(t => t.role === 'drums');
      return kits.find(t => /^set/.test(t.kit)) || (kits.length ? mergedPerc(style) : null);
    }
    const like = { harmony: ['harmony', 'strum', 'arp'], strum: ['strum', 'arp', 'harmony'], arp: ['arp', 'strum', 'harmony'], bass: ['bass'] }[role] || [role];
    const cands = style.tracks.filter(t => like.includes(t.role));
    return cands.find(t => SG.instType(t.inst) === track.type) || cands[0] || null;
  };
  /** All the percussion of a Latin style on ONE drum kit (for a normal drum track) */
  function mergedPerc(style) {
    const kits = style.tracks.filter(t => t.role === 'drums');
    const pat = {};
    ['intro', 'verse', 'pre', 'chorus', 'bridge', 'solo', 'outro'].forEach(type => {
      const rows = {};
      kits.forEach(k => { const p = pick(k.pat, type); if (!p) return; Object.keys(p).forEach(r => {
        const a = rows[r] || '', b = p[r]; const L = Math.max(a.length, b.length);
        let s = ''; for (let i = 0; i < L; i++) { const ca = a[i % (a.length || 1)] || '.', cb = b[i % b.length] || '.'; s += (VEL[cb] || 0) > (VEL[ca] || 0) ? cb : ca; }
        rows[r] = s;
      }); });
      if (Object.keys(rows).length) pat[type] = rows;
    });
    return { id: 'merged', role: 'drums', kit: 'merged', pat };
  }

  SG.handles = (role) => ['drums', 'bass', 'harmony', 'strum', 'arp'].includes(role);

  /** Realize one section of a track with the genre patterns */
  SG.realizeSection = function (ctx, sec, isLast) {
    const spec = SG.specFor(ctx.track, ctx.style, ctx.role) || { role: ctx.role };
    const type = sec.type;
    let play = ctx.play || spec.play || (ctx.role === 'bass' ? 'style' : ctx.role === 'strum' ? 'strum' : ctx.role === 'arp' ? 'arp' : 'chords');
    if (play === 'mix' && spec.mixPool && ctx.track.type === 'guitar') {
      // the genre offers several ways to accompany each section: the idea (seed) picks one per section type,
      // so two songs of the same genre do not share the same rhythm guitar (spec.mixPool, e.g. Rock)
      const pool = pick(spec.mixPool, type) || ['strum'];
      play = U().makeRand(ctx.seed ^ U().hash('mixpool|' + type)).pick(pool);
    }
    if (play === 'mix') play = (spec.mix || (ctx.track.type === 'guitar' ? { intro: 'arp', verse: 'arp', pre: 'strum', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' } : DEFAULT_MIX))[type] || 'chords';
    if (ctx.track.type !== 'guitar' && (['strum', 'power', 'funk', 'boomchick', 'bossa', 'shuffle'].includes(play) || (SDAW.legends && SDAW.legends.RHYTHMS[play]))) play = 'chords';
    if (ctx.track.type === 'guitar' && /montuno/.test(play)) play = 'arp';
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k;
      const lastBar = k === sec.length - 1, finalBar = isLast && lastBar;
      const sig = ctx.an.chords.filter(c => c.bar === bar || c.bar === bar + 1).map(c => c.name).join('');
      const R = U().makeRand(ctx.seed ^ U().hash([ctx.role, play, type, k % 4, sig, lastBar ? 'L' : ''].join('|')));
      const c = { ctx, spec, sec, k, bar, R, type, play, lastBar, finalBar, isLast };
      if (ctx.role === 'drums') bars.push({ bar, rows: drumBar(c) });
      else if (ctx.role === 'bass') bars.push({ bar, notes: bassBar(c) });
      else bars.push({ bar, notes: compBar(c) });
    }
    return bars;
  };

  /* ---------------------------------------------------------- drums --- */
  function drumBar(c) {
    const { ctx, spec, sec, k, type } = c;
    const rows = U().emptyRows();
    const pat = pick(spec.pat, type) || {};
    const energy = (SDAW.autogen.CONFIG.profiles[type] || SDAW.autogen.CONFIG.profiles.part).energy;
    const scale = 0.82 + energy * 0.18;
    Object.keys(pat).forEach(row => {
      const str = pat[row]; if (!str || !rows[row]) return;
      const off = str.length >= 32 ? (k % 2) * 16 : 0;
      for (let p = 0; p < 16; p++) {
        let v = VEL[str[off + p]] || 0;
        if (ctx.level === 0.5 && v < 0.7) v = 0;
        rows[row][p] = Math.min(1, v * scale);
      }
    });
    const set = /^set/.test(spec.kit || '') || spec.kit === 'merged';
    // the drummer's own variations of the genre groove (they change with the idea / seed)
    if (set && ctx.level === 1 && !c.finalBar) drumVariation(rows, c);
    else if (!set && spec.kit !== 'clave' && ctx.level === 1 && !c.finalBar) percVariation(rows, c);
    // crash at the start of sections (not the first one)
    if (set && k === 0 && sec.start > 0 && ctx.level === 1 && (type !== 'verse' || prevType(ctx, sec) === 'intro')) rows.crash[0] = 0.92;
    // fill on the last bar of a section
    if (c.lastBar && !c.isLast && sec.length >= 4 && ctx.level === 1 && spec.pat && spec.pat.fill) {
      // the genre's fill, or (drum set) another fill of the same length — every fill of the song can differ
      const FR = U().makeRand(ctx.seed ^ U().hash('fill|' + sec.start));
      const f = set && FR.chance(0.6) ? Object.assign({ kick: spec.pat.fill.kick || '' }, FR.pick(DRUM_FILLS)) : spec.pat.fill;
      if (set) ['hhc', 'hho', 'ride'].forEach(r => { for (let p = 8; p < 16; p++) rows[r][p] = 0; });
      Object.keys(f).forEach(row => { if (!rows[row]) return; for (let p = 8; p < 16; p++) { const v = VEL[f[row][p]]; if (v) rows[row][p] = v; } });
    }
    // final bar of the song: one big hit
    if (c.finalBar) {
      const had = Object.keys(rows).filter(r => rows[r].some(v => v > 0));
      Object.keys(rows).forEach(r => rows[r].fill(0));
      if (set) { rows.kick[0] = 1; rows.crash[0] = 1; }
      else if (had.length) rows[had[0]][0] = 1;
    }
    return rows;
  }
  // second half of the bar (steps 8–15) of a fill on a drum set
  const DRUM_FILLS = [
    { snare: '........x.x.X.X.', tom1: '................', tom2: '..............X.' },
    { snare: '........XxXx....', tom1: '............Xx..', tom2: '..............XX' },
    { snare: '........x..x..X.', tom1: '..........X.....', tom2: '.............X.X' },
    { snare: '........X.x.x.xx', tom1: '................', tom2: '...............X' },
    { snare: '............xxxx', tom1: '........X.X.....', tom2: '................' },
    { snare: '........x.......', tom1: '..........x.X...', tom2: '.............XX.' }
  ];
  /**
   * Variations a drummer adds to the genre groove. They are chosen per SECTION TYPE (every verse
   * of a song has the same variation, so the form stays clear), and change with the idea:
   * 16th hi-hats in loud sections, an open hi-hat on the "and" of 4, a syncopated kick, ghost notes.
   * Swing styles keep their ride / hi-hat (no straight 16ths).
   */
  function drumVariation(rows, c) {
    const { ctx, type, k } = c;
    const V = U().makeRand(ctx.seed ^ U().hash('drumvar|' + type));
    const swing = ctx.style && ctx.style.swing > 0;
    const hat = rows.hhc && rows.hhc.some(v => v > 0);
    const busy = ['chorus', 'solo', 'pre'].includes(type);
    if (!swing && hat && busy && V.chance(0.4)) for (let p = 1; p < 16; p += 2) if (!rows.hhc[p] && rows.hhc[p - 1] > 0 && !rows.hho[p]) rows.hhc[p] = 0.32;
    const openOn = !swing && hat && V.chance(0.45), openBar = V.int(0, 1);
    if (openOn && k % 2 === openBar && rows.hho) { rows.hhc[14] = 0; rows.hho[14] = 0.62; }
    const kp = V.pick([null, null, 3, 6, 10, 11, 14]), kBar = V.int(0, 1);
    if (kp !== null && rows.kick && k % 2 === kBar && !rows.kick[kp] && !(rows.snare && rows.snare[kp] > 0.5)) rows.kick[kp] = 0.68;
    if (rows.snare && V.chance(0.5)) V.pick([[7], [15], [7, 15], [10], [3, 11]]).forEach(p => { if (!rows.snare[p] && !(rows.kick && rows.kick[p])) rows.snare[p] = 0.22; });
  }
  /**
   * Latin percussion keeps its genre pattern (the clave is never touched); the player only varies
   * the ghost strokes (per section type, so repeats stay repeats) and plays a short roll into the
   * next section — both chosen by the idea / seed.
   */
  function percVariation(rows, c) {
    const { ctx, type, k, spec } = c;
    const V = U().makeRand(ctx.seed ^ U().hash('percvar|' + type + '|' + (spec.kit || '')));
    const live = Object.keys(rows).filter(r => rows[r].filter(v => v > 0).length >= 3);
    if (!live.length) return;
    const r = V.pick(live), bar2 = V.int(0, 1), free = [];
    for (let p = 1; p < 16; p += 2) if (!rows[r][p]) free.push(p);
    if (free.length && k % 2 === bar2) { const n = V.int(1, Math.min(2, free.length)); for (let i = 0; i < n; i++) { const p = free.splice(V.int(0, free.length - 1), 1)[0]; rows[r][p] = 0.3; } }
    const weak = rows[r].map((v, p) => (v > 0 && v < 0.5 && p % 4 ? p : -1)).filter(p => p >= 0);
    if (weak.length > 2 && V.chance(0.4) && k % 2 !== bar2) rows[r][V.pick(weak)] = 0;
    // a short roll into the next section (last bar, no fill of the genre)
    if (c.lastBar && !c.isLast && !(spec.pat && spec.pat.fill) && c.sec.length >= 4 && V.chance(0.7)) {
      const R2 = U().makeRand(ctx.seed ^ U().hash('roll|' + c.sec.start + '|' + (spec.kit || '')));
      const rr = ['tom1', 'tom2'].filter(x => rows[x] && rows[x].some(v => v > 0));
      const rowA = rr[0] || r, rowB = rr[1] || rowA;
      const steps = R2.pick([[12, 13, 14, 15], [12, 14, 15], [13, 14, 15], [10, 12, 14, 15]]);
      steps.forEach((p, i) => { Object.keys(rows).forEach(x => { if (x !== 'perc') rows[x][p] = 0; }); rows[i % 2 ? rowB : rowA][p] = 0.55 + i * 0.12; });
    }
  }
  function prevType(ctx, sec) { const l = ctx.an.sections.list, i = l.indexOf(sec); return i > 0 ? l[i - 1].type : null; }

  /* ----------------------------------------------------------- bass --- */
  function nearPc(pc, ref, lo, hi) {
    let best = null;
    for (let p = lo; p <= hi; p++) if (((p % 12) + 12) % 12 === pc && (best === null || Math.abs(p - ref) < Math.abs(best - ref))) best = p;
    return best === null ? lo + pc : best;
  }
  function bassBar(c) {
    const { ctx, spec, bar, R, type, play } = c;
    const an = ctx.an, lo = 28, hi = 55;
    const out = [];
    const prev = () => ctx.prevBass || 38;
    const push = (p, len, pitch, vel) => {
      const n = { start: p, dur: Math.max(1, Math.min(len, 16 - p)), pitch, vel: Math.round(Math.min(127, vel)), tech: {} };
      const fp = SDAW.autoFretBass(pitch); if (fp && ctx.track.engine === 'bass') { n.string = fp.string; n.fret = fp.fret; }
      out.push(n); ctx.prevBass = pitch;
    };
    if (c.finalBar) { const ch = an.chordAt(bar * BAR); push(0, 16, nearPc(ch.bass !== undefined ? ch.bass : ch.root, prev(), lo, hi - 7), ctx.baseVel + 8); return out; }
    if (unisonBar(c, push, lo, hi)) return out;
    if (play === 'walking' && ctx.level === 1) {
      for (let b = 0; b < 4; b++) {
        const tick = bar * BAR + b * 4, ch = an.chordAt(tick);
        const changeHere = b === 0 || an.chordAt(tick - 1).name !== ch.name;
        const nextCh = an.chordAt(tick + 4), changeNext = nextCh.name !== ch.name || b === 3;
        let p;
        if (changeHere) p = nearPc(ch.bass !== undefined ? ch.bass : ch.root, prev(), lo, 50);
        else if (changeNext) { const tgt = nearPc(nextCh.root, prev(), lo + 1, 50); p = tgt + (prev() > tgt ? 1 : -1); if (p === prev()) p = tgt + (p > tgt ? -2 : 2); }
        else { const tones = ch.intervals.slice(1, 3).map(iv => nearPc((ch.root + iv) % 12, prev(), lo, 50)); p = R.pick(tones); if (p === prev()) p = tones.find(x => x !== p) || p + 2; }
        push(b * 4, 4, U().fold(p, lo, 52), ctx.baseVel + (b === 0 ? 8 : 0) + R.range(-4, 4));
      }
      return out;
    }
    let str = play === 'walking' ? DEF.roots.verse : (pick(spec.p && spec.p[play], type) || pick(DEF[play], type) || DEF.style.verse);
    let toks = str.split(/\s+/).filter(Boolean).map(t => { const [p, tok, len] = t.split(':'); return { p: +p, tok, len: +len }; });
    if (ctx.level === 0.5) toks = toks.filter(t => t.p === 0 || t.p === 8).map(t => Object.assign(t, { len: 8 }));
    if (!toks.length) toks = [{ p: 0, tok: 'R', len: 8 }, { p: 8, tok: 'R', len: 8 }];
    const bases = {};      // one octave per chord inside the bar (the figure does not jump around)
    toks.forEach(t => {
      const tick = bar * BAR + t.p, ch = an.chordAt(tick), nextCh = an.chordAt((bar + 1) * BAR);
      const base = bases[ch.name] !== undefined ? bases[ch.name] : (bases[ch.name] = nearPc(ch.root, prev(), lo, Math.min(hi - 10, 45)));
      let pitch = base;
      if (ch.bass !== undefined && (t.tok === 'R' || t.p === 0)) pitch = nearPc(ch.bass, base, lo, hi - 7);   // slash chord: C/E plays E
      else switch (t.tok) {
        case '5': pitch = base + (ch.intervals[2] || 7); break;
        case '3': pitch = base + (ch.intervals[1] || 4); break;
        case 'b7': pitch = base + (ch.intervals[3] || 10); break;
        case '6': pitch = base + 9; break;
        case '2': pitch = base + 2; break;
        case '4': pitch = base + 5; break;
        case '8': pitch = base + 12; break;
        case 'N': pitch = nearPc(nextCh.root, prev(), lo, hi - 7); break;
        case 'A': { const tg = nearPc(nextCh.root, base, lo, hi - 5); pitch = tg === base ? base + 7 : tg + (tg > base ? -1 : 1); break; }
        default: pitch = base;
      }
      push(t.p, t.len, U().fold(pitch, lo, hi), ctx.baseVel + (t.p === 0 ? 8 : 0) + (t.p % 4 === 0 ? 3 : -2) + R.range(-3, 3));
    });
    return out;
  }

  /**
   * Bass riffs in unison with the guitar (band profiles: bass spec.unison = { section: chance }): the bass
   * doubles the riff of the rhythm guitar an octave lower — its lowest note of every hit, same rhythm.
   * The guitar's riff is computed exactly as the guitar track computes it (same seed), so both play the
   * same figure. The idea (seed) decides per section type whether the bass doubles there.
   */
  function unisonBar(c, push, lo, hi) {
    const { ctx, spec, type } = c;
    if (!spec.unison || !spec.unison[type] || ctx.level !== 1 || !SDAW.legends) return false;
    if (!U().makeRand(((ctx.opts && ctx.opts.seed) >>> 0 || 1) ^ U().hash('unison|' + type)).chance(spec.unison[type])) return false;
    const gs = (ctx.style && ctx.style.tracks || []).find(t => t.id === (spec.unisonWith || 'rhythm'));
    if (!gs || (gs.in && gs.in[type] === 0)) return false;
    const gt = SDAW.store.song.tracks.find(t => t.styleTrack === gs.id);
    if (!gt) return false;
    const gctx = Object.assign({}, ctx, { track: gt, role: gs.role, seed: (((ctx.opts && ctx.opts.seed) >>> 0) || 1) ^ U().hash(gt.name + gs.role) });
    let notes = null;
    try { notes = SDAW.legends.rhythmBar(Object.assign({}, c, { ctx: gctx, spec: gs }), gt.play || gs.play || 'bandriff'); } catch (e) { notes = null; }
    if (!notes || !notes.length) return false;
    const low = {};
    notes.forEach(n => { if (!(n.tech && n.tech.harm) && (!low[n.start] || n.pitch < low[n.start].pitch)) low[n.start] = n; });
    const hits = Object.values(low).sort((a, b) => a.start - b.start);
    if (hits.length < 2) return false;
    hits.forEach(n => push(n.start, n.dur, U().fold(n.pitch - 12, lo, hi - 7), ctx.baseVel + (n.start === 0 ? 8 : n.start % 4 === 0 ? 3 : -2) + (n.tech && n.tech.pm ? -6 : 0)));
    return true;
  }

  /* ---------------------------------------------- harmony & guitars --- */
  const shapeCache = {};
  function shape(ch) {
    const key = ch.name;
    if (!shapeCache[key]) shapeCache[key] = SDAW.chordVoicing(ch.root, ch.intervals.slice(0, 4));
    return shapeCache[key];
  }
  function strings(ch) { const f = shape(ch), out = []; f.forEach((fr, s) => { if (fr >= 0) out.push({ s, f: fr, pitch: CONFIG.guitar.tuning[s] + fr }); }); return out; }
  function voicing(ctx, ch) {
    const [lo, hi] = ctx.range;
    const v = U().voiceLead(ctx.prevVoicing, U().voicings(ch, lo, hi, ctx.opts.complexity || 0.4), lo, hi);
    if (v) ctx.prevVoicing = v;
    return v || [60, 64, 67];
  }
  /** Rootless jazz voicing (3-7-9 / 7-3-13 family) near the previous one */
  function rootless(ctx, ch) {
    const t = ch.type, r = ch.root;
    const sets = t.includes('maj') ? [[4, 7, 11, 14], [11, 14, 16, 19]] : t === 'm7b5' ? [[3, 6, 10, 12], [10, 12, 15, 18]] : t === 'dim7' || t === 'dim' ? [[0, 3, 6, 9]]
      : t.startsWith('m') ? [[3, 7, 10, 14], [10, 14, 15, 19]] : (ch.intervals.includes(10) ? [[4, 9, 10, 14], [10, 14, 16, 21]] : [[4, 7, 9, 14], [9, 14, 16, 19]]);
    const cands = [];
    sets.forEach(set => { for (let base = 48; base < 60; base++) if (base % 12 === r) { const v = set.map(i => base + i); if (v[0] >= 50 && v[3] <= 76) cands.push(v); if (v[0] - 12 >= 50) cands.push(v.map(x => x - 12)); } });
    const v = U().voiceLead(ctx.prevVoicing, cands.length ? cands : [voicing(ctx, ch)], 50, 76);
    ctx.prevVoicing = v;
    return v;
  }
  const JAZZ_RHYTHMS = ['0:3 6:2', '2:2 10:3', '6:2 14:2:N', '0:2 8:2 14:2:N', '4:3 12:2', '0:3 10:2', '6:3 12:2'];

  function compBar(c) {
    const { ctx, spec, bar, R, type } = c;
    let play = c.play;
    const an = ctx.an, gtr = ctx.track.type === 'guitar';
    const out = [];
    const t0 = bar * BAR;
    const vel0 = ctx.baseVel - 8;
    const chAt = p => an.chordAt(t0 + p);
    const addKeys = (p, len, pitches, vel, tech) => pitches.forEach((pt, i) => out.push({ start: p, dur: Math.max(1, Math.min(len, 16 - p)), pitch: pt, vel: Math.round(Math.max(25, Math.min(120, vel - (i ? 5 : 0)))), tech: Object.assign({}, tech || {}) }));
    const addStr = (p, len, list, vel, tech) => list.forEach((x, i) => out.push({ start: p, dur: Math.max(1, Math.min(len, 16 - p)), pitch: x.pitch, string: x.s, fret: x.f, vel: Math.round(Math.max(25, Math.min(120, vel - i * 1.5))), tech: Object.assign({}, tech || {}) }));
    const durTo = (str, i) => { let j = i + 1; while (j < str.length && str[j] === '.') j++; return j - i; };
    const strOf = s => s && s.length >= 32 ? s.slice((c.k % 2) * 16, (c.k % 2) * 16 + 16) : (s || '');

    // final bar of the song: one long chord
    if (c.finalBar) {
      const ch = chAt(0);
      if (gtr) addStr(0, 16, strings(ch), vel0 + 6, { strum: 'down', ring: true });
      else addKeys(0, 16, voicing(ctx, ch), vel0 + 4);
      return out;
    }
    // sparse level: long chords only
    if (ctx.level === 0.5) play = gtr ? 'strumSparse' : 'pad';

    switch (play) {
      case 'pad': {
        let p = 0;
        while (p < 16) { const ch = chAt(p); let q = p + 1; while (q < 16 && chAt(q).name === ch.name) q++; addKeys(p, q - p, voicing(ctx, ch), vel0 - (ctx.level === 0.5 ? 14 : 4)); p = q; }
        break;
      }
      case 'strumSparse': { [0, 8].forEach(p => { if (p === 8 && chAt(8).name === chAt(0).name) return; addStr(p, p ? 8 : (chAt(8).name === chAt(0).name ? 16 : 8), strings(chAt(p)), vel0 - 6, { strum: 'down', ring: true }); }); break; }
      case 'chords': {
        const toks = (pick(spec.p && spec.p.chords, type) || pick(DEF.chords, type)).split(/\s+/).filter(Boolean).map(t => t.split(':'));
        toks.forEach(([ps, ls, n]) => {
          const p = +ps, len = +ls;
          const ch = n === 'N' ? an.chordAt((bar + 1) * BAR) : chAt(p);
          const segs = (!n && p < 8 && p + len > 8 && chAt(8).name !== ch.name) ? [[p, 8 - p, ch], [8, p + len - 8, chAt(8)]] : [[p, len, ch]];
          segs.forEach(([sp, sl, sc]) => {
            const v = vel0 + an.rhythm.accent[sp % 16] * 8 + R.range(-3, 3);
            if (gtr) addStr(sp, sl, strings(sc).filter(x => x.s >= 2), v, sl <= 1 ? { stacc: true } : {});
            else addKeys(sp, sl, voicing(ctx, sc), v, sl <= 1 ? { stacc: true } : {});
          });
        });
        break;
      }
      case 'arp': {
        const str = strOf(pick(spec.p && spec.p.arp, type) || pick(DEF.arp, type));
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const d = parseInt(ch, 10); if (isNaN(d)) continue;
          const chord = chAt(i), len = durTo(str, i);
          if (gtr) { const list = strings(chord); const x = list[d % list.length]; if (x) addStr(i, Math.max(len, 2), [x], vel0 - 4 + (i % 4 === 0 ? 6 : 0), { ring: true }); }
          else {
            const v = voicing(ctx, chord);
            const bass = nearPc(chord.root, 48, 43, 54);
            const list = [bass].concat(v.filter(p => p > bass));
            addKeys(i, Math.min(Math.max(len, 2), 6), [list[d % list.length]], vel0 - 4 + (i % 4 === 0 ? 6 : 0));
          }
        }
        break;
      }
      case 'montuno': case 'montuno-light': {
        /* Salsa montuno played like a real pianist: BLOCKS in octaves
         *   A = octave on a chord tone with one chord tone inside   (e.g. E·G·E)
         *   B = the same block one chord tone higher                 (e.g. G·C·G)
         *   N = block A of the NEXT chord, anticipated (locks with the tumbao bass)
         * The top line only moves between two neighbouring chord tones, so it
         * sounds like one sung line, not an arpeggio.                                 */
        const str = strOf(pick(spec.p && spec.p[play], type) || DEF[play].verse);
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const chord = ch === 'N' ? an.chordAt((bar + 1) * BAR) : chAt(i);
          const pcs = chord.intervals.slice(0, 3).map(x => (chord.root + x) % 12);   // triad: clearer, less heavy
          // top note of block A: the chord tone nearest to the previous top (smooth line)
          const ref = ctx.montunoTop || 74;
          let top = null;
          for (let p = 69; p <= 79; p++) if (pcs.includes(p % 12) && (top === null || Math.abs(p - ref) < Math.abs(top - ref))) top = p;
          if (ch === 'B') { let up = top + 1; while (!pcs.includes(up % 12)) up++; top = up > 81 ? top : up; }
          else ctx.montunoTop = top;
          let inner = top - 1; while (!pcs.includes(((inner % 12) + 12) % 12) || top - inner < 3) inner--;
          const len = Math.min(durTo(str, i), 2);
          const vel = vel0 - 10 + (ch === 'N' ? 6 : 0) + (i % 4 === 0 ? 3 : 0) + R.range(-3, 3);
          addKeys(i, len, [top - 12, inner, top], vel, len <= 1 ? { stacc: true } : {});
        }
        break;
      }
      case 'jazz': {
        const rh = R.pick(JAZZ_RHYTHMS);
        rh.split(' ').forEach(t => { const [ps, ls, n] = t.split(':'); const p = +ps; const chord = n === 'N' ? an.chordAt((bar + 1) * BAR) : chAt(p); addKeys(p, +ls, rootless(ctx, chord), vel0 - 2 + R.range(-6, 6)); });
        break;
      }
      case 'strum': case 'boomchick': {
        const str = strOf(pick(spec.p && spec.p[play], type) || pick(DEF[play], type));
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const list = strings(chAt(i)), len = durTo(str, i);
          if (ch === 'D') addStr(i, len, list, vel0 + (i % 4 === 0 ? 6 : 0), { strum: 'down' });
          else if (ch === 'U') addStr(i, len, list.filter(x => x.s >= 2), vel0 - 10, { strum: 'up' });
          else if (ch === 'd' || ch === 'u' || ch === 'x') addStr(i, 1, list, vel0 - 30, { strum: ch === 'u' ? 'up' : 'down', mute: true });
          else if (ch === 'B') addStr(i, len, list.slice(0, 1), vel0 + 4, {});
          else if (ch === 'b') addStr(i, len, list.slice(1, 2), vel0 + 2, {});
        }
        break;
      }
      case 'power': {
        const str = strOf(pick(spec.p && spec.p.power, type) || pick(DEF.power, type));
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const root = chAt(i).root, tun = CONFIG.guitar.tuning;
          let s = 0, f = ((root - tun[0]) % 12 + 12) % 12;
          if (f > 7) { s = 1; f = ((root - tun[1]) % 12 + 12) % 12; }
          const list = [{ s, f, pitch: tun[s] + f }, { s: s + 1, f: f + 2, pitch: tun[s + 1] + f + 2 }, { s: s + 2, f: f + 2, pitch: tun[s + 2] + f + 2 }];
          const len = durTo(str, i);
          if (ch === 'P') addStr(i, Math.min(len, 2), list.slice(0, 2), vel0 + 2, { pm: true });
          else addStr(i, len, list, vel0 + (ch === 'O' ? 14 : 4), {});
        }
        break;
      }
      case 'funk': {
        const str = strOf(pick(spec.p && spec.p.funk, type) || DEF.funk.verse);
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const list = strings(chAt(i)).filter(x => x.s >= 2);
          if (ch === 'X') addStr(i, 1, list, vel0 + 10, { stacc: true, strum: i % 2 ? 'up' : 'down' });
          else addStr(i, 1, list, vel0 - 30, { mute: true, strum: i % 2 ? 'up' : 'down' });
        }
        break;
      }
      case 'bossa': {
        const str = strOf(pick(spec.p && spec.p.bossa, type) || DEF.bossa.verse);
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (!ch || ch === '.') continue;
          const list = strings(chAt(i)), len = Math.min(durTo(str, i), 3);
          const bass = i < 8 ? list[0] : (list[1] || list[0]);
          if (ch === 'B' || ch === 'X') addStr(i, i < 8 ? 6 : 6, [bass], vel0 + 2, {});
          if (ch === 'C' || ch === 'X') addStr(i, len, list.slice(-4).filter(x => x !== bass), vel0 - 4, {});
        }
        break;
      }
      case 'shuffle': {
        for (let q = 0; q < 4; q++) {
          const root = chAt(q * 4).root, tun = CONFIG.guitar.tuning;
          let s = 0, f = ((root - tun[0]) % 12 + 12) % 12;
          if (f > 7) { s = 1; f = ((root - tun[1]) % 12 + 12) % 12; }
          const up = q % 2 ? 4 : 2;
          const pair = [{ s, f, pitch: tun[s] + f }, { s: s + 1, f: f + up, pitch: tun[s + 1] + f + up }];
          [0, 2].forEach(o => addStr(q * 4 + o, 2, pair, vel0 + (o ? -6 : 4), { pm: true }));
        }
        break;
      }
      default: {
        // riffs and rhythm styles of the great guitarists (legends.js)
        const lg = SDAW.legends && SDAW.legends.RHYTHMS[play] ? SDAW.legends.rhythmBar(c, play) : null;
        if (lg) return lg;
        addKeys(0, 16, voicing(ctx, chAt(0)), vel0);
      }
    }
    return out;
  }

  /* ======================================================= FULL SONG == */

  /** Default options of a genre (used by the welcome screen and the panel) */
  /** A new idea: a random seed (1 … 999 999). The seed is saved in the song (song.gen) */
  SG.newSeed = function () {
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % 999999); } catch (e) { return 1 + Math.floor(Math.random() * 999999); }
  };
  /**
   * Default options of a genre. Every call brings a NEW seed (a new composition);
   * pass `seed` to rebuild a known one. The welcome screen also varies the key and
   * the tempo inside the genre (SG.variedDefaults) so quick songs do not all sound alike.
   */
  /* ---- styles with song types (band profiles, bands.js) ----
   * style.types = { id: { n, w (weight), set: { tempo, mode, structures, vocal… }, tracks: { trackId: overrides } } }
   * A progression tagged P(..., t) belongs only to those types. opts.songType = a type id, or 'auto' (the idea picks). */
  SG.typeOf = function (st, opts) {
    if (!st || !st.types) return null;
    const ids = Object.keys(st.types);
    if (opts && opts.songType && st.types[opts.songType]) return opts.songType;
    return U().makeRand(U().hash('songtype|' + (((opts && opts.seed) >>> 0) || 1))).weighted(ids.map(id => [id, st.types[id].w || 1]));
  };
  SG.typedStyle = function (st, id) {
    const t = st.types && st.types[id]; if (!t) return st;
    const tracks = st.tracks.map(tr => t.tracks && t.tracks[tr.id] ? Object.assign({}, tr, t.tracks[tr.id]) : tr);
    const progs = st.progs.filter(p => !p.t || p.t.split(' ').includes(id));
    return Object.assign({}, st, t.set || {}, { tracks, progs, type: id, typeName: t.n });
  };
  /** The style a song is built with: the genre (or band), its song type, and the reference artist */
  SG.styleOf = function (opts) {
    let st = SDAW.STYLES[opts.genre] || SDAW.STYLES.Pop;
    if (st.types) st = SG.typedStyle(st, SG.typeOf(st, opts));
    if (opts.ref && !st.band) st = SG.applyRef(st, opts.ref, opts.mode, opts.seed || 1);
    return st;
  };
  SG.defaults = function (genre, seed, songType) {
    seed = seed || SG.newSeed();
    const base = SDAW.STYLES[genre] || SDAW.STYLES.Pop;
    const st = base.types ? SG.typedStyle(base, SG.typeOf(base, { seed, songType })) : base;
    if (st.band) {
      const mode = st.mode || 'major', tracks = {};
      st.tracks.forEach(t => { tracks[t.id] = { on: t.on !== false, inst: t.inst, play: t.play || null, fx: t.fx || 'Room' }; });
      const lead = st.tracks.find(t => t.lead) || {};
      return { genre, songType: songType && base.types && base.types[songType] ? songType : 'auto', key: SDAW.noteIndex(st.key[mode]), mode, tempo: st.tempo[2], structure: 'Standard', complexity: 1, density: 1, seed, progs: {}, tracks,
        vocals: st.vocal ? 'singer' : 'instrumental', voice: (st.vocal && st.vocal.gender) || 'auto', choir: st.vocal && st.vocal.voices !== undefined ? (st.vocal.voices ? String(st.vocal.voices) : 'none') : 'auto',
        leadPlan: Object.assign({}, st.leadPlan || {}),
        melody: Object.assign({ complex: false, fast: false, triplets: false, modes: false, slides: false, harmonics: false, bends: false, vibrato: true, hero: st.melody?.heroes?.[0] || 'auto' }, lead.mel || {}) };
    }
    const mode = st.mode || 'major';
    const tracks = {};
    st.tracks.forEach(t => { tracks[t.id] = { on: t.on !== false, inst: t.inst, play: t.play || null, fx: t.fx || 'Room' }; });
    const lead = st.tracks.find(t => t.lead) || {};
    return { genre, key: SDAW.noteIndex(st.key[mode]), mode, tempo: st.tempo[2], structure: 'Standard', complexity: 1, density: 1, seed, progs: {}, tracks,
      vocals: 'instrumental', voice: 'auto', choir: 'auto', leadPlan: {},
      melody: Object.assign({ complex: false, fast: false, triplets: false, modes: false, slides: false, harmonics: false, bends: false, vibrato: true, hero: 'auto' }, lead.mel || {}) };
  };


  // Editable starting points built from the existing band arrangements and lead vocabulary.
  const ARTIST_START = {
    malmsteen: ['Metal', 168, 1, 1, 'showcase'],
    satriani: ['Rock', 132, .9, .85, 'showcase'],
    vai: ['Rock', 128, 1, .9, 'showcase'],
    santana: ['Latin Rock', 118, .75, .65, 'hot'],
    vanhalen: ['Rock', 138, 1, .9, 'riffverse'],
    srv: ['Blues', 126, .85, .8, 'hot'],
    bbking: ['Blues', 82, .35, .3, 'song'],
    albert: ['Blues', 88, .45, .35, 'song'],
    gilmour: ['Rock', 76, .45, .3, 'song'],
    moore: ['Blues', 82, .7, .55, 'hot'],
    joepass: ['Jazz', 150, 1, 1, 'showcase']
  };
  SG.artistPreset = function (current, id) {
    const h = SDAW.legends?.HEROES[id];
    if (!h) {
      const plain = SDAW.deepCopy(current);
      plain.melody.hero = id;
      return plain;
    }
    const data = SDAW.styleData?.artists[h.data];
    const setting = ARTIST_START[id];
    const band = Object.keys(SDAW.STYLES).find(g => SDAW.STYLES[g].band && SDAW.STYLES[g].melody?.heroes?.includes(id));
    const genre = band || (h.chordScale ? 'Jazz' : setting?.[0]) || data?.genres?.[0] || current.genre;
    const base = SDAW.STYLES[genre] || SDAW.STYLES.Rock;
    const firstType = base.types && Object.keys(base.types)[0];
    const o = SG.defaults(SDAW.STYLES[genre] ? genre : 'Rock', current.seed, firstType);
    const gestures = JSON.stringify([h.sig, h.peak, h.fill]);
    const sparse = !!h.sparse;
    const activity = Math.max(.25, Math.min(1, (data?.lead?.notesPerBar || (sparse ? 7 : 17)) / 24));
    o.complexity = setting?.[2] ?? Math.round(Math.min(1, activity + (h.legato || 0) * .2) * 100) / 100;
    o.density = setting?.[3] ?? Math.round(activity * 100) / 100;
    o.tempo = setting?.[1] ?? data?.tempo?.[2] ?? o.tempo;
    o.melody = {
      hero: id, complex: o.complexity >= .65, fast: !sparse,
      triplets: h.chordScale || /t8|trip|bop|dsb/.test(gestures),
      modes: !!h.chordScale || /lydian|mixo|dorian|harmMinor/.test(JSON.stringify([h.scale, h.run])),
      slides: h.slide > 0, harmonics: /harm|pinch|dive/.test(gestures),
      bends: !h.chordScale && h.bend > 0, vibrato: !!h.vib
    };
    if (['malmsteen', 'satriani', 'vai'].includes(id)) Object.assign(o.melody, { fast: true, modes: true, harmonics: true });
    const instrumental = ['malmsteen', 'satriani', 'vai', 'santana'].includes(id) || h.chordScale;
    if (instrumental) { o.vocals = 'instrumental'; o.choir = 'none'; }
    if (id === 'joepass') Object.assign(o.melody, { triplets: true, slides: true, harmonics: true, modes: true });
    o.leadPlan = Object.assign({}, SG.LEAD_PRESETS[setting?.[4] || (instrumental ? 'showcase' : 'song')].plan);
    o.extras = [];
    o.ending = 'auto';
    return o;
  };
  SG.genrePreset = function (genre, seed, type) {
    const base = SDAW.STYLES[genre];
    const o = SG.defaults(genre, seed, type || (base.types && Object.keys(base.types)[0]));
    const hero = o.melody.hero;
    if (base.band || genre === 'Jazz') {
      const artist = SG.artistPreset(o, hero);
      // Keep the selected band and its arrangement, even when several bands share a guitarist.
      artist.genre = o.genre; artist.songType = o.songType;
      artist.key = o.key; artist.mode = o.mode; artist.tracks = o.tracks;
      if (!type) return artist;
      // An explicitly chosen ballad or other song type supplies its own arrangement.
      artist.tempo = o.tempo; artist.mode = o.mode; artist.key = o.key;
      artist.songType = o.songType; artist.tracks = o.tracks;
      artist.leadPlan = o.leadPlan; artist.vocals = o.vocals; artist.choir = o.choir;
      return artist;
    }
    o.extras = []; o.ending = 'auto';
    return o;
  };

  /**
   * Defaults with a key and a tempo chosen by the seed, inside what suits the genre:
   * the key moves by a 4th, 5th or whole tone from the genre's usual key (guitar-friendly
   * keys stay guitar-friendly), the tempo stays inside the tempo range of the genre.
   */
  SG.variedDefaults = function (genre, seed, songType) {
    const o = SG.defaults(genre, seed, songType), st = SG.styleOf(o);
    const R = U().makeRand(o.seed ^ 0x6B3D);
    if (st.band) {
      const R = U().makeRand(U().hash('bandkey|' + o.seed));
      // a band: one of ITS keys and modes (st.keys = { major: [...], minor: [...] }, st.minor = share of minor songs)
      if (st.minor !== undefined) o.mode = R.next() < st.minor ? 'minor' : 'major';
      const ks = st.keys && st.keys[o.mode];
      o.key = SDAW.noteIndex(ks && ks.length ? R.pick(ks) : st.key[o.mode]);
      const [lo, hi, mid] = st.tempo;
      o.tempo = Math.round(Math.max(lo, Math.min(hi, mid + (R.next() * 2 - 1) * Math.min(mid - lo, hi - mid))));
      return o;
    }
    const guitarGenre = st.tracks.some(t => t.lead && /Guitar|Requinto/i.test(t.inst));
    const offs = guitarGenre ? [0, 0, 5, -5, 7, -2] : [0, 0, 5, -5, 7, 2, -2, 3];
    o.key = ((o.key + R.pick(offs)) % 12 + 12) % 12;
    const [lo, hi, mid] = st.tempo;
    o.tempo = Math.round(Math.max(lo, Math.min(hi, mid + (R.next() * 2 - 1) * Math.min(mid - lo, hi - mid, mid * 0.08))));
    return o;
  };

  /** Parse "Intro:4 Verse:8 Coro (Montuno):16" */
  SG.parseStructure = function (str) {
    const out = []; let bar = 0; const re = /([^:]+?):(\d+)/g; let m;
    while ((m = re.exec(str))) { const name = m[1].trim(), len = +m[2]; out.push({ name, length: len, start: bar, type: SDAW.autogen.sectionType(name) }); bar += len; }
    return out;
  };

  /* ======================================================= ENDINGS == */
  /**
   * Jazz endings: the last bars of the song (one entry = one bar, "a-b" = two chords in the bar).
   * The last bar is the big final chord (held: drums, bass and piano play one long hit there).
   * The classic endings of the standards: tritone walk-down, bVI–bII–I, the "flat-five" chromatic
   * descent, the Lady Bird turnaround (bIII–bVI–bII), the 3× "tag" of the last ii–V, the backdoor
   * (iv–bVII), landing on a 6/9, a maj9, a maj13 or a maj7(#11) instead of a plain major 7th.
   */
  SG.JAZZ_ENDINGS = {
    major: [
      { id: 'walkdown', n: 'Tritone walk-down → 6/9', bars: ['iii7-biii7', 'ii7-bII7', 'I69'] },
      { id: 'b6b2', n: 'bVI – bII – I maj7(#11)', bars: ['ii7', 'V7b9', 'bVImaj7-bIImaj7', 'Imaj7#11'] },
      { id: 'flat5', n: 'Flat-five chromatic descent → maj9', bars: ['#ivø-ivm7', 'iii7-biiio7', 'ii7-V7b9', 'Imaj9'] },
      { id: 'ladybird', n: 'Lady Bird (bIII – bVI – bII) → maj9', bars: ['Imaj7-bIIImaj7', 'bVImaj7-bIImaj7', 'Imaj9'] },
      { id: 'tag', n: 'Tag ending (last ii–V three times) → 6/9', bars: ['iii7-VI7', 'ii7-V7', 'iii7-VI7', 'ii7-V7', 'iii7-VI7', 'ii7-bII7', 'I69'] },
      { id: 'backdoor', n: 'Backdoor (iv – bVII) → maj13', bars: ['IVmaj7', 'ivm7-bVII7', 'Imaj13'] }
    ],
    minor: [
      { id: 'mii', n: 'Minor ii – V → m6/9', bars: ['iiø', 'V7b9', 'im69'] },
      { id: 'mb6b2', n: 'bVI – bII – i(maj7)', bars: ['bVImaj7', 'bIImaj7', 'iiø-V7#9', 'imMaj7'] },
      { id: 'mline', n: 'Line cliché → m6/9', bars: ['im7-imMaj7', 'im7-im6', 'iiø-V7b9', 'im69'] },
      { id: 'mtag', n: 'Minor tag (ii–V three times) → m9', bars: ['iiø-V7b9', 'im7-im7', 'iiø-V7b9', 'iiø-bII7', 'im9'] }
    ]
  };
  /** the ending of a song: null = the normal outro (its last chord on the tonic) */
  SG.endingFor = function (opts, st) {
    const want = opts.ending || 'auto';
    if (want === 'tonic' || (want === 'auto' && st.ending !== 'jazz')) return null;
    const list = SG.JAZZ_ENDINGS[opts.mode === 'minor' ? 'minor' : 'major'];
    return list.find(e => e.id === want) || U().makeRand(((opts.seed >>> 0) || 1) ^ U().hash('jazzend|' + opts.genre)).pick(list);
  };

  /* ============================================= EXTRA INSTRUMENTS == */
  /** what can be added to any band (Full Song panel → "＋ Add instrument") */
  SG.EXTRA_KINDS = {
    counter: { n: 'Counter-melody (answers the lead)', role: 'counter', list: 'lead', in: { intro: 0.5, solo: 0 } },
    second: { n: '2nd voice of the lead (3rds / 6ths)', role: 'horn2', list: 'lead', play: 'harmony', needsLead: true, in: { intro: 0, solo: 0 } },
    riffs: { n: 'Horn riffs (2-bar figures)', role: 'horns', list: 'lead', play: 'riffs', in: { intro: 0.5, verse: 0.5 } },
    chords: { n: 'Chords (rhythm)', role: 'harmony', list: 'keys', play: 'chords' },
    pad: { n: 'Pad (sustained chords)', role: 'harmony', list: 'pad', play: 'pad' },
    arp: { n: 'Arpeggio', role: 'arp', list: 'keys' },
    strum: { n: 'Strummed guitar', role: 'strum', list: 'guitar', play: 'strum' }
  };
  /** every Latin / auxiliary percussion of the library (Güiro, Congas, Bongó, Maracas, Claves, Güira, Tambora…) */
  SG.percussionList = function () {
    const out = [], seen = new Set();
    Object.keys(SDAW.STYLES).forEach(g => SDAW.STYLES[g].tracks.forEach(t => {
      if (t.role !== 'drums' || /^set/.test(t.kit || '') || seen.has(t.inst)) return;
      seen.add(t.inst);
      out.push({ id: 'perc:' + g + ':' + t.id, n: t.name + ' (' + g + ' pattern)', inst: t.inst });
    }));
    return out;
  };
  /** an extra instrument of the panel → a band spec (the same format as the tracks of styles.js) */
  SG.extraSpec = function (x, st, n) {
    if (/^perc:/.test(x.kind)) {
      const parts = x.kind.split(':'), src = SDAW.STYLES[parts[1]] && SDAW.STYLES[parts[1]].tracks.find(t => t.id === parts[2]);
      return src ? Object.assign(SDAW.deepCopy(src), { id: x.id, on: true, extra: true }) : null;
    }
    const K = SG.EXTRA_KINDS[x.kind]; if (!K) return null;
    const lead = st.tracks.find(t => t.lead);
    if (K.needsLead && !lead) return null;
    const sp = { id: x.id, name: x.inst + ' (' + K.n.replace(/ \(.*\)/, '').toLowerCase() + ')', role: K.role, inst: x.inst, on: true, vol: 0.55, pan: n % 2 ? -0.35 : 0.35, fx: 'Room', extra: true };
    if (K.play) sp.play = K.play;
    if (K.in) sp.in = Object.assign({}, K.in);
    if (K.role === 'horn2') sp.leadOf = lead.id;
    return sp;
  };

  /* ===================================================== LEAD PLAN == */
  /** what the lead plays in each section ("auto" everywhere = the genre's normal way: theme + solo) */
  SG.LEAD_MODES = [['auto', 'Auto (the genre decides)'], ['melody', 'Melody — a singable theme'], ['solo', 'Solo — fast runs, licks, riffs'], ['riff', 'Riff — a repeated phrase / lick'], ['fills', 'Answers — short fills'], ['rest', 'Silent']];
  SG.LEAD_SECTIONS = [['intro', 'Intro'], ['verse', 'Verses'], ['pre', 'Pre-chorus'], ['chorus', 'Chorus'], ['bridge', 'Bridge'], ['solo', 'Solo'], ['outro', 'Outro']];
  SG.LEAD_PRESETS = {
    song: { n: 'Song: melody, solo only in the solo (default)', plan: {} },
    showcase: { n: 'Instrumental showcase: solo dynamics after the intro', plan: { intro: 'melody', verse: 'solo', pre: 'solo', chorus: 'solo', bridge: 'solo', solo: 'solo', outro: 'melody' } },
    riffverse: { n: 'Riffs in the verses, melody in the chorus', plan: { verse: 'riff', pre: 'riff', chorus: 'melody', bridge: 'melody', solo: 'solo' } },
    hot: { n: 'Melody in the verses, licks in the chorus', plan: { verse: 'melody', pre: 'riff', chorus: 'solo', bridge: 'riff', solo: 'solo' } }
  };
  SG.planActive = plan => !!plan && Object.keys(plan).some(k => plan[k] && plan[k] !== 'auto');

  /* ======================================================= VOCALS == */
  /**
   * The vocal plan of a song (null = instrumental). Decided from the options and
   * the seed, so every new idea can bring another voice, choir and arrangement:
   *   { gender, choirMode, voices, singer: spec, choir: [specs] }
   */
  SG.MALE_LEAN = { Rock: 0.7, Blues: 0.75, Bolero: 0.65, Salsa: 0.7, Merengue: 0.65, Bachata: 0.75, Reggaeton: 0.8, Cumbia: 0.6, Country: 0.6, Reggae: 0.7, Funk: 0.55 };
  SG.vocalPlan = function (opts) {
    const V = SDAW.vocals;
    if (opts.vocals !== 'singer' || !V || !V.supports(opts.genre)) return null;
    const R = U().makeRand(U().hash('vocal plan|' + opts.genre + '|' + (opts.seed || 1)));
    const sv = SG.styleOf(opts).vocal || {};
    const gender = opts.voice === 'male' || opts.voice === 'female' ? opts.voice : sv.gender || (R.next() < (SG.MALE_LEAN[opts.genre] || 0.5) ? 'male' : 'female');
    let voices = opts.choir === 'none' ? 0 : opts.choir === 2 || opts.choir === '2' ? 2 : opts.choir === 3 || opts.choir === '3' ? 3 : sv.voices !== undefined ? sv.voices : R.pick([2, 2, 3]);
    let choirMode = voices ? V.chooseChoir(opts.genre, opts.seed || 1) : null;
    const singer = { id: 'vox', name: 'Lead Vocal', role: 'vocal', inst: gender === 'female' ? 'Female Vocal' : 'Lead Vocal', vol: 0.9, pan: 0, fx: 'Vocal Plate',
      range: (sv.range && sv.gender === gender ? sv.range : V.ranges[gender]).slice(), in: { intro: 0, solo: 0 } };
    const choir = [];
    const pans = [-0.4, 0.4, 0];
    for (let v = 1; v <= voices; v++) {
      choir.push({ id: 'bv' + v, name: 'Backing Vocal ' + v, role: 'choir', inst: choirMode === 'oohs' ? 'Choir Ooh' : 'Choir Aah', vol: choirMode === 'call' || choirMode === 'hook' ? 0.6 : 0.46,
        pan: pans[v - 1], fx: 'Choir Hall', range: gender === 'female' ? [53, 79] : [48, 74], voice: v, in: { intro: 0, solo: 0 } });
    }
    return { gender, voices, choirMode, singer, choir };
  };
  /** With a singer the soloists step back: answers in the vocal sections, a solo where there is none */
  SG.vocalForm = function (secs) {
    const hasSolo = secs.some(x => x.type === 'solo');
    const ch = secs.map((x, i) => x.type === 'chorus' ? i : -1).filter(i => i >= 0);
    if (hasSolo || ch.length < 2) return secs;
    const at = ch[ch.length - 1];
    const out = secs.slice(0, at).concat([{ name: 'Solo', length: 8, type: 'solo' }], secs.slice(at));
    let bar = 0;
    return out.map(x => { const y = Object.assign({}, x, { start: bar }); bar += x.length; return y; });
  };
  SG.VOCAL_SECTIONS = ['verse', 'pre', 'chorus', 'bridge', 'part'];
  SG.levelsWithSinger = function (inn) {
    const o = Object.assign({}, inn || {});
    const base = o.part !== undefined ? o.part : 1;
    SG.VOCAL_SECTIONS.forEach(t => { const v = o[t] !== undefined ? o[t] : base; o[t] = v > 0 ? 0.5 : 0; });
    return o;
  };

  /* ================================================= REFERENCE ARTIST == */
  /**
   * "Reference artist" (styledata.js): the band of the genre plays the way a real band of the
   * reference library plays — its drum grooves, bass lines and power-chord rhythms per section,
   * its progressions (offered first), and its guitarist on the lead. Only patterns the band uses in
   * at least two different songs exist in the library, so the song sounds like the band without
   * copying one of its songs. Everything else (form, instruments, sounds) stays the genre's.
   */
  SG.refArtists = function (genre) {
    const d = SDAW.styleData; if (!d) return [];
    return Object.keys(d.artists).map(id => { const a = d.artists[id]; return { id, name: a.name, fits: a.genres.includes(genre), songs: a.songs }; })
      .sort((x, y) => x.name.localeCompare(y.name));
  };
  SG.applyRef = function (st, ref, mode, seed) {
    const d = SDAW.styleData, a = d && ref && d.artists[ref];
    if (!a) return st;
    const RU = U(), SEC = ['intro', 'verse', 'pre', 'chorus', 'bridge', 'solo', 'outro'];
    // the band's pattern of a section: its own, else the verse's, else any (weighted pick among the most played)
    const pickSec = (obj, sec, min) => {
      const list = (obj && (obj[sec] || ((sec === 'pre' || sec === 'bridge') && obj.verse) || obj.part || obj.all)) || [];
      const top = list.slice(0, 3).filter(x => x[1] >= (min || 2));
      return top.length ? RU.makeRand(((seed >>> 0) || 1) ^ RU.hash('ref|' + ref + '|' + sec)).weighted(top.map(x => [x[0], x[1]])) : null;
    };
    const tracks = st.tracks.map(t => {
      if (t.role === 'drums' && /^set/.test(t.kit || '')) {
        const pat = Object.assign({}, t.pat);
        SEC.forEach(sec => {
          const g = pickSec(a.drums, sec); if (!g) return;
          const rows = {}; g.split('|').forEach((str, i) => { if (/[^.]/.test(str)) rows[['kick', 'snare', 'hhc', 'hho', 'ride'][i]] = str; });
          pat[sec] = rows;
        });
        return Object.assign({}, t, { pat });
      }
      if (t.role === 'bass' && (t.play || 'style') === 'style') {
        const style = {};
        SEC.forEach(sec => { const b = pickSec(a.bass, sec); if (b) style[sec] = b; });
        if (!Object.keys(style).length) return t;
        return Object.assign({}, t, { p: Object.assign({}, t.p, { style: Object.assign({}, (t.p && t.p.style) || {}, style) }) });
      }
      if (t.role === 'strum' && t.plays && t.plays.includes('power')) {
        const power = {};
        SEC.forEach(sec => { const c = pickSec(a.comp, sec); if (c) power[sec] = c; });
        if (!Object.keys(power).length) return t;
        const o = { p: Object.assign({}, t.p, { power: Object.assign({}, (t.p && t.p.power) || {}, power) }) };
        // the band's rhythms join the riff pool of every section (twice: they are the reference)
        if (t.mixPool) { o.mixPool = {}; SEC.forEach(sec => { o.mixPool[sec] = ['power', 'power'].concat(t.mixPool[sec] || t.mixPool.verse || []); }); }
        return Object.assign({}, t, o);
      }
      return t;
    });
    // progressions of the band first (the program picks the first one of a section half of the time)
    const short = a.name.replace(/\s*\(.*\)$/, ''), progs = [];
    const m = a.progs && a.progs[mode];
    if (m) Object.keys(m).forEach(sec => {
      const use = sec === 'part' ? 'verse chorus solo' : sec;
      m[sec].slice(0, 4).forEach(([c]) => { if (!progs.some(p => p.c === c && p.use === use)) progs.push({ n: '★ ' + short + ': ' + c, m: mode, use, c }); });
    });
    const hero = SDAW.legends && SDAW.legends.HEROES[a.hero] ? a.hero : null;
    return Object.assign({}, st, { tracks, progs: progs.concat(st.progs), ref,
      melody: hero ? Object.assign({}, st.melody, { heroes: [hero] }) : st.melody });
  };

  /** Build a new song object (does not touch the current song) */
  SG.createSong = function (opts) {
    // a band with song types and "Auto": the idea picks the type, and the type brings its line-up, tempo, key and mode
    const base0 = SDAW.STYLES[opts.genre];
    if (base0 && base0.types && !(opts.songType && base0.types[opts.songType])) {
      const d = SG.variedDefaults(opts.genre, opts.seed || 1, SG.typeOf(base0, opts));
      opts = Object.assign({}, opts, { songType: d.songType, tracks: d.tracks, tempo: d.tempo, key: d.key, mode: d.mode, leadPlan: SG.planActive(opts.leadPlan) ? opts.leadPlan : d.leadPlan, autoType: true });
    }
    let st = SG.styleOf(opts);
    // extra instruments of the panel join the band of the genre (only for this song)
    const extras = (opts.extras || []).map((x, i) => SG.extraSpec(x, st, i)).filter(Boolean);
    const trackOpts = Object.assign({}, opts.tracks);
    if (extras.length) {
      st = Object.assign({}, st, { tracks: st.tracks.concat(extras) });
      extras.forEach(sp => { trackOpts[sp.id] = { on: true, inst: sp.inst, play: sp.play || null, fx: sp.fx || 'Room' }; });
    }
    const s = SDAW.store, AG = SDAW.autogen;
    const song = s.newSong();
    if (SDAW.legends) SDAW.legends.lastHero = null;
    const keyRoot = opts.key, mode = opts.mode;
    song.title = opts.genre + ' Song';
    song.style = opts.genre;
    // the recipe of the song: the same options + seed rebuild the same composition ("Reuse this song's idea")
    song.gen = { by: 'songgen', v: 1, seed: opts.seed || 1, opts: SDAW.deepCopy(opts) };
    song.tempo = opts.tempo || st.tempo[2];
    song.key = SDAW.NOTE_NAMES[keyRoot]; song.scale = mode; song.keyFixed = true;
    song.swing = st.swing || 0; song.swingGrid = st.grid || 8;
    // 1. form
    const plan = SG.vocalPlan(opts);
    let secs = SG.parseStructure(st.structures[opts.structure] || st.structures.Standard);
    if (plan) secs = SG.vocalForm(secs);
    song.vocals = plan ? { gender: plan.gender, choir: plan.choirMode, voices: plan.voices } : null;
    const colors = AG.CONFIG.sectionColors;
    song.sections = secs.map(x => ({ id: SDAW.uid('s'), name: x.name, start: x.start, length: x.length, color: colors[x.type] || colors.part }));
    song.bars = secs.reduce((a, x) => a + x.length, 0);
    // 2. harmony
    const lens = {};
    secs.forEach(x => { const g = SG.groupOf(x.type); lens[g] = Math.max(lens[g] || 0, x.length); });
    const progs = SG.chooseProgs(st, mode, opts.progs, opts.seed || 1, lens);
    const flats = SG.prefersFlats(keyRoot, mode);
    song.chords = [];
    let last = null;
    const ending = SG.endingFor(opts, st), lastSec = secs[secs.length - 1];
    if (ending) song.gen.ending = ending.n;
    secs.forEach(x => {
      const toks = progs[SG.groupOf(x.type)].split(/\s+/).filter(Boolean);
      for (let b = 0; b < x.length; b++) {
        let tok = toks[b % toks.length];
        // jazz ending: the last bars of the song (as many as fit in the last section)
        const fromEnd = x === lastSec && ending ? x.length - b : 0;
        if (fromEnd && fromEnd <= ending.bars.length) tok = ending.bars[ending.bars.length - fromEnd];
        else if (x.type === 'outro' && b === x.length - 1 && !st.openEnding) {
          // the last chord of the song is the tonic: only the exact degree I / i, without accidental,
          // in root position (extensions such as Imaj7, I6, i7, I9 are kept). An open ending of the
          // style (st.openEnding) is respected.
          const parts = tok.split('-'), lastH = parts[parts.length - 1];
          if (!SG.isTonic(lastH, keyRoot)) { parts[parts.length - 1] = mode === 'minor' ? 'i' : 'I'; tok = parts.join('-'); }
        }
        tok.split('-').forEach((h, hi, arr) => {
          const name = SG.romanToName(h, keyRoot, flats);
          const tick = (x.start + b) * BAR + (arr.length > 1 ? hi * 8 : 0);
          if (name !== last) { song.chords.push({ tick, name }); last = name; }
        });
      }
    });
    // 3. band + 4. parts (the store temporarily points to the new song)
    const prev = s.song;
    s.song = song;
    try {
      const specs = st.tracks.filter(t => (trackOpts[t.id] || {}).on);
      specs.forEach(sp => { const o = trackOpts[sp.id]; const t = SG.makeTrackFor(Object.assign({}, sp, { fxChoice: o.fx, guitarEngine: opts.guitarEngine || 'rig' }), o.inst); t.play = o.play || sp.play || null; song.tracks.push(t); });
      if (plan) {
        // Leave headroom for the lead vocal in newly generated sung arrangements.
        song.tracks.forEach(t => { t.vol = Math.round(t.vol * 0.75 * 100) / 100; });
        [plan.singer].concat(plan.choir).forEach(sp => {
          specs.push(sp);
          song.tracks.push(SG.makeTrackFor(sp, sp.inst));
        });
      }
      const vox = plan ? song.tracks.find(x => x.styleTrack === 'vox') : null;
      const order = ['drums', 'bass', 'harmony', 'strum', 'arp', 'vocal', 'choir', 'melody', 'horns', 'counter', 'horn2'];
      const sorted = specs.slice().sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
      sorted.forEach(sp => {
        const t = song.tracks.find(x => x.styleTrack === sp.id);
        const lt = sp.leadOf ? song.tracks.find(x => x.styleTrack === sp.leadOf) : null;
        if (sp.role === 'horn2' && !lt) return;
        const leadish = ['melody', 'horns', 'counter'].includes(sp.role);
        const sing = sp.role === 'vocal' || sp.role === 'choir';
        // with a singer: lead instruments answer the voice (fills in its gaps), and play fully in intros / solos
        const levels = vox && leadish ? SG.levelsWithSinger(sp.in) : sp.in;
        AG.generateRaw({
          trackId: t.id, role: sp.role, style: st, genre: opts.genre, play: t.play, seed: opts.seed || 1,
          density: opts.density, complexity: opts.complexity, levels, range: sp.range,
          leadTrackId: sing && sp.role === 'choir' && vox ? vox.id : (lt ? lt.id : null), avoidTrackId: vox && leadish ? vox.id : null,
          voice: sp.voice || 0, choirMode: plan ? plan.choirMode : null, mode: 'replace', link: true, techniques: true,
          melody: leadish ? (sp.lead ? Object.assign({}, opts.melody, SG.planActive(opts.leadPlan) ? { plan: Object.assign({}, opts.leadPlan) } : {}) : Object.assign({}, opts.melody, sp.mel || {})) : null
        });
      });
    } finally { s.song = prev; }
    return song;
  };

  /** Replace the current song by a generated one (one undo step) */
  SG.generateFullSong = function (opts) {
    const s = SDAW.store;
    const song = SG.createSong(opts);
    s.beginEdit();
    // Use the same transport reset as opening a project (loop, pattern mode and pending playback).
    if (SDAW.app?.loadSong) SDAW.app.loadSong(song, true); else s.load(song, true);
    const v = song.vocals, CH = { harmony: 'harmonies', oohs: 'oohs', call: 'coro (call & response)', hook: 'gang hook' };
    const vx = v ? ' · ' + (v.gender === 'female' ? 'female' : 'male') + ' singer' + (v.voices ? ' + ' + v.voices + '-voice ' + CH[v.choir] : '') : '';
    const hero = SDAW.legends && SDAW.legends.lastHero ? ' · lead guitar in the style of ' + SDAW.legends.lastHero : '';
    const ra = opts.ref && SDAW.styleData && SDAW.styleData.artists[opts.ref];
    SDAW.toast('✨ ' + opts.genre + (ra ? ' (like ' + ra.name + ')' : '') + ' song in ' + SDAW.NOTE_NAMES[opts.key] + ' ' + opts.mode + ' · idea #' + (opts.seed || 1) + ': ' + song.tracks.length + ' tracks, ' + song.bars + ' bars' + vx + hero + ' — Ctrl+Z restores the previous song');
  };

  /* ================================================================ UI == */
  SG.last = null;
  SG.open = function (init) {
    const { el, $ } = SDAW;
    init = init || {};
    // the last options of the dialog, but always a NEW idea (seed); the buttons next to "Idea" bring back
    // the last idea or the recipe saved in the current song. From the welcome screen: the chosen genre.
    let o = init.genre && SDAW.STYLES[init.genre] ? SG.genrePreset(init.genre)
      : SG.last && SDAW.STYLES[SG.last.genre] ? SDAW.deepCopy(SG.last) : SG.genrePreset(SDAW.store.song.style && SDAW.STYLES[SDAW.store.song.style] ? SDAW.store.song.style : 'Salsa');
    o.seed = SG.newSeed();
    if (!o.leadPlan) o.leadPlan = {};
    if (!o.extras) o.extras = [];
    if (!o.ending) o.ending = 'auto';
    const songGen = SDAW.store.song.gen && SDAW.store.song.gen.by === 'songgen' && SDAW.store.song.gen.opts && SDAW.STYLES[SDAW.store.song.gen.opts.genre] ? SDAW.store.song.gen : null;
    const body = el('div', { class: 'sg-body' });
    const close = () => back.remove();
    const families = {};
    Object.keys(SDAW.STYLES).forEach(g => { const f = SDAW.STYLES[g].family; (families[f] = families[f] || []).push(g); });

    function render() {
      if (o.ref && !(SDAW.styleData && SDAW.styleData.artists[o.ref])) o.ref = '';
      const base = SDAW.STYLES[o.genre];
      if (base.band) o.ref = '';
      const st = SG.styleOf(o);
      body.innerHTML = '';
      /* ---- column 1: genre, key, form ---- */
      const c1 = el('div', { class: 'sg-col' });
      c1.appendChild(el('div', { class: 'ag-sub' }, 'Genre'));
      Object.keys(families).forEach(f => {
        c1.appendChild(el('div', { class: 'sg-fam' }, f));
        c1.appendChild(el('div', { class: 'sg-genres' }, families[f].map(g => el('button', { class: 'sg-genre' + (g === o.genre ? ' active' : ''), onclick: () => {
          o = SG.genrePreset(g, o.seed);
          render(); } }, g))));
      });
      c1.appendChild(el('div', { class: 'sg-desc' }, st.desc));
      // reference artist: the band of the genre plays like a band of the reference library (styledata.js)
      // a band profile (bands.js): its kinds of song — each brings its own line-up, tempo, key, form and progressions
      if (base.types) {
        const cur = o.songType && base.types[o.songType] ? o.songType : 'auto';
        c1.appendChild(el('div', { class: 'ag-sub' }, '🎤 Kind of song'));
        c1.appendChild(el('select', { class: 'sg-ref', onchange: e => {
          const v = e.target.value;
          o = SG.genrePreset(o.genre, o.seed, v === 'auto' ? SG.typeOf(base, { seed: o.seed }) : v);
          render(); } },
          [el('option', { value: 'auto', selected: cur === 'auto' ? true : null }, 'Pick a kind for this idea')].concat(Object.keys(base.types).map(id => el('option', { value: id, selected: cur === id ? true : null }, base.types[id].n)))));
        c1.appendChild(el('div', { class: 'st-note sg-refnote' }, (cur === 'auto' ? 'This idea: ' + st.typeName + '. With Auto, the line-up, tempo, key and mode come with the kind of song the idea picks (your changes below apply when you choose a kind). ' : '') + (base.types[st.type].d || '')));
      }
      const refs = base.band ? [] : SG.refArtists(o.genre);
      if (refs.length) {
        c1.appendChild(el('div', { class: 'ag-sub' }, '🎯 Reference artist'));
        c1.appendChild(el('select', { class: 'sg-ref', onchange: e => {
          const ref = e.target.value, ra = SDAW.styleData.artists[ref];
          o = ra ? SG.artistPreset(o, ra.hero) : SG.genrePreset(o.genre, o.seed);
          if (ra && !SDAW.STYLES[o.genre].band) {
            o.ref = ref;
            o.tempo = ra.tempo?.[2] || o.tempo;
          }
          render(); } },
          [el('option', { value: '' }, 'None — the genre\'s own band')].concat(refs.map(r => el('option', { value: r.id, selected: o.ref === r.id ? true : null }, r.name + (r.fits ? ' ★' : '') + ' · ' + r.songs + ' songs')))));
        const ra = o.ref && SDAW.styleData.artists[o.ref];
        if (ra) {
          const tech = Object.entries(ra.lead.tech).filter(([, v]) => v >= 0.02).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(v * 100) + '%').join(', ');
          const tun = Object.keys(ra.tuning)[0] || 'E standard';
          c1.appendChild(el('div', { class: 'st-note sg-refnote' }, 'Learned from ' + ra.songs + ' songs: ' + ra.tempo[0] + '–' + ra.tempo[1] + ' BPM (usual ' + ra.tempo[2] + '), ' + Math.round(ra.minor * 100) + '% in minor, tuning ' + tun +
            '. Lead: ' + ra.lead.notesPerBar + ' notes per bar, ' + tech + (ra.lead.triplets >= 0.15 ? ', many triplets' : '') + '. Drums, bass, rhythm guitar and the progressions (★ in the next column) follow the band; the lead plays ' + (SDAW.legends && SDAW.legends.HEROES[ra.hero] ? SDAW.legends.HEROES[ra.hero].name : 'the genre lead') + '. Patterns the band plays in several songs — never a copy of one song.'));
        } else c1.appendChild(el('div', { class: 'st-note sg-refnote' }, 'Pick a band (★ = plays this genre) and the drums, bass, rhythm guitar, progressions and lead follow how that band really plays — learned from your Guitar Pro library.'));
      }
      c1.appendChild(el('div', { class: 'ag-sub' }, 'Key, tempo & form'));
      c1.appendChild(row('Key', el('div', { class: 'sg-inline' }, [
        el('select', { onchange: e => { o.key = +e.target.value; render(); } }, SDAW.NOTE_NAMES.map((n, i) => el('option', { value: i, selected: i === o.key ? true : null }, SG.prefersFlats(i, o.mode) ? SDAW.FLAT_NAMES[i] : n))),
        el('select', { onchange: e => { o.mode = e.target.value; o.progs = {}; render(); } }, [['major', 'Major'], ['minor', 'Minor']].map(([v, l]) => el('option', { value: v, selected: o.mode === v ? true : null }, l)))
      ])));
      c1.appendChild(row('Tempo', el('div', { class: 'sg-inline' }, [el('input', { type: 'number', min: 40, max: 240, value: o.tempo, style: { width: '80px' }, onchange: e => { o.tempo = +e.target.value || st.tempo[2]; } }), el('small', {}, st.tempo[0] + '–' + st.tempo[1] + ' BPM' + (st.swing ? ' · swing ' + Math.round(st.swing * 100) + '%' : ''))])));
      c1.appendChild(row('Form', el('select', { onchange: e => { o.structure = e.target.value; render(); } }, Object.keys(st.structures).map(k => el('option', { value: k, selected: o.structure === k ? true : null }, k)))));
      const secs = SG.parseStructure(st.structures[o.structure]);
      c1.appendChild(el('div', { class: 'sg-form' }, secs.map(x => el('span', { style: { '--sc': SDAW.autogen.CONFIG.sectionColors[x.type] } }, x.name + ' ' + x.length))));
      // ending: the genre's own, the plain tonic, or one of the classic jazz endings
      const endList = SG.JAZZ_ENDINGS[o.mode === 'minor' ? 'minor' : 'major'];
      if (o.ending !== 'auto' && o.ending !== 'tonic' && o.ending !== 'jazz' && !endList.some(e => e.id === o.ending)) o.ending = 'auto';
      c1.appendChild(row('Ending', el('select', { onchange: e => { o.ending = e.target.value; render(); } }, [
        ['auto', st.ending === 'jazz' ? 'Auto — a big jazz ending (changes with 🎲)' : 'Auto — on the tonic (the genre\'s way)'], ['tonic', 'Simple — last chord on the tonic'], ['jazz', 'Jazz ending — any (changes with 🎲)']]
        .concat(endList.map(e => [e.id, '🎷 ' + e.n])).map(([v, l]) => el('option', { value: v, selected: o.ending === v ? true : null }, l)))));
      const endSel = endList.find(e => e.id === o.ending);
      if (endSel) c1.appendChild(el('div', { class: 'sg-chords' }, endSel.bars.slice(-secs[secs.length - 1].length).map(t => el('span', {}, t.split('-').map(h => SG.romanToName(h, o.key, SG.prefersFlats(o.key, o.mode))).join(' · ')))));
      // vocals (every genre but Jazz)
      const canSing = SDAW.vocals && SDAW.vocals.supports(o.genre);
      if (!o.vocals) Object.assign(o, { vocals: 'instrumental', voice: 'auto', choir: 'auto' });
      c1.appendChild(el('div', { class: 'ag-sub' }, 'Vocals'));
      if (!canSing) c1.appendChild(el('div', { class: 'st-note', style: { marginTop: 0 } }, o.genre + ' is generated instrumental: the lead instruments carry the melody.'));
      else {
        c1.appendChild(row('Song', el('select', { onchange: e => { o.vocals = e.target.value; render(); } }, [['instrumental', 'Instrumental (the lead plays the melody)'], ['singer', 'With singer (+ backing vocals)']].map(([v, l]) => el('option', { value: v, selected: o.vocals === v ? true : null }, l)))));
        if (o.vocals === 'singer') {
          c1.appendChild(row('Voice', el('select', { onchange: e => { o.voice = e.target.value; } }, [['auto', 'Auto (changes with the idea)'], ['male', 'Male'], ['female', 'Female']].map(([v, l]) => el('option', { value: v, selected: o.voice === v ? true : null }, l)))));
          c1.appendChild(row('Backing', el('select', { onchange: e => { o.choir = e.target.value; } }, [['auto', 'Auto (2–3 voices, style of the genre)'], ['2', '2 voices'], ['3', '3 voices'], ['none', 'No backing vocals']].map(([v, l]) => el('option', { value: v, selected: String(o.choir) === v ? true : null }, l)))));
          c1.appendChild(el('div', { class: 'st-note', style: { marginTop: 0 } }, 'The singer takes the melody; the lead guitar / horns answer between the phrases and get a solo. The arrangement changes with every 🎲 idea.'));
        }
      }
      c1.appendChild(row('Complexity', slider('complexity', v => v < 0.3 ? 'Simple' : v < 0.7 ? 'Normal' : 'Advanced')));
      c1.appendChild(row('Density', slider('density', v => v < 0.3 ? 'Sparse' : v < 0.7 ? 'Medium' : 'Busy')));
      const seedIn = el('input', { type: 'number', min: 1, value: o.seed, style: { width: '80px' }, onchange: e => { o.seed = +e.target.value || 1; } });
      c1.appendChild(row('Idea', el('div', { class: 'sg-inline' }, [seedIn,
        el('button', { class: 'btn small', 'data-help': 'A new composition with the same options', onclick: () => { o.seed = SG.newSeed(); seedIn.value = o.seed; if (base.types && !(o.songType && base.types[o.songType])) { o = Object.assign(SG.variedDefaults(o.genre, o.seed), { songType: 'auto', complexity: o.complexity, density: o.density, structure: o.structure, extras: o.extras, ending: o.ending }); render(); } } }, '🎲 New idea'),
        SG.last && SG.last.seed ? el('button', { class: 'btn small', 'data-help': 'Use again the idea (seed) of the last generated song: same options + same idea = the same song', onclick: () => { o.seed = SG.last.seed; seedIn.value = o.seed; } }, '↺ Last #' + SG.last.seed) : null,
        songGen ? el('button', { class: 'btn small', 'data-help': 'Load every option and the idea saved in the current song (to rebuild it or make a variation)', onclick: () => { o = Object.assign(SG.defaults(songGen.opts.genre, songGen.seed), SDAW.deepCopy(songGen.opts)); render(); } }, '📄 This song #' + songGen.seed) : null])));
      c1.appendChild(el('div', { class: 'st-note', style: { marginTop: 0 } }, 'Every new song is a new idea. The idea number is saved in the song: the same options with the same idea rebuild the same song.'));

      /* ---- column 2: progressions ---- */
      const c2 = el('div', { class: 'sg-col' });
      c2.appendChild(el('div', { class: 'ag-sub' }, 'Progressions (' + st.progs.length + ' in the ' + o.genre + ' library)'));
      const groups = [...new Set(secs.map(x => SG.groupOf(x.type)))].filter(g => g !== 'intro' && g !== 'outro');
      const flats = SG.prefersFlats(o.key, o.mode);
      groups.forEach(g => {
        const list = SG.progsFor(st, g, o.mode);
        const sel = el('select', { onchange: e => { o.progs[g] = e.target.value; render(); } },
          [el('option', { value: 'auto' }, 'Auto — the program chooses')].concat(list.map(p => el('option', { value: p.c, selected: o.progs[g] === p.c ? true : null }, p.n))));
        const cur = o.progs[g] && o.progs[g] !== 'auto' ? o.progs[g] : null;
        c2.appendChild(el('div', { class: 'sg-prog' }, [el('b', {}, { verse: 'Verse', chorus: 'Chorus', pre: 'Pre-Chorus', bridge: 'Bridge', solo: 'Solo / Mambo / Jaleo' }[g] || g), sel,
          el('div', { class: 'sg-chords' }, cur ? cur.split(' ').map(t => el('span', {}, t + ' → ' + t.split('-').map(h => SG.romanToName(h, o.key, flats)).join('·'))) : [el('em', {}, list.length ? list.length + ' progressions of the genre for this section' : 'Generic progression (none tagged for this section)')])]));
      });
      c2.appendChild(el('div', { class: 'st-note' }, 'Intro and Outro take their own progressions (turnarounds, endings) or reuse the chorus and end on the tonic. ' +
        (o.genre === 'Blues' ? 'Blues uses few progressions: the 12-bar form is the genre.' : '')));
      c2.appendChild(el('div', { class: 'ag-sub' }, 'Melody — what the lead may use'));
      c2.appendChild(el('div', { class: 'st-note', style: { marginTop: 0 } }, 'The program decides where each one fits: runs in solos and climaxes, triplets in answers and pickups, bends in choruses and solos, harmonics on calm endings, slides into phrases…'));
      const M = [['complex', 'Complex lines (leaps, 16ths, variations)'], ['fast', 'Fast runs'], ['triplets', 'Triplets'], ['modes', 'Mix modes / scales per section'], ['slides', 'Slides'], ['harmonics', 'Harmonics (guitar)'], ['bends', 'Bends'], ['vibrato', 'Vibrato']];
      c2.appendChild(el('div', { class: 'sg-mel' }, M.map(([k, l]) => el('label', { class: 'ag-check-opt' }, [el('input', { type: 'checkbox', checked: o.melody[k] ? true : null, onchange: e => { o.melody[k] = e.target.checked; } }), l]))));

      // lead guitar "in the style of" a great guitarist (legends.js)
      if (SDAW.legends) {
        const heroSel = el('select', { onchange: e => { o = SG.artistPreset(o, e.target.value); render(); } },
          SDAW.legends.options(st).map(([v, l]) => el('option', { value: v, selected: (o.melody.hero || 'auto') === v ? true : null }, l)));
        c2.appendChild(el('div', { class: 'ag-sub' }, '🎸 Lead guitar in the style of'));
        c2.appendChild(heroSel);
        const hh = SDAW.legends.HEROES[o.melody.hero];
        c2.appendChild(el('div', { class: 'st-note', style: { marginTop: '4px' } }, hh ? hh.name + ': ' + hh.tag + '.' :
          'When the lead instrument is a guitar, its solos and melodies use the scales, techniques and phrasing of a guitarist of the genre (★). Original phrases over your chords — not copies of recorded solos. The rhythm guitar has its own styles in the band list (riffs, shuffles…).'));
      }

      // the lead in every section of the form: a theme, a solo, a riff, answers or silence
      c2.appendChild(el('div', { class: 'ag-sub' }, '🎼 Lead — what it plays in each section'));
      const presetOf = () => Object.keys(SG.LEAD_PRESETS).find(k => { const pl = SG.LEAD_PRESETS[k].plan; return SG.LEAD_SECTIONS.every(([sk]) => (pl[sk] || 'auto') === (o.leadPlan[sk] || 'auto')); }) || 'custom';
      c2.appendChild(el('select', { class: 'sg-lp-preset', onchange: e => { if (SG.LEAD_PRESETS[e.target.value]) o.leadPlan = Object.assign({}, SG.LEAD_PRESETS[e.target.value].plan); render(); } },
        Object.keys(SG.LEAD_PRESETS).map(k => el('option', { value: k, selected: presetOf() === k ? true : null }, SG.LEAD_PRESETS[k].n)).concat([el('option', { value: 'custom', selected: presetOf() === 'custom' ? true : null }, 'Custom (choose below)')])));
      const inForm = new Set(secs.map(x => x.type === 'part' ? 'verse' : x.type));
      c2.appendChild(el('div', { class: 'sg-lp' }, SG.LEAD_SECTIONS.filter(([k]) => inForm.has(k)).map(([k, l]) => el('label', { class: 'sg-lp-row' }, [el('span', {}, l),
        el('select', { onchange: e => { o.leadPlan[k] = e.target.value; render(); } }, SG.LEAD_MODES.map(([v, t]) => el('option', { value: v, selected: (o.leadPlan[k] || 'auto') === v ? true : null }, t)))]))));
      c2.appendChild(el('div', { class: 'st-note', style: { marginTop: '4px' } }, 'Solo = the same dynamics as the solos (fast scales, licks, riffs, bends) from the first verse — for instrumental songs. With a singer, the lead keeps to the breaths of the voice in the sung sections.'));

      /* ---- column 3: band ---- */
      const c3 = el('div', { class: 'sg-col sg-band' });
      c3.appendChild(el('div', { class: 'ag-sub' }, 'Band — instruments, how they play, effects'));
      if (st.tracks.some(sp => SG.rigModelFor(o.tracks[sp.id] ? o.tracks[sp.id].inst : sp.inst, sp.fx))) {
        const rigOk = SG.rigAvailable();
        c3.appendChild(row('🎸 Guitars', el('select', { disabled: rigOk ? null : true, onchange: e => { o.guitarEngine = e.target.value; } }, [
          el('option', { value: 'rig', selected: (o.guitarEngine || 'rig') === 'rig' && rigOk ? true : null }, 'Guitar Rig — real recordings, real amps'),
          el('option', { value: 'light', selected: o.guitarEngine === 'light' || !rigOk ? true : null }, 'Light synth (old guitar engine)')])));
        c3.appendChild(el('div', { class: 'st-note', style: { marginTop: 0 } }, rigOk
          ? 'Guitar Rig: every guitar of the band plays a real guitar (nylon, steel, Strat, Les Paul, hollow body) through the amp, cabinet and effects of the genre preset (FX column).'
          : 'Guitar Rig is not available in this browser (needs AudioWorklet: Chrome / Edge) — the light guitars play.'));
      }
      const tbl = el('div', { class: 'sg-tracks' });
      st.tracks.forEach(sp => {
        const tr = o.tracks[sp.id];
        const alt = sp.role === 'drums' ? [sp.inst] : (SDAW.STYLE_ALT[sp.alt] || (sp.role === 'bass' ? SDAW.STYLE_ALT.bass : [sp.inst]));
        const insts = [...new Set([sp.inst].concat(alt))];
        const ico = sp.role === 'drums' ? '🥁' : sp.role === 'bass' ? '🎸' : ['melody', 'horns', 'horn2', 'counter'].includes(sp.role) ? '🎺' : '🎹';
        tbl.appendChild(el('div', { class: 'sg-track' + (tr.on ? '' : ' off') }, [
          el('label', { class: 'sg-tname' }, [el('input', { type: 'checkbox', checked: tr.on ? true : null, onchange: e => { tr.on = e.target.checked; render(); } }), el('span', {}, ico + ' ' + sp.name)]),
          el('select', { title: 'Instrument', disabled: sp.role === 'drums' ? true : null, onchange: e => { tr.inst = e.target.value; } }, insts.map(n => el('option', { value: n, selected: tr.inst === n ? true : null }, n))),
          sp.plays ? el('select', { title: 'How it plays', onchange: e => { tr.play = e.target.value; } }, sp.plays.map(pl => el('option', { value: pl, selected: tr.play === pl ? true : null }, PLAY_LABEL[pl] || pl)))
            : el('span', { class: 'sg-role' }, ROLE_LABEL[sp.role] || sp.role),
          el('select', { title: 'Effects', onchange: e => { tr.fx = e.target.value; } }, Object.keys(SG.FX).map(n => el('option', { value: n, selected: tr.fx === n ? true : null }, n)))
        ]));
      });
      // extra instruments chosen by the user (they join the band of this song)
      o.extras.forEach((x, i) => {
        const K = SG.EXTRA_KINDS[x.kind], perc = /^perc:/.test(x.kind);
        const label = perc ? (SG.percussionList().find(p => p.id === x.kind) || { n: x.inst }).n : x.inst + ' · ' + (K ? K.n : x.kind);
        tbl.appendChild(el('div', { class: 'sg-track sg-extra' }, [
          el('span', { class: 'sg-tname' }, (perc ? '🪘 ' : '✚ ') + label),
          el('button', { class: 'btn small', title: 'Remove', onclick: () => { o.extras.splice(i, 1); render(); } }, '✕')]));
      });
      c3.appendChild(tbl);
      const kinds = [['', '＋ Add an instrument…']].concat(Object.keys(SG.EXTRA_KINDS).filter(k => !SG.EXTRA_KINDS[k].needsLead || st.tracks.some(t => t.lead)).map(k => [k, SG.EXTRA_KINDS[k].n])).concat([['perc', 'Percussion (güiro, congas, bongó, maracas…)']]);
      const kindSel = el('select', { onchange: () => fillInst() }, kinds.map(([v, l]) => el('option', { value: v }, l)));
      const instSel = el('select', {});
      function fillInst() {
        const k = kindSel.value; instSel.innerHTML = '';
        const list = !k ? [] : k === 'perc' ? SG.percussionList().map(p => [p.id, p.n]) : (SDAW.STYLE_ALT[SG.EXTRA_KINDS[k].list] || []).map(n => [n, n]);
        list.forEach(([v, l]) => instSel.appendChild(el('option', { value: v }, l)));
        instSel.disabled = !list.length;
      }
      fillInst();
      c3.appendChild(el('div', { class: 'sg-add' }, [kindSel, instSel, el('button', { class: 'btn small primary', onclick: () => {
        const k = kindSel.value; if (!k || !instSel.value) return SDAW.toast('Choose what to add and the instrument');
        const id = 'x' + Date.now().toString(36) + o.extras.length;
        if (k === 'perc') { const pc = SG.percussionList().find(p => p.id === instSel.value); o.extras.push({ id, kind: pc.id, inst: pc.inst }); }
        else o.extras.push({ id, kind: k, inst: instSel.value });
        render();
      } }, 'Add')]));
      c3.appendChild(el('div', { class: 'st-note', style: { marginTop: '4px' } }, 'Any instrument can join the band: a sax counter-melody, a trumpet in 3rds with the lead, a pad, a güiro… The singer is chosen under Vocals (column 1).'));
      body.append(c1, c2, c3);
    }
    function row(label, ctrl) { return el('div', { class: 'st-row ag-row' }, [el('label', {}, label), ctrl, el('span')]); }
    function slider(key, fmt) {
      const val = el('span', { class: 'st-val' }, fmt(o[key]));
      return el('div', { class: 'ag-slider' }, [el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: o[key], oninput: e => { o[key] = parseFloat(e.target.value); val.textContent = fmt(o[key]); } }), val]);
    }

    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal sg-modal' }, [
        el('button', { class: 'close', onclick: close }, '×'),
        el('h2', { style: { margin: '0 0 4px' } }, '✨ Auto Generate Full Song'),
        el('div', { class: 'st-note', style: { marginTop: 0 } }, 'Choose the genre, key, form, progressions and band. Every instrument is generated with the rhythm, voicings and sound of the genre, section by section.'),
        body,
        el('div', { class: 'ag-foot' }, [
          el('span', { class: 'sg-warn' }, init.genre ? 'A new song with everything you chose — every instrument stays editable.' : '⚠ Replaces every track of the current song (Ctrl+Z restores it).'),
          el('span', { class: 'spacer' }),
          el('button', { class: 'btn', onclick: close }, 'Cancel'),
          el('button', { class: 'btn primary ag-go', onclick: () => { SG.last = SDAW.deepCopy(o); close(); setTimeout(() => { SG.generateFullSong(o); if (init.onDone) init.onDone(); }, 20); } }, init.genre ? '✨ Create the song' : '✨ Generate Full Song')
        ])
      ])
    ]);
    $('#modalRoot').appendChild(back);
    render();
  };
  const PLAY_LABEL = { mix: 'Mix (decides per section)', chords: 'Chords (rhythm)', arp: 'Arpeggio', pad: 'Pad (sustained)', montuno: 'Montuno (blocks in octaves)', jazz: 'Jazz comping (rootless)',
    'montuno-light': 'Montuno light (few hits)', strum: 'Strumming', power: 'Power chords', funk: 'Funk scratch', boomchick: 'Bass + strum (boom-chick)', bossa: 'Bossa nova', shuffle: 'Blues shuffle',
    style: 'Genre pattern', roots: 'Roots', '8ths': 'Straight 8ths', walking: 'Walking bass', boogie: 'Boogie', tumbao: 'Tumbao (anticipated)',
    riffs: 'Riffs (2-bar figures)', answers: 'Answers (call & response)', harmony: '2nd voice in 3rds/6ths', unison: 'Octave unison' };
  const ROLE_LABEL = { drums: 'Rhythm of the genre', melody: 'Lead melody', counter: 'Counter-melody', horns: 'Riffs', horn2: '2nd voice' };
  if (SDAW.legends) Object.assign(PLAY_LABEL, SDAW.legends.RHYTHMS);
  SG.PLAY_LABEL = PLAY_LABEL;

  /* ============================================ integration with the app == */
  // genre list of the whole program = the style library
  CONFIG.library.genres = Object.keys(SDAW.STYLES);
  // grooves / progressions shown in the Library come from the styles too
  Object.keys(SDAW.STYLES).forEach(g => {
    const st = SDAW.STYLES[g];
    const spec = SG.specFor({ type: 'drums' }, st, 'drums');
    if (spec && spec.pat) {
      const v = pick(spec.pat, 'verse') || {};
      const conv = s => (s || '').slice(0, 16).padEnd(16, '.').split('').map(ch => ch === 'X' ? 'o' : ch === 'x' ? 'x' : (ch === 'o' || ch === '-') ? '-' : '.').join('');
      const rows = {}; Object.keys(v).forEach(r => { rows[r] = conv(v[r]); });
      SDAW.RHYTHMS[g] = rows;
    }
    if (!SDAW.PROGRESSIONS[g]) {
      const p = st.progs.find(x => x.m === st.mode) || st.progs[0];
      const degs = p.c.split(' ').map(t => { const m = /(VII|VI|V|IV|III|II|I)/i.exec(t.split('-')[0]); return m ? ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].indexOf(m[1].toUpperCase()) + 1 : 1; });
      SDAW.PROGRESSIONS[g] = { mode: p.m, degrees: degs };
    }
    SDAW.GENRE_TEMPO[g] = st.tempo[2];
  });
  // the welcome screen / templates build genre songs with the full engine
  /** "E minor · 118 BPM · idea #4521" */
  SDAW.songIdeaText = song => song.key + (song.scale === 'minor' ? ' minor' : ' major') + ' · ' + song.tempo + ' BPM' + (song.gen ? ' · idea #' + song.gen.seed : '');
  // every song built from the welcome screen / templates is a new idea (new seed, key and tempo of the genre)
  SDAW.buildSong = function (genre, seed) { return SG.createSong(SG.variedDefaults(SDAW.STYLES[genre] ? genre : 'Pop', seed)); };

})(window.SDAW);
