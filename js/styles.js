/* =============================================================================
 *  STYLES.JS — the library of musical genres (data only)
 *  -----------------------------------------------------------------------------
 *  Every genre describes how a real band plays it:
 *    tempo / swing     feel of the genre (swing 0..1 = how late the off-beats are)
 *    structures        song forms (Short / Standard / Extended) "Name:bars …"
 *    progs             a library of chord progressions in roman numerals,
 *                      tagged with the sections where they are used
 *                         "I IV V IV"     one chord per bar
 *                         "I-IV V-IV"     two chords per bar (half bar each)
 *                         lowercase = minor, 7 maj7 m7 ø (m7b5) o (dim) 9 13 sus4…
 *    tracks            the instruments of the band, each with:
 *                         role   drums | bass | harmony | strum | arp | melody | horns | horn2 | counter
 *                         inst   instrument (see SONGGEN INSTRUMENTS), alt = alternatives
 *                         kit    percussion kit (drum tracks) and pat = rhythm per section
 *                         play   how it plays (chords, arp, montuno, strum, power, walking…)
 *                         plays  the options offered in the Full Song panel
 *                         p      patterns per play and section (see songgen.js for the format)
 *                         in     participation per section: 0 silent · .5 sparse / answers · 1 full
 *                         fx     effect chain (SONGGEN FX), vol, pan
 *                         mel    melody habits of the genre for this instrument
 *    melody            scales per section (always = genre sound, else only with "Mix modes")
 *
 *  DRUM PATTERN STRINGS (16 = 1 bar, 32 = 2 bars, one char per 16th note)
 *    X = accent  x = normal  o = soft  - = ghost  . = rest
 *  Positions: 0 = beat 1, 2 = "and", 4 = beat 2, 8 = beat 3, 12 = beat 4.
 *  Section keys: intro verse pre chorus bridge solo outro fill (missing → verse / chorus)
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const STYLES = {};
  SDAW.STYLES = STYLES;

  /** Helper: a track of a genre */
  function T(id, name, role, inst, o) { return Object.assign({ id, name, role, inst, on: true, vol: 0.75, pan: 0 }, o || {}); }
  /** Helper: participation string → object  ("verse:.5 bridge:0") */
  function IN(str) { const o = {}; (str || '').split(/\s+/).filter(Boolean).forEach(kv => { const [k, v] = kv.split(':'); o[k] = parseFloat(v); }); return o; }
  /** Helper: progression */
  function P(n, mode, use, c) { return { n, m: mode, use, c }; }

  /* ================================================================== POP == */
  STYLES['Pop'] = {
    family: 'Pop / Rock', desc: 'Bright, catchy and simple: four-chord loops, backbeat, acoustic strum and piano.',
    tempo: [96, 124, 110], swing: 0, grid: 8, key: { major: 'C', minor: 'A' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:8 Chorus:8 Chorus:8 Outro:4'
    },
    progs: [
      P('Axis I–V–vi–IV', 'major', 'verse chorus', 'I V vi IV'), P('Sensitive vi–IV–I–V', 'major', 'verse chorus bridge', 'vi IV I V'),
      P('50s I–vi–IV–V', 'major', 'verse chorus', 'I vi IV V'), P('I–IV–vi–V', 'major', 'verse chorus', 'I IV vi V'),
      P('IV–I–V–vi', 'major', 'chorus', 'IV I V vi'), P('I–iii–IV–V', 'major', 'verse', 'I iii IV V'),
      P('Pre: ii–IV–V', 'major', 'pre', 'ii IV ii V'), P('Pre: IV–V', 'major', 'pre', 'IV V IV V'),
      P('Bridge: vi–IV–I–V', 'major', 'bridge', 'vi IV I V'), P('Bridge: IV–V–iii–vi', 'major', 'bridge', 'IV V iii vi'),
      P('Royal road IV–V–iii–vi', 'major', 'verse chorus', 'IV V iii vi'),
      P('Minor i–bVI–bIII–bVII', 'minor', 'verse chorus', 'i bVI bIII bVII'), P('Minor i–iv–bVI–bVII', 'minor', 'verse chorus', 'i iv bVI bVII'),
      P('Minor bVI–bVII–i', 'minor', 'chorus bridge pre', 'bVI bVII i i'), P('Minor i–bVII–bVI–bVII', 'minor', 'verse', 'i bVII bVI bVII')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.8, in: IN('intro:.5'), pat: {
        intro: { kick: 'X.......X.......', hhc: 'o.o.o.o.o.o.o.o.' },
        verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X...X...X...X...', snare: '....X.......X.x.', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hhc: 'x...x...x...x...', hho: '..x...x...x...x.' },
        bridge: { kick: 'X.........x.....', snare: '........X.......', ride: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........X.x.x.x.', tom1: '............X.x.', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('shaker', 'Shaker', 'drums', 'Shaker', { kit: 'shaker', vol: 0.45, pan: 0.35, in: IN('intro:0 verse:0 pre:1 chorus:1 bridge:0 solo:1 outro:0'), pat: { verse: { hhc: 'xoxoxoxoxoxoxoxo' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', '8ths'], fx: 'Dry', vol: 0.85, p: { style: {
        intro: '0:R:8 8:5:8', verse: '0:R:3 3:R:1 6:R:2 8:R:3 11:R:1 14:5:2', pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2',
        chorus: '0:R:2 2:R:2 4:R:2 6:8:2 8:R:2 10:R:2 12:5:2 14:A:2', bridge: '0:R:6 6:5:2 8:R:8' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', play: 'mix', plays: ['mix', 'chords', 'arp', 'pad'], fx: 'Room', vol: 0.6,
        mix: { intro: 'arp', verse: 'arp', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { chords: { verse: '0:6 6:4 10:6', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', bridge: '0:8 8:8', intro: '0:16' }, arp: { verse: '0.1.2.3.2.1.2.3.' } } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', play: 'strum', plays: ['strum', 'arp', 'mix'], fx: 'Room', vol: 0.62, pan: -0.3, in: IN('intro:0'),
        p: { strum: { verse: 'D...D.U...U.D.U.', chorus: 'D.DU.UDUD.DU.UDU', bridge: 'D.......D.......' }, arp: { verse: '0.2.1.3.2.4.3.2.' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.45, in: IN('intro:0 verse:0 pre:1 chorus:1 bridge:1 solo:1 outro:.5') }),
      T('lead', 'Lead Melody', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Lead Clean (Delay)', vol: 0.72, pan: 0.15, lead: true, in: IN('intro:1') })
    ],
    melody: { heroes: ['harrison', 'knopfler', 'gilmour', 'santana'] }
  };

  /* ================================================================= ROCK == */
  STYLES['Rock'] = {
    family: 'Pop / Rock', desc: 'Power chords with distortion, straight 8th bass, big backbeat, pentatonic lead with bends.',
    tempo: [110, 150, 124], swing: 0, grid: 8, key: { major: 'E', minor: 'E' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro:4'
    },
    progs: [
      P('Mixolydian I–bVII–IV–I', 'major', 'verse chorus', 'I bVII IV I'), P('I–IV–V–IV', 'major', 'verse chorus solo', 'I IV V IV'),
      P('I–V–vi–IV', 'major', 'chorus', 'I V vi IV'), P('I–bIII–IV–I', 'major', 'verse', 'I bIII IV I'), P('I–IV–I–V', 'major', 'verse', 'I IV I V'),
      P('IV–V–I–I', 'major', 'pre chorus', 'IV V I I'), P('Pre: IV–V', 'major', 'pre', 'IV IV V V'), P('Bridge: vi–IV–V–V', 'major', 'bridge', 'vi IV V V'),
      P('bVI–bVII–I', 'major', 'chorus bridge solo', 'bVI bVII I I'),
      P('Minor i–bVI–bVII–i', 'minor', 'verse chorus', 'i bVI bVII i'), P('Minor i–bVII–bVI–bVII', 'minor', 'verse chorus solo', 'i bVII bVI bVII'),
      P('Minor i–iv–bVII–bIII', 'minor', 'verse', 'i iv bVII bIII'), P('Minor i–bIII–bVII–iv', 'minor', 'chorus', 'i bIII bVII iv'),
      P('Minor pre: bVI–bVII', 'minor', 'pre bridge', 'bVI bVI bVII bVII')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.85, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
        verse: { kick: 'X.....X.X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X.X.....X.X.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.x...x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        solo: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.' },
        bridge: { kick: 'X.......X.X.....', snare: '........X.......', tom1: '....x.......x...', ride: 'x...x...x...x...' },
        fill: { snare: '........XxXxXxXx', tom1: '............X.X.', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', 'roots', '8ths'], fx: 'Dry', vol: 0.85, p: { style: {
        intro: '0:R:4 4:R:4 8:R:4 12:R:4', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2',
        chorus: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'mix', plays: ['mix', 'power', 'pedal', 'vh', 'arpriff', 'octriff', 'hendrix', 'gallop', 'bassriff', 'stabs', 'berry', 'sus4', 'strum', 'arp'], fx: 'Rock Distortion (DS-1)', vol: 0.62, pan: -0.45,
        // riffs of the great rock guitarists (legends.js). mixPool: every idea (seed) picks one way per section,
        // so the accompaniment is not always the same 8ths: chords + bass-line riffs, stabs with space,
        // boogie, sus4 moves, picked arpeggios, pedal-tone riffs, triads over a pedal…
        mixPool: { intro: ['arpriff', 'bassriff', 'stabs'], verse: ['bassriff', 'stabs', 'pedal', 'berry', 'bassriff'], pre: ['power', 'sus4', 'stabs'], chorus: ['power', 'stabs', 'sus4'],
          bridge: ['arpriff', 'sus4', 'bassriff'], solo: ['vh', 'power', 'berry'], outro: ['power', 'stabs'] },
        mix: { intro: 'arpriff', verse: 'pedal', pre: 'power', chorus: 'power', bridge: 'arpriff', solo: 'vh', outro: 'power' },
        p: { power: { intro: 'O.......O.......', verse: 'P.P.P.P.P.P.P.P.', pre: 'O...O...O...O...', chorus: 'O.....O.O...O.P.', bridge: 'O...............', solo: 'O.P.O.P.O.P.O.P.' } } }),
      T('rhythm2', 'Rhythm Guitar 2', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', on: false, play: 'power', plays: ['power', 'arpriff', 'octriff', 'hendrix', 'vh', 'pedal', 'bassriff', 'stabs', 'berry', 'sus4', 'strum', 'arp'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.55, pan: 0.45,
        p: { power: { verse: 'O.......O.......', chorus: 'O.....O.O...O.P.' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4, in: IN('intro:0 verse:0 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.72, pan: 0.2, lead: true, in: IN('verse:.5 pre:.5'), mel: { bends: true, vibrato: true, slides: true } })
    ],
    // heroes: the guitar lead is played "in the style of" one of them (legends.js); the 🎲 seed picks who
    melody: { heroes: ['slash', 'vanhalen', 'satriani', 'hendrix', 'rhoads', 'zakk', 'harrison', 'morello', 'moore', 'clapton', 'gilmour', 'berry', 'vai', 'may', 'sambora', 'scholz', 'lizzy', 'gibbons'],
      scales: { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } }
  };

  /* ================================================================ BLUES == */
  STYLES['Blues'] = {
    family: 'Blues / Jazz', desc: '12-bar shuffle: swung 8ths, boogie bass, two-note shuffle guitar with light overdrive, blues-scale lead with bends.',
    tempo: [70, 120, 92], swing: 0.62, grid: 8, key: { major: 'E', minor: 'A' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:12 Verse:12 Outro:4',
      Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
      Extended: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Verse:12 Outro:4'
    },
    progs: [
      P('12-bar blues', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7'),
      P('12-bar quick change', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7'),
      P('12-bar with turnaround', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 VI7 ii7 V7 I7-IV7 I7-V7'),
      P('Jazz blues', 'major', 'solo verse', 'I7 IV7 I7 v7-I7 IV7 #ivo7 I7 VI7 ii7 V7 I7-VI7 ii7-V7'),
      P('8-bar blues', 'major', 'verse', 'I7 V7 IV7 IV7 I7 V7 I7 V7'),
      P('Minor blues', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7'),
      P('Minor blues (quick iv)', 'minor', 'verse solo', 'i7 iv7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7'),
      P('Intro: turnaround', 'major', 'intro', 'V7 IV7 I7 V7'), P('Minor intro', 'minor', 'intro', 'bVI7 V7 i7 V7'),
      P('Ending', 'major', 'outro', 'I7 IV7 I7 I7'), P('Minor ending', 'minor', 'outro', 'i7 iv7 i7 i7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.75, pat: {
        intro: { kick: 'X.......X.......', snare: '....x.......x...', ride: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.', hho: '' },
        solo: { kick: 'X.....x.X.....x.', snare: '....X.......X..o', ride: 'X.x.X.x.X.x.X.x.' },
        fill: { snare: '........x.x.X.x.', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'boogie', plays: ['boogie', 'walking', 'roots'], fx: 'Dry', vol: 0.85 }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'mix', plays: ['mix', 'shuffle', 'texas', 'delta', 'hendrix', 'berry', 'strum', 'arp'], fx: 'Blues Overdrive (BD-2)', vol: 0.55, pan: -0.35,
        // Delta thumb-bass + turnaround in the intro / outro, shuffle under the verses, Texas shuffle under the solos (legends.js)
        mix: { intro: 'delta', verse: 'shuffle', chorus: 'texas', solo: 'texas', bridge: 'shuffle', outro: 'delta' } }),
      T('piano', 'Piano', 'harmony', 'Upright Piano', { alt: 'keys', play: 'chords', plays: ['chords', 'pad'], fx: 'Room', vol: 0.5, pan: 0.3,
        p: { chords: { verse: '2:2 6:2 10:2 14:2', solo: '0:3 4:2 8:3 12:2', intro: '0:4 8:4' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4 }),
      T('harp', 'Harmonica', 'counter', 'Harmonica', { alt: 'lead', on: false, fx: 'Spring', vol: 0.55, in: IN('intro:0 verse:.5 solo:0 outro:0') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Blues Overdrive (BD-2)', vol: 0.72, pan: 0.2, lead: true, in: IN('verse:.5'), mel: { bends: true, vibrato: true, slides: true, triplets: true } })
    ],
    // licks: 'blues' = the lead is built from blues guitar licks (autogen.js → bluesLeadSection)
    // heroes: 'trad' = the classic lick engine of autogen.js; the others are played "in the style of" (legends.js)
    melody: { licks: 'blues', heroes: ['trad', 'bbking', 'albert', 'srv', 'rjohnson', 'moore', 'clapton', 'hendrix', 'gibbons'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: 'Blues', always: true } }
  };

  /* ================================================================= JAZZ == */
  STYLES['Jazz'] = {
    family: 'Blues / Jazz', desc: 'Swing quartet: ride cymbal, walking bass, rootless piano comping and a jazz guitar lead (Joe Pass, Wes, Benson…), ending on the big jazz final chord.',
    tempo: [110, 200, 150], swing: 0.66, grid: 8, key: { major: 'F', minor: 'C' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Head A:8 Head A:8 Outro:4',
      Standard: 'Intro:4 Head A:8 Head A:8 Bridge:8 Head A:8 Solo:16 Head A:8 Outro:4',
      Extended: 'Intro:4 Head A:8 Head A:8 Bridge:8 Head A:8 Solo:32 Head A:8 Bridge:8 Head A:8 Outro:4'
    },
    progs: [
      P('I–vi–ii–V', 'major', 'verse solo', 'Imaj7 vi7 ii7 V7'), P('ii–V–I', 'major', 'verse solo', 'ii7 V7 Imaj7 Imaj7'),
      P('Rhythm changes A', 'major', 'verse solo', 'Imaj7-vi7 ii7-V7 iii7-VI7 ii7-V7 Imaj7-I7 IVmaj7-ivm7 iii7-VI7 ii7-V7'),
      P('iii–VI–ii–V', 'major', 'verse solo', 'iii7 VI7 ii7 V7'), P('Autumn-style', 'major', 'verse', 'ii7 V7 Imaj7 IVmaj7 viiø III7 vi7 vi7'),
      P('Tritone sub', 'major', 'solo', 'ii7 bII7 Imaj7 VI7'),
      P('Bridge: rhythm changes', 'major', 'bridge', 'III7 III7 VI7 VI7 II7 II7 V7 V7'), P('Bridge: IV–iv', 'major', 'bridge', 'IVmaj7 ivm7 iii7 VI7 ii7 V7 Imaj7 Imaj7'),
      P('Minor ii–V–i', 'minor', 'verse solo', 'iiø V7 im7 im7'), P('Minor line cliché', 'minor', 'verse', 'im7 im7 iv7 iv7 iiø V7 im7 V7'),
      P('Minor bridge', 'minor', 'bridge', 'bVImaj7 bVImaj7 iiø V7'),
      P('Intro: I–vi–ii–V', 'major', 'intro', 'Imaj7-vi7 ii7-V7 Imaj7-vi7 ii7-V7'), P('Ending', 'major', 'outro', 'ii7 V7 Imaj7 Imaj7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.62, pat: {
        intro: { ride: 'x...x.x.x...x.x.', hhc: '....x.......x...' },
        verse: { ride: 'X...X.x.X...X.x.', hhc: '....x.......x...', kick: '-.......-.......', snare: '......-.......o.' },
        bridge: { ride: 'X...X.x.X...X.x.', hhc: '....x.......x...', snare: '..-.......-.o...' },
        solo: { ride: 'X...X.x.X...X.x.', hhc: '....x.......x...', kick: '-.....o.-.......', snare: '..-...o...-...o-' },
        fill: { snare: '........o.x.X.x.', tom1: '............x...', kick: '........X.......' } } }),
      T('bass', 'Upright Bass', 'bass', 'Upright Bass', { play: 'walking', plays: ['walking', 'roots'], fx: 'Room', vol: 0.9 }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', play: 'jazz', plays: ['jazz', 'chords', 'pad'], fx: 'Room', vol: 0.55, pan: -0.2 }),
      T('guitar', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', on: false, play: 'joepass', plays: ['joepass', 'chords', 'arp'], fx: 'Jazz Clean', vol: 0.45, pan: 0.3,
        p: { chords: { verse: '0:2 4:2 8:2 12:2' } } }),
      // the lead: a hollow-body jazz guitar (Guitar Rig) — the head, then the solo, in the style of a jazz guitarist
      T('lead', 'Jazz Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Jazz Clean', vol: 0.74, pan: 0.15, lead: true, mel: { hero: 'joepass', complex: true, fast: true, triplets: true, modes: true, slides: true, harmonics: true, bends: false, vibrato: true } }),
      // horns (off): the sax doubles the head of the guitar an octave up / the trumpet joins it (hard-bop unison)
      T('sax', 'Tenor Sax', 'counter', 'Tenor Sax', { alt: 'lead', on: false, leadOf: 'lead', fx: 'Brass Room', vol: 0.55, pan: -0.2, range: [50, 80], in: IN('intro:0 solo:0') }),
      T('trumpet', 'Trumpet', 'counter', 'Trumpet', { alt: 'lead', on: false, leadOf: 'lead', fx: 'Brass Room', vol: 0.5, pan: -0.25, range: [58, 86], in: IN('intro:0 solo:0') })
    ],
    // the end of a jazz song: one of the classic jazz endings (songgen.js → SG.JAZZ_ENDINGS)
    ending: 'jazz',
    // licks: 'jazz' = bebop engine (autogen.js → jazzLeadSection); octaves: counter horn doubles the head
    melody: { licks: 'jazz', octaves: true, heroes: ['joepass', 'wes', 'benson', 'martino', 'django', 'christian', 'trad'], scales: { solo: { major: 'Bebop Dominant', minor: 'Dorian' }, bridge: { major: 'Lydian', minor: 'Harmonic Minor' } } }
  };

  /* ================================================================= FUNK == */
  STYLES['Funk'] = {
    family: 'Groove', desc: '16th-note groove on one chord, ghost notes, slap bass, chicken-scratch guitar, clavinet and horn stabs.',
    tempo: [92, 118, 104], swing: 0.12, grid: 16, key: { major: 'E', minor: 'E' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Groove:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Groove:8 Chorus:8 Groove:8 Chorus:8 Bridge:8 Chorus:8 Outro:4',
      Extended: 'Intro:4 Groove:8 Chorus:8 Groove:8 Chorus:8 Bridge:8 Solo:8 Chorus:8 Chorus:8 Outro:4'
    },
    progs: [
      P('One-chord vamp i7', 'minor', 'verse solo', 'i7 i7 i7 i7'), P('Dorian i7–IV7', 'minor', 'verse chorus solo', 'i7 IV7 i7 IV7'),
      P('i7–iv7', 'minor', 'chorus', 'i7 i7 iv7 iv7'), P('i7–bVII7–bVI7–V7', 'minor', 'bridge', 'i7 bVII7 bVI7 V7'),
      P('Bridge iv7–V7', 'minor', 'bridge', 'iv7 iv7 V7 V7'), P('Chorus bVI7–bVII7', 'minor', 'chorus', 'bVI7 bVII7 i7 i7'),
      P('Dominant vamp I9', 'major', 'verse solo', 'I9 I9 I9 I9'), P('I9–IV9', 'major', 'verse chorus', 'I9 I9 IV9 IV9'),
      P('IV9–I9', 'major', 'chorus', 'IV9 IV9 I9 I9'), P('Bridge bVII9–IV9', 'major', 'bridge', 'bVII9 bVII9 IV9 V7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.82, pat: {
        intro: { kick: 'X..x..x...X..x..', hhc: 'x-x-x-x-x-x-x-x-' },
        verse: { kick: 'X..x..x...X..x..', snare: '....X..-.-..X..-', hhc: 'x-x-x-x-x-x-x-x-' },
        chorus: { kick: 'X..x..x...X.x..x', snare: '....X..-.-..X..-', hhc: 'x-x-x-x-x-x-x-x-', hho: '......x.......x.' },
        bridge: { kick: 'X.......X..x....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........x-x-XxXx', tom1: '............X...', tom2: '..............X.', kick: 'X..x....X.......' } } }),
      T('bass', 'Slap Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', 'roots'], fx: 'Funk (Comp + Clean)', vol: 0.85, p: { style: {
        intro: '0:R:2 3:8:1 6:R:1 10:R:2 14:5:2', verse: '0:R:2 3:8:1 6:R:1 7:R:1 10:b7:1 11:8:1 13:R:1 14:5:2',
        chorus: '0:R:1 2:8:1 3:R:1 6:R:1 8:b7:2 10:R:1 11:8:1 12:5:1 14:A:2', bridge: '0:R:3 6:R:1 8:R:3 14:A:2' } } }),
      T('guitar', 'Funk Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'mix', plays: ['mix', 'funk', 'funkline', 'hendrix', 'strum'], fx: 'Funk (Comp + Clean)', vol: 0.55, pan: -0.4,
        mix: { intro: 'funkline', verse: 'funkline', pre: 'funk', chorus: 'funk', bridge: 'hendrix', solo: 'funk', outro: 'funk' },
        p: { funk: { verse: 'x.xXx.x.x.xXx.x.', chorus: 'X.xxX.x.x.xXx.xX', bridge: 'X.......X.......' } } }),
      T('clav', 'Clavinet', 'harmony', 'Clavinet', { alt: 'keys', play: 'chords', plays: ['chords', 'pad'], fx: 'Funk (Comp + Clean)', vol: 0.45, pan: 0.4,
        p: { chords: { verse: '0:1 3:1 6:1 10:1 12:1 14:1', chorus: '0:1 2:1 6:1 8:1 11:1 14:2' } } }),
      T('ep', 'Electric Piano', 'harmony', 'Electric Piano', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Synth Wide', vol: 0.4, in: IN('verse:0 intro:0') }),
      T('horns', 'Horns (Trumpet)', 'horns', 'Trumpet', { alt: 'lead', play: 'riffs', plays: ['riffs', 'answers'], fx: 'Brass Room', vol: 0.62, pan: 0.2, in: IN('intro:0 verse:0 chorus:1 bridge:.5 solo:1 outro:1') }),
      T('sax', 'Horns (Sax)', 'horn2', 'Alto Sax', { alt: 'lead', leadOf: 'horns', play: 'harmony', plays: ['harmony', 'unison'], fx: 'Brass Room', vol: 0.55, pan: -0.2, in: IN('intro:0 verse:0 chorus:1 bridge:.5 solo:1 outro:1') }),
      T('lead', 'Lead Synth', 'melody', 'Square Lead', { alt: 'lead', on: false, fx: 'Synth Wide', vol: 0.6, lead: true, in: IN('chorus:.5') })
    ],
    melody: { heroes: ['hendrix', 'morello', 'santana'], scales: { all: { major: 'Mixolydian', minor: 'Dorian' }, solo: { major: 'Major Blues', minor: 'Minor Pentatonic' }, always: true } }
  };

  /* =============================================================== BALLAD == */
  STYLES['Ballad'] = {
    family: 'Pop / Rock', desc: 'Slow and emotional: arpeggiated piano, soft drums with side-stick, strings swelling in the chorus.',
    tempo: [60, 84, 70], swing: 0, grid: 8, key: { major: 'D', minor: 'B' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Chorus:8 Outro:4',
      Extended: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Chorus:8 Outro:4'
    },
    progs: [
      P('Canon (8 bars)', 'major', 'verse chorus', 'I V vi iii IV I IV V'), P('I–V–vi–IV', 'major', 'verse chorus', 'I V vi IV'),
      P('I–vi–IV–V', 'major', 'verse', 'I vi IV V'), P('vi–IV–I–V', 'major', 'chorus bridge', 'vi IV I V'),
      P('I–iii–vi–IV', 'major', 'verse', 'I iii vi IV'), P('IV–V–iii–vi', 'major', 'bridge chorus', 'IV V iii vi'),
      P('I–Imaj7–IV–iv', 'major', 'verse bridge', 'I Imaj7 IV iv'), P('Bridge ii–IV–V', 'major', 'bridge', 'ii ii IV V'),
      P('Minor i–bVI–bIII–bVII', 'minor', 'verse chorus', 'i bVI bIII bVII'), P('Minor i–iv–bVII–bIII', 'minor', 'verse', 'i iv bVII bIII'),
      P('Minor bVI–bVII–i', 'minor', 'chorus bridge', 'bVI bVII i i')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.62, in: IN('intro:0 verse:.5'), pat: {
        verse: { kick: 'X.......X.......', perc: '....x.......x...', hhc: 'x...x...x...x...' },
        chorus: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '............x.x.', tom1: '........x.x.....', tom2: '..............X.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.8, in: IN('intro:0'), p: { style: {
        verse: '0:R:12 12:5:4', chorus: '0:R:6 6:R:2 8:R:6 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', play: 'mix', plays: ['mix', 'arp', 'chords', 'pad'], fx: 'Ballad Hall', vol: 0.65,
        mix: { intro: 'arp', verse: 'arp', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { verse: '0.1.2.3.2.1.2.1.' }, chords: { chorus: '0:4 4:4 8:4 12:4', verse: '0:8 8:8' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Ballad Hall', vol: 0.5, in: IN('intro:0 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('aguitar', 'Acoustic Guitar', 'arp', 'Classical Guitar - Nylon', { alt: 'guitar', on: false, play: 'arp', plays: ['arp', 'strum'], fx: 'Room', vol: 0.5, pan: -0.3,
        p: { arp: { verse: '0.2.1.3.2.4.3.2.' } } }),
      T('lead', 'Lead Melody', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Ballad Hall', vol: 0.7, pan: 0.15, lead: true, in: IN('intro:1'), mel: { vibrato: true, slides: true } })
    ],
    melody: { heroes: ['moore', 'gilmour', 'slash', 'santana', 'harrison', 'knopfler', 'may', 'sambora'] }
  };

  /* ============================================================== COUNTRY == */
  STYLES['Country'] = {
    family: 'Pop / Rock', desc: 'Train beat, alternating root–fifth bass, boom-chick acoustic, twangy Telecaster and fiddle.',
    tempo: [96, 140, 116], swing: 0.18, grid: 8, key: { major: 'G', minor: 'E' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Bridge:8 Chorus:8 Outro:4'
    },
    progs: [
      P('I–IV–I–V', 'major', 'verse chorus solo', 'I IV I V'), P('I–IV–V–I', 'major', 'verse chorus', 'I IV V I'),
      P('I–V–vi–IV', 'major', 'chorus', 'I V vi IV'), P('I–I–IV–IV–V–V–I–I', 'major', 'verse solo', 'I I IV IV V V I I'),
      P('I–vi–IV–V', 'major', 'verse', 'I vi IV V'), P('IV–I–V–I', 'major', 'chorus', 'IV I V I'),
      P('Bridge vi–IV–I–V', 'major', 'bridge', 'vi IV I V'), P('Bridge IV–V–vi–V', 'major', 'bridge', 'IV V vi V'),
      P('Minor i–bVII–bVI–V', 'minor', 'verse chorus', 'i bVII bVI V')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.7, pat: {
        intro: { kick: 'X.......X.......', snare: 'o.o.X.o.o.o.X.o.' },
        verse: { kick: 'X.......X.......', snare: '....x.......x...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.......', snare: 'o.o.X.o.o.o.X.o.', hho: '..............x.' },
        solo: { kick: 'X.......X.......', snare: 'o.o.X.o.o.o.X.o.', ride: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........x.x.x.x.', tom1: '............X...', tom2: '..............X.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', 'walking'], fx: 'Dry', vol: 0.85, p: { style: {
        verse: '0:R:4 8:5:4', chorus: '0:R:3 4:5:3 8:R:3 12:5:2 14:A:2', intro: '0:R:8 8:5:8' } } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', play: 'boomchick', plays: ['boomchick', 'strum', 'arp'], fx: 'Room', vol: 0.6, pan: -0.35,
        p: { boomchick: { verse: 'B...D.U.b...D.U.', chorus: 'B.U.D.U.b.U.D.U.' } } }),
      T('piano', 'Honky-Tonk Piano', 'harmony', 'Upright Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'arp'], fx: 'Room', vol: 0.45, pan: 0.3,
        p: { chords: { verse: '2:2 6:2 10:2 14:2' } } }),
      T('fiddle', 'Fiddle', 'counter', 'Fiddle', { alt: 'lead', fx: 'Room', vol: 0.5, pan: 0.35, in: IN('intro:1 verse:.5 chorus:.5 solo:0 outro:1'), mel: { slides: true, vibrato: true } }),
      T('lead', 'Telecaster', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Country Twang', vol: 0.72, pan: 0.15, lead: true, in: IN('verse:.5'), mel: { bends: true, slides: true } })
    ],
    melody: { heroes: ['chicken', 'chicken', 'knopfler'], scales: { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } }
  };

  /* =============================================================== REGGAE == */
  STYLES['Reggae'] = {
    family: 'Groove', desc: 'One-drop drums (kick and rim on beat 3), deep melodic bass, guitar skank on 2 and 4, organ bubble.',
    tempo: [66, 90, 76], swing: 0.2, grid: 8, key: { major: 'G', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Dub:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Dub:8 Solo:8 Chorus:8 Outro:4'
    },
    progs: [
      P('I–IV', 'major', 'verse chorus', 'I IV I IV'), P('I–IV–I–V', 'major', 'verse chorus', 'I IV I V'), P('I–V–vi–IV', 'major', 'chorus', 'I V vi IV'),
      P('ii–V', 'major', 'verse', 'ii V ii V'), P('I–vi–IV–V', 'major', 'chorus', 'I vi IV V'),
      P('i–iv', 'minor', 'verse chorus solo', 'i iv i iv'), P('i–bVII', 'minor', 'verse dub', 'i bVII i bVII'),
      P('i–bVI–bVII–i', 'minor', 'chorus', 'i bVI bVII i'), P('iv–v–i', 'minor', 'bridge chorus', 'iv v i i')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.75, pat: {
        intro: { kick: '........X.......', perc: '........X.......', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: '........X.......', perc: '........X.......', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x.x.x.x.x.x.x.x.', hho: '..x...x...x...x.' },
        bridge: { kick: '........X.......', perc: '........X.......', hhc: 'x...x...x...x...' },
        fill: { snare: '........x..xx..X', tom1: '..........x.....', tom2: '.............x..' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.95, p: { style: {
        verse: '0:R:3 3:R:1 6:5:2 8:R:2 12:3:2 14:5:2', chorus: '0:R:4 6:R:2 8:5:3 12:8:2 14:5:2', bridge: '2:R:4 8:R:2 12:5:4' } } }),
      T('guitar', 'Skank Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'chords', plays: ['chords', 'strum'], fx: 'Reggae Skank (Spring)', vol: 0.5, pan: -0.35,
        p: { chords: { verse: '4:1 12:1', chorus: '4:1 12:1', bridge: '12:1' } } }),
      T('organ', 'Organ (Bubble)', 'harmony', 'Organ', { alt: 'keys', play: 'chords', plays: ['chords', 'pad'], fx: 'Room', vol: 0.42, pan: 0.35,
        p: { chords: { verse: '2:1 3:1 6:1 7:1 10:1 11:1 14:1 15:1', bridge: '6:1 14:1' } } }),
      T('lead', 'Melodica', 'melody', 'Melodica', { alt: 'lead', fx: 'Dub Delay', vol: 0.62, pan: 0.15, lead: true, in: IN('verse:.5') })
    ],
    melody: {}
  };

  /* =============================================================== BOLERO == */
  STYLES['Bolero'] = {
    family: 'Latin', desc: 'Romantic Latin ballad: requinto guitar ornaments, nylon guitars, bongó martillo, maracas and claves.',
    tempo: [66, 92, 78], swing: 0, grid: 8, key: { major: 'D', minor: 'D' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Interlude:4 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Interlude:8 Verse:8 Chorus:8 Outro:4'
    },
    progs: [
      P('I–vi–ii–V', 'major', 'verse chorus', 'I vi ii V7'), P('Imaj7–vi7–ii7–V7', 'major', 'verse chorus', 'Imaj7 vi7 ii7 V7'),
      P('Imaj7–VI7–ii7–V7', 'major', 'chorus', 'Imaj7 VI7 ii7 V7'), P('I–I7–IV–iv', 'major', 'verse bridge', 'I I7 IV iv'),
      P('Bridge IV–iv–I–V7', 'major', 'bridge', 'IV iv I V7'),
      P('i–iv–V7–i', 'minor', 'verse chorus', 'i iv V7 i'), P('i–i–iv–V7', 'minor', 'verse', 'i i iv V7'),
      P('iø–V7–i (minor ii–V)', 'minor', 'chorus bridge', 'iiø V7 i i'), P('Andalusian i–bVII–bVI–V7', 'minor', 'intro bridge chorus', 'i bVII bVI V7'),
      P('i–iv–bVII–bIII–bVI–iiø–V7–i', 'minor', 'chorus', 'i iv bVII bIII bVI iiø V7 i')
    ],
    tracks: [
      T('bongo', 'Bongó', 'drums', 'Bongó', { kit: 'bongo', vol: 0.6, pan: 0.25, in: IN('intro:.5'), pat: {
        verse: { tom1: 'X.x.x.x.X.x.x.x.', tom2: '............x.x.' }, chorus: { tom1: 'X.x.x.x.X.x.x.x.', tom2: '......x.....x.x.' } } }),
      T('maracas', 'Maracas', 'drums', 'Maracas', { kit: 'maracas', vol: 0.4, pan: -0.3, pat: { verse: { hhc: 'x.x.x.x.x.x.x.x.' }, chorus: { hhc: 'xoxoxoxoxoxoxoxo' } } }),
      T('clave', 'Claves', 'drums', 'Claves', { kit: 'clave', vol: 0.4, pan: 0.4, in: IN('intro:0'), pat: { verse: { perc: 'X.....X.....X.......X...X.......' } } }),
      T('bass', 'Bass', 'bass', 'Upright Bass', { play: 'style', plays: ['style', 'roots'], fx: 'Room', vol: 0.85, p: { style: {
        verse: '0:R:6 6:5:2 8:R:4 12:5:4', intro: '0:R:8 8:5:8' } } }),
      T('guitar', 'Nylon Guitar', 'strum', 'Classical Guitar - Nylon', { alt: 'guitar', play: 'boomchick', plays: ['boomchick', 'arp', 'strum'], fx: 'Room', vol: 0.6, pan: -0.3,
        p: { boomchick: { verse: 'B.....D.D...D...' }, arp: { verse: '0..2.31.0..2.31.' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad'], fx: 'Hall', vol: 0.4, in: IN('intro:0 verse:0 chorus:1 bridge:1 outro:1') }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'arp', plays: ['arp', 'chords'], fx: 'Room', vol: 0.45 }),
      T('requinto', 'Requinto', 'melody', 'Classical Guitar - Nylon', { alt: 'lead', fx: 'Room', vol: 0.72, pan: 0.15, lead: true, in: IN('verse:.5 chorus:.5'), mel: { triplets: true, slides: true, harmonics: true, fast: true, vibrato: true } })
    ],
    melody: { scales: { all: { major: 'Major', minor: 'Harmonic Minor' }, always: true } }
  };

  /* ================================================================ SALSA == */
  STYLES['Salsa'] = {
    family: 'Latin', desc: 'Son clave 2-3: piano montuno, anticipated tumbao bass, congas, timbales (cáscara / campana), bongó, güiro, trumpets and trombones.',
    tempo: [168, 204, 184], swing: 0, grid: 8, key: { major: 'C', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:8 Verse:8 Coro (Montuno):8 Outro:4',
      Standard: 'Intro:8 Verse:16 Coro (Montuno):16 Mambo:8 Coro (Montuno):8 Outro:4',
      Extended: 'Intro:8 Verse:16 Verse:8 Coro (Montuno):16 Mambo:8 Coro (Montuno):16 Mambo:8 Coro (Montuno):8 Outro:4'
    },
    progs: [
      P('Montuno I-IV V-IV', 'major', 'chorus solo intro', 'I-IV V7-IV'), P('Montuno I IV V IV', 'major', 'chorus solo', 'I IV V7 IV'),
      P('Montuno ii-V I', 'major', 'chorus solo', 'ii7-V7 Imaj7-Imaj7'), P('Montuno IV-V I', 'major', 'chorus solo', 'IV-V7 I-I'),
      P('Verse I–vi–ii–V', 'major', 'verse', 'I vi ii V7'), P('Verse I–I–IV–V', 'major', 'verse', 'I I IV V7'),
      P('Verse Imaj7–VI7–ii7–V7', 'major', 'verse', 'Imaj7 VI7 ii7 V7'), P('Verse ii–V–I–VI', 'major', 'verse', 'ii7 V7 Imaj7 VI7'),
      P('Minor montuno i-iv V-i', 'minor', 'chorus solo intro', 'i-iv V7-i'), P('Minor montuno i-iv V-iv', 'minor', 'chorus solo', 'i-iv V7-iv'),
      P('Minor montuno iiø-V i', 'minor', 'chorus solo', 'iiø-V7 i-i'),
      P('Minor verse i–iv–V7–i', 'minor', 'verse', 'i iv V7 i'), P('Minor verse i–i–V7–V7', 'minor', 'verse', 'i i V7 V7'),
      P('Minor verse i–bVII–bVI–V7', 'minor', 'verse', 'i bVII bVI V7')
    ],
    tracks: [
      T('congas', 'Congas', 'drums', 'Congas', { kit: 'congas', vol: 0.62, pan: 0.3, pat: {
        intro: { hhc: 'o.o...o.o.o.....', perc: '....X...........', tom1: '............X.X.' },
        verse: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X...', tom2: '..............................X.' },
        chorus: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X.X.', tom2: '..............X...............X.' } } }),
      T('timbales', 'Timbales', 'drums', 'Timbales', { kit: 'timbales', vol: 0.55, pan: -0.25, pat: {
        intro: { perc: 'X...x.x...x...x.X...x...X.x...x.' },
        verse: { perc: 'X...x.x...x...x.X...x...X.x...x.' },
        chorus: { ride: 'X...x.x.X.x.x.x.X.x.x...X.x.x.x.', tom2: '..............X...............X.' },
        bridge: { perc: 'X...x.x...x...x.X...x...X.x...x.' },
        fill: { tom1: '........X.x.x.xx', tom2: '...............X' } } }),
      T('bongo', 'Bongó', 'drums', 'Bongó', { kit: 'bongo', vol: 0.5, pan: 0.5, pat: {
        verse: { tom1: 'X.o.x.o.X.o.x.o.', tom2: '..............X.' }, intro: { tom1: 'X.o.x.o.X.o.x.o.', tom2: '..............X.' },
        chorus: { perc: 'X...X.x.X...X.x.' } } }),
      T('clave', 'Clave 2-3', 'drums', 'Claves', { kit: 'clave', vol: 0.45, pan: -0.5, pat: { verse: { perc: '....X...X.......X.....X.....X...' } } }),
      T('guiro', 'Güiro', 'drums', 'Güiro', { kit: 'guiro', vol: 0.4, pan: 0.6, in: IN('intro:0'), pat: { verse: { hho: 'X.......X.......', hhc: '....x.x.....x.x.' } } }),
      T('bass', 'Baby Bass (Tumbao)', 'bass', 'Upright Bass', { play: 'tumbao', plays: ['tumbao', 'roots'], fx: 'Room', vol: 0.9, p: { tumbao: { verse: '6:R:6 12:N:4' } } }),
      T('piano', 'Piano (Montuno)', 'harmony', 'Grand Piano', { alt: 'keys', play: 'mix', plays: ['mix', 'montuno', 'montuno-light', 'chords'], fx: 'Room', vol: 0.5, pan: -0.15,
        // verse: light montuno under the singer · coro / mambo: full montuno
        mix: { intro: 'montuno', verse: 'montuno-light', chorus: 'montuno', solo: 'montuno', bridge: 'montuno-light', outro: 'montuno' },
        p: { montuno: { verse: 'A...A.B...B.A.N...B.A...A.B...N.' }, 'montuno-light': { verse: 'A.....B.....A.N...A...B.....A.N.' }, chords: { verse: '0:2 6:2 10:2 14:2:N' } } }),
      T('trumpet', 'Trumpets', 'horns', 'Trumpet', { alt: 'lead', play: 'riffs', plays: ['riffs', 'answers'], fx: 'Brass Room', vol: 0.62, pan: 0.15, range: [62, 84],
        in: IN('intro:1 verse:.5 chorus:.5 solo:1 bridge:.5 outro:1'), mel: { fast: true } }),
      T('trombone', 'Trombones', 'horn2', 'Trombone', { alt: 'lead', leadOf: 'trumpet', play: 'harmony', plays: ['harmony', 'unison'], fx: 'Brass Room', vol: 0.58, pan: -0.15, range: [50, 74],
        in: IN('intro:1 verse:.5 chorus:.5 solo:1 bridge:.5 outro:1') }),
      T('lead', 'Lead Melody (Flute)', 'melody', 'Flute', { alt: 'lead', fx: 'Room', vol: 0.62, pan: 0.1, lead: true, in: IN('intro:0 verse:1 chorus:1 solo:0 outro:0') })
    ],
    melody: { scales: { all: { major: 'Major', minor: 'Harmonic Minor' }, always: true } }
  };

  /* ============================================================= MERENGUE == */
  STYLES['Merengue'] = {
    family: 'Latin', desc: 'Fast güira, tambora with rim clicks, clean electric guitar ostinato, bass on 1 and 3 with pickups, sax riffs in the jaleo.',
    tempo: [130, 170, 152], swing: 0, grid: 8, key: { major: 'G', minor: 'E' }, mode: 'major',
    structures: {
      Short: 'Intro:8 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Jaleo:16 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:16 Chorus:8 Verse:8 Chorus:8 Jaleo:16 Jaleo:8 Chorus:8 Outro:4'
    },
    progs: [
      P('I–V7–V7–I', 'major', 'verse chorus', 'I V7 V7 I'), P('I–IV–V7–I', 'major', 'verse chorus', 'I IV V7 I'),
      P('I–I–V7–V7', 'major', 'verse', 'I I V7 V7'), P('I–IV–I–V7', 'major', 'chorus', 'I IV I V7'),
      P('Jaleo I-V7', 'major', 'solo intro', 'I-V7 I-V7'), P('Jaleo I–V7', 'major', 'solo', 'I V7 I V7'), P('Jaleo IV-V7-I', 'major', 'solo', 'IV-V7 I-I'),
      P('Minor i–iv–V7–i', 'minor', 'verse chorus', 'i iv V7 i'), P('Minor i–i–V7–V7', 'minor', 'verse', 'i i V7 V7'),
      P('Minor jaleo i-V7', 'minor', 'solo intro', 'i-V7 i-V7')
    ],
    tracks: [
      T('guira', 'Güira', 'drums', 'Güira', { kit: 'guira', vol: 0.5, pan: 0.4, pat: {
        verse: { hhc: 'X.xxX.xxX.xxX.xx' }, chorus: { hhc: 'X.xxX.xxX.xxX.xx' }, solo: { hhc: 'XxxxXxxxXxxxXxxx' }, intro: { hhc: 'X.x.X.x.X.x.X.x.' } } }),
      T('tambora', 'Tambora', 'drums', 'Tambora', { kit: 'tambora', vol: 0.62, pan: -0.2, pat: {
        verse: { tom2: 'X.......X.....x.', snare: '..x.x.x...x.x.x.', tom1: '....X.......X...' },
        solo: { tom2: 'X..X..X.X..X..X.', snare: 'xxx.xxx.xxx.xxx.', tom1: '....X.......X...' },
        fill: { snare: '........xxxxxxxx', tom2: '...............X' } } }),
      T('congas', 'Congas', 'drums', 'Congas', { kit: 'congas', vol: 0.45, pan: 0.25, in: IN('intro:0'), pat: {
        verse: { hhc: 'o.o.o.o.o.o.o.o.', tom1: '......X.......X.', tom2: '..............X.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        verse: '0:R:4 6:5:2 8:R:4 12:5:2 14:N:2', solo: '0:R:2 4:5:2 6:8:2 8:R:2 12:5:2 14:N:2' } } }),
      T('guitar', 'Electric Guitar (Clean)', 'arp', 'Electric Guitar - Clean', { alt: 'guitar', play: 'arp', plays: ['arp', 'strum'], fx: 'Clean + Chorus', vol: 0.5, pan: -0.4,
        p: { arp: { verse: '1.2.3.2.1.2.3.2.', solo: '1232123212321232', chorus: '1.2.3.2.1.2.3.2.' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', play: 'chords', plays: ['chords', 'arp', 'mix'], fx: 'Room', vol: 0.45, pan: 0.3,
        p: { chords: { verse: '2:2 6:2 10:2 14:2', solo: '0:1 2:2 6:2 8:1 10:2 14:2' } } }),
      T('sax', 'Alto Sax', 'horns', 'Alto Sax', { alt: 'lead', play: 'riffs', plays: ['riffs', 'answers'], fx: 'Brass Room', vol: 0.6, pan: 0.2,
        in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'), mel: { fast: true } }),
      T('sax2', 'Tenor Sax', 'horn2', 'Tenor Sax', { alt: 'lead', leadOf: 'sax', play: 'harmony', plays: ['harmony', 'unison'], fx: 'Brass Room', vol: 0.55, pan: -0.2,
        in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1') }),
      T('accordion', 'Accordion (Típico)', 'counter', 'Accordion', { alt: 'lead', on: false, fx: 'Room', vol: 0.55, in: IN('verse:.5 solo:1'), mel: { fast: true } }),
      T('lead', 'Lead Melody (Trumpet)', 'melody', 'Trumpet', { alt: 'lead', fx: 'Brass Room', vol: 0.62, lead: true, in: IN('intro:0 verse:1 chorus:1 solo:0 outro:0') })
    ],
    melody: {}
  };

  /* ============================================================== BACHATA == */
  STYLES['Bachata'] = {
    family: 'Latin', desc: 'Requinto runs, arpeggiated segunda guitar with chorus, syncopated bass, bongó martillo and güira; the mambo switches to campana.',
    tempo: [116, 140, 128], swing: 0, grid: 8, key: { major: 'A', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:8 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Mambo:8 Verse:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:16 Chorus:8 Mambo:8 Verse:16 Chorus:8 Mambo:8 Chorus:8 Outro:4'
    },
    progs: [
      P('i–iv–V7–i', 'minor', 'verse chorus', 'i iv V7 i'), P('Andalusian i–bVII–bVI–V7', 'minor', 'verse chorus intro solo', 'i bVII bVI V7'),
      P('i–iv–bVII–bIII', 'minor', 'chorus', 'i iv bVII bIII'), P('i–bVI–bIII–bVII', 'minor', 'chorus', 'i bVI bIII bVII'),
      P('Mambo i–iv–V7–i', 'minor', 'solo', 'i iv V7 i'), P('Mambo i-iv V7-i', 'minor', 'solo', 'i-iv V7-i'),
      P('I–IV–V7–IV', 'major', 'verse chorus', 'I IV V7 IV'), P('I–IV–I–V7', 'major', 'verse', 'I IV I V7'),
      P('vi–IV–I–V (modern)', 'major', 'chorus verse', 'vi IV I V'), P('I–vi–IV–V', 'major', 'verse chorus', 'I vi IV V'),
      P('Mambo I-IV V-I', 'major', 'solo', 'I-IV V7-I')
    ],
    tracks: [
      T('bongo', 'Bongó', 'drums', 'Bongó', { kit: 'bongo', vol: 0.58, pan: 0.3, pat: {
        intro: { tom1: 'X.x.X.x.X.x.X.x.' },
        verse: { tom1: 'X.x.X.x.X.x.X.x.', tom2: '..............X.' },
        chorus: { tom1: 'X.x.X.x.X.x.X.x.', tom2: '......X.......X.' },
        solo: { perc: 'X.x.X.x.X.x.X.x.' } } }),
      T('guira', 'Güira', 'drums', 'Güira', { kit: 'guira', vol: 0.45, pan: -0.35, pat: {
        intro: { hhc: 'X.x.X.x.X.x.X.x.' }, verse: { hhc: 'X.x.X.x.X.xxX.x.' }, chorus: { hhc: 'X.xxX.xxX.xxX.xx' }, solo: { hhc: 'XxxxXxxxXxxxXxxx' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.9, p: { style: {
        verse: '0:R:4 6:5:2 8:R:3 11:R:1 12:8:2 14:5:2', solo: '0:R:2 3:R:1 6:5:2 8:R:2 11:R:1 12:8:2 14:A:2', intro: '0:R:6 6:5:2 8:R:8' } } }),
      T('segunda', 'Segunda (Rhythm Guitar)', 'arp', 'Electric Guitar - Clean', { alt: 'guitar', play: 'arp', plays: ['arp', 'strum'], fx: 'Clean + Chorus', vol: 0.5, pan: -0.4,
        p: { arp: { verse: '0.2.3.2.1.2.3.2.', solo: '0323132303231323' } } }),
      T('requinto', 'Requinto', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Clean + Chorus', vol: 0.68, pan: 0.2, lead: true,
        in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'), mel: { fast: true, triplets: true, slides: true } }),
      T('lead', 'Lead Melody', 'counter', 'Alto Sax', { alt: 'lead', on: false, fx: 'Brass Room', vol: 0.55, in: IN('intro:0 verse:1 chorus:1 solo:0 outro:0') })
    ],
    melody: { scales: { all: { major: 'Major', minor: 'Harmonic Minor' }, always: true } }
  };

  /* ============================================================ REGGAETON == */
  STYLES['Reggaeton'] = {
    family: 'Urban', desc: 'Dembow: four-on-the-floor kick with the 3-3-2 snare, 808 bass, dark pads, plucks and a short synth hook.',
    tempo: [86, 100, 92], swing: 0, grid: 16, key: { major: 'C', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Chorus:8 Outro:4'
    },
    progs: [
      P('i–bVI–bIII–bVII', 'minor', 'verse chorus', 'i bVI bIII bVII'), P('i–bVII–bVI–bVII', 'minor', 'verse chorus', 'i bVII bVI bVII'),
      P('i–iv–bVII–bIII', 'minor', 'verse', 'i iv bVII bIII'), P('i–bVI–bVII–i', 'minor', 'chorus', 'i bVI bVII i'),
      P('i–iv–v–i', 'minor', 'bridge', 'i iv v i'), P('bVI–bVII–i–i', 'minor', 'pre bridge', 'bVI bVII i i'),
      P('vi–IV–I–V', 'major', 'verse chorus', 'vi IV I V'), P('I–V–vi–IV', 'major', 'chorus', 'I V vi IV'), P('IV–V–vi–vi', 'major', 'pre bridge', 'IV V vi vi')
    ],
    tracks: [
      T('drums', 'Drums (Dembow)', 'drums', '808 Kit', { kit: 'set808', vol: 0.82, pat: {
        intro: { kick: 'X...............', snare: '...x..x....x..x.', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X...X...X...X...', snare: '...X..X....X..X.', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X...X...X...X...', snare: '...X..X....X..X.', hhc: 'x.x.x.x.x.x.x.x.', clap: '....X.......X...' },
        chorus: { kick: 'X...X...X...X...', snare: '...X..X....X..X.', clap: '...X..X....X..X.', hhc: 'x-x-x-x-x-x-x-x-' },
        bridge: { kick: 'X.......X.......', snare: '...x..x....x..x.', hhc: 'x...x...x...x...' },
        fill: { tom1: '............x.xx', tom2: '..............xx', snare: '........x.x.x...' } } }),
      T('bass', '808 Bass', 'bass', '808 Bass', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.9, p: { style: {
        verse: '0:R:4 6:R:2 8:R:4 14:5:2', chorus: '0:R:3 3:R:3 6:R:2 8:R:3 11:R:3 14:5:2', intro: '0:R:16' } } }),
      T('pad', 'Synth Pad', 'harmony', 'Soft Pad', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Synth Wide', vol: 0.4, in: IN('verse:.5') }),
      T('pluck', 'Pluck', 'arp', 'Pluck', { alt: 'keys', play: 'arp', plays: ['arp', 'chords'], fx: 'Synth Wide', vol: 0.45, pan: 0.3, in: IN('intro:1 verse:1 chorus:1 bridge:0'),
        p: { arp: { verse: '0..1..2.0..1..2.' } } }),
      T('lead', 'Synth Hook', 'melody', 'Saw Lead', { alt: 'lead', fx: 'Synth Wide', vol: 0.58, pan: 0.1, lead: true, in: IN('verse:.5') })
    ],
    melody: { scales: { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, chorus: { major: 'Major', minor: 'Natural Minor' }, always: true } }
  };

  /* =============================================================== CUMBIA == */
  STYLES['Cumbia'] = {
    family: 'Latin', desc: 'Güiro "chiqui-chiqui", congas, bass on 1 and 3 with fifths, off-beat guitar and an accordion lead.',
    tempo: [84, 106, 95], swing: 0, grid: 8, key: { major: 'G', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Chorus:8 Outro:4'
    },
    progs: [
      P('I–V7–V7–I', 'major', 'verse chorus', 'I V7 V7 I'), P('I–IV–V7–I', 'major', 'verse chorus solo', 'I IV V7 I'), P('I–I–V7–V7', 'major', 'verse', 'I I V7 V7'),
      P('i–iv–V7–i', 'minor', 'verse chorus solo', 'i iv V7 i'), P('Andalusian i–bVII–bVI–V7', 'minor', 'chorus verse', 'i bVII bVI V7'),
      P('i–i–iv–V7', 'minor', 'verse', 'i i iv V7'), P('i–bVII–i–V7', 'minor', 'solo', 'i bVII i V7')
    ],
    tracks: [
      T('guiro', 'Güiro', 'drums', 'Güiro', { kit: 'guiro', vol: 0.45, pan: 0.4, pat: { verse: { hho: 'X.......X.......', hhc: '..x.x.x...x.x.x.' } } }),
      T('congas', 'Congas', 'drums', 'Congas', { kit: 'congas', vol: 0.58, pan: -0.25, pat: {
        verse: { hhc: 'o.o...o.o.o...o.', tom1: '....X.......X.X.', tom2: '..............X.' } } }),
      T('cowbell', 'Campana', 'drums', 'Cowbell', { kit: 'cowbell', on: false, vol: 0.4, pat: { verse: { perc: 'X...x...X...x...' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots'], fx: 'Dry', vol: 0.88, p: { style: { verse: '0:R:3 6:5:2 8:R:3 14:5:2' } } }),
      T('guitar', 'Guitar (Off-beat)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'chords', plays: ['chords', 'arp'], fx: 'Clean + Chorus', vol: 0.45, pan: -0.4,
        p: { chords: { verse: '2:1 6:1 10:1 14:1' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'arp'], fx: 'Room', vol: 0.4, p: { chords: { verse: '2:2 6:2 10:2 14:2' } } }),
      T('accordion', 'Accordion', 'melody', 'Accordion', { alt: 'lead', fx: 'Room', vol: 0.62, pan: 0.15, lead: true, in: IN('verse:.5'), mel: { fast: true, triplets: true } })
    ],
    melody: { scales: { all: { major: 'Major', minor: 'Harmonic Minor' }, always: true } }
  };

  /* ========================================================== BOSSA NOVA == */
  STYLES['Bossa Nova'] = {
    family: 'Latin', desc: 'Nylon guitar with the bossa thumb-and-fingers pattern, rim-click clave, soft brushes, maj7 / ii–V changes and a flute.',
    tempo: [116, 146, 130], swing: 0, grid: 8, key: { major: 'F', minor: 'D' }, mode: 'major',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Solo:8 Verse:8 Outro:4',
      Extended: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Solo:16 Verse:8 Outro:4'
    },
    progs: [
      P('Ipanema-style', 'major', 'verse', 'Imaj7 Imaj7 II7 II7 ii7 bII7 Imaj7 bII7'), P('Imaj7–II7–ii7–V7', 'major', 'verse solo', 'Imaj7 II7 ii7 V7'),
      P('ii7–V7–Imaj7–VI7', 'major', 'verse solo', 'ii7 V7 Imaj7 VI7'), P('Imaj7–bVII7', 'major', 'verse', 'Imaj7 bVII7 Imaj7 bVII7'),
      P('B: IVmaj7–ivm7–iii7–VI7', 'major', 'chorus bridge', 'IVmaj7 ivm7 iii7 VI7 ii7 V7 Imaj7 V7'), P('B: bVImaj7–V7', 'major', 'chorus', 'bVImaj7 bVImaj7 V7 V7'),
      P('Minor im7–ivm7–iiø–V7', 'minor', 'verse solo', 'im7 ivm7 iiø V7'), P('Minor im7–bVI7–iiø–V7', 'minor', 'verse chorus', 'im7 bVI7 iiø V7')
    ],
    tracks: [
      T('drums', 'Drums (Brushes)', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.55, pat: {
        verse: { kick: 'X.....x.X.....x.', perc: 'X..X..X...X..X....X..X..X..X....', hhc: 'o.o.o.o.o.o.o.o.' },
        solo: { kick: 'X.....x.X.....x.', perc: 'X..X..X...X..X....X..X..X..X....', ride: 'x.x.x.x.x.x.x.x.' } } }),
      T('shaker', 'Shaker', 'drums', 'Shaker', { kit: 'shaker', vol: 0.35, pan: 0.4, in: IN('intro:0'), pat: { verse: { hhc: 'xoxoxoxoxoxoxoxo' } } }),
      T('bass', 'Upright Bass', 'bass', 'Upright Bass', { play: 'style', plays: ['style', 'walking'], fx: 'Room', vol: 0.85, p: { style: { verse: '0:R:6 6:5:2 8:5:6 14:R:2' } } }),
      T('guitar', 'Nylon Guitar (Bossa)', 'strum', 'Classical Guitar - Nylon', { alt: 'guitar', play: 'bossa', plays: ['bossa', 'arp'], fx: 'Room', vol: 0.62, pan: -0.25,
        p: { bossa: { verse: 'X..C..C.B.C..C..B.C...C.B..C..C.' } } }),
      T('piano', 'Electric Piano', 'harmony', 'Electric Piano', { alt: 'keys', play: 'jazz', plays: ['jazz', 'pad'], fx: 'Room', vol: 0.4, pan: 0.3, in: IN('intro:0 verse:.5') }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad'], fx: 'Hall', vol: 0.35, in: IN('verse:0 chorus:1 solo:1') }),
      T('flute', 'Flute', 'melody', 'Flute', { alt: 'lead', fx: 'Room', vol: 0.62, pan: 0.15, lead: true, mel: { vibrato: true } })
    ],
    melody: { scales: { solo: { major: 'Lydian', minor: 'Dorian' } } }
  };

  /* ================================================================ METAL == */
  STYLES['Metal'] = {
    family: 'Pop / Rock', desc: 'Heavy and neoclassical: galloping palm-muted riffs, double kick, harmonic-minor harmony and a virtuoso lead (sweeps, tapping, pedal points).',
    tempo: [120, 176, 144], swing: 0, grid: 8, key: { major: 'E', minor: 'E' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Solo:8 Chorus:8 Chorus:8 Outro:4'
    },
    progs: [
      P('i–bVI–bVII–i', 'minor', 'verse chorus', 'i bVI bVII i'), P('Andalusian i–bVII–bVI–V7', 'minor', 'verse chorus solo', 'i bVII bVI V7'),
      P('i–iv–V7–i', 'minor', 'verse solo', 'i iv V7 i'), P('i–bVI–iv–V7', 'minor', 'chorus', 'i bVI iv V7'), P('Phrygian i–bII–i–bVII', 'minor', 'verse bridge', 'i bII i bVII'),
      P('i–bIII–bVII–iv', 'minor', 'chorus', 'i bIII bVII iv'), P('Pre: bVI–bVII–bVI–V7', 'minor', 'pre bridge', 'bVI bVII bVI V7'),
      P('Neoclassical circle of 5ths', 'minor', 'solo bridge', 'i iv bVII bIII bVI iiø V7 i'), P('Pedal i–i–bVI–V7', 'minor', 'verse solo', 'i i bVI V7'),
      P('I–bVII–bVI–bVII', 'major', 'verse chorus solo', 'I bVII bVI bVII'), P('I–IV–bVII–IV', 'major', 'verse chorus', 'I IV bVII IV'), P('Pre: IV–V', 'major', 'pre bridge', 'IV IV V V')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.88, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
        verse: { kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
        chorus: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        solo: { kick: 'XxXxXxXxXxXxXxXx', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.x.....', snare: '........X.......', tom1: '....x.......x.x.', ride: 'x...x...x...x...' },
        fill: { snare: '....X...XxXxXxXx', tom1: '............X.X.', tom2: '..............XX', kick: 'X.x.X.x.X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.85, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:2 2:R:1 3:R:1 4:R:2 6:R:1 7:R:1 8:R:2 10:R:1 11:R:1 12:R:2 14:R:1 15:R:1',
        chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'mix', plays: ['mix', 'gallop', 'pedal', 'power', 'octriff', 'vh', 'arpriff'], fx: 'Metal (MT-2)', vol: 0.62, pan: -0.5,
        mix: { intro: 'power', verse: 'gallop', pre: 'pedal', chorus: 'power', bridge: 'pedal', solo: 'gallop', outro: 'power' },
        p: { power: { intro: 'O.......O.......', pre: 'O...O...O...O...', chorus: 'O.....O.O...O.P.', outro: 'O...............' } } }),
      T('rhythm2', 'Rhythm Guitar 2', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', on: false, play: 'power', plays: ['power', 'gallop', 'pedal', 'octriff'], fx: 'Metal (MT-2)', vol: 0.55, pan: 0.5,
        p: { power: { verse: 'O.......O.......', chorus: 'O.....O.O...O.P.' } } }),
      T('keys', 'Strings / Organ', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.4, in: IN('intro:1 verse:0 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.74, pan: 0.2, lead: true, in: IN('verse:.5 pre:.5'), mel: { bends: true, vibrato: true, slides: true, fast: true } })
    ],
    melody: { heroes: ['malmsteen', 'rhoads', 'zakk', 'vanhalen', 'malmsteen', 'satriani', 'morello', 'vai'],
      scales: { all: { major: 'Mixolydian', minor: 'Natural Minor' }, solo: { major: 'Major Blues', minor: 'Harmonic Minor' }, always: true } }
  };

  /* =========================================================== LATIN ROCK == */
  STYLES['Latin Rock'] = {
    family: 'Latin', desc: 'Rock band + congas, timbales and organ over a Dorian vamp; a singing, sustained lead guitar that repeats short motifs.',
    tempo: [100, 132, 116], swing: 0, grid: 8, key: { major: 'G', minor: 'A' }, mode: 'minor',
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Solo:8 Chorus:8 Chorus:8 Outro:4'
    },
    progs: [
      P('Dorian vamp i–IV', 'minor', 'verse solo intro', 'i IV i IV'), P('Dorian vamp i-IV (half bars)', 'minor', 'verse solo', 'i-IV i-IV'),
      P('Andalusian i–bVII–bVI–V7', 'minor', 'chorus solo', 'i bVII bVI V7'), P('i–iv–V7–i', 'minor', 'verse chorus', 'i iv V7 i'),
      P('i–bVII–bVI–bVII', 'minor', 'chorus bridge', 'i bVII bVI bVII'), P('bVI–bVII–i', 'minor', 'chorus bridge', 'bVI bVII i i'),
      P('Mixolydian I–bVII–IV–I', 'major', 'verse chorus solo', 'I bVII IV I'), P('I–IV vamp', 'major', 'verse solo', 'I IV I IV'), P('ii–V', 'major', 'bridge pre', 'ii7 V7 ii7 V7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.75, pat: {
        intro: { kick: 'X.......X.......', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', ride: 'X.x.x.X.x.x.X.x.' },
        solo: { kick: 'X..x..x.X..x..x.', snare: '....X.......X..o', ride: 'X.x.x.X.x.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '....o.......o...', ride: 'x...x...x...x...' },
        fill: { snare: '........x.x.X.x.', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } }),
      T('congas', 'Congas', 'drums', 'Congas', { kit: 'congas', vol: 0.6, pan: 0.3, pat: {
        intro: { hhc: 'o.o...o.o.o.....', perc: '....X...........', tom1: '............X.X.' },
        verse: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X...', tom2: '..............................X.' },
        chorus: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X.X.', tom2: '..............X...............X.' } } }),
      T('timbales', 'Timbales / Cowbell', 'drums', 'Timbales', { kit: 'timbales', vol: 0.5, pan: -0.3, in: IN('intro:0 verse:.5'), pat: {
        verse: { perc: 'X...x.x...x...x.X...x...X.x...x.' },
        chorus: { ride: 'X...x.x.X.x.x.x.X.x.x...X.x.x.x.' },
        fill: { tom1: '........X.x.x.xx', tom2: '...............X' } } }),
      T('guiro', 'Güiro', 'drums', 'Güiro', { kit: 'guiro', on: false, vol: 0.4, pan: 0.6, in: IN('intro:0'), pat: { verse: { hho: 'X.......X.......', hhc: '....x.x.....x.x.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'tumbao', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:6 6:5:2 8:R:8', verse: '0:R:3 3:5:3 6:8:2 8:R:3 11:5:3 14:A:2', chorus: '0:R:3 3:R:1 4:5:2 6:8:2 8:R:3 11:5:3 14:N:2', bridge: '0:R:8 8:5:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'chords', plays: ['chords', 'pad', 'montuno-light'], fx: 'Room', vol: 0.5, pan: 0.3,
        p: { chords: { intro: '0:8 8:8', verse: '0:2 3:1 6:2 10:2 13:1', chorus: '0:3 3:3 6:2 8:3 11:3 14:2:N', bridge: '0:8 8:8', solo: '0:2 3:1 6:2 10:2 13:1' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'mix', plays: ['mix', 'chords', 'funkline', 'hendrix', 'power', 'strum'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.5, pan: -0.4,
        mix: { intro: 'chords', verse: 'chords', pre: 'chords', chorus: 'power', bridge: 'hendrix', solo: 'chords', outro: 'power' },
        p: { chords: { verse: '2:1 6:1 8:1 11:1 14:1', solo: '2:1 6:1 8:1 11:1 14:1', intro: '0:8 8:8' }, power: { chorus: 'O..O..O.O..O..P.', outro: 'O.......O.......' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.76, pan: 0.15, lead: true, in: IN('intro:1 verse:1 chorus:1'), mel: { bends: true, vibrato: true, slides: true } })
    ],
    melody: { heroes: ['santana'], scales: { all: { major: 'Mixolydian', minor: 'Dorian' }, always: true } }
  };

  /* ============================================== shared alternatives === */
  /** Instruments offered for each kind of track in the Full Song panel */
  SDAW.STYLE_ALT = {
    keys: ['Grand Piano', 'Upright Piano', 'Electric Piano', 'Organ', 'Clavinet', 'Accordion', 'Vibraphone', 'Pluck'],
    guitar: ['Acoustic Guitar - Steel', 'Classical Guitar - Nylon', 'Electric Guitar - Clean', 'Electric Guitar - Lead', '12-String Guitar',
      'Real Acoustic Guitar (Steel)', 'Real Classical Guitar (Nylon)', 'Real Electric - Stratocaster', 'Real Electric - Les Paul', 'Real Electric - Hollow Body'],
    pad: ['String Ensemble', 'Warm Pad', 'Soft Pad', 'Organ'],
    bass: ['Electric Bass - Finger', 'Electric Bass - Pick', 'Upright Bass', 'Synth Bass', '808 Bass'],
    lead: ['Trumpet', 'Trombone', 'Alto Sax', 'Tenor Sax', 'Flute', 'Accordion', 'Fiddle', 'Harmonica', 'Melodica', 'Electric Guitar - Lead', 'Electric Guitar - Clean', 'Classical Guitar - Nylon', 'Saw Lead', 'Square Lead', 'Grand Piano', 'Vibraphone']
  };

})(window.SDAW);
