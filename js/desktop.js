/* =====================================================================
 *  ScoreDAW — desktop.js : plugins in the Windows version
 *  ---------------------------------------------------------------------
 *  In ScoreDAW.exe the interface runs inside WebView2 and can talk to the
 *  Windows program (window.chrome.webview). This file adds, ONLY there:
 *
 *    - Library → Plugins (VST3 / CLAP found on the PC)
 *    - Inspector → Plugins: an instrument plugin per track + up to 8 effect
 *      plugins, open their editors, bypass, remove
 *    - live playback: notes of plugin tracks go to the native engine with
 *      the moment they must be heard (clock synced with the program)
 *    - exports: the native engine renders the plugin tracks, the result is
 *      mixed in the normal offline render (volume, pan, automation, sends)
 *    - project: the state of every plugin is saved inside the song
 *
 *  Song model:
 *    track.plugin   = { format, path, uid, name, vendor, state }   instrument
 *    track.pluginFx = [ { format, path, uid, name, vendor, state, bypass } ]
 *
 *  In the browser version this file does nothing (SDAW.desktop.on = false);
 *  plugin tracks then play their built-in sound.
 * ===================================================================== */
(function (SDAW) {
  'use strict';

  const D = SDAW.desktop = {
    on: false, info: null, plugins: [], failed: 0, folders: [], userFolders: [],
    offset: 0,            // host clock (ms) - performance.now()
    nums: {}, nextNum: 1, // track id -> engine track number
    loaded: {},           // "num:slot" -> key of the loaded plugin
    levels: {},           // engine track number -> [peakL, peakR]
    sent: {},             // last volume / pan / mute sent per track
    queue: []             // notes waiting to be posted
  };
  const wv = window.chrome && window.chrome.webview;
  if (!wv) return;                                    // browser: nothing to do

  const { el } = SDAW;
  const MAX_FX = 8;
  let msgId = 0;
  const waiting = {};

  /* ------------------------------------------------------- messages --- */
  D.call = function (cmd, args) {
    return new Promise((res, rej) => {
      const id = ++msgId;
      waiting[id] = { res, rej };
      wv.postMessage({ id, cmd, args: args || {} });
    });
  };
  const post = (cmd, args) => wv.postMessage({ id: 0, cmd, args: args || {} });   // no answer needed

  wv.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.reply) {
      const w = waiting[m.reply]; delete waiting[m.reply];
      if (w) m.ok ? w.res(m.result) : w.rej(new Error(m.error || 'error'));
      return;
    }
    if (m.event === 'levels') D.levels = m.data || {};
    else if (m.event === 'scan') D.onScanProgress(m.data);
    else if (m.event === 'beforeClose') D.beforeClose();
    else if (m.event === 'download') {
      const d = m.data || {}, i = D.downloads.findIndex(w => w.name === d.name);
      if (i >= 0) D.downloads.splice(i, 1)[0].res(d);              // exports (WAV, MIDI…) have no waiter
    }
  });

  /* ---------------------------------------------------------- clock ----
   * The program measures time with its own clock; we estimate the offset
   * between it and performance.now() (round trip / 2), several times.   */
  async function syncClock() {
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = await D.call('clock');
      const t1 = performance.now();
      const off = r.now - (t0 + t1) / 2;
      D.offset = i === 0 ? off : D.offset * 0.6 + off * 0.4;
    }
  }
  /** AudioContext time -> host clock time (ms) at which the sound must be heard */
  function hostTimeOf(ctxTime) {
    const A = SDAW.audio, c = A.ctx;
    const webLatency = ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000;
    return performance.now() + (ctxTime - c.currentTime) * 1000 + webLatency + D.offset;
  }

  /* ---------------------------------------------------- track numbers -- */
  D.num = function (t) {
    if (!D.nums[t.id]) D.nums[t.id] = D.nextNum++;
    return D.nums[t.id];
  };
  const keyOf = (p) => p ? p.format + '|' + p.path + '|' + p.uid : '';
  D.isPluginTrack = (t) => !!(D.on && t && t.plugin);

  /* ---------------------------------------------------------- notes ---- */
  function flush() {
    if (!D.queue.length) return;
    post('notes', { list: D.queue });
    D.queue = [];
  }
  let flushTimer = null;
  function queueNote(num, key, vel, ch, atMs) {
    D.queue.push([num, key, vel, ch, atMs]);
    if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 0);
  }
  /**
   * MIDI channel (0-based) of a plugin track — the SAME for live playing and for exports:
   * an explicit channel of the plugin (t.plugin.ch 1–16) wins; drum pads use channel 10
   * (General MIDI drums), notes channel 1.
   */
  D.channelOf = function (t, drum) {
    const ch = t && t.plugin && +t.plugin.ch;
    if (ch >= 1 && ch <= 16) return ch - 1;
    return drum ? 9 : 0;
  };
  /** Called by audio.js for every note of a plugin track (live) */
  D.note = function (t, pitch, vel, time, dur, ch) {
    if (!D.loaded[D.num(t) + ':0']) return;
    const on = hostTimeOf(time), c = ch === undefined ? D.channelOf(t, false) : ch;
    queueNote(D.num(t), pitch, Math.max(1, Math.min(127, Math.round(vel || 100))), c, on);
    queueNote(D.num(t), pitch, 0, c, on + Math.max(10, dur * 1000));
  };
  /** Drum pads -> General MIDI notes on channel 10 (drum plugins) */
  D.drumNote = function (t, row) {
    const map = SDAW.exporter && SDAW.exporter.drumMapFor ? SDAW.exporter.drumMapFor(t) : {};
    return map[row];
  };
  D.drum = function (t, row, vel01, time) {
    const k = D.drumNote(t, row); if (k === undefined) return;
    D.note(t, k, (vel01 === undefined ? 0.8 : vel01) * 127, time, 0.12, D.channelOf(t, true));
  };
  D.allOff = () => { D.queue = []; post('allOff'); };
  D.transport = function (playing, startTick, startTime) {
    const song = SDAW.store.song;
    post('transport', { tempo: song.tempo, playing: playing ? 1 : 0, ppq: (startTick || 0) / 4, atMs: playing ? hostTimeOf(startTime) : 0 });
  };

  /** Volume / pan / mute of a plugin track (only sent when they change) */
  D.trackParams = function (t, vol, pan) {
    if (!D.isPluginTrack(t)) return;
    const anySolo = SDAW.store.song.tracks.some(x => x.solo);
    const mute = t.mute || (anySolo && !t.solo) ? 1 : 0;
    vol = vol === undefined ? t.vol : vol; pan = pan === undefined ? (t.pan || 0) : pan;
    // the master volume of ScoreDAW also acts on the plugins (the native engine has its own output;
    // an export mixes the plugins through the master, so live and WAV have the same balance)
    vol = vol * (CONFIG.audio.masterVolume === undefined ? 1 : CONFIG.audio.masterVolume);
    const n = D.num(t), last = D.sent[n];
    if (last && Math.abs(last[0] - vol) < 0.004 && Math.abs(last[1] - pan) < 0.004 && last[2] === mute) return;
    D.sent[n] = [vol, pan, mute];
    post('setTrack', { track: n, vol, pan, mute });
  };
  /** master volume changed: send the plugin track volumes again */
  D.masterChanged = function () { if (!D.on) return; SDAW.store.song.tracks.forEach(t => { if (D.isPluginTrack(t)) D.trackParams(t); }); };
  /** Meter level of a plugin track (mixer) */
  D.level = function (t) {
    const l = D.levels[D.num(t)];
    return l ? Math.min(1, Math.max(l[0], l[1]) * 1.4) : 0;
  };

  /* ------------------------------------------------- load / unload ----
   * The song is the truth: after every change the engine is brought in
   * line (plugins loaded, replaced or removed).                          */
  let syncing = false, syncAgain = false;
  D.sync = async function () {
    if (!D.on) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    try {
      const want = {};
      SDAW.store.song.tracks.forEach(t => {
        const n = D.num(t);
        if (t.plugin) want[n + ':0'] = { t, slot: 0, p: t.plugin };
        if (t.plugin) (t.pluginFx || []).slice(0, MAX_FX).forEach((p, i) => { want[n + ':' + (i + 1)] = { t, slot: i + 1, p }; });
      });
      // remove what is not wanted any more
      for (const k of Object.keys(D.loaded)) {
        if (want[k] && keyOf(want[k].p) === D.loaded[k]) continue;
        const [n, slot] = k.split(':').map(Number);
        delete D.loaded[k];
        await D.call('unload', { track: n, slot }).catch(() => {});
      }
      // load the missing ones
      for (const k of Object.keys(want)) {
        if (D.loaded[k]) continue;
        const { t, slot, p } = want[k];
        try {
          const r = await D.call('load', { track: D.num(t), slot, format: p.format, path: p.path, uid: p.uid, state: p.state || '' });
          D.loaded[k] = keyOf(p);
          if (slot === 0) { delete D.sent[D.num(t)]; D.trackParams(t); }
          p._editor = r.editor;
        } catch (e) {
          p._error = e.message;
          SDAW.toast('Plugin "' + p.name + '" could not be loaded: ' + e.message);
        }
      }
      // bypass flags
      SDAW.store.song.tracks.forEach(t => (t.pluginFx || []).forEach((p, i) => { if (D.loaded[D.num(t) + ':' + (i + 1)]) post('bypass', { track: D.num(t), slot: i + 1, bypass: p.bypass ? 1 : 0 }); }));
      // forget removed tracks
      const alive = new Set(SDAW.store.song.tracks.map(t => t.id));
      Object.keys(D.nums).forEach(id => { if (!alive.has(id)) { post('removeTrack', { track: D.nums[id] }); Object.keys(D.loaded).forEach(k => { if (k.startsWith(D.nums[id] + ':')) delete D.loaded[k]; }); delete D.nums[id]; } });
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; D.sync(); }
    }
  };

  /** Read the state of every loaded plugin into the song (before saving) */
  D.collectStates = async function () {
    if (!D.on) return;
    for (const t of SDAW.store.song.tracks) {
      if (!t.plugin) continue;
      const list = [[0, t.plugin]].concat((t.pluginFx || []).map((p, i) => [i + 1, p]));
      for (const [slot, p] of list) {
        if (!D.loaded[D.num(t) + ':' + slot]) continue;
        try { p.state = await D.call('getState', { track: D.num(t), slot }); } catch (e) { /* keep the old state */ }
      }
    }
  };
  /** the result of a file saved through the "Save as" dialog of Windows: { state: completed | cancelled | failed, path, reason } */
  D.downloads = [];
  D.waitDownload = function (name) {
    return new Promise(res => {
      const w = { name, res };
      D.downloads.push(w);
      // older ScoreDAW.exe builds do not report downloads: do not wait forever
      setTimeout(() => { const i = D.downloads.indexOf(w); if (i >= 0) { D.downloads.splice(i, 1); res({ state: 'unknown' }); } }, 600000);
    });
  };
  /** Closing the window: plugin states + autosave are written first; a failed autosave asks before closing */
  D.beforeClose = async function () {
    let ok = true;
    try {
      await D.collectStates();
      if (SDAW.app.autosaveNow) ok = await Promise.race([SDAW.app.autosaveNow(), new Promise(r => setTimeout(() => r('slow'), 12000))]);
    } catch (e) { ok = false; }
    if (ok === false && !window.confirm('The project could not be autosaved (' + ((SDAW.app.autosaveState || {}).err || 'write error') + ').\nThe last autosaved copy is kept.\n\nClose ScoreDAW anyway? (Cancel = stay and save with Ctrl+S)')) { post('closeCancel'); return; }
    post('closeReady');
  };

  /* --------------------------------------------------------- actions --- */
  const pluginRef = (pl) => ({ format: pl.format, path: pl.path, uid: pl.uid, name: pl.name, vendor: pl.vendor || '' });

  /** Instrument plugin: on the given / selected track, or on a new track */
  D.useInstrument = function (pl, trackId) {
    const s = SDAW.store;
    let t = trackId ? s.track(trackId) : null;
    if (!t) {
      // new track: built-in piano as fallback sound (browser version / plugin missing)
      const base = SDAW.findInstrument('Grand Piano') || SDAW.findInstrument(null, 'keys');
      t = SDAW.makeTrack(base, pl.name);
      t.plugin = pluginRef(pl); t.pluginFx = [];
      t.instrument = pl.name;
      s.mutate('Plugin track', song => { song.tracks.push(t); });
      s.selectTrack(t.id);
    } else {
      s.mutate('Plugin instrument', () => { t.plugin = pluginRef(pl); t.pluginFx = t.pluginFx || []; t.instrument = pl.name; });
    }
    SDAW.toast('🔌 ' + pl.name + ' on "' + t.name + '" — open its editor in the Inspector');
    return t;
  };
  /** Effect plugin: added to the chain of the track (the track needs an instrument plugin) */
  D.addEffect = function (pl, trackId) {
    const s = SDAW.store, t = trackId ? s.track(trackId) : s.selTrack();
    if (!t) return SDAW.toast('Select a track first');
    if (!t.plugin) return SDAW.toast('Plugin effects work on tracks that play a plugin instrument. Give "' + t.name + '" an instrument plugin first (Library → Plugins).');
    if ((t.pluginFx || []).length >= MAX_FX) return SDAW.toast('Up to ' + MAX_FX + ' plugin effects per track');
    s.mutate('Plugin effect', () => { t.pluginFx = (t.pluginFx || []).concat([pluginRef(pl)]); });
    SDAW.toast('🔌 ' + pl.name + ' added to "' + t.name + '"');
  };
  D.removeInstrument = function (t) {
    SDAW.store.mutate('Remove plugin', () => {
      delete t.plugin; delete t.pluginFx;
      t.instrument = SDAW.findInstrument(null, t.type).name;
    });
  };
  D.openEditor = async function (t, slot) {
    const p = slot === 0 ? t.plugin : (t.pluginFx || [])[slot - 1];
    if (!p) return;
    try { await D.sync(); await D.call('editor', { track: D.num(t), slot, title: p.name + ' — ' + t.name }); }
    catch (e) { SDAW.toast(e.message); }
  };

  /* -------------------------------------------------------- scanning --- */
  let scanBox = null;
  D.onScanProgress = function (d) {
    if (scanBox) scanBox.textContent = d.total ? 'Scanning ' + d.done + ' / ' + d.total + (d.name ? ' — ' + d.name : '') : '';
  };
  D.scan = async function (force) {
    SDAW.toast(force ? 'Scanning all plugins again…' : 'Looking for new plugins…');
    try {
      const r = await D.call('scan', { force: !!force });
      D.plugins = r.plugins || []; D.failed = (r.failed || []).length; D.failedList = r.failed || [];
      SDAW.toast(D.plugins.length + ' plugin(s) found' + (D.failed ? ' · ' + D.failed + ' could not be loaded' : ''));
    } catch (e) { SDAW.toast('Scan failed: ' + e.message); }
    if (SDAW.library) SDAW.library.render();
  };
  D.addFolder = async function () {
    const f = await D.call('pickFolder');
    if (!f) return;
    const r = await D.call('folders', { set: D.userFolders.concat([f]) });
    D.folders = r.folders; D.userFolders = r.userFolders;
    D.scan(false);
  };

  /* ------------------------------------------------ Library → Plugins -- */
  D.renderLibrary = function (list, q, ui) {
    const match = (pl) => !q || (pl.name + ' ' + pl.vendor + ' ' + pl.category).toLowerCase().includes(q);
    scanBox = el('div', { class: 'lib-hint small' });
    list.appendChild(el('div', { class: 'plg-tools' }, [
      el('button', { class: 'btn small', 'data-help': 'Look for new or changed plugins', onclick: () => D.scan(false) }, '⟳ Scan'),
      el('button', { class: 'btn small', 'data-help': 'Scan every plugin again', onclick: () => D.scan(true) }, 'Rescan all'),
      el('button', { class: 'btn small', 'data-help': 'Add a folder with VST3 / CLAP plugins (the standard Windows folders are always scanned)', onclick: () => D.addFolder() }, '＋ Folder')
    ]));
    list.appendChild(scanBox);
    if (!D.info || !D.info.engine) {
      list.appendChild(el('div', { class: 'lib-hint' }, 'The plugin engine is not running' + (D.info && D.info.engineError ? ': ' + D.info.engineError : '') + '.'));
      return;
    }
    if (!D.plugins.length) {
      list.appendChild(el('div', { class: 'lib-hint' }, 'No plugins yet. Press ⟳ Scan. ScoreDAW looks in C:\\Program Files\\Common Files\\VST3 and \\CLAP, and in the folders you add.'));
      return;
    }
    list.appendChild(el('div', { class: 'lib-hint small' }, 'Instruments: double-click = use on the selected track (or a new one) · drag to a track or empty space. Effects: double-click = add to the selected track.'));
    const groupsOf = (instr) => {
      const by = {};
      D.plugins.filter(pl => !!pl.instrument === instr && match(pl)).forEach(pl => { (by[pl.vendor || 'Other'] = by[pl.vendor || 'Other'] || []).push(pl); });
      return by;
    };
    [[true, '🎹 Instruments'], [false, '🎛 Effects']].forEach(([instr, title]) => {
      const by = groupsOf(instr);
      const vendors = Object.keys(by).sort();
      if (!vendors.length) return;
      list.appendChild(el('div', { class: 'plg-title' }, title));
      vendors.forEach(v => list.appendChild(ui.group(v, instr ? '🎹' : '🎛', by[v].map(pl => ui.item({
        key: 'plg:' + pl.format + ':' + pl.uid, name: pl.name, source: pl.format,
        help: pl.name + ' (' + pl.format + (pl.vendor ? ', ' + pl.vendor : '') + (pl.category ? ' · ' + pl.category : '') + ') — ' + (instr ? 'double-click = instrument of the selected track (or a new track) · drag onto a track / empty space' : 'double-click = add to the selected track'),
        payload: Object.assign({ kind: 'plugin' }, pl),
        apply: () => instr ? D.useInstrument(pl, SDAW.store.sel.trackId) : D.addEffect(pl)
      })))));
    });
    if (D.failed) list.appendChild(el('div', { class: 'lib-hint small', 'data-help': (D.failedList || []).map(f => f.path + ': ' + f.error).join('\n') }, '⚠ ' + D.failed + ' plugin file(s) could not be loaded (hover for details).'));
  };

  /** Drop of a plugin from the Library (arrange) */
  D.drop = function (p, track) {
    if (p.instrument) D.useInstrument(p, track ? track.id : null);
    else D.addEffect(p, track ? track.id : null);
  };

  /* -------------------------------------------- Inspector → Plugins --- */
  D.inspectorRows = function (t) {
    const s = SDAW.store, rows = [];
    const instruments = D.plugins.filter(p => p.instrument), effects = D.plugins.filter(p => !p.instrument);
    const pick = (list, label, onPick) => el('select', { onchange: e => { const pl = list[+e.target.value]; e.target.value = ''; if (pl) onPick(pl); } },
      [el('option', { value: '' }, label)].concat(list.map((p, i) => el('option', { value: i }, p.name + (p.vendor ? ' — ' + p.vendor : '')))));
    if (!t.plugin) {
      rows.push(el('div', { class: 'insp-row' }, [el('span', {}, 'Instrument'), pick(instruments, 'Built-in sound — choose a plugin…', pl => D.useInstrument(pl, t.id))]));
      rows.push(el('div', { class: 'st-note' }, 'A plugin instrument replaces the built-in sound of this track. Then you can add plugin effects after it.'));
      return rows;
    }
    const slotRow = (slot, p) => {
      const loaded = !!D.loaded[D.num(t) + ':' + slot];
      return el('div', { class: 'insp-row plg-slot' + (p.bypass ? ' bypassed' : '') }, [
        el('span', { class: 'plg-name', title: p.format + ' · ' + p.path }, (slot === 0 ? '🎹 ' : slot + '. ') + p.name + (loaded ? '' : p._error ? ' ⚠' : ' …')),
        el('button', { class: 'btn small', 'data-help': 'Open the plugin window', onclick: () => D.openEditor(t, slot) }, 'Edit'),
        slot ? el('button', { class: 'chip-btn' + (p.bypass ? '' : ' on'), 'data-help': 'On / bypass', onclick: () => s.mutate('Bypass plugin', () => { p.bypass = !p.bypass; }) }, p.bypass ? 'Off' : 'On') : null,
        slot > 1 ? el('button', { class: 'btn small', 'data-help': 'Move up in the chain', onclick: () => s.mutate('Move plugin', () => { const a = t.pluginFx; [a[slot - 2], a[slot - 1]] = [a[slot - 1], a[slot - 2]]; }) }, '↑') : null,
        el('button', { class: 'btn small', 'data-help': slot ? 'Remove this effect' : 'Remove the plugin instrument (back to the built-in sound)', onclick: () => slot ? s.mutate('Remove plugin effect', () => { t.pluginFx.splice(slot - 1, 1); }) : D.removeInstrument(t) }, '✕')
      ]);
    };
    rows.push(slotRow(0, t.plugin));
    (t.pluginFx || []).forEach((p, i) => rows.push(slotRow(i + 1, p)));
    if ((t.pluginFx || []).length < MAX_FX) rows.push(el('div', { class: 'insp-row' }, [el('span', {}, 'Add effect'), pick(effects, 'Choose an effect plugin…', pl => D.addEffect(pl, t.id))]));
    rows.push(el('div', { class: 'st-note' }, 'Volume, pan, mute / solo and automation of the track apply to the plugin sound. The built-in Pedalboard is used in exports only — use plugin effects for live sound.'));
    return rows;
  };

  /* ------------------------------------------------------------ export --
   * Called by audio.js renderOffline: events = { trackId: [[sec, key, vel], …] }
   * Returns { trackId: AudioBuffer } rendered by the native engine.       */
  D.renderTracks = async function (events, seconds, decodeCtx) {
    const tracks = Object.keys(events).map(id => ({ track: D.nums[id], id, events: events[id].map(e => [e[0], e[1], e[2], e[3] || 0]) })).filter(x => x.track);
    if (!tracks.length) return {};
    await D.sync();
    const res = await D.call('render', { seconds, tracks: tracks.map(x => ({ track: x.track, events: x.events })) });
    const out = {};
    for (const r of res) {
      const id = tracks.find(x => x.track === r.track).id;
      const ab = await (await fetch(r.url)).arrayBuffer();
      out[id] = await decodeCtx.decodeAudioData(ab);
    }
    return out;
  };

  /* ------------------------------------------------------------- start - */
  D.start = async function () {
    try {
      const info = await D.call('hello');
      D.info = info;
      D.on = true;
      D.plugins = info.plugins || []; D.failed = info.failed || 0;
      D.folders = info.folders || []; D.userFolders = info.userFolders || [];
      document.documentElement.classList.add('desktop');
      if (info.engine) await syncClock();
      setInterval(() => { if (!SDAW.audio.playing) syncClock().catch(() => {}); }, 15000);
      setInterval(() => { D.collectStates().catch(() => {}); }, 120000);
      if (info.startupFile) {
        // the same loader as File → Open (checks, embedded samples, the current project kept on errors)
        try { await SDAW.app.openProjectText(info.startupFile.text, info.startupFile.name); }
        catch (e) { SDAW.toast('⚠ Could not open ' + info.startupFile.name + ': ' + e.message); }
      }
      SDAW.bus.on('change', SDAW.debounce(() => D.sync(), 60));
      D.sync();
      if (SDAW.library) SDAW.library.render();
      if (SDAW.inspector) SDAW.inspector.render();
      if (!info.engine) SDAW.toast('Plugin engine not available: ' + info.engineError);
      else if (!D.plugins.length) setTimeout(() => D.scan(false), 1500);   // first start: look for plugins
    } catch (e) {
      console.warn('desktop bridge', e);
    }
  };
  window.addEventListener('load', () => setTimeout(D.start, 300));
})(window.SDAW);
