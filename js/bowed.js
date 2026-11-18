/* Recorded violin and viola with dynamic layers and bow / pizzicato articulations. */
(function (SDAW) {
  'use strict';

  const base = new URL('../assets/bowed-strings/', document.currentScript.src);
  const packs = new Map(), loads = new Map();
  const decoded = new WeakMap(), iterations = new Map();
  const B = SDAW.bowed = {};

  B.register = (id, rows) => packs.set(id, rows);

  function load(id) {
    if (packs.has(id)) return Promise.resolve(packs.get(id));
    if (!loads.has(id)) {
      const job = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(id + '.js?v=vsco2-1', base);
        script.onload = () => { script.remove(); packs.has(id) ? resolve(packs.get(id)) : reject(new Error('Missing string sample bank ' + id)); };
        script.onerror = () => { script.remove(); reject(new Error('Could not load string sample bank ' + id)); };
        document.head.appendChild(script);
      });
      loads.set(id, job);
      job.catch(() => loads.delete(id));
    }
    return loads.get(id);
  }

  // Find the voiced body of the recording, then match phase at its loop boundaries.
  function sustainLoop(buffer, root, offset) {
    const data = buffer.getChannelData(0), rate = buffer.sampleRate;
    const period = Math.round(rate / (440 * Math.pow(2, (root - 69) / 12)));
    const frame = Math.ceil(rate * .02), energies = [];
    const first = Math.ceil(offset * rate);
    let peak = 0;
    for (let at = first; at + frame <= data.length; at += frame) {
      let energy = 0;
      for (let i = at; i < at + frame; i += 2) energy += data[i] ** 2;
      energies.push(energy);
      peak = Math.max(peak, energy);
    }
    let startFrame = 0, endFrame = 0, cursor = 0;
    energies.forEach((energy, i) => {
      if (energy < peak * .16) cursor = i + 1;
      else if (i + 1 - cursor > endFrame - startFrame) { startFrame = cursor; endFrame = i + 1; }
    });
    if (!peak || endFrame - startFrame < 3) return null;
    const activeStart = first + startFrame * frame, activeLength = (endFrame - startFrame) * frame;
    const start = Math.round(activeStart + activeLength * .18);
    const ideal = Math.round(activeStart + activeLength * .82);
    let best = Infinity, end = ideal;
    for (let j = ideal - period; j <= ideal + period; j++) {
      let error = 0, energy = 0;
      for (let i = -period; i < period; i += 2) {
        const l = data[start + i], r = data[j + i];
        error += (l - r) ** 2;
        energy += l * l + r * r;
      }
      const cost = error / Math.max(energy, .000001);
      if (cost < best) { best = cost; end = j; }
    }
    return [start / rate, end / rate];
  }

  // Remove the recording's leading silence while leaving the physical attack intact.
  function attackOffset(buffer) {
    const data = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i += 2) peak = Math.max(peak, Math.abs(data[i]));
    const threshold = peak * .015, window = Math.ceil(buffer.sampleRate * .003);
    for (let i = 0; i < data.length; i += window) {
      let strong = 0;
      for (let j = i; j < Math.min(data.length, i + window); j++) if (Math.abs(data[j]) > threshold) strong++;
      if (strong >= window / 4) return Math.max(0, i / buffer.sampleRate - .008);
    }
    return 0;
  }

  function bank(context, id) {
    if (!decoded.has(context)) decoded.set(context, new Map());
    const cache = decoded.get(context);
    if (!cache.has(id)) {
      const entry = { samples: null };
      cache.set(id, entry);
      entry.ready = load(id).then(async rows => {
        const result = [];
        // Limit simultaneous decodes to keep memory bounded.
        for (let i = 0; i < rows.length; i += 8) {
          const group = await Promise.all(rows.slice(i, i + 8).map(async ([art, root, layer, rr, data]) => {
            const buffer = await context.decodeAudioData(Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer);
            const offset = attackOffset(buffer);
            return { art, root, layer, rr, buffer, offset, loop: art === 'arco' ? sustainLoop(buffer, root, offset) : null };
          }));
          result.push(...group);
        }
        entry.samples = result;
      }).catch(error => { cache.delete(id); throw error; });
    }
    return cache.get(id);
  }

  const instrument = track => ['violin-section', 'viola', 'solo-viola'].includes(track.params?.bowed) ? track.params.bowed : 'violin';
  B.whenReady = (track, context) => {
    if (track.engine !== 'bowed') return null;
    const entry = bank(context, instrument(track));
    return entry.samples ? null : entry.ready;
  };

  B.play = function (context, track, pitch, time, duration, opts, input, keep) {
    const id = instrument(track), entry = bank(context, id);
    if (!entry.samples) { entry.ready.catch(() => {}); return false; }
    const tech = opts.tech || {}, velocity = opts.vel ?? 96;
    const slur = tech.bowSlur;
    const legatoIn = slur === 'continue' || slur === 'stop';
    const legatoOut = slur === 'continue' || slur === 'start';
    const art = tech.pizz ? 'pizz' : tech.stacc || (!tech.arco && !opts.heldBow && duration < .16) ? 'short' : 'arco';
    const layer = Number(velocity >= 87);
    let cost = Infinity, choices = [];
    const recordedArt = id === 'solo-viola' && art === 'short' ? 'arco' : art;
    for (const sample of entry.samples) {
      if (sample.art !== recordedArt) continue;
      const score = Math.abs(pitch - sample.root) * 2 + Number(sample.layer !== layer);
      if (score < cost) { choices = []; cost = score; }
      if (score === cost) choices.push(sample);
    }
    if (!choices.length) return false;
    const key = id + ':' + art + ':' + pitch + ':' + layer;
    const next = iterations.get(key) || 0;
    const sample = choices[next % choices.length];
    iterations.set(key, (next + 1) % choices.length);

    const src = context.createBufferSource(), gain = context.createGain();
    src.buffer = sample.buffer;
    const rate = Math.pow(2, (pitch - sample.root) / 12);
    src.playbackRate.value = rate;
    const release = legatoOut ? .026 : art === 'arco' ? .16 : .11;
    const skipAttack = legatoIn ? Math.min(.072, sample.buffer.duration / 8) : 0;
    const offset = opts.heldBow && sample.loop ? sample.loop[0] : sample.offset + skipAttack;
    if (sample.loop && (opts.heldBow || offset + (duration + release) * rate > sample.loop[1])) {
      src.loop = true;
      [src.loopStart, src.loopEnd] = sample.loop;
    }
    // Bring the quieter solo violin recordings up to the ensemble, with extra room for the lead.
    const violinBoostDb = 4 + 3 * Math.max(0, Math.min(1, (velocity - 65) / 25));
    const level = id === 'solo-viola' ? .8 : id === 'viola' ? .94 : id === 'violin-section' ? 1.06 : .85 * 10 ** (violinBoostDb / 20);
    const peak = (.16 + .84 * (velocity / 127) ** 1.45) * level;
    const attack = Math.min(duration * .25, legatoIn ? .016 : art === 'arco' ? .022 : .003);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.setValueAtTime(peak, time + duration);
    if (legatoOut) gain.gain.linearRampToValueAtTime(.0001, time + duration + release);
    else gain.gain.exponentialRampToValueAtTime(.0001, time + duration + release);
    src.connect(gain).connect(input);
    src.onended = () => { src.disconnect(); gain.disconnect(); };
    src.start(time, offset);
    src.stop(time + duration + release + .02);
    keep(src, time + duration + release + .02);
    return true;
  };
})(window.SDAW);
