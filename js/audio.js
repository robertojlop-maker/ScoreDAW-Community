/* =============================================================================
 *  AUDIO.JS — built-in PREVIEW audio engine (Web Audio API)
 *  -----------------------------------------------------------------------------
 *  IMPORTANT: this is a temporary engine so the interface can be heard and
 *  tested today. In the desktop version, playback is done by the native
 *  engine (LiveReplica's NAudio sampler + the hyper-realistic sample libraries
 *  of Lemon-Studio and LiveReplica). The interface talks to the engine only
 *  through the methods below, so the native engine can replace this file
 *  without touching the views:
 *
 *      SDAW.audio.init()                       create the audio context
 *      SDAW.audio.play(fromTick) / stop()      transport
 *      SDAW.audio.previewNote(track, pitch, opts)
 *      SDAW.audio.previewDrum(track, rowId)
 *      SDAW.audio.getTick()                    current playhead tick (float)
 *      SDAW.audio.getLevel(trackId|'master')   meter level 0..1
 *      SDAW.audio.updateTrack(track)           apply volume / pan / pedals
 *
 *  Engines:
 *    guitar  - Karplus-Strong plucked string ("Guitar Emulator"): bends,
 *              slides, vibrato, palm mute, harmonics, hammer/pull, strums
 *    bass    - plucked string + sub sine
 *    keys    - additive piano / electric piano / organ
 *    strings - detuned saw ensemble with slow attack
 *    synth   - simple subtractive synth
 *    drums   - synthesized kit (kick, snare, hats, toms, clap, perc)
 * ============================================================================= */

(function (SDAW) {
  'use strict';

  const A = {
    ctx: null,
    master: null,
    masterAnalyser: null,
    reverbBus: null,
    delayBus: null,
    chains: {},          // trackId -> FX chain nodes
    ksCache: {},         // Karplus-Strong buffer cache
    noise: null,
    playing: false,
    startTime: 0,        // ctx time when play started
    startTick: 0,        // tick where play started
    nextTick: 0,         // next tick to schedule
    nextTime: 0,         // ctx time of nextTick
    timer: null,
    loop: { on: false, start: 0, end: null },  // end null = song end
    index: null,         // tick -> events, rebuilt when the song changes
    lastPitch: {},       // trackId -> last scheduled pitch (for slides)
    patternMode: false,  // true = loop only the current pattern (like FL Studio "PAT")
    active: []           // sources started by the scheduler (stopped on Stop)
  };
  SDAW.audio = A;

  /* ============================================================ INIT === */
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    A.ctx = new Ctx({ latencyHint: CONFIG.audio.latency || (SDAW.settings && SDAW.settings.data.latency) || 'interactive' });
    setTimeout(() => SDAW.settings && SDAW.settings.apply(), 0);
    buildGraph(A.ctx);
    SDAW.store.song.tracks.forEach(t => A.updateTrack(t));
  };

  /**
   * The curve of the master ceiling: linear up to `knee`, then a smooth tanh shoulder that
   * reaches `ceiling` (never more). `head` = how far above 1.0 the input may go before the
   * curve's end (the node is fed input / head).
   */
  A.ceilingCurve = function (knee, ceiling, head) {
    const N = 4096, curve = new Float32Array(N), room = ceiling - knee;
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) * 2 - 1) * head, a = Math.abs(x);
      const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
      curve[i] = Math.sign(x) * Math.min(y, ceiling);
    }
    return curve;
  };

  /** Master bus, limiter, shared noise, reverb and delay buses of a context */
  function buildGraph(c) {

    A.master = c.createGain();
    A.master.gain.value = CONFIG.audio.masterVolume;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
    A.masterAnalyser = c.createAnalyser(); A.masterAnalyser.fftSize = 1024;
    // CEILING: the compressor above is not a brickwall (fast peaks of a loud mix — Metal, Blues —
    // passed it at up to +1.7 dBFS and clipped). A soft clipper after it never lets the signal pass
    // CONFIG.audio.ceiling: below CONFIG.audio.ceilingKnee it is untouched (the sound of a mix that
    // did not clip does not change), above it the peaks are rounded smoothly instead of cut flat.
    const ceil = c.createWaveShaper(), pre = c.createGain(), post = c.createGain();
    const HEAD = 2;                                        // the shaper reads -1..1: input up to 2.0 (+6 dB) is shaped, not clamped
    pre.gain.value = 1 / HEAD; post.gain.value = 1;
    ceil.curve = A.ceilingCurve(CONFIG.audio.ceilingKnee || 0.89, CONFIG.audio.ceiling || 0.985, HEAD);
    ceil.oversample = '4x';
    A.master.connect(limiter); limiter.connect(pre); pre.connect(ceil); ceil.connect(post); post.connect(A.masterAnalyser); A.masterAnalyser.connect(c.destination);

    // shared noise buffer (drums, pick noise)
    const nb = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.noise = nb;

    // shared reverb bus (algorithmic impulse response)
    A.reverbBus = c.createConvolver();
    A.reverbBus.buffer = makeImpulse(c, 2.4, 2.2);
    const revOut = c.createGain(); revOut.gain.value = 0.9;
    A.reverbBus.connect(revOut); revOut.connect(A.master);

    // shared delay bus (tempo synced in updateDelayTime)
    A.delayBus = c.createDelay(2.0);
    const fb = c.createGain(); fb.gain.value = 0.35;
    const dlyFilter = c.createBiquadFilter(); dlyFilter.type = 'lowpass'; dlyFilter.frequency.value = 3500;
    A.delayBus.connect(dlyFilter); dlyFilter.connect(fb); fb.connect(A.delayBus);
    const dlyOut = c.createGain(); dlyOut.gain.value = 0.8;
    dlyFilter.connect(dlyOut); dlyOut.connect(A.master);
    A.updateDelayTime();
  }

  /** Generated stereo impulse response for the reverb */
  function makeImpulse(c, seconds, decay) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  A.updateDelayTime = function () {
    if (!A.ctx) return;
    const beat = 60 / SDAW.store.song.tempo;
    A.delayBus.delayTime.setTargetAtTime(beat * 0.75, A.ctx.currentTime, 0.05); // dotted 8th
  };

  /* ================================================ TRACK FX CHAIN === *
   *  voices -> input -> [COMP] -> [OD] -> [DIST] -> [AMP] -> [EQ] ->
   *  [CHORUS] -> [DELAY] -> [REVERB] -> volume -> pan -> analyser -> master
   *                                                    \-> mixer sends (reverb / delay buses)
   *  Pedal stages and their models are defined in pedals.js. A pedal that is
   *  OFF is taken out of the chain (true bypass).
   * ------------------------------------------------------------------- */
  const PEDAL_ORDER = ['comp', 'drive', 'dist', 'amp', 'eq', 'chorus', 'delay', 'reverb'];

  function getChain(track) {
    if (A.chains[track.id]) return A.chains[track.id];
    const c = A.ctx;
    const ch = {
      input: c.createGain(),
      stages: {},
      vol: c.createGain(), pan: c.createStereoPanner ? c.createStereoPanner() : c.createGain(),
      analyser: c.createAnalyser(),
      rev: c.createGain(), dly: c.createGain(),
      sig: ''
    };
    PEDAL_ORDER.forEach(k => { ch.stages[k] = SDAW.makePedalStage(c, k); });
    ch.analyser.fftSize = 512;
    ch.vol.connect(ch.pan); ch.pan.connect(ch.analyser); ch.analyser.connect(A.master);
    ch.pan.connect(ch.rev); ch.rev.connect(A.reverbBus);
    ch.pan.connect(ch.dly); ch.dly.connect(A.delayBus);
    A.chains[track.id] = ch;
    return ch;
  }

  /** Apply volume / pan / mute / pedalboard of a track to its chain */
  A.updateTrack = function (track) {
    if (!A.ctx) return;
    track.fx = SDAW.normalizePedals(track.fx);
    const ch = getChain(track), fx = track.fx, now = A.ctx.currentTime;
    const anySolo = SDAW.store.song.tracks.some(t => t.solo);
    const audible = !track.mute && (!anySolo || track.solo);
    if (track.plugin && SDAW.desktop && SDAW.desktop.on && !A.offline && !(A.playing && track.auto)) SDAW.desktop.trackParams(track);
    const autoOn = A.playing && !A.patternMode && track.auto;
    if (!(autoOn && track.auto.vol && track.auto.vol.length)) ch.vol.gain.setTargetAtTime(audible ? track.vol * track.vol * 1.2 : 0, now, 0.02);
    if (ch.pan.pan && !(autoOn && track.auto.pan && track.auto.pan.length)) ch.pan.pan.setTargetAtTime(track.pan, now, 0.02);
    ch.rev.gain.setTargetAtTime(track.sendRev || 0, now, 0.05);
    ch.dly.gain.setTargetAtTime(track.sendDly || 0, now, 0.05);
    PEDAL_ORDER.forEach(k => { if (fx[k].on) ch.stages[k].update(fx[k], SDAW.store.song.tempo); });
    // rewire only when the on/off pattern changed
    const sig = PEDAL_ORDER.map(k => fx[k].on ? 1 : 0).join('');
    if (sig !== ch.sig) {
      ch.sig = sig;
      try { ch.input.disconnect(); } catch (e) { /* not connected */ }
      PEDAL_ORDER.forEach(k => { try { ch.stages[k].out.disconnect(); } catch (e) { /* not connected */ } });
      let node = ch.input;
      PEDAL_ORDER.forEach(k => { if (fx[k].on) { node.connect(ch.stages[k].in); node = ch.stages[k].out; } });
      node.connect(ch.vol);
    }
    // Guitar Rig tracks: create / connect their engine and push the panel settings (guitarrig.js)
    if (SDAW.guitarRig) SDAW.guitarRig.update(track, ch);
    if (SDAW.pianoRig) SDAW.pianoRig.update(track, ch);          // Piano Rig tracks (pianorig.js)
    if (SDAW.windRig) SDAW.windRig.update(track, ch);            // Wind Rig tracks (windrig.js)
  };
  A.getChain = function (track) { return getChain(track); };

  A.removeTrack = function (id) {
    if (SDAW.guitarRig) SDAW.guitarRig.remove(id);
    if (SDAW.pianoRig) SDAW.pianoRig.remove(id);
    if (SDAW.windRig) SDAW.windRig.remove(id);
    const ch = A.chains[id]; if (!ch) return;
    try { ch.analyser.disconnect(); ch.rev.disconnect(); ch.dly.disconnect(); } catch (e) { /* ignore */ }
    delete A.chains[id];
  };

  /* ======================================================== ENGINES === */

  /**
   * Karplus-Strong plucked string buffer.
   * Returned buffer plays at slightly above the target pitch; the caller
   * corrects with playbackRate (fractional delay tuning).
   */
  function ksBuffer(pitch, brightness, decay, muted) {
    const key = pitch + '|' + brightness.toFixed(2) + '|' + decay.toFixed(4) + '|' + (muted ? 1 : 0);
    if (A.ksCache[key]) return A.ksCache[key];
    const c = A.ctx, sr = c.sampleRate, f = SDAW.midiToFreq(pitch);
    const N = Math.max(2, Math.floor(sr / f));
    const seconds = muted ? 0.35 : (pitch < 45 ? 3.2 : 2.6);
    const len = Math.floor(sr * seconds);
    const buf = c.createBuffer(1, len, sr), y = buf.getChannelData(0);
    // excitation: filtered noise burst (brightness = pick position / tone)
    let lp = 0;
    const a = 0.15 + brightness * 0.8;
    for (let i = 0; i < N; i++) { lp += a * ((Math.random() * 2 - 1) - lp); y[i] = lp; }
    const dmp = muted ? 0.985 : decay;
    const blend = muted ? 0.3 : 0.5;
    for (let i = N; i < len; i++) {
      y[i] = dmp * (blend * y[i - N] + (1 - blend) * y[i - N - 1 < 0 ? 0 : i - N - 1]);
    }
    // normalise
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
    if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
    const out = { buffer: buf, rate: (N * f) / sr };
    A.ksCache[key] = out;
    return out;
  }

  /** Envelope helper: returns a gain node with attack / release */
  function env(dest, time, peak, attack, hold, release) {
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.setValueAtTime(peak, time + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
    g.connect(dest);
    return g;
  }

  /**
   * Pitch techniques shared by the string model and the sampler.
   *   r = playbackRate AudioParam · base = rate of the written pitch
   *   slide: true|'shift'|'legato' (from the previous note), 'inBelow', 'inAbove', 'outDown', 'outUp'
   *   bend: semitones (0.5 = 1/4 tone … 3 = 1½ tone) · bendType: 'up' | 'release' | 'pre' | 'prerelease'
   *   vib / wvib: vibrato / wide vibrato
   */
  function pitchTech(r, base, time, dur, tech, T, prevPitch, pitch) {
    const c = A.ctx;
    r.setValueAtTime(base, time);
    const sl = tech.slide;
    if (sl) {
      const st = T.slideTime || 0.12;
      if ((sl === true || sl === 'shift' || sl === 'legato') && prevPitch !== undefined) { r.setValueAtTime(base * Math.pow(2, (prevPitch - pitch) / 12), time); r.linearRampToValueAtTime(base, time + st); }
      else if (sl === 'inBelow') { r.setValueAtTime(base * Math.pow(2, -4 / 12), time); r.linearRampToValueAtTime(base, time + st); }
      else if (sl === 'inAbove') { r.setValueAtTime(base * Math.pow(2, 4 / 12), time); r.linearRampToValueAtTime(base, time + st); }
      else if (sl === 'outDown') { r.setValueAtTime(base, time + dur * 0.65); r.linearRampToValueAtTime(base * Math.pow(2, -7 / 12), time + dur); }
      else if (sl === 'outUp') { r.setValueAtTime(base, time + dur * 0.65); r.linearRampToValueAtTime(base * Math.pow(2, 7 / 12), time + dur); }
    }
    if (tech.bend) {
      const semis = typeof tech.bend === 'number' ? tech.bend : (T.bendRange || 2);
      const up = base * Math.pow(2, semis / 12), type = tech.bendType || 'up';
      if (type === 'up') { r.setValueAtTime(base, time + dur * 0.12); r.linearRampToValueAtTime(up, time + dur * 0.42); }
      else if (type === 'release') { r.setValueAtTime(base, time + dur * 0.1); r.linearRampToValueAtTime(up, time + dur * 0.35); r.setValueAtTime(up, time + dur * 0.55); r.linearRampToValueAtTime(base, time + dur * 0.85); }
      else if (type === 'pre') { r.setValueAtTime(up, time); }
      else if (type === 'prerelease') { r.setValueAtTime(up, time); r.setValueAtTime(up, time + dur * 0.15); r.linearRampToValueAtTime(base, time + dur * 0.5); }
    }
    if (tech.vib || tech.wvib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = (T.vibSpeed || 5.5) * (tech.wvib ? 0.8 : 1);
      lg.gain.setValueAtTime(0, time);
      lg.gain.linearRampToValueAtTime(base * 0.012 * (T.vibDepth || 0.45) * (tech.wvib ? 4.5 : 2), time + Math.min(0.3, dur * 0.4));
      lfo.connect(lg); lg.connect(r); lfo.start(time); lfo.stop(time + dur + 0.6);
    }
  }

  /** Remember scheduled sources so Stop silences them */
  function keep(src, end) {
    A.active.push({ src, end });
    if (A.active.length > 400) A.active = A.active.filter(a => a.end > A.ctx.currentTime);
  }

  A.keep = function (src, end) { keep(src, end); };

  /**
   * SAMPLER engine: plays real samples (from your libraries).
   * The zone with the nearest root note is pitched to the wanted note.
   * Guitar techniques (bend, vibrato, slide, palm mute) work here too.
   */
  function playSampler(track, pitch, time, dur, opts) {
    const c = A.ctx, ch = getChain(track), tech = opts.tech || {}, T = track.technique || {};
    let best = null;
    (track.sampler.zones || []).forEach(z => {
      const b = SDAW.samples.buffer(z.sampleId);
      if (b && (!best || Math.abs(z.root - pitch) < Math.abs(best.z.root - pitch))) best = { z, b };
    });
    if (!best) return false;
    if (tech.strum && opts.strumIndex !== undefined) time += opts.strumIndex * 0.012;
    const src = c.createBufferSource(); src.buffer = best.b;
    let base = Math.pow(2, (pitch - best.z.root + ((track.params && track.params.sTune) || 0)) / 12);
    if (tech.mute) {                       // dead note: only the first percussive milliseconds, muffled
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      src.playbackRate.value = base;
      src.connect(lp); lp.connect(env(ch.input, time, 0.7 * (opts.vel || 100) / 127, 0.001, 0.015, 0.05));
      src.start(time); src.stop(time + 0.1); keep(src, time + 0.1);
      return true;
    }
    if (tech.harm) base *= 2;              // natural harmonic: one octave up, glassy (high-pass below)
    if (tech.pinch) base *= Math.pow(2, 19 / 12);   // pinch harmonic: octave + fifth up
    pitchTech(src.playbackRate, base, time, dur, tech, T, opts.prevPitch, pitch);
    const vel = (opts.vel || 100) / 127;
    const out = c.createGain();
    const P = track.params || {};
    const peak = vel * ((tech.h || tech.p || tech.tap) ? 0.6 : 0.95);
    // sampler envelope (Generator panel: attack / release)
    if (P.sAttack) { out.gain.setValueAtTime(0.0001, time); out.gain.linearRampToValueAtTime(peak, time + P.sAttack); }
    else out.gain.setValueAtTime(peak, time);
    out.gain.setValueAtTime(peak, time + Math.max(dur, P.sAttack || 0));
    const rel = tech.pm ? 0.04 : (P.sRelease !== undefined ? P.sRelease : (track.type === 'keys' || track.type === 'strings' ? 0.35 : 0.2));
    out.gain.exponentialRampToValueAtTime(0.0001, time + dur + rel);
    if (tech.pm) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; src.connect(lp); lp.connect(out); }
    else if (tech.harm) { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = SDAW.midiToFreq(pitch + 12) * 0.9; hp.Q.value = 2; src.connect(hp); hp.connect(out); }
    else src.connect(out);
    out.connect(ch.input);
    src.start(time); src.stop(time + dur + rel + 0.05);
    keep(src, time + dur + rel);
    return true;
  }

  /** Play a sample one-shot (drum pad replaced by a real sample) */
  function playOneShot(track, sampleId, time, vel) {
    const b = SDAW.samples.buffer(sampleId); if (!b) return false;
    const src = A.ctx.createBufferSource(); src.buffer = b;
    const g = A.ctx.createGain(); g.gain.value = 0.25 + (vel || 0.8) * 0.75;
    src.connect(g); g.connect(getChain(track).input);
    src.start(time); keep(src, time + b.duration);
    return true;
  }

  /** Play an audio clip from `offsetSec` inside the file */
  /** Reversed copy of a sample buffer (cached per buffer) */
  const revCache = new WeakMap();
  function reversed(b) {
    if (revCache.has(b)) return revCache.get(b);
    const r = new AudioBuffer({ numberOfChannels: b.numberOfChannels, length: b.length, sampleRate: b.sampleRate });
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c), o = r.getChannelData(c); for (let i = 0, n = d.length; i < n; i++) o[i] = d[n - 1 - i]; }
    revCache.set(b, r);
    return r;
  }
  A.reversedBuffer = reversed;

  /**
   * Play an audio block.
   *   clip: { sampleId, start, len, offsetTicks, offset (s), gain, fadeIn, fadeOut (ticks), reverse }
   *   offsetTicks (arg): how far into the block playback starts (playing from the middle)
   * The block shows the region [srcStart, srcStart + len] of the sound; reverse plays
   * that same region backwards. Fades are gain ramps at the block edges.
   */
  function playAudioClip(track, clip, time, offsetTicks) {
    let b = SDAW.samples.buffer(clip.sampleId); if (!b) return;
    const td = tickDur();
    const into = (offsetTicks || 0) * td;
    const srcStart = (clip.offsetTicks || 0) * td + (clip.offset || 0);
    const region = Math.min(clip.len * td, b.duration - srcStart);
    const play = region - into;
    if (srcStart >= b.duration || play <= 0.001) return;
    let off = srcStart + into;
    if (clip.reverse) { b = reversed(b); off = b.duration - (srcStart + region) + into; }
    const src = A.ctx.createBufferSource(); src.buffer = b;
    const g = A.ctx.createGain(), G = g.gain;
    const base = clip.gain === undefined ? 1 : clip.gain;
    const fi = (clip.fadeIn || 0) * td, fo = (clip.fadeOut || 0) * td;
    const envAt = u => base * (fi > 0 ? Math.min(1, u / fi) : 1) * (fo > 0 ? Math.max(0, Math.min(1, (region - u) / fo)) : 1);
    if (fi > 0 || fo > 0) {
      const pts = [into, region];
      if (fi > into && fi < region) pts.push(fi);
      if (fo > 0 && region - fo > into) pts.push(region - fo);
      pts.sort((x, y) => x - y);
      G.setValueAtTime(envAt(pts[0]), time);
      for (let i = 1; i < pts.length; i++) G.linearRampToValueAtTime(envAt(pts[i]), time + pts[i] - into);
    } else G.value = base;
    src.connect(g); g.connect(getChain(track).input);
    src.start(time, Math.max(0, off), play);
    keep(src, time + play);
  }

  /**
   * Play one melodic note.
   *   track: track object, pitch: MIDI, time: ctx time, dur: seconds
   *   opts: { vel 0..127, tech:{h,p,slide,bend,vib,pm,harm,mute,strum}, prevPitch, strumIndex }
   */
  function playMelodic(track, pitch, time, dur, opts) {
    // plugin instrument (Windows version): the native engine plays it; exports render it separately
    if (track.plugin && SDAW.desktop && SDAW.desktop.on) { if (!A.offline) SDAW.desktop.note(track, pitch, opts.vel, time, dur); return; }
    const c = A.ctx, ch = getChain(track), tech = opts.tech || {}, T = track.technique || {};
    const vel = (opts.vel || 100) / 127;
    const params = track.params || {};
    let engine = track.engine;
    if (track.sampler && track.sampler.zones && track.sampler.zones.length && playSampler(track, pitch, time, dur, opts)) return;
    if (engine === 'gen') { SDAW.genPlay(A, track, pitch, time, dur, opts, ch.input); return; }   // 3x Osc generator (generators.js)
    if (engine === 'rig') {                                // Guitar Rig: real recordings + amps (guitarrig.js)
      if (SDAW.guitarRig && SDAW.guitarRig.active(track) && SDAW.guitarRig.play(track, pitch, time, dur, opts)) return;
      engine = 'guitar';                                   // engine files missing → the light string model plays
    }
    if (engine === 'pianorig') {                           // Piano Rig: grand / electric piano / synth / organ (pianorig.js)
      if (SDAW.pianoRig && SDAW.pianoRig.active(track) && SDAW.pianoRig.play(track, pitch, time, dur, opts)) return;
      engine = 'keys';                                     // engine files missing → the light keys engine plays
    }
    if (engine === 'windrig') {                            // Wind Rig: tenor sax / trumpet (windrig.js)
      if (SDAW.windRig && SDAW.windRig.active(track) && SDAW.windRig.play(track, pitch, time, dur, opts)) return;
      engine = 'synth';                                    // engine files missing → the basic synth plays
    }

    if (engine === 'guitar' || engine === 'bass') {
      // strum: delay each string a little (down = low to high)
      if (tech.strum && opts.strumIndex !== undefined) time += opts.strumIndex * 0.012;
      if (tech.mute) {                                   // dead note: short noisy click
        const src = c.createBufferSource(); src.buffer = A.noise;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = SDAW.midiToFreq(pitch) * 2; bp.Q.value = 4;
        src.connect(bp); bp.connect(env(ch.input, time, 0.5 * vel, 0.002, 0.01, 0.06));
        src.start(time, Math.random()); src.stop(time + 0.12);
        return;
      }
      if (tech.harm) {                                   // natural harmonic: bell-like sine an octave up
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = SDAW.midiToFreq(pitch + 12);
        o.connect(env(ch.input, time, 0.45 * vel, 0.003, 0.02, Math.max(1.2, dur * 1.5)));
        o.start(time); o.stop(time + Math.max(1.3, dur * 1.6));
        return;
      }
      const bright = SDAW.clamp((params.brightness !== undefined ? params.brightness : 0.6) * (0.6 + (T.attack || 0.6) * 0.7), 0.05, 1);
      const decay = engine === 'bass' ? 0.998 : SDAW.clamp((params.decay || 0.996) + ((T.resonance || 0.7) - 0.7) * 0.004, 0.98, 0.9995);
      const ks = ksBuffer(pitch, engine === 'bass' ? 0.35 : bright, decay, !!tech.pm);
      const src = c.createBufferSource();
      src.buffer = ks.buffer;
      // bends, slides, vibrato (shared with the sampler)
      pitchTech(src.playbackRate, ks.rate * (tech.pinch ? Math.pow(2, 19 / 12) : 1), time, dur, tech, T, opts.prevPitch, pitch);
      const legato = tech.h || tech.p || tech.tap;       // hammer-on / pull-off / tapping = softer attack
      const peak = (legato ? 0.55 : 0.9) * vel * (engine === 'bass' ? 1.1 : 0.8);
      const out = c.createGain();
      out.gain.setValueAtTime(peak, time);
      out.gain.setValueAtTime(peak, time + dur);
      out.gain.exponentialRampToValueAtTime(0.0001, time + dur + (tech.pm ? 0.05 : 0.25));
      if (engine === 'bass') {                           // bass: warm lowpass + sub
        const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 900 + (params.brightness || 0.4) * 1500;
        src.connect(lpf); lpf.connect(out);
        const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = SDAW.midiToFreq(pitch);
        sub.connect(env(out, time, 0.25, 0.005, dur * 0.6, 0.2)); sub.start(time); sub.stop(time + dur + 0.3);
      } else {
        const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 3; body.Q.value = 1;
        src.connect(body); body.connect(out);
      }
      out.connect(ch.input);
      src.start(time); src.stop(time + dur + 0.35);
      keep(src, time + dur + 0.35);
      return;
    }

    const f = SDAW.midiToFreq(pitch);
    if (engine === 'keys') {
      const tone = params.tone || 'piano';
      const partials = tone === 'organ' ? [[1, 0.5], [2, 0.35], [3, 0.2], [4, 0.12]] :
                       tone === 'ep' ? [[1, 0.6], [2, 0.12], [7, 0.03]] :
                       [[1, 0.6], [2, 0.22], [3, 0.08], [4, 0.04]];
      const out = c.createGain(); out.connect(ch.input);
      const sustain = tone === 'organ';
      const peak = 0.35 * vel;
      out.gain.setValueAtTime(0.0001, time);
      out.gain.linearRampToValueAtTime(peak, time + (sustain ? 0.02 : 0.004));
      if (!sustain) out.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.9);
      out.gain.setValueAtTime(sustain ? peak : peak * 0.35, time + dur);
      out.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.35);
      partials.forEach(([mul, g]) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
        const pg = c.createGain(); pg.gain.value = g;
        if (!sustain && mul > 1) { pg.gain.setValueAtTime(g, time); pg.gain.exponentialRampToValueAtTime(g * 0.1, time + 0.6 / mul + 0.2); }
        o.connect(pg); pg.connect(out); o.start(time); o.stop(time + dur + 0.4);
      });
      return;
    }

    if (engine === 'strings') {
      const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = params.cutoff || 2200;
      const out = env(ch.input, time, 0.16 * vel, 0.25, Math.max(0, dur - 0.25), 0.6);
      lpf.connect(out);
      [-7, 0, 7].forEach(det => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lpf); o.start(time); o.stop(time + dur + 0.7);
      });
      return;
    }

    // synth (default)
    const o = c.createOscillator(); o.type = params.wave || 'sawtooth'; o.frequency.value = f;
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.Q.value = 6;
    const cut = params.cutoff || 2500;
    lpf.frequency.setValueAtTime(cut * 2, time); lpf.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.4), time + 0.3);
    o.connect(lpf); lpf.connect(env(ch.input, time, 0.18 * vel, 0.005, Math.max(0, dur - 0.05), 0.15));
    o.start(time); o.stop(time + dur + 0.2);
  }

  /** Synthesized drum kit */
  function playDrum(track, row, time, vel) {
    if (track.plugin && SDAW.desktop && SDAW.desktop.on) { if (!A.offline) SDAW.desktop.drum(track, row, vel, time); return; }
    if (track.drumMap && track.drumMap[row] && playOneShot(track, track.drumMap[row], time, vel)) return;
    const c = A.ctx, ch = getChain(track), v = vel || 0.8;
    const latin = track.params && track.params.latin;
    const noiseHit = (type, freq, q, peak, decay, offset) => {
      const s = c.createBufferSource(); s.buffer = A.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      s.connect(f); f.connect(env(ch.input, time + (offset || 0), peak * v, 0.001, 0, decay));
      s.start(time + (offset || 0), Math.random() * 0.5); s.stop(time + (offset || 0) + decay + 0.05);
    };
    const tone = (f0, f1, peak, decay, type) => {
      const o = c.createOscillator(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, time); o.frequency.exponentialRampToValueAtTime(f1, time + decay * 0.6);
      o.connect(env(ch.input, time, peak * v, 0.001, 0, decay)); o.start(time); o.stop(time + decay + 0.05);
    };
    switch (row) {
      case 'kick':  tone(150, 42, 1.0, 0.45); noiseHit('lowpass', 1200, 1, 0.15, 0.02); break;
      case 'snare': tone(220, 160, 0.35, 0.12, 'triangle'); noiseHit('bandpass', 2200, 0.7, 0.6, 0.18); break;
      case 'hhc':   noiseHit('highpass', 7500, 1, 0.32, 0.05); break;
      case 'hho':   noiseHit('highpass', 7000, 1, 0.3, 0.32); break;
      case 'tom1':  latin ? tone(340, 300, 0.7, 0.22) : tone(210, 120, 0.7, 0.3); break;   // latin: high conga
      case 'tom2':  latin ? tone(240, 210, 0.7, 0.28) : tone(150, 85, 0.7, 0.35); break;   // latin: low conga
      case 'clap':  [0, 0.012, 0.024].forEach(o => noiseHit('bandpass', 1300, 1.2, 0.5, 0.1, o)); break;
      case 'crash': noiseHit('highpass', 5000, 0.7, 0.35, 1.6); noiseHit('bandpass', 9000, 0.8, 0.2, 1.2); break;
      case 'ride':  noiseHit('bandpass', 7500, 2, 0.22, 0.9); tone(3200, 3100, 0.05, 0.6, 'square'); break;
      case 'perc':
        if (latin) { // cowbell / clave
          [560, 840].forEach(fq => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fq;
            const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 6;
            o.connect(bp); bp.connect(env(ch.input, time, 0.35 * v, 0.001, 0, 0.18)); o.start(time); o.stop(time + 0.22); });
        } else tone(900, 700, 0.35, 0.08, 'square');
        break;
    }
  }

  /* ========================================================= PREVIEW == */
  A.previewNote = function (track, pitch, opts) {
    if (!CONFIG.audio.previewOnClick) return;
    A.init();
    if (!track) return;
    if (track.type === 'drums') return A.previewDrum(track, 'snare');
    A.updateTrack(track);
    if (track.sampler && track.sampler.zones && track.sampler.zones.length) { playMelodic(track, pitch, A.ctx.currentTime + 0.01, (opts && opts.dur) || 0.8, Object.assign({ vel: 100 }, opts || {})); return; }
    A.updateTrack(track);
    playMelodic(track, pitch, A.ctx.currentTime + 0.01, (opts && opts.dur) || 0.6, Object.assign({ vel: 100 }, opts || {}));
  };
  A.previewChord = function (track, pitches, strum) {
    A.init(); if (!track) return;
    A.updateTrack(track);
    pitches.forEach((p, i) => playMelodic(track, p, A.ctx.currentTime + 0.01, 1.2, { vel: 92, tech: strum ? { strum: 'down' } : {}, strumIndex: i }));
  };
  A.previewDrum = function (track, row) { A.init(); A.updateTrack(track); playDrum(track, row, A.ctx.currentTime + 0.005, 0.9); };

  /** Preview a library instrument without a track (temporary track object) */
  A.previewInstrument = function (inst) {
    const tmp = SDAW.makeTrack(inst); tmp.id = '__preview';
    A.init(); A.updateTrack(tmp);
    // the previous preview's notes still waiting for their recordings are dropped
    [SDAW.guitarRig, SDAW.pianoRig, SDAW.windRig].forEach(R => { const r = R && R.rigOf('__preview'); if (r) r.queue = []; });
    if (inst.type === 'drums') { ['kick', 'hhc', 'snare', 'hhc'].forEach((r, i) => playDrum(tmp, r, A.ctx.currentTime + 0.02 + i * 0.18, 0.8)); return; }
    if (inst.engine === 'windrig' && window.WL && WL.TYPES) {
      // a horn plays a phrase, not a chord: four tongued notes and a long note with vibrato
      const T = WL.TYPES[(inst.params && inst.params.wrig) || 'tenorsax'] || WL.TYPES.tenorsax, c = Math.round(T.center / 12) * 12 - 5, t0 = A.ctx.currentTime + 0.02;
      [[0, 0, 0.2], [2, 0.24, 0.2], [4, 0.48, 0.2], [7, 0.72, 0.2], [12, 0.96, 1.3]].forEach(([iv, at, d]) => playMelodic(tmp, c + iv, t0 + at, d, { vel: 96, tech: {} }));
      return;
    }
    const base = inst.type === 'bass' ? 40 : 60;
    [0, 4, 7, 12].forEach((iv, i) => playMelodic(tmp, base + iv, A.ctx.currentTime + 0.02 + i * 0.16, 0.5, { vel: 96 }));
  };

  /** Preview a genre groove (one bar) */
  A.previewRhythm = function (genre) {
    const tmp = SDAW.makeTrack(SDAW.findInstrument(SDAW.isLatin(genre) ? 'Latin Percussion Kit' : 'Studio Kit'));
    tmp.id = '__previewDrums';
    const pat = SDAW.rhythmPattern(genre);
    A.init(); A.updateTrack(tmp);
    const step = 60 / (SDAW.GENRE_TEMPO[genre] || SDAW.store.song.tempo) / 4, t0 = A.ctx.currentTime + 0.03;
    for (let bar = 0; bar < 2; bar++) for (let s = 0; s < 16; s++) SDAW.DRUM_ROWS.forEach(r => { const v = pat.drum.rows[r.id][s]; if (v) playDrum(tmp, r.id, t0 + (bar * 16 + s) * step, v); });
  };

  /** Preview a chord progression with piano */
  A.previewProgression = function (genre) {
    const prog = SDAW.PROGRESSIONS[genre]; if (!prog) return;
    const tmp = SDAW.makeTrack(SDAW.findInstrument('Grand Piano')); tmp.id = '__previewKeys';
    A.init(); A.updateTrack(tmp);
    const bar = 60 / SDAW.store.song.tempo * 2, t0 = A.ctx.currentTime + 0.03;
    prog.degrees.slice(0, 4).forEach((d, i) => {
      const ch = SDAW.diatonicChord(prog.mode === 'minor' ? 'A' : 'C', prog.mode, d);
      ch.intervals.forEach(iv => playMelodic(tmp, 48 + ch.root + iv + (ch.root > 7 ? -12 : 0) + 12, t0 + i * bar, bar * 0.95, { vel: 85 }));
    });
  };

  /* ======================================================= TRANSPORT == */

  /**
   * Build tick -> events index from the clips of every track.
   * Pattern clips repeat their pattern inside the clip length.
   * In pattern mode only the current pattern is indexed (looping).
   */
  A.rebuildIndex = function () {
    const store = SDAW.store, song = store.song, idx = {};
    const add = (tick, ev) => { (idx[tick] = idx[tick] || []).push(ev); };
    // a clip plays its pattern from `offset` (when its left edge was trimmed), repeating
    const addPattern = (t, p, start, len, offset) => {
      if (!p || !p.length) return;
      const L = p.length, o = (offset || 0) % L;
      if (p.kind === 'drums') {
        for (let k = 0; k < len; k++) {
          const st = (o + k) % L;
          SDAW.DRUM_ROWS.forEach(r => { const v = p.drum.rows[r.id][st]; if (v) add(start + k, { track: t, drum: r.id, vel: v }); });
        }
      } else {
        // ties: a tied note is not played again, the previous one lasts longer
        const eff = {};
        const sorted = p.notes.slice().sort((a, b) => a.start - b.start);
        sorted.forEach(n => {
          if (!n.tie) return;
          const prev = sorted.filter(q => q !== n && q.pitch === n.pitch && (q.voice || 0) === (n.voice || 0) && q.start < n.start && Math.abs(q.start + (eff[q.id] || q.dur) - n.start) < 0.05).pop();
          if (prev) { const head = prev._tieHead || prev; eff[head.id] = (eff[head.id] || head.dur) + n.dur; n._tieHead = head; }
        });
        const byStart = {};
        p.notes.forEach(n => { if (n.start < L && !(n.tie && n._tieHead)) (byStart[n.start] = byStart[n.start] || []).push(n); });
        p.notes.forEach(n => { delete n._tieHead; });
        Object.keys(byStart).forEach(st => {
          const group = byStart[st];
          const up = group[0].tech && group[0].tech.strum === 'up';
          group.sort((a, b) => up ? b.pitch - a.pitch : a.pitch - b.pitch);
          for (let k = ((+st - o) % L + L) % L; k < len; k += L) {
            const at = start + k, whole = Math.floor(at + 1e-6);
            group.forEach((n, i) => add(whole, { track: t, note: n, strumIndex: i, frac: at - whole, dur: eff[n.id] || n.dur }));
          }
        });
      }
    };
    A.audioClips = [];
    if (A.patternMode) {
      const p = store.selPattern();
      if (p) {
        // play it with a track that uses it (or the selected / first matching track)
        let t = song.tracks.find(tr => tr.clips.some(c => c.patternId === p.id));
        if (!t) { const sel = store.selTrack(); t = sel && ((sel.type === 'drums') === (p.kind === 'drums')) ? sel : song.tracks.find(tr => (tr.type === 'drums') === (p.kind === 'drums')); }
        if (t) addPattern(t, p, 0, p.length);
        A.patternLen = p.length;
      }
    } else {
      song.tracks.forEach(t => t.clips.forEach(c => {
        if (c.kind === 'pattern') addPattern(t, store.pattern(c.patternId), c.start, c.len, c.offsetTicks);
        else if (c.kind === 'audio') { add(c.start, { track: t, audio: c }); A.audioClips.push({ track: t, clip: c }); }
      }));
    }
    A.index = idx;
  };
  SDAW.bus.on('change', () => { if (A.ctx && !A.offline) { A.rebuildIndex(); A.updateDelayTime(); SDAW.store.song.tracks.forEach(t => A.updateTrack(t)); } });

  function tickDur() { return 60 / SDAW.store.song.tempo / CONFIG.grid.ticksPerBeat; }

  /* ------------------------------------------------ playback order --- *
   * Repeats and alternate endings (song.barMarks) are "unfolded" into the
   * list of bars to play: |: A | B |1. C :|2. D |  ->  A B C A B D
   * ------------------------------------------------------------------ */
  A.unfoldBars = function () {
    const song = SDAW.store.song, marks = song.barMarks || {}, N = song.bars, order = [];
    // ---- pass 1: repeats and alternate endings, until a D.C. / D.S. (or the end)
    let b = 0, repStart = 0, pass = 1, guard = 0, jump = null, jumpBar = -1;
    const done = {};
    let lastHadEnding = false;
    while (b < N && guard++ < 4000) {
      const m = marks[b] || {};
      if (m.rs && b !== repStart) { repStart = b; pass = 1; }
      if (m.end && m.end.length && !m.end.includes(pass)) { b++; continue; }
      if (!m.end && lastHadEnding) { pass = 1; repStart = b; }
      lastHadEnding = !!(m.end && m.end.length);
      order.push(b);
      if (m.re) {
        const times = Math.max(2, m.re | 0 || 2);
        const n = done[b] || 0;
        if (n < times - 1) { done[b] = n + 1; pass++; b = repStart; lastHadEnding = false; continue; }
        done[b] = 0;
      }
      if (m.jump) { jump = String(m.jump); jumpBar = b; break; }
      b++;
    }
    if (!jump) return order;
    /* ---- pass 2: after D.C. (from the start) or D.S. (from the segno), repeats are
     * played once, only the last alternate ending, and:
     *   "al Fine" stops at the Fine bar
     *   "al Coda" jumps from the "To Coda" bar (or from the D.C./D.S. bar) to the Coda bar
     *   plain D.C. / D.S. plays on to the end                                          */
    const find = k => { for (let x = 0; x < N; x++) if ((marks[x] || {})[k]) return x; return -1; };
    const codaBars = []; for (let x = 0; x < N; x++) if ((marks[x] || {}).coda) codaBars.push(x);
    const segno = find('segno');
    const target = /D\.?S/i.test(jump) ? Math.max(0, segno) : 0;
    const alFine = /fine/i.test(jump), alCoda = /coda/i.test(jump);
    let toCoda = find('tocoda');
    let codaStart = codaBars.find(x => x > jumpBar);
    if (toCoda < 0 && codaBars.length >= 2) toCoda = codaBars[0];          // two coda signs: the first is "To Coda"
    if (codaStart === undefined) codaStart = codaBars.length ? codaBars[codaBars.length - 1] : jumpBar + 1;
    const toEnd = from => { for (let y = from; y < N; y++) order.push(y); };
    for (let x = target; x < N && guard++ < 8000; x++) {
      const m = marks[x] || {};
      if (m.end && m.end.length) { const nx = marks[x + 1] || {}; if (nx.end && nx.end.length) continue; }   // only the last ending
      if (alCoda && x === codaStart && x > toCoda) break;                    // never walk into the coda by accident
      order.push(x);
      if (alFine && m.fine) return order;
      if (alCoda && toCoda >= 0 && x === toCoda) { toEnd(codaStart); return order; }
      if (x === jumpBar) {
        if (alCoda) { toEnd(codaStart); return order; }
        if (alFine) continue;                                               // no Fine mark: play on
      }
    }
    return order;
  };

  /** Build the sequence used by the scheduler: positions -> song ticks */
  function buildSequence() {
    if (A.patternMode) { A.seq = { linear: true, start: 0, end: A.patternLen || 16 }; return; }
    if (A.loop.on && A.loop.end !== null) { A.seq = { linear: true, start: A.loop.start, end: A.loop.end }; return; }
    const order = A.unfoldBars();
    const plain = order.every((bar, i) => bar === i) && order.length === SDAW.store.song.bars;
    if (plain) { A.seq = { linear: true, start: 0, end: SDAW.store.songTicks() }; return; }
    A.seq = { linear: false, order, start: 0, end: order.length * SDAW.barTicks() };
  }
  function seqTick(pos) {
    if (A.seq.linear) return pos;
    const B = SDAW.barTicks();
    return A.seq.order[Math.floor(pos / B)] * B + (pos % B);
  }
  function posOfTick(tick) {
    if (A.seq.linear) return SDAW.clamp(Math.floor(tick), A.seq.start, A.seq.end - 1);
    const B = SDAW.barTicks(), bar = Math.floor(tick / B), i = A.seq.order.indexOf(bar);
    return i < 0 ? 0 : i * B + Math.floor(tick % B);
  }

  /** Lookahead scheduler (runs every CONFIG.audio.lookaheadMs) */
  /**
   * Swing: the off-beat 8ths (or 16ths) are played late. song.swing 0..1
   * (1 = triplet feel 2:1), song.swingGrid 8 | 16. Returns the delay in ticks.
   */
  function swingShift(tick, frac) {
    const song = SDAW.store.song, sw = song.swing || 0;
    if (!sw) return 0;
    const unit = song.swingGrid === 16 ? 2 : 4;            // ticks per swung pair
    const x = (tick % unit) + frac, half = unit / 2, late = sw * unit / 6;
    const y = x < half ? x * (half + late) / half : half + late + (x - half) * (half - late) / half;
    return y - x;
  }
  function schedule() {
    const c = A.ctx, td = tickDur();
    const anySolo = SDAW.store.song.tracks.some(x => x.solo);
    const DYN = { ppp: 30, pp: 45, p: 60, mp: 75, mf: 90, f: 105, ff: 118, fff: 127 };
    while (A.nextTime < c.currentTime + CONFIG.audio.scheduleAheadSec) {
      if (A.endTimer && A.pos >= A.seq.end) break;   // end already reached: nothing more to schedule (and don't push the stop timer later)
      const tick = seqTick(A.pos);
      A.tl.push([A.nextTime, tick]);
      dispatch(tick, A.nextTime, td, anySolo, DYN);
      if (CONFIG.audio.metronome && tick % SDAW.beatTicks() === 0) {          // a click on every beat of the meter
        const o = c.createOscillator(); o.frequency.value = tick % SDAW.barTicks() === 0 ? 1600 : 1000;
        o.connect(env(A.master, A.nextTime, CONFIG.audio.metronomeVolume, 0.001, 0, 0.05)); o.start(A.nextTime); o.stop(A.nextTime + 0.08);
      }
      A.pos++;
      A.nextTime += td;
      if (A.pos >= A.seq.end) {
        if (A.loop.on || A.patternMode) A.pos = A.seq.start;
        else {
          // natural end: stop when the last tick has sounded (only THIS run: a new ▶ cancels the timer)
          A.endAt = A.nextTime;
          const run = A.runId;
          clearTimeout(A.endTimer);
          A.endTimer = setTimeout(() => { A.endTimer = null; if (A.runId === run && A.playing) { A.stop(); A.stopTick = A.seq.start || 0; } }, (A.nextTime - c.currentTime) * 1000);
          A.pos = A.seq.end; break;
        }
      }
    }
    if (A.tl.length > 3000) A.tl.splice(0, A.tl.length - 1500);
  }

  /* ---------------------------------------------- automation ------ *
   * track.auto = { vol: [{ t: tick, v: 0..1 }], pan: [{ t, v: -1..1 }] }
   * Values between points are interpolated linearly; before the first
   * point the first value holds, after the last the last value holds.   */
  SDAW.autoValue = function (pts, tick) {
    if (!pts || !pts.length) return null;
    if (tick <= pts[0].t) return pts[0].v;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (tick <= b.t) return b.t === a.t ? b.v : a.v + (b.v - a.v) * (tick - a.t) / (b.t - a.t);
    }
    return pts[pts.length - 1].v;
  };
  const hasAuto = (t, k) => !!(t.auto && t.auto[k] && t.auto[k].length);
  const audibleTrack = (t, anySolo) => !t.mute && (!anySolo || t.solo);
  const volGain = v => v * v * 1.2;
  /** Ramp the volume / pan of automated tracks to their value at `tick` */
  function applyAutomation(tick, at, anySolo, jump) {
    if (A.patternMode) return;
    SDAW.store.song.tracks.forEach(t => {
      if (!t.auto) return;
      const ch = getChain(t);
      if (t.plugin && SDAW.desktop && SDAW.desktop.on && !A.offline)
        SDAW.desktop.trackParams(t, hasAuto(t, 'vol') ? SDAW.autoValue(t.auto.vol, tick) : t.vol, hasAuto(t, 'pan') ? SDAW.autoValue(t.auto.pan, tick) : t.pan);
      if (hasAuto(t, 'vol')) {
        const v = audibleTrack(t, anySolo) ? volGain(SDAW.autoValue(t.auto.vol, tick)) : 0;
        if (jump) { ch.vol.gain.cancelScheduledValues(at); ch.vol.gain.setValueAtTime(v, at); } else ch.vol.gain.linearRampToValueAtTime(v, at);
      }
      if (hasAuto(t, 'pan') && ch.pan.pan) {
        const v = SDAW.clamp(SDAW.autoValue(t.auto.pan, tick), -1, 1);
        if (jump) { ch.pan.pan.cancelScheduledValues(at); ch.pan.pan.setValueAtTime(v, at); } else ch.pan.pan.linearRampToValueAtTime(v, at);
      }
    });
  }

  /** Play every event of one tick at a given context time */
  function dispatch(tick, at, td, anySolo, DYN) {
      applyAutomation(tick, at, anySolo, false);
      const evs = A.index[tick] || [];
      evs.forEach(ev => {
        const t = ev.track;
        if (t.mute || (anySolo && !t.solo)) return;
        const time = at + ((ev.frac || 0) + swingShift(tick, ev.frac || 0)) * td;
        if (ev.drum) { if (!(t.midiOut && SDAW.midiOut.drum(t, ev.drum, ev.vel, time))) playDrum(t, ev.drum, time, ev.vel); }
        else if (ev.audio) playAudioClip(t, ev.audio, time, 0);
        else {
          const n = ev.note, tech = n.tech || {};
          let vel = n.dyn ? DYN[n.dyn] : n.vel;
          if (tech.accent) vel = Math.min(127, vel + 25);
          if (tech.ghost) vel = Math.round(vel * 0.45);
          let dur = (ev.dur || n.dur) * td;
          if (tech.stacc) dur *= 0.45;
          if (tech.ring) dur = Math.max(dur * 3, 1.5);
          if (t.midiOut && SDAW.midiOut.note(t, n.pitch, vel, time, dur)) { A.lastPitch[t.id] = n.pitch; return; }
          const hum = (t.technique && t.technique.humanize || 0) * 0.012 * (Math.random() - 0.5);
          if (tech.trem) {                      // tremolo picking: repeated 32nd notes
            const step = td / 2;
            for (let x = 0; x < dur - step * 0.5; x += step) playMelodic(t, n.pitch, time + x, step * 0.9, { vel: vel * (x ? 0.85 : 1), tech: {}, strumIndex: ev.strumIndex, string: n.string, fret: n.fret, tick: tick + (ev.frac || 0) });
          } else playMelodic(t, n.pitch, time + Math.max(0, hum), dur, { vel, tech, prevPitch: A.lastPitch[t.id], strumIndex: ev.strumIndex, string: n.string, fret: n.fret, tick: tick + (ev.frac || 0) });
          A.lastPitch[t.id] = n.pitch;
        }
      });
  }

  /* ================================================== OFFLINE RENDER === *
   * The whole song (repeats unfolded, mute / solo respected, every pedal and
   * bus) is rendered into an AudioBuffer by an OfflineAudioContext — much
   * faster than real time. The live graph is swapped out and restored.      */
  async function preloadSamples() {
    const song = SDAW.store.song, ids = new Set((song.samples || []).map(x => x.id));
    song.tracks.forEach(t => {
      Object.values(t.drumMap || {}).forEach(id => ids.add(id));
      ((t.sampler && t.sampler.zones) || []).forEach(z => ids.add(z.sampleId));
      t.clips.forEach(c => { if (c.kind === 'audio') ids.add(c.sampleId); });
    });
    const jobs = [];
    ids.forEach(id => {
      if (!id) return;
      if (id.startsWith('fac:')) jobs.push(SDAW.factory.load(id.slice(4)).catch(() => null));
      else { SDAW.samples.buffer(id); const p = SDAW.samples.pending[id]; if (p) jobs.push(p.catch(() => null)); }
    });
    await Promise.all(jobs);
  }
  /**
   * Notes of the plugin tracks for an export, as dispatch() would play them:
   * { trackId: [[seconds, key, vel, channel], …] } (seconds from the song start).
   */
  const trackById = (id) => SDAW.store.track(id);
  function collectPluginEvents(td, anySolo, DYN) {
    const out = {};
    for (let pos = A.seq.start, i = 0; pos < A.seq.end; pos++, i++) {
      const tick = seqTick(pos), evs = A.index[tick];
      if (!evs) continue;
      evs.forEach(ev => {
        const t = ev.track;
        if (!t.plugin || t.mute || (anySolo && !t.solo)) return;
        const at = (i + (ev.frac || 0) + swingShift(tick, ev.frac || 0)) * td;
        const list = out[t.id] = out[t.id] || [];
        if (ev.drum) {
          const k = SDAW.desktop.drumNote(t, ev.drum); if (k === undefined) return;
          const dch = SDAW.desktop.channelOf(t, true);                // the same channel as live (desktop.js)
          list.push([at, k, Math.round((ev.vel || 0.8) * 127), dch], [at + 0.12, k, 0, dch]);
          return;
        }
        if (!ev.note) return;
        const n = ev.note, tech = n.tech || {};
        let vel = n.dyn ? DYN[n.dyn] : n.vel;
        if (tech.accent) vel = Math.min(127, vel + 25);
        if (tech.ghost) vel = Math.round(vel * 0.45);
        let dur = (ev.dur || n.dur) * td;
        if (tech.stacc) dur *= 0.45;
        if (tech.ring) dur = Math.max(dur * 3, 1.5);
        const nch = SDAW.desktop.channelOf(t, false);
        list.push([at, n.pitch, Math.max(1, Math.round(vel || 100)), nch], [at + Math.max(0.01, dur), n.pitch, 0, nch]);
      });
    }
    return out;
  }

  A.renderOffline = async function (opts) {
    opts = opts || {};
    A.init();
    if (A.playing) A.stop();
    await preloadSamples();
    const keep = ['ctx', 'master', 'masterAnalyser', 'reverbBus', 'delayBus', 'noise', 'chains', 'active', 'lastPitch', 'seq', 'pos', 'nextTime', 'tl', 'loop', 'patternMode', 'index', 'audioClips'];
    const saved = {}; keep.forEach(k => { saved[k] = A[k]; });
    const metro = CONFIG.audio.metronome;
    // the export renders a FIXED copy of the project: edits made meanwhile are refused (store.rendering)
    // and nothing of the render touches the live project, the playback context or the cursor
    const store = SDAW.store, liveSong = store.song;
    store.song = SDAW.deepCopy(liveSong);
    store.rendering = true;
    try {
      A.patternMode = false; A.loop = { on: false, start: 0, end: null }; CONFIG.audio.metronome = false;
      A.rebuildIndex(); buildSequence();
      const td = tickDur(), sr = opts.sampleRate || saved.ctx.sampleRate || 44100;
      const seconds = 0.15 + (A.seq.end - A.seq.start) * td + (opts.tail === undefined ? 3 : opts.tail);
      const oc = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
      A.ctx = oc; A.chains = {}; A.active = []; A.lastPitch = {}; A.offline = true;
      buildGraph(oc);
      SDAW.store.song.tracks.forEach(t => A.updateTrack(t));
      // Guitar Rig tracks: engines, recordings, amp captures and IRs must be ready before rendering
      if (SDAW.guitarRig) { if (opts.onProgress) opts.onProgress(0.005); await SDAW.guitarRig.prepareOffline(oc); }
      if (SDAW.pianoRig) await SDAW.pianoRig.prepareOffline(oc);
      if (SDAW.windRig) await SDAW.windRig.prepareOffline(oc);
      const anySolo = SDAW.store.song.tracks.some(x => x.solo);
      applyAutomation(seqTick(A.seq.start), 0.1, anySolo, true);
      const DYN = { ppp: 30, pp: 45, p: 60, mp: 75, mf: 90, f: 105, ff: 118, fff: 127 };
      // plugin tracks (Windows version): rendered by the native engine, then mixed through their track chain
      if (SDAW.desktop && SDAW.desktop.on) {
        const evs = collectPluginEvents(td, anySolo, DYN);
        if (Object.keys(evs).length) {
          if (opts.onProgress) opts.onProgress(0.01);
          const bufs = await SDAW.desktop.renderTracks(evs, seconds, oc);
          Object.keys(bufs).forEach(id => {
            const t = trackById(id); if (!t) return;
            const src = oc.createBufferSource(); src.buffer = bufs[id];
            src.connect(getChain(t).input); src.start(0.1);
          });
        }
      }
      // schedule window by window (like the live scheduler): few nodes alive at a time
      let time = 0.1, pos = A.seq.start;
      const scheduleUntil = (limit) => {
        while (pos < A.seq.end && time < limit) { dispatch(seqTick(pos), time, td, anySolo, DYN); pos++; time += td; }
        // Guitar Rig note-offs held back for slides / hammer-ons: final once every earlier note is known
        if (SDAW.guitarRig) SDAW.guitarRig.flushOffline(oc, pos >= A.seq.end ? Infinity : limit);
        if (SDAW.pianoRig) SDAW.pianoRig.flushOffline(oc, pos >= A.seq.end ? Infinity : limit);
        if (SDAW.windRig) SDAW.windRig.flushOffline(oc, pos >= A.seq.end ? Infinity : limit);
      };
      const WIN = 3;
      scheduleUntil(WIN + 1);
      for (let t = WIN; t < seconds - 0.2; t += WIN) {
        oc.suspend(t).then(() => {
          // whatever happens in this window, the render must go on (a stuck suspend would hang the export)
          try {
            scheduleUntil(t + WIN + 1);
            A.active = A.active.filter(a => a.end > t);
            if (opts.onProgress) opts.onProgress(t / seconds);
          } catch (err) { console.warn('render window', t, err); A.renderErrors = (A.renderErrors || 0) + 1; }
          finally { oc.resume(); }
        }).catch(() => {});
      }
      const buf = await oc.startRendering();
      if (opts.onProgress) opts.onProgress(1);
      return buf;
    } finally {
      keep.forEach(k => { A[k] = saved[k]; });
      A.offline = false;
      store.song = liveSong; store.rendering = false;
      CONFIG.audio.metronome = metro;
      A.rebuildIndex();
    }
  };

  A.play = function (fromTick, popts) {
    A.init();
    if (A.playing || A.preparing) return;
    // real instruments (Guitar / Piano / Wind Rig) still loading their recordings, amp captures or
    // IRs: wait for them, so the first notes already have the real sound (Stop cancels the wait)
    if (!(popts && popts.noWait)) {
      const waits = [];
      SDAW.store.song.tracks.forEach(t => [SDAW.guitarRig, SDAW.pianoRig, SDAW.windRig].forEach(R => {
        const w = R && R.whenReady ? R.whenReady(t) : null; if (w) waits.push(w);
      }));
      if (waits.length) {
        const id = A.prepId = (A.prepId || 0) + 1;
        A.preparing = true;
        SDAW.bus.emit('transport', { playing: false, preparing: true });
        if (SDAW.toast) SDAW.toast('⏳ Loading the real instruments (' + waits.length + ' track' + (waits.length > 1 ? 's' : '') + ')… the song starts when they are ready');
        const limit = new Promise(r => setTimeout(r, (CONFIG.audio.prepareTimeoutSec || 20) * 1000));
        Promise.race([Promise.all(waits), limit]).then(() => {
          if (A.prepId !== id || !A.preparing) return;          // Stop was pressed meanwhile
          A.preparing = false;
          A.play(fromTick, { noWait: true });
        });
        return;
      }
    }
    A.runId = (A.runId || 0) + 1;
    clearTimeout(A.endTimer); A.endTimer = null;
    A.rebuildIndex();
    buildSequence();
    A.playing = true;
    A.startTick = fromTick || 0;
    if (A.patternMode) A.startTick = A.startTick % (A.patternLen || 16);
    A.pos = posOfTick(A.startTick);
    A.startTick = seqTick(A.pos);
    A.startTime = A.ctx.currentTime + 0.06;
    A.nextTime = A.startTime;
    A.tl = [];
    A.lastPitch = {};
    (A.audioClips || []).forEach(({ track, clip }) => {
      if (clip.start < A.startTick && clip.start + clip.len > A.startTick) playAudioClip(track, clip, A.startTime, A.startTick - clip.start);
    });
    applyAutomation(A.startTick, A.startTime, SDAW.store.song.tracks.some(x => x.solo), true);
    if (SDAW.midiOut) SDAW.midiOut.start();
    if (SDAW.desktop && SDAW.desktop.on) SDAW.desktop.transport(true, A.startTick, A.startTime);
    A.timer = setInterval(schedule, CONFIG.audio.lookaheadMs);
    schedule();
    SDAW.bus.emit('transport', { playing: true });
  };

  A.stop = function () {
    if (A.preparing) { A.preparing = false; A.prepId = (A.prepId || 0) + 1; SDAW.bus.emit('transport', { playing: false }); return; }
    if (!A.playing) return;
    // the position must be read while the transport still runs (getTick returns stopTick once stopped)
    A.stopTick = A.getTick();
    A.playing = false;
    clearInterval(A.timer);
    clearTimeout(A.endTimer); A.endTimer = null;
    // silence everything that is still sounding
    const now = A.ctx.currentTime;
    A.active.forEach(a => { try { a.src.stop(now + 0.03); } catch (e) { /* already stopped */ } });
    A.active = [];
    if (SDAW.guitarRig) SDAW.guitarRig.stopAll();
    if (SDAW.pianoRig) SDAW.pianoRig.stopAll();
    if (SDAW.windRig) SDAW.windRig.stopAll();
    if (SDAW.midiOut) SDAW.midiOut.panic();
    if (SDAW.desktop && SDAW.desktop.on) { SDAW.desktop.allOff(); SDAW.desktop.transport(false); }
    // back from automation to the fader values
    SDAW.store.song.tracks.forEach(t => {
      if (!t.auto || !A.chains[t.id]) return;
      const ch = A.chains[t.id]; ch.vol.gain.cancelScheduledValues(now); if (ch.pan.pan) ch.pan.pan.cancelScheduledValues(now);
      A.updateTrack(t);
    });
    SDAW.bus.emit('transport', { playing: false });
  };

  /** Current playhead position in ticks (float), with loop wrap */
  /** Current playhead position (song ticks, float) from the scheduled timeline */
  A.getTick = function () {
    if (!A.playing || !A.ctx) return A.stopTick || 0;
    const now = A.ctx.currentTime, tl = A.tl;
    if (!tl || !tl.length || now < tl[0][0]) return A.startTick;
    let lo = 0, hi = tl.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tl[mid][0] <= now) lo = mid; else hi = mid - 1; }
    return tl[lo][1] + Math.min(0.999, (now - tl[lo][0]) / tickDur());
  };
  /** Song tick that was (or will be) heard at a given AudioContext time */
  A.tickAtTime = function (time) {
    const tl = A.tl;
    if (!tl || !tl.length) return A.startTick || 0;
    if (time <= tl[0][0]) return tl[0][1] - (tl[0][0] - time) / tickDur();   // may be < 0 (before the song start)
    let lo = 0, hi = tl.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tl[mid][0] <= time) lo = mid; else hi = mid - 1; }
    return tl[lo][1] + (time - tl[lo][0]) / tickDur();
  };
  A.seek = function (tick) {
    const was = A.playing || A.preparing;
    if (was) A.stop();
    const length = A.patternMode ? (A.patternLen || 16) : SDAW.store.songTicks();
    A.stopTick = SDAW.clamp(tick, 0, Math.max(0, length - 1));
    if (was) A.play(A.stopTick);
    else SDAW.bus.emit('transport', { playing: false, seek: true });
  };

  A.tickDur = tickDur;
  A.setPatternMode = function (on) {
    const was = A.playing; if (was) A.stop();
    A.patternMode = on; A.stopTick = 0;
    if (was) A.play(0);
    SDAW.bus.emit('transport', { patternMode: on });
  };

  /** Meter level (RMS, 0..1) for a track id or 'master' */
  const meterBuf = new Float32Array(1024);
  A.getLevel = function (id) {
    const pt = id !== 'master' && SDAW.desktop && SDAW.desktop.on ? SDAW.store.track(id) : null;
    if (pt && pt.plugin) return SDAW.desktop.level(pt);                     // plugin track: meter of the native engine
    if (!A.ctx) return 0;
    const an = id === 'master' ? A.masterAnalyser : (A.chains[id] && A.chains[id].analyser);
    if (!an) return 0;
    const buf = meterBuf.subarray(0, an.fftSize);
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.min(1, Math.sqrt(s / buf.length) * 3);
  };

})(window.SDAW);
