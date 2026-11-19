// Boots the cover studio: builds the editor, loads the default sample photo, and
// runs a fixed ?shot= scene for screenshots instead of the live editor when asked.

import { initEditor, SAMPLES } from './editor.js';
import { runShot } from './shots.js';

const preview = document.getElementById('preview');
const editor = initEditor(document, preview);

// The app's own test hook: renders the current cover at exact size as a PNG data URL.
window.__exportPng = (w, h) => editor.exportDataUrl(w, h);
window.__editor = editor;

const query = new URLSearchParams(location.search);
const shot = query.get('shot');

async function boot() {
  // Fonts first: Anton and Pacifico are local files under app/fonts/.
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('20px Pacifico'),
    ]);
  } catch { /* the canvas falls back to sans-serif; the export still works */ }

  if (shot) {
    await runShot(shot, query, async ({ photos, caption, subtitle, layout, grade, size }) => {
      for (const id of photos) {
        const sample = SAMPLES.find((s) => s.id === id);
        if (sample) await editor.addPhoto(sample);
      }
      editor.state.layout = layout;
      editor.state.grade = grade;
      editor.state.title = caption;
      editor.state.subtitle = subtitle;
      editor.state.size = size;
      editor.setPhotos(photos);
      // Rebuild the panel list for the shot layout, then re-render.
      const { ensurePanels } = await import('./editor.js');
      ensurePanels(editor.state);
      editor.state.panels.forEach((slot, i) => {
        slot.photoId = photos[i % photos.length];
      });
      editor.renderNow();
    });
  } else {
    await editor.loadSample('boulevard');
    editor.renderNow();
  }
}

boot();
