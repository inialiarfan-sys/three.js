# The Worst Planet Ever Discovered: toon edition

An animated explainer about the exoplanet HD 189733 b, made in plain Three.js with Vite and TypeScript. It has a cel-shaded pastel look and a chibi astronaut host.

## Quick start (Windows, PowerShell or cmd)

```bash
cd glass-planet-toon
npm install
npm run dev            # live preview: http://localhost:5173
npm run render:all     # out/glass-planet-toon_vertical.mp4 + out/glass-planet-toon_wide.mp4
```

`npm install` downloads Chrome for Puppeteer and a static ffmpeg build through `ffmpeg-static`. To use your own copies instead:

```bash
set FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

To render only part of the film for quick checks, use `npm run render:vertical -- --from 40 --to 55`. To save PNG stills, use `node scripts/stills.mjs wide 14.5 80`.

Preview keys: **Space** plays or pauses, and **← / →** jumps back or forward 2 s.

## How it works

* **One timeline function.** `render(t)` in `src/main.ts` draws the frame for `t` seconds into the audio. Every animation is a pure function of `t`: springs, walk cycles, particles and captions. Randomness comes from seeded generators. The preview calls `render(audio.currentTime)`. The offline renderer calls `render(i / 30)` for every frame, so any `t` always gives the same frame.
* **The audio sets the timing.** `src/timeline.ts` fuzzy-matches about 60 anchor phrases against the word timings in `src/data/transcript.json`, in order. Scene cuts, number pop-ins and pose changes all hang off those anchors. If you record new narration, replace the mp3 and transcript.json and nothing else changes. If a phrase is missing from the recording, its time is estimated and a warning is logged.
* **Two outputs from the same scenes.** `src/stage.ts` frames each shot with a fit-radius camera, so a scene works at 9:16 and 16:9. Layout slots (captions, numbers, host) are set per format. In vertical, text stays clear of TikTok's top bar, right-hand buttons and bottom sheet.
* **Render pipeline.** `scripts/render.mjs` starts Vite, opens the page in headless Chrome and reads each frame with `gl.readPixels`. It pipes raw RGBA into ffmpeg (`libx264 -crf 18 -preset veryfast -pix_fmt yuv420p`), then muxes the narration with `-c:v copy`. Output goes to `*.tmp.mp4` and is renamed only when ffmpeg succeeds.

## Look

* **Shading:** `MeshToonMaterial` with a 3-step gradient map, plus inverted-hull outlines (`src/engine/toon.ts`).
* **Post-processing:** soft bloom, then the host sprite drawn after bloom so her white suit stays crisp. A final pass adds heat shimmer, paper texture, vignette and seeded grain (`src/engine/post.ts`).
* **2D layer:** speed lines, focus lines, spring-popped numbers in Fredoka, and karaoke captions with the spoken word on a peach pill (`src/engine/hud.ts`).

## Character sprites

The sprites in `public/character/` were cut from the two green-screen sheets (`sheet_gestures.jpg`, `sheet_walk.jpg`) by `tools/extract_sprites.py`. It works in this order:

1. Soft chroma key.
2. Despill.
3. Connected components grouped per grid cell.
4. A 1 px alpha erode, so there are no halos.

All 8 walk frames share one canvas and one baseline. `sprites.json` stores each sprite's foot anchor, so every pose is drawn at the same scale with its feet in the same place.

The walk sheet has 16 frames. The cycle uses rows 1 and 3 (neutral face). The expression heads used in the reaction bubbles are cropped from the gesture poses.

To swap in your own cleaned PNGs, keep the same file names and run the script once to refresh `sprites.json`, or edit `w`, `h`, `footX` and `footY` by hand.

```bash
pip install numpy scipy pillow
python tools/extract_sprites.py public/character
```

## Transcript

`src/data/transcript.json` (word timings) was made from the narration with `tools/transcribe.py` (faster-whisper `small.en`). If you have the transcript from the original glass-planet project, drop it in: the format is `{ "words": [ { "word", "start", "end" } ] }`.

## Scenes

1. Cold open: glass rain, wind, 1,000°C, stink
2. Title
3. HD 189733 b: zoom out from the Sun to the galaxy and in to a distant star
4. 6,000+ exoplanets
5. 64 light-years
6. Transit and starlight
7. Deep blue, no oceans
8. Glass in the clouds and silica
9. Bigger than Jupiter, 2-day year
10. 1,000°C
11. Day side and night side
12. Supersonic winds
13. Sideways glass rain
14. 2024, James Webb, H₂S
15. A scientific idea
16. Blue marble, then deadly up close
17. Home
18. "But you can."
19. Ending
