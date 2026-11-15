/* ===================================================================== *
 *  ScoreDAW — RECORDING STUDIO (record → edit → insert into the song)
 *  -------------------------------------------------------------------
 *  A panel (Arrange toolbar → "🎙 Record Audio", or right-click a track →
 *  "Record audio here…") to record from any input of the PC — microphone,
 *  guitar / line input of an audio interface, USB mic…:
 *
 *    1. INPUT    choose the device and the channels (stereo, input 1 / left,
 *                input 2 / right, or both mixed to mono), input gain, live
 *                level meter with peak hold and clip light, monitoring.
 *    2. RECORD   free (no song) or along with the song from a bar, with a
 *                count-in and an optional click. Latency is compensated as
 *                in recorder.js (output + input latency + manual offset from
 *                Settings → Audio).
 *    3. EDIT     waveform editor: select, cut / copy / paste, delete, keep
 *                only the selection (trim), silence, insert silence, fades,
 *                normalize, gain, undo / redo; record more and ADD it at the
 *                end, at the cursor or over the selection. Every recording is
 *                a take of the list (rename, duplicate, delete).
 *    4. INSERT   put the take into the song on a new audio track or an
 *                existing track, at the song cursor, at a bar / beat, or
 *                where it was recorded — or save it as a WAV file.
 *
 *  The takes live in memory until ScoreDAW is closed: once inserted they are
 *  samples of the project (saved with it, like any recorded / imported sound).
 *
 *  The other recorder (recorder.js: arm a track with 🎙 and press Record) keeps
 *  working; both use the input chosen here / in Settings → Audio.
 *
 *  Capture uses a ScriptProcessor (like recorder.js): it also works when the
 *  program is opened from file:// (an AudioWorklet module would need a server).
 * ===================================================================== */
(function (SDAW) {
  'use strict';

  /* =========================================================== CONFIG ==== */
  const RC = {
    bufferSize: 4096,            // ScriptProcessor block (frames)
    maxMinutes: 30,              // a recording stops by itself after this long (memory safety)
    wavBits: 24,                 // bits of the WAV that goes into the project / is saved
    undoMB: 400,                 // memory for the editor's undo steps (oldest steps are dropped)
    undoSteps: 40,
    meterFloorDb: -60,           // bottom of the level meters
    peakHoldMs: 1500,
    clipDb: -0.3,                // above this the clip light turns on (latched until clicked)
    normalizeDb: -1,             // target of Normalize (dBFS)
    defaultFadeSec: 0.5,         // fade length when nothing is selected
    countInOptions: [0, 1, 2],   // bars of count-in
    defaultCountIn: 1,
    clickFreq: [1600, 1000],     // count-in / click: first beat of the bar, other beats
    clickVolume: 0.35,
    zoomMin: 4,                  // pixels per second
    zoomMax: 6000,
    waveHeight: 230,             // px of the waveform view
    rulerH: 20,
    colors: {
      bg: 'rgba(8, 10, 28, .85)', grid: 'rgba(150, 130, 255, .14)', ruler: '#9a9cc8',
      wave: '#22e0ff', waveRec: '#ff3b5c', center: 'rgba(34, 224, 255, .25)',
      sel: 'rgba(155, 92, 255, .30)', selEdge: '#c9a8ff', cursor: '#ffd23f', play: '#2bff88'
    }
  };

  const RS = SDAW.recStudio = {
    CONFIG: RC,
    takes: [],                   // { id, name, sr, L, R, stereo, origin (song tick of sample 0 or null), undo:[], redo:[] }
    cur: -1,                     // index of the take in the editor
    clipboard: null,             // { L, R }
    sel: null,                   // { a, b } seconds (a < b) or null
    cursor: 0,                   // seconds
    pps: 100,                    // zoom: pixels per second (0 = fit on the next draw)
    input: { deviceId: '', mode: 'auto', gainDb: 0, monitor: false },
    rec: null,                   // the recording in progress
    play: null,                  // the preview in progress
    opts: { where: 'free', countIn: RC.defaultCountIn, click: true, fromBar: 1, fromCursor: true, merge: 'new' },
    ins: { track: 'new', at: 'cursor', bar: 1, beat: 1 },
    count: 0
  };

  /* ===================================================== SMALL HELPERS ==== */
  const db2g = db => Math.pow(10, db / 20);
  const g2db = g => g > 0 ? 20 * Math.log10(g) : -Infinity;
  const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); };
  function cat(...arrs) { let n = 0; arrs.forEach(a => { n += a.length; }); const o = new Float32Array(n); let p = 0; arrs.forEach(a => { o.set(a, p); p += a.length; }); return o; }
  const ctx = () => { SDAW.audio.init(); return SDAW.audio.ctx; };
  const take = () => RS.takes[RS.cur] || null;
  const dur = t => t ? t.L.length / t.sr : 0;
  const tickDur = () => SDAW.audio.tickDur();
  function isStereo(L, R) { if (L === R) return false; const n = L.length, step = Math.max(1, Math.floor(n / 20000)); for (let i = 0; i < n; i += step) if (Math.abs(L[i] - R[i]) > 1e-4) return true; return false; }

  /* ======================================= CAPTURE ON THE AUDIO THREAD ==== */
  /**
   * The capture runs in an AudioWorklet (the audio thread): every block carries the exact frame number
   * of its first sample, and nothing is lost or shifted when the program is busy (measured with the old
   * ScriptProcessor: up to 400 ms of error after a busy moment). The module is loaded from a Blob, so it
   * also works when ScoreDAW is opened from file://. Without AudioWorklet the ScriptProcessor + clock
   * channel is used instead.
   */
  const WORKLET = `
    class RsCapture extends AudioWorkletProcessor {
      constructor() { super(); this.on = false; this.n = 0; this.size = ${'${RC_BLOCK}'}; this.L = null; this.R = null; this.f0 = 0;
        this.port.onmessage = e => { if (e.data.on) { this.on = true; this.n = 0; } else { this.flush(); this.on = false; this.port.postMessage({ done: true }); } }; }
      flush() { if (this.n) { this.port.postMessage({ f: this.f0, L: this.L.subarray(0, this.n), R: this.R.subarray(0, this.n) }); } this.n = 0; }
      process(inputs) {
        const inp = inputs[0];
        if (this.on && inp && inp.length) {
          const a = inp[0], b = inp[1] || inp[0], m = a.length;
          if (!this.n) { this.L = new Float32Array(this.size); this.R = new Float32Array(this.size); this.f0 = currentFrame; }
          this.L.set(a, this.n); this.R.set(b, this.n); this.n += m;
          if (this.n + m > this.size) this.flush();
        }
        return true;
      }
    }
    registerProcessor('rs-capture', RsCapture);`;
  async function workletReady(c) {
    if (c._rsWorklet !== undefined) return c._rsWorklet;
    c._rsWorklet = false;
    try {
      if (!c.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
      const url = URL.createObjectURL(new Blob([WORKLET.replace('${RC_BLOCK}', RC.bufferSize)], { type: 'application/javascript' }));
      await c.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      c._rsWorklet = true;
    } catch (e) { console.warn('Recording Studio: AudioWorklet not available, using ScriptProcessor', e); }
    return c._rsWorklet;
  }

  // shared with recorder.js (the track recorder: 🎙 arm + ● Record)
  RS.workletReady = workletReady;
  RS.captureNode = c => new AudioWorkletNode(c, 'rs-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit' });

  /* ================================================== INPUT (DEVICE) ==== */
  /**
   * Opens the chosen input and builds:  stream → splitter → (channel routing) → merger
   *   → input gain → analysers L/R (meters) + capture processor + monitor gain → speakers
   */
  RS.openInput = async function () {
    RS.closeInput();
    const c = ctx();
    if (c.state === 'suspended') { try { await c.resume(); } catch (e) { /* needs a click */ } }
    const cons = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } };
    if (RS.input.deviceId) cons.deviceId = { exact: RS.input.deviceId };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: cons }); }
    catch (e) {
      // the saved device is gone (unplugged): fall back to the default input once
      if (RS.input.deviceId && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) { RS.input.deviceId = ''; return RS.openInput(); }
      RS.inputError = (e.name || 'Error') + (e.message ? ': ' + e.message : '');
      return false;
    }
    RS.inputError = null;
    const tr = stream.getAudioTracks()[0], st = (tr && tr.getSettings && tr.getSettings()) || {};
    const d = RS.dev = {
      stream, label: tr ? tr.label : '', channels: st.channelCount || 2, inLatency: st.latency || 0,
      src: c.createMediaStreamSource(stream),
      split: c.createChannelSplitter(2), merge: c.createChannelMerger(2), routing: [],
      gain: c.createGain(), anL: c.createAnalyser(), anR: c.createAnalyser(), split2: c.createChannelSplitter(2),
      proc: c.createScriptProcessor(RC.bufferSize, 3, 2), toProc: c.createChannelMerger(3), sink: c.createGain(), mon: c.createGain(),
      peak: [0, 0], hold: [{ v: 0, t: 0 }, { v: 0, t: 0 }], clip: false
    };
    d.src.connect(d.split);
    route();
    d.merge.connect(d.gain);
    d.gain.gain.value = db2g(RS.input.gainDb);
    d.anL.fftSize = d.anR.fftSize = 2048;
    d.gain.connect(d.split2); d.split2.connect(d.anL, 0); d.split2.connect(d.anR, 1);
    // the processor receives L, R and (while recording) a CLOCK channel: the exact AudioContext time of every
    // sample. Blocks are placed by that time, so a busy / frozen moment of the program never shifts the take
    // (a ScriptProcessor can deliver late, repeated or dropped blocks then — measured: up to 370 ms of error)
    d.split2.connect(d.toProc, 0, 0); d.split2.connect(d.toProc, 1, 1); d.toProc.connect(d.proc); d.proc.connect(d.sink); d.sink.gain.value = 0; d.sink.connect(c.destination);
    d.gain.connect(d.mon); d.mon.gain.value = RS.input.monitor ? 1 : 0; d.mon.connect(SDAW.audio.master || c.destination);
    d.proc.onaudioprocess = onBlock;
    if (await workletReady(c)) {
      d.cap = RS.captureNode(c);
      d.gain.connect(d.cap); d.cap.connect(d.sink);
      d.cap.port.onmessage = onWorkletMsg;
      d.proc.onaudioprocess = null; d.toProc.disconnect(); d.proc.disconnect();     // the old path is not needed
    }
    RS.captureMode = d.cap ? 'AudioWorklet' : 'ScriptProcessor';
    // keep Settings → Audio in step (the track 🎙 recorder uses the same input)
    const set = SDAW.settings && SDAW.settings.data;
    if (set && set.inputId !== RS.input.deviceId) { set.inputId = RS.input.deviceId; if (SDAW.settings.save) SDAW.settings.save(); }
    return true;
  };

  /** Channel routing of the input: stereo, input 1 (L), input 2 (R) or both mixed to mono */
  function route() {
    const d = RS.dev; if (!d) return;
    const c = ctx();
    try { d.split.disconnect(); } catch (e) { /* first time */ }
    d.routing.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } });
    d.routing = [];
    let mode = RS.input.mode;
    if (mode === 'auto') mode = d.channels < 2 ? 'left' : 'stereo';
    if (d.channels < 2 && mode !== 'left') mode = 'left';          // a mono device only has input 1
    d.mode = mode;
    if (mode === 'stereo') { d.split.connect(d.merge, 0, 0); d.split.connect(d.merge, 1, 1); }
    else if (mode === 'left') { d.split.connect(d.merge, 0, 0); d.split.connect(d.merge, 0, 1); }
    else if (mode === 'right') { d.split.connect(d.merge, 1, 0); d.split.connect(d.merge, 1, 1); }
    else {                                                            // mix: (L + R) / 2 on both sides
      const h = c.createGain(); h.gain.value = 0.5; d.routing.push(h);
      d.split.connect(h, 0); d.split.connect(h, 1); h.connect(d.merge, 0, 0); h.connect(d.merge, 0, 1);
    }
  }

  RS.closeInput = function () {
    const d = RS.dev; if (!d) return;
    RS.dev = null;
    try { d.proc.onaudioprocess = null; if (d.cap) d.cap.port.onmessage = null; [d.src, d.split, d.merge, d.gain, d.split2, d.toProc, d.proc, d.sink, d.mon].concat(d.cap ? [d.cap] : []).concat(d.routing).forEach(n => n.disconnect()); } catch (e) { /* already */ }
    d.stream.getTracks().forEach(x => x.stop());
  };

  /** A block from the audio thread: { f: frame of its first sample, L, R } — or { done } after the last one */
  function onWorkletMsg(e) {
    const r = RS.rec, m = e.data;
    if (m.done) { if (RS._capDone) RS._capDone(); return; }
    if (!r || r.done && !r.flushing) return;
    const sr = ctx().sampleRate, t = m.f / sr;
    r.blocks.push({ t, L: m.L, R: m.R }); r.frames += m.L.length;
    if (r.first === null) r.first = t;
    livePeak(r, m.L, m.R, sr);
  }
  function livePeak(r, L, R, sr) {
    let mx = 0; for (let i = 0; i < L.length; i += 8) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > mx) mx = v; }
    r.live.push(mx);
    if (r.frames > RC.maxMinutes * 60 * sr && !r.stopping) { r.stopping = true; setTimeout(() => { SDAW.toast('⏹ The recording reached ' + RC.maxMinutes + ' minutes and was stopped'); RS.stopRecording(); }, 0); }
  }

  /** Every captured block (ScriptProcessor path): stored while recording (the meters read the analysers) */
  function onBlock(e) {
    const r = RS.rec; if (!r || r.done) return;
    const ib = e.inputBuffer, clk = ib.getChannelData(2);
    if (!clk[0] && !clk[clk.length - 1]) return;                          // before the clock was connected
    const L = new Float32Array(ib.getChannelData(0)), R = new Float32Array(ib.getChannelData(1));
    // time of the block's first sample, read from its LAST sample (the block where the clock starts begins with zeros)
    const t = r.base + clk[clk.length - 1] - (clk.length - 1) / ib.sampleRate;
    r.blocks.push({ t, L, R }); r.frames += L.length;
    if (r.first === null) r.first = t;
    livePeak(r, L, R, ib.sampleRate);
  }

  /* ========================================================= RECORDING ==== */
  /** Count-in / click: one tick of the metronome at an exact AudioContext time */
  function click(time, accent) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.frequency.value = RC.clickFreq[accent ? 0 : 1];
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(RC.clickVolume, time + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, time + 0.06);
    o.connect(g); g.connect(SDAW.audio.master || c.destination); o.start(time); o.stop(time + 0.08);
  }

  /** Song tick where a song recording starts */
  RS.songStartTick = function () {
    if (RS.opts.fromCursor) return Math.max(0, Math.round(SDAW.audio.getTick ? SDAW.audio.getTick() : 0));
    return Math.max(0, (Math.max(1, RS.opts.fromBar | 0) - 1) * SDAW.barTicks());
  };

  RS.startRecording = async function () {
    if (RS.rec) return;
    if (SDAW.app && SDAW.app.recording) return SDAW.toast('Stop the track recording (●) first');
    if (!RS.dev && !(await RS.openInput())) return SDAW.toast('🎙 No audio input: ' + (RS.inputError || 'allow the microphone'));
    RS.stopPreview();
    const A = SDAW.audio, c = ctx(), o = RS.opts, song = o.where === 'song';
    if (A.playing || A.preparing) A.stop();
    const td = tickDur(), beat = SDAW.beatTicks() * td, beatsPerBar = Math.round(SDAW.barTicks() / SDAW.beatTicks());
    const fromTick = song ? RS.songStartTick() : 0;
    const r = RS.rec = { blocks: [], live: [], frames: 0, first: null, song, fromTick, merge: take() ? o.merge : 'new', status: 'Preparing…' };
    // the clock: a signal whose value is the time since `base` (small numbers keep float32 precise)
    r.base = c.currentTime;
    if (RS.dev.cap) RS.dev.cap.port.postMessage({ on: true });
    else {
      r.clock = c.createConstantSource(); r.clock.offset.value = 0;
      r.clock.offset.setValueAtTime(0, r.base); r.clock.offset.linearRampToValueAtTime(RC.maxMinutes * 60 + 600, r.base + RC.maxMinutes * 60 + 600);
      r.clock.connect(RS.dev.toProc, 0, 2); r.clock.start(r.base);
    }
    RS.refreshUI();
    // real instruments of the song must be loaded before the count-in (their first notes must sound right)
    if (song) {
      const waits = [];
      SDAW.store.song.tracks.forEach(t => [SDAW.guitarRig, SDAW.pianoRig, SDAW.windRig].forEach(R => { const w = R && R.whenReady ? R.whenReady(t) : null; if (w) waits.push(w); }));
      if (waits.length) {
        r.status = '⏳ Loading the real instruments of the song…'; RS.refreshUI();
        await Promise.race([Promise.all(waits), new Promise(res => setTimeout(res, (CONFIG.audio && CONFIG.audio.prepareTimeoutSec || 20) * 1000))]);
        if (RS.rec !== r) return;                                     // cancelled meanwhile
      }
    }
    // count-in clicks, then (song mode) the song starts exactly where the count-in ends
    const countBeats = (o.countIn | 0) * beatsPerBar;
    const t0 = c.currentTime + 0.12;
    r.startAt = t0 + countBeats * beat;
    for (let i = 0; i < countBeats; i++) click(t0 + i * beat, i % beatsPerBar === 0);
    r.status = countBeats ? 'Count-in…' : '● Recording';
    if (song) {
      r.keep = { loop: A.loop, pat: A.patternMode, metro: CONFIG.audio.metronome };
      A.loop = { on: false, start: 0, end: null }; A.patternMode = false;
      CONFIG.audio.metronome = !!o.click;
      const go = () => {
        if (RS.rec !== r) return;
        A.play(fromTick, { noWait: true });
        r.songT0 = A.startTime; r.songTick0 = A.startTick;
        r.status = '● Recording with the song';
      };
      const ms = (r.startAt - 0.06 - c.currentTime) * 1000;
      if (ms > 4) r.goTimer = setTimeout(go, ms); else go();
    } else if (o.click) {
      // free recording with a click: a tiny scheduler continuing the count-in grid
      let n = countBeats;
      const tick = () => { while (t0 + n * beat < c.currentTime + 0.25) { click(t0 + n * beat, n % beatsPerBar === 0); n++; } };
      r.clickTimer = setInterval(tick, 60); tick();
    }
    r.timer = setInterval(() => { if (RS.rec === r) { r.status = c.currentTime < r.startAt ? 'Count-in ' + Math.ceil((r.startAt - c.currentTime) / beat) : (song ? '● Recording with the song' : '● Recording'); RS.drawLive(); } }, 80);
    SDAW.bus.emit('recording', { on: true, studio: true });
    RS.refreshUI();
  };

  /** Stop: the captured audio becomes a take (or is added to the current take) */
  RS.stopRecording = async function () {
    const r = RS.rec; if (!r || r.done) return;
    r.done = true;
    if (RS.dev && RS.dev.cap) {                                            // the audio thread sends what it still holds
      r.flushing = true;
      await new Promise(res => { RS._capDone = res; RS.dev.cap.port.postMessage({ on: false }); setTimeout(res, 600); });
      RS._capDone = null; r.flushing = false;
    }
    clearInterval(r.timer); clearInterval(r.clickTimer); clearTimeout(r.goTimer);
    const A = SDAW.audio, c = ctx();
    if (r.song) {
      if (A.playing || A.preparing) A.stop();
      A.loop = r.keep.loop; A.patternMode = r.keep.pat; CONFIG.audio.metronome = r.keep.metro;
    }
    RS.rec = null; RS.last = { startAt: r.startAt, songT0: r.songT0, base: r.base };   // (kept for diagnostics / tests)
    if (r.clock) { try { r.clock.stop(); r.clock.disconnect(); } catch (e) { /* input closed */ } }
    SDAW.bus.emit('recording', { on: false, studio: true });
    if (!r.frames || r.first === null) { RS.refreshUI(); return SDAW.toast('Nothing was recorded'); }
    const sr = c.sampleRate;
    // latency: what was played in time with a click / note reached us this much later
    const set = (SDAW.settings && SDAW.settings.data) || {};
    const comp = (c.outputLatency || 0) + (c.baseLatency || 0) + ((RS.dev && RS.dev.inLatency) || 0) + (set.recOffsetMs || 0) / 1000;
    const startAt = r.song && r.songT0 !== undefined ? r.songT0 : r.startAt;   // the instant the take begins
    // every block goes where its clock says (gaps of a frozen moment stay silent, repeats overwrite)
    const t0 = startAt + comp, last = r.blocks[r.blocks.length - 1];
    const n = Math.round((last.t + last.L.length / sr - t0) * sr);
    if (n <= 0) { RS.refreshUI(); return SDAW.toast('Stopped during the count-in — nothing was recorded'); }
    const L = new Float32Array(n), R = new Float32Array(n);
    r.blocks.forEach(bk => {
      const pos = Math.round((bk.t - t0) * sr), from = Math.max(0, -pos), to = Math.min(bk.L.length, n - pos);
      if (to > from) { L.set(bk.L.subarray(from, to), pos + from); R.set(bk.R.subarray(from, to), pos + from); }
    });
    const stereo = isStereo(L, R);
    const origin = r.song && r.songTick0 !== undefined ? r.songTick0 : null;
    const t = take();
    if (r.merge === 'new' || !t) {
      RS.takes.push({ id: SDAW.uid('take'), name: 'Take ' + (++RS.count), sr, L, R: stereo ? R : L, stereo, origin, undo: [], redo: [] });
      RS.cur = RS.takes.length - 1; RS.sel = null; RS.cursor = 0; RS.pps = 0;
      if (origin !== null) RS.ins.at = 'origin';
    } else {
      // add to the take in the editor: at the end, at the cursor or over the selection
      const add = { L, R: stereo ? R : L };
      if (r.merge === 'end') RS.edit('Record at the end', tk => paste(tk, add, dur(tk), dur(tk)));
      else if (r.merge === 'cursor') RS.edit('Record at the cursor', tk => paste(tk, add, RS.cursor, RS.cursor));
      else if (r.merge === 'replace' && RS.sel) RS.edit('Record over the selection', tk => paste(tk, add, RS.sel.a, RS.sel.b));
      else RS.edit('Record at the cursor', tk => paste(tk, add, RS.cursor, RS.cursor));
    }
    SDAW.toast('🎙 Recorded ' + (n / sr).toFixed(1) + ' s' + (r.merge === 'new' || !t ? ' → ' + take().name : ' into ' + t.name));
    RS.refreshUI();
  };

  /* ============================================================ EDITING ==== */
  /** Every edit: undo snapshot, change, peaks recomputed */
  RS.edit = function (label, fn) {
    const t = take(); if (!t) return;
    pushUndo(t, t.undo); t.redo = [];
    fn(t);
    t.stereo = isStereo(t.L, t.R); if (!t.stereo) t.R = t.L;
    t.peaks = null;
    const d = dur(t);
    RS.cursor = Math.min(RS.cursor, d);
    if (RS.sel) { RS.sel.a = Math.min(RS.sel.a, d); RS.sel.b = Math.min(RS.sel.b, d); if (RS.sel.b - RS.sel.a < 1e-4) RS.sel = null; }
    RS.lastEdit = label;
    RS.refreshUI();
  };
  function snap(t) { return { L: t.L, R: t.R, origin: t.origin }; }                  // arrays are never changed in place → no copy needed
  function pushUndo(t, stack) {
    stack.push(snap(t));
    let bytes = 0; for (let i = stack.length - 1; i >= 0; i--) { bytes += stack[i].L.byteLength * (stack[i].R === stack[i].L ? 1 : 2); if (bytes > RC.undoMB * 1e6 || stack.length - i > RC.undoSteps) { stack.splice(0, i); break; } }
  }
  RS.undo = function () { const t = take(); if (!t || !t.undo.length) return SDAW.toast('Nothing to undo in the take'); pushUndo(t, t.redo); Object.assign(t, t.undo.pop()); t.peaks = null; t.stereo = t.R !== t.L; RS.sel = null; RS.refreshUI(); };
  RS.redo = function () { const t = take(); if (!t || !t.redo.length) return SDAW.toast('Nothing to redo in the take'); pushUndo(t, t.undo); Object.assign(t, t.redo.pop()); t.peaks = null; t.stereo = t.R !== t.L; RS.sel = null; RS.refreshUI(); };

  const idx = (t, sec) => SDAW.clamp(Math.round(sec * t.sr), 0, t.L.length);
  /** Replace [a, b) seconds of the take with `add` ({L, R}; null = delete) — new arrays every time */
  function paste(t, add, a, b) {
    const i = idx(t, a), j = idx(t, b), stereo = t.stereo || (add && add.R !== add.L);
    const mk = (src, ins) => cat(src.subarray(0, i), ins || new Float32Array(0), src.subarray(j));
    const L = mk(t.L, add && add.L), R = stereo ? mk(t.R, add && add.R) : L;
    // the song position of sample 0 moves when audio is removed / inserted before it
    if (t.origin !== null && t.origin !== undefined && i === 0) t.origin += ((j - i) - (add ? add.L.length : 0)) / t.sr / tickDur();
    t.L = L; t.R = R;
    RS.cursor = i / t.sr + (add ? add.L.length / t.sr : 0);
    RS.sel = null;
  }
  function range(t) { return RS.sel ? [RS.sel.a, RS.sel.b] : [0, dur(t)]; }
  function mapRange(t, a, b, f) {                                     // f(value, positionInRange 0..1) on new arrays
    const i = idx(t, a), j = idx(t, b), n = j - i;
    const one = src => { const o = new Float32Array(src); for (let k = i; k < j; k++) o[k] = f(src[k], n > 1 ? (k - i) / (n - 1) : 1); return o; };
    const L = one(t.L); t.R = t.stereo ? one(t.R) : L; t.L = L;
  }

  RS.ops = {
    selectAll() { const t = take(); if (t) { RS.sel = { a: 0, b: dur(t) }; RS.draw(); } },
    copy() { const t = take(); if (!t || !RS.sel) return SDAW.toast('Select a part of the take first (drag on the waveform)'); const i = idx(t, RS.sel.a), j = idx(t, RS.sel.b); RS.clipboard = { L: t.L.slice(i, j), R: t.stereo ? t.R.slice(i, j) : null }; RS.clipboard.R = RS.clipboard.R || RS.clipboard.L; SDAW.toast('Copied ' + ((j - i) / t.sr).toFixed(2) + ' s'); RS.refreshUI(); },
    cut() { const t = take(); if (!t || !RS.sel) return SDAW.toast('Select a part of the take first'); RS.ops.copy(); RS.edit('Cut', tk => paste(tk, null, RS.sel.a, RS.sel.b)); },
    paste() {
      const t = take(), cb = RS.clipboard; if (!cb) return SDAW.toast('Nothing copied yet');
      if (!t) { RS.takes.push({ id: SDAW.uid('take'), name: 'Take ' + (++RS.count), sr: ctx().sampleRate, L: cb.L, R: cb.R, stereo: cb.R !== cb.L, origin: null, undo: [], redo: [] }); RS.cur = RS.takes.length - 1; RS.pps = 0; return RS.refreshUI(); }
      RS.edit('Paste', tk => paste(tk, cb, RS.sel ? RS.sel.a : RS.cursor, RS.sel ? RS.sel.b : RS.cursor));
    },
    del() { const t = take(); if (!t || !RS.sel) return SDAW.toast('Select the part to delete'); RS.edit('Delete', tk => paste(tk, null, RS.sel.a, RS.sel.b)); },
    trim() {
      const t = take(); if (!t || !RS.sel) return SDAW.toast('Select the part to keep');
      const { a, b } = RS.sel;
      RS.edit('Keep the selection', tk => { const i = idx(tk, a), j = idx(tk, b); if (tk.origin !== null && tk.origin !== undefined) tk.origin += i / tk.sr / tickDur(); const L = tk.L.slice(i, j); tk.R = tk.stereo ? tk.R.slice(i, j) : L; tk.L = L; RS.cursor = 0; RS.sel = null; });
    },
    silence() { const t = take(); if (!t || !RS.sel) return SDAW.toast('Select the part to silence'); RS.edit('Silence', tk => mapRange(tk, RS.sel.a, RS.sel.b, () => 0)); },
    insertSilence(sec) {
      const t = take(); sec = +sec; if (!t || !(sec > 0)) return;
      const z = new Float32Array(Math.round(sec * t.sr));
      RS.edit('Insert silence', tk => paste(tk, { L: z, R: z }, RS.cursor, RS.cursor));
    },
    fadeIn() { const t = take(); if (!t) return; const [a, b] = RS.sel ? range(t) : [0, Math.min(RC.defaultFadeSec, dur(t))]; RS.edit('Fade in', tk => mapRange(tk, a, b, (v, x) => v * x * x)); },
    fadeOut() { const t = take(); if (!t) return; const d = dur(t), [a, b] = RS.sel ? range(t) : [Math.max(0, d - RC.defaultFadeSec), d]; RS.edit('Fade out', tk => mapRange(tk, a, b, (v, x) => v * (1 - x) * (1 - x))); },
    normalize() {
      const t = take(); if (!t) return; const [a, b] = range(t), i = idx(t, a), j = idx(t, b);
      let m = 0; for (let k = i; k < j; k++) { const v = Math.max(Math.abs(t.L[k]), Math.abs(t.R[k])); if (v > m) m = v; }
      if (m < 1e-5) return SDAW.toast('That part is silent');
      const g = db2g(RC.normalizeDb) / m;
      RS.edit('Normalize', tk => mapRange(tk, a, b, v => v * g));
      SDAW.toast('Normalized to ' + RC.normalizeDb + ' dB (' + (g2db(g) >= 0 ? '+' : '') + g2db(g).toFixed(1) + ' dB)');
    },
    gain(dB) { const t = take(); dB = +dB; if (!t || !dB) return; const [a, b] = range(t), g = db2g(dB); RS.edit('Gain ' + dB + ' dB', tk => mapRange(tk, a, b, v => SDAW.clamp(v * g, -1, 1))); },
    toNewTake() {
      const t = take(); if (!t) return; const [a, b] = range(t), i = idx(t, a), j = idx(t, b);
      const L = t.L.slice(i, j), R = t.stereo ? t.R.slice(i, j) : L;
      RS.takes.push({ id: SDAW.uid('take'), name: t.name + ' (part)', sr: t.sr, L, R, stereo: t.stereo, origin: t.origin === null || t.origin === undefined ? null : t.origin + i / t.sr / tickDur(), undo: [], redo: [] });
      RS.cur = RS.takes.length - 1; RS.sel = null; RS.cursor = 0; RS.pps = 0; RS.refreshUI();
    }
  };

  /* ============================================================ PREVIEW ==== */
  RS.playPreview = function () {
    const t = take(); if (!t || RS.rec) return;
    RS.stopPreview();
    const c = ctx();
    if (c.state === 'suspended') c.resume();
    const buf = c.createBuffer(2, t.L.length || 1, t.sr);
    buf.copyToChannel(t.L, 0); buf.copyToChannel(t.R, 1);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(SDAW.audio.master || c.destination);
    const a = RS.sel ? RS.sel.a : (RS.cursor >= dur(t) - 0.01 ? 0 : RS.cursor), b = RS.sel ? RS.sel.b : dur(t);
    const at = c.currentTime + 0.03;
    src.start(at, a, Math.max(0.001, b - a));
    const p = RS.play = { src, at, a, b };
    src.onended = () => { if (RS.play === p) { RS.play = null; RS.refreshUI(); } };
    const anim = () => { if (RS.play !== p) return; RS.draw(); requestAnimationFrame(anim); };
    requestAnimationFrame(anim);
    RS.refreshUI();
  };
  RS.stopPreview = function () { const p = RS.play; if (!p) return; RS.play = null; try { p.src.stop(); } catch (e) { /* ended */ } RS.refreshUI(); };
  RS.playheadSec = function () { const p = RS.play; if (!p) return null; return Math.min(p.b, p.a + Math.max(0, ctx().currentTime - p.at)); };

  /* ================================================ INTO THE SONG / WAV ==== */
  function takeBuffer(t) { const b = ctx().createBuffer(2, Math.max(1, t.L.length), t.sr); b.copyToChannel(t.L, 0); b.copyToChannel(t.R, 1); return b; }

  /** Song tick where the take goes, from the "Insert" options */
  RS.insertTick = function () {
    const t = take(), i = RS.ins;
    if (i.at === 'origin' && t && t.origin !== null && t.origin !== undefined) return Math.max(0, Math.round(t.origin));
    if (i.at === 'bar') return Math.max(0, (Math.max(1, i.bar | 0) - 1) * SDAW.barTicks() + (Math.max(1, i.beat | 0) - 1) * SDAW.beatTicks());
    return Math.max(0, Math.round(SDAW.audio.getTick ? SDAW.audio.getTick() : 0));
  };

  RS.insertIntoSong = async function () {
    const t = take(); if (!t || !t.L.length) return SDAW.toast('Record or open a take first');
    const s = SDAW.store;
    if (s.rendering) return SDAW.toast('⏳ An export is rendering — wait until it has finished');
    // what the take will be: the samples of the project are WAV files
    let L = t.L, R = t.R, origin = t.origin;
    // a take recorded with the song that starts before bar 1 (removed audio at the start): keep the part from bar 1
    let start = RS.insertTick();
    if (RS.ins.at === 'origin' && origin !== null && origin < 0) { const cut = Math.round(-origin * tickDur() * t.sr); L = L.subarray(cut); R = R === t.L ? L : R.subarray(cut); start = 0; }
    const b = ctx().createBuffer(2, Math.max(1, L.length), t.sr); b.copyToChannel(L, 0); b.copyToChannel(R, 1);
    // the take may start between two ticks (recorded with the song): the clip offset keeps it exactly in time
    let lead = 0;
    if (RS.ins.at === 'origin' && origin !== null && origin >= 0) { lead = (Math.ceil(origin - 1e-6) - origin) * tickDur(); start = Math.ceil(origin - 1e-6); }
    const len = Math.max(1, Math.ceil((b.duration - lead) / tickDur()));
    const name = t.name.replace(/[^\w\- ()]/g, '').trim() + '.wav';
    const blob = SDAW.exporter.encodeWav(b, RC.wavBits, 1);
    let id;
    try { id = await SDAW.samples.importFile(new File([blob], name, { type: 'audio/wav' }), name); }
    catch (e) { return SDAW.toast('⚠ Could not store the take: ' + (e.message || e)); }
    // one undo step (Ctrl+Z) for the new track + the block
    const before = s.undoStack.length;
    let track = RS.ins.track === 'new' ? null : s.track(RS.ins.track);
    if (!track) {
      track = SDAW.addTrackFromInstrument(SDAW.findInstrument('String Ensemble'));
      s.mutate('Audio track', () => { const tr = s.track(track.id); tr.name = t.name; tr.instrument = 'Audio'; });
      track = s.track(track.id);
    }
    let clip;
    s.mutate('Insert recording', () => {
      const tr = s.track(track.id);
      SDAW.registerSample(id);
      clip = s.placeAudio(tr, id, start, len);
      if (lead) clip.offset = lead;
    });
    if (s.undoStack.length > before + 1) s.undoStack.splice(before + 1);
    if (clip) s.selectClip(track.id, clip.id);
    t.insertedAs = track.name + ' · bar ' + SDAW.barText(start);
    SDAW.toast('⤵ "' + t.name + '" inserted on "' + track.name + '" at bar ' + SDAW.barText(start) + ' (' + b.duration.toFixed(1) + ' s) — Ctrl+Z undoes');
    RS.refreshUI();
    return clip;
  };

  RS.saveWav = function () {
    const t = take(); if (!t || !t.L.length) return;
    const blob = SDAW.exporter.encodeWav(takeBuffer(t), RC.wavBits, 1);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = t.name.replace(/[^\w\- ()]/g, '').trim() + '.wav';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    SDAW.toast('💾 ' + a.download + ' saved (Downloads folder)');
  };

  /** Open an audio file as a take (to edit it before inserting) */
  RS.openFile = function () {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.wav,.mp3,.ogg,.flac,.aif,.aiff,.m4a';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const buf = await SDAW.samples.decode(await f.arrayBuffer(), f.name);
        let L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
        if (buf.sampleRate !== ctx().sampleRate) {                         // same rate as the program: resample once
          const oc = new OfflineAudioContext(2, Math.ceil(buf.duration * ctx().sampleRate), ctx().sampleRate), s = oc.createBufferSource();
          s.buffer = buf; s.connect(oc.destination); s.start(); const r = await oc.startRendering(); L = r.getChannelData(0); R = buf.numberOfChannels > 1 ? r.getChannelData(1) : L;
        }
        L = new Float32Array(L); R = R === L ? L : new Float32Array(R);
        const stereo = isStereo(L, R);
        RS.takes.push({ id: SDAW.uid('take'), name: f.name.replace(/\.[^.]+$/, ''), sr: ctx().sampleRate, L, R: stereo ? R : L, stereo, origin: null, undo: [], redo: [] });
        RS.cur = RS.takes.length - 1; RS.sel = null; RS.cursor = 0; RS.pps = 0; RS.refreshUI();
      } catch (e) { SDAW.toast('⚠ Could not open ' + f.name + ': ' + (e.message || e)); }
    };
    inp.click();
  };

  /* ======================================================== WAVEFORM ==== */
  /** min / max per block of 256 samples (fast drawing of long takes) */
  function peaksOf(t) {
    if (t.peaks) return t.peaks;
    const B = 256, n = Math.ceil(t.L.length / B), P = { B, minL: new Float32Array(n), maxL: new Float32Array(n), minR: new Float32Array(n), maxR: new Float32Array(n) };
    const one = (src, mn, mx) => { for (let k = 0; k < n; k++) { let lo = 0, hi = 0; const e = Math.min(src.length, (k + 1) * B); for (let i = k * B; i < e; i++) { const v = src[i]; if (v < lo) lo = v; else if (v > hi) hi = v; } mn[k] = lo; mx[k] = hi; } };
    one(t.L, P.minL, P.maxL);
    if (t.stereo) one(t.R, P.minR, P.maxR); else { P.minR = P.minL; P.maxR = P.maxL; }
    return (t.peaks = P);
  }

  RS.draw = function () {
    const v = RS.view; if (!v || !v.canvas.isConnected) return;
    const t = take(), cv = v.canvas, sc = v.scroll, W = sc.clientWidth || 800, H = RC.waveHeight, C = RC.colors;
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const d = dur(t);
    if (!RS.pps && d) RS.pps = SDAW.clamp((W - 10) / d, RC.zoomMin, RC.zoomMax);
    if (!RS.pps) RS.pps = 100;
    v.spacer.style.width = Math.max(W, Math.ceil(d * RS.pps) + 40) + 'px';
    cv.style.left = sc.scrollLeft + 'px';
    const g = cv.getContext('2d'), x0 = sc.scrollLeft, pps = RS.pps, top = RC.rulerH;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    // ruler: a label every "nice" interval
    const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find(s => s * pps >= 70) || 600;
    g.font = '11px Consolas, monospace'; g.textBaseline = 'middle';
    for (let s = Math.floor(x0 / pps / step) * step; s * pps - x0 < W; s += step) {
      const x = Math.round(s * pps - x0) + 0.5;
      g.fillStyle = C.grid; g.fillRect(x, top, 1, H - top);
      g.fillStyle = C.ruler; g.fillText(fmt(s).replace(/\.00$/, ''), x + 3, top / 2);
    }
    if (!t) { g.fillStyle = C.ruler; g.font = '15px Segoe UI, sans-serif'; g.fillText(RS.rec ? '' : 'No take yet — press ● Record (or open an audio file)', 20, H / 2); }
    else {
      const P = peaksOf(t), lanes = t.stereo ? 2 : 1, laneH = (H - top) / lanes;
      for (let ln = 0; ln < lanes; ln++) {
        const mn = ln ? P.minR : P.minL, mx = ln ? P.maxR : P.maxL, src = ln ? t.R : t.L, mid = top + laneH * ln + laneH / 2, amp = laneH / 2 - 3;
        g.fillStyle = C.center; g.fillRect(0, Math.round(mid), W, 1);
        g.fillStyle = C.wave;
        const spp = t.sr / pps;
        for (let x = 0; x < W; x++) {
          const s0 = (x0 + x) * spp, s1 = s0 + spp; if (s0 >= src.length) break;
          let lo = 0, hi = 0;
          if (spp >= P.B) { for (let k = Math.floor(s0 / P.B), e = Math.min(mn.length, Math.ceil(s1 / P.B)); k < e; k++) { if (mn[k] < lo) lo = mn[k]; if (mx[k] > hi) hi = mx[k]; } }
          else { for (let i = Math.floor(s0), e = Math.min(src.length, Math.max(Math.floor(s0) + 1, Math.ceil(s1))); i < e; i++) { const vv = src[i]; if (vv < lo) lo = vv; if (vv > hi) hi = vv; } }
          const y1 = mid - hi * amp, y2 = mid - lo * amp;
          g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
        if (lanes === 2) { g.fillStyle = C.ruler; g.fillText(ln ? 'R' : 'L', 4, top + laneH * ln + 10); }
      }
      if (RS.sel) {
        const a = RS.sel.a * pps - x0, b = RS.sel.b * pps - x0;
        g.fillStyle = C.sel; g.fillRect(a, top, b - a, H - top);
        g.fillStyle = C.selEdge; g.fillRect(Math.round(a), top, 1, H - top); g.fillRect(Math.round(b), top, 1, H - top);
      }
      g.fillStyle = C.cursor; g.fillRect(Math.round(RS.cursor * pps - x0), 0, 2, H);
      const ph = RS.playheadSec();
      if (ph !== null) {
        const x = ph * pps - x0;
        g.fillStyle = C.play; g.fillRect(Math.round(x), 0, 2, H);
        if (x > W - 30 || x < 0) sc.scrollLeft = Math.max(0, ph * pps - 60);
      }
    }
    if (v.info) v.info.textContent = t ? (RS.sel ? 'Selection ' + fmt(RS.sel.a) + ' – ' + fmt(RS.sel.b) + ' (' + (RS.sel.b - RS.sel.a).toFixed(2) + ' s)' : 'Cursor ' + fmt(RS.cursor)) + ' · length ' + fmt(d) + (t.stereo ? ' · stereo' : ' · mono') + ' · ' + t.sr + ' Hz' : '';
  };

  /** The live waveform while recording (drawn over the editor) */
  RS.drawLive = function () {
    const v = RS.view, r = RS.rec; if (!v || !r || !v.canvas.isConnected) return;
    RS.draw();
    const cv = v.canvas, g = cv.getContext('2d'), W = cv.width, H = cv.height, top = RC.rulerH, mid = top + (H - top) / 2, amp = (H - top) / 2 - 4;
    g.fillStyle = 'rgba(8, 10, 28, .82)'; g.fillRect(0, top, W, H - top);
    const n = r.live.length, from = Math.max(0, n - W);
    g.fillStyle = RC.colors.waveRec;
    for (let i = from; i < n; i++) { const h = Math.max(1, r.live[i] * amp); g.fillRect(i - from, mid - h, 1, h * 2); }
    const c = ctx(), el = c.currentTime - (r.startAt || c.currentTime);
    g.fillStyle = '#fff'; g.font = 'bold 26px Consolas, monospace'; g.textBaseline = 'top';
    g.fillText((el < 0 ? '−' : '') + fmt(Math.abs(el)), W - 170, top + 8);
    g.font = '14px Segoe UI, sans-serif'; g.fillStyle = '#ff9db0'; g.fillText(r.status || '', 12, top + 10);
  };

  /* ========================================================== METERS ==== */
  function meterLoop(gen) {
    const v = RS.view; if (!v || gen !== RS._meterGen) return;
    const d = RS.dev, now = performance.now(), buf = RS._mbuf || (RS._mbuf = new Float32Array(2048));
    [0, 1].forEach(ch => {
      let p = 0;
      if (d) { (ch ? d.anR : d.anL).getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; } }
      const db = g2db(p), h = d ? d.hold[ch] : { v: 0, t: 0 };
      if (p >= h.v || now - h.t > RC.peakHoldMs) { h.v = p; h.t = now; }
      if (d && db > RC.clipDb) d.clip = true;
      const pct = x => SDAW.clamp((g2db(x) - RC.meterFloorDb) / -RC.meterFloorDb, 0, 1) * 100;
      v.bars[ch].style.width = pct(p) + '%';
      v.holds[ch].style.left = pct(h.v) + '%';
      if (ch === 0) v.dbText.textContent = d ? (h.v > 0 ? g2db(h.v).toFixed(1) + ' dB' : '−∞ dB') : '—';
    });
    v.clip.classList.toggle('on', !!(d && d.clip));
    requestAnimationFrame(() => meterLoop(gen));
  }

  /* ============================================================ PANEL ==== */
  RS.open = async function (opts) {
    const { el, $ } = SDAW;
    if ($('#modalRoot .rs-modal')) return;
    opts = opts || {};
    if (opts.track) { RS.ins.track = opts.track; }
    const set = (SDAW.settings && SDAW.settings.data) || {};
    if (!RS.input.deviceId && set.inputId) RS.input.deviceId = set.inputId;
    const back = el('div', { class: 'modal-back' });
    const modal = el('div', { class: 'modal glass rs-modal' });
    back.appendChild(modal);
    $('#modalRoot').appendChild(back);
    RS.back = back;
    RS.close = function () {
      if (RS.rec) RS.stopRecording();
      RS.stopPreview();
      RS.closeInput();
      window.removeEventListener('keydown', onKey, true);
      RS.view = null; back.remove();
    };
    // the panel closes itself when the modal area is cleared by something else (Esc of the app, a new project…)
    const mo = new MutationObserver(() => { if (!back.isConnected) { mo.disconnect(); if (RS.view) { RS.view = null; if (RS.rec) RS.stopRecording(); RS.stopPreview(); RS.closeInput(); window.removeEventListener('keydown', onKey, true); } } });
    mo.observe($('#modalRoot'), { childList: true });
    window.addEventListener('keydown', onKey, true);
    RS.modal = modal;
    RS.devices = [];
    RS.refreshUI();
    await RS.openInput();
    await RS.listDevices();
    RS.refreshUI();
  };

  RS.listDevices = async function () {
    try { RS.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { RS.devices = []; }
  };
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', async () => { if (RS.view) { await RS.listDevices(); RS.refreshUI(); } });

  /** Keys while the panel is open (they don't reach the rest of the program) */
  function onKey(e) {
    if (!RS.view) return;
    if (e.target && e.target.matches && e.target.matches('input[type=text], input[type=number], select, textarea')) { if (e.key === 'Escape') e.target.blur(); e.stopPropagation(); return; }
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    let done = true;
    if (k === 'escape') { if (RS.rec) RS.stopRecording(); else if (RS.play) RS.stopPreview(); else RS.close(); }
    else if (k === ' ') { if (RS.rec) RS.stopRecording(); else if (RS.play) RS.stopPreview(); else RS.playPreview(); }
    else if (ctrl && k === 'z') (e.shiftKey ? RS.redo : RS.undo)();
    else if (ctrl && k === 'y') RS.redo();
    else if (ctrl && k === 'a') RS.ops.selectAll();
    else if (ctrl && k === 'c') RS.ops.copy();
    else if (ctrl && k === 'x') RS.ops.cut();
    else if (ctrl && k === 'v') RS.ops.paste();
    else if (k === 'delete' || k === 'backspace') RS.ops.del();
    else if (k === 'home') { RS.cursor = 0; RS.sel = null; RS.view.scroll.scrollLeft = 0; RS.draw(); }
    else if (k === 'end') { RS.cursor = dur(take()); RS.sel = null; RS.draw(); }
    else if (k === '+' || k === '=') zoom(1.6);
    else if (k === '-') zoom(1 / 1.6);
    else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
    else e.stopPropagation();                                           // nothing else of the program reacts while the studio is open
  }

  function zoom(f, aroundSec) {
    const v = RS.view; if (!v) return;
    const W = v.scroll.clientWidth, center = aroundSec !== undefined ? aroundSec : (v.scroll.scrollLeft + W / 2) / RS.pps;
    const px = center * RS.pps - v.scroll.scrollLeft;
    RS.pps = SDAW.clamp(RS.pps * f, RC.zoomMin, RC.zoomMax);
    RS.draw();
    v.scroll.scrollLeft = Math.max(0, center * RS.pps - px);
    RS.draw();
  }

  /** Rebuilds the panel (cheap: called after every action) */
  RS.refreshUI = function () {
    const m = RS.modal; if (!m || !m.isConnected) return;
    const { el } = SDAW;
    const keepScroll = RS.view ? RS.view.scroll.scrollLeft : 0;
    const t = take(), recording = !!RS.rec, d = RS.dev, o = RS.opts;
    const row = (label, ctl, help) => el('label', { class: 'rs-row', 'data-help': help || null }, [el('span', {}, label), ctl]);
    const sel = (value, list, on, attrs) => el('select', Object.assign({ onchange: e => on(e.target.value), disabled: recording || null }, attrs || {}), list.map(([v, l]) => el('option', { value: v, selected: String(v) === String(value) ? true : null }, l)));
    const btn = (label, fn, cls, help, dis) => el('button', { class: 'btn ' + (cls || ''), onclick: fn, 'data-help': help || null, disabled: dis ? true : null }, label);
    m.innerHTML = '';
    m.appendChild(el('button', { class: 'close', onclick: () => RS.close(), 'data-help': 'Close the Recording Studio (Esc). The takes stay here until you close ScoreDAW.' }, '×'));
    m.appendChild(el('h2', { class: 'rs-title' }, ['🎙 Recording Studio', el('small', {}, 'Record from a microphone or any input, edit the take, then insert it into the song')]));

    /* ---------------- left column: input + record ---------------- */
    const left = el('div', { class: 'rs-col rs-left' });
    left.appendChild(el('div', { class: 'ag-sub' }, '1 · Input'));
    const devs = [['', 'Default input of Windows / the system']].concat(RS.devices.map((x, i) => [x.deviceId, x.label || ('Input ' + (i + 1) + (x.deviceId === 'default' ? ' (default)' : ''))]));
    left.appendChild(row('Device', sel(RS.input.deviceId, devs, async v => { RS.input.deviceId = v; await RS.openInput(); await RS.listDevices(); RS.refreshUI(); }, { class: 'rs-dev' }), 'The microphone, audio interface or line input to record from'));
    const chList = [['auto', 'Auto'], ['stereo', 'Stereo (inputs 1 + 2)'], ['left', 'Mono · input 1 / left'], ['right', 'Mono · input 2 / right'], ['mix', 'Mono · 1 + 2 mixed']];
    left.appendChild(row('Channels', sel(RS.input.mode, chList, v => { RS.input.mode = v; route(); RS.refreshUI(); }), 'Audio interface: a guitar or mic plugged into input 1 → "input 1 / left" (recorded on both sides)'));
    if (d && d.channels < 2) left.appendChild(el('div', { class: 'rs-note' }, 'This device sends one channel: it is recorded as mono.'));
    left.appendChild(row('Input gain', el('div', { class: 'rs-inline' }, [
      el('input', { type: 'range', min: -24, max: 24, step: 0.5, value: RS.input.gainDb, oninput: e => { RS.input.gainDb = +e.target.value; if (RS.dev) RS.dev.gain.gain.value = db2g(RS.input.gainDb); e.target.nextSibling.textContent = (RS.input.gainDb > 0 ? '+' : '') + RS.input.gainDb + ' dB'; } }),
      el('span', { class: 'rs-val' }, (RS.input.gainDb > 0 ? '+' : '') + RS.input.gainDb + ' dB')
    ]), 'Digital gain after the input. If the meter hits red at 0 dB, lower the gain of the interface / Windows instead'));
    // meter
    const bars = [el('div', { class: 'rs-mbar' }), el('div', { class: 'rs-mbar' })], holds = [el('div', { class: 'rs-mhold' }), el('div', { class: 'rs-mhold' })];
    const clip = el('button', { class: 'rs-clip', onclick: () => { if (RS.dev) RS.dev.clip = false; }, 'data-help': 'Turns red when the input clips (distorts). Click to reset it.' }, 'CLIP');
    const dbText = el('span', { class: 'rs-db' }, '—');
    const meter = el('div', { class: 'rs-meter' }, [
      el('div', { class: 'rs-mrow' }, [el('b', {}, 'L'), el('div', { class: 'rs-mtrack' }, [bars[0], holds[0]])]),
      el('div', { class: 'rs-mrow' }, [el('b', {}, 'R'), el('div', { class: 'rs-mtrack' }, [bars[1], holds[1]])]),
      el('div', { class: 'rs-mscale' }, [el('span', {}, '−60'), el('span', {}, '−36'), el('span', {}, '−18'), el('span', {}, '−6'), el('span', {}, '0 dB')]),
      el('div', { class: 'rs-inline' }, [dbText, clip])
    ]);
    left.appendChild(meter);
    if (!d) left.appendChild(el('div', { class: 'rs-warn' }, ['⚠ No input: ' + (RS.inputError || 'opening…') + ' ', btn('↻ Retry', async () => { await RS.openInput(); await RS.listDevices(); RS.refreshUI(); }, 'small')]));
    else left.appendChild(el('div', { class: 'rs-note' }, '● ' + (d.label || 'Input') + ' · ' + (d.mode === 'stereo' ? 'stereo' : 'mono') + ' · ' + ctx().sampleRate + ' Hz'));
    left.appendChild(el('label', { class: 'rs-check', 'data-help': 'Hear the input through ScoreDAW. Use headphones (speakers + microphone = feedback). There is a small delay.' }, [
      el('input', { type: 'checkbox', checked: RS.input.monitor ? true : null, onchange: e => { RS.input.monitor = e.target.checked; if (RS.dev) RS.dev.mon.gain.value = RS.input.monitor ? 1 : 0; } }), ' Monitor the input (use headphones)']));

    left.appendChild(el('div', { class: 'ag-sub' }, '2 · Record'));
    left.appendChild(row('Mode', sel(o.where, [['free', 'Free (only the input)'], ['song', 'With the song playing']], v => { o.where = v; RS.refreshUI(); }), 'Free: just record. With the song: the song plays from the chosen bar while you record, and the take remembers where it goes'));
    if (o.where === 'song') {
      left.appendChild(row('From', el('div', { class: 'rs-inline' }, [
        sel(o.fromCursor ? 'cursor' : 'bar', [['cursor', 'The song cursor (bar ' + SDAW.barText(Math.round(SDAW.audio.getTick ? SDAW.audio.getTick() : 0)) + ')'], ['bar', 'Bar…']], v => { o.fromCursor = v === 'cursor'; RS.refreshUI(); }),
        o.fromCursor ? null : el('input', { type: 'number', min: 1, max: 999, value: o.fromBar, style: { width: '64px' }, disabled: recording || null, onchange: e => { o.fromBar = Math.max(1, +e.target.value || 1); } })
      ])));
    }
    left.appendChild(row('Count-in', sel(o.countIn, RC.countInOptions.map(n => [n, n ? n + ' bar' + (n > 1 ? 's' : '') : 'None']), v => { o.countIn = +v; })));
    left.appendChild(el('label', { class: 'rs-check' }, [el('input', { type: 'checkbox', checked: o.click ? true : null, disabled: recording || null, onchange: e => { o.click = e.target.checked; } }), ' Click (metronome) while recording · ' + SDAW.store.song.tempo + ' BPM']));
    if (t) left.appendChild(row('The new audio', sel(o.merge, [['new', 'Goes to a new take'], ['end', 'Is added at the end of ' + t.name], ['cursor', 'Is inserted at the cursor'], ['replace', 'Replaces the selection']], v => { o.merge = v; }), '“Añadir”: record more and add it to the take you are editing'));
    left.appendChild(el('div', { class: 'rs-transport' }, [
      recording ? btn('■ Stop', () => RS.stopRecording(), 'rs-stop', 'Stop recording (Space / Esc)') : btn('● Record', () => RS.startRecording(), 'rs-rec', 'Start recording', !d),
      btn(RS.play ? '■ Stop' : '▶ Play take', () => RS.play ? RS.stopPreview() : RS.playPreview(), '', 'Play the take (or the selection) — Space', !t || recording)
    ]));
    if (recording) left.appendChild(el('div', { class: 'rs-recstatus' }, RS.rec.status || ''));

    /* ---------------- right column: takes + editor + insert ---------------- */
    const right = el('div', { class: 'rs-col rs-right' });
    // takes
    right.appendChild(el('div', { class: 'rs-takes' }, [
      el('span', { class: 'ag-sub', style: { margin: '0 8px 0 0' } }, 'Takes'),
      ...RS.takes.map((tk, i) => el('button', { class: 'rs-take' + (i === RS.cur ? ' on' : ''), disabled: recording || null, onclick: () => { RS.stopPreview(); RS.cur = i; RS.sel = null; RS.cursor = 0; RS.pps = 0; RS.refreshUI(); }, 'data-help': tk.insertedAs ? 'Inserted on ' + tk.insertedAs : 'Not inserted into the song yet' }, [tk.name + ' · ' + dur(tk).toFixed(1) + ' s', tk.insertedAs ? el('i', {}, ' ✓') : null])),
      RS.takes.length ? null : el('span', { class: 'rs-note' }, 'Every recording becomes a take here.'),
      el('span', { class: 'spacer' }),
      btn('📂 Open audio file', () => RS.openFile(), 'small', 'Open a WAV / MP3 / OGG / FLAC / AIFF file as a take, to edit it and insert it', recording)
    ]));
    if (t) right.appendChild(el('div', { class: 'rs-takebar' }, [
      el('input', { type: 'text', value: t.name, class: 'rs-name', disabled: recording || null, onchange: e => { t.name = e.target.value.trim() || t.name; RS.refreshUI(); }, 'data-help': 'Name of the take (also the name of the sample / track in the song)' }),
      btn('⧉ Duplicate', () => { RS.takes.splice(RS.cur + 1, 0, { id: SDAW.uid('take'), name: t.name + ' copy', sr: t.sr, L: t.L, R: t.R, stereo: t.stereo, origin: t.origin, undo: [], redo: [] }); RS.cur++; RS.refreshUI(); }, 'small', 'A copy of the take (to try edits and keep the original)', recording),
      btn('🗑 Delete take', () => { if (!confirm('Delete "' + t.name + '"? (it is not in the song' + (t.insertedAs ? ' — the copy inserted in the song stays' : '') + ')')) return; RS.stopPreview(); RS.takes.splice(RS.cur, 1); RS.cur = Math.min(RS.cur, RS.takes.length - 1); RS.sel = null; RS.pps = 0; RS.refreshUI(); }, 'small danger', null, recording),
      t.origin !== null && t.origin !== undefined ? el('span', { class: 'rs-note' }, '♪ recorded with the song at bar ' + SDAW.barText(Math.max(0, Math.round(t.origin)))) : null
    ]));
    // editor toolbar
    const silenceIn = el('input', { type: 'number', min: 0.1, max: 60, step: 0.1, value: RS._silSec || 1, style: { width: '58px' }, onchange: e => { RS._silSec = +e.target.value; } });
    const gainIn = el('input', { type: 'number', min: -24, max: 24, step: 0.5, value: RS._gainDb || 3, style: { width: '58px' }, onchange: e => { RS._gainDb = +e.target.value; } });
    const noT = !t || recording, noSel = noT || !RS.sel;
    right.appendChild(el('div', { class: 'rs-tools' }, [
      btn('↶', () => RS.undo(), 'small', 'Undo (Ctrl+Z)', noT || !t.undo.length), btn('↷', () => RS.redo(), 'small', 'Redo (Ctrl+Y)', noT || !t.redo.length),
      el('span', { class: 'rs-sep' }),
      btn('✂ Cut', RS.ops.cut, 'small', 'Cut the selection (Ctrl+X)', noSel), btn('⧉ Copy', RS.ops.copy, 'small', 'Copy the selection (Ctrl+C)', noSel),
      btn('📋 Paste', RS.ops.paste, 'small', 'Paste at the cursor, or over the selection (Ctrl+V)', recording || !RS.clipboard),
      btn('🗑 Delete', RS.ops.del, 'small', 'Delete the selection (Del)', noSel), btn('⇥ Keep selection', RS.ops.trim, 'small', 'Keep only the selection (trim the rest)', noSel),
      btn('🔇 Silence', RS.ops.silence, 'small', 'Silence the selection', noSel),
      el('span', { class: 'rs-sep' }),
      btn('⤓ Insert silence', () => RS.ops.insertSilence(RS._silSec || 1), 'small', 'Insert this many seconds of silence at the cursor', noT), silenceIn, el('small', {}, 's'),
      el('span', { class: 'rs-sep' }),
      btn('◢ Fade in', RS.ops.fadeIn, 'small', 'Fade in the selection (or the first ' + RC.defaultFadeSec + ' s)', noT), btn('◣ Fade out', RS.ops.fadeOut, 'small', 'Fade out the selection (or the last ' + RC.defaultFadeSec + ' s)', noT),
      btn('⇕ Normalize', RS.ops.normalize, 'small', 'Raise the selection (or the whole take) to ' + RC.normalizeDb + ' dB peak', noT),
      btn('± Gain', () => RS.ops.gain(RS._gainDb || 3), 'small', 'Change the volume of the selection (or the whole take) by this many dB', noT), gainIn, el('small', {}, 'dB'),
      btn('✚ Selection → new take', RS.ops.toNewTake, 'small', 'Copy the selection (or the take) to a new take', noT),
      el('span', { class: 'spacer' }),
      btn('－', () => zoom(1 / 1.6), 'small', 'Zoom out (−)', noT), btn('Fit', () => { RS.pps = 0; RS.draw(); }, 'small', 'Show the whole take', noT), btn('＋', () => zoom(1.6), 'small', 'Zoom in (+, Ctrl+wheel)', noT)
    ]));
    // waveform
    const canvas = el('canvas', { class: 'rs-canvas' }), spacer = el('div', { class: 'rs-spacer' }), info = el('div', { class: 'rs-info' });
    const scroll = el('div', { class: 'rs-scroll', style: { height: (RC.waveHeight + 16) + 'px' } }, [spacer, canvas]);
    right.appendChild(scroll);
    right.appendChild(el('div', { class: 'rs-hint' }, [info, el('span', {}, 'Click = cursor · drag = select · Shift+click = extend · Space = play / stop · Ctrl+wheel = zoom')]));
    // insert into the song
    const s = SDAW.store, tracks = s.song.tracks;
    const insTick = RS.insertTick(), insEnd = t ? insTick + Math.ceil(dur(t) / tickDur()) : insTick;
    const target = RS.ins.track === 'new' ? null : s.track(RS.ins.track);
    const overlap = target && target.clips.some(c => c.start < insEnd && c.start + c.len > insTick);
    const atList = [['cursor', 'The song cursor (bar ' + SDAW.barText(Math.max(0, Math.round(SDAW.audio.getTick ? SDAW.audio.getTick() : 0))) + ')'], ['bar', 'Bar / beat…']];
    if (t && t.origin !== null && t.origin !== undefined) atList.unshift(['origin', 'Where it was recorded (bar ' + SDAW.barText(Math.max(0, Math.round(t.origin))) + ')']);
    if (RS.ins.at === 'origin' && !(t && t.origin !== null && t.origin !== undefined)) RS.ins.at = 'cursor';
    right.appendChild(el('div', { class: 'ag-sub' }, '3 · Insert into the song'));
    right.appendChild(el('div', { class: 'rs-insert' }, [
      row('Track', sel(RS.ins.track, [['new', '＋ New audio track']].concat(tracks.map(x => [x.id, x.name])), v => { RS.ins.track = v; RS.refreshUI(); }), 'Where the take goes: a new track, or an existing one'),
      row('At', el('div', { class: 'rs-inline' }, [
        sel(RS.ins.at, atList, v => { RS.ins.at = v; RS.refreshUI(); }),
        RS.ins.at === 'bar' ? el('span', { class: 'rs-inline' }, ['bar', el('input', { type: 'number', min: 1, max: 999, value: RS.ins.bar, style: { width: '64px' }, onchange: e => { RS.ins.bar = Math.max(1, +e.target.value || 1); RS.refreshUI(); } }),
          'beat', el('input', { type: 'number', min: 1, max: 16, value: RS.ins.beat, style: { width: '52px' }, onchange: e => { RS.ins.beat = Math.max(1, +e.target.value || 1); RS.refreshUI(); } })]) : null
      ]), 'The position in the song where the take starts'),
      el('span', { class: 'spacer' }),
      btn('💾 Save WAV', () => RS.saveWav(), '', 'Save the take as a WAV file (' + RC.wavBits + '-bit)', noT),
      btn('⤵ Insert into song', () => RS.insertIntoSong(), 'primary', 'Put the take into the song as an audio block (Ctrl+Z undoes)', noT)
    ]));
    if (t) right.appendChild(el('div', { class: overlap ? 'rs-warn' : 'rs-note' }, overlap
      ? '⚠ "' + target.name + '" already has blocks between bar ' + SDAW.barText(insTick) + ' and ' + SDAW.barText(insEnd) + ': the take replaces them there (Ctrl+Z undoes).'
      : 'The take will go ' + (target ? 'on "' + target.name + '"' : 'on a new audio track') + ' from bar ' + SDAW.barText(insTick) + ' to ' + SDAW.barText(insEnd) + '. Once inserted it is saved with the project.'));
    right.appendChild(el('div', { class: 'rs-note' }, 'Takes stay in this panel until you close ScoreDAW — insert or save the ones you want to keep.'));

    m.appendChild(el('div', { class: 'rs-body' }, [left, right]));

    /* ---------------- view wiring ---------------- */
    RS.view = { canvas, scroll, spacer, info, meter, bars, holds, clip, dbText };
    scroll.addEventListener('scroll', () => RS.draw());
    scroll.addEventListener('wheel', e => { if (e.ctrlKey && take()) { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 0.8, (scroll.scrollLeft + (e.clientX - r.left) * canvas.width / r.width) / RS.pps); } }, { passive: false });
    canvas.addEventListener('mousedown', e => {
      const tk = take(); if (!tk || RS.rec) return;
      const r = canvas.getBoundingClientRect(), toSec = ev => SDAW.clamp((scroll.scrollLeft + (ev.clientX - r.left) * canvas.width / r.width) / RS.pps, 0, dur(tk));
      const s0 = toSec(e);
      let anchor = s0;
      if (e.shiftKey) { const a = RS.sel ? RS.sel.a : RS.cursor, b = RS.sel ? RS.sel.b : RS.cursor; anchor = Math.abs(s0 - a) > Math.abs(s0 - b) ? a : b; RS.sel = { a: Math.min(anchor, s0), b: Math.max(anchor, s0) }; }
      else { RS.sel = null; RS.cursor = s0; }
      RS.draw();
      const move = ev => { const s1 = toSec(ev); if (Math.abs(s1 - anchor) * RS.pps > 3) { RS.sel = { a: Math.min(anchor, s1), b: Math.max(anchor, s1) }; RS.cursor = RS.sel.a; } RS.draw(); };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (RS.play) { RS.stopPreview(); RS.playPreview(); } RS.refreshUI(); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    requestAnimationFrame(() => { scroll.scrollLeft = keepScroll; RS.draw(); if (RS.rec) RS.drawLive(); });
    const gen = RS._meterGen = (RS._meterGen || 0) + 1;            // the previous loop stops by itself
    requestAnimationFrame(() => meterLoop(gen));
  };

  // the song finished by itself while recording with it: the take ends there
  SDAW.bus.on('transport', e => { if (e && e.playing === false && !e.preparing && RS.rec && RS.rec.song && RS.rec.songT0 !== undefined && !RS.rec.done) RS.stopRecording(); });
})(window.SDAW);
