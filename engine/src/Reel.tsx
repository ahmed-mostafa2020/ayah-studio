import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {B, BHeart, BMascot, BrandDefs, PCar, PCoins, PFlat, PGrave, PHouse, PLantern, PMat, PPalm, PQuran, PSack, Person} from './brand/Brand';
import {NafsShadow, PBadge, PChart, PGoldValley, PPath, PSign, PThought, PXMark, PConveyor, PHourglass, PKaaba, PLadder, PMountain, PPlane, PValley, PVilla, PYacht, PersonSujood, lookFor} from './brand/Extra';
import {useFonts} from './fonts';
import type {Caption, Character, Element, Motion, Scene, Storyboard} from './types';

const W = 1080, H = 1920;
const TOP = new Set(['thought', 'xmark', 'badge']);
// gentle idle motion per element (background layer of motion — nothing on screen is ever frozen)
const IDLE: Record<string, (t: number) => string> = {
  thought: (t) => `translate(0 ${Math.sin(t * 1.3) * 7})`,
  lantern: (t) => `rotate(${Math.sin(t * 1.1) * 3} 0 -130)`,
  coins: (t) => `scale(${1 + Math.sin(t * 2.2) * 0.012})`,
  goldvalley: (t) => `scale(${1 + Math.sin(t * 2) * 0.01})`,
  badge: (t) => `translate(0 ${Math.sin(t * 1.6) * 4})`,
  icon: (t) => `rotate(${Math.sin(t * 0.9) * 4} 0 -70)`,
  sign: (t) => `rotate(${Math.sin(t * 0.7) * 0.8} 0 0)`,
  plane: (t) => `translate(${Math.sin(t * 0.6) * 18} ${Math.sin(t * 1.1) * 6})`,
};
const EASE = {out: Easing.bezier(0.33, 1, 0.68, 1), in: Easing.bezier(0.32, 0, 0.67, 0), inOut: Easing.bezier(0.65, 0, 0.35, 1), linear: Easing.linear, spring: Easing.bezier(0.33, 1, 0.68, 1)};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type SacredSpan = {id: string; type: string; text?: string; ref?: string; source?: string; status?: string; heard?: string};
export type ReelProps = {storyboard: Storyboard; sacred: SacredSpan[]; audio?: string; still?: boolean};

// ---------- motion engine ----------
type Anim = {dx: number; dy: number; scale: number; opacity: number; x?: number; reach?: number; light: number; aim?: number; lightAbs?: number; y?: number};
const animate = (motion: Motion[], target: string, t: number): Anim => {
  const a: Anim = {dx: 0, dy: 0, scale: 1, opacity: 1, light: 1};
  for (const m of motion) {
    if (m.target !== target) continue;
    if (m.phase !== 'enter' && t < m.start) continue;
    const v = interpolate(t, [m.start, m.start + Math.max(0.01, m.dur)], [m.from, m.to], {...clamp, easing: EASE[m.ease] ?? EASE.out});
    if (m.prop === 'y') a.dy += v; else if (m.prop === 'x') { if (m.phase === 'move') a.x = v; else a.dx += v; }
    else if (m.prop === 'scale') a.scale *= v; else if (m.prop === 'opacity') a.opacity *= v;
    else if (m.prop === 'reach') a.reach = v; else if (m.prop === 'light') { a.light *= v; a.lightAbs = v; } else if (m.prop === 'aim') a.aim = v;
  }
  return a;
};

// ---------- background: cream paper + faint Islamic star pattern, mood tint ----------
const MOOD: Record<string, string> = {calm: 'rgba(175,205,230,0.10)', warm: 'rgba(243,210,122,0.14)', cold: 'rgba(108,116,130,0.22)', dark: 'rgba(62,50,80,0.30)'};
const Paper: React.FC<{mood?: string; kind?: string; light: number; t: number}> = ({mood = 'calm', kind = 'paper', light, t}) => (
  <AbsoluteFill style={{filter: `brightness(${light})`}}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <pattern id="star" width="120" height="120" patternUnits="userSpaceOnUse">
          <g transform="translate(60 60)" fill="none" stroke="#C9A86A" strokeOpacity="0.16" strokeWidth="2">
            <rect x="-26" y="-26" width="52" height="52" /><rect x="-26" y="-26" width="52" height="52" transform="rotate(45)" />
          </g>
        </pattern>
        <linearGradient id="skyDawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#AFCDE6" /><stop offset="0.7" stopColor="#F7E1C6" /><stop offset="1" stopColor="#FBF5EA" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={kind === 'dawn' || kind === 'sky' ? 'url(#skyDawn)' : B.paper} />
      <rect width={W} height={H} fill="url(#star)" />
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2CB97" /><stop offset="1" stopColor="#E7AF77" /></linearGradient>
      <rect y={1500} width={W} height={420} fill="url(#sand)" />
      <rect y={1500} width={W} height={6} fill="#fff" opacity={0.35} />
      <g opacity={0.35}>
        <path d={`M${-200 + (t * 6) % 200} 1500 Q 150 1330 420 1450 T 980 1420 T 1500 1460 V1500 Z`} fill="#E7CFA6" />
        <path d={`M${-300 + (t * 3) % 300} 1500 Q 250 1380 560 1470 T 1200 1440 T 1700 1480 V1500 Z`} fill="#DDBF8F" opacity={0.7} />
      </g>
      {[0, 1, 2].map((i) => { const cx = ((i * 420 + t * (14 + i * 5)) % 1500) - 200; return <ellipse key={i} cx={cx} cy={420 + i * 170} rx={110 + i * 20} ry={26} fill="#fff" opacity={0.45} />; })}
      {Array.from({length: 14}).map((_, i) => { const y = 1450 - ((t * (22 + (i % 4) * 7) + i * 97) % 760); const x = (i * 83 + Math.sin(t * 0.7 + i) * 20) % 1080;
        return <circle key={i} cx={x} cy={y} r={2.5 + (i % 3)} fill={mood === 'warm' || kind === 'dawn' ? '#F3D27A' : '#fff'} opacity={0.5} />; })}
      <rect width={W} height={H} fill={MOOD[mood] ?? MOOD.calm} />
    </svg>
  </AbsoluteFill>
);

// ---------- library ----------
const ElementShape: React.FC<{e: Element; t: number; progress?: number}> = ({e, t, progress = 1}) => {
  const ee = e as Element & {trend?: string; w?: number};
  switch (e.type) {
    case 'path': return <PPath w={ee.w} />;
    case 'thought': return <PThought label={e.label ?? ''} fontSize={e.fontSize} w={ee.w} tailDir={e.x > 540 ? -1 : 1} />;
    case 'sign': return <PSign label={e.label ?? ''} fontSize={e.fontSize} />;
    case 'badge': return <PBadge label={e.label ?? ''} />;
    case 'chart': return <PChart progress={progress} trend={ee.trend} />;
    case 'xmark': return <PXMark />;
    case 'goldvalley': return <PGoldValley />;
    case 'house': return <PHouse />; case 'sack': return <PSack />; case 'coins': return <PCoins />; case 'lantern': return <PLantern />;
    case 'quran': return <PQuran />; case 'palm': return <PPalm />; case 'grave': return <PGrave />; case 'mat': return <PMat />;
    case 'flat': return <PFlat />; case 'car': return <PCar />; case 'villa': return <PVilla />; case 'plane': return <PPlane />;
    case 'yacht': return <PYacht />; case 'mountain': return <PMountain />; case 'valley': return <PValley />; case 'ladder': return <PLadder />;
    case 'conveyor': return <PConveyor t={t} />; case 'kaaba': return <PKaaba />;
    case 'icon': return <PHourglass />;
    default: return <rect x={-60} y={-120} width={120} height={120} rx={20} fill={B.soft} />;
  }
};

const CharacterView: React.FC<{c: Character; t: number; a: Anim; reach?: number}> = ({c, t, a, reach}) => {
  const look = {...lookFor(c.kind, c.mood), s: (lookFor(c.kind, c.mood).s ?? 1) * (c.scale ?? 1)};
  const x = (a.x ?? c.x) + a.dx;
  const dir = c.flip ? -1 : 1;
  const seed = (c.id.charCodeAt(0) % 7) * 0.9;
  const walking = c.pose === 'walk';
  const breathe = walking ? 0 : Math.sin(t * 1.7 + seed) * 2.2;           // idle life: breathing
  const sway = walking ? Math.sin(t * 5) * 1.2 : Math.sin(t * 0.8 + seed) * 0.9; // and a slow weight shift
  const pose = c.pose === 'sujood' || c.pose === 'pray' ? null : c.pose;
  return (
    <g opacity={a.opacity}>
      {c.shadow && <NafsShadow x={x} y={c.y} reach={reach ?? c.shadow.reach} dir={dir as 1 | -1} t={t} s={look.s} />}
      <g transform={`translate(0 ${a.dy + breathe}) translate(${x} ${c.y}) scale(${a.scale}) rotate(${sway}) translate(${-x} ${-c.y})`}>
        {pose === null
          ? <PersonSujood x={x} y={c.y} look={look} flip={c.flip} light={c.light ?? 0} />
          : <Person x={x} y={c.y} look={look} pose={pose as any} view={c.view} flip={c.flip} aim={a.aim ?? c.aim} light={a.lightAbs ?? c.light ?? 0} dim={c.dim ?? 0} t={t} />}
      </g>
    </g>
  );
};

// ---------- sacred card: double gold frame + heart badge (no SFX ever) ----------
const SacredCard: React.FC<{span: SacredSpan; a: Anim}> = ({span, a}) => {
  const quran = span.type === 'quran';
  const missing = !span.text;  // a hadith without its verified wording is never shown as a hadith
  const text = missing ? 'محتاج نص الحديث ومصدره قبل الرندر' : span.text!;
  const size = missing ? 48 : text.length < 40 ? (quran ? 84 : 70) : text.length < 90 ? (quran ? 70 : 60) : 54;
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: 760, opacity: a.opacity, transform: `translateY(${a.dy}px) scale(${a.scale})`, transformOrigin: '50% 50%'}}>
      <div style={{background: 'rgba(251,245,234,0.96)', borderRadius: 36, border: `5px solid ${B.gold}`, padding: 10, boxShadow: '0 18px 50px rgba(34,48,74,0.18)'}}>
        <div style={{border: `2px solid ${B.goldD}`, borderRadius: 28, padding: '70px 46px 46px', textAlign: 'center', direction: 'rtl'}}>
          <div style={{fontFamily: missing ? 'Alexandria' : quran ? 'Amiri Quran' : 'Amiri', fontSize: size, lineHeight: 1.9, color: missing ? B.coral : B.ink, fontWeight: quran ? 400 : 700}}>{text}</div>
          <div style={{marginTop: 18, fontFamily: 'Alexandria', fontSize: 30, color: B.goldD, fontWeight: 500}}>{quran ? span.ref : span.source}</div>
        </div>
      </div>
      <svg width={120} height={100} viewBox="-60 -50 120 100" style={{position: 'absolute', left: '50%', top: -46, marginLeft: -60}}><BrandDefs /><BHeart s={1.3} glow={0.6} /></svg>
    </div>
  );
};

// ---------- word-by-word caption: the phrase sits in soft grey, each word inks in on its onset (coral = key, gold = sacred only) ----------
const Captions: React.FC<{caps: Caption[]; t: number; top: number}> = ({caps, t, top}) => {
  const i = caps.findIndex((c, k) => t >= c.start - 0.12 && t < (caps[k + 1]?.start ?? c.end + 1.2) - 0.02);
  if (i < 0) return null;
  const cur = caps[i];
  const exitAt = (caps[i + 1]?.start ?? cur.end + 1.2) - 0.02;
  const out = interpolate(t, [exitAt - 0.18, exitAt], [0, 1], {...clamp, easing: EASE.in});
  const inn = interpolate(t, [cur.start - 0.12, cur.start + 0.2], [0, 1], {...clamp, easing: EASE.out});
  const long = cur.words.reduce((n, w) => n + w.w.length, 0) > 26;
  return (
    <div style={{position: 'absolute', top, left: 56, right: 56, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', direction: 'rtl', gap: '0 20px',
      opacity: inn * (1 - out), transform: `translateY(${(1 - inn) * 24 - 12 * out}px)`}}>
      {cur.words.map((w, k) => {
        const on = interpolate(t, [w.t - 0.04, w.t + 0.16], [0, 1], {...clamp, easing: EASE.out});
        const target = w.color === 'gold' ? B.goldD : w.color === 'coral' ? B.coral : B.ink;
        const big = w.color === 'coral' || w.color === 'gold';
        return <span key={k} style={{fontFamily: w.color === 'gold' ? 'Amiri' : 'Alexandria', fontWeight: big ? 800 : on > 0.5 ? 700 : 500,
          fontSize: (big ? 104 : 84) * (long ? 0.86 : 1), lineHeight: 1.3, color: on > 0.02 ? target : '#B9B4AC', opacity: 0.55 + 0.45 * on,
          transform: `translateY(${(1 - on) * 6}px)`, display: 'inline-block', borderBottom: big && on > 0.5 ? `6px solid ${target}55` : '6px solid transparent'}}>{w.w}</span>;
      })}
    </div>
  );
};

// ---------- logo (top right, small; replace with the real logo file in assets/brand/logo.png) ----------
const Logo: React.FC = () => <Img src={staticFile('logo.png')} style={{position: 'absolute', top: 30, right: 30, width: 128, height: 128}} />;

// ---------- mascot (bottom left, speech bubble only) ----------
const Mascot: React.FC<{t: number; sb: Storyboard}> = ({t, sb}) => {
  const m = sb.template.mascot;
  const end = sb.meta.duration;
  const windows: [number, number, {txt: string; icon: string; col: string; at: number}[]][] = [
    [m.like, m.like + 2.6, [{txt: 'متنساش تعمل لايك', icon: '👍', col: '#1877F2', at: m.like}]],
    [m.comment, end, [{txt: 'سيب تعليق', icon: '💬', col: '#7A5AF8', at: m.comment}, {txt: 'وانشرها في الخير', icon: '🤍', col: '#E0526B', at: m.share}]],
  ];
  const win = windows.find(([a, b]) => t >= a - 0.05 && t <= b + 0.5);
  if (!win) return null;
  const [a, b, lines] = win;
  const fps = 30;
  const inn = spring({frame: Math.max(0, (t - a) * fps), fps, config: {damping: 200}});
  const out = interpolate(t, [b, b + 0.35], [0, 1], {...clamp, easing: EASE.in});
  const y = (1 - inn) * 380 + out * 380;
  const cur = [...lines].reverse().find((l) => t >= l.at);
  const k = cur ? interpolate(t, [cur.at, cur.at + 0.45], [0, 1], {...clamp, easing: EASE.out}) * (1 - out) : 0;
  const wave = (Math.sin((t - a) * 6) + 1) / 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg viewBox="-260 -330 520 640" style={{position: 'absolute', left: -40, bottom: 60, width: 460, height: 566, transform: `translateY(${y}px)`}}><BrandDefs /><BMascot wave={wave} /></svg>
      {cur && k > 0.01 && (
        <div style={{position: 'absolute', left: 70, bottom: 560, transform: `translateY(${y + (1 - k) * 22}px) scale(${0.9 + 0.1 * k})`, opacity: k, transformOrigin: '0% 100%', background: '#fff', borderRadius: 40,
          padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 14, direction: 'rtl', boxShadow: '0 8px 24px rgba(34,48,74,0.22)', whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: 'Alexandria', fontWeight: 800, fontSize: 40, color: B.ink}}>{cur.txt}</span>
          <span style={{width: 58, height: 58, borderRadius: '50%', background: cur.col, display: 'grid', placeItems: 'center', fontSize: 32}}>{cur.icon}</span>
          <div style={{position: 'absolute', bottom: -16, left: 40, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '18px solid #fff'}} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- one scene (diorama), camera + crossfade ----------
const SceneView: React.FC<{sc: Scene; t: number; sacred: SacredSpan[]}> = ({sc, t, sacred}) => {
  const fade = 0.25;
  const op = Math.min(interpolate(t, [sc.start - fade, sc.start + fade], [0, 1], clamp), interpolate(t, [sc.end - fade, sc.end + fade], [1, 0], clamp));
  if (op <= 0) return null;
  const cam = sc.camera?.from ? sc.camera : undefined;
  const ck = cam ? interpolate(t, [sc.start, sc.end], [0, 1], {...clamp, easing: EASE.inOut}) : 0;
  const z = cam ? cam.from.zoom + (cam.to.zoom - cam.from.zoom) * ck : 1;
  const cx = cam ? cam.from.x + (cam.to.x - cam.from.x) * ck : 540;
  const cy = cam ? cam.from.y + (cam.to.y - cam.from.y) * ck : 1300;
  const bg = animate(sc.motion, 'bg', t);
  const card = sc.elements.find((e) => e.type === 'ayah_card' || e.type === 'hadith_card');
  return (
    <AbsoluteFill style={{opacity: op, transform: `translateX(${(1 - op) * 50 * (Number(sc.id.replace(/\D/g, '')) % 2 ? 1 : -1)}px)`}}>
      <Paper mood={sc.background.mood} kind={sc.background.kind} light={bg.light} t={t} />
      <AbsoluteFill style={{WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, transparent 560px, #000 660px)'}}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <BrandDefs />
          <g transform={`translate(540 1300) scale(${z}) translate(${-cx} ${-cy}) translate(540 1560) scale(1.18) translate(-540 -1560)`}>
            {sc.elements.filter((e) => !e.type.endsWith('_card') && e.type !== 'rope' && !TOP.has(e.type)).map((e) => {
              const a = animate(sc.motion, e.id, t);
              const idle = IDLE[e.type]?.(t) ?? '';
              return <g key={e.id} opacity={a.opacity} transform={`translate(${(a.x ?? e.x) + a.dx} ${e.y + a.dy}) scale(${(e.scale ?? 1) * a.scale}) ${idle}`}><ElementShape e={e} t={t} progress={a.light} /></g>;
            })}
            {sc.characters.map((c) => {
              const a = animate(sc.motion, c.id, t);
              const sh = animate(sc.motion, `${c.id}.shadow`, t);
              return <CharacterView key={c.id} c={c} t={t} a={a} reach={sh.reach} />;
            })}
            {sc.elements.filter((e) => TOP.has(e.type)).map((e) => {
              const a = animate(sc.motion, e.id, t);
              const idle = IDLE[e.type]?.(t) ?? '';
              return <g key={e.id} opacity={a.opacity} transform={`translate(${e.x + a.dx} ${e.y + a.dy}) scale(${(e.scale ?? 1) * a.scale}) ${idle}`}><ElementShape e={e} t={t} progress={a.light} /></g>;
            })}
          </g>
        </svg>
      </AbsoluteFill>
      {card && <SacredCard span={sacred.find((s) => s.id === card.span) ?? {id: '', type: 'quran'}} a={animate(sc.motion, card.id, t)} />}
    </AbsoluteFill>
  );
};

// ---------- hook: frame 0 is never empty; it holds ~1 s then rises away and the captions take its place ----------
const Hook: React.FC<{sb: Storyboard; t: number}> = ({sb, t}) => {
  const h = sb.template.hook as Storyboard['template']['hook'] & {persist?: boolean; accent?: string};
  const k = interpolate(t, [h.end, h.end + 0.55], [0, 1], {...clamp, easing: EASE.in});
  if (k >= 1 && !h.persist) return null;
  const bgOp = interpolate(t, [h.end, h.end + 0.5], [1, 0], {...clamp, easing: EASE.in});
  const breathe = 1 + 0.025 * Math.min(1, t / Math.max(0.1, h.end));
  const words = h.text.split(' ');
  const accent = new Set((h.accent ?? '').split(' ').filter(Boolean));
  return (
    <>
      {bgOp > 0 && <AbsoluteFill style={{background: `linear-gradient(180deg, ${h.bg} 0%, #FBF5EA 78%)`, opacity: bgOp}} />}
      <div style={{position: 'absolute', left: 60, right: 60, top: 470 - 520 * k, textAlign: 'center', direction: 'rtl', opacity: 1 - k, transform: `scale(${breathe * (1 - 0.25 * k)})`}}>
        <svg width={150} height={120} viewBox="-60 -50 120 100" style={{display: 'block', margin: '0 auto 14px'}}><BrandDefs /><BHeart s={1.6} glow={0.8} /></svg>
        <div style={{fontFamily: 'Alexandria', fontWeight: 800, fontSize: 108, lineHeight: 1.28}}>
          {words.map((w, i) => <span key={i} style={{color: accent.has(w) || (!accent.size && i >= words.length / 2) ? B.coral : B.ink}}>{w} </span>)}
        </div>
      </div>
    </>
  );
};

const Outro: React.FC<{sb: Storyboard; t: number}> = ({sb, t}) => {
  const o = sb.template.outro;
  if (t < o.start - 0.1) return null;
  const k = interpolate(t, [o.start, o.start + 0.6], [0, 1], {...clamp, easing: EASE.out});
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: 760, textAlign: 'center', direction: 'rtl', opacity: k, transform: `translateY(${(1 - k) * 28}px)`}}>
      <div style={{fontFamily: 'Alexandria', fontWeight: 800, fontSize: 96, color: B.sageD, lineHeight: 1.35}}>{o.shareLine}</div>
      <div style={{position: 'fixed', left: 0, right: 0, top: 1800, fontFamily: 'Alexandria', fontWeight: 600, fontSize: 40, color: B.goldD}}>{o.channel}</div>
    </div>
  );
};

export const Reel: React.FC<ReelProps> = ({storyboard: sb, sacred, audio}) => {
  useFonts();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const capTop = 236;
  return (
    <AbsoluteFill style={{background: B.paper}}>
      {sb.scenes.map((sc) => <SceneView key={sc.id} sc={sc} t={t} sacred={sacred} />)}
      {/* captions start only once the hook has left, so the two never overlap */}
      <div style={{opacity: interpolate(t, [sb.template.hook.end + 0.45, sb.template.hook.end + 0.75], [0, 1], clamp)}}><Captions caps={sb.captions} t={t} top={capTop} /></div>
      <Hook sb={sb} t={t} />
      <Outro sb={sb} t={t} />
      <Logo />
      <Mascot t={t} sb={sb} />
      {audio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
