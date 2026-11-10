'use strict';
/* ==========================================================================
   UI: selection panel + command grid, tooltips, log, objectives, modals,
   chat (with cheat codes), classic view and the victory screen.
   ========================================================================== */

let panelDirty = true;
let live = [];
let hotkeys = {};
const HK = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Z', 'X', 'C', 'B', 'N'];

/* ---------- log + banner ---------- */
function log(html, color) {
  const el = document.createElement('div');
  el.className = 'log-line';
  el.innerHTML = html;
  if (color) el.style.color = color;
  const box = $('#log');
  box.appendChild(el);
  while (box.children.length > 7) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 1300); }, 8000);
}
function showBanner(small, big) {
  const b = $('#banner');
  $('#banner-small').textContent = small; $('#banner-big').textContent = big;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function flashRes(type) {
  const el = $(`#r-${type}`).parentElement;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/* ---------- tooltips ---------- */
const tipEl = $('#tip');
function costHtml(cost) {
  if (!cost) return '';
  return `<div class="cost">${Object.entries(cost).map(([k, v]) =>
    `<span class="${S.res[k] < v ? 'short' : ''}" style="color:${S.res[k] < v ? '' : '#5a3a12'}">${icon(RES_INFO[k].icon)}${v}</span>`).join('')}</div>`;
}
function showTip(html, x, y) {
  tipEl.innerHTML = html; tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = clamp(x - r.width / 2, 8, innerWidth - r.width - 8) + 'px';
  tipEl.style.top = Math.max(8, y - r.height - 12) + 'px';
}
const hideTip = () => { tipEl.style.display = 'none'; };
const TOP_TIPS = {
  coffee: () => `<b>Coffee</b>${RES_INFO.coffee.desc}`,
  code: () => `<b>Code</b>${RES_INFO.code.desc}`,
  ideas: () => `<b>Ideas</b>${RES_INFO.ideas.desc}`,
  commits: () => `<b>Commits</b>${RES_INFO.commits.desc}`,
  pop: () => `<b>Population</b>${villagers().length} developers, ${HALL.queue.length} in training. The village houses up to ${POP_CAP}.`,
  age: () => `<b>${AGES[S.age].name}</b>${AGES[S.age].desc}${S.age < 3 ? `<br><br>Next: ${AGES[S.age + 1].name}` + costHtml(AGE_COST[S.age + 1]) : ''}`,
};
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mouseenter', () => { const r = el.getBoundingClientRect(); showTip(TOP_TIPS[el.dataset.tip](), r.left + r.width / 2, r.bottom + 12 + 80); tipEl.style.top = r.bottom + 8 + 'px'; });
  el.addEventListener('mouseleave', hideTip);
});

/* ---------- selection ---------- */
function select(sel, quiet) {
  S.sel = sel;
  panelDirty = true;
  if (!sel || quiet) return;
  if (sel.kind === 'building') {
    SFX.building();
    if (sel.b === HALL) complete('hall');
  } else SFX.select();
}
function selectBuildingById(id) {
  const b = buildings.find(x => x.id === id);
  if (!b.discovered) { discover(b, false); }
  select({ kind: 'building', b });
  centerOn(b.x + b.w / 2, b.y + b.h / 2);
}
function discover(b, byExploring) {
  if (b.discovered) return;
  b.discovered = true;
  minimapDirty = true;
  if (b.kind === 'house') return;
  pings.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, life: 3 });
  const what = b.section ? ` <span style="color:#d8c79a">(${b.section})</span>` : '';
  log(`${byExploring ? 'Discovered' : 'Located'}: <b>${b.name}</b>${what}`, '#ffe08a');
  SFX.discover();
}
function complete(id) {
  if (S.done.has(id)) return;
  S.done.add(id);
  const o = OBJECTIVES.find(x => x.id === id);
  log(`✔ Objective complete: ${o.text}`, '#a6e36d');
  renderObjectives();
}

/* ---------- the panel ---------- */
const cmdEl = $('#commands'), infoEl = $('#info-body'), portraitEl = $('#portrait');
function C(o) { return o; }
function panelSpec() {
  const sel = S.sel;
  const T = id => buildings.find(b => b.id === id);
  if (!sel) {
    return {
      title: 'Kingdom of Code', sub: `${SITE.name} · ${SITE.role}`,
      html: `<p>Every building holds part of this site. Select one to explore it, or command your developers to grow the village.</p><p class="muted">Town Hall: about · Library: blog · Workshop: projects · Tower: contact</p>`,
      portrait: { kind: 'building', b: HALL },
      cmds: [
        C({ icon: 'ic-hall', label: 'Town Hall', desc: 'About Matthis.', hk: 'H', on: () => selectBuildingById('hall') }),
        C({ icon: 'ic-scroll', label: 'The Library', desc: 'The blog: scrolls of writing.', hk: 'L', on: () => selectBuildingById('library') }),
        C({ icon: 'ic-gear', label: 'Project Workshop', desc: 'Projects, researched as technologies.', hk: 'P', on: () => selectBuildingById('workshop') }),
        C({ icon: 'ic-bird', label: 'Messenger Tower', desc: 'Ways to get in touch.', hk: 'M', on: () => selectBuildingById('tower') }),
        C({ icon: 'ic-villager', label: 'Next idle developer', desc: 'Find someone with nothing to do.', hk: '.', on: selectIdle }),
        C({ icon: 'ic-flag', label: 'Objectives', desc: 'What is there to do here?', hk: 'O', on: toggleObjectives }),
        C({ icon: 'ic-book', label: 'Classic view', desc: 'Read the whole site as a plain page.', hk: 'V', on: openClassic }),
      ],
    };
  }
  if (sel.kind === 'units') {
    const list = sel.units, vs = list.filter(u => u.type === 'villager'), one = list.length === 1 ? list[0] : null;
    const gatherCmd = (type, hk) => C({ icon: RES_INFO[type].icon, cls: `c-${type}`, label: `Gather ${RES_INFO[type].name}`, desc: RES_INFO[type].desc, hk, on: () => { vs.forEach(u => gatherType(u, type)); SFX.ack(); } });
    const cmds = [];
    if (vs.length) cmds.push(gatherCmd('coffee', 'Q'), gatherCmd('code', 'W'), gatherCmd('ideas', 'E'), gatherCmd('commits', 'R'),
      C({ icon: 'ic-return', label: 'Return cargo', desc: 'Carry what you have to the Town Hall.', hk: 'A', on: () => { vs.forEach(u => u.carry.amt && goToDrop(u)); SFX.ack(); } }));
    if (vs.length && S.wonder.state === 'building') cmds.push(C({ icon: 'ic-wonder', label: 'Build the Wonder', desc: 'Help construct the Wonder.', hk: 'T', on: () => { vs.forEach(sendBuilder); SFX.ack(); } }));
    if (list.some(u => u.type === 'scout')) cmds.push(C({ icon: 'ic-compass', label: 'Explore', desc: 'Ride out and uncover the map.', hk: vs.length ? 'D' : 'Q', on: () => list.filter(u => u.type === 'scout').forEach(exploreCommand) }));
    cmds.push(C({ icon: 'ic-stop', label: 'Stop', desc: 'Stop whatever you are doing.', hk: 'S', on: () => { list.forEach(u => { u.path = []; u.task = null; u.state = 'idle'; u.waypoints = []; }); SFX.ack(); } }));
    if (one) {
      return {
        title: one.name, sub: one.type === 'scout' ? 'Scout · fast and curious' : 'Developer',
        html: `<p id="live-status"></p>${one.type === 'villager' ? `<p class="muted">Carries up to ${CARRY}. Works ${Math.round((ageMult() - 1) * 100)}% faster than in the Age of Scripts.</p>` : '<p class="muted">Sees far. Never gets lost. Refuses to carry anything.</p>'}`,
        portrait: { kind: 'unit', u: one }, cmds,
        live: () => { const el = $('#live-status'); if (el) el.textContent = statusOf(one); },
      };
    }
    return {
      title: `${list.length} selected`, sub: vs.length === list.length ? 'Developers' : 'Mixed group',
      html: `<div class="chips">${list.map(u => `<span class="chip">${esc(u.name)}</span>`).join('')}</div>`,
      portrait: { kind: 'unit', u: list[0] }, cmds,
    };
  }
  if (sel.kind === 'res') {
    const r = sel.r, n = NODE[r.kind];
    return {
      title: n.name, sub: `${RES_INFO[n.res].name} source`,
      html: `<p>${n.desc}</p><p><span class="stat" style="color:${RES_INFO[n.res].color}">${icon(RES_INFO[n.res].icon)}<span id="live-amt"></span></span><span class="muted" id="live-workers"></span></p>`,
      portrait: sel,
      cmds: [C({ icon: 'ic-villager', label: 'Send idle developers', desc: 'Everyone without a job gathers here.', hk: 'Q', on: () => { const idle = idleVillagers(); if (!idle.length) { log('Nobody is idle.'); SFX.error(); } else commandGather(idle, r); } })],
      live: () => { const a = $('#live-amt'), w = $('#live-workers'); if (a) a.textContent = `${r.amount} left`; if (w) w.textContent = `${assignedCount(r)} gathering`; },
    };
  }
  const b = sel.b;
  if (b.kind === 'hall') {
    const cmds = [
      C({ icon: 'ic-villager', label: 'Train Developer', desc: 'A new pair of hands. Automatically gets to work on whatever the village needs most.', hk: 'Q', cost: TRAIN_COST, on: trainVillager, enabled: () => popUsed() < POP_CAP && HALL.queue.length < 5 && canAfford(TRAIN_COST) }),
      C({ icon: 'ic-book', label: 'Read the biography', desc: 'About Matthis, founder of this village.', hk: 'W', on: openAbout }),
    ];
    if (S.age < 3) cmds.push(C({ icon: 'ic-age', label: `Advance to the ${AGES[S.age + 1].name}`, desc: `${AGES[S.age + 1].desc} Buildings are upgraded and developers work faster.`, hk: 'E', cost: AGE_COST[S.age + 1], on: advanceAge, enabled: () => !S.ageResearch && canAfford(AGE_COST[S.age + 1]), progress: () => S.ageResearch ? 1 - S.ageResearch.t / S.ageResearch.total : null }));
    if (S.age >= 3 && S.wonder.state === 'plot') cmds.push(C({ icon: 'ic-wonder', label: 'Build the Wonder', desc: 'The crowning achievement of the village. Sends up to six developers to build it.', hk: 'R', cost: WONDER_COST, on: buildWonder, enabled: () => canAfford(WONDER_COST) }));
    return {
      title: 'Town Hall', sub: `${AGES[S.age].name} · About me`,
      html: `<p>${esc(SITE.about[0])}</p><div id="live-q" class="muted"></div><div class="bar" id="live-bar-wrap" hidden><i id="live-bar"></i></div>`,
      portrait: sel, cmds,
      live: () => {
        const q = HALL.queue, ar = S.ageResearch, el = $('#live-q'), bw = $('#live-bar-wrap'), bar = $('#live-bar');
        if (!el) return;
        if (ar) { el.textContent = `Advancing to the ${AGES[S.age + 1].name}…`; bw.hidden = false; bar.style.width = (1 - ar.t / ar.total) * 100 + '%'; }
        else if (q.length) { el.textContent = `Training developer (${q.length} queued)`; bw.hidden = false; bar.style.width = (1 - q[0].t / q[0].total) * 100 + '%'; }
        else { el.textContent = 'Drop-off point for all resources.'; bw.hidden = true; }
      },
    };
  }
  if (b.kind === 'library') {
    return {
      title: 'The Library', sub: 'Blog · scrolls of writing',
      html: `<p>${POSTS.length} scrolls are archived here. Each one is a blog post. Pick one to unroll it.</p><p class="muted" id="live-read"></p>`,
      portrait: sel,
      cmds: [...POSTS.map((p, i) => C({ icon: 'ic-scroll', label: p.title, desc: `${p.date} · ${p.mins} min read · ${p.tags.join(', ')}`, hk: HK[i], on: () => openPost(p), done: () => S.read.has(p.id) })),
        C({ icon: 'ic-book', label: 'Catalogue', desc: 'Every scroll in the archive.', hk: 'A', on: openCatalogue })],
      live: () => { const el = $('#live-read'); if (el) el.textContent = `${S.read.size} of ${POSTS.length} read`; },
    };
  }
  if (b.kind === 'workshop') {
    return {
      title: 'Project Workshop', sub: 'Projects · research technologies',
      html: `<p>Things I've built. Research a project to learn its story.</p><p class="muted" id="live-res"></p><div class="bar" id="live-bar-wrap" hidden><i id="live-bar"></i></div>`,
      portrait: sel,
      cmds: PROJECTS.map((p, i) => C({ icon: 'ic-gear', label: p.name, desc: `${p.year} · ${p.stack.join(' · ')}`, hk: HK[i], on: () => startResearch(p), done: () => S.researched.has(p.id), progress: () => S.researching && S.researching.id === p.id ? 1 - S.researching.t / S.researching.total : null, enabled: () => !S.researching || S.researching.id === p.id })),
      live: () => {
        const el = $('#live-res'), bw = $('#live-bar-wrap'), bar = $('#live-bar'); if (!el) return;
        const r = S.researching;
        if (r) { el.textContent = `Researching ${PROJECTS.find(p => p.id === r.id).name}…`; bw.hidden = false; bar.style.width = (1 - r.t / r.total) * 100 + '%'; }
        else { el.textContent = `${S.researched.size} of ${PROJECTS.length} researched`; bw.hidden = true; }
      },
    };
  }
  if (b.kind === 'tower') {
    return {
      title: 'Messenger Tower', sub: 'Contact',
      html: `<p>Trained pigeons stand ready to carry your message across the realm.</p>`,
      portrait: sel,
      cmds: [
        C({ icon: 'ic-bird', label: 'Send a pigeon to GitHub', desc: 'Opens my GitHub profile in a new tab.', hk: 'Q', on: () => { window.open(SITE.github, '_blank', 'noopener'); sendPigeon(); complete('message'); log('A pigeon flies off towards GitHub.'); } }),
        C({ icon: 'ic-letter', label: 'Write a letter', desc: 'Email me.', hk: 'W', on: () => { openLetter(); sendPigeon(); complete('message'); } }),
        C({ icon: 'ic-rss', label: 'Hire the herald (RSS)', desc: 'Get new scrolls announced in your feed reader.', hk: 'E', on: () => { sendPigeon(); complete('message'); log('The herald will announce new scrolls. (RSS feed coming soon.)'); } }),
      ],
    };
  }
  if (b.kind === 'house') return { title: 'Developer House', sub: 'Housing', html: '<p>Home to a handful of developers. Smells faintly of coffee and solder.</p>', portrait: sel, cmds: [] };
  // wonder
  const st = S.wonder.state;
  return {
    title: b.name, sub: st === 'done' ? 'Victory monument' : 'Wonder',
    html: st === 'plot' ? `<p>A plot reserved for the village's greatest work. It can only be built in the <b>${AGES[3].name}</b>.</p>`
      : st === 'building' ? `<p>Under construction. More builders means faster progress.</p><div class="bar"><i id="live-bar"></i></div><p class="muted" id="live-pct"></p>`
      : `<p>A monument to every late night, every refactor and every cup of coffee. You have conquered tthisk.com.</p>`,
    portrait: sel,
    cmds: st === 'plot' ? [C({ icon: 'ic-wonder', label: 'Build the Wonder', desc: 'Sends up to six developers to build it.', hk: 'Q', cost: WONDER_COST, on: buildWonder, enabled: () => S.age >= 3 && canAfford(WONDER_COST) })]
      : st === 'building' ? [C({ icon: 'ic-villager', label: 'Send idle developers', desc: 'More hands, faster Wonder.', hk: 'Q', on: () => idleVillagers().forEach(sendBuilder) })]
      : [C({ icon: 'ic-flag', label: 'Victory screen', desc: 'See your stats again.', hk: 'Q', on: showVictory })],
    live: () => { const bar = $('#live-bar'), pct = $('#live-pct'); if (bar) bar.style.width = S.wonder.progress * 100 + '%'; if (pct) pct.textContent = `${Math.floor(S.wonder.progress * 100)}% · ${units.filter(u => u.state === 'building').length} builders`; },
  };
}

function renderPanel() {
  panelDirty = false;
  if (S.sel && S.sel.kind === 'building' && !buildings.includes(S.sel.b)) S.sel = null;
  const spec = panelSpec();
  hotkeys = {};
  cmdEl.innerHTML = '';
  live = [];
  spec.cmds.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cmd ' + (c.cls || '');
    btn.setAttribute('aria-label', c.label);
    btn.innerHTML = `${icon(c.icon)}<kbd>${c.hk === '.' ? '.' : c.hk}</kbd><span class="done" hidden>✔</span><span class="prog"></span>`;
    const fire = () => { if (!btn.disabled) { SFX.click(); c.on(); panelDirty = true; } };
    btn.addEventListener('click', fire);
    btn.addEventListener('mouseenter', () => { const r = btn.getBoundingClientRect(); showTip(`<b>${esc(c.label)}</b>${esc(c.desc || '')}${costHtml(c.cost)}`, r.left + r.width / 2, r.top); });
    btn.addEventListener('mouseleave', hideTip);
    cmdEl.appendChild(btn);
    if (c.hk) hotkeys[c.hk.toLowerCase()] = fire;
    live.push(() => {
      btn.disabled = c.enabled ? !c.enabled() : false;
      btn.querySelector('.done').hidden = !(c.done && c.done());
      const p = c.progress && c.progress();
      btn.querySelector('.prog').style.width = p == null ? '0' : p * 100 + '%';
    });
  });
  infoEl.innerHTML = `<h2>${esc(spec.title)}</h2><div class="sub">${esc(spec.sub)}</div>${spec.html}`;
  if (spec.live) live.push(spec.live);
  PORTRAIT = spec.portrait;
  live.forEach(f => f());
}

/* ---------- portrait ---------- */
let PORTRAIT = null;
function drawPortrait(t) {
  const c = portraitEl, d = Math.min(2, devicePixelRatio || 1), s = Math.round(c.clientWidth * d) || 236;
  if (c.width !== s) { c.width = c.height = s; }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createRadialGradient(s / 2, s * .7, 4, s / 2, s / 2, s * .8);
  grd.addColorStop(0, '#7aa04a'); grd.addColorStop(1, '#1d2b12');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const p = PORTRAIT; if (!p) return;
  let bb, fn;
  if (p.kind === 'building') { bb = bboxOf(p.b); fn = () => drawBuilding(g, p.b, t); }
  else if (p.kind === 'unit') { const u = p.u, [ux, uy] = P(u.x + u.jx, u.y + u.jy), h = u.type === 'scout' ? 46 : 28; bb = { l: ux - 16, r: ux + 16, t: uy - h, b: uy + 6 }; fn = () => drawUnit(g, u, t, false); }
  else { const r = p.r, sp = spriteFor(r), [rx, ry] = P(r.x + .5, r.y + .5); bb = { l: rx - sp.ax, r: rx - sp.ax + sp.w, t: ry - sp.ay, b: ry - sp.ay + sp.h }; fn = () => drawResource(g, r); }
  const pad = s * .08, k = Math.min((s - pad * 2) / (bb.r - bb.l), (s - pad * 2) / (bb.b - bb.t));
  g.setTransform(k, 0, 0, k, s / 2 - (bb.l + bb.r) / 2 * k, s / 2 - (bb.t + bb.b) / 2 * k);
  fn();
}

/* ---------- modals ---------- */
const modal = $('#modal'), modalBody = $('#modal-body');
function openModal(html) {
  modalBody.innerHTML = html;
  modal.hidden = false;
  modal.querySelector('.parchment').scrollTop = 0;
  SFX.page();
  hideTip();
}
const closeModal = () => { modal.hidden = true; };
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  const n = e.target.closest('[data-post]'); if (n) openPost(POSTS.find(p => p.id === n.dataset.post));
  const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy); c.textContent = 'Copied!'; }
});
function openPost(p) {
  S.read.add(p.id);
  complete('scroll');
  const i = POSTS.indexOf(p), next = POSTS[(i + 1) % POSTS.length];
  openModal(`<div class="kicker">Scroll from the Library · ${esc(p.date)} · ${p.mins} min read</div><h1>${esc(p.title)}</h1>
    <div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    ${p.body.map(x => `<p>${esc(x)}</p>`).join('')}
    <div class="actions"><a class="btn" href="#/blog/${p.id}">Unroll the full scroll →</a><button class="btn ghost" data-post="${next.id}">Next: ${esc(next.title)}</button></div>`);
  panelDirty = true;
}
function openCatalogue() {
  openModal(`<div class="kicker">The Library</div><h1>Catalogue of scrolls</h1><ul class="list">${POSTS.map(p =>
    `<li><a href="#" data-post="${p.id}" onclick="return false">${esc(p.title)}</a> <small>· ${esc(p.date)}${S.read.has(p.id) ? ' · ✔ read' : ''}</small></li>`).join('')}</ul>`);
}
function openProject(p) {
  openModal(`<div class="kicker">Technology researched · ${esc(p.year)}</div><h1>${esc(p.name)}</h1>
    <div class="tags">${p.stack.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    ${p.body.map(x => `<p>${esc(x)}</p>`).join('')}
    <div class="actions"><a class="btn" href="#/projects/${p.id}">Read the full story →</a></div>`);
}
function openAbout() {
  complete('hall');
  openModal(`<div class="kicker">Biography of the founder</div><h1>${esc(SITE.name)}</h1>
    ${SITE.about.map(x => `<p>${esc(x)}</p>`).join('')}
    <dl>${SITE.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="actions"><a class="btn" href="#/about">The full biography →</a></div>`);
}
function openLetter() {
  openModal(`<div class="kicker">Messenger Tower</div><h1>Write a letter</h1>
    <p>Pigeons are slow, so email works best. I read everything, and I reply to most of it.</p>
    <p><b>${esc(SITE.email)}</b></p>
    <div class="actions"><a class="btn" href="mailto:${esc(SITE.email)}">Open my mail client</a><button class="btn ghost" data-copy="${esc(SITE.email)}">Copy address</button><a class="btn ghost" href="${esc(SITE.github)}" target="_blank" rel="noopener">GitHub</a></div>`);
}
function openHelp() {
  openModal(`<div class="kicker">The scribe's guide</div><h1>Controls</h1><dl>
    <dt>Left-click</dt><dd>Select a building, developer or resource</dd>
    <dt>Drag</dt><dd>Box-select developers (double-click selects all on screen)</dd>
    <dt>Right-click</dt><dd>Move, gather, return cargo, build</dd>
    <dt>Scroll / arrows</dt><dd>Pan the map (or drag with a finger)</dd>
    <dt>Ctrl+scroll / pinch</dt><dd>Zoom</dd>
    <dt>H · L · P · M</dt><dd>Town Hall · Library · Workshop · Messenger Tower</dd>
    <dt>Q W E R…</dt><dd>The commands in the bottom-left panel</dd>
    <dt>.</dt><dd>Next idle developer</dd>
    <dt>Space</dt><dd>Centre on the selection</dd>
    <dt>Enter</dt><dd>Chat (and perhaps cheat)</dd>
    <dt>O · V · Esc</dt><dd>Objectives · Classic view · Close / deselect</dd></dl>`);
}

/* ---------- objectives ---------- */
const objEl = $('#objectives');
function renderObjectives() {
  $('#obj-list').innerHTML = OBJECTIVES.map(o => `<li class="${S.done.has(o.id) ? 'done' : ''}">${esc(o.text)}</li>`).join('');
  $('#obj-count').textContent = `${S.done.size}/${OBJECTIVES.length}`;
}
function toggleObjectives(force) { objEl.hidden = typeof force === 'boolean' ? !force : !objEl.hidden; }
$('#obj-close').addEventListener('click', () => toggleObjectives(false));

/* ---------- classic view ---------- */
function openClassic() {
  $('#classic-body').innerHTML = `<div class="kicker">tthisk.com · classic view</div><h1>${esc(SITE.name)}</h1><p><i>${esc(SITE.role)}</i></p>
    ${SITE.about.map(x => `<p>${esc(x)}</p>`).join('')}
    <h2>Writing</h2>${POSTS.map(p => `<article><b><a href="#/blog/${p.id}">${esc(p.title)}</a></b> <small>· ${esc(p.date)} · ${p.mins} min</small><p>${esc(p.body[0])}</p></article>`).join('')}
    <h2>Projects</h2>${PROJECTS.map(p => `<article><b>${esc(p.name)}</b> <small>· ${esc(p.year)} · ${p.stack.map(esc).join(', ')}</small><p>${esc(p.body[0])}</p></article>`).join('')}
    <h2>Contact</h2><p><a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a> · <a href="${esc(SITE.github)}" target="_blank" rel="noopener">GitHub</a></p>
    <div class="actions"><button class="btn" data-close-classic>Back to the village</button></div>`;
  $('#classic').hidden = false;
  hideTip();
}
$('#classic').addEventListener('click', e => { if (e.target.id === 'classic' || e.target.closest('[data-close-classic]')) $('#classic').hidden = true; });

/* ---------- victory ---------- */
function showVictory() {
  S.won = true;
  $('#victory-stats').innerHTML = [
    ['Time played', fmtTime(S.time)], ['Resources gathered', S.gathered.toLocaleString()], ['Developers trained', S.trained],
    ['Scrolls read', `${S.read.size} / ${POSTS.length}`], ['Projects researched', `${S.researched.size} / ${PROJECTS.length}`],
    ['Objectives', `${S.done.size} / ${OBJECTIVES.length}`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#victory').hidden = false;
}
$('#b-continue').addEventListener('click', () => { $('#victory').hidden = true; });
$('#b-v-classic').addEventListener('click', () => { $('#victory').hidden = true; openClassic(); });

/* ---------- chat + cheats ---------- */
const chat = $('#chat'), chatInput = $('#chat-input');
function openChat() { chat.hidden = false; chatInput.value = ''; chatInput.focus(); }
chat.addEventListener('submit', e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  chat.hidden = true; chatInput.blur();
  if (text) runChat(text);
});
chatInput.addEventListener('keydown', e => { if (e.key === 'Escape') { chat.hidden = true; chatInput.blur(); } e.stopPropagation(); });
function cheat(msg) { log(`<span style="color:#d8c79a">Cheat:</span> ${msg}`, '#ffe08a'); SFX.trained(); }
function runChat(text) {
  const t = text.toLowerCase();
  log(`<span style="color:#7fb0ff">You:</span> ${esc(text)}`, '#f3e7c9');
  if (t === 'coffee break') { S.res.coffee += 1000; cheat('+1000 coffee. Everyone feels better.'); }
  else if (t === 'sudo make me a sandwich') { RES_TYPES.forEach(k => S.res[k] += 500); cheat('Okay. +500 of everything.'); }
  else if (t === 'hello world') { if (popUsed() >= POP_CAP) log('The village is full.'); else { const u = spawnVillagerFromHall(true); cheat(`${u.name} prints "hello world" and gets to work.`); } }
  else if (t === 'git push --force') { if (S.age >= 3) log('History has already been rewritten.'); else { S.ageResearch = null; cheat('History rewritten.'); finishAge(); } }
  else if (t === 'ship it') { if (S.age < 3) log('Not yet. The Wonder needs the Age of Clouds.'); else if (S.wonder.state === 'done') log('It has already shipped.'); else { S.wonder.state = 'building'; cheat('Straight to production.'); completeWonder(); } }
  else if (t === 'cat /etc/map' || t === 'ls -la') { explored.fill(1); minimapDirty = true; cheat('The whole realm is revealed.'); }
  else if (t === 'rm -rf /') { log('Permission denied. Nice try.', '#ff8a7a'); document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); SFX.error(); }
  else if (t === 'help' || t === 'cheats') { log('The scribes whisper: <i>coffee break</i>, <i>hello world</i>, <i>git push --force</i>, <i>ship it</i>…', '#d8c79a'); }
}
