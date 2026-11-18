import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import '@fontsource/alexandria/arabic-500.css';
import '@fontsource/alexandria/arabic-600.css';
import '@fontsource/alexandria/arabic-700.css';
import '@fontsource/alexandria/arabic-800.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/amiri-quran/arabic-400.css';

// Fonts are bundled from npm (no network at render time). Rendering waits until every face is loaded.
const FACES = ['500 40px Alexandria', '600 40px Alexandria', '700 40px Alexandria', '800 40px Alexandria', '400 40px Amiri', '700 40px Amiri', '400 40px "Amiri Quran"'];
let ready: Promise<unknown> | null = null;

export const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    ready ??= Promise.all(FACES.map((f) => document.fonts.load(f, 'بسم الله')));
    ready.then(() => continueRender(handle)).catch(() => continueRender(handle));
  }, [handle]);
};
