/* =============================================================================
 *  SAMPLES.JS — real sound libraries and audio files
 *  -----------------------------------------------------------------------------
 *  1. LIBRARY FOLDERS: "Connect folder…" uses the browser File System Access API
 *     to read sound folders where they already are (no copies), e.g.
 *       ...\LiveReplica\RecursosOriginales\Core Library\Samples
 *       ...\Lemon-Studio\Recursos\FL-Studio-20\Fabrica\Data\Patches
 *     The folder permission is remembered (IndexedDB); after restarting the
 *     browser one click on "Reconnect" grants it again.
 *  2. DECODING: WAV, OGG, MP3, FLAC by the browser + a built-in AIFF/AIFC
 *     decoder (Ableton libraries use .aif).
 *  3. SONG SAMPLES: every sample used in a song (audio clip, drum pad,
 *     sampler zone) is registered in song.samples and its file is stored in
 *     IndexedDB so the project reopens with its sounds. Saved project files
 *     embed the samples (base64).
 *
 *  API used by the rest of the app:
 *    SDAW.samples.importFile(file, name)      -> Promise<sampleId>
 *    SDAW.samples.importLibraryPath(path)     -> Promise<sampleId>
 *    SDAW.samples.buffer(id)                  -> AudioBuffer | null (loads in background)
 *    SDAW.samples.peaks(id)                   -> Float32Array for waveform drawing
 *    SDAW.samples.previewPath(path)           -> plays a library file
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  const AUDIO_EXT = /\.(wav|wave|aif|aiff|aifc|ogg|mp3|flac|m4a)$/i;
  const S = {
    buffers: {},          // sampleId -> AudioBuffer
    peakCache: {},        // sampleId -> Float32Array
    pending: {},          // sampleId -> Promise
    roots: [],            // [{ id, name, handle, granted, scanning, count }]
    files: [],            // [{ name, path, rootId, handle }]  (library index)
    plugins: [],          // [{ name, path, format, rootId }]  VST3 / CLAP found in plugin folders
    byPath: {},           // path -> file entry
    scanned: 0
  };
  SDAW.samples = S;

  /* ================================================== INDEXED DB ==== */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('scoredaw', 2);
      let fresh = false;
      r.onupgradeneeded = (e) => {
        const d = r.result;
        if (e.oldVersion < 1) { d.createObjectStore('samples'); d.createObjectStore('roots'); fresh = true; }
        if (e.oldVersion < 2) d.createObjectStore('meta');            // v2: large autosaves
      };
      r.onsuccess = () => { if (fresh) migrateOldDb(r.result).then(() => res(r.result), () => res(r.result)); else res(r.result); };
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  /**
   * The program was called "Lemon Score Studio": its database 'lemon-score-studio'
   * (imported sounds, folder links, big autosave) is copied once into 'scoredaw'.
   */
  function migrateOldDb(target) {
    return new Promise((done) => {
      const r = indexedDB.open('lemon-score-studio');
      r.onupgradeneeded = (e) => { e.target.transaction.abort(); };      // no old database: do not create it
      r.onerror = () => done();
      r.onsuccess = () => {
        const old = r.result, stores = ['samples', 'roots', 'meta'].filter(n => old.objectStoreNames.contains(n));
        if (!stores.length) { old.close(); done(); return; }
        const rd = old.transaction(stores, 'readonly'), rows = [];
        stores.forEach(n => {
          const cur = rd.objectStore(n).openCursor();
          cur.onsuccess = () => { const c = cur.result; if (c) { rows.push([n, c.key, c.value]); c.continue(); } };
        });
        rd.oncomplete = () => {
          old.close();
          if (!rows.length) { done(); return; }
          const wr = target.transaction(stores, 'readwrite');
          rows.forEach(([n, k, v]) => wr.objectStore(n).put(v, k));
          wr.oncomplete = () => done(); wr.onerror = () => done();
        };
        rd.onerror = () => { old.close(); done(); };
      };
    });
  }

  function idb(store, mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    }));
  }
  const idbPut = (store, key, val) => idb(store, 'readwrite', s => s.put(val, key));
  const idbGet = (store, key) => idb(store, 'readonly', s => s.get(key));
  const idbDel = (store, key) => idb(store, 'readwrite', s => s.delete(key));
  const idbAllKeys = (store) => idb(store, 'readonly', s => s.getAllKeys());
  /** Autosave of projects too large for localStorage */
  S.saveAutosave = json => idbPut('meta', 'autosave', json);
  S.loadAutosave = () => idbGet('meta', 'autosave');

  /* ===================================================== DECODING ==== */
  function ctx() { SDAW.audio.init(); return SDAW.audio.ctx; }

  /** Decode any supported audio file (ArrayBuffer) to an AudioBuffer */
  S.decode = function (ab, name) {
    if (/\.(aif|aiff|aifc)$/i.test(name || '') || isAiff(ab)) {
      try { return Promise.resolve(decodeAiff(ab)); } catch (e) { return Promise.reject(e); }
    }
    return ctx().decodeAudioData(ab.slice(0));
  };

  function isAiff(ab) {
    if (ab.byteLength < 12) return false;
    const v = new DataView(ab);
    return v.getUint32(0) === 0x464f524d && (v.getUint32(8) === 0x41494646 || v.getUint32(8) === 0x41494643);
  }

  /** Minimal AIFF / AIFC (NONE, sowt, fl32) PCM decoder */
  function decodeAiff(ab) {
    const v = new DataView(ab);
    if (v.getUint32(0) !== 0x464f524d) throw new Error('Not an AIFF file');
    const aifc = v.getUint32(8) === 0x41494643;
    let pos = 12, ch = 0, frames = 0, bits = 16, rate = 44100, comp = 'NONE', dataOff = -1;
    while (pos + 8 <= ab.byteLength) {
      const id = String.fromCharCode(v.getUint8(pos), v.getUint8(pos + 1), v.getUint8(pos + 2), v.getUint8(pos + 3));
      const size = v.getUint32(pos + 4);
      const p = pos + 8;
      if (id === 'COMM') {
        ch = v.getInt16(p); frames = v.getUint32(p + 2); bits = v.getInt16(p + 6);
        // 80-bit IEEE extended sample rate
        const exp = v.getUint16(p + 8) & 0x7fff, hi = v.getUint32(p + 10), lo = v.getUint32(p + 14);
        rate = (hi * Math.pow(2, exp - 16383 - 31)) + (lo * Math.pow(2, exp - 16383 - 63));
        if (aifc && size >= 22) comp = String.fromCharCode(v.getUint8(p + 18), v.getUint8(p + 19), v.getUint8(p + 20), v.getUint8(p + 21));
      } else if (id === 'SSND') {
        dataOff = p + 8 + v.getUint32(p);
      }
      pos = p + size + (size % 2);
    }
    if (dataOff < 0 || !ch) throw new Error('AIFF without sound data');
    const c = ctx();
    const buf = c.createBuffer(ch, Math.max(1, frames), Math.round(rate) || 44100);
    const bps = Math.ceil(bits / 8), little = comp === 'sowt', float = comp === 'fl32' || comp === 'FL32';
    const outs = []; for (let k = 0; k < ch; k++) outs.push(buf.getChannelData(k));
    let o = dataOff;
    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < ch; k++) {
        let s = 0;
        if (o + bps > ab.byteLength) break;
        if (float) s = v.getFloat32(o, little);
        else if (bps === 1) s = v.getInt8(o) / 128;
        else if (bps === 2) s = v.getInt16(o, little) / 32768;
        else if (bps === 3) {
          const b0 = v.getUint8(o), b1 = v.getUint8(o + 1), b2 = v.getUint8(o + 2);
          let x = little ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
          if (x & 0x800000) x -= 0x1000000;
          s = x / 8388608;
        } else if (bps === 4) s = v.getInt32(o, little) / 2147483648;
        outs[k][f] = s;
        o += bps;
      }
    }
    return buf;
  }

  /* ================================================ SONG SAMPLES ==== */

  /** Guess a root note from a file name ("Piano C3.aif", "Gtr_A#2_v3.wav") */
  S.rootFromName = function (name) {
    const base = name.replace(/\.[^.]+$/, '');
    const m = /(?:^|[^A-Za-z])([A-Ga-g])([#b]?|s) ?(-?\d)(?![\d])/.exec(base);
    if (!m) return null;
    let pc = SDAW.noteIndex(m[1].toUpperCase() + (m[2] === 's' ? '#' : m[2]));
    if (pc < 0) return null;
    const oct = parseInt(m[3], 10);
    return (oct + 1) * 12 + pc;   // C4 = 60
  };

  /** Register a decoded file in the song (call inside store.mutate) */
  function addMeta(id, name, buffer, path) {
    const song = SDAW.store.song;
    song.samples = song.samples || [];
    if (!song.samples.find(x => x.id === id)) {
      song.samples.push({ id, name, path: path || '', duration: buffer ? +buffer.duration.toFixed(3) : 0, root: S.rootFromName(name) });
    }
  }

  /**
   * Import a File / Blob: stores it in IndexedDB, decodes it, returns its id.
   * The sample meta is added to the song by the caller (S.meta(id)).
   */
  S.importFile = async function (file, name, path) {
    name = name || file.name || 'Sample';
    const ab = await file.arrayBuffer();
    const buffer = await S.decode(ab, name);
    const id = SDAW.uid('smp');
    S.buffers[id] = buffer;
    await idbPut('samples', id, { name, type: file.type || '', data: new Blob([ab]) });
    S._lastMeta = { id, name, buffer, path };
    return id;
  };
  /** Add the meta of an imported sample to the current song (inside mutate) */
  S.addToSong = function (id) {
    const m = S._metaById && S._metaById[id];
    const b = S.buffers[id];
    const sm = (SDAW.store.song.samples || []).find(x => x.id === id);
    if (sm) return sm;
    addMeta(id, m ? m.name : 'Sample', b, m ? m.path : '');
    return SDAW.store.song.samples.find(x => x.id === id);
  };
  S._metaById = {};
  const _imp = S.importFile;
  S.importFile = async function (file, name, path) {
    const id = await _imp(file, name, path);
    S._metaById[id] = { name: name || file.name, path: path || '' };
    return id;
  };

  /** Import a file from a connected library by its path */
  S.importLibraryPath = async function (path) {
    const f = S.byPath[path];
    if (!f) throw new Error('File not found in the connected libraries: ' + path);
    const file = await f.handle.getFile();
    return S.importFile(file, f.name, path);
  };

  /** AudioBuffer of a song sample (null while loading; loads it in background) */
  S.buffer = function (id) {
    if (!id) return null;
    if (id.startsWith('fac:')) return SDAW.factory.buffer(id);     // sounds included with the program
    if (S.buffers[id]) return S.buffers[id];
    if (!S.pending[id]) {
      S.pending[id] = idbGet('samples', id).then(rec => {
        if (!rec) throw new Error('missing');
        return rec.data.arrayBuffer().then(ab => S.decode(ab, rec.name));
      }).then(buf => { S.buffers[id] = buf; SDAW.bus.emit('samplesLoaded', id); return buf; })
        .catch(() => { S.buffers[id] = null; });
    }
    return null;
  };

  /** Waveform peaks (512 points) for drawing */
  S.peaks = function (id) {
    if (S.peakCache[id]) return S.peakCache[id];
    const b = S.buffer(id); if (!b) return null;
    const N = 512, d = b.getChannelData(0), step = Math.max(1, Math.floor(d.length / N)), out = new Float32Array(N);
    for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 4) m = Math.max(m, Math.abs(d[j])); out[i] = m; }
    S.peakCache[id] = out;
    return out;
  };

  /** Preload every sample of the song (after opening a project) */
  S.preloadSong = function (song) { (song.samples || []).forEach(sm => S.buffer(sm.id)); };

  /** Embed samples (base64) for saving a portable project file */
  /**
   * The samples to embed in a saved project: { list: [{ id, name, b64 }], missing: [names] }.
   * Sounds included with the program (factory, 'fac:…') are not embedded (every ScoreDAW has
   * them); a recorded / imported sample that is no longer in the database is listed as missing.
   */
  S.exportForSave = async function (song) {
    const out = [], missing = [];
    for (const sm of (song.samples || [])) {
      if (sm.factory || String(sm.id).startsWith('fac:')) continue;
      const rec = await idbGet('samples', sm.id);
      if (!rec) { missing.push(sm.name || sm.id); continue; }
      const ab = await rec.data.arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      out.push({ id: sm.id, name: rec.name, b64: btoa(bin) });
    }
    return { list: out, missing };
  };
  /** Restore embedded samples when opening a project file */
  S.importEmbedded = async function (list) {
    for (const it of (list || [])) {
      const bin = atob(it.b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await idbPut('samples', it.id, { name: it.name, data: new Blob([bytes]) });
      delete S.buffers[it.id]; delete S.pending[it.id]; delete S.peakCache[it.id];
    }
  };

  /* ============================================== LIBRARY FOLDERS ==== */

  S.canConnect = () => typeof window.showDirectoryPicker === 'function';

  /** Ask the user for a folder and index it */
  /**
   * Ask the user for a folder and index it.
   *   kind: 'sounds' (samples / loops / one-shots / multisamples)
   *         'plugins' (VST3 / CLAP instruments and effects)
   */
  S.connectFolder = async function (kind) {
    kind = kind || 'sounds';
    if (!S.canConnect()) { S.connectFolderFallback(); return; }
    let handle;
    try { handle = await window.showDirectoryPicker({ id: 'scoredaw-' + kind, mode: 'read' }); }
    catch (e) { return; }  // cancelled
    const root = { id: SDAW.uid('root'), name: handle.name, handle, granted: true, count: 0, kind };
    S.roots.push(root);
    try { await idbPut('roots', root.id, { name: root.name, handle, kind }); } catch (e) { /* handles not storable */ }
    await scanRoot(root);
  };

  /** Fallback for browsers without showDirectoryPicker: <input webkitdirectory> (this session only) */
  S.connectFolderFallback = function () {
    const inp = SDAW.el('input', { type: 'file', webkitdirectory: true, multiple: true, style: { display: 'none' } });
    inp.addEventListener('change', () => {
      const files = Array.from(inp.files).filter(f => AUDIO_EXT.test(f.name));
      if (!files.length) return;
      const rootName = (files[0].webkitRelativePath || files[0].name).split('/')[0];
      const root = { id: SDAW.uid('root'), name: rootName, handle: null, granted: true, count: files.length, temp: true };
      S.roots.push(root);
      files.forEach(f => addFile(root, f.webkitRelativePath || f.name, { getFile: async () => f }));
      SDAW.bus.emit('libraryIndex', {});
      inp.remove();
    });
    document.body.appendChild(inp); inp.click();
  };

  function addFile(root, relPath, handle) {
    const path = root.name + '/' + relPath.split('/').slice(relPath.startsWith(root.name + '/') ? 1 : 0).join('/');
    if (S.byPath[path]) return;
    const e = { name: path.split('/').pop(), path, rootId: root.id, handle };
    S.files.push(e); S.byPath[path] = e; root.count++;
  }

  async function scanRoot(root) {
    root.scanning = true; root.count = 0;
    S.plugins = S.plugins.filter(f => f.rootId !== root.id);
    SDAW.bus.emit('libraryIndex', { root });
    root.plugins = 0;
    const walk = async (dir, rel) => {
      for await (const [name, h] of dir.entries()) {
        if (/\.(vst3|clap)$/i.test(name) || (h.kind === 'file' && /\.dll$/i.test(name) && root.kind === 'plugins')) {
          S.plugins.push({ name: name.replace(/\.(vst3|clap|dll)$/i, ''), path: root.name + '/' + rel + name, format: (name.split('.').pop() || '').toUpperCase(), rootId: root.id });
          root.plugins++;
          continue;                                    // a .vst3 bundle is a folder: do not walk inside
        }
        if (h.kind === 'directory') await walk(h, rel + name + '/');
        else if (AUDIO_EXT.test(name)) {
          addFile(root, rel + name, h);
          if (root.count % 400 === 0) SDAW.bus.emit('libraryIndex', { root, progress: true });
        }
      }
    };
    try { await walk(root.handle, ''); }
    catch (e) { SDAW.toast('Could not read the folder: ' + e.message); }
    root.scanning = false;
    SDAW.bus.emit('libraryIndex', { root, done: true });
    SDAW.toast('Library "' + root.name + '": ' + root.count + ' sounds' + (root.plugins ? ', ' + root.plugins + ' plugins' : '') + ' indexed');
  }

  /** Restore remembered folders at start (permission may need a click) */
  S.restoreRoots = async function () {
    try {
      const keys = await idbAllKeys('roots');
      for (const k of keys) {
        const rec = await idbGet('roots', k);
        if (!rec || !rec.handle) continue;
        const root = { id: k, name: rec.name, handle: rec.handle, granted: false, count: 0, kind: rec.kind || 'sounds' };
        S.roots.push(root);
        try { root.granted = (await rec.handle.queryPermission({ mode: 'read' })) === 'granted'; } catch (e) { root.granted = false; }
        if (root.granted) scanRoot(root);
      }
      SDAW.bus.emit('libraryIndex', {});
    } catch (e) { /* IndexedDB not available */ }
  };
  S.reconnect = async function (root) {
    try {
      const st = await root.handle.requestPermission({ mode: 'read' });
      root.granted = st === 'granted';
      if (root.granted) await scanRoot(root);
    } catch (e) { SDAW.toast('Permission not granted'); }
  };
  S.removeRoot = async function (root) {
    S.roots = S.roots.filter(r => r !== root);
    S.files = S.files.filter(f => f.rootId !== root.id);
    S.plugins = S.plugins.filter(f => f.rootId !== root.id);
    Object.keys(S.byPath).forEach(p => { if (S.byPath[p].rootId === root.id) delete S.byPath[p]; });
    try { await idbDel('roots', root.id); } catch (e) { /* ignore */ }
    SDAW.bus.emit('libraryIndex', {});
  };

  /** Children of a folder path in the index: { folders:[name], files:[entry] } */
  S.list = function (folderPath) {
    const pre = folderPath ? folderPath + '/' : '';
    const folders = new Set(), files = [];
    for (const f of S.files) {
      if (!f.path.startsWith(pre)) continue;
      const rest = f.path.slice(pre.length);
      const i = rest.indexOf('/');
      if (i < 0) files.push(f); else folders.add(rest.slice(0, i));
    }
    return { folders: [...folders].sort(), files: files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) };
  };
  S.search = function (q, max) {
    q = q.toLowerCase();
    const out = [];
    for (const f of S.files) { if (f.path.toLowerCase().includes(q)) { out.push(f); if (out.length >= (max || 300)) break; } }
    return out;
  };
  S.filesIn = function (folderPath) {
    const pre = folderPath + '/';
    return S.files.filter(f => f.path.startsWith(pre) && f.path.indexOf('/', pre.length) < 0);
  };

  /* ===================================================== PREVIEW ===== */
  let previewSrc = null;
  const decodedCache = new Map();   // path -> AudioBuffer (small LRU)
  S.loadPath = async function (path) {
    if (decodedCache.has(path)) return decodedCache.get(path);
    const f = S.byPath[path]; if (!f) throw new Error('not found');
    const file = await f.handle.getFile();
    const buf = await S.decode(await file.arrayBuffer(), f.name);
    decodedCache.set(path, buf);
    if (decodedCache.size > 40) decodedCache.delete(decodedCache.keys().next().value);
    return buf;
  };
  S.previewPath = async function (path) {
    try {
      const buf = await S.loadPath(path);
      S.playBuffer(buf);
    } catch (e) { SDAW.toast('Cannot play this file: ' + e.message); }
  };
  S.playBuffer = function (buf) {
    const c = ctx();
    if (previewSrc) { try { previewSrc.stop(); } catch (e) { /* ignore */ } }
    previewSrc = c.createBufferSource(); previewSrc.buffer = buf;
    const g = c.createGain(); g.gain.value = 0.9;
    previewSrc.connect(g); g.connect(SDAW.audio.master);
    previewSrc.start();
  };
  S.stopPreview = function () { if (previewSrc) { try { previewSrc.stop(); } catch (e) { /* ignore */ } previewSrc = null; } };

  /* ======================================== BUILDERS (instrument / kit) == */

  /**
   * Build sampler zones from all files of a library folder.
   * Root notes come from the file names; files without a note name are
   * spread chromatically from C3. Returns [{sampleId, root}]
   */
  S.buildInstrumentFromFolder = async function (folderPath, onProgress) {
    let files = S.filesIn(folderPath);
    if (!files.length) throw new Error('No audio files directly inside this folder');
    // keep one file per root note (prefer the middle velocity layer if several)
    const byRoot = {};
    files.forEach((f, i) => {
      const r = S.rootFromName(f.name);
      const key = r === null ? 'x' + i : r;
      (byRoot[key] = byRoot[key] || []).push(f);
    });
    const picks = Object.keys(byRoot).map(k => { const arr = byRoot[k]; return { root: k.startsWith('x') ? null : +k, file: arr[Math.floor(arr.length / 2)] }; }).slice(0, 64);
    let fallback = 48;
    const zones = [];
    for (let i = 0; i < picks.length; i++) {
      const p = picks[i];
      const id = await S.importLibraryPath(p.file.path);
      zones.push({ sampleId: id, root: p.root !== null ? p.root : fallback++ });
      onProgress && onProgress(i + 1, picks.length);
    }
    zones.sort((a, b) => a.root - b.root);
    return zones;
  };

  /** Match drum pad names to files of a folder (kick, snare, hats, toms, clap, perc) */
  S.buildKitFromFolder = async function (folderPath) {
    let files = S.filesIn(folderPath);
    if (!files.length) files = S.files.filter(f => f.path.startsWith(folderPath + '/')).slice(0, 400);
    const rules = {
      kick: /kick|bd|bass ?drum|kik/i, snare: /snare|sd|snr/i, hhc: /(closed|chh|hh ?c|hat(?!.*open))/i, hho: /(open|ohh|hh ?o)/i,
      tom1: /(hi(gh)?.?tom|tom.?(hi|1|h))|conga.*hi|bongo/i, tom2: /(lo(w)?.?tom|floor|tom.?(lo|2|l))|conga.*lo|conga/i,
      clap: /clap|cp/i, perc: /perc|cowbell|rim|shaker|clave|tamb|cabasa|guiro|timbal/i
    };
    const map = {};
    for (const row of Object.keys(rules)) {
      const f = files.find(x => rules[row].test(x.name) && !Object.values(map).some(m => m.path === x.path));
      if (f) map[row] = f;
    }
    const out = {};
    for (const row of Object.keys(map)) out[row] = await S.importLibraryPath(map[row].path);
    return out;
  };

})(window.SDAW);
