'use strict';
/* ==========================================================================
   World: procedural terrain, map objects, A* pathfinding, fog of war.
   Coordinates: tile space (x, y) in [0, N). World pixels via iso projection.
   ========================================================================== */

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(20261110);

const NG = 64, noiseGrid = new Float32Array(NG * NG).map(() => rand());
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const g = (i, j) => noiseGrid[(((j % NG) + NG) % NG) * NG + (((i % NG) + NG) % NG)];
  const s = t => t * t * (3 - 2 * t);
  const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1), u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.1 + 17, y * 2.1 + 9) * .3 + vnoise(x * 4.3 + 3, y * 4.3 + 41) * .15;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** iso projection: tile coords (+ height in px) to world pixels */
function P(x, y, z = 0) { return [(x - y) * HALFW, (x + y) * HALFH - z]; }
function worldToTile(wx, wy) { return [(wx / HALFW + wy / HALFH) / 2, (wy / HALFH - wx / HALFW) / 2]; }

/* ---------- layout ---------- */
const HALL_C = { x: 23, y: 23 };
const BUILDING_DEFS = [
  { id: 'hall',     kind: 'hall',     name: 'Town Hall',        x: 21, y: 21, w: 4, h: 4, vision: 8,   hitH: 96,  key: 'H', section: 'About me' },
  { id: 'library',  kind: 'library',  name: 'The Library',      x: 11, y: 18, w: 3, h: 3, vision: 4.5, hitH: 70,  key: 'L', section: 'Blog' },
  { id: 'workshop', kind: 'workshop', name: 'Project Workshop', x: 31, y: 13, w: 3, h: 3, vision: 4.5, hitH: 74,  key: 'P', section: 'Projects' },
  { id: 'tower',    kind: 'tower',    name: 'Messenger Tower',  x: 31, y: 30, w: 2, h: 2, vision: 6,   hitH: 132, key: 'M', section: 'Contact' },
  { id: 'house1',   kind: 'house',    name: 'Developer House',  x: 26, y: 17, w: 2, h: 2, vision: 3,   hitH: 40 },
  { id: 'house2',   kind: 'house',    name: 'Developer House',  x: 16, y: 22, w: 2, h: 2, vision: 3,   hitH: 40 },
  { id: 'house3',   kind: 'house',    name: 'Developer House',  x: 25, y: 27, w: 2, h: 2, vision: 3,   hitH: 40 },
  { id: 'wonder',   kind: 'wonder',   name: 'Wonder Plot',      x: 13, y: 29, w: 4, h: 4, vision: 3.5, hitH: 40 },
];
const LAKES = [{ x: 8, y: 8, r: 4.6 }, { x: 40, y: 40, r: 4.3 }, { x: 25, y: 39, r: 2.4 }, { x: 42, y: 8, r: 3 }, { x: 5, y: 41, r: 3.2 }];
const ROADS = [];
BUILDING_DEFS.forEach(b => { if (b.id !== 'hall') ROADS.push([HALL_C.x, HALL_C.y, b.x + b.w / 2, b.y + b.h / 2]); });
ROADS.push([HALL_C.x, HALL_C.y, 47, 33], [HALL_C.x, HALL_C.y, 22, 0]);

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function waterLevel(x, y) {
  let v = -9;
  for (const L of LAKES) v = Math.max(v, L.r + (fbm(x * .45 + L.x, y * .45 + L.y) - .5) * 2.6 - Math.hypot(x - L.x, y - L.y));
  return v;
}
function dirtLevel(x, y) {
  let v = 0;
  const wx = x + (vnoise(x * .7, y * .7) - .5) * 1.1, wy = y + (vnoise(x * .7 + 9, y * .7 + 3) - .5) * 1.1;
  for (const r of ROADS) v = Math.max(v, 1 - segDist(wx, wy, ...r) / .85);
  for (const b of BUILDING_DEFS) {
    const d = Math.hypot(x - (b.x + b.w / 2), y - (b.y + b.h / 2));
    v = Math.max(v, (Math.max(b.w, b.h) * .55 + 1.1 - d) / 1.3);
  }
  return clamp(v + (fbm(x * .9, y * .9) - .5) * .5, 0, 1);
}
function colorAt(x, y) {
  const w = waterLevel(x, y);
  const n = fbm(x * .22, y * .22), n2 = fbm(x * .8 + 30, y * .8 + 70);
  let c = mix3([66, 104, 40], [92, 134, 52], smoothstep(.25, .7, n));
  c = mix3(c, [128, 160, 66], smoothstep(.55, .85, n2) * .7);
  const d = dirtLevel(x, y);
  if (d > 0) c = mix3(c, [156, 124, 80], Math.min(1, d * 1.15));
  if (w > -1.2) c = mix3(c, [214, 194, 140], smoothstep(-1.2, -.25, w));
  if (w > -.25) c = mix3([92, 160, 176], [34, 82, 124], smoothstep(-.25, 2.6, w));
  return c;
}

/* ---------- grids ---------- */
const idx = (x, y) => y * N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const water = new Uint8Array(N * N);
const occ = new Array(N * N).fill(null);
const explored = new Uint8Array(N * N);
const visible = new Uint8Array(N * N);
const walkable = (x, y) => inb(x, y) && !water[idx(x, y)] && !occ[idx(x, y)];

const buildings = [];
const resources = [];
let HALL = null;

function addRes(kind, x, y) {
  if (!inb(x, y) || water[idx(x, y)] || occ[idx(x, y)]) return null;
  const r = { type: 'res', kind, x, y, amount: NODE[kind].amount, max: NODE[kind].amount, v: Math.floor(rand() * 6), s: .85 + rand() * .3, dead: false };
  resources.push(r);
  occ[idx(x, y)] = r;
  return r;
}
function removeRes(r) {
  r.dead = true;
  occ[idx(r.x, r.y)] = null;
  const i = resources.indexOf(r); if (i >= 0) resources.splice(i, 1);
  minimapDirty = true;
  if (S.sel && S.sel.kind === 'res' && S.sel.r === r) select(null);
}

function generateWorld() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) water[idx(x, y)] = waterLevel(x + .5, y + .5) > -.2 ? 1 : 0;

  for (const d of BUILDING_DEFS) {
    const b = { type: 'building', ...d, discovered: d.id === 'hall', queue: [] };
    buildings.push(b);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { occ[idx(x, y)] = b; water[idx(x, y)] = 0; }
  }
  HALL = buildings[0];

  const reserved = new Uint8Array(N * N);
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) reserved[idx(x, y)] = 1; };
  buildings.forEach(b => reserve(b.x - 1, b.y - 1, b.x + b.w, b.y + b.h));

  const clusters = {
    bush:  [[19, 16], [20, 16], [21, 17], [18, 17], [20, 18], [22, 17], [19, 18], [37, 31], [38, 32], [36, 32]],
    ideas: [[28, 24], [29, 24], [28, 25], [29, 25], [30, 25], [38, 13], [39, 13], [39, 14]],
    stone: [[17, 26], [18, 27], [17, 27], [16, 26], [7, 33], [8, 33], [8, 34]],
  };
  for (const [kind, list] of Object.entries(clusters)) for (const [x, y] of list) {
    addRes(kind, x, y);
    reserve(x - 1, y - 1, x + 1, y + 1);
  }

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (reserved[i] || water[i] || occ[i]) continue;
    if (dirtLevel(x + .5, y + .5) > .3) continue;
    const d = Math.hypot(x - HALL_C.x, y - HALL_C.y);
    const f = fbm(x * .19 + 50, y * .19 + 20);
    let tree = false;
    if (d > 13 && f > .55 && rand() < .88) tree = true;
    if (x >= 34 && x <= 41 && y >= 18 && y <= 27 && f > .33) tree = true;          // east forest
    if (x >= 4 && x <= 9 && y >= 20 && y <= 29 && f > .33) tree = true;            // west grove
    if (x >= 28 && x <= 31 && y >= 19 && y <= 22 && rand() < .8) tree = true;      // starter grove by the hall
    if (d > 9 && rand() < .018) tree = true;
    if (d < 8.5 && !(x >= 28 && y >= 19 && y <= 22)) tree = false;
    if (tree) addRes('tree', x, y);
  }
}

/* ---------- terrain bake (one big canvas, drawn every frame) ---------- */
let terrainCanvas = null;
const waterTiles = [];
function bakeTerrain() {
  const SUB = 4, n = N * SUB;
  const small = document.createElement('canvas'); small.width = small.height = n;
  const sctx = small.getContext('2d'), img = sctx.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = colorAt((i + .5) / SUB, (j + .5) / SUB), o = (j * n + i) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);

  const c = document.createElement('canvas');
  c.width = N * TW; c.height = N * TH + 4;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.setTransform(HALFW / SUB, HALFH / SUB, -HALFW / SUB, HALFH / SUB, N * HALFW, 0);
  g.drawImage(small, 0, 0);
  g.setTransform(1, 0, 0, 1, N * HALFW, 0);

  const r2 = mulberry32(7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (water[idx(x, y)]) { waterTiles.push([x, y, r2()]); continue; }
    for (let k = 0; k < 18; k++) {
      const tx = x + r2(), ty = y + r2();
      if (waterLevel(tx, ty) > -.6) continue;
      const [px, py] = P(tx, ty);
      const dirt = dirtLevel(tx, ty);
      if (dirt > .55) {
        g.fillStyle = r2() < .5 ? 'rgba(96,72,40,.35)' : 'rgba(205,178,128,.35)';
        g.beginPath(); g.ellipse(px, py, 1.3, .8, 0, 0, Math.PI * 2); g.fill();
      } else {
        g.strokeStyle = r2() < .55 ? 'rgba(36,62,18,.4)' : 'rgba(176,206,110,.28)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r2() - .5) * 2.5, py - 2 - r2() * 3); g.stroke();
        if (r2() < .004) { g.fillStyle = ['#fff6d8', '#f6d65a', '#e98fb0', '#b9c8ff'][Math.floor(r2() * 4)]; g.fillRect(px, py - 1, 1.6, 1.6); }
      }
    }
  }
  terrainCanvas = c;
}

/* ---------- A* pathfinding ---------- */
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const _g = new Float32Array(N * N), _came = new Int32Array(N * N), _closed = new Uint8Array(N * N);
function findPath(sx, sy, isGoal, hx, hy) {
  sx = clamp(Math.floor(sx), 0, N - 1); sy = clamp(Math.floor(sy), 0, N - 1);
  if (isGoal(sx, sy)) return [];
  _g.fill(Infinity); _came.fill(-1); _closed.fill(0);
  const heap = [];
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  const h = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
  const start = idx(sx, sy);
  _g[start] = 0; push(start, h(sx, sy));
  let iter = 0;
  while (heap.length && iter++ < 4000) {
    const cur = pop();
    if (_closed[cur]) continue;
    _closed[cur] = 1;
    const cx = cur % N, cy = (cur / N) | 0;
    if (isGoal(cx, cy)) {
      const path = [];
      for (let k = cur; k !== start; k = _came[k]) path.push({ x: (k % N) + .5, y: ((k / N) | 0) + .5 });
      return path.reverse();
    }
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ni = idx(nx, ny), ng = _g[cur] + cost;
      if (ng < _g[ni]) { _g[ni] = ng; _came[ni] = cur; push(ni, ng + h(nx, ny)); }
    }
  }
  return null;
}
function rectOf(o) { return o.type === 'res' ? { x: o.x, y: o.y, w: 1, h: 1 } : { x: o.x, y: o.y, w: o.w, h: o.h }; }
function isAdj(x, y, R) { return x >= R.x - 1 && x <= R.x + R.w && y >= R.y - 1 && y <= R.y + R.h && !(x >= R.x && x < R.x + R.w && y >= R.y && y < R.y + R.h); }
function pathToObject(u, o) {
  const R = rectOf(o);
  const p = findPath(u.x, u.y, (x, y) => isAdj(x, y, R) && (walkable(x, y) || (x === Math.floor(u.x) && y === Math.floor(u.y))), R.x + R.w / 2, R.y + R.h / 2);
  if (p && p.length && o.type === 'res') { // step a little closer so the swing looks right
    const last = p[p.length - 1], dx = R.x + .5 - last.x, dy = R.y + .5 - last.y, d = Math.hypot(dx, dy);
    last.x += dx / d * .28; last.y += dy / d * .28;
  }
  return p;
}
function nearestWalkable(x, y, maxR = 8) {
  x = clamp(Math.round(x), 0, N - 1); y = clamp(Math.round(y), 0, N - 1);
  for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return null;
}
function pathToTile(u, tx, ty) {
  const t = nearestWalkable(tx, ty);
  if (!t) return null;
  return findPath(u.x, u.y, (x, y) => x === t.x && y === t.y, t.x, t.y);
}

/* ---------- fog of war ---------- */
const fogCanvas = document.createElement('canvas'); fogCanvas.width = fogCanvas.height = N;
const fogCtx = fogCanvas.getContext('2d'), fogImg = fogCtx.createImageData(N, N);
let minimapDirty = true;
function reveal(cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if (!inb(x, y)) continue;
    const dx = x + .5 - cx, dy = y + .5 - cy;
    if (dx * dx + dy * dy <= r2) { const i = idx(x, y); visible[i] = 1; if (!explored[i]) { explored[i] = 1; minimapDirty = true; } }
  }
}
function updateFog() {
  visible.fill(0);
  for (const u of units) reveal(u.x, u.y, u.type === 'scout' ? 6.5 : 3.8);
  for (const b of buildings) if (b.discovered) reveal(b.x + b.w / 2, b.y + b.h / 2, b.vision);
  for (let i = 0; i < N * N; i++) {
    const o = i * 4;
    fogImg.data[o] = 13; fogImg.data[o + 1] = 10; fogImg.data[o + 2] = 6;
    fogImg.data[o + 3] = explored[i] ? (visible[i] ? 0 : 105) : 255;
  }
  fogCtx.putImageData(fogImg, 0, 0);
  for (const b of buildings) {
    if (b.discovered) continue;
    let seen = false;
    for (let y = b.y; y < b.y + b.h && !seen; y++) for (let x = b.x; x < b.x + b.w; x++) if (explored[idx(x, y)]) { seen = true; break; }
    if (seen) discover(b, true);
  }
}
