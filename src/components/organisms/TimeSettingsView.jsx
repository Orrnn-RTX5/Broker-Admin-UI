import React from 'react';
import { CalendarDays, Clock3, Globe2, Info, RefreshCcw, SunMoon } from 'lucide-react';
import './TimeSettingsView.css';

const TIME_REFERENCE = {
  zone: 'GMT+01:00',
  daylightSaving: 'Yes',
  synchronizationHosts: ['time.cloudflare.com', 'pool.ntp.org'],
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '00:00',
  closes: '24:00',
};

const OverviewItem = ({ icon, label, value, note }) => (
  <div className="admin-time-overview-item">
    <span className="admin-time-overview-icon" aria-hidden="true">{React.createElement(icon, { size: 17, strokeWidth: 1.75 })}</span>
    <div className="admin-time-overview-copy">
      <span className="admin-time-overview-label">{label}</span>
      <strong>{value}</strong>
      <span className="admin-time-overview-note">{note}</span>
    </div>
  </div>
);

const TimeSettingsView = () => (
  <main className="admin-time-view" aria-label="Time configuration">
    <div className="admin-time-layout">
      <div className="admin-time-intro">
        <div>
          <p className="admin-time-eyebrow">Server configuration</p>
          <h2>Time and weekly schedule</h2>
          <p className="admin-time-intro-description">A clear view of the time values currently listed in the administrator portal.</p>
        </div>
        <span className="admin-time-reference-badge"><Info size={15} strokeWidth={1.8} aria-hidden="true" /> Reference values</span>
      </div>

      <div className="admin-time-overview" aria-label="Time settings at a glance">
        <OverviewItem icon={Globe2} label="Time zone" value={TIME_REFERENCE.zone} note="Configured offset" />
        <OverviewItem icon={SunMoon} label="Daylight saving" value={TIME_REFERENCE.daylightSaving === 'Yes' ? 'Enabled' : 'Disabled'} note={`Correction: ${TIME_REFERENCE.daylightSaving}`} />
        <OverviewItem icon={RefreshCcw} label="Time sync" value="2 hosts" note="NTP sources listed" />
        <OverviewItem icon={CalendarDays} label="Weekly coverage" value="24/7" note="All seven days" />
      </div>

      <div className="admin-time-content">
        <section className="admin-time-panel admin-time-settings" aria-labelledby="admin-time-settings-heading">
          <div className="admin-time-panel-heading">
            <span className="admin-time-panel-icon" aria-hidden="true"><Clock3 size={18} strokeWidth={1.75} /></span>
            <div>
              <h3 id="admin-time-settings-heading">Clock settings</h3>
              <p>Time zone, daylight correction, and synchronization.</p>
            </div>
          </div>

          <dl className="admin-time-detail-list">
            <div className="admin-time-detail-row">
              <dt>Time zone</dt>
              <dd className="admin-time-mono">{TIME_REFERENCE.zone}</dd>
            </div>
            <div className="admin-time-detail-row">
              <dt>Daylight saving correction</dt>
              <dd><span className="admin-time-enabled-dot" aria-hidden="true" />{TIME_REFERENCE.daylightSaving}</dd>
            </div>
          </dl>

          <div className="admin-time-hosts">
            <div className="admin-time-hosts-heading">
              <RefreshCcw size={15} strokeWidth={1.75} aria-hidden="true" />
              <h4>Synchronization servers</h4>
            </div>
            <ol>
              {TIME_REFERENCE.synchronizationHosts.map((host, index) => (
                <li key={host}>
                  <span className="admin-time-host-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="admin-time-mono">{host}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="admin-time-panel admin-time-schedule" aria-labelledby="admin-time-schedule-heading">
          <div className="admin-time-panel-heading admin-time-schedule-heading">
            <span className="admin-time-panel-icon" aria-hidden="true"><CalendarDays size={18} strokeWidth={1.75} /></span>
            <div>
              <h3 id="admin-time-schedule-heading">Weekly schedule</h3>
              <p>Operating window for each day of the week.</p>
            </div>
            <span className="admin-time-day-count">7 days</span>
          </div>

          <div className="admin-time-table-scroll">
            <table className="admin-time-table">
              <caption className="sr-only">Weekly time settings, Sunday through Saturday</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Opens</th>
                  <th scope="col">Closes</th>
                  <th scope="col">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {TIME_REFERENCE.days.map((day) => (
                  <tr key={day}>
                    <th scope="row"><span className="admin-time-day-marker" aria-hidden="true" />{day}</th>
                    <td className="admin-time-mono">{TIME_REFERENCE.opens}</td>
                    <td className="admin-time-mono">{TIME_REFERENCE.closes}</td>
                    <td><span className="admin-time-coverage">All day</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-time-table-note">24:00 marks the end of the listed day; the next day begins at 00:00.</p>
        </section>
      </div>

      <p className="admin-time-source-note"><Info size={15} strokeWidth={1.75} aria-hidden="true" /> This view is read-only and does not retrieve live server time settings.</p>
    </div>
  </main>
);

export default TimeSettingsView;
