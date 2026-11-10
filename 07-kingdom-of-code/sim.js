'use strict';
/* ==========================================================================
   Simulation: developers, the scout, gathering, training, ages, the Wonder,
   particles and floating text.
   ========================================================================== */

const units = [];
const particles = [];
const floaters = [];
const markers = [];
const pigeons = [];
let uid = 0;
const ageMult = () => 1 + S.age * .2;

function spawnUnit(type, x, y) {
  const u = {
    id: ++uid, type, x: x + .5, y: y + .5, jx: (Math.random() - .5) * .3, jy: (Math.random() - .5) * .3,
    path: [], state: 'idle', task: null, prevTask: null, carry: { type: null, amt: 0 }, timer: 0, face: 1,
    name: type === 'scout' ? 'Pathfinder' : NAMES[(uid - 1) % NAMES.length], speed: type === 'scout' ? 4.2 : 2.5, waypoints: [],
  };
  units.push(u);
  return u;
}
const villagers = () => units.filter(u => u.type === 'villager');
const idleVillagers = () => villagers().filter(u => u.state === 'idle' && !u.path.length);
const popUsed = () => villagers().length + HALL.queue.length;

/* ---------- gathering ---------- */
function assignedCount(r) { return units.filter(u => u.task && u.task.res === r).length; }
function findResource(u, type, exclude) {
  const cands = resources.filter(r => !r.dead && NODE[r.kind].res === type && r !== exclude)
    .map(r => ({ r, s: Math.hypot(r.x + .5 - u.x, r.y + .5 - u.y) + assignedCount(r) * 1.6 + (explored[idx(r.x, r.y)] ? 0 : 7) }))
    .sort((a, b) => a.s - b.s).slice(0, 6);
  for (const { r } of cands) { const p = pathToObject(u, r); if (p) return { r, p }; }
  return null;
}
function gatherType(u, type, quiet) {
  const f = findResource(u, type);
  if (!f) { if (!quiet) log(`No ${RES_INFO[type].name.toLowerCase()} within reach for ${u.name}.`, '#e8a07a'); u.state = 'idle'; u.task = null; return false; }
  setGather(u, f.r, f.p);
  return true;
}
function setGather(u, r, p) {
  const type = NODE[r.kind].res;
  u.task = { kind: 'gather', type, res: r };
  u.path = p || pathToObject(u, r) || [];
  u.state = 'toRes';
}
function goToResource(u) {
  const t = u.task;
  if (!t) { u.state = 'idle'; return; }
  if (!t.res || t.res.dead) {
    const f = findResource(u, t.type);
    if (!f) { u.state = 'idle'; u.task = null; return; }
    t.res = f.r; u.path = f.p; u.state = 'toRes'; return;
  }
  const p = pathToObject(u, t.res);
  if (!p) { const f = findResource(u, t.type, t.res); if (!f) { u.state = 'idle'; u.task = null; return; } t.res = f.r; u.path = f.p; }
  else u.path = p;
  u.state = 'toRes';
}
function goToDrop(u) {
  const p = pathToObject(u, HALL);
  if (!p) { u.state = 'idle'; return; }
  u.path = p; u.state = 'toDrop';
}
function startGather(u) {
  const r = u.task && u.task.res;
  if (r && !r.dead && isAdj(Math.floor(u.x), Math.floor(u.y), rectOf(r))) {
    u.state = 'gather'; u.timer = 0;
    const sdx = (r.x + .5 - u.x) - (r.y + .5 - u.y); if (Math.abs(sdx) > .05) u.face = sdx > 0 ? 1 : -1;
  } else goToResource(u);
}
const CHARS = { code: [';', '{', '}', '()', '=>', '[]', '</>', '&&'], ideas: ['✦', '✧', '★'], coffee: ['•', '◦'], commits: ['●', '○'] };
function doGather(u, dt) {
  const r = u.task.res;
  if (!r || r.dead) { if (u.carry.amt > 0) goToDrop(u); else goToResource(u); return; }
  const type = u.task.type;
  if (u.carry.type !== type) u.carry = { type, amt: 0 };
  u.timer += dt;
  const iv = NODE[r.kind].interval / ageMult();
  while (u.timer >= iv) {
    u.timer -= iv;
    u.carry.amt++; r.amount--;
    if (onScreen(r.x + .5, r.y + .5)) {
      if (Math.random() < .3) {
        const [px, py] = P(r.x + .5, r.y + .5, r.kind === 'tree' ? 38 : 14);
        const list = CHARS[type];
        particles.push({ x: px + (Math.random() - .5) * 14, y: py, vx: (Math.random() - .5) * 14, vy: -22 - Math.random() * 12, life: 1.1, max: 1.1, text: list[Math.floor(Math.random() * list.length)], color: RES_INFO[type].color });
      }
      ({ code: SFX.chop, ideas: SFX.mine, commits: SFX.mine, coffee: SFX.pick })[type]();
    }
    if (r.amount <= 0) { removeRes(r); }
    if (u.carry.amt >= CARRY || r.dead) { goToDrop(u); return; }
  }
}
function deposit(u) {
  if (u.carry.amt > 0) {
    const { type, amt } = u.carry;
    S.res[type] += amt; S.gathered += amt;
    const [px, py] = P(u.x, u.y, 26);
    floaters.push({ x: px, y: py, text: `+${amt}`, color: RES_INFO[type].color, life: 1.4, max: 1.4 });
    flashRes(type);
    if (onScreen(u.x, u.y)) SFX.drop();
    u.carry = { type: null, amt: 0 };
  }
  if (u.task && u.task.kind === 'gather') goToResource(u); else u.state = 'idle';
}

/* ---------- player commands ---------- */
const OFFS = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2], [2, 1], [1, 2]];
function commandMove(list, tx, ty) {
  list.forEach((u, i) => {
    const [ox, oy] = OFFS[i % OFFS.length];
    const p = pathToTile(u, Math.floor(tx) + ox, Math.floor(ty) + oy);
    u.task = null; u.waypoints = [];
    if (p) { u.path = p; u.state = 'move'; }
  });
  markers.push({ x: tx, y: ty, life: .6, color: '#9cff6b' });
  SFX.ack();
}
function commandGather(list, r) {
  let ok = false;
  for (const u of list) {
    if (u.type !== 'villager') { const p = pathToObject(u, r); if (p) { u.path = p; u.state = 'move'; u.waypoints = []; } continue; }
    const p = pathToObject(u, r);
    if (p) { setGather(u, r, p); ok = true; }
  }
  markers.push({ x: r.x + .5, y: r.y + .5, life: .6, color: '#ffe58a' });
  if (ok) SFX.ack(); else SFX.error();
}
function commandBuilding(list, b) {
  if (b.kind === 'wonder' && S.wonder.state === 'building') { list.filter(u => u.type === 'villager').forEach(sendBuilder); SFX.ack(); return; }
  for (const u of list) {
    if (b === HALL && u.carry.amt > 0) { goToDrop(u); continue; }
    const p = pathToObject(u, b); if (p) { u.path = p; u.state = 'move'; u.task = null; u.waypoints = []; }
  }
  markers.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, life: .6, color: '#9cff6b' });
  SFX.ack();
}

/* ---------- training, ages, research ---------- */
function neededType() {
  const target = AGE_COST[S.age + 1] || (S.wonder.state === 'plot' ? WONDER_COST : null) || { coffee: 300, code: 300, ideas: 300, commits: 300 };
  let best = 'coffee', bestScore = -Infinity;
  for (const k of RES_TYPES) {
    const need = target[k] || 0;
    const workers = villagers().filter(u => u.task && u.task.type === k).length;
    const score = (need - S.res[k]) / Math.max(need, 60) - workers * .22 + (k === 'coffee' && S.res.coffee < 100 ? .3 : 0);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}
function trainVillager() {
  if (popUsed() >= POP_CAP) { log('You need more houses. (The population cap is 15.)', '#e8a07a'); SFX.error(); return; }
  if (HALL.queue.length >= 5) { SFX.error(); return; }
  if (!canAfford(TRAIN_COST)) { log('Not enough coffee.', '#e8a07a'); SFX.error(); return; }
  pay(TRAIN_COST);
  HALL.queue.push({ t: TRAIN_TIME, total: TRAIN_TIME });
  SFX.building();
  panelDirty = true;
}
function spawnVillagerFromHall(free) {
  const t = nearestWalkable(HALL.x + 2, HALL.y + HALL.h, 6) || { x: HALL.x + 2, y: HALL.y + HALL.h };
  const u = spawnUnit('villager', t.x, t.y);
  gatherType(u, neededType(), true);
  if (!free) S.trained++;
  return u;
}
function advanceAge() {
  if (S.age >= 3 || S.ageResearch) return;
  const cost = AGE_COST[S.age + 1];
  if (!canAfford(cost)) { log('Not enough resources to advance.', '#e8a07a'); SFX.error(); return; }
  pay(cost);
  S.ageResearch = { t: AGE_TIME[S.age + 1], total: AGE_TIME[S.age + 1] };
  log(`Advancing to the ${AGES[S.age + 1].name}…`, '#ffe08a');
  SFX.building();
  panelDirty = true;
}
function finishAge() {
  S.ageResearch = null;
  S.age = Math.min(3, S.age + 1);
  const a = AGES[S.age];
  showBanner(`${SITE.name} has advanced to`, a.name);
  log(`${a.name}: ${a.desc} Developers now work ${Math.round((ageMult() - 1) * 100)}% faster.`, '#ffe08a');
  SFX.ageUp();
  burst(HALL.x + 2, HALL.y + 2, 60, '#ffe08a');
  if (S.age === 3) { complete('age'); log('The Wonder Plot awaits. Select the Town Hall or the plot to build the Wonder.', '#ffe08a'); }
  panelDirty = true;
}
function startResearch(p) {
  if (S.researched.has(p.id)) { openProject(p); return; }
  if (S.researching) { log('The Workshop is busy researching.', '#e8a07a'); SFX.error(); return; }
  S.researching = { id: p.id, t: 1.6, total: 1.6 };
  SFX.building();
  panelDirty = true;
}
function finishResearch() {
  const p = PROJECTS.find(q => q.id === S.researching.id);
  S.researching = null;
  S.researched.add(p.id);
  complete('project');
  log(`Research complete: ${p.name}.`, '#9ad873');
  SFX.trained();
  burst(31 + 1.5, 13 + 1.5, 24, '#9ad873');
  openProject(p);
  panelDirty = true;
}

/* ---------- the Wonder ---------- */
function buildWonder() {
  if (S.age < 3) { log('The Wonder can only be built in the Age of Clouds.', '#e8a07a'); SFX.error(); return; }
  if (S.wonder.state !== 'plot') return;
  if (!canAfford(WONDER_COST)) { log('Not enough resources for the Wonder.', '#e8a07a'); SFX.error(); return; }
  pay(WONDER_COST);
  S.wonder.state = 'building';
  buildings.find(b => b.kind === 'wonder').name = 'Wonder (under construction)';
  const W = buildings.find(b => b.kind === 'wonder');
  villagers().sort((a, b) => Math.hypot(a.x - W.x, a.y - W.y) - Math.hypot(b.x - W.x, b.y - W.y)).slice(0, 6).forEach(sendBuilder);
  log('Construction of the Wonder has begun!', '#ffe08a');
  SFX.building();
  panelDirty = true;
}
function sendBuilder(u) {
  const W = buildings.find(b => b.kind === 'wonder');
  if (u.state === 'building' || u.state === 'toBuild') return;
  const p = pathToObject(u, W);
  if (!p) return;
  u.prevTask = u.task && u.task.kind === 'gather' ? { ...u.task } : null;
  u.task = { kind: 'build' };
  u.path = p; u.state = 'toBuild';
}
function doBuild(u, dt) {
  if (S.wonder.state !== 'building') { resumeAfterBuild(u); return; }
  S.wonder.progress = Math.min(1, S.wonder.progress + dt / WONDER_TIME * ageMult());
  if (Math.random() < dt * 3) { const [px, py] = P(u.x, u.y, 14); particles.push({ x: px, y: py, vx: (Math.random() - .5) * 20, vy: -18, life: .6, max: .6, text: '·', color: '#e9e0cc' }); }
  if (onScreen(u.x, u.y) && Math.random() < dt * 2) noise(.04, .05, 900);
  if (S.wonder.progress >= 1) completeWonder();
}
function resumeAfterBuild(u) {
  const t = u.prevTask; u.prevTask = null;
  if (t) { u.task = t; goToResource(u); } else { u.task = null; u.state = 'idle'; gatherType(u, neededType(), true); }
}
function completeWonder() {
  if (S.wonder.state === 'done') return;
  S.wonder.state = 'done'; S.wonder.progress = 1;
  const W = buildings.find(b => b.kind === 'wonder');
  W.name = 'The Wonder of tthisk';
  W.discovered = true;
  units.forEach(u => { if (u.state === 'building' || u.state === 'toBuild') { u.path = []; resumeAfterBuild(u); } });
  complete('wonder');
  burst(W.x + 2, W.y + 2, 90, '#ffe08a');
  showBanner('Behold', 'The Wonder of tthisk');
  SFX.victory();
  panelDirty = true;
  setTimeout(showVictory, 2600);
}

/* ---------- scout ---------- */
function scoutRoute() {
  const pts = [];
  for (const [r, n] of [[9, 9], [15, 14], [20, 18]]) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + r * .3;
    const t = nearestWalkable(HALL_C.x + Math.cos(a) * r, HALL_C.y + Math.sin(a) * r, 4);
    if (t) pts.push(t);
  }
  return pts;
}
function nextScoutLeg(u) {
  while (u.waypoints.length) {
    const wp = u.waypoints.shift();
    const seen = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].every(([dx, dy]) => !inb(wp.x + dx, wp.y + dy) || explored[idx(wp.x + dx, wp.y + dy)]);
    if (seen) continue;
    const p = pathToTile(u, wp.x, wp.y);
    if (p && p.length) { u.path = p; u.state = 'scout'; return; }
  }
  if (u.state === 'scout') { u.state = 'idle'; log(`${u.name} has finished scouting the realm.`); panelDirty = true; }
}
function exploreCommand(u) { u.waypoints = scoutRoute(); u.task = null; u.state = 'scout'; nextScoutLeg(u); SFX.ack(); }

/* ---------- main unit update ---------- */
function moveUnit(u, dt) {
  let step = u.speed * dt;
  while (step > 0 && u.path.length) {
    const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
    const sdx = dx - dy; if (Math.abs(sdx) > .02) u.face = sdx > 0 ? 1 : -1;
    if (d <= step) { u.x = p.x; u.y = p.y; u.path.shift(); step -= d; }
    else { u.x += dx / d * step; u.y += dy / d * step; step = 0; }
  }
}
function updateUnit(u, dt) {
  if (u.path.length) { moveUnit(u, dt); if (u.path.length) return; }
  switch (u.state) {
    case 'toRes': startGather(u); break;
    case 'toDrop': deposit(u); break;
    case 'move': u.state = 'idle'; break;
    case 'toBuild': u.state = 'building'; break;
    case 'gather': doGather(u, dt); break;
    case 'building': doBuild(u, dt); break;
    case 'scout': nextScoutLeg(u); break;
  }
}
function statusOf(u) {
  const t = u.task;
  switch (u.state) {
    case 'gather': return `Gathering ${RES_INFO[t.type].name} · ${u.carry.amt}/${CARRY}`;
    case 'toRes': return `Heading out for ${RES_INFO[t.type].name}`;
    case 'toDrop': return `Carrying ${u.carry.amt} ${RES_INFO[u.carry.type].name} to the Town Hall`;
    case 'building': return 'Building the Wonder';
    case 'toBuild': return 'Walking to the Wonder';
    case 'scout': return 'Exploring the realm';
    case 'move': return 'Walking';
    default: return 'Idle. Waiting for orders.';
  }
}

/* ---------- effects ---------- */
function burst(tx, ty, n, color) {
  const [px, py] = P(tx, ty, 30);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90;
    particles.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6 - 40, life: 1.4, max: 1.4, text: Math.random() < .5 ? '✦' : '·', color, grav: 60 });
  }
}
function smoke(x, y, z) {
  const [px, py] = P(x, y, z);
  particles.push({ x: px + (Math.random() - .5) * 3, y: py, vx: 6 + Math.random() * 6, vy: -16 - Math.random() * 6, life: 2.6, max: 2.6, smoke: true, r: 3 });
}
function sendPigeon() {
  const T = buildings.find(b => b.kind === 'tower');
  const top = T.top || [T.x + 1, T.y + 1, 100];
  const [px, py] = P(...top);
  pigeons.push({ x: px, y: py, vx: 150, vy: -70, life: 4 });
  SFX.pigeon();
}
let smokeT = 0;
function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.grav) p.vy += p.grav * dt;
    if (p.smoke) { p.r += dt * 4; p.vx *= .99; }
  }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt; f.y -= 22 * dt; if (f.life <= 0) floaters.splice(i, 1); }
  for (let i = markers.length - 1; i >= 0; i--) { markers[i].life -= dt; if (markers[i].life <= 0) markers.splice(i, 1); }
  for (let i = pigeons.length - 1; i >= 0; i--) { const p = pigeons[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 8 * dt; if (p.life <= 0) pigeons.splice(i, 1); }
  smokeT -= dt;
  if (smokeT <= 0 && !reduced) {
    smokeT = .28;
    for (const b of buildings) if (b.chimney && b.discovered && onScreen(b.x + 1, b.y + 1) && (b.kind === 'workshop' || Math.random() < .35)) smoke(...b.chimney);
  }
}
