"""Word-level transcription with faster-whisper (offline once the model is installed)."""
import os
from pathlib import Path

from .arabic import FILLERS, norm_word
from .audio import load_mono16
from .project import ROOT, Project, load_config

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
MODELS = Path(os.environ.get("AYAH_MODELS", ROOT / "models"))

# repetitions that carry meaning are never dropped
MEANINGFUL_REPEATS = {"رب", "يارب", "لبيك", "الله", "ياالله", "استغفرالله", "سبحان"}


def get_model(cfg):
    from faster_whisper import WhisperModel
    name = cfg["model"]
    local = os.environ.get("HF_HUB_OFFLINE") == "1"
    return WhisperModel(name, device="cpu", compute_type=cfg["computeType"], cpu_threads=os.cpu_count() or 2,
                        download_root=str(MODELS), local_files_only=local)


def transcribe(p: Project, progress=None) -> dict:
    cfg = load_config(p)["transcribe"]
    model = get_model(cfg)
    audio = load_mono16(p.file("voice16.wav"))
    segs, info = model.transcribe(audio, language="ar", beam_size=cfg["beamSize"], word_timestamps=True,
                                  vad_filter=True, condition_on_previous_text=False)
    words, segments = [], []
    for s in segs:
        idx0 = len(words)
        for w in s.words or []:
            txt = w.word.strip()
            if not txt:
                continue
            words.append({"i": len(words), "w": txt, "start": round(w.start, 3), "end": round(w.end, 3),
                          "p": round(w.probability, 3)})
        segments.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
                         "words": [idx0, len(words)]})
        if progress:
            progress(s.end / info.duration)
    clean(words, cfg["lowConfidence"])
    tr = {"language": info.language, "duration": info.duration, "words": words, "segments": segments}
    p.write("transcript.json", tr)
    return tr


def clean(words: list, low: float) -> None:
    """Flag (never delete) low-confidence words, stutters, repeats and fillers. The dashboard can override."""
    for k, w in enumerate(words):
        n = norm_word(w["w"])
        w["norm"] = n
        w["flags"] = []
        if w["p"] < low:
            w["flags"].append("low")
        if n in FILLERS:
            w["drop"] = "filler"
        nxt = norm_word(words[k + 1]["w"]) if k + 1 < len(words) else ""
        if nxt and n == nxt and n not in MEANINGFUL_REPEATS:
            w["drop"] = "repeat"
        elif nxt and len(n) <= 3 and len(nxt) > len(n) and nxt.startswith(n) and words[k + 1]["start"] - w["end"] < 0.4:
            w["drop"] = "stutter"
