"""Scene recipes: complete, composed scenes (layout + motion) filled from the spoken sentence.

The rules engine (or the optional AI step) only picks a recipe and its parameters.
Positions, aim angles, shadow reach and timing are computed here, so every recipe is
correct by construction — and the linter still checks the result.
"""
import re

from . import geometry as G
from .arabic import norm

GROUND = 1560
OBJECT_WORDS = [
    (r"(فلوس|مال|اموال|ثروه|ملايين|مليون)", "coins"), (r"(دهب|ذهب)", "coins"), (r"(بيت|بيوت)", "house"), (r"(شقه|شقق)", "flat"),
    (r"(عربيه|عربيات)", "car"), (r"(فيلا|قصر)", "villa"), (r"(طياره)", "plane"), (r"(يخت)", "yacht"), (r"(شوال|اكياس)", "sack"),
]
NUMBERS = {"واحد": 1, "اول": 1, "اتنين": 2, "تاني": 2, "التاني": 2, "اثنين": 2, "ثاني": 2, "تلاته": 3, "تالت": 3, "التالت": 3, "ثالث": 3,
           "الثالث": 3, "ثالثا": 3, "ثلاثه": 3, "اربعه": 4, "خمسه": 5}

# name: (label shown in the dashboard, what it needs)
CATALOG = {
    "present": "تقديم: سالك من قدام",
    "walk": "ماشي في الطريق",
    "want": "عايز حاجة: بيشاور عليها وضله بيتمد لها",
    "thought": "فقاعة تفكير بالكلام المنقول",
    "sign": "لافتة بكلمة مهمة",
    "hypo": "«لو ليك…»: الحاجة بتظهر وجنبها علامة استفهام",
    "count": "عدّ: أرقام بتزيد مع الحاجة",
    "valley": "وادي دهب بين جبلين",
    "chart": "رسم بياني طالع (أكتر وأكتر)",
    "no": "نفي: علامة ✗ على الحاجة",
    "climb": "طالع سلّم (من ضهره)",
    "dua": "بيدعي",
    "sujood": "ساجد (مفيش حاجة قدامه)",
    "grave": "تذكير بالموت: قبر وساعة رملية",
    "ages": "شاب وكهل وشيخ",
    "light": "نور القلب (لحظة مهمة)",
    "lantern": "فانوس الهداية",
    "sad": "حزين ومهموم",
    "happy": "فرحان وراضي",
    "chase": "ماشي ناحية لافتة وهي بتبعد عنه (مش بيوصل)",
    "ladder": "سلّم الطمع: حاجات بتظهر واحدة ورا التانية وهو بيطلع",
    "valleys": "وادي بيتملي دهب، وبعده التاني والتالت على الكلام",
    "years": "عدّاد السنين بيكبر وهو بيعجّز",
    "tug": "شد حبل مع «حب الدنيا» (المجاهدة)",
    "conveyor": "سير متحرك ساحبه والدنيا معدّية",
    "stop": "علامة «قِف» والظل بيسيب الحاجات",
    "remember": "بيفتكر: فقاعة جواها رسمة (قبر/بيت/فلوس)",
    "paper": "ورقة مكتوب عليها (مثلًا «كلام النبي ﷺ»)",
    "heartx": "قلب بيعيّط وعليه شطب (مش كلام عواطف)",
    "card": "كارت آية أو حديث",
}

PATTERNS = [  # (regex on the normalised phrase, recipe, params-builder) — first match wins, the rest become suggestions
    (r"(كلام النبي|النبي قال|رسول الله قال|ده مش كلامي)", "paper", lambda m, ph: {"text": "كلام النبي ﷺ"}),
    (r"(افتكر|فاكر|تفتكر).{0,12}(القبر|الموت|هادم)", "remember", lambda m, ph: {"icon": "grave"}),
    (r"\b(اوقف|وقف|قف|استني)\b", "stop", None),
    (r"(بتسحل|بتسحب|ساحب|بتجري بيك|السير)", "conveyor", None),
    (r"(نجاهد|جاهد|مجاهده)", "tug", lambda m, ph: {"text": "حب الدنيا"}),
    (r"(عشت حياتك|طول عمرك|حياتك كلها|سنين)", "years", lambda m, ph: {"from": 20, "to": 80, "stamp": "مستحيل" if re.search("مستحيل", norm(" ".join(w["w"] for w in ph))) else ""}),
    (r"(وديين|واديين|جبلين|\bودي\b|\bوادي\b)", "valleys", lambda m, ph: {"n": 3 if re.search(r"(ثالث|التالت|تالت)", norm(" ".join(w["w"] for w in ph))) else 2 if re.search(r"(التاني|تاني|وديين|واديين)", norm(" ".join(w["w"] for w in ph))) else 1}),
    (r"(ملهاش نهايه|ورا الدنيا|وراء الدنيا|هيجر|بيجري ورا)", "ladder", None),
    (r"(كفايه).{0,40}|(هتوصل|توصل).{0,30}", "chase", lambda m, ph: {"text": "كفاية"}),
    (r"(عواطف|اغعاطيف|وعظ|وعظه)", "heartx", None),
    (r"(ايها الشاب|الشاب|الكهل|الشيخ وكلنا|كبير وصغير)", "ages", None),
    (r"\b(جبلين|جبل|الجبل|وادي|ودي|وديين|واديين)\b", "valley", None),
    (r"(تقول|هتقول|يقول|بيقول|قلت|تقولي|وتقول)\s+(.+)", "thought", lambda m, ph: {"text": _quote(ph, m)}),
    (r"\bلو (ليك|عندك|معاك|كان)\b", "hypo", None),
    (r"\b(ثالث|ثالثا|التالت|الثالث|تالت|تاني|التاني|اتنين)\b", "count", None),
    (r"(يكبر|بيكبر|اكتر|زياده|يزيد|بيزيد|يجمع)", "chart", None),
    (r"(مستحيل|ما بيحصلش|مش هتوصل|مفيش|ملهاش نهايه|عمرها ما)", "no", None),
    (r"(يجري ورا|بيجري|هيجر|يجر|يلهث|ورا الدنيا|وراء الدنيا)", "walk", None),
    (r"\b(السلم|سلم|بيطلع|يطلع)\b", "climb", None),
    (r"(قبر|القبر|الموت|يموت|هادم|اللذات)", "grave", None),
    (r"(يارب|ادعي|دعا|دعاء)", "dua", None),
    (r"\b(يصلي|بيصلي|نصلي|سجود|سجد|يسجد)\b", "sujood", None),
    (r"(نجاهد|جاهد|مجاهده|نهدي|الهدايه|هدايه|كلام النبي|النبي قال|رسول الله|عليه الصلاه والسلام)", "lantern", None),
    (r"(فلوس|مال|دهب|ذهب|عربيه|فيلا|بيت|شقه|طياره|يخت|عاوز|عايز)", "want", None),
    (r"\b(كفايه|خلاص)\b", "sign", lambda m, ph: {"text": "كفاية"}),
    (r"\b(حزين|زعلان|ضيق|الهم|هم|غم|تعبان)\b", "sad", None),
    (r"(فرحان|مبسوط|راضي|الحمد لله|قناعه)", "happy", None),
    (r"(ربنا|الله)", "light", None),
]


def _quote(ph_words, m):
    """the words after «تقول» (the quoted thought), max 5 words, in the speaker's own wording."""
    txt = " ".join(w["w"] for w in ph_words)
    k = next((i for i, w in enumerate(ph_words) if re.fullmatch(r"(و)?(تقول|هتقول|يقول|بيقول|قلت|تقولي)", w["norm"])), None)
    q = [w["w"] for w in ph_words[k + 1:]] if k is not None else txt.split()[-4:]
    q = [w for w in q if w not in ("بس", "يعني", "بقى")] or q
    return " ".join(q[:5])


def object_in(text: str) -> str | None:
    for rx, obj in OBJECT_WORDS:
        if re.search(rx, text):
            return obj
    return None


def suggest(words: list) -> list:
    """ranked recipe suggestions for a beat: [(recipe, params)], best first."""
    ph = norm(" ".join(w["w"] for w in words))
    out, seen = [], set()
    for rx, rec, pb in PATTERNS:
        m = re.search(rx, ph)
        if m and rec not in seen:
            seen.add(rec)
            params = pb(m, words) if pb else {}
            out.append((rec, params))
    if "want" not in seen and object_in(ph):
        out.append(("want", {}))
    for fallback in ("walk", "sign", "present"):
        if fallback not in seen and len(out) < 3:
            out.append((fallback, {"text": _key_word(words)} if fallback == "sign" else {}))
            seen.add(fallback)
    obj = object_in(ph)
    for i, (rec, p) in enumerate(out):
        p = dict(p)
        if obj and rec in ("want", "hypo", "count", "no", "valley", "chart"):
            p.setdefault("obj", obj)
        out[i] = (rec, p)
    return out


def _key_word(words):
    keys = [w["w"] for w in words if w.get("key")]
    return keys[0] if keys else max((w["w"] for w in words), key=len)


# ---------------- composition ----------------
def _enter(target, t, prop="y", frm=26, to=0, dur=0.45, layer="primary"):
    ms = [{"target": target, "prop": prop, "from": frm, "to": to, "start": t, "dur": dur, "ease": "out", "phase": "enter", "layer": layer}]
    ms.append({"target": target, "prop": "opacity", "from": 0, "to": 1, "start": t, "dur": dur, "ease": "out", "phase": "enter", "layer": layer})
    return ms


def _salik(x=360, view="back", pose="stand", mood="righteous", **kw):
    c = {"id": "salik", "kind": "salik", "x": x, "y": GROUND, "scale": 1.0, "view": view, "pose": pose, "mood": mood}
    c.update(kw)
    return c


def _raise_arm(c, el, at, mot):
    """the figure faces the target and lifts its arm to point at it exactly when the key word is said."""
    c["aim"] = round(G.aim_to(c, el))
    mot.append({"target": c["id"], "prop": "aim", "from": -80, "to": c["aim"], "start": at, "dur": 0.5, "ease": "out", "phase": "move", "layer": "primary", "sfx": "lift"})


def compose(recipe: str, params: dict, t0: float, t1: float, flip: bool = False, mood: str | None = None, keyt: float | None = None, words: list | None = None) -> dict:
    """returns {characters, elements, motion, camera?, background, lightReason?}"""
    p = params or {}
    wl = words or []

    def at(rx, default):
        """time the first word matching rx is said inside this scene (events land on the spoken word)."""
        for w in wl:
            if re.search(rx, w.get("norm", "")):
                return max(t0 + 0.1, min(t1 - 0.3, w["t0"]))
        return default
    kt = min(max(t0 + 0.3, keyt if keyt is not None else t0 + 0.6), max(t0 + 0.3, t1 - 0.8))  # the key word moment
    obj = p.get("obj", "coins")
    chars, els, mot, bg = [], [], [], {"kind": "paper", "mood": mood or "calm"}
    cam = None
    mid = (t0 + t1) / 2
    heedless = "heedless" if obj in ("coins", "villa", "car", "plane", "yacht") else "righteous"

    def want_pair(sx=330, ox=800, shadow=True):
        c = _salik(sx, "side", "point", heedless, action="want", target="obj")
        e = {"id": "obj", "type": obj, "x": ox, "y": GROUND, "scale": 1.0}
        _raise_arm(c, e, kt, mot)
        if shadow:
            c["shadow"] = {"reach": max(0, round(G.bbox(e)[0] - c["x"] - 12)), "toward": "obj"}
            mot.append({"target": "salik.shadow", "prop": "reach", "from": 0, "to": c["shadow"]["reach"], "start": kt + 0.2,
                        "dur": max(0.6, min(1.8, t1 - kt - 0.3)), "ease": "out", "phase": "move", "layer": "secondary"})
        return c, e

    if recipe == "present":
        chars.append(_salik(540, "front", "stand", action="present"))
        mot += _enter("salik", t0)
    elif recipe == "walk":
        c = _salik(300, "side", "walk", heedless if p.get("dunya", True) else "righteous", action="walk")
        chars.append(c)
        els.append({"id": "path", "type": "path", "x": 540, "y": GROUND + 6, "w": 1000, "overlapOk": True})
        if p.get("obj") or True:
            els.append({"id": "obj", "type": obj, "x": 900, "y": GROUND, "scale": 0.8})
        mot.append({"target": "salik", "prop": "x", "from": 200, "to": 560, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "secondary", "sfx": "steps", "pause": True})
        mot += _enter("obj", t0 + 0.3, "scale", 0.9, 1, 0.6, "background")
    elif recipe == "want":
        c, e = want_pair()
        chars.append(c); els.append(e)
        mot += _enter("obj", max(t0, kt - 0.35), "scale", 0.85, 1)
        mot.append({"target": "salik", "prop": "x", "from": 300, "to": 340, "start": kt, "dur": 0.8, "ease": "out", "phase": "move", "layer": "secondary"})
    elif recipe == "thought":
        c = _salik(330, "side", "stand", "righteous")
        chars.append(c)
        txt = p.get("text", "…")
        fs = 56 if len(txt) <= 12 else 46 if len(txt) <= 20 else 38
        els.append({"id": "bubble", "type": "thought", "x": 560, "y": 1150, "label": txt, "sub": p.get("sub", ""), "fontSize": fs, "overlapOk": True})
        mot += _enter("bubble", t0 + 0.3, "scale", 0.85, 1)
    elif recipe == "sign":
        chars.append(_salik(330, "side", "walk", action="walk"))
        els.append({"id": "sign", "type": "sign", "x": 780, "y": GROUND, "label": p.get("text", "كفاية"), "fontSize": 50})
        els.append({"id": "path", "type": "path", "x": 540, "y": GROUND + 6, "w": 1000, "overlapOk": True})
        mot += _enter("sign", t0 + 0.2, "y", 40, 0)
        mot.append({"target": "salik", "prop": "x", "from": 300, "to": 400, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "secondary", "sfx": "steps"})
    elif recipe == "hypo":
        c, e = want_pair(shadow=False)
        chars.append(c); els.append(e)
        els.append({"id": "q", "type": "thought", "x": 800, "y": 1230, "label": "؟", "fontSize": 80, "w": 170, "overlapOk": True})
        mot += _enter("obj", t0 + 0.1, "scale", 0.6, 1, 0.6)
        mot += _enter("q", kt, "scale", 0.8, 1)
    elif recipe == "count":
        n = int(p.get("n", 3))
        c = _salik(240, "side", "point", heedless, action="want", target="o3")
        chars.append(c)
        for i in range(n):
            e = {"id": f"o{i + 1}", "type": obj, "x": 450 + i * 165, "y": GROUND, "scale": 0.68}
            b = {"id": f"b{i + 1}", "type": "badge", "x": 450 + i * 165, "y": 1420, "label": "١٢٣٤٥"[i], "fontSize": 54, "w": 96, "h": 96}
            els += [e, b]
            at = t0 + 0.3 + i * min(0.9, (t1 - t0 - 0.6) / n)
            mot += _enter(e["id"], at, "scale", 0.7, 1) + _enter(b["id"], at + 0.1, "y", 24, 0)
        target = next(e for e in els if e["id"] == f"o{n}")
        c["target"] = target["id"]
        _raise_arm(c, target, t0 + 0.4, mot)
    elif recipe == "valley":
        els += [{"id": "m1", "type": "mountain", "x": 330, "y": GROUND, "scale": 0.95, "overlapWith": ["m2", "gold"]},
                {"id": "m2", "type": "mountain", "x": 760, "y": GROUND, "scale": 0.95, "overlapWith": ["m1", "gold"]},
                {"id": "gold", "type": "goldvalley", "x": 545, "y": GROUND, "scale": 1.0, "overlapWith": ["m1", "m2", "salik"]}]
        chars.append(_salik(545, "back", "stand", heedless, overlapWith=["gold", "m1", "m2"], scale=0.7))
        mot += _enter("m1", t0, "y", 60, 0, 0.6, "secondary") + _enter("m2", t0 + 0.15, "y", 60, 0, 0.6, "secondary") + _enter("gold", t0 + 0.4, "scale", 0.6, 1, 0.6)
    elif recipe == "chart":
        els.append({"id": "chart", "type": "chart", "x": 640, "y": 1420, "trend": "up", "overlapOk": True})
        chars.append(_salik(230, "side", "point", heedless, scale=0.85, target="chart"))
        _raise_arm(chars[-1], els[-1], kt, mot)
        mot.append({"target": "chart", "prop": "light", "from": 0, "to": 1, "start": t0 + 0.2, "dur": max(0.8, t1 - t0 - 0.4), "ease": "out", "phase": "move", "layer": "primary"})
        mot += _enter("chart", t0, "y", 30, 0)
    elif recipe == "no":
        els.append({"id": "obj", "type": obj, "x": 620, "y": GROUND, "scale": 1.1})
        els.append({"id": "x", "type": "xmark", "x": 620, "y": 1470, "overlapWith": ["obj"]})
        chars.append(_salik(260, "side", "sad", heedless))
        mot += _enter("obj", t0, "scale", 0.9, 1) + _enter("x", t0 + 0.5, "scale", 0.6, 1, 0.3)
        bg["mood"] = "cold"
    elif recipe == "climb":
        els.append({"id": "ladder", "type": "ladder", "x": 560, "y": GROUND, "scale": 1.0, "overlapWith": ["salik"]})
        els.append({"id": "obj", "type": obj, "x": 560, "y": 1000, "scale": 0.7, "overlapOk": True})
        chars.append(_salik(560, "back", "stand", heedless, action="climb", y=GROUND - 120, overlapWith=["ladder"]))
        mot.append({"target": "salik", "prop": "y", "from": 0, "to": -140, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "secondary", "sfx": "steps"})
    elif recipe == "dua":
        chars.append(_salik(540, "back", "dua", "righteous", light=1))
        bg.update(kind="dawn", mood="warm")
        cam = {"from": {"zoom": 1.0, "x": 540, "y": 1300}, "to": {"zoom": 1.1, "x": 540, "y": 1250}, "ease": "inOut"}
    elif recipe == "sujood":
        chars.append(_salik(420, "side", "sujood", "righteous", light=1))
        els.append({"id": "mat", "type": "mat", "x": 470, "y": GROUND, "overlapWith": ["salik"]})
        bg.update(kind="dawn", mood="warm")
    elif recipe == "grave":
        els += [{"id": "grave", "type": "grave", "x": 720, "y": GROUND}, {"id": "hg", "type": "icon", "icon": "hourglass", "x": 760, "y": 1180, "overlapOk": True}]
        chars.append(_salik(330, "side", "sad", "righteous"))
        mot += _enter("grave", t0, "y", 30, 0) + _enter("hg", t0 + 0.4, "scale", 0.8, 1)
        bg["mood"] = "cold"
    elif recipe == "ages":
        chars += [{"id": "young", "kind": "young", "x": 330, "y": GROUND, "view": "front", "pose": "stand", "action": "present", "scale": 0.86},
                  {"id": "salik", "kind": "salik", "x": 540, "y": GROUND, "view": "front", "pose": "stand", "action": "present", "scale": 0.9},
                  {"id": "old", "kind": "old_man", "x": 750, "y": GROUND, "view": "front", "pose": "stand", "action": "present", "scale": 0.9}]
        cam = {"from": {"zoom": 0.94, "x": 540, "y": 1300}, "to": {"zoom": 0.98, "x": 540, "y": 1300}, "ease": "inOut"}
        for i, (cid, rx) in enumerate((("young", r"الشاب"), ("salik", r"الكهل"), ("old", r"الشيخ"))):  # each one appears on his word
            mot += _enter(cid, at(rx, t0 + i * 0.5))
    elif recipe == "lantern":
        chars.append(_salik(380, "side", "point", "righteous", target="lamp"))
        e = {"id": "lamp", "type": "lantern", "x": 760, "y": 1300, "overlapOk": True}
        els.append(e)
        _raise_arm(chars[-1], e, kt, mot)
        mot.append({"target": "salik", "prop": "light", "from": 0, "to": 0.9, "start": kt + 0.3, "dur": 0.8, "ease": "out", "phase": "move", "layer": "secondary"})
        chars[-1]["light"] = 0.9
        mot += _enter("lamp", t0 + 0.2, "y", 30, 0)
    elif recipe == "light":
        chars.append(_salik(540, "back", "stand", "righteous", light=1))
        bg.update(kind="dawn", mood="warm")
    elif recipe == "chase":
        els.append({"id": "path", "type": "path", "x": 540, "y": GROUND + 6, "w": 1000, "overlapOk": True})
        els.append({"id": "sign", "type": "sign", "x": 700, "y": GROUND, "label": p.get("text", "كفاية"), "fontSize": 50})
        chars.append(_salik(220, "side", "walk", heedless, action="walk"))
        mot.append({"target": "salik", "prop": "x", "from": 200, "to": 470, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "primary", "sfx": "steps", "pause": True})
        mot.append({"target": "sign", "prop": "x", "from": 690, "to": 920, "start": t0 + 0.6, "dur": t1 - t0 - 0.6, "ease": "inOut", "phase": "move", "layer": "secondary"})
    elif recipe == "ladder":
        items = p.get("items") or ["flat", "villa", "car", "plane", "yacht"]
        labels = {"flat": "شقة", "villa": "فيلا", "car": "عربية", "plane": "طيارة", "yacht": "يخت", "house": "بيت", "coins": "فلوس"}
        els.append({"id": "ladder", "type": "ladder", "x": 540, "y": GROUND, "h": 900, "overlapWith": ["salik"]})
        n = len(items)
        for i, it in enumerate(items):
            y = GROUND - 150 - i * 150
            e = {"id": f"i{i}", "type": it, "x": 540 + (240 if i % 2 else -240), "y": y, "scale": 0.58, "caption": labels.get(it, ""), "overlapOk": True}
            els.append(e)
            mot += _enter(e["id"], t0 + 0.3 + i * (t1 - t0 - 0.8) / n, "scale", 0.6, 1, 0.45)
        els.append({"id": "inf", "type": "infinity", "x": 540, "y": GROUND - 960, "overlapOk": True})
        mot += _enter("inf", t1 - 0.7, "scale", 0.7, 1, 0.45)
        chars.append(_salik(540, "back", "stand", heedless, action="climb", scale=0.75, overlapWith=["ladder"]))
        mot.append({"target": "salik", "prop": "y", "from": 0, "to": -520, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "primary", "sfx": "steps", "pause": True})
        cam = {"from": {"zoom": 0.8, "x": 540, "y": 1180}, "to": {"zoom": 0.74, "x": 540, "y": 1050}, "ease": "inOut"}
    elif recipe == "valleys":
        n = int(p.get("n", 1))
        t2, t3 = at(r"(التاني|تاني|وديين|واديين)", t0 + (t1 - t0) * 0.45), at(r"(ثالث|التالت|تالت)", t0 + (t1 - t0) * 0.7)
        xs = [540] if n == 1 else [370, 710] if n == 2 else [275, 525, 775]
        sc = 1.0 if n == 1 else 0.75 if n == 2 else 0.58
        mx = [xs[0] - 170 * sc / 0.75 * 0.75] + [x + 170 * sc for x in xs] if n > 1 else [330, 760]
        for i, x in enumerate(mx):
            els.append({"id": f"m{i}", "type": "mountain", "x": round(x), "y": GROUND, "scale": round(sc * (0.95 if n == 1 else 1), 2), "overlapOk": True})
            mot += _enter(f"m{i}", t0 + 0.1 * i, "y", 50, 0, 0.6, "secondary")
        starts = [t0 + 0.3, t2, t3]
        for i, x in enumerate(xs):
            els.append({"id": f"g{i}", "type": "goldvalley", "x": x, "y": GROUND, "scale": sc, "overlapOk": True})
            mot.append({"target": f"g{i}", "prop": "light", "from": 0.02, "to": 1, "start": starts[i], "dur": 1.2, "ease": "out", "phase": "move", "layer": "primary"})
            mot += _enter(f"g{i}", starts[i], "y", 0, 0, 0.3)
        if n >= 3:
            c = _salik(120, "side", "point", "heedless", target="g2", scale=0.6, action="want", overlapOk=True)
            chars.append(c)
            _raise_arm(c, els[-1], t3, mot)
            els.append({"id": "want", "type": "thought", "x": 700, "y": 1060, "label": "عايز التالت!", "fontSize": 52, "overlapOk": True})
            mot += _enter("want", t3 + 0.2, "scale", 0.85, 1)
        else:
            chars.append(_salik(xs[0], "back", "stand", "heedless", scale=0.62, overlapOk=True))
        cam = {"from": {"zoom": 1.08, "x": 540, "y": 1300}, "to": {"zoom": 0.95 if n > 1 else 1.0, "x": 540, "y": 1300}, "ease": "inOut"}
    elif recipe == "years":
        els.append({"id": "count", "type": "counter", "x": 680, "y": 1200, "from": p.get("from", 20), "to": p.get("to", 80), "overlapOk": True})
        mot.append({"target": "count", "prop": "light", "from": 0, "to": 1, "start": t0 + 0.2, "dur": max(1.0, t1 - t0 - 0.8), "ease": "inOut", "phase": "move", "layer": "primary"})
        els.append({"id": "obj", "type": "coins", "x": 760, "y": GROUND, "scale": 1.0})
        mot.append({"target": "obj", "prop": "scale", "from": 1.0, "to": 0.92, "start": t0 + 0.2, "dur": t1 - t0 - 0.4, "ease": "inOut", "phase": "move", "layer": "secondary"})
        mid = (t0 + t1) / 2
        chars.append(_salik(330, "side", "stand", "heedless"))
        chars.append({"id": "old", "kind": "old_man", "x": 330, "y": GROUND, "view": "side", "pose": "sad", "overlapWith": ["salik"]})
        mot += [{"target": "salik", "prop": "opacity", "from": 1, "to": 0, "start": mid, "dur": 0.4, "ease": "in", "phase": "exit", "layer": "primary"},
                {"target": "salik", "prop": "y", "from": 0, "to": 6, "start": mid, "dur": 0.4, "ease": "in", "phase": "exit", "layer": "primary"},
                {"target": "old", "prop": "opacity", "from": 0, "to": 1, "start": mid, "dur": 0.6, "ease": "out", "phase": "enter", "layer": "primary"},
                {"target": "old", "prop": "y", "from": 20, "to": 0, "start": mid, "dur": 0.6, "ease": "out", "phase": "enter", "layer": "primary"}]
        if p.get("stamp"):
            els.append({"id": "stamp", "type": "stamp", "x": 560, "y": 1460, "label": p["stamp"], "overlapOk": True})
            mot += _enter("stamp", at(r"مستحيل", t1 - 0.8), "scale", 1.3, 1, 0.3)
    elif recipe == "tug":
        c = _salik(300, "side", "pull", "righteous", action="pull")
        chars.append(c)
        els.append({"id": "lbl", "type": "ropelabel", "x": 800, "y": GROUND - 40, "label": p.get("text", "حب الدنيا"), "overlapOk": True})
        els.append({"id": "rope", "type": "rope", "x": 550, "y": GROUND - 300, "from": {"character": "salik", "part": "hand"}, "to": "lbl"})
        mot.append({"target": "lbl", "prop": "x", "from": 840, "to": 780, "start": t0 + 0.4, "dur": t1 - t0 - 0.6, "ease": "inOut", "phase": "move", "layer": "primary"})
        mot.append({"target": "salik", "prop": "x", "from": 300, "to": 270, "start": t0 + 0.4, "dur": t1 - t0 - 0.6, "ease": "inOut", "phase": "move", "layer": "secondary"})
    elif recipe == "conveyor":
        els.append({"id": "belt", "type": "conveyor", "x": 540, "y": GROUND, "scale": 1.7, "overlapWith": ["salik"]})
        chars.append(_salik(540, "side", "walk", "heedless", y=GROUND - 60, overlapWith=["belt"]))
        for i, it in enumerate(["villa", "car", "coins"]):
            e = {"id": f"w{i}", "type": it, "x": 900, "y": 1180 + i * 40, "scale": 0.45, "overlapOk": True, "offscreenOk": True}
            els.append(e)
            mot.append({"target": e["id"], "prop": "x", "from": 1180, "to": -120, "start": t0 + i * (t1 - t0) / 3.2, "dur": (t1 - t0) * 0.7, "ease": "inOut", "phase": "move", "layer": "secondary", "pause": True})
    elif recipe == "stop":
        chars.append(_salik(300, "side", "stand", "heedless", shadow={"reach": 380, "toward": "obj"}))
        els.append({"id": "obj", "type": "car", "x": 860, "y": GROUND, "scale": 0.8})
        els.append({"id": "stop", "type": "stop", "x": 600, "y": GROUND, "label": "قِف"})
        ts = at(r"(اوقف|وقف|قف)", t0 + 0.5)
        mot += _enter("stop", ts, "y", 40, 0)
        mot.append({"target": "salik.shadow", "prop": "reach", "from": 380, "to": 0, "start": ts + 0.5, "dur": 1.2, "ease": "inOut", "phase": "move", "layer": "secondary"})
        mot.append({"target": "obj", "prop": "opacity", "from": 1, "to": 0.35, "start": ts + 0.6, "dur": 0.8, "ease": "in", "phase": "move", "layer": "secondary"})
    elif recipe == "remember":
        chars.append(_salik(330, "side", "sad", "righteous"))
        els.append({"id": "mem", "type": "thoughticon", "x": 640, "y": 1180, "icon": p.get("icon", "grave"), "overlapOk": True})
        mot += _enter("mem", at(r"(القبر|الموت|هادم)", kt), "scale", 0.8, 1)
        bg["mood"] = "cold"
    elif recipe == "paper":
        chars.append(_salik(300, "side", "stand", "righteous", target="paper"))
        els.append({"id": "paper", "type": "paper", "x": 720, "y": 1350, "label": p.get("text", "كلام النبي ﷺ"), "overlapOk": True})
        mot += _enter("paper", kt, "y", 30, 0)
    elif recipe == "heartx":
        els.append({"id": "heart", "type": "heartx", "x": 540, "y": 1350, "overlapOk": True})
        mot += _enter("heart", t0 + 0.2, "scale", 0.85, 1)
        mot.append({"target": "heart", "prop": "light", "from": 0.02, "to": 0.99, "start": at(r"(مش|ده مش)", t0 + (t1 - t0) * 0.55), "dur": 0.45, "ease": "out", "phase": "move", "layer": "primary"})
    elif recipe in ("sad", "happy"):
        chars.append(_salik(540, "side" if recipe == "sad" else "back", recipe, "righteous", light=1 if recipe == "happy" else 0))
        bg["mood"] = "cold" if recipe == "sad" else "warm"
    else:
        chars.append(_salik(540, "back", "stand"))

    if chars and "salik" in [c["id"] for c in chars] and not any(m["target"] == "salik" and m["phase"] == "enter" for m in mot) and recipe != "ages":
        mot += _enter("salik", t0)
    if flip and recipe in ("want", "hypo", "thought", "sign", "no", "grave", "chart", "lantern", "walk", "count"):
        for c in chars:
            c["x"] = 1080 - c["x"]; c["flip"] = not c.get("flip")
        for e in els:
            if e["type"] not in ("path",):
                e["x"] = 1080 - e["x"]
        for m in mot:
            if m["prop"] == "x" and m["phase"] == "move":
                m["from"], m["to"] = 1080 - m["from"], 1080 - m["to"]
        for c in chars:
            if c.get("target") and c.get("view") in ("back", "side") and c.get("pose") == "point":
                c["aim"] = round(G.aim_to(c, next(e for e in els if e["id"] == c["target"])))
                for m in mot:
                    if m["target"] == c["id"] and m["prop"] == "aim":
                        m["to"] = c["aim"]
    if not cam and t1 - t0 > 1.4:
        cx = chars[0]["x"] if chars else 540
        if flip:
            cam = {"from": {"zoom": 1.1, "x": (cx + 540) / 2, "y": 1330}, "to": {"zoom": 1.0, "x": 540, "y": 1300}, "ease": "inOut"}
        else:
            cam = {"from": {"zoom": 1.0, "x": 540, "y": 1300}, "to": {"zoom": 1.1, "x": (cx + 540) / 2, "y": 1330}, "ease": "inOut"}
    mot.append({"target": "bg", "prop": "light", "from": 0.97, "to": 1.03, "start": t0, "dur": t1 - t0, "ease": "inOut", "phase": "move", "layer": "background"})
    out = {"characters": chars, "elements": els, "motion": mot, "background": bg}
    if cam:
        out["camera"] = cam
    if any(c.get("light") for c in chars):
        out["lightReason"] = CATALOG.get(recipe, recipe)
    return out
