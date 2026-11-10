'use strict';
/* ==========================================================================
   Synthesised sound. No audio files: every effect and the music is built
   from oscillators so the whole thing stays tiny and original.
   ========================================================================== */

const AUDIO = { ctx: null, master: null, music: null, sfx: true, musicOn: false, next: 0, step: 0, mel: 4, lastChop: 0 };

function initAudio() {
  if (AUDIO.ctx) { AUDIO.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  AUDIO.ctx = ctx;
  AUDIO.master = ctx.createGain(); AUDIO.master.gain.value = .55; AUDIO.master.connect(ctx.destination);
  AUDIO.music = ctx.createGain(); AUDIO.music.gain.value = .0; AUDIO.music.connect(AUDIO.master);
}

function toneAt(t, f, dur, { type = 'triangle', vol = .12, attack = .005, slide = 0, dest = null, lp = 0 } = {}) {
  const ctx = AUDIO.ctx; if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g).connect(dest || AUDIO.master);
  o.start(t); o.stop(t + dur + .05);
}
function tone(f, dur, opts = {}) {
  if (!AUDIO.ctx || !AUDIO.sfx) return;
  toneAt(AUDIO.ctx.currentTime + (opts.when || 0), f, dur, opts);
}
function noise(dur, vol, freq, when = 0) {
  if (!AUDIO.ctx || !AUDIO.sfx) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime + when;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(bp).connect(g).connect(AUDIO.master);
  src.start(t);
}

const SFX = {
  select()   { tone(660, .07, { vol: .07 }); tone(990, .09, { when: .05, vol: .06 }); },
  building() { tone(392, .12, { type: 'square', vol: .035, lp: 1800 }); tone(587, .18, { when: .07, type: 'square', vol: .035, lp: 1800 }); },
  ack()      { tone(523, .06, { type: 'square', vol: .03, lp: 2200 }); tone(784, .08, { when: .05, type: 'square', vol: .03, lp: 2200 }); },
  error()    { tone(150, .2, { type: 'sawtooth', vol: .05, lp: 900 }); },
  click()    { tone(1200, .03, { vol: .04 }); },
  drop()     { tone(880, .05, { vol: .035 }); tone(1320, .06, { when: .03, vol: .025 }); },
  chop()     { const n = performance.now(); if (n - AUDIO.lastChop < 380) return; AUDIO.lastChop = n; noise(.05, .14, 1500); },
  mine()     { const n = performance.now(); if (n - AUDIO.lastChop < 420) return; AUDIO.lastChop = n; tone(1900 + Math.random() * 300, .05, { type: 'square', vol: .012 }); },
  pick()     { const n = performance.now(); if (n - AUDIO.lastChop < 500) return; AUDIO.lastChop = n; noise(.04, .06, 3500); },
  trained()  { [523, 659, 784].forEach((f, i) => tone(f, .16, { when: i * .08, vol: .07 })); },
  discover() { [784, 988, 1175].forEach((f, i) => tone(f, .25, { when: i * .1, vol: .05 })); },
  page()     { noise(.25, .08, 4200); },
  pigeon()   { for (let i = 0; i < 6; i++) noise(.04, .08, 2600, i * .07); },
  ageUp() {
    const seq = [392, 523.25, 659.25, 783.99];
    seq.forEach((f, i) => tone(f, .22, { when: i * .14, type: 'sawtooth', vol: .05, lp: 2400 }));
    [523.25, 659.25, 783.99, 1046.5].forEach(f => tone(f, 1.4, { when: .6, type: 'sawtooth', vol: .035, lp: 2000, attack: .04 }));
  },
  victory() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => tone(f, .3, { when: i * .16, type: 'square', vol: .04, lp: 2600 }));
    [261.6, 523.25, 659.25, 783.99].forEach(f => tone(f, 2.2, { when: 1.2, type: 'sawtooth', vol: .03, lp: 1800, attack: .05 }));
  },
};

/* ---------- generative music: a lute-ish loop in D dorian ---------- */
const SCALE = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
const CHORDS = [{ root: 73.42, tones: [0, 2, 4, 7, 9, 11] }, { root: 65.41, tones: [6, 1, 3, 8, 10, 13] },
                { root: 98.0, tones: [3, 5, 0, 10, 12, 7] }, { root: 73.42, tones: [0, 4, 2, 7, 11, 9] }];
function setMusic(on) {
  AUDIO.musicOn = on;
  if (!AUDIO.ctx) return;
  AUDIO.music.gain.setTargetAtTime(on ? 1 : 0, AUDIO.ctx.currentTime, .4);
  if (on) AUDIO.next = AUDIO.ctx.currentTime + .1;
}
function musicTick() {
  const ctx = AUDIO.ctx;
  if (!ctx || !AUDIO.musicOn) return;
  const step = .25;
  while (AUDIO.next < ctx.currentTime + .4) {
    const t = AUDIO.next, s = AUDIO.step, beat = s % 16, chord = CHORDS[Math.floor(s / 16) % 4];
    if (beat === 0 || beat === 8) toneAt(t, chord.root * (beat === 8 ? 1.5 : 1), step * 7, { type: 'triangle', vol: .07, dest: AUDIO.music, attack: .02 });
    const play = beat % 4 === 0 || Math.random() < .55;
    if (play) {
      if (beat % 4 === 0) AUDIO.mel = chord.tones[Math.floor(Math.random() * 3)] + (Math.random() < .5 ? 0 : 0);
      else AUDIO.mel = clamp(AUDIO.mel + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)], 0, SCALE.length - 1);
      const f = SCALE[AUDIO.mel] * 2;
      toneAt(t, f, .55, { type: 'triangle', vol: .045, dest: AUDIO.music });
      toneAt(t, f * 2.005, .3, { type: 'sine', vol: .012, dest: AUDIO.music });
    }
    AUDIO.next += step;
    AUDIO.step++;
  }
}
