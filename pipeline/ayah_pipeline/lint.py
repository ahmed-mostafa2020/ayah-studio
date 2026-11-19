"""Storyboard linter: shar'i rules, realism rules, template, motion and sync.

Runs before stills (stage=stills) and again before render (stage=render, stricter: sacred text
must be confirmed and every scene approved).
"""
from . import geometry as G
from .arabic import LATIN, norm
from .project import Project, load_config

PROPHETS = ["محمد", "النبي", "الرسول", "موسي", "عيسي", "ابراهيم", "نوح", "يوسف", "يونس", "سليمان", "داود",
            "ادم", "يعقوب", "اسماعيل", "اسحاق", "ايوب", "زكريا", "يحيي", "هود", "صالح", "شعيب", "لوط", "ادريس", "الياس", "اليسع"]
ALLAH_SYMBOLS = {"sky_light", "light_beam", "beam_down", "hand_from_sky", "light_figure", "eye_in_sky"}
UNSEEN = {"jannah", "paradise", "nar", "hell", "fire_hell", "mahshar", "sirat", "angel", "jinn", "devil"}
VIOLENCE = {"blood", "sword_hit", "execution", "gun", "corpse", "wound"}
NON_ISLAMIC = {"cross", "crucifix", "statue", "idol", "cigarette", "bottle_alcohol", "music_note", "instrument"}
POSITION_PROPS = {"x", "y", "scale", "rotate", "camera"}
SCREEN_W, SCREEN_H = 1080, 1920


class Report:
    def __init__(self):
        self.items = []

    def add(self, sev, rule, where, msg, fix=""):
        self.items.append({"severity": sev, "rule": rule, "where": where, "msg": msg, "fix": fix})

    def err(self, *a):
        self.add("error", *a)

    def warn(self, *a):
        self.add("warn", *a)


def lint(sb: dict, sacred: list, cfg: dict, stage: str = "stills", approvals: dict | None = None) -> dict:
    r = Report()
    women_ok = sb.get("settings", {}).get("womenAllowed", cfg["shariah"]["womenAllowed"])
    speaker = norm(sb.get("meta", {}).get("speaker", "") or "")
    dur = sb["meta"]["duration"]
    scenes = sb.get("scenes", [])

    # ---------- timing ----------
    t = 0.0
    for sc in scenes:
        w = f"مشهد {sc['id']}"
        if abs(sc["start"] - t) > 0.05:
            r.err("TIME_GAP", w, f"المشهد بيبدأ {sc['start']:.2f} والمفروض {t:.2f}: فيه فراغ أو تداخل", "خلي المشاهد ورا بعض من غير فجوات")
        if sc["end"] - sc["start"] < 1:
            r.warn("TIME_SHORT", w, "المشهد أقل من ثانية، مش هيتشاف")
        t = sc["end"]
    if scenes and abs(t - dur) > 0.1:
        r.err("TIME_END", "الستوري بورد", f"آخر مشهد بيخلص {t:.2f} والصوت {dur:.2f}")

    # ---------- per scene ----------
    light_scenes = 0
    for sc in scenes:
        w = f"مشهد {sc['id']}"
        chars = sc.get("characters", [])
        els = {e["id"]: e for e in sc.get("elements", [])}
        length = sc["end"] - sc["start"]

        for e in els.values():
            ty = e.get("type", "")
            if ty in ALLAH_SYMBOLS:
                r.err("SHARIA_ALLAH_SYMBOL", w, f"العنصر «{ty}» ممكن يتفهم إنه رمز لله", "عبّر بحالة الشخص: دعاء، سجود، فجر في الشباك")
            if ty in UNSEEN:
                r.err("SHARIA_UNSEEN", w, f"«{ty}» تصوير للغيب", "استخدم لافتة مكتوبة أو طريق بيكمل في ضباب")
            if ty in VIOLENCE:
                r.err("SHARIA_VIOLENCE", w, f"«{ty}» عنف دموي", "استخدم رمز: باب حديد مقفول، ظل قضبان")
            if ty in NON_ISLAMIC:
                r.err("PLAYBOOK", w, f"«{ty}» ممنوع حسب PLAYBOOK النشر")

        for c in chars:
            cw = f"{w} / {c.get('id', c.get('kind'))}"
            kind = c.get("kind", "")
            name = norm(c.get("name", ""))
            if kind == "prophet" or any(pn == name or pn in name.split() for pn in PROPHETS):
                r.err("SHARIA_PROPHET", cw, "ممنوع رسم نبي أو أي رمز ليه", "اعرض حالة الشخص العادي بس، والكلام يتكتب في «»")
            if kind == "sahabi" and c.get("view") != "back" and not c.get("faceLight"):
                r.err("SHARIA_SAHABI", cw, "الصحابي لازم يبقى من ضهره أو وشه في نور", "view: back أو faceLight: true")
            if kind == "angel":
                r.err("SHARIA_UNSEEN", cw, "ممنوع رسم الملائكة")
            if (kind == "woman" or c.get("look", {}).get("head") == "hijab") and not women_ok:
                r.err("SHARIA_WOMEN", cw, "رسم الستات مقفول في الإعدادات (PLAYBOOK)", "افتح الإعداد للفيديو ده لو عايز")
            if c.get("features"):
                r.err("SHARIA_FACE", cw, "الشخصيات من غير ملامح وش")

            pose, view = c.get("pose", "stand"), c.get("view", "front")
            # prayer direction: nothing in front except the Kaaba
            if pose in ("sujood", "pray", "ruku"):
                f = G.facing(c)
                for e in els.values():
                    if e.get("type") in ("kaaba", "mat"):
                        continue
                    ex = (G.bbox(e)[0] + G.bbox(e)[2]) / 2
                    if 0 < (ex - c["x"]) * f < 700:
                        r.err("SHARIA_PRAYER_DIR", cw, f"اللي بيصلي وشه ناحية «{e.get('type')}»", "حرّك العنصر ورا أو جنب المصلي، أو خلي قدامه الكعبة أو مكان مفتوح")

            # realism: facing what he does
            action = c.get("action", "")
            if pose in ("walk", "pull") and view != "side":
                r.warn("REAL_VIEW", cw, f"وضعية «{pose}» المفروض تبقى من الجنب", "view: side")
            if action in ("climb", "look_ahead") and view != "back":
                r.warn("REAL_VIEW", cw, "طالع سلّم أو بيبص قدامه: المفروض من ضهره", "view: back")
            if view == "front" and action != "present" and sc.get("role") != "intro":
                r.warn("REAL_VIEW", cw, "من قدام بس في التقديم", "غيّر view لـ back أو side حسب الفعل")

            # wanting something: body, arm and shadow aim at it
            tgt = c.get("target")
            if tgt:
                if tgt not in els:
                    r.err("REAL_AIM", cw, f"الهدف «{tgt}» مش موجود في المشهد")
                else:
                    el = els[tgt]
                    tx = (G.bbox(el)[0] + G.bbox(el)[2]) / 2
                    if (tx - c["x"]) * G.facing(c) < 0:
                        r.err("REAL_AIM", cw, "الشخصية مديّة ضهرها للحاجة اللي عايزها", "اقلب flip")
                    if view == "back" and abs((G.bbox(el)[0] + G.bbox(el)[2]) / 2 - c["x"]) > 160:
                        r.err("REAL_FACE", cw, "الحاجة على جنبه وهو مديّنا ضهره: لازم يبص عليها", "view: side ووشه ناحيتها (flip حسب المكان)")
                    if view in ("back", "side") and c.get("pose") == "point":
                        want = G.aim_to(c, el)
                        if c.get("aim") is None:
                            r.err("REAL_AIM", cw, f"مفيش aim محسوب. الزاوية الصح {want:.0f}°", f"aim: {round(want)}")
                        elif abs(c["aim"] - want) > 6:
                            r.err("REAL_AIM", cw, f"الإيد بتشاور {c['aim']}° والهدف على {want:.0f}°", f"aim: {round(want)}")
                    sh = c.get("shadow")
                    if sh and sh.get("toward") not in (None, tgt):
                        r.err("REAL_AIM", cw, "الضل متوجه لحاجة غير اللي الشخصية عايزاها", f"shadow.toward: {tgt}")

            # shadow stays on the ground
            sh = c.get("shadow")
            if sh:
                if sh.get("y", c["y"]) != c["y"]:
                    r.err("REAL_SHADOW", cw, "الضل لازم يبقى على الأرض", "shadow.y = خط الأرض بتاع الشخصية")
                end_x = c["x"] + G.facing(c) * sh.get("reach", 0)
                for e in els.values():
                    if e.get("type") in G.BLOCKING:
                        x0, _, x1, _ = G.bbox(e)
                        if x0 + 10 < end_x < x1 - 10:
                            r.err("REAL_SHADOW", cw, f"الضل طالع فوق «{e['type']}»", "قصّر reach لحد قاعدة العنصر")

        # ropes start in the hand
        for e in els.values():
            if e.get("type") == "rope":
                fr = e.get("from", {})
                c = next((c for c in chars if c.get("id") == fr.get("character")), None)
                if not c or fr.get("part") != "hand":
                    r.err("REAL_HOLD", f"{w} / {e['id']}", "الحبل لازم يطلع من إيد الشخصية", "from: {character, part: 'hand'}")
                elif c.get("pose") != "pull" or c.get("view") != "side":
                    r.err("REAL_HOLD", f"{w} / {e['id']}", "اللي ماسك الحبل لازم يبقى pose: pull و view: side")

        # overlaps / text outside shapes
        boxes = [(e["id"], G.bbox(e), e) for e in els.values() if e.get("type") != "rope"]
        boxes += [(c.get("id", "?"), G.person_bbox(c), c) for c in chars]
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[2].get("overlapOk") or b[2].get("overlapOk") or b[0] in a[2].get("overlapWith", []) or a[0] in b[2].get("overlapWith", []):
                    continue
                if G.overlap(a[1], b[1], pad=6):
                    r.warn("LAYOUT_OVERLAP", w, f"«{a[0]}» راكب على «{b[0]}»", "بعّدهم أو حط overlapOk لو مقصود")
            bx = boxes[i][1]
            if (bx[0] < -40 or bx[2] > SCREEN_W + 40) and not boxes[i][2].get("offscreenOk"):
                r.warn("LAYOUT_EDGE", w, f"«{boxes[i][0]}» خارج الشاشة")
        for e in els.values():
            lab = e.get("label")
            if lab:
                x0, _, x1, _ = G.bbox(e)
                need = len(lab) * e.get("fontSize", 40) * 0.55
                if need > (x1 - x0) - 20:
                    r.err("LAYOUT_TEXT", f"{w} / {e['id']}", f"الكلمة «{lab}» أعرض من الشكل", "صغّر الخط أو كبّر الشكل")

        # heart light only on meaningful moments
        if any(c.get("light", 0) > 0 for c in chars):
            light_scenes += 1
            if not sc.get("lightReason"):
                r.warn("REAL_HEART", w, "«نور القلب» ظاهر من غير سبب مكتوب", "lightReason: اللحظة دي ليه ليها معنى")

        # relevance: every scene is tied to what is said
        if not sc.get("meaning"):
            r.warn("MEANING", w, "المشهد مالوش معنى مكتوب مربوط بالكلام", "meaning: الجملة اللي بيشرحها")

        # motion rules
        mot = sc.get("motion", [])
        enters = {}
        for m in mot:
            mw = f"{w} / حركة {m.get('target')}"
            if m.get("ease") == "linear" and m.get("prop") in POSITION_PROPS:
                r.err("MOTION_LINEAR", mw, "حركة خطية ممنوعة", "ease: out (دخول) أو in (خروج)")
            if m.get("phase") == "enter":
                enters.setdefault(m["target"], []).append(m)
            dist = abs((m.get("to") or 0) - (m.get("from") or 0)) if m.get("prop") in ("x", "y") else 0
            limit = SCREEN_W / 3 if m.get("prop") == "x" else SCREEN_H / 3
            if dist > limit and not m.get("pause"):
                r.warn("MOTION_DISTANCE", mw, "الحركة أكتر من تلت الشاشة من غير وقفة")
        for tgt, ms in enters.items():
            if all(m.get("prop") == "opacity" for m in ms):
                r.err("MOTION_FADE_ONLY", f"{w} / {tgt}", "الظهور بالشفافية بس ممنوع", "زوّد طلوع 20–30 بكسل أو تكبير خفيف")
            exits = [m for m in mot if m.get("target") == tgt and m.get("phase") == "exit"]
            if exits and max(m["dur"] for m in exits) >= max(m["dur"] for m in ms):
                r.err("MOTION_EXIT", f"{w} / {tgt}", "الخروج لازم يبقى أسرع من الدخول (حوالي 2:3)")
        layers = {m.get("layer") for m in mot}
        if "background" not in layers:
            r.warn("MOTION_LAYERS", w, "مفيش طبقة خلفية هادية (نَفَس إضاءة أو drift)", "layer: background")
        if length > 6 and not sc.get("camera") and not any(m.get("layer") == "secondary" for m in mot):
            r.warn("PACE", w, f"المشهد {length:.1f} ثانية من غير حركة كاميرا أو حركة ثانوية", "زوّد zoom بطيء أو عنصر ثانوي")
        if length > 12:
            r.warn("PACE", w, "مشهد أطول من 12 ثانية، قسّمه")

    if scenes and light_scenes / len(scenes) > 0.4:
        r.warn("REAL_HEART", "الفيديو", f"«نور القلب» في {light_scenes} من {len(scenes)} مشهد، المفروض في اللحظات المهمة بس")

    # ---------- sacred text ----------
    for s in sacred:
        sw = f"{s['type']} {s['id']}"
        if s["type"] == "hadith" and s.get("status") != "speaker" and (not s.get("text") or not s.get("source")):
            (r.err if stage == "render" else r.warn)("SACRED_TEXT", sw, f"مقطع حديث محتاج النص الصحيح والمصدر: «{s['heard']}»", "اكتب النص والمصدر، أو علّمه «كلام الشيخ»")
        if not s.get("confirmed"):
            (r.err if stage == "render" else r.warn)("SACRED_CONFIRM", sw, f"لسه ماتأكدتش من النص: {s.get('text') or s['heard']}", "أكّد من شاشة المراجعة")
        covering = [sc for sc in scenes if sc["start"] < s["end"] and sc["end"] > s["start"]]
        if s["type"] in ("quran", "hadith") and s.get("status") != "speaker" and not any(
                e.get("type") in ("ayah_card", "hadith_card") and e.get("span") == s["id"] for sc in covering for e in sc.get("elements", [])):
            r.err("SACRED_CARD", sw, "الآية/الحديث مالهاش كارت في المشاهد اللي بتتقال فيها")
    for fx in sb.get("sfx", []):
        for s in sacred:
            a, b = s["noSfx"]
            if a <= fx["t"] <= b:
                r.err("SFX_SACRED", f"مؤثر {fx.get('kind')} @{fx['t']:.2f}", f"مؤثر صوتي جوه منطقة {s['type']} {s['id']}", "هيتشال أوتوماتيك وقت المكساج")
        if fx.get("kind") in ("music", "nasheed"):
            r.err("SFX_MUSIC", f"مؤثر @{fx['t']:.2f}", "ممنوع الموسيقى")

    # ---------- captions ----------
    for cap in sb.get("captions", []):
        for wd in cap.get("words", []):
            if LATIN.search(wd["w"]):
                r.err("CAPTION_LANG", f"كابشن @{wd['t']:.2f}", f"«{wd['w']}» مش عربي")
            if wd.get("color") == "gold" and not wd.get("sacred"):
                r.err("CAPTION_GOLD", f"كابشن @{wd['t']:.2f}", f"الدهبي للآيات والأحاديث بس: «{wd['w']}»", "خليها مرجاني لو مهمة")

    # ---------- template ----------
    tp = sb.get("template", {})
    hook = tp.get("hook", {})
    if not hook.get("text") or hook.get("start", 0) > 0:
        r.err("TPL_HOOK", "الافتتاحية", "أول فريم لازم يبقى فيه لون مريح وهوك من أول لحظة")
    if hook.get("bg", "").lower() in ("", "#fff", "#ffffff", "#000", "#000000", "white", "black"):
        r.err("TPL_HOOK", "الافتتاحية", "خلفية أول فريم فاضية أو سادة تقيلة", "استخدم لون مريح من الهوية")
    m = tp.get("mascot", {})
    if "like" not in m:
        r.err("TPL_MASCOT", "الماسكوت", "«متنساش تعمل لايك» مش موجودة")
    else:
        if not (dur * 0.3 <= m["like"] <= dur * 0.7):
            r.warn("TPL_MASCOT", "الماسكوت", "اللايك المفروض تبقى في نص الفيديو")
        if any(s["noSfx"][0] <= m["like"] <= s["noSfx"][1] for s in sacred):
            r.err("TPL_MASCOT", "الماسكوت", "اللايك جوه آية أو حديث أو ذكر", "انقلها للحظة هادية")
    if not ("comment" in m and "share" in m and m["comment"] < m["share"]):
        r.err("TPL_MASCOT", "الماسكوت", "في الآخر: «سيب تعليق» وبعدها «وانشرها في الخير»")
    if not tp.get("outro", {}).get("shareLine"):
        r.err("TPL_OUTRO", "الختام", "مفيش جملة مشاركة واضحة على الشاشة")
    texts = [hook.get("text", ""), tp.get("outro", {}).get("shareLine", "")] + \
            [e.get("label", "") for sc in scenes for e in sc.get("elements", [])]
    if speaker and any(speaker in norm(x) for x in texts if x):
        r.err("TPL_CREDIT", "النصوص", "اسم المتكلم مكتوب جوه الفيديو", "الاسم في الوصف والتعليق المثبت بس")

    # ---------- approvals before render ----------
    if stage == "render":
        appr = (approvals or {}).get("scenes", {})
        pending = [sc["id"] for sc in scenes if appr.get(sc["id"]) != "approved"]
        if pending:
            r.err("APPROVAL", "الصور", f"مشاهد لسه ماتوافقش عليها: {', '.join(map(str, pending))}", "مفيش رندر من غير موافقتك")

    errors = [i for i in r.items if i["severity"] == "error"]
    warns = [i for i in r.items if i["severity"] == "warn"]
    lines = [f"الفاحص ({'قبل الرندر' if stage == 'render' else 'قبل الصور'}): {len(errors)} خطأ، {len(warns)} تنبيه"]
    for i in errors + warns:
        mark = "✗" if i["severity"] == "error" else "!"
        lines.append(f"  {mark} [{i['rule']}] {i['where']}: {i['msg']}" + (f"  ← {i['fix']}" if i["fix"] else ""))
    return {"errors": errors, "warnings": warns, "text": "\n".join(lines)}


def lint_project(p: Project, stage: str = "stills") -> dict:
    sb = p.read("storyboard.json")
    sacred = p.read("sacred.json")["spans"] if p.has("sacred.json") else []
    appr = p.read("approvals.json") if p.has("approvals.json") else {}
    rep = lint(sb, sacred, load_config(p), stage, appr)
    p.write("lint.json", rep)
    return rep
