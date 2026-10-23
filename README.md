# trxsh-video

**Sayt → to'liq instruksiya video.** Claude Code uchun skill. U istalgan sayt yoki kabinetning
barcha funksiyalarini kirishdan sozlamalargacha qadam-baqadam tushuntiradigan ovozli video yasaydi.

- Sayt ekranlari kodda (Remotion) aniq qayta chiziladi, faqat demo ma'lumotlar bilan.
- Ovoz Google AI Studio'dan (Gemini TTS) olinadi. Skill bitta gapni 3–4 xil ovozda (masalan, Charon, Sadaltager, Kore, Sulafat) namuna qilib beradi, ovozni siz tanlaysiz.
- Ovozni qanday yaratishni ham o'zingiz tanlaysiz: **AI Studio web panel** orqali (brauzerda, o'z akkauntingiz bilan) yoki **API** orqali (bepul kalit, tezroq).
- Videoning vaqti tanlangan ovozning haqiqiy uzunligiga moslanadi. Google ishlatilmasa, bepul edge-tts ovozi ham bor.
- Kursor bosadi va yozadi, kamera kerakli joyga yaqinlashadi, tushuntirilayotgan element halqa bilan belgilanadi.
- Subtitrlar, bo'limlar chizig'i, har bo'lim uchun alohida MP4, SRT va QA hisobot chiqadi.
- Ovozni tasvirni qayta render qilmasdan almashtirish mumkin.

**Site → full instruction video.** A Claude Code skill that turns any website or web app into a
narrated step-by-step tutorial video covering every feature: the site's screens rebuilt in
Remotion with demo data, TTS narration, an animated cursor, camera zooms, highlight rings,
subtitles, a chapter bar and one MP4 per section.

## O'rnatish / Install

```bash
npx skills add Leonxlnx/cinetic          # required: scaffold and motion engine
npx skills add cladtech123-cell/trxsh-video
```

Requirements: Node 18+, Python 3.10+, Chrome; `pip install edge-tts soundfile numpy scipy pyloudnorm imageio-ffmpeg pillow`.

## Ishlatish / Use

Claude Code'ga oddiy so'z bilan yozing, masalan:

> https://example.uz saytining barcha funksiyalari bo'yicha o'zbekcha instruksiya video yasab ber, login'dan sozlamalargacha

Skill quyidagilarni bajaradi:
1. Saytni brauzerda bo'lim-bo'lim o'rganadi. Saytga kirishni siz o'zingiz qilasiz.
2. Loyihani ochadi va ekranlarni qayta chizadi.
3. Ssenariy yozadi. Keyin ovoz yaratish yo'lini (web panel yoki API) so'raydi, 3–4 ta ovoz namunasini yuboradi, siz tanlagan ovozda barcha gaplarni yaratadi.
4. Avval sinov kliplarini, keyin to'liq videoni render qiladi.
5. Videoni qismlarga bo'ladi va QA tekshiruvini o'tkazadi.

Qo'lda ishlatish:

```bash
bash <cinetic>/scripts/new-film.sh films/mysite --fps 60 --size 1920x1080
python <trxsh-video>/scripts/add_tutorial.py films/mysite
cd films/mysite && . tools/env.sh
python tools/narrate.py                              # vaqt uchun dastlabki o'tish (edge-tts)
python tools/gemini_tts.py --samples                 # 4 ta ovoz namunasi (API) -> narration/voice-samples/
python tools/gemini_tts.py --voice Charon            # tanlangan ovozda barcha gaplar
bash tools/build-tutorial.sh mysite narration/gemini-charon   # -> out/tutorials/mysite.mp4
python tools/cut_parts.py out/tutorials/mysite.mp4
```

Shablonda ishlaydigan namuna bor: kirish, qidiruv va qo'shish oynasi bilan ro'yxat, sozlamalar.
Ular `template/src/tutorial/screens.tsx` va `template/narration/script.json` fayllarida.

## Tarkib / Contents

| | |
|---|---|
| `SKILL.md` | ish jarayoni (agent uchun) |
| `references/` | ssenariy formati, ekranlarni qayta chizish, ovozlar (edge-tts, Gemini/Charon), QA, tuzoqlar |
| `template/` | tutorial dvigateli, UI to'plami, namuna ekranlar va ssenariy, `tools/` |
| `scripts/add_tutorial.py` | shablonni cinetic loyihasiga qo'shadi |

## Litsenziya / License

MIT. Shablonning bir qismi [cinetic](https://github.com/Leonxlnx/cinetic) (MIT) Remotion starter'iga asoslangan, qarang: `LICENSE`.
