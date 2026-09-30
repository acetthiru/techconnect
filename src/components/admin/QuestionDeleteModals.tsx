import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Check,
} from 'lucide-react';
import { Question, QuestionSet, RoundNumber } from '../../types';

// ==========================================
// 1. DELETE ALL QUESTIONS MODAL (WITH VERIFICATION)
// ==========================================
export interface DeleteAllQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCount: number;
  onConfirm: () => Promise<void>;
}

export const DeleteAllQuestionsModal: React.FC<DeleteAllQuestionsModalProps> = ({
  isOpen,
  onClose,
  totalCount,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isVerified = confirmText.trim().toUpperCase() === 'DELETE ALL';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete all questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172033]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white border-2 border-rose-300 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-rose-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-tech text-base font-bold text-rose-900 tracking-wider">
                DELETE ALL QUESTIONS
              </h3>
              <p className="text-[11px] text-rose-600">Irreversible question bank purge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-950">
            <div className="font-bold flex items-center gap-1.5 text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>WARNING: PERMANENT DATA PURGE</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This action will permanently delete all <strong>{totalCount} questions</strong> across all rounds (Round 1, Round 2, Round 3) and sets (Set A, B, C).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[#172033] font-semibold text-[11px]">
              To verify deletion, please type <strong className="text-rose-700 underline">DELETE ALL</strong> below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE ALL"
              className="w-full px-3 py-2 bg-rose-50/50 border-2 border-rose-200 rounded-xl text-rose-900 font-bold focus:outline-none focus:border-rose-500 text-sm tracking-wider uppercase"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={!isVerified || loading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 disabled:opacity-40 cursor-pointer transition active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'PURGING...' : 'CONFIRM DELETE ALL'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. DELETE SELECTED QUESTIONS MODAL (WITH VERIFICATION)
// ==========================================
export interface DeleteSelectedQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedQuestions: Question[];
  onConfirm: () => Promise<void>;
}

export const DeleteSelectedQuestionsModal: React.FC<DeleteSelectedQuestionsModalProps> = ({
  isOpen,
  onClose,
  selectedQuestions,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete selected questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172033]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-rose-200 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                DELETE SELECTED QUESTIONS ({selectedQuestions.length})
              </h3>
              <p className="text-[11px] text-[#64748B]">Batch deletion verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <p className="text-[#334155]">
            Are you sure you want to permanently delete the following <strong>{selectedQuestions.length} selected questions</strong>?
          </p>

          {/* Selected Questions Preview List */}
          <div className="max-h-48 overflow-y-auto divide-y divide-[#DCE6F0] border border-[#DCE6F0] rounded-xl bg-[#F8FAFC] p-2">
            {selectedQuestions.map((q) => (
              <div key={q.id} className="py-1.5 px-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0891B2]">#{q.questionNumber}</span>
                  <span className="text-[#64748B]">(R{q.round} {q.set || 'A'})</span>
                  <strong className="text-[#172033]">{q.correctAnswer}</strong>
                </div>
                <span className="text-[10px] text-[#64748B]">{q.domain}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 cursor-pointer transition active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'DELETING...' : `DELETE ${selectedQuestions.length} QUESTIONS`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. DELETE SPECIFIC QUESTION SET MODAL (WITH VERIFICATION)
// ==========================================
export interface DeleteSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  initialRound?: RoundNumber;
  initialSet?: QuestionSet;
  onConfirm: (round: RoundNumber, set: QuestionSet, confirmation: string) => Promise<void>;
}

export const DeleteSetModal: React.FC<DeleteSetModalProps> = ({
  isOpen,
  onClose,
  questions,
  initialRound = 1,
  initialSet = 'A',
  onConfirm,
}) => {
  const [round, setRound] = useState<RoundNumber>(initialRound);
  const [set, setSet] = useState<QuestionSet>(initialSet);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const countInSet = questions.filter(
    (q) => q.round === round && (q.set || 'A') === set
  ).length;

  const expectedConfirm = `DELETE R${round} SET ${set}`;
  const isVerified = confirmText.trim().toUpperCase() === expectedConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(round, set, confirmText.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete set');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172033]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white border-2 border-rose-300 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-rose-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-tech text-base font-bold text-rose-950 tracking-wider">
                DELETE QUESTION SET
              </h3>
              <p className="text-[11px] text-rose-600">Purge all questions in a selected set</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#64748B] mb-1 font-semibold">ROUND</label>
              <select
                value={round}
                onChange={(e) => setRound(Number(e.target.value) as RoundNumber)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-bold focus:border-[#06B6D4]"
              >
                <option value={1}>Round 1</option>
                <option value={2}>Round 2</option>
                <option value={3}>Round 3</option>
              </select>
            </div>

            <div>
              <label className="block text-[#64748B] mb-1 font-semibold">SET</label>
              <select
                value={set}
                onChange={(e) => setSet(e.target.value as QuestionSet)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-bold focus:border-[#06B6D4]"
              >
                <option value="A">Set A</option>
                <option value="B">Set B</option>
                <option value="C">Set C</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
            <div className="font-bold flex items-center justify-between">
              <span>Target: Round {round}, Set {set}</span>
              <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 font-black">
                {countInSet} Questions
              </span>
            </div>
            <p className="text-[11px] text-rose-700">
              All {countInSet} questions in Round {round} Set {set} will be permanently removed.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[#172033] font-semibold text-[11px]">
              To confirm, type <strong className="text-rose-700 underline">{expectedConfirm}</strong>:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type ${expectedConfirm}`}
              className="w-full px-3 py-2 bg-rose-50/50 border-2 border-rose-200 rounded-xl text-rose-900 font-bold focus:outline-none focus:border-rose-500 text-xs tracking-wider uppercase"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={!isVerified || loading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 disabled:opacity-40 cursor-pointer transition active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'DELETING...' : `DELETE SET ${set}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
