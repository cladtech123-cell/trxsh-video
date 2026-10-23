---
name: trxsh-video
description: Turn a website or web app into a complete narrated instruction video that teaches every feature step by step, from login to settings - the site's screens rebuilt in code (Remotion), a voice that explains each step, a cursor that clicks and types, camera zooms and highlight rings on what is being explained, subtitles, a chapter bar, then cut into one file per section. Use this whenever the user wants a tutorial, instruction, walkthrough, onboarding, training or how-to video for a site, cabinet, admin panel, dashboard, CRM or SaaS ("sayt bo'yicha instruksiya video", "qo'llanma video", "video yo'riqnoma", "обучающее видео по сайту"), in Uzbek or any other language, even if they only paste a URL and say "make a video explaining it". Also use it to re-voice such a video with another TTS voice (e.g. Gemini's Charon) without re-rendering the picture, to rename something shown on screen, or to cut the video into parts.
---

# Site → instruction video

You turn a live site into a calm, exact, narrated tutorial: one continuous take over a faithful
rebuild of the site's UI, where every sentence the narrator says has something on screen doing it.
The output is an MP4 (1920x1080, 60 fps), its subtitles, the narration script, per-section parts
and a QA report.

This skill is a layer on top of the **cinetic** skill (scaffold, motion library, fonts, render
scripts). If it is not installed: `npx skills add Leonxlnx/cinetic`.

## Ground rules (why the video can be trusted)

- **Nothing invented.** Every screen, label, button and flow comes from the live site, checked
  in the browser. If you could not see a flow (no access, a payment step, a role you lack), say so
  and leave it out or ask the user; do not guess what it probably looks like. The user's own notes
  about the site are the best source: read them first and keep their wording.
- **Demo data only.** Rebuild the screens with invented names, numbers and codes; never copy real
  customers, phone numbers or orders into the video. A small permanent note ("demo mock-up") stays
  on screen (SITE.mockNote).
- **The user signs in, not you.** Ask the user to log in themselves in their browser; never type
  passwords, codes or API keys. API keys come from environment variables the user sets.
- **Ask before downloading anything** and before publishing anything.

## Workflow

### 1. Learn the site (browser)
Open the site in the user's browser (Chrome / the browser tool). Walk every section in menu order
and write `BRIEF.md` in the project: for each section, what it is for, the one or two actions it
exists for, the exact labels (copy them character for character, in the site's language), the
columns, filters, forms and their fields, the states/badges and their colours, empty states,
modals, what is disabled and why. Note the brand colours (devtools computed styles) and the font.
Verify the login flow against the real UI (it is the first thing viewers copy).

### 2. Scaffold
```bash
bash <cinetic>/scripts/new-film.sh films/<name> --fps 60 --size 1920x1080
python <this-skill>/scripts/add_tutorial.py films/<name>
cd films/<name> && . tools/env.sh
pip install edge-tts soundfile numpy scipy pyloudnorm imageio-ffmpeg pillow   # once
```
`add_tutorial.py` copies `template/` (engine, UI kit, tools, an example) and registers the
`Tutorial` composition. The example (a small shop: login, list with search and add-form,
settings) renders as is: run steps 5–6 on it once to see the whole pipeline work before you
replace it.

### 3. Rebuild the screens
Edit `src/brand/tokens.ts` (the site's colours) and replace `src/tutorial/screens.tsx` with the
site's pages. Read `references/screens-guide.md` first: the contract (WIN, LOGO, SITE, rect,
App), how state flows in from the script, and the patterns for tables, filters, modals, forms
and typing. Check each page with stills as you go:
```bash
npx remotion still Tutorial out/stills/f<N>.png --frame=<N>
```

### 4. Write the narration script
`narration/script.json`: scenes (one per section, in menu order, from login to settings) made of
beats (one sentence or two each). Read `references/script-format.md`: every directive (`cam`,
`hl`, `label`, `cur`, `act`, `key`/`text`, `set`, `nav`, `marks`), the rules that keep it in sync,
and how to write narration people can follow (imperative, one action per sentence, real labels in
quotes, why before how). Add TTS substitutions for brand names, domains and abbreviations.

### 5. Voice, events, mix
```bash
python tools/narrate.py              # edge-tts per beat -> narration/timeline.json + narration.wav
npx tsx scripts/tutorial-events.ts   # clicks and keystrokes -> narration/events.json
python tools/mixdown.py              # voice + UI sounds + quiet pad, -16 LUFS
npx tsc --noEmit
```
Default voices: Uzbek `uz-UZ-MadinaNeural` (female) or `uz-UZ-SardorNeural` (male); any edge-tts
voice works (`edge-tts --list-voices`). For Gemini voices see step 8.

### 6. Review clips, then render
Render one or two sections first and look at them (and at stills) before the full render:
```bash
bash tools/clip.sh login login.1 login.2        # -> out/tutorials/test-login.mp4
bash tools/build-tutorial.sh <name>             # full: -> out/tutorials/<name>.mp4 (+ picture-only.mp4)
```
A 60 fps render takes about 8–9 minutes of wall time per minute of video on an 8-core laptop
(14 minutes of video ≈ 2 hours). Run it in the background and tell the user the estimate.
`picture-only.mp4` is kept on purpose: a new voice or a new cut never needs a re-render.

### 7. Parts, docs, QA
```bash
python tools/cut_parts.py out/tutorials/<name>.mp4      # one MP4 per section (short ones merged)
python tools/export_docs.py                              # SRT subtitles + the narration script table
```
Then QA as in `references/qa.md` (probe, full decode, loudness, voice in every beat, a contact
sheet of frames, a look at every section) and write `out/tutorials/QA-hisobot.md`. Report only
what you checked; list what you did not.

### 8. Optional: another voice without re-rendering
To re-voice with Gemini TTS (e.g. the male voice **Charon**), follow `references/voices.md`:
`tools/gemini_tts.py` (several beats per request, so the free tier's few requests a day go far,
then each clip checked by transcription), and `tools/voice_swap.py` lays the clips onto the
existing timeline and muxes onto `picture-only.mp4` with the video stream copied bit for bit.

### 9. Changing something on screen
A label, a brand name or a value on screen lives in `screens.tsx` (or its data). Change it
everywhere (grep the whole `src/`), check a still of each place, then re-render the picture
(step 6) and re-mux the existing mix; the audio and its timing do not change.

## References

| When | Read |
|---|---|
| rebuilding the site's pages | `references/screens-guide.md` |
| writing `script.json` | `references/script-format.md` |
| choosing or swapping the voice (edge-tts, Gemini/Charon, AI Studio) | `references/voices.md` |
| checking the result, writing the QA report | `references/qa.md` |
| anything fails (Windows, ffmpeg, renders, quotas) | `references/pitfalls.md` |

## Talking to the user

They usually want the video, not the machinery. Before a long step say what it is and how long it
takes; after it say what came out and where. Report problems plainly (a quota hit, a flow you
could not see, a step skipped). Write to them in their language.
