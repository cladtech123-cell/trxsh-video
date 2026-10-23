import React from 'react';
import { C } from '../brand/tokens';
import { clamp, E, mix, prog } from '../lib/anim';
import { mixColor } from '../lib/color';
import { Box, Btn, btnW, type Col, colX, Field, Pill, T, Table, Toggle, tw, UI } from '../ui/kit';
import { stateAt } from './events';

// THE SITE-SPECIFIC FILE. This is a worked example (a small shop cabinet: login, an orders list
// with search and an "add" form, settings). Replace it with the real site's screens: same labels,
// same order of controls, same colours (brand/tokens.ts), demo data only.
//
// The contract the rest of the engine relies on:
// - WIN: the app window in world px; LOGO: where the logo sits (intro/end card zooms on it);
// - SITE: name, URL (end card) and the mock-up note (always on screen);
// - rect(page, name): the world rect of every element the narrator names. The camera frames it
//   (cam), the ring marks it (hl) and the cursor presses or types into it (cur). Build each rect
//   from the same constants the screen draws with, so they can never drift apart;
// - App: draws the window at frame F; every screen reads its state from stateAt (events.ts),
//   which the script's `set`, `nav` and typing directives fill in.

export const SITE = { name: 'Demo Market', url: 'demo.example.uz', mockNote: "Namoyish uchun maket · demo ma'lumotlar" };

export const WIN = { w: 1600, h: 800 };
const SB = 248; // sidebar width
const CX = 272; // content left edge
const CW = 1304; // content width
const RIGHT = CX + CW;
const TITLE_CY = 44;
const TOOL_CY = 100;
export type R = { x: number; y: number; w: number; h: number };
const R = (x: number, y: number, w: number, h: number): R => ({ x, y, w, h });

// ---- state access ----------------------------------------------------------------------------------
type St = { F: number; v: (k: string) => unknown; on: (k: string, dur?: number) => number };
export const stOf = (F: number): St => ({
  F,
  v: (k) => stateAt(F, k).v,
  // 0..1 toward the key's current truthiness, eased over `dur` frames since it last changed
  on: (k, dur = 16) => {
    const s = stateAt(F, k);
    const t = prog(F, s.since, s.since + dur, E.ui);
    return s.v ? t : 1 - t;
  },
});
const str = (s: St, k: string) => (s.v(k) as string | undefined) ?? '';

// ---- demo data (never real customer data) ----------------------------------------------------------
type Order = { code: string; client: string; city: string; sum: string; state: string };
const ORDERS: Order[] = [
  { code: 'A-1024', client: 'Aliyev J.', city: 'Toshkent', sum: '450 000', state: 'Yangi' },
  { code: 'A-1023', client: 'Rahimova N.', city: 'Samarqand', sum: '1 200 000', state: "Yo'lda" },
  { code: 'A-1022', client: 'Toshmatov S.', city: 'Buxoro', sum: '320 000', state: 'Yetkazildi' },
  { code: 'A-1021', client: 'Aliyev J.', city: 'Toshkent', sum: '780 000', state: 'Yetkazildi' },
  { code: 'A-1020', client: 'Nazarov O.', city: "Farg'ona", sum: '95 000', state: 'Bekor qilindi' },
];
const NEW_CODE = 'A-1025';
const stateColors = (st: string) => (st === 'Yangi' ? [C.accentSoft, C.accent] : st === 'Yetkazildi' ? [C.mist, C.ink] : st === 'Bekor qilindi' ? [C.redSoft, C.red] : [C.mist, C.mute]);

// ---- shared pieces ---------------------------------------------------------------------------------
const Title: React.FC<{ text: string }> = ({ text }) => (
  <T x={CX} cy={TITLE_CY} size={UI.title} weight={600}>
    {text}
  </T>
);
const Dim: React.FC<{ o: number }> = ({ o }) => (o > 0.01 ? <Box x={0} y={0} w={WIN.w} h={WIN.h} r={0} bg={C.ink} o={0.32 * o} /> : null);
const enter = (e: number) => ({ rowO: (r: number) => clamp(e * 1.8 - r * 0.16), rowDy: (r: number) => (1 - clamp(e * 1.8 - r * 0.16)) * 12 });

// ---- sidebar and logo ------------------------------------------------------------------------------
const SIDE = [
  { id: 'list', label: 'Buyurtmalar', y: 140 },
  { id: 'settings', label: 'Sozlamalar', y: 180 },
];
const sideItem = (id: string) => SIDE.find((s) => s.id === id) ?? SIDE[0];
export const LOGO = { x: 24, y: 24, size: 30, cx: 110, cy: 39 };

const Logo: React.FC = () => (
  <>
    <Box x={LOGO.x} y={LOGO.y} w={LOGO.size} h={LOGO.size} r={8} bg={C.accent} />
    <T x={LOGO.x + LOGO.size + 12} cy={LOGO.cy} size={22} weight={700} color={C.white}>
      {SITE.name}
    </T>
  </>
);

const Sidebar: React.FC<{ s: St; o: number }> = ({ s, o: oIn }) => {
  const st = stateAt(s.F, 'page');
  const raw = (st.v as string) ?? 'login';
  const rawPrev = (stateAt(st.since - 1, 'page').v as string) ?? 'login';
  const app = raw === 'login' ? 0 : rawPrev === 'login' ? prog(s.F, st.since, st.since + 24, E.smooth) : 1; // the menu appears once logged in
  const cur = raw === 'login' ? 'list' : raw;
  const prev = rawPrev === 'login' ? cur : rawPrev;
  const t = prog(s.F, st.since, st.since + 20, E.ui);
  const o = oIn * app;
  const y = mix(sideItem(prev).y, sideItem(cur).y, t);
  return (
    <Box x={0} y={0} w={SB} h={WIN.h} r={0}>
      <Box x={0} y={0} w={SB} h={WIN.h} r={0} bg={C.ink} o={o} />
      <Logo />
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: o }}>
        <Box x={16} y={y - 17} w={SB - 32} h={34} r={10} bg={C.white} />
        {SIDE.map((it) => {
          const on = it.id === cur ? t : it.id === prev ? 1 - t : 0;
          return (
            <T key={it.id} x={32} cy={it.y} color={mixColor(C.side, C.accent, on)}>
              {it.label}
            </T>
          );
        })}
      </div>
    </Box>
  );
};

// ---- pages -----------------------------------------------------------------------------------------
type Page = { draw: React.FC<{ s: St; e: number }>; rect: (name: string, s?: St) => R | undefined };

// Login: phone number + one button (rebuild whatever the real site shows, step by step).
const LG = R(900, 220, 480, 330);
const LG_PHONE = R(LG.x + 40, LG.y + 150, LG.w - 80, 52);
const LG_BTN = R(LG.x + 40, LG.y + 230, LG.w - 80, 54);
const login: Page = {
  draw: ({ s }) => {
    const phone = str(s, 'login.phone');
    return (
      <>
        <Box x={0} y={0} w={640} h={WIN.h} r={0} bg={C.ink} />
        <Box x={LG.x} y={LG.y} w={LG.w} h={LG.h} r={20} bg={C.white} border={C.line}>
          <T x={40} cy={62} size={30} weight={700}>
            Xush kelibsiz
          </T>
          <T x={40} cy={106} color={C.mute}>
            Kabinetga telefon raqamingiz orqali kiring.
          </T>
          <Field x={40} y={150} w={LG.w - 80} h={52} prefix="+998" value={phone} caret={phone.length > 0} focus={phone ? 1 : 0} />
          <Btn x={40} cy={257} w={LG.w - 80} h={54} label="Kirish" kind="primary" size={UI.body} />
        </Box>
      </>
    );
  },
  rect: (n) => ({ 'login.card': R(LG.x - 30, LG.y - 30, LG.w + 60, LG.h + 60), 'login.phone': LG_PHONE, 'login.btn': LG_BTN })[n],
};

// Orders list: search, table, "add" form in a modal.
const L_COLS: Col[] = [
  { title: 'Kod', w: 160 },
  { title: 'Mijoz', w: 260 },
  { title: 'Shahar', w: 220 },
  { title: 'Summa', w: 220 },
  { title: 'Holat', w: 240 },
];
const L_T = 136;
const L_ADD = "Buyurtma qo'shish";
const L_ADD_R = R(RIGHT - btnW(L_ADD), TITLE_CY - 20, btnW(L_ADD), 40);
const L_SEARCH = R(CX, TOOL_CY - 22, 360, 44);
const MODAL = R(560, 150, 560, 420);
const M_CLIENT = R(MODAL.x + 28, MODAL.y + 130, MODAL.w - 56, 44);
const M_SUM = R(MODAL.x + 28, MODAL.y + 240, MODAL.w - 56, 44);
const M_SAVE = R(MODAL.x + MODAL.w - 28 - btnW('Saqlash'), MODAL.y + MODAL.h - 64, btnW('Saqlash'), 40);
const lRows = (s: St): Order[] => {
  const q = str(s, 'list.q').toLowerCase();
  const added = s.v('list.saved') ? [{ code: NEW_CODE, client: str(s, 'list.f.client'), city: 'Toshkent', sum: str(s, 'list.f.sum'), state: 'Yangi' }] : [];
  return [...added, ...ORDERS].filter((o) => !q || o.client.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
};
const list: Page = {
  draw: ({ s, e }) => {
    const rows = lRows(s);
    const q = str(s, 'list.q');
    const m = s.on('list.modal', 14);
    const client = str(s, 'list.f.client');
    const sum = str(s, 'list.f.sum');
    return (
      <>
        <Title text="Buyurtmalar" />
        <Btn x={L_ADD_R.x} cy={TITLE_CY} label={L_ADD} kind="primary" />
        <Field x={L_SEARCH.x} y={L_SEARCH.y} w={L_SEARCH.w} value={q} placeholder="Kod yoki mijoz ismi..." caret={q.length > 0} focus={q ? 1 : 0} />
        <Table
          x={CX}
          y={L_T}
          w={CW}
          cols={L_COLS}
          rows={rows.length}
          minRows={1}
          empty="Hech narsa topilmadi"
          {...enter(e)}
          cell={(r, c, x, cy) => {
            const o = rows[r];
            if (c === 4) {
              const [bg, fg] = stateColors(o.state);
              return <Pill x={x} cy={cy} label={o.state} bg={bg} fg={fg} />;
            }
            return (
              <T x={x} cy={cy} weight={c === 0 ? 600 : 500}>
                {[o.code, o.client, o.city, `${o.sum} so'm`][c]}
              </T>
            );
          }}
        />
        <Dim o={m} />
        {m > 0.01 && (
          <Box x={MODAL.x} y={MODAL.y + (1 - m) * 16} w={MODAL.w} h={MODAL.h} r={18} bg={C.white} shadow o={m}>
            <T x={28} cy={40} size={22} weight={600}>
              Yangi buyurtma
            </T>
            <Box x={0} y={76} w={MODAL.w} h={1.5} r={0} bg={C.line} />
            <T x={28} cy={110} size={UI.small} weight={600} color={C.mute}>
              Mijoz
            </T>
            <Field x={28} y={130} w={MODAL.w - 56} value={client} placeholder="Familiya, ism" caret={client.length > 0 && !sum} focus={client && !sum ? 1 : 0} />
            <T x={28} cy={220} size={UI.small} weight={600} color={C.mute}>
              Summa
            </T>
            <Field x={28} y={240} w={MODAL.w - 56} value={sum} placeholder="0" caret={sum.length > 0} focus={sum ? 1 : 0} />
            <Btn x={M_SAVE.x - MODAL.x} cy={MODAL.h - 44} label="Saqlash" kind="primary" />
          </Box>
        )}
      </>
    );
  },
  rect: (n, s) => {
    const rows = s ? lRows(s).length : ORDERS.length;
    const th = UI.head + Math.max(1, rows) * UI.row + 8;
    return {
      title: R(CX - 10, TITLE_CY - 24, 260, 48),
      'btn.add': L_ADD_R,
      search: L_SEARCH,
      table: R(CX, L_T, CW, th),
      'row.0': R(CX + 4, L_T + UI.head + 3, CW - 8, UI.row - 6),
      'col.state': R(CX + colX(L_COLS)[4] - 10, L_T + 2, L_COLS[4].w, th - 4),
      modal: MODAL,
      'f.client': M_CLIENT,
      'f.sum': M_SUM,
      'btn.save': M_SAVE,
    }[n];
  },
};

// Settings: one card of toggles.
const S_CARD = R(CX, 90, 640, 3 * 64 + 24);
const S_ITEMS = [
  { key: 'set.push', label: 'Bildirishnomalar', on: true },
  { key: 'set.tg', label: 'Telegram xabarlari', on: false },
  { key: 'set.sms', label: 'SMS xabarlari', on: false },
];
const S_ROW_CY = (i: number) => 12 + i * 64 + 32;
const settings: Page = {
  draw: ({ s }) => (
    <>
      <Title text="Sozlamalar" />
      <Box x={S_CARD.x} y={S_CARD.y} w={S_CARD.w} h={S_CARD.h} r={14} bg={C.white} border={C.line}>
        {S_ITEMS.map((it, i) => (
          <React.Fragment key={it.key}>
            {i > 0 && <Box x={0} y={12 + i * 64} w={S_CARD.w} h={1.5} r={0} bg={C.line} />}
            <T x={24} cy={S_ROW_CY(i)}>{it.label}</T>
            <Toggle x={S_CARD.w - 24 - 42} cy={S_ROW_CY(i)} on={(s.v(it.key) as boolean | undefined) ?? it.on} />
          </React.Fragment>
        ))}
      </Box>
    </>
  ),
  rect: (n) =>
    ({
      title: R(CX - 10, TITLE_CY - 24, 220, 48),
      card: R(S_CARD.x - 16, S_CARD.y - 16, S_CARD.w + 32, S_CARD.h + 32),
      'toggle.tg': R(S_CARD.x + S_CARD.w - 24 - 42 - 6, S_CARD.y + S_ROW_CY(1) - 18, 54, 36),
    })[n],
};

export const PAGES: Record<string, Page> = { login, list, settings };

/** World rect of a named element on a page (the sidebar items are on every page but login). */
export const rect = (page: string, name: string, s?: St): R => {
  if (name === 'side') return R(8, 110, SB - 16, 100);
  if (name.startsWith('side.')) {
    const it = sideItem(name.slice(5));
    return R(24, it.y - 17, tw(it.label, UI.body, 500) + 16, 34);
  }
  const r = PAGES[page]?.rect(name, s);
  if (!r) throw new Error(`screens: no target "${name}" on page "${page}"`);
  return r;
};

/** The app window at frame F. `o` fades everything but the logo (intro and end card). */
export const App: React.FC<{ F: number; o?: number }> = ({ F, o = 1 }) => {
  const s = stOf(F);
  const ps = stateAt(F, 'page');
  const cur = (ps.v as string) ?? 'login';
  const prev = (stateAt(ps.since - 1, 'page').v as string) ?? 'login';
  const changed = cur !== prev;
  const out = changed ? prog(F, ps.since, ps.since + 10, E.smooth) : 1;
  const e = changed ? prog(F, ps.since + 6, ps.since + 48, E.ui) : 1;
  const Cur = PAGES[cur].draw;
  const Prev = PAGES[prev].draw;
  return (
    <Box x={0} y={0} w={WIN.w} h={WIN.h} r={18} style={{ overflow: 'hidden' }}>
      <Box x={0} y={0} w={WIN.w} h={WIN.h} r={0} bg={C.paper} o={o} />
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: o }}>
        {changed && out < 1 && (
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - out }}>
            <Prev s={stOf(ps.since - 1)} e={1} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: changed ? prog(F, ps.since + 6, ps.since + 18, E.smooth) : 1 }}>
          <Cur s={s} e={e} />
        </div>
      </div>
      <Sidebar s={s} o={o} />
    </Box>
  );
};

// self-check: the search demo needs a matching client, and every page id the sidebar names exists
if (!ORDERS.some((o) => o.client.toLowerCase().includes('aliyev'))) throw new Error('screens: the search demo needs a matching client');
if (SIDE.some((it) => !PAGES[it.id])) throw new Error('screens: a sidebar item points to a missing page');
