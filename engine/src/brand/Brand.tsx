import React from 'react';

// «آية لمست قلبي» brand kit — palette, defs, characters and props (soft-3D, light from top-left).
export const B = {
  paper: '#FBF5EA', paper2: '#F2E8D6', ink: '#22304A', gold: '#D9A441', goldL: '#F3D27A', goldD: '#A87522',
  sky: '#AFCDE6', skyD: '#7FA8CC', sage: '#4E9C8B', sageD: '#2F6F62', coral: '#E07A5F', soft: '#E8DBC5', leaf: '#8FA36A',
};

export const BrandDefs: React.FC = () => (
  <defs>
    <linearGradient id="bCream" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFDF8" /><stop offset="0.55" stopColor="#F1EADC" /><stop offset="1" stopColor="#CFC4B2" /></linearGradient>
    <linearGradient id="bSage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6BB8A6" /><stop offset="0.6" stopColor="#4E9C8B" /><stop offset="1" stopColor="#2F6F62" /></linearGradient>
    <linearGradient id="bGrey" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B8BEC8" /><stop offset="0.6" stopColor="#959DAA" /><stop offset="1" stopColor="#6C7482" /></linearGradient>
    <linearGradient id="bBrown" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#A9805E" /><stop offset="0.6" stopColor="#8A6446" /><stop offset="1" stopColor="#5E4230" /></linearGradient>
    <linearGradient id="bPlum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7C6A8E" /><stop offset="0.6" stopColor="#5E4E70" /><stop offset="1" stopColor="#3E3250" /></linearGradient>
    <linearGradient id="bSkyG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C7DCEE" /><stop offset="0.6" stopColor="#9FC0DE" /><stop offset="1" stopColor="#6F95BA" /></linearGradient>
    <radialGradient id="bSkin" cx="0.38" cy="0.35" r="0.75"><stop offset="0" stopColor="#F6D7B8" /><stop offset="0.7" stopColor="#DDB08A" /><stop offset="1" stopColor="#B88762" /></radialGradient>
    <radialGradient id="bWhite" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.7" stopColor="#EDE6D8" /><stop offset="1" stopColor="#C9BFAE" /></radialGradient>
    <linearGradient id="bGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE29A" /><stop offset="0.5" stopColor="#D9A441" /><stop offset="1" stopColor="#A87522" /></linearGradient>
    <radialGradient id="bGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFF4CF" stopOpacity="0.95" /><stop offset="0.4" stopColor="#F3D27A" stopOpacity="0.55" /><stop offset="1" stopColor="#F3D27A" stopOpacity="0" /></radialGradient>
    <radialGradient id="bContact" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#2A1D12" stopOpacity="0.38" /><stop offset="1" stopColor="#2A1D12" stopOpacity="0" /></radialGradient>
    <linearGradient id="bWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B07E52" /><stop offset="1" stopColor="#7A5232" /></linearGradient>
    <linearGradient id="bWall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F1DFC2" /><stop offset="1" stopColor="#CDB290" /></linearGradient>
    <linearGradient id="bWallS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#BFA27E" /><stop offset="1" stopColor="#9C805F" /></linearGradient>
    <linearGradient id="bSack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E3CB9E" /><stop offset="1" stopColor="#A98B5E" /></linearGradient>
    <linearGradient id="bGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EFD9B6" /><stop offset="1" stopColor="#D8B98C" /></linearGradient>
  </defs>
);

// The brand heart (same shape family as the logo), used as «نور القلب» and as a badge.
export const BHeart: React.FC<{x?: number; y?: number; s?: number; glow?: number; dim?: boolean}> = ({x = 0, y = 0, s = 1, glow = 1, dim}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {!dim && <circle r={46} fill="url(#bGlow)" opacity={glow} />}
    <path d="M0 16 C-30 -4 -24 -30 0 -18 C24 -30 30 -4 0 16 Z" fill={dim ? '#8C8F98' : 'url(#bGold)'} stroke={dim ? '#6B6F7A' : B.goldD} strokeWidth={2} />
    {!dim && <path d="M-14 -16 Q-20 -8 -16 0" stroke="#FFF6D6" strokeWidth={3} fill="none" strokeLinecap="round" />}
  </g>
);

export type Look = {robe: string; cloak?: string; trim?: string; beard?: string; head?: 'turban' | 'kufi' | 'hijab' | 'shemagh'; staff?: boolean; patch?: boolean; scarf?: boolean; s?: number};
export type Pose = 'stand' | 'walk' | 'dua' | 'sad' | 'happy' | 'sit' | 'point' | 'pull';
export const SALIK: Look = {robe: 'url(#bCream)', cloak: 'url(#bSage)', trim: B.gold, beard: '#4A3426', head: 'turban', scarf: true};

// Balanced proportions: shoulders ≈ 2 head-widths, head ≈ 1/7 of height, gently tapered robe.
export type View = 'front' | 'back' | 'side';
export const Person: React.FC<{x: number; y: number; look: Look; pose?: Pose; light?: number; dim?: number; t?: number; flip?: boolean; view?: View; aim?: number}> =
  ({x, y, look, pose = 'stand', light = 0, dim = 0, t = 0, flip, view = 'front', aim}) => {
  if (view === 'back') return <PersonBack x={x} y={y} look={look} pose={pose} light={light} t={t} flip={flip} aim={aim} />;
  if (view === 'side') return <PersonSide x={x} y={y} look={look} pose={pose} light={light} t={t} flip={flip} />;
  const s = look.s ?? 1;
  const br = Math.sin(t * 2) * 1.5;
  const sit = pose === 'sit';
  const step = pose === 'walk' ? Math.sin(t * 5) : 0;
  const headTilt = pose === 'sad' ? 16 : 0;
  const armL = pose === 'dua' ? 58 : pose === 'happy' ? 40 : pose === 'walk' ? step * 14 : pose === 'sad' ? -4 : 0;
  const armR = pose === 'point' ? 86 : pose === 'dua' ? 58 : pose === 'happy' ? 40 : pose === 'walk' ? -step * 14 : pose === 'sad' ? -4 : 0;
  const lean = pose === 'sad' ? 4 : pose === 'point' ? 7 : 0;
  const top = sit ? -230 : -300;
  const sleeve = look.cloak ?? look.robe;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={10} cy={4} rx={sit ? 110 : 80} ry={14} fill="url(#bContact)" />
      <g transform={`rotate(${lean} 0 ${top})`}>
        {!sit && <><ellipse cx={-18 + step * 10} cy={-4} rx={20} ry={9} fill="#6B4B33" /><ellipse cx={20 - step * 10} cy={-4} rx={20} ry={9} fill="#6B4B33" /></>}
        {sit ? (
          <path d={`M-96 -2 Q-100 -60 -48 -70 Q-46 -170 -44 ${top} Q0 ${top - 14 + br} 44 ${top} Q46 -170 48 -70 Q100 -60 96 -2 Z`} fill={look.robe} />
        ) : (
          <path d={`M-52 -8 Q-58 -160 -44 ${top} Q0 ${top - 16 + br} 44 ${top} Q58 -160 52 -8 Z`} fill={look.robe} />
        )}
        <path d={`M-14 ${top + 20} Q-18 -150 -12 -14 M16 ${top + 26} Q22 -150 14 -14`} stroke="#000" strokeOpacity={0.07} strokeWidth={5} fill="none" />
        {look.patch && <><rect x={-34} y={-120} width={26} height={22} rx={4} fill="#B49A72" stroke="#7D6748" strokeWidth={3} /><rect x={12} y={-200} width={22} height={20} rx={4} fill="#A88E66" stroke="#7D6748" strokeWidth={3} /></>}
        {look.cloak && <>
          <path d={`M-56 -10 Q-66 -170 -48 ${top} Q-28 ${top - 18} -12 ${top - 6} Q-28 -170 -26 -10 Z`} fill={look.cloak} />
          <path d={`M56 -10 Q66 -170 48 ${top} Q28 ${top - 18} 12 ${top - 6} Q28 -170 26 -10 Z`} fill={look.cloak} />
          {look.trim && <path d={`M-12 ${top - 6} Q-28 -170 -26 -10 M12 ${top - 6} Q28 -170 26 -10`} stroke={look.trim} strokeWidth={5} fill="none" />}
        </>}
        {look.scarf && <><path d={`M-30 ${top - 4} Q0 ${top + 10} 30 ${top - 4} L32 ${top + 6} Q0 ${top + 22} -32 ${top + 6} Z`} fill="url(#bGold)" /><path d={`M20 ${top + 4} Q28 ${top + 50} 24 ${top + 100} L15 ${top + 100} Q18 ${top + 50} 12 ${top + 8} Z`} fill="url(#bGold)" /></>}
        {look.staff && <path d="M70 -160 L80 0" stroke="#7A5A3A" strokeWidth={8} strokeLinecap="round" />}
        {pose === 'dua' ? (<>
          {[-1, 1].map((d) => (<g key={d}>
            <path d={`M${d * 46} ${top} Q${d * 62} ${top + 50} ${d * 50} ${top + 96} L${d * 34} ${top + 92} Q${d * 44} ${top + 50} ${d * 34} ${top + 14} Z`} fill={sleeve} />
            <path d={`M${d * 42} ${top + 92} Q${d * 40} ${top + 60} ${d * 22} ${top + 40}`} stroke={sleeve} strokeWidth={20} strokeLinecap="round" fill="none" />
            <ellipse cx={d * 16} cy={top + 30} rx={13} ry={9} fill="url(#bSkin)" transform={`rotate(${d * -25} ${d * 16} ${top + 30})`} />
          </g>))}
        </>) : (<>
        <g transform={`rotate(${armL} -44 ${top + 8})`}><path d={`M-46 ${top} Q-66 ${top + 70} -62 ${top + 140} L-44 ${top + 140} Q-46 ${top + 70} -34 ${top + 14} Z`} fill={sleeve} /><circle cx={-53} cy={top + 150} r={12} fill="url(#bSkin)" /></g>
        <g transform={`rotate(${-armR} 44 ${top + 8})`}><path d={`M46 ${top} Q66 ${top + 70} 62 ${top + 140} L44 ${top + 140} Q46 ${top + 70} 34 ${top + 14} Z`} fill={sleeve} /><circle cx={53} cy={top + 150} r={12} fill="url(#bSkin)" /></g>
        </>)}
        {light > 0.01 && <BHeart x={-8} y={top + 70} s={0.8 + 0.3 * light + 0.04 * Math.sin(t * 3)} glow={light} />}
        {dim > 0.01 && <g opacity={dim}><BHeart x={-8} y={top + 70} s={0.8} dim /></g>}
        <g transform={`rotate(${headTilt} 0 ${top - 8})`}>
          <rect x={-10} y={top - 20} width={20} height={18} rx={7} fill="#C99A72" />
          <ellipse cx={0} cy={top - 46} rx={26} ry={31} fill="url(#bSkin)" />
          {look.beard && <path d={`M-26 ${top - 46} Q-26 ${top - 8} 0 ${top - 2} Q26 ${top - 8} 26 ${top - 46} Q19 ${top - 28} 0 ${top - 26} Q-19 ${top - 28} -26 ${top - 46} Z`} fill={look.beard} />}
          {look.head === 'turban' && <><path d={`M-29 ${top - 52} Q-31 ${top - 92} 0 ${top - 95} Q31 ${top - 92} 29 ${top - 52} Q17 ${top - 63} 0 ${top - 63} Q-17 ${top - 63} -29 ${top - 52} Z`} fill="url(#bWhite)" /><path d={`M-26 ${top - 66} Q0 ${top - 80} 26 ${top - 66}`} stroke="#C9BFAE" strokeWidth={3} fill="none" /><path d={`M24 ${top - 56} Q38 ${top - 34} 32 ${top - 8}`} stroke="#EDE6D8" strokeWidth={9} fill="none" strokeLinecap="round" /></>}
          {look.head === 'kufi' && <path d={`M-26 ${top - 54} Q-26 ${top - 84} 0 ${top - 86} Q26 ${top - 84} 26 ${top - 54} Z`} fill="url(#bWhite)" />}
          {look.head === 'shemagh' && <path d={`M-34 ${top - 22} Q-40 ${top - 88} 0 ${top - 92} Q40 ${top - 88} 34 ${top - 22} L22 ${top - 48} Q0 ${top - 58} -22 ${top - 48} Z`} fill="url(#bWhite)" />}
          {look.head === 'hijab' && <path d={`M-36 ${top + 4} Q-44 ${top - 90} 0 ${top - 94} Q44 ${top - 90} 36 ${top + 4} Q26 ${top + 20} 0 ${top + 22} Q-26 ${top + 20} -36 ${top + 4} Z`} fill={look.robe} />}
          <path d={`M-18 ${top - 66} Q-25 ${top - 48} -20 ${top - 28}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </g>
        <path d={`M-52 -14 Q-58 -160 -44 ${top + 4}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={3.5} fill="none" />
      </g>
    </g>
  );
};

// ---------- props (same light recipe) ----------
const shadow = (w: number) => <ellipse cx={8} cy={4} rx={w} ry={12} fill="url(#bContact)" />;
export const PHouse: React.FC = () => (<g>{shadow(150)}<path d="M-120 0 V-180 H90 V0 Z" fill="url(#bWall)" /><path d="M90 0 V-180 L130 -160 V0 Z" fill="url(#bWallS)" /><rect x={-128} y={-192} width={226} height={16} fill="#C7AB86" /><path d="M-40 0 V-92 Q-40 -122 -10 -124 Q20 -122 20 -92 V0 Z" fill="url(#bWood)" /><circle cx={8} cy={-50} r={4} fill={B.gold} /><rect x={-100} y={-150} width={36} height={40} rx={18} fill={B.goldL} opacity={0.85} /><rect x={44} y={-150} width={30} height={36} rx={4} fill="#8C6A4A" /></g>);
export const PSack: React.FC = () => (<g>{shadow(70)}<path d="M-60 0 Q-80 -80 -36 -112 L-18 -130 Q0 -138 18 -130 L36 -112 Q80 -80 60 0 Z" fill="url(#bSack)" /><path d="M-22 -126 Q0 -112 22 -126" stroke="#8C7048" strokeWidth={6} fill="none" /><path d="M-30 -96 Q-46 -60 -34 -20" stroke="#fff" strokeOpacity={0.35} strokeWidth={4} fill="none" /></g>);
export const PCoins: React.FC = () => (<g>{shadow(80)}<path d="M-80 0 Q-60 -60 0 -70 Q60 -60 80 0 Z" fill="url(#bGold)" />{[[-40, -30], [0, -46], [36, -26], [-12, -12], [20, -8]].map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx={16} ry={9} fill="#E7B54A" stroke={B.goldL} strokeWidth={2} /></g>)}<path d="M-6 -80 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 Z" fill="#FFF6D6" /></g>);
export const PLantern: React.FC = () => (<g><circle cx={0} cy={-60} r={70} fill="url(#bGlow)" /><path d="M0 -130 V-112" stroke={B.ink} strokeWidth={4} /><path d="M-22 -112 H22 L28 -96 H-28 Z" fill="url(#bGold)" /><path d="M-26 -96 Q-34 -50 -22 -20 H22 Q34 -50 26 -96 Z" fill="#FBE7A8" stroke={B.goldD} strokeWidth={3} /><path d="M-22 -20 H22 L16 -6 H-16 Z" fill="url(#bGold)" /></g>);
export const PQuran: React.FC = () => (<g>{shadow(80)}<path d="M-70 0 L0 -40 L70 0 L60 6 L0 -28 L-60 6 Z" fill="url(#bWood)" /><path d="M-64 -40 L0 -66 L64 -40 L0 -20 Z" fill="#2F6F62" /><path d="M-64 -40 L0 -20 L0 -12 L-64 -32 Z" fill="#245A50" /><path d="M64 -40 L0 -20 L0 -12 L64 -32 Z" fill="#3A8576" /><path d="M-30 -46 L0 -56 L30 -46 L0 -36 Z" fill="none" stroke={B.gold} strokeWidth={2.5} /></g>);
export const PPalm: React.FC = () => (<g>{shadow(60)}<path d="M-10 0 Q-4 -150 8 -300 L20 -300 Q10 -150 10 0 Z" fill="url(#bWood)" />{[-80, -40, 0, 40, 85, 130].map((a, i) => <path key={i} d="M14 -300 Q70 -340 140 -290 Q70 -312 14 -296 Z" fill={i % 2 ? '#6E8B4E' : '#8FA36A'} transform={`rotate(${a} 14 -300)`} />)}</g>);
export const PGrave: React.FC = () => (<g>{shadow(170)}<path d="M-170 0 Q0 -110 170 0 Z" fill="#9E8467" /><path d="M-130 -14 Q0 -86 130 -14" stroke="#B9A07F" strokeWidth={5} fill="none" /><rect x={-28} y={-150} width={56} height={120} rx={14} fill="url(#bGrey)" /></g>);
export const PMat: React.FC = () => (<g>{shadow(110)}<path d="M-110 0 L-80 -50 L80 -50 L110 0 Z" fill="#9C3D3A" /><path d="M-96 -6 L-72 -44 L72 -44 L96 -6 Z" fill="none" stroke={B.goldL} strokeWidth={3} /><path d="M-30 -44 Q0 -64 30 -44" fill="none" stroke={B.goldL} strokeWidth={3} /></g>);
export const PFlat: React.FC = () => (<g>{shadow(90)}<rect x={-70} y={-180} width={140} height={180} fill="url(#bSkyG)" /><path d="M70 0 V-180 L96 -168 V0 Z" fill="#6F95BA" />{[0, 1, 2, 3].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={-50 + c * 60} y={-160 + r * 40} width={40} height={26} rx={3} fill="#FDF6E3" />))}</g>);
export const PCar: React.FC = () => (<g>{shadow(130)}<path d="M-120 -30 Q-110 -70 -60 -78 L40 -78 Q80 -76 100 -40 L125 -34 Q135 -10 125 0 L-125 0 Q-132 -20 -120 -30 Z" fill="#C8574A" /><path d="M-120 -30 Q-110 -70 -60 -78 L40 -78" stroke="#fff" strokeOpacity={0.35} strokeWidth={4} fill="none" /><path d="M-50 -70 L30 -70 L60 -40 L-70 -40 Z" fill="#CFE3F2" /><circle cx={-70} cy={2} r={22} fill={B.ink} /><circle cx={70} cy={2} r={22} fill={B.ink} /></g>);

// ---------- Mascot (same boy as before, restyled to the brand: soft 3D + logo colours) ----------
export const BMascot: React.FC<{wave?: number; t?: number}> = ({wave = 0.5}) => {
  const ink = B.ink;
  return (
    <g>
      <ellipse cx={8} cy={252} rx={110} ry={16} fill="url(#bContact)" />
      <path d="M-80 250 Q-90 120 -55 70 L55 70 Q90 120 80 250 Z" fill="url(#bCream)" />
      <path d="M-80 250 Q-90 120 -55 70" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} fill="none" />
      <path d="M0 74 V170" stroke="#D9D0BF" strokeWidth={4} /><circle cx={0} cy={100} r={5} fill={B.gold} /><circle cx={0} cy={126} r={5} fill={B.gold} />
      <BHeart x={-40} y={110} s={0.55} glow={0.5} />
      <g transform={`rotate(${-20 + wave * 30} -60 90)`}>
        <path d="M-58 74 Q-96 70 -112 86 L-104 108 Q-88 96 -56 106 Z" fill="url(#bCream)" />
        <path d="M-110 84 L-102 110" stroke="#D9D0BF" strokeWidth={4} />
        <g transform="translate(-128 92) rotate(-25)">
          <ellipse cx={0} cy={0} rx={20} ry={22} fill="url(#bSkin)" />
          {[[-15, -26, -14], [-5, -32, -4], [6, -31, 6], [16, -24, 16]].map(([x, y, a], i) => <rect key={i} x={x - 5.5} y={y - 14} width={11} height={30} rx={5.5} fill="url(#bSkin)" transform={`rotate(${a} ${x} ${y + 10})`} />)}
          <rect x={14} y={-2} width={11} height={24} rx={5.5} fill="url(#bSkin)" transform="rotate(-55 18 10)" />
          <path d="M-9 -8 Q0 -2 9 -8" stroke="#C48E68" strokeWidth={2} fill="none" />
          {[[-15, -38], [-5, -45], [6, -44], [16, -36]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={3.2} ry={2.4} fill="#F8E2CC" />)}
        </g>
      </g>
      <path d="M58 78 Q96 80 112 90 L106 108 Q88 102 58 106 Z" fill="url(#bCream)" />
      <path d="M106 86 L102 110" stroke="#D9D0BF" strokeWidth={4} />
      <g transform="translate(130 96)">
        <rect x={-22} y={-14} width={44} height={46} rx={14} fill="url(#bSkin)" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={-8} y={-10 + i * 10.5} width={32} height={10} rx={5} fill="url(#bSkin)" stroke="#C48E68" strokeWidth={1.4} />)}
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={20} cy={-5 + i * 10.5} rx={2.6} ry={2} fill="#F8E2CC" />)}
        <path d="M-16 -10 Q-22 -46 -6 -52 Q6 -54 6 -40 L4 -12 Z" fill="url(#bSkin)" />
        <ellipse cx={-5} cy={-46} rx={4.5} ry={3.5} fill="#F8E2CC" />
        <path d="M-14 -14 Q-6 -10 2 -14" stroke="#C48E68" strokeWidth={2} fill="none" />
      </g>
      <circle cx={0} cy={0} r={78} fill="url(#bSkin)" />
      <circle cx={-78} cy={10} r={13} fill="#D9A983" /><circle cx={78} cy={10} r={13} fill="#D9A983" />
      <path d="M-74 -26 Q-72 -92 0 -94 Q72 -92 74 -26 Z" fill="url(#bWhite)" />
      <path d="M-74 -30 H74" stroke="url(#bGold)" strokeWidth={13} />
      <path d="M-60 -30 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6" stroke="#FFF3C9" strokeWidth={3} fill="none" />
      <g transform="translate(0 12)">
        <ellipse cx={-26} cy={6} rx={11} ry={14} fill={ink} /><ellipse cx={26} cy={6} rx={11} ry={14} fill={ink} />
        <circle cx={-22} cy={0} r={4} fill="#fff" /><circle cx={30} cy={0} r={4} fill="#fff" />
        <path d="M-40 -18 Q-27 -26 -14 -19 M14 -19 Q27 -26 40 -18" stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />
        <ellipse cx={-44} cy={30} rx={13} ry={8} fill="#F59A9A" opacity={0.5} /><ellipse cx={44} cy={30} rx={13} ry={8} fill="#F59A9A" opacity={0.5} />
        <path d="M-20 34 Q0 56 20 34 Z" fill="#8A2E3B" />
      </g>
      <path d="M-50 -50 Q-62 -20 -56 10" stroke="#fff" strokeOpacity={0.4} strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  );
};

// ---------- back view (seen from behind: no face, turban tail down the back) ----------
const PersonBack: React.FC<{x: number; y: number; look: Look; pose: Pose; light: number; t: number; flip?: boolean; aim?: number}> = ({x, y, look, pose, light, t, flip, aim}) => {
  const s = look.s ?? 1;
  const step = pose === 'walk' ? Math.sin(t * 5) : 0;
  const armL = pose === 'happy' ? 150 : pose === 'walk' ? step * 12 : 0;
  const lean = pose === 'point' ? 6 : 0;
  const armR = aim !== undefined ? 90 + aim + lean : pose === 'point' ? 86 : pose === 'happy' ? 150 : pose === 'walk' ? -step * 12 : 0;
  const top = -300;
  const cloak = look.cloak ?? look.robe;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={10} cy={4} rx={80} ry={14} fill="url(#bContact)" />
      <g transform={`rotate(${lean} 0 ${top})`}>
        <ellipse cx={-18 + step * 8} cy={-4} rx={20} ry={9} fill="#5E4230" /><ellipse cx={20 - step * 8} cy={-4} rx={20} ry={9} fill="#5E4230" />
        <path d={`M-52 -10 Q-58 -160 -44 ${top} Q0 ${top - 16} 44 ${top} Q58 -160 52 -10 Z`} fill={look.robe} />
        {look.cloak && <path d={`M-58 -14 Q-68 -170 -48 ${top - 2} Q0 ${top - 20} 48 ${top - 2} Q68 -170 58 -14 Q0 -4 -58 -14 Z`} fill={cloak} />}
        {look.trim && <path d="M-58 -14 Q0 -4 58 -14" stroke={look.trim} strokeWidth={5} fill="none" />}
        <path d={`M-10 ${top + 10} Q-14 -160 -8 -20`} stroke="#000" strokeOpacity={0.08} strokeWidth={6} fill="none" />
        {look.staff && <path d="M66 -160 L76 0" stroke="#7A5A3A" strokeWidth={8} strokeLinecap="round" />}
        <g transform={`rotate(${armL} -44 ${top + 8})`}><path d={`M-46 ${top} Q-66 ${top + 70} -62 ${top + 140} L-44 ${top + 140} Q-46 ${top + 70} -34 ${top + 14} Z`} fill={cloak} /><circle cx={-53} cy={top + 150} r={12} fill="url(#bSkin)" /></g>
        <g transform={`rotate(${-armR} 44 ${top + 8})`}><path d={`M46 ${top} Q66 ${top + 70} 62 ${top + 140} L44 ${top + 140} Q46 ${top + 70} 34 ${top + 14} Z`} fill={cloak} /><circle cx={53} cy={top + 150} r={12} fill="url(#bSkin)" /></g>
        {light > 0.01 && <circle cx={0} cy={top + 70} r={60 + 30 * light} fill="url(#bGlow)" opacity={0.5 * light} />}
        <rect x={-10} y={top - 20} width={20} height={18} rx={7} fill="#B88762" />
        <ellipse cx={0} cy={top - 44} rx={26} ry={30} fill="#3A2A1E" />
        {look.head === 'turban' && <><path d={`M-29 ${top - 44} Q-31 ${top - 92} 0 ${top - 95} Q31 ${top - 92} 29 ${top - 44} Q0 ${top - 34} -29 ${top - 44} Z`} fill="url(#bWhite)" /><path d={`M-24 ${top - 62} Q0 ${top - 74} 24 ${top - 62} M-27 ${top - 50} Q0 ${top - 62} 27 ${top - 50}`} stroke="#C9BFAE" strokeWidth={3} fill="none" /><path d={`M4 ${top - 38} Q10 ${top} 2 ${top + 40}`} stroke="#EDE6D8" strokeWidth={14} fill="none" strokeLinecap="round" /></>}
        {look.head === 'kufi' && <path d={`M-26 ${top - 50} Q-26 ${top - 84} 0 ${top - 86} Q26 ${top - 84} 26 ${top - 50} Z`} fill="url(#bWhite)" />}
        {look.head === 'shemagh' && <path d={`M-34 ${top - 10} Q-40 ${top - 88} 0 ${top - 92} Q40 ${top - 88} 34 ${top - 10} Q0 ${top} -34 ${top - 10} Z`} fill="url(#bWhite)" />}
        {look.head === 'hijab' && <path d={`M-36 ${top + 10} Q-44 ${top - 90} 0 ${top - 94} Q44 ${top - 90} 36 ${top + 10} Q0 ${top + 24} -36 ${top + 10} Z`} fill={look.robe} />}
        <path d={`M-52 -14 Q-58 -160 -44 ${top + 4}`} stroke="#fff" strokeOpacity={0.3} strokeWidth={3.5} fill="none" />
      </g>
    </g>
  );
};

// ---------- side view (profile facing right; flip to face left). Featureless: beard silhouette only ----------
const PersonSide: React.FC<{x: number; y: number; look: Look; pose: Pose; light: number; t: number; flip?: boolean}> = ({x, y, look, pose, light, t, flip}) => {
  const s = look.s ?? 1;
  const walking = pose === 'walk';
  const step = walking ? Math.sin(t * 5) : 0;
  const top = -300;
  const cloak = look.cloak ?? look.robe;
  const lean = pose === 'pull' ? SIDE_PULL.lean : pose === 'sad' ? 6 : pose === 'point' ? 8 : walking ? 4 : pose === 'happy' ? -14 : 0;
  const head = pose === 'sad' ? 24 : 0;
  const armNear = pose === 'pull' ? SIDE_PULL.near : pose === 'point' ? -88 : pose === 'happy' ? -150 : pose === 'dua' ? -70 : walking ? step * 26 : 0;
  const armFar = pose === 'pull' ? SIDE_PULL.far : pose === 'happy' ? -150 : pose === 'dua' ? -70 : walking ? -step * 26 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={4} cy={4} rx={70} ry={13} fill="url(#bContact)" />
      <g transform={`rotate(${lean} 0 -10)`}>
        <g transform={`rotate(${armFar} 4 ${top + 10})`}><path d={`M-6 ${top + 4} Q-14 ${top + 70} -8 ${top + 140} L10 ${top + 140} Q12 ${top + 70} 16 ${top + 10} Z`} fill={cloak} opacity={0.75} /><circle cx={1} cy={top + 148} r={11} fill="#C99A72" /></g>
        <path d={`M${-10 + step * 22} -2 q22 -14 44 0 q-22 6 -44 0 Z`} fill="#5E4230" />
        <path d={`M${-10 - step * 22} -2 q22 -14 44 0 q-22 6 -44 0 Z`} fill="#6B4B33" />
        <path d={`M-36 -8 Q-44 -150 -30 ${top} Q4 ${top - 14} 30 ${top + 4} Q40 -150 ${44 + step * 8} -8 Z`} fill={look.robe} />
        {look.cloak && <path d={`M-42 -12 Q-52 -160 -34 ${top - 2} Q-8 ${top - 14} 6 ${top} Q-10 -150 -6 -12 Z`} fill={cloak} />}
        {look.trim && <path d={`M6 ${top} Q-10 -150 -6 -12`} stroke={look.trim} strokeWidth={5} fill="none" />}
        {look.scarf && <path d={`M-20 ${top - 2} Q8 ${top + 6} 26 ${top} L28 ${top + 10} Q24 ${top + 60} 30 ${top + 100} L20 ${top + 100} Q14 ${top + 60} 18 ${top + 12} Q4 ${top + 16} -20 ${top + 10} Z`} fill="url(#bGold)" />}
        {look.staff && <path d={`M40 -170 L52 0`} stroke="#7A5A3A" strokeWidth={8} strokeLinecap="round" />}
        {light > 0.01 && <circle cx={22} cy={top + 70} r={40 + 26 * light} fill="url(#bGlow)" opacity={0.8 * light} />}
        <g transform={`rotate(${head} 0 ${top - 6})`}>
          <rect x={-8} y={top - 20} width={18} height={18} rx={7} fill="#C99A72" />
          <ellipse cx={4} cy={top - 46} rx={25} ry={30} fill="url(#bSkin)" />
          <path d={`M26 ${top - 50} Q32 ${top - 44} 27 ${top - 38}`} fill="#DDB08A" />
          {look.beard && <path d={`M-6 ${top - 30} Q-2 ${top + 2} 20 ${top} Q32 ${top - 10} 28 ${top - 34} Q14 ${top - 26} -6 ${top - 30} Z`} fill={look.beard} />}
          {look.head === 'turban' && <><path d={`M-24 ${top - 46} Q-26 ${top - 92} 6 ${top - 94} Q34 ${top - 90} 30 ${top - 52} Q8 ${top - 64} -24 ${top - 46} Z`} fill="url(#bWhite)" /><path d={`M-20 ${top - 66} Q6 ${top - 80} 28 ${top - 68}`} stroke="#C9BFAE" strokeWidth={3} fill="none" /><path d={`M-20 ${top - 50} Q-34 ${top - 20} -28 ${top + 20}`} stroke="#EDE6D8" strokeWidth={12} fill="none" strokeLinecap="round" /></>}
          {look.head === 'kufi' && <path d={`M-22 ${top - 54} Q-22 ${top - 84} 4 ${top - 86} Q30 ${top - 84} 30 ${top - 54} Z`} fill="url(#bWhite)" />}
          {look.head === 'shemagh' && <path d={`M-30 ${top - 4} Q-36 ${top - 90} 6 ${top - 92} Q36 ${top - 88} 30 ${top - 56} L12 ${top - 60} Q-6 ${top - 58} -14 ${top - 20} Z`} fill="url(#bWhite)" />}
          {look.head === 'hijab' && <path d={`M-30 ${top + 10} Q-38 ${top - 90} 6 ${top - 94} Q38 ${top - 88} 32 ${top - 20} Q30 ${top + 6} 10 ${top + 14} Z`} fill={look.robe} />}
        </g>
        <g transform={`rotate(${armNear} 6 ${top + 12})`}><path d={`M-4 ${top + 4} Q-12 ${top + 70} -6 ${top + 140} L14 ${top + 140} Q16 ${top + 70} 20 ${top + 10} Z`} fill={cloak} /><circle cx={4} cy={top + 150} r={12} fill="url(#bSkin)" /></g>
        <path d={`M-36 -12 Q-44 -150 -30 ${top + 6}`} stroke="#fff" strokeOpacity={0.3} strokeWidth={3.5} fill="none" />
      </g>
    </g>
  );
};

// pulling a rope (side view, facing right): leaning back, both arms forward
const SIDE_PULL = {lean: -12, near: -78, far: -84};
const rot = (px: number, py: number, cx: number, cy: number, deg: number) => {
  const a = (deg * Math.PI) / 180, dx = px - cx, dy = py - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};
/** where the near hand of a side-view 'pull' person is, in screen coords (so ropes start exactly in the hand) */
export const sideHand = (x: number, y: number, s: number, flip = false) => {
  const top = -300;
  let [hx, hy] = rot(4, top + 150, 6, top + 12, SIDE_PULL.near);
  [hx, hy] = rot(hx, hy, 0, -10, SIDE_PULL.lean);
  return [x + (flip ? -hx : hx) * s, y + hy * s];
};
