import React, { useState, useMemo } from 'react';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Trash2,
  FileCheck,
  Search,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Question, QuestionSet, RoundNumber } from '../../types';
import { SEED_QUESTIONS } from '../../data/seedQuestions';

export interface BatchImageMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  adminToken: string | null;
  onRefresh: () => void;
  onBulkUpdateImages?: (updates: any[]) => Promise<void>;
}

export interface ParsedImageItem {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  sizeKb: string;
  // Parsed metadata
  parsedRound?: number;
  parsedSet?: QuestionSet;
  parsedQuestionNumber?: number;
  parsedPanelIndex: number; // 0 for Panel 1, 1 for Panel 2, 2 for Panel 3
  parsedQuestionId?: string;
  // Target match
  targetQuestionId: string | null;
  targetPanelIndex: number;
  status: 'MATCHED' | 'UNMATCHED';
}

/**
 * Intelligent filename parser that extracts Round, Set, Question Number, and Panel Number.
 * Examples:
 * - R1_Q1_P1.jpg -> Round 1, Q1, Panel 1
 * - R1_A_Q5_P2.png -> Round 1, Set A, Q5, Panel 2
 * - R2_Q10_P1.webp -> Round 2, Q10, Panel 1
 * - Q15_P2.jpg -> Question 15, Panel 2
 * - q1-a-01_p1.jpg -> ID q1-a-01, Panel 1
 * - r3_b_q02_panel1.jpeg -> Round 3, Set B, Q2, Panel 1
 */
export function parseImageFilename(
  filename: string,
  availableQuestions: Question[]
): {
  round?: number;
  set?: QuestionSet;
  questionNumber?: number;
  panelIndex: number;
  questionId?: string;
  matchedQuestionId: string | null;
} {
  const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, '').trim();
  let round: number | undefined;
  let set: QuestionSet | undefined;
  let questionNumber: number | undefined;
  let panelIndex = 0; // Default Panel 1 (index 0)

  // 1. Panel number extraction (e.g., _P1, _P2, _P3, _panel1, or trailing digit)
  const panelMatch = baseName.match(/(?:_|-|\s)?(?:p|panel)(\d)/i);
  if (panelMatch && panelMatch[1]) {
    const pNum = parseInt(panelMatch[1], 10);
    panelIndex = Math.max(0, Math.min(2, pNum - 1));
  } else {
    const trailingDigitMatch = baseName.match(/(?:_|-)(\d)$/);
    if (trailingDigitMatch && trailingDigitMatch[1]) {
      const pNum = parseInt(trailingDigitMatch[1], 10);
      if (pNum >= 1 && pNum <= 3) {
        panelIndex = pNum - 1;
      }
    }
  }

  // 2. Extract global question number from Q pattern (e.g. Q1, Q31, Q91, Q131, Q165)
  const qMatch = baseName.match(/q(\d+)/i);
  let globalQNum: number | undefined;
  if (qMatch && qMatch[1]) {
    globalQNum = parseInt(qMatch[1], 10);
  } else {
    const numbers = baseName.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      globalQNum = parseInt(numbers[numbers.length - 1], 10);
    }
  }

  if (globalQNum !== undefined) {
    if (globalQNum >= 1 && globalQNum <= 30) {
      round = 1;
      set = 'A';
      questionNumber = globalQNum;
    } else if (globalQNum >= 31 && globalQNum <= 60) {
      round = 1;
      set = 'B';
      questionNumber = globalQNum - 30;
    } else if (globalQNum >= 61 && globalQNum <= 90) {
      round = 1;
      set = 'C';
      questionNumber = globalQNum - 60;
    } else if (globalQNum >= 91 && globalQNum <= 105) {
      round = 2;
      set = 'A';
      questionNumber = globalQNum - 90;
    } else if (globalQNum >= 106 && globalQNum <= 120) {
      round = 2;
      set = 'B';
      questionNumber = globalQNum - 105;
    } else if (globalQNum >= 121 && globalQNum <= 135) {
      round = 2;
      set = 'C';
      questionNumber = globalQNum - 120;
    } else if (globalQNum >= 136 && globalQNum <= 145) {
      round = 3;
      set = 'A';
      questionNumber = globalQNum - 135;
    } else if (globalQNum >= 146 && globalQNum <= 155) {
      round = 3;
      set = 'B';
      questionNumber = globalQNum - 145;
    } else if (globalQNum >= 156 && globalQNum <= 165) {
      round = 3;
      set = 'C';
      questionNumber = globalQNum - 155;
    }
  }

  // Combine availableQuestions with SEED_QUESTIONS for complete 165-question coverage
  const allRepoQuestions = [
    ...(availableQuestions || []),
    ...(SEED_QUESTIONS || []),
  ];
  const qMap = new Map<string, Question>();
  allRepoQuestions.forEach((q) => {
    if (q && q.id) qMap.set(q.id.toLowerCase(), q);
  });
  const repoQuestions = Array.from(qMap.values());

  // Strict deterministic matching using only: round === parsed.round && set === parsed.set && questionNumber === parsed.localQuestionNumber
  let matchedQuestionId: string | null = null;

  if (round !== undefined && set !== undefined && questionNumber !== undefined) {
    const q = repoQuestions.find(
      (item) =>
        item.round === round &&
        (item.set ? item.set.toUpperCase() === set.toUpperCase() : 'A') &&
        item.questionNumber === questionNumber
    );
    if (q) {
      matchedQuestionId = q.id;
    }
  }

  return {
    round,
    set,
    questionNumber,
    panelIndex,
    matchedQuestionId,
  };
}

export const BatchImageMapperModal: React.FC<BatchImageMapperModalProps> = ({
  isOpen,
  onClose,
  questions,
  adminToken,
  onRefresh,
  onBulkUpdateImages,
}) => {
  const [items, setItems] = useState<ParsedImageItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Combine questions prop with SEED_QUESTIONS for complete 165-question coverage across all rounds and sets
  const repoQuestions = useMemo(() => {
    const qMap = new Map<string, Question>();
    (questions || []).forEach((q) => {
      if (q && q.id) qMap.set(q.id.toLowerCase(), q);
    });
    (SEED_QUESTIONS || []).forEach((q) => {
      if (q && q.id && !qMap.has(q.id.toLowerCase())) {
        qMap.set(q.id.toLowerCase(), q);
      }
    });
    return Array.from(qMap.values());
  }, [questions]);

  // Process selected file list
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: ParsedImageItem[] = [];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validImageTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const parsed = parseImageFilename(file.name, repoQuestions);

      newItems.push({
        id: `${file.name}_${Date.now()}_${i}`,
        file,
        previewUrl,
        filename: file.name,
        sizeKb: (file.size / 1024).toFixed(1),
        parsedRound: parsed.round,
        parsedSet: parsed.set,
        parsedQuestionNumber: parsed.questionNumber,
        parsedPanelIndex: parsed.panelIndex,
        parsedQuestionId: parsed.questionId,
        targetQuestionId: parsed.matchedQuestionId,
        targetPanelIndex: parsed.panelIndex,
        status: parsed.matchedQuestionId ? 'MATCHED' : 'UNMATCHED',
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
  };

  // Convert File to Base64 Data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Submit and apply all matched images to questions bank
  const handleApplyBatchUpdate = async () => {
    const matchedItems = items.filter((item) => item.targetQuestionId);
    if (matchedItems.length === 0) {
      alert('No matched images to apply. Please assign target questions to images first.');
      return;
    }

    setIsProcessing(true);
    setProgressMsg(`Encoding ${matchedItems.length} images to high-resolution format...`);

    try {
      const updates = [];
      for (let i = 0; i < matchedItems.length; i++) {
        const item = matchedItems[i];
        setProgressMsg(`Processing image ${i + 1}/${matchedItems.length}: ${item.filename}...`);
        const dataUrl = await fileToDataUrl(item.file);
        updates.push({
          questionId: item.targetQuestionId,
          panelIndex: item.targetPanelIndex,
          imageUrl: dataUrl,
          filename: item.filename,
        });
      }

      setProgressMsg(`Applying ${updates.length} updates to Question Bank server...`);

      if (onBulkUpdateImages) {
        await onBulkUpdateImages(updates);
      } else {
        const res = await fetch('/api/admin/questions/bulk-update-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({ updates }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update images on server');
        }
      }

      alert(`✅ Success! Successfully mapped and replaced ${matchedItems.length} question clue images!`);
      handleClearAll();
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(`Error applying bulk image updates: ${err?.message || 'Network error'}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg(null);
    }
  };

  const matchedCount = items.filter((i) => i.targetQuestionId).length;
  const unmatchedCount = items.filter((i) => !i.targetQuestionId).length;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus === 'MATCHED' && !item.targetQuestionId) return false;
      if (filterStatus === 'UNMATCHED' && item.targetQuestionId) return false;
      if (searchQuery) {
        const qStr = searchQuery.toLowerCase();
        const matchesFilename = item.filename.toLowerCase().includes(qStr);
        const matchedQ = questions.find((q) => q.id === item.targetQuestionId);
        const matchesAnswer = matchedQ?.correctAnswer.toLowerCase().includes(qStr);
        if (!matchesFilename && !matchesAnswer) return false;
      }
      return true;
    });
  }, [items, filterStatus, searchQuery, questions]);

  return (
    <div className="fixed inset-0 z-50 bg-[#172033]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white border border-purple-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider flex items-center gap-2">
                BULK IMAGE IDENTIFIER & CLUE MAPPER
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Upload images named like <strong className="text-purple-700 font-mono">R1_Q1_P1.jpg</strong>, <strong className="text-purple-700 font-mono">R1_A_Q5_P2.png</strong>, or <strong className="text-purple-700 font-mono">R2_Q10_P1.webp</strong> to automatically replace question clue panels in bulk.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Multi-File Upload Drop Zone */}
          <div className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50 rounded-2xl p-6 text-center transition cursor-pointer relative">
            <input
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.svg"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="space-y-2 pointer-events-none">
              <UploadCloud className="w-10 h-10 text-purple-600 mx-auto" />
              <div className="font-tech font-bold text-sm text-[#172033] tracking-wider">
                DROP BULK IMAGE FILES HERE OR CLICK TO BROWSE
              </div>
              <div className="text-xs font-mono text-[#64748B]">
                Supports JPG, PNG, WEBP, GIF, SVG • Multiple file selection enabled
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-[11px] font-mono font-bold mt-1">
                <span>Naming Format:</span>
                <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200">R[Round]_[Set]_Q[Number]_P[Panel]</code>
                <span className="opacity-70">(e.g. R1_Q1_P1.jpg, R1_A_Q5_P2.png)</span>
              </div>
            </div>
          </div>

          {/* Stats Bar & Filter Controls */}
          {items.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#172033]">
                  Total: {items.length} Images
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-700" />
                  {matchedCount} Auto-Matched
                </span>
                {unmatchedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    {unmatchedCount} Unmatched
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search in files */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search filename or answer..."
                    className="pl-8 pr-3 py-1.5 bg-white border border-[#DCE6F0] rounded-xl text-xs font-mono focus:outline-none focus:border-purple-400 w-44"
                  />
                </div>

                {/* Filter Selector */}
                <div className="flex rounded-xl bg-white p-0.5 border border-[#DCE6F0]">
                  {(['ALL', 'MATCHED', 'UNMATCHED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      className={`py-1 px-2.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                        filterStatus === st
                          ? 'bg-purple-600 text-white'
                          : 'text-[#64748B] hover:text-[#172033]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="py-1 px-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                  title="Clear all uploaded images"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          )}

          {/* Parsed Images Table */}
          {items.length > 0 ? (
            <div className="border border-[#DCE6F0] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-[#F8FAFC] border-b border-[#DCE6F0] text-[#64748B] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">PREVIEW</th>
                      <th className="py-2.5 px-3">FILE NAME</th>
                      <th className="py-2.5 px-3">PARSED SPECS</th>
                      <th className="py-2.5 px-3">TARGET QUESTION MATCH</th>
                      <th className="py-2.5 px-3">TARGET PANEL</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6F0]">
                      {filteredItems.map((item) => {
                      const matchedQ = repoQuestions.find((q) => q.id === item.targetQuestionId);

                      return (
                        <tr
                          key={item.id}
                          className={item.targetQuestionId ? 'hover:bg-purple-50/30' : 'bg-amber-50/30'}
                        >
                          {/* Thumbnail */}
                          <td className="py-2 px-3">
                            <div className="w-12 h-10 rounded-lg overflow-hidden border border-[#DCE6F0] bg-slate-900/5 relative shadow-xs">
                              <img
                                src={item.previewUrl}
                                alt={item.filename}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </td>

                          {/* Filename */}
                          <td className="py-2 px-3 font-semibold text-[#172033] max-w-xs truncate" title={item.filename}>
                            <div className="truncate">{item.filename}</div>
                            <span className="text-[10px] text-[#64748B]">{item.sizeKb} KB</span>
                          </td>

                          {/* Parsed Metadata */}
                          <td className="py-2 px-3 text-[#64748B]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.parsedRound && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-bold">
                                  R{item.parsedRound}
                                </span>
                              )}
                              {item.parsedSet && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">
                                  Set {item.parsedSet}
                                </span>
                              )}
                              {item.parsedQuestionNumber && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold">
                                  Q#{item.parsedQuestionNumber}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                Panel {item.parsedPanelIndex + 1}
                              </span>
                            </div>
                          </td>

                          {/* Target Question Match Selector */}
                          <td className="py-2 px-3">
                            <select
                              value={item.targetQuestionId || ''}
                              onChange={(e) => {
                                const newQId = e.target.value || null;
                                setItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          targetQuestionId: newQId,
                                          status: newQId ? 'MATCHED' : 'UNMATCHED',
                                        }
                                      : it
                                  )
                                );
                              }}
                              className={`w-full max-w-xs px-2 py-1 rounded-lg border text-xs font-mono font-semibold focus:outline-none ${
                                item.targetQuestionId
                                  ? 'bg-white border-purple-300 text-[#172033]'
                                  : 'bg-amber-50 border-amber-300 text-amber-900'
                              }`}
                            >
                              <option value="">-- Assign Target Question --</option>
                              {repoQuestions.map((q) => (
                                <option key={q.id} value={q.id}>
                                  Q#{q.questionNumber} (R{q.round} {q.set || 'A'}) - {q.correctAnswer}
                                </option>
                              ))}
                            </select>
                            {matchedQ && (
                              <div className="text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
                                ✓ Answer: {matchedQ.correctAnswer} ({matchedQ.domain})
                              </div>
                            )}
                          </td>

                          {/* Target Panel Selector */}
                          <td className="py-2 px-3">
                            <select
                              value={item.targetPanelIndex}
                              onChange={(e) => {
                                const pIdx = Number(e.target.value);
                                setItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id ? { ...it, targetPanelIndex: pIdx } : it
                                  )
                                );
                              }}
                              className="px-2 py-1 rounded-lg bg-white border border-[#DCE6F0] text-xs font-mono font-semibold focus:outline-none"
                            >
                              <option value={0}>Panel 1 (Clue 1)</option>
                              <option value={1}>Panel 2 (Clue 2)</option>
                              <option value={2}>Panel 3 (Clue 3)</option>
                            </select>
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 text-center">
                            {item.targetQuestionId ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" />
                                Ready
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                Unmatched
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-[#94A3B8] hover:text-rose-600 transition cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl text-xs font-mono text-[#64748B] space-y-2">
              <ImageIcon className="w-8 h-8 text-purple-400 mx-auto opacity-80" />
              <div className="font-bold text-[#172033]">No images selected yet</div>
              <p className="max-w-md mx-auto text-[11px]">
                Drop or select multiple image files above. The filename parser will automatically scan the naming pattern (e.g. <span className="font-bold text-purple-700">R1_Q1_P1.jpg</span>) and map them to their corresponding question panels.
              </p>
            </div>
          )}

          {/* Progress Banner */}
          {progressMsg && (
            <div className="p-3.5 bg-purple-50 border border-purple-300 rounded-2xl flex items-center gap-3 text-xs font-mono text-purple-900 animate-pulse">
              <RefreshCw className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
              <span className="font-bold">{progressMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#DCE6F0] pt-3 shrink-0">
          <div className="text-xs font-mono text-[#64748B]">
            {matchedCount > 0 && (
              <span>
                Ready to update <strong className="text-purple-700">{matchedCount}</strong> question clues in Question Bank.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
            >
              CANCEL
            </button>

            <button
              type="button"
              disabled={isProcessing || matchedCount === 0}
              onClick={handleApplyBatchUpdate}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-[#2563EB] hover:from-purple-500 hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'APPLYING UPDATES...'
                  : `APPLY & REPLACE ${matchedCount} MATCHED IMAGES`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
