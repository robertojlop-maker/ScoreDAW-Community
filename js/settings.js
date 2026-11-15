/* =============================================================================
 *  SETTINGS.JS — Settings window (File → Settings…, Ctrl+, or the ⚙ button)
 *  -----------------------------------------------------------------------------
 *  Tabs:
 *    Audio     output device, input device (+ level test), latency mode,
 *              master / metronome volume, engine info
 *    MIDI      MIDI inputs (enable / disable), outputs, activity monitor
 *    Folders   library folders: sounds (samples of any program) and plugins
 *              (VST3 / CLAP) — add, reconnect, remove. Nothing is copied.
 *    General   interface size, start mode, welcome screen, panel layout
 *  Saved in localStorage 'scoredaw.settings'.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;

  const ST = {
    data: Object.assign({ outputId: '', inputId: '', latency: 'interactive', midiOff: [], masterVolume: CONFIG.audio.masterVolume, metronomeVolume: CONFIG.audio.metronomeVolume },
      JSON.parse(localStorage.getItem('scoredaw.settings') || '{}')),
    tab: 'audio'
  };
  SDAW.settings = ST;
  const save = () => localStorage.setItem('scoredaw.settings', JSON.stringify(ST.data));
  ST.save = save;                                       // the Recording Studio keeps the chosen input in step

  /** Apply saved settings at start-up and after changes */
  ST.apply = async function () {
    CONFIG.audio.masterVolume = ST.data.masterVolume;
    CONFIG.audio.metronomeVolume = ST.data.metronomeVolume;
    CONFIG.audio.latency = ST.data.latency;
    const A = SDAW.audio;
    if (A.ctx) {
      if (A.master) A.master.gain.value = ST.data.masterVolume;
      if (SDAW.desktop && SDAW.desktop.masterChanged) SDAW.desktop.masterChanged();
      if (ST.data.outputId && A.ctx.setSinkId) { try { await A.ctx.setSinkId(ST.data.outputId === 'default' ? '' : ST.data.outputId); } catch (e) { /* device gone */ } }
    }
  };
  ST.midiEnabled = (id) => !ST.data.midiOff.includes(id);

  /* ---------------------------------------------------------- window --- */
  ST.open = function (tab) {
    if (tab) ST.tab = tab;
    SDAW.audio.init();
    const close = () => back.remove();
    const body = el('div', { class: 'st-body' });
    const tabs = el('div', { class: 'st-tabs' }, [['audio', '🔊 Audio'], ['midi', '🎹 MIDI'], ['folders', '📁 Library folders'], ['general', '⚙ General']].map(([id, label]) =>
      el('button', { class: 'st-tab' + (ST.tab === id ? ' active' : ''), onclick: () => { ST.tab = id; render(); } }, label)));
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal st-modal' }, [
        el('button', { class: 'close', onclick: close }, '✕'),
        el('h2', { style: { margin: '0 0 12px' } }, 'Settings'),
        tabs, body
      ])
    ]);
    $('#modalRoot').appendChild(back);
    function render() {
      [...tabs.children].forEach((b, i) => b.classList.toggle('active', ['audio', 'midi', 'folders', 'general'][i] === ST.tab));
      body.innerHTML = '';
      ({ audio: audioTab, midi: midiTab, folders: foldersTab, general: generalTab })[ST.tab](body, render);
    }
    render();
  };

  const row = (label, ctrl, help) => el('div', { class: 'st-row', 'data-help': help || '' }, [el('label', {}, label), ctrl]);
  const note = (txt) => el('div', { class: 'st-note' }, txt);

  /* ------------------------------------------------------------ AUDIO --- */
  async function audioTab(box, rerender) {
    const A = SDAW.audio;
    let devices = [];
    try { devices = await navigator.mediaDevices.enumerateDevices(); } catch (e) { /* not allowed */ }
    const outs = devices.filter(d => d.kind === 'audiooutput'), ins = devices.filter(d => d.kind === 'audioinput');
    const noLabels = devices.length && devices.every(d => !d.label);
    const sel = (list, value, onchange, emptyLabel) => el('select', { onchange },
      [el('option', { value: '' }, emptyLabel)].concat(list.map((d, i) => el('option', { value: d.deviceId, selected: d.deviceId === value ? true : null }, d.label || ('Device ' + (i + 1))))));

    box.appendChild(el('h3', {}, 'Audio devices'));
    if (noLabels) box.appendChild(el('div', { class: 'st-row' }, [el('span', { class: 'st-note' }, 'The browser hides the device names until you allow access once.'),
      el('button', { class: 'btn small', onclick: async () => { try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); } catch (e) { SDAW.toast('Access not allowed'); } rerender(); } }, 'Show device names')]));
    const canSink = !!(A.ctx && A.ctx.setSinkId);
    box.appendChild(row('Output (speakers / interface)', sel(outs, ST.data.outputId, async e => { ST.data.outputId = e.target.value; save(); await ST.apply(); SDAW.toast('Output: ' + (e.target.selectedOptions[0].text)); }, 'System default'),
      'Where the sound goes. Choose your audio interface or headphones.'));
    if (!canSink) box.appendChild(note('This browser cannot choose the output device (use Chrome or Edge 110+). The system default is used.'));
    // Windows version: the plugins (VST3 / CLAP) play through the native engine, on the Windows default device
    if (SDAW.desktop && SDAW.desktop.on && ST.data.outputId && ST.data.outputId !== 'default')
      box.appendChild(note('⚠ Plugins (VST3 / CLAP) play through the plugin engine on the Windows default output device, not on the device chosen here. Built-in instruments play on the chosen device. Exports (WAV) contain both. To hear everything on one device, make it the Windows default or choose "System default" here.'));
    else if (SDAW.desktop && SDAW.desktop.on) box.appendChild(note('Plugins (VST3 / CLAP) play through the plugin engine on the Windows default output device; the master volume acts on them too.'));
    box.appendChild(row('Input (microphone / guitar)', sel(ins, ST.data.inputId, e => { ST.data.inputId = e.target.value; save(); }, 'System default'),
      'Input for recording audio (guitar through an interface, microphone).'));
    const meter = el('div', { class: 'st-meter' }, [el('i')]);
    box.appendChild(row('Input level test', el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flex: 1 } }, [
      el('button', { class: 'btn small', onclick: () => testInput(meter) }, '▶ Test 6 s'), meter])));
    box.appendChild(note('Recording audio from the input onto a track is the next step of the engine; the device chosen here will be used.'));

    box.appendChild(el('h3', {}, 'Engine'));
    box.appendChild(row('Recording offset (ms)', el('input', { type: 'number', min: -500, max: 500, step: 1, value: ST.data.recOffsetMs || 0, style: { width: '80px' },
      onchange: e => { ST.data.recOffsetMs = SDAW.clamp(+e.target.value || 0, -500, 500); save(); } }),
      'Audio takes are moved earlier by the latency the browser reports. If your recordings still land late (or early), add (or subtract) milliseconds here.'));
    box.appendChild(row('Latency mode', el('select', { onchange: e => { ST.data.latency = e.target.value; save(); SDAW.toast('Latency mode changes after reloading the program (F5)'); } },
      [['interactive', 'Low latency (live playing)'], ['balanced', 'Balanced'], ['playback', 'Safe (big projects, no clicks)']].map(([v, l]) => el('option', { value: v, selected: ST.data.latency === v ? true : null }, l))),
      'Low latency = notes respond faster when you play; Safe = fewer clicks on slow computers.'));
    const info = A.ctx ? 'Sample rate ' + A.ctx.sampleRate + ' Hz · base latency ' + Math.round((A.ctx.baseLatency || 0) * 1000) + ' ms' + (A.ctx.outputLatency ? ' · output latency ' + Math.round(A.ctx.outputLatency * 1000) + ' ms' : '') : '—';
    box.appendChild(row('Audio engine', el('span', { class: 'st-val' }, info)));
    const vol = (key, label) => {
      const v = el('span', { class: 'st-val' }, Math.round(ST.data[key] * 100) + '%');
      return row(label, el('div', { style: { display: 'flex', gap: '8px', flex: 1, alignItems: 'center' } }, [
        el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: ST.data[key], style: { flex: 1 }, oninput: e => { ST.data[key] = +e.target.value; v.textContent = Math.round(ST.data[key] * 100) + '%'; ST.apply(); }, onchange: save }), v]));
    };
    box.appendChild(vol('masterVolume', 'Master volume'));
    box.appendChild(vol('metronomeVolume', 'Metronome volume'));
  }

  async function testInput(meter) {
    try {
      const A = SDAW.audio;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: ST.data.inputId ? { deviceId: { exact: ST.data.inputId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } : true });
      const src = A.ctx.createMediaStreamSource(stream), an = A.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(1024), t0 = performance.now();
      const loop = () => {
        an.getFloatTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x));
        meter.firstChild.style.width = Math.min(100, m * 120) + '%';
        meter.firstChild.style.background = m > 0.9 ? '#ff3b5c' : '';
        if (performance.now() - t0 < 6000 && document.body.contains(meter)) requestAnimationFrame(loop); else { stream.getTracks().forEach(t => t.stop()); meter.firstChild.style.width = '0%'; }
      };
      loop();
    } catch (e) { SDAW.toast('Cannot open the input: ' + e.message); }
  }

  /* ------------------------------------------------------------- MIDI --- */
  async function midiTab(box, rerender) {
    box.appendChild(el('h3', {}, 'MIDI devices'));
    if (!navigator.requestMIDIAccess) { box.appendChild(note('This browser has no Web MIDI. Use Chrome or Edge.')); return; }
    let acc;
    try { acc = await navigator.requestMIDIAccess(); } catch (e) { box.appendChild(note('MIDI access was not allowed.')); return; }
    const ins = [...acc.inputs.values()], outs = [...acc.outputs.values()];
    box.appendChild(el('div', { class: 'st-sub' }, 'Inputs (keyboards, MIDI guitars, controllers)'));
    if (!ins.length) box.appendChild(note('No MIDI input found. Connect a keyboard and reopen this window.'));
    ins.forEach(i => {
      const led = el('span', { class: 'st-led' });
      i.addEventListener('midimessage', () => { led.classList.add('on'); clearTimeout(led._t); led._t = setTimeout(() => led.classList.remove('on'), 120); });
      box.appendChild(el('div', { class: 'st-dev' }, [
        el('input', { type: 'checkbox', checked: ST.midiEnabled(i.id) ? true : null, onchange: e => { ST.data.midiOff = ST.data.midiOff.filter(x => x !== i.id); if (!e.target.checked) ST.data.midiOff.push(i.id); save(); } }),
        led, el('b', {}, i.name), el('small', {}, (i.manufacturer || '') + ' · ' + i.state)
      ]));
    });
    box.appendChild(note('Notes from enabled inputs play the selected track and are written at the cursor when "Write" is on (or recorded while Rec + Play).'));
    box.appendChild(el('div', { class: 'st-sub' }, 'Outputs (external synths / sound modules)'));
    if (!outs.length) box.appendChild(note('No MIDI output found.'));
    outs.forEach(o => box.appendChild(el('div', { class: 'st-dev' }, [el('span', { class: 'st-led' }), el('b', {}, o.name), el('small', {}, (o.manufacturer || '') + ' · ' + o.state)])));
    if (outs.length) box.appendChild(note('To send a track to an output: select the track → Inspector → "MIDI Out" (port, channel, and whether the built-in sound plays too).'));
  }

  /* ---------------------------------------------------------- FOLDERS --- */
  function foldersTab(box, rerender) {
    const S = SDAW.samples;
    box.appendChild(el('h3', {}, 'Library folders'));
    box.appendChild(note('Point to the folders where other programs keep their sounds and plugins. They appear in Library → Folders without copying anything. Example: C:\\Program Files\\Common Files\\VST3, your Ableton / FL Studio / Kontakt sample folders.'));
    box.appendChild(el('div', { class: 'st-row' }, [
      el('button', { class: 'btn primary', onclick: async () => { await S.connectFolder('sounds'); rerender(); } }, '＋ Add sound folder (samples, loops, multisamples)'),
      el('button', { class: 'btn', onclick: async () => { await S.connectFolder('plugins'); rerender(); } }, '＋ Add plugin folder (VST3 / CLAP)')
    ]));
    if (!S.roots.length) box.appendChild(note('No folders yet.'));
    const tbl = el('table', { class: 'st-table' }, [el('tr', {}, ['Folder', 'Type', 'Contents', 'State', ''].map(h => el('th', {}, h)))]);
    S.roots.forEach(r => tbl.appendChild(el('tr', {}, [
      el('td', {}, (r.kind === 'plugins' ? '🔌 ' : '📁 ') + r.name),
      el('td', {}, r.kind === 'plugins' ? 'Plugins' : 'Sounds'),
      el('td', {}, r.count + ' sounds' + (r.plugins ? ' · ' + r.plugins + ' plugins' : '')),
      el('td', {}, r.scanning ? 'scanning…' : r.granted ? '✔ connected' : el('button', { class: 'chip-btn on', onclick: async () => { await S.reconnect(r); rerender(); } }, 'Reconnect')),
      el('td', {}, el('button', { class: 'chip-btn', onclick: async () => { await S.removeRoot(r); rerender(); } }, 'Remove'))
    ])));
    if (S.roots.length) box.appendChild(tbl);
    box.appendChild(note('Real sounds included with the program (Library → Sounds): ' + (SDAW.factory.hasSounds() ? SDAW.factory.index.sounds.filter(x => !x.zoneOnly).length + ' sounds, ' + SDAW.factory.index.instruments.length + ' instruments, ' + SDAW.factory.index.kits.length + ' kits.' : 'not built — run "Build Sound Packs.cmd".')));
    box.appendChild(note('VST3 / CLAP plugins are found and listed; loading them inside the program needs the desktop audio engine (next phase).'));
  }

  /* ---------------------------------------------------------- GENERAL --- */
  function generalTab(box) {
    box.appendChild(el('h3', {}, 'Interface'));
    box.appendChild(row('Interface size', el('div', { style: { display: 'flex', gap: '6px' } }, [
      el('button', { class: 'btn small', onclick: () => SDAW.app.changeScale(-1) }, '−'),
      el('button', { class: 'btn small', onclick: () => SDAW.app.changeScale(0) }, 'Auto'),
      el('button', { class: 'btn small', onclick: () => SDAW.app.changeScale(1) }, '+')])));
    box.appendChild(row('Mode', el('div', { style: { display: 'flex', gap: '6px' } }, [
      el('button', { class: 'btn small', onclick: () => SDAW.app.setMode('simple') }, 'Simple'),
      el('button', { class: 'btn small', onclick: () => SDAW.app.setMode('pro') }, 'Pro')])));
    box.appendChild(row('Welcome screen at start', el('input', { type: 'checkbox', checked: localStorage.getItem('scoredaw.noWelcome') ? null : true, onchange: e => e.target.checked ? localStorage.removeItem('scoredaw.noWelcome') : localStorage.setItem('scoredaw.noWelcome', '1') })));
    box.appendChild(row('Panels', el('button', { class: 'btn small', onclick: () => SDAW.layout.reset() }, 'Reset panel layout')));
    box.appendChild(row('Preview notes when clicking', el('input', { type: 'checkbox', checked: CONFIG.audio.previewOnClick ? true : null, onchange: e => { CONFIG.audio.previewOnClick = e.target.checked; } })));
  }

})(window.SDAW);
