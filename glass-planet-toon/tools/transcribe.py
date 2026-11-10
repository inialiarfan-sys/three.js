import json, sys
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs, info = m.transcribe(__import__("numpy").fromfile(sys.argv[1],dtype="float32"), word_timestamps=True, beam_size=5)
out = {"words": [], "segments": []}
for s in segs:
    out["segments"].append({"start": round(s.start,3), "end": round(s.end,3), "text": s.text.strip()})
    for w in s.words:
        out["words"].append({"word": w.word.strip(), "start": round(w.start,3), "end": round(w.end,3)})
    print(f"[{s.start:6.2f}] {s.text}", flush=True)
json.dump(out, open(sys.argv[2], "w"), indent=1)
