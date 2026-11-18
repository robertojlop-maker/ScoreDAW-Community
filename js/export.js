/* =============================================================================
 *  EXPORT.JS — File → Export: audio (WAV / MP3), MIDI, MusicXML, Print / PDF
 *  -----------------------------------------------------------------------------
 *  AUDIO     the song is rendered OFFLINE by the audio engine (audio.js
 *            renderOffline): every instrument, pedalboard, reverb / delay bus,
 *            mixer volume / pan, mute / solo, swing and the repeats / alternate
 *            endings. WAV 16 / 24-bit, or MP3 (LAME encoder, js/lib/lame.min.js).
 *  MIDI      Standard MIDI File type 1 (480 PPQ): a tempo track with key, time
 *            signature and section markers, one track per instrument with its
 *            General MIDI program, volume and pan, drums on channel 10, bends
 *            as pitch-bend. Repeats are unfolded.
 *  MUSICXML  for Guitar Pro, MuseScore, Sibelius, Finale: one part per melodic
 *            track (notation + TAB staff for guitar / bass), voices, ties,
 *            triplets, dynamics, techniques (H, P, slides, bends, harmonics,
 *            vibrato, tap, palm mute, dead / ghost notes, accents, staccato,
 *            strums), chord symbols, sections, repeats and alternate endings.
 *  PRINT     score / tab / score+tab of the chosen tracks in a print page —
 *            choose "Save as PDF" in the print dialog for a PDF.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const BAR = () => SDAW.barTicks();          // bar length of the song (time signature)
  const EX = {};
  SDAW.exporter = EX;

  /* ============================================================ helpers == */
  const fileBase = () => (SDAW.store.song.title || 'song').replace(/[^\w\- ]/g, '').trim() || 'song';
  function download(data, name, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const melodicTracks = () => SDAW.store.song.tracks.filter(t => t.type !== 'drums');
  /** Swing of the song as a delay in ticks (same curve as audio.js swingShift) */
  function swingTicks(pos) {
    const song = SDAW.store.song, sw = song.swing || 0;
    if (!sw) return 0;
    const unit = song.swingGrid === 16 ? 2 : 4, tick = Math.floor(pos + 1e-6), frac = pos - tick;
    const x = (tick % unit) + frac, half = unit / 2, late = sw * unit / 6;
    const y = x < half ? x * (half + late) / half : half + late + (x - half) * (half - late) / half;
    return y - x;
  }
  /** Minimal ZIP writer (stored, no compression) for several files in one download */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  EX.zip = async function (files) {           // files: [{ name, blob }]
    const parts = [], central = []; let offset = 0;
    const enc = new TextEncoder();
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + (b.byteLength || b.length), 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
  };

  /* ============================================================== AUDIO == */
  function peak(buf) { let p = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > p) p = v; } } return p; }
  /** WAV (PCM 16 or 24 bit, interleaved) */
  EX.encodeWav = function (buf, bits, gain) {
    const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length, bps = bits / 8;
    const dataSize = len * ch * bps, out = new DataView(new ArrayBuffer(44 + dataSize));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + dataSize, true); str(8, 'WAVE'); str(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * ch * bps, true); out.setUint16(32, ch * bps, true); out.setUint16(34, bits, true);
    str(36, 'data'); out.setUint32(40, dataSize, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i] * gain));
      if (bits === 16) { out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2; }
      else { const x = Math.round(v < 0 ? v * 0x800000 : v * 0x7FFFFF); out.setUint8(o, x & 255); out.setUint8(o + 1, (x >> 8) & 255); out.setUint8(o + 2, (x >> 16) & 255); o += 3; }
    }
    return new Blob([out.buffer], { type: 'audio/wav' });
  };
  function loadLame() {
    if (window.lamejs) return Promise.resolve();
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'js/lib/lame.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('MP3 encoder missing: js/lib/lame.min.js')); document.head.appendChild(sc); });
  }
  /** MP3 with LAME (async: yields to the interface while encoding) */
  EX.encodeMp3 = async function (buf, kbps, gain, onProgress) {
    await loadLame();
    const sr = buf.sampleRate, enc = new window.lamejs.Mp3Encoder(2, sr, kbps);
    const L = buf.getChannelData(0), Rr = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const block = 1152, parts = [];
    const l16 = new Int16Array(block), r16 = new Int16Array(block);
    for (let i = 0, n = 0; i < L.length; i += block, n++) {
      const m = Math.min(block, L.length - i);
      for (let j = 0; j < m; j++) { const a = Math.max(-1, Math.min(1, L[i + j] * gain)), b = Math.max(-1, Math.min(1, Rr[i + j] * gain)); l16[j] = a < 0 ? a * 0x8000 : a * 0x7FFF; r16[j] = b < 0 ? b * 0x8000 : b * 0x7FFF; }
      const mp3 = enc.encodeBuffer(m === block ? l16 : l16.subarray(0, m), m === block ? r16 : r16.subarray(0, m));
      if (mp3.length) parts.push(new Uint8Array(mp3));
      if (n % 200 === 0) { if (onProgress) onProgress(i / L.length); await new Promise(r => setTimeout(r, 0)); }
    }
    const end = enc.flush(); if (end.length) parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'audio/mpeg' });
  };
  /** One WAV per track (each rendered alone, with its pedals and the shared reverb / delay) in a ZIP */
  EX.exportStems = async function (o, progress) {
    const s = SDAW.store, song = s.song;
    const keep = song.tracks.map(t => ({ t, solo: t.solo, mute: t.mute }));
    const playing = song.tracks.filter(t => !t.mute && t.clips.length);
    const files = [];
    try {
      for (let i = 0; i < playing.length; i++) {
        const tr = playing[i];
        song.tracks.forEach(t => { t.solo = t === tr; });
        const buf = await SDAW.audio.renderOffline({ sampleRate: o.sampleRate, tail: 3, onProgress: p => progress && progress('Stem ' + (i + 1) + '/' + playing.length + ' — ' + tr.name + '…', (i + p) / playing.length) });
        files.push({ name: String(i + 1).padStart(2, '0') + ' ' + tr.name.replace(/[^\w\- ()]/g, '') + '.wav', blob: EX.encodeWav(buf, o.bits || 16, 1) });
      }
    } finally { keep.forEach(k => { k.t.solo = k.solo; k.t.mute = k.mute; }); }
    if (progress) progress('Packing ZIP…', 1);
    const zip = await EX.zip(files);
    download(zip, fileBase() + ' (stems).zip');
    return { count: files.length, size: zip.size };
  };
  EX.exportAudio = async function (o, progress) {
    if (o.stems) return EX.exportStems(o, progress);
    const buf = await SDAW.audio.renderOffline({ sampleRate: o.sampleRate, tail: 3, onProgress: p => progress && progress('Rendering the song…', p) });
    // trim the silent tail (keep reverb decay)
    let gain = 1;
    if (o.normalize) { const p = peak(buf); if (p > 0.0001) gain = Math.pow(10, -1 / 20) / p; }
    let blob;
    if (o.format === 'mp3') blob = await EX.encodeMp3(buf, o.kbps || 256, gain, p => progress && progress('Encoding MP3…', p));
    else { if (progress) progress('Writing WAV…', 1); blob = EX.encodeWav(buf, o.bits || 16, gain); }
    download(blob, fileBase() + '.' + (o.format === 'mp3' ? 'mp3' : 'wav'));
    return { seconds: buf.duration, size: blob.size };
  };

  /* =============================================================== MIDI == */
  /** General MIDI program (0-based) of a track */
  EX.gmProgram = function (t) {
    const n = ((t.instrument || '') + ' ' + t.name).toLowerCase();
    const table = [[/electric piano|\bep\b/, 4], [/clavinet/, 7], [/vibraphone/, 11], [/organ/, 16], [/accordion/, 21], [/harmonica|melodica/, 22], [/piano/, 0],
      [/nylon|classical|requinto|bossa/, 24], [/steel|acoustic|12-string/, 25], [/lead guitar|electric guitar - lead|overdrive/, 29], [/guitar|telecaster|skank|segunda/, 27],
      [/upright bass|baby bass/, 32], [/808|synth bass/, 38], [/pick|slap/, 34], [/bass/, 33],
      [/fiddle|violin/, 40], [/viola/, 41], [/string/, 48], [/pad/, 89], [/trumpet/, 56], [/trombone/, 57], [/alto sax/, 65], [/tenor sax|sax/, 66], [/flute/, 73],
      [/saw lead|hook/, 81], [/square lead/, 80], [/pluck/, 84]];
    for (const [re, p] of table) if (re.test(n)) return p;
    return { guitar: 25, bass: 33, keys: 0, strings: 48, synth: 81 }[t.type] || 0;
  };
  /** General MIDI drum notes of each pad for each kind of percussion track */
  const DRUM_GM = {
    default: { kick: 36, snare: 38, hhc: 42, hho: 46, tom1: 48, tom2: 45, clap: 39, perc: 56, crash: 49, ride: 51 },
    latin: { kick: 36, snare: 38, hhc: 42, hho: 46, tom1: 63, tom2: 64, clap: 39, perc: 56, crash: 49, ride: 51 },
    congas: { tom1: 63, tom2: 64, perc: 62, hhc: 62 }, timbales: { tom1: 65, tom2: 66, perc: 37, ride: 56 }, bongo: { tom1: 60, tom2: 61, perc: 56 },
    clave: { perc: 75 }, guiro: { hhc: 73, hho: 74 }, guira: { hhc: 69, hho: 74 }, tambora: { tom2: 41, tom1: 64, snare: 37 },
    maracas: { hhc: 70 }, shaker: { hhc: 70 }, cowbell: { perc: 56 }
  };
  function drumMapFor(t) {
    const base = /latin/i.test(t.instrument || '') && !t.kit ? DRUM_GM.latin : DRUM_GM.default;
    return Object.assign({}, base, DRUM_GM[t.kit] || {});
  }
  EX.drumMapFor = drumMapFor;
  const vlq = n => { const b = [n & 0x7F]; while ((n >>= 7)) b.unshift((n & 0x7F) | 0x80); return b; };
  function midiTrack(events) {
    events.sort((a, b) => a.t - b.t || a.o - b.o);
    const bytes = []; let last = 0;
    events.forEach(e => { bytes.push(...vlq(Math.max(0, Math.round(e.t - last))), ...e.d); last = Math.round(e.t); });
    bytes.push(0, 0xFF, 0x2F, 0);
    return [0x4D, 0x54, 0x72, 0x6B, (bytes.length >>> 24) & 255, (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255].concat(bytes);
  }
  const textEv = (t, type, str) => { const b = Array.from(String(str)).map(c => { const k = c.charCodeAt(0); return k < 256 ? k : 63; }); return { t, o: 0, d: [0xFF, type, ...vlq(b.length), ...b] }; };   // Latin-1 text (what DAWs read)
  /** Notes of a track in playback order (repeats unfolded) */
  function unfolded(track, order, unfold) {
    const s = SDAW.store, all = s.trackNotes(track), byBar = {};
    all.forEach(n => { const b = Math.floor(n.start / BAR()); (byBar[b] = byBar[b] || []).push(n); });
    const out = [];
    (unfold ? order : order.map((_, i) => i)).forEach((src, j) => (byBar[unfold ? src : j] || []).forEach(n => out.push(Object.assign({}, n, { start: j * BAR() + (n.start - (unfold ? src : j) * BAR()) }))));
    return out;
  }
  function drumHits(track, order, unfold) {
    const s = SDAW.store, hits = [];
    const perBar = {};
    track.clips.forEach(c => {
      if (c.kind !== 'pattern') return;
      const p = s.pattern(c.patternId); if (!p || p.kind !== 'drums') return;
      const L = p.length, o = c.offsetTicks || 0;
      for (let k = 0; k < c.len; k++) SDAW.DRUM_ROWS.forEach(r => { const v = p.drum.rows[r.id][(k + o) % L]; if (v > 0) { const tk = c.start + k, b = Math.floor(tk / BAR()); (perBar[b] = perBar[b] || []).push({ row: r.id, v, off: tk - b * BAR() }); } });
    });
    (unfold ? order : order.map((_, i) => i)).forEach((src, j) => (perBar[src] || []).forEach(h => hits.push({ row: h.row, v: h.v, tick: j * BAR() + h.off })));
    return hits;
  }
  EX.buildMidi = function (o) {
    const s = SDAW.store, song = s.song, PPQ = 480, T16 = PPQ / 4;
    const order = o.unfold ? SDAW.audio.unfoldBars() : [...Array(song.bars).keys()];
    const tracks = [];
    // tempo / meta track
    const meta = [textEv(0, 0x03, song.title || 'Song')];
    const us = Math.round(60000000 / song.tempo);
    meta.push({ t: 0, o: 0, d: [0xFF, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255] });
    { const ts = SDAW.timeSig(); meta.push({ t: 0, o: 0, d: [0xFF, 0x58, 0x04, ts.num, Math.round(Math.log2(ts.den)), SDAW.beatTicks() * 6, 8] }); }   // time signature
    if (song.swing) meta.push(textEv(0, 0x01, 'Swing ' + Math.round(song.swing * 100) + '% (' + (song.swingGrid === 16 ? '16ths' : '8ths') + ') — already applied to the note timing'));
    const FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
    let root = SDAW.noteIndex(song.key); if (song.scale === 'minor') root = (root + 3) % 12;
    const sf = FIFTHS[root];
    meta.push({ t: 0, o: 0, d: [0xFF, 0x59, 0x02, sf & 255, song.scale === 'minor' ? 1 : 0] });
    order.forEach((src, j) => { const sec = (song.sections || []).find(x => x.start === src); if (sec && (j === 0 || order[j - 1] !== src - 1 || true)) meta.push(textEv(j * BAR() * T16, 0x06, sec.name)); });
    tracks.push(midiTrack(meta));
    // instrument tracks
    let chan = 0;
    song.tracks.forEach(t => {
      if (t.type === 'drums' && !o.drums) return;
      const ev = [textEv(0, 0x03, t.name)];
      const isDrum = t.type === 'drums';
      const ch = isDrum ? 9 : chan;
      if (!isDrum) { chan++; if (chan === 9) chan++; if (chan > 15) chan = 0; }
      ev.push({ t: 0, o: 1, d: [0xC0 | ch, isDrum ? 0 : EX.gmProgram(t)] });
      ev.push({ t: 0, o: 1, d: [0xB0 | ch, 7, Math.round(Math.max(0, Math.min(1, t.vol === undefined ? 0.8 : t.vol)) * 127)] });
      ev.push({ t: 0, o: 1, d: [0xB0 | ch, 10, Math.round(((t.pan || 0) + 1) * 63.5)] });
      if (t.mute) ev.push(textEv(0, 0x01, 'muted in the project'));
      // audio blocks cannot travel in MIDI: a marker says where each one starts
      t.clips.filter(c => c.kind === 'audio').forEach(c => {
        const sm = (song.samples || []).find(x => x.id === c.sampleId);
        const bar = Math.floor(c.start / BAR()), j = order.indexOf(bar);
        if (j >= 0) ev.push(textEv((j * BAR() + c.start % BAR()) * T16, 0x06, 'Audio: ' + (sm ? sm.name : 'clip')));
      });
      if (isDrum) {
        const map = drumMapFor(t);
        drumHits(t, order, o.unfold).forEach(h => {
          const note = map[h.row] || DRUM_GM.default[h.row] || 38, at = (h.tick + swingTicks(h.tick)) * T16, vel = Math.max(1, Math.min(127, Math.round(h.v * 120)));
          ev.push({ t: at, o: 3, d: [0x99, note, vel] }, { t: at + T16 / 2, o: 2, d: [0x89, note, 0] });
        });
      } else {
        // bend range ±2 semitones
        ev.push({ t: 0, o: 1, d: [0xB0 | ch, 101, 0] }, { t: 0, o: 1, d: [0xB0 | ch, 100, 0] }, { t: 0, o: 1, d: [0xB0 | ch, 6, 2] }, { t: 0, o: 1, d: [0xB0 | ch, 38, 0] });
        const DYN = { ppp: 30, pp: 45, p: 60, mp: 75, mf: 90, f: 105, ff: 118, fff: 127 };
        const notes = unfolded(t, order, o.unfold).sort((a, b) => a.start - b.start);
        const ends = {};
        notes.forEach(n => {
          const voicePitch = n.pitch + ':' + (n.voice || 0);
          if (n.tie) {
            const prev = ends[voicePitch];
            if (prev && Math.abs(prev.end - (n.start + swingTicks(n.start)) * T16) < 2) {
              prev.ev.t = (n.start + n.dur + swingTicks(n.start)) * T16;
              prev.end = prev.ev.t;
              return;
            }
          }
          const tech = n.tech || {};
          let vel = n.dyn ? DYN[n.dyn] : (n.vel || 90);
          if (tech.accent) vel += 20; if (tech.ghost) vel *= 0.45;
          vel = Math.max(1, Math.min(127, Math.round(vel)));
          const on = (n.start + swingTicks(n.start)) * T16;
          let len = n.dur * T16; if (tech.stacc) len *= 0.5;
          const off = { t: on + Math.max(10, len - 4), o: 2, d: [0x80 | ch, n.pitch, 0] };
          ev.push({ t: on, o: 3, d: [0x90 | ch, n.pitch, vel] }, off);
          ends[voicePitch] = { ev: off, end: on + n.dur * T16 };
          if (tech.bend) {
            const amt = Math.min(2, tech.bend) / 2, top = Math.min(16383, Math.round(8192 + amt * 8191));
            const pb = (t2, v) => ({ t: t2, o: 1, d: [0xE0 | ch, v & 127, (v >> 7) & 127] });
            if (tech.bendType === 'pre' || tech.bendType === 'prerelease') ev.push(pb(on - 1, top)); else ev.push(pb(on + len * 0.2, top));
            if (tech.bendType === 'release' || tech.bendType === 'prerelease') ev.push(pb(on + len * 0.65, 8192));
            ev.push(pb(on + len, 8192));
          }
        });
      }
      tracks.push(midiTrack(ev));
    });
    const head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
    const bytes = head.concat(...tracks);
    return new Uint8Array(bytes);
  };
  EX.exportMidi = function (o) { const data = EX.buildMidi(o); download(new Blob([data], { type: 'audio/midi' }), fileBase() + '.mid'); return data.length; };

  /* =========================================================== MUSICXML == */
  const DIV = 24;                         // divisions per quarter → 1 tick (16th) = 6
  const MD = () => BAR() * 6;             // divisions in one measure (96 in 4/4, 72 in 3/4 / 6/8…)
  const timeXml = () => { const ts = SDAW.timeSig(); return `<time><beats>${ts.num}</beats><beat-type>${ts.den}</beat-type></time>`; };
  const KIND = { '': 'major', m: 'minor', '7': 'dominant', maj7: 'major-seventh', m7: 'minor-seventh', dim: 'diminished', aug: 'augmented', sus2: 'suspended-second', sus4: 'suspended-fourth',
    '6': 'major-sixth', m6: 'minor-sixth', '9': 'dominant-ninth', m9: 'minor-ninth', maj9: 'major-ninth', '13': 'dominant-13th', '7sus4': 'suspended-fourth', m7b5: 'half-diminished', dim7: 'diminished-seventh', '7b9': 'dominant', add9: 'major' };
  const SHARP_SP = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const FLAT_SP = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  /** Split a length (divisions) into note values starting at position t (divisions) */
  function splitDur(t, len) {
    const out = [];
    const plain = [[96, 'whole', 0], [72, 'half', 1], [48, 'half', 0], [36, 'quarter', 1], [24, 'quarter', 0], [18, 'eighth', 1], [12, 'eighth', 0], [9, '16th', 1], [6, '16th', 0], [3, '32nd', 0]];
    const trip = [[16, 'quarter'], [8, 'eighth'], [4, '16th']];
    let guard = 0;
    while (len > 0.5 && guard++ < 64) {
      let pick = null;
      if (len % 3 !== 0 && len % 4 === 0) { const tp = trip.find(([v]) => v <= len); if (tp) pick = { d: tp[0], type: tp[1], dot: 0, tup: true }; }
      if (!pick) for (const [v, type, dot] of plain) {
        const base = dot ? v / 1.5 : v, align = Math.min(base, 24);
        if (v <= len + 0.01 && t % align === 0) { pick = { d: v, type, dot, tup: false }; break; }
      }
      if (!pick) { const v = plain.slice().reverse().find(([x]) => x <= len) || [3, '32nd', 0]; pick = { d: v[0], type: v[1], dot: v[2], tup: false }; }
      out.push(pick); t += pick.d; len -= pick.d;
    }
    return out;
  }
  function chordXml(name, offset) {
    const p = SDAW.parseChord(name); if (!p) return '';
    const m = /^([A-G])([#b]?)/.exec(name);
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    let bass = '';
    const bm = /\/([A-G])([#b]?)$/.exec(name);       // slash chord: C/E
    if (bm) bass = `<bass><bass-step>${bm[1]}</bass-step>${bm[2] ? `<bass-alter>${bm[2] === '#' ? 1 : -1}</bass-alter>` : ''}</bass>`;
    return `<harmony><root><root-step>${m[1]}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ''}</root><kind text="${xmlEsc(p.type)}">${KIND[p.type] || 'major'}</kind>${bass}${offset ? `<offset>${offset}</offset>` : ''}</harmony>`;
  }
  /** One part (track) of the score */
  function partXml(t, pid, o) {
    const s = SDAW.store, song = s.song;
    const isGtr = t.type === 'guitar' || t.type === 'bass';
    const tab = o.tab && isGtr;
    const piano = SDAW.isPianoTrack(t);
    const twoStaves = tab || piano;
    const tuning = t.type === 'bass' ? SDAW.BASS_TUNING : CONFIG.guitar.tuning;
    const nStr = tuning.length;
    // notes that cross a barline are split into tied pieces (one per bar)
    const notes = [];
    s.trackNotes(t).forEach(n => {
      let st = n.start, rest = n.dur, first = true;
      while (rest > 0.001) {
        const barEnd = (Math.floor(st / BAR() + 1e-6) + 1) * BAR(), piece = Math.min(rest, barEnd - st);
        const more = rest - piece > 0.001;
        notes.push(Object.assign({}, n, { start: st, dur: piece, tie: first ? n.tie : true, _tieOut: more, tech: first ? n.tech : {} }));
        st += piece; rest -= piece; first = false;
        if (n.tup) break;                                 // tuplets never cross a barline
      }
    });
    if (t.engine === 'bowed') {
      const previous = new Map();
      notes.forEach(n => {
        const key = n.pitch + ':' + (n.voice || 0), prev = previous.get(key);
        if (n.tie && prev && Math.abs(prev.start + prev.dur - n.start) < .001) prev._tieOut = true;
        previous.set(key, n);
      });
    }
    const avg = notes.length ? notes.reduce((a, n) => a + n.pitch, 0) / notes.length : 60;
    const flats = SDAW.songgen ? SDAW.songgen.prefersFlats(SDAW.noteIndex(song.key), song.scale) : false;
    const SP = flats ? FLAT_SP : SHARP_SP;
    const FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
    let kr = SDAW.noteIndex(song.key); if (song.scale === 'minor') kr = (kr + 3) % 12;
    const clef = t.type === 'bass' ? '<sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change>' : t.type === 'guitar' ? '<sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change>' : (avg < 55 ? '<sign>F</sign><line>4</line>' : '<sign>G</sign><line>2</line>');
    const marks = song.barMarks || {};
    let lastDyn = null;
    const measures = [];
    for (let bar = 0; bar < song.bars; bar++) {
      const t0 = bar * BAR(), m = marks[bar] || {};
      let x = `<measure number="${bar + 1}">`;
      if (bar === 0) {
        x += `<attributes><divisions>${DIV}</divisions><key><fifths>${FIFTHS[kr]}</fifths><mode>${song.scale === 'minor' ? 'minor' : 'major'}</mode></key>${timeXml()}`;
        if (tab) {
          x += `<staves>2</staves><clef number="1">${clef}</clef><clef number="2"><sign>TAB</sign><line>5</line></clef><staff-details number="2"><staff-lines>${nStr}</staff-lines>`;
          tuning.forEach((p, i) => { const [st, al] = SHARP_SP[p % 12]; x += `<staff-tuning line="${i + 1}"><tuning-step>${st}</tuning-step>${al ? `<tuning-alter>${al}</tuning-alter>` : ''}<tuning-octave>${Math.floor(p / 12) - 1}</tuning-octave></staff-tuning>`; });
          x += '</staff-details>';
        } else if (piano) {
          x += '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>';
        } else x += `<clef>${clef}</clef>`;
        x += '</attributes>';
        x += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${song.tempo}</per-minute></metronome></direction-type><sound tempo="${song.tempo}"/></direction>`;
        if (song.swing) {          // swing (MusicXML 4): the notes are written straight and played swung
          const r = Math.max(1.05, 1 + song.swing).toFixed(2);
          x += `<direction placement="above"><direction-type><words>Swing</words></direction-type><sound><swing><first>${Math.round(r * 100)}</first><second>100</second><swing-type>${song.swingGrid === 16 ? '16th' : 'eighth'}</swing-type></swing></sound></direction>`;
        }
      }
      // left barline: repeat start / alternate ending start
      if (m.rs || (m.end && m.end.length)) x += `<barline location="left">${m.rs ? '<bar-style>heavy-light</bar-style><repeat direction="forward"/>' : ''}${m.end && m.end.length ? `<ending number="${m.end.join(',')}" type="start">${m.end.join(', ')}.</ending>` : ''}</barline>`;
      const sec = (song.sections || []).find(z => z.start === bar);
      if (sec) x += `<direction placement="above"><direction-type><rehearsal>${xmlEsc(sec.name)}</rehearsal></direction-type></direction>`;
      if (m.segno) x += '<direction placement="above"><direction-type><segno/></direction-type><sound segno="s1"/></direction>';
      if (m.coda) x += '<direction placement="above"><direction-type><coda/></direction-type><sound coda="c1"/></direction>';
      if (m.text) x += `<direction placement="above"><direction-type><words>${xmlEsc(m.text)}</words></direction-type></direction>`;
      if (o.chords) (song.chords || []).filter(c => c.tick >= t0 && c.tick < t0 + BAR()).forEach(c => { x += chordXml(c.name, Math.round((c.tick - t0) * 6)); });
      // notes of this bar by voice
      const inBar = notes.filter(n => n.start >= t0 - 0.001 && n.start < t0 + BAR() - 0.001);
      const staffBody = (staff) => {
        const staffNotes = piano ? inBar.filter(n => SDAW.pianoStaffForPitch(n.pitch) === staff) : inBar;
        const voices = [...new Set(staffNotes.map(n => n.voice || 0))].sort();
        if (!voices.includes(0)) voices.unshift(0);
        const staffTag = twoStaves ? `<staff>${staff}</staff>` : '';
        const parts = []; let first = true;
        voices.forEach(v => {
          if (!first) parts.push(`<backup><duration>${MD()}</duration></backup>`);
          first = false;
          const vn = staff === 2 ? v + 5 : v + 1;
          const groups = [];
          staffNotes.filter(n => (n.voice || 0) === v).sort((a, b) => a.start - b.start || a.pitch - b.pitch).forEach(n => {
            const st = Math.round((n.start - t0) * 6);
            const g = groups.find(q => q.st === st);
            if (g) g.notes.push(n); else groups.push({ st, notes: [n], tup: !!n.tup, d: Math.round(n.dur * 6) });
          });
          groups.forEach((g, i) => { const nx = groups[i + 1] ? groups[i + 1].st : MD(); g.d = Math.max(1, Math.min(g.d, nx - g.st, MD() - g.st)); });
          let pos = 0, tripCount = 0, prevIdx = null;
          const open = tab && staff === 2 ? '<note print-object="no">' : '<note>';
          const rest = (from, len) => splitDur(from, len).forEach(pc => {
            parts.push(`${open}<rest/><duration>${pc.d}</duration><voice>${vn}</voice><type>${pc.type}</type>${pc.dot ? '<dot/>' : ''}${pc.tup ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : ''}${staffTag}</note>`);
          });
          if (!groups.length) { parts.push(`${open}<rest measure="yes"/><duration>${MD()}</duration><voice>${vn}</voice>${staffTag}</note>`); return; }
          groups.forEach(g => {
            if (g.st > pos) rest(pos, g.st - pos);
            const pieces = g.tup && [4, 8, 16].includes(g.d) ? [{ d: g.d, type: g.d === 4 ? '16th' : g.d === 8 ? 'eighth' : 'quarter', dot: 0, tup: true }] : splitDur(g.st, g.d);
            pieces.forEach((pc, pi) => {
              const lastPc = pi === pieces.length - 1, firstPc = pi === 0;
              if (pc.tup) tripCount++;
              g.notes.forEach((n, ni) => {
                const tech = n.tech || {};
                const [step, alter] = SP[n.pitch % 12];
                const oct = Math.floor(n.pitch / 12) - 1;
                let nt = '<note>';
                if (ni > 0) nt += '<chord/>';
                nt += `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${oct}</octave></pitch><duration>${pc.d}</duration>`;
                const tieStart = !lastPc || (lastPc && n._tieOut), tieStop = !firstPc || (n.tie && firstPc);
                if (tieStop) nt += '<tie type="stop"/>'; if (tieStart) nt += '<tie type="start"/>';
                nt += `<voice>${vn}</voice><type>${pc.type}</type>${pc.dot ? '<dot/>' : ''}`;
                if (pc.tup) nt += '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
                if (tech.mute) nt += '<notehead>x</notehead>'; else if (tech.ghost) nt += '<notehead parentheses="yes">normal</notehead>';
                nt += staffTag;
                // notations
                let no = '';
                if (tieStop) no += '<tied type="stop"/>'; if (tieStart) no += '<tied type="start"/>';
                if (firstPc && tech.bowSlur === 'start') no += '<slur type="start" number="1"/>';
                if (lastPc && tech.bowSlur === 'stop') no += '<slur type="stop" number="1"/>';
                if (pc.tup && ni === 0) { const k = (tripCount - 1) % 3; if (k === 0) no += '<tuplet type="start" bracket="yes"/>'; if (k === 2) no += '<tuplet type="stop"/>'; }
                if (firstPc) {
                  let tq = '';
                  if (isGtr && n.string !== undefined) tq += `<string>${nStr - n.string}</string><fret>${n.fret}</fret>`;
                  if (tech.h) tq += '<hammer-on type="stop">H</hammer-on>';
                  if (tech.p) tq += '<pull-off type="stop">P</pull-off>';
                  if (tech.bend) tq += `<bend><bend-alter>${tech.bend}</bend-alter>${tech.bendType === 'pre' || tech.bendType === 'prerelease' ? '<pre-bend/>' : ''}${tech.bendType === 'release' || tech.bendType === 'prerelease' ? '<release/>' : ''}</bend>`;
                  if (tech.harm) tq += '<harmonic><natural/></harmonic>';
                  if (tech.aharm) tq += '<harmonic><artificial/></harmonic>';
                  if (tech.tap) tq += '<tap/>';
                  if (tech.pizz) tq += '<other-technical>pizzicato</other-technical>';
                  if (tech.pm) tq += '<other-technical>P.M.</other-technical>';
                  if (tech.ring) tq += '<other-technical>let ring</other-technical>';
                  if (tq) no += `<technical>${tq}</technical>`;
                  let ar = '';
                  if (tech.accent) ar += '<accent/>'; if (tech.stacc) ar += '<staccato/>';
                  // slides into / out of a note: scoop (from below), plop (from above), falloff, doit
                  if (tech.slide === 'inBelow') ar += '<scoop/>'; else if (tech.slide === 'inAbove') ar += '<plop/>';
                  else if (tech.slide === 'outDown') ar += '<falloff/>'; else if (tech.slide === 'outUp') ar += '<doit/>';
                  if (ar) no += `<articulations>${ar}</articulations>`;
                  let orn = '';
                  if (tech.vib || tech.wvib) orn += '<wavy-line type="start"/><wavy-line type="stop"/>';
                  if (tech.trem) orn += '<tremolo type="single">3</tremolo>';
                  if (orn) no += `<ornaments>${orn}</ornaments>`;
                  if (tech.slide && ['shift', 'legato', true].includes(tech.slide)) no += '<slide type="stop" line-type="solid"/>';
                  if (tech.strum && ni === 0) no += `<arpeggiate direction="${tech.strum === 'down' ? 'up' : 'down'}"/>`;
                }
                if (no) nt += `<notations>${no}</notations>`;
                nt += '</note>';
                // hammer-on / pull-off / slide: the START mark goes on the previous note of this voice
                if (firstPc && ni === 0 && prevIdx !== null) {
                  if (tech.h) parts[prevIdx] = addStart(parts[prevIdx], '<hammer-on type="start">H</hammer-on>');
                  if (tech.p) parts[prevIdx] = addStart(parts[prevIdx], '<pull-off type="start">P</pull-off>');
                  if (tech.slide && ['shift', 'legato', true].includes(tech.slide)) parts[prevIdx] = addStartNotation(parts[prevIdx], '<slide type="start" line-type="solid"/>');
                }
                parts.push(nt);
                if (ni === 0 && lastPc) prevIdx = parts.length - 1;
              });
            });
            pos = g.st + g.d;
          });
          if (pos < MD()) rest(pos, MD() - pos);
        });
        return parts.join('');
      };
      // dynamics (staff 1 only, when they change)
      const firstDyn = inBar.find(n => n.dyn);
      if (firstDyn && firstDyn.dyn !== lastDyn) { lastDyn = firstDyn.dyn; x += `<direction placement="below"><direction-type><dynamics><${firstDyn.dyn}/></dynamics></direction-type><offset>${Math.round((firstDyn.start - t0) * 6)}</offset></direction>`; }
      x += staffBody(1);
      if (twoStaves) { x += `<backup><duration>${piano ? MD() : 4 * DIV}</duration></backup>`; x += staffBody(2); }
      // right barline
      if (m.fine) x += '<direction placement="above"><direction-type><words>Fine</words></direction-type><sound fine="yes"/></direction>';
      if (m.tocoda) x += '<direction placement="above"><direction-type><words>To Coda</words></direction-type><direction-type><coda/></direction-type><sound tocoda="c1"/></direction>';
      if (m.jump) { const j = String(m.jump); x += `<direction placement="above"><direction-type><words>${xmlEsc(j)}</words></direction-type><sound ${/S/.test(j.slice(0, 3)) ? 'dalsegno="s1"' : 'dacapo="yes"'}/></direction>`; }
      if (m.re || (m.end && m.end.length) || m.dbl || bar === song.bars - 1) {
        const lastEnding = m.end && m.end.length && !(marks[bar + 1] && marks[bar + 1].end);
        x += `<barline location="right"><bar-style>${m.re ? 'light-heavy' : bar === song.bars - 1 ? 'light-heavy' : m.dbl ? 'light-light' : 'regular'}</bar-style>${m.end && m.end.length ? `<ending number="${m.end.join(',')}" type="${m.re ? 'stop' : (lastEnding ? 'discontinue' : 'stop')}"/>` : ''}${m.re ? `<repeat direction="backward" times="${Math.max(2, m.re | 0)}"/>` : ''}</barline>`;
      }
      x += '</measure>';
      measures.push(x);
    }
    return `<part id="${pid}">${measures.join('')}</part>`;
  }
  /** Add a technical mark (start of H / P) to a serialized note */
  function addStart(noteXml, tag) {
    if (noteXml.includes('<technical>')) return noteXml.replace('<technical>', '<technical>' + tag);
    return addStartNotation(noteXml, `<technical>${tag}</technical>`);
  }
  /** Add a notation (start of a slide) to a serialized note */
  function addStartNotation(noteXml, tag) {
    if (noteXml.includes('<notations>')) return noteXml.replace('<notations>', '<notations>' + tag);
    return noteXml.replace(/<\/note>$/, `<notations>${tag}</notations></note>`);
  }
  /** Percussion part of a drum track (unpitched notes on a 5-line percussion staff) */
  const DRUM_DISPLAY = { kick: ['F', 4, 'normal'], snare: ['C', 5, 'normal'], hhc: ['G', 5, 'x'], hho: ['G', 5, 'circle-x'], tom1: ['E', 5, 'normal'], tom2: ['A', 4, 'normal'],
    clap: ['D', 5, 'x'], perc: ['E', 4, 'triangle'], crash: ['A', 5, 'x'], ride: ['F', 5, 'x'] };
  function drumPartXml(t, pid) {
    const s = SDAW.store, song = s.song, map = drumMapFor(t);
    const hits = drumHits(t, [...Array(song.bars).keys()], false);
    const measures = [];
    for (let bar = 0; bar < song.bars; bar++) {
      const t0 = bar * BAR();
      let x = `<measure number="${bar + 1}">`;
      if (bar === 0) x += `<attributes><divisions>${DIV}</divisions>${timeXml()}<clef><sign>percussion</sign></clef><staff-details><staff-lines>5</staff-lines></staff-details></attributes>`;
      const inBar = hits.filter(h => h.tick >= t0 && h.tick < t0 + BAR());
      const onsets = [...new Set(inBar.map(h => h.tick - t0))].sort((a, b) => a - b);
      if (!onsets.length) { x += `<note><rest measure="yes"/><duration>${MD()}</duration><voice>1</voice></note></measure>`; measures.push(x); continue; }
      let pos = 0;
      const rest = (from, len) => splitDur(from, len).forEach(pc => { x += `<note><rest/><duration>${pc.d}</duration><voice>1</voice><type>${pc.type}</type>${pc.dot ? '<dot/>' : ''}</note>`; });
      onsets.forEach((on, i) => {
        const st = on * 6, nx = (i < onsets.length - 1 ? onsets[i + 1] : BAR()) * 6;
        if (st > pos) rest(pos, st - pos);
        const pc = splitDur(st, Math.min(nx - st, 24))[0];
        inBar.filter(h => h.tick - t0 === on).forEach((h, k) => {
          const [step, oct, head] = DRUM_DISPLAY[h.row] || ['C', 5, 'normal'];
          const inst = pid + '-I' + (map[h.row] || 38);
          x += `<note>${k ? '<chord/>' : ''}<unpitched><display-step>${step}</display-step><display-octave>${oct}</display-octave></unpitched><duration>${pc.d}</duration><instrument id="${inst}"/><voice>1</voice><type>${pc.type}</type>${pc.dot ? '<dot/>' : ''}<stem>up</stem>${head !== 'normal' ? `<notehead>${head}</notehead>` : ''}${h.v >= 0.95 ? '<notations><articulations><accent/></articulations></notations>' : ''}</note>`;
        });
        pos = st + pc.d;
        if (nx > pos) { rest(pos, nx - pos); pos = nx; }
      });
      if (pos < MD()) rest(pos, MD() - pos);
      measures.push(x + '</measure>');
    }
    return `<part id="${pid}">${measures.join('')}</part>`;
  }
  function drumPartList(t, pid) {
    const map = drumMapFor(t), notes = [...new Set(Object.values(map))];
    let x = `<score-part id="${pid}"><part-name>${xmlEsc(t.name)}</part-name>`;
    notes.forEach(n => { x += `<score-instrument id="${pid}-I${n}"><instrument-name>GM ${n}</instrument-name></score-instrument>`; });
    notes.forEach(n => { x += `<midi-instrument id="${pid}-I${n}"><midi-channel>10</midi-channel><midi-unpitched>${n + 1}</midi-unpitched></midi-instrument>`; });
    return x + '</score-part>';
  }
  EX.buildMusicXml = function (o) {
    const song = SDAW.store.song;
    const tracks = melodicTracks().filter(t => !o.tracks || o.tracks.includes(t.id));
    let list = '<part-list>';
    tracks.forEach((t, i) => {
      list += `<score-part id="P${i + 1}"><part-name>${xmlEsc(t.name)}</part-name><score-instrument id="P${i + 1}-I1"><instrument-name>${xmlEsc(t.instrument || t.name)}</instrument-name></score-instrument>` +
        `<midi-instrument id="P${i + 1}-I1"><midi-channel>${(i >= 9 ? i + 2 : i + 1)}</midi-channel><midi-program>${EX.gmProgram(t) + 1}</midi-program><volume>${Math.round((t.vol === undefined ? 0.8 : t.vol) * 100)}</volume><pan>${Math.round((t.pan || 0) * 90)}</pan></midi-instrument></score-part>`;
    });
    const drums = o.drums === false ? [] : SDAW.store.song.tracks.filter(t => t.type === 'drums' && (!o.tracks || o.tracks.includes(t.id)));
    drums.forEach((t, i) => { list += drumPartList(t, 'D' + (i + 1)); });
    list += '</part-list>';
    const parts = tracks.map((t, i) => partXml(t, 'P' + (i + 1), o)).join('') + drums.map((t, i) => drumPartXml(t, 'D' + (i + 1))).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
      `<score-partwise version="4.0"><work><work-title>${xmlEsc(song.title || 'Song')}</work-title></work><identification><encoding><software>${xmlEsc(CONFIG.app.name)}</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>${list}${parts}</score-partwise>`;
  };
  EX.exportMusicXml = function (o) { const x = EX.buildMusicXml(o); download(new Blob([x], { type: 'application/vnd.recordare.musicxml+xml' }), fileBase() + '.musicxml'); return x.length; };

  /* ========================================================= PRINT / PDF == */
  EX.print = function (o) {
    const song = SDAW.store.song;
    const tracks = melodicTracks().filter(t => !o.tracks || o.tracks.includes(t.id));
    if (!tracks.length) return SDAW.toast('Choose at least one melodic track');
    const win = window.open('', '_blank');
    if (!win) return SDAW.toast('The browser blocked the print window — allow pop-ups for this page');
    let defs = '', body = '';
    tracks.forEach((t, ti) => {
      const mode = (t.type === 'guitar' || t.type === 'bass') ? o.mode : 'score';
      const r = SDAW.notation.renderForPrint(t.id, mode, 1060);
      if (!r) return;
      const id = 'trk' + ti;
      defs += `<g id="${id}">${r.inner}</g>`;
      body += `<section class="track${ti ? ' newpage' : ''}">`;
      for (let ln = 0; ln < r.lines; ln++) {
        const y = ln === 0 ? 0 : r.systemTop + ln * r.sysH, h = ln === 0 ? r.systemTop + r.sysH : r.sysH;
        body += `<svg class="sys" viewBox="0 ${y} ${r.width} ${h}" preserveAspectRatio="xMinYMin meet"><use href="#${id}"/></svg>`;
      }
      body += '</section>';
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${xmlEsc(song.title || 'Song')}</title>
<style>@page{size:A4 portrait;margin:12mm}body{margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}.sys{display:block;width:100%;height:auto;break-inside:avoid;page-break-inside:avoid}
.newpage{break-before:page;page-break-before:always}.bar{position:sticky;top:0;background:#f4f2ff;padding:8px 12px;border-bottom:1px solid #ddd;font-size:14px}@media print{.bar{display:none}}</style></head>
<body><div class="bar">Print preview — use <b>Print</b> and choose <b>"Save as PDF"</b> as the printer to get a PDF. <button onclick="print()">🖨 Print / Save as PDF</button></div>
<svg width="0" height="0" style="position:absolute"><defs>${defs}</defs></svg>${body}
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`;
    win.document.open(); win.document.write(html); win.document.close();
    if (['score', 'tab', 'scoretab'].includes(SDAW.app.view)) SDAW.notation.render();
  };

  /* ================================================================= UI == */
  EX.last = { tab: 'audio', format: 'wav', bits: 16, kbps: 256, sampleRate: 44100, normalize: true, drums: true, unfold: true, chords: true, tabStaff: true, mode: 'scoretab' };
  EX.open = function (tab) {
    const { el, $ } = SDAW;
    const o = Object.assign({}, EX.last); if (tab) o.tab = tab;
    const mel = melodicTracks();
    const all = SDAW.store.song.tracks;
    if (!o.tracks) o.tracks = all.map(t => t.id);
    o.tracks = o.tracks.filter(id => all.some(t => t.id === id)); if (!o.tracks.length) o.tracks = all.map(t => t.id);
    const body = el('div', { class: 'ex-body' });
    const close = () => back.remove();
    const TABS = [['audio', '🎧 Audio (WAV / MP3)'], ['midi', '🎹 MIDI'], ['xml', '🎼 MusicXML (Guitar Pro / MuseScore)'], ['print', '🖨 Print / PDF']];
    const tabsEl = el('div', { class: 'st-tabs' });
    function render() {
      tabsEl.innerHTML = '';
      TABS.forEach(([id, l]) => tabsEl.appendChild(el('button', { class: 'st-tab' + (o.tab === id ? ' active' : ''), onclick: () => { o.tab = id; render(); } }, l)));
      body.innerHTML = '';
      const row = (label, ctrl) => el('div', { class: 'st-row ag-row' }, [el('label', {}, label), ctrl, el('span')]);
      const radio = (key, val, label) => el('label', { class: 'ag-check-opt' }, [el('input', { type: 'radio', name: 'ex-' + key, checked: o[key] === val ? true : null, onchange: () => { o[key] = val; render(); } }), label]);
      const check = (key, label) => el('label', { class: 'ag-check-opt' }, [el('input', { type: 'checkbox', checked: o[key] ? true : null, onchange: e => { o[key] = e.target.checked; } }), label]);
      const sel = (key, opts, num) => el('select', { onchange: e => { o[key] = num ? +e.target.value : e.target.value; } }, opts.map(([v, l]) => el('option', { value: v, selected: o[key] === v ? true : null }, l)));
      const trackPick = (withDrums) => el('div', { class: 'ex-tracks' }, (withDrums ? SDAW.store.song.tracks : mel).map(t => el('label', { class: 'ag-check-opt' }, [el('input', { type: 'checkbox', checked: o.tracks.includes(t.id) ? true : null, onchange: e => { o.tracks = e.target.checked ? o.tracks.concat(t.id) : o.tracks.filter(x => x !== t.id); } }), (SDAW.TRACK_ICONS[t.type] || '') + ' ' + t.name])));
      const info = txt => el('div', { class: 'st-note' }, txt);
      const go = (label, fn) => el('button', { class: 'btn primary ag-go ex-go', onclick: fn }, label);
      if (o.tab === 'audio') {
        body.append(
          info('The whole song is rendered with every instrument, pedalboard, reverb / delay, mixer volume and pan, swing, and the repeats / alternate endings. Muted tracks are left out (solo works too).'),
          row('Format', el('div', { class: 'sg-inline' }, [radio('format', 'wav', 'WAV (lossless)'), radio('format', 'mp3', 'MP3')])),
          o.format === 'wav' ? row('Bit depth', sel('bits', [[16, '16-bit (CD)'], [24, '24-bit (studio)']], true)) : row('Quality', sel('kbps', [[128, '128 kbps'], [192, '192 kbps'], [256, '256 kbps'], [320, '320 kbps (best)']], true)),
          row('Sample rate', sel('sampleRate', [[44100, '44.1 kHz'], [48000, '48 kHz']], true)),
          row('Level', check('normalize', 'Normalize to −1 dB (loudest peak)')),
          row('Stems', check('stems', 'One WAV per track (stems) in a ZIP — for mixing in another program')),
          go('🎧 Export ' + (o.stems ? 'stems (ZIP)' : o.format === 'mp3' ? 'MP3' : 'WAV'), runAudio));
      } else if (o.tab === 'midi') {
        body.append(
          info('Standard MIDI File for Cubase, FL Studio, Ableton, Logic, Reaper… One track per instrument with its General MIDI sound, volume and pan; drums and percussion on channel 10; tempo, key and section markers. Sounds and effects are not part of MIDI; bends become pitch-bend.'),
          row('Drums', check('drums', 'Include drum and percussion tracks')),
          row('Repeats', check('unfold', 'Write the repeats and endings out (as they play)')),
          go('🎹 Export MIDI', () => { const n = EX.exportMidi(o); save(); close(); SDAW.toast('MIDI exported (' + Math.round(n / 1024) + ' KB)'); }));
      } else if (o.tab === 'xml') {
        body.append(
          info('Opens in Guitar Pro, MuseScore, Sibelius and Finale with notation + TAB, voices, ties (also across barlines), triplets, dynamics, techniques (hammer-on, pull-off, slides in / out / between notes, bends, harmonics, vibrato, tap, palm mute, dead / ghost notes), chord symbols (also slash chords), sections, repeats, endings, swing, and drums on a percussion staff.'),
          el('div', { class: 'ag-sub' }, 'Tracks'), trackPick(true),
          row('Guitar / bass', check('tabStaff', 'Add a TAB staff under the notation')),
          row('Chords', check('chords', 'Chord symbols above the staff')),
          go('🎼 Export MusicXML', () => { if (!o.tracks.length) return SDAW.toast('Choose at least one track'); const n = EX.exportMusicXml({ tracks: o.tracks, tab: o.tabStaff, chords: o.chords, drums: true }); save(); close(); SDAW.toast('MusicXML exported (' + Math.round(n / 1024) + ' KB) — open it in Guitar Pro or MuseScore'); }));
      } else {
        body.append(
          info('Opens a print page with the score of each chosen track (every track starts on a new page). In the print dialog choose "Save as PDF" to get a PDF file.'),
          el('div', { class: 'ag-sub' }, 'Tracks'), trackPick(),
          row('Guitar / bass', sel('mode', [['scoretab', 'Score + Tab'], ['score', 'Score only'], ['tab', 'Tab only']])),
          go('🖨 Open print view', () => { if (!o.tracks.length) return SDAW.toast('Choose at least one track'); save(); EX.print({ tracks: o.tracks, mode: o.mode }); close(); }));
      }
    }
    function save() { Object.assign(EX.last, o); }
    async function runAudio() {
      save();
      const prog = el('div', { class: 'ex-progress' }, [el('div', { class: 'ex-msg' }, 'Preparing…'), el('div', { class: 'st-meter' }, [el('i')])]);
      body.innerHTML = ''; body.appendChild(prog);
      const set = (msg, p) => { prog.querySelector('.ex-msg').textContent = msg + ' ' + Math.round(p * 100) + '%'; prog.querySelector('i').style.width = Math.round(p * 100) + '%'; };
      try {
        const r = await EX.exportAudio(o, set);
        close();
        if (o.stems) { SDAW.toast(r.count + ' stems exported in a ZIP (' + (r.size / 1048576).toFixed(1) + ' MB)'); return; }
        SDAW.toast((o.format === 'mp3' ? 'MP3' : 'WAV') + ' exported: ' + Math.floor(r.seconds / 60) + ':' + String(Math.round(r.seconds % 60)).padStart(2, '0') + ' · ' + (r.size / 1048576).toFixed(1) + ' MB');
      } catch (e) { console.error(e); SDAW.toast('Export failed: ' + e.message); render(); }
    }
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal st-modal ex-modal' }, [
        el('button', { class: 'close', onclick: close }, '×'),
        el('h2', { style: { margin: '0 0 8px' } }, '⇪ Export'),
        tabsEl, body
      ])
    ]);
    $('#modalRoot').appendChild(back);
    render();
  };

})(window.SDAW);
