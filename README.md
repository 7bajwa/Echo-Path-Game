# Echo Path

Branching audio story for lying down with your eyes closed. Plain HTML/JS PWA, no build step.

- `story.js` — the story graph (nodes, choices, endings). Edit content here.
- `engine.js` — ambient beds (Web Audio), sentence-by-sentence TTS, tap/headphone input, saves.
- `node tools/check-story.js` — verifies every node and ending is reachable. Run after editing the story.

Run locally: `python -m http.server 8765` in this folder, open http://localhost:8765.
Test on phones: drag this folder onto https://app.netlify.com/drop (HTTPS needed for wake lock, service worker, install).
