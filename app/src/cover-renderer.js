// Draws the whole cover onto a 2D canvas: inked photo panels, gradient-mapped
// grades, the halftone title block, badge ribbon, palm silhouettes, grain and vignette.
// Everything is drawn here, so the preview and the exported PNG are the same picture.

import { gradeById, gradeImage } from './grades.js';
import { layoutGeometry } from './layouts.js';

// Graded photo canvases, keyed by photo + grade + panel size, so dragging a photo
// reuses the graded pixels instead of re-grading on every frame.
const gradedCache = new Map();
function gradedPhoto(image, photoId, grade, intensity, gw, gh) {
  const key = `${photoId}|${grade.id}|${intensity.toFixed(2)}|${gw}x${gh}`;
  let hit = gradedCache.get(key);
  if (hit) return hit;
  hit = gradeImage(image, gw, gh, grade, intensity);
  if (gradedCache.size > 24) gradedCache.delete(gradedCache.keys().next().value);
  gradedCache.set(key, hit);
  return hit;
}

// One small noise tile, reused as the film-grain pattern.
let noiseTile = null;
function grainPattern(ctx) {
  if (!noiseTile) {
    noiseTile = document.createElement('canvas');
    noiseTile.width = 140;
    noiseTile.height = 140;
    const nctx = noiseTile.getContext('2d');
    const img = nctx.createImageData(140, 140);
    let seed = 20261119;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }
  return ctx.createPattern(noiseTile, 'repeat');
}

/** Draws one stylised palm silhouette, trunk and fronds, at (x, y) with height s. */
export function drawPalm(ctx, x, y, s, color, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lean, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // Trunk: a curving tapered column.
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.quadraticCurveTo(s * 0.03, -s * 0.5, s * 0.10, -s * 0.92);
  ctx.quadraticCurveTo(s * 0.13, -s * 0.95, s * 0.13, -s * 0.92);
  ctx.quadraticCurveTo(s * 0.08, -s * 0.5, s * 0.05, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: seven curved leaves fanning from the crown.
  const tx = s * 0.115;
  const ty = -s * 0.93;
  for (let i = 0; i < 7; i++) {
    const a = (-160 + i * 52) * Math.PI / 180;
    const len = s * (0.34 + (i % 3) * 0.05);
    const tipX = tx + Math.cos(a) * len;
    const tipY = ty + Math.sin(a) * len * 0.55 + len * 0.22;
    const midX = tx + Math.cos(a) * len * 0.55;
    const midY = ty + Math.sin(a) * len * 0.4 - s * 0.05;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + Math.cos(a + 0.5) * len * 0.2, midY + s * 0.06, tx, ty);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Clips the context to a panel rectangle, honouring a diagonal seam. */
function clipPanel(ctx, px, py, pw, ph, clip) {
  ctx.beginPath();
  if (clip === 'diag-left') {
    const slant = pw * 0.16;
    ctx.moveTo(px, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw - slant, py + ph);
    ctx.lineTo(px, py + ph);
  } else if (clip === 'diag-right') {
    const slant = pw * 0.16;
    ctx.moveTo(px + slant, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px, py + ph);
  } else {
    ctx.rect(px, py, pw, ph);
  }
  ctx.closePath();
  ctx.clip();
}

/** Draws one photo panel: graded photo, cover-fit with zoom and offset, inked border. */
function drawPanel(ctx, panel, slot, state, images, grade, W) {
  const px = panel.x * W;
  const py = panel.y * state.coverH;
  const pw = panel.w * W;
  const ph = panel.h * state.coverH;
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  ctx.save();
  if (panel.rot) { ctx.translate(cx, cy); ctx.rotate((panel.rot * Math.PI) / 180); ctx.translate(-cx, -cy); }
  // Drop shadow behind the panel.
  ctx.fillStyle = 'rgba(10, 2, 18, 0.4)';
  const sh = Math.max(3, W * 0.006);
  ctx.fillRect(px + sh, py + sh, pw, ph);
  clipPanel(ctx, px, py, pw, ph, panel.clip);
  const image = slot?.photoId ? images.get(slot.photoId) : null;
  if (image) {
    const gw = Math.max(2, Math.ceil(pw * 1.5));
    const gh = Math.max(2, Math.ceil(ph * 1.5));
    const graded = gradedPhoto(image, slot.photoId, grade, state.gradeIntensity, gw, gh);
    const zoom = slot.zoom ?? 1;
    const dw = pw * zoom;
    const dh = ph * zoom;
    const dx = cx - dw / 2 + (slot.ox ?? 0) * pw;
    const dy = cy - dh / 2 + (slot.oy ?? 0) * ph;
    ctx.drawImage(graded, dx, dy, dw, dh);
    // Warm tint wash over the photo, from the grade's overlay colours.
    const wash = ctx.createLinearGradient(px, py, px, py + ph);
    wash.addColorStop(0, grade.overlayTop);
    wash.addColorStop(1, grade.overlayBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(px, py, pw, ph);
  } else {
    const bg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    bg.addColorStop(0, '#3a1445');
    bg.addColorStop(1, '#160a24');
    ctx.fillStyle = bg;
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();
  // Inked border: a thick white frame with a thin dark inner line, poster style.
  ctx.save();
  if (panel.rot) { ctx.translate(cx, cy); ctx.rotate((panel.rot * Math.PI) / 180); ctx.translate(-cx, -cy); }
  const bw = Math.max(3, W * 0.005);
  ctx.lineWidth = bw;
  ctx.strokeStyle = '#fdf6ec';
  ctx.strokeRect(px + bw / 2, py + bw / 2, pw - bw, ph - bw);
  ctx.lineWidth = Math.max(1, W * 0.0012);
  ctx.strokeStyle = 'rgba(20, 4, 28, 0.85)';
  ctx.strokeRect(px + bw + 1, py + bw + 1, pw - 2 * bw - 2, ph - 2 * bw - 2);
  ctx.restore();
}

/** Draws the halftone dot field across the top of the title band. */
function drawHalftone(ctx, x, y, w, h, W) {
  const step = Math.max(7, W * 0.016);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const dx = x + col * step + step / 2;
      const dy = y + row * step + step / 2;
      const fade = 1 - row * step / h;
      const r = step * 0.16 + step * 0.26 * fade * (0.5 + 0.5 * Math.sin(col * 0.9));
      ctx.fillStyle = `rgba(255, 214, 160, ${0.05 + 0.20 * fade})`;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Draws the title block: band, halftone, big Anton title, Pacifico subtitle. */
function drawTitleBlock(ctx, title, state, W, H) {
  const bx = title.x * W;
  const by = title.y * H;
  const bw = title.w * W;
  const bh = title.h * H;
  ctx.save();
  // Band.
  const band = ctx.createLinearGradient(bx, by, bx, by + bh);
  band.addColorStop(0, '#1d0a2b');
  band.addColorStop(1, '#0d0316');
  ctx.fillStyle = band;
  if (state.layout === 'full-bleed') {
    ctx.globalAlpha = 0.88;
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillRect(bx, by, bw, bh);
  }
  // Hot top edge.
  const edge = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  edge.addColorStop(0, '#ff2e88');
  edge.addColorStop(0.5, '#ff7a3d');
  edge.addColorStop(1, '#ffd166');
  ctx.fillStyle = edge;
  ctx.fillRect(bx, by, bw, Math.max(3, H * 0.004));
  drawHalftone(ctx, bx, by + Math.max(3, H * 0.004), bw, bh * 0.42, W);

  const text = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  const midY = by + bh * (sub ? 0.44 : 0.56);
  if (text) {
    let size = bh * 0.52 * (state.titleSize ?? 1);
    const ls = state.letterSpacing ?? 0.02;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    do {
      ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * ls}px`;
    } while (ctx.measureText(text).width > bw * 0.94 && size > 10 && (size -= 2));
    const grad = ctx.createLinearGradient(0, midY - size * 0.5, 0, midY + size * 0.55);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffe9b0');
    grad.addColorStop(1, '#ff8a3d');
    ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = grad;
    if (state.outline !== false) {
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#160418';
      ctx.strokeText(text, bx + bw / 2, midY);
    }
    ctx.fillText(text, bx + bw / 2, midY);
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  if (sub) {
    const subSize = bh * 0.21;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 93, 162, 0.9)';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillStyle = '#ff8fb8';
    ctx.fillText(sub, bx + bw / 2, by + bh * 0.82);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** Draws the tilted badge ribbon in the top corner. */
function drawBadge(ctx, W, H) {
  const s = W / 1080;
  const bw = 250 * s;
  const bh = 52 * s;
  ctx.save();
  ctx.translate(W * 0.045 + bw / 2, H * 0.045 + bh / 2);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10 * s;
  ctx.shadowOffsetY = 4 * s;
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, '#ff2e88');
  g.addColorStop(1, '#ff7a3d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, -bh / 2);
  ctx.lineTo(bw / 2, -bh / 2);
  ctx.lineTo(bw / 2 - 14 * s, bh / 2);
  ctx.lineTo(-bw / 2 + 14 * s, bh / 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${30 * s}px Anton, 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ NEON COAST ★', 0, 2 * s);
  ctx.restore();
}

/**
 * Renders the full cover. `state` is the editor state; `images` maps photo ids to
 * loaded HTMLImageElements. The canvas is resized to (W, H) first.
 */
export function renderCover(canvas, W, H, state, images) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  const geo = layoutGeometry(state.layout, W, H);
  const full = { ...state, coverH: H };

  // Sky background: deep violet fading to hot pink at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1c0a33');
  sky.addColorStop(0.55, '#4b1450');
  sky.addColorStop(0.8, '#a12a6e');
  sky.addColorStop(1, '#ff7a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Sun glow behind the panels.
  const sun = ctx.createRadialGradient(W * 0.72, H * 0.42, 0, W * 0.72, H * 0.42, W * 0.55);
  sun.addColorStop(0, 'rgba(255, 190, 90, 0.5)');
  sun.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  geo.panels.forEach((panel, i) => {
    drawPanel(ctx, panel, state.panels[i], full, images, grade, W);
  });

  // Palm silhouettes at the cover's bottom corners, drawn over the panels so the
  // fronds read against the photos, under the title block.
  if (state.palms !== false) {
    drawPalm(ctx, W * 0.008, H * 0.82, H * 0.30, 'rgba(12, 2, 22, 0.95)', 1);
    drawPalm(ctx, W * 0.992, H * 0.84, H * 0.26, 'rgba(12, 2, 22, 0.95)', -1);
  }

  drawTitleBlock(ctx, geo.title, full, W, H);
  drawBadge(ctx, W, H);

  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette !== false) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(8, 0, 16, 0)');
    v.addColorStop(1, 'rgba(8, 0, 16, 0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  return canvas;
}
