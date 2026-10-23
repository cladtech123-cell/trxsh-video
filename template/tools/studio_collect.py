"""Move audio downloaded from the AI Studio web panel (Generate speech) into the project.

AI Studio saves each Download as "Generated Audio <date> - <time>.wav" (24 kHz mono) in the
Downloads folder. This takes the newest ones, oldest first, and files them:

    python tools/studio_collect.py --samples Charon Kore Puck Sulafat     # 4 downloads -> narration/voice-samples/<voice>.wav
    python tools/studio_collect.py --voice Charon login.1 login.2         # 2 downloads, one beat each
    python tools/studio_collect.py --voice Charon login.1:400d225e        # with the page's FNV-1a hash of the audio (checks it is the new one)
    python tools/studio_collect.py --voice Charon --group list.1 list.2 list.3   # 1 download that reads 3 beats: cut at the pauses

Downloads are moved, not copied (each group file is also kept in narration/gemini-<voice>/raw/).
"""
import argparse, base64, glob, json, os, shutil, sys
import soundfile as sf
from gemini_tts import SR, gaps, split  # same folder: the cut-at-pauses logic of the API route

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fnv(b64):
    """FNV-1a over the base64 text, the same hash the page helper computes from the audio element."""
    h = 0x811C9DC5
    for ch in b64:
        h = ((h ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
    return format(h, '08x')


def newest(downloads, n):
    files = sorted(glob.glob(os.path.join(downloads, 'Generated Audio*.wav')), key=os.path.getmtime)
    if len(files) < n:
        sys.exit(f'studio_collect: {n} downloads needed, {len(files)} found in {downloads}')
    return files[-n:]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ids', nargs='*', help='beat ids (optionally id:hash), oldest download first')
    ap.add_argument('--voice', help='the voice the beats were made with (folder narration/gemini-<voice>)')
    ap.add_argument('--samples', nargs='+', help='voice names: the newest downloads are samples, in this order')
    ap.add_argument('--group', action='store_true', help='the newest single download reads all the given beats')
    ap.add_argument('--downloads', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()

    if a.samples:
        out = os.path.join(ROOT, 'narration', 'voice-samples')
        os.makedirs(out, exist_ok=True)
        for v, f in zip(a.samples, newest(a.downloads, len(a.samples))):
            dst = os.path.join(out, f'{v}.wav')
            shutil.move(f, dst)
            print(f'{v}: {sf.info(dst).duration:.1f} s -> {os.path.relpath(dst, ROOT)}')
        return

    if not (a.voice and a.ids):
        sys.exit('studio_collect: give --voice and beat ids (or --samples)')
    out = os.path.join(ROOT, 'narration', f'gemini-{a.voice.lower()}')
    os.makedirs(os.path.join(out, 'raw'), exist_ok=True)
    pairs = [x.split(':') for x in a.ids]

    if a.group:
        f = newest(a.downloads, 1)[0]
        y, sr = sf.read(f)
        if sr != SR:
            sys.exit(f'studio_collect: {f} is {sr} Hz, expected {SR}')
        tl = json.load(open(os.path.join(ROOT, 'narration', 'timeline.json'), encoding='utf-8'))
        dur = {b['id']: b['voiceEnd'] - b['voiceStart'] for b in tl['beats']}
        ids = [p[0] for p in pairs]
        expect = [dur[i] for i in ids]
        total = len(y) / SR
        edges = [0.0] + split(total, gaps(y), expect) + [total]
        raw = os.path.join(out, 'raw', f'{ids[0]}--{ids[-1]}.wav')
        shutil.move(f, raw)
        scale = total / sum(expect)
        for i, x0, x1, ex in zip(ids, edges, edges[1:], expect):
            sf.write(os.path.join(out, f'{i}.wav'), y[int(x0 * SR): int(x1 * SR)], SR, subtype='PCM_16')
            r = (x1 - x0) / (ex * scale)
            print(f"{i}: {x1 - x0:.2f} s (fit {r:.2f}){'  <-- check' if not 0.75 < r < 1.3 else ''}")
        print('next: python tools/gemini_tts.py --voice', a.voice, '--check', *ids)
        return

    for (i, *want), f in zip(pairs, newest(a.downloads, len(pairs))):
        got = fnv(base64.b64encode(open(f, 'rb').read()).decode())
        if want and want[0] != got:
            sys.exit(f'studio_collect: {i}: {os.path.basename(f)} has hash {got}, the page said {want[0]}: '
                     'an old or partial download; nothing moved from here on')
        dst = os.path.join(out, f'{i}.wav')
        shutil.move(f, dst)
        print(f'{i}: {sf.info(dst).duration:.2f} s -> {os.path.relpath(dst, ROOT)}')


if __name__ == '__main__':
    main()
