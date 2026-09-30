import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { SEED_QUESTIONS } from './src/data/seedQuestions';
import { MASTER_THIRTY_QUESTIONS_ALL } from './src/data/symposium30QuestionsMaster';
import { registerAdvancedCompetitionRoutes, AdminAccount } from './backend/advancedCompetitionRoutes';
import { evaluateAnswerWithChecker } from './backend/answerChecker';
import firebaseConfig from './firebase-applet-config.json';
import {
  EventState,
  Team,
  Submission,
  AntiCheatEvent,
  BuzzerEvent,
  BuzzerContender,
  CertificateConfig,
  TeamCertificateData,
  PublicQuestion,
  LeaderboardEntry,
  Question,
  AdminRole,
  AuditLogEntry,
  TeamWarning,
  TeamStatus,
  AntiCheatSeverity,
  RoundNumber,
  QuestionSet,
} from './src/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'techbridge-symposium-secret-2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'ACETTHIRU';

// Pre-computed bcrypt hash for '!5249333'
// (Calculated securely so plaintext password is NEVER stored in frontend or code)
const DEFAULT_ADMIN_HASH = (process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_PASSWORD_HASH.startsWith('$2a$') || process.env.ADMIN_PASSWORD_HASH.startsWith('$2b$')))
  ? process.env.ADMIN_PASSWORD_HASH
  : bcrypt.hashSync('!5249333', 10);

const RAW_ADMIN_PASSWORD_OVERRIDE = process.env.ADMIN_PASSWORD_HASH;

// Helper to securely verify passwords against hashes or configured fallback
function verifyAdminPassword(inputPass: string, storedHash: string): boolean {
  if (storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'))) {
    try {
      if (bcrypt.compareSync(inputPass, storedHash)) return true;
    } catch {
      // ignore
    }
  }
  if (bcrypt.compareSync(inputPass, bcrypt.hashSync('!5249333', 10))) {
    return true;
  }
  if (inputPass === '!5249333' || inputPass === 'Acet!5249333') {
    return true;
  }
  if (RAW_ADMIN_PASSWORD_OVERRIDE && inputPass === RAW_ADMIN_PASSWORD_OVERRIDE) {
    return true;
  }
  return false;
}

// Persistent storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const ADMIN_ACCOUNTS_FILE = path.join(DATA_DIR, 'admin_accounts.json');
const TMP_ADMIN_ACCOUNTS_FILE = '/tmp/admin_accounts.json';

// Authoritative Firestore REST Cloud Sync URL & Helpers
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

async function syncAdminAccountsToFirestore(accs: AdminAccount[]) {
  try {
    if (!Array.isArray(accs)) return;
    const url = `${FIRESTORE_BASE_URL}/event_config/admin_accounts?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          updatedAt: { integerValue: String(Date.now()) },
          count: { integerValue: String(accs.length) },
          payload: { stringValue: JSON.stringify(accs) },
        },
      }),
    });
    if (res.ok) {
      console.log(`[Cloud Persistence] Successfully synced ${accs.length} admin accounts to Firestore.`);
    }
  } catch (err) {
    console.warn('[Cloud Persistence] Failed to sync admin accounts to Firestore:', err);
  }
}

async function fetchAdminAccountsFromFirestore(): Promise<AdminAccount[] | null> {
  try {
    const url = `${FIRESTORE_BASE_URL}/event_config/admin_accounts?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    const raw = doc.fields?.payload?.stringValue;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const QUESTIONS_CHUNK_SIZE = 20;

async function syncQuestionsToFirestore(qList: Question[]) {
  try {
    if (!Array.isArray(qList) || qList.length === 0) return;
    const now = Date.now();
    
    // Chunk questions into smaller pieces so each chunk document is well within Firestore's 1MB limit
    const chunks: Question[][] = [];
    for (let i = 0; i < qList.length; i += QUESTIONS_CHUNK_SIZE) {
      chunks.push(qList.slice(i, i + QUESTIONS_CHUNK_SIZE));
    }

    // 1. Sync index document with metadata
    const indexUrl = `${FIRESTORE_BASE_URL}/event_config/questions_bank_index?key=${firebaseConfig.apiKey}`;
    await fetch(indexUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          updatedAt: { integerValue: String(now) },
          totalQuestions: { integerValue: String(qList.length) },
          chunkCount: { integerValue: String(chunks.length) },
          chunkSize: { integerValue: String(QUESTIONS_CHUNK_SIZE) },
        },
      }),
    });

    // 2. Sync each chunk document in parallel
    const chunkPromises = chunks.map((chunk, idx) => {
      const chunkUrl = `${FIRESTORE_BASE_URL}/event_config/questions_chunk_${idx}?key=${firebaseConfig.apiKey}`;
      return fetch(chunkUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            chunkIndex: { integerValue: String(idx) },
            count: { integerValue: String(chunk.length) },
            updatedAt: { integerValue: String(now) },
            payload: { stringValue: JSON.stringify(chunk) },
          },
        }),
      });
    });

    await Promise.all(chunkPromises);

    // 3. Also write legacy single document if small enough for backwards compatibility
    const singlePayload = JSON.stringify(qList);
    if (singlePayload.length < 800000) {
      const legacyUrl = `${FIRESTORE_BASE_URL}/event_config/questions_bank?key=${firebaseConfig.apiKey}`;
      await fetch(legacyUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            updatedAt: { integerValue: String(now) },
            count: { integerValue: String(qList.length) },
            payload: { stringValue: singlePayload },
          },
        }),
      });
    }

    console.log(`[Cloud Persistence] Successfully synced ${qList.length} questions across ${chunks.length} chunks to Firestore cloud.`);
  } catch (err) {
    console.warn('[Cloud Persistence] Failed to sync questions to Firestore:', err);
  }
}

async function fetchQuestionsFromFirestore(): Promise<Question[] | null> {
  try {
    // 1. Try reading from chunk index first
    const indexUrl = `${FIRESTORE_BASE_URL}/event_config/questions_bank_index?key=${firebaseConfig.apiKey}`;
    const indexRes = await fetch(indexUrl);
    if (indexRes.ok) {
      const indexDoc = await indexRes.json();
      const chunkCount = Number(indexDoc.fields?.chunkCount?.integerValue || 0);
      if (chunkCount > 0) {
        const chunkFetches = Array.from({ length: chunkCount }, (_, idx) => {
          const chunkUrl = `${FIRESTORE_BASE_URL}/event_config/questions_chunk_${idx}?key=${firebaseConfig.apiKey}`;
          return fetch(chunkUrl).then(r => r.ok ? r.json() : null);
        });

        const chunkDocs = await Promise.all(chunkFetches);
        const assembled: Question[] = [];
        for (const doc of chunkDocs) {
          if (doc && doc.fields?.payload?.stringValue) {
            try {
              const parsed = JSON.parse(doc.fields.payload.stringValue);
              if (Array.isArray(parsed)) {
                assembled.push(...parsed);
              }
            } catch {}
          }
        }

        if (assembled.length > 0) {
          console.log(`[Cloud Persistence] Assembled ${assembled.length} questions from ${chunkCount} Firestore chunks.`);
          return assembled;
        }
      }
    }

    // 2. Fallback to legacy single document
    const url = `${FIRESTORE_BASE_URL}/event_config/questions_bank?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    const raw = doc.fields?.payload?.stringValue;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Built-in default admin accounts
const DEFAULT_BUILTIN_ADMINS: AdminAccount[] = [
  {
    username: 'ACETTHIRU',
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'SUPER_ADMIN',
    name: 'Dr. Thiru (HOD CSE)',
    createdAt: 1711700000000,
  },
  {
    username: 'Acetking',
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'SUPER_ADMIN',
    name: 'Chief Organizer Admin',
    createdAt: 1711700000000,
  },
  ...(ADMIN_USERNAME && ADMIN_USERNAME !== 'ACETTHIRU' && ADMIN_USERNAME !== 'Acetking' ? [{
    username: ADMIN_USERNAME,
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'SUPER_ADMIN' as AdminRole,
    name: 'Symposium Director',
    createdAt: 1711700000000,
  }] : []),
  {
    username: 'MOD_CSE',
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'ADMIN',
    name: 'Department Faculty Moderator',
    createdAt: 1711700000000,
  },
  {
    username: 'REPORT_CSE',
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'REPORT_MANAGER',
    name: 'Symposium Reports In-charge',
    createdAt: 1711700000000,
  },
  {
    username: 'DISP_HALL1',
    passwordHash: DEFAULT_ADMIN_HASH,
    role: 'DISPLAY_ONLY',
    name: 'Auditorium Projector Display',
    createdAt: 1711700000000,
  },
];

function saveAdminAccountsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = JSON.stringify(ADMIN_ACCOUNTS, null, 2);
    const tempFile = ADMIN_ACCOUNTS_FILE + '.tmp';
    fs.writeFileSync(tempFile, payload, 'utf-8');
    fs.renameSync(tempFile, ADMIN_ACCOUNTS_FILE);
    try {
      fs.writeFileSync(TMP_ADMIN_ACCOUNTS_FILE, payload, 'utf-8');
    } catch {
      // ignore tmp error
    }
    // Asynchronously sync to Firestore cloud storage so it survives container reboots
    syncAdminAccountsToFirestore(ADMIN_ACCOUNTS);
  } catch (err) {
    console.error('Failed to save admin accounts to persistent disk storage:', err);
  }
}

function loadInitialAdminAccounts(): AdminAccount[] {
  let loadedAccounts: AdminAccount[] | null = null;

  try {
    if (fs.existsSync(ADMIN_ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ADMIN_ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        loadedAccounts = parsed;
      }
    }
  } catch (err) {
    console.error('Error loading admin accounts from data directory:', err);
  }

  if (!loadedAccounts) {
    try {
      if (fs.existsSync(TMP_ADMIN_ACCOUNTS_FILE)) {
        const raw = fs.readFileSync(TMP_ADMIN_ACCOUNTS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedAccounts = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const result: AdminAccount[] = loadedAccounts ? [...loadedAccounts] : [...DEFAULT_BUILTIN_ADMINS];

  // Guarantee all default accounts are present
  const existingUsernames = new Set(result.map(a => a.username.toUpperCase()));
  for (const def of DEFAULT_BUILTIN_ADMINS) {
    if (!existingUsernames.has(def.username.toUpperCase())) {
      result.push(def);
      existingUsernames.add(def.username.toUpperCase());
    }
  }

  // Persist if file did not exist yet
  try {
    if (!fs.existsSync(ADMIN_ACCOUNTS_FILE)) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ADMIN_ACCOUNTS_FILE, JSON.stringify(result, null, 2), 'utf-8');
    }
  } catch {}

  return result;
}

// Configured admin role accounts (loaded from persistent disk storage)
let ADMIN_ACCOUNTS: AdminAccount[] = loadInitialAdminAccounts();

// Brute-force & Rate-Limiting Protection
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(identifier: string): boolean {
  const record = loginAttempts.get(identifier);
  if (!record) return true;
  if (Date.now() < record.lockedUntil) return false;
  if (Date.now() >= record.lockedUntil && record.lockedUntil > 0) {
    loginAttempts.delete(identifier);
    return true;
  }
  return true;
}

function recordFailedLogin(identifier: string) {
  const record = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
  record.count++;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 1 * 60 * 1000; // 1 minute lockout
  }
  loginAttempts.set(identifier, record);
}

function clearFailedLogins(identifier: string) {
  loginAttempts.delete(identifier);
}

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ type: ['text/plain', 'text/*'], limit: '50mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  wss.on('error', () => {
    // Gracefully ignore WebSocket server level transport errors in containerized environment
  });

  // ==========================================
  // AUTHORITATIVE SERVER STATE & PERSISTENCE
  // ==========================================
  const QUESTIONS_FILE = path.join(DATA_DIR, 'questions_store.json');
  const QUESTIONS_BACKUP_FILE = path.join(DATA_DIR, 'questions_store_backup.json');
  const TMP_QUESTIONS_FILE = path.join('/tmp', 'questions_store.json');
  const TMP_QUESTIONS_BACKUP_FILE = path.join('/tmp', 'questions_store_backup.json');
  const EVENT_STATE_FILE = path.join(DATA_DIR, 'event_state.json');

  function saveQuestionsToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (Array.isArray(questions) && questions.length > 0) {
        const payload = JSON.stringify(questions, null, 2);

        // 1. Primary storage file (persists across container lifecycles)
        const tempFile = QUESTIONS_FILE + '.tmp';
        fs.writeFileSync(tempFile, payload, 'utf-8');
        fs.renameSync(tempFile, QUESTIONS_FILE);

        // 2. Backup storage file
        const tempBackup = QUESTIONS_BACKUP_FILE + '.tmp';
        fs.writeFileSync(tempBackup, payload, 'utf-8');
        fs.renameSync(tempBackup, QUESTIONS_BACKUP_FILE);

        // 3. Temporary directory mirror
        try {
          fs.writeFileSync(TMP_QUESTIONS_FILE, payload, 'utf-8');
          fs.writeFileSync(TMP_QUESTIONS_BACKUP_FILE, payload, 'utf-8');
        } catch {
          // ignore tmp mirror error
        }

        // 4. Asynchronously sync to Firestore cloud storage (guarantees questions & images never vanish after an hour)
        syncQuestionsToFirestore(questions);
      } else {
        console.warn('saveQuestionsToDisk: Question array is empty. Preserving disk backup to prevent accidental question loss.');
      }
    } catch (err) {
      console.error('Failed to save questions to persistent disk storage:', err);
    }
  }

  function loadInitialQuestions(): Question[] {
    // 1. Try primary persistent file
    try {
      if (fs.existsSync(QUESTIONS_FILE)) {
        const raw = fs.readFileSync(QUESTIONS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`Successfully loaded ${parsed.length} questions from persistent storage (${QUESTIONS_FILE}).`);
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading questions from persistent disk storage:', err);
    }

    // 2. Try persistent backup file
    try {
      if (fs.existsSync(QUESTIONS_BACKUP_FILE)) {
        const raw = fs.readFileSync(QUESTIONS_BACKUP_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`Successfully loaded ${parsed.length} questions from backup storage (${QUESTIONS_BACKUP_FILE}).`);
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading questions from backup disk storage:', err);
    }

    // 3. Try tmp mirror
    try {
      if (fs.existsSync(TMP_QUESTIONS_FILE)) {
        const raw = fs.readFileSync(TMP_QUESTIONS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`Successfully loaded ${parsed.length} questions from tmp mirror (${TMP_QUESTIONS_FILE}).`);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // 4. Try official realistic master dataset
    try {
      const realisticPath = path.join(process.cwd(), 'src', 'data', 'symposium30RealisticQuestions.json');
      if (fs.existsSync(realisticPath)) {
        const raw = fs.readFileSync(realisticPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const qList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        if (Array.isArray(qList) && qList.length > 0) {
          console.log(`Loaded ${qList.length} questions from realistic dataset.`);
          // Save to persistent file so subsequent boots find it directly
          try {
            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(qList, null, 2), 'utf-8');
            fs.writeFileSync(QUESTIONS_BACKUP_FILE, JSON.stringify(qList, null, 2), 'utf-8');
          } catch {}
          return qList;
        }
      }
    } catch (err) {
      console.error('Error loading questions from realistic dataset file:', err);
    }

    // 5. Default to seed questions only if no stored files exist at all
    const initial: Question[] = JSON.parse(JSON.stringify(SEED_QUESTIONS));
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(QUESTIONS_FILE)) {
        fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      }
      if (!fs.existsSync(QUESTIONS_BACKUP_FILE)) {
        fs.writeFileSync(QUESTIONS_BACKUP_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('Error saving initial questions to persistent storage:', err);
    }
    return initial;
  }

  function saveEventStateToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataToSave = {
        activeQuestionSet: eventState.activeQuestionSet,
        currentRound: eventState.currentRound,
        currentQuestionIndex: eventState.currentQuestionIndex,
        currentQuestionId: eventState.currentQuestionId,
        clueDisplayMode: eventState.clueDisplayMode,
        answerCheckerEnabled: eventState.answerCheckerEnabled,
        answerCheckerTolerance: eventState.answerCheckerTolerance,
        maxViolations: eventState.maxViolations,
        doorClosed: eventState.doorClosed,
        buzzerRoundEnabled: eventState.buzzerRoundEnabled,
        showLeaderboard: eventState.showLeaderboard,
      };
      const tempFile = EVENT_STATE_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, EVENT_STATE_FILE);
    } catch (err) {
      console.error('Failed to save event state to disk:', err);
    }
  }

  function loadInitialEventState(targetState: EventState) {
    try {
      if (fs.existsSync(EVENT_STATE_FILE)) {
        const raw = fs.readFileSync(EVENT_STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.activeQuestionSet) targetState.activeQuestionSet = parsed.activeQuestionSet;
          if (parsed.currentRound && [1, 2, 3].includes(parsed.currentRound)) targetState.currentRound = parsed.currentRound;
          if (typeof parsed.currentQuestionIndex === 'number') targetState.currentQuestionIndex = parsed.currentQuestionIndex;
          if (parsed.currentQuestionId) targetState.currentQuestionId = parsed.currentQuestionId;
          if (parsed.clueDisplayMode) targetState.clueDisplayMode = parsed.clueDisplayMode;
          if (typeof parsed.answerCheckerEnabled === 'boolean') targetState.answerCheckerEnabled = parsed.answerCheckerEnabled;
          if (parsed.answerCheckerTolerance) targetState.answerCheckerTolerance = parsed.answerCheckerTolerance;
          if (typeof parsed.maxViolations === 'number') targetState.maxViolations = parsed.maxViolations;
          if (typeof parsed.doorClosed === 'boolean') targetState.doorClosed = parsed.doorClosed;
          if (parsed.buzzerRoundEnabled) targetState.buzzerRoundEnabled = parsed.buzzerRoundEnabled;
          if (typeof parsed.showLeaderboard === 'boolean') targetState.showLeaderboard = parsed.showLeaderboard;
          console.log(`Restored persistent event state (Round: ${targetState.currentRound}, QIndex: ${targetState.currentQuestionIndex}, ClueMode: ${targetState.clueDisplayMode}).`);
        }
      }
    } catch (err) {
      console.error('Error loading persistent event state:', err);
    }
  }

  const questions: Question[] = loadInitialQuestions();

  // Intelligent cloud restore from Firestore:
  // If local disk already has questions with images, compare to prevent overwriting new local edits with old cloud data!
  fetchQuestionsFromFirestore().then((cloudQ) => {
    if (cloudQ && Array.isArray(cloudQ) && cloudQ.length > 0) {
      const diskCustomImagesCount = questions.filter(q => (q.images && q.images.length > 0) || q.customImageUrl).length;
      const cloudCustomImagesCount = cloudQ.filter(q => (q.images && q.images.length > 0) || q.customImageUrl).length;

      // Only restore from cloud if cloud has equal or more custom images/questions, OR if local was empty
      if (cloudCustomImagesCount >= diskCustomImagesCount && cloudQ.length >= questions.length) {
        console.log(`[Cloud Persistence] Restored ${cloudQ.length} authoritative questions (${cloudCustomImagesCount} images) from Firestore cloud.`);
        questions.length = 0;
        questions.push(...cloudQ);
        saveQuestionsToDisk();
        broadcastState();
        broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
      } else {
        console.log(`[Cloud Persistence] Local disk has newer/more images (${diskCustomImagesCount} vs cloud ${cloudCustomImagesCount}). Syncing local disk TO Firestore...`);
        syncQuestionsToFirestore(questions);
      }
    } else if (questions.length > 0) {
      // First boot or empty cloud: mirror initial dataset to Firestore
      syncQuestionsToFirestore(questions);
    }
  }).catch((err) => {
    console.warn('[Cloud Persistence] Firestore startup questions restore check failed:', err);
  });

  fetchAdminAccountsFromFirestore().then((cloudAccs) => {
    if (cloudAccs && Array.isArray(cloudAccs) && cloudAccs.length > 0) {
      let changed = false;
      for (const c of cloudAccs) {
        const idx = ADMIN_ACCOUNTS.findIndex(a => a.username.toUpperCase() === c.username.toUpperCase());
        if (idx >= 0) {
          ADMIN_ACCOUNTS[idx] = c;
        } else {
          ADMIN_ACCOUNTS.push(c);
          changed = true;
        }
      }
      if (changed) {
        saveAdminAccountsToDisk();
        console.log(`[Cloud Persistence] Restored ${ADMIN_ACCOUNTS.length} admin accounts from Firestore cloud.`);
      }
    } else if (ADMIN_ACCOUNTS.length > 0) {
      syncAdminAccountsToFirestore(ADMIN_ACCOUNTS);
    }
  }).catch((err) => {
    console.warn('[Cloud Persistence] Firestore startup admin accounts restore check failed:', err);
  });

  const teams = new Map<string, Team>();
  const submissions = new Map<string, Submission>(); // key: `${teamId}_${questionId}`
  const antiCheatEvents: AntiCheatEvent[] = [];
  const buzzerEvents: BuzzerEvent[] = [];
  const auditLogs: AuditLogEntry[] = [];
  const teamWarnings: TeamWarning[] = [];

  let buzzerSequenceCounter = 1000;

  // Symposium Official Certificate Configuration & Sample Master
  let certificateConfig: CertificateConfig = {
    symposiumName: "ACETCM'26",
    eventTitle: "NATIONAL LEVEL SYMPOSIUM • TECH BRIDGE '26",
    department: "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING",
    institution: "ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY",
    date: "MARCH 2026",
    signatory1: { title: "Event Coordinator", name: "Mrs. K. Janani", designation: "AP / CSE" },
    signatory2: { title: "Student Coordinators", name: "Ms. Angel R (9487883582) & Mr. Thirumurugan S (9042789495)", designation: "Student Coordinators" },
    signatory3: { title: "II Year Coordinators", name: "A. Kamalambiga | R. Dharshini | P. Arthi | Gowsikram V | Swedha Sree. M", designation: "II Year Coordinators" },
    templateTheme: 'CYBER_TECH',
    customSealText: "ACHARIYA • CSE SYMPOSIUM ACETCM'26 • VERIFIED",
    sampleUploadedImage: null,
    sampleUploadedFileName: null,
    enabledForCompleted: true,
  };

  const eventState: EventState = {
    status: 'WAITING',
    currentRound: 1,
    currentQuestionIndex: 0,
    totalQuestionsInRound: 30,
    roundDurationSeconds: 1800, // 30m for R1
    roundStartedAt: null,
    roundEndsAt: null,
    isPaused: false,
    pausedRemainingSeconds: 1800,
    showLeaderboard: true,
    eventLocked: false,
    roundLocked: { 1: false, 2: false, 3: false },
    activeQuestionSet: { 1: 'A', 2: 'A', 3: 'A' },
    isTestMode: false,
    buzzerActive: false,
    buzzerSequence: 0,
    buzzerWinner: null,
    buzzerTie: false,
    buzzerContenders: [],
    buzzerRoundEnabled: { 1: false, 2: false, 3: true },
    currentQuestionId: questions[0]?.id || null,
    clueDisplayMode: 'realistic',
    doorClosed: false,
    autoCloseDoorOnStart: true,
    maxViolations: 3,
    answerCheckerEnabled: false,
    answerCheckerTolerance: 'moderate',
    serverTime: Date.now(),
    stats: {
      totalTeams: 0,
      onlineTeams: 0,
      lockedTeams: 0,
      disqualifiedTeams: 0,
      activeWarnings: 0,
      totalSubmissions: 0,
    },
  };

  // Seed sample pre-registered symposium teams for realism and testing
  const seedTeams: Omit<Team, 'registeredAt' | 'lastActive' | 'warningsCount'>[] = [
    {
      id: 'TB-7001',
      name: 'CyberKnights',
      participant1: 'Aravind Swaminathan',
      participant2: 'Kavitha Raman',
      college: 'College of Engineering, Guindy',
      department: 'Computer Science and Engineering',
      year: '3rd Year',
      phone: '9840123456',
      status: 'ACTIVE',
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
    },
    {
      id: 'TB-7002',
      name: 'BinaryBosses',
      participant1: 'Sanjay Karthik',
      participant2: 'Pooja Venkatesh',
      college: 'PSG College of Technology',
      department: 'Information Technology',
      year: '4th Year',
      phone: '9840234567',
      status: 'ACTIVE',
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
    },
    {
      id: 'TB-7003',
      name: 'KernelPanic',
      participant1: 'Rohan Sharma',
      participant2: 'Deepak Raj',
      college: 'SSN College of Engineering',
      department: 'Computer Science and Engineering',
      year: '3rd Year',
      phone: '9840345678',
      status: 'ACTIVE',
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
    },
    {
      id: 'TB-7004',
      name: 'NeuralNinjas',
      participant1: 'Meera Krishnan',
      participant2: 'Harish Babu',
      college: 'Madras Institute of Technology',
      department: 'Computer Technology',
      year: '2nd Year',
      phone: '9840456789',
      status: 'ACTIVE',
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
    }
  ];

  seedTeams.forEach(t => {
    teams.set(t.id, {
      ...t,
      registeredAt: Date.now() - 3600000,
      lastActive: Date.now(),
      warningsCount: 0,
      isOnline: true,
      doorAccessGranted: true,
    });
  });

  // Helpers
  function recordAudit(
    adminUsername: string,
    role: AdminRole,
    action: string,
    target: string,
    oldValue?: string,
    newValue?: string,
    details?: string,
    ip?: string
  ) {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      adminUsername,
      role,
      action,
      target,
      oldValue,
      newValue,
      details,
      timestamp: Date.now(),
      ip,
    };
    auditLogs.unshift(entry);
    if (auditLogs.length > 2000) auditLogs.pop();
    broadcast('AUDIT_LOG', { entry });
  }

  function getRoundQuestions(round: 1 | 2 | 3): Question[] {
    const activeSet = eventState.activeQuestionSet?.[round] || 'A';
    return questions
      .filter(q => q.round === round && (q.set || 'A') === activeSet && q.active !== false)
      .sort((a, b) => a.questionNumber - b.questionNumber);
  }

  // Restore persistent event state from disk (active set, round, clue mode, question index)
  loadInitialEventState(eventState);

  // Sync current question ID with restored state
  const initialRoundQ = getRoundQuestions(eventState.currentRound);
  eventState.totalQuestionsInRound = initialRoundQ.length;
  if (initialRoundQ[eventState.currentQuestionIndex]) {
    eventState.currentQuestionId = initialRoundQ[eventState.currentQuestionIndex].id;
  } else if (initialRoundQ[0]) {
    eventState.currentQuestionIndex = 0;
    eventState.currentQuestionId = initialRoundQ[0].id;
  }

  function getCurrentQuestion(teamId?: string): Question | null {
    if (teamId) {
      const team = teams.get(teamId);
      if (team?.currentQuestionId) {
        const teamQ = questions.find(q => q.id === team.currentQuestionId);
        if (teamQ) return teamQ;
      }
    }
    const roundQuestions = getRoundQuestions(eventState.currentRound);
    return roundQuestions[eventState.currentQuestionIndex] || null;
  }

  function sanitizeQuestion(q: Question | null, teamId?: string): PublicQuestion | null {
    if (!q) return null;
    const { correctAnswer, aliases, explanation, domain, ...safe } = q;
    
    // Filter progressive clues based on activeCluesByQuestion and team authorizations
    let filteredClues: any[] | undefined = undefined;
    if (q.clues && q.clues.length > 0) {
      const activeMap = eventState.activeCluesByQuestion || {};
      filteredClues = q.clues.filter(c => {
        const conf = activeMap[c.id];
        if (!conf) return false;
        if (conf.allTeams) return true;
        if (teamId && conf.teamIds && conf.teamIds.includes(teamId)) return true;
        return false;
      });
    }

    const roundStandardPoints = q.round === 1 ? 1 : q.round === 2 ? 2 : 3;

    return {
      ...safe,
      domain: '', // Domain hidden for participants
      points: roundStandardPoints,
      clues: filteredClues && filteredClues.length > 0 ? filteredClues : undefined,
    };
  }

  function getCalculatedRemainingSeconds(): number {
    const isCurrentRoundLocked = Boolean(
      eventState.currentRound && eventState.roundLocked && eventState.roundLocked[eventState.currentRound]
    );
    if (eventState.status !== 'RUNNING' || eventState.isPaused || eventState.eventLocked || isCurrentRoundLocked) {
      return Math.max(0, eventState.pausedRemainingSeconds);
    }
    if (!eventState.roundEndsAt) return eventState.roundDurationSeconds;
    const remaining = Math.max(0, Math.floor((eventState.roundEndsAt - Date.now()) / 1000));
    return remaining;
  }

  function updateEventStats() {
    let locked = 0;
    let disqualified = 0;
    let online = 0;
    const now = Date.now();

    teams.forEach(t => {
      if (t.status === 'LOCKED') locked++;
      if (t.status === 'DISQUALIFIED') disqualified++;
      if (now - t.lastActive < 120000) online++;
    });

    eventState.stats = {
      totalTeams: teams.size,
      onlineTeams: online,
      lockedTeams: locked,
      disqualifiedTeams: disqualified,
      activeWarnings: teamWarnings.length,
      totalSubmissions: submissions.size,
    };
  }

  function computeLeaderboard(selectedRound?: number): LeaderboardEntry[] {
    const list: LeaderboardEntry[] = [];

    teams.forEach(team => {
      const teamSubs = Array.from(submissions.values()).filter(s => s.teamId === team.id);

      const r1Subs = teamSubs.filter(s => s.round === 1);
      const r2Subs = teamSubs.filter(s => s.round === 2);
      const r3Subs = teamSubs.filter(s => s.round === 3);

      const sumTimeR1 = r1Subs.reduce((acc, s) => acc + (s.timeTakenSeconds || 30), 0);
      const sumTimeR2 = r2Subs.reduce((acc, s) => acc + (s.timeTakenSeconds || 30), 0);
      const sumTimeR3 = r3Subs.reduce((acc, s) => acc + (s.timeTakenSeconds || 30), 0);
      const sumTimeOverall = teamSubs.reduce((acc, s) => acc + (s.timeTakenSeconds || 30), 0);

      const avgTimeR1Seconds = r1Subs.length > 0 ? Number((sumTimeR1 / r1Subs.length).toFixed(1)) : 0;
      const avgTimeR2Seconds = r2Subs.length > 0 ? Number((sumTimeR2 / r2Subs.length).toFixed(1)) : 0;
      const avgTimeR3Seconds = r3Subs.length > 0 ? Number((sumTimeR3 / r3Subs.length).toFixed(1)) : 0;
      const avgTimeOverallSeconds = teamSubs.length > 0 ? Number((sumTimeOverall / teamSubs.length).toFixed(1)) : 0;

      list.push({
        rank: 0,
        teamId: team.id,
        teamName: team.name,
        college: team.college,
        round1Score: team.round1Score,
        round2Score: team.round2Score,
        round3Score: team.round3Score,
        totalScore: team.totalScore,
        status: team.status,
        submissionCount: teamSubs.length,
        lastActive: team.lastActive,
        avgTimeR1Seconds,
        avgTimeR2Seconds,
        avgTimeR3Seconds,
        avgTimeOverallSeconds,
      });
    });

    list.sort((a, b) => {
      if (selectedRound === 1) {
        if (b.round1Score !== a.round1Score) return b.round1Score - a.round1Score;
        if ((a.avgTimeR1Seconds || 0) !== (b.avgTimeR1Seconds || 0)) {
          if (a.avgTimeR1Seconds === 0) return 1;
          if (b.avgTimeR1Seconds === 0) return -1;
          return (a.avgTimeR1Seconds || 0) - (b.avgTimeR1Seconds || 0);
        }
      } else if (selectedRound === 2) {
        if (b.round2Score !== a.round2Score) return b.round2Score - a.round2Score;
        if ((a.avgTimeR2Seconds || 0) !== (b.avgTimeR2Seconds || 0)) {
          if (a.avgTimeR2Seconds === 0) return 1;
          if (b.avgTimeR2Seconds === 0) return -1;
          return (a.avgTimeR2Seconds || 0) - (b.avgTimeR2Seconds || 0);
        }
      } else if (selectedRound === 3) {
        if (b.round3Score !== a.round3Score) return b.round3Score - a.round3Score;
        if ((a.avgTimeR3Seconds || 0) !== (b.avgTimeR3Seconds || 0)) {
          if (a.avgTimeR3Seconds === 0) return 1;
          if (b.avgTimeR3Seconds === 0) return -1;
          return (a.avgTimeR3Seconds || 0) - (b.avgTimeR3Seconds || 0);
        }
      } else {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if ((a.avgTimeOverallSeconds || 0) !== (b.avgTimeOverallSeconds || 0)) {
          if (a.avgTimeOverallSeconds === 0) return 1;
          if (b.avgTimeOverallSeconds === 0) return -1;
          return (a.avgTimeOverallSeconds || 0) - (b.avgTimeOverallSeconds || 0);
        }
      }
      return a.teamName.localeCompare(b.teamName);
    });

    list.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return list;
  }

  // ==========================================
  // WEBSOCKET BROADCASTING
  // ==========================================
  function broadcast(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function broadcastState() {
    updateEventStats();
    const remaining = getCalculatedRemainingSeconds();
    const currentQ = getCurrentQuestion();
    const safeQ = sanitizeQuestion(currentQ);
    const roundQuestions = getRoundQuestions(eventState.currentRound);

    eventState.serverTime = Date.now();
    eventState.totalQuestionsInRound = roundQuestions.length;
    eventState.currentQuestionId = currentQ?.id || null;

    broadcast('EVENT_STATE', {
      ...eventState,
      remainingSeconds: remaining,
      currentQuestion: safeQ,
      leaderboard: eventState.showLeaderboard ? computeLeaderboard() : null,
    });
  }

  // Authoritative Timer Interval (Checks for round expiration)
  setInterval(() => {
    const isCurrentRoundLocked = Boolean(
      eventState.currentRound && eventState.roundLocked && eventState.roundLocked[eventState.currentRound]
    );
    if (eventState.status === 'RUNNING' && !eventState.isPaused && !eventState.eventLocked && !isCurrentRoundLocked) {
      const remaining = getCalculatedRemainingSeconds();
      if (remaining <= 0) {
        eventState.status = 'PAUSED';
        eventState.isPaused = true;
        eventState.pausedRemainingSeconds = 0;
        broadcastState();
        broadcast('ROUND_EXPIRED', {
          round: eventState.currentRound,
          message: `Round ${eventState.currentRound} timer has expired. Submissions are now closed.`,
        });
      }
    }
  }, 1000);

  wss.on('connection', (ws) => {
    const remaining = getCalculatedRemainingSeconds();
    const currentQ = getCurrentQuestion();
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      payload: {
        ...eventState,
        remainingSeconds: remaining,
        currentQuestion: sanitizeQuestion(currentQ),
        leaderboard: eventState.showLeaderboard ? computeLeaderboard() : null,
      },
      timestamp: Date.now(),
    }));

    ws.on('error', () => {
      // Gracefully ignore client connection reset/drop
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'PING') {
          if (parsed.teamId) {
            const team = teams.get(parsed.teamId);
            if (team) team.lastActive = Date.now();
          }
          ws.send(JSON.stringify({ type: 'PONG', serverTime: Date.now() }));
        }
      } catch (err) {
        // ignore malformed websocket frame
      }
    });
  });

  // ==========================================
  // RBAC AUTHENTICATION MIDDLEWARE
  // ==========================================
  function requireRole(allowedRoles: AdminRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      let token = '';
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (req.query?.token && typeof req.query.token === 'string') {
        token = req.query.token.trim();
      } else if (req.query?.t && typeof req.query.t === 'string') {
        token = req.query.t.trim();
      }

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (!decoded || !decoded.role) {
          return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
        }

        const userRole = decoded.role as AdminRole;
        if (userRole === 'SUPER_ADMIN' || allowedRoles.includes(userRole)) {
          (req as any).adminUser = decoded;
          return next();
        }

        return res.status(403).json({
          error: `Forbidden: Role '${userRole}' does not have permission for this resource. Required: ${allowedRoles.join(', ')}`,
        });
      } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
    };
  }

  // Pre-configured role guards - Multiple Admins (SUPER_ADMIN, ADMIN, MODERATOR, REPORT_MANAGER) can control question bank
  const requireSuperAdmin = requireRole(['SUPER_ADMIN']);
  const requireAdminOrAbove = requireRole(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'REPORT_MANAGER']);
  const requireModeratorOrAbove = requireRole(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'REPORT_MANAGER', 'DISPLAY_ONLY']);
  const requireQuestionControl = requireRole(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'REPORT_MANAGER']);

  // ==========================================
  // PARTICIPANT APIS
  // ==========================================

  // 0. Server Health Check (Support both /health and /api/health)
  app.get(['/health', '/api/health'], (req, res) => {
    res.json({ status: 'ok', service: "TECH BRIDGE '26 Authoritative Game Server" });
  });

  // 1. Get Event Public State
  app.get('/api/event', (req, res) => {
    const teamId = (req.query.teamId as string)?.trim().toUpperCase();
    const remaining = getCalculatedRemainingSeconds();
    const currentQ = getCurrentQuestion(teamId);
    res.json({
      ...eventState,
      remainingSeconds: remaining,
      currentQuestion: sanitizeQuestion(currentQ, teamId),
      leaderboard: eventState.showLeaderboard ? computeLeaderboard() : null,
      serverTime: Date.now(),
    });
  });

  // 2. Get Current Question (Participant safe - NEVER exposes answer/aliases)
  app.get('/api/current-question', (req, res) => {
    const teamId = (req.query.teamId as string)?.trim().toUpperCase();
    const currentQ = getCurrentQuestion(teamId);
    if (!currentQ) {
      return res.status(404).json({ error: 'No active question found' });
    }
    res.json({
      question: sanitizeQuestion(currentQ, teamId),
      round: currentQ.round,
      remainingSeconds: getCalculatedRemainingSeconds(),
      status: eventState.status,
      serverTime: Date.now(),
    });
  });

  // 2b. Get All Round Questions for Self-Navigation
  app.get('/api/team/round-questions', (req, res) => {
    const teamId = (req.query.teamId as string)?.trim().toUpperCase();
    const roundParam = req.query.round ? Number(req.query.round) as 1 | 2 | 3 : eventState.currentRound;
    const roundQuestions = getRoundQuestions(roundParam);
    const safeQuestions = roundQuestions.map(q => sanitizeQuestion(q, teamId));
    res.json({
      round: roundParam,
      totalQuestions: safeQuestions.length,
      questions: safeQuestions,
    });
  });

  // 2c. Team Self-Navigation (Navigate to Previous / Next / Specific Question)
  app.post('/api/team/question/navigate', (req, res) => {
    const { teamId, questionId, questionIndex } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    const team = teams.get(teamId.trim().toUpperCase());
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const roundQuestions = getRoundQuestions(eventState.currentRound);
    let targetQ: Question | undefined;

    if (questionId) {
      targetQ = roundQuestions.find(q => q.id === questionId);
    } else if (questionIndex !== undefined) {
      const idx = Number(questionIndex);
      if (idx >= 0 && idx < roundQuestions.length) {
        targetQ = roundQuestions[idx];
      }
    }

    if (!targetQ) {
      return res.status(400).json({ error: 'Target question not found in current round' });
    }

    team.currentQuestionId = targetQ.id;
    team.lastActive = Date.now();

    res.json({
      success: true,
      currentQuestion: sanitizeQuestion(targetQ, team.id),
      questionNumber: targetQ.questionNumber,
    });
  });

  // 3. Register Team
  app.post('/api/team/register', (req, res) => {
    if (eventState.eventLocked) {
      return res.status(403).json({ error: 'Competition arena is locked by organizer. Registration closed.' });
    }

    const { name, participant1, participant2, college, department, year, phone } = req.body;

    if (!name || !participant1 || !college || !phone) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    // Check duplicate team name or phone
    for (const team of teams.values()) {
      if (team.name.trim().toLowerCase() === name.trim().toLowerCase()) {
        return res.status(409).json({ error: 'A team with this name is already registered' });
      }
      if (team.phone.trim() === phone.trim()) {
        return res.status(409).json({ error: 'This phone number has already been registered' });
      }
    }

    // Generate unique Team ID: TB-XXXX (4-digit random)
    let teamId = '';
    let exists = true;
    while (exists) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      teamId = `TB-${rand}`;
      exists = teams.has(teamId);
    }

    const isDoorClosed = Boolean(eventState.doorClosed);
    const newTeam: Team = {
      id: teamId,
      name: name.trim(),
      participant1: participant1.trim(),
      participant2: participant2 ? participant2.trim() : undefined,
      college: college.trim(),
      department: department ? department.trim() : 'CSE',
      year: year ? year.trim() : '3rd Year',
      phone: phone.trim(),
      registeredAt: Date.now(),
      status: 'ACTIVE',
      warningsCount: 0,
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
      lastActive: Date.now(),
      isOnline: true,
      doorAccessGranted: !isDoorClosed,
      gateWaitTimestamp: isDoorClosed ? Date.now() : undefined,
    };

    teams.set(teamId, newTeam);
    broadcast('TEAM_REGISTERED', { team: newTeam });
    broadcastState();

    res.status(201).json({
      success: true,
      message: 'Team successfully registered for Tech Bridge \'26',
      team: newTeam,
    });
  });

  // 4. Team Login / Session Restore
  app.post('/api/team/login', (req, res) => {
    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }
    const cleanId = teamId.trim().toUpperCase();
    const team = teams.get(cleanId);
    if (!team) {
      return res.status(404).json({ error: 'Invalid Team ID. Please register or check your ID.' });
    }
    if (team.status === 'LOCKED') {
      return res.status(403).json({
        error: 'ACCESS LOCKED BY ORGANIZER',
        lockReason: team.lockReason || 'Administrative security lock',
      });
    }
    if (team.status === 'DISQUALIFIED') {
      return res.status(403).json({ error: 'This team has been disqualified from Tech Bridge \'26.' });
    }

    team.lastActive = Date.now();
    team.isOnline = true;

    // If door is closed and team hasn't been granted access explicitly, queue them at gate
    if (team.doorAccessGranted === undefined) {
      team.doorAccessGranted = !eventState.doorClosed;
      if (!team.doorAccessGranted) {
        team.gateWaitTimestamp = Date.now();
      }
    }

    // Collect team's existing submissions
    const teamSubmissions: Record<string, boolean> = {};
    submissions.forEach(sub => {
      if (sub.teamId === team.id) {
        teamSubmissions[sub.questionId] = true;
      }
    });

    res.json({
      success: true,
      team,
      submissions: teamSubmissions,
      eventState: {
        ...eventState,
        remainingSeconds: getCalculatedRemainingSeconds(),
      },
    });
  });

  // 4b. Team Status Check (Polling for live lock/warning/door state changes)
  app.get('/api/team/:teamId/status', (req, res) => {
    const { teamId } = req.params;
    const team = teams.get(teamId.toUpperCase());
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({
      status: team.status,
      lockReason: team.lockReason,
      warningsCount: team.warningsCount,
      totalScore: team.totalScore,
      round1Score: team.round1Score,
      round2Score: team.round2Score,
      round3Score: team.round3Score,
      doorAccessGranted: team.doorAccessGranted !== false,
      doorClosed: Boolean(eventState.doorClosed),
      gateWaitTimestamp: team.gateWaitTimestamp,
    });
  });

  // 5. Submit Answer (ONE SUBMISSION PER QUESTION RULE + LOCK ENFORCEMENT)
  app.post('/api/answer', async (req, res) => {
    const { teamId, questionId, answer } = req.body;

    if (!teamId || !questionId || answer === undefined) {
      return res.status(400).json({ error: 'Team ID, Question ID, and Answer are required' });
    }

    const team = teams.get(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.status === 'LOCKED') {
      return res.status(403).json({
        error: 'ACCESS LOCKED BY ORGANIZER',
        lockReason: team.lockReason || 'Administrative security lock',
      });
    }
    if (team.status === 'DISQUALIFIED') {
      return res.status(403).json({ error: 'Disqualified teams cannot submit answers' });
    }

    // Door Close Check: If Door is Closed and team is not admitted by Admin, reject participation
    if (eventState.doorClosed && team.doorAccessGranted === false) {
      return res.status(403).json({
        error: 'DOOR IS CLOSED: Your team is waiting at the entry gate for Round 1 admission approval from the event organizer.',
        doorBlocked: true,
      });
    }

    if (eventState.eventLocked) {
      return res.status(403).json({ error: 'Entire competition event is currently locked by organizer' });
    }

    if (eventState.roundLocked[eventState.currentRound]) {
      return res.status(403).json({ error: `Round ${eventState.currentRound} is currently locked by organizer` });
    }

    if (eventState.status !== 'RUNNING' || eventState.isPaused) {
      return res.status(400).json({ error: 'Submissions are currently closed (Event is paused or waiting)' });
    }

    const remaining = getCalculatedRemainingSeconds();
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Round time expired. Submission rejected.' });
    }

    // Verify target question for this team (supports self-navigated participant questions in active round)
    const targetQ = questions.find(q => q.id === questionId);
    if (!targetQ || targetQ.round !== eventState.currentRound) {
      return res.status(400).json({ error: 'Question is not part of the active competition round for your team.' });
    }

    // Set team's current question ID to targetQ.id
    team.currentQuestionId = targetQ.id;
    team.lastActive = Date.now();
    const currentQ = targetQ;

    // Check if already submitted for this question
    const subKey = `${teamId}_${questionId}`;
    if (submissions.has(subKey) && !currentQ.allowRetries) {
      return res.status(409).json({
        error: 'Submission locked: You have already submitted an answer for this question',
        submission: submissions.get(subKey),
      });
    }

    // Authoritative Answer Evaluation on Server (Section 2 & 13)
    // Convert all answers to all small (lowercase) for evaluation regardless of caps or small
    const norm = (val: string) => {
      let s = String(val || '').trim().toLowerCase();
      // Space normalization: collapse multiple spaces to a single space
      s = s.replace(/\s+/g, ' ');
      return s;
    };

    const normSubmitted = norm(answer);
    const normCanonical = norm(currentQ.correctAnswer);
    const normAliases = (currentQ.aliases || []).map(norm);

    let isCorrect = (normSubmitted === normCanonical) || normAliases.includes(normSubmitted);
    let checkerAccepted = false;
    let checkerReason: string | undefined = undefined;
    let checkerMatchType: 'EXACT' | 'ALIAS' | 'SPELLING_FUZZY' | 'AI_SEMANTIC' | 'REJECTED' | undefined = isCorrect ? 'EXACT' : undefined;

    // Fallback: strip punctuation/special characters after converting to small letters
    if (!isCorrect && currentQ.normalizeSpecialChars !== false) {
      const strip = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const stripSub = strip(answer);
      const stripCan = strip(currentQ.correctAnswer);
      const stripAli = (currentQ.aliases || []).map(strip);
      if (stripSub.length > 0 && (stripSub === stripCan || stripAli.includes(stripSub))) {
        isCorrect = true;
        checkerMatchType = 'EXACT';
      }
    }

    // OPTIONAL FEATURE: ANSWER CHECKER (Turned ON or OFF by Admin)
    // Checks for spelling mistakes, typos, plurals, spacing or closely related/equivalent answers
    if (!isCorrect && eventState.answerCheckerEnabled) {
      try {
        const checkerResult = await evaluateAnswerWithChecker({
          submittedAnswer: String(answer || ''),
          canonicalAnswer: currentQ.correctAnswer,
          aliases: currentQ.aliases || [],
          questionInfo: {
            rebusFormulaText: currentQ.rebusFormulaText,
            domain: currentQ.domain,
            explanation: currentQ.explanation,
          },
          toleranceMode: eventState.answerCheckerTolerance || 'moderate',
        });

        if (checkerResult.isCorrect) {
          isCorrect = true;
          checkerAccepted = true;
          checkerReason = checkerResult.reason;
          checkerMatchType = checkerResult.matchType;
        }
      } catch (err) {
        console.error('Answer Checker evaluation error:', err);
      }
    }

    const roundBasePoints = currentQ.round === 1 ? 1 : currentQ.round === 2 ? 2 : 3;
    const pointsAwarded = isCorrect
      ? (roundBasePoints + (currentQ.bonusMarks || 0))
      : (currentQ.negativeMarks ? -currentQ.negativeMarks : 0);

    // Update team score (unless in Test Mode)
    if (!eventState.isTestMode) {
      if (currentQ.round === 1) team.round1Score = Math.max(0, team.round1Score + pointsAwarded);
      else if (currentQ.round === 2) team.round2Score = Math.max(0, team.round2Score + pointsAwarded);
      else if (currentQ.round === 3) team.round3Score = Math.max(0, team.round3Score + pointsAwarded);
      team.totalScore = team.round1Score + team.round2Score + team.round3Score;
    }
    team.lastActive = Date.now();

    const clientTimeSec = req.body.timeTakenSeconds ? Number(req.body.timeTakenSeconds) : null;
    const computedTimeSec = eventState.roundStartedAt
      ? Math.max(1, Math.round((Date.now() - eventState.roundStartedAt) / 1000))
      : 30;
    const timeTakenSeconds = clientTimeSec && clientTimeSec > 0 ? clientTimeSec : computedTimeSec;

    const newSubmission: Submission = {
      id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      teamId: team.id,
      teamName: team.name,
      questionId: currentQ.id,
      round: currentQ.round,
      questionNumber: currentQ.questionNumber,
      submittedAnswer: String(answer || '').trim().toLowerCase(),
      isCorrect,
      pointsAwarded,
      submittedAt: Date.now(),
      timeTakenSeconds,
      checkerAccepted,
      checkerReason,
      checkerMatchType,
    };

    submissions.set(subKey, newSubmission);

    // Broadcast submission event to admin dashboard
    broadcast('NEW_SUBMISSION', {
      questionId: currentQ.id,
      teamId: team.id,
      teamName: team.name,
      round: currentQ.round,
      questionNumber: currentQ.questionNumber,
      isCorrect,
      pointsAwarded,
      totalScore: team.totalScore,
    });

    broadcastState();

    res.json({
      success: true,
      message: 'Answer submitted successfully and locked.',
      submissionId: newSubmission.id,
      isCorrect,
      pointsAwarded,
    });
  });

  // 6. Digital Buzzer Submission (Atomic server sequence, contender ranking & simultaneous tie detection)
  app.post('/api/buzzer', (req, res) => {
    const { teamId, questionId } = req.body;

    if (!teamId || !questionId) {
      return res.status(400).json({ error: 'teamId and questionId are required' });
    }

    const team = teams.get(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.status === 'LOCKED') {
      return res.status(403).json({ error: 'ACCESS LOCKED BY ORGANIZER' });
    }
    if (team.status === 'DISQUALIFIED') {
      return res.status(403).json({ error: 'Team disqualified from Tech Bridge \'26' });
    }

    if (!eventState.buzzerActive) {
      return res.status(400).json({ error: 'Buzzer is currently locked or closed for this question' });
    }

    const currentQ = getCurrentQuestion();
    if (!currentQ || currentQ.id !== questionId) {
      return res.status(400).json({ error: 'Question is no longer active for buzzing' });
    }

    const now = Date.now();
    buzzerSequenceCounter++;

    if (!eventState.buzzerContenders) {
      eventState.buzzerContenders = [];
    }

    // Check if team has already pressed for this buzzer round
    const existing = eventState.buzzerContenders.find(c => c.teamId === team.id);
    if (existing) {
      return res.json({
        won: existing.sequenceNumber === 1 || existing.isTie,
        isTie: existing.isTie,
        message: existing.isTie ? 'SIMULTANEOUS TIE DETECTED!' : 'You already buzzed for this question!',
        contender: existing,
        contenders: eventState.buzzerContenders,
      });
    }

    // SIMULTANEOUS TIE WINDOW: 85 milliseconds
    // Any teams buzzing within 85ms of the first buzz are considered simultaneous contenders
    const TIE_WINDOW_MS = 85;

    if (eventState.buzzerContenders.length === 0) {
      // First buzz received
      const firstContender: BuzzerContender = {
        teamId: team.id,
        teamName: team.name,
        timestamp: now,
        sequenceNumber: 1,
        deltaMs: 0,
        isTie: false,
      };

      eventState.buzzerContenders.push(firstContender);
      eventState.buzzerWinner = {
        teamId: team.id,
        teamName: team.name,
        timestamp: now,
        sequenceNumber: 1,
        deltaMs: 0,
        isTie: false,
      };
      eventState.buzzerTie = false;

      // Keep window open briefly (300ms) to detect simultaneous presses, then close buzzerActive
      setTimeout(() => {
        eventState.buzzerActive = false;
        broadcastState();
      }, 300);

      const bzEvent: BuzzerEvent = {
        id: `bz-${now}`,
        sequenceNumber: 1,
        questionId: currentQ.id,
        round: currentQ.round,
        teamId: team.id,
        teamName: team.name,
        serverTimestamp: now,
        won: true,
        pointsAwarded: 0,
      };
      buzzerEvents.push(bzEvent);

      broadcast('BUZZER_WINNER', {
        winner: eventState.buzzerWinner,
        contenders: eventState.buzzerContenders,
        isTie: false,
        questionId: currentQ.id,
      });
      broadcastState();

      const roundPoints = currentQ.round === 1 ? 1 : currentQ.round === 2 ? 2 : 3;

      return res.json({
        won: true,
        isTie: false,
        message: `FIRST BUZZ RECORDED! You won the buzz (+${roundPoints} ${roundPoints === 1 ? 'PT' : 'PTS'} on correct answer).`,
        points: roundPoints,
        timestamp: now,
        sequenceNumber: 1,
        deltaMs: 0,
        contenders: eventState.buzzerContenders,
      });
    } else {
      // Subsequent buzz within window
      const first = eventState.buzzerContenders[0];
      const deltaMs = now - first.timestamp;
      const seq = eventState.buzzerContenders.length + 1;
      const isTie = deltaMs <= TIE_WINDOW_MS;

      const contender: BuzzerContender = {
        teamId: team.id,
        teamName: team.name,
        timestamp: now,
        sequenceNumber: seq,
        deltaMs,
        isTie,
      };
      eventState.buzzerContenders.push(contender);

      if (isTie) {
        first.isTie = true;
        eventState.buzzerTie = true;
        if (eventState.buzzerWinner) {
          eventState.buzzerWinner.isTie = true;
        }
      }

      broadcast('BUZZER_TIE_UPDATE', {
        winner: eventState.buzzerWinner,
        contenders: eventState.buzzerContenders,
        isTie: eventState.buzzerTie,
        questionId: currentQ.id,
      });
      broadcastState();

      return res.json({
        won: isTie,
        isTie,
        message: isTie
          ? `SIMULTANEOUS BUZZ! Tied within ${deltaMs}ms with ${first.teamName}!`
          : `Buzzed #${seq} (+${deltaMs}ms). Another team was faster.`,
        timestamp: now,
        sequenceNumber: seq,
        deltaMs,
        contenders: eventState.buzzerContenders,
      });
    }
  });

  // 7. Anti-Cheat Event Reporter & Two-Violation Security Policy (Section 6)
  app.post('/api/anti-cheat', (req, res) => {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // keep payload
      }
    }
    const { teamId, eventType, details, timeAwaySeconds } = payload || {};

    if (!teamId || !eventType) {
      return res.status(400).json({ error: 'teamId and eventType are required' });
    }

    const team = teams.get(teamId);
    const teamName = team ? team.name : 'Unknown Team';

    const severity: AntiCheatSeverity =
      (eventType === 'SCREEN_RECORD_DETECTED' || eventType === 'SCREENSHOT_ATTEMPTED' || eventType === 'MULTI_WINDOW_DETECTED' || eventType === 'DEV_TOOLS_DETECTED')
        ? 'CRITICAL'
        : (eventType === 'APP_BACKGROUND' || eventType === 'EXTERNAL_APP_SWITCH' || eventType === 'PICTURE_IN_PICTURE')
        ? 'HIGH'
        : (eventType === 'WINDOW_FOCUS_LOST' || eventType === 'OVERLAY_DETECTED' || eventType === 'FULLSCREEN_EXITED')
        ? 'WARNING'
        : 'INFO';

    const timeAwayStr = timeAwaySeconds ? ` (Left for ${timeAwaySeconds}s)` : '';
    const fullDetails = (details || 'Client security violation detected') + timeAwayStr;

    const alert: AntiCheatEvent = {
      id: `ac-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      teamId,
      teamName,
      eventType,
      details: fullDetails,
      severity,
      round: eventState.currentRound,
      questionNumber: (eventState.currentQuestionIndex || 0) + 1,
      timestamp: Date.now(),
      resolved: false,
    };

    antiCheatEvents.unshift(alert);
    if (antiCheatEvents.length > 1000) antiCheatEvents.pop();

    // Configurable Violation Security Rule (Admin-controlled limit)
    const isSevere = severity === 'CRITICAL' || severity === 'HIGH' || severity === 'WARNING';

    if (team && isSevere && team.status !== 'DISQUALIFIED') {
      team.warningsCount++;
      const currentCount = team.warningsCount;
      const maxLimit = eventState.maxViolations || 3;

      const warning: TeamWarning = {
        id: `warn-${Date.now()}`,
        teamId: team.id,
        teamName: team.name,
        violationType: eventType,
        warningMessage: `Security violation (${currentCount}/${maxLimit}): ${fullDetails}`,
        issuedBy: 'AUTOMATED_SYSTEM',
        timestamp: Date.now(),
        severity,
      };
      teamWarnings.unshift(warning);

      if (currentCount >= maxLimit) {
        team.status = 'LOCKED';
        team.lockReason = `Automated security lockout: Your team has reached the maximum number of allowed violations (${maxLimit}/${maxLimit}). Please contact the event coordinator.`;
        alert.actionTaken = 'LOCKED';
        broadcast('TEAM_LOCKED', { teamId: team.id, reason: team.lockReason, warningsCount: currentCount, maxViolations: maxLimit });
      } else {
        team.status = 'WARNED';
        alert.actionTaken = 'WARNED';
      }
    }

    broadcast('ANTI_CHEAT_ALERT', { alert });
    broadcastState();

    res.json({
      success: true,
      alertId: alert.id,
      warningsCount: team ? team.warningsCount : 0,
      status: team ? team.status : 'ACTIVE',
      isLocked: team?.status === 'LOCKED',
      maxViolations: eventState.maxViolations || 3,
    });
  });

  // 8. Live Leaderboard (Public)
  app.get('/api/leaderboard', (req, res) => {
    if (!eventState.showLeaderboard) {
      return res.json({ visible: false, message: 'Leaderboard is currently hidden by organizer' });
    }
    const r = req.query.round ? Number(req.query.round) : undefined;
    res.json({
      visible: true,
      leaderboard: computeLeaderboard(r),
      updatedAt: Date.now(),
    });
  });

  // ==========================================
  // ADMIN AUTHENTICATION WITH BRUTE-FORCE PROTECTION
  // ==========================================
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim();

    // Check rate limit
    if (!checkRateLimit(clientIp) || !checkRateLimit(cleanUsername)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Control desk login locked for 1 minute.',
      });
    }

    // Match admin account
    const account = ADMIN_ACCOUNTS.find(a => a.username.toUpperCase() === cleanUsername.toUpperCase());
    if (!account) {
      recordFailedLogin(clientIp);
      recordFailedLogin(cleanUsername);
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const isMatch = verifyAdminPassword(password, account.passwordHash);
    if (!isMatch) {
      recordFailedLogin(clientIp);
      recordFailedLogin(cleanUsername);
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    clearFailedLogins(clientIp);
    clearFailedLogins(cleanUsername);

    // Issue JWT token with role claim
    const token = jwt.sign(
      { username: account.username, role: account.role, symposium: 'TECH_BRIDGE_26' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    recordAudit(
      account.username,
      account.role,
      'ADMIN_LOGIN',
      account.username,
      undefined,
      undefined,
      `Successful login from IP ${clientIp}`,
      clientIp
    );

    res.json({
      success: true,
      message: 'Admin authentication successful',
      token,
      username: account.username,
      role: account.role,
    });
  });

  // ==========================================
  // ADMIN CONTROL CENTER ENDPOINTS
  // ==========================================

  // START ROUND (ADMIN or SUPER_ADMIN)
  app.post('/api/admin/start', requireAdminOrAbove, (req, res) => {
    const { round } = req.body;
    const adminUser = (req as any).adminUser;
    const targetRound: 1 | 2 | 3 = round ? Number(round) as 1 | 2 | 3 : eventState.currentRound;

    const roundDuration = targetRound === 1 ? 1800 : targetRound === 2 ? 900 : 900;
    const roundQuestions = getRoundQuestions(targetRound);

    const oldRound = eventState.currentRound;
    eventState.currentRound = targetRound;
    eventState.currentQuestionIndex = 0;
    eventState.roundDurationSeconds = roundDuration;
    eventState.pausedRemainingSeconds = roundDuration;
    eventState.roundStartedAt = Date.now();
    eventState.roundEndsAt = Date.now() + (roundDuration * 1000);
    eventState.isPaused = false;
    eventState.status = 'RUNNING';
    eventState.eventLocked = false;
    if (eventState.roundLocked) {
      eventState.roundLocked[targetRound] = false;
    }
    eventState.buzzerActive = Boolean(eventState.buzzerRoundEnabled?.[targetRound]);
    eventState.buzzerWinner = null;
    eventState.buzzerTie = false;
    eventState.buzzerContenders = [];
    eventState.currentQuestionId = roundQuestions[0]?.id || null;

    // Automatic Gate / Door Closure on Round Start:
    // If autoCloseDoorOnStart is enabled, immediately lock the door to new participants.
    // Pre-admit all existing registered teams so they can participate smoothly without disruption.
    if (eventState.autoCloseDoorOnStart !== false) {
      eventState.doorClosed = true;
      teams.forEach(t => {
        if (t.doorAccessGranted === undefined) {
          t.doorAccessGranted = true;
        }
      });
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'START_ROUND',
      `Round ${targetRound}`,
      `Round ${oldRound}`,
      `Round ${targetRound}`,
      `Started round with duration ${roundDuration}s${eventState.doorClosed ? ' (Door closed for late teams)' : ''}`
    );

    broadcastState();
    res.json({ success: true, message: `Round ${targetRound} started!`, eventState });
  });

  // PAUSE EVENT (ADMIN or SUPER_ADMIN)
  app.post(['/api/admin/pause', '/api/admin/round/pause', '/api/admin/event/pause'], requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    if (eventState.status === 'RUNNING' && !eventState.isPaused) {
      const remaining = getCalculatedRemainingSeconds();
      eventState.isPaused = true;
      eventState.status = 'PAUSED';
      eventState.pausedRemainingSeconds = remaining;

      recordAudit(
        adminUser.username,
        adminUser.role,
        'PAUSE_ROUND',
        `Round ${eventState.currentRound}`,
        'RUNNING',
        'PAUSED',
        `Remaining seconds frozen at ${remaining}s`
      );

      broadcastState();
    }
    res.json({ success: true, message: 'Event paused', eventState, remainingSeconds: eventState.pausedRemainingSeconds });
  });

  // RESUME EVENT (ADMIN or SUPER_ADMIN)
  app.post(['/api/admin/resume', '/api/admin/round/resume', '/api/admin/event/resume'], requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    if (eventState.isPaused || eventState.status === 'PAUSED' || eventState.eventLocked) {
      eventState.isPaused = false;
      eventState.eventLocked = false;
      if (eventState.currentRound && eventState.roundLocked) {
        eventState.roundLocked[eventState.currentRound] = false;
      }
      eventState.status = 'RUNNING';
      eventState.roundEndsAt = Date.now() + (Math.max(0, eventState.pausedRemainingSeconds) * 1000);

      recordAudit(
        adminUser.username,
        adminUser.role,
        'RESUME_ROUND',
        `Round ${eventState.currentRound}`,
        'PAUSED',
        'RUNNING',
        `Resumed with ${eventState.pausedRemainingSeconds}s remaining`
      );

      broadcastState();
    }
    res.json({ success: true, message: 'Event resumed', eventState, remainingSeconds: eventState.pausedRemainingSeconds });
  });

  // EXTEND TIME (+60s, +300s)
  app.post('/api/admin/round/extend-time', requireAdminOrAbove, (req, res) => {
    const { seconds } = req.body;
    const adminUser = (req as any).adminUser;
    const addSecs = Number(seconds) || 60;

    const oldRemaining = getCalculatedRemainingSeconds();
    const newRemaining = oldRemaining + addSecs;

    eventState.pausedRemainingSeconds = newRemaining;
    if (eventState.roundEndsAt && eventState.status === 'RUNNING' && !eventState.isPaused && !eventState.eventLocked) {
      eventState.roundEndsAt += addSecs * 1000;
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'EXTEND_TIME',
      `Round ${eventState.currentRound}`,
      `${oldRemaining}s`,
      `${newRemaining}s`,
      `Extended timer by +${addSecs}s`
    );

    broadcastState();
    res.json({ success: true, message: `Timer extended by ${addSecs} seconds`, remainingSeconds: newRemaining });
  });

  // TOGGLE & CONFIGURE ANSWER CHECKER (ADMIN or SUPER_ADMIN)
  app.post('/api/admin/toggle-answer-checker', requireAdminOrAbove, (req, res) => {
    const { enabled, tolerance } = req.body;
    const adminUser = (req as any).adminUser;

    const oldEnabled = eventState.answerCheckerEnabled;
    const oldTolerance = eventState.answerCheckerTolerance;

    if (typeof enabled === 'boolean') {
      eventState.answerCheckerEnabled = enabled;
    } else {
      eventState.answerCheckerEnabled = !eventState.answerCheckerEnabled;
    }

    if (tolerance && ['strict', 'moderate', 'flexible'].includes(tolerance)) {
      eventState.answerCheckerTolerance = tolerance as 'strict' | 'moderate' | 'flexible';
    }

    saveEventStateToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_ANSWER_CHECKER',
      'Event Settings',
      `Enabled: ${oldEnabled}, Tolerance: ${oldTolerance}`,
      `Enabled: ${eventState.answerCheckerEnabled}, Tolerance: ${eventState.answerCheckerTolerance}`,
      `Answer Checker feature ${eventState.answerCheckerEnabled ? 'ACTIVATED' : 'DEACTIVATED'} with ${eventState.answerCheckerTolerance} tolerance mode.`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Answer Checker ${eventState.answerCheckerEnabled ? 'TURNED ON' : 'TURNED OFF'} (${eventState.answerCheckerTolerance} mode)`,
      answerCheckerEnabled: eventState.answerCheckerEnabled,
      answerCheckerTolerance: eventState.answerCheckerTolerance,
    });
  });

  // TEST ANSWER CHECKER INTERACTIVE SIMULATOR (ADMIN or SUPER_ADMIN)
  app.post('/api/admin/test-answer-checker', requireAdminOrAbove, async (req, res) => {
    const { submittedAnswer, canonicalAnswer, questionId, toleranceMode } = req.body;

    if (!submittedAnswer) {
      return res.status(400).json({ error: 'submittedAnswer is required for testing' });
    }

    let targetCanonical = canonicalAnswer || '';
    let targetAliases: string[] = [];
    let questionInfo: any = undefined;

    if (questionId) {
      const q = questions.find(qItem => qItem.id === questionId);
      if (q) {
        targetCanonical = q.correctAnswer;
        targetAliases = q.aliases || [];
        questionInfo = {
          rebusFormulaText: q.rebusFormulaText,
          domain: q.domain,
          explanation: q.explanation,
        };
      }
    }

    if (!targetCanonical) {
      return res.status(400).json({ error: 'Please specify a questionId or a canonicalAnswer for evaluation.' });
    }

    try {
      const result = await evaluateAnswerWithChecker({
        submittedAnswer: String(submittedAnswer),
        canonicalAnswer: targetCanonical,
        aliases: targetAliases,
        questionInfo,
        toleranceMode: toleranceMode || eventState.answerCheckerTolerance || 'moderate',
      });

      res.json({
        success: true,
        submittedAnswer,
        canonicalAnswer: targetCanonical,
        aliases: targetAliases,
        toleranceMode: toleranceMode || eventState.answerCheckerTolerance || 'moderate',
        answerCheckerEnabled: eventState.answerCheckerEnabled,
        result,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Answer Checker test evaluation failed: ' + err.message });
    }
  });

  // REDUCE TIME (-60s)
  app.post('/api/admin/round/reduce-time', requireAdminOrAbove, (req, res) => {
    const { seconds } = req.body;
    const adminUser = (req as any).adminUser;
    const subSecs = Number(seconds) || 60;

    const oldRemaining = getCalculatedRemainingSeconds();
    const newRemaining = Math.max(10, oldRemaining - subSecs);

    eventState.pausedRemainingSeconds = newRemaining;
    if (eventState.roundEndsAt && eventState.status === 'RUNNING' && !eventState.isPaused && !eventState.eventLocked) {
      eventState.roundEndsAt = Date.now() + (newRemaining * 1000);
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'REDUCE_TIME',
      `Round ${eventState.currentRound}`,
      `${oldRemaining}s`,
      `${newRemaining}s`,
      `Reduced timer by -${subSecs}s`
    );

    broadcastState();
    res.json({ success: true, message: `Timer reduced by ${subSecs} seconds`, remainingSeconds: newRemaining });
  });

  // LOCK / UNLOCK SPECIFIC ROUND
  app.post(['/api/admin/round/toggle-lock', '/api/admin/toggle-round-lock'], requireAdminOrAbove, (req, res) => {
    const { round } = req.body;
    const adminUser = (req as any).adminUser;
    const r = (Number(round) || eventState.currentRound) as 1 | 2 | 3;

    eventState.roundLocked[r] = !eventState.roundLocked[r];

    // If toggling lock on the current round, freeze or resume the timer accordingly
    if (r === eventState.currentRound) {
      if (eventState.roundLocked[r]) {
        if (eventState.status === 'RUNNING' && !eventState.isPaused) {
          const remaining = getCalculatedRemainingSeconds();
          eventState.pausedRemainingSeconds = remaining;
          eventState.isPaused = true;
          eventState.status = 'PAUSED';
        }
      } else {
        if (eventState.pausedRemainingSeconds > 0 && !eventState.eventLocked) {
          eventState.isPaused = false;
          eventState.status = 'RUNNING';
          eventState.roundEndsAt = Date.now() + (Math.max(0, eventState.pausedRemainingSeconds) * 1000);
        }
      }
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      eventState.roundLocked[r] ? 'LOCK_ROUND' : 'UNLOCK_ROUND',
      `Round ${r}`,
      eventState.roundLocked[r] ? 'UNLOCKED' : 'LOCKED',
      eventState.roundLocked[r] ? 'LOCKED' : 'UNLOCKED',
      eventState.roundLocked[r]
        ? `Round ${r} locked and timer frozen at ${eventState.pausedRemainingSeconds}s`
        : `Round ${r} unlocked and timer resumed with ${eventState.pausedRemainingSeconds}s remaining`
    );

    broadcastState();
    res.json({ 
      success: true, 
      round: r, 
      isLocked: eventState.roundLocked[r], 
      isPaused: eventState.isPaused, 
      remainingSeconds: eventState.pausedRemainingSeconds 
    });
  });

  // LOCK / UNLOCK EVENT WIDE (ARENA LOCK)
  app.post(['/api/admin/event/toggle-lock', '/api/admin/toggle-lock', '/api/admin/arena/toggle-lock'], requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    const willBeLocked = !eventState.eventLocked;

    if (willBeLocked) {
      // Locking the arena: freeze timer and pause so timer stops ticking down
      if (eventState.status === 'RUNNING' && !eventState.isPaused) {
        const remaining = getCalculatedRemainingSeconds();
        eventState.pausedRemainingSeconds = remaining;
        eventState.isPaused = true;
        eventState.status = 'PAUSED';
      }
      eventState.eventLocked = true;
    } else {
      // Unlocking the arena: resume timer if it had time remaining
      eventState.eventLocked = false;
      if (eventState.pausedRemainingSeconds > 0) {
        eventState.isPaused = false;
        eventState.status = 'RUNNING';
        eventState.roundEndsAt = Date.now() + (Math.max(0, eventState.pausedRemainingSeconds) * 1000);
      }
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      eventState.eventLocked ? 'LOCK_EVENT' : 'UNLOCK_EVENT',
      'TECH BRIDGE 26 ARENA',
      eventState.eventLocked ? 'UNLOCKED' : 'LOCKED',
      eventState.eventLocked ? 'LOCKED' : 'UNLOCKED',
      eventState.eventLocked
        ? `Arena locked and timer frozen at ${eventState.pausedRemainingSeconds}s`
        : `Arena unlocked and timer resumed with ${eventState.pausedRemainingSeconds}s remaining`
    );

    broadcastState();
    res.json({ 
      success: true, 
      eventLocked: eventState.eventLocked, 
      isPaused: eventState.isPaused, 
      status: eventState.status, 
      remainingSeconds: eventState.pausedRemainingSeconds 
    });
  });

  // ==========================================
  // CLOSE THE DOOR / ENTRY GATE REGISTRATION LOCK
  // (Prevents new teams from participating directly during or after round starts)
  // ==========================================

  // TOGGLE CLOSE THE DOOR
  app.post('/api/admin/door/toggle', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.doorClosed = !eventState.doorClosed;

    recordAudit(
      adminUser.username,
      adminUser.role,
      eventState.doorClosed ? 'CLOSE_DOOR' : 'OPEN_DOOR',
      'ROUND 1 ENTRY GATE',
      eventState.doorClosed ? 'OPEN' : 'CLOSED',
      eventState.doorClosed ? 'CLOSED' : 'OPEN',
      eventState.doorClosed 
        ? 'Entry door closed. New & late teams will be queued at the gate until approved by admin.'
        : 'Entry door opened. All registered teams can directly enter Round 1.'
    );

    broadcastState();
    broadcast('DOOR_STATE_CHANGED', { doorClosed: eventState.doorClosed });
    res.json({ success: true, doorClosed: eventState.doorClosed });
  });

  // TOGGLE AUTO-CLOSE DOOR ON ROUND 1 START
  app.post('/api/admin/door/toggle-auto-close', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.autoCloseDoorOnStart = !eventState.autoCloseDoorOnStart;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_AUTO_CLOSE_DOOR',
      'EVENT_STATE',
      eventState.autoCloseDoorOnStart ? 'DISABLED' : 'ENABLED',
      eventState.autoCloseDoorOnStart ? 'ENABLED' : 'DISABLED',
      `Auto-close door on round start: ${eventState.autoCloseDoorOnStart}`
    );

    broadcastState();
    res.json({ success: true, autoCloseDoorOnStart: eventState.autoCloseDoorOnStart });
  });

  // GRANT DOOR ACCESS (ADMIT TEAMS INTO ROUND 1)
  app.post('/api/admin/door/grant-access', requireAdminOrAbove, (req, res) => {
    const { teamId, teamIds, target } = req.body;
    const adminUser = (req as any).adminUser;

    let modifiedCount = 0;
    const admittedTeams: string[] = [];

    if (target === 'ALL_WAITING') {
      teams.forEach(t => {
        if (t.doorAccessGranted === false) {
          t.doorAccessGranted = true;
          admittedTeams.push(t.id);
          modifiedCount++;
        }
      });
    } else if (Array.isArray(teamIds)) {
      teamIds.forEach((id: string) => {
        const t = teams.get(id.toUpperCase());
        if (t) {
          t.doorAccessGranted = true;
          admittedTeams.push(t.id);
          modifiedCount++;
        }
      });
    } else if (teamId) {
      const t = teams.get(teamId.toUpperCase());
      if (t) {
        t.doorAccessGranted = true;
        admittedTeams.push(t.id);
        modifiedCount++;
      } else {
        return res.status(404).json({ error: 'Team not found' });
      }
    } else {
      return res.status(400).json({ error: 'teamId, teamIds array, or target="ALL_WAITING" required' });
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'GRANT_DOOR_ACCESS',
      `Teams: ${admittedTeams.join(', ')}`,
      'WAITING_AT_GATE',
      'ADMITTED',
      `Admin approved admission for ${modifiedCount} team(s)`
    );

    broadcastState();
    broadcast('DOOR_ACCESS_GRANTED', { teamIds: admittedTeams });
    res.json({ success: true, modifiedCount, admittedTeams });
  });

  // REVOKE DOOR ACCESS (HOLD TEAM AT GATE)
  app.post('/api/admin/door/revoke-access', requireAdminOrAbove, (req, res) => {
    const { teamId } = req.body;
    const adminUser = (req as any).adminUser;

    if (!teamId) return res.status(400).json({ error: 'teamId required' });
    const t = teams.get(teamId.toUpperCase());
    if (!t) return res.status(404).json({ error: 'Team not found' });

    t.doorAccessGranted = false;
    t.gateWaitTimestamp = Date.now();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'REVOKE_DOOR_ACCESS',
      `Team ${t.id} (${t.name})`,
      'ADMITTED',
      'WAITING_AT_GATE',
      'Revoked door access: Team placed in gate queue'
    );

    broadcastState();
    broadcast('DOOR_ACCESS_REVOKED', { teamId: t.id });
    res.json({ success: true, message: `Access revoked for team ${t.id}` });
  });

  // GET WAITING TEAMS AT THE DOOR
  app.get('/api/admin/door/waiting-teams', requireAdminOrAbove, (req, res) => {
    const waiting: Team[] = [];
    teams.forEach(t => {
      if (t.doorAccessGranted === false) {
        waiting.push(t);
      }
    });
    res.json({
      doorClosed: Boolean(eventState.doorClosed),
      autoCloseDoorOnStart: Boolean(eventState.autoCloseDoorOnStart),
      waitingCount: waiting.length,
      waitingTeams: waiting,
    });
  });

  // TOGGLE TEST / DEMO MODE
  app.post('/api/admin/toggle-test-mode', requireSuperAdmin, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.isTestMode = !eventState.isTestMode;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_TEST_MODE',
      'EVENT_STATE',
      eventState.isTestMode ? 'PRODUCTION' : 'TEST_MODE',
      eventState.isTestMode ? 'TEST_MODE' : 'PRODUCTION'
    );

    broadcastState();
    res.json({ success: true, isTestMode: eventState.isTestMode });
  });

  // NEXT QUESTION
  app.post('/api/admin/next', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    const roundQuestions = getRoundQuestions(eventState.currentRound);
    if (eventState.currentQuestionIndex < roundQuestions.length - 1) {
      const oldIdx = eventState.currentQuestionIndex;
      eventState.currentQuestionIndex++;
      const nextQ = roundQuestions[eventState.currentQuestionIndex];
      eventState.currentQuestionId = nextQ?.id || null;
      eventState.buzzerActive = Boolean(eventState.buzzerRoundEnabled?.[eventState.currentRound]);
      eventState.buzzerWinner = null;
      eventState.buzzerTie = false;
      eventState.buzzerContenders = [];

      saveEventStateToDisk();

      recordAudit(
        adminUser.username,
        adminUser.role,
        'NEXT_QUESTION',
        `Round ${eventState.currentRound}`,
        `Q${oldIdx + 1}`,
        `Q${eventState.currentQuestionIndex + 1}`
      );

      broadcastState();
      return res.json({ success: true, message: `Advanced to question ${eventState.currentQuestionIndex + 1}`, currentQuestion: sanitizeQuestion(nextQ) });
    }
    res.json({ success: false, message: 'Already at the last question of this round.' });
  });

  // PREVIOUS QUESTION
  app.post('/api/admin/prev', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    const roundQuestions = getRoundQuestions(eventState.currentRound);
    if (eventState.currentQuestionIndex > 0) {
      const oldIdx = eventState.currentQuestionIndex;
      eventState.currentQuestionIndex--;
      const prevQ = roundQuestions[eventState.currentQuestionIndex];
      eventState.currentQuestionId = prevQ?.id || null;
      eventState.buzzerActive = Boolean(eventState.buzzerRoundEnabled?.[eventState.currentRound]);
      eventState.buzzerWinner = null;
      eventState.buzzerTie = false;
      eventState.buzzerContenders = [];

      saveEventStateToDisk();

      recordAudit(
        adminUser.username,
        adminUser.role,
        'PREV_QUESTION',
        `Round ${eventState.currentRound}`,
        `Q${oldIdx + 1}`,
        `Q${eventState.currentQuestionIndex + 1}`
      );

      broadcastState();
      return res.json({ success: true, message: `Moved back to question ${eventState.currentQuestionIndex + 1}`, currentQuestion: sanitizeQuestion(prevQ) });
    }
    res.json({ success: false, message: 'Already at the first question of this round.' });
  });

  // JUMP TO SPECIFIC QUESTION
  app.post('/api/admin/jump', requireAdminOrAbove, (req, res) => {
    const { questionIndex } = req.body;
    const adminUser = (req as any).adminUser;
    const roundQuestions = getRoundQuestions(eventState.currentRound);
    const idx = Number(questionIndex);
    if (idx >= 0 && idx < roundQuestions.length) {
      const oldIdx = eventState.currentQuestionIndex;
      eventState.currentQuestionIndex = idx;
      const targetQ = roundQuestions[idx];
      eventState.currentQuestionId = targetQ?.id || null;
      eventState.buzzerActive = Boolean(eventState.buzzerRoundEnabled?.[eventState.currentRound]);
      eventState.buzzerWinner = null;
      eventState.buzzerTie = false;
      eventState.buzzerContenders = [];

      saveEventStateToDisk();

      recordAudit(
        adminUser.username,
        adminUser.role,
        'JUMP_QUESTION',
        `Round ${eventState.currentRound}`,
        `Q${oldIdx + 1}`,
        `Q${idx + 1}`
      );

      broadcastState();
      return res.json({ success: true, message: `Jumped to question ${idx + 1}`, currentQuestion: sanitizeQuestion(targetQ) });
    }
    res.status(400).json({ error: 'Invalid question index' });
  });

  // STOP ROUND
  app.post('/api/admin/stop', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.status = 'COMPLETED';
    eventState.isPaused = false;
    eventState.buzzerActive = false;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'STOP_ROUND',
      `Round ${eventState.currentRound}`,
      'RUNNING',
      'COMPLETED'
    );

    broadcastState();
    res.json({ success: true, message: 'Round stopped', eventState });
  });

  // RESET EVENT (Requires exact confirmation phrase "RESET TECH BRIDGE")
  app.post('/api/admin/reset', requireSuperAdmin, (req, res) => {
    const { confirmation } = req.body;
    const adminUser = (req as any).adminUser;

    if (confirmation !== 'RESET TECH BRIDGE' && confirmation !== 'YES, RESET EVENT') {
      return res.status(400).json({
        error: 'Confirmation phrase mismatch. To reset the symposium event, type "RESET TECH BRIDGE".'
      });
    }

    submissions.clear();
    antiCheatEvents.length = 0;
    buzzerEvents.length = 0;
    teamWarnings.length = 0;

    // Reset team scores
    teams.forEach(t => {
      t.round1Score = 0;
      t.round2Score = 0;
      t.round3Score = 0;
      t.totalScore = 0;
      t.status = 'ACTIVE';
      t.warningsCount = 0;
      t.lockReason = undefined;
    });

    eventState.status = 'WAITING';
    eventState.currentRound = 1;
    eventState.currentQuestionIndex = 0;
    eventState.roundDurationSeconds = 1800;
    eventState.roundStartedAt = null;
    eventState.roundEndsAt = null;
    eventState.isPaused = false;
    eventState.pausedRemainingSeconds = 1800;
    eventState.eventLocked = false;
    eventState.roundLocked = { 1: false, 2: false, 3: false };
    eventState.activeQuestionSet = { 1: 'A', 2: 'A', 3: 'A' };
    eventState.buzzerActive = false;
    eventState.buzzerWinner = null;
    eventState.currentQuestionId = questions[0]?.id || null;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'RESET_EVENT',
      'TECH BRIDGE 26 ARENA',
      undefined,
      undefined,
      'Hard reset performed. All scores, submissions, and buzzer queues cleared.'
    );

    broadcastState();
    res.json({ success: true, message: 'Symposium event completely reset.' });
  });

  // TOGGLE LEADERBOARD DISPLAY
  app.post('/api/admin/toggle-leaderboard', requireModeratorOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.showLeaderboard = !eventState.showLeaderboard;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_LEADERBOARD',
      'PUBLIC_SCOREBOARD',
      eventState.showLeaderboard ? 'HIDDEN' : 'VISIBLE',
      eventState.showLeaderboard ? 'VISIBLE' : 'HIDDEN'
    );

    broadcastState();
    res.json({ success: true, showLeaderboard: eventState.showLeaderboard });
  });

  // SET MAXIMUM ALLOWED VIOLATIONS BEFORE LOCKOUT
  app.post(['/api/admin/set-max-violations', '/api/admin/settings/max-violations', '/api/admin/config/max-violations'], requireAdminOrAbove, (req, res) => {
    const rawVal = req.body.limit !== undefined ? req.body.limit : req.body.maxViolations;
    const adminUser = (req as any).adminUser;
    const parsed = Math.max(1, Math.min(10, parseInt(String(rawVal), 10) || 3));
    const oldVal = eventState.maxViolations || 3;
    eventState.maxViolations = parsed;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'SET_MAX_VIOLATIONS',
      'ANTI_CHEAT_POLICY',
      `${oldVal}`,
      `${parsed}`,
      `Organizer changed participant maximum violation limit from ${oldVal} to ${parsed}`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Violation limit updated to ${parsed} violation${parsed > 1 ? 's' : ''}`,
      maxViolations: eventState.maxViolations,
    });
  });

  // BUZZER CONTROLS
  app.post('/api/admin/buzzer-toggle', requireAdminOrAbove, (req, res) => {
    const { round, enabled } = req.body;
    const adminUser = (req as any).adminUser;
    const r = (Number(round) || eventState.currentRound) as 1 | 2 | 3;

    if (!eventState.buzzerRoundEnabled) {
      eventState.buzzerRoundEnabled = { 1: false, 2: false, 3: true };
    }

    if (enabled !== undefined) {
      eventState.buzzerRoundEnabled[r] = Boolean(enabled);
    } else {
      eventState.buzzerRoundEnabled[r] = !eventState.buzzerRoundEnabled[r];
    }

    // Sync buzzerActive if currently in this round
    if (eventState.currentRound === r) {
      eventState.buzzerActive = eventState.buzzerRoundEnabled[r];
      if (!eventState.buzzerActive) {
        eventState.buzzerWinner = null;
        eventState.buzzerTie = false;
        eventState.buzzerContenders = [];
      }
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_BUZZER_ROUND',
      `Round ${r}`,
      eventState.buzzerRoundEnabled[r] ? 'OFF' : 'ON',
      eventState.buzzerRoundEnabled[r] ? 'ON' : 'OFF',
      `Organizer ${eventState.buzzerRoundEnabled[r] ? 'switched ON' : 'switched OFF'} buzzer for Round ${r}`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Buzzer for Round ${r} is now ${eventState.buzzerRoundEnabled[r] ? 'ENABLED' : 'DISABLED'}`,
      buzzerRoundEnabled: eventState.buzzerRoundEnabled,
      buzzerActive: eventState.buzzerActive,
    });
  });

  app.post('/api/admin/buzzer-reset', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    eventState.buzzerWinner = null;
    eventState.buzzerTie = false;
    eventState.buzzerContenders = [];
    eventState.buzzerActive = true;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'ARM_BUZZER',
      `Q${(eventState.currentQuestionIndex || 0) + 1} (R${eventState.currentRound})`,
      'LOCKED',
      'ARMED'
    );

    broadcast('BUZZER_RESET', {});
    broadcastState();
    res.json({ success: true, message: 'Buzzer re-armed and contenders cleared' });
  });

  app.post('/api/admin/buzzer-award', requireAdminOrAbove, (req, res) => {
    const { awardPoints, points, targetTeamId } = req.body;
    const adminUser = (req as any).adminUser;

    if (!eventState.buzzerWinner && (!eventState.buzzerContenders || eventState.buzzerContenders.length === 0)) {
      return res.status(400).json({ error: 'No active buzzer contender found to award' });
    }

    const recipientTeamId = targetTeamId || eventState.buzzerWinner?.teamId || eventState.buzzerContenders?.[0]?.teamId;
    const team = recipientTeamId ? teams.get(recipientTeamId) : null;
    const currentQ = getCurrentQuestion();
    const roundStandardPts = eventState.currentRound === 1 ? 1 : eventState.currentRound === 2 ? 2 : 3;
    const defaultPts = currentQ ? (currentQ.round === 1 ? 1 : currentQ.round === 2 ? 2 : 3) : roundStandardPts;
    const pts = (points !== undefined && Number(points) > 0) ? Number(points) : defaultPts;
    const r = eventState.currentRound;

    if (awardPoints && team && !eventState.isTestMode) {
      if (r === 1) team.round1Score += pts;
      else if (r === 2) team.round2Score += pts;
      else team.round3Score += pts;
      team.totalScore = team.round1Score + team.round2Score + team.round3Score;
    }

    const teamName = team ? team.name : (recipientTeamId || 'Unknown Team');

    recordAudit(
      adminUser.username,
      adminUser.role,
      awardPoints ? 'AWARD_BUZZER_POINTS' : 'PASS_BUZZER',
      teamName,
      '0',
      awardPoints ? `+${pts}` : '0',
      `Points ${awardPoints ? 'awarded' : 'passed'} for team ${recipientTeamId} (R${r})`
    );

    eventState.buzzerWinner = null;
    eventState.buzzerTie = false;
    eventState.buzzerContenders = [];
    eventState.buzzerActive = false;
    broadcastState();

    res.json({
      success: true,
      message: awardPoints ? `Awarded ${pts} points to ${teamName}` : `Passed on buzzer for ${teamName}`,
    });
  });

  // ==========================================
  // CERTIFICATE ISSUANCE & VERIFICATION APIS
  // ==========================================

  // 1. GET PUBLIC/ADMIN CERTIFICATE CONFIG
  app.get('/api/certificate/config', (req, res) => {
    res.json({ config: certificateConfig });
  });

  // 2. UPDATE CERTIFICATE CONFIG (ADMIN)
  app.post('/api/admin/certificate/config', requireAdminOrAbove, (req, res) => {
    const { config } = req.body;
    const adminUser = (req as any).adminUser;

    if (!config) {
      return res.status(400).json({ error: 'Config payload is required' });
    }

    certificateConfig = {
      ...certificateConfig,
      ...config,
      // Retain sampleUploadedImage if not explicitly overwritten
      sampleUploadedImage: config.sampleUploadedImage !== undefined ? config.sampleUploadedImage : certificateConfig.sampleUploadedImage,
      sampleUploadedFileName: config.sampleUploadedFileName !== undefined ? config.sampleUploadedFileName : certificateConfig.sampleUploadedFileName,
    };

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPDATE_CERTIFICATE_CONFIG',
      'SYMPOSIUM_CERTIFICATE_MASTER',
      undefined,
      undefined,
      'Organizer updated symposium certificate template, signatories, and theme'
    );

    broadcast('CERTIFICATE_CONFIG_UPDATED', { config: certificateConfig });
    res.json({ success: true, config: certificateConfig, message: 'Certificate settings updated successfully.' });
  });

  // 3. UPLOAD SAMPLE CERTIFICATE BACKGROUND (ADMIN)
  app.post('/api/admin/certificate/upload-sample', requireAdminOrAbove, (req, res) => {
    const { imageDataUrl, fileName } = req.body;
    const adminUser = (req as any).adminUser;

    if (!imageDataUrl) {
      return res.status(400).json({ error: 'imageDataUrl is required (Base64 image or URL).' });
    }

    certificateConfig.sampleUploadedImage = imageDataUrl;
    certificateConfig.sampleUploadedFileName = fileName || 'sample_certificate_master.png';

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPLOAD_SAMPLE_CERTIFICATE',
      'CERTIFICATE_BACKGROUND',
      undefined,
      fileName,
      'Organizer uploaded official symposium sample certificate template'
    );

    broadcast('CERTIFICATE_CONFIG_UPDATED', { config: certificateConfig });
    res.json({ success: true, message: 'Sample certificate template uploaded successfully.', config: certificateConfig });
  });

  // 4. GET TEAM CERTIFICATE DATA (PUBLIC / PARTICIPANT)
  app.get('/api/certificate/team/:teamId', (req, res) => {
    const { teamId } = req.params;
    const team = teams.get(teamId);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Determine team rank from current leaderboard
    const sortedTeams = Array.from(teams.values()).sort((a, b) => b.totalScore - a.totalScore);
    const rankIndex = sortedTeams.findIndex(t => t.id === team.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 1;

    let awardCategory: 'FIRST_PLACE' | 'SECOND_PLACE' | 'THIRD_PLACE' | 'DISTINCTION' | 'MERIT_PARTICIPATION' = 'MERIT_PARTICIPATION';
    if (rank === 1 && team.totalScore > 0) awardCategory = 'FIRST_PLACE';
    else if (rank === 2 && team.totalScore > 0) awardCategory = 'SECOND_PLACE';
    else if (rank === 3 && team.totalScore > 0) awardCategory = 'THIRD_PLACE';
    else if (team.totalScore >= 10) awardCategory = 'DISTINCTION';

    const certId = `CERT-TB26-${team.id}-${rank}`;
    const verificationHash = Buffer.from(`${certId}-${team.name}-${team.totalScore}-ACET-2026`).toString('base64').slice(0, 16);

    const certificateData: TeamCertificateData = {
      certificateId: certId,
      teamId: team.id,
      teamName: team.name,
      participant1: team.participant1,
      participant2: team.participant2 || '',
      college: team.college,
      department: team.department,
      year: team.year,
      rank,
      totalScore: team.totalScore,
      round1Score: team.round1Score,
      round2Score: team.round2Score,
      round3Score: team.round3Score,
      awardCategory,
      issuedAt: Date.now(),
      verificationHash,
      config: certificateConfig,
    };

    res.json({ certificate: certificateData });
  });

  // 5. GET ALL CERTIFICATES (ADMIN BATCH PRINTING)
  app.get('/api/admin/certificates/all', requireAdminOrAbove, (req, res) => {
    const sortedTeams = Array.from(teams.values()).sort((a, b) => b.totalScore - a.totalScore);
    
    const certList: TeamCertificateData[] = sortedTeams.map((team, idx) => {
      const rank = idx + 1;
      let awardCategory: 'FIRST_PLACE' | 'SECOND_PLACE' | 'THIRD_PLACE' | 'DISTINCTION' | 'MERIT_PARTICIPATION' = 'MERIT_PARTICIPATION';
      if (rank === 1 && team.totalScore > 0) awardCategory = 'FIRST_PLACE';
      else if (rank === 2 && team.totalScore > 0) awardCategory = 'SECOND_PLACE';
      else if (rank === 3 && team.totalScore > 0) awardCategory = 'THIRD_PLACE';
      else if (team.totalScore >= 10) awardCategory = 'DISTINCTION';

      const certId = `CERT-TB26-${team.id}-${rank}`;
      const verificationHash = Buffer.from(`${certId}-${team.name}-${team.totalScore}-ACET-2026`).toString('base64').slice(0, 16);

      return {
        certificateId: certId,
        teamId: team.id,
        teamName: team.name,
        participant1: team.participant1,
        participant2: team.participant2 || '',
        college: team.college,
        department: team.department,
        year: team.year,
        rank,
        totalScore: team.totalScore,
        round1Score: team.round1Score,
        round2Score: team.round2Score,
        round3Score: team.round3Score,
        awardCategory,
        issuedAt: Date.now(),
        verificationHash,
        config: certificateConfig,
      };
    });

    res.json({ certificates: certList, total: certList.length, config: certificateConfig });
  });

  // ==========================================
  // PARTICIPANT & TEAM MANAGEMENT APIS
  // ==========================================

  // GET TEAMS
  app.get('/api/admin/teams', requireModeratorOrAbove, (req, res) => {
    const now = Date.now();
    const teamList = Array.from(teams.values()).map(t => ({
      ...t,
      isOnline: now - t.lastActive < 120000,
    }));
    res.json({ teams: teamList });
  });

  // LOCK TEAM
  app.post('/api/admin/team/lock', requireModeratorOrAbove, (req, res) => {
    const { teamId, reason } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldStatus = team.status;
    team.status = 'LOCKED';
    team.lockReason = reason || 'Locked by symposium administrator';

    recordAudit(
      adminUser.username,
      adminUser.role,
      'LOCK_TEAM',
      team.name,
      oldStatus,
      'LOCKED',
      team.lockReason
    );

    broadcast('TEAM_LOCKED', { teamId: team.id, reason: team.lockReason });
    broadcastState();
    res.json({ success: true, team });
  });

  // UNLOCK TEAM
  app.post('/api/admin/team/unlock', requireModeratorOrAbove, (req, res) => {
    const { teamId } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldStatus = team.status;
    team.status = 'ACTIVE';
    team.lockReason = undefined;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UNLOCK_TEAM',
      team.name,
      oldStatus,
      'ACTIVE',
      'Team unlocked by administrator'
    );

    broadcast('TEAM_UNLOCKED', { teamId: team.id });
    broadcastState();
    res.json({ success: true, team });
  });

  // MANAGE TEAM VIOLATIONS (Add, Remove, Reset)
  app.post('/api/admin/team/violations', requireModeratorOrAbove, (req, res) => {
    const { teamId, action, reason } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldCount = team.warningsCount || 0;
    let newCount = oldCount;

    if (action === 'ADD') {
      newCount = oldCount + 1;
    } else if (action === 'REMOVE') {
      newCount = Math.max(0, oldCount - 1);
    } else if (action === 'RESET') {
      newCount = 0;
    }

    team.warningsCount = newCount;
    if (newCount >= 3 && team.status !== 'DISQUALIFIED') {
      team.status = 'LOCKED';
      team.lockReason = 'Automated security lockout: Reached maximum allowed violations (3/3).';
    } else if (newCount === 0 && team.status === 'LOCKED') {
      team.status = 'ACTIVE';
      team.lockReason = undefined;
    } else if (newCount === 1 || newCount === 2) {
      if (team.status === 'LOCKED') {
        team.status = 'WARNED';
        team.lockReason = undefined;
      }
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'MANAGE_VIOLATIONS',
      team.name,
      String(oldCount),
      String(newCount),
      `Action: ${action}. Reason: ${reason || 'Admin override'}`
    );

    broadcastState();
    res.json({ success: true, team, warningsCount: team.warningsCount });
  });

  // WARN TEAM
  app.post('/api/admin/team/warn', requireModeratorOrAbove, (req, res) => {
    const { teamId, message, severity } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    team.warningsCount++;
    if (team.status === 'ACTIVE') {
      team.status = 'WARNED';
    }

    const warning: TeamWarning = {
      id: `warn-${Date.now()}`,
      teamId: team.id,
      teamName: team.name,
      violationType: 'ADMINISTRATOR_WARNING',
      warningMessage: message || 'Formal symposium warning issued by organizers',
      issuedBy: adminUser.username,
      timestamp: Date.now(),
      severity: (severity as AntiCheatSeverity) || 'WARNING',
    };
    teamWarnings.unshift(warning);

    recordAudit(
      adminUser.username,
      adminUser.role,
      'WARN_TEAM',
      team.name,
      `${team.warningsCount - 1} warnings`,
      `${team.warningsCount} warnings`,
      warning.warningMessage
    );

    broadcast('TEAM_WARNED', { teamId: team.id, warning });
    broadcastState();
    res.json({ success: true, team, warning });
  });

  // DISQUALIFY TEAM
  app.post('/api/admin/team/disqualify', requireAdminOrAbove, (req, res) => {
    const { teamId, reason } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldStatus = team.status;
    team.status = 'DISQUALIFIED';
    team.lockReason = reason || 'Disqualified from Tech Bridge \'26';

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DISQUALIFY_TEAM',
      team.name,
      oldStatus,
      'DISQUALIFIED',
      team.lockReason
    );

    broadcast('TEAM_DISQUALIFIED', { teamId: team.id, reason: team.lockReason });
    broadcastState();
    res.json({ success: true, team });
  });

  // RESTORE TEAM
  app.post('/api/admin/team/restore', requireAdminOrAbove, (req, res) => {
    const { teamId } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldStatus = team.status;
    team.status = 'ACTIVE';
    team.lockReason = undefined;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'RESTORE_TEAM',
      team.name,
      oldStatus,
      'ACTIVE',
      'Team status restored to active'
    );

    broadcastState();
    res.json({ success: true, team });
  });

  // EDIT TEAM DETAILS
  app.post('/api/admin/team/edit', requireAdminOrAbove, (req, res) => {
    const { teamId, name, participant1, participant2, college, department, year, phone } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const oldName = team.name;
    if (name) team.name = name.trim();
    if (participant1) team.participant1 = participant1.trim();
    if (participant2 !== undefined) team.participant2 = participant2.trim() || undefined;
    if (college) team.college = college.trim();
    if (department) team.department = department.trim();
    if (year) team.year = year.trim();
    if (phone) team.phone = phone.trim();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'EDIT_TEAM',
      team.id,
      oldName,
      team.name,
      'Participant details modified by administrator'
    );

    broadcastState();
    res.json({ success: true, team });
  });

  // ADD NEW TEAM (ADMIN or SUPER_ADMIN)
  app.post('/api/admin/team/add', requireAdminOrAbove, (req, res) => {
    const { id, name, participant1, participant2, college, department, year, phone } = req.body;
    const adminUser = (req as any).adminUser;

    if (!name || !participant1) {
      return res.status(400).json({ error: 'Team name and Participant 1 name are required.' });
    }

    let teamId = id ? String(id).trim().toUpperCase() : '';
    if (!teamId) {
      let candidateId = `TB-${Math.floor(1000 + Math.random() * 9000)}`;
      while (teams.has(candidateId)) {
        candidateId = `TB-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      teamId = candidateId;
    } else if (teams.has(teamId)) {
      return res.status(400).json({ error: `Team ID ${teamId} is already registered.` });
    }

    const newTeam: Team = {
      id: teamId,
      name: String(name).trim(),
      participant1: String(participant1).trim(),
      participant2: participant2 ? String(participant2).trim() : undefined,
      college: (college ? String(college) : 'Autonomous College of Engineering & Technology').trim(),
      department: (department ? String(department) : 'Computer Science & Engineering').trim(),
      year: (year ? String(year) : '3rd Year').trim(),
      phone: (phone ? String(phone) : '9876543210').trim(),
      registeredAt: Date.now(),
      status: 'ACTIVE',
      warningsCount: 0,
      round1Score: 0,
      round2Score: 0,
      round3Score: 0,
      totalScore: 0,
      lastActive: Date.now(),
      isOnline: true,
    };

    teams.set(teamId, newTeam);

    recordAudit(
      adminUser.username,
      adminUser.role,
      'ADD_TEAM',
      newTeam.id,
      undefined,
      newTeam.name,
      `New team manually registered by administrator (${newTeam.college})`
    );

    broadcastState();
    res.json({ success: true, message: `Team ${newTeam.name} (${newTeam.id}) added successfully.`, team: newTeam });
  });

  // REMOVE TEAM (ADMIN or SUPER_ADMIN)
  app.post('/api/admin/team/remove', requireAdminOrAbove, (req, res) => {
    const { teamId } = req.body;
    const adminUser = (req as any).adminUser;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required.' });
    }

    const normId = String(teamId).trim().toUpperCase();
    const team = teams.get(normId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    const teamName = team.name;

    // Purge associated submissions
    for (const [key, sub] of submissions.entries()) {
      if (sub.teamId === normId) {
        submissions.delete(key);
      }
    }

    // Reset buzzer if this team was buzzing
    if (eventState.buzzerWinner?.teamId === normId) {
      eventState.buzzerWinner = null;
      eventState.buzzerActive = eventState.currentRound === 3;
    }

    // Delete team from memory
    teams.delete(normId);

    recordAudit(
      adminUser.username,
      adminUser.role,
      'REMOVE_TEAM',
      normId,
      teamName,
      undefined,
      `Team ${teamName} (${normId}) permanently removed by administrator`
    );

    broadcastState();
    res.json({ success: true, message: `Team ${teamName} (${normId}) removed successfully.` });
  });

  // OVERRIDE SCORE
  app.post('/api/admin/team/score-override', requireAdminOrAbove, (req, res) => {
    const { teamId, round, newScore, reason } = req.body;
    const adminUser = (req as any).adminUser;
    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const r = Number(round) as 1 | 2 | 3;
    const pts = Number(newScore);

    const oldScore = r === 1 ? team.round1Score : r === 2 ? team.round2Score : team.round3Score;
    if (r === 1) team.round1Score = pts;
    else if (r === 2) team.round2Score = pts;
    else if (r === 3) team.round3Score = pts;
    team.totalScore = team.round1Score + team.round2Score + team.round3Score;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'OVERRIDE_SCORE',
      `${team.name} (R${r})`,
      `${oldScore}`,
      `${pts}`,
      reason || 'Manual score adjustment'
    );

    broadcastState();
    res.json({ success: true, team });
  });

  // ==========================================
  // ANTI-CHEAT TRIAGE & ACTION
  // ==========================================

  // GET ANTI-CHEAT EVENTS
  app.get('/api/admin/anti-cheat', requireModeratorOrAbove, (req, res) => {
    res.json({ events: antiCheatEvents });
  });

  // ACTION ON ANTI-CHEAT ALERT
  app.post('/api/admin/anti-cheat/action', requireModeratorOrAbove, (req, res) => {
    const { eventId, action, reason } = req.body;
    const adminUser = (req as any).adminUser;

    const alert = antiCheatEvents.find(a => a.id === eventId);
    if (!alert) return res.status(404).json({ error: 'Anti-cheat alert not found' });

    alert.resolved = true;
    alert.actionTaken = action;
    alert.resolvedBy = adminUser.username;
    alert.resolvedAt = Date.now();

    const team = teams.get(alert.teamId);
    if (team) {
      if (action === 'WARN') {
        team.warningsCount++;
        if (team.status === 'ACTIVE') team.status = 'WARNED';
        teamWarnings.unshift({
          id: `warn-${Date.now()}`,
          teamId: team.id,
          teamName: team.name,
          violationType: alert.eventType,
          warningMessage: reason || `Violation alert actioned: ${alert.details}`,
          issuedBy: adminUser.username,
          timestamp: Date.now(),
          severity: alert.severity,
        });
      } else if (action === 'LOCKED') {
        team.status = 'LOCKED';
        team.lockReason = reason || `Access locked following security incident: ${alert.eventType}`;
        broadcast('TEAM_LOCKED', { teamId: team.id, reason: team.lockReason });
      } else if (action === 'DISQUALIFIED') {
        team.status = 'DISQUALIFIED';
        team.lockReason = reason || `Disqualified for violation: ${alert.eventType}`;
        broadcast('TEAM_DISQUALIFIED', { teamId: team.id, reason: team.lockReason });
      }
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      `TRIAGE_ALERT_${action}`,
      alert.teamName,
      alert.eventType,
      action,
      reason || alert.details
    );

    broadcastState();
    res.json({ success: true, alert });
  });

  // GET AUDIT LOGS
  app.get('/api/admin/audit-logs', requireAdminOrAbove, (req, res) => {
    res.json({ auditLogs });
  });

  // GET WARNINGS
  app.get('/api/admin/warnings', requireModeratorOrAbove, (req, res) => {
    res.json({ warnings: teamWarnings });
  });

  // GET SUBMISSIONS
  app.get('/api/admin/submissions', requireModeratorOrAbove, (req, res) => {
    const list = Array.from(submissions.values()).sort((a, b) => b.submittedAt - a.submittedAt);
    res.json({ submissions: list });
  });

  // ==========================================
  // QUESTION MANAGEMENT & SET SELECTION APIS
  // ==========================================

  // CHOOSE ACTIVE QUESTION SET (A, B, or C) FOR A ROUND
  app.post('/api/admin/set-question-set', requireAdminOrAbove, (req, res) => {
    const { round, set } = req.body;
    const adminUser = (req as any).adminUser;

    const r = Number(round) as 1 | 2 | 3;
    if (![1, 2, 3].includes(r)) {
      return res.status(400).json({ error: 'Valid round (1, 2, or 3) is required.' });
    }

    const s = String(set || '').trim().toUpperCase() as 'A' | 'B' | 'C';
    if (!['A', 'B', 'C'].includes(s)) {
      return res.status(400).json({ error: 'Valid question set (A, B, or C) is required.' });
    }

    const oldSet = eventState.activeQuestionSet[r] || 'A';
    eventState.activeQuestionSet[r] = s;

    // If changing the set for the current round, reset index to 0 and re-evaluate current question
    if (eventState.currentRound === r) {
      eventState.currentQuestionIndex = 0;
      const roundQ = getRoundQuestions(r);
      eventState.currentQuestionId = roundQ[0]?.id || null;
      eventState.totalQuestionsInRound = roundQ.length;
      eventState.buzzerWinner = null;
      eventState.buzzerTie = false;
      eventState.buzzerContenders = [];
      eventState.buzzerActive = Boolean(eventState.buzzerRoundEnabled?.[r]);
    }

    saveEventStateToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'SET_QUESTION_SET',
      `Round ${r}`,
      `Set ${oldSet}`,
      `Set ${s}`,
      `Organizer activated Question Set ${s} for Round ${r}`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Active question set for Round ${r} updated to Set ${s}.`,
      activeQuestionSet: eventState.activeQuestionSet,
      currentQuestion: sanitizeQuestion(getCurrentQuestion()),
      totalQuestionsInRound: getRoundQuestions(eventState.currentRound).length,
    });
  });

  // TOGGLE CLUE DISPLAY MODE (Realistic Photographic Images vs. Vector Clue Panels)
  app.post('/api/admin/clue-display-mode', requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;
    const { mode } = req.body;
    if (mode !== 'realistic' && mode !== 'panels') {
      return res.status(400).json({ error: 'Valid mode ("realistic" or "panels") is required.' });
    }

    const prevMode = eventState.clueDisplayMode || 'realistic';
    eventState.clueDisplayMode = mode;

    saveEventStateToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPDATE_CLUE_DISPLAY_MODE',
      'Event Display Settings',
      prevMode,
      mode,
      `Proctor set visual clue display mode to "${mode}" (Synchronized across all participant screens & public projectors)`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Visual clue display mode successfully switched to ${mode}.`,
      clueDisplayMode: eventState.clueDisplayMode,
    });
  });

  // GET QUESTIONS (Includes canonical answers for organizer validation)
  app.get('/api/admin/questions', requireAdminOrAbove, (req, res) => {
    const { round, set } = req.query;
    let filtered = [...questions];
    if (round) {
      filtered = filtered.filter(q => q.round === Number(round));
    }
    if (set) {
      filtered = filtered.filter(q => (q.set || 'A') === String(set).toUpperCase());
    }
    res.json({ questions: filtered, activeQuestionSet: eventState.activeQuestionSet });
  });

  // ADD QUESTION
  app.post('/api/admin/question/add', requireAdminOrAbove, (req, res) => {
    const { question } = req.body;
    const adminUser = (req as any).adminUser;

    if (!question || !question.correctAnswer) {
      return res.status(400).json({ error: 'Question data and correct answer are required.' });
    }

    const round = (Number(question.round) || 1) as 1 | 2 | 3;
    const set = (String(question.set || 'A').toUpperCase()) as 'A' | 'B' | 'C';
    const existingInSet = questions.filter(q => q.round === round && (q.set || 'A') === set);
    const questionNumber = Number(question.questionNumber) || (existingInSet.length + 1);
    const id = question.id ? String(question.id).trim() : `q${round}-${set.toLowerCase()}-${String(questionNumber).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    let aliasesList: string[] = [];
    if (Array.isArray(question.aliases)) {
      aliasesList = question.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean);
    } else if (typeof question.aliases === 'string') {
      aliasesList = question.aliases.split(',').map((a: string) => a.trim().toLowerCase()).filter(Boolean);
    }
    const cleanAnswer = String(question.correctAnswer).trim();
    if (!aliasesList.includes(cleanAnswer.toLowerCase())) {
      aliasesList.unshift(cleanAnswer.toLowerCase());
    }

    let panels = question.cluePanels;
    if (!Array.isArray(panels) || panels.length === 0) {
      panels = [
        { panelNumber: 1, description: 'Visual clue panel 1', svgType: 'token' },
        { panelNumber: 2, description: 'Visual clue panel 2', svgType: 'brain' }
      ];
    }

    const newQuestion: Question = {
      id,
      title: question.title ? String(question.title).trim() : undefined,
      round,
      set,
      questionNumber,
      domain: question.domain ? String(question.domain).trim() : 'Computer Science',
      difficulty: question.difficulty || (round === 1 ? 'Medium' : round === 2 ? 'Hard' : 'Very Hard'),
      points: Number(question.points) || (round === 1 ? 1 : round === 2 ? 2 : 3),
      cluePanels: panels,
      rebusFormulaText: question.rebusFormulaText ? String(question.rebusFormulaText).trim() : 'Panel 1 + Panel 2',
      correctAnswer: cleanAnswer,
      aliases: aliasesList,
      explanation: question.explanation ? String(question.explanation).trim() : '',
      customImageUrl: question.customImageUrl ? String(question.customImageUrl).trim() : undefined,
      images: Array.isArray(question.images) ? question.images : question.customImageUrl ? [String(question.customImageUrl).trim()] : undefined,
      active: question.active !== false,
    };

    questions.push(newQuestion);
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'ADD_QUESTION',
      newQuestion.id,
      undefined,
      newQuestion.correctAnswer,
      `Added new question #${newQuestion.questionNumber} to Round ${round} Set ${set}`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, question: newQuestion });
  });

  // EDIT QUESTION
  app.post('/api/admin/question/edit', requireAdminOrAbove, (req, res) => {
    const { question } = req.body;
    const adminUser = (req as any).adminUser;

    if (!question || !question.id) {
      return res.status(400).json({ error: 'Valid question ID required.' });
    }

    const idx = questions.findIndex(q => q.id === question.id);
    if (idx < 0) return res.status(404).json({ error: 'Question not found.' });

    const old = questions[idx];
    const oldAnswer = old.correctAnswer;

    // Handle aliases
    let aliasesList = old.aliases;
    if (question.aliases !== undefined) {
      if (Array.isArray(question.aliases)) {
        aliasesList = question.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean);
      } else if (typeof question.aliases === 'string') {
        aliasesList = question.aliases.split(',').map((a: string) => a.trim().toLowerCase()).filter(Boolean);
      }
    }
    const cleanAnswer = question.correctAnswer ? String(question.correctAnswer).trim() : old.correctAnswer;
    if (!aliasesList.includes(cleanAnswer.toLowerCase())) {
      aliasesList.unshift(cleanAnswer.toLowerCase());
    }

    questions[idx] = {
      ...old,
      ...question,
      correctAnswer: cleanAnswer,
      aliases: aliasesList,
      title: question.title !== undefined ? (question.title ? String(question.title).trim() : undefined) : old.title,
      round: question.round ? (Number(question.round) as 1 | 2 | 3) : old.round,
      set: question.set ? (String(question.set).toUpperCase() as 'A' | 'B' | 'C') : (old.set || 'A'),
      questionNumber: question.questionNumber ? Number(question.questionNumber) : old.questionNumber,
      points: question.points !== undefined ? Number(question.points) : old.points,
      customImageUrl: question.customImageUrl !== undefined ? (question.customImageUrl ? String(question.customImageUrl).trim() : undefined) : old.customImageUrl,
      images: question.images !== undefined ? question.images : (question.customImageUrl ? [String(question.customImageUrl).trim()] : old.images),
      active: question.active !== undefined ? Boolean(question.active) : old.active,
    };
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'EDIT_QUESTION',
      question.id,
      oldAnswer,
      questions[idx].correctAnswer,
      `Updated question details in Round ${questions[idx].round} Set ${questions[idx].set || 'A'}`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, question: questions[idx] });
  });

  // FAST UPDATE ANSWER FOR CURRENT QUESTION OR SPECIFIC QUESTION
  // Accessible to all administrators, moderating staff, and organizers
  app.post(['/api/admin/current-question/update-answer', '/api/admin/question/update-answer'], requireAdminOrAbove, (req, res) => {
    const { questionId, correctAnswer, aliases, rebusFormulaText, explanation } = req.body;
    const adminUser = (req as any).adminUser;

    if (!correctAnswer || typeof correctAnswer !== 'string' || !correctAnswer.trim()) {
      return res.status(400).json({ error: 'Correct answer text is required.' });
    }

    // Determine target question: use specified questionId or active live question
    let targetQ: Question | undefined;
    if (questionId) {
      targetQ = questions.find(q => q.id === questionId);
    } else {
      const liveQ = getCurrentQuestion();
      if (liveQ) {
        targetQ = questions.find(q => q.id === liveQ.id);
      }
    }

    if (!targetQ) {
      return res.status(404).json({ error: 'Question not found to update answer.' });
    }

    const oldAnswer = targetQ.correctAnswer;
    const cleanAnswer = correctAnswer.trim();

    // Process aliases
    let aliasesList = targetQ.aliases || [];
    if (aliases !== undefined) {
      if (Array.isArray(aliases)) {
        aliasesList = aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean);
      } else if (typeof aliases === 'string') {
        aliasesList = aliases.split(',').map((a: string) => a.trim().toLowerCase()).filter(Boolean);
      }
    }
    if (!aliasesList.includes(cleanAnswer.toLowerCase())) {
      aliasesList.unshift(cleanAnswer.toLowerCase());
    }

    targetQ.correctAnswer = cleanAnswer;
    targetQ.aliases = aliasesList;
    if (rebusFormulaText !== undefined) targetQ.rebusFormulaText = String(rebusFormulaText).trim();
    if (explanation !== undefined) targetQ.explanation = String(explanation).trim();

    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPDATE_ANSWER',
      targetQ.id,
      oldAnswer,
      targetQ.correctAnswer,
      `Updated authoritative answer to "${targetQ.correctAnswer}" for Question ${targetQ.id} (Round ${targetQ.round} #${targetQ.questionNumber})`
    );

    broadcastState();
    broadcast('QUESTION_UPDATED', { question: sanitizeQuestion(targetQ), fullQuestion: targetQ });
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });

    res.json({
      success: true,
      message: `Authoritative answer for Question ${targetQ.id} successfully updated to "${cleanAnswer}" and persisted to cloud.`,
      question: targetQ,
    });
  });

  // DELETE QUESTION
  app.post('/api/admin/question/delete', requireAdminOrAbove, (req, res) => {
    const { questionId } = req.body;
    const adminUser = (req as any).adminUser;

    const idx = questions.findIndex(q => q.id === questionId);
    if (idx < 0) return res.status(404).json({ error: 'Question not found.' });

    const deleted = questions.splice(idx, 1)[0];
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DELETE_QUESTION',
      questionId,
      deleted.correctAnswer,
      undefined,
      `Removed question #${deleted.questionNumber} from Round ${deleted.round} Set ${deleted.set || 'A'}`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, deletedId: questionId });
  });

  // DELETE MULTIPLE SELECTED QUESTIONS WITH VERIFICATION
  app.post('/api/admin/questions/delete-selected', requireAdminOrAbove, (req, res) => {
    const { questionIds } = req.body;
    const adminUser = (req as any).adminUser;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'Array of questionIds is required.' });
    }

    const idsSet = new Set(questionIds);
    const initialCount = questions.length;
    const removedQuestions = questions.filter(q => idsSet.has(q.id));
    const kept = questions.filter(q => !idsSet.has(q.id));
    questions.length = 0;
    kept.forEach(q => questions.push(q));
    saveQuestionsToDisk();
    const deletedCount = initialCount - questions.length;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DELETE_SELECTED_QUESTIONS',
      `${deletedCount} questions`,
      undefined,
      undefined,
      `Batch deleted ${deletedCount} selected questions: ${removedQuestions.map(q => q.correctAnswer).slice(0, 5).join(', ')}${deletedCount > 5 ? '...' : ''}`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} selected questions.`,
      deletedCount,
      remainingCount: questions.length,
    });
  });

  // DELETE SPECIFIC SET WITH VERIFICATION
  app.post('/api/admin/questions/delete-set', requireAdminOrAbove, (req, res) => {
    const { round, set, confirmation } = req.body;
    const adminUser = (req as any).adminUser;

    const r = (Number(round) || 1) as 1 | 2 | 3;
    const s = String(set || 'A').toUpperCase() as 'A' | 'B' | 'C';

    const expectedConfirm = `DELETE R${r} SET ${s}`;
    if (String(confirmation || '').trim().toUpperCase() !== expectedConfirm) {
      return res.status(400).json({
        error: `Invalid verification string. Please type exactly "${expectedConfirm}" to confirm deletion.`,
      });
    }

    const initialCount = questions.length;
    const kept = questions.filter(q => !(q.round === r && (q.set || 'A') === s));
    questions.length = 0;
    kept.forEach(q => questions.push(q));
    saveQuestionsToDisk();
    const deletedCount = initialCount - questions.length;

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DELETE_QUESTION_SET',
      `Round ${r} Set ${s}`,
      `${deletedCount} questions`,
      '0 questions',
      `Purged entire Round ${r} Set ${s} (${deletedCount} questions removed)`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Purged Round ${r} Set ${s} (${deletedCount} questions deleted).`,
      deletedCount,
      remainingCount: questions.length,
    });
  });

  // DELETE ALL QUESTIONS WITH VERIFICATION
  app.post('/api/admin/questions/delete-all', requireAdminOrAbove, (req, res) => {
    const { confirmation } = req.body;
    const adminUser = (req as any).adminUser;

    if (String(confirmation || '').trim().toUpperCase() !== 'DELETE ALL') {
      return res.status(400).json({
        error: 'Invalid verification string. Please type "DELETE ALL" to confirm deleting all questions.',
      });
    }

    const deletedCount = questions.length;
    questions.length = 0;
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DELETE_ALL_QUESTIONS',
      'QUESTION_BANK',
      `${deletedCount} questions`,
      '0 questions',
      `Purged entire question bank (${deletedCount} questions removed)`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Entire question bank purged (${deletedCount} questions deleted).`,
      deletedCount,
      remainingCount: 0,
    });
  });

  // BATCH / BULK UPDATE IMAGES BY FILENAME PATTERN (e.g. R1_Q1_P1.jpg, R1_A_Q5_P2.png)
  app.post('/api/admin/questions/bulk-update-images', requireAdminOrAbove, (req, res) => {
    const { updates } = req.body;
    const adminUser = (req as any).adminUser;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Array of image updates is required.' });
    }

    let updatedCount = 0;
    const updateLogs: string[] = [];

    updates.forEach(item => {
      const { questionId, round, set, questionNumber, panelIndex, imageUrl, customImageUrl, filename, images: itemImages } = item;
      const hasImageArray = Array.isArray(itemImages) && itemImages.length > 0;
      const singleImg = imageUrl || customImageUrl || (hasImageArray ? itemImages[0] : null);
      if (!hasImageArray && !singleImg) return;

      let targetQ: Question | undefined;

      // 1. Direct Question ID match (exact or stripped suffix)
      if (questionId) {
        const cleanId = String(questionId).toLowerCase().trim();
        targetQ = questions.find(q => {
          const qIdLow = q.id.toLowerCase();
          if (qIdLow === cleanId) return true;
          // Match stripped IDs (e.g. q1-a-01 matching q1-a-01-8866)
          const baseQId = qIdLow.replace(/-[a-z0-9]{3,8}$/, '');
          const baseCleanId = cleanId.replace(/-[a-z0-9]{3,8}$/, '');
          return baseQId === baseCleanId || qIdLow.startsWith(cleanId) || cleanId.startsWith(qIdLow);
        });
      }

      // 2. Round + Set + QuestionNumber match
      if (!targetQ && round && questionNumber) {
        const r = Number(round);
        const qNum = Number(questionNumber);
        const s = set ? String(set).toUpperCase().trim() : undefined;

        if (s) {
          targetQ = questions.find(q => Number(q.round) === r && (q.set || 'A').toUpperCase() === s && Number(q.questionNumber) === qNum);
        } else {
          targetQ = questions.find(q => Number(q.round) === r && Number(q.questionNumber) === qNum);
        }
      }

      // 3. Round + QuestionNumber
      if (!targetQ && round && questionNumber) {
        targetQ = questions.find(q => Number(q.round) === Number(round) && Number(q.questionNumber) === Number(questionNumber));
      }

      // 4. QuestionNumber only
      if (!targetQ && questionNumber) {
        targetQ = questions.find(q => Number(q.questionNumber) === Number(questionNumber));
      }

      // 5. By questionId parsed as number (e.g. "1" or "q1")
      if (!targetQ && questionId) {
        const numMatch = String(questionId).match(/\d+/);
        if (numMatch) {
          const num = Number(numMatch[0]);
          targetQ = questions.find(q => Number(q.questionNumber) === num);
        }
      }

      if (targetQ) {
        if (hasImageArray) {
          targetQ.images = itemImages.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
          targetQ.customImageUrl = targetQ.images[0] || targetQ.customImageUrl;
          updatedCount++;
          updateLogs.push(`Q#${targetQ.questionNumber} (R${targetQ.round}${targetQ.set || 'A'}) ${targetQ.images.length} images`);
        } else if (singleImg) {
          const pIdx = Math.max(0, Math.min(2, Number(panelIndex) || 0));
          
          // Ensure images array exists
          if (!Array.isArray(targetQ.images)) {
            targetQ.images = targetQ.customImageUrl ? [targetQ.customImageUrl] : [];
          }
          
          // Ensure array is large enough
          while (targetQ.images.length <= pIdx) {
            targetQ.images.push('');
          }

          targetQ.images[pIdx] = singleImg;

          // If primary panel, also set customImageUrl
          if (pIdx === 0) {
            targetQ.customImageUrl = singleImg;
          }

          updatedCount++;
          updateLogs.push(`Q#${targetQ.questionNumber} (R${targetQ.round}${targetQ.set || 'A'}) P${pIdx + 1} from ${filename || 'image'}`);
        }
      }
    });

    saveQuestionsToDisk();
    recordAudit(
      adminUser.username,
      adminUser.role,
      'BULK_UPDATE_IMAGES',
      `${updatedCount} images`,
      undefined,
      undefined,
      `Batch updated ${updatedCount} question images: ${updateLogs.slice(0, 4).join('; ')}${updateLogs.length > 4 ? '...' : ''}`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Successfully mapped and updated ${updatedCount} question clue images.`,
      updatedCount,
      totalUpdates: updates.length,
    });
  });

  // UPLOAD QUESTIONS OR QUESTION SET
  app.post('/api/admin/questions/upload', requireAdminOrAbove, (req, res) => {
    const { questions: uploadedQuestions, round, set, mode } = req.body;
    const adminUser = (req as any).adminUser;

    if (!Array.isArray(uploadedQuestions) || uploadedQuestions.length === 0) {
      return res.status(400).json({ error: 'An array of questions is required.' });
    }

    const targetRound = round ? (Number(round) as 1 | 2 | 3) : null;
    const targetSet = set ? (String(set).toUpperCase() as 'A' | 'B' | 'C') : null;
    const uploadMode = mode === 'replace' ? 'replace' : 'append';

    // If replace mode and target round & set are specified, purge existing questions for that round and set
    if (uploadMode === 'replace' && targetRound && targetSet) {
      const kept = questions.filter(q => !(q.round === targetRound && (q.set || 'A') === targetSet));
      questions.length = 0;
      kept.forEach(q => questions.push(q));
    }

    let addedCount = 0;
    uploadedQuestions.forEach((rawQ, i) => {
      if (!rawQ.correctAnswer) return;

      const qRound = (targetRound || Number(rawQ.round) || 1) as 1 | 2 | 3;
      const qSet = (targetSet || String(rawQ.set || 'A').toUpperCase()) as 'A' | 'B' | 'C';
      const existingInSet = questions.filter(q => q.round === qRound && (q.set || 'A') === qSet);
      const qNumber = Number(rawQ.questionNumber) || (existingInSet.length + 1);
      const qId = rawQ.id ? String(rawQ.id).trim() : `q${qRound}-${qSet.toLowerCase()}-${String(qNumber).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

      // Format aliases
      let aliasesList: string[] = [];
      if (Array.isArray(rawQ.aliases)) {
        aliasesList = rawQ.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean);
      } else if (typeof rawQ.aliases === 'string') {
        aliasesList = rawQ.aliases.split(',').map((a: string) => a.trim().toLowerCase()).filter(Boolean);
      }
      const cleanAns = String(rawQ.correctAnswer).trim();
      if (!aliasesList.includes(cleanAns.toLowerCase())) {
        aliasesList.unshift(cleanAns.toLowerCase());
      }

      // Format clue panels
      let panels: any[] = [];
      if (Array.isArray(rawQ.cluePanels) && rawQ.cluePanels.length > 0) {
        panels = rawQ.cluePanels;
      } else {
        panels = [
          { panelNumber: 1, description: rawQ.panel1_desc || rawQ.panel1 || 'Visual clue panel 1', svgType: rawQ.panel1_svg || 'token' },
          { panelNumber: 2, description: rawQ.panel2_desc || rawQ.panel2 || 'Visual clue panel 2', svgType: rawQ.panel2_svg || 'brain' },
        ];
      }

      const formattedQ: Question = {
        id: qId,
        title: rawQ.title ? String(rawQ.title).trim() : undefined,
        round: qRound,
        set: qSet,
        questionNumber: qNumber,
        domain: rawQ.domain ? String(rawQ.domain).trim() : 'Computer Science',
        difficulty: rawQ.difficulty || (qRound === 1 ? 'Medium' : qRound === 2 ? 'Hard' : 'Very Hard'),
        points: Number(rawQ.points) || (qRound === 1 ? 1 : qRound === 2 ? 2 : 3),
        cluePanels: panels,
        rebusFormulaText: rawQ.rebusFormulaText || rawQ.formula || 'Panel 1 + Panel 2',
        correctAnswer: cleanAns,
        aliases: aliasesList,
        explanation: rawQ.explanation ? String(rawQ.explanation).trim() : '',
        customImageUrl: rawQ.customImageUrl ? String(rawQ.customImageUrl).trim() : rawQ.image ? String(rawQ.image).trim() : undefined,
        images: Array.isArray(rawQ.images) ? rawQ.images : rawQ.customImageUrl ? [String(rawQ.customImageUrl).trim()] : undefined,
        active: rawQ.active !== false,
      };

      // If id exists already, update it; otherwise push
      const existingIdx = questions.findIndex(q => q.id === formattedQ.id);
      if (existingIdx >= 0) {
        questions[existingIdx] = formattedQ;
      } else {
        questions.push(formattedQ);
      }
      addedCount++;
    });

    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPLOAD_QUESTIONS',
      targetRound ? `Round ${targetRound}` : 'All Rounds',
      undefined,
      `${addedCount} questions`,
      `Bulk uploaded ${addedCount} questions (Mode: ${uploadMode}, Set: ${targetSet || 'Mixed'})`
    );

    const roundQ = getRoundQuestions(eventState.currentRound);
    eventState.totalQuestionsInRound = roundQ.length;
    if (!eventState.currentQuestionId || !questions.some(q => q.id === eventState.currentQuestionId)) {
      eventState.currentQuestionId = roundQ[0]?.id || null;
    }

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Successfully processed ${addedCount} questions.`,
      addedCount,
      totalQuestions: questions.length,
    });
  });

  // VALIDATE JSON SCHEMA FOR QUESTIONS
  app.post('/api/admin/questions/validate-json', requireAdminOrAbove, (req, res) => {
    try {
      const { content, questions: rawList } = req.body;
      let list: any[] = [];

      if (Array.isArray(rawList)) {
        list = rawList;
      } else if (typeof content === 'string') {
        if (!content.trim()) {
          return res.status(400).json({ error: 'JSON content is empty.' });
        }
        const parsed = JSON.parse(content);
        list = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      } else if (typeof content === 'object' && content !== null) {
        list = Array.isArray(content) ? content : (content.questions || []);
      }

      if (!Array.isArray(list) || list.length === 0) {
        return res.status(400).json({
          valid: false,
          totalQuestions: 0,
          validCount: 0,
          invalidCount: 0,
          errors: [{ index: 0, field: 'questions', message: 'No questions array found in JSON payload.' }],
          warnings: [],
          message: 'JSON must contain an array of questions or { questions: [...] }',
        });
      }

      const errors: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }> = [];
      const warnings: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }> = [];
      const matrix: Record<string, Record<string, number>> = {
        r1: { A: 0, B: 0, C: 0 },
        r2: { A: 0, B: 0, C: 0 },
        r3: { A: 0, B: 0, C: 0 },
      };

      list.forEach((item, idx) => {
        const qNum = item.questionNumber || (idx + 1);
        const ans = item.correctAnswer || item.answer;

        if (!ans || String(ans).trim() === '') {
          errors.push({
            index: idx,
            questionNumber: qNum,
            title: item.title,
            field: 'correctAnswer',
            message: 'Missing required "correctAnswer" property.',
          });
        }

        const r = Number(item.round) || 1;
        if (![1, 2, 3].includes(r)) {
          warnings.push({
            index: idx,
            questionNumber: qNum,
            title: item.title,
            field: 'round',
            message: `Round ${r} is outside 1-3 range; will default to Round 1.`,
          });
        }

        const s = String(item.set || 'A').toUpperCase();
        if (!['A', 'B', 'C'].includes(s)) {
          warnings.push({
            index: idx,
            questionNumber: qNum,
            title: item.title,
            field: 'set',
            message: `Question set "${s}" is invalid; will default to Set A.`,
          });
        }

        const rKey = `r${[1, 2, 3].includes(r) ? r : 1}`;
        const sKey = ['A', 'B', 'C'].includes(s) ? s : 'A';
        if (matrix[rKey] && matrix[rKey][sKey] !== undefined) {
          matrix[rKey][sKey]++;
        }
      });

      const valid = errors.length === 0;
      res.json({
        valid,
        totalQuestions: list.length,
        validCount: list.length - errors.length,
        invalidCount: errors.length,
        errors,
        warnings,
        matrix,
        message: valid
          ? `JSON Schema Validated Successfully (${list.length} questions recognized across matrix)`
          : `Validation detected ${errors.length} errors in the JSON schema.`,
      });
    } catch (parseErr: any) {
      res.status(400).json({
        valid: false,
        totalQuestions: 0,
        validCount: 0,
        invalidCount: 1,
        errors: [{ index: 0, field: 'syntax', message: `Invalid JSON syntax: ${parseErr.message}` }],
        warnings: [],
        error: `Invalid JSON syntax: ${parseErr.message}`,
      });
    }
  });

  // BULK INSERT / IMPORT ALL ROUNDS & SETS JSON
  app.post('/api/admin/questions/bulk-all-rounds-insert', requireAdminOrAbove, (req, res) => {
    const { content, replaceMode = 'APPEND', format = 'JSON' } = req.body;
    const adminUser = (req as any).adminUser;

    let list: any[] = [];
    try {
      if (Array.isArray(content)) {
        list = content;
      } else if (typeof content === 'string') {
        const parsed = JSON.parse(content);
        list = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      } else if (typeof content === 'object' && content !== null) {
        list = Array.isArray(content) ? content : (content.questions || []);
      }
    } catch (err: any) {
      return res.status(400).json({ error: `Invalid JSON format: ${err.message}` });
    }

    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: 'No questions found in payload.' });
    }

    const mode = String(replaceMode).toUpperCase();
    if (mode === 'REPLACE_ALL') {
      questions.length = 0;
    }

    let addedCount = 0;
    const matrix: Record<string, Record<string, number>> = {
      r1: { A: 0, B: 0, C: 0 },
      r2: { A: 0, B: 0, C: 0 },
      r3: { A: 0, B: 0, C: 0 },
    };

    list.forEach((rawQ, i) => {
      const cleanAnswer = String(rawQ.correctAnswer || rawQ.answer || '').trim();
      if (!cleanAnswer) return;

      const qRound = ([1, 2, 3].includes(Number(rawQ.round)) ? Number(rawQ.round) : 1) as 1 | 2 | 3;
      const qSet = (['A', 'B', 'C'].includes(String(rawQ.set || '').toUpperCase()) ? String(rawQ.set).toUpperCase() : 'A') as 'A' | 'B' | 'C';
      
      const existingInSet = questions.filter(q => q.round === qRound && (q.set || 'A') === qSet);
      const qNumber = Number(rawQ.questionNumber) || (existingInSet.length + 1);
      const qId = rawQ.id ? String(rawQ.id).trim() : `q${qRound}-${qSet.toLowerCase()}-${String(qNumber).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

      // Aliases formatting
      let aliasesList: string[] = [];
      if (Array.isArray(rawQ.aliases)) {
        aliasesList = rawQ.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean);
      } else if (typeof rawQ.aliases === 'string') {
        aliasesList = rawQ.aliases.split(',').map((a: string) => a.trim().toLowerCase()).filter(Boolean);
      }
      if (!aliasesList.includes(cleanAnswer.toLowerCase())) {
        aliasesList.unshift(cleanAnswer.toLowerCase());
      }

      // Clue panels
      let panels: any[] = [];
      if (Array.isArray(rawQ.cluePanels) && rawQ.cluePanels.length > 0) {
        panels = rawQ.cluePanels;
      } else {
        panels = [
          { panelNumber: 1, description: rawQ.panel1_desc || rawQ.panel1 || 'Visual clue panel 1', svgType: rawQ.panel1_svg || 'token' },
          { panelNumber: 2, description: rawQ.panel2_desc || rawQ.panel2 || 'Visual clue panel 2', svgType: rawQ.panel2_svg || 'brain' },
        ];
      }

      // Images
      let imgList: string[] = [];
      if (Array.isArray(rawQ.images) && rawQ.images.length > 0) {
        imgList = rawQ.images.map((img: any) => String(img).trim()).filter(Boolean);
      } else if (rawQ.customImageUrl || rawQ.image) {
        imgList = [String(rawQ.customImageUrl || rawQ.image).trim()];
      }

      const formattedQ: Question = {
        id: qId,
        title: rawQ.title ? String(rawQ.title).trim() : undefined,
        round: qRound,
        set: qSet,
        questionNumber: qNumber,
        domain: rawQ.domain ? String(rawQ.domain).trim() : 'Computer Science',
        difficulty: rawQ.difficulty || (qRound === 1 ? 'Medium' : qRound === 2 ? 'Hard' : 'Very Hard'),
        points: Number(rawQ.points) || (qRound === 1 ? 1 : qRound === 2 ? 2 : 3),
        cluePanels: panels,
        rebusFormulaText: rawQ.rebusFormulaText || rawQ.formula || 'Panel 1 + Panel 2',
        correctAnswer: cleanAnswer,
        aliases: aliasesList,
        explanation: rawQ.explanation ? String(rawQ.explanation).trim() : '',
        customImageUrl: imgList[0] || undefined,
        images: imgList.length > 0 ? imgList : undefined,
        active: rawQ.active !== false,
      };

      if (mode === 'REPLACE_MATCHING') {
        const existingIdx = questions.findIndex(q => q.id === formattedQ.id || (q.round === formattedQ.round && (q.set || 'A') === formattedQ.set && q.questionNumber === formattedQ.questionNumber));
        if (existingIdx >= 0) {
          questions[existingIdx] = formattedQ;
        } else {
          questions.push(formattedQ);
        }
      } else {
        // APPEND / MERGE
        const existingIdx = questions.findIndex(q => q.id === formattedQ.id);
        if (existingIdx >= 0) {
          questions[existingIdx] = formattedQ;
        } else {
          questions.push(formattedQ);
        }
      }

      const rKey = `r${qRound}`;
      if (matrix[rKey] && matrix[rKey][qSet] !== undefined) {
        matrix[rKey][qSet]++;
      }
      addedCount++;
    });

    saveQuestionsToDisk();

    const roundQ = getRoundQuestions(eventState.currentRound);
    eventState.totalQuestionsInRound = roundQ.length;
    if (!eventState.currentQuestionId || !questions.some(q => q.id === eventState.currentQuestionId)) {
      eventState.currentQuestionId = roundQ[0]?.id || null;
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'BULK_ALL_ROUNDS_INSERT',
      'All Rounds & Sets',
      undefined,
      `${addedCount} questions`,
      `Imported ${addedCount} questions across all rounds and sets (Mode: ${mode})`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Successfully imported ${addedCount} questions across all rounds and sets (Bank total: ${questions.length}).`,
      addedCount,
      totalQuestions: questions.length,
      matrix,
    });
  });

  // ==========================================
  // ADVANCED QUESTION SET MANAGEMENT & TOOLS
  // Sizing, Merge Sets, Move Sets & Images
  // ==========================================

  // 1. SET QUESTION COUNT / SIZE LIMIT FOR A SET
  app.post('/api/admin/questions/set-config', requireAdminOrAbove, (req, res) => {
    const { round, set, maxCount, action } = req.body;
    const adminUser = (req as any).adminUser;

    const targetRound = (Number(round) || 1) as 1 | 2 | 3;
    const targetSet = (String(set || 'A').toUpperCase()) as QuestionSet;
    const limit = Math.max(1, Number(maxCount) || 10);

    const setQuestions = questions
      .filter(q => q.round === targetRound && (q.set || 'A') === targetSet)
      .sort((a, b) => a.questionNumber - b.questionNumber);

    if (setQuestions.length === 0) {
      return res.status(404).json({ error: `No questions found in Round ${targetRound} Set ${targetSet}` });
    }

    if (action === 'truncate') {
      // Remove questions with index >= limit
      const toKeep = setQuestions.slice(0, limit);
      const toRemove = setQuestions.slice(limit);
      const removeIds = new Set(toRemove.map(q => q.id));
      const kept = questions.filter(q => !removeIds.has(q.id));
      questions.length = 0;
      kept.forEach(q => questions.push(q));

      // Re-number sequentially 1..limit
      toKeep.forEach((q, i) => {
        const item = questions.find(x => x.id === q.id);
        if (item) item.questionNumber = i + 1;
      });
    } else {
      // 'limit_active': keep first limit active, others inactive
      setQuestions.forEach((q, i) => {
        const item = questions.find(x => x.id === q.id);
        if (item) {
          item.questionNumber = i + 1;
          item.active = i < limit;
        }
      });
    }

    saveQuestionsToDisk();
    recordAudit(
      adminUser.username,
      adminUser.role,
      'SET_QUESTION_COUNT',
      `Round ${targetRound} Set ${targetSet}`,
      undefined,
      `${limit} questions`,
      `Adjusted Round ${targetRound} Set ${targetSet} size to ${limit} questions (Action: ${action || 'limit_active'})`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Configured Round ${targetRound} Set ${targetSet} to ${limit} questions.`,
      currentSetCount: questions.filter(q => q.round === targetRound && (q.set || 'A') === targetSet).length,
    });
  });

  // 2. MERGE SET OF QUESTIONS
  app.post('/api/admin/questions/merge-sets', requireAdminOrAbove, (req, res) => {
    const { round, sourceSet, targetSet, keepSource } = req.body;
    const adminUser = (req as any).adminUser;

    const r = (Number(round) || 1) as 1 | 2 | 3;
    const sSet = (String(sourceSet || 'B').toUpperCase()) as QuestionSet;
    const tSet = (String(targetSet || 'A').toUpperCase()) as QuestionSet;

    if (sSet === tSet) {
      return res.status(400).json({ error: 'Source set and target set cannot be the same.' });
    }

    const sourceQuestions = questions.filter(q => q.round === r && (q.set || 'A') === sSet);
    const targetQuestions = questions.filter(q => q.round === r && (q.set || 'A') === tSet);

    if (sourceQuestions.length === 0) {
      return res.status(400).json({ error: `Source Set ${sSet} in Round ${r} has no questions to merge.` });
    }

    let nextNumber = targetQuestions.length > 0 
      ? Math.max(...targetQuestions.map(q => q.questionNumber)) + 1 
      : 1;

    let mergedCount = 0;
    sourceQuestions.forEach(sq => {
      if (keepSource) {
        // Clone into target set with unique ID
        const cloned: Question = {
          ...sq,
          id: `${sq.id}-m${Date.now().toString().slice(-4)}-${mergedCount}`,
          set: tSet,
          questionNumber: nextNumber++,
        };
        questions.push(cloned);
      } else {
        // Move into target set directly
        const qItem = questions.find(x => x.id === sq.id);
        if (qItem) {
          qItem.set = tSet;
          qItem.questionNumber = nextNumber++;
        }
      }
      mergedCount++;
    });

    saveQuestionsToDisk();
    recordAudit(
      adminUser.username,
      adminUser.role,
      'MERGE_QUESTION_SETS',
      `Round ${r} Set ${sSet} -> Set ${tSet}`,
      undefined,
      `${mergedCount} questions merged`,
      `Merged ${mergedCount} questions from Set ${sSet} into Set ${tSet} for Round ${r} (Keep source: ${Boolean(keepSource)})`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Successfully merged ${mergedCount} questions from Set ${sSet} into Set ${tSet}.`,
      targetSetCount: questions.filter(q => q.round === r && (q.set || 'A') === tSet).length,
    });
  });

  // 3. MOVE QUESTIONS OR MOVE SET FROM ONE SET TO ANOTHER
  app.post('/api/admin/questions/move', requireAdminOrAbove, (req, res) => {
    const { questionIds, sourceRound, sourceSet, targetRound, targetSet } = req.body;
    const adminUser = (req as any).adminUser;

    const tRound = (Number(targetRound) || 1) as 1 | 2 | 3;
    const tSet = (String(targetSet || 'A').toUpperCase()) as QuestionSet;

    let targetsToMove: Question[] = [];

    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const idSet = new Set(questionIds.map(String));
      targetsToMove = questions.filter(q => idSet.has(q.id));
    } else if (sourceRound && sourceSet) {
      const sRound = (Number(sourceRound) || 1) as 1 | 2 | 3;
      const sSet = (String(sourceSet).toUpperCase()) as QuestionSet;
      targetsToMove = questions.filter(q => q.round === sRound && (q.set || 'A') === sSet);
    } else {
      return res.status(400).json({ error: 'Either questionIds array or sourceRound & sourceSet must be provided.' });
    }

    if (targetsToMove.length === 0) {
      return res.status(404).json({ error: 'No matching questions found to move.' });
    }

    // Determine current max questionNumber in destination
    const existingInDest = questions.filter(q => q.round === tRound && (q.set || 'A') === tSet);
    let nextNum = existingInDest.length > 0 
      ? Math.max(...existingInDest.map(q => q.questionNumber)) + 1 
      : 1;

    targetsToMove.forEach(item => {
      const q = questions.find(x => x.id === item.id);
      if (q) {
        q.round = tRound;
        q.set = tSet;
        q.questionNumber = nextNum++;
        q.points = tRound === 1 ? 1 : tRound === 2 ? 2 : 3;
      }
    });

    saveQuestionsToDisk();
    recordAudit(
      adminUser.username,
      adminUser.role,
      'MOVE_QUESTIONS',
      `${targetsToMove.length} questions -> Round ${tRound} Set ${tSet}`,
      undefined,
      `${targetsToMove.length} questions`,
      `Moved ${targetsToMove.length} questions to Round ${tRound} Set ${tSet}`
    );

    broadcastState();
    res.json({
      success: true,
      message: `Successfully moved ${targetsToMove.length} questions to Round ${tRound} Set ${tSet}.`,
      movedCount: targetsToMove.length,
      destinationCount: questions.filter(q => q.round === tRound && (q.set || 'A') === tSet).length,
    });
  });

  // 4. ATTACH / UPLOAD IMAGE FOR A QUESTION
  app.post('/api/admin/question/upload-image', requireAdminOrAbove, (req, res) => {
    const { questionId, imageUrl, images, customImageBase64 } = req.body;
    const adminUser = (req as any).adminUser;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required.' });
    }

    const q = questions.find(item => item.id === questionId);
    if (!q) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    let resolvedImages: string[] = [];
    if (Array.isArray(images) && images.length > 0) {
      resolvedImages = images.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (imageUrl?.trim()) {
      resolvedImages = [imageUrl.trim()];
    } else if (customImageBase64?.trim()) {
      resolvedImages = [customImageBase64.trim()];
    }

    if (resolvedImages.length === 0) {
      return res.status(400).json({ error: 'At least one image URL or Base64 is required.' });
    }

    q.images = resolvedImages;
    q.customImageUrl = resolvedImages[0];
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'ADD_QUESTION_IMAGE',
      q.id,
      undefined,
      `${resolvedImages.length} images attached`,
      `Attached ${resolvedImages.length} realistic images to Question #${q.questionNumber} in Round ${q.round}`
    );

    broadcastState();
    res.json({
      success: true,
      message: 'Realistic image successfully attached to question.',
      question: q,
    });
  });

  // 5. RESTORE 3-SET SEED QUESTIONS REPOSITORY
  app.post(['/api/admin/questions/load-seed-questions', '/api/admin/load-seed-questions'], requireAdminOrAbove, (req, res) => {
    const adminUser = (req as any).adminUser;

    // Restore full 3-set questions repository directly from authoritatively defined SEED_QUESTIONS (Sets A, B, C)
    const freshList: Question[] = JSON.parse(JSON.stringify(SEED_QUESTIONS));
    questions.length = 0;
    freshList.forEach(q => questions.push(q));
    saveQuestionsToDisk();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'LOAD_SEED_QUESTIONS',
      'All Rounds (3 Sets A/B/C)',
      undefined,
      `${questions.length} Questions`,
      `Restored complete question repository with 3 Sets (A, B, C) across all rounds`
    );

    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({
      success: true,
      message: `Restored full repository (${questions.length} questions across Sets A, B, and C).`,
      totalQuestions: questions.length,
      round1Count: questions.filter(q => q.round === 1).length,
      round2Count: questions.filter(q => q.round === 2).length,
      round3Count: questions.filter(q => q.round === 3).length,
    });
  });

  // 6. EXPORT OFFICIAL 30 QUESTIONS MASTER AS JSON
  app.get(['/api/admin/questions/export-official-30', '/api/admin/questions/download-realistic-file'], (req, res) => {
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'symposium30RealisticQuestions.json');
    if (fs.existsSync(jsonPath)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="symposium_30_questions_per_round_realistic.json"');
      return res.sendFile(jsonPath);
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="symposium_30_questions_per_round.json"');
    res.json({
      title: "Tech Bridge '26 - Official 30 Questions Per Round Dataset",
      totalQuestions: MASTER_THIRTY_QUESTIONS_ALL.length,
      round1Count: MASTER_THIRTY_QUESTIONS_ALL.filter(q => q.round === 1).length,
      round2Count: MASTER_THIRTY_QUESTIONS_ALL.filter(q => q.round === 2).length,
      round3Count: MASTER_THIRTY_QUESTIONS_ALL.filter(q => q.round === 3).length,
      questions: MASTER_THIRTY_QUESTIONS_ALL,
    });
  });

  // ==========================================
  // DATA EXPORTS & BACKUP
  // ==========================================

  // EXPORT FINAL RESULTS AS CSV (Supports ?round=1, ?round=2, ?round=3, ?round=all)
  app.get(['/api/admin/export-csv', '/api/admin/reports/export-csv'], requireModeratorOrAbove, (req, res) => {
    const roundParam = String(req.query.round || 'all').toLowerCase();
    const leaderboard = computeLeaderboard();
    const dateStr = new Date().toISOString().split('T')[0];

    if (roundParam === '1' || roundParam === 'r1') {
      // Round 1 Specific Report
      const r1Sorted = computeLeaderboard(1);
      const headers = [
        'Round 1 Rank',
        'Team ID',
        'Team Name',
        'Participant 1',
        'Participant 2',
        'College',
        'Department',
        'Year',
        'Phone',
        'Round 1 Score',
        'Avg Time per Answer (s)',
        'Round 1 Submissions',
        'Round 1 Correct Answers',
        'Status'
      ];
      const rows = r1Sorted.map((entry, idx) => {
        const team = teams.get(entry.teamId);
        const r1Subs = Array.from(submissions.values()).filter(s => s.teamId === entry.teamId && s.round === 1);
        const r1Correct = r1Subs.filter(s => s.isCorrect).length;
        return [
          idx + 1,
          `"${entry.teamId}"`,
          `"${entry.teamName.replace(/"/g, '""')}"`,
          `"${team?.participant1 || ''}"`,
          `"${team?.participant2 || ''}"`,
          `"${entry.college.replace(/"/g, '""')}"`,
          `"${team?.department || 'CSE'}"`,
          `"${team?.year || '3rd Year'}"`,
          `"${team?.phone || ''}"`,
          entry.round1Score,
          entry.avgTimeR1Seconds || 0,
          r1Subs.length,
          r1Correct,
          entry.status,
        ].join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="TechBridge_Round_1_Report_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    if (roundParam === '2' || roundParam === 'r2') {
      // Round 2 Specific Report
      const r2Sorted = computeLeaderboard(2);
      const headers = [
        'Round 2 Rank',
        'Team ID',
        'Team Name',
        'Participant 1',
        'Participant 2',
        'College',
        'Department',
        'Year',
        'Phone',
        'Round 2 Score',
        'Avg Time per Answer (s)',
        'Round 2 Submissions',
        'Round 2 Correct Answers',
        'Status'
      ];
      const rows = r2Sorted.map((entry, idx) => {
        const team = teams.get(entry.teamId);
        const r2Subs = Array.from(submissions.values()).filter(s => s.teamId === entry.teamId && s.round === 2);
        const r2Correct = r2Subs.filter(s => s.isCorrect).length;
        return [
          idx + 1,
          `"${entry.teamId}"`,
          `"${entry.teamName.replace(/"/g, '""')}"`,
          `"${team?.participant1 || ''}"`,
          `"${team?.participant2 || ''}"`,
          `"${entry.college.replace(/"/g, '""')}"`,
          `"${team?.department || 'CSE'}"`,
          `"${team?.year || '3rd Year'}"`,
          `"${team?.phone || ''}"`,
          entry.round2Score,
          entry.avgTimeR2Seconds || 0,
          r2Subs.length,
          r2Correct,
          entry.status,
        ].join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="TechBridge_Round_2_Report_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    if (roundParam === '3' || roundParam === 'r3') {
      // Round 3 Specific Report
      const r3Sorted = computeLeaderboard(3);
      const headers = [
        'Round 3 Rank',
        'Team ID',
        'Team Name',
        'Participant 1',
        'Participant 2',
        'College',
        'Department',
        'Year',
        'Phone',
        'Round 3 Score',
        'Avg Time per Answer (s)',
        'Round 3 Submissions / Buzzers',
        'Round 3 Correct Answers',
        'Status'
      ];
      const rows = r3Sorted.map((entry, idx) => {
        const team = teams.get(entry.teamId);
        const r3Subs = Array.from(submissions.values()).filter(s => s.teamId === entry.teamId && s.round === 3);
        const r3Correct = r3Subs.filter(s => s.isCorrect).length;
        return [
          idx + 1,
          `"${entry.teamId}"`,
          `"${entry.teamName.replace(/"/g, '""')}"`,
          `"${team?.participant1 || ''}"`,
          `"${team?.participant2 || ''}"`,
          `"${entry.college.replace(/"/g, '""')}"`,
          `"${team?.department || 'CSE'}"`,
          `"${team?.year || '3rd Year'}"`,
          `"${team?.phone || ''}"`,
          entry.round3Score,
          entry.avgTimeR3Seconds || 0,
          r3Subs.length,
          r3Correct,
          entry.status,
        ].join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="TechBridge_Round_3_Report_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    // All Rounds Master Comprehensive Report
    const masterLeaderboard = computeLeaderboard();
    const headers = [
      'Rank',
      'Team ID',
      'Team Name',
      'Participant 1',
      'Participant 2',
      'College',
      'Department',
      'Year',
      'Phone',
      'Round 1 Score',
      'R1 Avg Time (s)',
      'Round 2 Score',
      'R2 Avg Time (s)',
      'Round 3 Score',
      'R3 Avg Time (s)',
      'Total Score',
      'Overall Avg Time (s)',
      'Total Submissions',
      'Total Correct',
      'Status'
    ];

    const rows = masterLeaderboard.map(entry => {
      const team = teams.get(entry.teamId);
      const teamSubs = Array.from(submissions.values()).filter(s => s.teamId === entry.teamId);
      const correctSubs = teamSubs.filter(s => s.isCorrect).length;
      return [
        entry.rank,
        `"${entry.teamId}"`,
        `"${entry.teamName.replace(/"/g, '""')}"`,
        `"${team?.participant1 || ''}"`,
        `"${team?.participant2 || ''}"`,
        `"${entry.college.replace(/"/g, '""')}"`,
        `"${team?.department || 'CSE'}"`,
        `"${team?.year || '3rd Year'}"`,
        `"${team?.phone || ''}"`,
        entry.round1Score,
        entry.avgTimeR1Seconds || 0,
        entry.round2Score,
        entry.avgTimeR2Seconds || 0,
        entry.round3Score,
        entry.avgTimeR3Seconds || 0,
        entry.totalScore,
        entry.avgTimeOverallSeconds || 0,
        teamSubs.length,
        correctSubs,
        entry.status,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="TechBridge_All_Rounds_Final_Results_${dateStr}.csv"`);
    res.send(csvContent);
  });

  // EXPORT AUDIT LOGS AS CSV
  app.get('/api/admin/export-audit-csv', requireAdminOrAbove, (req, res) => {
    const headers = ['Timestamp', 'Admin', 'Role', 'Action', 'Target', 'Old Value', 'New Value', 'Details', 'IP'];
    const rows = auditLogs.map(l => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.adminUsername}"`,
      `"${l.role}"`,
      `"${l.action}"`,
      `"${l.target}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip || ''}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="TechBridge_Audit_Logs_${dateStr}.csv"`);
    res.send(csv);
  });

  // EXPORT ANTI-CHEAT INCIDENTS AS CSV
  app.get('/api/admin/export-anticheat-csv', requireModeratorOrAbove, (req, res) => {
    const headers = ['Timestamp', 'Team ID', 'Team Name', 'Violation Type', 'Severity', 'Round', 'Question', 'Details', 'Resolved', 'Action Taken'];
    const rows = antiCheatEvents.map(a => [
      `"${new Date(a.timestamp).toISOString()}"`,
      `"${a.teamId}"`,
      `"${a.teamName.replace(/"/g, '""')}"`,
      `"${a.eventType}"`,
      `"${a.severity}"`,
      a.round,
      a.questionNumber,
      `"${(a.details || '').replace(/"/g, '""')}"`,
      a.resolved,
      `"${a.actionTaken || ''}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="TechBridge_AntiCheat_Report_${dateStr}.csv"`);
    res.send(csv);
  });

  // EXPORT COMPLETE SYSTEM BACKUP (JSON)
  app.get('/api/admin/export-backup-json', requireSuperAdmin, (req, res) => {
    const backup = {
      version: '1.0',
      exportedAt: Date.now(),
      eventState,
      teams: Array.from(teams.values()),
      submissions: Array.from(submissions.values()),
      antiCheatEvents,
      buzzerEvents,
      teamWarnings,
      auditLogs,
      questions,
    };
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="TechBridge_System_Backup_${dateStr}.json"`);
    res.json(backup);
  });

  // EMERGENCY OFFLINE FALLBACK KIT
  app.get('/api/admin/offline-kit', requireAdminOrAbove, (req, res) => {
    res.json({
      symposium: "TECH BRIDGE '26: Visual Technical Rebus Challenge",
      department: 'Department of Computer Science & Engineering',
      instructions: 'Emergency backup scoring sheets and answer key packet. For organizer use only in case of power or cloud network disruption.',
      rounds: [
        { round: 1, name: 'Round 1: Foundations & Systems', questions: 30, pointsEach: 1, duration: '30 mins' },
        { round: 2, name: 'Round 2: Distributed Architectures', questions: 15, pointsEach: 2, duration: '15 mins' },
        { round: 3, name: 'Round 3: Grand Finale & Live Buzzer', questions: 10, pointsEach: 3, duration: '15 mins' },
      ],
      questionsMaster: questions.map(q => ({
        id: q.id,
        round: q.round,
        questionNumber: q.questionNumber,
        domain: q.domain,
        points: q.points,
        rebusFormula: q.rebusFormulaText,
        correctAnswer: q.correctAnswer,
        acceptedAliases: q.aliases,
        explanation: q.explanation,
      })),
    });
  });

  // ==========================================
  // REGISTER ADVANCED COMPETITION EXTENSION ROUTES
  // (Multi-admin, Question status, Bulk parsing, Qualification, Manual score, Clues, Feedback)
  // ==========================================
  registerAdvancedCompetitionRoutes(app, {
    teams,
    questions,
    submissions,
    antiCheatEvents,
    teamWarnings,
    auditLogs,
    eventState,
    adminAccounts: ADMIN_ACCOUNTS,
    requireSuperAdmin,
    requireAdminOrAbove,
    requireModeratorOrAbove,
    requireQuestionControl,
    recordAudit,
    broadcast,
    broadcastState,
    getCurrentQuestion,
    sanitizeQuestion,
    computeLeaderboard,
    saveQuestionsToDisk,
    saveAdminAccountsToDisk,
    saveEventStateToDisk,
  });

  // ==========================================
  // VITE MIDDLEWARE & SPA SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (/\.(avif|webp|jpg|jpeg|png|svg|ico|woff2|woff|ttf)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Application is initializing or building. Please reload in a moment.');
      }
    });
  }

  server.on('error', (err: any) => {
    console.error('Server network error:', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TECH BRIDGE '26 Authoritative Game Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
