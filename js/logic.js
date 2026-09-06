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
  const isEvening = (ev) => ev.date === date && ev.type !== 'töö' && toMinutes(ev.start) >= eveningStart;
  let out = events;
  for (const inst of expandEvents(events, [date], opts.today)) {
    if (!isEvening(inst)) continue;
    if (inst.virtual) out = excludeDate(out, inst.seriesId, date, opts.now);
    else out = out.filter((ev) => ev.id !== inst.id);
  }
  return sortEvents([...out, ...preset.build(date, opts)]);
}

// ---------- series ----------
// A master event with `repeat: { days: [1..7], until }` is never shown itself; expandEvents
// turns it into one virtual instance per matching date. `exdates` skips dates. An override is
// a normal event with `seriesId` + `origDate` that replaces the virtual instance for that date.

function instanceStatus(date, today) {
  return date < today ? 'tehtud' : 'plaan';
}

export function expandEvents(events, dates, today = todayStr()) {
  const overrides = new Set(events.filter((e) => e.seriesId && e.origDate).map((e) => `${e.seriesId}@${e.origDate}`));
  const dateSet = new Set(dates);
  const out = [];
  for (const ev of events) {
    if (!ev.repeat) {
      if (dateSet.has(ev.date)) out.push(ev);
      continue;
    }
    const ex = new Set(ev.exdates || []);
    for (const d of dates) {
      if (d < ev.date) continue;
      if (ev.repeat.until && d > ev.repeat.until) continue;
      if (!ev.repeat.days.includes(dayOfWeek(d))) continue;
      if (ex.has(d) || overrides.has(`${ev.id}@${d}`)) continue;
      const { repeat, exdates, ...rest } = ev;
      out.push({ ...rest, id: `${ev.id}@${d}`, date: d, seriesId: ev.id, origDate: d, virtual: true, status: instanceStatus(d, today) });
    }
  }
  return sortEvents(out);
}

export function excludeDate(events, masterId, date, now = new Date().toISOString()) {
  return events
    .filter((ev) => !(ev.seriesId === masterId && ev.origDate === date))
    .map((ev) => (ev.id === masterId
      ? { ...ev, exdates: [...new Set([...(ev.exdates || []), date])].sort(), updated: now }
      : ev));
}

export function detachInstance(events, instance, changes, now = new Date().toISOString()) {
  const { virtual, ...base } = instance;
  const override = { ...base, ...changes, id: newId(), seriesId: instance.seriesId, origDate: instance.origDate, updated: now };
  delete override.repeat;
  delete override.exdates;
  return sortEvents([...events, override]);
}

export function deleteSeries(events, masterId) {
  return events.filter((ev) => ev.id !== masterId && ev.seriesId !== masterId);
}

// ---------- drag math ----------
export function snap15(min) {
  return Math.round(min / 15) * 15;
}

export function moveEvent(ev, deltaMin, dayStartMin, dayEndMin) {
  const dur = toMinutes(ev.end) - toMinutes(ev.start);
  let start = snap15(toMinutes(ev.start) + deltaMin);
  start = Math.max(dayStartMin, Math.min(dayEndMin - dur, start));
  return { start: fromMinutes(start), end: fromMinutes(start + dur) };
}

export function resizeEvent(ev, deltaMin, dayEndMin) {
  const startMin = toMinutes(ev.start);
  let end = snap15(toMinutes(ev.end) + deltaMin);
  end = Math.max(startMin + 15, Math.min(dayEndMin, end));
  return { start: ev.start, end: fromMinutes(end) };
}

function personsOf(ev) {
  return ev.who === 'both' ? PERSONS : [ev.who];
}

export function summarize(events, dates, today = todayStr()) {
  const out = {};
  for (const p of PERSONS) {
    out[p] = {};
    for (const t of TYPES) out[p][t] = { plaan: 0, tehtud: 0 };
  }
  for (const ev of expandEvents(events, dates, today)) {
    if (!TYPES.includes(ev.type)) continue;
    const h = durationHours(ev);
    for (const p of personsOf(ev)) {
      if (out[p]) out[p][ev.type][ev.status === 'tehtud' ? 'tehtud' : 'plaan'] += h;
    }
  }
  return out;
}

export function balanceOverWeeks(events, weekStartStr, n = 4, today = todayStr()) {
  const first = addDays(weekStart(weekStartStr), -7 * (n - 1));
  const dates = Array.from({ length: 7 * n }, (_, i) => addDays(first, i));
  const out = { 'jürgen': 0, eike: 0 };
  for (const ev of expandEvents(events, dates, today)) {
    if (ev.type !== 'vaba') continue;
    for (const p of personsOf(ev)) if (p in out) out[p] += durationHours(ev);
  }
  out.diff = out['jürgen'] - out.eike;
  return out;
}

export function eveningOverview(events, dates, settings, today = todayStr()) {
  const eveningStart = toMinutes(settings.eveningStart || '17:00');
  const expanded = expandEvents(events, dates, today);
  return dates.map((date) => {
    const evs = expanded.filter((ev) => ev.date === date && ev.type !== 'töö' && toMinutes(ev.start) >= eveningStart);
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
