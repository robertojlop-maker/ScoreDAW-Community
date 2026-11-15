# Build the ScoreDAW style knowledge base (js/styledata.js) from the extracted Guitar Pro JSON.
# Only statistics and short idiomatic cells that the player repeats in >= 2 different songs are kept.
import sys, os, json, glob, re, collections, statistics as st
SRC, OUTJS, OUTJSON = (sys.argv + [None]*4)[1:4]
BAR = 3840; SX = 240
KS_MAJ = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
KS_MIN = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
ROMAN = ['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII']
ART = {  # folder -> id, display name, ScoreDAW genres, hero id
 'B.B. King': ('bbking', 'B.B. King', ['Blues'], 'bbking'), 'King, Albert': ('albertking', 'Albert King', ['Blues'], 'albert'),
 'Vaughan, Stevie Ray': ('srv', 'Stevie Ray Vaughan', ['Blues', 'Rock'], 'srv'), 'Clapton, Eric': ('clapton', 'Eric Clapton', ['Blues', 'Rock', 'Ballad'], 'clapton'),
 'Berry, Chuck': ('berry', 'Chuck Berry', ['Rock', 'Blues'], 'berry'), 'Beatles (The)': ('beatles', 'The Beatles', ['Pop', 'Rock', 'Ballad'], 'harrison'),
 'Queen': ('queen', 'Queen (Brian May)', ['Rock', 'Pop', 'Ballad'], 'may'), 'Boston': ('boston', 'Boston (Tom Scholz)', ['Rock'], 'scholz'),
 'Thin Lizzy': ('thinlizzy', 'Thin Lizzy', ['Rock'], 'lizzy'), 'ZZ Top': ('zztop', 'ZZ Top (Billy Gibbons)', ['Blues', 'Rock'], 'gibbons'),
 "Guns N' Roses": ('gnr', "Guns N' Roses (Slash)", ['Rock', 'Ballad'], 'slash'), 'Bon Jovi': ('bonjovi', 'Bon Jovi (Richie Sambora)', ['Rock', 'Pop', 'Ballad'], 'sambora'),
 'Van Halen': ('vanhalen', 'Van Halen', ['Rock', 'Metal'], 'vanhalen'), 'Osbourne, Ozzy': ('ozzy', 'Ozzy Osbourne (Rhoads / Wylde)', ['Metal', 'Rock'], 'rhoads'),
 'Malmsteen, Yngwie': ('malmsteen', 'Yngwie Malmsteen', ['Metal'], 'malmsteen'), 'Satriani, Joe': ('satriani', 'Joe Satriani', ['Rock', 'Metal'], 'satriani'),
 'Vai, Steve': ('vai', 'Steve Vai', ['Rock', 'Metal'], 'vai'), 'Santana, Carlos': ('santana', 'Carlos Santana', ['Latin Rock'], 'santana'),
 'Pass, Joe': ('joepass', 'Joe Pass', ['Jazz'], 'joepass')}
GENRE_POOL = {'blues': ['bbking', 'albertking', 'srv', 'clapton', 'zztop', 'berry'], 'rock': ['gnr', 'bonjovi', 'vanhalen', 'queen', 'boston', 'thinlizzy', 'beatles'],
              'metal': ['ozzy', 'malmsteen'], 'shred': ['satriani', 'vai'], 'latin': ['santana'], 'jazz': ['joepass']}

def corr(a, b):
    ma, mb = sum(a)/12, sum(b)/12
    num = sum((x-ma)*(y-mb) for x, y in zip(a, b)); den = (sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))**0.5
    return num/den if den else 0
def detect_key(hist):
    best = (-9, 0, 'major')
    for r in range(12):
        rot = [hist[(r+i) % 12] for i in range(12)]
        for prof, mode in ((KS_MAJ, 'major'), (KS_MIN, 'minor')):
            c = corr(rot, prof)
            if c > best[0]: best = (c, r, mode)
    return best[1], best[2]
def sec_type(n):
    n = (n or '').lower()
    if re.search('intro', n): return 'intro'
    if re.search('solo|instr|impro|lead', n): return 'solo'
    if re.search('interlud|break', n): return 'bridge'
    if re.search('pre', n): return 'pre'
    if re.search('chor|hook|refr|refrain', n): return 'chorus'
    if re.search('bridge|middle', n): return 'bridge'
    if re.search('outro|ending|end\\b|final|coda|fade', n): return 'outro'
    if re.search('verse|couplet|strophe', n): return 'verse'
    if re.search('riff|theme|main', n): return 'verse'
    return None
def songid(path):
    b = os.path.basename(path).rsplit('.', 1)[0]
    if ' - ' in b: b = b.split(' - ', 1)[1]
    b = re.sub(r'\(.*?\)|\[.*?\]', '', b).lower()
    b = re.sub(r'\b(live|solo|intro|part \d+|version|acoustic|demo|unplugged)\b', '', b)
    return re.sub(r'[^a-z0-9]', '', b)
def is_gtr(t): return t['role'] in ('guitar', 'lead') and not t['perc'] and (24 <= t['prog'] <= 31 or 'guit' in (t['name'] or '').lower() or 'gtr' in (t['name'] or '').lower() or t['role'] == 'lead')
def notes_of(ev): return [n for n in (ev[2] or []) if 't' not in n[3]]
def bar_kind(bar):
    evs = [e for e in bar if e[2]]
    if len(evs) < 2: return None
    single = sum(1 for e in evs if len(notes_of(e)) == 1); multi = sum(1 for e in evs if len(notes_of(e)) >= 2)
    ps = [n[2] for e in evs for n in notes_of(e)]
    if not ps: return None
    med = st.median(ps); pm = sum(1 for e in evs for n in notes_of(e) if 'p' in n[3]) / len(ps)
    if single >= 0.75*len(evs) and med >= 62 and pm < 0.3 and len(evs) >= 3: return 'lead'
    if multi >= 0.4*len(evs) or pm >= 0.3 or med < 55: return 'rhythm'
    return None
def fx_cell(prev, n):
    fx = n[3]; out = ''
    m = re.search(r'b(\d+)', fx)
    if m and int(m.group(1)) >= 2: out += 'b%d' % min(4, max(1, round(int(m.group(1))/2)))
    if prev is not None:
        pfx, pp = prev
        if 'h' in pfx and n[2] != pp: out += 'h' if n[2] > pp else 'p'
        elif 's' in pfx and n[2] > pp: out += 'si'
    if 'v' in fx: out += 'v'
    if 'x' in fx: out += 'm'
    return out
class SongSet(collections.defaultdict):
    def __init__(self): super().__init__(set)

def new_art():
    return {'files': 0, 'uniq': set(), 'tempo': [], 'ts': collections.Counter(), 'mode': collections.Counter(), 'tun': collections.Counter(), 'inst': collections.Counter(), 'nGtr': collections.Counter(),
     'secs': collections.Counter(), 'forms': collections.Counter(),
     'lead': collections.Counter(), 'leadN': 0, 'leadBars': 0, 'leadDens': [], 'leadSpan': [], 'trip': 0, 'bend': collections.Counter(), 'fret': collections.Counter(), 'pc': {'major': [0]*12, 'minor': [0]*12},
     'cells': SongSet(), 'rh': SongSet(), 'rhC': collections.Counter(), 'trans': {'major': collections.defaultdict(collections.Counter), 'minor': collections.defaultdict(collections.Counter)},
     'bendDeg': {'major': collections.Counter(), 'minor': collections.Counter()}, 'degN': {'major': collections.Counter(), 'minor': collections.Counter()},
     'longVib': [0, 0], 'leadSec': collections.Counter(),
     'drum': collections.defaultdict(collections.Counter), 'drumS': SongSet(), 'shuffle': [0, 0],
     'bass': collections.defaultdict(collections.Counter), 'bassS': SongSet(), 'bassDeg': collections.Counter(),
     'rhy': collections.defaultdict(collections.Counter), 'rhyS': SongSet(), 'pm': [0, 0], 'chord': collections.Counter(),
     'prog': collections.defaultdict(collections.Counter), 'progS': SongSet(),
     'voc': {'songs': 0, 'range': [], 'sung': [], 'with': 0, 'gaps': 0, 'lo': [], 'hi': []}}

def bass_tok(iv, last, nxt):
    if last and nxt is not None:
        d = (nxt - iv) % 12
        if d == 0 and iv % 12 != 0: return 'N'
        if d in (1, 11) and iv % 12 != 0: return 'A'
    if iv >= 12 and iv % 12 == 0: return '8'
    m = iv % 12
    return {0: 'R', 7: '5', 3: '3', 4: '3', 10: 'b7', 9: '6', 2: '2', 5: '4', 11: 'A', 1: 'A', 6: 'A', 8: '6'}[m]

def on_grid(x):
    # 16ths, 32nds and triplets only (ScoreDAW writes tuplets of 3): x * 2 or x * 3 must be whole
    return abs(x * 2 - round(x * 2)) < 0.02 or abs(x * 3 - round(x * 3)) < 0.02

def main():
    A = collections.defaultdict(new_art)
    for f in sorted(glob.glob(os.path.join(SRC, '*.json'))):
        s = json.load(open(f)); folder = s['file'].split('/')[0]
        if folder not in ART: continue
        a = A[ART[folder][0]]; sid = songid(s['file'])
        a['files'] += 1; a['uniq'].add(sid); a['tempo'].append(s['tempo'])
        tr = s['tracks']; nb = len(s['measures'])
        for m in s['measures']: a['ts']['%d/%d' % tuple(m['ts'])] += 1
        # section of every bar (markers carry forward)
        cur = 'part'; secOf = []; form = []
        for m in s['measures']:
            if 'mk' in m:
                t = sec_type(m['mk'])
                if t: cur = t
                if t and (not form or form[-1] != t): form.append(t)
            secOf.append(cur)
        for t in set(secOf): a['secs'][t] += 1
        if len(form) >= 3: a['forms'][' '.join(form[:10])] += 1
        roles = collections.Counter(t['role'] for t in tr)
        for k in roles: a['inst'][k] += 1
        gt = [t for t in tr if is_gtr(t)]
        a['nGtr'][min(len(gt), 5)] += 1
        if gt: a['tun'][tuple(gt[0]['tuning'])] += 1
        hist = [0.0]*12
        for t in tr:
            if t['perc']: continue
            for bar in t['bars']:
                for e in bar:
                    for n in notes_of(e): hist[n[2] % 12] += e[1]
        if sum(hist) == 0: continue
        key, mode = detect_key(hist); a['mode'][mode] += 1
        ts44 = [m['ts'] == [4, 4] for m in s['measures']]
        bass = [t for t in tr if t['role'] == 'bass' and not t['perc']]
        roots = [None]*nb
        for i in range(nb):
            for t in bass + gt:
                if i < len(t['bars']):
                    ns = [n for e in t['bars'][i] if e[0] < 960 for n in notes_of(e)]
                    if ns: roots[i] = min(n[2] for n in ns) % 12; break
        qual = ['']*nb
        for i in range(nb):
            if roots[i] is None: continue
            pcs = collections.Counter()
            for t in tr:
                if t['perc'] or t['role'] == 'vocal' or i >= len(t['bars']): continue
                for e in t['bars'][i]:
                    for n in notes_of(e): pcs[(n[2] - roots[i]) % 12] += e[1]
            qual[i] = 'm' if pcs[3] > pcs[4] * 1.3 else ('' if pcs[4] > 0 else '5')
        deg = [None if r is None else (r - key) % 12 for r in roots]
        for i in range(0, nb - 3, 2):
            if None in deg[i:i+4] or not all(ts44[i:i+4]) or len(set(secOf[i:i+4])) > 1: continue
            toks = []
            for j in range(i, i + 4):
                r = ROMAN[deg[j]]
                q = qual[j]
                if q == '5':          # power chord: the quality of the degree in the key (i, iv, v in minor; ii, iii, vi in major)
                    q = 'm' if deg[j] in ((0, 5, 7) if mode == 'minor' else (2, 4, 9)) else ''
                toks.append(r.lower() if q == 'm' else r)
            toks = [re.sub(r'^b?([ivx]+)', lambda m: m.group(0), t) for t in toks]
            toks = [('b' + t[1:]) if t.startswith('b') else t for t in toks]
            if len(set(toks)) < 2: continue
            if len({t.upper() for t in toks}) < 2 or any(t.upper() == u.upper() and t != u for t in toks for u in toks): continue
            p = ' '.join(toks); a['prog'][(mode, secOf[i])][p] += 1; a['progS'][(mode, p)].add(sid)
        voc = [t for t in tr if t['role'] == 'vocal' and not t['perc']]
        vocBars = set()
        if voc:
            a['voc']['songs'] += 1
            ps = [n[2] for t in voc for bar in t['bars'] for e in bar for n in notes_of(e)]
            if len(ps) > 20:
                ps.sort(); a['voc']['lo'].append(ps[len(ps)//20] - key); a['voc']['hi'].append(ps[len(ps)*19//20] - key); a['voc']['range'].append(ps[len(ps)*19//20] - ps[len(ps)//20])
            for t in voc:
                for i, bar in enumerate(t['bars']):
                    if any(e[2] for e in bar): vocBars.add(i)
            a['voc']['sung'].append(len(vocBars) / max(1, nb))
        # ---------------- guitars
        for t in gt:
            for i, bar in enumerate(t['bars'][:nb]):
                k = bar_kind(bar)
                if k == 'lead':
                    a['leadBars'] += 1; a['leadSec'][secOf[i]] += 1
                    if voc: a['voc']['with' if i in vocBars else 'gaps'] += 1
                    ns = [(e, n) for e in bar for n in notes_of(e)]
                    a['leadN'] += len(ns); a['leadDens'].append(len(ns))
                    ps = [n[2] for e, n in ns]; a['leadSpan'].append(max(ps) - min(ps))
                    prevp = None
                    for e, n in ns:
                        fx = n[3]; d = (n[2] - key) % 12
                        a['pc'][mode][d] += 1; a['degN'][mode][d] += 1
                        a['fret'][min(24, n[1])] += 1
                        for c, name in (('h', 'legato'), ('s', 'slide'), ('v', 'vibrato'), ('H', 'harmonic'), ('R', 'tremolo'), ('T', 'trill'), ('x', 'dead'), ('r', 'letRing')):
                            if c in fx: a['lead'][name] += 1
                        m = re.search(r'b(\d+)', fx)
                        if m and int(m.group(1)) >= 1:
                            a['lead']['bend'] += 1; sz = int(m.group(1)) / 2; a['bend'][sz] += 1; a['bendDeg'][mode][d] += 1
                        if len(e) > 3 and 'TAP' in e[3]: a['lead']['tap'] += 1
                        if len(e) > 3 and 'W' in e[3]: a['lead']['whammy'] += 1
                        if len(e) > 3 and '3' in e[3]: a['trip'] += 1
                        if e[1] >= 3 * SX: a['longVib'][1] += 1; a['longVib'][0] += ('v' in fx)
                        if prevp is not None:
                            iv = max(-12, min(12, n[2] - prevp[1]))
                            a['trans'][mode][prevp[0]][iv] += 1
                        prevp = (d, n[2])
                    # rhythm cells and idiomatic cells (4/4 only)
                    if ts44[i] and sum(e[1] for e in bar) == BAR and roots[i] is not None and not any(len(e) > 3 and 'TAP' in e[3] for e in bar):
                        evs = []; prev = None
                        for e in bar:
                            ns2 = sorted(notes_of(e), key=lambda n: -n[2]); ties = [n for n in (e[2] or []) if 't' in n[3]]
                            if not ns2:
                                if ties and evs: evs[-1][1] += e[1] / SX
                                else: prev = None
                                continue
                            top = ns2[0]
                            it = [round(e[0] / SX, 3), round(e[1] / SX, 3), top[2], fx_cell(prev, top)]
                            if len(e) > 3 and '3' in e[3]: it[3] += 't'
                            if len(ns2) >= 2 and 0 < top[2] - ns2[1][2] <= 9: it.append(ns2[1][2] - top[2])
                            evs.append(it); prev = (top[3], top[2])
                        for a0, a1 in ((0, 8), (8, 16)):
                            sel = [x for x in evs if a0 <= x[0] < a1]
                            if len(sel) >= 2:
                                rh = tuple((round(x[0] - a0, 3), round(min(x[1], a1 - x[0]), 3)) for x in sel)
                                a['rh'][rh].add(sid); a['rhC'][rh] += 1
                        if len(evs) >= 3:
                            lo = min(x[2] for x in evs); T = lo - ((lo - key) % 12)
                            if lo - T > 4: T += 12
                            cd = (roots[i] - key) % 12
                            for a0, a1, need in ((0, 16, 4), (0, 8, 3), (8, 16, 3)):
                                sel = [x for x in evs if a0 <= x[0] < a1]
                                if len(sel) < need: continue
                                cell = tuple((round(x[0] - a0, 3), round(min(x[1], a1 - x[0]), 3), x[2] - T, x[3]) + ((x[4],) if len(x) > 4 else ()) for x in sel)
                                a['cells'][(a1 - a0, mode, cd, cell)].add(sid)
                elif k == 'rhythm' and ts44[i]:
                    mask = ['.']*16; pm = cnt = 0
                    for e in bar:
                        ns = notes_of(e)
                        if not ns: continue
                        p = e[0] / SX
                        if abs(p - round(p)) > 0.01 or round(p) >= 16: continue
                        cnt += 1; isPm = any('p' in n[3] for n in ns); pm += isPm
                        mask[int(round(p))] = 'P' if isPm else ('O' if len(ns) >= 2 else 'o')
                        if len(ns) >= 2:
                            lo = min(m[2] for m in ns); iv = set((n[2] - lo) % 12 for n in ns)
                            ct = 'power' if iv <= {0, 7} else 'minor' if 3 in iv and 4 not in iv else 'major' if 4 in iv else 'other'
                            if 10 in iv and ct in ('major', 'minor'): ct += '7'
                            a['chord'][ct] += 1
                    a['pm'][0] += pm; a['pm'][1] += cnt
                    chordal = sum(c in 'OP' for c in mask)
                    if cnt >= 2 and chordal >= max(2, cnt - chordal):
                        ms = ''.join(mask); a['rhy'][secOf[i]][ms] += 1; a['rhyS'][ms].add(sid)
        # ---------------- bass
        for t in bass[:1]:
            for i, bar in enumerate(t['bars'][:nb]):
                if not ts44[i] or roots[i] is None: continue
                ons = []; ok = True
                for e in bar:
                    ns = notes_of(e)
                    if not ns: continue
                    p = e[0] / SX
                    if abs(p - round(p)) > 0.01: ok = False; break
                    if round(p) < 16: ons.append((int(round(p)), min(n[2] for n in ns)))
                if not ok or not ons or ons[0][0] != 0: continue
                base = ons[0][1]; nxt = roots[i+1] if i + 1 < nb else None
                nxtIv = None if nxt is None else (nxt - base) % 12
                toks = []
                for j, (p, pitch) in enumerate(ons):
                    ln = (ons[j+1][0] if j + 1 < len(ons) else 16) - p
                    iv = pitch - base
                    if iv < 0: iv = iv % 12
                    toks.append('%d:%s:%d' % (p, bass_tok(iv, j == len(ons) - 1 and j > 0, nxtIv), ln))
                    a['bassDeg'][iv % 12] += 1
                bs = ' '.join(toks); a['bass'][secOf[i]][bs] += 1; a['bassS'][bs].add(sid)
        # ---------------- drums
        for t in [t for t in tr if t['perc']][:1]:
            for i, bar in enumerate(t['bars'][:nb]):
                if not ts44[i]: continue
                R = {r: ['.']*16 for r in ('kick', 'snare', 'hhc', 'hho', 'ride')}; trip = False; any_ = False; toms = 0
                for e in bar:
                    ns = notes_of(e)
                    if not ns: continue
                    p = e[0] / SX; any_ = True
                    if abs(p - round(p)) > 0.01: trip = True; continue
                    j = int(round(p))
                    if j >= 16: continue
                    for n in ns:
                        d = n[2]
                        if d in (35, 36): R['kick'][j] = 'X' if j % 4 == 0 else 'x'
                        elif d in (38, 40): R['snare'][j] = '-' if ((n[4] or 95) < 70 or 'g' in n[3]) else ('X' if j in (4, 12) else 'x')
                        elif d == 37: R['snare'][j] = 'o'
                        elif d in (42, 44): R['hhc'][j] = 'x'
                        elif d == 46: R['hho'][j] = 'x'
                        elif d in (51, 59, 53): R['ride'][j] = 'x'
                        elif d in (41, 43, 45, 47, 48, 50): toms += 1
                if not any_: continue
                a['shuffle'][0] += trip; a['shuffle'][1] += 1
                if trip or toms >= 3: continue
                if sum(c != '.' for c in R['kick'] + R['snare']) < 3 or all(c == '.' for c in R['snare']): continue
                if all(c == '.' for r in ('hhc', 'hho', 'ride') for c in R[r]): continue
                g = '|'.join(''.join(R[r]) for r in ('kick', 'snare', 'hhc', 'hho', 'ride'))
                a['drum'][secOf[i]][g] += 1; a['drumS'][g].add(sid)
    # ======================================================== summarise
    def bysec(counter_by_sec, songsets, minSongs, n):
        out = {}
        tot = collections.Counter()
        for sec, c in counter_by_sec.items():
            items = [[k, v] for k, v in c.most_common(200) if len(songsets[k]) >= minSongs][:n]
            if items: out[sec] = items
            tot.update(c)
        out['all'] = [[k, v] for k, v in tot.most_common(300) if len(songsets[k]) >= minSongs][:n]
        return out
    res = {}; cellPool = collections.defaultdict(lambda: collections.defaultdict(set))
    for folder, (aid, name, genres, hero) in ART.items():
        a = A.get(aid)
        if not a: continue
        ln = max(1, a['leadN'])
        cells = []
        for (L, mode, cd, cell), songs in a['cells'].items():
            for g, members in GENRE_POOL.items():
                if aid in members: cellPool[g][(L, mode, cd, cell)] |= {aid + ':' + x for x in songs}
            need = 2 if L == 8 else 3
            if not all(on_grid(n[0]) and on_grid(n[1]) for n in cell): continue
            if len(songs) >= need: cells.append([L, mode, cd, [list(x) for x in cell], len(songs)])
        cells.sort(key=lambda c: (-c[4], -len(c[3])))
        rhythms = [[list(map(list, k)), v] for k, v in a['rhC'].most_common(800) if len(a['rh'][k]) >= 3 and all(on_grid(x) for n in k for x in n)][:48]
        trans = {}
        for mode in ('major', 'minor'):
            trans[mode] = {str(d): [[iv, c] for iv, c in a['trans'][mode][d].most_common(10)] for d in range(12) if a['trans'][mode][d]}
        bendDeg = {m: {str(d): round(a['bendDeg'][m][d] / max(1, a['degN'][m][d]), 3) for d in range(12) if a['degN'][m][d] >= 20} for m in ('major', 'minor')}
        pcs = {m: [round(x / (sum(a['pc'][m]) or 1), 3) for x in a['pc'][m]] for m in ('major', 'minor')}
        frets = sorted(a['fret'].elements()) if a['fret'] else [7]
        tempos = sorted(a['tempo'])
        progs = {}
        for (mode, sec), c in a['prog'].items():
            items = [[p, v] for p, v in c.most_common(60) if len(a['progS'][(mode, p)]) >= 3][:10]
            if items: progs.setdefault(mode, {})[sec] = items
        tunName = lambda t: {(64, 59, 55, 50, 45, 40): 'E standard', (63, 58, 54, 49, 44, 39): 'Eb (half step down)', (64, 59, 55, 50, 45, 38): 'Drop D',
                            (62, 57, 53, 48, 43, 38): 'D standard', (62, 57, 53, 48, 43, 36): 'Drop C'}.get(t, '7-string / other' if len(t) == 7 else 'other')
        tun = collections.Counter()
        for t, c in a['tun'].items(): tun[tunName(t)] += c
        v = a['voc']
        res[aid] = {
            'name': name, 'genres': genres, 'hero': hero, 'files': a['files'], 'songs': len(a['uniq']),
            'tempo': [tempos[len(tempos)//10], tempos[len(tempos)*9//10], int(st.median(tempos))],
            'timeSig': {k: round(c / sum(a['ts'].values()), 3) for k, c in a['ts'].most_common(4)},
            'minor': round(a['mode']['minor'] / max(1, sum(a['mode'].values())), 2), 'tuning': {k: c for k, c in tun.most_common(3)},
            'band': {k: round(c / a['files'], 2) for k, c in a['inst'].most_common()}, 'guitars': {str(k): c for k, c in sorted(a['nGtr'].items())},
            'forms': [f for f, c in a['forms'].most_common(5)],
            'lead': {'bars': a['leadBars'], 'notesPerBar': round(st.mean(a['leadDens']), 1) if a['leadDens'] else 0, 'span': st.median(a['leadSpan']) if a['leadSpan'] else 0,
                     'tech': {k: round(c / ln, 3) for k, c in a['lead'].most_common()}, 'triplets': round(a['trip'] / ln, 3),
                     'bends': {str(k): c for k, c in sorted(a['bend'].items()) if c >= 3}, 'vibLong': round(a['longVib'][0] / max(1, a['longVib'][1]), 2),
                     'fret': [frets[len(frets)//10], frets[len(frets)//2], frets[len(frets)*9//10]], 'pc': pcs,
                     'where': {k: c for k, c in a['leadSec'].most_common()}},
            'rhythms': rhythms, 'trans': trans, 'bendDeg': bendDeg, 'cells': cells[:140],
            'drums': bysec(a['drum'], a['drumS'], 2, 6), 'shuffle': round(a['shuffle'][0] / max(1, a['shuffle'][1]), 2),
            'bass': bysec(a['bass'], a['bassS'], 2, 6), 'bassDeg': {str(k): round(c / max(1, sum(a['bassDeg'].values())), 3) for k, c in a['bassDeg'].most_common(8)},
            'comp': bysec(a['rhy'], a['rhyS'], 2, 6), 'palmMute': round(a['pm'][0] / max(1, a['pm'][1]), 3),
            'chords': {k: round(c / max(1, sum(a['chord'].values())), 3) for k, c in a['chord'].most_common(6)},
            'progs': progs,
            'vocal': {'songs': v['songs'], 'range': st.median(v['range']) if v['range'] else 0, 'lo': st.median(v['lo']) if v['lo'] else 0, 'hi': st.median(v['hi']) if v['hi'] else 0,
                      'sung': round(st.mean(v['sung']), 2) if v['sung'] else 0, 'leadWhileSinging': v['with'], 'leadInGaps': v['gaps']}}
    genres = {}
    for g, pool in cellPool.items():
        cells = []
        for (L, mode, cd, cell), songs in pool.items():
            arts = {x.split(':')[0] for x in songs}
            if not all(on_grid(n[0]) and on_grid(n[1]) for n in cell): continue
            if len(songs) >= 3 and len(arts) >= 2: cells.append([L, mode, cd, [list(x) for x in cell], len(songs)])
        cells.sort(key=lambda c: (-c[4], -len(c[3])))
        genres[g] = {'artists': GENRE_POOL[g], 'cells': cells[:120]}
    data = {'version': 1, 'source': 'statistics of %d Guitar Pro files by %d artists (no transcription is included)' % (sum(r['files'] for r in res.values()), len(res)),
            'artists': res, 'pools': genres}
    json.dump(data, open(OUTJSON, 'w'), indent=1)
    js = json.dumps(data, separators=(',', ':'))
    hdr = open(os.path.join(os.path.dirname(__file__), 'styledata_header.js')).read()
    open(OUTJS, 'w').write(hdr + 'SDAW.styleData = ' + js + ';\n})(window.SDAW = window.SDAW || {});\n')
    for aid, r in res.items():
        print('%-10s songs %3d cells %3d rh %2d drums %s bass %s comp %s progs %s' % (aid, r['songs'], len(r['cells']), len(r['rhythms']), {k: len(v) for k, v in r['drums'].items()}, len(r['bass']['all']), len(r['comp']['all']), {m: len(v) for m, v in r['progs'].items()}))
    for g, v in genres.items(): print('pool', g, len(v['cells']))
if __name__ == "__main__": main()
