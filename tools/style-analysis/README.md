# Style analysis — the reference library of ScoreDAW

Builds `js/styledata.js` (the knowledge base used by `legends.js` and the
**Reference artist** option of *Auto Generate Full Song*) from a folder of
Guitar Pro files (`.gp3 .gp4 .gp5 .gtp`), one sub-folder per artist.

The Guitar Pro files are **not** part of the project (they are copyrighted
transcriptions; `Canciones re derefencias/` is in `.gitignore`). Only
statistics and short cells that a player repeats in **2 or more different
songs** reach `styledata.js` — vocabulary, never the hook of one song.

## Steps

```bash
pip install pyguitarpro            # once
python3 -I tools/style-analysis/extract.py "Canciones re derefencias" /tmp/gpjson
python3 -I tools/style-analysis/build.py /tmp/gpjson js/styledata.js /tmp/styledata.json
```

1. `extract.py` parses every file into a compact JSON (tracks, roles, tuning,
   markers, notes with string / fret / pitch / techniques per beat).
2. `build.py` detects the key of each song (Krumhansl profiles), the chord root
   of every bar (bass, else lowest guitar note), the section of every bar (GP
   markers) and the role of every guitar bar (lead / rhythm), then collects per
   artist: tempo, meters, tunings, band, forms; lead technique rates, bend
   sizes, pitch-class profile, rhythm cells, interval transitions, bent
   degrees; idiomatic cells; drum grooves, bass lines and power-chord rhythms
   per section; 4-bar progressions; singer range and where the lead plays.

New artists: add the folder name to `ART` in `build.py` (id, display name,
ScoreDAW genres, hero of `legends.js`) and re-run both steps.
