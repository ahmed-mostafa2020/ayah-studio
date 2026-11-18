#!/usr/bin/env bash
# Runs once when the Codespace is created.
set -e
sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg fonts-dejavu-core libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2 >/dev/null
npm install --no-audit --no-fund
python3 -m venv .venv && .venv/bin/pip install -q -r pipeline/requirements.txt
(cd engine && npx remotion browser ensure) || true
HF_HUB_DISABLE_XET=1 .venv/bin/python -c "from faster_whisper.utils import download_model; download_model('large-v3', cache_dir='models')"
echo "✅ ستوديو آية جاهز"
