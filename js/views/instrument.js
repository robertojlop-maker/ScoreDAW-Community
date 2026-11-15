/* =============================================================================
 *  INSTRUMENT.JS — Generator view (F8): the sound generator of the selected track
 *  -----------------------------------------------------------------------------
 *  Shows a hardware-style panel for the generator of the track:
 *    3x Osc Synth   OSC 1-3 · FILTER · AMP ENVELOPE · LFO · GLIDE · presets
 *    Sampler        sample zones (root note), tune, attack, release
 *    String model   pick brightness, sustain, techniques
 *    Keys           tone (piano / EP / organ)
 *    Ensemble       brightness (cutoff)
 *    Drum Synth     pads and their sounds
 *  Every knob changes the sound live; release the mouse to keep the change
 *  (undo with Ctrl+Z). The keyboard at the bottom auditions the sound.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const iv = {};
  SDAW.instrumentView = iv;
  const WAVES = [['sine', '∿ Sine'], ['triangle', '△ Triangle'], ['sawtooth', '⩘ Saw'], ['square', '⊓ Square'], ['noise', '░ Noise']];

  function knob(label, obj, key, min, max, step, fmt, log) {
    const s = SDAW.store;
    const toPos = v => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
    const fromPos = p => log ? min * Math.pow(max / min, p) : min + p * (max - min);
    const val = el('div', { class: 'kn-val' }, fmt ? fmt(obj[key]) : String(obj[key]));
    const input = el('input', { type: 'range', min: 0, max: 1000, step: 1, value: Math.round(toPos(obj[key]) * 1000),
      oninput: e => { let v = fromPos(e.target.value / 1000); if (step) v = Math.round(v / step) * step; obj[key] = v; val.textContent = fmt ? fmt(v) : String(v); },
      onmousedown: () => s.beginEdit(), onchange: () => s.endEdit('Generator ' + label) });
    return el('div', { class: 'kn', 'data-help': label }, [el('div', { class: 'kn-label' }, label), input, val]);
  }
  const card = (title, color, content) => el('div', { class: 'gen-card', style: { '--gc': color } }, [el('div', { class: 'gen-title' }, title), el('div', { class: 'gen-body' }, content)]);
  const pct = v => Math.round(v * 100) + '%';
  const sec = v => v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s';
  const hz = v => v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz';

  iv.render = function () {
    const view = $('#view-instrument');
    view.innerHTML = '';
    const s = SDAW.store, t = s.selTrack();
    if (!t) { view.appendChild(el('div', { class: 'empty-msg' }, 'Select a track')); return; }
    const head = el('div', { class: 'gen-head' }, [
      el('span', { class: 'gen-ico' }, SDAW.TRACK_ICONS[t.type] || '🎛️'),
      el('div', {}, [el('b', {}, t.name), el('small', {}, generatorName(t) + ' · ' + t.instrument)]),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn small', onclick: () => { SDAW.library.tab = 'generators'; SDAW.library.render(); if (!SDAW.layout.state.libOpen) SDAW.layout.toggle('libOpen'); } }, '🎛️ Change generator…')
    ]);
    view.appendChild(head);
    const rack = el('div', { class: 'gen-rack' });
    view.appendChild(rack);

    if (t.sampler) samplerPanel(rack, t);
    else if (t.engine === 'rig') rigPanel(rack, t);
    else if (t.engine === 'pianorig') prigPanel(rack, t);
    else if (t.engine === 'windrig') wrigPanel(rack, t);
    else if (t.engine === 'gen') synthPanel(rack, t);
    else if (t.engine === 'guitar' || t.engine === 'bass') stringPanel(rack, t);
    else if (t.engine === 'keys') keysPanel(rack, t);
    else if (t.engine === 'strings' || t.engine === 'synth') simplePanel(rack, t);
    else if (t.engine === 'drums') drumPanel(rack, t);
    if (t.type !== 'drums') view.appendChild(miniKeys(t));
  };

  function generatorName(t) {
    if (t.sampler) return 'Sampler (' + t.sampler.zones.length + ' samples)';
    return { rig: 'Guitar Rig', pianorig: 'Piano Rig', windrig: 'Wind Rig', gen: '3x Osc Synth', guitar: 'Guitar String Model', bass: 'Bass String Model', keys: 'Keys', strings: 'Ensemble', synth: 'Basic Synth', drums: 'Drum Synth' }[t.engine] || t.engine;
  }

  /* ----------------------------------------------------- Guitar Rig --- */
  // The full rig (amp, cabinet, pickups, EQ…) is its own window: this card shows the guitar,
  // where its sound comes from and the most used controls.
  function rigPanel(rack, t) {
    const RG = SDAW.guitarRig;
    if (!RG || !RG.ok()) { rack.appendChild(card('GUITAR RIG', '#ff4fd8', [el('div', { class: 'empty-msg' }, 'The guitar engine is not available in this browser — the light string model plays.')])); return; }
    const m = RG.model(t), T = GL.TYPES[m], st = RG.status(t);
    const rk = (id, label) => {
      const p = GL.PARAMS.find(x => x.id === id), cur = RG.settings(t)[id];
      const val = el('div', { class: 'kn-val' }, String(Math.round(cur * 100) / 100));
      const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur,
        onmousedown: () => SDAW.store.beginEdit(),
        oninput: e => { RG.setValue(t, id, +e.target.value); RG.applyNow(t); val.textContent = String(Math.round(e.target.value * 100) / 100); },
        onchange: () => SDAW.store.endEdit('Guitar Rig: ' + label) });
      return el('div', { class: 'kn', 'data-help': label + (p.tip ? ' — ' + p.tip : '') }, [el('div', { class: 'kn-label' }, label), input, val]);
    };
    rack.appendChild(card('GUITAR RIG', '#ff4fd8', [
      el('div', { class: 'rig-gen-model' }, [el('span', { class: 'gen-ico' }, T.icon), el('div', {}, [el('b', {}, T.name), el('small', {}, T.desc)])]),
      el('div', { class: 'rig-status' }, [el('span', { class: 'rig-dot ' + st.level }), st.text + (st.amp ? ' · ' + st.amp : '')]),
      el('button', { class: 'btn primary', style: { width: '100%', marginTop: '8px' }, 'data-help': 'Open the Guitar Rig window: pickups, the 3D amplifier, cabinet, microphone, EQ, effects…', onclick: () => SDAW.rigPanel.open(t.id) }, '🎸 Open Guitar Rig…')
    ]));
    rack.appendChild(card('QUICK TONE', '#ffd23f', [rk('tilt', 'Warm ↔ Bright'), rk('eqAir', 'Air'), rk('thickness', 'Thickness'), rk('reverbMix', 'Reverb'), rk('output', 'Output')]));
  }

  /* ------------------------------------------------------- Wind Rig --- */
  function wrigPanel(rack, t) {
    const WR = SDAW.windRig;
    if (!WR || !WR.ok()) { rack.appendChild(card('WIND RIG', '#36f1cd', [el('div', { class: 'empty-msg' }, 'The wind engine files were not found (tools/wind-lab) — the basic synth plays.')])); return; }
    const m = WR.model(t), T = WL.TYPES[m], st = WR.status(t);
    const rk = (id, label) => {
      const p = WL.PARAMS.find(x => x.id === id), cur = WR.settings(t)[id];
      const val = el('div', { class: 'kn-val' }, String(Math.round(cur * 100) / 100));
      const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur,
        onmousedown: () => SDAW.store.beginEdit(),
        oninput: e => { WR.setValue(t, id, +e.target.value); WR.applyNow(t); val.textContent = String(Math.round(e.target.value * 100) / 100); },
        onchange: () => SDAW.store.endEdit('Wind Rig: ' + label) });
      return el('div', { class: 'kn', 'data-help': label + (p.tip ? ' — ' + p.tip : '') }, [el('div', { class: 'kn-label' }, label), input, val]);
    };
    rack.appendChild(card('WIND RIG', '#36f1cd', [
      el('div', { class: 'rig-gen-model' }, [el('span', { class: 'gen-ico' }, T.icon), el('div', {}, [el('b', {}, T.name), el('small', {}, T.desc)])]),
      el('div', { class: 'rig-status' }, [el('span', { class: 'rig-dot ' + st.level }), st.text]),
      el('button', { class: 'btn primary', style: { width: '100%', marginTop: '8px' }, 'data-help': 'Open the Wind Rig window', onclick: () => SDAW.wrigPanel.open(t.id) }, '🎷 Open Wind Rig…')
    ]));
    rack.appendChild(card('QUICK TONE', '#36f1cd', [rk('tilt', 'Warm ↔ Bright'), rk('breath', 'Breath'), rk('vibDelay', 'Vibrato delay'), rk('reverbMix', 'Reverb'), rk('output', 'Output')]));
  }

  /* ------------------------------------------------------ Piano Rig --- */
  function prigPanel(rack, t) {
    const PR = SDAW.pianoRig;
    if (!PR || !PR.ok()) { rack.appendChild(card('PIANO RIG', '#ffd23f', [el('div', { class: 'empty-msg' }, 'The keyboard engine is not available in this browser — the light keys engine plays.')])); return; }
    const m = PR.model(t), T = PL.TYPES[m], st = PR.status(t);
    const rk = (id, label) => {
      const p = PL.PARAMS.find(x => x.id === id), cur = PR.settings(t)[id];
      const val = el('div', { class: 'kn-val' }, String(Math.round(cur * 100) / 100));
      const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 0.01, value: cur,
        onmousedown: () => SDAW.store.beginEdit(),
        oninput: e => { PR.setValue(t, id, +e.target.value); PR.applyNow(t); val.textContent = String(Math.round(e.target.value * 100) / 100); },
        onchange: () => SDAW.store.endEdit('Piano Rig: ' + label) });
      return el('div', { class: 'kn', 'data-help': label + (p.tip ? ' — ' + p.tip : '') }, [el('div', { class: 'kn-label' }, label), input, val]);
    };
    rack.appendChild(card('PIANO RIG', '#ffd23f', [
      el('div', { class: 'rig-gen-model' }, [el('span', { class: 'gen-ico' }, T.icon), el('div', {}, [el('b', {}, T.name), el('small', {}, T.desc)])]),
      el('div', { class: 'rig-status' }, [el('span', { class: 'rig-dot ' + st.level }), st.text]),
      el('button', { class: 'btn primary', style: { width: '100%', marginTop: '8px' }, 'data-help': 'Open the Piano Rig window', onclick: () => SDAW.prigPanel.open(t.id) }, '🎹 Open Piano Rig…')
    ]));
    rack.appendChild(card('QUICK TONE', '#ffd23f', [rk('tilt', 'Warm ↔ Bright'), rk('eqAir', 'Air'), rk('reverbMix', 'Reverb'), rk('output', 'Output')]));
  }

  /* --------------------------------------------------------- 3x Osc --- */
  function synthPanel(rack, t) {
    const s = SDAW.store;
    t.params.gen = Object.assign(SDAW.deepCopy(SDAW.GEN_DEFAULT), t.params.gen || {});
    const P = t.params.gen;
    rack.appendChild(card('PRESET', '#9b5cff', [
      el('select', { 'data-help': 'Load a preset of the 3x Osc', onchange: e => s.mutate('Generator preset', () => { t.params.gen = SDAW.genPreset(e.target.value); }) },
        Object.keys(SDAW.GEN_PRESETS).map(n => el('option', { value: n, selected: P.preset === n ? true : null }, n))),
      knob('Volume', P, 'gain', 0, 1.5, 0.01, pct),
      knob('Glide', P, 'glide', 0, 0.5, 0.005, sec)
    ]));
    P.osc.forEach((o, i) => rack.appendChild(card('OSC ' + (i + 1), ['#22e0ff', '#ff4fd8', '#ffd23f'][i], [
      el('select', { 'data-help': 'Waveform of oscillator ' + (i + 1), onchange: e => s.mutate('Osc wave', () => { o.wave = e.target.value; }) },
        WAVES.map(([v, l]) => el('option', { value: v, selected: o.wave === v ? true : null }, l))),
      knob('Octave', o, 'oct', -2, 2, 1, v => (v > 0 ? '+' : '') + v),
      knob('Detune', o, 'det', -50, 50, 1, v => (v > 0 ? '+' : '') + v + ' ct'),
      knob('Level', o, 'vol', 0, 1, 0.01, pct)
    ])));
    rack.appendChild(card('FILTER', '#2bff88', [
      knob('Cutoff', P, 'cutoff', 60, 16000, 0, hz, true),
      knob('Resonance', P, 'res', 0.5, 18, 0.1, v => v.toFixed(1)),
      knob('Env amount', P, 'envAmt', 0, 1, 0.01, pct)
    ]));
    rack.appendChild(card('AMP ENVELOPE', '#ff9f2e', [
      knob('Attack', P, 'a', 0.001, 3, 0, sec, true), knob('Decay', P, 'd', 0.01, 4, 0, sec, true),
      knob('Sustain', P, 's', 0, 1, 0.01, pct), knob('Release', P, 'r', 0.01, 5, 0, sec, true)
    ]));
    rack.appendChild(card('LFO', '#a35cff', [
      el('select', { 'data-help': 'What the LFO moves', onchange: e => s.mutate('LFO target', () => { P.lfoTo = e.target.value; }) },
        [['pitch', 'Pitch (vibrato)'], ['cutoff', 'Filter (wah / wobble)'], ['amp', 'Volume (tremolo)']].map(([v, l]) => el('option', { value: v, selected: P.lfoTo === v ? true : null }, l))),
      knob('Rate', P, 'lfoRate', 0.1, 20, 0, v => v.toFixed(1) + ' Hz', true),
      knob('Depth', P, 'lfoDepth', 0, 1, 0.01, pct)
    ]));
  }

  /* --------------------------------------------------------- Sampler --- */
  function samplerPanel(rack, t) {
    const s = SDAW.store;
    t.params = t.params || {};
    ['sTune', 'sAttack', 'sRelease'].forEach((k, i) => { if (t.params[k] === undefined) t.params[k] = [0, 0, 0.25][i]; });
    const zones = t.sampler.zones;
    const names = zones.map(z => { const sm = (s.song.samples || []).find(x => x.id === z.sampleId); return { z, name: sm ? sm.name : z.sampleId }; });
    const drop = el('div', { class: 'gen-drop', 'data-help': 'Drop a sound or an instrument here (Library → Sounds / Folders), or audio files from Windows' },
      zones.length ? names.map(({ z, name }) => el('div', { class: 'zone' }, [el('b', {}, SDAW.midiToName(z.root)), el('span', {}, name),
        el('button', { class: 'chip-btn', 'data-help': 'Change the root note of this sample', onclick: () => SDAW.ask('Root note (MIDI number, 60 = C4)', String(z.root), v => s.mutate('Zone root', () => { z.root = parseInt(v, 10) || z.root; })) }, '✎'),
        el('button', { class: 'chip-btn', onclick: () => s.mutate('Remove zone', () => { t.sampler.zones = zones.filter(x => x !== z); }) }, '✕')]))
        : [el('div', { class: 'empty-msg', style: { padding: '18px' } }, 'Drop sounds here — one sample plays on every note (pitched), several samples are spread by their root note.')]);
    SDAW.makeDropTarget(drop, 'sample finst file', async p => {
      if (p.kind === 'finst') return SDAW.factory.applyInstrument(p.instId, t);
      const files = p.kind === 'file' ? p.files : [p];
      for (const f of files) {
        const sid = await SDAW.resolveSample(f instanceof File ? f : p);
        const root = SDAW.samples.rootFromName(f.name || p.name || '') || 60;
        s.mutate('Add zone', () => { SDAW.registerSample(sid); t.sampler.zones.push({ sampleId: sid, root }); t.sampler.zones.sort((a, b) => a.root - b.root); });
      }
    });
    rack.appendChild(card('SAMPLE ZONES (' + zones.length + ')', '#22e0ff', [drop]));
    rack.appendChild(card('SAMPLER', '#ff4fd8', [
      knob('Tune', t.params, 'sTune', -24, 24, 1, v => (v > 0 ? '+' : '') + v + ' st'),
      knob('Attack', t.params, 'sAttack', 0, 2, 0.005, sec),
      knob('Release', t.params, 'sRelease', 0.01, 4, 0.01, sec)
    ]));
  }

  /* ---------------------------------------------------- String model --- */
  function stringPanel(rack, t) {
    t.params = t.params || {};
    if (t.params.brightness === undefined) t.params.brightness = 0.6;
    if (t.params.decay === undefined) t.params.decay = 0.996;
    const T = t.technique;
    rack.appendChild(card('STRING', '#ff4fd8', [
      knob('Brightness', t.params, 'brightness', 0.05, 1, 0.01, pct),
      knob('Sustain', t.params, 'decay', 0.985, 0.9995, 0.0005, v => Math.round((v - 0.985) / 0.0145 * 100) + '%'),
      knob('Pick attack', T, 'attack', 0, 1, 0.01, pct),
      knob('Resonance', T, 'resonance', 0, 1, 0.01, pct)
    ]));
    rack.appendChild(card('TECHNIQUES', '#22e0ff', [
      knob('Bend range', T, 'bendRange', 0.5, 4, 0.5, v => v + ' st'),
      knob('Vibrato depth', T, 'vibDepth', 0, 1, 0.01, pct),
      knob('Vibrato speed', T, 'vibSpeed', 2, 9, 0.1, v => v.toFixed(1) + ' Hz'),
      knob('Slide time', T, 'slideTime', 0.03, 0.4, 0.01, sec),
      knob('Humanize', T, 'humanize', 0, 1, 0.01, pct)
    ]));
  }

  function keysPanel(rack, t) {
    const s = SDAW.store;
    rack.appendChild(card('KEYS', '#ffd23f', [
      el('select', { onchange: e => s.mutate('Keys tone', () => { t.params.tone = e.target.value; }) },
        [['piano', 'Piano'], ['ep', 'Electric piano'], ['organ', 'Organ']].map(([v, l]) => el('option', { value: v, selected: (t.params.tone || 'piano') === v ? true : null }, l))),
      el('div', { class: 'st-note' }, 'For a real recorded piano use Library → Sounds → Instruments (Grand Piano, Upright Piano).')
    ]));
  }
  function simplePanel(rack, t) {
    t.params = t.params || {};
    if (t.params.cutoff === undefined) t.params.cutoff = 2200;
    rack.appendChild(card(t.engine === 'strings' ? 'ENSEMBLE' : 'BASIC SYNTH', '#b26bff', [
      knob('Brightness', t.params, 'cutoff', 300, 9000, 0, hz, true),
      el('div', { class: 'st-note' }, 'Tip: the 3x Osc generator (Library → Generators) has oscillators, filter, envelopes and LFO.')
    ]));
  }
  function drumPanel(rack, t) {
    const s = SDAW.store;
    rack.appendChild(card('DRUM PADS', '#7cff4f', SDAW.DRUM_ROWS.map(r => {
      const sid = t.drumMap && t.drumMap[r.id], sm = sid && (s.song.samples || []).find(x => x.id === sid);
      return el('div', { class: 'zone' }, [el('b', { style: { color: r.color } }, r.name), el('span', {}, sm ? '🔊 ' + sm.name : 'built-in synth'),
        el('button', { class: 'chip-btn', onclick: () => SDAW.audio.previewDrum(t, r.id) }, '▶'),
        el('button', { class: 'chip-btn', onclick: () => SDAW.library.showPadSounds(r.id) }, '🎧')]);
    }).concat([el('div', { class: 'st-note' }, 'Drag sounds from Library → Sounds onto the pads in the Pattern view (F2).')])));
  }

  /** Small keyboard to audition the generator */
  function miniKeys(t) {
    const wrap = el('div', { class: 'gen-keys', 'data-help': 'Click to hear the generator' });
    for (let p = 36; p <= 84; p++) {
      const k = el('div', { class: 'gk' + (SDAW.isBlack(p) ? ' b' : ''), onmousedown: () => SDAW.audio.previewNote(t, p, { dur: 0.8 }) }, p % 12 === 0 ? 'C' + (p / 12 - 1) : '');
      wrap.appendChild(k);
    }
    return wrap;
  }

  iv.tools = function (box) {
    box.appendChild(el('span', { class: 'chip-btn' }, 'Live: changes are heard immediately · Ctrl+Z undoes'));
  };

})(window.SDAW);
