// Storyboard format shared by the pipeline (Python), the linter, the dashboard and the Remotion engine.
// Coordinates: 1080×1920 canvas; characters and elements are anchored bottom-centre on their ground line (y).

export type View = 'front' | 'back' | 'side';
export type Pose = 'stand' | 'walk' | 'dua' | 'sad' | 'happy' | 'sit' | 'point' | 'pull' | 'sujood' | 'pray';
export type CharacterKind = 'salik' | 'old_man' | 'young' | 'child' | 'poor' | 'woman' | 'sahabi' | 'crowd';
export type Ease = 'out' | 'in' | 'inOut' | 'spring' | 'linear';
export type StyleId = 'hawiya' | 'flat' | 'night-silhouette' | 'anime' | 'calm-ayat' | string;

export interface Character {
  id: string;
  kind: CharacterKind;
  name?: string;               // never a prophet; the linter blocks it
  x: number; y: number; scale?: number; flip?: boolean;
  view: View; pose: Pose;
  action?: 'present' | 'climb' | 'look_ahead' | 'walk' | 'pull' | 'want' | 'pray' | 'sit';
  target?: string;             // element id he wants / looks at
  aim?: number;                // degrees above horizontal toward the facing side (back view), computed from target
  light?: number;              // «نور القلب» 0..1 — only on meaningful moments
  dim?: number;                // grey heart: heedless
  mood?: 'righteous' | 'heedless' | 'wrongdoer' | 'neutral';
  shadow?: { reach: number; toward?: string; y?: number };  // the nafs; ground only
  faceLight?: boolean;         // sahaba: face hidden in light
  look?: Record<string, unknown>;
}

export interface Element {
  id: string;
  type: string;                // house, sack, coins, lantern, quran, palm, mat, grave, flat, car, villa, plane, yacht,
                               // mountain, valley, ladder, conveyor, kaaba, rope, ayah_card, hadith_card, chart, icon …
  x: number; y: number; scale?: number; w?: number; h?: number;
  label?: string; fontSize?: number;
  span?: string;               // sacred span id for ayah_card / hadith_card
  from?: { character: string; part: 'hand' };   // ropes
  to?: string;
  overlapOk?: boolean; overlapWith?: string[];
  why?: string;                // which spoken word it illustrates
}

export interface Motion {
  target: string;              // character / element id, 'camera', 'caption', 'bg'
  prop: 'x' | 'y' | 'scale' | 'opacity' | 'rotate' | 'camera' | 'light' | 'reach' | 'tint';
  from: number; to: number;
  start: number; dur: number;  // seconds, absolute
  ease: Ease;
  phase: 'enter' | 'exit' | 'move';
  layer: 'primary' | 'secondary' | 'background';
  sfx?: string;                // tied sound (step, lift, place, whoosh, pop) — removed automatically in sacred zones
  pause?: boolean;
}

export interface Scene {
  id: string;
  start: number; end: number;
  role?: 'intro' | 'story' | 'climax' | 'sacred' | 'outro';
  meaning: string;             // the spoken sentence this scene explains
  words: [number, number];     // transcript word range
  background: { kind: 'paper' | 'sky' | 'room' | 'desert' | 'city' | 'night' | 'dawn'; mood?: 'calm' | 'warm' | 'cold' | 'dark' };
  camera?: { from: { zoom: number; x: number; y: number }; to: { zoom: number; x: number; y: number }; ease: Ease };
  characters: Character[];
  elements: Element[];
  motion: Motion[];
  lightReason?: string;
  transition?: 'crossfade' | 'cut' | 'slide';
}

export interface CaptionWord { w: string; t: number; end: number; key?: boolean; sacred?: string; color?: 'ink' | 'coral' | 'gold' }
export interface Caption { start: number; end: number; words: CaptionWord[] }

export interface Storyboard {
  version: 1;
  meta: { title: string; slug: string; style: StyleId; duration: number; voiceDuration: number; fps: number; speaker?: string; goal?: string };
  settings: { womenAllowed: boolean };
  template: {
    hook: { text: string; start: 0; end: number; bg: string; icon?: string };
    mascot: { like: number; comment: number; share: number };
    outro: { shareLine: string; channel: string; start: number };
  };
  scenes: Scene[];
  captions: Caption[];
  sfx: { t: number; kind: string; gain: number }[];
}
