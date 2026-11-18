"""Detect Quran verses (offline, against the bundled Uthmani text), hadith and dhikr.

Every detected span becomes a no-SFX zone and a card that the user must confirm before rendering.
"""
import json
import re
from collections import defaultdict
from functools import lru_cache

from rapidfuzz import fuzz

from .arabic import norm, norm_word, skeleton
from .project import ROOT, Project

QURAN = ROOT / "assets" / "quran" / "quran_flat.json"
MAX_INSERT = 3
HADITH_LIB = ROOT / "assets" / "hadith" / "library.json"
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

HADITH_MARKERS = ["قال رسول الله", "قال النبي", "النبي قال", "رسول الله قال", "كلام النبي", "عليه الصلاه والسلام", "صلي الله عليه وسلم", "عن النبي", "قال صلي الله", "في الحديث",
                  "يقول النبي", "يقول رسول الله", "الرسول بيقول", "النبي بيقول", "حديث"]
SKIP_LEAD = {"كده", "كدا", "عليه", "الصلاه", "والسلام", "صلي", "الله", "وسلم", "قال", "بيقول", "يقول", "ان", "انه"}
DHIKR = ["سبحان الله", "الحمد لله", "الله اكبر", "لا اله الا الله", "استغفر الله", "لا حول ولا قوه الا بالله",
         "اللهم صل علي محمد", "حسبي الله ونعم الوكيل", "سبحان الله وبحمده"]


@lru_cache(1)
def index():
    """verse tokens (display + normalised, aligned) and a trigram inverted index."""
    data = json.loads(QURAN.read_text(encoding="utf-8"))
    verses, grams = [], defaultdict(set)
    for vi, (sura, sname, aya, text) in enumerate(data):
        toks = [t for t in text.split() if norm_word(t)]
        nt = [norm_word(t) for t in toks]
        sk = [skeleton(t) for t in toks]
        verses.append({"sura": sura, "name": sname, "aya": aya, "toks": toks, "norm": nt})
        for k in range(len(sk) - 2):
            grams[" ".join(sk[k:k + 3])].add((vi, k))
    return verses, grams


def _ref(v_first, v_last):
    a = str(v_first["aya"]).translate(AR_DIGITS)
    if v_last["aya"] != v_first["aya"]:
        a += "–" + str(v_last["aya"]).translate(AR_DIGITS)
    return f"[{v_first['name']}: {a}]"


def find_quran(words: list) -> list:
    verses, grams = index()
    nw = [w["norm"] for w in words]
    sw = [skeleton(w["w"]) for w in words]
    hits, i = [], 0
    while i < len(nw) - 2:
        cands = grams.get(" ".join(sw[i:i + 3]))
        if not cands:
            i += 1
            continue
        best = None
        for vi, k in cands:
            # walk forward through this verse and the next ones while words keep matching
            j, v, kk, miss = i, vi, k, 0
            end_j, end_v, end_k = i, vi, k
            while j < len(nw) and v < len(verses) and miss <= MAX_INSERT:
                vt = verses[v]["norm"]
                if kk >= len(vt):
                    v, kk = v + 1, 0
                    continue
                if fuzz.ratio(nw[j], vt[kk]) >= 80:
                    end_j, end_v, end_k, miss = j, v, kk, 0
                    j, kk = j + 1, kk + 1
                else:
                    miss += 1
                    j += 1  # tolerate the speaker's short explanation inside a verse
            n = end_j - i + 1
            if n >= 3 and (best is None or n > best[0]):
                best = (n, vi, k, end_j, end_v, end_k)
        if not best:
            i += 1
            continue
        n, vi, k, end_j, end_v, end_k = best
        toks, v, kk = [], vi, k
        while (v, kk) <= (end_v, end_k):
            vt = verses[v]["toks"]
            if kk >= len(vt):
                toks.append("۝")
                v, kk = v + 1, 0
                continue
            toks.append(vt[kk])
            kk += 1
        display = re.sub(r"\s*[ۖۗۘۙۚۛۜ]\s*", " ", " ".join(toks)).strip()
        hits.append({
            "type": "quran", "words": [i, end_j], "start": words[i]["start"], "end": words[end_j]["end"],
            "text": f"﴿{display}﴾", "ref": _ref(verses[vi], verses[end_v]),
            "partial": not (k == 0 and end_k == len(verses[end_v]["norm"]) - 1),
            "heard": " ".join(w["w"] for w in words[i:end_j + 1]),
            "confirmed": False, "font": "Amiri Quran",
        })
        i = end_j + 1
    return hits


def find_phrases(words: list, phrases: list, kind: str) -> list:
    out = []
    joined = [w["norm"] for w in words]
    for ph in phrases:
        pw = norm(ph).split()
        L = len(pw)
        for i in range(len(joined) - L + 1):
            if fuzz.ratio(" ".join(joined[i:i + L]), " ".join(pw)) >= 88:
                out.append({"type": kind, "words": [i, i + L - 1], "start": words[i]["start"],
                            "end": words[i + L - 1]["end"], "heard": " ".join(w["w"] for w in words[i:i + L])})
    return out


def hadith_candidates(words: list, quran: list) -> list:
    """A hadith marker opens a candidate span that runs to the next long pause (max ~25 words).

    There is no offline hadith corpus, so the user must type the authentic wording + source,
    or mark the span as «كلام الشيخ» (shown in «» with no source line).
    """
    out = []
    for m in find_phrases(words, HADITH_MARKERS, "marker"):
        a = m["words"][1] + 1
        while a < len(words) and words[a]["norm"] in SKIP_LEAD:
            a += 1
        b = a
        while b + 1 < len(words) and b - a < 25 and words[b + 1]["start"] - words[b]["end"] < 0.7:
            b += 1
        if a >= len(words) or any(q["words"][0] <= a <= q["words"][1] for q in quran):
            continue
        if out and out[-1]["words"][1] >= a:
            continue
        out.append({"type": "hadith", "words": [a, b], "start": words[a]["start"], "end": words[b]["end"],
                    "heard": " ".join(w["w"] for w in words[a:b + 1]), "text": "", "source": "",
                    "status": "needs-text", "confirmed": False, "font": "Amiri"})
    return out


def _by_keys(nw, keys, window=45):
    """first span (≤ window words) containing every key regex in order."""
    best = None
    for i, w in enumerate(nw):
        if not re.search(keys[0], w):
            continue
        j, ok = i, True
        for k in keys[1:]:
            j2 = next((x for x in range(j + 1, min(len(nw), i + window)) if re.search(k, nw[x])), None)
            if j2 is None:
                ok = False
                break
            j = j2
        if ok:
            return (i, j)  # first occurrence
    return best


def _trim(nw, a, b, key):
    """drop leading/trailing words that don't help the match."""
    base = fuzz.token_set_ratio(" ".join(nw[a:b + 1]), key)
    while a < b and fuzz.token_set_ratio(" ".join(nw[a + 1:b + 1]), key) >= base:
        a += 1
    while b > a and fuzz.token_set_ratio(" ".join(nw[a:b]), key) >= base:
        b -= 1
    return a, b


def find_library(words: list, taken: list) -> list:
    """Fuzzy-match known authentic hadith (assets/hadith/library.json) — also catches paraphrases.

    A match is only a *suggestion*: the card shows the authentic wording + source and waits for the user.
    """
    if not HADITH_LIB.exists():
        return []
    lib = json.loads(HADITH_LIB.read_text(encoding="utf-8"))
    nw = [w["norm"] for w in words]
    out = []
    for h in lib:
        if h.get("keys"):
            hit = _by_keys(nw, h["keys"])
            if hit and not any(t["words"][0] <= hit[0] <= t["words"][1] for t in taken + out):
                a, b = hit
                out.append({"type": "hadith", "words": [a, b], "start": words[a]["start"], "end": words[b]["end"],
                            "heard": " ".join(w["w"] for w in words[a:b + 1]), "text": f"«{h['text']}»", "source": h["source"],
                            "status": "suggested", "match": "keys", "confirmed": False, "font": "Amiri"})
                continue
        key = norm(h.get("match", h["text"]))
        L = len(key.split())
        best = (0, 0, 0)
        for i in range(len(nw)):
            for n in range(max(3, L - 4), L + 8):
                if i + n > len(nw):
                    break
                sc = fuzz.token_set_ratio(" ".join(nw[i:i + n]), key) * min(1, n / max(4, L * 0.6))
                if sc > best[0]:
                    best = (sc, i, i + n - 1)
        sc, a, b = best
        if sc:
            a, b = _trim(nw, a, b, key)
        if sc >= h.get("threshold", 62) and not any(t["words"][0] <= a <= t["words"][1] for t in taken + out):
            out.append({"type": "hadith", "words": [a, b], "start": words[a]["start"], "end": words[b]["end"],
                        "heard": " ".join(w["w"] for w in words[a:b + 1]), "text": f"«{h['text']}»", "source": h["source"],
                        "status": "suggested", "score": round(sc), "confirmed": False, "font": "Amiri"})
    return out


def detect(p: Project) -> dict:
    tr = p.read("transcript.json")
    words = tr["words"]
    for w in words:  # re-detection starts clean
        w.pop("sacred", None)
    q = find_quran(words)
    lib = find_library(words, q)
    h = lib + [c for c in hadith_candidates(words, q + lib)
               if not any(x["words"][0] <= c["words"][1] and c["words"][0] <= x["words"][1] for x in lib)]
    d = [x for x in find_phrases(words, DHIKR, "dhikr")
         if not any(s["words"][0] <= x["words"][0] <= s["words"][1] for s in q + h)]
    for x in d:
        x["confirmed"] = True
        x["font"] = "Amiri"
    spans = sorted(q + h + d, key=lambda s: s["start"])
    for k, s in enumerate(spans):
        s["id"] = f"{s['type'][0]}{k + 1}"
        s["noSfx"] = [round(s["start"] - 0.5, 3), round(s["end"] + 0.5, 3)]
        for wi in range(s["words"][0], s["words"][1] + 1):
            words[wi]["sacred"] = s["id"]
    p.write("transcript.json", tr)
    p.write("sacred.json", {"spans": spans})
    return {"quran": len(q), "hadith": len(h), "dhikr": len(d), "spans": spans}
