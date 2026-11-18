/* Acoustic concert harp. One recorded dynamic layer, shaped by velocity and damping. */
(function (SDAW) {
  'use strict';
  const base = new URL('../assets/harp/', document.currentScript.src);
  const H = SDAW.harp = {};
  const banks = new WeakMap(), voices = new WeakMap();
  let recordings = null, loading = null;
  H.register = rows => { recordings = rows; };

  function load() {
    if (recordings) return Promise.resolve(recordings);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('concert-harp.js?v=1', base);
        script.onload = () => {
          script.remove();
          recordings ? resolve(recordings) : reject(new Error('The concert harp bank is empty'));
        };
        script.onerror = () => { script.remove(); reject(new Error('Could not load the concert harp recordings')); };
        document.head.appendChild(script);
      });
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  function bank(context) {
    if (!banks.has(context)) {
      const entry = { samples: null };
      banks.set(context, entry);
      entry.ready = load().then(async rows => {
        const samples = [];
        for (let i = 0; i < rows.length; i += 6) {
          samples.push(...await Promise.all(rows.slice(i, i + 6).map(async ([root, audio]) => {
            const data = Uint8Array.from(atob(audio), char => char.charCodeAt(0));
            const buffer = await context.decodeAudioData(data.buffer);
            const channel = buffer.getChannelData(0);
            let peak = 0;
            for (let j = 0; j < channel.length; j++) peak = Math.max(peak, Math.abs(channel[j]));
            let offset = 0;
            while (offset < channel.length && Math.abs(channel[offset]) < peak * .015) offset++;
            const begin = Math.min(channel.length - 1, offset);
            const end = Math.min(channel.length, begin + Math.floor(buffer.sampleRate * .6));
            let energy = 0;
            for (let j = begin; j < end; j++) energy += channel[j] ** 2;
            const rms = Math.sqrt(energy / Math.max(1, end - begin));
            const level = Math.min(6, Math.max(.5, .045 / Math.max(.0001, rms)));
            return { root, buffer, level, offset: Math.max(0, offset / buffer.sampleRate - .002) };
          })));
        }
        entry.samples = samples;
      }).catch(error => { banks.delete(context); throw error; });
    }
    return banks.get(context);
  }

  H.whenReady = (track, context) => {
    if (track.engine !== 'harp') return null;
    const entry = bank(context);
    return entry.samples ? null : entry.ready;
  };

  H.play = function (context, track, pitch, time, duration, opts, input, keep) {
    const entry = bank(context);
    if (!entry.samples) { entry.ready.catch(() => {}); return false; }
    const sample = entry.samples.reduce((best, next) =>
      Math.abs(next.root - pitch) < Math.abs(best.root - pitch) ? next : best);
    const velocity = Math.max(1, Math.min(127, opts.vel ?? 90));
    const rate = 2 ** ((pitch - sample.root) / 12);
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = sample.buffer;
    source.playbackRate.value = rate;
    filter.type = 'lowpass';
    filter.frequency.value = 2200 + (velocity / 127) ** 1.2 * 16000;
    filter.Q.value = .3;
    const peak = .95 * sample.level * (velocity / 127) ** 1.45;
    const release = opts.tech?.stacc ? .08 : opts.tech?.harpRun ? .18 : Math.max(.3, .95 - (pitch - 40) * .008);
    const available = (sample.buffer.duration - sample.offset) / rate;
    const gate = Math.min(Math.max(.03, duration), Math.max(.03, available - release));
    const end = time + Math.min(available, gate + release);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + .003);
    gain.gain.setValueAtTime(peak, time + gate);
    gain.gain.exponentialRampToValueAtTime(.0001, end);

    if (!voices.has(context)) voices.set(context, new Map());
    const active = voices.get(context), key = track.id + ':' + pitch;
    const previous = active.get(key);
    if (previous && previous.end > time) {
      previous.gain.gain.cancelAndHoldAtTime(time);
      previous.gain.gain.exponentialRampToValueAtTime(.0001, time + .035);
      previous.source.stop(time + .04);
    }
    const voice = { source, gain, end };
    active.set(key, voice);
    source.connect(filter).connect(gain).connect(input);
    source.onended = () => {
      source.disconnect(); filter.disconnect(); gain.disconnect();
      if (active.get(key) === voice) active.delete(key);
    };
    source.start(time, sample.offset);
    source.stop(end + .01);
    keep(source, end + .01);
    return true;
  };
})(window.SDAW);
