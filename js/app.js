/* =============================================================================
 *  APP.JS — application bootstrap and glue
 *  -----------------------------------------------------------------------------
 *  - UI scaling (CONFIG.ui: fit to window or manual, Ctrl +/-/0)
 *  - Menus, file (new / open / save / autosave), undo / redo
 *  - Transport (play, stop, record, loop, metronome) + LCD
 *  - Tempo / key / scale controls
 *  - Editor view switching (F2..F7) and per-view toolbars
 *  - Keyboard shortcuts with focus zones (notation typing vs PC piano)
 *  - Contextual help bar, welcome screen, help window, dialogs, toast
 *  - Animation loop (playhead, meters, fretboard highlights)
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, $$, el } = SDAW;

  const app = {
    scale: 1,
    view: 'scoretab',
    recording: false,
    focusZone: 'other',     // 'notation' | 'pianoroll' | 'input' | 'other'
    mode: CONFIG.ui.startMode
  };
  SDAW.app = app;

  /* ================================================== UI SCALING ===== */
  app.applyScale = function () {
    const U = CONFIG.ui;
    const vw = window.innerWidth, vh = window.innerHeight;
    let sc = U.scaleMode === 'fit' ? Math.min(vw / U.designWidth, vh / U.designHeight) : U.manualScale;
    sc = SDAW.clamp(sc, U.minScale, U.maxScale);
    app.scale = sc;
    const appEl = $('#app');
    // the app fills the window: its logical size = window / scale
    appEl.style.width = (vw / sc) + 'px';
    appEl.style.height = (vh / sc) + 'px';
    appEl.style.transform = `scale(${sc})`;
    $('#scaleLabel').textContent = U.scaleMode === 'fit' ? 'Auto' : Math.round(sc * 100) + '%';
    $('#statusRate').textContent = 'UI ' + Math.round(sc * 100) + '%  ·  ' + vw + '×' + vh;
    SDAW.bus.emit('layout');
  };
  app.changeScale = function (dir) {
    const U = CONFIG.ui;
    if (dir === 0) { U.scaleMode = 'fit'; }
    else { U.manualScale = SDAW.clamp((U.scaleMode === 'fit' ? app.scale : U.manualScale) + dir * U.scaleStep, U.minScale, U.maxScale); U.scaleMode = 'manual'; }
    localStorage.setItem('scoredaw.scale', JSON.stringify({ mode: U.scaleMode, value: U.manualScale }));
    app.applyScale();
  };

  /* ======================================================== MODES ===== */
  app.setMode = function (mode) {
    app.mode = mode;
    document.body.classList.toggle('mode-simple', mode === 'simple');
    document.body.classList.toggle('mode-pro', mode === 'pro');
    $('#btnSimple').classList.toggle('active', mode === 'simple');
    $('#btnPro').classList.toggle('active', mode === 'pro');
    localStorage.setItem('scoredaw.mode', mode);
    SDAW.bus.emit('layout');
  };

  /* ======================================================== VIEWS ===== */
  app.showView = function (v) {
    app.view = v;
    $$('#editorTabs .tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('#editorBody .view').forEach(n => n.classList.remove('active'));
    const id = (v === 'score' || v === 'tab' || v === 'scoretab') ? 'view-notation' : 'view-' + v;
    $('#' + id).classList.add('active');
    if (id === 'view-notation') SDAW.notation.mode = v;
    app.renderEditor();
  };

  /* ============================================ EDITOR MINI TRANSPORT === *
   *  ⏮ ▶ ■ inside the editor toolbar: plays ONLY the current pattern in a
   *  loop (to try it before / without playing the song). Shift+Space too.  */

  /** Pattern shown by the current editor view */
  app.viewPattern = function () {
    const s = SDAW.store, v = app.view;
    if (v === 'pattern') return SDAW.pattern.current();
    if (v === 'pianoroll') return SDAW.pianoroll.current();
    if (['score', 'tab', 'scoretab'].includes(v)) {
      const t = s.selTrack(), c = s.clipAt(t, s.sel.cursor);
      if (c && c.kind === 'pattern') return s.pattern(c.patternId);
      return SDAW.pianoroll.current();
    }
    return null;
  };
  app.patPreview = false;       // true while the editor transport is playing
  let songTickBeforePreview = 0;
  app.previewOffset = 0;        // song position of the previewed block (for the score playhead)

  app.playViewPattern = function (fromStart) {
    const A = SDAW.audio, s = SDAW.store;
    if (A.playing && app.patPreview && !fromStart) { app.stopViewPattern(); return; }
    const p = app.viewPattern();
    if (!p) return SDAW.toast('No pattern here yet — write some notes or create a pattern first');
    if (!app.patPreview) songTickBeforePreview = A.getTick();
    if (A.playing || A.preparing) A.stop();
    s.sel.patternId = p.id;
    const t = s.selTrack(), c = t && t.clips.find(x => x.patternId === p.id && s.sel.cursor >= x.start && s.sel.cursor < x.start + x.len) || (t && t.clips.find(x => x.patternId === p.id));
    app.previewOffset = c ? c.start : 0;
    app.patPreview = true;
    A.patternMode = true;
    A.stopTick = 0;
    A.play(0);
    app.syncTransport(); syncMini();
  };
  app.stopViewPattern = function () {
    const A = SDAW.audio;
    if (A.playing || A.preparing) A.stop();
    if (app.patPreview) { app.patPreview = false; A.patternMode = false; A.stopTick = songTickBeforePreview; }
    app.syncTransport(); syncMini();
  };
  app.rewindViewPattern = function () {
    if (SDAW.audio.playing && app.patPreview) app.playViewPattern(true);
    else SDAW.toast('Back to the start of the pattern');
  };

  function miniTransport() {
    const p = app.viewPattern();
    const playing = SDAW.audio.playing && app.patPreview;
    return el('div', { class: 'mini-transport', 'data-help': 'Plays ONLY this pattern in a loop, to try it before adding it to the song (Shift+Space). The big Play button at the top plays the whole song.' }, [
      el('button', { class: 'mt-btn', 'data-help': 'Back to the start of the pattern', onclick: () => app.rewindViewPattern() }, '⏮'),
      el('button', { class: 'mt-btn play' + (playing ? ' playing' : ''), id: 'mtPlay', 'data-help': 'Play / pause this pattern only (Shift+Space)', onclick: () => app.playViewPattern() }, playing ? '❚❚' : '▶'),
      el('button', { class: 'mt-btn', 'data-help': 'Stop the pattern', onclick: () => app.stopViewPattern() }, '■'),
      el('span', { class: 'mt-label' }, p ? '⟳ ' + p.name : 'no pattern')
    ]);
  }
  function syncMini() {
    const b = $('#mtPlay'); if (!b) return;
    const playing = SDAW.audio.playing && app.patPreview;
    b.textContent = playing ? '❚❚' : '▶';
    b.classList.toggle('playing', playing);
  }

  app.renderEditor = function () {
    const v = app.view;
    const tools = $('#editorTools');
    tools.innerHTML = '';
    if (v !== 'mixer' && v !== 'instrument') $('#editorMini').replaceChildren(miniTransport()); else $('#editorMini').replaceChildren();
    if (v === 'pattern') { SDAW.pattern.render(); SDAW.pattern.tools(tools); }
    else if (v === 'pianoroll') { SDAW.pianoroll.render(); SDAW.pianoroll.tools(tools); }
    else if (v === 'mixer') { SDAW.mixer.render(); SDAW.mixer.tools(tools); }
    else if (v === 'instrument') { SDAW.instrumentView.render(); SDAW.instrumentView.tools(tools); }
    else { SDAW.notation.render(); SDAW.notation.tools(tools); }
  };

  /* ==================================================== TRANSPORT ===== */
  app.togglePlay = function () {
    if (app.patPreview) app.stopViewPattern();
    if (SDAW.audio.playing || SDAW.audio.preparing) app.pause();
    else SDAW.audio.play(Math.floor(SDAW.audio.stopTick || 0));
  };
  app.pause = function () {
    if (app.patPreview) app.stopViewPattern();
    else if (SDAW.audio.playing || SDAW.audio.preparing) SDAW.audio.stop();
  };
  app.stop = function () {
    if (app.patPreview) { app.stopViewPattern(); return; }
    if (SDAW.audio.playing || SDAW.audio.preparing) SDAW.audio.stop();
    SDAW.audio.stopTick = 0;
    app.recording = false;
    app.syncTransport();
    SDAW.bus.emit('transport', { playing: false });
  };
  app.toggleRecord = async function () {
    app.recording = !app.recording;
    const armed = SDAW.recorder.armedTrack();
    if (app.recording && armed) {
      // audio take: open the input first, then roll the transport
      const ok = await SDAW.recorder.start();
      if (!ok) { app.recording = false; app.syncTransport(); return; }
      if (!SDAW.audio.playing) app.togglePlay();
      app.syncTransport();
      SDAW.toast('🎙 Recording audio on "' + armed.name + '" — press R or Stop to finish');
      return;
    }
    if (!app.recording && SDAW.recorder.take) await SDAW.recorder.stop();
    if (app.recording && !SDAW.audio.playing) app.togglePlay();
    app.syncTransport();
    SDAW.toast(app.recording ? 'Recording on the selected track — play the PC keys, piano, fretboard or MIDI keyboard' : 'Recording stopped');
  };
  app.toggleLoop = function () {
    SDAW.audio.loop = { on: !SDAW.audio.loop.on, start: 0, end: null };
    app.syncTransport();
    SDAW.arrange.render();
  };
  app.syncTransport = function () {
    $('#btnPlay').classList.toggle('playing', SDAW.audio.playing);
    $('#btnPlay').textContent = SDAW.audio.playing ? '❚❚' : '▶';
    $('#btnPause').disabled = !(SDAW.audio.playing || SDAW.audio.preparing);
    $('#btnRec').classList.toggle('on', app.recording);
    $('#btnRec').classList.toggle('audio', !!SDAW.recorder.take);
    $('#btnLoop').classList.toggle('on', SDAW.audio.loop.on);
    $('#btnLoop').setAttribute('aria-pressed', String(SDAW.audio.loop.on));
    $('#btnMetronome').classList.toggle('on', CONFIG.audio.metronome);
    const pm = $('#btnPatMode');
    pm.textContent = SDAW.audio.patternMode ? 'PAT' : 'SONG';
    pm.classList.toggle('pat', SDAW.audio.patternMode);
  };
  app.togglePatternMode = function () {
    SDAW.audio.setPatternMode(!SDAW.audio.patternMode);
    app.syncTransport();
    const p = SDAW.store.selPattern();
    SDAW.toast(SDAW.audio.patternMode ? 'PATTERN mode: looping "' + (p ? p.name : '—') + '"' : 'SONG mode: playing the whole arrangement');
  };

  function updateLcd(tick) {
    const song = SDAW.store.song;
    const sec = tick * 60 / song.tempo / CONFIG.grid.ticksPerBeat;
    $('#lcdTime').textContent = SDAW.formatTime(sec);
    const t = Math.floor(tick);
    $('#lcdBars').textContent = 'Bar ' + SDAW.posText(t);
  }

  /* ================================================= SONG PARAMS ===== */
  function bindParams() {
    const keySel = $('#inKey');
    SDAW.NOTE_NAMES.forEach(n => keySel.appendChild(el('option', { value: n }, n)));
    $('#inTempo').addEventListener('change', e => {
      const v = SDAW.clamp(+e.target.value || 120, CONFIG.transport.minTempo, CONFIG.transport.maxTempo);
      e.target.value = v;
      const was = SDAW.audio.playing, at = SDAW.audio.getTick();
      if (was) SDAW.audio.stop();
      SDAW.store.mutate('Tempo', song => { song.tempo = v; });
      if (was) SDAW.audio.play(Math.floor(at));
    });
    // drag on the tempo box to change it
    $('#inTempo').addEventListener('wheel', e => { e.preventDefault(); e.target.value = +e.target.value + (e.deltaY < 0 ? 1 : -1); e.target.dispatchEvent(new Event('change')); });
    keySel.addEventListener('change', e => SDAW.store.mutate('Key', song => { song.key = e.target.value; song.keyFixed = true; }));
    const meter = $('#inMeter');
    SDAW.TIME_SIGS.forEach(([n, d]) => meter.appendChild(el('option', { value: n + '/' + d }, n + '/' + d)));
    meter.addEventListener('change', e => { const [n, d] = e.target.value.split('/').map(Number); app.changeTimeSig(n, d); });
    $('#inScale').addEventListener('change', e => SDAW.store.mutate('Scale', song => { song.scale = e.target.value; song.keyFixed = true; }));
  }
  function syncParams() {
    const song = SDAW.store.song;
    $('#inTempo').value = song.tempo;
    $('#inKey').value = song.key;
    $('#inScale').value = song.scale;
    const ts = SDAW.timeSig(song); $('#inMeter').value = ts.num + '/' + ts.den;
  }

  /**
   * Change the time signature. An empty song changes at once; a song with
   * blocks asks how: keep the music in time (bar lines move) or keep each
   * bar (every bar is cut / padded to the new length).
   */
  app.changeTimeSig = function (num, den) {
    const s = SDAW.store, cur = SDAW.timeSig();
    if (cur.num === num && cur.den === den) return;
    const was = SDAW.audio.playing; if (was) SDAW.audio.stop();
    const hasContent = s.song.tracks.some(t => t.clips.length);
    const apply = (mode) => {
      s.setTimeSig(num, den, mode);
      SDAW.audio.stopTick = 0;
      if (!SDAW.is44()) SDAW.toast('Time signature ' + num + '/' + den + ' — note: Auto Generate writes in 4/4 only');
      syncParams();
    };
    if (!hasContent) { apply('time'); return; }
    const close = () => { back.remove(); syncParams(); };
    const choice = (label, help, mode) => el('button', { class: 'btn', style: { display: 'block', width: '100%', textAlign: 'left', margin: '8px 0', padding: '12px' },
      onclick: () => { back.remove(); apply(mode); } }, [el('b', {}, label), el('div', { style: { fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '4px', whiteSpace: 'normal' } }, help)]);
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal', style: { width: '540px' } }, [
        el('h3', { style: { marginTop: 0 } }, 'Change time signature ' + cur.num + '/' + cur.den + ' → ' + num + '/' + den),
        choice('Keep each bar (recommended for written music)', 'Every bar keeps its notes and its number. Bars get shorter (notes past the new end are removed) or longer (silence is added). Sections and repeats stay on their bars.', 'bars'),
        choice('Keep the music in time', 'Nothing moves in time — only the bar lines move. Sections and repeats are re-counted to the nearest new bar.', 'time'),
        el('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [el('button', { class: 'btn', onclick: close }, 'Cancel')])
      ])
    ]);
    $('#modalRoot').appendChild(back);
  };

  /* ========================================================= FILE ===== */
  /**
   * Save the project as a .sdaw.json file (recorded / imported samples are embedded in it).
   * The result is reported honestly: saved, cancelled (nothing written), or failed (the
   * previous file is unchanged). Chrome / Edge / Windows: "Save as" dialog of the system
   * (File System Access API) — the file is replaced only when the new one is complete;
   * Ctrl+S saves again into the same file. Other browsers: a download.
   * Returns true when the file was written.
   */
  app.saveFile = async function (saveAs) {
    if (SDAW.desktop && SDAW.desktop.on) await SDAW.desktop.collectStates();     // plugin settings go into the project
    const song = SDAW.store.song;
    let pack;
    try { pack = await SDAW.samples.exportForSave(song); }
    catch (e) { SDAW.toast('⚠ Not saved: the samples of the project could not be read (' + e.message + ')'); return false; }
    if (pack.missing.length) {
      const names = pack.missing.slice(0, 6).join(', ') + (pack.missing.length > 6 ? '…' : '');
      if (!window.confirm(pack.missing.length + ' sample(s) of this project are not on this computer and cannot be put in the file:\n' + names + '\n\nSave the project without them?')) { SDAW.toast('Not saved'); return false; }
    }
    const text = JSON.stringify(Object.assign({}, song, { embeddedSamples: pack.list }));
    const name = (song.title || 'song').replace(/[^\w\- ]/g, '') + '.sdaw.json';
    const note = pack.missing.length ? ' · ⚠ without ' + pack.missing.length + ' missing sample(s)' : (pack.list.length ? ' · ' + pack.list.length + ' sample(s) inside' : '');
    if (window.showSaveFilePicker) {
      try {
        let h = !saveAs && app.fileHandle && app.fileHandleSong === song ? app.fileHandle : null;
        if (!h) h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'ScoreDAW project', accept: { 'application/json': ['.json'] } }] });
        SDAW.toast('Saving…');
        const w = await h.createWritable();           // writes a temporary copy: the old file stays until close()
        try { await w.write(text); await w.close(); } catch (err) { try { await w.abort(); } catch (e2) { /* already closed */ } throw err; }
        app.fileHandle = h; app.fileHandleSong = song;
        SDAW.toast('💾 Project saved: ' + h.name + note);
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') { SDAW.toast('Save cancelled — nothing was written'); return false; }
        if (!(err && (err.name === 'SecurityError' || err.name === 'NotAllowedError' || err instanceof TypeError))) {
          SDAW.toast('⚠ Could not save: ' + (err && err.message) + ' — the previous file is unchanged'); return false;
        }
        // the dialog is not allowed here: fall back to a download
      }
    }
    const blob = new Blob([text], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    const result = SDAW.desktop && SDAW.desktop.on && SDAW.desktop.waitDownload ? SDAW.desktop.waitDownload(name) : null;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    if (!result) { SDAW.toast('⇩ Project downloaded: ' + name + note + ' (see the browser downloads)'); return true; }
    const r = await result;                         // Windows: the "Save as" dialog answers
    if (r.state === 'completed') { SDAW.toast('💾 Project saved: ' + (r.path || name) + note); return true; }
    if (r.state === 'cancelled') { SDAW.toast('Save cancelled — nothing was written'); return false; }
    if (r.state === 'unknown') { SDAW.toast('⇩ Project sent to the "Save as" dialog: ' + name + note); return true; }   // ScoreDAW.exe older than this version
    SDAW.toast('⚠ Could not save: ' + (r.reason || 'write error') + ' — the previous file is unchanged'); return false;
  };
  app.openFile = function () { $('#fileOpen').click(); };
  /**
   * The ONE loader of project files (File → Open, and a .sdaw.json opened with ScoreDAW.exe):
   * checks the structure and the version, restores the embedded samples, and only then replaces
   * the current project (which stays open when the file cannot be opened).
   */
  app.openProjectText = async function (text, name) {
    let song;
    try { song = JSON.parse(text); } catch (e) { throw new Error('this is not a ScoreDAW project (' + e.message + ')'); }
    const bad = SDAW.validateProject(song);
    if (bad) throw new Error(bad);
    const emb = song.embeddedSamples || []; delete song.embeddedSamples;
    SDAW.migrateSong(SDAW.deepCopy(song));          // a test conversion: errors here leave the current project open
    if (emb.length) await SDAW.samples.importEmbedded(emb);
    app.fileHandle = null;
    app.loadSong(song);
    SDAW.toast('Opened: ' + (name || song.title || 'project') + (emb.length ? ' · ' + emb.length + ' sample(s) restored' : ''));
    return song;
  };
  function onFileChosen(e) {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    f.text().then(text => app.openProjectText(text, f.name)).catch(err => SDAW.toast('⚠ Could not open ' + f.name + ': ' + err.message + ' — the current project is still open'));
  }
  app.loadSong = function (song, keepUndo) {
    if (app.patPreview) app.stopViewPattern();
    if (SDAW.audio.playing || SDAW.audio.preparing) SDAW.audio.stop();
    if (!keepUndo) app.fileHandle = null;            // Ctrl+S of another project asks for a file again
    SDAW.audio.patternMode = false;
    SDAW.audio.stopTick = 0;
    SDAW.audio.loop = { on: false, start: 0, end: null };
    SDAW.store.load(song, keepUndo);
    syncParams();
    app.syncTransport();
  };

  function showNewSongEditor() {
    const s = SDAW.store, song = s.song;
    const specs = song.gen?.by === 'songgen' ? SDAW.songgen.styleOf(song.gen.opts).tracks : null;
    const lead = song.tracks.find(track => track.type === 'guitar' && (specs
      ? specs.some(spec => spec.id === track.styleTrack && spec.lead)
      : SDAW.autogen.autoRole(track, song) === 'melody'));
    const drums = song.tracks.find(track => track.type === 'drums');
    const track = lead || drums;
    if (!track) return false;

    s.selectTrack(track.id);
    if (lead) {
      app.showView('scoretab');
      const firstNote = s.trackNotes(lead)[0];
      SDAW.notation.scrollToTick(firstNote?.start ?? 0);
    } else {
      const clip = drums.clips.find(c => c.kind === 'pattern' && s.pattern(c.patternId)?.kind === 'drums');
      if (clip) s.setCursor(clip.start);
      SDAW.pattern.rack.open[drums.id] = true;
      app.showView('pattern');
      $('#view-pattern .ch-name.sel')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    $('#arrScroll .trk-head.sel')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  app.loadNewSong = function (song, keepUndo) {
    app.loadSong(song, keepUndo);
    showNewSongEditor();
  };
  /**
   * Autosave: localStorage (fast); when it is full, IndexedDB (no size limit) + one warning.
   * The last valid copy is removed only AFTER the new one is written; a failed write keeps it
   * and is reported once. Returns a promise: true = written, false = failed.
   */
  let autosaveWarned = false, autosaveFailWarned = false;
  app.autosaveState = { ok: true, at: 0 };
  const autosaveBody = () => {
    let json;
    try { json = JSON.stringify(SDAW.store.song); } catch (e) { return Promise.resolve(false); }
    const KEY = CONFIG.app.storageKey;
    const done = (ok, err) => {
      app.autosaveState = { ok, at: Date.now(), err: err ? String(err.message || err) : '' };
      if (!ok && !autosaveFailWarned) { autosaveFailWarned = true; SDAW.toast('⚠ Autosave failed (' + app.autosaveState.err + '): the last autosaved copy is kept — save the project with Ctrl+S'); }
      if (ok) autosaveFailWarned = false;
      return ok;
    };
    try {
      localStorage.setItem(KEY, json);
      localStorage.removeItem(KEY + '.idb');
      return Promise.resolve(done(true));
    } catch (e) {
      // too big for localStorage: write the database copy first, then retire the small one
      return SDAW.samples.saveAutosave(json).then(() => {
        try { localStorage.setItem(KEY + '.idb', '1'); localStorage.removeItem(KEY); } catch (e2) { /* the flag is tiny */ }
        if (!autosaveWarned) { autosaveWarned = true; SDAW.toast('This project is large: autosave now uses the browser database. Save it with Ctrl+S to keep a file.'); }
        return done(true);
      }).catch(err => done(false, err));
    }
  };
  const autosave = SDAW.debounce(autosaveBody, 800);
  app.autosaveNow = autosaveBody;            // immediate (Windows version, before closing)

  /* ======================================================== MENUS ===== */
  const MENUS = {
    File: [['New project…', 'Ctrl+N', () => app.showWelcome()], ['Open…', 'Ctrl+O', () => app.openFile()], ['Save', 'Ctrl+S', () => app.saveFile()], ['Save as…', 'Ctrl+Shift+S', () => app.saveFile(true)], null, ['⇪ Export…', 'Ctrl+E', () => SDAW.exporter.open()], ['Export audio (WAV / MP3)…', '', () => SDAW.exporter.open('audio')], ['Export MIDI…', '', () => SDAW.exporter.open('midi')], ['Export MusicXML (Guitar Pro / MuseScore)…', '', () => SDAW.exporter.open('xml')], ['Print / Save as PDF…', 'Ctrl+P', () => SDAW.exporter.open('print')], null,
      ['Settings…', 'Ctrl+,', () => SDAW.settings.open()], ['Audio devices…', '', () => SDAW.settings.open('audio')], ['MIDI devices…', '', () => SDAW.settings.open('midi')], ['Library folders…', '', () => SDAW.settings.open('folders')], null, ['Song title…', '', () => SDAW.ask('Song title', SDAW.store.song.title, v => SDAW.store.mutate('Title', s => { s.title = v; }))]],
    Edit: [['Undo', 'Ctrl+Z', () => SDAW.store.undo()], ['Redo', 'Ctrl+Y', () => SDAW.store.redo()], null, ['Delete selected notes', 'Del', () => SDAW.store.deleteSelectedNotes()], ['Select all notes of track', 'Ctrl+A', () => selectAll()]],
    Track: [['Add track…', '', (e) => $('#btnAddTrack').click()], ['Duplicate selected track', '', () => dupTrack()], ['Delete selected track', '', () => delTrack()], null,
      ['New notes pattern', '', () => SDAW.store.newPattern('notes', 'Pattern ' + (SDAW.store.song.patterns.length + 1), SDAW.barTicks())], ['New drum pattern', '', () => SDAW.store.newPattern('drums', 'Beat ' + (SDAW.store.song.patterns.length + 1), SDAW.barTicks())],
      ['Song length…', '', () => SDAW.ask('Song length in bars', String(SDAW.store.song.bars), v => SDAW.store.mutate('Song length', s => { s.bars = Math.max(1, parseInt(v, 10) || s.bars); }))],
      ['Connect sound folder…', '', () => SDAW.samples.connectFolder()]],
    Score: [['Score + Tab', 'F6', () => app.showView('scoretab')], ['Score only', 'F4', () => app.showView('score')], ['Tab only', 'F5', () => app.showView('tab')], null, ['Insert chord (Chord Builder)', '', () => SDAW.input.setMode('chords')]],
    Tools: [['✨ Auto Generate Track (melody / harmony / bass / drums)…', 'Ctrl+G', () => SDAW.autogen.open()], ['🎼 Auto Generate Full Song (genre, key, band)…', 'Ctrl+Shift+G', () => SDAW.songgen.open()], null, ['Song Builder (start with a style)…', '', () => app.showWelcome()], ['Load style groove…', '', () => app.showView('pattern')], null, ['Metronome', 'M', () => toggleMetronome()], ['Simple mode', '', () => app.setMode('simple')], ['Pro mode', '', () => app.setMode('pro')]],
    View: [['Pattern', 'F2', () => app.showView('pattern')], ['Piano Roll', 'F3', () => app.showView('pianoroll')], ['Mixer', 'F7', () => app.showView('mixer')], ['Generator (instrument panel)', 'F8', () => app.showView('instrument')], null, ['Library panel', 'Alt+1', () => SDAW.layout.toggle('libOpen')], ['Song / Arrange panel', 'Alt+2', () => SDAW.layout.toggle('arrOpen')], ['Input panel', 'Alt+3', () => SDAW.layout.toggle('inOpen')], ['Editor panel', 'Alt+4', () => SDAW.layout.toggle('edOpen')], ['Inspector panel', 'Alt+5', () => SDAW.layout.toggle('inspOpen')], ['Reset panel layout', 'Alt+0', () => SDAW.layout.reset()], null, ['Interface: Auto size', 'Ctrl+0', () => app.changeScale(0)], ['Interface: larger', 'Ctrl +', () => app.changeScale(1)], ['Interface: smaller', 'Ctrl −', () => app.changeScale(-1)]],
    Help: [['Help & shortcuts', 'F1', () => app.showHelp()], ['About', '', () => SDAW.toast(CONFIG.app.name + ' ' + CONFIG.app.version + ' — preview build')]]
  };
  function buildMenus() {
    const bar = $('#menubar');
    Object.keys(MENUS).forEach(name => {
      const item = el('div', { class: 'menu-item', onclick: (e) => {
        e.stopPropagation();
        const open = item.classList.contains('open');
        closeMenus();
        if (open) return;
        item.classList.add('open');
        // the dropdown lives in #app (the top bar clips its children)
        const drop = el('div', { class: 'menu-drop glass', id: 'menuDrop' }, MENUS[name].map(m => m ? el('div', { class: 'mi', onclick: (ev) => { ev.stopPropagation(); closeMenus(); m[2](ev); } }, [m[0], el('kbd', {}, m[1])]) : el('div', { class: 'msep' })));
        const ar = $('#app').getBoundingClientRect(), r = item.getBoundingClientRect();
        drop.style.left = ((r.left - ar.left) / app.scale) + 'px';
        drop.style.top = ((r.bottom - ar.top) / app.scale + 4) + 'px';
        $('#app').appendChild(drop);
      } }, name);
      item.addEventListener('mouseenter', () => { if ($('#menuDrop') && !item.classList.contains('open')) item.click(); });
      bar.appendChild(item);
    });
    document.addEventListener('click', closeMenus);
  }
  function closeMenus() { $$('.menu-item.open').forEach(m => m.classList.remove('open')); const d = $('#menuDrop'); if (d) d.remove(); }

  function selectAll() { const p = SDAW.pianoroll.current(); if (p) SDAW.store.selectNotes(p.notes.map(n => n.id)); }
  function dupTrack() { const t = SDAW.store.selTrack(); if (!t) return; SDAW.store.mutate('Duplicate track', song => { const c = SDAW.deepCopy(t); c.id = SDAW.uid('trk'); c.name += ' (copy)'; c.clips.forEach(cl => { cl.id = SDAW.uid('clp'); }); song.tracks.splice(song.tracks.indexOf(t) + 1, 0, c); }); }
  function delTrack() { const t = SDAW.store.selTrack(); if (!t) return; SDAW.store.mutate('Delete track', song => { song.tracks = song.tracks.filter(x => x !== t); }); SDAW.audio.removeTrack(t.id); SDAW.store.validateSelection(); SDAW.bus.emit('selection', { type: 'track' }); }
  function toggleMetronome() { CONFIG.audio.metronome = !CONFIG.audio.metronome; app.syncTransport(); SDAW.toast('Metronome ' + (CONFIG.audio.metronome ? 'ON' : 'OFF')); }

  /* ===================================================== DIALOGS ===== */
  SDAW.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  };

  SDAW.ask = function (title, value, cb) {
    const input = el('input', { type: 'text', value: value || '', style: { width: '100%', fontSize: '16px', padding: '10px' } });
    const close = () => back.remove();
    const ok = () => { const v = input.value.trim(); close(); if (v) cb(v); };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') close(); });
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal', style: { width: '480px' } }, [
        el('h3', { style: { marginTop: 0 } }, title), input,
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' } }, [el('button', { class: 'btn', onclick: close }, 'Cancel'), el('button', { class: 'btn primary', onclick: ok }, 'OK')])
      ])
    ]);
    $('#modalRoot').appendChild(back);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  };

  /** Yes / No dialog */
  SDAW.confirm = function (title, msg, okLabel, cb) {
    const close = () => back.remove();
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal', style: { width: '500px' } }, [
        el('h3', { style: { marginTop: 0 } }, title),
        el('p', { style: { whiteSpace: 'pre-line', color: 'var(--text-dim)', lineHeight: 1.5 } }, msg),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' } }, [
          el('button', { class: 'btn', onclick: close }, 'Cancel'),
          el('button', { class: 'btn danger-btn', onclick: () => { close(); cb(); } }, okLabel || 'OK')
        ])
      ])
    ]);
    $('#modalRoot').appendChild(back);
  };

  SDAW.contextMenu = function (e, items) {
    const m = $('#ctxMenu');
    m.innerHTML = '';
    items.forEach(it => m.appendChild(it ? el('div', { class: 'mi', onclick: () => { m.classList.add('hidden'); it[1](); } }, it[0]) : el('div', { class: 'msep' })));
    const r = $('#app').getBoundingClientRect();
    m.style.left = ((e.clientX - r.left) / app.scale) + 'px';
    m.style.top = ((e.clientY - r.top) / app.scale) + 'px';
    m.classList.remove('hidden');
    setTimeout(() => document.addEventListener('mousedown', function h(ev) { if (!m.contains(ev.target)) { m.classList.add('hidden'); document.removeEventListener('mousedown', h); } }), 0);
  };

  /* ================================================ WELCOME SCREEN ===== */
  app.showWelcome = function () {
    const close = () => back.remove();
    const genreSel = el('select', { onclick: e => e.stopPropagation() }, CONFIG.library.genres.map(g => el('option', { value: g }, g)));
    const meterSel = el('select', { onclick: e => e.stopPropagation(), 'data-help': 'Time signature of the new song' }, SDAW.TIME_SIGS.map(([n, d]) => el('option', { value: n + '/' + d, selected: n === 4 && d === 4 ? true : null }, n + '/' + d)));
    const back = el('div', { class: 'modal-back' }, [
      el('div', { class: 'modal' }, [
        el('button', { class: 'close', onclick: close }, '✕'),
        el('div', { class: 'welcome-head' }, [
          el('img', { src: 'assets/scoredaw-logo.svg', width: 116, height: 116, alt: 'ScoreDAW' }),
          el('div', {}, [el('h1', { html: 'Welcome to<br>Score<span>DAW</span>' }), el('p', {}, 'Compose, arrange and write music easily — DAW, score and guitar tab in one place.')])
        ]),
        el('div', { class: 'wcards' }, [
          el('div', { class: 'wcard style', 'data-help': 'Creates drums, bass, piano, guitar strums and a melody in the chosen style. Everything stays editable.', onclick: () => {
            const sg = SDAW.buildSong(genreSel.value); close(); app.loadNewSong(sg); SDAW.toast(genreSel.value + ' song ready (' + SDAW.songIdeaText(sg) + ') — press Space to play');
          } }, [el('div', { class: 'wico' }, '🎵'), el('h3', {}, 'Start with a style'), el('p', {}, 'Choose a genre and get a ready-to-edit song.'), genreSel,
            // every option of the Full Song panel: instruments, key, form, progressions, the lead in each section, ending…
            el('button', { class: 'btn small w-custom', 'data-help': 'Choose everything: instruments (add any), singer, key, tempo, form, progressions, complexity, the guitarist style, what the lead plays in each section and the ending',
              onclick: e => { e.stopPropagation(); SDAW.songgen.open({ genre: genreSel.value, onDone: close }); } }, '⚙ Choose everything…')]),
          el('div', { class: 'wcard guitar', onclick: () => {
            app.loadSong(SDAW.emptySong(meterSel.value.split('/').map(Number), 'guitar')); close(); app.showView('scoretab'); SDAW.input.setMode('fretboard');
            SDAW.toast('Click the fretboard or type fret numbers in the tab to start writing');
          } }, [el('div', { class: 'wico' }, '🎸'), el('h3', {}, 'Write for guitar'), el('p', {}, 'Score + tab with the fretboard ready to write, like Guitar Pro.'), el('label', { class: 'w-meter', onclick: e => e.stopPropagation() }, ['Time sig. ', meterSel])]),
          el('div', { class: 'wcard beat', onclick: () => {
            close(); app.loadNewSong(SDAW.beatSong('Pop'));
            SDAW.audio.setPatternMode(true); app.syncTransport();
            SDAW.toast('Click the steps to build your beat — Space to play (PAT mode)');
          } }, [el('div', { class: 'wico' }, '🥁'), el('h3', {}, 'Make a beat'), el('p', {}, 'Build a rhythm with the step sequencer and style grooves.')])
        ]),
        el('div', { class: 'welcome-foot' }, [
          el('button', { class: 'btn', onclick: () => { close(); app.openFile(); } }, '📂 Open project'),
          el('span', { style: { color: 'var(--text-dim)' } }, 'Popular:'),
          ...['Pop', 'Rock', 'Salsa', 'Bachata', 'Blues', 'Ballad'].map(g => el('button', { class: 'tpl-chip', onclick: () => { const sg = SDAW.buildSong(g); close(); app.loadNewSong(sg); SDAW.toast(g + ' template loaded (' + SDAW.songIdeaText(sg) + ')'); } }, g)),
          el('button', { class: 'tpl-chip', 'data-help': 'An empty song with a Grand Piano track, in the time signature chosen on the guitar card', onclick: () => { app.loadSong(SDAW.emptySong(meterSel.value.split('/').map(Number))); close(); } }, 'Empty project'),
          el('span', { class: 'spacer' }),
          el('label', { style: { fontSize: '13px', color: 'var(--text-dim)', display: 'flex', gap: '6px', alignItems: 'center' } }, [
            el('input', { type: 'checkbox', checked: localStorage.getItem('scoredaw.noWelcome') ? null : true, onchange: e => e.target.checked ? localStorage.removeItem('scoredaw.noWelcome') : localStorage.setItem('scoredaw.noWelcome', '1') }), 'Show at start'])
        ])
      ])
    ]);
    $('#modalRoot').appendChild(back);
  };

  /* =================================================== HELP WINDOW ===== */
  app.showHelp = function () {
    const close = () => back.remove();
    const rows = (list) => el('table', {}, list.map(([k, v]) => el('tr', {}, [el('td', {}, k), el('td', {}, v)])));
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal help-modal' }, [
        el('button', { class: 'close', onclick: close }, '✕'),
        el('h2', { style: { marginTop: 0 } }, 'Help & Shortcuts'),
        el('p', { style: { color: 'var(--text-dim)' } }, 'One song, many views: a note written on the fretboard appears in the tab, the score, the piano roll and the arrange view at once. Move the mouse over any control — the help bar at the bottom explains it.'),
        el('div', { class: 'help-cols' }, [
          el('div', {}, [el('h3', {}, 'General'), rows([
            ['Space', 'Play / pause the song'], ['Shift+Space', 'Play / stop only the current pattern (loop)'], ['Home', 'Go to start'], ['R', 'Record'], ['L', 'Loop on/off'], ['M', 'Metronome'],
            ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S / Ctrl+O', 'Save / open'], ['F1', 'This help'],
            ['F2 … F7', 'Pattern, Piano Roll, Score, Tab, Score+Tab, Mixer'], ['Alt+1 … Alt+5', 'Open / close Library, Arrange, Input, Editor, Inspector'], ['Alt+0', 'Reset the panel layout'], ['Ctrl + / − / 0', 'Interface size (0 = auto)'], ['Esc', 'Close dialogs, clear selection']
          ])]),
          el('div', {}, [el('h3', {}, 'Writing notes'), rows([
            ['Fretboard click', 'Write the note at the cursor (Shift = chord)'], ['Z S X D C V G B H N J M', 'PC keyboard piano (lower octave)'],
            ['Q 2 W 3 E R 5 T 6 Y 7 U I', 'PC keyboard piano (upper octave)'], ['[ / ]', 'PC keyboard octave down / up'], ['Shift + 1…7', 'Insert the chords of the key (I … vii)'],
            ['Tab: 0 … 9', 'Type a fret number on the cursor string'], ['← → / Ctrl+← →', 'Move cursor by duration / by bar'], ['↑ ↓', 'Change string (or pitch of selected notes)'],
            ['+ / −', 'Longer / shorter duration'], ['H P S B V X O K', 'Hammer, pull-off, slide, bend, vibrato, dead, harmonic, palm mute'], ['Delete', 'Delete selected notes']
          ])])
        ])
      ])
    ]);
    $('#modalRoot').appendChild(back);
  };

  /* ===================================================== KEYBOARD ===== */
  function onKey(e) {
    if (e.target.matches('input[type=text], input[type=number], input[type=search], select, textarea')) return;
    if ($('#modalRoot').children.length) { if (e.key === 'Escape') $('#modalRoot').innerHTML = ''; return; }
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    // global with Ctrl
    if (ctrl) {
      const map = { ',': () => SDAW.settings.open(), g: () => (e.shiftKey ? SDAW.songgen.open() : SDAW.autogen.open()), e: () => SDAW.exporter.open(), p: () => SDAW.exporter.open('print'), z: () => SDAW.store.undo(), y: () => SDAW.store.redo(), s: () => app.saveFile(e.shiftKey), o: () => app.openFile(), n: () => app.showWelcome(), a: selectAll, '=': () => app.changeScale(1), '+': () => app.changeScale(1), '-': () => app.changeScale(-1), '0': () => app.changeScale(0) };
      if (app.focusZone === 'arrange' && ['d', 'c', 'v'].includes(k.toLowerCase()) && SDAW.arrange.handleKey(e)) { e.preventDefault(); return; }
      const f = map[k.toLowerCase()];
      if (f && !(app.focusZone === 'notation' && (k === 'ArrowLeft' || k === 'ArrowRight'))) { e.preventDefault(); f(); return; }
    }
    if (SDAW.layout.handleKey(e)) { e.preventDefault(); return; }
    if (k === ' ' && e.shiftKey) { e.preventDefault(); app.playViewPattern(); return; }
    if (k === ' ') { e.preventDefault(); app.togglePlay(); return; }
    const fkeys = { F1: () => app.showHelp(), F2: () => app.showView('pattern'), F3: () => app.showView('pianoroll'), F4: () => app.showView('score'), F5: () => app.showView('tab'), F6: () => app.showView('scoretab'), F7: () => app.showView('mixer'), F8: () => app.showView('instrument') };
    if (fkeys[k]) { e.preventDefault(); fkeys[k](); return; }
    if (k === 'Escape') { SDAW.store.selectNotes([]); return; }
    if (k === 'Home') { SDAW.audio.seek(0); return; }
    // focus zones
    if (app.focusZone === 'arrange' && SDAW.arrange.handleKey(e)) { e.preventDefault(); return; }
    if (app.focusZone === 'notation' && (app.view === 'score' || app.view === 'tab' || app.view === 'scoretab')) {
      if (SDAW.notation.handleKey(e)) { e.preventDefault(); return; }
    }
    if ((k === 'Delete' || k === 'Backspace') && SDAW.store.sel.noteIds.length) { SDAW.store.deleteSelectedNotes(); e.preventDefault(); return; }
    // PC keyboard piano: active when the Piano input is shown or the input strip was clicked last
    if (app.focusZone !== 'notation' && (SDAW.input.mode === 'piano' || app.focusZone === 'input') && SDAW.input.handlePcKey(e)) { e.preventDefault(); return; }
    const lower = k.toLowerCase();
    if (lower === 'r') return app.toggleRecord();
    if (lower === 'l') return app.toggleLoop();
    if (lower === 'm') return toggleMetronome();
    if (lower === 'p') return app.togglePatternMode();
  }

  /* ====================================================== HELP BAR ===== */
  function bindHelpBar() {
    let last = null;
    document.addEventListener('mouseover', e => {
      const n = e.target.closest && e.target.closest('[data-help]');
      if (!n || n === last) return;
      last = n;
      $('#helpText').innerHTML = '<b>Tip:</b> ' + n.getAttribute('data-help').replace(/</g, '&lt;');
    });
  }

  /* ===================================================== ANIMATION ===== */
  function frame() {
    const tick = SDAW.audio.getTick();
    updateLcd(tick);
    SDAW.arrange.updatePlayhead(tick);
    if (app.view === 'pattern') SDAW.pattern.updatePlayhead(tick);
    if (app.view === 'mixer') SDAW.mixer.updateMeters();
    if ((app.view === 'score' || app.view === 'tab' || app.view === 'scoretab')) SDAW.notation.updatePlayhead(tick);
    if (SDAW.audio.playing) {
      if (app.view === 'pianoroll') SDAW.pianoroll.render();
      if (SDAW.input.mode === 'fretboard') SDAW.input.drawFretboard();
    }
    SDAW.input.updatePianoPlayback();             // light the piano keys of the notes that sound
    requestAnimationFrame(frame);
  }

  /* =========================================================== INIT ==== */
  app.init = function () {
    // restore preferences
    try { const sc = JSON.parse(localStorage.getItem('scoredaw.scale') || 'null'); if (sc) { CONFIG.ui.scaleMode = sc.mode; CONFIG.ui.manualScale = sc.value; } } catch (e) { /* ignore */ }
    app.setMode(localStorage.getItem('scoredaw.mode') || CONFIG.ui.startMode);
    window.addEventListener('resize', SDAW.debounce(app.applyScale, 60));
    app.applyScale();

    // song: autosave or a demo song
    let song = null;
    try { song = JSON.parse(localStorage.getItem(CONFIG.app.storageKey) || 'null'); } catch (e) { song = null; }
    const bigAutosave = localStorage.getItem(CONFIG.app.storageKey + '.idb') === '1';
    const needsDemo = !song?.tracks;
    if (needsDemo) song = SDAW.buildSong('Pop');
    SDAW.audio.loop = { on: false, start: 0, end: null };
    SDAW.store.load(song);
    // a large project was autosaved in IndexedDB: open it as soon as it is read
    if (bigAutosave) SDAW.samples.loadAutosave().then(json => { if (json) { const sg = JSON.parse(json); if (sg && sg.tracks) app.loadSong(sg); } }).catch(() => {});

    buildMenus();
    bindParams(); syncParams();
    SDAW.library.init();
    SDAW.arrange.init();
    SDAW.input.init();
    SDAW.pianoroll.init();
    SDAW.notation.init();
    SDAW.inspector.init();
    SDAW.layout.init();

    // buttons
    $('#btnNew').onclick = () => app.showWelcome();
    $('#btnOpen').onclick = () => app.openFile();
    $('#btnSave').onclick = () => app.saveFile();
    $('#btnUndo').onclick = () => SDAW.store.undo();
    $('#btnRedo').onclick = () => SDAW.store.redo();
    $('#fileOpen').addEventListener('change', onFileChosen);
    $('#btnPlay').onclick = () => app.togglePlay();
    $('#btnPause').onclick = () => app.pause();
    $('#btnStop').onclick = () => app.stop();
    $('#btnHome').onclick = () => SDAW.audio.seek(0);
    $('#btnRec').onclick = () => app.toggleRecord();
    $('#btnLoop').onclick = () => app.toggleLoop();
    $('#btnPatMode').onclick = () => app.togglePatternMode();
    $('#btnMetronome').onclick = () => toggleMetronome();
    $('#btnSimple').onclick = () => app.setMode('simple');
    $('#btnPro').onclick = () => app.setMode('pro');
    $('#btnScaleUp').onclick = () => app.changeScale(1);
    $('#btnScaleDown').onclick = () => app.changeScale(-1);
    $('#btnHelp').onclick = $('#btnHelp2').onclick = () => app.showHelp();
    $('#btnSettings').onclick = () => SDAW.settings.open();
    $$('#editorTabs .tab').forEach(b => b.addEventListener('click', () => app.showView(b.dataset.view)));

    // focus zones
    $('#editorBody').addEventListener('mousedown', () => { if (['score', 'tab', 'scoretab'].includes(app.view)) app.focusZone = 'notation'; else app.focusZone = 'other'; }, true);
    $('#inputStrip').addEventListener('mousedown', () => { app.focusZone = 'input'; }, true);
    $('#arrangePanel').addEventListener('mousedown', () => { app.focusZone = 'arrange'; }, true);
    $('#library').addEventListener('mousedown', () => { app.focusZone = 'other'; }, true);

    document.addEventListener('keydown', onKey);
    bindHelpBar();

    // global redraws
    SDAW.bus.on('change', () => { app.renderEditor(); autosave(); syncParams(); });
    SDAW.bus.on('selection', (e) => { if (!e || e.type !== 'duration') app.renderEditor(); });
    SDAW.bus.on('songLoaded', () => { SDAW.arrange.render(); SDAW.inspector.render(); SDAW.library.render(); });
    SDAW.bus.on('transport', () => { app.syncTransport(); syncMini(); });
    SDAW.bus.on('layout', () => requestAnimationFrame(() => { SDAW.input.drawFretboard(); if (['score', 'tab', 'scoretab'].includes(app.view)) SDAW.notation.render(); }));
    // audio starts only after a user gesture (browser rule)
    document.addEventListener('mousedown', () => SDAW.audio.init(), { once: true });
    document.addEventListener('keydown', () => SDAW.audio.init(), { once: true });

    SDAW.arrange.render();
    SDAW.inspector.render();
    if (!(needsDemo && !bigAutosave && showNewSongEditor())) app.showView(app.view);
    app.syncTransport();
    requestAnimationFrame(frame);
    if (CONFIG.ui.showWelcome && !localStorage.getItem('scoredaw.noWelcome')) app.showWelcome();
  };

  document.addEventListener('DOMContentLoaded', app.init);

})(window.SDAW);
