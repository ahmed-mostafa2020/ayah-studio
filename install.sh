#!/usr/bin/env bash
# ستوديو آية — تسطيب لماك ولينكس بأمر واحد:
#   curl -fsSL https://raw.githubusercontent.com/ahmed-mostafa2020/ayah-studio/main/install.sh | bash
# بعد التسطيب كل حاجة بتشتغل من غير إنترنت.
set -euo pipefail
REPO="ahmed-mostafa2020/ayah-studio"
DIR="${AYAH_DIR:-$HOME/ayah-studio}"
say() { printf "\n\033[1;32m▸ %s\033[0m\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1; }

say "ستوديو آية — التسطيب (في $DIR)"

# 1) المتطلبات: Node 18+، وPython 3.10+، وffmpeg
if [[ "$(uname)" == "Darwin" ]] && ! need brew; then
  echo "محتاج Homebrew علشان أسطّب المتطلبات: https://brew.sh — سطّبه وشغّل الأمر تاني."; exit 1
fi
install_pkg() {
  if [[ "$(uname)" == "Darwin" ]]; then brew install "$1"
  elif need apt-get; then sudo apt-get update -qq && sudo apt-get install -y "$2"
  else echo "سطّب $1 بنفسك وشغّل الأمر تاني"; exit 1; fi
}
need node    || { say "بسطّب Node.js";  install_pkg node nodejs; }
need python3 || { say "بسطّب Python";   install_pkg python@3.12 python3; }
need ffmpeg  || { say "بسطّب ffmpeg";   install_pkg ffmpeg ffmpeg; }
python3 -c 'import sys; assert sys.version_info >= (3, 10)' || { echo "محتاج Python 3.10 أو أحدث"; exit 1; }

# 2) الكود (آخر Release، أو main لو مفيش)
if [[ -d "$DIR/.git" ]] && need git; then
  say "بحدّث الكود"; git -C "$DIR" pull --ff-only
elif [[ ! -f "$DIR/package.json" ]]; then
  say "بنزّل الكود"
  TMP=$(mktemp -d)
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP"
  mkdir -p "$DIR"; cp -R "$TMP"/ayah-studio-main/. "$DIR"/; rm -rf "$TMP"
fi
cd "$DIR"

# 3) المكتبات
say "بسطّب مكتبات Node (Remotion والخطوط)"
npm install --no-audit --no-fund
say "بسطّب مكتبات Python في .venv"
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r pipeline/requirements.txt

# 4) الحاجات التقيلة مرة واحدة: متصفح الرندر وموديل التفريغ (حوالي 3 جيجا)
say "بنزّل متصفح الرندر"
(cd engine && npx remotion browser ensure) || echo "(لو عندك Google Chrome متسطّب، الرندر هيستخدمه)"
say "بنزّل موديل التفريغ whisper large-v3 (حوالي 3 جيجا، مرة واحدة بس)"
HF_HUB_DISABLE_XET=1 .venv/bin/python -c "from faster_whisper.utils import download_model; download_model('large-v3', cache_dir='models')"

# 5) اختياري: Claude Code (علشان تستخدم الـ AI باشتراكك من غير مفتاح)
if ! need claude; then
  read -r -p "تسطّب Claude Code (اختياري، علشان الـ AI باشتراكك)? [y/N] " a </dev/tty || a=n
  if [[ "${a:-n}" =~ ^[Yy]$ ]]; then npm install -g @anthropic-ai/claude-code && echo "شغّل: claude  وسجّل دخول مرة واحدة"; fi
fi

# 6) أمر التشغيل
cat > "$DIR/start.sh" <<'EOS'
#!/usr/bin/env bash
cd "$(dirname "$0")"
( sleep 1.5; (command -v open >/dev/null && open http://localhost:4747) || (command -v xdg-open >/dev/null && xdg-open http://localhost:4747) ) &
exec node studio/server.mjs
EOS
chmod +x "$DIR/start.sh"
node cli/ayah.mjs doctor || true
say "خلص ✅  شغّل الأداة بـ:  $DIR/start.sh   (وبعدين افتح http://localhost:4747)"
