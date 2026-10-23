# The voice: Google AI Studio, chosen by the user

The final narration comes from Gemini TTS (Google AI Studio). edge-tts still runs once first: it
is free, and it returns word timings with the audio, which is what lets a mark fire on a spoken
word. The chosen voice then sets every beat's length (`narrate.py --clips`), and the edge-tts word
times are scaled into each clip, so the picture is timed by the voice the viewer hears.

## The flow

```text
script.json ─► narrate.py (edge-tts timing pass)
            ─► ask: web panel or API?
            ─► 3-4 samples of one sentence ─► user listens and picks a voice
            ─► every beat in that voice (groups of ~8 per generation) ─► check the cuts
            ─► narrate.py --clips narration/gemini-<voice> ─► events, mix, render
```

## 1. Ask the route (AskUserQuestion)

| | AI Studio web panel | API |
|---|---|---|
| needs | the user signed in to AI Studio in their browser (AI Pro or free) | a key the user creates in AI Studio → API keys and sets as `GEMINI_API_KEY` themselves |
| speed | slow: one generation and one download at a time | fast: a script |
| limits | the page's own quota; "Quota limit reached" shows no reset time | free tier: 3 TTS requests a minute, about 10 a day (check AI Studio → Rate limit) |
| downloads | each one needs the user's OK (ask once for the whole batch, with the count) | none |
| clip checks | listen, or `--check` if a key is also set | `gemini_tts.py --check all` |

Never take, type or store the key. In Git Bash on Windows read the user's key into the shell with
`export GEMINI_API_KEY="$(powershell -NoProfile -Command '[Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User")' | tr -d '\r\n')"`.
Keys may start with `AIza` or `AQ.`; both go in the `x-goog-api-key` header.

## 2. Samples (3–4 voices, one sentence)

Same sentence in every sample, so the user compares voices, not texts: by default the first beat
of the first chapter. Default voices: `Charon` (informative, lower pitch), `Sadaltager`
(knowledgeable), `Kore` (firm), `Sulafat` (warm). Follow the user's wishes instead when they have
any ("erkak ovozi", "yoshroq"); AI Studio's speaker list shows a one-word style for each of its
30 voices (Puck upbeat, Fenrir excitable, Orus firm, Iapetus clear, Achird friendly, ...).

- API: `python tools/gemini_tts.py --samples` (or `--samples Charon Orus Iapetus Achird`, `--text "..."`).
  One request per voice; files in `narration/voice-samples/<voice>.wav`.
- Web panel: for each voice, generate the sentence (references/ai-studio-web.md), Download; then
  `python tools/studio_collect.py --samples Charon Sadaltager Kore Sulafat` (newest downloads, in that order).

Send the samples to the user (as files they can play), then ask them to choose: options = the
voices, plus "boshqa ovozlar" (another round) and "bepul edge-tts ovozi" (no Google). Gemini does
not officially list Uzbek; their ear decides.

## 3. Every beat in the chosen voice

API:
```bash
python tools/gemini_tts.py --voice Charon --plan     # the groups (~8 beats each); 94 beats = 12 requests
python tools/gemini_tts.py --voice Charon --max 1    # one group: listen to its clips first
python tools/gemini_tts.py --voice Charon            # the rest (stops cleanly on a 429: continue tomorrow)
python tools/gemini_tts.py --voice Charon --check all
```
Web panel: paste ~8 beats per generation (the `tts` texts from `narration/timeline.json`,
separated by blank lines), Run, Download, then
`python tools/studio_collect.py --voice Charon --group <the ids in that generation>`.

Several beats per generation is what makes the quotas enough: the reply is one long audio cut at
the pauses that best fit the expected beat lengths. Each API reply is saved raw
(`narration/gemini-<voice>/raw/`) before parsing, so a parsing bug never costs a request.

`--check` transcribes each clip **on its own** with a Gemini text model and compares its first and
last words with the beat. Several clips in one transcription request come back shifted between
clips, which looks exactly like a wrong cut: do not judge cuts that way. One CHECK that turns out
to be a misheard word ("turklarda" for "torglarda") is fine; listen to it.

## 4. Time the video by that voice

```bash
python tools/narrate.py --clips narration/gemini-charon
bash tools/build-tutorial.sh <name> narration/gemini-charon
```
narrate.py fails with the list of missing beats if any clip is missing. A new voice speaks at its
own pace (Charon was 0.93x of Madina +6 %): the video simply gets that long.

## Changing the voice after the render

`python tools/voice_swap.py --voice <V>` lays new clips onto the existing timeline (atempo on any
clip longer than its window; above ~1.12x is audible: shorten that sentence and regenerate it) and
muxes onto `picture-only.mp4` with the video stream copied. Marks inside a beat keep the old
voice's timing; beat starts match.

## edge-tts fallback (free, no Google)

`uz-UZ-SardorNeural` (male), `uz-UZ-MadinaNeural` (female); any voice from `edge-tts --list-voices`.
Set `voice` and `rate` in script.json and run narrate.py without `--clips`.
