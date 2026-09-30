import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  CheckCircle2, 
  Filter, 
  Layers, 
  Eye, 
  Download, 
  FileCode, 
  Image as ImageIcon, 
  Archive, 
  Sparkles, 
  Check 
} from 'lucide-react';
import { Question, RoundNumber, QuestionSet } from '../types';
import { getRealisticImagesForQuestion } from '../utils/realisticRebusImages';
import { 
  downloadAllPanelImagesZip, 
  downloadPanelImagesDossierHtml 
} from '../utils/panelImagesDownloader';

interface EmergencyOfflineModalProps {
  questions?: Question[];
}

export const EmergencyOfflineModal: React.FC<EmergencyOfflineModalProps> = ({
  questions: propQuestions,
}) => {
  const [questions, setQuestions] = useState<Question[]>(() => {
    if (propQuestions && propQuestions.length > 0) return propQuestions;
    return [];
  });
  const [selectedRound, setSelectedRound] = useState<'ALL' | RoundNumber>('ALL');
  const [selectedSet, setSelectedSet] = useState<'ALL' | QuestionSet>('ALL');
  const [packetMode, setPacketMode] = useState<'MASTER_KEY' | 'STUDENT_EXAM'>('MASTER_KEY');
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const [imageDownloadProgress, setImageDownloadProgress] = useState<string | null>(null);
  const [panelDownloadSuccess, setPanelDownloadSuccess] = useState(false);
  const [showPanelOptions, setShowPanelOptions] = useState(false);

  // Sync when propQuestions updates
  useEffect(() => {
    if (propQuestions && propQuestions.length > 0) {
      setQuestions(propQuestions);
    }
  }, [propQuestions]);

  // If questions empty, fetch authoritative list from server
  useEffect(() => {
    if (!propQuestions || propQuestions.length === 0) {
      fetch('/api/admin/questions')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(data.questions);
          }
        })
        .catch(() => {});
    }
  }, []);

  const filteredQuestions = questions.filter((q) => {
    if (selectedRound !== 'ALL' && q.round !== selectedRound) return false;
    if (selectedSet !== 'ALL' && (q.set || 'A') !== selectedSet) return false;
    return true;
  });

  const getQuestionImages = (q: Question): string[] => {
    if (q.images && q.images.length > 0) {
      return q.images.filter(Boolean);
    }
    if (q.customImageUrl) {
      return [q.customImageUrl];
    }
    return getRealisticImagesForQuestion(q.id, q.explanation);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPanelImagesZip = async () => {
    try {
      setIsDownloadingImages(true);
      setPanelDownloadSuccess(false);
      setImageDownloadProgress('Packaging all panel images into ZIP...');
      await downloadAllPanelImagesZip(
        filteredQuestions,
        String(selectedRound),
        String(selectedSet),
        (prog) => setImageDownloadProgress(prog)
      );
      setPanelDownloadSuccess(true);
      setTimeout(() => setPanelDownloadSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error downloading panel images ZIP:', err);
    } finally {
      setIsDownloadingImages(false);
      setImageDownloadProgress(null);
      setShowPanelOptions(false);
    }
  };

  const handleDownloadPanelImagesDossier = () => {
    downloadPanelImagesDossierHtml(
      filteredQuestions,
      String(selectedRound),
      String(selectedSet)
    );
    setShowPanelOptions(false);
  };

  const handleDownloadImagesJson = () => {
    const payload = {
      title: "TECH BRIDGE '26 QUESTION BANK IMAGES (CURRENT REAL IMAGES)",
      exportedAt: new Date().toISOString(),
      round: selectedRound,
      set: selectedSet,
      totalQuestions: filteredQuestions.length,
      images: filteredQuestions.map((q) => {
        const qImgs = getQuestionImages(q);
        return {
          id: q.id,
          round: q.round,
          set: q.set || 'A',
          questionNumber: q.questionNumber,
          correctAnswer: q.correctAnswer,
          domain: q.domain,
          images: qImgs,
          customImageUrl: qImgs[0] || '',
        };
      }),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TechBridge26_Images_R${selectedRound}_Set${selectedSet}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowPanelOptions(false);
  };

  const handleDownloadHtml = (mode: 'MASTER_KEY' | 'STUDENT_EXAM') => {
    const title = mode === 'MASTER_KEY'
      ? 'TechBridge26_Official_Evaluation_Key'
      : 'TechBridge26_Candidate_Exam_Sheet';

    const questionsHtml = filteredQuestions.map((q, idx) => {
      const qImgs = getQuestionImages(q);
      const imagesHtml = qImgs.length > 0 ? `
        <div style="margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
            📸 REALISTIC REBUS CLUES (${qImgs.length} Connected Images):
          </div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-start; align-items: stretch;">
            ${qImgs.map((imgUrl, i) => `
              <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; width: 230px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <div style="font-size: 10px; font-weight: bold; color: #0369a1; padding: 4px 8px; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; display: flex; justify-content: space-between;">
                  <span>CLUE #${i + 1}</span>
                  <span>REAL IMAGE</span>
                </div>
                <img src="${imgUrl}" alt="Clue #${i + 1}" style="width: 100%; height: 135px; object-fit: cover; display: block;" onerror="this.style.display='none'" />
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      return `
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; font-family: sans-serif;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <strong style="font-size: 15px; color: #0f172a;">QUESTION #${idx + 1} &bull; ROUND ${q.round} (SET ${q.set || 'A'})</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Domain: ${q.domain} &bull; Difficulty: ${q.difficulty} &bull; Points: ${q.points} pt(s)</div>
          </div>
          <div style="font-size: 12px; font-weight: bold; color: #475569;">ID: ${q.id}</div>
        </div>

        <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 10px;">
          Decipher the visual technical computer science rebus from the clue images below:
        </div>

        ${imagesHtml}

        ${mode === 'MASTER_KEY' ? `
          <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 10px; margin-top: 10px;">
            <div style="font-size: 13px; font-weight: bold; color: #065f46;">CORRECT ANSWER: ${q.correctAnswer}</div>
            ${q.aliases && q.aliases.length > 0 ? `<div style="font-size: 11px; color: #047857;">Accepted Aliases: ${q.aliases.join(', ')}</div>` : ''}
            <div style="font-size: 11px; color: #047857; margin-top: 4px;"><strong>Technical Explanation:</strong> ${q.explanation}</div>
          </div>
        ` : `
          <div style="border: 2px dashed #94a3b8; border-radius: 6px; padding: 14px; margin-top: 10px; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: bold; color: #475569;">CANDIDATE ANSWER BLANK:</span>
              <span style="font-size: 11px; color: #64748b;">SCORE: [ &nbsp; &nbsp; &nbsp; / ${q.points} ]</span>
            </div>
            <div style="margin-top: 16px; border-bottom: 1.5px solid #334155; height: 24px;"></div>
          </div>
        `}
      </div>
      `;
    }).join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title} - Tech Bridge '26</title>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; max-width: 900px; margin: 0 auto; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 20px; font-weight: bold; }
          .sub { font-size: 13px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 11px; font-weight: bold; color: #0284c7;">DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING &bull; ACET</div>
            <div class="title">TECH BRIDGE '26 &bull; VISUAL TECHNICAL REBUS CHALLENGE</div>
            <div class="sub">${mode === 'MASTER_KEY' ? 'CONFIDENTIAL EVALUATOR MASTER KEY & MARKING SCHEME' : 'OFFICIAL CANDIDATE EXAM SHEET & REBUS WORKBOOK'}</div>
          </div>
          <div style="text-align: right; font-size: 11px; font-family: monospace;">
            <div>Round: ${selectedRound} &bull; Set: ${selectedSet}</div>
            <div>Questions: ${filteredQuestions.length}</div>
            <div>Date: March 2026</div>
          </div>
        </div>
        ${questionsHtml}
      </body>
      </html>
    `;

    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_R${selectedRound}_Set${selectedSet}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Action & Filter Bar (Hidden on Print) */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 sm:p-6 shadow-sm print:hidden space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-tech text-xl font-bold text-[#172033] tracking-wider">
                EMERGENCY OFFLINE PACKET & QUESTION BANK
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                CSE SYMPOSIUM OFFICIAL
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Complete printable visual question booklet containing realistic photographic clues, question prompts, and evaluation keys.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* DOWNLOAD PANEL IMAGES (ZIP / FOLIO / JSON) */}
            <div className="relative">
              <button
                id="btn-download-panel-images"
                onClick={() => setShowPanelOptions(!showPanelOptions)}
                disabled={isDownloadingImages}
                className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                title="Download all current visual clue panel images in JSON, ZIP or standalone HTML folio"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{isDownloadingImages ? 'PACKAGING IMAGES...' : 'DOWNLOAD PANEL IMAGES'}</span>
              </button>

              {/* Panel Download Options Popup */}
              {showPanelOptions && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#DCE6F0] rounded-2xl shadow-xl p-3 z-50 space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-mono font-bold text-[#172033] uppercase border-b border-[#DCE6F0] pb-1.5 flex items-center justify-between">
                    <span>PANEL IMAGE EXPORT FORMAT</span>
                    <span className="text-[10px] text-[#0891B2] font-semibold">{filteredQuestions.length} Questions</span>
                  </div>

                  <button
                    onClick={handleDownloadImagesJson}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-900 font-tech">IMAGES JSON (IMAGE MAPPING)</div>
                        <div className="text-[10px] text-emerald-700">JSON file with current real images per question. Ready for bulk re-import.</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleDownloadPanelImagesZip}
                    className="w-full p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-purple-700 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-purple-900 font-tech">ZIP ARCHIVE (ALL IMAGES & SVGs)</div>
                        <div className="text-[10px] text-purple-700">Downloads every individual clue panel SVG and photographic scene in an organized ZIP.</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleDownloadPanelImagesDossier}
                    className="w-full p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-700 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-indigo-900 font-tech">STANDALONE VISUAL FOLIO (HTML)</div>
                        <div className="text-[10px] text-indigo-700">Single offline HTML file containing all rendered visual diagrams for printing or projecting.</div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleDownloadImagesJson}
              className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 border border-purple-200 shadow-2xs transition cursor-pointer"
              title="Download Images in JSON format"
            >
              <FileCode className="w-4 h-4 text-purple-600" />
              <span>DOWNLOAD IMAGES JSON</span>
            </button>

            <button
              onClick={() => handleDownloadHtml('MASTER_KEY')}
              className="py-2.5 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 border border-emerald-200 shadow-xs transition cursor-pointer"
              title="Download standalone HTML document of the Evaluation Key"
            >
              <Download className="w-4 h-4" />
              DOWNLOAD EVALUATION KEY
            </button>

            <button
              onClick={() => handleDownloadHtml('STUDENT_EXAM')}
              className="py-2.5 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 border border-blue-200 shadow-xs transition cursor-pointer"
              title="Download standalone HTML document of the Candidate Exam Sheet"
            >
              <Download className="w-4 h-4" />
              DOWNLOAD CANDIDATE SHEET
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              PRINT PACKET
            </button>
          </div>
        </div>

        {/* Progress & Feedback Notifications */}
        {imageDownloadProgress && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-mono text-purple-900 flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{imageDownloadProgress}</span>
          </div>
        )}

        {panelDownloadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>✓ All {filteredQuestions.length} Question Panel Images successfully generated and downloaded!</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#DCE6F0] text-xs">
          {/* Round Filter */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#0891B2]" />
              SELECT ROUND:
            </label>
            <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
              {(['ALL', 1, 2, 3] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRound(r)}
                  className={`flex-1 py-1 px-2 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                    selectedRound === r
                      ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {r === 'ALL' ? 'All' : `R${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Question Set Filter */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#7C3AED]" />
              SELECT QUESTION SET:
            </label>
            <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
              {(['ALL', 'A', 'B', 'C'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSet(s)}
                  className={`flex-1 py-1 px-2 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                    selectedSet === s
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {s === 'ALL' ? 'All Sets' : `Set ${s}`}
                </button>
              ))}
            </div>
          </div>

          {/* Packet Mode Toggle */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              PRINT PACKET FORMAT:
            </label>
            <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
              <button
                type="button"
                onClick={() => setPacketMode('MASTER_KEY')}
                className={`flex-1 py-1 px-2 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                  packetMode === 'MASTER_KEY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                Evaluator Key
              </button>
              <button
                type="button"
                onClick={() => setPacketMode('STUDENT_EXAM')}
                className={`flex-1 py-1 px-2 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                  packetMode === 'STUDENT_EXAM'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                Candidate Exam Sheet
              </button>
            </div>
          </div>
        </div>

        {/* Selected Summary */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-xl border border-[#DCE6F0]">
          <span>
            Displaying <strong className="text-[#0891B2] font-bold">{filteredQuestions.length}</strong> questions in current print packet
          </span>
          <span className="text-[#64748B]">
            Mode: <span className="text-[#172033] font-semibold">{packetMode === 'MASTER_KEY' ? 'Master Answer Key (Answers & Real Images Visible)' : 'Candidate Exam (Real Images & Answer Blanks)'}</span>
          </span>
        </div>
      </div>

      {/* Printable Document Body */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-6 sm:p-10 space-y-8 text-xs text-[#172033] print:bg-white print:text-black print:border-none print:p-0 print:m-0 shadow-sm">
        {/* Document Official Cover Header */}
        <div className="border-b-2 border-[#DCE6F0] pb-6 print:border-black print:pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="inline-block text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-lg bg-cyan-50 text-[#0891B2] border border-[#06B6D4]/30 print:bg-gray-100 print:text-black print:border-black font-semibold">
                DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wider text-[#172033] print:text-black font-tech">
                TECH BRIDGE '26 • VISUAL TECHNICAL REBUS CHALLENGE
              </h2>
              <p className="text-xs text-[#0891B2] font-mono font-medium print:text-gray-800">
                OFFICIAL EMERGENCY CONTINGENCY QUESTION PACKET & REALISTIC CLUE DOSSIER
              </p>
            </div>

            <div className="text-right font-mono text-[11px] text-[#64748B] print:text-black">
              <div>CONFIDENTIAL ID: TB26-OFFLINE</div>
              <div>DATE: SYMPOSIUM DAY 2026</div>
              <div className="font-bold text-rose-600 print:text-black">
                {packetMode === 'MASTER_KEY' ? 'ORGANIZER MASTER KEY' : 'OFFLINE CANDIDATE EXAM SHEET'}
              </div>
            </div>
          </div>

          {packetMode === 'STUDENT_EXAM' && (
            <div className="mt-4 p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl print:border-black print:bg-gray-50 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>TEAM ID: _______________</div>
              <div>TEAM NAME: ___________________</div>
              <div>COLLEGE: _____________________</div>
              <div>SCORE: ______ / {filteredQuestions.reduce((acc, q) => acc + q.points, 0)}</div>
            </div>
          )}
        </div>

        {/* Round Summary Pill Banner */}
        <div className="grid grid-cols-3 gap-3 print:gap-2">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] print:bg-white print:border-gray-400">
            <div className="text-[10px] font-mono font-bold text-[#0891B2] print:text-black">ROUND 1: FOUNDATIONS</div>
            <div className="text-[11px] text-[#64748B] print:text-gray-700">1 pt/Q • 3 Sets (A, B, C) • Core CS & DSA</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] print:bg-white print:border-gray-400">
            <div className="text-[10px] font-mono font-bold text-[#7C3AED] print:text-black">ROUND 2: DISTRIBUTED</div>
            <div className="text-[11px] text-[#64748B] print:text-gray-700">2 pts/Q • 3 Sets (A, B, C) • Cloud & Systems</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] print:bg-white print:border-gray-400">
            <div className="text-[10px] font-mono font-bold text-[#2563EB] print:text-black">ROUND 3: GRAND FINALE</div>
            <div className="text-[11px] text-[#64748B] print:text-gray-700">3 pts/Q • 3 Sets (A, B, C) • AI & Hardware</div>
          </div>
        </div>

        {/* Individual Question Cards with Full Rebus Vector Diagrams & Realistic Images */}
        <div className="space-y-6 print:space-y-4">
          {filteredQuestions.map((q) => {
            const qImgs = getQuestionImages(q);
            return (
            <div
              key={q.id}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-[#DCE6F0] shadow-sm print:bg-white print:border-2 print:border-gray-400 print:shadow-none print:p-4 print:mb-4"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE6F0] print:border-gray-300 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-50 text-[#0891B2] font-mono font-bold text-xs border border-[#06B6D4]/30 print:bg-black print:text-white print:border-black">
                    Q#{q.questionNumber}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[#F1F5F9] border border-[#DCE6F0] text-[#172033] print:bg-gray-100 print:text-black print:border-gray-400">
                    ROUND {q.round} • SET {q.set || 'A'}
                  </span>
                  <span className="font-tech text-xs text-[#172033] font-semibold print:text-black">
                    {q.domain}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    q.difficulty === 'Very Hard'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 print:text-black'
                      : q.difficulty === 'Hard'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 print:text-black'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 print:text-black'
                  }`}>
                    {q.difficulty}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-[#0891B2] font-bold border border-[#06B6D4]/30 print:bg-gray-200 print:text-black print:border-gray-400">
                    +{q.points} PTS
                  </span>
                </div>
              </div>

              {/* CURRENT REALISTIC REBUS PHOTOGRAPHIC CLUES */}
              {qImgs.length > 0 && (
                <div className="mb-4 p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl print:bg-gray-50 print:border-gray-300">
                  <div className="text-[10px] font-mono font-bold text-[#0891B2] uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0891B2]" />
                      <span>REALISTIC PHOTOGRAPHIC CLUES ({qImgs.length} Connected Clues)</span>
                    </span>
                    <span className="text-[9px] text-[#64748B]">Decipher the answer from visual scenes</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {qImgs.map((imgUrl, i) => (
                      <div key={i} className="border border-[#CBD5E1] rounded-lg overflow-hidden bg-white shadow-2xs print:border-gray-400">
                        <div className="px-2 py-1 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between text-[10px] font-mono font-bold text-[#0891B2] print:bg-gray-100 print:text-black">
                          <span>CLUE #{i + 1}</span>
                          <span className="text-[9px] text-[#64748B] print:text-gray-600">PHOTO CLUE</span>
                        </div>
                        <img 
                          src={imgUrl} 
                          alt={`Clue ${i + 1}`} 
                          className="w-full h-32 object-cover block print:h-28"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode-Specific Answer Box */}
              {packetMode === 'MASTER_KEY' ? (
                /* Master Answer Key Section for Evaluator */
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 print:bg-gray-100 print:border-black space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 print:text-black" />
                      <span className="text-[11px] font-mono font-bold text-emerald-800 print:text-black">
                        AUTHORITATIVE ANSWER:
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-900 print:text-black underline underline-offset-2">
                        {q.correctAnswer}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-emerald-800 print:text-gray-800">
                    <span className="font-bold text-emerald-950 print:text-black">ACCEPTED SYNONYMS: </span>
                    {q.aliases.join(', ') || 'None'}
                  </div>

                  {q.explanation && (
                    <div className="text-[11px] text-emerald-800 print:text-gray-700 italic pt-1 border-t border-emerald-200 print:border-gray-300">
                      <strong>Rationale:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ) : (
                /* Offline Candidate Exam Answer Form Section */
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE6F0] print:bg-white print:border-black space-y-2">
                  <div className="font-mono text-xs text-[#172033] print:text-black">
                    <strong>WRITE TEAM ANSWER:</strong> ____________________________________________________________________
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B] print:text-gray-600 flex justify-between">
                    <span>Proctor Signature: _______________________</span>
                    <span>Points Awarded: [  0  ] [  +{q.points}  ]</span>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Official Certification Footer */}
        <div className="border-t-2 border-[#DCE6F0] pt-6 print:border-black print:pt-4 text-[11px] font-mono text-[#64748B] print:text-black flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div>CHIEF TECHNICAL CONVENER &bull; CSE DEPARTMENT SYMPOSIUM</div>
            <div>ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY</div>
          </div>
          <div className="text-right">
            <div>PACKET DIGEST: TB26-VERIFIED-MASTER</div>
            <div>STATUS: OFFICIALLY CERTIFIED FOR COMPETITION</div>
          </div>
        </div>
      </div>
    </div>
  );
};
