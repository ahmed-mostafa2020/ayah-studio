"""Optional AI helpers. Every one is off by default, shows a token estimate first, and never confirms anything by itself.

Tasks (each is one small request):
  hadith  — check each hadith span: is it a hadith, the authentic wording, the source and grade
  words   — suggest corrections for the yellow (low-confidence) words, from the context
  meta    — title, description, pinned question, hashtags
  review  — look at the storyboard stills and point out anything an ordinary viewer could misread (vision; Claude only)
  plan    — choose a recipe per scene (lives in planner.py)
"""
import base64
import io
import json
import os
import re
import urllib.request

from .project import Project, load_config

CHARS_PER_TOKEN = 2.6
IMG_TOKENS = 420  # a 360×640 still ≈ (w*h)/750 + overhead


def claude_code_available() -> bool:
    import shutil
    return shutil.which("claude") is not None


def call(prompt: str, mode: str, cfg: dict, images: list[bytes] | None = None, max_tokens: int = 4000, image_paths: list | None = None) -> str:
    if mode == "claude-code":
        # Claude Code on this computer, logged in with the user's own Claude subscription — no API key.
        # ANTHROPIC_API_KEY is removed from the environment so it can't silently switch to API billing.
        import subprocess
        env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        args = ["claude", "-p", prompt, "--output-format", "json", "--max-turns", "3" if image_paths else "1"]
        if image_paths:
            args[2] = prompt + "\n\nالصور بالترتيب (اقراها بأداة Read):\n" + "\n".join(str(x) for x in image_paths)
            args += ["--allowedTools", "Read"]
        r = subprocess.run(args, capture_output=True, text=True, env=env, timeout=900)
        if r.returncode != 0:
            raise RuntimeError("Claude Code: " + (r.stderr or r.stdout)[-400:])
        return json.loads(r.stdout).get("result", "")
    if mode == "claude":
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("مفتاح Claude API مش متسجل (ANTHROPIC_API_KEY)")
        content = [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(b).decode()}} for b in images or []]
        content.append({"type": "text", "text": prompt})
        body = json.dumps({"model": cfg["planner"]["claudeModel"], "max_tokens": max_tokens, "messages": [{"role": "user", "content": content}]}).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", body, {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.loads(r.read())
        return "".join(c.get("text", "") for c in out["content"])
    if mode == "local":
        payload = {"model": cfg["planner"]["ollamaModel"], "stream": False, "format": "json", "prompt": prompt}
        if images:
            payload["images"] = [base64.b64encode(b).decode() for b in images]
        req = urllib.request.Request(os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434") + "/api/generate", json.dumps(payload).encode(), {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=900) as r:
            return json.loads(r.read())["response"]
    raise ValueError(mode)


def parse_json(txt: str):
    m = re.search(r"[\[{].*[\]}]", txt, re.S)
    return json.loads(m.group(0))


# ---------------- prompts ----------------
def _hadith_prompt(spans):
    items = "\n".join(f'{s["id"]}: سمعنا «{s["heard"]}»' + (f' — النص المقترح: {s.get("text")} ({s.get("source")})' if s.get("text") else "") for s in spans)
    return f"""أنت باحث في الحديث. لكل مقطع تحت، الشيخ بيستشهد بحديث (أحيانًا بالمعنى وبالعامية).
حدّد: هل ده حديث فعلًا؟ ولو حديث: النص الصحيح المعروف بالتشكيل، ومين رواه، ودرجته (صحيح/حسن/ضعيف/موضوع/مختلف فيه)، ورقمه في المصدر لو متأكد.
لو مش متأكد قول "unsure" وماتألّفش نص ولا مصدر. ماتخترعش أرقام أحاديث.
رجّع JSON بس: {{"items":[{{"id":"...","verdict":"hadith|not_hadith|unsure","text":"...","source":"...","grade":"...","number":"","notes":"ملاحظة قصيرة: هل الشيخ نقله بالمعنى؟ هل فيه لفظ مختلف؟"}}]}}
المقاطع:
{items}
"""


def _words_prompt(tr):
    ws = tr["words"]
    marked = " ".join(f"[{w['i']}:{w['w']}]" if "low" in w.get("flags", []) else w["w"] for w in ws)
    return f"""ده تفريغ آلي لكلام شيخ مصري. الكلمات اللي بين [رقم:كلمة] التفريغ مش متأكد منها.
اقترح التصحيح الأقرب من السياق ومن نطق الكلمة، بنفس لهجة الشيخ (مصري)، من غير ما تحوّلها لفصحى. لو الكلمة صح، رجّعها زي ما هي.
رجّع JSON بس: {{"items":[{{"i":رقم, "suggest":"الكلمة", "why":"سبب قصير"}}]}}
النص:
{marked}
"""


def _meta_prompt(tr, sb):
    text = " ".join(w["w"] for w in tr["words"] if not w.get("drop"))
    return f"""ده كلام فيديو ريل قصير لقناة «آية لمست قلبي» (محتوى ديني بالعامية المصرية).
اكتب: عنوان قصير جذاب صادق (أقل من 60 حرف، من غير مبالغة ولا clickbait)، ووصف من 2–3 سطور، وتعليق مثبّت يكون **سؤال يتجاوب عليه** من موضوع الفيديو (مش طلب كتابة ذكر)، و5 هاشتاجات عربي.
ماتكتبش اسم الشيخ. الهوك الحالي: «{sb['template']['hook']['text'] if sb else ''}».
رجّع JSON بس: {{"title":"...","description":"...","pinned":"...","hashtags":["#..."]}}
الكلام:
{text}
"""


REVIEW_RULES = """قواعد القناة: ممنوع رسم الأنبياء أو أي رمز ليهم، وممنوع أي رمز لله (زي نور نازل من السما أو إيد من السما)، والغيب ما يتصورش، ومفيش عنف. الصحابة من ضهرهم. اللي بيصلي ميكونش قدامه أي حاجة. الشخصية بتبص على اللي بتعمله، وإيدها وضلها متوجهين على الحاجة اللي عايزاها، والضل على الأرض بس. مفيش نص طالع برة شكله، ومفيش عنصر راكب على عنصر من غير قصد."""


def _review_prompt(ids, meanings):
    lst = "\n".join(f"{i + 1}. {sid}: الكلام وقتها «{m}»" for i, (sid, m) in enumerate(zip(ids, meanings)))
    return f"""دي صور ستوري بورد لريل ديني، بالترتيب. لكل صورة: إيه اللي مشاهد عادي ممكن يفهمه غلط؟ هل الصورة بتشرح الكلام اللي بيتقال؟ هل فيه مخالفة للقواعد؟
{REVIEW_RULES}
رجّع JSON بس: {{"items":[{{"id":"...","ok":true,"issues":["..."],"suggest":"اقتراح قصير"}}]}}
الصور:
{lst}
"""


# ---------------- tasks ----------------
def _review_inputs(p: Project, ids=None):
    from PIL import Image
    idx = p.read("stills/index.json") if p.has("stills/index.json") else []
    sb = p.read("storyboard.json")
    mean = {s["id"]: s["meaning"] for s in sb["scenes"]}
    shots = [s for s in idx if s["id"] in mean and (not ids or s["id"] in ids)]
    imgs = []
    for s in shots:
        im = Image.open(p.dir / "stills" / f"{s['id']}.png").convert("RGB")
        im.thumbnail((360, 640))
        b = io.BytesIO(); im.save(b, "JPEG", quality=80); imgs.append(b.getvalue())
    return shots, [mean[s["id"]] for s in shots], imgs


def estimate(p: Project, task: str) -> dict:
    tr = p.read("transcript.json")
    sb = p.read("storyboard.json") if p.has("storyboard.json") else None
    if task == "hadith":
        spans = [s for s in p.read("sacred.json")["spans"] if s["type"] == "hadith"]
        n_in, n_out = len(_hadith_prompt(spans)) / CHARS_PER_TOKEN, 220 * len(spans) + 100
    elif task == "words":
        n_in = len(_words_prompt(tr)) / CHARS_PER_TOKEN
        n_out = 40 * sum("low" in w.get("flags", []) for w in tr["words"]) + 60
    elif task == "meta":
        n_in, n_out = len(_meta_prompt(tr, sb)) / CHARS_PER_TOKEN, 350
    elif task == "review":
        shots, mean, _ = _review_inputs(p)
        n_in = len(_review_prompt([s["id"] for s in shots], mean)) / CHARS_PER_TOKEN + IMG_TOKENS * len(shots)
        n_out = 90 * len(shots)
    elif task == "plan":
        from .planner import estimate as plan_est
        return {"task": task, **plan_est(p)}
    else:
        raise ValueError(task)
    return {"task": task, "input": round(n_in), "output": round(n_out), "total": round(n_in + n_out)}


def build(p: Project, task: str, ids: list | None = None) -> dict:
    """the exact prompt for a task (used by every mode, including copy/paste into any AI chat)."""
    tr = p.read("transcript.json")
    if task == "hadith":
        spans = [s for s in p.read("sacred.json")["spans"] if s["type"] == "hadith" and (not ids or s["id"] in ids)]
        return {"prompt": _hadith_prompt(spans)}
    if task == "words":
        return {"prompt": _words_prompt(tr)}
    if task == "meta":
        return {"prompt": _meta_prompt(tr, p.read("storyboard.json") if p.has("storyboard.json") else None)}
    if task == "review":
        shots, mean, imgs = _review_inputs(p, ids)
        return {"prompt": _review_prompt([s["id"] for s in shots], mean), "images": imgs,
                "paths": [str(p.dir / "stills" / f"{s['id']}.png") for s in shots]}
    if task == "plan":
        from .planner import build_prompt
        return {"prompt": build_prompt(tr)}
    raise ValueError(task)


def apply(p: Project, task: str, text: str, mode: str, ids: list | None = None) -> dict:
    """parse a model's answer (from any mode) and store it as suggestions — nothing is confirmed automatically."""
    res = parse_json(text)
    if task == "hadith":
        sac = p.read("sacred.json")
        by = {x["id"]: x for x in res.get("items", [])}
        for s in sac["spans"]:
            if s["id"] in by:
                s["ai_check"] = {**by[s["id"]], "by": mode}
                s["confirmed"] = False
        p.write("sacred.json", sac)
        return {"checked": len(by)}
    if task == "words":
        tr = p.read("transcript.json")
        n = 0
        for x in res.get("items", []):
            if 0 <= x.get("i", -1) < len(tr["words"]) and x.get("suggest") and x["suggest"] != tr["words"][x["i"]]["w"]:
                tr["words"][x["i"]]["ai_suggest"] = {"w": x["suggest"], "why": x.get("why", "")}
                n += 1
        p.write("transcript.json", tr)
        return {"suggestions": n}
    if task == "meta":
        p.write("publish.json", {**(p.read("publish.json") if p.has("publish.json") else {}), **res, "by": mode})
        return res
    if task == "review":
        p.write("ai_review.json", res)
        return {"reviewed": len(res.get("items", []))}
    if task == "plan":
        from .planner import plan_from_answer
        return plan_from_answer(p, res)
    raise ValueError(task)


def run(p: Project, task: str, mode: str, ids: list | None = None, answer: str | None = None) -> dict:
    """mode: claude (API key) · claude-code (your subscription via Claude Code) · local (Ollama) · manual (answer pasted from any AI chat)."""
    cfg = load_config(p)
    b = build(p, task, ids)
    if mode == "manual":
        if not answer:
            raise RuntimeError("الصق رد الـ AI الأول")
        return apply(p, task, answer, mode, ids)
    if task == "review" and mode == "local":
        raise RuntimeError("مراجعة الصور محتاجة موديل بيشوف صور: Claude أو Claude Code أو الصق في شات")
    text = call(b["prompt"], mode, cfg, images=b.get("images") if mode == "claude" else None,
                image_paths=b.get("paths") if mode == "claude-code" else None, max_tokens=8000 if task == "plan" else 4000)
    return apply(p, task, text, mode, ids)
