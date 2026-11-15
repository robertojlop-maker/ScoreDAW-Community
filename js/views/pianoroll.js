/* =============================================================================
 *  PIANOROLL.JS — Piano Roll editor for the CURRENT notes pattern
 *  -----------------------------------------------------------------------------
 *  (the pattern of the selected block; all linked blocks change together)
 *  click empty grid    = add a note (current duration) and select it
 *  click a note        = select (Shift = add to selection) · drag = move
 *  drag a note's right edge = change length
 *  right-click / Delete = delete
 *  velocity lane (bottom): click / drag = velocity of the note under the mouse
 *  Guitar / bass notes get a new string+fret automatically when moved.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const LOW = 28, HIGH = 96, KEY_W = 64, VEL_H = 74;
  const BAR = () => SDAW.barTicks();          // bar length of the song (time signature)
  const pr = { scrolled: false };
  SDAW.pianoroll = pr;

  const tw = () => CONFIG.ui.pianoRollTickWidth;
  const rh = () => CONFIG.ui.pianoRollRowHeight;
  const rowsH = () => (HIGH - LOW + 1) * rh();

  /** Current notes pattern */
  pr.current = function () {
    const s = SDAW.store;
    let p = s.selPattern();
    if (p && p.kind === 'notes') return p;
    const t = s.selTrack();
    if (t && t.type !== 'drums') {
      const c = s.clipAt(t, s.sel.cursor) || t.clips.find(x => x.kind === 'pattern');
      if (c) { p = s.pattern(c.patternId); if (p && p.kind === 'notes') return p; }
    }
    return null;
  };
  function ownerTrack(p) {
    const s = SDAW.store, sel = s.selTrack();
    if (sel && sel.type !== 'drums' && sel.clips.some(c => c.patternId === p.id)) return sel;
    return s.song.tracks.find(t => t.clips.some(c => c.patternId === p.id)) || (sel && sel.type !== 'drums' ? sel : null);
  }

  pr.render = function () {
    const s = SDAW.store, p = pr.current();
    const cv = $('#prCanvas');
    const len = p ? Math.max(p.length, BAR()) : BAR() * 4;
    const W = KEY_W + len * tw() + 40, H = rowsH() + VEL_H;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let pt = HIGH; pt >= LOW; pt--) {
      const y = (HIGH - pt) * rh();
      g.fillStyle = SDAW.isBlack(pt) ? '#0e1028' : '#14173a';
      g.fillRect(KEY_W, y, W - KEY_W, rh());
      if (pt % 12 === 0) { g.fillStyle = 'rgba(155,92,255,.25)'; g.fillRect(KEY_W, y + rh() - 1, W - KEY_W, 1); }
    }
    for (let tk = 0; tk <= len; tk++) {
      const x = KEY_W + tk * tw();
      g.fillStyle = tk % BAR() === 0 ? 'rgba(220,210,255,.35)' : tk % SDAW.beatTicks() === 0 ? 'rgba(220,210,255,.12)' : 'rgba(220,210,255,.04)';
      g.fillRect(x, 0, 1, rowsH());
    }
    // end of pattern
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(KEY_W + len * tw(), 0, 40, H);
    for (let pt = HIGH; pt >= LOW; pt--) {
      const y = (HIGH - pt) * rh();
      g.fillStyle = SDAW.isBlack(pt) ? '#1b1d33' : '#e9e9f6';
      g.fillRect(0, y, KEY_W - (SDAW.isBlack(pt) ? 18 : 0), rh() - 1);
      if (pt % 12 === 0) { g.fillStyle = '#334'; g.font = '10px Segoe UI'; g.fillText(SDAW.midiToName(pt), 4, y + rh() - 3); }
    }
    if (!p) {
      g.fillStyle = '#c9c6f0'; g.font = '16px Segoe UI';
      g.fillText('No notes pattern selected. Double-click a lane of a melodic track in the Arrange, or press ＋ above.', KEY_W + 30, 40);
      return;
    }
    const t = ownerTrack(p);
    const col = p.color || (t && t.color) || '#ff4fd8';
    p.notes.forEach(n => {
      if (n.pitch < LOW || n.pitch > HIGH) return;
      const x = KEY_W + n.start * tw(), y = (HIGH - n.pitch) * rh(), w = Math.max(4, n.dur * tw() - 1);
      const sel = s.sel.noteIds.includes(n.id);
      g.save(); g.shadowColor = sel ? '#fff' : col; g.shadowBlur = sel ? 12 : 6;
      g.fillStyle = sel ? '#ffffff' : col;
      SDAW.roundRect(g, x + 1, y + 1, w - 1, rh() - 2, 3); g.fill(); g.restore();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + w - 4, y + 3, 2, rh() - 6);
      if (n.fret !== undefined && w > 18) { g.fillStyle = '#10101e'; g.font = '700 10px Segoe UI'; g.fillText(String(n.fret), x + 4, y + rh() - 4); }
    });
    const vy = rowsH();
    g.fillStyle = '#0a0b1c'; g.fillRect(0, vy, W, VEL_H);
    g.fillStyle = '#9a9cc8'; g.font = '11px Segoe UI'; g.fillText('Velocity', 6, vy + 16);
    p.notes.forEach(n => {
      const x = KEY_W + n.start * tw(), h = (n.vel / 127) * (VEL_H - 12);
      g.fillStyle = s.sel.noteIds.includes(n.id) ? '#fff' : col;
      g.fillRect(x + 2, vy + VEL_H - h - 4, 4, h);
    });
    // playhead (inside the pattern)
    const ph = localTick(p, SDAW.audio.getTick());
    if (ph !== null) { g.fillStyle = '#ffffff'; g.fillRect(KEY_W + ph * tw(), 0, 1.5, H); }

    if (!pr.scrolled) {
      pr.scrolled = true;
      const view = $('#view-pianoroll');
      const avg = p.notes.length ? p.notes.reduce((a, n) => a + n.pitch, 0) / p.notes.length : 60;
      view.scrollTop = (HIGH - avg) * rh() - view.clientHeight / 2;
    }
  };

  function localTick(p, tick) {
    if (!SDAW.audio.playing) return null;
    if (SDAW.audio.patternMode) return tick % p.length;
    for (const t of SDAW.store.song.tracks) {
      const c = SDAW.store.clipAt(t, Math.floor(tick));
      if (c && c.patternId === p.id) return (tick - c.start + (c.offsetTicks || 0)) % p.length;
    }
    return null;
  }

  function local(e) {
    const cv = $('#prCanvas'), r = cv.getBoundingClientRect(), sc = r.width / cv.offsetWidth;
    return { x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc };
  }
  function noteAt(p, x, y) {
    return p.notes.find(n => {
      const nx = KEY_W + n.start * tw(), ny = (HIGH - n.pitch) * rh();
      return x >= nx && x <= nx + Math.max(4, n.dur * tw()) && y >= ny && y < ny + rh();
    });
  }
  function refret(t, n) {
    if (!t) return;
    if (t.type === 'guitar') { const q = SDAW.autoFret(n.pitch); if (q) { n.string = q.string; n.fret = q.fret; } }
    if (t.type === 'bass') { const q = SDAW.autoFretBass(n.pitch); if (q) { n.string = q.string; n.fret = q.fret; } }
  }
  pr.refret = refret;

  pr.init = function () {
    const cv = $('#prCanvas');
    cv.setAttribute('data-help', 'Piano Roll of the selected pattern: click = add note, drag = move, right edge = length, right-click = delete. Bottom lane = velocity.');
    cv.addEventListener('contextmenu', e => e.preventDefault());
    SDAW.makeDropTarget($('#view-pianoroll'), 'progression finst instrument sample', p => SDAW.dropOnEditor(p));
    cv.addEventListener('mousedown', e => {
      const s = SDAW.store, p = pr.current();
      if (!p) return;
      const t = ownerTrack(p);
      SDAW.app.focusZone = 'pianoroll';
      const { x, y } = local(e);
      if (x < KEY_W) { if (t) SDAW.audio.previewNote(t, HIGH - Math.floor(y / rh())); return; }
      const tick = Math.floor((x - KEY_W) / tw());
      if (tick >= p.length) return;
      if (y > rowsH()) {
        s.beginEdit();
        const setVel = (ev) => {
          const q = local(ev), tk = Math.floor((q.x - KEY_W) / tw());
          const n = p.notes.find(nn => tk >= nn.start && tk < nn.start + Math.max(1, Math.min(nn.dur, 2)));
          if (n) { n.vel = SDAW.clamp(Math.round((1 - (q.y - rowsH() - 4) / (VEL_H - 12)) * 127), 1, 127); pr.render(); }
        };
        setVel(e);
        const mv = ev => setVel(ev), up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); s.endEdit('Velocity'); };
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
        return;
      }
      const hit = noteAt(p, x, y);
      if (e.button === 2) { if (hit) s.mutate('Delete note', () => { p.notes = p.notes.filter(n => n !== hit); }); return; }
      if (!hit) {
        const pitch = HIGH - Math.floor(y / rh());
        s.insertNote(pitch, { pattern: p, local: tick });
        if (t) SDAW.audio.previewNote(t, pitch, { dur: 0.4 });
        return;
      }
      s.selectNotes([hit.id], e.shiftKey);
      if (t) SDAW.audio.previewNote(t, hit.pitch, { dur: 0.3 });
      const nx = KEY_W + hit.start * tw(), w = Math.max(4, hit.dur * tw());
      const resize = x > nx + w - 7;
      const orig = { start: hit.start, pitch: hit.pitch, dur: hit.dur }, x0 = x, y0 = y;
      let moved = false;
      const mv = ev => {
        const q = local(ev);
        if (!moved) { moved = true; s.beginEdit(); }
        if (resize) hit.dur = Math.max(1, orig.dur + Math.round((q.x - x0) / tw()));
        else {
          hit.start = SDAW.clamp(orig.start + Math.round((q.x - x0) / tw()), 0, p.length - 1);
          hit.pitch = SDAW.clamp(orig.pitch - Math.round((q.y - y0) / rh()), LOW, HIGH);
        }
        pr.render();
      };
      const up = () => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        if (moved) { refret(t, hit); p.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch); s.endEdit('Edit note'); if (t && hit.pitch !== orig.pitch) SDAW.audio.previewNote(t, hit.pitch, { dur: 0.3 }); }
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
    SDAW.bus.on('selection', e => { if (e && (e.type === 'track' || e.type === 'pattern' || e.type === 'clip')) pr.scrolled = false; });
  };

  pr.tools = function (box) {
    const p = pr.current();
    SDAW.patternBar(box, 'notes', p);
    if (!p) return;
    box.appendChild(el('button', { class: 'tool-btn', 'data-help': 'Quantize selected notes (or all) to 1/16', onclick: () => {
      const s = SDAW.store, notes = s.selNotes().length ? s.selNotes() : p.notes;
      s.mutate('Quantize', () => notes.forEach(n => { n.start = Math.round(n.start); n.dur = Math.max(1, Math.round(n.dur)); }));
    } }, 'Quantize'));
    box.appendChild(el('button', { class: 'tool-btn', 'data-help': 'Transpose selected notes up one semitone', onclick: () => transpose(1) }, '+1'));
    box.appendChild(el('button', { class: 'tool-btn', 'data-help': 'Transpose selected notes down one semitone', onclick: () => transpose(-1) }, '−1'));
    box.appendChild(el('button', { class: 'tool-btn pro-only', 'data-help': 'Transpose selected notes up one octave', onclick: () => transpose(12) }, '+Oct'));
  };
  function transpose(d) {
    const s = SDAW.store, notes = s.selNotes();
    if (!notes.length) return SDAW.toast('Select notes first');
    const t = s.selTrack();
    s.mutate('Transpose', () => notes.forEach(n => { n.pitch += d; refret(t, n); }));
  }
  SDAW.transposeSelection = transpose;

})(window.SDAW);
