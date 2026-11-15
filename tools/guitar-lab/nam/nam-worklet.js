/* =====================================================================
 *  GUITAR LAB — nam/nam-worklet.js
 *  AudioWorkletProcessor that runs Neural Amp Modeler captures of real
 *  amplifiers (WebAssembly engine by TONE3000, MIT licence:
 *  https://github.com/tone-3000/neural-amp-modeler-wasm).
 *  Plain-JS port of their nam-worklet.ts. Mono in → mono out.
 * ===================================================================== */
import createNamEngine from './nam-engine.js';

const QUANTUM = 128;
const FADE_IN = 1024;
let modulePromise = null;

class GLNamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.module = null; this.id = 0; this.hasModel = false; this.ptr = 0; this.view = null; this.fade = 0; this.dead = false;
    this.port.onmessage = e => { this.handle(e.data); };
  }
  respond(requestId, ok, extra) { this.port.postMessage(Object.assign({ type: 'response', requestId, ok }, extra || {})); }
  async handle(r) {
    try {
      if (r.type === 'init') {
        modulePromise = modulePromise || createNamEngine({ wasmBinary: r.wasmBytes, locateFile: p => p });
        this.module = await modulePromise;
        this.id = this.module._nam_createInstance(sampleRate, QUANTUM);
        this.ptr = this.module._nam_getBuffer(this.id);
        this.respond(r.requestId, true);
      } else if (r.type === 'load-model') {
        const M = this.module, len = M.lengthBytesUTF8(r.json) + 1, p = M._malloc(len);
        M.stringToUTF8(r.json, p, len);
        const ok = M._nam_loadModel(this.id, p, r.slimSize === undefined ? -1 : r.slimSize);
        M._free(p);
        if (!ok) throw new Error(M.UTF8ToString(M._nam_getLastError()) || 'model load failed');
        this.view = null; this.hasModel = true; this.fade = FADE_IN;
        this.respond(r.requestId, true, { loudness: M._nam_hasLoudness(this.id) ? M._nam_getLoudness(this.id) : null, rate: M._nam_getExpectedSampleRate(this.id) });
      } else if (r.type === 'unload-model') {
        this.module._nam_unloadModel(this.id); this.hasModel = false; this.respond(r.requestId, true);
      }
    } catch (err) {
      this.respond(r.requestId, false, { error: err && err.message ? err.message : String(err) });
    }
  }
  process(inputs, outputs) {
    if (this.dead) return false;
    const out = outputs[0] && outputs[0][0]; if (!out) return true;
    const inp = inputs[0] && inputs[0].length ? inputs[0][0] : null;
    const n = out.length;
    if (!this.module || !this.hasModel || !inp || n > QUANTUM) { if (inp) out.set(inp); else out.fill(0); return true; }
    if (!this.view || this.view.buffer !== this.module.HEAPF32.buffer) this.view = this.module.HEAPF32.subarray(this.ptr >> 2, (this.ptr >> 2) + QUANTUM);
    this.view.set(inp);
    this.module._nam_process(this.id, n);
    for (let i = 0; i < n; i++) out[i] = this.view[i];
    if (this.fade > 0) for (let i = 0; i < n && this.fade > 0; i++) { out[i] *= 1 - this.fade / FADE_IN; this.fade--; }
    return true;
  }
}
registerProcessor('gl-nam', GLNamProcessor);
