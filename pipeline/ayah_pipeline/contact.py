"""Tile storyboard stills into contact sheets (reading order right→left, top→bottom), numbered."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def sheet(folder: str, cols: int = 4, per: int = 12):
    d = Path(folder)
    shots = json.loads((d / "index.json").read_text(encoding="utf-8"))
    ims = [(s, Image.open(d / f"{s['id']}.png").convert("RGB")) for s in shots if (d / f"{s['id']}.png").exists()]
    if not ims:
        return []
    w, h = ims[0][1].size
    tw, th = 360, int(360 * h / w)
    pad, lab = 16, 46
    outs = []
    for page in range(0, len(ims), per):
        chunk = ims[page:page + per]
        rows = (len(chunk) + cols - 1) // cols
        S = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), "#EDE5D6")
        dr = ImageDraw.Draw(S)
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", 26)
        except OSError:
            font = ImageFont.load_default()
        for i, (s, im) in enumerate(chunk):
            r, c = divmod(i, cols)
            x = S.width - pad - (c + 1) * (tw + pad) + pad  # right → left
            y = pad + r * (th + lab + pad)
            S.paste(im.resize((tw, th)), (x, y + lab))
            dr.text((x + tw - 8, y + 8), f"{page + i + 1}  {s['id']}", fill="#22304A", font=font, anchor="ra")
        p = d / f"contact_{page // per + 1}.jpg"
        S.save(p, quality=88)
        outs.append(str(p))
    print("\n".join(outs))
    return outs


if __name__ == "__main__":
    sheet(sys.argv[1])
