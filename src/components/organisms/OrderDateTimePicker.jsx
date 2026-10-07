import React, { useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { calendarDate, calendarDateKey, calendarDays, calendarDisplayValue, calendarInitialSelection, calendarValue, parseCalendarDate } from '../../utils/orderCalendar';
import './OrderDateTimePicker.css';

const months = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(calendarDate(2020, month, 1)));
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dateLabel = date => new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(date);

const CalendarPanel = ({ value, boundary, label, anchorRef, onChange, onClose }) => {
  const [draft, setDraft] = useState(() => calendarInitialSelection(value, boundary));
  const [view, setView] = useState(() => {
    const date = parseCalendarDate(draft.date);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [focusedDate, setFocusedDate] = useState(draft.date);
  const [error, setError] = useState('');
  const contentRef = useRef(null);
  const dayRefs = useRef(new Map());
  const focusRequested = useRef(false);
  const days = calendarDays(view.year, view.month);
  const today = calendarDateKey(new Date());
  const activeDate = days.some(day => day.key === focusedDate && day.valid) ? focusedDate : calendarDateKey(calendarDate(view.year, view.month, 1));

  useLayoutEffect(() => {
    const position = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = contentRef.current;
      if (!anchor || !panel) return;
      panel.style.maxHeight = `${Math.max(100, window.innerHeight - 24)}px`;
      const box = panel.getBoundingClientRect();
      const left = Math.max(12, Math.min(anchor.right - box.width, window.innerWidth - box.width - 12));
      const below = anchor.bottom + 6;
      const top = below + box.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - box.height - 6);
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.min(top, window.innerHeight - box.height - 12)}px`;
      panel.style.visibility = 'visible';
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(contentRef.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (focusRequested.current) { dayRefs.current.get(focusedDate)?.focus(); focusRequested.current = false; }
  }, [focusedDate, view]);

  const moveMonth = amount => {
    const next = calendarDate(view.year, view.month + amount, 1);
    if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) setView({ year: next.getFullYear(), month: next.getMonth() });
  };
  const selectDate = date => {
    setDraft(current => ({ ...current, date: calendarDateKey(date) }));
    setFocusedDate(calendarDateKey(date));
    setView({ year: date.getFullYear(), month: date.getMonth() });
    setError('');
  };
  const handleDayKey = (event, date) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (event.key in offsets) next = calendarDate(date.getFullYear(), date.getMonth(), date.getDate() + offsets[event.key]);
    else if (event.key === 'Home') next = calendarDate(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
    else if (event.key === 'End') next = calendarDate(date.getFullYear(), date.getMonth(), date.getDate() + 6 - (date.getDay() + 6) % 7);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const month = date.getMonth() + (event.key === 'PageUp' ? -1 : 1);
      const last = calendarDate(date.getFullYear(), month + 1, 0).getDate();
      next = calendarDate(date.getFullYear(), month, Math.min(date.getDate(), last));
    }
    if (!next) return;
    event.preventDefault();
    if (next.getFullYear() < 1 || next.getFullYear() > 9999) return;
    focusRequested.current = true;
    setFocusedDate(calendarDateKey(next));
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };
  const apply = () => {
    const next = calendarValue(draft.date, draft.hour, draft.minute);
    if (!next) { setError('Enter an hour from 00–23 and minutes from 00–59.'); return; }
    onChange(next);
    onClose();
  };

  return (
    <Dialog.Content ref={contentRef} className="order-calendar-popover" onOpenAutoFocus={event => { event.preventDefault(); dayRefs.current.get(activeDate)?.focus(); }}>
      <div className="order-calendar-titlebar">
        <Dialog.Title>{label} date &amp; time</Dialog.Title>
        <Dialog.Close asChild><button type="button" aria-label="Cancel date selection" className="order-calendar-icon"><X size={14} /></button></Dialog.Close>
      </div>
      <Dialog.Description className="order-calendar-sr-only">Choose a date and local time, then select Apply. Use arrow keys to navigate dates.</Dialog.Description>
      <div className="order-calendar-monthbar">
        <button type="button" aria-label="Previous month" className="order-calendar-icon" onClick={() => moveMonth(-1)} disabled={view.year === 1 && view.month === 0}><ChevronLeft size={15} /></button>
        <select aria-label="Calendar month" value={view.month} onChange={event => setView(current => ({ ...current, month: Number(event.target.value) }))}>{months.map((month, index) => <option value={index} key={month}>{month}</option>)}</select>
        <input aria-label="Calendar year" type="number" min="1" max="9999" value={view.year} onChange={event => { const year = Number(event.target.value); if (Number.isInteger(year) && year >= 1 && year <= 9999) setView(current => ({ ...current, year })); }} />
        <button type="button" aria-label="Next month" className="order-calendar-icon" onClick={() => moveMonth(1)} disabled={view.year === 9999 && view.month === 11}><ChevronRight size={15} /></button>
      </div>
      <div role="grid" aria-label={`${months[view.month]} ${view.year}`} className="order-calendar-grid">
        <div role="row" className="order-calendar-weekdays">{weekdays.map(day => <span role="columnheader" key={day}>{day}</span>)}</div>
        {Array.from({ length: 6 }, (_, week) => (
          <div role="row" className="order-calendar-week" key={week}>
            {days.slice(week * 7, week * 7 + 7).map(day => (
              <div role="gridcell" aria-selected={day.key === draft.date} key={day.key}>
                <button type="button" ref={node => { if (node) dayRefs.current.set(day.key, node); else dayRefs.current.delete(day.key); }} aria-label={dateLabel(day.date)} aria-current={day.key === today ? 'date' : undefined} disabled={!day.valid} data-outside-month={!day.currentMonth} data-selected={day.key === draft.date} tabIndex={day.key === activeDate ? 0 : -1} onFocus={() => setFocusedDate(day.key)} onClick={() => selectDate(day.date)} onKeyDown={event => handleDayKey(event, day.date)}>{day.date.getDate()}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="order-calendar-time">
        <span>Time <small>Local</small></span>
        <label><span className="order-calendar-sr-only">Hour</span><input aria-label={`${label} hour`} type="text" inputMode="numeric" maxLength={2} value={draft.hour} onChange={event => { if (/^\d{0,2}$/.test(event.target.value)) { setDraft(current => ({ ...current, hour: event.target.value })); setError(''); } }} /></label>
        <span aria-hidden="true">:</span>
        <label><span className="order-calendar-sr-only">Minute</span><input aria-label={`${label} minute`} type="text" inputMode="numeric" maxLength={2} value={draft.minute} onChange={event => { if (/^\d{0,2}$/.test(event.target.value)) { setDraft(current => ({ ...current, minute: event.target.value })); setError(''); } }} /></label>
      </div>
      {error && <p role="alert" className="order-calendar-error">{error}</p>}
      <div className="order-calendar-actions">
        <button type="button" onClick={() => { onChange(''); onClose(); }}>Clear</button>
        <button type="button" onClick={() => selectDate(new Date())}>Today</button>
        <span />
        <Dialog.Close asChild><button type="button">Cancel</button></Dialog.Close>
        <button type="button" className="order-calendar-apply" onClick={apply}>Apply</button>
      </div>
    </Dialog.Content>
  );
};

const OrderDateTimePicker = ({ label, boundary, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const display = calendarDisplayValue(value);
  return (
    <Dialog.Root modal={false} open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" ref={anchorRef} className="admin-orders-date order-calendar-trigger" aria-label={`Select orders ${boundary} date`} title={display || `Select ${label.toLowerCase()} date and time`} data-value={value || ''}>
          <span className="order-calendar-trigger-label">{label}</span>
          <span className="order-calendar-trigger-value" data-empty={!display}>{display || 'Date & time'}</span>
          <Calendar size={13} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>{open && <CalendarPanel value={value} boundary={boundary} label={label} anchorRef={anchorRef} onChange={onChange} onClose={() => setOpen(false)} />}</Dialog.Portal>
    </Dialog.Root>
  );
};

export default OrderDateTimePicker;
