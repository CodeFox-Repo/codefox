// Renders hero-canvas.jpg as a photo that dissolves into "f"/"x" ASCII glyphs
// toward the left edge and outer borders (11X-style hero treatment).
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC =
  process.env.ASCII_SRC ?? path.join(__dirname, '../frontend/public/hero-canvas.jpg');

const W = 2400;
const H = 1600; // 3:2

// ponytail: variants are just parameter sets over the same renderer.
// mask: 'left' = left half dissolves (v1), 'edges' = 11X-style border-only,
//       'bottom' = dissolves upward from the ground.
const VARIANTS = {
  'ascii-v1-left': { cell: 12, mask: 'left', dim: 0.85, mono: false },
  'ascii-v2-edges': { cell: 12, mask: 'edges', dim: 0.9, mono: false },
  'ascii-v3-fine': { cell: 7, mask: 'left', dim: 0.75, mono: false },
  'ascii-v4-bottom': { cell: 9, mask: 'bottom', dim: 0.8, mono: false },
};

// ponytail: 4x4 Bayer matrix for dithered f/x choice, plain array math, no dep.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function smoothstep(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// How "ascii" a point is: 0 = pure photo, 1 = pure glyphs.
// The focal area (light beam + foxes, right-of-center) stays photographic.
function maskAt(nx, ny, kind) {
  const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny) * 2;
  const edgeMask = 1 - smoothstep(edgeDist, 0, 0.18);
  if (kind === 'edges') {
    // border-only dissolve, like the 11X hero frame
    const wide = 1 - smoothstep(edgeDist, 0, 0.42);
    return Math.min(1, Math.max(edgeMask, wide * 0.9));
  }
  if (kind === 'bottom') {
    const vMask = smoothstep(ny, 0.45, 0.95);
    return Math.min(1, Math.max(vMask, edgeMask));
  }
  const hMask = 1 - smoothstep(nx, 0.15, 0.75); // fades out toward the right
  return Math.min(1, Math.max(hMask, edgeMask));
}

async function render(name, { cell: CELL, mask, dim: dimMax, mono }) {
  const prefix = process.env.ASCII_PREFIX ?? 'hero';
  const OUT = path.join(__dirname, `../frontend/public/${prefix}-${name}.png`);
  const { data: photo } = await sharp(SRC)
    .resize(W, H, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);

  // Sample average color per cell and build the glyph SVG layer.
  const texts = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * CELL;
      const y0 = row * CELL;
      const cx = Math.min(x0 + CELL / 2, W - 1);
      const cy = Math.min(y0 + CELL / 2, H - 1);
      if (maskAt(cx / W, cy / H, mask) < 0.02) continue; // pure photo here, skip glyph

      const x1 = Math.min(x0 + CELL, W);
      const y1 = Math.min(y0 + CELL, H);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * W + x) * 3;
          r += photo[i]; g += photo[i + 1]; b += photo[i + 2];
          n++;
        }
      }
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const threshold = BAYER[row % 4][col % 4] / 16;
      const ch = lum > threshold ? 'f' : 'x';
      // on dark scenes lighten glyphs; on paper mode deepen them instead so
      // they stay legible against the light page they fade into
      let lr, lg, lb;
      if (process.env.ASCII_PAPER) {
        lr = Math.round(r * 0.72); lg = Math.round(g * 0.72); lb = Math.round(b * 0.72);
      } else {
        lr = Math.min(255, Math.round(r + (255 - r) * 0.25));
        lg = Math.min(255, Math.round(g + (255 - g) * 0.25));
        lb = Math.min(255, Math.round(b + (255 - b) * 0.25));
      }
      if (mono) {
        // single warm-paper tone, brightness from luminance — reads as pure ASCII art
        const v = 0.35 + lum * 0.65;
        lr = Math.round(232 * v); lg = Math.round(216 * v); lb = Math.round(188 * v);
      }
      texts.push(
        `<text x="${x0}" y="${y0 + CELL * 0.9}" font-size="${CELL * 1.25}" fill="rgb(${lr},${lg},${lb})">${ch}</text>`
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>text { font-family: Menlo, Consolas, 'Courier New', monospace; font-weight: 600; }</style>
    ${texts.join('\n')}
  </svg>`;

  const { data: glyphs } = await sharp(Buffer.from(svg))
    .png()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const a = maskAt(nx, ny, mask);
      const pi = (y * W + x) * 3;
      const gi = (y * W + x) * 4;
      const glyphAlpha = a * (glyphs[gi + 3] / 255);
      const dim = 1 - a * dimMax;
      for (let c = 0; c < 3; c++) {
        // paper mode fades the photo toward warm paper instead of black,
        // for light scenes (11X fades to its cream page background)
        const paper = [250, 247, 240][c];
        const photoV = process.env.ASCII_PAPER
          ? photo[pi + c] * dim + paper * (1 - dim)
          : photo[pi + c] * dim;
        const glyphV = glyphs[gi + c];
        out[pi + c] = Math.round(photoV * (1 - glyphAlpha) + glyphV * glyphAlpha);
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toFile(OUT);

  console.log(`wrote ${OUT}`);
}

const only = process.argv[2];
for (const [name, opts] of Object.entries(VARIANTS)) {
  if (only && name !== only) continue;
  await render(name, opts);
}
