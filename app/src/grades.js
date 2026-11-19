// Colour grades for the cover maker: each grade is a gradient map (luminance -> colour
// ramp) plus a tint overlay. Applied on canvas with ImageData, never with CSS filters,
// so the exported PNG carries exactly the grade the preview shows.

/** All grades, in the order the editor shows them. ramp stops are [position, r, g, b]. */
export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    ramp: [[0, 22, 8, 46], [0.25, 91, 26, 94], [0.5, 196, 58, 122], [0.75, 255, 122, 61], [1, 255, 217, 160]],
    overlayTop: 'rgba(255, 110, 80, 0.10)',
    overlayBottom: 'rgba(120, 20, 110, 0.28)',
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    ramp: [[0, 2, 1, 10], [0.3, 11, 16, 53], [0.55, 122, 31, 162], [0.8, 255, 46, 136], [1, 125, 249, 255]],
    overlayTop: 'rgba(30, 80, 255, 0.12)',
    overlayBottom: 'rgba(255, 30, 140, 0.22)',
  },
  {
    id: 'palm-gold',
    name: 'Palm Gold',
    ramp: [[0, 20, 15, 2], [0.3, 107, 74, 18], [0.55, 201, 138, 43], [0.8, 247, 201, 72], [1, 255, 243, 196]],
    overlayTop: 'rgba(255, 190, 60, 0.14)',
    overlayBottom: 'rgba(120, 60, 0, 0.22)',
  },
  {
    id: 'teal-pink',
    name: 'Teal / Pink',
    ramp: [[0, 2, 20, 26], [0.35, 14, 95, 107], [0.6, 214, 51, 132], [1, 255, 214, 236]],
    overlayTop: 'rgba(0, 220, 200, 0.10)',
    overlayBottom: 'rgba(255, 40, 150, 0.24)',
  },
  {
    id: 'noir',
    name: 'Noir',
    ramp: [[0, 0, 0, 0], [0.2, 18, 18, 24], [0.5, 96, 96, 104], [0.8, 205, 205, 212], [1, 255, 255, 255]],
    overlayTop: 'rgba(10, 10, 30, 0.16)',
    overlayBottom: 'rgba(0, 0, 0, 0.30)',
  },
  {
    id: 'faded-film',
    name: 'Faded Film',
    ramp: [[0, 42, 42, 51], [0.5, 138, 138, 148], [1, 242, 237, 228]],
    overlayTop: 'rgba(255, 240, 210, 0.12)',
    overlayBottom: 'rgba(40, 40, 60, 0.18)',
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    ramp: [[0, 18, 0, 46], [0.3, 255, 46, 99], [0.6, 255, 159, 28], [1, 255, 230, 109]],
    overlayTop: 'rgba(255, 60, 160, 0.10)',
    overlayBottom: 'rgba(80, 0, 160, 0.20)',
  },
];

/** Looks a grade up by id, falling back to the first grade. */
export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** Builds a 256-entry luminance lookup table from a grade's ramp stops. */
export function buildGradeLUT(grade) {
  const lut = new Uint8Array(256 * 3);
  const stops = grade.ramp;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  return lut;
}

const lutCache = new Map();

/**
 * Returns a new canvas holding `image` drawn at (w, h) with the grade's gradient
 * map applied, blended toward the original by `intensity` (0 = original, 1 = full grade).
 */
export function gradeImage(image, w, h, grade, intensity) {
  const key = `${grade.id}:${intensity.toFixed(2)}`;
  let lut = lutCache.get(key);
  if (!lut) { lut = buildGradeLUT(grade); lutCache.set(key, lut); }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, c.width, c.height);
  if (intensity <= 0) return c;
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const k = Math.min(1, Math.max(0, intensity));
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    const o = lum * 3;
    px[i] = px[i] + (lut[o] - px[i]) * k;
    px[i + 1] = px[i + 1] + (lut[o + 1] - px[i + 1]) * k;
    px[i + 2] = px[i + 2] + (lut[o + 2] - px[i + 2]) * k;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}
