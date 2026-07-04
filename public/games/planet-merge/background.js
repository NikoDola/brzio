/* ════════════════════════════════════════════════════════════════════════
   background.js  —  the animated galaxy behind the playfield
   ════════════════════════════════════════════════════════════════════════

   Drawn on a single full-viewport canvas (#bg-starfield) behind the whole
   game, NOT as DOM elements. One canvas with ~100 cheap arcs costs far less
   than 100 blurred, individually-composited <span>s, and it lets us add a
   baked nebula plus soft star halos for a real galaxy look.

   Fully self-contained: nothing outside this file reads or writes its state.
   Importing it is enough to start the starfield. */

let bodyStarConfig = {
  baseBlinkMs: 2600,
  groups: [
    { label: "1 blink", blinks: 1, count: 30 },
    { label: "2 blinks", blinks: 2, count: 30 },
    { label: "3 blinks", blinks: 3, count: 30 },
    { label: "5 blinks", blinks: 5, count: 10 },
  ],
  starSize: { min: 2, max: 4 },
  colors: ["#ffffff", "#7ddfff", "#feca57"],
};

const bgCanvas = document.getElementById("bg-starfield");
const bgCtx = bgCanvas ? bgCanvas.getContext("2d") : null;
let bgW = 0;
let bgH = 0;
let bgNebula = null; // baked offscreen: nebula glow, redrawn only on resize
let bgStars = []; // { xf, yf, size, color, period, phase, glow }

// Soft round glow sprites, one per colour, pre-rendered once. drawImage of a
// cached sprite is cheap; building a radial gradient per star per frame is not.
const glowSpriteCache = new Map();
function glowSprite(color) {
  if (glowSpriteCache.has(color)) return glowSpriteCache.get(color);
  const s = 48;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  glowSpriteCache.set(color, c);
  return c;
}

// Bake the nebula (a few big soft colour blobs) once per size. Drawn each
// frame as a single drawImage, so it costs nothing to keep on screen.
function buildBgNebula() {
  if (!bgCtx) return;
  const c = document.createElement("canvas");
  c.width = bgW;
  c.height = bgH;
  const g = c.getContext("2d");
  const span = Math.max(bgW, bgH);
  const blobs = [
    { x: bgW * 0.24, y: bgH * 0.28, r: span * 0.55, color: "rgba(86,46,150,0.20)" },
    { x: bgW * 0.78, y: bgH * 0.62, r: span * 0.60, color: "rgba(32,84,168,0.18)" },
    { x: bgW * 0.55, y: bgH * 0.12, r: span * 0.42, color: "rgba(170,64,128,0.12)" },
  ];
  for (const b of blobs) {
    const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grad.addColorStop(0, b.color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(0, 0, bgW, bgH);
  }
  bgNebula = c;
}

function resizeBgStarfield() {
  if (!bgCtx) return;
  // Rendered at CSS-pixel resolution on purpose (no devicePixelRatio). The
  // backdrop is soft glows and 2-4px dots behind the playfield, so HiDPI
  // sharpness is invisible here, and rendering at 2x DPR quadruples the
  // pixels cleared, drawn, and composited every frame.
  bgW = window.innerWidth;
  bgH = window.innerHeight;
  bgCanvas.width = bgW;
  bgCanvas.height = bgH;
  bgCanvas.style.width = `${bgW}px`;
  bgCanvas.style.height = `${bgH}px`;
  bgCtx.setTransform(1, 0, 0, 1, 0, 0);
  buildBgNebula();
}

function pickBodyStarSize() {
  const { min, max } = bodyStarConfig.starSize;
  return Math.round(min + Math.random() * (max - min));
}

// Rebuild the star list from the current config. Positions are fractions of
// the viewport so a resize never needs a rebuild, only a re-bake of nebula.
function buildBgStars() {
  bgStars = [];
  let index = 0;
  for (const group of bodyStarConfig.groups) {
    const period = bodyStarConfig.baseBlinkMs * group.blinks;
    for (let i = 0; i < group.count; i += 1) {
      const color = bodyStarConfig.colors[index % bodyStarConfig.colors.length];
      bgStars.push({
        xf: Math.random(),
        yf: Math.random(),
        size: pickBodyStarSize(),
        color,
        period,
        phase: Math.random() * Math.PI * 2,
        glow: Math.random() < 0.22, // ~1 in 5 gets a soft halo
      });
      index += 1;
    }
  }
}

// The galaxy twinkles slowly, so redrawing it at ~30fps is visually identical
// to 60fps and halves the cost of this full-viewport canvas.
const BG_FRAME_MS = 33;
let bgLastDraw = 0;

function drawBgStarfield(t) {
  if (!bgCtx) return;
  requestAnimationFrame(drawBgStarfield);
  if (t - bgLastDraw < BG_FRAME_MS) return;
  bgLastDraw = t;
  bgCtx.clearRect(0, 0, bgW, bgH);
  if (bgNebula) bgCtx.drawImage(bgNebula, 0, 0, bgW, bgH);
  for (const s of bgStars) {
    // Twinkle: alpha breathes between 0.2 and 1 over the star's period.
    const tw = 0.2 + 0.8 * (Math.sin((t / s.period) * Math.PI * 2 + s.phase) * 0.5 + 0.5);
    const x = s.xf * bgW;
    const y = s.yf * bgH;
    if (s.glow) {
      const sprite = glowSprite(s.color);
      const d = s.size * 9;
      bgCtx.globalAlpha = tw * 0.5;
      bgCtx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
    }
    bgCtx.globalAlpha = tw;
    bgCtx.fillStyle = s.color;
    bgCtx.beginPath();
    bgCtx.arc(x, y, s.size, 0, Math.PI * 2);
    bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;
}

// Boot the background galaxy: size the canvas, build stars, start its own
// lightweight render loop, and re-bake on resize (positions are fractional).
if (bgCtx) {
  resizeBgStarfield();
  buildBgStars();
  window.addEventListener("resize", resizeBgStarfield);
  requestAnimationFrame(drawBgStarfield);
} else {
  buildBgStars();
}
