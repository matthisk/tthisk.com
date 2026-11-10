'use strict';
/* ==========================================================================
   Content + game constants. Everything a visitor can read lives in here,
   so swapping placeholder copy for real copy only touches this file.
   ========================================================================== */

const SITE = {
  name: 'Matthis',
  role: 'Software Engineer',
  github: 'https://github.com/matthisk',
  email: 'webmaster@tthisk.com', // placeholder
  about: [
    "I'm Matthis, a software engineer who likes small, sharp tools, fast feedback loops and code that is still pleasant to read a year after it was written.",
    "By day I build products. By night I build tools nobody asked for, and then write about why. This village is the result of too much coffee and a soft spot for the strategy games of my childhood.",
  ],
  facts: [
    ['Class', 'Software Engineer'],
    ['Favourite resource', 'Coffee'],
    ['Special ability', 'Turns coffee into code'],
    ['Languages', 'Rust, TypeScript, Go'],
    ['Weakness', 'Side projects at 80%'],
  ],
};

const POSTS = [
  { id: 'lisp', title: 'Writing a tiny Lisp in a weekend', date: '28 Oct 2026', mins: 9, tags: ['rust', 'compilers'],
    body: ['A reader, an evaluator and a REPL in about four hundred lines of Rust. Building one is the fastest way I know to really understand closures, environments and why every language eventually grows a macro system.',
           'This post walks through the whole thing, from tokenising parentheses to tail calls, and ends with the three bugs that cost me most of Sunday.'] },
  { id: 'boring', title: 'In defence of boring technology', date: '14 Sep 2026', mins: 6, tags: ['opinion', 'architecture'],
    body: ['Postgres, cron and a single well-understood server will take you much further than you think. Novelty has a cost, and you pay it at three in the morning.',
           'A short argument for spending your innovation tokens where your users can feel them.'] },
  { id: 'crdt', title: 'CRDTs explained without the math', date: '2 Aug 2026', mins: 14, tags: ['distributed systems'],
    body: ['How do collaborative editors let everyone type at once without a central referee? With data structures that are designed to agree, eventually, no matter what order the messages arrive in.',
           'We build intuition with sticky notes instead of lattices, then look at what real systems do differently.'] },
  { id: 'dotfiles', title: 'My dotfiles, ten years later', date: '19 Jun 2026', mins: 5, tags: ['tooling'],
    body: ['A decade of shell aliases, editor configs and the occasional regret, all version-controlled.',
           'What survived, what I deleted, and the one alias I type two hundred times a day.'] },
];

const PROJECTS = [
  { id: 'kvlite', name: 'kvlite', year: '2025', stack: ['Rust', 'LSM tree', 'WAL'],
    body: ['An embeddable key-value store built on a log-structured merge tree, with a write-ahead log, bloom filters and background compaction.',
           'Built to understand how storage engines really work. It is small enough to read in an afternoon.'] },
  { id: 'termplot', name: 'termplot', year: '2024', stack: ['Go', 'Unicode', 'CLI'],
    body: ['Charts in your terminal, drawn with Braille characters for eight times the resolution of plain text. Pipe numbers in, get a plot out.'] },
  { id: 'site', name: 'tthisk.com', year: '2026', stack: ['HTML', 'Canvas', 'Web Audio'],
    body: ['This website. No framework, no build step, and a playable village on the home page because why not.'] },
  { id: 'dotfiles', name: 'dotfiles', year: '2016 – now', stack: ['Shell', 'Lua', 'Nix'],
    body: ['Ten years of carefully curated configuration. Reproducible on a new machine in one command, most of the time.'] },
];

/* ---------- game constants ---------- */
const TW = 64, TH = 32, N = 48, HALFW = TW / 2, HALFH = TH / 2;
const POP_CAP = 15;
const CARRY = 10;
const RES_TYPES = ['coffee', 'code', 'ideas', 'commits'];
const RES_INFO = {
  coffee:  { name: 'Coffee',  color: '#e09a55', icon: 'ic-coffee',  desc: 'Fuels developers. Picked from coffee bushes. Needed to train new developers.' },
  code:    { name: 'Code',    color: '#9ad873', icon: 'ic-code',    desc: 'Lines of code, chopped from code trees.' },
  ideas:   { name: 'Ideas',   color: '#f2c94c', icon: 'ic-ideas',   desc: 'Rare and shiny. Mined slowly from idea veins.' },
  commits: { name: 'Commits', color: '#92c3d6', icon: 'ic-commits', desc: 'Small, atomic and solid. Quarried from commit stone.' },
};
const NODE = {
  tree:  { res: 'code',    name: 'Code Tree',     amount: 80,  interval: .22, desc: 'Grows lines of code. Chop it for Code.' },
  bush:  { res: 'coffee',  name: 'Coffee Bush',   amount: 140, interval: .2,  desc: 'Heavy with ripe coffee cherries.' },
  ideas: { res: 'ideas',   name: 'Idea Vein',     amount: 500, interval: .27, desc: 'Glittering ideas. Slow to mine, worth it.' },
  stone: { res: 'commits', name: 'Commit Quarry', amount: 500, interval: .28, desc: 'Solid stone, perfect for atomic commits.' },
};
const AGES = [
  { name: 'Age of Scripts',   roman: 'I',   desc: 'Shell one-liners and duct tape.' },
  { name: 'Age of Compilers', roman: 'II',  desc: 'Types arrive. Builds get slower. Bugs get rarer.' },
  { name: 'Age of Networks',  roman: 'III', desc: 'Everything talks to everything else.' },
  { name: 'Age of Clouds',    roman: 'IV',  desc: "Someone else's computer, at enormous scale." },
];
const AGE_COST = [null, { coffee: 200, code: 150 }, { coffee: 350, code: 300, ideas: 150 }, { coffee: 600, code: 500, ideas: 300, commits: 200 }];
const AGE_TIME = [0, 5, 7, 9];
const TRAIN_COST = { coffee: 50 };
const TRAIN_TIME = 3.5;
const WONDER_COST = { code: 400, ideas: 250, commits: 250 };
const WONDER_TIME = 60; // seconds for a single builder

const NAMES = ['Ada', 'Grace', 'Linus', 'Ken', 'Barbara', 'Dennis', 'Margaret', 'Edsger', 'Alan', 'Radia', 'Guido',
  'Frances', 'Donald', 'Hedy', 'Bjarne', 'Anders', 'Brian', 'Lynn', 'Rob', 'Joan', 'Katherine', 'John'];

const TIPS = [
  'Tip: developers work faster in every new age.',
  'Tip: right-click a resource to send your selected developers to gather it.',
  'Tip: the minimap is clickable. So is everything else.',
  'Tip: idle developers are sad developers. Press . to find one.',
  'Tip: press Enter to speak. Some words have power.',
];

const OBJECTIVES = [
  { id: 'hall',    text: 'Visit the Town Hall to meet the founder' },
  { id: 'scroll',  text: 'Read a scroll in the Library' },
  { id: 'project', text: 'Research a project in the Workshop' },
  { id: 'message', text: 'Send word from the Messenger Tower' },
  { id: 'train',   text: 'Train a new developer' },
  { id: 'age',     text: 'Advance to the Age of Clouds' },
  { id: 'wonder',  text: 'Build the Wonder' },
];

/* ---------- mutable game state ---------- */
const S = {
  res: { coffee: 250, code: 200, ideas: 80, commits: 60 },
  gathered: 0, trained: 0, age: 0, ageResearch: null, researching: null,
  time: 0, started: false, won: false, sel: null, hover: null,
  read: new Set(), researched: new Set(), done: new Set(),
  wonder: { state: 'plot', progress: 0 },
  shake: 0,
};

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function canAfford(cost) { return !cost || Object.entries(cost).every(([k, v]) => S.res[k] >= v); }
function pay(cost) { if (cost) for (const [k, v] of Object.entries(cost)) S.res[k] -= v; }
