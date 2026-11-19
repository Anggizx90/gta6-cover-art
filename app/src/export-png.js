// PNG export: renders the cover at an exact post size on an offscreen canvas and
// downloads it with canvas.toBlob, so the file the user gets is the renderer output.

import { renderCover } from './cover-renderer.js';

/** The three post sizes the bounty asks for. */
export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

/** Looks a size up by id. */
export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[0];
}

/** Renders the cover at (w, h) and resolves to a PNG Blob. */
export function exportCoverPng(state, images, w, h) {
  const canvas = document.createElement('canvas');
  renderCover(canvas, w, h, state, images);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

/** Downloads a Blob as a file with the given name. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Exports one size and downloads it. Returns the filename. */
export async function exportOneSize(state, images, size) {
  const blob = await exportCoverPng(state, images, size.w, size.h);
  const filename = `neon-coast-cover-${size.w}x${size.h}.png`;
  downloadBlob(blob, filename);
  return filename;
}

/** Exports all three post sizes, one download each, in order. */
export async function exportAllSizes(state, images) {
  const names = [];
  for (const size of EXPORT_SIZES) {
    names.push(await exportOneSize(state, images, size));
    await new Promise((r) => setTimeout(r, 120));
  }
  return names;
}
