"""Arabic text helpers: normalisation for matching (never for display)."""
import re

# harakat, Quranic annotation marks, small high letters, tatweel
_DIAC = re.compile("[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\u08D3-\u08FF]")
_MAP = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ٲ": "ا", "ٳ": "ا",
    "ى": "ي", "ی": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ک": "ك",
    "ۥ": "", "ۦ": "", "\u0670": "ا",
})
_NON_AR = re.compile(r"[^ء-ي ]")
LATIN = re.compile(r"[A-Za-z]")

FILLERS = {"يعني", "بقي", "اه", "اا", "امم", "ام", "ايوه", "مثلا", "طيب"}


def norm(s: str) -> str:
    s = _DIAC.sub("", s)
    s = s.translate(_MAP)
    s = _NON_AR.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_word(w: str) -> str:
    return norm(w).replace(" ", "")


def is_arabic_only(s: str) -> bool:
    return not LATIN.search(s)


def skeleton(w: str) -> str:
    """normalised word without alef/waw/ya long vowels — tolerant key for indexing spoken vs Uthmani spelling."""
    return re.sub(r"[اوي]", "", norm_word(w)) or norm_word(w)
