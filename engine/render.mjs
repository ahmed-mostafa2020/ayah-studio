// node engine/render.mjs <slug> [--to=20] [--chunk=480] [--format=9x16]
// Renders in chunks (muted), concatenates with ffmpeg, mixes audio in Python, then muxes.
// Output folder: projects/<slug>/out/  → video, thumbnail, captions.srt, post.txt
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const P = join(process.env.AYAH_PROJECTS ?? join(ROOT, 'projects'), slug);
const cfg = JSON.parse(readFileSync(join(ROOT, 'config/defaults.json'), 'utf8'));
const sb = JSON.parse(readFileSync(join(P, 'storyboard.json'), 'utf8'));
const sacred = existsSync(join(P, 'sacred.json')) ? JSON.parse(readFileSync(join(P, 'sacred.json'), 'utf8')).spans : [];
const to = Number(arg('to', 0)) || null;
const chunk = Number(arg('chunk', cfg.render.chunkFrames));
const browserExecutable = process.env.AYAH_CHROME || ['/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync) || null;
const VENV_PY = [join(ROOT, '.venv', 'Scripts', 'python.exe'), join(ROOT, '.venv', 'bin', 'python')].find(existsSync);
const PY = process.env.AYAH_PYTHON || VENV_PY || (process.platform === 'win32' ? 'python' : 'python3');
const env = {...process.env, PYTHONPATH: join(ROOT, 'pipeline'), PYTHONIOENCODING: 'utf-8'};
const sh = (cmd, args) => { const r = spawnSync(cmd, args, {stdio: ['ignore', 'pipe', 'inherit'], env}); if (r.status) throw new Error(`${cmd} failed`); return r.stdout?.toString() ?? ''; };

const out = join(P, 'out');
const parts = join(out, 'parts');
mkdirSync(parts, {recursive: true});
console.error('bundling…');
const serveUrl = await bundle({entryPoint: join(ROOT, 'engine/src/index.ts')});
const inputProps = {storyboard: sb, sacred};
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, browserExecutable});
const last = Math.min(composition.durationInFrames, to ? Math.round(to * composition.fps) : Infinity) - 1;

const list = [];
for (let a = 0, i = 0; a <= last; a += chunk, i++) {
  const b = Math.min(last, a + chunk - 1);
  const file = join(parts, `part_${String(i).padStart(3, '0')}.mp4`);
  if (!existsSync(file)) {
    await renderMedia({serveUrl, composition, inputProps, codec: 'h264', frameRange: [a, b], muted: true, crf: cfg.render.crf, x264Preset: cfg.render.preset,
      outputLocation: file + '.tmp.mp4', browserExecutable, concurrency: Math.max(1, Math.min(4, os.cpus().length - 1)),
      onProgress: ({progress}) => process.stderr.write(`\rprogress ${Math.round(((a + progress * (b - a + 1)) / (last + 1)) * 100)}%`)});
    copyFileSync(file + '.tmp.mp4', file); rmSync(file + '.tmp.mp4');
  }
  list.push(`file '${file.replace(/\\/g, '/')}'`);
}
console.error('\njoining parts…');
writeFileSync(join(parts, 'list.txt'), list.join('\n'));
const video = join(out, 'video_only.mp4');
sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(parts, 'list.txt'), '-c', 'copy', video]);

console.error('mixing audio…');
console.error(sh(PY, ['-m', 'ayah_pipeline', 'mix', slug, ...(to ? ['--to', String(to)] : [])]));
const name = `${slug}${to ? `_first${to}s` : ''}.mp4`;
sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', join(P, 'mix.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(out, name)]);
rmSync(video);
if (!to) rmSync(parts, {recursive: true, force: true}); // keep parts for previews so a full render can reuse them

// thumbnail: the hook frame at full size
await renderStill({serveUrl, composition, inputProps, frame: Math.round(0.6 * composition.fps), output: join(out, 'thumbnail.png'), browserExecutable});
// captions + post text
sh(PY, ['-m', 'ayah_pipeline', 'srt', slug]);
copyFileSync(join(P, 'captions.srt'), join(out, 'captions.srt'));
const pub = existsSync(join(P, 'publish.json')) ? JSON.parse(readFileSync(join(P, 'publish.json'), 'utf8')) : {};
writeFileSync(join(out, 'post.txt'), [
  `العنوان: ${pub.title ?? sb.template.hook.text}`, '',
  `الوصف:\n${pub.description ?? sb.template.hook.text}`, '',
  `التعليق المثبّت: ${pub.pinned || sb.pinnedComment || '(اكتب سؤال يتجاوب عليه من موضوع الفيديو، أو استخدم زرار الـ AI)'}`, '',
  (pub.hashtags ?? []).join(' '), '',
  '🎙️ الصوت: [اسم الشيخ]  —  المقطع الأصلي: [الرابط]   (الاسم في الوصف بس، مش جوه الفيديو)',
].join('\n'));
console.error(`done → ${join(out, name)}`);
