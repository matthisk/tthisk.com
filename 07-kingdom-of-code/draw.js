'use strict';
/* ==========================================================================
   Drawing: every sprite is procedural. Buildings are built from isometric
   boxes and roofs, and their look changes with each age.
   ========================================================================== */

const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = _shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let c = [n >> 16 & 255, n >> 8 & 255, n & 255];
  c = c.map(x => amt >= 0 ? x + (255 - x) * amt : x * (1 + amt));
  v = `rgb(${c.map(x => x | 0).join(',')})`;
  _shadeCache.set(key, v);
  return v;
}
function poly(g, pts, fill, stroke = 'rgba(28,18,8,.35)') {
  g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = .8; g.stroke(); }
}
/** isometric box; c is the base colour, faces get shaded */
function box(g, x0, y0, x1, y1, z0, z1, c) {
  poly(g, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], shade(c, -.06));
  poly(g, [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], shade(c, -.3));
  poly(g, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], shade(c, .12));
}
function stripes(g, e0, e1, r0, r1, n, color = 'rgba(0,0,0,.13)') {
  g.strokeStyle = color; g.lineWidth = 1;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    g.beginPath();
    g.moveTo(lerp(e0[0], r0[0], t), lerp(e0[1], r0[1], t));
    g.lineTo(lerp(e1[0], r1[0], t), lerp(e1[1], r1[1], t));
    g.stroke();
  }
}
function gableX(g, x0, y0, x1, y1, z, h, c, wall) {
  const ym = (y0 + y1) / 2;
  poly(g, [P(x0, y0, z), P(x1, y0, z), P(x1, ym, z + h), P(x0, ym, z + h)], shade(c, .14));
  poly(g, [P(x1, y0, z), P(x1, y1, z), P(x1, ym, z + h)], shade(wall, -.34));
  const e0 = P(x0, y1, z), e1 = P(x1, y1, z), r0 = P(x0, ym, z + h), r1 = P(x1, ym, z + h);
  poly(g, [e0, e1, r1, r0], shade(c, -.06));
  stripes(g, e0, e1, r0, r1, 6);
}
function gableY(g, x0, y0, x1, y1, z, h, c, wall) {
  const xm = (x0 + x1) / 2;
  poly(g, [P(x0, y0, z), P(x0, y1, z), P(xm, y1, z + h), P(xm, y0, z + h)], shade(c, .14));
  poly(g, [P(x0, y1, z), P(x1, y1, z), P(xm, y1, z + h)], shade(wall, -.1));
  const e0 = P(x1, y1, z), e1 = P(x1, y0, z), r0 = P(xm, y1, z + h), r1 = P(xm, y0, z + h);
  poly(g, [e0, e1, r1, r0], shade(c, -.26));
  stripes(g, e0, e1, r0, r1, 6);
}
function pyramid(g, x0, y0, x1, y1, z, h, c) {
  const A = P((x0 + x1) / 2, (y0 + y1) / 2, z + h);
  poly(g, [P(x0, y0, z), P(x1, y0, z), A], shade(c, .18));
  poly(g, [P(x0, y0, z), P(x0, y1, z), A], shade(c, .08));
  poly(g, [P(x0, y1, z), P(x1, y1, z), A], shade(c, -.06));
  poly(g, [P(x1, y0, z), P(x1, y1, z), A], shade(c, -.32));
  return A;
}
/* draw in the plane of a wall: local (tile-along-wall, z-px) coordinates */
function faceY(g, Y, fn) { const [ox, oy] = P(0, Y, 0); g.save(); g.transform(HALFW, HALFH, 0, -1, ox, oy); fn(g); g.restore(); }
function faceX(g, X, fn) { const [ox, oy] = P(X, 0, 0); g.save(); g.transform(-HALFW, HALFH, 0, -1, ox, oy); fn(g); g.restore(); }
function win(f, c, z, w, h, color = '#2a1c12', arch = true) {
  f.fillStyle = color;
  f.fillRect(c - w / 2, z, w, h);
  if (arch) { f.beginPath(); f.ellipse(c, z + h, w / 2, 2.6, 0, 0, Math.PI); f.fill(); }
  f.fillStyle = 'rgba(255,214,120,.35)';
  f.fillRect(c - w / 2 + w * .2, z + 1, w * .25, h * .5);
}
function flag(g, x, y, t, color, len = 18) {
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - len); g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x, y - len);
  for (let i = 0; i <= 6; i++) g.lineTo(x + i * 2.1, y - len + Math.sin(t * 5 - i * .8) * 1.3);
  for (let i = 6; i >= 0; i--) g.lineTo(x + i * 2.1, y - len + 6 + Math.sin(t * 5 - i * .8) * 1.3);
  g.closePath(); g.fill();
}

/* ---------- buildings ---------- */
function drawHall(g, b, t) {
  const a = S.age, x = b.x, y = b.y;
  const wall = ['#9a6a3e', '#bdb39f', '#c9c0ab', '#ddd5c4'][a];
  const roof = ['#c49a4e', '#a4442e', '#8f3527', '#33508a'][a];
  const H = 30 + a * 7;
  box(g, x + .12, y + .12, x + 3.88, y + 3.88, 0, 5, '#8b8475');
  box(g, x + .55, y + .55, x + 3.45, y + 3.45, 5, 5 + H, wall);
  faceY(g, y + 3.45, f => {
    if (a === 0) { f.fillStyle = '#5a3b22'; for (const bx of [.55, 1.3, 2.7, 3.45]) f.fillRect(x + bx - .04, 5, .08, H); f.fillRect(x + .55, 5 + H * .55, 2.9, 2); }
    win(f, x + 1.05, 5 + H * .5, .22, 9); win(f, x + 2.95, 5 + H * .5, .22, 9);
    f.fillStyle = '#3b2412'; f.fillRect(x + 1.7, 5, .6, 15); f.beginPath(); f.ellipse(x + 2, 20, .3, 5, 0, 0, Math.PI); f.fill();
    f.fillStyle = a >= 3 ? '#e3b341' : '#2f6fd6'; f.fillRect(x + 1.35, 5 + H * .35, .18, H * .5); f.fillRect(x + 2.47, 5 + H * .35, .18, H * .5);
  });
  faceX(g, x + 3.45, f => { for (let i = 0; i < 3; i++) win(f, y + .95 + i * .95, 5 + H * .5, .22, 9); });
  gableX(g, x + .35, y + .35, x + 3.65, y + 3.65, 5 + H, 22 + a * 3, roof, wall);
  if (a >= 3) { g.strokeStyle = '#f2cf6a'; g.lineWidth = 2; const p0 = P(x + .35, y + 2, 5 + H + 22 + a * 3), p1 = P(x + 3.65, y + 2, 5 + H + 22 + a * 3); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); }
  const tower = (tx, ty, th) => {
    box(g, tx, ty, tx + .9, ty + .9, 0, th, wall);
    faceY(g, ty + .9, f => win(f, tx + .45, th * .62, .16, 8));
    faceX(g, tx + .9, f => win(f, ty + .45, th * .62, .16, 8));
    const A = pyramid(g, tx - .1, ty - .1, tx + 1, ty + 1, th, 22, roof);
    flag(g, A[0], A[1], t + tx, a >= 3 ? '#e3b341' : '#2f6fd6', 12);
  };
  if (a >= 2) { tower(x, y + 3.05, H + 16); tower(x + 3.05, y, H + 16); }
  if (a >= 1) tower(x + 3.05, y + 3.05, H + 22);
  const [fx, fy] = P(x + 2, y + 2, 5 + H + 22 + a * 3);
  flag(g, fx, fy, t, a >= 3 ? '#e3b341' : '#2f6fd6', 20);
}

function drawLibrary(g, b, t) {
  const a = S.age, x = b.x, y = b.y;
  const wall = a < 1 ? '#bba98a' : '#cfc6b2';
  const roof = ['#5a6b7d', '#3e5a7a', '#2f4d6e', '#28466b'][a];
  const H = 26 + a * 5;
  box(g, x + .1, y + .1, x + 2.9, y + 2.9, 0, 4, '#8b8475');
  box(g, x + .4, y + .4, x + 2.6, y + 2.6, 4, 4 + H, wall);
  faceY(g, y + 2.6, f => {
    f.fillStyle = '#2a1c12'; f.beginPath(); f.ellipse(x + 1.5, 4 + H * .68, .26, 6.5, 0, 0, Math.PI * 2); f.fill();
    f.strokeStyle = '#c9a45c'; f.lineWidth = .04; f.beginPath(); f.moveTo(x + 1.24, 4 + H * .68); f.lineTo(x + 1.76, 4 + H * .68); f.stroke();
    f.fillStyle = '#3b2412'; f.fillRect(x + 1.3, 4, .4, 13); f.beginPath(); f.ellipse(x + 1.5, 17, .2, 4, 0, 0, Math.PI); f.fill();
    f.fillStyle = '#f4ecd6'; f.fillRect(x + .6, 4 + H * .42, .45, 7); f.fillStyle = '#7a2e1a'; f.fillRect(x + .82, 4 + H * .42, .02, 7);
  });
  faceX(g, x + 2.6, f => { win(f, y + 1.0, 4 + H * .35, .22, 11); win(f, y + 2.0, 4 + H * .35, .22, 11); });
  gableY(g, x + .25, y + .25, x + 2.75, y + 2.75, 4 + H, 20 + a * 2, roof, wall);
  if (a >= 2) {
    box(g, x + 2.0, y + .05, x + 2.95, y + 1.0, 0, H * .75, wall);
    pyramid(g, x + 1.92, y - .03, x + 3.03, y + 1.08, H * .75, 18, roof);
  }
  const [bx, by] = P(x + 2.75, y + 2.75, 0);
  g.fillStyle = '#5a3b22'; g.fillRect(bx - 1, by - 22, 2, 22);
  g.fillStyle = '#f4ecd6'; g.fillRect(bx - 7, by - 26, 14, 8); g.fillStyle = '#7a2e1a'; g.fillRect(bx - .5, by - 26, 1, 8);
}

function drawWorkshop(g, b, t) {
  const a = S.age, x = b.x, y = b.y;
  const wall = '#dcc9a0', roof = ['#7a4a2a', '#6e3f24', '#5e3520', '#4f2d1c'][a], beam = '#6b4527';
  const H = 24 + a * 3;
  box(g, x + .3, y + .3, x + 2.7, y + 2.7, 0, H, wall);
  faceY(g, y + 2.7, f => {
    f.fillStyle = beam; for (const bx of [.3, 1.1, 1.9, 2.7]) f.fillRect(x + bx - .04, 0, .08, H); f.fillRect(x + .3, H * .55, 2.4, 2);
    f.fillStyle = '#4a2f1b'; f.fillRect(x + 1.15, 0, .7, 15);
    f.strokeStyle = '#8a5a32'; f.lineWidth = .05; f.beginPath(); f.moveTo(x + 1.15, 0); f.lineTo(x + 1.85, 15); f.moveTo(x + 1.85, 0); f.lineTo(x + 1.15, 15); f.stroke();
  });
  faceX(g, x + 2.7, f => {
    f.fillStyle = beam; for (const by of [.3, 1.5, 2.7]) f.fillRect(y + by - .04, 0, .08, H);
    f.fillStyle = '#5a5f66'; f.beginPath(); f.ellipse(y + .9, H * .6, .2, 6.5, 0, 0, Math.PI * 2); f.fill();
    f.fillStyle = wall; f.beginPath(); f.ellipse(y + .9, H * .6, .07, 2.3, 0, 0, Math.PI * 2); f.fill();
    win(f, y + 2.1, H * .45, .22, 8, '#2a1c12', false);
  });
  gableX(g, x + .15, y + .15, x + 2.85, y + 2.85, H, 18 + a * 2, roof, wall);
  const ch = H + 30 + a * 2;
  box(g, x + 1.9, y + .7, x + 2.3, y + 1.1, H, ch, '#8a4b3a');
  b.chimney = [x + 2.1, y + .9, ch];
  box(g, x + 2.72, y + 1.9, x + 2.98, y + 2.25, 0, 7, '#9a6a3a');
  box(g, x + 2.72, y + 2.35, x + 2.98, y + 2.65, 0, 5, '#8a5a30');
}

function drawTower(g, b, t) {
  const a = S.age, x = b.x, y = b.y;
  const stone = '#c2b8a5', roof = ['#7b3f2e', '#6b3f8f', '#5a3482', '#4b2c78'][a];
  const H = 58 + a * 7;
  box(g, x + .22, y + .22, x + 1.78, y + 1.78, 0, 10, '#9e968a');
  box(g, x + .45, y + .45, x + 1.55, y + 1.55, 10, 10 + H, stone);
  faceY(g, y + 1.55, f => { for (let k = 0; k < 3; k++) win(f, x + 1, 22 + k * H * .27, .1, 9); f.fillStyle = '#3b2412'; f.fillRect(x + .82, 10, .36, 12); });
  faceX(g, x + 1.55, f => { for (let k = 0; k < 3; k++) win(f, y + 1, 28 + k * H * .27, .1, 9); });
  box(g, x + .3, y + .3, x + 1.7, y + 1.7, 10 + H, 17 + H, '#8a6a45');
  for (const [px, py, ph] of [[1.7, 1.0, 0], [1.0, 1.7, 1.7], [1.7, 0.6, 3.1]]) {
    const [sx, sy] = P(x + px, y + py, 17 + H + Math.abs(Math.sin(t * 2 + ph)) * 1.2);
    g.fillStyle = '#f2f0ea'; g.beginPath(); g.ellipse(sx, sy - 2, 2.6, 1.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8d4cc'; g.beginPath(); g.arc(sx + 1.8, sy - 3.6, 1.2, 0, Math.PI * 2); g.fill();
  }
  const A = pyramid(g, x + .2, y + .2, x + 1.8, y + 1.8, 17 + H, 30, roof);
  flag(g, A[0], A[1], t, a >= 3 ? '#e3b341' : '#2f6fd6', 16);
  b.top = [x + 1, y + 1, 17 + H + 20];
}

function drawHouse(g, b, t) {
  const a = S.age, x = b.x, y = b.y;
  const wall = a >= 1 ? '#d6c6a3' : '#a87a4d', roof = a >= 1 ? '#a4442e' : '#c09a52';
  box(g, x + .35, y + .35, x + 1.65, y + 1.65, 0, 16, wall);
  faceY(g, y + 1.65, f => { f.fillStyle = '#3b2412'; f.fillRect(x + .85, 0, .3, 10); });
  faceX(g, x + 1.65, f => win(f, y + 1, 7, .22, 5, '#2a1c12', false));
  gableY(g, x + .22, y + .22, x + 1.78, y + 1.78, 16, 15, roof, wall);
  if (a >= 1) { box(g, x + .55, y + .6, x + .78, y + .83, 16, 34, '#8a4b3a'); b.chimney = [x + .66, y + .71, 34]; }
}

function drawWonder(g, b, t) {
  const x = b.x, y = b.y, st = S.wonder.state, p = S.wonder.progress;
  if (st === 'plot') {
    const posts = [[.3, .3], [3.7, .3], [3.7, 3.7], [.3, 3.7]];
    g.strokeStyle = '#d9c08a'; g.lineWidth = 1;
    g.beginPath(); posts.forEach(([px, py], i) => { const q = P(x + px, y + py, 8); i ? g.lineTo(...q) : g.moveTo(...q); }); g.closePath(); g.stroke();
    for (const [px, py] of posts) { const [sx, sy] = P(x + px, y + py); g.fillStyle = '#6b4527'; g.fillRect(sx - 1.2, sy - 12, 2.4, 12); }
    const [sx, sy] = P(x + 2, y + 3.9);
    g.fillStyle = '#6b4527'; g.fillRect(sx - 1, sy - 24, 2, 24);
    g.fillStyle = '#e8d6aa'; g.fillRect(sx - 18, sy - 31, 36, 11);
    g.fillStyle = '#4a2f16'; g.font = '700 7px Cinzel, serif'; g.textAlign = 'center'; g.fillText('WONDER', sx, sy - 23);
    return;
  }
  const tiers = [[.15, 3.85, 0, 16, '#ddd3bd'], [.6, 3.4, 16, 38, '#e9e0cc'], [1.05, 2.95, 38, 62, '#f3ecdc']];
  const prog = st === 'done' ? 3 : p * 3.3;
  if (st === 'done') {
    const [gx, gy] = P(x + 2, y + 2, 70), pulse = .16 + Math.sin(t * 2) * .05;
    const grd = g.createRadialGradient(gx, gy, 4, gx, gy, 110);
    grd.addColorStop(0, `rgba(255,224,130,${pulse + .1})`); grd.addColorStop(1, 'rgba(255,224,130,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(gx, gy, 110, 0, Math.PI * 2); g.fill();
  }
  tiers.forEach(([a0, a1, z0, z1, c], i) => {
    const f = clamp(prog - i, 0, 1);
    if (f <= 0) return;
    const top = z0 + (z1 - z0) * f;
    box(g, x + a0, y + a0, x + a1, y + a1, z0, top, c);
    faceY(g, y + a1, fc => { fc.fillStyle = 'rgba(120,100,70,.25)'; for (let k = a0 + .2; k < a1 - .1; k += .35) fc.fillRect(x + k, z0, .1, top - z0); });
    faceX(g, x + a1, fc => { fc.fillStyle = 'rgba(80,60,40,.25)'; for (let k = a0 + .2; k < a1 - .1; k += .35) fc.fillRect(y + k, z0, .1, top - z0); });
    if (st === 'done') { g.strokeStyle = '#e2b646'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...P(x + a0, y + a1, top)); g.lineTo(...P(x + a1, y + a1, top)); g.lineTo(...P(x + a1, y + a0, top)); g.stroke(); }
    if (st === 'building' && f < 1) {
      g.strokeStyle = '#7a5530'; g.lineWidth = 1.4;
      for (const [cx, cy] of [[a0, a1], [a1, a1], [a1, a0], [(a0 + a1) / 2, a1], [a1, (a0 + a1) / 2]]) { const q0 = P(x + cx, y + cy, z0), q1 = P(x + cx, y + cy, top + 10); g.beginPath(); g.moveTo(...q0); g.lineTo(...q1); g.stroke(); }
      for (let zz = z0 + 6; zz < top + 10; zz += 8) { g.beginPath(); g.moveTo(...P(x + a0, y + a1, zz)); g.lineTo(...P(x + a1, y + a1, zz)); g.lineTo(...P(x + a1, y + a0, zz)); g.stroke(); }
    }
  });
  if (st === 'done') {
    const A = pyramid(g, x + 1.35, y + 1.35, x + 2.65, y + 2.65, 62, 70, '#e2b646');
    g.fillStyle = '#fff3b0'; g.shadowColor = '#ffd76a'; g.shadowBlur = 16;
    g.beginPath(); g.arc(A[0], A[1] - 4, 4.5, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
  }
}
function drawBuilding(g, b, t) {
  ({ hall: drawHall, library: drawLibrary, workshop: drawWorkshop, tower: drawTower, house: drawHouse, wonder: drawWonder })[b.kind](g, b, t);
}
function bboxOf(b) {
  const hitH = b.kind === 'wonder' ? (S.wonder.state === 'done' ? 150 : S.wonder.state === 'building' ? 40 + S.wonder.progress * 70 : 34) : b.hitH + (b.kind === 'house' ? 0 : S.age * 7);
  return { l: P(b.x, b.y + b.h)[0], r: P(b.x + b.w, b.y)[0], t: P(b.x, b.y)[1] - hitH, b: P(b.x + b.w, b.y + b.h)[1] };
}

/* ---------- resource sprites (pre-rendered) ---------- */
const SS = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
function makeSprite(w, h, ax, ay, fn) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS);
  const g = c.getContext('2d'); g.scale(SS, SS); g.translate(ax, ay); fn(g);
  return { c, w, h, ax, ay };
}
function blob(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function shadowEllipse(g, x, y, rx, ry, a = .25) { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
const SPR = { tree: [], bush: [], ideas: [], stone: [] };
function buildSprites() {
  const greens = [['#3f7a2e', '#5d9a3c', '#2c5a20'], ['#4a8634', '#6aa846', '#305f22'], ['#5b8f2c', '#7cae40', '#3b6a1c']];
  for (let v = 0; v < 6; v++) {
    const r = mulberry32(100 + v);
    if (v % 3 === 2) {
      SPR.tree.push(makeSprite(60, 84, 30, 72, g => {
        shadowEllipse(g, 6, 0, 15, 6);
        g.fillStyle = '#4f3320'; g.fillRect(-2, -14, 4, 14);
        const dark = ['#2f5e2f', '#2a5530'][v % 2], light = ['#417a3c', '#3c7040'][v % 2];
        [[0, -66, 9, 16], [0, -50, 12, 18], [0, -34, 15, 20]].reverse().forEach(([cx, top, w, h]) => {
          g.fillStyle = light; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - w, top + h + 4); g.lineTo(cx, top + h + 2); g.fill();
          g.fillStyle = dark; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + w, top + h + 4); g.lineTo(cx, top + h + 2); g.fill();
        });
      }));
    } else {
      const [base, hi, lo] = greens[v % 3];
      SPR.tree.push(makeSprite(60, 84, 30, 72, g => {
        shadowEllipse(g, 7, 0, 17, 6.5);
        g.fillStyle = '#5b3b22'; g.fillRect(-2.5, -22, 5, 22);
        const blobs = [[0, -36, 14], [-10, -30, 10], [10, -29, 10], [-5, -45, 10], [7, -43, 9]].map(([x, y, rr]) => [x + (r() - .5) * 4, y + (r() - .5) * 4, rr * (.9 + r() * .2)]);
        blobs.forEach(([x, y, rr]) => blob(g, x, y + 2, rr, lo));
        blobs.forEach(([x, y, rr]) => blob(g, x, y, rr, base));
        blobs.forEach(([x, y, rr]) => blob(g, x - rr * .3, y - rr * .35, rr * .5, hi));
      }));
    }
  }
  for (let v = 0; v < 2; v++) SPR.bush.push(makeSprite(44, 36, 22, 26, g => {
    const r = mulberry32(200 + v);
    shadowEllipse(g, 2, 0, 15, 5);
    [[-7, -7, 8], [6, -7, 8], [0, -12, 9]].forEach(([x, y, rr]) => blob(g, x, y, rr, '#3c7a32'));
    [[-8, -9, 4], [4, -13, 4.5]].forEach(([x, y, rr]) => blob(g, x, y, rr, '#5a9a46'));
    for (let i = 0; i < 12; i++) blob(g, (r() - .5) * 22, -4 - r() * 14, 1.6, r() < .6 ? '#c0392b' : '#7a2a18');
  }));
  for (let v = 0; v < 2; v++) SPR.ideas.push(makeSprite(56, 54, 28, 38, g => {
    const grd = g.createRadialGradient(0, -12, 2, 0, -12, 26); grd.addColorStop(0, 'rgba(255,226,120,.35)'); grd.addColorStop(1, 'rgba(255,226,120,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, -12, 26, 0, Math.PI * 2); g.fill();
    shadowEllipse(g, 2, 0, 18, 6);
    poly(g, [[-16, 0], [-12, -8], [-2, -11], [10, -9], [17, 0]], '#7d7265', null);
    poly(g, [[-16, 0], [-12, -8], [-4, -4], [0, 0]], '#6a6054', null);
    const crystals = v ? [[-7, -6, 7, 22, -2], [3, -7, 8, 28, 2], [11, -4, 6, 16, 3], [-12, -3, 5, 12, -3]] : [[-6, -6, 8, 26, -2], [5, -6, 7, 20, 3], [12, -3, 5, 13, 2], [-13, -2, 5, 11, -3]];
    for (const [cx, base, w, h, tilt] of crystals) {
      poly(g, [[cx - w / 2, base], [cx + tilt, base - h], [cx, base + 1]], '#f6d65a', null);
      poly(g, [[cx, base + 1], [cx + tilt, base - h], [cx + w / 2, base]], '#c99a22', null);
      g.fillStyle = 'rgba(255,255,220,.8)'; g.fillRect(cx - w * .2 + tilt * .3, base - h * .7, 1.2, h * .35);
    }
  }));
  for (let v = 0; v < 2; v++) SPR.stone.push(makeSprite(56, 46, 28, 32, g => {
    shadowEllipse(g, 2, 0, 18, 6);
    const rocks = v ? [[-9, 0, 11, 12], [6, 0, 12, 16], [0, -5, 9, 20]] : [[-8, 0, 12, 14], [8, 0, 10, 11], [1, -4, 10, 21]];
    for (const [cx, by, w, h] of rocks) {
      poly(g, [[cx - w, by], [cx - w * .8, by - h * .7], [cx - w * .1, by - h], [cx + w * .7, by - h * .75], [cx + w, by]], '#9aa0a5', 'rgba(40,40,40,.35)');
      poly(g, [[cx + w * .7, by - h * .75], [cx + w, by], [cx + w * .2, by], [cx - w * .1, by - h]], '#757b80', null);
    }
    g.strokeStyle = '#5fd38a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-6, -17); g.lineTo(6, -17); g.moveTo(0, -17); g.lineTo(5, -11); g.stroke();
    [[-6, -17], [0, -17], [6, -17], [5, -11]].forEach(([x, y]) => blob(g, x, y, 1.8, '#5fd38a'));
  }));
}
function spriteFor(r) { const list = SPR[r.kind]; return list[r.v % list.length]; }
function drawResource(g, r) {
  const s = spriteFor(r);
  const [px, py] = P(r.x + .5, r.y + .5);
  const k = r.kind === 'tree' ? r.s : (r.kind === 'bush' ? .75 + .25 * (r.amount / r.max) : .55 + .45 * (r.amount / r.max)) * (r.kind === 'tree' ? 1 : r.s);
  g.drawImage(s.c, px - s.ax * k, py - s.ay * k, s.w * k, s.h * k);
}

/* ---------- units ---------- */
const PLAYER = '#2f6fd6';
const CARRY_COLOR = { coffee: '#8a3a1f', code: '#b08850', ideas: '#f2c94c', commits: '#9aa0a5' };
function drawVillager(g, u, t, px, py) {
  const walking = u.path.length > 0, ph = walking ? Math.sin(t * 14 + u.id) : 0;
  const bob = walking ? Math.abs(Math.sin(t * 14 + u.id)) * 1.2 : 0;
  shadowEllipse(g, px, py, 7, 3.2, .3);
  g.save(); g.translate(px, py - bob); g.scale(u.face, 1);
  g.strokeStyle = '#3b2a1a'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-2, -6); g.lineTo(-2 + ph * 2.6, 0); g.moveTo(2, -6); g.lineTo(2 - ph * 2.6, 0); g.stroke();
  if (u.carry.amt > 0) { g.fillStyle = CARRY_COLOR[u.carry.type]; g.fillRect(-8, -16, 5, 7); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .8; g.strokeRect(-8, -16, 5, 7); }
  g.fillStyle = PLAYER; g.beginPath(); g.roundRect(-4.5, -15.5, 9, 10.5, 3); g.fill();
  g.fillStyle = '#6b4527'; g.fillRect(-4.5, -9, 9, 1.6);
  const working = u.state === 'gather' || u.state === 'building';
  const kind = u.state === 'building' ? 'hammer' : u.task && u.task.type;
  if (working && kind !== 'coffee') {
    const a = -1.2 + Math.sin(t * 10 + u.id) * .9;
    g.save(); g.translate(3, -12); g.rotate(a);
    g.strokeStyle = '#7a5530'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(9, 0); g.stroke();
    g.fillStyle = '#9aa0a5';
    if (kind === 'code') g.fillRect(7, -3, 3, 5); else if (kind === 'hammer') g.fillRect(7.5, -2.5, 3.5, 5); else { g.beginPath(); g.moveTo(9, -4); g.lineTo(11, 0); g.lineTo(9, 4); g.fill(); }
    g.restore();
  } else if (working) {
    const r = Math.sin(t * 8 + u.id) * 1.5;
    g.strokeStyle = '#e8b98a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(3, -13); g.lineTo(7, -16 + r); g.stroke();
    g.fillStyle = '#9a6a3a'; g.fillRect(2, -7, 6, 4);
  }
  blob(g, 0, -18.8, 3.7, '#e8b98a');
  g.fillStyle = '#4a2f16'; g.beginPath(); g.arc(0, -19.5, 3.9, Math.PI, 0); g.fill();
  g.restore();
}
function drawScout(g, u, t, px, py) {
  const walking = u.path.length > 0, ph = walking ? Math.sin(t * 16 + u.id) : 0;
  shadowEllipse(g, px, py, 12, 4, .3);
  g.save(); g.translate(px, py); g.scale(u.face, 1);
  g.strokeStyle = '#4a2c18'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); for (const [lx, s] of [[-6, 1], [-3, -1], [4, -1], [7, 1]]) { g.moveTo(lx, -8); g.lineTo(lx + ph * 2.5 * s, 0); } g.stroke();
  g.fillStyle = '#7a4b2a'; g.beginPath(); g.ellipse(0, -10, 9.5, 4.8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(5, -12); g.lineTo(11, -20); g.lineTo(14, -18); g.lineTo(9, -10); g.fill();
  g.beginPath(); g.ellipse(13, -19, 3.4, 2.2, .5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, -11); g.quadraticCurveTo(-13, -8, -12, -3); g.stroke();
  g.fillStyle = PLAYER; g.beginPath(); g.roundRect(-3.5, -24, 7, 10, 2); g.fill();
  blob(g, 0, -27, 3.3, '#e8b98a');
  g.fillStyle = '#9aa0a5'; g.beginPath(); g.arc(0, -27.8, 3.6, Math.PI, 0); g.fill();
  g.strokeStyle = '#5a3b22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(4, -18); g.lineTo(6, -42); g.stroke();
  g.fillStyle = PLAYER; g.beginPath(); g.moveTo(6, -42); g.lineTo(13, -39 + Math.sin(t * 6) * 1); g.lineTo(6, -36); g.fill();
  g.restore();
}
function drawUnit(g, u, t, ring) {
  const [px, py] = P(u.x + u.jx, u.y + u.jy);
  if (ring) { g.strokeStyle = '#ffe58a'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(px, py, u.type === 'scout' ? 13 : 9, u.type === 'scout' ? 5.5 : 4.2, 0, 0, Math.PI * 2); g.stroke(); }
  (u.type === 'scout' ? drawScout : drawVillager)(g, u, t, px, py);
}
function diamond(g, x, y, w, h, stroke, width = 1.6, dash = null) {
  g.strokeStyle = stroke; g.lineWidth = width; if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x + w, y)); g.lineTo(...P(x + w, y + h)); g.lineTo(...P(x, y + h)); g.closePath(); g.stroke();
  g.setLineDash([]);
}
