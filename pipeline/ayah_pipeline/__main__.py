"""python -m ayah_pipeline <command> <slug> [...]  — every dashboard action has a command here."""
import argparse
import json
import sys

from .project import Project


def _out(x):
    print(json.dumps(x, ensure_ascii=False, indent=2))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="ayah")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("new"); s.add_argument("slug"); s.add_argument("src")
    s = sub.add_parser("rescene"); s.add_argument("slug"); s.add_argument("scene"); s.add_argument("--recipe"); s.add_argument("--params")
    s = sub.add_parser("ai"); s.add_argument("task", choices=["hadith", "words", "meta", "review", "plan"]); s.add_argument("slug")
    s.add_argument("--mode", choices=["claude", "local"], default="claude"); s.add_argument("--estimate", action="store_true"); s.add_argument("--ids")
    s = sub.add_parser("mix"); s.add_argument("slug"); s.add_argument("--to", type=float)
    s = sub.add_parser("srt"); s.add_argument("slug")
    s = sub.add_parser("recipes"); s.add_argument("slug", nargs="?", default="_")
    for c in ["transcribe", "analyze", "sacred", "prepare", "plan", "lint", "status", "estimate"]:
        s = sub.add_parser(c); s.add_argument("slug")
        if c == "lint":
            s.add_argument("--stage", choices=["stills", "render"], default="stills")
        if c == "plan":
            s.add_argument("--mode", choices=["rules", "local", "claude"], default=None)
    a = ap.parse_args(argv)
    if a.cmd == "recipes":
        from .recipes import CATALOG
        return _out(CATALOG)
    p = Project(a.slug)

    if a.cmd == "new":
        from .audio import ingest
        _out(ingest(p, a.src))
    elif a.cmd == "transcribe":
        from .transcribe import transcribe
        tr = transcribe(p, progress=lambda f: print(f"progress {f:.0%}", file=sys.stderr))
        low = [w["w"] for w in tr["words"] if "low" in w["flags"]]
        _out({"words": len(tr["words"]), "lowConfidence": low, "dropped": [(w["w"], w["drop"]) for w in tr["words"] if w.get("drop")]})
    elif a.cmd == "analyze":
        from .audio import analyze, apply_cuts
        an = analyze(p)
        res = apply_cuts(p)
        _out({k: an[k] for k in ("hasBed", "gapMedianRelDb", "threshold", "decision")} | res)
    elif a.cmd == "sacred":
        from .sacred import detect
        _out(detect(p))
    elif a.cmd == "prepare":  # transcribe → analyze → sacred in one go
        main(["transcribe", a.slug]); main(["analyze", a.slug]); main(["sacred", a.slug])
    elif a.cmd == "plan":
        from .planner import plan
        _out(plan(p, a.mode))
    elif a.cmd == "ai":
        from . import ai
        if a.estimate:
            return _out(ai.estimate(p, a.task))
        if a.task == "plan":
            from .planner import plan
            return _out(plan(p, a.mode))
        _out(ai.run(p, a.task, a.mode, a.ids.split(",") if a.ids else None))
    elif a.cmd == "mix":
        from .mix import mix
        _out(mix(p, a.to))
    elif a.cmd == "srt":
        from .mix import srt
        _out({"srt": srt(p)})
    elif a.cmd == "estimate":
        from .planner import estimate
        _out(estimate(p))
    elif a.cmd == "rescene":
        from .planner import rescene
        _out(rescene(p, a.scene, a.recipe, json.loads(a.params) if a.params else None))
    elif a.cmd == "lint":
        from .lint import lint_project
        rep = lint_project(p, a.stage)
        print(rep["text"])
        sys.exit(1 if rep["errors"] else 0)
    elif a.cmd == "status":
        _out({f: p.has(f) for f in ["meta.json", "transcript.json", "audio_analysis.json", "sacred.json",
                                   "storyboard.json", "lint.json", "approvals.json"]})


if __name__ == "__main__":
    main()
