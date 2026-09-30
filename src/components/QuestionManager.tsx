import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Upload, 
  Trash2, 
  Edit3, 
  Layers, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileCode, 
  Copy, 
  X, 
  RefreshCw,
  Eye,
  Check,
  Image,
  ArrowRightLeft,
  GitMerge,
  Sliders,
  Sparkles,
  CheckSquare,
  Square,
  Grid,
  FileSpreadsheet,
  UploadCloud,
  FileCheck,
  ListFilter,
  Database
} from 'lucide-react';
import { Question, RoundNumber, QuestionSet } from '../types';
import { PanelVectorArt } from './RebusClueRenderer';

const SVG_OPTIONS = [
  { value: 'brain', label: 'Brain / Intelligence' },
  { value: 'token', label: 'Token / Coins' },
  { value: 'leak', label: 'Water Leak / Drop' },
  { value: 'plates', label: 'Stack / Plates' },
  { value: 'overflow', label: 'Overflow / Spilling' },
  { value: 'road_deadlock', label: 'Road Deadlock' },
  { value: 'pipe', label: 'Pipe / Pipeline' },
  { value: 'cpu', label: 'CPU / Processor' },
  { value: 'cache', label: 'Cache / Memory Slot' },
  { value: 'tree', label: 'Tree / Binary Tree' },
  { value: 'table', label: 'Database / Table' },
  { value: 'server_farm', label: 'Server Rack / Cloud' },
  { value: 'key_lock', label: 'Key & Lock / Crypto' },
  { value: 'clock', label: 'Clock / Timer' },
  { value: 'arrows_sync', label: 'Sync / Loop' },
  { value: 'balance', label: 'Balance / Scale' },
  { value: 'book_library', label: 'Library / Index' },
  { value: 'cube_grid', label: 'Matrix / Grid' },
  { value: 'gear_spin', label: 'Gear / Execution' },
  { value: 'lightning', label: 'Lightning / Speed' },
  { value: 'magnet', label: 'Magnet / Attraction' },
  { value: 'network_mesh', label: 'Network Mesh' },
  { value: 'puzzle_piece', label: 'Puzzle Piece' },
  { value: 'search_glass', label: 'Search Glass' },
  { value: 'shield_check', label: 'Security Shield' },
  { value: 'terminal', label: 'CLI / Terminal' },
  { value: 'traffic_light', label: 'Semaphore / Light' },
  { value: 'umbrella', label: 'Umbrella / Coverage' },
  { value: 'water_bucket', label: 'Bucket / Buffer' },
  { value: 'wifi_signal', label: 'WiFi / Radio' },
  { value: 'wire_circuit', label: 'Circuit / Wire' },
  { value: 'wrench_tool', label: 'Tool / Repair' },
];

interface ParsedBulkImage {
  file: File;
  filename: string;
  dataUrl: string;
  round?: number;
  set?: string;
  questionNumber?: number;
  panelIndex: number; // 0 for P1, 1 for P2, 2 for P3
  matchedQuestionId?: string;
  matchedQuestion?: Question;
  status: 'MATCHED' | 'UNMATCHED';
}

function parseFilenameForQuestion(filename: string, allQuestions: Question[]): Omit<ParsedBulkImage, 'file' | 'dataUrl'> {
  const cleanName = filename.replace(/\.[^/.]+$/, '').trim(); // strip extension
  
  let round: number | undefined;
  let set: string | undefined;
  let questionNumber: number | undefined;
  let panelIndex = 0; // default to panel 1 (index 0)

  // 1. Direct ID match like q1-a-01_p1 or q001_p2
  const directIdMatch = cleanName.match(/^(q\d+-[a-c]-\d+|q\d+)(?:[_\-\s]*[pP]?([123]))?$/i);
  if (directIdMatch) {
    const rawId = directIdMatch[1].toLowerCase();
    if (directIdMatch[2]) {
      panelIndex = Math.max(0, parseInt(directIdMatch[2], 10) - 1);
    }
    const found = allQuestions.find(q => q.id.toLowerCase() === rawId);
    if (found) {
      return {
        filename,
        round: found.round,
        set: found.set || 'A',
        questionNumber: found.questionNumber,
        panelIndex,
        matchedQuestionId: found.id,
        matchedQuestion: found,
        status: 'MATCHED',
      };
    }
  }

  // 2. Full Round + Set + Question + Panel match (e.g. R1_SetA_Q1_P1, R1_A_Q1_P2, R2_B_Q10_P1, R1-A-Q1-1)
  const fullMatch = cleanName.match(/[rR]([123])[_\-\s]*(?:[sS]et)?[_\-\s]*([a-cA-C])[_\-\s]*[qQ]([0-9]+)(?:[_\-\s]*[pP_]([123]))?/i);
  if (fullMatch) {
    round = parseInt(fullMatch[1], 10);
    set = fullMatch[2].toUpperCase();
    questionNumber = parseInt(fullMatch[3], 10);
    if (fullMatch[4]) {
      panelIndex = Math.max(0, parseInt(fullMatch[4], 10) - 1);
    }
  }

  // 3. Round + Question + Panel match (e.g. R1_Q1_P1, R1_Q25_P2, R2-Q10-P1, R3_Q5_2)
  if (!round) {
    const rqMatch = cleanName.match(/[rR]([123])[_\-\s]*[qQ]([0-9]+)(?:[_\-\s]*[pP_]([123]))?/i);
    if (rqMatch) {
      round = parseInt(rqMatch[1], 10);
      questionNumber = parseInt(rqMatch[2], 10);
      if (rqMatch[3]) {
        panelIndex = Math.max(0, parseInt(rqMatch[3], 10) - 1);
      }
    }
  }

  // 4. Question + Panel match (e.g. Q1_P1, Q15_P2, Q100_P1)
  if (!questionNumber) {
    const qpMatch = cleanName.match(/^[qQ]([0-9]+)(?:[_\-\s]*[pP_]([123]))?$/i);
    if (qpMatch) {
      questionNumber = parseInt(qpMatch[1], 10);
      if (qpMatch[2]) {
        panelIndex = Math.max(0, parseInt(qpMatch[2], 10) - 1);
      }
    }
  }

  // Find matching question in database
  let matchedQ: Question | undefined;
  if (round && set && questionNumber) {
    matchedQ = allQuestions.find(q => q.round === round && (q.set || 'A') === set && q.questionNumber === questionNumber);
  } else if (round && questionNumber) {
    matchedQ = allQuestions.find(q => q.round === round && q.questionNumber === questionNumber);
  } else if (questionNumber) {
    matchedQ = allQuestions.find(q => q.questionNumber === questionNumber);
  }

  if (matchedQ) {
    return {
      filename,
      round: matchedQ.round,
      set: matchedQ.set || 'A',
      questionNumber: matchedQ.questionNumber,
      panelIndex,
      matchedQuestionId: matchedQ.id,
      matchedQuestion: matchedQ,
      status: 'MATCHED',
    };
  }

  return {
    filename,
    round,
    set,
    questionNumber,
    panelIndex,
    status: 'UNMATCHED',
  };
}

interface QuestionManagerProps {
  questions: Question[];
  activeQuestionSet: Record<RoundNumber, QuestionSet>;
  currentRound: RoundNumber;
  adminToken: string | null;
  onRefresh: () => void;
  onSelectQuestionSet: (round: RoundNumber, set: QuestionSet) => Promise<void>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  onSaveQuestion: (question: Partial<Question>, isEdit: boolean) => Promise<void>;
  onUploadQuestions: (questions: any[], round?: RoundNumber, set?: QuestionSet, mode?: 'replace' | 'append') => Promise<void>;
  onSetConfig?: (round: RoundNumber, set: QuestionSet, maxCount: number, action: 'limit_active' | 'truncate') => Promise<void>;
  onMergeSets?: (round: RoundNumber, sourceSet: QuestionSet, targetSet: QuestionSet, keepSource: boolean) => Promise<void>;
  onMoveQuestions?: (payload: { questionIds?: string[]; sourceRound?: number; sourceSet?: string; targetRound: number; targetSet: string }) => Promise<void>;
  onAttachImage?: (questionId: string, imageUrl: string, images?: string[]) => Promise<void>;
  onDeleteSelectedQuestions?: (questionIds: string[]) => Promise<void>;
  onDeleteSet?: (round: RoundNumber, set: QuestionSet, confirmation: string) => Promise<void>;
  onDeleteAllQuestions?: (confirmation: string) => Promise<void>;
  onBulkUpdateImages?: (updates: any[]) => Promise<void>;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({
  questions,
  activeQuestionSet,
  currentRound,
  adminToken,
  onRefresh,
  onSelectQuestionSet,
  onDeleteQuestion,
  onSaveQuestion,
  onUploadQuestions,
  onSetConfig,
  onMergeSets,
  onMoveQuestions,
  onAttachImage,
  onDeleteSelectedQuestions,
  onDeleteSet,
  onDeleteAllQuestions,
  onBulkUpdateImages,
}) => {
  // Filtering & search
  const [filterRound, setFilterRound] = useState<'ALL' | RoundNumber>('ALL');
  const [filterSet, setFilterSet] = useState<'ALL' | QuestionSet>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'SINGLE_SET' | 'IMAGE_JSON' | 'BULK_IMAGES'>('SINGLE_SET');
  const [uploadRound, setUploadRound] = useState<RoundNumber>(1);
  const [uploadSet, setUploadSet] = useState<QuestionSet>('A');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('append');
  const [uploadReplaceMode, setUploadReplaceMode] = useState<'append' | 'replace_matching' | 'replace_all'>('append');
  const [uploadJsonText, setUploadJsonText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // IMAGE JSON UPLOAD STATE (Changes ONLY images in current question bank)
  const [imageJsonText, setImageJsonText] = useState('');
  const [parsedImageJsonUpdates, setParsedImageJsonUpdates] = useState<Array<{
    questionId: string;
    round?: number;
    set?: string;
    questionNumber?: number;
    images: string[];
    customImageUrl?: string;
    matchedQuestion?: Question;
    status: 'MATCHED' | 'UNMATCHED';
    reason?: string;
  }>>([]);
  const [imageJsonFilter, setImageJsonFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const [imageJsonSearch, setImageJsonSearch] = useState('');
  const [isParsingImageJson, setIsParsingImageJson] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    totalQuestions: number;
    validCount: number;
    invalidCount: number;
    errors: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }>;
    warnings: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }>;
    matrix?: Record<string, Record<string, number>>;
    normalizedQuestions?: any[];
    message?: string;
  } | null>(null);
  const [imageUploadInfo, setImageUploadInfo] = useState<{ name: string; size: string } | null>(null);

  // Bulk Image Upload & Filename Matcher State
  const [parsedBulkImages, setParsedBulkImages] = useState<ParsedBulkImage[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [bulkImageSearchFilter, setBulkImageSearchFilter] = useState('');
  const [bulkImageStatusFilter, setBulkImageStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const [isBulkImageDragging, setIsBulkImageDragging] = useState(false);

  // Deletion Modals with Verification
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmationInput, setDeleteAllConfirmationInput] = useState('');
  const [showDeleteSetModal, setShowDeleteSetModal] = useState(false);
  const [deleteSetRound, setDeleteSetRound] = useState<RoundNumber>(1);
  const [deleteSetTarget, setDeleteSetTarget] = useState<QuestionSet>('A');
  const [deleteSetConfirmationInput, setDeleteSetConfirmationInput] = useState('');
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

  // Set Configuration Modal (Select how many questions a set has)
  const [showSetConfigModal, setShowSetConfigModal] = useState(false);
  const [configRound, setConfigRound] = useState<RoundNumber>(1);
  const [configSet, setConfigSet] = useState<QuestionSet>('A');
  const [configCount, setConfigCount] = useState<number>(10);
  const [configAction, setConfigAction] = useState<'limit_active' | 'truncate'>('limit_active');

  // Merge Sets Modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeRound, setMergeRound] = useState<RoundNumber>(1);
  const [mergeSourceSet, setMergeSourceSet] = useState<QuestionSet>('B');
  const [mergeTargetSet, setMergeTargetSet] = useState<QuestionSet>('A');
  const [mergeKeepSource, setMergeKeepSource] = useState<boolean>(true);

  // Move Questions Modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveMode, setMoveMode] = useState<'selected' | 'entire_set'>('entire_set');
  const [moveSourceRound, setMoveSourceRound] = useState<RoundNumber>(1);
  const [moveSourceSet, setMoveSourceSet] = useState<QuestionSet>('B');
  const [moveTargetRound, setMoveTargetRound] = useState<RoundNumber>(1);
  const [moveTargetSet, setMoveTargetSet] = useState<QuestionSet>('A');

  // Question Selection (for bulk move/actions)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Attach Image Modal (Multiple Connected Realistic Images & Clipboard Paste)
  const [showAttachImageModal, setShowAttachImageModal] = useState(false);
  const [targetQuestionForImage, setTargetQuestionForImage] = useState<Question | null>(null);
  const [imageUrl1ToAttach, setImageUrl1ToAttach] = useState('');
  const [imageUrl2ToAttach, setImageUrl2ToAttach] = useState('');
  const [imageUrl3ToAttach, setImageUrl3ToAttach] = useState('');
  const [activePasteSlot, setActivePasteSlot] = useState<number | null>(null);

  // Operational Notification Banner
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Question Form State for Add / Edit
  const [formData, setFormData] = useState<{
    round: RoundNumber;
    set: QuestionSet;
    questionNumber: number;
    domain: string;
    difficulty: 'Medium' | 'Hard' | 'Very Hard';
    points: number;
    correctAnswer: string;
    aliases: string;
    rebusFormulaText: string;
    explanation: string;
    panel1Desc: string;
    panel1Svg: string;
    panel2Desc: string;
    panel2Svg: string;
    customImageUrl: string;
    active: boolean;
  }>({
    round: 1,
    set: 'A',
    questionNumber: 1,
    domain: 'Computer Science',
    difficulty: 'Medium',
    points: 1,
    correctAnswer: '',
    aliases: '',
    rebusFormulaText: 'Panel 1 + Panel 2',
    explanation: '',
    panel1Desc: '',
    panel1Svg: 'token',
    panel2Desc: '',
    panel2Svg: 'brain',
    customImageUrl: '',
    active: true,
  });

  const resetForm = () => {
    setFormData({
      round: currentRound || 1,
      set: activeQuestionSet?.[currentRound || 1] || 'A',
      questionNumber: 1,
      domain: 'Computer Science',
      difficulty: (currentRound === 1 ? 'Medium' : currentRound === 2 ? 'Hard' : 'Very Hard'),
      points: currentRound === 1 ? 1 : currentRound === 2 ? 2 : 3,
      correctAnswer: '',
      aliases: '',
      rebusFormulaText: 'Panel 1 + Panel 2',
      explanation: '',
      panel1Desc: '',
      panel1Svg: 'token',
      panel2Desc: '',
      panel2Svg: 'brain',
      customImageUrl: '',
      active: true,
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      round: q.round,
      set: q.set || 'A',
      questionNumber: q.questionNumber,
      domain: q.domain,
      difficulty: q.difficulty,
      points: q.points,
      correctAnswer: q.correctAnswer,
      aliases: q.aliases.join(', '),
      rebusFormulaText: q.rebusFormulaText,
      explanation: q.explanation,
      panel1Desc: q.cluePanels[0]?.description || '',
      panel1Svg: q.cluePanels[0]?.svgType || 'token',
      panel2Desc: q.cluePanels[1]?.description || '',
      panel2Svg: q.cluePanels[1]?.svgType || 'brain',
      customImageUrl: q.customImageUrl || (q.images && q.images[0]) || '',
      active: q.active !== false,
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.correctAnswer.trim()) {
      alert('Authoritative correct answer is required.');
      return;
    }

    setActionLoading(true);
    try {
      const payload: Partial<Question> = {
        id: editingQuestion?.id,
        round: formData.round,
        set: formData.set,
        questionNumber: Number(formData.questionNumber),
        domain: formData.domain.trim(),
        difficulty: formData.difficulty,
        points: Number(formData.points),
        correctAnswer: formData.correctAnswer.trim(),
        aliases: formData.aliases
          .split(',')
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
        rebusFormulaText: formData.rebusFormulaText.trim() || 'Panel 1 + Panel 2',
        explanation: formData.explanation.trim(),
        active: formData.active,
        customImageUrl: formData.customImageUrl?.trim() || undefined,
        cluePanels: [
          {
            panelNumber: 1,
            description: formData.panel1Desc.trim() || 'Visual clue panel 1',
            svgType: formData.panel1Svg,
          },
          {
            panelNumber: 2,
            description: formData.panel2Desc.trim() || 'Visual clue panel 2',
            svgType: formData.panel2Svg,
          },
        ],
      };

      await onSaveQuestion(payload, !!editingQuestion);
      setShowAddModal(false);
      setEditingQuestion(null);
      setFeedbackNotice(`Question #${payload.questionNumber} saved successfully with realistic imagery.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Error saving question: ${err?.message || 'Server error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Set Count Configuration Handler
  const handleSetConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (onSetConfig) {
        await onSetConfig(configRound, configSet, configCount, configAction);
      } else {
        await fetch('/api/admin/questions/set-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            round: configRound,
            set: configSet,
            maxCount: configCount,
            action: configAction,
          }),
        });
      }
      setShowSetConfigModal(false);
      setFeedbackNotice(`Set ${configSet} in Round ${configRound} configured to ${configCount} questions (${configAction}).`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to set question count: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Merge Sets Handler
  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mergeSourceSet === mergeTargetSet) {
      alert('Source set and target set cannot be the same.');
      return;
    }
    setActionLoading(true);
    try {
      if (onMergeSets) {
        await onMergeSets(mergeRound, mergeSourceSet, mergeTargetSet, mergeKeepSource);
      } else {
        await fetch('/api/admin/questions/merge-sets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            round: mergeRound,
            sourceSet: mergeSourceSet,
            targetSet: mergeTargetSet,
            keepSource: mergeKeepSource,
          }),
        });
      }
      setShowMergeModal(false);
      setFeedbackNotice(`Merged Round ${mergeRound} Set ${mergeSourceSet} into Set ${mergeTargetSet} successfully.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to merge sets: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Move Questions Handler
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = moveMode === 'selected' 
        ? {
            questionIds: selectedQuestionIds,
            targetRound: moveTargetRound,
            targetSet: moveTargetSet,
          }
        : {
            sourceRound: moveSourceRound,
            sourceSet: moveSourceSet,
            targetRound: moveTargetRound,
            targetSet: moveTargetSet,
          };

      if (onMoveQuestions) {
        await onMoveQuestions(payload);
      } else {
        await fetch('/api/admin/questions/move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      }
      setShowMoveModal(false);
      setSelectedQuestionIds([]);
      setFeedbackNotice(`Questions moved to Round ${moveTargetRound} Set ${moveTargetSet} successfully.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to move questions: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to process uploaded or pasted image files / blobs (converting to base64 Data URLs)
  const processImageFileOrBlob = (file: File | Blob, onResult: (dataUrl: string, name?: string) => void) => {
    if (!file.type.startsWith('image/')) {
      alert('Please provide a valid image file (PNG, JPG, JPEG, WEBP, GIF, SVG).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Image file size must be less than 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      onResult(base64, (file as File).name || 'pasted-image.png');
    };
    reader.readAsDataURL(file);
  };

  // Direct Clipboard Paste Handler (Ctrl+V / Cmd+V)
  const handleClipboardPasteForSlot = (
    e: React.ClipboardEvent,
    onResult: (dataUrl: string) => void
  ) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFileOrBlob(file, (dataUrl) => onResult(dataUrl));
            e.preventDefault();
            return;
          }
        }
      }
    }
    const pastedText = e.clipboardData?.getData('text')?.trim();
    if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://') || pastedText.startsWith('data:image/'))) {
      onResult(pastedText);
      e.preventDefault();
    }
  };

  // System Clipboard Reader Button API (Clipboard API)
  const pasteFromClipboardApi = async (onResult: (dataUrl: string) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            processImageFileOrBlob(blob, (dataUrl) => onResult(dataUrl));
            return;
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
          onResult(text);
          return;
        }
      }
      const manual = window.prompt('Paste copied Image URL or Base64 Data URI here:');
      if (manual && manual.trim()) {
        onResult(manual.trim());
      }
    } catch {
      const manual = window.prompt('Paste copied Image URL or Base64 Data URI here:');
      if (manual && manual.trim()) {
        onResult(manual.trim());
      }
    }
  };

  // Attach Images Handler (2-3 connected realistic photographic clues)
  const handleAttachImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetQuestionForImage) return;
    setActionLoading(true);
    try {
      const imagesToSave = [imageUrl1ToAttach.trim(), imageUrl2ToAttach.trim(), imageUrl3ToAttach.trim()].filter(Boolean);
      
      if (onAttachImage) {
        await onAttachImage(targetQuestionForImage.id, imagesToSave[0] || '', imagesToSave);
      } else {
        await fetch('/api/admin/question/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            questionId: targetQuestionForImage.id,
            images: imagesToSave,
            imageUrl: imagesToSave[0] || '',
          }),
        });
      }
      setShowAttachImageModal(false);
      setTargetQuestionForImage(null);
      setImageUrl1ToAttach('');
      setImageUrl2ToAttach('');
      setImageUrl3ToAttach('');
      setFeedbackNotice(`${imagesToSave.length} connected realistic images saved for Question #${targetQuestionForImage.questionNumber}.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to attach images: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Attached Images to Default Master Photographic Rebus
  const handleResetImagesToDefault = async () => {
    if (!targetQuestionForImage) return;
    if (!window.confirm(`Reset Question #${targetQuestionForImage.questionNumber} clue images back to default photographic master clues?`)) {
      return;
    }
    setActionLoading(true);
    try {
      if (onAttachImage) {
        await onAttachImage(targetQuestionForImage.id, '', []);
      } else {
        await fetch('/api/admin/question/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            questionId: targetQuestionForImage.id,
            images: [],
            imageUrl: '',
          }),
        });
      }
      setShowAttachImageModal(false);
      setTargetQuestionForImage(null);
      setImageUrl1ToAttach('');
      setImageUrl2ToAttach('');
      setImageUrl3ToAttach('');
      setFeedbackNotice(`Reset Question #${targetQuestionForImage.questionNumber} clues to master realistic photographic images.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to reset images: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Load Existing 3-Set Repository Handler
  const handleLoadSeedQuestions = async () => {
    if (!window.confirm("Load existing 3-set questions repository (Set A, Set B, Set C for each round)?")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/questions/load-seed-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({ mode: 'replace' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load existing 3 sets');
      }
      setFeedbackNotice(`Existing 3-set questions repository successfully loaded (${data.totalQuestions} questions across Set A, B, C).`);
      setTimeout(() => setFeedbackNotice(null), 4500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to load existing questions: ${err?.message || 'Network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete) return;
    setActionLoading(true);
    try {
      await onDeleteQuestion(questionToDelete.id);
      setQuestionToDelete(null);
      setFeedbackNotice(`Question #${questionToDelete.questionNumber} deleted successfully.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  // Delete All Questions Handler (with Verification)
  const handleDeleteAllSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteAllConfirmationInput.trim().toUpperCase() !== 'DELETE ALL') {
      alert('Verification mismatch: Please type "DELETE ALL" to confirm deleting all questions.');
      return;
    }
    setActionLoading(true);
    try {
      if (onDeleteAllQuestions) {
        await onDeleteAllQuestions('DELETE ALL');
      } else {
        const res = await fetch('/api/admin/questions/delete-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({ confirmation: 'DELETE ALL' }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete all questions');
        }
      }
      setShowDeleteAllModal(false);
      setDeleteAllConfirmationInput('');
      setSelectedQuestionIds([]);
      setFeedbackNotice('All questions have been permanently deleted from the question bank.');
      setTimeout(() => setFeedbackNotice(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Delete All failed: ${err?.message || 'Server error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Selected Questions Handler (with Verification)
  const handleDeleteSelectedSubmit = async () => {
    if (selectedQuestionIds.length === 0) return;
    setActionLoading(true);
    try {
      if (onDeleteSelectedQuestions) {
        await onDeleteSelectedQuestions(selectedQuestionIds);
      } else {
        const res = await fetch('/api/admin/questions/delete-selected', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({ questionIds: selectedQuestionIds }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete selected questions');
        }
      }
      const count = selectedQuestionIds.length;
      setShowDeleteSelectedModal(false);
      setSelectedQuestionIds([]);
      setFeedbackNotice(`Successfully deleted ${count} selected questions.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Delete Selected failed: ${err?.message || 'Server error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Question Set Handler (with Verification)
  const handleDeleteSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expected = `DELETE R${deleteSetRound} SET ${deleteSetTarget}`;
    if (deleteSetConfirmationInput.trim().toUpperCase() !== expected) {
      alert(`Verification mismatch: Please type "${expected}" to confirm.`);
      return;
    }
    setActionLoading(true);
    try {
      if (onDeleteSet) {
        await onDeleteSet(deleteSetRound, deleteSetTarget, expected);
      } else {
        const res = await fetch('/api/admin/questions/delete-set', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            round: deleteSetRound,
            set: deleteSetTarget,
            confirmation: expected,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete question set');
        }
      }
      setShowDeleteSetModal(false);
      setDeleteSetConfirmationInput('');
      setFeedbackNotice(`Purged Round ${deleteSetRound} Set ${deleteSetTarget} successfully.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert(`Delete Set failed: ${err?.message || 'Server error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // IMAGE JSON HANDLERS (Changes ONLY Images in Current Question Bank)
  // ==========================================
  const handleProcessImageJson = (rawText: string) => {
    setImageJsonText(rawText);
    setUploadError(null);
    if (!rawText.trim()) {
      setParsedImageJsonUpdates([]);
      return;
    }

    try {
      setIsParsingImageJson(true);
      const parsed = JSON.parse(rawText);
      let itemsList: any[] = [];

      if (Array.isArray(parsed)) {
        itemsList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.images)) {
          itemsList = parsed.images;
        } else if (Array.isArray(parsed.questions)) {
          itemsList = parsed.questions;
        } else {
          itemsList = Object.entries(parsed).map(([key, val]) => {
            const imgs = Array.isArray(val)
              ? val
              : typeof val === 'string'
              ? [val]
              : val && (val as any).images
              ? (val as any).images
              : [];
            return {
              id: key,
              images: imgs,
            };
          });
        }
      }

      const results: Array<{
        questionId: string;
        round?: number;
        set?: string;
        questionNumber?: number;
        images: string[];
        customImageUrl?: string;
        matchedQuestion?: Question;
        status: 'MATCHED' | 'UNMATCHED';
        reason?: string;
      }> = [];

      itemsList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const rawId = item.id || item.questionId || item.question_id || item.qId || item.q_id;
        const qNum = item.questionNumber || item.question_number || item.questionNo || item.question_no || item.qNum || item.q_num || item.qno || item.no || item.number || item.num || item.q;
        const round = item.round || item.roundNumber || item.round_number || item.r;
        const set = item.set || item.questionSet || item.question_set || item.setName || item.set_name || item.s
          ? String(item.set || item.questionSet || item.question_set || item.setName || item.set_name || item.s).toUpperCase().trim()
          : undefined;
        const titleOrAnswer = item.correctAnswer || item.answer || item.title || item.name;

        // Comprehensive extraction of images from all common key conventions
        let itemImages: string[] = [];
        if (Array.isArray(item.images)) {
          itemImages = item.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
        } else if (item.imageUrl && typeof item.imageUrl === 'string') {
          itemImages = [item.imageUrl.trim()];
        } else if (item.image_url && typeof item.image_url === 'string') {
          itemImages = [item.image_url.trim()];
        } else if (item.customImageUrl && typeof item.customImageUrl === 'string') {
          itemImages = [item.customImageUrl.trim()];
        } else if (item.custom_image_url && typeof item.custom_image_url === 'string') {
          itemImages = [item.custom_image_url.trim()];
        } else if (item.image && typeof item.image === 'string') {
          itemImages = [item.image.trim()];
        } else if (Array.isArray(item.image)) {
          itemImages = item.image.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
        } else if (item.url && typeof item.url === 'string') {
          itemImages = [item.url.trim()];
        } else if (Array.isArray(item.urls)) {
          itemImages = item.urls.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
        } else if (item.img && typeof item.img === 'string') {
          itemImages = [item.img.trim()];
        } else if (item.photo && typeof item.photo === 'string') {
          itemImages = [item.photo.trim()];
        } else if (Array.isArray(item.photos)) {
          itemImages = item.photos.filter((p: any) => typeof p === 'string' && p.trim().length > 0);
        } else if (item.dataUrl && typeof item.dataUrl === 'string') {
          itemImages = [item.dataUrl.trim()];
        } else if (item.data_url && typeof item.data_url === 'string') {
          itemImages = [item.data_url.trim()];
        }

        if (itemImages.length === 0) {
          results.push({
            questionId: rawId || `item-${idx + 1}`,
            round: round ? Number(round) : undefined,
            set,
            questionNumber: qNum ? Number(qNum) : undefined,
            images: [],
            status: 'UNMATCHED',
            reason: 'No valid image URLs or base64 data found in item',
          });
          return;
        }

        let matchedQ: Question | undefined;

        // 1. Direct ID match (case-insensitive and trimmed)
        if (rawId) {
          const cleanId = String(rawId).toLowerCase().trim();
          matchedQ = questions.find((q) => {
            const qIdLow = q.id.toLowerCase();
            if (qIdLow === cleanId) return true;
            // Match stripped IDs (e.g. q1-a-01 matching q1-a-01-8866)
            const baseQId = qIdLow.replace(/-[a-z0-9]{3,8}$/, '');
            const baseCleanId = cleanId.replace(/-[a-z0-9]{3,8}$/, '');
            return baseQId === baseCleanId || qIdLow.startsWith(cleanId) || cleanId.startsWith(qIdLow);
          });
        }

        // 2. Round + Set + QuestionNumber match
        if (!matchedQ && round && set && qNum) {
          matchedQ = questions.find(
            (q) => Number(q.round) === Number(round) && (q.set || 'A').toUpperCase() === set && Number(q.questionNumber) === Number(qNum)
          );
        }

        // 3. Round + QuestionNumber match
        if (!matchedQ && round && qNum) {
          matchedQ = questions.find((q) => Number(q.round) === Number(round) && Number(q.questionNumber) === Number(qNum));
        }

        // 4. QuestionNumber match
        if (!matchedQ && qNum) {
          matchedQ = questions.find((q) => Number(q.questionNumber) === Number(qNum));
        }

        // 5. Numeric ID match (e.g. "1" or "q1" matching question #1)
        if (!matchedQ && rawId) {
          const numMatch = String(rawId).match(/\d+/);
          if (numMatch) {
            const n = Number(numMatch[0]);
            matchedQ = questions.find((q) => Number(q.questionNumber) === n);
          }
        }

        // 6. Title / Correct Answer match
        if (!matchedQ && titleOrAnswer) {
          const cleanTitle = String(titleOrAnswer).toLowerCase().trim();
          matchedQ = questions.find(
            (q) =>
              q.correctAnswer.toLowerCase().trim() === cleanTitle ||
              (q.title && q.title.toLowerCase().trim() === cleanTitle) ||
              (q.aliases && q.aliases.some((a) => a.toLowerCase().trim() === cleanTitle))
          );
        }

        if (matchedQ) {
          results.push({
            questionId: matchedQ.id,
            round: matchedQ.round,
            set: matchedQ.set || 'A',
            questionNumber: matchedQ.questionNumber,
            images: itemImages,
            customImageUrl: itemImages[0] || '',
            matchedQuestion: matchedQ,
            status: 'MATCHED',
          });
        } else {
          results.push({
            questionId: rawId || `Q#${qNum || idx + 1}`,
            round: round ? Number(round) : undefined,
            set,
            questionNumber: qNum ? Number(qNum) : undefined,
            images: itemImages,
            customImageUrl: itemImages[0] || '',
            status: 'UNMATCHED',
            reason: 'Question not found in current question bank',
          });
        }
      });

      setParsedImageJsonUpdates(results);
    } catch (err: any) {
      setUploadError(`Failed to parse Image JSON: ${err.message || 'Invalid JSON syntax'}`);
    } finally {
      setIsParsingImageJson(false);
    }
  };

  const handleApplyImageJsonUpdates = async () => {
    const matchedItems = parsedImageJsonUpdates.filter((i) => i.status === 'MATCHED' && i.images.length > 0);
    if (matchedItems.length === 0) {
      setUploadError('No matched questions with images to update.');
      return;
    }

    try {
      setActionLoading(true);
      const updates = matchedItems.map((item) => ({
        questionId: item.questionId,
        round: item.round,
        set: item.set,
        questionNumber: item.questionNumber,
        images: item.images,
        customImageUrl: item.customImageUrl || item.images[0] || '',
      }));

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
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update images');
        }
      }

      setFeedbackNotice(`✓ Successfully updated images for ${matchedItems.length} questions in question bank!`);
      setShowUploadModal(false);
      setParsedImageJsonUpdates([]);
      setImageJsonText('');
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message || 'Error updating question images.');
    } finally {
      setActionLoading(false);
    }
  };

  const loadSampleImageJson = () => {
    const sample = questions.slice(0, 3).map((q) => ({
      id: q.id,
      round: q.round,
      set: q.set || 'A',
      questionNumber: q.questionNumber,
      correctAnswer: q.correctAnswer,
      images: [
        `https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=800&q=80`,
        `https://images.unsplash.com/photo-1508873696983-2df5293cbdaf?auto=format&fit=crop&w=800&q=80`,
      ],
    }));
    handleProcessImageJson(JSON.stringify(sample, null, 2));
  };

  // Process multiple bulk image files
  const handleProcessBulkImageFiles = async (files: FileList | File[]) => {
    setIsProcessingImages(true);
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i));
    if (fileArray.length === 0) {
      alert('No valid image files found (.jpg, .jpeg, .png, .webp, .svg, .gif).');
      setIsProcessingImages(false);
      return;
    }

    const results: ParsedBulkImage[] = [];

    for (const file of fileArray) {
      const parsed = parseFilenameForQuestion(file.name, questions);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      if (dataUrl) {
        results.push({
          file,
          filename: file.name,
          dataUrl,
          ...parsed,
        });
      }
    }

    setParsedBulkImages(prev => {
      const existingNames = new Set(results.map(r => r.filename));
      const filteredPrev = prev.filter(p => !existingNames.has(p.filename));
      return [...filteredPrev, ...results];
    });
    setIsProcessingImages(false);
  };

  // Apply Bulk Image Replacements to Question Bank
  const handleApplyBulkImageUpdates = async () => {
    const matchedUpdates = parsedBulkImages.filter(item => item.status === 'MATCHED' && item.dataUrl);
    if (matchedUpdates.length === 0) {
      alert('No matched images found to apply. Please make sure filenames match the question format (e.g., R1_Q1_P1.jpg).');
      return;
    }
    setActionLoading(true);
    try {
      const payload = matchedUpdates.map(item => ({
        questionId: item.matchedQuestionId || item.matchedQuestion?.id,
        round: item.round,
        set: item.set,
        questionNumber: item.questionNumber,
        panelIndex: item.panelIndex,
        imageUrl: item.dataUrl,
        filename: item.filename,
      }));

      const res = await fetch('/api/admin/questions/bulk-update-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({ updates: payload }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update images');
      }

      setShowUploadModal(false);
      setParsedBulkImages([]);
      setFeedbackNotice(`Successfully replaced clue images for ${data.updatedCount || matchedUpdates.length} questions!`);
      setTimeout(() => setFeedbackNotice(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Bulk Image Update failed: ${err?.message || 'Server error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Image File Upload Handler for Question Modal
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP, GIF, SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        customImageUrl: base64,
      }));
      setImageUploadInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      });
    };
    reader.readAsDataURL(file);
  };

  // Validate JSON Schema
  const handleValidateJsonSchema = async () => {
    if (!uploadJsonText.trim()) {
      setUploadError('Please enter JSON text or load a template before validating.');
      return;
    }

    setIsValidating(true);
    setUploadError(null);
    setValidationResult(null);

    try {
      const res = await fetch('/api/admin/questions/validate-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ content: uploadJsonText }),
      });

      const data = await res.json();
      if (res.ok) {
        setValidationResult(data);
      } else {
        setUploadError(data.error || 'JSON Schema Validation Failed');
        if (data.errors) {
          setValidationResult(data);
        }
      }
    } catch (err: any) {
      // Fallback local validation
      try {
        const parsed = JSON.parse(uploadJsonText);
        const list = Array.isArray(parsed) ? parsed : parsed.questions || [];
        const errs: any[] = [];
        list.forEach((item: any, idx: number) => {
          if (!item.correctAnswer && !item.answer) {
            errs.push({ index: idx, field: 'correctAnswer', message: 'Missing required correctAnswer' });
          }
        });
        setValidationResult({
          valid: errs.length === 0,
          totalQuestions: list.length,
          validCount: list.length - errs.length,
          invalidCount: errs.length,
          errors: errs,
          warnings: [],
          message: errs.length === 0 ? 'Local JSON Schema Validated Successfully' : 'Schema errors detected',
        });
      } catch (parseErr: any) {
        setUploadError(`Invalid JSON Syntax: ${parseErr.message}`);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadSubmit = async () => {
    setUploadError(null);
    if (!uploadJsonText.trim()) {
      setUploadError('Please enter valid JSON or load a sample template.');
      return;
    }

    if (!window.confirm("Are you sure you want to change the bulk questions? This will update the question bank.")) {
      return;
    }

    setActionLoading(true);
    try {
      const parsed = JSON.parse(uploadJsonText);
      const questionsList = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questionsList) || questionsList.length === 0) {
        setUploadError('JSON must contain an array of questions.');
        return;
      }

      await onUploadQuestions(questionsList, uploadRound, uploadSet, uploadMode);
      setShowUploadModal(false);
      setUploadJsonText('');
      setValidationResult(null);
      setFeedbackNotice(`Successfully imported questions for Round ${uploadRound} Set ${uploadSet}`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: any) {
      setUploadError(`Error processing import: ${err?.message || 'Check JSON structure'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadSampleTemplate = () => {
    const sample = [
      {
        questionNumber: 1,
        round: uploadRound,
        set: uploadSet,
        domain: 'Operating Systems',
        difficulty: 'Medium',
        points: uploadRound === 1 ? 1 : uploadRound === 2 ? 2 : 3,
        rebusFormulaText: 'Panel 1 (Resource) + Panel 2 (Hold)',
        correctAnswer: 'Deadlock',
        aliases: ['deadlock', 'circular wait', 'mutual exclusion'],
        explanation: 'Processes blocked waiting for resources held by each other.',
        cluePanels: [
          { panelNumber: 1, description: '4-way grid traffic deadlock junction', svgType: 'road_deadlock' },
          { panelNumber: 2, description: 'Interlocking security key and closed lock', svgType: 'key_lock' },
        ],
      },
      {
        questionNumber: 2,
        round: uploadRound,
        set: uploadSet,
        domain: 'Computer Architecture',
        difficulty: 'Hard',
        points: uploadRound === 1 ? 1 : uploadRound === 2 ? 2 : 3,
        rebusFormulaText: 'Panel 1 (Fast SRAM) + Panel 2 (Direct Map)',
        correctAnswer: 'Cache Memory',
        aliases: ['cache', 'cache memory', 'l1 cache'],
        explanation: 'High-speed buffer between CPU registers and main memory.',
        cluePanels: [
          { panelNumber: 1, description: 'Multi-level high speed silicon memory unit', svgType: 'cache' },
          { panelNumber: 2, description: 'Microprocessor core executing high-frequency clock', svgType: 'cpu' },
        ],
      },
    ];

    setUploadJsonText(JSON.stringify(sample, null, 2));
    setUploadError(null);
    setValidationResult(null);
  };

  // Filter questions list
  const filteredQuestions = questions.filter((q) => {
    if (filterRound !== 'ALL' && q.round !== filterRound) return false;
    if (filterSet !== 'ALL' && (q.set || 'A') !== filterSet) return false;
    if (searchQuery.trim()) {
      const s = searchQuery.toLowerCase();
      const matchNumber = `q${q.questionNumber}`.includes(s) || `#${q.questionNumber}`.includes(s);
      const matchAnswer = q.correctAnswer.toLowerCase().includes(s);
      const matchDomain = q.domain.toLowerCase().includes(s);
      const matchFormula = q.rebusFormulaText.toLowerCase().includes(s);
      const matchAliases = q.aliases.some((a) => a.toLowerCase().includes(s));
      if (!matchNumber && !matchAnswer && !matchDomain && !matchFormula && !matchAliases) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. ACTIVE QUESTION SET CONTROLLER FOR EACH ROUND */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                AUTHORITATIVE QUESTION SET SELECTOR
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Admin selects which set of questions participants will receive for each round (Set A, Set B, or Set C). Only the chosen set is active.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs font-mono text-[#172033] flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0891B2]" />
              SYNC BANK
            </button>
          </div>
        </div>

        {/* 3 Round Set Selector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {([1, 2, 3] as const).map((r) => {
            const activeSet = activeQuestionSet?.[r] || 'A';
            const isCurrentRound = currentRound === r;

            return (
              <div
                key={r}
                className={`p-4 rounded-xl border transition ${
                  isCurrentRound
                    ? 'bg-cyan-50/50 border-[#06B6D4] shadow-sm'
                    : 'bg-[#F8FAFC] border-[#DCE6F0]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-tech text-xs font-bold text-[#172033]">
                      ROUND {r}
                    </span>
                    {isCurrentRound && (
                      <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-mono bg-cyan-100 text-[#0891B2] border border-cyan-200 font-bold">
                        LIVE STAGE
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#7C3AED] font-bold">
                    Active: Set {activeSet}
                  </span>
                </div>

                <p className="text-[11px] text-[#64748B] mb-3">
                  Choose participant set for Round {r}:
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(['A', 'B', 'C'] as const).map((setName) => {
                    const isSelected = activeSet === setName;
                    const count = questions.filter(
                      (q) => q.round === r && (q.set || 'A') === setName
                    ).length;

                    return (
                      <button
                        key={setName}
                        onClick={() => onSelectQuestionSet(r, setName)}
                        className={`py-2 px-2 rounded-lg border text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-sm font-bold'
                            : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033] hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="font-mono text-xs">SET {setName}</div>
                        <div className="text-[10px] opacity-80 font-mono mt-0.5">
                          {count} Qs
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* SET MANAGEMENT TOOLBAR & BULK ACTIONS */}
        <div className="pt-4 border-t border-[#DCE6F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSetConfigModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-cyan-200 text-xs font-mono text-[#0891B2] font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
              title="Set how many questions a set has (limit active or truncate)"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0891B2]" />
              <span>SET QUESTION COUNT</span>
            </button>

            <button
              onClick={() => setShowMergeModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-purple-200 text-xs font-mono text-[#7C3AED] font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
              title="Merge questions from one set into another set"
            >
              <GitMerge className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>MERGE SETS</span>
            </button>

            <button
              onClick={() => {
                setMoveMode(selectedQuestionIds.length > 0 ? 'selected' : 'entire_set');
                setShowMoveModal(true);
              }}
              className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-amber-200 text-xs font-mono text-amber-700 font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
              title="Move questions or entire set to another set or round"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              <span>MOVE QUESTIONS {selectedQuestionIds.length > 0 ? `(${selectedQuestionIds.length} SELECTED)` : 'SET'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleLoadSeedQuestions}
              disabled={actionLoading}
              className="py-1.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-indigo-200 text-indigo-700 font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              title="Ensure all 3 sets (A, B, C) across all rounds are fully restored and available"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>RESTORE 3 SETS (A, B, C)</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK NOTICE BANNER */}
        {feedbackNotice && (
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-[#0891B2] font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0891B2] shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        )}
      </div>

      {/* 2. QUESTION BANK BROWSER & CRUD ACTION TOOLBAR */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
              QUESTION REPOSITORY & REBUS EDITOR
            </h3>
            <p className="text-xs text-[#64748B]">
              Total {questions.length} questions banked across 3 rounds and sets (A, B, C). Edit, delete, add, or upload sets at any time.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={openAddModal}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              ADD QUESTION
            </button>

            <button
              onClick={() => {
                setUploadError(null);
                setBulkImportMode('SINGLE_SET');
                setShowUploadModal(true);
              }}
              className="py-2 px-3.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              title="Bulk import questions JSON or bulk update clue images by filename"
            >
              <Upload className="w-4 h-4" />
              BULK IMPORT & IMAGES
            </button>

            {selectedQuestionIds.length > 0 && (
              <button
                onClick={() => setShowDeleteSelectedModal(true)}
                className="py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer animate-pulse"
                title={`Delete ${selectedQuestionIds.length} currently selected questions with verification`}
              >
                <Trash2 className="w-4 h-4" />
                <span>DELETE SELECTED ({selectedQuestionIds.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                setDeleteSetConfirmationInput('');
                setShowDeleteSetModal(true);
              }}
              className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs font-mono flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Delete an entire round/set with strict verification"
            >
              <Layers className="w-3.5 h-3.5 text-rose-600" />
              <span>DELETE SET...</span>
            </button>

            <button
              onClick={() => {
                setDeleteAllConfirmationInput('');
                setShowDeleteAllModal(true);
              }}
              className="py-2 px-3 rounded-xl bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 font-bold text-xs font-mono flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Purge all questions from question bank with strict confirmation phrase"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>DELETE ALL</span>
            </button>

            <a
              href="/api/admin/offline-kit"
              target="_blank"
              rel="noreferrer"
              className="py-2 px-3.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-xs font-mono text-[#0891B2] flex items-center gap-1.5 transition font-semibold"
            >
              <Download className="w-4 h-4" />
              OFFLINE JSON
            </a>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-[#DCE6F0]">
          {/* Round Filter */}
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-mono text-[#64748B] font-semibold mb-1">
              FILTER BY ROUND:
            </label>
            <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
              {(['ALL', 1, 2, 3] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFilterRound(r)}
                  className={`flex-1 py-1 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                    filterRound === r
                      ? 'bg-[#06B6D4] text-white font-bold'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {r === 'ALL' ? 'All' : `R${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Set Filter */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-mono text-[#64748B] font-semibold mb-1">
              FILTER BY SET:
            </label>
            <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
              {(['ALL', 'A', 'B', 'C'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterSet(s)}
                  className={`flex-1 py-1 text-center rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                    filterSet === s
                      ? 'bg-[#7C3AED] text-white font-bold'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  {s === 'ALL' ? 'All' : `Set ${s}`}
                </button>
              ))}
            </div>
          </div>

          {/* Search Query */}
          <div className="sm:col-span-5">
            <label className="block text-[10px] font-mono text-[#64748B] font-semibold mb-1">
              SEARCH QUESTIONS:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by answer, domain, #, or formula..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs font-mono text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#06B6D4]"
              />
            </div>
          </div>
        </div>

        {/* Filter Results Info Banner */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-xl border border-[#DCE6F0]">
          <span>
            Showing <strong className="text-[#0891B2]">{filteredQuestions.length}</strong> of {questions.length} questions
          </span>
          <span>
            {filterRound !== 'ALL' && <span className="mr-2">Round {filterRound}</span>}
            {filterSet !== 'ALL' && <span>Set {filterSet}</span>}
          </span>
        </div>

        {/* Question Cards & Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DCE6F0] text-[#64748B] font-mono">
                <th className="pb-3 px-2 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredQuestions.length > 0 && selectedQuestionIds.length === filteredQuestions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedQuestionIds(filteredQuestions.map(q => q.id));
                      } else {
                        setSelectedQuestionIds([]);
                      }
                    }}
                    className="rounded bg-white border-[#CBD5E1] text-[#06B6D4] focus:ring-0 cursor-pointer"
                    title="Select all filtered questions"
                  />
                </th>
                <th className="pb-3 px-3">Q#</th>
                <th className="pb-3 px-3">ROUND / SET</th>
                <th className="pb-3 px-3">DOMAIN</th>
                <th className="pb-3 px-3">VECTOR PANELS</th>
                <th className="pb-3 px-3">REALISTIC IMAGES</th>
                <th className="pb-3 px-3">AUTHORITATIVE ANSWER</th>
                <th className="pb-3 px-3">ALIASES</th>
                <th className="pb-3 px-3 text-center">PTS</th>
                <th className="pb-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredQuestions.map((q) => {
                const isRoundActiveSet = (activeQuestionSet?.[q.round] || 'A') === (q.set || 'A');
                const isSelected = selectedQuestionIds.includes(q.id);
                const questionImages = q.images && q.images.length > 0 ? q.images : q.customImageUrl ? [q.customImageUrl] : [];

                return (
                  <tr 
                    key={q.id} 
                    className={`transition-colors ${
                      isSelected ? 'bg-cyan-50/60' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds(prev => [...prev, q.id]);
                          } else {
                            setSelectedQuestionIds(prev => prev.filter(id => id !== q.id));
                          }
                        }}
                        className="rounded bg-white border-[#CBD5E1] text-[#06B6D4] focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Q Number */}
                    <td className="py-3 px-3 font-mono font-bold text-[#0891B2]">
                      #{q.questionNumber}
                    </td>

                    {/* Round & Set */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#172033] font-semibold">
                          R{q.round}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-[#7C3AED] border border-purple-200">
                          Set {q.set || 'A'}
                        </span>
                        {isRoundActiveSet && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="This set is currently attending the live round">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Domain */}
                    <td className="py-3 px-3 text-[#172033] font-medium">
                      <div>{q.domain}</div>
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {q.difficulty}
                      </span>
                    </td>

                    {/* Vector Clue Panels */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {q.cluePanels.map((p, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#DCE6F0] flex items-center justify-center p-1 shadow-sm"
                            title={`Panel ${p.panelNumber || idx + 1}`}
                          >
                            <PanelVectorArt type={p.svgType} large={false} />
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Realistic Images */}
                    <td className="py-3 px-3">
                      {questionImages.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetQuestionForImage(q);
                            setImageUrl1ToAttach(questionImages[0] || '');
                            setImageUrl2ToAttach(questionImages[1] || '');
                            setImageUrl3ToAttach(questionImages[2] || '');
                            setShowAttachImageModal(true);
                          }}
                          className="flex items-center gap-2 group text-left cursor-pointer"
                          title="Click to edit connected realistic images"
                        >
                          <div className="flex items-center gap-1">
                            {questionImages.slice(0, 3).map((imgUrl, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span className="text-[10px] font-bold text-[#0891B2] select-none">+</span>}
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#DCE6F0] bg-white shrink-0 shadow-sm">
                                  <img
                                    src={imgUrl}
                                    alt={`Clue ${i + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                          <span className="text-[10px] font-mono text-[#0891B2] underline group-hover:text-[#06B6D4] whitespace-nowrap">
                            {questionImages.length} Real {questionImages.length === 1 ? 'Clue' : 'Clues'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetQuestionForImage(q);
                            setImageUrl1ToAttach('');
                            setImageUrl2ToAttach('');
                            setImageUrl3ToAttach('');
                            setShowAttachImageModal(true);
                          }}
                          className="text-[10px] font-mono text-[#64748B] hover:text-[#0891B2] py-1 px-2 rounded-lg bg-[#F8FAFC] border border-[#DCE6F0] hover:border-[#06B6D4] transition flex items-center gap-1 cursor-pointer"
                        >
                          <Image className="w-3 h-3" />
                          <span>+ Attach Images</span>
                        </button>
                      )}
                    </td>

                    {/* Correct Answer */}
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700 text-sm">
                      {q.correctAnswer}
                    </td>

                    {/* Aliases */}
                    <td className="py-3 px-3 font-mono text-[#64748B] max-w-[150px] truncate" title={q.aliases.join(', ')}>
                      {q.aliases.join(', ') || '—'}
                    </td>

                    {/* Points */}
                    <td className="py-3 px-3 font-mono font-bold text-center text-[#0891B2]">
                      +{q.points}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setTargetQuestionForImage(q);
                            const qImgs = (q.images && q.images.length > 0) ? q.images : (q.customImageUrl ? [q.customImageUrl] : []);
                            setImageUrl1ToAttach(qImgs[0] || '');
                            setImageUrl2ToAttach(qImgs[1] || '');
                            setImageUrl3ToAttach(qImgs[2] || '');
                            setShowAttachImageModal(true);
                          }}
                          className={`px-2 py-1 rounded-lg transition font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs ${
                            (q.images && q.images.length > 0) || q.customImageUrl
                              ? 'bg-purple-100 hover:bg-purple-200 text-[#7C3AED] border border-purple-300'
                              : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#7C3AED] border border-[#DCE6F0]'
                          }`}
                          title="Click to Edit / Paste Clue Images for this Question"
                        >
                          <Image className="w-3.5 h-3.5" />
                          <span>Images</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedQuestionIds([q.id]);
                            setMoveMode('selected');
                            setMoveTargetRound(q.round);
                            setMoveTargetSet(q.set === 'A' ? 'B' : 'A');
                            setShowMoveModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-amber-600 transition border border-[#DCE6F0] cursor-pointer"
                          title="Move Question to another Set / Round"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(q)}
                          className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#172033] hover:text-[#0891B2] transition border border-[#DCE6F0] cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setQuestionToDelete(q)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition border border-rose-200 cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==========================================
          MODAL: ADD / EDIT QUESTION
          ========================================== */}
      {(showAddModal || editingQuestion) && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-[#DCE6F0] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#0891B2]">
                  {editingQuestion ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    {editingQuestion ? 'EDIT QUESTION' : 'ADD NEW QUESTION'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Define rebus visual formula, answer validation, and clue vector graphics.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingQuestion(null);
                }}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Row 1: Round, Set, Question Number, Points */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">ROUND</label>
                  <select
                    value={formData.round}
                    onChange={(e) => {
                      const r = Number(e.target.value) as RoundNumber;
                      setFormData({
                        ...formData,
                        round: r,
                        points: r === 1 ? 1 : r === 2 ? 2 : 3,
                        difficulty: r === 1 ? 'Medium' : r === 2 ? 'Hard' : 'Very Hard',
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                  >
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                    <option value={3}>Round 3</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">SET</label>
                  <select
                    value={formData.set}
                    onChange={(e) => setFormData({ ...formData, set: e.target.value as QuestionSet })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">QUESTION #</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.questionNumber}
                    onChange={(e) => setFormData({ ...formData, questionNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">POINTS</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Domain, Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">DOMAIN / TOPIC</label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="e.g. Operating Systems, Networks, DBMS..."
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">DIFFICULTY</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                  >
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Very Hard">Very Hard</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Correct Answer & Aliases */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">
                    AUTHORITATIVE CORRECT ANSWER *
                  </label>
                  <input
                    type="text"
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    placeholder="e.g. Deadlock"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-emerald-300 rounded-xl text-emerald-800 font-mono font-bold focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block font-mono text-[#64748B] mb-1 font-semibold">
                    ACCEPTED SYNONYMS / ALIASES (COMMA SEPARATED)
                  </label>
                  <input
                    type="text"
                    value={formData.aliases}
                    onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                    placeholder="e.g. circular wait, mutual exclusion"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              {/* Row 4: Rebus Formula Text */}
              <div>
                <label className="block font-mono text-[#64748B] mb-1 font-semibold">
                  REBUS SYNTHESIS FORMULA TEXT
                </label>
                <input
                  type="text"
                  value={formData.rebusFormulaText}
                  onChange={(e) => setFormData({ ...formData, rebusFormulaText: e.target.value })}
                  placeholder="e.g. Panel 1 (Process) + Panel 2 (Circular Wait)"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-amber-700 font-mono focus:border-amber-500 font-medium"
                  required
                />
              </div>

              {/* Clue Panel 1 */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between font-mono text-xs font-bold text-[#0891B2]">
                  <span>CLUE PANEL 1</span>
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE6F0] flex items-center justify-center shadow-sm">
                    <PanelVectorArt type={formData.panel1Svg} large={false} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] text-[#64748B] mb-1 font-semibold">PANEL 1 SVG DIAGRAM</label>
                    <select
                      value={formData.panel1Svg}
                      onChange={(e) => setFormData({ ...formData, panel1Svg: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono text-xs"
                    >
                      {SVG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] text-[#64748B] mb-1 font-semibold">PANEL 1 CLUE DESCRIPTION</label>
                    <input
                      type="text"
                      value={formData.panel1Desc}
                      onChange={(e) => setFormData({ ...formData, panel1Desc: e.target.value })}
                      placeholder="e.g. 4-way intersection grid deadlock"
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Clue Panel 2 */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between font-mono text-xs font-bold text-[#0891B2]">
                  <span>CLUE PANEL 2</span>
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE6F0] flex items-center justify-center shadow-sm">
                    <PanelVectorArt type={formData.panel2Svg} large={false} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] text-[#64748B] mb-1 font-semibold">PANEL 2 SVG DIAGRAM</label>
                    <select
                      value={formData.panel2Svg}
                      onChange={(e) => setFormData({ ...formData, panel2Svg: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono text-xs"
                    >
                      {SVG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] text-[#64748B] mb-1 font-semibold">PANEL 2 CLUE DESCRIPTION</label>
                    <input
                      type="text"
                      value={formData.panel2Desc}
                      onChange={(e) => setFormData({ ...formData, panel2Desc: e.target.value })}
                      placeholder="e.g. Interlocking padlock and key"
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Realistic / Real-World Question Clue Image & Local File Upload */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl space-y-3">
                <div className="flex items-center justify-between font-mono text-xs font-bold text-[#7C3AED]">
                  <span className="flex items-center gap-1.5">
                    <Image className="w-4 h-4" />
                    QUESTION CLUE IMAGE / ATTACHMENT (LOCAL FILE UPLOAD OR URL)
                  </span>
                  {formData.customImageUrl && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      ✓ Image Attached
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Local File Upload, Clipboard Paste & Drag Area */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => pasteFromClipboardApi((dataUrl) => {
                        setImageUploadInfo({ name: 'Pasted from Clipboard', size: 'Embedded' });
                        setFormData((prev) => ({ ...prev, customImageUrl: dataUrl }));
                      })}
                      className="py-2.5 px-3 rounded-xl bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-800 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      title="Paste image directly from clipboard (Ctrl+V / Cmd+V, screenshot, or copied image)"
                    >
                      <Copy className="w-4 h-4 text-purple-700" />
                      <span>📋 PASTE IMAGE (CLIPBOARD / CTRL+V)</span>
                    </button>

                    <label className="flex-1 border-2 border-dashed border-purple-200 hover:border-[#7C3AED] bg-purple-50/50 hover:bg-purple-50 rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition text-xs font-mono text-[#7C3AED] font-semibold text-center">
                      <UploadCloud className="w-4 h-4" />
                      <span>{imageUploadInfo ? `Change File (${imageUploadInfo.name})` : 'Choose Local File (PNG, JPG, WEBP)...'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Drop / Paste Box */}
                  <div
                    tabIndex={0}
                    onPaste={(e) => handleClipboardPasteForSlot(e, (dataUrl) => {
                      setImageUploadInfo({ name: 'Pasted from Clipboard', size: 'Embedded' });
                      setFormData((prev) => ({ ...prev, customImageUrl: dataUrl }));
                    })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processImageFileOrBlob(file, (dataUrl, name) => {
                          setImageUploadInfo({ name: name || 'Dropped File', size: `${(file.size / 1024).toFixed(1)} KB` });
                          setFormData((prev) => ({ ...prev, customImageUrl: dataUrl }));
                        });
                      }
                    }}
                    className="p-3 border border-purple-200 border-dashed rounded-xl bg-white text-center focus:border-purple-600 focus:ring-1 focus:ring-purple-400 outline-none cursor-pointer"
                  >
                    <div className="text-[11px] font-mono text-purple-900 font-semibold flex items-center justify-center gap-1.5">
                      <span>💡 Focus here & press <strong className="text-[#7C3AED] underline">Ctrl+V / Cmd+V</strong> to paste copied image or screenshot</span>
                    </div>
                  </div>

                  {/* Or Direct URL Input */}
                  <div>
                    <label className="block font-mono text-[11px] text-[#64748B] mb-1 font-semibold">
                      OR PASTE DIRECT WEB IMAGE URL:
                    </label>
                    <input
                      type="url"
                      value={formData.customImageUrl?.startsWith('data:') ? '' : formData.customImageUrl}
                      onChange={(e) => {
                        setImageUploadInfo(null);
                        setFormData({ ...formData, customImageUrl: e.target.value });
                      }}
                      placeholder={formData.customImageUrl?.startsWith('data:') ? 'Local file uploaded (base64). Enter URL here to override...' : 'https://images.unsplash.com/... or direct image link'}
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#7C3AED] font-mono text-xs focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>

                  {/* Preview Card */}
                  {formData.customImageUrl && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-purple-200 shadow-sm">
                      <div className="w-20 h-16 rounded-lg overflow-hidden border border-purple-300 bg-[#F1F5F9] shrink-0 relative">
                        <img
                          src={formData.customImageUrl}
                          alt="Question clue preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '0.3';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#172033] font-mono truncate">
                          {imageUploadInfo?.name || (formData.customImageUrl.startsWith('data:') ? 'Local Image File' : 'External Web Image')}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono">
                          {imageUploadInfo ? `Size: ${imageUploadInfo.size} • Base64 Embedded` : 'Live anti-screenshot watermark applied in student arena.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, customImageUrl: '' });
                          setImageUploadInfo(null);
                        }}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-mono cursor-pointer transition font-semibold shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Quick Tech Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-mono text-[#64748B] font-semibold">TECH PRESETS:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUploadInfo(null);
                        setFormData({ ...formData, customImageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80' });
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[10px] font-mono text-[#172033] cursor-pointer"
                    >
                      Datacenter Rack
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUploadInfo(null);
                        setFormData({ ...formData, customImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80' });
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[10px] font-mono text-[#172033] cursor-pointer"
                    >
                      Microchip PCB
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUploadInfo(null);
                        setFormData({ ...formData, customImageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80' });
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[10px] font-mono text-[#172033] cursor-pointer"
                    >
                      Fiber Cable
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUploadInfo(null);
                        setFormData({ ...formData, customImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80' });
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[10px] font-mono text-[#172033] cursor-pointer"
                    >
                      Cyber Matrix
                    </button>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-mono text-[#64748B] mb-1 font-semibold">
                  TECHNICAL EXPLANATION / RATIONALE (FOR EVALUATOR KEY)
                </label>
                <textarea
                  rows={2}
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  placeholder="Explain why this answer represents the synthesis of the clues..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033] font-mono text-xs focus:border-[#06B6D4]"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-q-active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded bg-white border-[#CBD5E1] text-[#06B6D4] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="chk-q-active" className="text-[#172033] font-mono cursor-pointer font-medium">
                  Question Active in Competition Pool
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#DCE6F0]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingQuestion(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-cyan-500/10 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? 'SAVING...' : editingQuestion ? 'SAVE MODIFICATIONS' : 'CREATE QUESTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: BULK UPLOAD QUESTIONS / ALL ROUNDS & SETS / BULK IMAGE MATCHER
          ========================================== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white border border-purple-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                  {bulkImportMode === 'BULK_IMAGES' ? <Image className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    {bulkImportMode === 'IMAGE_JSON'
                      ? 'UPLOAD IMAGE JSON FILE (CHANGES ONLY IMAGES)'
                      : bulkImportMode === 'BULK_IMAGES' 
                      ? 'BULK IMAGE MATCHER & REPLACEMENT ENGINE' 
                      : 'BULK QUESTION IMPORT & SCHEMA VALIDATOR'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    {bulkImportMode === 'IMAGE_JSON'
                      ? 'Upload an Image JSON file to change ONLY the images in the current question bank without altering questions or answers.'
                      : bulkImportMode === 'BULK_IMAGES'
                      ? 'Upload images named like R1_Q1_P1.jpg, R1_SetA_Q1_P1.png, or q1-a-01_p1.jpg to automatically match and replace question clues.'
                      : 'Import questions for all rounds and sets simultaneously or target a specific question set.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setValidationResult(null);
                  setUploadError(null);
                }}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Import Mode Selector: 3 Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setBulkImportMode('SINGLE_SET');
                    setValidationResult(null);
                  }}
                  className={`py-2 px-2 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    bulkImportMode === 'SINGLE_SET'
                      ? 'bg-[#0891B2] text-white shadow-sm'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>🎯 SINGLE SET TARGET</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkImportMode('IMAGE_JSON');
                    setValidationResult(null);
                  }}
                  className={`py-2 px-2 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    bulkImportMode === 'IMAGE_JSON'
                      ? 'bg-purple-600 text-white shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>📄 UPLOAD IMAGE JSON FILE</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkImportMode('BULK_IMAGES');
                    setValidationResult(null);
                  }}
                  className={`py-2 px-2 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    bulkImportMode === 'BULK_IMAGES'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>🖼️ MATCH IMAGES (BY NAME)</span>
                </button>
              </div>

              {/* TAB 3: BULK IMAGE MATCHER & REPLACER */}
              {bulkImportMode === 'BULK_IMAGES' && (
                <div className="space-y-4">
                  {/* Filename Syntax Guide */}
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        AUTOMATIC FILENAME RECOGNITION PATTERNS:
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-bold">
                        Supports JPG, PNG, WEBP, GIF, SVG
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-emerald-900">
                      <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                        <span className="font-bold text-emerald-800">1. Standard Round & Panel:</span>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          • <code className="font-bold">R1_Q1_P1.jpg</code> (Round 1, Q1, Clue 1)<br/>
                          • <code className="font-bold">R1_Q1_P2.png</code> (Round 1, Q1, Clue 2)<br/>
                          • <code className="font-bold">R1_Q25_1.webp</code>
                        </div>
                      </div>

                      <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                        <span className="font-bold text-emerald-800">2. Specific Question Set:</span>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          • <code className="font-bold">R1_SetA_Q1_P1.jpg</code><br/>
                          • <code className="font-bold">R2_B_Q10_P2.png</code><br/>
                          • <code className="font-bold">R3_C_Q5_P1.jpeg</code>
                        </div>
                      </div>

                      <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                        <span className="font-bold text-emerald-800">3. Direct Question ID:</span>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          • <code className="font-bold">q1-a-01_p1.jpg</code><br/>
                          • <code className="font-bold">q005_p2.png</code><br/>
                          • <code className="font-bold">Q15_P1.jpg</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drag and Drop & Multi-File Upload Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsBulkImageDragging(true);
                    }}
                    onDragLeave={() => setIsBulkImageDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsBulkImageDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleProcessBulkImageFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      isBulkImageDragging
                        ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100'
                        : 'border-[#CBD5E1] hover:border-emerald-500 bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="max-w-md mx-auto space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                        {isProcessingImages ? <RefreshCw className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-[#172033] font-tech tracking-wide">
                          DRAG & DROP IMAGE FILES HERE OR BROWSE
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                          Select multiple image files at once to update the entire competition bank simultaneously.
                        </p>
                      </div>

                      <div>
                        <label className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-tech font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95 transition">
                          <Plus className="w-4 h-4" />
                          <span>CHOOSE MULTIPLE IMAGES</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleProcessBulkImageFiles(e.target.files);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Matched Summary Bar & Filters */}
                  {parsedBulkImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl font-mono text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-[#172033]">
                            Total Uploaded: <strong className="text-emerald-700">{parsedBulkImages.length}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            ✅ Matched: {parsedBulkImages.filter(i => i.status === 'MATCHED').length}
                          </span>
                          {parsedBulkImages.some(i => i.status === 'UNMATCHED') && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-300">
                              ⚠️ Unmatched: {parsedBulkImages.filter(i => i.status === 'UNMATCHED').length}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex rounded-lg bg-white p-0.5 border border-[#DCE6F0]">
                            {(['ALL', 'MATCHED', 'UNMATCHED'] as const).map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setBulkImageStatusFilter(st)}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                                  bulkImageStatusFilter === st
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-[#64748B] hover:text-[#172033]'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setParsedBulkImages([])}
                            className="px-2.5 py-1 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* Filter Search Input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={bulkImageSearchFilter}
                          onChange={(e) => setBulkImageSearchFilter(e.target.value)}
                          placeholder="Search uploaded files by name or matched answer..."
                          className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs font-mono text-[#172033] focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Image Matching Grid / Table */}
                      <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#DCE6F0] bg-white divide-y divide-[#E2E8F0]">
                        {parsedBulkImages
                          .filter(item => {
                            if (bulkImageStatusFilter !== 'ALL' && item.status !== bulkImageStatusFilter) return false;
                            if (bulkImageSearchFilter.trim()) {
                              const s = bulkImageSearchFilter.toLowerCase();
                              const matchName = item.filename.toLowerCase().includes(s);
                              const matchAnswer = item.matchedQuestion?.correctAnswer?.toLowerCase().includes(s);
                              const matchTopic = item.matchedQuestion?.domain?.toLowerCase().includes(s);
                              return matchName || matchAnswer || matchTopic;
                            }
                            return true;
                          })
                          .map((item, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] transition">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-14 h-12 rounded-lg overflow-hidden border border-[#DCE6F0] bg-slate-100 shrink-0 shadow-xs">
                                  <img
                                    src={item.dataUrl}
                                    alt={item.filename}
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-xs text-[#172033] truncate max-w-[200px]" title={item.filename}>
                                      {item.filename}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-50 text-[#7C3AED] border border-purple-200">
                                      Panel {item.panelIndex + 1}
                                    </span>
                                    {item.round && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-50 text-[#0891B2] border border-cyan-200">
                                        R{item.round}{item.set ? ` Set ${item.set}` : ''} Q#{item.questionNumber}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] font-mono mt-0.5">
                                    {item.matchedQuestion ? (
                                      <span className="text-emerald-700 font-semibold">
                                        Target: <strong>{item.matchedQuestion.correctAnswer}</strong> ({item.matchedQuestion.domain})
                                      </span>
                                    ) : (
                                      <span className="text-rose-600">
                                        ⚠️ No question matching this filename pattern found in question bank.
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  item.status === 'MATCHED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {item.status === 'MATCHED' ? '✓ MATCHED' : 'UNMATCHED'}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setParsedBulkImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-[#94A3B8] hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove from batch"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Bulk Images Submit Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE6F0]">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || parsedBulkImages.filter(i => i.status === 'MATCHED').length === 0}
                      onClick={handleApplyBulkImageUpdates}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {actionLoading ? (
                        'UPDATING IMAGES...'
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            APPLY REPLACEMENTS ({parsedBulkImages.filter(i => i.status === 'MATCHED').length} IMAGES)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: UPLOAD IMAGE JSON FILE (CHANGES ONLY IMAGES IN CURRENT QUESTION BANK) */}
              {bulkImportMode === 'IMAGE_JSON' && (
                <div className="space-y-4">
                  {/* Instructions Banner */}
                  <div className="p-3.5 bg-purple-50/80 border border-purple-300 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        SAFE IMAGE REPLACEMENT ENGINE (DATABASE PERSISTENT)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900 font-bold">
                        Only modifies images
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-900 leading-relaxed font-mono">
                      Uploading an Image JSON file updates <strong>only the images</strong> for matching questions in the current question bank. All question text, authoritative answers, aliases, domains, formulas, and point values remain 100% untouched and are automatically saved to disk and Google Cloud Firestore.
                    </p>
                  </div>

                  {/* Actions & File Upload */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs flex items-center gap-1.5 transition font-semibold cursor-pointer shadow-xs">
                        <UploadCloud className="w-4 h-4" />
                        <span>CHOOSE IMAGE JSON FILE</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                handleProcessImageJson((evt.target?.result as string) || '');
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={loadSampleImageJson}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 text-[#7C3AED] hover:bg-purple-100 border border-purple-200 font-mono text-xs flex items-center gap-1.5 transition font-semibold cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Load Sample Image JSON</span>
                      </button>
                    </div>

                    {parsedImageJsonUpdates.length > 0 && (
                      <span className="text-xs font-mono font-bold text-purple-900">
                        {parsedImageJsonUpdates.filter(i => i.status === 'MATCHED').length} Matched / {parsedImageJsonUpdates.length} Total Entries
                      </span>
                    )}
                  </div>

                  {/* JSON Input Text Area */}
                  <div>
                    <label className="block text-[11px] font-mono text-[#64748B] mb-1 font-semibold">
                      PASTE OR EDIT IMAGE JSON TEXT:
                    </label>
                    <textarea
                      rows={6}
                      value={imageJsonText}
                      onChange={(e) => handleProcessImageJson(e.target.value)}
                      placeholder={'[\n  {\n    "id": "q1-a-01",\n    "images": [\n      "https://example.com/clue1.jpg",\n      "https://example.com/clue2.jpg"\n    ]\n  }\n]'}
                      className="w-full p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl font-mono text-xs text-[#172033] focus:outline-none focus:border-purple-600 leading-relaxed"
                    />
                  </div>

                  {/* Matched Summary Bar & Filters */}
                  {parsedImageJsonUpdates.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl font-mono text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-[#172033]">
                            Total in JSON: <strong className="text-purple-700">{parsedImageJsonUpdates.length}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            ✅ Matched: {parsedImageJsonUpdates.filter(i => i.status === 'MATCHED').length}
                          </span>
                          {parsedImageJsonUpdates.some(i => i.status === 'UNMATCHED') && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-300">
                              ⚠️ Unmatched: {parsedImageJsonUpdates.filter(i => i.status === 'UNMATCHED').length}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex rounded-lg bg-white p-0.5 border border-[#DCE6F0]">
                            {(['ALL', 'MATCHED', 'UNMATCHED'] as const).map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setImageJsonFilter(st)}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                                  imageJsonFilter === st
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
                            onClick={() => {
                              setParsedImageJsonUpdates([]);
                              setImageJsonText('');
                            }}
                            className="px-2.5 py-1 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Filter Search Input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={imageJsonSearch}
                          onChange={(e) => setImageJsonSearch(e.target.value)}
                          placeholder="Filter matched questions by answer or question ID..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#DCE6F0] bg-white text-xs font-mono text-[#172033] focus:border-purple-600"
                        />
                      </div>

                      {/* Matched Items Scrollable List */}
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {parsedImageJsonUpdates
                          .filter(item => {
                            if (imageJsonFilter === 'MATCHED' && item.status !== 'MATCHED') return false;
                            if (imageJsonFilter === 'UNMATCHED' && item.status !== 'UNMATCHED') return false;
                            if (imageJsonSearch.trim()) {
                              const s = imageJsonSearch.toLowerCase();
                              const matchId = item.questionId.toLowerCase().includes(s);
                              const matchAns = item.matchedQuestion?.correctAnswer.toLowerCase().includes(s);
                              if (!matchId && !matchAns) return false;
                            }
                            return true;
                          })
                          .map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono ${
                                item.status === 'MATCHED'
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : 'bg-rose-50/50 border-rose-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex items-center gap-1 shrink-0">
                                  {item.images.slice(0, 3).map((imgUrl, imgI) => (
                                    <div key={imgI} className="w-10 h-10 rounded-lg overflow-hidden border border-[#DCE6F0] bg-white shrink-0 shadow-2xs">
                                      <img
                                        src={imgUrl}
                                        alt={`Clue ${imgI + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[#172033]">
                                      {item.matchedQuestion 
                                        ? `Q#${item.matchedQuestion.questionNumber} (R${item.matchedQuestion.round} Set ${item.matchedQuestion.set || 'A'})` 
                                        : item.questionId}
                                    </span>
                                    <span className="text-[10px] text-[#0891B2] font-semibold">
                                      {item.images.length} Image{item.images.length > 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  <div className="text-[11px] font-mono mt-0.5">
                                    {item.matchedQuestion ? (
                                      <span className="text-emerald-700 font-semibold">
                                        Target: <strong>{item.matchedQuestion.correctAnswer}</strong> ({item.matchedQuestion.domain})
                                      </span>
                                    ) : (
                                      <span className="text-rose-600">
                                        ⚠️ {item.reason || 'No matching question in question bank.'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  item.status === 'MATCHED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {item.status === 'MATCHED' ? '✓ READY' : 'UNMATCHED'}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Submit Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE6F0]">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || parsedImageJsonUpdates.filter(i => i.status === 'MATCHED').length === 0}
                      onClick={handleApplyImageJsonUpdates}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-purple-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {actionLoading ? (
                        'UPDATING IMAGES...'
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            APPLY IMAGE UPDATES ({parsedImageJsonUpdates.filter(i => i.status === 'MATCHED').length} QUESTIONS)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 1: JSON QUESTION IMPORT (SINGLE SET) */}
              {bulkImportMode === 'SINGLE_SET' && (
                <>
                  {/* Destination Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl">
                    <div>
                      <label className="block font-mono text-[#64748B] mb-1 font-semibold">TARGET ROUND</label>
                      <select
                        value={uploadRound}
                        onChange={(e) => setUploadRound(Number(e.target.value) as RoundNumber)}
                        className="w-full px-3 py-1.5 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                      >
                        <option value={1}>Round 1</option>
                        <option value={2}>Round 2</option>
                        <option value={3}>Round 3</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[#64748B] mb-1 font-semibold">TARGET SET</label>
                      <select
                        value={uploadSet}
                        onChange={(e) => setUploadSet(e.target.value as QuestionSet)}
                        className="w-full px-3 py-1.5 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                      >
                        <option value="A">Set A</option>
                        <option value="B">Set B</option>
                        <option value="C">Set C</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[#64748B] mb-1 font-semibold">UPLOAD MODE</label>
                      <select
                        value={uploadMode}
                        onChange={(e) => setUploadMode(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] font-mono focus:border-[#06B6D4]"
                      >
                        <option value="append">Append / Add to existing questions (Safe)</option>
                        <option value="replace">Replace questions in this set</option>
                      </select>
                    </div>
                  </div>

                  {/* Template Loader, File upload & Validate action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#DCE6F0] text-[#172033] font-mono text-xs flex items-center gap-1.5 transition font-semibold cursor-pointer">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#0891B2]" />
                        <span>Upload JSON File</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                setUploadJsonText((evt.target?.result as string) || '');
                                setValidationResult(null);
                                setUploadError(null);
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={loadSampleTemplate}
                        className="px-3 py-1 rounded-xl bg-purple-50 text-[#7C3AED] hover:bg-purple-100 border border-purple-200 font-mono text-xs flex items-center gap-1.5 transition font-semibold cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Load Single Set Template</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isValidating || !uploadJsonText.trim()}
                      onClick={handleValidateJsonSchema}
                      className="px-3.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs flex items-center gap-1.5 font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>{isValidating ? 'Validating Schema...' : 'Validate JSON Schema'}</span>
                    </button>
                  </div>

                  {/* JSON Text Area */}
                  <textarea
                    rows={9}
                    value={uploadJsonText}
                    onChange={(e) => {
                      setUploadJsonText(e.target.value);
                      setValidationResult(null);
                      setUploadError(null);
                    }}
                    placeholder={'[\n  { "questionNumber": 1, "domain": "OS", "correctAnswer": "Deadlock", "points": 1 }\n]'}
                    className="w-full p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl font-mono text-xs text-[#172033] focus:outline-none focus:border-[#7C3AED] leading-relaxed"
                  />

                  {/* Validation Result Box */}
                  {validationResult && (
                    <div
                      className={`p-3.5 rounded-2xl border ${
                        validationResult.valid
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                          : 'bg-rose-50/70 border-rose-300 text-rose-900'
                      } space-y-2.5`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono font-bold text-xs">
                          {validationResult.valid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                          )}
                          <span>
                            {validationResult.valid
                              ? `✓ JSON SCHEMA VALIDATION PASSED (${validationResult.totalQuestions} Questions Ready)`
                              : `⚠ SCHEMA ERRORS DETECTED (${validationResult.invalidCount} Invalid / ${validationResult.totalQuestions} Total)`}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono font-semibold">
                          Valid: <strong className="text-emerald-700">{validationResult.validCount}</strong> | Invalid: <strong className="text-rose-700">{validationResult.invalidCount}</strong>
                        </div>
                      </div>

                      {validationResult.matrix && (
                        <div className="pt-2 border-t border-emerald-200 text-[11px] font-mono flex items-center gap-4 flex-wrap">
                          <span className="font-bold text-[#172033]">Matrix Distribution:</span>
                          {Object.entries(validationResult.matrix).map(([rKey, sets]: any) => (
                            <span key={rKey} className="bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-200">
                              <strong>{rKey.toUpperCase()}:</strong> {Object.entries(sets).map(([sKey, cnt]) => `${sKey}:${cnt}`).join(', ')}
                            </span>
                          ))}
                        </div>
                      )}

                      {validationResult.errors && validationResult.errors.length > 0 && (
                        <div className="pt-2 border-t border-rose-200 space-y-1">
                          <div className="font-bold text-[11px] font-mono text-rose-800">Validation Diagnostics:</div>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {validationResult.errors.slice(0, 5).map((err, idx) => (
                              <div key={idx} className="text-[11px] font-mono text-rose-700">
                                • Item #{err.index + 1} {err.questionNumber ? `(Q#${err.questionNumber})` : ''}: {err.field ? `[${err.field}] ` : ''}{err.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-mono flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#DCE6F0]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadModal(false);
                        setValidationResult(null);
                        setUploadError(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || !uploadJsonText.trim()}
                      onClick={handleUploadSubmit}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-purple-600/10 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {actionLoading ? (
                        'PROCESSING...'
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          <span>{bulkImportMode === 'ALL_ROUNDS' ? 'IMPORT ALL ROUNDS & SETS' : 'IMPORT QUESTION SET'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: DELETE ALL QUESTIONS (WITH VERIFICATION)
          ========================================== */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-rose-300 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    PURGE ALL QUESTIONS IN BANK
                  </h3>
                  <p className="text-[11px] text-rose-600 font-mono font-semibold">
                    Destructive Action • Irreversible Bank Clear
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2 text-rose-950 font-mono">
              <div className="font-bold">
                ⚠️ You are about to permanently delete all {questions.length} questions across Round 1, Round 2, and Round 3 (Sets A, B, C).
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                This will wipe out all questions, aliases, clue panels, and associated images from the competition repository.
              </p>
            </div>

            <form onSubmit={handleDeleteAllSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[#172033] font-bold mb-1.5">
                  TO CONFIRM, TYPE <span className="text-rose-700 underline font-extrabold">"DELETE ALL"</span> IN CAPITAL LETTERS:
                </label>
                <input
                  type="text"
                  value={deleteAllConfirmationInput}
                  onChange={(e) => setDeleteAllConfirmationInput(e.target.value)}
                  placeholder='Type "DELETE ALL" to verify...'
                  className="w-full px-3 py-2.5 bg-rose-50/50 border border-rose-300 rounded-xl text-rose-900 font-bold focus:outline-none focus:border-rose-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteAllConfirmationInput.trim().toUpperCase() !== 'DELETE ALL'}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? 'PURGING...' : 'PERMANENTLY DELETE ALL QUESTIONS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: DELETE QUESTION SET (WITH VERIFICATION)
          ========================================== */}
      {showDeleteSetModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-rose-300 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    DELETE COMPETITION QUESTION SET
                  </h3>
                  <p className="text-[11px] text-rose-600 font-mono font-semibold">
                    Purge all questions in a specific Round and Set
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteSetModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeleteSetSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#64748B] mb-1 font-semibold">TARGET ROUND</label>
                  <select
                    value={deleteSetRound}
                    onChange={(e) => setDeleteSetRound(Number(e.target.value) as RoundNumber)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                  >
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                    <option value={3}>Round 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#64748B] mb-1 font-semibold">TARGET SET</label>
                  <select
                    value={deleteSetTarget}
                    onChange={(e) => setDeleteSetTarget(e.target.value as QuestionSet)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>
              </div>

              {/* Set Question Count Info */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 font-mono text-xs">
                <div>
                  Questions currently in Round {deleteSetRound} Set {deleteSetTarget}:{' '}
                  <strong className="text-rose-700 text-sm">
                    {questions.filter(q => q.round === deleteSetRound && (q.set || 'A') === deleteSetTarget).length} Questions
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-[#172033] font-bold mb-1.5">
                  TO CONFIRM, TYPE <span className="text-rose-700 underline font-extrabold">{`"DELETE R${deleteSetRound} SET ${deleteSetTarget}"`}</span>:
                </label>
                <input
                  type="text"
                  value={deleteSetConfirmationInput}
                  onChange={(e) => setDeleteSetConfirmationInput(e.target.value)}
                  placeholder={`DELETE R${deleteSetRound} SET ${deleteSetTarget}`}
                  className="w-full px-3 py-2.5 bg-rose-50/50 border border-rose-300 rounded-xl text-rose-900 font-bold focus:outline-none focus:border-rose-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteSetModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteSetConfirmationInput.trim().toUpperCase() !== `DELETE R${deleteSetRound} SET ${deleteSetTarget}`}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? 'DELETING SET...' : `DELETE ROUND ${deleteSetRound} SET ${deleteSetTarget}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: DELETE SELECTED QUESTIONS (WITH VERIFICATION)
          ========================================== */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-rose-300 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    DELETE SELECTED QUESTIONS
                  </h3>
                  <p className="text-[11px] text-rose-600 font-mono font-semibold">
                    Remove {selectedQuestionIds.length} checked questions from bank
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteSelectedModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to permanently delete these <strong className="text-rose-700">{selectedQuestionIds.length}</strong> selected questions?
            </p>

            {/* Questions preview list */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#DCE6F0] bg-[#F8FAFC] p-2 divide-y divide-[#E2E8F0] text-xs font-mono">
              {questions
                .filter(q => selectedQuestionIds.includes(q.id))
                .slice(0, 10)
                .map(q => (
                  <div key={q.id} className="py-1.5 px-2 flex items-center justify-between">
                    <span className="font-bold text-[#0891B2]">Q#{q.questionNumber} (R{q.round}{q.set || 'A'})</span>
                    <span className="text-emerald-700 font-bold">{q.correctAnswer}</span>
                    <span className="text-[#64748B] text-[10px]">{q.domain}</span>
                  </div>
                ))}
              {selectedQuestionIds.length > 10 && (
                <div className="py-1 text-center text-[10px] text-[#64748B]">
                  ...and {selectedQuestionIds.length - 10} more questions
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteSelectedModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteSelectedSubmit}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? 'DELETING...' : `DELETE ${selectedQuestionIds.length} QUESTIONS`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CONFIRM DELETE QUESTION
          ========================================== */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-rose-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-tech text-base font-bold tracking-wider text-[#172033]">
                CONFIRM QUESTION REMOVAL
              </h3>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to delete Question #{questionToDelete.questionNumber} (Round {questionToDelete.round}, Set {questionToDelete.set || 'A'})?
            </p>

            <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-xs space-y-1 font-mono text-[#64748B]">
              <div>Answer: <strong className="text-emerald-700">{questionToDelete.correctAnswer}</strong></div>
              <div>Domain: {questionToDelete.domain}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? 'REMOVING...' : 'PERMANENTLY DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: SET QUESTION COUNT CONFIGURATION
          ========================================== */}
      {showSetConfigModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-cyan-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#0891B2]">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    CONFIGURE SET QUESTION COUNT
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Define the exact active question quota for a specific competition set.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSetConfigModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSetConfigSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#64748B] mb-1 font-semibold">TARGET ROUND</label>
                  <select
                    value={configRound}
                    onChange={(e) => setConfigRound(Number(e.target.value) as RoundNumber)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                  >
                    <option value={1}>Round 1 (Buzzer)</option>
                    <option value={2}>Round 2 (Rebus Matrix)</option>
                    <option value={3}>Round 3 (Rapid Fire)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1 font-semibold">TARGET SET</label>
                  <select
                    value={configSet}
                    onChange={(e) => setConfigSet(e.target.value as QuestionSet)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] mb-1 font-semibold">
                  MAXIMUM QUESTIONS FOR THIS SET (ACTIVE QUOTA)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={configCount}
                    onChange={(e) => setConfigCount(Number(e.target.value))}
                    className="w-28 px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#0891B2] font-bold text-sm"
                    required
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 15, 20, 25, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setConfigCount(num)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          configCount === num
                            ? 'bg-cyan-50 border-[#06B6D4] text-[#0891B2] font-bold'
                            : 'bg-white border-[#DCE6F0] text-[#64748B] hover:text-[#172033]'
                        }`}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl">
                <label className="block text-[#172033] font-semibold mb-1">EXCESS QUESTIONS POLICY:</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="excessAction"
                    value="limit_active"
                    checked={configAction === 'limit_active'}
                    onChange={() => setConfigAction('limit_active')}
                    className="text-[#06B6D4] bg-white border-[#CBD5E1]"
                  />
                  <span className="text-[#334155]">
                    <strong className="text-[#0891B2]">Limit Active Quota:</strong> Keep excess questions in reserve (deactivate active flag, non-destructive).
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="excessAction"
                    value="truncate"
                    checked={configAction === 'truncate'}
                    onChange={() => setConfigAction('truncate')}
                    className="text-rose-500 bg-white border-[#CBD5E1]"
                  />
                  <span className="text-[#334155]">
                    <strong className="text-rose-600">Truncate Set:</strong> Permanently delete questions beyond the chosen count limit.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSetConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'SAVING...' : 'APPLY SET CONFIGURATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: MERGE QUESTION SETS
          ========================================== */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-purple-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#7C3AED]">
                  <GitMerge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    MERGE QUESTION SETS
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Consolidate questions from one set into another with automatic sequential renumbering.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMergeSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[#64748B] mb-1 font-semibold">TARGET ROUND</label>
                <select
                  value={mergeRound}
                  onChange={(e) => setMergeRound(Number(e.target.value) as RoundNumber)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#172033]"
                >
                  <option value={1}>Round 1</option>
                  <option value={2}>Round 2</option>
                  <option value={3}>Round 3</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl items-center">
                <div>
                  <label className="block text-amber-700 mb-1 font-bold">SOURCE SET (FROM)</label>
                  <select
                    value={mergeSourceSet}
                    onChange={(e) => setMergeSourceSet(e.target.value as QuestionSet)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-amber-800 font-bold"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>

                <div>
                  <label className="block text-emerald-700 mb-1 font-bold">TARGET SET (MERGE INTO)</label>
                  <select
                    value={mergeTargetSet}
                    onChange={(e) => setMergeTargetSet(e.target.value as QuestionSet)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-emerald-800 font-bold"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeKeepSource}
                    onChange={(e) => setMergeKeepSource(e.target.checked)}
                    className="text-[#7C3AED] bg-white border-[#CBD5E1] rounded"
                  />
                  <span className="text-[#334155]">
                    Duplicate questions into Target (keep original questions in Source Set)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || mergeSourceSet === mergeTargetSet}
                  className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'MERGING...' : 'EXECUTE SET MERGE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: MOVE QUESTIONS BETWEEN SETS / ROUNDS
          ========================================== */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-amber-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    MOVE QUESTIONS
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Transfer selected questions or an entire set to a different Round or Set.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMoveModal(false)}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveSubmit} className="space-y-4 text-xs font-mono">
              {/* Move Mode Selector */}
              <div className="flex rounded-xl bg-[#F8FAFC] p-1 border border-[#DCE6F0]">
                <button
                  type="button"
                  onClick={() => setMoveMode('selected')}
                  disabled={selectedQuestionIds.length === 0}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition cursor-pointer ${
                    moveMode === 'selected'
                      ? 'bg-amber-600 text-white'
                      : 'text-[#64748B] hover:text-[#172033] disabled:opacity-40'
                  }`}
                >
                  Move Selected ({selectedQuestionIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMoveMode('entire_set')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition cursor-pointer ${
                    moveMode === 'entire_set'
                      ? 'bg-amber-600 text-white'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  Move Entire Set
                </button>
              </div>

              {moveMode === 'entire_set' ? (
                <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl space-y-3">
                  <div className="text-amber-700 font-bold">SOURCE SET TO MOVE:</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#64748B] mb-1 font-semibold">SOURCE ROUND</label>
                      <select
                        value={moveSourceRound}
                        onChange={(e) => setMoveSourceRound(Number(e.target.value) as RoundNumber)}
                        className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033]"
                      >
                        <option value={1}>Round 1</option>
                        <option value={2}>Round 2</option>
                        <option value={3}>Round 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#64748B] mb-1 font-semibold">SOURCE SET</label>
                      <select
                        value={moveSourceSet}
                        onChange={(e) => setMoveSourceSet(e.target.value as QuestionSet)}
                        className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033]"
                      >
                        <option value="A">Set A</option>
                        <option value="B">Set B</option>
                        <option value="C">Set C</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl text-[#334155]">
                  Moving <strong className="text-amber-700">{selectedQuestionIds.length}</strong> selected questions.
                </div>
              )}

              {/* Destination */}
              <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl space-y-3">
                <div className="text-emerald-700 font-bold">DESTINATION LOCATION:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#64748B] mb-1 font-semibold">DESTINATION ROUND</label>
                    <select
                      value={moveTargetRound}
                      onChange={(e) => setMoveTargetRound(Number(e.target.value) as RoundNumber)}
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033]"
                    >
                      <option value={1}>Round 1</option>
                      <option value={2}>Round 2</option>
                      <option value={3}>Round 3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#64748B] mb-1 font-semibold">DESTINATION SET</label>
                    <select
                      value={moveTargetSet}
                      onChange={(e) => setMoveTargetSet(e.target.value as QuestionSet)}
                      className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033]"
                    >
                      <option value="A">Set A</option>
                      <option value="B">Set B</option>
                      <option value="C">Set C</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs font-tech tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'MOVING...' : 'CONFIRM MOVE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ATTACH & EDIT REALISTIC IMAGES (WITH COPY/PASTE & FILE UPLOAD)
          ========================================== */}
      {showAttachImageModal && targetQuestionForImage && (
        <div className="fixed inset-0 z-50 bg-[#172033]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white border border-purple-200 rounded-3xl p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DCE6F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                  <Image className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-[#172033] tracking-wider">
                    EDIT QUESTION CLUE IMAGES & CLIPBOARD STUDIO
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Question #{targetQuestionForImage.questionNumber} (Round {targetQuestionForImage.round}, Set {targetQuestionForImage.set || 'A'}) • Authoritative Answer: <strong className="text-emerald-700">{targetQuestionForImage.correctAnswer}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAttachImageModal(false);
                  setTargetQuestionForImage(null);
                }}
                className="text-[#64748B] hover:text-[#172033] p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttachImageSubmit} className="space-y-4 text-xs font-mono">
              <div className="p-3.5 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 border border-purple-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-xs">REBUS SYNTHESIS GUIDELINES:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-200/80 text-purple-800 font-bold">
                    Domain: {targetQuestionForImage.domain}
                  </span>
                </div>
                <div className="text-[11px] text-[#334155] leading-relaxed">
                  Provide connected real-world photographic clues. You can <strong className="text-purple-700 font-bold">copy any image</strong> from your browser, files, or screenshot tool and press <strong className="text-purple-700 underline font-bold">Ctrl+V / Cmd+V</strong> directly in each clue panel below, or click <strong className="text-purple-700 font-bold">"Paste Image"</strong>.
                </div>
              </div>

              {/* TWO/THREE CLUE PANELS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CLUE 1 (PRIMARY) */}
                <div className="p-4 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0891B2] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                      CLUE 1 (PANEL 1)
                    </span>
                    {imageUrl1ToAttach ? (
                      <button
                        type="button"
                        onClick={() => setImageUrl1ToAttach('')}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#64748B]">Required</span>
                    )}
                  </div>

                  {/* Drop / Paste Area 1 */}
                  <div
                    tabIndex={0}
                    onFocus={() => setActivePasteSlot(1)}
                    onPaste={(e) => handleClipboardPasteForSlot(e, (dataUrl) => setImageUrl1ToAttach(dataUrl))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processImageFileOrBlob(file, (dataUrl) => setImageUrl1ToAttach(dataUrl));
                      }
                    }}
                    className={`relative rounded-xl border-2 border-dashed p-3 text-center transition cursor-pointer ${
                      activePasteSlot === 1
                        ? 'border-[#06B6D4] bg-cyan-50/50 ring-2 ring-cyan-200'
                        : 'border-[#CBD5E1] hover:border-[#06B6D4] bg-white'
                    }`}
                  >
                    {imageUrl1ToAttach ? (
                      <div className="space-y-2">
                        <div className="h-32 rounded-lg overflow-hidden border border-[#DCE6F0] bg-slate-900/5 relative">
                          <img
                            src={imageUrl1ToAttach}
                            alt="Clue 1 preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = '0.3';
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-700 font-bold">✓ Image Ready</span>
                          <button
                            type="button"
                            onClick={() => pasteFromClipboardApi((dataUrl) => setImageUrl1ToAttach(dataUrl))}
                            className="text-[#0891B2] underline font-bold"
                          >
                            Replace from Clipboard
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 space-y-2">
                        <Image className="w-7 h-7 text-[#0891B2] mx-auto opacity-70" />
                        <div className="text-xs font-bold text-[#172033]">
                          Click & Press <span className="text-[#0891B2] underline">Ctrl+V / Cmd+V</span> to Paste Image
                        </div>
                        <div className="text-[10px] text-[#64748B]">or drag & drop screenshot / image file</div>
                      </div>
                    )}
                  </div>

                  {/* Actions for Slot 1 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pasteFromClipboardApi((dataUrl) => setImageUrl1ToAttach(dataUrl))}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-[#0891B2] font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>📋 Paste Image</span>
                    </button>

                    <label className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-[#DCE6F0] text-[#172033] font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition text-center">
                      <UploadCloud className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>📁 File...</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImageFileOrBlob(file, (dataUrl) => setImageUrl1ToAttach(dataUrl));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* URL Input */}
                  <div>
                    <input
                      type="url"
                      value={imageUrl1ToAttach.startsWith('data:') ? '' : imageUrl1ToAttach}
                      onChange={(e) => setImageUrl1ToAttach(e.target.value)}
                      placeholder={imageUrl1ToAttach.startsWith('data:') ? 'Local Image / Clipboard Base64 Attached' : 'Or enter direct web image URL...'}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DCE6F0] rounded-lg text-xs font-mono focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                </div>

                {/* CLUE 2 (CONNECTED SECOND CLUE) */}
                <div className="p-4 bg-[#F8FAFC] border border-[#DCE6F0] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#7C3AED] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                      CLUE 2 (PANEL 2)
                    </span>
                    {imageUrl2ToAttach ? (
                      <button
                        type="button"
                        onClick={() => setImageUrl2ToAttach('')}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#64748B]">Required</span>
                    )}
                  </div>

                  {/* Drop / Paste Area 2 */}
                  <div
                    tabIndex={0}
                    onFocus={() => setActivePasteSlot(2)}
                    onPaste={(e) => handleClipboardPasteForSlot(e, (dataUrl) => setImageUrl2ToAttach(dataUrl))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processImageFileOrBlob(file, (dataUrl) => setImageUrl2ToAttach(dataUrl));
                      }
                    }}
                    className={`relative rounded-xl border-2 border-dashed p-3 text-center transition cursor-pointer ${
                      activePasteSlot === 2
                        ? 'border-[#7C3AED] bg-purple-50/50 ring-2 ring-purple-200'
                        : 'border-[#CBD5E1] hover:border-[#7C3AED] bg-white'
                    }`}
                  >
                    {imageUrl2ToAttach ? (
                      <div className="space-y-2">
                        <div className="h-32 rounded-lg overflow-hidden border border-[#DCE6F0] bg-slate-900/5 relative">
                          <img
                            src={imageUrl2ToAttach}
                            alt="Clue 2 preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = '0.3';
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-700 font-bold">✓ Image Ready</span>
                          <button
                            type="button"
                            onClick={() => pasteFromClipboardApi((dataUrl) => setImageUrl2ToAttach(dataUrl))}
                            className="text-[#7C3AED] underline font-bold"
                          >
                            Replace from Clipboard
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 space-y-2">
                        <Image className="w-7 h-7 text-[#7C3AED] mx-auto opacity-70" />
                        <div className="text-xs font-bold text-[#172033]">
                          Click & Press <span className="text-[#7C3AED] underline">Ctrl+V / Cmd+V</span> to Paste Image
                        </div>
                        <div className="text-[10px] text-[#64748B]">or drag & drop screenshot / image file</div>
                      </div>
                    )}
                  </div>

                  {/* Actions for Slot 2 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pasteFromClipboardApi((dataUrl) => setImageUrl2ToAttach(dataUrl))}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#7C3AED] font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>📋 Paste Image</span>
                    </button>

                    <label className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-[#DCE6F0] text-[#172033] font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition text-center">
                      <UploadCloud className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>📁 File...</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImageFileOrBlob(file, (dataUrl) => setImageUrl2ToAttach(dataUrl));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* URL Input */}
                  <div>
                    <input
                      type="url"
                      value={imageUrl2ToAttach.startsWith('data:') ? '' : imageUrl2ToAttach}
                      onChange={(e) => setImageUrl2ToAttach(e.target.value)}
                      placeholder={imageUrl2ToAttach.startsWith('data:') ? 'Local Image / Clipboard Base64 Attached' : 'Or enter direct web image URL...'}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DCE6F0] rounded-lg text-xs font-mono focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Third Clue Field (Collapsible) */}
              <div className="p-3 bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#64748B] text-[11px]">
                    OPTIONAL CLUE 3 (EXTRA TRIAD CLUE)
                  </label>
                  <button
                    type="button"
                    onClick={() => pasteFromClipboardApi((dataUrl) => setImageUrl3ToAttach(dataUrl))}
                    className="text-[10px] text-[#0891B2] font-bold underline"
                  >
                    📋 Paste Slot 3
                  </button>
                </div>
                <input
                  type="url"
                  value={imageUrl3ToAttach.startsWith('data:') ? '' : imageUrl3ToAttach}
                  onChange={(e) => setImageUrl3ToAttach(e.target.value)}
                  placeholder={imageUrl3ToAttach.startsWith('data:') ? 'Local Image / Clipboard Base64 Attached' : 'Optional 3rd connected image URL or paste from clipboard'}
                  className="w-full px-3 py-2 bg-white border border-[#DCE6F0] rounded-xl text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#DCE6F0]">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleResetImagesToDefault}
                  className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-rose-50 text-[#64748B] hover:text-rose-700 font-mono text-xs font-semibold border border-[#DCE6F0] hover:border-rose-200 transition cursor-pointer"
                  title="Revert custom attached images and restore default realistic photographic clues"
                >
                  🔄 RESTORE DEFAULT MASTER CLUES
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachImageModal(false);
                      setTargetQuestionForImage(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] font-bold text-xs border border-[#DCE6F0] cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-bold text-xs font-tech tracking-wider shadow-md shadow-cyan-500/10 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{actionLoading ? 'SAVING...' : 'SAVE CONNECTED IMAGES'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
