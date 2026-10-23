"""Swap the narration voice without touching the picture.

Each clip from narration/gemini-<voice>/ starts at its beat's voiceStart; a clip longer than its
window (end - voiceStart - 0.1 s) is sped up with ffmpeg atempo so it never runs into the next beat.
Then the usual mix (tools/mixdown.py) and a mux onto the rendered picture with the video stream
copied bit for bit (the picture, subtitles and highlights stay exactly as rendered).

    python tools/voice_swap.py --voice Charon [--video out/tutorials/picture-only.mp4] [--name tutorial-charon]
    python tools/voice_swap.py --voice Charon --allow-missing     # a preview while clips are still missing
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000


def run(*cmd):
    subprocess.run(list(cmd), check=True)


def load48(path, tempo=1.0):
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, 'x.wav')
        af = f'atempo={tempo:.4f},' if tempo > 1.0 else ''
        run('ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', path, '-af', af + f'aresample={SR}', '-ac', '1', out)
        y, sr = sf.read(out)
    assert sr == SR
    return y


def trim(y, db=-45, keep=0.03):
    """Drop the silence a TTS leaves around a clip, so the voice lands where the old one did."""
    loud = np.flatnonzero(np.abs(y) > 10 ** (db / 20) * np.abs(y).max())
    if not len(loud):
        return y
    k = int(keep * SR)
    return y[max(0, loud[0] - k): loud[-1] + k]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--voice', required=True)
    ap.add_argument('--video', default=os.path.join(ROOT, 'out', 'tutorials', 'picture-only.mp4'))
    ap.add_argument('--name')
    ap.add_argument('--allow-missing', action='store_true')
    a = ap.parse_args()
    v = a.voice.lower()
    tl = json.load(open(os.path.join(ROOT, 'narration', 'timeline.json'), encoding='utf-8'))
    src = os.path.join(ROOT, 'narration', f'gemini-{v}')
    missing = [b['id'] for b in tl['beats'] if not os.path.exists(os.path.join(src, b['id'] + '.wav'))]
    if missing and not a.allow_missing:
        sys.exit(f'voice_swap: {len(missing)} clips missing: {missing}')
    mix = np.zeros(int(tl['total'] * SR) + SR)
    fast = []
    for b in tl['beats']:
        if b['id'] in missing:
            continue
        p = os.path.join(src, b['id'] + '.wav')
        y = trim(load48(p))
        room = b['end'] - b['voiceStart'] - 0.1
        if len(y) / SR > room:
            tempo = len(y) / SR / room
            fast.append((b['id'], tempo))
            y = trim(load48(p, tempo))[: int(room * SR)]
        i = int(round(b['voiceStart'] * SR))
        mix[i:i + len(y)] += y
    voice = os.path.join(ROOT, 'narration', f'narration-{v}.wav')
    sf.write(voice, mix[: int(tl['total'] * SR)], SR, subtype='PCM_24')
    silent = [b['id'] for b in tl['beats'] if b['id'] not in missing and np.sqrt(np.mean(mix[int(b['voiceStart'] * SR):int(b['end'] * SR)] ** 2)) < 0.01]
    print(f'voice_swap: {len(tl["beats"]) - len(missing)} clips, {len(missing)} missing, sped up: {[(i, round(t, 2)) for i, t in fast]}, silent beats: {silent}')
    os.makedirs(os.path.join(ROOT, 'out', 'tutorials'), exist_ok=True)
    mixed = os.path.join(ROOT, 'out', 'tutorials', f'mix-{v}.wav')
    run(sys.executable, os.path.join(ROOT, 'tools', 'mixdown.py'), '--voice', voice, '--out', mixed)
    if not os.path.exists(a.video):
        sys.exit(f'voice_swap: no picture at {a.video}: render it first (tools/build-tutorial.sh keeps out/tutorials/picture-only.mp4)')
    out = os.path.join(ROOT, 'out', 'tutorials', f'{a.name or "tutorial-" + v}.mp4')
    run('ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', a.video, '-i', mixed, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out)
    print(f'voice_swap: -> {os.path.relpath(out, ROOT)} (video stream copied)')


if __name__ == '__main__':
    main()
