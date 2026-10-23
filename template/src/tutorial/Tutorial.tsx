import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, TYPE } from '../brand/tokens';
import { Cursor, cursorArc, pressAt } from '../fx/Cursor';
import { Words } from '../fx/Words';
import { clamp, E, mix, prog } from '../lib/anim';
import { camera, lc, type Shot, toScreen } from '../lib/camera';
import { FontGate } from '../lib/FontGate';
import { measureTracked } from '../lib/measure';
import { beatAt, CAMS, fr, HLS, MOVES, SCENES, sceneAt, stateAt } from './events';
import { App, LOGO, rect, SITE, stOf, WIN, type R } from './screens';

// The narrated tutorial: one continuous take over the rebuilt app. The camera frames whatever the
// narrator is talking about (a named element's rect), a ring marks it, the cursor presses it, and
// the lower band carries the narration as subtitles. Every frame is a pure function of F through
// the event engine (events.ts), which is built from the real TTS timings.

const W = 1920;
const H = 1080;
const VIEW_H = 864;
const BAND_Y = VIEW_H;

// ---- camera ----------------------------------------------------------------------------------------
const WIDE: Shot = { ax: WIN.w / 2, ay: WIN.h / 2, sx: W / 2, sy: 440, k: 1 };
const LOGO_SHOT: Shot = { ax: LOGO.cx, ay: LOGO.cy, sx: W / 2, sy: 400, k: 4 };
const LOGO_END: Shot = { ax: LOGO.cx, ay: LOGO.cy, sx: W / 2, sy: 340, k: 4 };
const CAM_DUR = 54;

const pageAt = (F: number) => (stateAt(F, 'page').v as string) ?? 'login';

/** Frame a world rect: as large as fits (k 1.2-2.1), and once zoomed past the window, never past its edges. */
const frame = (r: R): Shot => {
  let k = Math.min((0.9 * W) / r.w, (0.95 * VIEW_H) / r.h, 2.1);
  if (k < 1.1) return WIDE;
  k = Math.max(k, 1.2); // 1.2x already covers the whole viewport: no stage sliver at the frame edge
  const vw = W / k;
  const vh = VIEW_H / k;
  const ax = clamp(r.x + r.w / 2, vw / 2, WIN.w - vw / 2);
  const ay = clamp(r.y + r.h / 2, vh / 2, WIN.h - vh / 2);
  return { ax, ay, sx: W / 2, sy: VIEW_H / 2, k };
};
const shotNamed = (name: string, F: number): Shot => {
  if (name === 'wide') return WIDE;
  if (name === 'logo') return LOGO_SHOT;
  if (name === 'logo.end') return LOGO_END;
  return frame(rect(pageAt(F), name, stOf(F)));
};
const camStart = new Map<number, Shot>();
/** Shot at F: each camera event blends from wherever the previous blend was when it fired. */
const shotAt = (F: number): Shot => {
  let i = -1;
  for (let j = 0; j < CAMS.length; j++) if (CAMS[j].f <= F) i = j;
  if (i < 0) return LOGO_SHOT;
  const c = CAMS[i];
  let from = camStart.get(i);
  if (!from) {
    from = i === 0 ? LOGO_SHOT : shotAt(c.f - 1);
    camStart.set(i, from);
  }
  return lc(from, shotNamed(c.name, F), prog(F, c.f, c.f + CAM_DUR, E.smooth));
};
/** How much of the frame is the logo-only intro/end card (the app body fades with it). */
const logoness = (F: number) => {
  let i = -1;
  for (let j = 0; j < CAMS.length; j++) if (CAMS[j].f <= F) i = j;
  const w = (k: number) => (k < 0 || CAMS[k].name.startsWith('logo') ? 1 : 0);
  return i < 0 ? 1 : mix(w(i - 1), w(i), prog(F, CAMS[i].f, CAMS[i].f + CAM_DUR, E.smooth));
};

// ---- highlight ---------------------------------------------------------------------------------------
const Ring: React.FC<{ r: R; o: number; label?: string; k: number }> = ({ r, o, label, k }) => {
  const pad = 6;
  const bw = 3 / Math.sqrt(k); // the ring reads the same weight at every zoom
  const s = 1.04 - 0.04 * o;
  const lw = label ? measureTracked(label, 15, 600, 0) + 22 : 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: o, transformOrigin: `${r.x + r.w / 2}px ${r.y + r.h / 2}px`, transform: `scale(${s})` }}>
      <div style={{ position: 'absolute', left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, borderRadius: 12, boxShadow: `inset 0 0 0 ${bw}px ${C.accent}` }} />
      <div style={{ position: 'absolute', left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, borderRadius: 12, background: C.accent, opacity: 0.07 }} />
      {label && (
        <div style={{ position: 'absolute', left: r.x - pad, top: r.y - pad - 34, height: 28, width: lw, borderRadius: 14, background: C.accent }}>
          <span data-ui="label" style={{ position: 'absolute', left: 11, top: 0, lineHeight: '28px', fontFamily: FONT.text, fontSize: 15, fontWeight: 600, color: C.white, whiteSpace: 'pre' }}>
            {label}
          </span>
        </div>
      )}
    </div>
  );
};
const Highlights: React.FC<{ F: number; k: number }> = ({ F, k }) => {
  let i = -1;
  for (let j = 0; j < HLS.length; j++) if (HLS[j].f <= F) i = j;
  if (i < 0) return null;
  const cur = HLS[i];
  const prev = i > 0 ? HLS[i - 1] : undefined;
  const inn = prog(F, cur.f, cur.f + 10, E.ui);
  const out = 1 - prog(F, cur.f, cur.f + 8, E.smooth);
  const page = pageAt(F);
  const s = stOf(F);
  const safe = (t: string | null) => {
    if (!t) return null;
    try {
      return rect(page, t, s);
    } catch {
      return null; // a target on the page that just left: let it go
    }
  };
  const pr = prev && prev.target !== cur.target ? safe(prev.target) : null;
  const cr = safe(cur.target);
  return (
    <>
      {pr && out > 0 && <Ring r={pr} o={out} k={k} label={prev?.label} />}
      {cr && <Ring r={cr} o={prev?.target === cur.target ? 1 : inn} k={k} label={cur.label} />}
    </>
  );
};

// ---- cursor --------------------------------------------------------------------------------------------
const RETREAT = { x: 30, y: 26 };
const cursorAt = (F: number) => {
  let pos = { x: 700, y: 560 };
  let press = 0;
  let kind: 'arrow' | 'ibeam' = 'arrow';
  for (const m of MOVES) {
    if (F < m.a) break;
    const r = rect(pageAt(m.b), m.target, stOf(m.b));
    const to = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const t = prog(F, m.a, m.b, E.glide);
    pos = t >= 1 ? to : cursorArc(pos, to, t, 0.16);
    press = Math.max(press, m.kind === 'hover' ? 0 : pressAt(F, m.b));
    kind = m.kind === 'type' && F >= m.b - 4 && F < m.b + 120 ? 'ibeam' : 'arrow';
    const back = m.kind === 'press' ? prog(F, m.b + 14, m.b + 46, E.outSoft) : 0;
    if (back > 0) pos = { x: pos.x + RETREAT.x * back, y: pos.y + RETREAT.y * back };
  }
  const first = MOVES[0]?.a ?? 0;
  const o = prog(F, first - 12, first, E.smooth) * (1 - logoness(F));
  return { pos, press, kind, o };
};

// ---- lower band --------------------------------------------------------------------------------------
const CHAPTERS = SCENES.filter((s) => s.tag);
const SUB_X = 520;
const Band: React.FC<{ F: number }> = ({ F }) => {
  const t = F / 60;
  const sc = sceneAt(F);
  const b = beatAt(F);
  const sub = b.subs.find((c) => t >= c.start - 0.05 && t < c.end + 0.25);
  const subO = sub ? prog(t, sub.start - 0.05, sub.start + 0.1, E.linear) * (1 - prog(t, sub.end + 0.1, sub.end + 0.25, E.linear)) : 0;
  const tagO = sc.tag ? prog(F, fr(sc.start), fr(sc.start) + 18, E.smooth) * (1 - prog(F, fr(sc.end) - 12, fr(sc.end), E.smooth)) : 0;
  const tagSize = TYPE.tag.size * 0.9;
  const tagW = sc.tag ? measureTracked(sc.tag, tagSize, TYPE.tag.weight, TYPE.tag.track) + 64 : 0;
  const gap = 8;
  const segW = (W - 192 - gap * (CHAPTERS.length - 1)) / CHAPTERS.length;
  const showBar = prog(F, fr(CHAPTERS[0].start), fr(CHAPTERS[0].start) + 20, E.smooth) * (1 - prog(F, fr(CHAPTERS[CHAPTERS.length - 1].end), fr(CHAPTERS[CHAPTERS.length - 1].end) + 20, E.smooth));
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      <div style={{ position: 'absolute', left: 0, top: BAND_Y, width: W, height: H - BAND_Y, background: C.stage }} />
      {CHAPTERS.map((c, j) => {
        const fill = prog(F, fr(c.start), fr(c.end), E.linear);
        const now = F >= fr(c.start) && F < fr(c.end);
        return (
          <div key={c.id} style={{ position: 'absolute', left: 96 + j * (segW + gap), top: BAND_Y + 26, width: segW, height: 4, borderRadius: 2, background: C.ink2, opacity: showBar, overflow: 'hidden' }}>
            <div style={{ width: segW, height: 4, background: now ? C.accent : C.side, transformOrigin: '0 0', transform: `scaleX(${fill})` }} />
          </div>
        );
      })}
      {tagO > 0 && (
        <div style={{ position: 'absolute', left: 96, top: BAND_Y + 112 - 28, width: tagW, height: 56, borderRadius: 28, background: C.ink2, opacity: tagO }}>
          <div style={{ position: 'absolute', left: 24, top: 23, width: 10, height: 10, borderRadius: 5, background: C.accent }} />
          <span data-ui="tag" style={{ position: 'absolute', left: 46, top: 0, lineHeight: '56px', fontFamily: FONT.text, fontSize: tagSize, fontWeight: TYPE.tag.weight, color: C.white, whiteSpace: 'pre' }}>
            {sc.tag}
          </span>
        </div>
      )}
      {sub && subO > 0 && (
        <div
          data-text={`sub:${b.id}`}
          style={{ position: 'absolute', left: sc.tag ? SUB_X : 96, top: BAND_Y + 112, transform: 'translateY(-50%)', width: W - (sc.tag ? SUB_X : 96) - 96, opacity: subO, fontFamily: FONT.text, fontSize: 34, fontWeight: 500, lineHeight: 1.3, color: C.white, whiteSpace: 'pre-line' }}
        >
          {sub.text}
        </div>
      )}
    </div>
  );
};

/** A small, permanent note that the screens are a rebuilt mock-up with demo data (honesty: the viewer must not mistake it for live data). */
const MockNote: React.FC<{ o: number }> = ({ o }) => (
  <div style={{ position: 'absolute', right: 96, top: H - 40, height: 24, opacity: o, display: 'flex', alignItems: 'center' }}>
    <span data-ui="note" style={{ fontFamily: FONT.text, fontSize: 16, fontWeight: 500, color: C.mute, whiteSpace: 'pre' }}>
      {SITE.mockNote}
    </span>
  </div>
);

const Url: React.FC<{ F: number }> = ({ F }) => {
  const e = stateAt(F, 'end');
  if (!e.v) return null;
  const size = TYPE.secondary.size;
  return (
    <div style={{ position: 'absolute', left: W / 2, top: LOGO_END.sy + 130, transform: 'translateX(-50%)' }}>
      <Words id="url" text={SITE.url} frame={F} start={e.since + 20} size={size} style={{ fontFamily: FONT.text, fontSize: size, fontWeight: 500, color: C.side, whiteSpace: 'pre' }} />
    </div>
  );
};

export const TutorialScene: React.FC<{ F: number }> = ({ F }) => {
  const cam = shotAt(F);
  const cur = cursorAt(F);
  const sp = toScreen(cam, cur.pos);
  const lg = logoness(F);
  return (
    <AbsoluteFill style={{ background: C.stage, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: VIEW_H, overflow: 'hidden' }}>
        <div style={camera(cam)}>
          <App F={F} o={1 - lg} />
          {lg < 0.5 && <Highlights F={F} k={cam.k} />}
        </div>
        {cur.o > 0 && <Cursor x={sp.x} y={sp.y} scale={1.15} press={cur.press} opacity={cur.o} kind={cur.kind} />}
      </div>
      <Band F={F} />
      <MockNote o={1 - lg} />
      <Url F={F} />
    </AbsoluteFill>
  );
};

export const Tutorial: React.FC = () => {
  const F = useCurrentFrame();
  return (
    <FontGate>
      <TutorialScene F={F} />
    </FontGate>
  );
};
