const pad = value => String(value).padStart(2, '0');

export const calendarDate = (year, month, day) => {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
};

export const calendarDateKey = date => `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseCalendarDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match || Number(match[1]) < 1) return null;
  const [, year, month, day] = match.map(Number);
  const date = calendarDate(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const parseCalendarValue = value => {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match || !parseCalendarDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59) return null;
  return { date: match[1], hour: match[2], minute: match[3] };
};

export const calendarValue = (date, hour, minute) => {
  if (!parseCalendarDate(date) || !/^\d{1,2}$/.test(String(hour)) || !/^\d{1,2}$/.test(String(minute))
    || Number(hour) > 23 || Number(minute) > 59) return null;
  return `${date}T${pad(Number(hour))}:${pad(Number(minute))}`;
};

export const calendarDays = (year, month) => {
  const first = calendarDate(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = calendarDate(year, month, 1 - offset + index);
    return { date, key: calendarDateKey(date), currentMonth: date.getMonth() === month, valid: date.getFullYear() >= 1 && date.getFullYear() <= 9999 };
  });
};

export const calendarInitialSelection = (value, boundary, now = new Date()) => parseCalendarValue(value) || {
  date: calendarDateKey(now), hour: boundary === 'to' ? '23' : '00', minute: boundary === 'to' ? '59' : '00',
};

export const calendarDisplayValue = value => {
  const parsed = parseCalendarValue(value);
  if (!parsed) return '';
  const [year, month, day] = parsed.date.split('-');
  return `${day}.${month}.${year} ${parsed.hour}:${parsed.minute}`;
};
