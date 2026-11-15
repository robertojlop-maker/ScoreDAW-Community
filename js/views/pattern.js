/* =============================================================================
 *  PATTERN.JS — CHANNEL RACK (like FL Studio) + shared pattern toolbar
 *  -----------------------------------------------------------------------------
 *  The Pattern panel shows EVERY instrument of the song as a channel — drums,
 *  bass, keys, guitars and generators (3x Osc, Sampler, Trumpet…) — with the
 *  One step per 16th of the CURRENT bar (16 in 4/4, 12 in 3/4 or 6/8…;
 *  ◀ Bar ▶ moves through the song).
 *
 *    Drum channel        click ▸ to open its pads (Kick, Snare, Hi-hat…)
 *    Generator channel   click a step = a note on that 16th (the root of the
 *                        chord of that moment, the full chord, or the key root —
 *                        "Step note" in the toolbar), click again = remove
 *    Every step you put goes into the block of that channel in that bar of the
 *    song. No block yet? It is created (1 bar). Blocks of the same pattern are
 *    LINKED: "×3" means 3 blocks share it — click it to make this one unique.
 *
 *    Drag from the Library (Generators / Synths / Sounds → Instruments):
 *      onto the rack (empty area)  = new channel with that generator
 *      onto a channel name         = that channel now uses that sound
 *    🎛 = edit the generator (knobs, F8) · 🎹 = open the bar in the Piano Roll
 *    → = repeat this block in the next bar · ▶ Loop bar = hear all channels
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const BAR = () => SDAW.barTicks();          // bar length of the song (time signature)
  const pat = {};
  SDAW.pattern = pat;
  const rack = { open: {}, stepMode: 'root', stepLen: 1, looping: false };
  pat.rack = rack;

  const S = () => SDAW.store;
  const curBar = () => Math.floor(S().sel.cursor / BAR());

  /** The block (clip + pattern + offset inside the pattern) of a track in a bar */
  function blockAt(t, bar) {
    const s = S(), c = s.clipAt(t, bar * BAR());
    if (!c || c.kind !== 'pattern') return null;
    const p = s.pattern(c.patternId); if (!p || !p.length) return null;
    return { clip: c, p, off: ((bar * BAR() - c.start + (c.offsetTicks || 0)) % p.length + p.length) % p.length };
  }

  /** Pattern shown by the editor tools (selected track at the cursor, else the selected pattern) */
  function current() {
    const s = S(), t = s.selTrack();
    if (t) { const b = blockAt(t, curBar()); if (b) return b.p; }
    const p = s.selPattern();
    if (p) return p;
    return s.song.patterns.find(x => x.kind === 'drums') || null;
  }
  pat.current = current;

  /** Chord symbol sounding at a tick (or the key chord) */
  function chordAt(tick) {
    const song = S().song;
    let sym = null; (song.chords || []).forEach(c => { if (c.tick <= tick) sym = c; });
    const p = sym && SDAW.parseChord(sym.name);
    if (p) return p;
    const d = SDAW.diatonicChord(song.key, song.scale, 1);
    return { root: d.root, intervals: d.intervals, name: d.name };
  }
  /** Pitches a step writes for a track at a tick */
  function stepPitches(t, tick) {
    const song = S().song, ch = chordAt(tick);
    const bassy = t.type === 'bass' || /bass/i.test(t.instrument || '');
    const lo = bassy ? 31 : t.type === 'guitar' ? 52 : 60;
    const fold = pc => lo + ((pc - lo) % 12 + 12) % 12;
    if (rack.stepMode === 'key') return [fold(SDAW.noteIndex(song.key))];
    const root = fold(bassy && ch.bass !== undefined ? ch.bass : ch.root);
    if (rack.stepMode === 'chord' && !bassy) return ch.intervals.slice(0, 3).map(iv => root + iv);
    if (rack.stepMode === 'octave') return [root, root + 12];
    return [root];
  }

  /* ============================================================ RENDER == */
  pat.render = function () {
    const view = $('#view-pattern');
    view.innerHTML = '';
    const s = S(), song = s.song, bar = curBar();
    const sec = (song.sections || []).find(x => bar >= x.start && bar < x.start + x.length);
    const rk = el('div', { class: 'rack', style: '--steps:' + BAR() });   // one step column per 16th of the bar

    // ---- header: bar navigation, loop, add channel
    rk.appendChild(el('div', { class: 'rack-head' }, [
      el('button', { class: 'tool-btn', 'data-help': 'Previous bar', onclick: () => s.setCursor(Math.max(0, bar - 1) * BAR()) }, '◀'),
      el('div', { class: 'rack-bar' }, [el('b', {}, 'Bar ' + (bar + 1)), sec ? el('span', { class: 'rack-sec', style: { background: sec.color || '#555' } }, sec.name) : null]),
      el('button', { class: 'tool-btn', 'data-help': 'Next bar', onclick: () => s.setCursor(Math.min(song.bars - 1, bar + 1) * BAR()) }, '▶'),
      el('button', { class: 'tool-btn labeled' + (rack.looping ? ' on' : ''), 'data-help': 'Loop this bar with ALL the channels (click again to stop)', onclick: toggleLoop }, rack.looping ? '■ Stop loop' : '🔁 Loop bar'),
      el('span', { class: 'spacer' }),
      el('span', { class: 'rack-hint' }, 'Drag a generator / instrument from the Library here = new channel · onto a channel = change its sound'),
      el('button', { class: 'btn small primary', 'data-help': 'Add a channel (instrument or generator)', onclick: addChannelMenu }, '＋ Channel')
    ]));
    rk.appendChild(el('div', { class: 'rack-nums' }, [el('span'), el('span')].concat(Array.from({ length: BAR() }, (_, i) => { const bt = SDAW.beatTicks(); return el('span', { class: i % bt === 0 ? 'beat' : '' }, i % bt === 0 ? String(i / bt + 1) : '·'); }))));

    if (!song.tracks.length) rk.appendChild(el('div', { class: 'empty-msg' }, 'No channels yet — drag a generator from the Library here or press ＋ Channel.'));
    song.tracks.forEach(t => { if (t.type === 'drums') drumChannel(rk, t, bar); else noteChannel(rk, t, bar); });
    view.appendChild(rk);

    // drop on the rack = new channel (generator / instrument), grooves / kits on the selected drum track
    SDAW.makeDropTarget(view, 'instrument finst rhythm kit', async pl => {
      if (pl.kind === 'instrument') { const t = SDAW.addTrackFromInstrument(pl); rack.open[t.id] = true; return; }
      if (pl.kind === 'finst') return SDAW.factory.applyInstrument(pl.instId, null);
      const dt = s.selTrack() && s.selTrack().type === 'drums' ? s.selTrack() : song.tracks.find(x => x.type === 'drums');
      if (!dt) return SDAW.toast('Add a drum channel first');
      if (pl.kind === 'kit') return SDAW.factory.applyKit(pl.kitId, dt);
      if (pl.kind === 'rhythm') { const b = ensureDrumBlock(dt, bar); SDAW.loadGrooveInto(b.p, pl.genre); }
    });
  };

  /** Common left part of a channel: name, generator, buttons */
  function channelHead(t, bar, opts) {
    const s = S(), sel = s.sel.trackId === t.id, b = blockAt(t, bar);
    const uses = b ? s.patternUses(b.p.id) : 0;
    const name = el('div', { class: 'ch-name' + (sel ? ' sel' : ''), style: { '--cc': t.color },
      'data-help': t.name + ' — click = select · double-click = edit its generator (F8) · drop a generator / sound here to change it',
      onclick: () => { s.selectTrack(t.id); if (opts && opts.toggle) opts.toggle(); },
      ondblclick: () => { s.selectTrack(t.id); if (t.engine === 'rig' && SDAW.rigPanel) SDAW.rigPanel.open(t.id); else if (t.engine === 'pianorig' && SDAW.prigPanel) SDAW.prigPanel.open(t.id); else if (t.engine === 'windrig' && SDAW.wrigPanel) SDAW.wrigPanel.open(t.id); else SDAW.app.showView('instrument'); } }, [
      opts && opts.toggle ? el('span', { class: 'ch-caret' }, rack.open[t.id] ? '▾' : '▸') : el('span', { class: 'ch-dot' }),
      el('div', { class: 'ch-txt' }, [el('b', {}, t.name), el('small', {}, (SDAW.TRACK_ICONS[t.type] || '') + ' ' + (t.instrument || ''))])
    ]);
    SDAW.makeDropTarget(name, 'instrument finst kit sample', async pl => {
      if (pl.kind === 'instrument') { if ((pl.type === 'drums') !== (t.type === 'drums')) return SDAW.toast(t.type === 'drums' ? 'Drop a drum kit here' : 'Drop a melodic generator here'); SDAW.applyInstrument(pl, t.id); return; }
      if (pl.kind === 'finst') return SDAW.factory.applyInstrument(pl.instId, t);
      if (pl.kind === 'kit' && t.type === 'drums') return SDAW.factory.applyKit(pl.kitId, t);
      if (t.type !== 'drums') {   // a single sample = sampler instrument of this channel
        const id = await SDAW.resolveSample(pl);
        s.mutate('Sample instrument', () => { SDAW.registerSample(id); t.sampler = { zones: [{ sampleId: id, root: SDAW.samples.rootFromName(pl.name || '') || 60 }] }; t.instrument = pl.name || 'Sample'; });
      } else SDAW.toast('Open the drum channel (▸) and drop the sound on a pad');
    });
    const btn = (txt, help, fn, cls) => el('button', { class: 'ch-btn' + (cls ? ' ' + cls : ''), 'data-help': help, onclick: e => { e.stopPropagation(); fn(e); } }, txt);
    const tools = el('div', { class: 'ch-tools' }, [
      btn('🔊', 'Listen to this channel', () => t.type === 'drums' ? SDAW.audio.previewDrum(t, 'kick') : SDAW.audio.previewNote(t, stepPitches(t, bar * BAR())[0], { dur: 0.6 })),
      t.engine === 'windrig' ? btn('🎷', 'Open the Wind Rig of this channel: instrument, mute, legato, vibrato, breath, section, effects', () => { s.selectTrack(t.id); SDAW.wrigPanel.open(t.id); }, 'rig') :
      t.engine === 'pianorig' ? btn('🎹', 'Open the Piano Rig of this channel: instrument, pedal, strings, amp, organ, effects', () => { s.selectTrack(t.id); SDAW.prigPanel.open(t.id); }, 'rig') :
      t.engine === 'rig' ? btn('🎸', 'Open the Guitar Rig of this channel: pickups, 3D amp, cabinet, mic, EQ, effects', () => { s.selectTrack(t.id); SDAW.rigPanel.open(t.id); }, 'rig')
        : btn('🎛', 'Edit the generator / sound of this channel (Generator view, F8)', () => { s.selectTrack(t.id); SDAW.app.showView('instrument'); }),
      t.type !== 'drums' ? btn('🎹', 'Open this bar in the Piano Roll (melodies, chords, lengths)', () => openPianoRoll(t, bar)) : null,
      btn('M', 'Mute', () => s.mutate('Mute', () => { t.mute = !t.mute; }), t.mute ? 'on mute' : ''),
      btn('S', 'Solo', () => s.mutate('Solo', () => { t.solo = !t.solo; }), t.solo ? 'on solo' : ''),
      b && uses > 1 ? btn('×' + uses, 'This block is LINKED to ' + uses + ' blocks (editing changes all). Click = make this one unique', () => s.makeUnique(b.clip.id), 'link') : null,
      b ? btn('→', 'Repeat this block in the next bar (linked) and go there', () => repeatNext(t, bar)) : null
    ]);
    return { name, tools, block: b };
  }

  /* --------------------------------------------------- note channel --- */
  function noteChannel(rk, t, bar) {
    const { name, tools, block } = channelHead(t, bar);
    const steps = el('div', { class: 'seq-steps rack-steps' });
    const hits = {};
    if (block && block.p.kind === 'notes') block.p.notes.forEach(n => {
      const rel = n.start - block.off;
      if (rel >= -0.001 && rel < BAR()) { const i = Math.floor(rel + 0.001); (hits[i] = hits[i] || []).push(n); }
    });
    for (let i = 0, N = BAR(); i < N; i++) {
      const on = hits[i];
      const label = on ? SDAW.midiToName(Math.max(...on.map(n => n.pitch))).replace(/(\d)/, '$1') : '';
      steps.appendChild(el('div', {
        class: 'step' + (i % SDAW.beatTicks() === 0 ? ' beat' : '') + (on ? ' on' : ''), 'data-step': i,
        style: on ? { background: t.color, color: t.color, opacity: 0.55 + Math.min(0.45, on.length * 0.15) } : null,
        'data-help': on ? on.length + ' note(s): ' + on.map(n => SDAW.midiToName(n.pitch)).join(' ') + ' — click = remove' : 'Click = add a note here (' + ({ root: 'chord root', chord: 'full chord', key: 'key root', octave: 'root + octave' }[rack.stepMode]) + ')',
        onmousedown: () => toggleNoteStep(t, bar, i)
      }, on ? el('span', { class: 'step-lbl' }, label) : null));
    }
    rk.appendChild(el('div', { class: 'rack-row' + (t.mute ? ' muted' : '') }, [name, tools, steps]));
  }
  function toggleNoteStep(t, bar, i) {
    const s = S(), tick = bar * BAR() + i;
    const b = blockAt(t, bar);
    if (b && b.p.kind === 'notes') {
      const local = (b.off + i) % b.p.length;
      const here = b.p.notes.filter(n => Math.floor(n.start + 0.001) === local);
      if (here.length) { s.mutate('Remove step', () => { b.p.notes = b.p.notes.filter(n => !here.includes(n)); }); return; }
    }
    const pitches = stepPitches(t, tick);
    s.mutate('Add step', () => {
      const tg = s.editTarget(t, tick, true); if (!tg) return;
      const used = new Set();
      pitches.forEach(p => {
        const n = { id: SDAW.uid('n'), start: tg.local, dur: rack.stepLen, pitch: p, vel: 96, tech: {} };
        const pos = t.type === 'bass' ? SDAW.autoFretBass(p) : t.type === 'guitar' ? SDAW.autoFret(p, used, 5) : null;
        if (pos) { n.string = pos.string; n.fret = pos.fret; used.add(pos.string); }
        tg.pattern.notes.push(n);
      });
      tg.pattern.notes.sort((a, c) => a.start - c.start || a.pitch - c.pitch);
      s.sel.patternId = tg.pattern.id; s.sel.trackId = t.id;
    });
    if (pitches.length > 1) SDAW.audio.previewChord(t, pitches); else SDAW.audio.previewNote(t, pitches[0], { dur: 0.35 });
  }

  /* --------------------------------------------------- drum channel --- */
  function ensureDrumBlock(t, bar) {
    let b = blockAt(t, bar);
    if (b && b.p.kind === 'drums') return b;
    const s = S();
    s.mutate('New beat', () => {
      const n = s.song.patterns.filter(p => p.kind === 'drums').length + 1;
      const p = SDAW.makePattern('drums', t.name + ' Beat ' + n, BAR());
      s.song.patterns.push(p);
      s.placePattern(t, p, bar * BAR(), BAR());
      s.sel.patternId = p.id;
    });
    return blockAt(t, bar);
  }
  function drumChannel(rk, t, bar) {
    const s = S();
    if (rack.open[t.id] === undefined) rack.open[t.id] = s.sel.trackId === t.id || !s.song.tracks.some(x => x.type === 'drums' && rack.open[x.id]);
    const toggle = () => { rack.open[t.id] = !rack.open[t.id]; pat.render(); };
    const { name, tools, block } = channelHead(t, bar, { toggle });
    const val = (row, i) => (block && block.p.kind === 'drums') ? (block.p.drum.rows[row] || [])[(block.off + i) % block.p.length] || 0 : 0;
    // compact summary (all pads together)
    const steps = el('div', { class: 'seq-steps rack-steps' });
    for (let i = 0, N = BAR(); i < N; i++) {
      const on = SDAW.DRUM_ROWS.filter(r => val(r.id, i) > 0);
      steps.appendChild(el('div', { class: 'step mini' + (i % SDAW.beatTicks() === 0 ? ' beat' : '') + (on.length ? ' on' : ''), 'data-step': i,
        style: on.length ? { background: `linear-gradient(${on.map(r => r.color).join(',')}${on.length === 1 ? ',' + on[0].color : ''})`, color: on[0].color } : null,
        'data-help': on.length ? on.map(r => r.name).join(' + ') : 'Open the channel (▸) to edit its pads', onmousedown: toggle }));
    }
    rk.appendChild(el('div', { class: 'rack-row drum' + (t.mute ? ' muted' : '') }, [name, tools, steps]));
    if (!rack.open[t.id]) return;
    // pads
    const pads = SDAW.DRUM_ROWS.filter(r => {
      if (!block || block.p.kind !== 'drums') return true;
      const any = (block.p.drum.rows[r.id] || []).some(v => v > 0);
      return any || ['kick', 'snare', 'hhc', 'hho', 'clap', 'crash'].includes(r.id) || (t.drumMap && t.drumMap[r.id]);
    });
    pads.forEach(r => {
      const mapped = t.drumMap && t.drumMap[r.id] ? (s.song.samples.find(x => x.id === t.drumMap[r.id]) || {}).name : null;
      const pname = el('div', { class: 'pad-name', 'data-help': r.name + ' — click to hear · drop a sound here (Library → Sounds) to change it · right-click = choose / built-in',
        onclick: () => SDAW.audio.previewDrum(t, r.id),
        oncontextmenu: e => { e.preventDefault(); SDAW.contextMenu(e, [
          ['🎧 Choose a real sound in the Library…', () => SDAW.library.showPadSounds(r.id)], ['▶ Listen', () => SDAW.audio.previewDrum(t, r.id)],
          t.drumMap[r.id] ? ['↺ Back to the built-in sound', () => s.mutate('Pad sound', () => { delete t.drumMap[r.id]; })] : null].filter(Boolean)); } },
        [el('span', { class: 'rdot', style: { background: r.color, boxShadow: '0 0 8px ' + r.color } }), r.name, mapped ? el('small', { class: 'pad-sample' }, '🔊 ' + mapped.replace(/\.[^.]+$/, '')) : null]);
      SDAW.makeDropTarget(pname, 'sample file', async pl => {
        try { const id = await SDAW.resolveSample(pl); s.mutate('Pad sound', () => { SDAW.registerSample(id); t.drumMap[r.id] = id; }); setTimeout(() => SDAW.audio.previewDrum(t, r.id), 50); }
        catch (e) { SDAW.toast(e.message); }
      });
      const ps = el('div', { class: 'seq-steps rack-steps' });
      for (let i = 0, N = BAR(); i < N; i++) {
        const v = val(r.id, i);
        ps.appendChild(el('div', { class: 'step' + (i % SDAW.beatTicks() === 0 ? ' beat' : '') + (v ? ' on' : ''), 'data-step': i,
          style: v ? { background: r.color, opacity: 0.45 + v * 0.55, color: r.color, borderColor: '#fff4' } : null,
          onmousedown: e => {
            const b = ensureDrumBlock(t, bar); const arr = b.p.drum.rows[r.id], k = (b.off + i) % b.p.length;
            s.mutate('Step', () => { arr[k] = arr[k] ? (e.shiftKey && arr[k] < 1 ? 1 : 0) : (e.shiftKey ? 1 : 0.75); });
            if (arr[k]) SDAW.audio.previewDrum(t, r.id);
          } }));
      }
      rk.appendChild(el('div', { class: 'rack-row pad' }, [pname, el('div'), ps]));
    });
  }

  /* ---------------------------------------------------------- actions --- */
  function openPianoRoll(t, bar) {
    const s = S();
    s.selectTrack(t.id);
    let b = blockAt(t, bar);
    if (!b) { s.mutate('New block', () => { s.editTarget(t, bar * BAR(), true); }); b = blockAt(t, bar); }
    if (b) s.selectPattern(b.p.id);
    SDAW.app.showView('pianoroll');
  }
  function repeatNext(t, bar) {
    const s = S(), b = blockAt(t, bar); if (!b) return;
    s.mutate('Repeat block', () => {
      const c = s.placePattern(t, b.p, (bar + 1) * BAR(), BAR());
      c.offsetTicks = (b.off + BAR()) % b.p.length || undefined;
      if (!c.offsetTicks) delete c.offsetTicks;
    });
    s.setCursor((bar + 1) * BAR());
  }
  function toggleLoop() {
    const A = SDAW.audio, bar = curBar();
    if (rack.looping) { rack.looping = false; A.stop(); A.loop = { on: true, start: 0, end: null }; pat.render(); return; }
    if (A.playing) A.stop();
    A.patternMode = false;
    A.loop = { on: true, start: bar * BAR(), end: bar * BAR() + BAR() };
    rack.looping = true;
    A.play(bar * BAR());
    pat.render();
  }
  SDAW.bus.on('transport', e => { if (e && !e.playing && rack.looping) { rack.looping = false; SDAW.audio.loop = { on: true, start: 0, end: null }; if (SDAW.app.view === 'pattern') pat.render(); } });
  function addChannelMenu(e) {
    const items = [];
    CONFIG.library.instruments.forEach(g => g.items.forEach(it => items.push([g.icon + '  ' + it.name, () => { const t = SDAW.addTrackFromInstrument(it); rack.open[t.id] = true; }])));
    items.push(null);
    (SDAW.GENERATORS || []).forEach(g => { if (g.group === '3x Osc Synth') g.items.slice(0, 6).forEach(it => items.push(['🎛️  ' + it.name, () => SDAW.addTrackFromInstrument(it)])); });
    items.push(['🎛️  Sampler (empty)…', () => { const it = SDAW.GENERATORS.flatMap(g => g.items).find(x => x.params && x.params.sampler); if (it) SDAW.addTrackFromInstrument(it); }]);
    SDAW.contextMenu(e, items);
  }

  /* ============================================ SHARED PATTERN TOOLBAR == */
  /**
   * Pattern selector + New / Clone / Rename / Delete / Length / Place.
   * kind: 'drums' | 'notes'
   */
  SDAW.patternBar = function (box, kind, p) {
    const s = SDAW.store, A = SDAW.patternActions;
    const list = s.song.patterns.filter(x => x.kind === kind);
    box.appendChild(el('span', { class: 'bar-label' }, 'Pattern:'));
    box.appendChild(el('select', { class: 'track-pick', 'data-help': 'Pattern being edited. All blocks of this pattern change together.', onchange: e => s.selectPattern(e.target.value) },
      list.length ? list.map(x => el('option', { value: x.id, selected: p && x.id === p.id ? true : null }, x.name + ' (×' + s.patternUses(x.id) + ')')) : [el('option', {}, '— no pattern —')]));
    box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Create a new empty pattern', onclick: () => A.create(kind) }, '＋ New'));
    if (!p) return;
    box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Rename this pattern', onclick: () => A.rename(p) }, '✎ Rename'));
    box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Duplicate this pattern (a copy you can change separately)', onclick: () => A.clone(p) }, '⧉ Clone'));
    box.appendChild(el('button', { class: 'tool-btn labeled danger', 'data-help': 'Delete this pattern (and its blocks in the song)', onclick: () => A.remove(p) }, '🗑 Delete'));
    box.appendChild(el('select', { 'data-help': 'Pattern length', onchange: e => s.mutate('Pattern length', () => SDAW.setPatternLength(p, +e.target.value)) },
      [1, 2, 4, 8].map(b => el('option', { value: b * BAR(), selected: p.length === b * BAR() ? true : null }, b + (b === 1 ? ' bar' : ' bars')))));
    box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Place this pattern as a block at the cursor of the selected track', onclick: () => SDAW.placePatternAtCursor(p.id) }, '⇩ Place'));
  };

  pat.tools = function (box) {
    const s = S(), t = s.selTrack();
    box.appendChild(el('span', { class: 'bar-label' }, 'Step note:'));
    box.appendChild(el('select', { 'data-help': 'What a step writes on a melodic channel (follows the chord of that moment)', onchange: e => { rack.stepMode = e.target.value; } },
      [['root', 'Chord root'], ['chord', 'Full chord'], ['octave', 'Root + octave'], ['key', 'Key root']].map(([v, l]) => el('option', { value: v, selected: rack.stepMode === v ? true : null }, l))));
    box.appendChild(el('select', { 'data-help': 'Length of the notes a step writes', onchange: e => { rack.stepLen = +e.target.value; } },
      [[1, '1/16'], [2, '1/8'], [4, '1/4'], [8, '1/2']].map(([v, l]) => el('option', { value: v, selected: rack.stepLen === v ? true : null }, l))));
    if (t && t.type === 'drums') {
      box.appendChild(el('select', { 'data-help': 'Load a style groove into this bar of the selected drum channel', onchange: e => { if (e.target.value) { const b = ensureDrumBlock(t, curBar()); SDAW.loadGrooveInto(b.p, e.target.value); } } },
        [el('option', { value: '' }, 'Groove…')].concat(CONFIG.library.genres.map(g => el('option', { value: g }, g)))));
    }
    if (t) box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Clear the selected channel in this bar', onclick: () => {
      const b = blockAt(t, curBar()); if (!b) return;
      s.mutate('Clear bar', () => {
        if (b.p.kind === 'drums') SDAW.DRUM_ROWS.forEach(r => { for (let i = 0, N = BAR(); i < N; i++) b.p.drum.rows[r.id][(b.off + i) % b.p.length] = 0; });
        else b.p.notes = b.p.notes.filter(n => n.start < b.off || n.start >= b.off + BAR());
      });
    } }, 'Clear bar'));
    // pattern actions in ONE compact menu (the toolbar never overflows)
    const p = current();
    if (p) {
      const A = SDAW.patternActions;
      box.appendChild(el('button', { class: 'tool-btn labeled', 'data-help': 'Pattern of the selected channel in this bar: rename, clone, delete, length, place', onclick: e => SDAW.contextMenu(e, [
        ['✎ Rename "' + p.name + '"', () => A.rename(p)],
        ['⧉ Clone (a copy to change separately)', () => A.clone(p)],
        ['＋ New empty pattern', () => A.create(p.kind)],
        ['⇩ Place at the cursor of the selected track', () => SDAW.placePatternAtCursor(p.id)],
        null,
        ...[1, 2, 4, 8].map(b => [(p.length === b * BAR() ? '● ' : '○ ') + 'Length: ' + b + (b === 1 ? ' bar' : ' bars'), () => s.mutate('Pattern length', () => SDAW.setPatternLength(p, b * BAR()))]),
        null,
        ['🗑 Delete pattern (and its blocks)', () => A.remove(p)]
      ]) }, '▤ ' + (p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name) + ' ▾'));
    }
  };

  pat.updatePlayhead = function (tick) {
    let step = -1;
    if (SDAW.audio.playing && (SDAW.audio.patternMode || Math.floor(tick / BAR()) === curBar())) step = Math.floor(tick) % BAR();
    if (pat.lastStep === step) return;
    pat.lastStep = step;
    SDAW.$$('#view-pattern .step.now').forEach(n => n.classList.remove('now'));
    if (step >= 0) SDAW.$$('#view-pattern .step[data-step="' + step + '"]').forEach(n => n.classList.add('now'));
  };

})(window.SDAW);
