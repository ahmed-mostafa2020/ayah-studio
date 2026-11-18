#!/usr/bin/env node
// «ستوديو آية» CLI — every dashboard action has a command here.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PY = process.env.AYAH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
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
  ayah stills <اسم>                    صور الستوري بورد (المرحلة 2)
  ayah render <اسم>                    الرندر (المرحلة 4، بعد موافقتك على الصور بس)
  ayah studio                          الداشبورد على localhost (المرحلة 3)
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
  case 'stills': case 'render': case 'studio':
    console.log(`«${cmd}» لسه بيتبني في المرحلة الجاية.`); break;
  default:
    console.log(HELP);
}
