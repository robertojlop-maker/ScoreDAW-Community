(function (D) {
  'use strict';
  const library = D.styleData.artists;
  const heroes = D.legends.HEROES;
  // Each phrase mixes original guitar gestures with rhythm and interval statistics.
  const gesture = (name, beats, options = {}) => [name, beats, options];
  function guitarist(id, data, name, tag, scales, moves, techniques) {
    const [first, second, climax] = moves;
    heroes[id] = Object.assign({
      name, data, tag, scale: scales, run: scales, vib: 'vib', fit: true,
      bend: .35, slide: .3, legato: .4,
      sig: [[gesture('dna', 16)], [first, second], [gesture('cell', 8), second]],
      peak: [[climax], [first, second]],
      fill: [[second], [gesture('dna', 8)]]
    }, techniques);
  }
  const rock = { major: 'mixo', minor: 'aeolian' };
  const jazz = { major: 'ionian', minor: 'harmMin' };
  guitarist('nuno', 'extreme', 'Nuno Bettencourt', 'Syncopated funk-metal, tapped accents, muted attacks and acoustic fingerpicking', rock,
    [gesture('tap', 8, { walk: 1 }), gesture('ds', 8, { kind: 'stabs' }), gesture('run', 16, { fast: 1, g: 4, dir: -1 })], { legato: .65 });
  guitarist('paulgilbert', 'paulgilbert', 'Paul Gilbert', 'Alternate-picked sequences, string crossing and pedal figures', rock,
    [gesture('pedal', 8), gesture('run', 8, { g: 3, dir: -1 }), gesture('run', 16, { fast: 1, g: 4, dir: 1 })], { legato: .25 });
  guitarist('adriansmith', 'ironmaiden', 'Adrian Smith', 'Melodic minor-key solos, sustained bends and harmonized thirds', jazz,
    [gesture('ds', 8, { kind: 'thirds' }), gesture('hold', 8, { bend: 1 }), gesture('run', 16, { fast: 1, g: 3 })]);
  guitarist('davemurray', 'ironmaiden', 'Dave Murray', 'Flowing legato and high-register melodic runs', rock,
    [gesture('run', 8, { leg: 1, dir: 1 }), gesture('hold', 8, { high: 1 }), gesture('run', 16, { leg: 1, fast: 1, dir: -1 })], { legato: .85 });
  guitarist('ericjohnson', 'ericjohnson', 'Eric Johnson', 'Pentatonic groups of five, wide intervals and clear arpeggios',
    { major: 'majPent', minor: 'minPent' },
    [gesture('arp', 8), gesture('run', 8, { g: 5, dir: -1 }), gesture('run', 16, { fast: 1, g: 5, dir: -1 })], { legato: .55 });
  guitarist('bireli', 'bireli', 'Biréli Lagrène', 'Gypsy-jazz chord-tone runs, chromatic approaches and arpeggios', jazz,
    [gesture('sweep', 8), gesture('chrom', 8), gesture('run', 16, { scale: 1, fast: 1, dir: 1 })], { bend: 0 });
  guitarist('jimmypage', 'ledzeppelin', 'Jimmy Page', 'Blues-box bends, double stops and ringing arpeggios',
    { major: 'majBlues', minor: 'blues' },
    [gesture('ds', 8, { kind: 'sixths' }), gesture('hold', 8, { bend: 1 }), gesture('run', 16, { t8: 1, fast: 1 })], { bend: .65 });
  guitarist('kirkhammett', 'metallica', 'Kirk Hammett', 'Pentatonic sequences, expressive bends and fast minor-scale runs',
    { major: 'majPent', minor: 'blues' },
    [gesture('run', 8, { g: 4, dir: -1 }), gesture('hold', 8, { high: 1, bend: 1 }), gesture('run', 16, { fast: 1, dir: 1 })], { bend: .65 });
  guitarist('jameshetfield', 'metallica', 'James Hetfield', 'Muted pedal notes, open accents and melodic harmony lines', rock,
    [gesture('pedal', 8), gesture('ds', 8, { kind: 'thirds' }), gesture('run', 16, { g: 4, dir: -1 })]);
  guitarist('pacodelucia', 'pacodelucia', 'Paco de Lucía', 'Picado runs, nylon arpeggios, tremolo and Phrygian cadences', jazz,
    [gesture('arp', 8), gesture('trem', 8), gesture('run', 16, { scale: 1, fast: 1, dir: -1 })], { bend: 0, legato: .65 });
  heroes.django.data = 'django';
  heroes.rjohnson.data = 'robertjohnson';

  const commonPlays = ['mix', 'bandriff', 'power', 'arp', 'strum'];
  const structure = {
    Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Outro:4',
    Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Chorus:8 Outro:4',
    Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Outro:8'
  };
  function add(id, baseName, leadIds, config) {
    const data = library[id], base = D.STYLES[baseName];
    const mode = config.mode || (data.minor > .5 ? 'minor' : 'major');
    const tracks = base.tracks.filter(t => !config.roles || config.roles.includes(t.role));
    const rhythm = tracks.find(t => t.role === 'strum' || t.role === 'arp');
    const lead = tracks.find(t => t.lead);
    const styleTracks = tracks.map(t => {
      if (t.role === 'bass' && config.learnBass) return Object.assign({}, t, { play: 'style', plays: ['style', 'walking', 'roots'] });
      if (t === lead) return Object.assign({}, t, { on: true, in: { intro: .5, verse: .5, chorus: .5, solo: 1, outro: .5 }, mel: {
        fast: config.fast !== false, slides: true, vibrato: true, bends: heroes[leadIds[0]].bend > 0,
        harmonics: !config.acoustic, complex: true, triplets: true, modes: true
      } }, config.acoustic ? { inst: config.acoustic, fx: 'Room' } : {});
      if (t === rhythm) return Object.assign({}, t, {
        on: true, play: 'mix', mixPool: undefined, plays: [...new Set(commonPlays.concat(Object.values(config.mix)))],
        mix: config.mix, riffs: config.riffs
      }, config.acoustic ? { inst: config.acoustic, fx: 'Room' } : {});
      if (t.id === 'rhythm2' && config.double) return Object.assign({}, t, { on: true, in: { intro: 0, verse: .5, chorus: 1, solo: 1, bridge: .5, outro: 1 } });
      return t;
    });
    const progs = (config.harmony || []).map(([m, use, c]) => ({ n: c, m, use, c }));
    const def = Object.assign({}, base, {
      band: id, reference: id, family: '🎸 Bands', types: undefined,
      mode, tempo: data.tempo, minor: data.minor, tracks: styleTracks, structures: Object.assign({}, structure, config.form),
      desc: config.desc, progs: progs.concat(base.progs), vocal: config.vocal,
      melody: Object.assign({}, base.melody, { heroes: leadIds, licks: undefined }),
      leadPlan: { intro: 'melody', verse: 'fills', chorus: 'melody', solo: 'solo' },
      preferAuthoredHarmony: !!config.harmony
    });
    D.STYLES[data.name] = def;
    D.BANDS[id] = data.name;
  }
  const steel = 'Acoustic Guitar - Steel', nylon = 'Classical Guitar - Nylon';
  const singer = { gender: 'male', range: [52, 73], voices: 1, choir: ['harmony', 'oohs'], cells: 'rock', scoop: .2, lift: 4 };
  const combo = ['strum','arp','bass','melody'];
  add('extreme', 'Rock', ['nuno'], {
    desc: 'Funk-metal syncopation and muted riffs, open choruses and a separate acoustic ballad arrangement.',
    double: true, vocal: singer,
    mix: { intro: 'bandriff', verse: 'funkline', chorus: 'bandriff', bridge: 'arpriff', solo: 'power' },
    riffs: { intro: ['0:c:2a 3:0:1x 6:0:2p 9:5:1h 11:c:2a 14:7:2s'], chorus: ['0:C:4 6:c:2a 9:0:1x 12:0=0.7.12.14:4r'] }
  });
  const extreme = D.STYLES.Extreme;
  extreme.types = {
    funkmetal: { n: 'Funk metal' },
    acoustic: { n: 'Acoustic ballad', set: { tempo: [68, 100, 80], mode: 'major', vocal: singer },
      tracks: {
        rhythm: { inst: steel, fx: 'Room', plays: ['mix', 'arp', 'strum'], mix: { intro: 'arp', verse: 'arp', chorus: 'strum', bridge: 'arp', solo: 'strum' } },
        rhythm2: { on: false }, drums: { in: { intro: 0, verse: 0, chorus: .5, bridge: .5, solo: .5 } },
        bass: { in: { intro: 0, verse: .5 } },
        lead: { inst: steel, fx: 'Room', mel: { bends: false, fast: false, slides: true, harmonics: true, vibrato: true } }
      } }
  };
  add('paulgilbert', 'Metal', ['paulgilbert'], {
    desc: 'Instrumental picked sequences, low pedal notes and syncopated stop-and-start riffs.',
    mix: { intro: 'bandriff', verse: 'pedal', chorus: 'power', bridge: 'arpriff', solo: 'bandriff' },
    riffs: { intro: ['0:0:2p 2:7:1 3:0:1p 4:5:2 6:0:2p 8:10:2 10:7:2 12:5:2 14:c:2a'] }
  });
  add('ironmaiden', 'Metal', ['adriansmith','davemurray'], {
    desc: 'Galloping bass and guitars, minor-key riffs, harmonized lines and extended solos.', double: true, vocal: singer,
    mix: { intro: 'bandriff', verse: 'gallop', chorus: 'power', bridge: 'arpriff', solo: 'gallop' },
    riffs: { intro: ['0:0=0.7.12:2 2:0:1p 3:0:1p 4:3=0.7:2 6:0:1p 7:0:1p 8:5=0.7:4 12:c:4'] },
    form: { Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Outro:4' }
  });
  add('ericjohnson', 'Rock', ['ericjohnson'], {
    desc: 'Instrumental melodic rock, open clean voicings, pentatonic sequences and legato lead.',
    mix: { intro: 'arpriff', verse: 'bandriff', chorus: 'strum', bridge: 'arp', solo: 'arpriff' },
    riffs: { verse: ['0:0=0.7.12.14:6r 6:7:2 8:12:2 10:14:2 12:T:4r'] }
  });
  add('robertjohnson', 'Blues', ['rjohnson'], {
    desc: 'Delta blues with alternating thumb bass, sliding sixths and turnaround phrases on acoustic guitar.',
    roles: ['strum','melody'], acoustic: steel, fast: false, vocal: { gender: 'male', range: [48, 67], voices: 0, choir: [], cells: 'blues', scoop: .25, lift: 3 },
    mix: { intro: 'delta', verse: 'delta', chorus: 'delta', bridge: 'delta', solo: 'delta', outro: 'delta' },
    form: { Short: 'Intro:4 Verse:12 Solo:12 Outro:4', Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4', Extended: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Solo:12 Outro:4' }
  });
  const swingHarmony = [['major','verse chorus solo','I6 vi7 ii7 V7'], ['minor','verse solo','i6 iiø V7 i6'], ['major','bridge','iii7 VI7 ii7 V7']];
  add('bireli', 'Jazz', ['bireli'], {
    desc: 'Gypsy jazz with rhythm guitar, acoustic bass, chromatic approaches and arpeggio-led solos.',
    roles: combo, acoustic: steel, harmony: swingHarmony,
    mix: { intro: 'arp', verse: 'strum', chorus: 'strum', bridge: 'joepass', solo: 'strum' }
  });
  add('ledzeppelin', 'Rock', ['jimmypage'], {
    desc: 'Blues-rock riffs, ringing arpeggios and a contrast between sparse verses and full-band sections.', vocal: singer,
    mix: { intro: 'bandriff', verse: 'bassriff', chorus: 'bandriff', bridge: 'arpriff', solo: 'stabs' },
    riffs: { intro: ['0:c:3 3:3:1h 4:5:2 7:7:1s 8:C:4a 13:5:1 14:3:2'], chorus: ['0:O:4r 6:c:2 8:5:2s 10:3:2 12:C:4a'] }
  });
  add('metallica', 'Metal', ['kirkhammett','jameshetfield'], {
    desc: 'Thrash riffs, tight palm muting, melodic harmony and a quiet arpeggiated bridge.', double: true, vocal: singer,
    mix: { intro: 'bandriff', verse: 'bandriff', chorus: 'power', bridge: 'arpriff', solo: 'pedal' },
    riffs: { intro: ['0:C:2a 2:0:1p 3:0:1p 4:0:1p 5:0:1p 6:c+1:2a 8:0:1p 9:0:1p 10:c+3:2a 12:c+1:2 14:c:2'], verse: ['0:0:2p 2:0:1p 3:0:1p 4:c:2a 6:0:1p 7:0:1p 8:0:2p 10:c+6:2a 12:c+5:2 14:c+3:2'] }
  });
  add('pacodelucia', 'Bolero', ['pacodelucia'], {
    desc: 'Instrumental flamenco guitar with nylon strings, picado and Andalusian cadences in the current four-beat engine.',
    mode: 'minor', roles: ['strum','melody'], acoustic: nylon,
    harmony: [['minor','verse chorus solo','i bVII bVI V7'], ['minor','bridge','iv i bII V7']],
    mix: { intro: 'arp', verse: 'bandriff', chorus: 'strum', bridge: 'arp', solo: 'strum' },
    riffs: { verse: ['0:O:3a 3:T:1a 4:O:2a 7:7:1 8:O:3a 11:T:1a 12:O:4r'] }
  });
  add('django', 'Jazz', ['django'], {
    desc: 'Gypsy swing with pulse chords, walking bass, diminished arpeggios and chromatic solo lines.',
    roles: combo, acoustic: steel, learnBass: true, harmony: swingHarmony,
    mix: { intro: 'arp', verse: 'strum', chorus: 'strum', bridge: 'arp', solo: 'strum' }
  });
})(window.SDAW);
