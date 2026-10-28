// Loads story.js outside the browser and walks every reachable (node, state) pair.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = {};
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', 'story.js'), 'utf8');
  vm.runInContext(src + ';this.STORY=STORY;this.ENDINGS=ENDINGS;this.IDLE=IDLE;this.LINES=LINES;', ctx);
  return ctx;
}

// Every meta (across-runs) state the story text can branch on: first run, and 0..all endings found.
function metas(ENDINGS) {
  const ids = Object.keys(ENDINGS), total = ids.length, plain = ids.filter(e => e !== 'echo');
  const make = (runs, list) => ({ runs, total, found: list.length, endings: Object.fromEntries(list.map(e => [e, true])) });
  const out = [make(1, [])];
  for (let n = 0; n <= plain.length; n++) out.push(make(2, plain.slice(0, n)));
  for (let n = 1; n <= plain.length; n++) out.push(make(2, [...plain.slice(0, n), 'echo']));
  return out;
}

// visit(id, node, text, choices) for each distinct (node, run state). Choices are null on endings.
function walk(STORY, meta, visit) {
  const seen = new Set();
  const stack = [{ id: 'start', s: { defy: 0, loops: 0, flags: {} } }];
  while (stack.length) {
    const { id, s } = stack.pop();
    const node = STORY[id];
    if (!node) throw new Error(`missing node "${id}"`);
    const key = id + JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    const v = x => (typeof x === 'function' ? x(s, meta) : x);
    const choices = node.ending ? null : v(node.choices);
    visit(id, node, v(node.text), choices);
    for (const c of choices || []) {
      const ns = JSON.parse(JSON.stringify(s));
      if (c.effect) c.effect(ns);
      if (c.set) Object.assign(ns.flags, c.set);
      if (c.defy) ns.defy++;
      stack.push({ id: typeof c.next === 'function' ? c.next(ns, meta) : c.next, s: ns });
    }
  }
}

module.exports = { load, metas, walk };
