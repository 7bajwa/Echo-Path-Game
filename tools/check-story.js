// Story graph self-check: every target exists, every node and ending is reachable, choices are pairs.
// Usage: node tools/check-story.js
const assert = require('assert');
const { load, metas, walk } = require('./walk');

const { STORY, ENDINGS } = load();
const reached = new Set(['asleep']); // reached by idling, not by a choice
const endingsHit = new Set(['asleep']);

for (const meta of metas(ENDINGS)) {
  walk(STORY, meta, (id, node, text, choices) => {
    reached.add(id);
    assert(typeof text === 'string' && text.length > 20, `bad text in "${id}"`);
    if (node.ending) {
      assert(ENDINGS[node.ending], `unknown ending "${node.ending}" in "${id}"`);
      endingsHit.add(node.ending);
      return;
    }
    assert(Array.isArray(choices) && choices.length === 2, `"${id}" needs exactly 2 choices`);
    choices.forEach(c => assert(c.label, `unlabelled choice in "${id}"`));
  });
}

const unreached = Object.keys(STORY).filter(id => !reached.has(id));
const missingEndings = Object.keys(ENDINGS).filter(e => !endingsHit.has(e));
assert.deepStrictEqual(unreached, [], `unreachable nodes: ${unreached}`);
assert.deepStrictEqual(missingEndings, [], `unreachable endings: ${missingEndings}`);
console.log(`ok: ${Object.keys(STORY).length} nodes, ${Object.keys(ENDINGS).length} endings, all reachable`);
