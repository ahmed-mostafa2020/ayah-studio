"""Geometry that mirrors engine/src/brand/Brand.tsx, so the linter checks what will actually be drawn."""
import math

TOP = -300
# width, height at scale 1 (anchor = bottom centre on the ground line)
SIZES = {
    "person": (130, 400), "house": (260, 200), "sack": (140, 140), "coins": (170, 90), "lantern": (90, 140),
    "quran": (150, 70), "palm": (240, 340), "grave": (340, 150), "mat": (230, 55), "flat": (180, 190),
    "car": (270, 90), "villa": (360, 260), "plane": (320, 110), "yacht": (340, 160), "mountain": (520, 420),
    "valley": (600, 160), "ladder": (110, 520), "conveyor": (520, 70), "kaaba": (260, 280), "rope": (0, 0),
    "ayah_card": (900, 520), "sign": (230, 300), "badge": (96, 96), "cross": (220, 220), "path": (1000, 10),
    "goldvalley": (300, 170), "thought": (440, 240), "stop": (130, 440), "paper": (300, 260), "infinity": (200, 100),
    "stamp": (360, 150), "counter": (280, 170), "ropelabel": (220, 220), "thoughticon": (340, 280), "heartx": (240, 240), "hadith_card": (900, 520), "chart": (600, 420), "icon": (120, 120),
}
BLOCKING = {"mountain", "house", "flat", "villa", "building"}


def bbox(el: dict):
    w, h = SIZES.get(el.get("type"), (150, 150))
    if el.get("type") == "thought" and el.get("label") and "w" not in el:
        w = max(240, len(el["label"]) * el.get("fontSize", 56) * 0.55 + 110)
    if el.get("type") == "sign" and el.get("label") and "w" not in el:
        w = max(190, len(el["label"]) * el.get("fontSize", 50) * 0.6 + 60)
    if "w" in el:
        w = el["w"]
    if "h" in el:
        h = el["h"]
    s = el.get("scale", 1)
    x, y = el["x"], el["y"]
    return (x - w * s / 2, y - h * s, x + w * s / 2, y)


def person_bbox(c: dict):
    s = c.get("scale", 1)
    h = 330 if c.get("pose") == "sit" else 400
    return (c["x"] - 65 * s, c["y"] - h * s, c["x"] + 65 * s, c["y"])


def overlap(a, b, pad=0):
    return not (a[2] <= b[0] + pad or b[2] <= a[0] + pad or a[3] <= b[1] + pad or b[3] <= a[1] + pad)


def shoulder(c: dict):
    """the pointing shoulder: right shoulder in back view, the near shoulder in side view (Brand.tsx pivots)."""
    s = c.get("scale", 1)
    sign = -1 if c.get("flip") else 1
    if c.get("view") == "side":
        return c["x"] + sign * 6 * s, c["y"] + (TOP + 12) * s
    return c["x"] + sign * 44 * s, c["y"] + (TOP + 8) * s


def target_point(el: dict):
    x0, y0, x1, y1 = bbox(el)
    return (x0 + x1) / 2, (y0 + y1) / 2


def aim_to(c: dict, el: dict) -> float:
    """degrees above the horizontal, measured toward the side the person faces (Brand.tsx `aim`)."""
    sx, sy = shoulder(c)
    tx, ty = target_point(el)
    dx = (tx - sx) * (-1 if c.get("flip") else 1)
    return math.degrees(math.atan2(-(ty - sy), dx))


def _rot(px, py, cx, cy, deg):
    a = math.radians(deg)
    dx, dy = px - cx, py - cy
    return cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a)


SIDE_PULL = {"lean": -12, "near": -78}


def side_hand(c: dict):
    """screen position of the near hand of a side-view 'pull' person (ropes must start here)."""
    s = c.get("scale", 1)
    hx, hy = _rot(4, TOP + 150, 6, TOP + 12, SIDE_PULL["near"])
    hx, hy = _rot(hx, hy, 0, -10, SIDE_PULL["lean"])
    return c["x"] + (-hx if c.get("flip") else hx) * s, c["y"] + hy * s


def facing(c: dict) -> int:
    """+1 = faces right, -1 = faces left (side views face right unless flipped)."""
    return -1 if c.get("flip") else 1
