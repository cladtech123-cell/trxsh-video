"""narration/timeline.json -> out/tutorials/: subtitles (SRT, the cards burned into the video, with
the same timings) and the narration script as a readable table (scene, what is on screen, the full
text, start/end, audio file)."""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out', 'tutorials')
tl = json.load(open(os.path.join(ROOT, 'narration', 'timeline.json'), encoding='utf-8'))
os.makedirs(OUT, exist_ok=True)


def ts(t):
    ms = int(round(t * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def mmss(t):
    return f'{int(t // 60):02d}:{t % 60:04.1f}'


cards = [c for b in tl['beats'] for c in b['subs']]
with open(os.path.join(OUT, 'qollanma.srt'), 'w', encoding='utf-8') as f:
    for i, c in enumerate(cards, 1):
        f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")

titles = {s['id']: s['title'] for s in tl['scenes']}
title = json.load(open(os.path.join(ROOT, 'narration', 'script.json'), encoding='utf-8')).get('title', 'Instruksiya video')
lines = [f'# {title}: diktor ssenariysi', '', f"Ovoz: {tl['voice']}. Umumiy davomiylik: {mmss(tl['total'])}.", '']
cur = None
for b in tl['beats']:
    if b['scene'] != cur:
        cur = b['scene']
        sc = next(s for s in tl['scenes'] if s['id'] == cur)
        lines += ['', f"## {titles[cur]} ({mmss(sc['start'])} – {mmss(sc['end'])})", '', '| # | Vaqt | Ekranda | Diktor matni | Audio |', '|---|---|---|---|---|']
    lines.append(f"| {b['id']} | {mmss(b['voiceStart'])} – {mmss(b['voiceEnd'])} | {b.get('show', '')} | {b['say']} | `{os.path.basename(b['audio'])}` |")
open(os.path.join(OUT, 'diktor-ssenariy.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

for name in ('script.json', 'timeline.json', 'events.json'):
    shutil.copy(os.path.join(ROOT, 'narration', name), os.path.join(OUT, name))
aud = os.path.join(OUT, 'audio')
os.makedirs(aud, exist_ok=True)
for b in tl['beats']:
    shutil.copy(os.path.join(ROOT, b['audio']), aud)
print(f"export: {len(cards)} subtitle cards, {len(tl['beats'])} beats -> {os.path.relpath(OUT, ROOT)}")
