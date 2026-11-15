/* =============================================================================
 *  GENERATORS.JS — sound generators (instrument "plugins" of the DAW)
 *  -----------------------------------------------------------------------------
 *  A generator is what makes the sound of a track. Library → Generators lists
 *  them; drag one onto the Arrange (new track) or onto a track (replace the
 *  sound). Edit the selected track's generator in the Generator view (F8).
 *
 *    3x Osc Synth   3 oscillators (sine / triangle / saw / square / noise,
 *                   octave, detune, volume) → resonant low-pass filter with
 *                   envelope → amp ADSR, LFO (pitch / filter / volume), glide.
 *                   Guitar techniques (bend, slide, vibrato) work on it too.
 *    Sampler        plays real samples (drop sounds / folders on it)
 *    Guitar / Bass  physical string model (Karplus-Strong)
 *    Keys           piano / electric piano / organ
 *    Ensemble       strings and pads
 *    Drum Synth     synthesized drum kit (pads can take real samples)
 *
 *  Presets of the 3x Osc are plain objects below: add your own.
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  /** Default 3x Osc settings */
  SDAW.GEN_DEFAULT = {
    osc: [
      { wave: 'sawtooth', oct: 0, det: 0, vol: 0.7 },
      { wave: 'square', oct: -1, det: 6, vol: 0.35 },
      { wave: 'sine', oct: 1, det: 0, vol: 0 }
    ],
    cutoff: 2800, res: 3, envAmt: 0.5, a: 0.008, d: 0.35, s: 0.6, r: 0.3,
    lfoRate: 5, lfoDepth: 0, lfoTo: 'pitch', glide: 0, gain: 0.8
  };

  /** 3x Osc presets */
  SDAW.GEN_PRESETS = {
    'Init':        {},
    'Saw Lead':    { osc: [{ wave: 'sawtooth', oct: 0, det: -7, vol: 0.6 }, { wave: 'sawtooth', oct: 0, det: 7, vol: 0.6 }, { wave: 'square', oct: -1, det: 0, vol: 0.3 }], cutoff: 3500, res: 5, envAmt: 0.4, a: 0.005, d: 0.3, s: 0.75, r: 0.25, glide: 0.04, lfoTo: 'pitch', lfoDepth: 0.15, lfoRate: 5.5 },
    'Fat Bass':    { osc: [{ wave: 'sawtooth', oct: -1, det: 0, vol: 0.7 }, { wave: 'square', oct: -2, det: 0, vol: 0.6 }, { wave: 'sine', oct: -2, det: 0, vol: 0.5 }], cutoff: 700, res: 6, envAmt: 0.7, a: 0.003, d: 0.25, s: 0.4, r: 0.12 },
    'Soft Pad':    { osc: [{ wave: 'sawtooth', oct: 0, det: -10, vol: 0.45 }, { wave: 'sawtooth', oct: 0, det: 10, vol: 0.45 }, { wave: 'triangle', oct: 1, det: 0, vol: 0.3 }], cutoff: 1600, res: 1.5, envAmt: 0.2, a: 0.6, d: 1, s: 0.8, r: 1.2, lfoTo: 'cutoff', lfoDepth: 0.25, lfoRate: 0.4 },
    'Pluck':       { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.5 }, { wave: 'sawtooth', oct: 1, det: 3, vol: 0.3 }, { wave: 'sine', oct: -1, det: 0, vol: 0.4 }], cutoff: 900, res: 7, envAmt: 0.9, a: 0.002, d: 0.22, s: 0.0, r: 0.2 },
    'Brass':       { osc: [{ wave: 'sawtooth', oct: 0, det: -4, vol: 0.6 }, { wave: 'sawtooth', oct: 0, det: 4, vol: 0.6 }, { wave: 'square', oct: -1, det: 0, vol: 0.2 }], cutoff: 1400, res: 2, envAmt: 0.6, a: 0.06, d: 0.4, s: 0.7, r: 0.25 },
    'Organ':       { osc: [{ wave: 'sine', oct: 0, det: 0, vol: 0.6 }, { wave: 'sine', oct: 1, det: 0, vol: 0.4 }, { wave: 'sine', oct: 2, det: 0, vol: 0.25 }], cutoff: 9000, res: 0.7, envAmt: 0, a: 0.01, d: 0.1, s: 1, r: 0.08, lfoTo: 'amp', lfoDepth: 0.15, lfoRate: 6.5 },
    'Chip Square': { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.6 }, { wave: 'square', oct: 1, det: 0, vol: 0.15 }, { wave: 'noise', oct: 0, det: 0, vol: 0 }], cutoff: 12000, res: 0.7, envAmt: 0, a: 0.001, d: 0.1, s: 0.8, r: 0.05 },
    // ---- acoustic-style instruments used by the genre styles (styles.js) ----
    'Trumpet':     { osc: [{ wave: 'sawtooth', oct: 0, det: -3, vol: 0.55 }, { wave: 'sawtooth', oct: 0, det: 3, vol: 0.5 }, { wave: 'square', oct: 0, det: 0, vol: 0.12 }], cutoff: 1500, res: 1.6, envAmt: 0.65, a: 0.03, d: 0.25, s: 0.75, r: 0.12, lfoTo: 'pitch', lfoDepth: 0.08, lfoRate: 5.5, glide: 0.02, gain: 0.7 },
    'Trombone':    { osc: [{ wave: 'sawtooth', oct: 0, det: 0, vol: 0.6 }, { wave: 'sawtooth', oct: 0, det: 5, vol: 0.45 }, { wave: 'triangle', oct: -1, det: 0, vol: 0.2 }], cutoff: 900, res: 1.2, envAmt: 0.5, a: 0.06, d: 0.3, s: 0.8, r: 0.18, lfoTo: 'pitch', lfoDepth: 0.05, lfoRate: 5, glide: 0.04, gain: 0.75 },
    'Alto Sax':    { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.5 }, { wave: 'sawtooth', oct: 0, det: 4, vol: 0.4 }, { wave: 'sine', oct: 1, det: 0, vol: 0.1 }], cutoff: 1900, res: 4, envAmt: 0.45, a: 0.025, d: 0.2, s: 0.8, r: 0.12, lfoTo: 'pitch', lfoDepth: 0.12, lfoRate: 5.2, glide: 0.03, gain: 0.65 },
    'Tenor Sax':   { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.5 }, { wave: 'sawtooth', oct: 0, det: -5, vol: 0.45 }, { wave: 'sine', oct: -1, det: 0, vol: 0.15 }], cutoff: 1300, res: 5, envAmt: 0.45, a: 0.03, d: 0.25, s: 0.8, r: 0.15, lfoTo: 'pitch', lfoDepth: 0.14, lfoRate: 4.8, glide: 0.04, gain: 0.7 },
    'Flute':       { osc: [{ wave: 'sine', oct: 0, det: 0, vol: 0.7 }, { wave: 'triangle', oct: 1, det: 0, vol: 0.15 }, { wave: 'noise', oct: 0, det: 0, vol: 0.05 }], cutoff: 4200, res: 0.7, envAmt: 0.1, a: 0.05, d: 0.2, s: 0.85, r: 0.15, lfoTo: 'pitch', lfoDepth: 0.1, lfoRate: 5, glide: 0.02, gain: 0.7 },
    'Accordion':   { osc: [{ wave: 'square', oct: 0, det: -9, vol: 0.42 }, { wave: 'square', oct: 0, det: 9, vol: 0.42 }, { wave: 'sawtooth', oct: 1, det: 0, vol: 0.18 }], cutoff: 2600, res: 1, envAmt: 0.1, a: 0.02, d: 0.1, s: 0.95, r: 0.1, lfoTo: 'amp', lfoDepth: 0.1, lfoRate: 6, gain: 0.55 },
    'Fiddle':      { osc: [{ wave: 'sawtooth', oct: 0, det: -3, vol: 0.6 }, { wave: 'sawtooth', oct: 0, det: 4, vol: 0.5 }, { wave: 'triangle', oct: 1, det: 0, vol: 0.1 }], cutoff: 2600, res: 3, envAmt: 0.3, a: 0.07, d: 0.2, s: 0.85, r: 0.2, lfoTo: 'pitch', lfoDepth: 0.18, lfoRate: 5.8, glide: 0.03, gain: 0.6 },
    'Harmonica':   { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.5 }, { wave: 'sawtooth', oct: 0, det: 6, vol: 0.3 }, { wave: 'triangle', oct: 1, det: 0, vol: 0.1 }], cutoff: 1700, res: 6, envAmt: 0.4, a: 0.03, d: 0.2, s: 0.8, r: 0.12, lfoTo: 'amp', lfoDepth: 0.12, lfoRate: 5.5, glide: 0.05, gain: 0.6 },
    'Clavinet':    { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.6 }, { wave: 'sawtooth', oct: 1, det: 0, vol: 0.3 }, { wave: 'sine', oct: -1, det: 0, vol: 0.1 }], cutoff: 2400, res: 8, envAmt: 0.8, a: 0.001, d: 0.25, s: 0.15, r: 0.08, gain: 0.6 },
    '808 Bass':    { osc: [{ wave: 'sine', oct: 0, det: 0, vol: 0.95 }, { wave: 'triangle', oct: 0, det: 0, vol: 0.2 }, { wave: 'sine', oct: 1, det: 0, vol: 0.05 }], cutoff: 500, res: 1, envAmt: 0.2, a: 0.002, d: 1.2, s: 0.35, r: 0.25, glide: 0.06, gain: 1 },
    'Melodica':    { osc: [{ wave: 'square', oct: 0, det: 0, vol: 0.4 }, { wave: 'sawtooth', oct: 0, det: 5, vol: 0.4 }, { wave: 'sine', oct: 1, det: 0, vol: 0.1 }], cutoff: 2200, res: 2, envAmt: 0.2, a: 0.03, d: 0.1, s: 0.9, r: 0.1, lfoTo: 'amp', lfoDepth: 0.06, lfoRate: 5, gain: 0.6 },
    'Vibraphone':  { osc: [{ wave: 'sine', oct: 0, det: 0, vol: 0.7 }, { wave: 'sine', oct: 2, det: 0, vol: 0.15 }, { wave: 'triangle', oct: 1, det: 0, vol: 0.1 }], cutoff: 6000, res: 0.7, envAmt: 0.1, a: 0.002, d: 1.4, s: 0, r: 1, lfoTo: 'amp', lfoDepth: 0.25, lfoRate: 5, gain: 0.7 },
    // ---- voices: formant filters ("aah", "ooh"…) + a singer's delayed vibrato ----
    'Lead Vocal':  { osc: [{ wave: 'sawtooth', oct: 0, det: -4, vol: 0.55 }, { wave: 'sawtooth', oct: 0, det: 5, vol: 0.45 }, { wave: 'noise', oct: 0, det: 0, vol: 0.02 }], cutoff: 5200, res: 0.7, envAmt: 0.05, a: 0.05, d: 0.2, s: 0.9, r: 0.18, glide: 0.05, gain: 0.9, formant: 'ah', voiceVib: 0.5 },
    'Female Vocal': { osc: [{ wave: 'sawtooth', oct: 0, det: -3, vol: 0.5 }, { wave: 'triangle', oct: 0, det: 4, vol: 0.4 }, { wave: 'noise', oct: 0, det: 0, vol: 0.02 }], cutoff: 6500, res: 0.7, envAmt: 0.05, a: 0.04, d: 0.2, s: 0.9, r: 0.2, glide: 0.04, gain: 0.85, formant: 'ah-f', voiceVib: 0.55 },
    'Choir Aah':   { osc: [{ wave: 'sawtooth', oct: 0, det: -12, vol: 0.45 }, { wave: 'sawtooth', oct: 0, det: 11, vol: 0.45 }, { wave: 'sawtooth', oct: 0, det: 0, vol: 0.3 }], cutoff: 4200, res: 0.7, envAmt: 0, a: 0.18, d: 0.3, s: 0.95, r: 0.45, gain: 0.7, formant: 'ah', voiceVib: 0.3 },
    'Choir Ooh':   { osc: [{ wave: 'sawtooth', oct: 0, det: -10, vol: 0.4 }, { wave: 'triangle', oct: 0, det: 9, vol: 0.5 }, { wave: 'sine', oct: 0, det: 0, vol: 0.3 }], cutoff: 3000, res: 0.7, envAmt: 0, a: 0.2, d: 0.3, s: 0.95, r: 0.5, gain: 0.8, formant: 'oo', voiceVib: 0.25 },
    'Wobble Bass': { osc: [{ wave: 'sawtooth', oct: -1, det: 0, vol: 0.7 }, { wave: 'square', oct: -2, det: 0, vol: 0.5 }, { wave: 'sine', oct: -2, det: 0, vol: 0.4 }], cutoff: 500, res: 9, envAmt: 0.2, a: 0.005, d: 0.2, s: 0.8, r: 0.15, lfoTo: 'cutoff', lfoDepth: 0.85, lfoRate: 3 }
  };
  /**
   * Vowel formants (Hz, relative gain): parallel band-pass filters that turn a
   * buzzy oscillator into "aah", "ooh"… (male average; '-f' = female).
   */
  SDAW.FORMANTS = {
    ah: [[730, 1], [1090, 0.5], [2440, 0.22]], oo: [[300, 1], [870, 0.35], [2240, 0.1]],
    eh: [[530, 1], [1840, 0.45], [2480, 0.25]], oh: [[570, 1], [840, 0.45], [2410, 0.15]],
    'ah-f': [[850, 1], [1220, 0.5], [2810, 0.25]], 'oo-f': [[370, 1], [950, 0.35], [2670, 0.1]]
  };

  SDAW.genPreset = function (name) {
    const p = SDAW.deepCopy(SDAW.GEN_DEFAULT);
    const pr = SDAW.GEN_PRESETS[name] || {};
    Object.keys(pr).forEach(k => { p[k] = SDAW.deepCopy(pr[k]); });
    p.preset = name;
    return p;
  };

  /** Generators shown in Library → Generators (same shape as library instruments) */
  SDAW.GENERATORS = [
    { group: '3x Osc Synth', icon: '🎛️', items: Object.keys(SDAW.GEN_PRESETS).map(name => ({
      name: '3x Osc — ' + name, engine: 'gen', type: /Bass/.test(name) ? 'bass' : /Pad/.test(name) ? 'strings' : 'synth', source: 'Generator',
      params: { gen: SDAW.genPreset(name) }, desc: 'Subtractive synth with 3 oscillators, filter, envelopes and LFO.'
    })) },
    { group: 'Sampler', icon: '🔊', items: [
      { name: 'Sampler (empty)', engine: 'keys', type: 'keys', source: 'Generator', params: { sampler: true }, desc: 'Drop a sample or a folder of samples (Library → Sounds / Folders) on its track or Sound Slot.' }
    ] },
    { group: 'Physical models', icon: '🎸', items: [
      { name: 'Guitar String Model', engine: 'guitar', type: 'guitar', source: 'Generator', params: { brightness: 0.6, decay: 0.996 }, desc: 'Plucked string (Karplus-Strong) with all guitar techniques.' },
      { name: 'Bass String Model', engine: 'bass', type: 'bass', source: 'Generator', params: { brightness: 0.4 }, desc: 'Plucked bass string with sub.' }
    ] },
    { group: 'Keys & Ensemble', icon: '🎹', items: [
      { name: 'Keys — Piano', engine: 'keys', type: 'keys', source: 'Generator', params: { tone: 'piano' } },
      { name: 'Keys — Electric Piano', engine: 'keys', type: 'keys', source: 'Generator', params: { tone: 'ep' } },
      { name: 'Keys — Organ', engine: 'keys', type: 'keys', source: 'Generator', params: { tone: 'organ' } },
      { name: 'Ensemble — Strings', engine: 'strings', type: 'strings', source: 'Generator', params: { cutoff: 2200 } }
    ] },
    { group: 'Drums', icon: '🥁', items: [
      { name: 'Drum Synth', engine: 'drums', type: 'drums', source: 'Generator', params: {}, desc: 'Synthesized kit; every pad can take a real sample.' }
    ] }
  ];

  /* ============================================================== DSP === */
  let noiseBuf = null;
  /**
   * Play one note on the 3x Osc generator.
   * Called by the audio engine: (A, track, pitch, time, dur, opts, dest)
   */
  SDAW.genPlay = function (A, track, pitch, time, dur, opts, dest) {
    const c = A.ctx;
    const P = Object.assign(SDAW.deepCopy(SDAW.GEN_DEFAULT), (track.params && track.params.gen) || {});
    const tech = opts.tech || {}, T = track.technique || {};
    const vel = (opts.vel || 100) / 127;
    const end = time + Math.max(dur, P.a + 0.01);
    const stopAt = end + P.r * 2.5 + 0.05;

    // amplitude envelope (ADSR)
    const amp = c.createGain(), peak = 0.2 * vel * (P.gain || 0.8);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(peak, time + P.a);
    amp.gain.setTargetAtTime(Math.max(0.0001, peak * P.s), time + P.a, Math.max(0.005, P.d / 3));
    amp.gain.setTargetAtTime(0.0001, end, Math.max(0.005, P.r / 4));

    // filter with envelope
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = P.res;
    const cut = P.cutoff, top = Math.min(18000, cut * (1 + P.envAmt * 6));
    flt.frequency.setValueAtTime(cut, time);
    flt.frequency.linearRampToValueAtTime(top, time + P.a);
    flt.frequency.setTargetAtTime(Math.max(40, cut * (0.4 + 0.6 * P.s)), time + P.a, Math.max(0.01, P.d / 3));
    if (P.formant && SDAW.FORMANTS[P.formant]) {
      // voice: the filtered tone goes through the vowel's formant resonances (+ a little dry)
      const fsum = c.createGain(); fsum.gain.value = 2.2;
      SDAW.FORMANTS[P.formant].forEach(([f, g]) => {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f / 90;
        const bg = c.createGain(); bg.gain.value = g;
        flt.connect(bp); bp.connect(bg); bg.connect(fsum);
      });
      const dry = c.createGain(); dry.gain.value = 0.12; flt.connect(dry); dry.connect(fsum);
      fsum.connect(amp);
    } else flt.connect(amp);
    amp.connect(dest);

    // pitch movement in cents: glide / slides / bends / vibrato
    const detuneTargets = [];
    const oscs = [];
    P.osc.forEach(o => {
      if (!o.vol) return;
      let src;
      if (o.wave === 'noise') {
        if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      } else {
        src = c.createOscillator(); src.type = o.wave;
        src.frequency.value = SDAW.midiToFreq(pitch + o.oct * 12);
        src.detune.value = o.det || 0;
        detuneTargets.push({ p: src.detune, base: o.det || 0 });
      }
      const g = c.createGain(); g.gain.value = o.vol;
      src.connect(g); g.connect(flt);
      src.start(time); src.stop(stopAt);
      oscs.push(src);
      if (A.keep) A.keep(src, stopAt);
    });
    const prev = opts.prevPitch;
    detuneTargets.forEach(({ p, base }) => {
      p.setValueAtTime(base, time);
      const glide = (tech.slide && prev !== undefined) ? (T.slideTime || 0.12) : (P.glide && prev !== undefined ? P.glide : 0);
      if (glide) { p.setValueAtTime(base + (prev - pitch) * 100, time); p.linearRampToValueAtTime(base, time + glide); }
      if (tech.bend) {
        const st = typeof tech.bend === 'number' ? tech.bend : 2, type = tech.bendType || 'up';
        if (type === 'up') { p.setValueAtTime(base, time + dur * 0.12); p.linearRampToValueAtTime(base + st * 100, time + dur * 0.42); }
        else if (type === 'release') { p.setValueAtTime(base, time + dur * 0.1); p.linearRampToValueAtTime(base + st * 100, time + dur * 0.35); p.setValueAtTime(base + st * 100, time + dur * 0.55); p.linearRampToValueAtTime(base, time + dur * 0.85); }
        else if (type === 'pre') p.setValueAtTime(base + st * 100, time);
        else { p.setValueAtTime(base + st * 100, time); p.setValueAtTime(base + st * 100, time + dur * 0.15); p.linearRampToValueAtTime(base, time + dur * 0.5); }
      }
    });
    // singer's vibrato: starts after the attack of long notes, deepens slowly
    if (P.voiceVib && dur > 0.32) {
      const vl = c.createOscillator(), vg = c.createGain();
      vl.frequency.value = 5.2 + Math.random() * 0.6;
      vg.gain.setValueAtTime(0, time);
      vg.gain.setValueAtTime(0, time + Math.min(0.28, dur * 0.35));
      vg.gain.linearRampToValueAtTime(22 * P.voiceVib, time + Math.min(0.75, dur * 0.8));
      vl.connect(vg); detuneTargets.forEach(d => vg.connect(d.p));
      vl.start(time); vl.stop(stopAt);
    }
    // LFO (also used for the vibrato technique)
    const vibDepth = (tech.vib ? 25 : 0) + (tech.wvib ? 60 : 0);
    if (P.lfoDepth > 0 || vibDepth) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = vibDepth ? (T.vibSpeed || 5.5) : P.lfoRate;
      lfo.connect(lg);
      if (vibDepth || P.lfoTo === 'pitch') { lg.gain.value = vibDepth || P.lfoDepth * 60; detuneTargets.forEach(d => lg.connect(d.p)); }
      else if (P.lfoTo === 'cutoff') { lg.gain.value = P.lfoDepth * cut * 0.9; lg.connect(flt.frequency); }
      else { const trem = c.createGain(); trem.gain.value = 1; lg.gain.value = P.lfoDepth * 0.8; lg.connect(trem.gain); amp.disconnect(); amp.connect(trem); trem.connect(dest); }
      lfo.start(time); lfo.stop(stopAt);
    }
  };

})(window.SDAW);
