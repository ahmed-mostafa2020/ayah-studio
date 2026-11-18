"""A video project lives in projects/<slug>/ and holds every intermediate file."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "config" / "defaults.json"


def load_config(project: "Project | None" = None) -> dict:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    user = ROOT / "config" / "user.json"
    if user.exists():
        cfg = _merge(cfg, json.loads(user.read_text(encoding="utf-8")))
    if project and project.file("settings.json").exists():
        cfg = _merge(cfg, project.read("settings.json"))
    return cfg


def _merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = _merge(a[k], v) if isinstance(v, dict) and isinstance(a.get(k), dict) else v
    return out


class Project:
    def __init__(self, slug: str):
        self.slug = slug
        self.dir = Path(os.environ.get("AYAH_PROJECTS", ROOT / "projects")) / slug
        self.dir.mkdir(parents=True, exist_ok=True)

    def file(self, name: str) -> Path:
        return self.dir / name

    def read(self, name: str):
        return json.loads(self.file(name).read_text(encoding="utf-8"))

    def write(self, name: str, data) -> Path:
        p = self.file(name)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return p

    def has(self, name: str) -> bool:
        return self.file(name).exists()
