/* =====================================================================
 *  PIANO LAB — engine.js : SOUND ENGINE
 *  ---------------------------------------------------------------------
 *  1. PL.workletMain  — the models, running in an AudioWorklet (one
 *     processor, stereo out). Which model plays is params.model:
 *       'piano'  digital waveguide strings. Every note has 1, 2 or 3
 *                strings (low bass / bass / tenor+treble, like a real
 *                grand), each one a delay loop with
 *                  · a loss filter designed from two decay times
 *                    (fundamental + overtones)
 *                  · dispersion all-pass filters = string stiffness
 *                    (inharmonicity, the piano "shimmer")
 *                  · its own tiny detune and decay → beating + the
 *                    double decay ("after-sound") of real unisons
 *                excited by a felt-hammer pulse (longer and rounder when
 *                soft, short and sharp when hard) through the strike-
 *                position comb, plus the hammer knock and soundboard modes.
 *       'ep'     tine (or reed) + overtone "bell" through a pickup
 *                non-linearity (bark)
 *       'synth'  2 band-limited oscillators + sub + noise, unison,
 *                4-pole ladder filter, 2 ADSR envelopes, LFO, glide
 *       'organ'  91 free-running tonewheels shared by all keys,
 *                9 drawbars with foldback, percussion, key click,
 *                leakage, scanner vibrato / chorus, tube drive and the
 *                rotary speaker (horn + drum, Doppler + amplitude, inertia)
 *  2. PL.Engine — Web Audio graph around the worklet and the recordings
 *     player (sampler.js): electric-piano amp chain (drive, speaker,
 *     tremolo / auto-pan, phaser), sympathetic resonance and soundboard
 *     (convolution), EQ, compressor, chorus, delay, reverb, stereo width,
 *     limiter, analyser.
 *  3. PL.renderOffline — the same engine in an OfflineAudioContext (WAV).
 * ===================================================================== */
(function () {
  'use strict';
  const PL = window.PL = window.PL || {};
  const dB = v => Math.pow(10, v / 20);

  /* ===================================================== WORKLET CODE == */
  PL.workletMain = function () {
    const TWO_PI = 6.283185307179586;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    /** deterministic 0..1 per key: every key keeps its own small imperfections */
    const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    class PLVoices extends AudioWorkletProcessor {
      constructor(opt) {
        super();
        const o = opt.processorOptions || {};
        this.P = o.params || {}; this.q = []; this.v = []; this.ped = 0; this.soft = 0;
        this.maxVoices = o.maxVoices || 40;
        this.tmp = new Float32Array(128);
        this.seed = 22222;
        this.lastFreq = 0;                                   // synth glide
        this.lfoPh = 0;
        // soundboard knock modes (piano): three decaying resonators
        this.modes = [[92, 0.9994], [171, 0.9991], [263, 0.9987]].map(([f, r]) => ({ c: 2 * r * Math.cos(TWO_PI * f / sampleRate), sw: Math.sin(TWO_PI * f / sampleRate), r2: r * r, y1: 0, y2: 0 }));
        this.dcL = 0; this.dcR = 0; this.xL = 0; this.xR = 0;
        this.initOrgan();
        if (o.events) this.enqueue(o.events);
        this.port.onmessage = e => {
          const m = e.data;
          if (m.type === 'params') this.P = m.p;
          else if (m.type === 'events') this.enqueue(m.list);
          else if (m.type === 'panic') { this.q.length = 0; this.v.length = 0; this.ped = 0; this.soft = 0; this.org.keys.clear(); this.org.dirty = true; }
          // dispose: end the processor (a disconnected worklet node would keep running forever)
          else if (m.type === 'dispose') { this.dead = true; this.q.length = 0; this.v.length = 0; }
        };
      }
      enqueue(list) {
        for (const ev of list) { ev.f = Math.round(ev.t * sampleRate); this.q.push(ev); }
        this.q.sort((a, b) => a.f - b.f);
      }
      rnd() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x3fffffff - 1; }

      /* ------------------------------------------------------ events */
      handle(ev) {
        const model = this.P.model;
        if (ev.type === 'on') {
          if (model === 'organ') this.organOn(ev);
          else {
            if (this.v.length >= this.maxVoices) {             // steal: a released voice first, else the oldest
              let k = this.v.findIndex(v => !v.held && !v.sus); if (k < 0) k = 0;
              this.v.splice(k, 1);
            }
            if (model === 'piano') this.pianoOn(ev); else if (model === 'ep') this.epOn(ev); else this.synthOn(ev);
          }
        } else if (ev.type === 'off') {
          if (model === 'organ') this.organOff(ev);
          for (const v of this.v) if (v.id === ev.id && v.held) { v.held = false; if (this.ped >= 0.5) v.sus = true; else this.releaseVoice(v); }
        } else if (ev.type === 'pedal') {
          this.ped = ev.v;
          if (ev.v < 0.5) for (const v of this.v) if (v.sus) { v.sus = false; this.releaseVoice(v); }
        } else if (ev.type === 'soft') this.soft = ev.v;
      }
      releaseVoice(v) {
        if (v.kind === 'p') { for (const s of v.str) s.gd = s.gdRel; v.rel = true; }
        else if (v.kind === 'e') v.rel = true;
        else if (v.kind === 's') { v.aStage = 3; v.fStage = 3; }
      }

      /* ======================================================== PIANO == */
      /** one string = one delay loop tuned to f, with loss + dispersion filters */
      makeString(f, B, T60, T60h, M, Td) {
        const sr = sampleRate, w = TWO_PI * f / sr;
        // ---- loss filter: one-pole low-pass, per-period gain G0 at f and Gh at fh
        const G0 = Math.pow(10, -3 / (T60 * f)), fh = Math.min(f * 10, sr * 0.3), wh = TWO_PI * fh / sr, Gh = Math.pow(10, -3 / (T60h * f));
        const mag = (p, ww) => (1 - p) / Math.sqrt(1 - 2 * p * Math.cos(ww) + p * p);
        let lo = 0, hi = 0.985;
        const want = Gh / G0;
        for (let i = 0; i < 26; i++) { const p = (lo + hi) / 2; if (mag(p, wh) / mag(p, w) > want) lo = p; else hi = p; }
        const p = (lo + hi) / 2, g = Math.min(0.99999, G0 / mag(p, w));
        const lpDelay = Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w)) / w;
        // ---- dispersion: M first-order all-passes (Rauhala & Välimäki tunable dispersion filter)
        let a = 0, apD = 0;
        const total = sr / f;
        for (; M > 0; M--) {
          const lnB = Math.log(Math.max(B, 1e-6)), lnM = Math.log(M);
          const kd = Math.exp(-0.00179 * lnB * lnB - 0.0233 * lnB - 2.93);
          const Cd = Math.exp((0.0126 * lnM + 0.0606) * lnB - 0.00825 * lnM + 1.97);
          const key = Math.log(f * 1.0594630943592953 / 27.5) / Math.log(1.0594630943592953);
          const D = Math.exp(Cd - key * kd);
          a = (1 - D) / (1 + D);
          apD = (Math.atan2(Math.sin(w), a + Math.cos(w)) - Math.atan2(a * Math.sin(w), 1 + a * Math.cos(w))) / w;
          if (total - lpDelay - M * apD >= 3.2 && Math.abs(a) < 0.999) break;       // the filters must fit inside one period
        }
        if (M === 0) { a = 0; apD = 0; }
        const dly = Math.max(2.05, total - lpDelay - M * apD);
        const i0 = Math.floor(dly) - 1, eta = dly - i0;                              // 4-point Lagrange around the delay
        let size = 16; while (size < dly + 8) size <<= 1;
        const fr = eta;
        return {
          buf: new Float32Array(size), mask: size - 1, w: 0, i0, N: dly,
          h0: -(fr - 1) * (fr - 2) * (fr - 3) / 6, h1: fr * (fr - 2) * (fr - 3) / 2, h2: -fr * (fr - 1) * (fr - 3) / 2, h3: fr * (fr - 1) * (fr - 2) / 6,
          gl: g * (1 - p), p, z: 0, a, M, st: new Float32Array(Math.max(1, M)), gd: 1,
          gdRel: Td > 0 ? Math.pow(10, -3 / (Td * f)) : 1, amp: 1
        };
      }
      pianoOn(ev) {
        const P = this.P, sr = sampleRate, midi = ev.midi;
        let vel = clamp(ev.vel, 0.01, 1);
        // a re-struck key: its old strings are damped quickly
        for (const v of this.v) if (v.kind === 'p' && v.midi === midi) { v.held = false; v.sus = false; v.rel = true; for (const s of v.str) s.gd = Math.pow(10, -3 / (0.05 * v.f)); }
        const x = (midi - 69) / 39;
        const f = P.a4 * Math.pow(2, (midi - 69) / 12 + P.stretch * 28 * x * x * x / 1200);
        let n = midi <= P.monoTop ? 1 : midi <= P.biTop ? 2 : 3;
        if (this.soft >= 0.5) { if (n > 1) n--; vel *= 0.8; }                        // una corda: the hammer misses one string
        // inharmonicity of a grand: lowest around key 40, rising steeply to the top
        const B = P.inharm * Math.pow(10, -4.35 + Math.max(0, midi - 40) / 68 * 2.45 + Math.max(0, 40 - midi) / 19 * 0.2);
        const T60 = P.sustainLow * Math.pow(27.5 / f, Math.log(P.sustainLow / P.sustainHigh) / Math.log(4186 / 27.5));
        const T60h = T60 / (1 + P.hfDamp * 7);
        const M = P.inharm <= 0 ? 0 : midi < 46 ? 4 : midi < 72 ? 2 : midi < 90 ? 1 : 0;
        const Td = midi >= 90 ? 0 : (0.3 - 0.19 * clamp((midi - 30) / 55, 0, 1)) * P.damperTime;
        const det = n === 1 ? [0] : n === 2 ? [-0.5, 0.5] : [-1, 0.12, 1];
        // double decay: one string of each unison rings much longer, more quietly (the "after-sound")
        const u = P.unisonSpread, dec = n === 1 ? [1] : n === 2 ? [1 + 5 * u, 1 - 0.4 * u] : [1 + 5 * u, 1, 1 - 0.4 * u];
        const str = [];
        for (let k = 0; k < n; k++) {
          const cents = det[k] * P.unisonDetune * (0.6 + 0.8 * hash(midi * 3 + k));
          const s = this.makeString(f * Math.pow(2, cents / 1200), B, T60 * dec[k], T60h * dec[k], M, Td);
          s.amp = n === 1 ? 1 : [0.5, 1, 1.05][k];
          str.push(s);
        }
        // ---- hammer: felt pulse. Soft = long and round, hard = short and peaked.
        const N = str[0].N;
        const Tc = 0.0032 * Math.pow(2, -(midi - 21) / 87 * 2.3) * (1.75 - 1.05 * vel) * (1.4 - 0.8 * P.hammerHard);
        const Lp = Math.max(3, Math.round(Tc * sr));
        const sharp = 1 + 2.2 * (1 - P.hammerHard) * (1 - 0.7 * vel) + (1 - vel) * 0.8;
        const pd = Math.max(1, Math.round(P.strikePos * N));
        const exc = new Float32Array(Lp + pd);
        let area = 0;
        for (let i = 0; i < Lp; i++) { const h = Math.pow(Math.sin(Math.PI * (i + 0.5) / Lp), sharp); exc[i] += h; area += h; }
        for (let i = 0; i < Lp; i++) exc[i + pd] -= 0.92 * Math.pow(Math.sin(Math.PI * (i + 0.5) / Lp), sharp);   // strike-position comb
        // level: the pulse is scaled so that the first partials it puts on the string have the same
        // strength on every key (a short string gets far less energy from the same pulse)
        let e2 = 0;
        const w0 = TWO_PI / N, K = Math.max(1, Math.min(10, Math.floor(N / 2.4)));
        for (let h = 1; h <= K; h++) {
          let re = 0, im = 0; const wh = w0 * h;
          for (let i = 0; i < exc.length; i++) { re += exc[i] * Math.cos(wh * i); im += exc[i] * Math.sin(wh * i); }
          e2 += re * re + im * im;
        }
        const amp = Math.pow(vel, P.dynRange / 42) * 0.075 * N / Math.sqrt(e2 + 1e-12) / Math.sqrt(n) * (0.75 + 0.25 * vel);
        for (let i = 0; i < exc.length; i++) exc[i] *= amp;
        void area;
        const pan = clamp((midi - 64) / 44, -1, 1) * P.modelStereo * 0.7, th = (pan + 1) * Math.PI / 4;
        this.v.push({ kind: 'p', id: ev.id, midi, f, vel, held: true, sus: false, rel: false, str, exc, en: 0, pk: 1, age: 0, gL: Math.cos(th), gR: Math.sin(th),
          kn: vel * P.hammerNoise * 0.25, knD: Math.exp(-1 / (0.012 * sr)), knLP: 0, knC: 1 - Math.exp(-TWO_PI * (500 + 1800 * vel) / sr) });
        const k = vel * vel * P.hammerNoise * 0.09;
        this.modes.forEach((m, i) => { m.y1 += k * m.sw * [1, 0.7, 0.5][i]; });        // a kick of k·sin(w) rings at amplitude k
      }
      pianoRender(v, L, R, i0, i1) {
        const tmp = this.tmp, exc = v.exc, Lx = exc.length;
        for (let i = i0; i < i1; i++) tmp[i] = 0;
        let pk = 0;
        for (const s of v.str) {
          const b = s.buf, m = s.mask, off = s.i0, h0 = s.h0, h1 = s.h1, h2 = s.h2, h3 = s.h3, gl = s.gl * s.gd, p = s.p, a = s.a, M = s.M, st = s.st, amp = s.amp;
          let w = s.w, z = s.z, en = v.en;
          for (let i = i0; i < i1; i++) {
            const r = w - off;
            let x = h0 * b[r & m] + h1 * b[(r - 1) & m] + h2 * b[(r - 2) & m] + h3 * b[(r - 3) & m];
            z = x = gl * x + p * z;
            for (let j = 0; j < M; j++) { const y = a * x + st[j]; st[j] = x - a * y; x = y; }
            if (en < Lx) x += exc[en++] * amp;
            b[w & m] = x; w++;
            tmp[i] += x;
          }
          s.w = w; s.z = z;
          const last = b[(w - 1) & m]; if (last > pk) pk = last; else if (-last > pk) pk = -last;
        }
        v.en = Math.min(Lx, v.en + (i1 - i0));
        // hammer knock: a short low-passed noise burst
        if (v.kn > 1e-5) {
          let kn = v.kn, lp = v.knLP; const d = v.knD, c = v.knC;
          for (let i = i0; i < i1; i++) { lp += c * (this.rnd() * kn - lp); tmp[i] += lp; kn *= d; }
          v.kn = kn; v.knLP = lp;
        }
        const gL = v.gL, gR = v.gR;
        for (let i = i0; i < i1; i++) { const x = tmp[i]; L[i] += x * gL; R[i] += x * gR; }
        v.age += i1 - i0;
        v.pk = v.pk * 0.9 + pk * 0.1 + (v.en < Lx ? 1 : 0);
        return v.pk > 3e-5 || v.age < 2000;
      }

      /* ============================================== ELECTRIC PIANO == */
      epOn(ev) {
        const P = this.P, sr = sampleRate, midi = ev.midi, vel = clamp(ev.vel, 0.01, 1);
        for (const v of this.v) if (v.kind === 'e' && v.midi === midi) { v.held = false; v.sus = false; v.rel = true; v.relD = Math.exp(-1 / (0.02 * sr)); }
        const f = P.a4 * Math.pow(2, (midi - 69) / 12), reed = P.reed;
        const T60 = (reed ? 5.5 : 9) * Math.pow(2, -(midi - 36) / 30) * P.epDecay + 0.5;
        const bellF = f * (reed ? 5.4 : 6.27);                                      // 2nd mode of a clamped bar
        const bellOn = bellF < sr * 0.42;
        const pan = clamp((midi - 64) / 44, -1, 1) * 0.25, th = (pan + 1) * Math.PI / 4;
        this.v.push({ kind: 'e', id: ev.id, midi, vel, held: true, sus: false, rel: false, reed,
          ph: 0, inc: TWO_PI * f / sr, ph2: 0, inc2: TWO_PI * bellF / sr,
          e1: 1, d1: Math.exp(-6.91 / (T60 * sr)), e2: bellOn ? P.epBell * (0.35 + 0.9 * vel) * (reed ? 0.5 : 1) : 0, d2: Math.exp(-6.91 / ((reed ? 0.12 : 0.35) * (0.6 + 0.4 * P.epDecay) * sr)),
          atk: 0, atkInc: 1 / (0.0015 * sr), relG: 1, relD: Math.exp(-6.91 / ((0.16 - 0.08 * clamp((midi - 28) / 70, 0, 1)) * P.damperTime * sr)),
          k: (0.25 + 2.6 * P.epBark * (0.25 + 0.75 * vel * vel)) , amp: Math.pow(vel, P.dynRange / 42) * 0.15, hp: 0, lp: 0, gL: Math.cos(th), gR: Math.sin(th), age: 0 });
      }
      epRender(v, L, R, i0, i1) {
        const P = this.P, sym = P.epSym * 0.6, k = v.k, reed = v.reed;
        const g0 = reed ? sym / (1 - 0.55 * sym) : sym / (1 + sym * sym);
        const norm = v.amp / Math.pow(k, 0.55), gL = v.gL, gR = v.gR;
        const lc = 1 - Math.exp(-TWO_PI * (reed ? 3600 : 5200) / sampleRate);
        let ph = v.ph, ph2 = v.ph2, e1 = v.e1, e2 = v.e2, atk = v.atk, relG = v.relG, lp = v.lp, hp = v.hp;
        const rd = v.rel ? v.relD : 1;
        for (let i = i0; i < i1; i++) {
          if (atk < 1) atk = Math.min(1, atk + v.atkInc);
          const x = atk * (e1 * Math.sin(ph) + e2 * Math.sin(ph2));
          ph += v.inc; ph2 += v.inc2; e1 *= v.d1; e2 *= v.d2; relG *= rd;
          const u = sym + k * x;
          // pickup: magnetic (tine) = u/(1+u²) · electrostatic (reed) = u/(1−0.55u), both asymmetric
          let y = reed ? u / (1 - 0.55 * clamp(u, -1.6, 1.6)) : u / (1 + u * u);
          y = (y - g0) * norm * relG;
          lp += lc * (y - lp);
          const o = lp - hp; hp += 0.0006 * o;                                       // DC blocker
          L[i] += o * gL; R[i] += o * gR;
        }
        if (ph > 1e6) { ph %= TWO_PI; ph2 %= TWO_PI; }
        v.ph = ph; v.ph2 = ph2; v.e1 = e1; v.e2 = e2; v.atk = atk; v.relG = relG; v.lp = lp; v.hp = hp;
        v.age += i1 - i0;
        return e1 * relG > 2e-4;
      }

      /* ======================================================== SYNTH == */
      synthOn(ev) {
        const P = this.P, vel = clamp(ev.vel, 0.01, 1);
        const f = P.a4 * Math.pow(2, (ev.midi - 69) / 12);
        const n = Math.round(clamp(P.unison, 1, 7)), u = [];
        for (let i = 0; i < n; i++) {
          const pos = n === 1 ? 0 : i / (n - 1) * 2 - 1, th = (pos * P.unisonWidth + 1) * Math.PI / 4;
          u.push({ det: Math.pow(2, pos * P.unisonSynth / 1200), p1: Math.random(), p2: Math.random(), gL: Math.cos(th), gR: Math.sin(th), tri1: 0, tri2: 0 });
        }
        this.v.push({ kind: 's', id: ev.id, midi: ev.midi, vel, held: true, sus: false, f, cur: P.glide > 0.001 && this.lastFreq ? this.lastFreq : f, u, sub: 0,
          aEnv: 0, aStage: 0, fEnv: 0, fStage: 0, y: new Float32Array(8), drift: 0, driftT: (Math.random() * 2 - 1), age: 0, norm: 1 / Math.sqrt(n) });
        this.lastFreq = f;
      }
      /** band-limited step correction (polyBLEP) */
      static blep(t, dt) {
        if (t < dt) { t /= dt; return t + t - t * t - 1; }
        if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
        return 0;
      }
      osc(wave, ph, dt, pw, u, key) {
        const blep = PLVoices.blep;
        if (wave === 0) return 2 * ph - 1 - blep(ph, dt);                           // saw
        if (wave === 4) return Math.sin(TWO_PI * ph);                               // sine
        const w = wave === 2 ? pw : 0.5;
        const sq = (ph < w ? 1 : -1) + blep(ph, dt) - blep((ph + 1 - w) % 1, dt);       // square / pulse
        if (wave === 3) { u[key] = (u[key] + 4 * dt * sq) * 0.9995; return u[key]; }   // triangle = integrated square (leaky)
        return sq;
      }
      synthRender(v, L, R, i0, i1, lfo) {
        const P = this.P, sr = sampleRate, n = i1 - i0;
        // ---- envelopes (per segment: attack linear, decay / release exponential)
        const adv = (env, stage, A, D, S, Rl) => {
          const dt = n / sr;
          if (stage === 0) { env += dt / Math.max(0.001, A); if (env >= 1) { env = 1; stage = 1; } }
          else if (stage === 1) { env = S + (env - S) * Math.exp(-dt * 4.6 / D); if (env - S < 0.001) stage = 2; }
          else if (stage === 3) env *= Math.exp(-dt * 4.6 / Rl);
          return [env, stage];
        };
        const a0 = v.aEnv, f0e = v.fEnv;
        [v.aEnv, v.aStage] = adv(v.aEnv, v.aStage, P.aA, P.aD, P.aS, P.aR);
        [v.fEnv, v.fStage] = adv(v.fEnv, v.fStage, P.fA, P.fD, P.fS, P.fR);
        // ---- pitch: glide, drift, vibrato
        if (P.glide > 0.001) v.cur += (v.f - v.cur) * (1 - Math.exp(-n / (P.glide * sr * 0.33))); else v.cur = v.f;
        v.drift += (v.driftT - v.drift) * 0.002 * n / 128; if (Math.random() < 0.004) v.driftT = Math.random() * 2 - 1;
        const fr = v.cur * Math.pow(2, (v.drift * P.drift * 7 + lfo * P.lfoPitch) / 1200);
        const f2 = fr * Math.pow(2, (P.osc2Semi * 100 + P.osc2Fine) / 1200);
        // ---- filter cutoff
        const velK = 1 - P.velFilter * (1 - v.vel);
        let fc = P.cutoff * Math.pow(2, P.envAmt * 7 * ((f0e + v.fEnv) / 2) * velK + P.keyTrack * (v.midi - 60) / 12 + lfo * P.lfoFilter * 3) * (0.5 + 0.5 * velK);
        fc = clamp(fc, 20, sr * 0.42);
        const g = 1 - Math.exp(-TWO_PI * fc / sr), kq = P.reso * 4.1, drv = 1 + P.synthDrive * 5, comp = (1 + kq * 0.45) / drv * (1 + P.synthDrive * 1.2);
        const pw = clamp(P.pulseWidth + lfo * P.lfoPwm, 0.05, 0.95);
        const w1 = P.w1, w2 = P.w2, m1 = 1 - P.oscMix, m2 = P.oscMix;
        const amp = (1 - P.velAmp * (1 - v.vel)) * 0.24 * v.norm, da = (v.aEnv - a0) / n;
        const y = v.y, sub = P.subLevel, noi = P.noiseLevel;
        let env = a0;
        for (let i = i0; i < i1; i++) {
          let sl = 0, sr2 = 0;
          for (let k = 0; k < v.u.length; k++) {
            const u = v.u[k], d1 = fr * u.det / sr, d2 = f2 * u.det / sr;
            u.p1 += d1; if (u.p1 >= 1) u.p1 -= 1; u.p2 += d2; if (u.p2 >= 1) u.p2 -= 1;
            const s = m1 * this.osc(w1, u.p1, d1, pw, u, 'tri1') + m2 * this.osc(w2, u.p2, d2, pw, u, 'tri2');
            sl += s * u.gL; sr2 += s * u.gR;
          }
          if (sub > 0) { v.sub += fr * 0.5 / sr; if (v.sub >= 1) v.sub -= 1; const s = (v.sub < 0.5 ? 1 : -1) * sub * 0.7; sl += s; sr2 += s; }
          if (noi > 0) { const s = this.rnd() * noi * 0.7; sl += s; sr2 += s; }
          // 4-pole ladder, one per side
          let x = Math.tanh((sl * drv - kq * y[3]) * 0.6) / 0.6;
          y[0] += g * (x - y[0]); y[1] += g * (y[0] - y[1]); y[2] += g * (y[1] - y[2]); y[3] += g * (y[2] - y[3]);
          x = Math.tanh((sr2 * drv - kq * y[7]) * 0.6) / 0.6;
          y[4] += g * (x - y[4]); y[5] += g * (y[4] - y[5]); y[6] += g * (y[5] - y[6]); y[7] += g * (y[6] - y[7]);
          env += da;
          const e = env * env * amp * comp;                                          // squared: a more natural volume curve
          L[i] += y[3] * e; R[i] += y[7] * e;
        }
        v.age += n;
        return !(v.aStage === 3 && v.aEnv < 0.0004);
      }

      /* ======================================================== ORGAN == */
      initOrgan() {
        const sr = sampleRate, W = 91;
        const o = this.org = { keys: new Map(), ph: new Float64Array(W), inc: new Float64Array(W), amp: new Float32Array(W), tgt: new Float32Array(W), ptg: new Float32Array(W),
          leak: new Float32Array(W), dirty: true, perc: 0, any: false,
          vib: new Float32Array(2048), vw: 0, vph: 0,
          lpA: 0, lpB: 0, hornPh: 0, drumPh: 0, hornSp: 0, drumSp: 0, hb: new Float32Array(2048), db: new Float32Array(2048), rw: 0, hlpL: 0, hlpR: 0, pre: 0 };
        for (let w = 0; w < W; w++) { o.inc[w] = TWO_PI * 440 * Math.pow(2, (w + 24 - 69) / 12) / sr; o.ph[w] = hash(w) * TWO_PI; o.leak[w] = 0.3 + 0.7 * hash(w + 200); }
      }
      organOn(ev) {
        const o = this.org;
        if (o.keys.size === 0) o.perc = 1;                                           // single-trigger percussion
        o.keys.set(ev.id, ev.midi); o.dirty = true;
      }
      organOff(ev) { if (this.org.keys.delete(ev.id)) this.org.dirty = true; }
      /** wheel number for a key + drawbar, with the foldback of a real console */
      static wheel(midi, off) { let w = midi - 24 + off; while (w > 90) w -= 12; while (w < 12) w += 12; return w; }
      organTargets() {
        const P = this.P, o = this.org, tg = o.tgt, pt = o.ptg;
        tg.fill(0); pt.fill(0);
        const percH = P.percMode;                                                    // 0 off, 1 = 2nd (4'), 2 = 3rd (2 2/3')
        o.keys.forEach(midi => {
          for (let d = 0; d < 9; d++) {
            let lv = P.db[d]; if (lv <= 0) continue;
            if (d === 8 && percH) continue;                                          // percussion steals the 1' contact
            tg[PLVoices.wheel(midi, P.dbOff[d])] += Math.pow(10, -3 * (8 - lv) / 20) * (percH ? 0.85 : 1);
          }
          if (percH) pt[PLVoices.wheel(midi, percH === 1 ? 12 : 19)] += 1;
        });
        o.any = o.keys.size > 0;
        if (o.any && P.leakage > 0) for (let w = 12; w < 91; w++) tg[w] += P.leakage * 0.0035 * o.leak[w];
        o.dirty = false;
      }
      organRender(L, R, i0, i1) {
        const P = this.P, o = this.org, sr = sampleRate, tmp = this.tmp;
        if (o.dirty) this.organTargets();
        // contacts close fast: the faster, the louder the click
        const slew = 1 - Math.exp(-1 / ((0.0002 + 0.006 * (1 - P.keyClick)) * sr));
        const pdec = Math.exp(-1 / ((P.percSlow ? 0.5 : 0.17) * sr)), pvol = P.percSoft ? 0.5 : 1.1;
        for (let i = i0; i < i1; i++) tmp[i] = 0;
        let active = false;
        for (let w = 0; w < 91; w++) {
          const t = o.tgt[w], pt = o.ptg[w]; let a = o.amp[w];
          const inc = o.inc[w]; let ph = o.ph[w];
          if (t < 1e-6 && a < 1e-6 && pt === 0) { ph += inc * (i1 - i0); if (ph > 1e5) ph %= TWO_PI; o.ph[w] = ph; continue; }
          active = true;
          let pe = o.perc;
          for (let i = i0; i < i1; i++) {
            a += slew * (t - a);
            tmp[i] += Math.sin(ph) * (a + pt * pe * pvol);
            ph += inc; pe *= pdec;
          }
          if (ph > 1e5) ph %= TWO_PI;
          o.ph[w] = ph; o.amp[w] = a;
        }
        o.perc *= Math.pow(pdec, i1 - i0);
        if (!active && o.hornSp === 0 && !o.tail) return;
        o.tail = active ? Math.round(sr * 0.3) : Math.max(0, (o.tail || 0) - (i1 - i0));
        // ---- scanner vibrato / chorus: a modulated delay line
        const vm = P.vibMode;
        if (vm) {
          const depth = [0, 0.00013, 0.00023, 0.00036][P.vibDepth] * sr, vb = o.vib, chorus = vm === 2;
          for (let i = i0; i < i1; i++) {
            vb[o.vw & 2047] = tmp[i];
            o.vph += 6.86 / sr; if (o.vph >= 1) o.vph -= 1;
            const tri = o.vph < 0.5 ? o.vph * 4 - 1 : 3 - o.vph * 4;
            const d = depth * (1.05 + tri) + 1, di = Math.floor(d), fr = d - di;
            const x = vb[(o.vw - di) & 2047] * (1 - fr) + vb[(o.vw - di - 1) & 2047] * fr;
            tmp[i] = chorus ? (tmp[i] + x) * 0.62 : x;
            o.vw++;
          }
        }
        // ---- tube amp
        const dr = 1 + P.organDrive * 9, on = P.organDrive > 0.01, mk = 0.11 * (on ? 1.15 / Math.sqrt(dr) : 1);
        if (on) for (let i = i0; i < i1; i++) { const x = tmp[i] * 0.3 * dr; tmp[i] = (Math.tanh(x + 0.15) - 0.1489) / 0.3; }
        // ---- rotary speaker
        const mode = this.ped >= 0.5 && P.rotMode !== 3 ? 1 : P.rotMode;             // 0 slow, 1 fast, 2 stop, 3 off
        if (mode === 3) { for (let i = i0; i < i1; i++) { const x = tmp[i] * mk; L[i] += x; R[i] += x; } return; }
        const n = i1 - i0, ht = mode === 1 ? 6.7 : mode === 0 ? 0.8 : 0, dtg = mode === 1 ? 5.7 : mode === 0 ? 0.67 : 0;
        o.hornSp += (ht - o.hornSp) * (1 - Math.exp(-n / ((ht > o.hornSp ? 0.7 : 1.1) * sr)));
        o.drumSp += (dtg - o.drumSp) * (1 - Math.exp(-n / ((dtg > o.drumSp ? 4 : 5.5) * sr)));
        const xc = 1 - Math.exp(-TWO_PI * 800 / sr), dep = P.rotaryDepth, al = P.rotarySpread * 1.2;
        const hb = o.hb, dbf = o.db, hD = 0.00045 * sr * dep, dD = 0.00012 * sr * dep, base = 0.0007 * sr;
        const hg = clamp(1 + P.rotaryBal, 0, 1.6), dg = clamp(1 - P.rotaryBal, 0, 1.6), tc = 1 - Math.exp(-TWO_PI * 2500 / sr);
        const tap = (bf, w, d) => { const di = Math.floor(d), fr = d - di; return bf[(w - di) & 2047] * (1 - fr) + bf[(w - di - 1) & 2047] * fr; };
        for (let i = i0; i < i1; i++) {
          const x = tmp[i] * mk;
          o.lpA += xc * (x - o.lpA); o.lpB += xc * (o.lpA - o.lpB);
          const low = o.lpB, high = x - low;
          hb[o.rw & 2047] = high; dbf[o.rw & 2047] = low;
          o.hornPh += TWO_PI * o.hornSp / sr; o.drumPh -= TWO_PI * o.drumSp / sr;       // the drum turns the other way
          if (o.hornPh > TWO_PI) o.hornPh -= TWO_PI; if (o.drumPh < 0) o.drumPh += TWO_PI;
          const cL = Math.cos(o.hornPh - al), cR = Math.cos(o.hornPh + al), eL = Math.cos(o.drumPh - al), eR = Math.cos(o.drumPh + al);
          let hL = tap(hb, o.rw, base + hD * cL), hR = tap(hb, o.rw, base + hD * cR);
          // the horn is brighter and louder when it points at the microphone
          o.hlpL += tc * (hL - o.hlpL); o.hlpR += tc * (hR - o.hlpR);
          const bL = 0.5 + 0.5 * cL, bR = 0.5 + 0.5 * cR;
          hL = (o.hlpL + (hL - o.hlpL) * (1 - dep * 0.8 * (1 - bL))) * (1 - dep * 0.55 * (1 - bL));
          hR = (o.hlpR + (hR - o.hlpR) * (1 - dep * 0.8 * (1 - bR))) * (1 - dep * 0.55 * (1 - bR));
          const dL = tap(dbf, o.rw, base + dD * eL) * (1 - dep * 0.3 * (0.5 - 0.5 * eL)), dR = tap(dbf, o.rw, base + dD * eR) * (1 - dep * 0.3 * (0.5 - 0.5 * eR));
          L[i] += hL * hg + dL * dg; R[i] += hR * hg + dR * dg;
          o.rw++;
        }
      }

      /* ====================================================== PROCESS == */
      render(L, R, i0, i1) {
        const P = this.P;
        let lfo = 0;
        if (P.model === 'synth') { this.lfoPh += P.lfoRate * (i1 - i0) / sampleRate; lfo = Math.sin(TWO_PI * this.lfoPh); if (this.lfoPh > 1e4) this.lfoPh %= 1; }
        for (let k = this.v.length - 1; k >= 0; k--) {
          const v = this.v[k];
          const alive = v.kind === 'p' ? this.pianoRender(v, L, R, i0, i1) : v.kind === 'e' ? this.epRender(v, L, R, i0, i1) : this.synthRender(v, L, R, i0, i1, lfo);
          if (!alive) this.v.splice(k, 1);
        }
        if (P.model === 'piano') {                                                   // soundboard knock modes
          const ms = this.modes;
          if (Math.abs(ms[0].y1) + Math.abs(ms[1].y1) + Math.abs(ms[2].y1) > 1e-7) {
            for (let i = i0; i < i1; i++) {
              let s = 0;
              for (let j = 0; j < 3; j++) { const m = ms[j], y = m.c * m.y1 - m.r2 * m.y2; m.y2 = m.y1; m.y1 = y; s += y; }
              L[i] += s; R[i] += s;
            }
          }
        } else if (P.model === 'organ') this.organRender(L, R, i0, i1);
      }
      process(inputs, outputs) {
        if (this.dead) return false;
        const L = outputs[0][0], R = outputs[0][1] || L, n = L.length, f0 = currentFrame;
        if (this.tmp.length < n) this.tmp = new Float32Array(n);
        let i0 = 0;
        while (i0 < n) {
          while (this.q.length && this.q[0].f <= f0 + i0) this.handle(this.q.shift());
          let i1 = n;
          if (this.q.length && this.q[0].f < f0 + n) i1 = Math.max(i0 + 1, this.q[0].f - f0);
          this.render(L, R, i0, i1);
          i0 = i1;
        }
        // DC blocker (the hammer pulse and the pickups are one-sided)
        let dl = this.dcL, dr = this.dcR, xl = this.xL, xr = this.xR;
        for (let i = 0; i < n; i++) {
          const a = L[i], b = R[i];
          dl = a - xl + 0.9985 * dl; xl = a; L[i] = dl;
          dr = b - xr + 0.9985 * dr; xr = b; if (R !== L) R[i] = dr;
        }
        if (!(dl === dl) || !(dr === dr)) { dl = dr = xl = xr = 0; this.v.length = 0; }   // never let a NaN stay in the engine
        this.dcL = dl; this.dcR = dr; this.xL = xl; this.xR = xr;
        return true;
      }
    }
    registerProcessor('pl-voices', PLVoices);
  };

  /** URL of the worklet module (data: URL from disk, Blob URL when served) */
  let wkURL = null;
  PL.workletURL = function () {
    if (!wkURL) {
      const code = '(' + PL.workletMain.toString() + ')();';
      wkURL = location.protocol === 'file:' ? 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code) : URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    }
    return wkURL;
  };

  /* ================================================ PARAMS → WORKLET == */
  const WAVE = { Saw: 0, Square: 1, Pulse: 2, Triangle: 3, Sine: 4 };
  /** settings → the numbers the worklet needs */
  PL.workletParams = function (type, s) {
    const p = { model: PL.TYPES[type].model };
    PL.PARAMS.forEach(q => { if (!q.options) p[q.id] = s[q.id]; });
    p.reed = PL.EP_MODELS[s.epModel] ? PL.EP_MODELS[s.epModel].reed : 0;
    p.w1 = WAVE[s.osc1Wave] || 0; p.w2 = WAVE[s.osc2Wave] || 0;
    p.db = PL.DRAWBARS.map((d, i) => s['db' + (i + 1)]); p.dbOff = PL.DRAWBARS.map(d => d[1]);
    p.percMode = s.perc === '2nd harmonic' ? 1 : s.perc === '3rd harmonic' ? 2 : 0;
    p.percSlow = s.percDecay === 'Slow' ? 1 : 0; p.percSoft = s.percVol === 'Soft' ? 1 : 0;
    p.vibMode = s.vibChorus === 'Off' ? 0 : s.vibChorus[0] === 'V' ? 1 : 2; p.vibDepth = p.vibMode ? +s.vibChorus[1] : 0;
    p.rotMode = ['Slow (chorale)', 'Fast (tremolo)', 'Stop', 'Off (direct)'].indexOf(s.rotary);
    return p;
  };

  /* ============================================== IMPULSE RESPONSES == */
  let seed = 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  /** reverb: decaying noise that gets darker with time + early reflections */
  PL.makeIR = function (ctx, type, seconds, predelayMs) {
    const sr = ctx.sampleRate, pre = Math.round(predelayMs / 1000 * sr), len = pre + Math.round(seconds * sr * 1.05) + 16;
    const buf = ctx.createBuffer(2, len, sr);
    const cfg = { Room: { early: 9, damp: 0.55, er: 0.05 }, Studio: { early: 6, damp: 0.6, er: 0.035 }, Hall: { early: 14, damp: 0.75, er: 0.09 }, Plate: { early: 0, damp: 0.25, er: 0 } }[type] || { early: 6, damp: 0.5, er: 0.04 };
    seed = 12345 + Math.round(seconds * 100);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len - pre; i++) {
        const t = i / sr, env = Math.exp(-6.9 * t / seconds);
        const coef = Math.min(0.96, cfg.damp * Math.min(1, t / seconds * 1.6) + (type === 'Plate' ? 0.05 : 0.15));
        lp += (1 - coef) * (rnd() - lp);
        d[pre + i] = lp * env * (i < sr * 0.002 ? i / (sr * 0.002) : 1);
      }
      for (let k = 0; k < cfg.early; k++) { const idx = pre + Math.round(sr * (0.003 + Math.abs(rnd()) * cfg.er)); if (idx < len) d[idx] += rnd() * 0.7 * Math.exp(-k * 0.18); }
    }
    return buf;
  };
  /**
   * Sympathetic resonance of a piano with the dampers up: every string (all 88 keys, first
   * partials) as a slowly decaying sine. Convolving the notes with it makes only the strings
   * that share frequencies with the played notes ring — as on the real instrument.
   */
  const resCache = {};
  PL.makeResonanceIR = function (ctx, seconds) {
    const key = ctx.sampleRate + '|' + seconds.toFixed(1);
    if (resCache[key]) return resCache[key];
    const sr = ctx.sampleRate, len = Math.round(seconds * sr), buf = resCache[key] = ctx.createBuffer(2, len, sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    seed = 4242;
    for (let m = 21; m <= 108; m++) {
      const f0 = 440 * Math.pow(2, (m - 69) / 12);
      for (let h = 1; h <= 4; h++) {
        const f = f0 * h * (1 + 0.0004 * h * h);
        if (f > 7000) break;
        const T = seconds * (0.35 + 0.65 * Math.pow(0.5, Math.log2(f / 27.5) / 4)), n = Math.min(len, Math.round(T * sr));
        const amp = 22 / (T * sr) / h * (0.5 + 0.5 * Math.abs(rnd())), w = 2 * Math.PI * f / sr, c = 2 * Math.cos(w), r = Math.exp(-6.9 / (T * sr));
        const pan = (m - 64) / 60, gl = amp * (1 - pan * 0.5), gr = amp * (1 + pan * 0.5), ph = rnd() * Math.PI;
        let y1 = Math.sin(ph), y2 = Math.sin(ph - w), e = 1;
        for (let i = 0; i < n; i++) { const y = c * y1 - y2; y2 = y1; y1 = y; e *= r; const v = y * e * Math.min(1, i / (sr * 0.03)); L[i] += v * gl; R[i] += v * gr; }
      }
    }
    return buf;
  };
  /** soundboard: a short, dense burst of wood modes (darker and longer at the bottom) */
  PL.makeSoundboardIR = function (ctx) {
    const sr = ctx.sampleRate, len = Math.round(0.35 * sr), buf = ctx.createBuffer(2, len, sr);
    seed = 777;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0, lp2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr, x = rnd();
        lp += 0.5 * (x - lp); lp2 += 0.04 * (x - lp2);
        d[i] = (lp * Math.exp(-t / 0.018) * 0.6 + lp2 * Math.exp(-t / 0.09) * 1.4) * (i < 40 ? i / 40 : 1);
      }
      let e = 0; for (let i = 0; i < len; i++) e += d[i] * d[i];
      e = 1 / Math.sqrt(e); for (let i = 0; i < len; i++) d[i] *= e;                 // unit energy: as loud as the dry strings at 100 %
    }
    return buf;
  };

  /* =========================================================== ENGINE == */
  class Engine {
    static async create(ctx, opt) {
      opt = opt || {};
      await ctx.audioWorklet.addModule(PL.workletURL());
      const e = new Engine();
      e.ctx = ctx;
      e.node = new AudioWorkletNode(ctx, 'pl-voices', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { params: opt.params, events: opt.events || null, maxVoices: PL.CONFIG.maxModelVoices } });
      e.sampler = new PL.Sampler(ctx);
      e.build(opt.destination || ctx.destination);
      return e;
    }
    build(dest) {
      const ctx = this.ctx, n = this.n = {};
      const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
      const B = (type, f, q, gain) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; b.gain.value = gain || 0; return b; };
      const chain = list => { for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]); return list[list.length - 1]; };
      // ---- sources
      n.modelGain = G(1); this.node.connect(n.modelGain);
      n.smpGain = G(1); n.smpTone = B('highshelf', 2500, 0.6, 0); n.smpToneLo = B('lowshelf', 300, 0.6, 0);
      chain([this.sampler.out, n.smpGain, n.smpToneLo, n.smpTone]);
      n.src = G(1); n.modelGain.connect(n.src); n.smpTone.connect(n.src);
      // ---- piano: soundboard (model only) and sympathetic resonance (pedal)
      n.sb = ctx.createConvolver(); n.sb.normalize = false; n.sb.buffer = PL.makeSoundboardIR(ctx); n.sbGain = G(0);
      chain([n.modelGain, n.sb, n.sbGain, n.src]);
      n.res = ctx.createConvolver(); n.res.normalize = false; n.resIn = G(0); n.resGain = G(0);
      // ---- electric piano chain: tone → drive → speaker → tremolo → phaser
      n.epLo = B('lowshelf', 200, 0.7, 0); n.epHi = B('highshelf', 2000, 0.7, 0);
      n.drvIn = G(1); n.drv = ctx.createWaveShaper(); n.drv.oversample = '2x'; n.drvOut = G(1);
      n.amp = [0, 1, 2, 3].map(() => B('peaking', 1000, 1, 0));
      chain([n.src, n.epLo, n.epHi, n.drvIn, n.drv, n.drvOut].concat(n.amp));
      const ampOut = n.amp[3];
      n.tSplit = ctx.createChannelSplitter(2); n.tL = G(1); n.tR = G(1); n.tMerge = ctx.createChannelMerger(2);
      ampOut.connect(n.tSplit); n.tSplit.connect(n.tL, 0); n.tSplit.connect(n.tR, 1); n.tL.connect(n.tMerge, 0, 0); n.tR.connect(n.tMerge, 0, 1);
      n.tLfo = ctx.createOscillator(); n.tLfo.frequency.value = 5; n.tLfoL = G(0); n.tLfoR = G(0);
      n.tLfo.connect(n.tLfoL); n.tLfo.connect(n.tLfoR); n.tLfoL.connect(n.tL.gain); n.tLfoR.connect(n.tR.gain); n.tLfo.start();
      n.phIn = G(1); n.tMerge.connect(n.phIn);
      n.phAP = [0, 1, 2, 3].map(() => B('allpass', 900, 0.6, 0)); n.phWet = G(0); n.phOut = G(1);
      chain([n.phIn].concat(n.phAP, [n.phWet, n.phOut])); n.phIn.connect(n.phOut);
      n.phLfo = ctx.createOscillator(); n.phLfo.frequency.value = 0.4; n.phLfoG = G(500); n.phLfo.connect(n.phLfoG); n.phAP.forEach(a => n.phLfoG.connect(a.frequency)); n.phLfo.start();
      // resonance taps the dry source and joins after the piano chain
      n.src.connect(n.resIn); chain([n.resIn, n.res, n.resGain, n.phOut]);
      // ---- tone EQ
      n.eq = [B('highpass', 20, 0.7), B('lowshelf', 90, 0.7, 0), B('peaking', 300, 0.9, 0), B('peaking', 1000, 0.9, 0), B('peaking', 3500, 1, 0), B('highshelf', 10000, 0.7, 0),
        B('lowshelf', 400, 0.6, 0), B('highshelf', 2500, 0.6, 0), B('lowpass', 20000, 0.7)];
      chain([n.phOut].concat(n.eq));
      const eqOut = n.eq[n.eq.length - 1];
      // ---- compressor (parallel dry / wet)
      n.comp = ctx.createDynamicsCompressor(); n.comp.threshold.value = -24; n.comp.ratio.value = 4; n.comp.attack.value = 0.012; n.comp.release.value = 0.2; n.comp.knee.value = 12;
      n.compWet = G(0); n.compDry = G(1); n.fx = G(1);
      eqOut.connect(n.compDry); n.compDry.connect(n.fx); chain([eqOut, n.comp, n.compWet, n.fx]);
      // ---- chorus (two modulated delays, left / right)
      n.chL = ctx.createDelay(0.05); n.chR = ctx.createDelay(0.05); n.chL.delayTime.value = 0.012; n.chR.delayTime.value = 0.017;
      n.chLfo = ctx.createOscillator(); n.chLfo.frequency.value = 0.6; n.chDL = G(0.002); n.chDR = G(-0.002);
      n.chLfo.connect(n.chDL); n.chLfo.connect(n.chDR); n.chDL.connect(n.chL.delayTime); n.chDR.connect(n.chR.delayTime); n.chLfo.start();
      n.chMerge = ctx.createChannelMerger(2); n.chWet = G(0); n.mix = G(1);
      n.fx.connect(n.chL); n.fx.connect(n.chR); n.chL.connect(n.chMerge, 0, 0); n.chR.connect(n.chMerge, 0, 1); chain([n.chMerge, n.chWet, n.mix]); n.fx.connect(n.mix);
      // ---- delay
      n.dly = ctx.createDelay(1.5); n.dlyFb = G(0.3); n.dlyLP = B('lowpass', 4500, 0.7); n.dlyWet = G(0);
      n.mix.connect(n.dly); chain([n.dly, n.dlyLP, n.dlyFb, n.dly]); n.dlyLP.connect(n.dlyWet);
      // ---- reverb
      n.rev = ctx.createConvolver(); n.revWet = G(0); n.sum = G(1);
      n.mix.connect(n.rev); n.dlyWet.connect(n.rev); n.rev.connect(n.revWet);
      n.mix.connect(n.sum); n.dlyWet.connect(n.sum); n.revWet.connect(n.sum);
      // ---- stereo width (mid / side matrix)
      n.wSplit = ctx.createChannelSplitter(2); n.wMerge = ctx.createChannelMerger(2);
      n.wLL = G(1); n.wRL = G(0); n.wLR = G(0); n.wRR = G(1);
      n.sum.connect(n.wSplit);
      n.wSplit.connect(n.wLL, 0); n.wSplit.connect(n.wLR, 0); n.wSplit.connect(n.wRL, 1); n.wSplit.connect(n.wRR, 1);
      n.wLL.connect(n.wMerge, 0, 0); n.wRL.connect(n.wMerge, 0, 0); n.wLR.connect(n.wMerge, 0, 1); n.wRR.connect(n.wMerge, 0, 1);
      // ---- output: level, limiter, analyser
      n.out = G(1); n.lim = ctx.createDynamicsCompressor(); n.lim.threshold.value = -1.5; n.lim.ratio.value = 20; n.lim.attack.value = 0.002; n.lim.release.value = 0.12; n.lim.knee.value = 0;
      n.analyser = ctx.createAnalyser(); n.analyser.fftSize = 8192; n.analyser.smoothingTimeConstant = 0.75;
      chain([n.wMerge, n.out, n.lim, n.analyser]); n.analyser.connect(dest);
      this.irKey = ''; this.resKey = ''; this.pedalDown = false;
    }
    /** 'model' | 'samples' | 'layered' (recordings only when a library is loaded) */
    sourceMode(type, s) {
      const T = PL.TYPES[type];
      if (T.model === 'synth' || T.model === 'organ' || !this.sampler.lib || s.engine === 'Physical model') return 'model';
      return s.engine === 'Real samples' ? 'samples' : 'layered';
    }
    /** push settings into the graph and the worklet */
    apply(type, s, opt) {
      opt = opt || {};
      const n = this.n, ctx = this.ctx, now = ctx.currentTime, T = PL.TYPES[type];
      const set = (prm, v) => { if (opt.immediate) prm.value = v; else prm.setTargetAtTime(v, now, 0.02); };
      this.type = type; this.s = s; this.sampler.P = s;
      if (!opt.noWorklet) this.node.port.postMessage({ type: 'params', p: PL.workletParams(type, s) });
      const mode = this.mode = this.sourceMode(type, s), piano = T.model === 'piano', ep = T.model === 'ep';
      // ---- sources
      set(n.modelGain.gain, mode === 'model' ? 1 : mode === 'layered' ? s.layerMix : 0);
      set(n.smpGain.gain, mode === 'model' ? 0 : dB(s.sampleLevel));
      set(n.smpTone.gain, s.sampleTone * 8); set(n.smpToneLo.gain, -s.sampleTone * 3);
      set(n.sbGain.gain, piano ? s.soundboard * 0.5 : 0);
      // ---- sympathetic resonance
      const rk = piano ? s.resTime.toFixed(1) : '';
      if (piano && rk !== this.resKey) { this.resKey = rk; n.res.buffer = PL.makeResonanceIR(ctx, s.resTime); }
      set(n.resIn.gain, piano ? s.symRes : 0);
      this.resOpen = 1; this.resClosed = 0.12;                                        // the undamped top strings always ring a little
      set(n.resGain.gain, this.pedalDown ? this.resOpen : this.resClosed);
      // ---- electric piano / synth amp chain
      const amps = ep || T.model === 'synth';
      set(n.epLo.gain, ep ? -s.epTone * 6 : 0); set(n.epHi.gain, ep ? s.epTone * 7 : 0);
      const dr = amps ? s.drive : 0;
      if (this.drvKey !== dr.toFixed(2)) {
        this.drvKey = dr.toFixed(2);
        const N = 1024, c = new Float32Array(N), k = 1 + dr * 14;
        for (let i = 0; i < N; i++) { const x = i / (N - 1) * 2 - 1; c[i] = dr < 0.005 ? x : (Math.tanh(k * x + 0.12 * dr) - Math.tanh(0.12 * dr)) / Math.tanh(k); }
        n.drv.curve = c;
      }
      set(n.drvIn.gain, 1); set(n.drvOut.gain, 1 / (1 + dr * 1.6));
      const A = (amps && PL.EP_AMPS[s.epAmp]) || [];
      n.amp.forEach((b, i) => {
        const f = A[i];
        if (!f) { b.type = 'peaking'; set(b.gain, 0); return; }
        b.type = f[0]; set(b.frequency, f[1]); set(b.Q, f[2]); set(b.gain, f[3]);
      });
      const td = amps ? s.tremDepth * 0.5 : 0;
      set(n.tL.gain, 1 - td); set(n.tR.gain, 1 - td);
      set(n.tLfoL.gain, td); set(n.tLfoR.gain, td * (1 - 2 * s.tremStereo)); set(n.tLfo.frequency, s.tremRate);
      set(n.phWet.gain, amps ? s.phaserMix : 0); set(n.phLfo.frequency, s.phaserRate);
      // ---- EQ
      const q = n.eq;
      set(q[0].frequency, s.lowCut); set(q[1].gain, s.eqLow); set(q[2].gain, s.eqLowMid); set(q[3].gain, s.eqMid); set(q[4].gain, s.eqPres); set(q[5].gain, s.eqAir);
      set(q[6].gain, -s.tilt * 5); set(q[7].gain, s.tilt * 6); set(q[8].frequency, s.highCut);
      // ---- effects
      set(n.compWet.gain, s.comp * 1.25); set(n.compDry.gain, 1 - s.comp);
      set(n.chWet.gain, s.chorusMix * 0.8); set(n.chLfo.frequency, s.chorusRate); set(n.chDL.gain, 0.004 * s.chorusDepth); set(n.chDR.gain, -0.004 * s.chorusDepth);
      set(n.dly.delayTime, s.delayTime / 1000); set(n.dlyFb.gain, s.delayFeedback); set(n.dlyWet.gain, s.delayMix * 0.8);
      const ik = s.reverbType + '|' + s.reverbSize.toFixed(2) + '|' + Math.round(s.predelay);
      if (ik !== this.irKey) { this.irKey = ik; n.rev.buffer = PL.makeIR(ctx, s.reverbType, s.reverbSize, s.predelay); }
      set(n.revWet.gain, s.reverbMix * 1.6);
      const w = s.width;
      set(n.wLL.gain, (1 + w) / 2); set(n.wRR.gain, (1 + w) / 2); set(n.wRL.gain, (1 - w) / 2); set(n.wLR.gain, (1 - w) / 2);
      set(n.out.gain, dB(s.output));
    }
    /** play events (seconds on the context clock, time-ordered) */
    send(list, opt) {
      if (!list.length) return;
      const mode = this.mode || 'model', n = this.n, org = this.type && PL.TYPES[this.type].model === 'organ';
      for (const e of list) {
        if (e.type !== 'pedal' || org) continue;
        const t = Math.max(this.ctx.currentTime, e.t), down = e.v >= 0.5;
        this.pedalDown = down;
        n.resGain.gain.setTargetAtTime(down ? this.resOpen : this.resClosed, t, down ? 0.03 : 0.12);
      }
      if (!(opt && opt.noWorklet)) this.node.port.postMessage({ type: 'events', list: Engine.forWorklet(list, mode) });
      if (mode !== 'model') this.sampler.send(list);
    }
    /** the part of an event list the worklet needs (with recordings only: just the pedals) */
    static forWorklet(list, mode) { return mode === 'samples' ? list.filter(e => e.type === 'pedal' || e.type === 'soft') : list; }
    stop() {
      this.node.port.postMessage({ type: 'panic' });
      this.sampler.stop();
      this.pedalDown = false;
      this.n.resGain.gain.setTargetAtTime(this.resClosed || 0, this.ctx.currentTime, 0.05);
    }
    dispose() {
      try { this.stop(); } catch (e) { /* closed */ }
      try { this.node.port.postMessage({ type: 'dispose' }); } catch (e) { /* closed */ }      // end the worklet processor
      [this.n.analyser, this.node, this.sampler.out].forEach(x => { try { x.disconnect(); } catch (e) { /* not connected */ } });
      ['tLfo', 'phLfo', 'chLfo'].forEach(k => { try { this.n[k].stop(); } catch (e) { /* stopped */ } });
      const n = this.n;
      // take EVERY node of the engine out of the graph: an AnalyserNode without an output is still
      // processed by the browser, and with it the whole effect chain that feeds it (compressors,
      // reverbs, delays) — for ever, for every deleted track and every replaced song
      Object.keys(n).forEach(k => [].concat(n[k]).forEach(x => {
        if (!x || typeof x.disconnect !== 'function') return;
        try { x.disconnect(); } catch (e) { /* not connected */ }
        if (typeof x.stop === 'function') { try { x.stop(); } catch (e) { /* not started / stopped */ } }
      }));
    }
  }
  PL.Engine = Engine;

  /** id of the recordings a type + settings want (null = model) */
  PL.wantedLib = function (type, s) {
    const T = PL.TYPES[type];
    if (T.model === 'synth' || T.model === 'organ' || s.engine === 'Physical model') return null;
    if (s.sampleLib === 'My library (folder)') return 'user:' + type;
    return T.model === 'ep' ? PL.EP_MODELS[s.epModel].lib : T.lib;
  };

  /* ========================================================== OFFLINE == */
  /** Render events (seconds from 0) to an AudioBuffer with the same engine */
  PL.renderOffline = async function (type, s, events, seconds, sr, lib) {
    const oc = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const useLib = lib && PL.wantedLib(type, s) ? lib : null;
    const mode = !useLib ? 'model' : s.engine === 'Real samples' ? 'samples' : 'layered';
    // the worklet gets its events when it is created (messages are not reliable before an offline render starts)
    const eng = await Engine.create(oc, { params: PL.workletParams(type, s), events: Engine.forWorklet(events, mode).map(e => Object.assign({}, e)) });
    eng.sampler.setLibrary(useLib);
    eng.apply(type, s, { immediate: true, noWorklet: true });
    eng.send(events, { noWorklet: true });
    return oc.startRendering();
  };
})();
