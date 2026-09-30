import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Users, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Download, 
  Filter,
  Activity,
  Zap
} from 'lucide-react';
import { downloadReportFile } from '../../utils/downloadReport';

interface ContinuousTeamMetric {
  id: string;
  name: string;
  participant1: string;
  participant2?: string;
  college: string;
  department?: string;
  year?: string;
  phone: string;
  status: string;
  lastActive: number;
  registeredAt: number;
  firstActiveAt: number;
  continuousSessionStart: number;
  continuousActiveSeconds: number;
  continuousActiveMinutes: number;
  continuousActiveFormatted: string;
  isCurrentlyOnline: boolean;
  meets3HourThreshold: boolean;
}

interface ContinuousUsagePanelProps {
  adminToken: string | null;
}

export const ContinuousUsagePanel: React.FC<ContinuousUsagePanelProps> = ({ adminToken }) => {
  const [selectedHours, setSelectedHours] = useState<number>(3);
  const [metricsData, setMetricsData] = useState<{
    thresholdHours: number;
    total3HourContinuousUsers: number;
    totalTeamsAudited: number;
    qualifyingTeams: ContinuousTeamMetric[];
    allTeamsSessionMetrics: ContinuousTeamMetric[];
    serverTime: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'QUALIFYING_ONLY' | 'ALL'>('QUALIFYING_ONLY');

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`/api/admin/continuous-3hr-users?hours=${selectedHours}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch continuous usage telemetry');
      const data = await res.json();
      setMetricsData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading usage telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [adminToken, selectedHours]);

  const teamsToDisplay = (
    filterMode === 'QUALIFYING_ONLY'
      ? (metricsData?.qualifyingTeams || [])
      : (metricsData?.allTeamsSessionMetrics || [])
  ).filter((team) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      team.id.toLowerCase().includes(q) ||
      team.name.toLowerCase().includes(q) ||
      team.college.toLowerCase().includes(q) ||
      team.participant1.toLowerCase().includes(q)
    );
  });

  const handleExportReport = () => {
    if (!metricsData) return;
    const csvRows = [
      ['Team ID', 'Team Name', 'College', 'Participant 1', 'Continuous Active Time', 'Session Start', 'Status', 'Online Now'],
      ...teamsToDisplay.map((t) => [
        t.id,
        `"${t.name}"`,
        `"${t.college}"`,
        `"${t.participant1}"`,
        t.continuousActiveFormatted,
        new Date(t.continuousSessionStart).toLocaleTimeString(),
        t.status,
        t.isCurrentlyOnline ? 'YES' : 'NO',
      ]),
    ];

    const csvContent = csvRows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Continuous_Users_${selectedHours}Hr_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Panel Header */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-[#06B6D4]/30 flex items-center justify-center text-[#0891B2] shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-tech text-lg font-bold text-[#172033] tracking-wide uppercase">
                CONTINUOUS 3-HOUR USER TELEMETRY
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-cyan-50 text-[#0891B2] border border-[#06B6D4]/30">
                REAL-TIME MONITORING
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Tracks participants maintaining non-stop active sessions on the website for {selectedHours}+ continuous hours.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchMetrics}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#64748B] hover:text-[#172033] transition-colors cursor-pointer"
            title="Refresh continuous active user stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportReport}
            className="px-3.5 py-2 rounded-xl bg-[#0891B2] hover:bg-[#06B6D4] text-white font-tech font-bold text-xs tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1: 3-Hour Continuous Users */}
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50/50 border border-[#06B6D4]/30 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono-code font-bold text-[#0891B2] mb-1">
            <span>3+ HOUR CONTINUOUS USERS</span>
            <Clock className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <div className="text-3xl font-tech font-extrabold text-[#172033] mt-2">
            {metricsData?.total3HourContinuousUsers || 0}
          </div>
          <p className="text-[11px] text-[#64748B] font-mono-code mt-1">
            Teams active continuously &ge; {selectedHours} hrs without idle break
          </p>
        </div>

        {/* Metric Card 2: Total Audited Teams */}
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono-code font-bold text-[#64748B] mb-1">
            <span>TOTAL ACTIVE TEAMS</span>
            <Users className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="text-3xl font-tech font-extrabold text-[#172033] mt-2">
            {metricsData?.totalTeamsAudited || 0}
          </div>
          <p className="text-[11px] text-[#64748B] font-mono-code mt-1">
            Registered symposium contestant teams
          </p>
        </div>

        {/* Metric Card 3: Selected Threshold Hours */}
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono-code font-bold text-[#64748B] mb-1">
            <span>CONTINUOUS DURATION GATE</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-tech font-extrabold text-[#172033] mt-2">
            {selectedHours} Hours
          </div>
          <p className="text-[11px] text-[#64748B] font-mono-code mt-1">
            {selectedHours * 60} continuous minutes threshold
          </p>
        </div>

        {/* Metric Card 4: Currently Online Qualifying Users */}
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono-code font-bold text-[#64748B] mb-1">
            <span>ONLINE & CONTINUOUS</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-tech font-extrabold text-emerald-700 mt-2">
            {metricsData?.qualifyingTeams.filter((t) => t.isCurrentlyOnline).length || 0}
          </div>
          <p className="text-[11px] text-[#64748B] font-mono-code mt-1">
            Live online in arena right now
          </p>
        </div>
      </div>

      {/* Threshold Selector & Search Controls */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Hour Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono-code font-bold text-[#64748B] mr-2">DURATION GATE:</span>
          {[1, 2, 3, 4, 5].map((h) => (
            <button
              key={h}
              onClick={() => setSelectedHours(h)}
              className={`px-3 py-1.5 rounded-xl text-xs font-tech font-bold transition-all cursor-pointer ${
                selectedHours === h
                  ? 'bg-[#0891B2] text-white shadow-xs'
                  : 'bg-[#F8FAFC] border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
              }`}
            >
              {h} {h === 1 ? 'Hour' : 'Hours'}
            </button>
          ))}
        </div>

        {/* Filter View Mode & Search Input */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center border border-[#DCE6F0] rounded-xl overflow-hidden bg-[#F8FAFC] text-xs font-mono-code">
            <button
              onClick={() => setFilterMode('QUALIFYING_ONLY')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                filterMode === 'QUALIFYING_ONLY' ? 'bg-[#0891B2] text-white' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              {selectedHours}+ HR USERS ONLY ({metricsData?.qualifyingTeams.length || 0})
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                filterMode === 'ALL' ? 'bg-[#0891B2] text-white' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              ALL TEAMS ({metricsData?.allTeamsSessionMetrics.length || 0})
            </button>
          </div>

          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or college..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#06B6D4]"
            />
          </div>
        </div>
      </div>

      {/* Main Table: Continuous Active Teams */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl shadow-xs overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-rose-600 font-mono-code text-xs">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <span>{error}</span>
          </div>
        ) : teamsToDisplay.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] space-y-2">
            <Clock className="w-8 h-8 text-[#94A3B8] mx-auto animate-bounce" />
            <div className="font-tech text-base font-bold text-[#172033]">
              NO TEAMS MEETING {selectedHours}+ HOUR CONTINUOUS THRESHOLD YET
            </div>
            <p className="text-xs font-mono-code max-w-md mx-auto">
              As participants navigate, solve rebus questions, and maintain active sessions without logging out or idling over 10 minutes, they will automatically appear here once reaching {selectedHours} continuous hours!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-code">
              <thead className="bg-[#F8FAFC] border-b border-[#DCE6F0] text-[#64748B] font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rank / Status</th>
                  <th className="py-3 px-4">Team Details</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Continuous Session Start</th>
                  <th className="py-3 px-4">Continuous Duration</th>
                  <th className="py-3 px-4 text-center">3-Hr Gate Met</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE6F0]/60 text-[#172033]">
                {teamsToDisplay.map((team, index) => (
                  <tr
                    key={team.id}
                    className={`hover:bg-[#F8FAFC] transition-colors ${
                      team.meets3HourThreshold ? 'bg-cyan-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0891B2]">#{index + 1}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            team.isCurrentlyOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                          }`}
                          title={team.isCurrentlyOnline ? 'Online now' : 'Offline'}
                        />
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            team.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {team.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-[#172033] font-tech text-sm">{team.name}</div>
                      <div className="text-[11px] text-[#0891B2] font-mono-code font-semibold">{team.id}</div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        {team.participant1} {team.participant2 ? `& ${team.participant2}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-semibold text-[#172033] max-w-[220px] truncate">
                        {team.college}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        {team.department || 'CSE'} • {team.year || '3rd Year'}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[#64748B]">
                      <div>{new Date(team.continuousSessionStart).toLocaleTimeString()}</div>
                      <div className="text-[10px]">{new Date(team.continuousSessionStart).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-sm font-bold font-tech text-[#0891B2]">
                        {team.continuousActiveFormatted}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        ({team.continuousActiveMinutes} continuous minutes)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {team.meets3HourThreshold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>YES (&ge; 3 HR)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[#64748B] text-[10px]">
                          <span>IN PROGRESS</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
