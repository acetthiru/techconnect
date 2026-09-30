import { GoogleGenAI } from '@google/genai';

/**
 * Answer Checker Module for TECH BRIDGE '26
 * Handles exact matching, fuzzy edit-distance spelling tolerance, token overlap,
 * and server-side Gemini AI semantic answer evaluation.
 */

export interface AnswerCheckerOptions {
  submittedAnswer: string;
  canonicalAnswer: string;
  aliases?: string[];
  questionInfo?: {
    rebusFormulaText?: string;
    domain?: string;
    explanation?: string;
  };
  toleranceMode?: 'strict' | 'moderate' | 'flexible';
}

export interface AnswerCheckerResult {
  isCorrect: boolean;
  matchType: 'EXACT' | 'ALIAS' | 'SPELLING_FUZZY' | 'AI_SEMANTIC' | 'REJECTED';
  reason: string;
  confidence?: number;
}

/**
 * Calculate Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Calculate string similarity score between 0.0 and 1.0
 */
export function stringSimilarityRatio(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1.0 - dist / maxLen;
}

/**
 * Normalize text for matching
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Tokenize and sort words
 */
export function sortedTokens(text: string): string {
  return normalizeText(text).split(' ').filter(Boolean).sort().join(' ');
}

/**
 * Fast Algorithmic Fuzzy Answer Checker (Spelling & Edit Distance Tolerance)
 */
export function checkFuzzySpellingMatch(
  submitted: string,
  target: string,
  toleranceMode: 'strict' | 'moderate' | 'flexible' = 'moderate'
): { matches: boolean; editDistance: number; similarity: number; maxAllowedDist: number } {
  const sNorm = normalizeText(submitted);
  const tNorm = normalizeText(target);

  if (!sNorm || !tNorm) {
    return { matches: false, editDistance: 99, similarity: 0, maxAllowedDist: 0 };
  }

  if (sNorm === tNorm) {
    return { matches: true, editDistance: 0, similarity: 1.0, maxAllowedDist: 0 };
  }

  // Token order check (e.g. "garbage collection" vs "collection garbage")
  if (sortedTokens(sNorm) === sortedTokens(tNorm)) {
    return { matches: true, editDistance: 0, similarity: 1.0, maxAllowedDist: 0 };
  }

  const dist = levenshteinDistance(sNorm, tNorm);
  const sim = stringSimilarityRatio(sNorm, tNorm);
  const tLen = tNorm.length;

  // Determine allowed edit distance based on target length & tolerance mode
  let maxDist = 0;
  if (tLen <= 3) {
    maxDist = 0;
  } else if (tLen <= 6) {
    maxDist = toleranceMode === 'strict' ? 1 : 1;
  } else if (tLen <= 10) {
    maxDist = toleranceMode === 'strict' ? 1 : toleranceMode === 'moderate' ? 2 : 2;
  } else if (tLen <= 15) {
    maxDist = toleranceMode === 'strict' ? 2 : toleranceMode === 'moderate' ? 3 : 4;
  } else {
    maxDist = toleranceMode === 'strict' ? 3 : toleranceMode === 'moderate' ? 4 : 5;
  }

  const minSimThreshold = toleranceMode === 'strict' ? 0.85 : toleranceMode === 'moderate' ? 0.78 : 0.72;

  const matches = dist <= maxDist || sim >= minSimThreshold;

  return {
    matches,
    editDistance: dist,
    similarity: sim,
    maxAllowedDist: maxDist,
  };
}

/**
 * Gemini AI Server-Side Answer Evaluator
 */
async function evaluateWithGeminiAI(
  opts: AnswerCheckerOptions
): Promise<AnswerCheckerResult | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Use official recommended model alias for text evaluation tasks: gemini-3.8-flash
    const model = 'gemini-3.8-flash';

    const prompt = `You are an automated Computer Science answer evaluator for "TECH BRIDGE '26", a technical rebus symposium challenge.
Your job is to determine whether a participant's submitted answer is acceptable for a question.

Rule:
Accept the answer if:
1. It contains minor spelling mistakes, typos, missing/extra letters, or phonetically close spelling (e.g., "memmory leak" for "memory leak", "deadlok" for "deadlock", "dinning" for "dining", "cahe" for "cache").
2. It uses spacing, hyphenation, or singular/plural variations (e.g. "sql-injection" vs "sql injection", "buffer overflows" vs "buffer overflow").
3. It uses a synonym, abbreviation, or technical equivalent that means the exact same thing in this CS context (e.g. "garbge collector" vs "garbage collection", "race condition" vs "racing condition", "syn ack" vs "syn-ack handshake").

Reject the answer if:
1. It refers to a completely different technical concept (e.g., "stack" instead of "queue", "tcp" instead of "udp", "python" instead of "java").
2. It is too vague or completely wrong.

Question Context:
Domain: ${opts.questionInfo?.domain || 'Computer Science'}
Rebus Clue / Formula: ${opts.questionInfo?.rebusFormulaText || 'N/A'}
Explanation: ${opts.questionInfo?.explanation || 'N/A'}
Canonical Correct Answer: "${opts.canonicalAnswer}"
Acceptable Aliases: ${JSON.stringify(opts.aliases || [])}
Participant Submitted Answer: "${opts.submittedAnswer}"
Tolerance Mode: "${opts.toleranceMode || 'moderate'}"

Respond strictly with valid JSON only in this schema:
{
  "isAcceptable": boolean,
  "matchType": "SPELLING_FUZZY" | "AI_SEMANTIC" | "REJECTED",
  "reason": "1 short sentence explaining why accepted (e.g., 'Minor typo: memmory -> memory') or rejected",
  "confidence": number
}`;

    // Add a strict timeout race (2200ms) to ensure participant submission response is lightning fast
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200));

    const apiPromise = ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const response = (await Promise.race([apiPromise, timeoutPromise])) as any;

    if (!response || !response.text) {
      return null;
    }

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);

    if (typeof parsed.isAcceptable === 'boolean') {
      return {
        isCorrect: parsed.isAcceptable,
        matchType: parsed.isAcceptable ? (parsed.matchType || 'AI_SEMANTIC') : 'REJECTED',
        reason: parsed.reason || (parsed.isAcceptable ? 'Accepted by AI Answer Checker' : 'Incorrect answer'),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      };
    }
  } catch (err) {
    console.warn('Gemini AI Answer Evaluation fallback to local fuzzy checker:', (err as Error).message);
  }

  return null;
}

/**
 * Main Answer Checker Entry Point
 */
export async function evaluateAnswerWithChecker(
  opts: AnswerCheckerOptions
): Promise<AnswerCheckerResult> {
  const normSubmitted = normalizeText(opts.submittedAnswer);
  const normCanonical = normalizeText(opts.canonicalAnswer);
  const normAliases = (opts.aliases || []).map(normalizeText);

  // Step 1: Exact Match
  if (normSubmitted === normCanonical) {
    return {
      isCorrect: true,
      matchType: 'EXACT',
      reason: 'Exact canonical answer match',
    };
  }

  // Step 2: Alias Match
  if (normAliases.includes(normSubmitted)) {
    return {
      isCorrect: true,
      matchType: 'ALIAS',
      reason: 'Matches configured answer alias',
    };
  }

  // Step 3: Fast Local Fuzzy Spelling Check against Canonical & Aliases
  const targets = [opts.canonicalAnswer, ...(opts.aliases || [])];
  for (const target of targets) {
    const fuzzy = checkFuzzySpellingMatch(opts.submittedAnswer, target, opts.toleranceMode || 'moderate');
    if (fuzzy.matches) {
      const editMsg = fuzzy.editDistance > 0 ? ` (Typo/Spelling correction: ${fuzzy.editDistance} edit${fuzzy.editDistance > 1 ? 's' : ''})` : '';
      return {
        isCorrect: true,
        matchType: 'SPELLING_FUZZY',
        reason: `Accepted by Answer Checker: Spelling/Fuzzy match with "${target}"${editMsg}`,
        confidence: Math.round(fuzzy.similarity * 100) / 100,
      };
    }
  }

  // Step 4: AI Semantic Check via Gemini (if enabled or available)
  const aiResult = await evaluateWithGeminiAI(opts);
  if (aiResult && aiResult.isCorrect) {
    return aiResult;
  }

  return {
    isCorrect: false,
    matchType: 'REJECTED',
    reason: 'Answer does not match canonical answer, aliases, or spelling tolerance',
  };
}
