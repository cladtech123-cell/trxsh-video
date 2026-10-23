#!/usr/bin/env bash
# tools/clip.sh <name> <first beat id> <last beat id>: render that stretch of the Tutorial with its
# mixed narration into out/tutorials/test-<name>.mp4 (a review clip, not the deliverable).
set -e
cd "$(dirname "$0")/.."
. tools/env.sh
read T0 T1 < <(python -c "
import json,sys
tl=json.load(open('narration/timeline.json',encoding='utf-8'))
b={x['id']:x for x in tl['beats']}
print(b['$2']['start'], b['$3']['end'])")
F0=$(python -c "print(round($T0*60))"); F1=$(python -c "print(round($T1*60)-1)")
python tools/mixdown.py --from "$(python -c "print($F0/60)")" --to "$(python -c "print(($F1+1)/60)")" --out "out/tutorials/test-$1.wav" > /dev/null
npx remotion render Tutorial "out/tutorials/test-$1-silent.mp4" --frames=$F0-$F1 --concurrency=8 --crf=18 --log=error 2>&1 | grep -v "npm notice" | grep -vE "Rendered|Encoded" || true
ffmpeg -nostdin -loglevel error -y -i "out/tutorials/test-$1-silent.mp4" -i "out/tutorials/test-$1.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "out/tutorials/test-$1.mp4"
rm -f "out/tutorials/test-$1-silent.mp4" "out/tutorials/test-$1.wav"
echo "clip $1: $T0-$T1 s -> out/tutorials/test-$1.mp4"
