/* =============================================================================
 *  PEDALS.JS — pedalboard: pedal types, simulated models and their DSP
 *  -----------------------------------------------------------------------------
 *  Every track has 8 pedals in this order:
 *     COMP → OD → DIST → AMP → EQ → CHORUS → DELAY → REVERB
 *  Each pedal has a MODEL that simulates the character of a classic unit
 *  (names say "style": they are sound simulations, not the original products).
 *
 *  A model of a drive/distortion pedal is described by:
 *    hp       high-pass before clipping (Hz) — how much bass is cut
 *    mid      { f, g, q } mid boost/cut before clipping (Hz, dB)
 *    gain     maximum extra gain (drive knob = 1)
 *    curve    'soft' | 'asym' | 'hard' | 'fuzz' clipping shape
 *    tone     [min, max] range of the tone knob (low-pass, Hz)
 *    post     { f, g, q } EQ after clipping (scoop / presence)
 *    blend    clean signal mixed in (Klon style)
 *    out      output trim
 *
 *  Add your own models to the lists below — the Inspector shows them
 *  automatically in the Model selector.
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  /* ------------------------------------------------------------ TYPES --- */
  /** Knobs of each pedal type: [key, label, min, max, step, unit] */
  SDAW.PEDAL_TYPES = [
    { key: 'comp',   label: 'COMP',   name: 'Compressor', knobs: [['amount', 'Sustain', 0, 1, 0.01, '%'], ['level', 'Level', 0, 1, 0.01, '%']] },
    { key: 'drive',  label: 'OD',     name: 'Overdrive',  knobs: [['amount', 'Drive', 0, 1, 0.01, '%'], ['tone', 'Tone', 0, 1, 0.01, '%'], ['level', 'Level', 0, 1, 0.01, '%']] },
    { key: 'dist',   label: 'DIST',   name: 'Distortion', knobs: [['amount', 'Dist', 0, 1, 0.01, '%'], ['tone', 'Tone', 0, 1, 0.01, '%'], ['level', 'Level', 0, 1, 0.01, '%']] },
    { key: 'amp',    label: 'AMP',    name: 'Amp',        knobs: [['gain', 'Gain', 0, 1, 0.01, '%'], ['bass', 'Bass', 0, 1, 0.01, '%'], ['mid', 'Middle', 0, 1, 0.01, '%'], ['treble', 'Treble', 0, 1, 0.01, '%'], ['presence', 'Presence', 0, 1, 0.01, '%'], ['level', 'Master', 0, 1, 0.01, '%']] },
    { key: 'eq',     label: 'EQ',     name: 'EQ',         knobs: [['low', 'Low', -12, 12, 0.5, 'dB'], ['mid', 'Mid', -12, 12, 0.5, 'dB'], ['high', 'High', -12, 12, 0.5, 'dB']] },
    { key: 'chorus', label: 'CHORUS', name: 'Chorus',     knobs: [['rate', 'Rate', 0, 1, 0.01, '%'], ['depth', 'Depth', 0, 1, 0.01, '%'], ['mix', 'Mix', 0, 1, 0.01, '%']] },
    { key: 'delay',  label: 'DELAY',  name: 'Delay',      knobs: [['time', 'Time', 0, 5, 1, 'sync'], ['feedback', 'Feedback', 0, 0.9, 0.01, '%'], ['mix', 'Mix', 0, 1, 0.01, '%']] },
    { key: 'reverb', label: 'REVERB', name: 'Reverb',     knobs: [['mix', 'Mix', 0, 1, 0.01, '%'], ['tone', 'Tone', 0, 1, 0.01, '%']] }
  ];

  /** Delay time knob positions (in beats) */
  SDAW.DELAY_SYNC = [
    { beats: 0.25, name: '1/16' }, { beats: 0.5, name: '1/8' }, { beats: 0.75, name: '1/8 dotted' },
    { beats: 1, name: '1/4' }, { beats: 1.5, name: '1/4 dotted' }, { beats: 2, name: '1/2' }
  ];

  /* ----------------------------------------------------------- MODELS --- */
  SDAW.PEDAL_MODELS = {
    comp: [
      { id: 'dyna',   name: 'Orange Squeezer (Dyna Comp style)', short: 'DYNA', color: '#ff6a1f', ratio: 8, attack: 0.003, release: 0.25, knee: 4, thr: -18, desc: 'Strong squash, long sustain, snappy attack — country / funk.' },
      { id: 'cs3',    name: 'Blue Sustainer (CS-3 style)',       short: 'CS-3', color: '#2f7cff', ratio: 5, attack: 0.008, release: 0.3, knee: 8, thr: -15, desc: 'Smooth sustain with a soft knee.' },
      { id: 'studio', name: 'Studio Optical (LA-2A style)',      short: 'OPTO', color: '#8a8f99', ratio: 3, attack: 0.02, release: 0.45, knee: 12, thr: -12, desc: 'Gentle, transparent leveling.' }
    ],
    drive: [
      { id: 'ts808', name: 'Green Screamer (TS-808 style)', short: 'TS', color: '#2bbf5a', hp: 720, mid: { f: 720, g: 7, q: 0.7 }, gain: 40, curve: 'soft', tone: [1200, 5000], post: { f: 3000, g: -2, q: 0.7 }, blend: 0.15, out: 1.0, desc: 'Mid hump, tight bass, smooth clipping. The classic lead booster.' },
      { id: 'sd1',   name: 'Yellow Drive (SD-1 style)',     short: 'SD-1', color: '#ffd21f', hp: 450, mid: { f: 900, g: 5, q: 0.8 }, gain: 45, curve: 'asym', tone: [1500, 6500], post: { f: 2500, g: 0, q: 1 }, blend: 0.1, out: 1.0, desc: 'Asymmetric clipping, a bit brighter and grittier.' },
      { id: 'bd2',   name: 'Blue Driver (BD-2 style)',      short: 'BD-2', color: '#2a6fe0', hp: 180, mid: { f: 1000, g: 2, q: 0.5 }, gain: 55, curve: 'soft', tone: [2000, 9000], post: { f: 4000, g: 2, q: 0.8 }, blend: 0.05, out: 0.95, desc: 'Full range, dynamic, amp-like breakup.' },
      { id: 'klon',  name: 'Gold Centaur (Klon style)',     short: 'KLON', color: '#d4a640', hp: 120, mid: { f: 1000, g: 3, q: 0.6 }, gain: 30, curve: 'soft', tone: [2500, 9000], post: { f: 3000, g: 1, q: 0.8 }, blend: 0.45, out: 1.1, desc: 'Clean blend + gentle drive: transparent boost.' }
    ],
    dist: [
      { id: 'ds1',       name: 'Orange Distortion (DS-1 style)', short: 'DS-1', color: '#ff7a1a', hp: 160, mid: { f: 500, g: -3, q: 0.8 }, gain: 140, curve: 'hard', tone: [1800, 8000], post: { f: 2800, g: 2, q: 0.9 }, blend: 0, out: 0.8, desc: 'Bright, cutting hard clipping. Classic rock distortion.' },
      { id: 'ds2',       name: 'Turbo Distortion (DS-2 style)',  short: 'DS-2', color: '#ff9a3a', hp: 140, mid: { f: 850, g: 5, q: 0.9 }, gain: 170, curve: 'hard', tone: [1800, 7500], post: { f: 2500, g: 1, q: 0.9 }, blend: 0, out: 0.8, desc: 'DS-1 with a mid boost (turbo mode) for leads.' },
      { id: 'rat',       name: 'Black Rodent (RAT style)',       short: 'RAT', color: '#2b2b30', hp: 90, mid: { f: 1200, g: 2, q: 0.6 }, gain: 220, curve: 'hard', tone: [1200, 11000], post: { f: 3500, g: 0, q: 1 }, blend: 0, out: 0.75, desc: 'Thick, aggressive, from overdrive to fuzz. Filter knob = tone.' },
      { id: 'mt2',       name: 'Metal Zone (MT-2 style)',        short: 'MT-2', color: '#3a3a3a', hp: 120, mid: { f: 1000, g: 6, q: 1.1 }, gain: 400, curve: 'hard', tone: [2500, 9000], post: { f: 600, g: -6, q: 0.8 }, blend: 0, out: 0.7, desc: 'Very high gain with scooped mids and tight bass — metal.' },
      { id: 'muff',      name: 'Big Fuzz (Big Muff style)',      short: 'MUFF', color: '#c0c0c8', hp: 70, mid: { f: 1000, g: -8, q: 0.6 }, gain: 300, curve: 'fuzz', tone: [900, 6000], post: { f: 200, g: 3, q: 0.7 }, blend: 0, out: 0.75, desc: 'Huge sustaining fuzz with a deep mid scoop.' },
      { id: 'fuzzface',  name: 'Round Fuzz (Fuzz Face style)',   short: 'FUZZ', color: '#d8323c', hp: 60, mid: { f: 800, g: 1, q: 0.5 }, gain: 120, curve: 'fuzz', tone: [2500, 8000], post: { f: 3000, g: 0, q: 1 }, blend: 0, out: 0.8, desc: 'Vintage, round, cleans up with the guitar volume (60s rock).' }
    ],
    amp: [
      { id: 'twin',    name: 'Clean Twin (Fender Twin style)',     short: 'TWIN', color: '#1f1f24', preGain: 3, curve: 'soft', bassF: 120, midF: 500, trebleF: 3000, midBase: -4, cab: 5200, desc: 'Sparkling cleans, scooped mids, big headroom.' },
      { id: 'ac30',    name: 'Chime 30 (Vox AC30 style)',          short: 'AC30', color: '#7a1f1f', preGain: 8, curve: 'asym', bassF: 150, midF: 1200, trebleF: 3500, midBase: 2, cab: 6000, desc: 'Jangly top end, compresses into a sweet breakup.' },
      { id: 'plexi',   name: 'British Crunch (Marshall Plexi style)', short: 'PLEXI', color: '#c8a55a', preGain: 18, curve: 'asym', bassF: 110, midF: 800, trebleF: 2800, midBase: 4, cab: 5000, desc: 'Classic rock crunch with strong mids.' },
      { id: 'rect',    name: 'Hi-Gain Rectifier (Mesa style)',     short: 'RECT', color: '#5a5a62', preGain: 60, curve: 'hard', bassF: 90, midF: 700, trebleF: 3200, midBase: -5, cab: 4800, desc: 'Modern high gain, tight lows, scooped mids.' },
      { id: 'jc120',   name: 'Jazz Chorus (JC-120 style)',         short: 'JC', color: '#3a3a40', preGain: 1.5, curve: 'soft', bassF: 120, midF: 700, trebleF: 3500, midBase: 0, cab: 7000, desc: 'Ultra clean solid-state tone, great for chorus and jazz.' }
    ],
    eq: [
      { id: 'graphic', name: 'Graphic EQ (GE-7 style)', short: 'GE-7', color: '#e9e9ee', lowF: 200, midF: 1000, highF: 4000, desc: '3-band graphic EQ: shape the tone before or after the drive.' },
      { id: 'tilt',    name: 'Warm Tilt EQ',            short: 'TILT', color: '#14c4b0', lowF: 300, midF: 1400, highF: 3000, desc: 'Broad, musical curves.' }
    ],
    chorus: [
      { id: 'ce2',       name: 'Vintage Chorus (CE-2 style)',  short: 'CE-2', color: '#3fa9ff', delay: 0.008, rate: [0.3, 3], depth: 0.0035, desc: 'Warm analog 80s chorus.' },
      { id: 'clone',     name: 'Small Clone style',            short: 'CLONE', color: '#9aa0aa', delay: 0.006, rate: [0.4, 4], depth: 0.003, desc: 'Lush and watery (90s grunge).' },
      { id: 'dimension', name: 'Dimension style (stereo)',     short: 'DIM', color: '#b8bcc4', delay: 0.012, rate: [0.2, 1.2], depth: 0.0015, desc: 'Subtle, wide doubling.' }
    ],
    delay: [
      { id: 'digital', name: 'Digital Delay (DD-3 style)',    short: 'DD-3', color: '#ffffff', filter: 12000, wobble: 0, desc: 'Clean, exact repeats.' },
      { id: 'analog',  name: 'Analog Delay (DM-2 style)',     short: 'DM-2', color: '#a35cff', filter: 2600, wobble: 0.0006, desc: 'Dark, warm repeats that fade into the mix.' },
      { id: 'tape',    name: 'Tape Echo (Space Echo style)',  short: 'TAPE', color: '#2d6b4f', filter: 3800, wobble: 0.0018, desc: 'Wobbly, saturated tape repeats.' }
    ],
    reverb: [
      { id: 'spring', name: 'Spring Reverb (amp tank style)', short: 'SPRING', color: '#18b7e0', seconds: 1.8, decay: 3.2, bright: 0.8, predelay: 0.004, desc: 'Drippy surf / amp spring.' },
      { id: 'room',   name: 'Room',                           short: 'ROOM', color: '#3fd0a0', seconds: 0.9, decay: 2.5, bright: 0.6, predelay: 0.006, desc: 'Small natural room.' },
      { id: 'hall',   name: 'Concert Hall',                   short: 'HALL', color: '#6b7bff', seconds: 3.2, decay: 2.0, bright: 0.5, predelay: 0.02, desc: 'Big, smooth hall.' },
      { id: 'plate',  name: 'Plate',                          short: 'PLATE', color: '#c0c6d0', seconds: 2.2, decay: 2.6, bright: 0.9, predelay: 0.0, desc: 'Bright, dense studio plate.' }
    ]
  };

  /** Default state of a whole pedalboard */
  SDAW.defaultPedals = function () {
    return {
      comp:   { on: false, model: 'dyna',  amount: 0.5, level: 0.6 },
      drive:  { on: false, model: 'ts808', amount: 0.4, tone: 0.5, level: 0.6 },
      dist:   { on: false, model: 'ds1',   amount: 0.55, tone: 0.5, level: 0.5 },
      amp:    { on: false, model: 'twin',  gain: 0.4, bass: 0.5, mid: 0.5, treble: 0.55, presence: 0.5, level: 0.6 },
      eq:     { on: false, model: 'graphic', low: 0, mid: 0, high: 0 },
      chorus: { on: false, model: 'ce2',   rate: 0.35, depth: 0.5, mix: 0.5 },
      delay:  { on: false, model: 'analog', time: 2, feedback: 0.35, mix: 0.25 },
      reverb: { on: true,  model: 'room',  mix: 0.18, tone: 0.6 }
    };
  };
  /** Fill missing pedals / fields (old projects) */
  SDAW.normalizePedals = function (fx) {
    const d = SDAW.defaultPedals();
    fx = fx || {};
    Object.keys(d).forEach(k => { fx[k] = Object.assign({}, d[k], fx[k] || {}); });
    return fx;
  };
  SDAW.pedalModel = function (type, id) {
    const list = SDAW.PEDAL_MODELS[type];
    return list.find(m => m.id === id) || list[0];
  };

  /* ============================================================== DSP === */

  const curveCache = {};
  /** Clipping transfer curve for a model shape and gain */
  function clipCurve(shape, k) {
    const key = shape + '|' + Math.round(k);
    if (curveCache[key]) return curveCache[key];
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1, y = x * k;
      let v;
      if (shape === 'soft') v = Math.tanh(y) / Math.tanh(Math.max(1, k * 0.5));
      else if (shape === 'asym') v = y >= 0 ? Math.tanh(y) : Math.tanh(y * 0.55) / 0.85;
      else if (shape === 'hard') v = y / Math.pow(1 + Math.pow(Math.abs(y), 6), 1 / 6);
      else v = Math.sign(y) * (1 - Math.exp(-Math.abs(y) * 1.6));      // fuzz
      c[i] = Math.max(-1, Math.min(1, v));
    }
    curveCache[key] = c;
    return c;
  }

  const irCache = {};
  /** Generated stereo impulse response for a reverb model */
  function reverbIR(ctx, m) {
    const ck = m.id + '@' + ctx.sampleRate;          // one impulse per sample rate (exports can render at 48 kHz…)
    if (irCache[ck]) return irCache[ck];
    const len = Math.floor(ctx.sampleRate * m.seconds), pre = Math.floor(ctx.sampleRate * m.predelay);
    const buf = ctx.createBuffer(2, len + pre, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        let s = (Math.random() * 2 - 1) * Math.pow(1 - t, m.decay);
        lp += (1 - m.bright * 0.7 - t * 0.25) * (s - lp);          // darker tail
        let v = lp;
        if (m.id === 'spring') v *= 1 + 0.6 * Math.sin(i / ctx.sampleRate * 2 * Math.PI * 9) * (1 - t);  // drip
        d[i + pre] = v;
      }
    }
    irCache[ck] = buf;
    return buf;
  }

  const lin = (a, b, t) => a + (b - a) * t;
  const logRange = (a, b, t) => a * Math.pow(b / a, t);

  /**
   * Build one pedal stage: { in, out, update(state, tempo) }
   * The stage is inserted in the track chain only when the pedal is ON.
   */
  SDAW.makePedalStage = function (ctx, type) {
    const st = { in: ctx.createGain(), out: ctx.createGain(), type };

    if (type === 'comp') {
      const c = ctx.createDynamicsCompressor(), mk = ctx.createGain();
      st.in.connect(c); c.connect(mk); mk.connect(st.out);
      st.update = (s) => {
        const m = SDAW.pedalModel('comp', s.model);
        c.threshold.value = m.thr - s.amount * 25; c.ratio.value = m.ratio; c.attack.value = m.attack; c.release.value = m.release; c.knee.value = m.knee;
        mk.gain.value = (0.6 + s.amount * 1.6) * (s.level * 1.6);
      };
    }

    if (type === 'drive' || type === 'dist') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking';
      const pre = ctx.createGain();
      const sh = ctx.createWaveShaper(); sh.oversample = '4x';
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.7;
      const post = ctx.createBiquadFilter(); post.type = 'peaking';
      const wet = ctx.createGain(), dry = ctx.createGain(), lvl = ctx.createGain();
      st.in.connect(hp); hp.connect(mid); mid.connect(pre); pre.connect(sh); sh.connect(tone); tone.connect(post); post.connect(wet); wet.connect(lvl);
      st.in.connect(dry); dry.connect(lvl); lvl.connect(st.out);
      st.update = (s) => {
        const m = SDAW.pedalModel(type, s.model);
        hp.frequency.value = m.hp;
        mid.frequency.value = m.mid.f; mid.gain.value = m.mid.g; mid.Q.value = m.mid.q;
        const k = 1 + s.amount * m.gain;
        pre.gain.value = 1.4;
        sh.curve = clipCurve(m.curve, k);
        tone.frequency.value = logRange(m.tone[0], m.tone[1], s.tone);
        post.frequency.value = m.post.f; post.gain.value = m.post.g; post.Q.value = m.post.q;
        wet.gain.value = 1 - m.blend; dry.gain.value = m.blend;
        lvl.gain.value = m.out * s.level * 1.6;
      };
    }

    if (type === 'amp') {
      const pre = ctx.createGain(), sh = ctx.createWaveShaper(); sh.oversample = '4x';
      const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf';
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.Q.value = 0.8;
      const treb = ctx.createBiquadFilter(); treb.type = 'highshelf';
      const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2800; pres.Q.value = 1;
      const cabHp = ctx.createBiquadFilter(); cabHp.type = 'highpass'; cabHp.frequency.value = 85;
      const cabLp = ctx.createBiquadFilter(); cabLp.type = 'lowpass'; cabLp.Q.value = 0.9;
      const lvl = ctx.createGain();
      st.in.connect(pre); pre.connect(sh); sh.connect(bass); bass.connect(mid); mid.connect(treb); treb.connect(pres); pres.connect(cabHp); cabHp.connect(cabLp); cabLp.connect(lvl); lvl.connect(st.out);
      st.update = (s) => {
        const m = SDAW.pedalModel('amp', s.model);
        sh.curve = clipCurve(m.curve, 1 + s.gain * m.preGain * 3);
        pre.gain.value = 1;
        bass.frequency.value = m.bassF; bass.gain.value = lin(-10, 10, s.bass);
        mid.frequency.value = m.midF; mid.gain.value = m.midBase + lin(-10, 10, s.mid);
        treb.frequency.value = m.trebleF; treb.gain.value = lin(-10, 10, s.treble);
        pres.gain.value = lin(-4, 8, s.presence);
        cabLp.frequency.value = m.cab;
        lvl.gain.value = s.level * 1.4 / Math.sqrt(1 + s.gain * m.preGain * 0.15);
      };
    }

    if (type === 'eq') {
      const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf';
      const mi = ctx.createBiquadFilter(); mi.type = 'peaking';
      const hi = ctx.createBiquadFilter(); hi.type = 'highshelf';
      st.in.connect(lo); lo.connect(mi); mi.connect(hi); hi.connect(st.out);
      st.update = (s) => {
        const m = SDAW.pedalModel('eq', s.model);
        lo.frequency.value = m.lowF; mi.frequency.value = m.midF; hi.frequency.value = m.highF;
        mi.Q.value = m.id === 'tilt' ? 0.4 : 0.9;
        lo.gain.value = s.low; mi.gain.value = s.mid; hi.gain.value = s.high;
      };
    }

    if (type === 'chorus') {
      const dry = ctx.createGain(), wet = ctx.createGain();
      const d1 = ctx.createDelay(0.05), d2 = ctx.createDelay(0.05);
      const lfo = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain();
      const pan1 = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const pan2 = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan1.pan) { pan1.pan.value = -0.6; pan2.pan.value = 0.6; }
      lfo.connect(g1); g1.connect(d1.delayTime);
      lfo.connect(g2); g2.connect(d2.delayTime);
      lfo.start();
      st.lfos = [lfo];
      st.in.connect(dry); dry.connect(st.out);
      st.in.connect(d1); d1.connect(pan1); pan1.connect(wet);
      st.in.connect(d2); d2.connect(pan2); pan2.connect(wet);
      wet.connect(st.out);
      st.update = (s) => {
        const m = SDAW.pedalModel('chorus', s.model);
        lfo.frequency.value = lin(m.rate[0], m.rate[1], s.rate);
        d1.delayTime.value = m.delay; d2.delayTime.value = m.delay * 1.3;
        g1.gain.value = m.depth * (0.3 + s.depth); g2.gain.value = -m.depth * (0.3 + s.depth);
        wet.gain.value = s.mix * 0.8; dry.gain.value = 1 - s.mix * 0.35;
      };
    }

    if (type === 'delay') {
      const dry = ctx.createGain(), wet = ctx.createGain();
      const d = ctx.createDelay(4), fb = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass';
      const sat = ctx.createWaveShaper(); sat.curve = clipCurve('soft', 1.5);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.7; lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
      st.lfos = [lfo];
      st.in.connect(dry); dry.connect(st.out);
      st.in.connect(d); d.connect(f); f.connect(sat); sat.connect(fb); fb.connect(d);
      sat.connect(wet); wet.connect(st.out);
      st.update = (s, tempo) => {
        const m = SDAW.pedalModel('delay', s.model);
        const beats = (SDAW.DELAY_SYNC[Math.round(s.time)] || SDAW.DELAY_SYNC[2]).beats;
        d.delayTime.setTargetAtTime(Math.min(3.9, beats * 60 / (tempo || 120)), ctx.currentTime, 0.05);
        f.frequency.value = m.filter; lg.gain.value = m.wobble;
        fb.gain.value = s.feedback; wet.gain.value = s.mix; dry.gain.value = 1;
      };
    }

    if (type === 'reverb') {
      const dry = ctx.createGain(), wet = ctx.createGain();
      const conv = ctx.createConvolver(), tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      st.in.connect(dry); dry.connect(st.out);
      st.in.connect(conv); conv.connect(tone); tone.connect(wet); wet.connect(st.out);
      let lastModel = null;
      st.update = (s) => {
        const m = SDAW.pedalModel('reverb', s.model);
        if (lastModel !== m.id) { conv.buffer = reverbIR(ctx, m); lastModel = m.id; }
        tone.frequency.value = logRange(1500, 14000, s.tone);
        wet.gain.value = s.mix * 1.2; dry.gain.value = 1;
      };
    }
    /** the track was deleted: take the stage out of the graph and stop its oscillators */
    st.dispose = () => {
      try { st.in.disconnect(); } catch (e) { /* not connected */ }
      try { st.out.disconnect(); } catch (e) { /* not connected */ }
      (st.lfos || []).forEach(o => { try { o.stop(); o.disconnect(); } catch (e) { /* stopped */ } });
    };
    return st;
  };

})(window.SDAW);
