# Couple Time Management – Design

Date: 2026-09-06
Repo: `Jyrks/couple-time-management`, served by GitHub Pages at
`https://jyrks.github.io/couple-time-management/`.

## Purpose

A mobile-friendly, Google-Calendar-like week planner for two people, Jürgen and
Eike, who share care of their two-year-old daughter Laara. It records work time
(usually 09–17), evening personal time (17–21, until Laara's 21:00 bedtime),
who was with Laara, and shared couple time. It supports both planning coming
weeks and reviewing past weeks so evening time stays balanced.

Users: exactly two (`jürgen`, `eike`). UI language: Estonian.

## Constraints

- Static hosting only (GitHub Pages, public repo, free plan).
- Calendar data lives in the same repo as plain JSON.
- Basic auth only; not designed against determined attackers.
- No build step, no framework. Vanilla ES modules.
- Tests run with `node --test` on pure modules.

## Architecture

```
index.html      main app shell
setup.html      one-time setup page (creates config.json)
style.css
js/app.js       UI: views, event handlers, rendering
js/logic.js     pure functions: dates, presets, summaries, merge
js/crypto.js    PBKDF2 + AES-GCM wrappers over WebCrypto
js/github.js    GitHub Contents API client (get/put with sha)
js/i18n.et.js   Estonian labels
data/events.json  { settings, events[] }
config.json     encrypted PAT per user
test/*.test.js
```

`logic.js` and `crypto.js` have no DOM dependency and are fully unit tested.
`github.js` is a thin fetch wrapper. `app.js` is UI glue and is verified by
manual smoke testing in a browser.

## Authentication and token handling

GitHub Pages cannot hold a secret, so the browser must obtain a GitHub
fine-grained personal access token (PAT) to write data. The PAT is stored in
the repo encrypted, once per user password:

```json
{
  "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 300000 },
  "users": {
    "jürgen": { "salt": "<b64>", "iv": "<b64>", "ciphertext": "<b64>" },
    "eike":   { "salt": "<b64>", "iv": "<b64>", "ciphertext": "<b64>" }
  }
}
```

Login flow:

1. User enters username and password.
2. Derive AES-GCM-256 key with PBKDF2(password, salt, iterations).
3. Decrypt ciphertext. Success yields the PAT; failure means wrong password.
4. PAT is kept in memory. If "Jää sisse" is checked, it is stored in
   `localStorage` together with the username so the phone stays logged in.
5. Logout clears memory and `localStorage`.

Usernames are normalised with `toLowerCase()` and NFC before lookup so
`Jürgen` and `jürgen` both match.

Setup (`setup.html`, run once by Jürgen):

1. Paste PAT, enter both passwords.
2. Page encrypts PAT with each password, builds `config.json`.
3. Page writes `config.json` to the repo using the PAT itself (Contents API).
4. The PAT never leaves the browser; it is not committed in plaintext anywhere.

PAT requirements: fine-grained, scoped to repo `couple-time-management` only,
permission Contents: Read and write. Expiry set as long as GitHub allows;
when it expires, rerun `setup.html` with a new PAT.

## Data model

Single file `data/events.json`:

```json
{
  "version": 1,
  "settings": {
    "bedtime": "21:00",
    "work": {
      "jürgen": { "days": [1,2,3,4,5], "start": "09:00", "end": "17:00" },
      "eike":   { "days": [1,2,3,4,5], "start": "09:00", "end": "17:00" }
    },
    "sitters": ["vanaema"]
  },
  "events": [
    {
      "id": "k7f3a9",
      "date": "2026-09-08",
      "start": "17:00",
      "end": "19:00",
      "who": "jürgen",
      "type": "vaba",
      "status": "plaan",
      "note": "",
      "updated": "2026-09-06T14:03:00Z"
    }
  ]
}
```

Fields:

- `who`: `"jürgen" | "eike" | "both"`. `both` renders across both lanes.
- `type`: `"töö"` (work), `"vaba"` (personal free time), `"laara"` (with
  Laara), `"koos"` (together as a couple), `"muu"` (other).
- `status`: `"plaan"` (planned) or `"tehtud"` (happened). Marking done is a
  single tap in the event editor. Summaries count both but distinguish them.
- `note`: free text, for example the sitter's name for `koos` events.
- `updated`: ISO timestamp, used for last-write-wins on merge.
- `id`: 8 random base36 characters.

Times are local wall-clock strings; the app assumes both users are in the same
time zone. Events do not cross midnight.

## Persistence

- Read: `GET /repos/Jyrks/couple-time-management/contents/data/events.json`
  with `Accept: application/vnd.github.raw+json` for content and a second call
  (or the JSON variant) for `sha`. The JSON variant is used: base64 decode
  content, keep `sha`.
- Write: `PUT` same path with `{ message, content: base64, sha }`.
- Conflict: on HTTP 409 or 422 (sha mismatch), refetch, merge, retry once.
  Merge is per event id, newest `updated` wins; deletions are represented by
  the id being absent locally after a local delete, tracked in a pending
  delete set so a refetch does not resurrect them.
- Commit message: `<user>: <short description>`, e.g.
  `eike: 2026-09-08 vaba 17–21`.
- Every user action that changes data saves immediately. A small status pill
  shows "Salvestan…" / "Salvestatud" / "Viga".
- Reads go through the API (not `raw.githubusercontent.com`) to avoid CDN
  caching delays. Authenticated rate limit is 5000/hour, far above need.

## UI

Estonian throughout. Three top-level views in a bottom tab bar on mobile,
top bar on desktop: **Nädal**, **Ülevaade**, **Seaded**.

### Nädal (week)

- Header: week range, `‹ ›` arrows, "Täna" button, swipe left/right on touch.
- Grid: hours 07:00–22:00 vertically, seven day columns Mon–Sun. Each day
  column is split into two lanes: left Jürgen, right Eike. `both` events span
  both lanes.
- Colours by type: töö grey, vaba green, laara orange, koos purple, muu blue.
  Planned events have a dashed border; done events solid.
- Today's column highlighted, current time line drawn.
- Tap empty slot: opens editor with date, that hour, `who` = lane tapped.
- Tap event: opens editor (edit fields, "Tehtud" toggle, delete).
- Day header tap: opens **Õhtu kiirvalik** (evening quick pick) sheet with
  presets. Choosing one replaces existing 17:00–bedtime events for that date
  and creates the preset's events:
  - `Eike vaba 17–21`: eike vaba 17–21, jürgen laara 17–21
  - `Jürgen vaba 17–21`: mirror
  - `Pooleks: J vaba 17–19, E vaba 19–21`: four events
  - `Pooleks: E vaba 17–19, J vaba 19–21`: four events
  - `Koos (hoidja)`: both koos 17–21, note = chosen sitter
  - `Koos Laaraga`: both laara 17–21
- `Täida töö` button in the week header: for each weekday in settings, create
  a `töö` event for each person if none exists on that date.

Editor is a bottom sheet with: kuupäev, algus, lõpp (15-minute steps), kes,
tüüp, märkus, staatus toggle, Salvesta / Kustuta.

### Ülevaade (review)

- Week selector like Nädal.
- Table for the selected week with rows per type and columns Jürgen / Eike,
  hours split as `tehtud (+plaan)`.
- Balance row: `vaba` hours difference Jürgen minus Eike for this week and
  cumulative over the last 4 weeks, with a sentence such as
  "Eike on saanud 3 h rohkem vaba aega viimase 4 nädala jooksul".
- List of evenings in the week showing who had Laara, so gaps are visible.

### Seaded (settings)

- Default work hours per person and weekdays.
- Bedtime.
- Sitter names.
- Logout.

## Error handling

- Wrong password: "Vale kasutajanimi või parool".
- Network or GitHub error on load: show message with "Proovi uuesti".
- Save failure after conflict retry: keep local change in memory, show
  "Salvestamine ebaõnnestus" with a retry button. Reloading discards unsaved
  local changes; this is acceptable for two users.
- Expired PAT (401): log out and show "Ligipääs aegunud, uuenda seadistust".

## Testing

- `test/logic.test.js`: week start/end for any date (Monday first), time
  math, preset expansion, `Täida töö` fill, summaries and balance, merge
  with last-write-wins and pending deletes.
- `test/crypto.test.js`: encrypt then decrypt round trip, wrong password
  fails, config build for two users.
- Manual smoke test in a browser: login, create/edit/delete event, preset,
  review view, on a phone-sized viewport.

## Deployment

1. Push repo to `Jyrks/couple-time-management` on `main`.
2. Enable Pages: source `main`, folder `/`.
3. Jürgen creates the PAT, opens `/setup.html`, enters PAT and both passwords.
4. Both log in at the Pages URL.

## Out of scope

Offline mode, push notifications, recurring event rules, more than two users,
drag-to-resize on touch, calendar import/export.
