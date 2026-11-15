/* =============================================================================
 *  PIANORIG-PANEL.JS — the Piano Rig window of a track (engine 'pianorig')
 *  -----------------------------------------------------------------------------
 *  Opens from: Inspector → Sound Slot "🎹 Open Piano Rig…", the 🎹 button or a
 *  double-click on the channel in the Pattern view, the track menu in the
 *  Arrange and the Generator view (F8).
 *
 *  A floating window like the Guitar Rig (drag its title bar; Space still plays):
 *    🎹 Instrument    instrument, sound source, colour, dynamics, pedal, level
 *    🧵 Strings       grand piano model: 1 / 2 / 3 strings per note (diagram),
 *                     unisons, hammer, sustain, soundboard
 *    🎛 E-Piano       Rhodes / Wurlitzer, suitcase panel (tone, vibrato), amp,
 *                     phaser, tines and pickups
 *    〰 Synth         oscillators, unison, filter, envelopes (drawn), LFO
 *    ⛪ Organ         drawbars, registrations, percussion, vibrato / chorus,
 *                     rotary speaker (3D cabinet, spins at the real speed)
 *    🎚 Tone EQ · 🌫 Effects · ⚙ Advanced (every Piano Lab setting)
 *  A keyboard at the bottom plays the track's instrument (with the sustain pedal).
 *  Every control changes the sound live; letting go keeps it (one undo step).
 * ============================================================================= */
(function (SDAW) {
  'use strict';
  const { el, svg } = SDAW;
  const PR = () => SDAW.pianoRig;
  const P = { trackId: null, tab: 'inst', win: null, demoId: {}, search: '', raf: 0, ped: false };
  SDAW.prigPanel = P;
  const PARAM = {};
  const LS_KEY = 'scoredaw.prigPanel';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const track = () => SDAW.store.track(P.trackId);
  const model = () => PR().model(track());
  const TYPE = () => PL.TYPES[model()];
  const S = () => PR().settings(track());
  const fac = id => PL.factory(model())[id];
  const scale = () => (SDAW.app && SDAW.app.scale) || 1;
  const MODEL_NAMES = { grand: 'Grand Piano', epiano: 'Electric Piano - Rhodes', synth: 'Synthesizer - Warm Poly', organ: 'Organ' };

  /* ============================================================ EDITING == */
  let editing = false;
  const begin = () => { if (!editing) { SDAW.store.beginEdit(); editing = true; } };
  const end = label => { if (!editing) return; editing = false; SDAW.store.endEdit('Piano Rig: ' + (label || 'setting')); };
  const setV = (id, v) => { const t = track(); if (!t) return; PR().setValue(t, id, v); PR().applyNow(t); };
  function setMany(obj, label) { begin(); Object.keys(obj).forEach(k => setV(k, obj[k])); end(label); }
  /** dimmed when it does nothing with the current sound source (recordings vs model) */
  function acts(id) {
    const p = PARAM[id]; if (!p) return true;
    const s = S(), m = TYPE().model;
    if (m !== 'piano' && m !== 'ep') return true;
    if (s.engine === 'Real samples') return (p.sec !== 'strings' && p.sec !== 'ep') || id === 'epTone';     // the tone control is on the amp chain
    if (s.engine === 'Physical model') return p.sec !== 'source' || ['engine', 'epModel', 'dynRange', 'damperTime', 'symRes', 'resTime'].includes(id);
    return true;
  }
  const UI = SDAW.rigUI.make({ param: id => PARAM[id], value: id => S()[id], fac, set: setV, begin, end, acts, offNote: 'acts on the model only (Sound source)' });
  const { knob, choice, segs, card, fader } = UI;
  const setOnce = (id, v, label) => UI.setOnce(id, v, label || (PARAM[id] && PARAM[id].label));
  /** only the knobs this instrument has */
  const K = (id, o) => PL.paramFor(PARAM[id], model()) ? knob(id, o) : null;

  /* ============================================================ WINDOW == */
  P.isOpen = () => !!(P.win && P.win.isConnected);
  P.open = function (trackId) {
    const t = SDAW.store.track(trackId || SDAW.store.sel.trackId);
    if (!t || !PR() || !PR().isRigTrack(t)) { SDAW.toast('Select a track that uses a Piano Rig instrument (Library → Pianos & Keys)'); return; }
    if (!PR().ok()) { SDAW.toast('⚠ The keyboard engine is not available in this browser (needs AudioWorklet: Chrome / Edge)'); return; }
    [SDAW.rigPanel, SDAW.wrigPanel].forEach(W => { if (W && W.isOpen && W.isOpen()) W.close(); });     // one rig window at a time
    P.trackId = t.id;
    try { const st = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (st) { P.pos = st.pos; P.tab = st.tab || P.tab; } } catch (e) { /* ignore */ }
    SDAW.audio.init(); SDAW.audio.updateTrack(t);
    if (!P.win || !P.win.isConnected) {
      P.win = el('div', { class: 'rig-win prig-win', id: 'prigWin' });
      let root = document.getElementById('floatRoot');
      if (!root) { root = el('div', { id: 'floatRoot' }); document.getElementById('app').appendChild(root); }
      root.appendChild(P.win);
    }
    render(); startAnim();
  };
  P.close = function () {
    if (P.win) P.win.remove();
    P.win = null; cancelAnimationFrame(P.raf);
    const t = track(); if (t && PR()) { PR().stopDemo(t); if (P.ped) PR().pedalNow(t, false); }
    P.ped = false;
  };
  function savePos() { try { localStorage.setItem(LS_KEY, JSON.stringify({ pos: P.pos, tab: P.tab })); } catch (e) { /* full */ } }
  function place() {
    const W = 1480, H = 900, app = document.getElementById('app');
    const aw = app ? app.offsetWidth : 1920, ah = app ? app.offsetHeight : 1080;
    if (!P.pos) P.pos = { x: Math.max(10, (aw - W) / 2), y: Math.max(10, (ah - H) / 2) };
    P.pos.x = clamp(P.pos.x, -W + 200, aw - 160); P.pos.y = clamp(P.pos.y, 0, ah - 60);
    P.win.style.left = P.pos.x + 'px'; P.win.style.top = P.pos.y + 'px';
  }
  function dragWindow(handle) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button, select, input, canvas')) return;
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY, p0 = Object.assign({}, P.pos);
      const mv = ev => { P.pos.x = p0.x + (ev.clientX - x0) / scale(); P.pos.y = p0.y + (ev.clientY - y0) / scale(); place(); };
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); savePos(); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
    });
  }

  /* ============================================================ RENDER == */
  const TABS = {
    grand: [['inst', '🎹 Instrument'], ['strings', '🧵 Strings (model)'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['adv', '⚙ Advanced']],
    epiano: [['inst', '🎹 Instrument'], ['ep', '🎛 Amp, vibrato & tines'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['adv', '⚙ Advanced']],
    synth: [['inst', '🎹 Instrument'], ['synth', '〰 Oscillators & filter'], ['env', '📈 Envelopes & LFO'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['adv', '⚙ Advanced']],
    organ: [['inst', '🎹 Instrument'], ['organ', '⛪ Drawbars & rotary'], ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['adv', '⚙ Advanced']]
  };
  function render() {
    if (!P.isOpen()) return;
    const t = track();
    if (!t || !PR().isRigTrack(t)) { P.close(); return; }
    const old = P.win.querySelector('.rig-body'), keepScroll = old ? old.scrollTop : 0;
    P.win.innerHTML = '';
    const m = model(), tabs = TABS[m];
    if (!tabs.some(x => x[0] === P.tab)) P.tab = 'inst';
    const head = el('div', { class: 'rig-head' }, [
      el('div', { class: 'rig-title' }, [el('b', {}, '🎹 PIANO RIG'), el('small', {}, t.name)]),
      el('div', { class: 'rig-models' }, PR().MODELS.map(id => {
        const MT = PL.TYPES[id];
        return el('button', { class: 'rig-model' + (id === m ? ' on' : ''), 'data-help': MT.name + ' — ' + MT.desc, onclick: () => switchModel(id) }, [el('span', { class: 'ico' }, MT.icon), el('span', {}, MT.short)]);
      })),
      el('span', { class: 'spacer' }),
      el('canvas', { class: 'rig-scope', width: 300, height: 46, 'data-help': 'Spectrum of this instrument (live)' }),
      el('button', { class: 'rig-x', 'data-help': 'Close (Esc)', onclick: P.close }, '✕')
    ]);
    dragWindow(head);
    // ---- presets, status, test phrase
    const presets = PR().presets(m), groups = {};
    presets.forEach(pr => { (groups[pr.group] = groups[pr.group] || []).push(pr); });
    const curDiff = JSON.stringify(PR().toDiff(m, S()));
    const match = presets.find(pr => JSON.stringify(PR().toDiff(m, PL.sanitize(m, Object.assign(PL.factory(m), pr.diff)))) === curDiff);
    const demos = PR().demos(m), demoId = P.demoId[m] || demos[0].id, playing = PR().demoPlaying(t);
    const bar = el('div', { class: 'rig-bar' }, [
      el('div', { class: 'rig-status', id: 'prigStatus' }, statusNodes(PR().status(t))),
      el('span', { class: 'spacer' }),
      el('select', { class: 'rig-preset', 'data-help': 'Sounds: the factory sound, your Piano Lab reference (★), the Piano Lab sounds and your own presets', onchange: e => applyPreset(presets.find(x => x.id === e.target.value)) },
        [match ? null : el('option', { value: '', selected: true }, '— custom —')].concat(Object.keys(groups).map(g => el('optgroup', { label: g },
          groups[g].map(pr => el('option', { value: pr.id, selected: match && match.id === pr.id ? true : null }, pr.name)))))),
      el('button', { class: 'btn small', 'data-help': 'Save the current sound as a preset of this instrument', onclick: savePreset }, '💾 Save…'),
      match && match.mine ? el('button', { class: 'btn small', 'data-help': 'Delete this preset', onclick: () => { PR().deletePreset(m, match.name); render(); } }, '🗑') : null,
      el('button', { class: 'btn small', 'data-help': 'Import your Piano Lab settings (piano-references.json or piano-lab-state.json)', onclick: importLab }, '⭳ Piano Lab…'),
      el('button', { class: 'btn small', 'data-help': 'Back to the factory sound of this instrument', onclick: () => { begin(); PR().reset(t); PR().applyNow(t); end('factory sound'); } }, '↺ Factory'),
      el('span', { class: 'sep' }),
      el('select', { class: 'rig-demo', 'data-help': 'Test phrase (the first ones suit this instrument best)', onchange: e => { P.demoId[m] = e.target.value; if (PR().demoPlaying(t)) testPhrase(true); } },
        demos.map((d, i) => el('option', { value: d.id, selected: d.id === demoId ? true : null }, (i < 2 ? '★ ' : '') + d.name))),
      el('button', { class: 'btn small' + (playing ? ' on' : ''), id: 'prigTestBtn', 'data-help': 'Play the test phrase with this sound (does not touch your song)', onclick: () => testPhrase() }, playing ? '■ Stop' : '▶ Test'),
      el('button', { class: 'btn small cyan', id: 'prigPlayBtn', 'data-help': 'Play / stop the song or pattern (Space)', onclick: () => SDAW.app.togglePlay() }, SDAW.audio.playing ? '❚❚ Stop' : '▶ My part')
    ]);
    const tabBar = el('div', { class: 'rig-tabs' }, tabs.map(([id, label]) => el('button', { class: 'rig-tab' + (P.tab === id ? ' on' : ''), onclick: () => { P.tab = id; savePos(); render(); } }, label)));
    const body = el('div', { class: 'rig-body prig-body rig-' + P.tab });
    ({ inst: tabInstrument, strings: tabStrings, ep: tabEP, synth: tabSynth, env: tabEnv, organ: tabOrgan, eq: tabEQ, fx: tabFX, adv: tabAdvanced }[P.tab])(body, t);
    P.win.append(head, bar, tabBar, body, keyboardStrip(t));
    place();
    body.scrollTop = keepScroll;
    if (P.tab === 'eq') drawCurve();
    if (P.tab === 'env') drawEnv();
  }
  const statusNodes = st => [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text)];

  function switchModel(id) {
    const t = track(); if (!t || id === model()) return;
    SDAW.store.mutate('Instrument ' + PL.TYPES[id].short, () => {
      t.params.prig = id; t.instrument = MODEL_NAMES[id];
      t.params.prigS = t.params.prigS || {};
      if (!t.params.prigS[id]) t.params.prigS[id] = PR().seed(id)[id];
      if (id === 'synth' && t.type === 'keys') t.type = 'synth';
      else if (id !== 'synth' && t.type === 'synth') t.type = 'keys';
      t.color = CONFIG.colors[t.type] || t.color;
    });
    SDAW.toast(PL.TYPES[id].icon + ' ' + PL.TYPES[id].name + (PL.TYPES[id].lib || id === 'epiano' ? ' — loading its recordings…' : ''));
  }
  function applyPreset(pr) { const t = track(); if (!t || !pr) return; begin(); PR().setDiff(t, pr.diff); PR().applyNow(t); end('sound ' + pr.name); SDAW.toast('🎹 ' + pr.name); }
  function savePreset() { SDAW.ask('Name of the preset (' + TYPE().short + ')', '', name => { PR().savePreset(model(), name, PR().toDiff(model(), S())); SDAW.toast('💾 Preset "' + name + '" saved'); render(); }); }
  function importLab() {
    const inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const got = PR().importLabFile(JSON.parse(await f.text()));
        if (!got.length) return SDAW.toast('⚠ No Piano Lab settings found in that file');
        const t = track();
        if (got.includes(model())) { begin(); PR().setDiff(t, PR().labReference(model())); PR().applyNow(t); end('Piano Lab reference'); }
        SDAW.toast('⭳ Piano Lab settings imported for: ' + got.map(x => PL.TYPES[x].short).join(', ') + ' (sound "★ My Piano Lab reference")');
        render();
      } catch (e) { SDAW.toast('⚠ Could not read the file: ' + e.message); }
    };
    inp.click();
  }
  async function testPhrase(restart) {
    const t = track(); if (!t) return;
    if (PR().demoPlaying(t) && !restart) { PR().stopDemo(t); return; }
    if (SDAW.audio.playing) SDAW.audio.stop();
    await PR().demo(t, P.demoId[model()] || PR().demos(model())[0].id);
    const b = document.getElementById('prigTestBtn'); if (b) { b.textContent = '■ Stop'; b.classList.add('on'); }
  }

  /* ===================================================== TAB: INSTRUMENT == */
  function tabInstrument(body, t) {
    const m = model(), T = TYPE(), s = S(), rec = T.model === 'piano' || T.model === 'ep';
    const cards = [];
    if (rec) cards.push(card('SOUND SOURCE', '#22e0ff', [
      segs('engine', PARAM.engine.options, { labels: { 'Real samples': '🎙 Real recordings', 'Layered (samples + model)': '🎙+🧵 Layered', 'Physical model': T.model === 'piano' ? '🧵 String model' : '🧲 Tine model' } }),
      T.model === 'ep' ? segs('epModel', PARAM.epModel.options) : null,
      el('div', { class: 'rig-row' }, [choice('sampleLib', { label: 'Recordings' }),
        el('button', { class: 'btn small', 'data-help': 'Use a folder with an SFZ sample library (or audio files named by note) as "My library" of this instrument', onclick: loadUserLibrary }, '📂 Load library…')]),
      el('div', { class: 'rig-hint' }, s.engine === 'Real samples' ? 'Real recordings of a real instrument: the most realistic. Settings marked "model" act on the model only.' : s.engine === 'Physical model' ? (T.model === 'piano' ? 'Computed strings: 1 per note in the low bass, 2 in the bass, 3 from the tenor up (tab 🧵 Strings).' : 'Computed tines / reeds with a magnetic pickup.') : 'Recordings + the model on top ("Model layer level").')
    ], 'wide'));
    cards.push(card('COLOUR & BRIGHTNESS', '#ffd23f', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f' }), knob('eqAir', { label: 'Air', color: '#ffd23f' }), knob('eqPres', { label: 'Presence', color: '#ffd23f' }),
      K('sampleTone', { label: 'Recordings tone', color: '#ffd23f' }), K('hammerHard', { label: 'Hammer hardness', color: '#ffd23f' }), K('epTone', { label: 'Bass ↔ Treble', color: '#ffd23f' }),
      K('cutoff', { label: 'Filter cutoff', color: '#ffd23f' }), K('organDrive', { label: 'Overdrive', color: '#ffd23f' })]));
    cards.push(card('TOUCH & DYNAMICS', '#ff4fd8', [knob('touch', { label: 'Touch (light ↔ heavy)', color: '#ff4fd8' }), K('dynRange', { label: 'Dynamic range', color: '#ff4fd8' }), K('velTone', { label: 'Velocity → bright', color: '#ff4fd8' }),
      K('sampleStart', { label: 'Softer attack', color: '#ff4fd8' }), K('hammerNoise', { label: 'Hammer knock', color: '#ff4fd8' }), K('velAmp', { label: 'Velocity → volume', color: '#ff4fd8' }), K('velFilter', { label: 'Velocity → filter', color: '#ff4fd8' }),
      K('keyClick', { label: 'Key click', color: '#ff4fd8' }), knob('humanVel', { label: 'Human dynamics', color: '#ff4fd8' }), knob('humanTime', { label: 'Human timing', color: '#ff4fd8' })]));
    if (PL.paramFor(PARAM.autoPedal, m)) cards.push(card('SUSTAIN PEDAL & DAMPERS', '#2bff88', [
      el('div', { class: 'rig-row' }, [el('span', { class: 'rig-lab' }, '🦶 Auto pedal'), segs('autoPedal', PARAM.autoPedal.options)]),
      K('damperTime', { label: 'Damper time', color: '#2bff88' }), K('symRes', { label: 'Sympathetic resonance', color: '#2bff88' }), K('resTime', { label: 'Resonance length', color: '#2bff88' }),
      K('releaseNoise', { label: 'Key-release noise', color: '#2bff88' }), K('pedalNoise', { label: 'Pedal noise', color: '#2bff88' }), K('aR', { label: 'Release', color: '#2bff88' }),
      el('div', { class: 'rig-hint' }, 'ScoreDAW has no pedal marks yet: the auto pedal lifts and presses the pedal at every bar / half bar / beat, like a pianist following the harmony. The keyboard below has a real pedal (hold Shift or the 🦶 button).')
    ], 'wide'));
    else cards.push(card('ROTARY SPEAKER', '#2bff88', [segs('rotary', PARAM.rotary.options), el('div', { class: 'rig-hint' }, 'The sustain pedal (Shift on the keyboard below) switches the rotary speaker to fast while held — drawbars and the 3D cabinet: tab ⛪.')], 'wide'));
    cards.push(card('LEVEL', '#22e0ff', [K('sampleLevel', { label: 'Recordings level', color: '#22e0ff' }), K('layerMix', { label: 'Model layer', color: '#22e0ff' }), knob('reverbMix', { label: 'Reverb', color: '#22e0ff' }), knob('output', { label: 'Output', color: '#22e0ff' })]));
    body.append(el('div', { class: 'rig-col rig-art' }, [instrumentArt(m), el('div', { class: 'rig-desc' }, [el('b', {}, T.name), el('p', {}, T.desc)])]),
      el('div', { class: 'rig-col rig-cards' }, cards));
  }
  function loadUserLibrary() {
    const inp = el('input', { type: 'file' }); inp.setAttribute('webkitdirectory', ''); inp.multiple = true;
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => /\.(sfz|wav|flac|ogg|mp3|txt)$/i.test(f.name));
      if (!files.some(f => /\.(sfz|wav|flac|ogg|mp3)$/i.test(f.name))) return SDAW.toast('⚠ No .sfz / audio files in that folder');
      SDAW.toast('Reading ' + files.length + ' files…');
      try { await PR().storeUserLibrary(model(), files); setMany({ sampleLib: 'My library (folder)', engine: S().engine === 'Physical model' ? 'Real samples' : S().engine }, 'my library'); }
      catch (e) { SDAW.toast('⚠ Could not store the library: ' + e.message); }
    };
    inp.click();
  }

  /* ------------------------------------------------- instrument drawings */
  // stylized, generic drawings (no brand trade dress)
  function instrumentArt(m) {
    const W = 620, H = 330, kids = [svg('defs', {}, [
      svg('linearGradient', { id: 'pgBlack', x1: 0, y1: 0, x2: 0, y2: 1 }, [svg('stop', { offset: '0%', 'stop-color': '#2b2b33' }), svg('stop', { offset: '100%', 'stop-color': '#07070a' })]),
      svg('linearGradient', { id: 'pgWood', x1: 0, y1: 0, x2: 1, y2: 1 }, [svg('stop', { offset: '0%', 'stop-color': '#c58a4a' }), svg('stop', { offset: '100%', 'stop-color': '#6b3a17' })]),
      svg('linearGradient', { id: 'pgPanel', x1: 0, y1: 0, x2: 0, y2: 1 }, [svg('stop', { offset: '0%', 'stop-color': '#3a3d48' }), svg('stop', { offset: '100%', 'stop-color': '#16171d' })])
    ])];
    const keys = (x, y, w, h, n) => {
      const ww = w / n;
      for (let i = 0; i < n; i++) kids.push(svg('rect', { x: x + i * ww, y, width: ww - 1, height: h, rx: 2, fill: '#f3f0e6', stroke: '#888' }));
      for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) kids.push(svg('rect', { x: x + (i + 0.68) * ww, y, width: ww * 0.62, height: h * 0.6, rx: 1.5, fill: '#111' }));
    };
    if (m === 'grand') {
      // grand piano seen from above, lid open: strings in 3 colours (1 / 2 / 3 strings per note)
      kids.push(svg('path', { d: 'M40 70 L520 70 C575 70 590 110 585 150 C578 205 520 220 470 232 C420 244 380 268 330 290 L40 290 Z', fill: 'url(#pgBlack)', stroke: '#555', 'stroke-width': 3 }));
      kids.push(svg('path', { d: 'M58 86 L512 86 C560 88 570 118 566 150 C560 196 512 206 466 218 C418 229 376 252 330 272 L58 272 Z', fill: '#c9a46a' }));
      const s = S();
      for (let i = 0; i < 52; i++) {
        const midi = 21 + Math.round(i * 87 / 51), n = midi <= s.monoTop ? 1 : midi <= s.biTop ? 2 : 3;
        const y = 98 + i * 3.35, x1 = 92, x2 = 560 - Math.pow(i / 51, 1.4) * 240;
        kids.push(svg('line', { x1, y1: y, x2, y2: y + 4 - i * 0.05, stroke: n === 1 ? '#ffb02e' : n === 2 ? '#22e0ff' : '#e8e8f0', 'stroke-width': n === 1 ? 2.4 : n === 2 ? 1.6 : 1.1, opacity: 0.9 }));
      }
      kids.push(svg('path', { d: 'M150 92 C 260 110 330 170 380 270', fill: 'none', stroke: '#7a5a2a', 'stroke-width': 6, opacity: 0.6 }));
      kids.push(svg('rect', { x: 14, y: 70, width: 30, height: 220, rx: 4, fill: '#111', stroke: '#444' }));
      for (let i = 0; i < 26; i++) kids.push(svg('rect', { x: 18, y: 74 + i * 8.3, width: 22, height: 7.3, rx: 1, fill: '#f3f0e6' }));
      [['1 string', '#ffb02e', 80], ['2 strings', '#22e0ff', 200], ['3 strings', '#e8e8f0', 330]].forEach(([tx, c, x]) => { kids.push(svg('rect', { x, y: 304, width: 14, height: 6, fill: c })); kids.push(svg('text', { x: x + 20, y: 311, class: 'pg-lab' }, tx)); });
    } else if (m === 'epiano') {
      const wur = S().epModel.startsWith('Wur');
      kids.push(svg('rect', { x: 30, y: 60, width: 560, height: 120, rx: 18, fill: wur ? '#c2b090' : 'url(#pgBlack)', stroke: '#555', 'stroke-width': 3 }));
      kids.push(svg('rect', { x: 50, y: 74, width: 520, height: 26, rx: 6, fill: wur ? '#8a7a5a' : '#22232a' }));
      ['VOLUME', 'BASS', 'TREBLE', 'VIBRATO'].forEach((tx, i) => { kids.push(svg('circle', { cx: 90 + i * 70, cy: 87, r: 8, fill: '#ddd', stroke: '#777' })); kids.push(svg('text', { x: 90 + i * 70, y: 117, 'text-anchor': 'middle', class: 'pg-lab small' }, tx)); });
      kids.push(svg('text', { x: 520, y: 92, 'text-anchor': 'end', class: 'pg-lab' }, wur ? 'REED PIANO' : 'TINE PIANO 73'));
      keys(50, 126, 520, 46, 36);
      if (!wur) {
        kids.push(svg('rect', { x: 70, y: 190, width: 480, height: 120, rx: 14, fill: 'url(#pgBlack)', stroke: '#444', 'stroke-width': 3 }));
        [[200, 250], [420, 250]].forEach(([cx, cy]) => { kids.push(svg('circle', { cx, cy, r: 46, fill: '#1c1c22', stroke: '#333', 'stroke-width': 4 })); kids.push(svg('circle', { cx, cy, r: 14, fill: '#333' })); });
      } else { kids.push(svg('line', { x1: 80, y1: 182, x2: 60, y2: 310, stroke: '#888', 'stroke-width': 6 })); kids.push(svg('line', { x1: 540, y1: 182, x2: 560, y2: 310, stroke: '#888', 'stroke-width': 6 })); }
    } else if (m === 'synth') {
      kids.push(svg('rect', { x: 20, y: 70, width: 580, height: 230, rx: 14, fill: 'url(#pgPanel)', stroke: '#555', 'stroke-width': 3 }));
      kids.push(svg('rect', { x: 20, y: 70, width: 22, height: 230, rx: 6, fill: 'url(#pgWood)' })); kids.push(svg('rect', { x: 578, y: 70, width: 22, height: 230, rx: 6, fill: 'url(#pgWood)' }));
      ['OSC 1', 'OSC 2', 'FILTER', 'ENV', 'LFO'].forEach((tx, i) => {
        kids.push(svg('text', { x: 90 + i * 108, y: 96, 'text-anchor': 'middle', class: 'pg-lab small' }, tx));
        for (let k = 0; k < 2; k++) kids.push(svg('circle', { cx: 70 + i * 108 + k * 40, cy: 122, r: 12, fill: '#d8dce3', stroke: '#777' }));
      });
      kids.push(svg('rect', { x: 60, y: 146, width: 500, height: 6, rx: 3, fill: '#36f1cd', opacity: 0.6 }));
      keys(56, 168, 508, 120, 29);
    } else {
      kids.push(svg('rect', { x: 50, y: 40, width: 520, height: 140, rx: 10, fill: 'url(#pgWood)', stroke: '#3a1d08', 'stroke-width': 3 }));
      const col = ['#8a4a20', '#8a4a20', '#f4f1e6', '#f4f1e6', '#111', '#f4f1e6', '#111', '#111', '#f4f1e6'], s = S();
      for (let i = 0; i < 9; i++) { const v = s['db' + (i + 1)]; kids.push(svg('rect', { x: 210 + i * 22, y: 52, width: 14, height: 24 + v * 8, rx: 3, fill: col[i], stroke: '#000' })); }
      keys(80, 110, 460, 30, 30); keys(80, 146, 460, 30, 30);
      kids.push(svg('rect', { x: 120, y: 190, width: 380, height: 120, rx: 6, fill: 'url(#pgWood)', stroke: '#3a1d08', 'stroke-width': 3 }));
      for (let i = 0; i < 13; i++) kids.push(svg('rect', { x: 140 + i * 27, y: 284, width: 22, height: 18, rx: 2, fill: '#2a1608' }));
    }
    return svg('svg', { class: 'rig-gtr', viewBox: '0 0 ' + W + ' ' + H }, kids);
  }

  /* ======================================================== TAB: STRINGS == */
  function tabStrings(body) {
    const s = S(), model1 = s.engine === 'Real samples';
    const diag = el('canvas', { class: 'str-diag', width: 1380, height: 150 });
    const draw = () => {
      const g = diag.getContext('2d'), W = diag.width, H = diag.height, cur = S();
      g.clearRect(0, 0, W, H);
      const isB = n => [1, 3, 6, 8, 10].includes(n % 12);
      let whites = 0; for (let n = 21; n <= 108; n++) if (!isB(n)) whites++;
      const ww = W / whites; let x = 0;
      const col = n => n <= cur.monoTop ? '#ffb02e' : n <= cur.biTop ? '#22e0ff' : '#e8e8f0', cnt = n => n <= cur.monoTop ? 1 : n <= cur.biTop ? 2 : 3;
      for (let n = 21; n <= 108; n++) {
        if (isB(n)) continue;
        g.fillStyle = '#f2efe6'; g.fillRect(x + 1, 70, ww - 2, 78);
        g.fillStyle = col(n); g.fillRect(x + 2, 140, ww - 4, 6);
        for (let k = 0; k < cnt(n); k++) { g.fillStyle = col(n); g.fillRect(x + ww / 2 - 4 + k * 4 - (cnt(n) - 1) * 2, 30, 2, 36); }
        x += ww;
      }
      x = 0;
      for (let n = 21; n <= 108; n++) { if (isB(n)) { g.fillStyle = '#111'; g.fillRect(x - ww * 0.3, 70, ww * 0.6, 46); } else x += ww; }
      g.fillStyle = 'rgba(10,10,30,.85)'; g.fillRect(0, 0, W, 26);
      g.font = '600 15px Segoe UI'; g.fillStyle = '#ffb02e'; g.fillText('1 string up to ' + SDAW.rigUI.noteName(cur.monoTop), 10, 19);
      g.fillStyle = '#22e0ff'; g.fillText('2 strings up to ' + SDAW.rigUI.noteName(cur.biTop), 260, 20); g.fillStyle = '#e8e8f0'; g.fillText('3 strings above', 520, 20);
    };
    body.append(
      el('div', { class: 'rig-col', style: { flex: '1 1 100%' } }, [
        model1 ? el('div', { class: 'rig-warn' }, '🎙 The sound source is "Real recordings": these settings act on the string model. Choose "Physical model" or "Layered" (tab 🎹 Instrument) to hear them.') : null,
        el('div', { class: 'eq-top' }, [diag]),
        el('div', { class: 'rig-cards' }, [
          card('STRINGS PER NOTE', '#ffb02e', [knob('monoTop', { cls: 'big', label: '1 string up to', color: '#ffb02e', onLive: draw }), knob('biTop', { cls: 'big', label: '2 strings up to', color: '#22e0ff', onLive: draw }),
            knob('unisonDetune', { label: 'Unison detune', color: '#ffb02e' }), knob('unisonSpread', { label: 'Double decay', color: '#ffb02e' })]),
          card('STRING STIFFNESS & TUNING', '#22e0ff', [knob('inharm', { label: 'Inharmonicity', color: '#22e0ff' }), knob('stretch', { label: 'Stretch tuning', color: '#22e0ff' }), knob('a4', { label: 'A4', color: '#22e0ff' })]),
          card('HAMMERS', '#ff4fd8', [knob('hammerHard', { label: 'Hardness', color: '#ff4fd8' }), knob('hammerNoise', { label: 'Knock', color: '#ff4fd8' }), knob('strikePos', { label: 'Strike position', color: '#ff4fd8' })]),
          card('SUSTAIN & BODY', '#2bff88', [knob('sustainLow', { label: 'Sustain (bass)', color: '#2bff88' }), knob('sustainHigh', { label: 'Sustain (treble)', color: '#2bff88' }), knob('hfDamp', { label: 'Overtone damping', color: '#2bff88' }),
            knob('soundboard', { label: 'Soundboard', color: '#2bff88' }), knob('modelStereo', { label: 'Stereo spread', color: '#2bff88' })])
        ])
      ]));
    draw();
  }

  /* =========================================================== TAB: E-PIANO == */
  function tabEP(body) {
    const s = S(), wur = s.epModel.startsWith('Wur');
    const chrome = (id, label) => knob(id, { cls: 'chrome', label, color: wur ? '#1a1405' : '#e8e8f0' });
    const front = el('div', { class: 'ep-front' + (wur ? ' wur' : '') }, [
      el('div', { class: 'ep-logo' }, [el('b', {}, 'ScoreDAW'), el('small', {}, wur ? 'REED PIANO · 200' : 'TINE PIANO · SUITCASE 73')]),
      el('div', { class: 'ep-knobs' }, [chrome('output', 'Volume'), chrome('epTone', 'Bass ↔ Treble'), chrome('tremDepth', 'Vibrato'), chrome('tremRate', 'Speed'), chrome('tremStereo', 'Stereo pan'), el('div', { class: 'amp-jewel', style: { '--jw': '#ff3b3b' } })])
    ]);
    body.append(el('div', { class: 'rig-col', style: { flex: '1 1 100%' } }, [
      el('div', { class: 'ep-stage' }, [segs('epModel', PARAM.epModel.options), front]),
      el('div', { class: 'rig-cards' }, [
        card('AMP / SPEAKER', '#ff4fd8', [choice('epAmp', { label: 'Speaker' }), el('div', { class: 'rig-knobs' }, [knob('drive', { label: 'Drive', color: '#ff4fd8' })])]),
        card('PHASER', '#9b5cff', [knob('phaserMix', { label: 'Phaser', color: '#b98cff' }), knob('phaserRate', { label: 'Rate', color: '#b98cff' })]),
        card('TINES & PICKUPS (model)', '#22e0ff', [knob('epBell', { label: 'Bell', color: '#22e0ff' }), knob('epBark', { label: 'Bark', color: '#22e0ff' }), knob('epSym', { label: 'Pickup alignment', color: '#22e0ff' }), knob('epDecay', { label: 'Decay', color: '#22e0ff' }),
          el('div', { class: 'rig-hint' }, 'Bark = the growl of hard notes when the tine swings close to the pickup. These act on the tine model (Sound source: model or layered).')], 'wide')
      ])
    ]));
  }

  /* ============================================================ TAB: SYNTH == */
  const WAVES_IC = { Saw: '⩘ Saw', Square: '⊓ Square', Pulse: '⊓ Pulse', Triangle: '△ Triangle', Sine: '∿ Sine' };
  function tabSynth(body) {
    body.append(el('div', { class: 'rig-cards fx-grid' }, [
      card('OSCILLATOR 1', '#36f1cd', [segs('osc1Wave', null, { labels: WAVES_IC }), knob('pulseWidth', { label: 'Pulse width', color: '#36f1cd' }), knob('oscMix', { label: 'Osc 1 ↔ 2', color: '#36f1cd' })]),
      card('OSCILLATOR 2', '#3fa9ff', [segs('osc2Wave', null, { labels: WAVES_IC }), knob('osc2Semi', { label: 'Pitch', color: '#3fa9ff' }), knob('osc2Fine', { label: 'Fine', color: '#3fa9ff' })]),
      card('SUB, NOISE & UNISON', '#9b5cff', [knob('subLevel', { label: 'Sub', color: '#b98cff' }), knob('noiseLevel', { label: 'Noise', color: '#b98cff' }), knob('unison', { label: 'Voices', color: '#b98cff' }),
        knob('unisonSynth', { label: 'Detune', color: '#b98cff' }), knob('unisonWidth', { label: 'Width', color: '#b98cff' }), knob('drift', { label: 'Analog drift', color: '#b98cff' }), knob('glide', { label: 'Glide', color: '#b98cff' })]),
      card('FILTER (4-pole ladder)', '#ffd23f', [knob('cutoff', { cls: 'big', label: 'Cutoff', color: '#ffd23f' }), knob('reso', { cls: 'big', label: 'Resonance', color: '#ffd23f' }), knob('envAmt', { label: 'Env amount', color: '#ffd23f' }),
        knob('keyTrack', { label: 'Key tracking', color: '#ffd23f' }), knob('velFilter', { label: 'Velocity', color: '#ffd23f' }), knob('synthDrive', { label: 'Drive', color: '#ffd23f' })], 'wide'),
      card('AMP FX', '#ff4fd8', [knob('drive', { label: 'Drive', color: '#ff4fd8' }), knob('tremDepth', { label: 'Tremolo', color: '#ff4fd8' }), knob('tremRate', { label: 'Rate', color: '#ff4fd8' }), knob('phaserMix', { label: 'Phaser', color: '#ff4fd8' })])
    ]));
  }
  let envCanvas = null;
  function tabEnv(body) {
    envCanvas = el('canvas', { class: 'eq-curve', width: 1380, height: 210 });
    body.append(el('div', { class: 'eq-top' }, [envCanvas]), el('div', { class: 'rig-cards fx-grid' }, [
      card('FILTER ENVELOPE', '#ffd23f', ['fA', 'fD', 'fS', 'fR'].map((id, i) => knob(id, { label: ['Attack', 'Decay', 'Sustain', 'Release'][i], color: '#ffd23f', onLive: drawEnv }))),
      card('AMP ENVELOPE', '#36f1cd', ['aA', 'aD', 'aS', 'aR'].map((id, i) => knob(id, { label: ['Attack', 'Decay', 'Sustain', 'Release'][i], color: '#36f1cd', onLive: drawEnv })).concat([knob('velAmp', { label: 'Velocity', color: '#36f1cd' })])),
      card('LFO', '#ff4fd8', [knob('lfoRate', { label: 'Rate', color: '#ff4fd8' }), knob('lfoPitch', { label: '→ Pitch', color: '#ff4fd8' }), knob('lfoFilter', { label: '→ Filter', color: '#ff4fd8' }), knob('lfoPwm', { label: '→ Pulse width', color: '#ff4fd8' })])
    ]));
  }
  /** the two ADSR envelopes, to scale */
  function drawEnv() {
    if (!envCanvas || !envCanvas.isConnected) return;
    const s = S(), g = envCanvas.getContext('2d'), W = envCanvas.width, H = envCanvas.height;
    g.clearRect(0, 0, W, H);
    const hold = 1, total = Math.max(s.fA + s.fD + s.fR, s.aA + s.aD + s.aR) + hold, px = (W - 20) / total;
    const curve = (A, D, Sv, Rl, col) => {
      g.beginPath(); g.moveTo(10, H - 10);
      const y = v => H - 10 - v * (H - 30);
      let x = 10 + A * px; g.lineTo(x, y(1));
      for (let i = 1; i <= 30; i++) { const t = i / 30 * D; g.lineTo(x + t * px, y(Sv + (1 - Sv) * Math.exp(-4.6 * t / D))); }
      x += D * px; const xs = x + hold * px * 0.8; g.lineTo(xs, y(Sv));
      for (let i = 1; i <= 30; i++) { const t = i / 30 * Rl; g.lineTo(xs + t * px * 0.8, y(Sv * Math.exp(-4.6 * t / Rl))); }
      g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
    };
    g.font = '13px Segoe UI'; g.fillStyle = '#ffd23f'; g.fillText('Filter envelope', 14, 18); g.fillStyle = '#36f1cd'; g.fillText('Amp envelope', 140, 18);
    curve(s.fA, s.fD, s.fS, s.fR, '#ffd23f'); curve(s.aA, s.aD, s.aS, s.aR, '#36f1cd');
  }

  /* ============================================================ TAB: ORGAN == */
  const REGISTRATIONS = [['Jazz 888', '888000000'], ['Gospel', '888600004'], ['Full', '888888888'], ['Ballad', '008400000'], ['Rock', '888800000'], ['Bright', '800000888'], ['Flute 8\'', '008000000'], ['Church', '848646045']];
  function tabOrgan(body) {
    const s = S(), col = ['brown', 'brown', 'white', 'white', 'black', 'white', 'black', 'black', 'white'];
    const bars = el('div', { class: 'org-bars' }, PL.DRAWBARS.map((d, i) => {
      const id = 'db' + (i + 1);
      const stick = el('div', { class: 'org-stick ' + col[i] }, [el('div', { class: 'org-rod' }), el('div', { class: 'org-cap' }, d[0])]);
      const num = el('b', {}, String(s[id]));
      const slot = el('div', { class: 'org-slot', 'data-help': 'Drawbar ' + d[0] + ' — drag down = louder (0 … 8), double-click = factory' }, [stick]);
      const draw = v => { stick.style.height = (34 + v * 22) + 'px'; num.textContent = String(v); };
      draw(s[id]);
      slot.addEventListener('pointerdown', e => {
        e.preventDefault(); slot.setPointerCapture(e.pointerId); begin();
        const y0 = e.clientY, v0 = S()[id];
        const mv = ev => { const v = clamp(Math.round(v0 + (ev.clientY - y0) / scale() / 22), 0, 8); if (v !== S()[id]) { setV(id, v); draw(v); } };
        const up = () => { slot.removeEventListener('pointermove', mv); slot.removeEventListener('pointerup', up); end('drawbar ' + d[0]); };
        slot.addEventListener('pointermove', mv); slot.addEventListener('pointerup', up);
      });
      slot.addEventListener('dblclick', () => setOnce(id, fac(id), 'drawbar ' + d[0]));
      return el('div', { class: 'org-bar' }, [num, slot]);
    }));
    const regs = el('div', { class: 'rig-segs' }, REGISTRATIONS.map(([name, code]) => el('button', { class: 'seg' + (PL.DRAWBARS.every((d, i) => s['db' + (i + 1)] === +code[i]) ? ' on' : ''), 'data-help': 'Registration ' + code,
      onclick: () => { const o = {}; PL.DRAWBARS.forEach((d, i) => { o['db' + (i + 1)] = +code[i]; }); setMany(o, 'registration ' + name); } }, [name, el('small', {}, ' ' + code)])));
    // rotary speaker: CSS 3D cabinet; the horn and the drum spin at the speed of the mode
    const fast = s.rotary.startsWith('Fast'), stop = s.rotary === 'Stop' || s.rotary.startsWith('Off');
    const leslie = el('div', { class: 'leslie-stage', 'data-help': 'Rotary speaker: the horn (top) and the drum (bottom) turn in opposite directions. Slow / Fast / Stop below — or hold the sustain pedal for fast.' }, [
      el('div', { class: 'leslie' + (fast ? ' fast' : '') + (stop ? ' stop' : '') }, [
        el('div', { class: 'les-top' }, [el('div', { class: 'les-horn' }, [el('i'), el('i')])]),
        el('div', { class: 'les-louver' }),
        el('div', { class: 'les-bottom' }, [el('div', { class: 'les-drum' })]),
        el('div', { class: 'les-base' })
      ])
    ]);
    body.append(
      el('div', { class: 'rig-col', style: { flex: '1 1 760px' } }, [
        card('DRAWBARS', '#ffb02e', [bars, regs], 'wide'),
        card('PERCUSSION & CHARACTER', '#ff4fd8', [segs('perc', PARAM.perc.options), segs('percDecay', PARAM.percDecay.options), segs('percVol', PARAM.percVol.options),
          knob('keyClick', { label: 'Key click', color: '#ff4fd8' }), knob('leakage', { label: 'Leakage', color: '#ff4fd8' })], 'wide'),
        card('VIBRATO / CHORUS SCANNER', '#22e0ff', [segs('vibChorus', PARAM.vibChorus.options)], 'wide')
      ]),
      el('div', { class: 'rig-col', style: { flex: '0 0 560px' } }, [
        card('ROTARY SPEAKER', '#2bff88', [leslie, segs('rotary', PARAM.rotary.options),
          knob('rotaryDepth', { label: 'Depth', color: '#2bff88' }), knob('rotarySpread', { label: 'Stereo', color: '#2bff88' }), knob('rotaryBal', { label: 'Horn ↔ Drum', color: '#2bff88' }), knob('organDrive', { label: 'Tube drive', color: '#2bff88' })], 'wide')
      ]));
  }

  /* =============================================================== TAB: EQ == */
  let curveCanvas = null, eqCtx = null;
  function tabEQ(body) {
    curveCanvas = el('canvas', { class: 'eq-curve', width: 1380, height: 210 });
    body.append(el('div', { class: 'eq-top' }, [curveCanvas]), el('div', { class: 'eq-row' }, [
      card('GRAPHIC EQ', '#ffd23f', [['eqLow', '90 Hz'], ['eqLowMid', '300 Hz'], ['eqMid', '1 kHz'], ['eqPres', '3.5 kHz'], ['eqAir', '10 kHz']].map(([id, l]) => fader(id, l, drawCurve)), 'eq-bands'),
      card('CHARACTER', '#ff4fd8', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f', onLive: drawCurve })]),
      card('CUTS', '#22e0ff', [knob('lowCut', { label: 'Low cut', color: '#22e0ff', onLive: drawCurve }), knob('highCut', { label: 'High cut', color: '#22e0ff', onLive: drawCurve })])
    ]));
  }
  /** the same filters as the engine (PL.Engine tone EQ), measured */
  function drawCurve() {
    if (!curveCanvas || !curveCanvas.isConnected) return;
    const s = S(), g = curveCanvas.getContext('2d'), W = curveCanvas.width, H = curveCanvas.height;
    if (!eqCtx) { try { eqCtx = new OfflineAudioContext(1, 128, 48000); } catch (e) { return; } }
    const B = (type, f, q, gain) => { const b = eqCtx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
    const list = [B('highpass', s.lowCut, 0.7, 0), B('lowshelf', 90, 0.7, s.eqLow), B('peaking', 300, 0.9, s.eqLowMid), B('peaking', 1000, 0.9, s.eqMid), B('peaking', 3500, 1, s.eqPres), B('highshelf', 10000, 0.7, s.eqAir),
      B('lowshelf', 400, 0.6, -s.tilt * 5), B('highshelf', 2500, 0.6, s.tilt * 6), B('lowpass', s.highCut, 0.7, 0)];
    const N = 300, fr = new Float32Array(N), mag = new Float32Array(N), ph = new Float32Array(N), tot = new Float32Array(N);
    for (let i = 0; i < N; i++) fr[i] = 20 * Math.pow(1000, i / (N - 1));
    list.forEach(b => { b.getFrequencyResponse(fr, mag, ph); for (let i = 0; i < N; i++) tot[i] += 20 * Math.log10(Math.max(1e-6, mag[i])); });
    g.clearRect(0, 0, W, H);
    const y = db => H / 2 - db / 18 * (H / 2 - 12);
    g.strokeStyle = 'rgba(150,130,255,.16)'; g.lineWidth = 1; g.font = '12px Segoe UI'; g.fillStyle = 'rgba(200,200,255,.5)';
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => { const x = Math.log(f / 20) / Math.log(1000) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x + 3, H - 4); });
    [-12, -6, 0, 6, 12].forEach(d => { g.beginPath(); g.moveTo(0, y(d)); g.lineTo(W, y(d)); g.stroke(); g.fillText((d > 0 ? '+' : '') + d + ' dB', 4, y(d) - 3); });
    g.beginPath();
    for (let i = 0; i < N; i++) { const x = i / (N - 1) * W, yy = y(clamp(tot[i], -20, 20)); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.shadowColor = '#ffd23f'; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
  }

  /* ============================================================== TAB: FX == */
  function tabFX(body) {
    body.append(el('div', { class: 'rig-cards fx-grid' }, [
      card('COMPRESSOR', '#36f1cd', [knob('comp', { cls: 'big', label: 'Amount', color: '#36f1cd' })]),
      card('CHORUS', '#3fa9ff', [knob('chorusMix', { label: 'Mix', color: '#3fa9ff' }), knob('chorusRate', { label: 'Rate', color: '#3fa9ff' }), knob('chorusDepth', { label: 'Depth', color: '#3fa9ff' })]),
      card('DELAY', '#9b5cff', [knob('delayMix', { label: 'Mix', color: '#b98cff' }), knob('delayTime', { label: 'Time', color: '#b98cff' }), knob('delayFeedback', { label: 'Repeats', color: '#b98cff' })]),
      card('REVERB', '#2bff88', [segs('reverbType', PARAM.reverbType.options), knob('reverbMix', { label: 'Mix', color: '#2bff88' }), knob('reverbSize', { label: 'Time', color: '#2bff88' }), knob('predelay', { label: 'Pre-delay', color: '#2bff88' })], 'wide'),
      card('STEREO & OUTPUT', '#ff4fd8', [knob('width', { label: 'Width', color: '#ff4fd8' }), knob('output', { cls: 'big', label: 'Level', color: '#ff4fd8' })])
    ]));
  }

  /* ======================================================== TAB: ADVANCED == */
  function tabAdvanced(body) {
    const m = model(), list = el('div', { class: 'adv-list' });
    const search = el('input', { type: 'search', class: 'adv-search', placeholder: 'Find a setting…', value: P.search, oninput: e => { P.search = e.target.value; fill(); } });
    function row(p) {
      const cur = S()[p.id], f = fac(p.id), changed = typeof cur === 'number' ? Math.abs(cur - f) > 1e-9 : cur !== f, off = !acts(p.id);
      const val = el('span', { class: 'adv-val' }, UI.fmt(p, cur));
      const r = el('div', { class: 'adv-row' + (changed ? ' changed' : '') + (off ? ' off' : ''), 'data-help': p.label + (p.tip ? ' — ' + p.tip : '') + (off ? ' · acts on the model only' : '') });
      const ctl = p.options ? el('select', { onchange: e => setOnce(p.id, e.target.value, p.label) }, p.options.map(x => el('option', { value: x, selected: x === cur ? true : null }, x)))
        : el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur, onpointerdown: () => begin(),
          oninput: e => { const v = UI.snap(p, +e.target.value); setV(p.id, v); val.textContent = UI.fmt(p, v); r.classList.toggle('changed', Math.abs(v - f) > 1e-9); }, onchange: () => end(p.label) });
      r.append(el('span', { class: 'adv-lab' }, [p.label, off ? el('i', {}, ' model') : null]), ctl, val,
        el('button', { class: 'adv-reset', 'data-help': 'Factory value: ' + UI.fmt(p, f), onclick: () => setOnce(p.id, f, p.label + ' (factory)') }, '↺'));
      return r;
    }
    function fill() {
      list.innerHTML = '';
      const q = P.search.toLowerCase();
      PL.SECTIONS.forEach(([sec, title]) => {
        const ps = PL.PARAMS.filter(p => p.sec === sec && PL.paramFor(p, m) && (!q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.tip || '').toLowerCase().includes(q)));
        if (ps.length) list.appendChild(el('div', { class: 'adv-sec' }, [el('h5', {}, title), el('div', { class: 'adv-grid' }, ps.map(row))]));
      });
    }
    fill();
    body.append(el('div', { class: 'adv-head' }, [search, el('span', { class: 'rig-hint' }, 'Every Piano Lab setting of the ' + TYPE().name + '. Highlighted = changed from the factory sound · ↺ = factory.')]), list);
  }

  /* ========================================================= KEYBOARD STRIP == */
  // C2 … C7: click a key (lower = louder), drag = glissando; hold Shift / 🦶 = sustain pedal
  function keyboardStrip(t) {
    const lo = 36, hi = 96, isB = n => [1, 3, 6, 8, 10].includes(n % 12);
    let whites = 0; for (let n = lo; n <= hi; n++) if (!isB(n)) whites++;
    const kb = el('div', { class: 'prig-kb' }), ww = 100 / whites; let x = 0;
    for (let n = lo; n <= hi; n++) {
      const b = isB(n);
      kb.appendChild(el('div', { class: 'pk ' + (b ? 'b' : 'w'), 'data-m': n, style: b ? 'left:' + (x - ww * 0.3) + '%;width:' + ww * 0.6 + '%' : 'left:' + x + '%;width:' + ww + '%' }, !b && n % 12 === 0 ? el('i', {}, SDAW.rigUI.noteName(n)) : null));
      if (!b) x += ww;
    }
    let cur = null;
    const hit = e => { const tg = document.elementFromPoint(e.clientX, e.clientY); if (!tg || !tg.dataset || !tg.dataset.m) return null; const r = tg.getBoundingClientRect(); return { m: +tg.dataset.m, v: clamp(0.25 + 0.75 * (e.clientY - r.top) / r.height, 0.1, 1), el: tg }; };
    const on = h => { cur = h; h.el.classList.add('on'); PR().key(t, h.m, h.v, true); };
    const off = () => { if (!cur) return; cur.el.classList.remove('on'); PR().key(t, cur.m, 0, false); cur = null; };
    kb.addEventListener('pointerdown', e => { const h = hit(e); if (!h) return; e.preventDefault(); kb.setPointerCapture(e.pointerId); on(h); });
    kb.addEventListener('pointermove', e => { if (!cur) return; const h = hit(e); if (h && h.m !== cur.m) { off(); on(h); } });
    kb.addEventListener('pointerup', off); kb.addEventListener('pointercancel', off);
    const ped = el('button', { class: 'btn small prig-ped' + (P.ped ? ' on' : ''), id: 'prigPed', 'data-help': 'Sustain pedal (or hold Shift while the window is open)' + (model() === 'organ' ? ' — on the organ: fast rotary speaker' : ''), onclick: () => setPed(!P.ped) }, '🦶 Pedal');
    return el('div', { class: 'prig-kbar' }, [ped, kb]);
  }
  function setPed(v) {
    const t = track(); if (!t) return;
    P.ped = v; PR().pedalNow(t, v);
    const b = document.getElementById('prigPed'); if (b) b.classList.toggle('on', v);
  }

  /* ============================================================ SPECTRUM == */
  const fbuf = new Uint8Array(4096);
  function startAnim() {
    cancelAnimationFrame(P.raf);
    const loop = () => {
      if (!P.isOpen()) return;
      P.raf = requestAnimationFrame(loop);
      const cv = P.win.querySelector('.rig-scope'), t = track(); if (!cv || !t) return;
      const an = PR().analyser(t), g = cv.getContext('2d'), W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(10,12,30,.6)'; g.fillRect(0, 0, W, H);
      if (!an) return;
      an.getByteFrequencyData(fbuf);
      const sr = an.context.sampleRate, bins = an.frequencyBinCount;
      g.beginPath();
      for (let x = 0; x <= W; x += 2) { const f = 30 * Math.pow(500, x / W), i = Math.min(bins - 1, Math.round(f / (sr / 2) * bins)), y = H - fbuf[i] / 255 * (H - 4); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = '#ffd23f'; g.lineWidth = 1.6; g.shadowColor = '#ffd23f'; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    };
    loop();
  }

  /* ============================================================== EVENTS == */
  P.init = function () {
    PL.PARAMS.forEach(p => { PARAM[p.id] = p; });
    CONFIG.library.instruments.forEach(g => g.items.forEach(it => { if (it.engine === 'pianorig' && it.params && !it.params.prigSound && !MODEL_NAMES[it.params.prig]) MODEL_NAMES[it.params.prig] = it.name; }));
    SDAW.bus.on('change', () => { if (P.isOpen() && !editing) render(); });
    SDAW.bus.on('prig', e => {
      if (!P.isOpen() || !e || e.id !== P.trackId) return;
      const box = document.getElementById('prigStatus'), t = track();
      if (box && t) { box.innerHTML = ''; statusNodes(PR().status(t)).forEach(x => box.appendChild(x)); }
      const b = document.getElementById('prigTestBtn');
      if (b && t) { const on = PR().demoPlaying(t); b.textContent = on ? '■ Stop' : '▶ Test'; b.classList.toggle('on', on); }
    });
    SDAW.bus.on('transport', () => { const b = document.getElementById('prigPlayBtn'); if (b) b.textContent = SDAW.audio.playing ? '❚❚ Stop' : '▶ My part'; });
    document.addEventListener('keydown', e => {
      if (!P.isOpen()) return;
      if (e.key === 'Escape' && !document.getElementById('modalRoot').children.length) P.close();
      else if (e.key === 'Shift' && !e.repeat && !P.ped && !e.target.matches('input, textarea')) setPed(true);
    });
    document.addEventListener('keyup', e => { if (P.isOpen() && e.key === 'Shift' && P.ped) setPed(false); });
  };
  if (window.PL && PL.PARAMS) document.addEventListener('DOMContentLoaded', () => P.init());
})(window.SDAW);
