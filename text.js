'use strict';
/* Shared by the game and tools/: how text is split for the device voice,
   and which recorded clip file belongs to a spoken line. */

// Chrome cuts utterances after ~15s, so the device voice speaks one sentence at a time.
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

// Clip file name for a line: FNV-1a hash of the exact text. tools/lines.js fails on collisions.
function clipId(key) {
  let h = 0x811c9dc5;
  for (const ch of key.normalize('NFC')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// A choice announcement is one clip: left tone, label A, "or", right tone, label B.
function choiceKey(labels) {
  return 'choices|' + labels.join('|');
}

if (typeof module !== 'undefined') module.exports = { sentences, clipId, choiceKey };
