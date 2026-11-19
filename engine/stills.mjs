// node engine/stills.mjs <slug> [--scenes s1,s4]   → projects/<slug>/stills/*.png + contact sheet
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const P = join(process.env.AYAH_PROJECTS ?? join(ROOT, 'projects'), slug);
let only = (process.argv.find((a) => a.startsWith('--scenes=')) ?? '').slice(9).split(',').filter(Boolean);
if (only[0] === '@chat') { only = existsSync(join(P, 'chat_last.json')) ? JSON.parse(readFileSync(join(P, 'chat_last.json'), 'utf8')).scenes : []; if (!only.length) process.exit(0); }
const sb = JSON.parse(readFileSync(join(P, 'storyboard.json'), 'utf8'));
const sacred = existsSync(join(P, 'sacred.json')) ? JSON.parse(readFileSync(join(P, 'sacred.json'), 'utf8')).spans : [];
const browserExecutable = process.env.AYAH_CHROME || ['/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync) || null;

// one still per scene, at the moment its main word lands (or mid-scene), plus frame 0 and the like/outro moments
const pick = (sc) => {
  const cap = sb.captions.find((c) => c.start >= sc.start && c.start < sc.end);
  const next = cap && sb.captions[sb.captions.indexOf(cap) + 1];
  const t = cap ? Math.min(sc.end - 0.3, cap.words.at(-1).t + 0.3, next ? next.start - 0.08 : 1e9) : (sc.start + sc.end) / 2;
  return Math.max(sc.start + 0.6, t);
};
let shots = [{id: 'f0', label: 'أول فريم', t: 0}];
for (const sc of sb.scenes) shots.push({id: sc.id, label: sc.meaning.slice(0, 60), t: pick(sc)});
shots.push({id: 'like', label: 'الماسكوت: لايك', t: sb.template.mascot.like + 1.0});
if (only.length) shots = shots.filter((s) => only.includes(s.id));

const out = join(P, 'stills');
mkdirSync(out, {recursive: true});
console.error('bundling…');
const serveUrl = await bundle({entryPoint: join(ROOT, 'engine/src/index.ts')});
const inputProps = {storyboard: sb, sacred};
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, browserExecutable});
for (const s of shots) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s.t * 30));
  await renderStill({serveUrl, composition, frame, inputProps, output: join(out, `${s.id}.png`), browserExecutable, scale: 0.5});
  console.error(`✓ ${s.id} @${s.t.toFixed(2)}s`);
}
writeFileSync(join(out, 'index.json'), JSON.stringify(shots, null, 2));
const VENV_PY = [join(ROOT, '.venv', 'Scripts', 'python.exe'), join(ROOT, '.venv', 'bin', 'python')].find(existsSync);
const r = spawnSync(process.env.AYAH_PYTHON || VENV_PY || (process.platform === 'win32' ? 'python' : 'python3'), [join(ROOT, 'pipeline/ayah_pipeline/contact.py'), out], {stdio: 'inherit'});
process.exit(r.status ?? 0);
