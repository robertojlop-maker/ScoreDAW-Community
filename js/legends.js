/* =============================================================================
 *  LEGENDS.JS — "Guitar Legends": the vocabulary of the great guitarists
 *  -----------------------------------------------------------------------------
 *  Lead and rhythm guitar parts are not built from random scale notes: they
 *  are built from the GESTURES that guitarists really play, combined the way
 *  each player combines them. Nothing here quotes a recorded solo or riff —
 *  every phrase is generated from the player's scales, techniques and habits
 *  ("in the style of"), over the chords of YOUR song.
 *
 *  LEAD  (SDAW.legends.leadSection — called by autogen.js for guitar melodies)
 *    hero      one HEROES entry: scales (melodic + fast-run scale, major / minor
 *              key), vibrato type, how much he bends / slides / plays legato,
 *              and BAR TEMPLATES: lists of [gesture, length in 16ths, options]
 *                sig   signature bars (the things that make him recognisable)
 *                peak  climax bars of a solo
 *                fill  half-bar fills (answers between the lines of a singer)
 *    gestures  mel     singable motif (chord tones on long notes, repeated in
 *                      sequence over the next chord)
 *              hold    one long note: bent into, slid into, vibrato / wide
 *                      vibrato, pinch harmonic, whammy dive, natural harmonic
 *              run     scale run, straight or in groups of 3 / 4 (sequences),
 *                      16ths or sextuplets by tempo, picked or legato
 *              pedal   neoclassical pedal point (melody against a fixed note)
 *              sweep   swept arpeggio of the chord (dim7 on dominant chords)
 *              tap     two-hand tapping: tap – pull – pull on one string
 *              uni     unison bend (G string bent to the note on the B string)
 *              ds      double stops: hendrix (hammer-ons inside chord shapes),
 *                      sixths / thirds, steel (country bend), stabs
 *              trill · chick (chicken picking) · oct (octaves / whammy toggle)
 *              stut (kill-switch stutter) · trem (tremolo picking) · harm
 *              rake · arp · motif (Latin rock repeated cell) · lick (authored
 *              blues phrases of the player, written in semitones from the tonic)
 *    plan      solo      line 1 opens melodic → signatures → climax → landing
 *              theme     verse / chorus: a tune (motif A, A', B) + a short fill
 *              fills     with a singer: only the 2nd half of every other bar
 *    The scale follows the chords: a chord tone that is not in the scale
 *    replaces its neighbour (natural minor → harmonic minor over the V chord).
 *
 *  RHYTHM  (SDAW.legends.rhythmBar — called by songgen.js for the plays below)
 *    pedal     palm-muted pedal tone + power-chord accents (Rhoads, Wylde)
 *    gallop    metal gallop
 *    octriff   low single-note riff with octave accents (Morello)
 *    vh        triads moving over a palm-muted pedal (Van Halen)
 *    arpriff   picked arpeggio riff with ringing open colours (Slash)
 *    hendrix   chord + double-stop hammer-on fills, 7#9 on dominant chords
 *    texas     Texas shuffle: boogie bass line + muted up-stroke (S. R. Vaughan)
 *    delta     thumb bass + shuffle, turnaround in the last bar (Robert Johnson)
 *    joepass   walking bass + shell chords on one guitar (Joe Pass)
 *    funkline  muted 16ths, single-note pops and 9th-chord stabs
 *
 *  Ticks: 16 = one bar. Bends are in semitones (2 = whole tone); the written
 *  pitch of a bent note is the FRETTED note (the bend raises it).
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const BAR = 16, T3 = 4 / 3, S6 = 2 / 3;
  const L = {};
  SDAW.legends = L;
  const U = () => SDAW.autogen.util;
  const mod12 = n => ((n % 12) + 12) % 12;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TUN = () => CONFIG.guitar.tuning;
  const FRETS = () => CONFIG.guitar.frets || 22;

  /* ============================================================ SCALES == */
  const SC = {
    minPent: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], majPent: [0, 2, 4, 7, 9], majBlues: [0, 2, 3, 4, 7, 9],
    minPent6: [0, 3, 5, 7, 9, 10], mixoBlues: [0, 2, 3, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harmMin: [0, 2, 3, 5, 7, 8, 11], ionian: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11]
  };

  /* ============================================================ HEROES == */
  // bar templates: [gesture, length, options]; the lengths of one template add up to 16 (fill: 8)
  const H = (name, tag, o) => Object.assign({ name, tag, vib: 'vib', bend: 0.35, slide: 0.25, legato: 0.3, fit: true }, o);
  const HEROES = {
    slash: H('Slash', 'melodic hard rock: singing bends, unison bends, pentatonic sequences, sixths', {
      scale: { minor: 'aeolian', major: 'mixo' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.6, slide: 0.4, legato: 0.45,
      sig: [[['hold', 6, { bend: 1 }], ['run', 10, { g: 4, dir: -1 }]], [['uni', 8, {}], ['run', 8, { g: 3, dir: -1 }]], [['ds', 8, { kind: 'sixths' }], ['hold', 8, { bend: 1 }]],
        [['mel', 16, { fast: 1 }]], [['run', 8, { dir: 1 }], ['hold', 8, { bend: 1, high: 1 }]]],
      peak: [[['uni', 6, {}], ['run', 10, { g: 4, dir: 1, fast: 1 }]], [['hold', 8, { bend: 1, high: 1 }], ['run', 8, { g: 3, dir: -1, fast: 1 }]]],
      fill: [[['run', 4, { dir: -1 }], ['hold', 4, { bend: 1 }]], [['hold', 8, { bend: 1 }]]] }),
    vanhalen: H('Eddie Van Halen', 'two-hand tapping, legato flurries, tremolo picking, harmonics and dive bombs', {
      scale: { minor: 'blues', major: 'mixoBlues' }, legato: 0.8, bend: 0.4,
      sig: [[['tap', 16, {}]], [['tap', 8, {}], ['run', 8, { dir: -1, fast: 1, leg: 1 }]], [['trem', 4, {}], ['run', 8, { dir: 1, fast: 1, leg: 1 }], ['hold', 4, { dive: 1 }]],
        [['harm', 4, {}], ['run', 12, { g: 3, dir: -1, leg: 1 }]], [['hold', 6, { bend: 1 }], ['tap', 10, { walk: 1 }]]],
      peak: [[['tap', 12, { walk: 1 }], ['hold', 4, { dive: 1 }]], [['run', 12, { dir: 1, fast: 1, leg: 1 }], ['hold', 4, { high: 1, pinch: 1 }]]],
      fill: [[['tap', 8, {}]], [['run', 4, { dir: 1, leg: 1 }], ['hold', 4, { dive: 1 }]]] }),
    satriani: H('Joe Satriani', 'Lydian / Mixolydian melodies, liquid legato, whammy bar, harmonics', {
      scale: { minor: 'dorian', major: 'lydian' }, legato: 0.9, slide: 0.5, vib: 'wvib',
      sig: [[['run', 16, { dir: 1, leg: 1, scale: 1, fast: 1 }]], [['mel', 8, {}], ['run', 8, { dir: -1, leg: 1, scale: 1, fast: 1 }]], [['hold', 8, { si: 1 }], ['hold', 8, { dive: 1, high: 1 }]],
        [['tap', 8, { walk: 1 }], ['run', 8, { dir: -1, leg: 1, scale: 1 }]], [['harm', 4, {}], ['mel', 12, {}]]],
      peak: [[['run', 12, { dir: 1, leg: 1, scale: 1, fast: 1 }], ['hold', 4, { high: 1 }]], [['hold', 12, { high: 1, bend: 1 }], ['hold', 4, { dive: 1 }]]],
      fill: [[['run', 4, { dir: 1, leg: 1, scale: 1 }], ['hold', 4, { si: 1 }]], [['mel', 8, {}]]] }),
    malmsteen: H('Yngwie Malmsteen', 'neoclassical: harmonic minor, pedal points, swept arpeggios, diminished runs, wide vibrato', {
      scale: { minor: 'harmMin', major: 'ionian' }, vib: 'wvib', legato: 0.25, bend: 0.25,
      sig: [[['pedal', 16, {}]], [['sweep', 8, {}], ['run', 8, { dir: -1, scale: 1, fast: 1 }]], [['run', 16, { g: 4, dir: -1, scale: 1, fast: 1 }]], [['sweep', 16, { dim: 1 }]],
        [['hold', 6, {}], ['run', 10, { g: 3, dir: 1, scale: 1 }]], [['pedal', 8, { below: 1 }], ['sweep', 8, { dim: 1 }]]],
      peak: [[['sweep', 8, {}], ['trill', 4, {}], ['hold', 4, { high: 1 }]], [['run', 16, { dir: 1, scale: 1, fast: 1 }]]],
      fill: [[['sweep', 4, {}], ['hold', 4, {}]], [['pedal', 8, {}]]] }),
    rhoads: H('Randy Rhoads', 'classical-flavoured metal: trills, pedal tones, minor scale sequences, tapping', {
      scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'blues', major: 'majBlues' }, vib: 'wvib', legato: 0.5,
      sig: [[['trill', 4, {}], ['run', 12, { g: 4, dir: -1, scale: 1 }]], [['pedal', 16, {}]], [['run', 8, { g: 3, dir: -1 }], ['hold', 8, { bend: 1 }]], [['tap', 8, {}], ['run', 8, { dir: -1, scale: 1, leg: 1 }]],
        [['mel', 16, { fast: 1 }]], [['sweep', 8, { dim: 1 }], ['hold', 8, {}]]],
      peak: [[['run', 8, { dir: 1, scale: 1, fast: 1 }], ['trill', 4, {}], ['hold', 4, { high: 1 }]], [['tap', 8, { walk: 1 }], ['hold', 8, { pinch: 1, bend: 1 }]]],
      fill: [[['trill', 4, {}], ['hold', 4, {}]], [['run', 8, { g: 3, dir: -1 }]]] }),
    zakk: H('Zakk Wylde', 'screaming pinch harmonics, wide vibrato, machine-gun pentatonics, chicken picking', {
      scale: { minor: 'minPent', major: 'mixoBlues' }, vib: 'wvib', bend: 0.6, legato: 0.15,
      sig: [[['hold', 8, { pinch: 1, bend: 1 }], ['run', 8, { g: 4, dir: -1, fast: 1 }]], [['run', 16, { g: 3, dir: -1, fast: 1 }]], [['chick', 8, {}], ['hold', 8, { pinch: 1, bend: 1 }]],
        [['run', 16, { g: 4, dir: 1 }]], [['hold', 6, { bend: 1 }], ['run', 10, { g: 3, dir: -1 }]]],
      peak: [[['hold', 6, { pinch: 1, bend: 1, high: 1 }], ['run', 10, { g: 4, dir: -1, fast: 1 }]], [['uni', 8, {}], ['hold', 8, { pinch: 1, high: 1 }]]],
      fill: [[['hold', 8, { pinch: 1, bend: 1 }]], [['run', 8, { g: 3, dir: -1 }]]] }),
    hendrix: H('Jimi Hendrix', 'double-stop hammer-ons, unison bends, octaves, tremolo-bar dives, blues scale with fire', {
      scale: { minor: 'blues', major: 'mixoBlues' }, vib: 'wvib', bend: 0.55, slide: 0.4,
      sig: [[['ds', 16, { kind: 'hendrix' }]], [['uni', 8, {}], ['run', 8, { dir: -1 }]], [['hold', 6, { bend: 1 }], ['ds', 10, { kind: 'hendrix' }]], [['oct', 16, {}]],
        [['trem', 4, {}], ['mel', 8, {}], ['hold', 4, { dive: 1 }]], [['rake', 4, {}], ['run', 12, { g: 3, dir: -1 }]]],
      peak: [[['uni', 8, {}], ['trill', 4, {}], ['hold', 4, { dive: 1 }]], [['run', 8, { dir: 1 }], ['hold', 8, { bend: 1, high: 1 }]]],
      fill: [[['ds', 8, { kind: 'hendrix' }]], [['hold', 8, { bend: 1 }]]] }),
    moore: H('Gary Moore', 'blues-rock ballad tone: long singing bends, endless sustain, sudden fast flurries', {
      scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, vib: 'wvib', bend: 0.75,
      sig: [[['hold', 12, { bend: 1 }], ['run', 4, { dir: -1, fast: 1 }]], [['mel', 16, { slow: 1 }]], [['run', 8, { g: 4, dir: 1, fast: 1 }], ['hold', 8, { bend: 1, high: 1 }]], [['hold', 16, { bend: 1, high: 1 }]],
        [['hold', 8, { bend: 1, rel: 1 }], ['mel', 8, {}]]],
      peak: [[['run', 8, { dir: 1, fast: 1 }], ['hold', 8, { high: 1, bend: 1 }]], [['hold', 16, { high: 1, bend: 1, rel: 1 }]]],
      fill: [[['hold', 8, { bend: 1 }]], [['run', 4, { dir: 1 }], ['hold', 4, { bend: 1 }]]] }),
    santana: H('Carlos Santana', 'Latin rock: Dorian melodies, a short motif repeated over the rhythm, long sustained notes', {
      scale: { minor: 'dorian', major: 'ionian' }, run: { minor: 'minPent6', major: 'majPent' }, vib: 'wvib', bend: 0.45, slide: 0.45,
      sig: [[['motif', 16, {}]], [['hold', 16, { si: 1 }]], [['mel', 8, {}], ['hold', 8, { bend: 1 }]], [['run', 8, { g: 3, dir: -1 }], ['hold', 8, {}]], [['trill', 4, {}], ['mel', 12, {}]]],
      peak: [[['hold', 16, { high: 1, bend: 1 }]], [['motif', 8, {}], ['run', 8, { dir: 1 }]]],
      fill: [[['motif', 8, {}]], [['hold', 8, { si: 1 }]]] }),
    harrison: H('George Harrison', 'melodies that sing the chords: slides, double stops in thirds and sixths, arpeggios', {
      scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.2, slide: 0.7, legato: 0.3,
      sig: [[['mel', 16, { si: 1 }]], [['ds', 8, { kind: 'thirds' }], ['hold', 8, { si: 1 }]], [['arp', 16, {}]], [['hold', 8, { si: 1 }], ['mel', 8, {}]], [['ds', 16, { kind: 'sixths', dir: 1 }]]],
      peak: [[['ds', 16, { kind: 'sixths' }]], [['mel', 8, {}], ['hold', 8, { si: 1, high: 1 }]]],
      fill: [[['ds', 8, { kind: 'thirds' }]], [['hold', 8, { si: 1 }]]] }),
    morello: H('Tom Morello', 'riffs as solos: kill-switch stutters, whammy octave jumps, harmonics, noise', {
      scale: { minor: 'blues', major: 'mixoBlues' }, bend: 0.3, legato: 0.2,
      sig: [[['stut', 16, {}]], [['oct', 16, { toggle: 1 }]], [['harm', 8, {}], ['stut', 8, {}]], [['run', 8, { g: 4, dir: -1 }], ['hold', 8, { dive: 1 }]], [['trem', 8, {}], ['stut', 8, {}]]],
      peak: [[['trem', 8, { high: 1 }], ['hold', 8, { dive: 1 }]], [['oct', 8, { toggle: 1 }], ['stut', 8, {}]]],
      fill: [[['stut', 8, {}]], [['oct', 8, { toggle: 1 }]]] }),
    bbking: H('B.B. King', 'few notes, each one sung: the "B.B. box", butterfly vibrato, sweet major 6ths and 9ths', {
      scale: { minor: 'minPent', major: 'mixoBlues' }, vib: 'wvib', bend: 0.5, fit: false, sparse: 1,
      sig: [[['lick', 16, {}]], [['lick', 16, {}]], [['rest', 4], ['lick', 12, {}]], [['mel', 8, {}], ['hold', 8, { bend: 1, small: 1 }]], [['hold', 6, {}], ['lick', 10, {}]]],
      peak: [[['hold', 12, { high: 1 }], ['mel', 4, {}]], [['lick', 16, {}]]],
      fill: [[['hold', 8, { bend: 1, small: 1 }]], [['mel', 8, {}]]],
      licks: [
        [[0, 1, -3], [1, 1, 0, 'h'], [2, 6, 0, 'w'], [10, 2, 2], [12, 2, 3, 'b1'], [14, 2, 0]],
        [[2, 2, 5, 'b2'], [4, 2, 5, 'b2'], [6, 2, 3, 'c'], [8, 8, 0, 'w']],
        [[0, T3, 7, 't'], [T3, T3, 5, 't'], [2 * T3, T3, 3, 't'], [4, 4, 0, 'w'], [10, 2, 2], [12, 4, 3, 'b1']],
        [[4, 2, 0, 'si'], [6, 2, 2], [8, 4, 3, 'b1'], [12, 2, 2], [14, 2, 0]],
        [[0, 4, 12, 'w'], [6, 2, 10], [8, 2, 7], [10, 6, 5, 'b2w']],
        [[0, 2, 9], [2, 2, 12], [4, 6, 12, 'w'], [12, 2, 9], [14, 2, 7]]
      ] }),
    albert: H('Albert King', 'huge string bends (a tone and a half, two tones), raw minor pentatonic, space', {
      scale: { minor: 'minPent', major: 'minPent' }, vib: 'wvib', bend: 0.9, fit: false, sparse: 1,
      sig: [[['lick', 16, {}]], [['lick', 16, {}]], [['hold', 10, { bend: 1, wide: 1 }], ['mel', 6, {}]], [['rest', 2], ['lick', 14, {}]], [['hold', 8, { bend: 1, wide: 1, rel: 1 }], ['mel', 8, {}]]],
      peak: [[['hold', 12, { bend: 1, wide: 1, high: 1 }], ['mel', 4, {}]], [['lick', 16, {}]]],
      fill: [[['hold', 8, { bend: 1, wide: 1 }]], [['mel', 4, {}], ['hold', 4, { bend: 1 }]]],
      licks: [
        [[0, 6, 10, 'b2w'], [6, 2, 7], [8, 4, 7, 'b3'], [12, 4, 3, 'c']],
        [[2, 2, 7], [4, 8, 10, 'b4r'], [12, 4, 7]],
        [[0, 2, 5, 'b2'], [2, 2, 5, 'b2'], [4, 4, 5, 'b3w'], [8, 2, 3], [10, 6, 0, 'w']],
        [[0, 6, 17, 'b2w'], [6, 2, 15], [8, 2, 12], [10, 6, 10, 'b2r']],
        [[4, 4, 10, 'b2'], [8, 2, 10, 'pb'], [10, 2, 7], [12, 4, 5, 'b2w']]
      ] }),
    srv: H('Stevie Ray Vaughan', 'Texas blues: heavy attack, rakes, triplet flurries, double-stop stabs', {
      scale: { minor: 'blues', major: 'mixoBlues' }, vib: 'wvib', bend: 0.6, fit: false, legato: 0.35,
      sig: [[['lick', 16, {}]], [['lick', 16, {}]], [['rake', 4, {}], ['run', 12, { t8: 1, dir: -1 }]], [['ds', 8, { kind: 'stabs' }], ['run', 8, { dir: -1 }]], [['trem', 4, {}], ['hold', 6, { bend: 1 }], ['run', 6, { dir: -1 }]],
        [['run', 8, { t8: 1, dir: 1 }], ['hold', 8, { bend: 1 }]]],
      peak: [[['ds', 8, { kind: 'stabs', high: 1 }], ['hold', 8, { bend: 1, high: 1 }]], [['run', 16, { t8: 1, dir: -1, g: 3 }]]],
      fill: [[['rake', 4, {}], ['hold', 4, { bend: 1 }]], [['run', 8, { t8: 1, dir: -1 }]]],
      licks: [
        [[0, T3, 12, 't'], [T3, T3, 10, 't'], [2 * T3, T3, 7, 't'], [4, T3, 10, 't'], [4 + T3, T3, 7, 't'], [4 + 2 * T3, T3, 5, 't'], [8, T3, 7, 't'], [8 + T3, T3, 5, 't'], [8 + 2 * T3, T3, 3, 't'], [12, 4, 0, 'w']],
        [[0, 2, 3, 'c'], [2, 2, 0], [4, 2, -2], [6, 2, 0], [8, 2, 3, 'b1'], [10, 2, 0], [12, 4, -5, 'w']],
        [[0, 2, 7, 'sa', 3], [3, 1, 7, 's', 3], [4, 2, 7, 's', 3], [6, 2, 10, 'b2'], [8, 2, 7], [10, 2, 5, 'p'], [12, 4, 3, 'cw']],
        [[0, 4, 5, 'b2w'], [4, 2, 7], [6, 2, 5, 'p'], [8, 2, 3, 'c'], [10, 2, 0], [12, 2, 3, 'h'], [14, 2, 0]]
      ] }),
    rjohnson: H('Robert Johnson', 'Delta blues: turnarounds in sixths, sliding double stops, treble triplets over a thumb bass', {
      scale: { minor: 'blues', major: 'mixoBlues' }, bend: 0.2, slide: 0.6, fit: false,
      sig: [[['lick', 16, {}]], [['lick', 16, {}]], [['ds', 16, { kind: 'sixths' }]], [['mel', 8, { si: 1 }], ['ds', 8, { kind: 'stabs' }]], [['hold', 6, { si: 1 }], ['run', 10, { t8: 1, dir: -1 }]]],
      peak: [[['ds', 8, { kind: 'stabs', high: 1 }], ['ds', 8, { kind: 'sixths' }]], [['lick', 16, {}]]],
      fill: [[['ds', 8, { kind: 'sixths' }]], [['hold', 8, { si: 1 }]]],
      licks: [
        [[0, 4, 10, '', 2], [4, 4, 9, '', 3], [8, 4, 8, '', 4], [12, 4, 7, 'v', 5]],
        [[0, 2, 12, 'si'], [2, 2, 12], [4, T3, 12, 't'], [4 + T3, T3, 10, 't'], [4 + 2 * T3, T3, 7, 't'], [8, 4, 10, 'b1'], [12, 4, 7, 'v']],
        [[0, 1, 3], [1, 3, 4, 'h'], [4, 2, 7], [6, 2, 9], [8, 2, 10], [10, 2, 9], [12, 4, 7, 'v']],
        [[0, 6, 7, 'siw'], [6, 2, 5], [8, 2, 3, 'c'], [10, 6, 0, 'v']]
      ] }),
    gilmour: H('David Gilmour', 'slow, spacious, perfectly placed bends (also a tone and a half), long releases', {
      scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.85, vib: 'vib', sparse: 1,
      sig: [[['hold', 12, { bend: 1, rel: 1 }], ['rest', 4]], [['mel', 16, { slow: 1 }]], [['hold', 8, { bend: 1, wide: 1 }], ['mel', 8, { slow: 1 }]], [['rest', 4], ['hold', 12, { bend: 1 }]]],
      peak: [[['hold', 16, { bend: 1, wide: 1, high: 1 }]], [['run', 4, { dir: 1 }], ['hold', 12, { bend: 1, high: 1, rel: 1 }]]],
      fill: [[['hold', 8, { bend: 1 }]], [['mel', 8, { slow: 1 }]]] }),
    clapton: H('Eric Clapton', 'blues-rock phrasing: pentatonic boxes, major/minor mix, smooth bends and vibrato', {
      scale: { minor: 'minPent', major: 'mixoBlues' }, bend: 0.6, fit: false,
      sig: [[['run', 8, { g: 3, dir: -1 }], ['hold', 8, { bend: 1 }]], [['hold', 6, { bend: 1 }], ['run', 6, { dir: -1 }], ['hold', 4, {}]], [['mel', 16, {}]], [['run', 8, { t8: 1, dir: -1 }], ['hold', 8, { bend: 1 }]]],
      peak: [[['hold', 8, { bend: 1, high: 1 }], ['run', 8, { g: 3, dir: -1 }]], [['uni', 8, {}], ['hold', 8, { bend: 1, high: 1 }]]],
      fill: [[['hold', 8, { bend: 1 }]], [['run', 4, { dir: -1 }], ['hold', 4, {}]]] }),
    berry: H('Chuck Berry', 'rock and roll: double-stop licks in 8ths, slides into the chord, repeated bends', {
      scale: { minor: 'blues', major: 'mixoBlues' }, bend: 0.4, slide: 0.6, fit: false,
      sig: [[['ds', 16, { kind: 'stabs', eight: 1 }]], [['ds', 8, { kind: 'stabs', eight: 1 }], ['run', 8, { dir: -1 }]], [['run', 16, { g: 3, dir: -1 }]], [['hold', 4, { bend: 1 }], ['hold', 4, { bend: 1 }], ['ds', 8, { kind: 'stabs', eight: 1 }]]],
      peak: [[['ds', 16, { kind: 'stabs', eight: 1, high: 1 }]], [['run', 8, { dir: 1 }], ['ds', 8, { kind: 'stabs', eight: 1, high: 1 }]]],
      fill: [[['ds', 8, { kind: 'stabs', eight: 1 }]], [['run', 8, { dir: -1 }]]] }),
    knopfler: H('Mark Knopfler', 'clean fingerstyle: triad arpeggios, quick pull-offs, soft singing lines', {
      scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.3, legato: 0.6, slide: 0.35,
      sig: [[['arp', 8, { pull: 1 }], ['hold', 8, {}]], [['mel', 16, {}]], [['run', 8, { g: 3, dir: -1, leg: 1 }], ['hold', 8, { bend: 1 }]], [['arp', 16, { pull: 1 }]]],
      peak: [[['arp', 8, { pull: 1 }], ['hold', 8, { bend: 1, high: 1 }]], [['run', 8, { dir: 1, leg: 1 }], ['hold', 8, { high: 1 }]]],
      fill: [[['arp', 8, { pull: 1 }]], [['hold', 8, { bend: 1 }]]] }),
    chicken: H('Nashville chicken picking', 'country lead: clucked notes, pedal-steel bends in double stops, fast major-pentatonic runs', {
      scale: { minor: 'minPent', major: 'majBlues' }, bend: 0.4, slide: 0.4, legato: 0.3,
      sig: [[['chick', 16, {}]], [['ds', 8, { kind: 'steel' }], ['run', 8, { dir: -1 }]], [['run', 16, { g: 3, dir: -1 }]], [['chick', 8, {}], ['ds', 8, { kind: 'steel' }]], [['ds', 8, { kind: 'thirds' }], ['run', 8, { dir: 1 }]]],
      peak: [[['run', 16, { g: 4, dir: 1, fast: 1 }]], [['ds', 8, { kind: 'steel', high: 1 }], ['chick', 8, {}]]],
      fill: [[['ds', 8, { kind: 'steel' }]], [['chick', 8, {}]]] })
  };
  /* ---- jazz guitarists: chordScale = the line follows the scale of EVERY chord (bebop) ----
   * trad (in styles.js) = the bebop engine of autogen.js. stages (Wes): the solo builds from single
   * lines (line 1) to octaves (line 2) to block chords (line 3+). */
  const J = (name, tag, o) => H(name, tag, Object.assign({ scale: { minor: 'dorian', major: 'ionian' }, chordScale: true, bend: 0.05, slide: 0.2, legato: 0.25, vib: 'vib' }, o));
  Object.assign(HEROES, {
    joepass: J('Joe Pass', 'bebop lines that spell every chord, chromatic enclosures, chord-melody answers', {
      sig: [[['bop', 16, {}]], [['encl', 4, {}], ['bop', 12, {}]], [['bop', 8, {}], ['block', 8, {}]], [['run', 8, { t8: 1, dir: -1, scale: 1 }], ['encl', 8, {}]], [['bop', 12, { fast: 1 }], ['hold', 4, {}]]],
      peak: [[['bop', 16, { fast: 1 }]], [['run', 8, { dir: 1, scale: 1, fast: 1 }], ['block', 8, {}]]],
      fill: [[['encl', 8, {}]], [['block', 8, {}]]] }),
    wes: J('Wes Montgomery', 'thumb-picked lines → octaves → block chords: the solo that builds in three levels', {
      sig: [[['mel', 16, {}]], [['bop', 16, {}]], [['oct', 16, {}]], [['block', 16, {}]]],
      stages: [[[['mel', 16, {}]], [['bop', 16, {}]], [['mel', 8, {}], ['encl', 8, {}]]], [[['oct', 16, {}]], [['oct', 8, {}], ['bop', 8, {}]]], [[['block', 16, {}]], [['block', 8, {}], ['oct', 8, {}]]]],
      peak: [[['block', 16, {}]], [['oct', 8, {}], ['block', 8, {}]]],
      fill: [[['oct', 8, {}]], [['block', 8, {}]]] }),
    benson: J('George Benson', 'fast bebop runs, chromatic flurries, bluesy answers, octaves', {
      bend: 0.15, legato: 0.35,
      sig: [[['bop', 16, { fast: 1 }]], [['run', 16, { fast: 1, scale: 1, dir: -1 }]], [['chrom', 8, {}], ['hold', 8, {}]], [['oct', 16, {}]], [['encl', 4, {}], ['run', 12, { fast: 1, scale: 1, g: 4, dir: 1 }]]],
      peak: [[['run', 16, { fast: 1, scale: 1, dir: 1 }]], [['chrom', 8, {}], ['oct', 8, {}]]],
      fill: [[['chrom', 8, {}]], [['bop', 8, {}]]] }),
    martino: J('Pat Martino', 'endless 8th / 16th-note lines, minor (Dorian) colour over the dominants', {
      legato: 0.15,
      sig: [[['bop', 16, {}]], [['run', 16, { scale: 1, g: 4, dir: -1 }]], [['bop', 8, {}], ['run', 8, { scale: 1, dir: 1 }]], [['run', 8, { scale: 1, g: 3, dir: -1 }], ['bop', 8, {}]]],
      peak: [[['run', 16, { scale: 1, fast: 1, dir: -1 }]], [['bop', 16, { fast: 1 }]]],
      fill: [[['bop', 8, {}]], [['run', 8, { scale: 1, dir: -1 }]]] }),
    django: J('Django Reinhardt', 'gypsy jazz: swept arpeggios, chromatic runs, tremolo, a bend at the end of a phrase', {
      chordScale: false, scale: { minor: 'harmMin', major: 'ionian' }, bend: 0.3, vib: 'wvib',
      sig: [[['sweep', 8, {}], ['chrom', 8, {}]], [['arp', 16, {}]], [['trem', 4, {}], ['run', 12, { t8: 1, dir: -1, scale: 1 }]], [['chrom', 16, {}]], [['sweep', 8, { dim: 1 }], ['hold', 8, { bend: 1 }]]],
      peak: [[['sweep', 8, {}], ['trem', 8, { high: 1 }]], [['run', 16, { fast: 1, scale: 1, dir: 1 }]]],
      fill: [[['chrom', 8, {}]], [['sweep', 4, {}], ['hold', 4, {}]]] }),
    christian: J('Charlie Christian', 'swing: riff-like repeated figures, arpeggios, bluesy 8th-note lines', {
      sig: [[['motif', 16, {}]], [['bop', 16, {}]], [['arp', 8, {}], ['hold', 8, {}]], [['ds', 8, { kind: 'stabs' }], ['bop', 8, {}]]],
      peak: [[['motif', 8, {}], ['bop', 8, {}]], [['bop', 16, { fast: 1 }]]],
      fill: [[['motif', 8, {}]], [['bop', 8, {}]]] })
  });
  /* ---- the double-stop bend licks join the vocabulary of the rock / blues players who use them ---- */
  const addT = (id, key, list) => { if (HEROES[id]) HEROES[id][key] = HEROES[id][key].concat(list); };
  addT('berry', 'sig', [[['dsb', 16, { kind: 'gbe' }]], [['dsb', 8, { kind: 'gbe' }], ['run', 8, { dir: -1 }]]]); addT('berry', 'peak', [[['dsb', 16, { kind: 'gbe' }]]]);
  addT('clapton', 'sig', [[['dsb', 16, { kind: 'be' }]]]); addT('clapton', 'peak', [[['dsb', 12, { kind: 'stack' }], ['hold', 4, { bend: 1, high: 1 }]]]);
  addT('hendrix', 'sig', [[['dsb', 8, { kind: 'oblique' }], ['ds', 8, { kind: 'hendrix' }]]]);
  addT('srv', 'sig', [[['dsb', 16, { kind: 'gbe', trip: 1 }]]]); addT('srv', 'peak', [[['dsb', 16, { kind: 'stack' }]]]);
  addT('slash', 'sig', [[['dsb', 8, { kind: 'be' }], ['run', 8, { g: 4, dir: -1 }]]]);
  addT('moore', 'peak', [[['dsb', 16, { kind: 'be' }]]]);
  addT('zakk', 'sig', [[['dsb', 16, { kind: 'stack', trip: 0 }]]]);
  addT('albert', 'sig', [[['dsb', 16, { kind: 'oblique' }]]]);
  addT('chicken', 'sig', [[['dsb', 8, { kind: 'oblique' }], ['chick', 8, {}]]]);

  /* ---- players learned from the reference library (styledata.js) ----
   * Their bar templates mix the gestures above with two data gestures:
   *   cell  a short idiomatic cell the player repeats in several of his songs, over the same chord degree
   *   dna   a new line built from his statistics: his rhythm cells, how his lines move from each degree,
   *         which degrees he bends, how often he vibratos, slides and plays legato
   */
  Object.assign(HEROES, {
    vai: H('Steve Vai', 'liquid legato, wide slides, tapping, whammy-bar vocal effects and harmonics, exotic melodies', {
      data: 'vai', pool: 'shred', scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'aeolian', major: 'mixo' }, vib: 'wvib', legato: 0.9, slide: 0.6, bend: 0.35,
      sig: [[['dna', 16, {}]], [['cell', 8, {}], ['run', 8, { dir: -1, leg: 1, scale: 1, fast: 1 }]], [['tap', 8, { walk: 1 }], ['hold', 8, { dive: 1, high: 1 }]], [['hold', 8, { si: 1 }], ['dna', 8, {}]],
        [['harm', 4, {}], ['dna', 12, {}]], [['cell', 16, {}]]],
      peak: [[['run', 12, { dir: 1, leg: 1, scale: 1, fast: 1 }], ['hold', 4, { dive: 1 }]], [['tap', 12, { walk: 1 }], ['hold', 4, { high: 1, pinch: 1 }]], [['dna', 8, { fast: 1 }], ['cell', 8, {}]]],
      fill: [[['cell', 8, {}]], [['dna', 8, {}]], [['hold', 8, { dive: 1 }]]] }),
    may: H('Brian May (Queen)', 'singing melodic solos, harmonised guitar lines, smooth bends, legato runs, long sustained notes', {
      data: 'queen', pool: 'rock', scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, vib: 'vib', legato: 0.55, bend: 0.55, slide: 0.25,
      sig: [[['mel', 16, {}]], [['dna', 16, {}]], [['cell', 8, {}], ['hold', 8, { bend: 1 }]], [['ds', 16, { kind: 'thirds' }]], [['run', 8, { g: 3, dir: -1, leg: 1 }], ['hold', 8, { bend: 1 }]], [['cell', 16, {}]]],
      peak: [[['hold', 8, { bend: 1, high: 1 }], ['run', 8, { dir: -1, leg: 1, fast: 1 }]], [['ds', 8, { kind: 'thirds' }], ['hold', 8, { high: 1, bend: 1 }]], [['dna', 16, { fast: 1 }]]],
      fill: [[['cell', 8, {}]], [['hold', 8, { bend: 1 }]], [['dna', 8, {}]]] }),
    sambora: H('Richie Sambora (Bon Jovi)', 'arena hard rock: pentatonic licks, singing bends, harmonics, melodic hooks that answer the singer', {
      data: 'bonjovi', pool: 'rock', scale: { minor: 'aeolian', major: 'mixo' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.6, legato: 0.35, slide: 0.35,
      sig: [[['dna', 16, {}]], [['hold', 6, { bend: 1 }], ['run', 10, { g: 3, dir: -1 }]], [['mel', 16, {}]], [['dna', 8, {}], ['hold', 8, { bend: 1, high: 1 }]], [['harm', 4, {}], ['mel', 12, {}]]],
      peak: [[['hold', 8, { bend: 1, high: 1 }], ['run', 8, { g: 4, dir: -1, fast: 1 }]], [['uni', 8, {}], ['dna', 8, {}]]],
      fill: [[['dna', 8, {}]], [['hold', 8, { bend: 1 }]]] }),
    scholz: H('Tom Scholz (Boston)', 'orchestrated lead lines: melodies doubled in thirds and sixths, ringing notes, clean legato', {
      data: 'boston', pool: 'rock', scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'aeolian', major: 'ionian' }, bend: 0.35, legato: 0.6, slide: 0.2,
      sig: [[['ds', 16, { kind: 'thirds' }]], [['mel', 16, {}]], [['ds', 8, { kind: 'sixths' }], ['hold', 8, { bend: 1 }]], [['dna', 16, {}]], [['arp', 16, {}]]],
      peak: [[['ds', 16, { kind: 'thirds', dir: 1 }]], [['run', 8, { dir: 1, leg: 1, scale: 1 }], ['hold', 8, { high: 1 }]]],
      fill: [[['ds', 8, { kind: 'thirds' }]], [['dna', 8, {}]]] }),
    lizzy: H('Thin Lizzy (twin leads)', 'twin-guitar melodies in harmony (thirds), Celtic-flavoured major lines, triplet runs', {
      data: 'thinlizzy', pool: 'rock', scale: { minor: 'aeolian', major: 'ionian' }, run: { minor: 'minPent', major: 'majPent' }, bend: 0.4, legato: 0.45, vib: 'wvib',
      sig: [[['ds', 16, { kind: 'thirds' }]], [['ds', 8, { kind: 'thirds' }], ['run', 8, { t8: 1, dir: -1 }]], [['mel', 16, {}]], [['dna', 16, {}]], [['run', 8, { t8: 1, dir: 1, scale: 1 }], ['hold', 8, { bend: 1 }]]],
      peak: [[['ds', 16, { kind: 'thirds', dir: 1 }]], [['run', 16, { t8: 1, dir: -1, scale: 1 }]]],
      fill: [[['ds', 8, { kind: 'thirds' }]], [['run', 8, { t8: 1, dir: -1 }]]] }),
    gibbons: H('Billy Gibbons (ZZ Top)', 'Texas boogie: few fat notes, pinch harmonics, wide bends, blues-box licks with space', {
      data: 'zztop', pool: 'blues', scale: { minor: 'minPent', major: 'mixoBlues' }, run: { minor: 'blues', major: 'mixoBlues' }, vib: 'wvib', bend: 0.7, fit: false, sparse: 1,
      sig: [[['hold', 8, { pinch: 1, bend: 1 }], ['dna', 8, {}]], [['dsb', 16, { kind: 'gbe', trip: 1 }]], [['dna', 16, {}]], [['rest', 4], ['hold', 6, { bend: 1 }], ['dna', 6, {}]], [['cell', 16, {}]]],
      peak: [[['hold', 8, { pinch: 1, bend: 1, high: 1 }], ['run', 8, { t8: 1, dir: -1 }]], [['dsb', 16, { kind: 'stack' }]]],
      fill: [[['hold', 8, { pinch: 1, bend: 1 }]], [['dna', 8, {}]]] })
  });
  /* ---- the players already in the library learn from their own songs too ---- */
  const DATA_OF = { slash: ['gnr', 'rock'], vanhalen: ['vanhalen', 'rock'], satriani: ['satriani', 'shred'], malmsteen: ['malmsteen', 'metal'], rhoads: ['ozzy', 'metal'], zakk: ['ozzy', 'metal'],
    harrison: ['beatles', 'rock'], bbking: ['bbking', 'blues'], albert: ['albertking', 'blues'], srv: ['srv', 'blues'], clapton: ['clapton', 'blues'], berry: ['berry', 'blues'],
    santana: ['santana', 'latin'], joepass: ['joepass', 'jazz'] };
  Object.keys(DATA_OF).forEach(id => {
    const h = HEROES[id]; if (!h) return;
    h.data = DATA_OF[id][0]; h.pool = DATA_OF[id][1];
    const jazz = !!h.chordScale;
    addT(id, 'sig', jazz ? [[['dna', 16, {}]], [['dna', 8, {}], ['encl', 8, {}]]] : [[['dna', 16, {}]], [['cell', 8, {}], ['dna', 8, {}]], [['cell', 16, {}]]]);
    addT(id, 'peak', [[['dna', 16, { fast: 1 }]]]);
    addT(id, 'fill', jazz ? [[['dna', 8, {}]]] : [[['cell', 8, {}]], [['dna', 8, {}]]]);
  });
  L.HEROES = HEROES;
  /** [id, label] list for the panels ("Auto" first) */
  L.options = function (style) {
    const pool = (style && style.melody && style.melody.heroes) || [];
    const ids = pool.filter(x => HEROES[x]).concat(Object.keys(HEROES).filter(x => !pool.includes(x)));
    return [['auto', pool.length ? 'Auto — a guitarist of this genre (changes with 🎲)' : 'Auto (none for this genre)'], ['off', 'Off — plain generated melody']]
      .concat(ids.map(id => [id, HEROES[id].name + (pool.includes(id) ? ' ★' : '')]));
  };
  /** the hero used for a generation context (null = the normal melody engine) */
  L.heroFor = function (ctx) {
    const want = (ctx.mel && ctx.mel.hero) || 'auto';
    if (want === 'off') return null;
    if (want !== 'auto') return HEROES[want] ? want : null;
    const pool = ctx.style && ctx.style.melody && ctx.style.melody.heroes;
    if (!pool || !pool.length) return null;
    const R = U().makeRand(((ctx.opts.seed >>> 0) || 1) ^ U().hash('hero|' + pool.join(',')));
    const id = R.pick(pool);
    return id === 'trad' ? null : id;
  };

  /* ============================================================ HELPERS == */
  function fit(pcs, cp, key) {
    const out = pcs.slice();
    cp.forEach(pc => {
      if (out.includes(pc)) return;
      [1, 11].forEach(d => { const x = mod12(pc + d), i = out.indexOf(x); if (i >= 0 && !cp.includes(x) && x !== key && x !== mod12(key + 7)) out.splice(i, 1); });
      out.push(pc);
    });
    return out;
  }
  const ladder = (pcs, lo, hi) => { const o = []; for (let p = lo; p <= hi; p++) if (pcs.includes(mod12(p))) o.push(p); return o; };
  const nearIdx = (lad, p) => { let b = 0; for (let i = 1; i < lad.length; i++) if (Math.abs(lad[i] - p) < Math.abs(lad[b] - p)) b = i; return b; };

  /* ============================================================ GESTURES == */
  // every gesture: (S, T, len, o) → writes notes with S.emit and leaves S.p on its last pitch
  const G = {};
  function chordAt(S, T) { return S.an.chordAt(S.sec.start * BAR + Math.max(0, Math.floor(T))); }
  function pcsAt(S, T, kind) {
    if (S.hero.chordScale) { const ch = chordAt(S, T); return SCALE_OF(ch).map(x => mod12(ch.root + x)); }
    const h = S.hero, name = ((kind === 'run' && h.run) || h.scale)[S.minor ? 'minor' : 'major'];
    const pcs = SC[name].map(i => mod12(S.key + i));
    return h.fit ? fit(pcs, chordAt(S, T).pcs, S.key) : pcs;
  }
  const lad = (S, T, kind) => ladder(pcsAt(S, T, kind), S.lo, S.hi);
  const ctLad = (S, T) => ladder(chordAt(S, T).pcs, S.lo, S.hi);
  function ctNear(S, T, p) { const l = ctLad(S, T); return l.length ? l[nearIdx(l, clamp(p, S.lo, S.hi))] : clamp(p, S.lo, S.hi); }
  const vibOf = S => S.hero.vib === 'wvib' ? { wvib: true } : { vib: true };
  const fastRate = S => S.tempo <= 126 ? S6 : 1;               // sextuplets only when the tempo allows them

  const RH16 = [[[0, 6], [6, 2], [8, 8]], [[2, 2], [4, 4], [8, 2], [10, 6]], [[0, 3], [3, 3], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 4], [12, 4]], [[4, 2], [6, 2], [8, 6], [14, 2]],
    [[0, 8], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 4], [6, 2], [8, 2], [10, 6]], [[2, 2], [4, 2], [6, 6], [12, 4]]];
  const RH16F = [[[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], [8, 8]], [[0, 2], [2, 1], [3, 1], [4, 4], [8, 1], [9, 1], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 1], [5, 1], [6, 1], [7, 1], [8, 8]]];
  const RH16S = [[[0, 8], [8, 8]], [[0, 12], [12, 4]], [[4, 4], [8, 8]], [[0, 6], [6, 10]]];
  const RH8 = [[[0, 2], [2, 2], [4, 4]], [[0, 3], [3, 1], [4, 4]], [[2, 2], [4, 4]], [[0, 4], [4, 4]], [[0, 2], [2, 1], [3, 1], [4, 4]]];
  function rhythmFor(S, len, o) {
    const R = S.R;
    if (len >= 16) return R.pick(o.fast ? RH16F : o.slow ? RH16S : RH16);
    if (len >= 12) return R.pick(RH8).concat([[8, len - 8]]);
    if (len >= 8) return R.pick(RH8).map(([p, d]) => [p, p + d >= 8 ? len - p : d]);
    return len >= 4 ? (R.chance(0.5) ? [[0, 2], [2, len - 2]] : [[0, len]]) : [[0, len]];
  }
  /** singable line: chord tones on the long notes, scale steps between; o.motif = remembered cell (themes) */
  G.mel = function (S, T, len, o) {
    const R = S.R, h = S.hero;
    let m = o.motif && S.motifs[o.motif];
    if (!m) {
      const rh = rhythmFor(S, len, o);
      const dir = R.chance(0.5) ? 1 : -1;
      m = { rh, steps: rh.map((_, i) => i === 0 ? 0 : (R.chance(0.7) ? dir : -dir) * (R.chance(0.25) ? 2 : 1)) };
      if (o.motif) S.motifs[o.motif] = m;
    }
    let p = ctNear(S, T, S.p + (o.vary ? R.pick([-2, 0, 2]) : 0)), prevP = null;
    m.rh.forEach(([pos, d], i) => {
      if (pos >= len) return;
      d = Math.min(d, len - pos);
      const t = T + pos, sc = lad(S, t, 'scale');
      let go = 1;
      if (i) {
        // the contour of the motif, pulled back toward the register of the section when it drifts away
        const pull = p < S.center - 6 ? 1 : p > S.center + 9 ? -1 : 0;
        go = pull || ((m.steps[i] || 1) > 0 ? 1 : -1);
        const k = clamp(nearIdx(sc, p) + (pull ? pull * Math.abs(m.steps[i] || 1) : m.steps[i]), 0, sc.length - 1); p = sc[k];
      }
      const last = i === m.rh.length - 1 || m.rh[i + 1][0] >= len;
      if (d >= 4 || last) {
        const before = p; p = ctNear(S, t, p);
        // a long note never just repeats the note before it: the next chord tone in the direction of the line
        if (i && p === prevP) { const cl = ctLad(S, t), j = nearIdx(cl, p), dj = go; p = cl[clamp(j + dj, 0, cl.length - 1)] === p ? cl[clamp(j - dj, 0, cl.length - 1)] : cl[clamp(j + dj, 0, cl.length - 1)]; void before; }
      }
      const tech = {};
      if (i === 0 && (o.si || R.chance(h.slide * 0.6))) tech.slide = 'inBelow';
      if (d >= 4 && R.chance(h.bend * (last ? 0.7 : 0.35))) {
        const below = sc[Math.max(0, nearIdx(sc, p - 1.5))], k = p - below;
        if (k >= 1 && k <= 2) { S.emit(t, d, below, Object.assign({ bend: k, bendType: 'up' }, last && d >= 6 ? vibOf(S) : {})); prevP = p; return; }
      }
      if (last && d >= 4) Object.assign(tech, vibOf(S));
      S.emit(t, d, p, tech);
      prevP = p;
    });
    S.p = p;
  };
  /** one long note with the player's expression */
  G.hold = function (S, T, len, o) {
    const R = S.R, h = S.hero;
    let target = ctNear(S, T, o.high ? S.center + 9 + R.int(0, 4) : S.p + (S.p < S.center - 6 ? R.pick([3, 5]) : S.p > S.center + 10 ? -3 : R.pick([0, 0, 3, -3])));
    if (o.root) { const kl = ladder([S.key], S.lo, S.hi); target = kl[nearIdx(kl, Math.max(S.p, S.center - 6))] || target; }
    const tech = {};
    let pitch = target;
    if (o.bend && R.chance(0.35 + h.bend * 0.65)) {
      const sc = lad(S, T, 'scale');
      let i = nearIdx(sc, target); if (sc[i] >= target) i--;
      if (o.wide && i > 0 && target - sc[i] < 3) i--;                       // from two scale steps below (1½ – 2 tones)
      let k = i >= 0 ? target - sc[i] : 2;
      if (o.small) k = Math.min(k, 1);
      k = clamp(k, 1, 4);
      if (k > 2 && !o.wide) tech.slide = 'inBelow';                          // a tone and a half only for the players known for it
      else { pitch = target - k; tech.bend = k; tech.bendType = o.rel ? 'release' : 'up'; }
    } else if (o.si || R.chance(h.slide * 0.5)) tech.slide = 'inBelow';
    if (len >= 4) Object.assign(tech, vibOf(S));
    if (o.pinch) { tech.pinch = true; tech.wvib = true; delete tech.vib; }
    if (o.dive) { tech.slide = 'outDown'; delete tech.vib; delete tech.wvib; }
    if (o.ring) tech.ring = true;
    S.emit(T, len, pitch, tech, { acc: 6 });
    S.p = target;
  };
  /** scale run: straight (g = 0) or a sequence in groups of g; leg = hammer-ons / pull-offs */
  G.run = function (S, T, len, o) {
    const R = S.R, h = S.hero;
    const r = o.t8 ? T3 : o.fast ? fastRate(S) : 1;
    const n = Math.max(1, Math.round(len / r)), sc = lad(S, T, o.scale ? 'scale' : 'run');
    if (sc.length < 4) return G.hold(S, T, len, {});
    let dir = o.dir || (R.chance(0.5) ? 1 : -1);
    const g = o.g || 0, span = g ? Math.ceil(n / g) + g : n;
    let base = clamp(nearIdx(sc, S.p) - (dir > 0 ? R.int(0, 2) : -R.int(0, 2)), 0, sc.length - 1);
    if (dir > 0) base = Math.min(base, Math.max(0, sc.length - 1 - Math.min(span, sc.length - 1)));
    else base = Math.max(base, Math.min(sc.length - 1, Math.min(span, sc.length - 1)));
    const leg = o.leg || R.chance(h.legato * 0.6);
    let prev = null;
    for (let i = 0; i < n; i++) {
      let k = g ? base + dir * (Math.floor(i / g) + i % g) : base + dir * i;
      // bounce inside the range
      const m = sc.length - 1; k = ((k % (2 * m)) + 2 * m) % (2 * m); if (k > m) k = 2 * m - k;
      const p = sc[k], tech = {};
      const head = g ? i % g === 0 : i % 3 === 0;
      if (leg && !head && prev !== null && p !== prev && Math.abs(p - prev) <= 4) tech[p > prev ? 'h' : 'p'] = true;
      const d = i === n - 1 ? Math.max(r, len - i * r) : r;
      S.emit(T + i * r, d, p, tech, { tup: r !== 1, acc: head ? 2 : -6 });
      prev = p;
    }
    S.p = prev;
  };
  /** neoclassical pedal point: a moving line against one repeated note */
  G.pedal = function (S, T, len, o) {
    const sc = lad(S, T, 'scale');
    const ip = nearIdx(sc, ctNear(S, T, S.p));
    let im = o.below ? ip - 1 : Math.min(sc.length - 1, ip + 4);
    for (let i = 0; i < len; i++) {
      const mel = i % 2 === 0;
      S.emit(T + i, 1, sc[clamp(mel ? im : ip, 0, sc.length - 1)], {}, { acc: mel ? 3 : -8 });
      if (mel) { im--; if (o.below ? im < Math.max(0, ip - 5) : im <= ip) im = o.below ? ip - 1 : Math.min(sc.length - 1, ip + 5); }
    }
    S.p = sc[clamp(ip, 0, sc.length - 1)];
  };
  /** swept arpeggio of the chord, up and down (dim: diminished 7th from the 3rd of a dominant chord) */
  G.sweep = function (S, T, len, o) {
    const r = S.tempo <= 150 ? S6 : 1, per = r === 1 ? 8 : 12;
    let i = 0, last = S.p;
    while (i * r < len - 0.01) {
      const t = T + i * r, ch = chordAt(S, t);
      let pcs = ch.pcs.slice(0, 3);
      if (o.dim && ch.intervals.includes(4) && (ch.intervals.includes(10) || mod12(ch.root - S.key) === 7)) pcs = [4, 7, 10, 13].map(x => mod12(ch.root + x));
      const l = ladder(pcs, S.lo - 5, S.hi);
      const top = Math.min(l.length - 1, nearIdx(l, S.center + 10)), n = r === 1 ? 4 : 5, b0 = Math.max(0, top - n);
      const seq = [];
      for (let k = b0; k <= top; k++) seq.push(l[k]);
      for (let k = top - 1; k > b0; k--) seq.push(l[k]);
      while (seq.length < per) seq.push(l[b0 + (seq.length % 2)]);
      for (let k = 0; k < per && i * r < len - 0.01; k++, i++) { last = seq[k]; S.emit(T + i * r, r, last, {}, { tup: r !== 1, acc: k === 0 ? 4 : -6 }); }
    }
    S.p = last;
  };
  /** two-hand tapping on one string: tap – pull-off – pull-off, following the chords */
  G.tap = function (S, T, len, o) {
    const r = S.tempo <= 138 ? S6 : T3, tun = TUN();
    const n = Math.round(len / r);
    let cyc = 0, last = S.p;
    for (let i = 0; i < n; i++) {
      const t = T + i * r, ph = i % 3;
      if (ph === 0) {
        const l = ladder(chordAt(S, t).pcs, S.lo, Math.min(S.hi + 4, tun[5] + FRETS()));
        const iL = nearIdx(l, clamp(S.center - 2, S.lo, S.hi));
        const low = l[iL], mid = l[Math.min(l.length - 1, iL + 1)];
        let iT = l.findIndex(x => x >= low + 9); if (iT < 0) iT = l.length - 1;
        if (o.walk) iT = Math.min(l.length - 1, iT + (Math.floor(cyc / 2) % 3));
        const s = [5, 4, 3].find(st => low - tun[st] >= 1 && low - tun[st] <= 12 && l[iT] - tun[st] <= FRETS());
        S.tapSet = s === undefined ? null : { s, notes: [l[iT], mid, low] };
        cyc++;
      }
      if (!S.tapSet) return G.run(S, T + i * r, len - i * r, { dir: 1, leg: 1 });
      const p = S.tapSet.notes[ph], s = S.tapSet.s;
      S.emit(t, r, p, ph === 0 ? { tap: true } : { p: true }, { tup: true, string: s, fret: p - tun[s], acc: ph === 0 ? 2 : -8 });
      last = p;
    }
    S.p = last;
  };
  /** unison bend: the G string bent a whole tone up to the note held on the B string */
  G.uni = function (S, T, len) {
    const tun = TUN();
    let target = ctNear(S, T, Math.max(S.p, S.center + 4));
    while (target - tun[4] < 5) target += 12;
    while (target - tun[4] > 19) target -= 12;
    const fB = target - tun[4], fG = target - 2 - tun[3];
    if (fB < 3 || fG < 3 || fG > FRETS()) return G.hold(S, T, len, { bend: 1 });
    S.emit(T, len, target - 2, Object.assign({ bend: 2, bendType: 'up' }, len >= 6 ? vibOf(S) : {}), { string: 3, fret: fG, acc: 8 });
    S.emit(T, len, target, {}, { string: 4, fret: fB, acc: 2 });
    S.p = target;
  };
  /** double stops */
  G.ds = function (S, T, len, o) {
    const R = S.R, kind = o.kind || 'thirds';
    const ch = chordAt(S, T);
    if (kind === 'hendrix') {
      // pentatonic of the CHORD: hammer-ons into chord tones under a held upper note
      const minor = ch.intervals.includes(3) && !ch.intervals.includes(4);
      const pl = ladder((minor ? SC.minPent : SC.majPent).map(x => mod12(ch.root + x)), S.lo - 5, S.hi);
      let i = clamp(nearIdx(pl, S.center - 4 + (o.high ? 7 : 0)), 0, pl.length - 4), t = T;
      while (t < T + len - 0.01) {
        const left = T + len - t, u = Math.min(4, left), kindU = left < 4 ? 'C' : R.pick(['A', 'A', 'B', 'C']);
        const up = [i + 2, i + 3].find(j => pl[j] !== undefined && pl[j] - pl[i + 1] >= 3 && pl[j] - pl[i + 1] <= 5) || i + 3;
        if (kindU === 'A') {
          S.emit(t, 1, pl[i], {}, { acc: 2 }); S.emit(t + 1, u - 1, pl[i + 1], { h: true }); S.emit(t, u, pl[Math.min(up, pl.length - 1)], {}, { acc: 2 });
        } else if (kindU === 'B') {
          S.emit(t, 2, pl[i + 1], {}, { acc: 3 }); S.emit(t, 2, pl[Math.min(up, pl.length - 1)], {}, { acc: 3 });
          if (u > 2) { S.emit(t + 2, u - 2, pl[i], { slide: 'legato' }); S.emit(t + 2, u - 2, pl[Math.min(up, pl.length - 1) - 1], { slide: 'legato' }); }
        } else {
          S.emit(t, 1, pl[i + 1], {}); S.emit(t + 1, 1, pl[i + 2], { h: true }); if (u > 2) S.emit(t + 2, u - 2, pl[i + 1], { p: true });
        }
        S.p = pl[i + 1];
        i = clamp(i + R.pick([-1, 1, 1, 0]), 0, pl.length - 4); t += u;
      }
      return;
    }
    if (kind === 'steel') {
      // pedal-steel bend: the lower note bends a whole tone up into a chord tone under a held note
      const target = ctNear(S, T, S.center + (o.high ? 6 : 0)), l = ctLad(S, T), j = l.findIndex(x => x > target + 2);
      const upper = j >= 0 ? l[j] : target + 5, d = Math.min(len, 8);
      S.emit(T, d, target - 2, { bend: 2, bendType: 'up' }, { acc: 6 }); S.emit(T, d, upper, {}, { acc: 2 });
      S.p = target;
      if (len > d) G.run(S, T + d, len - d, { dir: -1 });
      return;
    }
    if (kind === 'stabs') {
      // two chord tones a 3rd – 5th apart, hit like a horn section
      const l = ctLad(S, T);
      const i = clamp(nearIdx(l, S.center + (o.high ? 8 : 2)), 0, Math.max(0, l.length - 2));
      const a = l[i], b = l[i + 1] !== undefined && l[i + 1] - a <= 6 ? l[i + 1] : a + 5;
      const hits = o.eight ? Array.from({ length: Math.floor(len / 2) }, (_, k) => k * 2) : (len >= 8 ? [0, 3, 4, 6] : [0, 2]);
      hits.forEach((pos, k) => {
        if (pos >= len) return;
        const d = Math.min(o.eight ? 2 : (k === hits.length - 1 ? Math.max(1, len - pos) : 1), len - pos), tech = d <= 1 ? { stacc: true } : {};
        if (k === 0) tech.slide = 'inBelow';
        S.emit(T + pos, d, a, Object.assign({}, tech), { acc: k === 0 ? 8 : 2 }); S.emit(T + pos, d, b, Object.assign({}, tech), { acc: k === 0 ? 8 : 2 });
      });
      S.p = b; return;
    }
    // parallel thirds / sixths along the scale
    const sc = lad(S, T, 'scale'), gap = kind === 'sixths' ? 5 : 2, dir = o.dir || -1;
    const unit = len >= 16 ? 4 : 2, n = Math.max(1, Math.floor(len / unit));
    let i = clamp(nearIdx(sc, ctNear(S, T, S.p)) - (kind === 'sixths' ? 3 : 0), dir < 0 ? n : 0, sc.length - 1 - gap - (dir > 0 ? n : 0));
    i = clamp(i, 0, sc.length - 1 - gap);
    for (let k = 0; k < n; k++) {
      const last = k === n - 1, d = last ? len - k * unit : unit, tech = last && d >= 4 ? vibOf(S) : (k ? { slide: 'legato' } : {});
      const j = clamp(i + dir * k, 0, sc.length - 1 - gap);
      S.emit(T + k * unit, d, sc[j], Object.assign({}, tech)); S.emit(T + k * unit, d, sc[j + gap], Object.assign({}, tech), { acc: 3 });
      S.p = sc[j + gap];
    }
  };
  /** fast trill between two neighbouring scale notes */
  G.trill = function (S, T, len) {
    const sc = lad(S, T, 'scale'), i = clamp(nearIdx(sc, ctNear(S, T, S.p)), 0, sc.length - 2);
    const r = S.tempo <= 150 ? 0.5 : 1, n = Math.round(len / r);
    for (let k = 0; k < n; k++) S.emit(T + k * r, r, sc[i + (k % 2)], k === 0 ? {} : (k % 2 ? { h: true } : { p: true }), { acc: k ? -8 : 2 });
    S.p = sc[i];
  };
  /** chicken picking: a picked note followed by its muted "cluck" */
  G.chick = function (S, T, len) {
    const R = S.R, sc = lad(S, T, 'run');
    let i = nearIdx(sc, S.p), dir = R.chance(0.6) ? -1 : 1;
    for (let k = 0; k < len; k += 2) {
      i += dir; if (i <= 1 || i >= sc.length - 2) { dir = -dir; i += 2 * dir; }
      i = clamp(i, 0, sc.length - 1);
      S.emit(T + k, 1, sc[i], { stacc: true }, { acc: 6 });
      if (k + 1 < len) S.emit(T + k + 1, 1, sc[i], { mute: true }, { acc: -30 });
    }
    S.p = sc[i];
  };
  /** octaves (o.toggle: 16ths jumping between the note and its octave, like a whammy pedal) */
  G.oct = function (S, T, len, o) {
    const R = S.R;
    if (o.toggle) {
      let p = ctNear(S, T, S.center - 3);
      for (let k = 0; k < len; k++) {
        if (k && k % 4 === 0) p = ctNear(S, T + k, p + R.pick([-2, 0, 3]));
        S.emit(T + k, 1, p + (k % 2 ? 12 : 0), k % 2 ? { slide: 'legato' } : {}, { acc: k % 2 ? 0 : 4 });
      }
      S.p = p; return;
    }
    const before = S.notes.length;
    const hi0 = S.hi; S.hi = Math.min(S.hi, S.center + 7);
    G.mel(S, T, len, {});
    S.hi = hi0;
    S.notes.slice(before).forEach(n => { delete n.tech.bend; delete n.tech.bendType; S.emit(n.T, n.d, n.pitch - 12, Object.assign({}, n.tech), { acc: -4 }); });
  };
  /** kill-switch stutter: one note chopped into a rhythm */
  G.stut = function (S, T, len) {
    const pat = S.R.pick(['x.xx.x.xx.x.xx.x', 'xx.xx.x.xx.xx.x.', 'x.x.xx.xx.x.x.xx', 'xxx.xxx.xx.xx.x.']);
    let p = ctNear(S, T, S.center + 5), hit = 0;
    for (let k = 0; k < len; k++) {
      if (pat[k % 16] !== 'x') continue;
      if (k % 8 === 0 && k) p = ctNear(S, T + k, p);
      S.emit(T + k, 1, p + (hit % 5 === 4 ? 12 : 0), { stacc: true }, { acc: hit % 5 === 4 ? 8 : 0 }); hit++;
    }
    S.p = p;
  };
  /** tremolo picking on one note */
  G.trem = function (S, T, len, o) {
    const p = ctNear(S, T, o.high ? S.center + 10 : S.p + 3);
    S.emit(T, len, p, { trem: true }, { acc: 4 }); S.p = p;
  };
  /** natural harmonics (12th fret) that belong to the chord or the scale */
  G.harm = function (S, T, len) {
    const tun = TUN(), cp = chordAt(S, T).pcs, sp = pcsAt(S, T, 'scale');
    const ok = [5, 4, 3, 2].filter(s => cp.includes(mod12(tun[s]))).concat([5, 4, 3, 2].filter(s => sp.includes(mod12(tun[s]))));
    if (!ok.length) return G.hold(S, T, len, {});
    const n = len >= 8 ? 2 : 1, d = len / n;
    for (let k = 0; k < n; k++) { const s = ok[k % ok.length]; S.emit(T + k * d, d, tun[s] + 12, { harm: true }, { string: s, fret: 12, acc: 4 }); }
  };
  /** rake: muted strings swept into an accented bent note */
  G.rake = function (S, T, len) {
    const target = ctNear(S, T, S.p + 2), l = ctLad(S, T), i = nearIdx(l, target);
    [2, 1].forEach((back, k) => { if (k < len - 1 && l[i - back] !== undefined) S.emit(T + k * 0.5, 0.5, l[i - back], { mute: true }, { acc: -25 }); });
    S.emit(T + 1, Math.max(1, len - 1), target - 2, { bend: 2, bendType: 'up', accent: true }, { acc: 6 });
    S.p = target;
  };
  /** melodic arpeggio of the chord in 8ths (o.pull: quick pull-off ornaments) */
  G.arp = function (S, T, len, o) {
    const order = [0, 1, 2, 1, 3, 2, 1, 2];
    let last = S.p;
    for (let k = 0; k * 2 < len; k++) {
      const t = T + k * 2, l = ctLad(S, t), b = clamp(nearIdx(l, S.center - 3), 0, Math.max(0, l.length - 4));
      const p = l[Math.min(l.length - 1, b + order[k % 8])];
      if (o.pull && k % 4 === 2) {
        const sc = lad(S, t, 'scale'), up = sc[Math.min(sc.length - 1, nearIdx(sc, p) + 1)];
        S.emit(t, 1, up, {}, { acc: 2 }); S.emit(t + 1, 1, p, { p: true }, { acc: -6 });
      } else S.emit(t, Math.min(2, len - k * 2), p, {}, { acc: k % 4 === 0 ? 4 : -2 });
      last = p;
    }
    S.p = last;
  };
  /** a short cell repeated against the beat, then one long note (Latin rock) */
  G.motif = function (S, T, len) {
    const sc = lad(S, T, 'scale'), a = ctNear(S, T, S.p), i = nearIdx(sc, a);
    const cell = [sc[clamp(i, 0, sc.length - 1)], sc[clamp(i + 1, 0, sc.length - 1)], sc[clamp(i + 2, 0, sc.length - 1)]];
    const reps = len >= 16 ? 3 : 2, gap = len >= 16 ? 4 : 3;
    for (let r = 0; r < reps; r++) cell.forEach((p, k) => S.emit(T + r * gap + k, 1, p, k === 0 ? {} : { h: true }, { acc: k === 0 ? 5 : -4 }));
    const at = (reps - 1) * gap + 3, end = ctNear(S, T + at, cell[2] + 2);
    if (at < len) S.emit(T + at, len - at, end, vibOf(S), { acc: 6 });
    S.p = end;
  };
  /** an authored phrase of the player: [start, dur, semitones from the tonic, techniques, partner (+semitones)] */
  G.lick = function (S, T, len) {
    const list = (S.hero.licks || []).filter(l => l.every(n => n[0] < len - 1.5));       // the last note may be cut at the end of the space
    if (!list.length) return G.mel(S, T, len, {});
    const lick = S.R.pick(list);
    let last = S.p;
    lick.forEach(([t, d, semi, tc, partner]) => {
      tc = tc || ''; d = Math.min(d, len - t);
      if (S.minor) { const m = mod12(semi); if (m === 4) semi -= 1; else if (m === 9) semi += 1; }      // minor key: 3rd → b3, 6th → b7
      const tech = {};
      const m = /b(\d)(r?)/.exec(tc);
      if (/pb/.test(tc)) { tech.bend = 2; tech.bendType = 'prerelease'; }
      else if (m) { tech.bend = +m[1]; tech.bendType = m[2] ? 'release' : 'up'; }
      let rest = tc.replace(/pb|b\dr?/g, '');
      if (/si/.test(rest)) { tech.slide = 'inBelow'; rest = rest.replace('si', ''); }
      if (/so/.test(rest)) { tech.slide = 'outDown'; rest = rest.replace('so', ''); }
      if (rest.includes('c') && !S.minor) { tech.bend = 0.5; tech.bendType = 'up'; }
      if (rest.includes('w')) tech.wvib = true; else if (rest.includes('v')) tech.vib = true;
      if (rest.includes('h')) tech.h = true;
      if (rest.includes('p')) tech.p = true;
      if (rest.includes('s')) tech.stacc = true;
      if (rest.includes('m')) tech.mute = true;
      if (rest.includes('x')) tech.pinch = true;
      const p = S.tonic + semi;
      S.emit(T + t, d, p, tech, { tup: rest.includes('t'), acc: rest.includes('a') ? 10 : (tech.bend >= 1 ? 5 : 0) });
      if (partner) S.emit(T + t, d, p + partner, Object.assign({}, tech.stacc ? { stacc: true } : {}, tech.vib ? { vib: true } : {}), { tup: rest.includes('t') });
      last = p;
    });
    S.p = last;
  };
  G.rest = function () {};

  /* ------------------------------------------- the reference library ---
   * styledata.js holds what the players repeat across their songs. Two gestures use it:
   *   cell  one of the player's idiomatic cells (half bar / one bar) played over the SAME chord degree
   *         it was found on, in the register of the line; when the chord has no cell, a tonic cell is
   *         moved to the chord root and its notes are fitted to the scale. A cell is vocabulary found
   *         in several different songs — never the hook of one song.
   *   dna   a new phrase: one of his rhythm cells, intervals chosen with the probabilities of his lines
   *         from each degree, his scale (the degrees he really uses), bends on the degrees he bends,
   *         vibrato / slides / legato at his rates.
   */
  const SDATA = S => { const d = SDAW.styleData; return d && S.hero.data ? d.artists[S.hero.data] : null; };
  function cellList(S, L) {
    const d = SDAW.styleData, a = SDATA(S), mode = S.minor ? 'minor' : 'major';
    let list = a ? a.cells.filter(c => c[0] === L && c[1] === mode) : [];
    // a player with few cells of his own borrows the cells his genre shares (found in 2+ players)
    if (list.length < 6 && d && S.hero.pool && d.pools[S.hero.pool]) list = list.concat(d.pools[S.hero.pool].cells.filter(c => c[0] === L && c[1] === mode));
    return list;
  }
  /** the degrees of the key the player uses (>= 4 % of his lead notes in this mode), fitted to the chord */
  function dataPcs(S, T) {
    const a = SDATA(S), ch = chordAt(S, T);
    if (S.hero.chordScale || !a) return pcsAt(S, T, 'run');
    const prof = a.lead.pc[S.minor ? 'minor' : 'major'];
    if (!prof || prof.reduce((x, y) => x + y, 0) < 0.5) return pcsAt(S, T, 'run');
    const pcs = []; prof.forEach((v, i) => { if (v >= 0.04) pcs.push(mod12(S.key + i)); });
    return pcs.length >= 5 ? fit(pcs, ch.pcs, S.key) : pcsAt(S, T, 'run');
  }
  /** a lick / cell technique string → ScoreDAW techniques */
  function techOf(S, tc) {
    const tech = {}, m = /b(\d)/.exec(tc || '');
    if (m) { tech.bend = +m[1]; tech.bendType = 'up'; }
    if (/si/.test(tc)) tech.slide = 'inBelow';
    if (/h/.test(tc)) tech.h = true;
    if (/(^|[^s])p/.test(tc)) tech.p = true;
    if (/v/.test(tc)) Object.assign(tech, vibOf(S));
    if (/m/.test(tc)) tech.mute = true;
    return tech;
  }
  G.cell = function (S, T, len, o) {
    const R = S.R, L = len >= 16 ? 16 : 8;
    if (len < 8) return G.dna(S, T, len, o);
    const deg = mod12(chordAt(S, T).root - S.key);
    const list = cellList(S, L);
    let pool = list.filter(c => c[2] === deg), shift = 0;
    if (!pool.length) { pool = list.filter(c => c[2] === 0); shift = deg > 6 ? deg - 12 : deg; }
    if (!pool.length) return L === 16 ? (G.cell(S, T, 8, o), G.cell(S, T + 8, len - 8, o)) : G.dna(S, T, len, o);
    const cell = R.weighted(pool.map(c => [c, c[4]]))[3];
    // the octave that keeps the cell nearest to the line (and inside the range)
    const mid = cell.reduce((s, n) => s + n[2], 0) / cell.length;
    let base = S.tonic + shift;
    while (base + mid > S.p + 7 && base + Math.min(...cell.map(n => n[2])) - 12 >= S.lo) base -= 12;
    while (base + mid < S.p - 7 && base + Math.max(...cell.map(n => n[2])) + 12 <= S.hi) base += 12;
    const scAt = t => ladder(dataPcs(S, T + t).concat(chordAt(S, T + t).pcs), S.lo - 12, S.hi + 12);
    let last = S.p;
    cell.forEach(([t, d, semi, tc, partner]) => {
      if (t >= len) return;
      d = Math.min(d, len - t);
      let p = base + semi;
      // outside the scale + chord: kept only as a short passing note off the beat (a cell moved to another
      // chord, or a cell found over the same degree in another mode, never holds a clash)
      const sc = scAt(t);
      if (!sc.includes(p) && (shift || d > 1 || (Number.isInteger(t) && t % 2 === 0))) p = sc[nearIdx(sc, p)];
      const tup = /t/.test(tc || '') || Math.abs(t * 2 - Math.round(t * 2)) > 0.01;
      const tech = techOf(S, tc);
      S.emit(T + t, d, p, tech, { tup, acc: tech.bend ? 5 : (Number.isInteger(t) && t % 4 === 0 ? 3 : 0) });
      if (partner) S.emit(T + t, d, p + partner, {}, { tup });
      last = p;
    });
    S.p = last;
    if (len > L + 0.5) G.dna(S, T + L, len - L, o);                              // the rest of the space: a phrase of his own
  };
  G.dna = function (S, T, len, o) {
    const a = SDATA(S);
    if (!a || !a.rhythms || !a.rhythms.length) return G.mel(S, T, len, o || {});
    const R = S.R, mode = S.minor ? 'minor' : 'major';
    const tr = (a.trans && (a.trans[mode] && Object.keys(a.trans[mode]).length ? a.trans[mode] : a.trans.major)) || {};
    const bd = (a.bendDeg && a.bendDeg[mode]) || {}, tech0 = a.lead.tech || {};
    // fast: the busier rhythm cells (solos, climaxes); otherwise all of them, by how often he plays them
    let cells = a.rhythms;
    if (o && o.fast) { const busy = cells.filter(c => c[0].length >= 5); if (busy.length >= 3) cells = busy; }
    let p = S.p, prev = null;
    for (let h0 = 0; h0 < len - 0.01; h0 += 8) {
      const span = Math.min(8, len - h0), rh = R.weighted(cells.map(c => [c[0], c[1]])).filter(([pos]) => pos < span);
      rh.forEach(([pos, d], i) => {
        const t = T + h0 + pos, sc = ladder(dataPcs(S, t), S.lo, S.hi);
        d = Math.min(d, span - pos);
        if (!sc.length) return;
        if (prev === null) p = sc[nearIdx(sc, p)];
        else {
          const opts = tr[String(mod12(p - S.key))] || tr['0'];
          let iv = opts && opts.length ? R.weighted(opts) : R.pick([-2, -1, 1, 2]);
          if (p + iv > S.center + 10 || p + iv > S.hi - 2) iv = -Math.abs(iv) || -2;      // stay in the singing register
          else if (p + iv < S.center - 8 || p + iv < S.lo + 2) iv = Math.abs(iv) || 2;
          const want = p + iv;
          let k = nearIdx(sc, want);
          if (iv > 0 && sc[k] <= p && k < sc.length - 1) k++;
          if (iv < 0 && sc[k] >= p && k > 0) k--;
          p = sc[k];
        }
        const lastNote = i === rh.length - 1;
        if (lastNote && d >= 2) p = ctNear(S, t, p);
        const tech = {}, dg = String(mod12(p - S.key));
        let pitch = p;
        if (d >= 1 && R.chance(Math.min(0.85, (bd[dg] || 0) * (d >= 2 ? 1.8 : 0.7)))) {
          // bend into the note from the scale note below (1 or 2 semitones, like the data)
          const j = nearIdx(sc, p - 1.5), below = sc[Math.max(0, j)], k = p - below;
          if (k >= 1 && k <= 2) { pitch = below; tech.bend = k; tech.bendType = 'up'; }
        } else if (prev !== null && d <= 1.01 && p !== prev && Math.abs(p - prev) <= 4 && R.chance(Math.min(0.8, (tech0.legato || 0) * 2.2))) tech[p > prev ? 'h' : 'p'] = true;
        else if (prev !== null && p > prev && R.chance((tech0.slide || 0) * 1.5)) tech.slide = 'inBelow';
        if (d >= 3 && R.chance(Math.max(0.3, a.lead.vibLong || 0))) Object.assign(tech, vibOf(S));
        const tup = Math.abs(pos * 2 - Math.round(pos * 2)) > 0.01 || Math.abs(d * 2 - Math.round(d * 2)) > 0.01;
        S.emit(t, d, pitch, tech, { tup, acc: tech.bend ? 5 : (Number.isInteger(pos) && pos % 4 === 0 ? 3 : -2) });
        prev = p;
      });
    }
    if (prev !== null) S.p = prev;
  };
  /* ---------------------------------------------- double-stop bend licks ---
   * The classic rock / blues repetition licks around the minor-pentatonic "box" (F = the fret
   * where the high E string plays the tonic; B string at F = the 5th, G string at F+2 = the 4th):
   *   gbe      bend on the G string (4th → 5th), then the B + E strings together (5th + root), repeated
   *   be       bend on the B string (b7 → root), then the same pitch on the high E string, repeated
   *   oblique  G string bent (4th → 5th) under a held b7 on the B string, the B note picked again
   *   stack    G-string bend → B string → hammer / pull-off on the B string → high E (16th cells)
   * (Chuck Berry, Clapton, Page, Hendrix, SRV, Freddie / B.B. King — original phrases, not quotes)
   */
  function boxFret(S) {
    const tun = TUN(), want = clamp(S.center + 4, tun[5] + 3, tun[5] + 17);
    let best = null;
    for (let f = 3; f <= Math.min(17, FRETS() - 4); f++) if (mod12(tun[5] + f - S.key) === 0 && (best === null || Math.abs(tun[5] + f - want) < Math.abs(tun[5] + best - want))) best = f;
    return best === null ? 5 + mod12(S.key - tun[5] - 5) : best;
  }
  G.dsb = function (S, T, len, o) {
    const tun = TUN(), F = boxFret(S), R = S.R, kind = o.kind || R.pick(['gbe', 'be', 'oblique', 'stack']);
    const trip = o.trip !== undefined ? !!o.trip : ((SDAW.store.song && SDAW.store.song.swing > 0.3) || R.chance(0.5));
    const at = (s, f) => ({ string: s, fret: f, pitch: tun[s] + f });
    const note = (t, d, x, tech, acc, tup) => S.emit(t, d, x.pitch, tech || {}, { string: x.string, fret: x.fret, tup: tup || undefined, acc: acc || 0 });
    const G3 = at(3, F + 2), B2 = at(4, F), E1 = at(5, F), Bb7 = at(4, F + 3);
    const bend = { bend: 2, bendType: 'up' };
    // triplets: 3 notes per beat · straight: 16th-note cells (2 notes; "stack" = 4 notes)
    const u = trip ? T3 : 1, beat = trip ? 4 : (kind === 'stack' ? 4 : 2);
    const CELLS = trip ? {
      gbe: [[[G3], bend, 6], [[B2, E1], {}, 0], [[B2, E1], {}, -6]], be: [[[Bb7], bend, 6], [[E1], {}, -2], [[E1], {}, -6]],
      oblique: [[[G3, Bb7], bend, 6], [[Bb7], {}, -4], [[Bb7], {}, -6]], stack: [[[G3], bend, 6], [[Bb7], {}, 0], [[B2], { p: true }, -6]]
    } : {
      gbe: [[[G3], bend, 6], [[B2, E1], {}, 0]], be: [[[Bb7], bend, 6], [[E1], {}, -2]],
      oblique: [[[G3, Bb7], bend, 6], [[Bb7], {}, -4]], stack: [[[G3], bend, 6], [[Bb7], {}, 0], [[B2], { p: true }, -6], [[E1], {}, -2]]
    };
    const tail = len >= 8 ? 4 : 0, body = len - tail;
    let t = T;
    while (t + beat <= T + body + 1e-6) {
      CELLS[kind].forEach(([xs, tech, acc], k) => xs.forEach((x, m) => note(t + k * u, u, x, m === 0 ? Object.assign({}, tech) : (tech.p ? {} : {}), acc, trip)));
      t += beat;
    }
    // the answer: a held note of the box with vibrato (the b7 on the B string bent to the root, or root + 5th)
    const left = T + len - t;
    if (left > 0.5) {
      if (kind === 'be' || R.chance(0.5)) note(t, left, Bb7, Object.assign({}, bend, left >= 3 ? vibOf(S) : {}), 8);
      else { note(t, left, B2, left >= 3 ? vibOf(S) : {}, 4); note(t, left, E1, {}, 2); }
    }
    S.p = E1.pitch;
  };

  /* --------------------------------------------------------- jazz lines ---
   * bop    8th-note bebop line: chord tones on the beats, scale / chromatic passing notes between,
   *        mostly descending, a triplet turn now and then (Joe Pass, Benson, Martino, Christian)
   * encl   enclosure: the scale note above, the half step below, then the chord tone on the beat
   * chrom  chromatic run down into a chord tone (Django, Benson)
   * block  block chords: the melody on top + chord tones under it (Wes Montgomery, chord melody)
   */
  const SCALE_OF = ch => {
    const iv = ch.intervals.map(x => mod12(x)), has = x => iv.includes(x);
    if (has(3) && has(6)) return has(9) ? [0, 2, 3, 5, 6, 8, 9, 11] : [0, 1, 3, 5, 6, 8, 10];   // dim7: whole-half · m7b5: locrian
    if (has(3)) return has(11) ? [0, 2, 3, 5, 7, 9, 11] : [0, 2, 3, 4, 5, 7, 9, 10];           // m(maj7): melodic minor · m7: dorian + passing 3rd
    if (has(10)) return has(1) || has(3) ? [0, 1, 3, 4, 6, 8, 10] : [0, 2, 4, 5, 7, 9, 10, 11];  // altered dominant · bebop dominant
    return has(6) ? [0, 2, 4, 6, 7, 9, 11] : [0, 2, 4, 5, 7, 8, 9, 11];                        // lydian (#11) · bebop major
  };
  const chordScaleLad = (S, T) => { const ch = chordAt(S, T); return ladder(SCALE_OF(ch).map(x => mod12(ch.root + x)), S.lo, S.hi); };
  G.bop = function (S, T, len, o) {
    const R = S.R, n = Math.max(1, Math.floor(len / 2));
    let p = ctNear(S, T, S.p), dir = S.p > S.center + 4 ? -1 : (R.chance(0.65) ? -1 : 1);
    for (let i = 0; i < n; i++) {
      const t = T + i * 2, onBeat = (t - T) % 4 === 0, sc = chordScaleLad(S, t), cl = ctLad(S, t);
      if (i && R.chance(o.fast ? 0.25 : 0.12) && i < n - 1) {
        // triplet turn: chord tone – step above – back
        const j = nearIdx(sc, p), a = sc[clamp(j + 1, 0, sc.length - 1)];
        S.emit(t, T3, p, {}, { tup: true, acc: 2 }); S.emit(t + T3, T3, a, { h: true }, { tup: true, acc: -6 }); S.emit(t + 2 * T3, T3, p, { p: true }, { tup: true, acc: -6 });
        continue;
      }
      if (i) {
        let j = nearIdx(sc, p) + dir;
        if (j <= 0 || j >= sc.length - 1) { dir = -dir; j = clamp(nearIdx(sc, p) + dir, 0, sc.length - 1); }
        p = sc[j];
        if (onBeat && !cl.includes(p)) { const c2 = cl[nearIdx(cl, p)]; if (Math.abs(c2 - p) <= 2) p = c2; }         // chord tone on the beat
        if (!onBeat && R.chance(0.18)) { const nxt = ctNear(S, t + 2, p + dir * 2); p = nxt - dir; }                // chromatic approach to the next beat
        if (p > S.center + 10) dir = -1; else if (p < S.center - 8) dir = 1;
      }
      const last = i === n - 1, d = last ? Math.max(2, len - i * 2) : 2;
      S.emit(t, d, p, last && d >= 4 ? vibOf(S) : {}, { acc: onBeat ? 3 : -4 });
    }
    S.p = p;
  };
  G.encl = function (S, T, len) {
    const at = Math.min(len, 4) >= 4 ? 4 : len, target = ctNear(S, T + Math.min(at, len - 1), S.p + S.R.pick([-2, 0, 2]));
    if (len < 3) { S.emit(T, len, target, {}); S.p = target; return; }
    const sc = chordScaleLad(S, T), j = nearIdx(sc, target), above = sc[j] > target ? sc[j] : sc[Math.min(sc.length - 1, j + 1)];
    S.emit(T, 1, above, {}, { acc: 2 }); S.emit(T + 1, 1, target - 1, {}, { acc: -4 });
    S.emit(T + 2, len - 2, target, len - 2 >= 4 ? vibOf(S) : {}, { acc: 4 });
    S.p = target;
  };
  G.chrom = function (S, T, len) {
    const r = S.tempo <= 160 ? 1 : 2, n = Math.max(2, Math.floor(len / r));
    const end = ctNear(S, T + len - 1, S.p - 2), start = end + n - 1;
    for (let i = 0; i < n; i++) S.emit(T + i * r, i === n - 1 ? Math.max(r, len - i * r) : r, start - i, i % 4 ? { p: i % 2 === 1 } : {}, { acc: i % 4 === 0 ? 3 : -5 });
    S.p = end;
  };
  G.block = function (S, T, len) {
    const before = S.notes.length;
    const hi0 = S.hi; S.hi = Math.min(S.hi, S.center + 8);
    G.mel(S, T, len, {});
    S.hi = hi0;
    S.notes.slice(before).forEach(n => {
      delete n.tech.bend; delete n.tech.bendType;
      const cl = ctLad(S, n.T).filter(x => x < n.pitch && x >= n.pitch - 9).reverse().slice(0, 2);
      cl.forEach(x => S.emit(n.T, n.d, x, n.tech.vib ? { vib: true } : {}, { acc: -6 }));
    });
  };


  /* ============================================================== LEAD == */
  const LAND = [['mel', 8, {}], ['hold', 8, { root: 1, ring: 1 }]];
  const BREATH = [[['hold', 8, { bend: 1 }], ['rest', 8]], [['mel', 8, {}], ['rest', 8]], [['hold', 12, {}], ['rest', 4]]];

  /**
   * A whole section of lead guitar in the style of a player.
   * Returns [{ bar, notes, idx, role, curated }] or null (→ the normal melody engine).
   */
  L.leadSection = function (ctx, sec, isLastSection) {
    if (!ctx.track || ctx.track.type !== 'guitar' || ctx.role !== 'melody') return null;
    const id = L.heroFor(ctx);
    if (!id) return null;
    const hero = HEROES[id], an = ctx.an, RU = U();
    L.lastHero = hero.name;
    const fills = ctx.play === 'answers' || ctx.level === 0.5;
    const solo = sec.type === 'solo';
    // riff = the lead plan of the Full Song panel asked for a repeated phrase in this section
    const mode = fills ? 'fills' : ctx.leadMode === 'riff' ? 'riff' : solo ? 'solo' : 'theme';
    const R = RU.makeRand(ctx.seed ^ RU.hash(['legend', id, sec.type, mode, mode === 'theme' ? 0 : (sec.occ || 0), an.key.root].join('|')));
    const prof = (SDAW.autogen.CONFIG.profiles[sec.type] || SDAW.autogen.CONFIG.profiles.part);
    const lo = ctx.range[0], hi = Math.min(ctx.range[1] + 3, TUN()[5] + FRETS() - 2);
    const center = clamp(ctx.center + prof.lift + (solo ? 3 : 0) + 4, lo + 9, hi - 12);      // lead guitar: the singing register (around the 8th – 15th fret)
    const kl = ladder([an.key.root], lo, hi), tonic = kl[nearIdx(kl, center - 2)];
    const song = SDAW.store.song || {};
    const S = { ctx, an, R, hero, sec, lo, hi, center, key: an.key.root, minor: an.key.mode === 'minor', tonic, p: center, notes: [], motifs: {}, tempo: song.tempo || 110,
      emit(T, d, pitch, tech, x) { if (d > 0.01) this.notes.push(Object.assign({ T, d, pitch, tech: tech || {} }, x || {})); } };
    const cx = ctx.opts.complexity === undefined ? 0.5 : ctx.opts.complexity;
    const hot = solo || sec.type === 'chorus';
    const play = (tpl, k, off) => { let T = k * BAR + (off || 0); tpl.forEach(([g, len, o]) => { (G[g] || G.rest)(S, T, len, o || {}); T += len; }); };
    let lnNow = 0;
    const sig = () => R.pick(hero.stages && mode === 'solo' ? hero.stages[Math.min(lnNow, hero.stages.length - 1)] : hero.sig), peak = () => R.pick(hero.peak), fill = () => R.pick(hero.fill);
    // riff: a 2-bar phrase of the player, the same choices every time (re-seeded), following the chords
    const riffSeed = RU.hash(['legriff', id, sec.type, an.key.root].join('|')) ^ ctx.seed;
    const rr = RU.makeRand(riffSeed), riffA = rr.pick(hero.sig), riffB = [['hold', 8, { bend: 1 }]].concat(rr.pick(hero.fill));

    const lines = Math.ceil(sec.length / 4);
    for (let ln = 0; ln < lines; ln++) {
      lnNow = ln;
      const k0 = ln * 4, lastLine = ln === lines - 1, n = Math.min(4, sec.length - k0);
      S.p = center + (solo ? Math.min(ln, 2) * 2 : 0);
      for (let b = 0; b < n; b++) {
        const k = k0 + b, lastBar = b === n - 1, final = isLastSection && lastLine && lastBar;
        if (final) { play(LAND, k); continue; }
        if (mode === 'fills') {
          if (b % 2 === 1) play(b === 3 || R.chance(0.5) ? fill() : [['mel', 8, {}]], k, 8);
          continue;
        }
        if (mode === 'riff') {
          if (k % 2 === 0) { S.R = RU.makeRand(riffSeed ^ 0x51); S.p = center; }
          play(k % 2 === 0 && !(k === sec.length - 1) ? riffA : riffB, k);
          continue;
        }
        if (mode === 'solo') {
          let tpl;
          if (lastLine && lines > 1) tpl = b === 0 ? sig() : b === 3 ? [['run', 8, { dir: -1 }], ['hold', 8, { root: 1 }]] : peak();
          else if (ln === 0) tpl = b === 0 ? [['mel', 16, { motif: 'soloA' }]] : b === 1 ? (cx > 0.35 ? sig() : [['mel', 16, { motif: 'soloA', vary: 1 }]]) : b === 2 ? sig() : R.pick(BREATH);
          else tpl = lastBar ? (hero.sparse || R.chance(0.6) ? R.pick(BREATH) : sig()) : sig();
          if (lines === 1 && lastBar) tpl = [['run', 8, { dir: -1 }], ['hold', 8, { root: 1 }]];
          play(tpl, k);
          continue;
        }
        // theme: a tune for the section (A, A', B) + the player's answer
        const calm = sec.type === 'intro' || sec.type === 'outro';
        if (b === 0) play([['mel', 16, { motif: sec.type + 'A', slow: calm ? 1 : 0 }]], k);
        else if (b === 1) play(calm ? [['hold', 12, { bend: 1 }], ['rest', 4]] : [['mel', 16, { motif: sec.type + 'A', vary: 1 }]], k);
        else if (b === 2) play(hot && cx > 0.55 && ln % 2 === 1 ? sig() : [['mel', 16, { motif: sec.type + 'B' }]], k);
        else play(hot ? [['hold', 8, { bend: 1 }]].concat(fill()) : (calm || hero.sparse ? [['hold', 12, {}], ['rest', 4]] : [['hold', 8, { bend: 1 }], ['rest', 2], ['mel', 6, {}]]), k);
      }
    }
    return finish(S, ctx, sec, hot);
  };

  /** section notes → bars with strings / frets, velocities and valid techniques */
  function finish(S, ctx, sec, hot) {
    const tun = TUN(), bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], idx: k, role: 'legend', curated: true });
    const top = tun[5] + FRETS();
    S.notes.sort((a, b) => a.T - b.T || a.pitch - b.pitch);
    let hand = clamp(S.tonic - tun[2] + 2, 3, 15);
    const used = {}, lastOn = {};
    S.notes.forEach(n => {
      const k = Math.floor(n.T / BAR + 1e-6);
      if (k < 0 || k >= sec.length) return;
      let start = n.T - k * BAR;
      start = Math.abs(start - Math.round(start)) < 1e-6 ? Math.round(start) : Math.round(start * 1000) / 1000;
      let dur = Math.min(n.d, BAR - start);
      dur = Math.abs(dur - Math.round(dur)) < 1e-6 ? Math.round(dur) : Math.round(dur * 1000) / 1000;
      if (dur <= 0.01) return;
      let pitch = n.pitch, string = n.string, fret = n.fret;
      if (string === undefined) { while (pitch > top) pitch -= 12; while (pitch < tun[0]) pitch += 12; }
      const key = k + ':' + start, u = used[key] = used[key] || new Set();
      const tied = n.tech.h || n.tech.p || n.tech.slide === 'legato';
      if (string === undefined && tied) {
        // hammer-ons, pull-offs and legato slides stay on the string of the note they come from
        const s2 = Object.keys(lastOn).map(Number).find(st => !u.has(st) && Math.abs(lastOn[st].end - n.T) < 0.26 && pitch - tun[st] >= 0 && pitch - tun[st] <= FRETS() && lastOn[st].fret !== pitch - tun[st] && Math.abs(lastOn[st].fret - (pitch - tun[st])) <= 5);
        if (s2 !== undefined) { string = s2; fret = pitch - tun[s2]; }
      }
      if (string === undefined || u.has(string)) {
        const need = n.tech.bend >= 1 ? Math.max(hand, 5) : hand;
        let pos = SDAW.autoFret(pitch, u, need);
        if (pos && n.tech.bend >= 1 && pos.fret < 2) pos = SDAW.autoFret(pitch, new Set([...u, pos.string]), need) || pos;
        if (!pos) return;
        string = pos.string; fret = pos.fret;
      }
      u.add(string);
      if (!n.tech.harm && !n.tech.mute) hand = clamp(Math.round(hand * 0.6 + fret * 0.4), 2, 17);
      const tech = Object.assign({}, n.tech);
      // hammer-ons / pull-offs / taps need the previous note on the same string
      const from = lastOn[string], joined = from && from.fret !== fret && Math.abs(from.end - n.T) < 0.26;
      if ((tech.h || tech.p) && !joined) { delete tech.h; delete tech.p; }
      if (tech.slide === 'legato' && !joined) delete tech.slide;
      const strong = Number.isInteger(start) && start % 4 === 0;
      const vel = Math.round(clamp((ctx.baseVel || 90) + (strong ? 6 : 0) + (hot ? 6 : 0) + (n.acc || 0) + S.R.int(-4, 4), 28, 124));
      const out = { start, dur, pitch, vel, tech, string, fret };
      if (n.tup) out.tup = 3;
      bars[k].notes.push(out);
      lastOn[string] = { fret, end: n.T + n.d };
    });
    bars.forEach(b => b.notes.sort((x, y) => x.start - y.start || x.pitch - y.pitch));
    return bars;
  }

  /* ============================================================ RHYTHM == */
  L.RHYTHMS = {
    pedal: 'Pedal-tone riff + power chords (Rhoads / Wylde)', gallop: 'Metal gallop', octriff: 'Low riff + octaves (Morello)', vh: 'Triads over a muted pedal (Van Halen)',
    arpriff: 'Picked arpeggio riff (Slash)', hendrix: 'Chord + double-stop fills (Hendrix)', texas: 'Texas shuffle (Stevie Ray Vaughan)', delta: 'Delta blues: thumb bass + turnaround (Robert Johnson)',
    joepass: 'Walking bass + chords (Joe Pass)', funkline: 'Funk: muted 16ths, pops and 9th stabs',
    bassriff: 'Chords + bass-line riffs (Malcolm Young, Zeppelin)', stabs: 'Big chord stabs with space (AC/DC, the Who)',
    bandriff: 'Band riffs (the riffs of the band profile)',
    berry: 'Rock and roll boogie: 5th–6th (Chuck Berry)', sus4: 'Open chords with sus4 / sus2 moves (Keith Richards, Townshend)'
  };
  const shapes = {};
  function shapeOf(ch) {
    if (!shapes[ch.name]) shapes[ch.name] = SDAW.chordVoicing(ch.root, ch.intervals.slice(0, 4));
    const out = []; shapes[ch.name].forEach((f, s) => { if (f >= 0) out.push({ s, f, pitch: TUN()[s] + f }); });
    return out;
  }
  function lowRoot(root) { const tun = TUN(); let s = 0, f = mod12(root - tun[0]); if (f > 7) { s = 1; f = mod12(root - tun[1]); } return { s, f, pitch: tun[s] + f }; }
  function power(root) { const r = lowRoot(root), tun = TUN(); return [r, { s: r.s + 1, f: r.f + 2, pitch: tun[r.s + 1] + r.f + 2 }, { s: r.s + 2, f: r.f + 2, pitch: tun[r.s + 2] + r.f + 2 }]; }
  const PEDAL = { intro: 'O.......O...O.ff', verse: 'p.p.O.p.p.p.O.pp', pre: 'O.p.O.p.O.p.O.O.', chorus: 'O..O..O.p.pO..ff', solo: 'p.ppO.ppp.ppO.pp', bridge: 'O.......p.p.p.p.', outro: 'O.......O.......' };
  const GALLOP = { intro: 'O.......O.......', verse: 'O.ppp.ppp.ppp.pp', pre: 'O.ppO.ppO.ppO.pp', chorus: 'O.ppO.ppp.ppO.pp', solo: 'O.ppp.ppp.ppp.pp', bridge: 'O.......O.ppp.pp', outro: 'O.......O.......' };
  const VH = { intro: 'T.......S...T...', verse: 'T.ppS.ppT.ppS.T.', pre: 'T.S.T.S.T.S.T.pp', chorus: 'T..T..S.T.ppS.T.', solo: 'T.ppS.ppT.ppS.pp', bridge: 'T.......S.......', outro: 'T.......S...T...' };
  const OCT = ['x-x.x-xx-x-x.-X.x-x.x-xx-xx-X...', 'x.-xx.-x-x.x-X..x.-xx.-x-xx-X.x.', 'xx-x-xx-x.-xX.-.xx-x-xx-x-x-X...', 'x.x-.x.x-x-xX...x.x-.x.x-xx-xX.-'];
  const FUNK = ['m.mSm.n.m.mSm.nn', 'S.mmS.m.n.mSm.m.', 'm.nSm.mmS.m.n.mS', 'n.mSm.n.m.mS.mnn'];
  const pickT = (obj, type) => obj[type] || obj[{ pre: 'verse', solo: 'chorus', bridge: 'verse', intro: 'verse', outro: 'chorus', part: 'verse' }[type]] || obj.verse;
  const durTo = (str, i) => { let j = i + 1; while (j < str.length && str[j] === '.') j++; return j - i; };

  /** one bar of rhythm guitar (c = the bar context of songgen.js compBar) */
  L.rhythmBar = function (c, play) {
    const { ctx, bar, R, type } = c, an = ctx.an, tun = TUN(), out = [];
    const t0 = bar * BAR, vel0 = (ctx.baseVel || 84) - 8;
    const chAt = p => an.chordAt(t0 + p);
    const add = (p, len, list, vel, tech) => list.forEach((x, i) => { if (x && x.f >= 0 && x.f <= FRETS() && p < 16) out.push({ start: p, dur: Math.max(0.5, Math.min(len, 16 - p)), pitch: x.pitch, string: x.s, fret: x.f, vel: Math.round(clamp(vel - i * 1.5, 25, 122)), tech: Object.assign({}, tech || {}) }); });
    const at = (s, f) => ({ s, f, pitch: tun[s] + f });
    /** a pitch on a string near a fret (null when it does not fit) */
    const on = (pitch, near, avoid) => { const pos = SDAW.autoFret(pitch, avoid || null, near); return pos ? at(pos.string, pos.fret) : null; };
    const RU = U(), RS = RU.makeRand(ctx.seed ^ RU.hash('legrh|' + play + '|' + type));     // the same riff for every bar of a section type
    const keyRoot = an.key.root;

    switch (play) {
      case 'pedal': case 'gallop': {
        const str = pickT(play === 'pedal' ? PEDAL : GALLOP, type);
        const pedalKey = play === 'pedal' && (type === 'verse' || type === 'solo');
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (ch === '.') continue;
          const root = chAt(i).root, len = durTo(str, i);
          if (ch === 'O') add(i, len, power(root), vel0 + 12, {});
          else if (ch === 'p') add(i, Math.min(len, 2), [lowRoot(pedalKey ? keyRoot : root)], vel0 - 2 + (i % 4 === 0 ? 5 : 0), { pm: true });
          else if (ch === 'f') { const r = lowRoot(root), p = r.pitch + (str[i - 1] === 'f' ? 0 : (RS.chance(0.5) ? -2 : 3)), x = on(p, r.f, null); if (x) add(i, 1, [x], vel0 + 2, {}); }
        }
        break;
      }
      case 'vh': {
        const str = pickT(VH, type);
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (ch === '.') continue;
          const chord = chAt(i), len = durTo(str, i), r = lowRoot(chord.root);
          if (ch === 'p') { add(i, Math.min(len, 2), [r], vel0 - 4, { pm: true }); continue; }
          // T = the triad on the D-G-B strings; S = the IV triad over the same bass (sus movement)
          const minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
          const ivs = ch === 'T' ? [0, minor ? 3 : 4, 7] : [0, 5, minor ? 8 : 9];
          const pcs = ivs.map(x => mod12(chord.root + x)), list = [];
          [2, 3, 4].forEach(s => { for (let f = Math.max(0, r.f - 1 + (r.s ? 0 : 1)); f <= r.f + 6; f++) if (pcs.includes(mod12(tun[s] + f)) && !list.some(x => mod12(x.pitch) === mod12(tun[s] + f))) { list.push(at(s, f)); break; } });
          if (i === 0) add(i, Math.min(len, 4), [r], vel0 + 4, {});
          add(i, len, list, vel0 + 10, len <= 1 ? { stacc: true } : {});
        }
        if (type === 'chorus' && c.k % 4 === 3) { for (let j = out.length - 1; j >= 0; j--) if (out[j].start >= 14) out.splice(j, 1); add(14, 2, [at(3, 12), at(4, 12)], vel0, { harm: true }); }
        break;
      }
      case 'octriff': {
        // a 2-bar riff per section type, moved to the root of every chord
        const rh = RS.pick(OCT), degs = [];
        for (let i = 0; i < 32; i++) degs.push(i % 16 === 0 ? 0 : RS.weighted([[0, 4], [-2, 2], [3, 2], [5, 1.5], [6, 0.7], [7, 1.5], [10, 1]]));
        const half = (c.k % 2) * 16;
        for (let i = 0; i < 16; i++) {
          const ch = rh[half + i]; if (ch !== 'x' && ch !== 'X') continue;
          let len = 1; while (half + i + len < half + 16 && rh[half + i + len] === '.') len++;
          const r = lowRoot(chAt(i).root);
          if (ch === 'X') { add(i, len, [r, at(r.s + 2, r.f + 2)], vel0 + 14, {}); continue; }
          const x = on(r.pitch + degs[half + i], r.f, null);
          if (x) add(i, len, [x], vel0 + 4 + (i % 4 === 0 ? 5 : 0), len <= 1 ? { pm: true } : {});
        }
        break;
      }
      case 'arpriff': {
        // 8ths across the top strings of the chord; the highest note alternates with its upper neighbour
        const order = [0, 2, 3, 1, 3, 2, 3, 2];
        for (let e = 0; e < 8; e++) {
          const p = e * 2, chord = chAt(p), list = shapeOf(chord).slice(-4);
          if (!list.length) continue;
          let x = list[Math.min(list.length - 1, order[e])];
          if (e === 6 && x === list[list.length - 1]) { const sc = RU.localScale(an, chord); let f = x.f + 1; while (f < x.f + 4 && !sc.includes(mod12(tun[x.s] + f))) f++; if (f <= x.f + 3) x = at(x.s, f); }
          add(p, 2, [x], vel0 + (e % 4 === 0 ? 8 : 0) + (e === 0 ? 4 : 0), { ring: true });
        }
        if (c.k % 2 === 0) add(0, 4, [lowRoot(chAt(0).root)], vel0 + 4, {});
        break;
      }
      case 'hendrix': {
        const chord = chAt(0), list = shapeOf(chord), minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
        const dom = chord.intervals.includes(4) && chord.intervals.includes(10);
        if (dom && (type === 'chorus' || type === 'solo' || R.chance(0.4))) {
          // the 7#9 chord: root, 3rd, b7, #9
          const r = lowRoot(chord.root), rr = r.s === 0 ? on(r.pitch + 12, r.f + 2, null) : r;
          const v = rr ? [rr, at(rr.s + 1, rr.f - 1), at(rr.s + 2, rr.f), at(rr.s + 3, rr.f + 1)].filter(x => x.s <= 5 && x.f >= 0) : list;
          add(0, 3, v, vel0 + 10, { strum: 'down' });
        } else { add(0, 3, list.slice(0, 1), vel0 + 6, {}); add(0, 3, list.slice(1), vel0 + 2, { strum: 'down' }); }
        // fills: hammer-ons into chord tones from the pentatonic of the chord, on the middle strings
        const pl = ladder((minor ? SC.minPent : SC.majPent).map(x => mod12(chord.root + x)), 52, 76);
        const anchor = list.length ? list[Math.min(list.length - 1, 2)] : lowRoot(chord.root);
        let i = clamp(nearIdx(pl, anchor.pitch + 3), 0, pl.length - 4);
        [4, 8, 12].forEach(p => {
          const ch2 = chAt(p);
          if (ch2.name !== chord.name) { add(p, 4, shapeOf(ch2).slice(1), vel0 + 2, { strum: 'down' }); return; }
          const kind = R.pick(['A', 'A', 'B', 'C', 'U']);
          const a = on(pl[i], anchor.f + 1, null), b = on(pl[i + 1], anchor.f + 1, null);
          const upP = [pl[i + 2], pl[i + 3]].find(x => x - pl[i + 1] >= 3 && x - pl[i + 1] <= 5) || pl[i + 3];
          const up = b ? on(upP, anchor.f + 1, new Set([b.s])) : null;
          if (kind === 'U' || !a || !b) { add(p + 2, 1, list.slice(-3), vel0 - 6, { strum: 'up', stacc: true }); return; }
          if (kind === 'A') { add(p, 1, [at(b.s, Math.max(0, b.f - (pl[i + 1] - pl[i])))], vel0, {}); add(p + 1, 3, [b], vel0 - 4, { h: true }); if (up) add(p, 4, [up], vel0, {}); }
          else if (kind === 'B') { add(p, 2, [b].concat(up ? [up] : []), vel0 + 2, {}); add(p + 2, 2, [a], vel0 - 4, {}); }
          else { add(p, 1, [b], vel0, {}); const cN = on(pl[i + 2], anchor.f + 1, null); if (cN) add(p + 1, 1, [cN], vel0 - 4, cN.s === b.s ? { h: true } : {}); add(p + 2, 2, [b], vel0 - 4, cN && cN.s === b.s ? { p: true } : {}); }
          i = clamp(i + R.pick([-1, 0, 1]), 0, pl.length - 4);
        });
        break;
      }
      case 'texas': {
        // boogie line on the low strings (down-strokes, palm muted) + muted up-stroke "chick" on every off-beat
        const line = c.k % 2 ? [10, 9, 7, 4] : [0, 4, 7, 9];
        for (let q = 0; q < 4; q++) {
          const chord = chAt(q * 4), r = lowRoot(chord.root), minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
          let semi = line[q]; if (minor && semi === 4) semi = 3;
          const x = on(r.pitch + semi, r.f + 2, null);
          if (x) add(q * 4, 2, [x], vel0 + 6 + (q === 0 ? 4 : 0), { pm: true });
          const topS = shapeOf(chord).slice(-3);
          const stab = q === 1 && c.k % 2 === 0 || q === 3 && R.chance(0.35);
          add(q * 4 + 2, stab ? 2 : 1, topS, stab ? vel0 + 6 : vel0 - 26, stab ? { strum: 'up', stacc: true } : { strum: 'up', mute: true });
        }
        break;
      }
      case 'delta': {
        const chord = chAt(0), r = lowRoot(chord.root);
        const turn = c.lastBar && !c.finalBar;
        if (turn) {
          // turnaround: the high root stays while b7 – 6 – b6 – 5 walks down, then the V chord
          const hiRoot = on(r.pitch + 24, r.f + 3, null) || on(r.pitch + 12, r.f + 3, null);
          [10, 9, 8, 7].forEach((semi, q) => {
            const lowP = (hiRoot ? hiRoot.pitch : r.pitch + 12) - 12 + semi;
            const x = on(lowP, hiRoot ? hiRoot.f : r.f, hiRoot ? new Set([hiRoot.s]) : null);
            if (q < 3) { if (x) add(q * 4, 4, [x], vel0 + 4, {}); if (hiRoot) add(q * 4 + 2, 2, [hiRoot], vel0 - 2, {}); }
            else add(12, 4, shapeOf(an.chordAt(t0 + 12)).slice(0, 4), vel0 + 6, { strum: 'down' });
          });
          add(0, 2, [r], vel0 + 4, {});
          break;
        }
        for (let q = 0; q < 4; q++) {
          const ch2 = chAt(q * 4), r2 = lowRoot(ch2.root), up = q % 2 ? (c.k % 2 && q === 3 ? 5 : 4) : 2;       // 5th – 6th (– b7) shuffle
          add(q * 4, 4, [r2], vel0 + 4, { pm: true });                                                                // thumb
          const x = at(r2.s + 1, r2.f + up);
          add(q * 4, 2, [x], vel0, {}); add(q * 4 + 2, 2, [x], vel0 - 8, {});
        }
        if (c.k % 4 === 1) { const hiRoot = on(r.pitch + 24, r.f + 3, null); if (hiRoot) { add(8, 2, [hiRoot], vel0 + 2, { slide: 'inBelow' }); add(10, 2, [hiRoot], vel0 - 4, {}); } }
        break;
      }
      case 'joepass': {
        // one guitar = bass player + pianist: walking bass in quarter notes, shell chords (3rd + 7th) between
        const shell = ch => { const iv = ch.intervals, third = iv.includes(3) && !iv.includes(4) ? 3 : 4, sev = iv.includes(11) ? 11 : iv.includes(10) ? 10 : iv.includes(9) ? 9 : (third === 3 ? 10 : 11); return [third, sev]; };
        let prevB = ctx.legBass || null;
        for (let q = 0; q < 4; q++) {
          const ch = chAt(q * 4), nx = an.chordAt(t0 + q * 4 + 4), rootP = lowRoot(ch.root).pitch;
          let p;
          const newChord = q === 0 || chAt(q * 4 - 4).name !== ch.name;
          if (newChord) p = rootP;
          else if (nx.name !== ch.name || q === 3) { const target = lowRoot(nx.root).pitch; p = target + (R.chance(0.5) ? 1 : -1); if (p < tun[0]) p = target + 1; }
          else { const cands = [7, shell(ch)[0], 12].map(x => rootP + x).filter(x => x <= 57); p = R.pick(cands.length ? cands : [rootP]); if (p === prevB) p = rootP + 7; }
          const b = on(p, 3, null) || lowRoot(ch.root);
          add(q * 4, 4, [b], vel0 + 6, {});
          prevB = p;
          // chord stab on the "and" of beats 1 and 3 (Charleston feel), sometimes on beat 2 / 4
          if (q === 0 || q === 2 || R.chance(0.25)) {
            const [t3, t7] = shell(ch), used = new Set([b.s]);
            const lowT = [ch.root + t3, ch.root + t7].map(x => { let y = x; while (y < 50) y += 12; while (y > 62) y -= 12; return y; }).sort((a, b2) => a - b2);
            const n1 = on(lowT[0], b.f, used); if (n1) used.add(n1.s);
            const n2 = n1 ? on(lowT[1], n1.f, used) : null; if (n2) used.add(n2.s);
            const ninth = n2 && R.chance(0.5) ? on(n2.pitch + (mod12(ch.root + 14 - n2.pitch) || 12), n2.f, used) : null;
            add(q * 4 + 2, 2, [n1, n2, ninth && ninth.pitch - (n2 ? n2.pitch : 0) <= 7 ? ninth : null].filter(Boolean), vel0 - 4, { stacc: true });
          }
        }
        ctx.legBass = prevB;
        break;
      }
      case 'funkline': {
        const str = FUNK[(RS.int(0, FUNK.length - 1) + (type === 'chorus' ? 1 : 0)) % FUNK.length];
        for (let i = 0; i < 16; i++) {
          const ch = str[i]; if (ch === '.') continue;
          const chord = chAt(i), list = shapeOf(chord).slice(-3), minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
          const stroke = i % 2 ? 'up' : 'down';
          if (ch === 'm') add(i, 1, list, vel0 - 30, { mute: true, strum: stroke });
          else if (ch === 'S') {
            // 9th-chord colour on top: 3rd – b7 – 9
            const base = list[0] ? list[0].f : 5, pcs = [minor ? 3 : 4, 10, 14].map(x => mod12(chord.root + x)), v = [];
            [3, 4, 5].forEach(s => { for (let f = Math.max(0, base - 2); f <= base + 4; f++) if (pcs.includes(mod12(tun[s] + f)) && !v.some(x => mod12(x.pitch) === mod12(tun[s] + f))) { v.push(at(s, f)); break; } });
            add(i, 1, v.length >= 2 ? v : list, vel0 + 12, { stacc: true, strum: stroke });
          } else {
            const r = lowRoot(chord.root), x = on(r.pitch + 12 + RS.pick([0, 0, 10, 12, 7]), r.f + 2, null);
            if (x) add(i, 1, [x], vel0 + 4, { stacc: true });
          }
        }
        break;
      }
      case 'bassriff': {
        // a chord, then a single-note line on the low strings that walks to the next chord
        // (Malcolm Young / Led Zeppelin: rhythm guitar = chords + bass-line melodies). 2-bar figures per section.
        const FIG = ['C...C...n.n.nnn.', 'C.....n.n.n.n.n.', 'C..C..n.nn.n.n..', 'C...n.n.C...n.nn', 'C.......n.nnn.n.', 'C..n..n.C.n.n.n.'];
        const fig = FIG[(RS.int(0, FIG.length - 1) + (c.k % 2 ? 2 : 0)) % FIG.length];
        const chord = chAt(0), r = lowRoot(chord.root), minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
        const next = an.chordAt(t0 + 16), nr = lowRoot(next.root);
        const pent = (minor ? [0, 3, 5, 7, 10] : [0, 3, 4, 7, 9, 10]).map(x => r.pitch + x).concat([r.pitch + 12]);
        const slots = []; for (let i = 0; i < 16; i++) if (fig[i] === 'n') slots.push(i);
        // the line: up the pentatonic from the root, the last notes lead into the next chord's root
        const steps = RS.pick([[0, 1, 2, 3, 2, 1], [0, 2, 1, 2, 3, 4], [5, 4, 3, 2, 1, 0], [1, 2, 3, 4, 3, 2], [0, 1, 0, 2, 1, 3]]);
        slots.forEach((i, k) => {
          let p = pent[Math.min(pent.length - 1, steps[k % steps.length])];
          if (k === slots.length - 1 && next.root !== chord.root) p = nr.pitch + (nr.pitch > r.pitch ? -1 : 1) * RS.pick([1, 2]);
          const x = on(p, r.f + 1, null); if (x) add(i, durTo(fig, i) >= 2 ? 2 : 1, [x], vel0 + 4 + (i % 4 === 0 ? 4 : 0), durTo(fig, i) >= 2 ? {} : { stacc: true });
        });
        for (let i = 0; i < 16; i++) if (fig[i] === 'C') { const ch = chAt(i); add(i, durTo(fig, i), power(ch.root).concat(shapeOf(ch).slice(-2)).slice(0, 4), vel0 + 12, { strum: 'down' }); }
        break;
      }
      case 'stabs': {
        // big chords and SPACE: a hit, a push on an off-beat, silence (AC/DC, the Who); a pickup lick every 2nd bar
        const FIG = ['C.......c.c.C...', 'C.....C.C.......', 'C..c..c.C.......', 'C...c.....C.c.c.', 'C.......C..C..c.', 'C...........c.c.'];
        const fig = FIG[(RS.int(0, FIG.length - 1) + (type === 'chorus' ? 1 : 0) + (c.k % 2)) % FIG.length];
        for (let i = 0; i < 16; i++) {
          const ch2 = fig[i]; if (ch2 === '.') continue;
          const chord = chAt(i), list = power(chord.root).concat(shapeOf(chord).slice(-3)).filter((x, j, a) => a.findIndex(y => y.s === x.s) === j).slice(0, 5);
          if (ch2 === 'C') add(i, durTo(fig, i), list, vel0 + 14, { strum: 'down' });
          else add(i, 1, list, vel0 + 6, { strum: i % 2 ? 'up' : 'down', stacc: true });
        }
        if (c.k % 2 === 1 && !c.finalBar && fig.slice(12).indexOf('C') < 0) {
          // pickup: three notes of the pentatonic into the next bar (open-position flavour)
          const nr = lowRoot(an.chordAt(t0 + 16).root);
          [14, 15].forEach((i, k) => { if (out.some(n => n.start >= i)) return; const x = on(nr.pitch + (k ? -1 : -3), nr.f, null); if (x) add(i, 1, [x], vel0, {}); });
        }
        break;
      }
      case 'berry': {
        // Chuck Berry boogie: root + 5th / root + 6th (b7 on every 2nd bar's turn) on the low strings
        const chord = chAt(0), r = lowRoot(chord.root), five = at(r.s + 1, r.f + 2), six = at(r.s + 1, r.f + 4), sev = at(r.s + 1, r.f + 5);
        const tops = c.k % 2 && R.chance(0.6) ? [five, six, sev, six] : [five, six, five, six];
        for (let q = 0; q < 4; q++) {
          const ch = chAt(q * 4); if (ch.name !== chord.name) { const r2 = lowRoot(ch.root); add(q * 4, 2, [r2, at(r2.s + 1, r2.f + 2)], vel0 + 6, { pm: true }); add(q * 4 + 2, 2, [r2, at(r2.s + 1, r2.f + 4)], vel0, { pm: true }); continue; }
          const tp = tops[q];
          if (tp.f > FRETS()) continue;
          add(q * 4, 2, [r, tp === six || tp === sev ? five : five], vel0 + 6 + (q === 0 ? 4 : 0), { pm: true });
          add(q * 4 + 2, 2, [r, tp], vel0, { pm: true });
        }
        break;
      }
      case 'sus4': {
        // open chords with sus4 / sus2 moves inside (Keith Richards, Pete Townshend): strum – sus – back
        const FIG = ['C..S.C..C..2.C..', 'C...S.C.C...2.C.', 'C.S.C...C.2.C...', 'C..C..S.C..C..2.'];
        const fig = FIG[(RS.int(0, FIG.length - 1) + c.k) % FIG.length];
        for (let i = 0; i < 16; i++) {
          const ch2 = fig[i]; if (ch2 === '.') continue;
          const chord = chAt(i), list = shapeOf(chord), minor = chord.intervals.includes(3) && !chord.intervals.includes(4);
          let v = list;
          if (ch2 !== 'C') {
            const third = mod12(chord.root + (minor ? 3 : 4)), to = ch2 === 'S' ? (minor ? 2 : 1) : (minor ? -1 : -2);
            v = list.map(x => mod12(x.pitch) === third && x.f + to >= 0 ? at(x.s, x.f + to) : x);
          }
          add(i, durTo(fig, i), v, vel0 + (ch2 === 'C' ? 10 : 4), { strum: i % 2 ? 'up' : 'down' });
        }
        break;
      }
      case 'bandriff': {
        /* The riffs of a band profile (bands.js → spec.riffs[section] = list of riffs; a riff = 1, 2 or 4 bars
         * separated by "|"; one token = "pos:what:len" + flags):
         *   what   a number = a single note that many semitones above the chord root (low strings); k + number = above
         *          the KEY root (pedal riffs keep their note while the chords change)
         *          C = power chord (root, 5th, octave) · c = root + 5th · O = the full open chord · T = triad on the
         *          D-G-B strings · S = the same triad with the 4th (sus4) · C+2 / c-2 = power chord moved by semitones
         *   flags  p palm mute · x dead note · h hammer-on · s slide in · a accent · . staccato · r let ring · v vibrato
         * The idea (seed) picks ONE riff per section type: it is the hook of the song, so it repeats. */
        const RF = c.spec.riffs || {}, FB = { pre: 'verse', solo: 'chorus', bridge: 'verse', intro: 'verse', outro: 'chorus', part: 'verse' };
        const rkey = RF[type] ? type : RF[FB[type]] ? FB[type] : 'verse', all = RF[rkey];
        if (!all || !all.length) return null;
        // intro = the verse riff (the riff opens the song); one riff per guitar and section
        const RB = RU.makeRand(ctx.seed ^ RU.hash('bandriff|' + (c.spec.id || '') + '|' + rkey));
        const riff = RB.pick(all).split('|').map(x => x.trim()), barStr = riff[c.k % riff.length];
        barStr.split(/\s+/).filter(Boolean).forEach(tok => {
          const m = /^(\d+(?:\.\d+)?):(k?-?\d+|[CcOTS](?:[+-]\d+)?):(\d+(?:\.\d+)?)([a-z.]*)$/.exec(tok); if (!m) return;
          const p = +m[1], what = m[2], len = +m[3], fl = m[4] || '';
          const chord = chAt(Math.min(15, Math.floor(p)));
          const tech = {};
          if (fl.includes('p')) tech.pm = true; if (fl.includes('x')) tech.mute = true; if (fl.includes('h')) tech.h = true;
          if (fl.includes('s')) tech.slide = 'inBelow'; if (fl.includes('.')) tech.stacc = true; if (fl.includes('r')) tech.ring = true; if (fl.includes('v')) tech.vib = true;
          const acc = fl.includes('a') ? 8 : 0, strong = p % 4 === 0 ? 4 : 0;
          if (/^[Cc]/.test(what)) {
            const sh = parseInt(what.slice(1), 10) || 0, pw = power(mod12(chord.root + sh));
            add(p, len, what[0] === 'c' ? pw.slice(0, 2) : pw, vel0 + (tech.pm ? 0 : 10) + acc + strong, tech);
          } else if (what === 'O') add(p, len, shapeOf(chord), vel0 + 8 + acc + strong, Object.assign({ strum: Math.round(p) % 4 === 2 ? 'up' : 'down' }, tech));
          else if (what === 'T' || what === 'S') {
            const minor = chord.intervals.includes(3) && !chord.intervals.includes(4), r = lowRoot(chord.root);
            const pcs = (what === 'T' ? [0, minor ? 3 : 4, 7] : [0, 5, 7]).map(x => mod12(chord.root + x)), list = [];
            [2, 3, 4].forEach(s2 => { for (let f = Math.max(0, r.f); f <= r.f + 7; f++) if (pcs.includes(mod12(tun[s2] + f)) && !list.some(x => mod12(x.pitch) === mod12(tun[s2] + f))) { list.push(at(s2, f)); break; } });
            add(p, len, list, vel0 + 8 + acc + strong, tech);
          } else {
            const key = what[0] === 'k', r = lowRoot(key ? keyRoot : chord.root);
            let deg = parseInt(key ? what.slice(1) : what, 10);
            // minor chord (or minor key for pedal notes): the major 3rd of a riff becomes the 4th after a hammer-on, else the minor 3rd
            const minorHere = key ? an.key.mode === 'minor' : (chord.intervals.includes(3) && !chord.intervals.includes(4));
            if (minorHere && mod12(deg) === 4) deg += tech.h ? 1 : -1;
            const x = on(r.pitch + deg, Math.max(r.f, 2), null);
            if (x) add(p, len, [x], vel0 + (tech.pm ? -2 : 4) + acc + strong, tech);
          }
        });
        break;
      }
      default: return null;
    }
    return out;
  };
})(window.SDAW);
