/* =============================================================================
 *  GUITARRIG-PANEL.JS — the Guitar Rig window of a track (engine 'rig')
 *  -----------------------------------------------------------------------------
 *  Opens from: Inspector → Sound Slot "🎸 Open Guitar Rig…", the 🎛 button or a
 *  double-click on the channel in the Pattern view, the track menu in the
 *  Arrange, and the Generator view (F8).
 *
 *  A floating window (drag it by its title bar; the DAW keeps working behind it,
 *  Space still plays / stops), with tabs:
 *    🎸 Guitar        guitar model, sound source (real recordings / string model),
 *                     colour (warm ↔ bright), brightness, attack, sustain, level
 *    🧲 Pickups       electric: selector, pickup type, volume + tone knobs
 *    🎙 Microphone    acoustic: mic position + distance, piezo blend, body
 *    🔊 Amp & Cabinet electric: 3D amplifier with every knob, real amp captures
 *                     (NAM), cabinet + microphone (drag the background to turn it)
 *    🎚 Tone EQ       6 bands + warm/bright tilt, mud / harshness cuts, curve
 *    🌫 Effects       compressor, chorus, delay, reverb, saturation, width
 *    🤘 Playing       strum speed, human feel, palm mute, vibrato, legato
 *    ⚙ Advanced       every Guitar Lab setting of this guitar
 *
 *  Every control changes the sound live; letting go of it keeps the change
 *  (one undo step, Ctrl+Z). Double-click a knob = factory value.
 *  The settings are saved with the song in the track (see guitarrig.js).
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { el, svg } = SDAW;
  const RG = () => SDAW.guitarRig;
  const P = { trackId: null, tab: 'guitar', win: null, rot: { x: -8, y: -24 }, demoId: {}, search: '', raf: 0 };
  SDAW.rigPanel = P;
  const PARAM = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const track = () => SDAW.store.track(P.trackId);
  const model = () => RG().model(track());
  const TYPE = () => GL.TYPES[model()];
  const S = () => RG().settings(track());
  const isEl = () => TYPE().cat === 'electric';
  const fac = id => GL.factory(model())[id];
  const scale = () => (SDAW.app && SDAW.app.scale) || 1;
  const MODEL_NAMES = {};          // model id → library instrument name
  const LS_KEY = 'scoredaw.rigPanel';

  /* ============================================================ EDITING == */
  let editing = false, wheelTimer = null;
  function begin() { if (!editing) { SDAW.store.beginEdit(); editing = true; } }
  function setV(id, v) { const t = track(); if (!t) return; RG().setValue(t, id, v); RG().applyNow(t); }
  function end(label) { if (!editing) return; editing = false; SDAW.store.endEdit('Guitar Rig: ' + (label || 'setting')); }
  function setOnce(id, v, label) { begin(); setV(id, v); end(label || (PARAM[id] && PARAM[id].label)); }
  /** several values in one undo step (pickup type → resonance / Q / output …) */
  function setMany(obj, label) { begin(); Object.keys(obj).forEach(k => setV(k, obj[k])); end(label); }

  /* ------------------------------------------- what acts on the recordings */
  // With "Real samples" the string-model settings do nothing: they are shown dimmed.
  const ON_SAMPLES = new Set(['pickupSel', 'pickupType', 'toneKnob', 'volumeKnob', 'pickupOut', 'pickupRes', 'trebleBleed',
    'micPos', 'micDistance', 'piezoBlend', 'piezoQuack', 'saturation', 'width', 'strumSpeed', 'humanTime', 'humanVel', 'palmMute',
    'releaseTime', 'squeak', 'squeakProb', 'vibDepth', 'vibRate', 'vibDelay', 'legatoLevel']);
  function mode(s) { return s.engine === 'Physical model' ? 'model' : s.engine === 'Real samples' ? 'samples' : 'layered'; }
  function acts(id, s) {
    const p = PARAM[id]; if (!p) return true;
    const m = mode(s);
    if (p.sec === 'source') return id === 'engine' || m !== 'model';
    if (m !== 'samples') return true;
    return ON_SAMPLES.has(id) || p.sec === 'amp' || p.sec === 'eq' || p.sec === 'fx';
  }

  /* ========================================================== FORMATS == */
  function fmt(p, v) {
    if (p.options) return String(v);
    const u = p.unit || '';
    if (u === 'dB') return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
    if (u === 'Hz') return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + ' kHz' : Math.round(v) + ' Hz';
    if (u === 'ms' || u === 'ms/string') return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ms';
    if (u === 's') return v.toFixed(v < 10 ? 2 : 1) + ' s';
    if (u === 'cents') return v.toFixed(1) + ' ¢';
    if (u.startsWith('×')) return v.toFixed(2) + '×';
    if (p.min === 0 && p.max === 10) return v.toFixed(1);
    if (p.min === -1 && p.max === 1) return (v > 0 ? '+' : '') + Math.round(v * 100);
    if (p.min >= 0 && p.max <= 1.5 && !u) return Math.round(v * 100) + '%';
    const d = p.step >= 1 ? 0 : p.step >= 0.1 ? 1 : 2;
    return v.toFixed(d) + (u ? ' ' + u : '');
  }
  const snap = (p, v) => { const st = p.step || 0.01; v = Math.round((v - p.min) / st) * st + p.min; return +clamp(v, p.min, p.max).toFixed(6); };

  /* ============================================================ KNOBS == *
   * knob(id, { label, cls:'chrome'|'big'|'small', color, def })
   * drag up / down (Shift = fine) · mouse wheel · double-click = factory value */
  const ARC0 = -135, ARC1 = 135;
  function arcPath(cx, cy, r, a0, a1) {
    const rad = a => (a - 90) * Math.PI / 180, p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))], p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function knob(id, o) {
    o = o || {};
    const p = o.def || PARAM[id]; if (!p) return null;
    const s = S(), cur = () => S()[id];
    const off = !acts(id, s);
    const size = o.cls === 'big' ? 76 : o.cls === 'chrome' ? 58 : o.cls === 'small' ? 44 : 56;
    const c = size / 2, r = c - 5;
    const track0 = svg('path', { d: arcPath(c, c, r, ARC0, ARC1), class: 'rk-track' });
    const fill = svg('path', { class: 'rk-fill' });
    const cap = svg('circle', { cx: c, cy: c, r: r - 6, class: 'rk-cap' });
    const ptr = svg('line', { x1: c, y1: c - (r - 7), x2: c, y2: c - (r - 16), class: 'rk-ptr' });
    const g = svg('g', {}, [ptr]);
    const face = svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, class: 'rk-svg' }, [track0, fill, cap, g]);
    const val = el('div', { class: 'rk-val' });
    const wrap = el('div', {
      class: 'rk ' + (o.cls || '') + (off ? ' off' : ''), style: o.color ? { '--kc': o.color } : null,
      'data-help': (o.label || p.label) + (p.tip ? ' — ' + p.tip : '') + ' · drag up/down (Shift = fine), wheel, double-click = factory' + (off ? ' · acts on the string model only (Sound source)' : '')
    }, [face, el('div', { class: 'rk-lab' }, o.label || p.label), val, off ? el('span', { class: 'rk-badge' }, 'model') : null]);
    function draw() {
      const v = cur(), f = (v - p.min) / ((p.max - p.min) || 1), a = ARC0 + f * (ARC1 - ARC0);
      const zero = p.min < 0 && p.max > 0 ? ARC0 + (-p.min / (p.max - p.min)) * (ARC1 - ARC0) : ARC0;
      fill.setAttribute('d', Math.abs(a - zero) < 0.5 ? '' : arcPath(c, c, r, Math.min(zero, a), Math.max(zero, a)));
      g.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' ' + c + ' ' + c + ')');
      val.textContent = fmt(p, v);
      wrap.classList.toggle('changed', Math.abs(v - fac(id)) > 1e-9);
    }
    let y0 = 0, v0 = 0;
    wrap.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      wrap.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = cur(); begin(); wrap.classList.add('drag');
    });
    wrap.addEventListener('pointermove', e => {
      if (!wrap.hasPointerCapture(e.pointerId)) return;
      const dy = (y0 - e.clientY) / scale();
      const v = snap(p, v0 + dy / 170 * (p.max - p.min) * (e.shiftKey ? 0.15 : 1));
      if (v !== cur()) { setV(id, v); draw(); if (o.onLive) o.onLive(v); }
    });
    const up = e => { if (!wrap.hasPointerCapture(e.pointerId)) return; wrap.releasePointerCapture(e.pointerId); wrap.classList.remove('drag'); end(o.label || p.label); };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('wheel', e => {
      e.preventDefault(); begin();
      const stp = (p.step || 0.01) * (e.shiftKey ? 1 : Math.max(1, Math.round((p.max - p.min) / (p.step || 0.01) / 60)));
      setV(id, snap(p, cur() + (e.deltaY < 0 ? stp : -stp))); draw(); if (o.onLive) o.onLive(cur());
      clearTimeout(wheelTimer); wheelTimer = setTimeout(() => end(o.label || p.label), 450);
    }, { passive: false });
    wrap.addEventListener('dblclick', e => { e.stopPropagation(); setOnce(id, fac(id), (o.label || p.label) + ' (factory)'); });
    draw();
    return wrap;
  }
  /** select for an options setting */
  function choice(id, o) {
    o = o || {};
    const p = PARAM[id], v = S()[id], off = !acts(id, S());
    const opts = o.options || p.options;
    return el('label', { class: 'rk-sel' + (off ? ' off' : ''), 'data-help': (o.label || p.label) + (p.tip ? ' — ' + p.tip : '') }, [
      el('span', {}, o.label || p.label),
      el('select', { onchange: e => { setOnce(id, e.target.value, o.label || p.label); if (o.after) o.after(e.target.value); } },
        opts.map(x => el('option', { value: x, selected: x === v ? true : null }, x)))
    ]);
  }
  /** segmented buttons for an options setting */
  function segs(id, list, o) {
    o = o || {};
    const v = S()[id];
    return el('div', { class: 'rig-segs' + (o.cls ? ' ' + o.cls : '') }, list.map(x => el('button', {
      class: 'seg' + (x === v ? ' on' : ''), 'data-help': (o.help || PARAM[id].label) + ': ' + x,
      onclick: () => { if (o.set) o.set(x); else setOnce(id, x, PARAM[id].label); }
    }, o.labels ? o.labels[x] || x : x)));
  }
  /** a card with a title and controls */
  const card = (title, color, kids, cls) => el('div', { class: 'rig-card' + (cls ? ' ' + cls : ''), style: { '--cc': color } }, [el('div', { class: 'rig-card-t' }, title), el('div', { class: 'rig-card-b' }, kids)]);
  /** vertical fader (EQ bands) */
  function fader(id, label) {
    const p = PARAM[id], cur = () => S()[id];
    const knobEl = el('div', { class: 'fd-knob' }), fillEl = el('div', { class: 'fd-fill' }), val = el('div', { class: 'fd-val' });
    const slot = el('div', { class: 'fd-slot' }, [el('div', { class: 'fd-zero' }), fillEl, knobEl]);
    const wrap = el('div', { class: 'fader', 'data-help': p.label + ' — drag, wheel, double-click = 0 dB' }, [val, slot, el('div', { class: 'fd-lab' }, label)]);
    const H = 190;
    function draw() {
      const v = cur(), f = (v - p.min) / (p.max - p.min), y = (1 - f) * H, y0 = (1 - (-p.min / (p.max - p.min))) * H;
      knobEl.style.top = (y - 9) + 'px';
      fillEl.style.top = Math.min(y, y0) + 'px'; fillEl.style.height = Math.abs(y - y0) + 'px';
      val.textContent = (v > 0 ? '+' : '') + v.toFixed(1);
      wrap.classList.toggle('changed', Math.abs(v - fac(id)) > 1e-9);
    }
    let yS = 0, vS = 0;
    slot.addEventListener('pointerdown', e => {
      e.preventDefault(); slot.setPointerCapture(e.pointerId); begin();
      const r = slot.getBoundingClientRect(), f = 1 - (e.clientY - r.top) / r.height;
      if (e.target !== knobEl) { setV(id, snap(p, p.min + f * (p.max - p.min))); draw(); drawCurve(); }
      yS = e.clientY; vS = cur();
    });
    slot.addEventListener('pointermove', e => {
      if (!slot.hasPointerCapture(e.pointerId)) return;
      const dv = (yS - e.clientY) / scale() / H * (p.max - p.min) * (e.shiftKey ? 0.2 : 1);
      setV(id, snap(p, vS + dv)); draw(); drawCurve();
    });
    const up = e => { if (!slot.hasPointerCapture(e.pointerId)) return; slot.releasePointerCapture(e.pointerId); end(p.label); };
    slot.addEventListener('pointerup', up); slot.addEventListener('pointercancel', up);
    slot.addEventListener('wheel', e => { e.preventDefault(); begin(); setV(id, snap(p, cur() + (e.deltaY < 0 ? 0.5 : -0.5))); draw(); drawCurve(); clearTimeout(wheelTimer); wheelTimer = setTimeout(() => end(p.label), 450); }, { passive: false });
    wrap.addEventListener('dblclick', () => { setOnce(id, 0, p.label + ' 0 dB'); });
    draw();
    return wrap;
  }

  /* ============================================================ WINDOW == */
  P.isOpen = () => !!(P.win && P.win.isConnected);
  P.open = function (trackId) {
    const t = SDAW.store.track(trackId || SDAW.store.sel.trackId);
    if (!t || !RG() || !RG().isRigTrack(t)) { SDAW.toast('Select a track that uses a Guitar Rig guitar (Library → Realistic Guitars)'); return; }
    if (!RG().ok()) { SDAW.toast('⚠ The guitar engine is not available in this browser (needs AudioWorklet: Chrome / Edge)'); return; }
    [SDAW.prigPanel, SDAW.wrigPanel].forEach(W => { if (W && W.isOpen && W.isOpen()) W.close(); });     // one rig window at a time
    P.trackId = t.id;
    try { const st = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (st) { P.pos = st.pos; P.tab = st.tab || P.tab; P.rot = st.rot || P.rot; } } catch (e) { /* ignore */ }
    SDAW.audio.init(); SDAW.audio.updateTrack(t);                 // start the engine + recordings now
    if (!P.win || !P.win.isConnected) {
      P.win = el('div', { class: 'rig-win', id: 'rigWin' });
      let root = document.getElementById('floatRoot');
      if (!root) { root = el('div', { id: 'floatRoot' }); document.getElementById('app').appendChild(root); }
      root.appendChild(P.win);
    }
    render();
    startScope();
  };
  P.close = function () {
    if (P.win) P.win.remove();
    P.win = null; cancelAnimationFrame(P.raf);
    const t = track(); if (t && RG()) RG().stopDemo(t);
  };
  function savePos() { try { localStorage.setItem(LS_KEY, JSON.stringify({ pos: P.pos, tab: P.tab, rot: P.rot })); } catch (e) { /* full */ } }
  function place() {
    const W = 1480, H = 880, app = document.getElementById('app');
    const aw = app ? app.offsetWidth : 1920, ah = app ? app.offsetHeight : 1080;
    if (!P.pos) P.pos = { x: Math.max(10, (aw - W) / 2), y: Math.max(10, (ah - H) / 2) };
    P.pos.x = clamp(P.pos.x, -W + 200, aw - 160); P.pos.y = clamp(P.pos.y, 0, ah - 60);
    P.win.style.left = P.pos.x + 'px'; P.win.style.top = P.pos.y + 'px';
  }
  function dragWindow(handle) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button, select, input, canvas, .rig-model')) return;
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY, p0 = Object.assign({}, P.pos);
      const mv = ev => { P.pos.x = p0.x + (ev.clientX - x0) / scale(); P.pos.y = p0.y + (ev.clientY - y0) / scale(); place(); };
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); savePos(); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
    });
  }

  /* ============================================================ RENDER == */
  function render() {
    if (!P.isOpen()) return;
    const t = track();
    if (!t || !RG().isRigTrack(t)) { P.close(); return; }
    const keepScroll = P.win.querySelector('.rig-body') ? P.win.querySelector('.rig-body').scrollTop : 0;
    P.win.innerHTML = '';
    const T = TYPE();
    if (!isEl() && (P.tab === 'pickups' || P.tab === 'amp')) P.tab = 'mic';
    if (isEl() && P.tab === 'mic') P.tab = 'pickups';
    // ---- title bar: name, the 5 guitars, spectrum, close
    const head = el('div', { class: 'rig-head' }, [
      el('div', { class: 'rig-title' }, [el('b', {}, '🎸 GUITAR RIG'), el('small', {}, t.name)]),
      el('div', { class: 'rig-models' }, RG().MODELS.map(m => {
        const MT = GL.TYPES[m];
        return el('button', { class: 'rig-model' + (m === model() ? ' on' : ''), 'data-help': MT.name + ' — ' + MT.desc, onclick: () => switchModel(m) },
          [el('span', { class: 'ico' }, MT.icon), el('span', {}, MT.short)]);
      })),
      el('span', { class: 'spacer' }),
      el('canvas', { class: 'rig-scope', width: 300, height: 46, 'data-help': 'Spectrum of this guitar (live)' }),
      el('button', { class: 'rig-x', 'data-help': 'Close (Esc)', onclick: P.close }, '✕')
    ]);
    dragWindow(head);
    // ---- action bar: status, presets, test
    const st = RG().status(t);
    const presets = RG().presets(model());
    const groups = {};
    presets.forEach(pr => { (groups[pr.group] = groups[pr.group] || []).push(pr); });
    const curDiff = JSON.stringify(RG().toDiff(model(), S()));
    const match = presets.find(pr => JSON.stringify(RG().toDiff(model(), GL.sanitize(model(), pr.diff))) === curDiff);
    const presetSel = el('select', { class: 'rig-preset', 'data-help': 'Presets: the factory sound, your Guitar Lab reference (★), starting points and your own presets', onchange: e => applyPreset(presets.find(x => x.id === e.target.value)) },
      [match ? null : el('option', { value: '', selected: true }, '— custom —')].concat(Object.keys(groups).map(gname => el('optgroup', { label: gname },
        groups[gname].map(pr => el('option', { value: pr.id, selected: match && match.id === pr.id ? true : null }, pr.name))))));
    const demos = RG().demos(model());
    const demoId = P.demoId[model()] || demos[0].id;
    const playing = RG().demoPlaying(t);
    const bar = el('div', { class: 'rig-bar' }, [
      el('div', { class: 'rig-status', id: 'rigStatus' }, statusNodes(st)),
      el('span', { class: 'spacer' }),
      presetSel,
      el('button', { class: 'btn small', 'data-help': 'Save the current sound as a preset of this guitar', onclick: savePreset }, '💾 Save…'),
      match && match.mine ? el('button', { class: 'btn small', 'data-help': 'Delete this preset', onclick: () => { RG().deletePreset(model(), match.name); render(); } }, '🗑') : null,
      el('button', { class: 'btn small', 'data-help': 'Import your Guitar Lab settings (guitar-references.json or guitar-lab-state.json)', onclick: importLab }, '⭳ Guitar Lab…'),
      el('button', { class: 'btn small', 'data-help': 'Back to the factory sound of this guitar', onclick: () => { begin(); RG().reset(t); RG().applyNow(t); end('factory sound'); } }, '↺ Factory'),
      el('span', { class: 'sep' }),
      el('select', { class: 'rig-demo', 'data-help': 'Test phrase (the first ones suit this guitar best)', onchange: e => { P.demoId[model()] = e.target.value; if (RG().demoPlaying(t)) testPhrase(true); } },
        demos.map((d, i) => el('option', { value: d.id, selected: d.id === demoId ? true : null }, (i < 3 ? '★ ' : '') + d.name))),
      el('button', { class: 'btn small' + (playing ? ' on' : ''), id: 'rigTestBtn', 'data-help': 'Play the test phrase with this sound (it does not touch your song)', onclick: () => testPhrase() }, playing ? '■ Stop' : '▶ Test'),
      el('button', { class: 'btn small cyan', id: 'rigPlayBtn', 'data-help': 'Play / stop the song or pattern (Space) — hear the change on your own part', onclick: () => SDAW.app.togglePlay() }, SDAW.audio.playing ? '❚❚ Stop' : '▶ My part')
    ]);
    // ---- tabs
    const TABS = [['guitar', '🎸 Guitar']].concat(isEl() ? [['pickups', '🧲 Pickups'], ['amp', '🔊 Amp & Cabinet']] : [['mic', '🎙 Microphone & Body']])
      .concat([['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['play', '🤘 Playing'], ['adv', '⚙ Advanced']]);
    const tabs = el('div', { class: 'rig-tabs' }, TABS.map(([id, label]) => el('button', { class: 'rig-tab' + (P.tab === id ? ' on' : ''), onclick: () => { P.tab = id; savePos(); render(); } }, label)));
    const body = el('div', { class: 'rig-body rig-' + P.tab });
    ({ guitar: tabGuitar, pickups: tabPickups, mic: tabMic, amp: tabAmp, eq: tabEQ, fx: tabFX, play: tabPlay, adv: tabAdvanced }[P.tab])(body, t, T);
    P.win.append(head, bar, tabs, body);
    place();
    body.scrollTop = keepScroll;
    if (P.tab === 'eq') drawCurve();
  }
  function statusNodes(st) { return [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text + (st.amp ? '  ·  ' + st.amp : ''))]; }

  function switchModel(m) {
    const t = track(); if (!t || m === model()) return;
    const name = MODEL_NAMES[m] || GL.TYPES[m].name;
    SDAW.store.mutate('Guitar model ' + GL.TYPES[m].short, () => {
      t.params.rig = m; t.instrument = name;
      t.params.rigS = t.params.rigS || {};
      if (!t.params.rigS[m]) t.params.rigS[m] = RG().labReference(m) || {};
    });
    SDAW.toast(GL.TYPES[m].icon + ' ' + name + ' — loading its recordings…');
  }
  function applyPreset(pr) {
    const t = track(); if (!t || !pr) return;
    begin(); RG().setDiff(t, pr.diff); RG().applyNow(t); end('preset ' + pr.name);
    SDAW.toast('🎸 ' + pr.name);
  }
  function savePreset() {
    SDAW.ask('Name of the preset (' + TYPE().short + ')', '', name => {
      RG().savePreset(model(), name, RG().toDiff(model(), S()));
      SDAW.toast('💾 Preset "' + name + '" saved'); render();
    });
  }
  function importLab() {
    const inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const got = RG().importLabFile(JSON.parse(await f.text()));
        if (!got.length) return SDAW.toast('⚠ No Guitar Lab settings found in that file');
        const t = track();
        if (got.includes(model())) { begin(); RG().setDiff(t, RG().labReference(model())); RG().applyNow(t); end('Guitar Lab reference'); }
        SDAW.toast('⭳ Guitar Lab settings imported for: ' + got.map(m => GL.TYPES[m].short).join(', ') + ' (preset "★ My Guitar Lab reference")' +
          (got.needsLibrary && got.needsLibrary.length ? ' · ⚠ ' + got.needsLibrary.map(m => GL.TYPES[m].short).join(', ') + ' use your own sample folder: the file has the settings, not the recordings — load the folder here with "📂 Load library…"' : ''));
        render();
      } catch (e) { SDAW.toast('⚠ Could not read the file: ' + e.message); }
    };
    inp.click();
  }
  async function testPhrase(restart) {
    const t = track(); if (!t) return;
    if (RG().demoPlaying(t) && !restart) { RG().stopDemo(t); return; }
    const demos = RG().demos(model());
    const id = P.demoId[model()] || demos[0].id;
    if (SDAW.audio.playing) SDAW.audio.stop();
    await RG().demo(t, id);
    const b = document.getElementById('rigTestBtn'); if (b) { b.textContent = '■ Stop'; b.classList.add('on'); }
  }

  /* ======================================================= TAB: GUITAR == */
  function tabGuitar(body, t, T) {
    const s = S(), m = mode(s);
    const libOpts = ['Built-in'].concat(T.libAlt ? ['Built-in (alternative)'] : []).concat(['My library (folder)']);
    body.append(
      el('div', { class: 'rig-col rig-art' }, [guitarArt(t, 'full'), el('div', { class: 'rig-desc' }, [el('b', {}, T.name), el('p', {}, T.desc)])]),
      el('div', { class: 'rig-col rig-cards' }, [
        card('SOUND SOURCE', '#22e0ff', [
          segs('engine', PARAM.engine.options, { labels: { 'Real samples': '🎙 Real recordings', 'Layered (samples + model)': '🎙+🧵 Layered', 'Physical model': '🧵 String model' } }),
          el('div', { class: 'rig-row' }, [choice('sampleLib', { options: libOpts, label: 'Recordings' }),
            el('button', { class: 'btn small', 'data-help': 'Use a folder with an SFZ sample library (or WAV files named by note) as "My library" of this guitar', onclick: loadUserLibrary }, '📂 Load library…')]),
          el('div', { class: 'rig-hint' }, m === 'samples' ? 'Real recordings of a real guitar: the most realistic. Settings marked "model" act on the string model only.' : m === 'layered' ? 'Recordings + the string model on top (its level and range: "Model layer").' : 'Synthesized strings: every setting of the Strings / Pluck / Body sections acts.')
        ], 'wide'),
        card('COLOUR & BRIGHTNESS', '#ffd23f', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f' }), knob('eqAir', { label: 'Air', color: '#ffd23f' }), knob('eqPres', { label: 'Presence', color: '#ffd23f' }), knob('thickness', { label: 'Thickness', color: '#ffd23f' }), knob('sampleTone', { label: 'Recordings tone', color: '#ffd23f' }), knob('brightness', { label: 'String brightness', color: '#ffd23f' })]),
        card('ATTACK', '#ff4fd8', [knob('samplePunch', { label: 'Pick punch', color: '#ff4fd8' }), knob('sampleVelTone', { label: 'Velocity → bright', color: '#ff4fd8' }), knob('sampleVelCurve', { label: 'Dynamics', color: '#ff4fd8' }), knob('hardness', { label: 'Hardness', color: '#ff4fd8' }), knob('attackNoise', { label: 'Pick click', color: '#ff4fd8' }), knob('pluckPos', { label: 'Pluck position', color: '#ff4fd8' })]),
        card('SUSTAIN & LEVEL', '#2bff88', [knob('sampleLevel', { label: 'Recordings level', color: '#2bff88' }), knob('layerMix', { label: 'Model layer', color: '#2bff88' }), knob('decayLow', { label: 'Sustain (low)', color: '#2bff88' }), knob('decayHigh', { label: 'Sustain (high)', color: '#2bff88' }), knob('sampleRelease', { label: 'Release noise', color: '#2bff88' }), knob('output', { label: 'Output', color: '#2bff88' })])
      ])
    );
  }
  function loadUserLibrary() {
    const inp = el('input', { type: 'file' }); inp.setAttribute('webkitdirectory', ''); inp.multiple = true;
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => /\.(sfz|wav|flac|ogg|mp3)$/i.test(f.name));
      if (!files.length) return SDAW.toast('⚠ No .sfz / audio files in that folder');
      SDAW.toast('Reading ' + files.length + ' files…');
      try {
        await RG().storeUserLibrary(model(), files);
        setMany({ sampleLib: 'My library (folder)', engine: S().engine === 'Physical model' ? 'Real samples' : S().engine }, 'my library');
      } catch (e) { SDAW.toast('⚠ Could not store the library: ' + e.message); }
    };
    inp.click();
  }

  /* ---------------------------------------------- guitar illustration (SVG) */
  // A stylized drawing of the selected guitar. Electric: the pickups are clickable and
  // light up with the selector. Acoustic: the microphone positions are clickable.
  const FINISH = {
    nylon: { body: ['#e8c48a', '#b7813f'], edge: '#5a3412', guard: null, top: '#d9ab66' },
    steel: { body: ['#f0c27a', '#8a4a17'], edge: '#2b1608', guard: '#1d120c', top: '#e2a85c' },
    strat: { body: ['#e8453c', '#7a0f14'], edge: '#3a0508', guard: '#f4f1ea', top: '#c62a2a' },
    lespaul: { body: ['#f2c54a', '#7a3d0c'], edge: '#f4ead4', guard: '#f0e3c0', top: '#e0a42c' },
    hollow: { body: ['#f0b25a', '#5a2408'], edge: '#f4ead4', guard: '#1a120c', top: '#d58a34' }
  };
  function guitarArt(t, kind) {
    const m = model(), s = S(), T = TYPE(), F = FINISH[m], elc = T.cat === 'electric';
    const W = 940, H = 340, BX = 150, SCALE = 700, NUT = BX + SCALE, cy = 170;
    const kids = [];
    const grad = 'rgBody' + m;
    kids.push(svg('defs', {}, [
      svg('radialGradient', { id: grad, cx: '35%', cy: '40%', r: '75%' }, [svg('stop', { offset: '0%', 'stop-color': F.body[0] }), svg('stop', { offset: '100%', 'stop-color': F.body[1] })]),
      svg('linearGradient', { id: 'rgNeck', x1: 0, y1: 0, x2: 0, y2: 1 }, [svg('stop', { offset: '0%', 'stop-color': '#6b3e1e' }), svg('stop', { offset: '100%', 'stop-color': '#3a1f0c' })]),
      svg('filter', { id: 'rgGlow' }, [svg('feGaussianBlur', { stdDeviation: 4, result: 'b' }), svg('feMerge', {}, [svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })])])
    ]));
    // body silhouettes (stylized, generic)
    const BODY = {
      nylon: 'M40 170 C40 90 120 70 190 92 C240 106 262 118 300 112 C360 100 420 92 448 128 C468 152 468 188 448 212 C420 248 360 240 300 228 C262 222 240 234 190 248 C120 270 40 250 40 170 Z',
      steel: 'M30 170 C30 80 120 56 196 84 C246 102 270 114 306 108 C372 96 440 86 468 126 C490 156 490 184 468 214 C440 254 372 244 306 232 C270 226 246 238 196 256 C120 284 30 260 30 170 Z',
      strat: 'M52 170 C52 104 96 82 150 96 C200 110 222 76 262 56 C290 44 318 54 300 84 C290 102 300 118 340 120 C380 122 400 108 420 96 C448 82 470 96 452 120 C438 140 436 158 446 170 C436 182 438 200 452 220 C470 244 448 258 420 244 C400 232 380 218 340 220 C300 222 290 238 300 256 C318 286 290 296 262 284 C222 264 200 230 150 244 C96 258 52 236 52 170 Z',
      lespaul: 'M44 170 C44 92 110 70 180 84 C232 96 262 92 296 84 C330 76 360 74 378 96 C394 116 380 132 404 140 C440 150 452 160 452 170 C452 216 418 250 360 254 C310 258 280 248 240 258 C176 274 44 262 44 170 Z',
      hollow: 'M30 170 C30 76 112 52 190 78 C236 94 262 98 300 92 C360 82 430 80 462 118 C480 140 470 152 446 156 C470 164 488 172 482 196 C470 248 400 262 330 250 C290 244 260 246 210 260 C120 286 30 264 30 170 Z'
    };
    kids.push(svg('path', { d: BODY[m], fill: 'url(#' + grad + ')', stroke: F.edge, 'stroke-width': 4 }));
    if (!elc) {
      // soundhole + rosette, bridge
      const sh = BX + 0.27 * SCALE;
      kids.push(svg('circle', { cx: sh, cy, r: 40, fill: 'none', stroke: '#3a2410', 'stroke-width': 7, opacity: 0.7 }));
      kids.push(svg('circle', { cx: sh, cy, r: 32, fill: '#120a05' }));
      if (F.guard) kids.push(svg('path', { d: 'M' + (sh + 26) + ' ' + (cy + 30) + ' C' + (sh + 60) + ' ' + (cy + 40) + ' ' + (sh + 70) + ' ' + (cy + 80) + ' ' + (sh + 20) + ' ' + (cy + 82) + ' C' + (sh - 10) + ' ' + (cy + 70) + ' ' + (sh + 10) + ' ' + (cy + 44) + ' ' + (sh + 26) + ' ' + (cy + 30) + 'Z', fill: F.guard, opacity: 0.85 }));
      kids.push(svg('rect', { x: BX - 18, y: cy - 40, width: 26, height: 80, rx: 6, fill: '#2a170a' }));
    } else {
      if (m === 'strat') kids.push(svg('path', { d: 'M120 120 C150 100 230 104 300 120 C360 132 400 140 410 170 C400 200 360 208 300 220 C230 236 150 240 120 220 C100 200 100 140 120 120 Z', fill: F.guard, opacity: 0.95 }));
      if (m === 'hollow') ['M' + (BX + 40) + ' 100 c 14 18 -14 38 0 56', 'M' + (BX + 40) + ' 240 c 14 -18 -14 -38 0 -56'].forEach(d => kids.push(svg('path', { d, fill: 'none', stroke: '#120a05', 'stroke-width': 7, 'stroke-linecap': 'round' })));
      kids.push(svg('rect', { x: BX - 12, y: cy - 36, width: 18, height: 72, rx: 4, fill: '#bfc3c9', stroke: '#7d828a' }));
    }
    // neck, frets, headstock
    kids.push(svg('rect', { x: BX + SCALE * 0.38, y: cy - 26, width: SCALE * 0.62 + 6, height: 52, fill: 'url(#rgNeck)' }));
    for (let f = 1; f <= 20; f++) { const x = NUT - SCALE * (1 - Math.pow(2, -f / 12)); if (x > BX + SCALE * 0.38) kids.push(svg('line', { x1: x, y1: cy - 26, x2: x, y2: cy + 26, stroke: '#c9c2b4', 'stroke-width': 2 })); }
    [3, 5, 7, 9, 15, 17, 19].forEach(f => { const x = NUT - SCALE * (1 - Math.pow(2, -(f - 0.5) / 12)); if (x > BX + SCALE * 0.38) kids.push(svg('circle', { cx: x, cy, r: 3.5, fill: '#e8e2d4', opacity: 0.8 })); });
    kids.push(svg('path', { d: 'M' + NUT + ' ' + (cy - 30) + ' L' + (NUT + 70) + ' ' + (cy - 40) + ' L' + (NUT + 76) + ' ' + (cy + 40) + ' L' + NUT + ' ' + (cy + 30) + ' Z', fill: '#2a1608', stroke: '#140a04' }));
    // pickups (electric): neck / middle / bridge at their real position on the scale
    if (elc) {
      const PT = GL.PICKUP_TYPES[s.pickupType] || GL.PICKUP_TYPES['Single coil'], hum = PT.width > 0;
      const sel = GL.pickupSel(m, s.pickupSel);
      const on = { 'Neck': ['neck'], 'Neck + Middle': ['neck', 'mid'], 'Middle': ['mid'], 'Middle + Bridge': ['mid', 'bridge'], 'Bridge': ['bridge'], 'Both': ['neck', 'bridge'] }[sel] || [];
      const pups = [['neck', s.posNeck, 'Neck']].concat(m === 'strat' ? [['mid', s.posMid, 'Middle']] : []).concat([['bridge', s.posBridge, 'Bridge']]);
      pups.forEach(([k, pos, name]) => {
        const x = BX + pos * SCALE, lit = on.includes(k), w = hum ? 34 : 20, h = hum ? 78 : 74;
        const gEl = svg('g', { class: 'rg-pu' + (lit ? ' lit' : ''), transform: 'translate(' + x + ' ' + cy + ')' });
        gEl.appendChild(svg('rect', { x: -w / 2 - 3, y: -h / 2 - 3, width: w + 6, height: h + 6, rx: 6, class: 'rg-pu-glow' }));
        gEl.appendChild(svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: hum ? 4 : 9, fill: hum ? (m === 'lespaul' ? '#e9dfc4' : '#1b1b1f') : '#f2efe6', stroke: '#555' }));
        for (let i = 0; i < 6; i++) {
          const py = -h / 2 + 9 + i * (h - 18) / 5;
          if (hum) { gEl.appendChild(svg('circle', { cx: -8, cy: py, r: 3, fill: '#c8c8c8' })); gEl.appendChild(svg('circle', { cx: 8, cy: py, r: 3, fill: '#8a8a8a' })); }
          else gEl.appendChild(svg('circle', { cx: 0, cy: py, r: 3, fill: '#9a9a9a' }));
        }
        gEl.appendChild(svg('text', { x: 0, y: h / 2 + 22, 'text-anchor': 'middle', class: 'rg-pu-lab' }, name));
        gEl.style.cursor = 'pointer';
        gEl.addEventListener('click', () => setOnce('pickupSel', GL.pickupSel(m, name === 'Middle' ? 'Middle' : name), 'pickup selector'));
        kids.push(gEl);
      });
    }
    // strings
    for (let i = 0; i < 6; i++) {
      const yb = cy - 22 + i * 8.8, yn = cy - 18 + i * 7.2;
      kids.push(svg('line', { x1: BX - 6, y1: yb, x2: NUT + 60, y2: yn, stroke: i < 3 ? '#d8c79a' : '#e9e9ef', 'stroke-width': i < 3 ? 2.2 - i * 0.3 : 1.2, opacity: 0.95 }));
    }
    // microphones (acoustic)
    if (!elc && kind !== 'mini') {
      const spots = { '12th fret': BX + 0.5 * SCALE, 'Soundhole': BX + 0.27 * SCALE, 'Bridge': BX + 0.02 * SCALE, 'Stereo pair (room)': BX + 0.2 * SCALE };
      const dy = 120 + s.micDistance * 30;
      Object.keys(spots).forEach(name => {
        const x = spots[name], lit = s.micPos === name, room = name === 'Stereo pair (room)';
        const g2 = svg('g', { class: 'rg-mic' + (lit ? ' lit' : ''), transform: 'translate(' + x + ' ' + (cy + (room ? dy + 18 : dy)) + ')' });
        const draw1 = dx => { g2.appendChild(svg('line', { x1: dx, y1: 0, x2: dx, y2: 40, stroke: '#888', 'stroke-width': 3 })); g2.appendChild(svg('rect', { x: dx - 7, y: -24, width: 14, height: 26, rx: 7, class: 'rg-mic-head' })); };
        if (room) { draw1(-30); draw1(30); } else draw1(0);
        g2.appendChild(svg('text', { x: 0, y: 58, 'text-anchor': 'middle', class: 'rg-pu-lab' }, name));
        g2.style.cursor = 'pointer';
        g2.addEventListener('click', () => setOnce('micPos', name, 'mic position'));
        kids.push(g2);
        if (lit && !room) kids.push(svg('line', { x1: x, y1: cy + dy - 26, x2: x, y2: cy + 30, class: 'rg-mic-beam' }));
      });
    }
    return svg('svg', { class: 'rig-gtr', viewBox: '0 0 ' + W + ' ' + (elc || kind === 'mini' ? H : H + 130), preserveAspectRatio: 'xMidYMid meet' }, kids);
  }

  /* ====================================================== TAB: PICKUPS == */
  function tabPickups(body, t, T) {
    const s = S(), m = model();
    const sel = GL.pickupSel(m, s.pickupSel);
    const switchBox = el('div', { class: 'pu-switch' }, T.pickups.map((name, i) => el('button', {
      class: 'pu-pos' + (name === sel ? ' on' : ''), 'data-help': 'Pickup selector: ' + name,
      onclick: () => setOnce('pickupSel', name, 'pickup selector')
    }, [el('span', { class: 'pu-led' }), el('b', {}, String(i + 1)), el('small', {}, name)])));
    body.append(
      el('div', { class: 'rig-col rig-art' }, [guitarArt(t, 'full'), el('div', { class: 'rig-hint' }, 'Click a pickup on the guitar or a position of the selector. On the real recordings the pickups change the tone the way they would on the instrument.')]),
      el('div', { class: 'rig-col rig-cards' }, [
        card(T.pickups.length === 5 ? '5-WAY SELECTOR' : '3-WAY TOGGLE', '#22e0ff', [switchBox], 'wide'),
        card('PICKUP TYPE', '#ff4fd8', [segs('pickupType', PARAM.pickupType.options, {
          set: v => { const PT = GL.PICKUP_TYPES[v]; setMany({ pickupType: v, pickupRes: PT.res, pickupQ: PT.q, pickupOut: PT.out }, 'pickup type ' + v); }
        })], 'wide'),
        card('GUITAR KNOBS', '#ffd23f', [knob('volumeKnob', { cls: 'big chrome', label: 'Volume', color: '#e8e8f0' }), knob('toneKnob', { cls: 'big chrome', label: 'Tone', color: '#e8e8f0' }), knob('trebleBleed', { label: 'Treble bleed', color: '#ffd23f' })]),
        card('PICKUP ELECTRICS', '#9b5cff', [knob('pickupRes', { label: 'Resonance', color: '#b98cff' }), knob('pickupQ', { label: 'Peak (Q)', color: '#b98cff' }), knob('pickupOut', { label: 'Output', color: '#b98cff' }),
          knob('posNeck', { label: 'Neck position', color: '#b98cff' }), m === 'strat' ? knob('posMid', { label: 'Middle position', color: '#b98cff' }) : null, knob('posBridge', { label: 'Bridge position', color: '#b98cff' })])
      ])
    );
  }

  /* =================================================== TAB: MICROPHONE == */
  function tabMic(body, t) {
    body.append(
      el('div', { class: 'rig-col rig-art' }, [guitarArt(t, 'full'), el('div', { class: 'rig-hint' }, 'Click a microphone to move it. Closer = more bass and detail, farther = more room and air.')]),
      el('div', { class: 'rig-col rig-cards' }, [
        card('MICROPHONE', '#22e0ff', [segs('micPos', PARAM.micPos.options), el('div', { class: 'rig-knobs' }, [knob('micDistance', { cls: 'big', label: 'Distance', color: '#22e0ff' })])], 'wide'),
        card('UNDER-SADDLE PIEZO', '#ff9f2e', [knob('piezoBlend', { cls: 'big', label: 'Piezo blend', color: '#ff9f2e' }), knob('piezoQuack', { label: 'Piezo quack', color: '#ff9f2e' })]),
        card('BODY (string model)', '#2bff88', [knob('bodyMix', { label: 'Resonance', color: '#2bff88' }), knob('bodyDetail', { label: 'Wood detail', color: '#2bff88' }), knob('bodySize', { label: 'Size', color: '#2bff88' }),
          knob('bodyDiff', { label: 'Wood density', color: '#2bff88' }), knob('airFreq', { label: 'Air resonance', color: '#2bff88' }), knob('bodyLow', { label: 'Body lows', color: '#2bff88' }), knob('bodyBright', { label: 'Body brilliance', color: '#2bff88' })])
      ])
    );
  }

  /* ========================================================= TAB: AMP == */
  // colour schemes of the 3D amplifier (generic finishes, no brand trade dress)
  const AMP_LOOK = {
    'NAM · Fender Deluxe Reverb': { tolex: '#16161a', panel: '#111114', text: '#e8e8f0', grille: 'silver', jewel: '#ff3b3b', nick: 'DELUXE 22' },
    'NAM · Roland JC-120': { tolex: '#1b1b1d', panel: '#3a3b40', text: '#f2f2f2', grille: 'black', jewel: '#2bff88', nick: 'JAZZ CHORUS' },
    'NAM · Vox AC10': { tolex: '#3a2214', panel: '#8a5428', text: '#fff2dc', grille: 'diamond', jewel: '#ff4b2b', nick: 'AC-10 TOP BOOST' },
    'NAM · Marshall JCM800': { tolex: '#0f0f10', panel: '#c9a227', text: '#1a1405', grille: 'black', jewel: '#ff2b2b', nick: 'BRIT 800' },
    'NAM · Dumble ODS': { tolex: '#0d0d0e', panel: '#2a1016', text: '#f4d9a8', grille: 'wheat', jewel: '#ffb02e', nick: 'OVERDRIVE SPECIAL' },
    'NAM · EVH 5153 (high gain)': { tolex: '#0a0a0b', panel: '#15151a', text: '#ff4f5e', grille: 'black', jewel: '#ff3b5c', nick: '5153 HIGH GAIN' },
    'Direct (DI)': { tolex: '#3a3d46', panel: '#555a66', text: '#fff', grille: 'none', jewel: '#22e0ff', nick: 'DIRECT BOX' },
    'Clean (Twin)': { tolex: '#16161a', panel: '#c0c4cc', text: '#111', grille: 'silver', jewel: '#ff3b3b', nick: 'TWIN CLEAN' },
    'Jazz (JC)': { tolex: '#1b1b1d', panel: '#3a3b40', text: '#fff', grille: 'black', jewel: '#2bff88', nick: 'JAZZ' },
    'Tweed (Bluesy)': { tolex: '#c9b27a', panel: '#2a1a10', text: '#f0e0b0', grille: 'wheat', jewel: '#ff8a2b', nick: 'TWEED' },
    'British Crunch': { tolex: '#101011', panel: '#c9a227', text: '#1a1405', grille: 'black', jewel: '#ff2b2b', nick: 'BRIT CRUNCH' },
    'Hi-Gain': { tolex: '#0a0a0b', panel: '#15151a', text: '#ff4fd8', grille: 'black', jewel: '#ff4fd8', nick: 'HI-GAIN' }
  };
  const CAB_LAYOUT = { 'None (DI)': 0, '1x12 Open': 1, '2x12 Open': 2, '4x12 Closed': 4, 'Jazz 1x15': 1.5, 'IR · Celestion (real cab)': 2, 'IR · Eminence (real cab)': 1, 'IR · Mesa 4x12 (real cab)': 4 };
  function box3d(cls, w, h, d, faces) {
    // faces: { front, back, left, right, top, bottom } → elements / classes
    const f = (name, fw, fh, tr, kid) => el('div', { class: 'face ' + name, style: { width: fw + 'px', height: fh + 'px', transform: tr } }, kid || null);
    return el('div', { class: 'box3d ' + cls, style: { width: w + 'px', height: h + 'px' } }, [
      f('front', w, h, 'translateZ(' + d / 2 + 'px)', faces.front),
      f('back', w, h, 'rotateY(180deg) translateZ(' + d / 2 + 'px)'),
      f('left', d, h, 'translateX(' + (w - d) / 2 + 'px) rotateY(-90deg) translateZ(' + w / 2 + 'px)'),
      f('right', d, h, 'translateX(' + (w - d) / 2 + 'px) rotateY(90deg) translateZ(' + w / 2 + 'px)'),
      f('top', w, d, 'translateY(' + (h - d) / 2 + 'px) rotateX(90deg) translateZ(' + h / 2 + 'px)', faces.top),
      f('bottom', w, d, 'translateY(' + (h - d) / 2 + 'px) rotateX(-90deg) translateZ(' + h / 2 + 'px)')
    ]);
  }
  function tabAmp(body, t) {
    const s = S(), A = GL.AMPS[s.ampModel] || {}, look = AMP_LOOK[s.ampModel] || AMP_LOOK['Clean (Twin)'];
    const nam = !!A.nam && GL.namAvailable();
    const ampNames = Object.keys(GL.AMPS);
    const cycle = d => { const i = ampNames.indexOf(s.ampModel); setOnce('ampModel', ampNames[(i + d + ampNames.length) % ampNames.length], 'amp model'); };
    const chrome = (id, label) => knob(id, { cls: 'chrome', label, color: look.text });
    // ---- amp head front panel
    const front = el('div', { class: 'amp-front', style: { '--tolex': look.tolex, '--panel': look.panel, '--ptext': look.text } }, [
      el('div', { class: 'amp-logo' }, [el('b', {}, 'ScoreDAW'), el('small', {}, look.nick)]),
      el('div', { class: 'amp-panel' }, [
        el('div', { class: 'amp-jack', 'data-help': 'Input' }),
        chrome(nam ? 'namInput' : 'gain', nam ? 'Drive' : 'Gain'),
        chrome('bass', 'Bass'), chrome('mid', 'Middle'), chrome('treble', 'Treble'), chrome('presence', 'Presence'), chrome('master', 'Master'),
        el('div', { class: 'amp-display', 'data-help': 'Amplifier model — ◀ ▶ to change. "NAM" = captured from a real amp (Neural Amp Modeler)' }, [
          el('button', { onclick: () => cycle(-1) }, '◀'),
          el('div', { class: 'amp-lcd' }, [el('small', {}, nam ? 'REAL AMP · NAM' : A.nam ? 'NAM (needs the packs)' : 'BUILT-IN MODEL'), el('b', {}, s.ampModel.replace('NAM · ', ''))]),
          el('button', { onclick: () => cycle(1) }, '▶')
        ]),
        el('div', { class: 'amp-jewel', style: { '--jw': look.jewel } })
      ])
    ]);
    const head = box3d('amp-head', 760, 190, 200, { front });
    // ---- cabinet with speakers + microphone
    const n = CAB_LAYOUT[s.cab] === undefined ? 2 : CAB_LAYOUT[s.cab];
    const grille = el('div', { class: 'cab-grille g-' + look.grille, style: { '--tolex': look.tolex } });
    const spk = [];
    if (n === 4) [[0.27, 0.28], [0.73, 0.28], [0.27, 0.72], [0.73, 0.72]].forEach(p => spk.push(p.concat([0.165])));
    else if (n === 2) [[0.27, 0.5], [0.73, 0.5]].forEach(p => spk.push(p.concat([0.21])));
    else if (n === 1.5) spk.push([0.5, 0.5, 0.31]);
    else if (n === 1) spk.push([0.5, 0.5, 0.26]);
    const CW = 760, CH = n === 4 ? 460 : 360;
    spk.forEach(([x, y, r]) => grille.appendChild(el('div', { class: 'cab-spk', style: { left: (x * CW - r * CW) + 'px', top: (y * CH - r * CW) + 'px', width: 2 * r * CW + 'px', height: 2 * r * CW + 'px' } }, [el('i')])));
    if (spk.length) {
      const [x, y, r] = spk[0];
      const MIC = { 'On-axis': [0, 0.2], 'Off-axis': [0.66, 0.35], 'Ribbon': [-0.66, 1.3] };
      Object.keys(MIC).forEach(name => {
        const [dx, dz] = MIC[name], on = s.cabMic === name;
        grille.appendChild(el('button', {
          class: 'cab-mic' + (on ? ' on' : '') + (name === 'Ribbon' ? ' ribbon' : ''), 'data-help': 'Cabinet microphone: ' + name + (GL.CABS[s.cab] && GL.CABS[s.cab].ir ? ' (the real cabinet IRs already contain their microphone)' : ''),
          style: { left: (x * CW + dx * r * CW - 16) + 'px', top: (y * CH - 16) + 'px', transform: 'translateZ(' + (20 + dz * 60) + 'px)' },
          onclick: () => setOnce('cabMic', name, 'cabinet mic')
        }, el('span', {}, name)));
      });
    } else grille.appendChild(el('div', { class: 'cab-di' }, 'DI — no cabinet'));
    const cab = box3d('amp-cab', CW, CH, 280, { front: grille });
    head.style.setProperty('--tolex', look.tolex); cab.style.setProperty('--tolex', look.tolex);
    const sceneTf = () => 'scale(0.8) rotateX(' + P.rot.x + 'deg) rotateY(' + P.rot.y + 'deg)';
    const scene = el('div', { class: 'amp-scene', style: { transform: sceneTf() } }, [head, cab]);
    const stage = el('div', { class: 'amp-stage', 'data-help': 'Drag the background to turn the amplifier · drag a knob up / down to set it' }, [scene]);
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('.rk, button, select')) return;
      e.preventDefault(); stage.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY, r0 = Object.assign({}, P.rot);
      const mv = ev => {
        P.rot.y = clamp(r0.y + (ev.clientX - x0) / scale() * 0.35, -60, 60);
        P.rot.x = clamp(r0.x - (ev.clientY - y0) / scale() * 0.25, -30, 20);
        scene.style.transform = sceneTf();
      };
      const up = () => { stage.removeEventListener('pointermove', mv); stage.removeEventListener('pointerup', up); savePos(); };
      stage.addEventListener('pointermove', mv); stage.addEventListener('pointerup', up);
    });
    stage.addEventListener('dblclick', e => { if (e.target.closest('.rk, button')) return; P.rot = { x: -8, y: -24 }; scene.style.transform = sceneTf(); savePos(); });
    body.append(
      el('div', { class: 'rig-col amp-col' }, [stage]),
      el('div', { class: 'rig-col rig-cards amp-side' }, [
        card('AMPLIFIER', '#ff4fd8', [choice('ampModel', { label: 'Model' }),
          el('div', { class: 'rig-hint' }, nam ? 'A capture of a real amplifier (Neural Amp Modeler): Drive = how hard the guitar hits it. Bass / Middle / Treble / Presence / Master shape it after.' : A.nam ? 'This real-amp capture needs its files (tools/guitar-lab/packs or the local server): the built-in model plays meanwhile.' : 'Built-in amp model: Gain drives two tube-style stages.'),
          el('div', { class: 'rig-knobs' }, [knob('output', { label: 'Output', cls: 'small' })])], 'wide'),
        card('CABINET', '#22e0ff', [choice('cab', { label: 'Cabinet' }), segs('cabMic', PARAM.cabMic.options),
          el('div', { class: 'rig-hint' }, GL.CABS[s.cab] && GL.CABS[s.cab].ir ? 'Impulse response of a real cabinet + microphone.' : s.cab === 'None (DI)' ? 'No cabinet: the amp goes straight to the mix.' : 'Filter model of a cabinet.')], 'wide'),
        card('AMP REVERB', '#2bff88', [choice('reverbType', { label: 'Type' }), el('div', { class: 'rig-knobs' }, [knob('reverbMix', { label: 'Reverb', color: '#2bff88' }), knob('reverbSize', { label: 'Time', color: '#2bff88' })])], 'wide')
      ])
    );
  }

  /* ========================================================== TAB: EQ == */
  let curveCanvas = null;
  function tabEQ(body) {
    curveCanvas = el('canvas', { class: 'eq-curve', width: 1380, height: 230 });
    const bands = [['eqLow', '90 Hz'], ['eqLowMid', '250 Hz'], ['eqMid', '800 Hz'], ['eqUpMid', '2 kHz'], ['eqPres', '4.5 kHz'], ['eqAir', '10 kHz']];
    body.append(
      el('div', { class: 'eq-top' }, [curveCanvas]),
      el('div', { class: 'eq-row' }, [
        card('GRAPHIC EQ', '#ffd23f', bands.map(([id, l]) => fader(id, l)), 'eq-bands'),
        card('CHARACTER', '#ff4fd8', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f', onLive: drawCurve }), knob('thickness', { label: 'Thickness', color: '#ff4fd8', onLive: drawCurve }),
          knob('mudCut', { label: 'Mud cut', color: '#ff4fd8', onLive: drawCurve }), knob('harshCut', { label: 'Harshness cut', color: '#ff4fd8', onLive: drawCurve }), knob('harshFreq', { label: 'Harsh freq', color: '#ff4fd8', onLive: drawCurve })]),
        card('CUTS', '#22e0ff', [knob('lowCut', { label: 'Low cut', color: '#22e0ff', onLive: drawCurve }), knob('highCut', { label: 'High cut', color: '#22e0ff', onLive: drawCurve })])
      ])
    );
  }
  let eqCtx = null;
  /** the EQ curve: the same filters as the engine, measured with getFrequencyResponse */
  function drawCurve() {
    if (!curveCanvas || !curveCanvas.isConnected) return;
    const s = S(), g = curveCanvas.getContext('2d'), W = curveCanvas.width, H = curveCanvas.height;
    if (!eqCtx) { try { eqCtx = new OfflineAudioContext(1, 128, 48000); } catch (e) { return; } }
    const B = (type, f, q, gain) => { const b = eqCtx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
    const list = [B('lowshelf', 90, 0.7, s.eqLow), B('peaking', 250, 1, s.eqLowMid), B('peaking', 800, 0.9, s.eqMid), B('peaking', 2000, 1, s.eqUpMid), B('peaking', 4500, 1.1, s.eqPres), B('highshelf', 10000, 0.7, s.eqAir),
      B('lowshelf', 400, 0.6, -s.tilt * 5), B('highshelf', 2500, 0.6, s.tilt * 6), B('peaking', 170, 0.8, s.thickness * 8), B('peaking', 320, 1.2, -s.mudCut * 10), B('peaking', s.harshFreq, 2.2, -s.harshCut * 12),
      B('highpass', s.lowCut, 0.7, 0), B('lowpass', s.highCut, 0.7, 0)];
    const N = 300, fr = new Float32Array(N), mag = new Float32Array(N), ph = new Float32Array(N), tot = new Float32Array(N).fill(0);
    for (let i = 0; i < N; i++) fr[i] = 20 * Math.pow(1000, i / (N - 1));
    list.forEach(b => { b.getFrequencyResponse(fr, mag, ph); for (let i = 0; i < N; i++) tot[i] += 20 * Math.log10(Math.max(1e-6, mag[i])); });
    g.clearRect(0, 0, W, H);
    const y = db => H / 2 - db / 18 * (H / 2 - 12);
    g.strokeStyle = 'rgba(150,130,255,.16)'; g.lineWidth = 1; g.font = '12px Segoe UI'; g.fillStyle = 'rgba(200,200,255,.5)';
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => { const x = Math.log(f / 20) / Math.log(1000) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x + 3, H - 4); });
    [-12, -6, 0, 6, 12].forEach(d => { g.beginPath(); g.moveTo(0, y(d)); g.lineTo(W, y(d)); g.stroke(); g.fillText((d > 0 ? '+' : '') + d + ' dB', 4, y(d) - 3); });
    const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#ff9f2e'); grad.addColorStop(0.5, '#ffd23f'); grad.addColorStop(1, '#22e0ff');
    g.beginPath();
    for (let i = 0; i < N; i++) { const x = i / (N - 1) * W, yy = y(clamp(tot[i], -20, 20)); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.strokeStyle = grad; g.lineWidth = 3; g.shadowColor = '#ffd23f'; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
    g.lineTo(W, y(0)); g.lineTo(0, y(0)); g.closePath(); g.fillStyle = 'rgba(255,210,63,.08)'; g.fill();
  }

  /* ========================================================== TAB: FX == */
  function tabFX(body) {
    body.append(el('div', { class: 'rig-cards fx-grid' }, [
      card('COMPRESSOR', '#36f1cd', [knob('comp', { cls: 'big', label: 'Amount', color: '#36f1cd' })]),
      card('CHORUS', '#3fa9ff', [knob('chorusMix', { label: 'Mix', color: '#3fa9ff' }), knob('chorusRate', { label: 'Rate', color: '#3fa9ff' }), knob('chorusDepth', { label: 'Depth', color: '#3fa9ff' })]),
      card('DELAY', '#9b5cff', [knob('delayMix', { label: 'Mix', color: '#b98cff' }), knob('delayTime', { label: 'Time', color: '#b98cff' }), knob('delayFeedback', { label: 'Repeats', color: '#b98cff' })]),
      card('REVERB', '#2bff88', [choice('reverbType', { label: 'Type' }), el('div', { class: 'rig-knobs' }, [knob('reverbMix', { label: 'Mix', color: '#2bff88' }), knob('reverbSize', { label: 'Time', color: '#2bff88' }), knob('predelay', { label: 'Pre-delay', color: '#2bff88' })])], 'wide'),
      card('ANALOG & STEREO', '#ff9f2e', [knob('saturation', { label: 'Warmth', color: '#ff9f2e' }), knob('width', { label: 'Stereo width', color: '#ff9f2e' }), knob('stringSpread', { label: 'String spread', color: '#ff9f2e' })]),
      card('OUTPUT', '#ff4fd8', [knob('output', { cls: 'big', label: 'Level', color: '#ff4fd8' })])
    ]));
  }

  /* ======================================================== TAB: PLAY == */
  function tabPlay(body) {
    body.append(el('div', { class: 'rig-cards fx-grid' }, [
      card('STRUMS', '#ffd23f', [knob('strumSpeed', { cls: 'big', label: 'Strum speed', color: '#ffd23f' })]),
      card('HUMAN FEEL', '#ff4fd8', [knob('humanTime', { label: 'Timing', color: '#ff4fd8' }), knob('humanVel', { label: 'Dynamics', color: '#ff4fd8' }), knob('squeak', { label: 'String squeaks', color: '#ff4fd8' }), knob('squeakProb', { label: 'Squeak chance', color: '#ff4fd8' })]),
      card('MUTING', '#22e0ff', [knob('palmMute', { label: 'Palm mute', color: '#22e0ff' }), knob('releaseTime', { label: 'Finger release', color: '#22e0ff' })]),
      card('VIBRATO', '#9b5cff', [knob('vibDepth', { label: 'Depth', color: '#b98cff' }), knob('vibRate', { label: 'Rate', color: '#b98cff' }), knob('vibDelay', { label: 'Delay', color: '#b98cff' })]),
      card('LEGATO', '#2bff88', [knob('legatoLevel', { label: 'Hammer / pull-off level', color: '#2bff88' })]),
      card('TUNING', '#ff9f2e', [choice('tuning', { label: 'Open strings' }), el('div', { class: 'rig-knobs' }, [knob('a4', { label: 'A4 reference', color: '#ff9f2e' })])]),
      el('div', { class: 'rig-hint wide' }, 'Techniques written in the score / tab play for real: hammer-on, pull-off, tapping, slides (legato, shift, in / out), bends (up, release, pre-bend), vibrato and wide vibrato, palm mute, dead notes, natural and pinch harmonics, strums (string by string), let ring. Bend range and slide time: Inspector → Guitar Techniques.')
    ]));
  }

  /* ==================================================== TAB: ADVANCED == */
  function tabAdvanced(body) {
    const m = model();
    const searchBox = el('input', { type: 'search', class: 'adv-search', placeholder: 'Find a setting…', value: P.search, oninput: e => { P.search = e.target.value; renderAdvList(); } });
    const list = el('div', { class: 'adv-list' });
    function renderAdvList() {
      list.innerHTML = '';
      const qq = P.search.toLowerCase();
      GL.SECTIONS.forEach(([sec, title]) => {
        const ps = GL.PARAMS.filter(p => p.sec === sec && GL.paramFor(p, m) && (!qq || p.label.toLowerCase().includes(qq) || p.id.toLowerCase().includes(qq) || (p.tip || '').toLowerCase().includes(qq)));
        if (!ps.length) return;
        list.appendChild(el('div', { class: 'adv-sec' }, [el('h5', {}, title), el('div', { class: 'adv-grid' }, ps.map(p => advRow(p)))]));
      });
    }
    function advRow(p) {
      const cur = S()[p.id], changed = !(typeof cur === 'number' ? Math.abs(cur - fac(p.id)) < 1e-9 : cur === fac(p.id)), off = !acts(p.id, S());
      const val = el('span', { class: 'adv-val' }, fmt(p, cur));
      let ctl;
      if (p.options) ctl = el('select', { onchange: e => setOnce(p.id, e.target.value, p.label) }, p.options.map(x => el('option', { value: x, selected: x === cur ? true : null }, x)));
      else ctl = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur,
        onpointerdown: () => begin(),
        oninput: e => { const v = snap(p, +e.target.value); setV(p.id, v); val.textContent = fmt(p, v); row.classList.toggle('changed', Math.abs(v - fac(p.id)) > 1e-9); },
        onchange: () => end(p.label) });
      const row = el('div', { class: 'adv-row' + (changed ? ' changed' : '') + (off ? ' off' : ''), 'data-help': p.label + (p.tip ? ' — ' + p.tip : '') + (off ? ' · acts on the string model only' : '') }, [
        el('span', { class: 'adv-lab' }, [p.label, off ? el('i', {}, ' model') : null]), ctl, val,
        el('button', { class: 'adv-reset', 'data-help': 'Factory value: ' + fmt(p, fac(p.id)), onclick: () => setOnce(p.id, fac(p.id), p.label + ' (factory)') }, '↺')
      ]);
      return row;
    }
    renderAdvList();
    body.append(el('div', { class: 'adv-head' }, [searchBox, el('span', { class: 'rig-hint' }, 'Every Guitar Lab setting of the ' + TYPE().name + '. Highlighted = changed from the factory sound · ↺ = back to factory.')]), list);
  }

  /* ===================================================== SPECTRUM == */
  const fbuf = new Uint8Array(4096);
  function startScope() {
    cancelAnimationFrame(P.raf);
    const loop = () => {
      if (!P.isOpen()) return;
      P.raf = requestAnimationFrame(loop);
      const cv = P.win.querySelector('.rig-scope'), t = track(); if (!cv || !t) return;
      const an = RG().analyser(t), g = cv.getContext('2d'), W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(10,12,30,.6)'; g.fillRect(0, 0, W, H);
      if (!an) return;
      an.getByteFrequencyData(fbuf);
      const sr = an.context.sampleRate, bins = an.frequencyBinCount;
      g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const f = 40 * Math.pow(500, x / W), i = Math.min(bins - 1, Math.round(f / (sr / 2) * bins));
        const v = fbuf[i] / 255, y = H - v * (H - 4);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = '#22e0ff'; g.lineWidth = 1.6; g.shadowColor = '#22e0ff'; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    };
    loop();
  }

  /* ======================================================== EVENTS == */
  P.init = function () {
    GL.PARAMS.forEach(p => { PARAM[p.id] = p; });
    CONFIG.library.instruments.forEach(g => g.items.forEach(it => { if (it.engine === 'rig' && it.params && it.params.rig) MODEL_NAMES[it.params.rig] = it.name; }));
    SDAW.bus.on('change', () => { if (P.isOpen() && !editing) render(); });
    SDAW.bus.on('rig', e => {
      if (!P.isOpen() || !e || e.id !== P.trackId) return;
      const box = document.getElementById('rigStatus'), t = track();
      if (box && t) { box.innerHTML = ''; statusNodes(RG().status(t)).forEach(x => box.appendChild(x)); }
      const b = document.getElementById('rigTestBtn');
      if (b && t) { const on = RG().demoPlaying(t); b.textContent = on ? '■ Stop' : '▶ Test'; b.classList.toggle('on', on); }
    });
    SDAW.bus.on('transport', () => { const b = document.getElementById('rigPlayBtn'); if (b) b.textContent = SDAW.audio.playing ? '❚❚ Stop' : '▶ My part'; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && P.isOpen() && !document.getElementById('modalRoot').children.length) { P.close(); }
    });
  };
  if (window.GL && GL.PARAMS) document.addEventListener('DOMContentLoaded', () => P.init());
})(window.SDAW);
