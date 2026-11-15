/* =============================================================================
 *  PIANORIG.JS — realistic keyboards inside ScoreDAW (the Piano Lab engine)
 *  -----------------------------------------------------------------------------
 *  A track with engine 'pianorig' plays one of the 4 Piano Lab instruments
 *  (tools/piano-lab/presets.js PL.TYPES):
 *      grand  · Grand Piano      real Yamaha C5 recordings or the string model
 *                                (1, 2 or 3 strings per note)
 *      epiano · Electric Piano   Rhodes / Wurlitzer recordings or the tine model
 *      synth  · Synthesizer      analog-style polysynth
 *      organ  · Organ            tonewheel organ with drawbars and rotary speaker
 *
 *  WHERE THE SETTINGS LIVE (saved with the song, same scheme as the Guitar Rig)
 *      track.params.prig            instrument id ('grand' …)
 *      track.params.prigS[id]       ONLY the settings changed from the factory
 *                                   sound of that instrument (a "diff")
 *
 *  HOW A NOTE BECOMES SOUND
 *      audio.js playMelodic() → SDAW.pianoRig.play(track, pitch, time, dur, opts)
 *      → Piano Lab events { type:'on'|'off'|'pedal', t, midi, vel, id }
 *      → PL.Engine.send()  (recordings player and / or the worklet models)
 *      Note-offs are held back until just before their time, so the recordings
 *      player always receives the events in time order (it decides at that
 *      moment whether the sustain pedal holds the note).
 *      Auto sustain pedal (setting "Auto sustain pedal"): the pedal is lifted
 *      just before every bar / half bar / beat and pressed again right after
 *      the first note, like a pianist changing the pedal with the harmony.
 *      Organ: the sustain pedal switches the rotary speaker to fast; there is
 *      no auto pedal on the organ.
 *
 *  Public API (SDAW.pianoRig) — mirrors SDAW.guitarRig:
 *      ok() · active(track) · model(track) · settings(track[, model])
 *      setValue · setDiff · reset · toDiff · update(track, chain) · applyNow
 *      play(track, pitch, time, dur, opts) · stopAll() · remove(id)
 *      prepareOffline(ctx) · flushOffline(ctx, limit)
 *      status(track) · analyser(track) · demo / stopDemo / demoPlaying / demos
 *      presets · savePreset · deletePreset · importLabFile · labReference · seed
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const PL = window.PL;
  const RC = () => CONFIG.pianoRig;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const R = { libs: {}, libProg: {} };
  SDAW.pianoRig = R;

  R.MODELS = ['grand', 'epiano', 'synth', 'organ'];
  R.ok = () => !!(PL && PL.Engine && PL.TYPES && window.AudioWorkletNode);

  /* ======================================================== SETTINGS == */
  R.isRigTrack = t => !!t && t.engine === 'pianorig';
  R.active = t => R.isRigTrack(t) && R.ok() && !(t.sampler && t.sampler.zones && t.sampler.zones.length) &&
    !(t.plugin && SDAW.desktop && SDAW.desktop.on);
  R.model = t => { const m = t && t.params && t.params.prig; return PL && PL.TYPES && PL.TYPES[m] ? m : 'grand'; };
  R.type = t => PL.TYPES[R.model(t)];
  const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  R.settings = function (t, model) {
    const m = model || R.model(t);
    const d = t && t.params && t.params.prigS && t.params.prigS[m];
    return PL.sanitize(m, d || {});
  };
  R.toDiff = function (model, full) {
    const f = PL.factory(model), out = {};
    PL.PARAMS.forEach(p => { if (full[p.id] !== undefined && !same(full[p.id], f[p.id])) out[p.id] = full[p.id]; });
    return out;
  };
  function diffOf(t, model) {
    t.params = t.params || {};
    t.params.prigS = t.params.prigS || {};
    return (t.params.prigS[model] = t.params.prigS[model] || {});
  }
  R.setValue = function (t, key, v, model) {
    const m = model || R.model(t), f = PL.factory(m), d = diffOf(t, m);
    if (same(f[key], v)) delete d[key]; else d[key] = v;
  };
  R.setDiff = function (t, diff, model) {
    const m = model || R.model(t);
    diffOf(t, m);
    t.params.prigS[m] = diff ? R.toDiff(m, PL.sanitize(m, Object.assign(PL.factory(m), diff))) : {};
  };
  R.reset = (t, model) => R.setDiff(t, null, model);

  /* ---------------------------------------- Piano Lab references / presets */
  const REF_KEY = 'scoredaw.prigRefs', PRESET_KEY = 'scoredaw.prigPresets';
  const readLS = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  /** the ⭐ reference saved in the Piano Lab: imported file, or the lab's own storage (same origin) */
  R.labReference = function (model) {
    const imported = readLS(REF_KEY);
    if (imported && imported[model]) return imported[model];
    const lab = PL && PL.CONFIG ? readLS(PL.CONFIG.storageKey) : null;
    const ref = lab && lab.refs && lab.refs[model];
    return ref && ref.settings ? R.toDiff(model, PL.sanitize(model, ref.settings)) : null;
  };
  /** settings of a new rig track: Piano Lab reference (if any) + the library item's own sound */
  R.seed = function (model, itemDiff) {
    const d = Object.assign({}, R.labReference(model) || {}, itemDiff || {});
    return { [model]: R.toDiff(model, PL.sanitize(model, Object.assign(PL.factory(model), d))) };
  };
  /** starting sound of a library item (params.prigSound = a name in PL.SOUNDS) */
  R.itemSound = inst => { const p = inst && inst.params; return p && p.prigSound && PL.SOUNDS[p.prig] ? PL.SOUNDS[p.prig][p.prigSound] || null : null; };
  /** import piano-references.json or piano-lab-state.json */
  R.importLabFile = function (json) {
    const out = readLS(REF_KEY) || {}, got = [];
    const put = (m, settings) => { if (PL.TYPES[m] && settings) { out[m] = R.toDiff(m, PL.sanitize(m, settings)); got.push(m); } };
    if (json && json.instruments) Object.keys(json.instruments).forEach(m => put(m, json.instruments[m].settings));
    else if (json && json.slots) R.MODELS.forEach(m => {
      const ref = json.refs && json.refs[m], slot = json.slot && json.slot[m], sl = json.slots[m] && json.slots[m][slot || 'A'];
      put(m, ref ? ref.settings : sl && sl.settings);
    });
    writeLS(REF_KEY, out);
    return got;
  };
  /** factory, ★ lab reference, the Piano Lab sounds and your own presets: [{ id, name, group, diff }] */
  R.presets = function (model) {
    const list = [{ id: 'factory', name: 'Factory sound', group: 'Factory', diff: {} }];
    const ref = R.labReference(model);
    if (ref) list.push({ id: 'labref', name: '★ My Piano Lab reference', group: 'Factory', diff: ref });
    const snd = PL.SOUNDS[model] || {};
    Object.keys(snd).forEach((name, i) => { if (Object.keys(snd[name]).length) list.push({ id: 'snd' + i, name, group: 'Sounds', diff: snd[name] }); });
    const mine = (readLS(PRESET_KEY) || {})[model] || {};
    Object.keys(mine).sort().forEach(name => list.push({ id: 'my:' + name, name, group: 'My presets', diff: mine[name], mine: true }));
    return list;
  };
  R.savePreset = function (model, name, diff) { const all = readLS(PRESET_KEY) || {}; all[model] = all[model] || {}; all[model][name] = diff; return writeLS(PRESET_KEY, all); };
  R.deletePreset = function (model, name) { const all = readLS(PRESET_KEY) || {}; if (all[model]) delete all[model][name]; writeLS(PRESET_KEY, all); };

  /* ======================================================= LIBRARIES == */
  const IDB = {
    db() { return new Promise((res, rej) => { const r = indexedDB.open('scoredaw-pianolab', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.db(); return new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
    async set(k, v) { const db = await this.db(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
  };
  const fileLike = x => ({ name: x.path.split('/').pop(), webkitRelativePath: x.path, arrayBuffer: () => x.blob.arrayBuffer(), text: () => x.blob.text() });
  function loadLib(id) {
    if (R.libs[id]) return R.libs[id];
    const prog = f => { R.libProg[id] = f; emitAll(); };
    const p = (async () => {
      if (id.startsWith('user:')) {
        const files = await IDB.get('lib:' + id);
        if (!files) throw new Error('nouser');
        return PL.libraryFromFiles(files.map(fileLike), prog);
      }
      return PL.loadBundledLibrary(id, prog);
    })();
    R.libs[id] = p;
    p.catch(() => { if (R.libs[id] === p) delete R.libs[id]; });
    return p;
  }
  /** a folder of recordings (SFZ / audio) as "My library" of an instrument (shared with the Piano Lab) */
  R.storeUserLibrary = async function (model, files) {
    const id = 'user:' + model;
    await IDB.set('lib:' + id, files.map(f => ({ path: f.webkitRelativePath || f.name, blob: f })));
    delete R.libs[id];
    live.forEach(r => { if (r.libId === id) r.libId = undefined; });
  };

  /* ===================================================== THE ENGINES == */
  const perCtx = new WeakMap();      // AudioContext → Map(trackId → rig)
  const live = new Set();
  const rigsOf = ctx => { let m = perCtx.get(ctx); if (!m) { m = new Map(); perCtx.set(ctx, m); } return m; };
  function getRig(track, create) {
    const A = SDAW.audio, ctx = A.ctx;
    if (!ctx || !R.ok()) return null;
    const m = rigsOf(ctx);
    let r = m.get(track.id);
    if (!r && create) {
      r = makeRig(ctx, track, !!A.offline);
      m.set(track.id, r);
      if (!r.offline) { live.add(r); startTimer(); }
    }
    return r;
  }
  R.rigOf = id => { const A = SDAW.audio, m = A.ctx && !A.offline && perCtx.get(A.ctx); return m ? m.get(id) : null; };

  function makeRig(ctx, track, offline) {
    const model = R.model(track), s = R.settings(track, model);
    const r = { id: track.id, ctx, offline, model, s, sig: '', eng: null, out: ctx.createGain(), dest: null,
      queue: [], pend: [], nid: 0, libId: undefined, libState: '', libName: '', err: '', lastNote: ctx.currentTime, ped: false, pedSlot: null };
    r.out.gain.value = RC().outputTrim;
    r.creating = PL.Engine.create(ctx, { params: PL.workletParams(model, s), destination: r.out }).then(eng => {
      if (r.dead) { eng.dispose(); return; }
      r.eng = eng;
      applyRig(r, null, true);
      flushQueue(r);
      emit(r.id);
    }).catch(e => { r.err = e.message || String(e); console.warn('Piano Rig:', e); emit(r.id); });
    return r;
  }
  function applyRig(r, track, force) {
    if (track) {
      const model = R.model(track), s = R.settings(track, model), sig = model + '|' + JSON.stringify(s);
      if (!force && sig === r.sig) return;
      if (model !== r.model && r.eng) { r.eng.stop(); r.ped = false; r.pedSlot = null; }      // another instrument: silence the old one
      r.sig = sig; r.model = model; r.s = s;
    } else if (!r.sig) r.sig = r.model + '|' + JSON.stringify(r.s);
    if (!r.eng) return;
    r.eng.apply(r.model, r.s, { immediate: force || r.offline, noWorklet: false });
    ensureLib(r);
  }
  function ensureLib(r) {
    const id = PL.wantedLib(r.model, r.s), eng = r.eng;
    if (id === r.libId) return;
    r.libId = id;
    if (eng.sampler.lib) { eng.sampler.setLibrary(null); eng.apply(r.model, r.s, { noWorklet: true }); }
    r.libName = '';
    if (!id) { r.libState = ''; emit(r.id); return; }
    if (!id.startsWith('user:') && !PL.assetsAvailable()) { r.libState = 'file'; emit(r.id); return; }
    r.libState = 'loading'; emit(r.id);
    r.libJob = loadLib(id).then(lib => {
      if (r.libId !== id || r.dead) return;
      eng.sampler.setLibrary(lib);
      eng.apply(r.model, r.s, { noWorklet: true, immediate: r.offline });
      r.libState = 'ready'; r.libName = lib.meta.name; emit(r.id);
      flushQueue(r);
    }).catch(e => {
      if (r.libId !== id) return;
      r.libState = e.message === 'nouser' ? 'nouser' : 'error'; r.err = e.message; emit(r.id);
      flushQueue(r);
    });
  }
  function flushQueue(r) {
    const q = r.queue; r.queue = [];
    if (!q.length) return;
    const first = Math.min(...q.map(x => x[2]));
    const shift = Math.max(0, r.ctx.currentTime + 0.03 - first);
    q.forEach(([track, pitch, time, dur, opts]) => R.play(track, pitch, time + shift, dur, opts));
  }

  R.update = function (track, chain) {
    const A = SDAW.audio;
    if (!A.ctx || !PL) return;
    const m = perCtx.get(A.ctx);
    if (!R.active(track)) { if (m && m.has(track.id)) R.remove(track.id); return; }
    if (A.offline) {
      const anySolo = SDAW.store.song.tracks.some(x => x.solo);
      if (track.mute || (anySolo && !track.solo)) return;
    }
    const r = getRig(track, true);
    if (!r) return;
    if (chain && r.dest !== chain.input) { try { r.out.disconnect(); } catch (e) { /* first */ } r.out.connect(chain.input); r.dest = chain.input; }
    applyRig(r, track, false);
  };
  R.applyNow = function (track) { const r = R.rigOf(track.id); if (r) applyRig(r, track, false); };
  R.remove = function (id, ctx) {
    ctx = ctx || SDAW.audio.ctx;
    const m = ctx && perCtx.get(ctx), r = m && m.get(id);
    if (!r) return;
    m.delete(id); live.delete(r); r.dead = true;
    if (r.eng) r.eng.dispose();
    try { r.out.disconnect(); } catch (e) { /* not connected */ }
    emit(id);
  };
  function prune() {
    const ids = new Set(SDAW.store.song.tracks.filter(R.active).map(t => t.id));
    live.forEach(r => { if (!ids.has(r.id) && !r.id.startsWith('__')) R.remove(r.id, r.ctx); });
  }

  /* ================================================ NOTE → EVENTS == */
  /** offs whose time is before `limit` are final: send them (time order) */
  function flushPending(r, limit) {
    if (!r.pend.length || !r.eng) return;
    const go = [], keep = [];
    r.pend.forEach(p => (p.t <= limit ? go : keep).push(p));
    r.pend = keep;
    if (go.length) r.eng.send(go.sort((a, b) => a.t - b.t));
  }
  /** auto sustain pedal: which bar / half bar / beat a tick belongs to (null = no auto pedal) */
  function pedalSlot(s, tick) {
    const m = s.autoPedal;
    if (!m || m === 'Off' || tick === undefined) return null;
    if (m === 'Always down') return 0;
    const B = SDAW.barTicks(), bt = SDAW.beatTicks ? SDAW.beatTicks() : 4;
    const len = m === 'Each bar' ? B : m === 'Each half bar' ? B / 2 : bt;
    return Math.floor((tick + 0.25) / len);
  }

  /**
   * One ScoreDAW note → Piano Lab events.
   *   opts: { vel 0..127, tech, tick (song position, for the auto pedal) }
   */
  function noteEvents(r, pitch, time, dur, opts) {
    const s = r.s, list = [];
    let vel = clamp((opts.vel || 100) / 127, 0.02, 1);
    vel = Math.pow(vel, s.touch);
    vel = clamp(vel * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.25), 0.02, 1);
    const t = Math.max(0, time + gauss() * s.humanTime / 1000);
    // ---- auto pedal (not on the organ: there the pedal is the rotary speed switch)
    const slot = PL.TYPES[r.model].model === 'organ' ? null : pedalSlot(s, opts.tick);
    if (slot !== null && slot !== r.pedSlot) {
      if (r.ped && s.autoPedal !== 'Always down') list.push({ type: 'pedal', t: Math.max(0, t - 0.012), v: 0 });   // lift just before the new harmony
      if (!r.ped || s.autoPedal !== 'Always down') list.push({ type: 'pedal', t: t + 0.06, v: 1 });              // press again right after it
      r.ped = true; r.pedSlot = slot;
    } else if (slot === null && r.ped) {
      list.push({ type: 'pedal', t: Math.max(0, t - 0.012), v: 0 }); r.ped = false; r.pedSlot = null;
    }
    const id = 'p' + (++r.nid);
    list.push({ type: 'on', t, midi: pitch, vel, id });
    list.sort((a, b) => a.t - b.t);
    r.pend.push({ type: 'off', t: t + Math.max(0.03, dur), id });
    return list;
  }

  /** from audio.js playMelodic: true when the rig took the note */
  R.play = function (track, pitch, time, dur, opts) {
    const r = getRig(track, true);
    if (!r) return false;
    if (!r.dest) { const ch = SDAW.audio.getChain(track); r.out.connect(ch.input); r.dest = ch.input; }
    // Library previews wait for the real recordings (so the preview sounds like the track will)
    const waitLib = track.id.startsWith('__') && r.libState === 'loading';
    if (!r.eng || waitLib) { if (!r.err && r.queue.length < 400) r.queue.push([track, pitch, time, dur, opts]); return true; }
    flushPending(r, time - 0.001);                    // every off before this note goes first (time order)
    r.eng.send(noteEvents(r, pitch, time, dur, opts || {}));
    r.lastNote = Math.max(r.lastNote, time + dur);
    return true;
  };
  R.stopAll = function () {
    live.forEach(r => { r.pend = []; r.queue = []; r.ped = false; r.pedSlot = null; if (r.eng) r.eng.stop(); });
  };


  /**
   * Before ▶ (audio.js A.play): null when this track is ready to play, else a promise that
   * resolves once its engine runs and its recordings are loaded (or failed — then the
   * status tells which file, and the fallback that plays is named there).
   */
  R.whenReady = function (track) {
    if (!R.active(track)) return null;
    SDAW.audio.updateTrack(track);
    const r = getRig(track, true);
    if (!r || r.err) return null;
    const busy = !r.eng || r.libState === 'loading';
    if (!busy) return null;
    return (async () => { await r.creating; if (r.libJob) await r.libJob.catch(() => {}); })();
  };
  /* ===================================================== OFFLINE == */
  R.prepareOffline = async function (ctx) {
    const m = perCtx.get(ctx);
    if (!m) return;
    for (const r of m.values()) {
      await r.creating;
      if (r.libJob) await r.libJob.catch(() => {});
      if (r.eng) r.eng.apply(r.model, r.s, { immediate: true });
    }
  };
  R.flushOffline = function (ctx, limit) { const m = perCtx.get(ctx); if (m) m.forEach(r => flushPending(r, limit)); };

  /* ================================================== LIVE TIMER == */
  let timer = null;
  function startTimer() {
    if (timer) return;
    timer = setInterval(() => {
      if (!live.size) { clearInterval(timer); timer = null; return; }
      live.forEach(r => {
        if (!r.eng || r.ctx.state === 'closed') return;
        const now = r.ctx.currentTime;
        flushPending(r, now + RC().offAheadSec);
        if (r.id.startsWith('__') && now - r.lastNote > 40) R.remove(r.id, r.ctx);    // previews
      });
    }, 20);
  }

  /* ===================================================== STATUS == */
  const emit = id => { if (SDAW.bus) SDAW.bus.emit('prig', { id }); };
  const emitAll = SDAW.debounce ? SDAW.debounce(() => live.forEach(r => emit(r.id)), 80) : () => {};
  R.status = function (track) {
    // another sound source has priority over the rig: say which one really plays
    const other = SDAW.otherSource ? SDAW.otherSource(track) : null;
    if (other) return { level: 'warn', text: other + ' plays this track — the Piano Rig is silent' };
    if (!PL || !PL.Engine) return { level: 'warn', text: 'Piano engine files not found (tools/piano-lab)' };
    if (!window.AudioWorkletNode) return { level: 'warn', text: 'This browser cannot run the piano engine (AudioWorklet) — use Chrome or Edge' };
    const r = R.rigOf(track.id), model = R.model(track), s = R.settings(track, model);
    if (!r) return { level: 'idle', text: 'Press ▶ or a key to start the audio' };
    if (r.err && !r.eng) return { level: 'warn', text: '⚠ ' + r.err };
    if (!r.eng) return { level: 'busy', text: '⏳ Starting the keyboard engine…' };
    const id = r.libId;
    let text, level = 'ok';
    if (!id) text = { grand: 'String model (1–3 strings per note)', epiano: 'Tine / reed model', synth: 'Analog-style synthesizer', organ: 'Tonewheel organ + rotary speaker' }[model];
    else if (r.libState === 'loading') { level = 'busy'; text = '⏳ Loading the real recordings ' + Math.round((R.libProg[id] || 0) * 100) + '% — the model plays meanwhile'; }
    else if (r.libState === 'file') { level = 'warn'; text = '⚠ Opened from disk without the packs folder: the model plays (tools/piano-lab/build_packs.py)'; }
    else if (r.libState === 'nouser') { level = 'warn'; text = '⚠ No library of your own for this instrument yet — "📂 Load library…"'; }
    else if (r.libState === 'error') { level = 'warn'; text = '⚠ Recordings: ' + r.err; }
    else text = (s.engine === 'Layered (samples + model)' ? 'Real recordings + model: ' : 'Real recordings: ') + (r.libName || id);
    if (s.autoPedal && s.autoPedal !== 'Off' && model !== 'organ') text += ' · auto pedal: ' + s.autoPedal.toLowerCase();
    return { level, text };
  };
  R.analyser = track => { const r = R.rigOf(track.id); return r && r.eng ? r.eng.n.analyser : null; };

  /* ============================================ TEST PHRASES (demos) == */
  R.demos = model => (PL.DEMO_ORDER[model] || PL.DEMOS.map(d => d.id)).map(id => PL.DEMOS.find(d => d.id === id)).filter(Boolean);
  R.demo = async function (track, demoId) {
    const A = SDAW.audio;
    A.init(); A.updateTrack(track);
    const r = getRig(track, true); if (!r) return 0;
    await r.creating;
    if (!r.eng) return 0;
    const demo = PL.DEMOS.find(d => d.id === demoId) || R.demos(r.model)[0];
    r.eng.stop(); r.pend = []; r.ped = false; r.pedSlot = null;
    const d = PL.demoEvents(demo, r.s, r.ctx.currentTime + 0.12);
    r.eng.send(d.events);
    r.lastNote = Math.max(r.lastNote, d.end);
    r.demo = true; clearTimeout(r.demoTimer);
    r.demoTimer = setTimeout(() => { r.demo = false; emit(r.id); }, (d.end - r.ctx.currentTime + 1) * 1000);
    return d.end;
  };
  R.stopDemo = function (track) { const r = R.rigOf(track.id); if (!r || !r.eng) return; clearTimeout(r.demoTimer); r.demo = false; r.eng.stop(); emit(r.id); };
  R.demoPlaying = track => { const r = R.rigOf(track.id); return !!(r && r.demo); };
  /** play one key now (Piano Rig window keyboard) */
  R.key = async function (track, midi, vel, on) {
    const A = SDAW.audio;
    A.init(); A.updateTrack(track);
    const r = getRig(track, true); if (!r) return;
    await r.creating; if (!r.eng) return;
    const t = r.ctx.currentTime;
    if (on) { r.eng.send([{ type: 'on', t, midi, vel: Math.pow(vel, r.s.touch), id: 'kb' + midi }]); r.lastNote = t + 5; }
    else r.eng.send([{ type: 'off', t, id: 'kb' + midi }]);
  };
  R.pedalNow = function (track, down) { const r = R.rigOf(track.id); if (r && r.eng) r.eng.send([{ type: 'pedal', t: r.ctx.currentTime, v: down ? 1 : 0 }]); };

  if (SDAW.bus) SDAW.bus.on('change', () => { if (SDAW.audio && SDAW.audio.ctx) prune(); });
})(window.SDAW);
