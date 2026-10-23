"""Cut the finished tutorial into one file per section (scene), for sharing piece by piece.

Cuts land exactly on scene boundaries (pauses between beats), so each part is re-encoded at high
quality (keyframes every few seconds would make a stream copy start early). A scene shorter than
--merge-under seconds joins the next one (the intro with the first chapter, the outro with the last).

    python tools/cut_parts.py out/tutorials/tutorial.mp4 [--out-dir out/tutorials/qismlar] [--merge-under 20]
"""
import argparse, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slug(s):
    s = s.lower().replace('ʻ', '').replace('ʼ', '').replace("'", '').replace('‘', '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'qism'


def parts(scenes, merge_under):
    """[(title, start, end)]: short scenes merged into a neighbour."""
    out = []
    pending = None
    for s in scenes:
        start = pending[1] if pending else s['start']
        title = f"{pending[0]} va {s['title']}" if pending else s['title']
        if s['end'] - start < merge_under and s is not scenes[-1]:
            pending = (title, start)
            continue
        pending = None
        out.append([title, start, s['end']])
    if len(out) > 1 and out[-1][2] - out[-1][1] < merge_under:  # a short tail joins the part before it
        t, _, e = out.pop()
        out[-1][0] += f' va {t}'
        out[-1][2] = e
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video')
    ap.add_argument('--out-dir', default=os.path.join(ROOT, 'out', 'tutorials', 'qismlar'))
    ap.add_argument('--merge-under', type=float, default=20)
    a = ap.parse_args()
    tl = json.load(open(os.path.join(ROOT, 'narration', 'timeline.json'), encoding='utf-8'))
    tl['scenes'][-1]['end'] = tl['total']
    os.makedirs(a.out_dir, exist_ok=True)
    for n, (title, t0, t1) in enumerate(parts(tl['scenes'], a.merge_under), 1):
        out = os.path.join(a.out_dir, f'{n:02d}-{slug(title)}.mp4')
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-ss', f'{t0}', '-to', f'{t1}', '-i', a.video,
                        '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart',
                        '-af', 'afade=t=in:d=0.05,areverse,afade=t=in:d=0.4,areverse', '-c:a', 'aac', '-b:a', '256k', out], check=True)
        err = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', out, '-f', 'null', '-'], capture_output=True, text=True).stderr.strip()
        print(f'{os.path.basename(out)}: {t1 - t0:.1f} s {"decode-ok" if not err else "DECODE ERRORS: " + err[:200]}')


# self-check: a short intro joins the first chapter, a short outro joins the last
_s = [{'title': 'Kirish', 'start': 0, 'end': 10}, {'title': 'A', 'start': 10, 'end': 70}, {'title': 'B', 'start': 70, 'end': 130}, {'title': 'Yakun', 'start': 130, 'end': 140}]
assert parts(_s, 20) == [['Kirish va A', 0, 70], ['B va Yakun', 70, 140]], parts(_s, 20)

if __name__ == '__main__':
    main()
