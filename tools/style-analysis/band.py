# Deeper per-band analysis for the band profiles (js/bands.js): line-up, keys, choirs, forms with lengths,
# half-bar progressions per section, vocal melody habits, low riffs, guitar textures, drum fills.
import sys, os, json, glob, re, collections, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
SRC, OUT = sys.argv[1], sys.argv[2]
SX = 240; BAR = 3840
ROMAN = B.ROMAN
def fam(prog):
    if prog < 6: return 'piano'
    if prog < 8: return 'clav'
    if prog < 16: return 'mallet'
    if prog < 24: return 'organ'
    if 40 <= prog < 48: return 'strings'
    if 48 <= prog < 52: return 'strings'
    if 52 <= prog < 56: return 'choir'
    if 56 <= prog < 64: return 'brass'
    if 64 <= prog < 72: return 'sax'
    if 72 <= prog < 80: return 'flute'
    if 80 <= prog < 88: return 'synthlead'
    if 88 <= prog < 104: return 'synthpad'
    return 'other'
def gfam(prog): return {24: 'nylon', 25: 'steel', 26: 'clean', 27: 'clean', 28: 'muted', 29: 'overdrive', 30: 'distortion', 31: 'harm'}.get(prog, 'other')
def main():
    A = collections.defaultdict(lambda: {'n': 0, 'uniq': set(), 'keys': collections.Counter(), 'gtr': collections.Counter(), 'vocTracks': collections.Counter(), 'choirSongs': 0,
        'secLen': collections.defaultdict(list), 'forms': collections.Counter(), 'prog2': collections.defaultdict(collections.Counter), 'prog2S': collections.defaultdict(set),
        'vocRh': collections.defaultdict(collections.Counter), 'vocRhS': collections.defaultdict(set), 'vocIv': collections.Counter(), 'vocPc': {'major': [0]*12, 'minor': [0]*12}, 'vocStart': collections.Counter(), 'vocNpb': collections.defaultdict(list),
        'vocReg': collections.defaultdict(list), 'riff': collections.defaultdict(set), 'riffC': collections.Counter(), 'tex': collections.defaultdict(collections.Counter),
        'keysRh': collections.defaultdict(collections.Counter), 'keysRhS': collections.defaultdict(set), 'keysTex': collections.Counter(), 'keysSec': collections.Counter(), 'secBars': collections.Counter(),
        'fill': collections.Counter(), 'fillS': collections.defaultdict(set), 'harm': [0, 0], 'acSec': collections.Counter(), 'key': collections.Counter(), 'tempoSec': [], 'dens': collections.defaultdict(list)})
    for f in sorted(glob.glob(os.path.join(SRC, '*.json'))):
        s = json.load(open(f)); folder = s['file'].split('/')[0]
        if folder not in B.ART: continue
        a = A[B.ART[folder][0]]; sid = B.songid(s['file']); a['n'] += 1; a['uniq'].add(sid)
        tr = s['tracks']; nb = len(s['measures'])
        cur = 'part'; secOf = []; form = []
        for m in s['measures']:
            if 'mk' in m:
                t = B.sec_type(m['mk'])
                if t:
                    cur = t; form.append([t, 0])
            if form: form[-1][1] += 1
            secOf.append(cur)
        if len(form) >= 4 and len(tr) >= 3:
            for t, n in form:
                if 2 <= n <= 40: a['secLen'][t].append(n)
            a['forms'][' '.join('%s:%d' % (t, n) for t, n in form[:14])] += 1
        for t in set(x['role'] for x in tr if x['role'] == 'keys' and not x['perc']): pass
        fams = set(fam(x['prog']) for x in tr if x['role'] == 'keys' and not x['perc'])
        for k in fams: a['keys'][k] += 1
        gt = [t for t in tr if B.is_gtr(t)]
        for k in set(gfam(t['prog']) for t in gt): a['gtr'][k] += 1
        voc = [t for t in tr if t['role'] == 'vocal' and not t['perc']]
        a['vocTracks'][min(3, len(voc))] += 1
        hist = [0.0]*12
        for t in tr:
            if t['perc']: continue
            for bar in t['bars']:
                for e in bar:
                    for n in B.notes_of(e): hist[n[2] % 12] += e[1]
        if sum(hist) == 0: continue
        key, mode = B.detect_key(hist); a['key'][(key, mode)] += 1
        ts44 = [m['ts'] == [4, 4] for m in s['measures']]
        bass = [t for t in tr if t['role'] == 'bass' and not t['perc']]
        for sc in secOf: a['secBars'][sc] += 1
        # half-bar roots
        def root_at(i, a0, a1):
            for t in bass + gt:
                if i < len(t['bars']):
                    ns = [n for e in t['bars'][i] if a0 <= e[0] < a1 for n in B.notes_of(e)]
                    if ns: return min(n[2] for n in ns) % 12
            return None
        def qual_at(i, a0, a1, r):
            pcs = collections.Counter()
            for t in tr:
                if t['perc'] or t['role'] == 'vocal' or i >= len(t['bars']): continue
                for e in t['bars'][i]:
                    if a0 <= e[0] < a1:
                        for n in B.notes_of(e): pcs[(n[2] - r) % 12] += e[1]
            if pcs[3] > pcs[4] * 1.3: return 'm'
            if pcs[4] > 0: return ''
            d = (r - key) % 12
            return 'm' if d in ((0, 5, 7) if mode == 'minor' else (2, 4, 9)) else ''
        toks = [None]*nb
        for i in range(nb):
            if not ts44[i]: continue
            r1 = root_at(i, 0, 960); r2 = root_at(i, 1920, 2880)
            if r1 is None: continue
            def tk(r, a0, a1):
                q = qual_at(i, a0, a1, r); x = ROMAN[(r - key) % 12]
                return x.lower() if q == 'm' else x
            t1 = tk(r1, 0, 1920)
            if r2 is not None and r2 != r1: toks[i] = t1 + '-' + tk(r2, 1920, 3840)
            else: toks[i] = t1
        for i in range(0, nb - 3):
            w = toks[i:i+4]
            if None in w or len(set(secOf[i:i+4])) > 1: continue
            if i > 0 and secOf[i-1] == secOf[i] and (i - next(j for j in range(i, -1, -1) if j == 0 or secOf[j-1] != secOf[i])) % 4: continue
            flat = [x for t in w for x in t.split('-')]
            if len({x.upper() for x in flat}) < 2: continue
            if any(x.upper() == y.upper() and x != y for x in flat for y in flat): continue
            p = ' '.join(w); a['prog2'][(mode, secOf[i])][p] += 1; a['prog2S'][(mode, p)].add(sid)
        # vocals
        if voc:
            v = voc[0]
            ps = sorted(n[2] for bar in v['bars'] for e in bar for n in B.notes_of(e))
            for i, bar in enumerate(v['bars'][:nb]):
                evs = [(e[0] / SX, e[1] / SX, B.notes_of(e)[0][2]) for e in bar if B.notes_of(e)]
                if not evs or not ts44[i]: continue
                sc = secOf[i]
                a['vocNpb'][sc].append(len(evs)); a['vocStart'][round(evs[0][0])] += 1
                if all(B.on_grid(x[0]) and B.on_grid(x[1]) for x in evs) and len(evs) >= 2:
                    # merge ties: durations to next onset capped
                    rh = tuple((round(x[0], 3), round(min(x[1], 16 - x[0]), 3)) for x in evs)
                    a['vocRh'][sc][rh] += 1; a['vocRhS'][rh].add(sid)
                for x in evs:
                    a['vocPc'][mode][(x[2] - key) % 12] += 1
                    a['vocReg'][sc].append(x[2])
                for x, y in zip(evs, evs[1:]): a['vocIv'][max(-12, min(12, y[2] - x[2]))] += 1
        if len(voc) >= 2 or any(fam(x['prog']) == 'choir' for x in tr if not x['perc'] and x['role'] in ('keys', 'vocal') and x is not (voc[0] if voc else None)): a['choirSongs'] += 1
        # guitars: textures per section, low riffs, harmonised leads
        leadBars = collections.defaultdict(list)
        for gi, t in enumerate(gt):
            ac = gfam(t['prog']) in ('nylon', 'steel')
            for i, bar in enumerate(t['bars'][:nb]):
                evs = [e for e in bar if B.notes_of(e)]
                if len(evs) < 2: continue
                sc = secOf[i]
                if ac: a['acSec'][sc] += 1
                k = B.bar_kind(bar)
                ns = [n for e in evs for n in B.notes_of(e)]
                single = sum(1 for e in evs if len(B.notes_of(e)) == 1) / len(evs)
                med = st.median(n[2] for n in ns)
                if k == 'lead':
                    a['tex'][sc]['lead'] += 1
                    leadBars[i].append(tuple((e[0], B.notes_of(e)[0][2]) for e in evs))
                    continue
                ring = sum('r' in n[3] for n in ns) / len(ns); pm = sum('p' in n[3] for n in ns) / len(ns)
                if single >= 0.8 and (ring > 0.3 or (med >= 52 and len(evs) >= 6 and max(n[2] for n in ns) - min(n[2] for n in ns) >= 7 and med >= 55)): tx = 'arpeggio'
                elif single >= 0.75 and med < 57: tx = 'riff'
                else:
                    chord = [B.notes_of(e) for e in evs if len(B.notes_of(e)) >= 2]
                    full = sum(1 for c in chord if len(c) >= 4) / max(1, len(chord))
                    tx = 'open chords' if full > 0.5 else ('palm power' if pm > 0.3 else 'power chords')
                a['tex'][sc][('acoustic ' if ac else '') + tx] += 1
                # low riff cells: single notes relative to the bar root, on the 16th grid
                if tx == 'riff' and ts44[i] and all(abs(e[0] / SX - round(e[0] / SX)) < 0.01 for e in evs) and len(evs) >= 4:
                    r0 = None
                    for tb in bass + [t]:
                        if i < len(tb['bars']):
                            q = [n for e in tb['bars'][i] if e[0] < 960 for n in B.notes_of(e)]
                            if q: r0 = min(n[2] for n in q); break
                    if r0 is None: continue
                    lo = min(n[2] for e in evs for n in B.notes_of(e)); base = lo - ((lo - r0) % 12)
                    cell = []
                    for j, e in enumerate(evs):
                        n = min(B.notes_of(e), key=lambda n: n[2]); p = int(round(e[0] / SX))
                        nxt = int(round(evs[j+1][0] / SX)) if j + 1 < len(evs) else 16
                        fl = ('p' if 'p' in n[3] else '') + ('x' if 'x' in n[3] else '') + ('h' if 'h' in n[3] else '') + ('s' if 's' in n[3] else '')
                        if len(B.notes_of(e)) >= 2: fl += 'O'
                        cell.append((p, min(nxt - p, max(1, int(round(e[1] / SX)))), n[2] - base, fl))
                    cell = tuple(cell)
                    if len({c[2] for c in cell}) >= 2:
                        a['riff'][(sc, cell)].add(sid); a['riffC'][(sc, cell)] += 1
        for i, ls in leadBars.items():
            if len(ls) >= 2:
                a['harm'][1] += 1
                x, y = ls[0], ls[1]
                if len(x) == len(y) and len(x) >= 3 and all(p[0] == q[0] for p, q in zip(x, y)) and all(abs(p[1] - q[1]) in (3, 4, 8, 9, 5, 7) for p, q in zip(x, y)): a['harm'][0] += 1
        # keys
        for t in [x for x in tr if x['role'] == 'keys' and not x['perc']]:
            fm = fam(t['prog'])
            for i, bar in enumerate(t['bars'][:nb]):
                evs = [e for e in bar if B.notes_of(e)]
                if not evs: continue
                sc = secOf[i]; a['keysSec'][(fm, sc)] += 1
                if not ts44[i]: continue
                chordal = sum(1 for e in evs if len(B.notes_of(e)) >= 3) / len(evs)
                longn = sum(1 for e in evs if e[1] >= 1920) / len(evs)
                a['keysTex'][(fm, 'pad' if longn > 0.5 else 'chords' if chordal > 0.5 else 'arpeggio/line')] += 1
                if fm == 'piano' and all(abs(e[0] / SX - round(e[0] / SX)) < 0.01 for e in evs) and len(evs) >= 2:
                    mask = ['.']*16
                    for e in evs:
                        p = int(round(e[0] / SX))
                        if p < 16: mask[p] = 'C' if len(B.notes_of(e)) >= 3 else ('b' if min(n[2] for n in B.notes_of(e)) < 48 else 'n')
                    ms = ''.join(mask); a['keysRh'][sc][ms] += 1; a['keysRhS'][ms].add(sid)
        # drum fills (bars with >= 3 toms): snare/tom rows of the second half
        for t in [t for t in tr if t['perc']][:1]:
            for i, bar in enumerate(t['bars'][:nb]):
                if not ts44[i]: continue
                rows = {'snare': ['.']*16, 'tom1': ['.']*16, 'tom2': ['.']*16, 'kick': ['.']*16}; toms = 0; ok = True; cnt = 0
                for e in bar:
                    ns = B.notes_of(e)
                    if not ns: continue
                    p = e[0] / SX; cnt += 1
                    if abs(p - round(p)) > 0.01: ok = False; break
                    j = int(round(p))
                    if j >= 16: continue
                    for n in ns:
                        d = n[2]
                        if d in (35, 36): rows['kick'][j] = 'X'
                        elif d in (38, 40): rows['snare'][j] = 'X' if j % 2 == 0 else 'x'
                        elif d in (47, 48, 50): rows['tom1'][j] = 'X'; toms += 1
                        elif d in (41, 43, 45): rows['tom2'][j] = 'X'; toms += 1
                a['dens'][secOf[i]].append(cnt)
                if ok and toms >= 3:
                    g = '|'.join(''.join(rows[r]) for r in ('snare', 'tom1', 'tom2', 'kick'))
                    a['fill'][g] += 1; a['fillS'][g].add(sid)
    res = {}
    for aid, a in A.items():
        n = a['n']
        def top(cbs, S, minS, k):
            return {sec: [[p, c] for p, c in cnt.most_common(80) if len(S[p]) >= minS][:k] for sec, cnt in cbs.items() if any(len(S[p]) >= minS for p in cnt)}
        prog = {}
        for (mode, sec), cnt in a['prog2'].items():
            items = [[p, c, len(a['prog2S'][(mode, p)])] for p, c in cnt.most_common(80) if len(a['prog2S'][(mode, p)]) >= 2][:10]
            if items: prog.setdefault(mode, {})[sec] = items
        riffs = collections.defaultdict(list)
        for (sec, cell), c in a['riffC'].most_common(3000):
            if len(a['riff'][(sec, cell)]) >= 2 and len(riffs[sec]) < 14: riffs[sec].append([[list(x) for x in cell], c, len(a['riff'][(sec, cell)])])
        allr = collections.Counter(); alls = collections.defaultdict(set)
        for (sec, cell), c in a['riffC'].items(): allr[cell] += c; alls[cell] |= a['riff'][(sec, cell)]
        riffs['all'] = [[[list(x) for x in cell], c, len(alls[cell])] for cell, c in allr.most_common(3000) if len(alls[cell]) >= 2][:30]
        vr = {}
        for sec, cnt in a['vocRh'].items():
            items = [[[list(x) for x in rh], c] for rh, c in cnt.most_common(60) if len(a['vocRhS'][rh]) >= 2][:12]
            if items: vr[sec] = items
        allv = collections.Counter()
        for sec, cnt in a['vocRh'].items(): allv.update(cnt)
        vr['all'] = [[[list(x) for x in rh], c] for rh, c in allv.most_common(100) if len(a['vocRhS'][rh]) >= 3][:16]
        tot = lambda c: sum(c.values()) or 1
        res[aid] = {'files': n, 'songs': len(a['uniq']),
            'keys': {k: round(c / n, 2) for k, c in a['keys'].most_common()}, 'guitarSounds': {k: round(c / n, 2) for k, c in a['gtr'].most_common()},
            'vocalTracks': dict(a['vocTracks']), 'choirSongs': a['choirSongs'],
            'secLen': {k: [int(st.median(v)), collections.Counter(v).most_common(3)] for k, v in a['secLen'].items()}, 'forms': a['forms'].most_common(8),
            'prog': prog, 'riffs': dict(riffs),
            'vocal': {'rh': vr, 'iv': [[k, round(c / tot(a['vocIv']), 3)] for k, c in a['vocIv'].most_common(13)], 'pc': {m: [round(x / (sum(a['vocPc'][m]) or 1), 3) for x in a['vocPc'][m]] for m in ('major', 'minor')},
                      'start': [[k, c] for k, c in a['vocStart'].most_common(6)], 'npb': {k: round(st.mean(v), 1) for k, v in a['vocNpb'].items()},
                      'reg': {k: [sorted(v)[len(v)//10], int(st.median(v)), sorted(v)[len(v)*9//10]] for k, v in a['vocReg'].items() if len(v) > 30}},
            'texture': {sec: {k: round(c / tot(cnt), 2) for k, c in cnt.most_common(6)} for sec, cnt in a['tex'].items()},
            'keysTex': {'%s/%s' % k: c for k, c in a['keysTex'].most_common(12)}, 'keysSec': {'%s/%s' % k: round(c / max(1, a['secBars'][k[1]]), 2) for k, c in a['keysSec'].most_common(40)},
            'pianoRh': top(a['keysRh'], a['keysRhS'], 2, 5), 'fills': [[g, c] for g, c in a['fill'].most_common(60) if len(a['fillS'][g]) >= 2][:10],
            'twinLead': [a['harm'][0], a['harm'][1]], 'acousticBars': dict(a['acSec']),
            'keysOfSongs': [['%s %s' % (['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][k], m), c] for (k, m), c in a['key'].most_common(8)],
            'drumDensity': {k: round(st.mean(v), 1) for k, v in a['dens'].items()}}
    json.dump(res, open(OUT, 'w'), indent=1)
    print({k: v['songs'] for k, v in res.items()})
if __name__ == '__main__': main()
