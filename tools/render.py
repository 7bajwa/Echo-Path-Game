"""Render narration clips with Kokoro (local, free, Apache 2.0).

Usage:
  python tools/render.py                 # every voice in VOICES
  python tools/render.py bm_george       # one voice
  python tools/render.py bm_george 3     # only the first 3 missing clips (quick test)

Only missing clips are rendered, and clips for lines that no longer exist are deleted, so re-run it
after editing story.js. Needs: pip install kokoro-onnx, ffmpeg on PATH, and the model files
(kokoro-v1.0.onnx, voices-v1.0.bin) in ../.voice-models or KOKORO_DIR.
"""
import json
import os
import pathlib
import subprocess
import sys

import numpy as np
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS = pathlib.Path(os.environ.get('KOKORO_DIR', ROOT.parent / '.voice-models'))
VOICES = ['bm_george', 'bf_emma']  # keep in sync with VOICE_PACKS in engine.js
SR = 24000
TAIL = 0.7  # silence after each clip, so clips played back to back breathe


def silence(sec):
    return np.zeros(int(SR * sec), dtype=np.float32)


def tone(freq, sec=0.5):
    # Same G4 / B4 cue the engine plays for the device voice.
    t = np.arange(int(SR * sec)) / SR
    return (0.3 * np.sin(2 * np.pi * freq * t) * np.minimum(1, t / 0.04) * np.exp(-t * 7)).astype(np.float32)


def pan(mono, p):
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)


def both(mono):
    return np.stack([mono, mono], 1)


def encode(samples, path):
    ch = 1 if samples.ndim == 1 else 2
    data = np.clip(samples, -1, 1).astype('<f4').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-',
                    '-b:a', '64k' if ch == 1 else '96k', str(path)], input=data, check=True)


def main():
    voices = sys.argv[1:2] or VOICES
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    items = json.loads(subprocess.run(['node', str(ROOT / 'tools' / 'lines.js')], capture_output=True,
                                      check=True, encoding='utf-8').stdout)
    kokoro = Kokoro(str(MODELS / 'kokoro-v1.0.onnx'), str(MODELS / 'voices-v1.0.bin'))

    for voice in voices:
        def say(text):
            samples, sr = kokoro.create(text, voice=voice, speed=1.0, lang='en-gb')
            assert sr == SR, sr
            return samples.astype(np.float32)

        out = ROOT / 'audio' / voice
        out.mkdir(parents=True, exist_ok=True)
        wanted = {it['id'] for it in items}
        for f in out.glob('*.mp3'):
            if f.stem not in wanted:
                f.unlink()
        todo = [it for it in items if not (out / f"{it['id']}.mp3").exists()][:limit]
        try:
            for n, it in enumerate(todo, 1):
                if it['kind'] == 'line':
                    audio = np.concatenate([say(it['text']), silence(TAIL)])
                else:
                    audio = np.concatenate([
                        pan(tone(392), -0.9), both(silence(0.15)), both(say(it['a'])),
                        both(silence(0.15)), both(say(it['or'])), both(silence(0.15)),
                        pan(tone(494), 0.9), both(silence(0.15)), both(say(it['b'])), both(silence(TAIL)),
                    ])
                encode(audio, out / f"{it['id']}.mp3")
                print(f"{voice} {n}/{len(todo)} {it['id']} {(it.get('text') or it['a'])[:60]}", flush=True)
        finally:
            # The engine only asks for clips listed here; anything missing falls back to the device voice.
            done = sorted(f.stem for f in out.glob('*.mp3'))
            (out / 'index.json').write_text(json.dumps(done), encoding='utf-8')
            print(f"{voice}: {len(done)}/{len(items)} clips", flush=True)


if __name__ == '__main__':
    main()
