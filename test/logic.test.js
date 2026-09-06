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
  const out = fillWork([existing], dates, settings, NOW, '2026-09-02');
  const work = out.filter((e) => e.type === 'töö');
  assert.equal(work.length, 10); // 5 days x 2 persons
  assert.ok(work.filter((e) => e.date < '2026-09-02' && e.id !== existing.id).every((e) => e.status === 'tehtud'));
  assert.ok(work.filter((e) => e.date >= '2026-09-02').every((e) => e.status === 'plaan'));
  assert.ok(work.some((e) => e.id === existing.id && e.start === '10:00'));
  assert.equal(work.filter((e) => e.date === '2026-09-05').length, 0); // Saturday
  assert.equal(work.filter((e) => e.date === '2026-08-31' && e.who === 'jürgen').length, 1);
  // idempotent
  assert.equal(fillWork(out, dates, settings, NOW, '2026-09-02').length, out.length);
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
