/* =====================================================================
 *  WIND LAB — engine.js : SOUND ENGINE (tenor sax, trumpet)
 *  ---------------------------------------------------------------------
 *  A wind instrument is ONE player blowing ONE note at a time, so the
 *  realism is in how the notes are started, held, connected and ended.
 *  Every note is a "voice" built from the real recordings:
 *
 *    sources  1–2 recordings of the nearest note (two dynamics crossfaded
 *             by the velocity), looped seamlessly while the note is held;
 *             for long notes the "with vibrato" recording fades in after
 *             the vibrato delay (or a synthetic vibrato is added)
 *    pitch    src.detune: intonation, slow drift, scoops (bend in from
 *             below), slur glides, fall-offs / doits, release sag, bends
 *    level    velocity curve (dynamic range), accent, breathing swell on
 *             long notes, growl (sax) amplitude modulation, release
 *    noises   breath (band-passed air following the note), tongue puff at
 *             the attack, key clicks (sax) / valve noise (trumpet)
 *    legato   MONO mode: a note that starts while (or right after) the
 *             previous one sounds is SLURRED: the old note glides toward
 *             the new pitch and fades, the new one starts after its own
 *             attack (no new tongue) and glides in from the old pitch.
 *    section  up to 3 players: the same line with a different recording,
 *             timing, tuning and stereo position for each player.
 *
 *  Shared chain: voices → microphone (distance, bell axis) → tone EQ →
 *  tube warmth → compressor → position → delay / room / reverb → stereo
 *  width → output → limiter → analyser.
 *
 *  Events (seconds on the AudioContext clock):
 *    { type:'on', t, midi, vel 0..1, id, dur?, stacc?, accent?, vib?, scoop?, fall?, doit?, slur?, tongue? }
 *    { type:'off', t, id }     { type:'bend', t, id, semis, glide }
 *  dur (when known) lets the engine choose staccato and plan vibrato / swells.
 * ===================================================================== */
(function () {
  'use strict';
  const WL = window.WL = window.WL || {};
  const dB = v => Math.pow(10, v / 20);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  /** freeze an automated value at time t (then new ramps start from where it really is) */
  const hold = (prm, t) => { if (prm.cancelAndHoldAtTime) prm.cancelAndHoldAtTime(t); else prm.cancelScheduledValues(t); };
  const DECODE_RATE = () => (WL.CONFIG && WL.CONFIG.decodeRate) || 32000;

  /* ============================================================ LIBRARY == */
  WL.decodeLibrary = async function (meta, bin, onProgress) {
    const oac = new OfflineAudioContext(meta.ch || 1, 1, DECODE_RATE());
    const buffers = new Array(meta.samples.length);
    let done = 0;
    const idx = meta.samples.map((_, i) => i);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (idx.length) {
        const i = idx.shift(), s = meta.samples[i];
        buffers[i] = await oac.decodeAudioData(bin.slice(s.o, s.o + s.n));
        done++; if (onProgress && done % 6 === 0) onProgress(done / meta.samples.length);
      }
    }));
    if (onProgress) onProgress(1);
    // regions grouped by articulation, layers sorted by velocity
    const arts = {};
    meta.regions.forEach(r => { (arts[r.art] = arts[r.art] || []).push(r); });
    Object.keys(arts).forEach(a => {
      const lay = {};
      arts[a].forEach(r => { (lay[r.lv] = lay[r.lv] || []).push(r); });
      arts[a] = Object.keys(lay).map(Number).sort((x, y) => x - y).map(lv => ({ lv, hv: lay[lv][0].hv, regions: lay[lv] }));
    });
    return { meta, buffers, arts };
  };
  WL.loadBundledLibrary = async function (id, onProgress) {
    const meta = await WL.loadAsset('samples/' + id + '.json', 'json');
    const bin = await WL.loadAsset('samples/' + id + '.bin', 'buffer');
    WL.releaseAsset('samples/' + id + '.bin');
    return WL.decodeLibrary(meta, bin, onProgress);
  };
  WL.wantedLib = (type, s) => s.engine === 'Synth model' ? null : WL.TYPES[type].lib;

  /* ======================================================= IMPULSES == */
  let seed = 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  /** reverb: decaying noise that darkens with time + early reflections */
  WL.makeIR = function (ctx, type, seconds, predelayMs) {
    const sr = ctx.sampleRate, pre = Math.round(predelayMs / 1000 * sr), len = pre + Math.round(seconds * sr * 1.05) + 16;
    const buf = ctx.createBuffer(2, len, sr);
    const cfg = { Room: { early: 9, damp: 0.55, er: 0.05 }, Studio: { early: 6, damp: 0.6, er: 0.035 }, Club: { early: 12, damp: 0.62, er: 0.06 }, Hall: { early: 14, damp: 0.75, er: 0.09 }, Plate: { early: 0, damp: 0.25, er: 0 } }[type] || { early: 6, damp: 0.5, er: 0.04 };
    seed = 12345 + Math.round(seconds * 100);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len - pre; i++) {
        const t = i / sr, env = Math.exp(-6.9 * t / seconds);
        const coef = Math.min(0.96, cfg.damp * Math.min(1, t / seconds * 1.6) + (type === 'Plate' ? 0.05 : 0.15));
        lp += (1 - coef) * (rnd() - lp);
        d[pre + i] = lp * env * (i < sr * 0.002 ? i / (sr * 0.002) : 1);
      }
      for (let k = 0; k < cfg.early; k++) { const idx = pre + Math.round(sr * (0.003 + Math.abs(rnd()) * cfg.er)); if (idx < len) d[idx] += rnd() * 0.7 * Math.exp(-k * 0.18); }
    }
    return buf;
  };
  /** early reflections of the room around the player (short, sparse) */
  WL.makeRoomIR = function (ctx) {
    const sr = ctx.sampleRate, len = Math.round(0.09 * sr), buf = ctx.createBuffer(2, len, sr);
    seed = 999;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let k = 0; k < 18; k++) { const i = Math.round(sr * (0.004 + Math.abs(rnd()) * 0.08)); if (i < len) d[i] += rnd() * Math.exp(-i / (sr * 0.04)); }
    }
    return buf;
  };
  /** one second of white noise, shared by the breath / tongue / key noises */
  const noiseCache = new WeakMap();
  function noiseBuffer(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) { b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(ctx, b); }
    return b;
  }

  /* =========================================================== ENGINE == */
  class Engine {
    static async create(ctx, opt) {
      opt = opt || {};
      const e = new Engine();
      e.ctx = ctx; e.lib = null; e.voices = []; e.byId = new Map(); e.lead = [null, null, null]; e.lastOff = -9; e.lastMidi = null;
      e.build(opt.destination || ctx.destination);
      return e;
    }
    build(dest) {
      const ctx = this.ctx, n = this.n = {};
      const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
      const B = (type, f, q, gain) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; b.gain.value = gain || 0; return b; };
      const chain = list => { for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]); return list[list.length - 1]; };
      n.bus = G(1);
      // microphone: proximity (bass), air (distance), bell axis
      n.prox = B('lowshelf', 220, 0.7, 0); n.air = B('highshelf', 6000, 0.7, 0); n.bellMid = B('peaking', 2600, 0.9, 0);
      n.eq = [B('highpass', 40, 0.7), B('lowshelf', 120, 0.7, 0), B('peaking', 400, 0.9, 0), B('peaking', 1200, 0.9, 0), B('peaking', 3000, 1, 0), B('highshelf', 9000, 0.7, 0),
        B('lowshelf', 500, 0.6, 0), B('highshelf', 2500, 0.6, 0), B('lowpass', 18000, 0.7)];
      chain([n.bus, n.prox, n.air, n.bellMid].concat(n.eq));
      const eqOut = n.eq[n.eq.length - 1];
      // tube warmth (parallel)
      n.drv = ctx.createWaveShaper(); n.drv.oversample = '2x'; n.drvWet = G(0); n.drvDry = G(1); n.drvSum = G(1);
      eqOut.connect(n.drvDry); n.drvDry.connect(n.drvSum); chain([eqOut, n.drv, n.drvWet, n.drvSum]);
      // compressor (parallel)
      n.comp = ctx.createDynamicsCompressor(); n.comp.threshold.value = -26; n.comp.ratio.value = 3.5; n.comp.attack.value = 0.008; n.comp.release.value = 0.18; n.comp.knee.value = 10;
      n.compWet = G(0); n.compDry = G(1); n.pos = ctx.createStereoPanner();
      n.drvSum.connect(n.compDry); n.compDry.connect(n.pos); chain([n.drvSum, n.comp, n.compWet, n.pos]);
      // delay / room / reverb
      n.dly = ctx.createDelay(1.5); n.dlyFb = G(0.3); n.dlyLP = B('lowpass', 4200, 0.7); n.dlyWet = G(0);
      n.pos.connect(n.dly); chain([n.dly, n.dlyLP, n.dlyFb, n.dly]); n.dlyLP.connect(n.dlyWet);
      n.room = ctx.createConvolver(); n.room.normalize = false; n.room.buffer = WL.makeRoomIR(ctx); n.roomWet = G(0);
      n.pos.connect(n.room); n.room.connect(n.roomWet);
      n.rev = ctx.createConvolver(); n.revWet = G(0); n.sum = G(1);
      n.pos.connect(n.rev); n.dlyWet.connect(n.rev); n.roomWet.connect(n.rev); n.rev.connect(n.revWet);
      [n.pos, n.dlyWet, n.roomWet, n.revWet].forEach(x => x.connect(n.sum));
      // stereo width (mid / side matrix)
      n.wSplit = ctx.createChannelSplitter(2); n.wMerge = ctx.createChannelMerger(2);
      n.wLL = G(1); n.wRL = G(0); n.wLR = G(0); n.wRR = G(1);
      n.sum.connect(n.wSplit);
      n.wSplit.connect(n.wLL, 0); n.wSplit.connect(n.wLR, 0); n.wSplit.connect(n.wRL, 1); n.wSplit.connect(n.wRR, 1);
      n.wLL.connect(n.wMerge, 0, 0); n.wRL.connect(n.wMerge, 0, 0); n.wLR.connect(n.wMerge, 0, 1); n.wRR.connect(n.wMerge, 0, 1);
      n.out = G(1); n.lim = ctx.createDynamicsCompressor(); n.lim.threshold.value = -1.5; n.lim.ratio.value = 20; n.lim.attack.value = 0.002; n.lim.release.value = 0.12; n.lim.knee.value = 0;
      n.analyser = ctx.createAnalyser(); n.analyser.fftSize = 8192; n.analyser.smoothingTimeConstant = 0.75;
      chain([n.wMerge, n.out, n.lim, n.analyser]); n.analyser.connect(dest);
      this.irKey = ''; this.drvKey = '';
    }
    setLibrary(lib) { this.stop(); this.lib = lib; }
    /** 'samples' or 'model' */
    sourceMode() { return this.lib && this.s && this.s.engine !== 'Synth model' ? 'samples' : 'model'; }
    apply(type, s, opt) {
      opt = opt || {};
      const n = this.n, now = this.ctx.currentTime;
      const set = (prm, v) => { if (opt.immediate) prm.value = v; else prm.setTargetAtTime(v, now, 0.02); };
      this.type = type; this.s = s; this.T = WL.TYPES[type];
      set(n.prox.gain, (0.4 - s.micDist) * 9); set(n.air.gain, -s.micDist * 6 + s.bell * 3); set(n.bellMid.gain, s.bell * 3.5);
      const q = n.eq;
      set(q[0].frequency, s.lowCut); set(q[1].gain, s.eqLow); set(q[2].gain, s.eqLowMid); set(q[3].gain, s.eqMid); set(q[4].gain, s.eqPres); set(q[5].gain, s.eqAir);
      set(q[6].gain, -s.tilt * 5); set(q[7].gain, s.tilt * 6); set(q[8].frequency, s.highCut);
      const dk = s.drive.toFixed(2);
      if (dk !== this.drvKey) {
        this.drvKey = dk;
        const N = 1024, c = new Float32Array(N), k = 1 + s.drive * 10;
        for (let i = 0; i < N; i++) { const x = i / (N - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
        n.drv.curve = c;
      }
      set(n.drvWet.gain, s.drive * 0.8); set(n.drvDry.gain, 1 - s.drive * 0.5);
      set(n.compWet.gain, s.comp * 1.3); set(n.compDry.gain, 1 - s.comp);
      set(n.pos.pan, s.pan);
      set(n.dly.delayTime, s.delayTime / 1000); set(n.dlyFb.gain, s.delayFeedback); set(n.dlyWet.gain, s.delayMix * 0.7);
      set(n.roomWet.gain, s.room * (0.3 + s.micDist) * 0.6);
      const ik = s.reverbType + '|' + s.reverbSize.toFixed(2) + '|' + Math.round(s.predelay);
      if (ik !== this.irKey) { this.irKey = ik; n.rev.buffer = WL.makeIR(this.ctx, s.reverbType, s.reverbSize, s.predelay); }
      set(n.revWet.gain, s.reverbMix * (1.2 + s.micDist * 0.6));
      const w = s.width;
      set(n.wLL.gain, (1 + w) / 2); set(n.wRR.gain, (1 + w) / 2); set(n.wRL.gain, (1 - w) / 2); set(n.wLR.gain, (1 - w) / 2);
      set(n.out.gain, dB(s.output));
    }

    /* --------------------------------------------------- choosing recordings */
    /** articulation actually used for a note */
    artFor(e, legato) {
      const s = this.s, lib = this.lib, has = a => lib && lib.arts[a];
      const mute = s.mute === 'Harmon mute' ? 'harmon' : s.mute === 'Straight mute' ? 'straight' : null;
      if (mute && has(mute)) return mute;                               // the mutes were recorded sustained only
      if (!legato && has('stac') && (e.stacc || (e.dur !== undefined && e.dur < s.stacBelow))) return 'stac';
      return 'sus';
    }
    /** the region of a layer for a key: inside its range, else the nearest key; `skip` = player index (another sample) */
    region(layer, midi, rrPick, skip) {
      let list = layer.regions.filter(r => midi >= r.lo && midi <= r.hi);
      if (!list.length) list = layer.regions.slice().sort((a, b) => Math.abs(a.key - midi) - Math.abs(b.key - midi)).slice(0, 1);
      if (skip) {       // section players: a neighbouring recording, so the players do not phase
        const keys = [...new Set(layer.regions.map(r => r.key))].sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi));
        const k = keys[Math.min(keys.length - 1, skip)];
        const alt = layer.regions.filter(r => r.key === k);
        if (alt.length && Math.abs(k - midi) <= 3) list = alt;
      }
      return list[rrPick % list.length];
    }
    /** 1 or 2 regions + weights for the velocity (crossfade between the two nearest dynamics) */
    pickLayers(art, midi, v127, rr, skip) {
      const layers = this.lib.arts[art];
      if (!layers || !layers.length) return [];
      const centers = layers.map(l => (l.lv + l.hv) / 2);
      if (layers.length === 1 || this.s.layerBlend <= 0) {
        const li = layers.findIndex(l => v127 >= l.lv && v127 <= l.hv);
        return [{ r: this.region(layers[li < 0 ? 0 : li], midi, rr, skip), w: 1 }];
      }
      let i = 0;
      while (i < layers.length - 2 && v127 > centers[i + 1]) i++;
      let x = clamp((v127 - centers[i]) / (centers[i + 1] - centers[i]), 0, 1);
      // blend only in the middle of the zone (layerBlend = width of the crossfade)
      const bw = this.s.layerBlend;
      x = clamp((x - 0.5) / Math.max(0.01, bw) + 0.5, 0, 1);
      const out = [];
      if (x < 0.999) out.push({ r: this.region(layers[i], midi, rr, skip), w: Math.cos(x * Math.PI / 2) });
      if (x > 0.001) out.push({ r: this.region(layers[i + 1], midi, rr, skip), w: Math.sin(x * Math.PI / 2) });
      return out;
    }
    regionGain(r) { return dB(-12 - (r.pk !== undefined ? r.pk : -12)); }

    /* ---------------------------------------------------------------- voices */
    noteOn(e) {
      const s = this.s, ctx = this.ctx, T = this.T;
      const t = Math.max(ctx.currentTime, e.t);
      const players = Math.round(clamp(s.players, 1, 3)), mono = s.mono.startsWith('Mono');
      const midi = clamp(e.midi + s.transpose, 12, 120);
      const vel = clamp(Math.pow(clamp(e.vel, 0.01, 1), s.touch), 0.01, 1);
      // legato: the previous note of the line still sounds (or ended a moment ago)
      const prev = this.lead[0];
      // (ScoreDAW songs mark it: e.slur = slurred even after a tiny gap, e.tongue = always tongued)
      const near = prev && prev.offT !== undefined && prev.offT >= t - (e.slur ? Math.max(0.12, s.legatoGap / 1000) : s.legatoGap / 1000);
      const legato = !!(mono && prev && !e.tongue && (prev.held || near) && prev.midi !== midi && t - prev.t > 0.02);
      const fromMidi = legato ? prev.midi : null;
      const afterRest = !prev || prev.done || (prev.offT !== undefined && t - prev.offT > 0.25);
      const scoop = e.scoop || (!legato && afterRest && (e.accent || (e.dur || 0) > 0.4) && Math.random() < s.scoopAuto);
      for (let p = 0; p < players; p++) {
        const dt = p ? Math.abs(gauss()) * s.secTime / 1000 : 0;
        const pan = players === 1 ? 0 : (p === 0 ? 0 : p === 1 ? -1 : 1) * s.secWidth * 0.6;
        const tune = (p ? gauss() * s.secTune : 0) + gauss() * s.intonation * 0.5;
        const old = this.lead[p];
        if (mono && old) {
          if (legato) this.slurOut(old, t + dt, midi);
          else if (old.held) this.release(old, t + dt, true);
        }
        const v = this.makeVoice(e, t + dt, midi, vel * (p ? 0.92 : 1), { legato, fromMidi, scoop: scoop && !p ? true : scoop && Math.random() < 0.5, pan, tune, player: p });
        if (!v) continue;
        this.lead[p] = v;
        if (!p) this.byId.set(e.id, v);
        else { const list = this.byId.get(e.id + '#s') || []; list.push(v); this.byId.set(e.id + '#s', list); }
      }
      if (!legato && T.family === 'reed' && this.lastMidi !== null && this.lastMidi !== midi) this.click(t - 0.012, 'key');
      if (legato && s.keyNoise > 0) this.click(t, T.family === 'reed' ? 'key' : 'valve');
      this.lastMidi = midi;
    }
    makeVoice(e, t, midi, vel, o) {
      const s = this.s, ctx = this.ctx, mode = this.sourceMode(), T = this.T;
      if (this.voices.length >= (WL.CONFIG.maxVoices || 24)) this.kill(this.voices[0], t);
      const v = { id: e.id, midi, vel, t, held: true, done: false, srcs: [], nodes: [], fall: e.fall, doit: e.doit, offT: undefined, player: o.player };
      const g = v.g = ctx.createGain(); g.gain.value = 0;            // envelope (expression)
      const tone = v.tone = ctx.createBiquadFilter(); tone.type = 'highshelf'; tone.frequency.value = 2400;
      const edge = ctx.createBiquadFilter(); edge.type = 'peaking'; edge.frequency.value = 2800; edge.Q.value = 0.8;
      const pan = v.pan = ctx.createStereoPanner(); pan.pan.value = o.pan;
      g.connect(tone); tone.connect(edge); edge.connect(pan); pan.connect(this.n.bus);
      v.nodes.push(g, tone, edge, pan);
      // ---- brightness: velocity and accents; trumpet blare on loud notes
      tone.gain.value = s.velTone * 12 * (vel - 0.6) + (e.accent ? s.accent * 0.5 : 0);
      edge.gain.value = T.family === 'brass' ? s.flutter * 8 * Math.pow(vel, 3) : 0;
      // ---- pitch modulation bus (detune, cents) shared by every source of the voice
      const det = v.det = ctx.createConstantSource(); det.offset.value = 0; det.start(t);
      const cents0 = o.tune + 1200 * Math.log2(s.a4 / 440);
      v.nodes.push(det);
      // ---- sources
      let amp;
      const legato = o.legato;
      if (mode === 'samples') {
        const art = this.artFor(e, legato), v127 = clamp(Math.round(vel * 127), 1, 127);
        const rr = Math.floor(Math.random() * 8);
        const parts = this.pickLayers(art, midi, v127, rr, o.player);
        if (!parts.length) return null;
        v.art = art;
        const start = legato ? 0.12 + Math.random() * 0.05 : (s.attackSoft / 1000) * 0.2;
        parts.forEach(({ r, w }) => this.addSource(v, r, midi, cents0, w, t, start, art === 'stac' ? 0 : 1));
        // recorded vibrato for long notes: crossfade into the vibrato recording
        const wantVib = s.vibType === 'Recorded (real)' && art !== 'stac' && this.lib.arts.vib && (e.vib || e.dur === undefined || e.dur >= s.vibMinLen) && !art.match(/harmon|straight/);
        if (wantVib) {
          const vparts = this.pickLayers('vib', midi, v127, rr, o.player);
          const tv = t + Math.max(0.05, s.vibDelay), fade = s.vibFade;
          v.vibSrcs = vparts.map(({ r, w }) => this.addSource(v, r, midi, cents0, w, t, start, 1, { from: tv, fade }));
          v.srcs.filter(x => !x.vib).forEach(x => { x.w.gain.setValueAtTime(x.level, tv); x.w.gain.linearRampToValueAtTime(x.level * 0.0001 + 0.0001, tv + fade); });
        }
        amp = dB(s.sampleLevel) * Math.pow(vel, s.dynRange / 38);
      } else {
        this.addSynth(v, midi, cents0, t, vel);
        amp = dB(s.sampleLevel) * Math.pow(vel, s.dynRange / 38) * 0.22;
      }
      v.amp = amp;
      // ---- synthetic vibrato (pitch + a little loudness), delayed
      const synthVib = s.vibType === 'Synthetic' || (s.vibType === 'Recorded (real)' && (mode === 'model' || (v.art && v.art.match(/harmon|straight/))));
      if (synthVib && v.art !== 'stac' && (e.vib || e.dur === undefined || e.dur >= s.vibMinLen)) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = s.vibRate * (0.96 + Math.random() * 0.08);
        const ld = ctx.createGain(); ld.gain.value = 0;
        const t1 = t + s.vibDelay;
        ld.gain.setValueAtTime(0, t1); ld.gain.linearRampToValueAtTime(s.vibDepth, t1 + s.vibFade);
        lfo.connect(ld); ld.connect(det.offset);
        const la = ctx.createGain(); la.gain.value = 0; la.gain.setValueAtTime(0, t1); la.gain.linearRampToValueAtTime(s.vibAmp * 0.12, t1 + s.vibFade);
        const am = ctx.createGain(); am.gain.value = 1;
        g.disconnect(); g.connect(am); am.connect(tone); lfo.connect(la); la.connect(am.gain);
        lfo.start(t); v.nodes.push(lfo, ld, la, am);
      }
      // ---- slow pitch drift while held
      if (s.drift > 0) {
        const dl = ctx.createOscillator(); dl.frequency.value = 0.15 + Math.random() * 0.35;
        const dg = ctx.createGain(); dg.gain.value = s.drift * (0.5 + Math.random() * 0.5);
        dl.connect(dg); dg.connect(det.offset); dl.start(t, Math.random()); v.nodes.push(dl, dg);
      }
      // ---- growl (sax): amplitude modulation, more on loud notes
      if (T.family === 'reed' && s.growl > 0) {
        const d = s.growl * (1 - s.growlAccents + s.growlAccents * vel * vel) * 0.6;
        if (d > 0.01) {
          const gr = ctx.createGain(); gr.gain.value = 1 - d * 0.5;
          const lo = ctx.createOscillator(); lo.type = 'triangle'; lo.frequency.value = s.growlRate * (0.95 + Math.random() * 0.1);
          const lg = ctx.createGain(); lg.gain.value = d * 0.5;
          lo.connect(lg); lg.connect(gr.gain);
          tone.disconnect(); tone.connect(gr); gr.connect(edge);
          const dg2 = ctx.createGain(); dg2.gain.value = d * 18; lo.connect(dg2); dg2.connect(det.offset);   // the growl also roughens the pitch
          lo.start(t); v.nodes.push(gr, lo, lg, dg2);
        }
      }
      // ---- envelope: attack, accent, swell
      const atk = legato ? s.legatoTime / 1000 : Math.max(0.002, s.attackSoft / 1000);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * (e.accent ? dB(s.accent) : 1), t + atk);
      if (e.accent) g.gain.setTargetAtTime(amp, t + atk, 0.06);
      if (e.dur && e.dur >= s.swellMin && s.swell > 0 && v.art !== 'stac') {
        const d = e.dur;
        g.gain.setValueAtTime(amp, t + Math.min(0.2, d * 0.15));
        g.gain.linearRampToValueAtTime(amp * dB(-s.swell * 0.35), t + d * 0.25);
        g.gain.linearRampToValueAtTime(amp * dB(s.swell * 0.6), t + d * 0.7);
        g.gain.linearRampToValueAtTime(amp * dB(s.swell * 0.1), t + d);
      }
      // ---- pitch: slur glide in, scoop
      if (legato && o.fromMidi !== null && s.legatoGlide > 0) {
        const c0 = (o.fromMidi - midi) * 100 * s.legatoGlide;
        det.offset.setValueAtTime(c0, t); det.offset.setTargetAtTime(0, t, s.legatoTime / 1000 / 3);
      } else if (o.scoop && s.scoop > 0) {
        det.offset.setValueAtTime(-s.scoop * (0.6 + 0.4 * vel), t); det.offset.setTargetAtTime(0, t + 0.01, 0.035 + 0.03 * (1 - vel));
      }
      // ---- noises
      this.breath(v, t, midi, vel, amp);
      if (!legato && s.tongue > 0) this.click(t, 'tongue', vel);
      this.voices.push(v);
      return v;
    }
    /** one recording into the voice. vib = crossfade in later ({from, fade}) */
    addSource(v, r, midi, cents0, w, t, start, loop, vib) {
      const ctx = this.ctx, buf = this.lib.buffers[r.s], meta = this.lib.meta.samples[r.s];
      if (!buf) return null;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const tune = r.art === 'stac' && Math.abs(r.tune) > 15 ? 0 : (r.tune || 0);
      src.playbackRate.value = Math.pow(2, ((midi - r.key) * 100 + tune + cents0) / 1200);
      v.det.connect(src.detune);
      if (loop && meta.loop) { src.loop = true; src.loopStart = meta.loop[0]; src.loopEnd = meta.loop[1]; }
      const wg = ctx.createGain(), level = this.regionGain(r) * w;
      wg.gain.value = vib ? 0 : level;
      if (vib) { wg.gain.setValueAtTime(0, vib.from); wg.gain.linearRampToValueAtTime(level, vib.from + vib.fade); }
      src.connect(wg); wg.connect(v.g);
      src.start(t, Math.min(start, buf.duration * 0.4));
      const o = { src, w: wg, level, vib: !!vib };
      v.srcs.push(o);
      src.onended = () => { if (v.srcs.every(x => x.ended || x === o)) this.finish(v); o.ended = true; };
      return o;
    }
    /** synth model (no recordings): band-limited oscillators + formants */
    addSynth(v, midi, cents0, t, vel) {
      const ctx = this.ctx, T = this.T, f = 440 * Math.pow(2, (midi - 69) / 12);
      const o1 = ctx.createOscillator(); o1.type = T.family === 'reed' ? 'square' : 'sawtooth'; o1.frequency.value = f; o1.detune.value = cents0;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = cents0 + 4;
      v.det.connect(o1.detune); v.det.connect(o2.detune);
      const mix = ctx.createGain(); mix.gain.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9;
      const fc = f * (T.family === 'reed' ? 3 + 7 * vel : 4 + 12 * vel);
      lp.frequency.setValueAtTime(f * 2, t); lp.frequency.exponentialRampToValueAtTime(Math.min(16000, fc), t + 0.05 + 0.05 * (1 - vel));
      const fm = [[T.family === 'reed' ? 520 : 1200, 1.2, 6], [T.family === 'reed' ? 1500 : 2400, 1.5, 4], [T.family === 'reed' ? 2600 : 3800, 2, 2]].map(([fr, q, gg]) => { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = fr; b.Q.value = q; b.gain.value = gg; return b; });
      o1.connect(mix); o2.connect(mix); mix.connect(lp);
      let last = lp; fm.forEach(b => { last.connect(b); last = b; });
      last.connect(v.g);
      o1.start(t); o2.start(t);
      [o1, o2].forEach(src => v.srcs.push({ src, w: mix, level: 0.5 }));
      v.nodes.push(mix, lp, ...fm);
      o1.onended = () => this.finish(v);
    }
    /** breath noise inside the note (band-passed air, following its envelope) */
    breath(v, t, midi, vel, amp) {
      const s = this.s, ctx = this.ctx; if (s.breath <= 0) return;
      const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx); nz.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      const reed = this.T.family === 'reed';
      bp.frequency.value = (reed ? 1800 : 3200) * Math.pow(2, (midi - 62) / 36); bp.Q.value = reed ? 0.8 : 1.3;
      const ng = ctx.createGain();
      // more air on soft and low notes, closer microphone = more air
      ng.gain.value = s.breath * (reed ? 0.09 : 0.05) * (1.3 - vel * 0.7) * (1.4 - s.micDist) * (1 + Math.max(0, 60 - midi) / 30);
      nz.connect(bp); bp.connect(ng); ng.connect(v.g);
      nz.start(t, Math.random() * 0.9);
      v.srcs.push({ src: nz, w: ng, level: ng.gain.value, noise: true });
      v.nodes.push(bp);
    }
    /** short noises: tongue puff, sax key click, trumpet valve */
    click(t, kind, vel) {
      const s = this.s, ctx = this.ctx;
      const lvl = kind === 'tongue' ? s.tongue * 0.05 * (0.4 + 0.6 * (vel || 0.7)) : s.keyNoise * (kind === 'key' ? 0.035 : 0.02);
      if (lvl <= 0.0005) return;
      t = Math.max(ctx.currentTime, t);
      const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter(); bp.type = kind === 'tongue' ? 'highpass' : 'bandpass';
      bp.frequency.value = kind === 'tongue' ? 1400 : kind === 'key' ? 700 + Math.random() * 400 : 1600 + Math.random() * 500; bp.Q.value = kind === 'tongue' ? 0.7 : 3;
      const g = ctx.createGain(), len = kind === 'tongue' ? 0.03 : kind === 'key' ? 0.012 : 0.02;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.002); g.gain.exponentialRampToValueAtTime(lvl * 0.001 + 1e-6, t + len);
      nz.connect(bp); bp.connect(g); g.connect(this.n.bus);
      nz.start(t, Math.random() * 0.8); nz.stop(t + len + 0.02);
      nz.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } };
    }
    /** slurred out: glide toward the next pitch and fade (legato) */
    slurOut(v, t, toMidi) {
      const s = this.s, lt = s.legatoTime / 1000, wasHeld = v.held;
      v.held = false; v.done = true;
      try {
        hold(v.det.offset, t);
        v.det.offset.setTargetAtTime((toMidi - v.midi) * 100 * s.legatoGlide, t, lt / 3);
        if (wasHeld || v.offT >= t - 0.005) { hold(v.g.gain, t); v.g.gain.setTargetAtTime(0, t + lt * 0.3, lt / 3); }
      } catch (e) { /* ended */ }
      this.stopAt(v, t + lt * 3 + 0.05);
    }
    /** stop blowing: release (with fall / doit when marked) */
    release(v, t, quick) {
      if (v.done && !v.held) return;
      const s = this.s, ctx = this.ctx;
      v.held = false; v.offT = t;
      t = Math.max(ctx.currentTime, t);
      let rt = quick ? 0.04 : s.releaseTime;
      try {
        hold(v.g.gain, t);
        if (v.fall || v.doit) {
          const ft = s.fallTime, semis = v.fall ? -s.fall : s.doit;
          hold(v.det.offset, t); v.det.offset.linearRampToValueAtTime(semis * 100, t + ft);
          v.g.gain.linearRampToValueAtTime(v.amp * 0.9, t + ft * 0.4); v.g.gain.linearRampToValueAtTime(0.0001, t + ft);
          rt = ft;
        } else {
          if (s.releaseFall > 0 && !quick) { hold(v.det.offset, t); v.det.offset.setTargetAtTime(-s.releaseFall, t, rt / 2); }
          v.g.gain.setTargetAtTime(0, t, rt / 3);
        }
      } catch (e) { /* ended */ }
      v.done = true;
      this.stopAt(v, t + rt * 3 + 0.05);
    }
    stopAt(v, t) {
      if (v.stopT && v.stopT <= t) return;
      v.stopT = t;
      v.srcs.forEach(x => { try { x.src.stop(t); } catch (e) { /* stopped */ } });
      v.nodes.forEach(x => { if (x.stop) try { x.stop(t); } catch (e) { /* stopped */ } });
    }
    kill(v, t) { v.held = false; v.done = true; try { hold(v.g.gain, t); v.g.gain.setTargetAtTime(0, t, 0.01); } catch (e) { /* ended */ } this.stopAt(v, t + 0.06); this.finish(v); }
    finish(v) {
      const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1);
      v.done = true;
      setTimeout(() => { try { v.pan.disconnect(); } catch (e) { /* gone */ } }, 200);
    }
    noteOff(e) {
      const t = Math.max(this.ctx.currentTime, e.t);
      const v = this.byId.get(e.id), extra = this.byId.get(e.id + '#s') || [];
      this.byId.delete(e.id); this.byId.delete(e.id + '#s');
      [v].concat(extra).forEach(x => { if (x && x.held) { x.offT = t; this.release(x, Math.max(t, x.t + 0.03)); } });
      this.lastOff = t;
    }
    bend(e) {
      const t = Math.max(this.ctx.currentTime, e.t), v = this.byId.get(e.id); if (!v) return;
      [v].concat(this.byId.get(e.id + '#s') || []).forEach(x => { x.det.offset.setTargetAtTime(e.semis * 100, t, Math.max(0.01, (e.glide || 0.1) / 3)); });
    }
    send(list) {
      for (const e of list) {
        if (e.type === 'on') this.noteOn(e); else if (e.type === 'off') this.noteOff(e); else if (e.type === 'bend') this.bend(e);
      }
    }
    stop() {
      const t = this.ctx.currentTime;
      this.voices.slice().forEach(v => this.kill(v, t));
      this.voices = []; this.byId.clear(); this.lead = [null, null, null]; this.lastMidi = null;
    }
    dispose() {
      try { this.stop(); } catch (e) { /* closed */ }
      try { this.n.analyser.disconnect(); } catch (e) { /* gone */ }
      const n = this.n;
      // take EVERY node of the engine out of the graph: an AnalyserNode without an output is still
      // processed by the browser, and with it the whole effect chain that feeds it (compressors,
      // reverbs, delays) — for ever, for every deleted track and every replaced song
      Object.keys(n).forEach(k => [].concat(n[k]).forEach(x => {
        if (!x || typeof x.disconnect !== 'function') return;
        try { x.disconnect(); } catch (e) { /* not connected */ }
        if (typeof x.stop === 'function') { try { x.stop(); } catch (e) { /* not started / stopped */ } }
      }));
    }
  }
  WL.Engine = Engine;

  /* ========================================================== OFFLINE == */
  WL.renderOffline = async function (type, s, events, seconds, sr, lib) {
    const oc = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const eng = await Engine.create(oc, {});
    eng.lib = lib && WL.wantedLib(type, s) ? lib : null;
    eng.apply(type, s, { immediate: true });
    eng.send(events);
    return oc.startRendering();
  };
})();
