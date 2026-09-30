import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Database, 
  RefreshCw, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Clock, 
  Layers, 
  Zap,
  Info
} from 'lucide-react';

interface SystemMetrics {
  timestamp: number;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
    heapUsagePercent: number;
    systemTotalRAM_MB: number;
    systemFreeRAM_MB: number;
  };
  counts: {
    totalTeams: number;
    totalSubmissions: number;
    antiCheatEventsCount: number;
    teamWarningsCount: number;
    auditLogsCount: number;
    totalQuestions: number;
    activeAdminAccounts: number;
  };
  storage: {
    dataFolderBytes: number;
    dataFolderKB: number;
    isPersistedToDisk: boolean;
  };
}

interface SystemMetricsPanelProps {
  adminToken: string | null;
}

export const SystemMetricsPanel: React.FC<SystemMetricsPanelProps> = ({ adminToken }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [browserStorageKB, setBrowserStorageKB] = useState<number | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/admin/system/metrics', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch system telemetry');
      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error connecting to system monitor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);

    // Estimate browser localStorage usage
    try {
      let total = 0;
      for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
          total += (localStorage[x].length + x.length) * 2;
        }
      }
      setBrowserStorageKB(+(total / 1024).toFixed(2));
    } catch (e) {
      // ignore
    }

    return () => clearInterval(interval);
  }, [adminToken]);

  const handleCreateSnapshot = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/system/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create disk snapshot');
      setActionMessage({ type: 'success', text: `Saved state locally to server disk (${(data.sizeBytes / 1024).toFixed(1)} KB)` });
      fetchMetrics();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOptimizeMemory = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/system/optimize-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to optimize memory');
      setActionMessage({ type: 'success', text: `${data.message} Heap now: ${data.currentHeapMB} MB` });
      fetchMetrics();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear all in-memory anti-cheat alerts and audit history? (Team scores and registrations will NOT be affected)')) {
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/system/clear-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear logs');
      setActionMessage({ type: 'success', text: data.message });
      fetchMetrics();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearSubmissions = async () => {
    if (!window.confirm('Reset all team scores to 0 and clear test submissions? (All registered teams and login credentials will remain intact)')) {
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/system/clear-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear submissions');
      setActionMessage({ type: 'success', text: data.message });
      fetchMetrics();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatUptime = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-tech text-slate-900 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-600" />
            LIVE MEMORY & STORAGE INSPECTOR
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Real-time server RAM metrics, Node.js heap consumption, and local disk persistence controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleCreateSnapshot}
            disabled={actionLoading}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Save live teams, submissions, and scores to local server storage"
          >
            <Save className="w-3.5 h-3.5" />
            Persist State to Disk
          </button>
          <button
            onClick={handleOptimizeMemory}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Trim stale anti-cheat and audit buffers from memory"
          >
            <Zap className="w-3.5 h-3.5" />
            Optimize RAM
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Node.js Heap Used */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Node Heap (Used / Total)</span>
            <Cpu className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-code text-slate-900">
              {metrics ? metrics.memory.heapUsedMB : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-mono-code">
              / {metrics ? metrics.memory.heapTotalMB : '--'} MB
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics?.memory.heapUsagePercent || 0)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-1.5 block font-mono-code">
            {metrics ? `${metrics.memory.heapUsagePercent}% heap allocated` : 'Measuring...'}
          </span>
        </div>

        {/* Card 2: Process Resident Memory (RSS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Process Memory (RSS)</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-code text-slate-900">
              {metrics ? metrics.memory.rssMB : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-mono-code">MB</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block font-sans">
            Total physical RAM mapped to the Node server process.
          </span>
        </div>

        {/* Card 3: Host Available RAM */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Host Free System RAM</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-code text-emerald-700">
              {metrics ? metrics.memory.systemFreeRAM_MB : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-mono-code">
              / {metrics ? metrics.memory.systemTotalRAM_MB : '--'} MB
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block font-sans">
            Free unallocated physical RAM available on host.
          </span>
        </div>

        {/* Card 4: Server Uptime & Platform */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Server Uptime</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono-code text-slate-900">
              {metrics ? formatUptime(metrics.uptimeSeconds) : '--'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-mono-code">
            Node {metrics?.nodeVersion || ''} &bull; {metrics?.platform || ''}
          </span>
        </div>
      </div>

      {/* Storage & Local Persistence Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Data Objects in Memory */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold font-tech text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            IN-MEMORY OBJECTS HELD IN RAM
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <span className="text-slate-600 font-medium">Registered Teams in Memory:</span>
              <span className="font-mono-code font-bold text-slate-900">{metrics?.counts.totalTeams ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <span className="text-slate-600 font-medium">Submissions Recorded:</span>
              <span className="font-mono-code font-bold text-slate-900">{metrics?.counts.totalSubmissions ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <span className="text-slate-600 font-medium">Anti-Cheat Alert Logs:</span>
              <span className="font-mono-code font-bold text-slate-900">{metrics?.counts.antiCheatEventsCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <span className="text-slate-600 font-medium">System Audit Logs:</span>
              <span className="font-mono-code font-bold text-slate-900">{metrics?.counts.auditLogsCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <span className="text-slate-600 font-medium">Question Bank Items:</span>
              <span className="font-mono-code font-bold text-slate-900">{metrics?.counts.totalQuestions ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Right: Local Disk Storage & Client Storage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold font-tech text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            LOCAL PERSISTENCE & STORAGE
          </h3>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-cyan-50/50 border border-cyan-100 text-sm">
              <div className="flex items-center justify-between font-semibold text-cyan-900">
                <span>Server Local `/data` Directory:</span>
                <span className="font-mono-code">{metrics?.storage.dataFolderKB ?? 0} KB</span>
              </div>
              <p className="text-xs text-cyan-700 mt-1">
                Holds persistent feedback files and state snapshots (`event_state_snapshot.json`).
              </p>
              <div className="mt-2 text-xs font-semibold text-cyan-800 flex items-center gap-1.5">
                {metrics?.storage.isPersistedToDisk ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Snapshot Active on Disk
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> No snapshot created yet (In-memory only)
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>Client Browser Storage (This Device):</span>
                <span className="font-mono-code">{browserStorageKB ?? 0} KB</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stores client preferences and session tokens in localStorage (5–10 MB quota per browser).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>How to reduce server RAM:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Click <strong>"Persist State to Disk"</strong> before/after each round to flush state snapshots.</li>
                  <li>Click <strong>"Optimize RAM"</strong> to prune older in-memory warning & audit log arrays.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Granular Memory Clearance & Event Reset Control Deck */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold font-tech text-slate-900 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-600" />
          MEMORY CLEARANCE & RESET OPERATIONS
        </h3>
        <p className="text-xs text-slate-500">
          Choose the exact scope of data you want to clear from server RAM and memory maps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Option A: Clear Security & Audit Logs */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                Clear Security Logs
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Empties all anti-cheat violation and audit logs from RAM. <strong>Teams, scores, and timer are untouched.</strong>
              </p>
            </div>
            <button
              onClick={handleClearLogs}
              disabled={actionLoading}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold font-tech bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              Clear RAM Logs
            </button>
          </div>

          {/* Option B: Clear Submissions & Zero Scores */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                Reset Scores & Submissions
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Clears all submitted answers and resets team scores to 0. <strong>Preserves registered team accounts & logins.</strong>
              </p>
            </div>
            <button
              onClick={handleClearSubmissions}
              disabled={actionLoading}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold font-tech bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              Zero Scores (Keep Teams)
            </button>
          </div>

          {/* Option C: What Happens on Full Event Reset */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-rose-900 text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Full Event Reset (Master)
              </div>
              <p className="text-xs text-rose-700 mt-1">
                Clears submissions, buzzer queues, and anti-cheat logs, resets scores to 0, and returns timer to Round 1 Waiting.
              </p>
            </div>
            <div className="text-[11px] font-mono-code font-bold text-rose-800 bg-rose-100/80 px-2 py-1.5 rounded-md text-center">
              Requires phrase "RESET TECH BRIDGE" in Main Control Tab
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
