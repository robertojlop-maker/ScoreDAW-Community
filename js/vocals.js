/* =====================================================================
 *  ScoreDAW — vocals.js : singer + backing vocals for generated songs
 *  ---------------------------------------------------------------------
 *  Used by Auto Generate Full Song when "With singer" is chosen.
 *
 *  Lead vocal (role 'vocal')
 *    A singable line: mostly steps and small leaps, chord tones on the
 *    strong beats, breaths between phrases, a hook repeated in the chorus,
 *    a higher register in the chorus than in the verse. The rhythm and the
 *    ornaments follow the genre (V.FLAVOR): pop hook, rock power notes,
 *    bolero / ballad legato with melismas, blues AAB (sings bars 1–2, the
 *    guitar answers in 3–4), salsa / merengue anticipations and the
 *    singer's "pregón" between the coro lines, bachata scoops, reggaeton
 *    rhythmic flow in the verses and a dembow hook in the chorus.
 *
 *  Backing vocals (role 'choir', 2–3 tracks, opts.voice = 1..3)
 *    mode (V.chooseChoir, different from song to song):
 *      harmony  the singer's chorus line in 3rds / 6ths (below, or above in Latin styles)
 *      oohs     held chord tones ("ooh") under the singer
 *      call     the Latin coro: the choir sings a 2-bar hook, the singer answers
 *      hook     a group shout of the chorus hook (reggaeton, pop, rock)
 * ===================================================================== */
(function (SDAW) {
  'use strict';

  const V = SDAW.vocals = {};
  const BAR = 16;
  const U = () => SDAW.autogen.util;

  /* --------------------------------------------------- genre flavours */
  // cells: one-bar rhythms [start, duration] (ticks, 4 = a beat)
  const CELLS = {
    pop: { verse: [[[0, 2], [2, 2], [4, 2], [6, 4], [12, 2], [14, 2]], [[2, 2], [4, 2], [6, 2], [8, 6]], [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]]],
           chorus: [[[0, 4], [4, 4], [8, 6], [14, 2]], [[0, 6], [6, 2], [8, 8]], [[2, 2], [4, 6], [10, 2], [12, 4]]] },
    rock: { verse: [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 8]]],
            chorus: [[[0, 8], [8, 4], [12, 4]], [[0, 4], [4, 4], [8, 8]], [[0, 6], [6, 2], [8, 8]]] },
    ballad: { verse: [[[0, 4], [4, 2], [6, 6], [12, 4]], [[2, 2], [4, 4], [8, 8]]],
              chorus: [[[0, 8], [8, 8]], [[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 8]]] },
    blues: { verse: [[[2, 2], [4, 4], [8, 2], [10, 6]], [[0, 2], [2, 4], [6, 2], [8, 8]], [[2, 2], [4, 2], [6, 2], [8, 8]]],
             chorus: [[[0, 4], [4, 4], [8, 8]], [[2, 2], [4, 4], [8, 8]]] },
    bolero: { verse: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 4], [12, 4]], [[4, 4], [8, 8]]],
              chorus: [[[0, 8], [8, 8]], [[0, 6], [6, 2], [8, 8]]] },
    latin: { verse: [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 4], [14, 2]], [[2, 2], [4, 2], [6, 4], [10, 2], [12, 2], [14, 2]], [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]]],
             chorus: [[[0, 4], [4, 2], [6, 4], [10, 2], [12, 2], [14, 2]], [[2, 2], [4, 4], [8, 2], [10, 4], [14, 2]]] },
    fast: { verse: [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]]],
            chorus: [[[0, 4], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 8]]] },
    bachata: { verse: [[[0, 2], [2, 2], [4, 2], [6, 6], [12, 2], [14, 2]], [[2, 2], [4, 4], [8, 8]], [[0, 4], [4, 2], [6, 2], [8, 8]]],
               chorus: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 6], [14, 2]]] },
    flow: { verse: [[[0, 1], [1, 1], [3, 1], [4, 1], [6, 1], [7, 1], [8, 1], [9, 1], [11, 1], [12, 2], [14, 2]], [[0, 2], [2, 1], [3, 1], [4, 2], [6, 1], [7, 1], [8, 1], [9, 2], [11, 1], [12, 2]]],
            chorus: [[[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], [[0, 3], [3, 3], [6, 2], [8, 8]]] }
  };
  V.FLAVOR = {
    Pop:       { cells: 'pop', scoop: 0.15, melisma: 0.15, lift: 4, choir: ['harmony', 'oohs', 'hook'] },
    Rock:      { cells: 'rock', scoop: 0.2, melisma: 0.05, lift: 5, choir: ['harmony', 'hook', 'oohs'] },
    Ballad:    { cells: 'ballad', scoop: 0.2, melisma: 0.3, lift: 5, choir: ['oohs', 'harmony'] },
    Country:   { cells: 'pop', scoop: 0.25, melisma: 0.1, lift: 4, choir: ['harmony'] },
    Blues:     { cells: 'blues', scoop: 0.35, melisma: 0.2, lift: 2, blue: true, aab: true, choir: ['oohs'] },
    Funk:      { cells: 'latin', scoop: 0.2, melisma: 0.1, lift: 3, choir: ['hook', 'call'] },
    Reggae:    { cells: 'pop', scoop: 0.15, melisma: 0.1, lift: 3, choir: ['harmony', 'oohs'] },
    Bolero:    { cells: 'bolero', scoop: 0.25, melisma: 0.3, lift: 4, above: true, choir: ['harmony', 'oohs'] },
    Salsa:     { cells: 'latin', scoop: 0.15, melisma: 0.15, lift: 3, above: true, choir: ['call'] },
    Merengue:  { cells: 'fast', scoop: 0.1, melisma: 0.05, lift: 3, above: true, choir: ['call', 'harmony'] },
    Bachata:   { cells: 'bachata', scoop: 0.3, melisma: 0.35, lift: 3, above: true, choir: ['harmony', 'oohs'] },
    Reggaeton: { cells: 'flow', scoop: 0.05, melisma: 0.05, lift: 4, flow: true, choir: ['hook', 'harmony'] },
    Cumbia:    { cells: 'latin', scoop: 0.15, melisma: 0.1, lift: 3, above: true, choir: ['call', 'harmony'] },
    'Bossa Nova': { cells: 'ballad', scoop: 0.1, melisma: 0.1, lift: 2, choir: ['oohs'] }
  };
  // a style may bring its own singer (style.vocal: band profiles of bands.js): cells = { verse, chorus, pre, bridge }
  const styleVocal = genre => { const st = (SDAW.STYLES || {})[genre]; return st && st.vocal ? st.vocal : null; };
  V.supports = (genre) => !!(V.FLAVOR[genre] || styleVocal(genre));  // Jazz: instrumental only
  V.flavorOf = (style, genre) => (style && style.vocal) || styleVocal(genre) || V.FLAVOR[genre || ''] || V.FLAVOR[Object.keys(SDAW.STYLES || {}).find(k => SDAW.STYLES[k] === style)] || V.FLAVOR.Pop;
  V.ranges = { male: [48, 67], female: [57, 76], choirLow: [50, 69], choirHigh: [57, 79] };

  /** Backing-vocal mode for a song (changes with the seed) */
  V.chooseChoir = function (genre, seed) {
    const f = V.flavorOf(null, genre), R = U().makeRand(U().hash('choir|' + genre + '|' + seed));
    return f.choir[Math.floor(R.next() * f.choir.length)];
  };

  /* ---------------------------------------------------------- helpers */
  const chordAt = (an, tick) => an.chordAt(tick);
  function nearestIn(p, pcs, lo, hi, prefer) {
    const { mod12 } = U();
    let best = null, bd = 99;
    for (let q = lo; q <= hi; q++) {
      if (!pcs.includes(mod12(q))) continue;
      const d = Math.abs(q - p) + (prefer && Math.sign(q - p) !== prefer && q !== p ? 0.5 : 0);
      if (d < bd) { bd = d; best = q; }
    }
    return best === null ? p : best;
  }
  function stepIn(p, pcs, dir, lo, hi) {
    const { mod12 } = U();
    for (let k = 1; k < 13; k++) { const q = p + dir * k; if (q < lo || q > hi) break; if (pcs.includes(mod12(q))) return q; }
    return p;
  }
  /** Scale of the song + blue notes for the blues */
  function scaleOf(an, f) {
    const { mod12 } = U();
    const sc = an.scale.slice();
    if (f.blue) [3, 10, 6].forEach(i => { const pc = mod12(an.key.root + i); if (!sc.includes(pc)) sc.push(pc); });
    return sc;
  }

  /* ------------------------------------------------- the lead vocal --- */
  /**
   * One section of the lead vocal. Returns bars [{ bar, notes }].
   *   ctx.opts.choirMode = 'call' -> in choruses the singer only answers (bars 3–4 of each 4)
   */
  V.leadSection = function (ctx, sec, isLast) {
    const { makeRand, hash, clamp, mod12 } = U();
    const an = ctx.an, f = V.flavorOf(ctx.style, ctx.opts.genre), [LO, HI] = ctx.range;
    const bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], curated: true });
    if (sec.type === 'intro' || sec.type === 'solo') return bars;
    const chorus = sec.type === 'chorus', pre = sec.type === 'pre', bridge = sec.type === 'bridge';
    const kind = chorus || pre ? 'chorus' : 'verse';
    const cellObj = typeof f.cells === 'object' ? f.cells : (CELLS[f.cells] || CELLS.pop);
    const cellSet = cellObj[sec.type] || cellObj[kind] || cellObj.verse;
    // the same section type → the same melody (verses / choruses repeat: linked patterns)
    const R = makeRand(ctx.seed ^ hash('vox|' + sec.type + '|' + (bridge ? sec.occ || 0 : 0)));
    const sc = scaleOf(an, f);
    // register: verse low-middle, chorus higher, bridge in between, outro = the hook softly
    const span = HI - LO;
    let center = LO + Math.round(span * (chorus ? 0.55 : pre ? 0.48 : bridge ? 0.5 : 0.36)) + (chorus ? f.lift - 3 : 0);
    if (f.reg && f.reg[sec.type] !== undefined) center = LO + Math.round(span * f.reg[sec.type]);
    center = clamp(center, LO + 3, HI - 4);
    const lo = LO, hi = HI;
    const call = ctx.opts.choirMode === 'call' && chorus;
    // a 2-bar motif (rhythm cells + contour) repeated through the section
    const motif = [R.pick(cellSet), R.pick(cellSet)];
    const motifB = [R.pick(cellSet), R.pick(cellSet)];
    const contour = R.pick([[1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, -1], [0, 1, -1, -1], [1, 0, -1, 0]]);
    let prev = center, sameRun = 0;
    const phraseBars = 2;
    for (let k = 0; k < sec.length; k++) {
      const bar = sec.start + k, t0 = bar * BAR;
      const inPhrase = k % phraseBars, phraseIdx = Math.floor(k / phraseBars);
      const line = phraseIdx % 4;                                  // a a' b cadence
      const lastBarOfPhrase = inPhrase === phraseBars - 1;
      // blues AAB: sing bars 1–2 of every 4, the guitar answers in 3–4
      if (f.aab && (k % 4) >= 2) continue;
      // Latin coro: the choir sings bars 1–2 of every 4, the singer answers ("pregón") in 3–4
      if (call && (k % 4) < 2) continue;
      // outro: only the hook, once, softly
      if (sec.type === 'outro' && k >= 2) continue;
      let cell = (line === 2 && !chorus ? motifB : motif)[inPhrase].map(x => x.slice());
      // breath: the last bar of a phrase ends early (rest of at least a beat)
      if (lastBarOfPhrase) {
        cell = cell.filter(([t]) => t < 10);
        if (cell.length) { const last = cell[cell.length - 1]; last[1] = Math.max(last[1], Math.min(8, 12 - last[0])); }
      }
      const dirs = contour;
      cell.forEach(([t, d], i) => {
        const at = t0 + t, ch = chordAt(an, at);
        const strong = t % 8 === 0 || d >= 4;
        const dir = dirs[(i + inPhrase * 2) % dirs.length];
        let p;
        if (f.flow && kind === 'verse') {
          // reggaeton flow: rhythm first — 2 or 3 pitches, repeated, chord tone on the accents
          p = strong ? nearestIn(prev, ch.pcs, lo, hi) : (R.chance(0.65) ? prev : stepIn(prev, sc, R.chance(0.5) ? 1 : -1, lo, hi));
          if (Math.abs(p - center) > 4) p = nearestIn(center, ch.pcs, lo, hi);
        } else if (strong) {
          // strong beats: a chord tone, close to the previous note, following the contour
          const target = prev + dir * R.pick([1, 2, 3, 4]);
          p = nearestIn(target, ch.pcs, lo, hi, dir || undefined);
          if (Math.abs(p - prev) > 7) p = nearestIn(prev + Math.sign(p - prev) * 3, ch.pcs, lo, hi);
        } else {
          // weak: a step of the scale (sometimes repeated, like speech)
          p = R.chance(kind === 'verse' ? 0.3 : 0.15) ? prev : stepIn(prev, sc, dir || (R.chance(0.5) ? 1 : -1), lo, hi);
        }
        // band singers (profiles with their own registers): a strong note never sits on the same pitch three times
        // in a row — it moves to the next chord tone along the contour (back inside the register when it leaves it)
        if (f.reg && strong) {
          if (p === prev) { sameRun++; if (sameRun >= 2) { const d2 = p >= center + 5 ? -1 : p <= center - 5 ? 1 : (dir || (R.chance(0.5) ? 1 : -1)); const q = nearestIn(p + d2 * 3, ch.pcs.filter(pc => pc !== mod12(p)), lo, hi, d2); if (q !== p) { p = q; sameRun = 0; } } }
          else sameRun = 0;
        }
        // the cadence of a line lands on a stable tone (root / 3rd / 5th; the root at the end)
        const lastNote = i === cell.length - 1 && lastBarOfPhrase;
        if (lastNote && line === 3) p = nearestIn(p, [mod12(an.key.root), mod12(an.key.root + (an.key.mode === 'minor' ? 3 : 4)), mod12(an.key.root + 7)].filter(pc => ch.pcs.includes(pc)).concat([mod12(an.key.root)]), lo, hi);
        // keep the register of the section
        if (p > center + 7) p = nearestIn(p - 5, ch.pcs, lo, hi);
        if (p < center - 7) p = nearestIn(p + 5, ch.pcs, lo, hi);
        p = clamp(p, lo, hi);
        const tech = {};
        const longN = d >= 6;
        if (longN) tech.vib = true;
        if (longN && R.chance(f.scoop)) tech.slide = 'inBelow';
        const vel = Math.round(clamp((chorus ? 98 : 86) + (strong ? 6 : 0) + R.int(-5, 4), 50, 120));
        // melisma: a quick turn into a long note (bolero, bachata, ballad, pop)
        if (longN && i > 0 && R.chance(f.melisma) && t >= 2) {
          const up = stepIn(p, sc, 1, lo, hi);
          bars[k].notes.push({ start: t - 2, dur: 1, pitch: up, vel: vel - 10, tech: {} }, { start: t - 1, dur: 1, pitch: p, vel: vel - 12, tech: {} });
        }
        bars[k].notes.push({ start: t, dur: Math.min(d, BAR - t), pitch: p, vel, tech });
        prev = p;
      });
      // remove overlaps created by melismas
      bars[k].notes.sort((a, b) => a.start - b.start);
      for (let i = 0; i < bars[k].notes.length - 1; i++) {
        const a = bars[k].notes[i], b = bars[k].notes[i + 1];
        if (a.start + a.dur > b.start) a.dur = b.start - a.start;
      }
      bars[k].notes = bars[k].notes.filter((n, i, arr) => n.dur >= 1 && !arr.some((m, j) => j < i && m.start === n.start));
      if (isLast && sec.type !== 'outro' && k === sec.length - 1 && bars[k].notes.length) {
        const n = bars[k].notes[bars[k].notes.length - 1]; n.dur = Math.max(n.dur, BAR - n.start); n.tech.vib = true;
      }
    }
    return bars;
  };

  /* ------------------------------------------------- backing vocals --- */
  /** Notes of the lead vocal track */
  function leadNotes(ctx) {
    const s = SDAW.store, lt = ctx.opts.leadTrackId ? s.track(ctx.opts.leadTrackId) : null;
    return lt ? s.trackNotes(lt) : [];
  }
  /** A diatonic harmony note a 3rd (voice 1) or 5th / 6th (voice 2) away from p */
  function harmonyNote(an, p, tick, voice, above, lo, hi) {
    const { localScale, mod12 } = U();
    const ch = chordAt(an, tick), sc = localScale(an, ch);
    const ivs = voice === 1 ? [3, 4] : [7, 8, 9];
    const cands = ivs.map(iv => above ? p + iv : p - iv);
    let q = cands.find(c => ch.pcs.includes(mod12(c))) || cands.find(c => sc.includes(mod12(c))) || (above ? p + 12 : p - 12);
    while (q > hi) q -= 12; while (q < lo) q += 12;
    return q;
  }

  V.choirSection = function (ctx, sec) {
    const { makeRand, hash, clamp } = U();
    const an = ctx.an, f = V.flavorOf(ctx.style, ctx.opts.genre), [lo, hi] = ctx.range;
    const voice = ctx.opts.voice || 1;                            // 1 = top, 2 = middle, 3 = low
    const mode = ctx.opts.choirMode || 'harmony';
    const bars = [];
    for (let k = 0; k < sec.length; k++) bars.push({ bar: sec.start + k, notes: [], curated: true });
    let chorus = sec.type === 'chorus';
    const pre = sec.type === 'pre', bridge = sec.type === 'bridge';
    const lead = leadNotes(ctx);
    // a song without a chorus (verse – verse – middle eight – verse): the backing voices join the singer in the
    // second half of every verse (the refrain line); a "duet" flavour (close-harmony bands) does it in every song
    const secs = (an.sections && an.sections.list) || [], noChorus = secs.length && !secs.some(x => x.type === 'chorus');
    let from = 0;
    if (!chorus && mode !== 'call' && mode !== 'oohs' && sec.type === 'verse' && (noChorus || f.duet)) { chorus = true; from = Math.floor(sec.length / 2); }
    else if (!chorus && bridge && noChorus && mode === 'harmony') chorus = true;                  // …and through the middle eight

    if (mode === 'call') {
      // the coro: a 2-bar hook in block harmony, bars 1–2 of every 4 (singer answers in 3–4)
      if (!chorus) return bars;
      const R = makeRand(ctx.seed ^ hash('coro|hook'));            // same hook for every voice
      const cells = (CELLS[f.cells] || CELLS.latin).chorus;
      const hook = [R.pick(cells), R.pick(cells)];
      const top = [Math.round(lo + (hi - lo) * 0.62)];
      for (let k = 0; k < sec.length; k++) {
        if (k % 4 >= 2) continue;
        const t0 = (sec.start + k) * BAR;
        let prev = top[0];
        const cell = hook[k % 2].map(x => x.slice());
        if (k % 2 === 1) { const last = cell.filter(([t]) => t < 10); last[last.length - 1][1] = 6; cell.length = 0; cell.push(...last); }
        cell.forEach(([t, d], i) => {
          const ch = chordAt(an, t0 + t);
          const target = prev + [2, -1, 1, -2, 0][(i + k) % 5];
          let p = nearestIn(target, ch.pcs, lo + 5, hi);
          prev = p;
          if (voice > 1) p = harmonyNote(an, p, t0 + t, voice - 1, false, lo, hi);
          bars[k].notes.push({ start: t, dur: Math.min(d, BAR - t), pitch: p, vel: 92 - voice * 4, tech: d >= 6 ? { vib: true } : {} });
        });
      }
      return bars;
    }

    if (mode === 'oohs') {
      // held chord tones under the singer: choruses, pre-choruses, bridges, 2nd verse
      if (!(chorus || pre || bridge || (sec.type === 'verse' && (sec.occ || 1) >= 2))) return bars;
      for (let k = 0; k < sec.length; k++) {
        const t0 = (sec.start + k) * BAR;
        [0, 8].forEach((h, hi2) => {
          const ch = chordAt(an, t0 + h), prevCh = h ? chordAt(an, t0) : null;
          if (h && prevCh && prevCh.name === ch.name) { const n = bars[k].notes[bars[k].notes.length - 1]; if (n) n.dur = 16; return; }
          // voice 1 = 3rd (or 9th colour), voice 2 = 5th, voice 3 = root / 7th — in the choir range
          const pcs = [ch.pcs[1] !== undefined ? ch.pcs[1] : ch.pcs[0], ch.pcs[2] !== undefined ? ch.pcs[2] : ch.pcs[0], ch.pcs[3] !== undefined ? ch.pcs[3] : ch.pcs[0]];
          const want = [hi - 6, (lo + hi) / 2, lo + 4][voice - 1];
          const p = nearestIn(Math.round(want), [pcs[voice - 1]], lo, hi);
          bars[k].notes.push({ start: h, dur: 8, pitch: p, vel: 66 - voice * 3, tech: {} });
        });
      }
      return bars;
    }

    // harmony / hook: follow the singer
    const useSec = mode === 'hook' ? chorus : (chorus || (pre && voice === 1));
    if (!useSec) return bars;
    lead.forEach(n => {
      const k = Math.floor(n.start / BAR) - sec.start;
      if (k < from || k >= sec.length) return;
      let p;
      if (mode === 'hook') {
        // gang vocal: voice 1 doubles the singer (octave if needed), voices 2–3 a 3rd / 5th under
        p = voice === 1 ? n.pitch : harmonyNote(an, n.pitch, n.start, voice - 1, false, lo, hi);
        while (p > hi) p -= 12; while (p < lo) p += 12;
      } else {
        p = harmonyNote(an, n.pitch, n.start, voice, !!f.above && voice === 1, lo, hi);
      }
      bars[k].notes.push({ start: n.start - (sec.start + k) * BAR, dur: n.dur, pitch: clamp(p, lo, hi), vel: Math.max(40, (n.vel || 90) - 10 - voice * 3), tech: n.tech && n.tech.vib ? { vib: true } : {} });
    });
    return bars;
  };

  /* -------------------------------------------- fills around the singer --
   * Instruments with level 0.5 in a vocal section keep only the notes that
   * fall where the singer is silent (with a small margin) → real answers.  */
  V.keepGaps = function (bars, vocalNotes, marginTicks) {
    const m = marginTicks === undefined ? 1 : marginTicks;
    bars.forEach(b => {
      if (!b.notes) return;
      const t0 = b.bar * BAR;
      b.notes = b.notes.filter(n => {
        const s0 = t0 + n.start - m, s1 = t0 + n.start + n.dur + m;
        return !vocalNotes.some(v => v.start < s1 && v.start + v.dur > s0);
      });
    });
    return bars;
  };
})(window.SDAW);
