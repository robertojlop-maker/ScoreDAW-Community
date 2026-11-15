#!/usr/bin/env python3
"""
=============================================================================
 BUILD_SOUND_PACKS.PY — makes the real sound packs of ScoreDAW
-----------------------------------------------------------------------------
 Reads the sample libraries of the two source projects:
   * LiveReplica  ->  RecursosOriginales/Core Library/Samples   (Ableton, .aif/.wav)
   * Lemon-Studio ->  Recursos/FL-Studio-20/Fabrica/Data/Patches (FL Studio)
 and writes, inside MyDAW:
   sounds/index.js            list of sounds, instruments and drum kits
   sounds/packs/<pack>.js     audio of one category, base64 OGG (loaded on demand)

 Requirements: Python 3 + ffmpeg in the PATH.

 The conversion is incremental (cache in sounds/_cache) and can be run in
 several passes with a time budget:
   python3 build_sound_packs.py --mydaw <MyDAW> --ableton <Samples> --fl <Patches> --budget 150
   ... repeat until it prints "remaining 0" ...
   python3 build_sound_packs.py --mydaw <MyDAW> --ableton <Samples> --fl <Patches> --pack
=============================================================================
"""
import argparse, base64, hashlib, json, os, re, subprocess, sys, time

AUDIO = re.compile(r'\.(wav|wave|aif|aiff|aifc|ogg|mp3|flac)$', re.I)

# ------------------------------------------------------------- settings ---
MAX_PER_CAT = 420            # sounds per category (Ableton first, then FL)
DRUM_SECONDS = 2.5           # one-shots are cut to this length (cymbals longer)
CYMBAL_SECONDS = 4.0
INST_SECONDS = 4.0           # multisample zones
INST_MAX_ZONES = 24
QUALITY = '3'                # vorbis quality (0..10)

# Ableton "One Shots/Drums" folder -> category
ABLETON_DRUMS = {
    'Kick': 'Kick', 'Snare': 'Snare', 'Hihat': 'Hihat', 'Clap': 'Clap', 'Tom': 'Tom',
    'Cymbal': 'Crash', 'Ride': 'Ride', 'Rim': 'Rim', 'Shaker': 'Shaker', 'Conga': 'Conga',
    'Bongo': 'Bongo', 'Timbales': 'Timbales', 'Bell': 'Bell', 'Tambourine': 'Tambourine',
    'Wood': 'Wood', 'Misc Percussion': 'Perc', 'Electronic Percussion': 'Perc', 'FX Hit': 'FX'
}
# keyword rules for FL Studio files (checked on the file name, then the folder)
FL_RULES = [
    ('HihatOpen', r'open ?h(i|at)|ohh|\bohat'), ('HihatClosed', r'h(i)?-?hat|hh\b|chh|\bhat'),
    ('Kick', r'kick|\bbd\b|bassdrum|bass drum|\bkik'), ('Snare', r'snare|\bsd\b|\bsnr'),
    ('Clap', r'clap'), ('Tom', r'\btom'), ('Crash', r'crash|cymbal|china|splash'), ('Ride', r'\bride'),
    ('Rim', r'\brim'), ('Conga', r'conga'), ('Bongo', r'bongo'), ('Timbales', r'timbal'),
    ('Bell', r'cowbell|\bbell'), ('Shaker', r'shaker|maraca|cabasa'), ('Tambourine', r'tamb'),
    ('Wood', r'clave|wood|guiro|castanet'), ('Perc', r'perc'),
]
# Ableton multisample instruments: folder -> (name, type, file filter)
ABLETON_INSTRUMENTS = [
    ('Grand Piano', 'Grand Piano', 'keys', r' f\.'),
    ('Upright Home Piano', 'Upright Piano', 'keys', None),
    ('Mallet Guitar', 'Mallet Guitar', 'guitar', None),
    ('Ikembe', 'Ikembe (Kalimba)', 'keys', None),
]
KITS = [
    ('808 Kit', r'808'), ('909 Kit', r'909'), ('707 Kit', r'707'), ('505 Kit', r'505'), ('606 Kit', r'606'),
    ('Acoustic Kit', r'acoustic'), ('70s Funk Kit', r'70s'), ('80s Kit', r'80s'), ('Vinyl Kit', r'vinyl'),
]
PAD_CATS = {'kick': ['Kick'], 'snare': ['Snare'], 'hhc': ['HihatClosed'], 'hho': ['HihatOpen'], 'tom1': ['Tom'],
            'tom2': ['Tom'], 'clap': ['Clap'], 'perc': ['Rim', 'Bell', 'Wood', 'Shaker'], 'crash': ['Crash'], 'ride': ['Ride']}

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def root_from_name(name):
    m = re.search(r'(?:^|[^A-Za-z])([A-Ga-g])([#b]?) ?(-?\d)(?!\d)', os.path.splitext(name)[0])
    if not m:
        return None
    pc = NOTE[m.group(1).upper()] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return (int(m.group(3)) + 1) * 12 + pc


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:40]


def sid(source, path):
    return slug(os.path.splitext(os.path.basename(path))[0])[:28] + '-' + hashlib.md5((source + path).encode('utf-8', 'replace')).hexdigest()[:6]


def walk_audio(folder):
    out = []
    for root, _dirs, files in os.walk(folder):
        for f in sorted(files):
            if AUDIO.search(f) and not f.endswith('.asd'):
                out.append(os.path.join(root, f))
    return out


# --------------------------------------------------------------- collect ---
def collect(args):
    sounds, instruments = [], []
    per_cat = {}

    def add(cat, path, source, seconds):
        if per_cat.get(cat, 0) >= MAX_PER_CAT:
            return
        per_cat[cat] = per_cat.get(cat, 0) + 1
        name = os.path.splitext(os.path.basename(path))[0]
        sounds.append({'id': sid(source, path), 'name': name, 'cat': cat, 'source': source, 'pack': 'drums-' + cat.lower(),
                       '_path': path, '_sec': seconds})

    ab = args.ableton
    if ab and os.path.isdir(ab):
        drums = os.path.join(ab, 'One Shots', 'Drums')
        for folder, cat in ABLETON_DRUMS.items():
            d = os.path.join(drums, folder)
            if not os.path.isdir(d):
                continue
            for p in walk_audio(d):
                c = cat
                if cat == 'Hihat':
                    c = 'HihatOpen' if re.search(r'open', os.path.basename(p), re.I) else 'HihatClosed'
                add(c, p, 'Ableton', CYMBAL_SECONDS if c in ('Crash', 'Ride', 'HihatOpen') else DRUM_SECONDS)
        ms = os.path.join(ab, 'Multisamples')
        for folder, name, typ, filt in ABLETON_INSTRUMENTS:
            d = os.path.join(ms, folder)
            if os.path.isdir(d):
                instruments.append(make_instrument(name, typ, 'Ableton', walk_audio(d), filt))
        synths = os.path.join(ms, 'Synths')
        if os.path.isdir(synths):
            for sub in sorted(os.listdir(synths)):
                d = os.path.join(synths, sub)
                if os.path.isdir(d):
                    instruments.append(make_instrument(sub + ' (Synth)', 'synth', 'Ableton', walk_audio(d), None))

    fl = args.fl
    if fl and os.path.isdir(fl):
        for p in walk_audio(os.path.join(fl, 'Packs')):
            low = os.path.basename(p).lower()
            full = p.lower()
            cat = None
            for c, rx in FL_RULES:
                if re.search(rx, low):
                    cat = c
                    break
            if not cat:
                for c, rx in FL_RULES:
                    if re.search(rx, os.path.dirname(full)[-60:]):
                        cat = c
                        break
            if cat:
                add(cat, p, 'FL Studio', CYMBAL_SECONDS if cat in ('Crash', 'Ride', 'HihatOpen') else DRUM_SECONDS)

    instruments = [i for i in instruments if i and i['zones']]
    for inst in instruments:
        for z in inst['_zones']:
            sounds.append(z)
    return sounds, instruments


def make_instrument(name, typ, source, files, filt):
    by_root = {}
    for p in files:
        b = os.path.basename(p)
        if filt and not re.search(filt, b):
            continue
        r = root_from_name(b)
        if r is None:
            continue
        by_root.setdefault(r, p)
    roots = sorted(by_root)
    if len(roots) > INST_MAX_ZONES:                     # keep an even spread
        step = len(roots) / INST_MAX_ZONES
        roots = [roots[int(i * step)] for i in range(INST_MAX_ZONES)]
    pack = 'inst-' + slug(name)
    zones, zsounds = [], []
    for r in roots:
        p = by_root[r]
        i = sid(source, p)
        zones.append({'root': r, 'id': i})
        zsounds.append({'id': i, 'name': os.path.splitext(os.path.basename(p))[0], 'cat': 'Inst', 'source': source,
                        'pack': pack, 'zoneOnly': True, '_path': p, '_sec': INST_SECONDS})
    return {'id': slug(name), 'name': name, 'type': typ, 'source': source, 'zones': zones, '_zones': zsounds}


def make_kits(sounds):
    kits = []
    pool = [s for s in sounds if not s.get('zoneOnly')]
    for name, rx in KITS:
        pads = {}
        for pad, cats in PAD_CATS.items():
            cands = [s for s in pool if s['cat'] in cats and re.search(rx, s['name'], re.I)]
            if pad == 'tom1':
                cands = [s for s in cands if re.search(r'hi|high|mid|1', s['name'], re.I)] or cands
            if pad == 'tom2':
                cands = [s for s in cands if re.search(r'lo|low|floor|2|3', s['name'], re.I)] or cands[1:] or cands
            if cands:
                pads[pad] = cands[0]['id']
        if len(pads) >= 4:
            kits.append({'id': slug(name), 'name': name, 'source': 'Ableton/FL', 'pads': pads})
    # Latin percussion kit
    def first(cat, rx=r'.'):
        c = [s for s in pool if s['cat'] == cat and re.search(rx, s['name'], re.I)]
        return c[0]['id'] if c else None
    latin = {'kick': first('Kick', 'acoustic'), 'snare': first('Timbales'), 'hhc': first('Shaker'), 'hho': first('Tambourine'),
             'tom1': first('Conga', 'hi'), 'tom2': first('Conga', 'lo'), 'clap': first('Wood', 'clave'), 'perc': first('Bell', 'cow') or first('Bell'),
             'crash': first('Crash'), 'ride': first('Ride')}
    latin = {k: v for k, v in latin.items() if v}
    if len(latin) >= 4:
        kits.append({'id': 'latin-kit', 'name': 'Latin Percussion Kit', 'source': 'Ableton', 'pads': latin})
    return kits


# --------------------------------------------------------------- convert ---
def encoder():
    out = subprocess.run(['ffmpeg', '-hide_banner', '-encoders'], capture_output=True, text=True).stdout
    if 'libvorbis' in out:
        return ['-c:a', 'libvorbis', '-q:a', QUALITY], '.ogg'
    if 'libopus' in out:
        return ['-c:a', 'libopus', '-b:a', '64k'], '.ogg'
    return ['-c:a', 'libmp3lame', '-q:a', '6'], '.mp3'


def convert(sounds, cache, budget):
    os.makedirs(cache, exist_ok=True)
    enc, ext = encoder()
    t0, done, fails = time.time(), 0, 0
    todo = [s for s in sounds if not os.path.exists(os.path.join(cache, s['id'] + ext))]
    for s in todo:
        if budget and time.time() - t0 > budget:
            break
        out = os.path.join(cache, s['id'] + ext)
        fade = max(0.05, s['_sec'] - 0.25)
        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', s['_path'], '-t', str(s['_sec']), '-ac', '1', '-ar', '44100',
               '-af', 'afade=t=out:st=%.2f:d=0.25' % fade] + enc + [out]
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode != 0:
            fails += 1
            open(out + '.fail', 'w').close()
        done += 1
        if done % 50 == 0 or done == len(todo):
            print('  %d / %d  (%s)' % (done, len(todo), s['name'][:40]), flush=True)
    remaining = len([s for s in sounds if not os.path.exists(os.path.join(cache, s['id'] + ext)) and not os.path.exists(os.path.join(cache, s['id'] + ext + '.fail'))])
    print('converted %d (failed %d), remaining %d, total %d' % (done, fails, remaining, len(sounds)))
    return ext


def pack(sounds, instruments, kits, mydaw, cache, ext):
    packs_dir = os.path.join(mydaw, 'sounds', 'packs')
    os.makedirs(packs_dir, exist_ok=True)
    groups, ok = {}, []
    for s in sounds:
        f = os.path.join(cache, s['id'] + ext)
        if not os.path.exists(f) or os.path.getsize(f) < 100:
            continue
        groups.setdefault(s['pack'], {})[s['id']] = base64.b64encode(open(f, 'rb').read()).decode('ascii')
        ok.append(s)
    for name, data in groups.items():
        with open(os.path.join(packs_dir, name + '.js'), 'w') as fh:
            fh.write('/* ScoreDAW sound pack: %s (%d sounds) — generated by tools/build_sound_packs.py */\n' % (name, len(data)))
            fh.write('SDAW.factory.addPack(%s, %s);\n' % (json.dumps(name), json.dumps(data, separators=(',', ':'))))
    okids = {s['id'] for s in ok}
    clean = [{k: v for k, v in s.items() if not k.startswith('_')} for s in ok]
    insts = []
    for i in instruments:
        zones = [z for z in i['zones'] if z['id'] in okids]
        if zones:
            insts.append({'id': i['id'], 'name': i['name'], 'type': i['type'], 'source': i['source'], 'zones': zones})
    kits = [dict(k, pads={p: v for p, v in k['pads'].items() if v in okids}) for k in kits]
    with open(os.path.join(mydaw, 'sounds', 'index.js'), 'w') as fh:
        fh.write('/* ScoreDAW — real sounds index (generated by tools/build_sound_packs.py). */\n')
        fh.write('SDAW.factory.setIndex(%s);\n' % json.dumps({'sounds': clean, 'instruments': insts, 'kits': kits}, separators=(',', ':')))
    total = sum(os.path.getsize(os.path.join(packs_dir, n + '.js')) for n in groups)
    print('packed %d sounds, %d instruments, %d kits into %d packs (%.1f MB)' % (len(clean), len(insts), len(kits), len(groups), total / 1e6))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mydaw', required=True)
    ap.add_argument('--ableton')
    ap.add_argument('--fl')
    ap.add_argument('--budget', type=float, default=0, help='seconds of conversion in this pass (0 = no limit)')
    ap.add_argument('--pack', action='store_true', help='write sounds/index.js and the packs')
    args = ap.parse_args()
    cache = os.path.join(args.mydaw, 'sounds', '_cache')
    print('Scanning the libraries…', flush=True)
    sounds, instruments = collect(args)
    print('Found %d sounds and %d instruments. Converting (only new files)…' % (len([x for x in sounds if not x.get('zoneOnly')]), len(instruments)), flush=True)
    kits = make_kits(sounds)
    ext = convert(sounds, cache, args.budget)
    if args.pack:
        pack(sounds, instruments, kits, args.mydaw, cache, ext)


if __name__ == '__main__':
    main()
