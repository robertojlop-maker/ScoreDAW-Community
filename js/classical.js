/* Chamber composition for Auto Generate Full Song. All themes are generated. */
(function (SDAW) {
  'use strict';

  const C = SDAW.classical = {};
  const profiles = {
    bach: {
      name: 'Bach · Baroque invention', tempo: [76, 132, 108], mode: 'major', lead: 'piano', interaction: 'imitation',
      notes: [0, 1, 2, 0, 3, 2, 1, -1], rhythm: [2, 2, 2, 2], texture: 'blend',
      major: ['I IV V I', 'vi ii V7 I', 'I I7 IV V7'], minor: ['i iv V i', 'i bVI iio V7', 'i bIII iv V']
    },
    vivaldi: {
      name: 'Vivaldi · String concerto', tempo: [86, 168, 104], mode: 'minor', lead: 'violin', interaction: 'rotate',
      notes: [0, 2, 4, 2, 0, 1, 2, 4], rhythm: [1, 1, 2, 2, 2], texture: 'arpeggio',
      major: ['I V IV I', 'vi iii IV V7', 'I IV ii V'], minor: ['i iv V7 i', 'i bVII bVI V', 'i bIII iv V7']
    },
    mozart: {
      name: 'Mozart · Classical chamber music', tempo: [94, 152, 128], mode: 'major', lead: 'piano', interaction: 'dialogue',
      notes: [0, 2, 1, 0, -1, 0, 1, 2], rhythm: [4, 2, 2, 4, 2, 2], texture: 'alberti',
      major: ['I I V7 I', 'I IV ii V7', 'vi ii V7 I'], minor: ['i V i V7', 'i iv iio V', 'bIII iv V7 i']
    },
    beethoven: {
      name: 'Beethoven · Dramatic sonata', tempo: [72, 156, 120], mode: 'minor', lead: 'piano', interaction: 'rotate',
      notes: [0, 0, 0, -2, 1, 1, 0, -1], rhythm: [2, 2, 2, 8, 2], texture: 'blend',
      major: ['I ii V7 I', 'I vi IV V', 'vi IV ii V7'], minor: ['i i bVI V7', 'i iv V7 i', 'bVI iio V7 i']
    },
    chopin: {
      name: 'Chopin · Romantic nocturne', tempo: [48, 96, 60], mode: 'minor', lead: 'piano', interaction: 'solo',
      notes: [0, 1, 2, 4, 3, 2, 1, 0], rhythm: [6, 2, 4, 2, 2], texture: 'arpeggio',
      major: ['I vi ii V7', 'I III7 vi V', 'IV iv V7 I'], minor: ['i bVI iv V7', 'i bIII bVI V7', 'iv iio V7 i']
    }
  };

  const labels = { piano: 'Piano', guitar: 'Classical guitar', violin: 'Solo violin', viola: 'Viola' };
  const violinIds = ['violin', 'violin2', 'violin3', 'violin4'];
  const isViolin = id => violinIds.includes(id);
  const isBowed = id => isViolin(id) || id === 'viola';
  const tracks = [
    { id: 'piano', name: 'Piano', role: 'harmony', inst: 'Grand Piano', range: [39, 90], vol: .71, pan: -.10 },
    { id: 'guitar', name: 'Classical Guitar', role: 'arp', inst: 'Classical Guitar - Nylon', range: [40, 79], vol: .67, pan: .18 },
    { id: 'violin', name: 'Solo Violin', role: 'melody', inst: 'Solo Violin', range: [55, 88], vol: .81, pan: -.23 },
    ...violinIds.slice(1).map((id, i) => ({
      id, name: 'Violin ' + ['II', 'III', 'IV'][i], role: 'counter', inst: 'Violin Section', alternatives: ['Solo Violin'],
      range: [55, 84], vol: .59, pan: [.26, -.4, .41][i], on: false
    })),
    { id: 'viola', name: 'Viola', role: 'counter', inst: 'Solo Viola', alternatives: ['Viola Section'], range: [48, 76], vol: .40, pan: .25 }
  ];

  const progressions = p => ['major', 'minor'].flatMap(mode => {
    const [theme, answer, development] = p[mode];
    return [
      { n: 'Theme and authentic cadence', m: mode, c: theme, use: 'verse chorus' },
      { n: 'Answer and return', m: mode, c: answer, use: 'chorus verse' },
      { n: 'Development', m: mode, c: development, use: 'bridge solo pre' },
      { n: 'Opening', m: mode, c: theme, use: 'intro' },
      { n: 'Closing cadence', m: mode, c: mode === 'minor' ? 'i iv V7 i' : 'I ii V7 I', use: 'outro' }
    ];
  });

  const structures = {
    Short: 'Intro:4 Exposition (Verse):4 Development (Bridge):4 Reprise (Chorus):4 Coda (Outro):4',
    Standard: 'Intro:4 Exposition (Verse):8 Reply (Pre-Chorus):4 Development (Bridge):8 Cadenza (Solo):4 Reprise (Chorus):8 Coda (Outro):4',
    Extended: 'Intro:8 Exposition (Verse):8 Reply (Pre-Chorus):8 Development (Bridge):12 Cadenza (Solo):8 Reprise (Chorus):8 Coda (Outro):4'
  };
  const standardForms = {
    bach: 'Intro:4 Subject (Verse):8 Answer (Pre-Chorus):4 Inversion (Bridge):8 Subject return (Chorus):8 Coda (Outro):4',
    vivaldi: 'Ritornello (Intro):4 First episode (Solo):8 Tutti return (Chorus):4 Second episode (Bridge):8 Ritornello return (Chorus):8 Coda (Outro):4',
    beethoven: 'Intro:4 Exposition (Verse):8 Second theme (Pre-Chorus):4 Development (Bridge):12 Recapitulation (Chorus):8 Coda (Outro):4',
    chopin: 'Intro:4 Cantabile (Verse):8 Agitato (Bridge):8 Ornamented return (Chorus):8 Coda (Outro):4'
  };
  SDAW.STYLES.Classical = {
    family: 'Classical', classical: true, desc: 'Instrumental chamber music with piano, nylon guitar, violin and viola.',
    tracks, types: Object.fromEntries(Object.entries(profiles).map(([id, p]) => [id, {
      n: p.name, set: { mode: p.mode, tempo: p.tempo, profile: p, structures: { ...structures, Standard: standardForms[id] || structures.Standard } }
    }])),
    key: { major: 'C', minor: 'A' }, tempo: profiles.bach.tempo, structures,
    progs: Object.entries(profiles).flatMap(([id, p]) => progressions(p).map(prog => ({ ...prog, t: id })))
  };

  const defaults = profile => ({
    lead: profile.lead, reply: profile.lead === 'violin' ? 'piano' : 'guitar',
    interaction: profile.interaction, role: {}, sections: {}, meter: '4/4', bow: 'auto', intro: 'auto', opening: 'lead', soloist: 'auto', soloDetail: 'ornaments'
  });
  C.settings = (opts, style) => Object.assign(defaults(style.profile || profiles.bach), opts.chamber);

  C.controls = function (parent, sectionColumn, opts, style, sections, row, render) {
    const { el } = SDAW, settings = opts.chamber = C.settings(opts, style);
    tracks.forEach(spec => {
      opts.tracks[spec.id] ??= { on: spec.on !== false, inst: spec.inst, fx: 'Room', play: null };
    });
    const parts = tracks.filter(spec => opts.tracks[spec.id].on).map(spec => [spec.id, labels[spec.id] || spec.name]);
    const violinCount = violinIds.filter(id => opts.tracks[id].on).length;
    if (parts.length && !parts.some(([id]) => id === settings.lead)) settings.lead = parts[0][0];
    const answers = parts.filter(([id]) => id !== settings.lead);
    if (answers.length && !answers.some(([id]) => id === settings.reply)) settings.reply = answers[0][0];
    const select = (label, choices, value, set, redraw = false) => row(label, el('select', {
      'aria-label': label, onchange: e => { set(e.target.value); if (redraw) render(); }
    }, choices.map(([v, h]) => el('option', { value: v, selected: v === value ? true : null }, h))));
    parent.append(
      el('div', { class: 'ag-sub' }, 'Chamber arrangement'),
      select('Lead instrument', parts, settings.lead, v => { settings.lead = v; }, true),
      select('Interaction', [['solo', 'Fixed lead'], ['dialogue', 'Call and response'], ['rotate', 'Lead rotates by section'], ['imitation', 'Imitative counterpoint']], settings.interaction, v => { settings.interaction = v; }, true),
      select('Meter', [['4/4', '4/4'], ['3/4', '3/4'], ['2/4', '2/4'], ['6/8', '6/8']], settings.meter, v => { settings.meter = v; }),
      select('Violin and viola', [['auto', 'Legato with occasional pizzicato'], ['arco', 'Legato arco'], ['short', 'Spiccato / short bow'], ['pizz', 'Pizzicato']], settings.bow, v => { settings.bow = v; }),
      select('Solo technique', [['ornaments', 'Trills and fast runs'], ['runs', 'Fast runs'], ['lyrical', 'Lyrical phrasing']], settings.soloDetail, v => { settings.soloDetail = v; })
    );
    if (['dialogue', 'imitation'].includes(settings.interaction)) {
      parent.append(select('Answering instrument', answers, settings.reply, v => { settings.reply = v; }));
    }
    parent.append(el('div', { class: 'ag-sub' }, 'Instrument roles'));
    const choices = [['auto', 'Follow style'], ['blend', 'Melody, arpeggios and chords'], ['arpeggio', 'Arpeggios'], ['harmony', 'Chord accompaniment'], ['counter', 'Countermelody'], ['rest', 'Tacit unless featured']];
    parts.forEach(([id, label]) => {
      const roles = isBowed(id)
        ? [['auto', 'Follow style'], ['counter', 'Countermelody'], ['sustain', 'Sustained background'], ['arpeggio', 'Broken chords'], ['rest', 'Tacit unless featured']]
        : choices;
      parent.append(select(label, roles, settings.role[id] || 'auto', v => { settings.role[id] = v; }));
    });
    sectionColumn.append(
      el('div', { class: 'ag-sub' }, 'Ensemble and opening'),
      select('Violin parts', violinIds.map((_, i) => [String(i + 1), String(i + 1)]).concat([['0', 'None']]), String(violinCount), v => {
        violinIds.forEach((id, i) => { opts.tracks[id].on = i < Number(v); });
      }, true),
      el('button', { class: 'btn small', onclick: () => {
        tracks.forEach(t => { opts.tracks[t.id].on = isViolin(t.id); });
        render();
      } }, 'Violins only'),
      select('Introduction', [['auto', 'Vary with the idea'], ['ensemble', 'Full ensemble'], ['solo', 'One instrument'], ['gradual', 'Gradual entrances']], settings.intro, v => { settings.intro = v; }, true),
      select('Opening instrument', [['lead', 'Follow lead'], ...parts], settings.opening, v => { settings.opening = v; }),
      select('Cadenza soloist', [['auto', 'Vary with the idea'], ['lead', 'Follow lead'], ...parts], settings.soloist, v => { settings.soloist = v; }),
      el('div', { class: 'ag-sub' }, 'Lead by section')
    );
    sections.forEach(section => sectionColumn.append(select(section.name, [['auto', 'Follow interaction'], ...parts],
      settings.sections[section.name] || settings.sections[section.type] || 'auto', v => { settings.sections[section.name] = v; })));
  };

  const pc = n => (n % 12 + 12) % 12;
  /**
   * The pitch of one of the pitch classes closest to `target` inside low..high. When the range
   * holds none of them it widens by an octave instead of returning `low` — that fallback used to
   * put notes outside the chord (an E flat over C major) into the accompaniment.
   */
  const nearest = (target, pitches, low, high) => {
    for (let widen = 0; widen <= 12; widen += 12) {
      let best = null, distance = Infinity;
      for (let pitch = low - widen; pitch <= high + widen; pitch++) {
        const d = Math.abs(pitch - target);
        if (d < distance && pitches.includes(pc(pitch))) { best = pitch; distance = d; }
      }
      if (best !== null) return best;
    }
    return Math.max(low, Math.min(high, Math.round(target)));
  };

  function chordReader(song, opts) {
    const events = song.chords.map(ch => ({ tick: ch.tick, chord: SDAW.parseChord(ch.name) })).filter(x => x.chord);
    let index = 0;
    return tick => {
      while (events[index + 1]?.tick <= tick) index++;
      return events[index]?.chord || { root: opts.key, intervals: opts.mode === 'minor' ? [0, 3, 7] : [0, 4, 7] };
    };
  }

  /**
   * Scale of the bar, bent to the chord: a chord tone that is a semitone away from a scale
   * degree replaces it (harmonic minor leading tone on V, the major third of a secondary
   * dominant, the raised sixth of iv in melodic minor…). Before, the line ran through the
   * natural scale over chords that alter it, and long passing notes clashed with the harmony.
   */
  function barScale(mode, key, pcs) {
    const steps = mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const scale = steps.map(x => pc(x + key));
    pcs.forEach(tone => {
      if (scale.includes(tone)) return;
      const i = scale.findIndex(x => Math.abs(((x - tone + 18) % 12) - 6) === 1 && !pcs.includes(x));
      if (i >= 0) scale[i] = tone; else scale.push(tone);
    });
    return [...new Set(scale)].sort((a, b) => a - b);
  }

  /**
   * Counterpoint rule for every melodic line: notes on the beat and notes of a beat or longer
   * are chord tones; a non-chord tone is allowed only as a short passing / neighbour note that
   * moves by step (≤ 2 semitones) from the previous note and into a chord tone.
   */
  function resolveLine(notes, pcs, beat, low, high, keepFrom = Infinity) {
    const short = Math.max(1, beat / 2);
    for (let pass = 0; pass < 2; pass++) notes.forEach((note, i) => {
      if (note.at >= keepFrom || pcs.includes(pc(note.pitch))) return;
      const prev = notes[i - 1], next = notes[i + 1];
      const passing = note.at % beat !== 0 && note.dur <= short && prev && next &&
        Math.abs(note.pitch - prev.pitch) <= 2 && Math.abs(next.pitch - note.pitch) <= 2 &&
        (next.at >= keepFrom || pcs.includes(pc(next.pitch)));
      if (!passing) note.pitch = nearest(note.pitch, pcs, low, high);
    });
    return notes;
  }

  function theme(state, context) {
    const { bar, index, voice, upper, low, high, chord, pcs, section, rng, profile, density, complexity, mode, key, guitar, ornament, beat } = context;
    const notes = [], B = context.length;
    const material = profile.notes;
    const variant = section === 'bridge' ? -1 : 1;
    const ordered = barScale(mode, key, pcs);
    const anchor = nearest(bar % 4 === 0 ? upper : state.pitch ?? upper, pcs, low, high);
    const scaleNotes = [];
    for (let n = low; n <= high; n++) if (ordered.includes(pc(n))) scaleNotes.push(n);
    const origin = scaleNotes.indexOf(nearest(anchor, ordered, low, high));
    const turnAt = B - Math.min(beat, B / 2);
    const offset = bar % 4 === 2 ? 2 : 0;
    const accent = section === 'solo' || section === 'bridge' ? 8 : 0;
    let at = 0, ornamentAt = Infinity;
    for (let i = 0; at < B; i++) {
      const rhythm = profile.rhythm[(i + (offset ? 1 : 0)) % profile.rhythm.length];
      // a note never crosses a beat it does not start on unless it is at least a beat long
      let dur = Math.min(B - at, ornament && at < turnAt ? turnAt - at : B - at,
        Math.max(1, rhythm + (density < .5 ? 2 : 0) - (accent && complexity > .65 ? 1 : 0)));
      const toBeat = beat - at % beat;
      if (dur > toBeat && dur < beat + toBeat && at % beat !== 0) dur = toBeat;
      const degree = material[(i + index + offset) % material.length] * variant;
      const target = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, origin + degree))];
      if (ornament && at >= turnAt) {
        // the ornament starts on a chord tone and its notes come from the scale of this chord
        ornamentAt = at;
        const base = nearest(state.pitch ?? anchor, pcs, low + 4, high - 5);
        const start = Math.max(0, scaleNotes.indexOf(base));
        const count = Math.max(2, Math.round((B - at) * 2));
        const direction = guitar || bar % 4 >= 2 ? -1 : 1;
        const upperNote = scaleNotes[Math.min(scaleNotes.length - 1, start + 1)];
        for (let j = 0; j < count; j++) {
          const pitch = ornament === 'trill' ? (j % 2 ? upperNote : base)
            : scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, start + direction * (j - count + 1)))];
          notes.push({ at: at + j * .5, dur: .5, pitch: j === 0 ? nearest(pitch, pcs, low, high) : pitch, voice, vel: 91 + (j === 0 ? 4 : 0) });
          state.pitch = pitch;
        }
        break;
      }
      notes.push({ at, dur, pitch: i === 0 ? nearest(target, pcs, low, high) : target, voice, vel: 86 + accent + (at === 0 ? 9 : 0) + rng.int(-4, 4) });
      at += dur;
    }
    // the last note of a phrase (every 4th bar) closes on a chord tone
    const last = notes.filter(n => n.at < ornamentAt).at(-1);
    if (last && bar % 4 === 3) last.pitch = nearest(last.pitch, pcs, low, high);
    resolveLine(notes, pcs, beat, low, high, ornamentAt);
    const tail = notes.filter(n => n.at < ornamentAt).at(-1);
    if (tail) state.pitch = tail.pitch;
    if (ornamentAt < Infinity) state.pitch = notes.at(-1).pitch;
    return notes;
  }

  /** a guitar chord shape: [{ pitch, string, fret }] from low to high (one note per string) */
  function guitarShape(chord, maxNotes) {
    const tones = chord.intervals.slice(0, chord.intervals.length > 3 ? 4 : 3);
    const frets = SDAW.chordVoicing(chord.root, tones);
    const shape = frets.flatMap((fret, string) => fret < 0 ? [] : [{ pitch: CONFIG.guitar.tuning[string] + fret, string, fret }]);
    // a slash chord puts its bass on the lowest string that can play it
    if (chord.bass !== undefined && shape.length) {
      const low = shape[0];
      for (let string = 0; string <= Math.min(2, low.string); string++) {
        const fret = pc(chord.bass - CONFIG.guitar.tuning[string]);
        if (fret <= 5) { shape.splice(0, shape.findIndex(n => n.string > string), { pitch: CONFIG.guitar.tuning[string] + fret, string, fret }); break; }
      }
    }
    return shape.length > maxNotes ? [shape[0], ...shape.slice(-(maxNotes - 1))] : shape;
  }

  /** broken-chord notes ring (finger left on the string / sustain pedal) until that pitch plays again */
  function letRing(notes, B) {
    notes.forEach(note => {
      const again = notes.find(n => n !== note && n.pitch === note.pitch && n.at > note.at);
      note.dur = Math.max(note.dur, (again ? again.at : B) - note.at);
    });
    return notes;
  }

  function backing(state, context, texture, bowed, piano, ceiling = Infinity) {
    const { chord, pcs, low, section, bar, length: B, index, density, violinPart } = context;
    const root = chord.bass ?? chord.root, notes = [];
    const velocity = section === 'intro' ? 57 : section === 'bridge' ? 67 : 62;
    const add = (at, dur, pitch, voice = 2, shift = 0, pos) => notes.push(Object.assign({ at, dur, pitch, voice, vel: velocity + shift }, pos));
    if (texture === 'rest') return notes;
    if (bowed) {
      const harmony = violinPart > 0 ? [pcs[(violinPart + Math.floor(bar / 2)) % pcs.length]] : pcs;
      const pitch = nearest(state.back ?? low + 7, harmony, low, low + 14);
      state.back = pitch;
      if (texture === 'arpeggio') {
        for (let at = 0; at < B; at += 2) add(at, Math.min(2, B - at), nearest(pitch + (at % 3), [pcs[(at / 2) % pcs.length]], low, low + 15));
      } else {
        add(0, texture === 'counter' ? B / 2 : B, pitch);
        if (texture === 'counter') add(B / 2, B / 2, nearest(pitch + (bar % 2 ? -2 : 2), pcs.filter(n => n !== pc(pitch)), low, low + 16));
      }
      return notes;
    }

    // the guitar plays real chord shapes (one note per string, so nothing cuts a ringing string)
    if (!piano) {
      const shape = guitarShape(chord, 4);
      if (!shape.length) return notes;
      const at0 = (at, dur, n, shift) => add(at, dur, n.pitch, 2, shift, { string: n.string, fret: n.fret });
      if (texture === 'harmony' || (texture === 'blend' && bar % 4 === 3)) {
        shape.forEach((n, i) => at0(0, B, n, i ? 0 : 4));
        notes.forEach(n => { n.tech = { strum: 'down' }; });
      } else if (texture === 'counter') {
        at0(0, B, shape[0], 4);
        at0(B / 2, B / 2, shape[Math.min(shape.length - 1, 2)], 0);
      } else {
        const order = texture === 'alberti' ? [0, 3, 1, 3] : [0, 1, 2, 3, 2, 1, 3, 2];
        const step = density < .45 ? 4 : 2;
        for (let at = 0; at < B; at += step) {
          const i = Math.floor(at / step), n = shape[order[i % order.length] % shape.length];
          at0(at, step, n, i === 0 ? 6 : -3);
        }
        letRing(notes, B);
      }
      return notes;
    }

    // piano left hand: under the right-hand melody when the piano also plays the theme
    let bass = nearest(state.back ?? low + 4, [root], low, low + 12);
    while (bass > low + 11 && bass - 12 >= low) bass -= 12;
    state.back = bass;
    const top = Math.min(bass + 20, ceiling - 3);
    let triad = pcs.slice(0, 3).map(n => nearest(Math.min(bass + 13, top), [n], bass + 3, Math.max(bass + 3, top)))
      .filter(p => p > bass && p <= top && pcs.includes(pc(p)));
    triad = [...new Set(triad)].sort((a, b) => a - b);
    const voices = [bass, ...triad];
    if (texture === 'harmony' || (texture === 'blend' && bar % 4 === 3)) {
      voices.forEach(pitch => add(0, B, pitch));
    } else if (texture === 'counter') {
      add(0, B / 2, bass);
      add(B / 2, B / 2, nearest(bass + 4, pcs.filter(n => n !== pc(bass)), low, Math.min(low + 15, top)));
    } else {
      const order = texture === 'alberti' ? [0, 3, 1, 3] : [0, 1, 2, 3, 2, 1, 3, 2];
      const step = density < .45 ? 4 : 2;
      for (let at = 0; at < B; at += step) {
        const i = Math.floor(at / step);
        add(at, Math.min(step, B - at), voices[order[i % order.length] % voices.length], 2, i === 0 ? 6 : -3);
      }
      // Alberti bass is played legato without pedal; broken chords ring with the pedal
      if (texture !== 'alberti') letRing(notes, B);
      else notes[0].dur = Math.max(notes[0].dur, Math.min(B, 4));
      if (texture === 'blend' && index % 2 === 0 && ceiling === Infinity && triad.length) add(0, B, triad[0] + 12, 3, -13);
    }
    return notes;
  }

  /** one instrument never strikes a pitch that is still sounding: the earlier note ends there */
  function untangle(notes) {
    notes.sort((a, b) => a.at - b.at || b.dur - a.dur);
    const out = [];
    notes.forEach(note => {
      const same = out.filter(n => n.pitch === note.pitch && n.at + n.dur > note.at + 1e-6);
      if (same.some(n => Math.abs(n.at - note.at) < 1e-6)) return;     // a duplicate of a note already there
      same.forEach(n => { n.dur = note.at - n.at; });
      out.push(note);
    });
    return out.filter(n => n.dur > 1e-6);
  }

  function assignPart(track, notes, song, section, bar, length) {
    notes = untangle(notes);
    if (!notes.length) return;
    const pattern = SDAW.makePattern('notes', section.name + ' · ' + (bar + 1), length, track.color);
    pattern.notes = notes.map(n => {
      const note = { id: SDAW.uid('n'), pitch: n.pitch, start: n.at, dur: Math.min(n.dur, length - n.at), voice: n.voice, vel: n.vel, tech: n.tech || {} };
      if (n.string >= 0) { note.string = n.string; note.fret = n.fret; }
      return note;
    }).sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    song.patterns.push(pattern);
    track.clips.push({ id: SDAW.uid('clp'), kind: 'pattern', patternId: pattern.id, start: (section.start + bar) * length, len: length });
  }

  C.arrange = function (song, opts, style, sections) {
    const settings = C.settings(opts, style), profile = style.profile;
    const length = SDAW.barTicks(song), findChord = chordReader(song, opts);
    const rng = SDAW.autogen.util.makeRand(opts.seed || 1);
    const themeStart = rng.int(0, 3);
    const ids = song.tracks.map(t => t.styleTrack);
    const lead = ids.includes(settings.lead) ? settings.lead : ids[0];
    const ordering = [lead, ...ids.filter(x => x !== lead)];
    const reply = ids.includes(settings.reply) && settings.reply !== lead ? settings.reply : ordering[1];
    const states = new Map(song.tracks.map(t => [t.styleTrack, {}]));
    const choices = [lead, ...ordering.filter(id => id !== lead && id)];
    const introMode = settings.intro === 'auto' ? ['ensemble', 'solo', 'gradual'][(opts.seed || 1) % 3] : settings.intro;
    const open = ids.includes(settings.opening) ? settings.opening : settings.intro === 'auto' && introMode !== 'ensemble' ? ordering[(opts.seed || 1) % ordering.length] : lead;
    const entranceOrder = [open, ...ordering.filter(id => id !== open)];
    const cadenza = ids.includes(settings.soloist) ? settings.soloist
      : settings.soloist === 'lead' ? lead
      : ordering.includes('guitar') && (opts.seed || 1) % 4 === 1 ? 'guitar'
      : choices.find(isViolin) || lead;
    const hasCadenza = sections.some(s => s.type === 'solo');
    sections.forEach((section, si) => {
      const selected = settings.sections[section.name] || settings.sections[section.type], manual = ids.includes(selected);
      const isCadenza = section.type === 'solo' || !hasCadenza && section.type === 'bridge' && ids.includes(settings.soloist);
      const opening = si === 0 && section.type === 'intro' && introMode !== 'ensemble';
      const featured = opening ? open : manual ? selected : isCadenza ? cadenza
        : settings.interaction === 'rotate' && section.type !== 'outro' ? ordering[si % ordering.length] : lead;
      for (let bar = 0; bar < section.length; bar++) {
        const final = si === sections.length - 1 && bar === section.length - 1;
        const tick = (section.start + bar) * length;
        const chord = findChord(tick);
        const pitches = chord.intervals.map(n => pc(n + chord.root));
        const responding = !manual && reply && settings.interaction === 'dialogue' && Math.floor(bar / 2) % 2;
        const foreground = responding && !final && !opening && !isCadenza ? reply : featured;
        const available = opening ? entranceOrder.slice(0, introMode === 'solo' ? 1
          : 1 + Math.floor(bar * (entranceOrder.length - 1) / Math.max(1, section.length - 1))) : ordering;
        song.tracks.forEach(track => {
          const id = track.styleTrack, bowed = isBowed(id), piano = id === 'piano';
          if (!available.includes(id)) return;
          const violinPart = violinIds.indexOf(id);
          const spec = tracks.find(t => t.id === id), [nativeLow, high] = spec.range;
          const low = nativeLow + (violinPart >= 0 ? Math.max(0, 6 - violinPart * 2) : 0);
          const upper = violinPart >= 0 ? 76 - violinPart * 2 : id === 'viola' ? 68 : id === 'guitar' ? 67 : 72;
          const state = states.get(id);
          const texture = settings.role[id] && settings.role[id] !== 'auto' ? settings.role[id]
            : bowed ? section.type === 'bridge' || violinPart === 1 && bar % 4 >= 2 ? 'counter' : 'sustain' : profile.texture;
          const solo = id === foreground;
          const imitation = !manual && !opening && !isCadenza && id === reply && id !== foreground && settings.interaction === 'imitation' && bar % 4 > 0 && !final;
          const virtuosic = solo && (isViolin(id) || id === 'guitar') && !opening && (isCadenza || section.type === 'bridge')
            && settings.soloDetail !== 'lyrical' && opts.complexity > .5 && (!bowed || ['auto', 'arco'].includes(settings.bow));
          const ornament = virtuosic && bar % 2 === 1
            ? isViolin(id) && settings.soloDetail === 'ornaments' && bar % 4 === 3 ? 'trill' : 'run' : null;
          const phrasing = { length, bar, index: themeStart, voice: 1, upper, low, high, chord, pcs: pitches, section: section.type,
            rng, profile, density: opts.density, complexity: opts.complexity, mode: opts.mode, key: opts.key, guitar: id === 'guitar',
            ornament, violinPart, beat: settings.meter === '6/8' ? 6 : 4 };
          let notes = [];
          if (final) {
            if (solo || texture !== 'rest') {
              if (id === 'guitar') {
                // the last chord of the guitar is a real shape, strummed, with the root on top when it leads
                notes = guitarShape(chord, 5).map((n, i) => ({ at: 0, dur: length, pitch: n.pitch, string: n.string, fret: n.fret, voice: 2, vel: 62 + (i ? 0 : 4), tech: { strum: 'down' } }));
              } else {
                notes = [{ at: 0, dur: length, pitch: nearest(solo ? upper : low + 4, [chord.root], low, high), voice: 1, vel: solo ? 94 : 62 }];
                if (!bowed) pitches.slice(1, 3).forEach(n => notes.push({ at: 0, dur: length, pitch: nearest(low + 15, [n], low + 7, high), voice: 2, vel: 65 }));
              }
            }
          } else if (solo || imitation) {
            notes = theme(state, imitation ? { ...phrasing, bar: bar - 1, upper: upper - 8, length: length / 2 } : phrasing);
            if (imitation) notes.forEach(n => { n.at += length / 2; n.vel -= 19; });
            // the left hand stays under the melody (before, both hands met on the same keys)
            if (piano && solo && texture !== 'rest') notes.push(...backing(state, phrasing, texture, false, true, Math.min(...notes.map(n => n.pitch))));
          } else {
            notes = backing(state, phrasing, texture, bowed, piano);
          }
          if (bowed && !final) {
            const art = settings.bow === 'auto'
              ? !solo && !imitation && !opening && section.type === 'pre' && bar % 4 === 2 ? 'pizz' : 'arco'
              : settings.bow;
            notes.forEach(n => {
              if (art === 'pizz') n.tech = { pizz: true };
              else if (art === 'short') n.tech = { stacc: true };
              else n.tech = { arco: true };
            });
          }
          assignPart(track, notes, song, section, bar, length);
        });
      }
    });
    SDAW.fixSongStrings(song);
  };

  // True ties sustain a pitch across the barline. Bow slurs connect a phrase of different pitches.
  C.phrase = function (song) {
    const patterns = new Map(song.patterns.map(p => [p.id, p]));
    const length = SDAW.barTicks(song), beat = SDAW.beatTicks(song);
    // Piano and guitar: a held note (a beat or longer) that goes on with the same pitch over the
    // barline is tied, so the chord / melody note keeps sounding instead of being struck again.
    song.tracks.filter(track => track.engine !== 'bowed' && track.type !== 'drums').forEach(track => {
      const ends = new Map();
      track.clips.slice().sort((a, b) => a.start - b.start).forEach(clip => {
        const pattern = patterns.get(clip.patternId);
        if (!pattern) return;
        pattern.notes.forEach(note => {
          const head = note.start < .001 && ends.get(clip.start + ':' + note.pitch + ':' + (note.voice || 0));
          if (head && head.dur >= beat && note.dur >= beat && !note.tech?.stacc) {
            note.tie = true;
            if (head.string >= 0) { note.string = head.string; note.fret = head.fret; }
          }
        });
        pattern.notes.forEach(note => ends.set(clip.start + note.start + note.dur + ':' + note.pitch + ':' + (note.voice || 0), note));
      });
    });
    song.tracks.filter(track => track.engine === 'bowed').forEach(track => {
      const phrase = [];
      let phraseStart = 0;
      const flush = () => {
        if (phrase.length >= 2) phrase.forEach((note, i) => {
          note.tech = { ...note.tech, bowSlur: i === 0 ? 'start' : i === phrase.length - 1 ? 'stop' : 'continue' };
        });
        phrase.length = 0;
      };
      let previous = null, previousStart = 0;
      track.clips.forEach(clip => patterns.get(clip.patternId).notes.forEach(note => {
        const start = clip.start + note.start;
        const continuous = previous && Math.abs(previousStart + previous.dur - start) < .001 && previous.voice === note.voice;
        if (note.tech?.pizz || note.tech?.stacc) { flush(); previous = null; return; }
        if (continuous && previous.pitch === note.pitch && Math.abs(start % length) < .001) note.tie = true;
        if (!continuous || note.tie || previous.tie || previous.pitch === note.pitch || Math.abs(previous.pitch - note.pitch) > 7 ||
          (phrase.length > 1 && start - phraseStart >= 8 && start % length !== 0)) {
          flush();
        }
        if (!note.tie) {
          if (!phrase.length) phraseStart = start;
          phrase.push(note);
        }
        previous = note;
        previousStart = start;
      }));
      flush();
    });
  };
})(window.SDAW);
