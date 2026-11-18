/* =============================================================================
 *  MODEL.JS — the single song data model (v2: patterns + clips)
 *  -----------------------------------------------------------------------------
 *  Like Lemon-Studio / FL Studio, music lives in PATTERNS and the song is
 *  built by placing CLIPS of those patterns on the tracks of the Arrange.
 *  Every view reads SDAW.store.song and changes it ONLY through store.mutate()
 *  (undo snapshot + 'change' event so every view redraws).
 *
 *  Time unit: 1 tick = one 16th note.  16 ticks = one 4/4 bar.
 *
 *  song.patterns[] = {
 *     id, name, kind: 'notes' | 'drums', length (ticks), color,
 *     notes[]  (kind notes) = { id, start (inside the pattern), dur, pitch, vel, string, fret, tech }
 *     drum     (kind drums) = { rows: { kick:[length], snare:[...], ... } }   values 0..1
 *  }
 *  song.tracks[] = {
 *     id, name, type ('guitar'|'bass'|'keys'|'strings'|'synth'|'drums'), engine,
 *     instrument, params, color, vol, pan, mute, solo, sendRev, sendDly,
 *     technique {}, fx {} (pedalboard),
 *     clips[] = { id, kind:'pattern', patternId, start, len }        (pattern loops inside len)
 *             | { id, kind:'audio', sampleId, start, len, gain }      (audio file)
 *     sampler = { zones:[{ sampleId, root }] } | null   (instrument made of real samples)
 *     drumMap = { rowId: sampleId }                    (real samples for drum pads)
 *  }
 *  song.samples[] = { id, name, path, duration, root }   (files stored in IndexedDB)
 *  song.chords[]  = { tick, name }   chord symbols over the score
 *  song.sections[]= { id, name, start (bar), length (bars), color }
 *
 *  "Linked" patterns: every clip of the same pattern plays the same music;
 *  editing the pattern changes all of them. "Make unique" copies the pattern.
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  const BAR4 = 16;                         // 4/4 bar (genre builders below)
  const BAR = () => SDAW.barTicks();         // bar length of the current song (time signature)
  SDAW.BAR = BAR4;

  /** Drum pads used by the step sequencer and the drum engine */
  SDAW.DRUM_ROWS = [
    { id: 'kick',  name: 'Kick',            color: '#ff9f2e' },
    { id: 'snare', name: 'Snare',           color: '#ffcc33' },
    { id: 'hhc',   name: 'Hi-Hat (Closed)', color: '#7cff4f' },
    { id: 'hho',   name: 'Hi-Hat (Open)',   color: '#36f1cd' },
    { id: 'tom1',  name: 'Tom 1 / Conga Hi', color: '#ff4fd8' },
    { id: 'tom2',  name: 'Tom 2 / Conga Lo', color: '#d36bff' },
    { id: 'clap',  name: 'Clap',            color: '#ff5fa2' },
    { id: 'perc',  name: 'Perc / Cowbell',  color: '#9b8cff' },
    { id: 'crash', name: 'Crash',           color: '#ffe27a' },
    { id: 'ride',  name: 'Ride',            color: '#c8ff3a' }
  ];
  /** Make sure a drum pattern has every pad row (older projects had 8 pads) */
  SDAW.normalizeDrumPattern = function (p) {
    if (p.kind !== 'drums') return p;
    p.drum = p.drum || { rows: {} };
    SDAW.DRUM_ROWS.forEach(r => { if (!p.drum.rows[r.id] || p.drum.rows[r.id].length !== p.length) { const o = p.drum.rows[r.id] || []; p.drum.rows[r.id] = new Array(p.length).fill(0).map((_, i) => o[i] || 0); } });
    return p;
  };

  const PATTERN_COLORS = ['#9b5cff', '#3fa9ff', '#2bdc7a', '#ffb02e', '#ff4fd8', '#36f1cd', '#ff6b6b', '#c8ff3a'];

  /** Pedalboard of a new track (pedal types and models: pedals.js) */
  function defaultFx() { return SDAW.defaultPedals(); }

  /* =========================================================== FACTORIES == */

  /** A new pattern. kind: 'notes' | 'drums' */
  SDAW.makePattern = function (kind, name, length, color) {
    const p = { id: SDAW.uid('pat'), name: name || (kind === 'drums' ? 'Beat' : 'Pattern'), kind, length: length || BAR(), color: color || null };
    if (kind === 'drums') { p.drum = { rows: {} }; SDAW.DRUM_ROWS.forEach(r => { p.drum.rows[r.id] = new Array(p.length).fill(0); }); }
    else p.notes = [];
    return p;
  };

  /** Change the length of a pattern (drum rows are resized) */
  SDAW.setPatternLength = function (p, len) {
    if (p.kind === 'drums') SDAW.DRUM_ROWS.forEach(r => {
      const old = p.drum.rows[r.id] || [];
      const arr = new Array(len).fill(0);
      for (let i = 0; i < len; i++) arr[i] = old.length ? (i < old.length ? old[i] : old[i % old.length]) : 0;
      p.drum.rows[r.id] = arr;
    });
    p.length = len;
  };

  /** the sound source that plays a track instead of its own engine (null = its engine plays) — same order as audio.js */
  SDAW.otherSource = function (t) {
    if (!t) return null;
    if (t.plugin && SDAW.desktop && SDAW.desktop.on) return 'The plugin ' + (t.plugin.name || '');
    if (t.midiOut && t.midiOut.id) return 'The external MIDI output';
    if (t.sampler && t.sampler.zones && t.sampler.zones.length) return 'The sampler assigned to this track';
    return null;
  };
  /** engines with their own effects (Guitar Rig, Piano Rig, Wind Rig): no second reverb from the pedalboard */
  SDAW.RIG_ENGINES = ['rig', 'pianorig', 'windrig'];
  SDAW.isRigEngine = e => SDAW.RIG_ENGINES.includes(e);

  SDAW.isPianoTrack = function (track) {
    if (!track || track.type !== 'keys') return false;
    if (track.engine === 'harp') return true;
    const rig = track.engine === 'pianorig' && track.params && track.params.prig;
    if (rig) return rig === 'grand' || rig === 'epiano';
    return /\b(?:piano|rhodes|wurlitzer)\b/i.test(track.instrument || '');
  };
  SDAW.pianoStaffForPitch = pitch => pitch < 60 ? 2 : 1; // C4 starts the treble staff

  /** A new track for a library instrument */
  SDAW.makeTrack = function (inst, name) {
    const rig = SDAW.isRigEngine(inst.engine);   // Guitar / Piano / Wind Rig: own amp + effects
    const t = {
      id: SDAW.uid('trk'),
      name: name || inst.name,
      type: inst.type, engine: inst.engine, instrument: inst.name, source: inst.source || 'Built-in',
      params: SDAW.deepCopy(inst.params || {}),
      color: CONFIG.colors[inst.type] || CONFIG.colors.accent,
      vol: 0.8, pan: 0, mute: false, solo: false, sendRev: rig ? 0 : 0.2, sendDly: 0,
      technique: { bendRange: 2, vibDepth: 0.45, vibSpeed: 5.5, slideTime: 0.12, humanize: 0.2, resonance: 0.7, attack: 0.6 },
      fx: (() => { const f = defaultFx(); if (inst.params && inst.params.drive) f.drive.on = true; if (inst.params && inst.params.chorus) f.chorus.on = true; if (inst.type === 'drums' || rig) f.reverb.on = false; return f; })(),
      clips: [], sampler: inst.params && inst.params.sampler ? { zones: [] } : null, drumMap: {}
    };
    // a new Guitar Rig track starts from your Guitar Lab reference (★) when you saved one
    if (inst.engine === 'rig' && SDAW.guitarRig && SDAW.guitarRig.ok() && !t.params.rigS) t.params.rigS = SDAW.guitarRig.seed(t.params.rig);
    // a new Piano Rig track: Piano Lab reference (⭐) + the starting sound of the library item
    if (inst.engine === 'pianorig' && SDAW.pianoRig && SDAW.pianoRig.ok() && !t.params.prigS) t.params.prigS = SDAW.pianoRig.seed(t.params.prig, SDAW.pianoRig.itemSound(inst));
    // a new Wind Rig track: Wind Lab reference (⭐) + the starting sound of the library item
    if (inst.engine === 'windrig' && SDAW.windRig && SDAW.windRig.ok() && !t.params.wrigS) t.params.wrigS = SDAW.windRig.seed(t.params.wrig, SDAW.windRig.itemSound(inst));
    return t;
  };

  SDAW.findInstrument = function (name, type) {
    for (const g of CONFIG.library.instruments) for (const it of g.items) if (it.name === name) return it;
    // fallback by type: prefer the light built-in engines (the Guitar Rig is chosen on purpose)
    for (const g of CONFIG.library.instruments) for (const it of g.items) if (it.type === type && !SDAW.isRigEngine(it.engine)) return it;
    for (const g of CONFIG.library.instruments) for (const it of g.items) if (it.type === type) return it;
    return CONFIG.library.instruments[0].items[0];
  };

  /* ============================================================== STORE == */
  const store = {
    song: null,
    undoStack: [],
    redoStack: [],
    sel: {
      trackId: null, clipId: null, patternId: null,
      noteIds: [], cursor: 0, cursorString: 5,
      duration: CONFIG.grid.defaultDuration, writeMode: true,
      voice: 0,          // notation voice being written (0..3), like Guitar Pro voices 1-4
      dot: false,        // dotted durations
      tuplet: false,     // triplets (3 in the time of 2)
      ripple: true       // changing a duration shifts the next notes of the voice (like Guitar Pro)
    },

    /** Duration (ticks) used for new notes: base x dot x triplet */
    curDur() { return this.sel.duration * (this.sel.dot ? 1.5 : 1) * (this.sel.tuplet ? 2 / 3 : 1); },

    /** Change the duration of the selected notes (keeps the dot / triplet switches) */
    applyDuration(base) {
      this.sel.duration = base;
      const notes = this.selNotes();
      if (!notes.length) return;
      const d = this.curDur();
      this.mutate('Duration', () => {
        const changes = new Map(notes.map(n => [n, d]));
        this.rippleDurations(changes);
        notes.forEach(n => { if (this.sel.tuplet) n.tup = 3; else delete n.tup; });
      });
    },

    /**
     * Give notes new durations and (when sel.ripple is on) move the following
     * notes of the same voice so nothing overlaps and no gap opens — like
     * Guitar Pro. Chords (same start) move together. A pattern that grows past
     * its end gets longer (and its single block too). Call inside mutate().
     *   changes: Map(note -> new duration)
     */
    rippleDurations(changes) {
      const byPattern = new Map();
      this.song.patterns.forEach(p => (p.notes || []).forEach(n => { if (changes.has(n)) byPattern.set(p, true); }));
      if (!this.sel.ripple) { changes.forEach((d, n) => { n.dur = d; }); return; }
      byPattern.forEach((_, p) => {
        const voices = [...new Set(p.notes.filter(n => changes.has(n)).map(n => n.voice || 0))];
        voices.forEach(v => {
          const vnotes = p.notes.filter(n => (n.voice || 0) === v);
          const starts = [...new Set(vnotes.map(n => Math.round(n.start * 24) / 24))].sort((a, b) => a - b);
          let offset = 0;
          starts.forEach(st => {
            const group = vnotes.filter(n => Math.abs(n.start - st) < 1e-3);
            group.forEach(n => { n.start = Math.max(0, n.start + offset); });
            const sel = group.filter(n => changes.has(n));
            if (sel.length) {
              const oldDur = Math.max(...sel.map(n => n.dur)), newDur = changes.get(sel[0]);
              group.forEach(n => { if (changes.has(n) || Math.abs(n.dur - oldDur) < 1e-3) n.dur = newDur; });
              offset += newDur - oldDur;
            }
          });
        });
        // the pattern grows when notes were pushed past its end
        const end = Math.max(...p.notes.map(n => n.start + n.dur));
        if (end > p.length + 1e-3) {
          const oldLen = p.length, newLen = Math.ceil(end / BAR() - 1e-6) * BAR();
          const clips = []; this.song.tracks.forEach(t => t.clips.forEach(c => { if (c.patternId === p.id) clips.push({ t, c }); }));
          p.length = newLen;
          if (clips.length === 1 && clips[0].c.len === oldLen && !clips[0].c.offsetTicks) { this.carve(clips[0].t, clips[0].c.start + oldLen, newLen - oldLen, clips[0].c); clips[0].c.len = newLen; }
        }
        p.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
      });
    },

    /** Bar markers: repeats, alternate endings, double bars, segno / coda / text */
    barMark(bar) { return (this.song.barMarks || {})[bar] || {}; },
    setBarMark(bar, key, value) {
      this.mutate('Bar ' + key, song => {
        song.barMarks = song.barMarks || {};
        const m = song.barMarks[bar] = song.barMarks[bar] || {};
        if (value === undefined || value === null || value === false || (Array.isArray(value) && !value.length)) delete m[key]; else m[key] = value;
        if (!Object.keys(m).length) delete song.barMarks[bar];
      });
    },

    /**
     * Change the time signature of the song.
     *   mode 'time' : the music stays where it is in time; the bar lines move
     *                 (sections, repeats and the song length are re-counted)
     *   mode 'bars' : every bar keeps its content — each bar is cut (or padded
     *                 with silence) to the new length; blocks and patterns that
     *                 fill whole bars keep their number of bars
     */
    setTimeSig(num, den, mode) {
      const song = this.song, oldB = SDAW.barTicks(song), newB = num * 16 / den;
      if (!(newB >= 2) || newB % 1) return false;
      this.mutate('Time signature ' + num + '/' + den, () => {
        song.timeSig = [num, den];
        if (oldB === newB) return;
        const reBar = b => Math.round(b * oldB / newB);
        if (mode === 'bars') {
          // tick -> same bar, same position; null when it falls past the new bar end
          const map = t => { const b = Math.floor(t / oldB), w = t - b * oldB; return w >= newB - 1e-6 ? null : b * newB + w; };
          const mapLen = (start, len) => (start % oldB === 0 && len % oldB === 0) ? len / oldB * newB : Math.max(1, Math.round(len * newB / oldB));
          const done = new Set();
          song.patterns.forEach(p => {
            if (p.length % oldB) return;                     // not whole bars: left as it is
            done.add(p.id);
            const nl = p.length / oldB * newB;
            if (p.kind === 'drums') {
              Object.keys(p.drum.rows).forEach(r => {
                const old = p.drum.rows[r], out = new Array(nl).fill(0);
                old.forEach((v, i) => { const j = map(i); if (v && j !== null && j < nl) out[j] = v; });
                p.drum.rows[r] = out;
              });
            } else {
              p.notes = p.notes.filter(n => { const j = map(n.start); if (j === null) return false; const end = Math.floor(n.start / oldB) * newB + newB; n.start = j; n.dur = Math.min(n.dur, end - j); return n.dur > 0.01; });
            }
            p.length = nl;
          });
          song.tracks.forEach(t => t.clips.forEach(c => {
            const s0 = c.start;
            c.start = Math.floor(s0 / oldB) * newB + Math.min(newB - 1, s0 % oldB);
            c.len = mapLen(s0, c.len);
            if (c.kind === 'pattern' && c.offsetTicks && done.has(c.patternId)) c.offsetTicks = Math.round(c.offsetTicks / oldB * newB);
          }));
          song.chords = song.chords.filter(c => { const j = map(c.tick); if (j === null) return false; c.tick = j; return true; });
          song.tracks.forEach(t => { if (!t.auto) return; Object.keys(t.auto).forEach(k => { t.auto[k].forEach(pt => { const j = map(pt.t); pt.t = j === null ? Math.floor(pt.t / oldB) * newB + newB - 1 : j; }); }); });
          // song length / sections / repeats keep their bar numbers
        } else {
          const total = song.bars * oldB;
          song.bars = Math.max(1, Math.ceil(total / newB));
          song.sections.forEach(sc => { const a = reBar(sc.start), e = reBar(sc.start + sc.length); sc.start = a; sc.length = Math.max(1, e - a); });
          const marks = {};
          Object.keys(song.barMarks || {}).forEach(k => { const nb = reBar(+k); marks[nb] = Object.assign(marks[nb] || {}, song.barMarks[k]); });
          song.barMarks = marks;
        }
        this.fitSongLength();
      });
      return true;
    },

    /**
     * Insert `n` empty bars before bar `atBar` (0-based): blocks, chords,
     * sections, repeat marks, automation and the loop after that point move
     * right. A block that crosses the point is split (its right half moves).
     * Raw version (no undo step) for use inside mutate(): SDAW.insertBarsRaw.
     */
    insertBars(atBar, n) {
      if (!(n > 0)) return;
      this.mutate('Insert ' + n + ' bar' + (n > 1 ? 's' : ''), song => SDAW.insertBarsRaw(song, atBar, n));
    },

    newSong() {
      const T = CONFIG.transport;
      return { version: 2, title: 'Untitled Song', tempo: T.tempo, key: T.key, scale: T.scale, timeSig: T.timeSig.slice(), bars: T.bars,
        sections: [], chords: [], tracks: [], patterns: [], samples: [], barMarks: {} };
    },

    load(song, keepUndo) {
      song = SDAW.migrateSong(song);
      this.song = song;
      if (!keepUndo) { this.undoStack = []; this.redoStack = []; }
      this.sel.trackId = song.tracks[0] ? song.tracks[0].id : null;
      this.sel.clipId = null; this.sel.noteIds = []; this.sel.cursor = 0;
      const firstClip = song.tracks[0] && song.tracks[0].clips.find(c => c.kind === 'pattern');
      this.sel.patternId = firstClip ? firstClip.patternId : (song.patterns[0] ? song.patterns[0].id : null);
      if (SDAW.samples) SDAW.samples.preloadSong(song);
      SDAW.bus.emit('songLoaded', song);
      SDAW.bus.emit('change', { type: 'load' });
    },

    mutate(label, fn, opts) {
      // an export is rendering a fixed copy of the project: edits wait until it is finished
      if (this.rendering) { if (SDAW.toast) SDAW.toast('⏳ An export is rendering — wait until it has finished to edit (' + label + ' not done)'); return; }
      this.undoStack.push(JSON.stringify(this.song));
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
      fn(this.song);
      this.fitSongLength();
      SDAW.bus.emit('change', Object.assign({ type: 'mutate', label }, opts || {}));
    },
    /** Take an undo snapshot now; the caller changes the song step by step (drags) */
    beginEdit() { this.undoStack.push(JSON.stringify(this.song)); this.redoStack = []; },
    endEdit(label) { this.fitSongLength(); SDAW.bus.emit('change', { type: 'mutate', label }); },

    undo() {
      if (!this.undoStack.length) return SDAW.toast('Nothing to undo');
      this.redoStack.push(JSON.stringify(this.song));
      this.song = JSON.parse(this.undoStack.pop());
      this.validateSelection();
      SDAW.bus.emit('change', { type: 'undo' });
    },
    redo() {
      if (!this.redoStack.length) return SDAW.toast('Nothing to redo');
      this.undoStack.push(JSON.stringify(this.song));
      this.song = JSON.parse(this.redoStack.pop());
      this.validateSelection();
      SDAW.bus.emit('change', { type: 'redo' });
    },
    validateSelection() {
      if (!this.track(this.sel.trackId)) this.sel.trackId = this.song.tracks[0] ? this.song.tracks[0].id : null;
      if (!this.pattern(this.sel.patternId)) this.sel.patternId = this.song.patterns[0] ? this.song.patterns[0].id : null;
      if (!this.findClip(this.sel.clipId)) this.sel.clipId = null;
      const ids = new Set(); this.song.patterns.forEach(p => (p.notes || []).forEach(n => ids.add(n.id)));
      this.sel.noteIds = this.sel.noteIds.filter(id => ids.has(id));
    },

    /** The song grows automatically when clips reach past its end */
    fitSongLength() {
      let end = 0;
      this.song.tracks.forEach(t => t.clips.forEach(c => { end = Math.max(end, c.start + c.len); }));
      const bars = Math.ceil(end / BAR());
      if (bars > this.song.bars) this.song.bars = bars;
    },

    /* ------------------------------------------------------- queries --- */
    track(id) { return this.song.tracks.find(t => t.id === id) || null; },
    selTrack() { return this.track(this.sel.trackId); },
    pattern(id) { return this.song.patterns.find(p => p.id === id) || null; },
    selPattern() { return this.pattern(this.sel.patternId); },
    songTicks() { return this.song.bars * BAR(); },
    ticksPerBar() { return BAR(); },
    ticksPerBeat() { return CONFIG.grid.ticksPerBeat; },
    findClip(id) { for (const t of this.song.tracks) { const c = t.clips.find(x => x.id === id); if (c) return { track: t, clip: c }; } return null; },
    clipAt(track, tick) { return track ? track.clips.find(c => tick >= c.start && tick < c.start + c.len) || null : null; },
    /** How many clips use a pattern */
    patternUses(pid) { let n = 0; this.song.tracks.forEach(t => t.clips.forEach(c => { if (c.patternId === pid) n++; })); return n; },

    /**
     * Notes of a track at their song positions ("virtual" copies, one per
     * pattern repetition). Each item: { ...note, start (absolute), _ref (the
     * original note), _pattern, _clip }
     */
    trackNotes(track) {
      const out = [];
      if (!track) return out;
      track.clips.forEach(c => {
        if (c.kind !== 'pattern') return;
        const p = this.pattern(c.patternId);
        if (!p || p.kind !== 'notes' || !p.length) return;
        const L = p.length, o = (c.offsetTicks || 0) % L;
        p.notes.forEach(n => {
          if (n.start >= L) return;
          for (let k = ((n.start - o) % L + L) % L; k < c.len; k += L)
            out.push(Object.assign({}, n, { start: c.start + k, _ref: n, _pattern: p, _clip: c }));
        });
      });
      return out.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    },

    /** Original note objects that are selected */
    selNotes() {
      const ids = new Set(this.sel.noteIds), out = [];
      if (!ids.size) return out;
      this.song.patterns.forEach(p => (p.notes || []).forEach(n => { if (ids.has(n.id)) out.push(n); }));
      return out;
    },

    selectTrack(id) {
      if (this.sel.trackId === id) return;
      this.sel.trackId = id; this.sel.noteIds = [];
      const t = this.track(id);
      const c = this.clipAt(t, this.sel.cursor) || (t && t.clips.find(x => x.kind === 'pattern'));
      if (c && c.kind === 'pattern') this.sel.patternId = c.patternId;
      SDAW.bus.emit('selection', { type: 'track' });
    },
    selectClip(trackId, clipId) {
      this.sel.trackId = trackId; this.sel.clipId = clipId;
      const f = this.findClip(clipId);
      if (f && f.clip.kind === 'pattern') this.sel.patternId = f.clip.patternId;
      SDAW.bus.emit('selection', { type: 'clip' });
    },
    selectPattern(id) { this.sel.patternId = id; this.sel.noteIds = []; SDAW.bus.emit('selection', { type: 'pattern' }); },
    selectNotes(ids, additive) {
      this.sel.noteIds = additive ? Array.from(new Set(this.sel.noteIds.concat(ids))) : ids.slice();
      SDAW.bus.emit('selection', { type: 'notes' });
    },
    setCursor(tick) {
      this.sel.cursor = SDAW.clamp(Math.round(tick * 24) / 24, 0, Math.max(0, this.songTicks() - 1));   // 1/24 tick = triplet precision
      const c = this.clipAt(this.selTrack(), this.sel.cursor);
      if (c && c.kind === 'pattern') this.sel.patternId = c.patternId;
      SDAW.bus.emit('selection', { type: 'cursor' });
    },

    /* ------------------------------------------------ placing clips --- */

    /**
     * Make room for [start, start+len) on a track: blocks under that range are
     * trimmed (only the covered part disappears), fully covered blocks removed.
     */
    carve(track, start, len, keep) {
      const end = start + len, out = [];
      track.clips.forEach(c => {
        if (c === keep) { out.push(c); return; }
        const cEnd = c.start + c.len;
        if (cEnd <= start || c.start >= end) { out.push(c); return; }
        if (c.start < start) {                       // keep the part before
          const left = Object.assign({}, c, { len: start - c.start });
          out.push(left);
          if (cEnd > end) out.push(Object.assign({}, c, { id: SDAW.uid('clp'), start: end, len: cEnd - end, offsetTicks: (c.offsetTicks || 0) + (end - c.start) }));
        } else if (cEnd > end) {                     // keep the part after
          out.push(Object.assign({}, c, { start: end, len: cEnd - end, offsetTicks: (c.offsetTicks || 0) + (end - c.start) }));
        }
      });
      track.clips = out.sort((a, b) => a.start - b.start);
    },

    /** Place a clip of a pattern on a track (blocks underneath are trimmed) */
    placePattern(track, pattern, start, len) {
      len = len || pattern.length;
      store.carve(track, start, len);
      const clip = { id: SDAW.uid('clp'), kind: 'pattern', patternId: pattern.id, start, len };
      track.clips.push(clip);
      track.clips.sort((a, b) => a.start - b.start);
      return clip;
    },
    /**
     * Split a block in two at a song tick (pattern or audio). The right half
     * keeps playing the same material: its offsetTicks moves on by the cut.
     * Fades stay at the outer edges. Returns the new right block or null.
     */
    splitClip(clipId, tick) {
      const f = store.findClip(clipId); if (!f) return null;
      const c = f.clip, at = Math.round(tick);
      if (at <= c.start || at >= c.start + c.len) return null;
      let right = null;
      store.mutate('Split block', () => {
        const cut = at - c.start;
        right = Object.assign({}, c, { id: SDAW.uid('clp'), start: at, len: c.len - cut, offsetTicks: (c.offsetTicks || 0) + cut });
        delete right.fadeIn;
        if (c.fadeOut) right.fadeOut = Math.min(c.fadeOut, right.len);
        c.len = cut; delete c.fadeOut;
        if (c.fadeIn) c.fadeIn = Math.min(c.fadeIn, c.len);
        f.track.clips.push(right); f.track.clips.sort((a, b) => a.start - b.start);
        store.sel.clipId = right.id;
      });
      return right;
    },
    placeAudio(track, sampleId, start, len) {
      store.carve(track, start, len);
      const clip = { id: SDAW.uid('clp'), kind: 'audio', sampleId, start, len, gain: 1 };
      track.clips.push(clip); track.clips.sort((a, b) => a.start - b.start);
      return clip;
    },

    /**
     * Where a note written at an absolute tick goes:
     *   - inside an existing pattern clip -> that pattern
     *   - right after a pattern used once -> extend it by one bar
     *   - otherwise -> create a new 1-bar pattern clip
     * Returns { pattern, clip, local } or null (drum track)
     */
    editTarget(track, tick, create) {
      if (!track || track.type === 'drums') return null;
      let clip = this.clipAt(track, tick);
      if (clip && clip.kind === 'pattern') {
        const p = this.pattern(clip.patternId);
        if (p && p.kind === 'notes') return { pattern: p, clip, local: (tick - clip.start + (clip.offsetTicks || 0)) % p.length };
        return null;
      }
      if (!create) return null;
      const barStart = Math.floor(tick / BAR()) * BAR();
      const prev = track.clips.find(c => c.kind === 'pattern' && c.start + c.len === barStart);
      const pp = prev && this.pattern(prev.patternId);
      if (pp && pp.kind === 'notes' && pp.length === prev.len && this.patternUses(pp.id) === 1 && !this.clipAt(track, barStart)) {
        pp.length += BAR(); prev.len += BAR();
        return { pattern: pp, clip: prev, local: tick - prev.start };
      }
      const n = this.song.patterns.filter(p => p.name.startsWith(track.name)).length + 1;
      const p = SDAW.makePattern('notes', track.name + ' ' + n, BAR(), PATTERN_COLORS[this.song.patterns.length % PATTERN_COLORS.length]);
      this.song.patterns.push(p);
      clip = this.placePattern(track, p, barStart, BAR());
      this.sel.patternId = p.id;
      return { pattern: p, clip, local: tick - barStart };
    },

    /* ------------------------------------------------- note editing --- */

    /**
     * Insert a note on the selected track.
     *   opts.start      absolute tick (default: cursor)
     *   opts.pattern + opts.local   write directly into a pattern (piano roll)
     *   opts.chord      keep the cursor (build a chord)
     *   opts.string/fret explicit guitar position
     */
    insertNote(pitch, opts) {
      opts = opts || {};
      const t = this.selTrack();
      if (!opts.pattern && (!t || t.type === 'drums')) { SDAW.toast('Select a melodic track (guitar, bass, keys…) to write notes'); return null; }
      const abs = opts.start !== undefined ? opts.start : this.sel.cursor;
      const dur = opts.dur || this.curDur();
      const voice = opts.voice !== undefined ? opts.voice : this.sel.voice;
      let note = null;
      this.mutate('Insert note', () => {
        const tgt = opts.pattern ? { pattern: opts.pattern, local: opts.local } : this.editTarget(t, abs, true);
        if (!tgt) return;
        const p = tgt.pattern, local = tgt.local;
        p.notes = p.notes.filter(n => !(Math.abs(n.start - local) < 0.01 && n.pitch === pitch && (n.voice || 0) === voice));
        note = { id: SDAW.uid('n'), start: local, dur, pitch, vel: opts.vel || 100, tech: {} };
        if (voice) note.voice = voice;
        if (this.sel.tuplet && !opts.dur) note.tup = 3;
        const type = t ? t.type : 'keys';
        if (type === 'guitar' || type === 'bass') {
          if (opts.string !== undefined) { note.string = opts.string; note.fret = opts.fret; }
          else {
            const used = new Set(p.notes.filter(n => n.start === local).map(n => n.string));
            const pos = type === 'bass' ? SDAW.autoFretBass(pitch) : SDAW.autoFret(pitch, used, opts.nearFret);
            if (pos) { note.string = pos.string; note.fret = pos.fret; }
          }
        }
        p.notes.push(note);
        p.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
        if (!opts.pattern && !opts.chord && !opts.keepCursor) this.sel.cursor = Math.min(abs + dur, this.songTicks() - 1);
        this.sel.noteIds = [note.id];
        this.sel.patternId = p.id;
      });
      return note;
    },

    /** Insert a chord at the cursor: chord = { name, frets[6], pitches[] } */
    insertChord(chord, opts) {
      opts = opts || {};
      const t = this.selTrack();
      if (!t || t.type === 'drums') { SDAW.toast('Select a melodic track to insert chords'); return; }
      const abs = this.sel.cursor, dur = this.curDur();
      this.mutate('Insert chord ' + (chord.name || ''), () => {
        const tgt = this.editTarget(t, abs, true); if (!tgt) return;
        const p = tgt.pattern, local = tgt.local;
        p.notes = p.notes.filter(n => n.start !== local);
        const ids = [];
        if (t.type === 'guitar' && chord.frets) {
          chord.frets.forEach((f, s) => {
            if (f < 0) return;
            const n = { id: SDAW.uid('n'), start: local, dur, pitch: CONFIG.guitar.tuning[s] + f, vel: 96, string: s, fret: f, tech: {} };
            p.notes.push(n); ids.push(n.id);
          });
        } else {
          chord.pitches.forEach(pt => {
            const n = { id: SDAW.uid('n'), start: local, dur, pitch: pt, vel: 96, tech: {} };
            if (t.type === 'bass') { const pos = SDAW.autoFretBass(pt); if (pos) { n.string = pos.string; n.fret = pos.fret; } }
            p.notes.push(n); ids.push(n.id);
          });
        }
        p.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
        if (chord.name) {
          this.song.chords = this.song.chords.filter(c => c.tick !== abs);
          this.song.chords.push({ tick: abs, name: chord.name });
          this.song.chords.sort((a, b) => a.tick - b.tick);
        }
        this.sel.noteIds = ids;
        if (!opts.keepCursor) this.sel.cursor = Math.min(abs + dur, this.songTicks() - 1);
      });
    },

    deleteSelectedNotes() {
      if (!this.sel.noteIds.length) return;
      const ids = new Set(this.sel.noteIds);
      this.mutate('Delete notes', song => {
        song.patterns.forEach(p => { if (p.notes) p.notes = p.notes.filter(n => !ids.has(n.id)); });
        this.sel.noteIds = [];
      });
    },

    /**
     * Set / toggle a technique on the selected notes.
     *   setTechnique('h')            toggle hammer-on
     *   setTechnique('bend', 1)      bend up 1 tone ("full"); same value again = remove
     *   setTechnique('bendType', 'release')
     * Exclusive groups are cleaned (hammer vs pull, harmonic types, vibrato types…).
     */
    setTechnique(key, value) {
      const notes = this.selNotes();
      if (!notes.length) { SDAW.toast('Select a note first (click it, or drag a box around several notes)'); return; }
      const t = this.selTrack();
      const EXCL = { h: ['p', 'tap'], p: ['h', 'tap'], tap: ['h', 'p'], harm: ['pinch'], pinch: ['harm'], vib: ['wvib'], wvib: ['vib'], stacc: ['ring'], ring: ['stacc'] };
      this.mutate('Technique ' + key, () => {
        const wanted = value === undefined ? (key === 'bend' ? ((t && t.technique.bendRange) || 2) : true) : value;
        const allSame = notes.every(n => n.tech && n.tech[key] === wanted);
        notes.forEach(n => {
          n.tech = n.tech || {};
          if (allSame) { delete n.tech[key]; if (key === 'bend') delete n.tech.bendType; }
          else { n.tech[key] = wanted; (EXCL[key] || []).forEach(k => delete n.tech[k]); }
        });
      });
    },

    /** Toggle a note property that is not a technique (tie, tuplet, voice…) */
    setNoteProp(key, value) {
      const notes = this.selNotes();
      if (!notes.length) { SDAW.toast('Select notes first'); return; }
      this.mutate('Note ' + key, () => {
        const all = notes.every(n => n[key] === value);
        notes.forEach(n => {
          if (key === 'tup') {          // triplet on / off changes the real duration (the next notes follow)
            if (all) { this.rippleDurations(new Map([[n, n.dur * 1.5]])); delete n.tup; } else if (!n.tup) { this.rippleDurations(new Map([[n, n.dur * 2 / 3]])); n.tup = 3; }
          } else if (all) delete n[key]; else n[key] = value;
        });
      });
    },

    /* --------------------------------------------- pattern commands --- */
    newPattern(kind, name, length) {
      const p = SDAW.makePattern(kind, name, length, PATTERN_COLORS[this.song.patterns.length % PATTERN_COLORS.length]);
      this.mutate('New pattern', song => { song.patterns.push(p); });
      this.selectPattern(p.id);
      return p;
    },
    clonePattern(p) {
      const c = SDAW.deepCopy(p); c.id = SDAW.uid('pat'); c.name = p.name + ' (copy)';
      (c.notes || []).forEach(n => { n.id = SDAW.uid('n'); });
      this.song.patterns.push(c);
      return c;
    },
    /** Give a clip its own copy of the pattern so it can be edited alone */
    makeUnique(clipId) {
      const f = this.findClip(clipId); if (!f || f.clip.kind !== 'pattern') return;
      const p = this.pattern(f.clip.patternId);
      this.mutate('Make unique', () => { const c = this.clonePattern(p); f.clip.patternId = c.id; this.sel.patternId = c.id; });
      SDAW.toast('This block now has its own pattern');
    },
    deletePattern(pid) {
      this.mutate('Delete pattern', song => {
        song.patterns = song.patterns.filter(p => p.id !== pid);
        song.tracks.forEach(t => { t.clips = t.clips.filter(c => c.patternId !== pid); });
        if (this.sel.patternId === pid) this.sel.patternId = song.patterns[0] ? song.patterns[0].id : null;
      });
    },
    deleteClip(clipId) {
      this.mutate('Delete block', song => song.tracks.forEach(t => { t.clips = t.clips.filter(c => c.id !== clipId); }));
      if (this.sel.clipId === clipId) this.sel.clipId = null;
    },
    duplicateClip(clipId) {
      const f = this.findClip(clipId); if (!f) return;
      this.mutate('Duplicate block', () => {
        const c = Object.assign({}, f.clip, { id: SDAW.uid('clp'), start: f.clip.start + f.clip.len });
        store.carve(f.track, c.start, c.len);
        f.track.clips.push(c); f.track.clips.sort((a, b) => a.start - b.start);
        this.sel.clipId = c.id;
      });
    }
  };
  SDAW.store = store;

  /* ========================================================= MIGRATION == *
   *  v1 songs (notes directly on tracks) are converted to patterns + clips.  */
  /** what is wrong with a project file (null = it can be opened) */
  SDAW.PROJECT_VERSION = 2;
  SDAW.validateProject = function (song) {
    if (!song || typeof song !== 'object' || Array.isArray(song)) return 'this is not a ScoreDAW project';
    if (!Array.isArray(song.tracks)) return 'this is not a ScoreDAW project (no tracks)';
    if (song.version !== undefined && !(typeof song.version === 'number' && isFinite(song.version))) return 'the project version is not readable';
    if (song.version > SDAW.PROJECT_VERSION) return 'the project was saved by a newer ScoreDAW (format ' + song.version + ') — update ScoreDAW to open it';
    if (song.version >= 2 && !Array.isArray(song.patterns)) return 'the project is damaged (no patterns)';
    for (const t of song.tracks) {
      if (!t || typeof t !== 'object' || !t.id) return 'the project is damaged (a track without id)';
      if (t.clips !== undefined && !Array.isArray(t.clips)) return 'the project is damaged (track "' + (t.name || t.id) + '")';
    }
    if (song.embeddedSamples !== undefined && !Array.isArray(song.embeddedSamples)) return 'the embedded samples are damaged';
    return null;
  };
  SDAW.migrateSong = function (song) {
    if (song.version >= 2 && song.patterns) {
      song.samples = song.samples || [];
      song.tracks.forEach(t => { t.clips = t.clips || []; t.drumMap = t.drumMap || {}; if (t.sampler === undefined) t.sampler = null; t.fx = SDAW.normalizePedals(t.fx); });
      song.patterns.forEach(SDAW.normalizeDrumPattern);
      song.barMarks = song.barMarks || {};
      SDAW.fixSongStrings(song);            // chords whose notes shared a string (older generator versions)
      return song;
    }
    song.version = 2; song.patterns = []; song.samples = [];
    song.tracks.forEach(t => {
      t.clips = []; t.drumMap = {}; t.sampler = null;
      if (t.type === 'drums' && t.drum) {
        const p = SDAW.makePattern('drums', t.name + ' Beat', BAR4, '#7cff4f');
        SDAW.DRUM_ROWS.forEach(r => { p.drum.rows[r.id] = (t.drum.rows[r.id] || []).slice(0, BAR4).concat(new Array(BAR4).fill(0)).slice(0, BAR4); });
        song.patterns.push(p);
        let runStart = null;
        for (let b = 0; b <= song.bars; b++) {
          const on = b < song.bars && t.drum.bars[b] !== false;
          if (on && runStart === null) runStart = b;
          if (!on && runStart !== null) { t.clips.push({ id: SDAW.uid('clp'), kind: 'pattern', patternId: p.id, start: runStart * BAR4, len: (b - runStart) * BAR4 }); runStart = null; }
        }
      } else if (t.notes && t.notes.length) {
        const first = Math.floor(t.notes[0].start / BAR4) * BAR4;
        const last = Math.max(...t.notes.map(n => n.start + n.dur));
        const len = Math.ceil((last - first) / BAR4) * BAR4;
        const p = SDAW.makePattern('notes', t.name, len, t.color);
        p.notes = t.notes.map(n => Object.assign({}, n, { start: n.start - first }));
        song.patterns.push(p);
        t.clips.push({ id: SDAW.uid('clp'), kind: 'pattern', patternId: p.id, start: first, len });
      }
      delete t.notes; delete t.drum;
      t.fx = SDAW.normalizePedals(t.fx);
    });
    return song;
  };

  /* ======================================================= GENERATORS == *
   * 16 steps = one bar. x = hit, o = accent, - = ghost, . = rest           */
  const P = s => s.split('').map(c => c === 'o' ? 1 : c === 'x' ? 0.75 : c === '-' ? 0.45 : 0);

  SDAW.RHYTHMS = {
    'Pop':       { kick: 'o.......o.x.....', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
    'Rock':      { kick: 'o.....x.o.......', snare: '....o.......o...', hhc: 'o.x.o.x.o.x.o.x.', hho: '..............x.' },
    'Salsa':     { kick: '...x.......x....', perc: 'o.x.o.xxo.x.o.xx', clap: '..x....x..x.....', tom2: '......xx......xx', hhc: '-.-.-.-.-.-.-.-.' },
    'Merengue':  { kick: 'o...o...o...o...', snare: '..x...x...x...xx', hhc: 'xxxxxxxxxxxxxxxx', perc: 'o.x.o.x.o.x.o.x.' },
    'Bachata':   { kick: 'o...........o...', perc: 'x.x.x.xxx.x.x.xx', tom1: '......x.......x.', tom2: 'x.......x.......', hhc: '-.-.-.-.-.-.-.-.' },
    'Reggaeton': { kick: 'o...o...o...o...', snare: '...x..x....x..x.', hhc: 'x.x.x.x.x.x.x.x.' },
    'Bolero':    { kick: 'o.......o.......', perc: 'x..xx.x.x..xx.x.', tom2: '......x.......x.', hhc: '-.-.-.-.-.-.-.-.' },
    'Blues':     { kick: 'o.....x.o.....x.', snare: '....o.......o...', hhc: 'x..xx..xx..xx..x' },
    'Funk':      { kick: 'o..x..x...o..x..', snare: '....o..-.-..o..-', hhc: 'xxxxxxxxxxxxxxxx', hho: '.......x.......x' },
    'Ballad':    { kick: 'o.........x.....', snare: '........o.......', hhc: 'x...x...x...x...' }
  };
  /** Fills: last bar variation (snare / tom roll + crash feel on the open hat) */
  const FILL = { snare: '....o...x.x.xxoo', tom1: '........o.o.....', tom2: '............o.o.', kick: 'o.......o.......', hho: '...............o' };

  SDAW.PROGRESSIONS = {
    'Pop':       { mode: 'major', degrees: [1, 5, 6, 4] },
    'Rock':      { mode: 'major', degrees: [1, 4, 5, 4] },
    'Salsa':     { mode: 'major', degrees: [1, 4, 5, 4] },
    'Merengue':  { mode: 'major', degrees: [1, 1, 5, 5] },
    'Bachata':   { mode: 'minor', degrees: [1, 4, 5, 1] },
    'Reggaeton': { mode: 'minor', degrees: [1, 6, 3, 7] },
    'Bolero':    { mode: 'major', degrees: [1, 6, 2, 5] },
    'Blues':     { mode: 'major', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
    'Funk':      { mode: 'minor', degrees: [1, 1, 4, 1] },
    'Ballad':    { mode: 'major', degrees: [1, 6, 4, 5] }
  };
  SDAW.COMPING = {
    'Pop': [[0, 6], [6, 4], [10, 6]], 'Rock': [[0, 4], [4, 4], [8, 4], [12, 4]], 'Salsa': [[2, 2], [6, 2], [8, 2], [12, 2], [14, 2]],
    'Merengue': [[0, 2], [4, 2], [8, 2], [12, 2]], 'Bachata': [[0, 3], [4, 2], [8, 3], [12, 2]], 'Reggaeton': [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
    'Bolero': [[0, 4], [6, 2], [8, 4], [12, 4]], 'Blues': [[0, 3], [3, 1], [8, 3], [11, 1]], 'Funk': [[0, 1], [3, 1], [6, 1], [10, 1], [12, 2]], 'Ballad': [[0, 16]]
  };
  SDAW.BASSLINES = {
    'Pop': [[0, 4, 0], [6, 2, 0], [8, 4, 0], [12, 4, 7]], 'Rock': [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 0], [14, 2, 0]],
    'Salsa': [[6, 4, 0], [10, 2, 7], [14, 2, 7]], 'Merengue': [[0, 4, 0], [4, 4, 7], [8, 4, 0], [12, 4, 7]], 'Bachata': [[0, 4, 0], [4, 2, 7], [8, 4, 12], [12, 2, 7]],
    'Reggaeton': [[0, 3, 0], [3, 3, 0], [8, 3, 0], [11, 3, 7]], 'Bolero': [[0, 6, 0], [8, 6, 7]],
    'Blues': [[0, 3, 0], [3, 1, 4], [4, 3, 7], [7, 1, 9], [8, 3, 10], [11, 1, 9], [12, 3, 7], [15, 1, 4]],
    'Funk': [[0, 1, 0], [3, 1, 12], [6, 1, 0], [8, 1, 10], [10, 1, 0], [14, 1, 7]], 'Ballad': [[0, 8, 0], [8, 8, 7]]
  };
  SDAW.GENRE_TEMPO = { Pop: 110, Rock: 120, Salsa: 180, Merengue: 150, Bachata: 125, Reggaeton: 92, Bolero: 80, Blues: 90, Funk: 104, Ballad: 72 };
  SDAW.isLatin = g => ['Salsa', 'Merengue', 'Bachata', 'Bolero'].includes(g);

  /** Drum pattern (1 bar) for a genre */
  SDAW.rhythmPattern = function (genre, fill) {
    const r = Object.assign({}, SDAW.RHYTHMS[genre] || SDAW.RHYTHMS.Pop);
    if (fill) Object.assign(r, FILL);
    const p = SDAW.makePattern('drums', genre + (fill ? ' Fill' : ' Groove'), BAR4, fill ? '#ff9f2e' : '#7cff4f');
    SDAW.DRUM_ROWS.forEach(row => { if (r[row.id]) p.drum.rows[row.id] = P(r[row.id]); });
    return p;
  };
  /** Overwrite the rows of an existing drum pattern with a genre groove */
  SDAW.applyRhythm = function (p, genre) {
    const r = SDAW.RHYTHMS[genre] || SDAW.RHYTHMS.Pop;
    SDAW.DRUM_ROWS.forEach(row => {
      const one = r[row.id] ? P(r[row.id]) : new Array(BAR4).fill(0);
      p.drum.rows[row.id] = new Array(p.length).fill(0).map((_, i) => one[i % BAR4]);
    });
  };

  /**
   * Accompaniment patterns for a progression (one cycle of the progression).
   * Returns { bars, chords:[{tick,name}], keys, bass, guitar }  (patterns, local ticks)
   */
  SDAW.progressionPatterns = function (song, genre) {
    const prog = SDAW.PROGRESSIONS[genre] || SDAW.PROGRESSIONS.Pop;
    const mode = prog.mode;
    const bars = prog.degrees.length, len = bars * BAR4;
    const keys = SDAW.makePattern('notes', genre + ' Chords (Keys)', len, '#ffd23f');
    const bass = SDAW.makePattern('notes', genre + ' Bass', len, '#3fa9ff');
    const guitar = SDAW.makePattern('notes', genre + ' Strum (Guitar)', len, '#ff4fd8');
    const chords = [];
    for (let b = 0; b < bars; b++) {
      const ch = SDAW.diatonicChord(song.key, mode, prog.degrees[b]);
      const bt = b * BAR4;
      chords.push({ tick: bt, name: ch.name });
      const kb = 48 + ch.root + (ch.root > 7 ? -12 : 0);
      (SDAW.COMPING[genre] || SDAW.COMPING.Pop).forEach(([st, l]) => ch.intervals.slice(0, 4).forEach((iv, k) => {
        keys.notes.push({ id: SDAW.uid('n'), start: bt + st, dur: l, pitch: kb + 12 + iv, vel: k === 0 ? 92 : 80, tech: {} });
      }));
      let root = 24 + ch.root; if (root < 28) root += 12;
      (SDAW.BASSLINES[genre] || SDAW.BASSLINES.Pop).forEach(([st, l, iv]) => {
        const n = { id: SDAW.uid('n'), start: bt + st, dur: l, pitch: root + iv, vel: 100, tech: {} };
        const pos = SDAW.autoFretBass(n.pitch); if (pos) { n.string = pos.string; n.fret = pos.fret; }
        bass.notes.push(n);
      });
      const frets = SDAW.chordVoicing(ch.root, ch.intervals);
      [[0, 6, 'down'], [8, 4, 'down'], [12, 4, 'up']].forEach(([st, l, dir]) => frets.forEach((f, s) => {
        if (f < 0) return;
        guitar.notes.push({ id: SDAW.uid('n'), start: bt + st, dur: l, pitch: CONFIG.guitar.tuning[s] + f, vel: 88, string: s, fret: f, tech: { strum: dir } });
      }));
    }
    [keys, bass, guitar].forEach(p => p.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch));
    return { bars, len, chords, keys, bass, guitar };
  };

  /** Add chord symbols for a clip of a progression placed at `start` */
  SDAW.addChordSymbols = function (song, chords, start, len, cycle) {
    for (let off = 0; off < len; off += cycle) chords.forEach(c => {
      const t = start + off + c.tick; if (t >= start + len) return;
      song.chords = song.chords.filter(x => x.tick !== t);
      song.chords.push({ tick: t, name: c.name });
    });
    song.chords.sort((a, b) => a.tick - b.tick);
  };

  SDAW.BASS_TUNING = [28, 33, 38, 43];
  SDAW.autoFretBass = function (pitch, avoidStrings) {
    let best = null;
    SDAW.BASS_TUNING.forEach((open, s) => { if (avoidStrings && avoidStrings.has(s)) return; const f = pitch - open; if (f >= 0 && f <= 20 && (!best || f < best.fret)) best = { string: s, fret: f }; });
    return best;
  };

  /**
   * One string can only play one note at a time. Notes that START TOGETHER (a chord, a
   * harmonized melody, octaves) must be on different strings, or the tab draws them on top
   * of each other and the realistic guitar plays only one of them.
   * Gives every note without a position a string / fret, and moves the notes that share a
   * string with another note of the same chord to a free string near the hand position.
   * type 'guitar' | 'bass'. Returns how many notes were moved / assigned. Mutates the notes.
   */
  SDAW.fixStrings = function (notes, type) {
    if (!notes || !notes.length || (type !== 'guitar' && type !== 'bass')) return 0;
    const bass = type === 'bass', nStr = bass ? SDAW.BASS_TUNING.length : CONFIG.guitar.tuning.length;
    const open = bass ? SDAW.BASS_TUNING : CONFIG.guitar.tuning;
    const pos = (pitch, used, near) => bass ? SDAW.autoFretBass(pitch, used) : SDAW.autoFret(pitch, used, near);
    const groups = new Map();
    notes.forEach(n => { const k = Math.round(n.start * 24); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
    let changed = 0, hand = 5;
    [...groups.values()].sort((a, b) => a[0].start - b[0].start).forEach(g => {
      const valid = n => n.string >= 0 && n.string < nStr && n.pitch - open[n.string] === n.fret && n.fret >= 0;
      const used = new Set(), keep = [], redo = [];
      // keep the notes that already have their own string (highest notes first: the melody stays where it is)
      g.slice().sort((a, b) => b.pitch - a.pitch).forEach(n => { if (valid(n) && !used.has(n.string)) { used.add(n.string); keep.push(n); } else redo.push(n); });
      if (keep.length) hand = Math.round(keep.reduce((s, n) => s + n.fret, 0) / keep.length);
      redo.forEach(n => {
        const p = pos(n.pitch, used, hand) || (valid(n) ? null : pos(n.pitch, null, hand));
        if (p) { if (p.string !== n.string || p.fret !== n.fret) changed++; n.string = p.string; n.fret = p.fret; used.add(p.string); }
      });
    });
    return changed;
  };
  /** fixStrings on every pattern played by guitar / bass tracks of a song */
  SDAW.fixSongStrings = function (song) {
    const pats = {}; (song.patterns || []).forEach(p => { pats[p.id] = p; });
    let n = 0;
    (song.tracks || []).forEach(t => {
      if (t.type !== 'guitar' && t.type !== 'bass') return;
      const seen = new Set();
      (t.clips || []).forEach(c => { const p = pats[c.patternId]; if (p && p.notes && !seen.has(p.id)) { seen.add(p.id); n += SDAW.fixStrings(p.notes, t.type); } });
    });
    return n;
  };

  /** Demo lead melody (4 bars) with guitar techniques */
  SDAW.melodyPattern = function (song) {
    const p = SDAW.makePattern('notes', 'Lead Riff', 4 * BAR4, '#ff6b6b');
    const keyRoot = SDAW.noteIndex(song.key);
    const scale = song.scale === 'minor' ? SDAW.SCALES['Natural Minor'] : SDAW.SCALES.Major;
    const deg = (d) => 60 + keyRoot + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const phrase = [
      [0, 2, 4], [0.5, 2, 5, 'h'], [1, 2, 4, 'p'], [1.5, 2, 2], [2, 4, 0], [3, 2, 1], [3.5, 2, 2],
      [4, 6, 4, 'slide'], [5.5, 2, 5], [6, 8, 7, 'bend'],
      [8, 2, 7], [8.5, 2, 6], [9, 2, 5], [9.5, 2, 4], [10, 4, 5, 'h'], [11, 4, 4],
      [12, 2, 2], [12.5, 2, 4], [13, 2, 5], [13.5, 2, 4], [14, 8, 2, 'vib']
    ];
    phrase.forEach(([beat, dur, d, tech]) => {
      const pitch = deg(d);
      const n = { id: SDAW.uid('n'), start: Math.round(beat * 4), dur, pitch, vel: 100, tech: {} };
      const pos = SDAW.autoFret(pitch, null, 7); if (pos) { n.string = pos.string; n.fret = pos.fret; }
      if (tech === 'bend') n.tech.bend = 2; else if (tech) n.tech[tech] = true;
      p.notes.push(n);
    });
    return p;
  };

  /* ===================================================== SONG BUILDER == *
   * A complete song made of reusable patterns placed per section:
   *   drums: groove clips + a fill block at the end of every section
   *   keys / bass / guitar: progression patterns (linked copies)
   *   lead: one riff pattern used in Verse and last Chorus (linked)        */
  SDAW.buildSong = function (genre) {
    const song = store.newSong();
    const prog = SDAW.PROGRESSIONS[genre] || SDAW.PROGRESSIONS.Pop;
    song.title = genre + ' Song';
    song.scale = prog.mode; song.key = prog.mode === 'minor' ? 'A' : 'C';
    song.tempo = SDAW.GENRE_TEMPO[genre] || 110;
    const secs = [['Intro', 4], ['Verse', 8], ['Chorus', 8], ['Bridge', 4], ['Chorus', 8]];
    let b = 0;
    song.sections = secs.map(([name, len], i) => { const s = { id: SDAW.uid('s'), name, start: b, length: len, color: ['#9b5cff', '#3fa9ff', '#2bdc7a', '#ffb02e', '#2bdc7a'][i] }; b += len; return s; });
    song.bars = b;

    const guitar = SDAW.makeTrack(SDAW.findInstrument('Acoustic Guitar - Steel'), 'Acoustic Guitar');
    const lead = SDAW.makeTrack(SDAW.findInstrument('Electric Guitar - Lead'), 'Electric Lead');
    const bass = SDAW.makeTrack(SDAW.findInstrument('Electric Bass - Finger'), 'Bass');
    const drums = SDAW.makeTrack(SDAW.findInstrument(SDAW.isLatin(genre) ? 'Latin Percussion Kit' : 'Studio Kit'), 'Drums');
    const keys = SDAW.makeTrack(SDAW.findInstrument('Grand Piano'), 'Piano');
    keys.vol = 0.6; bass.vol = 0.85; guitar.vol = 0.7;

    const groove = SDAW.rhythmPattern(genre), fill = SDAW.rhythmPattern(genre, true);
    const pp = SDAW.progressionPatterns(song, genre);
    const riff = SDAW.melodyPattern(song);
    song.patterns.push(groove, fill, pp.keys, pp.bass, pp.guitar, riff);

    song.sections.forEach(sec => {
      const s = sec.start * BAR4, L = sec.length * BAR4;
      store.placePattern.call({ song }, drums, groove, s, L - BAR4);
      store.placePattern.call({ song }, drums, fill, s + L - BAR4, BAR4);
      store.placePattern.call({ song }, keys, pp.keys, s, L);
      SDAW.addChordSymbols(song, pp.chords, s, L, pp.len);
      if (sec.name !== 'Intro') { store.placePattern.call({ song }, bass, pp.bass, s, L); store.placePattern.call({ song }, guitar, pp.guitar, s, L); }
    });
    const verse = song.sections[1], last = song.sections[4];
    store.placePattern.call({ song }, lead, riff, verse.start * BAR4, riff.length);
    store.placePattern.call({ song }, lead, riff, last.start * BAR4 + riff.length, riff.length);
    song.tracks = [guitar, lead, bass, drums, keys];
    return song;
  };

  /** Empty project: one guitar track, no content */
  SDAW.insertBarsRaw = function (song, atBar, n) {
    const B = SDAW.barTicks(song), at = atBar * B, d = n * B;
    song.tracks.forEach(t => {
      const add = [];
      t.clips.forEach(c => {
        if (c.start >= at) c.start += d;
        else if (c.start + c.len > at) {                 // crosses the point: split, move the right half
          const cut = at - c.start;
          const r = Object.assign({}, c, { id: SDAW.uid('clp'), start: at + d, len: c.len - cut, offsetTicks: (c.offsetTicks || 0) + cut });
          delete r.fadeIn; c.len = cut; delete c.fadeOut;
          add.push(r);
        }
      });
      t.clips.push(...add); t.clips.sort((a, b) => a.start - b.start);
      if (t.auto) Object.keys(t.auto).forEach(k => t.auto[k].forEach(p => { if (p.t >= at) p.t += d; }));
    });
    (song.chords || []).forEach(c => { if (c.tick >= at) c.tick += d; });
    (song.sections || []).forEach(sc => { if (sc.start >= atBar) sc.start += n; else if (sc.start + sc.length > atBar) sc.length += n; });
    const marks = {};
    Object.keys(song.barMarks || {}).forEach(k => { marks[+k >= atBar ? +k + n : +k] = song.barMarks[k]; });
    song.barMarks = marks;
    song.bars += n;
  };

  /** Empty song. kind 'guitar' = the "Write for guitar" start (one guitar track); otherwise a Grand Piano track */
  SDAW.emptySong = function (timeSig, kind) {
    const song = store.newSong();
    if (timeSig) song.timeSig = timeSig.slice();
    song.sections = [{ id: SDAW.uid('s'), name: 'Verse', start: 0, length: 8, color: '#3fa9ff' }];
    // new songs start with the realistic Grand Piano (Piano Rig)
    // "Write for guitar": the real steel-string guitar of the Guitar Rig (the light guitar when the browser cannot run it)
    const gtr = SDAW.guitarRig && SDAW.guitarRig.ok() ? 'Real Acoustic Guitar (Steel)' : 'Acoustic Guitar - Steel';
    song.tracks = [kind === 'guitar' ? SDAW.makeTrack(SDAW.findInstrument(gtr), 'Guitar') : SDAW.makeTrack(SDAW.findInstrument('Grand Piano'), 'Piano')];
    return song;
  };
  /** Beat project: a drum track with one groove block */
  SDAW.beatSong = function (genre) {
    const song = store.newSong();
    song.tempo = SDAW.GENRE_TEMPO[genre] || 110;
    const d = SDAW.makeTrack(SDAW.findInstrument(SDAW.isLatin(genre) ? 'Latin Percussion Kit' : 'Studio Kit'), 'Drums');
    const p = SDAW.rhythmPattern(genre);
    song.patterns.push(p);
    store.placePattern(d, p, 0, 4 * BAR4);
    song.tracks = [d];
    song.sections = [{ id: SDAW.uid('s'), name: 'Beat', start: 0, length: 4, color: '#7cff4f' }];
    return song;
  };

})(window.SDAW);
