// Fixed scenes for screenshots: ?shot=cover shows a finished exported cover alone,
// ?shot=editor shows the editor with a sample photo loaded. The query also takes
// photo (a sample name), caption, layout, grade and size. window.__shotReady is set
// once the scene has painted, so a screenshot tool knows when to capture.

/** Applies a shot scene. `setup` loads the sample photos and applies the preset. */
export async function runShot(shot, query, setup) {
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'neon coast nights';
  const layout = query.get('layout') ?? 'grid9';
  const grade = query.get('grade') ?? 'vice-sunset';
  const size = query.get('size') ?? 'wide';
  const photos = (query.get('photos') ?? query.get('photo') ?? 'boulevard').split(',');
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await setup({ photos, caption, subtitle, layout, grade, size });
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
