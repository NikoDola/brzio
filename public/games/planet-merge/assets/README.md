# Custom Assets

Drop your own images here to replace the procedural shapes in the game.

## Image naming (place in `assets/images/`)

| File          | Size  | Default shape |
|---------------|-------|---------------|
| `shape_0.png` | 15%   | Dot (circle)  |
| `shape_1.png` | 30%   | Triangle      |
| `shape_2.png` | 40%   | Square        |
| `shape_3.png` | 55%   | Pentagon      |
| `shape_4.png` | 70%   | Hexagon       |
| `shape_5.png` | 85%   | Octagon       |
| `shape_6.png` | 100%  | Sphere (circle)|

The game auto-loads each file. If one is missing, the procedural shape is the fallback —
so you can replace just the levels you want.

## Image tips

- Square images (same width & height) work best — the game scales to fit the collision radius.
- PNG with transparency looks cleanest.
- 256×256 px or larger recommended.

## Asset path in game.js

The loader currently looks for `assets/shape_N.png` (relative to index.html).
To use the `images/` subfolder update the path in `game.js` line:

    img.src = `assets/images/shape_${i}.png`;

## Sounds

Place `merge.mp3` and `background.mp3` here. Hook them up in `game.js` inside `flushMerges()`
and the boot section respectively — the structure is ready, just no audio code yet.

## Running a local server (required for image loading)

Browsers block image loading via `file://` — use a local HTTP server:

    # Python 3
    python -m http.server 8080

    # Node / npx
    npx serve .

    # VS Code: install "Live Server" → click "Go Live"

Then open http://localhost:8080
