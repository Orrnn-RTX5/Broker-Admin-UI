import React, { useState } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { Download, FileText, Shield } from 'lucide-react';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const ExportCard = ({ icon: Icon, title, description, color, onExport, loading }) => (
  <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] p-5 flex flex-col gap-3 w-[280px]">
    <div className="flex items-center gap-2">
      <Icon size={16} className={color} />
      <span className="text-[12px] font-semibold text-[color:var(--text-primary)]">{title}</span>
    </div>
    <p className="text-[11px] text-[#888] leading-relaxed">{description}</p>
    <button onClick={onExport} disabled={loading}
      className="flex items-center justify-center gap-1.5 h-[26px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50 mt-1">
      <Download size={11} /> {loading ? 'Exporting…' : 'Export'}
    </button>
  </div>
);

const AnalyticsExportsView = () => {
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const handleAuditExport = async () => {
    setLoadingAudit(true);
    try {
      const blob = await AnalyticsService.getAuditExport();
      downloadBlob(blob, `audit_export_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoadingAudit(false); }
  };

  const handleReportExport = async () => {
    setLoadingReport(true);
    try {
      const blob = await AnalyticsService.getReportExport();
      downloadBlob(blob, `report_export_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoadingReport(false); }
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center px-3 h-[30px] bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <span className="text-[11px] font-semibold text-[#9cdcfe]">Data Exports</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-4 flex-wrap">
          <ExportCard
            icon={Shield}
            title="Audit Trail Export"
            description="Export the full audit trail log including all admin actions, logins, and configuration changes."
            color="text-[#d4a017]"
            onExport={handleAuditExport}
            loading={loadingAudit}
          />
          <ExportCard
            icon={FileText}
            title="Report Export"
            description="Export a comprehensive platform report including trading summaries, account activity, and financial data."
            color="text-[#4ec9b0]"
            onExport={handleReportExport}
            loading={loadingReport}
          />
        </div>
        <p className="text-[10px] text-[#555] mt-6">Files will be downloaded automatically as CSV to your browser's default download folder.</p>
      </div>
    </div>
  );
};

export default AnalyticsExportsView;
