/* =============================================================================
 *  WINDRIG-PANEL.JS — the Wind Rig window of a track (engine 'windrig')
 *  -----------------------------------------------------------------------------
 *  Opens from: Inspector → Sound Slot "🎷 Open Wind Rig…", the 🎷 button or a
 *  double-click on the channel in the Pattern view, the track menu in the
 *  Arrange and the Generator view (F8).
 *
 *  A floating window like the Piano Rig (drag its title bar; Space still plays):
 *    🎷 Instrument            tenor sax / trumpet, recordings or synth model,
 *                             mute (trumpet), colour, dynamics, level
 *    🎼 Phrasing & vibrato    mono legato, how notes are slurred in a song,
 *                             staccato, release, vibrato (drawn as a pitch curve)
 *    📈 Expression & breath   swells, accents, scoops, fall-offs, doits, breath,
 *                             tongue, key / valve noise, growl, brass edge
 *    👥 Section & mic         1–3 players (stage drawing), microphone distance,
 *                             bell axis, room, position
 *    🎚 Tone EQ · 🌫 Effects · ⚙ Advanced (every Wind Lab setting)
 *  A keyboard at the bottom plays the instrument in its real range, with
 *  articulation buttons (staccato, accent, scoop, fall, doit, vibrato). Holding
 *  a key while pressing the next one slurs the two notes, like a real player.
 *  Every control changes the sound live; letting go keeps it (one undo step).
 * ============================================================================= */
(function (SDAW) {
  'use strict';
  const { el, svg } = SDAW;
  const WR = () => SDAW.windRig;
  const P = { trackId: null, tab: 'inst', win: null, demoId: {}, search: '', raf: 0, art: {} };
  SDAW.wrigPanel = P;
  const PARAM = {};
  const LS_KEY = 'scoredaw.wrigPanel';
  const ACCENT = '#36f1cd';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const track = () => SDAW.store.track(P.trackId);
  const model = () => WR().model(track());
  const TYPE = () => WL.TYPES[model()];
  const S = () => WR().settings(track());
  const fac = id => WL.factory(model())[id];
  const scale = () => (SDAW.app && SDAW.app.scale) || 1;
  const MODEL_NAMES = { tenorsax: 'Tenor Sax', trumpet: 'Trumpet' };

  /* ============================================================ EDITING == */
  let editing = false;
  const begin = () => { if (!editing) { SDAW.store.beginEdit(); editing = true; } };
  const end = label => { if (!editing) return; editing = false; SDAW.store.endEdit('Wind Rig: ' + (label || 'setting')); };
  const setV = (id, v) => { const t = track(); if (!t) return; WR().setValue(t, id, v); WR().applyNow(t); };
  /** dimmed when it does nothing with the current sound source */
  function acts(id) {
    const s = S();
    if (s.engine === 'Synth model') return !['mute', 'layerBlend', 'sampleLevel'].includes(id);
    if (id === 'vibDepth' || id === 'vibRate' || id === 'vibAmp') return s.vibType === 'Synthetic';
    if (id === 'vibDelay' || id === 'vibFade' || id === 'vibMinLen') return s.vibType !== 'Off';
    if (id === 'secTime' || id === 'secTune' || id === 'secWidth') return s.players > 1;
    return true;
  }
  const UI = SDAW.rigUI.make({ param: id => PARAM[id], value: id => S()[id], fac, set: setV, begin, end, acts, offNote: 'not used with these settings', offBadge: 'idle' });
  const { knob, segs, card, fader } = UI;
  /** only the knobs this instrument has (growl = sax, brass edge = trumpet) */
  const K = (id, o) => WL.paramFor(PARAM[id], model()) ? knob(id, o) : null;

  /* ============================================================ WINDOW == */
  P.isOpen = () => !!(P.win && P.win.isConnected);
  P.open = function (trackId) {
    const t = SDAW.store.track(trackId || SDAW.store.sel.trackId);
    if (!t || !WR() || !WR().isRigTrack(t)) { SDAW.toast('Select a track that uses a Wind Rig instrument (Library → Saxophone & Trumpet)'); return; }
    if (!WR().ok()) { SDAW.toast('⚠ The wind engine files were not found (tools/wind-lab)'); return; }
    [SDAW.rigPanel, SDAW.prigPanel].forEach(W => { if (W && W.isOpen && W.isOpen()) W.close(); });     // one rig window at a time
    P.trackId = t.id;
    try { const st = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (st) { P.pos = st.pos; P.tab = st.tab || P.tab; } } catch (e) { /* ignore */ }
    SDAW.audio.init(); SDAW.audio.updateTrack(t);
    if (!P.win || !P.win.isConnected) {
      P.win = el('div', { class: 'rig-win wrig-win', id: 'wrigWin' });
      let root = document.getElementById('floatRoot');
      if (!root) { root = el('div', { id: 'floatRoot' }); document.getElementById('app').appendChild(root); }
      root.appendChild(P.win);
    }
    render(); startAnim();
  };
  P.close = function () {
    if (P.win) P.win.remove();
    P.win = null; cancelAnimationFrame(P.raf);
    const t = track(); if (t && WR()) WR().stopDemo(t);
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
  const TABS = [['inst', '🎷 Instrument'], ['phrase', '🎼 Phrasing & vibrato'], ['expr', '📈 Expression & breath'], ['section', '👥 Section & mic'],
    ['eq', '🎚 Tone EQ'], ['fx', '🌫 Effects'], ['adv', '⚙ Advanced']];
  function render() {
    if (!P.isOpen()) return;
    const t = track();
    if (!t || !WR().isRigTrack(t)) { P.close(); return; }
    const old = P.win.querySelector('.rig-body'), keepScroll = old ? old.scrollTop : 0;
    P.win.innerHTML = '';
    const m = model();
    if (!TABS.some(x => x[0] === P.tab)) P.tab = 'inst';
    const head = el('div', { class: 'rig-head' }, [
      el('div', { class: 'rig-title' }, [el('b', {}, '🎷 WIND RIG'), el('small', {}, t.name)]),
      el('div', { class: 'rig-models' }, WR().MODELS.map(id => {
        const MT = WL.TYPES[id];
        return el('button', { class: 'rig-model' + (id === m ? ' on' : ''), 'data-help': MT.name + ' — ' + MT.desc, onclick: () => switchModel(id) }, [el('span', { class: 'ico' }, MT.icon), el('span', {}, MT.short)]);
      })),
      el('span', { class: 'spacer' }),
      el('canvas', { class: 'rig-scope', width: 300, height: 46, 'data-help': 'Spectrum of this instrument (live)' }),
      el('button', { class: 'rig-x', 'data-help': 'Close (Esc)', onclick: P.close }, '✕')
    ]);
    dragWindow(head);
    // ---- presets, status, test phrase
    const presets = WR().presets(m), groups = {};
    presets.forEach(pr => { (groups[pr.group] = groups[pr.group] || []).push(pr); });
    const curDiff = JSON.stringify(WR().toDiff(m, S()));
    const match = presets.find(pr => JSON.stringify(WR().toDiff(m, WL.sanitize(m, Object.assign(WL.factory(m), pr.diff)))) === curDiff);
    const demos = WR().demos(m), demoId = P.demoId[m] || demos[0].id, playing = WR().demoPlaying(t);
    const bar = el('div', { class: 'rig-bar' }, [
      el('div', { class: 'rig-status', id: 'wrigStatus', title: WR().status(t).text }, statusNodes(WR().status(t))),
      el('span', { class: 'spacer' }),
      el('select', { class: 'rig-preset', 'data-help': 'Sounds: the factory sound, your Wind Lab reference (★), the Wind Lab sounds and your own presets', onchange: e => applyPreset(presets.find(x => x.id === e.target.value)) },
        [match ? null : el('option', { value: '', selected: true }, '— custom —')].concat(Object.keys(groups).map(g => el('optgroup', { label: g },
          groups[g].map(pr => el('option', { value: pr.id, selected: match && match.id === pr.id ? true : null }, pr.name)))))),
      el('button', { class: 'btn small', 'data-help': 'Save the current sound as a preset of this instrument', onclick: savePreset }, '💾 Save…'),
      match && match.mine ? el('button', { class: 'btn small', 'data-help': 'Delete this preset', onclick: () => { WR().deletePreset(m, match.name); render(); } }, '🗑') : null,
      el('button', { class: 'btn small', 'data-help': 'Import your Wind Lab settings (wind-references.json or wind-lab-state.json)', onclick: importLab }, '⭳ Wind Lab…'),
      el('button', { class: 'btn small', 'data-help': 'Back to the factory sound of this instrument', onclick: () => { begin(); WR().reset(t); WR().applyNow(t); end('factory sound'); } }, '↺ Factory'),
      el('span', { class: 'sep' }),
      el('select', { class: 'rig-demo', 'data-help': 'Test phrase (the first ones suit this instrument best)', onchange: e => { P.demoId[m] = e.target.value; if (WR().demoPlaying(t)) testPhrase(true); } },
        demos.map((d, i) => el('option', { value: d.id, selected: d.id === demoId ? true : null }, (i < 2 ? '★ ' : '') + d.name))),
      el('button', { class: 'btn small' + (playing ? ' on' : ''), id: 'wrigTestBtn', 'data-help': 'Play the test phrase with this sound (does not touch your song)', onclick: () => testPhrase() }, playing ? '■ Stop' : '▶ Test'),
      el('button', { class: 'btn small cyan', id: 'wrigPlayBtn', 'data-help': 'Play / stop the song or pattern (Space)', onclick: () => SDAW.app.togglePlay() }, SDAW.audio.playing ? '❚❚ Stop' : '▶ My part')
    ]);
    const tabBar = el('div', { class: 'rig-tabs' }, TABS.map(([id, label]) => el('button', { class: 'rig-tab' + (P.tab === id ? ' on' : ''), onclick: () => { P.tab = id; savePos(); render(); } }, label)));
    const body = el('div', { class: 'rig-body wrig-body rig-' + P.tab });
    ({ inst: tabInstrument, phrase: tabPhrase, expr: tabExpression, section: tabSection, eq: tabEQ, fx: tabFX, adv: tabAdvanced }[P.tab])(body, t);
    P.win.append(head, bar, tabBar, body, keyboardStrip(t));
    place();
    body.scrollTop = keepScroll;
    if (P.tab === 'eq') drawCurve();
    if (P.tab === 'phrase') drawPitch();
  }
  const statusNodes = st => [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text)];

  function switchModel(id) {
    const t = track(); if (!t || id === model()) return;
    SDAW.store.mutate('Instrument ' + WL.TYPES[id].short, () => {
      t.params.wrig = id; t.instrument = MODEL_NAMES[id] || WL.TYPES[id].short;
      t.params.wrigS = t.params.wrigS || {};
      if (!t.params.wrigS[id]) t.params.wrigS[id] = WR().seed(id)[id];
    });
    SDAW.toast(WL.TYPES[id].icon + ' ' + WL.TYPES[id].name + ' — loading its recordings…');
  }
  function applyPreset(pr) { const t = track(); if (!t || !pr) return; begin(); WR().setDiff(t, pr.diff); WR().applyNow(t); end('sound ' + pr.name); SDAW.toast(TYPE().icon + ' ' + pr.name); }
  function savePreset() { SDAW.ask('Name of the preset (' + TYPE().short + ')', '', name => { WR().savePreset(model(), name, WR().toDiff(model(), S())); SDAW.toast('💾 Preset "' + name + '" saved'); render(); }); }
  function importLab() {
    const inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const got = WR().importLabFile(JSON.parse(await f.text()));
        if (!got.length) return SDAW.toast('⚠ No Wind Lab settings found in that file');
        const t = track();
        if (got.includes(model())) { begin(); WR().setDiff(t, WR().labReference(model())); WR().applyNow(t); end('Wind Lab reference'); }
        SDAW.toast('⭳ Wind Lab settings imported for: ' + got.map(x => WL.TYPES[x].short).join(', ') + ' (sound "★ My Wind Lab reference")');
        render();
      } catch (e) { SDAW.toast('⚠ Could not read the file: ' + e.message); }
    };
    inp.click();
  }
  async function testPhrase(restart) {
    const t = track(); if (!t) return;
    if (WR().demoPlaying(t) && !restart) { WR().stopDemo(t); return; }
    if (SDAW.audio.playing) SDAW.audio.stop();
    await WR().demo(t, P.demoId[model()] || WR().demos(model())[0].id);
    const b = document.getElementById('wrigTestBtn'); if (b) { b.textContent = '■ Stop'; b.classList.add('on'); }
  }

  /* ===================================================== TAB: INSTRUMENT == */
  function tabInstrument(body) {
    const m = model(), T = TYPE(), s = S(), cards = [];
    cards.push(card('SOUND SOURCE', '#22e0ff', [
      segs('engine', PARAM.engine.options, { labels: { 'Real samples': '🎙 Real recordings', 'Synth model': '🎛 Synth model' } }),
      m === 'trumpet' ? el('div', { class: 'rig-row' }, [el('span', { class: 'rig-lab' }, '🔇 Mute'), segs('mute', PARAM.mute.options, { labels: { Open: 'Open bell', 'Harmon mute': 'Harmon', 'Straight mute': 'Straight' } })]) : null,
      el('div', { class: 'rig-hint' }, s.engine === 'Real samples'
        ? 'Real recordings of a real player (' + (m === 'trumpet' ? 'sustain, vibrato, staccato, harmon and straight mutes' : 'sustain, vibrato and staccato') + '), with seamless loops: a note can be held as long as you write it.'
        : 'A computed horn — only to compare. Choose "Real recordings" for the realistic sound.')
    ], 'wide'));
    cards.push(card('COLOUR & BRIGHTNESS', '#ffd23f', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f' }), knob('bell', { label: 'Bell (side ↔ front)', color: '#ffd23f' }),
      knob('eqPres', { label: 'Presence', color: '#ffd23f' }), knob('eqAir', { label: 'Air', color: '#ffd23f' }), K('growl', { label: 'Growl', color: '#ffd23f' }), K('flutter', { label: 'Brass edge', color: '#ffd23f' })]));
    cards.push(card('TOUCH & DYNAMICS', '#ff4fd8', [knob('touch', { label: 'Touch (light ↔ heavy)', color: '#ff4fd8' }), knob('dynRange', { label: 'Dynamic range', color: '#ff4fd8' }),
      knob('layerBlend', { label: 'Dynamics crossfade', color: '#ff4fd8' }), knob('velTone', { label: 'Velocity → bright', color: '#ff4fd8' }), knob('attackSoft', { label: 'Softer attack', color: '#ff4fd8' }),
      knob('humanVel', { label: 'Human dynamics', color: '#ff4fd8' }), knob('humanTime', { label: 'Human timing', color: '#ff4fd8' })]));
    cards.push(card('LEVEL', '#22e0ff', [knob('sampleLevel', { label: 'Recordings level', color: '#22e0ff' }), knob('breath', { label: 'Breath', color: '#22e0ff' }),
      knob('reverbMix', { label: 'Reverb', color: '#22e0ff' }), knob('output', { label: 'Output', color: '#22e0ff' })]));
    body.append(el('div', { class: 'rig-col rig-art' }, [instrumentArt(m, s), el('div', { class: 'rig-desc' }, [el('b', {}, T.name),
      el('p', {}, T.desc), el('p', {}, 'Real range: ' + SDAW.rigUI.noteName(T.range[0]) + ' – ' + SDAW.rigUI.noteName(T.range[1]) + ' (sounding). Notes outside it still play, from the nearest recording.')])]),
      el('div', { class: 'rig-col rig-cards' }, cards));
  }

  /* ------------------------------------------------- instrument drawings */
  // stylized, generic drawings of the instruments (no brand trade dress)
  function instrumentArt(m, s) {
    const W = 620, H = 330;
    let kids = [svg('defs', {}, [
      svg('linearGradient', { id: 'wgBrass', x1: 0, y1: 0, x2: 1, y2: 1 }, [svg('stop', { offset: '0%', 'stop-color': '#fff1a8' }), svg('stop', { offset: '45%', 'stop-color': '#e0a93a' }), svg('stop', { offset: '100%', 'stop-color': '#8a5a12' })]),
      svg('radialGradient', { id: 'wgBell', cx: 0.5, cy: 0.5, r: 0.6 }, [svg('stop', { offset: '0%', 'stop-color': '#2a1a05' }), svg('stop', { offset: '70%', 'stop-color': '#8a5a12' }), svg('stop', { offset: '100%', 'stop-color': '#ffe28a' })]),
      svg('linearGradient', { id: 'wgMute', x1: 0, y1: 0, x2: 1, y2: 0 }, [svg('stop', { offset: '0%', 'stop-color': '#8c8f99' }), svg('stop', { offset: '50%', 'stop-color': '#e8eaf0' }), svg('stop', { offset: '100%', 'stop-color': '#6b6e78' })])
    ])];
    kids.push(svg('ellipse', { cx: W / 2, cy: H - 22, rx: 250, ry: 14, fill: 'rgba(54,241,205,.12)' }));
    const art = [], top = kids;
    kids = art;                          // the drawing goes into its own group (moved clear of the labels)
    if (m === 'tenorsax') {
      // neck + mouthpiece, straight body, U-bow, bell opening up and to the right
      const body = 'M150 40 C190 30 225 34 250 52 L262 62 L258 74 L246 70 L250 250 C252 300 330 312 372 290 C398 276 410 250 414 212 L410 176 C440 166 470 172 486 190 C470 206 452 218 440 228 C438 270 410 312 360 318 C300 324 228 304 228 250 L224 78 C210 64 186 56 160 60 Z';
      kids.push(svg('path', { d: body, fill: 'url(#wgBrass)', stroke: '#6b430c', 'stroke-width': 2.5 }));
      kids.push(svg('ellipse', { cx: 448, cy: 192, rx: 40, ry: 13, transform: 'rotate(-24 448 192)', fill: 'url(#wgBell)', stroke: '#ffe28a', 'stroke-width': 2 }));
      kids.push(svg('path', { d: 'M110 44 L152 40 L160 60 L118 60 Z', fill: '#151515', stroke: '#444' }));                    // mouthpiece
      kids.push(svg('rect', { x: 104, y: 46, width: 12, height: 12, rx: 3, fill: '#bfae8a' }));                                   // reed tip
      // keys and pads along the body
      [[238, 100], [238, 130], [238, 160], [238, 190], [240, 222], [246, 256], [270, 286], [306, 296]].forEach(([x, y], i) => {
        kids.push(svg('circle', { cx: x + 14, cy: y, r: 9, fill: '#f6e6b0', stroke: '#7a5412', 'stroke-width': 2 }));
        kids.push(svg('circle', { cx: x + 14, cy: y, r: 4, fill: i % 2 ? '#e7d3a0' : '#fff7d6' }));
      });
      kids.push(svg('path', { d: 'M266 96 C300 110 300 170 270 200', fill: 'none', stroke: '#c9932f', 'stroke-width': 3 }));       // key rods
      kids.push(svg('path', { d: 'M226 110 C200 140 204 210 228 236', fill: 'none', stroke: '#c9932f', 'stroke-width': 3 }));
    } else {
      // trumpet seen from the side: mouthpiece + lead pipe (middle) → front tuning slide → 3 valves →
      // back bow (left) → bell pipe (top) → bell (right)
      const tube = (d, w) => kids.push(svg('path', { d, fill: 'none', stroke: 'url(#wgBrass)', 'stroke-width': w || 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      kids.push(svg('path', { d: 'M52 156 L78 152 L78 166 L52 162 Z', fill: '#d9d9de', stroke: '#777' }));                        // mouthpiece
      tube('M80 159 L470 159 C505 159 505 205 470 205 L395 205', 11);                                                           // lead pipe + front slide
      tube('M285 222 L215 222 C170 222 170 122 215 122 L470 122', 12);                                                          // back bow + bell pipe
      kids.push(svg('path', { d: 'M466 114 C510 112 540 92 568 64 L568 180 C540 152 510 132 466 130 Z', fill: 'url(#wgBrass)', stroke: '#6b430c', 'stroke-width': 2.5 }));
      kids.push(svg('ellipse', { cx: 568, cy: 122, rx: 16, ry: 58, fill: 'url(#wgBell)', stroke: '#ffe28a', 'stroke-width': 2 }));
      [300, 340, 380].forEach(x => {                                                                                               // valves
        kids.push(svg('rect', { x: x - 13, y: 108, width: 26, height: 124, rx: 6, fill: 'url(#wgBrass)', stroke: '#6b430c', 'stroke-width': 2 }));
        kids.push(svg('rect', { x: x - 4, y: 86, width: 8, height: 24, fill: '#d8d8de', stroke: '#666' }));
        kids.push(svg('ellipse', { cx: x, cy: 84, rx: 13, ry: 5, fill: '#fff5d0', stroke: '#8a6a2a' }));
      });
      // mute in the bell
      if (s.mute === 'Harmon mute') {
        kids.push(svg('path', { d: 'M560 84 C600 84 610 100 610 120 C610 140 600 156 560 156 Z', fill: 'url(#wgMute)', stroke: '#444', 'stroke-width': 2 }));
        kids.push(svg('rect', { x: 606, y: 112, width: 12, height: 16, rx: 3, fill: '#bfc2cc', stroke: '#444' }));
        kids.push(svg('text', { x: 586, y: 200, 'text-anchor': 'middle', class: 'pg-lab small' }, 'HARMON'));
      } else if (s.mute === 'Straight mute') {
        kids.push(svg('path', { d: 'M562 98 L604 110 L604 130 L562 142 Z', fill: 'url(#wgMute)', stroke: '#444', 'stroke-width': 2 }));
        kids.push(svg('text', { x: 586, y: 200, 'text-anchor': 'middle', class: 'pg-lab small' }, 'STRAIGHT'));
      }
    }
    // sound waves from the bell (more with brightness / level)
    const bx = m === 'tenorsax' ? 470 : 590, by = m === 'tenorsax' ? 176 : 120, n = 2 + Math.round((s.tilt + 1) * 1.5);
    for (let i = 0; i < n; i++) kids.push(svg('path', { d: m === 'tenorsax' ? `M${bx + 8 + i * 14} ${by - 30 - i * 10} q 22 10 14 34` : `M${bx + 4 + i * 12} ${by - 34 - i * 6} q 18 34 0 68`, fill: 'none', stroke: ACCENT, 'stroke-width': 2, opacity: 0.7 - i * 0.12 }));
    kids = top;
    kids.push(svg('g', { transform: m === 'tenorsax' ? 'translate(74 32) scale(0.9)' : 'translate(-10 30)' }, art));
    kids.push(svg('text', { x: 20, y: 30, class: 'pg-lab' }, m === 'tenorsax' ? 'TENOR SAXOPHONE · B♭' : 'TRUMPET · B♭'));
    kids.push(svg('text', { x: 20, y: 50, class: 'pg-lab small' }, s.engine === 'Real samples' ? 'REAL RECORDINGS · ' + (s.mono.startsWith('Mono') ? 'MONO LEGATO' : 'POLY') + (s.players > 1 ? ' · ' + s.players + ' PLAYERS' : '') : 'SYNTH MODEL'));
    return svg('svg', { class: 'wg-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, kids);
  }

  /* ================================================== TAB: PHRASING ===== */
  let pitchCanvas = null;
  function tabPhrase(body) {
    const s = S();
    pitchCanvas = el('canvas', { class: 'wr-pitch', width: 1380, height: 170, 'data-help': 'Pitch of a long note as the engine plays it: straight at first, then the vibrato fades in. Dashed: a slurred note following it.' });
    body.append(el('div', { class: 'eq-top' }, [pitchCanvas]), el('div', { class: 'rig-cards fx-grid' }, [
      card('LEGATO (ONE NOTE AT A TIME)', '#22e0ff', [
        segs('mono', PARAM.mono.options, { labels: { 'Mono legato (real player)': '🎷 Mono legato (real player)', 'Poly (chords)': '🎹 Poly (chords)' } }),
        el('div', { class: 'rig-row' }, [el('span', { class: 'rig-lab' }, 'Slurs in the song'), segs('songSlur', PARAM.songSlur.options, { labels: { 'Overlapping or marked notes': 'Overlapping / marked notes', 'Every connected note': 'Every connected note' } })]),
        knob('legatoTime', { label: 'Slur speed', color: '#22e0ff', onLive: drawPitch }), knob('legatoGlide', { label: 'Slur glide', color: '#22e0ff', onLive: drawPitch }), knob('legatoGap', { label: 'Slur gap', color: '#22e0ff' }),
        el('div', { class: 'rig-hint' }, s.mono.startsWith('Mono')
          ? 'Like a real player: overlapping notes (and notes marked hammer-on / pull-off / legato slide) are slurred without a new attack; notes that only touch are tongued. Two notes at the same time: the higher one plays.'
          : 'Poly: chords sound (a section playing harmony). The legato needs Mono.')
      ], 'wide'),
      card('ATTACK & RELEASE', '#ff4fd8', [knob('stacBelow', { label: 'Staccato under', color: '#ff4fd8' }), knob('releaseTime', { label: 'Release', color: '#ff4fd8' }),
        knob('releaseFall', { label: 'Release pitch drop', color: '#ff4fd8', onLive: drawPitch }), knob('tongue', { label: 'Tongue attack', color: '#ff4fd8' })]),
      card('VIBRATO', '#2bff88', [
        segs('vibType', PARAM.vibType.options, { labels: { 'Recorded (real)': '🎙 Recorded (real)', Synthetic: '〰 Synthetic', Off: 'Off' } }),
        knob('vibDelay', { label: 'Delay', color: '#2bff88', onLive: drawPitch }), knob('vibFade', { label: 'Fade-in', color: '#2bff88', onLive: drawPitch }), knob('vibMinLen', { label: 'On notes longer than', color: '#2bff88' }),
        knob('vibDepth', { label: 'Depth', color: '#2bff88', onLive: drawPitch }), knob('vibRate', { label: 'Rate', color: '#2bff88', onLive: drawPitch }), knob('vibAmp', { label: 'Loudness wobble', color: '#2bff88' }),
        el('div', { class: 'rig-hint' }, 'Recorded = the engine crossfades into the recordings played WITH vibrato. Notes marked vibrato / wide vibrato get it even when short.')
      ], 'wide'),
      card('PITCH', '#ffd23f', [knob('intonation', { label: 'Intonation', color: '#ffd23f' }), knob('drift', { label: 'Drift on long notes', color: '#ffd23f' }), knob('transpose', { label: 'Transpose', color: '#ffd23f' })])
    ]));
  }
  /** the pitch of a long note (and of a slurred note after it), as the engine shapes it */
  function drawPitch() {
    if (!pitchCanvas || !pitchCanvas.isConnected) return;
    const s = S(), g = pitchCanvas.getContext('2d'), W = pitchCanvas.width, H = pitchCanvas.height, sec = 4.2, X = t => 40 + t / sec * (W - 60);
    const Y = c => H / 2 - c / 120 * (H / 2 - 18);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(150,130,255,.16)'; g.fillStyle = 'rgba(200,200,255,.5)'; g.font = '12px Segoe UI'; g.lineWidth = 1;
    for (let t = 0; t <= 4; t++) { g.beginPath(); g.moveTo(X(t), 0); g.lineTo(X(t), H); g.stroke(); g.fillText(t + ' s', X(t) + 3, H - 4); }
    [-100, -50, 0, 50, 100].forEach(c => { g.beginPath(); g.moveTo(40, Y(c)); g.lineTo(W, Y(c)); g.stroke(); g.fillText((c > 0 ? '+' : '') + c + '¢', 2, Y(c) + 4); });
    const depth = s.vibType === 'Off' ? 0 : s.vibType === 'Synthetic' ? s.vibDepth : 18, rate = s.vibType === 'Synthetic' ? s.vibRate : 5.2;
    const noteEnd = 2.6, lt = s.legatoTime / 1000;
    g.beginPath();
    for (let x = 0; x <= W - 60; x += 2) {
      const t = x / (W - 60) * sec;
      if (t > noteEnd + lt * 2) break;
      const amt = clamp((t - s.vibDelay) / Math.max(0.05, s.vibFade), 0, 1);
      let c = depth * amt * Math.sin(2 * Math.PI * rate * t);
      if (t > noteEnd) c += (200 * s.legatoGlide) * clamp((t - noteEnd) / Math.max(0.01, lt), 0, 1);       // glides toward the next note
      x ? g.lineTo(X(t), Y(c)) : g.moveTo(X(t), Y(c));
    }
    g.strokeStyle = ACCENT; g.lineWidth = 3; g.shadowColor = ACCENT; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
    // the slurred next note (two semitones up, shown relative to its own pitch) and its release
    g.beginPath(); g.setLineDash([6, 5]);
    for (let t = noteEnd; t <= sec; t += 0.01) {
      const into = clamp((t - noteEnd) / Math.max(0.01, lt), 0, 1), rel = t > 3.7 ? -s.releaseFall * clamp((t - 3.7) / 0.4, 0, 1) : 0;
      const c = -200 * s.legatoGlide * (1 - into) + rel;
      t === noteEnd ? g.moveTo(X(t), Y(c)) : g.lineTo(X(t), Y(c));
    }
    g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    g.fillStyle = '#d9d6f4'; g.fillText('straight', X(0.05), 16); if (depth) g.fillText('vibrato fades in', X(Math.min(2, s.vibDelay + 0.05)), 16); g.fillText('slur →', X(noteEnd + 0.02), 16);
  }

  /* ================================================ TAB: EXPRESSION ===== */
  function tabExpression(body) {
    const m = model();
    body.append(el('div', { class: 'rig-cards fx-grid' }, [
      card('SWELLS & ACCENTS', '#ff4fd8', [knob('swell', { cls: 'big', label: 'Breathing swell', color: '#ff4fd8' }), knob('swellMin', { label: 'On notes longer than', color: '#ff4fd8' }), knob('accent', { label: 'Accent strength', color: '#ff4fd8' })]),
      card('SCOOPS', '#22e0ff', [knob('scoop', { cls: 'big', label: 'Scoop depth', color: '#22e0ff' }), knob('scoopAuto', { label: 'Auto scoops', color: '#22e0ff' }),
        el('div', { class: 'rig-hint' }, 'Mark a note "slide in from below" for a scoop. Auto scoops add small ones on long or accented notes after a rest.')]),
      card('FALL-OFFS & DOITS', '#ffd23f', [knob('fall', { label: 'Fall length', color: '#ffd23f' }), knob('fallTime', { label: 'Fall time', color: '#ffd23f' }), knob('doit', { label: 'Doit length', color: '#ffd23f' }),
        el('div', { class: 'rig-hint' }, 'Mark "slide out down" = fall-off, "slide out up" = doit (at the end of the note).')]),
      card('BREATH & NOISES', '#2bff88', [knob('breath', { cls: 'big', label: 'Breath', color: '#2bff88' }), knob('tongue', { label: 'Tongue attack', color: '#2bff88' }),
        knob('keyNoise', { label: m === 'tenorsax' ? 'Key clicks' : 'Valve noise', color: '#2bff88' })], 'wide'),
      m === 'tenorsax' ? card('GROWL', '#ff6b4a', [knob('growl', { cls: 'big', label: 'Growl', color: '#ff6b4a' }), knob('growlRate', { label: 'Rate', color: '#ff6b4a' }), knob('growlAccents', { label: 'Only on loud notes', color: '#ff6b4a' }),
        el('div', { class: 'rig-hint' }, 'Humming while playing: the rough R&B / rock / gospel tone. More on loud notes.')])
        : card('BRASS EDGE', '#ff6b4a', [knob('flutter', { cls: 'big', label: 'Blare on loud notes', color: '#ff6b4a' }), el('div', { class: 'rig-hint' }, 'The bell "blares" when the trumpet is played hard.')])
    ]));
  }

  /* =================================================== TAB: SECTION ===== */
  function tabSection(body) {
    const s = S();
    body.append(el('div', { class: 'rig-col rig-art' }, [stageArt(s)]), el('div', { class: 'rig-col rig-cards' }, [
      card('SECTION', '#22e0ff', [
        el('div', { class: 'rig-row' }, [el('span', { class: 'rig-lab' }, '👥 Players'), el('div', { class: 'rig-segs' }, [1, 2, 3].map(n => el('button', { class: 'seg' + (s.players === n ? ' on' : ''),
          'data-help': n === 1 ? 'A soloist' : n + ' players playing the same line (unison), each from another recording', onclick: () => UI.setOnce('players', n, 'Players') }, n === 1 ? 'Solo' : n + ' players')))]),
        knob('secTime', { label: 'Timing spread', color: '#22e0ff' }), knob('secTune', { label: 'Tuning spread', color: '#22e0ff' }), knob('secWidth', { label: 'Stereo width', color: '#22e0ff' }),
        el('div', { class: 'rig-hint' }, 'For harmony (2nd voice, chords) use separate tracks or "Poly" in the Phrasing tab.')
      ], 'wide'),
      card('MICROPHONE & ROOM', '#ffd23f', [knob('micDist', { cls: 'big', label: 'Distance (close ↔ far)', color: '#ffd23f' }), knob('bell', { label: 'Bell axis', color: '#ffd23f' }),
        knob('room', { label: 'Room', color: '#ffd23f' }), knob('pan', { label: 'Position', color: '#ffd23f' })])
    ]));
  }
  function stageArt(s) {
    const W = 620, H = 330, kids = [];
    kids.push(svg('path', { d: 'M40 290 Q310 120 580 290 Z', fill: 'rgba(34,224,255,.07)', stroke: 'rgba(34,224,255,.35)' }));
    const n = Math.round(s.players), pos = n === 1 ? [0] : n === 2 ? [0, -1] : [0, -1, 1];
    pos.forEach((p, i) => {
      const x = 310 + (n === 1 ? 0 : p * s.secWidth * 0.6 * 220) + s.pan * 160, y = 200 - (i ? 10 : 0);
      kids.push(svg('circle', { cx: x, cy: y, r: 26, fill: i ? 'rgba(255,79,216,.25)' : 'rgba(54,241,205,.3)', stroke: i ? '#ff4fd8' : ACCENT, 'stroke-width': 2 }));
      kids.push(svg('text', { x, y: y + 9, 'text-anchor': 'middle', 'font-size': 26 }, TYPE().icon));
      kids.push(svg('text', { x, y: y + 46, 'text-anchor': 'middle', class: 'pg-lab small' }, i ? 'PLAYER ' + (i + 1) : 'LEAD'));
    });
    const my = 252 + s.micDist * 50, mx = 310 + s.pan * 160 + s.bell * -40;
    kids.push(svg('line', { x1: mx, y1: my, x2: mx, y2: my + 50, stroke: '#888', 'stroke-width': 3 }));
    kids.push(svg('rect', { x: mx - 7, y: my - 18, width: 14, height: 22, rx: 6, fill: '#dcdce4', stroke: '#555' }));
    kids.push(svg('text', { x: mx + 14, y: my - 4, class: 'pg-lab small' }, 'MIC ' + Math.round(0.3 + s.micDist * 2.7 * 10) / 10 + ' m'));
    kids.push(svg('text', { x: 20, y: 30, class: 'pg-lab' }, n === 1 ? 'SOLOIST' : n + '-PLAYER SECTION (UNISON)'));
    return svg('svg', { class: 'wg-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, kids);
  }

  /* ============================================================== TAB: EQ == */
  let curveCanvas = null, eqCtx = null;
  function tabEQ(body) {
    curveCanvas = el('canvas', { class: 'eq-curve', width: 1380, height: 210 });
    body.append(el('div', { class: 'eq-top' }, [curveCanvas]), el('div', { class: 'eq-row' }, [
      card('GRAPHIC EQ', '#ffd23f', [['eqLow', '120 Hz'], ['eqLowMid', '400 Hz'], ['eqMid', '1.2 kHz'], ['eqPres', '3 kHz'], ['eqAir', '9 kHz']].map(([id, l]) => fader(id, l, drawCurve)), 'eq-bands'),
      card('CHARACTER', '#ff4fd8', [knob('tilt', { cls: 'big', label: 'Warm ↔ Bright', color: '#ffd23f', onLive: drawCurve })]),
      card('CUTS', '#22e0ff', [knob('lowCut', { label: 'Low cut', color: '#22e0ff', onLive: drawCurve }), knob('highCut', { label: 'High cut', color: '#22e0ff', onLive: drawCurve })])
    ]));
  }
  /** the same filters as the engine (WL.Engine tone EQ + microphone), measured */
  function drawCurve() {
    if (!curveCanvas || !curveCanvas.isConnected) return;
    const s = S(), g = curveCanvas.getContext('2d'), W = curveCanvas.width, H = curveCanvas.height;
    if (!eqCtx) { try { eqCtx = new OfflineAudioContext(1, 128, 48000); } catch (e) { return; } }
    const B = (type, f, q, gain) => { const b = eqCtx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
    const list = [B('lowshelf', 220, 0.7, (0.4 - s.micDist) * 9), B('highshelf', 6000, 0.7, -s.micDist * 6 + s.bell * 3), B('peaking', 2600, 0.9, s.bell * 3.5),
      B('highpass', s.lowCut, 0.7, 0), B('lowshelf', 120, 0.7, s.eqLow), B('peaking', 400, 0.9, s.eqLowMid), B('peaking', 1200, 0.9, s.eqMid), B('peaking', 3000, 1, s.eqPres), B('highshelf', 9000, 0.7, s.eqAir),
      B('lowshelf', 500, 0.6, -s.tilt * 5), B('highshelf', 2500, 0.6, s.tilt * 6), B('lowpass', s.highCut, 0.7, 0)];
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
      card('TUBE WARMTH', '#ff6b4a', [knob('drive', { cls: 'big', label: 'Warmth', color: '#ff6b4a' })]),
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
      const r = el('div', { class: 'adv-row' + (changed ? ' changed' : '') + (off ? ' off' : ''), 'data-help': p.label + (p.tip ? ' — ' + p.tip : '') + (off ? ' · not used with these settings' : '') });
      const ctl = p.options ? el('select', { onchange: e => UI.setOnce(p.id, e.target.value, p.label) }, p.options.map(x => el('option', { value: x, selected: x === cur ? true : null }, x)))
        : el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur, onpointerdown: () => begin(),
          oninput: e => { const v = UI.snap(p, +e.target.value); setV(p.id, v); val.textContent = UI.fmt(p, v); r.classList.toggle('changed', Math.abs(v - f) > 1e-9); }, onchange: () => end(p.label) });
      r.append(el('span', { class: 'adv-lab' }, [p.label, off ? el('i', {}, ' idle') : null]), ctl, val,
        el('button', { class: 'adv-reset', 'data-help': 'Factory value: ' + UI.fmt(p, f), onclick: () => UI.setOnce(p.id, f, p.label + ' (factory)') }, '↺'));
      return r;
    }
    function fill() {
      list.innerHTML = '';
      const q = P.search.toLowerCase();
      WL.SECTIONS.forEach(([sec, title]) => {
        const ps = WL.PARAMS.filter(p => p.sec === sec && WL.paramFor(p, m) && (!q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.tip || '').toLowerCase().includes(q)));
        if (ps.length) list.appendChild(el('div', { class: 'adv-sec' }, [el('h5', {}, title), el('div', { class: 'adv-grid' }, ps.map(row))]));
      });
    }
    fill();
    body.append(el('div', { class: 'adv-head' }, [search, el('span', { class: 'rig-hint' }, 'Every Wind Lab setting of the ' + TYPE().name + '. Highlighted = changed from the factory sound · ↺ = factory.')]), list);
  }

  /* ========================================================= KEYBOARD STRIP == */
  // the real range of the instrument (dimmed keys outside it); click a key (lower = louder),
  // drag = slurred line (the next key starts before the previous one is released)
  const ARTS = [['stacc', '•', 'Staccato'], ['accent', '>', 'Accent'], ['scoop', '↗', 'Scoop'], ['fall', '↘', 'Fall-off'], ['doit', '⤴', 'Doit'], ['vib', '〰', 'Vibrato']];
  function keyboardStrip(t) {
    const T = TYPE(), lo = T.range[0] - 3, hi = T.range[1] + 3, isB = n => [1, 3, 6, 8, 10].includes(n % 12);
    let whites = 0; for (let n = lo; n <= hi; n++) if (!isB(n)) whites++;
    const kb = el('div', { class: 'prig-kb wrig-kb' }), ww = 100 / whites; let x = 0;
    for (let n = lo; n <= hi; n++) {
      const b = isB(n), out = n < T.range[0] || n > T.range[1];
      kb.appendChild(el('div', { class: 'pk ' + (b ? 'b' : 'w') + (out ? ' out' : ''), 'data-m': n, style: b ? 'left:' + (x - ww * 0.3) + '%;width:' + ww * 0.6 + '%' : 'left:' + x + '%;width:' + ww + '%' }, !b && n % 12 === 0 ? el('i', {}, SDAW.rigUI.noteName(n)) : null));
      if (!b) x += ww;
    }
    let cur = null;
    const tech = () => { const o = {}; ARTS.forEach(([k]) => { if (P.art[k]) o[k] = true; }); return o; };
    const hit = e => { const tg = document.elementFromPoint(e.clientX, e.clientY); if (!tg || !tg.dataset || !tg.dataset.m) return null; const r = tg.getBoundingClientRect(); return { m: +tg.dataset.m, v: clamp(0.25 + 0.75 * (e.clientY - r.top) / r.height, 0.1, 1), el: tg }; };
    const on = h => { cur = h; h.el.classList.add('on'); WR().key(t, h.m, h.v, true, tech()); };
    const off = h => { h.el.classList.remove('on'); WR().key(t, h.m, 0, false); };
    kb.addEventListener('pointerdown', e => { const h = hit(e); if (!h) return; e.preventDefault(); kb.setPointerCapture(e.pointerId); on(h); });
    // dragging slurs: the new note starts first, then the old one is released
    kb.addEventListener('pointermove', e => { if (!cur) return; const h = hit(e); if (h && h.m !== cur.m) { const old = cur; on(h); off(old); } });
    const up = () => { if (cur) { off(cur); cur = null; } };
    kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
    const arts = el('div', { class: 'wrig-arts' }, ARTS.map(([k, ico, name]) => el('button', { class: 'btn small' + (P.art[k] ? ' on' : ''), 'data-help': name + ' on the notes played with this keyboard',
      onclick: e => { P.art[k] = !P.art[k]; e.currentTarget.classList.toggle('on', P.art[k]); } }, ico + ' ' + name)));
    return el('div', { class: 'prig-kbar wrig-kbar' }, [arts, kb]);
  }

  /* ============================================================ SPECTRUM == */
  const fbuf = new Uint8Array(4096);
  function startAnim() {
    cancelAnimationFrame(P.raf);
    const loop = () => {
      if (!P.isOpen()) return;
      P.raf = requestAnimationFrame(loop);
      const cv = P.win.querySelector('.rig-scope'), t = track(); if (!cv || !t) return;
      const an = WR().analyser(t), g = cv.getContext('2d'), W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(10,12,30,.6)'; g.fillRect(0, 0, W, H);
      if (!an) return;
      an.getByteFrequencyData(fbuf);
      const sr = an.context.sampleRate, bins = an.frequencyBinCount;
      g.beginPath();
      for (let x = 0; x <= W; x += 2) { const f = 30 * Math.pow(500, x / W), i = Math.min(bins - 1, Math.round(f / (sr / 2) * bins)), y = H - fbuf[i] / 255 * (H - 4); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = ACCENT; g.lineWidth = 1.6; g.shadowColor = ACCENT; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    };
    loop();
  }

  /* ============================================================== EVENTS == */
  P.init = function () {
    WL.PARAMS.forEach(p => { PARAM[p.id] = p; });
    SDAW.bus.on('change', () => { if (P.isOpen() && !editing) render(); });
    SDAW.bus.on('wrig', e => {
      if (!P.isOpen() || !e || e.id !== P.trackId) return;
      const box = document.getElementById('wrigStatus'), t = track();
      if (box && t) { box.innerHTML = ''; statusNodes(WR().status(t)).forEach(x => box.appendChild(x)); }
      const b = document.getElementById('wrigTestBtn');
      if (b && t) { const on = WR().demoPlaying(t); b.textContent = on ? '■ Stop' : '▶ Test'; b.classList.toggle('on', on); }
    });
    SDAW.bus.on('transport', () => { const b = document.getElementById('wrigPlayBtn'); if (b) b.textContent = SDAW.audio.playing ? '❚❚ Stop' : '▶ My part'; });
    document.addEventListener('keydown', e => {
      if (!P.isOpen()) return;
      if (e.key === 'Escape' && !document.getElementById('modalRoot').children.length) P.close();
    });
  };
  if (window.WL && WL.PARAMS) document.addEventListener('DOMContentLoaded', () => P.init());
})(window.SDAW);
