import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, calendarDateKey, calendarDays, calendarDisplayValue, calendarInitialSelection, calendarValue, parseCalendarDate, parseCalendarValue } from './orderCalendar.js';

test('calendar rejects invalid dates and accepts Gregorian leap days', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '1900-02-29', '0000-01-01', 'date']) assert.equal(parseCalendarDate(value), null);
  for (const value of ['2000-02-29', '2028-02-29', '0001-01-01', '9999-12-31']) assert.equal(calendarDateKey(parseCalendarDate(value)), value);
});

test('month grid starts on Monday and includes every day through adjacent months', () => {
  const days = calendarDays(2028, 1);
  assert.equal(days.length, 42);
  assert.equal(days[0].date.getDay(), 1);
  assert.equal(days.filter(day => day.currentMonth).length, 29);
  assert.equal(new Set(days.map(day => day.key)).size, 42);
  assert.equal(days.at(-1).date.getDay(), 0);
  assert.equal(days.filter(day => day.key === '2028-02-29').length, 1);
  assert.equal(calendarDays(1, 0).find(day => day.key === '0001-01-01').valid, true);
  assert.equal(calendarDays(9999, 11).find(day => day.date.getFullYear() === 10000).valid, false);
});

test('calendar preserves local date and time in the existing API format', () => {
  assert.equal(calendarValue('2028-02-29', '9', '5'), '2028-02-29T09:05');
  assert.deepEqual(parseCalendarValue('2028-02-29T09:05'), { date: '2028-02-29', hour: '09', minute: '05' });
  assert.deepEqual(parseCalendarValue('2028-02-29 09:05'), parseCalendarValue('2028-02-29T09:05'));
  assert.equal(calendarDisplayValue('2028-02-29T09:05'), '29.02.2028 09:05');
  assert.equal(calendarDisplayValue(''), '');
  assert.equal(calendarDateKey(calendarDate(2026, 9, 5)), '2026-10-05');
});

test('calendar cannot apply incomplete or out-of-range time values', () => {
  for (const [hour, minute] of [['24', '00'], ['23', '60'], ['', '05'], ['09', ''], ['-1', '0'], ['1.5', '0'], ['12', 'abc']]) assert.equal(calendarValue('2026-10-05', hour, minute), null);
  assert.equal(calendarValue('2026-02-30', '00', '00'), null);
  assert.equal(parseCalendarValue('2026-10-05T24:00'), null);
  assert.equal(parseCalendarValue('2026-10-05T23:60'), null);
  assert.equal(calendarValue('2026-10-05', '23', '59'), '2026-10-05T23:59');
});

test('empty boundaries default to the current day with full-day times; saved values take priority', () => {
  const now = calendarDate(2032, 7, 12);
  assert.deepEqual(calendarInitialSelection('', 'from', now), { date: '2032-08-12', hour: '00', minute: '00' });
  assert.deepEqual(calendarInitialSelection('', 'to', now), { date: '2032-08-12', hour: '23', minute: '59' });
  assert.deepEqual(calendarInitialSelection('2026-10-05T14:30', 'to', now), { date: '2026-10-05', hour: '14', minute: '30' });
});
