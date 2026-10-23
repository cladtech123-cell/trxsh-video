"""narration/script.json -> per-beat TTS clips + narration/timeline.json + narration/narration.wav.

Every beat is synthesized on its own (edge-tts, Microsoft neural voice) with word boundaries, so
the timeline knows when each word is spoken: beat lengths come from the real audio, and `marks`
(camera / highlight / cursor / state changes keyed to a word) land on that word. Clips are cached
by text + voice + rate, so re-running after a script edit only re-synthesizes changed beats.

    python tools/narrate.py            # synthesize what changed, rebuild timeline + narration.wav
"""
import asyncio, hashlib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, 'narration', 'script.json')
AUDIO = os.path.join(ROOT, 'narration', 'audio')
OUT_TL = os.path.join(ROOT, 'narration', 'timeline.json')
OUT_WAV = os.path.join(ROOT, 'narration', 'narration.wav')
SR = 48000
FPS = 60
SUB_MAX = 64  # characters per subtitle line; two lines per card at most


def tts_text(say, subs):
    t = say
    for k, v in subs.items():
        t = t.replace(k, v)
    t = re.sub(r"([oOgG])[‘'’]", lambda m: m.group(1) + 'ʻ', t)  # o‘ g‘ -> oʻ gʻ (U+02BB), as the Uzbek voice expects
    t = re.sub(r"[‘'’]", 'ʼ', t)  # tutuq belgisi -> U+02BC
    return t.replace('“', '"').replace('”', '"')


def norm(w):
    w = w.lower()
    w = re.sub(r"[‘’'ʻʼ`]", '', w)
    return re.sub(r'[^\w-]', '', w)


async def synth(text, voice, rate, mp3):
    words = []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    with open(mp3, 'wb') as f:
        async for ch in com.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append({'w': ch['text'], 't': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7})
    return words


def to_wav(mp3, wav):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR), wav], check=True)


def chunks(say, start, end):
    """Subtitle cards for one beat: whole words, <= SUB_MAX chars a line, 2 lines a card; time split by length."""
    # balanced lines: as many as the text needs at SUB_MAX, then each about the same length, so no
    # card ends on a two-word orphan that flashes by
    n = -(-len(say) // SUB_MAX)
    n += n % 2 if n > 2 else 0  # an even count fills every card with two lines
    width = min(SUB_MAX, -(-len(say) // n) + 6)

    def wrap(width):
        lines, cur = [], ''
        for w in say.split():
            if cur and len(cur) + 1 + len(w) > width:
                lines.append(cur)
                cur = w
            else:
                cur = f'{cur} {w}'.strip()
        return lines + [cur] if cur else lines

    lines = wrap(width)
    while len(lines) > n and width < SUB_MAX + 8:  # word breaks spilled one word over: widen a little
        width += 1
        lines = wrap(width)
    cards = ['\n'.join(lines[i:i + 2]) for i in range(0, len(lines), 2)]
    total = sum(len(c) for c in cards)
    out, t = [], start
    for c in cards:
        d = (end - start) * len(c) / total
        out.append({'text': c, 'start': round(t, 3), 'end': round(t + d, 3)})
        t += d
    return out


def main():
    S = json.load(open(SCRIPT, encoding='utf-8'))
    os.makedirs(AUDIO, exist_ok=True)
    voice, rate = S['voice'], S.get('rate', '+0%')
    lead, pause, spause = S['lead'], S['pause'], S['scenePause']
    t = 0.0
    beats, scenes, track = [], [], []
    for sc in S['scenes']:
        s0 = t
        for bi, b in enumerate(sc['beats']):
            text = tts_text(b['say'], S.get('tts', {}))
            key = hashlib.sha1(f'{voice}|{rate}|{text}'.encode()).hexdigest()[:12]
            base = os.path.join(AUDIO, f"{b['id']}-{key}")
            mp3, wav, wj = base + '.mp3', base + '.wav', base + '.words.json'
            if not (os.path.exists(wav) and os.path.exists(wj)):
                print('tts', b['id'], flush=True)
                for attempt in range(4):
                    try:
                        words = asyncio.run(synth(text, voice, rate, mp3))
                        break
                    except Exception as e:  # the service drops a connection now and then
                        if attempt == 3:
                            raise
                        print('  retry', e, flush=True)
                if not words or os.path.getsize(mp3) == 0:
                    sys.exit(f'narrate: no audio for {b["id"]}')
                to_wav(mp3, wav)
                json.dump(words, open(wj, 'w', encoding='utf-8'), ensure_ascii=False)
            words = json.load(open(wj, encoding='utf-8'))
            y, sr = sf.read(wav)
            assert sr == SR, wav
            dur = len(y) / SR
            last = bi == len(sc['beats']) - 1
            v0 = t + lead
            v1 = v0 + dur
            end = max(v1 + (spause if last else pause), t + b.get('min', 0))
            # marks: the word they name, searched in order after the previous mark
            marks, wi = [], 0
            for m in b.get('marks', []):
                target = norm(m['w'])
                hit = next((j for j in range(wi, len(words)) if norm(words[j]['w']).startswith(target)), None)
                if hit is None:
                    sys.exit(f"narrate: {b['id']}: mark word '{m['w']}' not found in {[w['w'] for w in words]}")
                wi = hit + 1
                mm = {k: v for k, v in m.items() if k != 'w'}
                mm['t'] = round(v0 + words[hit]['t'], 3)
                mm['word'] = words[hit]['w']
                marks.append(mm)
            beat = {k: v for k, v in b.items() if k != 'marks'}
            beat.update({
                'scene': sc['id'], 'start': round(t, 3), 'end': round(end, 3), 'voiceStart': round(v0, 3), 'voiceEnd': round(v1, 3),
                'audio': os.path.relpath(wav, ROOT).replace('\\', '/'), 'tts': text, 'marks': marks,
                'subs': chunks(b['say'], v0, v1),
            })
            beats.append(beat)
            track.append((v0, y))
            t = end
        scenes.append({'id': sc['id'], 'title': sc['title'], 'tag': sc['tag'], 'start': round(s0, 3), 'end': round(t, 3)})
    total = t + 1.5  # the last word rings out over the end card
    tl = {'fps': FPS, 'total': round(total, 3), 'frames': int(round(total * FPS)), 'voice': voice, 'scenes': scenes, 'beats': beats}
    json.dump(tl, open(OUT_TL, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    mix = np.zeros(int(total * SR) + SR)
    for v0, y in track:
        i = int(round(v0 * SR))
        mix[i:i + len(y)] += y
    sf.write(OUT_WAV, mix[: int(total * SR)], SR, subtype='PCM_24')
    print(f'narrate: {len(beats)} beats in {len(scenes)} scenes, {total:.1f} s -> {os.path.relpath(OUT_TL, ROOT)}, {os.path.relpath(OUT_WAV, ROOT)}')


if __name__ == '__main__':
    main()
