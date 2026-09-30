import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Wand2, ShieldCheck, Zap, Sliders, Check, X, HelpCircle, ArrowRight } from 'lucide-react';
import { EventState, Question } from '../../types';

interface AnswerCheckerControlPanelProps {
  adminToken: string | null;
  eventState: EventState | null;
  questions: Question[];
  onRefreshState: () => void;
}

export const AnswerCheckerControlPanel: React.FC<AnswerCheckerControlPanelProps> = ({
  adminToken,
  eventState,
  questions,
  onRefreshState,
}) => {
  const isEnabled = Boolean(eventState?.answerCheckerEnabled);
  const currentTolerance = eventState?.answerCheckerTolerance || 'moderate';

  const [toggling, setToggling] = useState(false);
  const [toggleMessage, setToggleMessage] = useState<string | null>(null);

  // Test Simulator State
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(questions[0]?.id || '');
  const [customCanonical, setCustomCanonical] = useState<string>('');
  const [testInputAnswer, setTestInputAnswer] = useState<string>('memmory leak');
  const [testTolerance, setTestTolerance] = useState<'strict' | 'moderate' | 'flexible'>(currentTolerance);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

  const handleToggleFeature = async (newStatus?: boolean, newTol?: 'strict' | 'moderate' | 'flexible') => {
    if (!adminToken) return;
    setToggling(true);
    setToggleMessage(null);
    try {
      const res = await fetch('/api/admin/toggle-answer-checker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          enabled: newStatus !== undefined ? newStatus : !isEnabled,
          tolerance: newTol || currentTolerance,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setToggleMessage(data.message);
        onRefreshState();
      } else {
        setToggleMessage(data.error || 'Failed to update Answer Checker settings');
      }
    } catch (err: any) {
      setToggleMessage('Network error updating Answer Checker settings');
    } finally {
      setToggling(false);
      setTimeout(() => setToggleMessage(null), 4000);
    }
  };

  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInputAnswer.trim()) return;
    setSimulating(true);
    setSimError(null);
    setSimResult(null);

    try {
      const res = await fetch('/api/admin/test-answer-checker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          submittedAnswer: testInputAnswer.trim(),
          questionId: selectedQuestionId || undefined,
          canonicalAnswer: !selectedQuestionId ? customCanonical.trim() : undefined,
          toleranceMode: testTolerance,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSimResult(data);
      } else {
        setSimError(data.error || 'Simulator evaluation failed');
      }
    } catch (err: any) {
      setSimError('Failed to communicate with Answer Checker server');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Feature Status */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles className="w-48 h-48 text-[#06B6D4]" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-cyan-50 border border-[#06B6D4]/30 text-[#0891B2] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> OPTIONAL ADMIN FEATURE
              </span>
              {isEnabled ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> TURNED ON (ACTIVE)
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-slate-100 border border-slate-300 text-slate-600 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> TURNED OFF (DISABLED)
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold font-tech text-[#172033]">
              Answer Checker (Spelling & Synonyms Tolerant)
            </h2>
            <p className="text-sm text-[#64748B] leading-relaxed">
              When turned ON, this feature automatically checks participant answers for spelling mistakes, minor typos, spacing/hyphen variations, plurals, or closely related technical terms, accepting them as correct and awarding full marks.
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-stretch md:items-end gap-3">
            <button
              onClick={() => handleToggleFeature(!isEnabled)}
              disabled={toggling}
              className={`px-6 py-3.5 rounded-xl font-bold text-sm font-tech tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                isEnabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-600/20'
              }`}
            >
              {toggling ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isEnabled ? (
                <>
                  <X className="w-4 h-4" /> TURN OFF ANSWER CHECKER
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> TURN ON ANSWER CHECKER
                </>
              )}
            </button>
            <span className="text-[11px] font-mono-code text-[#64748B] text-center md:text-right">
              Admin Toggle • Server Authoritative
            </span>
          </div>
        </div>

        {toggleMessage && (
          <div className="mt-4 p-3.5 bg-cyan-50 border border-[#06B6D4]/40 rounded-xl text-xs font-mono-code text-[#0891B2] flex items-center justify-between">
            <span>{toggleMessage}</span>
            <button onClick={() => setToggleMessage(null)} className="text-[#0891B2] hover:text-[#172033]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tolerance Mode Selection */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-[#172033] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0891B2]" /> Tolerance & Evaluation Strictness
          </h3>
          <span className="text-xs font-mono-code text-[#64748B]">
            Current Setting: <strong className="text-[#0891B2] uppercase">{currentTolerance}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Strict Mode */}
          <div
            onClick={() => handleToggleFeature(isEnabled, 'strict')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
              currentTolerance === 'strict'
                ? 'border-[#06B6D4] bg-cyan-50/50 shadow-xs'
                : 'border-[#DCE6F0] hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-[#172033] font-tech">1. STRICT MODE</span>
              {currentTolerance === 'strict' && <Check className="w-4 h-4 text-[#0891B2]" />}
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Allows exact match and 1-character minor typo max. Requires strict structural alignment.
            </p>
          </div>

          {/* Moderate Mode */}
          <div
            onClick={() => handleToggleFeature(isEnabled, 'moderate')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
              currentTolerance === 'moderate'
                ? 'border-[#06B6D4] bg-cyan-50/50 shadow-xs'
                : 'border-[#DCE6F0] hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-[#172033] font-tech flex items-center gap-1.5">
                2. MODERATE MODE <span className="text-[10px] bg-[#06B6D4] text-white px-1.5 py-0.2 rounded">RECOMMENDED</span>
              </span>
              {currentTolerance === 'moderate' && <Check className="w-4 h-4 text-[#0891B2]" />}
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Allows spelling typos (1-3 edits), missing vowels, spacing differences, plurals, and hyphen variations.
            </p>
          </div>

          {/* Flexible Mode */}
          <div
            onClick={() => handleToggleFeature(isEnabled, 'flexible')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
              currentTolerance === 'flexible'
                ? 'border-[#06B6D4] bg-cyan-50/50 shadow-xs'
                : 'border-[#DCE6F0] hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-[#172033] font-tech">3. FLEXIBLE / AI MODE</span>
              {currentTolerance === 'flexible' && <Check className="w-4 h-4 text-[#0891B2]" />}
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Allows typos, plurals, synonyms, and Gemini AI semantic concept evaluation for related terminology.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Answer Checker Test & Simulator */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-lg text-[#172033] flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#0891B2]" /> Answer Checker Interactive Simulator
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            Test any sample student response against a real question in the bank to verify how the Answer Checker will evaluate typos or related terms.
          </p>
        </div>

        <form onSubmit={handleRunSimulator} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1.5">
                Target Question from Bank:
              </label>
              <select
                value={selectedQuestionId}
                onChange={(e) => setSelectedQuestionId(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#DCE6F0] text-[#172033] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#06B6D4]"
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    R{q.round} Q{q.questionNumber}: {q.rebusFormulaText || q.domain} (Ans: "{q.correctAnswer}")
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1.5">
                Test Input Answer (e.g., student typing error):
              </label>
              <input
                type="text"
                value={testInputAnswer}
                onChange={(e) => setTestInputAnswer(e.target.value)}
                placeholder="e.g. memmory leak, deadlok, sql-injection"
                className="w-full bg-[#F8FAFC] border border-[#DCE6F0] text-[#172033] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#06B6D4] font-mono"
              />
            </div>
          </div>

          {selectedQuestion && (
            <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs space-y-1">
              <div className="font-semibold text-[#172033]">
                Canonical Answer: <span className="text-[#0891B2] font-mono font-bold">"{selectedQuestion.correctAnswer}"</span>
              </div>
              {selectedQuestion.aliases && selectedQuestion.aliases.length > 0 && (
                <div className="text-[#64748B]">
                  Aliases: <span className="font-mono">{selectedQuestion.aliases.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#172033]">Test Tolerance:</span>
              {(['strict', 'moderate', 'flexible'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTestTolerance(mode)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono-code font-bold uppercase cursor-pointer ${
                    testTolerance === mode
                      ? 'bg-[#06B6D4] text-white'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="px-5 py-2.5 bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech rounded-xl shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              RUN TEST EVALUATION
            </button>
          </div>
        </form>

        {simError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-mono-code text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{simError}</span>
          </div>
        )}

        {simResult && simResult.result && (
          <div className={`p-5 rounded-xl border-2 space-y-3 ${
            simResult.result.isCorrect
              ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950'
              : 'bg-rose-50/70 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {simResult.result.isCorrect ? (
                  <span className="p-1 rounded bg-emerald-500 text-white font-bold text-xs flex items-center gap-1">
                    <Check className="w-4 h-4" /> ACCEPTED & FULL MARKS AWARDED
                  </span>
                ) : (
                  <span className="p-1 rounded bg-rose-500 text-white font-bold text-xs flex items-center gap-1">
                    <X className="w-4 h-4" /> REJECTED
                  </span>
                )}
                <span className="text-xs font-mono-code font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                  Match Type: {simResult.result.matchType || 'N/A'}
                </span>
              </div>

              {simResult.result.confidence && (
                <span className="text-xs font-mono-code text-slate-600 font-semibold">
                  Similarity / Confidence: {Math.round(simResult.result.confidence * 100)}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono font-semibold pt-1 border-t border-slate-200/60">
              <div>
                Submitted Answer: <span className="text-slate-900 font-bold">"{simResult.submittedAnswer}"</span>
              </div>
              <div>
                Canonical Answer: <span className="text-slate-900 font-bold">"{simResult.canonicalAnswer}"</span>
              </div>
            </div>

            <div className="text-xs pt-1">
              <strong>Evaluation Explanation:</strong> {simResult.result.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
