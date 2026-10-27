'use strict';
/* Echo Path — engine: audio beds, speech queue, input, story runner. Content lives in story.js. */

const $ = id => document.getElementById(id);
const SAVE_KEY = 'echopath.v1';
const IDLE_MS = 30000;
const LONG_PRESS_MS = 650;

/* ---------------- Persistence ---------------- */
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: play without saving */ }
}
const loaded = loadSave();
const save = {
  endings: loaded.endings || {},
  runs: loaded.runs || 0,
  run: loaded.run || null,
  settings: Object.assign({ rate: 1, captions: true, voice: '', ambience: 1 }, loaded.settings),
};

/* ---------------- Sound: procedural ambient beds + cues ---------------- */
const Sound = {
  ctx: null, out: null, bed: null, bedName: null, noiseBuf: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = save.settings.ambience;
    this.out.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 4;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
  volume(v) { if (this.out) this.out.gain.value = v; },

  osc(bed, type, freq, gain, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    o.connect(g); g.connect(dest); o.start();
    bed.srcs.push(o);
    return { o, g };
  },
  noise(bed, type, freq, q, gain, dest) {
    const n = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    n.buffer = this.noiseBuf; n.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    n.connect(f); f.connect(g); g.connect(dest); n.start(0, Math.random() * 3);
    bed.srcs.push(n);
    return { f, g };
  },
  lfo(bed, rate, depth, param) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(param); o.start();
    bed.srcs.push(o);
  },
  panner(bed, dest, rate) {
    if (!this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner();
    p.connect(dest);
    if (rate) this.lfo(bed, rate, 0.8, p.pan);
    return p;
  },

  // Crossfade to a named ambient bed (see BEDS).
  scene(name, fade = 1.2) {
    if (!this.ctx || name === this.bedName) return;
    const t = this.ctx.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.gain.gain.setTargetAtTime(0, t, fade * 0.7);
      setTimeout(() => { old.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); old.gain.disconnect(); }, fade * 5000);
    }
    const bed = { gain: this.ctx.createGain(), srcs: [] };
    bed.gain.gain.value = 0;
    bed.gain.connect(this.out);
    (BEDS[name] || BEDS.silence)(bed, bed.gain);
    bed.gain.gain.setTargetAtTime(1, t, fade);
    this.bed = bed; this.bedName = name;
  },

  // Short tone marking a choice side: left = G4, right = B4.
  cue(side) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, b = { srcs: [] };
    const dest = this.panner(b, this.ctx.destination);
    if (dest.pan) dest.pan.value = side * 0.9;
    const { o, g } = this.osc(b, 'sine', side < 0 ? 392 : 494, 0.0001, dest);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.stop(t + 0.55);
  },

  // Filtered noise sweep panned toward the chosen side.
  whoosh(side) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, b = { srcs: [] };
    const dest = this.panner(b, this.ctx.destination);
    if (dest.pan) dest.pan.value = side * 0.7;
    const { f, g } = this.noise(b, 'bandpass', 300, 1.5, 0.0001, dest);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    b.srcs[0].stop(t + 0.85);
  },

  // Slow chord swell for endings.
  chord() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, b = { srcs: [] };
    [110, 164.8, 277.2].forEach(freq => {
      const { o, g } = this.osc(b, 'sine', freq, 0.0001, this.ctx.destination);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
      o.stop(t + 7.2);
    });
  },
};

// Ambient bed recipes: (bed, destination). Gains tuned so beds sit well under the voice.
const BEDS = {
  room(b, d) {
    Sound.noise(b, 'lowpass', 220, 0.7, 0.6, d);
    Sound.osc(b, 'sine', 60, 0.008, d);
  },
  corridor(b, d) {
    Sound.osc(b, 'sine', 55, 0.03, d);
    Sound.osc(b, 'sine', 55.7, 0.03, d);
    const n = Sound.noise(b, 'bandpass', 420, 1.2, 0.15, d);
    Sound.lfo(b, 0.05, 180, n.f.frequency);
  },
  water(b, d) {
    Sound.noise(b, 'lowpass', 700, 0.5, 0.35, d);
    const n = Sound.noise(b, 'bandpass', 2400, 0.9, 0.06, d);
    Sound.lfo(b, 0.3, 0.03, n.g.gain);
    Sound.lfo(b, 0.13, 600, n.f.frequency);
  },
  wind(b, d) {
    const n = Sound.noise(b, 'bandpass', 500, 0.9, 0.4, d);
    Sound.lfo(b, 0.07, 320, n.f.frequency);
    Sound.lfo(b, 0.11, 0.2, n.g.gain);
  },
  tower(b, d) {
    const n = Sound.noise(b, 'bandpass', 450, 0.9, 0.18, d);
    Sound.lfo(b, 0.07, 250, n.f.frequency);
    Sound.osc(b, 'sine', 82.4, 0.012, d);
    Sound.osc(b, 'sine', 123.5, 0.008, d);
    Sound.osc(b, 'sine', 220, 0.006, Sound.panner(b, d, 0.1)); // the turning lamp
  },
  void(b, d) {
    const a = Sound.osc(b, 'sine', 41.2, 0.035, d);
    Sound.lfo(b, 0.04, 0.015, a.g.gain);
    Sound.osc(b, 'sine', 82.4, 0.006, d);
    Sound.osc(b, 'triangle', 659.3, 0.0025, Sound.panner(b, d, 0.07));
  },
  silence() {},
};

/* ---------------- Speech: sentence queue with cues and pauses ---------------- */
// Chrome cuts utterances after ~15s, and Android's speechSynthesis.pause() cancels,
// so text is spoken one sentence at a time and pause/resume replays the current part.
function sentences(text) {
  const out = [];
  (text.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || []).forEach(s => {
    s = s.trim();
    while (s.length > 200) {
      let cut = s.lastIndexOf(', ', 200);
      if (cut < 60) cut = s.lastIndexOf(' ', 200);
      out.push(s.slice(0, cut + 1));
      s = s.slice(cut + 1).trim();
    }
    if (s) out.push(s);
  });
  return out;
}

const PREFERRED_VOICES = [/Daniel/i, /Google UK English Male/i, /Ryan.*Natural/i, /Thomas/i, /Arthur/i, /Oliver/i, /en[-_]GB/i, /en[-_](AU|IE)/i, /en[-_]US/i, /^en/i];

const Speech = {
  ok: 'speechSynthesis' in window,
  voice: null, parts: [], i: 0, token: 0, done: null, paused: false, timer: null, utter: null,

  voices() {
    return this.ok ? speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)) : [];
  },
  pickVoice() {
    const vs = this.voices();
    this.voice = vs.find(v => v.voiceURI === save.settings.voice)
      || PREFERRED_VOICES.map(re => vs.find(v => re.test(v.name + ' ' + v.lang))).find(Boolean)
      || null;
    UI.voiceList(vs, this.voice);
  },

  // parts: strings (spoken), numbers (ms pause), functions (run instantly, e.g. a cue).
  play(parts, done) {
    this.cancel();
    this.parts = parts; this.i = 0; this.done = done || null; this.paused = false;
    this.step();
  },
  cancel() {
    this.token++;
    clearTimeout(this.timer);
    if (this.ok) speechSynthesis.cancel();
    this.parts = []; this.done = null; this.paused = false;
    UI.talking(false);
  },
  pause() {
    if (this.paused || !this.parts.length) return;
    this.paused = true; this.token++;
    clearTimeout(this.timer);
    if (this.ok) speechSynthesis.cancel();
    UI.talking(false);
  },
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.step();
  },
  step() {
    const tok = ++this.token;
    const next = () => { if (tok !== this.token) return; this.i++; this.step(); };
    if (this.i >= this.parts.length) {
      const d = this.done;
      this.parts = []; this.done = null;
      UI.talking(false);
      if (d) d();
      return;
    }
    const p = this.parts[this.i];
    if (typeof p === 'function') { p(); next(); return; }
    if (typeof p === 'number') { this.timer = setTimeout(next, p); return; }
    this.say(p, next);
  },
  say(text, next) {
    const rate = save.settings.rate;
    UI.talking(true);
    if (!this.ok) { this.timer = setTimeout(next, 600 + text.length * 65 / rate); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; } else u.lang = 'en-GB';
    u.rate = rate;
    let fired = false;
    const fin = () => { if (fired) return; fired = true; clearTimeout(this.timer); next(); };
    u.onend = fin; u.onerror = fin;
    this.utter = u; // keep a reference: some browsers drop onend for collected utterances
    speechSynthesis.speak(u);
    // Watchdog for engines that never fire onend (or have no voices at all).
    this.timer = setTimeout(fin, 4000 + text.length * 110 / rate);
  },
};

/* ---------------- Game: walks the story graph ---------------- */
const Game = {
  s: null, id: null, node: null, text: '', options: null, choices: null,
  idleCount: 0, idleTimer: null, ended: false, endedAt: 0, paused: false,

  meta() {
    return { runs: save.runs, endings: save.endings, found: Object.keys(save.endings).length, total: Object.keys(ENDINGS).length };
  },
  val(x) { return typeof x === 'function' ? x(this.s, this.meta()) : x; },

  newRun() {
    save.runs++;
    this.s = { defy: 0, loops: 0, flags: {} };
    this.go('start');
  },
  continueRun() {
    this.s = save.run.s;
    this.go(save.run.node);
  },

  go(id) {
    if (!STORY[id]) { console.error('Echo Path: missing node', id); id = 'start'; }
    const node = STORY[id];
    this.id = id; this.node = node; this.ended = false; this.idleCount = 0;
    this.closeChoices();
    this.text = this.val(node.text);
    this.options = node.ending ? null : this.val(node.choices);
    save.run = node.ending ? null : { node: id, s: this.s };
    writeSave();
    Sound.scene(node.scene || 'void', node.silent ? 6 : 1.2);
    UI.passage(this.text, this.options);
    this.narrate();
  },

  narrate() {
    const parts = sentences(this.text);
    if (this.node.ending) parts.push(1200, () => this.finish());
    else parts.push(700, () => this.openChoices(), ...this.announce(), () => this.armIdle());
    Speech.play(parts);
  },
  announce() {
    const [a, b] = this.options;
    return [() => Sound.cue(-1), 250, a.label + '.', 'or', () => Sound.cue(1), 250, b.label + '.'];
  },

  openChoices() { this.choices = this.options; UI.choices(true); },
  closeChoices() { this.choices = null; clearTimeout(this.idleTimer); UI.choices(false); },

  armIdle() {
    clearTimeout(this.idleTimer);
    if (this.choices && !this.paused) this.idleTimer = setTimeout(() => this.onIdle(), IDLE_MS);
  },
  onIdle() {
    if (!this.choices || this.paused) return;
    const n = this.idleCount++;
    if (n >= IDLE.length) { this.go('asleep'); return; }
    Speech.play([IDLE[n], 500, ...this.announce(), () => this.armIdle()]);
  },

  tap(side) {
    if (this.ended) {
      if (Date.now() - this.endedAt > 1500) { Speech.cancel(); Awake.request(); this.newRun(); }
      return;
    }
    if (this.choices) { this.choose(side); return; }
    if (this.paused) { this.setPaused(false); return; }
    UI.hint('wait for the tones, then choose');
  },

  choose(i) {
    const c = this.choices[i];
    if (this.paused) this.setPaused(false);
    this.closeChoices();
    Speech.cancel();
    Sound.whoosh(i ? 1 : -1);
    UI.flash(i);
    if (c.effect) c.effect(this.s);
    if (c.set) Object.assign(this.s.flags, c.set);
    if (c.defy) this.s.defy++;
    const next = this.val(c.next);
    setTimeout(() => this.go(next), 700);
  },

  repeat() {
    if (this.ended || !this.node) return;
    if (this.paused) this.setPaused(false);
    this.closeChoices();
    this.narrate();
  },

  setPaused(p) {
    if (p === this.paused || !this.node) return;
    this.paused = p;
    if (p) {
      Speech.pause();
      clearTimeout(this.idleTimer);
      Sound.suspend();
      Media.pause();
    } else {
      Sound.resume();
      Media.play();
      if (Speech.paused) Speech.resume(); else this.armIdle();
    }
    UI.paused(p);
  },

  finish() {
    const id = this.node.ending, first = !save.endings[id];
    save.endings[id] = true;
    writeSave();
    const m = this.meta();
    this.ended = true; this.endedAt = Date.now();
    UI.ending(ENDINGS[id], m);
    if (this.node.silent) { Awake.release(); return; } // the player fell asleep: let the phone sleep too
    Sound.chord();
    Speech.play([
      1500,
      `Ending: ${ENDINGS[id]}.`,
      first ? `That's ${m.found} of ${m.total}.` : "You've found this one before.",
      1500,
      'Tap either side to begin again.',
    ]);
  },
};

/* ---------------- Media Session: headphone / lock-screen remote ----------------
   Browsers only route remote buttons to a page that is playing real media, so a
   near-silent looping <audio> runs underneath. iOS skip-track support varies. */
function silentWavUrl(seconds) {
  const rate = 8000, n = rate * seconds, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, (i & 1) ? 1 : -1, true); // inaudible dither, not digital zero
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const Media = {
  el: null,
  start() {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS 17+: ignore the silent switch
    this.el = new Audio(silentWavUrl(10));
    this.el.loop = true;
    this.play();
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Echo Path', artist: 'a voice in the dark', album: 'Echo Path' });
    const handlers = {
      previoustrack: () => Game.tap(0),
      seekbackward: () => Game.tap(0),
      nexttrack: () => Game.tap(1),
      seekforward: () => Game.tap(1),
      play: () => Game.setPaused(false),
      pause: () => Game.setPaused(true),
      stop: () => Game.setPaused(true),
    };
    for (const [action, fn] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) { /* unsupported action on this browser */ }
    }
  },
  play() {
    if (!this.el) return;
    this.el.play().catch(() => {});
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  },
  pause() {
    if (!this.el) return;
    this.el.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  },
};

/* ---------------- Wake lock: keep narration alive with the screen on ---------------- */
const Awake = {
  lock: null, want: false,
  async request() {
    this.want = true;
    try { if ('wakeLock' in navigator) this.lock = await navigator.wakeLock.request('screen'); } catch (e) {}
  },
  release() {
    this.want = false;
    if (this.lock) this.lock.release().catch(() => {});
    this.lock = null;
  },
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Awake.want) Awake.request();
});

/* ---------------- UI ---------------- */
const UI = {
  passage(text, options) {
    $('caption').textContent = text;
    $('endPanel').hidden = true;
    if (options) {
      $('labelA').textContent = options[0].label;
      $('labelB').textContent = options[1].label;
    }
    this.hint('listening…');
  },
  choices(open) {
    document.body.classList.toggle('choosing', open);
    if (open) this.hint('tap left or right · hold to hear again');
  },
  talking(on) {
    $('orb').classList.toggle('talking', on);
    $('liveDot').classList.toggle('live', on);
    if (!Game.paused) $('statusText').textContent = on ? 'narrating' : 'listening';
  },
  paused(p) {
    document.body.classList.toggle('paused', p);
    $('statusText').textContent = p ? 'paused' : 'listening';
    $('pauseBtn').textContent = p ? '▶' : '❚❚';
    $('pauseBtn').setAttribute('aria-label', p ? 'Resume' : 'Pause');
  },
  hint(t) { $('hint').textContent = t; },
  flash(side) {
    const z = $(side ? 'zoneB' : 'zoneA');
    z.classList.remove('flash'); void z.offsetWidth; z.classList.add('flash');
  },
  ending(title, m) {
    $('endTitle').textContent = title;
    $('endCount').textContent = `${m.found} of ${m.total} endings found`;
    $('endPanel').hidden = false;
    this.hint('tap either side to begin again');
    this.counts();
  },
  counts() {
    const m = Game.meta();
    $('foundCount').textContent = `${m.found} / ${m.total}`;
    $('titleCount').textContent = m.found ? `${m.found} of ${m.total} endings found` : '';
  },
  captions(on) { document.body.classList.toggle('nocaptions', !on); },
  voiceList(vs, current) {
    const sel = $('voiceSel');
    sel.innerHTML = '';
    if (!vs.length) { sel.add(new Option('System default', '')); return; }
    vs.forEach(v => sel.add(new Option(`${v.name} (${v.lang})`, v.voiceURI, false, v === current)));
  },
};

/* ---------------- Input ---------------- */
// Whole screen is the controller: left half = choice A, right half = choice B, hold = repeat.
let press = null;
$('stage').addEventListener('pointerdown', e => {
  if (e.target.closest('.ui')) return;
  Sound.resume();
  const p = { x: e.clientX, long: false };
  p.timer = setTimeout(() => { p.long = true; UI.hint('again, from the top'); Game.repeat(); }, LONG_PRESS_MS);
  press = p;
});
window.addEventListener('pointerup', () => {
  if (!press) return;
  const p = press; press = null;
  clearTimeout(p.timer);
  if (!p.long) Game.tap(p.x < window.innerWidth / 2 ? 0 : 1);
});
window.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  if (!Game.node || e.target.closest('.sheet')) return;
  if (e.key === 'ArrowLeft') Game.tap(0);
  else if (e.key === 'ArrowRight') Game.tap(1);
  else if (e.key === ' ') { e.preventDefault(); Game.setPaused(!Game.paused); }
  else if (e.key === 'r' || e.key === 'R') Game.repeat();
});

$('pauseBtn').addEventListener('click', () => Game.setPaused(!Game.paused));
$('dimBtn').addEventListener('click', () => document.body.classList.toggle('dim'));
$('menuBtn').addEventListener('click', () => { $('settings').hidden = false; });
$('closeSettings').addEventListener('click', () => { $('settings').hidden = true; });

/* ---------------- Settings ---------------- */
function bindSettings() {
  const st = save.settings;
  $('rateSel').value = String(st.rate);
  $('ambRange').value = String(st.ambience);
  $('capChk').checked = st.captions;
  UI.captions(st.captions);

  $('rateSel').addEventListener('change', e => { st.rate = Number(e.target.value); writeSave(); });
  $('ambRange').addEventListener('input', e => { st.ambience = Number(e.target.value); Sound.volume(st.ambience); writeSave(); });
  $('capChk').addEventListener('change', e => { st.captions = e.target.checked; UI.captions(st.captions); writeSave(); });
  $('voiceSel').addEventListener('change', e => { st.voice = e.target.value; writeSave(); Speech.pickVoice(); });
  $('restartBtn').addEventListener('click', () => {
    $('settings').hidden = true;
    if (Game.paused) Game.setPaused(false);
    Speech.cancel();
    Game.newRun();
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Forget all endings and progress?')) return;
    save.endings = {}; save.runs = 0; save.run = null;
    writeSave();
    UI.counts();
  });
}

/* ---------------- Boot ---------------- */
function begin(resume) {
  Sound.init();
  Sound.resume();
  Media.start();
  Awake.request();
  $('veil').classList.add('gone');
  // First utterance must start inside this tap for iOS to allow speech at all.
  if (resume) Game.continueRun(); else Game.newRun();
}

$('beginBtn').addEventListener('click', () => begin(false));
$('continueBtn').addEventListener('click', () => begin(true));
$('continueBtn').hidden = !(save.run && STORY[save.run.node]);

bindSettings();
UI.counts();
if (Speech.ok) {
  Speech.pickVoice();
  speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', () => Speech.pickVoice())
    : (speechSynthesis.onvoiceschanged = () => Speech.pickVoice());
} else {
  UI.voiceList([], null);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
