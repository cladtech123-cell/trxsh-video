#!/usr/bin/env bash
# The whole narrated tutorial: TTS -> timeline -> sound events -> mix -> render -> mux -> exports.
#   bash tools/build-tutorial.sh [name]   ->  out/tutorials/<name>.mp4 (default: tutorial)
# A 60 fps render is slow (about 8-9 min of wall time per minute of video on an 8-core laptop):
# run it in the background, and review test clips (tools/clip.sh) before the full render.
set -e
cd "$(dirname "$0")/.."
. tools/env.sh
NAME="${1:-tutorial}"
mkdir -p out/tutorials
python tools/narrate.py | grep -v '^tts ' || true
test -s narration/timeline.json
npx tsx scripts/tutorial-events.ts
python tools/mixdown.py --out out/tutorials/mix.wav
npx tsc --noEmit
npx remotion render Tutorial out/tutorials/picture-only.mp4 --concurrency=8 --crf=16 --log=error 2>&1 | grep -v "npm notice" | grep -vE "Rendered|Encoded" || true
test -s out/tutorials/picture-only.mp4
# picture-only.mp4 is kept on purpose: a voice swap or a re-cut into parts needs no re-render
ffmpeg -nostdin -loglevel error -y -i out/tutorials/picture-only.mp4 -i out/tutorials/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "out/tutorials/$NAME.mp4"
python tools/export_docs.py
echo "build-tutorial: done -> out/tutorials/$NAME.mp4"
