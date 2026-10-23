"""Re-voice the narration with a Gemini TTS voice (e.g. Charon), several beats per request.

The free API tier allows few TTS requests a day (10 for gemini-3.8-flash-tts when this was
written), so each request reads a group of beats as paragraphs, and the reply is cut back into
beats at the pauses that best fit the expected beat lengths (the current voice's durations x the
measured new/old speed ratio). Every reply is saved raw before parsing: a request is precious.

The key comes from GEMINI_API_KEY (the user creates it in AI Studio and sets it themself;
never write a key into a file or a command line). Clips land in narration/gemini-<voice>/<beat>.wav;
tools/voice_swap.py lays them on the timeline without touching the picture.

    python tools/gemini_tts.py --plan                 # the groups, nothing sent
    python tools/gemini_tts.py --max 1                # one group first: listen, then the rest
    python tools/gemini_tts.py                        # every missing beat
    python tools/gemini_tts.py --check all            # transcribe each clip, compare first/last words
    python tools/gemini_tts.py --selftest
"""
import argparse, base64, io, json, os, statistics, subprocess, sys, time, urllib.error, urllib.request
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://generativelanguage.googleapis.com/v1beta/models'
SR = 24000
HOP = 0.01
CHECK_MODELS = ('gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3-flash-preview')  # busy models answer 503: try the next


def gaps(y, db=-40, min_len=0.18):
    """Silent runs inside y as (mid_seconds, length_seconds)."""
    h = int(HOP * SR)
    n = len(y) // h
    rms = np.sqrt(np.mean(y[: n * h].reshape(n, h) ** 2, axis=1))
    quiet = rms < 10 ** (db / 20) * rms.max()
    out, i = [], 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if i > 0 and j < n and (j - i) * HOP >= min_len:  # inner pauses only, not lead-in or tail
                out.append(((i + j) / 2 * HOP, (j - i) * HOP))
            i = j
        else:
            i += 1
    return out


def split(total, cand, expect):
    """Pick len(expect)-1 cuts from cand [(t, gap)] so segment lengths fit expect; long gaps preferred."""
    k = len(expect) - 1
    scale = total / sum(expect)
    exp = [e * scale for e in expect]
    pts = [(0.0, 1.0)] + cand + [(total, 1.0)]
    m = len(pts)
    INF = float('inf')
    best = [[INF] * m for _ in range(k + 2)]
    prev = [[-1] * m for _ in range(k + 2)]
    best[0][0] = 0.0
    for s in range(1, k + 2):
        for j in range(1, m):
            if s <= k and j == m - 1:
                continue
            for i in range(j):
                if best[s - 1][i] == INF:
                    continue
                d = pts[j][0] - pts[i][0]
                c = best[s - 1][i] + ((d - exp[s - 1]) / exp[s - 1]) ** 2 - (0.15 * np.log(pts[j][1] / 0.2) if j < m - 1 else 0)
                if c < best[s][j]:
                    best[s][j], prev[s][j] = c, i
    cuts, j = [], m - 1
    for s in range(k + 1, 0, -1):
        cuts.append(pts[j][0])
        j = prev[s][j]
    return sorted(cuts)[:-1]


def selftest():
    rng = np.random.default_rng(1)
    lens = [3.0, 5.5, 2.2, 4.1]
    y, t, want = [np.zeros(int(0.3 * SR))], 0.3, []
    for L in lens:  # each "beat" has a short inner pause; beats are 0.9 s apart
        half = rng.normal(0, 0.3, int(L / 2 * SR))
        y += [half, np.zeros(int(0.25 * SR)), half, np.zeros(int(0.9 * SR))]
        t += L + 0.25
        want.append(t + 0.45)
        t += 0.9
    y = np.concatenate(y)
    c = split(len(y) / SR, gaps(y), [L * 1.1 for L in lens])
    assert np.allclose(c, want[:-1], atol=0.06), (c, want)
    assert words("Ro‘yxat “Saqlash” bo'limi") == ['royxat', 'saqlash', 'bolimi']
    print('selftest ok', [round(x, 2) for x in c])


def post(model, body, key, timeout):
    req = urllib.request.Request(f'{API}/{model}:generateContent', data=json.dumps(body).encode(),
                                 headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=timeout).read()


def tts(text, a, key, raw_path):
    body = {'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': a.voice}}}}}
    raw = post(a.model, body, key, 600)
    open(raw_path, 'wb').write(raw)
    part = json.loads(raw)['candidates'][0]['content']['parts'][0]['inlineData']
    data = base64.b64decode(part['data'])
    if part['mimeType'].startswith('audio/wav'):  # some models answer with a whole WAV file
        y, sr = sf.read(io.BytesIO(data))
        return (y.mean(axis=1) if y.ndim > 1 else y), sr
    assert 'rate=24000' in part['mimeType'], part['mimeType']  # otherwise raw 16-bit PCM
    return np.frombuffer(data, dtype='<i2').astype(np.float64) / 32768, SR


def words(s):
    return [w for w in (''.join(c for c in x.lower() if c.isalnum() and c not in 'ʻʼ') for x in s.split()) if w]


def check(ids, beats, out, key):
    """Transcribe each clip on its own (several clips in one request get their transcripts shifted)."""
    bad = []
    for i in ids:
        mp3 = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', os.path.join(out, i + '.wav'), '-ac', '1', '-b:a', '48k', '-f', 'mp3', '-'],
                             check=True, capture_output=True).stdout  # small upload: a few MB of wav gets the connection reset
        body = {'contents': [{'parts': [{'text': 'Transcribe this audio clip exactly. Reply with the transcript only.'},
                                        {'inlineData': {'mimeType': 'audio/mp3', 'data': base64.b64encode(mp3).decode()}}]}]}
        for model in CHECK_MODELS:
            try:
                got = json.loads(post(model, body, key, 180))['candidates'][0]['content']['parts'][0]['text']
                break
            except (urllib.error.URLError, TimeoutError, KeyError) as e:
                print(f'  {model}: {e}')
        else:
            sys.exit('check: every model failed')
        w, h = words(beats[i]['tts']), words(got)
        ok = h[:1] == w[:1] and h[-1:] == w[-1:]
        bad += [] if ok else [i]
        print(f"{i}: {'ok ' if ok else 'CHECK'} | {' '.join(h[:3])} ... {' '.join(h[-3:])} | want {' '.join(w[:3])} ... {' '.join(w[-3:])}")
    print(f'check: {len(ids) - len(bad)}/{len(ids)} match' + (f'; listen to {bad} (a CHECK can also be a misheard word)' if bad else ''))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--voice', default='Charon')
    ap.add_argument('--model', default='gemini-3.8-flash-tts')
    ap.add_argument('--size', type=int, default=8, help='beats per request')
    ap.add_argument('--max', type=int, default=99, help='requests to send this run')
    ap.add_argument('--ratio', type=float, help='new/old voice duration ratio (default: measured from clips made so far, else 0.93)')
    ap.add_argument('--plan', action='store_true')
    ap.add_argument('--check', nargs='+', help="beat ids, or 'all'")
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    tl = json.load(open(os.path.join(ROOT, 'narration', 'timeline.json'), encoding='utf-8'))
    beats = {b['id']: dict(b, dur=b['voiceEnd'] - b['voiceStart']) for b in tl['beats']}
    out = os.path.join(ROOT, 'narration', f'gemini-{a.voice.lower()}')
    raw_dir = os.path.join(out, 'raw')
    os.makedirs(raw_dir, exist_ok=True)
    have = [i for i in beats if os.path.exists(os.path.join(out, i + '.wav'))]
    if a.check:
        return check(have if a.check == ['all'] else a.check, beats, out, os.environ['GEMINI_API_KEY'])
    ratio = a.ratio or (statistics.median(sf.info(os.path.join(out, i + '.wav')).duration / beats[i]['dur'] for i in have) if len(have) >= 5 else 0.93)
    todo = [beats[i] for i in beats if i not in have]
    if not todo:
        return print(f'gemini_tts: all {len(beats)} clips are in {os.path.relpath(out, ROOT)}')
    n = -(-len(todo) // a.size)
    groups = [todo[round(i * len(todo) / n): round((i + 1) * len(todo) / n)] for i in range(n)]
    print(f'gemini_tts: {len(todo)} beats in {len(groups)} requests, voice {a.voice}, model {a.model}, ratio {ratio:.2f}')
    for g in groups:
        print(f"  {len(g)} beats: {g[0]['id']} .. {g[-1]['id']}, ~{sum(e['dur'] for e in g) * ratio:.0f} s")
    if a.plan:
        return
    key = os.environ.get('GEMINI_API_KEY') or sys.exit('gemini_tts: set GEMINI_API_KEY first (the user creates the key in AI Studio)')
    for gi, g in enumerate(groups[: a.max]):
        if gi:
            time.sleep(25)  # free tier: 3 requests a minute
        tag = f"{g[0]['id']}--{g[-1]['id']}"
        try:
            y, sr = tts('\n\n'.join(e['tts'] for e in g), a, key, os.path.join(raw_dir, tag + '.json'))
        except urllib.error.HTTPError as e:
            sys.exit(f'{tag}: HTTP {e.code} {e.read().decode()[:300]}')
        assert sr == SR, sr
        sf.write(os.path.join(raw_dir, tag + '.wav'), y, SR, subtype='PCM_16')
        total = len(y) / SR
        expect = [e['dur'] * ratio for e in g]
        if not 0.7 < total / sum(expect) < 1.4:
            print(f'{tag}: {total:.1f} s vs ~{sum(expect):.0f} s expected: kept raw only (truncated or rambling?)')
            continue
        cuts = split(total, gaps(y), expect)
        edges = [0.0] + cuts + [total]
        scale = total / sum(expect)
        print(f'{tag}: {total:.1f} s')
        for e, x0, x1, ex in zip(g, edges, edges[1:], expect):
            r = (x1 - x0) / (ex * scale)
            sf.write(os.path.join(out, e['id'] + '.wav'), y[int(x0 * SR): int(x1 * SR)], SR, subtype='PCM_16')
            print(f"  {e['id']}: {x1 - x0:.2f} s (fit {r:.2f}){'  <-- check' if not 0.75 < r < 1.3 else ''}")
    print('next: python tools/gemini_tts.py --check all, then python tools/voice_swap.py --voice', a.voice)


if __name__ == '__main__':
    main()
