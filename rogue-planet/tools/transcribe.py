"""Transcribe public/narration.(mp3|wav) once, with word timestamps -> src/data/transcript.json

Works with either backend (pick whichever installs easily on your machine):
    pip install faster-whisper          # preferred: fast on CPU, no PyTorch needed
    pip install openai-whisper          # fallback (needs ffmpeg on PATH)

Usage:  python tools/transcribe.py [--model small.en|medium.en]
"""
import json, os, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_name = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "small.en"
audio = next(iter(sorted(glob.glob(os.path.join(ROOT, "public", "narration.*")))), None)
if not audio:
    sys.exit("No public/narration.mp3 or .wav found")
out_path = os.path.join(ROOT, "src", "data", "transcript.json")

def decode(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

words, segments = [], []
try:
    from faster_whisper import WhisperModel
    m = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(decode(audio), word_timestamps=True, beam_size=5, language="en")
    for s in segs:
        segments.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()})
        for w in s.words:
            words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
        print(f"[{s.start:7.2f}] {s.text.strip()}", flush=True)
except ImportError:
    import whisper
    m = whisper.load_model(model_name)
    r = m.transcribe(audio, word_timestamps=True, language="en")
    for s in r["segments"]:
        segments.append({"start": round(s["start"], 3), "end": round(s["end"], 3), "text": s["text"].strip()})
        for w in s.get("words", []):
            words.append({"word": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3)})
        print(f"[{s['start']:7.2f}] {s['text'].strip()}", flush=True)

json.dump({"source": os.path.basename(audio), "model": model_name, "words": words, "segments": segments},
          open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"\nwrote {out_path} ({len(words)} words)")
