"""Every shar'i / realism / template rule must fire on a deliberately broken storyboard."""
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ayah_pipeline import geometry as G  # noqa: E402
from ayah_pipeline.audio import remap  # noqa: E402
from ayah_pipeline.lint import lint  # noqa: E402

CFG = json.loads((Path(__file__).resolve().parents[2] / "config" / "defaults.json").read_text(encoding="utf-8"))


def base():
    return {
        "meta": {"duration": 10, "speaker": "الشيخ فلان"},
        "settings": {"womenAllowed": False},
        "template": {"hook": {"text": "هوك", "start": 0, "bg": "#AFCDE6"},
                     "mascot": {"like": 5, "comment": 8, "share": 9},
                     "outro": {"shareLine": "ابعتها لحد محتاج يسمعها 🤍"}},
        "scenes": [{"id": "s1", "start": 0, "end": 10, "meaning": "x", "characters": [], "elements": [],
                    "camera": {}, "motion": [{"target": "bg", "prop": "light", "layer": "background"}]}],
        "captions": [], "sfx": [],
    }


def rules_of(sb, sacred=(), stage="stills", appr=None):
    return {i["rule"] for i in lint(sb, list(sacred), CFG, stage, appr)["errors"]}


def test_clean_is_clean():
    assert rules_of(base()) == set()


def test_shariah():
    sb = base()
    sc = sb["scenes"][0]
    sc["characters"] = [
        {"id": "a", "kind": "salik", "name": "موسى", "x": 200, "y": 1700, "view": "side", "pose": "stand"},
        {"id": "b", "kind": "sahabi", "x": 500, "y": 1700, "view": "side", "pose": "stand"},
        {"id": "c", "kind": "woman", "x": 800, "y": 1700, "view": "side", "pose": "stand"},
    ]
    sc["elements"] = [{"id": "e1", "type": "light_beam", "x": 540, "y": 900}, {"id": "e2", "type": "jannah", "x": 100, "y": 900},
                      {"id": "e3", "type": "blood", "x": 900, "y": 900}, {"id": "e4", "type": "cross", "x": 900, "y": 600}]
    r = rules_of(sb)
    assert {"SHARIA_PROPHET", "SHARIA_SAHABI", "SHARIA_WOMEN", "SHARIA_ALLAH_SYMBOL", "SHARIA_UNSEEN", "SHARIA_VIOLENCE", "PLAYBOOK"} <= r
    sb2 = copy.deepcopy(sb)
    sb2["settings"]["womenAllowed"] = True
    assert "SHARIA_WOMEN" not in rules_of(sb2)


def test_prayer_direction():
    sb = base()
    sc = sb["scenes"][0]
    sc["characters"] = [{"id": "p", "kind": "salik", "x": 300, "y": 1700, "view": "side", "pose": "sujood"}]
    sc["elements"] = [{"id": "l", "type": "lantern", "x": 600, "y": 1700}]
    assert "SHARIA_PRAYER_DIR" in rules_of(sb)
    sc["elements"][0]["x"] = 60  # behind him
    assert "SHARIA_PRAYER_DIR" not in rules_of(sb)


def test_aim_shadow_rope():
    sb = base()
    sc = sb["scenes"][0]
    coins = {"id": "c", "type": "coins", "x": 820, "y": 1700}
    mountain = {"id": "m", "type": "mountain", "x": 760, "y": 1700, "overlapOk": True}
    man = {"id": "s", "kind": "salik", "x": 300, "y": 1700, "view": "back", "pose": "point", "target": "c", "aim": 60,
           "shadow": {"reach": 470, "toward": "c"}}
    sc["characters"], sc["elements"] = [man], [coins, mountain]
    r = rules_of(sb)
    assert "REAL_AIM" in r and "REAL_SHADOW" in r
    man["aim"] = round(G.aim_to(man, coins))
    man["shadow"]["reach"] = 150
    assert not {"REAL_AIM", "REAL_SHADOW"} & rules_of(sb)
    sc["elements"].append({"id": "r", "type": "rope", "x": 600, "y": 1500, "from": {"character": "s", "part": "body"}})
    assert "REAL_HOLD" in rules_of(sb)


def test_motion_and_template():
    sb = base()
    sc = sb["scenes"][0]
    sc["motion"] += [
        {"target": "t", "prop": "x", "from": 0, "to": 100, "start": 0, "dur": 1, "ease": "linear", "phase": "move", "layer": "primary"},
        {"target": "t2", "prop": "opacity", "from": 0, "to": 1, "start": 0, "dur": 0.45, "ease": "out", "phase": "enter", "layer": "primary"},
        {"target": "t3", "prop": "y", "from": 26, "to": 0, "start": 0, "dur": 0.3, "ease": "out", "phase": "enter", "layer": "primary"},
        {"target": "t3", "prop": "y", "from": 0, "to": 14, "start": 2, "dur": 0.45, "ease": "in", "phase": "exit", "layer": "primary"},
    ]
    sb["template"]["hook"]["bg"] = "#000"
    sb["template"]["mascot"] = {"like": 5}
    sb["template"]["outro"]["shareLine"] = "الشيخ فلان"
    sb["captions"] = [{"words": [{"w": "hello", "t": 1}, {"w": "الدنيا", "t": 2, "color": "gold"}]}]
    r = rules_of(sb)
    assert {"MOTION_LINEAR", "MOTION_FADE_ONLY", "MOTION_EXIT", "TPL_HOOK", "TPL_MASCOT", "TPL_CREDIT", "CAPTION_LANG", "CAPTION_GOLD"} <= r


def test_sacred_and_approval():
    sb = base()
    sacred = [{"id": "q1", "type": "quran", "start": 2, "end": 4, "noSfx": [1.5, 4.5], "heard": "x", "confirmed": False}]
    sb["sfx"] = [{"t": 3, "kind": "pop"}]
    r = rules_of(sb, sacred, stage="render")
    assert {"SFX_SACRED", "SACRED_CARD", "SACRED_CONFIRM", "APPROVAL"} <= r
    assert "SACRED_CONFIRM" not in rules_of(sb, sacred, stage="stills")


def test_remap():
    cuts = [[2.0, 1.0], [5.0, 0.5]]
    assert remap(1.0, cuts) == 1.0 and remap(3.5, cuts) == 2.5 and remap(6.0, cuts) == 4.5 and remap(2.5, cuts) == 2.0


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("✓", name)
