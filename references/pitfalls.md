# Pitfalls (each one cost real time once)

## Shell and Windows
- **`ffmpeg` inside a `while read` loop eats the loop's input** (it reads stdin): the second
  iteration gets a mangled line ("yurtmalar ok", "Invalid duration"). Always `ffmpeg -nostdin`.
- **Python on Windows prints `\r\n`.** A value captured with `$(python -c ...)` or a file written by
  Python and read by bash carries `\r` ("Invalid duration for option to: 512.162"). Pipe through
  `tr -d '\r'`.
- **Remotion's bundled ffmpeg lacks filters** (atempo, afade, loudnorm...). `tools/env.sh` puts a
  full ffmpeg (system, or imageio-ffmpeg copied to tools/bin) first on PATH.
- **Remotion cannot launch a browser** ("chrome-headless-shell.exe ENOENT") when it cannot download
  its own: env.sh points `REMOTION_BROWSER` at an installed Chrome.
- A huge one-shot bash command with several heredocs can fail to parse as a whole; split it.

## Rendering
- 60 fps at 1080p: ~8–9 min of wall time per minute of video on an 8-core laptop. Run long renders
  in the background, give the user an estimate, and do not re-render to change audio.
- `--log=error` hides progress. To estimate, compare the growing `pre-encode.mp4` in the temp
  `react-motion-render*` folder with the size of a previous render (rough: sizes are not uniform).
- **Cutting parts with `-c copy` starts at the previous keyframe** (every ~4 s): parts get a few
  seconds of the previous section. Re-encode parts (CRF 14) for exact cuts; mux the full video with
  `-c:v copy`.
- Changing anything visible (a brand name, a label) means a re-render of the picture. Grep all of
  `src/` (data files, screens, the switcher labels), check a still of each place, then render.
  Re-mux the existing mix; check the frame count is unchanged.

## Narration and sync
- A camera target that does not exist on the current page crashes the render
  (`screens: no target "x" on page "y"`): a page change must carry a `cam` on the new page.
- A ring left on a closed modal frames empty space: move `hl` (or `"hl": null`) when it closes.
- Mark words that are not in `say` stop narrate.py: it prints the words it heard.

## Gemini TTS
- Some models answer `audio/wav` (a whole WAV), others raw PCM (`audio/L16;rate=24000`): handle
  both, and save the reply before parsing (a failed parse otherwise wastes a free request).
- Free tier: few TTS requests a day. Group 7–8 beats per request; keep 2–3 requests in reserve.
- Uploading a few MB of WAV for transcription can get the connection reset: send small MP3s.
- Transcribing several clips in one request shifts transcripts between clips: check one clip per
  request before "fixing" cuts that were right.
- Busy models answer 503: fall back to another model.
- The AI Studio page's own quota ("Quota limit reached") is separate from the API's; its reset
  time is not shown.

## Files and safety
- Never delete the user's earlier renders or downloads: move replaced files to a temp
  "quarantine" folder and say where.
- Never write API keys into files, commands or chat; read them from the environment.
