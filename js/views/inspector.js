/* =============================================================================
 *  INSPECTOR.JS — right panel: everything about the selected track / note
 *  -----------------------------------------------------------------------------
 *  Sections (click the title to fold):
 *    Track             name, volume, pan, mute / solo
 *    Sound Slot        engine + instrument (replace sound, notes stay)
 *    Articulations     techniques for the SELECTED notes
 *    Guitar Techniques how this track plays bends, vibrato, slides, humanize
 *    Pedalboard        effect chain (click pedal = on/off, its knobs below)
 *    Note              (Pro) velocity, length, pitch, string/fret of the selection
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  /** Hear the track exactly as it sounds (its own engine, samples and pedals) */
  function listen(t) {
    if (t.type === 'drums') { ['kick', 'hhc', 'snare', 'hhc'].forEach((r, i) => setTimeout(() => SDAW.audio.previewDrum(t, r), i * 180)); return; }
    const base = t.type === 'bass' ? 40 : 60;
    [0, 4, 7, 12].forEach((iv, i) => setTimeout(() => SDAW.audio.previewNote(t, base + iv, { dur: 0.45 }), i * 160));
  }
  const { $, el } = SDAW;
  const ins = { closed: new Set(), pedal: 'dist' };
  SDAW.inspector = ins;

  const ENGINES = [
    { id: 'rig', name: 'Guitar Rig (real recordings + amps)' },
    { id: 'pianorig', name: 'Piano Rig (grand, e-piano, synth, organ)' },
    { id: 'windrig', name: 'Wind Rig (tenor sax, trumpet)' },
    { id: 'guitar', name: 'Guitar Emulator (string model)' },
    { id: 'bass', name: 'Bass Emulator (string model)' },
    { id: 'keys', name: 'Keys Engine' },
    { id: 'strings', name: 'Ensemble Engine' },
    { id: 'synth', name: 'Synth Engine' },
    { id: 'drums', name: 'Drum Engine' }
  ];
  function section(id, title, content, icon, cls) {
    const sec = el('div', { class: 'insp-sec' + (ins.closed.has(id) ? ' closed' : '') + (cls ? ' ' + cls : '') }, [
      el('h4', { onclick: () => { ins.closed.has(id) ? ins.closed.delete(id) : ins.closed.add(id); sec.classList.toggle('closed'); } },
        [el('span', { class: 'pw' }, icon || '⏻'), title, el('span', { class: 'chev' }, '▾')]),
      el('div', { class: 'insp-content' }, content)
    ]);
    return sec;
  }

  /** Fade length of an audio block, in beats (stored in ticks) */
  function fadeRow(label, c, key) {
    const val = el('span', { class: 'val' }, ((c[key] || 0) / 4) + ' b');
    return el('div', { class: 'insp-row' }, [
      el('span', {}, label),
      el('input', { type: 'range', min: 0, max: Math.max(1, Math.min(64, c.len)), step: 1, value: c[key] || 0,
        oninput: e => { c[key] = +e.target.value; val.textContent = (c[key] / 4) + ' b'; SDAW.arrange.drawLanes(); },
        onchange: () => SDAW.store.mutate(label, () => {}) }),
      val
    ]);
  }

  /** Audio-arm button + MIDI output routing of a track */
  function ioSection(t) {
    const s = SDAW.store, MO = SDAW.midiOut;
    const mo = t.midiOut || {};
    const portSel = el('select', { 'data-help': 'Send the notes of this track to an external synth / sound module / other program',
      onchange: e => s.mutate('MIDI out', () => { if (!e.target.value) delete t.midiOut; else t.midiOut = Object.assign({ ch: t.type === 'drums' ? 10 : 1, local: true }, t.midiOut, { id: e.target.value }); }) },
      [el('option', { value: '' }, 'None (built-in sound)')].concat(MO.outputs().map(o => el('option', { value: o.id, selected: o.id === mo.id ? true : null }, o.name))));
    if (mo.id && !MO.port(mo.id)) portSel.appendChild(el('option', { value: mo.id, selected: true }, '(device not connected)'));
    const rows = [
      el('div', { class: 'insp-row' }, [el('span', {}, 'Audio input'),
        el('button', { class: 'chip-btn' + (t.recAudio ? ' on' : ''), 'data-help': 'Armed: Record (R) captures the microphone / guitar input chosen in Settings → Audio as an audio block on this track',
          onclick: () => SDAW.recorder.toggleArm(t) }, t.recAudio ? '🎙 Armed' : '🎙 Arm')]),
      el('div', { class: 'insp-row' }, [el('span', {}, 'MIDI out'), portSel])
    ];
    if (!MO.access) rows.push(el('div', { class: 'insp-row' }, [el('button', { class: 'btn small', 'data-help': 'Ask the browser for the list of MIDI outputs', onclick: async () => { await MO.init(); if (!MO.access) SDAW.toast('This browser has no Web MIDI (use Chrome or Edge) or access was refused'); SDAW.inspector.render(); } }, 'Find MIDI outputs…')]));
    if (mo.id) {
      rows.push(el('div', { class: 'insp-row' }, [el('span', {}, 'Channel'),
        el('select', { onchange: e => s.mutate('MIDI channel', () => { t.midiOut.ch = +e.target.value; }) },
          Array.from({ length: 16 }, (_, i) => el('option', { value: i + 1, selected: (mo.ch || 1) === i + 1 ? true : null }, String(i + 1) + (i === 9 ? ' (drums)' : ''))))]));
      rows.push(el('div', { class: 'insp-row' }, [el('span', {}, 'Built-in sound'),
        el('button', { class: 'chip-btn' + (mo.local !== false ? ' on' : ''), 'data-help': 'On: the program\'s own sound plays too. Off: only the external device sounds.',
          onclick: () => s.mutate('Local sound', () => { t.midiOut.local = t.midiOut.local === false; }) }, mo.local !== false ? 'Plays too' : 'Muted')]));
    }
    return rows;
  }

  /** Slider row bound to obj[key]; commit = undo point on release */
  function slider(label, obj, key, min, max, step, fmt, onLive) {
    const val = el('span', { class: 'val' }, fmt ? fmt(obj[key]) : obj[key]);
    return el('div', { class: 'insp-row' }, [
      el('span', {}, label),
      el('input', { type: 'range', min, max, step, value: obj[key],
        oninput: e => { obj[key] = +e.target.value; val.textContent = fmt ? fmt(obj[key]) : obj[key]; onLive && onLive(); },
        onchange: () => SDAW.store.mutate(label, () => {}) }),
      val
    ]);
  }

  ins.render = function () {
    const body = $('#inspBody');
    const keepScroll = body.scrollTop;
    body.innerHTML = '';
    const s = SDAW.store, t = s.selTrack();
    if (!t) { body.appendChild(el('div', { class: 'empty-msg' }, 'Select a track')); return; }
    const live = () => SDAW.audio.updateTrack(t);
    const pct = v => Math.round(v * 100) + '%';

    /* ---------- Track ---------- */
    body.appendChild(section('track', 'Track', [
      el('div', { class: 'insp-row' }, [el('span', {}, 'Name'), el('input', { type: 'text', value: t.name, onchange: e => s.mutate('Rename', () => { t.name = e.target.value; }) })]),
      slider('Volume', t, 'vol', 0, 1, 0.01, pct, live),
      slider('Pan', t, 'pan', -1, 1, 0.01, v => v === 0 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100), live),
      el('div', { class: 'insp-row' }, [
        el('span', {}, 'State'),
        el('button', { class: 'ms-btn m' + (t.mute ? ' on' : ''), onclick: () => s.mutate('Mute', () => { t.mute = !t.mute; }) }, 'M'),
        el('button', { class: 'ms-btn s' + (t.solo ? ' on' : ''), onclick: () => s.mutate('Solo', () => { t.solo = !t.solo; }) }, 'S'),
        el('span', { style: { marginLeft: 'auto', width: '14px', height: '14px', borderRadius: '50%', background: t.color, boxShadow: '0 0 8px ' + t.color } })
      ])
    ], '◉'));

    /* ---------- Sound Slot ---------- */
    const sameType = [];
    CONFIG.library.instruments.forEach(g => g.items.forEach(it => { if ((it.type === 'drums') === (t.type === 'drums')) sameType.push(it); }));
    // the track's own instrument (generator, real samples, genre instrument…) is listed first, so it is never shown wrongly
    const ownIsListed = sameType.some(it => it.name === t.instrument);
    const RG = SDAW.guitarRig, rig = RG && RG.isRigTrack(t) && !t.sampler;
    const PR = SDAW.pianoRig, prig = PR && PR.isRigTrack(t) && !t.sampler;
    const WR = SDAW.windRig, wrig = WR && WR.isRigTrack(t) && !t.sampler && WR.ok();
    const slot = section('sound', 'Sound Slot', [
      el('div', { class: 'inst-card' }, [
        el('span', { class: 'big-ico' }, rig ? (GL.TYPES[RG.model(t)].icon || '🎸') : prig ? (PL.TYPES[PR.model(t)].icon || '🎹') : wrig ? (WL.TYPES[WR.model(t)].icon || '🎷') : SDAW.TRACK_ICONS[t.type] || '🎵'),
        el('div', {}, [el('b', {}, t.instrument), el('small', {}, (t.sampler ? 'Real samples: ' + t.sampler.zones.length + ' zone(s) from your library' : rig ? 'Guitar Rig · real recordings, real amps and cabinets' : prig ? 'Piano Rig · ' + PL.TYPES[PR.model(t)].name : wrig ? 'Wind Rig · ' + WL.TYPES[WR.model(t)].name + ' (real recordings)' : 'Built-in preview engine') + ' · drop an instrument or a sample here')])
      ]),
      prig ? el('div', { class: 'insp-row rig-row' }, [
        el('button', { class: 'btn primary rig-open', 'data-help': 'Open the Piano Rig of this track: instrument, colour and brightness, pedal, strings, electric piano amp, synth, organ drawbars and rotary speaker, effects', onclick: () => SDAW.prigPanel.open(t.id) }, '🎹 Open Piano Rig…')
      ]) : null,
      prig ? el('div', { class: 'rig-status', id: 'inspPrigStatus' }, prigStatusText(t)) : null,
      wrig ? el('div', { class: 'insp-row rig-row' }, [
        el('button', { class: 'btn primary rig-open', 'data-help': 'Open the Wind Rig of this track: instrument, mute, phrasing (legato, staccato), vibrato, scoops and falls, breath and growl, section, microphone, effects', onclick: () => SDAW.wrigPanel.open(t.id) }, '🎷 Open Wind Rig…')
      ]) : null,
      wrig ? el('div', { class: 'rig-status', id: 'inspWrigStatus' }, wrigStatusText(t)) : null,
      rig ? el('div', { class: 'insp-row rig-row' }, [
        el('button', { class: 'btn primary rig-open', 'data-help': 'Open the Guitar Rig of this track: guitar model, colour and brightness, pickups, the 3D amplifier, cabinet, microphone and effects (also: double-click the track name)', onclick: () => SDAW.rigPanel.open(t.id) }, '🎸 Open Guitar Rig…')
      ]) : null,
      rig ? el('div', { class: 'rig-status', id: 'inspRigStatus' }, rigStatusText(t)) : null,
      t.sampler ? el('div', { class: 'insp-row' }, [el('span', {}, 'Sampler'), el('span', { class: 'val', style: { textAlign: 'left', flex: 1 } }, t.sampler.zones.map(z => SDAW.midiToName(z.root)).slice(0, 12).join(' ') + (t.sampler.zones.length > 12 ? ' …' : '')),
        el('button', { class: 'chip-btn', 'data-help': 'Go back to the built-in sound', onclick: () => s.mutate('Built-in sound', () => { t.sampler = null; t.instrument = SDAW.findInstrument(null, t.type).name; }) }, '✕')]) : null,
      t.type === 'drums' && Object.keys(t.drumMap || {}).length ? el('div', { class: 'insp-row' }, [el('span', {}, 'Pads'), el('span', { class: 'val', style: { textAlign: 'left', flex: 1 } }, Object.keys(t.drumMap).length + ' pads use your samples')]) : null,
      el('div', { class: 'insp-row' }, [el('span', {}, 'Engine'), el('select', { 'data-help': 'Sound engine of this track (set by the instrument or generator you choose).', disabled: true },
        ENGINES.map(en => el('option', { selected: en.id === t.engine ? true : null }, en.name)))]),
      el('div', { class: 'insp-row' }, [el('span', {}, 'Instrument'), el('select', { 'data-help': 'Replace the sound of this track. The notes stay the same.', onchange: e => { if (e.target.value !== '__own') SDAW.applyInstrument(SDAW.findInstrument(e.target.value), t.id); } },
        (ownIsListed ? [] : [el('option', { value: '__own', selected: true }, t.instrument + ' (current)')]).concat(sameType.map(it => el('option', { value: it.name, selected: ownIsListed && it.name === t.instrument ? true : null }, it.name))))]),
      el('div', { class: 'insp-row' }, [el('button', { class: 'btn', style: { width: '100%' }, onclick: () => listen(t) }, '▶ Listen')])
    ], '🔊');
    SDAW.makeDropTarget(slot, 'instrument sample file finst kit', async p => {
      if (p.kind === 'instrument') return SDAW.applyInstrument(p, t.id);
      if (p.kind === 'finst') return SDAW.factory.applyInstrument(p.instId, t.type !== 'drums' ? t : null);
      if (p.kind === 'kit') return t.type === 'drums' ? SDAW.factory.applyKit(p.kitId, t) : SDAW.toast('Kits go on drum tracks');
      if (p.kind === 'sample' && p.factoryId && t.type === 'drums') return SDAW.factory.assignToPad(p.factoryId, t);
      if (p.kind === 'file') { const id = await SDAW.samples.importFile(p.files[0], p.files[0].name); return SDAW.sampleAsInstrument({ sampleId: id, name: p.files[0].name }, t.id); }
      SDAW.sampleAsInstrument(p, t.id);
    });
    body.appendChild(slot);

    /* ---------- Selected block ---------- */
    const fc = s.sel.clipId ? s.findClip(s.sel.clipId) : null;
    if (fc && fc.track === t) {
      const c = fc.clip, p = c.kind === 'pattern' ? s.pattern(c.patternId) : null;
      const bar = SDAW.barText(c.start), B = SDAW.barTicks();
      body.appendChild(section('block', 'Selected Block', [
        el('div', { class: 'insp-row' }, [el('span', {}, p ? 'Pattern' : 'Audio'), el('b', { style: { color: '#fff' } }, p ? p.name : ((s.song.samples.find(x => x.id === c.sampleId) || {}).name || 'Audio'))]),
        el('div', { class: 'insp-row' }, [el('span', {}, 'Position'), el('span', {}, 'bar ' + bar + ' · ' + (c.len / B).toFixed(c.len % B ? 2 : 0) + ' bars long')]),
        p ? el('div', { class: 'insp-row' }, [el('span', {}, 'Linked'), el('span', {}, 'used in ' + s.patternUses(p.id) + ' block(s)'),
          el('button', { class: 'chip-btn on', 'data-help': 'Give this block its own copy of the pattern', onclick: () => s.makeUnique(c.id) }, 'Make unique')]) : slider('Block volume', c, 'gain', 0, 2, 0.01, v => Math.round(v * 100) + '%'),
        p ? null : fadeRow('Fade in', c, 'fadeIn'),
        p ? null : fadeRow('Fade out', c, 'fadeOut'),
        p ? null : el('div', { class: 'insp-row' }, [el('span', {}, 'Direction'),
          el('button', { class: 'chip-btn' + (c.reverse ? ' on' : ''), 'data-help': 'Play this audio block backwards', onclick: () => s.mutate('Reverse block', () => { c.reverse = !c.reverse; }) }, c.reverse ? '⇆ Reversed' : '→ Forward')]),
        el('div', { class: 'insp-row' }, [
          el('button', { class: 'btn small', onclick: () => s.duplicateClip(c.id) }, 'Duplicate'),
          el('button', { class: 'btn small', 'data-help': 'Cut the block in two at the cursor (S in the Arrange)', onclick: () => { if (!s.splitClip(c.id, s.sel.cursor)) SDAW.toast('Click inside the block where you want the cut, then Split'); } }, '✂ Split'),
          el('button', { class: 'btn small', onclick: () => s.deleteClip(c.id) }, 'Delete')
        ])
      ], '▦'));
    }

    /* ---------- Recording + MIDI Out ---------- */
    if (SDAW.desktop && SDAW.desktop.on) body.appendChild(section('plugins', 'Plugins (VST3 / CLAP)', SDAW.desktop.inspectorRows(t), '🔌'));
    body.appendChild(section('io', 'Recording & MIDI Out', ioSection(t), '⇄'));

    /* ---------- Articulations (selected notes) ---------- */
    if (t.type !== 'drums') {
      const notes = s.selNotes();
      const arts = [['Sustain', null, '♩'], ['Palm Mute', 'pm', 'P.M.'], ['Harmonic', 'harm', '◇'], ['Slide', 'slide', '⟋'], ['Hammer-On', 'h', 'H'], ['Pull-Off', 'p', 'P'], ['Bend', 'bend', '⤴'], ['Vibrato', 'vib', '∿'], ['Dead Note', 'mute', '×']];
      body.appendChild(section('arts', 'Articulations', [
        el('div', { class: 'insp-row', style: { marginTop: 0 } }, notes.length ? notes.length + ' note(s) selected' : 'Select notes in the score, tab or piano roll'),
        el('div', { class: 'art-grid' }, arts.map(([name, key, sym]) => {
          const on = notes.length && (key ? notes.every(n => n.tech && n.tech[key]) : notes.every(n => !n.tech || !Object.keys(n.tech).filter(k => k !== 'strum').length));
          return el('button', { class: 'art-btn' + (on ? ' on' : ''), disabled: notes.length ? null : true, 'data-help': name + ' — applies to the selected notes',
            onclick: () => key ? s.setTechnique(key) : s.mutate('Sustain', () => notes.forEach(n => { n.tech = n.tech && n.tech.strum ? { strum: n.tech.strum } : {}; })) },
          [el('span', { class: 'sym' }, sym), name]);
        }))
      ], '🎯'));
    }

    /* ---------- Guitar techniques (track playing style) ---------- */
    if (rig) {
      const T = t.technique;
      body.appendChild(section('tech', 'Guitar Techniques', [
        slider('Bend Range', T, 'bendRange', 0.5, 3, 0.5, v => v + ' st'),
        slider('Slide Time', T, 'slideTime', 0.03, 0.4, 0.01, v => Math.round(v * 1000) + ' ms'),
        el('div', { class: 'model-desc' }, 'Vibrato, attack, palm mute, strum speed and the human feel of this guitar are in the Guitar Rig panel → 🤘 Playing.')
      ], '🎸'));
    } else if (t.type === 'guitar' || t.type === 'bass') {
      const T = t.technique;
      body.appendChild(section('tech', 'Guitar Techniques', [
        slider('Bend Range', T, 'bendRange', 0.5, 3, 0.5, v => v + ' st'),
        slider('Vibrato Depth', T, 'vibDepth', 0, 1, 0.01, pct),
        slider('Vibrato Speed', T, 'vibSpeed', 2, 9, 0.1, v => v.toFixed(1) + ' Hz'),
        slider('Slide Time', T, 'slideTime', 0.03, 0.4, 0.01, v => Math.round(v * 1000) + ' ms'),
        el('div', { class: 'pro-only' }, [
          slider('Humanize', T, 'humanize', 0, 1, 0.01, pct),
          slider('Pick Attack', T, 'attack', 0, 1, 0.01, pct),
          slider('String Resonance', T, 'resonance', 0, 1, 0.01, pct)
        ])
      ], '🎸'));
    }

    /* ---------- Pedalboard ---------- */
    t.fx = SDAW.normalizePedals(t.fx);
    const PT = SDAW.PEDAL_TYPES;
    if (!PT.find(p => p.key === ins.pedal)) ins.pedal = 'dist';
    const pedals = el('div', { class: 'pedals' }, PT.map(pt => {
      const f = t.fx[pt.key], m = SDAW.pedalModel(pt.key, f.model);
      const dark = ['#1f1f24', '#2b2b30', '#3a3a3a', '#3a3a40', '#5a5a62', '#7a1f1f'].includes(m.color);
      return el('div', {
        class: 'pedal' + (f.on ? ' on' : '') + (ins.pedal === pt.key ? ' selected' : ''),
        style: { background: `linear-gradient(180deg, ${m.color}, ${m.color}bb)`, color: dark || m.color === '#2d6b4f' ? '#fff' : '#111' },
        'data-help': pt.name + ' — ' + m.name + '. Click = select (model and knobs below) · double-click = on/off',
        onclick: () => { ins.pedal = pt.key; ins.render(); },
        ondblclick: () => s.mutate('Pedal', () => { f.on = !f.on; })
      }, [el('div', { class: 'knobs' }, [el('i'), el('i'), el('i')]), el('b', {}, m.short), el('small', {}, pt.label), el('span', { class: 'led' })]);
    }));
    const chain = PT.filter(pt => t.fx[pt.key].on).map(pt => SDAW.pedalModel(pt.key, t.fx[pt.key].model).short).join(' → ') || 'No pedals on';
    const cur = PT.find(p => p.key === ins.pedal), cf = t.fx[cur.key], cm = SDAW.pedalModel(cur.key, cf.model);
    const fmt = (k) => k[5] === 'dB' ? (v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB') : k[5] === 'sync' ? (v => SDAW.DELAY_SYNC[Math.round(v)].name) : pct;
    const knobs = cur.knobs.map(k => slider(k[1], cf, k[0], k[2], k[3], k[4], fmt(k), live));
    const pb = section('pedals', 'Pedalboard (Track FX)', [
      rig ? el('div', { class: 'model-desc' }, '🎸 This track has its own amp, cabinet and effects in the Guitar Rig. Pedals switched on here are added after it.') : null,
      prig ? el('div', { class: 'model-desc' }, '🎹 This track has its own effects in the Piano Rig. Pedals switched on here are added after it.') : null,
      wrig ? el('div', { class: 'model-desc' }, '🎷 This track has its own microphone, room and effects in the Wind Rig. Pedals switched on here are added after it.') : null,
      pedals,
      el('div', { class: 'chain-label' }, chain),
      el('div', { class: 'pedal-editor', style: { borderColor: cm.color + '88' } }, [
        el('div', { class: 'insp-row' }, [
          el('b', { style: { color: '#fff', minWidth: '92px' } }, cur.name),
          el('button', { class: 'toggle-btn' + (cf.on ? ' on' : ''), 'data-help': 'Switch this pedal on / off', onclick: () => s.mutate('Pedal', () => { cf.on = !cf.on; }) }, cf.on ? 'ON' : 'OFF')
        ]),
        el('div', { class: 'insp-row' }, [el('span', {}, 'Model'),
          el('select', { 'data-help': 'Which classic unit this pedal simulates', onchange: e => s.mutate('Pedal model', () => { cf.model = e.target.value; cf.on = true; }) },
            SDAW.PEDAL_MODELS[cur.key].map(m => el('option', { value: m.id, selected: m.id === cm.id ? true : null }, m.name)))]),
        el('div', { class: 'model-desc' }, cm.desc)
      ].concat(knobs))
    ], '🎛️');
    SDAW.makeDropTarget(pb, 'effect preset', p => p.kind === 'effect' ? SDAW.applyEffect(t, p.effect, true) : SDAW.applyPreset(t, p.preset));
    body.appendChild(pb);

    /* ---------- Note properties (Pro) ---------- */
    const sn = s.selNotes();
    if (sn.length && t.type !== 'drums') {
      const n = sn[0];
      body.appendChild(section('note', 'Note Properties', [
        slider('Velocity', n, 'vel', 1, 127, 1, v => String(v), null),
        el('div', { class: 'insp-row' }, [el('span', {}, 'Length'), el('select', { onchange: e => s.mutate('Length', () => sn.forEach(q => { q.dur = +e.target.value; })) },
          CONFIG.grid.durations.map(d => el('option', { value: d.ticks, selected: d.ticks === n.dur ? true : null }, d.name)))]),
        el('div', { class: 'insp-row' }, [el('span', {}, 'Pitch'), el('b', { style: { color: '#fff' } }, SDAW.midiToName(n.pitch) + (n.fret !== undefined ? '   ·   string ' + (t.type === 'bass' ? 4 - n.string : 6 - n.string) + ', fret ' + n.fret : ''))])
      ], '♪', 'pro-only'));
    }
    body.scrollTop = keepScroll;
  };

  /** one line: where the sound comes from (recordings loading…, real amp…) */
  function rigStatusText(t) {
    const st = SDAW.guitarRig.status(t);
    return [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text + (st.amp ? ' · ' + st.amp : ''))];
  }

  function prigStatusText(t) {
    const st = SDAW.pianoRig.status(t);
    return [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text)];
  }

  function wrigStatusText(t) {
    const st = SDAW.windRig.status(t);
    return [el('span', { class: 'rig-dot ' + st.level }), el('span', {}, st.text)];
  }

  ins.init = function () {
    SDAW.bus.on('wrig', () => {
      const box = document.getElementById('inspWrigStatus'), t = SDAW.store.selTrack();
      if (box && t && SDAW.windRig.isRigTrack(t)) { box.innerHTML = ''; wrigStatusText(t).forEach(n => box.appendChild(n)); }
    });
    SDAW.bus.on('prig', () => {
      const box = document.getElementById('inspPrigStatus'), t = SDAW.store.selTrack();
      if (box && t && SDAW.pianoRig.isRigTrack(t)) { box.innerHTML = ''; prigStatusText(t).forEach(n => box.appendChild(n)); }
    });
    SDAW.bus.on('rig', () => {
      const box = document.getElementById('inspRigStatus'), t = SDAW.store.selTrack();
      if (box && t && SDAW.guitarRig.isRigTrack(t)) { box.innerHTML = ''; rigStatusText(t).forEach(n => box.appendChild(n)); }
    });
    SDAW.bus.on('change', ins.render);
    SDAW.bus.on('selection', e => { if (!e || e.type !== 'cursor') ins.render(); });
  };

})(window.SDAW);
