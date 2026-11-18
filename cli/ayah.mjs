#!/usr/bin/env node
// «ستوديو آية» CLI — every dashboard action has a command here.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENV_PY = [join(ROOT, '.venv', 'Scripts', 'python.exe'), join(ROOT, '.venv', 'bin', 'python')].find(existsSync);
const PY = process.env.AYAH_PYTHON || VENV_PY || (process.platform === 'win32' ? 'python' : 'python3');
const env = {...process.env, PYTHONPATH: join(ROOT, 'pipeline'), PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_XET: '1',
  ...(existsSync(join(ROOT, 'models')) && !process.env.AYAH_ONLINE ? {HF_HUB_OFFLINE: '1'} : {})};

const py = (...args) => {
  const r = spawnSync(PY, ['-m', 'ayah_pipeline', ...args], {stdio: 'inherit', env, cwd: ROOT});
  if (r.status) process.exit(r.status);
};

const HELP = `ستوديو آية — الأوامر:
  ayah new <اسم> <ملف صوت/فيديو>     استيراد مقطع جديد
  ayah prepare <اسم>                   تفريغ + كشف الخلفية والسكتات + كشف الآيات والأحاديث
  ayah transcribe|analyze|sacred <اسم> كل خطوة لوحدها
  ayah plan <اسم> [--mode rules|local|claude]   الستوري بورد
  ayah lint <اسم> [--stage stills|render]       الفاحص
  ayah stills <اسم>                    صور الستوري بورد
  ayah render <اسم>                    الرندر (بعد موافقتك على الصور بس)
  ayah preview <اسم> [ثواني]           معاينة أول جزء من الفيديو
  ayah ai <مهمة> <اسم> --mode claude-code|manual|claude|local   الـ AI الاختياري
  ayah studio                          الداشبورد على localhost:4747
  ayah doctor                          يتأكد إن كل حاجة متسطّبة وشغالة أوفلاين`;

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'new': case 'transcribe': case 'analyze': case 'sacred': case 'prepare': case 'plan': case 'lint': case 'status':
    py(cmd, ...rest); break;
  case 'doctor': {
    const checks = [
      ['ffmpeg', spawnSync('ffmpeg', ['-version']).status === 0],
      ['python', spawnSync(PY, ['-c', 'import faster_whisper, rapidfuzz']).status === 0],
      ['whisper large-v3 (أوفلاين)', existsSync(join(ROOT, 'models'))],
      ['نص المصحف', existsSync(join(ROOT, 'assets/quran/quran_flat.json'))],
    ];
    for (const [n, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${n}`);
    process.exit(checks.every((c) => c[1]) ? 0 : 1);
  }
  case 'stills': { const r = spawnSync('node', [join(ROOT, 'engine/stills.mjs'), ...rest], {stdio: 'inherit', env}); process.exit(r.status ?? 0); }
  case 'render': { py('lint', rest[0], '--stage', 'render'); const r = spawnSync('node', [join(ROOT, 'engine/render.mjs'), ...rest], {stdio: 'inherit', env}); process.exit(r.status ?? 0); }
  case 'preview': { const r = spawnSync('node', [join(ROOT, 'engine/render.mjs'), rest[0], `--to=${rest[1] ?? 20}`], {stdio: 'inherit', env}); process.exit(r.status ?? 0); }
  case 'ai': py('ai', ...rest); break;
  case 'studio': { const r = spawnSync('node', [join(ROOT, 'studio/server.mjs')], {stdio: 'inherit', env}); process.exit(r.status ?? 0); }
  default:
    console.log(HELP);
}
