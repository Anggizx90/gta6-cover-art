// Cover layouts: each layout is a function of the cover size in pixels returning the
// panel rectangles (fractions of width/height, with an optional tilt in degrees) and
// the title block rectangle. Panels are drawn in order; later panels sit on top.

/**
 * A panel: x, y, w, h as fractions of the cover, rot in degrees around its centre.
 * @typedef {{x:number,y:number,w:number,h:number,rot?:number}} PanelRect
 */

/** The six layouts, in the order the editor shows them. */
export const LAYOUTS = [
  { id: 'grid9', name: 'Cover Grid', panels: 9, describe: 'Nine-panel poster grid' },
  { id: 'hero-three', name: 'Hero + Three', panels: 4, describe: 'One hero panel, three stacked' },
  { id: 'full-bleed', name: 'Full Bleed', panels: 1, describe: 'One photo edge to edge' },
  { id: 'tilted', name: 'Tilted Snaps', panels: 4, describe: 'Tilted snapshot collage' },
  { id: 'diagonal', name: 'Diagonal Split', panels: 3, describe: 'Diagonal two-shot plus strip' },
  { id: 'poster-strip', name: 'Poster Strip', panels: 5, describe: 'Tall feature panel, four small' },
];

/** Looks a layout up by id, falling back to the grid. */
export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/**
 * Returns { panels, title } for a layout at cover size (W, H).
 * The title block sits in the bottom band for every layout except full-bleed,
 * where it floats over the photo.
 */
export function layoutGeometry(layoutId, W, H) {
  const m = 0.018; // outer margin, fraction of width
  const g = 0.012; // gap between panels, fraction of width
  const titleH = H * 0.205;
  const top = H * 0.016;
  const bottom = H - titleH - H * 0.016;
  const left = W * m;
  const right = W * (1 - m);
  const photoH = bottom - top;
  const photoW = right - left;
  const gap = W * g;

  let panels = [];
  if (layoutId === 'grid9') {
    const cw = (photoW - gap * 2) / 3;
    const ch = (photoH - gap * 2) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({
          x: (left + c * (cw + gap)) / W,
          y: (top + r * (ch + gap)) / H,
          w: cw / W,
          h: ch / H,
        });
      }
    }
  } else if (layoutId === 'hero-three') {
    const heroW = photoW * 0.6;
    const sideX = left + heroW + gap;
    const sideW = right - sideX;
    const sh = (photoH - gap * 2) / 3;
    panels.push({ x: left / W, y: top / H, w: heroW / W, h: photoH / H });
    for (let r = 0; r < 3; r++) {
      panels.push({
        x: sideX / W,
        y: (top + r * (sh + gap)) / H,
        w: sideW / W,
        h: sh / H,
      });
    }
  } else if (layoutId === 'full-bleed') {
    panels.push({ x: 0, y: 0, w: 1, h: 1 });
  } else if (layoutId === 'tilted') {
    const cw = photoW * 0.485;
    const ch = photoH * 0.485;
    const cx = left + photoW / 2;
    const cy = top + photoH / 2;
    panels = [
      { x: (cx - cw - gap / 2) / W, y: (cy - ch - gap / 2) / H, w: cw / W, h: ch / H, rot: -4 },
      { x: (cx + gap / 2) / W, y: (cy - ch - gap / 2) / H, w: cw / W, h: ch / H, rot: 3 },
      { x: (cx - cw - gap / 2) / W, y: (cy + gap / 2) / H, w: cw / W, h: ch / H, rot: 2.5 },
      { x: (cx + gap / 2) / W, y: (cy + gap / 2) / H, w: cw / W, h: ch / H, rot: -3 },
    ];
  } else if (layoutId === 'diagonal') {
    // Two big panels split on a diagonal (clipped in the renderer), plus a strip.
    const splitW = photoW * 0.58;
    panels = [
      { x: left / W, y: top / H, w: splitW / W, h: photoH / H, clip: 'diag-left' },
      { x: (left + splitW - gap) / W, y: top / H, w: (right - left - splitW + gap) / W, h: photoH * 0.62 / H, clip: 'diag-right' },
      { x: (left + splitW - gap) / W, y: (top + photoH * 0.62 + gap) / H, w: (right - left - splitW + gap) / W, h: (photoH * 0.38 - gap) / H },
    ];
  } else {
    // poster-strip
    const featW = photoW * 0.42;
    const sideX = left + featW + gap;
    const sideW = right - sideX;
    const cw = (sideW - gap) / 2;
    const ch = (photoH - gap) / 2;
    panels.push({ x: left / W, y: top / H, w: featW / W, h: photoH / H });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        panels.push({
          x: (sideX + c * (cw + gap)) / W,
          y: (top + r * (ch + gap)) / H,
          w: cw / W,
          h: ch / H,
        });
      }
    }
  }

  const title = layoutId === 'full-bleed'
    ? { x: 0.05, y: 0.72, w: 0.9, h: 0.24 }
    : { x: 0.02, y: (H - titleH - H * 0.012) / H, w: 0.96, h: titleH / H };
  return { panels, title };
}
