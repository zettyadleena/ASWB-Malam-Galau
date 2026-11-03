# Malam Galau — ASWB promo video

15-second, 1080×1920 (9:16) 3D animated promo for **Malam Galau** (19 Dec 2026, Atrium APU), for an IG story or reel.
It's built in Three.js in a low-poly style, with the colours of the event poster.

**Final video:** `output/malam-galau-aswb.mp4` (no audio. Add the bridge of *Pulang* by Insomniacks in IG or CapCut.)

| Time | Shot |
|---|---|
| 0.0 – 4.0s | APU main entrance at night, in the rain. Camera pushes in and flies through the glowing doors |
| 4.0 – 7.6s | Inside the atrium, from the upper-floor railing looking down. Crowd with phone lights, fairy lights. Camera descends toward the stage |
| 7.6 – 10.4s | Singer close-up (black hair, plain tee, acoustic guitar) singing at the mic. Full band behind |
| 10.4 – 12.6s | Reverse shot over the singer's shoulder: crowd singing along, phone flashlights swaying |
| 12.6 – 15.0s | ASWB logo reveal with stars, embers and rain |

Cut points are at the top of `src/main.js` (`const T = {...}`). If they don't land on the beat, change them and re-render.

## Render

```bash
npm install
node render.cjs --stills 1,5,9,14 --scale 0.5     # quick preview stills -> frames/preview/
node render.cjs                                  # all 450 frames -> frames/seq/
ffmpeg -framerate 30 -i frames/seq/f%04d.jpg -c:v libx264 -crf 17 -pix_fmt yuv420p output/malam-galau-aswb.mp4
```

Needs Node, Playwright's Chromium and ffmpeg.
