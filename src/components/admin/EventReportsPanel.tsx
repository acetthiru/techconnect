import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  ShieldAlert,
  Award,
  FileText,
  RefreshCw,
  Layers,
  Sparkles,
  Zap,
  Cpu,
  Radio,
  FileCode,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { downloadReportFile } from '../../utils/downloadReport';

interface EventReportsPanelProps {
  adminToken: string | null;
}

export const EventReportsPanel: React.FC<EventReportsPanelProps> = ({ adminToken }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [toastFeedback, setToastFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastFeedback({ message, type });
    setTimeout(() => setToastFeedback(null), 4000);
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports/event-summary', {
        headers: {
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [adminToken]);

  // Robust Authenticated Downloader
  const handleDownload = async (
    endpoint: string,
    defaultName: string,
    label: string
  ) => {
    setDownloadingFormat(label);
    const success = await downloadReportFile({
      url: endpoint,
      adminToken,
      filename: defaultName,
      onSuccess: (name) => {
        showToast(`Successfully downloaded: ${name}`, 'success');
      },
      onError: (err) => {
        showToast(`Download failed: ${err}`, 'error');
      },
    });
    setDownloadingFormat(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastFeedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-mono shadow-md animate-fade-in ${
            toastFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-bold">{toastFeedback.message}</span>
          </div>
          <button
            onClick={() => setToastFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white border border-[#DCE6F0] rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#172033] font-tech tracking-wide flex items-center gap-2">
                OFFICIAL SYMPOSIUM REPORT EXPORT HUB
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Department of Computer Science & Engineering • ACETCM'26 TECH BRIDGE Dossier
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#172033] px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-[#DCE6F0] transition active:scale-95 cursor-pointer shadow-2xs"
            title="Refresh Live Statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-[#DCE6F0] transition active:scale-95 cursor-pointer shadow-2xs"
            title="Print Official Symposium Dossier"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT DOSSIER</span>
          </button>

          <button
            onClick={() =>
              handleDownload(
                '/api/admin/reports/export-xlsx?round=all',
                'TECH_BRIDGE_26_Complete_Report.xlsx',
                'xlsx-all'
              )
            }
            disabled={downloadingFormat === 'xlsx-all'}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#2563EB] hover:from-emerald-500 hover:to-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs font-tech tracking-wider shadow-md shadow-emerald-700/15 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadingFormat === 'xlsx-all'
                ? 'GENERATING WORKBOOK...'
                : 'DOWNLOAD COMPLETE EXCEL (ALL ROUNDS)'}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-mono font-semibold uppercase">Total Teams Enrolled</span>
          <span className="text-2xl font-black text-[#172033]">{summary?.stats?.totalTeams || 0}</span>
          <span className="text-[11px] text-emerald-700 font-mono font-semibold block mt-1">
            {summary?.stats?.activeTeams || 0} Active • {summary?.stats?.lockedTeams || 0} Locked
          </span>
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-mono font-semibold uppercase">Answer Submissions</span>
          <span className="text-2xl font-black text-[#0891B2]">{summary?.stats?.totalSubmissions || 0}</span>
          <span className="text-[11px] text-[#64748B] font-mono block mt-1">
            {summary?.stats?.totalCorrect || 0} Correct ({summary?.stats?.completionRate || 0}%)
          </span>
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-mono font-semibold uppercase">Anti-Cheat Violations</span>
          <span className="text-2xl font-black text-rose-700">{summary?.stats?.antiCheatViolationsCount || 0}</span>
          <span className="text-[11px] text-rose-600 font-mono font-semibold block mt-1">
            {summary?.stats?.lockedTeams || 0} Teams Locked By Proctor
          </span>
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-mono font-semibold uppercase">Manual Adjustments</span>
          <span className="text-2xl font-black text-blue-700">{summary?.stats?.manualScoreAdjustmentsCount || 0}</span>
          <span className="text-[11px] text-blue-600 font-mono font-semibold block mt-1">
            Audited by Super Admin
          </span>
        </div>
      </div>

      {/* ==========================================
          ROUND-SPECIFIC REPORT DOWNLOAD MATRIX (R1, R2, R3, ALL R)
          ========================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172033] font-tech tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0891B2]" />
            ROUND-SPECIFIC REPORTS & SCORECARD DOWNLOADS (R1, R2, R3, ALL R)
          </h3>
          <span className="text-xs font-mono text-[#64748B]">Instant CSV & Excel Formats</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ALL ROUNDS MASTER REPORT CARD */}
          <div className="bg-gradient-to-b from-white to-slate-50 border-2 border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ALL ROUNDS (R1 + R2 + R3)
                </span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="font-bold text-base text-[#172033]">Master Leaderboard & Standings</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Complete symposium tally across all 3 rounds. Includes team ranks, participant contacts, colleges, R1-R3 sub-scores, and final grand totals.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#DCE6F0]">
              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/export-csv?round=all',
                    'TechBridge_All_Rounds_Master_Leaderboard.csv',
                    'csv-all'
                  )
                }
                disabled={downloadingFormat === 'csv-all'}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'csv-all' ? 'DOWNLOADING...' : 'DOWNLOAD CSV (ALL R)'}</span>
              </button>

              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/reports/export-xlsx?round=all',
                    'TechBridge_All_Rounds_Workbook.xlsx',
                    'xlsx-all-card'
                  )
                }
                disabled={downloadingFormat === 'xlsx-all-card'}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{downloadingFormat === 'xlsx-all-card' ? 'DOWNLOADING...' : 'DOWNLOAD EXCEL (ALL R)'}</span>
              </button>
            </div>
          </div>

          {/* ROUND 1 REPORT CARD */}
          <div className="bg-gradient-to-b from-white to-slate-50 border-2 border-cyan-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                  ROUND 1 (R1)
                </span>
                <Cpu className="w-4 h-4 text-[#0891B2]" />
              </div>
              <h4 className="font-bold text-base text-[#172033]">Round 1: Foundations & Systems</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Individual Round 1 score report (1 point per question). R1 rankings, answer attempt count, correct submissions, and accuracy rates.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#DCE6F0]">
              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/export-csv?round=1',
                    'TechBridge_Round_1_Report.csv',
                    'csv-r1'
                  )
                }
                disabled={downloadingFormat === 'csv-r1'}
                className="w-full py-2 px-3 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'csv-r1' ? 'DOWNLOADING...' : 'DOWNLOAD CSV (R1)'}</span>
              </button>

              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/reports/export-xlsx?round=1',
                    'TechBridge_Round_1_Report.xlsx',
                    'xlsx-r1'
                  )
                }
                disabled={downloadingFormat === 'xlsx-r1'}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-cyan-50 text-cyan-800 border border-cyan-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600" />
                <span>{downloadingFormat === 'xlsx-r1' ? 'DOWNLOADING...' : 'DOWNLOAD EXCEL (R1)'}</span>
              </button>
            </div>
          </div>

          {/* ROUND 2 REPORT CARD */}
          <div className="bg-gradient-to-b from-white to-slate-50 border-2 border-purple-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
                  ROUND 2 (R2)
                </span>
                <Zap className="w-4 h-4 text-[#7C3AED]" />
              </div>
              <h4 className="font-bold text-base text-[#172033]">Round 2: Distributed Architectures</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Individual Round 2 score report (2 points per question). R2 rankings, matrix clue completion rate, and verified submissions.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#DCE6F0]">
              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/export-csv?round=2',
                    'TechBridge_Round_2_Report.csv',
                    'csv-r2'
                  )
                }
                disabled={downloadingFormat === 'csv-r2'}
                className="w-full py-2 px-3 rounded-xl bg-[#7C3AED] hover:bg-purple-700 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'csv-r2' ? 'DOWNLOADING...' : 'DOWNLOAD CSV (R2)'}</span>
              </button>

              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/reports/export-xlsx?round=2',
                    'TechBridge_Round_2_Report.xlsx',
                    'xlsx-r2'
                  )
                }
                disabled={downloadingFormat === 'xlsx-r2'}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                <span>{downloadingFormat === 'xlsx-r2' ? 'DOWNLOADING...' : 'DOWNLOAD EXCEL (R2)'}</span>
              </button>
            </div>
          </div>

          {/* ROUND 3 REPORT CARD */}
          <div className="bg-gradient-to-b from-white to-slate-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  ROUND 3 (R3)
                </span>
                <Radio className="w-4 h-4 text-rose-600" />
              </div>
              <h4 className="font-bold text-base text-[#172033]">Round 3: Grand Finale & Buzzer</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Round 3 high-stakes buzzer round report (3 points per question). Buzzer reaction times, correct rapid answers, and final podium battle.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#DCE6F0]">
              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/export-csv?round=3',
                    'TechBridge_Round_3_Report.csv',
                    'csv-r3'
                  )
                }
                disabled={downloadingFormat === 'csv-r3'}
                className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'csv-r3' ? 'DOWNLOADING...' : 'DOWNLOAD CSV (R3)'}</span>
              </button>

              <button
                onClick={() =>
                  handleDownload(
                    '/api/admin/reports/export-xlsx?round=3',
                    'TechBridge_Round_3_Report.xlsx',
                    'xlsx-r3'
                  )
                }
                disabled={downloadingFormat === 'xlsx-r3'}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                <span>{downloadingFormat === 'xlsx-r3' ? 'DOWNLOADING...' : 'DOWNLOAD EXCEL (R3)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Administrative Dossiers & Live Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specialized Audit & Proctor Datasets */}
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#172033] font-tech tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            PROCTORING & AUDIT LOG EXPORTS
          </h3>

          <div className="space-y-2.5">
            <button
              onClick={() =>
                handleDownload(
                  '/api/admin/export-anticheat-csv',
                  'TechBridge_AntiCheat_Dossier.csv',
                  'anticheat'
                )
              }
              disabled={downloadingFormat === 'anticheat'}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-semibold text-[#172033] block">Anti-Cheat Incident Dossier</span>
                  <span className="text-[11px] text-[#64748B]">Focus losses, app backgrounding, forbidden shortcuts</span>
                </div>
              </div>
              <span className="text-[#2563EB] font-bold font-mono shrink-0">
                {downloadingFormat === 'anticheat' ? 'Downloading...' : 'CSV ↓'}
              </span>
            </button>

            <button
              onClick={() =>
                handleDownload(
                  '/api/admin/export-audit-csv',
                  'TechBridge_Audit_Ledger.csv',
                  'audit'
                )
              }
              disabled={downloadingFormat === 'audit'}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-semibold text-[#172033] block">Super Admin Audit Trail Ledger</span>
                  <span className="text-[11px] text-[#64748B]">Chronological log of timer changes, score edits & lockouts</span>
                </div>
              </div>
              <span className="text-[#2563EB] font-bold font-mono shrink-0">
                {downloadingFormat === 'audit' ? 'Downloading...' : 'CSV ↓'}
              </span>
            </button>

            <button
              onClick={() =>
                handleDownload(
                  '/api/admin/export-backup-json',
                  'TechBridge_Complete_System_Backup.json',
                  'backup'
                )
              }
              disabled={downloadingFormat === 'backup'}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-semibold text-[#172033] block">Complete System State Backup (JSON)</span>
                  <span className="text-[11px] text-[#64748B]">All teams, answers, questions & event configuration</span>
                </div>
              </div>
              <span className="text-[#2563EB] font-bold font-mono shrink-0">
                {downloadingFormat === 'backup' ? 'Downloading...' : 'JSON ↓'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Top 10 Snapshot */}
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#172033] font-tech tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-[#0891B2]" />
              LIVE STANDINGS SNAPSHOT
            </h3>
            <span className="text-[11px] font-mono text-[#0891B2] font-bold">TOP TEAMS</span>
          </div>

          <div className="divide-y divide-[#DCE6F0] max-h-60 overflow-y-auto pr-1">
            {(summary?.leaderboardTop10 || []).length > 0 ? (
              (summary?.leaderboardTop10 || []).map((t: any) => (
                <div key={t.teamId} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="font-mono font-bold text-[#0891B2] w-5">#{t.rank}</span>
                    <div className="truncate">
                      <span className="font-semibold text-[#172033] block truncate">{t.teamName}</span>
                      <span className="text-[10px] text-[#64748B] block truncate">{t.college}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-[#172033] text-sm block">
                      {t.totalScore} pts
                    </span>
                    <span className="text-[10px] text-[#64748B] font-mono">
                      R1:{t.round1Score} R2:{t.round2Score} R3:{t.round3Score}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs font-mono text-[#64748B]">
                No team scores recorded yet. Standings will populate as answers are submitted.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
