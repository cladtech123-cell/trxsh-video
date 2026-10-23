# Driving the AI Studio web panel (Generate speech)

Use this route when the user chose the web panel: their own signed-in Google account in their
browser (Claude in Chrome, or the browser tool). They sign in; you never type credentials.
Ask once for permission to download, with the count ("4 samples", then "12 files of ~8 beats").

## Set up the page

1. Open `https://aistudio.google.com/generate-speech` (the model can be pinned with
   `?model=gemini-3.8-flash-tts`; pick the newest Flash TTS model the page offers).
2. Single-speaker mode. Speaker settings card → search the voice name (e.g. "Charon") → select →
   close the panel. Check the card now shows that voice.
3. Install these helpers in the page (javascript tool). They are lost on reload: re-install.

```js
window.__fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
window.__hashNow = () => { const a = document.querySelector('audio'); const src = (a || {}).src || ''; const i = src.indexOf('base64,'); return i < 0 ? '' : window.__fnv(src.slice(i + 7)); };
window.__runBtn = () => [...document.querySelectorAll('button')].find(b => /^Run/.test(b.innerText.trim()));
// Wait for one generation: Run disappears while generating and comes back with a new full audio.
window.__wait = async (maxMs = 60000) => {
  const t0 = Date.now(); let started = !window.__runBtn();
  while (Date.now() - t0 < maxMs) {
    await new Promise(r => setTimeout(r, 400));
    const run = window.__runBtn();
    if (!run) { started = true; continue; }
    if (!started) { if (Date.now() - t0 > 8000) return { ok: false, err: 'not started' }; continue; }
    const a = document.querySelector('audio'); const len = ((a || {}).src || '').length;
    if (len > 50000) {
      await new Promise(r => setTimeout(r, 600));
      const h = window.__hashNow();
      if (h === window.__lastHash) return { ok: false, err: 'same audio as before' };
      window.__lastHash = h; if (a) a.pause();
      return { ok: true, h, len };
    }
  }
  return { ok: false, err: started ? 'still generating' : 'not started' };
};
window.__lastHash = window.__hashNow();
```

## One generation

1. Click into the text block, select all (ctrl+a), **type** the text (real typing: setting the
   value from JS is ignored by the page's editor).
2. Click Run, then `await window.__wait()`.
3. On `ok`, find the Download button (its ref changes whenever the player is rebuilt) and click it;
   wait ~2 s for the file.
4. File it: `python tools/studio_collect.py --voice Charon login.1:<h>` (one beat; `<h>` from
   `__wait` makes the script refuse an old or partial file), `--group <ids>` for a group, or
   `--samples <voices>` for samples.

## When it misbehaves

- `not started` / the player disappears: wait until Run is back, click Run again, re-find Download.
- Run stays disabled after many generations: reload, "Create new dialog", reselect the voice,
  re-install the helpers, retype.
- "Quota limit reached" dialog: the page's quota is spent and its reset time is not shown. Do not
  click any billing or plan button; tell the user, and offer the API route (separate quota) or
  waiting.
- A hash mismatch from studio_collect: the newest download is not the new audio; nothing was
  moved. Identify files by hash and size, move duplicates to a temp folder (never delete).
