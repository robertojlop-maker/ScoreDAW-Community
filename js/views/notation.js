/* =============================================================================
 *  NOTATION.JS — Score, Tab and Score+Tab views (Guitar Pro style)
 *  -----------------------------------------------------------------------------
 *  Rendered as SVG from the same notes as the Piano Roll and Arrange.
 *
 *  PALETTE (left of the score): voices 1-4, durations (whole … 32nd), dot,
 *  triplet, rest, tie, dynamics, hairpins, articulations, guitar techniques
 *  (hammer, pull, tap, 6 slide types, bends ¼ ½ full 1½ 2 + bend types,
 *  vibrato, harmonics…) and bar tools (repeats, alternate endings, double bar,
 *  segno, coda, Fine, D.C., D.S., text).
 *
 *  Mouse:  click = place the cursor / select the note under it
 *          drag on an empty area = select a group of notes (box)
 *          Shift = add to the selection
 *  Keys (click the score first):
 *     0..9      type a fret number on the cursor string (1 then 2 = 12)
 *     ← / →     move by the current duration (Ctrl = by bar)
 *     ↑ / ↓     selected notes up / down a semitone (Shift = octave); otherwise change string
 *     + / −     longer / shorter duration · .  dot · R  rest · L  tie
 *     H P T S B V X O K G   hammer, pull, tap, slide, bend, vibrato, dead, harmonic, palm mute, ghost
 *     Delete    delete selected notes
 *  Voices: notes of different voices live in the same bar with their own
 *  rhythms (voice 1 stems up, voice 2 stems down), like Guitar Pro.
 *  Score: guitar and bass are written one octave higher than they sound.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el, svg } = SDAW;

  const nt = { mode: 'scoretab', typed: '', typedAt: 0, paletteOpen: true, pos: [] };
  SDAW.notation = nt;

  const STEP = 5;          // half of the staff line spacing (10)
  const TAB_SP = 13;       // tab line spacing
  const LEFT = 74;         // left margin (clef + time signature)
  const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const VOICE_COLORS = ['#1d1d2e', '#2563eb', '#15803d', '#c2410c'];
  const BEND_LABEL = { 0.5: '¼', 1: '½', 2: 'full', 3: '1½', 4: '2' };
  const INK = '#1d1d2e', FAINT = '#9a9ab8', ACCENT = '#7b2ff0';

  function paletteW() { return nt.paletteOpen && !nt.printTarget ? 214 : 0; }

  function layout(track) {
    const N = CONFIG.ui.notationBarsPerLine;
    const avail = (nt.printWidth || (document.getElementById('editorBody') || {}).clientWidth || 1300) - paletteW();
    const barW = Math.max(CONFIG.ui.notationBarWidth * 0.7, Math.floor((avail - LEFT - 24 - 56) / N));
    const nStr = track && track.type === 'bass' ? 4 : 6;
    const showScore = nt.mode !== 'tab', showTab = nt.mode !== 'score' && track && (track.type === 'guitar' || track.type === 'bass');
    const CH = 26;
    const staffOff = CH + 36;
    const tabOff = showScore ? staffOff + 40 + 78 : CH + 56;
    const grandStaff = showScore && SDAW.isPianoTrack(track);
    const lowerStaffOff = staffOff + 92;
    const scoreBottomOff = (grandStaff ? lowerStaffOff : staffOff) + 40;
    const sysH = (showTab ? tabOff + (nStr - 1) * TAB_SP : scoreBottomOff + 30) + 40;
    return { N, barW, nStr, showScore, showTab, CH, staffOff, tabOff, grandStaff, lowerStaffOff, scoreBottomOff, sysH, width: LEFT + N * barW + 24 };
  }
  const BT = () => SDAW.barTicks();               // ticks per bar (time signature)
  function tickX(L, tick) {
    const B = BT(), b = Math.floor(tick / B);
    return LEFT + (b % L.N) * L.barW + 20 + ((tick - b * B) / B) * (L.barW - 32);
  }
  const lineOf = (L, tick) => Math.floor(Math.floor(tick / BT()) / L.N);
  const stepOf = (p) => Math.floor(p / 12) * 7 + LETTER[p % 12];

  /** Drawable symbol for a written (base) duration */
  function symbolFor(d) {
    const table = [[16, 'w', 0], [12, 'h', 1], [8, 'h', 0], [6, 'q', 1], [4, 'q', 0], [3, 'e', 1], [2, 'e', 0], [1.5, 's', 1], [1, 's', 0], [0.75, 't', 1], [0.5, 't', 0]];
    for (const [t, sym, dot] of table) if (d >= t - 0.01) return { sym, dot };
    return { sym: 't', dot: 0 };
  }
  const baseDur = (n) => n.tup ? n.dur * 1.5 : n.dur;
  function restsFor(start, len) {
    const out = []; let t = start; const end = start + len;
    while (end - t >= 0.99) { let v = 16; while (v > 1 && (t % v !== 0 || t + v > end + 0.01)) v /= 2; out.push([t, v]); t += v; }
    return out;
  }
  const REST_GLYPH = { 16: '𝄻', 8: '𝄼', 4: '𝄽', 2: '𝄾', 1: '𝄿' };

  /* ============================================================ RENDER == */
  nt.render = function () {
    if (!nt.printTarget) renderPalette();
    const paper = nt.printTarget || $('#paper');
    const s = SDAW.store, song = s.song, t = s.selTrack();
    paper.innerHTML = '';
    nt.pos = [];
    if (!t) { paper.appendChild(el('div', { class: 'empty-msg', style: { color: '#334' } }, 'Select a track.')); return; }
    if (t.type === 'drums') {
      paper.appendChild(el('div', { class: 'empty-msg', style: { color: '#334', width: '700px' } }, [el('b', { style: { color: '#223' } }, 'Drum tracks'), ' are edited in the Pattern view (F2). Select a guitar, bass or keys track to see its score and tab.']));
      return;
    }
    const L = layout(t);
    const vnotes = s.trackNotes(t);
    nt.vnotes = vnotes;
    const lines = Math.ceil(song.bars / L.N);
    const H = lines * L.sysH + 30;
    const root = svg('svg', { width: L.width, height: H, viewBox: `0 0 ${L.width} ${H}` });
    const add = (n) => { root.appendChild(n); return n; };
    const T = (x, y, txt, a) => add(svg('text', Object.assign({ x, y, fill: INK, 'font-size': 12 }, a || {}), txt));
    const isGuitar = t.type === 'guitar' || t.type === 'bass';
    const avgP = vnotes.length ? vnotes.reduce((a, n) => a + n.pitch, 0) / vnotes.length : 60;
    const bassClef = !L.grandStaff && (t.type === 'bass' || (!isGuitar && avgP < 52));
    const written = (p) => isGuitar ? p + 12 : p;
    const staves = [{ offset: L.staffOff, bass: bassClef }];
    if (L.grandStaff) staves.push({ offset: L.lowerStaffOff, bass: true });
    const marks = song.barMarks || {};
    const multiVoiceTrack = vnotes.some(n => n.voice);

    T(LEFT, 18, song.title + ' — ' + t.name, { 'font-size': 15, 'font-weight': 700 });
    T(L.width - 24, 18, '♩ = ' + song.tempo + '   ·   ' + song.key + ' ' + song.scale + (isGuitar ? '   ·   ' + (t.type === 'bass' ? 'E A D G' : 'E A D G B E') : ''), { 'font-size': 12, fill: FAINT, 'text-anchor': 'end' });

    /* ---------------------------------------------- staves and bars --- */
    for (let ln = 0; ln < lines; ln++) {
      const y0 = 26 + ln * L.sysH;
      const staffTop = y0 + L.staffOff, staffBot = y0 + L.scoreBottomOff, tabTop = y0 + L.tabOff, tabBot = tabTop + (L.nStr - 1) * TAB_SP;
      const firstBar = ln * L.N, barsHere = Math.min(L.N, song.bars - firstBar);
      const x1 = LEFT + barsHere * L.barW;
      if (L.showScore) {
        staves.forEach(({ offset, bass }) => {
          const top = y0 + offset;
          for (let i = 0; i < 5; i++) add(svg('line', { x1: 14, y1: top + i * 10, x2: x1, y2: top + i * 10, stroke: INK, 'stroke-width': 1 }));
          T(16, top + (bass ? 30 : 36), bass ? '𝄢' : '𝄞', { 'font-size': bass ? 34 : 44, class: 'music' });
          if (isGuitar) T(26, top + (bass ? 52 : 58), '8', { 'font-size': 9 });
          if (ln === 0) {
            T(52, top + 18, String(SDAW.timeSig(song).num), { 'font-size': 19, 'font-weight': 800, 'text-anchor': 'middle' });
            T(52, top + 38, String(SDAW.timeSig(song).den), { 'font-size': 19, 'font-weight': 800, 'text-anchor': 'middle' });
          }
        });
        if (L.grandStaff) {
          const middle = (staffTop + staffBot) / 2;
          add(svg('line', { x1: 14, y1: staffTop, x2: 14, y2: staffBot, stroke: INK }));
          add(svg('path', { d: `M12 ${staffTop} C1 ${staffTop + 13} 14 ${middle - 10} 3 ${middle} C14 ${middle + 10} 1 ${staffBot - 13} 12 ${staffBot}`, fill: 'none', stroke: INK, 'stroke-width': 1.6 }));
        }
      }
      if (L.showTab) {
        for (let i = 0; i < L.nStr; i++) add(svg('line', { x1: 14, y1: tabTop + i * TAB_SP, x2: x1, y2: tabTop + i * TAB_SP, stroke: '#6b6b80', 'stroke-width': 0.9 }));
        ['T', 'A', 'B'].forEach((c, i) => T(30, tabTop + 12 + i * ((L.nStr - 1) * TAB_SP - 8) / 2.2, c, { 'font-size': 15, 'font-weight': 800, 'text-anchor': 'middle' }));
      }
      const vline = (x, w) => {
        if (L.showScore) add(svg('line', { x1: x, y1: staffTop, x2: x, y2: staffBot, stroke: INK, 'stroke-width': w || 1 }));
        if (L.showTab) add(svg('line', { x1: x, y1: tabTop, x2: x, y2: tabBot, stroke: INK, 'stroke-width': w || 1 }));
      };
      const dots = (x) => {
        if (L.showScore) staves.forEach(({ offset }) => [15, 25].forEach(dy => add(svg('circle', { cx: x, cy: y0 + offset + dy, r: 2.2, fill: INK }))));
        if (L.showTab) [0.36, 0.64].forEach(f => add(svg('circle', { cx: x, cy: tabTop + (tabBot - tabTop) * f, r: 2.2, fill: INK })));
      };
      for (let b = 0; b <= barsHere; b++) {
        const x = LEFT + b * L.barW, barNo = firstBar + b;
        const prevM = marks[barNo - 1] || {}, m = marks[barNo] || {};
        const isEnd = barNo === song.bars;
        if (b > 0 && prevM.re) { vline(x - 8, 1); vline(x - 2.5, 3.5); dots(x - 14); if ((prevM.re | 0) > 2) T(x - 6, (L.showScore ? staffTop : tabTop) - 8, '×' + prevM.re, { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end' }); }
        else if (b > 0 && prevM.dbl) { vline(x - 5, 1); vline(x, 1); }
        else if (isEnd) { vline(x - 6, 1); vline(x - 1.5, 3.5); }
        else vline(x, 1);
        if (b < barsHere) {
          if (m.rs) { vline(x + 2, 3.5); vline(x + 7.5, 1); dots(x + 13); }
          T(x + 3, (L.showScore ? staffTop : tabTop) - 6, String(barNo + 1), { 'font-size': 10, fill: FAINT });
          // alternate ending bracket
          if (m.end && m.end.length) {
            const by = y0 + L.CH + 14, bx = x + 2, bw = L.barW - 6;
            add(svg('path', { d: `M${bx} ${by + 14} V${by} H${bx + bw}`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
            T(bx + 5, by + 12, m.end.join('., ') + '.', { 'font-size': 12, 'font-weight': 700 });
          }
          let mx = x + 4;
          if (m.end && m.end.length) mx += 34;
          const markTxt = (txt, a) => { T(mx, y0 + L.CH + 24, txt, Object.assign({ 'font-size': 13, 'font-weight': 700, 'font-style': 'italic' }, a || {})); mx += txt.length * 8 + 10; };
          if (m.segno) markTxt('𝄋', { 'font-size': 22, class: 'music', 'font-style': 'normal' });
          if (m.coda) markTxt('𝄌', { 'font-size': 22, class: 'music', 'font-style': 'normal' });
          if (m.text) markTxt(m.text);
          if (m.fine) T(x + L.barW - 6, staffBot + 34, 'Fine', { 'font-size': 13, 'font-weight': 700, 'font-style': 'italic', 'text-anchor': 'end' });
          if (m.tocoda) T(x + L.barW - 6, staffTop - 22, 'To Coda 𝄌', { 'font-size': 12, 'font-weight': 700, 'font-style': 'italic', 'text-anchor': 'end' });
          if (m.jump) T(x + L.barW - 6, staffBot + 34, m.jump, { 'font-size': 12, 'font-weight': 700, 'font-style': 'italic', 'text-anchor': 'end' });
          const sec = song.sections.find(sc => sc.start === barNo);
          if (sec) {
            add(svg('rect', { x: x + 2, y: y0 - 2, width: sec.name.length * 7.5 + 12, height: 17, rx: 4, fill: sec.color }));
            T(x + 8, y0 + 11, sec.name, { 'font-size': 11, 'font-weight': 700, fill: '#fff' });
          }
        }
      }
      song.chords.forEach(c => { if (lineOf(L, c.tick) === ln) T(tickX(L, c.tick), y0 + L.CH + 6, c.name, { 'font-size': 15, 'font-weight': 700 }); });
    }

    /* ----------------------------------------------------------- notes --- */
    const sel = new Set(nt.printTarget ? [] : s.sel.noteIds);
    const key = (st) => Math.round(st * 24);
    const groups = new Map();
    // every note gets a string; notes of one chord on different strings (SDAW.fixStrings, model.js)
    SDAW.fixStrings(vnotes, t.type);
    vnotes.forEach(n => {
      const staff = L.grandStaff ? SDAW.pianoStaffForPitch(n.pitch) : 1;
      const voice = n.voice || 0;
      const k = key(n.start) + '|' + staff + '|' + voice;
      if (!groups.has(k)) groups.set(k, { notes: [], staff, voice });
      groups.get(k).notes.push(n);
    });
    const glist = [...groups.values()];
    glist.forEach(g => {
      g.notes.sort((a, b) => a.pitch - b.pitch);
      g.start = g.notes[0].start;
    });
    glist.sort((a, b) => a.start - b.start || a.voice - b.voice);
    const groupsInBar = new Map();
    const barKey = (staff, bar) => staff + '|' + bar;
    const voiceKey = g => g.staff + '|' + g.voice;
    glist.forEach(g => {
      const k = barKey(g.staff, Math.floor(g.start / BT()));
      if (!groupsInBar.has(k)) groupsInBar.set(k, new Map());
      const voices = groupsInBar.get(k);
      if (!voices.has(g.voice)) voices.set(g.voice, []);
      voices.get(g.voice).push(g);
    });

    // rests (score)
    if (L.showScore) {
      staves.forEach(({ offset }, i) => {
        for (let b = 0; b < song.bars; b++) {
          const voices = groupsInBar.get(barKey(i + 1, b)) || new Map();
          const vlist = [...voices.keys()]; if (!vlist.includes(0)) vlist.push(0);
          vlist.forEach(v => {
            const bs = b * BT(), be = bs + BT(), multi = vlist.length > 1;
            let cur = bs; const gaps = [];
            (voices.get(v) || []).forEach(g => {
              if (g.start > cur + 0.01) gaps.push([cur, g.start - cur]);
              cur = Math.max(cur, Math.min(be, g.start + Math.max(...g.notes.map(n => n.dur))));
            });
            if (cur < be - 0.01) gaps.push([cur, be - cur]);
            const ln = lineOf(L, bs), staffTop = 26 + ln * L.sysH + offset;
            const col = multi ? VOICE_COLORS[v] : INK;
            gaps.forEach(([gs, gl]) => {
              const full = gs - bs < 0.01 && gl >= BT() - 0.01;
              (full ? [[0, 16]] : restsFor(gs - bs, gl)).forEach(([rt, rv]) => {
                const x = (full && !multi) ? LEFT + (b % L.N) * L.barW + L.barW / 2 : tickX(L, bs + rt);
                const dy = multi ? (v % 2 ? 10 : -8) : 0;
                T(x, staffTop + dy + (rv >= 8 ? (rv === 16 ? 12 : 20) : 26), REST_GLYPH[rv], { 'font-size': 26, class: 'music', fill: col, 'text-anchor': 'middle' });
              });
            });
          });
        }
      });
    }

    // previous note on the same voice (for slides, h/p, ties)
    const lastByVoice = new Map();
    const tupletRuns = {};                // staff and voice -> [groups]
    glist.forEach(g => {
      const ln = lineOf(L, g.start), y0 = 26 + ln * L.sysH;
      const staff = staves[g.staff - 1];
      const staffTop = y0 + staff.offset, staffBot = staffTop + 40, tabTop = y0 + L.tabOff;
      const bottomStep = stepOf(staff.bass ? 43 : 64);
      const x = tickX(L, g.start);
      const n0 = g.notes[g.notes.length - 1];
      const dur = Math.max(...g.notes.map(baseDur));
      const sym = symbolFor(dur);
      const multi = groupsInBar.get(barKey(g.staff, Math.floor(g.start / BT()))).size > 1;
      const vcol = multiVoiceTrack ? VOICE_COLORS[g.voice] : INK;
      const vk = voiceKey(g);
      const prev = lastByVoice.get(vk);
      lastByVoice.set(vk, g);
      const tech = n0.tech || {};

      if (L.showScore) {
        const ys = g.notes.map(n => staffBot - (stepOf(written(n.pitch)) - bottomStep) * STEP);
        const up = multi ? g.voice % 2 === 0 : (ys.reduce((a, b) => a + b, 0) / ys.length) > staffTop + 20;
        g.notes.forEach((n, i) => {
          const y = ys[i], step = stepOf(written(n.pitch)) - bottomStep;
          const col = sel.has(n.id) ? ACCENT : vcol;
          for (let k = -2; k >= step; k -= 2) add(svg('line', { x1: x - 10, y1: staffBot - k * STEP, x2: x + 10, y2: staffBot - k * STEP, stroke: INK }));
          for (let k = 10; k <= step; k += 2) add(svg('line', { x1: x - 10, y1: staffBot - k * STEP, x2: x + 10, y2: staffBot - k * STEP, stroke: INK }));
          if (SDAW.isBlack(n.pitch)) T(x - 17, y + 5, '♯', { 'font-size': 15, fill: col, 'text-anchor': 'middle' });
          const tn = n.tech || {};
          const hollow = sym.sym === 'w' || sym.sym === 'h';
          if (tn.mute) {
            add(svg('path', { d: `M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}`, stroke: col, 'stroke-width': 2, 'data-note': n.id }));
          } else if (tn.harm || tn.pinch) {
            add(svg('polygon', { points: `${x - 6},${y} ${x},${y - 5} ${x + 6},${y} ${x},${y + 5}`, fill: hollow ? '#fff' : col, stroke: col, 'stroke-width': 1.5, 'data-note': n.id }));
          } else {
            add(svg('ellipse', { cx: x, cy: y, rx: 6.2, ry: 4.4, transform: `rotate(-20 ${x} ${y})`, fill: hollow ? '#fff' : col, stroke: col, 'stroke-width': hollow ? 1.8 : 1, 'data-note': n.id }));
          }
          if (tn.ghost) { T(x - 11, y + 5, '(', { 'font-size': 15, fill: col, 'text-anchor': 'middle' }); T(x + 11, y + 5, ')', { 'font-size': 15, fill: col, 'text-anchor': 'middle' }); }
          if (sym.dot) add(svg('circle', { cx: x + 11, cy: y - (step % 2 === 0 ? 3 : 0), r: 1.8, fill: col }));
          nt.pos.push({ id: n.id, x, y, line: ln, start: n.start, voice: g.voice });
          // tie arc to the previous same-pitch note
          if (n.tie && prev) {
            const pn = prev.notes.find(q => q.pitch === n.pitch);
            if (pn && lineOf(L, prev.start) === ln) {
              const px = tickX(L, prev.start), cy = y + (up ? 9 : -9);
              add(svg('path', { d: `M${px + 4} ${cy} Q ${(px + x) / 2} ${cy + (up ? 9 : -9)} ${x - 4} ${cy}`, fill: 'none', stroke: col, 'stroke-width': 1.3 }));
            }
          }
        });
        const col = g.notes.some(n => sel.has(n.id)) ? ACCENT : vcol;
        const sx = up ? x + 5.6 : x - 5.6;
        const yStart = up ? Math.max(...ys) : Math.min(...ys);
        const yEnd = up ? Math.min(...ys) - 32 : Math.max(...ys) + 32;
        if (sym.sym !== 'w') {
          add(svg('line', { x1: sx, y1: yStart, x2: sx, y2: yEnd, stroke: col, 'stroke-width': 1.3 }));
          const flags = { e: 1, s: 2, t: 3 }[sym.sym] || 0;
          for (let f = 0; f < flags; f++) {
            const fy = yEnd + (up ? f * 7 : -f * 7);
            add(svg('path', { d: up ? `M${sx} ${fy} q 10 8 6 20` : `M${sx} ${fy} q 10 -8 6 -20`, fill: 'none', stroke: col, 'stroke-width': 2 }));
          }
          if (tech.trem) [0, 6].forEach(o => add(svg('line', { x1: sx - 5, y1: (yStart + yEnd) / 2 + o + 3, x2: sx + 5, y2: (yStart + yEnd) / 2 + o - 3, stroke: col, 'stroke-width': 2.2 })));
        }
        // articulations opposite the stem
        const farY = up ? Math.max(...ys) + 13 : Math.min(...ys) - 11;
        if (tech.stacc) add(svg('circle', { cx: x, cy: farY, r: 2, fill: col }));
        if (tech.accent) T(x, up ? farY + (tech.stacc ? 10 : 4) : farY - (tech.stacc ? 6 : 0), '>', { 'font-size': 15, 'font-weight': 700, fill: col, 'text-anchor': 'middle' });
        if ((tech.h || tech.p || tech.slide === 'legato') && prev && lineOf(L, prev.start) === ln) {
          const px = tickX(L, prev.start), yTop = Math.min(...ys) - 12;
          add(svg('path', { d: `M${px} ${yTop} Q ${(px + x) / 2} ${yTop - 12} ${x} ${yTop}`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
        }
        if (tech.vib || tech.wvib) T(x - 4, staffTop - 12, tech.wvib ? '〰〰' : '∿∿∿', { 'font-size': tech.wvib ? 13 : 16 });
        const pd = prev && prev.notes[prev.notes.length - 1].dyn;
        if (n0.dyn && n0.dyn !== pd) T(x - 6, staffBot + 24, n0.dyn, { 'font-size': 15, 'font-weight': 800, 'font-style': 'italic', 'font-family': 'Times New Roman, serif' });
        if (tech.hair) {
          const nxt = glist.find(q => voiceKey(q) === vk && q.start > g.start);
          const ex = nxt && lineOf(L, nxt.start) === ln ? tickX(L, nxt.start) - 6 : x + 40;
          const yh = staffBot + 20;
          add(svg('path', { d: tech.hair === '<' ? `M${ex} ${yh - 5} L${x} ${yh} L${ex} ${yh + 5}` : `M${x} ${yh - 5} L${ex} ${yh} L${x} ${yh + 5}`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
        }
        // tuplet runs
        if (n0.tup) (tupletRuns[vk] = tupletRuns[vk] || []).push({ g, x, up, yEnd, ln });
      }

      if (L.showTab) {
        const tabBot = tabTop + (L.nStr - 1) * TAB_SP;
        const above = tabTop - 16;
        let markRow = 0;
        const markAbove = (txt, a) => { T(x - 6, above - 2 - markRow * 13, txt, Object.assign({ 'font-size': 10, 'font-weight': 700 }, a || {})); markRow++; };
        g.notes.forEach(n => {
          if (n.string === undefined) return;
          const tn = n.tech || {};
          const sy = tabTop + (L.nStr - 1 - n.string) * TAB_SP;
          let label = tn.mute ? 'x' : (tn.harm || tn.pinch) ? '<' + n.fret + '>' : String(n.fret);
          if (tn.ghost || n.tie) label = '(' + label + ')';
          const w = label.length * 7 + 4;
          add(svg('rect', { x: x - w / 2, y: sy - 7, width: w, height: 14, fill: '#fbfaff' }));
          T(x, sy + 4.5, label, { 'font-size': 13, 'font-weight': 600, fill: sel.has(n.id) ? ACCENT : (multiVoiceTrack ? VOICE_COLORS[g.voice] : INK), 'text-anchor': 'middle', 'data-note': n.id });
          if (sel.has(n.id)) add(svg('rect', { x: x - w / 2 - 2, y: sy - 9, width: w + 4, height: 18, rx: 4, fill: 'rgba(155,92,255,.18)', stroke: ACCENT }));
          if (!L.showScore) nt.pos.push({ id: n.id, x, y: sy, line: ln, start: n.start, voice: g.voice });
          else nt.pos.push({ id: n.id, x, y: sy, line: ln, start: n.start, voice: g.voice, tab: true });
          // bends
          if (tn.bend) {
            const lab = BEND_LABEL[tn.bend] || (tn.bend / 2 + '');
            const type = tn.bendType || 'up', top = above + 4;
            const arrow = (ax, ay) => add(svg('path', { d: `M${ax - 4} ${ay + 7} L${ax} ${ay} L${ax + 4} ${ay + 7}`, fill: INK }));
            if (type === 'up' || type === 'release') {
              add(svg('path', { d: `M${x + 6} ${sy} Q ${x + 18} ${sy} ${x + 18} ${top + 2}`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
              arrow(x + 18, top); T(x + 18, top - 4, lab, { 'font-size': 11, 'text-anchor': 'middle' });
              if (type === 'release') add(svg('path', { d: `M${x + 18} ${top + 2} Q ${x + 30} ${top + 2} ${x + 30} ${sy - 6}`, fill: 'none', stroke: INK, 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
            } else {
              add(svg('line', { x1: x + 10, y1: sy - 6, x2: x + 10, y2: top + 3, stroke: INK, 'stroke-width': 1.2, 'stroke-dasharray': type === 'prerelease' ? '3 2' : null }));
              arrow(x + 10, top); T(x + 10, top - 4, lab, { 'font-size': 11, 'text-anchor': 'middle' });
              if (type === 'prerelease') {
                add(svg('path', { d: `M${x + 10} ${top + 2} Q ${x + 24} ${top + 2} ${x + 24} ${sy - 8}`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
                add(svg('path', { d: `M${x + 20} ${sy - 15} L${x + 24} ${sy - 8} L${x + 28} ${sy - 15}`, fill: INK }));
              }
            }
          }
          // slides
          const sl = tn.slide;
          if (sl) {
            if ((sl === true || sl === 'shift' || sl === 'legato') && prev && lineOf(L, prev.start) === ln) {
              const pn = prev.notes.find(q => q.string === n.string) || prev.notes[0];
              const px = tickX(L, prev.start), upSl = pn && pn.fret < n.fret;
              add(svg('line', { x1: px + 8, y1: sy + (upSl ? 4 : -4), x2: x - 8, y2: sy + (upSl ? -4 : 4), stroke: INK, 'stroke-width': 1.3 }));
              T((px + x) / 2, sy - 10, sl === 'legato' ? 'sl. (leg.)' : 'sl.', { 'font-size': 10, 'text-anchor': 'middle', 'font-style': 'italic' });
              if (sl === 'legato') add(svg('path', { d: `M${px} ${sy - 9} Q ${(px + x) / 2} ${sy - 22} ${x} ${sy - 9}`, fill: 'none', stroke: INK, 'stroke-width': 1 }));
            } else if (sl === 'inBelow') add(svg('line', { x1: x - 17, y1: sy + 5, x2: x - 8, y2: sy - 1, stroke: INK, 'stroke-width': 1.3 }));
            else if (sl === 'inAbove') add(svg('line', { x1: x - 17, y1: sy - 5, x2: x - 8, y2: sy + 1, stroke: INK, 'stroke-width': 1.3 }));
            else if (sl === 'outDown') add(svg('line', { x1: x + 8, y1: sy - 1, x2: x + 18, y2: sy + 6, stroke: INK, 'stroke-width': 1.3 }));
            else if (sl === 'outUp') add(svg('line', { x1: x + 8, y1: sy + 1, x2: x + 18, y2: sy - 6, stroke: INK, 'stroke-width': 1.3 }));
          }
          // hammer / pull / tap arcs
          if ((tn.h || tn.p) && prev && lineOf(L, prev.start) === ln) {
            const px = tickX(L, prev.start);
            add(svg('path', { d: `M${px} ${sy - 9} Q ${(px + x) / 2} ${sy - 20} ${x} ${sy - 9}`, fill: 'none', stroke: INK, 'stroke-width': 1.1 }));
            T((px + x) / 2, sy - 19, tn.h ? 'H' : 'P', { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle' });
          }
          if (tn.vib || tn.wvib) T(x + 6, sy - 8, tn.wvib ? '〰' : '∿∿', { 'font-size': 13 });
        });
        if (tech.tap) markAbove('T');
        if (tech.pm) markAbove('P.M.');
        if (tech.harm) markAbove('N.H.');
        if (tech.pinch) markAbove('A.H.');
        if (tech.ring) markAbove('let ring', { 'font-style': 'italic', 'font-weight': 400 });
        if (tech.trem) markAbove('≡', { 'font-size': 14 });
        if (tech.accent && !L.showScore) markAbove('>');
        const strum = tech.strum;
        if (strum && g.notes.length > 2) {
          const yA = tabTop - 4, yB = tabBot + 4;
          add(svg('line', { x1: x - 13, y1: yA, x2: x - 13, y2: yB, stroke: '#666', 'stroke-width': 1 }));
          add(svg('path', { d: strum === 'down' ? `M${x - 16} ${yB - 5} L${x - 13} ${yB} L${x - 10} ${yB - 5}` : `M${x - 16} ${yA + 5} L${x - 13} ${yA} L${x - 10} ${yA + 5}`, fill: 'none', stroke: '#666', 'stroke-width': 1.2 }));
        }
      }
    });

    // tuplet brackets: groups of 3 consecutive triplet notes in the same voice
    Object.values(tupletRuns).forEach(run => {
      for (let i = 0; i + 2 < run.length; i += 3) {
        const a = run[i], c = run[i + 2];
        if (a.ln !== c.ln) continue;
        const yb = a.up ? Math.min(a.yEnd, c.yEnd) - 8 : Math.max(a.yEnd, c.yEnd) + 8;
        add(svg('path', { d: `M${a.x} ${yb + (a.up ? 5 : -5)} V${yb} H${c.x + 6} V${yb + (a.up ? 5 : -5)}`, fill: 'none', stroke: INK, 'stroke-width': 1 }));
        add(svg('rect', { x: (a.x + c.x) / 2 - 2, y: yb - 7, width: 12, height: 13, fill: '#fbfaff' }));
        T((a.x + c.x) / 2 + 4, yb + 4, '3', { 'font-size': 11, 'font-weight': 700, 'font-style': 'italic', 'text-anchor': 'middle' });
      }
    });

    /* ---------------------------------------------- cursor + playhead --- */
    if (nt.printTarget) { nt.L = L; paper.appendChild(root); return; }      // print: no cursor / playhead
    const cl = lineOf(L, s.sel.cursor), cy0 = 26 + cl * L.sysH, cx = tickX(L, s.sel.cursor);
    const cTop = cy0 + (L.showScore ? L.staffOff - 14 : L.tabOff - 14);
    const cBot = cy0 + (L.showTab ? L.tabOff + (L.nStr - 1) * TAB_SP + 12 : L.scoreBottomOff + 14);
    const vc = VOICE_COLORS[s.sel.voice];
    add(svg('rect', { x: cx - 9, y: cTop, width: 18, height: cBot - cTop, rx: 4, fill: s.sel.voice ? vc + '22' : 'rgba(255,190,40,.18)', stroke: s.sel.voice ? vc : 'rgba(230,160,0,.8)', 'stroke-width': 1 }));
    if (L.showTab) {
      const cs = SDAW.clamp(s.sel.cursorString, 0, L.nStr - 1);
      add(svg('rect', { x: cx - 9, y: cy0 + L.tabOff + (L.nStr - 1 - cs) * TAB_SP - 7, width: 18, height: 14, rx: 3, fill: 'none', stroke: '#e0a000', 'stroke-width': 2 }));
    }
    nt.playheadEl = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#ff4fd8', 'stroke-width': 2, opacity: 0 });
    add(nt.playheadEl);
    nt.selRect = svg('rect', { x: 0, y: 0, width: 0, height: 0, fill: 'rgba(155,92,255,.12)', stroke: ACCENT, 'stroke-dasharray': '4 3', opacity: 0 });
    add(nt.selRect);
    nt.L = L;
    paper.appendChild(root);
    nt.svgEl = root;
    nt.updatePlayhead(SDAW.audio.getTick());
  };

  /**
   * Render a track for printing / PDF (no cursor, no selection, fixed width).
   * mode: 'score' | 'tab' | 'scoretab'. Returns { svg (markup), width, height, sysH, lines }.
   */
  nt.renderForPrint = function (trackId, mode, width) {
    const s = SDAW.store, keep = { tid: s.sel.trackId, mode: nt.mode, L: nt.L, svgEl: nt.svgEl, pos: nt.pos, vnotes: nt.vnotes, ph: nt.playheadEl, sr: nt.selRect };
    const box = document.createElement('div');
    try {
      s.sel.trackId = trackId; nt.mode = mode; nt.printTarget = box; nt.printWidth = width || 1060;
      nt.render();
      const svgEl = box.querySelector('svg');
      if (!svgEl) return null;
      const L = nt.L, lines = Math.ceil(s.song.bars / L.N);
      return { svg: svgEl.outerHTML, inner: svgEl.innerHTML, width: L.width, height: +svgEl.getAttribute('height'), sysH: L.sysH, lines };
    } finally {
      s.sel.trackId = keep.tid; nt.mode = keep.mode; nt.printTarget = null; nt.printWidth = null;
      nt.L = keep.L; nt.svgEl = keep.svgEl; nt.pos = keep.pos; nt.vnotes = keep.vnotes; nt.playheadEl = keep.ph; nt.selRect = keep.sr;
    }
  };

  nt.updatePlayhead = function (tick) {
    if (!nt.playheadEl || !nt.L) return;
    const L = nt.L;
    if (!SDAW.audio.playing && tick === 0) { nt.playheadEl.setAttribute('opacity', 0); return; }
    if (SDAW.audio.patternMode) tick += (SDAW.app.patPreview ? SDAW.app.previewOffset : 0);
    const ln = lineOf(L, tick), y0 = 26 + ln * L.sysH;
    const x = tickX(L, Math.min(tick, SDAW.store.songTicks() - 0.01));
    nt.playheadEl.setAttribute('x1', x); nt.playheadEl.setAttribute('x2', x);
    nt.playheadEl.setAttribute('y1', y0 + (L.showScore ? L.staffOff - 16 : L.tabOff - 16));
    nt.playheadEl.setAttribute('y2', y0 + (L.showTab ? L.tabOff + (L.nStr - 1) * TAB_SP + 14 : L.scoreBottomOff + 16));
    nt.playheadEl.setAttribute('opacity', 1);
    if (SDAW.audio.playing && nt.lastLine !== ln) { nt.lastLine = ln; $('#view-notation').scrollTop = Math.max(0, y0 - 10); }
  };

  nt.scrollToTick = function (tick) {
    const t = SDAW.store.selTrack(); if (!t) return;
    const L = layout(t);
    SDAW.store.setCursor(tick);
    $('#view-notation').scrollTop = lineOf(L, tick) * L.sysH;
  };

  /* ============================================================ MOUSE == */
  function svgPoint(e) {
    const r = nt.svgEl.getBoundingClientRect(), sc = r.width / nt.svgEl.width.baseVal.value;
    return { x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc };
  }

  function onDown(e) {
    const s = SDAW.store, t = s.selTrack();
    if (!t || t.type === 'drums' || !nt.svgEl || e.button !== 0) return;
    SDAW.app.focusZone = 'notation';
    const p0 = svgPoint(e);
    const target = e.target && e.target.getAttribute && e.target.getAttribute('data-note');
    let moved = false;
    const mv = (ev) => {
      const p = svgPoint(ev);
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) < 6) return;
      if (target && !moved) return;            // drags starting on a note are clicks
      moved = true;
      const x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y);
      nt.selRect.setAttribute('x', x); nt.selRect.setAttribute('y', y);
      nt.selRect.setAttribute('width', Math.abs(p.x - p0.x)); nt.selRect.setAttribute('height', Math.abs(p.y - p0.y));
      nt.selRect.setAttribute('opacity', 1);
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (moved) {
        const p = svgPoint(ev);
        const x1 = Math.min(p0.x, p.x), x2 = Math.max(p0.x, p.x), y1 = Math.min(p0.y, p.y), y2 = Math.max(p0.y, p.y);
        const ids = [...new Set(nt.pos.filter(q => q.x >= x1 && q.x <= x2 && q.y >= y1 && q.y <= y2).map(q => q.id))];
        nt.selRect.setAttribute('opacity', 0);
        const first = nt.pos.filter(q => ids.includes(q.id)).sort((a, b) => a.start - b.start)[0];
        if (first) s.sel.cursor = first.start;
        s.selectNotes(ids, ev.shiftKey);
        SDAW.toast(ids.length + ' note(s) selected — click a duration or a technique in the palette to change them');
        return;
      }
      clickAt(p0, target, ev);
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  }

  function clickAt(p, target, e) {
    const s = SDAW.store, t = s.selTrack(), L = nt.L;
    const ln = Math.floor((p.y - 26) / L.sysH);
    if (ln < 0) return;
    const y0 = 26 + ln * L.sysH;
    const col = Math.floor((p.x - LEFT) / L.barW);
    if (col < 0 || col >= L.N) return;
    const bar = ln * L.N + col;
    if (bar >= s.song.bars) return;
    const frac = (p.x - (LEFT + col * L.barW) - 20) / (L.barW - 32);
    const step = Math.min(1, s.curDur());
    const B = BT(), tick = bar * B + SDAW.clamp(Math.round(frac * B / step) * step, 0, B - step);
    let hitId = target;
    if (!hitId) {
      const near = nt.pos.filter(q => q.line === ln && Math.abs(q.x - p.x) < 9 && Math.abs(q.y - p.y) < 9);
      if (near.length) hitId = near[0].id;
    }
    if (L.showTab && p.y > y0 + L.tabOff - 10) s.sel.cursorString = SDAW.clamp(L.nStr - 1 - Math.round((p.y - (y0 + L.tabOff)) / TAB_SP), 0, L.nStr - 1);
    if (hitId) {
      const hp = nt.pos.find(q => q.id === hitId && q.line === ln) || nt.pos.find(q => q.id === hitId);
      const vn = (nt.vnotes || []).find(n => n.id === hitId);
      if (hp) s.sel.cursor = hp.start;
      if (vn && vn.voice !== undefined) s.sel.voice = vn.voice || 0;
      s.selectNotes([hitId], e.shiftKey);
      if (vn) SDAW.audio.previewNote(t, vn.pitch, { dur: 0.4, tech: vn.tech });
    } else {
      s.sel.noteIds = [];
      s.setCursor(tick);
    }
  }

  /* ========================================================= KEYBOARD == */
  nt.handleKey = function (e) {
    const s = SDAW.store, t = s.selTrack();
    if (!t || t.type === 'drums' || e.ctrlKey && !['ArrowLeft', 'ArrowRight'].includes(e.key)) return false;
    const L = nt.L || layout(t);
    const k = e.key;
    if (/^[0-9]$/.test(k) && L.showTab) {
      const now = performance.now();
      nt.typed = (now - nt.typedAt < 700 && nt.typed.length === 1) ? nt.typed + k : k;
      nt.typedAt = now;
      const fret = Math.min(CONFIG.guitar.frets, parseInt(nt.typed, 10));
      const str = SDAW.clamp(s.sel.cursorString, 0, L.nStr - 1);
      const tuning = t.type === 'bass' ? SDAW.BASS_TUNING : CONFIG.guitar.tuning;
      const vOld = s.trackNotes(t).find(n => Math.abs(n.start - s.sel.cursor) < 0.01 && n.string === str && (n.voice || 0) === s.sel.voice);
      if (vOld) s.mutate('Fret', () => { vOld._ref.fret = fret; vOld._ref.string = str; vOld._ref.pitch = tuning[str] + fret; });
      else s.insertNote(tuning[str] + fret, { string: str, fret, keepCursor: true });
      const n = s.trackNotes(t).find(q => Math.abs(q.start - s.sel.cursor) < 0.01 && q.string === str);
      if (n) { s.selectNotes([n.id]); SDAW.audio.previewNote(t, n.pitch, { dur: 0.4 }); }
      return true;
    }
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const step = e.ctrlKey ? BT() : s.curDur();
      s.sel.noteIds = [];
      s.setCursor(s.sel.cursor + (k === 'ArrowRight' ? step : -step));
      const here = s.trackNotes(t).filter(n => Math.abs(n.start - s.sel.cursor) < 0.01 && (n.voice || 0) === s.sel.voice);
      if (here.length) s.selectNotes(here.map(n => n.id));
      return true;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      const d = k === 'ArrowUp' ? 1 : -1;
      if (s.sel.noteIds.length) { SDAW.transposeSelection(e.shiftKey ? d * 12 : d); const f = s.selNotes()[0]; if (f) SDAW.audio.previewNote(t, f.pitch, { dur: 0.3 }); }
      else { s.sel.cursorString = SDAW.clamp(s.sel.cursorString + d, 0, L.nStr - 1); SDAW.bus.emit('selection', { type: 'cursor' }); }
      return true;
    }
    if (k === '+' || k === '-' || k === 'Add' || k === 'Subtract') {
      const list = CONFIG.grid.durations.map(d => d.ticks);
      let i = list.indexOf(s.sel.duration); if (i < 0) i = 2;
      i = SDAW.clamp(i + (k === '+' || k === 'Add' ? -1 : 1), 0, list.length - 1);
      SDAW.input.setDuration(list[i]);
      return true;
    }
    if (k === 'Delete' || k === 'Backspace') {
      if (s.sel.noteIds.length) s.deleteSelectedNotes();
      else { const n = s.trackNotes(t).find(q => Math.abs(q.start - s.sel.cursor) < 0.01 && q.string === s.sel.cursorString); if (n) s.mutate('Delete', () => { n._pattern.notes = n._pattern.notes.filter(q => q !== n._ref); }); }
      return true;
    }
    if (k === '.') { toggleDot(); return true; }
    const low = k.toLowerCase();
    if (low === 'r' && !e.shiftKey) { insertRest(); return true; }
    if (low === 'l' && !e.shiftKey) { s.setNoteProp('tie', true); return true; }
    const techKey = { h: 'h', p: 'p', t: 'tap', s: 'slide', '/': 'slide', b: 'bend', v: 'vib', x: 'mute', o: 'harm', k: 'pm', g: 'ghost', a: 'accent' }[low];
    if (techKey && !e.shiftKey) { if (techKey === 'slide') setSlide('shift'); else s.setTechnique(techKey); return true; }
    return false;
  };

  /* ========================================================= ACTIONS === */
  function insertRest() {
    const s = SDAW.store, t = s.selTrack(); if (!t) return;
    const here = s.trackNotes(t).filter(n => Math.abs(n.start - s.sel.cursor) < 0.01 && (n.voice || 0) === s.sel.voice);
    if (here.length) s.mutate('Rest', () => here.forEach(n => { n._pattern.notes = n._pattern.notes.filter(q => q !== n._ref); }));
    s.setCursor(s.sel.cursor + s.curDur());
  }
  function toggleDot() {
    const s = SDAW.store, notes = s.selNotes();
    if (notes.length) {
      s.mutate('Dot', () => {
        const changes = new Map();
        notes.forEach(n => {
          const b = n.tup ? n.dur * 1.5 : n.dur;
          const dotted = [12, 6, 3, 1.5, 0.75].some(v => Math.abs(b - v) < 0.01);
          changes.set(n, dotted ? n.dur / 1.5 : n.dur * 1.5);
        });
        s.rippleDurations(changes);           // the next notes move with it
      });
    } else { s.sel.dot = !s.sel.dot; renderPalette(); }
  }
  function toggleTriplet() {
    const s = SDAW.store;
    if (s.selNotes().length) s.setNoteProp('tup', 3);
    else { s.sel.tuplet = !s.sel.tuplet; renderPalette(); }
  }
  /** Slides between two notes (shift / legato) go on the later note(s) */
  function setSlide(type) {
    const s = SDAW.store, notes = s.selNotes();
    if (!notes.length) return SDAW.toast('Select the note(s) first');
    if (type === 'shift' || type === 'legato') {
      const starts = [...new Set(notes.map(n => n.start))].sort((a, b) => a - b);
      const vn = (nt.vnotes || []);
      if (starts.length < 2) {
        // one note selected: slide from the note before it
        const n = notes[0];
        const prev = vn.filter(q => q._ref !== n && (q.voice || 0) === (n.voice || 0) && q.start < (vn.find(v => v._ref === n) || {}).start);
        if (!prev.length) return SDAW.toast('A slide goes between two notes: select both notes (drag a box around them)');
      }
      const first = starts[0];
      const later = starts.length > 1 ? notes.filter(n => n.start !== first) : notes;
      s.mutate('Slide', () => {
        const all = later.every(n => n.tech && n.tech.slide === type);
        later.forEach(n => { n.tech = n.tech || {}; if (all) delete n.tech.slide; else n.tech.slide = type; });
      });
      return;
    }
    s.setTechnique('slide', type);
  }
  function setBend(semis) {
    const s = SDAW.store, notes = s.selNotes();
    if (!notes.length) return SDAW.toast('Select the note(s) first');
    s.mutate('Bend', () => {
      const all = notes.every(n => n.tech && n.tech.bend === semis);
      notes.forEach(n => { n.tech = n.tech || {}; if (all) { delete n.tech.bend; delete n.tech.bendType; } else { n.tech.bend = semis; n.tech.bendType = n.tech.bendType || 'up'; } });
    });
  }
  function setBendType(type) {
    const s = SDAW.store, notes = s.selNotes();
    if (!notes.length) return SDAW.toast('Select the note(s) first');
    s.mutate('Bend type', () => notes.forEach(n => { n.tech = n.tech || {}; if (!n.tech.bend) n.tech.bend = 2; n.tech.bendType = type; }));
  }
  function setDyn(d) { SDAW.store.setNoteProp('dyn', d); }
  function moveToVoice(v) {
    const s = SDAW.store, notes = s.selNotes();
    if (!notes.length) return SDAW.toast('Select notes first');
    s.mutate('Voice', () => notes.forEach(n => { if (v) n.voice = v; else delete n.voice; }));
  }
  /** Bar tools act on the bar of the cursor (click in a bar first) */
  function targetBars() { return [Math.floor(SDAW.store.sel.cursor / BT())]; }
  function barTool(kind) {
    const s = SDAW.store, bars = targetBars().sort((a, b) => a - b);
    const first = bars[0], last = bars[bars.length - 1];
    if (kind === 'rs') return s.setBarMark(first, 'rs', !s.barMark(first).rs);
    if (kind === 're') {
      if (s.barMark(last).re) return s.setBarMark(last, 're', null);
      return SDAW.ask('How many times is it played? (2 = play twice)', '2', v => s.setBarMark(last, 're', Math.max(2, parseInt(v, 10) || 2)));
    }
    if (kind === 'end') {
      const cur = s.barMark(first).end;
      return SDAW.ask('Alternate ending number(s) for bar ' + (first + 1) + ' (e.g. 1  or  1,2 — empty to remove)', cur ? cur.join(',') : '1', v => {
        const list = v.split(/[ ,]+/).map(x => parseInt(x, 10)).filter(x => x > 0);
        bars.forEach(b => s.setBarMark(b, 'end', list.length ? list : null));
      });
    }
    if (kind === 'dbl') return s.setBarMark(last, 'dbl', !s.barMark(last).dbl);
    if (kind === 'segno') return s.setBarMark(first, 'segno', !s.barMark(first).segno);
    if (kind === 'coda') return s.setBarMark(first, 'coda', !s.barMark(first).coda);
    if (kind === 'fine') return s.setBarMark(last, 'fine', !s.barMark(last).fine);
    // D.C. / D.S. cycle through their forms on every click (and are PLAYED: audio.js unfoldBars)
    if (kind === 'dc' || kind === 'ds') {
      const forms = kind === 'dc' ? ['D.C. al Fine', 'D.C. al Coda', 'D.C.'] : ['D.S. al Coda', 'D.S. al Fine', 'D.S.'];
      const cur = s.barMark(last).jump, i = forms.indexOf(cur);
      const next = i < 0 ? forms[0] : (i < forms.length - 1 ? forms[i + 1] : null);
      if (next) SDAW.toast(next + ' on bar ' + (last + 1) + (next.includes('Fine') ? ' — mark the end with Fine' : next.includes('Coda') ? ' — mark "To Coda" and the Coda bar' : '') + ' · click again for the next form');
      return s.setBarMark(last, 'jump', next);
    }
    if (kind === 'tocoda') return s.setBarMark(last, 'tocoda', !s.barMark(last).tocoda);
    if (kind === 'text') return SDAW.ask('Text over bar ' + (first + 1), s.barMark(first).text || '', v => s.setBarMark(first, 'text', v));
    if (kind === 'clear') return s.mutate('Clear bar marks', song => bars.forEach(b => { if (song.barMarks) delete song.barMarks[b]; }));
  }

  /* ========================================================== PALETTE == */
  /**
   * Palette buttons: [symbol, help, action, isActive?]
   * Active state reflects the selected notes (or the next note settings).
   */
  function renderPalette() {
    const box = $('#npal'); if (!box) return;
    box.classList.toggle('hidden', !nt.paletteOpen);
    if (!nt.paletteOpen) return;
    const s = SDAW.store, notes = s.selNotes();
    const has = (fn) => notes.length > 0 && notes.every(fn);
    const T = (k, v) => has(n => n.tech && (v === undefined ? !!n.tech[k] : n.tech[k] === v));
    const btn = (sym, help, fn, on, cls) => el('button', { class: 'np-btn' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), 'data-help': help, onclick: fn }, sym);
    const sec = (title, buttons) => el('div', { class: 'np-sec' }, [el('div', { class: 'np-title' }, title), el('div', { class: 'np-grid' }, buttons)]);
    box.innerHTML = '';
    const nsel = notes.length;
    box.appendChild(el('div', { class: 'np-head' }, [el('b', {}, 'Palette'), el('span', {}, nsel ? nsel + ' selected' : 'next note')]));

    box.appendChild(sec('Voice', [0, 1, 2, 3].map(v => el('button', {
      class: 'np-btn voice' + (s.sel.voice === v ? ' on' : ''), style: { '--vc': VOICE_COLORS[v] },
      'data-help': 'Voice ' + (v + 1) + ': write notes with their own rhythm in the same bar (voice 1 stems up, voice 2 stems down). Shift+click = move the selected notes to this voice.',
      onclick: (e) => { if (e.shiftKey) moveToVoice(v); else { s.sel.voice = v; SDAW.bus.emit('selection', { type: 'voice' }); } }
    }, String(v + 1)))));

    const durs = [[16, '𝅝', 'Whole'], [8, '𝅗𝅥', 'Half'], [4, '♩', 'Quarter'], [2, '♪', 'Eighth'], [1, '𝅘𝅥𝅯', '16th'], [0.5, '𝅘𝅥𝅰', '32nd']];
    box.appendChild(sec('Duration', durs.map(([tk, sym, name]) => btn(sym, name + ' — click with notes selected to change their duration', () => SDAW.input.setDuration(tk), s.sel.duration === tk, 'music'))
      .concat([
        btn('•', 'Dotted (.) — on the selected notes or the next note', toggleDot, nsel ? has(n => [12, 6, 3, 1.5, 0.75].some(v => Math.abs((n.tup ? n.dur * 1.5 : n.dur) - v) < 0.01)) : s.sel.dot),
        btn('³', 'Triplet (3 in the time of 2)', toggleTriplet, nsel ? has(n => n.tup) : s.sel.tuplet),
        btn('𝄽', 'Rest (R): clears the cursor position and moves on', insertRest, false, 'music'),
        btn('⁀', 'Tie (L): joins the note to the previous note of the same pitch', () => s.setNoteProp('tie', true), has(n => n.tie)),
        btn('⇥', 'Shift next notes: when a duration changes, the following notes of the voice move with it (on) or stay where they are (off)', () => { s.sel.ripple = !s.sel.ripple; SDAW.toast(s.sel.ripple ? 'Duration changes shift the next notes' : 'Duration changes keep the next notes in place'); renderPalette(); }, s.sel.ripple)
      ])));

    box.appendChild(sec('Dynamics', ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'].map(d => btn(d, 'Dynamic ' + d + ' (sets the note volume)', () => setDyn(d), has(n => n.dyn === d), 'dyn'))
      .concat([btn('<', 'Crescendo (gets louder up to the next note)', () => s.setTechnique('hair', '<'), T('hair', '<')), btn('>', 'Decrescendo', () => s.setTechnique('hair', '>'), T('hair', '>'))])));

    box.appendChild(sec('Articulation', [
      btn('>', 'Accent (A)', () => s.setTechnique('accent'), T('accent')),
      btn('•̣', 'Staccato (short)', () => s.setTechnique('stacc'), T('stacc')),
      btn('( )', 'Ghost note (G): softer, in parentheses', () => s.setTechnique('ghost'), T('ghost')),
      btn('ring', 'Let ring', () => s.setTechnique('ring'), T('ring'), 'small'),
      btn('P.M.', 'Palm mute (K)', () => s.setTechnique('pm'), T('pm'), 'small'),
      btn('✕', 'Dead note (X)', () => s.setTechnique('mute'), T('mute')),
      btn('≡', 'Tremolo picking', () => s.setTechnique('trem'), T('trem')),
      btn('↓', 'Strum / pick stroke down', () => s.setTechnique('strum', 'down'), T('strum', 'down')),
      btn('↑', 'Strum / pick stroke up', () => s.setTechnique('strum', 'up'), T('strum', 'up'))
    ]));

    box.appendChild(sec('Guitar', [
      btn('H', 'Hammer-on (H)', () => s.setTechnique('h'), T('h')),
      btn('P', 'Pull-off (P)', () => s.setTechnique('p'), T('p')),
      btn('T', 'Tapping (T)', () => s.setTechnique('tap'), T('tap')),
      btn('∿', 'Vibrato (V)', () => s.setTechnique('vib'), T('vib')),
      btn('〰', 'Wide vibrato', () => s.setTechnique('wvib'), T('wvib')),
      btn('◇', 'Natural harmonic (O)', () => s.setTechnique('harm'), T('harm')),
      btn('A.H.', 'Artificial / pinch harmonic', () => s.setTechnique('pinch'), T('pinch'), 'small')
    ]));

    box.appendChild(sec('Slides', [
      btn('⟋', 'Shift slide between two notes (select both notes)', () => setSlide('shift'), T('slide', 'shift') || T('slide', true)),
      btn('⟋⁀', 'Legato slide between two notes (select both notes)', () => setSlide('legato'), T('slide', 'legato'), 'small'),
      btn('↗', 'Slide in from below', () => setSlide('inBelow'), T('slide', 'inBelow')),
      btn('↘', 'Slide in from above', () => setSlide('inAbove'), T('slide', 'inAbove')),
      btn('⤵', 'Slide out downwards', () => setSlide('outDown'), T('slide', 'outDown')),
      btn('⤴', 'Slide out upwards', () => setSlide('outUp'), T('slide', 'outUp'))
    ]));

    box.appendChild(sec('Bends', [[0.5, '¼'], [1, '½'], [2, 'full'], [3, '1½'], [4, '2']].map(([v, lab]) => btn(lab, 'Bend ' + lab + (v === 2 ? ' (1 tone)' : ''), () => setBend(v), T('bend', v), 'small'))
      .concat([
        btn('⤴', 'Bend up', () => setBendType('up'), T('bendType', 'up')),
        btn('⤴⤵', 'Bend and release', () => setBendType('release'), T('bendType', 'release'), 'small'),
        btn('↑', 'Pre-bend (bend before picking)', () => setBendType('pre'), T('bendType', 'pre')),
        btn('↧', 'Bend down (pre-bend and release)', () => setBendType('prerelease'), T('bendType', 'prerelease'))
      ])));

    const bm = s.barMark(targetBars()[0]);
    box.appendChild(sec('Bars (bar ' + (targetBars()[0] + 1) + ')', [
      btn('𝄆', 'Repeat start', () => barTool('rs'), bm.rs, 'music'),
      btn('𝄇', 'Repeat end (asks how many times)', () => barTool('re'), s.barMark(targetBars().slice(-1)[0]).re, 'music'),
      btn('1.', 'Alternate ending (1st, 2nd…)', () => barTool('end'), bm.end && bm.end.length),
      btn('‖', 'Double bar line', () => barTool('dbl'), s.barMark(targetBars().slice(-1)[0]).dbl),
      btn('𝄋', 'Segno', () => barTool('segno'), bm.segno, 'music'),
      btn('𝄌', 'Coda', () => barTool('coda'), bm.coda, 'music'),
      btn('Fine', 'Fine', () => barTool('fine'), s.barMark(targetBars().slice(-1)[0]).fine, 'small'),
      btn('→𝄌', '"To Coda": after the D.C. / D.S., the music jumps from here to the Coda bar', () => barTool('tocoda'), s.barMark(targetBars().slice(-1)[0]).tocoda, 'small'),
      btn('D.C.', 'D.C. al Fine', () => barTool('dc'), false, 'small'),
      btn('D.S.', 'D.S. al Coda', () => barTool('ds'), false, 'small'),
      btn('TXT', 'Text over the bar', () => barTool('text'), !!bm.text, 'small'),
      btn('⌫', 'Clear the marks of the bar(s)', () => barTool('clear'))
    ]));
    box.appendChild(el('div', { class: 'np-foot' }, 'Repeats and alternate endings are played. Drag a box over the score to select several notes.'));
  }

  /* ============================================================ TOOLS == */
  nt.tools = function (box) {
    const s = SDAW.store;
    box.appendChild(el('button', { class: 'tool-btn labeled' + (nt.paletteOpen ? ' on' : ''), 'data-help': 'Show / hide the notation palette', onclick: () => { nt.paletteOpen = !nt.paletteOpen; nt.render(); SDAW.app.renderEditor(); } }, '🎼 Palette'));
    const pick = el('select', { class: 'track-pick', 'data-help': 'Track shown in the score / tab', onchange: e => s.selectTrack(e.target.value) },
      s.song.tracks.filter(t => t.type !== 'drums').map(t => el('option', { value: t.id, selected: t.id === s.sel.trackId ? true : null }, (SDAW.TRACK_ICONS[t.type] || '') + ' ' + t.name)));
    box.appendChild(pick);
    box.appendChild(el('button', { class: 'tool-btn labeled danger', 'data-help': 'Delete selected notes (Delete)', onclick: () => s.deleteSelectedNotes() }, '🗑 Delete'));
  };

  /** Drops on the score / tab / piano roll: progressions, or a new sound for the track */
  function dropOnEditor(p) {
    const t = SDAW.store.selTrack();
    if (p.kind === 'progression') return SDAW.insertProgressionAtCursor(p.genre);
    if (p.kind === 'rhythm') return SDAW.createGroove(p.genre);
    if (p.kind === 'finst') return SDAW.factory.applyInstrument(p.instId, t && t.type !== 'drums' ? t : null);
    if (p.kind === 'instrument') return SDAW.applyInstrument(p, t && t.id);
    if (p.kind === 'sample') return SDAW.sampleAsInstrument(p, t && t.id);
  }
  SDAW.dropOnEditor = dropOnEditor;

  nt.init = function () {
    const view = $('#view-notation');
    const pal = el('div', { class: 'npal', id: 'npal' });
    view.insertBefore(pal, view.firstChild);
    $('#paper').addEventListener('mousedown', onDown);
    $('#paper').setAttribute('data-help', 'Click = cursor / select a note · drag a box = select several notes · in the tab type fret numbers (0-9) · ←/→ move · palette on the left for durations, techniques and bars.');
    SDAW.makeDropTarget(view, 'progression rhythm finst instrument sample', p => dropOnEditor(p));
    SDAW.bus.on('selection', () => { if (['score', 'tab', 'scoretab'].includes(SDAW.app.view)) renderPalette(); });
  };

})(window.SDAW);
