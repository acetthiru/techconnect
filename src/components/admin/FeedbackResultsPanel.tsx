import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Star, 
  RefreshCw, 
  ToggleLeft, 
  ToggleRight, 
  Users, 
  Trash2, 
  Filter, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { EventFeedback } from '../../types';

interface FeedbackResultsPanelProps {
  adminToken: string | null;
  feedbackActive: boolean;
  onToggleFeedback: () => void;
}

export const FeedbackResultsPanel: React.FC<FeedbackResultsPanelProps> = ({
  adminToken,
  feedbackActive,
  onToggleFeedback,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | 'ALL'>('ALL');
  const [toggleLoading, setToggleLoading] = useState<number | 'GLOBAL' | null>(null);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchFeedback();
    }
  }, [adminToken]);

  const handleToggleRoundFeedback = async (roundNumber: number) => {
    if (!adminToken) return;
    setToggleLoading(roundNumber);
    try {
      const res = await fetch('/api/admin/feedback/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ round: roundNumber }),
      });
      if (res.ok) {
        await fetchFeedback();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!adminToken) return;
    if (!window.confirm('Are you sure you want to delete this feedback response?')) return;
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        await fetchFeedback();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        ))}
      </div>
    );
  };

  const activeRounds: number[] = data?.feedbackActiveRounds || (data?.feedbackActive ? [1, 2, 3] : []);
  const allFeedbacks: EventFeedback[] = data?.feedbacks || [];
  const filteredFeedbacks = selectedRoundFilter === 'ALL'
    ? allFeedbacks
    : allFeedbacks.filter(f => (f.round || 1) === selectedRoundFilter);

  const totalEligible = data?.eligibleTeamsCount || 0;
  const totalReceived = data?.total || 0;
  const responseRate = totalEligible > 0 ? Math.round((totalReceived / totalEligible) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#172033] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#0891B2]" />
            Participant Feedback & Stage Evaluation
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Configure round-by-round participant surveys and analyze ratings across questions, difficulty, UX & event organization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchFeedback}
            className="p-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] rounded-xl border border-[#DCE6F0] transition cursor-pointer"
            title="Refresh Feedback Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0891B2]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Per-Round Enable / Disable Controls & Response Counter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Global Master Portal */}
        <div className="p-4 bg-white border border-[#DCE6F0] rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono-code font-bold uppercase text-[#172033]">MASTER PORTAL</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              feedbackActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
            }`}>
              {feedbackActive ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
          <button
            onClick={onToggleFeedback}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-tech tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              feedbackActive
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            {feedbackActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{feedbackActive ? 'CLOSE ALL ROUNDS' : 'OPEN ALL ROUNDS'}</span>
          </button>
          <div className="text-[11px] text-[#64748B] text-center font-mono-code">
            Total Responses: <strong className="text-[#172033]">{totalReceived}</strong> / {totalEligible} Teams ({responseRate}%)
          </div>
        </div>

        {/* Round 1 Toggle */}
        <div className="p-4 bg-white border border-[#DCE6F0] rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#172033]">
              <Layers className="w-3.5 h-3.5 text-[#0891B2]" />
              <span>ROUND 1 (Foundations)</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeRounds.includes(1) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
            }`}>
              {activeRounds.includes(1) ? 'ACTIVE' : 'CLOSED'}
            </span>
          </div>
          <button
            onClick={() => handleToggleRoundFeedback(1)}
            disabled={toggleLoading === 1}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRounds.includes(1)
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs'
                : 'bg-slate-100 text-[#172033] hover:bg-slate-200 border border-[#DCE6F0]'
            }`}
          >
            <span>{activeRounds.includes(1) ? 'Disable Round 1' : 'Enable Round 1'}</span>
          </button>
          <div className="text-[11px] text-[#64748B] flex items-center justify-between">
            <span>Submissions:</span>
            <strong className="text-[#172033] font-mono-code">{data?.roundStats?.[1]?.total || 0}</strong>
          </div>
        </div>

        {/* Round 2 Toggle */}
        <div className="p-4 bg-white border border-[#DCE6F0] rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#172033]">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>ROUND 2 (Systems)</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeRounds.includes(2) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
            }`}>
              {activeRounds.includes(2) ? 'ACTIVE' : 'CLOSED'}
            </span>
          </div>
          <button
            onClick={() => handleToggleRoundFeedback(2)}
            disabled={toggleLoading === 2}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRounds.includes(2)
                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs'
                : 'bg-slate-100 text-[#172033] hover:bg-slate-200 border border-[#DCE6F0]'
            }`}
          >
            <span>{activeRounds.includes(2) ? 'Disable Round 2' : 'Enable Round 2'}</span>
          </button>
          <div className="text-[11px] text-[#64748B] flex items-center justify-between">
            <span>Submissions:</span>
            <strong className="text-[#172033] font-mono-code">{data?.roundStats?.[2]?.total || 0}</strong>
          </div>
        </div>

        {/* Round 3 Toggle */}
        <div className="p-4 bg-white border border-[#DCE6F0] rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#172033]">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>ADDITIONAL STAGE / R3</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeRounds.includes(3) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
            }`}>
              {activeRounds.includes(3) ? 'ACTIVE' : 'CLOSED'}
            </span>
          </div>
          <button
            onClick={() => handleToggleRoundFeedback(3)}
            disabled={toggleLoading === 3}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRounds.includes(3)
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                : 'bg-slate-100 text-[#172033] hover:bg-slate-200 border border-[#DCE6F0]'
            }`}
          >
            <span>{activeRounds.includes(3) ? 'Disable Stage' : 'Enable Stage'}</span>
          </button>
          <div className="text-[11px] text-[#64748B] flex items-center justify-between">
            <span>Submissions:</span>
            <strong className="text-[#172033] font-mono-code">{data?.roundStats?.[3]?.total || 0}</strong>
          </div>
        </div>
      </div>

      {/* Ratings Averages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-medium">Overall Rating</span>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#0891B2]">{data?.averageOverall || 0}</span>
            <span className="text-xs text-[#64748B]">/ 5</span>
          </div>
          {renderStars(data?.averageOverall || 0)}
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-medium">Question Quality</span>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#172033]">{data?.averageQuality || 0}</span>
            <span className="text-xs text-[#64748B]">/ 5</span>
          </div>
          {renderStars(data?.averageQuality || 0)}
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-medium">Difficulty Balance</span>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#172033]">{data?.averageDifficulty || 0}</span>
            <span className="text-xs text-[#64748B]">/ 5</span>
          </div>
          {renderStars(data?.averageDifficulty || 0)}
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-medium">Platform UX</span>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#172033]">{data?.averageUX || 0}</span>
            <span className="text-xs text-[#64748B]">/ 5</span>
          </div>
          {renderStars(data?.averageUX || 0)}
        </div>

        <div className="bg-white border border-[#DCE6F0] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#64748B] block mb-1 font-medium">Event Organization</span>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#172033]">{data?.averageOrganization || 0}</span>
            <span className="text-xs text-[#64748B]">/ 5</span>
          </div>
          {renderStars(data?.averageOrganization || 0)}
        </div>
      </div>

      {/* Feedbacks List with Filter Tabs */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-[#F8FAFC] px-5 py-3.5 border-b border-[#DCE6F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#172033]">
              Participant Responses ({filteredFeedbacks.length} Shown)
            </span>
            <span className="text-xs text-[#64748B]">
              • Eligible: {totalEligible} Teams
            </span>
          </div>

          {/* Round Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#DCE6F0] text-xs font-semibold">
            <button
              onClick={() => setSelectedRoundFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                selectedRoundFilter === 'ALL' ? 'bg-[#0891B2] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              All ({allFeedbacks.length})
            </button>
            <button
              onClick={() => setSelectedRoundFilter(1)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                selectedRoundFilter === 1 ? 'bg-[#0891B2] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              Round 1 ({data?.roundStats?.[1]?.total || 0})
            </button>
            <button
              onClick={() => setSelectedRoundFilter(2)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                selectedRoundFilter === 2 ? 'bg-[#0891B2] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              Round 2 ({data?.roundStats?.[2]?.total || 0})
            </button>
            <button
              onClick={() => setSelectedRoundFilter(3)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                selectedRoundFilter === 3 ? 'bg-[#0891B2] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              Stage 3 ({data?.roundStats?.[3]?.total || 0})
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#DCE6F0] max-h-[460px] overflow-y-auto">
          {filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B] space-y-1">
              <p className="font-semibold text-slate-700">No feedback submissions found for this filter.</p>
              <p>Ensure the feedback portal is enabled for participants in this round.</p>
            </div>
          ) : (
            filteredFeedbacks.map((f: EventFeedback) => (
              <div key={f.id} className="p-4 hover:bg-[#F8FAFC] transition space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-[#172033]">{f.teamName}</span>
                    <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-cyan-50 text-[#0891B2] border border-cyan-200 font-bold">
                      Round {f.round || 1}
                    </span>
                    {f.college && (
                      <span className="text-xs text-[#64748B] hidden sm:inline">• {f.college}</span>
                    )}
                    <span className="text-xs text-[#64748B]">• {new Date(f.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {renderStars(f.overallRating)}
                    <button
                      onClick={() => handleDeleteFeedback(f.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Feedback"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {f.comments && (
                  <p className="text-xs text-[#172033] bg-[#F8FAFC] p-3 rounded-xl border border-[#DCE6F0] font-sans italic">
                    "{f.comments}"
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-[11px] text-[#64748B]">
                  <span>Questions: <strong className="text-[#172033]">{f.questionQuality}/5</strong></span>
                  <span>Difficulty: <strong className="text-[#172033]">{f.difficulty || 3}/5</strong></span>
                  <span>UX: <strong className="text-[#172033]">{f.userExperience || f.overallRating}/5</strong></span>
                  <span>Organization: <strong className="text-[#172033]">{f.eventOrganization || f.overallRating}/5</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
