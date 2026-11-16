/* =====================================================================
 *  GUITAR LAB — sampler.js : REAL RECORDINGS engine
 *  ---------------------------------------------------------------------
 *  Plays multi-sampled real guitars (open-licence libraries bundled in
 *  samples/*.bin + *.json, or any SFZ library the user loads from a folder).
 *
 *  · per-string voices (a new note on a string replaces the old one, like a real guitar)
 *  · velocity layers + round robins (never the same sample twice in a row)
 *  · release noises (finger lifting off the string) and fret / mute noises
 *  · pitch: exact sample when available, otherwise the nearest one re-pitched
 *  · bends, delayed vibrato, slides (glide), hammer-ons, palm mute, dead notes
 *  · looped samples (short libraries) get a natural exponential decay
 *  Events are the same as the physical model's: {type:'on'|'off'|'bend', t, s, midi, vel, id, ...}
 * ===================================================================== */
(function () {
  'use strict';
  const GL = window.GL = window.GL || {};
  const DECODE_RATE = 32000;              // decoded at 32 kHz: half the memory of 48 kHz, nothing lost below 16 kHz
  const dB = v => Math.pow(10, v / 20);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------ library data */
  /** Decode a bundled library: meta JSON + concatenated audio → AudioBuffers */
  GL.decodeLibrary = async function (meta, bin, onProgress) {
    const oac = new OfflineAudioContext(1, 1, DECODE_RATE);
    const buffers = new Array(meta.samples.length);
    let done = 0;
    const one = async i => {
      const s = meta.samples[i];
      const slice = bin.slice(s.o, s.o + s.n);
      buffers[i] = await oac.decodeAudioData(slice);
      done++; if (onProgress && done % 8 === 0) onProgress(done / meta.samples.length);
    };
    const idx = meta.samples.map((_, i) => i);
    const workers = Array.from({ length: 6 }, async () => { while (idx.length) await one(idx.shift()); });
    await Promise.all(workers);
    if (onProgress) onProgress(1);
    return { meta, buffers };
  };

  /** Fetch + decode a bundled library (needs the local server: http://) */
  GL.loadBundledLibrary = async function (id, onProgress) {
    // fetch() over http(s), script packs from disk (see GL.loadAsset in presets.js)
    const meta = await GL.loadAsset('samples/' + id + '.json', 'json');
    const bin = await GL.loadAsset('samples/' + id + '.bin', 'buffer');
    GL.releaseAsset('samples/' + id + '.bin');
    return GL.decodeLibrary(meta, bin, onProgress);
  };

  /* ----------------------------------------------- SFZ (user folders) */
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function noteNum(v) {
    v = String(v).trim();
    if (/^-?\d+$/.test(v)) return +v;
    const m = /^([a-gA-G])([#b]?)(-?\d+)$/.exec(v);
    if (!m) return 60;
    return NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  }
  /** Minimal SFZ parser (control / global / master / group / region, #define) */
  GL.parseSFZ = function (text) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const defs = {};
    text = text.replace(/#define\s+(\$\w+)\s+(\S+)/g, (m, k, v) => { defs[k] = v; return ''; });
    Object.keys(defs).forEach(k => { text = text.split(k).join(defs[k]); });
    const scopes = { control: {}, global: {}, master: {}, group: {} }, regions = [];
    const parts = text.split(/<(\w+)>/);
    for (let i = 1; i < parts.length; i += 2) {
      const head = parts[i], body = parts[i + 1], ops = {};
      const re = /(\w+)=/g, ms = [];
      let m; while ((m = re.exec(body))) ms.push(m);
      ms.forEach((mm, j) => { const end = j + 1 < ms.length ? ms[j + 1].index : body.length; ops[mm[1]] = body.slice(mm.index + mm[0].length, end).trim(); });
      if (head === 'control') scopes.control = ops;
      else if (head === 'global') { scopes.global = ops; scopes.master = {}; scopes.group = {}; }
      else if (head === 'master') { scopes.master = ops; scopes.group = {}; }
      else if (head === 'group') scopes.group = ops;
      else if (head === 'region') regions.push(Object.assign({}, scopes.global, scopes.master, scopes.group, ops, { _dp: scopes.control.default_path || '' }));
    }
    return regions;
  };
  /**
   * Build a library from a folder chosen by the user (File objects with webkitRelativePath).
   * Uses the first .sfz file found (or maps WAV/FLAC/OGG files by note name in their file name).
   */
  GL.libraryFromFiles = async function (files, onProgress) {
    const byPath = {};
    files.forEach(f => { byPath[(f.webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase()] = f; });
    const sfzs = files.filter(f => /\.sfz$/i.test(f.name)).sort((a, b) => a.webkitRelativePath.length - b.webkitRelativePath.length);
    const regionsIn = [];
    if (sfzs.length) {
      const sfz = sfzs[0], dir = (sfz.webkitRelativePath || sfz.name).replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      // #include "file.sfz" (relative to the main file), up to 4 levels
      let text = await sfz.text();
      for (let depth = 0; depth < 4 && /#include/.test(text); depth++) {
        const incs = [...text.matchAll(/#include\s+"([^"]+)"/g)];
        for (const m of incs) {
          const key = ((dir ? dir + '/' : '') + m[1].replace(/\\/g, '/')).toLowerCase();
          const inc = byPath[key];
          text = text.replace(m[0], inc ? await inc.text() : '');
        }
      }
      GL.parseSFZ(text).forEach(r => {
        if (!r.sample) return;
        const trig = r.trigger || 'attack';
        if (trig !== 'attack' && trig !== 'release') return;
        const rel = (r._dp + r.sample).replace(/\\/g, '/');
        const parts = (dir ? dir + '/' + rel : rel).split('/'), stack = [];
        parts.forEach(p => { if (p === '..') stack.pop(); else if (p && p !== '.') stack.push(p); });
        const file = byPath[stack.join('/').toLowerCase()];
        if (!file) return;
        const lo = r.key !== undefined ? noteNum(r.key) : noteNum(r.lokey || 0), hi = r.key !== undefined ? lo : noteNum(r.hikey || 127);
        regionsIn.push({ file, lo, hi, key: r.pitch_keycenter !== undefined ? noteNum(r.pitch_keycenter) : (r.key !== undefined ? lo : lo),
          lv: +(r.lovel || 1), hv: +(r.hivel || 127), rand: +(r.lorand || 0), trig, tune: (+r.tune || 0) + 100 * (+r.transpose || 0), vol: +r.volume || 0 });
      });
    } else {
      // no SFZ: the note name must be in the file name (e.g. "Guitar_A3.wav", "gtr-c#4-v2.flac")
      files.filter(f => /\.(wav|flac|ogg|mp3)$/i.test(f.name)).forEach(f => {
        const m = /(?:^|[^a-z])([a-g])([#b]?)(-?\d)(?![0-9])/i.exec(f.name.replace(/\.[a-z0-9]+$/i, ''));
        if (!m) return;
        const n = noteNum(m[1] + m[2] + m[3]);
        regionsIn.push({ file: f, lo: n, hi: n, key: n, lv: 1, hv: 127, rand: 0, trig: 'attack', tune: 0, vol: 0 });
      });
      // spread single notes over the gaps
      const at = regionsIn.filter(r => r.trig === 'attack').sort((a, b) => a.key - b.key);
      at.forEach((r, i) => { r.lo = i ? Math.floor((at[i - 1].key + r.key) / 2) + 1 : 0; r.hi = i < at.length - 1 ? Math.floor((r.key + at[i + 1].key) / 2) : 127; });
    }
    if (!regionsIn.length) throw new Error('No playable samples found (needs an .sfz file, or note names in the file names)');
    // round-robin numbering per slot
    const slots = {};
    regionsIn.forEach(r => { const k = [r.lo, r.hi, r.lv, r.hv, r.trig].join('|'); (slots[k] = slots[k] || []).push(r); });
    Object.values(slots).forEach(l => { l.sort((a, b) => a.rand - b.rand); l.forEach((r, i) => { r.rr = i; r.rrN = l.length; }); });
    // decode unique files
    const oac = new OfflineAudioContext(1, 1, DECODE_RATE), uniq = [], idx = new Map();
    regionsIn.forEach(r => { if (!idx.has(r.file)) { idx.set(r.file, uniq.length); uniq.push(r.file); } r.s = idx.get(r.file); });
    const buffers = new Array(uniq.length); let done = 0;
    const queue = uniq.map((_, i) => i);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const i = queue.shift();
        try { buffers[i] = await oac.decodeAudioData(await uniq[i].arrayBuffer()); } catch (e) { buffers[i] = null; }
        done++; if (onProgress) onProgress(done / uniq.length);
      }
    }));
    const regions = regionsIn.filter(r => buffers[r.s]).map(r => ({ s: r.s, lo: r.lo, hi: r.hi, key: r.key, lv: r.lv, hv: r.hv, rr: r.rr, rrN: r.rrN, trig: r.trig, tune: r.tune, vol: r.vol }));
    // level: loudest buffer → about -12 dBFS
    let pk = 1e-6; buffers.forEach(b => { if (!b) return; const d = b.getChannelData(0); for (let i = 0; i < d.length; i += 7) pk = Math.max(pk, Math.abs(d[i])); });
    const name = sfzs.length ? sfzs[0].name.replace(/\.sfz$/i, '') : (files[0].webkitRelativePath || 'folder').split('/')[0];
    return { meta: { id: 'user', name, license: 'user library', kind: 'mic', gain_db: -12 - 20 * Math.log10(pk), samples: uniq.map(f => ({ f: f.name, loop: null })), regions }, buffers };
  };

  /* ============================================================ PLAYER */
  class Sampler {
    constructor(ctx) {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.lib = null;
      this.voices = [null, null, null, null, null, null];   // latest voice per string (schedule order)
      this.byId = new Map();
      this.all = [];
      this.rrCount = {};
      this.P = {};
    }
    setLibrary(lib) { this.stop(); this.lib = lib; this.rrCount = {}; this.index(); }
    get ready() { return !!this.lib; }
    index() {
      const L = this.lib; if (!L) return;
      this.attack = L.meta.regions.filter(r => r.trig === 'attack');
      this.release = L.meta.regions.filter(r => r.trig === 'release');
      this.noise = L.meta.regions.filter(r => r.trig === 'noise');
      this.hasStrings = this.attack.some(r => r.str !== undefined);
    }
    /** best region: same string if the library has per-string samples, key range, velocity layer, round robin */
    pick(list, midi, vel127, str) {
      if (!list || !list.length) return null;
      let c = list;
      // prefer the same string, unless that string has no recording within 3 semitones
      if (this.hasStrings && str !== undefined) {
        const cs = c.filter(r => r.str === str);
        if (cs.some(r => midi >= r.lo - 3 && midi <= r.hi + 3)) c = cs;
      }
      let k = c.filter(r => midi >= r.lo && midi <= r.hi);
      if (!k.length) {                                      // nearest sample (re-pitched)
        let best = 1e9; c.forEach(r => { best = Math.min(best, Math.abs(r.key - midi)); });
        k = c.filter(r => Math.abs(r.key - midi) === best);
      }
      let v = k.filter(r => vel127 >= r.lv && vel127 <= r.hv);
      if (!v.length) v = k;
      const slot = [v[0].lo, v[0].hi, v[0].lv, v[0].hv, v[0].str, v[0].trig].join('|');
      const n = (this.rrCount[slot] = (this.rrCount[slot] || 0) + 1);
      const rrN = Math.max(...v.map(r => r.rr)) + 1;
      return v.find(r => r.rr === n % rrN) || v[0];
    }
    /** Schedule a list of events (absolute times) */
    schedule(list, P) {
      this.P = P;
      for (const e of list) {
        if (e.type === 'on') this.noteOn(e);
        else if (e.type === 'off') this.noteOff(e);
        else if (e.type === 'bend') this.bend(e);
      }
    }
    voiceGainFor(r, vel) {
      const P = this.P, L = this.lib;
      // velocity curve: layered libraries already change with velocity → softer curve
      const layered = this.attack.some(x => x.hv < 127);
      const curve = layered ? 0.6 + 0.6 * P.sampleVelCurve : 1 + 1.5 * P.sampleVelCurve;
      return dB(L.meta.gain_db + (r.vol || 0)) * Math.pow(clamp(vel, 0.02, 1), curve);
    }
    noteOn(e) {
      const ctx = this.ctx, P = this.P, L = this.lib; if (!L) return;
      const t = Math.max(e.t, ctx.currentTime);
      const prev = this.voices[e.s];
      // slide / hammer-on on a ringing string: re-pitch the same voice for slides
      if (e.legato && prev && prev.alive && e.glide > 0 && Math.abs(e.midi - prev.midi) <= 7) {
        prev.src.detune.cancelScheduledValues(t);
        prev.src.detune.setValueAtTime(prev.cents, t);
        prev.bent = 0;
        this.byId.delete(prev.id);
        prev.cents += (e.midi - prev.midi) * 100;
        prev.src.detune.linearRampToValueAtTime(prev.cents, t + e.glide);
        prev.midi = e.midi; prev.id = e.id; this.byId.set(e.id, prev);
        if (e.vib) this.vibrato(prev, t, e.vibMul);
        return;
      }
      const vel127 = Math.round(clamp(e.vel, 0.01, 1) * 127);
      const r = this.pick(this.attack, e.midi, vel127, e.s);
      if (!r) return;
      const buf = L.buffers[r.s]; if (!buf) return;
      const smp = L.meta.samples[r.s] || {};
      const src = ctx.createBufferSource(); src.buffer = buf;
      const cents = (e.midi - r.key) * 100 + (r.tune || 0) + (e.det || 0);
      src.detune.value = cents;
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 0.5;
      // brightness: velocity (for single-layer libraries) + tone control + palm mute / dead notes
      const layered = this.attack.some(x => x.hv < 127);
      let fc = 20000 * Math.pow(2, (P.sampleTone || 0) * 2.5);
      if (!layered) fc = Math.min(fc, 2500 + 17500 * Math.pow(clamp(e.vel, 0, 1), 1.2 + P.sampleVelTone * 2));
      if (e.pm) fc = Math.min(fc, 700 + 900 * (1 - P.palmMute));
      if (e.dead) fc = Math.min(fc, 600);
      f.frequency.value = clamp(fc, 200, 20000);
      let amp = this.voiceGainFor(r, e.vel);
      if (e.legato) amp *= 0.55 + 0.4 * P.legatoLevel;
      const offset = Math.max(0, (P.sampleStart || 0) / 1000 + (e.legato ? 0.012 : 0));
      const fade = Math.max(0.0008, (P.sampleFade || 0) / 1000);
      g.gain.setValueAtTime(0, t);
      // pick attack: a short overshoot that settles back to the note level (up to +9 dB)
      const punch = clamp(P.samplePunch || 0, 0, 1) * (e.legato ? 0.3 : 1);
      g.gain.linearRampToValueAtTime(amp * (1 + 1.8 * punch), t + fade);
      if (punch > 0) g.gain.setTargetAtTime(amp, t + fade + 0.002, 0.012 + 0.01 * punch);
      // looped (short) libraries: sustain loop with a natural decay
      if (smp.loop && buf) {
        const sr0 = smp.sr || 44100;
        src.loop = true; src.loopStart = smp.loop[0] / sr0; src.loopEnd = smp.loop[1] / sr0;
        const tt = Math.log(e.midi > 40 ? (440 * Math.pow(2, (e.midi - 69) / 12)) / 82.4 : 1) / Math.log(4);
        const T60 = clamp(P.decayLow * Math.pow(P.decayHigh / P.decayLow, tt), 0.3, 30);
        g.gain.setTargetAtTime(0, t + 0.15, T60 / 6.9);
      }
      if (e.pm) g.gain.setTargetAtTime(0, t + 0.03, 0.05 + 0.25 * (1 - P.palmMute));
      if (e.dead) g.gain.setTargetAtTime(0, t + 0.01, 0.025);
      src.connect(f); f.connect(g); g.connect(this.out);
      src.start(t, Math.min(offset, buf.duration * 0.5));
      // the previous note on this string stops when the new one starts
      if (prev && prev.alive) this.kill(prev, t, e.legato ? 0.012 : 0.02);
      const v = { src, g, f, midi: e.midi, cents, id: e.id, s: e.s, start: t, alive: true, amp };
      src.onended = () => { v.alive = false; };
      this.voices[e.s] = v; this.byId.set(e.id, v); this.all.push(v);
      if (this.all.length > 400) this.all = this.all.filter(x => x.alive);
      if (e.vib) this.vibrato(v, t, e.vibMul);
    }
    /** delayed vibrato; mul = depth multiplier (wide vibrato ≈ 2) */
    vibrato(v, t, mul) {
      const P = this.P, ctx = this.ctx;
      if (v.lfo) { try { v.lfo.stop(t); } catch (err) { /* already ended */ } }
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = P.vibRate; lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + P.vibDelay);
      lg.gain.linearRampToValueAtTime(P.vibDepth * (mul || 1), t + P.vibDelay + 0.35);
      lfo.connect(lg); lg.connect(v.src.detune); lfo.start(t);
      v.lfo = lfo;
    }
    kill(v, t, fade) {
      if (!v.alive) return;
      try {
        if (t < v.start) { v.src.stop(); v.alive = false; return; }
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, fade / 3);
        v.src.stop(t + fade * 4 + 0.05);
        if (v.lfo) v.lfo.stop(t + fade * 4 + 0.05);
      } catch (err) { /* already stopped */ }
      v.alive = false;
    }
    noteOff(e) {
      const v = this.byId.get(e.id); if (!v) return;
      this.byId.delete(e.id);
      if (v.id !== e.id || this.voices[v.s] !== v || !v.alive) return;
      const P = this.P, t = Math.max(e.t, this.ctx.currentTime);
      const rel = Math.max(0.01, P.releaseTime / 1000);
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, rel / 3);
        v.src.stop(t + rel * 3 + 0.1);
        if (v.lfo) v.lfo.stop(t + rel * 3 + 0.1);
      } catch (err) { /* */ }
      v.alive = false;
      // release noise (finger leaving the string)
      if (P.sampleRelease > 0 && this.release.length) {
        const r = this.pick(this.release, v.midi, 64, v.s);
        if (r && this.lib.buffers[r.s]) {
          const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
          src.buffer = this.lib.buffers[r.s]; src.detune.value = (v.midi - r.key) * 100;
          g.gain.value = this.voiceGainFor(r, 0.8) * P.sampleRelease;
          src.connect(g); g.connect(this.out); src.start(t);
        }
      }
    }
    bend(e) {
      const v = e.id ? this.byId.get(e.id) : this.voices[e.s];
      if (!v || !v.alive || (e.id && e.id !== v.id)) return;
      const t = Math.max(e.t, this.ctx.currentTime);
      v.src.detune.setValueAtTime(v.cents + (v.bent || 0) * 100, t);
      v.src.detune.linearRampToValueAtTime(v.cents + e.semis * 100, t + Math.max(0.01, e.glide));
      v.bent = e.semis;
    }
    stop() {
      const t = this.ctx.currentTime;
      this.all.forEach(v => this.kill(v, t, 0.04));
      this.all = []; this.byId.clear(); this.voices = [null, null, null, null, null, null];
    }
  }
  GL.Sampler = Sampler;
})();
