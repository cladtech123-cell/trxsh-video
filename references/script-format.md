# narration/script.json

The script is the single source of truth: `tools/narrate.py` synthesizes each beat, measures the
real audio and writes `narration/timeline.json`; `src/tutorial/events.ts` turns that timeline into
every camera move, highlight, cursor move, click, keystroke and state change, in frames. Change a
sentence and everything re-times itself.

## Top level

```json
{
  "title": "Demo Market kabineti",          // the docs' title (export_docs.py)
  "voice": "uz-UZ-MadinaNeural",           // edge-tts voice
  "rate": "+6%",                           // edge-tts speed
  "lead": 0.35,                            // s of quiet before each beat's voice
  "pause": 0.45,                           // s after a beat
  "scenePause": 0.9,                       // s after the last beat of a scene
  "tts": { "Shop24": "shop yigirma to‘rt" }, // what the voice says instead (subtitles keep the original)
  "scenes": [ { "id": "login", "title": "Kabinetga kirish", "tag": "Kirish", "beats": [ ... ] } ]
}
```

(JSON has no comments: the `//` notes above are for this page only.)

A scene with an empty `tag` (intro, outro) has no chapter pill and no segment in the chapter bar.
Scene titles name the parts that `cut_parts.py` writes.

## A beat

```json
{"id": "list.4",
 "say": "Mijoz va summani kiriting, so‘ng “Saqlash” tugmasini bosing.",
 "show": "Forma to‘ldiriladi va saqlanadi",
 "cam": "modal", "hl": "modal", "label": "2-qadam",
 "cur": "f.client", "act": "type", "key": "list.f.client", "text": "Karimova D.", "at": 0.5,
 "marks": [ {"w": "summani", "cur": "f.sum", "act": "type", "key": "list.f.sum", "text": "300 000"},
            {"w": "Saqlash", "cam": "wide", "hl": "row.0", "cur": "btn.save", "act": "press",
             "set": {"list.modal": false, "list.saved": true}} ]}
```

| key | meaning |
|---|---|
| `id` | unique, `<scene>.<n>`; clip and subtitle names use it |
| `say` | the sentence(s), exactly as subtitled |
| `show` | what the viewer sees (docs only) |
| `min` | minimum beat length in s (hold a busy screen longer) |
| `cam` | camera target: `wide`, `logo`, `logo.end`, or any `rect(page, name)` name |
| `hl` | highlight ring target (a rect name); `null` clears; a beat without `hl` clears the ring |
| `label` | small pill on the ring ("1-qadam") |
| `cur` | cursor target (a rect name) |
| `act` | `hover` (default), `press` (click sound, button sinks) or `type` |
| `key` + `text` | with `act: "type"`: the state key the typed text goes to, character by character |
| `at` | s after the beat start when the cursor arrives (default: 0.9 s in, or the mark's word) |
| `set` | state changes `{key: value}`; with a cursor they land on the press, otherwise at the time |
| `nav` | go to a page through the sidebar: the cursor presses `side.<page>`, then `page` changes |
| `marks` | the same directives keyed to a word: `{"w": "bosing", ...}` fires when that word is spoken |

`page` is a state key like any other: `set: {"page": "list"}` changes the page without the sidebar
(a login button, a link). The first page is `login` (events.ts and screens.tsx assume it). The end
card: `{"cam": "logo.end", "set": {"end": true}}` (the URL types in under the logo).

## Rules that keep picture and voice in sync

- **Mark words** are matched in order, each after the previous mark's word, by prefix after
  lower-casing and dropping punctuation and apostrophes (`“Saqlash”` matches `saqlash`). If a word
  is missing narrate.py stops and prints the words it heard: use a word that is really in `say`.
- **A page change must carry its camera.** The camera keeps its last target; if that name does
  not exist on the new page the render fails (`screens: no target "login.card" on page "list"`).
  Put `"cam": "wide"` (or a target on the new page) in the same beat or mark that changes the page.
- **Close what you open.** A modal opened with `set` stays open until a later `set` closes it;
  when it closes, move the camera and the ring in the same mark, or they frame an empty area.
- **One action per beat.** If a sentence has two actions, the second goes in a mark on its verb.
- Typing runs at 15 characters a second: a long text needs a beat long enough to show it.
- Every state key you `set` must be read by `screens.tsx`, and every target name must exist on
  the page that is showing at that moment. `npx remotion still` on a frame in that beat shows it.

## Writing narration people can follow

- One section per scene, in the site's menu order, from login to settings. Open each scene by
  saying what the section is for, then show its main action, then the details (filters, columns,
  statuses, what is disabled and why).
- Imperative and concrete: "“Saqlash” tugmasini bosing", not "you can save". Quote the real
  label exactly as on screen.
- One or two sentences per beat; 8–15 s at most. Short sentences survive TTS better.
- Say *why* when it is not obvious ("Buyurtmaga biriktirilgan furani o‘chirib bo‘lmaydi — avval
  buyurtma yakunlanishi kerak").
- No filler, no marketing words, no "in this video we will learn" more than once (the intro).
- Uzbek: write o‘ g‘ with ‘ (narrate.py turns them into ʻ U+02BB for the voice) and the tutuq
  belgisi with ’ (U+02BC). Spell out letter abbreviations for the voice (`"JSHSHIR": "j-sh-sh-i-r"`)
  and domains (`"kabinet.shop24.uz": "kabinet nuqta shop yigirma to‘rt nuqta uz"`).
