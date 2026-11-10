# The Planet We Are Missing

A 3D animated documentary short about super-Earths, made in plain Three.js with Vite and TypeScript. It has a cute toon look and Luna as the host.

## Quick start (Windows, PowerShell or cmd)

```bash
cd super-earth
npm install
npm run dev                      # live preview at http://localhost:5173
npm run still -- 142.6 vertical  # one PNG frame in out/stills/
npm run render:all               # out/the-planet-we-are-missing_vertical.mp4 + _wide.mp4
```

`npm install` downloads Chrome for Puppeteer and a static ffmpeg build through `ffmpeg-static`. To use your own copies instead:

```bash
set FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Other commands:

* `npm run render:vertical -- --from 40 --to 55` renders only part of the film.
* `npm run still -- 14 80.5 141 wide` saves several stills in one run.
* `npm run still -- $(npx tsx tools/qa-times.ts) vertical` saves the busiest frame of every scene. That `$( )` syntax works in bash; in PowerShell, paste the times instead.
* `npm run timing` regenerates `src/data/timing-report.md`.

Preview controls: play/pause, a seek bar (it also reaches the silent 1.5 s tail), a vertical/wide toggle, and the current scene name. **Space** plays or pauses, and **← / →** jumps back or forward 2 s.

## How it works

* **One timeline function.** `render(t)` in `src/main.ts` draws the frame for `t` seconds into the audio. All motion is a pure function of `t`: springs, hops, wobble, particles and captions. Randomness is seeded (`src/engine/math.ts`). The preview calls `render(audio.currentTime)`, and the renderer calls `render(i / 30)` for every frame. The same `t` always gives the same frame.
* **The audio sets the timing.** `src/timeline.ts` lists 83 anchor phrases: 22 scene starts plus every gag, reaction and fact. They are fuzzy-matched in order against the word timings in `src/data/transcript.json`. A scene runs from its anchor to the next scene's anchor. If an anchor isn't found, it is placed proportionally between its neighbours, with a warning on the console and in the timing report. Gags key off single words with `wordAfter()`, for example the "go" words in "go, go, go".
* **Length.** The video is the audio length plus 1.5 s; the tail is silent and fades out.
* **Captions.** They are drawn on the page canvas, so the render captures them. Each shows 1–3 short lines with the spoken word highlighted. Spellings are fixed from the script ("super-Earth", "55 Cancri e", "LHS 1140 b", "K2-18 b", "Luna", "ten"). In vertical, captions stay clear of TikTok's top bar, right-hand buttons and bottom sheet.
* **Two formats.** Both use the same scenes. `src/stage.ts` fits each shot into 9:16 and 16:9 and sets the layout slots (captions, facts, Luna) per format.
* **Rendering.** `scripts/render.mjs` uses Puppeteer and reads each frame with `gl.readPixels`. Raw RGBA goes into ffmpeg with `libx264 -crf 18 -preset veryfast -pix_fmt yuv420p`, then the narration is added with `-c:v copy`. Output goes to a `.tmp.mp4` and is renamed only when ffmpeg succeeds.

## Swapping the audio (re-recording)

1. Replace `public/narration.mp3` (or use `narration.wav`).
2. Re-transcribe once with word timestamps:
   ```bash
   pip install faster-whisper        # or: pip install openai-whisper
   python tools/transcribe.py --model small.en     # or medium.en
   ```
   This writes `src/data/transcript.json`. Either Whisper package works, and the script picks whichever is installed.
3. Run `npm run timing` and read `src/data/timing-report.md`. Any anchor marked **estimated** wasn't found in your new reading; adjust its phrase in `src/timeline.ts` if needed.
4. Run `npm run dev` to check it, then render.

## Swapping the character sheet

The sprites live in `public/character/`. They are cut out by `tools/extract_sprites.py` from these sheets:

* `sheet_new.png`: the 4×4 emotion poses (the main source).
* `sheet_gestures.jpg`: waving, thinking and laptop.
* `sheet_walk.jpg`: only frame 1 is used, as the side view. There is no walk cycle; Luna hops.

```bash
pip install "rembg[cpu]" pillow numpy scipy
python tools/extract_sprites.py
```

The extraction works in this order:

1. A 2x Lanczos upscale.
2. A rembg (`isnet-anime`) mask fused with a soft green-screen key.
3. Connected components on the alpha mask. Characters are the big blobs; labels, stars, hearts, "!", "?" and puffs are dropped.
4. Defringing: edge pixels take the colour of their opaque neighbours, so there are no halos.
5. 20 px of transparent padding.

It writes the PNGs, `sprites.json` (size and foot anchor, so every sprite shares one scale) and `preview.png`. Always check `preview.png` after re-extracting. If your sheet has a different layout, edit the `NEW` / `OLD` name lists in the script.

**Not on the current sheets** (runtime fallbacks are in `src/luna.ts`, `ALIAS`):

| Wanted | Used instead |
|---|---|
| `casual` (Earth, ending) | `front` (astronaut, facing the camera) |
| `back` (stargazing) | `astronaut_sit` drawn as a dark rim-lit silhouette |
| `winter` | 3D puffy toon jackets built in code (they stack to 10 for the gag) |
| `peace`, `thumbs_up` | the excited and cheering poses |

To add the real ones, put `casual.png`, `back.png` or `winter.png` (green-screen cut-outs) in `public/character/`. Add their names to `SPRITES` in `src/luna.ts` and their sizes to `sprites.json`; the extractor's `save()` does that for you.

## Luna's motion

`src/motion.ts` is pure functions of `t`; there is no walk cycle.

* `hops()`: short arcs (0.3–0.4 s each) with a lean at the top, a stretch on take-off and a squash on landing, plus a ±6° wobble.
* `idle()`: breathing and a slight sway.
* `leap()`: one big jump, for example into the ship.
* `float()`: underwater drift.
* `tremble()`: shaking from fear.

The cat on her head lags behind her body by 0.1 s; the sprite shader rotates the cat band. Pose swaps pop with a spring. Reaction bubbles spring in, hold, pop out, and flip so they stay inside the frame.

## Files

| File | What it is |
|---|---|
| `src/timeline.ts` | anchors, fuzzy matching, captions, spelling fixes |
| `src/scenes-a.ts`, `src/scenes-b.ts` | the 23 scenes (title + 22) |
| `src/world.ts`, `src/planets.ts`, `src/ship.ts` | props, procedural planets, the rocket |
| `src/luna.ts`, `src/motion.ts` | Luna's sprite, bubbles, silhouette, hop motion |
| `src/engine/*` | toon materials and outlines, post-processing (bloom, vignette, grain), canvas text layer |
| `scripts/render.mjs`, `scripts/still.mjs` | offline rendering |
| `tools/*` | transcription, sprite extraction, timing report, QA times |
