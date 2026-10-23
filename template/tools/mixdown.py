"""Final soundtrack of the narrated tutorial: narration + UI sounds + a quiet pad that ducks under speech.

    python tools/mixdown.py [--from S --to S] [--out FILE]

Reads narration/narration.wav (tools/narrate.py), narration/events.json (scripts/tutorial-events.ts:
presses and keystrokes from the picture's own event engine) and click_*/key_* takes in audio/kit/
(synthesized stand-ins when there are none). The voice leads: the pad sits about 26 dB under it and dips 8 dB more while she talks,
clicks and keys sit well under the words. Mastered to -16 LUFS integrated, peaks under -1.5 dBFS.
"""
import argparse, glob, json, os, random
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TARGET = -16.0


def load(p):
    y, sr = sf.read(p, always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    assert sr == SR, p
    return y


def pad_bed(n):
    """A soft G-major pad: one chord every 8 s, sines with gentle detune, slow fades, low-passed."""
    t = np.arange(n) / SR
    chords = [[196.0, 293.66, 440.0, 493.88], [164.81, 246.94, 392.0, 493.88], [130.81, 196.0, 329.63, 493.88], [146.83, 220.0, 369.99, 440.0]]
    out = np.zeros(n)
    seg = 8 * SR
    fade = int(2.5 * SR)
    for i in range(0, n, seg):
        ch = chords[(i // seg) % len(chords)]
        a, b = max(0, i - fade), min(n, i + seg + fade)
        tt = t[a:b]
        env = np.ones(b - a)
        env[:fade] = np.linspace(0, 1, min(fade, b - a))
        env[-fade:] = np.linspace(1, 0, fade)[-len(env[-fade:]):]
        for f in ch:
            out[a:b] += env * (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.003 * tt)) / len(ch)
    sos = butter(2, 900, 'low', fs=SR, output='sos')
    return sosfilt(sos, out)


def synth_takes(kind, n=4):
    """Stand-in UI sounds when audio/kit/ has no recorded takes: short band-passed noise ticks."""
    rnd = np.random.default_rng(3 if kind == 'click' else 5)
    dur, lo, hi, tau = (0.06, 1800, 6000, 0.008) if kind == 'click' else (0.09, 900, 4200, 0.018)
    t = np.arange(int(dur * SR)) / SR
    sos = butter(2, [lo, hi], 'band', fs=SR, output='sos')
    return [sosfilt(sos, rnd.normal(0, 1, len(t))) * np.exp(-t / tau) for _ in range(n)]


def envelope(y, win=0.3):
    k = int(win * SR)
    c = np.concatenate([[0.0], np.cumsum(y ** 2)])  # moving average by cumulative sum: O(n), not O(n*k)
    i = np.clip(np.arange(len(y)) - k // 2, 0, len(y))
    j = np.clip(np.arange(len(y)) + k // 2, 0, len(y))
    e = np.sqrt((c[j] - c[i]) / k)
    return np.clip(e / (e.max() + 1e-9) * 8, 0, 1)  # 1 while speech is present


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--out', default=os.path.join(ROOT, 'narration', 'mix.wav'))
    ap.add_argument('--voice', default=os.path.join(ROOT, 'narration', 'narration.wav'))
    a = ap.parse_args()
    voice = load(a.voice)
    n = len(voice)
    ev = json.load(open(os.path.join(ROOT, 'narration', 'events.json')))
    fps = ev['fps']
    kit = os.path.join(ROOT, 'audio', 'kit')
    clicks = [load(p) for p in sorted(glob.glob(os.path.join(kit, 'click_*.wav')))] or synth_takes('click')
    keys = [load(p) for p in sorted(glob.glob(os.path.join(kit, 'key_*.wav')))] or synth_takes('key')
    sfx = np.zeros(n)
    rnd = random.Random(7)
    for e in ev['events']:
        y = rnd.choice(clicks if e['kind'] == 'click' else keys)
        g = 0.22 if e['kind'] == 'click' else 0.12
        i = int(round(e['f'] / fps * SR))
        j = min(n, i + len(y))
        if i < n:
            sfx[i:j] += g * y[: j - i] / (np.abs(y).max() + 1e-9)
    speech = envelope(voice)
    duck = 10 ** (-8 * speech / 20)
    bed = pad_bed(n)
    bed = 10 ** (-28 / 20) * bed / (np.abs(bed).max() + 1e-9) * duck
    v = voice / (np.abs(voice).max() + 1e-9) * 0.8
    mix = v + sfx + bed
    i0, i1 = int(a.t0 * SR), int((a.t1 or n / SR) * SR)
    mix = mix[i0:i1]
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(np.stack([mix, mix], axis=1))
    mix = mix * 10 ** ((TARGET - lufs) / 20)
    peak = np.abs(mix).max()
    ceil = 10 ** (-1.5 / 20)
    if peak > ceil:  # gentle soft clip above the ceiling instead of a hard cut
        over = np.abs(mix) > ceil * 0.9
        mix[over] = np.sign(mix[over]) * (ceil * 0.9 + (ceil * 0.1) * np.tanh((np.abs(mix[over]) - ceil * 0.9) / (ceil * 0.1)))
    fade = int(0.8 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    stereo = np.stack([mix, mix], axis=1)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    sf.write(a.out, stereo, SR, subtype='PCM_24')
    print(f'mixdown: {len(mix) / SR:.1f} s, {meter.integrated_loudness(np.stack([mix, mix], axis=1)):.1f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS -> {os.path.relpath(a.out, ROOT)}')


if __name__ == '__main__':
    main()
