/* =============================================================================
 *  FACTORY.JS — real sounds INCLUDED with the program (no folder to connect)
 *  -----------------------------------------------------------------------------
 *  The sound packs are built by tools/build_sound_packs.py from the
 *  LiveReplica (Ableton Core Library) and Lemon-Studio (FL Studio 20)
 *  libraries and live in MyDAW\sounds\:
 *     sounds/index.js          list of every sound / instrument / kit (small)
 *     sounds/packs/<pack>.js    the audio data of one category (loaded on demand)
 *  Plain <script> files are used so everything works by double-clicking
 *  index.html (browsers block fetch() of local files).
 *
 *  Sample ids of factory sounds are 'fac:<id>' and can be used everywhere a
 *  song sample id is used (audio blocks, drum pads, sampler zones).
 *
 *  index.js calls SDAW.factory.setIndex({ sounds:[], instruments:[], kits:[] })
 *     sound      = { id, name, cat, sub, source, pack }
 *     instrument = { id, name, type, source, zones:[{ root, id }] }   (id = sound id)
 *     kit        = { id, name, source, pads: { kick:id, snare:id, ... } }
 *  each pack calls SDAW.factory.addPack('<pack>', { '<id>': '<base64 OGG>' })
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  const F = {
    index: { sounds: [], instruments: [], kits: [] },
    byId: {},            // sound id -> sound
    data: {},            // sound id -> base64 (after its pack loaded)
    buffers: {},         // sound id -> AudioBuffer
    packLoads: {},       // pack name -> Promise
    decoding: {},
    ready: false
  };
  SDAW.factory = F;

  /** Categories shown in the Library, in this order, with the pad they fit */
  F.CATS = [
    { id: 'Kick',       label: 'Kicks',            pad: 'kick',  ico: '🥁' },
    { id: 'Snare',      label: 'Snares',           pad: 'snare', ico: '🥁' },
    { id: 'HihatClosed',label: 'Hi-Hats Closed',   pad: 'hhc',   ico: '🔔' },
    { id: 'HihatOpen',  label: 'Hi-Hats Open',     pad: 'hho',   ico: '🔔' },
    { id: 'Clap',       label: 'Claps',            pad: 'clap',  ico: '👏' },
    { id: 'Tom',        label: 'Toms',             pad: 'tom1',  ico: '🥁' },
    { id: 'Crash',      label: 'Crash / Cymbals',  pad: 'crash', ico: '💥' },
    { id: 'Ride',       label: 'Rides',            pad: 'ride',  ico: '🛎️' },
    { id: 'Rim',        label: 'Rimshots',         pad: 'perc',  ico: '🪵' },
    { id: 'Conga',      label: 'Congas',           pad: 'tom1',  ico: '🪘' },
    { id: 'Bongo',      label: 'Bongos',           pad: 'tom1',  ico: '🪘' },
    { id: 'Timbales',   label: 'Timbales',         pad: 'perc',  ico: '🪘' },
    { id: 'Bell',       label: 'Bells / Cowbells', pad: 'perc',  ico: '🔔' },
    { id: 'Shaker',     label: 'Shakers / Maracas',pad: 'perc',  ico: '🎶' },
    { id: 'Tambourine', label: 'Tambourines',      pad: 'perc',  ico: '🎶' },
    { id: 'Wood',       label: 'Claves / Wood / Güiro', pad: 'perc', ico: '🪵' },
    { id: 'Perc',       label: 'Other Percussion', pad: 'perc',  ico: '🎶' },
    { id: 'FX',         label: 'FX Hits',          pad: 'perc',  ico: '✨' }
  ];
  F.catById = (id) => F.CATS.find(c => c.id === id) || { id, label: id, pad: 'perc', ico: '🎵' };

  /** Pad for a sound (low toms / low congas go to Tom 2) */
  F.padFor = function (snd) {
    const c = F.catById(snd.cat);
    if ((c.id === 'Tom' || c.id === 'Conga' || c.id === 'Bongo') && /low|floor|lo\b|bass/i.test(snd.name)) return 'tom2';
    return c.pad;
  };

  /* ------------------------------------------------------- loading --- */
  F.setIndex = function (idx) {
    F.index = { sounds: idx.sounds || [], instruments: idx.instruments || [], kits: idx.kits || [] };
    F.byId = {};
    F.index.sounds.forEach(s => { F.byId[s.id] = s; });
    F.ready = true;
    if (SDAW.bus) SDAW.bus.emit('factoryIndex', {});
  };
  F.addPack = function (name, map) {
    Object.assign(F.data, map);
    const r = F.packLoads[name] && F.packLoads[name]._resolve;
    if (r) r();
  };
  F.hasSounds = () => F.index.sounds.length > 0;

  /** Load the pack script that contains a sound */
  function loadPack(pack) {
    if (F.packLoads[pack]) return F.packLoads[pack];
    let res, rej;
    const p = new Promise((a, b) => { res = a; rej = b; });
    p._resolve = res;
    F.packLoads[pack] = p;
    const sc = document.createElement('script');
    sc.src = 'sounds/packs/' + pack + '.js';
    sc.onerror = () => { delete F.packLoads[pack]; rej(new Error('Sound pack missing: sounds/packs/' + pack + '.js')); };
    document.head.appendChild(sc);
    return p;
  }

  function b64ToBuf(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  /** Promise<AudioBuffer> of a factory sound id (without 'fac:') */
  F.load = async function (id) {
    if (F.buffers[id]) return F.buffers[id];
    if (F.decoding[id]) return F.decoding[id];
    const snd = F.byId[id];
    if (!snd) throw new Error('Unknown factory sound ' + id);
    F.decoding[id] = (async () => {
      if (!F.data[id]) await loadPack(snd.pack);
      SDAW.audio.init();
      const buf = await SDAW.audio.ctx.decodeAudioData(b64ToBuf(F.data[id]));
      F.buffers[id] = buf;
      SDAW.bus.emit('samplesLoaded', 'fac:' + id);
      return buf;
    })();
    return F.decoding[id];
  };

  /** Synchronous lookup used by the audio engine (null while loading) */
  F.buffer = function (facId) {
    const id = facId.slice(4);
    if (F.buffers[id]) return F.buffers[id];
    F.load(id).catch(() => { /* missing pack */ });
    return null;
  };

  F.preview = async function (id) {
    try { const b = await F.load(id); SDAW.samples.playBuffer(b); }
    catch (e) { SDAW.toast(e.message); }
  };

  /** Register a factory sound in the song (inside store.mutate) and return its sample id */
  F.addToSong = function (id) {
    const sid = 'fac:' + id, song = SDAW.store.song, snd = F.byId[id];
    song.samples = song.samples || [];
    if (!song.samples.find(x => x.id === sid)) {
      const b = F.buffers[id];
      song.samples.push({ id: sid, name: snd ? snd.name : id, path: 'factory', duration: b ? +b.duration.toFixed(3) : 0, root: null, factory: true });
    }
    return sid;
  };

  /* ---------------------------------------------------- actions --- */

  /** Put a factory sound on a drum pad of a drum track */
  F.assignToPad = async function (id, track, padId) {
    const s = SDAW.store;
    track = track || (s.selTrack() && s.selTrack().type === 'drums' ? s.selTrack() : s.song.tracks.find(t => t.type === 'drums'));
    if (!track) return SDAW.toast('Add a drum track first');
    const snd = F.byId[id];
    padId = padId || F.padFor(snd);
    try { await F.load(id); } catch (e) { return SDAW.toast(e.message); }
    s.mutate('Pad sound', () => { const sid = F.addToSong(id); track.drumMap[padId] = sid; track.source = 'Real samples'; });
    SDAW.audio.previewDrum(track, padId);
    const row = SDAW.DRUM_ROWS.find(r => r.id === padId);
    SDAW.toast((row ? row.name : padId) + ' now plays "' + snd.name + '"');
  };

  /** Apply a whole kit to a drum track */
  F.applyKit = async function (kitId, track) {
    const s = SDAW.store, kit = F.index.kits.find(k => k.id === kitId);
    track = track || (s.selTrack() && s.selTrack().type === 'drums' ? s.selTrack() : s.song.tracks.find(t => t.type === 'drums'));
    if (!kit) return;
    if (!track) return SDAW.toast('Add a drum track first');
    SDAW.toast('Loading kit "' + kit.name + '"…');
    try { await Promise.all(Object.values(kit.pads).map(id => F.load(id))); } catch (e) { return SDAW.toast(e.message); }
    s.mutate('Drum kit', () => {
      Object.keys(kit.pads).forEach(pad => { track.drumMap[pad] = F.addToSong(kit.pads[pad]); });
      track.instrument = kit.name; track.source = 'Real samples';
    });
    SDAW.toast('Kit "' + kit.name + '" loaded on ' + track.name);
  };

  /** Apply a multisample instrument to a melodic track */
  F.applyInstrument = async function (instId, track) {
    const s = SDAW.store, inst = F.index.instruments.find(i => i.id === instId);
    if (!inst) return;
    track = track || s.selTrack();
    if (!track || track.type === 'drums') {
      // no melodic track selected: create one
      const base = SDAW.findInstrument(null, inst.type || 'keys');
      track = SDAW.addTrackFromInstrument(base);
    }
    SDAW.toast('Loading "' + inst.name + '" (' + inst.zones.length + ' samples)…');
    try { await Promise.all(inst.zones.map(z => F.load(z.id))); } catch (e) { return SDAW.toast(e.message); }
    s.mutate('Instrument ' + inst.name, () => {
      track.sampler = { zones: inst.zones.map(z => ({ sampleId: F.addToSong(z.id), root: z.root })) };
      track.instrument = inst.name; track.source = 'Real samples';
    });
    SDAW.toast('"' + track.name + '" now plays ' + inst.name + ' (real samples)');
  };

  /* ------------------------------------------- generic payload resolve -- */
  /**
   * Turn any dragged sound into a song sample id:
   *   { factoryId } | { sampleId } | { path } (connected folder) | File
   */
  SDAW.resolveSample = async function (p) {
    if (p instanceof File) return SDAW.samples.importFile(p, p.name);
    if (p.factoryId) { await F.load(p.factoryId); let sid; sid = 'fac:' + p.factoryId; return sid; }
    if (p.sampleId) return p.sampleId;
    if (p.path) return SDAW.samples.importLibraryPath(p.path);
    if (p.files && p.files[0]) return SDAW.samples.importFile(p.files[0], p.files[0].name);
    throw new Error('Unknown sound');
  };
  /** Add the meta of a resolved id to the song (inside mutate) */
  SDAW.registerSample = function (sid) {
    if (sid.startsWith('fac:')) return F.addToSong(sid.slice(4));
    SDAW.samples.addToSong(sid);
    return sid;
  };

})(window.SDAW);
