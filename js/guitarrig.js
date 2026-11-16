/* =============================================================================
 *  GUITARRIG.JS — realistic guitars inside ScoreDAW (the Guitar Lab engine)
 *  -----------------------------------------------------------------------------
 *  A track with engine 'rig' plays one of the 5 Guitar Lab guitars:
 *      nylon · steel · strat · lespaul · hollow      (tools/guitar-lab/presets.js)
 *  through the full Guitar Lab chain: real recordings (or the physical string
 *  model) → pickups / microphone → real amp capture (NAM) → cabinet IR → EQ →
 *  effects. The same engine plays the pattern, the song and the exports.
 *
 *  WHERE THE SETTINGS LIVE (saved with the song)
 *      track.params.rig            guitar model id ('strat' …)
 *      track.params.rigS[model]    ONLY the settings you changed from the
 *                                  factory sound of that model (a "diff"), so
 *                                  later improvements of the factory sound reach
 *                                  your tracks, and switching model keeps each
 *                                  guitar's own tweaks.
 *
 *  HOW A NOTE BECOMES SOUND
 *      audio.js playMelodic() → SDAW.guitarRig.play(track, pitch, time, dur, opts)
 *      → Guitar Lab events  { type:'on'|'off'|'bend'|'squeak', t, s (string), midi … }
 *      → GL.Engine.send()  (worklet string model and / or the recording sampler)
 *      Techniques: hammer-on / pull-off / tapping (legato), slides (legato glide,
 *      shift, in from below / above, out), bends (up, release, pre-bend, pre-bend
 *      release), vibrato / wide vibrato, palm mute, dead notes, natural / pinch
 *      harmonics, strums (string by string), let ring, plus the Guitar Lab "human
 *      feel" (timing, dynamics, string squeaks on position shifts).
 *
 *  ONE ENGINE PER TRACK AND PER AUDIO CONTEXT
 *      The live context and every offline render (WAV / stems) get their own
 *      engines. Engines are created asynchronously; notes that arrive before
 *      the engine exists are queued and played as soon as it is ready.
 *      Note-offs are held back until just before their time: a following
 *      slide / hammer-on on the same string cancels them so the string keeps
 *      ringing (that is what makes legato sound like legato).
 *      An engine without notes for CONFIG.guitarRig.idleSleepSec sleeps (no CPU).
 *
 *  Public API (SDAW.guitarRig):
 *      ok()                       engine files loaded and AudioWorklet supported
 *      active(track)              does this track play through the rig?
 *      model(track) / settings(track[, model]) / setValue(track, key, v) / reset(track)
 *      update(track, chain)       from audio.js updateTrack: create / apply / connect
 *      play(track, pitch, time, dur, opts)    from playMelodic
 *      stopAll()                  from audio.js stop
 *      prepareOffline(ctx) / flushOffline(ctx, limit)     from renderOffline
 *      status(track)              text + state for the panel and the inspector
 *      demo(track, demoId) / stopDemo(track)   Guitar Lab test phrases
 *      presets(model) · savePreset · deletePreset · importLabFile · labReference
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const GL = window.GL;
  const RC = () => CONFIG.guitarRig;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const R = { libs: {}, libProg: {} };
  SDAW.guitarRig = R;

  R.MODELS = ['nylon', 'steel', 'strat', 'lespaul', 'hollow'];
  /** the Guitar Lab files are loaded and the browser can run AudioWorklets */
  R.ok = () => !!(GL && GL.Engine && GL.TYPES && window.AudioWorkletNode);

  /* ======================================================== SETTINGS == */
  R.isRigTrack = t => !!t && t.engine === 'rig';
  /** a rig track that is not overridden by sampler zones or a plugin instrument */
  R.active = t => R.isRigTrack(t) && R.ok() && !(t.sampler && t.sampler.zones && t.sampler.zones.length) &&
    !(t.plugin && SDAW.desktop && SDAW.desktop.on);
  R.model = t => { const m = t && t.params && t.params.rig; return GL && GL.TYPES && GL.TYPES[m] ? m : 'steel'; };
  R.type = t => GL.TYPES[R.model(t)];
  const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  /** full settings of the track for a model (factory + your changes, validated) */
  R.settings = function (t, model) {
    const m = model || R.model(t);
    const d = t && t.params && t.params.rigS && t.params.rigS[m];
    return GL.sanitize(m, d || {});
  };
  /** only the values that differ from the factory sound */
  R.toDiff = function (model, full) {
    const f = GL.factory(model), out = {};
    GL.PARAMS.forEach(p => { if (full[p.id] !== undefined && !same(full[p.id], f[p.id])) out[p.id] = full[p.id]; });
    return out;
  };
  function diffOf(t, model) {
    t.params = t.params || {};
    t.params.rigS = t.params.rigS || {};
    return (t.params.rigS[model] = t.params.rigS[model] || {});
  }
  /** change one setting (the caller takes the undo snapshot: store.beginEdit / endEdit) */
  R.setValue = function (t, key, v, model) {
    const m = model || R.model(t), f = GL.factory(m), d = diffOf(t, m);
    if (same(f[key], v)) delete d[key]; else d[key] = v;
  };
  /** replace all changes of a model (preset); null = back to the factory sound */
  R.setDiff = function (t, diff, model) {
    const m = model || R.model(t);
    diffOf(t, m);
    t.params.rigS[m] = diff ? R.toDiff(m, GL.sanitize(m, diff)) : {};
  };
  R.reset = (t, model) => R.setDiff(t, null, model);

  /* ---------------------------------------- Guitar Lab references / presets */
  const REF_KEY = 'scoredaw.rigRefs', PRESET_KEY = 'scoredaw.rigPresets';
  const readLS = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  /** the reference saved in Guitar Lab (★): imported file, or the lab's own storage (same origin) */
  R.labReference = function (model) {
    const imported = readLS(REF_KEY);
    if (imported && imported[model]) return imported[model];
    const lab = GL && GL.CONFIG ? readLS(GL.CONFIG.storageKey) : null;
    const ref = lab && lab.refs && lab.refs[model];
    return ref && ref.settings ? R.toDiff(model, GL.sanitize(model, ref.settings)) : null;
  };
  /** new rig tracks start from the Guitar Lab reference when there is one */
  R.seed = function (model) {
    const ref = R.labReference(model);
    return ref ? { [model]: Object.assign({}, ref) } : {};
  };
  /** import guitar-references.json or guitar-lab-state.json (Guitar Lab files) */
  R.importLabFile = function (json) {
    const out = readLS(REF_KEY) || {}, got = [];
    const put = (m, settings) => { if (GL.TYPES[m] && settings) { out[m] = R.toDiff(m, GL.sanitize(m, settings)); got.push(m); } };
    if (json && json.guitars) Object.keys(json.guitars).forEach(m => put(m, json.guitars[m].settings));
    else if (json && json.slots) {
      R.MODELS.forEach(m => {
        const ref = json.refs && json.refs[m];
        const slot = json.slot && json.slot[m], sl = json.slots[m] && json.slots[m][slot || 'A'];
        put(m, ref ? ref.settings : sl && sl.settings);
      });
    }
    writeLS(REF_KEY, out);
    // settings travel in the file, recordings do not: a reference that uses "My library (folder)"
    // needs that folder loaded again in this program (each program / browser keeps its own libraries)
    got.needsLibrary = got.filter(m => out[m] && out[m].sampleLib === 'My library (folder)');
    return got;
  };
  /** built-in starting points (diffs over the factory sound of each guitar) */
  const STYLE = {
    electric: [
      ['Clean (real Deluxe)', { ampModel: 'NAM · Fender Deluxe Reverb', namInput: -3 }],
      ['Jazz clean (JC-120, neck)', { ampModel: 'NAM · Roland JC-120', pickupSel: 'Neck', toneKnob: 6, reverbType: 'Real plate (IR)', reverbMix: 0.18 }],
      ['Chime (AC10)', { ampModel: 'NAM · Vox AC10', cab: 'IR · Celestion (real cab)', namInput: 2 }],
      ['Crunch (JCM800)', { ampModel: 'NAM · Marshall JCM800', namInput: 0, pickupSel: 'Bridge', reverbMix: 0.12 }],
      ['Blues lead (Dumble + delay)', { ampModel: 'NAM · Dumble ODS', namInput: 4, delayMix: 0.18, delayTime: 380, reverbMix: 0.22, comp: 0.4 }],
      ['High gain (5153 + 4x12)', { ampModel: 'NAM · EVH 5153 (high gain)', cab: 'IR · Mesa 4x12 (real cab)', pickupSel: 'Bridge', namInput: 0, reverbMix: 0.1 }],
      ['Funk (quack + compressor)', { pickupSel: 'Middle + Bridge', comp: 0.65, ampModel: 'NAM · Roland JC-120' }],
      ['Ambient (chorus + long delay)', { chorusMix: 0.45, chorusDepth: 0.5, delayMix: 0.3, delayTime: 520, delayFeedback: 0.45, reverbType: 'Hall', reverbSize: 3.2, reverbMix: 0.38 }]
    ],
    acoustic: [
      ['Bright strummer', { micPos: 'Bridge', tilt: 0.3, comp: 0.45 }],
      ['Warm fingerstyle', { micPos: 'Soundhole', tilt: -0.3, micDistance: 0.25 }],
      ['Stage (piezo blend)', { piezoBlend: 0.55, comp: 0.5, reverbMix: 0.12 }],
      ['Room ambience', { micPos: 'Stereo pair (room)', micDistance: 0.7, reverbType: 'Hall', reverbMix: 0.32 }],
      ['Intimate (close mic, dry)', { micDistance: 0.12, reverbMix: 0.06 }]
    ]
  };
  /** every preset of a model: [{ id, name, group, diff }] */
  R.presets = function (model) {
    const T = GL.TYPES[model], list = [{ id: 'factory', name: 'Factory sound', group: 'Factory', diff: {} }];
    const ref = R.labReference(model);
    if (ref) list.push({ id: 'labref', name: '★ My Guitar Lab reference', group: 'Factory', diff: ref });
    (STYLE[T.cat] || []).forEach(([name, diff], i) => list.push({ id: 'style' + i, name, group: 'Styles', diff }));
    const mine = (readLS(PRESET_KEY) || {})[model] || {};
    Object.keys(mine).sort().forEach(name => list.push({ id: 'my:' + name, name, group: 'My presets', diff: mine[name], mine: true }));
    return list;
  };
  R.savePreset = function (model, name, diff) {
    const all = readLS(PRESET_KEY) || {};
    all[model] = all[model] || {}; all[model][name] = diff;
    return writeLS(PRESET_KEY, all);
  };
  R.deletePreset = function (model, name) {
    const all = readLS(PRESET_KEY) || {};
    if (all[model]) delete all[model][name];
    writeLS(PRESET_KEY, all);
  };

  /* ======================================================= LIBRARIES == */
  /** id of the recordings a model + settings want (null = physical model) */
  R.wantedLib = function (model, s) {
    if (s.engine === 'Physical model') return null;
    const T = GL.TYPES[model];
    if (s.sampleLib === 'My library (folder)') return 'user:' + model;
    if (s.sampleLib === 'Built-in (alternative)' && T.libAlt) return T.libAlt;
    return T.lib || null;
  };
  // libraries you loaded in Guitar Lab ("📂 Load library…") live in its IndexedDB (same origin)
  const IDB = {
    db() { return new Promise((res, rej) => { const r = indexedDB.open('scoredaw-guitarlab', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.db(); return new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
    async set(k, v) { const db = await this.db(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
  };
  const fileLike = x => ({ name: x.path.split('/').pop(), webkitRelativePath: x.path, arrayBuffer: () => x.blob.arrayBuffer(), text: () => x.blob.text() });
  /** decoded libraries are shared by every track and every render (one promise per id) */
  function loadLib(id) {
    if (R.libs[id]) return R.libs[id];
    const prog = f => { R.libProg[id] = f; emitAll(); };
    const p = (async () => {
      if (id.startsWith('user:')) {
        const files = await IDB.get('lib:' + id);
        if (!files) throw new Error('nouser');
        return GL.libraryFromFiles(files.map(fileLike), prog);
      }
      return GL.loadBundledLibrary(id, prog);
    })();
    R.libs[id] = p;
    p.catch(() => { if (R.libs[id] === p) delete R.libs[id]; });
    return p;
  }
  /** store a folder of recordings (SFZ / WAV) as "My library" of a model */
  R.storeUserLibrary = async function (model, files) {
    const id = 'user:' + model;
    await IDB.set('lib:' + id, files.map(f => ({ path: f.webkitRelativePath || f.name, blob: f })));
    delete R.libs[id];
    live.forEach(r => { if (r.libId === id) r.libId = undefined; });
  };

  /* ===================================================== THE ENGINES == */
  const perCtx = new WeakMap();      // AudioContext → Map(trackId → rig)
  const live = new Set();            // rigs of the live context (note-off flushing, sleeping)
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
    const r = {
      id: track.id, ctx, offline, model, s, sig: '', eng: null, out: ctx.createGain(), dest: null,
      queue: [], pend: [], nid: 0, last: [], libId: undefined, libState: '', libName: '', err: '', lastNote: ctx.currentTime
    };
    r.out.gain.value = RC().outputTrim;
    for (let i = 0; i < 6; i++) r.last.push({ t: -9, end: -9, midi: 0, fret: null, id: 0, bent: 0 });
    r.creating = GL.Engine.create(ctx, { params: GL.workletParams(model, s), destination: r.out }).then(eng => {
      if (r.dead) { eng.dispose(); return; }
      r.eng = eng;
      applyRig(r, null, true);
      flushQueue(r);
      emit(r.id);
    }).catch(e => { r.err = e.message || String(e); console.warn('Guitar Rig:', e); emit(r.id); });
    return r;
  }
  /** push the track settings into the engine (only when they changed) */
  function applyRig(r, track, force) {
    if (track) {
      const model = R.model(track), s = R.settings(track, model), sig = model + '|' + JSON.stringify(s);
      if (!force && sig === r.sig) return;
      r.sig = sig; r.model = model; r.s = s;
    } else if (!r.sig) r.sig = r.model + '|' + JSON.stringify(r.s);
    if (!r.eng) return;
    r.eng.apply(r.model, r.s, { immediate: force || r.offline, noWorklet: r.offline });
    ensureLib(r);
  }
  function ensureLib(r) {
    const id = R.wantedLib(r.model, r.s), eng = r.eng;
    if (id === r.libId) return;
    r.libId = id;
    // the recordings of another guitar must not keep playing while these load
    if (eng.sampler.lib) { eng.sampler.setLibrary(null); eng.apply(r.model, r.s, { noWorklet: true }); }
    r.libName = '';
    if (!id) { r.libState = ''; emit(r.id); return; }
    if (!id.startsWith('user:') && !GL.assetsAvailable()) { r.libState = 'file'; emit(r.id); return; }
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
  /** notes that came while the engine was being created: keep their spacing, start now */
  function flushQueue(r) {
    const q = r.queue; r.queue = [];
    if (!q.length) return;
    const first = Math.min(...q.map(x => x[2]));
    const shift = Math.max(0, r.ctx.currentTime + 0.03 - first);
    q.forEach(([track, pitch, time, dur, opts]) => R.play(track, pitch, time + shift, dur, opts));
  }

  /** from audio.js A.updateTrack(track): create the engine, connect it, apply the settings */
  R.update = function (track, chain) {
    const A = SDAW.audio;
    if (!A.ctx || !GL) return;
    const m = perCtx.get(A.ctx);
    if (!R.active(track)) { if (m && m.has(track.id)) R.remove(track.id); return; }
    if (A.offline) {                      // renders: only the tracks that are heard
      const anySolo = SDAW.store.song.tracks.some(x => x.solo);
      if (track.mute || (anySolo && !track.solo)) return;
    }
    const r = getRig(track, true);
    if (!r) return;
    if (chain && r.dest !== chain.input) { try { r.out.disconnect(); } catch (e) { /* first time */ } r.out.connect(chain.input); r.dest = chain.input; }
    applyRig(r, track, false);
  };
  /** apply right now (knob drags in the panel, before the undo snapshot is closed) */
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
  /** engines of deleted tracks (undo, new song…) are removed */
  function prune() {
    const ids = new Set(SDAW.store.song.tracks.filter(R.active).map(t => t.id));
    live.forEach(r => { if (!ids.has(r.id) && !r.id.startsWith('__')) R.remove(r.id, r.ctx); });
  }

  /* ================================================ NOTE → EVENTS == */
  /** a string for a note without tab position: free (not in this chord), lowest comfortable fret */
  function pickString(r, pitch, t) {
    const busy = new Set();
    r.last.forEach((L, i) => { if (Math.abs(L.t - t) < 0.035) busy.add(i); });
    const frets = r.last.filter(L => L.fret !== null && t - L.t < 2).map(L => L.fret);
    const near = frets.length ? frets.reduce((a, b) => a + b, 0) / frets.length : null;
    const pos = SDAW.autoFret(pitch, busy, near) || SDAW.autoFret(pitch, null, near);
    if (pos) return pos;
    const tun = CONFIG.guitar.tuning;
    let best = 0; tun.forEach((o, i) => { if (pitch >= o) best = i; });
    return { string: best, fret: pitch - tun[best] };
  }
  /** offs whose time is before `limit` are final: send them */
  function flushPending(r, limit) {
    if (!r.pend.length || !r.eng) return;
    const go = [], keep = [];
    r.pend.forEach(p => (p.t < limit ? go : keep).push(p));
    r.pend = keep;
    if (go.length) r.eng.send(go);
  }

  /**
   * One ScoreDAW note → Guitar Lab events.
   *   opts: { vel 0..127, tech, prevPitch, strumIndex, string, fret }
   */
  function noteEvents(r, track, pitch, time, dur, opts) {
    const s = r.s, C = RC(), T = track.technique || {}, tech = opts.tech || {}, tun = CONFIG.guitar.tuning;
    const legato = !!(tech.h || tech.p || tech.tap);
    // ---- human feel (Guitar Lab "Playing" settings) and strums
    let vel = clamp((opts.vel || 100) / 127, 0.02, 1);
    vel = clamp(vel * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.25), 0.03, 1);
    let t = time + gauss() * s.humanTime / 1000 * (legato ? 0.3 : 1);
    if (tech.strum && opts.strumIndex > 0) {
      t += opts.strumIndex * s.strumSpeed / 1000 * (0.85 + 0.3 * Math.random());
      vel *= (1 - opts.strumIndex * 0.035) * (tech.strum === 'up' ? 0.92 : 1);
    }
    t = Math.max(0, t);
    if (tech.mute) dur = Math.min(dur, 0.12);
    // ---- string and fret (from the tab when the note has them)
    let st = opts.string, fret = opts.fret;
    // the note's string already plays another note of this chord (same moment) → a free string
    if (st >= 0 && st < 6 && r.last[st].id && Math.abs(r.last[st].t0 - time) < 0.002 && r.last[st].midi !== pitch) st = -1;
    if (!(st >= 0 && st < 6)) { const pos = pickString(r, pitch, t); st = pos.string; fret = pos.fret; }
    if (fret === undefined || fret === null) fret = pitch - tun[st];
    const L = r.last[st];
    const ringing = L.id && L.end > t - 0.03;
    const sl = tech.slide;
    const continues = ringing && (legato || sl === true || sl === 'legato');
    // ---- note-offs of this string: a legato note continues the string, a new pluck replaces it
    const due = [];
    r.pend = r.pend.filter(p => {
      if (p.s !== st) return true;
      if (p.t > t - (continues ? 0.03 : 0)) return false;      // cancelled
      due.push(p); return false;                                // before this note: send now, in order
    });
    // ---- pitch: harmonics
    let midi = pitch, harm = false, b0 = 0;
    if (tech.harm) { harm = true; const h = C.harmonics[fret]; midi = h !== undefined ? tun[st] + h : pitch + 12; }
    else if (tech.pinch) { harm = true; midi = pitch + C.pinchHarmonic; }
    const on = {
      type: 'on', t, s: st, midi, vel, id: ++r.nid, pm: !!tech.pm, dead: !!tech.mute,
      vib: !!(tech.vib || tech.wvib), vibMul: tech.wvib ? C.wideVibrato : 1, legato: false, glide: 0, harm
    };
    const before = due.slice(), after = [];
    const slideT = clamp(T.slideTime || 0.12, 0.03, 0.4);
    if (legato && ringing) on.legato = true;
    // ---- slides
    if (sl === true || sl === 'legato') {
      if (ringing) { on.legato = true; on.glide = slideT; }
      else if (opts.prevPitch !== undefined && opts.prevPitch !== pitch && Math.abs(opts.prevPitch - pitch) <= 12) {
        const pre = Math.min(0.12, slideT);                     // grace note on the previous pitch, then glide
        before.push({ type: 'on', t: Math.max(0, t - pre), s: st, midi: opts.prevPitch, vel: vel * 0.9, id: ++r.nid, legato: false, glide: 0 });
        on.legato = true; on.glide = pre * 0.8;
      }
    } else if (sl === 'shift') {
      // shift slide: the ringing note slides to the new fret, then the new note is picked
      if (ringing && L.midi !== midi) before.push({ type: 'bend', t: Math.max(L.t + 0.02, t - slideT), s: st, semis: midi - L.midi, glide: slideT * 0.85 });
    } else if (sl === 'inBelow' || sl === 'inAbove') {
      const d = (sl === 'inBelow' ? -1 : 1) * C.slideSemis;
      on.midi = midi + d; b0 = -d;
      after.push({ type: 'bend', t: t + 0.004, s: st, semis: b0, glide: slideT });
    }
    // a legato note on a bent string starts unbent
    if (on.legato && L.bent) before.push({ type: 'bend', t: Math.max(0, t - 0.002), s: st, semis: 0, glide: 0.005 });
    // ---- bends (semitones; ScoreDAW's bend types)
    if (tech.bend) {
      const amt = typeof tech.bend === 'number' ? tech.bend : (T.bendRange || 2);
      const g = x => clamp(dur * x, 0.05, 0.45);
      const ty = tech.bendType || 'up';
      if (ty === 'pre') on.midi += amt;
      else if (ty === 'prerelease') { on.midi += amt; after.push({ type: 'bend', t: t + dur * 0.15, s: st, semis: b0 - amt, glide: g(0.35) }); }
      else if (ty === 'release') {
        after.push({ type: 'bend', t: t + dur * 0.1, s: st, semis: b0 + amt, glide: g(0.25) });
        after.push({ type: 'bend', t: t + dur * 0.55, s: st, semis: b0, glide: g(0.3) });
      } else after.push({ type: 'bend', t: t + dur * 0.12, s: st, semis: b0 + amt, glide: g(0.3) });
    }
    if (sl === 'outDown' || sl === 'outUp') after.push({ type: 'bend', t: t + dur * 0.65, s: st, semis: b0 + (sl === 'outDown' ? -1 : 1) * C.slideOutSemis, glide: dur * 0.35 });
    // ---- string squeak when the hand jumps on a wound string
    if (!on.legato && st <= 3 && L.fret !== null && Math.abs(fret - L.fret) >= 3 && s.squeak > 0 && Math.random() < s.squeakProb) {
      const up = Math.random() < 0.5;
      before.push({ type: 'squeak', t: Math.max(0, t - 0.06), f0: up ? 900 + Math.random() * 500 : 2600 + Math.random() * 900, f1: up ? 2000 + Math.random() * 1400 : 1000 + Math.random() * 400, amp: 0.45 + 0.3 * Math.random(), dur: 0.08 + 0.14 * Math.random() });
    }
    // ---- the note-off waits (a slide / hammer-on may continue the string)
    const off = { type: 'off', t: t + Math.max(0.02, dur), s: st, id: on.id, harm };
    r.pend.push(off);
    // Pitch events belong to a note, even when another note later reuses its string.
    before.forEach(e => { if (e.type === 'bend') e.id = L.id; });
    after.forEach(e => { if (e.type === 'bend') e.id = on.id; });
    const lastBend = after.length ? after[after.length - 1].semis : 0;
    Object.assign(L, { t, t0: time, end: off.t, midi: on.midi, fret, id: on.id, bent: lastBend });
    return before.concat([on], after).sort((a, b) => a.t - b.t);
  }

  /** from audio.js playMelodic: true when the rig took the note */
  R.play = function (track, pitch, time, dur, opts) {
    const r = getRig(track, true);
    if (!r) return false;
    if (!r.dest) { const ch = SDAW.audio.getChain(track); r.out.connect(ch.input); r.dest = ch.input; }
    // Library previews wait for the real recordings (so the preview sounds like the track will)
    const waitLib = track.id.startsWith('__') && r.libState === 'loading';
    if (!r.eng || waitLib) { if (!r.err && r.queue.length < 160) r.queue.push([track, pitch, time, dur, opts]); return true; }
    r.eng.wake();
    const list = noteEvents(r, track, pitch, time, dur, opts || {});
    r.eng.send(list);
    r.lastNote = Math.max(r.lastNote, time + dur);
    return true;
  };

  /**
   * Before ▶ (audio.js A.play): null when this track is ready to play, else a promise that
   * resolves once its engine runs and its recordings, amp capture and cabinet IR are loaded (or failed — then the
   * status tells which file, and the fallback that plays is named there).
   */
  R.whenReady = function (track) {
    if (!R.active(track)) return null;
    SDAW.audio.updateTrack(track);
    const r = getRig(track, true);
    if (!r || r.err) return null;
    const busy = !r.eng || r.libState === 'loading' || !!(r.eng && r.eng.pending && r.eng.pending.length);
    if (!busy) return null;
    return (async () => { await r.creating; if (r.libJob) await r.libJob.catch(() => {}); if (r.eng) await r.eng.ready().catch(() => {}); })();
  };
  /** Stop: silence every live rig */
  R.stopAll = function () {
    live.forEach(r => {
      r.pend = []; r.queue = [];
      r.last.forEach(L => { L.id = 0; L.end = -9; L.bent = 0; });
      if (r.eng) r.eng.stop();
    });
  };

  /* ===================================================== OFFLINE == */
  /** before an offline render: every engine created, recordings + amps + IRs loaded */
  R.prepareOffline = async function (ctx) {
    const m = perCtx.get(ctx);
    if (!m) return;
    for (const r of m.values()) {
      await r.creating;
      if (r.libJob) await r.libJob.catch(() => {});
      if (r.eng) { await r.eng.ready(); r.eng.apply(r.model, r.s, { immediate: true, noWorklet: true }); }
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
        const idle = now - r.lastNote;
        if (!r.pend.length && !r.eng.asleep && idle > RC().idleSleepSec && !r.demo) r.eng.sleep();
        if (r.id.startsWith('__') && idle > 40) R.remove(r.id, r.ctx);         // library previews
      });
    }, 20);
  }

  /* ===================================================== STATUS == */
  const emit = id => { if (SDAW.bus) SDAW.bus.emit('rig', { id }); };
  const emitAll = SDAW.debounce ? SDAW.debounce(() => live.forEach(r => emit(r.id)), 80) : () => {};
  /** state of the track's rig for the panel / inspector */
  R.status = function (track) {
    // another sound source has priority over the rig: say which one really plays
    const other = SDAW.otherSource ? SDAW.otherSource(track) : null;
    if (other) return { level: 'warn', text: other + ' plays this track — the Guitar Rig is silent' };
    if (!GL || !GL.Engine) return { level: 'warn', text: 'Guitar engine files not found (tools/guitar-lab)' };
    if (!window.AudioWorkletNode) return { level: 'warn', text: 'This browser cannot run the guitar engine (AudioWorklet) — use Chrome or Edge' };
    const r = R.rigOf(track.id);
    const s = R.settings(track), model = R.model(track), A = GL.AMPS[s.ampModel] || {}, el = GL.TYPES[model].cat === 'electric';
    const disk = GL.fromDisk() && !GL.PACKS;
    const amp = el ? (A.nam && !disk ? 'real amp ' + s.ampModel.replace('NAM · ', '') : 'built-in amp ' + s.ampModel) : '';
    if (!r) return { level: 'idle', text: 'Press ▶ or a key to start the audio', amp };
    if (r.err && !r.eng) return { level: 'warn', text: '⚠ ' + r.err, amp };
    if (!r.eng) return { level: 'busy', text: '⏳ Starting the guitar engine…', amp };
    const id = r.libId;
    let text, level = 'ok';
    if (!id) text = 'Physical model (synthesized strings)';
    else if (r.libState === 'loading') { level = 'busy'; text = '⏳ Loading the real recordings ' + Math.round((R.libProg[id] || 0) * 100) + '% — the string model plays meanwhile'; }
    else if (r.libState === 'file') { level = 'warn'; text = '⚠ Opened from disk without the packs folder: the string model plays (see tools/guitar-lab/build_packs.py)'; }
    else if (r.libState === 'nouser') { level = 'warn'; text = '⚠ No library of your own for this guitar yet — "📂 Load library…"'; }
    else if (r.libState === 'error') { level = 'warn'; text = '⚠ Recordings: ' + r.err; }
    else text = (s.engine === 'Layered (samples + model)' ? 'Real recordings + string model: ' : 'Real recordings: ') + (r.libName || id);
    // which amp / cabinet really sounds (a capture that is loading or failed is replaced by the built-in one)
    if (el && r.eng) {
      const want = A.nam && !disk ? A.nam : null;
      if (r.eng.assetErr) { level = 'warn'; text += ' · ⚠ ' + r.eng.assetErr; }
      else if (want && r.eng.namReady !== want) text += ' · ⏳ loading the real amp (built-in amp meanwhile)';
    }
    return { level, text, amp };
  };
  /** the engine's analyser (spectrum in the panel) */
  R.analyser = track => { const r = R.rigOf(track.id); return r && r.eng ? r.eng.n.analyser : null; };

  /* ============================================ TEST PHRASES (demos) == */
  /** play a Guitar Lab demo phrase on the track's rig (without the transport) */
  R.demo = async function (track, demoId) {
    const A = SDAW.audio;
    A.init(); A.updateTrack(track);
    const r = getRig(track, true); if (!r) return 0;
    await r.creating;
    // the demo also waits for the recordings, the amp capture and the cabinet IR (first click = the real sound)
    if (r.libJob) await r.libJob.catch(() => {});
    if (r.eng) await r.eng.ready().catch(() => {});
    if (!r.eng) return 0;
    const demo = GL.DEMOS.find(d => d.id === demoId) || GL.DEMOS[0];
    r.eng.stop(); r.eng.wake();
    const t0 = r.ctx.currentTime + 0.12, spb = 60 / demo.bpm, s = r.s, ev = [], last = [null, null, null, null, null, null];
    let end = 0, lastChord = null;
    const ht = () => gauss() * s.humanTime / 1000, hv = v => clamp(v * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.25), 0.05, 1);
    const open = GL.CONFIG.tunings[s.tuning] || GL.CONFIG.tunings.Standard;
    const squeak = (t, strong) => {
      if (s.squeak <= 0 || Math.random() > s.squeakProb) return;
      const up = Math.random() < 0.5;
      ev.push({ type: 'squeak', t: Math.max(t0, t), f0: up ? 900 + Math.random() * 500 : 2600 + Math.random() * 900, f1: up ? 2000 + Math.random() * 1400 : 1000 + Math.random() * 400, amp: (strong ? 0.7 : 0.45) + 0.3 * Math.random(), dur: 0.08 + 0.14 * Math.random() });
    };
    const note = (t, st, fret, dur, vel, o) => {
      o = o || {};
      const id = ++r.nid;
      ev.push({ type: 'on', t, s: st, midi: open[st] + (o.harm || fret), vel, id, pm: !!o.pm, dead: !!o.dead, vib: !!o.vib, legato: !!o.legato, glide: o.glide || 0, harm: !!o.harm });
      ev.push({ type: 'off', t: t + dur, s: st, id });
      end = Math.max(end, t + dur);
    };
    demo.build().slice().sort((a, b) => a.b - b.b).forEach(it => {
      const tb = t0 + it.b * spb;
      if (it.k === 'n') {
        const t = Math.max(t0, tb + ht() * (it.legato ? 0.3 : 1)), dur = it.d * spb, v = hv(it.v);
        if (last[it.s] !== null && Math.abs(last[it.s] - it.f) >= 3 && it.s <= 3 && !it.legato) squeak(t - 0.06, false);
        last[it.s] = it.f;
        if (it.slideFrom !== undefined) {
          const pre = Math.min(0.12, spb * 0.3);
          note(Math.max(t0, t - pre), it.s, it.slideFrom, pre + 0.01, v);
          note(t, it.s, it.f, dur, v, { legato: true, glide: pre * 0.8, vib: it.vib });
        } else note(t, it.s, it.f, dur, v, { pm: it.pm, vib: it.vib, legato: it.legato, glide: it.glide, harm: it.harm, dead: it.dead });
        if (it.bend) {
          ev.push({ type: 'bend', t: t + it.bend.at * spb, s: it.s, semis: it.bend.semis, glide: it.bend.dur * spb });
          if (it.bend.back) ev.push({ type: 'bend', t: t + it.bend.back * spb, s: it.s, semis: 0, glide: 0.12 });
        }
      } else if (it.k === 'strum') {
        const fr = GL.CHORDS[it.chord]; if (!fr) return;
        let strs = [0, 1, 2, 3, 4, 5].filter(i => fr[i] >= 0);
        if (it.strings) strs = strs.filter(i => i >= it.strings[0] && i <= it.strings[1]);
        if (it.dir === 'U') strs.reverse();
        const sp = s.strumSpeed / 1000 * (it.speed || 1), base = Math.max(t0, tb + ht());
        if (lastChord && lastChord !== it.chord) squeak(base - 0.07, true);
        lastChord = it.chord;
        strs.forEach((st, i) => {
          note(base + i * sp * (0.85 + 0.3 * Math.random()), st, fr[st], it.d * spb, hv(it.v * (1 - i * 0.035) * (it.dir === 'U' ? 0.92 : 1)), { pm: it.pm, dead: it.dead });
          last[st] = fr[st];
        });
      }
    });
    ev.sort((a, b) => a.t - b.t);
    r.eng.send(ev);
    r.lastNote = Math.max(r.lastNote, end);
    r.demo = true; clearTimeout(r.demoTimer);
    r.demoTimer = setTimeout(() => { r.demo = false; emit(r.id); }, (end - r.ctx.currentTime + 0.5) * 1000);
    return end - t0;
  };
  R.stopDemo = function (track) {
    const r = R.rigOf(track.id); if (!r || !r.eng) return;
    clearTimeout(r.demoTimer); r.demo = false; r.eng.stop(); emit(r.id);
  };
  R.demoPlaying = track => { const r = R.rigOf(track.id); return !!(r && r.demo); };
  /** demo phrases, the best ones for this guitar first */
  R.demos = model => (GL.DEMO_ORDER[model] || GL.DEMOS.map(d => d.id)).map(id => GL.DEMOS.find(d => d.id === id)).filter(Boolean);

  if (SDAW.bus) SDAW.bus.on('change', () => { if (SDAW.audio && SDAW.audio.ctx) prune(); });
})(window.SDAW);
