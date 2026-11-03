# Malam Galau — ASWB promo video

30-second (plus the original 15-second cut), 1080×1920 (9:16) 3D animated promo for **Malam Galau** (19 Dec 2026, Atrium APU), for an IG story or reel.
It's built in Three.js in a low-poly style, with the colours of the event poster.

**Final video:** `output/malam-galau-aswb-30s.mp4` (no audio. Add the bridge of *Pulang* by Insomniacks in IG or CapCut.)
The 15-second version is `output/malam-galau-aswb.mp4` (made from an earlier commit).

| Time | Shot |
|---|---|
| 0.0 – 4.5s | Night sky, moon and rain. Camera tilts down onto the APU building |
| 4.5 – 7.5s | Low along the wet road past the street lamps, then flies through the glowing main entrance |
| 7.5 – 11.0s | Atrium from the top-floor railing, looking straight down at the crowd's phone lights. Camera descends |
| 11.0 – 13.5s | From a 2nd-floor balcony behind the railing: fairy lights, flags, stage below |
| 13.5 – 16.5s | Singer close-up (black hair, plain tee, acoustic guitar) singing at the mic |
| 16.5 – 18.5s | Low orbit around the guitarist |
| 18.5 – 21.0s | Reverse over the singer's shoulder: crowd singing with phone flashlights |
| 21.0 – 23.5s | Walking up the aisle through the crowd toward the stage |
| 23.5 – 26.0s | Wide finale: crane up from the back of the hall |
| 26.0 – 30.0s | ASWB logo reveal with stars, embers and rain |

Cut points are at the top of `src/main.js` (`const T = {...}`). If they don't land on the beat, change them and re-render.

## Render

```bash
npm install
node render.cjs --stills 1,5,9,14 --scale 0.5     # quick preview stills -> frames/preview/
node render.cjs                                  # all 900 frames -> frames/seq/
ffmpeg -framerate 30 -i frames/seq/f%04d.jpg -c:v libx264 -crf 17 -pix_fmt yuv420p output/malam-galau-aswb.mp4
```

Needs Node, Playwright's Chromium and ffmpeg.
