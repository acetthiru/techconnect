import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock,
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  EyeOff, 
  Radio, 
  AlertTriangle, 
  Users, 
  Trophy, 
  BookOpen, 
  Download, 
  Plus, 
  Check, 
  X, 
  Clock, 
  Award,
  Search,
  FileSpreadsheet,
  ShieldAlert,
  History,
  Trash2,
  Edit3,
  Sliders,
  CheckCircle2,
  XCircle,
  Activity,
  LogOut,
  RefreshCw,
  FileText,
  UserPlus,
  Upload,
  Layers,
  Filter,
  Copy,
  Target,
  MessageSquare,
  BarChart2,
  Lightbulb,
  Image as ImageIcon,
  DoorClosed,
  DoorOpen,
  Menu,
  Sparkles
} from 'lucide-react';
import { downloadReportFile } from '../utils/downloadReport';
import { 
  EventState, 
  Team, 
  Question, 
  Submission, 
  AntiCheatEvent, 
  LeaderboardEntry,
  AuditLogEntry,
  TeamWarning,
  AdminRole,
  AntiCheatSeverity,
  QuestionSet,
  RoundNumber
} from '../types';
import { RebusClueRenderer } from './RebusClueRenderer';
import { EmergencyOfflineModal } from './EmergencyOfflineModal';
import { QuestionManager } from './QuestionManager';
import { AdminCertificateManager } from './AdminCertificateManager';
import { AnsweredMonitoringPanel } from './admin/AnsweredMonitoringPanel';
import { TeamQuestionControlPanel } from './admin/TeamQuestionControlPanel';
import { DynamicClueControlPanel } from './admin/DynamicClueControlPanel';
import { ManualScoreAdjustmentPanel } from './admin/ManualScoreAdjustmentPanel';
import { QualificationPanel } from './admin/QualificationPanel';
import { BulkQuestionImportPanel } from './admin/BulkQuestionImportPanel';
import { MultipleAdminManagementPanel } from './admin/MultipleAdminManagementPanel';
import { EventReportsPanel } from './admin/EventReportsPanel';
import { FeedbackResultsPanel } from './admin/FeedbackResultsPanel';
import { SystemMetricsPanel } from './admin/SystemMetricsPanel';
import { AnswerCheckerControlPanel } from './admin/AnswerCheckerControlPanel';

interface AdminDashboardProps {
  eventState: EventState | null;
  remainingSeconds: number;
  onRefreshState: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  eventState,
  remainingSeconds,
  onRefreshState,
}) => {
  // Admin Session State
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('techbridge_admin_token') || null;
  });
  const [adminRole, setAdminRole] = useState<AdminRole>(() => {
    return (sessionStorage.getItem('techbridge_admin_role') as AdminRole) || 'SUPER_ADMIN';
  });
  const [adminUsername, setAdminUsername] = useState<string>(() => {
    return sessionStorage.getItem('techbridge_admin_username') || 'ACETTHIRU';
  });

  // Login Form States (NO credentials hardcoded in placeholders or default values)
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Admin Sub-View (Full Section Reorganization)
  const [activeTab, setActiveTab] = useState<
    | 'control'
    | 'answer_checker'
    | 'teams'
    | 'monitoring'
    | 'questions'
    | 'bulk_import'
    | 'team_questions'
    | 'clues'
    | 'score_adjust'
    | 'qualification'
    | 'anticheat'
    | 'leaderboard'
    | 'reports'
    | 'feedback'
    | 'admins'
    | 'certificates'
    | 'audit'
    | 'system_metrics'
    | 'offline'
  >('control');

  // Loaded Data States
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [submissionsList, setSubmissionsList] = useState<Submission[]>([]);
  const [antiCheatList, setAntiCheatList] = useState<AntiCheatEvent[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<AuditLogEntry[]>([]);
  const [warningsList, setWarningsList] = useState<TeamWarning[]>([]);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AntiCheatSeverity>('ALL');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Control Modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [controlMessage, setControlMessage] = useState<string | null>(null);

  // Team Edit Modal
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Add Team Modal
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamForm, setNewTeamForm] = useState({
    id: '',
    name: '',
    participant1: '',
    participant2: '',
    college: 'Autonomous College of Engineering & Technology',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    phone: '',
  });
  const [addTeamLoading, setAddTeamLoading] = useState(false);
  const [addTeamError, setAddTeamError] = useState<string | null>(null);

  // Remove Team Modal
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [removeTeamLoading, setRemoveTeamLoading] = useState(false);

  // Question Edit / Add Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Quick Answer Update Modal (Direct answer update for organizers on live questions)
  const [quickAnswerModal, setQuickAnswerModal] = useState<{
    open: boolean;
    questionId: string;
    round: number;
    questionNumber: number;
    correctAnswer: string;
    aliases: string;
  } | null>(null);
  const [quickAnswerSaving, setQuickAnswerSaving] = useState(false);
  const [quickAnswerBanner, setQuickAnswerBanner] = useState<string | null>(null);

  const handleQuickUpdateAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAnswerModal || !adminToken) return;
    setQuickAnswerSaving(true);
    try {
      const aliasArr = quickAnswerModal.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await fetch('/api/admin/current-question/update-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionId: quickAnswerModal.questionId,
          correctAnswer: quickAnswerModal.correctAnswer.trim(),
          aliases: aliasArr,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQuickAnswerBanner(`✓ Answer updated to "${quickAnswerModal.correctAnswer.trim()}" & synced to cloud!`);
        setTimeout(() => setQuickAnswerBanner(null), 4000);
        setQuickAnswerModal(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to update answer');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating answer');
    } finally {
      setQuickAnswerSaving(false);
    }
  };

  // Helper for persistence feedback
  const performActionWithFeedback = async (action: () => Promise<void>) => {
    setSaveStatus('saving');
    try {
      await action();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveStatus('idle');
      throw e;
    }
  };

  // Leaderboard Filter State (ALL, R1, R2, R3)
  const [leaderboardRoundFilter, setLeaderboardRoundFilter] = useState<'ALL' | 1 | 2 | 3>('ALL');

  // Logout Handler
  const handleLogout = () => {
    setAdminToken(null);
    sessionStorage.removeItem('techbridge_admin_token');
    sessionStorage.removeItem('techbridge_admin_role');
    sessionStorage.removeItem('techbridge_admin_username');
  };

  // Safe fetch helper for admin background polling
  const safeFetchAdmin = async (url: string, token: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 401) {
        return { status: 401, ok: false, data: null };
      }
      if (!res.ok) {
        return { status: res.status, ok: false, data: null };
      }
      const data = await res.json();
      return { status: 200, ok: true, data };
    } catch {
      // Quietly return fallback on network interruptions or dev server reload
      return { status: 0, ok: false, data: null };
    }
  };

  // Fetch admin protected data
  const fetchAdminData = async () => {
    if (!adminToken) return;

    try {
      const [teamsRes, subsRes, acRes, qRes, auditRes, warnRes] = await Promise.all([
        safeFetchAdmin('/api/admin/teams', adminToken),
        safeFetchAdmin('/api/admin/submissions', adminToken),
        safeFetchAdmin('/api/admin/anti-cheat', adminToken),
        safeFetchAdmin('/api/admin/questions', adminToken),
        safeFetchAdmin('/api/admin/audit-logs', adminToken),
        safeFetchAdmin('/api/admin/warnings', adminToken),
      ]);

      // If token expired or was invalidated on the server, cleanly logout
      if (
        teamsRes.status === 401 ||
        subsRes.status === 401 ||
        acRes.status === 401 ||
        qRes.status === 401 ||
        auditRes.status === 401 ||
        warnRes.status === 401
      ) {
        handleLogout();
        setLoginError('Admin session expired or invalidated. Please sign in again.');
        return;
      }

      if (teamsRes.ok && teamsRes.data) {
        setTeamsList(teamsRes.data.teams || []);
      }
      if (subsRes.ok && subsRes.data) {
        setSubmissionsList(subsRes.data.submissions || []);
      }
      if (acRes.ok && acRes.data) {
        setAntiCheatList(acRes.data.events || []);
      }
      if (qRes.ok && qRes.data) {
        setQuestionsList(qRes.data.questions || []);
      }
      if (auditRes.ok && auditRes.data) {
        setAuditLogsList(auditRes.data.auditLogs || []);
      }
      if (warnRes.ok && warnRes.data) {
        setWarningsList(warnRes.data.warnings || []);
      }
    } catch {
      // Polling network blips handled smoothly
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchAdminData();
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchAdminData();
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [adminToken, eventState]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed. Verify credentials.');
        setLoginLoading(false);
        return;
      }

      setAdminToken(data.token);
      setAdminRole(data.role);
      setAdminUsername(data.username);
      sessionStorage.setItem('techbridge_admin_token', data.token);
      sessionStorage.setItem('techbridge_admin_role', data.role);
      sessionStorage.setItem('techbridge_admin_username', data.username);
      setLoginLoading(false);
      onRefreshState();
    } catch (err) {
      setLoginError('Unable to connect to authentication gateway.');
      setLoginLoading(false);
    }
  };

  // Generic Admin Control Command
  const sendControl = async (endpoint: string, body: any = {}) => {
    if (!adminToken) return;
    setControlMessage(null);
    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        handleLogout();
        setLoginError('Admin session expired or invalidated. Please sign in again.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setControlMessage(data.error || 'Command failed');
      } else {
        setControlMessage(data.message || 'Command executed successfully');
        onRefreshState();
        fetchAdminData();
      }
      setTimeout(() => setControlMessage(null), 3500);
    } catch {
      setControlMessage('Network error communicating with command desk');
      setTimeout(() => setControlMessage(null), 3500);
    }
  };

  // Authenticated Report Downloader Helper
  const handleQuickDownload = async (url: string, defaultName: string) => {
    setControlMessage(`Preparing download: ${defaultName}...`);
    await downloadReportFile({
      url,
      adminToken,
      filename: defaultName,
      onSuccess: (name) => {
        setControlMessage(`Downloaded: ${name}`);
        setTimeout(() => setControlMessage(null), 3500);
      },
      onError: (err) => {
        setControlMessage(`Download failed: ${err}`);
        setTimeout(() => setControlMessage(null), 4000);
      },
    });
  };

  // Anti-Cheat Action Handler
  const handleAntiCheatAction = async (eventId: string, action: 'WARN' | 'LOCK' | 'LOCKED' | 'DISQUALIFY' | 'DISQUALIFIED' | 'DISMISSED', reason?: string) => {
    await sendControl('anti-cheat/action', { eventId, action, reason });
  };

  // Set Maximum Violations Handler
  const handleSetMaxViolations = async (limit: number) => {
    try {
      const res = await fetch('/api/admin/set-max-violations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (res.ok) {
        setControlMessage(`Participant violation limit set to ${limit} violation${limit > 1 ? 's' : ''}. Automated lockout triggers at ${limit} violation${limit > 1 ? 's' : ''}.`);
        onRefreshState();
      }
    } catch {}
  };

  // Team Action Handler
  const handleTeamAction = async (teamId: string, action: 'LOCK' | 'UNLOCK' | 'WARN' | 'DISQUALIFY' | 'RESTORE', reason?: string) => {
    if (action === 'LOCK') {
      await sendControl('team/lock', { teamId, reason: reason || 'Organizer security lock' });
    } else if (action === 'UNLOCK') {
      await sendControl('team/unlock', { teamId });
    } else if (action === 'WARN') {
      await sendControl('team/warn', { teamId, message: reason || 'Symposium warning issued by organizer' });
    } else if (action === 'DISQUALIFY') {
      await sendControl('team/disqualify', { teamId, reason: reason || 'Disqualified by organizer' });
    } else if (action === 'RESTORE') {
      await sendControl('team/restore', { teamId });
    }
  };

  // Team Edit Save
  const handleSaveTeamEdit = async () => {
    if (!editingTeam) return;
    await sendControl('team/edit', editingTeam);
    setEditingTeam(null);
  };

  // Add New Team
  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamForm.name.trim() || !newTeamForm.participant1.trim()) {
      setAddTeamError('Team name and Participant 1 name are required.');
      return;
    }
    setAddTeamLoading(true);
    setAddTeamError(null);
    try {
      const res = await fetch('/api/admin/team/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(newTeamForm),
      });

      if (res.status === 401) {
        handleLogout();
        setLoginError('Admin session expired or invalidated. Please sign in again.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add team');
      }
      setShowAddTeamModal(false);
      setNewTeamForm({
        id: '',
        name: '',
        participant1: '',
        participant2: '',
        college: 'Autonomous College of Engineering & Technology',
        department: 'Computer Science & Engineering',
        year: '3rd Year',
        phone: '',
      });
      setControlMessage(`Team ${data.team.name} (${data.team.id}) added successfully.`);
      fetchAdminData();
      onRefreshState();
    } catch (err: any) {
      setAddTeamError(err.message || 'Failed to register team.');
    } finally {
      setAddTeamLoading(false);
    }
  };

  // Remove Team
  const handleConfirmRemoveTeam = async () => {
    if (!teamToDelete) return;
    setRemoveTeamLoading(true);
    try {
      const res = await fetch('/api/admin/team/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ teamId: teamToDelete.id }),
      });

      if (res.status === 401) {
        handleLogout();
        setLoginError('Admin session expired or invalidated. Please sign in again.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove team');
      }
      setControlMessage(`Team ${teamToDelete.name} (${teamToDelete.id}) permanently removed.`);
      fetchAdminData();
      onRefreshState();
    } catch (err: any) {
      setControlMessage(`Error removing team: ${err.message}`);
    } finally {
      setRemoveTeamLoading(false);
    }
  };

  // Format timer
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // VIEW: UN-AUTHENTICATED LOGIN SCREEN
  // ==========================================
  if (!adminToken) {
    return (
      <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#F5F9FC]">
        <div className="w-full max-w-md bg-white border border-[#DCE6F0] rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#06B6D4]/30 mb-3 shadow-md shadow-cyan-500/10 bg-slate-950 p-1">
              <img
                src="/tech_bridge_logo.jpg"
                alt="TECH BRIDGE '26 Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="font-tech text-xl font-bold text-[#172033] tracking-wider">
              ORGANIZER COMMAND DESK
            </h1>
            <p className="text-xs text-[#64748B] font-mono-code mt-1">
              TECH BRIDGE '26 • CSE Symposium Control Center
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono-code text-[#64748B] mb-1 font-semibold">
                OPERATOR USERNAME
              </label>
              <input
                id="input-admin-username"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] text-sm font-mono-code focus:outline-none focus:border-[#06B6D4] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-code text-[#64748B] mb-1 font-semibold">
                SECURE ACCESS KEY
              </label>
              <input
                id="input-admin-password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] text-sm font-mono-code focus:outline-none focus:border-[#06B6D4] transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-mono-code text-[#64748B]">Symposium Operator Security Gateway</span>
              <span className="text-[10px] font-mono-code text-[#64748B]">Restricted Faculty / Admin Access</span>
            </div>

            <button
              id="btn-admin-submit-login"
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider transition-all disabled:opacity-50 mt-2 shadow-md shadow-cyan-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? 'AUTHENTICATING GATEWAY...' : 'VERIFY & ENTER COMMAND DESK'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#DCE6F0] text-center">
            <span className="text-[10px] font-mono-code text-[#64748B] block">
              ROLE-BASED AUTHORIZATION ENFORCED • SERVER-AUTHORITATIVE
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Active question in bank for current round and chosen set
  const currentStageRound = (eventState?.currentRound || 1) as RoundNumber;
  const currentActiveSet = eventState?.activeQuestionSet?.[currentStageRound] || 'A';
  const roundQuestions = questionsList
    .filter((q) => q.round === currentStageRound && (q.set || 'A') === currentActiveSet && q.active)
    .sort((a, b) => a.questionNumber - b.questionNumber);
  const activeQuestion = roundQuestions[eventState?.currentQuestionIndex || 0] || null;

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Admin Status Bar */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-[#06B6D4]/30 flex items-center justify-center text-[#0891B2]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-tech text-lg font-bold text-[#172033] tracking-wider">
                CONTROL CENTER
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-cyan-50 text-[#0891B2] border border-[#06B6D4]/30">
                {adminRole.replace('_', ' ')}
              </span>
              {eventState?.isTestMode && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  TEST / DRY-RUN MODE ACTIVE
                </span>
              )}
              {eventState?.eventLocked && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  ARENA LOCKED
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Session: <span className="text-[#172033] font-mono-code font-semibold">{adminUsername}</span> • Authoritative symposium game engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => sendControl('toggle-test-mode')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono-code font-bold transition-all cursor-pointer ${
              eventState?.isTestMode
                ? 'bg-amber-100 border-amber-400 text-amber-900'
                : 'bg-[#F8FAFC] border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
            }`}
            title="Toggle test mode to exercise buzzer and questions without affecting scores"
          >
            {eventState?.isTestMode ? 'TEST MODE: ON' : 'TEST MODE: OFF'}
          </button>

          <button
            onClick={() => sendControl('event/toggle-lock')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono-code font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              eventState?.eventLocked
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-[#F8FAFC] border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
            }`}
          >
            {eventState?.eventLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{eventState?.eventLocked ? 'UNLOCK ARENA' : 'LOCK ARENA'}</span>
          </button>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#172033] text-xs font-mono-code font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Menu className="w-3.5 h-3.5 text-[#0891B2]" />
            <span>NAVIGATION</span>
          </button>

          <button
            onClick={fetchAdminData}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#64748B] hover:text-[#172033] cursor-pointer"
            title="Refresh All Server Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-rose-50 border border-[#DCE6F0] hover:border-rose-200 text-[#64748B] hover:text-rose-700 text-xs font-mono-code flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>

      {/* Persistence Status */}
      {saveStatus !== 'idle' && (
        <div className={`p-3 border rounded-xl text-xs font-mono-code font-bold flex items-center justify-center animate-fadeIn ${
            saveStatus === 'saving' 
              ? 'bg-amber-50 border-amber-300 text-amber-700' 
              : 'bg-emerald-50 border-emerald-300 text-emerald-700'
        }`}>
          {saveStatus === 'saving' ? 'Saving...' : 'Changes Saved'}
        </div>
      )}

      {/* Control Message Toast */}
      {controlMessage && (
        <div className="p-3 bg-cyan-50 border border-[#06B6D4]/50 rounded-xl text-xs font-mono-code text-[#0891B2] flex items-center justify-between animate-fadeIn">
          <span>{controlMessage}</span>
          <button onClick={() => setControlMessage(null)} className="text-[#0891B2] hover:text-[#172033] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sidebar + Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Modern Vertical Sidebar Navigation */}
        <aside
          className={`w-full lg:w-64 shrink-0 bg-white border border-[#DCE6F0] rounded-2xl p-3 shadow-xs space-y-4 lg:sticky lg:top-20 transition-all ${
            mobileNavOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Group 1: Live Operations */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-mono-code font-bold text-[#64748B] uppercase tracking-wider">
              Live Operations
            </div>
            <button
              onClick={() => {
                setActiveTab('control');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'control'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Live Control</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${eventState?.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
            </button>

            <button
              onClick={() => {
                setActiveTab('answer_checker');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'answer_checker'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Answer Checker</span>
              </div>
              {eventState?.answerCheckerEnabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Answer Checker is Active" />
              ) : (
                <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B]">OFF</span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('leaderboard');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 shrink-0" />
                <span>Leaderboard</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('monitoring');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'monitoring'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Answer Monitor</span>
              </div>
            </button>
          </div>

          {/* Group 2: Teams & Proctoring */}
          <div className="space-y-1 pt-2 border-t border-[#DCE6F0]/60">
            <div className="px-3 py-1 text-[10px] font-mono-code font-bold text-[#64748B] uppercase tracking-wider">
              Teams & Proctoring
            </div>
            <button
              onClick={() => {
                setActiveTab('teams');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'teams'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0" />
                <span>Teams</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-code ${
                activeTab === 'teams' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'
              }`}>
                {teamsList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('qualification');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'qualification'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 shrink-0" />
                <span>Qualification</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('anticheat');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'anticheat'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Anti-Cheat</span>
              </div>
              {antiCheatList.filter(a => !a.resolved).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono-code bg-rose-500 text-white font-bold animate-pulse">
                  {antiCheatList.filter(a => !a.resolved).length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('score_adjust');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'score_adjust'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Score Adjust</span>
              </div>
            </button>
          </div>

          {/* Group 3: Question Engine */}
          <div className="space-y-1 pt-2 border-t border-[#DCE6F0]/60">
            <div className="px-3 py-1 text-[10px] font-mono-code font-bold text-[#64748B] uppercase tracking-wider">
              Question Engine
            </div>
            <button
              onClick={() => {
                setActiveTab('questions');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Question Bank</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-code ${
                activeTab === 'questions' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'
              }`}>
                {questionsList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('bulk_import');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'bulk_import'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 shrink-0" />
                <span>Bulk Import & Queue</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('team_questions');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'team_questions'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 shrink-0" />
                <span>Team Question</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('clues');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'clues'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Clues & Hints</span>
              </div>
            </button>
          </div>

          {/* Group 4: Communications & Records */}
          <div className="space-y-1 pt-2 border-t border-[#DCE6F0]/60">
            <div className="px-3 py-1 text-[10px] font-mono-code font-bold text-[#64748B] uppercase tracking-wider">
              Records & Comms
            </div>
            <button
              onClick={() => {
                setActiveTab('feedback');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'feedback'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Feedback</span>
              </div>
              {eventState?.feedbackActive && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono-code bg-emerald-500 text-white font-bold">
                  LIVE
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('certificates');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'certificates'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 shrink-0" />
                <span>Certificates</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('reports');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 shrink-0" />
                <span>Reports & XLSX</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('audit');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 shrink-0" />
                <span>Audit Logs</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('system_metrics');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'system_metrics'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 shrink-0" />
                <span>System & RAM</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('offline');
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'offline'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Offline Packet</span>
              </div>
            </button>
          </div>

          {/* Group 5: Administrator Access & Multiple Admins */}
          {(adminRole === 'SUPER_ADMIN' || adminRole === 'ADMIN') && (
            <div className="space-y-1 pt-2 border-t border-[#DCE6F0]/60">
              <div className="px-3 py-1 text-[10px] font-mono-code font-bold text-[#64748B] uppercase tracking-wider">
                Administration & Accounts
              </div>
              <button
                onClick={() => {
                  setActiveTab('admins');
                  setMobileNavOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold font-tech tracking-wide transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'admins'
                    ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Admin Accounts</span>
                </div>
              </button>
            </div>
          )}
        </aside>

        {/* Main Workspace Area */}
        <main className="flex-1 min-w-0 w-full">

      {/* ==========================================
          TAB: ANSWER CHECKER (SPELLING & SYNONYMS)
          ========================================== */}
      {activeTab === 'answer_checker' && (
        <AnswerCheckerControlPanel
          adminToken={adminToken}
          eventState={eventState}
          questions={questionsList}
          onRefreshState={onRefreshState}
        />
      )}

      {/* ==========================================
          TAB 1: ROUND & TIMER CONTROLS
          ========================================== */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">EVENT STATUS</span>
              <span className="text-sm font-bold text-[#172033]">{eventState?.status}</span>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">CURRENT ROUND</span>
              <span className="text-sm font-bold text-[#0891B2]">ROUND {eventState?.currentRound}</span>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">ENTRY DOOR</span>
              <span className={`text-sm font-bold font-tech flex items-center gap-1 ${
                eventState?.doorClosed ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {eventState?.doorClosed ? '🚪 CLOSED' : '🔓 OPEN'}
              </span>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">ROUND TIMER</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold font-mono-code ${
                  eventState?.eventLocked 
                    ? 'text-rose-600' 
                    : eventState?.isPaused || eventState?.status === 'PAUSED'
                      ? 'text-amber-600' 
                      : 'text-[#172033]'
                }`}>
                  {formatTimer(remainingSeconds)}
                </span>
                {eventState?.eventLocked && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-mono-code">
                    LOCKED
                  </span>
                )}
                {!eventState?.eventLocked && (eventState?.isPaused || eventState?.status === 'PAUSED') && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-mono-code">
                    PAUSED
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">TEAMS ONLINE</span>
              <span className="text-sm font-bold text-emerald-600">{eventState?.stats?.onlineTeams || 0} / {teamsList.length}</span>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">LOCKED TEAMS</span>
              <span className="text-sm font-bold text-amber-600">{eventState?.stats?.lockedTeams || 0}</span>
            </div>
            <div className="p-3 bg-white border border-[#DCE6F0] rounded-xl shadow-xs">
              <span className="text-[10px] font-mono-code text-[#64748B] block uppercase font-medium">SECURITY ALERTS</span>
              <span className="text-sm font-bold text-rose-600">{antiCheatList.filter(a => !a.resolved).length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Event Control Deck */}
            <div className="lg:col-span-2 bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-6">
              <div>
                <h3 className="font-tech text-sm font-bold text-[#0891B2] uppercase tracking-wider mb-1">
                  ROUND STAGE EXECUTION
                </h3>
                <p className="text-xs text-[#64748B]">
                  Switch rounds, start synchronized timers, or freeze the competition stage.
                </p>
              </div>

              {/* Round Switcher & Starter */}
              <div className="grid grid-cols-3 gap-3">
                {([1, 2, 3] as const).map((r) => {
                  const isCur = eventState?.currentRound === r;
                  const isLocked = eventState?.roundLocked?.[r];
                  const currentRoundSet = eventState?.activeQuestionSet?.[r] || 'A';
                  return (
                    <div key={r} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-tech text-xs font-bold text-[#172033]">
                          ROUND {r}
                        </span>
                        {isLocked && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code bg-rose-50 text-rose-700 border border-rose-200">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono-code text-[#64748B]">
                        <span>{r === 1 ? '30m • 1 pt' : r === 2 ? '15m • 2 pts' : '15m • 3 pts'}</span>
                        <span className="text-[#7C3AED] font-bold">Set {currentRoundSet}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#DCE6F0]">
                        <button
                          onClick={() => sendControl('start', { round: r })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold font-tech transition-all cursor-pointer ${
                            isCur && eventState?.status === 'RUNNING'
                              ? 'bg-[#06B6D4] text-white shadow-xs'
                              : 'bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#172033]'
                          }`}
                        >
                          START
                        </button>
                        <button
                          onClick={() => sendControl('round/toggle-lock', { round: r })}
                          className="py-1.5 px-2 rounded-lg text-xs font-mono-code bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#64748B] hover:text-[#172033] cursor-pointer"
                        >
                          {isLocked ? 'UNLOCK' : 'LOCK'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CLOSE THE DOOR / REGISTRATION GATE CONTROL */}
              <div className={`p-4 rounded-2xl border transition-all ${
                eventState?.doorClosed 
                  ? 'bg-rose-50/70 border-rose-300 shadow-xs' 
                  : 'bg-emerald-50/70 border-emerald-300 shadow-xs'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xl shadow-xs shrink-0 ${
                      eventState?.doorClosed 
                        ? 'bg-rose-100 text-rose-700 border border-rose-300' 
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    }`}>
                      {eventState?.doorClosed ? <DoorClosed className="w-6 h-6 text-rose-600" /> : <DoorOpen className="w-6 h-6 text-emerald-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-tech text-sm font-bold text-[#172033] tracking-wide uppercase">
                          {eventState?.doorClosed ? 'ENTRY DOOR CLOSED (REGISTRATION GATE LOCKED)' : 'ENTRY DOOR OPEN (OPEN ADMISSION)'}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold ${
                          eventState?.doorClosed 
                            ? 'bg-rose-600 text-white shadow-xs' 
                            : 'bg-emerald-600 text-white shadow-xs'
                        }`}>
                          {eventState?.doorClosed ? 'NEW PARTICIPANTS BLOCKED' : 'NEW TEAMS CAN ENTER'}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-tight">
                        {eventState?.doorClosed 
                          ? 'Teams registering or joining during/after round start are queued at the door until organizer grants permission.' 
                          : 'New contestant teams can register and immediately participate in Round 1.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="btn-admin-toggle-door"
                      onClick={() => sendControl('door/toggle')}
                      className={`py-2 px-4 rounded-xl text-xs font-tech font-bold tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                        eventState?.doorClosed 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95' 
                          : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
                      }`}
                    >
                      {eventState?.doorClosed ? <DoorOpen className="w-4 h-4" /> : <DoorClosed className="w-4 h-4" />}
                      <span>{eventState?.doorClosed ? 'OPEN THE DOOR' : 'CLOSE THE DOOR'}</span>
                    </button>
                  </div>
                </div>

                {/* Auto-close setting & Waiting queue */}
                <div className="mt-3 pt-3 border-t border-[#DCE6F0]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[#172033] font-medium">
                    <input
                      type="checkbox"
                      checked={eventState?.autoCloseDoorOnStart !== false}
                      onChange={() => sendControl('door/toggle-auto-close')}
                      className="w-4 h-4 text-[#0891B2] rounded border-[#DCE6F0] focus:ring-[#06B6D4]"
                    />
                    <span>Automatically close the door when Round 1 starts</span>
                  </label>

                  <div className="flex items-center gap-2 font-mono-code text-[11px]">
                    <span className="text-[#64748B]">Queue at Door:</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      teamsList.filter(t => t.doorAccessGranted === false).length > 0 
                        ? 'bg-amber-200 text-amber-900 border border-amber-400 animate-pulse' 
                        : 'bg-white text-[#64748B] border border-[#DCE6F0]'
                    }`}>
                      {teamsList.filter(t => t.doorAccessGranted === false).length} Waiting
                    </span>
                    {teamsList.filter(t => t.doorAccessGranted === false).length > 0 && (
                      <button
                        onClick={() => sendControl('door/grant-access', { target: 'ALL_WAITING' })}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-xs cursor-pointer"
                      >
                        ✓ ADMIT ALL
                      </button>
                    )}
                  </div>
                </div>

                {/* Waiting Teams Queue List if any */}
                {teamsList.filter(t => t.doorAccessGranted === false).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-2">
                    <div className="text-[11px] font-mono-code font-bold text-rose-800 uppercase flex items-center justify-between">
                      <span>LATE / NEW TEAMS WAITING FOR ROUND 1 ADMISSION:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {teamsList.filter(t => t.doorAccessGranted === false).map(t => (
                        <div key={t.id} className="p-2.5 bg-white border border-rose-300 rounded-xl shadow-xs flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono-code font-bold text-xs text-[#0891B2]">{t.id} • {t.name}</div>
                            <div className="text-[10px] text-[#64748B] truncate">{t.college}</div>
                            <div className="text-[10px] text-amber-700 font-mono-code font-semibold">Waiting at gate...</div>
                          </div>
                          <button
                            onClick={() => sendControl('door/grant-access', { teamId: t.id })}
                            className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold font-mono-code shrink-0 shadow-xs cursor-pointer"
                          >
                            ✓ ADMIT
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Question Set Selector for Current Round */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#7C3AED]" />
                    <span className="font-tech text-xs font-bold text-[#172033] tracking-wider">
                      PARTICIPANT QUESTION SET • ROUND {eventState?.currentRound || 1}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#7C3AED] font-bold">
                    ACTIVE: SET {eventState?.activeQuestionSet?.[eventState?.currentRound || 1] || 'A'}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Select which set of questions participants attend for Round {eventState?.currentRound || 1}. Switching updates all student screens immediately:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['A', 'B', 'C'] as const).map((s) => {
                    const curR = (eventState?.currentRound || 1) as RoundNumber;
                    const isActive = (eventState?.activeQuestionSet?.[curR] || 'A') === s;
                    const count = questionsList.filter((q) => q.round === curR && (q.set || 'A') === s).length;
                    return (
                      <button
                        key={s}
                        onClick={() => sendControl('set-question-set', { round: curR, set: s })}
                        className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#7C3AED] border-[#6D28D9] text-white shadow-sm font-bold'
                            : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033] hover:border-slate-300'
                        }`}
                      >
                        <div className="font-mono-code text-xs">SET {s}</div>
                        <div className="text-[10px] font-mono-code opacity-80">{count} Questions</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Clue Display Mode Toggle (Realistic Connected Images vs Vector Clue Panels) */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0891B2]" />
                    <span className="font-tech text-xs font-bold text-[#172033] tracking-wider">
                      VISUAL CLUE DISPLAY MODE (ALL PARTICIPANT SCREENS & PROJECTORS)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#0891B2] font-bold uppercase">
                    ACTIVE: {eventState?.clueDisplayMode === 'panels' ? 'VECTOR PANELS' : 'REAL PHOTOGRAPHIC'}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Switch between realistic real-world connected photos (2-3 connected images per question) or cryptographic vector clue panels:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/clue-display-mode', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${adminToken}`,
                          },
                          body: JSON.stringify({ mode: 'realistic' }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setControlMessage('Switched all screens to Real-World Photographic Clues!');
                          fetchAdminData();
                        }
                      } catch (err: any) {
                        setControlMessage(err.message || 'Failed to update mode');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      (eventState?.clueDisplayMode || 'realistic') === 'realistic'
                        ? 'bg-cyan-50 border-[#06B6D4] text-[#0891B2] shadow-xs font-bold'
                        : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033] hover:border-slate-300'
                    }`}
                  >
                    <div className="font-tech text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                      REALISTIC IMAGES
                    </div>
                    <div className="text-[10px] font-sans opacity-70 mt-0.5">
                      2-3 connected photographic clues per question
                    </div>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/clue-display-mode', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${adminToken}`,
                          },
                          body: JSON.stringify({ mode: 'panels' }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setControlMessage('Switched all screens to Vector Clue Panels!');
                          fetchAdminData();
                        }
                      } catch (err: any) {
                        setControlMessage(err.message || 'Failed to update mode');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      eventState?.clueDisplayMode === 'panels'
                        ? 'bg-purple-50 border-[#7C3AED] text-[#7C3AED] shadow-xs font-bold'
                        : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033] hover:border-slate-300'
                    }`}
                  >
                    <div className="font-tech text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                      VECTOR CLUE PANELS
                    </div>
                    <div className="text-[10px] font-sans opacity-70 mt-0.5">
                      Cryptographic SVG panels without descriptions
                    </div>
                  </button>
                </div>
              </div>

              {/* Optional Answer Checker Feature Toggle Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                eventState?.answerCheckerEnabled
                  ? 'bg-cyan-50/70 border-[#06B6D4] shadow-xs'
                  : 'bg-[#F8FAFC] border-[#DCE6F0]'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      eventState?.answerCheckerEnabled
                        ? 'bg-cyan-100 text-[#0891B2] border border-[#06B6D4]'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-tech text-xs font-bold text-[#172033] tracking-wider uppercase">
                          ANSWER CHECKER (SPELLING & TYPOS TOLERANT)
                        </h4>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-mono-code font-bold ${
                          eventState?.answerCheckerEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {eventState?.answerCheckerEnabled ? 'FEATURE ON' : 'FEATURE OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-tight">
                        {eventState?.answerCheckerEnabled
                          ? `Accepting participant answers with typos, spelling mistakes & related phrasing (${eventState?.answerCheckerTolerance || 'moderate'} mode).`
                          : 'Feature disabled. Only exact canonical answer and configured aliases are accepted.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => sendControl('toggle-answer-checker', { enabled: !eventState?.answerCheckerEnabled })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                        eventState?.answerCheckerEnabled
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white shadow-xs'
                      }`}
                    >
                      {eventState?.answerCheckerEnabled ? 'TURN OFF' : 'TURN ON'}
                    </button>

                    <button
                      onClick={() => setActiveTab('answer_checker')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#DCE6F0] hover:border-[#06B6D4] text-[#0891B2] font-mono-code text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>SETTINGS & TEST</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Timer Controls: Pause, Resume, Stop, +1m, +5m, -1m */}
              <div className="pt-4 border-t border-[#DCE6F0]">
                <div className="text-[11px] font-mono-code text-[#64748B] uppercase mb-2 font-medium">
                  Timer Synchronization & Adjustments
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {eventState?.isPaused ? (
                    <button
                      onClick={() => sendControl('resume')}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-tech tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" />
                      RESUME
                    </button>
                  ) : (
                    <button
                      onClick={() => sendControl('pause')}
                      disabled={eventState?.status !== 'RUNNING'}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs font-tech tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      PAUSE
                    </button>
                  )}

                  <button
                    onClick={() => sendControl('stop')}
                    disabled={eventState?.status === 'COMPLETED' || eventState?.status === 'WAITING'}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-[#172033] border border-[#DCE6F0] font-bold text-xs font-tech tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    STOP
                  </button>

                  <button
                    onClick={() => sendControl('round/extend-time', { seconds: 60 })}
                    className="py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#0891B2] font-bold text-xs font-mono-code cursor-pointer"
                  >
                    +1 MIN
                  </button>

                  <button
                    onClick={() => sendControl('round/extend-time', { seconds: 300 })}
                    className="py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#0891B2] font-bold text-xs font-mono-code cursor-pointer"
                  >
                    +5 MINS
                  </button>
                </div>
              </div>

              {/* Question Navigation */}
              <div className="pt-4 border-t border-[#DCE6F0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono-code text-[#64748B] uppercase font-medium">
                    QUESTION NAVIGATION (ACTIVE: Q{(eventState?.currentQuestionIndex || 0) + 1} / {eventState?.totalQuestionsInRound})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => sendControl('prev')}
                    className="py-2.5 px-3 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] text-[#172033] hover:text-[#0891B2] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    PREVIOUS QUESTION
                  </button>
                  <button
                    onClick={() => sendControl('next')}
                    className="py-2.5 px-3 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] text-[#172033] hover:text-[#0891B2] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>NEXT QUESTION</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reset Event Button (Guarded) */}
              <div className="pt-4 border-t border-[#DCE6F0] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-600">Emergency Event Reset</div>
                  <div className="text-[10px] text-[#64748B]">Clears all submissions, resets round 1, zeroes scores</div>
                </div>
                <button
                  onClick={() => setShowResetModal(true)}
                  className="py-2 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold font-mono-code flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RESET EVENT
                </button>
              </div>
            </div>

            {/* Side Column: Round 3 Digital Buzzer & Active Clue Inspector */}
            <div className="space-y-6">
              {/* Round-By-Round Digital Buzzer Engine */}
              <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${eventState?.buzzerActive ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
                    <h3 className="font-tech text-sm font-bold text-[#172033] tracking-wider">
                      DIGITAL BUZZER ENGINE
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                    eventState?.buzzerActive ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-[#F8FAFC] text-[#64748B] border border-[#DCE6F0]'
                  }`}>
                    {eventState?.buzzerActive ? 'BUZZER ARMED' : 'LOCKED'}
                  </span>
                </div>

                {/* Per-Round Buzzer Switches (R1, R2, R3) */}
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#DCE6F0] space-y-2">
                  <div className="text-[10px] font-mono-code text-[#0891B2] uppercase font-bold flex items-center justify-between">
                    <span>ROUND BUZZER PERMISSIONS</span>
                    <span className="text-[#64748B]">ADMIN CONTROL</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((rNum) => {
                      const isEnabled = eventState?.buzzerRoundEnabled?.[rNum] ?? (rNum === 3);
                      return (
                        <button
                          key={rNum}
                          type="button"
                          onClick={() => sendControl('buzzer-toggle', { round: rNum })}
                          className={`py-2 px-2.5 rounded-lg text-xs font-mono-code font-bold flex flex-col items-center gap-1 transition-all border cursor-pointer ${
                            isEnabled
                              ? 'bg-cyan-50 border-[#06B6D4] text-[#0891B2] shadow-xs'
                              : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                          }`}
                        >
                          <span>ROUND {rNum}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isEnabled ? 'bg-[#06B6D4] text-white font-bold' : 'bg-slate-200 text-slate-600'}`}>
                            {isEnabled ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Simultaneous Tie Warning Alert */}
                {eventState?.buzzerTie && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1 shadow-xs">
                    <div className="text-xs font-bold font-tech tracking-wider text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      SIMULTANEOUS TIE DETECTED!
                    </div>
                    <p className="text-[11px] text-amber-800 leading-tight">
                      Multiple contestants pressed the buzzer within the 85ms microsecond delta window! Review contenders below and decide which team to recognize.
                    </p>
                  </div>
                )}

                {/* Contenders List & Winner */}
                {eventState?.buzzerContenders && eventState.buzzerContenders.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-mono-code text-[#64748B] uppercase font-bold flex items-center justify-between">
                      <span>BUZZ TIMESTAMP CONTENDERS ({eventState.buzzerContenders.length})</span>
                      <span>DELTA (MS)</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {eventState.buzzerContenders.map((contender, idx) => (
                        <div
                          key={`${contender.teamId}-${idx}`}
                          className={`p-3 rounded-xl border transition-all ${
                            idx === 0
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                              : contender.isTie
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-[#F8FAFC] border-[#DCE6F0] text-[#172033]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded ${
                                idx === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-xs text-[#172033]">
                                {contender.teamName}
                              </span>
                              {contender.isTie && (
                                <span className="text-[9px] font-mono-code px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold">
                                  TIE
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] font-mono-code text-[#0891B2] font-bold">
                              {contender.timeDeltaMs === 0 ? 'FIRST BUZZ' : `+${contender.timeDeltaMs}ms`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[10px] font-mono-code text-[#64748B]">
                            <span>ID: {contender.teamId}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => sendControl('buzzer-award', { awardPoints: true, points: (eventState?.currentRound === 1 ? 1 : eventState?.currentRound === 2 ? 2 : 3), teamId: contender.teamId })}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                +{eventState?.currentRound === 1 ? 1 : eventState?.currentRound === 2 ? 2 : 3} {eventState?.currentRound === 1 ? 'PT' : 'PTS'}
                              </button>
                              <button
                                onClick={() => sendControl('buzzer-award', { awardPoints: false, teamId: contender.teamId })}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#64748B] font-bold text-[10px] cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                PASS
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : eventState?.buzzerWinner ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 mb-4 space-y-2">
                    <div className="text-[10px] font-mono-code uppercase text-emerald-700 font-bold">
                      FIRST BUZZ RECORDED • SEQ #{eventState.buzzerWinner.sequenceNumber}
                    </div>
                    <div className="text-base font-bold text-[#172033]">
                      {eventState.buzzerWinner.teamName}
                    </div>
                    <div className="text-xs font-mono-code text-[#64748B]">
                      Team ID: {eventState.buzzerWinner.teamId}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200">
                      <button
                        onClick={() => sendControl('buzzer-award', { awardPoints: true, points: (eventState?.currentRound === 1 ? 1 : eventState?.currentRound === 2 ? 2 : 3) })}
                        className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        +{eventState?.currentRound === 1 ? 1 : eventState?.currentRound === 2 ? 2 : 3} {eventState?.currentRound === 1 ? 'PT' : 'PTS'} (CORRECT)
                      </button>
                      <button
                        onClick={() => sendControl('buzzer-award', { awardPoints: false })}
                        className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        PASS / WRONG
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] text-center mb-4">
                    <Radio className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs font-mono-code text-[#64748B] block">
                      {eventState?.buzzerActive ? 'Buzzer is ARMED & waiting for contestants...' : 'Buzzer is currently locked'}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => sendControl('buzzer-reset')}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  RE-ARM BUZZER FOR ALL TEAMS
                </button>
              </div>

              {/* Active Clue Inspector (With Authoritative Answer Key for Organizers) */}
              {activeQuestion && (
                <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DCE6F0]">
                    <span className="text-[10px] font-mono-code text-[#0891B2] uppercase font-bold">
                      ACTIVE QUESTION PREVIEW
                    </span>
                    <span className="text-xs font-mono-code text-[#64748B]">
                      ID: {activeQuestion.id} • {activeQuestion.points} {activeQuestion.points === 1 ? 'pt' : 'pts'}
                    </span>
                  </div>

                  <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#DCE6F0]">
                    <RebusClueRenderer
                      panels={activeQuestion.cluePanels}
                      customImageUrl={activeQuestion.customImageUrl}
                      images={activeQuestion.images}
                      questionId={activeQuestion.id}
                      explanation={activeQuestion.domain}
                      displayMode={eventState?.clueDisplayMode || 'realistic'}
                    />
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-code text-emerald-800 uppercase font-bold block">
                        OFFICIAL AUTHORITATIVE ANSWER
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAnswerModal({
                            open: true,
                            questionId: activeQuestion.id,
                            round: activeQuestion.round,
                            questionNumber: activeQuestion.questionNumber,
                            correctAnswer: activeQuestion.correctAnswer,
                            aliases: activeQuestion.aliases ? activeQuestion.aliases.join(', ') : '',
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-tech text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>UPDATE ANSWER</span>
                      </button>
                    </div>

                    <span className="font-mono-code font-bold text-sm text-emerald-900 block">
                      {activeQuestion.correctAnswer}
                    </span>
                    {activeQuestion.aliases.length > 0 && (
                      <span className="text-[10px] font-mono-code text-[#64748B] block">
                        Accepted Variations: {activeQuestion.aliases.join(', ')}
                      </span>
                    )}

                    {quickAnswerBanner && (
                      <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold">
                        {quickAnswerBanner}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: PARTICIPANTS & LOCK CONTROLS
          ========================================== */}
      {activeTab === 'teams' && (
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                REGISTERED CONTESTANT TEAMS
              </h3>
              <p className="text-xs text-[#64748B]">
                Manage team authorizations, door permissions, contact details, lock/unlock access, or issue warnings.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {teamsList.filter(t => t.doorAccessGranted === false).length > 0 && (
                <button
                  id="btn-admin-admit-all"
                  onClick={() => sendControl('door/grant-access', { target: 'ALL_WAITING' })}
                  className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-all cursor-pointer"
                >
                  <DoorOpen className="w-4 h-4" />
                  <span>ADMIT ALL WAITING ({teamsList.filter(t => t.doorAccessGranted === false).length})</span>
                </button>
              )}

              <button
                id="btn-admin-add-team"
                onClick={() => { setShowAddTeamModal(true); setAddTeamError(null); }}
                className="py-2 px-3.5 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>ADD TEAM</span>
              </button>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Team ID, name, college..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#06B6D4] font-mono-code"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DCE6F0] text-[#64748B] font-mono-code">
                  <th className="pb-3 px-3">TEAM ID</th>
                  <th className="pb-3 px-3">TEAM NAME</th>
                  <th className="pb-3 px-3">PARTICIPANTS</th>
                  <th className="pb-3 px-3">COLLEGE</th>
                  <th className="pb-3 px-3">SCORE (R1/R2/R3)</th>
                  <th className="pb-3 px-3">DOOR ACCESS</th>
                  <th className="pb-3 px-3">STATUS</th>
                  <th className="pb-3 px-3">WARNINGS</th>
                  <th className="pb-3 px-3 text-right">CONTROLS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE6F0]">
                {teamsList
                  .filter(t => 
                    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.college.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-3 font-mono-code font-bold text-[#0891B2]">
                        {t.id}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#172033]">
                        {t.name}
                        {t.isOnline && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2" title="Online" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#172033]">
                        {t.participant1} {t.participant2 ? `& ${t.participant2}` : ''}
                      </td>
                      <td className="py-3 px-3 text-[#64748B] max-w-[180px] truncate">{t.college}</td>
                      <td className="py-3 px-3 font-mono-code text-[#172033]">
                        {t.round1Score} / {t.round2Score} / {t.round3Score} = <span className="font-bold text-[#0891B2]">{t.totalScore}</span>
                      </td>
                      <td className="py-3 px-3">
                        {t.doorAccessGranted === false ? (
                          <button
                            onClick={() => sendControl('door/grant-access', { teamId: t.id })}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-emerald-600 hover:text-white text-amber-900 border border-amber-300 text-[10px] font-mono-code font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                            title="Click to admit this team into Round 1"
                          >
                            <DoorClosed className="w-3 h-3 text-amber-700" />
                            <span>WAITING (ADMIT)</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <DoorOpen className="w-3 h-3 text-emerald-600" />
                            <span>ADMITTED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'WARNED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : t.status === 'LOCKED'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {t.status}
                        </span>
                        {t.lockReason && (
                          <div className="text-[10px] text-[#64748B] truncate max-w-[140px]" title={t.lockReason}>
                            {t.lockReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono-code font-bold">
                        <span className={t.warningsCount >= 2 ? 'text-rose-600' : t.warningsCount > 0 ? 'text-amber-600' : 'text-[#64748B]'}>
                          {t.warningsCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {t.doorAccessGranted === false ? (
                            <button
                              onClick={() => sendControl('door/grant-access', { teamId: t.id })}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-xs cursor-pointer"
                              title="Grant admission access"
                            >
                              ADMIT
                            </button>
                          ) : (
                            <button
                              onClick={() => sendControl('door/revoke-access', { teamId: t.id })}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 border border-[#DCE6F0] text-[#64748B] hover:text-rose-700 text-[10px] font-bold cursor-pointer"
                              title="Revoke access / Hold at gate"
                            >
                              HOLD
                            </button>
                          )}

                          <button
                            onClick={() => setEditingTeam(t)}
                            className="px-2 py-1 rounded bg-[#F8FAFC] hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] text-[10px] font-bold cursor-pointer"
                            title="Edit participant details"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => handleTeamAction(t.id, 'WARN')}
                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold cursor-pointer"
                          >
                            WARN
                          </button>

                          {t.status === 'LOCKED' ? (
                            <button
                              onClick={() => handleTeamAction(t.id, 'UNLOCK')}
                              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              UNLOCK
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTeamAction(t.id, 'LOCK')}
                              className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-bold cursor-pointer"
                            >
                              LOCK
                            </button>
                          )}

                          {t.status === 'DISQUALIFIED' ? (
                            <button
                              onClick={() => handleTeamAction(t.id, 'RESTORE')}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold cursor-pointer"
                            >
                              RESTORE
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTeamAction(t.id, 'DISQUALIFY')}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold cursor-pointer"
                            >
                              DISQUALIFY
                            </button>
                          )}

                          <button
                            onClick={() => setTeamToDelete(t)}
                            className="px-2 py-1 rounded bg-[#F8FAFC] hover:bg-rose-50 border border-[#DCE6F0] text-[#64748B] hover:text-rose-700 text-[10px] font-bold transition-all cursor-pointer"
                            title="Remove team from symposium"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 3: ANTI-CHEAT SECURITY CENTER & TRIAGE
          ========================================== */}
      {activeTab === 'anticheat' && (
        <div className="space-y-6">
          {/* Policy Banner */}
          <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    REAL-TIME ANTI-CHEATING INCIDENT TRIAGE
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Rule Policy: Automatic Account Lockout at <strong className="text-rose-600 font-mono-code">{eventState?.maxViolations || 3} Violation{(eventState?.maxViolations || 3) > 1 ? 's' : ''}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickDownload('/api/admin/export-anticheat-csv', 'TechBridge_AntiCheat_Report.csv')}
                  className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs font-mono-code text-[#0891B2] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT ANTI-CHEAT CSV</span>
                </button>
              </div>
            </div>

            {/* Admin Violation Limit Selector */}
            <div className="mt-4 pt-3 border-t border-[#DCE6F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#F8FAFC] p-3 rounded-xl border">
              <div>
                <span className="text-xs font-tech font-bold text-[#172033] uppercase tracking-wide block">
                  ⚙️ CONFIGURE LOCKOUT VIOLATION LIMIT
                </span>
                <span className="text-[11px] text-[#64748B] block mt-0.5">
                  Select how many violations a participant is permitted before their account/device is automatically locked.
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5].map((count) => {
                  const isSelected = (eventState?.maxViolations || 3) === count;
                  return (
                    <button
                      key={count}
                      onClick={() => handleSetMaxViolations(count)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                          : 'bg-white hover:bg-slate-100 border border-[#DCE6F0] text-[#172033]'
                      }`}
                    >
                      {count} {count === 1 ? 'Violation' : 'Violations'} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Severity Filter Tabs */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#DCE6F0]">
              {(['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                    severityFilter === sev
                      ? 'bg-[#06B6D4] text-white'
                      : 'bg-[#F8FAFC] border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Log Table with Action Buttons */}
          <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm">
            {antiCheatList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE6F0] text-[#64748B] font-mono-code">
                      <th className="pb-3 px-3">TIMESTAMP</th>
                      <th className="pb-3 px-3">TEAM</th>
                      <th className="pb-3 px-3">SEVERITY</th>
                      <th className="pb-3 px-3">INCIDENT TYPE</th>
                      <th className="pb-3 px-3">STAGE / Q</th>
                      <th className="pb-3 px-3">DETAILS</th>
                      <th className="pb-3 px-3">STATUS</th>
                      <th className="pb-3 px-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6F0]">
                    {antiCheatList
                      .filter(a => severityFilter === 'ALL' || a.severity === severityFilter)
                      .map((alert) => (
                        <tr key={alert.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-3 px-3 font-mono-code text-[#64748B] whitespace-nowrap">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#172033]">
                            {alert.teamName} <span className="text-[10px] font-mono-code text-[#64748B]">({alert.teamId})</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                              alert.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : alert.severity === 'HIGH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : alert.severity === 'WARNING'
                                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {alert.severity}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono-code text-amber-700 font-bold">
                            {alert.eventType}
                          </td>
                          <td className="py-3 px-3 font-mono-code text-[#64748B]">
                            R{alert.round} / Q{alert.questionNumber}
                          </td>
                          <td className="py-3 px-3 text-[#172033] max-w-xs truncate" title={alert.details}>
                            {alert.details}
                          </td>
                          <td className="py-3 px-3">
                            {alert.resolved ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-slate-100 text-[#64748B]">
                                {alert.actionTaken || 'RESOLVED'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                UNRESOLVED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleAntiCheatAction(alert.id, 'WARN')}
                                className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-[10px] font-bold cursor-pointer"
                                title="Issue official warning to team"
                              >
                                WARN
                              </button>
                              <button
                                onClick={() => handleAntiCheatAction(alert.id, 'LOCKED')}
                                className="px-2 py-1 rounded bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-[10px] font-bold cursor-pointer"
                                title="Lock team access"
                              >
                                LOCK
                              </button>
                              <button
                                onClick={() => handleAntiCheatAction(alert.id, 'DISQUALIFY')}
                                className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[10px] font-bold cursor-pointer"
                                title="Disqualify team from competition"
                              >
                                DISQUALIFY
                              </button>
                              <button
                                onClick={() => handleAntiCheatAction(alert.id, 'DISMISSED')}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#64748B] text-[10px] font-bold cursor-pointer"
                                title="Dismiss alert as false positive"
                              >
                                DISMISS
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-[#64748B] font-mono-code text-xs">
                No security anomalies recorded. Competition arena is clean.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 4: LEADERBOARD & RESULTS
          ========================================== */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE6F0]">
            <div>
              <h3 className="font-tech text-base font-bold text-amber-600 tracking-wider">
                COMPETITION STANDINGS & PODIUM LEADERBOARD
              </h3>
              <p className="text-xs text-[#64748B]">
                Independent round rankings and participant average answer time metrics
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => sendControl('toggle-leaderboard')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono-code font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  eventState?.showLeaderboard
                    ? 'bg-[#06B6D4] text-white border-[#0891B2]'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#DCE6F0]'
                }`}
              >
                {eventState?.showLeaderboard ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{eventState?.showLeaderboard ? 'PUBLIC SCOREBOARD: VISIBLE' : 'PUBLIC SCOREBOARD: HIDDEN'}</span>
              </button>

              <button
                onClick={() => handleQuickDownload('/api/admin/export-csv?round=all', 'TechBridge_All_Rounds_Leaderboard.csv')}
                className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                title="Download CSV report for all rounds combined"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>EXPORT ALL R</span>
              </button>

              <button
                onClick={() => handleQuickDownload('/api/admin/reports/export-xlsx?round=all', 'TechBridge_Official_Complete_Report.xlsx')}
                className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                title="Download Complete Multi-Sheet Excel Workbook"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>EXCEL WORKBOOK</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs for Round View Selection: ALL ROUNDS, ROUND 1, ROUND 2, ROUND 3 */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-[#F8FAFC] p-2 rounded-xl border border-[#DCE6F0]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-tech font-bold text-[#172033] tracking-wide flex items-center gap-1.5 px-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                LEADERBOARD VIEW:
              </span>
              <button
                onClick={() => setLeaderboardRoundFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                  leaderboardRoundFilter === 'ALL'
                    ? 'bg-[#0891B2] text-white shadow-xs'
                    : 'bg-white border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                }`}
              >
                🏆 OVERALL (ALL ROUNDS)
              </button>
              <button
                onClick={() => setLeaderboardRoundFilter(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                  leaderboardRoundFilter === 1
                    ? 'bg-[#06B6D4] text-white shadow-xs'
                    : 'bg-white border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                }`}
              >
                ⚡ ROUND 1 LEADERBOARD
              </button>
              <button
                onClick={() => setLeaderboardRoundFilter(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                  leaderboardRoundFilter === 2
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'bg-white border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                }`}
              >
                🔥 ROUND 2 LEADERBOARD
              </button>
              <button
                onClick={() => setLeaderboardRoundFilter(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                  leaderboardRoundFilter === 3
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white border border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                }`}
              >
                🎯 ROUND 3 LEADERBOARD
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickDownload(`/api/admin/export-csv?round=${leaderboardRoundFilter}`, `TechBridge_Leaderboard_${leaderboardRoundFilter}.csv`)}
                className="py-1 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-[#DCE6F0] text-[#0891B2] font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD {leaderboardRoundFilter === 'ALL' ? 'ALL' : `R${leaderboardRoundFilter}`} CSV</span>
              </button>
            </div>
          </div>

          {/* Table Display based on selected round filter */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DCE6F0] text-[#64748B] font-mono-code">
                  <th className="pb-3 px-3">
                    {leaderboardRoundFilter === 'ALL' ? 'OVERALL RANK' : `R${leaderboardRoundFilter} RANK`}
                  </th>
                  <th className="pb-3 px-3">TEAM ID / NAME</th>
                  <th className="pb-3 px-3">COLLEGE</th>
                  {leaderboardRoundFilter === 'ALL' ? (
                    <>
                      <th className="pb-3 px-3 text-center">R1 SCORE</th>
                      <th className="pb-3 px-3 text-center">R2 SCORE</th>
                      <th className="pb-3 px-3 text-center">R3 SCORE</th>
                      <th className="pb-3 px-3 text-right">TOTAL PTS</th>
                      <th className="pb-3 px-3 text-center">R1 AVG TIME</th>
                      <th className="pb-3 px-3 text-center">R2 AVG TIME</th>
                      <th className="pb-3 px-3 text-center">R3 AVG TIME</th>
                      <th className="pb-3 px-3 text-right">OVERALL AVG TIME</th>
                    </>
                  ) : (
                    <>
                      <th className="pb-3 px-3 text-center">ROUND {leaderboardRoundFilter} SCORE</th>
                      <th className="pb-3 px-3 text-center">AVG TIME PER ANSWER</th>
                      <th className="pb-3 px-3 text-center">ATTEMPTED</th>
                      <th className="pb-3 px-3 text-right font-bold">STATUS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE6F0]">
                {[...teamsList]
                  .sort((a, b) => {
                    if (leaderboardRoundFilter === 1) {
                      if (b.round1Score !== a.round1Score) return b.round1Score - a.round1Score;
                      const aSubs = submissionsList.filter(s => s.teamId === a.id && s.round === 1);
                      const bSubs = submissionsList.filter(s => s.teamId === b.id && s.round === 1);
                      const aAvg = aSubs.length > 0 ? aSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / aSubs.length : 999;
                      const bAvg = bSubs.length > 0 ? bSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / bSubs.length : 999;
                      return aAvg - bAvg;
                    }
                    if (leaderboardRoundFilter === 2) {
                      if (b.round2Score !== a.round2Score) return b.round2Score - a.round2Score;
                      const aSubs = submissionsList.filter(s => s.teamId === a.id && s.round === 2);
                      const bSubs = submissionsList.filter(s => s.teamId === b.id && s.round === 2);
                      const aAvg = aSubs.length > 0 ? aSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / aSubs.length : 999;
                      const bAvg = bSubs.length > 0 ? bSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / bSubs.length : 999;
                      return aAvg - bAvg;
                    }
                    if (leaderboardRoundFilter === 3) {
                      if (b.round3Score !== a.round3Score) return b.round3Score - a.round3Score;
                      const aSubs = submissionsList.filter(s => s.teamId === a.id && s.round === 3);
                      const bSubs = submissionsList.filter(s => s.teamId === b.id && s.round === 3);
                      const aAvg = aSubs.length > 0 ? aSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / aSubs.length : 999;
                      const bAvg = bSubs.length > 0 ? bSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / bSubs.length : 999;
                      return aAvg - bAvg;
                    }
                    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                    const aSubs = submissionsList.filter(s => s.teamId === a.id);
                    const bSubs = submissionsList.filter(s => s.teamId === b.id);
                    const aAvg = aSubs.length > 0 ? aSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / aSubs.length : 999;
                    const bAvg = bSubs.length > 0 ? bSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / bSubs.length : 999;
                    return aAvg - bAvg;
                  })
                  .map((t, index) => {
                    const r1Subs = submissionsList.filter(s => s.teamId === t.id && s.round === 1);
                    const r2Subs = submissionsList.filter(s => s.teamId === t.id && s.round === 2);
                    const r3Subs = submissionsList.filter(s => s.teamId === t.id && s.round === 3);
                    const allSubs = submissionsList.filter(s => s.teamId === t.id);

                    const r1AvgSec = r1Subs.length > 0 ? (r1Subs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / r1Subs.length).toFixed(1) : null;
                    const r2AvgSec = r2Subs.length > 0 ? (r2Subs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / r2Subs.length).toFixed(1) : null;
                    const r3AvgSec = r3Subs.length > 0 ? (r3Subs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / r3Subs.length).toFixed(1) : null;
                    const overallAvgSec = allSubs.length > 0 ? (allSubs.reduce((s, x) => s + (x.timeTakenSeconds || 30), 0) / allSubs.length).toFixed(1) : null;

                    const curRoundSubs = leaderboardRoundFilter === 1 ? r1Subs : leaderboardRoundFilter === 2 ? r2Subs : leaderboardRoundFilter === 3 ? r3Subs : allSubs;
                    const curAvgSec = leaderboardRoundFilter === 1 ? r1AvgSec : leaderboardRoundFilter === 2 ? r2AvgSec : leaderboardRoundFilter === 3 ? r3AvgSec : overallAvgSec;
                    const curRoundScore = leaderboardRoundFilter === 1 ? t.round1Score : leaderboardRoundFilter === 2 ? t.round2Score : leaderboardRoundFilter === 3 ? t.round3Score : t.totalScore;

                    return (
                      <tr key={t.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-3 font-mono-code font-extrabold text-sm text-[#172033]">
                          {index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#172033]">
                          {t.name} <span className="text-[10px] font-mono-code text-[#64748B]">({t.id})</span>
                        </td>
                        <td className="py-3 px-3 text-[#64748B] max-w-xs truncate" title={t.college}>{t.college}</td>

                        {leaderboardRoundFilter === 'ALL' ? (
                          <>
                            <td className="py-3 px-3 font-mono-code text-center text-[#172033] font-bold">{t.round1Score}</td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#172033] font-bold">{t.round2Score}</td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#172033] font-bold">{t.round3Score}</td>
                            <td className="py-3 px-3 font-mono-code font-extrabold text-[#0891B2] text-right text-base">
                              {t.totalScore}
                            </td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#64748B]">
                              {r1AvgSec ? `${r1AvgSec}s` : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#64748B]">
                              {r2AvgSec ? `${r2AvgSec}s` : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#64748B]">
                              {r3AvgSec ? `${r3AvgSec}s` : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-mono-code font-bold text-center text-emerald-700">
                              {overallAvgSec ? `${overallAvgSec}s / answer` : 'N/A'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3 font-mono-code text-center text-[#0891B2] font-black text-sm">
                              {curRoundScore} PTS
                            </td>
                            <td className="py-3 px-3 font-mono-code text-center text-emerald-700 font-bold">
                              {curAvgSec ? `⏱️ ${curAvgSec}s / answer` : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-mono-code text-center text-[#64748B]">
                              {curRoundSubs.length} questions
                            </td>
                            <td className="py-3 px-3 text-right font-mono-code">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : t.status === 'WARNED'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : t.status === 'LOCKED'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 5: QUESTION BANK & SET MANAGER
          ========================================== */}
      {activeTab === 'questions' && (
        <QuestionManager
          questions={questionsList}
          activeQuestionSet={eventState?.activeQuestionSet || { 1: 'A', 2: 'A', 3: 'A' }}
          currentRound={(eventState?.currentRound || 1) as RoundNumber}
          adminToken={adminToken}
          onRefresh={fetchAdminData}
          onSelectQuestionSet={async (round, set) => {
            await sendControl('set-question-set', { round, set });
          }}
          onDeleteQuestion={async (questionId) => {
            await sendControl('question/delete', { questionId });
          }}
          onSaveQuestion={async (question, isEdit) => {
            if (isEdit) {
              await sendControl('question/edit', { question });
            } else {
              await sendControl('question/add', { question });
            }
          }}
          onUploadQuestions={async (questions, round, set, mode) => {
            await sendControl('questions/upload', { questions, round, set, mode });
          }}
          onSetConfig={async (round, set, maxCount, action) => {
            await sendControl('questions/set-config', { round, set, maxCount, action });
          }}
          onMergeSets={async (round, sourceSet, targetSet, keepSource) => {
            await performActionWithFeedback(() => sendControl('questions/merge-sets', { round, sourceSet, targetSet, keepSource }));
          }}
          onMoveQuestions={async (payload) => {
            await performActionWithFeedback(() => sendControl('questions/move', payload));
          }}
          onAttachImage={async (questionId, imageUrl, images) => {
            await performActionWithFeedback(() => sendControl('question/upload-image', { questionId, imageUrl, images }));
          }}
          onDeleteSelectedQuestions={async (questionIds) => {
            await performActionWithFeedback(() => sendControl('questions/delete-selected', { questionIds }));
          }}
          onDeleteSet={async (round, set, confirmation) => {
            await performActionWithFeedback(() => sendControl('questions/delete-set', { round, set, confirmation }));
          }}
          onDeleteAllQuestions={async (confirmation) => {
            await performActionWithFeedback(() => sendControl('questions/delete-all', { confirmation }));
          }}
          onBulkUpdateImages={async (updates) => {
            await performActionWithFeedback(() => sendControl('questions/bulk-update-images', { updates }));
          }}
        />
      )}

      {/* ==========================================
          TAB 6: AUDIT LOGS & SYSTEM BACKUP
          ========================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Export Controls Bar */}
          <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                ADMINISTRATIVE AUDIT TRAIL & SYSTEM ARCHIVE
              </h3>
              <p className="text-xs text-[#64748B]">
                Immutable chronological log of all administrator actions, timer modifications, and security incidents.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickDownload('/api/admin/export-audit-csv', 'TechBridge_Audit_Logs.csv')}
                className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs font-mono-code text-[#0891B2] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>AUDIT CSV</span>
              </button>

              <button
                onClick={() => handleQuickDownload('/api/admin/export-backup-json', 'TechBridge_System_Backup.json')}
                className="py-1.5 px-3 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SYSTEM BACKUP JSON</span>
              </button>
            </div>
          </div>

          {/* Persistent Backup Guide Banner */}
          <div className="p-4 bg-gradient-to-r from-cyan-50/90 to-blue-50/90 border border-cyan-200 rounded-2xl shadow-xs space-y-1.5 font-mono text-xs text-cyan-950">
            <div className="font-bold flex items-center gap-2 text-cyan-900">
              <span>💾 Export System Backup (.json)</span>
            </div>
            <p className="text-[11px] text-cyan-900/80 leading-relaxed">
              In the Admin Dashboard under System Management / Backup, you can click <strong className="font-bold underline">"Download System Backup"</strong> (<code className="bg-cyan-100 px-1 py-0.5 rounded font-bold">TechBridge_System_Backup.json</code>). This saves a complete snapshot of all your current teams, scores, and custom question bank with all uploaded images to your computer.
            </p>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm">
            {auditLogsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE6F0] text-[#64748B] font-mono-code">
                      <th className="pb-3 px-3">TIMESTAMP</th>
                      <th className="pb-3 px-3">ADMINISTRATOR</th>
                      <th className="pb-3 px-3">ACTION</th>
                      <th className="pb-3 px-3">TARGET</th>
                      <th className="pb-3 px-3">OLD VALUE</th>
                      <th className="pb-3 px-3">NEW VALUE</th>
                      <th className="pb-3 px-3">DETAILS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6F0] font-mono-code">
                    {auditLogsList.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3 text-[#64748B] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 text-[#0891B2] font-bold">
                          {log.adminUsername} <span className="text-[9px] text-[#64748B]">({log.role})</span>
                        </td>
                        <td className="py-2.5 px-3 text-amber-700 font-bold">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-[#172033]">
                          {log.target}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {log.oldValue || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600">
                          {log.newValue || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B] max-w-xs truncate" title={log.details}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-[#64748B] font-mono-code text-xs">
                Audit trail initialized. Actions will be logged here in real-time.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB: ANSWERED / NOT ANSWERED MONITORING
          ========================================== */}
      {activeTab === 'monitoring' && (
        <AnsweredMonitoringPanel
          adminToken={adminToken}
          eventState={eventState}
          questions={questionsList}
        />
      )}

      {/* ==========================================
          TAB: BULK QUESTION IMPORT & REVIEW QUEUE
          ========================================== */}
      {activeTab === 'bulk_import' && (
        <BulkQuestionImportPanel
          adminToken={adminToken}
          onQuestionsImported={() => {
            fetchAdminData();
            onRefreshState();
          }}
        />
      )}

      {/* ==========================================
          TAB: TEAM-SPECIFIC QUESTION CONTROL
          ========================================== */}
      {activeTab === 'team_questions' && (
        <TeamQuestionControlPanel
          adminToken={adminToken}
          questions={questionsList}
          teams={teamsList}
          onSuccess={() => {
            fetchAdminData();
            onRefreshState();
          }}
        />
      )}

      {/* ==========================================
          TAB: DYNAMIC CLUES & PROGRESSIVE HINTS
          ========================================== */}
      {activeTab === 'clues' && (
        <DynamicClueControlPanel
          adminToken={adminToken}
          eventState={eventState}
          questions={questionsList}
          teams={teamsList}
          onSuccess={() => {
            fetchAdminData();
            onRefreshState();
          }}
        />
      )}

      {/* ==========================================
          TAB: MANUAL SCORE ADJUSTMENT ENGINE
          ========================================== */}
      {activeTab === 'score_adjust' && (
        <ManualScoreAdjustmentPanel
          adminToken={adminToken}
          teams={teamsList}
          onSuccess={() => {
            fetchAdminData();
            onRefreshState();
          }}
        />
      )}

      {/* ==========================================
          TAB: ROUND QUALIFICATION & ADVANCEMENT
          ========================================== */}
      {activeTab === 'qualification' && (
        <QualificationPanel
          adminToken={adminToken}
          currentRound={eventState?.currentRound || 1}
          teams={teamsList}
          onSuccess={() => {
            fetchAdminData();
            onRefreshState();
          }}
        />
      )}

      {/* ==========================================
          TAB: EVENT REPORTS & XLSX DOSSIER
          ========================================== */}
      {activeTab === 'reports' && (
        <EventReportsPanel adminToken={adminToken} />
      )}

      {/* ==========================================
          TAB: PARTICIPANT FEEDBACK & EVALUATION
          ========================================== */}
      {activeTab === 'feedback' && (
        <FeedbackResultsPanel
          adminToken={adminToken}
          feedbackActive={Boolean(eventState?.feedbackActive)}
          onToggleFeedback={() => sendControl('feedback/toggle')}
        />
      )}

      {/* ==========================================
          TAB: MULTIPLE ADMIN ACCOUNTS (SUPER ADMIN & ADMIN)
          ========================================== */}
      {activeTab === 'admins' && (adminRole === 'SUPER_ADMIN' || adminRole === 'ADMIN') && (
        <MultipleAdminManagementPanel
          adminToken={adminToken}
          currentUsername={adminUsername}
        />
      )}

      {/* ==========================================
          TAB: CERTIFICATES & SAMPLE TEMPLATE MASTER
          ========================================== */}
      {activeTab === 'certificates' && (
        <div className="space-y-6">
          <AdminCertificateManager
            adminToken={adminToken}
            teamsList={teamsList}
            onShowMessage={(msg) => setControlMessage(msg)}
          />
        </div>
      )}

      {/* ==========================================
          TAB: LIVE SYSTEM & MEMORY TELEMETRY
          ========================================== */}
      {activeTab === 'system_metrics' && (
        <div className="space-y-6">
          <SystemMetricsPanel adminToken={adminToken} />
        </div>
      )}

      {/* ==========================================
          TAB 7: EMERGENCY OFFLINE PACKET & SCORING LEDGER
          ========================================== */}
      {activeTab === 'offline' && (
        <div className="space-y-6">
          <EmergencyOfflineModal questions={questionsList} />
        </div>
      )}
        </main>
      </div>

      {/* ==========================================
          MODAL: EDIT TEAM DETAILS
          ========================================== */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE6F0] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE6F0]">
              <h3 className="font-tech text-base font-bold text-[#172033]">
                EDIT TEAM ({editingTeam.id})
              </h3>
              <button onClick={() => setEditingTeam(null)} className="text-[#64748B] hover:text-[#172033] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-mono-code text-[#64748B] mb-1 font-medium">TEAM NAME</label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[#64748B] mb-1 font-medium">PARTICIPANT 1</label>
                <input
                  type="text"
                  value={editingTeam.participant1}
                  onChange={(e) => setEditingTeam({ ...editingTeam, participant1: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[#64748B] mb-1 font-medium">PARTICIPANT 2</label>
                <input
                  type="text"
                  value={editingTeam.participant2 || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, participant2: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[#64748B] mb-1 font-medium">COLLEGE</label>
                <input
                  type="text"
                  value={editingTeam.college}
                  onChange={(e) => setEditingTeam({ ...editingTeam, college: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[#64748B] mb-1 font-medium">PHONE NUMBER</label>
                <input
                  type="text"
                  value={editingTeam.phone}
                  onChange={(e) => setEditingTeam({ ...editingTeam, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono-code"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE6F0]">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] font-bold text-xs cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveTeamEdit}
                className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-xs font-tech tracking-wider cursor-pointer shadow-xs"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ADD NEW TEAM
          ========================================== */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#DCE6F0] rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE6F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#0891B2]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wide">
                    REGISTER NEW CONTESTANT TEAM
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Add an authorized participating team to the symposium roster</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddTeamModal(false)}
                className="text-[#64748B] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addTeamError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addTeamError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeamSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">TEAM NAME *</label>
                  <input
                    type="text"
                    required
                    value={newTeamForm.name}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, name: e.target.value })}
                    placeholder="e.g. ByteBrigade"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div>
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">TEAM ID (OPTIONAL)</label>
                  <input
                    type="text"
                    value={newTeamForm.id}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, id: e.target.value.toUpperCase() })}
                    placeholder="Leave blank for auto TB-XXXX"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono-code focus:outline-none focus:border-[#06B6D4] uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">PARTICIPANT 1 (LEAD) *</label>
                  <input
                    type="text"
                    required
                    value={newTeamForm.participant1}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, participant1: e.target.value })}
                    placeholder="Contestant 1 Name"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div>
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">PARTICIPANT 2 (OPTIONAL)</label>
                  <input
                    type="text"
                    value={newTeamForm.participant2}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, participant2: e.target.value })}
                    placeholder="Contestant 2 Name"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-code text-[#172033] mb-1 font-medium">COLLEGE / INSTITUTION *</label>
                <input
                  type="text"
                  required
                  value={newTeamForm.college}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, college: e.target.value })}
                  placeholder="e.g. Autonomous College of Engineering & Technology"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">DEPARTMENT</label>
                  <input
                    type="text"
                    value={newTeamForm.department}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, department: e.target.value })}
                    placeholder="Computer Science & Engineering"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div>
                  <label className="block font-mono-code text-[#172033] mb-1 font-medium">YEAR</label>
                  <select
                    value={newTeamForm.year}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, year: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono-code text-[#172033] mb-1 font-medium">CONTACT PHONE</label>
                <input
                  type="tel"
                  value={newTeamForm.phone}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono-code focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE6F0]">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] font-bold text-xs cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={addTeamLoading}
                  className="px-5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {addTeamLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>REGISTERING...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>REGISTER TEAM</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CONFIRM REMOVE TEAM
          ========================================== */}
      {teamToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-rose-200 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-tech text-base font-bold tracking-wider">
                CONFIRM TEAM REMOVAL
              </h3>
            </div>

            <p className="text-xs text-[#172033] leading-relaxed">
              Are you sure you want to permanently remove team <span className="text-rose-600 font-bold">{teamToDelete.name}</span> (<span className="font-mono-code text-[#0891B2]">{teamToDelete.id}</span>)?
            </p>

            <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs space-y-1 text-[#64748B]">
              <div className="font-bold text-rose-600">Warning: Permanent Action</div>
              <div>• All submissions recorded for this team will be permanently deleted.</div>
              <div>• Any active buzzer or warning status for this team will be cleared.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setTeamToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] font-bold text-xs cursor-pointer"
              >
                CANCEL
              </button>
              <button
                disabled={removeTeamLoading}
                onClick={handleConfirmRemoveTeam}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {removeTeamLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>REMOVING...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>PERMANENTLY REMOVE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: SAFE RESET CONFIRMATION
          ========================================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-rose-200 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-tech text-base font-bold tracking-wider">
                CONFIRM DESTRUCTIVE EVENT RESET
              </h3>
            </div>

            <p className="text-xs text-[#172033] leading-relaxed">
              This action will permanently erase all team submissions, reset all scores to 0, unlock locked teams, and revert the competition back to Round 1 Waiting state.
            </p>

            <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs font-mono-code text-[#64748B]">
              Type <span className="text-rose-600 font-bold">RESET TECH BRIDGE</span> to confirm:
            </div>

            <input
              type="text"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESET TECH BRIDGE"
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-rose-300 rounded-xl text-sm font-mono-code text-rose-700 focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] font-bold text-xs cursor-pointer"
              >
                CANCEL
              </button>
              <button
                disabled={resetConfirmInput !== 'RESET TECH BRIDGE'}
                onClick={async () => {
                  await sendControl('reset', { confirmation: resetConfirmInput });
                  setShowResetModal(false);
                  setResetConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider disabled:opacity-40 cursor-pointer shadow-xs"
              >
                PERMANENTLY RESET EVENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: QUICK UPDATE LIVE ANSWER
          ========================================== */}
      {quickAnswerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#DCE6F0] rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE6F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wide">
                    UPDATE AUTHORITATIVE ANSWER
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Round {quickAnswerModal.round} • Question #{quickAnswerModal.questionNumber} ({quickAnswerModal.questionId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickAnswerModal(null)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#172033] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickUpdateAnswer} className="space-y-4 text-xs">
              <div>
                <label className="text-[#172033] font-bold block mb-1.5 uppercase font-mono-code text-[11px]">
                  Official Primary Correct Answer *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. BINARY SEARCH TREE"
                  value={quickAnswerModal.correctAnswer}
                  onChange={(e) => setQuickAnswerModal({ ...quickAnswerModal, correctAnswer: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-emerald-300 rounded-xl p-3 text-[#172033] font-mono-code text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  This canonical answer will be displayed on display screens and solution keys. Evaluated case-insensitively.
                </span>
              </div>

              <div>
                <label className="text-[#172033] font-bold block mb-1.5 uppercase font-mono-code text-[11px]">
                  Accepted Variations & Common Abbreviations
                </label>
                <input
                  type="text"
                  placeholder="e.g. BST, binary tree, search tree"
                  value={quickAnswerModal.aliases}
                  onChange={(e) => setQuickAnswerModal({ ...quickAnswerModal, aliases: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-3 text-[#172033] font-mono-code text-xs focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 focus:border-[#06B6D4]"
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  Comma-separated list of synonyms or alternate terms that will be marked as 100% CORRECT.
                </span>
              </div>

              <div className="p-3 bg-cyan-50/80 border border-cyan-200 rounded-xl text-[11px] text-cyan-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Cloud & Multi-Admin Authoritative Sync</span>
                </div>
                <p className="text-[10px] text-cyan-800 leading-relaxed">
                  Saving updates all student devices, judges' desks, and projector boards immediately in real-time. The new answer is safely committed to cloud database storage and local disk.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#DCE6F0]">
                <button
                  type="button"
                  onClick={() => setQuickAnswerModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DCE6F0] text-[#172033] font-bold text-xs cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={quickAnswerSaving || !quickAnswerModal.correctAnswer.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-tech font-bold text-xs tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {quickAnswerSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>SAVING TO CLOUD...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>SAVE & APPLY LIVE ANSWER</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
