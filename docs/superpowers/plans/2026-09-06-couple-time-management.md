# Couple Time Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, mobile-first Estonian week planner for Jürgen and Eike that stores its calendar as JSON in this GitHub repo and is served by GitHub Pages.

**Architecture:** Vanilla ES modules, no build. Pure logic (`js/logic.js`), crypto (`js/crypto.js`) and the GitHub Contents client (`js/github.js`) are unit tested with `node --test`. `js/app.js` renders three views (Nädal, Ülevaade, Seaded) into `#app`. A fine-grained PAT is stored encrypted per user password in `config.json`; login decrypts it in the browser.

**Tech Stack:** HTML, CSS, JavaScript ES2022 modules, WebCrypto (PBKDF2, AES-GCM), GitHub REST Contents API, Node 22 test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-couple-time-management-design.md`

## Global Constraints

- No build step, no npm dependencies. Files served as-is from `main` root.
- Node 22 for tests: `node --test test/`.
- Repo `Jyrks/couple-time-management`, branch `main`, data file `data/events.json`, config `config.json`.
- Users: `jürgen`, `eike`. Person keys in data: `"jürgen"`, `"eike"`, `"both"`.
- Type keys in data: `"töö"`, `"vaba"`, `"laara"`, `"koos"`, `"muu"`. Status keys: `"plaan"`, `"tehtud"`.
- UI copy in Estonian. Only `js/i18n.et.js` holds UI strings.
- Times are `HH:MM` local strings; dates `YYYY-MM-DD`. Monday is first day of week.
- PBKDF2-SHA256 300000 iterations, AES-GCM 256 for the PAT.
- Commit after each task.

---

### Task 1: Project scaffold, data files, i18n

**Files:**
- Create: `index.html`, `.nojekyll`, `data/events.json`, `config.json`, `js/i18n.et.js`, `README.md`

**Interfaces:**
- Produces: `T` object from `js/i18n.et.js` used by `js/app.js` and `setup.html`.
- Produces: shape of `data/events.json` `{version, settings, events}` consumed by all later tasks.

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f2937">
<title>Meie aeg</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app"></div>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `.nojekyll`** (empty file) and `data/events.json`

```json
{
  "version": 1,
  "settings": {
    "eveningStart": "17:00",
    "bedtime": "21:00",
    "work": {
      "jürgen": { "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "17:00" },
      "eike": { "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "17:00" }
    },
    "sitters": []
  },
  "events": []
}
```

- [ ] **Step 3: Create placeholder `config.json`**

```json
{
  "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 300000 },
  "users": {}
}
```

- [ ] **Step 4: Create `js/i18n.et.js`**

```js
export const T = {
  appName: 'Meie aeg',
  login: 'Logi sisse',
  username: 'Kasutajanimi',
  password: 'Parool',
  remember: 'Jää sisse',
  badLogin: 'Vale kasutajanimi või parool',
  noSetup: 'Seadistus puudub. Ava setup.html ja lisa GitHubi token.',
  loading: 'Laen…',
  retry: 'Proovi uuesti',
  loadError: 'Andmete laadimine ebaõnnestus',
  saving: 'Salvestan…',
  saved: 'Salvestatud',
  saveError: 'Salvestamine ebaõnnestus',
  expired: 'Ligipääs aegunud, uuenda seadistust (setup.html)',
  tabs: { week: 'Nädal', review: 'Ülevaade', settings: 'Seaded' },
  today: 'Täna',
  fillWork: 'Täida töö',
  persons: { 'jürgen': 'Jürgen', 'eike': 'Eike', both: 'Mõlemad' },
  personShort: { 'jürgen': 'J', 'eike': 'E', both: 'J+E' },
  types: { 'töö': 'Töö', 'vaba': 'Vaba aeg', 'laara': 'Laaraga', 'koos': 'Koos', 'muu': 'Muu' },
  status: { plaan: 'Plaan', tehtud: 'Tehtud' },
  days: ['E', 'T', 'K', 'N', 'R', 'L', 'P'],
  months: ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'],
  editor: {
    new: 'Uus sündmus', edit: 'Muuda sündmust', date: 'Kuupäev', start: 'Algus', end: 'Lõpp',
    who: 'Kes', type: 'Tüüp', note: 'Märkus', done: 'Tehtud', save: 'Salvesta',
    delete: 'Kustuta', cancel: 'Sulge', endBeforeStart: 'Lõpp peab olema pärast algust',
  },
  presets: {
    title: 'Õhtu kiirvalik', sitter: 'Hoidja',
    'eike-vaba': 'Eike vaba', 'jürgen-vaba': 'Jürgen vaba',
    'pooleks-je': 'Pooleks: Jürgen enne', 'pooleks-ej': 'Pooleks: Eike enne',
    'koos-hoidja': 'Koos (hoidja)', 'koos-laaraga': 'Koos Laaraga',
  },
  review: {
    legend: 'Tunnid: tehtud (+plaanis)', balance: 'Vaba aja tasakaal',
    thisWeek: 'See nädal', last4: 'Viimased 4 nädalat', evenings: 'Õhtud',
    nobody: 'planeerimata', even: 'tasakaalus',
    moreFree: (who, h) => `${who} on saanud ${h} h rohkem vaba aega`,
  },
  settings: {
    title: 'Seaded', work: 'Tööaeg', bedtime: 'Laara magamaminek', eveningStart: 'Õhtu algus',
    sitters: 'Hoidjad (komaga eraldatud)', save: 'Salvesta', logout: 'Logi välja', loggedInAs: 'Sisse logitud:',
  },
};
```

- [ ] **Step 5: Create `README.md`**

```markdown
# Meie aeg

Week planner for Jürgen and Eike. Static site on GitHub Pages, data stored in
`data/events.json` in this repo via the GitHub Contents API.

- App: https://jyrks.github.io/couple-time-management/
- First-time setup: open `/setup.html`, paste a fine-grained PAT (this repo only,
  Contents: read/write) and both passwords. The PAT is stored encrypted in
  `config.json`.
- Tests: `node --test test/`
- Local dev: `python3 -m http.server 8080` then open http://localhost:8080/
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold, data files, Estonian strings"
```

---

### Task 2: Pure logic module

**Files:**
- Create: `js/logic.js`
- Test: `test/logic.test.js`

**Interfaces:**
- Produces (all exported from `js/logic.js`):
  - `PERSONS = ['jürgen','eike']`, `TYPES = ['töö','vaba','laara','koos','muu']`
  - `todayStr(now = new Date()) -> 'YYYY-MM-DD'` (local time)
  - `weekStart(dateStr) -> 'YYYY-MM-DD'` Monday of that week
  - `addDays(dateStr, n) -> 'YYYY-MM-DD'`
  - `weekDates(dateStr) -> string[7]` Monday..Sunday of the week containing dateStr
  - `dayOfWeek(dateStr) -> 1..7` (Mon=1, Sun=7)
  - `toMinutes('HH:MM') -> number`, `fromMinutes(number) -> 'HH:MM'`
  - `durationHours(event) -> number`
  - `newId() -> string` 8 chars base36
  - `sortEvents(events) -> events` new array sorted by date, start, who
  - `presets(settings) -> [{ key, build(date, opts) -> event[] }]`
  - `applyPreset(events, key, date, settings, { sitter, status, now }) -> events`
  - `fillWork(events, dates, settings, now) -> events`
  - `summarize(events, dates) -> { 'jürgen': {type: {plaan, tehtud}}, 'eike': {...} }`
  - `balanceOverWeeks(events, weekStartStr, n) -> { 'jürgen': h, 'eike': h, diff }`
  - `eveningOverview(events, dates, settings) -> [{ date, laara: [], vaba: [], koos, note, empty }]`
  - `mergeEvents(remote, local, pendingDeletes: Set) -> events`

- [ ] **Step 1: Write failing tests `test/logic.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONS, TYPES, weekStart, addDays, weekDates, dayOfWeek, toMinutes, fromMinutes,
  durationHours, newId, sortEvents, presets, applyPreset, fillWork, summarize,
  balanceOverWeeks, eveningOverview, mergeEvents, todayStr,
} from '../js/logic.js';

const settings = {
  eveningStart: '17:00',
  bedtime: '21:00',
  work: {
    'jürgen': { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
    'eike': { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  },
  sitters: ['vanaema'],
};
const NOW = '2026-09-06T12:00:00.000Z';
const ev = (o) => ({ id: newId(), status: 'plaan', note: '', updated: NOW, ...o });

test('constants', () => {
  assert.deepEqual(PERSONS, ['jürgen', 'eike']);
  assert.deepEqual(TYPES, ['töö', 'vaba', 'laara', 'koos', 'muu']);
});

test('todayStr uses local date', () => {
  assert.equal(todayStr(new Date(2026, 8, 6, 23, 30)), '2026-09-06');
});

test('weekStart returns Monday', () => {
  assert.equal(weekStart('2026-09-06'), '2026-08-31'); // Sunday
  assert.equal(weekStart('2026-08-31'), '2026-08-31'); // Monday
  assert.equal(weekStart('2026-09-03'), '2026-08-31'); // Thursday
});

test('addDays crosses month and year', () => {
  assert.equal(addDays('2026-08-31', 7), '2026-09-07');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('weekDates Monday to Sunday', () => {
  assert.deepEqual(weekDates('2026-09-06'), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('dayOfWeek Mon=1 Sun=7', () => {
  assert.equal(dayOfWeek('2026-08-31'), 1);
  assert.equal(dayOfWeek('2026-09-06'), 7);
});

test('minutes conversion', () => {
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(fromMinutes(570), '09:30');
  assert.equal(fromMinutes(0), '00:00');
});

test('durationHours', () => {
  assert.equal(durationHours({ start: '17:00', end: '19:30' }), 2.5);
});

test('newId is 8 base36 chars and unique', () => {
  const a = newId(), b = newId();
  assert.match(a, /^[0-9a-z]{8}$/);
  assert.notEqual(a, b);
});

test('sortEvents by date, start, who', () => {
  const a = ev({ date: '2026-09-02', start: '09:00', end: '10:00', who: 'eike', type: 'muu' });
  const b = ev({ date: '2026-09-01', start: '18:00', end: '19:00', who: 'jürgen', type: 'muu' });
  const c = ev({ date: '2026-09-01', start: '09:00', end: '10:00', who: 'jürgen', type: 'muu' });
  assert.deepEqual(sortEvents([a, b, c]).map((e) => e.id), [c.id, b.id, a.id]);
});

test('presets: eike-vaba builds vaba for eike and laara for jürgen', () => {
  const p = presets(settings).find((x) => x.key === 'eike-vaba');
  const out = p.build('2026-09-08', { now: NOW, status: 'plaan' });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => [e.who, e.type, e.start, e.end]), [
    ['eike', 'vaba', '17:00', '21:00'],
    ['jürgen', 'laara', '17:00', '21:00'],
  ]);
  assert.ok(out.every((e) => e.date === '2026-09-08' && e.status === 'plaan' && e.updated === NOW));
});

test('presets: pooleks-je splits at midpoint', () => {
  const p = presets(settings).find((x) => x.key === 'pooleks-je');
  const out = p.build('2026-09-08', {});
  assert.deepEqual(out.map((e) => [e.who, e.type, e.start, e.end]), [
    ['jürgen', 'vaba', '17:00', '19:00'],
    ['eike', 'laara', '17:00', '19:00'],
    ['eike', 'vaba', '19:00', '21:00'],
    ['jürgen', 'laara', '19:00', '21:00'],
  ]);
});

test('presets: koos-hoidja uses sitter note, koos-laaraga is both laara', () => {
  const ps = presets(settings);
  const k = ps.find((x) => x.key === 'koos-hoidja').build('2026-09-08', { sitter: 'vanaema' });
  assert.deepEqual(k.map((e) => [e.who, e.type, e.note]), [['both', 'koos', 'vanaema']]);
  const l = ps.find((x) => x.key === 'koos-laaraga').build('2026-09-08', {});
  assert.deepEqual(l.map((e) => [e.who, e.type]), [['both', 'laara']]);
});

test('presets: all six keys present', () => {
  assert.deepEqual(presets(settings).map((p) => p.key), [
    'eike-vaba', 'jürgen-vaba', 'pooleks-je', 'pooleks-ej', 'koos-hoidja', 'koos-laaraga',
  ]);
});

test('applyPreset replaces evening non-work events on that date only', () => {
  const work = ev({ date: '2026-09-08', start: '09:00', end: '17:00', who: 'jürgen', type: 'töö' });
  const lateWork = ev({ date: '2026-09-08', start: '17:00', end: '18:00', who: 'eike', type: 'töö' });
  const oldEvening = ev({ date: '2026-09-08', start: '17:00', end: '21:00', who: 'jürgen', type: 'vaba' });
  const otherDay = ev({ date: '2026-09-09', start: '17:00', end: '21:00', who: 'eike', type: 'vaba' });
  const out = applyPreset([work, lateWork, oldEvening, otherDay], 'eike-vaba', '2026-09-08', settings, { now: NOW });
  const ids = out.map((e) => e.id);
  assert.ok(ids.includes(work.id));
  assert.ok(ids.includes(lateWork.id));
  assert.ok(ids.includes(otherDay.id));
  assert.ok(!ids.includes(oldEvening.id));
  assert.equal(out.filter((e) => e.date === '2026-09-08' && e.type !== 'töö').length, 2);
});

test('applyPreset with status tehtud', () => {
  const out = applyPreset([], 'jürgen-vaba', '2026-09-01', settings, { status: 'tehtud' });
  assert.ok(out.every((e) => e.status === 'tehtud'));
});

test('fillWork adds missing work events only', () => {
  const dates = weekDates('2026-09-06');
  const existing = ev({ date: '2026-08-31', start: '10:00', end: '18:00', who: 'jürgen', type: 'töö' });
  const out = fillWork([existing], dates, settings, NOW);
  const work = out.filter((e) => e.type === 'töö');
  assert.equal(work.length, 10); // 5 days x 2 persons
  assert.ok(work.some((e) => e.id === existing.id && e.start === '10:00'));
  assert.equal(work.filter((e) => e.date === '2026-09-05').length, 0); // Saturday
  assert.equal(work.filter((e) => e.date === '2026-08-31' && e.who === 'jürgen').length, 1);
  // idempotent
  assert.equal(fillWork(out, dates, settings, NOW).length, out.length);
});

test('fillWork treats a "both" work event as covering both persons', () => {
  const both = ev({ date: '2026-09-01', start: '09:00', end: '17:00', who: 'both', type: 'töö' });
  const out = fillWork([both], ['2026-09-01'], settings, NOW);
  assert.equal(out.length, 1);
});

test('summarize splits by person, type and status; both counts for both', () => {
  const dates = weekDates('2026-09-06');
  const events = [
    ev({ date: '2026-09-01', start: '17:00', end: '21:00', who: 'eike', type: 'vaba', status: 'tehtud' }),
    ev({ date: '2026-09-01', start: '17:00', end: '21:00', who: 'jürgen', type: 'laara', status: 'tehtud' }),
    ev({ date: '2026-09-02', start: '17:00', end: '19:00', who: 'jürgen', type: 'vaba', status: 'plaan' }),
    ev({ date: '2026-09-03', start: '18:00', end: '21:00', who: 'both', type: 'koos', status: 'plaan' }),
    ev({ date: '2026-09-10', start: '17:00', end: '21:00', who: 'eike', type: 'vaba', status: 'plaan' }), // next week
  ];
  const s = summarize(events, dates);
  assert.equal(s.eike.vaba.tehtud, 4);
  assert.equal(s.eike.vaba.plaan, 0);
  assert.equal(s['jürgen'].laara.tehtud, 4);
  assert.equal(s['jürgen'].vaba.plaan, 2);
  assert.equal(s['jürgen'].koos.plaan, 3);
  assert.equal(s.eike.koos.plaan, 3);
  assert.equal(s.eike['töö'].plaan, 0);
});

test('balanceOverWeeks sums vaba over n weeks ending at week', () => {
  const events = [
    ev({ date: '2026-08-11', start: '17:00', end: '21:00', who: 'eike', type: 'vaba', status: 'tehtud' }), // 4 weeks back
    ev({ date: '2026-08-04', start: '17:00', end: '21:00', who: 'eike', type: 'vaba', status: 'tehtud' }), // 5 weeks back, excluded
    ev({ date: '2026-09-02', start: '17:00', end: '19:00', who: 'jürgen', type: 'vaba', status: 'plaan' }),
  ];
  const b = balanceOverWeeks(events, '2026-08-31', 4);
  assert.equal(b.eike, 4);
  assert.equal(b['jürgen'], 2);
  assert.equal(b.diff, -2);
  const w = balanceOverWeeks(events, '2026-08-31', 1);
  assert.equal(w.eike, 0);
  assert.equal(w.diff, 2);
});

test('eveningOverview reports who had Laara, who was free, koos', () => {
  const dates = weekDates('2026-09-06');
  const events = [
    ev({ date: '2026-08-31', start: '17:00', end: '21:00', who: 'eike', type: 'vaba' }),
    ev({ date: '2026-08-31', start: '17:00', end: '21:00', who: 'jürgen', type: 'laara' }),
    ev({ date: '2026-09-01', start: '18:00', end: '21:00', who: 'both', type: 'koos', note: 'vanaema' }),
    ev({ date: '2026-09-02', start: '17:00', end: '21:00', who: 'both', type: 'laara' }),
    ev({ date: '2026-09-03', start: '09:00', end: '17:00', who: 'jürgen', type: 'töö' }), // not evening
  ];
  const o = eveningOverview(events, dates, settings);
  assert.equal(o.length, 7);
  assert.deepEqual(o[0], { date: '2026-08-31', laara: ['jürgen'], vaba: ['eike'], koos: false, note: '', empty: false });
  assert.deepEqual(o[1], { date: '2026-09-01', laara: [], vaba: [], koos: true, note: 'vanaema', empty: false });
  assert.deepEqual(o[2].laara, ['jürgen', 'eike']);
  assert.equal(o[3].empty, true);
});

test('mergeEvents: newest updated wins, pending deletes stay deleted, remote-only kept', () => {
  const a1 = ev({ id: 'a', date: '2026-09-01', start: '17:00', end: '18:00', who: 'eike', type: 'vaba', updated: '2026-09-06T10:00:00Z' });
  const a2 = { ...a1, end: '19:00', updated: '2026-09-06T11:00:00Z' };
  const b = ev({ id: 'b', date: '2026-09-01', start: '09:00', end: '10:00', who: 'jürgen', type: 'muu' });
  const c = ev({ id: 'c', date: '2026-09-02', start: '09:00', end: '10:00', who: 'jürgen', type: 'muu' });
  const d = ev({ id: 'd', date: '2026-09-03', start: '09:00', end: '10:00', who: 'jürgen', type: 'muu' });
  const remote = [a1, b, c];
  const local = [a2, c, d];
  const out = mergeEvents(remote, local, new Set(['b']));
  const byId = Object.fromEntries(out.map((e) => [e.id, e]));
  assert.equal(byId.a.end, '19:00');
  assert.equal(byId.b, undefined);
  assert.ok(byId.c);
  assert.ok(byId.d);
  assert.equal(out.length, 3);
});

test('mergeEvents: remote newer wins over local', () => {
  const l = ev({ id: 'x', date: '2026-09-01', start: '17:00', end: '18:00', who: 'eike', type: 'vaba', updated: '2026-09-06T10:00:00Z' });
  const r = { ...l, end: '20:00', updated: '2026-09-06T12:00:00Z' };
  assert.equal(mergeEvents([r], [l], new Set())[0].end, '20:00');
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test test/logic.test.js`
Expected: FAIL, `Cannot find module '.../js/logic.js'`

- [ ] **Step 3: Implement `js/logic.js`**

```js
export const PERSONS = ['jürgen', 'eike'];
export const TYPES = ['töö', 'vaba', 'laara', 'koos', 'muu'];

const pad = (n) => String(n).padStart(2, '0');

function parse(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function format(dt) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dayOfWeek(dateStr) {
  const d = parse(dateStr).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(dateStr, n) {
  const dt = parse(dateStr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return format(dt);
}

export function weekStart(dateStr) {
  return addDays(dateStr, 1 - dayOfWeek(dateStr));
}

export function weekDates(dateStr) {
  const start = weekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function durationHours(ev) {
  return (toMinutes(ev.end) - toMinutes(ev.start)) / 60;
}

export function newId() {
  let s = '';
  while (s.length < 8) s += Math.random().toString(36).slice(2);
  return s.slice(0, 8);
}

export function sortEvents(events) {
  const whoOrder = { 'jürgen': 0, both: 1, eike: 2 };
  return [...events].sort((a, b) =>
    a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || (whoOrder[a.who] ?? 9) - (whoOrder[b.who] ?? 9));
}

function makeEvent(date, start, end, who, type, opts = {}) {
  return {
    id: newId(),
    date,
    start,
    end,
    who,
    type,
    status: opts.status || 'plaan',
    note: opts.note || '',
    updated: opts.now || new Date().toISOString(),
  };
}

export function presets(settings) {
  const s = settings.eveningStart || '17:00';
  const e = settings.bedtime || '21:00';
  const midMin = Math.round((toMinutes(s) + toMinutes(e)) / 2 / 15) * 15;
  const mid = fromMinutes(midMin);
  return [
    { key: 'eike-vaba', build: (d, o = {}) => [makeEvent(d, s, e, 'eike', 'vaba', o), makeEvent(d, s, e, 'jürgen', 'laara', o)] },
    { key: 'jürgen-vaba', build: (d, o = {}) => [makeEvent(d, s, e, 'jürgen', 'vaba', o), makeEvent(d, s, e, 'eike', 'laara', o)] },
    { key: 'pooleks-je', build: (d, o = {}) => [
      makeEvent(d, s, mid, 'jürgen', 'vaba', o), makeEvent(d, s, mid, 'eike', 'laara', o),
      makeEvent(d, mid, e, 'eike', 'vaba', o), makeEvent(d, mid, e, 'jürgen', 'laara', o)] },
    { key: 'pooleks-ej', build: (d, o = {}) => [
      makeEvent(d, s, mid, 'eike', 'vaba', o), makeEvent(d, s, mid, 'jürgen', 'laara', o),
      makeEvent(d, mid, e, 'jürgen', 'vaba', o), makeEvent(d, mid, e, 'eike', 'laara', o)] },
    { key: 'koos-hoidja', build: (d, o = {}) => [makeEvent(d, s, e, 'both', 'koos', { ...o, note: o.sitter || '' })] },
    { key: 'koos-laaraga', build: (d, o = {}) => [makeEvent(d, s, e, 'both', 'laara', o)] },
  ];
}

export function applyPreset(events, key, date, settings, opts = {}) {
  const preset = presets(settings).find((p) => p.key === key);
  if (!preset) throw new Error(`unknown preset ${key}`);
  const eveningStart = toMinutes(settings.eveningStart || '17:00');
  const kept = events.filter((ev) => !(ev.date === date && ev.type !== 'töö' && toMinutes(ev.start) >= eveningStart));
  return sortEvents([...kept, ...preset.build(date, opts)]);
}

export function fillWork(events, dates, settings, now) {
  const added = [];
  for (const date of dates) {
    const dow = dayOfWeek(date);
    for (const p of PERSONS) {
      const w = settings.work?.[p];
      if (!w || !w.days.includes(dow)) continue;
      const has = events.some((ev) => ev.date === date && ev.type === 'töö' && (ev.who === p || ev.who === 'both'));
      if (!has) added.push(makeEvent(date, w.start, w.end, p, 'töö', { now }));
    }
  }
  return added.length ? sortEvents([...events, ...added]) : events;
}

function personsOf(ev) {
  return ev.who === 'both' ? PERSONS : [ev.who];
}

export function summarize(events, dates) {
  const set = new Set(dates);
  const out = {};
  for (const p of PERSONS) {
    out[p] = {};
    for (const t of TYPES) out[p][t] = { plaan: 0, tehtud: 0 };
  }
  for (const ev of events) {
    if (!set.has(ev.date) || !TYPES.includes(ev.type)) continue;
    const h = durationHours(ev);
    for (const p of personsOf(ev)) {
      if (out[p]) out[p][ev.type][ev.status === 'tehtud' ? 'tehtud' : 'plaan'] += h;
    }
  }
  return out;
}

export function balanceOverWeeks(events, weekStartStr, n = 4) {
  const first = addDays(weekStart(weekStartStr), -7 * (n - 1));
  const last = addDays(weekStart(weekStartStr), 6);
  const out = { 'jürgen': 0, eike: 0 };
  for (const ev of events) {
    if (ev.type !== 'vaba' || ev.date < first || ev.date > last) continue;
    for (const p of personsOf(ev)) if (p in out) out[p] += durationHours(ev);
  }
  out.diff = out['jürgen'] - out.eike;
  return out;
}

export function eveningOverview(events, dates, settings) {
  const eveningStart = toMinutes(settings.eveningStart || '17:00');
  return dates.map((date) => {
    const evs = events.filter((ev) => ev.date === date && ev.type !== 'töö' && toMinutes(ev.start) >= eveningStart);
    const laara = [], vaba = [];
    let koos = false, note = '';
    for (const ev of evs) {
      if (ev.type === 'laara') for (const p of personsOf(ev)) if (!laara.includes(p)) laara.push(p);
      if (ev.type === 'vaba') for (const p of personsOf(ev)) if (!vaba.includes(p)) vaba.push(p);
      if (ev.type === 'koos') { koos = true; if (!note) note = ev.note || ''; }
    }
    return { date, laara, vaba, koos, note, empty: evs.length === 0 };
  });
}

export function mergeEvents(remote, local, pendingDeletes = new Set()) {
  const map = new Map();
  for (const ev of remote) if (!pendingDeletes.has(ev.id)) map.set(ev.id, ev);
  for (const ev of local) {
    const r = map.get(ev.id);
    if (!r || (ev.updated || '') >= (r.updated || '')) map.set(ev.id, ev);
  }
  return sortEvents([...map.values()]);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/logic.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/logic.test.js && git commit -m "feat: pure calendar logic with tests"
```

---

### Task 3: Crypto module

**Files:**
- Create: `js/crypto.js`
- Test: `test/crypto.test.js`

**Interfaces:**
- Produces:
  - `KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 }`
  - `normalizeUser(str) -> str` trim, NFC, lowercase
  - `encryptSecret(password, secret, iterations = KDF.iterations) -> Promise<{salt, iv, ciphertext}>` base64 fields
  - `decryptSecret(password, entry, iterations = KDF.iterations) -> Promise<string>` throws on wrong password
  - `buildConfig(secret, passwordsByUser, iterations = KDF.iterations) -> Promise<config>`
  - `unlock(config, username, password) -> Promise<string>` throws on unknown user or wrong password

- [ ] **Step 1: Write failing tests `test/crypto.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KDF, normalizeUser, encryptSecret, decryptSecret, buildConfig, unlock } from '../js/crypto.js';

const FAST = 1000; // iterations for tests

test('KDF defaults', () => {
  assert.deepEqual(KDF, { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 });
});

test('normalizeUser', () => {
  assert.equal(normalizeUser('  Jürgen '), 'jürgen');
  assert.equal(normalizeUser('jürgen'), 'jürgen'); // combining diaeresis -> NFC
});

test('encrypt/decrypt round trip with unicode password', async () => {
  const entry = await encryptSecret('armastabjürgenit', 'github_pat_ABC', FAST);
  assert.match(entry.salt, /^[A-Za-z0-9+/=]+$/);
  assert.match(entry.iv, /^[A-Za-z0-9+/=]+$/);
  assert.match(entry.ciphertext, /^[A-Za-z0-9+/=]+$/);
  assert.equal(await decryptSecret('armastabjürgenit', entry, FAST), 'github_pat_ABC');
});

test('wrong password fails', async () => {
  const entry = await encryptSecret('right', 'secret', FAST);
  await assert.rejects(decryptSecret('wrong', entry, FAST));
});

test('buildConfig and unlock for two users', async () => {
  const cfg = await buildConfig('tok', { 'Jürgen': 'armastabeiket', eike: 'armastabjürgenit' }, FAST);
  assert.equal(cfg.version, 1);
  assert.equal(cfg.kdf.iterations, FAST);
  assert.deepEqual(Object.keys(cfg.users).sort(), ['eike', 'jürgen']);
  assert.equal(await unlock(cfg, 'jürgen', 'armastabeiket'), 'tok');
  assert.equal(await unlock(cfg, 'EIKE', 'armastabjürgenit'), 'tok');
  await assert.rejects(unlock(cfg, 'eike', 'armastabeiket'));
  await assert.rejects(unlock(cfg, 'laara', 'x'));
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test test/crypto.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/crypto.js`**

```js
export const KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 };

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

function b64(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function normalizeUser(u) {
  return String(u).trim().normalize('NFC').toLowerCase();
}

async function deriveKey(password, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(password, secret, iterations = KDF.iterations) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
  return { salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) };
}

export async function decryptSecret(password, entry, iterations = KDF.iterations) {
  const key = await deriveKey(password, unb64(entry.salt), iterations);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) }, key, unb64(entry.ciphertext));
  return dec.decode(pt);
}

export async function buildConfig(secret, passwordsByUser, iterations = KDF.iterations) {
  const users = {};
  for (const [user, pw] of Object.entries(passwordsByUser)) {
    users[normalizeUser(user)] = await encryptSecret(pw, secret, iterations);
  }
  return { version: 1, kdf: { ...KDF, iterations }, users };
}

export async function unlock(config, username, password) {
  const entry = config?.users?.[normalizeUser(username)];
  if (!entry) throw new Error('unknown user');
  return decryptSecret(password, entry, config.kdf?.iterations ?? KDF.iterations);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/crypto.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/crypto.js test/crypto.test.js && git commit -m "feat: PBKDF2/AES-GCM token encryption"
```

---

### Task 4: GitHub Contents client

**Files:**
- Create: `js/github.js`
- Test: `test/github.test.js`

**Interfaces:**
- Produces:
  - `class GitHubError extends Error { status }`
  - `encodeBase64Utf8(str) -> str`, `decodeBase64Utf8(b64) -> str`
  - `class GitHubStore { constructor({ owner, repo, token, branch = 'main', fetchFn = globalThis.fetch }); async get(path) -> { content, sha }; async put(path, content, message, sha) -> newSha }`

- [ ] **Step 1: Write failing tests `test/github.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubStore, GitHubError, encodeBase64Utf8, decodeBase64Utf8 } from '../js/github.js';

test('base64 utf8 round trip', () => {
  const s = 'Jürgen & Eike – Laara';
  assert.equal(decodeBase64Utf8(encodeBase64Utf8(s)), s);
  assert.equal(decodeBase64Utf8(encodeBase64Utf8('Jö').replace(/(.{2})/g, '$1\n')), 'Jö'); // newline-tolerant
});

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

test('get decodes content and returns sha', async () => {
  const fetchFn = mockFetch(() => ({ status: 200, body: { content: encodeBase64Utf8('{"a":1}'), sha: 'abc' } }));
  const store = new GitHubStore({ owner: 'Jyrks', repo: 'r', token: 't', fetchFn });
  const out = await store.get('data/events.json');
  assert.deepEqual(out, { content: '{"a":1}', sha: 'abc' });
  const { url, init } = fetchFn.calls[0];
  assert.equal(url, 'https://api.github.com/repos/Jyrks/r/contents/data/events.json?ref=main');
  assert.equal(init.headers.Authorization, 'Bearer t');
  assert.equal(init.cache, 'no-store');
});

test('get throws GitHubError with status', async () => {
  const fetchFn = mockFetch(() => ({ status: 401, body: {} }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await assert.rejects(store.get('x'), (e) => e instanceof GitHubError && e.status === 401);
});

test('put sends base64 content, sha, branch and returns new sha', async () => {
  const fetchFn = mockFetch(() => ({ status: 200, body: { content: { sha: 'new' } } }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  const sha = await store.put('data/events.json', '{"b":2}', 'eike: test', 'old');
  assert.equal(sha, 'new');
  const { url, init } = fetchFn.calls[0];
  assert.equal(url, 'https://api.github.com/repos/o/r/contents/data/events.json');
  assert.equal(init.method, 'PUT');
  const body = JSON.parse(init.body);
  assert.equal(body.message, 'eike: test');
  assert.equal(body.sha, 'old');
  assert.equal(body.branch, 'main');
  assert.equal(decodeBase64Utf8(body.content), '{"b":2}');
});

test('put without sha omits sha (new file)', async () => {
  const fetchFn = mockFetch(() => ({ status: 201, body: { content: { sha: 'n' } } }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await store.put('config.json', '{}', 'm', null);
  assert.equal('sha' in JSON.parse(fetchFn.calls[0].init.body), false);
});

test('put conflict raises 409', async () => {
  const fetchFn = mockFetch(() => ({ status: 409, body: {} }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await assert.rejects(store.put('p', 'c', 'm', 's'), (e) => e.status === 409);
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test test/github.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/github.js`**

```js
export class GitHubError extends Error {
  constructor(status, message) {
    super(message || `GitHub ${status}`);
    this.status = status;
  }
}

export function encodeBase64Utf8(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export class GitHubStore {
  constructor({ owner, repo, token, branch = 'main', fetchFn = globalThis.fetch.bind(globalThis) }) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.branch = branch;
    this.fetchFn = fetchFn;
  }

  url(path) {
    return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async get(path) {
    const res = await this.fetchFn(`${this.url(path)}?ref=${encodeURIComponent(this.branch)}`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!res.ok) throw new GitHubError(res.status);
    const json = await res.json();
    return { content: decodeBase64Utf8(json.content), sha: json.sha };
  }

  async put(path, content, message, sha) {
    const body = { message, content: encodeBase64Utf8(content), branch: this.branch };
    if (sha) body.sha = sha;
    const res = await this.fetchFn(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new GitHubError(res.status);
    const json = await res.json();
    return json.content.sha;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/`
Expected: all pass (logic, crypto, github).

- [ ] **Step 5: Commit**

```bash
git add js/github.js test/github.test.js && git commit -m "feat: GitHub contents API client"
```

---

### Task 5: Styles

**Files:**
- Create: `style.css`

**Interfaces:**
- Produces class names consumed by `js/app.js`: `.login`, `.top`, `.tabs`, `.status`, `.weeknav`, `.actions`, `.legend .lg`, `.heads .dayhead .today .lanes`, `.grid .timecol .hour .daycol .gridline .lanesep .nowline`, `.ev .lane-j .lane-e .lane-both .plaan .tehtud .type-work .type-free .type-laara .type-koos .type-muu .evlabel`, `.overlay .sheet .editor .presets .preset .row .check .btns .primary .danger .error`, `.review .sum .balance .evenings .empty .hint`, `.settings .chip .days`.

- [ ] **Step 1: Write `style.css`**

```css
:root {
  --bg: #f6f7fb; --panel: #fff; --text: #1f2937; --muted: #6b7280; --line: #e5e7eb;
  --accent: #2563eb; --danger: #dc2626; --today: #eff6ff;
  --work: #cbd5e1; --work-t: #334155;
  --free: #bbf7d0; --free-t: #14532d;
  --laara: #fed7aa; --laara-t: #7c2d12;
  --koos: #e9d5ff; --koos-t: #581c87;
  --muu: #bfdbfe; --muu-t: #1e3a8a;
  --hour: 48px;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
button, input, select { font: inherit; }
button { cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--text); border-radius: 8px; padding: 6px 10px; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.danger { color: var(--danger); border-color: var(--danger); }
button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
input, select { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: var(--panel); width: 100%; }
label { display: block; font-size: 13px; color: var(--muted); margin: 8px 0 0; }
label > input, label > select { margin-top: 4px; }
label.check { display: flex; align-items: center; gap: 8px; color: var(--text); }
label.check > input { width: auto; margin: 0; }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 17px; margin: 0 0 8px; }
h3 { font-size: 15px; margin: 16px 0 6px; }
.error { color: var(--danger); font-size: 14px; min-height: 1em; margin: 6px 0; }
.hint { color: var(--muted); font-size: 13px; }
.row { display: flex; gap: 8px; }
.row > label { flex: 1; }
.btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }

/* login */
.login { max-width: 360px; margin: 12vh auto; background: var(--panel); padding: 24px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.08); }
.login form { display: flex; flex-direction: column; gap: 6px; }
.login button.primary { margin-top: 12px; padding: 10px; }

/* layout */
.top { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
.status { font-size: 12px; color: var(--muted); flex: 1; }
.status.err { color: var(--danger); }
.tabs { display: flex; gap: 6px; }
main { padding: 10px 8px 80px; max-width: 1100px; margin: 0 auto; }
@media (max-width: 799px) {
  .tabs { position: fixed; left: 0; right: 0; bottom: 0; background: var(--panel); border-top: 1px solid var(--line); padding: 8px calc(8px + env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)); z-index: 5; }
  .tabs button { flex: 1; padding: 10px 0; }
}

/* week nav */
.weeknav { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.weeknav .range { flex: 1; text-align: center; font-weight: 600; }
.actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.legend { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; }
.lg { padding: 2px 6px; border-radius: 6px; }
.lg.type-work { background: var(--work); color: var(--work-t); }
.lg.type-free { background: var(--free); color: var(--free-t); }
.lg.type-laara { background: var(--laara); color: var(--laara-t); }
.lg.type-koos { background: var(--koos); color: var(--koos-t); }
.lg.type-muu { background: var(--muu); color: var(--muu-t); }

/* week grid */
.heads, .grid { display: grid; grid-template-columns: 36px repeat(7, 1fr); }
.heads { position: sticky; top: 49px; background: var(--bg); z-index: 4; }
.dayhead { display: flex; flex-direction: column; align-items: center; padding: 4px 0 2px; border: none; background: none; border-radius: 8px 8px 0 0; gap: 0; line-height: 1.1; }
.dayhead .dow { font-size: 11px; color: var(--muted); }
.dayhead .dom { font-size: 16px; font-weight: 600; }
.dayhead.today .dom { background: var(--accent); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
.dayhead .lanes { display: flex; width: 100%; font-size: 10px; color: var(--muted); margin-top: 2px; }
.dayhead .lanes b { flex: 1; text-align: center; font-weight: 500; }
.grid { background: var(--panel); border: 1px solid var(--line); border-radius: 0 0 10px 10px; overflow: hidden; touch-action: pan-y; }
.timecol { position: relative; }
.hour { position: absolute; right: 4px; transform: translateY(-7px); font-size: 10px; color: var(--muted); }
.daycol { position: relative; border-left: 1px solid var(--line); }
.daycol.today { background: var(--today); }
.gridline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--line); }
.lanesep { position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--line); }
.nowline { position: absolute; left: 0; right: 0; border-top: 2px solid var(--danger); z-index: 2; }
.ev { position: absolute; border-radius: 4px; padding: 1px 3px; font-size: 10px; overflow: hidden; cursor: pointer; z-index: 1; border: 1px solid transparent; }
.ev.lane-j { left: 1px; right: 50%; margin-right: 1px; }
.ev.lane-e { left: 50%; right: 1px; margin-left: 1px; }
.ev.lane-both { left: 1px; right: 1px; }
.ev.plaan { border-style: dashed; border-color: rgba(0,0,0,.35); }
.ev.type-work { background: var(--work); color: var(--work-t); }
.ev.type-free { background: var(--free); color: var(--free-t); }
.ev.type-laara { background: var(--laara); color: var(--laara-t); }
.ev.type-koos { background: var(--koos); color: var(--koos-t); }
.ev.type-muu { background: var(--muu); color: var(--muu-t); }
.evlabel { display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
@media (max-width: 480px) { .evlabel { font-size: 9px; } }
@media (min-width: 800px) { .ev { font-size: 12px; padding: 2px 5px; } .hour { font-size: 11px; } }

/* sheets */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: flex-end; justify-content: center; z-index: 20; }
.sheet { background: var(--panel); width: 100%; max-width: 520px; border-radius: 16px 16px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); max-height: 90vh; overflow: auto; }
@media (min-width: 800px) { .overlay { align-items: center; } .sheet { border-radius: 16px; } }
.presets { display: flex; flex-direction: column; gap: 8px; }
.preset { text-align: left; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.preset small { color: var(--muted); }

/* review */
.sum { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: 10px; overflow: hidden; }
.sum th, .sum td { padding: 8px 10px; text-align: right; border-bottom: 1px solid var(--line); }
.sum th:first-child, .sum td:first-child { text-align: left; }
.sum tr.type-work td:first-child { border-left: 4px solid var(--work); }
.sum tr.type-free td:first-child { border-left: 4px solid var(--free); }
.sum tr.type-laara td:first-child { border-left: 4px solid var(--laara); }
.sum tr.type-koos td:first-child { border-left: 4px solid var(--koos); }
.sum tr.type-muu td:first-child { border-left: 4px solid var(--muu); }
.balance { background: var(--panel); border-radius: 10px; padding: 10px 12px; margin-top: 12px; }
.balance p { margin: 4px 0; }
.evenings { list-style: none; padding: 0; margin: 0; background: var(--panel); border-radius: 10px; }
.evenings li { padding: 8px 12px; border-bottom: 1px solid var(--line); }
.evenings li.empty { color: var(--muted); }

/* settings */
.settings { background: var(--panel); border-radius: 12px; padding: 14px; max-width: 520px; }
fieldset { border: 1px solid var(--line); border-radius: 10px; margin: 10px 0; padding: 6px 12px 10px; }
legend { color: var(--muted); font-size: 13px; padding: 0 4px; }
.days { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; margin: 0; color: var(--text); }
.chip input { width: auto; margin: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add style.css && git commit -m "feat: styles"
```

---

### Task 6: App UI (`js/app.js`)

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: everything exported by `js/logic.js`, `unlock` and `normalizeUser` from `js/crypto.js`, `GitHubStore` and `GitHubError` from `js/github.js`, `T` from `js/i18n.et.js`.
- Produces: the running app. `localStorage` key `meieaeg.session` = `{"user","token"}`.

- [ ] **Step 1: Write `js/app.js`**

```js
import { T } from './i18n.et.js';
import {
  PERSONS, TYPES, todayStr, weekStart, addDays, weekDates, toMinutes, fromMinutes, newId,
  sortEvents, presets, applyPreset, fillWork, summarize, balanceOverWeeks, eveningOverview, mergeEvents,
} from './logic.js';
import { unlock, normalizeUser } from './crypto.js';
import { GitHubStore, GitHubError } from './github.js';

const OWNER = 'Jyrks';
const REPO = 'couple-time-management';
const DATA_PATH = 'data/events.json';
const SESSION_KEY = 'meieaeg.session';
const DAY_START = 7;
const DAY_END = 22;
const HOUR_PX = 48;
const TYPE_CLASS = { 'töö': 'work', vaba: 'free', laara: 'laara', koos: 'koos', muu: 'muu' };

const state = {
  user: null, token: null, store: null, data: null, sha: null,
  week: weekStart(todayStr()), view: 'week', pendingDeletes: new Set(),
  status: '', statusErr: false, sheet: null,
};
const app = document.getElementById('app');

// ---------- tiny DOM helper ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const round = (x) => String(Math.round(x * 4) / 4).replace('.', ',');
function formatDate(d) {
  return `${Number(d.slice(8))}. ${T.months[Number(d.slice(5, 7)) - 1]}`;
}
function formatRange(a, b) {
  return `${formatDate(a)} – ${formatDate(b)} ${b.slice(0, 4)}`;
}

// ---------- auth ----------
function renderLogin(msg) {
  app.replaceChildren(h('div', { class: 'login' },
    h('h1', {}, T.appName),
    h('form', { onsubmit: onLogin },
      h('label', {}, T.username, h('input', { name: 'user', autocomplete: 'username', autocapitalize: 'none', required: true })),
      h('label', {}, T.password, h('input', { name: 'pass', type: 'password', autocomplete: 'current-password', required: true })),
      h('label', { class: 'check' }, h('input', { name: 'remember', type: 'checkbox', checked: true }), T.remember),
      h('p', { class: 'error' }, msg || ''),
      h('button', { type: 'submit', class: 'primary' }, T.login))));
}

async function onLogin(e) {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button');
  btn.disabled = true;
  btn.textContent = T.loading;
  try {
    const cfg = await (await fetch('./config.json', { cache: 'no-store' })).json();
    if (!cfg.users || Object.keys(cfg.users).length === 0) return renderLogin(T.noSetup);
    const token = await unlock(cfg, f.user.value, f.pass.value);
    const user = normalizeUser(f.user.value);
    if (f.remember.checked) localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
    await boot(user, token);
  } catch (err) {
    console.error(err);
    renderLogin(T.badLogin);
  }
}

function logout(msg) {
  localStorage.removeItem(SESSION_KEY);
  Object.assign(state, { user: null, token: null, store: null, data: null, sha: null, sheet: null });
  renderLogin(msg);
}

async function boot(user, token) {
  state.user = user;
  state.token = token;
  state.store = new GitHubStore({ owner: OWNER, repo: REPO, token });
  await load();
}

// ---------- data ----------
async function load() {
  app.replaceChildren(h('p', { class: 'hint', style: 'padding:20px' }, T.loading));
  try {
    const { content, sha } = await state.store.get(DATA_PATH);
    state.data = JSON.parse(content);
    state.data.events = sortEvents(state.data.events || []);
    state.sha = sha;
    render();
  } catch (err) {
    console.error(err);
    if (err instanceof GitHubError && err.status === 401) return logout(T.expired);
    app.replaceChildren(h('div', { class: 'login' },
      h('p', { class: 'error' }, T.loadError),
      h('button', { class: 'primary', onclick: load }, T.retry),
      h('button', { style: 'margin-left:8px', onclick: () => logout() }, T.settings.logout)));
  }
}

let saveChain = Promise.resolve();
function save(message) {
  saveChain = saveChain.then(() => doSave(message));
  return saveChain;
}

async function doSave(message, retried = false) {
  setStatus(T.saving);
  const content = JSON.stringify(state.data, null, 2) + '\n';
  try {
    state.sha = await state.store.put(DATA_PATH, content, `${state.user}: ${message}`, state.sha);
    state.pendingDeletes.clear();
    setStatus(T.saved);
    setTimeout(() => { if (state.status === T.saved) setStatus(''); }, 2500);
  } catch (err) {
    console.error(err);
    if (err instanceof GitHubError && err.status === 401) return logout(T.expired);
    if (err instanceof GitHubError && (err.status === 409 || err.status === 422) && !retried) {
      const remote = await state.store.get(DATA_PATH);
      const rd = JSON.parse(remote.content);
      state.data.events = mergeEvents(rd.events || [], state.data.events, state.pendingDeletes);
      state.sha = remote.sha;
      render();
      return doSave(message, true);
    }
    setStatus(T.saveError, true);
  }
}

function setStatus(text, isErr = false) {
  state.status = text;
  state.statusErr = isErr;
  const el = document.getElementById('status');
  if (el) { el.textContent = text; el.className = 'status' + (isErr ? ' err' : ''); }
}

// ---------- shell ----------
function render() {
  app.replaceChildren(
    h('header', { class: 'top' },
      h('h1', {}, T.appName),
      h('span', { id: 'status', class: 'status' + (state.statusErr ? ' err' : '') }, state.status),
      h('nav', { class: 'tabs' }, ...['week', 'review', 'settings'].map((v) =>
        h('button', { class: v === state.view ? 'active' : '', onclick: () => { state.view = v; render(); } }, T.tabs[v])))),
    h('main', {}, state.view === 'week' ? renderWeek() : state.view === 'review' ? renderReview() : renderSettings()),
    state.sheet ? renderSheet() : null,
  );
}

function weekHeader() {
  const dates = weekDates(state.week);
  const go = (n) => { state.week = addDays(state.week, n); render(); };
  return h('div', { class: 'weeknav' },
    h('button', { onclick: () => go(-7), 'aria-label': 'Eelmine nädal' }, '‹'),
    h('button', { onclick: () => { state.week = weekStart(todayStr()); render(); } }, T.today),
    h('span', { class: 'range' }, formatRange(dates[0], dates[6])),
    h('button', { onclick: () => go(7), 'aria-label': 'Järgmine nädal' }, '›'));
}

function attachSwipe(el) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) { state.week = addDays(state.week, dx < 0 ? 7 : -7); render(); }
  }, { passive: true });
}

// ---------- week view ----------
function renderWeek() {
  const dates = weekDates(state.week);
  const today = todayStr();
  const heads = dates.map((d, i) => h('button', { class: 'dayhead' + (d === today ? ' today' : ''), onclick: () => openPresets(d) },
    h('span', { class: 'dow' }, T.days[i]),
    h('span', { class: 'dom' }, String(Number(d.slice(8)))),
    h('span', { class: 'lanes' }, h('b', {}, 'J'), h('b', {}, 'E'))));

  const hours = [];
  for (let hr = DAY_START; hr < DAY_END; hr++) {
    hours.push(h('div', { class: 'hour', style: `top:${(hr - DAY_START) * HOUR_PX}px` }, `${String(hr).padStart(2, '0')}:00`));
  }
  const cols = dates.map((d) => {
    const col = h('div', {
      class: 'daycol' + (d === today ? ' today' : ''),
      style: `height:${(DAY_END - DAY_START) * HOUR_PX}px`,
      onclick: (ev) => onSlotClick(ev, d),
    });
    for (let hr = DAY_START; hr < DAY_END; hr++) col.append(h('div', { class: 'gridline', style: `top:${(hr - DAY_START) * HOUR_PX}px` }));
    col.append(h('div', { class: 'lanesep' }));
    for (const e of state.data.events) if (e.date === d) col.append(renderEvent(e));
    if (d === today) {
      const now = new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      if (m >= DAY_START * 60 && m <= DAY_END * 60) col.append(h('div', { class: 'nowline', style: `top:${(m - DAY_START * 60) / 60 * HOUR_PX}px` }));
    }
    return col;
  });
  const grid = h('div', { class: 'grid' }, h('div', { class: 'timecol' }, ...hours), ...cols);
  attachSwipe(grid);

  return h('section', { class: 'week' },
    weekHeader(),
    h('div', { class: 'actions' },
      h('button', { onclick: onFillWork }, T.fillWork),
      h('div', { class: 'legend' }, ...TYPES.map((t) => h('span', { class: `lg type-${TYPE_CLASS[t]}` }, T.types[t])))),
    h('div', { class: 'heads' }, h('div', { class: 'corner' }), ...heads),
    grid);
}

function renderEvent(e) {
  const startMin = Math.max(toMinutes(e.start), DAY_START * 60);
  const endMin = Math.min(toMinutes(e.end), DAY_END * 60);
  if (endMin <= startMin) return h('span');
  const top = (startMin - DAY_START * 60) / 60 * HOUR_PX;
  const height = Math.max(14, (endMin - startMin) / 60 * HOUR_PX);
  const lane = e.who === 'both' ? 'both' : e.who === 'jürgen' ? 'j' : 'e';
  return h('div', {
    class: `ev lane-${lane} ${e.status === 'tehtud' ? 'tehtud' : 'plaan'} type-${TYPE_CLASS[e.type] || 'muu'}`,
    style: `top:${top}px;height:${height - 2}px`,
    title: `${e.start}–${e.end} ${T.types[e.type] || e.type}${e.note ? ' · ' + e.note : ''}`,
    onclick: (ev) => { ev.stopPropagation(); openEditor({ ...e }, false); },
  }, h('span', { class: 'evlabel' }, `${T.types[e.type] || e.type}${e.note ? ' · ' + e.note : ''}`));
}

function onSlotClick(ev, date) {
  const rect = ev.currentTarget.getBoundingClientRect();
  const y = ev.clientY - rect.top;
  const x = ev.clientX - rect.left;
  const hour = Math.min(DAY_END - 1, DAY_START + Math.floor(y / HOUR_PX));
  const who = x < rect.width / 2 ? 'jürgen' : 'eike';
  const evening = hour * 60 >= toMinutes(state.data.settings.eveningStart || '17:00');
  openEditor({
    id: newId(), date, start: fromMinutes(hour * 60), end: fromMinutes(Math.min(hour + 1, DAY_END) * 60),
    who, type: evening ? 'vaba' : 'muu', status: date < todayStr() ? 'tehtud' : 'plaan', note: '',
  }, true);
}

async function onFillWork() {
  const before = state.data.events.length;
  state.data.events = fillWork(state.data.events, weekDates(state.week), state.data.settings, new Date().toISOString());
  if (state.data.events.length === before) return;
  render();
  await save(`täitis tööajad ${state.week}`);
}

// ---------- sheets ----------
function openEditor(ev, isNew) { state.sheet = { kind: 'editor', ev, isNew }; render(); }
function openPresets(date) {
  state.sheet = { kind: 'presets', date, sitter: (state.data.settings.sitters || [])[0] || '' };
  render();
}
function closeSheet() { state.sheet = null; render(); }

function renderSheet() {
  const s = state.sheet;
  return h('div', { class: 'overlay', onclick: (e) => { if (e.target === e.currentTarget) closeSheet(); } },
    h('div', { class: 'sheet' }, s.kind === 'editor' ? renderEditor(s) : renderPresetSheet(s)));
}

function select(name, opts, value) {
  return h('select', { name }, ...opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
}

function renderEditor({ ev, isNew }) {
  const f = h('form', { class: 'editor', onsubmit: (e) => { e.preventDefault(); submitEditor(f, ev); } },
    h('h2', {}, isNew ? T.editor.new : T.editor.edit),
    h('label', {}, T.editor.date, h('input', { name: 'date', type: 'date', value: ev.date, required: true })),
    h('div', { class: 'row' },
      h('label', {}, T.editor.start, h('input', { name: 'start', type: 'time', step: 900, value: ev.start, required: true })),
      h('label', {}, T.editor.end, h('input', { name: 'end', type: 'time', step: 900, value: ev.end, required: true }))),
    h('label', {}, T.editor.who, select('who', [['jürgen', T.persons['jürgen']], ['eike', T.persons.eike], ['both', T.persons.both]], ev.who)),
    h('label', {}, T.editor.type, select('type', TYPES.map((t) => [t, T.types[t]]), ev.type)),
    h('label', {}, T.editor.note, h('input', { name: 'note', value: ev.note || '', list: 'sitters' }),
      h('datalist', { id: 'sitters' }, ...(state.data.settings.sitters || []).map((n) => h('option', { value: n })))),
    h('label', { class: 'check' }, h('input', { name: 'done', type: 'checkbox', checked: ev.status === 'tehtud' }), T.editor.done),
    h('p', { class: 'error', 'data-err': true }),
    h('div', { class: 'btns' },
      isNew ? null : h('button', { type: 'button', class: 'danger', onclick: () => deleteEvent(ev) }, T.editor.delete),
      h('button', { type: 'button', onclick: closeSheet }, T.editor.cancel),
      h('button', { type: 'submit', class: 'primary' }, T.editor.save)));
  return f;
}

async function submitEditor(f, orig) {
  const ev = {
    ...orig,
    date: f.date.value, start: f.start.value, end: f.end.value, who: f.who.value, type: f.type.value,
    note: f.note.value.trim(), status: f.done.checked ? 'tehtud' : 'plaan', updated: new Date().toISOString(),
  };
  if (toMinutes(ev.end) <= toMinutes(ev.start)) { f.querySelector('[data-err]').textContent = T.editor.endBeforeStart; return; }
  const i = state.data.events.findIndex((e) => e.id === ev.id);
  if (i >= 0) state.data.events[i] = ev; else state.data.events.push(ev);
  state.data.events = sortEvents(state.data.events);
  closeSheet();
  await save(`${ev.date} ${T.types[ev.type]} ${ev.start}–${ev.end} (${T.persons[ev.who]})`);
}

async function deleteEvent(ev) {
  state.data.events = state.data.events.filter((e) => e.id !== ev.id);
  state.pendingDeletes.add(ev.id);
  closeSheet();
  await save(`kustutas ${ev.date} ${T.types[ev.type]} ${ev.start}–${ev.end}`);
}

function renderPresetSheet(s) {
  const st = state.data.settings;
  return h('div', { class: 'presets' },
    h('h2', {}, `${T.presets.title} · ${formatDate(s.date)}`),
    h('label', {}, T.presets.sitter,
      h('input', { name: 'sitter', value: s.sitter, list: 'sitters2', oninput: (e) => { s.sitter = e.target.value; } }),
      h('datalist', { id: 'sitters2' }, ...(st.sitters || []).map((n) => h('option', { value: n })))),
    ...presets(st).map((p) => {
      const evs = p.build(s.date, { sitter: s.sitter });
      const desc = evs.map((e) => `${T.personShort[e.who]} ${T.types[e.type]} ${e.start}–${e.end}`).join(', ');
      return h('button', { class: 'preset', onclick: () => applyPresetClick(p.key, s) }, h('b', {}, T.presets[p.key]), h('small', {}, desc));
    }),
    h('button', { type: 'button', onclick: closeSheet }, T.editor.cancel));
}

async function applyPresetClick(key, s) {
  const status = s.date < todayStr() ? 'tehtud' : 'plaan';
  state.data.events = applyPreset(state.data.events, key, s.date, state.data.settings, { sitter: s.sitter, status, now: new Date().toISOString() });
  closeSheet();
  await save(`${s.date} ${T.presets[key]}`);
}

// ---------- review view ----------
function renderReview() {
  const dates = weekDates(state.week);
  const sum = summarize(state.data.events, dates);
  const balW = balanceOverWeeks(state.data.events, state.week, 1);
  const bal4 = balanceOverWeeks(state.data.events, state.week, 4);
  const evs = eveningOverview(state.data.events, dates, state.data.settings);
  const fmt = (t) => `${round(t.tehtud)}${t.plaan ? ` (+${round(t.plaan)})` : ''}`;
  return h('section', { class: 'review' },
    weekHeader(),
    h('table', { class: 'sum' },
      h('thead', {}, h('tr', {}, h('th'), h('th', {}, T.persons['jürgen']), h('th', {}, T.persons.eike))),
      h('tbody', {}, ...TYPES.map((t) => h('tr', { class: `type-${TYPE_CLASS[t]}` },
        h('td', {}, T.types[t]), h('td', {}, fmt(sum['jürgen'][t])), h('td', {}, fmt(sum.eike[t])))))),
    h('p', { class: 'hint' }, T.review.legend),
    h('div', { class: 'balance' },
      h('h3', { style: 'margin-top:0' }, T.review.balance),
      h('p', {}, `${T.review.thisWeek}: ${balanceText(balW)}`),
      h('p', {}, `${T.review.last4}: ${balanceText(bal4)}`)),
    h('h3', {}, T.review.evenings),
    h('ul', { class: 'evenings' }, ...evs.map((x, i) => h('li', { class: x.empty ? 'empty' : '' },
      h('b', {}, `${T.days[i]} ${formatDate(x.date)}`), ' – ', eveningText(x)))));
}

function balanceText(b) {
  if (Math.abs(b.diff) < 0.25) return T.review.even;
  return T.review.moreFree(b.diff > 0 ? T.persons['jürgen'] : T.persons.eike, round(Math.abs(b.diff)));
}

function eveningText(x) {
  if (x.empty) return T.review.nobody;
  const parts = [];
  if (x.koos) parts.push(`${T.types.koos}${x.note ? ' · ' + x.note : ''}`);
  if (x.laara.length) parts.push(`${T.types.laara}: ${x.laara.map((p) => T.persons[p]).join(' + ')}`);
  if (x.vaba.length) parts.push(`${T.types.vaba}: ${x.vaba.map((p) => T.persons[p]).join(', ')}`);
  return parts.join(' · ');
}

// ---------- settings view ----------
function renderSettings() {
  const st = state.data.settings;
  const f = h('form', { class: 'settings', onsubmit: (e) => { e.preventDefault(); saveSettings(f); } },
    h('h2', {}, T.settings.title),
    ...PERSONS.map((p) => h('fieldset', {},
      h('legend', {}, `${T.settings.work} · ${T.persons[p]}`),
      h('div', { class: 'row' },
        h('label', {}, T.editor.start, h('input', { name: `${p}-start`, type: 'time', value: st.work[p].start, required: true })),
        h('label', {}, T.editor.end, h('input', { name: `${p}-end`, type: 'time', value: st.work[p].end, required: true }))),
      h('div', { class: 'days' }, ...T.days.map((d, i) => h('label', { class: 'chip' },
        h('input', { type: 'checkbox', name: `${p}-day-${i + 1}`, checked: st.work[p].days.includes(i + 1) }), d))))),
    h('div', { class: 'row' },
      h('label', {}, T.settings.eveningStart, h('input', { name: 'eveningStart', type: 'time', value: st.eveningStart || '17:00', required: true })),
      h('label', {}, T.settings.bedtime, h('input', { name: 'bedtime', type: 'time', value: st.bedtime || '21:00', required: true }))),
    h('label', {}, T.settings.sitters, h('input', { name: 'sitters', value: (st.sitters || []).join(', ') })),
    h('div', { class: 'btns' }, h('button', { type: 'submit', class: 'primary' }, T.settings.save)),
    h('hr'),
    h('p', { class: 'hint' }, `${T.settings.loggedInAs} ${T.persons[state.user] || state.user}`),
    h('button', { type: 'button', class: 'danger', onclick: () => logout() }, T.settings.logout));
  return f;
}

async function saveSettings(f) {
  const work = {};
  for (const p of PERSONS) {
    const days = [];
    for (let i = 1; i <= 7; i++) if (f.elements[`${p}-day-${i}`].checked) days.push(i);
    work[p] = { days, start: f.elements[`${p}-start`].value, end: f.elements[`${p}-end`].value };
  }
  state.data.settings = {
    ...state.data.settings, work,
    eveningStart: f.elements.eveningStart.value, bedtime: f.elements.bedtime.value,
    sitters: f.elements.sitters.value.split(',').map((s) => s.trim()).filter(Boolean),
  };
  await save('muutis seadeid');
}

// ---------- init ----------
(async function init() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const { user, token } = JSON.parse(raw);
      if (user && token) return await boot(user, token);
    } catch (err) { console.error(err); }
  }
  renderLogin();
})();
```

- [ ] **Step 2: Smoke test locally**

Run: `python3 -m http.server 8080` in repo root, open http://localhost:8080/ in a browser (or Playwright). Expected: login form renders in Estonian; wrong login shows "Seadistus puudub…" because `config.json` has no users. Check console for module errors.

- [ ] **Step 3: Commit**

```bash
git add js/app.js && git commit -m "feat: week, review and settings views"
```

---

### Task 7: Setup page

**Files:**
- Create: `setup.html`

**Interfaces:**
- Consumes: `buildConfig` from `js/crypto.js`, `GitHubStore`, `GitHubError` from `js/github.js`.

- [ ] **Step 1: Write `setup.html`**

```html
<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meie aeg – seadistus</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="login">
  <h1>Seadistus</h1>
  <p class="hint">Loo GitHubis fine-grained token (Settings → Developer settings → Personal access tokens → Fine-grained), ainult repole <b>couple-time-management</b>, õigus <b>Contents: Read and write</b>. Token krüpteeritakse mõlema parooliga ja salvestatakse <code>config.json</code> faili. Token ise ei lahku sellest brauserist.</p>
  <form id="f">
    <label>GitHub token <input name="token" required autocomplete="off"></label>
    <label>Jürgeni parool <input name="pj" type="password" required></label>
    <label>Eike parool <input name="pe" type="password" required></label>
    <p class="error" id="msg"></p>
    <button class="primary" type="submit">Salvesta config.json</button>
  </form>
</div>
<script type="module">
import { buildConfig } from './js/crypto.js';
import { GitHubStore, GitHubError } from './js/github.js';

const OWNER = 'Jyrks', REPO = 'couple-time-management';
const f = document.getElementById('f');
const msg = document.getElementById('msg');

f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = f.querySelector('button');
  btn.disabled = true;
  msg.style.color = '';
  msg.textContent = 'Kontrollin tokenit…';
  try {
    const token = f.token.value.trim();
    const store = new GitHubStore({ owner: OWNER, repo: REPO, token });
    await store.get('data/events.json');
    msg.textContent = 'Krüpteerin (võtab paar sekundit)…';
    const cfg = await buildConfig(token, { 'jürgen': f.pj.value, 'eike': f.pe.value });
    let sha = null;
    try { sha = (await store.get('config.json')).sha; } catch (err) { if (!(err instanceof GitHubError && err.status === 404)) throw err; }
    await store.put('config.json', JSON.stringify(cfg, null, 2) + '\n', 'setup: uuenda config.json', sha);
    msg.style.color = 'green';
    msg.textContent = 'Valmis. GitHub Pages uuendab 1–2 minuti jooksul, seejärel logi sisse: ';
    msg.append(Object.assign(document.createElement('a'), { href: './', textContent: 'ava rakendus' }));
    f.reset();
  } catch (err) {
    console.error(err);
    msg.textContent = err instanceof GitHubError
      ? `GitHub viga ${err.status} – kontrolli tokenit ja õigusi`
      : `Viga: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 2: Smoke test**

Open http://localhost:8080/setup.html. Expected: form renders. Submit with a bogus token: message `GitHub viga 401 – kontrolli tokenit ja õigusi`.

- [ ] **Step 3: Commit**

```bash
git add setup.html && git commit -m "feat: one-time setup page for encrypted token"
```

---

### Task 8: Browser smoke test with mocked GitHub

**Files:**
- Create: `test/browser-smoke.md` (manual checklist)

Automated UI tests are out of scope; verify by hand or with Playwright MCP against a local server where `fetch` is stubbed.

- [ ] **Step 1: Serve locally and run this checklist**

```bash
python3 -m http.server 8080
```

In the browser console at http://localhost:8080/ before logging in, stub GitHub so the app can run without a token:

```js
const data = { version: 1, settings: { eveningStart: '17:00', bedtime: '21:00', work: { 'jürgen': { days: [1,2,3,4,5], start: '09:00', end: '17:00' }, 'eike': { days: [1,2,3,4,5], start: '09:00', end: '17:00' } }, sitters: ['vanaema'] }, events: [] };
let sha = 'a';
const realFetch = window.fetch;
window.fetch = async (url, init = {}) => {
  if (!String(url).includes('api.github.com')) return realFetch(url, init);
  if (init.method === 'PUT') { const b = JSON.parse(init.body); Object.assign(data, JSON.parse(decodeURIComponent(escape(atob(b.content))))); sha = 'b'; return new Response(JSON.stringify({ content: { sha } }), { status: 200 }); }
  return new Response(JSON.stringify({ content: btoa(unescape(encodeURIComponent(JSON.stringify(data)))), sha }), { status: 200 });
};
localStorage.setItem('meieaeg.session', JSON.stringify({ user: 'jürgen', token: 'x' }));
location.reload();
```

(The stub has to be re-applied after reload; instead paste it, then call the init path by reloading only once and re-pasting. Simpler: paste stub, then run `import('./js/app.js')` is not possible twice; so run the stub first, then set the session key and reload, then paste the stub again immediately before the first request completes is unreliable. Use Playwright `page.addInitScript` with the stub for a deterministic run.)

Checklist:
- Week view shows 07–22 hours, 7 columns, J/E lanes, today highlighted.
- Tap a day header, choose `Eike vaba`, two events appear, status pill shows Salvestatud.
- Tap empty slot, editor opens with lane's person, save creates event.
- Tap event, toggle Tehtud, save, border becomes solid.
- Delete event works.
- `Täida töö` adds 10 grey work blocks.
- Ülevaade shows hours table, balance sentence, evenings list.
- Seaded saves sitters and work hours.
- Viewport 375px wide: no horizontal scroll, tabs at bottom.

- [ ] **Step 2: Fix anything found, run `node --test test/`, commit**

```bash
git add -A && git commit -m "test: browser smoke checklist"
```

---

### Task 9: Publish

**Files:** none new.

- [ ] **Step 1: Create the GitHub repo and push**

```bash
gh repo create Jyrks/couple-time-management --public --source=. --remote=origin --description "Meie aeg – Jürgeni ja Eike nädalaplaan" --push
```

- [ ] **Step 2: Enable Pages from `main` root**

```bash
gh api -X POST repos/Jyrks/couple-time-management/pages -f 'source[branch]=main' -f 'source[path]=/'
```

Expected: JSON with `"html_url": "https://jyrks.github.io/couple-time-management/"`. If it returns 409 (already exists) that is fine.

- [ ] **Step 3: Verify deployment**

```bash
sleep 90; curl -sI https://jyrks.github.io/couple-time-management/ | head -1
```

Expected: `HTTP/2 200`.

- [ ] **Step 4: Hand off**

Tell Jürgen: create the fine-grained PAT, open https://jyrks.github.io/couple-time-management/setup.html, paste token and both passwords, then log in on both phones.
