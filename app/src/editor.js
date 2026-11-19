// The editor: state, undo/redo history, photo loading, panel picking and dragging,
// and all control wiring. The cover itself is drawn by cover-renderer.js, so the
// preview and the exported PNG are always the same picture.

import { renderCover } from './cover-renderer.js';
import { GRADES, gradeById } from './grades.js';
import { LAYOUTS, layoutById, layoutGeometry } from './layouts.js';
import { EXPORT_SIZES, sizeById, exportOneSize, exportAllSizes, exportCoverPng } from './export-png.js';

/** Sample photos bundled with the app, made with an image model for make.fun. */
export const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
  { id: 'neon', name: 'Neon Night', src: 'samples/neon.jpg' },
];

/** One-click cover templates: layout + grade + caption in one move. */
export const PRESETS = [
  { id: 'sunset-heist', name: 'Sunset Heist', layout: 'grid9', grade: 'vice-sunset', title: 'Sunset Heist', subtitle: 'neon coast nights' },
  { id: 'boulevard-queen', name: 'Boulevard Queen', layout: 'hero-three', grade: 'palm-gold', title: 'Boulevard Queen', subtitle: 'golden hour, every hour' },
  { id: 'pier-pressure', name: 'Pier Pressure', layout: 'full-bleed', grade: 'teal-pink', title: 'Pier Pressure', subtitle: 'catch of the day' },
  { id: 'night-shift', name: 'Night Shift', layout: 'tilted', grade: 'neon-night', title: 'Night Shift', subtitle: 'the city never sleeps' },
];

// Deterministic crop offsets so the default cover shows one photo nine ways.
const CROP_SPREAD = [
  [0, 0], [-0.18, 0.05], [0.18, -0.04], [-0.05, -0.14], [0.12, 0.12],
  [-0.14, -0.1], [0.08, -0.16], [-0.1, 0.14], [0.16, 0.06],
];

/** The fresh default state: the boulevard sample filling every panel. */
export function createDefaultState() {
  return {
    layout: 'grid9',
    grade: 'vice-sunset',
    gradeIntensity: 0.9,
    title: 'Sunset Heist',
    subtitle: 'neon coast nights',
    titleSize: 1,
    letterSpacing: 0.02,
    outline: true,
    grain: true,
    vignette: true,
    palms: true,
    size: 'wide',
    photos: [{ id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' }],
    panels: CROP_SPREAD.map(([ox, oy]) => ({ photoId: 'boulevard', zoom: 1.25, ox, oy })),
  };
}

/** Pads or trims the panel slots to the current layout's panel count. */
export function ensurePanels(state) {
  const count = layoutById(state.layout).panels;
  const first = state.photos[0]?.id ?? null;
  while (state.panels.length < count) {
    const i = state.panels.length;
    const [ox, oy] = CROP_SPREAD[i % CROP_SPREAD.length];
    state.panels.push({ photoId: first, zoom: 1.25, ox, oy });
  }
  state.panels.length = count;
}

/** Loads an image element from a URL or data URL. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** Creates the editor: wires the controls, renders the preview, returns its API. */
export function initEditor(doc, preview) {
  const state = createDefaultState();
  ensurePanels(state);
  const images = new Map();
  const history = [];
  let historyIndex = -1;
  let selected = 0;
  let renderQueued = false;
  let drag = null;

  const $ = (id) => doc.getElementById(id);

  // ---- history -------------------------------------------------------------
  function snapshot() {
    const { photos, ...rest } = state;
    return JSON.stringify(rest);
  }
  function pushHistory() {
    history.length = historyIndex + 1;
    history.push(snapshot());
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
    syncUndoButtons();
  }
  function applySnapshot(json) {
    const saved = JSON.parse(json);
    const photos = state.photos;
    Object.assign(state, saved);
    state.photos = photos;
    ensurePanels(state);
    selected = Math.min(selected, state.panels.length - 1);
  }
  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    applySnapshot(history[historyIndex]);
    syncAll();
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    applySnapshot(history[historyIndex]);
    syncAll();
  }
  function syncUndoButtons() {
    $('undo').disabled = historyIndex <= 0;
    $('redo').disabled = historyIndex >= history.length - 1;
  }

  // ---- rendering -----------------------------------------------------------
  function previewSize() {
    const size = sizeById(state.size);
    const max = 860;
    const scale = Math.min(1, max / Math.max(size.w, size.h));
    return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
  }
  function render() {
    const { w, h } = previewSize();
    renderCover(preview, w, h, state, images);
    // The cover scene shows the finished cover alone, with no editor chrome.
    if (!doc.body.classList.contains('shot-cover')) drawSelectionOverlay(w, h);
  }
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }
  function drawSelectionOverlay(w, h) {
    const ctx = preview.getContext('2d');
    const geo = layoutGeometry(state.layout, w, h);
    geo.panels.forEach((panel, i) => {
      const px = panel.x * w;
      const py = panel.y * h;
      const pw = panel.w * w;
      const ph = panel.h * h;
      ctx.save();
      if (panel.rot) {
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((panel.rot * Math.PI) / 180);
        ctx.translate(-(px + pw / 2), -(py + ph / 2));
      }
      if (i === selected) {
        ctx.lineWidth = Math.max(2, w * 0.004);
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = '#ffd166';
        ctx.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
        ctx.setLineDash([]);
      }
      // Panel number badge, so the grid reads as numbered panels.
      ctx.fillStyle = i === selected ? '#ffd166' : 'rgba(13, 3, 22, 0.75)';
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i === selected ? '#160418' : '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px + 16, py + 17);
      ctx.restore();
    });
  }

  // ---- photos --------------------------------------------------------------
  async function addPhoto(photo) {
    if (!images.has(photo.id)) images.set(photo.id, await loadImage(photo.src));
    if (!state.photos.some((p) => p.id === photo.id)) state.photos.push(photo);
    renderPhotoStrip();
  }
  async function loadSample(id) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    await addPhoto(sample);
    state.panels.forEach((slot) => { slot.photoId = sample.id; });
    pushHistory();
    queueRender();
  }
  function renderPhotoStrip() {
    const strip = $('photoStrip');
    strip.innerHTML = '';
    state.photos.forEach((photo) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.title = `Use ${photo.name} in the selected panel`;
      const img = doc.createElement('img');
      img.src = photo.src;
      img.alt = photo.name;
      const span = doc.createElement('span');
      span.textContent = photo.name;
      b.append(img, span);
      b.addEventListener('click', () => {
        const slot = state.panels[selected];
        if (slot) { slot.photoId = photo.id; pushHistory(); queueRender(); }
      });
      strip.appendChild(b);
    });
  }

  // ---- panel picking and dragging ------------------------------------------
  function panelAt(clientX, clientY) {
    const rect = preview.getBoundingClientRect();
    const x = (clientX - rect.left) * (preview.width / rect.width);
    const y = (clientY - rect.top) * (preview.height / rect.height);
    const geo = layoutGeometry(state.layout, preview.width, preview.height);
    for (let i = geo.panels.length - 1; i >= 0; i--) {
      const p = geo.panels[i];
      const px = p.x * preview.width;
      const py = p.y * preview.height;
      const pw = p.w * preview.width;
      const ph = p.h * preview.height;
      let lx = x - (px + pw / 2);
      let ly = y - (py + ph / 2);
      if (p.rot) {
        const a = (-p.rot * Math.PI) / 180;
        const rx = lx * Math.cos(a) - ly * Math.sin(a);
        const ry = lx * Math.sin(a) + ly * Math.cos(a);
        lx = rx; ly = ry;
      }
      if (Math.abs(lx) <= pw / 2 && Math.abs(ly) <= ph / 2) return { index: i, x, y, pw, ph };
    }
    return null;
  }
  preview.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e.clientX, e.clientY);
    if (!hit) return;
    selected = hit.index;
    const slot = state.panels[selected];
    drag = { x: hit.x, y: hit.y, pw: hit.pw, ph: hit.ph, ox: slot.ox, oy: slot.oy };
    preview.setPointerCapture(e.pointerId);
    syncPanelControls();
    queueRender();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (preview.width / rect.width);
    const y = (e.clientY - rect.top) * (preview.height / rect.height);
    const slot = state.panels[selected];
    slot.ox = Math.max(-0.6, Math.min(0.6, drag.ox + (x - drag.x) / drag.pw));
    slot.oy = Math.max(-0.6, Math.min(0.6, drag.oy + (y - drag.y) / drag.ph));
    syncPanelControls();
    queueRender();
  });
  preview.addEventListener('pointerup', () => {
    if (drag) { drag = null; pushHistory(); }
  });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const hit = panelAt(e.clientX, e.clientY);
    if (!hit) return;
    selected = hit.index;
    const slot = state.panels[selected];
    slot.zoom = Math.max(1, Math.min(2.5, slot.zoom * Math.exp(-e.deltaY * 0.0012)));
    syncPanelControls();
    queueRender();
  }, { passive: false });

  // ---- controls ------------------------------------------------------------
  function buildLayoutButtons() {
    const wrap = $('layoutButtons');
    LAYOUTS.forEach((layout) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.textContent = layout.name;
      b.title = layout.describe;
      b.addEventListener('click', () => {
        state.layout = layout.id;
        ensurePanels(state);
        selected = Math.min(selected, state.panels.length - 1);
        pushHistory();
        syncAll();
      });
      wrap.appendChild(b);
    });
  }
  function buildGradeButtons() {
    const wrap = $('gradeButtons');
    GRADES.forEach((grade) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'grade-swatch';
      b.title = grade.name;
      const ramp = grade.ramp.map(([t, r, g, bl]) => `rgb(${r},${g},${bl}) ${Math.round(t * 100)}%`).join(', ');
      b.style.background = `linear-gradient(135deg, ${ramp})`;
      const label = doc.createElement('span');
      label.textContent = grade.name;
      b.appendChild(label);
      b.addEventListener('click', () => {
        state.grade = grade.id;
        pushHistory();
        syncAll();
      });
      wrap.appendChild(b);
    });
  }
  function buildPresetButtons() {
    const wrap = $('presetButtons');
    PRESETS.forEach((preset) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'choice preset';
      b.textContent = preset.name;
      b.addEventListener('click', () => {
        state.layout = preset.layout;
        state.grade = preset.grade;
        state.title = preset.title;
        state.subtitle = preset.subtitle;
        state.gradeIntensity = 0.9;
        ensurePanels(state);
        pushHistory();
        syncAll();
      });
      wrap.appendChild(b);
    });
  }
  function buildSampleButtons() {
    const wrap = $('sampleButtons');
    SAMPLES.forEach((sample) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.textContent = sample.name;
      b.addEventListener('click', () => loadSample(sample.id));
      wrap.appendChild(b);
    });
  }
  function buildSizeButtons() {
    const wrap = $('sizeButtons');
    EXPORT_SIZES.forEach((size) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'choice size-choice';
      b.textContent = `${size.w} × ${size.h}`;
      b.addEventListener('click', () => {
        state.size = size.id;
        pushHistory();
        syncAll();
      });
      wrap.appendChild(b);
    });
  }

  function syncChoiceButtons(wrapId, activeId, key) {
    const wrap = $(wrapId);
    [...wrap.children].forEach((b, i) => {
      const list = key === 'layout' ? LAYOUTS : key === 'grade' ? GRADES : EXPORT_SIZES;
      b.classList.toggle('active', list[i].id === activeId);
    });
  }
  function syncAll() {
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('titleSize').value = String(Math.round(state.titleSize * 100));
    $('letterSpacing').value = String(Math.round(state.letterSpacing * 1000));
    $('gradeIntensity').value = String(Math.round(state.gradeIntensity * 100));
    $('grainToggle').checked = state.grain;
    $('vignetteToggle').checked = state.vignette;
    $('palmsToggle').checked = state.palms;
    $('outlineToggle').checked = state.outline;
    syncChoiceButtons('layoutButtons', state.layout, 'layout');
    syncChoiceButtons('gradeButtons', state.grade, 'grade');
    syncChoiceButtons('sizeButtons', state.size, 'size');
    syncPanelControls();
    syncUndoButtons();
    queueRender();
  }
  function syncPanelControls() {
    const slot = state.panels[selected];
    if (!slot) return;
    $('panelLabel').textContent = `Panel ${selected + 1} of ${state.panels.length}`;
    $('panelZoom').value = String(Math.round(slot.zoom * 100));
    $('panelOffsetX').value = String(Math.round(slot.ox * 100));
    $('panelOffsetY').value = String(Math.round(slot.oy * 100));
  }

  function bindControls() {
    $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; queueRender(); });
    $('titleInput').addEventListener('change', pushHistory);
    $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; queueRender(); });
    $('subtitleInput').addEventListener('change', pushHistory);
    $('titleSize').addEventListener('input', (e) => { state.titleSize = Number(e.target.value) / 100; queueRender(); });
    $('titleSize').addEventListener('change', pushHistory);
    $('letterSpacing').addEventListener('input', (e) => { state.letterSpacing = Number(e.target.value) / 1000; queueRender(); });
    $('letterSpacing').addEventListener('change', pushHistory);
    $('gradeIntensity').addEventListener('input', (e) => { state.gradeIntensity = Number(e.target.value) / 100; queueRender(); });
    $('gradeIntensity').addEventListener('change', pushHistory);
    $('outlineToggle').addEventListener('change', (e) => { state.outline = e.target.checked; pushHistory(); queueRender(); });
    $('grainToggle').addEventListener('change', (e) => { state.grain = e.target.checked; pushHistory(); queueRender(); });
    $('vignetteToggle').addEventListener('change', (e) => { state.vignette = e.target.checked; pushHistory(); queueRender(); });
    $('palmsToggle').addEventListener('change', (e) => { state.palms = e.target.checked; pushHistory(); queueRender(); });
    $('panelZoom').addEventListener('input', (e) => {
      const slot = state.panels[selected];
      if (slot) { slot.zoom = Number(e.target.value) / 100; queueRender(); }
    });
    $('panelZoom').addEventListener('change', pushHistory);
    $('panelOffsetX').addEventListener('input', (e) => {
      const slot = state.panels[selected];
      if (slot) { slot.ox = Number(e.target.value) / 100; queueRender(); }
    });
    $('panelOffsetX').addEventListener('change', pushHistory);
    $('panelOffsetY').addEventListener('input', (e) => {
      const slot = state.panels[selected];
      if (slot) { slot.oy = Number(e.target.value) / 100; queueRender(); }
    });
    $('panelOffsetY').addEventListener('change', pushHistory);
    $('shuffleCrops').addEventListener('click', () => {
      state.panels.forEach((slot, i) => {
        const [ox, oy] = CROP_SPREAD[(i * 3 + 1) % CROP_SPREAD.length];
        slot.ox = ox; slot.oy = oy; slot.zoom = 1.15 + (i % 3) * 0.15;
      });
      pushHistory();
      queueRender();
    });
    $('resetPanel').addEventListener('click', () => {
      const slot = state.panels[selected];
      if (slot) { slot.zoom = 1; slot.ox = 0; slot.oy = 0; pushHistory(); syncAll(); }
    });
    $('undo').addEventListener('click', undo);
    $('redo').addEventListener('click', redo);
    doc.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    });
    $('photoInput').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      for (const file of files) {
        const src = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const id = `upload-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const photo = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo', src };
        await addPhoto(photo);
        state.panels.forEach((slot) => { if (!slot.photoId) slot.photoId = id; });
      }
      pushHistory();
      queueRender();
    });
    $('exportOne').addEventListener('click', async () => {
      const size = sizeById(state.size);
      $('status').textContent = 'Rendering PNG…';
      const name = await exportOneSize(state, images, size);
      $('status').textContent = `Saved ${name}`;
    });
    $('exportAll').addEventListener('click', async () => {
      $('status').textContent = 'Rendering three PNGs…';
      const names = await exportAllSizes(state, images);
      $('status').textContent = `Saved ${names.join(', ')}`;
    });
  }

  // ---- public API ----------------------------------------------------------
  buildLayoutButtons();
  buildGradeButtons();
  buildPresetButtons();
  buildSampleButtons();
  buildSizeButtons();
  bindControls();
  pushHistory();
  syncAll();

  return {
    state,
    images,
    render: queueRender,
    renderNow: render,
    loadSample,
    addPhoto,
    applyPreset(preset) {
      state.layout = preset.layout;
      state.grade = preset.grade;
      state.title = preset.title;
      state.subtitle = preset.subtitle;
      ensurePanels(state);
      pushHistory();
      syncAll();
    },
    setPhotos(photoIds) {
      state.panels.forEach((slot, i) => {
        slot.photoId = photoIds[i % photoIds.length];
      });
      queueRender();
    },
    /** Renders the cover at exact size and resolves to a PNG data URL (used by tests). */
    exportDataUrl(w, h) {
      return exportCoverPng(state, images, w, h).then((blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }));
    },
  };
}
