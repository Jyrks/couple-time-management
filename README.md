# Meie aeg

Week planner for Jürgen and Eike. Static site on GitHub Pages, data stored in
`data/events.json` in this repo via the GitHub Contents API.

- App: https://jyrks.github.io/couple-time-management/
- First-time setup: open `/setup.html`, paste a fine-grained PAT (this repo only,
  Contents: read/write) and both passwords. The PAT is stored encrypted in
  `config.json`.
- Tests: `node --test test/`
- Local dev: `python3 -m http.server 8080` then open http://localhost:8080/
