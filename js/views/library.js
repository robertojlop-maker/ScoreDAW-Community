/* =============================================================================
 *  LIBRARY.JS — left panel
 *  -----------------------------------------------------------------------------
 *  Tabs:
 *    Instruments  built-in preview instruments (replace the sound of a track)
 *    Samples      YOUR sound libraries (connected folders) + samples of the song
 *    Patterns     the patterns of this song: drag them onto the Arrange
 *    Rhythms      drum grooves by style
 *    Chords       chord progressions by style (keys + bass + guitar strum)
 *    Presets      effect chains
 *    Effects      single effects
 *  - Click = preview · double-click = use · drag & drop = place / apply.
 *  Drag payload kinds: instrument, sample, pattern, rhythm, progression, preset, effect
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $, el } = SDAW;
  const BAR = () => SDAW.barTicks();          // bar length of the song (time signature)

  const TABS = [
    { id: 'sounds', ico: '🎧', label: 'Sounds' },
    { id: 'generators', ico: '🎛️', label: 'Generators' },
    { id: 'instruments', ico: '🎸', label: 'Synths' },
    { id: 'samples', ico: '📁', label: 'Folders' },
    { id: 'patterns', ico: '▦', label: 'Patterns' },
    { id: 'rhythms', ico: '🥁', label: 'Rhythms' },
    { id: 'progressions', ico: '🎼', label: 'Chords' },
    { id: 'presets', ico: '🎛️', label: 'Presets' },
    { id: 'effects', ico: '✨', label: 'Effects' },
    { id: 'plugins', ico: '🔌', label: 'Plugins', desktop: true }     // Windows version only (VST3 / CLAP)
  ];

  const lib = {
    tab: 'sounds', filter: '', favOnly: false,
    favs: new Set(JSON.parse(localStorage.getItem('scoredaw.favs') || '[]')),
    closed: new Set(), open: new Set(), activeName: null
  };
  SDAW.library = lib;

  /* ========================================================== DRAG ==== */
  SDAW.drag = { payload: null };
  SDAW.startDrag = function (e, payload) {
    SDAW.drag.payload = payload;
    e.dataTransfer.setData('application/x-lss', JSON.stringify({ kind: payload.kind }));
    e.dataTransfer.effectAllowed = 'copy';
    document.body.classList.add('dragging');
  };
  document.addEventListener('dragend', () => {
    SDAW.drag.payload = null;
    document.body.classList.remove('dragging');
    SDAW.$$('.drop-target.over').forEach(n => n.classList.remove('over'));
  });
  /* files dragged from Windows Explorer */
  document.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) document.body.classList.add('dragging'); });
  document.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dragging'); });
  document.addEventListener('dragover', e => e.preventDefault());

  const isFileDrag = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

  /**
   * Make an element a drop target.
   *   accept: 'instrument sample pattern … file'   ('file' = audio files from Windows)
   *   onDrop(payload, event)  — for files payload = { kind:'file', files:[File] }
   */
  SDAW.makeDropTarget = function (node, accept, onDrop) {
    node.classList.add('drop-target');
    const kinds = accept.split(' ');
    const ok = (e) => (SDAW.drag.payload && kinds.includes(SDAW.drag.payload.kind)) || (kinds.includes('file') && isFileDrag(e));
    node.addEventListener('dragover', e => { if (ok(e)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; node.classList.add('over'); } });
    node.addEventListener('dragleave', () => node.classList.remove('over'));
    node.addEventListener('drop', e => {
      if (!ok(e)) return;
      e.preventDefault(); e.stopPropagation();
      node.classList.remove('over');
      const p = SDAW.drag.payload || { kind: 'file', files: Array.from(e.dataTransfer.files || []).filter(f => /\.(wav|wave|aif|aiff|aifc|ogg|mp3|flac|m4a)$/i.test(f.name)) };
      document.dispatchEvent(new Event('dragend'));
      if (p.kind === 'file' && !p.files.length) return SDAW.toast('Only audio files (WAV, AIFF, OGG, MP3, FLAC) can be dropped');
      onDrop(p, e);
    });
  };

  /* ======================================================== RENDER ==== */
  lib.render = function () {
    const tabs = $('#libTabs');
    tabs.innerHTML = '';
    TABS.filter(t => !t.desktop || (SDAW.desktop && SDAW.desktop.on)).forEach(t => tabs.appendChild(el('div', {
      class: 'lib-tab' + (lib.tab === t.id ? ' active' : ''), 'data-help': 'Library: ' + t.label,
      onclick: () => { lib.tab = t.id; lib.render(); }
    }, [el('span', { class: 'ico' }, t.ico), t.label])));

    const list = $('#libList');
    const keep = list.scrollTop;
    list.innerHTML = '';
    const q = lib.filter.toLowerCase();
    const match = (s) => !q || s.toLowerCase().includes(q);
    const favOk = (key) => !lib.favOnly || lib.favs.has(key);

    if (lib.tab === 'instruments') {
      CONFIG.library.instruments.forEach(g => {
        const items = g.items.filter(it => (match(it.name) || match(g.group)) && favOk('inst:' + it.name));
        if (!items.length) return;
        list.appendChild(group(g.group, g.icon, items.map(it => item({
          key: 'inst:' + it.name, name: it.name, source: 'Built-in',
          help: it.name + ' (preview engine) — click to hear, double-click to use on the selected track, drag to a track or the empty area. For real recorded sounds use the Samples tab.',
          payload: Object.assign({ kind: 'instrument' }, it),
          preview: () => SDAW.audio.previewInstrument(it), apply: () => SDAW.applyInstrument(it)
        }))));
      });
    }

    if (lib.tab === 'samples') renderSamples(list, q);
    if (lib.tab === 'plugins' && SDAW.desktop && SDAW.desktop.on) SDAW.desktop.renderLibrary(list, q, { group, item });
    if (lib.tab === 'generators') {
      list.appendChild(el('div', { class: 'lib-hint small' }, 'Generators make the sound of a channel. Drag one onto the Pattern panel (Channel Rack) or onto empty space in the Song = NEW channel · onto a channel / track = REPLACE its sound · double-click = use on the selected track · edit its knobs with 🎛 / F8.'));
      SDAW.GENERATORS.forEach(g => {
        const items = g.items.filter(it => match(it.name) || match(g.group));
        if (!items.length) return;
        list.appendChild(group(g.group, g.icon, items.map(it => item({
          key: 'gen:' + it.name, name: it.name, source: 'GEN',
          help: it.name + (it.desc ? ' — ' + it.desc : '') + ' Click = hear · double-click = use on the selected track · drag onto the Pattern panel or the Song = new channel, onto a channel = replace its sound.',
          payload: Object.assign({ kind: 'instrument' }, it),
          preview: () => SDAW.audio.previewInstrument(it),
          apply: () => { SDAW.applyInstrument(it); SDAW.app.showView('instrument'); }
        }))));
      });
    }
    if (lib.tab === 'sounds') renderFactory(list, q, favOk);

    if (lib.tab === 'patterns') {
      const song = SDAW.store.song;
      list.appendChild(el('div', { class: 'pat-new' }, [
        el('button', { class: 'btn primary', 'data-help': 'Create a new empty notes pattern (melody, chords, riff) and name it', onclick: () => SDAW.patternActions.create('notes') }, '＋ New notes pattern'),
        el('button', { class: 'btn cyan', 'data-help': 'Create a new empty drum pattern (beat) and name it', onclick: () => SDAW.patternActions.create('drums') }, '＋ New drum pattern')
      ]));
      list.appendChild(el('div', { class: 'lib-hint small' }, 'Click = edit · drag to a track = add a block · double-click the name = rename'));
      const pats = song.patterns.filter(p => match(p.name));
      if (pats.some(p => p.kind === 'drums')) list.appendChild(group('Drum patterns (' + pats.filter(p => p.kind === 'drums').length + ')', '🥁', pats.filter(p => p.kind === 'drums').map(patternRow)));
      if (pats.some(p => p.kind === 'notes')) list.appendChild(group('Note patterns (' + pats.filter(p => p.kind === 'notes').length + ')', '🎼', pats.filter(p => p.kind === 'notes').map(patternRow)));
      if (!pats.length) list.appendChild(el('div', { class: 'lib-hint' }, 'No patterns yet. Create one with the buttons above.'));
    }

    if (lib.tab === 'rhythms') {
      const genres = CONFIG.library.genres.filter(g => match(g) && favOk('rhy:' + g));
      list.appendChild(group('Drum Grooves', '🥁', genres.map(g => item({
        key: 'rhy:' + g, name: g + ' Groove', source: 'Style',
        help: g + ' groove — click to hear, double-click to create it as a pattern, drag it onto a drum track in the Arrange (where you drop it) or onto the Pattern editor.',
        payload: { kind: 'rhythm', genre: g },
        preview: () => SDAW.audio.previewRhythm(g), apply: () => SDAW.createGroove(g)
      }))));
    }

    if (lib.tab === 'progressions') {
      const genres = CONFIG.library.genres.filter(g => match(g) && favOk('prog:' + g));
      list.appendChild(group('Progressions by Style', '🎼', genres.map(g => {
        const p = SDAW.PROGRESSIONS[g];
        const names = p.degrees.slice(0, 4).map(d => SDAW.romanFor(p.mode, d)).join(' – ');
        return item({
          key: 'prog:' + g, name: g + '  ·  ' + names, source: 'Style',
          help: g + ' progression (' + names + ') with keys, bass and guitar strum patterns. Double-click = insert at the cursor bar, or drag it to the Arrange / Score.',
          payload: { kind: 'progression', genre: g },
          preview: () => SDAW.audio.previewProgression(g), apply: () => SDAW.insertProgressionAtCursor(g)
        });
      })));
    }

    if (lib.tab === 'presets') {
      const ps = CONFIG.library.presets.filter(p => match(p.name) && favOk('pre:' + p.name));
      list.appendChild(group('Guitar / Track FX Chains', '🎛️', ps.map(p => item({
        key: 'pre:' + p.name, name: p.name, source: 'FX',
        help: 'Effect chain: ' + p.fx.map(f => { const k = SDAW.fxKey(f); const m = p.models && p.models[k] ? SDAW.pedalModel(k, p.models[k]).short : ''; return f + (m ? ' (' + m + ')' : ''); }).join(' → ') + '. Double-click = selected track, or drag onto a track / mixer strip.',
        payload: { kind: 'preset', preset: p }, apply: () => SDAW.applyPreset(SDAW.store.selTrack(), p)
      }))));
    }

    if (lib.tab === 'effects') {
      const fx = CONFIG.library.effects.filter(f => match(f) && favOk('fx:' + f));
      list.appendChild(group('Effects', '✨', fx.map(f => item({
        key: 'fx:' + f, name: f, source: 'FX',
        help: f + ' — double-click to switch it on for the selected track, or drag to a mixer strip / the pedalboard.',
        payload: { kind: 'effect', effect: f }, apply: () => SDAW.applyEffect(SDAW.store.selTrack(), f, true)
      }))));
    }

    if (!list.children.length) list.appendChild(el('div', { class: 'empty-msg' }, 'Nothing found.'));
    list.scrollTop = keep;
    renderFooter();
  };

  /* ------------------------------------------------- Samples tab ---- */
  function renderSamples(list, q) {
    const S = SDAW.samples;
    list.appendChild(el('div', { class: 'lib-actions' }, [
      el('button', { class: 'btn primary small', 'data-help': 'Choose a folder with sounds (samples, loops, one-shots, multisamples) of any program. The files are read where they are; nothing is copied.', onclick: () => S.connectFolder('sounds') }, '＋ Sound folder…'),
      el('button', { class: 'btn small', 'data-help': 'Choose a folder with VST3 / CLAP plugins (instruments and effects), e.g. C:\\Program Files\\Common Files\\VST3', onclick: () => S.connectFolder('plugins') }, '＋ Plugin folder…'),
      el('button', { class: 'btn small', 'data-help': 'Manage all library folders (Settings)', onclick: () => SDAW.settings.open('folders') }, '⚙'),
      el('button', { class: 'btn small', 'data-help': 'Stop the preview', onclick: () => S.stopPreview() }, '■')
    ]));
    // roots
    S.roots.forEach(r => {
      const row = el('div', { class: 'lib-root' }, [
        el('span', {}, (r.kind === 'plugins' ? '🔌 ' : '📁 ') + r.name),
        el('small', {}, r.scanning ? ' scanning… ' + r.count : (r.granted ? ' ' + r.count + ' sounds' : ' (needs permission)')),
        !r.granted ? el('button', { class: 'chip-btn on', onclick: () => S.reconnect(r) }, 'Reconnect') : null,
        el('button', { class: 'chip-btn', 'data-help': 'Remove this folder from the library (files are not deleted)', onclick: () => S.removeRoot(r) }, '✕')
      ]);
      list.appendChild(row);
    });
    if (!S.roots.length) list.appendChild(el('div', { class: 'lib-hint' }, [
      el('b', {}, 'Use your real sounds. '),
      'Connect the sample folders of LiveReplica (Ableton Core Library) and Lemon-Studio (FL Studio 20). You can also drag WAV / AIFF / OGG / MP3 files from Windows straight onto a track.'
    ]));

    // samples already in the song
    const song = SDAW.store.song;
    if ((song.samples || []).length) {
      list.appendChild(group('In this song', '🎵', song.samples.filter(s => !q || s.name.toLowerCase().includes(q)).map(sm => item({
        key: 'smp:' + sm.id, name: sm.name, source: sm.duration ? sm.duration.toFixed(1) + 's' : '',
        help: 'Sample of this song. Drag it to a track (audio block), to a drum pad, or double-click to place it at the cursor.',
        payload: { kind: 'sample', sampleId: sm.id, name: sm.name },
        preview: () => { const b = S.buffer(sm.id); if (b) S.playBuffer(b); },
        apply: () => SDAW.placeSampleAtCursor({ sampleId: sm.id })
      }))));
    }
    if (S.plugins.length) {
      list.appendChild(group('Plugins found (VST3 / CLAP) — ' + S.plugins.length, '🔌', S.plugins.filter(pl => !q || pl.name.toLowerCase().includes(q)).slice(0, 400).map(pl => item({
        key: 'plug:' + pl.path, name: pl.name, source: pl.format,
        help: pl.path + ' — VST3 / CLAP plugins are listed here; loading them needs the desktop audio engine (next phase of the project).',
        payload: { kind: 'plugin', path: pl.path, name: pl.name },
        preview: () => SDAW.toast('"' + pl.name + '" (' + pl.format + ') — plugins load in the desktop version of the engine'),
        apply: () => SDAW.toast('Plugins load in the desktop version of the engine')
      }))));
    }
    if (!S.files.length) return;

    if (q) {
      const res = S.search(q, 300);
      list.appendChild(group('Results (' + res.length + (res.length >= 300 ? '+' : '') + ')', '🔎', res.map(fileItem)));
      return;
    }
    // folder tree (lazy)
    const tree = el('div', { class: 'lib-tree' });
    const renderFolder = (path, depth, box) => {
      const { folders, files } = S.list(path);
      folders.forEach(name => {
        const fp = path ? path + '/' + name : name;
        const open = lib.open.has(fp);
        const kids = el('div', {});
        const head = el('div', {
          class: 'lib-folder', style: { paddingLeft: (6 + depth * 12) + 'px' },
          'data-help': 'Folder — click to open. Right-click: use it as an instrument (multisample) or as a drum kit.',
          onclick: () => { open ? lib.open.delete(fp) : lib.open.add(fp); lib.render(); },
          oncontextmenu: (e) => { e.preventDefault(); folderMenu(e, fp); }
        }, [el('span', { class: 'chev' }, open ? '▾' : '▸'), '📁 ', name]);
        box.appendChild(head); box.appendChild(kids);
        if (open) renderFolder(fp, depth + 1, kids);
      });
      files.slice(0, 500).forEach(f => { const n = fileItem(f); n.style.paddingLeft = (20 + depth * 12) + 'px'; box.appendChild(n); });
      if (files.length > 500) box.appendChild(el('div', { class: 'lib-hint' }, '… ' + (files.length - 500) + ' more — use the search box'));
    };
    renderFolder('', 0, tree);
    list.appendChild(tree);
  }

  /* ------------------------------------------- Sounds tab (factory) ---- */
  /**
   * Real sounds included with the program, by category.
   * Click = listen · double-click = use (drum sound -> its pad, instrument ->
   * selected track, kit -> drum track) · drag = drop on a pad, a track,
   * the score / piano roll or the Sound Slot.
   */
  function renderFactory(list, q, favOk) {
    const F = SDAW.factory;
    if (!F.hasSounds()) {
      list.appendChild(el('div', { class: 'lib-hint' }, [
        el('b', {}, 'The real sound packs are not built yet. '),
        'They are made from the LiveReplica and Lemon-Studio libraries with tools\\build_sound_packs.py (see README). Meanwhile use the Synths tab or connect folders in the Folders tab.'
      ]));
      return;
    }
    list.appendChild(el('div', { class: 'lib-hint small' }, 'Click = listen · double-click = use · drag onto a drum pad, a track, the score or the Sound Slot'));
    const match = (s) => !q || s.toLowerCase().includes(q);
    const openKey = (k) => q || lib.open.has(k);
    const catGroup = (key, label, ico, count, buildItems) => {
      const open = openKey(key);
      const g = el('div', { class: 'lib-group' + (open ? '' : ' closed') }, [
        el('div', { class: 'lib-group-head', onclick: () => { lib.open.has(key) ? lib.open.delete(key) : lib.open.add(key); lib.render(); } },
          [el('span', {}, ico), label, el('small', { class: 'cnt' }, String(count)), el('span', { class: 'chev' }, '▾')]),
        el('div', { class: 'lib-items' }, open ? buildItems() : [])
      ]);
      list.appendChild(g);
    };
    // kits
    const kits = F.index.kits.filter(k => match(k.name) && favOk('kit:' + k.id));
    if (kits.length) catGroup('fac:kits', 'Drum Kits', '🥁', kits.length, () => kits.map(k => item({
      key: 'kit:' + k.id, name: k.name, source: k.source,
      help: 'Drum kit "' + k.name + '" (' + Object.keys(k.pads).length + ' real sounds) — double-click or drag onto a drum track / the Pattern editor to load it on all pads.',
      payload: { kind: 'kit', kitId: k.id },
      preview: () => previewKit(k), apply: () => F.applyKit(k.id)
    })));
    // instruments
    const insts = F.index.instruments.filter(i => match(i.name) && favOk('finst:' + i.id));
    if (insts.length) catGroup('fac:insts', 'Instruments (real samples)', '🎹', insts.length, () => insts.map(i => item({
      key: 'finst:' + i.id, name: i.name, source: i.source,
      help: i.name + ' — ' + i.zones.length + ' real samples. Double-click = use on the selected track; drag onto a track, the score / piano roll or the Sound Slot.',
      payload: { kind: 'finst', instId: i.id, type: i.type },
      preview: () => previewInst(i), apply: () => F.applyInstrument(i.id)
    })));
    // drum / percussion categories
    F.CATS.forEach(c => {
      const sounds = F.index.sounds.filter(s => s.cat === c.id && !s.zoneOnly && match(s.name + ' ' + c.label) && favOk('fac:' + s.id));
      if (!sounds.length) return;
      catGroup('fac:' + c.id, c.label, c.ico, sounds.length, () => sounds.slice(0, q ? 200 : 2000).map(s => item({
        key: 'fac:' + s.id, name: s.name, source: s.source,
        help: s.name + ' (' + s.source + ') — click to hear · double-click = put it on the ' + (SDAW.DRUM_ROWS.find(r => r.id === F.padFor(s)) || {}).name + ' pad · drag onto any pad, a track or the score.',
        payload: { kind: 'sample', factoryId: s.id, name: s.name, cat: s.cat },
        preview: () => F.preview(s.id), apply: () => F.assignToPad(s.id)
      })));
    });
  }
  function previewKit(k) {
    const order = ['kick', 'hhc', 'snare', 'hhc', 'kick', 'kick', 'snare', 'hho'];
    SDAW.audio.init();
    Promise.all(Object.values(k.pads).map(id => SDAW.factory.load(id))).then(() => {
      const t0 = SDAW.audio.ctx.currentTime + 0.05;
      order.forEach((pad, i) => { const id = k.pads[pad]; if (!id) return; const b = SDAW.factory.buffers[id];
        const src = SDAW.audio.ctx.createBufferSource(); src.buffer = b; src.connect(SDAW.audio.master); src.start(t0 + i * 0.22); });
    }).catch(e => SDAW.toast(e.message));
  }
  function previewInst(i) {
    SDAW.audio.init();
    const zs = i.zones.slice().sort((a, b) => Math.abs(a.root - 60) - Math.abs(b.root - 60));
    const z = zs[0];
    SDAW.factory.load(z.id).then(b => {
      const t0 = SDAW.audio.ctx.currentTime + 0.05;
      [0, 4, 7, 12].forEach((iv, k) => { const src = SDAW.audio.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = Math.pow(2, (60 + iv - z.root) / 12);
        const g = SDAW.audio.ctx.createGain(); g.gain.setValueAtTime(0.8, t0 + k * 0.3); g.gain.exponentialRampToValueAtTime(0.001, t0 + k * 0.3 + 1.2);
        src.connect(g); g.connect(SDAW.audio.master); src.start(t0 + k * 0.3); src.stop(t0 + k * 0.3 + 1.3); });
    }).catch(e => SDAW.toast(e.message));
  }

  /** Open the Sounds tab on the category that fits a drum pad */
  lib.showPadSounds = function (padId) {
    const map = { kick: 'Kick', snare: 'Snare', hhc: 'HihatClosed', hho: 'HihatOpen', tom1: 'Tom', tom2: 'Tom', clap: 'Clap', perc: 'Bell', crash: 'Crash', ride: 'Ride' };
    lib.tab = 'sounds'; lib.filter = ''; SDAW.$('#libSearch').value = '';
    lib.open.add('fac:' + map[padId]);
    if (SDAW.layout && !SDAW.layout.state.libOpen) SDAW.layout.toggle('libOpen');
    lib.render();
    SDAW.toast('Click a sound to hear it, then drag it onto the pad (or double-click it)');
  };

  /* ------------------------------------------------ pattern rows ---- */
  /** One pattern in the Patterns tab, with visible Rename / Clone / Delete buttons */
  function patternRow(p) {
    const s = SDAW.store, uses = s.patternUses(p.id);
    const active = s.sel.patternId === p.id;
    const info = (p.kind === 'drums' ? 'Drums' : 'Notes') + ' · ' + (p.length / BAR()) + ' bar' + (p.length > BAR() ? 's' : '') + ' · used ' + uses + '×';
    const nameBox = el('div', { class: 'pr-name', 'data-help': 'Double-click to rename' }, [el('b', {}, p.name), el('small', {}, info)]);
    const row = el('div', {
      class: 'pat-row' + (active ? ' active' : ''), draggable: 'true', 'data-pid': p.id,
      'data-help': 'Pattern "' + p.name + '" — click to edit it, drag it onto a track to add a block. Right-click for more options.',
      onclick: () => SDAW.patternActions.open(p),
      ondragstart: (e) => SDAW.startDrag(e, { kind: 'pattern', patternId: p.id }),
      oncontextmenu: (e) => { e.preventDefault(); SDAW.patternActions.menu(e, p); }
    }, [
      el('span', { class: 'pat-dot big', style: { background: p.color || '#9b5cff', color: p.color || '#9b5cff' } }),
      nameBox,
      el('div', { class: 'pr-btns' }, [
        el('button', { class: 'pr-btn', 'data-help': 'Rename this pattern', onclick: (e) => { e.stopPropagation(); SDAW.patternActions.rename(p, nameBox); } }, '✎'),
        el('button', { class: 'pr-btn', 'data-help': 'Duplicate this pattern (a copy you can change separately)', onclick: (e) => { e.stopPropagation(); SDAW.patternActions.clone(p); } }, '⧉'),
        el('button', { class: 'pr-btn danger', 'data-help': 'Delete this pattern' + (uses ? ' and its ' + uses + ' block(s) in the song' : ''), onclick: (e) => { e.stopPropagation(); SDAW.patternActions.remove(p); } }, '🗑')
      ])
    ]);
    nameBox.addEventListener('dblclick', (e) => { e.stopPropagation(); SDAW.patternActions.rename(p, nameBox); });
    return row;
  }

  /**
   * Pattern commands used by the Library, the editor toolbar and the Arrange.
   *   create(kind) · open(p) · rename(p, inlineBox?) · clone(p) · remove(p) · menu(e, p)
   */
  SDAW.patternActions = {
    create(kind) {
      const s = SDAW.store;
      const n = s.song.patterns.filter(x => x.kind === kind).length + 1;
      const def = (kind === 'drums' ? 'Beat ' : 'Pattern ') + n;
      SDAW.ask('Name of the new ' + (kind === 'drums' ? 'drum' : 'notes') + ' pattern', def, name => {
        const p = s.newPattern(kind, name, BAR());
        lib.tab = 'patterns'; lib.render();
        SDAW.app.showView(kind === 'drums' ? 'pattern' : 'pianoroll');
        SDAW.toast('Pattern "' + name + '" created — drag it from the Library onto a track, or use "⇩ Place"');
        return p;
      });
    },
    open(p) {
      SDAW.store.selectPattern(p.id);
      SDAW.app.showView(p.kind === 'drums' ? 'pattern' : 'pianoroll');
    },
    rename(p, inlineBox) {
      const save = (v) => { v = (v || '').trim(); if (v && v !== p.name) SDAW.store.mutate('Rename pattern', () => { p.name = v; }); else lib.render(); };
      if (!inlineBox) return SDAW.ask('Rename pattern', p.name, save);
      // rename right in the list
      inlineBox.innerHTML = '';
      const input = el('input', { type: 'text', value: p.name, class: 'pr-input' });
      let done = false;
      const finish = (ok) => { if (done) return; done = true; ok ? save(input.value) : lib.render(); };
      input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
      input.addEventListener('blur', () => finish(true));
      input.addEventListener('click', e => e.stopPropagation());
      inlineBox.appendChild(input);
      input.focus(); input.select();
    },
    clone(p) {
      const s = SDAW.store; let c;
      s.mutate('Clone pattern', () => { c = s.clonePattern(p); });
      s.selectPattern(c.id);
      SDAW.toast('Copy created: "' + c.name + '"');
    },
    remove(p) {
      const s = SDAW.store, uses = s.patternUses(p.id);
      SDAW.confirm('Delete pattern', 'Delete the pattern "' + p.name + '"?' + (uses ? '\n\nIt is used in ' + uses + ' block(s) of the song — those blocks will be removed too.' : '\n\nIt is not used in the song.') + '\n\nYou can undo with Ctrl+Z.', 'Delete', () => {
        s.deletePattern(p.id);
        SDAW.toast('Pattern "' + p.name + '" deleted (Ctrl+Z to undo)');
      });
    },
    menu(e, p) {
      SDAW.contextMenu(e, [
        ['✎ Edit', () => SDAW.patternActions.open(p)],
        ['✎ Rename…', () => SDAW.patternActions.rename(p)],
        ['⧉ Duplicate', () => SDAW.patternActions.clone(p)],
        ['⇩ Place at the cursor', () => SDAW.placePatternAtCursor(p.id)],
        null,
        ['🗑 Delete…', () => SDAW.patternActions.remove(p)]
      ]);
    }
  };

  function fileItem(f) {
    return item({
      key: 'file:' + f.path, name: f.name.replace(/\.[^.]+$/, ''), source: f.name.split('.').pop().toUpperCase(),
      help: f.path + ' — click to hear. Drag to a track (audio block), to a drum pad in the Pattern editor, or onto the Sound Slot.',
      payload: { kind: 'sample', path: f.path, name: f.name },
      preview: () => SDAW.samples.previewPath(f.path),
      apply: () => SDAW.placeSampleAtCursor({ path: f.path })
    });
  }

  function folderMenu(e, fp) {
    SDAW.contextMenu(e, [
      ['🎹 Use folder as instrument on the selected track', () => SDAW.folderAsInstrument(fp)],
      ['🥁 Use folder as drum kit', () => SDAW.folderAsKit(fp)],
      ['📂 Open / close', () => { lib.open.has(fp) ? lib.open.delete(fp) : lib.open.add(fp); lib.render(); }]
    ]);
  }

  function group(name, icon, items) {
    const g = el('div', { class: 'lib-group' + (lib.closed.has(name) ? ' closed' : '') }, [
      el('div', { class: 'lib-group-head', onclick: () => { lib.closed.has(name) ? lib.closed.delete(name) : lib.closed.add(name); g.classList.toggle('closed'); } },
        [el('span', {}, icon), name, el('span', { class: 'chev' }, '▾')]),
      el('div', { class: 'lib-items' }, items)
    ]);
    return g;
  }

  function item(o) {
    const star = el('span', {
      class: 'star' + (lib.favs.has(o.key) ? ' on' : ''), 'data-help': 'Add to favorites',
      onclick: (e) => { e.stopPropagation(); lib.favs.has(o.key) ? lib.favs.delete(o.key) : lib.favs.add(o.key); localStorage.setItem('scoredaw.favs', JSON.stringify([...lib.favs])); star.classList.toggle('on'); }
    }, '★');
    const node = el('div', {
      class: 'lib-item' + ((o.active || lib.activeName === o.key) ? ' active' : ''), draggable: 'true', 'data-help': o.help,
      onclick: () => { lib.activeName = o.key; SDAW.$$('.lib-item.active').forEach(n => n.classList.remove('active')); node.classList.add('active'); if (o.preview) o.preview(); renderFooter(o); },
      ondblclick: () => o.apply && o.apply(),
      ondragstart: (e) => SDAW.startDrag(e, o.payload)
    }, [o.color ? el('span', { class: 'pat-dot', style: { background: o.color } }) : star, el('span', { class: 'nm' }, o.name), o.source ? el('span', { class: 'src ' + o.source.split(' ')[0] }, o.source) : null]);
    return node;
  }

  function renderFooter(o) {
    const f = $('#libFooter');
    f.innerHTML = '';
    if (o) {
      const k = o.payload.kind;
      f.appendChild(el('div', { class: 'lib-card' }, [
        el('div', { class: 'big-ico' }, k === 'instrument' ? (SDAW.TRACK_ICONS[o.payload.type] || '🎵') : k === 'sample' ? '🔊' : k === 'pattern' ? '▦' : k === 'rhythm' ? '🥁' : k === 'progression' ? '🎼' : '✨'),
        el('div', {}, [el('b', {}, o.name), el('div', {}, 'Double-click to use · drag to drop')])
      ]));
    } else f.textContent = 'Drag any item onto a track, pattern, mixer strip or the score. Neon outlines show where it can be dropped.';
  }

  /* ========================================================= ACTIONS ==== */

  /** Replace the sound of a track (notes stay) or create a new track */
  SDAW.applyInstrument = function (inst, trackId) {
    const s = SDAW.store;
    const t = trackId ? s.track(trackId) : s.selTrack();
    if (!t || (t.type === 'drums') !== (inst.type === 'drums')) { SDAW.addTrackFromInstrument(inst); return; }
    const isRig = e => SDAW.isRigEngine(e);
    const toRig = isRig(inst.engine) && t.engine !== inst.engine;
    s.mutate('Replace sound', () => {
      // switching between two rig instruments keeps your tweaks of each model (params.rigS / prigS)
      const rigS = inst.engine === 'rig' && t.params && t.params.rigS;
      const prigS = inst.engine === 'pianorig' && t.engine === 'pianorig' && t.params && t.params.prigS;
      const wrigS = inst.engine === 'windrig' && t.engine === 'windrig' && t.params && t.params.wrigS;
      t.engine = inst.engine; t.instrument = inst.name; t.source = inst.source; t.params = SDAW.deepCopy(inst.params || {});
      if (inst.engine === 'rig') t.params.rigS = rigS || (SDAW.guitarRig ? SDAW.guitarRig.seed(t.params.rig) : {});
      if (inst.engine === 'pianorig' && SDAW.pianoRig) {
        // a library item with its own starting sound (Wurlitzer, pad, bass…) sets it; otherwise keep your tweaks
        const own = SDAW.pianoRig.itemSound(inst);
        t.params.prigS = prigS || {};
        if (own || !t.params.prigS[t.params.prig]) t.params.prigS[t.params.prig] = SDAW.pianoRig.seed(t.params.prig, own)[t.params.prig];
      }
      if (inst.engine === 'windrig' && SDAW.windRig) {
        // Wind Rig: the library items are sounds (ballad, growl, harmon mute, section…), so picking
        // one gives exactly that sound; your tweaks of the other instrument are kept
        t.params.wrigS = wrigS || {};
        t.params.wrigS[t.params.wrig] = SDAW.windRig.seed(t.params.wrig, SDAW.windRig.itemSound(inst))[t.params.wrig];
      }
      t.sampler = inst.params && inst.params.sampler ? { zones: [] } : null;
      if (inst.type !== 'drums') { t.type = inst.type; t.color = CONFIG.colors[inst.type]; }
      else t.drumMap = {};
      // the Guitar Rig has its own amp, cabinet and effects: the pedalboard would colour it twice
      // a guitar / bass now plays these notes: every chord note on its own string
      if (t.type === 'guitar' || t.type === 'bass') SDAW.fixSongStrings({ patterns: s.song.patterns, tracks: [t] });
      if (toRig) { t.fx = SDAW.normalizePedals(t.fx); Object.keys(t.fx).forEach(k => { t.fx[k].on = false; }); t.sendRev = 0; }
    });
    SDAW.toast('Sound replaced: ' + inst.name + ' (notes kept)' + (toRig ? ' · pedalboard off — open ' + (inst.engine === 'rig' ? '🎸 Guitar Rig' : inst.engine === 'windrig' ? '🎷 Wind Rig' : '🎹 Piano Rig') + ' to shape the sound' : ''));
  };

  /** New track; a drum track gets a groove block over the whole song */
  SDAW.addTrackFromInstrument = function (inst) {
    const s = SDAW.store;
    const t = SDAW.makeTrack(inst);
    s.mutate('Add track', song => {
      song.tracks.push(t);
      if (inst.type === 'drums') { const p = SDAW.rhythmPattern('Pop'); song.patterns.push(p); s.placePattern(t, p, 0, song.bars * BAR()); }
    });
    s.selectTrack(t.id);
    SDAW.toast('New track: ' + inst.name);
    return t;
  };

  /** Create a groove pattern; place it where dropped, or across the song if the drum track is empty */
  SDAW.createGroove = function (genre, trackId, atTick) {
    const s = SDAW.store;
    let t = trackId ? s.track(trackId) : null;
    if (!t || t.type !== 'drums') t = s.song.tracks.find(x => x.type === 'drums');
    if (!t) t = SDAW.addTrackFromInstrument(SDAW.findInstrument(SDAW.isLatin(genre) ? 'Latin Percussion Kit' : 'Studio Kit'));
    const p = SDAW.rhythmPattern(genre);
    s.mutate('Groove ' + genre, song => {
      song.patterns.push(p);
      if (atTick !== undefined) {
        const start = Math.floor(atTick / BAR()) * BAR();
        const next = t.clips.filter(c => c.start > start).sort((a, b) => a.start - b.start)[0];
        s.placePattern(t, p, start, Math.min(4 * BAR(), next ? next.start - start : 4 * BAR()) || BAR());
      } else if (!t.clips.length) s.placePattern(t, p, 0, song.bars * BAR());
    });
    s.sel.trackId = t.id;
    s.selectPattern(p.id);
    SDAW.app.showView('pattern');
    SDAW.toast(genre + ' groove created' + (atTick === undefined && t.clips.length > 1 ? ' — drag it from the Patterns tab to place it' : ''));
  };

  /** Load a genre into the pattern currently shown in the Pattern editor */
  SDAW.loadGrooveInto = function (p, genre) {
    SDAW.store.mutate('Load groove', () => { SDAW.applyRhythm(p, genre); p.name = genre + ' Groove'; });
  };

  /** Progression: keys + bass (+ guitar strum if a guitar track is selected) blocks at a bar */
  SDAW.insertProgressionAtCursor = function (genre, bar) {
    const s = SDAW.store, song = s.song;
    const startBar = bar !== undefined ? bar : Math.floor(s.sel.cursor / BAR());
    s.mutate('Progression ' + genre, () => {
      const pp = SDAW.progressionPatterns(song, genre);
      let keys = song.tracks.find(t => t.type === 'keys');
      let bass = song.tracks.find(t => t.type === 'bass');
      if (!keys) { keys = SDAW.makeTrack(SDAW.findInstrument('Grand Piano'), 'Piano'); song.tracks.push(keys); }
      if (!bass) { bass = SDAW.makeTrack(SDAW.findInstrument('Electric Bass - Finger'), 'Bass'); song.tracks.push(bass); }
      const sel = s.selTrack();
      const guitar = sel && sel.type === 'guitar' ? sel : null;
      const start = startBar * BAR();
      song.patterns.push(pp.keys, pp.bass);
      s.placePattern(keys, pp.keys, start, pp.len);
      s.placePattern(bass, pp.bass, start, pp.len);
      if (guitar) { song.patterns.push(pp.guitar); s.placePattern(guitar, pp.guitar, start, pp.len); }
      SDAW.addChordSymbols(song, pp.chords, start, pp.len, pp.len);
    });
    SDAW.toast(genre + ' progression placed at bar ' + (startBar + 1));
  };

  /** Place a pattern as a block at the cursor of the selected (compatible) track */
  SDAW.placePatternAtCursor = function (pid, trackId, tick) {
    const s = SDAW.store, p = s.pattern(pid); if (!p) return;
    let t = trackId ? s.track(trackId) : s.selTrack();
    if (!t || (t.type === 'drums') !== (p.kind === 'drums')) t = s.song.tracks.find(x => (x.type === 'drums') === (p.kind === 'drums'));
    if (!t) return SDAW.toast('Add a ' + (p.kind === 'drums' ? 'drum' : 'melodic') + ' track first');
    const at = tick !== undefined ? tick : s.sel.cursor;
    const start = Math.floor(at / BAR()) * BAR();
    let clip;
    s.mutate('Place pattern', () => { clip = s.placePattern(t, p, start, p.length); });
    s.selectClip(t.id, clip.id);
  };

  /** Audio block from a sample (song sample id or library path) */
  SDAW.placeSampleAtCursor = async function (src, trackId, tick) {
    const s = SDAW.store;
    let t = trackId ? s.track(trackId) : s.selTrack();
    if (!t) return SDAW.toast('Select a track first');
    try {
      const id = await SDAW.resolveSample(src);
      const buf = SDAW.samples.buffer(id) || SDAW.samples.buffers[id];
      const at = tick !== undefined ? tick : s.sel.cursor;
      const start = Math.floor(at / 4) * 4;   // beat
      const len = Math.max(1, Math.round((buf ? buf.duration : 1) / SDAW.audio.tickDur()));
      let clip;
      s.mutate('Audio block', () => { SDAW.registerSample(id); clip = s.placeAudio(t, id, start, len); });
      s.selectClip(t.id, clip.id);
    } catch (e) { SDAW.toast('Could not load the sound: ' + e.message); }
  };

  /** Audio files dropped from Windows */
  SDAW.dropFiles = async function (files, trackId, tick) {
    let at = tick;
    for (const f of files) {
      try {
        const id = await SDAW.samples.importFile(f, f.name);
        const buf = SDAW.samples.buffers[id];
        await SDAW.placeSampleAtCursor({ sampleId: id }, trackId, at);
        at += Math.max(4, Math.ceil(buf.duration / SDAW.audio.tickDur() / 4) * 4);
      } catch (e) { SDAW.toast('Could not read ' + f.name + ': ' + e.message); }
    }
  };

  /** A sample becomes the sound of a melodic track (single-sample instrument) */
  SDAW.sampleAsInstrument = async function (src, trackId) {
    const s = SDAW.store, t = trackId ? s.track(trackId) : s.selTrack();
    if (!t || t.type === 'drums') return SDAW.toast('Select a melodic track');
    const id = await SDAW.resolveSample(src);
    const root = SDAW.samples.rootFromName(src.name || src.path || '') || 60;
    s.mutate('Sampler instrument', () => {
      SDAW.registerSample(id);
      t.sampler = { zones: [{ sampleId: id, root }] };
      t.instrument = (src.name || 'Sample').replace(/\.[^.]+$/, ''); t.source = 'Your library';
    });
    SDAW.toast('Track "' + t.name + '" now plays the sample (root ' + SDAW.midiToName(root) + ')');
  };

  SDAW.folderAsInstrument = async function (fp) {
    const s = SDAW.store, t = s.selTrack();
    if (!t || t.type === 'drums') return SDAW.toast('Select a melodic track (guitar, bass, keys…) first');
    SDAW.toast('Loading instrument samples…');
    try {
      const zones = await SDAW.samples.buildInstrumentFromFolder(fp, (i, n) => { if (i % 8 === 0) SDAW.toast('Loading samples ' + i + ' / ' + n); });
      s.mutate('Sampler instrument', () => {
        zones.forEach(z => SDAW.samples.addToSong(z.sampleId));
        t.sampler = { zones }; t.instrument = fp.split('/').pop(); t.source = 'Your library';
      });
      SDAW.toast('"' + fp.split('/').pop() + '": ' + zones.length + ' samples mapped on ' + t.name);
    } catch (e) { SDAW.toast(e.message); }
  };

  SDAW.folderAsKit = async function (fp) {
    const s = SDAW.store;
    let t = s.selTrack();
    if (!t || t.type !== 'drums') t = s.song.tracks.find(x => x.type === 'drums');
    if (!t) return SDAW.toast('Add a drum track first');
    try {
      const map = await SDAW.samples.buildKitFromFolder(fp);
      const n = Object.keys(map).length;
      if (!n) return SDAW.toast('No kick / snare / hat… names found in this folder');
      s.mutate('Drum kit', () => { Object.keys(map).forEach(r => SDAW.samples.addToSong(map[r])); Object.assign(t.drumMap, map); t.instrument = fp.split('/').pop(); t.source = 'Your library'; });
      SDAW.toast(n + ' drum pads loaded from "' + fp.split('/').pop() + '"');
    } catch (e) { SDAW.toast(e.message); }
  };

  SDAW.applyPreset = function (t, preset) {
    if (!t) return SDAW.toast('Select a track first');
    SDAW.store.mutate('Preset ' + preset.name, () => {
      t.fx = SDAW.normalizePedals(t.fx);
      Object.keys(t.fx).forEach(k => { t.fx[k].on = false; });
      preset.fx.forEach(name => { const k = SDAW.fxKey(name); if (k) t.fx[k].on = true; });
      Object.keys(preset.models || {}).forEach(k => { if (t.fx[k]) t.fx[k].model = preset.models[k]; });
    });
    SDAW.toast('Preset "' + preset.name + '" applied to ' + t.name);
  };
  SDAW.fxKey = (name) => ({ Compressor: 'comp', Overdrive: 'drive', Distortion: 'dist', Amp: 'amp', EQ: 'eq', Chorus: 'chorus', Delay: 'delay', Reverb: 'reverb' }[name]);
  SDAW.applyEffect = function (t, name, on) {
    if (!t) return SDAW.toast('Select a track first');
    const k = SDAW.fxKey(name); if (!k) return;
    SDAW.store.mutate('Effect ' + name, () => { t.fx[k].on = on === undefined ? !t.fx[k].on : on; });
    SDAW.toast(name + (t.fx[k].on ? ' ON' : ' OFF') + ' — ' + t.name);
  };

  /* =========================================================== INIT ==== */
  lib.init = function () {
    $('#libSearch').addEventListener('input', e => { lib.filter = e.target.value; lib.render(); });
    $('#libFavToggle').addEventListener('click', e => { lib.favOnly = !lib.favOnly; e.currentTarget.classList.toggle('on', lib.favOnly); lib.render(); });
    SDAW.bus.on('libraryIndex', SDAW.debounce(() => { if (lib.tab === 'samples') lib.render(); }, 250));
    SDAW.bus.on('factoryIndex', () => { if (lib.tab === 'sounds') lib.render(); });
    SDAW.bus.on('change', () => { if (lib.tab === 'patterns' || lib.tab === 'samples') lib.render(); });
    // only move the highlight (a full redraw would break double-click rename)
    SDAW.bus.on('selection', () => {
      if (lib.tab !== 'patterns') return;
      const pid = SDAW.store.sel.patternId;
      SDAW.$$('.pat-row').forEach(r => r.classList.toggle('active', r.dataset.pid === pid));
    });
    SDAW.samples.restoreRoots();
    lib.render();
  };

})(window.SDAW);
