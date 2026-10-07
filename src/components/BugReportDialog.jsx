import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bug, Check, ChevronDown, Copy, FileText, Image as ImageIcon, Info, Loader2, Paperclip, X } from 'lucide-react';

import {
  CATEGORY_LABELS,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  SEVERITY_LABELS,
  fetchBugReportOptions,
  submitBugReport,
  validateAttachment,
} from '../services/bugReport.service';
import './BugReportDialog.css';

// Kept low on purpose, and matched by the control plane. The first live test
// reports ("check", "check ing") were blocked by a 10-character minimum the
// form never mentioned; only an empty-ish field is worth refusing.
const MIN_TITLE_LENGTH = 3;
const MIN_DESCRIPTION_LENGTH = 3;
const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'other',
  severity: 'medium',
  steps: '',
  expected: '',
  actual: '',
};

const labelClass = 'bug-report-label';
const fieldClass = 'bug-report-field';

/**
 * Report a Bug.
 *
 * The form asks for the minimum a reader needs to reproduce a fault, and
 * collects the technical context automatically rather than making the reporter
 * describe their own browser. Everything beyond title and description sits
 * behind a disclosure, so filing a quick report stays quick.
 */
export default function BugReportDialog({ onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState([]);
  const [options, setOptions] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);

  useEffect(() => {
    let active = true;
    fetchBugReportOptions()
      .then((loaded) => { if (active) setOptions(loaded); })
      .catch(() => { if (active) setOptions({ enabled: true }); });
    return () => { active = false; };
  }, []);

  const addFiles = useCallback((incoming) => {
    const candidates = Array.from(incoming || []);
    if (!candidates.length) return;
    setError(null);
    setAttachments((current) => {
      const next = [...current];
      for (const file of candidates) {
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`At most ${MAX_ATTACHMENTS} attachments`);
          break;
        }
        const problem = validateAttachment(file);
        if (problem) { setError(problem); continue; }
        next.push(file);
      }
      return next;
    });
  }, []);

  // Paste-to-attach. Most people take a screenshot with the OS shortcut and
  // have it on the clipboard already; asking them to save it to disk first is
  // the step that stops reports being filed.
  const onPaste = (event) => {
    if (submitting) return;
    const items = Array.from(event.clipboardData?.items || []);
    const images = items.filter((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (!images.length) return;
    event.preventDefault();
    addFiles(images.map((item, index) => {
      const blob = item.getAsFile();
      if (!blob) return null;
      const extension = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      return new File([blob], `pasted-${Date.now()}-${index}.${extension}`, { type: blob.type });
    }).filter(Boolean));
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const titleLength = form.title.trim().length;
  const descriptionLength = form.description.trim().length;
  const canSubmit = titleLength >= MIN_TITLE_LENGTH && descriptionLength >= MIN_DESCRIPTION_LENGTH && !submitting;
  // A disabled button with no reason is what stopped the first reports.
  const submitHint = titleLength < MIN_TITLE_LENGTH
      ? `Add a title (at least ${MIN_TITLE_LENGTH} characters) to send the report.`
      : descriptionLength < MIN_DESCRIPTION_LENGTH
          ? `Describe what happened (at least ${MIN_DESCRIPTION_LENGTH} characters) to send the report.`
          : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitBugReport({ form, attachments });
      setReceipt(result);
    } catch (submitError) {
      setError(submitError?.message || 'The report could not be submitted');
    } finally {
      setSubmitting(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(receipt.report_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable; the id is on screen to read */ }
  };

  const storageDisabled = options && options.enabled === false;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !submitting) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="bug-report-overlay" />
        <Dialog.Content
          ref={dialogRef}
          className="bug-report-dialog"
          onPaste={onPaste}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogRef.current?.querySelector('#bug-title')?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus?.();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (submitting) event.preventDefault(); }}
        >
          <header className="bug-report-header">
            <span className="bug-report-header-icon"><Bug size={17} strokeWidth={1.7} aria-hidden="true" /></span>
            <div className="bug-report-heading">
              <Dialog.Title className="bug-report-title">Report a bug</Dialog.Title>
              <Dialog.Description className="bug-report-subtitle">Share an issue with the RTX5 platform team.</Dialog.Description>
            </div>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Close report dialog" className="bug-report-icon-button">
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          {receipt ? (
            <div className="bug-report-receipt">
              <div className="bug-report-receipt-icon">
                <Check size={20} aria-hidden="true" />
              </div>
              <h3>Bug report submitted</h3>
              <p className="bug-report-help">
                The RTX5 platform team can see this report. Quote this reference if you follow it up.
              </p>
              <div className="bug-report-reference">
                <code>{receipt.report_id}</code>
                <button type="button" onClick={copyId} aria-label="Copy report id" className="bug-report-icon-button">
                  {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                </button>
              </div>
              {receipt.failed_attachments?.length ? (
                <p className="bug-report-notice bug-report-notice--warning" role="status">
                  The report was filed, but {receipt.failed_attachments.length} attachment
                  {receipt.failed_attachments.length === 1 ? '' : 's'} could not be uploaded.
                </p>
              ) : null}
              <div className="bug-report-receipt-action">
                <button type="button" onClick={onClose} className="bug-report-button">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bug-report-form">
              <div className="bug-report-body">
                {storageDisabled ? (
                  <p className="bug-report-notice bug-report-notice--warning" role="status">
                    Bug reporting is not configured on this server yet. Submitting will not work until an administrator enables it.
                  </p>
                ) : null}

                <div className="bug-report-form-group">
                  <label className={labelClass} htmlFor="bug-title">Title <span className="bug-report-required" aria-hidden="true">*</span></label>
                  <input
                    id="bug-title" className={fieldClass} value={form.title} onChange={update('title')}
                    placeholder="Order rejected although the quote is live" maxLength={200} required
                    disabled={submitting}
                  />
                </div>

                <div className="bug-report-form-group">
                  <label className={labelClass} htmlFor="bug-description">What happened? <span className="bug-report-required" aria-hidden="true">*</span></label>
                  <textarea
                    id="bug-description" className={`${fieldClass} bug-report-description`}
                    value={form.description} onChange={update('description')}
                    placeholder="Describe what you were doing and what went wrong." maxLength={8000} required
                    disabled={submitting}
                  />
                </div>

                <div className="bug-report-columns">
                  <div className="bug-report-form-group">
                    <label className={labelClass} htmlFor="bug-category">Area</label>
                    <select id="bug-category" className={fieldClass} value={form.category} onChange={update('category')} disabled={submitting}>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bug-report-form-group">
                    <label className={labelClass} htmlFor="bug-severity">Severity</label>
                    <select id="bug-severity" className={fieldClass} value={form.severity} onChange={update('severity')} disabled={submitting}>
                      {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <section className="bug-report-attachments" aria-labelledby="bug-attachments-title">
                  <div className="bug-report-section-heading">
                    <h3 id="bug-attachments-title">Screenshots and logs</h3>
                    <span className="bug-report-help">Optional · {attachments.length}/{MAX_ATTACHMENTS} files</span>
                  </div>
                  <div className="bug-report-upload-row">
                    <div className="bug-report-upload-copy">
                      <span className="bug-report-upload-icon"><Paperclip size={17} strokeWidth={1.6} aria-hidden="true" /></span>
                      <div><p>Attach a file or paste a screenshot</p><p className="bug-report-help">PNG, JPG, WebP, TXT or LOG · Up to {MAX_FILE_BYTES / (1024 * 1024)} MB each</p></div>
                    </div>
                    <button
                      type="button" onClick={() => fileInputRef.current?.click()}
                      disabled={submitting || attachments.length >= MAX_ATTACHMENTS}
                      className="bug-report-button"
                    >
                      <Paperclip size={13} aria-hidden="true" /> Attach file
                    </button>
                  </div>
                  <input
                    ref={fileInputRef} type="file" multiple hidden
                    disabled={submitting}
                    accept="image/png,image/jpeg,image/webp,text/plain,.log,.txt"
                    onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
                  />
                  {attachments.length ? (
                    <ul className="bug-report-file-list">
                      {attachments.map((file, index) => (
                        <li key={`${file.name}-${index}`}>
                          <span className="bug-report-file-name">
                            {file.type.startsWith('image/') ? <ImageIcon size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                            <span title={file.name}>{file.name}</span>
                          </span>
                          <span className="bug-report-file-size">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                          <button
                            type="button" aria-label={`Remove ${file.name}`}
                            onClick={() => {
                              setAttachments((current) => current.filter((_, i) => i !== index));
                              setError(null);
                            }}
                            disabled={submitting}
                            className="bug-report-icon-button"
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {/* Stated plainly, because a screenshot of this UI can contain
                      client names, balances and open positions. */}
                  <p className="bug-report-help bug-report-attachment-note">
                    Paste with Ctrl+V. Attachments are shared with the platform team; remove sensitive details first.
                  </p>
                </section>

                <button
                  type="button" onClick={() => setShowDetails((value) => !value)}
                  className="bug-report-disclosure"
                  aria-expanded={showDetails}
                  aria-controls="bug-reproduction-details"
                  disabled={submitting}
                >
                  <span><span className="bug-report-disclosure-label">Reproduction details <span className="bug-report-help">Optional</span></span><span className="bug-report-help">Steps to reproduce, expected result and actual result</span></span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>

                {showDetails ? (
                  <div id="bug-reproduction-details" className="bug-report-details">
                    <div className="bug-report-form-group">
                      <label className={labelClass} htmlFor="bug-steps">Steps to reproduce (one per line)</label>
                      <textarea id="bug-steps" className={fieldClass} value={form.steps} onChange={update('steps')} placeholder={'Open EURUSD\nClick Buy\nOrder is rejected'} disabled={submitting} />
                    </div>
                    <div className="bug-report-columns">
                      <div className="bug-report-form-group">
                        <label className={labelClass} htmlFor="bug-expected">Expected</label>
                        <textarea id="bug-expected" className={fieldClass} value={form.expected} onChange={update('expected')} placeholder="What should happen?" disabled={submitting} />
                      </div>
                      <div className="bug-report-form-group">
                        <label className={labelClass} htmlFor="bug-actual">Actual</label>
                        <textarea id="bug-actual" className={fieldClass} value={form.actual} onChange={update('actual')} placeholder="What happened instead?" disabled={submitting} />
                      </div>
                    </div>
                  </div>
                ) : null}

                <p className="bug-report-environment">
                  <Info size={14} aria-hidden="true" />
                  <span>
                    Your application version, browser, operating system and current screen are attached automatically.
                    Passwords and session tokens are never included.
                  </span>
                </p>

                {error ? (
                  <p role="alert" className="bug-report-notice bug-report-notice--error">{error}</p>
                ) : null}
              </div>
              <footer className="bug-report-footer">
                <p className="bug-report-submit-hint" id="bug-submit-hint" role="status">{submitting ? 'Sending your report…' : submitHint || 'Ready to send to the platform team.'}</p>
                <div className="bug-report-actions">
                  <button type="button" onClick={onClose} disabled={submitting} className="bug-report-button">
                    Cancel
                  </button>
                  <button type="submit" disabled={!canSubmit} aria-describedby="bug-submit-hint" className="bug-report-button bug-report-button--primary">
                    {submitting && <Loader2 size={13} className="bug-report-spinner" aria-hidden="true" />}
                    {submitting ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </footer>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
