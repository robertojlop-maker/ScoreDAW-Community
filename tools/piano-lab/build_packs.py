#!/usr/bin/env python3
# =====================================================================
#  PIANO LAB — build_packs.py
#  ---------------------------------------------------------------------
#  A web page opened straight from disk (file://) is not allowed to
#  fetch() files, so it cannot load the real recordings. It CAN run <script> files, so this
#  tool writes every asset again as a tiny script ("pack"):
#
#      packs/<path with / replaced by __>.js
#          PL.addAsset("samples/fsbs-di.bin", "<base64>", "b64");
#      packs/index.js
#          (window.PL = window.PL || {}).PACKS = [ ...paths... ];
#
#  presets.js (PL.loadAsset) uses fetch() when the page is served over
#  http(s) and these packs when it is opened from disk. Run this again
#  after adding or changing files in samples/:
#      python build_packs.py
# =====================================================================
import base64, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'packs')
# (folder, extensions, kind)  kind: 'text' = stored as a JS string, 'b64' = base64
SOURCES = [
    ('samples', ('.json',), 'text'),
    ('samples', ('.bin',), 'b64'),
]


def pack_name(path):
    return path.replace('/', '__') + '.js'


def main():
    os.makedirs(OUT, exist_ok=True)
    wanted, total = [], 0
    for folder, exts, kind in SOURCES:
        d = os.path.join(HERE, folder)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            full = os.path.join(d, name)
            if not os.path.isfile(full) or not name.lower().endswith(exts):
                continue
            rel = folder + '/' + name
            with open(full, 'rb') as f:
                raw = f.read()
            data = base64.b64encode(raw).decode('ascii') if kind == 'b64' else raw.decode('utf-8')
            js = '/* Piano Lab asset pack (made by build_packs.py) - ' + rel + ' */\n' \
                 'PL.addAsset(' + json.dumps(rel) + ', ' + json.dumps(data, ensure_ascii=True) + ', ' + json.dumps(kind) + ');\n'
            target = os.path.join(OUT, pack_name(rel))
            with open(target, 'w', encoding='ascii', newline='\n') as f:
                f.write(js)
            wanted.append(rel)
            total += len(js)
            print('  %-36s %8.1f KB' % (rel, len(js) / 1024))
    # remove packs of assets that no longer exist
    keep = {pack_name(r) for r in wanted} | {'index.js'}
    for name in os.listdir(OUT):
        if name.endswith('.js') and name not in keep:
            os.remove(os.path.join(OUT, name))
    with open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('/* Piano Lab asset packs (made by build_packs.py): assets that a page opened from disk can load */\n')
        f.write('(window.PL = window.PL || {}).PACKS = ' + json.dumps(wanted, indent=1) + ';\n')
    print('%d packs, %.1f MB -> %s' % (len(wanted), total / 1048576, OUT))


if __name__ == '__main__':
    sys.exit(main())
