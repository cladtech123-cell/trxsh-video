// npx tsx scripts/tutorial-events.ts -> narration/events.json: every press and keystroke of the
// narrated tutorial, from the same event engine the picture uses (src/tutorial/events.ts).
import { writeFileSync } from 'node:fs';
import { FPS, soundEvents, TOTAL } from '../src/tutorial/events';

const ev = soundEvents();
writeFileSync('narration/events.json', JSON.stringify({ fps: FPS, frames: TOTAL, events: ev }, null, 1));
console.log(`wrote narration/events.json: ${ev.length} events (${ev.filter((e) => e.kind === 'click').length} clicks, ${ev.filter((e) => e.kind === 'key').length} keys)`);
