/* =====================================================================
 *  PIANO LAB — sampler.js : REAL RECORDINGS engine
 *  ---------------------------------------------------------------------
 *  Plays multi-sampled real keyboards (open-licence libraries bundled in
 *  samples/*.bin + *.json, or any SFZ library loaded from a folder).
 *
 *  · polyphonic, one voice per key press (a re-struck key fades its old voice)
 *  · velocity layers; every recording is levelled (its measured peak is in
 *    the library), then the loudness follows the "Dynamic range" setting,
 *    so the dynamics are smooth from pp to ff
 *  · a per-voice high shelf makes harder notes brighter inside each layer
 *  · sustain pedal (notes keep ringing, pedal noises), soft pedal (una corda)
 *  · dampers: release time by register; the top keys have no dampers
 *  · key-release noises (the damper falling back on the strings)
 *  Events: { type:'on', t, midi, vel 0..1, id } { type:'off', t, id }
 *          { type:'pedal', t, v 0..1 } { type:'soft', t, v }
 * ===================================================================== */
(function () {
  'use strict';
  const PL = window.PL = window.PL || {};
  const DECODE_RATE = (PL.CONFIG && PL.CONFIG.decodeRate) || 32000;
  const dB = v => Math.pow(10, v / 20);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------ library data */
  /** Decode a bundled library: meta JSON + concatenated audio → AudioBuffers */
  PL.decodeLibrary = async function (meta, bin, onProgress) {
    const oac = new OfflineAudioContext(meta.ch || 1, 1, DECODE_RATE);
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
    return { meta, buffers };
  };
  /** Load + decode a bundled library (fetch over http, script packs from disk) */
  PL.loadBundledLibrary = async function (id, onProgress) {
    const meta = await PL.loadAsset('samples/' + id + '.json', 'json');
    const bin = await PL.loadAsset('samples/' + id + '.bin', 'buffer');
    PL.releaseAsset('samples/' + id + '.bin');
    return PL.decodeLibrary(meta, bin, onProgress);
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
  PL.parseSFZ = function (text) {
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
  PL.libraryFromFiles = async function (files, onProgress) {
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
      PL.parseSFZ(text).forEach(r => {
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
      // no SFZ: the note name must be in the file name (e.g. "Piano_A3.wav", "ep-c#4-v2.flac")
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
    const oac = new OfflineAudioContext(2, 1, DECODE_RATE), uniq = [], idx = new Map();
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
  /** damper: seconds for a released note to die (bass dampers are slower); on a grand the keys
   *  above ~F#6 have none. Electric pianos (ep = true) damp every key, quickly. */
  PL.damperTime = (midi, ep) => ep ? 0.16 - 0.08 * clamp((midi - 28) / 70, 0, 1) : midi >= 90 ? 0 : 0.32 - 0.2 * clamp((midi - 30) / 55, 0, 1);

  /**
   * Key balance of electric piano recordings. Those libraries were normalized file by file
   * (every note peaks near 0 dB), which makes the levelled treble too loud and harsh. The
   * natural balance comes from the hardest layer when it was left as recorded (Rhodes);
   * a fully normalized library (Wurlitzer) gets a gentle roll-off above C5 instead.
   * Returns key → dB.
   */
  PL.keyBalance = function (att) {
    const top = att.filter(r => r.hv >= 127 && r.pk !== undefined).sort((a, b) => a.key - b.key);
    const pks = top.map(r => r.pk), maxPk = Math.max.apply(null, pks.length ? pks : [0]);
    const natural = pks.length > 3 && maxPk - Math.min.apply(null, pks) > 2.5;
    return key => {
      if (!natural) return -0.12 * Math.max(0, key - 72);
      let best = top[0];
      top.forEach(r => { if (Math.abs(r.key - key) < Math.abs(best.key - key)) best = r; });
      return Math.max(-6, 0.7 * (best.pk - maxPk));                // a real Rhodes treble is thinner, not that much quieter
    };
  };

  class Sampler {
    constructor(ctx) {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.lib = null; this.P = {};
      this.voices = []; this.byId = new Map();
      this.ped = false; this.soft = false; this.rr = {};
    }
    setLibrary(lib) {
      this.stop();
      this.lib = lib;
      this.att = []; this.rel = []; this.noise = {};
      if (!lib) return;
      lib.meta.regions.forEach(r => {
        if (!lib.buffers[r.s]) return;
        if (r.trig === 'release') this.rel.push(r);
        else if (r.trig === 'noise') (this.noise[r.noise] = this.noise[r.noise] || []).push(r);
        else this.att.push(r);
      });
      this.ep = lib.meta.kind === 'di';
      this.keyTrim = this.ep ? PL.keyBalance(this.att) : null;
    }
    /** region for a key and velocity (1..127): exact range, else the nearest key in that layer */
    pick(list, midi, v) {
      let best = null, bd = 1e9;
      for (const r of list) {
        const dk = midi < r.lo ? r.lo - midi : midi > r.hi ? midi - r.hi : 0;
        const dv = v < r.lv ? r.lv - v : v > r.hv ? v - r.hv : 0;
        const d = dk * 4 + dv + Math.abs(midi - r.key) * 0.01;
        if (d < bd) { bd = d; best = r; }
      }
      return best;
    }
    /** level of a region: recordings with a measured peak are evened out to −12 dBFS */
    regionGain(r) {
      const trim = this.keyTrim ? this.keyTrim(r.key) : 0;
      return r.pk !== undefined ? dB(-12 - r.pk + trim) : dB((this.lib.meta.gain_db || 0) + (r.vol || 0) + trim);
    }
    noteOn(e) {
      if (!this.lib || !this.att.length) return;
      const P = this.P, ctx = this.ctx, t = Math.max(ctx.currentTime, e.t);
      let vel = clamp(e.vel, 0.01, 1);
      if (this.soft) vel *= 0.78;
      const v127 = clamp(Math.round(vel * 127), 1, 127);
      const r = this.pick(this.att, e.midi, v127); if (!r) return;
      // a re-struck key: the old voice of that key fades out
      this.voices.forEach(v => { if (v.midi === e.midi && !v.done) this.fade(v, t, 0.12); });
      if (this.voices.length >= PL.CONFIG.maxSampleVoices) {
        const old = this.voices.find(v => !v.held) || this.voices[0];
        this.fade(old, t, 0.03);
      }
      const src = ctx.createBufferSource(); src.buffer = this.lib.buffers[r.s];
      const cents = (e.midi - r.key) * 100 + (r.tune || 0) + 1200 * Math.log2((P.a4 || 440) / 440);
      src.playbackRate.value = Math.pow(2, cents / 1200);
      // brightness inside the layer (and the soft pedal)
      const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 2200;
      sh.gain.value = (P.velTone || 0) * 22 * (v127 - (r.lv + r.hv) / 2) / 127 - (this.soft ? 3.5 : 0);
      const g = ctx.createGain();
      const amp = this.regionGain(r) * Math.pow(vel, (P.dynRange || 38) / 42);
      g.gain.setValueAtTime(amp, t);
      src.connect(sh); sh.connect(g); g.connect(this.out);
      const off = Math.min((P.sampleStart || 0) / 1000, src.buffer.duration * 0.5);
      if (off > 0) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); }
      src.start(t, off);
      const v = { id: e.id, midi: e.midi, vel, src, g, amp, t, held: true, sus: false, done: false };
      src.onended = () => { v.done = true; const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1); if (this.byId.get(v.id) === v) this.byId.delete(v.id); try { g.disconnect(); } catch (er) { /* gone */ } };
      this.voices.push(v); this.byId.set(e.id, v);
    }
    fade(v, t, sec) {
      if (v.done || v.fading) return; v.fading = true; v.held = false; v.sus = false;
      try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, sec / 4); v.src.stop(t + sec * 2); } catch (er) { /* ended */ }
    }
    /** the damper falls: the note dies in a time that depends on the register */
    release(v, t) {
      if (v.done || v.fading) return;
      const P = this.P, Td = PL.damperTime(v.midi, this.ep) * (P.damperTime || 1);
      v.held = false; v.sus = false;
      if (Td <= 0) return;                                   // no damper: it rings until the recording ends
      v.fading = true;
      try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, Td / 3); v.src.stop(t + Td * 2.5); } catch (er) { /* ended */ }
      if (P.releaseNoise > 0 && this.rel.length) this.oneShot(this.pick(this.rel, v.midi, 100), t, dB(-30) * P.releaseNoise * 2 * (0.4 + 0.6 * v.vel));
    }
    oneShot(r, t, level) {
      if (!r) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = this.lib.buffers[r.s]; g.gain.value = this.regionGain(r) * level * 4;
      src.connect(g); g.connect(this.out); src.start(t);
      src.onended = () => { try { g.disconnect(); } catch (er) { /* gone */ } };
    }
    noteOff(e) {
      const v = this.byId.get(e.id); if (!v) return;
      const t = Math.max(this.ctx.currentTime, e.t);
      v.held = false;
      if (this.ped) v.sus = true; else this.release(v, Math.max(t, v.t + 0.03));
    }
    pedal(e) {
      const t = Math.max(this.ctx.currentTime, e.t), down = e.v >= 0.5;
      if (down === this.ped) return;
      this.ped = down;
      const P = this.P, list = this.noise && this.noise[down ? 'pedalDown' : 'pedalUp'];
      if (list && list.length && P.pedalNoise > 0) this.oneShot(list[Math.floor(Math.random() * list.length)], t, dB(-26) * P.pedalNoise);
      if (!down) this.voices.slice().forEach(v => { if (v.sus) this.release(v, t); });
    }
    softPedal(e) { this.soft = e.v >= 0.5; }
    send(list) {
      for (const e of list) {
        if (e.type === 'on') this.noteOn(e); else if (e.type === 'off') this.noteOff(e);
        else if (e.type === 'pedal') this.pedal(e); else if (e.type === 'soft') this.softPedal(e);
      }
    }
    stop() {
      const t = this.ctx.currentTime;
      this.voices.slice().forEach(v => this.fade(v, t, 0.04));
      this.ped = false; this.soft = false; this.byId.clear();
    }
  }
  PL.Sampler = Sampler;
})();
