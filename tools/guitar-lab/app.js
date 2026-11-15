/* =====================================================================
 *  GUITAR LAB — app.js : interface, sequencer, storage
 *  ---------------------------------------------------------------------
 *  · 5 guitars × 4 variants (A B C D) of every setting, instant A/B switch,
 *    automatic A/B/C/D comparison while a demo loops
 *  · ⭐ reference per guitar = the settings ScoreDAW will use later
 *  · named experiments library, variation generator, undo (Ctrl+Z)
 *  · demos with human feel (timing, dynamics, strum, squeaks), fretboard,
 *    chord pad, analyser with held curve, real-recording comparison
 *  · storage: localStorage (automatic) + JSON export / import + direct save
 *    into the project folder (references/guitar-references.json)
 *  · WAV export of the current demo with the current settings
 * ===================================================================== */
(function () {
  'use strict';
  const GL = window.GL, C = GL.CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const copy = o => JSON.parse(JSON.stringify(o));

  /** Tiny DOM helper: el('div', {class, onclick, ...}, children) */
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(kids) ? kids : kids === undefined ? [] : [kids]).forEach(k => { if (k !== null && k !== undefined && k !== false) e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k); });
    return e;
  }
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }

  /* ============================================================ STATE == */
  function fresh() {
    const st = { version: C.version, type: 'nylon', slot: {}, slots: {}, refs: {}, library: {}, demo: {}, bpm: {}, compare: 'off', loop: true,
      ui: { scale: C.ui.scale, open: { source: true, attacklab: true, strings: true, pluck: true, eq: true, real: true, body: true, pickups: true, amp: true }, explore: 0.12 } };
    GL.TYPE_IDS.forEach(t => {
      st.slot[t] = 'A'; st.slots[t] = {}; st.library[t] = []; st.demo[t] = GL.DEMO_ORDER[t][0];
      C.slots.forEach(k => { st.slots[t][k] = { settings: GL.factory(t), rating: 0, notes: '' }; });
    });
    return st;
  }
  function normalize(raw) {
    const oldVersion = (raw && raw.version) || 1;
    const st = Object.assign(fresh(), raw || {});
    st.version = C.version;
    st.ui = Object.assign(fresh().ui, st.ui || {});
    ['source', 'attacklab', 'eq', 'real'].forEach(k => { if (st.ui.open[k] === undefined) st.ui.open[k] = true; });   // new sections open the first time
    ['slot', 'slots', 'refs', 'library', 'demo', 'bpm'].forEach(k => { st[k] = st[k] || {}; });
    GL.TYPE_IDS.forEach(t => {
      st.slots[t] = st.slots[t] || {};
      C.slots.forEach(k => { const sl = st.slots[t][k] || {}; st.slots[t][k] = { settings: GL.sanitize(t, sl.settings), rating: sl.rating || 0, notes: sl.notes || '' }; });
      // v1 → v2: values left at the old factory setting move to the new (swirl-free) ones
      if (oldVersion < 2 && raw && raw.slots) {
        const old = GL.V1_FACTORY[t], nf = GL.factory(t);
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(old).forEach(p => { if (p === 'coupling' || Math.abs(se[p] - old[p]) < 1e-9) se[p] = nf[p]; }); });
      }
      // v8 → v9: Strat values tuned for the old dull recording → new recording defaults
      if (oldVersion < 9 && raw && raw.slots && GL.V8_FACTORY[t]) {
        const old = GL.V8_FACTORY[t], nf = GL.factory(t);
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(old).forEach(p => { if (Math.abs(se[p] - old[p]) < 1e-9) se[p] = nf[p]; }); });
      }
      // v7 → v8: electric amp / cab / reverb left at the old factory values → real captures
      if (oldVersion < 8 && raw && raw.slots && GL.V7_FACTORY[t]) {
        const old = GL.V7_FACTORY[t], nf = GL.factory(t);
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(old).forEach(p => { if (se[p] === old[p]) se[p] = nf[p]; }); });
      }
      // v6 → v7: attack fizz (high cut / hardness left at the old factory values)
      if (oldVersion < 7 && raw && raw.slots) {
        const nf = GL.factory(t), rules = Object.assign({}, GL.V6_FACTORY.all, GL.V6_FACTORY[t] || {});
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(rules).forEach(p => { if (rules[p].some(v => Math.abs(se[p] - v) < 1e-9)) se[p] = nf[p]; }); });
      }
      // v4 → v5: hollow body values left at the old (too dark) factory setting
      if (oldVersion < 5 && raw && raw.slots && GL.V4_FACTORY[t]) {
        const old = GL.V4_FACTORY[t], nf = GL.factory(t);
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(old).forEach(p => { if (Math.abs(se[p] - old[p]) < 1e-9) se[p] = nf[p]; }); });
      }
      // v3 → v4: stereo spread left at the old factory value
      if (oldVersion < 4 && raw && raw.slots) {
        const nf = GL.factory(t);
        C.slots.forEach(k => {
          const se = st.slots[t][k].settings;
          if (Math.abs(se.stringSpread - GL.V3_FACTORY.all.stringSpread) < 1e-9) se.stringSpread = nf.stringSpread;
          if (GL.V3_FACTORY.all.tuningSpread.some(v => Math.abs(se.tuningSpread - v) < 1e-9)) se.tuningSpread = nf.tuningSpread;
        });
      }
      // v2 → v3: nylon attack values left at the old factory setting
      if (oldVersion < 3 && raw && raw.slots && GL.V2_FACTORY[t]) {
        const old = GL.V2_FACTORY[t], nf = GL.factory(t);
        C.slots.forEach(k => { const se = st.slots[t][k].settings; Object.keys(old).forEach(p => { if (Math.abs(se[p] - old[p]) < 1e-9) se[p] = nf[p]; }); });
      }
      if (!C.slots.includes(st.slot[t])) st.slot[t] = 'A';
      st.library[t] = (st.library[t] || []).map(x => ({ name: x.name || 'Untitled', savedAt: x.savedAt || '', settings: GL.sanitize(t, x.settings) }));
      if (st.refs[t]) st.refs[t] = Object.assign({}, st.refs[t], { settings: GL.sanitize(t, st.refs[t].settings) });
      if (!GL.DEMOS.find(d => d.id === st.demo[t])) st.demo[t] = GL.DEMO_ORDER[t][0];
    });
    if (!GL.TYPES[st.type]) st.type = 'nylon';
    return st;
  }
  function loadState() { try { const raw = localStorage.getItem(C.storageKey); return raw ? normalize(JSON.parse(raw)) : fresh(); } catch (e) { return fresh(); } }
  let state = loadState();
  let saveTm = null, lastSaved = null;
  function save() {
    clearTimeout(saveTm);
    saveTm = setTimeout(() => {
      try { localStorage.setItem(C.storageKey, JSON.stringify(state)); lastSaved = new Date(); } catch (e) { toast('⚠ Could not save locally: ' + e.message); }
      renderStatus();
    }, 350);
  }
  const T = () => GL.TYPES[state.type];
  const cur = () => state.slots[state.type][state.slot[state.type]];
  const S = () => cur().settings;

  /* ============================================================= UNDO == */
  const undoStack = [];
  function pushUndo(label) {
    undoStack.push({ type: state.type, slot: state.slot[state.type], settings: copy(S()), label });
    if (undoStack.length > 80) undoStack.shift();
  }
  function undo() {
    const u = undoStack.pop(); if (!u) return toast('Nothing to undo');
    state.slots[u.type][u.slot].settings = u.settings;
    if (u.type !== state.type) state.type = u.type;
    state.slot[u.type] = u.slot;
    renderAll(); pushSettings(); save(); toast('↶ Undo: ' + (u.label || 'change'));
  }

  /* ============================================================ AUDIO == */
  let ctx = null, eng = null, starting = null;
  async function ensureAudio() {
    if (eng) { if (ctx.state !== 'running') await ctx.resume(); return true; }
    if (starting) return starting;
    starting = (async () => {
      try {
        try { ctx = new AudioContext({ sampleRate: C.sampleRate, latencyHint: 'interactive' }); } catch (e) { ctx = new AudioContext({ latencyHint: 'interactive' }); }
        eng = await GL.Engine.create(ctx, { params: GL.workletParams(state.type, S()) });
        eng.apply(state.type, S(), { immediate: true });
        if (ctx.state !== 'running') await ctx.resume();
        startAnalyser(); renderStatus();
        GL.onEngineMessage = m => toast(m, 6000);
        ensureLibrary();
        return true;
      } catch (e) {
        console.error(e); toast('⚠ Audio could not start: ' + e.message, 6000); eng = null; return false;
      } finally { starting = null; }
    })();
    return starting;
  }
  let pushPending = false;
  function pushSettings() {
    if (!eng || pushPending) return;
    pushPending = true;
    requestAnimationFrame(() => { pushPending = false; eng.apply(state.type, S()); ensureLibrary(); });
  }

  /* ===================================================== RECORDINGS == */
  const libCache = {};                 // id → decoded library (kept: the last two)
  const libOrder = [];
  let libLoading = null, libWanted = null, libStatus = '';
  const SERVED = GL.assetsAvailable();        // http(s), or the script packs from disk (GL.loadAsset)
  /** id of the library the current guitar / variant wants (null = physical model) */
  function wantedLibId() {
    const s = S();
    if (s.engine === 'Physical model') return null;
    if (s.sampleLib === 'My library (folder)') return 'user:' + state.type;
    if (s.sampleLib === 'Built-in (alternative)' && T().libAlt) return T().libAlt;
    return T().lib || null;
  }
  function libName(id) {
    if (!id) return '';
    if (id.startsWith('user:')) return 'my library (' + GL.TYPES[id.slice(5)].short + ')';
    return id;
  }
  async function ensureLibrary() {
    if (!eng) return;
    const id = wantedLibId();
    libWanted = id;
    // a different guitar's library must not keep playing while this one loads
    if (eng.sampler.lib && eng.sampler.lib !== libCache[id]) { eng.sampler.setLibrary(null); eng.apply(state.type, S()); }
    if (!id) { renderSourceInfo(); return; }
    if (libCache[id]) { if (eng.sampler.lib !== libCache[id]) { eng.sampler.setLibrary(libCache[id]); eng.apply(state.type, S()); } libStatus = ''; renderSourceInfo(); return; }
    if (libLoading === id) return;
    if (!id.startsWith('user:') && !GL.assetsAvailable()) { libStatus = 'file'; renderSourceInfo(); return; }
    libLoading = id; libStatus = 'loading 0%'; renderSourceInfo();
    try {
      let lib;
      const prog = f => { libStatus = 'loading ' + Math.round(f * 100) + '%'; renderSourceInfo(); };
      if (id.startsWith('user:')) {
        const files = await IDB.get('lib:' + id);
        if (!files) { libStatus = 'nouser'; libLoading = null; renderSourceInfo(); return; }
        lib = await GL.libraryFromFiles(files.map(fileLike), prog);
      } else lib = await GL.loadBundledLibrary(id, prog);
      libCache[id] = lib; libOrder.push(id);
      while (libOrder.length > 2) { const old = libOrder.shift(); if (old !== id) delete libCache[old]; }
      libStatus = '';
      if (libWanted === id) { eng.sampler.setLibrary(lib); eng.apply(state.type, S()); }
    } catch (e) {
      console.error(e); libStatus = 'error: ' + e.message;
    } finally { libLoading = null; renderSourceInfo(); }
  }
  /** IndexedDB stores {path, blob}: rebuild File-like objects for GL.libraryFromFiles */
  const fileLike = x => ({ name: x.path.split('/').pop(), webkitRelativePath: x.path, arrayBuffer: () => x.blob.arrayBuffer(), text: () => x.blob.text() });
  function loadUserLibrary() {
    const inp = el('input', { type: 'file' }); inp.setAttribute('webkitdirectory', ''); inp.multiple = true;
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => /\.(sfz|wav|flac|ogg|mp3)$/i.test(f.name));
      if (!files.length) return toast('⚠ No .sfz / audio files in that folder');
      const id = 'user:' + state.type;
      toast('Reading ' + files.length + ' files…', 6000);
      try {
        await IDB.set('lib:' + id, files.map(f => ({ path: f.webkitRelativePath || f.name, blob: f })));
        delete libCache[id];
        pushUndo('library'); S().sampleLib = 'My library (folder)'; if (S().engine === 'Physical model') S().engine = 'Real samples';
        save(); renderSettings(); pushSettings();
      } catch (e) { toast('⚠ Could not store the library: ' + e.message, 6000); }
    };
    inp.click();
  }
  function renderSourceInfo() {
    const box = document.getElementById('sourceInfo'); if (!box) return;
    const id = wantedLibId(), lib = id && libCache[id];
    box.innerHTML = '';
    let msg;
    if (!id) msg = el('span', {}, 'Physical model (synthesized strings).');
    else if (libStatus === 'file' && !id.startsWith('user:')) msg = el('span', { class: 'warn' }, '⚠ The recording packs (packs/ folder) are missing, so a page opened from disk cannot load the real recordings and amps. Run build_packs.py, or open the lab with "Open Guitar Lab.cmd" (local server). Playing the physical model meanwhile.');
    else if (libStatus === 'nouser') msg = el('span', { class: 'warn' }, 'No library loaded for this guitar yet — press "📂 Load library…" and choose a folder with an .sfz file (e.g. FreePats Spanish Classical Guitar).');
    else if (libStatus.startsWith('loading')) msg = el('span', {}, '⏳ ' + libStatus + ' — ' + libName(id));
    else if (libStatus.startsWith('error')) msg = el('span', { class: 'warn' }, '⚠ ' + libStatus);
    else if (lib) msg = el('span', {}, ['✅ ', el('b', {}, lib.meta.name), el('br'), el('small', {}, (lib.meta.credit ? lib.meta.credit + ' · ' : '') + lib.meta.license + ' · ' + lib.meta.regions.filter(r => r.trig === 'attack').length + ' recorded notes')]);
    else if (!eng) msg = el('span', {}, 'Press ▶ Start audio to load the recordings.');
    else msg = el('span', {}, '…');
    box.append(msg, el('div', { class: 'row' }, [
      el('button', { class: 'btn small', title: 'Choose a folder with an SFZ sample library (or WAV files named by note)', onclick: loadUserLibrary }, '📂 Load library…'),
      GL.fromDisk() ? el('small', { class: 'muted' }, GL.PACKS ? 'opened from disk (packs)' : 'file:// mode') : null
    ]));
  }

  /* ======================================================== SEQUENCER == */
  function mkRand(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const gauss = r => (r() + r() + r() - 1.5) / 1.5;
  const currentDemo = () => GL.DEMOS.find(d => d.id === state.demo[state.type]) || GL.DEMOS[0];
  const demoBpm = d => state.bpm[d.id] || d.bpm;
  let noteIds = 1;

  /**
   * Musical demo → worklet events (seconds from 0) with the human feel.
   * returns { events, marks (fretboard highlights), length (s) }
   */
  function buildEvents(demo, s, bpm, seed) {
    const r = mkRand(seed), spb = 60 / bpm, open = C.tunings[s.tuning] || C.tunings.Standard;
    const ev = [], marks = [], lastFret = [null, null, null, null, null, null];
    let maxEnd = 0, lastChord = null;
    const ht = () => gauss(r) * s.humanTime / 1000;
    const hv = v => clamp(v * (1 + (r() * 2 - 1) * s.humanVel * 0.25), 0.05, 1);
    const squeak = (t, strong) => {
      if (s.squeak <= 0 || r() > s.squeakProb) return;
      const up = r() < 0.5;
      ev.push({ type: 'squeak', t: Math.max(0, t), f0: up ? 900 + r() * 500 : 2600 + r() * 900, f1: up ? 2000 + r() * 1400 : 1000 + r() * 400, amp: (strong ? 0.7 : 0.45) + 0.3 * r(), dur: 0.08 + 0.14 * r() });
    };
    const note = (t, st, fret, dur, vel, o) => {
      o = o || {};
      const id = noteIds++;
      const midi = open[st] + (o.harm || fret);
      ev.push({ type: 'on', t, s: st, midi, vel, id, pm: !!o.pm, dead: !!o.dead, vib: !!o.vib, legato: !!o.legato, glide: o.glide || 0, harm: !!o.harm });
      ev.push({ type: 'off', t: t + dur, s: st, id });
      marks.push({ t, s: st, f: o.harm || fret, d: Math.min(dur, 0.6) });
      maxEnd = Math.max(maxEnd, t + dur);
      return id;
    };
    demo.build().slice().sort((a, b) => a.b - b.b).forEach(it => {
      const t0 = it.b * spb;
      if (it.k === 'n') {
        const t = Math.max(0, t0 + ht() * (it.legato ? 0.3 : 1)), dur = it.d * spb, v = hv(it.v);
        // position shifts on wound strings squeak
        if (lastFret[it.s] !== null && Math.abs(lastFret[it.s] - it.f) >= 3 && it.s <= 3 && !it.legato) squeak(t - 0.06, false);
        lastFret[it.s] = it.f;
        if (it.slideFrom !== undefined) {
          const pre = Math.min(0.12, spb * 0.3);
          note(Math.max(0, t - pre), it.s, it.slideFrom, pre + 0.01, v);
          note(t, it.s, it.f, dur, v, { legato: true, glide: pre * 0.8, vib: it.vib });
        } else {
          note(t, it.s, it.f, dur, v, { pm: it.pm, vib: it.vib, legato: it.legato, glide: it.glide, harm: it.harm, dead: it.dead });
        }
        if (it.bend) {
          ev.push({ type: 'bend', t: t + it.bend.at * spb, s: it.s, semis: it.bend.semis, glide: it.bend.dur * spb });
          if (it.bend.back) ev.push({ type: 'bend', t: t + it.bend.back * spb, s: it.s, semis: 0, glide: 0.12 });
        }
      } else if (it.k === 'strum') {
        const fr = GL.CHORDS[it.chord]; if (!fr) return;
        let strs = [0, 1, 2, 3, 4, 5].filter(i => fr[i] >= 0);
        if (it.strings) strs = strs.filter(i => i >= it.strings[0] && i <= it.strings[1]);
        if (it.dir === 'U') strs.reverse();
        const sp = s.strumSpeed / 1000 * (it.speed || 1);
        const base = Math.max(0, t0 + ht());
        if (lastChord && lastChord !== it.chord) squeak(base - 0.07, true);
        lastChord = it.chord;
        strs.forEach((st, i) => {
          const t = base + i * sp * (0.85 + 0.3 * r());
          const v = hv(it.v * (1 - i * 0.035) * (it.dir === 'U' ? 0.92 : 1));
          note(t, st, fr[st], it.d * spb, v, { pm: it.pm, dead: it.dead });
          lastFret[st] = fr[st];
        });
      }
    });
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, marks, length: maxEnd + 2 };
  }

  let playing = false, playToken = 0, loopTimer = null, iter = 0, marksAbs = [];
  async function play() {
    if (!(await ensureAudio())) return;
    stop(true);
    playing = true; iter = 0; playToken++;
    scheduleIteration(ctx.currentTime + 0.12, playToken);
    renderTransport();
  }
  function scheduleIteration(t0, token) {
    if (token !== playToken || !eng) return;
    if (state.compare !== 'off') {
      const order = state.compare === 'ab' ? ['A', 'B'] : C.slots;
      selectSlot(order[iter % order.length], true);
    }
    const demo = currentDemo(), bpm = demoBpm(demo);
    const res = buildEvents(demo, S(), bpm, ((Date.now() / 1000) | 0) + iter * 977);
    eng.send(res.events.map(e => Object.assign({}, e, { t: e.t + t0 })));
    marksAbs = marksAbs.filter(m => m.t + m.d > ctx.currentTime).concat(res.marks.map(m => Object.assign({}, m, { t: m.t + t0 })));
    const next = t0 + res.length;
    iter++;
    clearTimeout(loopTimer);
    if (state.loop) loopTimer = setTimeout(() => scheduleIteration(next, token), Math.max(50, (next - ctx.currentTime - 0.3) * 1000));
    else loopTimer = setTimeout(() => { if (token === playToken) { playing = false; renderTransport(); } }, Math.max(50, (next - ctx.currentTime) * 1000));
  }
  function stop(silentUI) {
    playToken++; clearTimeout(loopTimer); playing = false; marksAbs = [];
    if (eng) eng.stop();
    if (!silentUI) renderTransport();
  }
  /** Play events right now (fretboard / chord pad) */
  function playNow(events) {
    if (!eng) return;
    const t0 = ctx.currentTime + 0.01;
    eng.send(events.map(e => Object.assign({}, e, { t: e.t + t0 })));
  }
  function strumNow(chord, dir) {
    ensureAudio().then(ok => {
      if (!ok) return;
      const v = +$('#padVel').value;
      const res = buildEvents({ build: () => [{ k: 'strum', b: 0, chord, dir, d: 16, v }] }, S(), 60, Date.now() & 0xffff);
      playNow(res.events);
      marksAbs = marksAbs.concat(res.marks.map(m => Object.assign({}, m, { t: m.t + ctx.currentTime })));
      $('#nowPlaying').textContent = chord + (dir === 'U' ? ' ↑' : ' ↓');
    });
  }

  /* ================================================================ UI == */
  function renderAll() {
    document.body.style.zoom = state.ui.scale;
    $('#uiScale').value = state.ui.scale; $('#uiScaleVal').textContent = Math.round(state.ui.scale * 100) + '%';
    renderTransport(); renderGuitars(); renderSlots(); renderRef(); renderLib(); renderSettings(); renderFretboard(); renderStatus();
  }

  function renderTransport() {
    const box = $('#transport'); box.innerHTML = '';
    const order = GL.DEMO_ORDER[state.type];
    const demos = order.map(id => GL.DEMOS.find(d => d.id === id)).filter(Boolean);
    const d = currentDemo();
    box.append(
      el('button', { class: 'btn primary', title: 'Space', onclick: () => (playing ? stop() : play()) }, playing ? '■ Stop' : '▶ Play demo'),
      el('select', { title: 'Demo phrase (the first ones suit this guitar best)', onchange: e => { state.demo[state.type] = e.target.value; save(); renderTransport(); if (playing) play(); } },
        demos.map((x, i) => el('option', { value: x.id, selected: x.id === d.id }, (i < 3 ? '★ ' : '') + x.name))),
      el('label', { class: 'muted' }, ['BPM ', el('input', { type: 'number', min: 40, max: 220, value: demoBpm(d), style: { width: '62px' }, onchange: e => { state.bpm[d.id] = clamp(+e.target.value || d.bpm, 40, 220); save(); } })]),
      el('button', { class: 'btn' + (state.loop ? ' on' : ''), title: 'Repeat the demo', onclick: () => { state.loop = !state.loop; save(); renderTransport(); } }, '🔁 Loop'),
      el('select', { title: 'Automatic comparison: switches variant on every loop', onchange: e => { state.compare = e.target.value; if (state.compare !== 'off') state.loop = true; save(); renderTransport(); } },
        [['off', 'Compare: off'], ['ab', 'Compare: A ↔ B'], ['abcd', 'Compare: A → B → C → D']].map(([v, l]) => el('option', { value: v, selected: state.compare === v }, l))),
      el('span', { class: 'ab-label', id: 'abLabel' }, state.compare !== 'off' && playing ? 'Now: ' + state.slot[state.type] : ''),
      el('button', { class: 'btn', title: 'Render the current demo with the current settings to a WAV file', onclick: exportWav }, '💾 WAV')
    );
  }

  function renderGuitars() {
    const box = $('#guitarList'); box.innerHTML = '';
    GL.TYPE_IDS.forEach(id => {
      const t = GL.TYPES[id];
      box.appendChild(el('div', { class: 'guitar' + (id === state.type ? ' active' : ''), title: t.desc, onclick: () => selectType(id) }, [
        el('span', { class: 'ico' }, t.icon), el('div', {}, [el('b', {}, t.name), el('small', {}, t.cat === 'acoustic' ? 'Acoustic · body + mic' : t.hollow ? 'Electric · hollow body' : 'Electric · solid body')]),
        state.refs[id] ? el('span', { class: 'star', title: 'Reference saved' }, '★') : null
      ]));
    });
  }
  function selectType(id) {
    if (id === state.type) return;
    state.type = id; save(); renderAll(); pushSettings();
    if (playing) play();
  }
  function selectSlot(k, fromCompare) {
    state.slot[state.type] = k;
    if (!fromCompare) save();
    renderSlots(); renderSettings(); pushSettings();
    const ab = $('#abLabel'); if (ab && fromCompare) ab.textContent = 'Now: ' + k;
  }

  function renderSlots() {
    const box = $('#slotBox'); box.innerHTML = '';
    const ref = state.refs[state.type];
    box.appendChild(el('div', { class: 'slots' }, C.slots.map((k, i) => el('button', {
      class: 'btn' + (k === state.slot[state.type] ? ' on' : ''), title: 'Variant ' + k + ' (key ' + (i + 1) + ')', onclick: () => selectSlot(k)
    }, [k, ref && ref.slot === k ? el('i', {}, '★') : null]))));
    const c = cur();
    box.appendChild(el('div', { class: 'stars', title: 'Your rating of this variant' }, [1, 2, 3, 4, 5].map(n => el('span', { class: n <= c.rating ? 'on' : '', onclick: () => { c.rating = c.rating === n ? 0 : n; save(); renderSlots(); } }, '★'))));
    box.appendChild(el('textarea', { placeholder: 'Notes for variant ' + state.slot[state.type] + ' (what sounds real, what does not)…', oninput: e => { c.notes = e.target.value; save(); } }, c.notes));
    const copyTo = el('select', { onchange: e => {
      const to = e.target.value; if (!to) return;
      state.slots[state.type][to].settings = copy(S()); save(); toast('Variant ' + state.slot[state.type] + ' copied to ' + to); e.target.value = '';
    } }, [el('option', { value: '' }, 'Copy to…')].concat(C.slots.filter(k => k !== state.slot[state.type]).map(k => el('option', { value: k }, 'Variant ' + k))));
    box.appendChild(el('div', { class: 'row' }, [
      copyTo,
      el('button', { class: 'btn small', title: 'Random small changes around this variant (Ctrl+Z to undo)', onclick: variation }, '🎲 Variation'),
      el('select', { title: 'How big the variation is', onchange: e => { state.ui.explore = +e.target.value; save(); } },
        [[0.05, '±5%'], [0.12, '±12%'], [0.25, '±25%']].map(([v, l]) => el('option', { value: v, selected: state.ui.explore === v }, l))),
      el('button', { class: 'btn small', title: 'Back to the factory settings of this guitar', onclick: () => { if (!confirm('Reset variant ' + state.slot[state.type] + ' to the factory settings?')) return; pushUndo('reset'); cur().settings = GL.factory(state.type); save(); renderSettings(); pushSettings(); } }, '↺ Factory'),
      el('button', { class: 'btn small', title: 'Ctrl+Z', onclick: undo }, '↶ Undo')
    ]));
  }
  function variation() {
    pushUndo('variation');
    const s = S(), amt = state.ui.explore || 0.12, r = mkRand(Date.now() & 0xffffff);
    const skip = ['a4', 'inharmStages', 'trebleBleed', 'output', 'strumSpeed', 'humanTime', 'humanVel', 'palmMute', 'releaseTime', 'squeakProb', 'vibDepth', 'vibRate', 'vibDelay',
      'reverbMix', 'reverbSize', 'predelay', 'width', 'transient', 'attackSoft', 'chorusMix', 'chorusRate', 'chorusDepth', 'delayMix', 'delayTime', 'delayFeedback', 'volumeKnob', 'master', 'lowCut', 'highCut'];
    GL.PARAMS.forEach(p => {
      if (p.options || skip.includes(p.id) || !GL.paramFor(p, state.type)) return;
      const v = s[p.id] + (r() * 2 - 1) * amt * (p.max - p.min) * 0.5;
      s[p.id] = roundStep(p, clamp(v, p.min, p.max));
    });
    save(); renderSettings(); pushSettings(); toast('🎲 New variation in ' + state.slot[state.type] + ' (Ctrl+Z to undo)');
  }
  const roundStep = (p, v) => { const st = p.step || 0.01; return +(Math.round(v / st) * st).toFixed(6); };

  function renderRef() {
    const box = $('#refBox'); box.innerHTML = '';
    const ref = state.refs[state.type];
    box.appendChild(el('div', { class: 'ref-info' + (ref ? ' has' : '') }, ref
      ? [el('b', {}, '★ Saved from variant ' + ref.slot), el('br'), el('small', {}, new Date(ref.savedAt).toLocaleString() + (ref.rating ? ' · ' + '★'.repeat(ref.rating) : '')), ref.notes ? el('div', { class: 'muted' }, '“' + ref.notes + '”') : null]
      : [el('small', {}, 'No reference yet for ' + T().short + '. When a variant sounds real, press the button below.')]));
    box.appendChild(el('div', { class: 'row' }, [
      el('button', { class: 'btn gold', onclick: saveReference }, '⭐ Save variant ' + state.slot[state.type] + ' as reference'),
      ref ? el('button', { class: 'btn small', title: 'Load the reference into the current variant', onclick: () => { pushUndo('load reference'); cur().settings = copy(ref.settings); save(); renderSettings(); pushSettings(); toast('Reference loaded into variant ' + state.slot[state.type]); } }, '⇩ Load') : null
    ]));
  }
  function saveReference() {
    const c = cur();
    state.refs[state.type] = { slot: state.slot[state.type], savedAt: new Date().toISOString(), rating: c.rating, notes: c.notes, settings: copy(c.settings) };
    save(); renderRef(); renderGuitars(); renderSlots();
    toast('⭐ ' + T().name + ': reference saved (variant ' + state.slot[state.type] + ')');
    saveToFolder(true);
  }

  function renderLib() {
    const box = $('#libBox'); box.innerHTML = '';
    const name = el('input', { type: 'text', placeholder: 'Name (e.g. "nails near bridge")', style: { flex: 1, minWidth: 0 } });
    const doSave = () => {
      const n = name.value.trim() || (T().short + ' ' + state.slot[state.type] + ' ' + new Date().toLocaleTimeString());
      state.library[state.type].unshift({ name: n, savedAt: new Date().toISOString(), settings: copy(S()) }); save(); renderLib();
    };
    box.appendChild(el('div', { class: 'row' }, [name, el('button', { class: 'btn small', onclick: doSave }, 'Save')]));
    const list = el('div', { class: 'lib-list' });
    state.library[state.type].forEach((x, i) => list.appendChild(el('div', { class: 'lib-item', title: new Date(x.savedAt).toLocaleString() }, [
      el('span', {}, x.name),
      el('button', { class: 'btn small', title: 'Load into the current variant', onclick: () => { pushUndo('load ' + x.name); cur().settings = copy(x.settings); save(); renderSettings(); pushSettings(); toast('Loaded "' + x.name + '" into ' + state.slot[state.type]); } }, '⇩'),
      el('button', { class: 'btn small', title: 'Delete', onclick: () => { if (!confirm('Delete "' + x.name + '"?')) return; state.library[state.type].splice(i, 1); save(); renderLib(); } }, '✕')
    ])));
    if (!state.library[state.type].length) list.appendChild(el('small', {}, 'Save the settings you want to keep while experimenting.'));
    box.appendChild(list);
  }

  /* ---------------------------------------------------------- settings */
  function fmt(p, v) {
    if (p.options) return v;
    const st = p.step || 0.01, dec = st >= 1 ? 0 : st >= 0.1 ? 1 : st >= 0.01 ? 2 : st >= 0.001 ? 3 : 4;
    if (p.id === 'trebleBleed') return v >= 0.5 ? 'On' : 'Off';
    return (+v).toFixed(dec) + (p.unit ? ' ' + p.unit : '');
  }
  let undoArmed = false;
  function renderSettings() {
    const box = $('#settings'); box.innerHTML = '';
    $('#setTitle').textContent = T().icon + ' ' + T().short + ' · variant ' + state.slot[state.type];
    const f = GL.factory(state.type), s = S(), q = ($('#setSearch').value || '').toLowerCase();
    GL.SECTIONS.forEach(([sid, title]) => {
      const ps = GL.PARAMS.filter(p => p.sec === sid && GL.paramFor(p, state.type) && (!q || p.label.toLowerCase().includes(q) || (p.tip || '').toLowerCase().includes(q)));
      if (!ps.length) return;
      const changed = ps.filter(p => s[p.id] !== f[p.id]).length;
      const det = el('details', { class: 'sec', open: q || state.ui.open[sid] ? true : null, ontoggle: e => { if (!q) { state.ui.open[sid] = e.target.open; save(); } } },
        [el('summary', {}, [title, el('small', {}, ps.length + ' settings' + (changed ? ' · ' + changed + ' changed' : ''))])]);
      if (sid === 'source') det.appendChild(el('div', { id: 'sourceInfo', class: 'source-info' }));
      ps.forEach(p => det.appendChild(paramRow(p, s, f)));
      box.appendChild(det);
      if (sid === 'source') setTimeout(renderSourceInfo, 0);
    });
  }
  function paramRow(p, s, f) {
    const row = el('div', { class: 'prm' + (s[p.id] !== f[p.id] ? ' changed' : '') });
    const lab = el('label', { title: p.label + (p.tip ? '\n' + p.tip : '') + '\nFactory: ' + fmt(p, f[p.id]) }, p.label);
    const val = el('span', { class: 'val' }, fmt(p, s[p.id]));
    const commit = v => {
      if (!undoArmed) { pushUndo(p.label); undoArmed = true; }
      s[p.id] = v; val.textContent = fmt(p, v);
      row.classList.toggle('changed', v !== f[p.id]);
      if (p.id === 'pickupType') {                       // load the typical electrics of that pickup
        const PT = GL.PICKUP_TYPES[v]; s.pickupRes = PT.res; s.pickupQ = PT.q; s.pickupOut = PT.out; renderSettings();
      }
      pushSettings(); save();
    };
    let ctrl;
    if (p.options) {
      let opts = p.options;
      if (p.id === 'pickupSel' && T().pickups) opts = T().pickups;
      const curV = p.id === 'pickupSel' ? GL.pickupSel(state.type, s[p.id]) : s[p.id];
      ctrl = el('select', { onchange: e => { undoArmed = false; commit(e.target.value); undoArmed = false; } }, opts.map(o => el('option', { value: o, selected: o === curV }, o)));
      row.append(lab, ctrl);
    } else {
      ctrl = el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: s[p.id],
        oninput: e => commit(roundStep(p, +e.target.value)), onchange: () => { undoArmed = false; },
        ondblclick: () => { undoArmed = false; commit(f[p.id]); ctrl.value = f[p.id]; undoArmed = false; } });
      row.append(lab, ctrl, val);
    }
    row.appendChild(el('button', { class: 'rst', title: 'Factory value: ' + fmt(p, f[p.id]), onclick: () => {
      undoArmed = false; commit(f[p.id]); undoArmed = false; if (ctrl.tagName === 'INPUT') ctrl.value = f[p.id]; else ctrl.value = f[p.id];
    } }, '↺'));
    return row;
  }

  /* --------------------------------------------------------- fretboard */
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  let fbCells = {}, held = {};
  function renderFretboard() {
    const box = $('#fretboard'); box.innerHTML = ''; fbCells = {};
    const open = C.tunings[S().tuning] || C.tunings.Standard, FRETS = 15;
    for (let s = 5; s >= 0; s--) {
      const row = el('div', { class: 'fb-row', style: { '--sw': (1 + (5 - s) * 0.45).toFixed(1) + 'px' } });
      for (let f = 0; f <= FRETS; f++) {
        const midi = open[s] + f, name = NOTE[midi % 12] + (Math.floor(midi / 12) - 1);
        const cell = el('div', { class: 'fb-cell' + (f === 0 ? ' nut' : ''), title: name + ' — string ' + (6 - s) + ', fret ' + f }, el('span', {}, name));
        cell.addEventListener('pointerdown', e => { e.preventDefault(); fretDown(s, f, midi, name); });
        row.appendChild(cell); fbCells[s + ':' + f] = cell;
      }
      box.appendChild(row);
    }
    const marks = el('div', { class: 'fb-row', style: { height: '12px' } });
    for (let f = 0; f <= FRETS; f++) marks.appendChild(el('div', { class: 'fb-cell' + (f === 0 ? ' nut' : ''), style: { borderRight: 'none', cursor: 'default' } }, [3, 5, 7, 9, 12, 15].includes(f) ? el('small', { style: { color: '#c7b28e' } }, f === 12 ? '••' : '•') : null));
    box.appendChild(marks);
  }
  function fretDown(s, f, midi, name) {
    ensureAudio().then(ok => {
      if (!ok) return;
      const id = noteIds++;
      held[s] = id;
      playNow([{ type: 'on', t: 0, s, midi, vel: +$('#padVel').value, id }]);
      marksAbs.push({ t: ctx.currentTime, s, f, d: 0.5 });
      $('#nowPlaying').textContent = name;
    });
  }
  window.addEventListener('pointerup', () => {
    if (!eng) return;
    const evs = Object.keys(held).map(s => ({ type: 'off', t: 0.02, s: +s, id: held[s] }));
    held = {}; playNow(evs);
  });

  /* -------------------------------------------------------- chord pad */
  function renderPad() {
    const box = $('#chordPad'); box.innerHTML = '';
    GL.CHORD_PAD.forEach(ch => box.appendChild(el('button', { class: 'btn', onclick: () => strumNow(ch, 'D'), oncontextmenu: e => { e.preventDefault(); strumNow(ch, 'U'); } }, ch)));
  }

  /* ========================================================= ANALYSER == */
  let heldCurve = null, lastSpec = null, anStarted = false;
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return [w, h];
  }
  function startAnalyser() {
    if (anStarted) return; anStarted = true;
    const an = eng.n.analyser, fb = new Float32Array(an.frequencyBinCount), tb = new Float32Array(an.fftSize);
    const spec = $('#spectrum'), scope = $('#scope');
    const F0 = 30, F1 = 18000, DBMIN = -110, DBMAX = -10;
    const prevHit = new Set();
    function xOf(f, w) { return Math.log(f / F0) / Math.log(F1 / F0) * w; }
    function curve(g, data, w, h, color, dash) {
      const sr = ctx.sampleRate, bins = data.length;
      g.beginPath(); g.strokeStyle = color; g.lineWidth = 1.5 * (window.devicePixelRatio || 1); g.setLineDash(dash ? [6, 5] : []);
      let started = false;
      for (let i = 1; i < bins; i++) {
        const f = i * sr / an.fftSize; if (f < F0 || f > F1) continue;
        const x = xOf(f, w), y = h - (clamp(data[i], DBMIN, DBMAX) - DBMIN) / (DBMAX - DBMIN) * h;
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke(); g.setLineDash([]);
    }
    function frame() {
      an.getFloatFrequencyData(fb); an.getFloatTimeDomainData(tb); lastSpec = fb;
      // spectrum
      const [w, h] = fitCanvas(spec), g = spec.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.font = (10 * (window.devicePixelRatio || 1)) + 'px Consolas'; g.fillStyle = 'rgba(160,150,220,0.55)'; g.strokeStyle = 'rgba(160,140,255,0.12)'; g.lineWidth = 1;
      [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => { const x = xOf(f, w); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 3, h - 4); });
      for (let d = -100; d <= -20; d += 20) { const y = h - (d - DBMIN) / (DBMAX - DBMIN) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillText(d + ' dB', 4, y - 2); }
      if (heldCurve) curve(g, heldCurve, w, h, 'rgba(255,207,74,0.85)', true);
      const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, '#b56cff'); grad.addColorStop(1, '#33e1ff');
      curve(g, fb, w, h, grad, false);
      // scope
      const [sw, sh] = fitCanvas(scope), sg = scope.getContext('2d');
      sg.clearRect(0, 0, sw, sh); sg.strokeStyle = '#33e1ff'; sg.lineWidth = 1.2; sg.beginPath();
      let peak = 0;
      for (let i = 0; i < tb.length; i++) peak = Math.max(peak, Math.abs(tb[i]));
      const n = Math.min(tb.length, 2048);
      for (let i = 0; i < n; i++) { const x = i / n * sw, y = sh / 2 - tb[i] * sh * 0.45; i ? sg.lineTo(x, y) : sg.moveTo(x, y); }
      sg.stroke();
      $('#meterBar').style.width = clamp(100 + 20 * Math.log10(peak + 1e-9) * 2.2, 0, 100) + '%';
      $('#anInfo').textContent = 'peak ' + (20 * Math.log10(peak + 1e-9)).toFixed(1) + ' dBFS';
      // fretboard highlights
      const now = ctx.currentTime, hit = new Set();
      marksAbs = marksAbs.filter(m => m.t + m.d + 0.1 > now);
      marksAbs.forEach(m => { if (now >= m.t && now <= m.t + m.d) hit.add(m.s + ':' + m.f); });
      prevHit.forEach(k => { if (!hit.has(k) && fbCells[k]) fbCells[k].classList.remove('hit'); });
      hit.forEach(k => { if (fbCells[k]) fbCells[k].classList.add('hit'); });
      prevHit.clear(); hit.forEach(k => prevHit.add(k));
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ================================================ REAL RECORDING == */
  let refBuf = null, refSrc = null;
  function setupReference() {
    $('#btnRefLoad').onclick = () => $('#refFile').click();
    $('#refFile').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      if (!(await ensureAudio())) return;
      try {
        refBuf = await ctx.decodeAudioData(await file.arrayBuffer());
        $('#refName').textContent = file.name + ' · ' + refBuf.duration.toFixed(1) + ' s';
        $('#btnRefPlay').disabled = false;
      } catch (err) { toast('⚠ Could not decode that audio file'); }
    };
    $('#btnRefPlay').onclick = () => {
      if (refSrc) { refSrc.stop(); return; }
      stop();
      refSrc = ctx.createBufferSource(); refSrc.buffer = refBuf; refSrc.connect(eng.n.ref);
      refSrc.onended = () => { refSrc = null; $('#btnRefPlay').textContent = '▶ Play recording'; };
      refSrc.start(); $('#btnRefPlay').textContent = '■ Stop recording';
    };
    $('#btnHold').onclick = () => { if (lastSpec) { heldCurve = new Float32Array(lastSpec); toast('📌 Curve held — now play the other sound to compare'); } };
    $('#btnClearHold').onclick = () => { heldCurve = null; };
  }

  /* ======================================================= WAV EXPORT == */
  function encodeWav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    ws(36, 'data'); out.setUint32(40, len * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = clamp(data[c][i], -1, 1); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function exportWav() {
    const demo = currentDemo(), res = buildEvents(demo, S(), demoBpm(demo), 4242);
    toast('Rendering ' + demo.name + '…', 8000);
    try {
      const lib = eng && eng.sampler.ready && S().engine !== 'Physical model' ? eng.sampler.lib : null;
      const buf = await GL.renderOffline(state.type, S(), res.events.map(e => Object.assign({}, e, { t: e.t + 0.05 })), res.length + 0.3, 48000, lib);
      download(encodeWav(buf), 'GuitarLab_' + T().short.replace(/\s+/g, '') + '_' + state.slot[state.type] + '_' + demo.id + '.wav');
      toast('💾 WAV exported');
    } catch (e) { console.error(e); toast('⚠ Export failed: ' + e.message, 5000); }
  }

  /* ================================================ JSON & FOLDER == */
  function refsJSON() {
    const guitars = {};
    GL.TYPE_IDS.forEach(t => { if (state.refs[t]) guitars[t] = Object.assign({ name: GL.TYPES[t].name, category: GL.TYPES[t].cat }, state.refs[t]); });
    return {
      app: 'ScoreDAW Guitar Lab', format: 'scoredaw-guitar-references', version: C.version, engine: 'waveguide-v1', savedAt: new Date().toISOString(),
      guitars,
      params: GL.PARAMS.map(p => ({ id: p.id, section: p.sec, label: p.label, unit: p.unit || '', min: p.min, max: p.max, options: p.options, for: p.for }))
    };
  }
  const IDB = {
    db() { return new Promise((res, rej) => { const r = indexedDB.open('scoredaw-guitarlab', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.db(); return new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
    async set(k, v) { const db = await this.db(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
  };
  let dirHandle = null, folderOk = false, lastFolderSave = null;
  async function connectFolder() {
    if (!window.showDirectoryPicker) { toast('This browser cannot write into folders — use Chrome or Edge, or "Export JSON".', 5000); return false; }
    try {
      dirHandle = await window.showDirectoryPicker({ id: 'guitarlab-refs', mode: 'readwrite' });
      await IDB.set('dir', dirHandle); folderOk = true; renderStatus();
      return true;
    } catch (e) { return false; }
  }
  async function writeFile(name, text) {
    const fh = await dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable(); await w.write(text); await w.close();
  }
  async function saveToFolder(silent) {
    if (!dirHandle) { if (silent) return; if (!(await connectFolder())) return; }
    try {
      let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { if (silent) { folderOk = false; renderStatus(); return; } perm = await dirHandle.requestPermission({ mode: 'readwrite' }); }
      if (perm !== 'granted') { folderOk = false; renderStatus(); return; }
      folderOk = true;
      await writeFile(C.referenceFile, JSON.stringify(refsJSON(), null, 2));
      await writeFile(C.stateFile, JSON.stringify(state, null, 1));
      lastFolderSave = new Date(); renderStatus();
      if (!silent) toast('📁 Saved ' + C.referenceFile + ' and ' + C.stateFile + ' in "' + dirHandle.name + '"');
    } catch (e) { console.error(e); if (!silent) toast('⚠ Could not write to the folder: ' + e.message, 5000); }
  }
  function exportJSON() {
    download(new Blob([JSON.stringify(refsJSON(), null, 2)], { type: 'application/json' }), C.referenceFile);
    download(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), C.stateFile);
  }
  function importJSON() {
    const inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        if (j.format === 'scoredaw-guitar-references') {
          Object.keys(j.guitars || {}).forEach(t => { if (GL.TYPES[t]) { const g = j.guitars[t]; state.refs[t] = { slot: g.slot || 'A', savedAt: g.savedAt || new Date().toISOString(), rating: g.rating || 0, notes: g.notes || '', settings: GL.sanitize(t, g.settings) }; } });
          toast('Imported references: ' + Object.keys(j.guitars || {}).join(', '));
        } else if (j.slots) { state = normalize(j); toast('Lab state imported'); }
        else return toast('⚠ Not a Guitar Lab file');
        save(); renderAll(); pushSettings();
      } catch (e) { toast('⚠ Invalid JSON: ' + e.message); }
    };
    inp.click();
  }

  /* =========================================================== STATUS == */
  function renderStatus() {
    const box = $('#status'); if (!box) return;
    const nref = GL.TYPE_IDS.filter(t => state.refs[t]).length;
    box.innerHTML = '';
    box.append(
      el('span', {}, ['Audio: ', el('b', { class: eng ? 'ok' : 'warn' }, eng ? (ctx.sampleRate / 1000) + ' kHz · ' + ctx.state : 'not started')]),
      el('span', {}, ['Mode: ', el('b', { class: SERVED ? 'ok' : 'warn' }, !GL.fromDisk() ? 'served (recordings + real amps)' : SERVED ? 'from disk + packs (recordings + real amps)' : 'file:// without packs (physical model only)')]),
      el('span', {}, ['Saved locally: ', el('b', {}, lastSaved ? lastSaved.toLocaleTimeString() : 'auto')]),
      el('span', {}, ['References: ', el('b', { class: nref === 5 ? 'ok' : '' }, nref + ' / 5'), ' ', el('small', {}, GL.TYPE_IDS.map(t => (state.refs[t] ? '★' : '·') + GL.TYPES[t].short).join('  '))]),
      el('span', {}, ['Folder: ', el('b', { class: folderOk ? 'ok' : 'warn' }, dirHandle ? dirHandle.name + (folderOk ? '' : ' (click Save to re-allow)') : 'not connected'), lastFolderSave ? el('small', {}, ' · ' + lastFolderSave.toLocaleTimeString()) : null]),
      el('span', { class: 'sp' }),
      el('button', { class: 'btn small', title: 'Choose the folder MyDAW\\tools\\guitar-lab\\references', onclick: async () => { if (await connectFolder()) saveToFolder(); } }, '📁 Choose folder'),
      el('button', { class: 'btn small primary', onclick: () => saveToFolder(false) }, '💾 Save to folder'),
      el('button', { class: 'btn small', onclick: exportJSON }, '⇩ Export JSON'),
      el('button', { class: 'btn small', onclick: importJSON }, '⇧ Import JSON')
    );
  }

  /* ============================================================= HELP == */
  function showHelp() {
    const back = el('div', { class: 'overlay', onclick: e => { if (e.target === back) back.remove(); } }, el('div', { class: 'glass dialog help' }, [
      el('h2', {}, '🎸 How to use Guitar Lab'),
      el('ol', {}, [
        'Pick a guitar on the left. Press ▶ Play demo (Space). The demos marked ★ suit that guitar best.',
        'Change settings on the right. Hover a name for an explanation; ↺ (or double-click a slider) returns to the factory value. Changed settings turn yellow.',
        'Use the variants A B C D (keys 1–4) to keep different ideas. "Copy to…" duplicates a variant; 🎲 Variation makes small random changes (Ctrl+Z undoes).',
        'Compare: choose "Compare: A ↔ B" with Loop on — every repetition switches variant, the yellow label tells which one is playing.',
        'Load a real guitar recording (analyser panel) to compare by ear; 📌 Hold curve freezes a spectrum to compare it with the other sound.',
        'When a variant sounds real, press ⭐ Save as reference. Do it for the 5 guitars.',
        'Press 📁 Choose folder once and select MyDAW\\tools\\guitar-lab\\references. From then on the references are written there (guitar-references.json) every time you save one — that is the file ScoreDAW will use.',
        'Everything is also saved automatically in the browser. Export / Import JSON moves your work between computers.',
        'Sound source: "Real samples" plays recordings of real guitars (Strat, humbucker Epiphone, archtop jazz guitar, Martin dreadnought). Electric guitars go through neural captures of REAL amps ("NAM ·") and real cabinet impulse responses ("IR ·"). These need the lab to be opened with "Open Guitar Lab.cmd".',
        'Nylon guitar: download the free CC0 library "Spanish Classical Guitar" from freepats.zenvoid.org (SFZ+FLAC, 4.5 MB), unzip it (7-Zip), then in Sound source press "📂 Load library…" and pick its folder. Any SFZ library works the same way.'
      ].map(t => el('li', {}, t))),
      el('p', { class: 'muted' }, 'Tip: listen with good headphones or monitors; laptop speakers hide the body resonances and the pick noise.'),
      el('button', { class: 'btn primary', onclick: () => back.remove() }, 'OK')
    ]));
    document.body.appendChild(back);
  }

  /* ============================================================= INIT == */
  async function init() {
    renderPad(); setupReference(); renderAll();
    $('#setSearch').addEventListener('input', renderSettings);
    $('#uiScale').addEventListener('input', e => { state.ui.scale = +e.target.value; document.body.style.zoom = state.ui.scale; $('#uiScaleVal').textContent = Math.round(state.ui.scale * 100) + '%'; save(); });
    $('#btnHelp').onclick = showHelp;
    $('#btnMute').onclick = () => { if (eng) eng.stop(); };
    $('#btnStart').onclick = async () => { if (await ensureAudio()) $('#startOverlay').classList.add('hidden'); };
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) && e.target.type !== 'range') return;
      if (e.code === 'Space') { e.preventDefault(); playing ? stop() : play(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if (/^[1-4]$/.test(e.key) && !e.ctrlKey) selectSlot(C.slots[+e.key - 1]);
    });
    try {
      const h = await IDB.get('dir');
      if (h) { dirHandle = h; folderOk = (await h.queryPermission({ mode: 'readwrite' })) === 'granted'; renderStatus(); }
    } catch (e) { /* no stored folder */ }
  }
  // used by the automated tests
  GL.app = { buildEvents, getState: () => state, ensureAudio, play, stop, selectType, selectSlot, refsJSON, engine: () => eng };
  init();
})();
