import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Check,
  ToggleLeft,
  ToggleRight,
  Settings2,
  BookOpen
} from 'lucide-react';
import { EventState, Question } from '../../types';

interface SmartAnswerCheckerPanelProps {
  eventState: EventState;
  questions: Question[];
  onToggleSmartChecker: () => Promise<void>;
  onUpdateConfig: (config: {
    tolerance?: 'STRICT' | 'MODERATE' | 'LENIENT';
    aiAssisted?: boolean;
    allowPhonetic?: boolean;
  }) => Promise<void>;
  token: string | null;
}

export const SmartAnswerCheckerPanel: React.FC<SmartAnswerCheckerPanelProps> = ({
  eventState,
  questions,
  onToggleSmartChecker,
  onUpdateConfig,
  token,
}) => {
  const isEnabled = Boolean(eventState?.smartAnswerCheckerEnabled);
  const currentTolerance = eventState?.smartAnswerCheckerTolerance || 'MODERATE';
  const aiAssisted = Boolean(eventState?.smartAnswerCheckerAiAssisted);
  const allowPhonetic = eventState?.smartAnswerCheckerAllowPhonetic !== false;

  // Simulator state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(questions[0]?.id || '');
  const [customCanonical, setCustomCanonical] = useState<string>('');
  const [testInput, setTestInput] = useState<string>('algoritm');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const activeQuestion = questions.find((q) => q.id === selectedQuestionId);
  const effectiveCanonical = activeQuestion ? activeQuestion.correctAnswer : customCanonical;
  const effectiveAliases = activeQuestion ? activeQuestion.aliases || [] : [];

  const handleRunSimulation = async (inputToTest?: string) => {
    const textToTest = inputToTest !== undefined ? inputToTest : testInput;
    if (!textToTest.trim()) return;

    setIsSimulating(true);
    setSimError(null);
    try {
      const res = await fetch('/api/admin/answer-checker/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          submittedAnswer: textToTest,
          questionId: selectedQuestionId || undefined,
          customCorrectAnswer: !selectedQuestionId ? customCanonical : undefined,
          customAliases: !selectedQuestionId ? [] : undefined,
          tolerance: currentTolerance,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to simulate answer checker');
      }
      setSimulationResult(data);
    } catch (err: any) {
      setSimError(err.message || 'Simulation error');
    } finally {
      setIsSimulating(false);
    }
  };

  const samplePresets = [
    { label: 'Typo: "algoritm"', text: 'algoritm', target: 'Algorithm' },
    { label: 'Transposition: "synchornization"', text: 'synchornization', target: 'Synchronization' },
    { label: 'Word Order: "tree binary search"', text: 'tree binary search', target: 'Binary Search Tree' },
    { label: 'Acronym: "BST"', text: 'BST', target: 'Binary Search Tree' },
    { label: 'Phonetic: "semafor"', text: 'semafor', target: 'Semaphore' },
    { label: 'Typo: "dedlock"', text: 'dedlock', target: 'Deadlock' },
    { label: 'Punctuation: "dijkstras algorithm"', text: "dijkstra's algorithm", target: 'Dijkstra' },
  ];

  return (
    <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-6">
      {/* Header & Main Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DCE6F0]">
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              isEnabled
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wide uppercase">
                INTELLIGENT ANSWER CHECKER (TYPO & SYNONYM ACCEPTANCE)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono-code font-bold shadow-2xs ${
                  isEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isEnabled ? '● ACTIVE (FULL MARKS ON TYPOS)' : '○ DISABLED (STRICT EXACT MATCH)'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Automatically accepts spelling mistakes, inverted word orders, technical acronyms, and phonetic variations with <strong>the exact same marks</strong>.
            </p>
          </div>
        </div>

        {/* Big Master Toggle Button */}
        <button
          id="btn-toggle-smart-answer-checker"
          onClick={onToggleSmartChecker}
          className={`py-2.5 px-5 rounded-xl text-xs font-tech font-bold tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            isEnabled
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              : 'bg-[#0891B2] hover:bg-[#06B6D4] text-white active:scale-95'
          }`}
        >
          {isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          <span>{isEnabled ? 'TURN CHECKER OFF' : 'TURN CHECKER ON'}</span>
        </button>
      </div>

      {/* Configuration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tolerance Level */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172033] font-tech uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#0891B2]" />
              Spelling Typo Tolerance
            </span>
            <span className="text-[10px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#DCE6F0] font-bold text-[#0891B2]">
              {currentTolerance}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Determines how many misspelled characters or transpositions to tolerate.
          </p>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {(['STRICT', 'MODERATE', 'LENIENT'] as const).map((lvl) => (
              <button
                key={lvl}
                disabled={!isEnabled}
                onClick={() => onUpdateConfig({ tolerance: lvl })}
                className={`py-1.5 px-2 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                  currentTolerance === lvl
                    ? 'bg-[#0891B2] text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-[#64748B] border border-[#DCE6F0]'
                } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Phonetic Matching */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172033] font-tech uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Phonetic Sound-Alike
            </span>
            <span className={`text-[10px] font-mono-code px-2 py-0.5 rounded font-bold ${allowPhonetic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
              {allowPhonetic ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Accepts phonetic pronunciations e.g. "semafor" for "semaphore", "saipher" for "cipher".
          </p>
          <div className="pt-1">
            <button
              disabled={!isEnabled}
              onClick={() => onUpdateConfig({ allowPhonetic: !allowPhonetic })}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                allowPhonetic
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-[#64748B] border border-[#DCE6F0]'
              } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {allowPhonetic ? '✓ Phonetic Matching Active' : 'Enable Phonetics'}
            </button>
          </div>
        </div>

        {/* AI Semantic Verification */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172033] font-tech uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              AI Semantic Synonyms
            </span>
            <span className={`text-[10px] font-mono-code px-2 py-0.5 rounded font-bold ${aiAssisted ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'}`}>
              {aiAssisted ? 'GEMINI AI' : 'OFF'}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Evaluates contextual synonyms and domain-equivalent phrases using Gemini AI.
          </p>
          <div className="pt-1">
            <button
              disabled={!isEnabled}
              onClick={() => onUpdateConfig({ aiAssisted: !aiAssisted })}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-mono-code font-bold transition-all cursor-pointer ${
                aiAssisted
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-[#64748B] border border-[#DCE6F0]'
              } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {aiAssisted ? '✓ Gemini Semantic Active' : 'Enable Gemini AI'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator / Interactive Testing Playground */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-indigo-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <h4 className="font-tech text-sm font-bold text-[#172033] uppercase tracking-wide">
              LIVE ANSWER CHECKER SIMULATOR (TEST PARTICIPANT TYPOS)
            </h4>
          </div>
          <span className="text-[11px] font-mono-code text-[#64748B]">
            Real-time test of any typo against question bank
          </span>
        </div>

        {/* Question Selector & Target Answer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono-code text-[#64748B] mb-1 font-bold">
              1. SELECT TARGET QUESTION FROM QUESTION BANK:
            </label>
            <select
              value={selectedQuestionId}
              onChange={(e) => {
                setSelectedQuestionId(e.target.value);
                setSimulationResult(null);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white border border-[#DCE6F0] text-xs font-mono-code text-[#172033] focus:ring-2 focus:ring-[#0891B2] focus:outline-hidden"
            >
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  R{q.round} Q{q.questionNumber} ({q.domain}) - Canonical: "{q.correctAnswer}"
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono-code text-[#64748B] mb-1 font-bold">
              TARGET CANONICAL ANSWER & ACCEPTED ALIASES:
            </label>
            <div className="p-2 rounded-xl bg-white border border-[#DCE6F0] text-xs font-mono-code flex items-center justify-between gap-2">
              <div className="truncate">
                <strong className="text-emerald-700">{effectiveCanonical || 'None'}</strong>
                {effectiveAliases.length > 0 && (
                  <span className="text-[#64748B] ml-2 text-[11px]">
                    (Aliases: {effectiveAliases.join(', ')})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Input Text & Test Button */}
        <div>
          <label className="block text-[11px] font-mono-code text-[#64748B] mb-1 font-bold">
            2. TYPE PARTICIPANT ANSWER (WITH TYPOS, MISSING LETTERS, INVERTED WORDS, OR ACRONYM):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunSimulation();
              }}
              placeholder="e.g. algoritm, synchornization, tree binary search, bst, semafor..."
              className="flex-1 py-2 px-3 rounded-xl bg-white border border-[#DCE6F0] text-xs font-mono-code text-[#172033] focus:ring-2 focus:ring-[#0891B2] focus:outline-hidden"
            />
            <button
              id="btn-simulate-answer"
              onClick={() => handleRunSimulation()}
              disabled={isSimulating || !testInput.trim()}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-tech font-bold text-xs tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSimulating ? 'CHECKING...' : 'TEST CHECKER'}</span>
            </button>
          </div>
        </div>

        {/* Quick Click Sample Presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-mono-code text-[#64748B] font-bold mr-1">Quick Presets:</span>
          {samplePresets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTestInput(preset.text);
                const matchedQ = questions.find(
                  (q) => q.correctAnswer.toLowerCase() === preset.target.toLowerCase()
                );
                if (matchedQ) {
                  setSelectedQuestionId(matchedQ.id);
                }
                handleRunSimulation(preset.text);
              }}
              className="py-1 px-2.5 rounded-lg bg-white hover:bg-indigo-50 border border-indigo-200 text-[11px] font-mono-code text-indigo-700 font-medium transition cursor-pointer active:scale-95 shadow-2xs"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div
            className={`p-4 rounded-xl border transition-all ${
              simulationResult.isAccepted
                ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
                : 'bg-rose-50/90 border-rose-300 shadow-xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {simulationResult.isAccepted ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold font-tech uppercase ${
                        simulationResult.isAccepted ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {simulationResult.isAccepted ? '✓ ANSWER ACCEPTED (FULL MARKS AWARDED)' : '✗ ANSWER REJECTED'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                        simulationResult.isAccepted
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      MATCH TYPE: {simulationResult.matchType}
                    </span>
                  </div>
                  <p className="text-xs text-[#172033] mt-0.5">
                    <strong>Evaluator Details:</strong> {simulationResult.details}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono-code text-[#64748B]">Confidence Score</div>
                <div className="text-base font-bold font-mono-code text-[#172033]">
                  {Math.round((simulationResult.confidence || 0) * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {simError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{simError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
