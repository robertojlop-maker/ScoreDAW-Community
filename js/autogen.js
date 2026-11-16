/* =============================================================================
 *  AUTOGEN.JS — "Auto Generate": intelligent melody / harmony / bass / drums
 *  -----------------------------------------------------------------------------
 *  Reads the whole song, understands it, and writes a new part for the
 *  selected track — bar by bar, as editable patterns.
 *
 *  PIPELINE
 *  ========
 *   1. ANALYSIS  (AG.analyze)
 *      a. Material      every note and drum hit of the song (except the target track)
 *      b. Key           Krumhansl-Kessler key profiles over a duration-weighted
 *                       pitch-class histogram (+ chord symbols), compared with
 *                       the key written in the song
 *      c. Harmony       one chord per half bar: chord symbols when present,
 *                       otherwise template matching (triads, 7ths, sus, dim)
 *                       weighted by duration, velocity and the bass note
 *      d. Rhythm        16-step accent profile from kick, snare, hats and the
 *                       onsets of the other instruments, syncopation, 16th feel,
 *                       density, energy of every bar
 *      e. Form          the song sections (Intro, Verse, Chorus, Bridge, Outro…);
 *                       when the song has none they are detected from repeated
 *                       4-bar chord blocks and the energy of each block
 *      f. Check         structure warnings (no intro, no ending, open final chord…)
 *
 *   2. PLAN  every section gets a PROFILE (energy, density, register lift,
 *      rests, comping style). Sections are split into 4-bar PHRASES:
 *        bar 1 statement · bar 2 answer · bar 3 development · bar 4 cadence
 *      The first phrase ends OPEN (half cadence), the last one CLOSED (tonic).
 *      Every section TYPE has its own THEME (motif) so all choruses share the
 *      same melody, and the Intro / Outro quote the chorus theme.
 *
 *   3. GENERATE per role
 *      Melody         motif rhythm from the accent profile, contour random walk
 *                     (steps preferred, leaps resolved), arch toward a climax,
 *                     chord tones on strong beats, scale tones on weak beats,
 *                     cadence notes, optional guitar techniques (H / P / slide /
 *                     bend / vibrato)
 *      Counter-melody lower and sparser, fills the gaps of the lead line and
 *                     harmonizes in 3rds / 6ths when both sound together
 *      Harmony        voice-led chord voicings (minimum movement between chords)
 *                     with a comping rhythm per section (pad, light, push, full, arpeggio)
 *      Guitar strum   playable chord shapes with down / up strokes from the groove
 *      Arpeggio       broken chords (8ths or 16ths by energy)
 *      Bass           roots locked to the kick drum, fifths / octaves, approach
 *                     notes into every chord change
 *      Drums          groove variations per section, crashes on section starts,
 *                     fills on the last bar of every section
 *
 *   4. WRITE  one PATTERN per bar. Bars with identical music share the same
 *      pattern (linked): edit it once and every repeat changes; use
 *      "Make unique" on a clip to change only one. Everything is one undo step.
 *
 *  Randomness is SEEDED: the same seed + the same song = the same result.
 *  Change the seed (🎲) to get a new idea.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const BAR = 16;
  const AG = {};
  SDAW.autogen = AG;

  /* ================================================================ CONFIG == */
  AG.CONFIG = {
    slotTicks: 8,              // harmonic analysis resolution: half a bar
    phraseBars: 4,             // musical phrase length
    blockBars: 4,              // block size for automatic section detection
    // metric weight of every 16th of a 4/4 bar (beat 1 strongest, then 3, 2 / 4)
    metric: [1, .12, .3, .12, .65, .12, .3, .12, .85, .12, .3, .12, .65, .12, .3, .14],
    // pitch ranges (MIDI) per role and instrument type
    ranges: {
      melody:  { guitar: [57, 84], synth: [60, 86], keys: [60, 86], strings: [60, 88], bass: [40, 62] },
      counter: { guitar: [52, 76], synth: [52, 76], keys: [52, 76], strings: [50, 74], bass: [36, 55] },
      harmony: { guitar: [48, 76], synth: [50, 79], keys: [50, 79], strings: [48, 81], bass: [36, 60] },
      bass: [28, 55]
    },
    // section profiles: energy (velocity), density (notes), lift (register in
    // semitones), rest (chance of breathing), comp (harmony rhythm), move (bass motion)
    profiles: {
      intro:  { energy: .38, density: .32, lift: -2, rest: .45, comp: 'pad',   move: .2 },
      verse:  { energy: .55, density: .5,  lift: 0,  rest: .25, comp: 'light', move: .4 },
      pre:    { energy: .7,  density: .6,  lift: 3,  rest: .2,  comp: 'push',  move: .5 },
      chorus: { energy: .9,  density: .7,  lift: 5,  rest: .12, comp: 'full',  move: .65 },
      bridge: { energy: .62, density: .45, lift: 2,  rest: .3,  comp: 'arp',   move: .45 },
      solo:   { energy: .95, density: .9,  lift: 7,  rest: .08, comp: 'full',  move: .6 },
      outro:  { energy: .42, density: .3,  lift: 0,  rest: .4,  comp: 'pad',   move: .2 },
      part:   { energy: .55, density: .5,  lift: 0,  rest: .25, comp: 'light', move: .4 }
    },
    sectionColors: { intro: '#9b5cff', verse: '#3fa9ff', pre: '#36f1cd', chorus: '#2bdc7a', bridge: '#ffb02e', solo: '#ff4fd8', outro: '#ff6b6b', part: '#8a8cc8' },
    roles: [
      ['auto', 'Auto (from the track)'], ['melody', 'Melody (lead line)'], ['counter', 'Counter-melody'], ['horns', 'Horn riffs (call & response)'],
      ['harmony', 'Harmony (chords / pad)'], ['strum', 'Guitar strumming'], ['arp', 'Arpeggio'],
      ['bass', 'Bass line'], ['drums', 'Drums']
    ]
  };
  const C = AG.CONFIG;

  /* ============================================================ UTILITIES == */
  const mod12 = n => ((n % 12) + 12) % 12;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Seeded random generator (mulberry32) with musical helpers */
  function makeRand(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return {
      next, chance: p => next() < p, range: (x, y) => x + next() * (y - x), int: (x, y) => Math.floor(x + next() * (y - x + 1)),
      pick: arr => arr[Math.floor(next() * arr.length)],
      weighted(items) { const tot = items.reduce((s, it) => s + it[1], 0); let r = next() * tot; for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; } return items[items.length - 1][0]; }
    };
  }
  /** Stable hash of a string (seeds derived from musical context) */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pearson(x, y) {
    const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  }
  const normalize = arr => { const m = Math.max(...arr, 1e-9); return arr.map(v => v / m); };

  /* ========================================================== 1. ANALYSIS == */

  /** a. All notes and drum hits of the song (absolute ticks) */
  function collect(song, excludeId) {
    const s = SDAW.store, notes = [], drumHits = [];
    song.tracks.forEach(t => {
      if (t.id === excludeId) return;
      if (t.type === 'drums') {
        t.clips.forEach(c => {
          if (c.kind !== 'pattern') return;
          const p = s.pattern(c.patternId);
          if (!p || p.kind !== 'drums' || !p.length) return;
          const L = p.length, o = c.offsetTicks || 0;
          for (let k = 0; k < c.len; k++) SDAW.DRUM_ROWS.forEach(r => { const row = p.drum.rows[r.id]; const v = row && row[(k + o) % L]; if (v > 0) drumHits.push({ tick: c.start + k, row: r.id, v }); });
        });
        return;
      }
      s.trackNotes(t).forEach(n => notes.push({ start: n.start, dur: n.dur, pitch: n.pitch, vel: n.vel || 100, trackId: t.id, type: t.type }));
    });
    return { notes, drumHits };
  }

  /** b. Key detection (Krumhansl-Kessler) */
  const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function detectKey(song, mat) {
    const h = new Array(12).fill(0);
    mat.notes.forEach(n => { h[mod12(n.pitch)] += n.dur * (n.vel / 100) * (n.type === 'bass' ? 1.5 : 1); });
    (song.chords || []).forEach(c => { const p = SDAW.parseChord(c.name); if (p) p.intervals.forEach((iv, i) => { h[mod12(p.root + iv)] += i === 0 ? 3 : 2; }); });
    const songRoot = Math.max(0, SDAW.noteIndex(song.key)), songMode = song.scale === 'minor' ? 'minor' : 'major';
    const total = h.reduce((a, b) => a + b, 0);
    if (total < 1) return { root: songRoot, mode: songMode, confidence: 0, source: 'song (no notes yet)' };
    // a key chosen on purpose (Auto Generate Full Song, or set on the toolbar) is trusted:
    // jazz changes full of secondary dominants (iii–VI–ii–V) would otherwise fool the detection
    if (song.keyFixed) return { root: songRoot, mode: songMode, confidence: 1, source: 'song key' };
    const cands = [];
    for (let r = 0; r < 12; r++) {
      const x = h.map((_, i) => h[(i + r) % 12]);
      cands.push({ root: r, mode: 'major', score: pearson(x, KK_MAJ) }, { root: r, mode: 'minor', score: pearson(x, KK_MIN) });
    }
    cands.sort((a, b) => b.score - a.score);
    let best = cands[0];
    // relative major / minor tie: the first / last chord or bass note decides
    const second = cands[1];
    if (best.score - second.score < 0.04 && mod12(second.root - best.root) % 3 === 0 && second.mode !== best.mode) {
      const firstSym = (song.chords || [])[0], lastSym = (song.chords || []).slice(-1)[0];
      const anchor = lastSym ? SDAW.parseChord(lastSym.name) : firstSym ? SDAW.parseChord(firstSym.name) : null;
      if (anchor && anchor.root === second.root) best = second;
    }
    const songC = cands.find(c => c.root === songRoot && c.mode === songMode);
    let source = 'detected from the notes';
    if (songC && best.score - songC.score < 0.06) { best = songC; source = 'song key (confirmed by the notes)'; }
    const runner = cands.find(c => c !== best);
    return { root: best.root, mode: best.mode, confidence: clamp((best.score - runner.score) * 6 + best.score * 0.4, 0, 1), source };
  }

  /** c. Harmony: one chord per slot (half bar) */
  const TEMPLATES = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['dim', [0, 3, 6]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]]];
  function chordObj(root, type, source, bass) {
    const intervals = SDAW.CHORDS[type] || SDAW.CHORDS[''];
    const c = { root, type, intervals, pcs: intervals.map(i => mod12(root + i)), name: SDAW.NOTE_NAMES[root] + type, source };
    if (bass !== undefined && bass !== null && bass !== root) { c.bass = bass; c.name += '/' + SDAW.NOTE_NAMES[bass]; }   // slash chord (C/E)
    return c;
  }
  function detectChords(song, mat, key, bars) {
    const S = C.slotTicks, n = Math.ceil(bars * BAR / S), out = new Array(n).fill(null);
    const syms = (song.chords || []).slice().sort((a, b) => a.tick - b.tick);
    const scale = scalePCs(key);
    for (let i = 0; i < n; i++) {
      const t0 = i * S, t1 = t0 + S;
      // 1) a chord symbol that covers most of the slot
      let sym = null;
      for (const c of syms) { if (c.tick < t0 + S / 2) sym = c; else break; }
      if (sym) { const p = SDAW.parseChord(sym.name); if (p) { out[i] = chordObj(p.root, p.type, 'symbol', p.bass); continue; } }
      // 2) template matching on the notes that sound in the slot
      const w = new Array(12).fill(0); let low = null, sum = 0;
      mat.notes.forEach(nt => {
        const ov = Math.min(t1, nt.start + nt.dur) - Math.max(t0, nt.start);
        if (ov <= 0) return;
        const v = ov * (nt.vel / 100) * (nt.type === 'bass' ? 1.4 : 1);
        w[mod12(nt.pitch)] += v; sum += v;
        if (!low || nt.pitch < low.pitch) low = nt;
      });
      if (sum < 0.5) continue;
      let best = null;
      for (let r = 0; r < 12; r++) for (const [type, ivs] of TEMPLATES) {
        const pcs = ivs.map(x => mod12(r + x));
        let inT = 0; pcs.forEach(pc => { inT += w[pc]; });
        const outT = sum - inT;
        const missing = pcs.filter(pc => w[pc] === 0).length;
        let score = inT - 0.65 * outT - missing * 0.12 * sum / pcs.length;
        if (low && mod12(low.pitch) === r) score += 0.25 * sum;
        if (pcs.every(pc => scale.includes(pc))) score += 0.1 * sum;
        if (ivs.length === 4) score -= 0.06 * sum;
        if (type.startsWith('sus') || type === 'dim') score -= 0.08 * sum;
        if (!best || score > best.score) best = { r, type, score };
      }
      // an inversion (the lowest note is another chord tone) becomes a slash chord: C/E
      const lowPc = low ? mod12(low.pitch) : null;
      const inv = lowPc !== null && lowPc !== best.r && TEMPLATES.find(x => x[0] === best.type)[1].some(iv => mod12(best.r + iv) === lowPc);
      out[i] = chordObj(best.r, best.type, 'detected', inv ? lowPc : null);
    }
    // fill empty slots: forward, then backward, then a default progression
    for (let i = 1; i < n; i++) if (!out[i] && out[i - 1]) out[i] = Object.assign({}, out[i - 1], { source: out[i - 1].source === 'default' ? 'default' : 'held' });
    for (let i = n - 2; i >= 0; i--) if (!out[i] && out[i + 1]) out[i] = Object.assign({}, out[i + 1], { source: 'held' });
    if (!out[0]) {
      const degs = key.mode === 'minor' ? [1, 6, 3, 7] : [1, 5, 6, 4];
      const keyName = SDAW.NOTE_NAMES[key.root];
      for (let i = 0; i < n; i++) { const bar = Math.floor(i * S / BAR); const d = SDAW.diatonicChord(keyName, key.mode, degs[bar % 4]); out[i] = chordObj(d.root, d.type, 'default'); }
    }
    return out.map((c, i) => Object.assign(c, { tick: i * S, bar: Math.floor(i * S / BAR) }));
  }

  /** d. Rhythm: accent profile, syncopation, density, energy per bar */
  function analyzeRhythm(mat, bars) {
    const kick = new Array(16).fill(0), snare = new Array(16).fill(0), hat = new Array(16).fill(0), onset = new Array(16).fill(0);
    const barEnergy = new Array(bars).fill(0);
    mat.drumHits.forEach(h => {
      const p = h.tick % 16;
      if (h.row === 'kick') kick[p] += h.v; else if (h.row === 'snare' || h.row === 'clap') snare[p] += h.v; else hat[p] += h.v;
      const b = Math.floor(h.tick / BAR); if (b < bars) barEnergy[b] += h.v * (h.row === 'crash' ? 2 : 1);
    });
    const seen = new Set();
    mat.notes.forEach(n => {
      const k = n.trackId + ':' + n.start; if (seen.has(k)) return; seen.add(k);
      const p = Math.round(n.start) % 16; onset[p] += 1;
      const b = Math.floor(n.start / BAR); if (b < bars) barEnergy[b] += 0.6 * (n.vel / 100);
    });
    const K = normalize(kick), Sn = normalize(snare), O = normalize(onset), H = normalize(hat);
    const hasDrums = mat.drumHits.length > 0;
    const accent = normalize(C.metric.map((m, p) => hasDrums ? 0.42 * m + 0.25 * K[p] + 0.18 * Sn[p] + 0.15 * O[p] : 0.65 * m + 0.35 * O[p]));
    const allOn = onset.map((v, p) => v + kick[p] + snare[p]);
    const tot = allOn.reduce((a, b) => a + b, 0) || 1;
    const offbeat = allOn.reduce((s, v, p) => s + (p % 4 === 2 ? v * 0.6 : p % 2 === 1 ? v : 0), 0) / tot;
    const sixteenth = (onset.reduce((s, v, p) => s + (p % 2 ? v : 0), 0) + hat.reduce((s, v, p) => s + (p % 2 ? v : 0), 0)) / ((onset.reduce((a, b) => a + b, 0) + hat.reduce((a, b) => a + b, 0)) || 1) > 0.22;
    return {
      hasDrums, kick: K, snare: Sn, hat: H, onset: O, accent,
      syncopation: clamp(offbeat, 0, 1), sixteenth,
      density: seen.size / Math.max(1, bars),
      barEnergy: normalize(barEnergy)
    };
  }

  /** e. Form: the sections of the song (or detected ones) */
  AG.sectionType = function (name) {
    const n = (name || '').toLowerCase();
    if (/intro|^theme/.test(n)) return 'intro';             // "Theme": the instrumental theme comes back (twin leads…)
    if (/mambo|jaleo|derecho|solo|instr|impro/.test(n)) return 'solo';
    if (/interlud|dub|break/.test(n)) return 'bridge';
    if (/head|groove|tema/.test(n)) return 'verse';
    if (/pre/.test(n)) return 'pre';
    if (/chor|hook|coro|estrib|refr/.test(n)) return 'chorus';
    if (/bridge|puente|middle/.test(n)) return 'bridge';
    if (/solo|instr/.test(n)) return 'solo';
    if (/outro|ending|end\b|final|coda/.test(n)) return 'outro';
    if (/verse|verso|estrofa/.test(n)) return 'verse';
    return 'part';
  };
  function detectSections(chords, rhythm, bars) {
    const B = C.blockBars, nb = Math.ceil(bars / B), blocks = [];
    for (let i = 0; i < nb; i++) {
      const b0 = i * B, b1 = Math.min(bars, b0 + B);
      const sig = chords.filter(c => c.bar >= b0 && c.bar < b1).map(c => c.name).join(' ');
      let e = 0; for (let b = b0; b < b1; b++) e += rhythm.barEnergy[b] || 0;
      blocks.push({ i, start: b0, length: b1 - b0, sig, energy: e / (b1 - b0) });
    }
    const groups = {}; blocks.forEach(b => { (groups[b.sig] = groups[b.sig] || []).push(b); });
    const repeated = Object.values(groups).filter(g => g.length > 1);
    const avg = g => g.reduce((s, b) => s + b.energy, 0) / g.length;
    let chorusSig = null;
    if (repeated.length > 1) chorusSig = repeated.slice().sort((a, b) => avg(b) - avg(a))[0][0].sig;
    blocks.forEach((b, k) => {
      const g = groups[b.sig];
      if (g.length > 1) b.type = b.sig === chorusSig ? 'chorus' : 'verse';
      else if (k === 0 && nb > 2) b.type = 'intro';
      else if (k === nb - 1 && nb > 2) b.type = 'outro';
      else b.type = repeated.length ? 'bridge' : null;
    });
    // nothing repeats: verse / chorus alternate every 8 bars
    if (!repeated.length) { let alt = 0; blocks.forEach(b => { if (!b.type) { b.type = Math.floor(alt / 2) % 2 ? 'chorus' : 'verse'; alt++; } }); }
    // merge neighbouring blocks with the same label and chords
    const out = [];
    blocks.forEach(b => {
      const last = out[out.length - 1];
      if (last && last.type === b.type && (b.type !== 'chorus' || last.length < 8)) last.length += b.length;
      else out.push({ type: b.type, start: b.start, length: b.length });
    });
    return out.map(s => ({ name: s.type === 'pre' ? 'Pre-Chorus' : s.type[0].toUpperCase() + s.type.slice(1), type: s.type, start: s.start, length: s.length }));
  }
  function analyzeSections(song, chords, rhythm, bars) {
    let list = (song.sections || []).filter(s => s.length > 0).map(s => ({ name: s.name, type: AG.sectionType(s.name), start: s.start, length: s.length, id: s.id }));
    let detected = false;
    if (!list.length) { list = detectSections(chords, rhythm, bars); detected = true; }
    list.sort((a, b) => a.start - b.start);
    // cover the gaps so every bar belongs to a section
    const full = []; let bar = 0;
    list.forEach(s => {
      if (s.start > bar) full.push({ name: 'Part', type: 'part', start: bar, length: s.start - bar, gap: true });
      if (s.start + s.length > bar) { const st = Math.max(s.start, bar); full.push(Object.assign({}, s, { start: st, length: s.start + s.length - st })); bar = s.start + s.length; }
    });
    if (bar < bars) full.push({ name: 'Part', type: 'part', start: bar, length: bars - bar, gap: true });
    const count = {};
    full.forEach(s => { count[s.type] = (count[s.type] || 0) + 1; s.occ = count[s.type]; s.key = s.type + s.occ; });
    full.forEach(s => { s.total = count[s.type]; });
    return { list: full, detected };
  }

  /** f. Structure check */
  function checkStructure(an) {
    const out = [], types = an.sections.list.map(s => s.type);
    const tonic = an.key.root;
    if (an.sections.detected) out.push(['info', 'The song has no sections — they were detected from the chords and the energy (you can write them into the song).']);
    if (!types.includes('intro')) out.push(['warn', 'No Intro: the first phrase is generated as a soft entry.']);
    if (!types.includes('chorus')) out.push(['warn', 'No Chorus found: the main theme is taken from the most energetic section.']);
    if (!types.includes('outro')) out.push(['warn', 'No Outro / ending: the last bars are generated as a final cadence (option: add a 4-bar Outro).']);
    if (types.filter(t => t === 'bridge').length === 0 && an.bars >= 32) out.push(['info', 'No Bridge: long songs usually have a contrasting section before the last chorus.']);
    an.sections.list.forEach(s => { if (s.length % 2) out.push(['info', s.name + ' has ' + s.length + ' bars (odd) — phrases are cut to fit.']); });
    const last = an.chords[an.chords.length - 1];
    if (last && last.root !== tonic) out.push(['info', 'The song ends on ' + last.name + ' (not the tonic ' + SDAW.NOTE_NAMES[tonic] + ') — an open ending.']);
    if (an.key.confidence < 0.25 && an.key.source.startsWith('detected')) out.push(['warn', 'The key is ambiguous — check it in the top bar (Key).']);
    if (an.chords.every(c => c.source === 'default')) out.push(['warn', 'No chords or accompaniment found: a default ' + an.key.name + ' progression is used.']);
    if (!out.length) out.push(['ok', 'Structure looks complete: intro, sections and ending.']);
    return out;
  }

  /** Scale pitch classes of a key */
  function scalePCs(key) { return SDAW.SCALES[key.mode === 'minor' ? 'Natural Minor' : 'Major'].map(i => mod12(key.root + i)); }

  /**
   * Full analysis of the song.
   * @param song       the song (normally SDAW.store.song)
   * @param targetId   track that will be (re)written — excluded from the analysis
   */
  AG.analyze = function (song, targetId) {
    let end = 0; song.tracks.forEach(t => t.clips.forEach(c => { end = Math.max(end, c.start + c.len); }));
    const bars = Math.max(song.bars || 0, Math.ceil(end / BAR), 4);
    const mat = collect(song, targetId);
    const key = detectKey(song, mat);
    key.name = SDAW.NOTE_NAMES[key.root] + (key.mode === 'minor' ? ' minor' : ' major');
    const chords = detectChords(song, mat, key, bars);
    const rhythm = analyzeRhythm(mat, bars);
    const sections = analyzeSections(song, chords, rhythm, bars);
    // register used by the other instruments (melody stays above the harmony)
    const reg = {};
    mat.notes.forEach(n => { const r = reg[n.type] = reg[n.type] || []; r.push(n.pitch); });
    const median = arr => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    const register = {}; Object.keys(reg).forEach(k => { register[k] = { median: median(reg[k]), max: Math.max(...reg[k]), min: Math.min(...reg[k]) }; });
    const an = { bars, tempo: song.tempo, key, scale: scalePCs(key), chords, rhythm, sections, register, mat, targetId };
    an.checks = checkStructure(an);
    an.chordAt = tick => chords[clamp(Math.floor(tick / C.slotTicks), 0, chords.length - 1)];
    return an;
  };

  /* ===================================================== MUSIC HELPERS == */

  /** Scale of the moment: key scale with the chord's own notes (e.g. G# over E in A minor) */
  function localScale(an, ch) {
    const sc = an.scale.slice();
    ch.pcs.forEach(pc => {
      if (sc.includes(pc)) return;
      let j = sc.indexOf(mod12(pc - 1)); if (j < 0) j = sc.indexOf(mod12(pc + 1));
      if (j >= 0) sc[j] = pc; else sc.push(pc);
    });
    return sc;
  }
  /** Nearest pitch whose pitch class is in pcs (prefers direction dir on ties) */
  function snapTo(pitch, pcs, dir) {
    for (let d = 0; d < 12; d++) {
      const a = pitch + (dir < 0 ? -d : d), b = pitch + (dir < 0 ? d : -d);
      if (pcs.includes(mod12(a))) return a;
      if (pcs.includes(mod12(b))) return b;
    }
    return pitch;
  }
  /** Move `steps` scale degrees from a pitch */
  function stepScale(pitch, steps, sc) {
    let p = snapTo(pitch, sc, steps);
    const dir = Math.sign(steps);
    for (let i = 0; i < Math.abs(steps); i++) { do { p += dir; } while (!sc.includes(mod12(p))); }
    return p;
  }
  /** Fold a pitch into a range by octaves */
  function fold(p, lo, hi) { while (p > hi) p -= 12; while (p < lo) p += 12; return p; }
  /** Best chord tone near `from`, pulled toward `target` */
  function chordTone(from, ch, target, lo, hi, avoid) {
    let best = null;
    for (let p = lo; p <= hi; p++) {
      if (!ch.pcs.includes(mod12(p)) || p === avoid) continue;
      const mv = Math.abs(p - from);
      const cost = mv + Math.abs(p - target) * 0.35 + (mv > 7 ? 4 : 0) + (mod12(p - ch.root) === 10 || mod12(p - ch.root) === 11 ? 0.8 : 0);
      if (!best || cost < best.c) best = { p, c: cost };
    }
    return best ? best.p : fold(from, lo, hi);
  }
  /** Arch contour 0..1..~0.3 over a phrase (climax around 60%) */
  const arch = x => Math.sin(Math.PI * Math.pow(clamp(x, 0, 1), 0.85)) * (x > 0.85 ? 0.7 : 1);

  /* ================================================== 2. PLAN & THEMES == */

  /** Role of a track when the user leaves "Auto" */
  AG.autoRole = function (track, song) {
    if (!track) return 'melody';
    if (track.type === 'drums') return 'drums';
    if (track.type === 'bass') return 'bass';
    if (track.type === 'strings') return 'harmony';
    const n = (track.name + ' ' + track.instrument).toLowerCase();
    if (/lead|solo|melod|vocal|voz/.test(n)) return 'melody';
    if (track.type === 'keys') return /lead|melod/.test(n) ? 'melody' : 'harmony';
    if (track.type === 'guitar') return /rhythm|acoustic|strum|nylon|ritmo/.test(n) ? 'strum' : 'melody';
    return 'melody';
  };

  /**
   * A THEME = the rhythmic + melodic identity of a section type.
   * motif:  1 bar of onsets { p (16th), dur, step (scale steps from previous note) }
   * motifB: contrasting bar used for the development bar
   */
  function makeCell(R, an, density, opts, steady) {
    const acc = an.rhythm.accent;
    const allow16 = an.rhythm.sixteenth || density > 0.72 || opts.complexity > 0.65;
    const maxNotes = Math.round(2 + density * (allow16 ? 9 : 6));
    let ons = [];
    const shiftStart = !steady && an.rhythm.syncopation > 0.32 && R.chance(0.3);
    for (let p = 0; p < 16; p++) {
      if (!allow16 && p % 2) continue;
      let prob = density * (0.3 + 0.7 * acc[p]);
      if (p === 0) prob = shiftStart ? 0.05 : 0.95;
      if (shiftStart && p === 2) prob = 0.9;
      if (R.chance(prob)) ons.push(p);
    }
    if (ons.length < 2) ons = [shiftStart ? 2 : 0, 8];
    while (ons.length > maxNotes) { // drop the weakest
      let wi = 1, wv = 9; ons.forEach((p, i) => { if (i && acc[p] < wv) { wv = acc[p]; wi = i; } }); ons.splice(wi, 1);
    }
    const cell = ons.map((p, i) => {
      const nxt = i < ons.length - 1 ? ons[i + 1] : 16;
      let dur = nxt - p;
      if (dur > 2 && R.chance(opts.rest)) dur = Math.max(1, Math.round(dur / 2));
      return { p, dur, step: 0 };
    });
    // contour: steps preferred, leaps resolved in the opposite direction
    let lastLeap = 0;
    cell.forEach((o, i) => {
      if (!i) return;
      if (Math.abs(lastLeap) >= 3) { o.step = -Math.sign(lastLeap) * R.int(1, 2); lastLeap = 0; return; }
      const cx = opts.complexity;
      o.step = R.weighted([[0, .12], [1, .26], [-1, .26], [2, .11 + cx * .05], [-2, .11 + cx * .05], [3, .04 + cx * .05], [-3, .04 + cx * .05], [4, .02 + cx * .04], [-4, .02 + cx * .03]]);
      lastLeap = o.step;
    });
    return cell;
  }
  function getTheme(ctx, type) {
    const key = type === 'intro' || type === 'outro' ? (ctx.an.sections.list.some(s => s.type === 'chorus') ? 'chorus' : 'verse') : type;
    if (ctx.themes[key]) return ctx.themes[key];
    const R = makeRand(ctx.seed ^ hash('theme:' + key + ':' + ctx.role));
    const prof = C.profiles[key] || C.profiles.part;
    const dens = clamp(prof.density * (0.55 + ctx.opts.density), 0.12, 1);
    const o = { complexity: ctx.opts.complexity, rest: prof.rest };
    const th = { motif: makeCell(R, ctx.an, dens, o), motifB: makeCell(R, ctx.an, clamp(dens + 0.15, 0, 1), o, true), climax: R.int(4, 7) + (key === 'chorus' ? 2 : 0) };
    ctx.themes[key] = th;
    return th;
  }
  /** Variations of a motif for the answer bar */
  function transform(R, cell, how) {
    const c = cell.map(o => Object.assign({}, o));
    if (how === 'invert') c.forEach(o => { o.step = -o.step; });
    else if (how === 'rhythm' && c.length > 1) {
      const i = R.int(0, c.length - 1), o = c[i];
      if (o.dur >= 4) { const h = Math.floor(o.dur / 2); c.splice(i + 1, 0, { p: o.p + h, dur: o.dur - h, step: R.pick([1, -1]) }); o.dur = h; }
      else if (i < c.length - 1) { o.dur += c[i + 1].dur; c.splice(i + 1, 1); }
    } else if (how === 'tail' && c.length > 3) {
      const half = Math.floor(c.length / 2), tail = c.slice(half).map(o => o.step).reverse();
      c.slice(half).forEach((o, k) => { o.step = -tail[k]; });
    }
    return c;
  }
  /** Bar roles inside a phrase */
  function barRole(i, len) {
    if (len === 1) return 'cadence';
    if (len === 2) return i === 0 ? 'statement' : 'cadence';
    if (len === 3) return ['statement', 'answer', 'cadence'][i];
    return i === len - 1 ? 'cadence' : ['statement', 'answer', 'develop'][i % 3];
  }

  /* ============================================================ 3. ROLES == */

  /* ------------------------------------------------------------ MELODY --- */
  /* =================================================================== *
   *  BLUES LEAD — built from blues guitar licks, not from random scale
   *  notes. Every lick is written on the minor-pentatonic "box" of the
   *  key (box 1 + the upper "B.B. box"), with the techniques that make
   *  the style:
   *    curl   b3 nudged a 1/4 tone toward the major 3rd (major blues)
   *    bends  4 -> 5 and b7 -> R (whole tone), bend & release, pre-bends
   *    vibrato on the long target notes (root, 5th, bent notes)
   *    space  phrases breathe: call (2 bars) – answer – rest
   *  12-bar form (AAB): line 1 = call A, line 2 = the same call over the
   *  IV chord, line 3 = climax (high bends) -> resolution -> turnaround
   *  into the V (or the final ending). With a singer (level 0.5) the
   *  lead only answers in the gaps (bars 3-4, 7-8, 11-12 of each 12).
   * =================================================================== */
  // degree name -> [string (0 = low E), fret offset from the box root]
  const BOX = {
    R0: [0, 0], b30: [0, 3], '40': [1, 0], b50: [1, 1], '50': [1, 2], '60': [1, 4], b70: [2, 0], R1: [2, 2],
    b31: [3, 0], '41': [3, 2], b51: [3, 3], '51': [4, 0], b71: [4, 3], R2: [5, 0], b32: [5, 3], '42': [5, 5], '52': [5, 7],
    R2b: [4, 5]                                   // root on the B string, B.B. King box
  };
  // note: [start (ticks from the lick start, 16 = 1 bar), duration, degree, techniques]
  //   techniques: b2 bend whole tone · b1 half · b2r bend & release · pb pre-bend release · c curl
  //               v vibrato · h hammer-on · p pull-off · si slide in · t triplet
  const T3 = 4 / 3;
  const BLUES_LICKS = {
    call: [
      [[0, 4, '41', 'b2v'], [4, 2, '51'], [6, 2, '41'], [8, 2, 'b31', 'c'], [10, 6, 'R1', 'v'], [20, 2, 'b31', 'c'], [22, 2, 'R1'], [24, 8, '50', 'v']],
      [[0, T3, 'b71', 't'], [T3, T3, 'R2', 't'], [2 * T3, T3, 'b71', 't'], [4, 4, 'R2', 'v'], [8, 2, 'b71'], [10, 2, '51'], [12, 4, 'b71', 'b2r'], [16, 2, '51'], [18, 2, '41'], [20, 2, 'b31', 'c'], [22, 10, 'R1', 'v']],
      [[0, 6, 'b71', 'b2r'], [6, 2, '51'], [8, 2, 'b71'], [10, 2, '51'], [12, 4, '41', 'b2'], [16, 2, '51'], [18, 2, 'b31', 'c'], [20, 12, 'R1', 'v']],
      [[2, 2, 'R0'], [4, 2, 'b30', 'c'], [6, 2, '40'], [8, 2, 'b50'], [10, 6, '50', 'v'], [16, 2, 'b70'], [18, 2, '50'], [20, 4, 'b30', 'c'], [24, 8, 'R0', 'v']],
      [[0, 2, 'b31', 'si'], [2, 2, '41', 'h'], [4, 4, '41', 'b2v'], [8, 2, 'b31', 'c'], [10, 2, 'R1'], [12, 4, 'b70'], [16, 4, 'R1', 'v'], [24, 2, 'b31', 'c'], [26, 6, 'R1', 'v']],
      [[0, 8, 'R2', 'v'], [8, 2, 'b71'], [10, 2, 'R2'], [12, 2, 'b71'], [14, 2, '51'], [16, 4, 'b71', 'b2'], [20, 2, '51'], [22, 2, '41'], [24, 8, 'b31', 'c']]
    ],
    answer: [
      [[4, 2, 'b31', 'c'], [6, 2, 'R1'], [8, 8, '50', 'v']],
      [[8, T3, 'R2', 't'], [8 + T3, T3, 'b71', 't'], [8 + 2 * T3, T3, '51', 't'], [12, 4, 'b71', 'b2v']],
      [[6, 2, '41'], [8, 4, '41', 'b2v'], [12, 2, 'b31', 'c'], [14, 2, 'R1']],
      [[4, 6, 'R2', 'pb'], [10, 2, 'b71'], [12, 4, 'R2', 'v']],
      [[8, 2, '50'], [10, 2, 'b70'], [12, 4, 'R1', 'v']]
    ],
    climax: [
      [[0, 8, '42', 'b2v'], [8, 2, 'b32'], [10, 2, 'R2'], [12, 4, 'b32', 'c'], [16, 4, 'R2', 'v'], [20, 2, 'b71'], [22, 2, '51'], [24, 8, 'b71', 'b2r']],
      [[0, 2, '41', 'b2'], [2, 2, 'R2'], [4, 2, '41', 'b2'], [6, 2, 'R2'], [8, 2, '41', 'b2'], [10, 2, 'R2'], [12, 4, 'b32', 'c'], [16, 2, 'R2'], [18, 2, 'b71'], [20, 2, '51'], [22, 2, '41'], [24, 8, 'b31', 'c']],
      [[0, T3, 'b32', 't'], [T3, T3, 'R2', 't'], [2 * T3, T3, 'b71', 't'], [4, T3, 'R2', 't'], [4 + T3, T3, 'b71', 't'], [4 + 2 * T3, T3, '51', 't'],
       [8, T3, 'b71', 't'], [8 + T3, T3, '51', 't'], [8 + 2 * T3, T3, '41', 't'], [12, T3, '51', 't'], [12 + T3, T3, '41', 't'], [12 + 2 * T3, T3, 'b31', 't'], [16, 4, 'b31', 'c'], [20, 12, 'R1', 'v']],
      [[0, 12, 'R2b', 'v'], [12, 2, 'b71'], [14, 2, 'R2b'], [16, 6, '42', 'b2r'], [22, 2, 'b32'], [24, 8, 'R2', 'v']]
    ],
    resolve: [
      [[0, 2, 'b31', 'c'], [2, 2, 'R1'], [4, 2, 'b70'], [6, 2, 'R1'], [8, 8, 'R1', 'v']],
      [[0, 4, '41', 'b2'], [4, 2, 'b31', 'c'], [6, 2, 'R1'], [8, 2, 'b70'], [10, 6, 'R1', 'v']],
      [[2, 2, '51'], [4, 2, 'b31', 'c'], [6, 2, 'R1'], [8, 8, 'R1', 'v']]
    ],
    // last bar of a chorus, over the V chord: walk down to the 5th
    turn: [
      [[0, 2, 'R1'], [2, 2, 'b70'], [4, 2, '60'], [6, 2, 'b50'], [8, 8, '50', 'v']],
      [[4, T3, 'R1', 't'], [4 + T3, T3, 'b70', 't'], [4 + 2 * T3, T3, '50', 't'], [8, 8, '50', 'v']]
    ],
    // final bar of the song: land on the root and let it ring
    end: [
      [[0, 2, 'b31', 'c'], [2, 2, 'R1'], [4, 12, 'R0', 'v']],
      [[0, 4, 'b71', 'b2'], [4, 12, 'R1', 'v']]
    ]
  };

  // Shared vocabulary for the traditional blues engine and the guitarist presets.
  function addBluesPhrases(ctx, sec, bars, isLastSection) {
    const { an } = ctx;
    const key = an.key.root, tun = CONFIG.guitar.tuning, frets = CONFIG.guitar.frets;
    const dominant = mod12(key + 7);
    const at = (bar, beat = 0) => an.chordAt((sec.start + bar) * BAR + beat);
    const isRoot = (bar, tick, root) => at(bar, tick)?.root === root;
    const tonicSpan = (bar, start, end) => isRoot(bar, start, key) && isRoot(bar, end - 1, key);
    const nearest = notes => notes.sort((a, b) => Math.abs(a - ctx.center) - Math.abs(b - ctx.center))[0];
    const [lo, hi] = ctx.range;
    const roots = [];
    for (let p = lo; p <= hi; p++) if (mod12(p) === key) roots.push(p);

    function replace(k, start, end, phrase) {
      const bar = bars[k];
      if (!bar?.notes.length || !phrase.length || phrase.some(n => !n)) return;
      bar.notes = bar.notes.filter(n => n.start < start || n.start >= end);
      bar.notes.forEach(n => { if (n.start < start) n.dur = Math.min(n.dur, start - n.start); });
      bar.notes.push(...phrase);
      bar.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    }

    function note(start, dur, pitch, tech = {}, position = SDAW.autoFret(pitch, new Set(), 7)) {
      if (!position) return null;
      return { start, dur, pitch, tech, string: position.string, fret: position.fret,
        vel: Math.round(clamp((ctx.baseVel || 90) + (start % 4 === 0 ? 5 : -3), 35, 122)) };
    }
    const fixed = (start, dur, string, fret, tech) =>
      note(start, dur, tun[string] + fret, tech, { string, fret });

    // A blue third (the second degree of the minor pentatonic) answers on I.
    const curlBar = sec.length >= 8 ? 2 : 1;
    if (tonicSpan(curlBar, 8, BAR)) {
      const root = nearest(roots.filter(p => p + 3 <= hi));
      if (root !== undefined) {
        const bend = ctx.mel?.bends === false ? {} : { bend: 0.5, bendType: 'up' };
        replace(curlBar, 8, BAR, [note(8, 2, root + 3, bend), note(10, 5, root)]);
      }
    }

    // Descending sixths on strings 3 and 1. In A, frets 9/9, 8/8, 7/7, 6/5.
    // Resolve the lower voice to the actual third of the tonic chord.
    if (sec.length >= 8 && tonicSpan(6, 8, BAR) && tun[5] - tun[3] === 9) {
      const tonicChord = at(6, 8);
      const thirdFretOffset = tonicChord.pcs.includes(mod12(key + 4)) ? 1 : 0;
      const root = nearest(roots.filter(p => p >= tun[5] && p - 9 >= lo && p + 4 <= Math.min(hi, tun[5] + frets)));
      if (root !== undefined) {
        const f = root - tun[5];
        const together = ((sec.occ || 0) + (sec.type === 'solo' ? 1 : 0)) % 2 === 0;
        const phrase = [];
        [4, 3, 2, 1].forEach((offset, i) => {
          const t = 8 + i * 2;
          phrase.push(fixed(t, together ? 1.75 : 0.9, 3, f + (i === 3 ? thirdFretOffset : offset)));
          phrase.push(fixed(t + (together ? 0 : 1), together ? 1.75 : 0.9, 5, f + (i === 3 ? 0 : offset)));
        });
        replace(6, 8, BAR, phrase);
      }
    }

    const allowsDownbeat = ctx.play !== 'answers' && ctx.level !== 0.5;
    const turnRoot = nearest(roots.filter(p => p - 5 >= Math.max(lo, tun[0])));
    if (turnRoot === undefined || sec.length < 2) return;
    const final = sec.length - 1, penultimate = final - 1;
    const closing = isLastSection && isRoot(final, 0, key) && isRoot(final, 15, key);

    // Check the actual harmony. Some progressions put V on the second half
    // of the last bar, or use IV at the end of the penultimate bar.
    const turnBar = !closing && tonicSpan(final, 0, 8) && isRoot(final, 8, dominant) ? final : penultimate;
    const halfBar = turnBar === final || !tonicSpan(turnBar, 0, BAR);
    if (tonicSpan(turnBar, 0, halfBar ? 8 : BAR) &&
        (closing || isRoot(final, halfBar ? 8 : 0, dominant) || isRoot(final, 0, dominant))) {
      const offsets = [0, -2, -3, -4, -5];
      const starts = halfBar ? [0, 2, 3, 4, 6] : [8, 10, 11, 12, 14];
      if (!halfBar || allowsDownbeat) {
        const phrase = starts.map((t, i) => note(t, i === 4 ? 1.75 : Math.min(1.75, starts[i + 1] - t), turnRoot + offsets[i]));
        replace(turnBar, starts[0], starts[0] + 8, phrase);
      }
    }
    if (closing && allowsDownbeat) {
      replace(final, 0, BAR, [note(0, BAR, turnRoot, ctx.mel?.vibrato === false ? { ring: true } : { ring: true, vib: true })]);
    } else if (sec.start >= 2 && allowsDownbeat && isRoot(0, 0, key) && isRoot(-1, 15, dominant)
      && (isRoot(-1, 0, key) || isRoot(-2, 0, key))) {
      const next = bars[0].notes.find(n => n.start > 0)?.start ?? 4;
      replace(0, 0, Math.min(next, 4), [note(0, Math.min(next, 4), turnRoot)]);
    }
  }



  function bluesLeadSection(ctx, sec, isLastSection) {
    const { an, opts } = ctx;
    const mel = ctx.mel || {};
    const tun = CONFIG.guitar.tuning;
    const gtr = ctx.track.type === 'guitar';
    const major = an.key.mode !== 'minor';
    let f0 = mod12(an.key.root - tun[0] % 12 + 12 * 3) % 12;        // fret of the key root on the low E string
    if (f0 <= 2) f0 += 12;                                          // E, F, F#: box at the 12th–14th fret
    const [lo, hi] = ctx.range || [40, 90];
    // every chorus of the song gets its own licks (sec.occ = 1st, 2nd… verse)
    const R = makeRand(ctx.seed ^ hash('blues|' + sec.type + '|' + (sec.occ || 0) + '|' + an.key.root));
    const pickL = (kind, filter) => {
      let list = BLUES_LICKS[kind];
      if (!mel.triplets) list = list.filter(l => !l.some(n => (n[3] || '').includes('t')));
      if (filter) list = list.filter(filter);
      return R.pick(list.length ? list : BLUES_LICKS[kind]);
    };
    // fills only between the lines of a singer: when another melody plays in this section.
    // Without a singer the lead is the voice: it plays the whole AAB chorus.
    const answers = ctx.play === 'answers' || (ctx.level === 0.5 && SDAW.store.song.tracks.some(t => t.id !== ctx.track.id && !t.mute &&
      /vocal|voice|vox|sing|harmonica|sax|trumpet/i.test(t.name + ' ' + (t.instrument || '')) &&
      SDAW.store.trackNotes(t).some(n => n.start >= sec.start * BAR && n.start < (sec.start + sec.length) * BAR)));
    const hot = sec.type === 'solo' || sec.type === 'chorus';
    const busy = opts.complexity || 0.5;
    const bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], idx: k, role: 'blues', curated: true });

    // put a lick at a bar (k = bar index inside the section)
    const place = (lick, k, maxBars) => {
      if (!lick || k >= sec.length) return;
      lick.forEach(([t, d, deg, tc]) => {
        tc = tc || '';
        const bi = k + Math.floor(t / BAR);
        if (bi >= sec.length || bi - k >= (maxBars || 2)) return;
        const pos = BOX[deg]; if (!pos) return;
        const [s, fo] = pos;
        let pitch = tun[s] + f0 + fo, fret = f0 + fo;
        if (!gtr) { while (pitch > hi) pitch -= 12; while (pitch < lo) pitch += 12; }
        const start = t - Math.floor(t / BAR) * BAR;
        const tech = {};
        if (tc.includes('b2r')) { tech.bend = 2; tech.bendType = 'release'; }
        else if (tc.includes('pb')) { tech.bend = 2; tech.bendType = 'prerelease'; }
        else if (tc.includes('b2')) { tech.bend = 2; tech.bendType = 'up'; }
        else if (tc.includes('b1')) { tech.bend = 1; tech.bendType = 'up'; }
        else if (tc.includes('c') && major) { tech.bend = 0.5; tech.bendType = 'up'; }   // curl: b3 a quarter tone sharp
        if (!mel.bends && tech.bend) { delete tech.bend; delete tech.bendType; }
        if (tc.includes('v') && mel.vibrato !== false) tech.vib = true;
        if (tc.includes('h') && gtr) tech.h = true;
        if (tc.includes('p') && !tc.includes('pb') && gtr) tech.p = true;
        if (tc.includes('si') && mel.slides !== false) tech.slide = 'inBelow';
        const strong = start % 4 === 0;
        const vel = Math.round(clamp((ctx.baseVel || 92) + (strong ? 8 : 0) + (tech.bend >= 1 ? 6 : 0) + (hot ? 6 : 0) + R.int(-5, 5), 40, 124));
        const n = { start, dur: Math.max(0.5, Math.min(d, BAR - start)), pitch, vel, tech };
        if (tc.includes('t')) n.tup = 3;
        if (gtr) { n.string = s; n.fret = fret; }
        bars[bi].notes.push(n);
      });
    };

    const lines = Math.ceil(sec.length / 4);
    const twelve = sec.length % 12 === 0;
    const callA = pickL('call');
    for (let L = 0; L < lines; L++) {
      const k = L * 4;
      const lastLine = L === lines - 1;
      const posIn12 = twelve ? L % 3 : (lastLine ? 2 : L % 2);      // 0 = I line, 1 = IV line, 2 = V line
      const isEnd = isLastSection && lastLine;
      if (answers) {
        // a singer is on: fills only in the gaps (bars 3–4 of each line)
        place(pickL('answer'), k + 2, 1);
        if (posIn12 === 2) place(isEnd ? pickL('end') : pickL('turn'), k + 3, 1);
        else if (busy > 0.6 && R.chance(0.5)) place(pickL('answer'), k + 3, 1);
        continue;
      }
      if (posIn12 === 2 || sec.type === 'intro' || sec.type === 'outro') {
        // B line: climax, resolution, turnaround / ending
        if (sec.type === 'intro' && sec.length <= 4) { place(pickL('climax'), k, 2); place(pickL('resolve'), k + 2, 1); place(pickL('turn'), k + 3, 1); continue; }
        place(sec.type === 'outro' ? pickL('resolve') : pickL('climax'), k, 2);
        place(pickL('resolve'), k + 2, 1);
        place(isEnd ? pickL('end') : pickL('turn'), k + 3, 1);
        continue;
      }
      // A lines: the same call twice (AAB), the 2nd time sometimes with a different answer
      place(posIn12 === 1 && R.chance(0.35) ? pickL('call') : callA, k, 2);
      place(pickL('answer'), k + 2, 1);
      if (hot && busy > 0.55) place(pickL('answer'), k + 3, 1);     // solos: fewer rests
    }
    bars.forEach(b => b.notes.sort((x, y) => x.start - y.start || x.pitch - y.pitch));
    return bars;
  }

  /* =================================================================== *
   *  JAZZ LEAD — bebop language, chord by chord
   *  Each chord gets its own mode:  maj7 = Ionian (Lydian in bridges),
   *  m7 = Dorian, 7 = Mixolydian bebop (Phrygian dominant / b9 when it
   *  resolves to a minor chord), m7b5 = Locrian #2, dim7 = diminished.
   *  Head (Head A / verse / bridge): a composed theme — jazz rhythms
   *  (Charleston, anticipations, quarter-note triplets), chord tones and
   *  colour tones (9, 13, #11) on the long notes, scoops and fall-offs,
   *  the same 2-bar motif in sequence over the changes; guitars play it
   *  in OCTAVES (Wes Montgomery). A counter horn doubles it an octave up.
   *  Solo: swung 8th-note bebop lines — chord tones on the beats (bebop
   *  scales), arpeggios 3-5-7-9, enclosures into the guide tones (3rd /
   *  7th) of the next chord, triplet turns, 16th runs, space between
   *  phrases and a long landing note with vibrato or a fall.
   * =================================================================== */
  const JZ_MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
    mixo: [0, 2, 4, 5, 7, 9, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10], locrian2: [0, 2, 3, 5, 6, 8, 10],
    dim: [0, 2, 3, 5, 6, 8, 9, 11], hw: [0, 1, 3, 4, 6, 7, 9, 10]
  };
  // bebop scales: one chromatic passing tone so the chord tones fall on the beats
  const JZ_BEBOP = { ionian: 8, lydian: 8, dorian: 4, mixo: 11 };
  function jazzChordInfo(an, tick, sectionType) {
    const ch = an.chordAt(tick), nx = an.chordAt(tick + 8 * 2);
    const t = ch.type || '';
    let mode;
    if (/m7b5|ø/.test(t)) mode = 'locrian2';
    else if (/dim/.test(t)) mode = 'dim';
    else if (/^m(?!aj)/.test(t)) mode = 'dorian';
    else if (/7b9/.test(t)) mode = 'hw';
    else if (/^(7|9|13|7sus4|sus)/.test(t)) mode = (nx && /^m(?!aj)|m7b5/.test(nx.type || '') && mod12(nx.root - ch.root) === 5) ? 'phrygdom' : 'mixo';
    else mode = sectionType === 'bridge' && mod12(ch.root - an.key.root) === 5 ? 'lydian' : 'ionian';
    let scale = JZ_MODES[mode].map(i => mod12(ch.root + i));
    // chords of the key use the key's own scale (iii7 = Phrygian, IV = Lydian, V = Mixolydian…);
    // the special modes are for chords from outside the key (secondary dominants, ii–V to other keys)
    const keyPcs = an.scale || [];
    const tonesIn = ch.intervals.slice(0, 4).every(i => keyPcs.includes(mod12(ch.root + i)));
    if (tonesIn && keyPcs.length === 7 && mode !== 'dim') scale = keyPcs.slice();
    const bebop = JZ_BEBOP[mode] !== undefined && !scale.includes(mod12(ch.root + JZ_BEBOP[mode])) && !(tonesIn && mode === 'dorian') ? scale.concat([mod12(ch.root + JZ_BEBOP[mode])]) : scale;
    const tones = ch.intervals.slice(0, 4).map(i => mod12(ch.root + i));                 // 1 3 5 7
    const third = mod12(ch.root + (ch.intervals[1] !== undefined ? ch.intervals[1] : 4));
    const seventh = ch.intervals[3] !== undefined ? mod12(ch.root + ch.intervals[3]) : mod12(ch.root + (mode === 'ionian' || mode === 'lydian' ? 11 : 10));
    // colour tones taken from the chosen scale: 9 (or b9) and 13 (or b13 / #11)
    const pickIn = (a, b) => scale.includes(mod12(ch.root + a)) ? mod12(ch.root + a) : mod12(ch.root + b);
    const ninth = pickIn(2, 1);
    const colors = [ninth, mode === 'lydian' ? mod12(ch.root + 6) : pickIn(9, 8)];
    return { ch, mode, scale, bebop, tones, third, seventh, ninth, colors, guide: [third, seventh] };
  }

  function jazzLeadSection(ctx, sec, isLastSection) {
    const { an, opts } = ctx;
    const mel = ctx.mel || {};
    const [lo, hi] = ctx.range || [50, 82];
    const gtr = ctx.track.type === 'guitar';
    const R = makeRand(ctx.seed ^ hash('jazz|' + sec.type + '|' + (sec.type === 'solo' ? sec.occ || 0 : 0) + '|' + an.key.root));
    const busy = clamp(opts.complexity === undefined ? 0.6 : opts.complexity, 0, 1);
    const S0 = sec.start * BAR, S1 = (sec.start + sec.length) * BAR;
    const ev = [];                                         // { t (abs tick), d, pitch, tech, tup, vel }
    const mid = Math.round((lo + hi) / 2);
    const fit = p => { while (p > hi) p -= 12; while (p < lo) p += 12; return p; };
    const near = (p, pcs, dir) => fit(snapTo(p, pcs, dir || 0));
    const step = (p, pcs, dir) => { for (let k = 1; k < 13; k++) { const q = p + dir * k; if (pcs.includes(mod12(q))) return q; } return p + dir; };
    const info = t => jazzChordInfo(an, t, sec.type);
    const add = (t, d, pitch, tech, extra) => { if (t < S0 || t >= S1) return; ev.push(Object.assign({ t, d, pitch: fit(pitch), tech: tech || {} }, extra || {})); };
    const isHead = sec.type !== 'solo';

    if (isHead) {
      /* ---------------------------------------------------- the head */
      // 2-bar rhythm motifs (ticks inside 2 bars) + contour: 1 up, -1 down, 0 colour tone
      const CELLS = [
        [[0, 6, 0], [6, 2, -1], [8, 8, 1], [18, 2, 1], [20, 2, -1], [22, 10, 0]],                 // Charleston + answer
        [[2, 2, 1], [4, 4, 1], [8, 6, 0], [14, 2, -1], [16, 12, 0]],                           // syncopated, anticipation
        [[0, 8 / 3, 1, 3], [8 / 3, 8 / 3, 1, 3], [16 / 3, 8 / 3, -1, 3], [8, 8, 0], [20, 2, 1], [22, 2, 1], [24, 8, 0]],   // quarter-note triplets
        [[0, 4, 0], [4, 2, -1], [6, 2, -1], [8, 2, 1], [10, 6, 1], [16, 2, -1], [18, 14, 0]],
        [[4, 2, 1], [6, 2, 1], [8, 2, 1], [10, 2, -1], [12, 4, 0], [16, 16, 0]]
      ];
      const motifA = R.pick(CELLS), motifB = R.pick(CELLS.filter(c => c !== motifA));
      let prev = mid + R.int(-2, 4);
      for (let b = 0; b < sec.length; b += 2) {
        const line = Math.floor(b / 2) % 4;
        if (sec.type === 'intro') { if (b < sec.length - 2) continue; }          // intro: only a pickup phrase at its end
        const cell = (sec.type === 'bridge' ? motifB : (line === 2 ? motifB : motifA));
        const last = b + 2 >= sec.length;
        cell.forEach(([t, d, dir, tup], i) => {
          const at = S0 + b * BAR + t;
          const I = info(at);
          const longN = d >= 6;
          let p;
          if (dir === 0) p = near(prev + (R.chance(0.5) ? 1 : -1), R.chance(0.6) ? I.colors.concat(I.guide) : I.tones);   // colour or guide tone
          else p = longN ? near(prev + dir * 2, I.tones.concat(I.colors), dir) : step(prev, I.scale, dir);
          if (Math.abs(p - mid) > 9) p = near(p - Math.sign(p - mid) * 5, I.tones);
          const tech = {};
          if (longN && mel.vibrato !== false) tech.vib = true;
          if (longN && mel.slides !== false && R.chance(0.45)) tech.slide = 'inBelow';           // sax scoop
          const lastOfCell = i === cell.length - 1;
          if (lastOfCell && line % 2 === 1 && mel.slides !== false && R.chance(0.35) && !last) { tech.slide = 'outDown'; delete tech.vib; }   // fall-off
          let dur = d;
          if (last && lastOfCell) { p = near(prev, isLastSection ? [I.ninth, I.third, I.seventh] : I.guide); dur = Math.max(d, 8); tech.vib = true; }
          add(at, dur, p, tech, tup ? { tup } : null);
          if (gtr) add(at, dur, p + 12, Object.assign({}, tech), Object.assign({ oct: true }, tup ? { tup } : {}));   // Wes: octaves
          prev = p;
        });
        if (sec.type === 'intro') break;
      }
    } else {
      /* ---------------------------------------------------- the solo */
      let p = mid + R.int(-3, 3);
      let t = S0 + (R.chance(0.6) ? 2 : 0);
      let dir = -1;
      while (t < S1 - 4) {
        // a phrase of 1–4 bars, then space
        const phraseLen = R.weighted([[BAR, 0.25], [BAR * 2, 0.45], [BAR * 3, 0.15], [BAR * 4, 0.15 + busy * 0.1]]);
        const pend = Math.min(S1 - 2, t + phraseLen);
        let I = info(t);
        p = near(p, I.tones, dir);
        while (t < pend - 4) {
          const beatStart = t % 4 === 0;
          I = info(t);
          const nextChange = Math.ceil((t + 1) / 8) * 8;                    // next half-bar = possible chord change
          const changeSoon = info(nextChange).ch.name !== I.ch.name && nextChange - t <= 4 && nextChange < pend;
          if (p > hi - 4) dir = -1; else if (p < lo + 5) dir = 1;
          const dev = R.weighted([
            ['line', 0.42], ['arp', 0.2 + busy * 0.05], ['enclose', changeSoon ? 0.45 : 0.04],
            ['triplet', mel.triplets === false ? 0 : 0.14 + busy * 0.08], ['run', mel.fast || busy > 0.65 ? 0.08 : 0.02]
          ]);
          if (dev === 'enclose' && changeSoon) {
            // scale tone above + chromatic below -> guide tone of the next chord on the beat
            const N = info(nextChange);
            const target = near(p, N.guide, dir);
            const a = nextChange - 4;
            if (a >= t) { add(a, 2, step(target, N.scale, 1), {}); add(a + 2, 2, target - 1, {}, { ghost: true }); }
            add(nextChange, 2, target, {});
            p = target; t = nextChange + 2;
            continue;
          }
          if (dev === 'arp' && beatStart) {
            // 3-5-7-9 up from the 3rd (Parker), then turn down
            const root3 = near(p - 3, [I.third], -1);
            const arp = [root3];
            [I.tones[2], I.seventh, I.ninth].forEach(pc => arp.push(snapTo(arp[arp.length - 1] + 1, [pc], 1)));
            if (arp[3] <= hi) { arp.forEach((q, k) => add(t + k * 2, 2, q, {})); p = arp[3]; t += 8; dir = -1; continue; }
          }
          if (dev === 'triplet' && beatStart) {
            // triplet turn: upper neighbour – note – chromatic below, landing on the next beat
            const target = near(p, I.tones, dir);
            const up = step(target, I.scale, 1);
            [up, target, target - 1].forEach((q, k) => add(t + k * 4 / 3, 4 / 3, q, {}, { tup: 3 }));
            add(t + 4, 2, target, {}); p = target; t += 6;
            continue;
          }
          if (dev === 'run' && beatStart && t + 8 <= pend) {
            // 16th-note bebop run down the bebop scale
            let q = near(p + 4, I.tones, 1);
            for (let k = 0; k < 8; k++) { add(t + k, 1, q, {}); q = step(q, I.bebop, -1); }
            p = q; t += 8; dir = 1;
            continue;
          }
          // bebop line: 8ths moving on through the bebop scale; on the beat the line
          // reaches the next chord tone IN ITS DIRECTION (no back-and-forth)
          p = step(p, I.bebop, dir);
          if (beatStart && !I.tones.includes(mod12(p))) p = step(p, I.tones, dir);
          p = fit(p);
          add(t, 2, p, {}, beatStart ? null : { off: true });
          if (R.chance(0.12)) dir = -dir;
          t += 2;
        }
        // landing: a guide / colour tone held, with vibrato or a fall
        I = info(t);
        const land = near(p, R.chance(0.6) ? I.guide : I.colors, dir);
        const tech = {};
        if (R.chance(0.3) && mel.slides !== false) tech.slide = 'outDown'; else tech.vib = mel.vibrato !== false;
        if (R.chance(0.3) && mel.slides !== false && !tech.slide) tech.slide = 'inBelow';
        let pitch = land;
        if (gtr && mel.bends && land > lo && !tech.slide && R.chance(0.3)) {
          pitch--;
          tech.bend = 1;
          tech.bendType = 'up';
        }
        add(t, Math.max(4, Math.min(8, pend - t + 2)), pitch, tech);
        p = land;
        // space before the next phrase (more space when calm)
        t = pend + R.pick([2, 4, 6, 8, 10]) + (busy < 0.4 ? 4 : 0);
        dir = R.chance(0.5) ? -1 : 1;
      }
    }

    // into bars (notes never cross a bar line); swing feel: off-beats slightly accented, some ghost notes
    const bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], idx: k, role: 'jazz', curated: true });
    ev.sort((a, b) => a.t - b.t);
    ev.forEach((e, i) => {
      const k = Math.floor((e.t - S0) / BAR); if (k < 0 || k >= sec.length) return;
      const start = e.t - (S0 + k * BAR);
      const nextT = ev.slice(i + 1).find(x => !x.oct && !e.oct ? true : x.t > e.t);
      let dur = Math.min(e.d, BAR - start);
      if (nextT && nextT.t > e.t && !e.oct) dur = Math.min(dur, nextT.t - e.t);
      const base = (ctx.baseVel || 88) + (isHead ? 4 : 0);
      let vel = base + (e.off ? 6 : 0) + (start % 8 === 0 ? 4 : 0) + R.int(-4, 4);
      if (e.ghost) vel -= 22;
      if (e.oct) vel -= 6;
      const n = { start, dur: Math.max(0.5, dur), pitch: e.pitch, vel: Math.round(clamp(vel, 35, 122)), tech: e.tech };
      if (e.tup) n.tup = 3;
      bars[k].notes.push(n);
    });
    return bars;
  }

  /** Jazz counter horn: the head doubled an octave up (unison in octaves); rests in solos */
  function jazzCounterSection(ctx, sec) {
    const bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], idx: k, role: 'jazz2', curated: true });
    if (sec.type === 'solo' || sec.type === 'intro') return bars;
    const s = SDAW.store, lt = ctx.opts.leadTrackId ? s.track(ctx.opts.leadTrackId) : null;
    const lead = lt ? s.trackNotes(lt) : (ctx.lead || []);
    const [lo, hi] = ctx.range || [55, 84];
    lead.forEach(n => {
      const k = Math.floor(n.start / BAR) - sec.start;
      if (k < 0 || k >= sec.length) return;
      let p = n.pitch + 12;
      if (p > hi) p = n.pitch;                       // too high: unison
      if (p < lo) p += 12;
      bars[k].notes.push({ start: n.start - (sec.start + k) * BAR, dur: n.dur, pitch: p, vel: Math.max(30, (n.vel || 90) - 8), tech: Object.assign({}, n.tech || {}), tup: n.tup });
    });
    return bars;
  }

  function melodySection(ctx, sec, isLastSection) {
    // guitar leads: the vocabulary of a great guitarist of the genre (legends.js); null = the engines below
    if (ctx.role === 'melody' && SDAW.legends) { const lg = SDAW.legends.leadSection(ctx, sec, isLastSection); if (lg) return lg; }
    if (ctx.role === 'melody' && ctx.style && ctx.style.melody && ctx.style.melody.licks === 'blues' && (ctx.mel || {}).licks !== false) return bluesLeadSection(ctx, sec, isLastSection);
    if (ctx.style && ctx.style.melody && ctx.style.melody.licks === 'jazz' && (ctx.mel || {}).licks !== false) {
      if (ctx.role === 'melody') return jazzLeadSection(ctx, sec, isLastSection);
      if (ctx.role === 'counter' && ctx.style.melody.octaves) return jazzCounterSection(ctx, sec);
    }
    const { an, opts } = ctx;
    const prof = C.profiles[sec.type] || C.profiles.part;
    const th = getTheme(ctx, sec.type);
    const counter = ctx.role === 'counter';
    const center = ctx.center + prof.lift * (counter ? 0.5 : 1);
    const bars = [];
    const phrases = [];
    const mel = ctx.mel;
    // horn riffs are 2-bar figures; answers = only the 2nd bar of every 2 (call & response)
    const answers = ctx.play === 'answers' || ctx.level === 0.5;
    const phraseBars = ctx.play === 'riffs' || answers ? 2 : C.phraseBars;
    for (let b = 0; b < sec.length; b += phraseBars) phrases.push(Math.min(phraseBars, sec.length - b));
    let bar = sec.start;
    const state = { prev: null, rep: 0, hand: 5 };
    // scale of this section (style scales or "mix modes")
    const savedScale = an.scale;
    const scName = sectionScale(ctx, sec.type);
    if (scName && SDAW.SCALES[scName]) an.scale = SDAW.SCALES[scName].map(i => mod12(an.key.root + i));
    const nextSec = an.sections.list[an.sections.list.indexOf(sec) + 1];
    phrases.forEach((plen, pi) => {
      const lastPhrase = pi === phrases.length - 1;
      // every phrase starts fresh on the contour: repeated phrases become identical (linked)
      if (!opts.varyRepeats) { state.prev = null; state.rep = 0; }
      for (let bi = 0; bi < plen; bi++, bar++) {
        const role = barRole(bi, plen);
        const chordSig = an.chords.filter(c => c.bar === bar).map(c => c.name).join('');
        // seed from the musical context -> repeated contexts give the same bar (linked patterns)
        const R = makeRand(ctx.seed ^ hash([ctx.role, sec.type, opts.varyRepeats ? 'p' + pi : (role === 'cadence' ? (lastPhrase ? 'close' : 'open') : 'p'), bi, role, chordSig, opts.varyRepeats ? sec.occ : 0, lastPhrase && isLastSection && role === 'cadence' ? 'end' : ''].join('|')));
        let cell;
        if (role === 'statement') cell = th.motif;
        else if (role === 'answer') cell = transform(R, th.motif, R.weighted([['repeat', .4], ['rhythm', .25 + opts.complexity * .2], ['invert', .15 + opts.complexity * .1], ['tail', .2]]));
        else if (role === 'develop') cell = sec.type === 'bridge' ? transform(R, th.motifB, 'invert') : th.motifB;
        else cell = th.motif;
        let cad = null;
        if (role === 'cadence') cad = lastPhrase ? 'closed' : 'open';
        if (sec.type === 'intro' && role !== 'cadence' && pi === 0 && bi === 0 && opts.introRest) { bars.push({ bar, notes: [] }); continue; }
        if (answers && bi % 2 === 0) { bars.push({ bar, notes: [] }); continue; }
        if (answers) { cell = th.motif.filter(x => x.p >= 4).slice(0, 4); if (!cell.length) cell = [{ p: 6, dur: 2, step: 0 }, { p: 8, dur: 4, step: 1 }]; cad = null; }
        // fast runs: solos and the climax of choruses / pre-choruses
        const hot = sec.type === 'solo' || ((sec.type === 'chorus' || sec.type === 'pre') && role === 'develop');
        if (mel.fast && hot && !cad && R.chance(0.7)) cell = runCell(R, cell);
        // triplets where they sound natural: answers / developments / pickups into a cadence
        if (mel.triplets && !answers && (role === 'develop' || role === 'answer' || (cad && R.chance(0.4))) && R.chance(sec.type === 'solo' || sec.type === 'bridge' ? 0.7 : 0.4)) cell = tripletCell(R, cell, !!cad);
        // pickup run into a chorus
        if (mel.fast && cad && nextSec && nextSec.type === 'chorus' && lastPhrase && bi === plen - 1) cad = 'pickup';
        const notes = realizeBar(ctx, R, cell, bar, state, {
          cadence: cad, final: isLastSection && lastPhrase && role === 'cadence',
          phrasePos0: bi / plen, phraseLen: plen, center, climax: th.climax * (counter ? 0.5 : 1), prof,
          sparse: (sec.type === 'intro' || sec.type === 'outro' ? 0.35 : 0) + (counter ? 0.35 : 0)
        });
        bars.push({ bar, notes, idx: bi + pi * phraseBars, role, cad });
      }
    });
    an.scale = savedScale;
    if (counter && ctx.lead) bars.forEach(b => counterFit(ctx, b));
    if (ctx.track.type === 'guitar' || ctx.track.type === 'bass') bars.forEach(b => assignFrets(ctx, b.notes, state));
    if (mel.any || (opts.techniques && ctx.track.type === 'guitar')) bars.forEach(b => leadTechniques(ctx, b, sec));
    return bars;
  }

  /** Scale used by the melody in a section type */
  function sectionScale(ctx, type) {
    const st = ctx.style && ctx.style.melody && ctx.style.melody.scales;
    const minor = ctx.an.key.mode === 'minor';
    if (st && (st[type] || st.all) && (ctx.mel.modes || st.always)) {
      let v = st[type] || st.all;
      if (v && typeof v === 'object') v = v[minor ? 'minor' : 'major'];
      if (v) return v;
    }
    if (!ctx.mel.modes) return null;
    return { verse: minor ? 'Dorian' : 'Mixolydian', bridge: minor ? 'Harmonic Minor' : 'Lydian', solo: minor ? 'Minor Pentatonic' : 'Major Pentatonic', pre: minor ? 'Dorian' : null }[type] || null;
  }
  /** A fast 16th-note run (second half of the bar), keeps the first long note of the cell */
  function runCell(R, cell) {
    const first = cell[0] || { p: 0, dur: 4, step: 0 };
    const out = [{ p: first.p, dur: Math.max(2, 8 - first.p) > 0 ? 8 - first.p : 4, step: first.step }];
    const dir = R.chance(0.55) ? 1 : -1;
    for (let p = 8; p < 16; p++) out.push({ p, dur: 1, step: p === 12 && R.chance(0.4) ? -dir : dir, run: true });
    return out;
  }
  /** Replace one beat of the cell by an 8th-note triplet (3 notes in the time of 2) */
  function tripletCell(R, cell, cadence) {
    const beats = cadence ? [4] : [0, 4, 8].filter(b => b !== 0 || !cadence);
    const b = R.pick(beats);
    const dir = R.chance(0.5) ? 1 : -1;
    const kept = cell.filter(x => x.p < b || x.p >= b + 4).map(x => Object.assign({}, x));
    kept.forEach(x => { if (x.p < b && x.p + x.dur > b) x.dur = b - x.p; });
    [0, 1, 2].forEach(k => kept.push({ p: b + k * 4 / 3, dur: 4 / 3, step: k ? dir : 1, tup: 3 }));
    return kept.sort((x, y) => x.p - y.p);
  }

  /** Turn a rhythmic / contour cell into pitches over the chords of one bar */
  function realizeBar(ctx, R, cell, bar, state, o) {
    const { an } = ctx;
    const [lo, hi] = ctx.range;
    let ons = cell.map(x => Object.assign({}, x));
    // calm sections (intro / outro): no 16ths, notes held to the next onset
    if (o.prof.energy < 0.45) { ons = ons.filter((x, i) => i === 0 || x.p % 2 === 0); ons.forEach((x, i) => { x.dur = (i < ons.length - 1 ? ons[i + 1].p : 16) - x.p; }); }
    if (o.sparse) ons = ons.filter((x, i) => i === 0 || !R.chance(o.sparse));
    if (o.cadence === 'pickup') {
      // last bar before a chorus: arrival on beat 1, then a rising 16th run into the chorus
      ons = [{ p: 0, dur: 8, step: 0 }].concat([8, 10, 12, 13, 14, 15].map((p, i) => ({ p, dur: i < 2 ? 2 : 1, step: 1, run: true })));
      o.cadence = null;
    }
    if (o.cadence) {
      // cadence bar: a short pickup then a long arrival note
      const keep = ons.filter(x => x.p < 8).slice(0, o.final ? 2 : 3);
      const arriveAt = keep.length ? Math.max(8, keep[keep.length - 1].p + 2) : 0;
      if (arriveAt >= 16) keep.length = Math.max(0, keep.length - 1);
      keep.forEach((x, i) => { const nx = i < keep.length - 1 ? keep[i + 1].p : (keep.length ? Math.min(arriveAt, 14) : 0); x.dur = Math.max(1, nx - x.p); });
      const at = keep.length ? Math.min(arriveAt, 12) : 0;
      ons = keep.filter(x => x.p < at).concat([{ p: at, dur: o.cadence === 'closed' ? 16 - at : Math.max(4, 14 - at), step: -1, arrival: true }]);
    }
    const out = [];
    ons.forEach((x, i) => {
      const tick = bar * BAR + x.p;
      const ch = an.chordAt(tick);
      const sc = localScale(an, ch);
      const pos = o.phrasePos0 + (x.p / 16) / o.phraseLen;
      const target = o.center + arch(pos) * o.climax - (o.cadence && x.arrival ? 2 : 0);
      let cand = state.prev === null ? snapTo(Math.round(target), sc) : stepScale(state.prev, x.step || 0, sc);
      // gravity toward the phrase contour
      if (cand - target > 6) cand = stepScale(cand, cand - target > 10 ? -2 : -1, sc);
      else if (target - cand > 6) cand = stepScale(cand, target - cand > 10 ? 2 : 1, sc);
      const strong = (x.p % 8 === 0 || x.dur >= 4 || x.arrival) && !x.run && !x.tup;
      let pitch;
      if (x.arrival) {
        const tonicIn = ch.pcs.includes(an.key.root);
        let pcs;
        if (o.cadence === 'closed') pcs = tonicIn ? [an.key.root] : [ch.root];
        else pcs = ch.pcs.filter(pc => pc !== an.key.root).slice(1).concat(ch.pcs.filter(pc => pc !== an.key.root)).slice(0, 2);
        if (!pcs.length) pcs = ch.pcs;
        pitch = fold(snapTo(state.prev === null ? cand : state.prev, pcs, -1), lo, hi);
      } else if (strong) pitch = chordTone(cand, ch, target, lo, hi, state.rep >= 2 ? state.prev : null);
      else pitch = snapTo(cand, sc, x.step || 1);
      if (pitch === state.prev && state.rep >= 2) pitch = strong ? chordTone(pitch + 2, ch, target, lo, hi, pitch) : stepScale(pitch, R.chance(.5) ? 1 : -1, sc);
      pitch = fold(pitch, lo, hi);
      const vel = Math.round(clamp(ctx.baseVel + (x.p % 4 === 0 ? 7 : 0) + (x.p === 0 ? 5 : 0) + arch(pos) * 7 + R.range(-4, 4) - (x.p % 2 ? 6 : 0), 35, 127));
      const nn = { start: x.p, dur: x.tup ? x.dur : Math.max(1, Math.min(x.dur, 16 - x.p)), pitch, vel, tech: {} };
      if (x.tup) nn.tup = 3;
      out.push(nn);
      state.rep = pitch === state.prev ? state.rep + 1 : 0;
      state.prev = pitch;
    });
    return out;
  }

  /** Counter-melody: leave room for the lead and harmonize under it */
  function counterFit(ctx, b) {
    const lead = ctx.lead, t0 = b.bar * BAR;
    const R = makeRand(ctx.seed ^ hash('cf' + b.notes.map(n => n.pitch + ':' + n.start).join(',')));
    b.notes = b.notes.filter(n => {
      const ln = lead.find(l => l.start <= t0 + n.start && l.start + l.dur > t0 + n.start);
      const leadAttack = lead.some(l => Math.abs(l.start - (t0 + n.start)) < 1);
      if (leadAttack && R.chance(0.65)) return false;
      if (ln) {
        // a 3rd or 6th below the lead, on a chord / scale tone
        const ch = ctx.an.chordAt(t0 + n.start), sc = localScale(ctx.an, ch);
        const want = [ln.pitch - 3, ln.pitch - 4, ln.pitch - 8, ln.pitch - 9].map(p => fold(p, ctx.range[0], ctx.range[1]));
        const pick = want.find(p => ch.pcs.includes(mod12(p))) || want.find(p => sc.includes(mod12(p)));
        if (pick) n.pitch = pick;
      }
      return true;
    });
  }

  /** Strings / frets for guitar and bass (hand position kept near the last note) */
  function assignFrets(ctx, notes, state) {
    // notes that start together (harmony, octaves, double stops) never share a string
    const byStart = {};
    notes.forEach(n => {
      const used = byStart[n.start] = byStart[n.start] || new Set();
      if (n.string !== undefined && !used.has(n.string)) { used.add(n.string); return; }
      const pos = ctx.track.type === 'bass' ? SDAW.autoFretBass(n.pitch, used) : SDAW.autoFret(n.pitch, used, state.hand);
      if (pos) { n.string = pos.string; n.fret = pos.fret; used.add(pos.string); if (ctx.track.type !== 'bass') state.hand = clamp(pos.fret, 2, 14); }
    });
  }

  /**
   * Expressive techniques on a generated lead line. The options say WHAT may be
   * used; the musical context decides WHERE:
   *   vibrato    long notes at phrase ends (and in choruses / solos)
   *   bends      strong long notes in choruses and solos (half or full step,
   *              chosen from the scale), release bends in solos
   *   slides     between notes a 3rd–5th apart, slide-ins at phrase starts (verses)
   *   hammer / pull   fast steps on the same string (guitar)
   *   harmonics  long arrival notes of intros, bridges and outros (guitar, 12th fret)
   */
  function leadTechniques(ctx, b, sec) {
    const mel = ctx.mel;
    const R = makeRand(ctx.seed ^ hash('gt' + sec.type + b.role + JSON.stringify(b.notes.map(n => n.pitch))));
    const hot = sec.type === 'chorus' || sec.type === 'solo';
    const gtr = ctx.track.type === 'guitar';
    const amount = 0.4 + ctx.opts.complexity * 0.6;
    const ns = b.notes;
    const sc = ctx.an.scale;
    ns.forEach((n, i) => {
      const prev = ns[i - 1];
      const last = i === ns.length - 1;
      if (mel.vibrato !== false && n.dur >= 6 && (last || hot) && R.chance(hot ? 0.75 : 0.5)) n.tech.vib = true;
      // natural harmonic on a long calm arrival note
      if (gtr && mel.harmonics && last && n.dur >= 8 && /intro|outro|bridge/.test(sec.type)) {
        const ch = ctx.an.chordAt(b.bar * BAR + n.start), tun = CONFIG.guitar.tuning;
        const s12 = [5, 4, 3, 2].find(st => ch.pcs.includes(mod12(tun[st] + 12)));
        if (s12 !== undefined) { n.pitch = tun[s12] + 12; n.string = s12; n.fret = 12; n.tech = { harm: true }; return; }
      }
      // bends into strong long notes
      if ((mel.bends || (gtr && ctx.opts.techniques && !mel.any && ctx.style?.melody?.licks !== 'jazz' && ctx.opts.genre !== 'Jazz')) && n.dur >= 4 && Number.isInteger(n.start) && n.start % 4 === 0 && (hot || R.chance(0.3))) {
        const half = sc.includes(mod12(n.pitch - 1)) && !sc.includes(mod12(n.pitch - 2));
        const amt = half ? 1 : 2;
        if ((!gtr || (n.fret !== undefined && n.fret >= amt + 2)) && R.chance((hot ? 0.3 : 0.12) * (mel.bends ? 1.4 : 1))) {
          n.pitch -= amt; if (gtr) n.fret -= amt;
          n.tech.bend = amt; n.tech.bendType = sec.type === 'solo' && R.chance(0.4) ? 'release' : 'up';
          delete n.tech.vib; return;
        }
      }
      if (!prev) {
        if ((mel.slides) && sec.type === 'verse' && b.idx % 4 === 0 && R.chance(0.3)) n.tech.slide = 'inBelow';
        return;
      }
      const d = n.pitch - prev.pitch;
      const fast = prev.dur <= 2;
      const same = !gtr || prev.string === n.string;
      if (gtr && same && d > 0 && d <= 3 && fast && R.chance(0.28 * amount)) n.tech.h = true;
      else if (gtr && same && d < 0 && d >= -3 && fast && R.chance(0.24 * amount)) n.tech.p = true;
      else if (same && Math.abs(d) >= 3 && Math.abs(d) <= 7 && R.chance((hot ? 0.14 : 0.06) * amount * (mel.slides ? 2.4 : (gtr ? 1 : 0)))) n.tech.slide = R.chance(0.5) ? 'legato' : 'shift';
    });
  }

  /** Second voice (trombone / 2nd sax…): same rhythm as the lead, a 3rd or 6th below on chord / scale tones */
  function harmonizeSection(ctx, sec) {
    const lead = ctx.lead || [];
    const [lo, hi] = ctx.range;
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k, t0 = bar * BAR, notes = [], usedAt = {};
      lead.filter(n => n.start >= t0 && n.start < t0 + BAR).forEach(n => {
        const ch = ctx.an.chordAt(n.start), sc = localScale(ctx.an, ch);
        const cands = [3, 4, 8, 9, 5].map(iv => n.pitch - iv);
        let p = cands.find(c => ch.pcs.includes(mod12(c))) || cands.find(c => sc.includes(mod12(c))) || n.pitch - 12;
        if (ctx.play === 'unison') p = n.pitch - 12;
        p = fold(p, lo, hi);
        const nn = { start: n.start - t0, dur: n.dur, pitch: p, vel: Math.max(30, (n.vel || 90) - 8), tech: {} };
        if (n.tup) nn.tup = 3;
        ['vib', 'slide', 'stacc', 'accent'].forEach(t => { if (n.tech && n.tech[t]) nn.tech[t] = n.tech[t]; });
        if (ctx.track.type === 'guitar') {
          // a second guitar in harmony (twin leads): the same bends and vibrato, a playable position near the lead's
          ['bend', 'bendType', 'wvib'].forEach(t => { if (n.tech && n.tech[t] !== undefined) nn.tech[t] = n.tech[t]; });
          const key = nn.start, used = (usedAt[key] = usedAt[key] || new Set());
          const pos = SDAW.autoFret(p, used, n.fret !== undefined ? Math.max(1, n.fret - 1) : 7);
          if (!pos) return;
          nn.string = pos.string; nn.fret = pos.fret; used.add(pos.string);
        }
        notes.push(nn);
      });
      bars.push({ bar, notes });
    }
    return bars;
  }

  /* ----------------------------------------------------------- HARMONY --- */
  /** Candidate voicings of a chord inside a range */
  function voicings(ch, lo, hi, complexity) {
    const tones = ch.intervals.slice(0, 4).map(i => mod12(ch.root + i));
    const out = [];
    for (let inv = 0; inv < tones.length; inv++) {
      const order = tones.slice(inv).concat(tones.slice(0, inv));
      for (let base = lo; base < lo + 12; base++) {
        if (mod12(base) !== order[0]) continue;
        const v = [base];
        for (let k = 1; k < order.length; k++) { let p = v[k - 1] + 1; while (mod12(p) !== order[k]) p++; v.push(p); }
        if (tones.length === 3 && complexity > 0.3) v.push(v[0] + 12);      // doubled root / 4 voices
        if (v[v.length - 1] <= hi) out.push(v);
        if (v[v.length - 1] + 12 <= hi) out.push(v.map(p => p + 12));
        // drop-2 (open) voicing
        if (complexity > 0.55 && v.length >= 4) { const d = v.slice(); const x = d.splice(d.length - 2, 1)[0] - 12; if (x >= lo - 5) out.push([x].concat(d)); }
      }
    }
    return out;
  }
  function voiceLead(prev, cands, lo, hi) {
    const mid = (lo + hi) / 2;
    let best = null;
    cands.forEach(v => {
      let cost = 0;
      if (prev) {
        const n = Math.max(prev.length, v.length);
        for (let i = 0; i < n; i++) cost += Math.abs((v[Math.min(i, v.length - 1)]) - (prev[Math.min(i, prev.length - 1)]));
        cost += Math.abs(v[v.length - 1] - prev[prev.length - 1]) * 0.6;   // smooth top line
      } else cost = Math.abs((v[0] + v[v.length - 1]) / 2 - mid) * 2;
      if (v[0] < 52 && v.length > 1 && v[1] - v[0] < 5) cost += 6;         // no muddy low intervals
      cost += Math.abs((v[0] + v[v.length - 1]) / 2 - mid) * 0.25;
      if (!best || cost < best.c) best = { v, c: cost };
    });
    return best ? best.v : null;
  }
  /** Comping onsets of one bar for a section style */
  function compHits(ctx, style, R) {
    const acc = ctx.an.rhythm.accent;
    if (style === 'pad') return [[0, 16]];
    const pos = [];
    if (style === 'light') { pos.push(0); const ranked = [...Array(16).keys()].filter(p => p && p % 2 === 0).sort((a, b) => acc[b] - acc[a]); pos.push(...ranked.slice(0, R.int(1, 2) + Math.round(ctx.opts.density))); }
    else if (style === 'push' || style === 'full') {
      for (let p = 0; p < 16; p += (ctx.an.rhythm.sixteenth && style === 'full' ? 1 : 2)) if (p === 0 || acc[p] > (style === 'full' ? 0.42 : 0.55) - ctx.opts.density * 0.15) pos.push(p);
      if (pos.length > 7) pos.length = 7;
    }
    pos.sort((a, b) => a - b);
    const uniq = [...new Set(pos)];
    return uniq.map((p, i) => { const nx = i < uniq.length - 1 ? uniq[i + 1] : 16; const len = nx - p; return [p, style === 'full' ? Math.max(1, Math.round(len * 0.7)) : len]; });
  }
  function harmonySection(ctx, sec) {
    const { an, opts } = ctx;
    const prof = C.profiles[sec.type] || C.profiles.part;
    const [lo, hi] = ctx.range;
    let style = ctx.track.type === 'strings' ? 'pad' : prof.comp;
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k;
      const chordSig = an.chords.filter(c => c.bar === bar).map(c => c.name).join('');
      const R = makeRand(ctx.seed ^ hash(['h', sec.type, k % 4, chordSig, style].join('|')));
      const notes = [];
      const lastBar = k === sec.length - 1;
      const st = (sec.type === 'outro' && lastBar) ? 'pad' : style;
      if (st === 'arp') { arpBar(ctx, bar, notes, R, prof); bars.push({ bar, notes }); continue; }
      compHits(ctx, st, R).forEach(([p, len]) => {
        const ch = an.chordAt(bar * BAR + p);
        // a chord change inside a long hit: split it
        const nextCh = an.chordAt(bar * BAR + p + len - 1);
        const segs = nextCh.name !== ch.name && len > 8 ? [[p, 8 - p % 8, ch], [p + 8 - p % 8, len - (8 - p % 8), nextCh]] : [[p, len, ch]];
        segs.forEach(([sp, sl, sc]) => {
          const v = voiceLead(ctx.prevVoicing, voicings(sc, lo, hi, opts.complexity), lo, hi);
          if (!v) return;
          ctx.prevVoicing = v;
          const vel = Math.round(clamp(ctx.baseVel - 10 + (sp === 0 ? 8 : 0) + an.rhythm.accent[sp] * 8 + R.range(-3, 3), 30, 120));
          v.forEach((pitch, i) => notes.push({ start: sp, dur: Math.max(1, Math.min(sl, 16 - sp)), pitch, vel: vel - (i ? 6 : 0), tech: {} }));
        });
      });
      bars.push({ bar, notes });
    }
    return bars;
  }
  function arpBar(ctx, bar, notes, R, prof) {
    const { an } = ctx;
    const [lo, hi] = ctx.range;
    const step = prof.energy > 0.8 || an.rhythm.sixteenth ? 1 : 2;
    const shape = R.pick(['up', 'updown', 'down', 'pinky']);
    let idx = 0;
    for (let p = 0; p < 16; p += step) {
      const ch = an.chordAt(bar * BAR + p);
      const v = voiceLead(ctx.prevVoicing, voicings(ch, lo, hi, 0.4), lo, hi) || [60, 64, 67];
      if (p % 8 === 0) ctx.prevVoicing = v;
      const seq = shape === 'up' ? v : shape === 'down' ? v.slice().reverse() : shape === 'updown' ? v.concat(v.slice(1, -1).reverse()) : [v[0], v[v.length - 1], v[1], v[v.length - 1]];
      const pitch = seq[idx % seq.length]; idx++;
      const n = { start: p, dur: step * (ctx.track.type === 'guitar' ? 2 : 1), pitch, vel: Math.round(ctx.baseVel - 12 + (p % 4 === 0 ? 8 : 0) + R.range(-3, 3)), tech: {} };
      n.dur = Math.min(n.dur, 16 - p);
      if (ctx.track.type === 'guitar') { const pos = SDAW.autoFret(pitch, null, 5); if (pos) { n.string = pos.string; n.fret = pos.fret; } n.tech.ring = true; }
      notes.push(n);
    }
  }

  /* -------------------------------------------------------------- STRUM --- */
  function strumSection(ctx, sec) {
    const { an } = ctx;
    const prof = C.profiles[sec.type] || C.profiles.part;
    const tuning = CONFIG.guitar.tuning, shapes = {};
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k, notes = [];
      const R = makeRand(ctx.seed ^ hash('s' + sec.type + k % 4));
      const last = sec.type === 'outro' && k === sec.length - 1;
      let hits;
      if (prof.comp === 'pad' || last) hits = [[0, 16, 'down']];
      else if (prof.comp === 'light') hits = [[0, 6, 'down'], [6, 2, 'up'], [8, 4, 'down'], [12, 4, 'up']];
      else {
        hits = [];
        for (let p = 0; p < 16; p += 2) if (p % 4 === 0 || an.rhythm.accent[p] > 0.4 - ctx.opts.density * 0.2 || R.chance(prof.energy * 0.5)) hits.push([p, 0, p % 4 === 0 ? 'down' : 'up']);
        hits.forEach((h, i) => { h[1] = (i < hits.length - 1 ? hits[i + 1][0] : 16) - h[0]; });
      }
      hits.forEach(([p, len, dir]) => {
        const ch = an.chordAt(bar * BAR + p);
        const frets = shapes[ch.name] = shapes[ch.name] || SDAW.chordVoicing(ch.root, ch.intervals);
        frets.forEach((f, s) => {
          if (f < 0) return;
          if (dir === 'up' && s < 2) return;           // upstrokes hit the treble strings
          notes.push({ start: p, dur: len, pitch: tuning[s] + f, vel: Math.round(clamp(ctx.baseVel + (dir === 'down' ? 0 : -14) + (p === 0 ? 6 : 0), 30, 120)), string: s, fret: f, tech: { strum: dir } });
        });
      });
      bars.push({ bar, notes });
    }
    return bars;
  }

  /* --------------------------------------------------------------- BASS --- */
  function bassSection(ctx, sec) {
    const { an, opts } = ctx;
    const prof = C.profiles[sec.type] || C.profiles.part;
    const [lo, hi] = ctx.range;
    const kick = an.rhythm.kick;
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k;
      const chordSig = an.chords.filter(c => c.bar === bar || c.bar === bar + 1).map(c => c.name).join('');
      const R = makeRand(ctx.seed ^ hash(['b', sec.type, k % 4, chordSig, k === sec.length - 1].join('|')));
      let pos;
      if (prof.comp === 'pad') pos = [0, 8];
      else if (an.rhythm.hasDrums) { pos = [0]; for (let p = 1; p < 16; p++) if (kick[p] > 0.45 - opts.density * 0.15) pos.push(p); if (pos.length < 2) pos.push(8); }
      else pos = prof.energy > 0.8 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 12];
      if (prof.move > 0.5 && R.chance(prof.move)) pos.push(14);
      pos = [...new Set(pos)].sort((a, b) => a - b);
      const notes = [];
      pos.forEach((p, i) => {
        const tick = bar * BAR + p, ch = an.chordAt(tick);
        const nx = i < pos.length - 1 ? pos[i + 1] : 16;
        const nextCh = an.chordAt(bar * BAR + nx);
        let root = fold((ch.bass !== undefined ? ch.bass : ch.root) + 36, lo, hi - 7);   // slash chords: the written bass
        if (ctx.prevBass !== null && Math.abs(root + 12 - ctx.prevBass) < Math.abs(root - ctx.prevBass) && root + 12 <= hi - 4) root += 12;
        let pitch = root;
        const changeAhead = nextCh.name !== ch.name || (nx === 16 && an.chordAt((bar + 1) * BAR).name !== ch.name);
        if (p === 0 || an.chordAt(tick - 1).name !== ch.name) pitch = root;
        else if (changeAhead && nx - p <= 4 && R.chance(0.55 + prof.move * 0.3)) {
          // approach note into the next root (scale step or chromatic)
          const target = fold((nx === 16 ? an.chordAt((bar + 1) * BAR) : nextCh).root + 36, lo, hi - 7);
          const sc = localScale(an, ch);
          pitch = R.chance(0.5) ? target + (target > root ? -1 : 1) : snapTo(target + (target > root ? -2 : 2), sc);
        } else pitch = R.weighted([[root, 1.2], [root + 7, prof.move], [root + 12, prof.move * 0.6], [root + (ch.intervals[1] || 4), prof.move * 0.3]]);
        pitch = fold(pitch, lo, hi);
        const dur = Math.max(1, Math.round((nx - p) * (prof.comp === 'full' ? 0.75 : 0.95)));
        const n = { start: p, dur, pitch, vel: Math.round(clamp(ctx.baseVel + (p === 0 ? 8 : 0) + kick[p] * 6 + R.range(-3, 3), 40, 127)), tech: {} };
        const fp = SDAW.autoFretBass(pitch); if (fp) { n.string = fp.string; n.fret = fp.fret; }
        notes.push(n);
        ctx.prevBass = pitch;
      });
      bars.push({ bar, notes });
    }
    return bars;
  }

  /* -------------------------------------------------------------- DRUMS --- */
  function drumSection(ctx, sec, isLastSection) {
    const { an } = ctx;
    const prof = C.profiles[sec.type] || C.profiles.part;
    const rh = an.rhythm;
    // base groove: the groove found in the song, or a standard backbeat
    const base = {};
    if (rh.hasDrums) { base.kick = rh.kick.map(v => v > 0.4 ? 1 : 0); base.snare = rh.snare.map(v => v > 0.4 ? 1 : 0); base.hhc = rh.hat.map(v => v > 0.3 ? 0.8 : 0); }
    else { base.kick = [...Array(16)].map((_, p) => p === 0 || p === 8 || (p === 10 && rh.syncopation > 0.3) ? 1 : 0); base.snare = [...Array(16)].map((_, p) => p === 4 || p === 12 ? 1 : 0); base.hhc = [...Array(16)].map((_, p) => p % 2 === 0 ? 0.8 : 0); }
    if (!base.hhc.some(v => v)) base.hhc = [...Array(16)].map((_, p) => p % 2 === 0 ? 0.75 : 0);
    const bars = [];
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k, rows = {};
      SDAW.DRUM_ROWS.forEach(r => { rows[r.id] = new Array(16).fill(0); });
      const R = makeRand(ctx.seed ^ hash('d' + sec.type + k));
      const lastBar = k === sec.length - 1;
      const e = prof.energy * (0.7 + ctx.opts.density * 0.6);
      const set = (row, p, v) => { rows[row][p] = Math.max(rows[row][p], clamp(v, 0, 1)); };
      if (sec.type === 'intro') {
        base.kick.forEach((v, p) => { if (v && p % 8 === 0) set('kick', p, 0.7); });
        for (let p = 0; p < 16; p += 4) set('hhc', p, 0.55);
        if (k >= sec.length - 2) base.snare.forEach((v, p) => { if (v) set('snare', p, 0.6); });
      } else if (sec.type === 'bridge') {
        base.kick.forEach((v, p) => { if (v && p < 8) set('kick', p, 0.85); });
        set('snare', 8, 0.95);
        for (let p = 0; p < 16; p += 2) set('ride', p, 0.6);
        if (k % 2 === 1) { set('tom1', 12, 0.7); set('tom2', 14, 0.75); }
      } else {
        base.kick.forEach((v, p) => { if (v) set('kick', p, 0.95); });
        base.snare.forEach((v, p) => { if (v) set('snare', p, 0.95); });
        const hatRow = sec.type === 'chorus' || sec.type === 'solo' ? (R.chance(0.5) ? 'ride' : 'hhc') : 'hhc';
        base.hhc.forEach((v, p) => { if (v) set(hatRow, p, v * (p % 4 === 0 ? 1 : 0.75)); });
        if (e > 0.75) { set('hho', 6, 0.7); set('hho', 14, 0.7); if (R.chance(0.6)) set('kick', R.pick([6, 10, 14]), 0.75); }
        if (sec.type === 'pre' && lastBar) for (let p = 8; p < 16; p++) set('snare', p, 0.4 + (p - 8) * 0.07);
      }
      if (k === 0 && sec.type !== 'intro') set('crash', 0, 0.95);
      // fills on the last bar of each section (the final bar of the song stops on a crash)
      if (lastBar && isLastSection && sec.type !== 'intro') {
        SDAW.DRUM_ROWS.forEach(r => rows[r.id].fill(0)); set('kick', 0, 1); set('crash', 0, 1);
      } else if (lastBar && sec.type !== 'intro' && sec.length > 1) {
        for (let p = 8; p < 16; p++) { rows.hhc[p] = 0; rows.ride[p] = 0; }
        const fill = R.pick([['snare', 'snare', 'tom1', 'tom1', 'tom2', 'tom2', 'snare', 'snare'], ['tom1', 'tom1', 'tom2', 'tom2', 'snare', 'snare', 'snare', 'snare'], ['snare', 0, 'snare', 'tom1', 0, 'tom2', 'tom2', 'kick']]);
        fill.forEach((row, i) => { if (row && (e > 0.6 || i % 2 === 0)) set(row, 8 + i, 0.6 + i * 0.05); });
      }
      bars.push({ bar, rows });
    }
    return bars;
  }

  /* ========================================================== GENERATE == */

  /**
   * Generate a part.
   * opts: { trackId, role, seed, density 0..1, complexity 0..1, register -1|0|1,
   *         sections: [section keys], mode 'replace'|'empty', link, varyRepeats,
   *         techniques, writeChords, writeSections, addOutro }
   */
  AG.generate = function (opts) {
    const s = SDAW.store, song = s.song;
    const track = s.track(opts.trackId);
    if (!track) return SDAW.toast('Select a track first');
    const meter = AG.meterSupport(song);
    if (!meter.ok) return SDAW.toast(meter.text);
    let role = opts.role === 'auto' ? AG.autoRole(track, song) : opts.role;
    if (track.type === 'drums') role = 'drums';
    else if (role === 'drums') return SDAW.toast('Drums can only be generated on a drum track');
    const before = song.bars;
    s.mutate('Auto Generate (' + role + ')', () => {
      if (meter.B === BAR) AG.generateRaw(opts);
      else AG.generateInMeter(opts, meter.B);
      // the recipe of this part (seed + options), shown in the dialog to reuse the idea
      const t = s.track(opts.trackId);
      if (t) t.gen = { by: 'autogen', seed: opts.seed || 1, role, style: typeof opts.style === 'string' ? opts.style : (opts.style && opts.style.name) || null };
    });
    const n = AG.lastCount || { bars: 0, patterns: 0 };
    SDAW.toast('✨ Generated ' + role + ': ' + n.bars + ' bars · ' + n.patterns + ' patterns' + (AG.lastIntro ? ' · 4-bar Intro added (song moved 4 bars)' : '') + (song.bars > before + (AG.lastIntro ? 4 : 0) ? ' · Outro added' : '') + ' — Ctrl+Z undoes');
    AG.lastIntro = false;
  };

  /**
   * The generator itself, without undo step (used inside store.mutate, and by
   * the Full Song generator for every track).
   * Extra opts: style (style object or name), play (playing style of the track),
   *   levels { sectionType: 0 | 0.5 | 1 } (0 = silent, 0.5 = sparse / answers),
   *   melody { complex, fast, triplets, modes, slides, harmonics, bends, vibrato },
   *   leadTrackId (horn2: the line to harmonize)
   */
  /**
   * Which time signatures Auto Generate Track can write in.
   *   4/4 (16 ticks per bar)            the full generator
   *   2/4, 3/4, 6/8, 3/8 … (< 16 ticks) the parts are generated on a 4/4 grid and cut to the
   *                                     real bar: clips, chords and phrases follow the real bars,
   *                                     but grooves keep 4/4 accents (6/8 sounds like 3/4)
   *   5/4, 6/4, 12/8 … (> 16 ticks)     not supported yet (the grooves would need new patterns)
   */
  AG.meterSupport = function (song) {
    const ts = SDAW.timeSig(song), B = SDAW.barTicks(song), name = ts.num + '/' + ts.den;
    if (B === BAR) return { ok: true, B, exact: true, name };
    if (B < BAR && B >= 4) return { ok: true, B, exact: false, name,
      text: 'In ' + name + ' the parts are written bar by bar in the real ' + name + ' bars, with the accents of ' + name +
        (ts.den === 8 && ts.num === 6 ? ': the long–short lilt of 6/8, kick on 1, backbeat on the 2nd pulse, cymbals in 8ths.' : ts.num === 3 ? ': strong beat 1, kick on 1 and the backbeat on beats 2 and 3 (waltz).' : ': strong beat 1.') };
    return { ok: false, B, name, text: 'Auto Generate Track cannot write in ' + name + ' yet (bars longer than 4/4 need grooves of their own). Use 4/4, 3/4, 2/4 or 6/8, or change Time Sig. on the toolbar.' };
  };
  /* ------------------------------------------------------------ METER ---
   * A bar generated in 4/4 (16 ticks) → a bar of the real meter, with the accents of that meter:
   *   6/8   the 4 beats of 4/4 become the long–short lilt of 6/8 (quarter + eighth, twice):
   *         beat 1 → 8th 1 (a quarter), beat 2 → 8th 3, beat 3 → 8th 4 (the 2nd pulse), beat 4 → 8th 6.
   *         Drums: kick on 1, the backbeat on the 2nd pulse (8th 4), hi-hat / ride on every 8th
   *         with the accents on the two pulses.
   *   3/4   the first three beats are kept; beat 1 is the strong one (beats 2 and 3 lighter).
   *         Drums: kick on 1, the backbeat on beats 2 and 3 (waltz), cymbals kept.
   *   2/4   the first two beats are kept; beat 1 strong.
   * Velocity weights per beat: CONFIG below (CONFIG.meterAccent).
   */
  C.meterAccent = C.meterAccent || { strong: 1.0, pulse: 0.92, weak: 0.84, offbeat: 0.8 };
  AG.fitMeter = function (b, B, ts, role) {
    const A = C.meterAccent, compound = ts.den === 8 && ts.num === 6;
    const clampV = v => Math.max(1, Math.min(127, Math.round(v)));
    // 6/8 time map: [start, length] of each 4/4 beat inside the 12-tick bar
    const LILT = [[0, 4], [4, 2], [6, 4], [10, 2]];
    const map68 = t => { const q = Math.min(3, Math.floor(t / 4)), u = t - q * 4; return LILT[q][0] + u * LILT[q][1] / 4; };
    const weight = t => {
      const r = Math.round(t * 1000) / 1000;
      if (compound) return r === 0 ? A.strong : r === 6 ? A.pulse : r % 2 === 0 ? A.weak : A.offbeat;
      const beat = 16 / ts.den;                            // a quarter in 3/4 and 2/4
      return r === 0 ? A.strong : r % beat === 0 ? A.weak : A.offbeat;
    };
    if (b.rows) {
      const R = b.rows, out = {};
      Object.keys(R).forEach(k => {
        const src = R[k], dst = new Array(B).fill(0);
        // 6/8 drums sit on the 8th-note grid (a 4/4 off-beat of a short beat would land on a 16th)
        src.forEach((v, i) => { if (!v) return; const j = compound ? Math.min(B - 2, Math.round(map68(i) / 2) * 2) : i; if (j < B && v > dst[j]) dst[j] = v; });
        out[k] = dst;
      });
      const peak = row => (R[row] || []).reduce((a, v) => Math.max(a, v || 0), 0);
      if (compound || B === 12) {
        // the backbeat: one snare on the 2nd pulse (6/8) / on beats 2 and 3 (3/4); ghost notes kept softer
        const sn = peak('snare'), back = compound ? [6] : [4, 8];
        if (sn > 0 && out.snare) {
          // the 4/4 backbeats are replaced (not kept as ghosts): only real ghost notes (soft hits) stay
          const ghosts = new Array(B).fill(0);
          (R.snare || []).forEach((v, i) => { if (v && v < sn * 0.55) { const j = compound ? Math.min(B - 2, Math.round(map68(i) / 2) * 2) : i; if (j < B) ghosts[j] = Math.max(ghosts[j], v); } });
          out.snare = ghosts.map((v, i) => back.includes(i) ? 0 : v);
          back.forEach((i, k) => { out.snare[i] = sn * (compound ? 1 : (k ? 0.86 : 1)); });
        }
        // the kick leads each bar on beat 1; in 3/4 no kick on beats 2–3 (they belong to the backbeat)
        const kk = peak('kick');
        if (kk > 0 && out.kick) {
          out.kick[0] = Math.max(out.kick[0], kk);
          if (!compound) out.kick = out.kick.map((v, i) => i === 0 || i % 4 !== 0 ? v : 0);
          else out.kick[6] = 0;                              // 6/8: the 2nd pulse belongs to the snare
        }
        // 6/8 cymbals: every 8th, accented on the two pulses
        if (compound) ['hhc', 'ride'].forEach(row => {
          const pk = peak(row); if (!pk || !out[row]) return;
          for (let i = 0; i < B; i += 2) out[row][i] = pk * (i === 0 ? 1 : i === 6 ? 0.9 : 0.62);
        });
      }
      // the other rows take the accent of the meter (6/8 cymbals already have theirs)
      const own = k => k === 'snare' || k === 'kick' || (compound && (k === 'hhc' || k === 'ride'));
      Object.keys(out).forEach(k => { b.rows[k] = out[k].map((v, i) => v ? Math.min(1, v * (own(k) ? 1 : weight(i) / A.strong)) : 0); });
      return b;
    }
    if (b.notes) {
      b.notes = b.notes.map(n => {
        let start = n.start, dur = n.dur;
        // 6/8: mapped onto the 16th grid (a 16th of a short beat would land on a 32nd)
        if (compound) {
          const e = n.start + n.dur, grid = role === 'bass' ? 2 : 1;         // the bass on 8ths, melodies may use 16ths
          start = Math.min(B - grid, Math.round(map68(n.start) / grid) * grid);
          dur = Math.max(grid, Math.round(map68(Math.min(16, e)) / grid) * grid - start);
        }
        if (start >= B - 1e-6) return null;
        const o = Object.assign({}, n, { start: Math.round(start * 1000) / 1000, dur: Math.round(Math.min(dur, B - start) * 1000) / 1000 });
        o.vel = clampV((n.vel || 90) * weight(o.start));
        if (compound && o.tup) delete o.tup;                 // 6/8 is already ternary: no triplet brackets
        return o;
      }).filter(Boolean);
      if (compound) {
        // two notes that the map put on the same 16th: keep the first (stronger) one, shorten the one before
        const seen = new Set();
        b.notes = b.notes.filter(n => { const k = n.start + ':' + n.pitch; if (seen.has(k)) return false; seen.add(k); return true; });
        const byPitch = {};
        b.notes.slice().sort((x, y) => x.start - y.start).forEach(n => { const q = byPitch[n.pitch]; if (q && q.start + q.dur > n.start) q.dur = Math.max(1, n.start - q.start); byPitch[n.pitch] = n; });
      }
    }
    return b;
  };

  /** convert a song in place between bar lengths, keeping every bar's content ("bars" mode of setTimeSig) */
  function rebarSong(song, oldB, newB) {
    const map = t => { const b = Math.floor(t / oldB), w = t - b * oldB; return w >= newB - 1e-6 ? null : b * newB + w; };
    const mapLen = (start, len) => (start % oldB === 0 && len % oldB === 0) ? len / oldB * newB : Math.max(1, Math.round(len * newB / oldB));
    const done = new Set();
    song.patterns.forEach(p => {
      if (p.length % oldB) return;
      done.add(p.id);
      const nl = p.length / oldB * newB;
      if (p.kind === 'drums') Object.keys(p.drum.rows).forEach(r => { const old = p.drum.rows[r], out = new Array(nl).fill(0); old.forEach((v, i) => { const j = map(i); if (v && j !== null && j < nl) out[j] = v; }); p.drum.rows[r] = out; });
      else p.notes = p.notes.filter(n => { const j = map(n.start); if (j === null) return false; const end = Math.floor(n.start / oldB) * newB + newB; n.start = j; n.dur = Math.min(n.dur, end - j); return n.dur > 0.01; });
      p.length = nl;
    });
    song.tracks.forEach(t => t.clips.forEach(c => {
      const s0 = c.start;
      c.start = Math.floor(s0 / oldB) * newB + Math.min(newB - 1, s0 % oldB);
      c.len = mapLen(s0, c.len);
      if (c.kind === 'pattern' && c.offsetTicks && done.has(c.patternId)) c.offsetTicks = Math.round(c.offsetTicks / oldB * newB);
    }));
    song.chords = (song.chords || []).filter(c => { const j = map(c.tick); if (j === null) return false; c.tick = j; return true; });
  }
  AG.rebarSong = rebarSong;
  /**
   * Generate in a song whose bars are shorter than 4/4: the analysis and the generator run on a
   * 4/4 copy of the song (every bar keeps its content), and the new part is written into the
   * REAL song bar by bar (clips of one real bar, notes cut at the bar line). The rest of the song
   * is never touched; chord symbols and sections written by the generator are converted back.
   */
  AG.generateInMeter = function (opts, B) {
    const s = SDAW.store, real = s.song;
    const copy = SDAW.deepCopy(real);
    copy.timeSig = [4, 4];
    rebarSong(copy, B, BAR);
    const chords0 = JSON.stringify(copy.chords || []);
    s.song = copy;
    AG._out = { song: real, B };
    try { AG.generateRaw(Object.assign({}, opts, { addIntro: false })); }
    finally { s.song = real; AG._out = null; }
    if (JSON.stringify(copy.chords || []) !== chords0) {
      const back = SDAW.deepCopy({ patterns: [], tracks: [], chords: copy.chords || [] });
      rebarSong(back, BAR, B);
      real.chords = back.chords;
    }
    if ((copy.sections || []).length && JSON.stringify(copy.sections) !== JSON.stringify(real.sections || [])) real.sections = copy.sections;
    real.bars = Math.max(real.bars || 0, copy.bars || 0);
  };

  AG.generateRaw = function (opts) {
    const s = SDAW.store, song = s.song;
    const track = s.track(opts.trackId);
    if (!track) return;
    let an = AG.analyze(song, track.id);
    let role = opts.role === 'auto' ? AG.autoRole(track, song) : opts.role;
    if (track.type === 'drums') role = 'drums';
    if (role === 'strum' && track.type !== 'guitar') role = 'harmony';
    const style = typeof opts.style === 'string' ? (SDAW.STYLES || {})[opts.style] : opts.style || null;
    {
      // optional: a 4-bar Intro before the song (everything moves 4 bars right).
      // The intro takes the harmony of the first 4 bars, so every track can play it.
      if (opts.addIntro && !(an.sections.list[0] && an.sections.list[0].type === 'intro')) {
        song.sections = song.sections || [];
        if (!song.sections.length) an.sections.list.filter(x => !x.gap).forEach(x => song.sections.push({ id: SDAW.uid('s'), name: x.name, start: x.start, length: x.length, color: C.sectionColors[x.type] }));
        if (!(song.chords || []).length) { song.chords = []; let last = null; an.chords.forEach(c => { if (last !== c.name) song.chords.push({ tick: c.tick, name: c.name }); last = c.name; }); }
        const head = song.chords.filter(c => c.tick < 4 * BAR).map(c => ({ tick: c.tick, name: c.name }));
        if (!head.length || head[0].tick > 0) {            // the chord that sounds at bar 1
          const before = song.chords.filter(c => c.tick <= 0).pop() || song.chords[0];
          if (before) head.unshift({ tick: 0, name: before.name });
        }
        SDAW.insertBarsRaw(song, 0, 4);
        song.sections.unshift({ id: SDAW.uid('s'), name: 'Intro', start: 0, length: 4, color: C.sectionColors.intro });
        song.chords = head.concat(song.chords).sort((a, b) => a.tick - b.tick);
        an = AG.analyze(song, track.id);
        if (opts.sections) opts.sections = an.sections.list.filter(x => x.type === 'intro' && x.start === 0).map(x => x.key).concat(opts.sections.map(k => /^intro\d+$/.test(k) ? 'intro' + (+k.slice(5) + 1) : k));   // an older intro becomes intro2…
        AG.lastIntro = true;
      }
      // optional: extend the song with an Outro that resolves to the tonic
      if (opts.addOutro && !an.sections.list.some(x => x.type === 'outro')) {
        const start = an.bars, keyName = SDAW.NOTE_NAMES[an.key.root];
        const degs = an.key.mode === 'minor' ? [6, 4, 5, 1] : [4, 5, 1, 1];
        song.sections = song.sections || [];
        if (!song.sections.length) an.sections.list.forEach(x => song.sections.push({ id: SDAW.uid('s'), name: x.name, start: x.start, length: x.length, color: C.sectionColors[x.type] }));
        song.sections.push({ id: SDAW.uid('s'), name: 'Outro', start, length: 4, color: C.sectionColors.outro });
        song.chords = song.chords || [];
        degs.forEach((d, i) => { const ch = SDAW.diatonicChord(keyName, an.key.mode, d); song.chords.push({ tick: (start + i) * BAR, name: ch.name }); });
        song.chords.sort((a, b) => a.tick - b.tick);
        song.bars = Math.max(song.bars, start + 4);
        an = AG.analyze(song, track.id);
        opts.sections = (opts.sections || an.sections.list.map(x => x.key)).concat(an.sections.list.filter(x => x.type === 'outro').map(x => x.key));
      }
      if (opts.writeSections && an.sections.detected && !(song.sections || []).length)
        song.sections = an.sections.list.filter(x => !x.gap).map(x => ({ id: SDAW.uid('s'), name: x.name, start: x.start, length: x.length, color: C.sectionColors[x.type] }));
      if (opts.writeChords && !(song.chords || []).length) {
        song.chords = [];
        let last = null;
        an.chords.forEach(c => { if (!last || last !== c.name) song.chords.push({ tick: c.tick, name: c.name }); last = c.name; });
      }

      // generation context
      const rk = role === 'counter' || role === 'horn2' ? 'counter' : (role === 'melody' || role === 'horns' ? 'melody' : 'harmony');
      const range = role === 'bass' ? C.ranges.bass.slice() : (opts.range ? opts.range.slice() : (C.ranges[rk][track.type] || [55, 81]).slice());
      if (opts.register) { range[0] += opts.register * 5; range[1] += opts.register * 5; }
      const mid = Math.round((range[0] + range[1]) / 2);
      let center = mid - 3;
      const keysReg = an.register.keys || an.register.strings;
      // the melody sits a little above the accompaniment, never at the top of the range
      if ((role === 'melody' || role === 'horns') && keysReg) center = clamp(Math.max(center, keysReg.median + 5), range[0] + 6, mid);
      const m = opts.melody || {};
      const mel = Object.assign({}, m, { any: Object.keys(m).some(k => k !== 'hero' && k !== 'plan' && m[k]) });
      if (mel.complex) opts = Object.assign({}, opts, { complexity: clamp((opts.complexity || 0.5) + 0.3, 0, 1) });
      const ctx = {
        an, opts, role, track, range, center, themes: {}, seed: ((opts.seed >>> 0) || 1) ^ hash(track.name + role),
        prevVoicing: null, prevBass: null, baseVel: 84, style, play: opts.play || null, mel, level: 1
      };
      if (role === 'horn2' && opts.leadTrackId) { const lt = s.track(opts.leadTrackId); ctx.lead = lt ? s.trackNotes(lt) : []; }
      if (role === 'counter') {
        // the lead line = the highest melodic track that is not the target
        let lead = null, best = -1;
        song.tracks.forEach(t => { if (t.id === track.id || t.type === 'drums' || t.type === 'bass') return; const ns = s.trackNotes(t); if (!ns.length) return; const m = ns.reduce((a, n) => a + n.pitch, 0) / ns.length; if (m > best) { best = m; lead = ns; } });
        ctx.lead = lead;
      }

      const avoid = opts.avoidTrackId && SDAW.vocals ? s.track(opts.avoidTrackId) : null;
      const vocalNotes = avoid ? s.trackNotes(avoid) : null;
      const chosen = new Set(opts.sections || an.sections.list.map(x => x.key));
      const list = an.sections.list;
      const lastSec = list[list.length - 1];
      const results = [];
      list.forEach(sec => {
        if (!chosen.has(sec.key)) return;
        const prof = C.profiles[sec.type] || C.profiles.part;
        ctx.baseVel = Math.round(58 + prof.energy * 44);
        const isLast = sec === lastSec;
        ctx.level = opts.levels ? (opts.levels[sec.type] !== undefined ? opts.levels[sec.type] : (opts.levels.part !== undefined ? opts.levels.part : 1)) : 1;
        // LEAD PLAN (Full Song panel): what the lead plays in this section. "solo" builds the section with the
        // engine of the solos (its own phrases: the seed of a section of another type), "melody" a theme,
        // "riff" a repeated phrase, "fills" answers, "rest" silence. No plan / "auto" = the genre's normal way.
        let secG = sec, gapsOnly = false;
        ctx.leadMode = null;
        const want = role === 'melody' && mel.plan ? mel.plan[sec.type === 'part' ? 'verse' : sec.type] : null;
        if (want && want !== 'auto') {
          const uniq = 50 + list.indexOf(sec);
          if (want === 'rest') ctx.level = 0;
          else if (want === 'fills') ctx.level = 0.5;
          else {
            ctx.level = 1;
            if (want === 'solo') { secG = Object.assign({}, sec, { type: 'solo', occ: uniq }); ctx.baseVel = Math.round(58 + (C.profiles.solo || prof).energy * 44); }
            else if (want === 'melody' && sec.type === 'solo') secG = Object.assign({}, sec, { type: 'chorus', occ: uniq });
            else if (want === 'riff') ctx.leadMode = 'riff';
            // with a singer, the lead keeps to the singer's breaths in the sung sections
            if (vocalNotes && SDAW.songgen && SDAW.songgen.VOCAL_SECTIONS.includes(sec.type)) gapsOnly = true;
          }
        }
        let bars;
        if (ctx.level === 0) { bars = []; for (let k = 0; k < sec.length; k++) bars.push(role === 'drums' ? { bar: sec.start + k, rows: emptyRows() } : { bar: sec.start + k, notes: [] }); }
        else if ((role === 'vocal' || role === 'choir') && SDAW.vocals) bars = role === 'vocal' ? SDAW.vocals.leadSection(ctx, sec, isLast) : SDAW.vocals.choirSection(ctx, sec);
        else if (style && SDAW.songgen && SDAW.songgen.handles(role, ctx.play, track, style)) bars = SDAW.songgen.realizeSection(ctx, sec, isLast);
        else if (role === 'horn2') bars = harmonizeSection(ctx, sec);
        else if (role === 'melody' || role === 'counter' || role === 'horns') {
          const playWas = ctx.play;
          if (ctx.leadMode === 'riff' && !(SDAW.legends && SDAW.legends.heroFor(ctx) && track.type === 'guitar')) ctx.play = 'riffs';   // non-guitar leads: 2-bar riffs
          bars = melodySection(ctx, secG, isLast);
          if (role === 'melody' && track.type === 'guitar' && style?.melody?.licks === 'blues' && ctx.mel?.licks !== false) {
            addBluesPhrases(ctx, secG, bars, isLast);
          }
          ctx.play = playWas;
        }
        else if (role === 'harmony') bars = harmonySection(ctx, sec);
        else if (role === 'arp') { bars = []; for (let k = 0; k < sec.length; k++) { const n = []; arpBar(ctx, sec.start + k, n, makeRand(ctx.seed ^ hash('a' + sec.type + k % 4)), prof); bars.push({ bar: sec.start + k, notes: n }); } }
        else if (role === 'strum') bars = strumSection(ctx, sec);
        else if (role === 'bass') bars = bassSection(ctx, sec);
        else bars = drumSection(ctx, sec, isLast);
        // with a singer: in the sections where the lead only answers (level 0.5),
        // keep just the notes that fall where the singer breathes → real call & response
        if (vocalNotes && (ctx.level === 0.5 || sec.type === 'outro' || gapsOnly) && role !== 'drums') SDAW.vocals.keepGaps(bars, vocalNotes, 1);
        results.push({ sec, bars });
      });
      writeBars(ctx, results);
    }
    return AG.lastCount;
  };
  function emptyRows() { const r = {}; SDAW.DRUM_ROWS.forEach(x => { r[x.id] = new Array(16).fill(0); }); return r; }

  /** 4. Write one pattern per bar; identical bars share (link) the same pattern */
  function writeBars(ctx, results) {
    const s = SDAW.store, out = AG._out;
    // in a song with shorter bars (AG.generateInMeter) the part goes into the real song, cut to its bars
    const song = out ? out.song : s.song, t = out ? song.tracks.find(x => x.id === ctx.track.id) : ctx.track;
    const BAR = out ? out.B : 16;
    if (out) { const ts = SDAW.timeSig(song); results.forEach(r => r.bars.forEach(b => AG.fitMeter(b, BAR, ts, ctx.role))); }
    const drums = ctx.role === 'drums';
    const cache = new Map();
    let barsWritten = 0, firstPattern = null;
    results.forEach(({ sec, bars }) => bars.forEach((b, k) => {
      const start = b.bar * BAR;
      if (ctx.opts.mode === 'empty' && t.clips.some(c => c.start < start + BAR && c.start + c.len > start)) return;
      s.carve(t, start, BAR);
      const empty = drums ? !Object.values(b.rows).some(r => r.some(v => v > 0)) : !b.notes.length;
      if (empty) return;
      const content = drums ? JSON.stringify(b.rows) : JSON.stringify(b.notes.slice().sort((x, y) => x.start - y.start || x.pitch - y.pitch).map(n => [n.start, n.dur, n.pitch, n.vel, n.string, n.fret, n.tech, n.tup]));
      let p = ctx.opts.link !== false ? cache.get(content) : null;
      if (!p) {
        p = SDAW.makePattern(drums ? 'drums' : 'notes', '✨ ' + sec.name + (sec.total > 1 ? ' ' + sec.occ : '') + ' · b' + (k + 1), BAR, C.sectionColors[sec.type]);
        if (drums) { SDAW.DRUM_ROWS.forEach(r => { p.drum.rows[r.id] = b.rows[r.id].slice(); }); }
        else p.notes = b.notes.map(n => Object.assign({ id: SDAW.uid('n') }, n, { tech: Object.assign({}, n.tech) })).sort((x, y) => x.start - y.start || x.pitch - y.pitch);
        song.patterns.push(p);
        cache.set(content, p);
      }
      t.clips.push({ id: SDAW.uid('clp'), kind: 'pattern', patternId: p.id, start, len: BAR });
      if (!firstPattern) firstPattern = p;
      barsWritten++;
    }));
    t.clips.sort((a, b) => a.start - b.start);
    AG.lastCount = { bars: barsWritten, patterns: cache.size };
    if (firstPattern) s.sel.patternId = firstPattern.id;
  }

  /** Helpers shared with the Full Song generator (songgen.js) */
  AG.util = { makeRand, hash, voicings, voiceLead, localScale, snapTo, stepScale, fold, chordTone, mod12, clamp, assignFrets, emptyRows };

  /* ================================================================ UI == */

  AG.last = { style: null, play: '', melody: {}, role: 'auto', seed: 1, density: 1, complexity: 1, register: 0, mode: 'replace', link: true, varyRepeats: false, techniques: true, writeChords: true, writeSections: true, addOutro: false, addIntro: false, introRest: false };

  /** The Auto Generate dialog: analysis on the left, options on the right */
  AG.open = function () {
    const { el, $ } = SDAW;
    const s = SDAW.store;
    if (!s.song.tracks.length) return SDAW.toast('Add a track first');
    const meter = AG.meterSupport(s.song);
    if (!meter.ok) return SDAW.toast(meter.text);
    // the last options, but a NEW idea every time the dialog opens (↺ brings the last one back)
    const o = Object.assign({}, AG.last, { complexity: 1, density: 1, trackId: s.sel.trackId || s.song.tracks[0].id, seed: SDAW.songgen ? SDAW.songgen.newSeed() : 1 + Math.floor(Math.random() * 999999) });
    if (!o.style) o.style = s.song.style && SDAW.STYLES && SDAW.STYLES[s.song.style] ? s.song.style : 'Generic';
    o.melody = Object.assign({}, !AG.last.style && o.style === 'Jazz' ? SDAW.songgen.defaults('Jazz', o.seed).melody : o.melody);
    let an = null, chosen = null;
    const close = () => back.remove();
    const left = el('div', { class: 'ag-left' }), right = el('div', { class: 'ag-right' });

    function analyzeNow() {
      an = AG.analyze(s.song, o.trackId);
      chosen = new Set(an.sections.list.map(x => x.key));
      renderLeft(); renderRight();
    }
    function renderLeft() {
      left.innerHTML = '';
      const r = an.rhythm;
      left.appendChild(el('div', { class: 'ag-stats' }, [
        stat('Key', an.key.name, Math.round(an.key.confidence * 100) + '% · ' + an.key.source),
        stat('Tempo', s.song.tempo + ' BPM', (r.sixteenth ? '16th feel' : '8th feel') + ' · ' + (r.syncopation > 0.3 ? 'syncopated' : 'straight')),
        stat('Length', an.bars + ' bars', an.sections.list.length + ' sections' + (an.sections.detected ? ' (detected)' : '')),
        stat('Density', r.density.toFixed(1) + ' notes/bar', r.hasDrums ? 'drums found' : 'no drums')
      ]));
      // accent profile of the groove
      left.appendChild(el('div', { class: 'ag-sub' }, 'Groove (accent of every 16th)'));
      left.appendChild(el('div', { class: 'ag-accent' }, r.accent.map((v, p) => el('i', { style: { height: Math.round(8 + v * 44) + 'px', opacity: 0.35 + v * 0.65 }, class: p % 4 === 0 ? 'beat' : '', title: 'Step ' + (p + 1) + ': ' + Math.round(v * 100) + '%' }))));
      // sections with chords per bar
      left.appendChild(el('div', { class: 'ag-sub' }, 'Form & harmony — uncheck the sections you do not want to generate'));
      const form = el('div', { class: 'ag-form' });
      an.sections.list.forEach(sec => {
        const ch = [];
        for (let b = sec.start; b < sec.start + sec.length; b++) {
          const names = [...new Set(an.chords.filter(c => c.bar === b).map(c => c.name))];
          const src = an.chords.find(c => c.bar === b);
          ch.push(el('span', { class: 'ag-chord ' + (src ? src.source : ''), title: 'Bar ' + (b + 1) + (src ? ' · ' + src.source : '') }, names.join(' ')));
        }
        const cb = el('input', { type: 'checkbox', checked: chosen.has(sec.key) ? true : null, onchange: e => { if (e.target.checked) chosen.add(sec.key); else chosen.delete(sec.key); } });
        form.appendChild(el('div', { class: 'ag-sec', style: { '--sc': C.sectionColors[sec.type] } }, [
          el('label', { class: 'ag-sec-name' }, [cb, el('b', {}, sec.name + (sec.total > 1 ? ' ' + sec.occ : '')), el('small', {}, 'bars ' + (sec.start + 1) + '–' + (sec.start + sec.length) + ' · ' + sec.type)]),
          el('div', { class: 'ag-chords' }, ch)
        ]));
      });
      left.appendChild(form);
      left.appendChild(el('div', { class: 'ag-legend' }, [el('span', { class: 'ag-chord symbol' }, 'symbol'), el('span', { class: 'ag-chord detected' }, 'detected'), el('span', { class: 'ag-chord held' }, 'held'), el('span', { class: 'ag-chord default' }, 'default')]));
      left.appendChild(el('div', { class: 'ag-sub' }, 'Structure check'));
      left.appendChild(el('div', { class: 'ag-checks' }, an.checks.map(([lvl, msg]) => el('div', { class: 'ag-check ' + lvl }, [el('span', {}, { ok: '✔', info: 'ℹ', warn: '⚠' }[lvl]), msg]))));
    }
    function stat(label, value, sub) { return el('div', { class: 'ag-stat' }, [el('small', {}, label), el('b', {}, value), el('em', {}, sub)]); }

    function renderRight() {
      right.innerHTML = '';
      const t = s.track(o.trackId);
      const autoR = AG.autoRole(t, s.song);
      const row = (label, ctrl, help) => el('div', { class: 'st-row ag-row', 'data-help': help || label }, [el('label', {}, label), ctrl, el('span')]);
      const slider = (key, min, max, step, fmt) => {
        const val = el('span', { class: 'st-val' }, fmt(o[key]));
        return el('div', { class: 'ag-slider' }, [el('input', { type: 'range', min, max, step, value: o[key], oninput: e => { o[key] = parseFloat(e.target.value); val.textContent = fmt(o[key]); } }), val]);
      };
      const check = (key, label, help) => el('label', { class: 'ag-check-opt', 'data-help': help }, [el('input', { type: 'checkbox', checked: o[key] ? true : null, onchange: e => { o[key] = e.target.checked; } }), label]);
      right.appendChild(el('div', { class: 'ag-sub' }, 'What to generate'));
      right.appendChild(row('Track', el('select', { onchange: e => { o.trackId = e.target.value; analyzeNow(); } },
        s.song.tracks.map(tr => el('option', { value: tr.id, selected: tr.id === o.trackId ? true : null }, (SDAW.TRACK_ICONS[tr.type] || '') + ' ' + tr.name))), 'The track that receives the new part (its current blocks in the chosen sections are replaced)'));
      right.appendChild(row('Part', el('select', { disabled: t.type === 'drums' ? true : null, onchange: e => { o.role = e.target.value; o.play = ''; renderRight(); } },
        C.roles.filter(([v]) => t.type === 'drums' ? v === 'drums' || v === 'auto' : v !== 'drums' && (v !== 'strum' || t.type === 'guitar'))
          .map(([v, l]) => el('option', { value: v, selected: o.role === v ? true : null }, v === 'auto' ? 'Auto → ' + (C.roles.find(r => r[0] === autoR) || ['', autoR])[1] : l))), 'Melody, counter-melody, harmony, strumming, arpeggio, bass or drums'));
      // genre: the accompaniment uses the real patterns of the genre, the melody its scales
      const styles = ['Generic'].concat(SDAW.STYLES ? Object.keys(SDAW.STYLES) : []);
      right.appendChild(row('Genre', el('select', { onchange: e => {
        const genre = e.target.value;
        if (genre === 'Jazz') o.melody = SDAW.songgen.defaults(genre, o.seed).melody;
        else if (o.style === 'Jazz') o.melody = {};
        o.style = genre; o.play = ''; renderRight();
      } },
        styles.map(g => el('option', { value: g, selected: o.style === g ? true : null }, g === 'Generic' ? 'Generic (no genre)' : g))), 'Genre: rhythm patterns, voicings, bass lines and scales of that style'));
      const roleNow = o.role === 'auto' ? autoR : o.role;
      const PL = (SDAW.songgen && SDAW.songgen.PLAY_LABEL) || {};
      const playOpts = t.type === 'drums' ? [] : roleNow === 'bass' ? ['style', 'roots', '8ths', 'walking', 'boogie', 'tumbao']
        : roleNow === 'melody' || roleNow === 'counter' ? [] : roleNow === 'horns' ? ['riffs', 'answers']
        : t.type === 'guitar' ? ['mix', 'strum', 'arp', 'chords', 'power', 'funk', 'boomchick', 'bossa', 'shuffle']
        : ['mix', 'chords', 'arp', 'pad', 'montuno', 'montuno-light', 'jazz'];
      if (playOpts.length && o.style !== 'Generic') right.appendChild(row('Plays', el('select', { onchange: e => { o.play = e.target.value; } },
        [el('option', { value: '' }, 'Genre default')].concat(playOpts.map(v => el('option', { value: v, selected: o.play === v ? true : null }, PL[v] || v)))), 'How the instrument plays (arpeggio, chords, montuno, power chords…)'));
      right.appendChild(row('Density', slider('density', 0, 1, 0.05, v => v < 0.3 ? 'Sparse' : v < 0.7 ? 'Medium' : 'Busy'), 'How many notes'));
      right.appendChild(row('Complexity', slider('complexity', 0, 1, 0.05, v => v < 0.3 ? 'Simple' : v < 0.7 ? 'Normal' : 'Advanced'), 'Leaps, 16ths, variations, 7th chords and open voicings'));
      right.appendChild(row('Register', el('select', { onchange: e => { o.register = parseInt(e.target.value, 10); } },
        [[-1, 'Lower'], [0, 'Normal'], [1, 'Higher']].map(([v, l]) => el('option', { value: v, selected: o.register === v ? true : null }, l))), 'Pitch range of the new part'));
      const seedIn = el('input', { type: 'number', value: o.seed, min: 1, style: { width: '90px' }, onchange: e => { o.seed = parseInt(e.target.value, 10) || 1; } });
      const tg = (s.track(o.trackId) || {}).gen;
      right.appendChild(row('Idea (seed)', el('div', { class: 'ag-seed' }, [seedIn,
        el('button', { class: 'btn small', onclick: () => { o.seed = SDAW.songgen ? SDAW.songgen.newSeed() : 1 + Math.floor(Math.random() * 999999); seedIn.value = o.seed; } }, '🎲 New idea'),
        AG.lastSeed ? el('button', { class: 'btn small', 'data-help': 'The idea of the last generated part', onclick: () => { o.seed = AG.lastSeed; seedIn.value = o.seed; } }, '↺ Last #' + AG.lastSeed) : null,
        tg && tg.seed ? el('button', { class: 'btn small', 'data-help': 'The idea this track was generated with', onclick: () => { o.seed = tg.seed; seedIn.value = o.seed; } }, '📄 Track #' + tg.seed) : null]), 'Same seed = same result. Change it for a different melody'));
      if (['melody', 'counter', 'horns'].includes(roleNow)) {
        right.appendChild(el('div', { class: 'ag-sub' }, 'Melody — what it may use (the program decides where)'));
        const M = [['complex', 'Complex lines'], ['fast', 'Fast runs'], ['triplets', 'Triplets'], ['modes', 'Mix modes / scales'], ['slides', 'Slides'], ['harmonics', 'Harmonics (guitar)'], ['bends', 'Bends'], ['vibrato', 'Vibrato']];
        right.appendChild(el('div', { class: 'sg-mel' }, M.map(([k, l]) => el('label', { class: 'ag-check-opt' }, [el('input', { type: 'checkbox', checked: o.melody[k] ? true : null, onchange: e => { o.melody[k] = e.target.checked; } }), l]))));
        // guitar leads "in the style of" a great guitarist (legends.js)
        if (SDAW.legends && roleNow === 'melody' && (s.track(o.trackId) || {}).type === 'guitar') {
          const stH = o.style && o.style !== 'Generic' ? SDAW.STYLES[o.style] : null;
          right.appendChild(row('🎸 In the style of', el('select', { onchange: e => { o.melody.hero = e.target.value; } },
            SDAW.legends.options(stH).map(([v, l]) => el('option', { value: v, selected: (o.melody.hero || 'auto') === v ? true : null }, l))), 'Scales, techniques and phrasing of a great guitarist (original phrases over your chords). ★ = guitarists of the chosen style'));
        }
      }
      if (!meter.exact) right.appendChild(el('div', { class: 'st-note ag-meter-note' }, '⚠ ' + meter.text));
      right.appendChild(el('div', { class: 'ag-sub' }, 'Options'));
      right.appendChild(el('div', { class: 'ag-opts' }, [
        el('label', { class: 'ag-check-opt' }, [el('input', { type: 'radio', name: 'agmode', checked: o.mode === 'replace' ? true : null, onchange: () => { o.mode = 'replace'; } }), 'Replace the blocks of the track in the chosen sections']),
        el('label', { class: 'ag-check-opt' }, [el('input', { type: 'radio', name: 'agmode', checked: o.mode === 'empty' ? true : null, onchange: () => { o.mode = 'empty'; } }), 'Only fill empty bars (keep what is written)']),
        check('link', 'Link identical bars (edit once, all repeats change)', 'Repeated choruses share the same patterns'),
        check('varyRepeats', 'Vary repeated sections (less linking, more variety)'),
        t.type === 'guitar' ? check('techniques', 'Guitar techniques (hammer-on, pull-off, slides, bends, vibrato)') : null,
        check('introRest', 'Lead enters after the first Intro bar'),
        an.sections.detected ? check('writeSections', 'Write the detected sections into the song') : null,
        !(s.song.chords || []).length ? check('writeChords', 'Write the detected chords as chord symbols') : null,
        meter.exact && !(an.sections.list[0] && an.sections.list[0].type === 'intro') ? check('addIntro', 'Add a 4-bar Intro before the song (moves everything 4 bars right; the intro uses the first chords)') : null,
        !an.sections.list.some(x => x.type === 'outro') ? check('addOutro', 'Add a 4-bar Outro with a final cadence (extends the song)') : null
      ]));
    }

    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, [
      el('div', { class: 'modal ag-modal' }, [
        el('button', { class: 'close', onclick: close }, '×'),
        el('h2', { style: { margin: '0 0 4px' } }, '✨ Auto Generate Track'),
        el('div', { class: 'st-note', style: { marginTop: 0 } }, 'The song is analyzed (key, chords, groove, form) and a new part is written for the chosen track, bar by bar, as patterns you can edit in Pattern, Piano Roll, Score and Tab.'),
        el('div', { class: 'ag-body' }, [left, right]),
        el('div', { class: 'ag-foot' }, [
          el('button', { class: 'btn', onclick: analyzeNow, 'data-help': 'Analyze the song again' }, '↻ Re-analyze'),
          el('span', { class: 'spacer' }),
          el('button', { class: 'btn', onclick: close }, 'Cancel'),
          el('button', { class: 'btn primary ag-go', onclick: () => {
            Object.assign(AG.last, o); delete AG.last.trackId;
            close();
            AG.generate(Object.assign({}, o, { sections: [...chosen], style: o.style === 'Generic' ? null : o.style, play: o.play || null, melody: Object.keys(o.melody).some(k => o.melody[k]) ? o.melody : null }));
            AG.lastSeed = o.seed;
          } }, '✨ Generate')
        ])
      ])
    ]);
    $('#modalRoot').appendChild(back);
    analyzeNow();
  };

})(window.SDAW);
