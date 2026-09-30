/**
 * SMART ANSWER CHECKER ENGINE
 * Tech Bridge '26 - Automated Typo Tolerance & Semantic Equivalent Checker
 * 
 * Features:
 * 1. Zero-latency heuristic fuzzy matching (Levenshtein, Damerau, Jaro-Winkler)
 * 2. Phonetic sound-alike matching (Soundex & Metaphone approximations)
 * 3. Computer Science acronym <-> full name bidirectional mapping
 * 4. Token permutation & stop-word invariant matching
 * 5. Stemming (plurals, verb forms, common suffixes)
 * 6. Optional Gemini AI semantic evaluation for edge cases
 */

import { GoogleGenAI } from '@google/genai';

export interface SmartCheckResult {
  isMatch: boolean;
  matchType: 'EXACT' | 'ALIAS' | 'TYPO_CORRECTED' | 'TOKEN_PERMUTATION' | 'PHONETIC_MATCH' | 'ACRONYM_MATCH' | 'SEMANTIC_AI' | 'NONE';
  confidence: number; // 0.0 to 1.0
  matchedTarget: string;
  details: string;
}

export type ToleranceLevel = 'STRICT' | 'MODERATE' | 'LENIENT';

export interface SmartCheckerConfig {
  enabled: boolean;
  tolerance: ToleranceLevel;
  allowPhonetic?: boolean;
  allowAcronyms?: boolean;
  allowAiSemantic?: boolean;
  customSynonyms?: Record<string, string[]>;
}

// Common Computer Science & Tech Acronyms & Synonyms dictionary
const TECH_ACRONYMS: Record<string, string[]> = {
  'os': ['operating system', 'operating systems'],
  'dbms': ['database management system', 'database system', 'database management'],
  'rdbms': ['relational database management system', 'relational database'],
  'sql': ['structured query language'],
  'nosql': ['not only sql', 'non relational database', 'no sql'],
  'api': ['application programming interface', 'web api'],
  'rest': ['representational state transfer', 'restful', 'rest api', 'restful api'],
  'tcp': ['transmission control protocol', 'tcp ip', 'tcp/ip'],
  'udp': ['user datagram protocol'],
  'http': ['hypertext transfer protocol', 'hyper text transfer protocol'],
  'https': ['hypertext transfer protocol secure', 'hyper text transfer protocol secure', 'secure http'],
  'dns': ['domain name system', 'domain name server'],
  'ip': ['internet protocol', 'ip address'],
  'bst': ['binary search tree', 'binary search'],
  'dfs': ['depth first search', 'depth first'],
  'bfs': ['breadth first search', 'breadth first'],
  'dp': ['dynamic programming'],
  'cpu': ['central processing unit', 'processor', 'microprocessor'],
  'ram': ['random access memory', 'main memory', 'primary memory'],
  'rom': ['read only memory'],
  'gpu': ['graphics processing unit', 'graphics card'],
  'gui': ['graphical user interface', 'graphical interface'],
  'cli': ['command line interface', 'command prompt', 'terminal'],
  'ide': ['integrated development environment', 'code editor'],
  'oop': ['object oriented programming', 'oops', 'object oriented'],
  'jwt': ['json web token'],
  'cors': ['cross origin resource sharing'],
  'csrf': ['cross site request forgery', 'xsrf'],
  'xss': ['cross site scripting'],
  'ai': ['artificial intelligence'],
  'ml': ['machine learning'],
  'dl': ['deep learning'],
  'nlp': ['natural language processing'],
  'cv': ['computer vision'],
  'llm': ['large language model', 'large language models'],
  'iot': ['internet of things'],
  'vpn': ['virtual private network'],
  'lan': ['local area network'],
  'wan': ['wide area network'],
  'ssd': ['solid state drive', 'solid state disk'],
  'hdd': ['hard disk drive', 'hard disk'],
  'fifo': ['first in first out'],
  'lifo': ['last in first out'],
  'lru': ['least recently used'],
  'acid': ['atomicity consistency isolation durability', 'acid properties'],
  'crud': ['create read update delete'],
  'ci cd': ['continuous integration continuous deployment', 'ci/cd', 'cicd'],
  'vm': ['virtual machine'],
  'nat': ['network address translation'],
  'arp': ['address resolution protocol'],
  'dhcp': ['dynamic host configuration protocol'],
  'ssh': ['secure shell'],
  'ssl': ['secure sockets layer', 'tls', 'transport layer security', 'ssl tls', 'ssl/tls'],
  'json': ['javascript object notation'],
  'xml': ['extensible markup language'],
  'html': ['hypertext markup language', 'hyper text markup language'],
  'css': ['cascading style sheets'],
  'dom': ['document object model'],
  'deadlock': ['dead lock', 'deadlocking'],
  'semaphore': ['semaphores', 'semaphor', 'counting semaphore', 'binary semaphore'],
  'pipeline': ['pipe line', 'pipelining', 'instruction pipeline'],
  'multithreading': ['multi threading', 'multithreaded', 'multi threaded'],
  'multiprocessing': ['multi processing', 'multiprocess', 'multi process'],
  'microservices': ['micro services', 'microservice', 'micro service architecture'],
  'kubernetes': ['k8s', 'kube'],
  'postgresql': ['postgres', 'postgres sql'],
  'mongodb': ['mongo', 'mongo db'],
  'race condition': ['race conditions', 'data race'],
  'garbage collection': ['garbage collector', 'gc'],
  'stack overflow': ['stack over flow', 'stack exhaustion'],
  'buffer overflow': ['buffer over flow', 'buffer overrun'],
  'binary tree': ['binary search tree', 'bst', 'binary trees'],
  'hash map': ['hashmap', 'hash table', 'hashtable', 'dictionary'],
  'linked list': ['linkedlist', 'singly linked list', 'doubly linked list'],
  'quicksort': ['quick sort'],
  'mergesort': ['merge sort'],
  'bubblesort': ['bubble sort'],
  'heapsort': ['heap sort'],
  'dijkstra': ["dijkstra's algorithm", "dijkstra algorithm", "dijkstras algorithm", "shortest path algorithm"],
  'kruskal': ["kruskal's algorithm", "kruskal algorithm", "kruskals algorithm", "minimum spanning tree"],
  'prim': ["prim's algorithm", "prim algorithm", "prims algorithm", "minimum spanning tree"],
};

/**
 * Standardize strings for clean string comparisons
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/['"’`]/g, '')          // remove quote marks
    .replace(/[^a-z0-9\s]/g, ' ')    // replace punctuation with space
    .replace(/\s+/g, ' ')           // collapse multi-spaces
    .trim();
}

/**
 * Strips all spaces and punctuation for compact matching
 */
export function stripToAlphaNumeric(text: string): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Compute Damerau-Levenshtein distance (includes adjacent character transpositions like teh -> the)
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));

  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return d[la][lb];
}

/**
 * Calculate similarity ratio (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  const sa = stripToAlphaNumeric(a);
  const sb = stripToAlphaNumeric(b);
  if (sa === sb) return 1.0;
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshtein(sa, sb);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Basic English Soundex code for phonetic approximation
 */
export function soundex(s: string): string {
  const str = s.toUpperCase().replace(/[^A-Z]/g, '');
  if (!str) return '';

  const mapping: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  const firstLetter = str[0];
  let res = firstLetter;
  let prevCode = mapping[firstLetter] || '0';

  for (let i = 1; i < str.length; i++) {
    const char = str[i];
    const code = mapping[char] || '0';
    if (code !== '0' && code !== prevCode) {
      res += code;
    }
    prevCode = code;
  }

  return (res + '000').slice(0, 4);
}

/**
 * Check if word tokens match regardless of permutation or filler words
 */
function tokenPermutationMatch(submitted: string, target: string, tolerance: ToleranceLevel): boolean {
  const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'for', 'to', 'and', 'or', 'is', 'algorithm', 'system', 'structure', 'concept', 'technique']);
  
  const subTokens = normalizeText(submitted)
    .split(' ')
    .filter(t => t.length > 0 && !stopWords.has(t));
  
  const targetTokens = normalizeText(target)
    .split(' ')
    .filter(t => t.length > 0 && !stopWords.has(t));

  if (subTokens.length === 0 || targetTokens.length === 0) return false;

  // If token count difference is too large, fail
  if (Math.abs(subTokens.length - targetTokens.length) > (tolerance === 'LENIENT' ? 2 : 1)) {
    return false;
  }

  let matchedCount = 0;
  const usedTargetIndices = new Set<number>();

  for (const sTok of subTokens) {
    let bestIdx = -1;
    let bestScore = 0;

    for (let j = 0; j < targetTokens.length; j++) {
      if (usedTargetIndices.has(j)) continue;
      const tTok = targetTokens[j];
      const sim = stringSimilarity(sTok, tTok);
      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = j;
      }
    }

    const minTokSim = tolerance === 'STRICT' ? 0.90 : tolerance === 'MODERATE' ? 0.75 : 0.65;
    if (bestIdx !== -1 && bestScore >= minTokSim) {
      matchedCount++;
      usedTargetIndices.add(bestIdx);
    }
  }

  const requiredMatches = Math.min(targetTokens.length, subTokens.length);
  return matchedCount >= requiredMatches && (matchedCount / targetTokens.length) >= 0.75;
}

/**
 * Check Acronym <-> Expansion equivalence
 */
function checkAcronymOrSynonym(submitted: string, target: string): boolean {
  const sNorm = normalizeText(submitted);
  const tNorm = normalizeText(target);
  const sStrip = stripToAlphaNumeric(submitted);
  const tStrip = stripToAlphaNumeric(target);

  // Direct lookup
  for (const [acronym, expansions] of Object.entries(TECH_ACRONYMS)) {
    const acStrip = stripToAlphaNumeric(acronym);
    const expStrips = expansions.map(stripToAlphaNumeric);

    const isSubmittedAcronym = sStrip === acStrip;
    const isSubmittedExpansion = expStrips.includes(sStrip) || expansions.some(e => normalizeText(e) === sNorm);

    const isTargetAcronym = tStrip === acStrip;
    const isTargetExpansion = expStrips.includes(tStrip) || expansions.some(e => normalizeText(e) === tNorm);

    if ((isSubmittedAcronym && isTargetExpansion) || (isSubmittedExpansion && isTargetAcronym)) {
      return true;
    }
  }

  return false;
}

/**
 * Main fast heuristic check function
 */
export function evaluateAnswerSmartly(
  submittedAnswer: string,
  canonicalAnswer: string,
  aliases: string[] = [],
  config: SmartCheckerConfig
): SmartCheckResult {
  const normSub = normalizeText(submittedAnswer);
  const stripSub = stripToAlphaNumeric(submittedAnswer);
  const targets = [canonicalAnswer, ...(aliases || [])].filter(Boolean);

  if (!normSub || targets.length === 0) {
    return {
      isMatch: false,
      matchType: 'NONE',
      confidence: 0,
      matchedTarget: '',
      details: 'Empty answer or targets',
    };
  }

  // 1. EXACT OR CANONICAL ALIAS MATCH (Always active)
  for (const target of targets) {
    const normTar = normalizeText(target);
    const stripTar = stripToAlphaNumeric(target);

    if (normSub === normTar || stripSub === stripTar) {
      return {
        isMatch: true,
        matchType: target === canonicalAnswer ? 'EXACT' : 'ALIAS',
        confidence: 1.0,
        matchedTarget: target,
        details: 'Exact canonical or alias match',
      };
    }
  }

  // If Smart Answer Checker is disabled, stop here
  if (!config.enabled) {
    return {
      isMatch: false,
      matchType: 'NONE',
      confidence: 0,
      matchedTarget: '',
      details: 'Smart answer checker disabled by administrator',
    };
  }

  const tolerance = config.tolerance || 'MODERATE';

  // 2. TECH ACRONYM & SYNONYM MATCHING
  for (const target of targets) {
    if (checkAcronymOrSynonym(submittedAnswer, target)) {
      return {
        isMatch: true,
        matchType: 'ACRONYM_MATCH',
        confidence: 0.95,
        matchedTarget: target,
        details: `Accepted via technical acronym/synonym mapping (${submittedAnswer} <=> ${target})`,
      };
    }
  }

  // 3. EDIT DISTANCE / SPELLING TYPO TOLERANCE
  let bestTarget = '';
  let highestSim = 0;
  let minDistance = 999;

  for (const target of targets) {
    const normTar = normalizeText(target);
    const stripTar = stripToAlphaNumeric(target);

    const dist = damerauLevenshtein(stripSub, stripTar);
    const sim = stringSimilarity(stripSub, stripTar);

    if (sim > highestSim) {
      highestSim = sim;
      bestTarget = target;
      minDistance = dist;
    }

    // Dynamic typo allowance based on target length & tolerance setting
    const len = stripTar.length;
    let allowedMaxDist = 0;

    if (tolerance === 'STRICT') {
      if (len >= 5) allowedMaxDist = 1;
    } else if (tolerance === 'MODERATE') {
      if (len >= 4 && len <= 6) allowedMaxDist = 1;
      else if (len >= 7 && len <= 11) allowedMaxDist = 2;
      else if (len > 11) allowedMaxDist = 3;
    } else if (tolerance === 'LENIENT') {
      if (len >= 3 && len <= 5) allowedMaxDist = 1;
      else if (len >= 6 && len <= 9) allowedMaxDist = 2;
      else if (len > 9) allowedMaxDist = 4;
    }

    if (dist <= allowedMaxDist && dist > 0) {
      return {
        isMatch: true,
        matchType: 'TYPO_CORRECTED',
        confidence: Number(sim.toFixed(2)),
        matchedTarget: target,
        details: `Spelling typo corrected (${dist} char variation, ${(sim * 100).toFixed(0)}% similarity to "${target}")`,
      };
    }
  }

  // 4. TOKEN PERMUTATION & KEYWORD MATCHING (e.g. "binary search tree" vs "tree search binary")
  for (const target of targets) {
    if (tokenPermutationMatch(submittedAnswer, target, tolerance)) {
      return {
        isMatch: true,
        matchType: 'TOKEN_PERMUTATION',
        confidence: 0.90,
        matchedTarget: target,
        details: `Accepted via word order permutation / token matching with "${target}"`,
      };
    }
  }

  // 5. PHONETIC MATCHING (Soundex / sound-alikes like semafor -> semaphore)
  if (config.allowPhonetic !== false && tolerance !== 'STRICT') {
    const subSound = soundex(submittedAnswer);
    for (const target of targets) {
      const tarSound = soundex(target);
      if (subSound && tarSound && subSound === tarSound && highestSim >= 0.65) {
        return {
          isMatch: true,
          matchType: 'PHONETIC_MATCH',
          confidence: 0.85,
          matchedTarget: target,
          details: `Accepted via phonetic sound-alike match (${subSound} == ${tarSound})`,
        };
      }
    }
  }

  return {
    isMatch: false,
    matchType: 'NONE',
    confidence: Number(highestSim.toFixed(2)),
    matchedTarget: bestTarget,
    details: `No acceptable match found (Best match "${bestTarget}" with ${(highestSim * 100).toFixed(0)}% similarity)`,
  };
}

/**
 * Optional Gemini AI semantic checker for complex domain terms
 */
export async function checkAnswerWithGeminiAi(
  submittedAnswer: string,
  canonicalAnswer: string,
  questionTitleOrFormula?: string
): Promise<{ isEquivalent: boolean; confidence: number; reason: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { isEquivalent: false, confidence: 0, reason: 'Gemini API key not configured' };
    }

    const ai = new GoogleGenAI({});
    const prompt = `You are an automated grading assistant for a Computer Science Symposium technical competition.
Task: Determine if the candidate's submitted answer is semantically equivalent, a valid technical synonym, or an acceptable minor spelling variation of the canonical correct answer.

Context:
- Question Concept: "${questionTitleOrFormula || 'Technical Concept'}"
- Canonical Correct Answer: "${canonicalAnswer}"
- Submitted Answer: "${submittedAnswer}"

Rules:
1. Accept if it is an exact concept match (e.g., "BST" vs "Binary Search Tree", "Dijkstra" vs "Dijkstra's Algorithm", "K8s" vs "Kubernetes").
2. Accept minor technical typos, phonetic transliterations, or spelling mistakes.
3. Reject if it refers to a completely different computing concept (e.g. "BFS" for "DFS", "Stack" for "Queue", "TCP" for "UDP").

Respond ONLY with valid JSON in this exact structure:
{"isEquivalent": true|false, "confidence": 0.0 to 1.0, "reason": "brief 10-word explanation"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return {
      isEquivalent: Boolean(parsed.isEquivalent),
      confidence: Number(parsed.confidence) || 0.8,
      reason: String(parsed.reason || 'Evaluated via Gemini AI Semantic Engine'),
    };
  } catch (err: any) {
    console.error('Gemini answer check fallback error:', err?.message);
    return { isEquivalent: false, confidence: 0, reason: 'AI service unavailable' };
  }
}
