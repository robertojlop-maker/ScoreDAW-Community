/* =============================================================================
 *  UTIL.JS — small helpers + music theory shared by every module
 *  -----------------------------------------------------------------------------
 *  Everything is attached to window.SDAW (ScoreDAW namespace) so the
 *  app works by simply opening index.html (no build step, no ES modules).
 * ============================================================================= */

window.SDAW = window.SDAW || {};
// Old name of the program (Lemon Score Studio): sound packs built before the rename call LSS.factory…
window.LSS = window.SDAW;

/* One-time migration of the settings saved under the old name (lss.* → scoredaw.*) */
(function migrateStorage() {
  try {
    if (localStorage.getItem('scoredaw.migrated')) return;
    const pairs = [['lemonScoreStudio.autosave', 'scoreDAW.autosave'], ['lemonScoreStudio.autosave.idb', 'scoreDAW.autosave.idb']];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('lss.')) pairs.push([k, 'scoredaw.' + k.slice(4)]); }
    pairs.forEach(([from, to]) => { const v = localStorage.getItem(from); if (v !== null && localStorage.getItem(to) === null) localStorage.setItem(to, v); });
    localStorage.setItem('scoredaw.migrated', '1');
  } catch (e) { /* storage not available */ }
})();

(function (SDAW) {
  'use strict';

  /* ------------------------------------------------------------ DOM ---- */
  /** Query one element */
  SDAW.$ = (sel, root) => (root || document).querySelector(sel);
  /** Query many elements (as array) */
  SDAW.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /**
   * Create an element quickly.
   * el('div', {class:'x', onclick: fn, 'data-help':'...'}, [children | 'text'])
   */
  SDAW.el = function (tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  };

  /** Create an SVG element */
  SDAW.svg = function (tag, attrs, children) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  /* --------------------------------------------------------- MATH ---- */
  SDAW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SDAW.uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  SDAW.deepCopy = (o) => JSON.parse(JSON.stringify(o));

  /** Debounce helper (used for autosave and resize) */
  SDAW.debounce = function (fn, ms) {
    let t = null;
    return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); };
  };

  /* ------------------------------------------------------ EVENTS ---- */
  /** Tiny event bus: SDAW.bus.on('change', fn); SDAW.bus.emit('change', data) */
  SDAW.bus = {
    _h: {},
    on(evt, fn) { (this._h[evt] = this._h[evt] || []).push(fn); },
    emit(evt, data) { (this._h[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(evt, e); } }); }
  };

  /* -------------------------------------------------- MUSIC THEORY ---- */
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  SDAW.NOTE_NAMES = NOTE_NAMES;
  SDAW.FLAT_NAMES = FLAT_NAMES;

  /** Scales available in the fretboard / piano overlays */
  SDAW.SCALES = {
    'Major':            [0, 2, 4, 5, 7, 9, 11],
    'Natural Minor':    [0, 2, 3, 5, 7, 8, 10],
    'Major Pentatonic': [0, 2, 4, 7, 9],
    'Minor Pentatonic': [0, 3, 5, 7, 10],
    'Blues':            [0, 3, 5, 6, 7, 10],
    'Dorian':           [0, 2, 3, 5, 7, 9, 10],
    'Mixolydian':       [0, 2, 4, 5, 7, 9, 10],
    'Harmonic Minor':   [0, 2, 3, 5, 7, 8, 11],
    'Melodic Minor':    [0, 2, 3, 5, 7, 9, 11],
    'Lydian':           [0, 2, 4, 6, 7, 9, 11],
    'Phrygian Dominant':[0, 1, 4, 5, 7, 8, 10],
    'Bebop Dominant':   [0, 2, 4, 5, 7, 9, 10, 11],
    'Major Blues':      [0, 2, 3, 4, 7, 9]
  };

  /** Chord formulas (semitones from root) for the Chord Builder */
  SDAW.CHORDS = {
    '':     [0, 4, 7],
    'm':    [0, 3, 7],
    '7':    [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'm7':   [0, 3, 7, 10],
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
    'dim':  [0, 3, 6],
    'aug':  [0, 4, 8],
    '6':    [0, 4, 7, 9],
    'm6':   [0, 3, 7, 9],
    'add9': [0, 4, 7, 14],
    '9':    [0, 4, 7, 10, 14],
    'm9':   [0, 3, 7, 10, 14],
    'maj9': [0, 4, 7, 11, 14],
    '13':   [0, 4, 7, 10, 21],
    '7sus4':[0, 5, 7, 10],
    'm7b5': [0, 3, 6, 10],
    'dim7': [0, 3, 6, 9],
    '7b9':  [0, 4, 7, 10, 13],
    // jazz colours (endings, reharmonisation): 6/9 is written "69" (a "/" would read as a bass note)
    '69':      [0, 4, 7, 9, 14],
    'm69':     [0, 3, 7, 9, 14],
    'maj7#11': [0, 4, 7, 11, 18],
    'maj13':   [0, 4, 7, 11, 14, 21],
    'mMaj7':   [0, 3, 7, 11],
    '7#9':     [0, 4, 7, 10, 15],
    '9#11':    [0, 4, 7, 10, 14, 18]
  };

  SDAW.midiToName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  SDAW.midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  SDAW.noteIndex = (name) => { let i = NOTE_NAMES.indexOf(name); if (i < 0) i = FLAT_NAMES.indexOf(name); return i; };
  SDAW.isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

  /* ------------------------------------------------ time signature ---
   * 1 tick = one 16th note. song.timeSig = [num, den] (default [4, 4]).
   *   bar  = num * 16 / den ticks   (3/4 = 12, 6/8 = 12, 7/8 = 14, 12/8 = 24)
   *   beat = a quarter (den 4) · a dotted quarter in 6/8, 9/8, 12/8 · an
   *          eighth in 3/8, 5/8, 7/8 (the metronome clicks on each beat)  */
  SDAW.TIME_SIGS = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [9, 8], [12, 8]];
  SDAW.timeSig = function (song) {            // song.timeSig is stored as [num, den]
    const s = song || (SDAW.store && SDAW.store.song), ts = s && s.timeSig;
    const num = ts && +ts[0], den = ts && +ts[1];
    return num > 0 && num <= 16 && (den === 4 || den === 8 || den === 2) ? { num, den } : { num: 4, den: 4 };
  };
  SDAW.barTicks = (song) => { const ts = SDAW.timeSig(song); return ts.num * 16 / ts.den; };
  SDAW.beatTicks = (song) => { const ts = SDAW.timeSig(song); return ts.den === 8 ? (ts.num % 3 === 0 && ts.num > 3 ? 6 : 2) : 16 / ts.den; };
  SDAW.isCompound = (song) => { const ts = SDAW.timeSig(song); return ts.den === 8 && ts.num % 3 === 0 && ts.num > 3; };
  SDAW.is44 = (song) => SDAW.barTicks(song) === 16 && SDAW.timeSig(song).den === 4;
  /** "Bar 3.2.1" style position text for a tick */
  SDAW.posText = function (t) {
    const B = SDAW.barTicks(), bt = SDAW.beatTicks();
    const inBar = ((t % B) + B) % B;
    return (Math.floor(t / B) + 1) + '.' + (Math.floor(inBar / bt) + 1) + '.' + (Math.floor(inBar % bt) + 1);
  };
  /** Bar number (1-based, decimals for positions inside the bar) */
  SDAW.barText = (t) => { const B = SDAW.barTicks(); return (t / B + 1).toFixed(t % B ? 2 : 0); };

  /** Pitch classes (0..11) of a scale in a key */
  SDAW.scalePCs = function (keyName, scaleName) {
    const root = SDAW.noteIndex(keyName);
    return (SDAW.SCALES[scaleName] || SDAW.SCALES.Major).map(i => (root + i) % 12);
  };

  /**
   * Parse a chord symbol like "Am7", "F#sus4" or a slash chord "C/E", "Am7/G".
   * Returns { root, type, name, intervals, bass } — bass = pitch class of the
   * bass note of a slash chord (absent for plain chords).
   */
  SDAW.parseChord = function (sym) {
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec((sym || '').trim());
    if (!m) return null;
    const root = SDAW.noteIndex(m[1]);
    const type = SDAW.CHORDS[m[2]] !== undefined ? m[2] : '';
    const out = { root, type, name: m[1] + type + (m[3] ? '/' + m[3] : ''), intervals: SDAW.CHORDS[type] };
    if (m[3]) { const b = SDAW.noteIndex(m[3]); if (b >= 0 && b !== root) out.bass = b; }
    return out;
  };

  /**
   * Diatonic triad for a scale degree (1..7) of the song key.
   * Returns { name, root, intervals }
   */
  SDAW.diatonicChord = function (keyName, scaleMode, degree) {
    const steps = scaleMode === 'minor' ? SDAW.SCALES['Natural Minor'] : SDAW.SCALES.Major;
    const root = SDAW.noteIndex(keyName);
    const d = (degree - 1) % 7;
    const r = (root + steps[d]) % 12;
    const third = (steps[(d + 2) % 7] - steps[d] + 12) % 12;
    const fifth = (steps[(d + 4) % 7] - steps[d] + 12) % 12;
    let type = '';
    if (third === 3 && fifth === 7) type = 'm';
    else if (third === 3 && fifth === 6) type = 'dim';
    else if (third === 4 && fifth === 8) type = 'aug';
    return { name: NOTE_NAMES[r] + type, root: r, type, intervals: SDAW.CHORDS[type] };
  };

  /** Roman numeral label for a degree in major / minor */
  SDAW.romanFor = function (scaleMode, degree) {
    const maj = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const min = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    return (scaleMode === 'minor' ? min : maj)[(degree - 1) % 7];
  };

  /* ---------------------------------------------- GUITAR HELPERS ---- */

  /**
   * Choose the best string / fret for a pitch.
   * avoidStrings = set of string indexes already used at that time (chords)
   * Strings are indexed 0 (low E, 6th string) .. 5 (high E, 1st string).
   * Prefers the lowest fret position within 0..12, then any position.
   */
  SDAW.autoFret = function (pitch, avoidStrings, nearFret) {
    const tuning = CONFIG.guitar.tuning;
    let best = null;
    for (let s = 0; s < tuning.length; s++) {
      if (avoidStrings && avoidStrings.has(s)) continue;
      const fret = pitch - tuning[s];
      if (fret < 0 || fret > CONFIG.guitar.frets) continue;
      // score: stay near the hand position if given, otherwise lowest fret
      const ref = (nearFret === undefined || nearFret === null) ? 0 : nearFret;
      const score = Math.abs(fret - ref) + (fret > 12 ? 6 : 0);
      if (!best || score < best.score) best = { string: s, fret, score };
    }
    return best ? { string: best.string, fret: best.fret } : null;
  };

  /**
   * Find a playable guitar voicing for a chord.
   * Returns array of 6 entries: fret number, or -1 for a muted string.
   * Algorithm: for each 4-fret window, pick on every string the lowest fret
   * that is a chord tone; the lowest sounding string must be the root;
   * strings below it are muted. Best = most strings, all chord tones present,
   * lowest window.
   */
  SDAW.chordVoicing = function (rootPC, intervals) {
    const tuning = CONFIG.guitar.tuning;
    const pcs = new Set(intervals.map(i => (rootPC + i) % 12));
    let best = null;
    for (let w = 0; w <= 9; w++) {
      const frets = [];
      for (let s = 0; s < 6; s++) {
        let pick = -1;
        // open position: open strings first; higher windows: fretted notes first (barre shapes)
        const candidates = [];
        for (let f = Math.max(1, w); f <= w + CONFIG.guitar.maxChordSpan - 1; f++) candidates.push(f);
        if (w === 0) candidates.unshift(0); else candidates.push(0);
        for (const f of candidates) {
          if (pcs.has((tuning[s] + f) % 12)) { pick = f; break; }
        }
        frets.push(pick);
      }
      // mute strings until the first root
      let first = frets.findIndex((f, s) => f >= 0 && (tuning[s] + f) % 12 === rootPC);
      if (first < 0 || first > 2) continue;
      for (let s = 0; s < first; s++) frets[s] = -1;
      const used = new Set(frets.map((f, s) => f >= 0 ? (tuning[s] + f) % 12 : null).filter(x => x !== null));
      const allTones = [...pcs].every(pc => used.has(pc) || (pcs.size > 3 && pc === (rootPC + 7) % 12));
      const count = frets.filter(f => f >= 0).length;
      const score = (allTones ? 100 : 0) + count * 10 - w;
      if (!best || score > best.score) best = { frets, score };
    }
    return best ? best.frets : [-1, -1, -1, -1, -1, -1];
  };

  /** Format seconds as mm:ss.mmm */
  SDAW.formatTime = function (sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), ms = Math.floor((sec % 1) * 1000);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
  };

})(window.SDAW);
