"""Import, background-bed detection, and pause cutting (only on a clean voice)."""
import shutil
import subprocess
from pathlib import Path

import numpy as np

from .project import Project, load_config


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed:\n{r.stderr[-1500:]}")
    return r.stdout


def probe(path: Path) -> dict:
    import json
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags=title,artist",
               "-show_streams", "-of", "json", str(path)])
    d = json.loads(out)
    return {
        "duration": float(d["format"]["duration"]),
        "tags": d["format"].get("tags", {}),
        "hasVideo": any(s["codec_type"] == "video" for s in d["streams"]),
    }


def ingest(p: Project, src: str) -> dict:
    """Copy the source in and extract source.wav (48 kHz, kept untouched) + voice16.wav for whisper."""
    srcp = Path(src)
    dst = p.file("source" + srcp.suffix.lower())
    if srcp.resolve() != dst.resolve():
        shutil.copyfile(srcp, dst)
    info = probe(dst)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(dst), "-vn", "-ac", "2", "-ar", "48000", str(p.file("source.wav"))])
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(dst), "-vn", "-ac", "1", "-ar", "16000", str(p.file("voice16.wav"))])
    meta = {"source": dst.name, **info}
    p.write("meta.json", meta)
    return meta


def load_mono16(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ar", "16000", "-ac", "1", "-f", "s16le", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def _db(x: np.ndarray) -> float:
    if x.size == 0:
        return -120.0
    return float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9))


def analyze(p: Project) -> dict:
    """Decide whether there is a background bed under the voice, using the gaps between words.

    A bed (music, ambience, reverb tail) means the gaps are not silent relative to the speech.
    If there is a bed: the audio is never cut. Otherwise pauses longer than silenceMax are cut.
    """
    cfg = load_config(p)["audio"]
    a = load_mono16(p.file("voice16.wav"))
    sr = 16000
    words = [w for w in p.read("transcript.json")["words"]]
    speech = np.concatenate([a[int(w["start"] * sr):int(w["end"] * sr)] for w in words]) if words else a
    speech_db = _db(speech)
    gaps, levels = [], []
    edges = [0.0] + [x for w in words for x in (w["start"], w["end"])] + [len(a) / sr]
    for i in range(0, len(edges) - 1, 2):
        g0, g1 = edges[i], edges[i + 1]
        if g1 - g0 >= cfg["minGapForBedCheck"]:
            seg = a[int((g0 + 0.08) * sr):int((g1 - 0.08) * sr)]
            lvl = _db(seg) - speech_db
            gaps.append({"start": round(g0, 3), "end": round(g1, 3), "relDb": round(lvl, 1)})
            levels.append(lvl)
    inner = [g for g in gaps if g["start"] > 0 and g["end"] < len(a) / sr - 0.01]
    med = float(np.median([g["relDb"] for g in inner])) if inner else -99.0
    has_bed = med > cfg["bedGapDb"]
    res = {
        "speechDb": round(speech_db, 1),
        "gapMedianRelDb": round(med, 1),
        "threshold": cfg["bedGapDb"],
        "hasBed": bool(has_bed),
        "gaps": gaps,
        "decision": "keep-all-audio" if has_bed else "cut-long-pauses",
    }
    p.write("audio_analysis.json", res)
    return res


def plan_cuts(p: Project) -> list:
    cfg = load_config(p)["audio"]
    an = p.read("audio_analysis.json")
    if an["hasBed"]:
        return []
    cuts = []
    dur = p.read("meta.json")["duration"]
    for g in an["gaps"]:
        length = g["end"] - g["start"]
        # leading/trailing silence are trimmed to the keep length too
        if length > cfg["silenceMax"]:
            keep = cfg["silenceKeep"]
            at = g["start"] + keep / 2
            cuts.append([round(at, 3), round(length - keep, 3)])
    return cuts


def remap(t: float, cuts: list) -> float:
    """original time -> edited time"""
    out = t
    for at, removed in cuts:
        if t >= at + removed:
            out -= removed
        elif t > at:
            out -= (t - at)
    return out


def apply_cuts(p: Project) -> dict:
    """Write voice.wav (the audio the video uses) and remap every word time."""
    cuts = plan_cuts(p)
    src = p.file("source.wav")
    if not cuts:
        shutil.copyfile(src, p.file("voice.wav"))
    else:
        dur = p.read("meta.json")["duration"]
        keep, cur = [], 0.0
        for at, removed in cuts:
            keep.append((cur, at))
            cur = at + removed
        keep.append((cur, dur))
        parts, labels = [], []
        for i, (a, b) in enumerate(keep):
            if b - a < 0.02:
                continue
            fade = min(0.01, (b - a) / 3)
            parts.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d={fade:.3f},"
                         f"afade=t=out:st={max(0, b - a - fade):.3f}:d={fade:.3f}[s{i}]")
            labels.append(f"[s{i}]")
        graph = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]"
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-filter_complex", graph, "-map", "[out]", str(p.file("voice.wav"))])
    tr = p.read("transcript.json")
    for w in tr["words"]:
        w["t0"], w["t1"] = round(remap(w["start"], cuts), 3), round(remap(w["end"], cuts), 3)
    tr["cuts"] = cuts
    tr["duration"] = probe(p.file("voice.wav"))["duration"]
    p.write("transcript.json", tr)
    return {"cuts": len(cuts), "removed": round(sum(c[1] for c in cuts), 2), "duration": tr["duration"]}
