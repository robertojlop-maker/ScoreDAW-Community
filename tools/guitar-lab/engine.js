/* =====================================================================
 *  GUITAR LAB — engine.js : physical-model guitar engine
 *  ---------------------------------------------------------------------
 *  1. STRINGS (AudioWorklet, sample by sample)  — GL.workletMain
 *     Six digital-waveguide strings (extended Karplus-Strong):
 *       · exact tuning: integer delay + 1st-order Thiran all-pass, with the
 *         phase delay of the loss and dispersion filters compensated
 *       · frequency-dependent loss filter + sustain per pitch (low E / high E)
 *       · stiffness = cascade of dispersion all-passes (inharmonic partials)
 *       · TWO polarizations (two loops, slightly detuned, different decay)
 *         → beating and two-stage decay, like a real string
 *       · passive bridge coupling between the six strings → sympathetic
 *         resonance (open strings ring with the notes played)
 *       · excitation built per pluck: finger / nail / thumb / pick contact
 *         pulse + noise, hardness low-pass, comb at the pluck position,
 *         woody knock tail; separate pick / nail click outside the loop
 *       · magnetic pickups: comb filters at each pickup position
 *         (humbucker = two coils), any selector combination
 *       · palm mute, finger release damping, re-pluck, hammer-on / pull-off,
 *         slides (glide), bends, delayed vibrato, natural harmonics,
 *         dead (muted) notes, left-hand string squeaks
 *  2. BODY / CAPTURE / AMP / FX (Web Audio graph) — GL.Engine
 *     acoustic: body modes (air + top + plates) → mic position / distance,
 *               under-saddle piezo blend
 *     electric: pickup electrical resonance + tone & volume knobs →
 *               two-stage tube-style pre-amp → tone stack → presence →
 *               cabinet + mic; hollow body adds its acoustic body to the pickup
 *     common:   low / high cut, compressor, chorus, delay, reverb (generated IR),
 *               output, limiter, analyser
 *  3. OFFLINE RENDER — GL.renderOffline (WAV export, tests)
 * ===================================================================== */
(function () {
  'use strict';
  const GL = window.GL = window.GL || {};

  /* ================================================== 1. THE WORKLET == */
  /* Everything inside this function runs in the AudioWorkletGlobalScope.
   * It is serialized with toString() into a Blob URL, so the lab also works
   * when index.html is opened directly from disk (file://).               */
  GL.workletMain = function () {
    const MAXN = 8192, MASK = MAXN - 1;           // delay buffers (power of two)
    const LOW_E = 82.4069, HIGH_E = 329.628;
    const DETUNE_SHAPE = [0.31, -0.72, 0.48, -0.19, 0.83, -0.41];   // fixed "imperfection" pattern
    // every string has its own stiffness (gauge, core, winding): the plain trebles are the
    // stiffest. Different stretch per string = the partials of a chord never line up exactly,
    // so their beating is a natural shimmer instead of a slow, regular "phaser / waah" sweep.
    const STIFF_SHAPE = [0.55, 0.65, 0.8, 1.0, 1.45, 1.85];
    const TWO_PI = Math.PI * 2;
    let seed = 0x2F6E2B1;
    function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
    const rn = () => rnd() * 2 - 1;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const midiHz = (m, a4) => a4 * Math.pow(2, (m - 69) / 12);
    /** phase delay (samples) of the all-pass (c + z^-1) / (1 + c z^-1) at w rad/sample */
    function apPD(c, w) {
      const ph = Math.atan2(-Math.sin(w), c + Math.cos(w)) - Math.atan2(-c * Math.sin(w), 1 + c * Math.cos(w));
      return -ph / w;
    }
    /** Lagrange 4-point weights for a delay of `d` samples → stores [D, c0, c1, c2, c3] in out */
    function lagrange(d, out) {
      d = Math.max(2, d);
      const Di = Math.floor(d), t = d - Di;
      out[0] = Di;
      out[1] = -t * (t - 1) * (t - 2) / 6;
      out[2] = (t + 1) * (t - 1) * (t - 2) / 2;
      out[3] = -(t + 1) * t * (t - 2) / 2;
      out[4] = (t + 1) * t * (t - 1) / 6;
      return out;
    }
    /** phase delay of the one-pole low-pass (1-a) / (1 - a z^-1) */
    function lpPD(a, w) { return Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) / w; }

    /* ------------------------------------------------------- a string */
    class GString {
      constructor(idx, sr) {
        this.i = idx; this.sr = sr;
        this.h = new Float32Array(MAXN); this.v = new Float32Array(MAXN); this.hist = new Float32Array(MAXN);
        this.dx = new Float32Array(4); this.dy = new Float32Array(4); this.dx2 = new Float32Array(4); this.dy2 = new Float32Array(4);
        this.exc = new Float32Array(Math.ceil(sr * 0.16)); this.excLen = 0; this.excPos = 0;
        this.clk = new Float32Array(Math.ceil(sr * 0.012)); this.clkLen = 0; this.clkPos = 0;
        this.knk = new Float32Array(Math.ceil(sr * 0.06)); this.knkLen = 0; this.knkPos = 0;
        this.w = 0; this.lp = 0; this.lp2 = 0;
        this.L1 = new Float64Array(5); this.L2 = new Float64Array(5); this.L1[0] = this.L2[0] = 100; this.g = 0.99; this.g2 = 0.99; this.a = 0.3; this.a2 = 0.5; this.c = 0; this.K = 1;
        this.freq = 110; this.target = 110; this.glideMul = 1; this.curF = 110;
        this.bend = 0; this.bendTarget = 0; this.bendStep = 0;
        this.vib = false; this.vibStart = 0; this.vibOff = 0;
        this.damp = 0; this.dampTarget = 0; this.dampStep = 0;
        this.pm = 0; this.harm = false; this.detune = 0; this.tmod = 0; this.noteDet = 0; this.drift = 0; this.driftT = 0; this.driftTarget = 0;
        this.fadeLen = 0; this.fadePos = 0; this.adEnv = 0; this.ckKeep = 1; this.ckPos = 0; this.ckLen = 0; this.noteId = 0;
        this.taps = []; this.cplK = 0; this.gl = 0.7; this.gr = 0.7; this.out = 0; this.pick = 0; this.dirty = true;
      }
      reset() {
        this.h.fill(0); this.v.fill(0); this.hist.fill(0); this.dx.fill(0); this.dy.fill(0); this.dx2.fill(0); this.dy2.fill(0);
        this.lp = this.lp2 = 0; this.ckLen = 0; this.excLen = this.excPos = 0; this.clkLen = this.clkPos = 0; this.knkLen = this.knkPos = 0;
      }
      /** Recompute every loop coefficient from the current pitch / damping state */
      retune(P) {
        const sr = this.sr;
        const semis = this.bend + this.vibOff + (this.detune + this.tmod + this.noteDet + this.drift) / 100;
        const f = clamp(this.freq * Math.pow(2, semis / 12), 25, sr / 5);
        this.curF = f;
        const w = TWO_PI * f / sr;
        // sustain: interpolate low-E → high-E in log-frequency (extrapolates beyond)
        const t = Math.log(f / LOW_E) / Math.log(HIGH_E / LOW_E);
        let T60 = clamp(P.decayLow * Math.pow(P.decayHigh / P.decayLow, t), 0.05, 40);
        if (this.harm) T60 *= 1.25;
        const pm = this.pm, d = this.damp;
        if (pm > 0) T60 = Math.pow(T60, 1 - pm) * Math.pow(0.12, pm);              // palm on the strings
        if (d > 0) T60 = Math.pow(T60, 1 - d) * Math.pow(0.02, d);                 // fingers release / mute
        // loss filter, designed from TWO decay targets (Välimäki-style):
        //   the fundamental fades in T60, the harmonics around 2.5 kHz fade `ratio` times faster.
        //   Real strings: nylon highs die ~10–15× faster than the fundamental, steel ~4–6×.
        //   (A fixed one-pole lets the upper harmonics ring far too long → metallic "zing".)
        let ratio = 3 * Math.pow(40 / 3, 1 - P.brightness);
        ratio /= 1 + P.brightTrack * clamp(Math.log2(f / 130), 0, 3) * 0.3;    // treble strings keep some sparkle
        ratio *= 1 + 6 * pm + 4 * d;                                            // palm / fingers kill the highs first
        ratio *= 1 + 10 * P.attackDamp * this.adEnv;                            // Attack lab: tame the first-moment zing
        ratio *= Math.pow(3, -(P.trebleTone || 0) * clamp((f - 200) / 600, 0, 1)); // treble strings warmer / brighter
        const fh = Math.min(sr * 0.4, Math.max(2500, 3 * f)), wh = TWO_PI * fh / sr, ch = Math.cos(wh);
        const g0 = Math.pow(10, -3 / (T60 * f)), gh = Math.pow(10, -3 / (T60 / ratio * f));
        const m = clamp(gh / g0, 1e-4, 0.99999), m2 = m * m;
        const A = m2 - 1, Bq = 2 - 2 * m2 * ch;
        const disc = Math.sqrt(Math.max(0, Bq * Bq - 4 * A * A));
        let a = (-Bq + disc) / (2 * A);
        if (!(a >= 0 && a < 1)) a = (-Bq - disc) / (2 * A);
        a = clamp(isFinite(a) ? a : 0.5, 0, 0.97);
        // stiffness: K all-passes with negative coefficient = partials go sharp
        let K = P.inharmStages | 0; const c = Math.max(-0.9, -P.inharm * STIFF_SHAPE[this.i]);
        const dl = lpPD(a, w);
        let rem = sr / f - dl - K * apPD(c, w);
        while (rem < 4 && K > 0) { K--; rem = sr / f - dl - K * apPD(c, w); }
        this.K = K; this.c = c; this.a = a;
        // the 2nd (vertical) plane loses its highs faster → no "flanger" swirl on the upper partials
        this.a2 = a + (0.95 - a) * 0.35;
        // fractional delay: 4-point Lagrange (no internal state → pitch can glide smoothly:
        // vibrato, bends, attack pitch drop and drift without zipper noise or clicks)
        this.lag1 = lagrange(rem, this.L1);
        this.g = Math.min(0.99999, Math.pow(10, -3 / (T60 * f)));
        // sympathetic drive scaled by the resonance gain of this string, so that
        // "Sympathetic resonance" 0.3 ≈ open strings ringing ~-52 dB after the note is muted (1.0 ≈ -42 dB)
        this.cplK = 2.5 * (1 - this.g) / (sr / f);
        // 2nd polarization: slightly sharp, longer (or shorter) sustain
        const f2 = f * Math.pow(2, P.polDetune / 1200), w2 = TWO_PI * f2 / sr;
        const rem2 = sr / f2 - lpPD(this.a2, w2) - K * apPD(c, w2);
        this.lag2 = lagrange(rem2, this.L2);
        this.g2 = Math.min(0.99999, Math.pow(10, -3 / (T60 * P.polDecay * f2)));
        // magnetic pickups: delay of each coil = position along the string × period
        const D = sr / f;
        this.taps = (P.electric ? P.taps : []).map(tp => ({
          P1: Math.max(1, Math.round(tp.pos * D)), P2: tp.width > 0 ? Math.max(1, Math.round((tp.pos + tp.width) * D)) : 0, g: tp.g
        }));
        // equal-power pan of this string
        const pan = ((this.i - 2.5) / 2.5) * P.stringSpread;
        this.gl = Math.cos((pan + 1) * Math.PI / 4); this.gr = Math.sin((pan + 1) * Math.PI / 4);
      }
      /** Build the excitation (what the finger / pick injects) and the attack click */
      excite(P, vel, o) {
        const sr = this.sr, D = sr / this.curF, vr = P.pluckVar;
        const mode = P.pluckMode;
        let hard = P.hardness + (vel - 0.7) * P.velBright * 0.8 + rn() * 0.08 * vr;
        let noise = P.noiseMix, len = P.excLen, click = P.attackNoise;
        // a nail on nylon is a soft "tic" in the mids, not the bright tick of a plectrum
        let tone = P.attackTone;
        if (mode === 'nail') { hard = 0.3 + hard * 0.6; noise += 0.03; click *= 0.6; tone *= 0.6; }
        else if (mode === 'finger') { hard *= 0.75; noise *= 0.5; click *= 0.3; len *= 1.2; tone *= 0.4; }
        else if (mode === 'thumb') { hard *= 0.45; noise *= 0.4; click *= 0.15; len *= 1.6; tone *= 0.3; }
        if (o.pm) { hard *= 0.6; click *= 0.6; }
        if (o.legato) { hard *= 0.5; noise *= 0.3; click = 0; }
        if (o.harm) { hard = Math.min(1, hard + 0.15); noise *= 0.5; }
        // Attack lab: switch parts of the attack off to find an unwanted sound
        const solo = P.attackSolo || 'Everything';
        const allOff = solo === 'Mute all transients';
        if (allOff || solo === 'Mute pluck noise') noise = 0;
        const muteClick = allOff || solo === 'Mute pick / nail click', muteKnock = allOff || solo === 'Mute woody knock';
        hard = clamp(hard, 0, 1); noise = clamp(noise, 0, 1);
        const L = Math.max(4, Math.min(Math.round(D * len * (1 + rn() * 0.1 * vr)), Math.floor(sr * 0.04)));
        const pos = clamp(P.pluckPos + rn() * 0.015 * vr, 0.03, 0.5);
        const Pp = Math.max(1, Math.round(pos * D));
        const W = Math.max(1, Math.round(P.fingerWidth * 0.08 * D));        // finger / pick width (samples)
        const total = Math.min(this.exc.length, L + Pp + W);
        const e = this.exc; e.fill(0, 0, total);
        // contact pulse (+ noise). A pick releases faster than flesh.
        const shape = (mode === 'pick' ? 0.6 : mode === 'nail' ? 0.9 : 1.6) * Math.pow(2, 1 - 2 * P.pluckSharp);
        for (let i = 0; i < L; i++) {
          const x = i / L;
          const pulse = Math.pow(Math.sin(Math.PI * x), shape) * (mode === 'pick' ? (1 - 0.5 * x) : 1);
          e[i] = (1 - noise) * pulse + noise * rn() * 0.9 * (1 - x * 0.5);
        }
        // contact low-pass: soft flesh ≈ 600 Hz … very hard pick ≈ 9 kHz, 4 poles.
        // A finger / nail / pick never puts much energy above ~8 kHz into a string:
        // more than that is heard as a synthetic "fizz" in the attack.
        const cap = mode === 'pick' ? 9000 : mode === 'nail' ? 7000 : mode === 'finger' ? 4500 : 3000;
        const fc = Math.min(sr * 0.45, cap, 600 * Math.pow(15, hard));
        const la = Math.exp(-TWO_PI * fc / sr);
        const passes = 4;
        for (let p = 0; p < passes; p++) { let y = 0; for (let i = 0; i < L + Pp; i++) { y += (1 - la) * (e[i] - y); e[i] = y; } }
        // comb at the pluck position (also removes DC)
        for (let i = L + Pp - 1; i >= Pp; i--) e[i] -= e[i - Pp];
        // a wide finger touches the string over a length → moving average (rounds the top)
        if (W > 1) {
          let acc = 0; const tmp = this.tmp || (this.tmp = new Float32Array(this.exc.length));
          for (let i = 0; i < total; i++) { acc += e[i]; if (i >= W) acc -= e[i - W]; tmp[i] = acc / W; }
          for (let i = 0; i < total; i++) e[i] = tmp[i];
        }
        // peak normalise
        let pk = 1e-9; for (let i = 0; i < total; i++) pk = Math.max(pk, Math.abs(e[i]));
        let amp = 0.6 * Math.pow(clamp(vel, 0.03, 1), 0.6 + P.velSens * 1.6);
        // a shorter string period receives fewer excitation samples (energy ∝ amp² × length):
        // compensate so the treble strings are not quieter than the basses
        amp *= clamp(Math.pow(this.curF / 110, 0.5), 0.85, 2.6);
        if (o.legato) amp *= P.legatoLevel * 0.55;
        if (o.harm) amp *= 0.7;
        if (o.dead) amp *= 0.6;
        for (let i = 0; i < total; i++) e[i] *= amp / pk;
        this.excLen = total; this.excPos = 0;
        // attack shaping state
        if (!o.legato) {
          this.fadeLen = Math.round(P.attackSoft / 1000 * sr); this.fadePos = 0;
          this.adEnv = P.attackDamp > 0 ? 1 : 0;
        }
        // woody knock: a short, dark thump of the body — added to the OUTPUT, not into the
        // string (inside the string loop it was comb-filtered into a metallic scrape)
        const wd = muteKnock ? 0 : P.woodiness * amp * 0.5 * (o.legato ? 0.2 : 1);
        if (wd > 0.0005) {
          const n = this.knk.length, ak = 1 - Math.exp(-TWO_PI * P.knockTone / sr), tau = sr * P.knockDecay / 1000;
          let y = 0, y2 = 0, mx = 1e-9;
          for (let i = 0; i < n; i++) { y += ak * (rn() - y); y2 += ak * (y - y2); this.knk[i] = y2 * Math.exp(-i / tau) * Math.min(1, i / (sr * 0.0007)); mx = Math.max(mx, Math.abs(this.knk[i])); }
          for (let i = 0; i < n; i++) this.knk[i] *= wd / mx;
          this.knkLen = n; this.knkPos = 0;
        } else this.knkLen = 0;
        // attack click (outside the loop): resonant band-pass on a noise burst
        const cl = muteClick ? 0 : click * amp;
        if (cl > 0.0005) {
          const n = this.clk.length, r = clamp(P.clickReso, 0, 0.97), wc = TWO_PI * clamp(tone * (0.8 + hard * 0.4), 300, sr * 0.42) / sr;
          const b1 = 2 * r * Math.cos(wc), b2 = -r * r, tau = sr * P.clickDecay / 1000;
          let y1 = 0, y2 = 0, mx = 1e-9;
          for (let i = 0; i < n; i++) { const y = rn() * Math.exp(-i / tau) + b1 * y1 + b2 * y2; y2 = y1; y1 = y; this.clk[i] = y; mx = Math.max(mx, Math.abs(y)); }
          for (let i = 0; i < n; i++) this.clk[i] *= cl * 0.6 / mx;
          this.clkLen = n; this.clkPos = 0;
        } else this.clkLen = 0;
      }
      /** One sample of both polarizations. cpl = bridge coupling input */
      tick(cpl) {
        const w = this.w;
        let e = 0;
        if (this.excPos < this.excLen) e = this.exc[this.excPos++];
        // horizontal polarization
        const L1 = this.L1, D1 = L1[0], h = this.h;
        const y = L1[1] * h[(w - D1 + 1) & MASK] + L1[2] * h[(w - D1) & MASK] + L1[3] * h[(w - D1 - 1) & MASK] + L1[4] * h[(w - D1 - 2) & MASK];
        const r = y;
        this.lp += (1 - this.a) * (y - this.lp);
        let s = this.g * this.lp;
        const c = this.c, K = this.K, dx = this.dx, dy = this.dy;
        for (let k = 0; k < K; k++) { const u = c * (s - dy[k]) + dx[k]; dx[k] = s; dy[k] = u; s = u; }
        let ck = 1;
        if (this.ckPos < this.ckLen) { ck = 1 + (this.ckKeep - 1) * (++this.ckPos / this.ckLen); if (this.ckPos === this.ckLen) ck = this.ckKeep; }
        this.h[w] = s * ck + e * this.ph + cpl;
        // vertical polarization
        const L2 = this.L2, D2 = L2[0], vv = this.v;
        const y2 = L2[1] * vv[(w - D2 + 1) & MASK] + L2[2] * vv[(w - D2) & MASK] + L2[3] * vv[(w - D2 - 1) & MASK] + L2[4] * vv[(w - D2 - 2) & MASK];
        const r2 = y2;
        this.lp2 += (1 - this.a2) * (y2 - this.lp2);
        let s2 = this.g2 * this.lp2;
        const dx2 = this.dx2, dy2 = this.dy2;
        for (let k = 0; k < K; k++) { const u = c * (s2 - dy2[k]) + dx2[k]; dx2[k] = s2; dy2[k] = u; s2 = u; }
        this.v[w] = s2 * ck + e * this.pv + cpl;
        const out = r + r2;
        this.hist[w] = out;
        // magnetic pickups (velocity sensing = difference at the coil position)
        let pk = 0;
        for (let i = 0; i < this.taps.length; i++) {
          const tp = this.taps[i];
          let v = out - this.hist[(w - tp.P1) & MASK];
          if (tp.P2) v = 0.5 * (v + out - this.hist[(w - tp.P2) & MASK]);
          pk += tp.g * v;
        }
        this.pick = pk;
        this.w = (w + 1) & MASK;
        this.out = out;
        return out;
      }
    }

    /* ---------------------------------------------------- processor */
    class GuitarProcessor extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const po = (options && options.processorOptions) || {};
        this.sr = sampleRate;
        this.P = Object.assign({
          a4: 440, open: [40, 45, 50, 55, 59, 64], decayLow: 8, decayHigh: 3.5, brightness: 0.6, brightTrack: 0.5, inharm: 0.08, inharmStages: 2,
          polDetune: 1.2, polMix: 0.25, polDecay: 1.3, coupling: 0.0008, tuningSpread: 2, stringSpread: 0.35, pluckMode: 'pick', pluckPos: 0.14,
          hardness: 0.6, noiseMix: 0.35, excLen: 0.6, attackNoise: 0.2, attackTone: 3500, velSens: 0.5, velBright: 0.5, restrikeKeep: 0.35, attackPitch: 3,
          woodiness: 0.3, pluckVar: 0.3, palmMute: 0.7, releaseTime: 90, squeak: 0.3, vibDepth: 22, vibRate: 5.2, vibDelay: 0.25, legatoLevel: 0.45,
          electric: false, taps: [], attackSolo: 'Everything', clickDecay: 0.9, clickReso: 0.78, knockTone: 650, knockDecay: 9, attackSoft: 0,
          attackDamp: 0, attackDampTime: 40, transient: 0, pluckSharp: 0.5, fingerWidth: 0.15, noteDetune: 1, drift: 0, trebleTone: 0
        }, po.params || {});
        this.st = []; for (let i = 0; i < 6; i++) this.st.push(new GString(i, this.sr));
        this.q = []; this.S = 0; this.sq = []; this.ef = 0; this.es = 0;
        this.applyParams();
        (po.events || []).forEach(e => this.push(e));
        this.port.onmessage = (m) => {
          const d = m.data;
          if (d.type === 'params') { Object.assign(this.P, d.p); this.applyParams(); }
          else if (d.type === 'evs') d.list.forEach(e => this.push(e));
          else if (d.type === 'stop') this.stopAll();
          else if (d.type === 'panic') { this.q = []; this.sq = []; this.st.forEach(s => { s.reset(); s.noteId = 0; }); }
        };
      }
      applyParams() {
        const P = this.P;
        this.st.forEach((s, i) => {
          s.detune = DETUNE_SHAPE[i] * P.tuningSpread;
          s.ph = 1 - P.polMix; s.pv = P.polMix;
          if (!s.noteId) { s.freq = s.target = midiHz(P.open[i], P.a4); }
          s.dirty = true;
        });
      }
      push(e) {
        e.frame = Math.round(e.t * this.sr);
        const q = this.q;
        let i = q.length; while (i > 0 && q[i - 1].frame > e.frame) i--;
        q.splice(i, 0, e);
      }
      stopAll() {
        this.q = [];
        this.st.forEach(s => { s.dampTarget = 1; s.dampStep = 1 / (0.05 * this.sr); s.vib = false; s.noteId = 0; });
        this.sq = [];
      }
      handle(e, frame) {
        const P = this.P, sr = this.sr;
        if (e.type === 'squeak') {
          this.sq.push({ pos: 0, len: Math.floor(e.dur * sr), f0: e.f0, f1: e.f1, amp: e.amp * P.squeak, y1: 0, y2: 0, gl: 0.75, gr: 0.65 });
          return;
        }
        const s = this.st[e.s]; if (!s) return;
        if (e.type === 'on') {
          const f = midiHz(e.midi, P.a4);
          s.harm = !!e.harm;
          s.pm = e.dead ? 1 : (e.pm ? P.palmMute : 0);
          s.vib = !!e.vib; s.vibMul = e.vibMul || 1; s.vibStart = frame + Math.round(P.vibDelay * sr); s.vibOff = 0;
          if (e.legato && s.noteId) {
            if (e.glide > 0) { s.target = f; s.glideMul = Math.pow(f / s.freq, 128 / (e.glide * sr)); }
            else { s.freq = s.target = f; }
            s.damp = 0; s.dampTarget = 0;
            s.retune(P); s.excite(P, e.vel, { legato: true });
          } else {
            // re-pluck: the old vibration is reduced smoothly during one period (an instant
            // jump of the whole string made a small "tick" on every repeated note)
            s.ckKeep = P.restrikeKeep; s.ckPos = 0; s.ckLen = Math.max(16, Math.round(s.L1[0]));
            s.freq = s.target = f; s.bend = s.bendTarget = 0;
            // tension modulation: a hard pluck starts a little sharp and settles (nylon most)
            s.tmod = P.attackPitch * e.vel * e.vel * (1 + rn() * 0.25 * P.pluckVar);
            s.noteDet = e.harm ? 0 : rn() * P.noteDetune;
            s.damp = 0; s.dampTarget = e.dead ? 0.75 : 0; s.dampStep = 1 / (0.015 * sr);
            s.retune(P); s.excite(P, e.vel, { pm: s.pm > 0, harm: s.harm, dead: !!e.dead });
          }
          s.noteId = e.id || 1;
        } else if (e.type === 'off') {
          if (e.id && e.id !== s.noteId) return;
          s.dampTarget = 1; s.dampStep = 1 / (Math.max(0.005, P.releaseTime / 1000) * sr); s.vib = false; s.noteId = 0;
        } else if (e.type === 'bend') {
          if (e.id && e.id !== s.noteId) return;
          s.bendTarget = e.semis; s.bendStep = Math.abs(e.semis - s.bend) / (Math.max(0.01, e.glide) * sr);
        }
      }
      /** per-block modulation: glides, bends, vibrato, damping ramps */
      block(frame, n) {
        const P = this.P, sr = this.sr;
        for (const s of this.st) {
          let ch = s.dirty;
          if (s.damp !== s.dampTarget) {
            const st = s.dampStep * n;
            s.damp = s.damp < s.dampTarget ? Math.min(s.dampTarget, s.damp + st) : Math.max(s.dampTarget, s.damp - st); ch = true;
          }
          if (s.freq !== s.target) {
            s.freq *= s.glideMul;
            if ((s.glideMul > 1 && s.freq >= s.target) || (s.glideMul < 1 && s.freq <= s.target) || s.glideMul === 1) s.freq = s.target;
            ch = true;
          }
          if (s.bend !== s.bendTarget) {
            const st = s.bendStep * n;
            s.bend = s.bend < s.bendTarget ? Math.min(s.bendTarget, s.bend + st) : Math.max(s.bendTarget, s.bend - st); ch = true;
          }
          if (s.adEnv > 0) {
            s.adEnv *= Math.exp(-n / (Math.max(5, P.attackDampTime) / 1000 * sr));
            if (s.adEnv < 0.01) s.adEnv = 0;
            ch = true;
          }
          if (P.drift > 0 || s.drift !== 0) {
            s.driftT -= n;
            if (s.driftT <= 0) { s.driftTarget = P.drift > 0 ? rn() * P.drift : 0; s.driftT = sr * (0.5 + rnd() * 0.7); }
            const nd = s.driftTarget + (s.drift - s.driftTarget) * Math.exp(-n / (0.45 * sr));
            if (Math.abs(nd - s.drift) > 0.0005) { s.drift = nd; ch = true; } else if (P.drift === 0 && Math.abs(nd) < 0.001) s.drift = 0;
          }
          if (s.tmod !== 0) {
            s.tmod *= Math.exp(-n / (0.12 * sr));
            if (Math.abs(s.tmod) < 0.03) s.tmod = 0;
            ch = true;
          }
          if (s.vib && frame >= s.vibStart) {
            const tt = (frame - s.vibStart) / sr, fade = Math.min(1, tt / 0.35);
            s.vibOff = (P.vibDepth * (s.vibMul || 1) / 100) * fade * Math.sin(TWO_PI * P.vibRate * tt); ch = true;
          } else if (s.vibOff !== 0) { s.vibOff = 0; ch = true; }
          if (ch) { s.retune(P); s.dirty = false; }
        }
      }
      process(inputs, outputs) {
        const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
        const P = this.P, st = this.st, el = !!P.electric;
        this.block(currentFrame, n);
        const k = P.coupling;
        const onlyTr = P.attackSolo === 'Only transients (no string)';
        const tr = P.transient || 0;
        const afA = 1 - Math.exp(-1 / (0.001 * this.sr)), afR = 1 - Math.exp(-1 / (0.03 * this.sr));
        const asA = 1 - Math.exp(-1 / (0.025 * this.sr)), asR = 1 - Math.exp(-1 / (0.25 * this.sr));
        for (let i = 0; i < n; i++) {
          const fr = currentFrame + i;
          while (this.q.length && this.q[0].frame <= fr) this.handle(this.q.shift(), fr);
          // sympathetic resonance, ONE WAY: the strings being played drive the free
          // (undamped, not played) strings through the bridge. The free strings do not
          // feed back into the played ones — a two-way coupling makes unisons trade
          // energy back and forth, heard as a slow "rotating speaker" swirl.
          const cpl = -k * this.S;
          let S = 0, l = 0, r = 0;
          for (let j = 0; j < 6; j++) {
            const s = st[j];
            const played = s.noteId !== 0;
            const o = s.tick(!played && s.damp < 0.5 ? cpl * s.cplK : 0);
            if (played) S += o;
            let sig = el ? s.pick * 0.9 : o;
            if (s.fadePos < s.fadeLen) { sig *= 0.5 - 0.5 * Math.cos(Math.PI * s.fadePos / s.fadeLen); s.fadePos++; }
            if (onlyTr) sig = 0;
            if (s.clkPos < s.clkLen) sig += s.clk[s.clkPos++];
            if (s.knkPos < s.knkLen) sig += s.knk[s.knkPos++];
            l += sig * s.gl; r += sig * s.gr;
          }
          this.S = S;
          // left-hand squeaks: swept resonant noise
          for (let q = this.sq.length - 1; q >= 0; q--) {
            const v = this.sq[q], x = v.pos / v.len;
            if (v.pos % 32 === 0) { const f = v.f0 + (v.f1 - v.f0) * x, wq = TWO_PI * f / this.sr, rr = 0.985; v.b1 = 2 * rr * Math.cos(wq); v.b2 = -rr * rr; }
            const env = Math.pow(Math.sin(Math.PI * x), 0.7) * (0.55 + 0.45 * rnd());
            const y = rn() * env * 0.02 + v.b1 * v.y1 + v.b2 * v.y2; v.y2 = v.y1; v.y1 = y;
            const sv = y * v.amp * 0.5; l += sv * v.gl; r += sv * v.gr;
            if (++v.pos >= v.len) this.sq.splice(q, 1);
          }
          // transient shaper: fast vs slow envelope ratio
          if (tr !== 0) {
            const x = Math.abs(l) + Math.abs(r);
            this.ef += (x > this.ef ? afA : afR) * (x - this.ef);
            this.es += (x > this.es ? asA : asR) * (x - this.es);
            const gnn = clamp(Math.pow((this.ef + 1e-5) / (this.es + 1e-5), tr * 1.2), 0.25, 4);
            l *= gnn; r *= gnn;
          }
          L[i] = l * 0.5; R[i] = r * 0.5;
        }
        // safety: a string that blows up (extreme settings) is silenced
        for (const s of st) if (!isFinite(s.out) || Math.abs(s.out) > 30) { s.reset(); s.out = 0; }
        if (!isFinite(this.S)) this.S = 0;
        return true;
      }
    }
    registerProcessor('gl-guitar', GuitarProcessor);
  };

  /** Module URL of the worklet. Blob URLs are refused when the page is opened from
   *  disk (origin "null"), so a data: URL is used there; blob: everywhere else. */
  GL.workletURL = function () {
    if (!GL._wurl) {
      const src = '(' + GL.workletMain.toString() + ')();';
      GL._wurl = location.protocol === 'file:' ? 'data:application/javascript;charset=utf-8,' + encodeURIComponent(src)
        : URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    }
    return GL._wurl;
  };

  /* ====================================== settings → worklet params == */
  const WORKLET_KEYS = ['a4', 'trebleTone', 'attackPitch', 'attackSolo', 'clickDecay', 'clickReso', 'knockTone', 'knockDecay', 'attackSoft', 'attackDamp',
    'attackDampTime', 'transient', 'pluckSharp', 'fingerWidth', 'noteDetune', 'drift', 'decayLow', 'decayHigh', 'brightness', 'brightTrack', 'inharm', 'inharmStages', 'polDetune', 'polMix', 'polDecay', 'coupling',
    'tuningSpread', 'stringSpread', 'pluckMode', 'pluckPos', 'hardness', 'noiseMix', 'excLen', 'attackNoise', 'attackTone', 'velSens', 'velBright',
    'restrikeKeep', 'woodiness', 'pluckVar', 'palmMute', 'releaseTime', 'squeak', 'vibDepth', 'vibRate', 'vibDelay', 'legatoLevel'];

  /** The pickup selector of a type (maps names between Strat 5-way and 3-way toggles) */
  GL.pickupSel = function (type, sel) {
    const T = GL.TYPES[type];
    if (!T.pickups) return sel;
    if (T.pickups.includes(sel)) return sel;
    if (type === 'strat') return sel === 'Both' ? 'Middle + Bridge' : 'Bridge';
    return sel === 'Neck' || sel === 'Neck + Middle' ? 'Neck' : sel === 'Bridge' ? 'Bridge' : 'Both';
  };
  /** Coil taps for the worklet: [{pos, width, g}] */
  GL.pickupTaps = function (type, s) {
    const PT = GL.PICKUP_TYPES[s.pickupType] || GL.PICKUP_TYPES['Single coil'];
    const sel = GL.pickupSel(type, s.pickupSel);
    const map = { 'Neck': [s.posNeck], 'Neck + Middle': [s.posNeck, s.posMid], 'Middle': [s.posMid], 'Middle + Bridge': [s.posMid, s.posBridge], 'Bridge': [s.posBridge], 'Both': [s.posNeck, s.posBridge] };
    const list = map[sel] || [s.posBridge];
    // bridge pickups are weaker (string moves less there): makers wind them hotter → compensate
    return list.map(pos => ({ pos, width: PT.width, g: (1 / list.length) * Math.pow(0.25 / pos, 0.5) }));
  };
  GL.workletParams = function (type, s) {
    const p = {};
    WORKLET_KEYS.forEach(k => { p[k] = s[k]; });
    p.open = (GL.CONFIG.tunings[s.tuning] || GL.CONFIG.tunings.Standard).slice();
    p.electric = GL.TYPES[type].cat === 'electric';
    p.taps = p.electric ? GL.pickupTaps(type, s) : [];
    return p;
  };

  /* ======================================== curves and impulse responses */
  const curveCache = {};
  /** Tube-style soft clipper (tanh with bias = asymmetry → even harmonics) */
  GL.curve = function (k, bias) {
    const key = k.toFixed(3) + '|' + bias;
    if (curveCache[key]) return curveCache[key];
    const n = 4096, cv = new Float32Array(n), t0 = Math.tanh(k * bias);
    const pos = Math.tanh(k * (1 + bias)) - t0, neg = t0 - Math.tanh(k * (-1 + bias));
    for (let i = 0; i < n; i++) {
      const x = i * 2 / (n - 1) - 1, y = Math.tanh(k * (x + bias)) - t0;
      cv[i] = y >= 0 ? y / pos : y / neg;
    }
    curveCache[key] = cv;
    return cv;
  };
  /** Synthetic stereo reverb impulse response */
  GL.makeIR = function (ctx, type, seconds, predelayMs) {
    const sr = ctx.sampleRate, pre = Math.round(predelayMs / 1000 * sr);
    const len = pre + Math.round(seconds * sr * 1.05) + 16;
    const buf = ctx.createBuffer(2, len, sr);
    const cfg = { Room: { early: 9, damp: 0.55, er: 0.05 }, Studio: { early: 6, damp: 0.6, er: 0.035 }, Hall: { early: 14, damp: 0.75, er: 0.09 },
      Plate: { early: 0, damp: 0.25, er: 0 }, Spring: { early: 0, damp: 0.4, er: 0 } }[type] || { early: 6, damp: 0.5, er: 0.04 };
    let sd = 12345 + Math.round(seconds * 100);
    const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len - pre; i++) {
        const t = i / sr, env = Math.exp(-6.9 * t / seconds);
        const coef = Math.min(0.96, cfg.damp * Math.min(1, t / seconds * 1.6) + (type === 'Plate' ? 0.05 : 0.15));
        lp += (1 - coef) * (rnd() - lp);
        d[pre + i] = lp * env * (i < sr * 0.002 ? i / (sr * 0.002) : 1);
      }
      for (let k = 0; k < cfg.early; k++) {
        const idx = pre + Math.round(sr * (0.003 + Math.abs(rnd()) * cfg.er));
        if (idx < len) d[idx] += rnd() * 0.7 * Math.exp(-k * 0.18);
      }
      if (type === 'Spring') {                       // springy repeats + metallic ring
        const dl = Math.round(0.031 * sr * (ch ? 1.07 : 1));
        for (let i = dl; i < len; i++) d[i] += 0.5 * d[i - dl];
        // metallic colour: a fixed resonance around 2.4 kHz (no modulation → no warble)
        const wr = TWO * 2400 / sr, r = 0.97, b1 = 2 * r * Math.cos(wr), b2 = -r * r;
        let y1 = 0, y2 = 0;
        for (let i = 0; i < len; i++) { const y = d[i] * 0.06 + b1 * y1 + b2 * y2; y2 = y1; y1 = y; d[i] = d[i] * 0.75 + y; }
      }
    }
    return buf;
  };
  const TWO = Math.PI * 2;
  const dB = v => Math.pow(10, v / 20);
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  /** 14 fixed pseudo-random upper body modes per guitar type: [freq, Q, gain dB] */
  const xmCache = {};
  GL.extraModes = function (type) {
    if (xmCache[type]) return xmCache[type];
    let sd = 1234567 + type.length * 7919 + type.charCodeAt(0) * 131;
    const r = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    const out = [];
    for (let i = 0; i < 14; i++) {
      const f = 300 * Math.pow(5200 / 300, (i + 0.2 + r() * 0.6) / 14);
      out.push([f, 5 + r() * 9, (r() * 2 - 1) * 4 + (i % 2 ? -1.2 : 1.2)]);
    }
    xmCache[type] = out;
    return out;
  };
  /** Short dense "inside the box" impulse response (body diffusion), stereo-decorrelated */
  GL.makeBodyIR = function (ctx, ms, type) {
    const sr = ctx.sampleRate, len = Math.max(32, Math.round(ms / 1000 * sr * 2.2));
    const buf = ctx.createBuffer(2, len, sr);
    let sd = 777 + Math.round(ms * 10) + (type || '').length * 31;
    const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff * 2 - 1; };
    const a = Math.exp(-TWO * 3500 / sr), tau = ms / 1000 * sr / 2.5;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let y = 0;
      for (let i = 0; i < len; i++) { y = (1 - a) * rnd() + a * y; d[i] = y * Math.exp(-i / tau) * Math.min(1, i / (sr * 0.0004)); }
    }
    return buf;
  };

  /* =========================================== 2. THE WEB AUDIO GRAPH == */
  class Engine {
    constructor(ctx, node, destination) {
      this.ctx = ctx; this.node = node; this.n = {}; this.irKey = '';
      this.build(destination || ctx.destination);
    }
    static async create(ctx, opts) {
      opts = opts || {};
      await ctx.audioWorklet.addModule(GL.workletURL());
      const node = new AudioWorkletNode(ctx, 'gl-guitar', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { params: opts.params || {}, events: opts.events || [] }
      });
      return new Engine(ctx, node, opts.destination);
    }
    build(dest) {
      const c = this.ctx, n = this.n;
      const G = v => { const g = c.createGain(); g.gain.value = v === undefined ? 1 : v; return g; };
      const B = (type, f, q, gain) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (gain !== undefined) b.gain.value = gain; return b; };
      const chain = arr => { for (let i = 0; i < arr.length - 1; i++) arr[i].connect(arr[i + 1]); };
      // physical model output level (layered mode) → every path
      n.modelGain = G(1); n.modelHP = B('highpass', 10, 0.7);
      this.node.connect(n.modelGain); n.modelGain.connect(n.modelHP);
      const src = n.modelHP;
      // ---- acoustic: body + microphone
      n.acIn = G();
      n.body = []; for (let i = 0; i < 9; i++) n.body.push(B('peaking', 200 * (i + 1), 4, 0));
      // dense upper body modes (300 Hz – 5 kHz): where the TREBLE strings live. Without
      // them a high note is a "pure" string = synthetic; with them every harmonic gets the wood.
      n.bodyX = []; for (let i = 0; i < 14; i++) n.bodyX.push(B('peaking', 400 + i * 300, 8, 0));
      n.bodyLow = B('lowshelf', 120, 0.7, 0); n.bodyHigh = B('highshelf', 3000, 0.7, 0);
      n.mic1 = B('peaking', 250, 0.8, 0); n.mic2 = B('peaking', 3500, 0.7, 0); n.micProx = B('lowshelf', 110, 0.7, 0); n.micLP = B('lowpass', 18000, 0.7);
      n.acOut = G(0);
      n.fxIn = G();
      chain([src, n.acIn].concat(n.body, n.bodyX, [n.bodyLow, n.bodyHigh, n.mic1, n.mic2, n.micProx, n.micLP, n.acOut, n.fxIn]));
      // ---- under-saddle piezo
      n.pzHP = B('highpass', 90, 0.7); n.pzPk = B('peaking', 2400, 1.4, 4); n.pzLP = B('lowpass', 9000, 0.7); n.pzOut = G(0);
      chain([src, n.pzHP, n.pzPk, n.pzLP, n.pzOut, n.fxIn]);
      // ---- electric: pickup electrics → amp → cab
      n.elIn = G(0); n.puRes = B('lowpass', 4800, 2.4); n.puVol = B('highshelf', 2000, 0.7, 0); n.puOut = G(1);
      n.ampIn = G(1);
      chain([src, n.elIn, n.puRes, n.puVol, n.puOut, n.ampIn]);
      n.hollowSend = G(0); n.bodyHigh.connect(n.hollowSend); n.hollowSend.connect(n.ampIn);
      // body diffusion: dense short reflections inside the wooden box (parallel)
      n.bdConv = c.createConvolver(); n.bdGain = G(0);
      chain([n.bodyHigh, n.bdConv, n.bdGain, n.mic1]); n.bdGain.connect(n.hollowSend);
      n.ampA = G(1);                                        // built-in amp path
      n.namIn = G(0); n.namOut = G(1);                      // real amp capture path (NAM node inserted when ready)
      n.ampIn.connect(n.namIn);
      n.preHP = B('highpass', 60, 0.7); n.preMid = B('peaking', 800, 0.7, 0);
      n.sh1 = c.createWaveShaper(); n.sh1.oversample = '4x'; n.inter = G(1); n.sh2 = c.createWaveShaper(); n.sh2.oversample = '4x';
      n.tLow = B('lowshelf', 110, 0.7, 0); n.tMid = B('peaking', 650, 0.8, 0); n.tHigh = B('highshelf', 3200, 0.7, 0); n.pres = B('peaking', 4500, 1, 0);
      n.ampLevel = G(1);
      n.cabHP = B('highpass', 20, 0.7); n.cabLP = B('lowpass', 20000, 0.7); n.cabP1 = B('peaking', 100, 1, 0); n.cabP2 = B('peaking', 2000, 1, 0); n.cabMic = B('peaking', 3200, 1, 0);
      n.elOut = G(0);
      n.cabFilt = G(1); n.cabIRin = G(0); n.cabIR = c.createConvolver(); n.cabIRout = G(1);
      chain([n.ampIn, n.ampA, n.preHP, n.preMid, n.sh1, n.inter, n.sh2, n.tLow, n.tMid, n.tHigh, n.pres, n.ampLevel, n.cabFilt, n.cabHP, n.cabLP, n.cabP1, n.cabP2, n.cabMic, n.elOut, n.fxIn]);
      n.namOut.connect(n.tLow);
      chain([n.ampLevel, n.cabIRin, n.cabIR, n.cabIRout, n.elOut]);
      // REAL RECORDINGS (sampler): DI libraries enter the amp, microphone libraries go to the mix
      this.sampler = new GL.Sampler(c);
      n.smpGain = G(1); n.smpDI = G(0); n.smpMic = G(0);
      // DI restoration (inverse of a pickup loaded by a low-impedance input)
      n.smpRest1 = B('highshelf', 1100, 0.6, 0); n.smpRest2 = B('peaking', 3000, 0.7, 0);
      chain([this.sampler.out, n.smpGain, n.smpRest1, n.smpRest2]); n.smpRest2.connect(n.smpDI); n.smpRest2.connect(n.smpMic);
      // DI recordings → pickup voicing (selector, pickup type, tone and volume knobs) → amp
      n.spLo = B('lowshelf', 180, 0.7, 0); n.spHi = B('highshelf', 2600, 0.7, 0);
      n.spM = [0, 1, 2, 3].map(() => B('peaking', 1000, 1, 0));
      n.spTone = B('lowpass', 20000, 0.6); n.spBleed = B('highshelf', 2000, 0.7, 0); n.spVol = G(1);
      chain([n.smpDI, n.spLo, n.spHi].concat(n.spM, [n.spTone, n.spBleed, n.spVol, n.ampIn]));
      // microphone recordings → mic position / distance voicing → mix, and a copy into the piezo path
      n.smM = [0, 1, 2, 3].map(() => B('peaking', 1000, 1, 0)); n.smProx = B('lowshelf', 110, 0.7, 0); n.smLP = B('lowpass', 20000, 0.7);
      n.smDry = G(1); n.smPz = G(0);
      chain([n.smpMic].concat(n.smM, [n.smProx, n.smLP, n.smDry, n.fxIn]));
      n.smLP.connect(n.smPz); n.smPz.connect(n.pzHP);
      // ---- common: cuts → compressor → (dry, chorus, delay, reverb)
      n.lowCut = B('highpass', 60, 0.7); n.highCut = B('lowpass', 16000, 0.7);
      n.comp = c.createDynamicsCompressor(); n.compGain = G(1); n.post = G(1);
      // tone EQ (all guitars)
      n.eqLow = B('lowshelf', 90, 0.7, 0); n.eqLowMid = B('peaking', 250, 1, 0); n.eqMid = B('peaking', 800, 0.9, 0);
      n.eqUpMid = B('peaking', 2000, 1, 0); n.eqPres = B('peaking', 4500, 1.1, 0); n.eqAir = B('highshelf', 10000, 0.7, 0);
      n.tiltLo = B('lowshelf', 400, 0.6, 0); n.tiltHi = B('highshelf', 2500, 0.6, 0);
      n.thick = B('peaking', 170, 0.8, 0); n.mud = B('peaking', 320, 1.2, 0); n.harsh = B('peaking', 3200, 2.2, 0);
      chain([n.fxIn, n.eqLow, n.eqLowMid, n.eqMid, n.eqUpMid, n.eqPres, n.eqAir, n.tiltLo, n.tiltHi, n.thick, n.mud, n.harsh,
        n.lowCut, n.highCut, n.comp, n.compGain, n.post]);
      n.sum = G(1);
      n.dry = G(1); chain([n.post, n.dry, n.sum]);
      // chorus: two modulated delays panned L / R
      n.chIn = G(0); n.post.connect(n.chIn);
      ['L', 'R'].forEach((side, i) => {
        const d = c.createDelay(0.06); d.delayTime.value = i ? 0.017 : 0.012;
        const lfo = c.createOscillator(); lfo.frequency.value = 0.8; const lg = G(0.002);
        lfo.connect(lg); lg.connect(d.delayTime); lfo.start(c.currentTime + i * 0.31);
        const p = c.createStereoPanner(); p.pan.value = i ? 0.7 : -0.7;
        chain([n.chIn, d, p, n.sum]);
        n['chD' + side] = d; n['lfo' + side] = lfo; n['lfoG' + side] = lg;
      });
      // delay with damped feedback
      n.dlSend = G(0); n.dl = c.createDelay(2); n.dlLP = B('lowpass', 4500, 0.7); n.dlFB = G(0.3);
      chain([n.post, n.dlSend, n.dl, n.dlLP, n.dlFB, n.dl]); n.dlLP.connect(n.sum);
      // reverb
      n.rvSend = G(0); n.rv = c.createConvolver(); chain([n.post, n.rvSend, n.rv, n.sum]);
      // output → limiter → analyser → speakers
      // stereo width (L/R cross-mix) and analog saturation
      n.wSplit = c.createChannelSplitter(2); n.wMerge = c.createChannelMerger(2);
      n.wLL = G(1); n.wRR = G(1); n.wLR = G(0); n.wRL = G(0);
      n.sum.connect(n.wSplit);
      n.wSplit.connect(n.wLL, 0); n.wSplit.connect(n.wLR, 0); n.wSplit.connect(n.wRR, 1); n.wSplit.connect(n.wRL, 1);
      n.wLL.connect(n.wMerge, 0, 0); n.wRL.connect(n.wMerge, 0, 0); n.wRR.connect(n.wMerge, 0, 1); n.wLR.connect(n.wMerge, 0, 1);
      n.sat = c.createWaveShaper(); n.sat.oversample = '2x';
      n.out = G(1); n.lim = c.createDynamicsCompressor();
      n.lim.threshold.value = -3; n.lim.knee.value = 0; n.lim.ratio.value = 20; n.lim.attack.value = 0.002; n.lim.release.value = 0.12;
      n.analyser = c.createAnalyser(); n.analyser.fftSize = 8192; n.analyser.smoothingTimeConstant = 0.75;
      chain([n.wMerge, n.sat, n.out, n.lim, n.analyser, dest]);
      n.ref = G(1); n.ref.connect(n.analyser);                 // reference recordings bypass the guitar chain
    }
    /** Push every setting of a guitar into the graph (and the worklet) */
    apply(type, s, opts) {
      opts = opts || {};
      const T = GL.TYPES[type], n = this.n, now = this.ctx.currentTime;
      const set = (prm, v) => { if (!isFinite(v)) return; if (opts.immediate) prm.value = v; else prm.setTargetAtTime(v, now, 0.02); };
      if (!opts.noWorklet) this.node.port.postMessage({ type: 'params', p: GL.workletParams(type, s) });
      const ac = T.cat === 'acoustic', el = T.cat === 'electric', bodyOn = ac || !!T.hollow;
      // body modes
      n.body.forEach((b, i) => {
        const m = T.modes[i];
        if (!m || !bodyOn) { set(b.gain, 0); return; }
        const f = i === 0 ? s.airFreq : i === 1 ? s.topFreq : m[0] / s.bodySize;
        set(b.frequency, f); set(b.Q, m[1] * s.bodyQ); set(b.gain, m[2] * s.bodyMix * 1.3);
      });
      const X = GL.extraModes(type);
      n.bodyX.forEach((b, i) => { const m = X[i]; set(b.frequency, m[0] / s.bodySize); set(b.Q, m[1] * s.bodyQ); set(b.gain, bodyOn ? m[2] * s.bodyDetail * 1.2 : 0); });
      set(n.bodyLow.gain, bodyOn ? s.bodyLow : 0); set(n.bodyHigh.gain, bodyOn ? s.bodyBright : 0);
      // microphone (acoustic)
      const M = GL.MIC_POSITIONS[s.micPos] || GL.MIC_POSITIONS['12th fret'];
      set(n.mic1.frequency, M.lo[0]); set(n.mic1.Q, M.lo[1]); set(n.mic1.gain, ac ? M.lo[2] : 0);
      set(n.mic2.frequency, M.hi[0]); set(n.mic2.Q, M.hi[1]); set(n.mic2.gain, ac ? M.hi[2] : 0);
      set(n.micProx.gain, ac ? (1 - s.micDistance) * 7 - 1.5 : 0);
      set(n.micLP.frequency, ac ? Math.min(20000, (15000 - s.micDistance * 8000) * M.lpMul) : 20000);   // air absorbs the top end
      set(n.acOut.gain, ac ? (1 - s.piezoBlend * 0.85) * 1.1 : 0);
      set(n.pzOut.gain, ac ? s.piezoBlend * 1.3 : 0); set(n.pzPk.gain, s.piezoQuack * 10);
      // pickups + knobs
      const tone = s.toneKnob / 10, vol = s.volumeKnob / 10;
      set(n.elIn.gain, el ? 1 : 0);
      set(n.puRes.frequency, s.pickupRes * (0.3 + 0.7 * Math.pow(tone, 1.6)));
      set(n.puRes.Q, s.pickupQ * (0.45 + 0.55 * tone));
      set(n.puVol.gain, s.trebleBleed >= 0.5 ? 0 : -9 * (1 - vol));
      set(n.puOut.gain, Math.pow(vol, 1.8) * dB(s.pickupOut) * 1.2);
      set(n.hollowSend.gain, T.hollow ? s.bodyMix * 0.6 : 0);
      // amp
      // a real amp capture that is not loaded (yet, or failed) is replaced by the most similar built-in amp
      const Aw = GL.AMPS[s.ampModel] || GL.AMPS['Clean (Twin)'];
      const namLive = !!Aw.nam && GL.namAvailable() && this.namReady === Aw.nam;
      const A = Aw.nam && !namLive ? GL.AMPS[GL.NAM_FALLBACK[s.ampModel]] || GL.AMPS['Clean (Twin)'] : Aw;
      this.lastType = type;
      const drive = s.gain / 10, k1 = A.k + A.kr * drive * drive, k2 = A.k2 + A.k2r * drive * drive;
      n.sh1.curve = k1 > 0.02 ? GL.curve(k1, A.bias) : null;
      n.sh2.curve = k2 > 0.02 ? GL.curve(k2, A.bias * 0.5) : null;
      set(n.preHP.frequency, A.hp); set(n.preMid.frequency, A.mid); set(n.preMid.gain, k1 > 1 ? 3 : 0);
      set(n.inter.gain, k2 > 0.02 ? 0.7 : 1);
      set(n.tLow.gain, (s.bass - 5) * 2.4); set(n.tMid.frequency, A.mid); set(n.tMid.Q, A.midQ); set(n.tMid.gain, (s.mid - 5) * 2.4);
      set(n.tHigh.gain, (s.treble - 5) * 2.4 + A.bright); set(n.pres.gain, (s.presence - 5) * 2);
      set(n.ampLevel.gain, A.level * Math.pow(Math.max(0.01, s.master) / 6, 1.5) / (1 + 0.035 * (k1 + k2)));
      const C = GL.CABS[s.cab] || GL.CABS['2x12 Open'], CM = GL.CAB_MICS[s.cabMic] || GL.CAB_MICS['On-axis'];
      const di = s.cab === 'None (DI)';
      set(n.cabHP.frequency, C.hp); set(n.cabLP.frequency, di ? 20000 : Math.min(20000, C.lp * CM.lpMul));
      set(n.cabP1.frequency, C.p1[0]); set(n.cabP1.Q, C.p1[1]); set(n.cabP1.gain, C.p1[2]);
      set(n.cabP2.frequency, C.p2[0]); set(n.cabP2.Q, C.p2[1]); set(n.cabP2.gain, C.p2[2]);
      set(n.cabMic.frequency, CM.f); set(n.cabMic.Q, CM.q); set(n.cabMic.gain, di ? 0 : CM.db);
      set(n.elOut.gain, el ? 0.6 : 0);
      // real amp (NAM) or built-in amp; real cabinet IR or filter cabinet
      // The real capture / IR only replaces the built-in amp / cabinet once it is LOADED:
      // until then (and if it fails) the built-in one keeps sounding, so a first note is never silent.
      const namFile = Aw.nam && GL.namAvailable() ? Aw.nam : null;
      this.useNam(namFile, opts);
      const irFile = C.ir && GL.namAvailable() ? C.ir : null;
      this.useIR('cab', irFile, opts);
      this.lastSet = set; this.lastS = s;
      this.routeAmpCab(set, s, namFile, irFile, CM);
      // sound source
      const mode = this.sourceMode(type, s);
      this.mode = mode;
      set(n.modelGain.gain, mode === 'layered' ? s.layerMix : 1);
      set(n.modelHP.frequency, mode === 'layered' ? s.layerHP : 10);
      set(n.smpRest1.gain, s.sampleRestore * 24); set(n.smpRest2.gain, s.sampleRestore * 9);
      const lib = this.sampler.lib;
      const isDI = lib && (s.sampleRoute === 'Direct input → amp' ? true : s.sampleRoute === 'Microphone → mix' ? false
        : lib.meta.kind === 'di' || (lib.meta.id === 'user' && el));
      set(n.smpGain.gain, mode === 'model' ? 0 : dB(s.sampleLevel));
      set(n.smpDI.gain, isDI && el ? 1 : 0); set(n.smpMic.gain, lib && !(isDI && el) ? 1 : 0);
      this.sampler.P = s;
      this.applyRecordingVoicing(type, s, set, !!(lib && isDI && el), !!(lib && !(isDI && el) && ac));
      // cuts + compressor
      set(n.lowCut.frequency, s.lowCut); set(n.highCut.frequency, s.highCut);
      set(n.comp.threshold, -6 - s.comp * 30); set(n.comp.ratio, 1 + s.comp * 7); set(n.comp.knee, 12);
      set(n.comp.attack, 0.006 + (1 - s.comp) * 0.01); set(n.comp.release, 0.2);
      set(n.compGain.gain, dB(s.comp * 9));
      // chorus / delay / reverb
      set(n.chIn.gain, s.chorusMix * 0.8);
      ['L', 'R'].forEach(sd => { set(n['lfo' + sd].frequency, s.chorusRate * (sd === 'R' ? 1.13 : 1)); set(n['lfoG' + sd].gain, 0.0004 + 0.0045 * s.chorusDepth); });
      set(n.dry.gain, 1 - s.reverbMix * 0.35 - s.chorusMix * 0.2);
      set(n.dlSend.gain, s.delayMix * 0.7); set(n.dl.delayTime, s.delayTime / 1000); set(n.dlFB.gain, s.delayFeedback);
      set(n.rvSend.gain, s.reverbMix * 1.1);
      const realRv = GL.REVERB_IRS[s.reverbType];
      if (realRv && GL.namAvailable()) {
        if (this.irKey !== realRv) {
          this.irKey = realRv;
          if (!n.rv.buffer) n.rv.buffer = GL.makeIR(this.ctx, 'Plate', s.reverbSize, s.predelay);     // a reverb meanwhile
          this.useIR('rev', realRv, opts);
        }
      }
      else {
        const irKey = s.reverbType + '|' + s.reverbSize + '|' + s.predelay;
        if (irKey !== this.irKey) { this.irKey = irKey; this.ir_rev = 'synthetic'; n.rv.buffer = GL.makeIR(this.ctx, realRv ? 'Plate' : s.reverbType, s.reverbSize, s.predelay); }
      }
      // tone EQ
      set(n.eqLow.gain, s.eqLow); set(n.eqLowMid.gain, s.eqLowMid); set(n.eqMid.gain, s.eqMid);
      set(n.eqUpMid.gain, s.eqUpMid); set(n.eqPres.gain, s.eqPres); set(n.eqAir.gain, s.eqAir);
      set(n.tiltLo.gain, -s.tilt * 5); set(n.tiltHi.gain, s.tilt * 6);
      set(n.thick.gain, s.thickness * 8); set(n.mud.gain, -s.mudCut * 10);
      set(n.harsh.frequency, s.harshFreq); set(n.harsh.gain, -s.harshCut * 12);
      // realism
      set(n.bdGain.gain, bodyOn ? s.bodyDiff * 0.9 : 0);
      const bdKey = s.bodyDiffSize + '|' + type;
      if (bdKey !== this.bdKey) { this.bdKey = bdKey; n.bdConv.buffer = GL.makeBodyIR(this.ctx, s.bodyDiffSize, type); }
      const wd = clampN(s.width, 0, 2), same = (1 + wd) / 2, cross = (1 - wd) / 2;
      set(n.wLL.gain, same); set(n.wRR.gain, same); set(n.wLR.gain, cross); set(n.wRL.gain, cross);
      n.sat.curve = s.saturation > 0.01 ? GL.curve(0.4 + s.saturation * 2.6, 0.04) : null;
      set(n.out.gain, dB(s.output) * 0.9);
    }
    /**
     * The real recordings were made with ONE pickup (DI) or ONE microphone position. To make the
     * pickup selector / type / tone + volume knobs and the mic position / distance / piezo blend
     * work on them too, apply the DIFFERENCE between the chosen setting and the factory setting
     * of the guitar (the factory settings = how the recordings sound unprocessed).
     */
    applyRecordingVoicing(type, s, set, diOn, micOn) {
      const n = this.n, F = GL.factory(type);
      // --- pickups (electric DI recordings)
      const PV = GL.PICKUP_VOICE, TV = GL.PICKUP_TYPE_VOICE;
      const sel = GL.pickupSel(type, s.pickupSel), sel0 = GL.pickupSel(type, F.pickupSel);
      const P1 = PV[sel] || PV.Middle, P0 = PV[sel0] || P1;
      const T1 = TV[s.pickupType] || TV['Single coil'], T0 = TV[F.pickupType] || T1;
      const tone = s.toneKnob / 10, tone0 = F.toneKnob / 10, vol = s.volumeKnob / 10, vol0 = Math.max(0.05, F.volumeKnob / 10);
      const resOct = Math.log2(Math.max(500, s.pickupRes) / Math.max(500, F.pickupRes));
      set(n.spLo.gain, diOn ? (P1.lo - P0.lo) + (T1.lo - T0.lo) : 0);
      set(n.spHi.gain, diOn ? (P1.hi - P0.hi) + (T1.hi - T0.hi) + resOct * 4 + Math.max(0, tone - tone0) * 6 : 0);
      [[P1.mid, 1, P1 !== P0], [P0.mid, -1, P1 !== P0], [T1.mid, 1, T1 !== T0], [T0.mid, -1, T1 !== T0]].forEach(([m, sg, on], i) => {
        set(n.spM[i].frequency, m[0]); set(n.spM[i].Q, m[1]); set(n.spM[i].gain, diOn && on ? sg * m[2] : 0);
      });
      // tone knob: a real tone pot only darkens → low-pass relative to the factory knob position
      const tf = x => 20000 * Math.pow(0.06, Math.pow(1 - x, 1.3));
      set(n.spTone.frequency, diOn && tone < tone0 ? Math.max(400, 20000 * tf(tone) / tf(tone0)) : 20000);
      set(n.spBleed.gain, diOn && s.trebleBleed < 0.5 ? -9 * (1 - vol) : 0);
      set(n.spVol.gain, diOn ? Math.pow(vol, 1.8) / Math.pow(vol0, 1.8) * dB(s.pickupOut - F.pickupOut) : 1);
      // --- microphone (acoustic recordings)
      const MP = GL.MIC_POSITIONS, M1 = MP[s.micPos] || MP['12th fret'], M0 = MP[F.micPos] || M1, same = M1 === M0;
      [[M1.lo, 1], [M0.lo, -1], [M1.hi, 1], [M0.hi, -1]].forEach(([b, sg], i) => {
        set(n.smM[i].frequency, b[0]); set(n.smM[i].Q, b[1]); set(n.smM[i].gain, micOn && !same ? sg * b[2] : 0);
      });
      set(n.smProx.gain, micOn ? (F.micDistance - s.micDistance) * 7 : 0);                        // closer = more bass (proximity)
      const lp = d => (15000 - d * 8000);
      const lpf = Math.min(20000, 20000 * (lp(s.micDistance) * M1.lpMul) / (lp(F.micDistance) * M0.lpMul));
      set(n.smLP.frequency, micOn ? lpf : 20000);
      set(n.smDry.gain, micOn ? 1 - (s.piezoBlend - F.piezoBlend) * 0.85 : 1);
      set(n.smPz.gain, micOn ? Math.max(0, s.piezoBlend - F.piezoBlend) * 1.1 / Math.max(0.05, s.piezoBlend * 1.3) : 0);
    }
    /** 'model' | 'samples' | 'layered' (samples only when a library is loaded) */
    sourceMode(type, s) {
      if (!this.sampler.ready || s.engine === 'Physical model') return 'model';
      return s.engine === 'Real samples' ? 'samples' : 'layered';
    }
    /** Send scheduled events (absolute AudioContext time in e.t) to the model and / or the recordings */
    send(list) {
      const r = GL.routeEvents(list, this.mode || 'model');
      if (r.model.length) this.node.port.postMessage({ type: 'evs', list: r.model });
      if (r.samples.length) this.sampler.schedule(r.samples, this.sampler.P);
    }
    /** amp / cabinet routing: real capture + real IR when ready, else the built-in amp / filter cabinet */
    routeAmpCab(set, s, namFile, irFile, CM) {
      const n = this.n, namOn = !!namFile && this.namReady === namFile, irOn = !!irFile && this.irReady === 'cab|' + irFile;
      set(n.ampA.gain, namOn ? 0 : 1);
      set(n.namIn.gain, namOn ? dB(s.namInput) : 0);
      if (namOn) set(n.tMid.frequency, 650);
      set(n.cabFilt.gain, irOn ? 0 : 1); set(n.cabIRin.gain, irOn ? 1 : 0);
      if (irOn) set(n.cabMic.gain, 0);
      else if (CM) set(n.cabMic.gain, s.cab === 'None (DI)' ? 0 : CM.db);
    }
    /** a capture / IR finished loading: switch to it now (smoothly) */
    assetArrived() {
      // apply again: the amp stage switches from the built-in stand-in to the real capture / IR
      if (this.lastS && this.lastType) this.apply(this.lastType, this.lastS, { noWorklet: true });
    }
    stop() { this.node.port.postMessage({ type: 'stop' }); this.sampler.stop(); }
    /** Insert / swap the real-amp capture (async; plays the built-in amp meanwhile) */
    useNam(file, opts) {
      if (file === this.namFile) return; this.namFile = file;
      // a capture asked for earlier may finish loading AFTER this one: only the latest is used
      const tok = this.namTok = (this.namTok || 0) + 1;
      if (!file) return;
      const ctx = this.ctx, n = this.n;
      const job = (async () => {
        if (!this.namNode) {
          this.namNode = await GL.createNamNode(ctx);
          if (!this.asleep) n.namIn.connect(this.namNode);
          this.namNode.connect(n.namOut);
        }
        const info = await GL.namLoad(this.namNode, file, () => tok === this.namTok);
        if (!info) return;                                              // another amp was chosen meanwhile
        // the captures are normalized around -18 dB: make up the level
        const mk = info && info.loudness !== null && isFinite(info.loudness) ? dB(-18 - info.loudness) : 1;
        n.namOut.gain.value = mk * 3.5;
        this.namReady = file; this.assetErr = null;
        this.assetArrived();
      })().catch(err => {
        console.warn('NAM', err);
        // the built-in amp keeps playing; the status says which file failed
        if (tok === this.namTok) this.assetErr = 'real amp capture ' + file + ' (' + err.message + ') — the built-in amp plays';
        if (GL.onEngineMessage) GL.onEngineMessage('⚠ Real amp capture not available: ' + err.message);
      });
      this.pending = (this.pending || []).concat(job);
    }
    useIR(slot, file, opts) {
      const key = slot + '|' + file; if (this['ir_' + slot] === key) return; this['ir_' + slot] = key;
      if (!file) return;
      // only the IR still wanted when it finishes loading is used (fast clicks between guitars)
      const job = GL.loadIRBuffer(this.ctx, file).then(buf => {
        if (this['ir_' + slot] !== key) return;
        (slot === 'cab' ? this.n.cabIR : this.n.rv).buffer = buf;
        if (slot === 'cab') { this.irReady = key; this.assetArrived(); }
      }).catch(err => {
        console.warn('IR', err);
        if (this['ir_' + slot] === key) this.assetErr = (slot === 'cab' ? 'cabinet IR ' : 'reverb IR ') + file + ' (' + err.message + ')' + (slot === 'cab' ? ' — the built-in cabinet plays' : '');
      });
      this.pending = (this.pending || []).concat(job);
    }
    /** Wait for async assets (NAM model, IRs) — used before offline renders */
    async ready() { while (this.pending && this.pending.length) { const p = this.pending; this.pending = []; await Promise.all(p); } }
    panic() { this.node.port.postMessage({ type: 'panic' }); }
    /**
     * Idle engines cost CPU (6 strings + the NAM network run on silence). sleep() cuts the
     * string model and the NAM input so the browser skips them; wake() before the next note.
     */
    sleep() {
      if (this.asleep) return; this.asleep = true;
      try { this.node.disconnect(); } catch (e) { /* not connected */ }
      try { if (this.namNode) this.n.namIn.disconnect(this.namNode); } catch (e) { /* not connected */ }
    }
    wake() {
      if (!this.asleep) return; this.asleep = false;
      this.node.connect(this.n.modelGain);
      if (this.namNode) this.n.namIn.connect(this.namNode);
    }
    /** Disconnect everything (the track was deleted / changed engine) */
    dispose() {
      const n = this.n;
      try { this.stop(); } catch (e) { /* context closed */ }
      [n.analyser, this.node, this.namNode, this.sampler.out].forEach(x => { try { if (x) x.disconnect(); } catch (e) { /* not connected */ } });
      ['lfoL', 'lfoR'].forEach(k => { try { n[k].stop(); } catch (e) { /* stopped */ } });
      this.disposed = true;
    }
  }
  GL.Engine = Engine;

  /* ================================================ 3. OFFLINE RENDER == */
  GL.renderOffline = async function (type, s, events, seconds, sr, lib) {
    sr = sr || GL.CONFIG.exportSampleRate;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const mode = !lib || s.engine === 'Physical model' ? 'model' : s.engine === 'Real samples' ? 'samples' : 'layered';
    const r = GL.routeEvents(events, mode);
    const eng = await Engine.create(ctx, { params: GL.workletParams(type, s), events: r.model });
    if (lib) eng.sampler.setLibrary(lib);
    eng.apply(type, s, { immediate: true, noWorklet: true });
    await eng.ready();
    eng.apply(type, s, { immediate: true, noWorklet: true });
    if (r.samples.length) eng.sampler.schedule(r.samples, s);
    return ctx.startRendering();
  };
  /** Split events between the physical model and the recordings.
   *  'samples': notes → recordings; harmonics + squeaks stay in the model (no recorded harmonics). */
  GL.routeEvents = function (list, mode) {
    if (mode === 'model') return { model: list, samples: [] };
    if (mode === 'layered') return { model: list, samples: list.filter(e => e.type !== 'squeak' && !e.harm) };
    const model = [], samples = [];
    list.forEach(e => {
      if (e.type === 'off') { model.push(e); samples.push(e); }          // harmless where the note id is unknown
      else if (e.type === 'squeak' || (e.type === 'on' && e.harm)) model.push(e);
      else samples.push(e);
    });
    return { model, samples };
  };
  /* ------------------------------------------------ real amps & IRs */
  /** real amps / IRs need their files: fetch (http) or script packs (disk) — see GL.loadAsset */
  GL.namAvailable = () => GL.assetsAvailable();
  const namTextCache = {}, irCache = {}, namCtx = new WeakMap();
  /** URL of the NAM worklet module. From disk the module and the engine it imports come
   *  from packs: they are joined into ONE module (no import) and given as a data: URL. */
  let namURL = null;
  async function namWorkletURL() {
    if (!GL.fromDisk()) return GL.asset('nam/nam-worklet.js');
    if (!namURL) {
      const eng = (await GL.loadAsset('nam/nam-engine.js', 'text')).replace(/export\s+default\s+createNamEngine\s*;?\s*$/, '');
      const wk = (await GL.loadAsset('nam/nam-worklet.js', 'text')).replace(/^\s*import\s+createNamEngine\s+from\s+['"][^'"]+['"];?\s*$/m, '');
      namURL = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(eng + '\n' + wk);
    }
    return namURL;
  }
  GL.createNamNode = async function (ctx) {
    if (!GL.namAvailable()) throw new Error('the amp files are missing (packs/ folder)');
    let st = namCtx.get(ctx);
    if (!st) {
      st = (async () => {
        const wasm = await GL.loadAsset('nam/nam-engine.wasm', 'buffer');
        await ctx.audioWorklet.addModule(await namWorkletURL());
        return wasm;
      })();
      namCtx.set(ctx, st);
    }
    const wasm = await st;
    const node = new AudioWorkletNode(ctx, 'gl-nam', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
    node._req = 1; node._pending = new Map();
    node.port.onmessage = e => { const p = node._pending.get(e.data.requestId); if (!p) return; node._pending.delete(e.data.requestId); e.data.ok ? p.res(e.data) : p.rej(new Error(e.data.error)); };
    node.request = msg => new Promise((res, rej) => { const id = node._req++; node._pending.set(id, { res, rej }); node.port.postMessage(Object.assign({ requestId: id }, msg)); });
    await node.request({ type: 'init', wasmBytes: wasm.slice(0) });
    return node;
  };
  /** load a capture into a NAM node; stillWanted() is checked once the file is in memory */
  GL.namLoad = async function (node, file, stillWanted) {
    if (!namTextCache[file]) namTextCache[file] = GL.loadAsset('nam/models/' + file, 'text');
    const json = await namTextCache[file];
    if (stillWanted && !stillWanted()) return null;
    return node.request({ type: 'load-model', json, slimSize: -1 });
  };
  GL.loadIRBuffer = function (ctx, file) {
    // a ConvolverNode only accepts a buffer at its own context's rate → decode once per rate
    const key = file + '@' + ctx.sampleRate;
    if (!irCache[key]) irCache[key] = GL.loadAsset('nam/irs/' + file, 'buffer')
      .then(ab => new OfflineAudioContext(2, 1, ctx.sampleRate).decodeAudioData(ab));
    return irCache[key];
  };
})();
