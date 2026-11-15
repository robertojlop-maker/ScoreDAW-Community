/* =============================================================================
 *  BANDS.JS — band profiles: write a song the way a real band writes it
 *  -----------------------------------------------------------------------------
 *  A band profile is a complete style (same format as styles.js) plus:
 *    band      id of the band in the reference library (styledata.js)
 *    keys      the keys the band likes (guitar-friendly), minor = share of minor songs
 *    vocal     its singer: gender, range (MIDI), backing voices and their modes,
 *              rhythm cells per section, register per section (0 = low … 1 = high)
 *    leadPlan  what the lead guitar does in each section
 *    types     the KINDS OF SONG of the band (hard rocker, anthem, power ballad…):
 *              each one changes tempo, mode, form, line-up and how every track plays.
 *              A progression tagged with types belongs only to those kinds of song.
 *    riffs     (rhythm guitars, play 'bandriff') riffs written in the idiom of the
 *              band — see legends.js "bandriff" for the notation.
 *
 *  Where it comes from: the numbers (tempos, keys, section lengths, which
 *  instruments play in which section, drum / bass / vocal rhythms, the most used
 *  progressions) come from the analysis of the user's Guitar Pro library
 *  (tools/style-analysis). The riffs, patterns and progressions written here are
 *  ORIGINAL material in that idiom — no part of an existing song is copied.
 *
 *  The bands appear as genres in "Auto Generate Full Song" (family 🎸 Bands).
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const STYLES = SDAW.STYLES;
  const BANDS = SDAW.BANDS = {};

  /* ---- helpers (same as styles.js) ---- */
  function T(id, name, role, inst, o) { return Object.assign({ id, name, role, inst, on: true, vol: 0.75, pan: 0 }, o || {}); }
  function IN(str) { const o = {}; (str || '').split(/\s+/).filter(Boolean).forEach(kv => { const [k, v] = kv.split(':'); o[k] = parseFloat(v); }); return o; }
  /** progression: name, mode, sections, chords, kinds of song (empty = all) */
  function P(n, mode, use, c, t) { const p = { n, m: mode, use, c }; if (t) p.t = t; return p; }
  /** vocal rhythm cells: "0:2 2:2 4:4 | 0:8 8:8" → [[[0,2],[2,2],[4,4]], [[0,8],[8,8]]] */
  function CE(str) { return str.split('|').map(b => b.trim().split(/\s+/).map(x => x.split(':').map(Number))); }
  const FAMILY = '🎸 Bands';
  function band(name, def) { def.family = FAMILY; STYLES[name] = def; BANDS[def.band] = name; }
  const ROCK_SCALES = { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true };

  /* ======================================================= GUNS N' ROSES == */
  /* Library: 70 songs. 125 BPM typical (70–172), 34 % minor, guitars tuned a half step down, two guitars in
   * almost every song, power chords 46 % / low riffs 15–26 % of the rhythm bars, acoustic guitar in 21 % and piano
   * in 16 % of the songs (the ballads), lead: 8 notes per bar, bends 10 % (whole tone), legato 10 %; the singer
   * sings 60 % of the bars, verses in 8th notes that start after the beat, choruses in quarter / half notes;
   * verses of 8 or 16 bars, solos of 16 bars or more, long intros and outros. */
  band("Guns N' Roses", {
    band: 'gnr',
    desc: 'Late-80s hard rock: a crunchy rhythm guitar on the left and Les Paul riffs on the right, Mixolydian and blues-scale riffs, a high raspy singer with gang choruses, long singing solos (also in the outro). The power ballads add piano, strings and acoustic guitar.',
    tempo: [116, 150, 128], swing: 0, grid: 8, key: { major: 'D', minor: 'E' }, mode: 'major',
    keys: { major: ['D', 'G', 'A', 'E', 'C'], minor: ['E', 'A', 'B', 'F#', 'D'] }, minor: 0.34,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Bridge:8 Chorus:8 Chorus:8 Outro Solo:16 Outro:4'
    },
    progs: [
      // rockers and anthems — major keys are Mixolydian (bVII), minor keys are Aeolian / blues
      P('Mixolydian I–bVII–IV–I', 'major', 'verse chorus solo', 'I bVII IV I', 'rocker anthem'), P('I–I–bVII–bVII', 'major', 'verse', 'I I bVII bVII', 'rocker anthem'),
      P('I·V–IV (two chords a bar)', 'major', 'verse solo', 'I-V IV I-V IV', 'rocker anthem'), P('IV–IV–I–I', 'major', 'verse', 'IV IV I I', 'rocker anthem'),
      P('I–IV–I–IV', 'major', 'verse intro', 'I IV I IV', 'rocker anthem'), P('I–bIII–IV–I', 'major', 'verse', 'I bIII IV I', 'rocker'),
      P('Chorus: IV–I–V–V', 'major', 'chorus', 'IV I V V', 'rocker anthem'), P('Chorus: V–V–IV–IV', 'major', 'chorus', 'V V IV IV', 'rocker anthem'),
      P('Chorus: bVII–IV–I–I', 'major', 'chorus', 'bVII IV I I', 'rocker anthem'), P('Chorus: V–bVII·IV–I', 'major', 'chorus', 'V bVII-IV I I', 'rocker anthem'),
      P('Pre: IV–V', 'major', 'pre', 'IV IV V V', 'rocker anthem'), P('Pre: bVII–IV', 'major', 'pre', 'bVII bVII IV IV', 'rocker anthem'),
      P('Bridge: vi–IV–I–V', 'major', 'bridge', 'vi IV I V', 'rocker anthem'), P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I', 'rocker anthem'),
      P('Bridge: ii–IV–V', 'major', 'bridge', 'ii IV V V', 'rocker anthem'),
      P('Minor i–bIII–i–bIII·bVII', 'minor', 'verse intro', 'i bIII i bIII-bVII', 'rocker anthem'), P('Minor i–i–bVII–bVII', 'minor', 'verse', 'i i bVII bVII', 'rocker anthem'),
      P('Minor i–bVII–bVI–bVII', 'minor', 'verse solo', 'i bVII bVI bVII', 'rocker anthem'), P('Minor i–bVI–bVII–i', 'minor', 'verse chorus solo', 'i bVI bVII i', 'rocker anthem'),
      P('Minor chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'rocker anthem'), P('Minor chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII', 'rocker anthem'),
      P('Minor chorus: bIII–bVII–i–i', 'minor', 'chorus', 'bIII bVII i i', 'rocker anthem'), P('Minor pre: bVI–bVII', 'minor', 'pre', 'bVI bVI bVII bVII', 'rocker anthem'),
      P('Minor pre: i·bVII–bVI·i', 'minor', 'pre', 'i-bVII bVI-i i-bVII bVI-bVII', 'rocker anthem'), P('Minor bridge: iv–bVI–bVII', 'minor', 'bridge', 'iv iv bVI bVII', 'rocker anthem'),
      P('Minor solo: i–iv–bVII–bIII', 'minor', 'solo', 'i iv bVII bIII', 'rocker anthem'),
      // power ballads
      P('Ballad I–IV–I–V', 'major', 'verse intro', 'I IV I V', 'ballad'), P('Ballad I·V–IV', 'major', 'verse', 'I-V IV I-V IV', 'ballad'),
      P('Ballad I–V–IV–IV', 'major', 'verse solo', 'I V IV IV', 'ballad'), P('Ballad chorus: IV–I–V–V', 'major', 'chorus', 'IV I V V', 'ballad'),
      P('Ballad chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'ballad'), P('Ballad chorus: vi–IV–I–V', 'major', 'chorus solo intro', 'vi IV I V', 'ballad'),
      P('Ballad bridge: vi–V–IV', 'major', 'bridge', 'vi V IV IV', 'ballad'), P('Ballad bridge: ii–IV–V', 'major', 'bridge pre', 'ii IV V V', 'ballad'),
      P('Ballad minor i–bVI–bIII–bVII', 'minor', 'verse chorus solo', 'i bVI bIII bVII', 'ballad'), P('Ballad minor i–iv–bVII–bIII', 'minor', 'verse', 'i iv bVII bIII', 'ballad'),
      P('Ballad minor chorus: bVI–bVII–i', 'minor', 'chorus bridge', 'bVI bVII i i', 'ballad'), P('Ballad minor bridge: iv–bVII–bIII–bVI', 'minor', 'bridge pre', 'iv bVII bIII bVI', 'ballad')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.86, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.x...x...x.....X.x...x.X.x.....', snare: '....X.......X.......X.......X...', hhc: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.x.' },
        pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: 'x...x...x...x...' },
        chorus: { kick: 'X.x.....X.x.....X.x...x.X.x.....', snare: '....X.......X.......X.......X..x', hho: 'X...X...X...X...X...X...X...X...', hhc: '..x...x...x...x...x...x...x...x.' },
        solo: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.........x.....', snare: '........X.......', hhc: 'x.x.x.x.x.x.x.x.' },
        outro: { kick: 'X.x.....X.x...x.', snare: '....X.......X...', hho: 'X...X...X...X...' },
        fill: { snare: '........X.XX....', tom1: '............XX..', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.85, p: { style: {
        intro: '0:R:16', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', pre: '0:R:4 4:R:4 8:R:4 12:R:2 14:A:2',
        chorus: '0:R:2 2:R:2 4:R:2 6:8:2 8:R:2 10:R:2 12:5:2 14:A:2', solo: '0:R:2 2:R:2 4:b7:2 6:R:2 8:R:2 10:R:2 12:5:2 14:b7:2',
        bridge: '0:R:6 6:R:2 8:5:4 12:R:4', outro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2' } } }),
      // left: the crunchy rhythm guitar — open chords with pushes and sus4 moves
      T('rhythm', 'Rhythm Guitar (left)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'mix', 'power', 'sus4', 'stabs', 'bassriff', 'strum', 'arp'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.6, pan: -0.5,
        mix: { intro: 'arpriff', verse: 'sus4', pre: 'power', chorus: 'power', bridge: 'arpriff', solo: 'power', outro: 'power' },
        riffs: {
          intro: ['0:O:8r 8:O:8r', '0:O:6r 6:O:2 8:O:8r'],
          verse: ['0:O:3 3:O:1. 4:O:2 6:O:4 10:O:2 12:T:2 14:S:2 | 0:O:3 3:O:1. 4:O:2 6:O:4 10:O:2 12:O:4',
                  '0:O:2 2:O:2. 6:O:2 8:O:2 10:O:2. 14:O:2 | 0:O:2 2:O:2. 6:O:2 8:T:2 10:S:2 12:T:4',
                  '0:c:2 2:c:2p 4:O:2a 6:c:2p 8:c:2 10:c:2p 12:O:2a 14:c:2p'],
          pre: ['0:O:4 4:O:4 8:O:4 12:O:2 14:O:2', '0:C:2 2:c:2p 4:c:2p 6:C:2 8:c:2p 10:c:2p 12:C:2 14:C:2'],
          chorus: ['0:O:6a 6:O:2 8:O:4 12:O:2 14:O:2 | 0:O:6a 6:O:2 8:O:3 11:O:3 14:O:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:O:3a 3:O:3 6:O:2 8:O:3 11:O:3 14:O:2'],
          bridge: ['0:O:16r', '0:O:8r 8:O:6r 14:O:2'],
          solo: ['0:C:2 2:c:2p 4:C:2 6:c:2p 8:C:2 10:c:2p 12:C:2 14:C:2', '0:O:4 4:O:2 6:O:4 10:O:2 12:O:4']
        } }),
      // right: the Les Paul — low blues-scale riffs with hammer-ons, pedal riffs with chord stabs, big power chords
      T('rhythm2', 'Riff Guitar (right)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'mix', 'power', 'arpriff', 'pedal', 'bassriff', 'octriff', 'stabs'], fx: 'Rock Distortion (DS-1)', vol: 0.6, pan: 0.5,
        mix: { intro: 'arpriff', verse: 'arpriff', pre: 'bandriff', chorus: 'bandriff', bridge: 'arpriff', solo: 'bandriff', outro: 'bandriff' },
        riffs: {
          verse: ['0:0:2p 2:0:2p 4:3:1 5:4:1h 6:0:2p 8:7:2 10:5:2 12:3:1 13:4:1h 14:0:2 | 0:0:2p 2:0:2p 4:3:1 5:4:1h 6:0:2p 8:10:2 10:12:2a 12:10:2 14:7:2',
                  '0:k0:2p 2:k0:2p 4:C:2a 6:k0:2p 8:k0:2p 10:C:2a 12:k0:2p 14:C:2 | 0:k0:2p 2:k0:2p 4:C:2a 6:k0:2p 8:C:4a 12:k10:2 14:k7:2',
                  '0:C:3a 3:0:1p 4:0:2p 6:10:2 8:12:2 10:10:2 12:7:1 13:5:1 14:3:1 15:4:1h | 0:C:3a 3:0:1p 4:0:2p 6:10:2 8:12:4v 12:C:4',
                  '0:0:1p 1:0:1p 2:12:2 4:0:1p 5:0:1p 6:10:2 8:0:1p 9:0:1p 10:7:2 12:5:2 14:3:1 15:4:1h | 0:0:1p 1:0:1p 2:12:2 4:0:1p 5:0:1p 6:10:2 8:C:6a 14:C:2',
                  '0:C:2a 2:c:2p 6:C:2a 8:c:2p 10:3:1 11:4:1h 12:7:2 14:5:2 | 0:C:2a 2:c:2p 6:C:2a 8:c:2p 10:10:2 12:7:2 14:10:1 15:12:1h'],
          pre: ['0:C:2 2:c:2p 4:c:2p 6:C:2 8:c:2p 10:c:2p 12:C:2 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'],
          chorus: ['0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2 | 0:C:6a 6:C:2 8:C:3 11:C:3 14:C:2', '0:C:3a 3:C:3 6:C:2 8:C:3 11:C:3 14:C:2',
                   '0:C:4a 4:c:2p 6:C:4 10:c:2p 12:C:2 14:10:1 15:12:1h | 0:C:4a 4:c:2p 6:C:4 10:c:2p 12:C:4', '0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:C:2'],
          bridge: ['0:C:16', '0:C:8 8:C:8'],
          solo: ['0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:C:2', '0:C:3a 3:C:3 6:C:2 8:C:3 11:C:3 14:C:2']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', on: false, play: 'mix', plays: ['mix', 'strum', 'arp'], fx: 'Room', vol: 0.5, pan: -0.25,
        mix: { intro: 'arp', verse: 'arp', pre: 'strum', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { arp: { verse: '0.2.3.2.4.3.2.3.', intro: '0.2.3.4.3.2.3.2.' }, strum: { chorus: 'D...D.DU.UDUD.DU', solo: 'D...D.DU.UDUD.DU', pre: 'D...D...D.DUD.DU' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'mix', plays: ['mix', 'chords', 'arp', 'pad'], fx: 'Ballad Hall', vol: 0.62, pan: 0.1,
        mix: { intro: 'arp', verse: 'chords', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { intro: '0.1.2.3.2.1.2.3.', bridge: '0.2.1.3.2.3.1.2.' }, chords: { verse: '0:4 4:4 8:4 12:4', pre: '0:4 4:4 8:4 12:2 14:2', chorus: '0:4 4:4 8:4 12:2 14:2', solo: '0:4 4:4 8:4 12:4' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Ballad Hall', vol: 0.46, in: IN('intro:.5 verse:0 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.74, pan: 0.15, lead: true, in: IN('intro:0 verse:.5 pre:.5 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, complex: true } })
    ],
    vocal: { gender: 'male', range: [52, 74], voices: 2, choir: ['hook', 'harmony', 'hook'], scoop: 0.3, melisma: 0.08, lift: 5, blue: true,
      reg: { verse: 0.36, pre: 0.5, chorus: 0.66, bridge: 0.5, outro: 0.6 },
      cells: {
        verse: CE('2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:2 2:2 4:2 6:2 8:4 12:2 14:2 | 2:2 4:2 6:2 8:2 10:4 | 0:2 2:2 4:2 6:2 8:2 10:2 12:4 | 4:4 8:4 12:2 14:2 | 4:4 8:2 10:4 14:2'),
        pre: CE('0:2 2:2 4:2 6:2 10:2 12:2 14:2 | 0:4 4:4 8:4 12:4'),
        chorus: CE('0:4 4:4 8:4 12:4 | 0:8 8:8 | 0:4 4:4 8:8 | 0:6 6:2 8:8 | 2:2 4:4 8:4 12:4 | 0:4 4:8 12:4'),
        bridge: CE('0:12 12:4 | 0:4 4:8 12:4 | 4:2 6:2 8:2 10:2 12:2 14:2')
      } },
    leadPlan: { outro: 'solo' },
    melody: { heroes: ['slash'], scales: ROCK_SCALES },
    types: {
      rocker: { n: 'Hard rocker — riff, gang chorus, long solo', w: 4,
        d: 'Fast and dirty: the riff guitar opens alone, the verse sits on the riff, the chorus opens into big power chords with the gang vocals, and the solo runs 16 bars.' },
      anthem: { n: 'Mid-tempo anthem — picked arpeggio riff, singing lead', w: 3,
        d: 'Mid-tempo: a picked arpeggio riff with ringing notes carries the intro and the verses, the lead guitar sings a theme in the intro, the chorus is wide and the outro is a second solo.',
        set: { tempo: [100, 128, 118], minor: 0.25, leadPlan: { intro: 'melody', outro: 'solo' },
          structures: {
            Short: 'Intro:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Chorus:8 Outro Solo:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Bridge:8 Chorus:8 Chorus:8 Outro Solo:16 Outro:4' } },
        tracks: { rhythm2: { play: 'mix' }, lead: { in: IN('intro:1 verse:.5 pre:.5 chorus:.5 bridge:.5 solo:1 outro:1') },
          drums: { in: IN('intro:.5') } } },
      ballad: { n: 'Power ballad — piano, strings, acoustic guitar, epic solos', w: 2,
        d: 'Slow and big: piano in quarter-note chords, strings from the first chorus, acoustic guitar, drums that enter softly, backing "oohs", and two guitar solos — the second one over the outro.',
        set: { tempo: [64, 84, 72], minor: 0.2, leadPlan: { intro: 'melody', outro: 'solo' },
          keys: { major: ['G', 'C', 'D', 'A'], minor: ['E', 'A', 'B'] },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Bridge:8 Chorus:8 Outro Solo:16 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Solo:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro Solo:16 Outro:4' },
          vocal: { gender: 'male', range: [50, 72], voices: 3, choir: ['oohs', 'harmony'], scoop: 0.3, melisma: 0.2, lift: 5, blue: false,
            reg: { verse: 0.3, pre: 0.45, chorus: 0.62, bridge: 0.5, outro: 0.5 },
            cells: { verse: CE('0:4 4:2 6:6 12:4 | 2:2 4:4 8:8 | 0:2 2:2 4:4 8:4 12:4 | 4:4 8:4 12:2 14:2'), chorus: CE('0:8 8:8 | 0:6 6:2 8:8 | 0:4 4:4 8:8 | 0:4 4:8 12:4'), bridge: CE('0:12 12:4 | 0:4 4:8 12:4') } } },
        tracks: {
          drums: { vol: 0.74, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            bridge: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x...x...x...x...' },
            outro: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', hho: 'X...X...X...X...' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { play: 'style', vol: 0.8, in: IN('intro:0'), p: { style: { verse: '0:R:8 8:R:4 12:5:4', chorus: '0:R:6 6:R:2 8:R:6 14:A:2', solo: '0:R:6 6:R:2 8:R:4 12:5:2 14:A:2', bridge: '0:R:8 8:5:8', outro: '0:R:6 6:R:2 8:R:4 12:5:2 14:A:2' } } },
          rhythm: { play: 'mix', mix: { intro: 'arp', verse: 'arp', pre: 'power', chorus: 'power', bridge: 'arp', solo: 'power', outro: 'power' }, fx: 'Clean + Chorus', vol: 0.5, in: IN('intro:0 verse:.5') ,
            p: { arp: { verse: '0.2.3.2.4.3.2.3.' }, power: { chorus: 'O.......O...O...', solo: 'O.....O.O...O...', outro: 'O.....O.O...O...', pre: 'O.......O.......' } } },
          rhythm2: { play: 'power', vol: 0.55, in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:.5 solo:1 outro:1'), p: { power: { chorus: 'O.......O...O...', solo: 'O.....O.O...O.O.', outro: 'O.....O.O...O.O.', pre: 'O...............' } } },
          aguitar: { on: true }, piano: { on: true }, strings: { on: true },
          lead: { in: IN('intro:1 verse:0 pre:.5 chorus:.5 bridge:.5 solo:1 outro:1'), fx: 'Lead (TS + Delay)' } } }
    }
  });

  /* ============================================================ BON JOVI == */
  /* Library: 93 songs. 120 BPM typical (74–144), 30 % minor, standard tuning, keys G / E / D / C major and A / D minor.
   * Keyboards everywhere: strings / pads in 27 % and piano in 26 % of the songs, organ in the solos, a synth line in
   * the choruses; acoustic guitar in 37 %. Rhythm guitar: power chords 42 %, little palm muting, chorus rhythm
   * "O...O.O...O.O.O."; drums: kick on 1 and 3, snare on 2 and 4, closed hats in the verse, open hats in quarters in
   * the chorus, floor-tom 8ths in the build-ups; bass: root 8ths. Singer: 6 notes per bar in the verse (8th notes),
   * syncopated quarter notes in the chorus; verses of 8 bars, pre-choruses of 8, choruses of 8–16. */
  band('Bon Jovi', {
    band: 'bonjovi',
    desc: '80s arena rock: palm-muted verses that build through a pre-chorus into a huge sing-along chorus with gang vocals, keyboards under everything (pads, piano, a synth hook), a melodic guitar solo. Also acoustic "cowboy" ballads and piano power ballads.',
    tempo: [112, 138, 122], swing: 0, grid: 8, key: { major: 'G', minor: 'A' }, mode: 'major',
    keys: { major: ['G', 'E', 'D', 'C', 'A'], minor: ['A', 'D', 'E', 'B'] }, minor: 0.3,
    structures: {
      Short: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:8 Pre-Chorus:4 Chorus:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:8 Pre-Chorus:4 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('vi–IV–I–V', 'major', 'verse chorus solo intro', 'vi IV I V', 'anthem rocker'), P('I–V–vi–IV', 'major', 'chorus verse', 'I V vi IV', 'anthem rocker'),
      P('I–IV–I–IV', 'major', 'verse intro', 'I IV I IV', 'anthem rocker'), P('I–I–IV–IV', 'major', 'verse chorus', 'I I IV IV', 'anthem rocker'),
      P('I–bVII–IV–I', 'major', 'verse solo', 'I bVII IV I', 'rocker'), P('Chorus: IV–I–V–vi', 'major', 'chorus', 'IV I V vi', 'anthem rocker'),
      P('Chorus: IV–I–V–V', 'major', 'chorus', 'IV I V V', 'anthem rocker'), P('Chorus: I–IV–vi–V', 'major', 'chorus', 'I IV vi V', 'anthem rocker'),
      P('Pre: IV–vi–V–V', 'major', 'pre', 'IV vi V V', 'anthem rocker'), P('Pre: ii–IV–V–V', 'major', 'pre', 'ii IV V V', 'anthem rocker'), P('Pre: IV–V–IV–V', 'major', 'pre', 'IV V IV V', 'anthem rocker'),
      P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I', 'anthem rocker'), P('Bridge: iii–vi–IV–V', 'major', 'bridge', 'iii vi IV V', 'anthem rocker'),
      P('Minor i–i–bVII–bVII', 'minor', 'verse intro', 'i i bVII bVII', 'anthem rocker'), P('Minor i–i–bIII–bIII', 'minor', 'verse', 'i i bIII bIII', 'anthem rocker'),
      P('Minor i–bVI–bVII–i', 'minor', 'verse solo intro', 'i bVI bVII i', 'anthem rocker'), P('Minor pre: bVI–bVII', 'minor', 'pre', 'bVI bVI bVII bVII', 'anthem rocker'),
      P('Minor pre: bVII–bVI', 'minor', 'pre', 'bVII bVII bVI bVI', 'anthem rocker'), P('Minor chorus: bIII–bVII–i–bVI', 'minor', 'chorus solo', 'bIII bVII i bVI', 'anthem rocker'),
      P('Minor chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII', 'anthem rocker'), P('Minor chorus: bVI–bIII–bVII–i', 'minor', 'chorus', 'bVI bIII bVII i', 'anthem rocker'),
      P('Minor bridge: iv–bVI–bVII', 'minor', 'bridge', 'iv iv bVI bVII', 'anthem rocker'),
      P('Ballad I–V–vi–IV', 'major', 'verse chorus solo', 'I V vi IV', 'cowboy ballad'), P('Ballad I–IV–I–V', 'major', 'verse intro', 'I IV I V', 'cowboy ballad'),
      P('Ballad vi–IV–I–V', 'major', 'chorus intro solo', 'vi IV I V', 'cowboy ballad'), P('Ballad chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'cowboy ballad'),
      P('Ballad I–iii–IV–V', 'major', 'verse', 'I iii IV V', 'ballad'), P('Ballad pre: ii–IV–V', 'major', 'pre bridge', 'ii IV V V', 'cowboy ballad'),
      P('Ballad bridge: vi–V–IV', 'major', 'bridge', 'vi V IV IV', 'cowboy ballad'),
      P('Cowboy minor i–bVII–bVI–bVII', 'minor', 'verse intro solo', 'i bVII bVI bVII', 'cowboy ballad'), P('Cowboy minor i–bVI–bIII–bVII', 'minor', 'chorus verse solo', 'i bVI bIII bVII', 'cowboy ballad'),
      P('Cowboy minor chorus: bVI–bVII–i', 'minor', 'chorus bridge pre', 'bVI bVII i i', 'cowboy ballad')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.88, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......X.......X.x.....', snare: '....X.......X.......X.......X...', hhc: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.x.' },
        pre: { kick: 'X...X...X...X...', snare: '....X.......X...', tom2: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.x.....X.....x.X.x.....', snare: '....X.......X.......X.......X...', hho: 'X...X...X...X...X...X...X...X...' },
        solo: { kick: 'X.......X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x...x...x...x...' },
        fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.84, p: { style: {
        intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2',
        pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2',
        solo: '0:R:2 2:R:2 4:R:2 6:8:2 8:R:2 10:R:2 12:5:2 14:A:2', bridge: '0:R:8 8:R:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'pedal', 'stabs', 'sus4', 'arpriff', 'strum'], fx: 'Rock Distortion (DS-1)', vol: 0.6, pan: -0.45,
        riffs: {
          intro: ['0:C:8 8:C:8', '0:C:6a 6:C:2 8:C:8'],
          verse: ['0:0:2p 2:0:2p 4:0:2p 6:0:2p 8:0:2p 10:0:2p 12:0:2p 14:0:2p | 0:0:2p 2:0:2p 4:0:2p 6:0:2p 8:0:2p 10:0:2p 12:C:2a 14:C:2',
                  '0:C:2a 2:0:2p 4:0:2p 6:C:2a 8:0:2p 10:0:2p 12:C:2a 14:0:2p',
                  '0:0:2p 2:0:2p 4:7:2p 6:0:2p 8:0:2p 10:7:2p 12:5:2 14:7:2 | 0:0:2p 2:0:2p 4:7:2p 6:0:2p 8:C:4a 12:C:2 14:C:2',
                  '0:C:3a 3:C:1. 8:C:3a 11:C:1. 14:C:2 | 0:C:3a 3:C:1. 8:C:2a 10:C:2 12:C:4'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:4', '0:C:8a 8:C:4 12:C:2 14:C:2', '0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:C:2a 14:C:2a'],
          chorus: ['0:C:4a 4:C:2 6:C:4 10:C:2 12:C:2 14:C:2', '0:C:3a 3:C:3 6:C:4 10:C:2 12:C:2 14:C:1 15:C:1', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:2 14:O:2', '0:C:6a 6:C:2 8:C:6a 14:C:2'],
          bridge: ['0:C:16', '0:C:8 8:C:8'],
          solo: ['0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:C:2', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:2 14:C:2']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', on: false, play: 'mix', plays: ['mix', 'strum', 'arp'], fx: 'Room', vol: 0.5, pan: 0.4,
        mix: { intro: 'arp', verse: 'arp', pre: 'strum', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { arp: { verse: '0.2.3.2.4.2.3.2.', intro: '0.2.3.4.3.2.4.3.' }, strum: { chorus: 'D...D.DU.UDUD.DU', solo: 'D...D.DU.UDUD.DU', pre: 'D.......D...D.DU' } } }),
      T('keys', 'Synth Pad', 'harmony', 'Synthesizer - Analog Pad', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Synth Wide', vol: 0.42, in: IN('intro:1 verse:.5 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'mix', 'arp', 'pad'], fx: 'Room', vol: 0.5, pan: 0.2,
        mix: { intro: 'arp', verse: 'arp', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { verse: '0.1.2.3.2.1.2.3.', intro: '0.2.1.3.2.3.1.2.' }, chords: { verse: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', pre: '0:4 4:4 8:4 12:4', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:4 4:4 8:4 12:4', intro: '0:8 8:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4, pan: 0.25, in: IN('intro:0 verse:0 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('hook', 'Synth Hook', 'horns', 'Synthesizer - Warm Poly', { alt: 'lead', play: 'riffs', fx: 'Synth Wide', vol: 0.5, pan: 0.3, in: IN('intro:1 verse:0 pre:0 chorus:.5 bridge:0 solo:0 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.72, pan: 0.15, lead: true, in: IN('intro:0 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:.5'),
        mel: { bends: true, vibrato: true, slides: true, harmonics: true } })
    ],
    vocal: { gender: 'male', range: [55, 72], voices: 3, choir: ['hook', 'harmony', 'hook'], scoop: 0.2, melisma: 0.1, lift: 5,
      reg: { verse: 0.3, pre: 0.5, chorus: 0.7, bridge: 0.55, outro: 0.6 },
      cells: {
        verse: CE('0:2 2:2 4:2 6:2 8:2 10:2 12:4 | 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:2 2:4 6:6 12:2 14:2 | 0:2 2:2 4:4 8:2 10:2 12:2 14:2 | 0:2 2:2 4:2 6:2 8:4 12:2 14:2'),
        pre: CE('0:4 4:4 8:4 12:2 14:2 | 0:2 2:2 4:4 8:4 12:4 | 0:6 6:2 8:4 12:4'),
        chorus: CE('0:4 4:2 6:4 10:4 14:2 | 0:4 6:2 8:4 12:2 14:2 | 0:2 2:4 6:2 10:2 12:2 14:2 | 0:8 8:4 12:4 | 0:4 4:4 8:8 | 0:6 6:2 8:8'),
        bridge: CE('0:8 8:8 | 0:4 4:4 8:8')
      } },
    leadPlan: {},
    melody: { heroes: ['sambora'], scales: ROCK_SCALES },
    types: {
      anthem: { n: 'Arena anthem — muted verse, build-up, huge chorus', w: 4,
        d: 'Palm-muted 8th notes and a synth pad in the verse, floor-tom build in the pre-chorus, then the open power chords, the synth hook and the gang vocals of the chorus. The solo sings the chorus before it runs.' },
      rocker: { n: 'Up-tempo rocker — organ, piano 8ths, shouted chorus', w: 2,
        d: 'Faster and looser: rock-and-roll piano in 8th notes, organ from the pre-chorus, guitar stabs in the verse.',
        set: { tempo: [128, 148, 136], minor: 0.15 },
        tracks: { keys: { on: false }, piano: { on: true }, organ: { on: true }, hook: { on: false } } },
      cowboy: { n: 'Cowboy ballad — 12-string acoustic, slow build', w: 2,
        d: 'A picked 12-string acoustic opens alone with the singer; bass and drums enter later, the electric guitars arrive in the chorus, and the solo is slow and melodic.',
        set: { tempo: [84, 104, 92], minor: 0.6, key: { major: 'D', minor: 'D' }, keys: { major: ['D', 'G', 'A'], minor: ['D', 'E', 'A'] }, leadPlan: { intro: 'rest' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Bridge:8 Chorus:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [52, 71], voices: 2, choir: ['harmony', 'oohs'], scoop: 0.25, melisma: 0.12, lift: 5,
            reg: { verse: 0.28, chorus: 0.66, bridge: 0.5, outro: 0.5 },
            cells: { verse: CE('0:2 2:2 4:4 8:2 10:2 12:4 | 2:2 4:2 6:6 12:4 | 0:4 4:2 6:6 12:2 14:2'), chorus: CE('0:6 6:2 8:8 | 0:4 4:4 8:8 | 0:4 4:2 6:4 10:4 14:2 | 0:8 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { vol: 0.8, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            bridge: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x...x...x...x...' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0 verse:.5'), p: { style: { verse: '0:R:8 8:R:8', chorus: '0:R:6 6:R:2 8:R:4 12:5:2 14:A:2', solo: '0:R:6 6:R:2 8:R:4 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          aguitar: { on: true, inst: '12-String Guitar', vol: 0.6, pan: -0.2 },
          rhythm: { vol: 0.56, in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:.5 solo:1 outro:.5'), riffs: {
            chorus: ['0:C:8a 8:C:6 14:C:2', '0:C:6a 6:C:2 8:C:8', '0:O:8a 8:O:4 12:O:4'], solo: ['0:C:8a 8:C:6 14:C:2', '0:C:6a 6:C:2 8:C:4 12:C:4'], bridge: ['0:C:16'] } },
          keys: { inst: 'String Ensemble', fx: 'Ballad Hall', in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:1 solo:1 outro:1') }, hook: { on: false },
          lead: { in: IN('intro:0 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:1') } } },
      ballad: { n: 'Power ballad — piano, strings, big last chorus', w: 2,
        d: 'Piano and voice first, strings from the first chorus, the band in full from the second verse, a singing guitar solo.',
        set: { tempo: [62, 82, 72], minor: 0.15, key: { major: 'C', minor: 'A' }, keys: { major: ['C', 'G', 'D', 'E'], minor: ['A', 'E'] }, leadPlan: { intro: 'rest' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:8 Chorus:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:8 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [52, 72], voices: 3, choir: ['oohs', 'harmony'], scoop: 0.25, melisma: 0.2, lift: 5,
            reg: { verse: 0.28, pre: 0.45, chorus: 0.68, bridge: 0.5, outro: 0.5 },
            cells: { verse: CE('0:4 4:2 6:6 12:4 | 2:2 4:4 8:8 | 0:2 2:2 4:4 8:4 12:4'), pre: CE('0:4 4:4 8:4 12:4 | 0:6 6:2 8:8'), chorus: CE('0:8 8:8 | 0:6 6:2 8:8 | 0:4 4:4 8:8 | 0:4 4:2 6:4 10:4 14:2'), bridge: CE('0:12 12:4') } } },
        tracks: {
          drums: { vol: 0.76, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.......X.......', snare: '....X.......X...', tom2: 'x...x...x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0 verse:.5'), p: { style: { verse: '0:R:8 8:R:4 12:5:4', pre: '0:R:8 8:R:8', chorus: '0:R:6 6:R:2 8:R:6 14:A:2', solo: '0:R:6 6:R:2 8:R:4 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          piano: { on: true, play: 'mix', vol: 0.62, fx: 'Ballad Hall', p: { arp: { verse: '0.1.2.3.2.1.2.3.', intro: '0.2.1.3.2.3.1.2.' }, chords: { pre: '0:4 4:4 8:4 12:4', chorus: '0:4 4:4 8:4 12:2 14:2', solo: '0:4 4:4 8:4 12:4' } } },
          keys: { inst: 'String Ensemble', fx: 'Ballad Hall', in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:1 solo:1 outro:1') }, hook: { on: false },
          rhythm: { vol: 0.54, in: IN('intro:0 verse:0 pre:0 chorus:1 bridge:.5 solo:1 outro:.5'), riffs: {
            chorus: ['0:C:8a 8:C:8', '0:C:8a 8:C:6 14:C:2', '0:C:6a 6:C:2 8:C:8'], solo: ['0:C:8a 8:C:6 14:C:2'], bridge: ['0:C:16'] } },
          lead: { in: IN('intro:0 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:1') } } }
    }
  });

  /* =========================================================== VAN HALEN == */
  /* Library: 109 songs. 116 BPM typical (88–196), 39 % minor, 12 % of the bars shuffled, ONE guitar (no rhythm
   * guitar under the solos: bass and drums carry them), power chords 37–43 % and low riffs 22–28 % of the rhythm
   * bars, rhythm "O.....O........." and "O.o.o.O.o.o.O.O."; lead: 23 % legato, 9 % tapping, 35 % triplets, harmonics
   * and whammy bar; drums: kick "X.......X.x.....", OPEN hi-hat in the verses; bass: root 8ths (86 %); synth lead
   * in 7 % of the songs with the rhythm "C.....n.....n..."; singer: pickups at the end of the bar in the verses,
   * short shouted hooks in the chorus, high backing harmonies. */
  band('Van Halen', {
    band: 'vanhalen',
    desc: 'Party hard rock with one guitar: riffs made of triads and sus4 chords over a muted open-string pedal, harmonics, a showman singer with high backing harmonies, and solos with tapping, legato and whammy dives over just bass and drums. Also fast shuffle boogies and synth-driven anthems.',
    tempo: [112, 150, 128], swing: 0, grid: 8, key: { major: 'A', minor: 'A' }, mode: 'major',
    keys: { major: ['A', 'D', 'E', 'C', 'G'], minor: ['A', 'E', 'B', 'D'] }, minor: 0.39,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('I–I–IV–IV', 'major', 'verse chorus intro', 'I I IV IV', 'rocker boogie'), P('I–bVII–I–bVII', 'major', 'verse intro', 'I bVII I bVII', 'rocker boogie'),
      P('I–IV–V–IV', 'major', 'verse chorus solo', 'I IV V IV', 'rocker boogie'), P('I–I–V–V', 'major', 'verse', 'I I V V', 'rocker boogie'),
      P('I·bIII–IV (riff)', 'major', 'verse solo', 'I I-bIII IV IV', 'rocker'), P('Chorus: I–I–vi–vi', 'major', 'chorus', 'I I vi vi', 'rocker'),
      P('Chorus: IV–V–I–I', 'major', 'chorus', 'IV V I I', 'rocker boogie'), P('Chorus: V–V–I–I', 'major', 'chorus', 'V V I I', 'rocker boogie'),
      P('Chorus: bVII–IV–I–I', 'major', 'chorus', 'bVII IV I I', 'rocker'), P('Pre: vi–vi–IV–V', 'major', 'pre', 'vi vi IV V', 'rocker boogie'),
      P('Pre: IV–IV–V–V', 'major', 'pre bridge', 'IV IV V V'), P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I'), P('Bridge: ii–ii–IV–V', 'major', 'bridge', 'ii ii IV V'),
      P('12-bar boogie', 'major', 'verse solo', 'I I I I IV IV I I V IV I V', 'boogie'),
      P('Minor i–i·bIII (riff)', 'minor', 'verse intro solo', 'i i-bIII i i-bVII', 'rocker boogie'), P('Minor i–bVII–i–bVII', 'minor', 'verse chorus', 'i bVII i bVII', 'rocker boogie'),
      P('Minor i–i–bVII–bVI', 'minor', 'verse solo', 'i i bVII bVI', 'rocker boogie'), P('Minor chorus: bVI–bVII–i', 'minor', 'chorus', 'bVI bVII i i', 'rocker boogie'),
      P('Minor chorus: i–bIII–bVII–IV', 'minor', 'chorus solo', 'i bIII bVII IV', 'rocker boogie'), P('Minor pre: iv–iv–bVII–bVII', 'minor', 'pre bridge', 'iv iv bVII bVII'),
      P('Synth I–IV–V', 'major', 'verse intro solo', 'I IV V V', 'synth'), P('Synth I–V–IV–V', 'major', 'verse chorus', 'I V IV V', 'synth'),
      P('Synth chorus: IV–V–I–I', 'major', 'chorus', 'IV V I I', 'synth'), P('Synth chorus: I–IV–I–V', 'major', 'chorus intro', 'I IV I V', 'synth'),
      P('Synth chorus: vi–IV–V–V', 'major', 'chorus pre', 'vi IV V V', 'synth'),
      P('Synth minor i–bVI–bVII–i', 'minor', 'verse chorus solo intro', 'i bVI bVII i', 'synth'), P('Synth minor chorus: bIII–bVII–i', 'minor', 'chorus', 'bIII bVII i i', 'synth')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.9, pat: {
        intro: { kick: 'X.......X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...' },
        verse: { kick: 'X.......X.x.....X.x.....X.x.....', snare: '....X.......X.......X.......X...', hho: 'X...X...X...X...X...X...X...X...', hhc: '..x...x...x...x...x...x...x...x.' },
        pre: { kick: 'X.x.....X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.x.....X.x.....X.x...x.X.x.....', snare: '....X.......X.......X.......X.x.', ride: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.x.' },
        solo: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', tom2: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........XX..XX..', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2',
        pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:N:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2',
        solo: '0:R:2 2:R:2 4:R:2 6:8:2 8:R:2 10:R:2 12:5:2 14:b7:2', bridge: '0:R:6 6:R:2 8:R:6 14:R:2' } } }),
      // the only guitar: it stops when the solo starts (bass and drums alone under the lead)
      T('rhythm', 'Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'vh', 'power', 'pedal', 'octriff', 'stabs', 'sus4'], fx: 'Rock Distortion (DS-1)', vol: 0.66, pan: -0.25, in: IN('solo:0'),
        riffs: {
          verse: ['0:T:2a 2:k0:1p 3:k0:1p 4:S:2 6:T:2 8:k0:1p 9:k0:1p 10:T:2a 12:k0:2p 14:S:2 | 0:T:2a 2:k0:1p 3:k0:1p 4:S:2 6:T:2 8:k0:2p 10:C:4a 14:k0:2p',
                  '0:C:6a 6:C:2 8:k0:2p 10:k0:2p 12:k0:2p 14:k0:2p | 0:C:6a 6:C:2 8:k0:2p 10:k3:1 11:k4:1h 12:k7:2 14:k5:2',
                  '0:C:2a 2:c:1p 3:c:1p 4:c:2p 6:C:2a 8:c:1p 9:c:1p 10:c:2p 12:C:2a 14:C:2',
                  '0:k0:1p 1:k0:1p 2:T:2a 4:k0:1p 5:k0:1p 6:S:2a 8:k0:1p 9:k0:1p 10:T:2a 12:k0:1p 13:k0:1p 14:T:2',
                  '0:0:2p 2:0:1p 3:3:1 4:4:2h 6:0:2p 8:7:2 10:5:1 11:7:1h 12:0:2p 14:C:2a | 0:0:2p 2:0:1p 3:3:1 4:4:2h 6:0:2p 8:10:2 10:12:2 12:C:4a'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:C:2a 14:C:2a'],
          chorus: ['0:C:6a 6:C:6a 12:C:2 14:C:2', '0:O:6a 6:O:2 8:O:4 12:T:2 14:S:2', '0:C:3a 3:C:3 6:C:2 8:C:3 11:C:3 14:C:2', '0:T:4a 4:S:2 6:T:4 10:S:2 12:T:4'],
          bridge: ['0:C:16r', '0:T:8r 8:S:8r']
        } }),
      T('synth', 'Synthesizer', 'harmony', 'Synthesizer - Warm Poly', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'pad', 'arp'], fx: 'Synth Wide', vol: 0.6, pan: 0.2,
        p: { chords: { intro: '0:6 6:6 12:4', verse: '0:6 6:6 12:4', pre: '0:4 4:4 8:4 12:4', chorus: '0:6 6:6 12:2 14:2', bridge: '0:16', solo: '0:6 6:6 12:4', outro: '0:6 6:6 12:4' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.76, pan: 0.1, lead: true, in: IN('intro:0 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:.5'),
        mel: { bends: true, vibrato: true, slides: true, harmonics: true, fast: true, triplets: true, complex: true } })
    ],
    vocal: { gender: 'male', range: [57, 74], voices: 2, choir: ['harmony', 'hook', 'harmony'], scoop: 0.35, melisma: 0.05, lift: 4, blue: true, above: true,
      reg: { verse: 0.4, pre: 0.5, chorus: 0.62, bridge: 0.5, outro: 0.6 },
      cells: {
        verse: CE('8:4 12:2 14:2 | 0:2 2:4 6:2 10:2 12:2 14:2 | 4:2 6:2 8:2 10:2 12:2 14:2 | 0:2 2:2 4:2 6:2 12:2 14:2 | 0:4 4:2 6:2 10:2 12:2 14:2'),
        pre: CE('0:2 2:2 4:2 6:2 8:4 12:4 | 0:4 4:4 8:4 12:2 14:2'),
        chorus: CE('0:4 4:2 6:6 12:2 14:2 | 0:2 2:2 4:2 6:2 8:2 10:4 14:2 | 0:2 2:2 4:2 6:2 8:4 12:4 | 0:4 4:4 8:8'),
        bridge: CE('0:8 8:8 | 0:4 4:4 8:8')
      } },
    leadPlan: {},
    melody: { heroes: ['vanhalen'], scales: ROCK_SCALES },
    types: {
      rocker: { n: 'Riff rocker — triads over a pedal, tapping solo', w: 4,
        d: 'One guitar, one riff: triads and sus4 chords over a muted pedal note, open hi-hat in the verse, high harmonies in the chorus, and a solo over bass and drums alone.' },
      boogie: { n: 'Fast shuffle boogie — swung 8ths, double-time feel', w: 2,
        d: 'Swung and fast: boogie riff, shuffle on the ride, 12-bar verses when the idea picks them, a wild solo.',
        set: { tempo: [136, 176, 152], swing: 0.6, minor: 0.15 },
        tracks: {
          drums: { pat: {
            intro: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'x.....x.x.....x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.....x.X.....x.' },
            pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { p: { style: { verse: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', chorus: '0:R:2 2:R:2 4:5:2 6:6:2 8:R:2 10:R:2 12:5:2 14:A:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', pre: '0:R:4 4:R:4 8:R:4 12:R:2 14:A:2' } } },
          rhythm: { riffs: {
            verse: ['0:c:2 2:c:2p 4:c+2:2 6:c:2p 8:c:2 10:c:2p 12:c+2:2 14:c:2p', '0:0:2p 2:0:2p 4:3:1 5:4:1h 6:0:2p 8:7:2 10:9:2 12:10:2 14:9:2', '0:C:2a 2:0:2p 4:7:2 6:9:2 8:C:2a 10:0:2p 12:10:2 14:9:2'],
            pre: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'], chorus: ['0:C:6a 6:C:6a 12:C:2 14:C:2', '0:C:2a 2:c:2p 4:C:2a 6:c:2p 8:C:2a 10:c:2p 12:C:2 14:C:2'], bridge: ['0:C:16r'] } } } },
      synth: { n: 'Synth anthem — keyboard riff, guitar in the chorus', w: 2,
        d: 'A bright synthesizer plays the riff in dotted rhythm (intro and verses); the guitar waits for the pre-chorus, the chorus is major and wide, and the guitar solo arrives over the synth.',
        set: { tempo: [118, 136, 128], minor: 0.15, key: { major: 'C', minor: 'A' }, keys: { major: ['C', 'G', 'D', 'A'], minor: ['A', 'E'] } },
        tracks: { synth: { on: true },
          rhythm: { vol: 0.58, in: IN('intro:0 verse:0 pre:1 chorus:1 bridge:.5 solo:0 outro:1'), riffs: {
            pre: ['0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:C:2a 14:C:2a'], chorus: ['0:C:6a 6:C:6a 12:C:2 14:C:2', '0:C:8a 8:C:6 14:C:2', '0:O:6a 6:O:6 12:O:4'], bridge: ['0:C:16r'] } },
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X.x.....X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          lead: { in: IN('intro:0 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:.5') } } }
    }
  });

  /* =============================================================== QUEEN == */
  /* Library: 111 songs. 110 BPM typical (73–167), 25 % minor, keys D / A / G / C and the piano keys Bb / F; piano in
   * 38 % of the songs (34 % of the verse bars; quarter-note chords "C...C...C...C..." and 8th-note chords), strings
   * in 20 %; three vocal tracks in a quarter of the songs (the choir); 27 % of the lead bars are two guitars in
   * harmony; verses of 14 bars; singer in quarter notes ("0:4 4:4 8:4 12:4"); bass in quarter notes; drums: kick on
   * 1 and 3, ride in quarters in the verse; almost no palm muting (1 %). */
  band('Queen', {
    band: 'queen',
    desc: 'Theatrical rock: a piano at the centre of half the songs, a wide-ranging singer answered by a three-part choir, melodic bass, and a guitar that sings in harmony with itself (two lead guitars in thirds). Hard-rock stompers, piano anthems and bass-driven funk grooves.',
    tempo: [104, 136, 118], swing: 0, grid: 8, key: { major: 'D', minor: 'E' }, mode: 'major',
    keys: { major: ['D', 'A', 'G', 'C', 'E'], minor: ['E', 'A', 'B', 'D'] }, minor: 0.25,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Bridge:8 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Bridge:8 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('I–IV–IV–I', 'major', 'verse intro', 'I IV IV I', 'rock'), P('I–bVII–IV–I', 'major', 'verse chorus solo', 'I bVII IV I', 'rock'),
      P('I–I–IV–IV', 'major', 'verse', 'I I IV IV', 'rock'), P('I·V (two chords a bar)', 'major', 'verse solo', 'I-V I-V IV-I V', 'rock'),
      P('Chorus: V–V–I–I', 'major', 'chorus', 'V V I I', 'rock'), P('Chorus: IV–I–V–I', 'major', 'chorus', 'IV I V I', 'rock'), P('Chorus: bVII–vi–V–V', 'major', 'chorus pre', 'bVII vi V V', 'rock'),
      P('Pre: IV–V', 'major', 'pre', 'IV IV V V', 'rock'), P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I', 'rock piano'),
      P('Minor i–i–i–IV', 'minor', 'verse intro solo', 'i i i IV', 'rock'), P('Minor i–bVII–bVI–V7', 'minor', 'verse chorus solo', 'i bVII bVI V7', 'rock'),
      P('Minor i–i–iv–iv', 'minor', 'verse', 'i i iv iv', 'rock'), P('Minor chorus: bVI–bVII–i', 'minor', 'chorus', 'bVI bVII i i', 'rock'), P('Minor chorus: bIII–bVII–i–V7', 'minor', 'chorus', 'bIII bVII i V7', 'rock'),
      P('Minor pre: iv–V7', 'minor', 'pre bridge', 'iv iv V7 V7', 'rock piano'),
      // the piano songs: richer harmony — secondary dominants, the minor IV, two chords a bar
      P('Piano I–iii–vi–IV', 'major', 'verse intro', 'I iii vi IV', 'piano'), P('Piano I·V–vi·iii–IV·I–ii·V', 'major', 'verse solo', 'I-V vi-iii IV-I ii-V', 'piano'),
      P('Piano I–III7–vi–IV', 'major', 'verse', 'I III7 vi IV', 'piano'), P('Piano I–I7–IV–iv', 'major', 'verse chorus', 'I I7 IV iv', 'piano'),
      P('Piano vi–ii–V–I', 'major', 'verse bridge', 'vi ii V7 I', 'piano'), P('Piano chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'piano'),
      P('Piano chorus: I–V–vi–IV·iv', 'major', 'chorus solo', 'I V vi IV-iv', 'piano'), P('Piano chorus: IV·V–iii·vi–ii·V–I', 'major', 'chorus', 'IV-V iii-vi ii-V7 I', 'piano'),
      P('Piano pre: ii–V–iii–VI7', 'major', 'pre', 'ii V7 iii VI7', 'piano'),
      P('Piano minor i–V7–i–iv', 'minor', 'verse intro', 'i V7 i iv', 'piano'), P('Piano minor i–bVI–bIII–bVII', 'minor', 'verse chorus solo', 'i bVI bIII bVII', 'piano'),
      P('Piano minor chorus: iv–bVII–bIII–V7', 'minor', 'chorus bridge', 'iv bVII bIII V7', 'piano'),
      P('Funk vamp i–i–IV–IV', 'minor', 'verse intro solo', 'i7 i7 IV7 IV7', 'funk'), P('Funk i–bVII', 'minor', 'verse chorus', 'i7 bVII i7 bVII', 'funk'),
      P('Funk chorus: iv–i–iv–V', 'minor', 'chorus bridge', 'iv7 i7 iv7 V7', 'funk'), P('Funk chorus: bVI–bVII–i', 'minor', 'chorus pre', 'bVI bVII i7 i7', 'funk'),
      P('Funk major I–IV vamp', 'major', 'verse intro solo chorus', 'I7 I7 IV7 IV7', 'funk'), P('Funk major chorus: IV–V–I', 'major', 'chorus bridge pre', 'IV V I I', 'funk')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.86, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......X.......X.x.....', snare: '....X.......X.......X.......X...', ride: 'x...x...x...x...x...x...x...x...' },
        pre: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...', hhc: '..x...x...x...x.' },
        solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x...x...x...x...' },
        fill: { snare: '........X.X.X...', tom1: '............XX..', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', '8ths'], fx: 'Dry', vol: 0.84, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:4 4:R:4 8:R:4 12:R:2 14:A:2', pre: '0:R:4 4:R:4 8:5:4 12:R:4',
        chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:4 4:5:4 8:R:4 12:3:2 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'mix', 'arp', 'pad'], fx: 'Room', vol: 0.66, pan: -0.15,
        mix: { intro: 'arp', verse: 'chords', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { intro: '0.1.2.3.2.1.2.3.', bridge: '0.2.1.3.2.3.1.2.', outro: '0.1.2.3.2.1.2.3.' },
          chords: { intro: '0:8 8:8', verse: '0:4 4:4 8:4 12:4', pre: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:4 4:4 8:4 12:2 14:2', bridge: '0:8 8:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'stabs', 'sus4', 'bassriff', 'arpriff', 'funkline'], fx: 'Rock Distortion (DS-1)', vol: 0.6, pan: 0.4,
        riffs: {
          intro: ['0:C:8a 8:C:8', '0:O:8r 8:O:8r'],
          verse: ['0:C:4a 4:C:4 8:C:4 12:C:4', '0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2', '0:0:2 2:0:2 4:7:2 6:0:2 8:5:2 10:0:2 12:3:2 14:4:2h | 0:0:2 2:0:2 4:7:2 6:0:2 8:C:4a 12:C:4',
                  '0:C:3a 3:C:1. 4:C:2 8:C:3a 11:C:1. 12:C:2 | 0:C:3a 3:C:1. 4:C:2 8:C:2a 10:C:2 12:C:4', '0:O:4a 4:O:4 8:O:4 12:T:2 14:S:2'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:4', '0:C:8a 8:C:8'],
          chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:O:4a 4:O:4 8:O:4 12:O:2 14:O:2', '0:C:4a 4:C:2 6:C:2 8:C:4 12:C:4', '0:C:3a 3:C:1 4:C:2 6:C:2 10:C:2 12:C:2 14:C:2'],
          bridge: ['0:C:16', '0:C:8 8:C:8'],
          solo: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', on: false, play: 'strum', plays: ['strum', 'arp'], fx: 'Room', vol: 0.46, pan: 0.35,
        p: { strum: { verse: 'D...D.DU.UDUD.DU', chorus: 'D.DUD.DUD.DUD.DU', intro: 'D.......D.......' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.42, in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.72, pan: -0.25, lead: true, in: IN('intro:0 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:.5'),
        mel: { bends: true, vibrato: true, slides: true } }),
      // the "guitar orchestra": a second lead guitar a third / sixth away from the first
      T('lead2', 'Lead Guitar (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.58, pan: 0.25, in: IN('intro:0 verse:0 pre:0 chorus:0 bridge:0 solo:1 outro:1') })
    ],
    vocal: { gender: 'male', range: [55, 76], voices: 3, choir: ['harmony', 'oohs', 'harmony'], scoop: 0.2, melisma: 0.2, lift: 6,
      reg: { verse: 0.34, pre: 0.5, chorus: 0.66, bridge: 0.55, outro: 0.55 },
      cells: {
        verse: CE('0:4 4:4 8:4 12:4 | 0:4 4:4 8:4 12:2 14:2 | 0:6 6:6 12:4 | 0:2 2:4 6:2 12:4 | 0:2 2:2 4:4 8:2 10:2 12:4'),
        pre: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:2 6:2 8:4 12:4'),
        chorus: CE('0:4 4:4 8:4 12:4 | 0:8 8:4 12:4 | 0:4 4:2 6:6 12:4 | 0:6 6:2 8:8 | 0:4 4:4 8:8'),
        bridge: CE('0:8 8:8 | 0:12 12:4 | 0:4 4:4 8:8')
      } },
    leadPlan: {},
    melody: { heroes: ['may'], scales: ROCK_SCALES },
    types: {
      rock: { n: 'Hard-rock stomper — riff, choir chorus, harmonised solo', w: 3,
        d: 'Guitar riff and a stomping beat in the verse, the three-part choir joins the singer in the chorus, and the solo is played by two guitars in harmony.' },
      piano: { n: 'Piano anthem — piano, choir, guitar orchestra', w: 3,
        d: 'The piano carries the song (quarter-note chords in the verse, 8th-note chords in the chorus) over a melodic bass; richer harmony (secondary dominants, the minor IV); strings and the choir build to the last chorus; the guitars arrive for the harmonised solo.',
        set: { tempo: [72, 124, 96], minor: 0.2, key: { major: 'C', minor: 'A' }, keys: { major: ['C', 'F', 'Bb', 'G', 'D', 'Eb'], minor: ['A', 'E', 'D', 'G'] },
          vocal: { gender: 'male', range: [53, 76], voices: 3, choir: ['oohs', 'harmony', 'harmony'], scoop: 0.2, melisma: 0.3, lift: 6,
            reg: { verse: 0.3, pre: 0.48, chorus: 0.66, bridge: 0.55, outro: 0.5 },
            cells: { verse: CE('0:4 4:4 8:4 12:4 | 0:6 6:6 12:4 | 2:2 4:4 8:8 | 0:4 4:2 6:6 12:4'), pre: CE('0:4 4:4 8:4 12:4'), chorus: CE('0:8 8:8 | 0:6 6:2 8:8 | 0:4 4:4 8:4 12:4 | 0:4 4:4 8:8'), bridge: CE('0:12 12:4 | 0:8 8:8') } } },
        tracks: { piano: { on: true }, strings: { on: true },
          drums: { vol: 0.8, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.......X.x.....', snare: '....X.......X...', ride: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0'), p: { style: { verse: '0:R:4 4:R:4 8:5:4 12:R:2 14:A:2', pre: '0:R:4 4:3:4 8:5:4 12:R:4', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:4 4:5:4 8:R:4 12:3:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { vol: 0.52, in: IN('intro:0 verse:0 pre:0 chorus:.5 bridge:0 solo:1 outro:1'), riffs: { chorus: ['0:C:8a 8:C:8', '0:C:8a 8:C:6 14:C:2'], solo: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'] } },
          lead: { in: IN('intro:0 verse:0 pre:0 chorus:0 bridge:.5 solo:1 outro:1') } } },
      funk: { n: 'Bass-riff groove — funk bass, dry drums, sparse guitar', w: 2,
        d: 'The bass plays the riff; dry four-on-the-floor drums with the hi-hat opening on the off-beats, muted 16th-note guitar, electric piano stabs, and a singer who jumps up for the chorus.',
        set: { tempo: [104, 120, 110], minor: 0.75, key: { major: 'E', minor: 'E' }, keys: { major: ['E', 'A', 'D'], minor: ['E', 'A', 'D', 'B'] },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Chorus:8 Outro:8',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Verse:8 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [55, 76], voices: 2, choir: ['hook', 'harmony'], scoop: 0.25, melisma: 0.1, lift: 6, blue: true,
            reg: { verse: 0.35, chorus: 0.68, bridge: 0.5, outro: 0.55 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 14:2 | 0:2 2:2 4:4 10:2 12:2 14:2 | 4:2 6:2 8:2 10:2 12:4'), chorus: CE('0:4 4:2 6:6 12:4 | 0:3 3:3 6:2 8:8 | 0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { vol: 0.84, pat: {
            intro: { kick: 'X...X...X...X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x...x...x...x...', hho: '..x...x...x...x.' },
            solo: { kick: 'X...X...X...X...', snare: '....X.......X..x', hhc: 'x...x...x...x...', hho: '..x...x...x...x.' },
            bridge: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '........X..X.XXX', tom1: '................', tom2: '................', kick: 'X...X...X...X...' } } },
          bass: { vol: 0.92, p: { style: {
            intro: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2', verse: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2',
            chorus: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:b7:2 12:5:2 14:A:2', solo: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2', bridge: '0:R:6 6:R:2 8:5:4 12:b7:4' } } },
          rhythm: { play: 'funkline', fx: 'Funk (Comp + Clean)', vol: 0.5 },
          piano: { on: true, inst: 'Electric Piano', vol: 0.5, p: { chords: { intro: '4:2 12:2', verse: '4:2 10:2 12:2', pre: '0:4 4:4 8:4 12:4', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', solo: '4:2 10:2 12:2', bridge: '0:8 8:8' } } },
          lead: { in: IN('intro:0 verse:.5 pre:0 chorus:0 bridge:.5 solo:1 outro:.5') }, lead2: { in: IN('intro:0 verse:0 pre:0 chorus:0 bridge:0 solo:0 outro:0'), on: false } } }
    }
  });

  /* ============================================================== BOSTON == */
  /* Library: 8 songs (small sample — completed with what the band is known for). 116 BPM (110–130), every song in a
   * major key (G, E, C, A, D), acoustic guitar in 77 % of the songs, organ in 28 % of the verse bars and 36 % of the
   * solo bars, 30 % of the lead bars are two guitars in harmony, verses of 16 bars, bass "root – octave" in quarter
   * notes, chorus rhythm "O.....O.....O...", no palm muting, a very high singer (65–72 in the chorus) with stacked
   * harmonies. */
  band('Boston', {
    band: 'boston',
    desc: '70s arena rock, polished like a studio orchestra: strummed acoustic guitars under thick distorted power chords, Hammond organ, hand-clap choruses, a very high clean tenor with stacked harmonies, and lead guitars that play melodies in harmony.',
    tempo: [108, 132, 118], swing: 0, grid: 8, key: { major: 'G', minor: 'E' }, mode: 'major',
    keys: { major: ['G', 'E', 'C', 'A', 'D'], minor: ['E', 'A', 'B'] }, minor: 0.06,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Verse:16 Chorus:8 Solo:8 Bridge:8 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:16 Pre-Chorus:4 Chorus:8 Verse:16 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('I–IV–vi–V', 'major', 'verse intro', 'I IV vi V'), P('I–I–I–I·IV', 'major', 'verse', 'I I I I-IV'), P('I–V–vi–IV', 'major', 'verse chorus solo', 'I V vi IV'),
      P('I–bVII–IV–IV', 'major', 'verse solo', 'I bVII IV IV'), P('vi–IV–I–V', 'major', 'verse intro solo', 'vi IV I V'),
      P('Chorus: IV·I–V', 'major', 'chorus', 'IV-I V IV-I V'), P('Chorus: I–IV–V–IV', 'major', 'chorus solo', 'I IV V IV'), P('Chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi'),
      P('Chorus: I·V–vi·IV', 'major', 'chorus', 'I-V vi-IV I-V IV-V'), P('Pre: ii–IV–V', 'major', 'pre', 'ii IV V V'), P('Pre: IV–V–IV–V', 'major', 'pre', 'IV V IV V'),
      P('Bridge: vi–V–IV–V', 'major', 'bridge', 'vi V IV V'), P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I'),
      P('Minor i–bVII–bVI–bVII', 'minor', 'verse intro solo', 'i bVII bVI bVII'), P('Minor i–bVI–bIII–bVII', 'minor', 'verse chorus solo', 'i bVI bIII bVII'),
      P('Minor chorus: bVI–bVII–i', 'minor', 'chorus bridge pre', 'bVI bVII i i')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.84, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......X.......X.x.....', snare: '....X.......X.......X.......X...', hhc: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.x.' },
        pre: { kick: 'X.......X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...' },
        chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.', clap: '....x.......x...' },
        solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', hhc: 'x...x...x...x...' },
        fill: { snare: '........X.X.XX..', tom1: '..............X.', tom2: '...............X', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.84, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:4 4:8:4 8:R:4 12:8:4', pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2',
        chorus: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2', solo: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', play: 'mix', plays: ['mix', 'strum', 'arp'], fx: 'Room', vol: 0.52, pan: -0.35,
        mix: { intro: 'arp', verse: 'strum', pre: 'strum', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { arp: { intro: '0.2.3.4.3.2.3.2.', bridge: '0.2.3.2.4.2.3.2.' }, strum: { verse: 'D...D.DU.UDUD.DU', pre: 'D.DUD.DUD.DUD.DU', chorus: 'D.DUD.DUD.DUD.DU', solo: 'D...D.DU.UDUD.DU' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'stabs', 'sus4', 'arpriff'], fx: 'Rock Distortion (DS-1)', vol: 0.6, pan: 0.4, in: IN('intro:.5'),
        riffs: {
          verse: ['0:C:6a 6:C:6 12:C:4', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4', '0:C:6a 6:C:2 8:C:2 10:C:6', '0:O:6a 6:O:6 12:T:2 14:S:2'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:C:8a 8:C:8'],
          chorus: ['0:C:6a 6:C:6a 12:C:4', '0:O:6a 6:O:6a 12:O:2 14:O:2', '0:C:3a 3:C:3 6:C:2 8:C:3 11:C:3 14:C:2'],
          bridge: ['0:C:16r', '0:O:8r 8:O:8r'],
          solo: ['0:C:6a 6:C:6a 12:C:4', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4']
        } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.42, pan: 0.2, in: IN('intro:.5 verse:1 pre:1 chorus:.5 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.7, pan: -0.2, lead: true, in: IN('intro:1 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true } }),
      T('lead2', 'Lead Guitar (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.56, pan: 0.2, in: IN('intro:1 verse:0 pre:0 chorus:0 bridge:0 solo:1 outro:1') })
    ],
    vocal: { gender: 'male', range: [57, 77], voices: 3, choir: ['harmony', 'oohs', 'harmony'], scoop: 0.15, melisma: 0.12, lift: 6, above: true,
      reg: { verse: 0.42, pre: 0.55, chorus: 0.7, bridge: 0.55, outro: 0.6 },
      cells: {
        verse: CE('0:2 2:2 4:2 6:2 8:2 10:4 14:2 | 2:2 4:4 8:2 10:2 12:2 14:2 | 6:2 8:2 10:2 12:2 14:2 | 0:2 2:2 4:2 6:6 12:4 | 0:4 4:4 8:4 12:4'),
        pre: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 8:8'),
        chorus: CE('0:6 6:4 10:6 | 0:4 4:4 8:8 | 0:8 8:4 12:4 | 0:6 6:2 8:8 | 0:4 4:8 12:4'),
        bridge: CE('0:8 8:8 | 0:12 12:4')
      } },
    leadPlan: { intro: 'melody', outro: 'melody' },
    melody: { heroes: ['scholz'], scales: ROCK_SCALES },
    types: {
      anthem: { n: 'Arena anthem — acoustic + power chords, harmony leads', w: 3,
        d: 'Two guitars in harmony open with the theme; strummed acoustic guitar, organ and long power chords carry 16-bar verses; the chorus adds claps and stacked harmonies; the solo is a melody played by two guitars.' },
      rocker: { n: 'Boogie rocker — driving 8ths, organ solo spots', w: 2,
        d: 'Faster: 8th-note power chords and bass, organ in full, hand claps on 2 and 4 through the chorus and the solo.',
        set: { tempo: [124, 144, 132], leadPlan: { intro: 'rest', outro: 'solo' } },
        tracks: {
          rhythm: { in: IN('intro:1'), riffs: {
            verse: ['0:C:2a 2:c:2 4:c:2 6:C:2a 8:c:2 10:c:2 12:C:2a 14:c:2', '0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:C:3a 3:C:1. 4:C:2 6:C:2 10:C:2 12:C:2 14:C:2'],
            pre: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'], chorus: ['0:C:6a 6:C:6a 12:C:2 14:C:2', '0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2'], bridge: ['0:C:16r'] } },
          bass: { p: { style: { intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', chorus: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2', solo: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2' } } },
          drums: { pat: {
            intro: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: 'x...x...x...x...' },
            chorus: { kick: 'X.x.....X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...', clap: '....x.......x...' },
            solo: { kick: 'X.x.....X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.', clap: '....x.......x...' },
            fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          lead: { in: IN('intro:0 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:1') }, lead2: { in: IN('intro:0 verse:0 pre:0 chorus:0 bridge:0 solo:1 outro:0') } } }
    }
  });

  /* ========================================================== THIN LIZZY == */
  /* Library: 12 songs (small sample — completed with what the band is known for). 142 BPM typical (92–160), 83 % major
   * (A, G, E), 27 % of the bars shuffled, no keyboards, two guitars: 67 % of the lead bars are twin leads in harmony,
   * rhythm in straight 8th-note chords (major chords 41 %, power chords 25 %), verses of 16 bars, long intros (the
   * twin-lead theme), solos of 16 bars; bass: root 8ths with an approach note; drums: kick "X.......X.x.....". */
  band('Thin Lizzy', {
    band: 'thinlizzy',
    desc: 'Twin-guitar hard rock: two lead guitars play the theme in harmony (intro and after every chorus), a storytelling baritone who sings behind the beat, driving 8th-note chords, a melodic bass. Straight rockers, swung shuffles with a Celtic lilt, and soulful ballads.',
    tempo: [124, 156, 140], swing: 0, grid: 8, key: { major: 'A', minor: 'E' }, mode: 'major',
    keys: { major: ['A', 'G', 'E', 'D'], minor: ['E', 'A', 'B', 'F#'] }, minor: 0.17,
    structures: {
      Short: 'Intro:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Theme:4 Verse:16 Chorus:8 Solo:16 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:16 Chorus:8 Theme:4 Verse:16 Chorus:8 Bridge:8 Solo:16 Verse:8 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('I–vi–V–IV', 'major', 'verse intro solo', 'I vi V IV'), P('I–IV–I–V', 'major', 'verse', 'I IV I V'), P('I–bVII–IV–I', 'major', 'verse solo', 'I bVII IV I'),
      P('I–I–IV–IV', 'major', 'verse', 'I I IV IV'), P('I–iii–IV–V', 'major', 'verse intro', 'I iii IV V'),
      P('Chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi'), P('Chorus: IV–I–V–V', 'major', 'chorus', 'IV I V V'), P('Chorus: vi–IV–I–V', 'major', 'chorus solo intro', 'vi IV I V'),
      P('Chorus: bVII–IV–I–I', 'major', 'chorus', 'bVII IV I I'), P('Bridge: ii–IV–V', 'major', 'bridge', 'ii ii IV V'), P('Bridge: vi–V–IV–V', 'major', 'bridge', 'vi V IV V'),
      P('Minor i–bVII–bVI–bVII', 'minor', 'verse intro solo', 'i bVII bVI bVII'), P('Minor i–i–bVII–bVII', 'minor', 'verse', 'i i bVII bVII'),
      P('Minor i–bIII–bVII–i', 'minor', 'verse solo', 'i bIII bVII i'), P('Minor chorus: bVI–bVII–i', 'minor', 'chorus', 'bVI bVII i i'),
      P('Minor chorus: bIII–bVII–i–bVI', 'minor', 'chorus intro', 'bIII bVII i bVI'), P('Minor bridge: iv–bVII–bIII–V7', 'minor', 'bridge', 'iv bVII bIII V7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.86, pat: {
        intro: { kick: 'X.......X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...' },
        verse: { kick: 'X.......X.x.....X.....x.X.x.....', snare: '....X.......X.......X.......X...', hhc: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.x.' },
        chorus: { kick: 'X.x.....X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        solo: { kick: 'X.x...x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...', hhc: '..x...x...x...x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', tom2: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........XX.XX...', tom1: '.............XX.', tom2: '...............X', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2',
        chorus: '0:R:2 2:R:2 4:8:2 6:R:2 8:R:2 10:5:2 12:6:2 14:A:2', solo: '0:R:2 2:R:2 4:5:2 6:R:2 8:R:2 10:b7:2 12:5:2 14:A:2', bridge: '0:R:4 4:R:4 8:5:4 12:R:4' } } }),
      T('rhythm', 'Rhythm Guitar (left)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'stabs', 'sus4', 'bassriff'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.58, pan: -0.5,
        riffs: {
          intro: ['0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2'],
          verse: ['0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2', '0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:C:2',
                  '0:C:3a 3:C:1. 6:C:2 8:C:3a 11:C:1. 14:C:2 | 0:C:3a 3:C:1. 6:C:2 8:C:2a 10:C:2 12:C:4', '0:O:2a 2:O:2 4:T:2 6:S:2 8:O:2a 10:O:2 12:T:2 14:O:2'],
          chorus: ['0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2'],
          bridge: ['0:C:8 8:C:8', '0:C:16r'],
          solo: ['0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2', '0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2']
        } }),
      T('rhythm2', 'Rhythm Guitar (right)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'stabs', 'octriff', 'bassriff'], fx: 'Rock Distortion (DS-1)', vol: 0.56, pan: 0.5, in: IN('intro:0 solo:0'),
        riffs: {
          verse: ['0:0:2 2:0:2 4:7:2 6:5:2 8:0:2 10:0:2 12:3:1 13:4:1h 14:7:2 | 0:0:2 2:0:2 4:7:2 6:5:2 8:C:4a 12:C:4', '0:C:6a 6:C:2 8:C:6a 14:C:2',
                  '0:0:2p 2:0:2p 4:C:2a 6:0:2p 8:0:2p 10:C:2a 12:0:2p 14:C:2', '0:C:4a 4:10:2 6:12:2 8:C:4a 12:7:2 14:10:2'],
          chorus: ['0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2', '0:C:8a 8:C:8', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'],
          bridge: ['0:C:16r']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', on: false, play: 'mix', plays: ['mix', 'strum', 'arp'], fx: 'Room', vol: 0.5, pan: -0.3,
        mix: { intro: 'arp', verse: 'arp', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { arp: { verse: '0.2.3.2.4.3.2.3.' }, strum: { chorus: 'D...D.DU.UDUD.DU', solo: 'D...D.DU.UDUD.DU' } } }),
      // the twin leads: the theme in the intro (and in the "Theme" sections after the chorus), in harmony
      T('lead', 'Lead Guitar 1', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.72, pan: -0.2, lead: true, in: IN('intro:1 verse:.5 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, triplets: true } }),
      T('lead2', 'Lead Guitar 2 (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.62, pan: 0.2, in: IN('intro:1 verse:0 pre:0 chorus:0 bridge:0 solo:1 outro:1') })
    ],
    vocal: { gender: 'male', range: [48, 67], voices: 2, choir: ['harmony', 'hook'], scoop: 0.35, melisma: 0.1, lift: 3, blue: true,
      reg: { verse: 0.4, chorus: 0.6, bridge: 0.5, outro: 0.5 },
      cells: {
        verse: CE('2:2 4:2 6:2 8:4 14:2 | 1:1 2:2 4:2 6:4 12:2 14:2 | 2:2 4:2 6:2 8:2 10:2 12:4 | 4:2 6:2 8:2 10:4 14:2 | 0:2 2:2 4:4 10:2 12:2 14:2'),
        chorus: CE('0:4 4:4 8:4 12:4 | 2:2 4:4 8:8 | 0:6 6:2 8:8 | 0:4 4:2 6:6 12:4'),
        bridge: CE('0:8 8:8 | 2:2 4:4 8:8')
      } },
    leadPlan: { intro: 'melody', outro: 'melody' },
    melody: { heroes: ['lizzy'], scales: ROCK_SCALES },
    types: {
      rocker: { n: 'Twin-lead rocker — harmony theme, driving 8ths', w: 3,
        d: 'The two lead guitars open with the theme in harmony and bring it back after the chorus; 16-bar verses over straight 8th-note chords; the solo is long and ends with both guitars together.' },
      shuffle: { n: 'Shuffle — swung boogie with a Celtic lilt', w: 2,
        d: 'Swung 8ths (the shuffle of the band), triplet runs in the twin leads, a boogie bass.',
        set: { tempo: [112, 138, 124], swing: 0.58 },
        tracks: {
          bass: { p: { style: { intro: '0:R:2 2:R:2 4:5:2 6:6:2 8:R:2 10:R:2 12:5:2 14:A:2', verse: '0:R:2 2:R:2 4:5:2 6:6:2 8:R:2 10:R:2 12:5:2 14:6:2', chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:8:2 10:6:2 12:5:2 14:A:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } },
          drums: { pat: {
            intro: { kick: 'X.......X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          rhythm: { riffs: {
            verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:C:2a 2:C:2 6:C:2 8:C:2a 10:C:2 14:C:2'],
            chorus: ['0:C:6a 6:C:2 8:C:4 12:C:2 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4'], bridge: ['0:C:16r'] } } } },
      ballad: { n: 'Soul ballad — clean arpeggios, harmony lead', w: 2,
        d: 'Slow and warm: clean arpeggios and acoustic guitar, a soft backbeat, the singer low and close, and a harmonised guitar melody instead of a fast solo.',
        set: { tempo: [72, 96, 84], minor: 0.3, key: { major: 'G', minor: 'A' }, keys: { major: ['G', 'D', 'A', 'C'], minor: ['A', 'E', 'B'] }, leadPlan: { intro: 'melody', solo: 'melody', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:8',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [47, 66], voices: 2, choir: ['oohs', 'harmony'], scoop: 0.35, melisma: 0.2, lift: 3, blue: true,
            reg: { verse: 0.35, chorus: 0.58, bridge: 0.5, outro: 0.45 },
            cells: { verse: CE('2:2 4:4 8:4 14:2 | 0:4 4:2 6:6 12:4 | 2:2 4:2 6:6 12:4'), chorus: CE('0:8 8:8 | 0:6 6:2 8:8 | 0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { vol: 0.76, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:.5'), p: { style: { intro: '0:R:16', verse: '0:R:6 6:R:2 8:5:4 12:R:2 14:A:2', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:6 6:R:2 8:5:4 12:R:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { play: 'arp', fx: 'Clean + Chorus', vol: 0.52, p: { arp: { verse: '0.2.3.2.4.3.2.3.', chorus: '0.2.3.4.3.2.4.3.', intro: '0.2.3.2.4.2.3.2.' } } },
          rhythm2: { vol: 0.5, in: IN('intro:0 verse:0 chorus:1 bridge:.5 solo:1 outro:.5'), riffs: { chorus: ['0:C:8a 8:C:8', '0:C:8a 8:C:6 14:C:2'], solo: ['0:C:8a 8:C:8'], bridge: ['0:C:16r'] } },
          aguitar: { on: true },
          lead: { in: IN('intro:1 verse:0 chorus:.5 bridge:.5 solo:1 outro:1') } } }
    }
  });

  /* ========================================================= THE BEATLES == */
  /* Library: 207 songs. 120 BPM typical (80–168), 79 % major (G, A, E, D, C), 92 % in 4/4; clean electric (45 %) and
   * steel acoustic (41 %) guitars — strummed open chords, almost no palm muting, few power chords; piano in 28 % of
   * the songs (8th-note chords "C.C.C.C." in verses and choruses), sax / brass 20 %, organ 15 %, strings 10 %;
   * second and third voices in a quarter of the songs; two chords a bar are common (I–V, IV–I); verses of 8–10 bars
   * and an 8-bar middle section; short solos (8 bars); singer: 4 notes a bar, quarter and 8th notes, a tenth of
   * range; bass: root in long notes, root–fifth; drums: kick on 1 and 3, closed hi-hat 8ths (open in the loud parts). */
  band('The Beatles', {
    band: 'beatles',
    desc: '60s pop-rock: two guitars that ring (strummed chords and a lead that answers the singer), a melodic bass, a simple swinging beat with hand claps, and two- and three-part vocal harmonies. From the early beat songs with their "middle eight" to acoustic ballads with strings and the studio years with piano, brass and borrowed chords.',
    tempo: [124, 160, 138], swing: 0, grid: 8, key: { major: 'G', minor: 'E' }, mode: 'major',
    keys: { major: ['G', 'A', 'E', 'D', 'C'], minor: ['E', 'A', 'D', 'B'] }, minor: 0.21,
    structures: {   // the AABA song: verse, verse, middle eight, verse
      Short: 'Intro:4 Verse:8 Verse:8 Bridge:8 Verse:8 Outro:4',
      Standard: 'Intro:4 Verse:8 Verse:8 Bridge:8 Verse:8 Solo:8 Bridge:8 Verse:8 Outro:4',
      Extended: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Verse:8 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      // beat: three chords, the vi, and the borrowed iv / bVI / bVII that colour the end of a phrase
      P('I–vi–IV–V', 'major', 'verse intro solo', 'I vi IV V', 'beat'), P('I·IV–I·V (two chords a bar)', 'major', 'verse solo', 'I-IV I-V I-IV I-V', 'beat'),
      P('I–IV–I–V', 'major', 'verse', 'I IV I V', 'beat rocker'), P('I–I–IV–V', 'major', 'verse intro', 'I I IV V', 'beat'),
      P('I–vi–ii–V', 'major', 'verse solo', 'I vi ii V', 'beat studio'), P('I–iii–IV–V', 'major', 'verse', 'I iii IV V', 'beat studio'),
      P('I–V–vi–iii', 'major', 'verse', 'I V vi iii', 'beat studio'), P('I–IV–iv–I (the minor IV)', 'major', 'verse chorus', 'I IV iv I', 'beat ballad studio'),
      P('Chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'beat'), P('Chorus: IV–I–IV–V', 'major', 'chorus', 'IV I IV V', 'beat rocker'),
      P('Chorus: I–bVII–IV–I', 'major', 'chorus solo', 'I bVII IV I', 'beat studio rocker'), P('Chorus: vi–IV–I–V', 'major', 'chorus', 'vi IV I V', 'beat ballad'),
      P('Chorus: I–bVI–bVII–I', 'major', 'chorus', 'I bVI bVII I', 'beat studio'),
      P('Middle eight: IV–IV–I–I · IV–IV–V–V', 'major', 'bridge', 'IV IV I I IV IV V V', 'beat rocker'), P('Middle eight: vi–iii–vi–iii · IV–V', 'major', 'bridge', 'vi iii vi iii IV IV V V', 'beat ballad'),
      P('Middle eight: ii–V–I–vi · ii–V', 'major', 'bridge', 'ii V I vi ii ii V V', 'beat studio ballad'), P('Middle eight: iv–bVII–bIII (new key)', 'major', 'bridge', 'iv bVII bIII bIII iv bVII V V', 'beat studio'),
      P('Minor i–bVII–bVI–V', 'minor', 'verse intro solo', 'i bVII bVI V7', 'beat studio'), P('Minor i–iv–i–V', 'minor', 'verse', 'i iv i V7', 'beat ballad'),
      P('Minor i–i–IV–IV (Dorian)', 'minor', 'verse solo', 'i i IV IV', 'beat studio rocker'), P('Minor chorus: bIII–bVII–i–i', 'minor', 'chorus', 'bIII bVII i i', 'beat studio rocker'),
      P('Minor chorus: bVI–bVII–I (to major)', 'minor', 'chorus', 'bVI bVII I I', 'beat studio ballad'), P('Minor middle eight: IV–i–IV–V (major IV)', 'minor', 'bridge', 'IV i IV i IV IV V7 V7', 'beat studio ballad rocker'),
      // ballads: descending bass lines, the major II and III
      P('Ballad I–iii–vi–IV', 'major', 'verse intro', 'I iii vi IV', 'ballad'), P('Ballad I–V–vi–IV·V', 'major', 'verse solo', 'I V vi IV-V', 'ballad'),
      P('Ballad I–Imaj7–I7–IV', 'major', 'verse', 'Imaj7 I7 IV iv', 'ballad studio'), P('Ballad I–II7–IV–I', 'major', 'verse chorus', 'I II7 IV I', 'ballad studio'),
      P('Ballad vi–V–IV–I', 'major', 'verse chorus', 'vi V IV I', 'ballad'), P('Ballad chorus: IV–I–V–vi', 'major', 'chorus', 'IV I V vi', 'ballad'),
      P('Ballad chorus: I–III7–vi–IV', 'major', 'chorus', 'I III7 vi IV', 'ballad studio'), P('Ballad minor i–bVII–bVI–V', 'minor', 'verse intro solo', 'i bVII bVI V7', 'ballad'),
      P('Ballad minor i·bVII–bVI·V', 'minor', 'verse chorus', 'i-bVII bVI-V7 i-bVII bVI-V7', 'ballad'),
      // studio years: piano songs with borrowed chords, vamps on one chord
      P('Studio I–bVII–IV–I', 'major', 'verse intro solo', 'I bVII IV I', 'studio'), P('Studio I–II–IV–I', 'major', 'verse', 'I II IV I', 'studio'),
      P('Studio I·V–vi·I7–IV·I–V', 'major', 'verse', 'I-V vi-I7 IV-I V', 'studio'), P('Studio I–bIII–IV–I', 'major', 'verse chorus', 'I bIII IV I', 'studio rocker'),
      P('Studio chorus: IV–bVII–I–I', 'major', 'chorus', 'IV bVII I I', 'studio'), P('Studio chorus: I–V–bVII–IV', 'major', 'chorus solo', 'I V bVII IV', 'studio'),
      P('Studio coda: I–bVII–IV–I (sing-along)', 'major', 'outro chorus', 'I bVII IV I', 'studio'),
      // rockers: 12-bar blues and three-chord rock and roll
      P('12-bar blues', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'rocker'), P('Rocker I–IV–I–I', 'major', 'verse intro', 'I7 IV7 I7 I7', 'rocker'),
      P('Rocker chorus: IV–IV–I–I · V–IV–I', 'major', 'chorus bridge', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'rocker'), P('Rocker chorus: V–IV–I–I', 'major', 'chorus', 'V7 IV7 I7 I7', 'rocker'),
      P('Rocker minor i–i–iv–i', 'minor', 'verse intro solo', 'i7 i7 iv7 i7', 'rocker'), P('Rocker minor chorus: bVI–V', 'minor', 'chorus bridge', 'bVI bVI V7 V7', 'rocker')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.8, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......X.......X.x.....', snare: '....X.......X.......X.......X...', hhc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.x...x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' },
        bridge: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        solo: { kick: 'X.......X.x...x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' },
        fill: { snare: '........X.XX....', tom1: '............XX..', tom2: '..............X.', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', 'walking', '8ths'], fx: 'Dry', vol: 0.86, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:6 6:R:2 8:5:6 14:A:2', chorus: '0:R:4 4:5:2 6:R:2 8:R:4 12:3:2 14:5:2',
        bridge: '0:R:6 6:R:2 8:R:4 12:5:2 14:6:2', solo: '0:R:4 4:5:2 6:R:2 8:R:4 12:3:2 14:5:2', outro: '0:R:8 8:5:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'strum', 'sus4', 'stabs', 'berry', 'arp'], fx: 'Clean + Chorus', vol: 0.58, pan: -0.45,
        riffs: {
          intro: ['0:O:8a 8:O:8', '0:O:4a 4:O:4 8:O:4 12:O:4'],
          verse: ['0:O:4a 4:O:4 8:O:4 12:O:4', '0:O:2a 2:O:2 4:O:2 6:O:2 8:O:2a 10:O:2 12:O:2 14:O:2', '0:O:4a 4:O:2 6:O:2 8:O:4 12:O:2 14:O:2',
                  '0:O:3a 3:O:3 6:O:2 8:O:3a 11:O:3 14:O:2', '4:O:2. 6:O:2 12:O:2. 14:O:2', '0:O:4a 4:T:2 6:S:2 8:O:4 12:T:2 14:S:2'],
          chorus: ['0:O:2a 2:O:2 4:O:2 6:O:2 8:O:2a 10:O:2 12:O:2 14:O:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:O:6a 6:O:2 8:O:4 12:O:2 14:O:2'],
          bridge: ['0:O:8r 8:O:8r', '0:O:4a 4:O:4 8:O:4 12:O:4', '0:T:2 2:T:2 4:T:2 6:T:2 8:T:2 10:T:2 12:T:2 14:T:2'],
          solo: ['0:O:2a 2:O:2 4:O:2 6:O:2 8:O:2a 10:O:2 12:O:2 14:O:2', '0:O:4a 4:O:2 6:O:2 8:O:4 12:O:2 14:O:2'],
          outro: ['0:O:8a 8:O:8', '0:O:16r']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', play: 'strum', plays: ['strum', 'arp', 'mix'], fx: 'Room', vol: 0.5, pan: 0.4, in: IN('intro:.5'),
        mix: { intro: 'arp', verse: 'arp', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { strum: { intro: 'D...D...D...D.DU', verse: 'D...D.DU.UDUD.DU', chorus: 'D.DUD.DUD.DUD.DU', bridge: 'D...D.DUD...D.DU', solo: 'D.DUD.DUD.DUD.DU' }, arp: { verse: '0.2.3.2.4.3.2.3.', bridge: '0.2.3.4.3.2.3.2.', intro: '0.2.3.2.4.2.3.2.' } } }),
      T('piano', 'Piano', 'harmony', 'Upright Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'mix', 'arp', 'pad'], fx: 'Room', vol: 0.6, pan: 0.15,
        p: { chords: { intro: '0:4 4:4 8:4 12:4', verse: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', bridge: '0:4 4:4 8:4 12:4', solo: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', outro: '0:4 4:4 8:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.38, pan: -0.2, in: IN('intro:0 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.44, in: IN('intro:.5 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      // the brass section plays chord stabs and long chords (a 'harmony' part, so it sounds while the singer sings)
      T('brass', 'Brass Section', 'harmony', 'Trumpet', { alt: 'horn', on: false, play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.46, pan: 0.3, in: IN('intro:0 verse:0 chorus:1 bridge:1 solo:1 outro:1'),
        p: { chords: { chorus: '0:2 6:2 8:6', bridge: '0:8 8:8', solo: '0:2 4:2 6:2 12:4', outro: '0:2 6:2 8:8' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Clean + Chorus', vol: 0.66, pan: 0.3, lead: true, in: IN('intro:1 verse:.5 chorus:.5 bridge:0 solo:1 outro:1'),
        mel: { bends: false, vibrato: true, slides: true } })
    ],
    vocal: { gender: 'male', range: [52, 71], voices: 2, choir: ['harmony', 'harmony', 'hook'], above: true, duet: true, scoop: 0.15, melisma: 0.1, lift: 3,
      reg: { verse: 0.5, chorus: 0.62, bridge: 0.66, outro: 0.55 },
      cells: {
        verse: CE('0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 8:2 10:2 12:4 | 2:2 4:2 6:2 8:4 12:4 | 0:4 4:2 6:2 8:4 | 0:2 2:4 6:2 8:8'),
        chorus: CE('0:8 8:8 | 0:4 4:4 8:4 12:4 | 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 4:4 8:4 12:4 | 0:2 2:4 6:2 8:6'),
        bridge: CE('0:4 4:4 8:8 | 0:6 6:2 8:8 | 0:2 2:2 4:4 8:4 12:4 | 0:8 8:4 12:4')
      } },
    leadPlan: { intro: 'melody', verse: 'fills', solo: 'melody' },
    melody: { heroes: ['harrison'], scales: { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, solo: { major: 'Major', minor: 'Natural Minor' }, always: true } },
    types: {
      beat: { n: 'Beat song — ringing guitars, hand claps, close harmonies', w: 3,
        d: 'The early sound: verse, verse, "middle eight", verse. Two guitars and bass, a guitar hook in the intro, the second voice a third above the singer, claps in the loud parts and a short melodic solo.' },
      ballad: { n: 'Acoustic ballad — fingerpicked guitar, strings', w: 2,
        d: 'A fingerpicked acoustic guitar and a singer close to the microphone; the bass and soft drums come in later, the strings carry the middle section, the lead guitar plays the tune instead of a solo.',
        set: { tempo: [72, 104, 88], minor: 0.3, key: { major: 'G', minor: 'A' }, keys: { major: ['G', 'C', 'D', 'F', 'A'], minor: ['A', 'E', 'D'] }, leadPlan: { intro: 'rest', verse: 'rest', solo: 'melody', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Verse:8 Bridge:8 Verse:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Bridge:8 Verse:8 Solo:8 Bridge:8 Verse:8 Outro:4',
            Extended: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Verse:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [52, 70], voices: 2, choir: ['oohs', 'harmony'], above: true, scoop: 0.15, melisma: 0.15, lift: 3,
            reg: { verse: 0.4, chorus: 0.55, bridge: 0.6, outro: 0.45 },
            cells: { verse: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 8:8 | 2:2 4:2 6:2 8:4 12:4 | 0:6 6:2 8:8 | 0:4 4:2 6:6'), chorus: CE('0:8 8:8 | 0:4 4:4 8:8 | 0:6 6:2 8:4 12:4'), bridge: CE('0:4 4:4 8:8 | 0:8 8:4 12:4') } } },
        tracks: {
          drums: { vol: 0.66, in: IN('intro:0 verse:.5 bridge:1 solo:1 outro:.5'), pat: {
            verse: { kick: 'X.......X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            bridge: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x...x...x...x...' },
            solo: { kick: 'X.......X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '............X.X.', tom1: '................', tom2: '..............X.', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0 verse:.5'), p: { style: { verse: '0:R:8 8:5:6 14:A:2', chorus: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', bridge: '0:R:4 4:3:4 8:5:4 12:6:4', solo: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', outro: '0:R:16' } } },
          rhythm: { on: false },
          aguitar: { play: 'mix', vol: 0.62, pan: -0.1, in: IN('intro:1') },
          strings: { on: true },
          lead: { vol: 0.58, in: IN('intro:0 verse:0 chorus:.5 bridge:0 solo:1 outro:1') } } },
      studio: { n: 'Studio years — piano, melodic bass, brass, borrowed chords', w: 3,
        d: 'The piano plays 8th-note chords, the bass sings its own melody high on the neck, organ and brass fill the choruses; chords borrowed from the minor key (bVII, bIII, bVI, the minor IV) and a sing-along coda.',
        set: { tempo: [84, 124, 104], minor: 0.2, key: { major: 'C', minor: 'A' }, keys: { major: ['C', 'F', 'G', 'D', 'E', 'A'], minor: ['A', 'E', 'D'] }, leadPlan: { intro: 'rest', verse: 'rest', solo: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Outro:8',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Chorus:8 Outro:8',
            Extended: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Verse:8 Chorus:8 Chorus:8 Outro:16' },
          vocal: { gender: 'male', range: [52, 71], voices: 3, choir: ['oohs', 'harmony', 'hook'], above: true, scoop: 0.15, melisma: 0.15, lift: 4,
            reg: { verse: 0.4, chorus: 0.6, bridge: 0.55, outro: 0.6 },
            cells: { verse: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:2 6:2 8:4 12:4 | 2:2 4:2 6:2 8:2 10:2 12:4 | 0:4 4:2 6:6 12:4'), chorus: CE('0:8 8:8 | 0:4 4:4 8:8 | 0:6 6:2 8:4 12:4 | 0:4 4:4 8:4 12:4'), bridge: CE('0:4 4:4 8:8 | 0:2 2:2 4:4 8:8') } } },
        tracks: {
          piano: { on: true }, organ: { on: true }, brass: { on: true },
          drums: { pat: {
            intro: { kick: 'X.......X.......', hhc: 'x...x...x...x...' },
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            bridge: { kick: 'X.......X.......', tom2: '....x.x.....x.x.', snare: '............X...', hhc: 'x...x...x...x...' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '........X..X....', tom1: '..........X..XX.', tom2: '...............X', kick: 'X.......X.......' } } },
          // the melodic bass of the studio years: it moves between the chord notes instead of sitting on the root
          bass: { vol: 0.9, p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:4 4:3:2 6:5:2 8:8:4 12:5:2 14:A:2', chorus: '0:R:2 2:R:2 4:5:2 6:6:2 8:8:2 10:6:2 12:5:2 14:A:2',
            bridge: '0:R:6 6:5:2 8:R:4 12:3:2 14:5:2', solo: '0:R:4 4:3:2 6:5:2 8:8:4 12:5:2 14:A:2', outro: '0:R:4 4:5:4 8:8:4 12:5:4' } } },
          rhythm: { vol: 0.46, fx: 'Crunch (TS-808 + Plexi)', in: IN('intro:0 verse:0 chorus:1 bridge:.5 solo:1 outro:1'), riffs: { chorus: ['0:O:8a 8:O:8', '0:O:4a 4:O:4 8:O:4 12:O:4'], solo: ['0:O:4a 4:O:4 8:O:4 12:O:4'], bridge: ['0:O:16r'], outro: ['0:O:8a 8:O:8'] } },
          aguitar: { on: false },
          lead: { fx: 'Lead (TS + Delay)', in: IN('intro:0 verse:0 chorus:.5 bridge:.5 solo:1 outro:1'), mel: { bends: true, vibrato: true, slides: true } } } },
      rocker: { n: 'Rock and roll — 12-bar riffs, pounding piano, shouted vocals', w: 2,
        d: 'Loud and fast: an overdriven boogie riff on the low strings, rock-and-roll piano 8ths, a walking bass, a shouting singer answered by the others, and a raw guitar solo.',
        set: { tempo: [132, 172, 150], minor: 0.15, key: { major: 'E', minor: 'E' }, keys: { major: ['E', 'A', 'G', 'D'], minor: ['E', 'A'] }, leadPlan: { intro: 'riff', verse: 'fills' },
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Chorus:8 Verse:12 Solo:12 Chorus:8 Verse:12 Outro:4',
            Extended: 'Intro:4 Verse:12 Verse:12 Chorus:8 Verse:12 Solo:12 Chorus:8 Solo:12 Verse:12 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [52, 72], voices: 2, choir: ['hook', 'harmony'], above: true, scoop: 0.3, melisma: 0.1, lift: 4, blue: true,
            reg: { verse: 0.55, chorus: 0.7, bridge: 0.6, outro: 0.65 },
            cells: { verse: CE('0:2 2:2 4:2 6:2 8:4 | 2:2 4:2 6:2 8:2 10:2 12:4 | 0:2 2:2 4:4 10:2 12:2 14:2 | 0:4 4:2 6:2 8:4'), chorus: CE('0:4 4:4 8:8 | 0:2 2:2 4:4 8:8 | 0:6 6:2 8:8'), bridge: CE('0:4 4:4 8:8') } } },
        tracks: {
          piano: { on: true, vol: 0.56 },
          drums: { vol: 0.88, pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X.XX', hho: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.', clap: '....x.......x...' },
            solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........XXXX.XX.', tom1: '............X...', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { fx: 'Dry', p: { style: { intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', verse: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', chorus: '0:R:2 2:R:2 4:5:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2',
            solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', outro: '0:R:4 4:5:4 8:R:8' } } },
          rhythm: { fx: 'Crunch (TS-808 + Plexi)', vol: 0.6, riffs: {
            intro: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2', '0:0:2 2:0:2 4:3:1 5:4:1h 6:7:2 8:0:2 10:0:2 12:10:2 14:7:2'],
            verse: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2', '0:0:2 2:0:2 4:3:1 5:4:1h 6:7:2 8:0:2 10:0:2 12:10:2 14:7:2',
                    '0:c:2a 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '0:0:2 2:4:2 4:7:2 6:9:2 8:10:2 10:9:2 12:7:2 14:4:2'],
            chorus: ['0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2', '0:O:2a. 4:O:2a. 8:O:2a. 12:O:2 14:O:2'],
            solo: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2'], outro: ['0:O:8a 8:O:8'] } },
          aguitar: { on: false },
          lead: { fx: 'Crunch (TS-808 + Plexi)', vol: 0.7, in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'), mel: { bends: true, vibrato: true, slides: true } } } }
    }
  });

  /* ============================================================== ZZ TOP == */
  /* Library: 28 songs. 123 BPM typical (80–152), half minor / blues (A, E, B, C), a trio: ONE guitar (overdrive 60 %,
   * distortion 54 %), power chords 62–75 % of the rhythm bars and low riffs 9–19 %, syncopated stabs
   * ("O.....O.........", "..O...O.O......."), bass: the root in straight 8ths (the most used line by far), drums:
   * four-on-the-floor kick with the backbeat (the commonest verse groove) and closed hi-hat 8ths; synth lead / strings
   * in 15 % of the verse and solo bars (the 80s records); very long solos (28 bars); the singer is low in the verse
   * (median A#3) and jumps a sixth for the chorus; chord loops: i–i–i–bVII, V–IV–I–I, bVII–IV–I–I. */
  band('ZZ Top', {
    band: 'zztop',
    desc: 'Texas boogie trio: one fat overdriven guitar, a bass that pumps the root in 8th notes, a dry four-on-the-floor beat, a low growling singer. Blues shuffles and boogies, tight riff rockers, and the 80s sound with a sequencer bass and synthesizers. Solos with few notes, pinch harmonics and wide bends.',
    tempo: [112, 140, 124], swing: 0, grid: 8, key: { major: 'A', minor: 'A' }, mode: 'minor',
    keys: { major: ['A', 'E', 'C', 'G', 'D'], minor: ['A', 'E', 'B', 'C', 'G'] }, minor: 0.54,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:12 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Verse:8 Chorus:8 Outro Solo:8',
      Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Verse:8 Chorus:8 Chorus:8 Outro Solo:16'
    },
    progs: [
      P('One-chord riff (i)', 'minor', 'verse intro solo', 'i7 i7 i7 i7', 'riff synth'), P('i–i–i–bVII', 'minor', 'verse intro solo', 'i i i bVII', 'riff synth'),
      P('i–i–i–i·IV', 'minor', 'verse chorus', 'i i i i-IV', 'riff synth'), P('i–bIII–IV–i', 'minor', 'verse solo', 'i bIII IV i', 'riff synth'),
      P('i·bVII–i·bIII', 'minor', 'verse', 'i-bVII i i-bVII i-bIII', 'riff'), P('Chorus: bVII–IV–i–i', 'minor', 'chorus', 'bVII IV i i', 'riff synth'),
      P('Chorus: IV–IV–i–i', 'minor', 'chorus', 'IV IV i i', 'riff synth'), P('Chorus: bVI–bVII–i–i', 'minor', 'chorus bridge', 'bVI bVII i i', 'riff synth'),
      P('Chorus: bIII–IV–i–i', 'minor', 'chorus', 'bIII IV i i', 'riff synth'), P('Bridge: IV–IV–bVII–V', 'minor', 'bridge', 'IV IV bVII V7', 'riff synth'),
      P('I–I–I–bVII', 'major', 'verse intro solo', 'I I I bVII', 'riff synth'), P('I–bIII–IV–I', 'major', 'verse solo', 'I bIII IV I', 'riff synth'),
      P('I–I–IV–IV', 'major', 'verse', 'I I IV IV', 'riff synth'), P('Chorus: bVII–IV–I–I', 'major', 'chorus', 'bVII IV I I', 'riff synth'),
      P('Chorus: V–IV–I–I', 'major', 'chorus', 'V IV I I', 'riff synth'), P('Chorus: IV–IV–I–I', 'major', 'chorus bridge', 'IV IV I I', 'riff synth'),
      P('Bridge: IV–IV–ii–ii', 'major', 'bridge', 'IV IV ii ii', 'riff synth'),
      // boogies and slow blues: the 12 bars
      P('12-bar boogie', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'boogie blues'), P('12-bar (quick change)', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'boogie blues'),
      P('Boogie vamp I–I–I–I', 'major', 'intro verse', 'I7 I7 I7 I7', 'boogie'), P('Boogie chorus: IV–IV–I–I · V–IV–I–I', 'major', 'chorus bridge', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'boogie blues'),
      P('Boogie chorus: V–IV–I–I', 'major', 'chorus', 'V7 IV7 I7 I7', 'boogie'),
      P('Minor 12-bar', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7', 'boogie blues'), P('Minor boogie vamp', 'minor', 'intro verse', 'i7 i7 i7 i7', 'boogie blues'),
      P('Minor boogie chorus: iv–iv–i–i · bVI–V–i', 'minor', 'chorus bridge', 'iv7 iv7 i7 i7 bVI7 V7 i7 i7', 'boogie blues')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.88, pat: {
        intro: { kick: 'X...X...X...X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X...X...X...X.x.', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
        solo: { kick: 'X...X...X...X...', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '................', kick: 'X...X...X...X...' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots', 'boogie'], fx: 'Dry', vol: 0.9, p: { style: {
        intro: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2',
        chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:b7:2 14:A:2', solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:b7:2', bridge: '0:R:8 8:R:8' } } }),
      T('rhythm', 'Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'texas', 'berry', 'power', 'bassriff', 'stabs'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.66, pan: -0.15,
        riffs: {
          intro: ['0:0:2p 2:0:2p 4:3:2 6:0:2p 8:5:2 10:0:2p 12:3:1 13:4:1h 14:0:2', '0:C:6a 6:C:2. 10:C:2 12:C:4', '0:0:2 2:3:2s 4:5:2 6:0:2p 8:0:2p 10:7:2 12:5:2 14:3:2'],
          verse: ['0:C:6a 6:C:2. 10:0:2p 12:3:2 14:0:2p', '2:C:2a. 6:C:2. 8:C:2 12:0:2p 14:0:2p', '0:0:2p 2:0:2p 4:C:2a 6:0:2p 8:0:2p 10:C:2a 12:3:1 13:4:1h 14:0:2',
                  '0:0:2 2:3:2s 4:5:2 6:0:2p 8:0:2p 10:7:2 12:5:2 14:3:2 | 0:0:2 2:3:2s 4:5:2 6:0:2p 8:C:4a 12:C:2. 14:C:2', '0:C:3a 3:C:3 6:C:2. 10:10:2 12:7:2 14:5:2',
                  '0:c:2p 2:c:2p 4:c+2:2 6:c:2p 8:c:2p 10:c:2p 12:c+3:2 14:c+2:2'],
          chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4', '0:O:4a 4:O:2 6:O:4 10:T:2 12:S:2 14:T:2', '0:C:3a 3:C:1. 6:C:2 8:C:3a 11:C:1. 14:C:2'],
          bridge: ['0:C:8a 8:C:8', '0:0:2p 2:0:2p 4:0:2p 6:0:2p 8:0:2p 10:0:2p 12:0:2p 14:0:2p'],
          solo: ['0:C:6a 6:C:2. 10:C:2 12:C:4', '0:c:2p 2:c:2p 4:c+2:2 6:c:2p 8:c:2p 10:c:2p 12:c+3:2 14:c+2:2']
        } }),
      // overdubbed second guitar (the records double the riff in the loud parts) — off by default: it is a trio
      T('rhythm2', 'Guitar 2 (overdub)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', on: false, play: 'power', plays: ['power', 'bandriff', 'stabs'], fx: 'Rock Distortion (DS-1)', vol: 0.5, pan: 0.45, in: IN('intro:0 verse:0 chorus:1 bridge:.5 solo:1 outro:1') }),
      T('synth', 'Synthesizer', 'harmony', 'Synthesizer - Warm Poly', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Synth Wide', vol: 0.4, pan: 0.3, in: IN('intro:1 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.74, pan: 0.2, lead: true, in: IN('intro:.5 verse:.5 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, harmonics: true } })
    ],
    vocal: { gender: 'male', range: [48, 68], voices: 2, choir: ['hook', 'harmony'], scoop: 0.4, melisma: 0.05, lift: 7, blue: true,
      reg: { verse: 0.36, chorus: 0.78, bridge: 0.55, outro: 0.6 },
      cells: {
        verse: CE('0:8 8:4 12:4 | 0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 | 8:4 12:4 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:2 6:2 8:2 10:2 12:4'),
        chorus: CE('0:2 2:2 4:2 6:2 8:2 10:4 14:2 | 0:4 4:4 8:8 | 0:3 3:3 6:2 8:8 | 0:6 6:2 8:8'),
        bridge: CE('0:8 8:8 | 0:4 4:4 8:8')
      } },
    leadPlan: { verse: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['gibbons'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: 'Blues', always: true } },
    types: {
      riff: { n: 'Riff rocker — syncopated power chords, pumping bass', w: 3,
        d: 'A tight low-string riff with chord stabs off the beat, the bass pumping the root in 8ths, kick on every beat; the low singer jumps up for a short hook chorus; a long solo with few notes.' },
      boogie: { n: 'Boogie shuffle — 12-bar, swung', w: 3,
        d: 'The Texas shuffle: swung 8ths, the guitar rocks between the 5th and the 6th of each chord, a walking boogie bass, 12-bar verses and a solo over two rounds of the blues.',
        set: { tempo: [104, 148, 126], swing: 0.62, minor: 0.25, key: { major: 'A', minor: 'A' }, keys: { major: ['A', 'E', 'G', 'C', 'D'], minor: ['A', 'E', 'G'] },
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Chorus:8 Solo:12 Solo:12 Verse:12 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:12 Verse:12 Chorus:8 Solo:12 Solo:12 Verse:12 Chorus:8 Solo:12 Verse:12 Outro:4' } },
        tracks: {
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', verse: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2',
            chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } },
          rhythm: { riffs: {
            intro: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:C:4a 6:C:2. 8:C:4a 14:C:2.'],
            verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2',
                    '0:0:2 2:0:2 4:3:1 5:4:1h 6:7:2 8:9:2 10:7:2 12:3:1 13:4:1h 14:0:2', '0:c:2p 2:c:2p 4:c+2:2p 6:c:2p 8:c:2p 10:c:2p 12:c+2:2p 14:c:2p'],
            chorus: ['0:C:4a 6:C:2. 8:C:4a 14:C:2.', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '0:O:2a. 4:O:2a. 8:O:2a. 12:O:2 14:O:2'],
            solo: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:C:4a 6:C:2. 8:C:4a 14:C:2.'] } } } },
      synth: { n: '80s — sequencer bass, synthesizers, big snare', w: 2,
        d: 'The MTV-era sound: a machine-like 8th-note bass and four-on-the-floor kick, a synthesizer pad behind clipped guitar stabs, an overdubbed second guitar in the chorus and a singing, sustained solo.',
        set: { tempo: [118, 132, 124], minor: 0.5 },
        tracks: {
          synth: { on: true }, rhythm2: { on: true },
          drums: { vol: 0.9, pat: {
            intro: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'xxxxxxxxxxxxxxxx' },
            chorus: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: '..x...x...x...x.', hhc: 'x...x...x...x...', clap: '....x.......x...' },
            solo: { kick: 'X...X...X...X...', snare: '....X.......X...', hho: '..x...x...x...x.', hhc: 'x...x...x...x...' },
            bridge: { kick: 'X...X...X...X...', hhc: 'xxxxxxxxxxxxxxxx' },
            fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '................', kick: 'X...X...X...X...' } } },
          bass: { inst: 'Electric Bass - Pick', vol: 0.92, p: { style: { verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:8:2',
            solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', bridge: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2' } } },
          rhythm: { fx: 'Rock Distortion (DS-1)', riffs: {
            intro: ['2:C:2a. 6:C:2. 8:C:4 14:C:2.', '0:C:6a 6:C:2. 10:C:2 12:C:4'],
            verse: ['2:C:2a. 6:C:2. 8:C:4 14:C:2.', '0:0:2p 2:0:2p 4:C:2a. 6:0:2p 8:0:2p 10:C:2a. 12:0:2p 14:0:2p', '0:C:2a. 6:C:2a. 10:C:2. 12:C:4', '0:0:2p 2:0:2p 4:0:2p 6:C:2a. 8:0:2p 10:0:2p 12:C:4a'],
            chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4'], bridge: ['0:0:2p 2:0:2p 4:0:2p 6:0:2p 8:0:2p 10:0:2p 12:0:2p 14:0:2p'],
            solo: ['2:C:2a. 6:C:2. 8:C:4 14:C:2.', '0:C:6a 6:C:2 8:C:6a 14:C:2'] } } } },
      blues: { n: 'Slow blues — 12 bars, crying guitar', w: 1,
        d: 'Slow and heavy: a 12/8 feel (swung), long bass notes, the guitar answers every line the singer growls, and the solo takes two full rounds.',
        set: { tempo: [60, 84, 72], swing: 0.66, minor: 0.5, key: { major: 'A', minor: 'A' }, keys: { major: ['A', 'G', 'C', 'E'], minor: ['A', 'B', 'C', 'G'] }, leadPlan: { intro: 'solo', verse: 'fills', outro: 'solo' },
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Outro:4',
            Extended: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Solo:12 Verse:12 Outro:4' },
          vocal: { gender: 'male', range: [48, 68], voices: 0, choir: ['oohs'], scoop: 0.45, melisma: 0.2, lift: 3, blue: true, aab: true,
            reg: { verse: 0.5, chorus: 0.6, outro: 0.5 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 1:1 2:2 4:2 6:4 | 0:4 4:4 8:4'), chorus: CE('0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { vol: 0.8, pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2', solo: '0:R:4 4:3:4 8:5:4 12:6:2 14:5:2', chorus: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2' } } },
          rhythm: { vol: 0.56, fx: 'Blues Overdrive (BD-2)', riffs: {
            intro: ['0:T:6r 6:T:2 8:T:8r'], verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '4:T:2. 6:T:2 12:T:2. 14:T:2', '0:T:6r 6:T:2 8:T:6r 14:T:2'],
            chorus: ['0:T:6r 6:T:2 8:T:6r 14:T:2'], solo: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '4:T:2. 6:T:2 12:T:2. 14:T:2'] } } } }
    }
  });

  /* ======================================================= OZZY OSBOURNE == */
  /* Library: 63 songs. 120 BPM typical (76–152), 57 % minor (E minor, A minor, C# / F# minor), a third of the songs
   * tuned a half step down; one guitar (double-tracked): power chords 45–54 %, low riffs 18–23 %, arpeggios 10 % of the
   * verse bars, palm muting 6 %; synth lead in 20 % of the verse bars, strings / piano / organ in under 10 % of the
   * songs (intros and ballads); intros of 11 bars, solos of 16, outros of 15; loops i–i–bVII–bVII·i, i–i–i–iv,
   * bVII·i–i, and I·V–vi–IV·V–vi in the major-key ballads; singer: 3–5 notes a bar around F4 (62–68, up to 78),
   * 8th notes on the first half of the bar; bass: the root in quarters or 8ths; drums: kick on 1 and 3 with an
   * open hi-hat or ride in quarters in the chorus, double-kick 8ths under the hi-hat in the heavy verses. */
  band('Ozzy Osbourne', {
    band: 'ozzy',
    desc: 'Heavy metal with a classical edge: dark minor-key riffs on the low strings (palm-muted pedal notes, power chords, the tritone), a nasal high singer doubled in the chorus, church-organ and synth intros, and virtuoso solos — trills, scale sequences, tapping, screaming harmonics. Also the galloping fast songs, the slow heavy stompers and the big ballads with piano and strings.',
    tempo: [116, 150, 132], swing: 0, grid: 8, key: { major: 'A', minor: 'E' }, mode: 'minor',
    keys: { major: ['A', 'D', 'E', 'G'], minor: ['E', 'A', 'F#', 'B', 'D'] }, minor: 0.8,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro Solo:16'
    },
    progs: [
      P('Pedal riff (i)', 'minor', 'verse intro', 'i i i i', 'metal gallop heavy'), P('i–i–bVII–bVII·i', 'minor', 'verse intro solo', 'i i bVII bVII-i', 'metal gallop heavy'),
      P('i–i–i–iv', 'minor', 'verse', 'i i i iv', 'metal heavy'), P('i–i·bIII–i–i·bVII', 'minor', 'verse intro', 'i i-bIII i i-bVII', 'metal gallop heavy'),
      P('i–bVI–bVII–i', 'minor', 'verse solo chorus', 'i bVI bVII i', 'metal gallop'), P('i–bII–i–bVII (Phrygian)', 'minor', 'verse', 'i bII i bVII', 'metal heavy'),
      P('i–bV–iv–i (the tritone)', 'minor', 'verse intro', 'i bV iv i', 'heavy metal'),
      P('Pre: bVI–bVII', 'minor', 'pre', 'bVI bVI bVII bVII', 'metal gallop heavy'), P('Pre: iv–V', 'minor', 'pre', 'iv iv V7 V7', 'metal gallop'), P('Pre: bVI–bVII–i–V', 'minor', 'pre', 'bVI bVII i V7', 'metal gallop'),
      P('Chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII', 'metal gallop'), P('Chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'metal gallop heavy'),
      P('Chorus: i–bVII–bVI–bVII', 'minor', 'chorus solo', 'i bVII bVI bVII', 'metal gallop heavy'), P('Chorus: bIII–bVII–i–i', 'minor', 'chorus', 'bIII bVII i i', 'metal heavy'),
      P('Chorus: iv–bVII–bIII–bVI · iv–V', 'minor', 'chorus bridge', 'iv bVII bIII bVI iv iv V7 V7', 'metal gallop'),
      P('Classical solo: i–iv–bVII–bIII–bVI–ii°–V–i', 'minor', 'solo bridge', 'i iv bVII bIII bVI iv V7 i', 'metal gallop'), P('Solo: i–bVII–bVI–V', 'minor', 'solo bridge', 'i bVII bVI V7', 'metal gallop heavy'),
      P('Bridge: bVI–bVI–V–V', 'minor', 'bridge', 'bVI bVI V7 V7', 'metal gallop heavy'),
      P('Major I–bVII–IV–I', 'major', 'verse intro solo', 'I bVII IV I', 'metal gallop heavy'), P('Major I–I–IV–V', 'major', 'verse', 'I I IV V', 'metal gallop'),
      P('Major I–bIII–IV–I', 'major', 'verse', 'I bIII IV I', 'metal heavy'), P('Major chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'metal gallop'),
      P('Major chorus: bVI–bVII–I', 'major', 'chorus pre bridge', 'bVI bVII I I', 'metal gallop heavy'), P('Major chorus: I–V–IV–IV', 'major', 'chorus solo', 'I V IV IV', 'metal gallop heavy'),
      P('Major pre: vi–IV–V', 'major', 'pre', 'vi IV V V', 'metal gallop heavy'),
      // ballads
      P('Ballad I·V–vi–IV·V–vi', 'major', 'verse intro', 'I-V vi IV-V vi', 'ballad'), P('Ballad I–V–vi–IV', 'major', 'verse solo', 'I V vi IV', 'ballad'),
      P('Ballad I–iii–IV–V', 'major', 'verse', 'I iii IV V', 'ballad'), P('Ballad chorus: IV·V–vi–I·V–vi', 'major', 'chorus', 'IV-V vi I-V vi', 'ballad'),
      P('Ballad chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'ballad'), P('Ballad chorus: vi–IV–I–V', 'major', 'chorus solo', 'vi IV I V', 'ballad'),
      P('Ballad pre: ii–IV–V', 'major', 'pre bridge', 'ii IV V V', 'ballad'), P('Ballad bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I', 'ballad'),
      P('Ballad minor i–bVI–bIII–bVII', 'minor', 'verse chorus solo intro', 'i bVI bIII bVII', 'ballad'), P('Ballad minor i–v–bVI–bVII', 'minor', 'verse', 'i v bVI bVII', 'ballad'),
      P('Ballad minor chorus: bVI–bVII–i', 'minor', 'chorus pre', 'bVI bVII i i', 'ballad'), P('Ballad minor bridge: iv–bVII–bIII–V', 'minor', 'bridge pre', 'iv bVII bIII V7', 'ballad')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.9, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hho: 'x...x...x...x...' },
        verse: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
        chorus: { kick: 'X.......X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
        solo: { kick: 'X.x...x.X.x.....', snare: '....X.......X...', ride: 'X...X...X...X...', hhc: '..x...x...x...x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', ride: 'x...x...x...x...' },
        fill: { snare: '........XX.XX...', tom1: '............XX..', tom2: '..............XX', kick: 'X.......X.x.....' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', pre: '0:R:4 4:R:4 8:R:4 12:R:4',
        chorus: '0:R:4 4:R:4 8:R:4 12:R:2 14:A:2', solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:b7:2', bridge: '0:R:8 8:R:8' } } }),
      T('rhythm', 'Rhythm Guitar (left)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'pedal', 'gallop', 'power', 'octriff', 'stabs'], fx: 'Metal (MT-2)', vol: 0.62, pan: -0.55,
        riffs: {
          intro: ['0:C:8a 8:C:8', '0:k0:2p 2:k0:2p 4:C:2a 6:k0:2p 8:k0:2p 10:C:2a 12:k0:2p 14:k0:2p', '0:C:6a 6:C:2. 8:C:8'],
          verse: [
            // pedal riffs: the palm-muted open string under chords and single notes that move
            '0:k0:2p 2:k0:2p 4:C:2a 6:k0:2p 8:k0:2p 10:C:2a 12:k0:2p 14:C:2a', '0:k0:1p 1:k0:1p 2:k12:2 4:k0:1p 5:k0:1p 6:k10:2 8:k0:1p 9:k0:1p 10:k8:2 12:k7:2 14:k10:2',
            '0:C:3a 3:k0:1p 4:k0:2p 6:C:2a 8:k0:2p 10:k0:2p 12:k3:2 14:k5:2 | 0:C:3a 3:k0:1p 4:k0:2p 6:C:2a 8:k0:2p 10:k6:2 12:k5:2 14:k3:2',
            '0:k0:2p 2:k0:2p 4:k3:2 6:k0:2p 8:k5:2 10:k0:2p 12:k6:1 13:k5:1 14:k3:2', '0:C:2a 2:k0:1p 3:k0:1p 4:C:2a 6:k0:1p 7:k0:1p 8:C:2a 10:k0:1p 11:k0:1p 12:k10:2 14:k7:2',
            '0:k0:2p 2:k7:2 4:k0:2p 6:k8:2 8:k0:2p 10:k7:2 12:k0:2p 14:k3:2 | 0:k0:2p 2:k7:2 4:k0:2p 6:k8:2 8:C:4a 12:C:2 14:C:2'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:4', '0:C:2a 2:c:2p 4:c:2p 6:c:2p 8:C:2a 10:c:2p 12:c:2p 14:c:2p', '0:C:8a 8:C:8'],
          chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:C:2'],
          bridge: ['0:C:16', '0:O:16r', '0:C:8a 8:C:8'],
          solo: ['0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:c:2p', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:c:1p 1:c:1p 2:c:1p 3:c:1p 4:C:2a 6:c:1p 7:c:1p 8:c:1p 9:c:1p 10:c:1p 11:c:1p 12:C:2a 14:C:2']
        } }),
      T('rhythm2', 'Rhythm Guitar (right)', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'power', plays: ['power', 'bandriff', 'pedal', 'gallop', 'stabs'], fx: 'Rock Distortion (DS-1)', vol: 0.54, pan: 0.55, in: IN('intro:.5 verse:.5 pre:1 chorus:1 bridge:.5 solo:1 outro:1'),
        p: { power: { intro: 'O.......O.......', verse: 'O.......O.......', pre: 'O...O...O...O...', chorus: 'O.....O.O...O.O.', bridge: 'O...............', solo: 'O.P.O.P.O.P.O.P.', outro: 'O.......O.......' } } }),
      T('aguitar', 'Clean Guitar (arpeggios)', 'arp', 'Electric Guitar - Clean', { alt: 'guitar', on: false, fx: 'Clean + Chorus', vol: 0.56, pan: -0.25, in: IN('intro:1 verse:1 pre:1 chorus:0 bridge:1 solo:0 outro:1') }),
      T('organ', 'Organ / Keyboards', 'harmony', 'Organ', { alt: 'keys', play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.4, in: IN('intro:1 verse:0 pre:.5 chorus:.5 bridge:1 solo:.5 outro:1') }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'mix', plays: ['mix', 'chords', 'arp', 'pad'], fx: 'Hall', vol: 0.62, pan: -0.1,
        mix: { intro: 'arp', verse: 'arp', pre: 'chords', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { intro: '0.1.2.3.2.1.2.3.', verse: '0.1.2.3.2.1.2.1.', bridge: '0.2.1.3.2.3.1.2.' }, chords: { pre: '0:4 4:4 8:4 12:4', chorus: '0:4 4:4 8:4 12:2 14:2', solo: '0:8 8:8' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.44, in: IN('intro:.5 verse:.5 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.74, pan: 0.1, lead: true, in: IN('intro:.5 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, fast: true, complex: true, harmonics: true } })
    ],
    vocal: { gender: 'male', range: [57, 76], voices: 1, choir: ['hook', 'hook', 'harmony'], scoop: 0.1, melisma: 0.05, lift: 3,
      reg: { verse: 0.42, pre: 0.5, chorus: 0.58, bridge: 0.5, outro: 0.55 },
      cells: {
        verse: CE('0:2 2:2 4:2 6:2 | 0:4 4:4 8:4 12:4 | 0:2 2:2 4:2 6:2 8:2 10:4 14:2 | 0:8 8:4 12:4 | 0:2 2:6 | 8:2 10:2 12:2 14:2'),
        pre: CE('0:4 4:4 8:4 12:4 | 0:8 8:8'),
        chorus: CE('0:2 2:2 4:2 6:2 | 0:4 4:4 8:4 12:4 | 0:8 8:8 | 0:2 2:2 4:2 6:2 10:2 12:2 14:2 | 0:6 6:2 8:8'),
        bridge: CE('0:8 8:8 | 0:12 12:4')
      } },
    leadPlan: { verse: 'fills' },
    melody: { heroes: ['rhoads'], scales: { all: { major: 'Major Pentatonic', minor: 'Natural Minor' }, solo: { major: 'Major', minor: 'Harmonic Minor' }, always: true } },
    types: {
      metal: { n: 'Classic metal — pedal riff, organ intro, neoclassical solo', w: 3,
        d: 'An organ or synth opens; the guitars play a palm-muted pedal riff under the verse and wide power chords in the chorus, the singer is doubled; the solo runs through minor scales, trills and tapping over a classical chord cycle.' },
      gallop: { n: 'Fast — galloping guitars, double kick', w: 2,
        d: 'Faster: the guitars and the bass gallop (an 8th and two 16ths), the kick drum doubles under the ride, and the solo is a storm of scale runs.',
        set: { tempo: [144, 176, 158], minor: 0.85 },
        tracks: {
          drums: { pat: {
            intro: { kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', hho: 'x...x...x...x...' },
            verse: { kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', ride: 'x...x...x...x...' },
            chorus: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........XXXXXX..', tom1: '..............X.', tom2: '...............X', kick: 'X.x.X.x.X.x.X.x.' } } },
          bass: { p: { style: { intro: '0:R:2 2:R:1 3:R:1 4:R:2 6:R:1 7:R:1 8:R:2 10:R:1 11:R:1 12:R:2 14:R:1 15:R:1', verse: '0:R:2 2:R:1 3:R:1 4:R:2 6:R:1 7:R:1 8:R:2 10:R:1 11:R:1 12:R:2 14:R:1 15:R:1',
            pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', solo: '0:R:2 2:R:1 3:R:1 4:R:2 6:R:1 7:R:1 8:R:2 10:R:1 11:R:1 12:R:2 14:R:1 15:R:1' } } },
          rhythm: { riffs: {
            intro: ['0:C:2a 2:c:1p 3:c:1p 4:c:2p 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:c:2p 14:c:1p 15:c:1p'],
            verse: ['0:k0:2p 2:k0:1p 3:k0:1p 4:k0:2p 6:k0:1p 7:k0:1p 8:k0:2p 10:k0:1p 11:k0:1p 12:C:2a 14:C:2', '0:C:2a 2:k0:1p 3:k0:1p 4:k0:2p 6:k0:1p 7:k0:1p 8:C:2a 10:k0:1p 11:k0:1p 12:k0:2p 14:k0:1p 15:k0:1p',
                    '0:k0:2p 2:k0:1p 3:k0:1p 4:k3:2 6:k0:1p 7:k0:1p 8:k5:2 10:k0:1p 11:k0:1p 12:k7:2 14:k5:2 | 0:k0:2p 2:k0:1p 3:k0:1p 4:k3:2 6:k0:1p 7:k0:1p 8:k8:2 10:k7:2 12:k5:2 14:k3:2'],
            pre: ['0:C:2a 2:c:2p 4:c:2p 6:c:2p 8:C:2a 10:c:2p 12:c:2p 14:c:2p'],
            chorus: ['0:C:2a 2:c:1p 3:c:1p 4:C:2a 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:C:2a 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2'],
            solo: ['0:C:2a 2:c:1p 3:c:1p 4:c:2p 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:c:2p 14:c:1p 15:c:1p'] } },
          rhythm2: { play: 'gallop' } } },
      heavy: { n: 'Heavy stomper — slow riff, squealing harmonics', w: 2,
        d: 'Slow and huge: a riff of low single notes with bends and the tritone, half-time drums, both guitars in unison, and a pentatonic solo full of pinch harmonics and wide vibrato.',
        set: { tempo: [84, 112, 98], minor: 0.9, key: { major: 'D', minor: 'D' }, keys: { major: ['D', 'E', 'G'], minor: ['D', 'E', 'C#', 'B'] },
          melody: { heroes: ['zakk'], scales: { all: { major: 'Major Blues', minor: 'Minor Pentatonic' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } } },
        tracks: {
          organ: { on: false },
          drums: { vol: 0.92, pat: {
            intro: { kick: 'X.......X.......', snare: '........X.......', hho: 'x...x...x...x...' },
            verse: { kick: 'X.....x.X..x....', snare: '....X.......X...', hho: 'x...x...x...x...' },
            pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X..x....', snare: '....X.......X...', ride: 'X...X...X...X...' },
            solo: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', hho: 'X...X...X...X...' },
            fill: { snare: '........X..X..XX', tom1: '..........X.....', tom2: '.............X..', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:8 8:R:8', verse: '0:R:3 3:R:1 4:R:2 6:R:2 8:R:3 11:R:1 12:b7:2 14:R:2', pre: '0:R:4 4:R:4 8:R:4 12:R:4', chorus: '0:R:3 3:R:3 6:R:2 8:R:3 11:R:3 14:A:2', solo: '0:R:3 3:R:1 4:R:2 6:R:2 8:R:3 11:R:1 12:b7:2 14:R:2' } } },
          rhythm: { riffs: {
            intro: ['0:k0:6a 6:k3:2 8:k0:4 12:k6:2 14:k5:2', '0:C:8a 8:C:8'],
            verse: ['0:k0:3a 3:k0:1p 4:k3:2 6:k0:2p 8:k5:3 11:k0:1p 12:k6:2 14:k5:2', '0:k0:2p 2:k0:2p 4:k10:2 6:k12:2 8:k0:2p 10:k0:2p 12:k3:1 13:k5:1h 14:k3:2',
                    '0:C:3a 3:k0:1p 4:k0:2p 6:k3:2 8:C:3a 11:k0:1p 12:k6:2 14:k5:2 | 0:C:3a 3:k0:1p 4:k0:2p 6:k3:2 8:k5:2 10:k3:2 12:k0:4v', '0:k0:4a 4:k1:4 8:k0:4 12:k10:2 14:k11:2'],
            pre: ['0:C:4a 4:C:4 8:C:4 12:C:4'], chorus: ['0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:8a 8:C:4 12:C:4'],
            solo: ['0:k0:3a 3:k0:1p 4:k3:2 6:k0:2p 8:k5:3 11:k0:1p 12:k6:2 14:k5:2', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2'] } },
          rhythm2: { play: 'bandriff', in: IN('intro:1 verse:1 pre:1 chorus:1 bridge:.5 solo:1 outro:1'), riffs: {
            intro: ['0:k0:6a 6:k3:2 8:k0:4 12:k6:2 14:k5:2', '0:C:8a 8:C:8'],
            verse: ['0:k0:3a 3:k0:1p 4:k3:2 6:k0:2p 8:k5:3 11:k0:1p 12:k6:2 14:k5:2', '0:k0:2p 2:k0:2p 4:k10:2 6:k12:2 8:k0:2p 10:k0:2p 12:k3:1 13:k5:1h 14:k3:2',
                    '0:C:3a 3:k0:1p 4:k0:2p 6:k3:2 8:C:3a 11:k0:1p 12:k6:2 14:k5:2 | 0:C:3a 3:k0:1p 4:k0:2p 6:k3:2 8:k5:2 10:k3:2 12:k0:4v', '0:k0:4a 4:k1:4 8:k0:4 12:k10:2 14:k11:2'],
            pre: ['0:C:4a 4:C:4 8:C:4 12:C:4'], chorus: ['0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:8a 8:C:4 12:C:4'],
            solo: ['0:C:8a 8:C:8'] } },
          lead: { mel: { bends: true, vibrato: true, slides: true, fast: true, harmonics: true } } } },
      ballad: { n: 'Power ballad — piano, clean arpeggios, strings', w: 2,
        d: 'Piano and clean guitar arpeggios under a gentle verse, strings and distorted guitars for the chorus, a melodic solo that climbs to the top of the neck, and a quiet ending.',
        set: { tempo: [62, 88, 74], minor: 0.3, key: { major: 'D', minor: 'A' }, mode: 'major', keys: { major: ['D', 'G', 'A', 'C', 'E'], minor: ['A', 'E', 'B', 'D'] }, leadPlan: { intro: 'melody', verse: 'rest', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [57, 76], voices: 2, choir: ['oohs', 'harmony'], scoop: 0.15, melisma: 0.15, lift: 4,
            reg: { verse: 0.36, pre: 0.48, chorus: 0.62, bridge: 0.5, outro: 0.45 },
            cells: { verse: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 8:8 | 2:2 4:2 6:2 8:4 12:4 | 0:6 6:2 8:8'), pre: CE('0:4 4:4 8:4 12:4'), chorus: CE('0:8 8:8 | 0:4 4:4 8:8 | 0:6 6:2 8:4 12:4 | 0:4 4:4 8:4 12:4'), bridge: CE('0:8 8:8') } } },
        tracks: {
          piano: { on: true }, strings: { on: true }, aguitar: { on: true }, organ: { on: false },
          drums: { vol: 0.8, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.......X.x.....', snare: '....X.......X...', ride: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0'), play: 'style', p: { style: { verse: '0:R:8 8:R:6 14:A:2', pre: '0:R:4 4:R:4 8:5:4 12:R:4', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { vol: 0.54, in: IN('intro:0 verse:0 pre:.5 chorus:1 bridge:0 solo:1 outro:0'), riffs: { pre: ['0:C:8 8:C:8'], chorus: ['0:C:8a 8:C:8', '0:C:8a 8:C:6 14:C:2', '0:C:6a 6:C:2 8:C:8'], solo: ['0:C:8a 8:C:8', '0:C:6a 6:C:2 8:C:6a 14:C:2'] } },
          rhythm2: { vol: 0.5, in: IN('intro:0 verse:0 pre:0 chorus:1 bridge:0 solo:1 outro:0'), p: { power: { chorus: 'O.......O.......', solo: 'O.......O.....O.' } } },
          lead: { in: IN('intro:1 verse:0 pre:0 chorus:.5 bridge:.5 solo:1 outro:1') } } }
    }
  });

  /* ======================================================== ERIC CLAPTON == */
  /* Library: 125 songs. 110 BPM typical (72–155), 73 % major / blues (E, A, G, C; A minor), 15 % of the bars in 12/8
   * and 10 % shuffled; guitars: clean 37 %, nylon 33 %, steel 22 %, distortion 27 %; piano 9 %, organ 7 %; verses
   * of 12 bars (the blues), solos of 16; rhythm guitar: 8th-note chords, quarter chords and off-beat chops
   * ("....O.....O....."), almost no palm muting; bass: long roots, root → 4th / approach note; drums: kick on 1 and 3,
   * hi-hat 8ths; singer: 4–5 notes a bar, low (median B3 in verses), lines that start late in the bar as pickups
   * ("10:2 12:2 14:2") and leave the first beats to the guitar; loops IV–IV–I–I, I–I–I–IV, I–V–IV–I·vi. */
  band('Eric Clapton', {
    band: 'clapton',
    desc: 'Blues at the centre of everything: heavy riff blues-rock of the power-trio years, 12-bar shuffles with piano and organ, the laid-back 70s groove (clean guitar chops, organ, backing singers) and the acoustic "unplugged" ballads. A relaxed singer whose lines the guitar answers, and solos built from bends, slow vibrato and space.',
    tempo: [100, 132, 116], swing: 0, grid: 8, key: { major: 'A', minor: 'A' }, mode: 'major',
    keys: { major: ['A', 'E', 'G', 'C', 'D'], minor: ['A', 'E', 'D', 'B'] }, minor: 0.27,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Verse:8 Chorus:8 Outro Solo:8',
      Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Verse:8 Chorus:8 Chorus:8 Outro Solo:16'
    },
    progs: [
      // heavy blues-rock: one-chord riffs with the #9, bVII and bIII
      P('Riff on I7', 'major', 'verse intro solo', 'I7 I7 I7 I7', 'bluesrock'), P('I–I–bVII·IV–I', 'major', 'verse intro', 'I7 I7 bVII-IV I7', 'bluesrock'),
      P('I–bIII–IV–I', 'major', 'verse solo', 'I bIII IV I', 'bluesrock'), P('I–I–IV–IV', 'major', 'verse', 'I7 I7 IV7 IV7', 'bluesrock laidback'),
      P('Chorus: IV–IV–I–I · V–IV–I', 'major', 'chorus', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'bluesrock shuffle'), P('Chorus: bVII–IV–I–I', 'major', 'chorus', 'bVII IV I I', 'bluesrock laidback'),
      P('Chorus: V–IV–I–I', 'major', 'chorus bridge', 'V7 IV7 I7 I7', 'bluesrock shuffle'), P('Bridge: bVI–bVII–I', 'major', 'bridge', 'bVI bVII I I', 'bluesrock'),
      P('Minor riff i–i–i–bVII', 'minor', 'verse intro solo', 'i7 i7 i7 bVII', 'bluesrock'), P('Minor i–bVII–bVI–V', 'minor', 'verse solo', 'i bVII bVI V7', 'bluesrock laidback'),
      P('Minor i–iv–i–V', 'minor', 'verse', 'i7 iv7 i7 V7', 'bluesrock laidback shuffle'), P('Minor chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'bluesrock laidback'),
      P('Minor chorus: iv–iv–i–i · bVI–V–i', 'minor', 'chorus bridge', 'iv7 iv7 i7 i7 bVI7 V7 i7 i7', 'bluesrock shuffle laidback'),
      // shuffles: the 12 bars
      P('12-bar blues', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle'), P('12-bar (quick change)', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle'),
      P('8-bar blues', 'major', 'verse intro', 'I7 V7 IV7 IV7 I7 V7 I7 V7', 'shuffle'), P('Shuffle vamp', 'major', 'intro', 'I7 I7 I7 I7', 'shuffle'),
      P('Minor 12-bar', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7', 'shuffle'), P('Minor vamp', 'minor', 'intro', 'i7 iv7 i7 V7', 'shuffle'),
      // laid-back 70s
      P('Laid-back I–IV vamp', 'major', 'verse intro solo', 'I IV I IV', 'laidback'), P('Laid-back I–V–IV–I·vi', 'major', 'verse', 'I V IV I-vi', 'laidback'),
      P('Laid-back IV–IV–I–I', 'major', 'verse chorus', 'IV IV I I', 'laidback'), P('Laid-back I–I–I–IV', 'major', 'verse', 'I I I IV', 'laidback'),
      P('Laid-back chorus: I·V–vi·IV', 'major', 'chorus solo', 'I-V vi-IV I-V IV', 'laidback'), P('Laid-back bridge: vi–IV–V', 'major', 'bridge', 'vi IV V V', 'laidback'),
      // unplugged ballads
      P('Ballad I·V–vi·IV', 'major', 'verse intro', 'I-V vi-IV I-V IV', 'unplugged'), P('Ballad I–iii–IV–V', 'major', 'verse', 'I iii IV V', 'unplugged'),
      P('Ballad I–vi–IV–V', 'major', 'verse solo', 'I vi IV V', 'unplugged'), P('Ballad descending I–V/7–vi–IV', 'major', 'verse chorus', 'I V vi IV', 'unplugged'),
      P('Ballad chorus: IV–V–I–vi', 'major', 'chorus', 'IV V I vi', 'unplugged'), P('Ballad chorus: vi–IV–I–V', 'major', 'chorus solo', 'vi IV I V', 'unplugged'),
      P('Ballad bridge: bVII–IV–I · ii–V', 'major', 'bridge', 'bVII IV I I ii ii V V', 'unplugged'),
      P('Ballad minor i–bVII–bVI–V', 'minor', 'verse intro solo', 'i bVII bVI V7', 'unplugged'), P('Ballad minor i–iv–V–i', 'minor', 'verse', 'i iv V7 i', 'unplugged'),
      P('Ballad minor chorus: bVI–bVII–i', 'minor', 'chorus', 'bVI bVII i i', 'unplugged'), P('Ballad minor chorus: bIII–bVII–i–V', 'minor', 'chorus bridge', 'bIII bVII i V7', 'unplugged')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.84, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.......X.......X.....x.', snare: '....X.......X.......X.......X...', hhc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.x...x.', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
        solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x...x...x...x...' },
        fill: { snare: '........X.X.XX..', tom1: '..............X.', tom2: '...............X', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', 'walking', '8ths'], fx: 'Dry', vol: 0.86, p: { style: {
        intro: '0:R:8 8:R:8', verse: '0:R:3 3:R:1 4:R:2 6:b7:2 8:R:3 11:R:1 12:5:2 14:b7:2', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:b7:2 14:A:2',
        solo: '0:R:3 3:R:1 4:R:2 6:b7:2 8:R:3 11:R:1 12:5:2 14:b7:2', bridge: '0:R:8 8:5:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'texas', 'power', 'stabs', 'bassriff', 'strum'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.6, pan: -0.4,
        riffs: {
          intro: ['0:0:2 2:0:2 4:10:2 6:0:2 8:3:1 9:4:1h 10:0:2 12:10:2 14:7:2', '0:C:6a 6:C:2 8:C:8', '0:0:3 3:3:1 4:5:2 6:0:2 8:10:2 10:7:2 12:5:2 14:3:2'],
          verse: ['0:0:2 2:0:2 4:10:2 6:0:2 8:3:1 9:4:1h 10:0:2 12:10:2 14:7:2', '0:0:3 3:3:1 4:5:2 6:0:2 8:10:2 10:7:2 12:5:2 14:3:2 | 0:0:3 3:3:1 4:5:2 6:0:2 8:C:4a 12:C:4',
                  '0:C:3a 3:C:1. 6:10:2 8:C:3a 11:C:1. 12:7:2 14:10:2', '0:0:2 2:12:2 4:10:2 6:7:2 8:0:2 10:10:2 12:7:1 13:6:1 14:5:2', '4:T:2. 6:T:2 12:T:2. 14:T:2'],
          chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'],
          bridge: ['0:O:8r 8:O:8r', '0:C:8a 8:C:8'],
          solo: ['0:C:3a 3:C:1. 6:C:2 8:C:3a 11:C:1. 14:C:2', '4:T:2. 6:T:2 12:T:2. 14:T:2', '0:0:2 2:0:2 4:10:2 6:0:2 8:3:1 9:4:1h 10:0:2 12:10:2 14:7:2']
        } }),
      T('aguitar', 'Acoustic Guitar', 'strum', 'Acoustic Guitar - Steel', { alt: 'guitar', on: false, play: 'mix', plays: ['mix', 'strum', 'arp'], fx: 'Room', vol: 0.56, pan: 0.35,
        mix: { intro: 'arp', verse: 'arp', chorus: 'strum', bridge: 'arp', solo: 'strum', outro: 'arp' },
        p: { arp: { intro: '0.2.3.2.4.2.3.2.', verse: '0.2.3.2.4.3.2.3.', bridge: '0.2.3.4.3.2.3.2.' }, strum: { chorus: 'D...D.DU.UDUD.DU', solo: 'D...D.DU.UDUD.DU' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'mix', 'arp', 'pad'], fx: 'Room', vol: 0.54, pan: 0.2,
        p: { chords: { intro: '0:8 8:8', verse: '4:2 6:2 12:2 14:2', chorus: '0:4 4:2 6:2 8:4 12:2 14:2', solo: '4:2 6:2 12:2 14:2', bridge: '0:8 8:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4, pan: 0.25, in: IN('intro:.5 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Blues Overdrive (BD-2)', vol: 0.74, pan: 0.15, lead: true, in: IN('intro:1 verse:.5 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true } })
    ],
    vocal: { gender: 'male', range: [50, 69], voices: 2, choir: ['oohs', 'harmony', 'hook'], scoop: 0.35, melisma: 0.15, lift: 3, blue: true,
      reg: { verse: 0.45, chorus: 0.62, bridge: 0.55, outro: 0.55 },
      cells: {
        // the singer leaves the start of the bar to the guitar: pickups into the next bar, short lines
        verse: CE('10:2 12:2 14:2 | 0:4 4:2 6:2 | 0:2 2:6 10:2 12:2 14:2 | 2:2 4:2 6:2 8:4 | 0:4 4:4 10:2 12:2 14:2 | 2:2 4:2 6:2 8:4 12:2 14:2'),
        chorus: CE('0:2 2:2 4:2 6:2 8:4 12:2 14:2 | 2:4 6:2 8:4 12:2 14:2 | 0:4 4:2 6:2 10:4 14:2 | 0:6 6:2 8:8 | 0:4 4:4 8:8'),
        bridge: CE('0:8 8:8 | 0:4 4:4 8:8')
      } },
    leadPlan: { intro: 'solo', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['clapton'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } },
    types: {
      bluesrock: { n: 'Heavy blues-rock — power-trio riff, long solo', w: 3,
        d: 'A blues-scale riff on the low strings played by guitar and bass together, loud loose drums, a short sung verse and chorus, and a long solo of bends and slow vibrato.' },
      shuffle: { n: 'Blues shuffle — 12 bars, piano and organ', w: 3,
        d: 'A swung 12-bar blues: the guitar plays the 5th–6th boogie, the bass walks, the piano fills on the backbeat and the organ holds the chords; every sung line is answered by the lead guitar; two rounds of solo.',
        set: { tempo: [88, 136, 112], swing: 0.62, minor: 0.25, key: { major: 'E', minor: 'A' }, keys: { major: ['E', 'A', 'G', 'C', 'D'], minor: ['A', 'B', 'D', 'G'] },
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Verse:12 Outro:4',
            Extended: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Solo:12 Verse:12 Outro:4' },
          vocal: { gender: 'male', range: [50, 69], voices: 0, choir: ['oohs'], scoop: 0.4, melisma: 0.2, lift: 2, blue: true, aab: true,
            reg: { verse: 0.5, chorus: 0.6, outro: 0.5 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 1:1 2:2 4:2 6:4 | 0:4 4:2 6:2 | 2:2 4:2 6:4'), chorus: CE('0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          piano: { on: true }, organ: { on: true },
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { play: 'walking', plays: ['walking', 'style', 'roots'], p: { style: { verse: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } },
          rhythm: { fx: 'Blues Overdrive (BD-2)', riffs: {
            intro: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:T:6r 6:T:2 8:T:8r'],
            verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '4:T:2. 6:T:2 12:T:2. 14:T:2', '0:T:6r 6:T:2 8:T:6r 14:T:2'],
            solo: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '4:T:2. 6:T:2 12:T:2. 14:T:2'] } } } },
      laidback: { n: 'Laid-back 70s — clean chops, organ, backing singers', w: 2,
        d: 'An easy mid-tempo groove: clean guitar chords clipped on the backbeat, a round bass, organ pads, backing singers in the chorus and a relaxed, melodic solo.',
        set: { tempo: [96, 122, 108], minor: 0.3, key: { major: 'G', minor: 'A' }, keys: { major: ['G', 'D', 'A', 'C', 'E'], minor: ['A', 'E', 'D', 'B'] }, leadPlan: { verse: 'fills', outro: 'solo' } },
        tracks: {
          organ: { on: true }, piano: { on: true, vol: 0.44 },
          drums: { vol: 0.78, pat: {
            intro: { kick: 'X.......X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '............X.X.', tom1: '................', tom2: '..............X.', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:6 6:R:2 8:R:8', verse: '0:R:6 6:R:2 8:5:4 12:R:2 14:A:2', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { fx: 'Clean + Chorus', vol: 0.54, riffs: {
            intro: ['4:T:2. 10:T:2.', '0:O:8r 8:O:8r'], verse: ['4:T:2. 10:T:2.', '4:T:2. 6:T:1. 12:T:2. 14:T:1.', '2:T:2. 6:T:2. 10:T:2. 14:T:2.', '0:0:2 4:T:2. 8:7:2 10:T:2. 14:10:2'],
            chorus: ['0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4', '0:O:2 2:O:2 4:O:2 6:O:2 8:O:2 10:O:2 12:O:2 14:O:2'], bridge: ['0:O:8r 8:O:8r'], solo: ['4:T:2. 10:T:2.', '2:T:2. 6:T:2. 10:T:2. 14:T:2.'] } },
          lead: { fx: 'Lead Clean (Delay)' } } },
      unplugged: { n: 'Unplugged ballad — acoustic guitars, soft percussion', w: 2,
        d: 'Acoustic: fingerpicked guitar, a second guitar playing the tune, piano, an upright-style bass and brushed drums; a soft low voice and a lyrical acoustic solo.',
        set: { tempo: [70, 98, 84], minor: 0.3, key: { major: 'A', minor: 'A' }, keys: { major: ['A', 'G', 'E', 'D', 'C'], minor: ['A', 'E', 'D'] }, leadPlan: { intro: 'melody', verse: 'fills', solo: 'melody', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Extended: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:8 Verse:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [50, 68], voices: 2, choir: ['oohs', 'harmony'], scoop: 0.25, melisma: 0.15, lift: 3,
            reg: { verse: 0.4, chorus: 0.56, bridge: 0.5, outro: 0.45 },
            cells: { verse: CE('0:4 4:4 8:4 12:4 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 8:8 | 0:6 6:2 8:4 | 10:2 12:2 14:2'), chorus: CE('0:8 8:8 | 0:4 4:4 8:8 | 0:6 6:2 8:4 12:4'), bridge: CE('0:8 8:8') } },
          melody: { heroes: ['clapton'], scales: { all: { major: 'Major Pentatonic', minor: 'Minor Pentatonic' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } } },
        tracks: {
          aguitar: { on: true, vol: 0.62, pan: -0.25 }, piano: { on: true, vol: 0.46, p: { chords: { intro: '0:8 8:8', verse: '0:8 8:8', chorus: '0:4 4:4 8:4 12:4', solo: '0:8 8:8', bridge: '0:8 8:8' } } },
          rhythm: { on: false },
          drums: { vol: 0.62, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.......X.x.....', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.......X.x.....', snare: '....o.......o...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '............o.o.', tom1: '................', tom2: '................', kick: 'X.......X.......' } } },
          bass: { inst: 'Upright Bass', p: { style: { intro: '0:R:16', verse: '0:R:8 8:5:6 14:A:2', chorus: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', solo: '0:R:8 8:5:6 14:A:2', bridge: '0:R:8 8:5:8' } } },
          lead: { inst: 'Classical Guitar - Nylon', fx: 'Room', vol: 0.7, mel: { bends: false, vibrato: true, slides: true } } } }
    }
  });

  /* ========================================================= CHUCK BERRY == */
  /* Library: 11 songs (small sample — completed with what the style is known for). 160 BPM typical (132–180), all
   * major (G, Bb, B, C, A), 4/4, 14 % of the bars shuffled; one clean / lightly overdriven guitar: two-string
   * boogie chords 71–86 % of the rhythm bars in straight 8ths ("O.O.O.O.O.O.O.O."), 12-bar verses and choruses,
   * 13-bar intros (the guitar alone, then the band), solos of two rounds (25 bars); bass: the root in 8ths; drums:
   * kick on 1 and 3, snare on 2 and 4, hi-hat 8ths — the same in every section; singer: 5 notes a bar in the verse
   * (fast story-telling 8ths in a narrow range, 59–66), 3 in the chorus; piano in the fills. */
  band('Chuck Berry', {
    band: 'berry',
    desc: 'The first rock and roll: a double-stop guitar intro, the 5th–6th boogie on two strings in straight 8th notes, a pounding piano, a walking bass and a story told in quick syllables over 12 bars. The solos are double stops, bends in unison and repeated licks.',
    tempo: [148, 180, 164], swing: 0, grid: 8, key: { major: 'G', minor: 'A' }, mode: 'major',
    keys: { major: ['G', 'Bb', 'C', 'A', 'B', 'E'], minor: ['A', 'E', 'G'] }, minor: 0.03,
    structures: {
      Short: 'Intro:4 Verse:12 Chorus:12 Solo:12 Verse:12 Chorus:12 Outro:4',
      Standard: 'Intro:4 Verse:12 Chorus:12 Verse:12 Chorus:12 Solo:12 Solo:12 Verse:12 Chorus:12 Outro:4',
      Extended: 'Intro:4 Verse:12 Chorus:12 Verse:12 Chorus:12 Solo:12 Solo:12 Verse:12 Chorus:12 Solo:12 Verse:12 Chorus:12 Outro:4'
    },
    progs: [
      P('12-bar blues', 'major', 'verse chorus solo', 'I I I I IV IV I I V IV I I'), P('12-bar (V–V)', 'major', 'verse chorus solo', 'I I I I IV IV I I V V I I'),
      P('12-bar (quick change)', 'major', 'verse solo', 'I IV I I IV IV I I V IV I V'), P('Chorus from the IV', 'major', 'chorus', 'IV IV I I IV IV I I V V I I'),
      P('Verse I–I–V–V · V–V–I–I', 'major', 'verse', 'I I V V V V I I IV IV I I'), P('Intro (the V, the band waits)', 'major', 'intro', 'V V V V'), P('Intro on the I', 'major', 'intro', 'I I I I'),
      P('Outro tag', 'major', 'outro', 'I IV I I'),
      P('Minor 12-bar', 'minor', 'verse chorus solo', 'i i i i iv iv i i V7 iv i i'), P('Minor intro', 'minor', 'intro outro', 'i i V7 V7')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.82, in: IN('intro:.5'), pat: {
        intro: { snare: '....X.......X.XX', kick: 'X.......X.......' },
        verse: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.......X.....x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '................', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Upright Bass', { play: 'style', plays: ['style', 'walking', '8ths', 'roots'], fx: 'Dry', vol: 0.86, in: IN('intro:0'), p: { style: {
        verse: '0:R:2 2:R:2 4:3:2 6:3:2 8:5:2 10:5:2 12:6:2 14:5:2', chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2',
        solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', outro: '0:R:4 4:5:4 8:R:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'berry', 'power', 'stabs'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.6, pan: -0.35, in: IN('intro:0'),
        riffs: {
          verse: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2', '0:c:2a 2:c:2 4:c+2:2 6:c+2:2 8:c:2a 10:c:2 12:c+2:2 14:c+2:2', '0:c:2a 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2'],
          chorus: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2', '0:c:2a 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '0:O:2a. 4:O:2a. 8:O:2a. 12:O:2 14:O:2'],
          solo: ['0:c:2a 2:c:2 4:c+2:2 6:c:2 8:c:2a 10:c:2 12:c+2:2 14:c:2', '0:c:2a 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2'],
          outro: ['0:O:2a. 4:O:2a. 8:O:8a']
        } }),
      T('piano', 'Piano', 'harmony', 'Upright Piano', { alt: 'keys', play: 'chords', plays: ['chords', 'pad'], fx: 'Room', vol: 0.5, pan: 0.3, in: IN('intro:0 verse:1 chorus:1 solo:1 outro:1'),
        p: { chords: { verse: '4:2 6:2 12:2 14:2', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', outro: '0:4 4:4 8:8' } } }),
      T('sax', 'Tenor Sax', 'harmony', 'Tenor Sax', { alt: 'horn', on: false, play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.44, pan: 0.15, in: IN('intro:0 verse:0 chorus:1 solo:1 outro:1'),
        p: { chords: { chorus: '0:2 6:2 8:6', solo: '0:6 6:2 8:6 14:2', outro: '0:16' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Crunch (TS-808 + Plexi)', vol: 0.76, pan: 0.2, lead: true, in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: false, slides: true } })
    ],
    vocal: { gender: 'male', range: [54, 69], voices: 0, choir: ['hook'], scoop: 0.2, melisma: 0, lift: 2, blue: true,
      reg: { verse: 0.5, chorus: 0.62, outro: 0.55 },
      cells: {
        verse: CE('0:2 2:2 4:2 6:2 8:2 10:2 12:4 | 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:2 2:2 4:2 6:2 8:4 | 0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 2:2 4:2 6:2 8:4 12:2 14:2'),
        chorus: CE('0:4 4:2 6:2 8:4 | 0:2 2:2 4:4 8:4 | 0:4 4:4 8:8 | 2:2 4:2 6:2 8:4'),
        bridge: CE('0:4 4:4 8:8')
      } },
    leadPlan: { intro: 'solo', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['berry'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } },
    types: {
      rocker: { n: 'Rock and roll — straight 8ths, 12 bars', w: 4,
        d: 'The guitar opens alone with double stops; then 12-bar verses and choruses over the two-string boogie in straight 8th notes, piano fills, and two rounds of guitar solo.' },
      shuffle: { n: 'Shuffle — swung boogie', w: 2,
        d: 'The same band a little slower and swung: a walking bass, piano triplets and the boogie in a shuffle.',
        set: { tempo: [126, 156, 140], swing: 0.6 },
        tracks: {
          bass: { play: 'walking', plays: ['walking', 'style', 'roots'] },
          drums: { pat: {
            intro: { snare: '....X.......X.XX', kick: 'X.......X.......' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            chorus: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } } } },
      slow: { n: 'Slow blues ballad — 12/8 feel, sax', w: 1,
        d: 'A slow dance blues: swung, piano triplets, a tenor sax holding the chords and the guitar answering every sung line.',
        set: { tempo: [66, 90, 76], swing: 0.66, minor: 0.15,
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Verse:12 Outro:4',
            Extended: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Verse:12 Outro:4' },
          vocal: { gender: 'male', range: [54, 69], voices: 0, choir: ['oohs'], scoop: 0.35, melisma: 0.15, lift: 2, blue: true, aab: true,
            reg: { verse: 0.5, chorus: 0.6, outro: 0.5 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 0:4 4:2 6:2 | 2:2 4:2 6:4'), chorus: CE('0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          sax: { on: true, in: IN('intro:1 verse:1 solo:1 outro:1'), p: { chords: { intro: '0:16', verse: '0:16', solo: '0:8 8:8', outro: '0:16' } } },
          piano: { p: { chords: { intro: '0:8 8:8', verse: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', outro: '0:8 8:8' } }, in: IN('intro:1 verse:1 solo:1 outro:1'), vol: 0.44 },
          drums: { vol: 0.72, in: IN('intro:1'), pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '................', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:1'), p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2', solo: '0:R:4 4:3:4 8:5:4 12:6:2 14:5:2', outro: '0:R:16' } } },
          rhythm: { in: IN('intro:1'), vol: 0.5, riffs: { intro: ['0:T:6r 6:T:2 8:T:8r'], verse: ['4:T:2. 6:T:2 12:T:2. 14:T:2', '0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'], solo: ['4:T:2. 6:T:2 12:T:2. 14:T:2'], outro: ['0:T:16r'] } } } }
    }
  });

  /* =================================================== YNGWIE MALMSTEEN == */
  /* Library: 151 songs. 133 BPM typical (76–214), 87 % minor (Ab / Eb minor = A / E minor tuned a half step down, F,
   * C#, Bb minor), 16 % of the bars in triplets; strings 31 %, organ 14 %, synth 14 %, harpsichord-like clav 6 %;
   * a singer in a third of the songs (verse: long notes and quarter-note triplets, median A4 — very high), choir in
   * 19 files; the guitar: single-note riffs 52 % of the verse bars, power chords 22–35 %; 23 % of the lead bars are
   * doubled in harmony; drums: double kick in 16ths under the hi-hat in the fast verses, "X.x...x.X.x...x." and
   * "X.x.X.x.X.x.X.x." with quarter-note hi-hat elsewhere; bass: the root in 8ths; classical harmony: i–V–i–V,
   * i–i–vii°–i, chains of fifths, bVI–iv, Phrygian-dominant V. */
  band('Yngwie Malmsteen', {
    band: 'malmsteen',
    desc: 'Neoclassical metal: baroque harmony (harmonic minor, chains of fifths, diminished chords) at heavy-metal volume. Racing double-kick drums, pedal-point riffs, organ and strings, an operatic high singer — and a lead guitar that plays violin music: scale sequences, swept arpeggios, wide slow vibrato. Speed-metal songs, mid-tempo anthems, instrumentals and slow classical ballads.',
    tempo: [150, 196, 168], swing: 0, grid: 16, key: { major: 'A', minor: 'A' }, mode: 'minor',
    keys: { major: ['A', 'E', 'D'], minor: ['A', 'E', 'F#', 'B', 'D', 'C#'] }, minor: 0.9,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Outro:4',
      Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Bridge:8 Solo:8 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('i–V–i–V', 'minor', 'verse intro', 'i V7 i V7'), P('Pedal i–i–vii°–i', 'minor', 'verse intro', 'i i V7 i'), P('i–i–i·bIII–i', 'minor', 'verse', 'i i i-bIII i'),
      P('i–bVI·iv–i–bVI·iv', 'minor', 'verse solo', 'i bVI-iv i bVI-V7'), P('i–bVII–bVI–V', 'minor', 'verse solo intro', 'i bVII bVI V7'), P('i–iv–V–i', 'minor', 'verse', 'i iv V7 i'),
      P('i–bII–V–i (Phrygian)', 'minor', 'verse intro', 'i bII V7 i'),
      P('Pre: iv–V', 'minor', 'pre', 'iv iv V7 V7'), P('Pre: bVI–bVII–V', 'minor', 'pre', 'bVI bVII V7 V7'), P('Pre: iv·bVII–bIII·bVI–iv–V', 'minor', 'pre', 'iv-bVII bIII-bVI iv V7'),
      P('Chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII'), P('Chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i'), P('Chorus: i–iv–bVII–bIII · bVI–iv–V', 'minor', 'chorus solo', 'i iv bVII bIII bVI iv V7 V7'),
      P('Chorus: bIII–bVII–i–V', 'minor', 'chorus', 'bIII bVII i V7'), P('Chorus: i–V·i–iv–V', 'minor', 'chorus', 'i V7-i iv V7'),
      P('Chain of fifths: i–iv–bVII–bIII–bVI–ii°–V–i', 'minor', 'solo bridge chorus', 'i iv bVII bIII bVI iv V7 i'), P('Two chords a bar: i·iv–bVII·bIII–bVI·iv–V', 'minor', 'solo bridge', 'i-iv bVII-bIII bVI-iv V7'),
      P('Solo: i–V–i–V · iv–i–V–i', 'minor', 'solo', 'i V7 i V7 iv i V7 i'), P('Bridge: bVI–bVI–V–V', 'minor', 'bridge', 'bVI bVI V7 V7'), P('Bridge: iv–i–iv–V', 'minor', 'bridge pre', 'iv i iv V7'),
      P('Major I–V–vi–iii · IV–I–IV–V (canon)', 'major', 'verse chorus solo intro', 'I V vi iii IV I IV V'), P('Major I–IV–V–I', 'major', 'verse intro', 'I IV V I'),
      P('Major I–V–vi–IV', 'major', 'verse chorus solo', 'I V vi IV'), P('Major chorus: IV–V–iii–vi · ii–V–I', 'major', 'chorus bridge', 'IV V iii vi ii V I I'),
      P('Major pre: vi–iii–IV–V', 'major', 'pre bridge', 'vi iii IV V'), P('Major solo: I–vi–ii–V', 'major', 'solo', 'I vi ii V')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.9, pat: {
        intro: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
        verse: { kick: 'XxxxXxxxXxxxXxxx', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
        chorus: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hho: 'X...X...X...X...' },
        solo: { kick: 'XxxxXxxxXxxxXxxx', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', ride: 'x...x...x...x...' },
        fill: { snare: '........XXXXXXXX', tom1: '................', tom2: '................', kick: 'X.x.X.x.X.x.X.x.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.86, p: { style: {
        intro: '0:R:16', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', pre: '0:R:2 2:R:4 6:R:2 8:R:2 10:R:4 14:R:2',
        chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:A:2', solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:R:2', bridge: '0:R:8 8:R:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'pedal', 'gallop', 'power', 'stabs'], fx: 'Metal (MT-2)', vol: 0.6, pan: -0.45,
        riffs: {
          intro: ['0:C:8a 8:C:8', '0:C:6a 6:C:2. 8:C:8', '0:0:1p 1:0:1p 2:12:1 3:0:1p 4:10:1 5:0:1p 6:8:1 7:0:1p 8:7:1 9:0:1p 10:8:1 11:0:1p 12:7:1 13:0:1p 14:5:1 15:0:1p'],
          verse: [
            // pedal-point riffs: the root in 16ths under a melody on the off-beats (the violin "bariolage")
            '0:0:1p 1:0:1p 2:12:1 3:0:1p 4:10:1 5:0:1p 6:8:1 7:0:1p 8:7:1 9:0:1p 10:8:1 11:0:1p 12:7:1 13:0:1p 14:5:1 15:0:1p',
            '0:C:2a 2:0:1p 3:0:1p 4:0:1p 5:0:1p 6:C:2a 8:0:1p 9:0:1p 10:0:1p 11:0:1p 12:C:2a 14:0:1p 15:0:1p', '0:0:1p 1:0:1p 2:0:1p 3:0:1p 4:7:2 6:8:2 8:0:1p 9:0:1p 10:0:1p 11:0:1p 12:5:2 14:3:2',
            '0:0:2p 2:0:1p 3:0:1p 4:3:2 6:0:1p 7:0:1p 8:7:2 10:0:1p 11:0:1p 12:8:1 13:7:1 14:5:1 15:3:1', '0:C:3a 3:0:1p 4:0:1p 5:0:1p 6:C:2a 8:C:3a 11:0:1p 12:0:1p 13:0:1p 14:C:2a'],
          pre: ['0:C:4a 4:C:4 8:C:4 12:C:4', '0:C:2a 2:c:1p 3:c:1p 4:c:1p 5:c:1p 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:c:1p 13:c:1p 14:c:1p 15:c:1p'],
          chorus: ['0:C:8a 8:C:8', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:C:2a 2:c:1p 3:c:1p 4:C:2a 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:C:2a 14:C:2'],
          bridge: ['0:C:16', '0:C:8a 8:C:8'],
          solo: ['0:C:2a 2:c:1p 3:c:1p 4:c:1p 5:c:1p 6:c:1p 7:c:1p 8:C:2a 10:c:1p 11:c:1p 12:c:1p 13:c:1p 14:c:1p 15:c:1p', '0:C:8a 8:C:8', '0:C:6a 6:C:2 8:C:6a 14:C:2']
        } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'pad', plays: ['pad', 'chords', 'arp'], fx: 'Hall', vol: 0.42, pan: 0.3, in: IN('intro:1 verse:.5 pre:1 chorus:1 bridge:1 solo:1 outro:1') }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.4, pan: -0.2, in: IN('intro:1 verse:0 pre:.5 chorus:1 bridge:1 solo:.5 outro:1') }),
      T('harpsi', 'Harpsichord', 'arp', 'Clavinet', { alt: 'keys', on: false, fx: 'Hall', vol: 0.4, pan: 0.2, in: IN('intro:1 verse:0 pre:0 chorus:0 bridge:1 solo:0 outro:1') }),
      T('aguitar', 'Classical Guitar', 'arp', 'Classical Guitar - Nylon', { alt: 'guitar', on: false, fx: 'Hall', vol: 0.6, pan: -0.25, in: IN('intro:1 verse:1 pre:1 chorus:.5 bridge:1 solo:.5 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.76, pan: 0.1, lead: true, in: IN('intro:1 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: false, fast: true, complex: true, triplets: true, modes: true } }),
      T('lead2', 'Lead Guitar (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.56, pan: 0.4, in: IN('intro:1 verse:0 pre:0 chorus:0 bridge:0 solo:0 outro:1') })
    ],
    vocal: { gender: 'male', range: [59, 79], voices: 2, choir: ['harmony', 'oohs', 'hook'], scoop: 0.1, melisma: 0.25, lift: 5,
      reg: { verse: 0.45, pre: 0.55, chorus: 0.68, bridge: 0.55, outro: 0.6 },
      cells: {
        verse: CE('0:8 8:8 | 0:6 6:6 12:4 | 4:6 10:6 | 0:4 4:4 8:8 | 0:2 2:2 4:4 8:8'),
        pre: CE('0:4 4:4 8:4 12:4 | 0:8 8:8'),
        chorus: CE('0:8 12:2 14:2 | 0:8 8:8 | 8:2 10:2 12:2 14:2 | 0:4 4:4 8:8 | 0:6 6:2 8:8'),
        bridge: CE('0:12 12:4 | 0:8 8:8')
      } },
    leadPlan: { intro: 'melody', verse: 'fills' },
    melody: { heroes: ['malmsteen'], scales: { all: { major: 'Major', minor: 'Harmonic Minor' }, solo: { major: 'Major', minor: 'Harmonic Minor' }, always: true } },
    types: {
      speed: { n: 'Speed metal — double kick, pedal riffs, operatic chorus', w: 3,
        d: 'Fast: 16th-note double kick, a pedal-point riff under the verse, organ and strings, a soaring chorus — and a solo of harmonic-minor runs and swept arpeggios over a chain of fifths.' },
      anthem: { n: 'Mid-tempo anthem — heavy riff, big chorus', w: 2,
        d: 'Slower and heavier: power chords and a marching beat, strings behind a long-note chorus, the lead guitar singing between the lines.',
        set: { tempo: [104, 138, 120], grid: 8 },
        tracks: {
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', hho: 'x...x...x...x...' },
            verse: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', ride: 'X...X...X...X...' },
            fill: { snare: '........XX.XX.XX', tom1: '..........X.....', tom2: '.............X..', kick: 'X.......X.......' } } },
          rhythm: { riffs: {
            intro: ['0:C:8a 8:C:8', '0:C:6a 6:C:2. 8:C:8'],
            verse: ['0:C:2a 2:0:2p 4:0:2p 6:C:2a 8:0:2p 10:0:2p 12:C:2a 14:0:2p', '0:0:2p 2:0:2p 4:3:2 6:0:2p 8:7:2 10:0:2p 12:8:1 13:7:1 14:5:2', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2',
                    '0:0:2p 2:0:2p 4:C:2a 6:0:2p 8:0:2p 10:C:2a 12:0:2p 14:C:2a'],
            pre: ['0:C:4a 4:C:4 8:C:4 12:C:4'], chorus: ['0:C:8a 8:C:8', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'], bridge: ['0:C:16'],
            solo: ['0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:c:2p', '0:C:8a 8:C:8'] } } } },
      instrumental: { n: 'Instrumental — the guitar is the singer', w: 2,
        d: 'No singer: the lead guitar plays the theme (doubled in harmony by a second guitar), develops it over the organ and strings, and the solo sections go through the whole neoclassical vocabulary.',
        set: { vocal: null, leadPlan: { intro: 'melody', verse: 'melody', pre: 'riff', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Verse:8 Chorus:8 Solo:16 Chorus:8 Outro:8' } },
        tracks: {
          lead: { in: IN('intro:1 verse:1 pre:1 chorus:1 bridge:1 solo:1 outro:1') },
          lead2: { in: IN('intro:1 verse:0 pre:0 chorus:1 bridge:0 solo:0 outro:1') },
          harpsi: { on: true } } },
      ballad: { n: 'Classical ballad — nylon arpeggios, strings, singing lead', w: 1,
        d: 'Slow: classical-guitar arpeggios and strings, soft drums, a tender verse and a lead guitar that plays an aria — long notes with wide vibrato, then a burst of speed.',
        set: { tempo: [60, 84, 72], grid: 8, minor: 0.7, key: { major: 'D', minor: 'A' }, keys: { major: ['D', 'A', 'G', 'C'], minor: ['A', 'E', 'D', 'B'] }, leadPlan: { intro: 'melody', verse: 'rest', solo: 'solo', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Chorus:8 Chorus:8 Outro:8' },
          vocal: { gender: 'male', range: [57, 77], voices: 2, choir: ['oohs', 'harmony'], scoop: 0.15, melisma: 0.3, lift: 5,
            reg: { verse: 0.38, chorus: 0.62, bridge: 0.5, outro: 0.45 },
            cells: { verse: CE('0:4 4:4 8:8 | 0:6 6:2 8:8 | 2:2 4:4 8:8 | 0:8 8:8'), chorus: CE('0:8 8:8 | 0:12 12:4 | 0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          aguitar: { on: true }, organ: { on: false },
          strings: { vol: 0.46, in: IN('intro:1 verse:.5 chorus:1 bridge:1 solo:1 outro:1') },
          drums: { vol: 0.76, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            fill: { snare: '........X...X.XX', tom1: '..........XX....', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0'), p: { style: { verse: '0:R:8 8:R:8', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:3:2 14:A:2', solo: '0:R:4 4:R:4 8:R:4 12:5:2 14:A:2', bridge: '0:R:16' } } },
          rhythm: { vol: 0.52, in: IN('intro:0 verse:0 chorus:1 bridge:0 solo:1 outro:0'), riffs: { chorus: ['0:C:8a 8:C:8', '0:C:8a 8:C:6 14:C:2'], solo: ['0:C:8a 8:C:8'] } },
          lead: { in: IN('intro:1 verse:0 chorus:.5 bridge:.5 solo:1 outro:1') } } }
    }
  });

  /* ======================================================== JOE SATRIANI == */
  /* Library: 117 songs — instrumental rock (a singer in 6 files only). 120 BPM typical (74–176), 56 % minor (E, B,
   * A minor; C, E, A major), standard tuning; distortion 67 %, clean 34 %; verses of 16 bars (the theme), solos of 22,
   * long intros and outros (16–18); rhythm guitar: palm-muted 8ths ("P.P.P.P.P.P.P.P."), power chords 40–50 %;
   * bass: the root in 8ths (by far the commonest line) or one long note; drums: kick on 1 and 3, hi-hat 8ths in the
   * verse, ride in the chorus; two-chord vamps: i·bIII–i, bVII·i, I–bVII–IV–I, I–IV–IV–I; lead: 22 % of the bars
   * legato, whammy bar, harmonics; 13 % of the lead bars doubled in harmony. */
  band('Joe Satriani', {
    band: 'satriani',
    desc: 'Instrumental rock where the guitar sings: a theme you can hum over a pumping 8th-note bass and palm-muted rhythm guitar, modal colours (Lydian, Mixolydian, Dorian) on two-chord vamps, then a solo of liquid legato, whammy-bar dives and harmonics. Driving rockers, boogie shuffles, modal grooves and clean ballads.',
    tempo: [116, 156, 132], swing: 0, grid: 8, key: { major: 'E', minor: 'E' }, mode: 'major',
    keys: { major: ['E', 'A', 'C', 'G', 'D'], minor: ['E', 'B', 'A', 'C#', 'F#'] }, minor: 0.5,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:16 Chorus:8 Verse:16 Chorus:8 Solo:16 Bridge:8 Solo:8 Verse:8 Chorus:8 Chorus:8 Outro:8'
    },
    progs: [
      P('I–bVII–IV–I (Mixolydian)', 'major', 'verse intro solo', 'I bVII IV I', 'rocker groove'), P('I–IV–IV–I', 'major', 'verse intro', 'I IV IV I', 'rocker boogie'),
      P('Lydian vamp I–II', 'major', 'verse intro solo', 'I II I II', 'rocker groove ballad'), P('I–V–IV–I', 'major', 'verse', 'I V IV I', 'rocker'),
      P('Pedal I (riff)', 'major', 'verse intro', 'I I I I', 'rocker boogie groove'), P('I·bIII–IV·I', 'major', 'verse', 'I-bIII IV-I I-bIII IV', 'rocker boogie'),
      P('Chorus: IV–V–I–I', 'major', 'chorus', 'IV V I I', 'rocker boogie'), P('Chorus: bVI–bVII–I–I', 'major', 'chorus bridge', 'bVI bVII I I', 'rocker groove'),
      P('Chorus: IV–I–V–vi', 'major', 'chorus solo', 'IV I V vi', 'rocker ballad'), P('Chorus: I–V–vi–IV', 'major', 'chorus solo', 'I V vi IV', 'rocker ballad'),
      P('Bridge: vi–IV–ii–V', 'major', 'bridge', 'vi IV ii V', 'rocker ballad boogie'), P('Bridge: bIII–IV–bVI–bVII', 'major', 'bridge', 'bIII IV bVI bVII', 'rocker groove'),
      P('Minor i·bIII–i', 'minor', 'verse intro solo', 'i-bIII i i-bIII i', 'rocker groove'), P('Minor bVII·i vamp', 'minor', 'verse intro', 'bVII-i bVII-i bVII-i bVII-i', 'rocker groove'),
      P('Dorian i–IV', 'minor', 'verse solo intro', 'i7 IV i7 IV', 'groove rocker boogie'), P('Minor i–bVII–bVI–bVII', 'minor', 'verse solo', 'i bVII bVI bVII', 'rocker ballad'),
      P('Minor i–iv–iv·bVI–i', 'minor', 'verse', 'i iv iv-bVI i', 'rocker groove'), P('Minor chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'rocker groove ballad'),
      P('Minor chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII', 'rocker ballad'), P('Minor chorus: bVI–II–bVI–iv·i (Lydian colour)', 'minor', 'chorus bridge', 'bVI II bVI iv-i', 'rocker groove'),
      P('Minor bridge: iv–bVII–bIII–bVI', 'minor', 'bridge', 'iv bVII bIII bVI', 'rocker ballad groove boogie'),
      P('Boogie 12-bar', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'boogie'), P('Boogie chorus: IV–IV–I–I · V–IV–I', 'major', 'chorus', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'boogie'),
      P('Boogie minor i–i–iv–i', 'minor', 'verse intro solo', 'i7 i7 iv7 i7', 'boogie'), P('Boogie minor chorus: bVI–V', 'minor', 'chorus', 'bVI7 bVI7 V7 V7', 'boogie'),
      P('Ballad I–iii–IV–V', 'major', 'verse intro', 'I iii IV V', 'ballad'), P('Ballad Imaj7–IVmaj7', 'major', 'verse intro solo', 'Imaj7 IVmaj7 Imaj7 IVmaj7', 'ballad'),
      P('Ballad vi–IV–I–V', 'major', 'verse chorus', 'vi IV I V', 'ballad'), P('Ballad minor i–bVI–bIII–bVII', 'minor', 'verse chorus solo intro', 'i bVI bIII bVII', 'ballad'),
      P('Ballad minor i–iv–bVII–bIII', 'minor', 'verse', 'i iv bVII bIII', 'ballad')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.86, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.......X.x.....X.......X.x...x.', snare: '....X.......X.......X.......X...', hhc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', hho: 'X...X...X...X...', hhc: '..x...x...x...x.' },
        bridge: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x...x...x...x...' },
        fill: { snare: '........X.XX.XX.', tom1: '..........X.....', tom2: '...............X', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Pick', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:16', verse: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2',
        solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:b7:2', bridge: '0:R:6 6:R:2 8:R:8' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'pedal', 'octriff', 'stabs', 'sus4'], fx: 'Rock Distortion (DS-1)', vol: 0.58, pan: -0.45,
        riffs: {
          intro: ['0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:c:2p 14:c:2p', '0:C:8a 8:C:8', '0:O:16r'],
          verse: ['0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:c:2p 14:c:2p', '0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:c:2p',
                  '0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:C:2a 14:C:2 | 0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:C:4a 12:C:2 14:C:2', '0:0:2p 2:0:2p 4:7:2 6:0:2p 8:10:2 10:0:2p 12:7:2 14:5:2',
                  '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4'],
          chorus: ['0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:2 14:C:2', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:O:8a 8:O:8'],
          bridge: ['0:O:16r', '0:C:8a 8:C:8'],
          solo: ['0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:c:2p', '0:c:2p 2:c:2p 4:c:2p 6:c:2p 8:c:2p 10:c:2p 12:c:2p 14:c:2p']
        } }),
      T('clean', 'Clean Guitar', 'arp', 'Electric Guitar - Clean', { alt: 'guitar', on: false, fx: 'Clean + Chorus', vol: 0.5, pan: 0.45, in: IN('intro:1 verse:1 chorus:.5 bridge:1 solo:.5 outro:1') }),
      T('keys', 'Keyboards', 'harmony', 'Synthesizer - Analog Pad', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Synth Wide', vol: 0.36, pan: 0.25, in: IN('intro:1 verse:0 chorus:1 bridge:1 solo:.5 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.8, pan: 0.05, lead: true, in: IN('intro:.5 verse:1 chorus:1 bridge:1 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, harmonics: true, modes: true } }),
      T('lead2', 'Lead Guitar (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.5, pan: 0.4, in: IN('intro:0 verse:0 chorus:1 bridge:0 solo:0 outro:1') })
    ],
    leadPlan: { intro: 'riff', verse: 'melody', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
    melody: { heroes: ['satriani'], scales: { all: { major: 'Lydian', minor: 'Dorian' }, verse: { major: 'Mixolydian', minor: 'Natural Minor' }, solo: { major: 'Mixolydian', minor: 'Dorian' }, always: true } },
    types: {
      rocker: { n: 'Driving rocker — pumping 8ths, a theme you can sing', w: 3,
        d: 'Bass and palm-muted guitar pump 8th notes; the lead plays the theme in the verse (16 bars), lifts it for the chorus with a second guitar in harmony, and takes a long legato solo.' },
      boogie: { n: 'Boogie shuffle — swung blues-rock', w: 2,
        d: 'A swung boogie: 12-bar verses, a walking bass, the two-string boogie on the rhythm guitar and a bluesy, playful lead.',
        set: { tempo: [104, 140, 122], swing: 0.6, minor: 0.3, key: { major: 'A', minor: 'E' }, keys: { major: ['A', 'E', 'G', 'C'], minor: ['E', 'A', 'G'] },
          structures: {
            Short: 'Intro:4 Verse:12 Chorus:8 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Chorus:8 Solo:12 Solo:12 Verse:12 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:12 Verse:12 Chorus:8 Solo:12 Solo:12 Verse:12 Chorus:8 Solo:12 Verse:12 Outro:4' },
          melody: { licks: 'blues', heroes: ['satriani'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: { major: 'Mixolydian', minor: 'Dorian' }, always: true } } },
        tracks: {
          keys: { on: false },
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
            chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', verse: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } },
          rhythm: { fx: 'Crunch (TS-808 + Plexi)', riffs: {
            intro: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'], verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '0:0:2 2:0:2 4:3:1 5:4:1h 6:7:2 8:9:2 10:7:2 12:3:1 13:4:1h 14:0:2'],
            chorus: ['0:C:4a 6:C:2. 8:C:4a 14:C:2.', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2'], solo: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'] } },
          lead2: { on: false } } },
      groove: { n: 'Modal groove — two-chord vamp, funky bass', w: 2,
        d: 'Mid-tempo and spacious: a syncopated bass line on a two-chord vamp, clean guitar chords and a synth pad; the lead explores one mode with slides, whammy-bar scoops and harmonics.',
        set: { tempo: [92, 118, 104], minor: 0.65, key: { major: 'E', minor: 'E' }, keys: { major: ['E', 'A', 'D', 'C'], minor: ['E', 'B', 'A', 'F#'] } },
        tracks: {
          clean: { on: true },
          drums: { vol: 0.82, pat: {
            intro: { kick: 'X.......X.......', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x..x...x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            solo: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            bridge: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x...x...x...x...' },
            fill: { snare: '........X..X.XX.', tom1: '..........X.....', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { inst: 'Electric Bass - Finger', vol: 0.9, p: { style: { intro: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', verse: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', chorus: '0:R:3 3:R:3 6:R:2 8:R:3 11:5:3 14:A:2',
            solo: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { vol: 0.5, in: IN('intro:0 verse:.5 chorus:1 bridge:.5 solo:1 outro:1'), riffs: { verse: ['4:T:2. 10:T:2. 14:T:1.', '0:C:3a 6:C:2. 11:C:3'], chorus: ['0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:C:8a 8:C:8'], bridge: ['0:O:16r'], solo: ['0:C:3a 6:C:2. 11:C:3', '4:T:2. 10:T:2. 14:T:1.'] } } } },
      ballad: { n: 'Ballad — clean arpeggios, a long singing melody', w: 2,
        d: 'Slow: clean arpeggiated guitars and a soft pad, a simple beat, and a lead that sings long notes with vibrato and slides before a flowing solo.',
        set: { tempo: [62, 92, 78], minor: 0.45, key: { major: 'A', minor: 'B' }, keys: { major: ['A', 'D', 'E', 'G', 'C'], minor: ['B', 'E', 'A', 'F#'] }, leadPlan: { intro: 'rest', verse: 'melody', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Outro:8' } },
        tracks: {
          clean: { on: true, vol: 0.58 }, keys: { vol: 0.4, in: IN('intro:1 verse:.5 chorus:1 bridge:1 solo:1 outro:1') },
          drums: { vol: 0.74, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '............X.XX', tom1: '..........X.....', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { inst: 'Electric Bass - Finger', in: IN('intro:0'), p: { style: { verse: '0:R:8 8:R:6 14:A:2', chorus: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', solo: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', bridge: '0:R:16' } } },
          rhythm: { vol: 0.46, in: IN('intro:0 verse:0 chorus:1 bridge:0 solo:1 outro:0'), riffs: { chorus: ['0:C:8a 8:C:8', '0:O:8a 8:O:8'], solo: ['0:C:8a 8:C:8'] } } } }
    }
  });

  /* =========================================================== STEVE VAI == */
  /* Library: 143 songs — mostly instrumental (a singer in a fifth of the files). 128 BPM typical (70–200), 69 % major
   * (E major by far — E Lydian —, D, A, B), 22 % of the bars in other meters; distortion 79 %, clean 34 %, steel 21 %,
   * some 7-string / drop tunings; strings 22 %, piano 15 %, brass 7 %; verses of 16 bars, outros of 15; rhythm:
   * 8th-note chords, off-beat stabs ("..O...O...O...O."), palm muting 9 %; bass: one long root or root 8ths;
   * drums: kick on 1 and 3, hi-hat 8ths; 15 % of the lead bars doubled in harmony; lead: legato, wide slides,
   * whammy bar, tapping, harmonics; sung parts: 5 notes a bar, late entries ("8:2 10:2 12:2 14:2"). */
  band('Steve Vai', {
    band: 'vai',
    desc: 'Virtuoso instrumental rock with a sense of theatre: bright Lydian anthems over strings and piano, heavy low-string riffs (with a singer), quirky off-beat funk-rock, and slow ballads where the guitar cries like a voice — legato, wide slides, whammy-bar swoops, tapping and harmonics, often doubled by a second guitar in harmony.',
    tempo: [96, 126, 110], swing: 0, grid: 8, key: { major: 'E', minor: 'E' }, mode: 'major',
    keys: { major: ['E', 'D', 'A', 'B', 'G', 'C'], minor: ['E', 'B', 'F#', 'A', 'D'] }, minor: 0.3,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:16 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Chorus:8 Outro:8',
      Extended: 'Intro:8 Verse:16 Chorus:8 Verse:16 Chorus:8 Bridge:8 Solo:16 Verse:8 Chorus:8 Chorus:8 Outro:16'
    },
    progs: [
      P('Lydian I–II', 'major', 'verse intro solo', 'I II I II', 'anthem ballad quirky'), P('Lydian pedal Imaj7#11', 'major', 'verse intro', 'Imaj7#11 Imaj7#11 II II', 'anthem ballad'),
      P('I–I–I–I·V', 'major', 'verse', 'I I I I-V', 'anthem quirky'), P('I–V–vi–IV', 'major', 'verse solo', 'I V vi IV', 'anthem ballad'), P('I–I·vi–I–I', 'major', 'verse', 'I I-vi IV I', 'anthem quirky'),
      P('V–IV–iii–IV', 'major', 'verse chorus', 'V IV iii IV', 'anthem ballad'), P('I–bVII–IV–I', 'major', 'verse solo', 'I bVII IV I', 'anthem quirky heavy'),
      P('Chorus: IV–V–vi–vi', 'major', 'chorus', 'IV V vi vi', 'anthem ballad'), P('Chorus: IV–V–I–I', 'major', 'chorus', 'IV V I I', 'anthem quirky ballad'),
      P('Chorus: bVI–bVII–I–I', 'major', 'chorus bridge', 'bVI bVII I I', 'anthem quirky heavy'), P('Chorus: I–II–IV–I (Lydian)', 'major', 'chorus solo', 'I II IV I', 'anthem ballad quirky'),
      P('Chorus: vi–IV–I–V', 'major', 'chorus solo', 'vi IV I V', 'anthem ballad'),
      P('Bridge: bIII–bVII–IV–I', 'major', 'bridge', 'bIII bVII IV I', 'anthem quirky heavy'), P('Bridge: ii–iii–IV–V', 'major', 'bridge', 'ii iii IV V', 'anthem ballad quirky'),
      P('Bridge: iv–bVI–I', 'major', 'bridge', 'iv iv bVI bVII', 'anthem ballad'),
      P('Minor i–i–i–bIII', 'minor', 'verse intro', 'i i i bIII', 'heavy quirky anthem'), P('Minor bVI–i·bVI–bVI–bVII', 'minor', 'verse solo', 'bVI i-bVI bVI bVII', 'heavy anthem ballad'),
      P('Phrygian i–bII', 'minor', 'verse intro solo', 'i bII i bII', 'heavy quirky'), P('Dorian i–IV', 'minor', 'verse solo', 'i7 IV i7 IV', 'quirky heavy anthem'),
      P('Minor i–bVII–bVI–bVII', 'minor', 'verse solo', 'i bVII bVI bVII', 'heavy anthem ballad'),
      P('Minor chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'heavy anthem ballad quirky'), P('Minor chorus: i–bVI–bIII–bVII', 'minor', 'chorus solo', 'i bVI bIII bVII', 'heavy anthem ballad'),
      P('Minor chorus: bIII–IV–i–i', 'minor', 'chorus', 'bIII IV i i', 'heavy quirky'), P('Minor bridge: iv–bVII–bIII–bVI', 'minor', 'bridge', 'iv bVII bIII bVI', 'heavy anthem ballad quirky'),
      P('Heavy riff on i', 'minor', 'verse intro', 'i i i i', 'heavy'), P('Heavy major I–bIII–IV', 'major', 'verse intro solo', 'I bIII IV I', 'heavy'),
      P('Heavy major chorus: IV–bVII–I', 'major', 'chorus', 'IV bVII I I', 'heavy')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.86, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x...x...x...x...' },
        verse: { kick: 'X.......X.x.....X.....x.X.x.....', snare: '....X.......X.......X.......X...', hhc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        solo: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', hho: 'X...X...X...X...', hhc: '..x...x...x...x.' },
        bridge: { kick: 'X.......X.......', snare: '........X.......', ride: 'x...x...x...x...' },
        fill: { snare: '........X.XX.X..', tom1: '............X.X.', tom2: '.............X.X', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', '8ths', 'roots'], fx: 'Dry', vol: 0.86, p: { style: {
        intro: '0:R:16', verse: '0:R:6 6:R:2 8:R:4 12:5:2 14:R:2', chorus: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:5:2 14:A:2',
        solo: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:5:2', bridge: '0:R:2 2:R:14' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'power', 'octriff', 'stabs', 'sus4', 'pedal'], fx: 'Rock Distortion (DS-1)', vol: 0.56, pan: -0.45,
        riffs: {
          intro: ['0:O:16r', '0:C:8a 8:C:8', '0:O:8r 8:S:4 12:T:4'],
          verse: ['0:O:8r 8:S:4 12:T:4', '0:C:6a 6:C:2 8:C:4 12:C:4', '0:C:2a 2:C:2 4:C:2 6:C:2 8:C:2a 10:C:2 12:C:2 14:C:2', '0:O:6r 6:T:2 8:S:4 12:T:4', '2:T:2. 6:T:2. 10:T:2. 14:T:2.'],
          chorus: ['0:C:8a 8:C:8', '0:C:6a 6:C:2 8:C:6a 14:C:2', '0:O:8a 8:O:4 12:O:4', '0:C:4a 4:C:2 6:C:4 10:C:2 12:C:4'],
          bridge: ['0:O:16r', '0:C:16'],
          solo: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:2a 2:c:2p 4:c:2p 6:C:2a 8:c:2p 10:c:2p 12:C:2a 14:c:2p']
        } }),
      T('clean', 'Clean Guitar', 'arp', 'Electric Guitar - Clean', { alt: 'guitar', fx: 'Clean + Chorus', vol: 0.5, pan: 0.45, in: IN('intro:1 verse:1 chorus:.5 bridge:1 solo:0 outro:1') }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'mix', plays: ['mix', 'chords', 'arp', 'pad'], fx: 'Hall', vol: 0.5, pan: 0.15,
        mix: { intro: 'arp', verse: 'arp', chorus: 'chords', bridge: 'arp', solo: 'chords', outro: 'arp' },
        p: { arp: { intro: '0.1.2.3.2.1.2.3.', verse: '0.2.1.3.2.1.3.2.', bridge: '0.1.2.3.2.3.1.2.' }, chords: { chorus: '0:4 4:4 8:4 12:4', solo: '0:8 8:8' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.42, pan: 0.2, in: IN('intro:1 verse:.5 chorus:1 bridge:1 solo:.5 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.8, pan: 0, lead: true, in: IN('intro:.5 verse:1 chorus:1 bridge:1 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, harmonics: true, modes: true, complex: true } }),
      T('lead2', 'Lead Guitar (harmony)', 'horn2', 'Electric Guitar - Lead', { alt: 'lead', play: 'harmony', leadOf: 'lead', fx: 'Lead (TS + Delay)', vol: 0.52, pan: 0.35, in: IN('intro:0 verse:0 chorus:1 bridge:0 solo:0 outro:1') })
    ],
    // the singer of the songs with vocals (the 'heavy' kind); the other kinds switch the singer off
    vocal: { gender: 'male', range: [55, 74], voices: 2, choir: ['hook', 'harmony'], scoop: 0.2, melisma: 0.1, lift: 5, blue: true,
            reg: { verse: 0.4, pre: 0.5, chorus: 0.68, bridge: 0.55, outro: 0.6 },
            cells: { verse: CE('0:4 4:4 8:2 10:2 12:2 14:2 | 8:2 10:4 14:2 | 4:2 6:2 8:2 10:4 14:2 | 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:4 4:4 8:4 12:2 14:2'),
              pre: CE('0:4 4:4 8:4 12:4 | 0:8 8:8'), chorus: CE('8:2 10:2 12:2 14:2 | 0:4 4:4 8:8 | 2:2 4:2 6:2 10:2 12:2 14:2 | 0:6 6:2 8:8'), bridge: CE('0:8 8:8') } },
    leadPlan: { intro: 'melody', verse: 'melody', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
    melody: { heroes: ['vai'], scales: { all: { major: 'Lydian', minor: 'Dorian' }, solo: { major: 'Lydian', minor: 'Natural Minor' }, always: true } },
    types: {
      anthem: { n: 'Lydian anthem — majestic theme, strings, harmony guitars', w: 3,
        d: 'A slow-building instrumental: the theme floats over a Lydian vamp with clean guitars and strings, a second guitar joins in harmony for the chorus, and the solo climbs from long whammy-bar notes to tapped runs.',
        set: { vocal: null } },
      heavy: { n: 'Heavy rock with a singer — low riff, gang chorus', w: 2,
        d: 'A song with vocals: a syncopated riff on the lowest strings, loud drums, a rock singer with a shouted chorus, and a wild solo of dives, squeals and tapping.',
        set: { tempo: [110, 150, 128], minor: 0.6, key: { major: 'D', minor: 'E' }, keys: { major: ['D', 'E', 'A', 'G'], minor: ['E', 'D', 'B', 'F#'] },
          leadPlan: { verse: 'fills' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:16 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:16 Chorus:8 Chorus:8 Outro:8' },
          melody: { heroes: ['vai'], scales: { all: { major: 'Mixolydian', minor: 'Minor Pentatonic' }, solo: { major: 'Lydian', minor: 'Dorian' }, always: true } },
          vocal: { gender: 'male', range: [55, 74], voices: 2, choir: ['hook', 'harmony'], scoop: 0.2, melisma: 0.1, lift: 5, blue: true,
            reg: { verse: 0.4, pre: 0.5, chorus: 0.68, bridge: 0.55, outro: 0.6 },
            cells: { verse: CE('0:4 4:4 8:2 10:2 12:2 14:2 | 8:2 10:4 14:2 | 4:2 6:2 8:2 10:4 14:2 | 2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 0:4 4:4 8:4 12:2 14:2'),
              pre: CE('0:4 4:4 8:4 12:4 | 0:8 8:8'), chorus: CE('8:2 10:2 12:2 14:2 | 0:4 4:4 8:8 | 2:2 4:2 6:2 10:2 12:2 14:2 | 0:6 6:2 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          clean: { on: false }, strings: { on: false },
          drums: { vol: 0.9, pat: {
            intro: { kick: 'X..x..x.X.......', snare: '....X.......X...', hho: 'x...x...x...x...' },
            verse: { kick: 'X..x..x...x.X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hho: 'x...x...x...x...' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hho: 'X...X...X...X...' },
            solo: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X..X.XXX', tom1: '..........X.....', tom2: '............X...', kick: 'X.......X.......' } } },
          bass: { inst: 'Electric Bass - Pick', p: { style: { intro: '0:R:3 3:R:3 6:R:2 8:R:8', verse: '0:R:3 3:R:3 6:R:2 10:R:2 12:b7:2 14:R:2', pre: '0:R:2 2:R:2 4:R:2 6:R:2 8:R:2 10:R:2 12:R:2 14:R:2', chorus: '0:R:4 4:R:4 8:R:4 12:R:2 14:A:2', solo: '0:R:3 3:R:3 6:R:2 10:R:2 12:b7:2 14:R:2' } } },
          rhythm: { fx: 'Metal (MT-2)', vol: 0.62, riffs: {
            intro: ['0:k0:3a 3:k0:3 6:k3:2 8:k0:2p 10:k5:2 12:k6:1 13:k5:1 14:k3:2', '0:C:8a 8:C:8'],
            verse: ['0:k0:3a 3:k0:3 6:k3:2 8:k0:2p 10:k5:2 12:k6:1 13:k5:1 14:k3:2', '0:k0:2p 2:k0:1p 3:k10:2 5:k0:1p 6:k12:2 8:k0:2p 10:k0:1p 11:k7:2 13:k5:1 14:k3:2',
                    '0:C:3a 3:k0:1p 4:k0:2p 6:C:2a. 10:k0:2p 12:k3:2 14:k5:2', '0:k0:1p 1:k0:1p 2:k7:1 3:k0:1p 4:k8:1 5:k0:1p 6:k7:2 8:k0:1p 9:k0:1p 10:k5:1 11:k0:1p 12:k3:2 14:k5:2'],
            pre: ['0:C:2a 2:c:2p 4:c:2p 6:c:2p 8:C:2a 10:c:2p 12:c:2p 14:c:2p'], chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:C:4a 4:C:4 8:C:4 12:C:2 14:C:2'],
            bridge: ['0:C:16'], solo: ['0:C:3a 3:k0:1p 4:k0:2p 6:C:2a. 10:k0:2p 12:k3:2 14:k5:2', '0:C:6a 6:C:2 8:C:6a 14:C:2'] } },
          lead: { in: IN('intro:.5 verse:.5 pre:0 chorus:.5 bridge:.5 solo:1 outro:1'), mel: { bends: true, vibrato: true, slides: true, harmonics: true, fast: true, complex: true } },
          lead2: { on: false } } },
      quirky: { n: 'Quirky funk-rock — off-beat stabs, playful lead', w: 2,
        d: 'Humour and groove: guitar chords clipped on the off-beats, a busy syncopated bass, tight drums; the lead "talks" with slides, scoops and odd intervals.',
        set: { tempo: [104, 138, 120], minor: 0.4, vocal: null },
        tracks: {
          strings: { on: false }, clean: { on: false },
          drums: { pat: {
            intro: { kick: 'X.......X.......', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x....X.x..x..', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            solo: { kick: 'X..x..x.X.x..x..', snare: '....X.......X..x', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '........X..X.XX.', tom1: '..........X.....', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { vol: 0.9, p: { style: { intro: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2', verse: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2', chorus: '0:R:3 3:R:3 6:R:2 8:R:3 11:5:3 14:A:2', solo: '0:R:2 3:R:1 4:8:2 7:R:1 8:b7:2 10:R:2 14:5:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { fx: 'Funk (Comp + Clean)', vol: 0.54, riffs: {
            intro: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.'], verse: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.', '2:T:1. 3:T:1x 6:T:2. 10:T:1. 11:T:1x 14:T:2.', '0:0:2 2:T:2. 4:7:2 6:T:2. 8:10:2 10:T:2. 12:7:2 14:T:2.'],
            chorus: ['0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4'], bridge: ['0:O:16r'], solo: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2'] } } } },
      ballad: { n: 'Ballad — the guitar cries like a voice', w: 2,
        d: 'Slow and emotional: piano and clean guitar arpeggios, strings, a soft beat; the lead plays a long melody full of slides, whammy-bar vibrato and harmonics that builds to a fast, passionate solo.',
        set: { tempo: [56, 84, 70], minor: 0.4, key: { major: 'E', minor: 'B' }, keys: { major: ['E', 'A', 'D', 'G', 'B'], minor: ['B', 'E', 'F#', 'A'] }, vocal: null, leadPlan: { intro: 'rest', verse: 'melody', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Chorus:8 Outro:8' } },
        tracks: {
          piano: { on: true }, clean: { vol: 0.54 }, strings: { vol: 0.46 },
          drums: { vol: 0.74, in: IN('intro:0 verse:.5'), pat: {
            verse: { kick: 'X.......X.x.....', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '............X.XX', tom1: '..........X.....', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:0'), p: { style: { verse: '0:R:8 8:R:6 14:A:2', chorus: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', solo: '0:R:6 6:R:2 8:5:4 12:3:2 14:A:2', bridge: '0:R:16' } } },
          rhythm: { vol: 0.46, in: IN('intro:0 verse:0 chorus:1 bridge:0 solo:1 outro:0'), riffs: { chorus: ['0:C:8a 8:C:8', '0:O:8a 8:O:8'], solo: ['0:C:8a 8:C:8'] } } } }
    }
  });

  /* ============================================================= SANTANA == */
  /* Library: 35 songs. 118 BPM typical (80–136), 73 % minor (A minor above all, E, D, G minor), all in 4/4; piano in
   * 45 % of the songs, organ 18 %, brass 16 %, strings 10 %; the lead guitar plays in 24–30 % of the VERSE and
   * CHORUS bars (it sings the tune) and 46 % overall; rhythm: open / acoustic chords with the syncopation
   * "O...O.O...O.O.O." and "O.O.O.O...O.O.O.", almost no power chords (6 %) and no palm muting; bass: the tumbao-like
   * "0:R:6 6:5:2 8:b7:2 10:b7:2 12:8:2 14:b7:2"; drums: kick "X.....x.X......." with open hi-hat 8ths under the
   * congas and timbales; two chords a bar: i·bVII–i·bVII–iv·bIII, i·bVII–v·iv; singer: short low phrases (median C4)
   * — the lead answers; lead scale: minor pentatonic + the 2nd, the Dorian 6th only 1 % of the notes. */
  band('Santana', {
    band: 'santana',
    desc: 'Latin rock: a rock rhythm section with congas, timbales and güiro, Hammond organ and piano montunos over two-chord minor vamps, coros that answer the singer — and a lead guitar with endless sustain that sings the melody, repeats short motifs and holds one note over the whole band. Cha-cha grooves, fast Afro-Latin jams, slow instrumentals and Latin pop.',
    tempo: [104, 132, 118], swing: 0, grid: 8, key: { major: 'A', minor: 'A' }, mode: 'minor',
    keys: { major: ['A', 'G', 'D', 'E'], minor: ['A', 'E', 'D', 'G', 'B'] }, minor: 0.75,
    structures: {
      Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
      Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Chorus:8 Outro Solo:8',
      Extended: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Bridge:8 Solo:16 Solo:8 Chorus:8 Chorus:8 Outro Solo:16'
    },
    progs: [
      P('Dorian vamp i–IV', 'minor', 'verse solo intro', 'i7 IV i7 IV', 'latinrock jam pop'), P('i·IV (two chords a bar)', 'minor', 'verse solo intro', 'i7-IV i7-IV i7-IV i7-IV', 'latinrock jam chacha'),
      P('i·bVII–i·bVII–iv·bIII', 'minor', 'verse intro', 'i-bVII i-bVII iv-bIII iv-bIII', 'latinrock chacha pop'), P('i·bVII–v·iv–i·bVII–i', 'minor', 'verse solo', 'i-bVII v-iv i-bVII i', 'latinrock chacha jam'),
      P('i–iv–V7–i', 'minor', 'verse chorus', 'i iv V7 i', 'latinrock chacha pop'), P('i–i–i–iv', 'minor', 'verse', 'i i i iv', 'latinrock jam'),
      P('Andalusian i–bVII–bVI–V7', 'minor', 'chorus solo', 'i bVII bVI V7', 'latinrock chacha pop slow'), P('Chorus: iv·V–bIII·iv–ii·bIII–i', 'minor', 'chorus', 'iv-V7 bIII-iv iv-V7 i', 'latinrock chacha'),
      P('Chorus: bVI–V–V–i', 'minor', 'chorus bridge', 'bVI V7 V7 i', 'latinrock chacha pop'), P('Chorus: i–bVII–bVI–bVII', 'minor', 'chorus bridge', 'i bVII bVI bVII', 'latinrock jam pop slow'),
      P('Chorus: bVI–bVII–i–i', 'minor', 'chorus', 'bVI bVII i i', 'latinrock pop jam'), P('Bridge: iv–i–V7–i', 'minor', 'bridge', 'iv i V7 i', 'latinrock chacha pop slow jam'),
      P('Mixolydian I–bVII–IV–I', 'major', 'verse chorus solo', 'I bVII IV I', 'latinrock jam pop'), P('I–IV vamp', 'major', 'verse solo intro', 'I IV I IV', 'latinrock chacha jam pop'),
      P('I·IV–V·IV', 'major', 'verse chorus', 'I-IV V-IV I-IV V-IV', 'latinrock chacha pop'), P('Major chorus: ii–V–I–vi', 'major', 'chorus bridge', 'ii7 V7 I vi', 'latinrock chacha pop slow'),
      P('Major chorus: IV–V–I–I', 'major', 'chorus', 'IV V I I', 'latinrock chacha pop jam'),
      // slow instrumentals: the circle of fifths in minor
      P('Slow: iv–bVII–bIII–bVI · iiø–V7–i', 'minor', 'verse chorus solo intro', 'iv7 bVII7 bIIImaj7 bVImaj7 iv7 V7 i i', 'slow'), P('Slow: i–iv–bVII–bIII', 'minor', 'verse solo', 'i7 iv7 bVII7 bIIImaj7', 'slow'),
      P('Slow: i–bVI–iv–V7', 'minor', 'verse chorus intro', 'i bVImaj7 iv7 V7', 'slow'), P('Slow major: Imaj7–vi–ii–V', 'major', 'verse chorus solo intro', 'Imaj7 vi7 ii7 V7', 'slow'),
      P('Slow major: Imaj7–IVmaj7', 'major', 'verse intro', 'Imaj7 IVmaj7 Imaj7 IVmaj7', 'slow'), P('Slow bridge: bVI–bVII–i', 'minor', 'bridge', 'bVI bVII i i', 'slow')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.76, pat: {
        intro: { kick: 'X.......X.......', hho: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.....x.X.......', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', ride: 'X.x.x.X.x.x.X.x.' },
        solo: { kick: 'X..x..x.X..x..x.', snare: '....X.......X..o', ride: 'X.x.x.X.x.x.X.x.' },
        bridge: { kick: 'X.......X.......', snare: '....o.......o...', ride: 'x...x...x...x...' },
        fill: { snare: '........x.x.X.x.', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } }),
      T('congas', 'Congas', 'drums', 'Congas', { kit: 'congas', vol: 0.62, pan: 0.3, pat: {
        intro: { hhc: 'o.o...o.o.o.....', perc: '....X...........', tom1: '............X.X.' },
        verse: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X...', tom2: '..............................X.' },
        chorus: { hhc: 'o.o...o.o.o.....o.o...o.o.o.....', perc: '....X...............X...........', tom1: '............X.X.............X.X.', tom2: '..............X...............X.' } } }),
      T('timbales', 'Timbales / Cowbell', 'drums', 'Timbales', { kit: 'timbales', vol: 0.5, pan: -0.3, in: IN('intro:0 verse:.5'), pat: {
        verse: { perc: 'X...x.x...x...x.X...x...X.x...x.' },
        chorus: { ride: 'X...x.x.X.x.x.x.X.x.x...X.x.x.x.' },
        fill: { tom1: '........X.x.x.xx', tom2: '...............X' } } }),
      T('guiro', 'Güiro', 'drums', 'Güiro', { kit: 'guiro', vol: 0.36, pan: 0.6, in: IN('intro:0'), pat: { verse: { hho: 'X.......X.......', hhc: '....x.x.....x.x.' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'tumbao', 'roots'], fx: 'Dry', vol: 0.88, p: { style: {
        intro: '0:R:6 6:5:2 8:R:8', verse: '0:R:6 6:5:2 8:b7:2 10:b7:2 12:8:2 14:b7:2', chorus: '0:R:3 3:R:1 4:5:2 6:8:2 8:R:3 11:5:3 14:N:2',
        solo: '0:R:3 3:5:3 6:8:2 8:R:3 11:5:3 14:A:2', bridge: '0:R:8 8:5:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'chords', plays: ['chords', 'pad', 'montuno-light'], fx: 'Room', vol: 0.5, pan: 0.3,
        p: { chords: { intro: '0:8 8:8', verse: '0:2 3:1 6:2 10:2 13:1', chorus: '0:3 3:3 6:2 8:3 11:3 14:2:N', bridge: '0:8 8:8', solo: '0:2 3:1 6:2 10:2 13:1' } } }),
      T('piano', 'Piano (montuno)', 'harmony', 'Grand Piano', { alt: 'keys', on: false, play: 'montuno-light', plays: ['montuno-light', 'montuno', 'chords', 'mix'], fx: 'Room', vol: 0.46, pan: -0.15, in: IN('intro:.5 verse:.5 chorus:1 bridge:.5 solo:1 outro:1') }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'chords', 'funkline', 'hendrix', 'power', 'strum'], fx: 'Crunch (TS-808 + Plexi)', vol: 0.5, pan: -0.4,
        riffs: {
          intro: ['0:O:8r 8:O:8r', '0:T:4a 6:T:2 10:T:2 12:T:2 14:T:2'],
          verse: ['0:T:4a 4:T:2 6:T:4 10:T:2 12:T:2 14:T:2', '0:T:2a 2:T:2 4:T:2 6:T:4 10:T:2 12:T:2 14:T:2', '2:T:1. 6:T:1. 8:T:1. 11:T:1. 14:T:1.', '0:T:2a 2:T:4 6:T:4 10:T:6'],
          chorus: ['0:O:4a 4:O:2 6:O:4 10:O:2 12:O:2 14:O:2', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:O:2a 2:O:2 4:O:2 6:O:4 10:O:2 12:O:2 14:O:2'],
          bridge: ['0:O:8r 8:O:8r'],
          solo: ['0:T:4a 4:T:2 6:T:4 10:T:2 12:T:2 14:T:2', '2:T:1. 6:T:1. 8:T:1. 11:T:1. 14:T:1.', '0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2']
        } }),
      T('aguitar', 'Nylon Guitar', 'strum', 'Classical Guitar - Nylon', { alt: 'guitar', on: false, play: 'strum', plays: ['strum', 'arp'], fx: 'Room', vol: 0.5, pan: 0.4,
        p: { strum: { intro: 'D.....D...D.D.D.', verse: 'D...D.D...D.D.D.', chorus: 'D.D.D.D...D.D.DU', solo: 'D...D.D...D.D.D.' } } }),
      T('brass', 'Brass Section', 'harmony', 'Trumpet', { alt: 'horn', on: false, play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.46, pan: 0.2, in: IN('intro:1 verse:0 chorus:1 bridge:.5 solo:0 outro:1'),
        p: { chords: { intro: '0:3 3:3 6:2 8:8', chorus: '0:3 3:3 6:2 12:2 14:2', outro: '0:3 3:3 6:2 8:8', bridge: '0:8 8:8' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.42, in: IN('intro:1 verse:.5 chorus:1 bridge:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Lead (TS + Delay)', vol: 0.78, pan: 0.15, lead: true, in: IN('intro:1 verse:.5 chorus:.5 bridge:.5 solo:1 outro:1'), mel: { bends: true, vibrato: true, slides: true } })
    ],
    vocal: { gender: 'male', range: [50, 67], voices: 2, choir: ['call', 'harmony', 'hook'], scoop: 0.25, melisma: 0.15, lift: 3,
      reg: { verse: 0.45, chorus: 0.55, bridge: 0.5, outro: 0.5 },
      cells: {
        verse: CE('0:3 3:5 | 0:4 14:2 | 4:2 6:2 8:2 10:2 12:2 14:2 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 6:2 8:2 10:2 12:4'),
        chorus: CE('0:3 3:3 6:2 8:8 | 4:2 6:2 8:2 10:2 12:4 | 0:4 4:4 8:8 | 0:3 3:3 6:4'),
        bridge: CE('0:8 8:8 | 0:4 4:4 8:8')
      } },
    leadPlan: { intro: 'melody', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { heroes: ['santana'], scales: { all: { major: 'Mixolydian', minor: 'Dorian' }, solo: { major: 'Major Blues', minor: 'Minor Pentatonic' }, always: true } },
    types: {
      latinrock: { n: 'Latin rock — organ, congas, a singing lead', w: 3,
        d: 'A minor two-chord vamp with organ, congas, timbales and güiro; the singer trades short lines with the coro and the guitar; the solo starts with one long sustained note and builds on repeated motifs.' },
      chacha: { n: 'Cha-cha groove — piano montuno, coro', w: 2,
        d: 'A slower cha-cha-chá: the piano plays the montuno, the güiro and the cowbell mark the beat, the bass plays the tumbao; the coro sings the hook and the guitar plays the melody between the lines.',
        set: { tempo: [104, 124, 114], minor: 0.8,
          vocal: { gender: 'male', range: [50, 67], voices: 2, choir: ['call', 'call', 'harmony'], scoop: 0.25, melisma: 0.15, lift: 3,
            reg: { verse: 0.45, chorus: 0.55, bridge: 0.5, outro: 0.5 },
            cells: { verse: CE('0:3 3:5 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 4:2 6:2 8:2 10:2 12:4'), chorus: CE('0:3 3:3 6:2 8:8 | 0:3 3:3 6:4 | 4:2 6:2 8:2 10:2 12:4'), bridge: CE('0:8 8:8') } } },
        tracks: {
          piano: { on: true, play: 'montuno', vol: 0.5 }, organ: { play: 'pad', vol: 0.36 },
          drums: { vol: 0.68, pat: {
            intro: { kick: 'X.......X.......', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.....x.', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.....x.', snare: '....o.......X...', ride: 'X...X...X...X...' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X...X...X...X...' },
            fill: { snare: '........x.x.X.x.', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } },
          timbales: { in: IN('intro:.5 verse:1'), pat: { verse: { perc: 'X...X...X...X...' }, chorus: { perc: 'X...X.x.X...X.x.' }, fill: { tom1: '........X.x.x.xx', tom2: '...............X' } } },
          bass: { play: 'tumbao', plays: ['tumbao', 'style', 'roots'] },
          rhythm: { vol: 0.42, fx: 'Clean + Chorus', riffs: { verse: ['2:T:1. 6:T:1. 10:T:1. 14:T:1.', '2:T:1. 6:T:1. 8:T:1. 11:T:1. 14:T:1.'], chorus: ['0:T:4a 4:T:2 6:T:4 10:T:2 12:T:2 14:T:2'], solo: ['2:T:1. 6:T:1. 10:T:1. 14:T:1.'] } } } },
      jam: { n: 'Afro-Latin jam — fast, percussion breaks, long solo', w: 2,
        d: 'Faster and mostly instrumental: driving congas and timbales, a rock beat, organ stabs and a long guitar solo over one vamp (with an organ pad under it).',
        set: { tempo: [124, 148, 134], minor: 0.8, vocal: null, leadPlan: { intro: 'riff', verse: 'melody', chorus: 'melody', bridge: 'riff', solo: 'solo', outro: 'solo' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:16 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Solo:16 Chorus:8 Outro Solo:8',
            Extended: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Solo:16 Solo:8 Chorus:8 Outro Solo:16' } },
        tracks: {
          drums: { vol: 0.8, pat: {
            intro: { kick: 'X..x..x.X..x..x.', hho: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', hho: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', ride: 'X.x.x.X.x.x.X.x.' },
            solo: { kick: 'X..x..x.X..x..x.', snare: '....X.......X..o', ride: 'X.x.x.X.x.x.X.x.' },
            bridge: { kick: 'X.......X.......', tom1: '..x.x.....x.x...', tom2: '......x.x.....xx' },
            fill: { snare: '........x.x.X.xx', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } },
          lead: { in: IN('intro:1 verse:1 chorus:1 bridge:.5 solo:1 outro:1') } } },
      slow: { n: 'Slow instrumental — the guitar sings a ballad', w: 2,
        d: 'A slow minor ballad without a singer: organ and strings hold the chords of a circle of fifths, soft congas and brushes, and the guitar plays the whole melody with long sustained notes before it takes off.',
        set: { tempo: [62, 90, 76], minor: 0.8, vocal: null, key: { major: 'G', minor: 'A' }, keys: { major: ['G', 'C', 'D'], minor: ['A', 'D', 'G', 'E', 'B'] },
          leadPlan: { intro: 'melody', verse: 'melody', chorus: 'melody', bridge: 'melody', solo: 'solo', outro: 'melody' },
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Verse:8 Chorus:8 Solo:16 Verse:8 Chorus:8 Outro:4',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Verse:8 Chorus:8 Outro Solo:8' } },
        tracks: {
          strings: { on: true }, organ: { play: 'pad', vol: 0.42 }, guiro: { on: false }, timbales: { on: false },
          drums: { vol: 0.62, pat: {
            intro: { hhc: 'x...x...x...x...' },
            verse: { kick: 'X.......X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.......X.x.....', snare: '....o.......o...', ride: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '............o.X.', tom1: '................', tom2: '..............X.', kick: 'X.......X.......' } } },
          congas: { vol: 0.5 },
          bass: { p: { style: { intro: '0:R:16', verse: '0:R:6 6:R:2 8:5:6 14:A:2', chorus: '0:R:6 6:5:2 8:R:4 12:5:2 14:A:2', solo: '0:R:6 6:5:2 8:R:4 12:5:2 14:A:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { vol: 0.4, fx: 'Clean + Chorus', riffs: { intro: ['0:O:16r'], verse: ['0:O:8r 8:O:8r', '0:T:6r 6:T:2 8:T:8r'], chorus: ['0:O:8r 8:O:8r'], solo: ['0:T:6r 6:T:2 8:T:8r'], bridge: ['0:O:16r'] } },
          lead: { in: IN('intro:1 verse:1 chorus:1 bridge:1 solo:1 outro:1') } } },
      pop: { n: 'Latin pop — nylon guitar, brass, big chorus', w: 2,
        d: 'The radio sound: a tight groove with nylon-string guitar, piano, brass hits in the chorus and backing singers; the electric lead answers every line of the singer and takes a short, lyrical solo.',
        set: { tempo: [92, 118, 104], minor: 0.7,
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Solo:8 Chorus:8 Outro Solo:8',
            Extended: 'Intro:8 Verse:8 Pre-Chorus:4 Chorus:8 Verse:8 Pre-Chorus:4 Chorus:8 Bridge:8 Solo:8 Chorus:8 Chorus:8 Outro Solo:8' },
          vocal: { gender: 'male', range: [52, 71], voices: 2, choir: ['harmony', 'hook', 'oohs'], scoop: 0.2, melisma: 0.2, lift: 4,
            reg: { verse: 0.4, pre: 0.5, chorus: 0.62, bridge: 0.5, outro: 0.55 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 10:2 12:2 14:2 | 4:2 6:2 8:2 10:2 12:4 | 0:3 3:3 6:4'), pre: CE('0:4 4:4 8:4 12:4 | 0:2 2:2 4:4 8:8'), chorus: CE('0:3 3:3 6:2 8:8 | 0:4 4:4 8:8 | 2:2 4:2 6:4 12:2 14:2 | 0:6 6:2 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          aguitar: { on: true }, piano: { on: true, play: 'chords', p: { chords: { intro: '0:8 8:8', verse: '0:3 3:3 6:2 10:2 13:1', pre: '0:4 4:4 8:4 12:4', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', solo: '0:3 3:3 6:2 10:2 13:1', bridge: '0:8 8:8' } } },
          brass: { on: true }, organ: { on: false }, guiro: { on: false },
          drums: { vol: 0.8, pat: {
            intro: { kick: 'X.......X.......', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x..x.X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            pre: { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            solo: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', ride: 'X.x.x.X.x.x.X.x.' },
            fill: { snare: '........x.x.X.xx', tom1: '............x.x.', tom2: '..............X.', kick: 'X.......X.......' } } },
          rhythm: { vol: 0.42, fx: 'Clean + Chorus', riffs: { verse: ['2:T:1. 6:T:1. 8:T:1. 11:T:1. 14:T:1.'], pre: ['0:O:8r 8:O:8r'], chorus: ['0:C:3a 3:C:3 6:C:2 8:C:3a 11:C:3 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:2 14:O:2'], solo: ['2:T:1. 6:T:1. 8:T:1. 11:T:1. 14:T:1.'] } } } }
    }
  });

  /* ================================================= STEVIE RAY VAUGHAN == */
  /* Library: 38 songs (guitar transcriptions — almost no drum or bass tracks, so the rhythm section follows the
   * Texas-blues tradition). 120 BPM typical (80–200), tuned a half step down in 60 % of the files (Eb = the E shapes:
   * E, A, G, B), 15 % of the bars in 12/8 and 14 % shuffled; one overdriven guitar that plays rhythm and lead at
   * once: 8th-note chords "O.O.O.O.O.O.O.O." (63 % power / two-string shapes in the verse), arpeggios 11 %;
   * 12-bar verses, very long intros (17 bars: the guitar plays a full chorus before singing) and solos (24 bars);
   * loops i·bVII–i·bVII–iv·bIII, i–iv–iv–i; singer: 4–5 notes a bar around D4, lines that start after the beat. */
  band('Stevie Ray Vaughan', {
    band: 'srv',
    desc: 'Texas blues at full power: a trio (plus organ) behind a thick, overdriven Stratocaster that plays the shuffle rhythm and the answers at the same time. Driving shuffles, slow blues in 12/8, funky straight-8th rockers and breakneck boogies — big bends, raked notes, double stops and fast pentatonic flurries.',
    tempo: [112, 140, 126], swing: 0.64, grid: 8, key: { major: 'E', minor: 'E' }, mode: 'major',
    keys: { major: ['E', 'A', 'G', 'C', 'D'], minor: ['E', 'A', 'B', 'G'] }, minor: 0.3,
    structures: {
      Short: 'Intro:12 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
      Standard: 'Intro:12 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Outro Solo:12',
      Extended: 'Intro:12 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Solo:12 Verse:12 Outro Solo:12'
    },
    progs: [
      P('12-bar blues', 'major', 'verse solo intro outro', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle slow boogie'), P('12-bar (quick change)', 'major', 'verse solo intro outro', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle slow boogie'),
      P('12-bar with stops', 'major', 'verse', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 I7', 'shuffle boogie'),
      P('Minor 12-bar', 'minor', 'verse solo intro outro', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7', 'shuffle slow boogie'), P('Minor 12-bar (iv–i)', 'minor', 'verse solo intro outro', 'i7 iv7 i7 i7 iv7 iv7 i7 i7 V7 iv7 i7 V7', 'shuffle slow'),
      P('Funk vamp I7#9', 'major', 'verse intro solo', 'I7#9 I7#9 I7#9 I7#9', 'funky'), P('I–IV vamp', 'major', 'verse solo', 'I7 IV7 I7 IV7', 'funky'),
      P('I–bIII–IV–I', 'major', 'verse intro', 'I bIII IV I', 'funky'), P('Chorus: IV–IV–I–I · V–IV–I', 'major', 'chorus', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'funky'),
      P('Chorus: bVII–IV–I–I', 'major', 'chorus bridge', 'bVII IV I I', 'funky'),
      P('Minor i·bVII–i·bVII–iv·bIII', 'minor', 'verse intro solo', 'i-bVII i-bVII iv-bIII iv-bIII', 'funky'), P('Minor i–iv–iv–i', 'minor', 'verse solo', 'i7 iv7 iv7 i7', 'funky'),
      P('Minor chorus: bVI–bVII–i', 'minor', 'chorus bridge', 'bVI bVII i i', 'funky'), P('Minor chorus: iv–iv–i–i · bVI–V', 'minor', 'chorus', 'iv7 iv7 i7 i7 bVI7 V7 i7 i7', 'funky')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.84, in: IN('intro:.5'), pat: {
        intro: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
        verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
        chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'walking', 'boogie', 'roots'], fx: 'Dry', vol: 0.88, in: IN('intro:.5'), p: { style: {
        intro: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', verse: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2',
        chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'texas', plays: ['texas', 'bandriff', 'hendrix', 'berry', 'stabs'], fx: 'Blues Overdrive (BD-2)', vol: 0.6, pan: -0.3,
        riffs: {
          intro: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'],
          verse: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2', '0:0:2 2:0:2 4:3:1 5:4:1h 6:7:2 8:9:2 10:7:2 12:3:1 13:4:1h 14:0:2', '4:T:2. 6:T:2 12:T:2. 14:T:2'],
          chorus: ['0:C:4a 6:C:2. 8:C:4a 14:C:2.', '0:c:2 2:c:2 4:c+2:2 6:c+3:2 8:c+2:2 10:c:2 12:c+2:2 14:c:2'],
          solo: ['0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2', '4:T:2. 6:T:2 12:T:2. 14:T:2']
        } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4, pan: 0.3, in: IN('intro:0 verse:.5 chorus:1 solo:1 outro:1') }),
      T('piano', 'Piano', 'harmony', 'Upright Piano', { alt: 'keys', on: false, play: 'chords', plays: ['chords', 'pad'], fx: 'Room', vol: 0.46, pan: 0.25, in: IN('intro:0 verse:1 chorus:1 solo:1 outro:1'),
        p: { chords: { verse: '4:2 6:2 12:2 14:2', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '4:2 6:2 12:2 14:2', outro: '0:8 8:8' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Blues Overdrive (BD-2)', vol: 0.8, pan: 0.15, lead: true, in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true, triplets: true, fast: true } })
    ],
    vocal: { gender: 'male', range: [50, 67], voices: 0, choir: ['oohs'], scoop: 0.4, melisma: 0.15, lift: 2, blue: true, aab: true,
      reg: { verse: 0.55, chorus: 0.65, outro: 0.55 },
      cells: {
        verse: CE('2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 10:4 14:2 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 4:2 6:2 8:2 10:2 12:4 | 2:2 4:2 6:4'),
        chorus: CE('0:4 4:4 8:8 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 8:4'),
        bridge: CE('0:8 8:8')
      } },
    leadPlan: { intro: 'solo', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['srv'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: { major: 'Blues', minor: 'Blues' }, always: true } },
    types: {
      shuffle: { n: 'Texas shuffle — the guitar opens with a full chorus', w: 3,
        d: 'The guitar plays twelve bars before anyone sings; then a driving shuffle with a walking bass, every sung line answered by the guitar, and solos that go round the blues two or three times.' },
      slow: { n: 'Slow blues — 12/8, long crying bends', w: 2,
        d: 'Slow and intense: a 12/8 feel, organ pads, long bass notes; the guitar whispers and screams between the lines of the singer and takes two rounds of solo.',
        set: { tempo: [56, 80, 66], swing: 0.66, minor: 0.5, key: { major: 'G', minor: 'B' }, keys: { major: ['G', 'A', 'C', 'E'], minor: ['B', 'A', 'G', 'E', 'D'] },
          structures: {
            Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
            Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Outro:4',
            Extended: 'Intro:12 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Solo:12 Verse:12 Outro:4' },
          vocal: { gender: 'male', range: [50, 67], voices: 0, choir: ['oohs'], scoop: 0.45, melisma: 0.25, lift: 2, blue: true, aab: true,
            reg: { verse: 0.55, chorus: 0.65, outro: 0.55 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 1:1 2:2 4:2 6:4 | 0:4 4:2 6:2 | 10:4 14:2'), chorus: CE('0:4 4:4 8:8'), bridge: CE('0:8 8:8') } } },
        tracks: {
          organ: { on: true, in: IN('intro:1 verse:1 solo:1 outro:1') },
          drums: { vol: 0.78, in: IN('intro:1'), pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:1'), p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2', solo: '0:R:4 4:3:4 8:5:4 12:6:2 14:5:2', chorus: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2' } } },
          rhythm: { play: 'bandriff', vol: 0.5, riffs: { intro: ['0:T:6r 6:T:2 8:T:8r'], verse: ['4:T:2. 6:T:2 12:T:2. 14:T:2', '0:T:6r 6:T:2 8:T:6r 14:T:2', '0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'],
            solo: ['4:T:2. 6:T:2 12:T:2. 14:T:2', '0:c:2 2:c:2 4:c+2:2 6:c:2 8:c:2 10:c:2 12:c+2:2 14:c:2'], outro: ['0:T:16r'] } } } },
      funky: { n: 'Funky rocker — straight 8ths, Hendrix chords', w: 2,
        d: 'Straight time: a syncopated riff built on the "Hendrix chord" (7#9), a funky bass, verses and choruses instead of 12 bars, chord-melody fills and a ferocious solo.',
        set: { tempo: [104, 132, 118], swing: 0, minor: 0.45,
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Verse:8 Chorus:8 Outro Solo:8',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:16 Bridge:8 Verse:8 Chorus:8 Outro Solo:16' },
          vocal: { gender: 'male', range: [50, 67], voices: 2, choir: ['hook', 'oohs'], scoop: 0.4, melisma: 0.1, lift: 3, blue: true,
            reg: { verse: 0.5, chorus: 0.68, bridge: 0.55, outro: 0.6 },
            cells: { verse: CE('2:2 4:2 6:2 8:2 10:2 12:2 14:2 | 10:4 14:2 | 2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 10:2 12:2 14:2'), chorus: CE('0:4 4:4 8:8 | 0:3 3:3 6:2 8:8 | 2:2 4:2 6:2 8:4'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { in: IN('intro:1'), pat: {
            intro: { kick: 'X..x..x.X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x..x...x.X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X.....x.X.x...x.', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            solo: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            bridge: { kick: 'X.......X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '........X..X.XXX', tom1: '..........X.....', tom2: '................', kick: 'X.......X.......' } } },
          bass: { in: IN('intro:1'), p: { style: { intro: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', verse: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:b7:2 14:A:2', solo: '0:R:3 3:R:3 6:8:2 10:b7:2 12:5:2 14:b7:2', bridge: '0:R:8 8:5:8' } } },
          rhythm: { play: 'bandriff', fx: 'Crunch (TS-808 + Plexi)', riffs: {
            intro: ['0:0:2 2:T:1. 3:T:1x 4:10:2 6:T:2. 8:0:2 10:T:1. 11:T:1x 12:7:1 13:6:1 14:5:2', '0:C:3a 3:C:1. 6:10:2 8:C:3a 11:C:1. 12:7:2 14:10:2'],
            verse: ['0:0:2 2:T:1. 3:T:1x 4:10:2 6:T:2. 8:0:2 10:T:1. 11:T:1x 12:7:1 13:6:1 14:5:2', '0:C:3a 3:C:1. 6:10:2 8:C:3a 11:C:1. 12:7:2 14:10:2', '2:T:2. 6:T:1. 7:T:1x 10:T:2. 14:T:2.', '0:0:2 2:3:1 3:4:1h 4:T:2. 8:0:2 10:10:2 12:T:2. 14:7:2'],
            chorus: ['0:C:6a 6:C:2 8:C:6a 14:C:2', '0:O:4a 4:O:2 6:O:4 10:O:2 12:O:4'], bridge: ['0:O:8r 8:O:8r'],
            solo: ['0:C:3a 3:C:1. 6:C:2 8:C:3a 11:C:1. 14:C:2', '2:T:2. 6:T:1. 7:T:1x 10:T:2. 14:T:2.'] } } } },
      boogie: { n: 'Fast boogie — breakneck shuffle', w: 1,
        d: 'As fast as a shuffle can go: a galloping two-string boogie, a walking bass in 8ths, piano hammering the backbeat and chorus after chorus of rapid-fire guitar.',
        set: { tempo: [168, 208, 186], swing: 0.58, minor: 0.1 },
        tracks: {
          piano: { on: true }, bass: { play: 'walking', plays: ['walking', 'style', 'boogie'] },
          rhythm: { play: 'bandriff' },
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            verse: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.XXXX', tom1: '................', tom2: '................', kick: 'X.......X.......' } } } } }
    }
  });

  /* =========================================================== B.B. KING == */
  /* Library: 17 songs (small sample; mostly guitar and voice — the band follows the big-band blues tradition).
   * 95 BPM typical (74–160), 70 % major (C, G, D, A; B minor, D minor), 12 % of the bars in 12/8; a clean guitar
   * (80 %) that plays almost no chords: the rhythm guitar part is off-beat chops ("..O...O...O...O."), with major 7th
   * and 9th colours (23 % maj7); piano and brass in the arrangements; singer: 5 notes a bar around F4 (59–71), a big
   * gospel voice — the guitar never plays while he sings, it answers. */
  band('B.B. King', {
    band: 'bbking',
    desc: 'Big-band blues: a full rhythm section with piano, organ and a horn section behind a gospel-strong singer — and one clean, sweet guitar that never strums a chord: it answers every sung line with a few perfect notes, a fast "butterfly" vibrato and bends that slide into the major 3rd. Swinging shuffles, slow minor blues with strings, and funky soul-blues.',
    tempo: [96, 132, 112], swing: 0.62, grid: 8, key: { major: 'C', minor: 'B' }, mode: 'major',
    keys: { major: ['C', 'G', 'Bb', 'A', 'D'], minor: ['B', 'D', 'A', 'G', 'C'] }, minor: 0.3,
    structures: {
      Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
      Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Solo:12 Verse:12 Outro:4',
      Extended: 'Intro:12 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4'
    },
    progs: [
      P('12-bar blues', 'major', 'verse solo intro', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle slow'), P('12-bar (quick change)', 'major', 'verse solo intro', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'shuffle slow'),
      P('Jazz blues: I–IV–I–I7 · IV–#iv°–I–VI7 · ii–V–I–V', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 VI7 ii7 V7 I7 V7', 'shuffle slow'),
      P('Intro turnaround', 'major', 'intro outro', 'I7 IV7 I7 V7', 'shuffle slow funky'),
      P('Minor blues: i–iv–i–i · iv–iv–i–i · bVI–V–i', 'minor', 'verse solo intro', 'i7 iv7 i7 i7 iv7 iv7 i7 i7 bVImaj7 V7 i7 V7', 'slow shuffle'), P('Minor blues (bVI–V vamp)', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVImaj7 V7 i7 i7', 'slow funky'),
      P('Minor intro: i–iv–V', 'minor', 'intro outro', 'i7 iv7 V7 V7', 'slow shuffle funky'),
      P('Soul I–IV vamp', 'major', 'verse intro solo', 'I7 IV7 I7 IV7', 'funky'), P('Soul I–vi–ii–V', 'major', 'verse chorus', 'I vi7 ii7 V7', 'funky'),
      P('Soul chorus: IV–IV–I–I · ii–V', 'major', 'chorus bridge', 'IV7 IV7 I7 I7 ii7 V7 I7 V7', 'funky'), P('Soul minor i–iv vamp', 'minor', 'verse intro solo', 'i7 iv7 i7 iv7', 'funky'),
      P('Soul minor chorus: bVI–V–i', 'minor', 'chorus bridge', 'bVImaj7 V7 i7 i7', 'funky')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.8, pat: {
        intro: { kick: 'X.......X.......', snare: '....X.......X.XX', ride: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X.....x.X.....x.', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' },
        chorus: { kick: 'X.....x.X...X.x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
        fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } }),
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'walking', plays: ['walking', 'style', 'roots'], fx: 'Dry', vol: 0.86, p: { style: {
        intro: '0:R:8 8:5:8', verse: '0:R:2 2:R:2 4:3:2 6:5:2 8:6:2 10:5:2 12:3:2 14:R:2', solo: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2', chorus: '0:R:2 2:3:2 4:5:2 6:6:2 8:b7:2 10:6:2 12:5:2 14:3:2' } } }),
      T('piano', 'Piano', 'harmony', 'Grand Piano', { alt: 'keys', play: 'chords', plays: ['chords', 'pad', 'jazz'], fx: 'Room', vol: 0.5, pan: -0.25,
        p: { chords: { intro: '0:8 8:8', verse: '4:2 6:2 12:2 14:2', chorus: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', outro: '0:8 8:8' } } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.36, pan: 0.3, in: IN('intro:.5 verse:.5 chorus:1 solo:1 outro:1') }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'stabs', 'texas'], fx: 'Jazz Clean', vol: 0.42, pan: 0.4,
        riffs: { intro: ['0:T:8r 8:T:8r'], verse: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.', '4:T:2. 12:T:2.', '0:T:2. 10:T:2. 12:T:2.'], chorus: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.'], solo: ['2:T:2. 6:T:2. 10:T:2. 14:T:2.', '4:T:2. 12:T:2.'], outro: ['0:T:16r'] } }),
      T('brass', 'Horn Section', 'harmony', 'Trumpet', { alt: 'horn', play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.46, pan: 0.15, in: IN('intro:1 verse:.5 chorus:1 solo:1 outro:1'),
        p: { chords: { intro: '0:3 3:3 6:2 8:8', verse: '0:16', chorus: '0:2 6:2 8:6', solo: '0:2. 6:2 12:2 14:2', outro: '0:3 3:3 6:2 8:8' } } }),
      T('sax', 'Tenor Sax', 'harmony', 'Tenor Sax', { alt: 'horn', play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.4, pan: -0.1, in: IN('intro:1 verse:0 chorus:1 solo:1 outro:1'),
        p: { chords: { intro: '0:3 3:3 6:2 8:8', chorus: '0:2 6:2 8:6', solo: '0:2. 6:2 12:2 14:2', outro: '0:3 3:3 6:2 8:8' } } }),
      T('strings', 'Strings', 'harmony', 'String Ensemble', { alt: 'pad', on: false, play: 'pad', plays: ['pad', 'chords'], fx: 'Hall', vol: 0.44, in: IN('intro:1 verse:1 chorus:1 solo:1 outro:1') }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Clean', { alt: 'lead', fx: 'Lead Clean (Delay)', vol: 0.82, pan: 0, lead: true, in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true } })
    ],
    vocal: { gender: 'male', range: [55, 72], voices: 0, choir: ['oohs'], scoop: 0.4, melisma: 0.3, lift: 3, blue: true, aab: true,
      reg: { verse: 0.55, chorus: 0.68, outro: 0.6 },
      cells: {
        verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 1:1 2:2 4:2 6:4 | 0:4 4:2 6:2 | 2:2 4:2 6:2 8:2 10:2'),
        chorus: CE('0:4 4:4 8:8 | 0:2 2:2 4:4 8:4'),
        bridge: CE('0:8 8:8')
      } },
    leadPlan: { intro: 'solo', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['bbking'], scales: { all: { major: 'Major Blues', minor: 'Blues' }, solo: { major: 'Major Blues', minor: 'Blues' }, always: true } },
    types: {
      shuffle: { n: 'Big-band shuffle — horns, piano, call and response', w: 3,
        d: 'A swinging 12-bar shuffle: walking bass, piano on the backbeat, the horns riffing behind the choruses; the singer shouts a line and the guitar answers it; two solos.' },
      slow: { n: 'Slow minor blues — strings, long notes', w: 3,
        d: 'A slow blues in a minor key with strings and organ: the guitar opens with a few crying notes, the singer tells the story, and the solo says more with five notes than most do with fifty.',
        set: { tempo: [58, 88, 74], swing: 0.5, minor: 0.75, key: { major: 'G', minor: 'B' }, keys: { major: ['G', 'C', 'A'], minor: ['B', 'D', 'A', 'G', 'C'] } },
        tracks: {
          strings: { on: true }, brass: { on: false }, sax: { on: false },
          drums: { vol: 0.72, pat: {
            intro: { kick: 'X.......X.......', snare: '....o.......o...', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.x.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '............X.XX', tom1: '................', tom2: '..............X.', kick: 'X.......X.......' } } },
          bass: { play: 'style', p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:6 6:R:2 8:5:4 12:b7:2 14:5:2', solo: '0:R:6 6:R:2 8:5:4 12:b7:2 14:5:2', outro: '0:R:16' } } },
          piano: { p: { chords: { intro: '0:8 8:8', verse: '0:8 8:4 12:4', solo: '0:4 4:4 8:4 12:4', outro: '0:16' } }, vol: 0.44 },
          rhythm: { riffs: { intro: ['0:T:16r'], verse: ['4:T:2. 12:T:2.', '0:T:8r 8:T:8r'], solo: ['4:T:2. 12:T:2.'], outro: ['0:T:16r'] } } } },
      funky: { n: 'Soul-blues — straight groove, horn stabs', w: 2,
        d: 'Straight 8ths with a soul feel: a syncopated bass line, clipped guitar chords on the off-beats, horn stabs, verses and choruses with a hook, and the guitar singing between them.',
        set: { tempo: [92, 120, 106], swing: 0, minor: 0.4,
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:12 Verse:8 Chorus:8 Outro Solo:8',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:12 Solo:12 Verse:8 Chorus:8 Outro Solo:8' },
          vocal: { gender: 'male', range: [55, 72], voices: 2, choir: ['oohs', 'hook'], scoop: 0.35, melisma: 0.25, lift: 3, blue: true,
            reg: { verse: 0.5, chorus: 0.68, bridge: 0.55, outro: 0.6 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 10:2 12:2 14:2 | 4:2 6:2 8:2 10:2 12:4 | 0:3 3:3 6:4'), chorus: CE('0:4 4:4 8:8 | 0:3 3:3 6:2 8:8 | 2:2 4:2 6:4'), bridge: CE('0:8 8:8') } } },
        tracks: {
          drums: { pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X.XX', hhc: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X..x..x.X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            chorus: { kick: 'X..x..x.X.x.....', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
            solo: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            fill: { snare: '........X..X.XX.', tom1: '................', tom2: '...............X', kick: 'X.......X.......' } } },
          bass: { play: 'style', p: { style: { intro: '0:R:3 3:R:3 6:5:2 8:R:8', verse: '0:R:3 3:R:3 6:5:2 8:b7:2 10:R:2 14:5:2', chorus: '0:R:4 4:R:2 6:5:2 8:R:4 12:b7:2 14:A:2', solo: '0:R:3 3:R:3 6:5:2 8:b7:2 10:R:2 14:5:2' } } },
          piano: { p: { chords: { intro: '0:8 8:8', verse: '4:2 10:2 12:2', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', solo: '4:2 10:2 12:2', outro: '0:8 8:8' } } },
          brass: { p: { chords: { intro: '0:3 3:3 6:2 8:8', verse: '6:2. 14:2.', chorus: '0:3 3:3 6:2 12:2 14:2', solo: '0:2. 6:2. 14:2.', outro: '0:3 3:3 6:2 8:8' } } } } }
    }
  });

  /* ========================================================= ALBERT KING == */
  /* Library: 2 songs only — the profile follows what the style is known for (the Memphis soul-blues records): a funky
   * straight-8th groove with a bass riff, organ, piano and a horn section (both library songs have piano and
   * brass); an overdriven guitar played in few positions with huge bends (a tone and a half, two tones); A major /
   * C# minor; 90–124 BPM. */
  band('Albert King', {
    band: 'albertking',
    desc: 'Memphis soul-blues: the bass and the guitar lock on a funky minor-pentatonic riff, a dry tight drummer, organ and a punchy horn section. A deep, relaxed singer — and a stinging lead guitar that says everything with a handful of notes bent a tone and a half or more, pulled down hard and left to cry.',
    tempo: [92, 122, 106], swing: 0, grid: 8, key: { major: 'A', minor: 'C#' }, mode: 'minor',
    keys: { major: ['A', 'G', 'C', 'Bb', 'E'], minor: ['C#', 'B', 'A', 'G', 'D'] }, minor: 0.5,
    structures: {
      Short: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Outro:4',
      Standard: 'Intro:4 Verse:12 Verse:12 Solo:12 Verse:12 Solo:12 Outro:4',
      Extended: 'Intro:8 Verse:12 Verse:12 Solo:12 Solo:12 Verse:12 Verse:12 Solo:12 Outro:4'
    },
    progs: [
      P('Riff blues: I–I–I–I · IV–IV–I–I · V–IV–I–I', 'major', 'verse solo', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 I7'), P('12-bar (quick change)', 'major', 'verse solo', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7'),
      P('Riff vamp', 'major', 'intro outro', 'I7 I7 I7 I7'),
      P('Minor riff blues: i–i–i–i · iv–iv–i–i · bVI–V–i–i', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 i7'), P('Minor blues (v–iv)', 'minor', 'verse solo', 'i7 i7 i7 i7 iv7 iv7 i7 i7 v7 iv7 i7 i7'),
      P('Minor riff vamp', 'minor', 'intro outro', 'i7 i7 i7 i7'),
      P('Soul verse I–IV', 'major', 'verse', 'I7 IV7 I7 IV7', 'soul'), P('Soul chorus: IV–IV–I–I · V–IV', 'major', 'chorus', 'IV7 IV7 I7 I7 V7 IV7 I7 I7', 'soul'),
      P('Soul minor verse i–iv', 'minor', 'verse', 'i7 iv7 i7 iv7', 'soul'), P('Soul minor chorus: iv–iv–i–i · bVI–V', 'minor', 'chorus', 'iv7 iv7 i7 i7 bVI7 V7 i7 i7', 'soul')
    ],
    tracks: [
      T('drums', 'Drums', 'drums', 'Acoustic Kit', { kit: 'set', vol: 0.84, pat: {
        intro: { kick: 'X..x..x.X.......', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        verse: { kick: 'X..x..x.X.x.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
        chorus: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', hho: 'x...x...x...x...', hhc: '..x...x...x...x.' },
        solo: { kick: 'X..x..x.X.x...x.', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
        fill: { snare: '........X..X.XX.', tom1: '................', tom2: '...............X', kick: 'X.......X.......' } } }),
      // the bass riff IS the song: root – octave – b7 – 5th, the same shape on every chord
      T('bass', 'Bass', 'bass', 'Electric Bass - Finger', { play: 'style', plays: ['style', 'roots', 'walking'], fx: 'Dry', vol: 0.92, p: { style: {
        intro: '0:R:2 3:R:1 4:8:2 6:b7:2 8:5:2 10:b7:2 12:R:4', verse: '0:R:2 3:R:1 4:8:2 6:b7:2 8:5:2 10:b7:2 12:R:4',
        chorus: '0:R:2 2:R:2 4:8:2 6:b7:2 8:5:2 10:b7:2 12:R:2 14:A:2', solo: '0:R:2 3:R:1 4:8:2 6:b7:2 8:5:2 10:b7:2 12:R:4' } } }),
      T('rhythm', 'Rhythm Guitar', 'strum', 'Electric Guitar - Clean', { alt: 'guitar', play: 'bandriff', plays: ['bandriff', 'stabs', 'funkline', 'texas'], fx: 'Funk (Comp + Clean)', vol: 0.48, pan: -0.4,
        riffs: {
          intro: ['0:0:2 3:0:1 4:12:2 6:10:2 8:7:2 10:10:2 12:0:4', '4:T:2. 12:T:2.'],
          verse: ['0:0:2 3:0:1 4:12:2 6:10:2 8:7:2 10:10:2 12:0:4', '4:T:2. 12:T:2.', '4:T:1. 5:T:1x 10:T:1. 12:T:2.', '2:T:2. 6:T:2. 10:T:2. 14:T:2.'],
          chorus: ['4:T:2. 12:T:2.', '0:0:2 3:0:1 4:12:2 6:10:2 8:7:2 10:10:2 12:0:4'],
          solo: ['4:T:2. 12:T:2.', '4:T:1. 5:T:1x 10:T:1. 12:T:2.', '0:0:2 3:0:1 4:12:2 6:10:2 8:7:2 10:10:2 12:0:4']
        } }),
      T('organ', 'Organ', 'harmony', 'Organ', { alt: 'keys', play: 'pad', plays: ['pad', 'chords'], fx: 'Room', vol: 0.4, pan: 0.3 }),
      T('piano', 'Piano', 'harmony', 'Upright Piano', { alt: 'keys', play: 'chords', plays: ['chords', 'pad'], fx: 'Room', vol: 0.42, pan: -0.15, in: IN('intro:0 verse:1 chorus:1 solo:1 outro:1'),
        p: { chords: { verse: '4:2 10:2 12:2', chorus: '0:3 3:3 6:2 8:3 11:3 14:2', solo: '4:2 10:2 12:2', outro: '0:8 8:8' } } }),
      T('brass', 'Horn Section', 'harmony', 'Trumpet', { alt: 'horn', play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.48, pan: 0.15, in: IN('intro:1 verse:.5 chorus:1 solo:1 outro:1'),
        p: { chords: { intro: '0:3 3:3 6:2 12:2. 14:2.', verse: '6:2. 14:2.', chorus: '0:3 3:3 6:2 12:2 14:2', solo: '0:2. 6:2. 14:2.', outro: '0:3 3:3 6:2 8:8' } } }),
      T('sax', 'Tenor Sax', 'harmony', 'Tenor Sax', { alt: 'horn', play: 'chords', plays: ['chords', 'pad'], fx: 'Brass Room', vol: 0.4, pan: -0.05, in: IN('intro:1 verse:0 chorus:1 solo:1 outro:1'),
        p: { chords: { intro: '0:3 3:3 6:2 12:2. 14:2.', chorus: '0:3 3:3 6:2 12:2 14:2', solo: '0:2. 6:2. 14:2.', outro: '0:3 3:3 6:2 8:8' } } }),
      T('lead', 'Lead Guitar', 'melody', 'Electric Guitar - Lead', { alt: 'lead', fx: 'Blues Overdrive (BD-2)', vol: 0.82, pan: 0.05, lead: true, in: IN('intro:1 verse:.5 chorus:.5 solo:1 outro:1'),
        mel: { bends: true, vibrato: true, slides: true } })
    ],
    vocal: { gender: 'male', range: [48, 66], voices: 0, choir: ['oohs'], scoop: 0.4, melisma: 0.15, lift: 2, blue: true, aab: true,
      reg: { verse: 0.5, chorus: 0.62, outro: 0.55 },
      cells: {
        verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 | 0:4 4:2 6:2 | 2:2 4:2 6:4 | 1:1 2:2 4:2 6:4'),
        chorus: CE('0:4 4:4 8:8 | 0:2 2:2 4:4 8:4'),
        bridge: CE('0:8 8:8')
      } },
    leadPlan: { intro: 'solo', verse: 'fills', chorus: 'fills', outro: 'solo' },
    melody: { licks: 'blues', heroes: ['albert'], scales: { all: { major: 'Blues', minor: 'Blues' }, solo: 'Blues', always: true } },
    types: {
      funk: { n: 'Riff blues — funky bass riff, horns', w: 3,
        d: 'A 12-bar blues in straight time: bass and rhythm guitar play the same riff on every chord, the horns punch the gaps, and the lead guitar answers the singer with enormous bends.' },
      soul: { n: 'Soul-blues song — verse and chorus with a hook', w: 2,
        d: 'The same band on a soul song: 8-bar verses, a chorus with backing singers and horn lines, organ throughout, and guitar fills instead of a long solo.',
        set: { tempo: [84, 112, 98],
          structures: {
            Short: 'Intro:4 Verse:8 Chorus:8 Solo:8 Chorus:8 Outro:4',
            Standard: 'Intro:4 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:12 Verse:8 Chorus:8 Outro Solo:8',
            Extended: 'Intro:8 Verse:8 Verse:8 Chorus:8 Verse:8 Chorus:8 Solo:12 Solo:12 Verse:8 Chorus:8 Outro Solo:8' },
          vocal: { gender: 'male', range: [48, 66], voices: 2, choir: ['oohs', 'hook'], scoop: 0.35, melisma: 0.2, lift: 3, blue: true,
            reg: { verse: 0.45, chorus: 0.65, bridge: 0.55, outro: 0.55 },
            cells: { verse: CE('2:2 4:2 6:2 8:4 | 0:2 2:2 4:4 10:2 12:2 14:2 | 4:2 6:2 8:2 10:2 12:4'), chorus: CE('0:4 4:4 8:8 | 0:3 3:3 6:2 8:8 | 2:2 4:2 6:4'), bridge: CE('0:8 8:8') } } } },
      slow: { n: 'Slow blues — organ, crying bends', w: 2,
        d: 'A slow 12/8 blues: organ and piano, long bass notes, the horns holding soft chords; the guitar bends one note up a tone and a half and holds it over the bar line.',
        set: { tempo: [56, 80, 68], swing: 0.66, minor: 0.6 },
        tracks: {
          drums: { vol: 0.76, pat: {
            intro: { kick: 'X.......X.......', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.' },
            verse: { kick: 'X.......X.....x.', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' },
            solo: { kick: 'X.....x.X.....x.', snare: '....X.......X...', ride: 'X.x.X.x.X.x.X.x.' },
            fill: { snare: '........X.X.X.XX', tom1: '................', tom2: '..............XX', kick: 'X.......X.......' } } },
          bass: { p: { style: { intro: '0:R:8 8:5:8', verse: '0:R:6 6:R:2 8:5:4 12:6:2 14:5:2', solo: '0:R:4 4:3:4 8:5:4 12:6:2 14:5:2' } } },
          rhythm: { fx: 'Jazz Clean', riffs: { intro: ['0:T:16r'], verse: ['4:T:2. 6:T:2 12:T:2. 14:T:2', '0:T:6r 6:T:2 8:T:6r 14:T:2'], solo: ['4:T:2. 6:T:2 12:T:2. 14:T:2'] } },
          piano: { p: { chords: { verse: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', solo: '0:2 2:2 4:2 6:2 8:2 10:2 12:2 14:2', outro: '0:8 8:8' } }, vol: 0.38 },
          brass: { p: { chords: { intro: '0:16', verse: '0:16', solo: '0:8 8:8', outro: '0:16' } }, vol: 0.4 }, sax: { p: { chords: { intro: '0:16', solo: '0:8 8:8', outro: '0:16' } }, vol: 0.36 } } }
    }
  });

})(window.SDAW);
