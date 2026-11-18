/* Seeded romantic chamber arrangements for the Classical generator. */
(function (SDAW) {
  'use strict';
  const R = SDAW.romantic = {};
  R.profile = {
    romantic: true, name: 'Romantic · Relaxing classical pop',
    tempo: [56, 90, 72], mode: 'major', lead: 'auto', interaction: 'auto',
    notes: [0, 1, 2, 4, 3, 2, 1, 0], rhythm: [4, 2, 2, 4, 4], texture: 'blend',
    major: ['I vi IV V', 'I V vi IV', 'vi IV ii V7'],
    minor: ['i bVI bIII bVII', 'i iv bVI V7', 'iv bVI V7 i']
  };
  const combinations = [
    ['piano'], ['guitar'], ['harp'],
    ['piano', 'violin'], ['guitar', 'violin'], ['harp', 'violin'],
    ['piano', 'guitar'], ['harp', 'guitar'], ['piano', 'harp'],
    ['piano', 'guitar', 'violin'], ['harp', 'violin', 'violin2'],
    ['harp', 'guitar', 'violin'], ['piano', 'harp', 'violin'],
    ['piano', 'guitar', 'harp', 'violin'], ['piano', 'violin', 'viola']
  ];
  R.names = {
    piano: 'Piano', guitar: 'Classical guitar', harp: 'Concert harp',
    violin: 'Solo violin', violin2: 'Violin II', violin3: 'Violin III', violin4: 'Violin IV', viola: 'Viola'
  };
  R.ensembles = combinations.map((ids, i) => [String(i), ids.map(id => R.names[id]).join(' + ')]);
  const random = (seed, purpose) => SDAW.autogen.util.makeRand(SDAW.autogen.util.hash('romantic/' + purpose + '/' + (seed || 1)));
  R.isActive = (opts, style) => !!style.profile?.romantic;

  R.prepare = function (opts, style, initial = false) {
    if (!R.isActive(opts, style)) return opts;
    const c = opts.chamber = Object.assign({
      ensemble: 'auto', lead: 'auto', reply: 'auto', interaction: 'auto', role: {}, sections: {},
      meter: '4/4', bow: 'arco', intro: 'auto', introCharacter: 'auto', opening: 'auto', soloist: 'auto', soloDetail: 'lyrical', flourishes: 'auto', melodyVoicing: 'auto'
    }, opts.chamber);
    style.tracks.forEach(t => {
      opts.tracks[t.id] ??= { on: t.on !== false, inst: t.inst, play: t.play || null, fx: t.fx || 'Room' };
    });
    if (c.ensemble !== 'manual') {
      const ids = combinations[Number.isInteger(+c.ensemble) && c.ensemble !== 'auto' && combinations[+c.ensemble]
        ? +c.ensemble : random(opts.seed, 'ensemble').int(0, combinations.length - 1)];
      Object.keys(opts.tracks).forEach(id => { opts.tracks[id].on = ids.includes(id); });
    }
    if (initial) {
      opts.complexity = .6;
      opts.density = .55;
      opts.tempo = random(opts.seed, 'tempo').int(62, 82);
    }
    return opts;
  };

  R.settings = function (opts, style) {
    const c = { ...opts.chamber, role: { ...opts.chamber?.role }, sections: { ...opts.chamber?.sections } };
    const ids = style.tracks.filter(t => opts.tracks[t.id]?.on).map(t => t.id);
    const rng = random(opts.seed, 'roles');
    const candidates = ids.length > 1 && ids.includes(c.reply) ? ids.filter(id => id !== c.reply) : ids;
    c.lead = ids.includes(c.lead) ? c.lead : rng.pick(candidates);
    const others = ids.filter(id => id !== c.lead);
    c.reply = others.includes(c.reply) ? c.reply : others.length ? rng.pick(others) : c.lead;
    if (c.interaction === 'auto') c.interaction = others.length ? rng.pick(['solo', 'solo', 'dialogue', 'rotate']) : 'solo';
    if (!R.introCharacters.some(([id]) => id === c.introCharacter)) c.introCharacter = rng.pick(R.introCharacters)[0];
    const preference = c.introCharacter === 'cascade' ? 'harp' : ['motif', 'alberti', 'cantabile', 'pop', 'chords'].includes(c.introCharacter) ? 'piano' : null;
    if (c.opening === 'auto' && ids.includes(preference)) c.opening = preference;
    if (c.opening === 'lead') c.opening = c.lead;
    else if (!ids.includes(c.opening)) c.opening = rng.pick(ids);
    if (c.intro === 'auto') c.intro = ids.length < 2 ? 'solo' : rng.pick(['solo', 'gradual', 'gradual', 'ensemble']);
    return c;
  };

  R.texture = function (opts, id, section) {
    if (id.startsWith('violin') || id === 'viola') return section.type === 'bridge' ? 'counter' : 'sustain';
    const variants = id === 'guitar' ? ['arpeggio', 'harmony', 'arpeggio', 'blend']
      : ['arpeggio', 'alberti', 'bass-chord', 'pulse', 'rolled', 'answer', 'blend'];
    return random(opts.seed, id + '/' + section.name).pick(variants);
  };

  R.soften = function (notes, section, solo, bar) {
    const intensity = section.type === 'chorus' ? 5 : section.type === 'intro' || section.type === 'outro' ? -5 : 0;
    const contour = [0, 2, 4, -2][bar % 4];
    notes.forEach(n => { n.vel = Math.round(Math.max(38, Math.min(94, n.vel - (solo ? 11 : 5) + intensity + contour))); });
    return notes;
  };

  R.introCharacters = [
    ['cantabile', 'Romantic cantabile / paired melody'],
    ['alberti', 'Classical piano / Alberti bass'],
    ['motif', 'Dramatic piano motif'],
    ['pop', 'Pop ballad / bass and chords'],
    ['cascade', 'Harp and piano cascades'],
    ['dialogue', 'Instrumental dialogue'],
    ['chords', 'Quiet chord prelude']
  ];

  R.progressions = function () {
    const library = {
      major: {
        intro: ['I Imaj7 IV V7', 'I vi ii V7', 'vi IV I V', 'I IV iv I', 'I I IV-V7 I', 'I iii IV V7'],
        verse: ['I V vi iii IV I ii V7', 'I vi IV V I iii IV V7', 'I iii vi IV I vi ii V7',
          'I IV vi V I IV ii V7', 'I Imaj7 IV iv I vi ii V7', 'vi iii IV I ii IV I V7'],
        chorus: ['I vi IV V I IV ii V7', 'IV V iii vi ii V7 I I', 'I V vi IV I ii V7 I',
          'I iii IV V vi IV V7 I', 'IV I ii V7 I vi IV V', 'I IV iv I vi ii V7 I'],
        bridge: ['vi iii IV V7', 'ii vi IV V7', 'IV iv I V', 'vi IV ii V7', 'iii vi ii V7', 'IV I ii V7'],
        outro: ['I vi ii-V7 I', 'IV iv I I', 'ii V7 I I', 'I IV-V7 I I', 'vi ii V7 I']
      },
      minor: {
        intro: ['i iv V7 i', 'i bVI bIII V7', 'i i bVI V7', 'i bIII iv V7', 'i bVII bVI V7', 'i iv i V7'],
        verse: ['i bVI bIII bVII iv i V7 i', 'i iv bVI V7 i bIII iv V7', 'i bIII bVII bVI iv i V7 i',
          'i bVII bVI V7 i iv V7 i', 'i iv bIII bVII bVI iv V7 i', 'i bVI iv V7 bIII bVII iv V7'],
        chorus: ['i bVI bIII bVII iv bVI V7 i', 'bVI bVII bIII i iv bVI V7 i', 'i iv bVI V7 i bIII V7 i',
          'bIII bVII bVI V7 i iv V7 i', 'i bVII bVI iv i bVI V7 i', 'iv i bVI V7 i iv V7 i'],
        bridge: ['bVI bIII iv V7', 'iv i bVI V7', 'bIII bVII bVI V7', 'i bVI iv V7', 'iv bVI V7 i', 'bVI iv i V7'],
        outro: ['iv V7 i i', 'i bVI V7 i', 'bVI iv V7 i', 'i iv-V7 i i', 'iv i V7 i']
      }
    };
    return Object.entries(library).flatMap(([mode, groups]) =>
      Object.entries(groups).flatMap(([group, sequences]) => sequences.map((sequence, i) => ({
        n: ({ intro: 'Opening', verse: 'Theme', chorus: 'Refrain', bridge: 'Interlude', outro: 'Closing' })[group] + ' ' + (i + 1),
        m: mode, c: sequence, use: group === 'bridge' ? 'bridge pre solo' : group
      }))));
  };

  // A two-bar subject is shared by intros, exposition, answers and reprises.
  R.subject = function (opts) {
    const rng = random(opts.seed, 'subject-v2');
    const contours = [
      [0, 1, 2, 4, 2, 1, 0, -1, 0], [2, 1, 0, 1, 3, 2, 1, 0, 0],
      [0, 2, 4, 3, 2, 0, 1, 0, 0], [4, 3, 2, 1, 0, 1, 2, 0, 0],
      [0, -1, 0, 2, 1, 3, 2, 0, 0], [2, 4, 3, 2, 1, 0, -1, 0, 0]
    ];
    const rhythms = [
      [4, 2, 2, 4, 4, 4, 2, 2, 8], [6, 2, 4, 4, 4, 2, 2, 8],
      [4, 4, 2, 2, 4, 4, 4, 8], [2, 2, 4, 6, 2, 4, 4, 8]
    ];
    const degrees = rng.pick(contours).slice(), rhythm = rng.pick(rhythms);
    // A small seeded change retains a coherent contour while increasing the theme vocabulary.
    degrees[3] += rng.pick([-1, 0, 1]);
    return { degrees, rhythm };
  };

  R.barPlan = function (opts, settings, section, bar, available, featured, reply) {
    const manual = settings.sections[section.name] || settings.sections[section.type];
    const accompaniment = manual === 'accompaniment' ||
      ((!manual || manual === 'auto') && section.type === 'bridge' && random(opts.seed, 'interlude-space').chance(.55));
    let leader = featured;
    const keyboards = available.filter(id => id === 'piano' || id === 'harp');
    if (section.type === 'intro' && settings.introCharacter === 'dialogue' && available.length > 1) {
      const pair = keyboards.length > 1 ? keyboards : [featured, available.find(id => id !== featured)];
      leader = pair[bar % 2];
    }
    const exchange = random(opts.seed, 'keyboard-gestures').pick(['together', 'exchange', 'exchange']);
    const owner = keyboards.length > 1 ? keyboards[bar % keyboards.length] : keyboards[0];
    return { leader, accompaniment, keyboards, exchange, owner };
  };

  function scalePitch(degree, tonic, scale, low, high) {
    const index = (degree % 7 + 7) % 7;
    let pitch = tonic + scale[index] + Math.floor(degree / 7) * 12;
    while (pitch > high) pitch -= 12;
    while (pitch < low) pitch += 12;
    return pitch;
  }

  R.melody = function (opts, section, bar, id, context, helpers) {
    const { nearest, barScale, resolveLine } = helpers;
    const { length: B, pcs, low, high, upper, beat } = context;
    const subject = R.subject(opts), settings = opts.chamber || {};
    const plan = R.settings(opts, SDAW.songgen.styleOf(opts));
    const character = plan.introCharacter, intro = section.type === 'intro';
    const degrees = subject.degrees;
    const scale = opts.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const tonic = nearest(upper - (intro ? 2 : 0), [opts.key], low + 3, high - 5);
    const currentScale = barScale(opts.mode, opts.key, pcs);
    const notes = [];
    let cursor = 0;
    subject.rhythm.forEach((duration, i) => {
      const phraseAt = cursor; cursor += duration;
      if (Math.floor(phraseAt / 16) !== bar % 2) return;
      const at = phraseAt % 16 * B / 16, dur = duration * B / 16;
      const degree = section.type === 'bridge' ? degrees[0] - (degrees[i % degrees.length] - degrees[0]) : degrees[i % degrees.length];
      let pitch = scalePitch(degree, tonic, scale, low, high);
      pitch = nearest(pitch, currentScale, low, high);
      notes.push({ at, dur, pitch, voice: 1, vel: 85 + (at === 0 ? 4 : 0), tech: {} });
    });
    if (intro && character === 'motif') {
      const first = nearest(scalePitch(degrees[0], tonic, scale, low, high), pcs, low, high);
      const answer = nearest(scalePitch(degrees[3], tonic, scale, low, high), pcs, low, high);
      notes.length = 0;
      [0, 1, 2, 4, 8].forEach((at, i) => notes.push({
        at: at * B / 16, dur: [1, 1, 2, 4, 8][i] * B / 16,
        pitch: i < 3 ? first : answer, voice: 1, vel: i < 3 ? 78 : 87, tech: {}
      }));
    }
    if (intro && character === 'chords') {
      notes.length = 0;
      const pitch = nearest(tonic + (bar % 2 ? 4 : 0), pcs, low, high);
      notes.push({ at: 0, dur: B, pitch, voice: 1, vel: 78, tech: {} });
    }
    resolveLine(notes, pcs, beat, low, high);
    const doubleLine = id === 'piano' && (settings.melodyVoicing === 'double' ||
      settings.melodyVoicing !== 'single' && (intro ? ['cantabile', 'pop', 'chords'].includes(character)
        : section.type === 'chorus' && random(opts.seed, 'paired-melody').chance(.6)));
    if (doubleLine) {
      notes.slice().forEach(note => {
        if (note.at % beat !== 0) return;
        const pitch = nearest(note.pitch - 4, pcs.filter(tone => tone !== note.pitch % 12), low + 7, note.pitch - 2);
        if (pitch < note.pitch) notes.push({ ...note, pitch, vel: note.vel - 9, tech: {} });
      });
    }
    const selfAnswer = id === 'piano' && (context.texture === 'answer' || settings.role?.piano === 'answer' ||
      (!settings.role?.piano || settings.role.piano === 'auto') && random(opts.seed, 'piano-answer/' + section.name).chance(.3));
    if (selfAnswer && bar % 2 === 1 && !intro) {
      const split = B / 2;
      notes.splice(0, notes.length, ...notes.filter(n => n.at < split).map(n => ({ ...n, dur: Math.min(n.dur, split - n.at) })));
      [0, 1, 2].forEach((value, i) => {
        const pitch = nearest(tonic - 7 + scale[(degrees[i] % 7 + 7) % 7], pcs, Math.max(low, tonic - 12), tonic - 2);
        notes.push({ at: split + i * B / 8, dur: B / 8, pitch, voice: 3, vel: 67, tech: {} });
      });
    }
    return notes.sort((a, b) => a.at - b.at || b.pitch - a.pitch);
  };

  R.keyboard = function (opts, section, bar, id, context, texture, ceiling, helpers) {
    const { nearest } = helpers, { length: B, chord, pcs, low } = context;
    if (texture === 'rest') return [];
    const bass = nearest(low + 7, [chord.bass ?? chord.root], low, low + 12);
    const top = Math.min(id === 'harp' ? 71 : 65, ceiling - 4);
    const chordNotes = [...new Set(pcs.map(tone => nearest(Math.min(bass + 15, top), [tone], bass + 4, Math.max(bass + 4, top))))]
      .filter(pitch => pitch > bass && pitch <= top).sort((a, b) => a - b);
    const tones = chordNotes.length ? chordNotes : [bass + 12];
    const out = [];
    const add = (at, dur, pitch, vel = 61) => {
      if (at >= B || pitch >= ceiling) return;
      out.push({ at, dur: Math.min(dur, B - at), pitch, voice: 2, vel, tech: {} });
    };
    const character = R.settings(opts, SDAW.songgen.styleOf(opts)).introCharacter;
    let pattern = texture;
    if (section.type === 'intro' && (!opts.chamber?.role?.[id] || opts.chamber.role[id] === 'auto')) {
      pattern = ({ alberti: 'alberti', motif: 'bass-chord', pop: 'pulse', cantabile: 'arpeggio',
        cascade: 'arpeggio', dialogue: 'answer', chords: 'rolled' })[character];
    }
    if (pattern === 'blend') pattern = ['bass-chord', 'arpeggio', 'rolled', 'answer'][bar % 4];
    const step = opts.density < .35 ? 4 : 2;
    if (pattern === 'harmony' || pattern === 'rolled') {
      add(0, B, bass, 63);
      tones.forEach((pitch, i) => add(pattern === 'rolled' ? (i + 1) * .25 : 0, B, pitch, 57 + i));
    } else if (pattern === 'bass-chord' || pattern === 'pulse' || pattern === 'waltz') {
      const spacing = pattern === 'pulse' ? 2 : 4;
      for (let at = 0; at < B; at += spacing) {
        const index = at / spacing;
        if (index % (pattern === 'waltz' ? 3 : 2) === 0) add(at, spacing, bass, 64);
        else tones.forEach(pitch => add(at, spacing * .9, pitch, 57));
      }
    } else if (pattern === 'counter' || pattern === 'answer') {
      add(0, B / 2, bass, 61);
      if (pattern === 'answer') {
        if (Number.isFinite(ceiling)) add(0, B / 2, tones[0], 53);
        else [0, 1, 2].forEach(i => add(B / 2 + i * B / 8, B / 8, tones[(bar + i) % tones.length], 62));
      } else add(B / 2, B / 2, tones[0], 59);
    } else {
      const voices = [bass, ...tones], order = pattern === 'alberti' ? [0, 3, 1, 3] : [0, 1, 2, 3, 2, 1, 2, 3];
      for (let at = 0; at < B; at += step) {
        const index = Math.floor(at / step);
        add(at, pattern === 'alberti' ? step : Math.min(4, B - at), voices[order[index % order.length] % voices.length], index === 0 ? 64 : 57);
      }
    }
    return out;
  };

  R.flourish = function (notes, opts, section, bar, id, context, plan, helpers) {
    if (!notes.length || !['piano', 'harp'].includes(id) || plan.accompaniment || opts.chamber?.flourishes === 'none') return notes;
    const settings = R.settings(opts, SDAW.songgen.styleOf(opts));
    const introCascade = section.type === 'intro' && settings.introCharacter === 'cascade';
    const rng = random(opts.seed, 'flourish/' + section.name + '/' + bar);
    if (!introCascade && (bar % 4 !== 3 || !rng.chance(.72))) return notes;
    if (plan.exchange === 'exchange' && plan.owner !== id) return notes;
    const { length: B, pcs } = context;
    const start = B * .75, count = Math.round((B - start) * 2), step = (B - start) / count;
    const up = rng.chance(.5);
    const arpeggio = opts.chamber?.flourishes === 'arpeggios' ||
      (opts.chamber?.flourishes !== 'scales' && rng.chance(.4));
    const tones = arpeggio ? pcs : helpers.barScale(opts.mode, opts.key, pcs);
    const scale = [];
    for (let pitch = 57; pitch <= 84; pitch++) if (tones.includes(pitch % 12)) scale.push(pitch);
    const available = scale.slice(Math.max(0, Math.floor((scale.length - count) / 2)), Math.max(count, Math.floor((scale.length - count) / 2) + count));
    if (!up) available.reverse();
    const keep = notes.filter(n => n.at < start).map(n => ({ ...n, dur: Math.min(n.dur, start - n.at) }));
    for (let i = 0; i < count; i++) {
      let pitch = available[Math.min(i, available.length - 1)];
      if (i === count - 1) pitch = helpers.nearest(pitch, pcs, 57, 84);
      keep.push({ at: start + i * step, dur: step, pitch, voice: 1, vel: 64 + (i === count - 1 ? 4 : 0),
        tech: id === 'harp' ? { harpRun: true } : {} });
    }
    return keep;
  };

// Retune sustained accompaniment when a cadence changes harmony inside a bar.
  // Short scalar melody notes remain passing tones; their destination follows the new chord.
  R.followHarmony = function (notes, song, tick, context, helpers) {
    const B = context.length;
    const changes = song.chords.filter(c => c.tick > tick && c.tick < tick + B)
      .map(c => ({ at: c.tick - tick, chord: SDAW.parseChord(c.name) })).filter(c => c.chord);
    if (!changes.length) return notes;
    const segments = [{ at: 0, chord: context.chord }, ...changes];
    const out = [];
    notes.forEach(note => {
      const end = Math.min(B, note.at + note.dur);
      const cuts = [note.at, ...changes.map(c => c.at).filter(at => at > note.at && at < end), end];
      let previous;
      for (let i = 0; i < cuts.length - 1; i++) {
        const at = cuts[i], dur = cuts[i + 1] - at;
        const active = segments.findLast(c => c.at <= at);
        let pitch = note.pitch;
        if (active.at > 0) {
          const pcs = active.chord.intervals.map(n => (n + active.chord.root) % 12);
          const tones = note.voice === 2 || dur >= context.beat
            ? pcs : helpers.barScale(context.mode, context.key, pcs);
          pitch = helpers.nearest(pitch, tones, context.low, context.high);
        }
        if (previous && previous.pitch === pitch && previous.at + previous.dur === at) {
          previous.dur += dur;
        } else {
          const next = { ...note, at, dur, pitch, tech: { ...note.tech } };
          if (pitch !== note.pitch) { delete next.string; delete next.fret; }
          out.push(next); previous = next;
        }
      }
    });
    return out;
  };

})(window.SDAW);
