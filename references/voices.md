# Voices

## edge-tts (default, free, no key)

`tools/narrate.py` uses Microsoft's neural voices through edge-tts and gets word timings with the
audio, which is what lets marks fire on a spoken word. Uzbek: `uz-UZ-MadinaNeural` (female),
`uz-UZ-SardorNeural` (male). Set `voice` and `rate` in script.json. Clips are cached by text +
voice + rate, so only changed beats are re-synthesized.

## Gemini TTS (e.g. Charon), without re-rendering

Gemini's voices (Charon: male, informative, lower pitch; others in AI Studio's speaker list) often
sound more natural. Gemini does not officially list Uzbek; let the user judge a sample by ear
before generating everything. The timeline stays the edge-tts one (it drives the picture), and the
new clips are laid onto the same beat windows, so the picture is untouched.

### Route A: the API (preferred, free tier)

1. The user creates a key in AI Studio (API keys) and sets it themself; never take or type a key:
   ```bash
   setx GEMINI_API_KEY "<key>"        # Windows, new terminals see it
   export GEMINI_API_KEY="<key>"      # macOS / Linux
   ```
   In Git Bash on Windows read it from the user environment for the current shell:
   `export GEMINI_API_KEY="$(powershell -NoProfile -Command '[Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User")' | tr -d '\r\n')"`.
   Keys may start with `AIza` or `AQ.`; both go in the `x-goog-api-key` header (a Bearer header
   fails with "Expected OAuth 2 access token").
2. Check the free limits in AI Studio → Rate limit (show all models). When this was written the
   free tier gave `gemini-3.8-flash-tts` 3 requests a minute and **10 a day**.
3. ```bash
   python tools/gemini_tts.py --voice Charon --plan     # groups of ~8 beats: 94 beats = 12 requests
   python tools/gemini_tts.py --voice Charon --max 1    # one group; listen to its clips first
   python tools/gemini_tts.py --voice Charon            # the rest (stops cleanly on a 429)
   python tools/gemini_tts.py --voice Charon --check all
   python tools/voice_swap.py --voice Charon            # -> out/tutorials/tutorial-charon.mp4
   ```
   Several beats per request is what makes the free tier enough: the reply is one long audio that
   gemini_tts.py cuts at the pauses that best fit the expected beat lengths. Each reply is saved
   raw (`narration/gemini-charon/raw/`) before parsing, so a parsing bug never costs a request.
4. `--check` transcribes each clip **on its own** with a Gemini text model and compares its first
   and last words with the beat. Several clips in one transcription request come back shifted
   (the model merges or splits clips), which looks exactly like a wrong cut: do not use that to
   judge cuts. A CHECK on one clip that turns out to be one misheard word ("turklarda" for
   "torglarda") is fine; listen to it.
5. voice_swap.py speeds up (atempo) only clips longer than their window; it prints them (anything
   above ~1.12x is audible: shorten that sentence in script.json and regenerate that beat).

### Route B: the AI Studio page in the browser

If the user prefers their AI Studio subscription to an API key: open
`aistudio.google.com/generate-speech`, pick the model and the voice (Speaker settings → Charon),
paste one beat (or a group of beats) and Run, then Download (ask the user before downloading; files
land in Downloads as "Generated Audio … .wav"). Move each into `narration/gemini-<voice>/<beat id>.wav`.
Wait for the Run button to come back before downloading (the player shows a placeholder while
generating), and check the file is new, not the previous one again. The page has its own quota
("Quota limit reached"); its reset time is not shown. The API route is faster and more reliable.

## Speed ratio

A new voice speaks at its own pace. gemini_tts.py measures the median new/old duration ratio from
the clips made so far (0.93 for Charon vs Madina +6 %) and uses it to predict beat lengths.
