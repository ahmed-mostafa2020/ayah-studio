import React from 'react';
import {B, BHeart, Look, SALIK} from './Brand';

// Extra library items drawn with the same light recipe as Brand.tsx (light from top-left, soft contact shadow, no outlines).
const contact = (w: number) => <ellipse cx={8} cy={4} rx={w} ry={12} fill="url(#bContact)" />;

export const PVilla: React.FC = () => (<g>{contact(200)}
  <path d="M-170 0 V-200 H140 V0 Z" fill="url(#bWall)" /><path d="M140 0 V-200 L185 -180 V0 Z" fill="url(#bWallS)" />
  <path d="M-190 -196 L-15 -270 L160 -196 Z" fill="#C8574A" /><path d="M160 -196 L-15 -270 L205 -180 Z" fill="#A9453B" />
  {[-130, -60, 40, 100].map((x) => <rect key={x} x={x} y={-160} width={36} height={50} rx={18} fill={B.goldL} opacity={0.85} />)}
  <path d="M-40 0 V-90 Q-40 -120 -10 -122 Q20 -120 20 -90 V0 Z" fill="url(#bWood)" />
  <rect x={-180} y={-8} width={380} height={8} fill="#C7AB86" /></g>);

export const PPlane: React.FC = () => (<g transform="translate(0 -60)">
  <path d="M-160 0 Q-150 -26 -100 -28 L120 -28 Q170 -24 170 0 Q170 22 120 24 L-100 24 Q-150 22 -160 0 Z" fill="url(#bWhite)" />
  <path d="M-20 -24 L40 -100 L70 -100 L40 -24 Z M-20 22 L40 90 L70 90 L40 22 Z" fill={B.skyD} />
  <path d="M-150 -6 L-180 -60 L-150 -60 L-120 -18 Z" fill={B.skyD} />
  {[-60, -30, 0, 30, 60, 90].map((x) => <circle key={x} cx={x} cy={-6} r={7} fill={B.sky} />)}</g>);

export const PYacht: React.FC = () => (<g>{contact(170)}
  <path d="M-170 -40 L170 -40 L130 0 L-140 0 Z" fill="url(#bWhite)" /><path d="M-90 -40 L-60 -100 L90 -100 L120 -40 Z" fill="#EDE6D8" />
  {[-50, -10, 30, 70].map((x) => <rect key={x} x={x} y={-88} width={26} height={22} rx={4} fill={B.sky} />)}
  <path d="M-170 -40 L170 -40" stroke={B.gold} strokeWidth={5} /></g>);

export const PMountain: React.FC = () => (<g>
  <path d="M-260 0 L-90 -330 L20 -150 L110 -420 L260 0 Z" fill="#C9B79A" />
  <path d="M-90 -330 L-40 -230 L-120 -240 Z M110 -420 L160 -300 L70 -320 Z" fill="#FFFDF8" opacity={0.85} />
  <path d="M110 -420 L260 0 L150 0 L60 -220 Z" fill="#000" opacity={0.08} /></g>);

export const PValley: React.FC = () => (<g><path d="M-300 0 Q-150 -160 0 -40 Q150 -160 300 0 Z" fill="#BFA77E" /><path d="M-300 0 Q-150 -120 0 -20 Q150 -120 300 0 Z" fill="url(#bGround)" /></g>);

export const PLadder: React.FC<{h?: number}> = ({h = 520}) => (<g>{contact(50)}
  <path d={`M-44 0 L-30 ${-h} M44 0 L30 ${-h}`} stroke="url(#bWood)" strokeWidth={12} strokeLinecap="round" />
  {Array.from({length: Math.floor(h / 60)}).map((_, i) => <path key={i} d={`M${-42 + i * 1.2} ${-30 - i * 60} H${42 - i * 1.2}`} stroke="#9A6E46" strokeWidth={9} strokeLinecap="round" />)}</g>);

export const PConveyor: React.FC<{t?: number}> = ({t = 0}) => (<g>{contact(260)}
  <rect x={-260} y={-60} width={520} height={44} rx={22} fill="#7F8896" /><rect x={-250} y={-54} width={500} height={10} rx={5} fill="#A8B0BC" />
  {Array.from({length: 9}).map((_, i) => <circle key={i} cx={-220 + ((i * 55 + t * 80) % 440)} cy={-38} r={12} fill="#5C6470" />)}</g>);

export const PKaaba: React.FC = () => (<g>{contact(150)}
  <path d="M-120 0 V-240 H90 V0 Z" fill="#1F1F24" /><path d="M90 0 V-240 L130 -222 V0 Z" fill="#0F0F13" />
  <path d="M-120 -180 H90 L130 -164 V-150 L90 -166 H-120 Z" fill="url(#bGold)" />
  <path d="M-40 0 V-80 H0 V0 Z" fill="url(#bGold)" opacity={0.85} /></g>);

export const PHourglass: React.FC = () => (<g transform="translate(0 -70)">
  <circle r={78} fill="#fff" opacity={0.6} />
  <path d="M-40 -60 H40 M-40 60 H40" stroke="url(#bWood)" strokeWidth={10} strokeLinecap="round" />
  <path d="M-32 -54 Q-30 -10 0 0 Q30 -10 32 -54 Z M-32 54 Q-30 10 0 0 Q30 10 32 54 Z" fill="#FDF6E3" stroke={B.goldD} strokeWidth={3} />
  <path d="M-20 -40 Q0 -20 20 -40 Z M-26 50 Q0 20 26 50 Z" fill={B.gold} /></g>);

export const PSack2 = null;

// A person in sujood, side view facing right (flip for left). Featureless, nothing drawn in front of him.
export const PersonSujood: React.FC<{x: number; y: number; look: Look; flip?: boolean; light?: number}> = ({x, y, look, flip, light = 0}) => {
  const s = look.s ?? 1;
  const cloak = look.cloak ?? look.robe;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={20} cy={4} rx={150} ry={14} fill="url(#bContact)" />
      <path d="M-120 -6 Q-130 -90 -70 -120 Q0 -140 60 -80 Q90 -50 100 -10 L-110 -2 Z" fill={look.robe} />
      <path d="M-120 -6 Q-128 -80 -76 -114 Q-30 -130 10 -112 Q-40 -90 -60 -6 Z" fill={cloak} />
      <path d="M40 -60 Q80 -40 110 -6" stroke={cloak} strokeWidth={22} strokeLinecap="round" fill="none" />
      <ellipse cx={118} cy={-4} rx={16} ry={7} fill="url(#bSkin)" />
      <ellipse cx={96} cy={-34} rx={26} ry={24} fill="url(#bSkin)" />
      {look.head === 'turban' || look.head === 'kufi' ? <path d="M78 -52 Q96 -66 118 -48 Q110 -36 96 -40 Q84 -40 78 -52 Z" fill="url(#bWhite)" /> : null}
      {light > 0.01 && <BHeart x={10} y={-80} s={0.7} glow={light} />}
      <path d="M-118 -10 Q-126 -80 -74 -112" stroke="#fff" strokeOpacity={0.3} strokeWidth={3.5} fill="none" />
    </g>
  );
};

// The nafs: Salik's own shadow, on the ground only, stretching toward what he wants.
export const NafsShadow: React.FC<{x: number; y: number; reach: number; dir: 1 | -1; t: number; s?: number}> = ({x, y, reach, dir, t, s = 1}) => {
  if (reach <= 4) return <ellipse cx={x + 10} cy={y + 4} rx={80 * s} ry={14 * s} fill="#5E4E70" opacity={0.35} />;
  const wob = Math.sin(t * 3) * 4;
  const L = reach;
  return (
    <g transform={`translate(${x} ${y + 4}) scale(${dir} 1)`}>
      <path d={`M-40 0 Q${L * 0.4} ${-14 + wob} ${L - 30} -8 Q${L + 6} -6 ${L} 2 Q${L * 0.5} ${16 - wob} -40 10 Z`} fill="#5E4E70" opacity={0.42} />
      {/* fingers curling at the tip, on the ground */}
      {[-10, -2, 6].map((dy, i) => <path key={i} d={`M${L - 14} ${dy} q${16 + i * 2} ${-4} ${22 + i * 2} 6`} stroke="#5E4E70" strokeOpacity={0.45} strokeWidth={6} strokeLinecap="round" fill="none" />)}
    </g>
  );
};

// Fixed cast: same body and light, different clothes/age. Mood recolours (meaning dictionary).
export const lookFor = (kind: string, mood?: string): Look => {
  const moodCloak = mood === 'heedless' ? 'url(#bGrey)' : mood === 'wrongdoer' ? 'url(#bPlum)' : undefined;
  switch (kind) {
    case 'salik': return {...SALIK, cloak: moodCloak ?? SALIK.cloak, trim: mood === 'heedless' ? '#AEB4BE' : SALIK.trim};
    case 'old_man': return {robe: 'url(#bCream)', cloak: moodCloak ?? 'url(#bBrown)', beard: '#EDE8DE', head: 'turban', staff: true, s: 0.96};
    case 'young': return {robe: 'url(#bCream)', cloak: moodCloak ?? '#7F93A8', beard: '#3A2A1E', head: 'kufi'};
    case 'child': return {robe: 'url(#bCream)', head: 'kufi', s: 0.62};
    case 'poor': return {robe: '#C9B79A', beard: '#5A4636', head: 'kufi', patch: true, s: 0.95};
    case 'sahabi': return {robe: 'url(#bCream)', cloak: 'url(#bBrown)', head: 'shemagh', beard: '#3A2A1E'};
    case 'woman': return {robe: '#8C7BA0', head: 'hijab'};
    default: return {robe: 'url(#bCream)', cloak: moodCloak ?? '#A9906E', beard: '#4A3426', head: 'kufi'};
  }
};

// ---------- recipe pieces ----------
export const PPath: React.FC<{w?: number}> = ({w = 1000}) => (<g>
  <rect x={-w / 2} y={-4} width={w} height={14} rx={7} fill="#E3B27C" opacity={0.6} />
  {Array.from({length: Math.floor(w / 70)}).map((_, i) => <rect key={i} x={-w / 2 + 20 + i * 70} y={0} width={38} height={6} rx={3} fill="#fff" opacity={0.85} />)}</g>);

// thought bubble: rounded cloud + two small circles toward the thinker (tailDir: -1 = tail to the left)
export const PThought: React.FC<{label: string; fontSize?: number; w?: number; tailDir?: number}> = ({label, fontSize = 56, w, tailDir = -1}) => {
  const W = w ?? Math.max(240, label.length * fontSize * 0.55 + 110);
  const H = fontSize * 1.9 + 50;
  return (<g>
    <ellipse cx={0} cy={-H / 2} rx={W / 2} ry={H / 2} fill="#FFFDF8" stroke={B.ink} strokeWidth={5} />
    <circle cx={tailDir * (W / 2 - 30)} cy={22} r={16} fill="#FFFDF8" stroke={B.ink} strokeWidth={4} />
    <circle cx={tailDir * (W / 2 - 4)} cy={56} r={9} fill="#FFFDF8" stroke={B.ink} strokeWidth={4} />
    <text x={0} y={-H / 2 + fontSize * 0.36} textAnchor="middle" direction="rtl" fontFamily="Alexandria" fontWeight={800} fontSize={fontSize} fill={B.ink}>{label}</text>
  </g>);
};

export const PSign: React.FC<{label: string; fontSize?: number}> = ({label, fontSize = 50}) => {
  const W = Math.max(190, label.length * fontSize * 0.6 + 60);
  return (<g>{contact(40)}
    <rect x={-6} y={-300} width={12} height={300} rx={6} fill={B.ink} />
    <rect x={-W / 2} y={-300} width={W} height={fontSize * 1.7} rx={12} fill={B.sage} stroke="#fff" strokeWidth={4} />
    <text x={0} y={-300 + fontSize * 1.18} textAnchor="middle" direction="rtl" fontFamily="Alexandria" fontWeight={800} fontSize={fontSize} fill="#fff">{label}</text></g>);
};

export const PBadge: React.FC<{label: string}> = ({label}) => (<g transform="translate(0 -48)">
  <circle r={48} fill="url(#bGold)" /><circle r={40} fill="none" stroke="#FFF6D6" strokeWidth={3} />
  <text y={18} textAnchor="middle" fontFamily="Alexandria" fontWeight={800} fontSize={54} fill={B.ink}>{label}</text></g>);

// rising chart: axes + line that draws itself (progress 0..1) + arrow head
export const PChart: React.FC<{progress?: number; trend?: string}> = ({progress = 1, trend = 'up'}) => {
  const pts = trend === 'up' ? [[-220, -40], [-120, -90], [-40, -70], [60, -170], [140, -150], [220, -300]] : [[-220, -300], [-120, -220], [-40, -240], [60, -130], [140, -150], [220, -40]];
  const n = Math.max(1, Math.round(progress * (pts.length - 1)));
  const shown = pts.slice(0, n + 1);
  const last = shown[shown.length - 1];
  return (<g>
    <rect x={-260} y={-340} width={520} height={360} rx={24} fill="#FFFDF8" opacity={0.9} />
    <path d="M-230 -320 V0 H240" stroke={B.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
    <polyline points={shown.map((p) => p.join(',')).join(' ')} fill="none" stroke={trend === 'up' ? B.coral : '#6C7482'} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={last[0]} cy={last[1]} r={14} fill={trend === 'up' ? B.coral : '#6C7482'} /></g>);
};

export const PXMark: React.FC = () => (<g transform="translate(0 -110)">
  <circle r={100} fill="#fff" opacity={0.55} />
  <path d="M-62 -62 L62 62 M62 -62 L-62 62" stroke="#C8574A" strokeWidth={26} strokeLinecap="round" /></g>);

// gold filling the valley between two mountains (sharp gold shine = the dunya)
export const PGoldValley: React.FC = () => (<g>
  <path d="M-150 0 L0 -160 L150 0 Z" fill="url(#bGold)" />
  <path d="M-150 0 L0 -160 L20 -130 L-110 0 Z" fill="#FBE29A" opacity={0.6} />
  {[[-40, -110], [50, -70], [0, -150]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M0 -14 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="#FFF6D6" />)}</g>);
