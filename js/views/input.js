/* =============================================================================
 *  INPUT.JS — input strip: Fretboard, Piano, Chord Builder, PC keyboard, MIDI
 *  -----------------------------------------------------------------------------
 *  All inputs write into the SELECTED track at the WRITE CURSOR when the
 *  "Write" toggle is on (step input, like Guitar Pro). While recording
 *  (transport playing + Rec), notes are written at the playhead instead.
 *
 *  Fretboard:  click = note · Shift+click = add to chord (cursor stays)
 *              shows scale overlay (R = root) and the notes under the playhead
 *  Piano:      click keys · PC keyboard rows Z..M (base octave) and Q..U (+1)
 *              [ / ] = octave down / up · Shift+1..7 = diatonic chords of the key
 *  Chords:     root + type -> guitar voicing + piano notes -> Insert
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;

  const inp = {
    mode: 'fretboard',
    scaleName: 'Major Pentatonic',
    showScale: true,
    hover: null,              // {string, fret}
    pcBase: CONFIG.piano.pcBaseNote,
    chordRoot: 0,
    chordType: '',
    lefty: false
  };
  SDAW.input = inp;

  /* --------------------------------------------- writing helper ---- */

  /** Called by every input source when a note is played */
  inp.playNote = function (pitch, pos, opts) {
    const s = SDAW.store, t = s.selTrack();
    opts = opts || {};
    if (t) SDAW.audio.previewNote(t, pitch);
    flash(pitch);
    if (!t || t.type === 'drums') return;
    // real-time recording
    if (SDAW.app.recording && SDAW.audio.playing) {
      const tick = Math.round(SDAW.audio.getTick());
      s.insertNote(pitch, Object.assign({ start: tick, dur: Math.max(1, s.sel.duration), keepCursor: true }, pos || {}));
      return;
    }
    if (!s.sel.writeMode) return;
    s.insertNote(pitch, Object.assign({ chord: !!opts.chord }, pos || {}));
  };

  function flash(pitch) {
    inp.flashPitch = pitch; inp.flashUntil = performance.now() + 250;
    SDAW.$$('.pkey[data-p="' + pitch + '"]').forEach(k => { k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 180); });
  }

  /* ======================================================= FRETBOARD == */
  const FB = { left: 70, right: 24, top: 18, bottom: 26 };

  function fretX(f, W) {
    // real guitar spacing (12th fret at the middle of the scale length), stretched to fit
    const usable = W - FB.left - FB.right;
    const n = CONFIG.guitar.frets;
    const total = 1 - Math.pow(2, -n / 12);
    return FB.left + usable * (1 - Math.pow(2, -f / 12)) / total;
  }
  function stringY(s, H) {
    // string 0 (low E) at the bottom, like looking at your own guitar
    const top = FB.top, bot = H - FB.bottom;
    return bot - (s / 5) * (bot - top);
  }

  inp.drawFretboard = function () {
    const cv = $('#fretCanvas');
    if (!cv || inp.mode !== 'fretboard' || cv.offsetWidth === 0) return;
    const W = cv.offsetWidth, H = cv.offsetHeight;
    if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; }
    const g = cv.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, W, H);
    const s = SDAW.store, song = s.song, track = s.selTrack();
    const isBass = track && track.type === 'bass';
    const tuning = isBass ? SDAW.BASS_TUNING.concat([]) : CONFIG.guitar.tuning;
    const nStr = tuning.length;
    const sy = (i) => isBass ? (H - FB.bottom) - (i / 3) * (H - FB.bottom - FB.top) : stringY(i, H);

    // neck wood
    const x0 = fretX(0, W), x1 = fretX(CONFIG.guitar.frets, W) + 10;
    const wood = g.createLinearGradient(0, FB.top - 10, 0, H - FB.bottom + 10);
    wood.addColorStop(0, '#2a160c'); wood.addColorStop(0.5, '#4a2a16'); wood.addColorStop(1, '#2a160c');
    g.fillStyle = wood; g.fillRect(x0, FB.top - 10, x1 - x0, H - FB.top - FB.bottom + 20);
    // grain
    g.globalAlpha = 0.08; g.strokeStyle = '#000';
    for (let i = 0; i < 40; i++) { g.beginPath(); const yy = FB.top - 8 + i * (H / 40); g.moveTo(x0, yy); g.bezierCurveTo(x0 + 200, yy + 4, x1 - 300, yy - 4, x1, yy + 2); g.stroke(); }
    g.globalAlpha = 1;
    // headstock / string labels
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, FB.top - 10, x0, H - FB.top - FB.bottom + 20);
    // nut
    g.fillStyle = '#efe6cf'; g.fillRect(x0 - 6, FB.top - 10, 6, H - FB.top - FB.bottom + 20);
    // fret wires + numbers
    for (let f = 1; f <= CONFIG.guitar.frets; f++) {
      const x = fretX(f, W);
      const met = g.createLinearGradient(x - 2, 0, x + 2, 0);
      met.addColorStop(0, '#777'); met.addColorStop(0.5, '#eee'); met.addColorStop(1, '#666');
      g.fillStyle = met; g.fillRect(x - 1.5, FB.top - 10, 3, H - FB.top - FB.bottom + 20);
      if (CONFIG.guitar.fretMarkers.includes(f)) {
        g.fillStyle = '#9a9cc8'; g.font = '11px Segoe UI'; g.textAlign = 'center';
        g.fillText(String(f), (x + fretX(f - 1, W)) / 2, H - 6);
      }
    }
    // inlays
    CONFIG.guitar.fretMarkers.forEach(f => {
      const cx = (fretX(f, W) + fretX(f - 1, W)) / 2, cy = (FB.top + H - FB.bottom) / 2;
      g.fillStyle = 'rgba(240,235,220,.55)';
      if (f === 12) { [-1, 1].forEach(k => { g.beginPath(); g.arc(cx, cy + k * (H - FB.top - FB.bottom) / 4, 4.5, 0, 7); g.fill(); }); }
      else { g.beginPath(); g.arc(cx, cy, 4.5, 0, 7); g.fill(); }
    });
    // strings
    for (let i = 0; i < nStr; i++) {
      const y = sy(i);
      const thick = isBass ? 3.2 - i * 0.4 : 2.6 - i * 0.35;
      const sg = g.createLinearGradient(0, y - thick, 0, y + thick);
      sg.addColorStop(0, '#fff8e0'); sg.addColorStop(0.5, i < (isBass ? 4 : 3) ? '#c8a564' : '#e8e8f0'); sg.addColorStop(1, '#5a4a30');
      g.fillStyle = sg; g.fillRect(x0 - 6, y - thick / 2, x1 - x0 + 6, thick);
      // label
      g.fillStyle = '#fff'; g.font = '600 12px Segoe UI'; g.textAlign = 'center';
      g.beginPath(); g.arc(30, y, 10, 0, 7); g.fillStyle = 'rgba(155,92,255,.35)'; g.fill();
      g.fillStyle = '#fff'; g.fillText(SDAW.NOTE_NAMES[tuning[i] % 12], 30, y + 4);
    }

    const posX = (f) => f === 0 ? x0 - 18 : (fretX(f, W) + fretX(f - 1, W)) / 2;
    const dot = (str, f, fill, ring, label, glow) => {
      const x = posX(f), y = sy(str);
      g.save();
      if (glow) { g.shadowColor = glow; g.shadowBlur = 14; }
      g.beginPath(); g.arc(x, y, 9, 0, 7); g.fillStyle = fill; g.fill();
      if (ring) { g.lineWidth = 2.5; g.strokeStyle = ring; g.stroke(); }
      g.restore();
      if (label) { g.fillStyle = '#111'; g.font = '700 10px Segoe UI'; g.textAlign = 'center'; g.fillText(label, x, y + 3.5); }
    };

    // scale overlay
    if (inp.showScale) {
      const pcs = SDAW.scalePCs(song.key, inp.scaleName);
      const root = SDAW.noteIndex(song.key);
      for (let i = 0; i < nStr; i++) for (let f = 0; f <= Math.min(CONFIG.guitar.frets, 21); f++) {
        const pc = (tuning[i] + f) % 12;
        if (!pcs.includes(pc)) continue;
        if (pc === root) dot(i, f, 'rgba(255,210,63,.9)', '#fff3b0', 'R', '#ffd23f');
        else dot(i, f, 'rgba(34,224,255,.35)', 'rgba(34,224,255,.8)', '');
      }
    }
    // chord shape preview (Chords tab hover) or selected notes
    const selNotes = s.selNotes();
    selNotes.forEach(n => { if (n.string !== undefined) dot(n.string, n.fret, '#ff4fd8', '#fff', String(n.fret), '#ff4fd8'); });
    // notes sounding under the playhead
    if (track && track.type !== 'drums' && SDAW.audio.playing && !SDAW.audio.patternMode) {
      const tick = SDAW.audio.getTick();
      s.trackNotes(track).forEach(n => { if (tick >= n.start && tick < n.start + n.dur && n.string !== undefined) dot(n.string, n.fret, '#2bff88', '#fff', String(n.fret), '#2bff88'); });
    }
    // hover
    if (inp.hover) dot(inp.hover.string, inp.hover.fret, 'rgba(255,255,255,.25)', '#fff', '');
  };

  function fretHit(e) {
    const cv = $('#fretCanvas');
    const r = cv.getBoundingClientRect();
    const sc = r.width / cv.offsetWidth;
    const x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
    const W = cv.offsetWidth, H = cv.offsetHeight;
    const t = SDAW.store.selTrack(), isBass = t && t.type === 'bass';
    const nStr = isBass ? 4 : 6;
    let best = 0, bd = 1e9;
    for (let i = 0; i < nStr; i++) {
      const yy = isBass ? (H - FB.bottom) - (i / 3) * (H - FB.bottom - FB.top) : stringY(i, H);
      if (Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = i; }
    }
    let fret = 0;
    if (x >= fretX(0, W)) { for (let f = 1; f <= CONFIG.guitar.frets; f++) if (x < fretX(f, W)) { fret = f; break; } }
    if (x > fretX(CONFIG.guitar.frets, W)) return null;
    return { string: best, fret, bass: isBass };
  }

  /* =========================================================== PIANO == */
  /* --------------------------------------------- PLAYBACK ON THE PIANO ---
   *  While the song plays, the keys of the notes (and chords) of the selected
   *  track light up as they sound — green while held, brighter on the attack.
   *  The note list is cached and rebuilt only when the song or track changes.  */
  const playCache = { key: null, notes: [] };
  SDAW.bus.on('change', () => { playCache.key = null; });
  function soundingNotes(tick) {
    const s = SDAW.store, A = SDAW.audio, t = s.selTrack();
    if (!t || t.type === 'drums') return [];
    let notes;
    if (A.patternMode) {                               // PAT mode: the pattern being looped
      const p = s.selPattern();
      notes = p && p.kind === 'notes' ? p.notes : [];
    } else {
      const key = t.id + '|' + s.undoStack.length;
      if (playCache.key !== key) { playCache.key = key; playCache.notes = s.trackNotes(t); }
      notes = playCache.notes;
    }
    const out = [];
    for (const n of notes) {
      if (n.start > tick) { if (!A.patternMode) break; else continue; }   // trackNotes is sorted by start
      const bend = n.tech && n.tech.bend && tick - n.start > 0.5 ? n.tech.bend : 0;
      if (tick < n.start + n.dur) out.push({ pitch: n.pitch + bend, hit: tick - n.start < 0.6 });
    }
    return out;
  }
  let litKeys = [];
  inp.updatePianoPlayback = function () {
    const wrap = $('#pianoWrap');
    if (inp.mode !== 'piano' || !wrap) return;
    const A = SDAW.audio;
    const now = A.playing ? soundingNotes(A.getTick()) : [];
    const want = new Map(); now.forEach(n => { want.set(n.pitch, want.get(n.pitch) || n.hit); });
    litKeys.forEach(k => { const p = +k.dataset.p; if (!want.has(p)) k.classList.remove('play', 'hit'); });
    litKeys = [];
    want.forEach((hit, p) => {
      const k = wrap.querySelector('.pkey[data-p="' + p + '"]');
      if (!k) return;
      k.classList.add('play'); k.classList.toggle('hit', hit);
      litKeys.push(k);
    });
  };

  inp.buildPiano = function () {
    const wrap = $('#pianoWrap');
    wrap.innerHTML = ''; litKeys = [];
    const piano = el('div', { class: 'piano' });
    const lo = CONFIG.piano.lowNote, hi = CONFIG.piano.highNote;
    const whites = [];
    for (let p = lo; p <= hi; p++) if (!SDAW.isBlack(p)) whites.push(p);
    const ww = 100 / whites.length;
    const song = SDAW.store.song;
    const pcs = SDAW.scalePCs(song.key, song.scale === 'minor' ? 'Natural Minor' : 'Major');
    const root = SDAW.noteIndex(song.key);
    const pcLabel = {};
    Object.keys(CONFIG.piano.pcKeyMap).forEach(k => { pcLabel[inp.pcBase + CONFIG.piano.pcKeyMap[k]] = k.toUpperCase(); });
    let wi = 0;
    for (let p = lo; p <= hi; p++) {
      const black = SDAW.isBlack(p);
      const cls = 'pkey' + (black ? ' black' : '') + (pcs.includes(p % 12) ? ' scale' : '') + (p % 12 === root ? ' root' : '');
      const key = el('div', {
        class: cls, 'data-p': p,
        'data-help': SDAW.midiToName(p) + (pcLabel[p] ? ' — PC key ' + pcLabel[p] : '') + '. Click to play / write.',
        onmousedown: (e) => inp.playNote(p, null, { chord: e.shiftKey })
      }, [pcLabel[p] ? el('span', { class: 'pc' }, pcLabel[p]) : null, !black && p % 12 === 0 ? 'C' + (Math.floor(p / 12) - 1) : null]);
      if (black) { key.style.left = ((wi - 0.32) * ww) + '%'; key.style.width = (ww * 0.64) + '%'; }
      else wi++;
      piano.appendChild(key);
    }
    wrap.appendChild(piano);
  };

  /* ==================================================== CHORD BUILDER == */
  inp.buildChords = function () {
    const wrap = $('#chordWrap');
    wrap.innerHTML = '';
    const song = SDAW.store.song;
    const ch = { root: inp.chordRoot, intervals: SDAW.CHORDS[inp.chordType], name: SDAW.NOTE_NAMES[inp.chordRoot] + inp.chordType };
    const frets = SDAW.chordVoicing(ch.root, ch.intervals);

    const left = el('div', {}, [
      el('div', { class: 'cb-roots' }, SDAW.NOTE_NAMES.map((n, i) => el('button', { class: 'cb-btn' + (i === inp.chordRoot ? ' active' : ''), onclick: () => { inp.chordRoot = i; inp.buildChords(); previewChord(); } }, n))),
      el('div', { class: 'cb-types' }, Object.keys(SDAW.CHORDS).map(t => el('button', { class: 'cb-btn' + (t === inp.chordType ? ' active' : ''), onclick: () => { inp.chordType = t; inp.buildChords(); previewChord(); } }, t || 'maj'))),
      el('div', { class: 'cb-diatonic', 'data-help': 'Chords of the song key. Shortcut: Shift + 1…7' },
        [1, 2, 3, 4, 5, 6, 7].map(d => { const dc = SDAW.diatonicChord(song.key, song.scale, d); return el('button', { class: 'cb-btn', onclick: () => { inp.chordRoot = dc.root; inp.chordType = dc.type; inp.buildChords(); previewChord(); } }, [dc.name, el('small', {}, SDAW.romanFor(song.scale, d) + ' · ⇧' + d)]); }))
    ]);
    const mid = el('div', { class: 'cb-diagram' }, [
      el('div', { class: 'cb-name' }, ch.name),
      el('button', { class: 'btn primary', 'data-help': 'Insert this chord at the write cursor of the selected track', onclick: () => inp.insertCurrentChord() }, '＋ Insert'),
      el('button', { class: 'btn', onclick: previewChord }, '▶ Listen')
    ]);
    const right = el('div', { class: 'cb-diagram' }, [chordDiagram(frets)]);
    wrap.appendChild(el('div', { class: 'chord-builder' }, [left, mid, right]));
  };

  function chordPitches(root, type) {
    const base = 48 + root;
    return SDAW.CHORDS[type].map(iv => base + iv);
  }
  function previewChord() {
    const t = SDAW.store.selTrack();
    const frets = SDAW.chordVoicing(inp.chordRoot, SDAW.CHORDS[inp.chordType]);
    if (t && t.type === 'guitar') SDAW.audio.previewChord(t, frets.map((f, s) => f >= 0 ? CONFIG.guitar.tuning[s] + f : null).filter(x => x !== null), true);
    else SDAW.audio.previewChord(t || SDAW.store.song.tracks[0], chordPitches(inp.chordRoot, inp.chordType), false);
  }
  inp.insertCurrentChord = function () {
    const name = SDAW.NOTE_NAMES[inp.chordRoot] + inp.chordType;
    const frets = SDAW.chordVoicing(inp.chordRoot, SDAW.CHORDS[inp.chordType]);
    SDAW.store.insertChord({ name, frets, pitches: chordPitches(inp.chordRoot, inp.chordType) });
    previewChord();
  };
  /** Shift+1..7 */
  inp.insertDiatonic = function (degree) {
    const song = SDAW.store.song;
    const dc = SDAW.diatonicChord(song.key, song.scale, degree);
    inp.chordRoot = dc.root; inp.chordType = dc.type;
    inp.insertCurrentChord();
    if (inp.mode === 'chords') inp.buildChords();
  };

  /** Small SVG chord box (6 strings x 5 frets) */
  function chordDiagram(frets) {
    const used = frets.filter(f => f > 0);
    const minF = used.length ? Math.min(...used) : 1;
    const start = Math.max(...frets) <= 4 ? 1 : minF;
    const W = 150, H = 150, x0 = 25, y0 = 28, sw = 20, fh = 22;
    const svg = SDAW.svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.appendChild(SDAW.svg('rect', { x: x0, y: y0, width: sw * 5, height: fh * 5, fill: 'rgba(255,255,255,.04)', stroke: 'none' }));
    for (let i = 0; i < 6; i++) svg.appendChild(SDAW.svg('line', { x1: x0 + i * sw, y1: y0, x2: x0 + i * sw, y2: y0 + fh * 5, stroke: '#bbb', 'stroke-width': 1.2 }));
    for (let j = 0; j <= 5; j++) svg.appendChild(SDAW.svg('line', { x1: x0, y1: y0 + j * fh, x2: x0 + sw * 5, y2: y0 + j * fh, stroke: '#bbb', 'stroke-width': j === 0 && start === 1 ? 4 : 1.2 }));
    if (start > 1) svg.appendChild(SDAW.svg('text', { x: x0 + sw * 5 + 6, y: y0 + fh * 0.7, fill: '#ccc', 'font-size': 12 }, start + 'fr'));
    frets.forEach((f, s) => {
      const x = x0 + s * sw;
      if (f < 0) svg.appendChild(SDAW.svg('text', { x, y: y0 - 8, fill: '#ff6b8a', 'font-size': 13, 'text-anchor': 'middle' }, '×'));
      else if (f === 0) svg.appendChild(SDAW.svg('circle', { cx: x, cy: y0 - 12, r: 5, fill: 'none', stroke: '#22e0ff', 'stroke-width': 1.6 }));
      else svg.appendChild(SDAW.svg('circle', { cx: x, cy: y0 + (f - start + 0.5) * fh, r: 7.5, fill: '#9b5cff', stroke: '#e0d0ff', 'stroke-width': 1.2 }));
    });
    return svg;
  }
  SDAW.chordDiagram = chordDiagram;

  /* ============================================= OPTIONS + PALETTE ==== */
  function renderOptions() {
    const o = $('#inputOptions');
    o.innerHTML = '';
    if (inp.mode === 'fretboard') {
      const sel = el('select', { 'data-help': 'Scale shown on the fretboard (in the song key)', onchange: e => { inp.scaleName = e.target.value; inp.drawFretboard(); } },
        Object.keys(SDAW.SCALES).map(n => el('option', { value: n, selected: n === inp.scaleName ? true : null }, n)));
      o.appendChild(el('label', {}, ['Scale', sel]));
      o.appendChild(el('button', { class: 'toggle-btn' + (inp.showScale ? ' on' : ''), 'data-help': 'Show / hide the scale notes on the fretboard', onclick: e => { inp.showScale = !inp.showScale; e.currentTarget.classList.toggle('on', inp.showScale); inp.drawFretboard(); } }, 'Show scale'));
      o.appendChild(el('span', { class: 'pro-only', 'data-help': 'Tuning used by the fretboard and tab' }, CONFIG.guitar.tuningName));
    } else if (inp.mode === 'piano') {
      o.appendChild(el('button', { class: 'tool-btn', 'data-help': 'PC keyboard octave down — [', onclick: () => { inp.pcBase = Math.max(24, inp.pcBase - 12); inp.buildPiano(); renderOptions(); } }, 'Oct −'));
      o.appendChild(el('span', {}, 'PC keys: ' + SDAW.midiToName(inp.pcBase)));
      o.appendChild(el('button', { class: 'tool-btn', 'data-help': 'PC keyboard octave up — ]', onclick: () => { inp.pcBase = Math.min(84, inp.pcBase + 12); inp.buildPiano(); renderOptions(); } }, 'Oct +'));
      o.appendChild(el('span', { class: 'pro-only', id: 'midiStatus' }, SDAW.input.midiName ? '● MIDI: ' + SDAW.input.midiName : '○ No MIDI device'));
    }
  }

  function renderPalette() {
    const p = $('#durPalette');
    p.innerHTML = '';
    CONFIG.grid.durations.forEach(d => p.appendChild(el('button', {
      class: 'dur-btn' + (SDAW.store.sel.duration === d.ticks ? ' active' : ''), 'data-help': d.name + ' note (' + d.ticks + '/16). Shortcuts: 1=whole … 5=sixteenth (in the score / tab)',
      onclick: () => inp.setDuration(d.ticks)
    }, d.symbol)));
  }
  inp.setDuration = function (ticks) {
    SDAW.store.applyDuration(ticks);       // also changes the selected notes, like Guitar Pro
    renderPalette();
    SDAW.bus.emit('selection', { type: 'duration' });
  };
  inp.renderPalette = () => renderPalette();

  inp.setMode = function (mode) {
    inp.mode = mode;
    SDAW.$$('#inputTabs .tab').forEach(b => b.classList.toggle('active', b.dataset.input === mode));
    $('#fretCanvas').classList.toggle('hidden', mode !== 'fretboard');
    $('#pianoWrap').classList.toggle('hidden', mode !== 'piano');
    $('#chordWrap').classList.toggle('hidden', mode !== 'chords');
    if (mode === 'piano') inp.buildPiano();
    if (mode === 'chords') inp.buildChords();
    renderOptions();
    requestAnimationFrame(inp.drawFretboard);
  };

  /* ------------------------------------------- INPUT FOLLOWS THE TRACK ---
   *  Selecting a keyboard track (piano, organ, synth, strings) shows the piano keyboard, which lights
   *  up the notes it plays during the song; a guitar / bass shows the fretboard. The Chords tab is left
   *  alone (it was chosen on purpose).                                                               */
  const KEYBOARD_TYPES = ['keys', 'synth', 'strings'];
  inp.followTrack = function () {
    if (inp.mode === 'chords' || !inp.setMode) return;
    const t = SDAW.store.selTrack(); if (!t) return;
    const want = KEYBOARD_TYPES.includes(t.type) ? 'piano' : (t.type === 'guitar' || t.type === 'bass') ? 'fretboard' : null;
    if (want && want !== inp.mode) inp.setMode(want);
  };
  SDAW.bus.on('selection', e => { if (e && e.type === 'track') inp.followTrack(); });

  /* ============================================================ MIDI == */
  function initMidi() {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(acc => {
      const bind = () => acc.inputs.forEach(input => {
        inp.midiName = input.name;
        input.onmidimessage = (m) => {
          if (SDAW.settings && !SDAW.settings.midiEnabled(input.id)) return;   // disabled in Settings → MIDI
          const [st, note, vel] = m.data;
          if ((st & 0xf0) === 0x90 && vel > 0) inp.playNote(note, null, { chord: false });
        };
      });
      bind(); acc.onstatechange = () => { bind(); renderOptions(); };
      renderOptions();
    }).catch(() => { /* MIDI not allowed */ });
  }

  /* ============================================================ INIT == */
  inp.init = function () {
    SDAW.$$('#inputTabs .tab').forEach(b => b.addEventListener('click', () => inp.setMode(b.dataset.input)));
    $('#btnWrite').addEventListener('click', e => {
      SDAW.store.sel.writeMode = !SDAW.store.sel.writeMode;
      e.currentTarget.classList.toggle('on', SDAW.store.sel.writeMode);
      SDAW.toast(SDAW.store.sel.writeMode ? 'Write ON: notes are written at the cursor' : 'Write OFF: listen only');
    });
    const cv = $('#fretCanvas');
    cv.addEventListener('mousemove', e => { const h = fretHit(e); inp.hover = h; inp.drawFretboard(); });
    cv.addEventListener('mouseleave', () => { inp.hover = null; inp.drawFretboard(); });
    cv.addEventListener('mousedown', e => {
      const h = fretHit(e); if (!h) return;
      const tuning = h.bass ? SDAW.BASS_TUNING : CONFIG.guitar.tuning;
      const pitch = tuning[h.string] + h.fret;
      SDAW.app.focusZone = 'input';
      inp.playNote(pitch, { string: h.string, fret: h.fret }, { chord: e.shiftKey });
    });
    cv.setAttribute('data-help', 'Fretboard: click a fret to write that note on the selected track. Shift+click builds a chord. Gold R = root of the key.');
    renderPalette();
    inp.setMode('fretboard');
    initMidi();
    SDAW.bus.on('change', () => { inp.drawFretboard(); if (inp.mode === 'piano') inp.buildPiano(); if (inp.mode === 'chords') inp.buildChords(); });
    SDAW.bus.on('selection', () => { inp.drawFretboard(); renderPalette(); });
    SDAW.bus.on('songLoaded', () => renderOptions());
  };

  /** PC keyboard as piano (called by app.js key handler). Returns true if handled. */
  inp.handlePcKey = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.shiftKey && /^Digit[1-7]$/.test(e.code) && CONFIG.piano.chordKeysEnabled) { inp.insertDiatonic(+e.code.slice(5)); return true; }
    if (e.key === '[') { inp.pcBase = Math.max(24, inp.pcBase - 12); if (inp.mode === 'piano') inp.buildPiano(); renderOptions(); return true; }
    if (e.key === ']') { inp.pcBase = Math.min(84, inp.pcBase + 12); if (inp.mode === 'piano') inp.buildPiano(); renderOptions(); return true; }
    const off = CONFIG.piano.pcKeyMap[e.key.toLowerCase()];
    if (off === undefined || e.repeat) return false;
    inp.playNote(inp.pcBase + off, null, { chord: e.shiftKey });
    return true;
  };

})(window.SDAW);
