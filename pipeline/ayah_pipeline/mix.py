"""Audio mix: the speaker's voice untouched + sparse, quiet sound design tied to the motion.

Rules: no music; no SFX inside any verse / hadith / dhikr zone (±0.5 s); SFX well under the voice;
final loudness normalised for social (−14 LUFS, true peak −1.5 dB). Optional gentle denoise on a clean voice only.
"""
import subprocess

import numpy as np

from .audio import run
from .project import Project, load_config

SR = 48000


def _load(path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ar", str(SR), "-ac", "2", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def _env(n, attack=0.004, decay=0.08):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def _lowpass(x, k):
    c = np.cumsum(np.insert(x, 0, 0))
    y = (c[k:] - c[:-k]) / k
    return np.pad(y, (0, len(x) - len(y)))


rng = np.random.default_rng(7)


def sfx(kind: str) -> np.ndarray:
    if kind == "step":
        n = int(0.09 * SR); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 95 * t) * 0.8 + _lowpass(rng.standard_normal(n), 60) * 2.0
        return x * _env(n, 0.002, 0.03)
    if kind == "pop":
        n = int(0.09 * SR); t = np.arange(n) / SR
        f = 900 - 420 * t / t[-1]
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.03)
    if kind == "place":
        n = int(0.16 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 170 * t) + 0.4 * _lowpass(rng.standard_normal(n), 30)) * _env(n, 0.003, 0.05)
    if kind == "whoosh":
        n = int(0.4 * SR)
        x = _lowpass(rng.standard_normal(n), 12) - _lowpass(rng.standard_normal(n), 90)
        return x * np.hanning(n) * 1.4
    if kind == "lift":
        n = int(0.3 * SR); t = np.arange(n) / SR
        f = 260 + 300 * t / t[-1]
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n) * 0.6
    return np.zeros(1)


def events(sb: dict) -> list:
    """sound events from the storyboard: motion-tied SFX + mascot bubbles."""
    ev = []
    for sc in sb["scenes"]:
        for m in sc.get("motion", []):
            if m.get("sfx") == "steps":
                t = m["start"] + 0.2
                while t < m["start"] + m["dur"] - 0.2:
                    ev.append((round(t, 3), "step", 0.05)); t += 0.48
            elif m.get("phase") == "enter" and m.get("prop") == "scale" and m.get("layer") == "primary" and m["target"] in ("obj", "o1", "o2", "o3", "grave", "sign", "x"):
                ev.append((m["start"], "place", 0.05))
            elif m.get("phase") == "enter" and m.get("target") in ("bubble", "q"):
                ev.append((m["start"], "pop", 0.04))
        if sc.get("transition") == "crossfade" and sc["start"] > 0.5:
            ev.append((sc["start"] - 0.2, "whoosh", 0.03))
    mt = sb["template"]["mascot"]
    for k in ("like", "comment", "share"):
        ev.append((mt[k], "pop", 0.05))
    for f in sb.get("sfx", []):
        if f["kind"] not in ("steps",):
            ev.append((f["t"], f["kind"], f.get("gain", 0.05)))
    return sorted(ev)


def mix(p: Project, to: float | None = None) -> dict:
    cfg = load_config(p)
    sb = p.read("storyboard.json")
    spans = p.read("sacred.json")["spans"] if p.has("sacred.json") else []
    has_bed = p.read("audio_analysis.json")["hasBed"] if p.has("audio_analysis.json") else True
    dur = sb["meta"]["duration"] if to is None else min(to, sb["meta"]["duration"])
    voice = _load(p.file("voice.wav"))
    out = np.zeros((int(dur * SR) + 1, 2), np.float32)
    v = voice[: len(out)]
    out[: len(v)] += v
    kept, dropped = 0, 0
    for t, kind, gain in events(sb):
        if t >= dur:
            continue
        if any(s["noSfx"][0] <= t <= s["noSfx"][1] for s in spans):  # never over sacred text
            dropped += 1
            continue
        x = sfx(kind) * gain
        a = int(t * SR); b = min(len(out), a + len(x))
        out[a:b] += x[: b - a, None]
        kept += 1
    raw = p.file("mix_raw.f32")
    out.astype(np.float32).tofile(raw)
    chain = []
    if not has_bed and cfg["audio"].get("denoise", True):
        chain.append("afftdn=nr=8:nf=-45")  # gentle; never on a bed (it would eat the background)
    chain.append("loudnorm=I=-14:TP=-1.5:LRA=11")
    dst = p.file("mix.wav")
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw), "-af", ",".join(chain),
         "-ar", str(SR), str(dst)])
    raw.unlink()
    return {"sfx": kept, "removedInSacredZones": dropped, "duration": round(dur, 2), "denoise": not has_bed}


def srt(p: Project) -> str:
    """captions as SRT (Arabic, same words and timing as the on-screen caption)."""
    sb = p.read("storyboard.json")
    f = lambda t: f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)):03d}"
    lines = []
    for i, c in enumerate(sb["captions"], 1):
        lines += [str(i), f"{f(c['start'])} --> {f(c['end'] + 0.3)}", " ".join(w["w"] for w in c["words"]), ""]
    path = p.file("captions.srt")
    path.write_text("\n".join(lines), encoding="utf-8")
    return str(path)
