// Brand tokens: the only place a colour, face or type size is written down.
//
// TUTORIAL TEMPLATE: read every value off the live site (devtools colour picker or computed styles)
// before rendering: sidebar, work surface, cards, the accent of the active tab / primary button.
// The keys below are the ones the tutorial engine and src/ui/kit.tsx use; keep them all.
import type React from 'react';
import { safeInsets } from '../lib/safe';
import { H, W } from '../timeline';

export const C = {
  stage: '#0B0D12', // the dark stage the app window floats on, and the lower subtitle band
  ink: '#14161D', // the sidebar, type on light surfaces
  ink2: '#20232C', // raised surfaces on ink (the band's chapter tag)
  paper: '#F2F4F7', // the app's work surface
  white: '#FFFFFF', // cards, tables, modals
  mist: '#E9ECF1', // chips, inputs, table header
  line: '#DCE0E7', // hairlines and table rules
  mute: '#646B78', // secondary text on light surfaces
  side: '#A3A9B6', // sidebar text on ink, the end-card URL
  accent: '#2F6BFF', // the site's own accent: active tab, primary button, focus ring, highlight ring
  accentSoft: '#E6EEFF', // the accent's soft ground (selected chip, soft button)
  green: '#138A52',
  greenSoft: '#E3F4EA',
  red: '#D93B42', // delete, errors
  redSoft: '#FCE8E9',
};

export const FONT = {
  text: '"Geist Variable", system-ui, sans-serif', // the film's one sans, for every role; typeStyle and measure.ts read it
  mono: '"Geist Mono Variable", ui-monospace, monospace',
};

/** Faces the FontGate waits for before anything renders or measures (one entry per weight in use). */
export const FACES = ['400 16px "Geist Variable"', '500 16px "Geist Variable"', '600 16px "Geist Variable"', '700 16px "Geist Variable"'];

/** Layout unit: 1 at 1080p, scales every size with the short side of the frame (16:9, 9:16, 1:1). */
export const U = Math.min(W, H) / 1080;

// One token per role, reused everywhere, so nothing is "almost matched" (size in px at 1080p).
export const TYPE = {
  display: { size: 120, weight: 700, track: -0.04, lead: 1.0 }, // the wordmark
  line: { size: 60, weight: 600, track: -0.02, lead: 1.1 }, // the chapter caption in the lower band
  secondary: { size: 44, weight: 500, track: -0.01, lead: 1.15 }, // the URL, the intro chain
  tag: { size: 30, weight: 600, track: -0.005, lead: 1.2 }, // the section name in the band's pill
  ui: { size: 24, weight: 500, track: -0.01, lead: 1.3 }, // smallest readable size on screen
};

/** CSS for a type role at a size (px). Tabular figures always, so numbers never jitter in width. */
export const typeStyle = (role: keyof typeof TYPE, size = TYPE[role].size * U): React.CSSProperties => ({
  fontFamily: FONT.text,
  fontSize: size,
  fontWeight: TYPE[role].weight,
  letterSpacing: `${TYPE[role].track}em`,
  lineHeight: TYPE[role].lead,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'pre',
});

/**
 * Safe margins for a w x h frame as a symmetric envelope: the larger inset of each pair from the
 * frame's safe-zone preset (src/lib/safe.ts), so a centred layout that fits inside clears every
 * side. 96 x 64 px at 1920x1080; 120 x 420 at 1080x1920, where the feed zones are asymmetric
 * (use safeBox() from lib/safe.ts there to centre on the clear band instead of the frame).
 */
export const safeArea = (w: number, h: number) => {
  const i = safeInsets(undefined, w, h);
  return { x: Math.max(i.left, i.right), y: Math.max(i.top, i.bottom) };
};
/** The film's safe margins; text stays inside them (scripts/layout-audit.sh checks). */
export const SAFE = safeArea(W, H);
