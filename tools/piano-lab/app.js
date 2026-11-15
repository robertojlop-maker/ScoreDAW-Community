/* =====================================================================
 *  PIANO LAB — app.js : INTERFACE
 *  ---------------------------------------------------------------------
 *  · 4 instruments (grand, electric piano, synth, organ), each with four
 *    variants A–D to compare, a rating and notes
 *  · ⭐ reference per instrument = the sound ScoreDAW will use
 *  · saved experiments, export / import of everything (JSON)
 *  · on-screen keyboard (mouse, computer keys, MIDI keyboard), sustain
 *    and soft pedals, demo phrases, WAV export
 *  · analyser (spectrum, scope, level) + a real recording to compare
 *  The state is saved in the browser (localStorage) on every change.
 * ===================================================================== */
(function () {
  'use strict';
  const PL = window.PL, CFG = PL.CONFIG;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /** tiny DOM helper: el('div', {class:'x', onclick:fn}, [children | text]) */
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids === undefined ? [] : kids).forEach(c => { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  }
  let toastT = null;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
  const PARAM = {}; PL.PARAMS.forEach(p => { PARAM[p.id] = p; });
  const SLOTS = ['A', 'B', 'C', 'D'];

  /* ============================================================ STATE == */
  let state = null;
  function freshState() {
    const st = { version: CFG.version, type: 'grand', slot: {}, slots: {}, refs: {}, library: {}, ui: { scale: 1, demo: {}, open: { source: true } } };
    PL.TYPE_IDS.forEach(t => {
      st.slot[t] = 'A'; st.slots[t] = {}; st.library[t] = [];
      SLOTS.forEach(k => { st.slots[t][k] = { settings: PL.factory(t), rating: 0, notes: '' }; });
    });
    return st;
  }
  function loadState() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(CFG.storageKey) || 'null'); } catch (e) { st = null; }
    const f = freshState();
    if (!st || !st.slots) return f;
    PL.TYPE_IDS.forEach(t => {
      st.slots[t] = st.slots[t] || f.slots[t]; st.slot[t] = st.slot[t] || 'A'; st.library[t] = st.library[t] || [];
      SLOTS.forEach(k => { const sl = st.slots[t][k] = st.slots[t][k] || f.slots[t][k]; sl.settings = PL.sanitize(t, sl.settings); });
      if (st.refs[t]) st.refs[t].settings = PL.sanitize(t, st.refs[t].settings);
    });
    // newer factory sounds: values you never changed follow the new factory value
    for (let v = st.version || 1; v < CFG.version; v++) {
      const old = PL.OLD_FACTORY[v] || {};
      Object.keys(old).forEach(t => {
        const nf = PL.factory(t), list = SLOTS.map(k => st.slots[t][k].settings).concat(st.library[t].map(x => x.settings));
        list.forEach(set => Object.keys(old[t]).forEach(id => { if (set[id] === old[t][id]) set[id] = nf[id]; }));
      });
    }
    st.ui = Object.assign(f.ui, st.ui || {}); st.version = CFG.version;
    if (!PL.TYPES[st.type]) st.type = 'grand';
    return st;
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(CFG.storageKey, JSON.stringify(state));
        const m = $('savedMark'); if (m) { m.textContent = '💾 Saved ' + new Date().toLocaleTimeString() + ' (variant ' + state.slot[state.type] + ' of the ' + PL.TYPES[state.type].name + ')'; m.classList.add('flash'); setTimeout(() => m.classList.remove('flash'), 600); }
      } catch (e) { toast('⚠ Could not save the lab state (browser storage full)'); }
    }, 250);
  }
  const type = () => state.type;
  const slot = () => state.slots[type()][state.slot[type()]];
  const cur = () => slot().settings;
  const fac = id => PL.factory(type())[id];

  /* ============================================================ AUDIO == */
  let ctx = null, eng = null, starting = null;
  const libs = {};                         // id → Promise<library>
  let libId, libStatus = '', libProg = 0, libName = '';
  async function ensureAudio() {
    if (eng) { if (ctx.state === 'suspended') await ctx.resume(); return eng; }
    if (!starting) starting = (async () => {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      eng = await PL.Engine.create(ctx, { params: PL.workletParams(type(), cur()) });
      eng.apply(type(), cur(), { immediate: true });
      ensureLibrary();
      $('startOverlay').classList.add('hidden');
      renderStatus(); requestAnimationFrame(draw);
      return eng;
    })();
    return starting;
  }
  // "My library" folders are kept in IndexedDB so they survive a reload
  const IDB = {
    db() { return new Promise((res, rej) => { const r = indexedDB.open('scoredaw-pianolab', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.db(); return new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
    async set(k, v) { const db = await this.db(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
  };
  const fileLike = x => ({ name: x.path.split('/').pop(), webkitRelativePath: x.path, arrayBuffer: () => x.blob.arrayBuffer(), text: () => x.blob.text() });
  function loadLib(id) {
    if (libs[id]) return libs[id];
    const prog = f => { if (libId === id) { libProg = f; renderSourceInfo(); } };
    const p = libs[id] = (async () => {
      if (id.startsWith('user:')) { const files = await IDB.get('lib:' + id); if (!files) throw new Error('nouser'); return PL.libraryFromFiles(files.map(fileLike), prog); }
      return PL.loadBundledLibrary(id, prog);
    })();
    p.catch(() => { delete libs[id]; });
    return p;
  }
  /** make the recordings of the current instrument + settings the active ones */
  function ensureLibrary() {
    if (!eng) return;
    const id = PL.wantedLib(type(), cur());
    if (id === libId) return;
    libId = id; libName = ''; libProg = 0;
    if (eng.sampler.lib) { eng.sampler.setLibrary(null); eng.apply(type(), cur(), { noWorklet: true }); }   // never play another instrument's recordings
    if (!id) { libStatus = ''; renderSourceInfo(); return; }
    if (!id.startsWith('user:') && !PL.assetsAvailable()) { libStatus = 'file'; renderSourceInfo(); return; }
    libStatus = 'loading'; renderSourceInfo();
    loadLib(id).then(lib => {
      if (libId !== id) return;
      eng.sampler.setLibrary(lib); eng.apply(type(), cur(), { noWorklet: true });
      libStatus = 'ready'; libName = lib.meta.name + ' — ' + lib.meta.license + (lib.meta.credit ? ', ' + lib.meta.credit : ''); renderSourceInfo(); renderStatus();
    }).catch(e => { if (libId !== id) return; libStatus = e.message === 'nouser' ? 'nouser' : 'error'; libName = e.message; renderSourceInfo(); });
  }
  function pushSettings() { if (eng) { eng.apply(type(), cur()); ensureLibrary(); } }

  /* ====================================================== PLAY NOTES == */
  let nid = 0, pedal = false, soft = false, octave = 0;
  const down = new Map();                  // source key → note id
  function noteOn(key, midi, vel) {
    if (down.has(key) || midi < 12 || midi > 120) return;
    const id = 'k' + (++nid); down.set(key, { id, midi });
    lightKey(midi, true);
    $('nowPlaying').textContent = noteName(midi) + ' · velocity ' + Math.round(vel * 127);
    ensureAudio().then(e => { if (down.get(key) && down.get(key).id === id) e.send([{ type: 'on', t: ctx.currentTime, midi, vel: Math.pow(clamp(vel, 0.02, 1), cur().touch), id }]); });
  }
  function noteOff(key) {
    const n = down.get(key); if (!n) return;
    down.delete(key); lightKey(n.midi, false);
    if (eng) eng.send([{ type: 'off', t: ctx.currentTime, id: n.id }]);
  }
  function setPedal(v) { pedal = v; const b = $('btnPedal'); if (b) b.classList.toggle('on', v); if (eng) eng.send([{ type: 'pedal', t: ctx.currentTime, v: v ? 1 : 0 }]); }
  function setSoft(v) { soft = v; const b = $('btnSoft'); if (b) b.classList.toggle('on', v); if (eng) eng.send([{ type: 'soft', t: ctx.currentTime, v: v ? 1 : 0 }]); }
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

  /* ======================================================== KEYBOARD == */
  const PCKEYS = 'awsedftgyhujkolp;';     // C … E (17 semitones) from the C of the current octave
  const keyEls = {};
  function renderKeyboard() {
    const kb = $('keyboard'); kb.innerHTML = '';
    const lo = CFG.keyboard.low, hi = CFG.keyboard.high, isB = m => [1, 3, 6, 8, 10].includes(m % 12);
    let whites = 0; for (let m = lo; m <= hi; m++) if (!isB(m)) whites++;
    const ww = 100 / whites; let x = 0;
    const base = 60 + octave * 12;
    for (let m = lo; m <= hi; m++) {
      const b = isB(m), pc = m - base, lab = pc >= 0 && pc < PCKEYS.length ? PCKEYS[pc].toUpperCase() : '';
      const k = el('div', { class: 'key ' + (b ? 'b' : 'w'), style: b ? 'left:' + (x - ww * 0.3) + '%;width:' + ww * 0.6 + '%' : 'left:' + x + '%;width:' + ww + '%', 'data-m': m },
        [lab ? el('u', {}, lab) : null, !b && m % 12 === 0 ? el('i', {}, noteName(m)) : null]);
      keyEls[m] = k; kb.appendChild(k);
      if (!b) x += ww;
    }
  }
  function lightKey(m, on) { const k = keyEls[m]; if (k) k.classList.toggle('on', on); }
  function bindKeyboard() {
    const kb = $('keyboard');
    let ptr = null;
    const hit = e => { const t = document.elementFromPoint(e.clientX, e.clientY); if (!t || !t.dataset || !t.dataset.m) return null; const r = t.getBoundingClientRect(); return { m: +t.dataset.m, v: clamp(0.25 + 0.75 * (e.clientY - r.top) / r.height, 0.1, 1) }; };
    kb.addEventListener('pointerdown', e => { const h = hit(e); if (!h) return; e.preventDefault(); kb.setPointerCapture(e.pointerId); ptr = h.m; noteOn('mouse', h.m, h.v); });
    kb.addEventListener('pointermove', e => { if (ptr === null) return; const h = hit(e); if (h && h.m !== ptr) { noteOff('mouse'); ptr = h.m; noteOn('mouse', h.m, h.v); } });
    const up = () => { if (ptr !== null) { noteOff('mouse'); ptr = null; } };
    kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Shift') { if (!pedal) setPedal(true); return; }
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      if (k === 'z') { octave = clamp(octave - 1, -3, 3); renderKeyboard(); return; }
      if (k === 'x') { octave = clamp(octave + 1, -3, 3); renderKeyboard(); return; }
      if (k === ' ') { e.preventDefault(); toggleDemo(); return; }
      const i = PCKEYS.indexOf(k); if (i >= 0) noteOn('pc' + k, 60 + octave * 12 + i, +$('kbVel').value);
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'Shift') { setPedal(false); return; }
      noteOff('pc' + e.key.toLowerCase());
    });
    $('kbBar').append(
      el('button', { class: 'btn', id: 'btnPedal', title: 'Sustain pedal — hold Shift (organ: fast rotary speaker)', onclick: () => setPedal(!pedal) }, '🦶 Sustain (Shift)'),
      el('button', { class: 'btn', id: 'btnSoft', title: 'Soft pedal (una corda): softer and darker, one string less per note', onclick: () => setSoft(!soft) }, '🤫 Soft pedal'),
      el('label', {}, ['Velocity (computer keys)', el('input', { type: 'range', id: 'kbVel', min: 0.1, max: 1, step: 0.01, value: 0.7 })]),
      el('span', { class: 'muted' }, 'Z / X = octave down / up · Space = demo'),
      el('button', { class: 'btn small', id: 'btnMidi', title: 'Use a MIDI keyboard connected to this computer', onclick: initMidi }, '🎹 MIDI keyboard…'),
      el('button', { class: 'btn small', title: 'Stop every sounding note', onclick: () => { if (eng) eng.stop(); stopDemo(); } }, '✋ All notes off'));
  }
  async function initMidi() {
    if (!navigator.requestMIDIAccess) return toast('This browser has no Web MIDI (use Chrome or Edge)');
    try {
      const acc = await navigator.requestMIDIAccess();
      const hook = () => acc.inputs.forEach(inp => {
        inp.onmidimessage = m => {
          const [st, d1, d2] = m.data, cmd = st & 0xf0;
          if (cmd === 0x90 && d2 > 0) noteOn('midi' + d1, d1, d2 / 127);
          else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) noteOff('midi' + d1);
          else if (cmd === 0xb0 && d1 === 64) setPedal(d2 >= 64);
          else if (cmd === 0xb0 && d1 === 67) setSoft(d2 >= 64);
        };
      });
      hook(); acc.onstatechange = hook;
      const names = []; acc.inputs.forEach(i => names.push(i.name));
      toast(names.length ? '🎹 MIDI in: ' + names.join(', ') : 'No MIDI keyboard found — connect one and press the button again');
      $('btnMidi').classList.toggle('on', names.length > 0);
    } catch (e) { toast('⚠ MIDI access was not allowed'); }
  }

  /* =========================================================== DEMOS == */
  let demoTimer = null, demoOn = false;
  const demoList = () => (PL.DEMO_ORDER[type()] || []).map(id => PL.DEMOS.find(d => d.id === id)).filter(Boolean);
  const demoSel = () => PL.DEMOS.find(d => d.id === state.ui.demo[type()]) || demoList()[0];
  async function playDemo() {
    const e = await ensureAudio();
    e.stop(); setPedal(false);
    const d = PL.demoEvents(demoSel(), cur(), ctx.currentTime + 0.15);
    e.send(d.events);
    demoOn = true; renderTransport();
    clearTimeout(demoTimer); demoTimer = setTimeout(() => { demoOn = false; renderTransport(); }, (d.end - ctx.currentTime + 1.5) * 1000);
  }
  function stopDemo() { clearTimeout(demoTimer); if (demoOn && eng) eng.stop(); demoOn = false; renderTransport(); }
  function toggleDemo() { if (demoOn) stopDemo(); else playDemo(); }
  async function exportWav() {
    toast('Rendering the demo…');
    const s = cur(), d = PL.demoEvents(demoSel(), s, 0.1), id = PL.wantedLib(type(), s);
    let lib = null;
    if (id && (PL.assetsAvailable() || id.startsWith('user:'))) { try { lib = await loadLib(id); } catch (e) { lib = null; } }
    const buf = await PL.renderOffline(type(), s, d.events, d.end + Math.max(3, s.reverbSize + 1.5), CFG.exportSampleRate, lib);
    const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1), dv = new DataView(new ArrayBuffer(44 + n * 4));
    const wr = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wr(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true); dv.setInt16(46 + i * 4, clamp(R[i], -1, 1) * 32767, true); }
    download(new Blob([dv.buffer], { type: 'audio/wav' }), 'piano-lab-' + type() + '-' + state.slot[type()] + '-' + demoSel().id + '.wav');
    toast('💾 WAV saved to your Downloads folder');
  }
  function download(blob, name) { const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  /* ========================================================== RENDER == */
  function renderTransport() {
    const box = $('transport'); box.innerHTML = '';
    box.append(
      el('button', { class: 'btn primary', onclick: toggleDemo, title: 'Play / stop the demo phrase (Space)' }, demoOn ? '■ Stop' : '▶ Play demo'),
      el('select', { title: 'Demo phrase (the first ones suit this instrument best)', onchange: e => { state.ui.demo[type()] = e.target.value; save(); if (demoOn) playDemo(); } },
        demoList().map((d, i) => el('option', { value: d.id, selected: d.id === demoSel().id }, (i < 2 ? '★ ' : '') + d.name))),
      el('span', { class: 'ab-label' }, PL.TYPES[type()].short + ' · ' + state.slot[type()]),
      el('button', { class: 'btn', onclick: exportWav, title: 'Render the demo with the current sound to a WAV file' }, '💾 Export WAV'));
  }
  function renderTypes() {
    const box = $('typeList'); box.innerHTML = '';
    PL.TYPE_IDS.forEach(t => {
      const T = PL.TYPES[t];
      box.appendChild(el('div', { class: 'guitar' + (t === type() ? ' active' : ''), title: T.desc, onclick: () => { if (t === type()) return; stopDemo(); if (eng) eng.stop(); state.type = t; save(); renderAll(); pushSettings(); } },
        [el('span', { class: 'ico' }, T.icon), el('div', {}, [el('b', {}, T.name), el('small', {}, T.desc.split('.')[0])]), state.refs[t] ? el('span', { class: 'star', title: 'Has a saved reference' }, '★') : null]));
    });
  }
  function renderSounds() {
    const box = $('soundBox'); box.innerHTML = '';
    const list = PL.SOUNDS[type()] || {};
    Object.keys(list).forEach(name => box.appendChild(el('button', { class: 'btn small', title: 'Load this sound into variant ' + state.slot[type()], onclick: () => {
      slot().settings = PL.sanitize(type(), Object.assign(PL.factory(type()), list[name])); save(); renderSettings(); renderDrawbars(); pushSettings(); toast('🎹 ' + name + ' → variant ' + state.slot[type()]);
    } }, name)));
  }
  function renderSlots() {
    const box = $('slotBox'); box.innerHTML = '';
    const t = type(), sl = slot();
    box.append(
      el('div', { class: 'slots' }, SLOTS.map(k => el('button', { class: 'btn' + (k === state.slot[t] ? ' on' : ''), title: 'Variant ' + k, onclick: () => { state.slot[t] = k; save(); renderSlots(); renderSettings(); renderDrawbars(); renderTransport(); pushSettings(); } },
        [k, state.slots[t][k].rating ? el('i', {}, '★' + state.slots[t][k].rating) : null]))),
      el('div', { class: 'stars', title: 'Your rating of this variant' }, [1, 2, 3, 4, 5].map(i => el('span', { class: i <= sl.rating ? 'on' : '', onclick: () => { sl.rating = sl.rating === i ? 0 : i; save(); renderSlots(); } }, '★'))),
      el('textarea', { placeholder: 'Notes about this variant…', value: sl.notes, oninput: e => { sl.notes = e.target.value; save(); } }),
      el('div', { class: 'row' }, [
        el('select', { id: 'copyTo', title: 'Copy this variant to another one' }, SLOTS.filter(k => k !== state.slot[t]).map(k => el('option', { value: k }, 'Copy to ' + k))),
        el('button', { class: 'btn small', onclick: () => { const k = $('copyTo').value; state.slots[t][k] = JSON.parse(JSON.stringify(sl)); save(); renderSlots(); toast('Copied to variant ' + k); } }, 'Copy'),
        el('button', { class: 'btn small', title: 'Back to the factory sound', onclick: () => { sl.settings = PL.factory(t); save(); renderSettings(); renderDrawbars(); pushSettings(); toast('Factory sound restored'); } }, '↺ Factory')
      ]));
  }
  function renderRef() {
    const box = $('refBox'); box.innerHTML = '';
    const t = type(), ref = state.refs[t];
    box.append(
      el('div', { class: 'ref-info' + (ref ? ' has' : '') }, ref ? ['★ Saved ' + new Date(ref.savedAt).toLocaleString(), el('br'), el('small', {}, ref.notes || 'no notes')] : 'No reference yet for the ' + PL.TYPES[t].name + '. When a variant sounds real, save it here: ScoreDAW will use it.'),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn small gold', onclick: () => { state.refs[t] = { settings: Object.assign({}, cur()), savedAt: new Date().toISOString(), notes: slot().notes, rating: slot().rating }; save(); renderRef(); renderTypes(); toast('⭐ Reference saved for the ' + PL.TYPES[t].name); } }, '⭐ Set from variant ' + state.slot[t]),
        ref ? el('button', { class: 'btn small', onclick: () => { slot().settings = PL.sanitize(t, ref.settings); save(); renderSettings(); renderDrawbars(); pushSettings(); toast('Reference loaded into variant ' + state.slot[t]); } }, 'Load') : null,
        ref ? el('button', { class: 'btn small', onclick: () => { delete state.refs[t]; save(); renderRef(); renderTypes(); } }, '✕') : null
      ]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn small', title: 'Download piano-references.json with the references of every instrument (copy it into tools/piano-lab/references)', onclick: saveRefs }, '💾 Save references…'),
        el('button', { class: 'btn small', title: 'Download the whole lab state (variants, references, experiments)', onclick: () => download(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), 'piano-lab-state.json') }, '⭳ Export all'),
        el('button', { class: 'btn small', title: 'Load a piano-lab-state.json file', onclick: importState }, '⭱ Import')
      ]));
  }
  function saveRefs() {
    const out = { app: 'ScoreDAW Piano Lab', version: CFG.version, savedAt: new Date().toISOString(), instruments: {} };
    PL.TYPE_IDS.forEach(t => { if (state.refs[t]) out.instruments[t] = state.refs[t]; });
    if (!Object.keys(out.instruments).length) return toast('No references yet — set one with "⭐ Set from variant"');
    download(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), 'piano-references.json');
    toast('💾 piano-references.json saved to Downloads — copy it into tools/piano-lab/references');
  }
  function importState() {
    const inp = el('input', { type: 'file', accept: '.json' });
    inp.onchange = async () => {
      try { const j = JSON.parse(await inp.files[0].text()); if (!j.slots) throw new Error('not a Piano Lab state file'); localStorage.setItem(CFG.storageKey, JSON.stringify(j)); state = loadState(); renderAll(); pushSettings(); toast('State imported'); }
      catch (e) { toast('⚠ ' + e.message); }
    };
    inp.click();
  }
  function renderLib() {
    const box = $('libBox'); box.innerHTML = '';
    const t = type(), list = state.library[t];
    box.append(
      el('div', { class: 'row' }, [el('input', { type: 'text', id: 'libName', placeholder: 'Name…', style: 'flex:1;min-width:0' }),
        el('button', { class: 'btn small', onclick: () => { const name = $('libName').value.trim() || 'Experiment ' + (list.length + 1); list.push({ name, settings: Object.assign({}, cur()), savedAt: new Date().toISOString() }); save(); renderLib(); } }, '+ Save')]),
      el('div', { class: 'lib-list' }, list.map((it, i) => el('div', { class: 'lib-item' }, [el('span', { title: new Date(it.savedAt).toLocaleString() }, it.name),
        el('button', { class: 'btn small', onclick: () => { slot().settings = PL.sanitize(t, it.settings); save(); renderSettings(); renderDrawbars(); pushSettings(); toast('"' + it.name + '" → variant ' + state.slot[t]); } }, 'Load'),
        el('button', { class: 'btn small', onclick: () => { list.splice(i, 1); save(); renderLib(); } }, '✕')]))));
  }
  /* ------------------------------------------------------- settings */
  function fmt(p, v) {
    const u = p.unit || '';
    if (u === 'dB') return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
    if (u === 'Hz') return v >= 1000 ? (v / 1000).toFixed(2) + ' kHz' : (p.step < 1 ? v.toFixed(1) : Math.round(v)) + ' Hz';
    if (u === 'ms') return (p.step < 1 ? v.toFixed(1) : Math.round(v)) + ' ms';
    if (u === 's') return v.toFixed(v < 1 ? 3 : 2) + ' s';
    if (u === 'midi') return noteName(v);
    if (u === 'st' || u === 'cents') return (v > 0 && p.min < 0 ? '+' : '') + (p.step >= 1 ? v : v.toFixed(2)) + ' ' + u;
    if (u.startsWith('×')) return v.toFixed(2) + u;
    if (p.max === 8 && p.step === 1 || p.id === 'unison') return String(v);
    if (p.min === -1 && p.max === 1) return (v > 0 ? '+' : '') + Math.round(v * 100);
    if (p.min >= 0 && p.max <= 1.6 && !u) return Math.round(v * 100) + '%';
    return v.toFixed(p.step >= 1 ? 0 : 2) + (u ? ' ' + u : '');
  }
  function setParam(id, v) { cur()[id] = v; save(); pushSettings(); if (PARAM[id].options || id.startsWith('db')) { if (id === 'engine' || id === 'epModel' || id === 'sampleLib') renderSettings(); renderDrawbars(); } }
  /** does this setting act with the current sound source? (with recordings the model settings rest) */
  function acts(p, s) {
    const T = PL.TYPES[type()];
    if (T.model !== 'piano' && T.model !== 'ep') return true;
    if (s.engine === 'Real samples') return p.sec !== 'strings' && p.sec !== 'ep' || p.id === 'epTone';
    if (s.engine === 'Physical model') return p.sec !== 'source' || ['engine', 'epModel', 'dynRange', 'damperTime', 'symRes', 'resTime'].includes(p.id);
    return true;
  }
  function renderSettings() {
    const box = $('settings'), t = type(), s = cur(), q = $('setSearch').value.trim().toLowerCase();
    box.innerHTML = '';
    $('setTitle').textContent = PL.TYPES[t].name + ' · variant ' + state.slot[t];
    PL.SECTIONS.forEach(([sec, title]) => {
      const ps = PL.PARAMS.filter(p => p.sec === sec && PL.paramFor(p, t) && (!q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.tip || '').toLowerCase().includes(q)));
      if (!ps.length) return;
      const changed = ps.filter(p => s[p.id] !== fac(p.id)).length, idle = ps.every(p => !acts(p, s));
      const det = el('details', { class: 'sec', open: q || state.ui.open[sec] ? true : null, ontoggle: e => { if (!q) { state.ui.open[sec] = e.target.open; save(); } } },
        [el('summary', {}, [title, el('small', {}, idle ? 'not used with this sound source' : changed ? changed + ' changed' : '')])]);
      if (sec === 'source') det.appendChild(el('div', { class: 'source-info', id: 'sourceInfo' }));
      ps.forEach(p => {
        const v = s[p.id], on = acts(p, s);
        const row = el('div', { class: 'prm' + (v !== fac(p.id) ? ' changed' : ''), style: on ? null : 'opacity:.45' });
        row.appendChild(el('label', { title: p.label + (p.tip ? ' — ' + p.tip : '') + (on ? '' : ' (not used with this sound source)') }, p.label));
        if (p.options) row.appendChild(el('select', { onchange: e => { setParam(p.id, e.target.value); row.classList.toggle('changed', e.target.value !== fac(p.id)); } }, p.options.map(o => el('option', { value: o, selected: o === v }, o))));
        else {
          const val = el('span', { class: 'val' }, fmt(p, v));
          row.append(el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v, oninput: e => { const x = +e.target.value; setParam(p.id, x); val.textContent = fmt(p, x); row.classList.toggle('changed', x !== fac(p.id)); } }), val);
        }
        row.appendChild(el('button', { class: 'rst', title: 'Factory value: ' + (p.options ? fac(p.id) : fmt(p, fac(p.id))), onclick: () => { setParam(p.id, fac(p.id)); renderSettings(); renderDrawbars(); } }, '↺'));
        det.appendChild(row);
      });
      box.appendChild(det);
    });
    renderSourceInfo();
  }
  function renderSourceInfo() {
    const box = $('sourceInfo'); if (!box) return;
    box.innerHTML = '';
    const s = cur(), id = PL.wantedLib(type(), s);
    let msg;
    if (!eng) msg = 'Press ▶ Start audio (or any key) to load the sound.';
    else if (!id) msg = '🧵 Physical model: every note is computed (strings, tines) — no recordings.';
    else if (libStatus === 'loading') msg = '⏳ Loading the real recordings… ' + Math.round(libProg * 100) + '% (the model plays meanwhile)';
    else if (libStatus === 'file') msg = el('span', { class: 'warn' }, '⚠ The packs/ folder is missing, so a page opened from disk cannot load the recordings. Run build_packs.py. The model plays meanwhile.');
    else if (libStatus === 'nouser') msg = el('span', { class: 'warn' }, 'No library of your own yet for this instrument — "📂 Load library…".');
    else if (libStatus === 'error') msg = el('span', { class: 'warn' }, '⚠ Could not load the recordings: ' + libName);
    else msg = '🎙 ' + (s.engine === 'Real samples' ? 'Real recordings: ' : 'Recordings + model: ') + libName;
    box.append(msg, el('div', { class: 'row' }, [el('button', { class: 'btn small', title: 'Use a folder with an SFZ sample library (or audio files with the note name in the file name) as "My library" of this instrument', onclick: loadUserLib }, '📂 Load library…')]));
  }
  function loadUserLib() {
    const inp = el('input', { type: 'file', webkitdirectory: true, multiple: true });
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => /\.(sfz|wav|flac|ogg|mp3|txt)$/i.test(f.name));
      if (!files.some(f => /\.(sfz|wav|flac|ogg|mp3)$/i.test(f.name))) return toast('⚠ No .sfz / audio files in that folder');
      const id = 'user:' + type();
      await IDB.set('lib:' + id, files.map(f => ({ path: f.webkitRelativePath || f.name, blob: f })));
      delete libs[id]; libId = undefined;
      cur().sampleLib = 'My library (folder)'; if (cur().engine === 'Physical model') cur().engine = 'Real samples';
      save(); renderSettings(); pushSettings(); toast('Reading ' + files.length + ' files…');
    };
    inp.click();
  }
  function renderDrawbars() {
    const card = $('drawbarCard'), org = PL.TYPES[type()].model === 'organ';
    card.hidden = !org; if (!org) return;
    const box = $('drawbars'); box.innerHTML = '';
    const col = ['brown', 'brown', 'white', 'white', 'black', 'white', 'black', 'black', 'white'];
    PL.DRAWBARS.forEach((d, i) => {
      const id = 'db' + (i + 1), num = el('b', {}, String(cur()[id]));
      box.appendChild(el('div', { class: 'dbar ' + col[i] }, [num, el('input', { type: 'range', min: 0, max: 8, step: 1, value: cur()[id], title: 'Drawbar ' + d[0], oninput: e => { cur()[id] = +e.target.value; num.textContent = e.target.value; save(); pushSettings(); } }), el('small', {}, d[0])]));
    });
  }
  function renderStatus() {
    const box = $('status'); box.innerHTML = '';
    box.append(
      el('span', {}, ['Audio: ', el('b', { class: eng ? 'ok' : 'warn' }, eng ? ctx.sampleRate + ' Hz · ' + Math.round((ctx.baseLatency || 0) * 1000) + ' ms' : 'not started')]),
      el('span', {}, ['Mode: ', el('b', { class: PL.assetsAvailable() ? 'ok' : 'warn' }, !PL.fromDisk() ? 'served (recordings available)' : PL.PACKS ? 'from disk + packs (recordings available)' : 'from disk without packs (models only)')]),
      el('span', { class: 'sp' }),
      el('b', { id: 'savedMark', class: 'ok', title: 'Every change is saved automatically in this browser, in the selected variant (A–D) of the selected instrument' }, '💾 Changes are saved automatically'),
      el('span', {}, 'Piano Lab v' + CFG.version));
  }
  function renderAll() { renderTransport(); renderTypes(); renderSounds(); renderSlots(); renderRef(); renderLib(); renderSettings(); renderDrawbars(); renderStatus(); }

  /* ======================================================== ANALYSER == */
  let hold = null, refBuf = null, refSrc = null;
  const fbuf = new Float32Array(4096), tbuf = new Float32Array(2048);
  function draw() {
    requestAnimationFrame(draw);
    if (!eng) return;
    const an = eng.n.analyser, cv = $('spectrum'), g = cv.getContext('2d');
    const W = cv.clientWidth, H = cv.clientHeight; if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; g.clearRect(0, 0, W, H);
    an.getFloatFrequencyData(fbuf);
    const sr = ctx.sampleRate, bins = an.frequencyBinCount, fx = f => Math.log(f / 20) / Math.log(1000) * W, yd = d => clamp((-d - 10) / 90, 0, 1) * H;
    g.strokeStyle = 'rgba(160,140,255,.14)'; g.fillStyle = 'rgba(200,200,255,.45)'; g.font = '10px Consolas';
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => { const x = fx(f); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 2, H - 3); });
    [-20, -40, -60, -80].forEach(d => { g.beginPath(); g.moveTo(0, yd(d)); g.lineTo(W, yd(d)); g.stroke(); g.fillText(d + ' dB', 2, yd(d) - 2); });
    const curve = data => { g.beginPath(); for (let x = 0; x < W; x += 2) { const f = 20 * Math.pow(1000, x / W), i = Math.min(bins - 1, Math.round(f / (sr / 2) * bins)); const y = yd(data[i]); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    if (hold) { g.setLineDash([5, 4]); g.strokeStyle = '#ffcf4a'; curve(hold); g.setLineDash([]); }
    g.strokeStyle = '#33e1ff'; g.lineWidth = 1.6; g.shadowColor = '#33e1ff'; g.shadowBlur = 6; curve(fbuf); g.shadowBlur = 0; g.lineWidth = 1;
    const sc = $('scope'), g2 = sc.getContext('2d'), w2 = sc.clientWidth, h2 = sc.clientHeight; if (sc.width !== w2) sc.width = w2; if (sc.height !== h2) sc.height = h2; g2.clearRect(0, 0, w2, h2);
    an.getFloatTimeDomainData(tbuf);
    let pk = 0; g2.strokeStyle = '#b56cff'; g2.beginPath();
    for (let x = 0; x < w2; x++) { const v = tbuf[Math.floor(x / w2 * tbuf.length)]; pk = Math.max(pk, Math.abs(v)); const y = h2 / 2 - v * h2 * 0.48; x ? g2.lineTo(x, y) : g2.moveTo(x, y); }
    g2.stroke();
    $('meterBar').style.width = clamp(pk, 0, 1) * 100 + '%';
    $('anInfo').textContent = pk > 0.001 ? 'peak ' + (20 * Math.log10(pk)).toFixed(1) + ' dBFS' : '';
  }
  function bindAnalyser() {
    $('btnHold').onclick = () => { if (eng) { hold = new Float32Array(fbuf); toast('Curve held (dashed)'); } };
    $('btnClearHold').onclick = () => { hold = null; };
    $('btnRefLoad').onclick = () => $('refFile').click();
    $('refFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      await ensureAudio();
      try { refBuf = await ctx.decodeAudioData(await f.arrayBuffer()); $('refName').textContent = f.name + ' (' + refBuf.duration.toFixed(1) + ' s)'; $('btnRefPlay').disabled = false; }
      catch (er) { toast('⚠ Could not read that audio file'); }
    };
    $('btnRefPlay').onclick = () => {
      if (refSrc) { refSrc.stop(); refSrc = null; $('btnRefPlay').textContent = '▶ Play recording'; return; }
      refSrc = ctx.createBufferSource(); refSrc.buffer = refBuf; refSrc.connect(eng.n.analyser);
      refSrc.onended = () => { refSrc = null; $('btnRefPlay').textContent = '▶ Play recording'; };
      refSrc.start(); $('btnRefPlay').textContent = '■ Stop recording';
    };
  }

  /* ============================================================ START == */
  function help() {
    const ov = el('div', { class: 'overlay', onclick: e => { if (e.target === ov) ov.remove(); } }, el('div', { class: 'glass dialog help' }, [
      el('h2', {}, '🎹 How to use the Piano Lab'),
      el('ol', {}, [
        'Pick an instrument on the left. The grand and the electric piano play real recordings; the synth and the organ are computed.',
        'Play: click the keys (lower on the key = louder), use the computer keys A W S E D F T G Y H U J K O L P (Z / X change the octave), or connect a MIDI keyboard. Hold Shift for the sustain pedal.',
        'Press ▶ Play demo (Space) to hear a phrase that suits the instrument, and change the settings on the right while it plays.',
        'Try the Sounds list for starting points. Variants A–D let you compare four versions; rate them and write notes.',
        'When one sounds real, press "⭐ Set from variant": that is the reference ScoreDAW will use. "💾 Save references…" writes them to a file.',
        'To compare with a real instrument, load a recording under the analyser and use "📌 Hold curve".',
        'Sound source (grand / electric piano): Real samples = recordings, Physical model = computed strings or tines, Layered = both.'
      ].map(t => el('li', {}, t))),
      el('button', { class: 'btn primary', onclick: () => ov.remove() }, 'Close')
    ]));
    document.body.appendChild(ov);
  }
  function init() {
    state = loadState();
    const sc = $('uiScale'); sc.value = state.ui.scale;
    const applyScale = () => { document.body.style.zoom = state.ui.scale; document.body.style.height = (100 / state.ui.scale) + 'vh'; $('uiScaleVal').textContent = Math.round(state.ui.scale * 100) + '%'; };
    sc.oninput = () => { state.ui.scale = +sc.value; applyScale(); save(); }; applyScale();
    $('btnHelp').onclick = help;
    $('btnStart').onclick = () => ensureAudio();
    $('setSearch').oninput = renderSettings;
    renderKeyboard(); bindKeyboard(); bindAnalyser(); renderAll();
    window.addEventListener('blur', () => { down.forEach((v, k) => noteOff(k)); if (pedal) setPedal(false); });
  }
  document.addEventListener('DOMContentLoaded', init);
  PL.lab = { get state() { return state; }, get engine() { return eng; }, ensureAudio, playDemo, stopDemo, libState: () => libStatus };
})();
