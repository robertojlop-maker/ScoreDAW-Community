# Extract a compact, analysable JSON from each Guitar Pro file.
import sys, os, json, traceback
from multiprocessing import Pool
import guitarpro as gp

ROOT = sys.argv[1]; OUT = sys.argv[2]

def dur_ticks(beat):
    try: return beat.duration.time   # 960 = quarter
    except Exception: return 0

def track_role(t):
    n = (t.name or '').lower()
    if t.isPercussionTrack: return 'drums'
    prog = t.channel.instrument if t.channel else -1
    if 'voc' in n or 'voice' in n or 'sing' in n or 'melod' in n or prog in (52,53,54,85): return 'vocal'
    if 'bass' in n or 'bajo' in n or 32 <= prog <= 39 or len(t.strings) in (4,5) and t.strings[-1].value < 35: return 'bass'
    if 'key' in n or 'piano' in n or 'organ' in n or 'synth' in n or 'string' in n and 'guit' not in n or prog < 24 or 40 <= prog <= 23+64: return 'keys'
    if 'lead' in n or 'solo' in n: return 'lead'
    return 'guitar'

def one(path):
    try:
        s = gp.parse(path)
    except Exception as e:
        return {'file': path, 'err': str(e)[:80]}
    song = {'file': os.path.relpath(path, ROOT), 'title': s.title, 'tempo': s.tempo,
            'key': str(getattr(s, 'key', '')), 'measures': [], 'tracks': []}
    for mh in s.measureHeaders:
        m = {'ts': [mh.timeSignature.numerator, mh.timeSignature.denominator.value]}
        if mh.marker: m['mk'] = mh.marker.title
        if mh.isRepeatOpen: m['ro'] = 1
        if mh.repeatClose > 0: m['rc'] = mh.repeatClose
        song['measures'].append(m)
    for t in s.tracks:
        tr = {'name': t.name, 'perc': t.isPercussionTrack, 'prog': t.channel.instrument if t.channel else -1,
              'tuning': [st.value for st in t.strings], 'role': None, 'bars': []}
        tr['role'] = track_role(t)
        for meas in t.measures:
            bar = []
            for v in meas.voices[:1]:
                pos = 0
                for b in v.beats:
                    d = int(round(float(dur_ticks(b))))
                    ev = [pos, d]
                    if b.status.name == 'rest' or not b.notes:
                        ev.append(None)
                    else:
                        ns = []
                        for n in b.notes:
                            if n.type.name in ('tie',): code = 't'
                            elif n.type.name == 'dead': code = 'x'
                            else: code = ''
                            e = n.effect
                            fx = ''
                            if e.bend and e.bend.points: fx += 'b%d' % max(p.value for p in e.bend.points)
                            if e.hammer: fx += 'h'
                            if e.slides: fx += 's'
                            if e.vibrato: fx += 'v'
                            if e.harmonic: fx += 'H'
                            if e.palmMute: fx += 'p'
                            if e.ghostNote: fx += 'g'
                            if e.staccato: fx += '.'
                            if e.letRing: fx += 'r'
                            if e.trill: fx += 'T'
                            if e.tremoloPicking: fx += 'R'
                            if e.accentuatedNote or e.heavyAccentuatedNote: fx += '>'
                            ns.append([n.string, n.value, n.realValue if hasattr(n,'realValue') else None, code + fx, n.velocity])
                        ev.append(ns)
                        be = b.effect
                        bf = ''
                        if be.vibrato: bf += 'v'
                        if be.slapEffect and be.slapEffect.value: bf += 'TAP' if be.slapEffect.value == 1 else 'SL'
                        if be.tremoloBar: bf += 'W'
                        if b.duration.tuplet and b.duration.tuplet.enters != b.duration.tuplet.times: bf += '3'
                        if bf: ev.append(bf)
                    bar.append(ev); pos += d
            tr['bars'].append(bar)
        song['tracks'].append(tr)
    return song

if __name__ == '__main__':
    files = []
    for dp, dn, fn in os.walk(ROOT):
        for f in fn:
            if f.lower().endswith(('.gp3', '.gp4', '.gp5', '.gtp')): files.append(os.path.join(dp, f))
    files.sort()
    os.makedirs(OUT, exist_ok=True)
    ok = err = 0
    with Pool(2) as p:
        for r in p.imap_unordered(one, files, chunksize=8):
            if 'err' in r: err += 1; continue
            ok += 1
            name = r['file'].replace('/', '__').rsplit('.', 1)[0] + '.json'
            json.dump(r, open(os.path.join(OUT, name), 'w'), separators=(',', ':'), default=lambda o: float(o) if hasattr(o,'numerator') else str(o))
    print('ok', ok, 'err', err, 'of', len(files))
