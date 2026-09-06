import { T } from './i18n.et.js';
import {
  PERSONS, TYPES, todayStr, weekStart, addDays, weekDates, toMinutes, fromMinutes, newId,
  sortEvents, presets, applyPreset, summarize, balanceOverWeeks, eveningOverview, mergeEvents,
  expandEvents, excludeDate, detachInstance, deleteSeries, moveEvent, resizeEvent,
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
    setStatus(err instanceof GitHubError && err.status === 403 ? T.forbidden : T.saveError, true);
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
let dragEndedAt = 0;
const recentlyDragged = () => Date.now() - dragEndedAt < 400;

function renderWeek() {
  const dates = weekDates(state.week);
  const today = todayStr();
  const instances = expandEvents(state.data.events, dates, today);
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
      'data-date': d,
      style: `height:${(DAY_END - DAY_START) * HOUR_PX}px`,
      onclick: (ev) => { if (!recentlyDragged()) onSlotClick(ev, d); },
    });
    for (let hr = DAY_START; hr < DAY_END; hr++) col.append(h('div', { class: 'gridline', style: `top:${(hr - DAY_START) * HOUR_PX}px` }));
    col.append(h('div', { class: 'lanesep' }));
    for (const e of instances) if (e.date === d) col.append(renderEvent(e));
    if (d === today) {
      const now = new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      if (m >= DAY_START * 60 && m <= DAY_END * 60) col.append(h('div', { class: 'nowline', style: `top:${(m - DAY_START * 60) / 60 * HOUR_PX}px` }));
    }
    return col;
  });
  const grid = h('div', { class: 'grid' }, h('div', { class: 'timecol' }, ...hours), ...cols);
  attachSwipe(grid);
  attachDrag(grid, instances);

  return h('section', { class: 'week' },
    weekHeader(),
    h('div', { class: 'actions' },
      h('span', { class: 'hint draghint' }, T.dragHint),
      h('div', { class: 'legend' }, ...TYPES.map((t) => h('span', { class: `lg type-${TYPE_CLASS[t]}` }, T.types[t])))),
    h('div', { class: 'heads' }, h('div', { class: 'corner' }), ...heads),
    grid);
}

function eventGeometry(e) {
  const startMin = Math.max(toMinutes(e.start), DAY_START * 60);
  const endMin = Math.min(toMinutes(e.end), DAY_END * 60);
  const top = (startMin - DAY_START * 60) / 60 * HOUR_PX;
  const height = Math.max(14, (endMin - startMin) / 60 * HOUR_PX);
  return { top, height, visible: endMin > startMin };
}

function laneClass(who) {
  return who === 'both' ? 'lane-both' : who === 'jürgen' ? 'lane-j' : 'lane-e';
}

function renderEvent(e) {
  const g = eventGeometry(e);
  if (!g.visible) return h('span');
  const label = `${T.types[e.type] || e.type}${e.note ? ' · ' + e.note : ''}`;
  return h('div', {
    class: `ev ${laneClass(e.who)} ${e.status === 'tehtud' ? 'tehtud' : 'plaan'} type-${TYPE_CLASS[e.type] || 'muu'}${e.seriesId ? ' series' : ''}`,
    style: `top:${g.top}px;height:${g.height - 2}px`,
    'data-id': e.id,
    title: `${e.start}–${e.end} ${label}`,
    onclick: (ev) => { ev.stopPropagation(); if (!recentlyDragged()) openEditor({ ...e }, false); },
  },
  h('span', { class: 'evlabel' }, e.seriesId ? '↻ ' : '', label),
  h('span', { class: 'evtime' }, `${e.start}–${e.end}`),
  h('span', { class: 'ev-resize' }));
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

// ---------- drag to move / resize ----------
// Mouse: press and move. Touch: hold ~400 ms, then move (a plain swipe keeps scrolling).
function attachDrag(grid, instances) {
  const byId = new Map(instances.map((i) => [i.id, i]));
  let drag = null;
  let holdTimer = null;

  const begin = (target, x, y) => {
    const el = target.closest('.ev');
    if (!el) return false;
    const inst = byId.get(el.dataset.id);
    if (!inst) return false;
    drag = {
      inst, el, x0: x, y0: y, active: false, moved: false,
      mode: target.classList.contains('ev-resize') ? 'resize' : 'move',
      cur: { date: inst.date, who: inst.who, start: inst.start, end: inst.end },
    };
    return true;
  };

  const activate = () => {
    if (!drag || drag.active) return;
    drag.active = true;
    drag.el.classList.add('dragging');
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const update = (x, y) => {
    if (!drag || !drag.active) return;
    const deltaMin = (y - drag.y0) / HOUR_PX * 60;
    const times = drag.mode === 'resize'
      ? resizeEvent(drag.inst, deltaMin, DAY_END * 60)
      : moveEvent(drag.inst, deltaMin, DAY_START * 60, DAY_END * 60);
    let { date, who } = drag.cur;
    if (drag.mode === 'move') {
      const col = [...grid.querySelectorAll('.daycol')].find((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; });
      if (col) {
        date = col.dataset.date;
        if (drag.inst.who !== 'both') {
          const r = col.getBoundingClientRect();
          who = x < r.left + r.width / 2 ? 'jürgen' : 'eike';
        }
        if (col !== drag.el.parentElement) col.append(drag.el);
      }
    }
    drag.cur = { date, who, ...times };
    drag.moved = true;
    const g = eventGeometry(drag.cur);
    drag.el.style.top = `${g.top}px`;
    drag.el.style.height = `${g.height - 2}px`;
    drag.el.classList.remove('lane-j', 'lane-e', 'lane-both');
    drag.el.classList.add(laneClass(who));
    drag.el.querySelector('.evtime').textContent = `${times.start}–${times.end}`;
  };

  const end = async () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    dragEndedAt = Date.now();
    const changed = d.moved && (d.cur.date !== d.inst.date || d.cur.who !== d.inst.who || d.cur.start !== d.inst.start || d.cur.end !== d.inst.end);
    if (!changed) { render(); return; }
    await commitInstanceChange(d.inst, d.cur, 'day');
  };

  // mouse
  grid.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !begin(e.target, e.clientX, e.clientY)) return;
    e.preventDefault();
    const onMove = (m) => {
      if (!drag) return;
      if (!drag.active && Math.hypot(m.clientX - drag.x0, m.clientY - drag.y0) > 4) activate();
      update(m.clientX, m.clientY);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); end(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // touch
  grid.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (!begin(e.target, t.clientX, t.clientY)) return;
    holdTimer = setTimeout(activate, 400);
  }, { passive: true });
  grid.addEventListener('touchmove', (e) => {
    if (!drag) return;
    const t = e.touches[0];
    if (!drag.active) {
      if (Math.hypot(t.clientX - drag.x0, t.clientY - drag.y0) > 10) { clearTimeout(holdTimer); drag = null; }
      return;
    }
    e.preventDefault();
    update(t.clientX, t.clientY);
  }, { passive: false });
  grid.addEventListener('touchend', (e) => {
    if (drag && drag.active) e.preventDefault();
    end();
  }, { passive: false });
  grid.addEventListener('touchcancel', () => { clearTimeout(holdTimer); if (drag && drag.active) render(); drag = null; });
}

// Apply {date, who, start, end, ...} to an instance. scope 'day' detaches a series instance
// into an override; scope 'series' edits the master.
async function commitInstanceChange(inst, changes, scope) {
  const now = new Date().toISOString();
  if (inst.virtual && scope === 'day') {
    state.data.events = detachInstance(state.data.events, inst, changes, now);
  } else if (inst.seriesId && scope === 'series') {
    const { date, status, ...seriesChanges } = changes;
    state.data.events = state.data.events.map((e) => (e.id === inst.seriesId ? { ...e, ...seriesChanges, updated: now } : e));
  } else {
    const updated = { ...inst, ...changes, updated: now };
    delete updated.virtual;
    const i = state.data.events.findIndex((e) => e.id === inst.id);
    if (i >= 0) state.data.events[i] = updated; else state.data.events.push(updated);
    state.data.events = sortEvents(state.data.events);
  }
  render();
  const who = T.persons[changes.who || inst.who];
  await save(`${changes.date || inst.date} ${T.types[changes.type || inst.type]} ${changes.start || inst.start}–${changes.end || inst.end} (${who})`);
}

// ---------- sheets ----------
function openEditor(ev, isNew) { state.sheet = { kind: 'editor', ev, isNew, scope: 'day' }; render(); }
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

function renderEditor(sheet) {
  const { ev, isNew } = sheet;
  const master = ev.seriesId ? state.data.events.find((e) => e.id === ev.seriesId) : null;
  const inSeries = Boolean(master);
  const seriesMode = () => inSeries && sheet.scope === 'series';
  const repeatSource = seriesMode() ? master : ev;
  const repeatDays = repeatSource.repeat?.days || [];
  const repeatUntil = repeatSource.repeat?.until || '';

  const dayChips = T.days.map((d, i) => h('label', { class: 'chip' },
    h('input', { type: 'checkbox', name: `rep-${i + 1}`, checked: repeatDays.includes(i + 1) }), d));
  const repeatRow = h('div', { class: 'repeat' },
    h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' },
      h('span', { class: 'hint' }, T.editor.repeat),
      h('button', { type: 'button', class: 'small', onclick: () => { for (let i = 1; i <= 7; i++) f.elements[`rep-${i}`].checked = i <= 5; } }, T.editor.workdays)),
    h('div', { class: 'days' }, ...dayChips),
    h('label', {}, T.editor.until, h('input', { name: 'until', type: 'date', value: repeatUntil })));

  const dateLabel = h('label', {}, T.editor.date, h('input', { name: 'date', type: 'date', value: ev.date, required: true }));
  const doneLabel = h('label', { class: 'check' }, h('input', { name: 'done', type: 'checkbox', checked: ev.status === 'tehtud' }), T.editor.done);

  const applyScopeVisibility = () => {
    const series = seriesMode();
    repeatRow.hidden = inSeries && !series;
    dateLabel.hidden = series;
    doneLabel.hidden = series;
    if (series) {
      for (let i = 1; i <= 7; i++) f.elements[`rep-${i}`].checked = (master.repeat?.days || []).includes(i);
      f.elements.until.value = master.repeat?.until || '';
      f.elements.start.value = master.start; f.elements.end.value = master.end;
      f.elements.who.value = master.who; f.elements.type.value = master.type; f.elements.note.value = master.note || '';
    } else {
      f.elements.start.value = ev.start; f.elements.end.value = ev.end;
      f.elements.who.value = ev.who; f.elements.type.value = ev.type; f.elements.note.value = ev.note || '';
    }
  };

  const scopeRow = inSeries ? h('div', { class: 'scope' },
    h('p', { class: 'hint' }, T.editor.seriesHint),
    h('label', { class: 'chip' }, h('input', { type: 'radio', name: 'scope', value: 'day', checked: sheet.scope === 'day', onchange: () => { sheet.scope = 'day'; applyScopeVisibility(); } }), T.editor.scopeDay),
    h('label', { class: 'chip' }, h('input', { type: 'radio', name: 'scope', value: 'series', checked: sheet.scope === 'series', onchange: () => { sheet.scope = 'series'; applyScopeVisibility(); } }), T.editor.scopeSeries)) : null;

  const f = h('form', { class: 'editor', onsubmit: (e) => { e.preventDefault(); submitEditor(f, ev, isNew, inSeries ? sheet.scope : 'day', master); } },
    h('h2', {}, isNew ? T.editor.new : T.editor.edit),
    scopeRow,
    dateLabel,
    h('div', { class: 'row' },
      h('label', {}, T.editor.start, h('input', { name: 'start', type: 'time', step: 900, value: ev.start, required: true })),
      h('label', {}, T.editor.end, h('input', { name: 'end', type: 'time', step: 900, value: ev.end, required: true }))),
    h('label', {}, T.editor.who, select('who', [['jürgen', T.persons['jürgen']], ['eike', T.persons.eike], ['both', T.persons.both]], ev.who)),
    h('label', {}, T.editor.type, select('type', TYPES.map((t) => [t, T.types[t]]), ev.type)),
    h('label', {}, T.editor.note, h('input', { name: 'note', value: ev.note || '', list: 'sitters' }),
      h('datalist', { id: 'sitters' }, ...(state.data.settings.sitters || []).map((n) => h('option', { value: n })))),
    doneLabel,
    repeatRow,
    h('p', { class: 'error', 'data-err': true }),
    h('div', { class: 'btns' },
      isNew ? null : h('button', { type: 'button', class: 'danger', onclick: () => deleteFromEditor(ev, inSeries ? sheet.scope : 'day', master) }, T.editor.delete),
      h('button', { type: 'button', onclick: closeSheet }, T.editor.cancel),
      h('button', { type: 'submit', class: 'primary' }, T.editor.save)));
  applyScopeVisibility();
  return f;
}

function readRepeat(f) {
  const days = [];
  for (let i = 1; i <= 7; i++) if (f.elements[`rep-${i}`].checked) days.push(i);
  if (!days.length) return null;
  return { days, until: f.elements.until.value || null };
}

async function submitEditor(f, orig, isNew, scope, master) {
  if (toMinutes(f.end.value) <= toMinutes(f.start.value)) { f.querySelector('[data-err]').textContent = T.editor.endBeforeStart; return; }
  const now = new Date().toISOString();
  const fields = { start: f.start.value, end: f.end.value, who: f.who.value, type: f.type.value, note: f.note.value.trim() };

  if (master && scope === 'series') {
    const repeat = readRepeat(f);
    state.data.events = state.data.events.map((e) => (e.id === master.id
      ? (repeat ? { ...e, ...fields, repeat, updated: now } : { ...e, ...fields, repeat: undefined, exdates: undefined, updated: now })
      : e));
    closeSheet();
    await save(`seeria ${T.types[fields.type]} ${fields.start}–${fields.end} (${T.persons[fields.who]})`);
    return;
  }

  const changes = { ...fields, date: f.date.value, status: f.done.checked ? 'tehtud' : 'plaan' };
  if (orig.virtual) {
    state.data.events = detachInstance(state.data.events, orig, changes, now);
  } else {
    const repeat = master ? undefined : readRepeat(f);
    const ev = { ...orig, ...changes, updated: now };
    if (repeat) { ev.repeat = repeat; ev.exdates = orig.exdates || []; } else { delete ev.repeat; delete ev.exdates; }
    const i = state.data.events.findIndex((e) => e.id === ev.id);
    if (i >= 0) state.data.events[i] = ev; else state.data.events.push(ev);
    state.data.events = sortEvents(state.data.events);
  }
  closeSheet();
  await save(`${changes.date} ${T.types[changes.type]} ${changes.start}–${changes.end} (${T.persons[changes.who]})`);
}

async function deleteFromEditor(ev, scope, master) {
  const now = new Date().toISOString();
  if (master && scope === 'series') {
    state.data.events = deleteSeries(state.data.events, master.id);
    closeSheet();
    await save(`kustutas seeria ${T.types[master.type]} ${master.start}–${master.end}`);
    return;
  }
  if (ev.seriesId && master) {
    // virtual instance or override: hide this date from the series
    state.data.events = excludeDate(state.data.events, master.id, ev.origDate || ev.date, now);
    if (!ev.virtual) state.pendingDeletes.add(ev.id);
  } else {
    state.data.events = state.data.events.filter((e) => e.id !== ev.id);
    state.pendingDeletes.add(ev.id);
  }
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
  const today = todayStr();
  const status = s.date < today ? 'tehtud' : 'plaan';
  state.data.events = applyPreset(state.data.events, key, s.date, state.data.settings, { sitter: s.sitter, status, now: new Date().toISOString(), today });
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
