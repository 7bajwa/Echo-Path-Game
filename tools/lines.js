// Prints every clip the game can ask for, as JSON: [{ id, kind: 'line', text } | { id, kind: 'choices', a, or, b }].
// tools/render.py reads this. Must build keys exactly the way engine.js does.
const { load, metas, walk } = require('./walk');
const { clipId, choiceKey } = require('../text.js');

const { STORY, ENDINGS, IDLE, LINES } = load();
const clips = new Map();
function add(key, item) {
  const id = clipId(key), prev = clips.get(id);
  if (prev && prev.key !== key) throw new Error(`clip id collision:\n${prev.key}\n${key}`);
  clips.set(id, { id, key, ...item });
}
const line = text => add(text, { kind: 'line', text });

for (const meta of metas(ENDINGS)) {
  walk(STORY, meta, (id, node, text, choices) => {
    line(text);
    if (choices) {
      const labels = choices.map(c => c.label);
      add(choiceKey(labels), { kind: 'choices', a: labels[0] + '.', or: LINES.or, b: labels[1] + '.' });
    }
  });
}
IDLE.forEach(line);
const total = Object.keys(ENDINGS).length;
Object.values(ENDINGS).forEach(t => line(LINES.ending(t)));
for (let n = 1; n <= total; n++) line(LINES.count(n, total));
line(LINES.again);
line(LINES.restart);

process.stdout.write(JSON.stringify([...clips.values()].map(({ key, ...c }) => c), null, 1));
