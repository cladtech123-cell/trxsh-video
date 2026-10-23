# QA before you hand the video over

Run these on the final MP4 (and on each part). Write what you ran and what it said into
`out/tutorials/QA-hisobot.md`; say plainly what you did not check (for example "not watched end to
end by ear").

```bash
. tools/env.sh
V=out/tutorials/<name>.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt -of compact "$V"
ffmpeg -nostdin -v error -i "$V" -f null - && echo decode-ok          # every frame decodes
ffmpeg -nostdin -i "$V" -af ebur128=peak=true -f null - 2>&1 | tail -12  # about -16 LUFS, peak <= -1.5 dBFS
```

Voice in every beat (no silent beat after a TTS hiccup):

```bash
python -c "
import json, numpy as np, soundfile as sf
t = json.load(open('narration/timeline.json', encoding='utf-8')); y, sr = sf.read('narration/narration.wav')
print([b['id'] for b in t['beats'] if np.sqrt(np.mean(y[int(b['voiceStart']*sr):int(b['end']*sr)]**2)) < 0.01] or 'all beats voiced')"
```

Pictures:

- A contact sheet: one still per beat (`npx remotion still Tutorial f.png --frame=<mid-beat>`, or
  frames pulled from the MP4 with `ffmpeg -ss <t> -frames:v 1`), tiled into one image and looked at.
- Per beat: is the thing the sentence names on screen, framed, ringed, and is the cursor on it when
  the verb is spoken? No ring around empty space after a modal closes; no text cut by the frame edge.
- Labels match the live site character for character; demo data only; the mock-up note is visible.
- After a picture change (rename, re-render), compare frame counts with the previous render
  (`ffprobe -count_packets`): equal counts mean audio and subtitles still line up.
- After a voice swap, the video stream must be bit-identical:
  `ffmpeg -i A.mp4 -map 0:v -c copy -f md5 -` gives the same hash for the old and the new file.

## Report template

```markdown
# QA hisobot: <name>
Fayl: out/tutorials/<name>.mp4 (<mm:ss>, <size> MB, 1920x1080, 60 fps, H.264 + AAC)
Ovoz: <voice> · Bo'limlar: <n> · Gaplar: <n>

## Tekshirildi
- ffprobe / to'liq dekodlash: ...
- Ovoz balandligi: ... LUFS, peak ... dBFS
- Har bir gapda ovoz: ...
- Kadrlar: ... (contact sheet: out/tutorials/review-sheet.png)
- Saytga moslik: ... (qaysi bo'limlar jonli saytda tekshirildi)

## Tekshirilmadi / cheklovlar
- ...
```
