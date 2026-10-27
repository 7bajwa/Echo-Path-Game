// Story graph self-check: every target exists, every ending is reachable, choices are pairs.
// Walks the graph with real state (choice effects applied) across several meta states.
// Usage: node tools/check-story.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'story.js'), 'utf8') + ';this.STORY=STORY;this.ENDINGS=ENDINGS;this.IDLE=IDLE;', ctx);
const { STORY, ENDINGS } = ctx;

const reached = new Set(['asleep']); // reached by idling, not by a choice
const endingsHit = new Set(['asleep']);
const total = Object.keys(ENDINGS).length;

function walk(meta) {
  const seen = new Set();
  const stack = [{ id: 'start', s: { defy: 0, loops: 0, flags: {} } }];
  while (stack.length) {
    const { id, s } = stack.pop();
    const node = STORY[id];
    assert(node, `missing node "${id}"`);
    const key = id + JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    reached.add(id);
    const v = x => (typeof x === 'function' ? x(s, meta) : x);
    const text = v(node.text);
    assert(typeof text === 'string' && text.length > 20, `bad text in "${id}"`);
    if (node.ending) {
      assert(ENDINGS[node.ending], `unknown ending "${node.ending}" in "${id}"`);
      endingsHit.add(node.ending);
      continue;
    }
    const choices = v(node.choices);
    assert(Array.isArray(choices) && choices.length === 2, `"${id}" needs exactly 2 choices`);
    for (const c of choices) {
      assert(c.label, `unlabelled choice in "${id}"`);
      const ns = JSON.parse(JSON.stringify(s));
      if (c.effect) c.effect(ns);
      if (c.set) Object.assign(ns.flags, c.set);
      if (c.defy) ns.defy++;
      stack.push({ id: typeof c.next === 'function' ? c.next(ns, meta) : c.next, s: ns });
    }
  }
}

const metas = [
  { runs: 1, found: 0, total, endings: {} },
  { runs: 3, found: 2, total, endings: { river: true, fall: true } },
  { runs: 6, found: 4, total, endings: { river: true, fall: true, awake: true, quiet: true } },
];
metas.forEach(walk);

const unreached = Object.keys(STORY).filter(id => !reached.has(id));
const missingEndings = Object.keys(ENDINGS).filter(e => !endingsHit.has(e));
assert.deepStrictEqual(unreached, [], `unreachable nodes: ${unreached}`);
assert.deepStrictEqual(missingEndings, [], `unreachable endings: ${missingEndings}`);
console.log(`ok: ${Object.keys(STORY).length} nodes, ${total} endings, all reachable`);
