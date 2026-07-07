# VANTA

Cinematic scroll-scrub site for VANTA — a fictional 1,200-horsepower electric hypercar.

Scrolling drives the car through a continuous desert journey: dust reveal → flat-out run → red-rock canyon → night mode. A speed HUD climbs 0→250 mph with scroll progress.

## How it works

- All visuals were generated with **Seedance 2.0** (Bytedance) via the Higgsfield MCP: one hero image anchors the look, and four 8-second drive clips are chained start-to-end frame so the journey is continuous.
- The film is exploded into a JPEG frame sequence (`assets/frames/` + `manifest.json`) and drawn onto a canvas pinned inside a tall scroll section — no video element, so scrubbing is frame-exact in both directions.
- Plain HTML/CSS/JS. No build step, no dependencies.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

## Rebuild the film

Drop `clip1.mp4`…`clip4.mp4` into `pipeline/` and run `pipeline/build_frames.sh` (requires ffmpeg; the script uses the binary from the `imageio-ffmpeg` Python package).

---

VANTA is fictional. No cars were harmed.
