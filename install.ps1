# ستوديو آية — تسطيب لويندوز بأمر واحد (في PowerShell):
#   irm https://raw.githubusercontent.com/ahmed-mostafa2020/ayah-studio/main/install.ps1 | iex
# بعد التسطيب كل حاجة بتشتغل من غير إنترنت.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Repo = 'ahmed-mostafa2020/ayah-studio'
$Dir = if ($env:AYAH_DIR) { $env:AYAH_DIR } else { Join-Path $HOME 'ayah-studio' }
function Say($m) { Write-Host "`n▸ $m" -ForegroundColor Green }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }

Say "ستوديو آية — التسطيب (في $Dir)"

# 1) المتطلبات عن طريق winget: Node.js، وPython، وffmpeg
if (-not (Has winget)) { Write-Host 'محتاج winget (App Installer من Microsoft Store). سطّبه وشغّل الأمر تاني.'; exit 1 }
if (-not (Has node))   { Say 'بسطّب Node.js';  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements; Refresh-Path }
if (-not (Has python)) { Say 'بسطّب Python';   winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements; Refresh-Path }
if (-not (Has ffmpeg)) { Say 'بسطّب ffmpeg';   winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements; Refresh-Path }

# 2) الكود
if (-not (Test-Path (Join-Path $Dir 'package.json'))) {
  Say 'بنزّل الكود'
  $zip = Join-Path $env:TEMP 'ayah-studio.zip'
  Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
  $tmp = Join-Path $env:TEMP 'ayah-studio-src'; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip $tmp
  New-Item -ItemType Directory -Force $Dir | Out-Null
  Copy-Item (Join-Path $tmp 'ayah-studio-main\*') $Dir -Recurse -Force
}
Set-Location $Dir

# 3) المكتبات
Say 'بسطّب مكتبات Node (Remotion والخطوط)'
npm install --no-audit --no-fund
Say 'بسطّب مكتبات Python في .venv'
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -q --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -q -r pipeline\requirements.txt

# 4) الحاجات التقيلة مرة واحدة
Say 'بنزّل متصفح الرندر'
Push-Location engine; try { npx remotion browser ensure } catch { Write-Host '(لو عندك Google Chrome، الرندر هيستخدمه)' }; Pop-Location
Say 'بنزّل موديل التفريغ whisper large-v3 (حوالي 3 جيجا، مرة واحدة بس)'
$env:HF_HUB_DISABLE_XET = '1'
& .\.venv\Scripts\python.exe -c "from faster_whisper.utils import download_model; download_model('large-v3', cache_dir='models')"

# 5) اختياري: Claude Code (الـ AI باشتراكك من غير مفتاح)
if (-not (Has claude)) {
  $a = Read-Host 'تسطّب Claude Code (اختياري، علشان الـ AI باشتراكك)? [y/N]'
  if ($a -match '^[Yy]') { npm install -g @anthropic-ai/claude-code; Write-Host 'شغّل: claude  وسجّل دخول مرة واحدة' }
}

# 6) التشغيل + اختصار على سطح المكتب
@"
@echo off
cd /d "%~dp0"
start "" http://localhost:4747
node studio\server.mjs
"@ | Set-Content -Encoding ASCII (Join-Path $Dir 'start.bat')
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ayah Studio.lnk'))
$lnk.TargetPath = Join-Path $Dir 'start.bat'; $lnk.WorkingDirectory = $Dir
$ico = Join-Path $Dir 'assets\brand\logo.ico'; if (Test-Path $ico) { $lnk.IconLocation = $ico }
$lnk.Save()
node cli\ayah.mjs doctor
Say "خلص ✅  افتح «Ayah Studio» من سطح المكتب (أو شغّل start.bat)، وهيفتح http://localhost:4747"
