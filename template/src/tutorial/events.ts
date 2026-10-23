// The narrated tutorial's event engine: narration/timeline.json (built by tools/narrate.py from the
// real TTS audio) -> every visual event in frames. Pure (no React, no DOM), so scripts can import it
// too: scripts/tutorial-events.ts writes the presses and keystrokes for the sound mix from here.
import TL from '../../narration/timeline.json';

export const FPS = TL.fps;
export const TOTAL = TL.frames;
export const fr = (s: number) => Math.round(s * FPS);

type Raw = {
  cam?: string;
  hl?: string;
  label?: string;
  cur?: string;
  act?: string;
  at?: number;
  set?: Record<string, unknown>;
  key?: string;
  text?: string;
  nav?: string;
};
export type Beat = Raw & {
  id: string;
  say: string;
  show: string;
  scene: string;
  start: number;
  end: number;
  voiceStart: number;
  voiceEnd: number;
  audio: string;
  marks: (Raw & { t: number; word: string })[];
  subs: { text: string; start: number; end: number }[];
};
export const BEATS = TL.beats as unknown as Beat[];
export const SCENES = TL.scenes as { id: string; title: string; tag: string; start: number; end: number }[];

export const PRESS_LEAD = 0.15; // a press keyed to a word lands just after the word starts
export const TRAVEL = 0.62; // s the cursor takes to reach a target
export const TYPE_FPC = 4; // frames per typed character (15 characters a second, a calm hand)

export type Cam = { f: number; name: string };
export type Hl = { f: number; target: string | null; label?: string };
export type Set = { f: number; key: string; value: unknown };
export type Typing = { f: number; key: string; text: string };
export type Move = { a: number; b: number; target: string; kind: 'press' | 'hover' | 'type'; page: string };

export const CAMS: Cam[] = [];
export const HLS: Hl[] = [];
export const SETS: Set[] = [];
export const TYPES: Typing[] = [];
export const MOVES: Move[] = [];

let page = 'login';
const act = (r: Raw, t: number, beatStart: number) => {
  // t: when this directive fires (the beat's start, or the frame its mark word is spoken)
  if (r.cam) CAMS.push({ f: fr(t), name: r.cam });
  if (r.hl !== undefined) HLS.push({ f: fr(t), target: r.hl, label: r.label });
  const target = r.nav ? `side.${r.nav}` : r.cur;
  if (target) {
    const kind = (r.nav ? 'press' : r.act ?? 'hover') as Move['kind'];
    const p = r.at !== undefined ? beatStart + r.at : t === beatStart ? t + 0.9 : t + PRESS_LEAD;
    const at = fr(p);
    MOVES.push({ a: at - fr(TRAVEL), b: at, target, kind, page });
    if (r.nav) {
      page = r.nav;
      SETS.push({ f: at + 1, key: 'page', value: r.nav });
    }
    for (const [k, v] of Object.entries(r.set ?? {})) SETS.push({ f: at + 2, key: k, value: v });
    if (kind === 'type' && r.key && r.text !== undefined) {
      SETS.push({ f: at + 1, key: r.key, value: '' });
      TYPES.push({ f: at + fr(0.15), key: r.key, text: r.text });
    }
  } else {
    for (const [k, v] of Object.entries(r.set ?? {})) SETS.push({ f: fr(t), key: k, value: v });
  }
};

for (const b of BEATS) {
  const { marks, ...rest } = b;
  if (rest.hl === undefined) HLS.push({ f: fr(b.start), target: null }); // a beat without its own highlight clears it
  act(rest, b.start, b.start);
  for (const m of marks) act(m, m.t, b.start);
}
const byF = <T extends { f: number }>(a: T, c: T) => a.f - c.f;
CAMS.sort(byF);
HLS.sort(byF);
SETS.sort(byF);
TYPES.sort(byF);
MOVES.sort((a, c) => a.b - c.b);

/** State value of `key` at frame F, and the frame it last changed (each typed character counts). */
export const stateAt = (F: number, key: string): { v: unknown; since: number } => {
  let v: unknown = undefined;
  let since = -1e9;
  for (const s of SETS) {
    if (s.f > F) break;
    if (s.key === key) {
      v = s.value;
      since = s.f;
    }
  }
  for (const t of TYPES) {
    if (t.f > F) break;
    if (t.key === key && t.f >= since) {
      const n = Math.min(t.text.length, Math.floor((F - t.f) / TYPE_FPC) + 1);
      v = t.text.slice(0, n);
      since = t.f + (n - 1) * TYPE_FPC;
    }
  }
  return { v, since };
};

/** Every press frame (sound: click) and every keystroke frame (sound: key), for the mix. */
export const soundEvents = () => {
  const ev: { f: number; kind: 'click' | 'key'; id: string }[] = [];
  for (const m of MOVES) if (m.kind !== 'hover') ev.push({ f: m.b, kind: 'click', id: m.target });
  for (const t of TYPES) [...t.text].forEach((ch, i) => ch !== ' ' && ev.push({ f: t.f + i * TYPE_FPC, kind: 'key', id: `${t.key}:${i}` }));
  return ev.sort((a, b) => a.f - b.f);
};

/** The beat (and scene) playing at frame F. */
export const beatAt = (F: number) => BEATS.find((b) => F >= fr(b.start) && F < fr(b.end)) ?? BEATS[BEATS.length - 1];
export const sceneAt = (F: number) => SCENES.find((s) => F >= fr(s.start) && F < fr(s.end)) ?? SCENES[SCENES.length - 1];

// self-check: every press lands inside the film and the beats are in order
if (MOVES.some((m) => m.a < 0 || m.b >= TOTAL)) throw new Error('events: a cursor move falls outside the film');
if (BEATS.some((b, i) => i > 0 && b.start < BEATS[i - 1].start)) throw new Error('events: beats out of order');
