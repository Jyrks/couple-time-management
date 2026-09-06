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
  state.data.events = fillWork(state.data.events, weekDates(state.week), state.data.settings, new Date().toISOString(), todayStr());
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
