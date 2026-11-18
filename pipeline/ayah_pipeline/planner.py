"""Storyboard planner.

Design: the planner (rules / local Ollama / Claude API) only decides *meaning* per beat:
who, pose, action, objects, mood. Geometry (positions, aim angles, shadow reach, hands on ropes),
motion timing and the fixed template are always computed by `compose()` in code, so a weaker
model can't break the realism or shar'i rules — and the linter checks the result anyway.
"""
import json
import os
import re
import urllib.request

from . import geometry as G
from . import recipes as R
from .arabic import norm_word
from .project import Project, load_config

GROUND = R.GROUND

# meaning dictionary (from brand-identity.md) — normalised keyword stems → visual beat hints
LEXICON = [
    (r"^(ال)?(فلوس|مال|اموال|دهب|ذهب|غني|ثروه|ملايين|مليون|الف)", {"obj": "coins", "action": "want", "mood": "heedless"}),
    (r"(طمع|يطمع|بتطمع|الطمع|عايز|عاوز|اكتر|زياده|كمان)", {"nafs": True, "action": "want"}),
    (r"^(ال)?(بيت|بيوت|شقه|شقق)", {"obj": "house"}),
    (r"^(ال)?(عربيه|عربيات)", {"obj": "car", "action": "want"}),
    (r"^(ال)?(فيلا|قصر)", {"obj": "villa", "action": "want"}),
    (r"^(ال)?(طياره|يخت)", {"obj": "plane", "action": "want"}),
    (r"(موت|يموت|مات|قبر|القبر|الموت)", {"obj": "grave", "pose": "sad", "mood": "cold"}),
    (r"(عمر|ساعه|الوقت|سنين)", {"obj": "icon", "icon": "hourglass"}),
    (r"(دعا|ادعي|يدعي|يارب|ربنا)", {"pose": "dua", "view": "back", "light": True}),
    (r"^(و|ف)?(يصلي|بيصلي|نصلي|تصلي|سجود|سجد|يسجد|السجود)$", {"pose": "sujood", "obj": "mat", "light": True}),
    (r"(يجري|جري|بيجري|يلهث|تعب)", {"pose": "walk", "view": "side"}),
    (r"^(ال)?(سلم|السلالم)$|^(بيطلع|يطلع|طالع)$", {"obj": "ladder", "action": "climb", "view": "back"}),
    (r"(فرح|مبسوط|سعاده|سعيد|رضا|راضي|قناعه|القناعه)", {"pose": "happy", "mood": "warm", "light": True}),
    (r"(حزن|زعلان|ضيق|هم|غم|خوف)", {"pose": "sad", "mood": "cold"}),
    (r"(نور|هدي|هدايه|علم)", {"obj": "lantern"}),
    (r"^(ال)?(قران|مصحف)$", {"obj": "quran"}),
    (r"(فقير|مسكين|محتاج)", {"extra": "poor"}),
    (r"(جبل|جبال|وادي)", {"obj": "mountain"}),
]


def _hints(words):
    h = {}
    for w in words:
        n = w["norm"]
        for rx, hint in LEXICON:
            if re.search(rx, n):
                for k, v in hint.items():
                    h.setdefault(k, v)
                w["key"] = True
    return h


def phrases(tr: dict) -> list:
    """caption phrases: split on pauses ≥ 0.45 s or every ~6 words, dropping stutters/fillers."""
    out, cur = [], []
    words = [w for w in tr["words"] if not w.get("drop")]
    for k, w in enumerate(words):
        if cur and (w["t0"] - cur[-1]["t1"] >= 0.45 or len(cur) >= 6 or (w.get("sacred") != cur[-1].get("sacred"))):
            out.append(cur); cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def beats_rules(ph: list, sacred: list, beat: float) -> list:
    beats, cur = [], []
    span_of = lambda q: next((w["sacred"] for w in q if (w.get("sacred") or "d")[0] in "qh"), None)
    for n, p in enumerate(ph):
        cur.append(p)
        nxt = ph[n + 1] if n + 1 < len(ph) else None
        # sacred spans always get their own beat (so each one has its card)
        boundary = nxt is not None and (span_of(nxt) != span_of(p) and (span_of(nxt) or span_of(p)))
        quoting = re.fullmatch(r"(و)?(تقول|هتقول|يقول|بيقول|قلت|تقولي)", p[-1]["norm"]) or (len(p) > 1 and re.fullmatch(r"(و)?(تقول|هتقول|يقول|بيقول)", p[-2]["norm"]))
        if (p[-1]["t1"] - cur[0][0]["t0"] >= beat and not (quoting and nxt is not None and not boundary)) or nxt is None or boundary:
            words = [w for q in cur for w in q]
            b = {"start": words[0]["t0"], "end": words[-1]["t1"], "words": [words[0]["i"], words[-1]["i"]],
                 "meaning": " ".join(w["w"] for w in words)}
            b.update(_hints(words))
            b["suggest"] = [[r, p] for r, p in R.suggest(words)]
            sid = next((w["sacred"] for w in words if w.get("sacred")), None)
            if sid:
                b["sacred"] = sid
            beats.append(b)
            cur = []
    # merge beats shorter than 1.2 s into the previous one (never a card beat)
    out = []
    for b in beats:
        card = (b.get("sacred") or "d")[0] in "qh"
        if out and b["end"] - b["start"] < 1.2 and not card and not (out[-1].get("sacred") or "d")[0] in "qh":
            out[-1].update(end=b["end"], meaning=out[-1]["meaning"] + " " + b["meaning"], words=[out[-1]["words"][0], b["words"][1]])
        else:
            out.append(b)
    return out


# ---------- LLM planners (same output contract as beats_rules) ----------
PROMPT = """أنت مخرج موشن جرافيك لقناة «آية لمست قلبي». قسّم الكلام لمشاهد (مشهد كل 4–6 ثواني) واختار لكل مشهد «وصفة» من المكتبة دي بس:
{catalog}
باراميترات: thought و sign محتاجين "text" (كلمات الشيخ نفسها، بنفس لهجته، 1–5 كلمات). want و hypo و count و no محتاجين "obj" من: coins, house, flat, car, villa, plane, yacht, sack. count ممكن ياخد "n" (2–4).
القواعد: كل مشهد يشرح الجملة اللي بتتقال فيه. ممنوع أي رسم لنبي أو رمز لله أو تصوير الجنة والنار أو عنف. ممنوع تكرار نفس الوصفة في مشهدين ورا بعض.
المقاطع اللي فيها آية أو حديث سيبها (الأداة بتحط كارت لوحدها).
رجّع JSON بس:
{{"beats":[{{"words":[أول_رقم_كلمة, آخر_رقم_كلمة], "recipe":"...", "params":{{}}, "mood":"calm|warm|cold"}}], "hook":"هوك قصير (3–6 كلمات) من هدف الفيديو", "pinned":"سؤال يتجاوب عليه من موضوع الفيديو", "title":"عنوان قصير", "description":"وصف من سطرين"}}
الكلام (رقم_الكلمة:الكلمة@الثانية):
{words}
"""


def build_prompt(tr):
    cat = "\n".join(f"- {k}: {v}" for k, v in R.CATALOG.items() if k != "card")
    return PROMPT.format(catalog=cat, words=_llm_words(tr))


def estimate(p: Project) -> dict:
    """rough token estimate shown to the user before any AI call (Arabic ≈ 2.6 chars/token)."""
    tr = p.read("transcript.json")
    prompt = build_prompt(tr)
    n_in = round(len(prompt) / 2.6)
    dur = tr.get("duration", 60)
    n_out = round(dur / 5 * 70 + 250)
    return {"input": n_in, "output": n_out, "total": n_in + n_out}


def _llm_words(tr):
    return " ".join(f"{w['i']}:{w['w']}@{w['t0']:.1f}" for w in tr["words"] if not w.get("drop"))


def _parse_json(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0))


def beats_ollama(tr, cfg, women):
    body = json.dumps({"model": cfg["planner"]["ollamaModel"], "stream": False, "format": "json",
                       "prompt": build_prompt(tr)}).encode()
    req = urllib.request.Request(os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434") + "/api/generate", body,
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return _parse_json(json.loads(r.read())["response"])


def beats_claude(tr, cfg, women):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY مش متسجل. حطه في الإعدادات أو استخدم الوضع المحلي.")
    body = json.dumps({"model": cfg["planner"]["claudeModel"], "max_tokens": 8000,
                       "messages": [{"role": "user", "content": build_prompt(tr)}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", body, {
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return _parse_json(json.loads(r.read())["content"][0]["text"])


def _from_llm(data, tr):
    W = {w["i"]: w for w in tr["words"]}
    beats = []
    for b in data.get("beats", []):
        a, z = b["words"]
        if a not in W or z not in W:
            continue
        b["start"], b["end"] = W[a]["t0"], W[z]["t1"]
        if b.get("recipe") not in R.CATALOG:
            b.pop("recipe", None)
        b["meaning"] = " ".join(W[i]["w"] for i in range(a, z + 1) if i in W)
        b["suggest"] = [[r, q] for r, q in R.suggest([W[i] for i in range(a, z + 1) if i in W])]
        if b.get("recipe"):
            b["suggest"] = [[b["recipe"], b.get("params", {})]] + [s for s in b["suggest"] if s[0] != b["recipe"]]
        sid = next((W[i].get("sacred") for i in range(a, z + 1) if i in W and W[i].get("sacred")), None)
        if sid:
            b["sacred"] = sid
        beats.append(b)
    return beats


# ---------- compose: beats → full storyboard with geometry, motion and template ----------
def _motion_enter(target, start, prop="y", dist=26):
    return [{"target": target, "prop": prop, "from": dist, "to": 0, "start": start, "dur": 0.45, "ease": "out", "phase": "enter", "layer": "primary"},
            {"target": target, "prop": "opacity", "from": 0, "to": 1, "start": start, "dur": 0.45, "ease": "out", "phase": "enter", "layer": "primary"}]


def compose_scene(k, b, spans, women):
    sc = {"id": f"s{k + 1}", "start": b["start"], "end": b["end"], "meaning": b["meaning"], "words": b["words"],
          "role": "intro" if k == 0 else ("sacred" if b.get("sacred") else "story"),
          "background": {"kind": "paper", "mood": b.get("mood", "calm")}, "characters": [], "elements": [], "motion": [],
          "transition": "crossfade"}
    t0, t1 = b["start"], b["end"]
    span = next((s for s in spans if s["id"] == b.get("sacred")), None)
    if span and span["type"] in ("quran", "hadith"):
        sc["elements"].append({"id": "card", "type": "ayah_card" if span["type"] == "quran" else "hadith_card",
                               "x": 540, "y": 1300, "span": span["id"], "why": span.get("heard", "")})
        sc["motion"] += _motion_enter("card", t0)
        sc["motion"].append({"target": "bg", "prop": "light", "from": 0.95, "to": 1.05, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "background"})
        return sc

    rec, params = b.get("recipe"), b.get("params", {})
    if not rec:
        sugg = b.get("suggest") or [["present", {}]]
        rec, params = sugg[0]
        if k == 0 and rec not in ("ages",):
            rec, params = "present", {}
    sc["recipe"], sc["params"], sc["suggest"], sc["flip"] = rec, params, b.get("suggest", []), b.get("flip", False)
    built = R.compose(rec, params, t0, t1, flip=b.get("flip", False), mood=b.get("mood"))
    for kname in ("characters", "elements", "motion", "camera", "lightReason"):
        if kname in built:
            sc[kname] = built[kname]
    sc["background"] = built["background"]
    if not women:
        sc["characters"] = [c for c in sc["characters"] if c["kind"] != "woman"]
    return sc


def vary(beats):
    """no recipe twice in a row; mirror every other scene of the same family for visual variety."""
    prev, flip = None, False
    for b in beats:
        if b.get("sacred") and (b["sacred"][0] in "qh"):
            prev = "card"
            continue
        sugg = b.get("suggest") or []
        if b.get("recipe") and b["recipe"] != prev:
            choice = b["recipe"]
        else:
            pick = next((s for s in sugg if s[0] != prev), sugg[0] if sugg else ["present", {}])
            b["recipe"], b["params"] = pick
            choice = pick[0]
        flip = not flip
        b["flip"] = flip
        prev = choice
    return beats


def compose(p: Project, beats: list, hook: str | None, pinned: str | None, cfg: dict) -> dict:
    tr = p.read("transcript.json")
    spans = p.read("sacred.json")["spans"] if p.has("sacred.json") else []
    women = cfg["shariah"]["womenAllowed"]
    vdur = tr["duration"]
    tail = 3.0
    dur = round(vdur + tail, 3)
    beats = vary(beats)
    scenes = [compose_scene(k, b, spans, women) for k, b in enumerate(beats)]
    # contiguous timeline from 0 to the end of the outro
    for k, sc in enumerate(scenes):
        sc["start"] = 0.0 if k == 0 else scenes[k - 1]["end"]
        sc["end"] = round(scenes[k + 1]["start"] if k + 1 < len(scenes) else vdur, 3)
    for k, sc in enumerate(scenes):
        if sc["end"] - sc["start"] > 3.5 and not sc.get("camera"):
            cx = sc["characters"][0]["x"] if sc["characters"] else 540
            z = 1.12 if sc["background"].get("mood") == "cold" else 1.07
            sc["camera"] = {"from": {"zoom": 1, "x": 540, "y": 1300}, "to": {"zoom": z, "x": cx + (0 if sc["role"] == "sacred" else 120), "y": 1350},
                            "ease": "inOut"}
    scenes.append({"id": "outro", "start": scenes[-1]["end"] if scenes else 0, "end": dur, "role": "outro", "meaning": "الختام وجملة المشاركة",
                   "words": [0, 0], "background": {"kind": "dawn", "mood": "warm"}, "characters": [], "elements": [],
                   "motion": _motion_enter("shareLine", vdur) + [{"target": "bg", "prop": "light", "from": 1, "to": 1.04, "start": vdur, "dur": tail, "ease": "inOut", "phase": "move", "layer": "background"}]})

    ph = phrases(tr)
    captions = []
    for q in ph:
        words = []
        for w in q:
            color = "gold" if w.get("sacred") and any(s["id"] == w["sacred"] and s["type"] in ("quran", "hadith", "dhikr") for s in spans) else ("coral" if w.get("key") else "ink")
            words.append({"w": w["w"], "t": w["t0"], "end": w["t1"], "key": bool(w.get("key")), "sacred": w.get("sacred"), "color": color})
        captions.append({"start": q[0]["t0"], "end": q[-1]["t1"], "words": words})

    # «لايك» at the calmest moment in the middle: longest pause between 30% and 70%, outside sacred zones
    best, like = 0, vdur * 0.5
    ws = [w for w in tr["words"] if not w.get("drop")]
    for a, b in zip(ws, ws[1:]):
        mid = (a["t1"] + b["t0"]) / 2
        if vdur * 0.3 <= mid <= vdur * 0.7 and b["t0"] - a["t1"] > best and not any(s["noSfx"][0] <= mid <= s["noSfx"][1] for s in spans):
            best, like = b["t0"] - a["t1"], mid

    for sc in scenes:  # keep the mascot corner (bottom-left) free while it talks
        if sc["start"] - 0.5 <= like <= sc["end"] + 2.6 and sc["characters"]:
            items = sc["characters"] + [e for e in sc["elements"] if e["type"] not in ("ayah_card", "hadith_card", "path")]
            lo = min(i["x"] for i in items)
            if lo < 480:
                hi = max(i["x"] for i in items)
                for i in items:
                    i["x"] = round(500 + (i["x"] - lo) * (880 - 500) / max(1, hi - lo)) if hi > lo else 640
                    if i in sc["characters"]:
                        i["scale"] = round(i.get("scale", 1) * 0.85, 2)
                for m in sc["motion"]:
                    if m["prop"] == "x" and m["phase"] == "move":
                        m["from"], m["to"] = max(480, m["from"]), max(480, m["to"])
                for c in sc["characters"]:
                    if c.get("target") and c.get("view") == "back":
                        c["aim"] = round(G.aim_to(c, next(e for e in sc["elements"] if e["id"] == c["target"])))
                    if c.get("shadow"):
                        el = next((e for e in sc["elements"] if e["id"] == c["shadow"].get("toward")), None)
                        if el:
                            c["shadow"]["reach"] = max(0, round(G.bbox(el)[0] - c["x"] - 10))
    if not hook:
        keyp = next((q for q in ph if any(w.get("key") for w in q)), ph[0] if ph else [])
        hook = " ".join(w["w"] for w in keyp[:5])
    sfx = [{"t": m["start"], "kind": m["sfx"], "gain": 0.12} for sc in scenes for m in sc["motion"] if m.get("sfx")]
    sfx = [f for f in sfx if not any(s["noSfx"][0] <= f["t"] <= s["noSfx"][1] for s in spans)]
    sb = {
        "version": 1,
        "meta": {"title": hook, "slug": p.slug, "style": cfg["style"], "duration": dur, "voiceDuration": vdur, "fps": cfg["fps"],
                 "speaker": p.read("meta.json").get("speaker", "")},
        "settings": {"womenAllowed": women},
        "template": {
            "hook": {"text": hook, "start": 0, "end": 1.2, "bg": "#AFCDE6", "icon": "heart", "persist": False},
            "mascot": {"like": round(like, 2), "comment": round(vdur + 0.3, 2), "share": round(vdur + 1.6, 2)},
            "outro": {"shareLine": cfg["channel"]["shareLine"], "channel": cfg["channel"]["name"], "start": vdur},
        },
        "pinnedComment": pinned or "",
        "scenes": scenes, "captions": captions, "sfx": sfx,
    }
    return sb


def plan(p: Project, mode: str | None = None) -> dict:
    cfg = load_config(p)
    mode = mode or cfg["planner"]["mode"]
    tr = p.read("transcript.json")
    spans = p.read("sacred.json")["spans"] if p.has("sacred.json") else []
    for w in tr["words"]:
        w.pop("key", None)  # re-planning starts clean
    ph = phrases(tr)
    for q in ph:
        _hints(q)  # marks key words for captions in every mode
    hook = pinned = None
    used = mode
    if mode in ("local", "claude"):
        try:
            data = beats_claude(tr, cfg, cfg["shariah"]["womenAllowed"]) if mode == "claude" else beats_ollama(tr, cfg, cfg["shariah"]["womenAllowed"])
            ai_beats, hook, pinned = _from_llm(data, tr), data.get("hook"), data.get("pinned")
            beats = merge_ai(beats_rules(ph, spans, cfg["planner"]["beatSeconds"]), ai_beats)
            p.write("ai_extra.json", {k: data.get(k) for k in ("title", "description", "pinned", "hook")})
            if not beats:
                raise ValueError("empty plan")
        except Exception as e:  # never block the user: fall back to the fixed rules
            used = f"rules (fallback: {mode} — {str(e)[:120]})"
            beats = beats_rules(ph, spans, cfg["planner"]["beatSeconds"])
    else:
        beats = beats_rules(ph, spans, cfg["planner"]["beatSeconds"])
    p.write("transcript.json", tr)
    sb = compose(p, beats, hook, pinned, cfg)
    p.write("storyboard.json", sb)
    return {"mode": used, "scenes": len(sb["scenes"]), "hook": sb["template"]["hook"]["text"]}


def merge_ai(rule_beats, ai_beats):
    """keep the rules' segmentation (it isolates every verse/hadith so each gets its card and covers the whole clip);
    take the AI's recipe for each beat from the AI beat that overlaps it most."""
    for b in rule_beats:
        if (b.get("sacred") or "d")[0] in "qh":
            continue
        best, ov = None, 0.0
        for a in ai_beats:
            o = min(b["end"], a["end"]) - max(b["start"], a["start"])
            if o > ov and a.get("recipe"):
                best, ov = a, o
        if best:
            b["recipe"], b["params"] = best["recipe"], best.get("params", {})
            if best.get("mood"):
                b["mood"] = best["mood"]
            b["suggest"] = [[best["recipe"], best.get("params", {})]] + [x for x in b.get("suggest", []) if x[0] != best["recipe"]]
    return rule_beats


def rescene(p: Project, sid: str, recipe: str | None = None, params: dict | None = None) -> dict:
    """re-compose one scene after the user picked another recipe in the dashboard."""
    sb = p.read("storyboard.json")
    sc = next(s for s in sb["scenes"] if s["id"] == sid)
    rec = recipe or sc.get("recipe", "present")
    prm = params if params is not None else sc.get("params", {})
    built = R.compose(rec, prm, sc["start"], sc["end"], flip=sc.get("flip", False), mood=sc.get("background", {}).get("mood"))
    for k in ("characters", "elements", "motion", "camera", "lightReason", "background"):
        sc.pop(k, None) if k in ("camera", "lightReason") else None
        if k in built:
            sc[k] = built[k]
    sc["recipe"], sc["params"] = rec, prm
    p.write("storyboard.json", sb)
    if p.has("approvals.json"):
        ap = p.read("approvals.json")
        ap.setdefault("scenes", {}).pop(sid, None)
        p.write("approvals.json", ap)
    return {"scene": sid, "recipe": rec}


def plan_from_answer(p: Project, data: dict) -> dict:
    """use an AI answer (from any mode, including copy/paste) to build the storyboard."""
    cfg = load_config(p)
    tr = p.read("transcript.json")
    spans = p.read("sacred.json")["spans"] if p.has("sacred.json") else []
    for w in tr["words"]:
        w.pop("key", None)
    ph = phrases(tr)
    for q in ph:
        _hints(q)
    p.write("transcript.json", tr)
    beats = merge_ai(beats_rules(ph, spans, cfg["planner"]["beatSeconds"]), _from_llm(data, tr))
    p.write("ai_extra.json", {k: data.get(k) for k in ("title", "description", "pinned", "hook")})
    if any(data.get(k) for k in ("title", "description", "pinned")):
        p.write("publish.json", {**(p.read("publish.json") if p.has("publish.json") else {}), **{k: data[k] for k in ("title", "description", "pinned") if data.get(k)}})
    sb = compose(p, beats, data.get("hook"), data.get("pinned"), cfg)
    p.write("storyboard.json", sb)
    return {"mode": "ai", "scenes": len(sb["scenes"]), "hook": sb["template"]["hook"]["text"]}
