"""Build ScoreDAW's acoustic harp bank from the CC0 VSCO 2 CE recordings."""
import base64
import concurrent.futures
import json
import pathlib
import re
import subprocess
import urllib.parse
import urllib.request

import imageio_ffmpeg

REPOSITORY = 'sgossner/VSCO-2-CE'
NOTES = dict(zip('CDEFGAB', (0, 2, 4, 5, 7, 9, 11)))


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ScoreDAW-Harp'})
    with urllib.request.urlopen(request, timeout=45) as stream:
        return stream.read()


def sample(entry):
    path, revision = entry
    match = re.search(r'_([A-G])([#b]?)(\d)_([a-z]+)\.wav$', path)
    if not match:
        raise ValueError(f'Unexpected harp sample name: {path}')
    note, accidental, octave, _ = match.groups()
    root = (int(octave) + 1) * 12 + NOTES[note]
    root += 1 if accidental == '#' else -1 if accidental == 'b' else 0
    url = f'https://raw.githubusercontent.com/{REPOSITORY}/{revision}/' + urllib.parse.quote(path)
    recording = fetch(url)
    audio = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
         '-i', 'pipe:0', '-map_metadata', '-1', '-ar', '48000',
         '-c:a', 'libopus', '-b:a', '96k', '-f', 'ogg', 'pipe:1'],
        input=recording, capture_output=True, check=True
    ).stdout
    return [root, base64.b64encode(audio).decode('ascii')]


def main():
    tree = json.loads(fetch(f'https://api.github.com/repos/{REPOSITORY}/git/trees/master?recursive=1'))
    entries = [
        (item['path'], tree['sha'])
        for item in tree['tree']
        if item['path'].startswith('Strings/Harp/') and item['path'].endswith('.wav')
    ]
    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        rows = sorted(pool.map(sample, entries))
    if len(rows) < 20:
        raise ValueError('Incomplete concert harp bank')
    destination = pathlib.Path('assets/harp')
    destination.mkdir(parents=True, exist_ok=True)
    payload = 'SDAW.harp.register(' + json.dumps(rows, separators=(',', ':')) + ');\n'
    (destination / 'concert-harp.js').write_text(payload, encoding='ascii')
    (destination / 'CREDITS.txt').write_text(
        'Concert Harp recordings from VSCO 2 Community Edition. CC0 1.0.\n'
        'Recorded by Sam Gossner and Simon Dalzell. Sample cutting by Elan Hickler / Soundemote.\n'
        f'Source revision {tree["sha"]}\n'
        f'https://github.com/{REPOSITORY}/tree/{tree["sha"]}/Strings/Harp\n'
        'Encoded as Opus for ScoreDAW.\n',
        encoding='utf-8'
    )
    print(f'Harp recordings: {len(rows)}, MIDI range: {rows[0][0]}–{rows[-1][0]}', flush=True)


if __name__ == '__main__':
    main()
