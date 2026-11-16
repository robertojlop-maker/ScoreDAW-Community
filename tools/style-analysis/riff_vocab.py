# Riff and lead vocabulary of ONE artist (used to write the Van Halen profile of bands.js, 2026-11-16).
# Usage:  python3 tools/style-analysis/extract.py "Canciones re derefencias/Van Halen" /tmp/vh
#         python3 tools/style-analysis/riff_vocab.py /tmp/vh
# Prints in how many songs each riff device appears (chords + bass line, 2nds, 4th dyads, inverted
# triads, quartal chords, harmonics…), the tapping figures and the double-stop intervals of the leads.
import sys, os, json, glob, collections
sys.argv_json = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/vh/json')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
def load():
    songs = {}
    for f in sorted(glob.glob(os.path.join(sys.argv_json, '*.json'))):
        s = json.load(open(f)); sid = B.songid(s['file'])
        n = sum(len(B.notes_of(e)) for t in s['tracks'] if B.is_gtr(t) for b in t['bars'] for e in b)
        if sid not in songs or n > songs[sid][0]: songs[sid] = (n, s)
    return {k: v[1] for k, v in songs.items()}
SX = 240  # 16th in GP ticks (960 = quarter)
def bar_root(s, i):
    """root of bar i: lowest note of the bass on the first event, else lowest guitar note of the bar"""
    for t in s['tracks']:
        if t['role'] == 'bass' and not t['perc'] and i < len(t['bars']):
            ns = [n for e in t['bars'][i][:2] for n in B.notes_of(e)]
            if ns: return min(n[2] for n in ns) % 12
    for t in s['tracks']:
        if B.is_gtr(t) and i < len(t['bars']):
            ns = [n for e in t['bars'][i] for n in B.notes_of(e)]
            if ns: return min(n[2] for n in ns) % 12
    return None
def key_of(s):
    hist = [0.0]*12
    for t in s['tracks']:
        if t['perc']: continue
        for bar in t['bars']:
            for e in bar:
                for n in B.notes_of(e): hist[n[2] % 12] += e[1]
    return B.detect_key(hist) if sum(hist) else (None, None)
import json, glob, collections
S = load()
F = collections.defaultdict(set)
for sid, s in S.items():
    for t in [t for t in s['tracks'] if B.is_gtr(t)]:
        for i, bar in enumerate(t['bars']):
            if B.bar_kind(bar) != 'rhythm': continue
            r = bar_root(s, i)
            if r is None: continue
            ch = []; singles = []
            for e in bar:
                ns = B.notes_of(e)
                if not ns: continue
                ps = sorted(set(n[2] for n in ns))
                if len(ps) == 1: singles.append(ps[0]); continue
                ch.append(ps)
            tops = [ (p[-1] - p[0]) % 12 for p in ch if len(p) >= 3 and (p[1]-p[0]) == 7]
            if len(set(tops) & {5, 4, 2}) >= 2 or len(set(tops) & {8, 7, 5}) >= 2 and singles: F['power chord + moving top voice (sus4/3/9)'].add(sid)
            d4 = set((p[0] - r) % 12 for p in ch if len(p) == 2 and p[1]-p[0] == 5)
            if len(d4) >= 2: F['walking 4th dyads'].add(sid)
            inv = set((p[0] - r) % 12 for p in ch if len(p) == 3 and (p[1]-p[0], p[2]-p[0]) in ((5, 9), (5, 8)))
            if inv and any((x - r) % 12 == 0 for x in singles): F['inverted triads over a root pedal'].add(sid)
            if len(inv) >= 2: F['inverted triads moving'].add(sid)
            if any(len(p) == 2 and p[1]-p[0] <= 2 for p in ch): F['2nd dyads'].add(sid)
            if any(len(p) >= 3 and (p[1]-p[0], p[2]-p[0]) in ((2, 7), ) for p in ch) or any(len(p)>=4 and 14 in [x-p[0] for x in p] for p in ch): F['sus2 / add9 chords'].add(sid)
            if any(len(p) == 3 and (p[1]-p[0], p[2]-p[0]) == (5, 10) for p in ch): F['quartal 1-4-b7 stacks'].add(sid)
            if ch and len(set((x - r) % 12 for x in singles)) >= 3: F['chords + bass-line riff'].add(sid)
            sp = [(x - r) % 12 for x in singles]
            if any(a == 0 and b == 2 for a, b in zip(sp, sp[1:])) or any(a == 3 and b == 2 for a, b in zip(sp, sp[1:])): F['single-note riff with the 2nd (1-2 / b3-2)'].add(sid)
            if any('H' in n[3] for e in bar for n in B.notes_of(e)): F['harmonics in the riff'].add(sid)
for k, v in sorted(F.items(), key=lambda x: -len(x[1])): print('%-48s %d of %d songs' % (k, len(v), len(S)))
tapIv = collections.Counter(); tapIvS = collections.defaultdict(set)
tapRate = collections.Counter(); tapRun = []; tapTop = collections.Counter(); tapMove = collections.Counter()
harmFret = collections.Counter(); bendSz = collections.Counter(); wh = collections.Counter()
legRun = []
harm2 = collections.Counter(); harm2S = collections.defaultdict(set)
leadDs = collections.Counter()
for sid, s in S.items():
    gt = [t for t in s['tracks'] if B.is_gtr(t)]
    for t in gt:
        for i, bar in enumerate(t['bars']):
            r = bar_root(s, i)
            seq = []  # (pos, dur, string, fret, pitch, tap?, fx)
            for e in bar:
                ns = B.notes_of(e)
                bf = e[3] if len(e) > 3 else ''
                if 'W' in bf: wh['whammy beats'] += 1
                for n in ns:
                    if 'H' in n[3]: harmFret[n[1]] += 1
                    if 'b' in n[3]:
                        import re
                        m = re.search(r'b(\d+)', n[3]);
                        if m: bendSz[int(m.group(1))] += 1
                if len(ns) == 1:
                    n = ns[0]; seq.append((e[0], e[1], n[0], n[1], n[2], 'TAP' in bf, n[3]))
                elif len(ns) == 2 and B.bar_kind(bar) == 'lead':
                    a, b = sorted(n[2] for n in ns); leadDs[b - a] += 1
            # tapping groups: tap then following notes on the same string until the next tap / other string
            k = 0
            while k < len(seq):
                if seq[k][5]:
                    tp = seq[k]; grp = [tp]
                    j = k + 1
                    while j < len(seq) and seq[j][2] == tp[2] and not seq[j][5] and len(grp) < 4: grp.append(seq[j]); j += 1
                    if len(grp) >= 3:
                        iv = tuple(g[4] - tp[4] for g in grp[1:])
                        tapIv[iv] += 1; tapIvS[iv].add(sid)
                        tapRate[tp[1]] += 1
                        if r is not None: tapTop[(tp[4] - r) % 12] += 1
                    k = j
                else: k += 1
            # how many consecutive taps in a bar
            nt = sum(1 for x in seq if x[5])
            if nt: tapRun.append(nt)
            # legato chains (h flag on consecutive notes)
            run = 0
            for x in seq:
                if 'h' in x[6]: run += 1
                else:
                    if run >= 3: legRun.append(run)
                    run = 0
    # harmonies between two guitar tracks: both single notes at the same time, different pitch
    for a in range(len(gt)):
        for b in range(a + 1, len(gt)):
            A, Bt = gt[a], gt[b]
            for i in range(min(len(A['bars']), len(Bt['bars']))):
                ea = {e[0]: B.notes_of(e) for e in A['bars'][i]}; eb = {e[0]: B.notes_of(e) for e in Bt['bars'][i]}
                both = [(ea[p][0][2], eb[p][0][2]) for p in ea if p in eb and len(ea[p]) == 1 and len(eb[p]) == 1]
                if len(both) >= 6:
                    ivs = [abs(x - y) for x, y in both]
                    if sum(1 for v in ivs if v not in (0, 12, 24)) >= 0.75 * len(ivs) and min(x for x, y in both + [(y, x) for x, y in both]) > 52:
                        c = collections.Counter(v % 12 for v in ivs).most_common(1)[0][0]
                        harm2[c] += 1; harm2S[c].add(sid)
print('tap figures (intervals after the tapped note on the same string), top:')
for k, v in sorted(tapIv.items(), key=lambda x: -len(tapIvS[x[0]]))[:25]: print('  %-22s %5d songs %d' % (k, v, len(tapIvS[k])))
print('tap note durations (240=16th, 160=16th triplet):', tapRate.most_common(6))
print('tapped note vs bar root:', sorted(tapTop.items(), key=lambda x: -x[1])[:8])
print('taps per bar (median):', sorted(tapRun)[len(tapRun)//2] if tapRun else 0, 'bars with taps', len(tapRun))
print('natural harmonic frets:', harmFret.most_common(8))
print('bend sizes (25=quarter, 50=half, 100=whole):', bendSz.most_common(6))
print('legato chains >=3: n', len(legRun), 'median', sorted(legRun)[len(legRun)//2] if legRun else 0)
print('two-guitar harmony bars by interval (mod 12):', sorted(((k, v, len(harm2S[k])) for k, v in harm2.items()), key=lambda x: -x[1]))
print('lead double stops:', leadDs.most_common(8))
