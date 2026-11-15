/* =============================================================================
 *  MIXER.JS — one channel strip per track + master
 *  -----------------------------------------------------------------------------
 *  Strip: name (track colour) · insert slots (pedalboard effects, click = on/off)
 *         · Reverb / Delay sends · pan · fader · live meter · Mute / Solo
 *  Drop an Effect or Preset from the library onto a strip to apply it.
 *  Master: fader + meter + RMS level readout.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const mx = { meters: {} };
  SDAW.mixer = mx;
  const FX_ORDER = [['comp', 'Compressor'], ['drive', 'Overdrive'], ['dist', 'Distortion'], ['amp', 'Amp'], ['eq', 'EQ'], ['chorus', 'Chorus'], ['delay', 'Delay'], ['reverb', 'Reverb']];

  const toDb = (v) => v <= 0.0001 ? '-∞' : (20 * Math.log10(v * v * 1.2)).toFixed(1);

  mx.render = function () {
    const view = $('#view-mixer');
    view.innerHTML = '';
    const s = SDAW.store;
    const wrap = el('div', { class: 'mixer' });
    mx.meters = {};
    s.song.tracks.forEach(t => {
      const strip = el('div', { class: 'strip' + (s.sel.trackId === t.id ? ' sel' : ''), onmousedown: () => s.selectTrack(t.id) });
      strip.appendChild(el('div', { class: 'strip-head', style: { background: t.color, boxShadow: '0 0 12px ' + t.color + '66' } }, (SDAW.TRACK_ICONS[t.type] || '') + ' ' + t.name));
      strip.appendChild(el('div', { class: 'slots', 'data-help': 'Insert effects of this track. Click to switch on/off. Drop effects here from the library.' },
        FX_ORDER.map(([k, name]) => { const f = SDAW.normalizePedals(t.fx)[k]; return el('div', { class: 'slot' + (f.on ? ' on' : ''), 'data-help': name + ': ' + SDAW.pedalModel(k, f.model).name + ' — click = on/off', onclick: (e) => { e.stopPropagation(); SDAW.applyEffect(t, name); } }, f.on ? SDAW.pedalModel(k, f.model).short : name); })));
      strip.appendChild(el('div', { class: 'knobrow pro-only' }, [
        el('label', { 'data-help': 'Reverb send' }, ['Rev', el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: t.sendRev, oninput: e => { t.sendRev = +e.target.value; SDAW.audio.updateTrack(t); }, onchange: () => s.mutate('Send', () => {}) })]),
        el('label', { 'data-help': 'Delay send' }, ['Dly', el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: t.sendDly, oninput: e => { t.sendDly = +e.target.value; SDAW.audio.updateTrack(t); }, onchange: () => s.mutate('Send', () => {}) })])
      ]));
      strip.appendChild(el('label', { class: 'knobrow', 'data-help': 'Pan (left / right). Double-click to center.' }, [
        el('span', {}, 'L'),
        el('input', { type: 'range', min: -1, max: 1, step: 0.01, value: t.pan, style: { width: '64px' },
          oninput: e => { t.pan = +e.target.value; SDAW.audio.updateTrack(t); }, onchange: () => s.mutate('Pan', () => {}),
          ondblclick: e => { t.pan = 0; e.target.value = 0; SDAW.audio.updateTrack(t); } }),
        el('span', {}, 'R')
      ]));
      const meter = el('div', { class: 'meter' }, [el('i', { style: { height: '0%' } })]);
      mx.meters[t.id] = meter.firstChild;
      const db = el('div', { class: 'db' }, toDb(t.vol) + ' dB');
      strip.appendChild(el('div', { class: 'fader-wrap', 'data-help': 'Track volume fader' }, [
        el('input', { type: 'range', class: 'fader', min: 0, max: 1, step: 0.005, value: t.vol,
          oninput: e => { t.vol = +e.target.value; db.textContent = toDb(t.vol) + ' dB'; SDAW.audio.updateTrack(t); },
          onchange: () => s.mutate('Volume', () => {}) }),
        meter
      ]));
      strip.appendChild(db);
      strip.appendChild(el('div', { class: 'ms' }, [
        el('button', { class: 'ms-btn m' + (t.mute ? ' on' : ''), onclick: () => s.mutate('Mute', () => { t.mute = !t.mute; }) }, 'M'),
        el('button', { class: 'ms-btn s' + (t.solo ? ' on' : ''), onclick: () => s.mutate('Solo', () => { t.solo = !t.solo; }) }, 'S')
      ]));
      SDAW.makeDropTarget(strip, 'effect preset', p => p.kind === 'effect' ? SDAW.applyEffect(t, p.effect, true) : SDAW.applyPreset(t, p.preset));
      wrap.appendChild(strip);
    });
    // master
    const mm = el('div', { class: 'meter', style: { width: '16px' } }, [el('i', { style: { height: '0%' } })]);
    mx.meters.master = mm.firstChild;
    mx.loud = el('div', { class: 'loud' }, '-∞');
    wrap.appendChild(el('div', { class: 'strip master' }, [
      el('div', { class: 'strip-head', style: { background: '#ffd23f' } }, 'MASTER'),
      el('div', { class: 'db', 'data-help': 'Master output level (RMS, dBFS). A loudness (LUFS) meter comes with the native engine.' }, 'Level (RMS)'),
      mx.loud,
      el('div', { class: 'db' }, 'Limiter ON'),
      el('div', { class: 'fader-wrap', 'data-help': 'Master volume' }, [
        el('input', { type: 'range', class: 'fader', min: 0, max: 1, step: 0.005, value: CONFIG.audio.masterVolume,
          oninput: e => { CONFIG.audio.masterVolume = +e.target.value; if (SDAW.audio.master) SDAW.audio.master.gain.value = CONFIG.audio.masterVolume; if (SDAW.desktop && SDAW.desktop.masterChanged) SDAW.desktop.masterChanged(); } }),
        mm
      ])
    ]));
    view.appendChild(wrap);
  };

  /** Animate meters (called every frame while the mixer is visible) */
  mx.updateMeters = function () {
    Object.keys(mx.meters).forEach(id => {
      const lv = SDAW.audio.getLevel(id);
      mx.meters[id].style.height = Math.round(lv * 100) + '%';
      if (id === 'master' && mx.loud) {
        const db = lv > 0.001 ? (20 * Math.log10(lv / 3)).toFixed(1) : '-∞';
        mx.loud.textContent = db + ' dB';
      }
    });
  };

  mx.tools = function (box) {
    box.appendChild(el('span', { class: 'chip-btn' }, 'Drop effects or presets on a strip'));
  };

})(window.SDAW);
