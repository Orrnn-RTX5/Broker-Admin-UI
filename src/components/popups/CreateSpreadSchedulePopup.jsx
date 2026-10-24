import React, { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, AlertCircle, X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import SpreadSymbolPicker from './SpreadSymbolPicker';
import { getApiErrorMessage } from '../../utils/apiShapes';
import './CreateSpreadSchedulePopup.css';

const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CreateSpreadSchedulePopup = ({ onClose, onCreated, initialSymbol = '' }) => {
  const [formData, setFormData] = useState({ symbol: initialSymbol, group_name: 'default', day_of_week: 1, time_from: '08:00', time_to: '17:00', spread_override: 20 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);

  const handleChange = event => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await ManagerService.createSpreadSchedule({ ...formData, day_of_week: Number(formData.day_of_week), spread_override: Number(formData.spread_override) });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create spread schedule.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !isSubmitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="spread-form-overlay" />
        <Dialog.Content ref={dialogRef} className="spread-form-dialog" aria-describedby={undefined}
          onInteractOutside={event => event.preventDefault()}
          onEscapeKeyDown={event => { if (isSubmitting || dialogRef.current?.querySelector('[data-symbol-picker-open="true"]')) event.preventDefault(); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); }}>
          <header className="spread-form-heading">
            <Dialog.Title><Activity size={16} aria-hidden="true" />Create Spread Schedule</Dialog.Title>
            <Dialog.Close className="spread-form-close" aria-label="Close spread schedule form" disabled={isSubmitting}><X size={18} aria-hidden="true" /></Dialog.Close>
          </header>
          <form className="spread-form" onSubmit={handleSubmit}>
            <div className="spread-form-body">
              {error && <div className="spread-form-error" role="alert"><AlertCircle size={14} aria-hidden="true" /><span>{error}</span></div>}
              <div className="spread-form-grid">
                <div className="spread-form-field">
                  <label htmlFor="spread-symbol">Symbol <span>Required</span></label>
                  <SpreadSymbolPicker value={formData.symbol} onChange={symbol => setFormData(prev => ({ ...prev, symbol }))} disabled={isSubmitting} />
                </div>
                <div className="spread-form-field">
                  <label htmlFor="spread-group">Group name</label>
                  <input id="spread-group" type="text" name="group_name" value={formData.group_name} onChange={handleChange} disabled={isSubmitting} />
                </div>
                <div className="spread-form-field is-full">
                  <label htmlFor="spread-day">Day of week</label>
                  <select id="spread-day" name="day_of_week" value={formData.day_of_week} onChange={handleChange} disabled={isSubmitting}>
                    {DAY_OPTIONS.map((day, value) => <option key={day} value={value}>{day}</option>)}
                  </select>
                </div>
                <div className="spread-form-field">
                  <label htmlFor="spread-start">Start time</label>
                  <input id="spread-start" type="time" name="time_from" value={formData.time_from} onChange={handleChange} disabled={isSubmitting} />
                </div>
                <div className="spread-form-field">
                  <label htmlFor="spread-end">End time</label>
                  <input id="spread-end" type="time" name="time_to" value={formData.time_to} onChange={handleChange} disabled={isSubmitting} />
                </div>
                <div className="spread-form-field is-full">
                  <label htmlFor="spread-override">Spread override (pts)</label>
                  <input id="spread-override" type="number" name="spread_override" value={formData.spread_override} onChange={handleChange} min="0" step="1" disabled={isSubmitting} />
                </div>
              </div>
            </div>
            <footer className="spread-form-footer">
              <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="is-primary" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Schedule'}</button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CreateSpreadSchedulePopup;
