// «ستوديو آية» — local dashboard server (no external dependencies, works offline).
// Every button calls the same pipeline the CLI uses.
import {spawn} from 'node:child_process';
import {createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS = process.env.AYAH_PROJECTS ?? join(ROOT, 'projects');
const PORT = Number(process.env.PORT ?? 4747);
const HOST = process.env.AYAH_HOST ?? '127.0.0.1'; // set 0.0.0.0 only when you run it on your own server
const PY = process.env.AYAH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const ENV = {...process.env, PYTHONPATH: join(ROOT, 'pipeline'), PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_XET: '1',
  ...(existsSync(join(ROOT, 'models')) && !process.env.AYAH_ONLINE ? {HF_HUB_OFFLINE: '1'} : {})};
const EDITABLE = new Set(['transcript.json', 'sacred.json', 'storyboard.json', 'approvals.json', 'settings.json', 'goal.json']);
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

mkdirSync(PROJECTS, {recursive: true});
const slugOk = (s) => /^[\p{L}\p{N}_-]{1,60}$/u.test(s);

// ---------- jobs (long steps run in the background; the page polls them) ----------
const jobs = new Map();
let seq = 0;
const runJob = (label, steps) => {
  const id = String(++seq);
  const job = {id, label, status: 'running', log: '', progress: 0, started: Date.now()};
  jobs.set(id, job);
  (async () => {
    for (const [cmd, args, opts] of steps) {
      const code = await new Promise((ok) => {
        const p = spawn(cmd, args, {cwd: ROOT, env: {...ENV, ...(opts?.env ?? {})}});
        const eat = (b) => {
          const s = b.toString();
          job.log = (job.log + s).slice(-6000);
          const m = s.match(/progress (\d+)%/g);
          if (m) job.progress = Number(m.at(-1).match(/\d+/)[0]);
        };
        p.stdout.on('data', eat); p.stderr.on('data', eat);
        p.on('close', ok);
      });
      if (code !== 0 && !opts?.allowFail) { job.status = 'failed'; return; }
    }
    job.status = 'done'; job.progress = 100;
  })();
  return job;
};
const py = (...a) => [PY, ['-m', 'ayah_pipeline', ...a]];
const node = (...a) => ['node', a];

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const serveFile = (res, file) => {
  if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, {error: 'not found'});
  res.writeHead(200, {'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
  createReadStream(file).pipe(res);
};

const projectInfo = (slug) => {
  const d = join(PROJECTS, slug);
  const has = (f) => existsSync(join(d, f));
  const meta = has('meta.json') ? JSON.parse(readFileSync(join(d, 'meta.json'), 'utf8')) : {};
  const stage = has('final.mp4') ? 'مكتمل' : has('approvals.json') ? 'مراجعة الصور' : has('stills/index.json') ? 'الصور جاهزة' : has('storyboard.json') ? 'ستوري بورد' :
    has('sacred.json') ? 'مراجعة التفريغ' : has('transcript.json') ? 'تفريغ' : 'استيراد';
  return {slug, stage, duration: meta.duration, mtime: statSync(d).mtimeMs};
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (parts[0] !== 'api') {
      // static: the app itself + bundled fonts (offline)
      if (parts[0] === 'fonts') return serveFile(res, join(ROOT, 'node_modules/@fontsource', normalize(parts.slice(1).join('/')).replace(/^(\.\.[/\\])+/, '')));
      const f = parts.length ? normalize(parts.join('/')).replace(/^(\.\.[/\\])+/, '') : 'index.html';
      return serveFile(res, join(ROOT, 'studio/public', f));
    }

    // /api/recipes
    if (parts[1] === 'recipes') {
      const job = await new Promise((ok) => { const p = spawn(...py('recipes'), {cwd: ROOT, env: ENV}); let o = ''; p.stdout.on('data', (d) => (o += d)); p.on('close', () => ok(o)); });
      return send(res, 200, job);
    }
    if (parts[1] === 'jobs' && parts[2]) return send(res, 200, jobs.get(parts[2]) ?? {status: 'missing'});
    if (parts[1] === 'config' && req.method === 'GET') {
      const cfg = JSON.parse(readFileSync(join(ROOT, 'config/defaults.json'), 'utf8'));
      return send(res, 200, {...cfg, hasClaudeKey: Boolean(process.env.ANTHROPIC_API_KEY), offline: ENV.HF_HUB_OFFLINE === '1'});
    }

    // /api/projects
    if (parts[1] === 'projects' && parts.length === 2) {
      if (req.method === 'GET') return send(res, 200, readdirSync(PROJECTS).filter((s) => statSync(join(PROJECTS, s)).isDirectory()).map(projectInfo).sort((a, b) => b.mtime - a.mtime));
      if (req.method === 'POST') {
        // raw upload: ?slug=...&name=file.mp3
        const slug = url.searchParams.get('slug') ?? '';
        const name = (url.searchParams.get('name') ?? 'source.mp3').replace(/[^\w.\-]/g, '_');
        if (!slugOk(slug)) return send(res, 400, {error: 'اسم المشروع: حروف وأرقام وشرطة بس'});
        const d = join(PROJECTS, slug);
        mkdirSync(d, {recursive: true});
        const up = join(d, 'upload_' + name);
        await new Promise((ok, bad) => { const w = createWriteStream(up); req.pipe(w); w.on('finish', ok); w.on('error', bad); });
        const job = runJob('استيراد وتفريغ', [py('new', slug, up), py('transcribe', slug), py('analyze', slug), py('sacred', slug)]);
        return send(res, 200, {slug, job: job.id});
      }
    }

    // /api/p/:slug/...
    if (parts[1] === 'p' && parts[2]) {
      const slug = parts[2];
      if (!slugOk(slug)) return send(res, 400, {error: 'bad slug'});
      const d = join(PROJECTS, slug);
      const what = parts[3];

      if (what === 'file' && parts[4]) {
        const f = parts[4];
        if (req.method === 'PUT') {
          if (!EDITABLE.has(f)) return send(res, 403, {error: 'not editable'});
          const body = (await readBody(req)).toString('utf8');
          JSON.parse(body); // must be valid
          writeFileSync(join(d, f), body);
          return send(res, 200, {ok: true});
        }
        return serveFile(res, join(d, f.replace(/[\\/]/g, '')));
      }
      if (what === 'media') {
        const src = readdirSync(d).find((f) => f.startsWith('source.') && !f.endsWith('.wav')) ?? 'source.wav';
        return serveFile(res, join(d, existsSync(join(d, 'voice.wav')) ? 'voice.wav' : src));
      }
      if (what === 'out' && parts[4]) return serveFile(res, join(d, 'out', parts[4].replace(/[\\/]/g, '')));
      if (what === 'stills' && parts[4]) return serveFile(res, join(d, 'stills', parts[4].replace(/[\\/]/g, '')));

      if (what === 'run' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        const cmd = parts[4];
        const steps = {
          resacred: () => [py('sacred', slug)],
          plan: () => [py('plan', slug, '--mode', ['claude', 'local'].includes(body.mode) ? body.mode : 'rules'), [PY, ['-m', 'ayah_pipeline', 'lint', slug], {allowFail: true}]],
          rescene: () => [py('rescene', slug, body.scene, '--recipe', body.recipe, '--params', JSON.stringify(body.params ?? {})), [PY, ['-m', 'ayah_pipeline', 'lint', slug], {allowFail: true}],
            [...node(join(ROOT, 'engine/stills.mjs'), slug, `--scenes=${body.scene}`)]],
          lint: () => [[PY, ['-m', 'ayah_pipeline', 'lint', slug, '--stage', body.stage === 'render' ? 'render' : 'stills'], {allowFail: true}]],
          stills: () => [[PY, ['-m', 'ayah_pipeline', 'lint', slug], {allowFail: true}], node(join(ROOT, 'engine/stills.mjs'), slug, ...(body.scenes ? [`--scenes=${body.scenes.join(',')}`] : []))],
          ai: () => [[PY, ['-m', 'ayah_pipeline', 'ai', body.task, slug, '--mode', body.mode === 'local' ? 'local' : 'claude', ...(body.ids ? ['--ids', body.ids.join(',')] : [])]]],
          render: () => body.to
            ? [node(join(ROOT, 'engine/render.mjs'), slug, `--to=${Math.max(5, Math.min(120, Number(body.to) || 20))}`)]  // preview: first N seconds
            : [[PY, ['-m', 'ayah_pipeline', 'lint', slug, '--stage', 'render']], node(join(ROOT, 'engine/render.mjs'), slug)],
        }[cmd];
        if (!steps) return send(res, 404, {error: 'unknown command'});
        if ((cmd === 'ai' || cmd === 'plan') && body.mode === 'claude' && !process.env.ANTHROPIC_API_KEY) return send(res, 400, {error: 'مفتاح Claude API مش متسجل (ANTHROPIC_API_KEY)'});
        return send(res, 200, runJob(cmd, steps()));
      }
      if (what === 'estimate') {
        const task = url.searchParams.get('task') ?? 'plan';
        const out = await new Promise((ok) => { const p = spawn(...py('ai', task, slug, '--estimate'), {cwd: ROOT, env: ENV}); let o = ''; p.stdout.on('data', (x) => (o += x)); p.on('close', () => ok(o)); });
        return send(res, 200, out);
      }
      if (!what) return send(res, 200, projectInfo(slug));
    }
    send(res, 404, {error: 'not found'});
  } catch (e) {
    send(res, 500, {error: String(e?.message ?? e)});
  }
}).listen(PORT, HOST, () => console.log(`ستوديو آية شغال: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
