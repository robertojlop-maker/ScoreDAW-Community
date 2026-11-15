/* ===================================================================== *
 *  ScoreDAW — AUDIO RECORDING (microphone / guitar / line in)
 *  -------------------------------------------------------------------
 *  Arm a track for audio (track.recAudio = true: the 🎙 button on the
 *  track header, or the Inspector) and press Record. While the song plays
 *  the input chosen in Settings → Audio is captured as raw PCM through the
 *  audio graph. When recording stops the take becomes a WAV sample of the
 *  project and an audio block on the armed track, placed where it was played.
 *
 *  Capture: an AudioWorklet on the audio thread (shared with the Recording Studio,
 *  recstudio.js), so every block carries the exact time of its first sample — a busy
 *  interface never shifts the take. Without AudioWorklet a ScriptProcessor is used.
 *
 *  Timing / latency compensation
 *    The first captured sample is stamped with its AudioContext time. What the
 *    player heard at that moment left the speakers `outputLatency` later and
 *    came back through the input with `inputLatency` — so the take is shifted
 *    earlier by  outputLatency + baseLatency + inputLatency + manual offset
 *    (Settings → Audio → "Recording offset", for interfaces that misreport).
 *
 *  Note: the take is laid down linearly from where recording began; if the
 *  song loops or jumps (repeats, D.C.) while recording, only the linear
 *  timeline is used.
 * ===================================================================== */
(function (SDAW) {
  'use strict';

  const R = SDAW.recorder = { take: null, count: 0 };

  R.armedTrack = function () {
    const s = SDAW.store, sel = s.selTrack();
    if (sel && sel.recAudio) return sel;
    return s.song.tracks.find(t => t.recAudio) || null;
  };

  /** Start capturing (called when Record turns on). Resolves true if a take started */
  R.start = async function () {
    if (R.take) return true;
    const t = R.armedTrack(); if (!t) return false;
    const A = SDAW.audio; A.init();
    const set = (SDAW.settings && SDAW.settings.data) || {};
    const cons = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (set.inputId) cons.deviceId = { exact: set.inputId };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: cons }); } catch (e) {
      SDAW.toast('Audio input not available (' + (e.name || e.message) + ') — allow the microphone and check Settings → Audio');
      return false;
    }
    const ctx = A.ctx;
    const src = ctx.createMediaStreamSource(stream);
    const sink = ctx.createGain(); sink.gain.value = 0;      // keeps the capture node running, silent
    // blocks = { t: AudioContext time of the block's first sample, L, R }: placed by time when the take ends
    const take = { track: t, stream, src, sink, blocks: [], first: null, frames: 0 };
    const stamp = (time, L, Rr) => {
      if (take.first === null) {
        take.first = time;                                   // capture time of sample 0
        take.tick0 = A.tickAtTime(take.first);               // read now: the timeline is trimmed while playing
      }
      take.blocks.push({ t: time, L, R: Rr }); take.frames += L.length;
    };
    const RS = SDAW.recStudio;
    if (RS && RS.workletReady && await RS.workletReady(ctx)) {
      // AudioWorklet (audio thread): every block carries the frame number of its first sample, so a
      // busy moment of the program never shifts or drops audio (the ScriptProcessor below could:
      // up to 400 ms of error measured after a freeze of the interface)
      take.node = RS.captureNode(ctx);
      take.node.port.onmessage = e => { const m = e.data; if (m.done) { if (take.onDone) take.onDone(); return; } stamp(m.f / ctx.sampleRate, m.L, m.R); };
      src.connect(take.node); take.node.connect(sink); sink.connect(ctx.destination);
      take.node.port.postMessage({ on: true });
    } else {
      // fallback (no AudioWorklet): ScriptProcessor, stamped when the block arrives
      take.proc = ctx.createScriptProcessor(4096, 2, 2);
      take.proc.onaudioprocess = (e) => {
        const ib = e.inputBuffer;
        stamp(ctx.currentTime - ib.duration, new Float32Array(ib.getChannelData(0)), new Float32Array(ib.numberOfChannels > 1 ? ib.getChannelData(1) : ib.getChannelData(0)));
      };
      src.connect(take.proc); take.proc.connect(sink); sink.connect(ctx.destination);
    }
    const tr = stream.getAudioTracks()[0];
    const inLat = (tr && tr.getSettings && tr.getSettings().latency) || 0;
    take.comp = (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + inLat + (set.recOffsetMs || 0) / 1000;
    R.take = take;
    SDAW.bus.emit('recording', { on: true, track: t.id });
    return true;
  };

  /** Stop capturing and turn the take into an audio block */
  R.stop = async function () {
    const take = R.take; if (!take) return null;
    R.take = null;
    if (take.node) {                                          // the audio thread sends what it still holds
      await new Promise(res => { take.onDone = res; take.node.port.postMessage({ on: false }); setTimeout(res, 600); });
      take.node.port.onmessage = null;
    }
    try { take.src.disconnect(); (take.node || take.proc).disconnect(); take.sink.disconnect(); } catch (e) { /* already */ }
    take.stream.getTracks().forEach(x => x.stop());
    SDAW.bus.emit('recording', { on: false });
    if (!take.frames || take.first === null) { SDAW.toast('Nothing was recorded'); return null; }
    const A = SDAW.audio, ctx = A.ctx, sr = ctx.sampleRate;
    const td = A.tickDur();
    // trim the latency from the start of the take, and anything captured before the song started
    let tick0 = take.tick0;
    const before = tick0 < 0 ? -tick0 * td : 0;
    if (before) tick0 = 0;
    // the length of the take by time (first block → end of the last one), not by counting frames
    const lastB = take.blocks[take.blocks.length - 1], span = Math.max(1, Math.round((lastB.t - take.first) * sr) + lastB.L.length);
    const skip = Math.min(span - 1, Math.round((take.comp + before) * sr));
    const n = span - skip;
    const buf = ctx.createBuffer(2, n, sr);
    // every block where its time stamp says (repeated blocks overwrite, a lost one stays silent)
    const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
    take.blocks.forEach(bk => {
      const pos = Math.round((bk.t - take.first) * sr) - skip, from = Math.max(0, -pos), to = Math.min(bk.L.length, n - pos);
      if (to > from) { L.set(bk.L.subarray(from, to), pos + from); Rr.set(bk.R.subarray(from, to), pos + from); }
    });
    // where it starts in the song (the sound heard at capture time `first`)
    const start = Math.max(0, Math.ceil(tick0 - 1e-6));
    const lead = Math.max(0, (start - tick0) * td);           // seconds before the first whole tick
    const len = Math.max(1, Math.ceil((buf.duration - lead) / td));
    const t = take.track;
    const name = 'Rec ' + (++R.count) + ' - ' + t.name + '.wav';
    const blob = SDAW.exporter.encodeWav(buf, 24, 1);
    const id = await SDAW.samples.importFile(new File([blob], name, { type: 'audio/wav' }), name);
    let clip;
    SDAW.store.mutate('Record audio', () => {
      SDAW.registerSample(id);
      clip = SDAW.store.placeAudio(t, id, start, len);
      clip.offset = lead;
    });
    SDAW.store.selectClip(t.id, clip.id);
    SDAW.toast('Recorded ' + buf.duration.toFixed(1) + ' s on "' + t.name + '" (bar ' + SDAW.barText(start) + ')');
    return clip;
  };

  R.toggleArm = function (t) {
    SDAW.store.mutate(t.recAudio ? 'Disarm audio' : 'Arm audio', () => { t.recAudio = !t.recAudio; });
    if (t.recAudio) SDAW.toast('🎙 "' + t.name + '" will record the audio input when you press Record (R)');
  };

  // stopping the transport ends the take
  SDAW.bus.on('transport', (e) => { if (e && e.playing === false && R.take) R.stop(); });
})(window.SDAW);
