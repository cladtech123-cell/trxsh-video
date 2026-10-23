import React from 'react';
import { C, FONT } from '../brand/tokens';
import { measureTracked } from '../lib/measure';

// Primitives of the rebuilt rebuilt site UI, in world px (the app window is 1600 x 800). Everything is
// absolutely placed so the cursor targets the screens export are the same numbers they draw with.
// Every product string carries data-ui so the layout audit counts it apart from film copy.

export const UI = { body: 17, small: 15, title: 24, row: 56, head: 44, track: -0.005 };

/** Width of a UI string at a size and weight (real font, under FontGate). */
export const tw = (text: string, size = UI.body, weight = 500) => measureTracked(text, size, weight, UI.track) - UI.track * size;

type TProps = { x: number; cy: number; size?: number; weight?: number; color?: string; align?: 'left' | 'center' | 'right'; o?: number; dy?: number; children: React.ReactNode };

/** One line of UI text, its box centred vertically on cy. */
export const T: React.FC<TProps> = ({ x, cy, size = UI.body, weight = 500, color = C.ink, align = 'left', o = 1, dy = 0, children }) => {
  const h = Math.round(size * 1.4);
  const shift = align === 'left' ? '0' : align === 'center' ? '-50%' : '-100%';
  return (
    <span
      data-ui=""
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${cy - h / 2 + dy}px) translateX(${shift})`,
        height: h,
        lineHeight: `${h}px`,
        fontFamily: FONT.text,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${UI.track}em`,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'pre',
        color,
        opacity: o,
      }}
    >
      {children}
    </span>
  );
};

type BoxProps = { x: number; y: number; w: number; h: number; bg?: string; r?: number; border?: string; shadow?: boolean; o?: number; children?: React.ReactNode; style?: React.CSSProperties };

export const Box: React.FC<BoxProps> = ({ x, y, w, h, bg = 'transparent', r = 10, border, shadow, o = 1, children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: w,
      height: h,
      transform: `translate(${x}px, ${y}px)`,
      background: bg,
      borderRadius: r,
      boxShadow: [border ? `inset 0 0 0 1.5px ${border}` : '', shadow ? '0 10px 28px rgba(0,0,0,0.14)' : ''].filter(Boolean).join(', ') || undefined,
      opacity: o,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Width of a pill for a label, so rows of chips lay out from the font. */
export const pillW = (label: string, size = UI.small, pad = 14) => tw(label, size, 600) + 2 * pad;

export const Pill: React.FC<{ x: number; cy: number; label: string; bg: string; fg: string; size?: number; pad?: number; h?: number; o?: number; border?: string }> = ({ x, cy, label, bg, fg, size = UI.small, pad = 14, h = 30, o = 1, border }) => {
  const w = pillW(label, size, pad);
  return (
    <Box x={x} y={cy - h / 2} w={w} h={h} r={h / 2} bg={bg} o={o} border={border}>
      <T x={pad} cy={h / 2} size={size} weight={600} color={fg}>
        {label}
      </T>
    </Box>
  );
};

/** A button: primary (the brand accent), ghost (outlined), soft or danger. `press` 0..1 sinks it on a click. */
export const Btn: React.FC<{ x: number; cy: number; label: string; kind?: 'primary' | 'ghost' | 'soft' | 'danger'; w?: number; h?: number; size?: number; press?: number; o?: number }> = ({
  x,
  cy,
  label,
  kind = 'ghost',
  w,
  h = 40,
  size = UI.small,
  press = 0,
  o = 1,
}) => {
  const width = w ?? btnW(label, size);
  const bg = kind === 'primary' ? C.accent : kind === 'soft' ? C.accentSoft : kind === 'danger' ? C.redSoft : C.white;
  const fg = kind === 'primary' ? C.white : kind === 'soft' ? C.accent : kind === 'danger' ? C.red : C.ink;
  const s = 1 - 0.04 * press;
  return (
    <Box x={x} y={cy - h / 2} w={width} h={h} r={10} bg={bg} border={kind === 'ghost' ? C.line : undefined} o={o} style={{ transformOrigin: 'center', scale: `${s}` }}>
      <T x={width / 2} cy={h / 2} size={size} weight={600} color={fg} align="center">
        {label}
      </T>
    </Box>
  );
};
export const btnW = (label: string, size = UI.small) => tw(label, size, 600) + 36;

/** A text field with an optional typed value and caret. `focus` 0..1 brings the accent ring in. */
export const Field: React.FC<{ x: number; y: number; w: number; h?: number; value?: string; placeholder?: string; prefix?: string; caret?: boolean; focus?: number; size?: number }> = ({
  x,
  y,
  w,
  h = 44,
  value = '',
  placeholder,
  prefix,
  caret = false,
  focus = 0,
  size = UI.body,
}) => {
  const px = prefix ? tw(prefix, size) + 10 : 0;
  const vx = 14 + px;
  return (
    <Box x={x} y={y} w={w} h={h} r={10} bg={C.white} border={focus > 0.5 ? C.accent : C.line}>
      {prefix && (
        <T x={14} cy={h / 2} size={size} color={C.mute}>
          {prefix}
        </T>
      )}
      {value ? (
        <T x={vx} cy={h / 2} size={size} weight={500}>
          {value}
        </T>
      ) : placeholder ? (
        <T x={vx} cy={h / 2} size={size} color={C.mute}>
          {placeholder}
        </T>
      ) : null}
      {caret && <Box x={vx + (value ? tw(value, size) : 0) + 2} y={h / 2 - size * 0.62} w={2} h={size * 1.24} r={1} bg={C.accent} />}
    </Box>
  );
};

export const Check: React.FC<{ x: number; cy: number; on: number; size?: number }> = ({ x, cy, on, size = 20 }) => (
  <Box x={x} y={cy - size / 2} w={size} h={size} r={5} bg={on > 0.5 ? C.accent : C.white} border={on > 0.5 ? undefined : C.line}>
    {on > 0.5 && (
      <svg width={size} height={size} viewBox="0 0 20 20" style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M5 10.5 L8.6 14 L15 6.5" fill="none" stroke={C.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </Box>
);

export const Toggle: React.FC<{ x: number; cy: number; on?: boolean }> = ({ x, cy, on = true }) => (
  <Box x={x} y={cy - 12} w={42} h={24} r={12} bg={on ? C.accent : C.line}>
    <Box x={on ? 21 : 3} y={3} w={18} h={18} r={9} bg={C.white} />
  </Box>
);

export type Col = { title: string; w: number };

/** Column x offsets (from the table's left edge) for a list of columns. */
export const colX = (cols: Col[]) => cols.reduce<number[]>((acc, _c, i) => [...acc, i ? acc[i - 1] + cols[i - 1].w : 20], []);

/** A table card: header row and white rows; cells are drawn by the caller through `cell`. */
export const Table: React.FC<{
  x: number;
  y: number;
  w: number;
  cols: Col[];
  rows: number;
  cell: (r: number, c: number, x: number, cy: number) => React.ReactNode;
  rowO?: (r: number) => number; // per-row opacity (enter/leave)
  rowDy?: (r: number) => number; // per-row vertical offset (enter, FLIP)
  minRows?: number;
  empty?: string;
}> = ({ x, y, w, cols, rows, cell, rowO = () => 1, rowDy = () => 0, minRows = 0, empty }) => {
  const xs = colX(cols);
  const h = UI.head + Math.max(rows, minRows) * UI.row + 8;
  return (
    <Box x={x} y={y} w={w} h={h} r={14} bg={C.white} border={C.line} style={{ overflow: 'hidden' }}>
      <Box x={0} y={0} w={w} h={UI.head} r={0} bg={C.mist} />
      {cols.map((c, i) => (
        <T key={i} x={xs[i]} cy={UI.head / 2} size={UI.small} weight={600} color={C.mute}>
          {c.title}
        </T>
      ))}
      {Array.from({ length: rows }, (_, r) => {
        const cy = UI.head + r * UI.row + UI.row / 2;
        const o = rowO(r);
        if (o <= 0.001) return null;
        return (
          <div key={r} style={{ position: 'absolute', left: 0, top: 0, width: w, opacity: o, transform: `translateY(${rowDy(r)}px)` }}>
            {r > 0 && <Box x={0} y={UI.head + r * UI.row} w={w} h={1.5} r={0} bg={C.line} />}
            {cols.map((_, c) => (
              <React.Fragment key={c}>{cell(r, c, xs[c], cy)}</React.Fragment>
            ))}
          </div>
        );
      })}
      {empty && rows === 0 && (
        <T x={w / 2} cy={UI.head + (Math.max(1, minRows) * UI.row) / 2} color={C.mute} align="center">
          {empty}
        </T>
      )}
    </Box>
  );
};

/** Row centre y (world) for row r of a table placed at y. */
export const rowCy = (tableY: number, r: number) => tableY + UI.head + r * UI.row + UI.row / 2;
