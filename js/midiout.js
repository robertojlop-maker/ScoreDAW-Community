/* ===================================================================== *
 *  ScoreDAW — MIDI OUT (per track)
 *  -------------------------------------------------------------------
 *  A track can send its notes to an external synth / sound module / other
 *  program (loopMIDI, IAC…) through Web MIDI:
 *
 *      track.midiOut = { id: '<output port id>', ch: 1..16, local: true|false }
 *
 *    id     the MIDI output port (Settings → MIDI lists them)
 *    ch     MIDI channel (drum tracks default to 10)
 *    local  true  = the built-in sound plays too
 *           false = only the external device sounds
 *
 *  The audio scheduler (audio.js → dispatch) calls MO.note / MO.drum with the
 *  Web Audio time of each note; it is converted to a performance.now()
 *  timestamp so the MIDI messages leave exactly in time (Web MIDI queues
 *  timestamped messages). Offline renders (export) never send MIDI.
 * ===================================================================== */
(function (SDAW) {
  'use strict';

  const MO = SDAW.midiOut = { access: null, used: new Set() };

  /** Ask the browser for MIDI access once (async). Returns the MIDIAccess or null */
  MO.init = async function () {
    if (MO.access || !navigator.requestMIDIAccess) return MO.access;
    try { MO.access = await navigator.requestMIDIAccess(); } catch (e) { MO.access = null; }
    if (MO.access) MO.access.onstatechange = () => { SDAW.bus.emit('midiPorts'); if (SDAW.inspector && SDAW.inspector.render) SDAW.inspector.render(); };
    return MO.access;
  };
  MO.outputs = () => (MO.access ? [...MO.access.outputs.values()] : []);
  MO.port = (id) => (MO.access && id ? MO.access.outputs.get(id) || null : null);
  MO.channelOf = (t) => ((t.midiOut && t.midiOut.ch) || (t.type === 'drums' ? 10 : 1)) - 1 & 15;

  /** Web Audio time -> performance.now() timestamp (ms) */
  function stamp(time) {
    const ctx = SDAW.audio.ctx;
    return performance.now() + Math.max(0, time - ctx.currentTime) * 1000;
  }

  /**
   * Send one note. Returns true when the built-in sound must be silenced
   * (track.midiOut.local === false).
   */
  MO.note = function (t, pitch, vel, time, dur) {
    const mo = t.midiOut;
    if (!mo || !mo.id || SDAW.audio.offline) return false;
    const p = MO.port(mo.id); if (!p) return false;
    const ch = MO.channelOf(t), on = stamp(time), key = pitch & 127;
    const v = Math.max(1, Math.min(127, Math.round(vel || 100)));
    try {
      p.send([0x90 | ch, key, v], on);
      p.send([0x80 | ch, key, 0], on + Math.max(10, dur * 1000 - 2));
    } catch (e) { return false; }
    MO.used.add(mo.id + ':' + ch);
    return mo.local === false;
  };

  /** Drum pad -> General MIDI note (same map as the MIDI export) */
  MO.drum = function (t, row, vel01, time) {
    if (!t.midiOut || !t.midiOut.id) return false;
    const map = SDAW.exporter && SDAW.exporter.drumMapFor ? SDAW.exporter.drumMapFor(t) : {};
    const n = map[row]; if (n === undefined) return false;
    return MO.note(t, n, (vel01 === undefined ? 0.8 : vel01) * 127, time, 0.12);
  };

  /** At play start: program change (GM sound) for every track with a MIDI out */
  MO.start = function () {
    SDAW.store.song.tracks.forEach(t => {
      const mo = t.midiOut; if (!mo || !mo.id || t.type === 'drums' || mo.program === false) return;
      const p = MO.port(mo.id); if (!p) return;
      try { p.send([0xC0 | MO.channelOf(t), SDAW.exporter.gmProgram(t) & 127]); } catch (e) { /* port closed */ }
    });
  };

  /** At stop: cancel queued messages and silence every channel used */
  MO.panic = function () {
    MO.used.forEach(k => {
      const i = k.lastIndexOf(':'), p = MO.port(k.slice(0, i)), ch = +k.slice(i + 1);
      if (!p) return;
      try {
        if (p.clear) p.clear();                     // drop note-offs / ons still queued
        p.send([0xB0 | ch, 123, 0]);                // all notes off
        p.send([0xB0 | ch, 64, 0]);                 // sustain off
      } catch (e) { /* port closed */ }
    });
    MO.used.clear();
  };

  // open MIDI as soon as a project uses it (so the first notes are not lost)
  SDAW.bus.on('change', () => {
    if (!MO.access && SDAW.store.song.tracks.some(t => t.midiOut && t.midiOut.id)) MO.init();
  });
})(window.SDAW);
