/* =============================================================================
 *  WINDRIG.JS — realistic winds inside ScoreDAW (the Wind Lab engine)
 *  -----------------------------------------------------------------------------
 *  A track with engine 'windrig' plays one of the Wind Lab instruments
 *  (tools/wind-lab/presets.js WL.TYPES):
 *      tenorsax · Tenor Saxophone   real recordings (sustain, vibrato, staccato)
 *      trumpet  · Trumpet in Bb     real recordings (+ harmon / straight mute)
 *
 *  WHERE THE SETTINGS LIVE (saved with the song, same scheme as the Piano Rig)
 *      track.params.wrig            instrument id ('tenorsax' | 'trumpet')
 *      track.params.wrigS[id]       ONLY the settings changed from the factory
 *                                   sound of that instrument (a "diff")
 *
 *  HOW A NOTE BECOMES SOUND
 *      audio.js playMelodic() → SDAW.windRig.play(track, pitch, time, dur, opts)
 *      → Wind Lab events { type:'on'|'off'|'bend', t, midi, vel, id, dur, … }
 *      → WL.Engine.send()
 *  A horn plays ONE note at a time ("Mono legato"), so how two notes connect
 *  matters. The Wind Lab engine decides that from the order of the events:
 *  the note-offs are held back and sent in time order, right before the next
 *  note (or just before their time), so the engine always knows whether the
 *  previous note still sounds when a new one starts.
 *      overlapping notes, or notes marked hammer-on / pull-off / legato slide
 *                                   → SLURRED (no new tongue, pitch glides)
 *      notes that only touch        → tongued (setting "Slurs in a ScoreDAW
 *                                   song" = "Every connected note" slurs them)
 *      two notes at the same time   → the higher one (the melody) is played
 *  Note marks used:  staccato (staccato recordings) · accent · vibrato / wide
 *  vibrato · slide in from below = scoop · slide out down = fall-off ·
 *  slide out up = doit · bend.
 *
 *  Public API (SDAW.windRig) — mirrors SDAW.pianoRig:
 *      ok() · active(track) · model(track) · settings(track[, model])
 *      setValue · setDiff · reset · toDiff · update(track, chain) · applyNow
 *      play(track, pitch, time, dur, opts) · stopAll() · remove(id)
 *      prepareOffline(ctx) · flushOffline(ctx, limit)
 *      status(track) · analyser(track) · demo / stopDemo / demoPlaying / demos
 *      key(track, midi, vel, on, tech) · presets · savePreset · deletePreset
 *      importLabFile · labReference · seed · itemSound
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const WL = window.WL;
  const RC = () => CONFIG.windRig;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const R = { libs: {}, libProg: {} };
  SDAW.windRig = R;

  R.MODELS = ['tenorsax', 'trumpet'];
  R.ok = () => !!(WL && WL.Engine && WL.TYPES && WL.PARAMS);

  /* ======================================================== SETTINGS == */
  R.isRigTrack = t => !!t && t.engine === 'windrig';
  R.active = t => R.isRigTrack(t) && R.ok() && !(t.sampler && t.sampler.zones && t.sampler.zones.length) &&
    !(t.plugin && SDAW.desktop && SDAW.desktop.on);
  R.model = t => { const m = t && t.params && t.params.wrig; return WL && WL.TYPES && WL.TYPES[m] ? m : 'tenorsax'; };
  R.type = t => WL.TYPES[R.model(t)];
  const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  R.settings = function (t, model) {
    const m = model || R.model(t);
    const d = t && t.params && t.params.wrigS && t.params.wrigS[m];
    return WL.sanitize(m, d || {});
  };
  R.toDiff = function (model, full) {
    const f = WL.factory(model), out = {};
    WL.PARAMS.forEach(p => { if (full[p.id] !== undefined && !same(full[p.id], f[p.id])) out[p.id] = full[p.id]; });
    return out;
  };
  function diffOf(t, model) {
    t.params = t.params || {};
    t.params.wrigS = t.params.wrigS || {};
    return (t.params.wrigS[model] = t.params.wrigS[model] || {});
  }
  R.setValue = function (t, key, v, model) {
    const m = model || R.model(t), f = WL.factory(m), d = diffOf(t, m);
    if (same(f[key], v)) delete d[key]; else d[key] = v;
  };
  R.setDiff = function (t, diff, model) {
    const m = model || R.model(t);
    diffOf(t, m);
    t.params.wrigS[m] = diff ? R.toDiff(m, WL.sanitize(m, Object.assign(WL.factory(m), diff))) : {};
  };
  R.reset = (t, model) => R.setDiff(t, null, model);

  /* ----------------------------------------- Wind Lab references / presets */
  const REF_KEY = 'scoredaw.wrigRefs', PRESET_KEY = 'scoredaw.wrigPresets';
  const readLS = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  /** the ⭐ reference saved in the Wind Lab: imported file, or the lab's own storage (same origin) */
  R.labReference = function (model) {
    const imported = readLS(REF_KEY);
    if (imported && imported[model]) return imported[model];
    const lab = WL && WL.CONFIG ? readLS(WL.CONFIG.storageKey) : null;
    const ref = lab && lab.refs && lab.refs[model];
    return ref && ref.settings ? R.toDiff(model, WL.sanitize(model, ref.settings)) : null;
  };
  /** settings of a new rig track: Wind Lab reference (if any) + the library item's own sound */
  R.seed = function (model, itemDiff) {
    const d = Object.assign({}, R.labReference(model) || {}, itemDiff || {});
    return { [model]: R.toDiff(model, WL.sanitize(model, Object.assign(WL.factory(model), d))) };
  };
  /** starting sound of a library item (params.wrigSound = a name in WL.SOUNDS) */
  R.itemSound = inst => { const p = inst && inst.params; return p && p.wrigSound && WL.SOUNDS[p.wrig] ? WL.SOUNDS[p.wrig][p.wrigSound] || null : null; };
  /** import wind-references.json or wind-lab-state.json */
  R.importLabFile = function (json) {
    const out = readLS(REF_KEY) || {}, got = [];
    const put = (m, settings) => { if (WL.TYPES[m] && settings) { out[m] = R.toDiff(m, WL.sanitize(m, settings)); got.push(m); } };
    if (json && json.instruments) Object.keys(json.instruments).forEach(m => put(m, json.instruments[m].settings));
    else if (json && json.slots) R.MODELS.forEach(m => {
      const ref = json.refs && json.refs[m], slot = json.slot && json.slot[m], sl = json.slots[m] && json.slots[m][slot || 'A'];
      put(m, ref ? ref.settings : sl && sl.settings);
    });
    writeLS(REF_KEY, out);
    return got;
  };
  /** factory, ★ lab reference, the Wind Lab sounds and your own presets: [{ id, name, group, diff }] */
  R.presets = function (model) {
    const list = [{ id: 'factory', name: 'Factory sound', group: 'Factory', diff: {} }];
    const ref = R.labReference(model);
    if (ref) list.push({ id: 'labref', name: '★ My Wind Lab reference', group: 'Factory', diff: ref });
    const snd = WL.SOUNDS[model] || {};
    Object.keys(snd).forEach((name, i) => { if (Object.keys(snd[name]).length) list.push({ id: 'snd' + i, name, group: 'Sounds', diff: snd[name] }); });
    const mine = (readLS(PRESET_KEY) || {})[model] || {};
    Object.keys(mine).sort().forEach(name => list.push({ id: 'my:' + name, name, group: 'My presets', diff: mine[name], mine: true }));
    return list;
  };
  R.savePreset = function (model, name, diff) { const all = readLS(PRESET_KEY) || {}; all[model] = all[model] || {}; all[model][name] = diff; return writeLS(PRESET_KEY, all); };
  R.deletePreset = function (model, name) { const all = readLS(PRESET_KEY) || {}; if (all[model]) delete all[model][name]; writeLS(PRESET_KEY, all); };

  /* ======================================================= LIBRARIES == */
  function loadLib(id) {
    if (R.libs[id]) return R.libs[id];
    const p = WL.loadBundledLibrary(id, f => { R.libProg[id] = f; emitAll(); });
    R.libs[id] = p;
    p.catch(() => { if (R.libs[id] === p) delete R.libs[id]; });
    return p;
  }

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

  function freshLine(r) { r.lastStart = -9; r.lastEnd = -9; r.lastPitch = null; }
  function makeRig(ctx, track, offline) {
    const model = R.model(track), s = R.settings(track, model);
    const r = { id: track.id, ctx, offline, model, s, sig: '', eng: null, out: ctx.createGain(), dest: null,
      queue: [], pend: [], nid: 0, libId: undefined, libState: '', libName: '', err: '', lastNote: ctx.currentTime };
    freshLine(r);
    r.out.gain.value = RC().outputTrim;
    r.creating = WL.Engine.create(ctx, { destination: r.out }).then(eng => {
      if (r.dead) { eng.dispose(); return; }
      r.eng = eng;
      applyRig(r, null, true);
      flushQueue(r);
      emit(r.id);
    }).catch(e => { r.err = e.message || String(e); console.warn('Wind Rig:', e); emit(r.id); });
    return r;
  }
  function applyRig(r, track, force) {
    if (track) {
      const model = R.model(track), s = R.settings(track, model), sig = model + '|' + JSON.stringify(s);
      if (!force && sig === r.sig) return;
      if (model !== r.model && r.eng) { r.eng.stop(); r.pend = []; freshLine(r); }      // another instrument: silence the old one
      r.sig = sig; r.model = model; r.s = s;
    } else if (!r.sig) r.sig = r.model + '|' + JSON.stringify(r.s);
    if (!r.eng) return;
    r.eng.apply(r.model, r.s, { immediate: force || r.offline });
    ensureLib(r);
  }
  function ensureLib(r) {
    const id = WL.wantedLib(r.model, r.s), eng = r.eng;
    if (id === r.libId) return;
    r.libId = id;
    if (eng.lib) eng.setLibrary(null);              // never play another instrument's recordings
    r.libName = '';
    if (!id) { r.libState = ''; emit(r.id); return; }
    if (!WL.assetsAvailable()) { r.libState = 'file'; emit(r.id); return; }
    r.libState = 'loading'; emit(r.id);
    r.libJob = loadLib(id).then(lib => {
      if (r.libId !== id || r.dead) return;
      eng.setLibrary(lib);
      eng.apply(r.model, r.s, { immediate: r.offline });
      r.libState = 'ready'; r.libName = lib.meta.name; emit(r.id);
      flushQueue(r);
    }).catch(e => {
      if (r.libId !== id) return;
      r.libState = 'error'; r.err = e.message; emit(r.id);
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
    if (!A.ctx || !WL) return;
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
  const isMono = s => s.mono.startsWith('Mono');

  /**
   * One ScoreDAW note → Wind Lab events.
   *   opts: { vel 0..127, tech }      time / dur in seconds (AudioContext clock)
   */
  function noteEvents(r, pitch, time, dur, opts) {
    const s = r.s, tech = opts.tech || {}, list = [];
    let vel = clamp((opts.vel || 100) / 127, 0.02, 1);
    vel = clamp(vel * (1 + (Math.random() * 2 - 1) * s.humanVel * 0.25), 0.02, 1);       // the engine applies the touch curve
    const t = Math.max(0, time + gauss() * s.humanTime / 1000);
    // ---- how this note connects to the previous one (decided on the written times)
    const overlap = time > r.lastStart + 0.02 && time < r.lastEnd - 0.01;
    const touch = !overlap && Math.abs(time - r.lastEnd) <= 0.012;
    const marked = !!(tech.h || tech.p || tech.slide === true || tech.slide === 'legato' || tech.slide === 'shift');
    const slur = overlap || marked || (touch && s.songSlur === 'Every connected note');
    const id = 'w' + (++r.nid);
    const ev = { type: 'on', t, midi: pitch, vel, id, dur: Math.max(0.03, dur) };
    if (slur) ev.slur = true; else ev.tongue = true;
    if (tech.stacc) ev.stacc = true;
    if (tech.accent) ev.accent = true;
    if (tech.vib || tech.wvib) ev.vib = true;
    if (tech.slide === 'inBelow') ev.scoop = true;
    if (tech.slide === 'outDown') ev.fall = true;
    if (tech.slide === 'outUp') ev.doit = true;
    list.push(ev);
    if (tech.bend) {                       // lip bend: 'up' · 'release' (up and back) · 'pre' (starts bent) · 'prerelease'
      const semis = typeof tech.bend === 'number' ? clamp(tech.bend, -3, 3) : 1, type = tech.bendType || 'up';
      const B = (at, to, glide) => list.push({ type: 'bend', t: t + at, id, semis: to, glide });
      if (type === 'up') B(dur * 0.15, semis, Math.min(0.3, dur * 0.3));
      else if (type === 'release') { B(dur * 0.1, semis, Math.min(0.25, dur * 0.25)); B(dur * 0.55, 0, Math.min(0.25, dur * 0.3)); }
      else if (type === 'pre') B(0, semis, 0.005);
      else if (type === 'prerelease') { B(0, semis, 0.005); B(dur * 0.15, 0, Math.min(0.3, dur * 0.35)); }
    }
    r.pend.push({ type: 'off', t: t + Math.max(0.03, dur), id });
    r.lastStart = time; r.lastEnd = time + dur; r.lastPitch = pitch;
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
    opts = opts || {};
    if (time < r.lastStart - 0.3) freshLine(r);                  // the song jumped back (loop / new start)
    // a horn has one voice: of two notes that start together, the higher one (the melody) plays
    if (isMono(r.s) && Math.abs(time - r.lastStart) < 0.012) {
      if (r.lastPitch !== null && pitch <= r.lastPitch) return true;
    }
    flushPending(r, time - 0.002);                    // every off before this note goes first (time order)
    r.eng.send(noteEvents(r, pitch, time, dur, opts));
    r.lastNote = Math.max(r.lastNote, time + dur);
    return true;
  };
  R.stopAll = function () {
    live.forEach(r => { r.pend = []; r.queue = []; freshLine(r); if (r.eng) r.eng.stop(); });
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
  const emit = id => { if (SDAW.bus) SDAW.bus.emit('wrig', { id }); };
  const emitAll = SDAW.debounce ? SDAW.debounce(() => live.forEach(r => emit(r.id)), 80) : () => {};
  R.status = function (track) {
    // another sound source has priority over the rig: say which one really plays
    const other = SDAW.otherSource ? SDAW.otherSource(track) : null;
    if (other) return { level: 'warn', text: other + ' plays this track — the Wind Rig is silent' };
    if (!WL || !WL.Engine) return { level: 'warn', text: 'Wind engine files not found (tools/wind-lab)' };
    const r = R.rigOf(track.id), model = R.model(track), s = R.settings(track, model);
    if (!r) return { level: 'idle', text: 'Press ▶ or a key to start the audio' };
    if (r.err && !r.eng) return { level: 'warn', text: '⚠ ' + r.err };
    if (!r.eng) return { level: 'busy', text: '⏳ Starting the wind engine…' };
    const id = r.libId;
    let text, level = 'ok';
    if (!id) text = 'Synth model (computed horn — choose "Real samples" for the recordings)';
    else if (r.libState === 'loading') { level = 'busy'; text = '⏳ Loading the real recordings ' + Math.round((R.libProg[id] || 0) * 100) + '% — the synth model plays meanwhile'; }
    else if (r.libState === 'file') { level = 'warn'; text = '⚠ Opened from disk without the packs folder: the synth model plays (tools/wind-lab/build_packs.py)'; }
    else if (r.libState === 'error') { level = 'warn'; text = '⚠ Recordings: ' + r.err; }
    else text = 'Real recordings: ' + (r.libName || id);
    if (s.mute && s.mute !== 'Open' && model === 'trumpet') text += ' · ' + s.mute.toLowerCase();
    text += isMono(s) ? ' · mono legato' : ' · poly';
    if (s.players > 1) text += ' · ' + s.players + ' players';
    return { level, text };
  };
  R.analyser = track => { const r = R.rigOf(track.id); return r && r.eng ? r.eng.n.analyser : null; };

  /* ============================================ TEST PHRASES (demos) == */
  R.demos = model => (WL.DEMO_ORDER[model] || WL.DEMOS.map(d => d.id)).map(id => WL.DEMOS.find(d => d.id === id)).filter(Boolean);
  R.demo = async function (track, demoId) {
    const A = SDAW.audio;
    A.init(); A.updateTrack(track);
    const r = getRig(track, true); if (!r) return 0;
    await r.creating;
    if (r.libJob) await r.libJob.catch(() => {});
    if (!r.eng) return 0;
    const demo = WL.DEMOS.find(d => d.id === demoId) || R.demos(r.model)[0];
    r.eng.stop(); r.pend = []; freshLine(r);
    const d = WL.demoEvents(demo, r.s, r.ctx.currentTime + 0.12, r.model);
    r.eng.send(d.events);
    r.lastNote = Math.max(r.lastNote, d.end);
    r.demo = true; clearTimeout(r.demoTimer);
    r.demoTimer = setTimeout(() => { r.demo = false; emit(r.id); }, (d.end - r.ctx.currentTime + 1) * 1000);
    return d.end;
  };
  R.stopDemo = function (track) { const r = R.rigOf(track.id); if (!r || !r.eng) return; clearTimeout(r.demoTimer); r.demo = false; r.eng.stop(); emit(r.id); };
  R.demoPlaying = track => { const r = R.rigOf(track.id); return !!(r && r.demo); };
  /** play one key now (Wind Rig window keyboard). tech = { stacc, accent, scoop, fall, doit, vib } */
  R.key = async function (track, midi, vel, on, tech) {
    const A = SDAW.audio;
    A.init(); A.updateTrack(track);
    const r = getRig(track, true); if (!r) return;
    await r.creating; if (!r.eng) return;
    const t = r.ctx.currentTime;
    if (on) { r.eng.send([Object.assign({ type: 'on', t, midi, vel, id: 'kb' + midi }, tech || {})]); r.lastNote = t + 5; }
    else r.eng.send([{ type: 'off', t, id: 'kb' + midi }]);
  };

  if (SDAW.bus) SDAW.bus.on('change', () => { if (SDAW.audio && SDAW.audio.ctx) prune(); });
})(window.SDAW);
