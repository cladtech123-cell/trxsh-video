# Rebuilding the site's screens (src/tutorial/screens.tsx)

The video does not record the real site. It redraws it in React, absolutely positioned in a 1600 x
800 world (WIN), so that the camera can glide and zoom with no blur, the cursor can press any
element at an exact point, data can be demo data, and a frame is a pure function of the frame
number (re-renders are identical). That makes faithfulness your job: same labels, same order of
controls, same colours, same states as the live site.

## The contract (what Tutorial.tsx imports)

| export | what |
|---|---|
| `SITE` | `{ name, url, mockNote }`: the end card URL and the always-on "demo mock-up" note |
| `WIN` | `{ w: 1600, h: 800 }` the app window in world px |
| `LOGO` | `{ x, y, size, cx, cy }`: the intro and end card zoom (k = 4) on (cx, cy) |
| `rect(page, name, s?)` | world rect of a named element; throws on an unknown name (catches typos) |
| `stOf(F)` | the state reader the pages get |
| `App` | draws the window at frame F (pages cross-fade on a page change; the sidebar slides its selection) |
| `type R` | `{ x, y, w, h }` |

## Pages

Each page is `{ draw, rect }`:

```tsx
const list: Page = {
  draw: ({ s, e }) => { /* s: state reader, e: 0..1 entrance progress after a page change */ },
  rect: (name, s) => ({ title: ..., 'btn.add': ..., table: ... })[name],
};
export const PAGES: Record<string, Page> = { login, list, settings };
```

Build rects **from the same constants** the drawing uses (`L_ADD_R` is used both to place the
button and as its rect), never as separate magic numbers: then a layout change can never leave the
cursor pressing empty space.

## State

The script writes state (`set`, typing, `nav`); pages read it:

- `s.v('list.q')`: the current value (typed text grows character by character).
- `s.on('list.modal', 14)`: 0..1 eased toward the key's truthiness over 14 frames since it last
  changed: use it for fades, slides, a modal coming in, a row appearing.
- `stateAt(F, key).since`: the frame it last changed (for your own animations).

Name keys `<page>.<thing>` (`list.f.client`, `set.tg`). Default every read (`?? ''`, `?? false`) so
the page draws before the script sets anything.

## Patterns (all in the example)

- **Sidebar**: `SIDE` items with fixed y; `rect` answers `side.<id>`; the white selection pill
  slides from the previous page's item to the new one; hidden on `login`.
- **Table**: `ui/kit.tsx` `Table` with `Col[]` widths; `enter(e)` staggers rows in after a page
  change; filtered rows come from state (search query, filter chip); give rects for the whole table,
  a column (`col.state`), a row (`row.0`), a cell.
- **Search / input**: `Field` with `value`, `caret`, `focus`; the script types into its key.
- **Modal / panel**: `Dim` + a box sliding 16 px in with `s.on('...modal')`; rects for the modal,
  each field and the submit button.
- **Status badges**: `Pill` with the site's colour pairs (soft ground + strong text).
- **Disabled actions**: draw at 35 % opacity and say why in the narration.
- **Menus / dropdowns / tooltips**: a box under the trigger that fades and slides 8 px.

UI primitives (`ui/kit.tsx`): `T` (one line of text), `Box`, `Btn` (primary / ghost / soft /
danger, `press` sinks it), `Field`, `Check`, `Toggle`, `Pill`, `Table`, `tw()` (measured text
width, so chip rows and buttons size from the font). Colours only from `C` in `brand/tokens.ts`.

## Checklist per page

1. Labels copied exactly from the live site (language, case, punctuation).
2. Controls in the same order and roughly the same places as the site (viewers will look for them).
3. Every target the script names exists in `rect` for that page.
4. Demo data: plausible, internally consistent (a search finds what the narration says it finds),
   never real people or phone numbers. Add a self-check at the bottom of the file for anything
   the narration depends on (`if (!ORDERS.some(...)) throw ...`).
5. A still of the page in each of its states (empty, filled, modal open) looks right at 1x and at
   the zoom the camera will use.
