/* =============================================================================
 *  ARRANGE.JS — Song / Arrange view: build the song with blocks (clips)
 *  -----------------------------------------------------------------------------
 *  Blocks = pattern clips (drums or notes) and audio clips.
 *    click block            select (its pattern opens in the editors)
 *    drag block             move  (snaps to bars; hold Alt = snap to beats)
 *    Ctrl + drag            copy  (linked: same pattern)
 *    drag right edge        make longer / shorter (the pattern repeats inside)
 *    double-click block     open it in the editor (Pattern / Piano Roll / Score+Tab)
 *    right-click block      make unique, rename, duplicate, delete…
 *    Delete / Ctrl+D        delete / duplicate the selected block
 *    double-click empty     new block here (drum track: current beat; melodic: new pattern)
 *  Drops: pattern / rhythm / progression / sample / audio files from Windows go
 *  where you drop them; instrument / preset / effect go to that track.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const BAR = () => SDAW.barTicks();          // bar length of the song (time signature)
  /** Snap a tick to the click grid: quarter notes (x/4 meters) or eighths (x/8 meters) */
  const snapBeat = (t, round) => { const q = SDAW.timeSig().den === 8 ? 2 : 4; return (round ? Math.round(t / q) : Math.floor(t / q)) * q; };
  const ICONS = { guitar: '🎸', bass: '🎸', keys: '🎹', strings: '🎻', synth: '🎛️', drums: '🥁' };
  SDAW.TRACK_ICONS = ICONS;
  const RULER_H = 46;

  const arr = { tickW: CONFIG.ui.arrangeTickWidth, auto: {} };   // auto: trackId -> 'vol' | 'pan' (automation lane shown)
  SDAW.arrange = arr;

  const headW = () => CONFIG.ui.trackHeaderWidth;
  const trackH = () => CONFIG.ui.trackHeight;

  arr.render = function () {
    const s = SDAW.store, song = s.song;
    const scroll = $('#arrScroll');
    const keepX = scroll.scrollLeft, keepY = scroll.scrollTop;
    const W = (s.songTicks() + 4 * BAR()) * arr.tickW;     // 4 empty bars to drop into
    scroll.innerHTML = '';
    const inner = el('div', { class: 'arr-inner', style: { width: (headW() + W) + 'px' } });

    /* ---- ruler ---- */
    const rulerRow = el('div', { class: 'arr-ruler-row', style: { height: RULER_H + 'px' } });
    rulerRow.appendChild(el('div', { class: 'arr-corner', style: { width: headW() + 'px', minWidth: headW() + 'px' } }, 'Bars · Sections'));
    const ruler = el('canvas', { 'data-help': 'Timeline: click to move the playhead. Sections: double-click to rename / add, Shift+click to loop a section, right-click to delete.' });
    ruler.width = W; ruler.height = RULER_H; ruler.style.width = W + 'px'; ruler.style.height = RULER_H + 'px';
    drawRuler(ruler.getContext('2d'), W);
    ruler.addEventListener('mousedown', e => {
      const tick = Math.floor(e.offsetX / arr.tickW);
      if (e.offsetY > 22) {
        const sec = secAt(tick);
        if (sec && e.button === 2) return;
        if (sec && e.shiftKey) { SDAW.audio.loop = { on: true, start: sec.start * BAR(), end: (sec.start + sec.length) * BAR() }; SDAW.app.syncTransport(); arr.render(); SDAW.toast('Looping section: ' + sec.name); return; }
        if (sec) { SDAW.audio.seek(sec.start * BAR()); return; }
      }
      SDAW.audio.seek(snapBeat(tick, true));
    });
    ruler.addEventListener('contextmenu', e => {
      e.preventDefault();
      const bar = Math.floor(e.offsetX / arr.tickW / BAR());
      const insert = ['＋ Insert empty bars before bar ' + (bar + 1) + '…', () => SDAW.ask('How many empty bars to insert before bar ' + (bar + 1) + '?', '4', v => s.insertBars(bar, SDAW.clamp(parseInt(v, 10) || 0, 0, 64)))];
      const sec = secAt(Math.floor(e.offsetX / arr.tickW));
      if (!sec) { SDAW.contextMenu(e, [insert]); return; }
      SDAW.contextMenu(e, [
        insert,
        ['Rename section…', () => SDAW.ask('Rename section', sec.name, v => s.mutate('Rename section', () => { sec.name = v; }))],
        ['Loop this section', () => { SDAW.audio.loop = { on: true, start: sec.start * BAR(), end: (sec.start + sec.length) * BAR() }; SDAW.app.syncTransport(); arr.render(); }],
        ['Length: ' + sec.length + ' bars — change…', () => SDAW.ask('Section length (bars)', String(sec.length), v => s.mutate('Section length', () => { sec.length = Math.max(1, parseInt(v, 10) || sec.length); }))],
        null,
        ['Delete section', () => s.mutate('Delete section', song => { song.sections = song.sections.filter(x => x !== sec); })]
      ]);
    });
    ruler.addEventListener('dblclick', e => {
      if (e.offsetY <= 22) return;
      const tick = Math.floor(e.offsetX / arr.tickW);
      const sec = secAt(tick);
      if (sec) SDAW.ask('Rename section', sec.name, v => s.mutate('Rename section', () => { sec.name = v; }));
      else {
        const bar = Math.floor(tick / BAR());
        SDAW.ask('New section name (starts at bar ' + (bar + 1) + ', 4 bars)', 'Verse', v => s.mutate('Add section', song => {
          song.sections.push({ id: SDAW.uid('s'), name: v, start: bar, length: 4, color: ['#3fa9ff', '#2bdc7a', '#ffb02e', '#9b5cff'][song.sections.length % 4] });
          song.sections.sort((a, b) => a.start - b.start);
        }));
      }
    });
    rulerRow.appendChild(ruler);
    inner.appendChild(rulerRow);

    /* ---- headers + lanes ---- */
    const rows = el('div', { class: 'arr-rows' });
    song.tracks.forEach((t, i) => rows.appendChild(trackRow(t, i)));
    const H = Math.max(1, song.tracks.length * trackH());
    const lanes = el('canvas', { class: 'arr-lanes', 'data-help': 'Blocks: drag = move · Ctrl+drag = copy · right edge = length · double-click = edit · right-click = options. Double-click empty space = new block.' });
    lanes.width = W; lanes.height = H;
    lanes.style.left = headW() + 'px'; lanes.style.width = W + 'px'; lanes.style.height = H + 'px';
    arr.lanes = lanes;
    drawLanes();
    lanes.addEventListener('mousedown', onLaneDown);
    lanes.addEventListener('dblclick', onLaneDbl);
    lanes.addEventListener('contextmenu', onLaneMenu);
    rows.appendChild(lanes);

    SDAW.makeDropTarget(rows, 'instrument preset effect rhythm pattern progression sample file kit finst plugin', (p, e) => {
      const { tick, track } = posFromEvent(e, rows);
      if (p.kind === 'plugin') { SDAW.desktop.drop(p, track); return; }
      if (!track) { if (p.kind === 'instrument') SDAW.addTrackFromInstrument(p); else if (p.kind === 'finst') SDAW.factory.applyInstrument(p.instId, null); else if (p.kind === 'file' || p.kind === 'sample') dropAudioNewTrack(p, tick); return; }
      if (p.kind === 'kit') { if (track.type === 'drums') SDAW.factory.applyKit(p.kitId, track); else SDAW.toast('Drop a kit on a drum track'); return; }
      if (p.kind === 'finst') { if (track.type !== 'drums') SDAW.factory.applyInstrument(p.instId, track); else SDAW.factory.applyInstrument(p.instId); return; }
      if (p.kind === 'sample' && p.factoryId && track.type === 'drums') { SDAW.factory.assignToPad(p.factoryId, track); return; }
      if (p.kind === 'instrument') SDAW.applyInstrument(p, track.id);
      else if (p.kind === 'preset') SDAW.applyPreset(track, p.preset);
      else if (p.kind === 'effect') SDAW.applyEffect(track, p.effect, true);
      else if (p.kind === 'rhythm') SDAW.createGroove(p.genre, track.type === 'drums' ? track.id : null, tick);
      else if (p.kind === 'pattern') SDAW.placePatternAtCursor(p.patternId, track.id, tick);
      else if (p.kind === 'progression') { s.sel.trackId = track.id; SDAW.insertProgressionAtCursor(p.genre, Math.floor(tick / BAR())); }
      else if (p.kind === 'sample') SDAW.placeSampleAtCursor(p, track.id, tick);
      else if (p.kind === 'file') SDAW.dropFiles(p.files, track.id, snapBeat(tick));
    });
    inner.appendChild(rows);

    const empty = el('div', { class: 'arr-empty-drop', style: { width: (headW() + W) + 'px' }, 'data-help': 'Drop an instrument or audio files here to create a new track' }, '＋ Drop an instrument or audio files here to create a new track');
    SDAW.makeDropTarget(empty, 'instrument sample file finst', (p) => p.kind === 'instrument' ? SDAW.addTrackFromInstrument(p) : p.kind === 'finst' ? SDAW.factory.applyInstrument(p.instId, null) : dropAudioNewTrack(p, 0));
    inner.appendChild(empty);

    arr.playhead = el('div', { class: 'arr-playhead', style: { height: (RULER_H + H) + 'px' } });
    inner.appendChild(arr.playhead);
    scroll.appendChild(inner);
    scroll.scrollLeft = keepX; scroll.scrollTop = keepY;
    arr.updatePlayhead(SDAW.audio.getTick());
  };

  function secAt(tick) { return SDAW.store.song.sections.find(sc => tick >= sc.start * BAR() && tick < (sc.start + sc.length) * BAR()); }

  async function dropAudioNewTrack(p, tick) {
    const t = SDAW.addTrackFromInstrument(SDAW.findInstrument('String Ensemble'));
    SDAW.store.mutate('Audio track', () => { t.name = 'Audio ' + SDAW.store.song.tracks.length; t.instrument = 'Audio'; });
    if (p.kind === 'file') await SDAW.dropFiles(p.files, t.id, tick || 0);
    else await SDAW.placeSampleAtCursor(p, t.id, tick || 0);
  }

  /** Mouse position -> { tick, track, x, y } in lane coordinates */
  function posFromEvent(e, node) {
    const lanes = arr.lanes, r = lanes.getBoundingClientRect(), sc = r.width / lanes.offsetWidth;
    const x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
    const track = SDAW.store.song.tracks[Math.floor(y / trackH())] || null;
    return { x, y, tick: Math.max(0, Math.floor(x / arr.tickW)), track: y >= 0 ? track : null };
  }

  function clipHit(track, x) {
    if (!track) return null;
    const tick = x / arr.tickW;
    return track.clips.find(c => tick >= c.start && tick < c.start + c.len) || null;
  }
  const compatible = (track, clip) => {
    if (clip.kind === 'audio') return true;
    const p = SDAW.store.pattern(clip.patternId);
    return p && (track.type === 'drums') === (p.kind === 'drums');
  };

  /* ------------------------------------------------------- mouse ---- */
  function onLaneDown(e) {
    if (e.button !== 0) return;
    SDAW.app.focusZone = 'arrange';
    const s = SDAW.store;
    const pos = posFromEvent(e);
    const t = pos.track; if (!t) return;
    if (arr.auto[t.id]) { autoDown(e, t, pos); return; }
    const hit = clipHit(t, pos.x);
    if (!hit) {
      s.sel.clipId = null;
      s.selectTrack(t.id);
      s.setCursor(snapBeat(pos.tick));
      return;
    }
    s.selectClip(t.id, hit.id);
    const edgeX = (hit.start + hit.len) * arr.tickW;
    const resize = pos.x > edgeX - 8;
    const copy = e.ctrlKey || e.metaKey;
    const orig = { start: hit.start, len: hit.len, trackId: t.id };
    let moved = false, clip = hit, owner = t;
    const snapOf = (ev) => ev.altKey ? 4 : BAR();
    const mv = (ev) => {
      const q = posFromEvent(ev);
      const dx = q.tick - pos.tick;
      const snap = snapOf(ev);
      if (!moved) {
        if (Math.abs(q.x - pos.x) < 4 && Math.abs(q.y - pos.y) < 4) return;
        moved = true;
        s.beginEdit();
        if (copy && !resize) {          // Ctrl+drag: leave the original, move a copy
          clip = Object.assign({}, hit, { id: SDAW.uid('clp') });
          owner.clips.push(clip);
        }
      }
      if (resize) {
        clip.len = Math.max(snap === BAR() ? BAR() : 1, Math.round((orig.len + dx) / snap) * snap || snap);
        if (clip.kind === 'audio') clip.len = Math.max(1, orig.len + dx);
      } else {
        clip.start = Math.max(0, Math.round((orig.start + dx) / snap) * snap);
        const target = q.track;
        if (target && target !== owner && compatible(target, clip)) {
          owner.clips = owner.clips.filter(c => c !== clip);
          target.clips.push(clip); owner = target;
          s.sel.trackId = target.id;
        }
      }
      drawLanes();
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (!moved) {                     // plain click on a block: the cursor goes there (split point)
        s.sel.cursor = e.altKey ? pos.tick : snapBeat(pos.tick);
        drawLanes();
        return;
      }
      // remove what the moved / resized block now covers
      s.carve(owner, clip.start, clip.len, clip);
      s.sel.clipId = clip.id;
      s.endEdit(resize ? 'Resize block' : copy ? 'Copy block' : 'Move block');
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  }

  function onLaneDbl(e) {
    const s = SDAW.store, pos = posFromEvent(e), t = pos.track; if (!t) return;
    const hit = clipHit(t, pos.x);
    if (hit) { openClip(t, hit); return; }
    const start = Math.floor(pos.tick / BAR()) * BAR();
    if (t.type === 'drums') {
      let p = s.selPattern();
      if (!p || p.kind !== 'drums') { const c = t.clips.find(x => x.kind === 'pattern'); p = c ? s.pattern(c.patternId) : null; }
      if (!p) { p = SDAW.rhythmPattern('Pop'); s.mutate('New beat', song => song.patterns.push(p)); }
      let clip; s.mutate('Place beat', () => { clip = s.placePattern(t, p, start, p.length); });
      s.selectClip(t.id, clip.id);
    } else {
      let clip;
      s.mutate('New pattern', song => {
        const p = SDAW.makePattern('notes', t.name + ' ' + (song.patterns.filter(x => x.kind === 'notes').length + 1), BAR(), t.color);
        song.patterns.push(p); clip = s.placePattern(t, p, start, BAR());
      });
      s.sel.cursor = start;
      s.selectClip(t.id, clip.id);
      SDAW.app.showView(t.type === 'guitar' || t.type === 'bass' ? 'scoretab' : 'pianoroll');
      SDAW.toast('New empty pattern — write notes with the fretboard, piano or tab');
    }
  }

  function openClip(t, c) {
    const s = SDAW.store;
    s.selectClip(t.id, c.id);
    if (c.kind === 'audio') return SDAW.toast('Audio block — drag the right edge to shorten it, right-click for options');
    const p = s.pattern(c.patternId);
    s.sel.cursor = c.start;
    if (p.kind === 'drums') SDAW.app.showView('pattern');
    else SDAW.app.showView(t.type === 'guitar' || t.type === 'bass' ? 'scoretab' : 'pianoroll');
    if (p.kind !== 'drums') SDAW.notation.scrollToTick(c.start);
  }

  function onLaneMenu(e) {
    e.preventDefault();
    const s = SDAW.store, pos = posFromEvent(e), t = pos.track; if (!t) return;
    if (arr.auto[t.id]) { autoMenu(e, t, pos); return; }
    const hit = clipHit(t, pos.x);
    if (!hit) {
      SDAW.contextMenu(e, [
        ['＋ New block here', () => onLaneDbl(e)],
        s.selPattern() ? ['Place pattern "' + s.selPattern().name + '" here', () => SDAW.placePatternAtCursor(s.sel.patternId, t.id, pos.tick)] : null,
        ['Paste last copied block', () => pasteClip(t, pos.tick)]
      ].filter(x => x !== null));
      return;
    }
    s.selectClip(t.id, hit.id);
    const p = hit.kind === 'pattern' ? s.pattern(hit.patternId) : null;
    const items = [['✎ Edit', () => openClip(t, hit)]];
    if (p) {
      items.push(['Make unique (edit only this block)', () => s.makeUnique(hit.id)]);
      items.push(['✎ Rename pattern…', () => SDAW.patternActions.rename(p)]);
      items.push(['🗑 Delete pattern (and all its blocks)…', () => SDAW.patternActions.remove(p)]);
      items.push(['Fit block to pattern length', () => s.mutate('Fit block', () => { hit.len = p.length; })]);
    } else {
      items.push(['Use this sound as instrument of the track', () => { const sm = s.song.samples.find(x => x.id === hit.sampleId); SDAW.sampleAsInstrument({ sampleId: hit.sampleId, name: sm ? sm.name : '' }, t.id); }]);
      items.push(['Volume of block…', () => SDAW.ask('Block volume (0 – 2)', String(hit.gain || 1), v => s.mutate('Block volume', () => { hit.gain = SDAW.clamp(parseFloat(v) || 1, 0, 2); }))]);
      const beats = v => (v || 0) / 4;
      items.push(['◢ Fade in… (' + beats(hit.fadeIn) + ' beats)', () => SDAW.ask('Fade in length in beats (0 = none)', String(beats(hit.fadeIn)), v => s.mutate('Fade in', () => { hit.fadeIn = SDAW.clamp(Math.round((parseFloat(v) || 0) * 4), 0, hit.len); }))]);
      items.push(['◣ Fade out… (' + beats(hit.fadeOut) + ' beats)', () => SDAW.ask('Fade out length in beats (0 = none)', String(beats(hit.fadeOut)), v => s.mutate('Fade out', () => { hit.fadeOut = SDAW.clamp(Math.round((parseFloat(v) || 0) * 4), 0, hit.len); }))]);
      items.push([(hit.reverse ? '✓ ' : '') + '⇆ Reverse', () => s.mutate('Reverse block', () => { hit.reverse = !hit.reverse; })]);
    }
    const cut = s.sel.cursor > hit.start && s.sel.cursor < hit.start + hit.len ? s.sel.cursor : (pos.tick > hit.start ? snapBeat(pos.tick) : -1);
    if (cut > hit.start && cut < hit.start + hit.len) items.push(['✂ Split at bar ' + SDAW.barText(cut) + ' (S)', () => s.splitClip(hit.id, cut)]);
    items.push(['Copy', () => { arr.clipboard = Object.assign({}, hit); SDAW.toast('Block copied — right-click empty space to paste'); }]);
    items.push(['Duplicate after (Ctrl+D)', () => s.duplicateClip(hit.id)]);
    items.push(null);
    items.push(['Delete block (Del)', () => s.deleteClip(hit.id)]);
    SDAW.contextMenu(e, items);
  }

  function pasteClip(t, tick) {
    const c = arr.clipboard; if (!c) return SDAW.toast('Nothing copied yet');
    if (!compatible(t, c)) return SDAW.toast('That block does not fit this kind of track');
    const s = SDAW.store;
    s.mutate('Paste block', () => {
      const n = Object.assign({}, c, { id: SDAW.uid('clp'), start: Math.floor(tick / BAR()) * BAR() });
      s.carve(t, n.start, n.len);
      t.clips.push(n); t.clips.sort((a, b) => a.start - b.start);
      s.sel.clipId = n.id;
    });
  }

  /* --------------------------------------------------- track header -- */
  function trackRow(t, i) {
    const s = SDAW.store;
    const sel = s.sel.trackId === t.id;
    const head = el('div', {
      class: 'trk-head' + (sel ? ' sel' : ''), style: { width: headW() + 'px', minWidth: headW() + 'px' },
      'data-help': 'Track "' + t.name + '" — click to select, double-click the name to rename, right-click for more options.',
      onmousedown: () => { SDAW.app.focusZone = 'arrange'; s.selectTrack(t.id); },
      oncontextmenu: (e) => { e.preventDefault(); trackMenu(t, e); }
    }, [
      el('div', { class: 'trk-num', style: { background: t.color, boxShadow: '0 0 10px ' + t.color + '88' } }, String(i + 1)),
      el('span', { class: 'trk-ico' }, ICONS[t.type] || '🎵'),
      el('div', { class: 'trk-name', ondblclick: () => SDAW.ask('Rename track', t.name, v => s.mutate('Rename track', () => { t.name = v; })) },
        [t.name, el('small', {}, (t.sampler ? '🔊 ' : '') + t.instrument)]),
      el('button', { class: 'ms-btn m' + (t.mute ? ' on' : ''), 'data-help': 'Mute this track', onmousedown: e => e.stopPropagation(), onclick: () => s.mutate('Mute', () => { t.mute = !t.mute; }) }, 'M'),
      el('button', { class: 'ms-btn s' + (t.solo ? ' on' : ''), 'data-help': 'Solo: hear only soloed tracks', onmousedown: e => e.stopPropagation(), onclick: () => s.mutate('Solo', () => { t.solo = !t.solo; }) }, 'S'),
      t.type !== 'drums' || t.recAudio ? el('button', { class: 'ms-btn rec' + (t.recAudio ? ' on' : ''), 'data-help': 'Arm for audio recording: Record (R) captures the microphone / guitar input (Settings → Audio) as an audio block on this track', onmousedown: e => e.stopPropagation(), onclick: () => SDAW.recorder.toggleArm(t) }, '🎙') : null,
      el('button', { class: 'ms-btn auto' + (arr.auto[t.id] ? ' on' : '') + (t.auto && ((t.auto.vol || []).length || (t.auto.pan || []).length) ? ' has' : ''), 'data-help': 'Automation: show the volume / pan line of this track over its blocks (click to cycle Volume → Pan → off)', onmousedown: e => e.stopPropagation(), onclick: () => cycleAuto(t) }, 'A'),
      el('input', { type: 'range', class: 'trk-vol pro-only', min: 0, max: 1, step: 0.01, value: t.vol, 'data-help': 'Track volume',
        onmousedown: e => e.stopPropagation(),
        oninput: e => { t.vol = +e.target.value; SDAW.audio.updateTrack(t); },
        onchange: () => s.mutate('Volume', () => {}) })
    ]);
    return el('div', { class: 'arr-row', style: { height: trackH() + 'px' } }, [head]);
  }

  function trackMenu(t, e) {
    const s = SDAW.store;
    SDAW.contextMenu(e, [
      ...(t.engine === 'rig' && SDAW.rigPanel ? [['🎸 Guitar Rig… (amp, pickups, effects)', () => SDAW.rigPanel.open(t.id)], null] : []),
      ...(t.engine === 'pianorig' && SDAW.prigPanel ? [['🎹 Piano Rig… (pedal, strings, organ, effects)', () => SDAW.prigPanel.open(t.id)], null] : []),
      ...(t.engine === 'windrig' && SDAW.wrigPanel ? [['🎷 Wind Rig… (mute, legato, vibrato, effects)', () => SDAW.wrigPanel.open(t.id)], null] : []),
      ['Rename…', () => SDAW.ask('Rename track', t.name, v => s.mutate('Rename track', () => { t.name = v; }))],
      ['Duplicate track', () => s.mutate('Duplicate track', song => {
        const c = SDAW.deepCopy(t); c.id = SDAW.uid('trk'); c.name = t.name + ' (copy)';
        c.clips.forEach(cl => { cl.id = SDAW.uid('clp'); });
        song.tracks.splice(song.tracks.indexOf(t) + 1, 0, c);
      })],
      ['Move up', () => s.mutate('Move track', song => { const i = song.tracks.indexOf(t); if (i > 0) { song.tracks.splice(i, 1); song.tracks.splice(i - 1, 0, t); } })],
      ['Move down', () => s.mutate('Move track', song => { const i = song.tracks.indexOf(t); if (i < song.tracks.length - 1) { song.tracks.splice(i, 1); song.tracks.splice(i + 1, 0, t); } })],
      ['Automation: Volume line', () => showAuto(t, 'vol')],
      ['Automation: Pan line', () => showAuto(t, 'pan')],
      arr.auto[t.id] ? ['Hide automation', () => showAuto(t, null)] : null,
      t.auto ? ['Clear all automation of this track', () => s.mutate('Clear automation', () => { delete t.auto; })] : null,
      [(t.recAudio ? '✓ ' : '') + '🎙 Arm for audio recording', () => SDAW.recorder.toggleArm(t)],
      ['🎙 Record audio here… (Recording Studio)', () => SDAW.recStudio.open({ track: t.id })],
      t.sampler ? ['Back to the built-in sound', () => s.mutate('Built-in sound', () => { t.sampler = null; t.instrument = SDAW.findInstrument(null, t.type).name; })] : null,
      null,
      ['Remove all blocks', () => s.mutate('Clear track', () => { t.clips = []; })],
      ['Delete track', () => { s.mutate('Delete track', song => { song.tracks = song.tracks.filter(x => x !== t); }); SDAW.audio.removeTrack(t.id); s.validateSelection(); SDAW.bus.emit('selection', { type: 'track' }); }]
    ].filter(x => x !== null || true));
  }

  /* ---------------------------------------------------------- drawing -- */
  function drawRuler(g, W) {
    const song = SDAW.store.song, tw = arr.tickW;
    g.fillStyle = '#0d0f24'; g.fillRect(0, 0, W, RULER_H);
    g.font = '12px Segoe UI, sans-serif';
    const total = Math.ceil(W / (BAR() * tw));
    for (let b = 0; b <= total; b++) {
      const x = b * BAR() * tw;
      const inSong = b < song.bars;
      g.fillStyle = inSong ? 'rgba(200,190,255,.5)' : 'rgba(200,190,255,.15)'; g.fillRect(x, 0, 1, 22);
      if (b < total) { g.fillStyle = inSong ? '#c9c6f0' : '#555a88'; g.fillText(String(b + 1), x + 4, 15); }
      for (let bt = SDAW.beatTicks(), q = bt; q < BAR() - 0.01; q += bt) { g.fillStyle = 'rgba(200,190,255,.15)'; g.fillRect(x + q * tw, 14, 1, 8); }
    }
    const L = SDAW.audio.loop;
    if (L.on && L.end !== null) { g.fillStyle = 'rgba(34,224,255,.18)'; g.fillRect(L.start * tw, 0, (L.end - L.start) * tw, 22); g.fillStyle = '#22e0ff'; g.fillRect(L.start * tw, 20, (L.end - L.start) * tw, 2); }
    song.sections.forEach(sc => {
      const x = sc.start * BAR() * tw + 1, w = sc.length * BAR() * tw - 2;
      g.fillStyle = sc.color + 'cc'; roundRect(g, x, 24, w, 20, 5); g.fill();
      g.fillStyle = '#fff'; g.font = '600 12.5px Segoe UI, sans-serif';
      g.save(); g.beginPath(); g.rect(x, 24, w, 20); g.clip();
      g.fillText(sc.name, x + w / 2 - g.measureText(sc.name).width / 2, 38); g.restore();
    });
  }

  function drawLanes() {
    const cv = arr.lanes; if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width;
    const s = SDAW.store, song = s.song, tw = arr.tickW, th = trackH();
    g.clearRect(0, 0, W, cv.height);
    song.tracks.forEach((t, i) => {
      const y = i * th;
      g.fillStyle = s.sel.trackId === t.id ? 'rgba(155,92,255,.10)' : (i % 2 ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.08)');
      g.fillRect(0, y, W, th);
      for (let b = 0; b * BAR() * tw <= W; b++) { g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.04)'; g.fillRect(b * BAR() * tw, y, 1, th); }
      t.clips.forEach(c => drawClip(g, t, c, y, th, tw));
      if (arr.auto[t.id]) drawAuto(g, t, arr.auto[t.id], y, th, tw, W);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y + th - 1, W, 1);
    });
    const si = song.tracks.findIndex(t => t.id === s.sel.trackId);
    if (si >= 0) { g.fillStyle = '#ffd23f'; g.fillRect(s.sel.cursor * tw, si * th, 2, th); }
  }
  arr.drawLanes = drawLanes;

  function drawClip(g, t, c, y, th, tw) {
    const s = SDAW.store;
    const x = c.start * tw + 1, w = Math.max(3, c.len * tw - 2), top = y + 3, h = th - 6;
    const sel = s.sel.clipId === c.id;
    const p = c.kind === 'pattern' ? s.pattern(c.patternId) : null;
    const col = (p && p.color) || t.color;
    const grd = g.createLinearGradient(0, top, 0, top + h);
    grd.addColorStop(0, col + '66'); grd.addColorStop(1, col + '26');
    g.fillStyle = grd; roundRect(g, x, top, w, h, 6); g.fill();
    g.save();
    g.strokeStyle = sel ? '#ffffff' : col; g.lineWidth = sel ? 2 : 1.2; g.shadowColor = sel ? '#fff' : col; g.shadowBlur = sel ? 10 : 5;
    roundRect(g, x, top, w, h, 6); g.stroke(); g.restore();
    g.save(); g.beginPath(); g.rect(x, top, w, h); g.clip();
    // title
    g.fillStyle = '#fff'; g.font = '600 10.5px Segoe UI';
    const title = p ? p.name : ((s.song.samples || []).find(x2 => x2.id === c.sampleId) || {}).name || 'Audio';
    g.fillText(title, x + 5, top + 11);
    if (p) {
      // repeats markers
      const L = p.length, o = (c.offsetTicks || 0) % L;
      for (let k = (L - o) % L || L; k < c.len; k += L) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect((c.start + k) * tw, top + 2, 1, h - 4); }
      if (p.kind === 'drums') {
        for (let k = 0; k < c.len; k++) SDAW.DRUM_ROWS.forEach((r, ri) => {
          const v = p.drum.rows[r.id][(o + k) % L]; if (!v) return;
          g.fillStyle = col; g.globalAlpha = 0.5 + v * 0.5;
          g.fillRect((c.start + k) * tw + 1, top + 14 + ri * ((h - 16) / SDAW.DRUM_ROWS.length), Math.max(2, tw - 2), 2);
        });
        g.globalAlpha = 1;
      } else if (p.notes.length) {
        let lo = 127, hi = 0; p.notes.forEach(n => { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); });
        const span = Math.max(12, hi - lo);
        g.fillStyle = col;
        p.notes.forEach(n => {
          if (n.start >= L) return;
          const ny = top + h - 4 - ((n.pitch - lo) / span) * (h - 18);
          for (let k = ((n.start - o) % L + L) % L; k < c.len; k += L)
            g.fillRect((c.start + k) * tw + 1, ny, Math.max(2, Math.min(n.dur, c.len - k) * tw - 1), 2.2);
        });
      }
    } else {
      const pk = SDAW.samples.peaks(c.sampleId);
      const buf = SDAW.samples.buffer(c.sampleId);
      g.fillStyle = col;
      if (pk && buf) {
        const td = SDAW.audio.tickDur(), ticksLen = buf.duration / td;
        const t0 = (c.offsetTicks || 0) + (c.offset || 0) / td;               // where the block starts in the sound
        const region = Math.min(c.len, ticksLen - t0);
        const mid = top + 8 + (h - 8) / 2, amp = (h - 12) / 2;
        for (let px = 0; px < w; px++) {
          const u = px / tw; if (u > region) break;
          const tk = c.reverse ? t0 + region - u : t0 + u;
          const v = pk[Math.max(0, Math.min(pk.length - 1, Math.floor(tk / ticksLen * pk.length)))];
          g.fillRect(x + px, mid - v * amp, 1, Math.max(1, v * amp * 2));
        }
        if (c.reverse) { g.fillStyle = '#fff'; g.fillText('⇆ reversed', x + w - 62, top + 11); }
      } else { g.fillStyle = '#ffffff88'; g.fillText('loading…', x + 5, top + 26); }
      // fades: dark wedges + the gain line
      g.fillStyle = 'rgba(0,0,0,.45)'; g.strokeStyle = '#ffffffaa'; g.lineWidth = 1;
      if (c.fadeIn) { const fw = c.fadeIn * tw; g.beginPath(); g.moveTo(x, top); g.lineTo(x + fw, top); g.lineTo(x, top + h); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, top + h); g.lineTo(x + fw, top); g.stroke(); }
      if (c.fadeOut) { const fw = c.fadeOut * tw, xe = x + w; g.beginPath(); g.moveTo(xe, top); g.lineTo(xe - fw, top); g.lineTo(xe, top + h); g.closePath(); g.fill(); g.beginPath(); g.moveTo(xe - fw, top); g.lineTo(xe, top + h); g.stroke(); }
    }
    g.restore();
    // resize handle
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + w - 4, top + h / 2 - 6, 2, 12);
  }

  /* ------------------------------------------------- automation lanes --
   * The volume (0..1) or pan (L..R) line of a track drawn over its lane.
   * Click = add a point (and drag it) · drag a point = move it ·
   * right-click a point = delete it · right-click elsewhere = lane menu.  */
  const AUTO = {
    vol: { label: 'Volume', min: 0, max: 1, def: t => t.vol, fmt: v => Math.round(v * 100) + '%', color: '#ffd23f' },
    pan: { label: 'Pan', min: -1, max: 1, def: t => t.pan || 0, fmt: v => Math.abs(v) < 0.02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100), color: '#22e0ff' }
  };
  const autoY = (k, v, y, th) => { const A = AUTO[k], top = y + 5, h = th - 10; return top + h - (v - A.min) / (A.max - A.min) * h; };
  const autoV = (k, py, y, th) => { const A = AUTO[k], top = y + 5, h = th - 10; return SDAW.clamp(A.min + (top + h - py) / h * (A.max - A.min), A.min, A.max); };
  function showAuto(t, k) {
    if (k) arr.auto[t.id] = k; else delete arr.auto[t.id];
    arr.render();
    if (k) SDAW.toast(AUTO[k].label + ' automation of "' + t.name + '": click to add points, drag to move, right-click a point to delete');
  }
  function cycleAuto(t) { showAuto(t, !arr.auto[t.id] ? 'vol' : arr.auto[t.id] === 'vol' ? 'pan' : null); }
  arr.showAuto = showAuto;

  function drawAuto(g, t, k, y, th, tw, W) {
    const A = AUTO[k], pts = (t.auto && t.auto[k]) || [];
    g.save();
    g.fillStyle = 'rgba(8,6,20,.45)'; g.fillRect(0, y, W, th);           // dim the blocks under the line
    g.strokeStyle = A.color; g.lineWidth = 2; g.shadowColor = A.color; g.shadowBlur = 6;
    g.beginPath();
    if (!pts.length) {
      g.setLineDash([5, 5]); const yy = autoY(k, A.def(t), y, th); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); g.setLineDash([]);
    } else {
      g.moveTo(0, autoY(k, pts[0].v, y, th));
      pts.forEach(p => g.lineTo(p.t * tw, autoY(k, p.v, y, th)));
      g.lineTo(W, autoY(k, pts[pts.length - 1].v, y, th)); g.stroke();
      g.shadowBlur = 0; g.fillStyle = '#fff';
      pts.forEach(p => { g.beginPath(); g.arc(p.t * tw, autoY(k, p.v, y, th), 4, 0, Math.PI * 2); g.fill(); });
    }
    g.shadowBlur = 0; g.fillStyle = A.color; g.font = '600 10.5px Segoe UI';
    g.fillText(A.label + ' automation' + (pts.length ? '' : ' — click to add the first point'), 6, y + th - 7);
    g.restore();
  }
  function autoPointAt(t, k, pos, y, th) {
    const pts = (t.auto && t.auto[k]) || [];
    return pts.findIndex(p => Math.abs(p.t * arr.tickW - pos.x) < 7 && Math.abs(autoY(k, p.v, y, th) - pos.y) < 7);
  }
  function autoDown(e, t, pos) {
    const s = SDAW.store, k = arr.auto[t.id], th = trackH(), y = s.song.tracks.indexOf(t) * th;
    s.selectTrack(t.id);
    s.beginEdit();
    t.auto = t.auto || {}; t.auto[k] = t.auto[k] || [];
    const pts = t.auto[k];
    let i = autoPointAt(t, k, pos, y, th);
    if (i < 0) {                                                   // new point on the click
      const p = { t: pos.tick, v: +autoV(k, pos.y, y, th).toFixed(3) };
      pts.push(p); pts.sort((a, b) => a.t - b.t || 0); i = pts.indexOf(p);
    }
    const pt = pts[i];
    const tip = (v) => SDAW.toast(AUTO[k].label + ' ' + AUTO[k].fmt(v) + ' · bar ' + SDAW.barText(pt.t));
    const mv = (ev) => {
      const q = posFromEvent(ev);
      const j = pts.indexOf(pt), lo = j > 0 ? pts[j - 1].t : 0, hi = j < pts.length - 1 ? pts[j + 1].t : Infinity;
      pt.t = SDAW.clamp(ev.altKey ? q.tick : Math.round(q.x / arr.tickW), lo, hi);
      pt.v = +autoV(k, q.y, y, th).toFixed(3);
      drawLanes();
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      tip(pt.v);
      s.endEdit(AUTO[k].label + ' automation');
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    drawLanes();
  }
  function autoMenu(e, t, pos) {
    const s = SDAW.store, k = arr.auto[t.id], th = trackH(), y = s.song.tracks.indexOf(t) * th;
    const i = autoPointAt(t, k, pos, y, th);
    if (i >= 0) { s.mutate('Delete automation point', () => { t.auto[k].splice(i, 1); }); return; }
    SDAW.contextMenu(e, [
      ['Show ' + (k === 'vol' ? 'pan' : 'volume') + ' line instead', () => showAuto(t, k === 'vol' ? 'pan' : 'vol')],
      ['Clear the ' + AUTO[k].label.toLowerCase() + ' line', () => s.mutate('Clear automation', () => { if (t.auto) delete t.auto[k]; })],
      ['Hide automation (edit blocks again)', () => showAuto(t, null)]
    ]);
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  SDAW.roundRect = roundRect;

  arr.updatePlayhead = function (tick) {
    if (!arr.playhead) return;
    if (SDAW.audio.patternMode) { arr.playhead.style.opacity = 0.25; }
    else arr.playhead.style.opacity = 1;
    const x = headW() + tick * arr.tickW;
    arr.playhead.style.left = x + 'px';
    if (SDAW.audio.playing && !SDAW.audio.patternMode) {
      const sc = $('#arrScroll'), vis = x - sc.scrollLeft;
      if (vis > sc.clientWidth - 60 || vis < headW()) sc.scrollLeft = x - headW() - 40;
    }
  };

  /** Keys when the arrange has focus */
  arr.handleKey = function (e) {
    const s = SDAW.store;
    if (!s.sel.clipId) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { s.deleteClip(s.sel.clipId); return true; }
    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 's') {
      const at = SDAW.audio.playing ? Math.round(SDAW.audio.getTick()) : s.sel.cursor;
      if (!s.splitClip(s.sel.clipId, at)) SDAW.toast('Put the cursor inside the block to split it (click the block where you want the cut; Alt+click = exact step)');
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { s.duplicateClip(s.sel.clipId); return true; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { const f = s.findClip(s.sel.clipId); if (f) { arr.clipboard = Object.assign({}, f.clip); SDAW.toast('Block copied'); } return true; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { const t = s.selTrack(); if (t) pasteClip(t, s.sel.cursor); return true; }
    return false;
  };

  arr.init = function () {
    $('#arrZoom').addEventListener('input', e => { arr.tickW = +e.target.value; arr.render(); });
    $('#btnAutoGen').addEventListener('click', () => SDAW.autogen.open());
    $('#btnAutoSong').addEventListener('click', () => SDAW.songgen.open());
    $('#btnRecStudio').addEventListener('click', () => SDAW.recStudio.open());
    $('#btnAddTrack').addEventListener('click', e => {
      const items = [];
      CONFIG.library.instruments.forEach(g => items.push([g.icon + '  ' + g.group + ' — ' + g.items[0].name, () => SDAW.addTrackFromInstrument(g.items[0])]));
      SDAW.contextMenu(e, items);
    });
    SDAW.bus.on('change', arr.render);
    SDAW.bus.on('selection', arr.render);
    SDAW.bus.on('samplesLoaded', SDAW.debounce(drawLanes, 100));
  };

})(window.SDAW);
