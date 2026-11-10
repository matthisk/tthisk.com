'use strict';
/* ==========================================================================
   Main: camera, render loop, input, minimap, top bar, start-up.
   ========================================================================== */

const canvas = $('#world'), ctx = canvas.getContext('2d');
const mm = $('#minimap'), mmCtx = mm.getContext('2d');
const topEl = $('#top'), hudEl = $('#hud');
let W = innerWidth, H = innerHeight, DPR = Math.min(2, devicePixelRatio || 1);
const cam = { x: 0, y: 0, tx: null, ty: null };
let zoom = 1;
const mouse = { x: -1, y: -1, in: false };
const keys = new Set();
const pings = [];
let selBox = null;

function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;
  const mw = mm.clientWidth || 244, mh = mm.clientHeight || 122;
  mm.width = mw * DPR; mm.height = mh * DPR;
  minimapDirty = true;
}
addEventListener('resize', resize);

/* ---------- camera ---------- */
const topH = () => topEl.offsetHeight, hudH = () => hudEl.offsetHeight;
const screenToWorld = (sx, sy) => [sx / zoom + cam.x, sy / zoom + cam.y];
const worldToScreen = (wx, wy) => [(wx - cam.x) * zoom, (wy - cam.y) * zoom];
function viewCenter() { return [W / 2, (topH() + H - hudH()) / 2]; }
function centerOn(tx, ty, instant) {
  const [wx, wy] = P(tx, ty), [vx, vy] = viewCenter();
  const nx = wx - vx / zoom, ny = wy - vy / zoom;
  if (instant || reduced) { cam.x = nx; cam.y = ny; cam.tx = null; } else { cam.tx = nx; cam.ty = ny; }
}
function clampCam() {
  const vw = W / zoom, vh = H / zoom;
  const minX = -N * HALFW - 160, maxX = N * HALFW + 160 - vw, minY = -topH() / zoom - 160, maxY = N * TH + 160 + hudH() / zoom - vh;
  cam.x = minX > maxX ? (minX + maxX) / 2 : clamp(cam.x, minX, maxX);
  cam.y = minY > maxY ? (minY + maxY) / 2 : clamp(cam.y, minY, maxY);
}
function zoomAt(sx, sy, f) {
  const [wx, wy] = screenToWorld(sx, sy);
  zoom = clamp(zoom * f, .55, 1.8);
  cam.x = wx - sx / zoom; cam.y = wy - sy / zoom; cam.tx = null;
}
function onScreen(tx, ty, m = 80) {
  const [sx, sy] = worldToScreen(...P(tx, ty));
  return sx > -m && sx < W + m && sy > -m && sy < H + m;
}

/* ---------- picking ---------- */
function pickAt(sx, sy) {
  const [wx, wy] = screenToWorld(sx, sy);
  let best = null, bd = 1e9;
  for (const u of units) {
    const [ux, uy] = P(u.x + u.jx, u.y + u.jy), hh = u.type === 'scout' ? 40 : 24, hw = u.type === 'scout' ? 13 : 9;
    if (wx > ux - hw && wx < ux + hw && wy > uy - hh && wy < uy + 5) {
      const d = Math.abs(wx - ux) + Math.abs(wy - (uy - hh / 2));
      if (d < bd) { bd = d; best = u; }
    }
  }
  if (best) return { kind: 'unit', u: best };
  const [tx, ty] = worldToTile(wx, wy);
  const front = [...buildings].filter(b => b.discovered).sort((a, b) => (b.x + b.y + b.w) - (a.x + a.y + a.w));
  for (const b of front) {
    const inFoot = tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h;
    const bb = bboxOf(b), padX = (bb.r - bb.l) * .12;
    if (inFoot || (wx > bb.l + padX && wx < bb.r - padX && wy > bb.t && wy < bb.b - (bb.b - bb.t) * .15)) return { kind: 'building', b };
  }
  for (const off of [0, 12, 24, 38]) {
    const [rx, ry] = worldToTile(wx, wy + off).map(Math.floor);
    if (!inb(rx, ry)) continue;
    const o = occ[idx(rx, ry)];
    if (o && o.type === 'res' && explored[idx(rx, ry)]) return { kind: 'res', r: o };
  }
  return null;
}
const selUnits = () => (S.sel && S.sel.kind === 'units' ? S.sel.units : null);

/* ---------- input ---------- */
let drag = null, pinch = null;
const touches = new Map();
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (!S.started) return;
  canvas.setPointerCapture(e.pointerId);
  hideTip();
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; drag = null; return; }
  }
  if (e.button === 2) { rightClick(e.clientX, e.clientY); return; }
  drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, button: e.button, touch: e.pointerType === 'touch', moved: false, cx: cam.x, cy: cam.y, shift: e.shiftKey };
});
canvas.addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.z * d / pinch.d) / zoom); return; }
  }
  if (drag) {
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 7) drag.moved = true;
    if (drag.touch || drag.button === 1) { cam.x = drag.cx - (drag.x - drag.sx) / zoom; cam.y = drag.cy - (drag.y - drag.sy) / zoom; cam.tx = null; }
    else if (drag.moved) selBox = { x0: drag.sx, y0: drag.sy, x1: drag.x, y1: drag.y };
  } else hover(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { mouse.in = false; S.hover = null; $('#hover-label').style.display = 'none'; });
const endPointer = e => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (!drag) return;
  const d = drag; drag = null;
  if (d.button === 1) return;
  if (d.touch) { if (!d.moved) leftClick(e.clientX, e.clientY, true, false); return; }
  if (d.moved) { boxSelect(d, d.shift); selBox = null; } else leftClick(e.clientX, e.clientY, false, d.shift);
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); drag = null; selBox = null; pinch = null; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (!S.started) return;
  if (e.ctrlKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * .012));
  else { const k = e.deltaMode === 1 ? 30 : 1; cam.x += e.deltaX * k / zoom; cam.y += e.deltaY * k / zoom; cam.tx = null; }
}, { passive: false });
canvas.addEventListener('dblclick', e => {
  const hit = pickAt(e.clientX, e.clientY);
  if (hit && hit.kind === 'unit' && hit.u.type === 'villager') {
    const list = villagers().filter(u => onScreen(u.x, u.y, 0));
    select({ kind: 'units', units: list });
  }
});

function leftClick(sx, sy, touch, shift) {
  const hit = pickAt(sx, sy), su = selUnits();
  if (hit && hit.kind === 'unit') {
    if (shift && su) { const list = su.includes(hit.u) ? su.filter(u => u !== hit.u) : [...su, hit.u]; select(list.length ? { kind: 'units', units: list } : null); }
    else select({ kind: 'units', units: [hit.u] });
  } else if (hit && hit.kind === 'res') {
    if (su && su.some(u => u.type === 'villager')) commandGather(su, hit.r); else select(hit);
  } else if (hit && hit.kind === 'building') {
    if (su && touch) commandBuilding(su, hit.b); else select(hit);
  } else if (su && touch) {
    const [tx, ty] = worldToTile(...screenToWorld(sx, sy)); commandMove(su, tx, ty);
  } else select(null);
}
function rightClick(sx, sy) {
  const su = selUnits();
  if (!su) return;
  const hit = pickAt(sx, sy);
  if (hit && hit.kind === 'res') commandGather(su, hit.r);
  else if (hit && hit.kind === 'building') commandBuilding(su, hit.b);
  else { const [tx, ty] = worldToTile(...screenToWorld(sx, sy)); if (inb(Math.floor(tx), Math.floor(ty))) commandMove(su, tx, ty); }
  panelDirty = true;
}
function boxSelect(d, add) {
  const x0 = Math.min(d.sx, d.x), x1 = Math.max(d.sx, d.x), y0 = Math.min(d.sy, d.y), y1 = Math.max(d.sy, d.y);
  let list = units.filter(u => { const [sx, sy] = worldToScreen(...P(u.x + u.jx, u.y + u.jy)); return sx >= x0 && sx <= x1 && sy - 10 * zoom >= y0 - 14 && sy - 10 * zoom <= y1 + 4; });
  if (list.some(u => u.type === 'villager') && list.some(u => u.type === 'scout') && list.length > 2) list = list.filter(u => u.type === 'villager');
  if (add && selUnits()) list = [...new Set([...selUnits(), ...list])];
  if (list.length) select({ kind: 'units', units: list });
}
let lastHover = 0;
function hover(sx, sy) {
  const now = performance.now();
  if (now - lastHover < 40) return;
  lastHover = now;
  const hit = pickAt(sx, sy), label = $('#hover-label');
  S.hover = hit;
  if (!hit) { label.style.display = 'none'; canvas.style.cursor = 'default'; return; }
  const su = selUnits();
  canvas.style.cursor = hit.kind === 'res' && su ? 'crosshair' : 'pointer';
  const text = hit.kind === 'unit' ? hit.u.name : hit.kind === 'res' ? `${NODE[hit.r.kind].name} · ${hit.r.amount}` : `${hit.b.name}${hit.b.section ? ' · ' + hit.b.section : ''}`;
  label.textContent = text;
  label.style.display = 'block';
  label.style.left = sx + 14 + 'px'; label.style.top = sy + 16 + 'px';
}
function selectIdle() {
  const idle = idleVillagers();
  if (!idle.length) { log('No idle developers. Everyone is busy.'); return; }
  const cur = selUnits() && selUnits().length === 1 ? idle.indexOf(selUnits()[0]) : -1;
  const u = idle[(cur + 1) % idle.length];
  select({ kind: 'units', units: [u] });
  centerOn(u.x, u.y);
}

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!S.started) { if (e.key === 'Enter') start(); return; }
  const k = e.key;
  if (k === 'Escape') {
    if (!modal.hidden) closeModal(); else if (!$('#classic').hidden) $('#classic').hidden = true;
    else if (!$('#victory').hidden) $('#victory').hidden = true; else if (!objEl.hidden) toggleObjectives(false); else select(null);
    return;
  }
  if (!modal.hidden || !$('#classic').hidden || !$('#victory').hidden) return;
  if (k.startsWith('Arrow')) { keys.add(k); e.preventDefault(); return; }
  if (k === 'Enter') { e.preventDefault(); openChat(); return; }
  if (k === ' ') { e.preventDefault(); centerSel(); return; }
  const low = k.toLowerCase();
  if (hotkeys[low]) { hotkeys[low](); return; }
  const g = { h: 'hall', l: 'library', p: 'workshop', m: 'tower' }[low];
  if (g) { selectBuildingById(g); return; }
  if (low === '.') selectIdle();
  else if (low === 'o') toggleObjectives();
  else if (low === 'v') openClassic();
  else if (low === '?' || k === 'F1') { e.preventDefault(); openHelp(); }
});
document.addEventListener('keyup', e => keys.delete(e.key));
function centerSel() {
  const s = S.sel; if (!s) { centerOn(HALL_C.x, HALL_C.y); return; }
  if (s.kind === 'units') centerOn(s.units[0].x, s.units[0].y);
  else if (s.kind === 'building') centerOn(s.b.x + s.b.w / 2, s.b.y + s.b.h / 2);
  else centerOn(s.r.x + .5, s.r.y + .5);
}

/* ---------- minimap ---------- */
const mmSmall = document.createElement('canvas'); mmSmall.width = mmSmall.height = N;
const mmSmallCtx = mmSmall.getContext('2d'), mmImg = mmSmallCtx.createImageData(N, N);
let mmBase = null;
function mmTransform() { const w = mm.width, h = mm.height; return { sx: w / (2 * N), sy: h / (2 * N), w, h }; }
function renderMinimap() {
  if (!mmBase) { mmBase = new Uint8Array(N * N * 3); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = colorAt(x + .5, y + .5), o = idx(x, y) * 3; mmBase[o] = c[0]; mmBase[o + 1] = c[1]; mmBase[o + 2] = c[2]; } }
  const RC = { tree: [34, 74, 28], bush: [196, 92, 76], ideas: [242, 201, 76], stone: [170, 176, 182] };
  for (let i = 0; i < N * N; i++) {
    let c = [mmBase[i * 3], mmBase[i * 3 + 1], mmBase[i * 3 + 2]];
    const o = occ[i];
    if (o) c = o.type === 'res' ? RC[o.kind] : [64, 126, 236];
    const f = !explored[i] ? 0 : visible[i] ? 1 : .55, q = i * 4;
    mmImg.data[q] = c[0] * f; mmImg.data[q + 1] = c[1] * f; mmImg.data[q + 2] = c[2] * f; mmImg.data[q + 3] = 255;
  }
  mmSmallCtx.putImageData(mmImg, 0, 0);
}
function drawMinimap(t) {
  const { sx, sy, w, h } = mmTransform();
  mmCtx.setTransform(1, 0, 0, 1, 0, 0);
  mmCtx.clearRect(0, 0, w, h);
  mmCtx.imageSmoothingEnabled = false;
  mmCtx.setTransform(sx, sy, -sx, sy, w / 2, 0);
  mmCtx.drawImage(mmSmall, 0, 0);
  mmCtx.setTransform(1, 0, 0, 1, 0, 0);
  const toMM = (x, y) => [(x - y) * sx + w / 2, (x + y) * sy];
  for (const u of units) { const [px, py] = toMM(u.x, u.y); mmCtx.fillStyle = '#fff'; mmCtx.fillRect(px - 1.5 * DPR, py - 1.5 * DPR, 3 * DPR, 3 * DPR); }
  for (const p of pings) { const [px, py] = toMM(p.x, p.y); mmCtx.strokeStyle = `rgba(255,229,138,${p.life / 3})`; mmCtx.lineWidth = 2 * DPR; mmCtx.beginPath(); mmCtx.arc(px, py, (3 - p.life) * 8 * DPR + 4, 0, Math.PI * 2); mmCtx.stroke(); }
  const corners = [[0, topH()], [W, topH()], [W, H - hudH()], [0, H - hudH()]].map(([x, y]) => toMM(...worldToTile(...screenToWorld(x, y))));
  mmCtx.strokeStyle = 'rgba(255,255,255,.9)'; mmCtx.lineWidth = 1.2 * DPR;
  mmCtx.beginPath(); corners.forEach((c, i) => i ? mmCtx.lineTo(...c) : mmCtx.moveTo(...c)); mmCtx.closePath(); mmCtx.stroke();
}
function minimapToTile(e) {
  const r = mm.getBoundingClientRect(), { sx, sy, w } = mmTransform();
  const mx = (e.clientX - r.left) * (mm.width / r.width), my = (e.clientY - r.top) * (mm.height / r.height);
  const a = (mx - w / 2) / sx, b = my / sy;
  return [(a + b) / 2, (b - a) / 2];
}
let mmDrag = false;
mm.addEventListener('pointerdown', e => {
  if (!S.started) return;
  if (e.button === 2) { const su = selUnits(); if (su) commandMove(su, ...minimapToTile(e)); return; }
  mmDrag = true; mm.setPointerCapture(e.pointerId); centerOn(...minimapToTile(e), true);
});
mm.addEventListener('pointermove', e => { if (mmDrag) centerOn(...minimapToTile(e), true); });
mm.addEventListener('pointerup', () => { mmDrag = false; });
mm.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- render ---------- */
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0a06'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const k = DPR * zoom;
  let shx = 0, shy = 0;
  if (S.shake > 0) { shx = (Math.random() - .5) * 10 * S.shake; shy = (Math.random() - .5) * 6 * S.shake; }
  ctx.setTransform(k, 0, 0, k, (-cam.x + shx) * k, (-cam.y + shy) * k);
  ctx.drawImage(terrainCanvas, -N * HALFW, 0);

  const vx0 = cam.x - 80, vx1 = cam.x + W / zoom + 80, vy0 = cam.y - 160, vy1 = cam.y + H / zoom + 80;
  const inView = (wx, wy) => wx > vx0 && wx < vx1 && wy > vy0 && wy < vy1;

  // water shimmer
  if (!reduced) {
    ctx.lineWidth = 1.2;
    for (const [x, y, r] of waterTiles) {
      const [px, py] = P(x + .5, y + .5);
      if (!inView(px, py) || !explored[idx(x, y)]) continue;
      const a = .14 + .14 * Math.sin(t * 1.8 + r * 20);
      ctx.strokeStyle = `rgba(220,240,255,${a})`;
      const ox = (r - .5) * 18, oy = (r * 7 % 1 - .5) * 8;
      ctx.beginPath(); ctx.moveTo(px + ox - 6, py + oy); ctx.quadraticCurveTo(px + ox, py + oy - 2, px + ox + 6, py + oy); ctx.stroke();
    }
  }

  // ground highlights
  const sel = S.sel, hv = S.hover;
  if (hv && hv.kind === 'building') diamond(ctx, hv.b.x, hv.b.y, hv.b.w, hv.b.h, 'rgba(255,255,255,.45)', 1.4);
  if (sel && sel.kind === 'building') diamond(ctx, sel.b.x, sel.b.y, sel.b.w, sel.b.h, '#ffe58a', 2, [6, 4]);
  if (sel && sel.kind === 'res') diamond(ctx, sel.r.x, sel.r.y, 1, 1, '#ffe58a', 1.6);
  if (hv && hv.kind === 'res') diamond(ctx, hv.r.x, hv.r.y, 1, 1, 'rgba(255,255,255,.5)', 1.2);
  for (const m of markers) { const s = m.life / .6; diamond(ctx, m.x - .5 * s, m.y - .5 * s, s, s, m.color, 2); }

  // depth-sorted objects
  const list = [];
  for (const r of resources) {
    if (!explored[idx(r.x, r.y)]) continue;
    const [px, py] = P(r.x + .5, r.y + .5);
    if (inView(px, py)) list.push([r.x + r.y + 1, 0, r]);
  }
  for (const b of buildings) if (b.discovered || explored[idx(b.x, b.y)]) list.push([b.x + b.y + b.w, 1, b]);
  for (const u of units) { const [px, py] = P(u.x, u.y); if (inView(px, py)) list.push([u.x + u.y + u.jx + u.jy, 2, u]); }
  list.sort((a, b) => a[0] - b[0]);
  const selSet = selUnits();
  for (const [, type, o] of list) {
    if (type === 0) drawResource(ctx, o);
    else if (type === 1) drawBuilding(ctx, o, t);
    else drawUnit(ctx, o, t, selSet && selSet.includes(o));
  }

  // particles
  ctx.textAlign = 'center';
  for (const p of particles) {
    const a = p.life / p.max;
    if (p.smoke) { ctx.fillStyle = `rgba(210,205,195,${a * .35})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.font = '700 9px ui-monospace, Menlo, monospace'; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
  }
  for (const p of pigeons) {
    const f = Math.sin(t * 20) * 3;
    ctx.strokeStyle = '#f2f0ea'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - f); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y - f); ctx.stroke();
  }

  // fog of war, blurred by bilinear upscaling of a 48×48 alpha map
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.transform(HALFW, HALFH, -HALFW, HALFH, 0, 0);
  ctx.drawImage(fogCanvas, 0, 0);
  ctx.restore();
  // frame outside the map
  ctx.fillStyle = '#0d0a06';
  ctx.beginPath();
  ctx.rect(-N * TW, -N * TH, N * TW * 2, N * TH * 3);
  ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(0, N)); ctx.lineTo(...P(N, N)); ctx.lineTo(...P(N, 0)); ctx.closePath();
  ctx.fill('evenodd');

  // floating text (above fog)
  ctx.font = '800 13px "Alegreya Sans", sans-serif';
  for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life / f.max * 1.6); ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;

  // selection box, screen space
  if (selBox) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(255,229,138,.08)';
    const x = Math.min(selBox.x0, selBox.x1), y = Math.min(selBox.y0, selBox.y1), w = Math.abs(selBox.x1 - selBox.x0), h = Math.abs(selBox.y1 - selBox.y0);
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x + .5, y + .5, w, h);
  }
}

/* ---------- top bar ---------- */
function updateTop() {
  for (const k of RES_TYPES) $(`#r-${k}`).textContent = Math.floor(S.res[k]);
  $('#r-pop').textContent = `${villagers().length}/${POP_CAP}`;
  $('#age-label').textContent = AGES[S.age].name;
  $('#age-sub').textContent = S.ageResearch ? `Advancing to ${AGES[S.age + 1].name}` : `Age ${AGES[S.age].roman} of IV`;
  const ab = $('#age-bar');
  ab.style.display = S.ageResearch ? 'block' : 'none';
  if (S.ageResearch) ab.firstElementChild.style.width = (1 - S.ageResearch.t / S.ageResearch.total) * 100 + '%';
  $('#clock').textContent = fmtTime(S.time);
  $('#idle-count').textContent = idleVillagers().length;
}

/* ---------- loop ---------- */
let last = performance.now(), fogT = 0, uiT = 0, mmT = 0;
function update(dt) {
  if (S.started && !S.won) S.time += dt;
  if (cam.tx != null) { cam.x = lerp(cam.x, cam.tx, Math.min(1, dt * 8)); cam.y = lerp(cam.y, cam.ty, Math.min(1, dt * 8)); if (Math.abs(cam.x - cam.tx) + Math.abs(cam.y - cam.ty) < 1) cam.tx = null; }
  const pan = 760 * dt / zoom;
  if (keys.has('ArrowLeft')) { cam.x -= pan; cam.tx = null; }
  if (keys.has('ArrowRight')) { cam.x += pan; cam.tx = null; }
  if (keys.has('ArrowUp')) { cam.y -= pan; cam.tx = null; }
  if (keys.has('ArrowDown')) { cam.y += pan; cam.tx = null; }
  if (S.started && mouse.in && !drag && document.hasFocus()) {
    if (mouse.x < 6) cam.x -= pan * .8; else if (mouse.x > W - 6) cam.x += pan * .8;
  }
  clampCam();
  S.shake = Math.max(0, S.shake - dt * 2);

  for (const u of units) if (S.started || u.type !== 'scout') updateUnit(u, dt);
  const q = HALL.queue;
  if (q.length) { q[0].t -= dt; if (q[0].t <= 0) { q.shift(); const u = spawnVillagerFromHall(); complete('train'); SFX.trained(); log(`${u.name} is ready to work.`, '#9ad873'); panelDirty = true; } }
  if (S.ageResearch) { S.ageResearch.t -= dt; if (S.ageResearch.t <= 0) finishAge(); }
  if (S.researching) { S.researching.t -= dt; if (S.researching.t <= 0) finishResearch(); }
  for (let i = pings.length - 1; i >= 0; i--) { pings[i].life -= dt; if (pings[i].life <= 0) pings.splice(i, 1); }
  updateEffects(dt);

  fogT -= dt; if (fogT <= 0) { fogT = .2; updateFog(); }
  mmT -= dt; if (mmT <= 0) { mmT = .3; renderMinimap(); minimapDirty = false; }
  uiT -= dt; if (uiT <= 0) { uiT = .15; updateTop(); live.forEach(f => f()); }
  musicTick();
}
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  update(dt);
  if (panelDirty) renderPanel();
  render(t);
  drawMinimap(t);
  drawPortrait(t);
  requestAnimationFrame(frame);
}

/* ---------- buttons ---------- */
$('#b-obj').addEventListener('click', () => toggleObjectives());
$('#b-classic').addEventListener('click', openClassic);
$('#b-help').addEventListener('click', openHelp);
$('#b-idle').addEventListener('click', selectIdle);
$('#b-home').addEventListener('click', () => selectBuildingById('hall'));
$('#b-sound').addEventListener('click', e => { AUDIO.sfx = !AUDIO.sfx; e.currentTarget.classList.toggle('off', !AUDIO.sfx); });
$('#b-music').addEventListener('click', e => { initAudio(); setMusic(!AUDIO.musicOn); e.currentTarget.classList.toggle('off', !AUDIO.musicOn); });
$('#b-start').addEventListener('click', start);
$('#b-skip').addEventListener('click', () => { start(); openClassic(); });

function start() {
  if (S.started) return;
  S.started = true;
  initAudio();
  $('#intro').hidden = true;
  log(`Welcome to <b>tthisk</b>, the Kingdom of Code.`, '#ffe08a');
  setTimeout(() => log('Your scout rides out to explore. Select the <b>Town Hall</b> to begin.'), 900);
  setTimeout(() => toggleObjectives(true), 1200);
  setTimeout(() => { if (!objEl.hidden && S.done.size === 0) toggleObjectives(false); }, 16000);
}

/* ---------- boot ---------- */
generateWorld();
bakeTerrain();
buildSprites();
resize();
const starts = [[22, 25], [23, 25], [24, 25], [21, 25]];
starts.forEach(([x, y]) => spawnUnit('villager', x, y));
['coffee', 'code', 'ideas', 'coffee'].forEach((type, i) => gatherType(units[i], type, true));
const scout = spawnUnit('scout', 25, 24);
scout.waypoints = scoutRoute(); scout.state = 'scout';
updateFog();
centerOn(HALL_C.x, HALL_C.y + 1, true);
renderObjectives();
$('#intro-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
requestAnimationFrame(frame);
