# Echo Path

Branching audio story for lying down with your eyes closed. Plain HTML/JS PWA, no build step.

- `story.js`: the story graph (nodes, choices, endings) and the engine's spoken lines. Edit content here.
- `engine.js`: ambient beds (Web Audio), narration, tap/headphone input, saves.
- `text.js`: shared by the game and tools; sentence splitting and clip file names.
- `audio/<voice>/`: recorded narration (MP3), one file per line, made by `tools/render.py`.
  Lines with no clip fall back to the device's built-in voice.

## After editing the story

```
node tools/check-story.js      # every node and ending reachable
python tools/render.py         # re-render changed lines for every voice (only missing clips)
```

Rendering uses [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) locally (free, Apache 2.0):
`pip install kokoro-onnx soundfile`, ffmpeg on PATH, and `kokoro-v1.0.onnx` + `voices-v1.0.bin`
in `../.voice-models` (or set `KOKORO_DIR`). About 1x realtime on CPU, ~20 minutes per voice.
To add a voice: add it to `VOICES` in `tools/render.py` and `VOICE_PACKS` in `engine.js`.

## Run

Locally: `python -m http.server 8765` in this folder, open http://localhost:8765.
Phones: push to GitHub Pages (HTTPS needed for wake lock, service worker, install).
