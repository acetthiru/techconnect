import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import {
  EventState,
  Team,
  Submission,
  AntiCheatEvent,
  Question,
  AdminRole,
  AuditLogEntry,
  TeamWarning,
  RoundNumber,
  QuestionSet,
  ManualScoreAdjustment,
  EventFeedback,
  ImportReviewItem,
  QuestionClue,
} from '../src/types';

export interface AdminAccount {
  username: string;
  passwordHash: string;
  role: AdminRole;
  name?: string;
  disabled?: boolean;
  createdAt?: number;
  lastLogin?: number;
}

export interface AdvancedRoutesOptions {
  teams: Map<string, Team>;
  questions: Question[];
  submissions: Map<string, Submission>;
  antiCheatEvents: AntiCheatEvent[];
  teamWarnings: TeamWarning[];
  auditLogs: AuditLogEntry[];
  eventState: EventState;
  adminAccounts: AdminAccount[];
  requireSuperAdmin: any;
  requireAdminOrAbove: any;
  requireModeratorOrAbove: any;
  requireQuestionControl?: any;
  recordAudit: (
    adminUsername: string,
    role: AdminRole,
    action: string,
    target: string,
    oldValue?: string,
    newValue?: string,
    details?: string,
    ip?: string
  ) => void;
  broadcast: (type: string, payload: any) => void;
  broadcastState: () => void;
  getCurrentQuestion: (teamId?: string) => Question | null;
  sanitizeQuestion: (q: Question | null, teamId?: string) => any;
  computeLeaderboard: (selectedRound?: number) => any[];
  saveQuestionsToDisk?: () => void;
  saveAdminAccountsToDisk?: () => void;
  saveEventStateToDisk?: () => void;
}

export function registerAdvancedCompetitionRoutes(app: any, opts: AdvancedRoutesOptions) {
  const {
    teams,
    questions,
    submissions,
    antiCheatEvents,
    teamWarnings,
    auditLogs,
    eventState,
    adminAccounts,
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
  } = opts;

  // Persistent and in-memory state collections
  const manualScoreAdjustments: ManualScoreAdjustment[] = [];
  const importReviewQueue: ImportReviewItem[] = [];

  const DATA_DIR = path.join(process.cwd(), 'data');
  const FEEDBACK_FILE = path.join(DATA_DIR, 'event_feedback.json');
  
  function loadFeedbacks(): EventFeedback[] {
    try {
      if (fs.existsSync(FEEDBACK_FILE)) {
        const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading feedback file:', e);
    }
    return [];
  }

  function saveFeedbacks(list: EventFeedback[]) {
    try {
      const dir = path.dirname(FEEDBACK_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving feedback file:', e);
    }
  }

  const eventFeedbacks: EventFeedback[] = loadFeedbacks();

  // ==========================================
  // 1. MULTIPLE ADMIN MANAGEMENT (SUPER ADMIN & ADMIN)
  // ==========================================
  app.get('/api/admin/accounts', requireAdminOrAbove, (req: Request, res: Response) => {
    const list = adminAccounts.map(a => ({
      username: a.username,
      role: a.role,
      name: a.name || a.username,
      disabled: Boolean(a.disabled),
      createdAt: a.createdAt || Date.now(),
      lastLogin: a.lastLogin,
    }));
    res.json({ accounts: list });
  });

  app.post('/api/admin/accounts', requireAdminOrAbove, async (req: Request, res: Response) => {
    const { username, password, role, name } = req.body;
    const adminUser = (req as any).adminUser;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    const cleanUsername = username.trim().toUpperCase();
    if (adminAccounts.some(a => a.username.toUpperCase() === cleanUsername)) {
      return res.status(409).json({ error: `Admin username '${cleanUsername}' already exists` });
    }

    // Only Super Admin can assign Super Admin role
    const assignedRole = role as AdminRole;
    if (assignedRole === 'SUPER_ADMIN' && adminUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only a Super Admin can create another Super Admin account.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newAdmin: AdminAccount = {
      username: cleanUsername,
      passwordHash,
      role: assignedRole,
      name: name?.trim() || cleanUsername,
      disabled: false,
      createdAt: Date.now(),
    };

    adminAccounts.push(newAdmin);
    saveAdminAccountsToDisk?.();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'CREATE_ADMIN_ACCOUNT',
      cleanUsername,
      undefined,
      assignedRole,
      `Created administrator account '${cleanUsername}' with role ${assignedRole}`
    );

    res.json({
      success: true,
      message: `Admin account '${cleanUsername}' created successfully and saved permanently.`,
      account: {
        username: newAdmin.username,
        role: newAdmin.role,
        name: newAdmin.name,
        disabled: false,
        createdAt: newAdmin.createdAt,
      },
    });
  });

  app.put('/api/admin/accounts/:username', requireAdminOrAbove, async (req: Request, res: Response) => {
    const targetUsername = req.params.username.trim().toUpperCase();
    const { role, name, disabled, password } = req.body;
    const adminUser = (req as any).adminUser;

    const account = adminAccounts.find(a => a.username.toUpperCase() === targetUsername);
    if (!account) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    // If target account is Super Admin and requester is not Super Admin, block
    if (account.role === 'SUPER_ADMIN' && adminUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only a Super Admin can modify a Super Admin account.' });
    }

    // If setting role to Super Admin and requester is not Super Admin, block
    if (role === 'SUPER_ADMIN' && adminUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only a Super Admin can promote an account to Super Admin.' });
    }

    if (role) account.role = role;
    if (name !== undefined) account.name = name;
    if (disabled !== undefined) account.disabled = Boolean(disabled);
    if (password && password.trim()) {
      account.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    saveAdminAccountsToDisk?.();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'UPDATE_ADMIN_ACCOUNT',
      targetUsername,
      undefined,
      role || undefined,
      `Updated admin settings (Role: ${account.role}, Disabled: ${account.disabled})`
    );

    res.json({
      success: true,
      message: `Admin account '${targetUsername}' updated successfully`,
      account: {
        username: account.username,
        role: account.role,
        name: account.name,
        disabled: account.disabled,
      },
    });
  });

  app.delete('/api/admin/accounts/:username', requireAdminOrAbove, (req: Request, res: Response) => {
    const targetUsername = req.params.username.trim().toUpperCase();
    const adminUser = (req as any).adminUser;

    if (adminUser.username.toUpperCase() === targetUsername) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account' });
    }

    const idx = adminAccounts.findIndex(a => a.username.toUpperCase() === targetUsername);
    if (idx === -1) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    // If target is Super Admin and requester is not Super Admin, reject
    if (adminAccounts[idx].role === 'SUPER_ADMIN' && adminUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only a Super Admin can delete another Super Admin account.' });
    }

    const removed = adminAccounts.splice(idx, 1)[0];
    saveAdminAccountsToDisk?.();

    recordAudit(
      adminUser.username,
      adminUser.role,
      'DELETE_ADMIN_ACCOUNT',
      targetUsername,
      removed.role,
      undefined,
      `Permanently removed administrator account ${targetUsername}`
    );

    res.json({ success: true, message: `Admin account '${targetUsername}' removed` });
  });

  // ==========================================
  // 2. ANSWERED / NOT ANSWERED TEAM MONITORING (SECTION 3)
  // ==========================================
  app.get('/api/admin/question/:questionId/team-status', requireModeratorOrAbove, (req: Request, res: Response) => {
    const { questionId } = req.params;
    let targetQuestion = questions.find(q => q.id === questionId);
    if (!targetQuestion) {
      targetQuestion = getCurrentQuestion() || undefined;
    }

    if (!targetQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const activeTeams = Array.from(teams.values()).filter(t => t.status !== 'DISQUALIFIED');
    const answeredTeams: any[] = [];
    const notAnsweredTeams: any[] = [];
    let correctCount = 0;
    let incorrectCount = 0;

    activeTeams.forEach(team => {
      const subKey = `${team.id}_${targetQuestion!.id}`;
      const sub = submissions.get(subKey);
      if (sub) {
        if (sub.isCorrect) correctCount++;
        else incorrectCount++;
        answeredTeams.push({
          teamId: team.id,
          teamName: team.name,
          college: team.college,
          currentQuestionId: team.currentQuestionId || targetQuestion!.id,
          submittedAnswer: sub.submittedAnswer,
          isCorrect: sub.isCorrect,
          submittedAt: sub.submittedAt,
          pointsAwarded: sub.pointsAwarded,
          status: team.status,
        });
      } else {
        notAnsweredTeams.push({
          teamId: team.id,
          teamName: team.name,
          college: team.college,
          currentQuestionId: team.currentQuestionId || targetQuestion!.id,
          status: team.status,
          lastActive: team.lastActive,
          isOnline: team.isOnline,
        });
      }
    });

    res.json({
      questionId: targetQuestion.id,
      questionNumber: targetQuestion.questionNumber,
      round: targetQuestion.round,
      domain: targetQuestion.domain,
      totalTeams: activeTeams.length,
      answeredCount: answeredTeams.length,
      notAnsweredCount: notAnsweredTeams.length,
      correctCount,
      incorrectCount,
      answeredTeams,
      notAnsweredTeams,
      updatedAt: Date.now(),
    });
  });

  // ==========================================
  // 3. TEAM-SPECIFIC QUESTION CONTROL (SECTION 25)
  // ==========================================
  app.post('/api/admin/teams/set-question', requireAdminOrAbove, (req: Request, res: Response) => {
    const { target, teamIds, questionId, reason } = req.body;
    const adminUser = (req as any).adminUser;

    if (!target || !questionId) {
      return res.status(400).json({ error: 'Target and questionId are required' });
    }

    const targetQ = questions.find(q => q.id === questionId);
    if (!targetQ) {
      return res.status(404).json({ error: 'Target question not found' });
    }

    let affectedCount = 0;
    if (target === 'ALL') {
      // Clear specific overrides or set round question index
      const roundQuestions = questions.filter(q => q.round === targetQ.round);
      const qIndex = roundQuestions.findIndex(q => q.id === targetQ.id);
      if (qIndex !== -1) {
        eventState.currentRound = targetQ.round;
        eventState.currentQuestionIndex = qIndex;
        eventState.currentQuestionId = targetQ.id;
      }
      // Reset team specific overrides
      teams.forEach(t => {
        t.currentQuestionId = targetQ.id;
        affectedCount++;
      });
    } else if (target === 'SELECTED' || target === 'INDIVIDUAL') {
      const ids: string[] = Array.isArray(teamIds) ? teamIds : [teamIds];
      ids.forEach(id => {
        const team = teams.get(id);
        if (team) {
          team.currentQuestionId = targetQ.id;
          affectedCount++;
        }
      });
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'SET_TEAM_QUESTION',
      `${target}: ${affectedCount} teams`,
      undefined,
      targetQ.id,
      `Assigned Question ${targetQ.questionNumber} (R${targetQ.round}) to ${target}. Reason: ${reason || 'Manual assignment'}`
    );

    broadcast('TEAM_QUESTION_CHANGED', {
      target,
      questionId: targetQ.id,
      questionNumber: targetQ.questionNumber,
      round: targetQ.round,
      affectedTeamIds: teamIds || 'ALL',
    });

    broadcastState();

    res.json({
      success: true,
      message: `Assigned Question ${targetQ.questionNumber} to ${affectedCount} team(s)`,
      affectedCount,
      questionId: targetQ.id,
    });
  });

  // Reset team question assignment back to default round index
  app.post('/api/admin/teams/reset-question', requireAdminOrAbove, (req: Request, res: Response) => {
    const { teamIds } = req.body;
    const adminUser = (req as any).adminUser;

    const ids: string[] = Array.isArray(teamIds) ? teamIds : Array.from(teams.keys());
    ids.forEach(id => {
      const team = teams.get(id);
      if (team) {
        delete team.currentQuestionId;
      }
    });

    recordAudit(
      adminUser.username,
      adminUser.role,
      'RESET_TEAM_QUESTION',
      `${ids.length} teams`,
      undefined,
      'DEFAULT_SYNC',
      'Reset team question overrides to synchronized round question'
    );

    broadcastState();
    res.json({ success: true, message: `Reset question assignment for ${ids.length} team(s)` });
  });

  // ==========================================
  // 4. MANUAL SCORE ADJUSTMENTS (SECTION 26)
  // ==========================================
  app.post('/api/admin/scores/adjust', requireAdminOrAbove, (req: Request, res: Response) => {
    const { target, teamIds, round, adjustmentType, amount, reason } = req.body;
    const adminUser = (req as any).adminUser;

    if (!target || !adjustmentType || amount === undefined || !reason?.trim()) {
      return res.status(400).json({ error: 'Target, adjustmentType, amount, and reason are required' });
    }

    const rNum = (Number(round) || eventState.currentRound) as RoundNumber;
    const delta = Number(amount);
    const targetTeams: Team[] = [];

    if (target === 'ALL') {
      teams.forEach(t => {
        if (t.status !== 'DISQUALIFIED') targetTeams.push(t);
      });
    } else {
      const ids: string[] = Array.isArray(teamIds) ? teamIds : [teamIds];
      ids.forEach(id => {
        const t = teams.get(id);
        if (t) targetTeams.push(t);
      });
    }

    if (targetTeams.length === 0) {
      return res.status(404).json({ error: 'No valid teams found for adjustment' });
    }

    const createdAdjustments: ManualScoreAdjustment[] = [];

    targetTeams.forEach(team => {
      let currentRoundScore = rNum === 1 ? team.round1Score : rNum === 2 ? team.round2Score : team.round3Score;
      let newRoundScore = currentRoundScore;

      if (adjustmentType === 'ADD') {
        newRoundScore = currentRoundScore + delta;
      } else if (adjustmentType === 'SUBTRACT') {
        newRoundScore = Math.max(0, currentRoundScore - delta);
      } else if (adjustmentType === 'SET') {
        newRoundScore = Math.max(0, delta);
      }

      const scoreDelta = newRoundScore - currentRoundScore;

      if (rNum === 1) team.round1Score = newRoundScore;
      else if (rNum === 2) team.round2Score = newRoundScore;
      else if (rNum === 3) team.round3Score = newRoundScore;

      team.totalScore = team.round1Score + team.round2Score + team.round3Score;
      team.manualScoreAdjustment = (team.manualScoreAdjustment || 0) + scoreDelta;

      const record: ManualScoreAdjustment = {
        id: `adj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        teamId: team.id,
        teamName: team.name,
        adminUsername: adminUser.username,
        round: rNum,
        oldScore: currentRoundScore,
        newScore: newRoundScore,
        adjustment: scoreDelta,
        reason: reason.trim(),
        timestamp: Date.now(),
      };

      manualScoreAdjustments.unshift(record);
      createdAdjustments.push(record);

      recordAudit(
        adminUser.username,
        adminUser.role,
        'MANUAL_SCORE_ADJUSTMENT',
        team.name,
        String(currentRoundScore),
        String(newRoundScore),
        `Adjusted R${rNum} by ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}. Reason: ${reason}`
      );
    });

    broadcast('SCORE_UPDATED', { adjustments: createdAdjustments });
    broadcastState();

    res.json({
      success: true,
      message: `Adjusted score for ${targetTeams.length} team(s)`,
      adjustments: createdAdjustments,
    });
  });

  app.get('/api/admin/scores/history', requireModeratorOrAbove, (req: Request, res: Response) => {
    res.json({ adjustments: manualScoreAdjustments });
  });

  // ==========================================
  // 5. DYNAMIC CLUE CONTROL (SECTION 27 & 15)
  // ==========================================
  app.post('/api/admin/clues/toggle', requireAdminOrAbove, (req: Request, res: Response) => {
    const { questionId, clueId, enabled, target, teamIds } = req.body;
    const adminUser = (req as any).adminUser;

    if (!questionId || !clueId) {
      return res.status(400).json({ error: 'questionId and clueId are required' });
    }

    if (!eventState.activeCluesByQuestion) {
      eventState.activeCluesByQuestion = {};
    }

    const isAll = target === 'ALL';
    const activeTargetTeamIds = Array.isArray(teamIds) ? teamIds : [];

    if (enabled) {
      eventState.activeCluesByQuestion[clueId] = {
        allTeams: isAll,
        teamIds: isAll ? [] : activeTargetTeamIds,
      };

      if (!isAll) {
        activeTargetTeamIds.forEach((tid: string) => {
          const team = teams.get(tid);
          if (team) {
            team.enabledClues = Array.from(new Set([...(team.enabledClues || []), clueId]));
          }
        });
      }
    } else {
      delete eventState.activeCluesByQuestion[clueId];
      teams.forEach(team => {
        if (team.enabledClues) {
          team.enabledClues = team.enabledClues.filter(c => c !== clueId);
        }
      });
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'TOGGLE_DYNAMIC_CLUE',
      `Question ${questionId} - Clue ${clueId}`,
      undefined,
      enabled ? `ENABLED (${target})` : 'DISABLED',
      `Admin toggled clue visibility for ${target}`
    );

    broadcast('CLUES_UPDATED', {
      questionId,
      clueId,
      enabled,
      activeClues: eventState.activeCluesByQuestion,
    });

    broadcastState();
    res.json({ success: true, message: `Clue ${clueId} ${enabled ? 'enabled' : 'disabled'} for ${target}` });
  });

  // ==========================================
  // 6. QUALIFICATION SYSTEM (SECTION 28)
  // ==========================================
  app.get('/api/admin/qualification/preview', requireAdminOrAbove, (req: Request, res: Response) => {
    const round = Number(req.query.round) || eventState.currentRound;
    const topCount = Number(req.query.topCount) || 10;

    const allTeams = Array.from(teams.values()).filter(t => t.status !== 'DISQUALIFIED');

    // Sort by score for the specified round (fallback to totalScore)
    allTeams.sort((a, b) => {
      const scoreA = round === 1 ? a.round1Score : round === 2 ? a.round2Score : a.round3Score;
      const scoreB = round === 1 ? b.round1Score : round === 2 ? b.round2Score : b.round3Score;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.totalScore - a.totalScore;
    });

    const ranked = allTeams.map((team, idx) => {
      const rScore = round === 1 ? team.round1Score : round === 2 ? team.round2Score : team.round3Score;
      return {
        rank: idx + 1,
        teamId: team.id,
        teamName: team.name,
        college: team.college,
        roundScore: rScore,
        totalScore: team.totalScore,
        isQualified: idx < topCount,
      };
    });

    const cutOffScore = ranked[topCount - 1]?.roundScore ?? 0;
    // Identify ties at cut boundary
    const boundaryTies = ranked.filter(t => t.roundScore === cutOffScore);

    res.json({
      round,
      topCount,
      cutOffScore,
      totalTeams: ranked.length,
      qualifiedCount: Math.min(topCount, ranked.length),
      teams: ranked,
      hasBoundaryTies: boundaryTies.length > 1,
      boundaryTies,
    });
  });

  app.post('/api/admin/qualification/apply', requireAdminOrAbove, (req: Request, res: Response) => {
    const { round, qualifiedTeamIds, disqualifiedTeamIds } = req.body;
    const adminUser = (req as any).adminUser;

    if (!Array.isArray(qualifiedTeamIds)) {
      return res.status(400).json({ error: 'qualifiedTeamIds array is required' });
    }

    const rNum = Number(round) || eventState.currentRound;
    let qualifiedCount = 0;
    let disqualifiedCount = 0;

    teams.forEach(team => {
      if (qualifiedTeamIds.includes(team.id)) {
        team.isQualified = true;
        team.qualificationRound = rNum;
        qualifiedCount++;
      } else {
        team.isQualified = false;
        if (disqualifiedTeamIds?.includes(team.id)) {
          team.status = 'DISQUALIFIED';
          team.lockReason = `Eliminated after Round ${rNum} qualification cutoff.`;
          disqualifiedCount++;
        }
      }
    });

    recordAudit(
      adminUser.username,
      adminUser.role,
      'APPLY_ROUND_QUALIFICATION',
      `Round ${rNum}`,
      undefined,
      `${qualifiedCount} qualified`,
      `Applied qualification cut for Round ${rNum}: ${qualifiedCount} teams advanced, ${disqualifiedCount} eliminated.`
    );

    broadcastState();

    res.json({
      success: true,
      message: `Qualification applied: ${qualifiedCount} teams qualified for next stage`,
      qualifiedCount,
      disqualifiedCount,
    });
  });

  app.post('/api/admin/qualification/override', requireAdminOrAbove, (req: Request, res: Response) => {
    const { teamId, isQualified, reason } = req.body;
    const adminUser = (req as any).adminUser;

    const team = teams.get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    team.isQualified = Boolean(isQualified);
    if (isQualified && team.status === 'DISQUALIFIED') {
      team.status = 'ACTIVE';
      delete team.lockReason;
    }

    recordAudit(
      adminUser.username,
      adminUser.role,
      'QUALIFICATION_OVERRIDE',
      team.name,
      String(!isQualified),
      String(isQualified),
      `Manual qualification status override. Reason: ${reason || 'Admin discretion'}`
    );

    broadcastState();
    res.json({ success: true, message: `Updated qualification status for ${team.name}`, team });
  });

  // ==========================================
  // 7. BULK IMPORT & ALL-ROUNDS / ALL-SETS MASTER IMPORT (SECTIONS 18-20)
  // ==========================================

  // Helper function: Universal Multi-Round & Multi-Set Question Parser
  const parseQuestionsFromRawContent = (
    content: string,
    format: string,
    defaultRound: RoundNumber = 1,
    defaultSet: QuestionSet = 'A'
  ): ImportReviewItem[] => {
    const detectedItems: ImportReviewItem[] = [];
    const rawText = content.trim();

    if (format === 'JSON' || (format === 'AUTO' && (rawText.startsWith('[') || rawText.startsWith('{')))) {
      try {
        const parsed = JSON.parse(rawText);
        let list: any[] = [];

        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // Check if structured as { questions: [...] }
          if (Array.isArray(parsed.questions)) {
            list = parsed.questions;
          } else {
            // Check if structured as { round1: { setA: [...], setB: [...] }, round2: ... }
            for (const rKey of Object.keys(parsed)) {
              const rVal = parsed[rKey];
              let rNum: RoundNumber = defaultRound;
              if (/1/i.test(rKey)) rNum = 1;
              else if (/2/i.test(rKey)) rNum = 2;
              else if (/3/i.test(rKey)) rNum = 3;

              if (Array.isArray(rVal)) {
                rVal.forEach((item: any) => list.push({ ...item, round: item.round || rNum }));
              } else if (rVal && typeof rVal === 'object') {
                for (const sKey of Object.keys(rVal)) {
                  let sName: QuestionSet = defaultSet;
                  if (/A/i.test(sKey)) sName = 'A';
                  else if (/B/i.test(sKey)) sName = 'B';
                  else if (/C/i.test(sKey)) sName = 'C';

                  const sVal = rVal[sKey];
                  if (Array.isArray(sVal)) {
                    sVal.forEach((item: any) => list.push({ ...item, round: item.round || rNum, set: item.set || sName }));
                  }
                }
              }
            }
          }
        }

        list.forEach((item: any, idx: number) => {
          let itemRound: RoundNumber = defaultRound;
          if (item.round === 1 || item.round === '1' || item.round === 'Round 1') itemRound = 1;
          else if (item.round === 2 || item.round === '2' || item.round === 'Round 2') itemRound = 2;
          else if (item.round === 3 || item.round === '3' || item.round === 'Round 3') itemRound = 3;

          let itemSet: QuestionSet = defaultSet;
          if (item.set === 'A' || item.set === 'Set A') itemSet = 'A';
          else if (item.set === 'B' || item.set === 'Set B') itemSet = 'B';
          else if (item.set === 'C' || item.set === 'Set C') itemSet = 'C';

          detectedItems.push({
            id: `rev-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            questionNumber: item.questionNumber || idx + 1,
            title: item.title || item.prompt || `Question ${item.questionNumber || idx + 1}`,
            round: itemRound,
            set: itemSet,
            domain: item.domain || 'Computer Science',
            difficulty: item.difficulty || (itemRound === 1 ? 'Medium' : itemRound === 2 ? 'Hard' : 'Very Hard'),
            points: item.points || (itemRound === 1 ? 1 : itemRound === 2 ? 2 : 3),
            correctAnswer: item.correctAnswer || item.answer || '',
            aliases: Array.isArray(item.aliases) ? item.aliases : (item.aliases ? String(item.aliases).split(',').map(s => s.trim()) : []),
            explanation: item.explanation || item.notes || '',
            status: 'PENDING_REVIEW',
            confidence: (item.correctAnswer || item.answer) ? 'HIGH' : 'MEDIUM',
            detectedFrom: 'JSON Bulk Import',
            cluePanels: item.cluePanels || [
              { panelNumber: 1, description: item.clue1 || item.title || 'Visual Clue 1', svgType: 'brain' },
              { panelNumber: 2, description: item.clue2 || 'Visual Clue 2', svgType: 'cpu' },
            ],
            rebusFormulaText: item.rebusFormulaText || 'Panel 1 + Panel 2',
          });
        });
        return detectedItems;
      } catch (e) {
        if (format === 'JSON') throw e;
        // if AUTO fallback to text parsing
      }
    }

    // CSV Parsing
    if (format === 'CSV' || (format === 'AUTO' && rawText.includes(',') && rawText.split('\n')[0].toLowerCase().includes('answer'))) {
      const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const roundCol = headers.findIndex(h => h.includes('round') || h === 'r');
        const setCol = headers.findIndex(h => h.includes('set') || h === 's');
        const qNumCol = headers.findIndex(h => h.includes('qnum') || h.includes('number') || h === 'q' || h === 'id');
        const ansCol = headers.findIndex(h => h.includes('answer') || h.includes('ans') || h.includes('correct'));
        const titleCol = headers.findIndex(h => h.includes('title') || h.includes('prompt') || h.includes('question'));
        const clue1Col = headers.findIndex(h => h.includes('clue1') || h.includes('panel1'));
        const clue2Col = headers.findIndex(h => h.includes('clue2') || h.includes('panel2'));
        const pointsCol = headers.findIndex(h => h.includes('point') || h.includes('mark') || h.includes('score'));
        const domainCol = headers.findIndex(h => h.includes('domain') || h.includes('topic') || h.includes('category'));
        const aliasCol = headers.findIndex(h => h.includes('alias') || h.includes('alt'));
        const expCol = headers.findIndex(h => h.includes('exp') || h.includes('note') || h.includes('detail'));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV line splitter with quote awareness
          const cols: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let c = 0; c < line.length; c++) {
            const char = line[c];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim());

          const cleanCol = (idx: number) => (idx !== -1 && cols[idx] ? cols[idx].replace(/^["']|["']$/g, '').trim() : '');

          let itemRound: RoundNumber = defaultRound;
          const rVal = cleanCol(roundCol);
          if (rVal === '1' || /1/i.test(rVal)) itemRound = 1;
          else if (rVal === '2' || /2/i.test(rVal)) itemRound = 2;
          else if (rVal === '3' || /3/i.test(rVal)) itemRound = 3;

          let itemSet: QuestionSet = defaultSet;
          const sVal = cleanCol(setCol);
          if (/A/i.test(sVal)) itemSet = 'A';
          else if (/B/i.test(sVal)) itemSet = 'B';
          else if (/C/i.test(sVal)) itemSet = 'C';

          const ans = cleanCol(ansCol);
          const title = cleanCol(titleCol) || `Question ${i}`;
          const clue1 = cleanCol(clue1Col) || title;
          const clue2 = cleanCol(clue2Col) || 'Technical Clue';
          const pVal = Number(cleanCol(pointsCol)) || (itemRound === 1 ? 1 : itemRound === 2 ? 2 : 3);
          const domain = cleanCol(domainCol) || 'Computer Science';
          const aliases = cleanCol(aliasCol) ? cleanCol(aliasCol).split(';').map(a => a.trim()).filter(Boolean) : [];
          const exp = cleanCol(expCol) || 'Technical rebus visual clue challenge';
          const qNum = Number(cleanCol(qNumCol)) || i;

          if (ans || title) {
            detectedItems.push({
              id: `rev-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
              questionNumber: qNum,
              title,
              round: itemRound,
              set: itemSet,
              domain,
              difficulty: itemRound === 1 ? 'Medium' : itemRound === 2 ? 'Hard' : 'Very Hard',
              points: pVal,
              correctAnswer: ans,
              aliases,
              explanation: exp,
              status: 'PENDING_REVIEW',
              confidence: ans ? 'HIGH' : 'LOW',
              detectedFrom: 'CSV Multi-Import',
              cluePanels: [
                { panelNumber: 1, description: clue1, svgType: 'brain' },
                { panelNumber: 2, description: clue2, svgType: 'cpu' },
              ],
              rebusFormulaText: 'Panel 1 + Panel 2',
            });
          }
        }

        if (detectedItems.length > 0) return detectedItems;
      }
    }

    // Document / Structured Text Parsing with Section Header Support (e.g. === ROUND 1 - SET A ===)
    let currentRound: RoundNumber = defaultRound;
    let currentSet: QuestionSet = defaultSet;

    // Split text into sections or questions
    const lines = rawText.split(/\r?\n/);
    let currentBlock: string[] = [];
    let questionCounter = 0;

    const flushBlock = (blockLines: string[]) => {
      if (blockLines.length === 0) return;
      const blockText = blockLines.join('\n').trim();
      if (blockText.length < 5) return;

      questionCounter++;
      const answerMatch = blockText.match(/(?:Answer|Correct Answer|Ans)[:\s]+([^\n\r]+)/i);
      const aliasesMatch = blockText.match(/(?:Aliases|Alternatives|Also Accepted)[:\s]+([^\n\r]+)/i);
      const explanationMatch = blockText.match(/(?:Explanation|Notes)[:\s]+([^\n\r]+)/i);
      const roundMatch = blockText.match(/(?:Round|R)[:\s]+(\d+)/i);
      const setMatch = blockText.match(/(?:Set|S)[:\s]+([ABC])/i);
      const pointsMatch = blockText.match(/(?:Points|Marks)[:\s]+(\d+)/i);
      const domainMatch = blockText.match(/(?:Domain|Topic|Category)[:\s]+([^\n\r]+)/i);
      const qNumMatch = blockText.match(/(?:Question\s*#?|Q\s*#?|#)(\d+)/i);
      const clue1Match = blockText.match(/(?:Clue\s*1|Panel\s*1|Image\s*1)[:\s]+([^\n\r]+)/i);
      const clue2Match = blockText.match(/(?:Clue\s*2|Panel\s*2|Image\s*2)[:\s]+([^\n\r]+)/i);

      let itemRound: RoundNumber = currentRound;
      if (roundMatch) {
        const r = Number(roundMatch[1]);
        if (r === 1 || r === 2 || r === 3) itemRound = r as RoundNumber;
      }

      let itemSet: QuestionSet = currentSet;
      if (setMatch) {
        const s = setMatch[1].toUpperCase();
        if (s === 'A' || s === 'B' || s === 'C') itemSet = s as QuestionSet;
      }

      const promptLine = blockLines[0].replace(/^\d+[\.\)]\s*/, '').replace(/^(?:Question|Q)\s*#?\d+[:.]?\s*/i, '').trim();
      const correctAnswer = answerMatch ? answerMatch[1].trim() : '';
      const aliases = aliasesMatch ? aliasesMatch[1].split(/[,;/]/).map(s => s.trim()).filter(Boolean) : [];
      const qNum = qNumMatch ? Number(qNumMatch[1]) : questionCounter;

      detectedItems.push({
        id: `rev-${Date.now()}-${questionCounter}-${Math.floor(Math.random() * 1000)}`,
        questionNumber: qNum,
        title: promptLine || `Question ${qNum}`,
        round: itemRound,
        set: itemSet,
        domain: domainMatch ? domainMatch[1].trim() : 'Computer Science',
        difficulty: itemRound === 1 ? 'Medium' : itemRound === 2 ? 'Hard' : 'Very Hard',
        points: pointsMatch ? Number(pointsMatch[1]) : (itemRound === 1 ? 1 : itemRound === 2 ? 2 : 3),
        correctAnswer,
        aliases,
        explanation: explanationMatch ? explanationMatch[1].trim() : 'Technical rebus visual clue challenge',
        status: 'PENDING_REVIEW',
        confidence: correctAnswer ? 'HIGH' : 'LOW',
        detectedFrom: 'Structured Text Multi-Import',
        cluePanels: [
          { panelNumber: 1, description: clue1Match ? clue1Match[1].trim() : promptLine || 'Visual Clue 1', svgType: 'brain' },
          { panelNumber: 2, description: clue2Match ? clue2Match[1].trim() : 'Visual Clue 2', svgType: 'cpu' },
        ],
        rebusFormulaText: 'Panel 1 + Panel 2',
      });
    };

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for Section Headers like === ROUND 1 - SET A === or [ROUND 2 SET B]
      const sectionMatch = trimmed.match(/(?:={2,}|\[|###|ROUND)\s*ROUND\s*([123])\s*(?:-|–|:|,|SET)?\s*SET\s*([ABC])/i);
      if (sectionMatch) {
        flushBlock(currentBlock);
        currentBlock = [];
        currentRound = Number(sectionMatch[1]) as RoundNumber;
        currentSet = sectionMatch[2].toUpperCase() as QuestionSet;
        continue;
      }

      // Check if line starts a new question
      const isNewQuestion = /^(?:Question\s*#?\d+|Q\d+[:.]|\d+[\.\)]\s+)/i.test(trimmed);
      if (isNewQuestion && currentBlock.length > 0) {
        flushBlock(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
    flushBlock(currentBlock);

    return detectedItems;
  };

  app.post('/api/admin/questions/parse-document', requireAdminOrAbove, (req: Request, res: Response) => {
    const { content, format, defaultRound, defaultSet } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    const rNum: RoundNumber = (Number(defaultRound) || 1) as RoundNumber;
    const sName: QuestionSet = (defaultSet || 'A') as QuestionSet;

    try {
      const detectedItems = parseQuestionsFromRawContent(content, format || 'AUTO', rNum, sName);

      // Add to review queue
      detectedItems.forEach(item => importReviewQueue.unshift(item));

      // Compute breakdown matrix
      const matrix: Record<string, Record<string, number>> = {
        round1: { A: 0, B: 0, C: 0 },
        round2: { A: 0, B: 0, C: 0 },
        round3: { A: 0, B: 0, C: 0 },
      };

      detectedItems.forEach(q => {
        const rKey = `round${q.round}`;
        if (matrix[rKey] && matrix[rKey][q.set] !== undefined) {
          matrix[rKey][q.set]++;
        }
      });

      res.json({
        success: true,
        message: `Successfully parsed and queued ${detectedItems.length} question(s) across all rounds & sets`,
        queuedCount: detectedItems.length,
        items: detectedItems,
        matrix,
      });
    } catch (err: any) {
      res.status(400).json({ error: `Failed to parse document: ${err.message}` });
    }
  });

  // Master Direct Insert: Insert All Questions for All Rounds and All Sets directly into Question Bank
  app.post('/api/admin/questions/bulk-all-rounds-insert', requireAdminOrAbove, (req: Request, res: Response) => {
    const { content, format, questions: directQuestionsList, replaceMode, defaultRound, defaultSet } = req.body;
    const adminUser = (req as any).adminUser;

    try {
      let itemsToInsert: Question[] = [];

      if (Array.isArray(directQuestionsList) && directQuestionsList.length > 0) {
        itemsToInsert = directQuestionsList.map((item: any, idx: number) => ({
          id: item.id || `q-master-${crypto.randomUUID()}`,
          round: (item.round === 1 || item.round === 2 || item.round === 3) ? item.round : 1,
          set: (item.set === 'A' || item.set === 'B' || item.set === 'C') ? item.set : 'A',
          questionNumber: item.questionNumber || idx + 1,
          domain: item.domain || 'Computer Science',
          difficulty: item.difficulty || (item.round === 1 ? 'Medium' : item.round === 2 ? 'Hard' : 'Very Hard'),
          points: item.points || (item.round === 1 ? 1 : item.round === 2 ? 2 : 3),
          cluePanels: item.cluePanels || [
            { panelNumber: 1, description: item.title || 'Visual Clue 1', svgType: 'brain' },
            { panelNumber: 2, description: 'Technical Clue 2', svgType: 'cpu' },
          ],
          rebusFormulaText: item.rebusFormulaText || 'Panel 1 + Panel 2',
          correctAnswer: item.correctAnswer || '',
          aliases: Array.isArray(item.aliases) ? item.aliases : [],
          explanation: item.explanation || item.title || 'Technical Rebus Visual Challenge',
          active: true,
          status: 'ACTIVE',
        }));
      } else if (content) {
        const parsedReviewItems = parseQuestionsFromRawContent(
          content,
          format || 'AUTO',
          (Number(defaultRound) || 1) as RoundNumber,
          (defaultSet || 'A') as QuestionSet
        );

        itemsToInsert = parsedReviewItems.map(item => ({
          id: `q-master-${crypto.randomUUID()}`,
          round: item.round,
          set: item.set,
          questionNumber: item.questionNumber,
          domain: item.domain,
          difficulty: item.difficulty,
          points: item.points,
          cluePanels: item.cluePanels || [
            { panelNumber: 1, description: item.title, svgType: 'brain' },
            { panelNumber: 2, description: 'Technical Clue 2', svgType: 'cpu' },
          ],
          rebusFormulaText: item.rebusFormulaText || 'Panel 1 + Panel 2',
          correctAnswer: item.correctAnswer,
          aliases: item.aliases || [],
          explanation: item.explanation || item.title,
          active: true,
          status: 'ACTIVE',
        }));
      }

      if (itemsToInsert.length === 0) {
        return res.status(400).json({ error: 'No valid questions found to insert.' });
      }

      if (replaceMode === 'REPLACE_ALL') {
        questions.length = 0;
        itemsToInsert.forEach(q => questions.push(q));
      } else if (replaceMode === 'REPLACE_MATCHING') {
        // Remove existing questions for the (round, set) combinations being imported
        const roundSetKeys = new Set(itemsToInsert.map(q => `${q.round}-${q.set}`));
        for (let i = questions.length - 1; i >= 0; i--) {
          const key = `${questions[i].round}-${questions[i].set}`;
          if (roundSetKeys.has(key)) {
            questions.splice(i, 1);
          }
        }
        itemsToInsert.forEach(q => questions.push(q));
      } else {
        // APPEND
        itemsToInsert.forEach(q => questions.push(q));
      }

      // Compute Matrix Counts
      const matrix: Record<string, Record<string, number>> = {
        round1: { A: 0, B: 0, C: 0 },
        round2: { A: 0, B: 0, C: 0 },
        round3: { A: 0, B: 0, C: 0 },
      };

      questions.forEach(q => {
        const rKey = `round${q.round}`;
        if (matrix[rKey] && matrix[rKey][q.set] !== undefined) {
          matrix[rKey][q.set]++;
        }
      });

      recordAudit(
        adminUser?.username || 'ADMIN',
        adminUser?.role || 'ADMIN',
        'BULK_ALL_ROUNDS_INSERT',
        `${itemsToInsert.length} questions`,
        undefined,
        `Total Master Bank: ${questions.length}`,
        `Inserted ${itemsToInsert.length} questions across all rounds and sets (Mode: ${replaceMode || 'APPEND'}).`
      );

      saveQuestionsToDisk?.();
      broadcastState();
      broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });

      res.json({
        success: true,
        message: `Successfully inserted ${itemsToInsert.length} question(s) for ALL rounds & sets! Total in Question Bank: ${questions.length}`,
        insertedCount: itemsToInsert.length,
        totalQuestions: questions.length,
        matrix,
      });
    } catch (err: any) {
      res.status(400).json({ error: `Failed to insert all questions: ${err.message}` });
    }
  });

  // Comprehensive Schema Validation Endpoint for JSON Bulk Import
  app.post('/api/admin/questions/validate-json', requireAdminOrAbove, (req: Request, res: Response) => {
    const { content, jsonData } = req.body;

    try {
      let rawObj: any;
      if (jsonData) {
        rawObj = jsonData;
      } else if (content) {
        try {
          rawObj = JSON.parse(content);
        } catch (e: any) {
          return res.status(400).json({
            valid: false,
            error: `Invalid JSON syntax: ${e.message}`,
            errors: [`Invalid JSON syntax: ${e.message}`],
            warnings: [],
            totalQuestions: 0,
            validCount: 0,
            invalidCount: 0,
          });
        }
      } else {
        return res.status(400).json({ valid: false, error: 'JSON content or data is required' });
      }

      let rawList: any[] = [];
      if (Array.isArray(rawObj)) {
        rawList = rawObj;
      } else if (rawObj && typeof rawObj === 'object') {
        if (Array.isArray(rawObj.questions)) {
          rawList = rawObj.questions;
        } else {
          // Check multi-round nested structure
          for (const rKey of Object.keys(rawObj)) {
            const rVal = rawObj[rKey];
            let rNum = 1;
            if (/1/i.test(rKey)) rNum = 1;
            else if (/2/i.test(rKey)) rNum = 2;
            else if (/3/i.test(rKey)) rNum = 3;

            if (Array.isArray(rVal)) {
              rVal.forEach((item: any) => rawList.push({ ...item, round: item.round || rNum }));
            } else if (rVal && typeof rVal === 'object') {
              for (const sKey of Object.keys(rVal)) {
                let sName = 'A';
                if (/A/i.test(sKey)) sName = 'A';
                else if (/B/i.test(sKey)) sName = 'B';
                else if (/C/i.test(sKey)) sName = 'C';

                const sVal = rVal[sKey];
                if (Array.isArray(sVal)) {
                  sVal.forEach((item: any) => rawList.push({ ...item, round: item.round || rNum, set: item.set || sName }));
                }
              }
            }
          }
        }
      }

      if (rawList.length === 0) {
        return res.status(400).json({
          valid: false,
          error: 'No questions array found in the uploaded JSON data',
          errors: ['JSON must contain an array of question objects or a root "questions" array.'],
          warnings: [],
          totalQuestions: 0,
          validCount: 0,
          invalidCount: 0,
        });
      }

      const errors: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }> = [];
      const warnings: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }> = [];
      const normalizedList: any[] = [];
      const seenQNums: Record<string, number> = {};

      const matrix: Record<string, Record<string, number>> = {
        round1: { A: 0, B: 0, C: 0 },
        round2: { A: 0, B: 0, C: 0 },
        round3: { A: 0, B: 0, C: 0 },
      };

      rawList.forEach((item: any, idx: number) => {
        const itemErrors: string[] = [];

        // 1. Validate Round
        let rNum: RoundNumber = 1;
        if (item.round === 1 || item.round === '1' || item.round === 'Round 1') rNum = 1;
        else if (item.round === 2 || item.round === '2' || item.round === 'Round 2') rNum = 2;
        else if (item.round === 3 || item.round === '3' || item.round === 'Round 3') rNum = 3;
        else {
          itemErrors.push(`Invalid 'round' value "${item.round}". Must be 1, 2, or 3.`);
          errors.push({ index: idx, questionNumber: item.questionNumber, title: item.title, field: 'round', message: `Invalid 'round': expected 1, 2, or 3 (got: ${item.round})` });
        }

        // 2. Validate Set
        let sName: QuestionSet = 'A';
        const rawSet = String(item.set || '').toUpperCase().trim();
        if (rawSet === 'A' || rawSet === 'SET A') sName = 'A';
        else if (rawSet === 'B' || rawSet === 'SET B') sName = 'B';
        else if (rawSet === 'C' || rawSet === 'SET C') sName = 'C';
        else {
          itemErrors.push(`Invalid 'set' value "${item.set}". Must be 'A', 'B', or 'C'.`);
          errors.push({ index: idx, questionNumber: item.questionNumber, title: item.title, field: 'set', message: `Invalid 'set': expected 'A', 'B', or 'C' (got: ${item.set})` });
        }

        // 3. Validate Correct Answer
        const ans = String(item.correctAnswer || item.answer || '').trim();
        if (!ans) {
          itemErrors.push(`Missing required 'correctAnswer' field.`);
          errors.push({ index: idx, questionNumber: item.questionNumber, title: item.title, field: 'correctAnswer', message: `Missing required 'correctAnswer'` });
        }

        // 4. Validate Question Number & Duplication
        const qNum = Number(item.questionNumber) || idx + 1;
        const key = `R${rNum}_Set${sName}_Q${qNum}`;
        if (seenQNums[key] !== undefined) {
          warnings.push({ index: idx, questionNumber: qNum, title: item.title, field: 'questionNumber', message: `Duplicate Question #${qNum} detected in Round ${rNum} Set ${sName}. Will be auto-adjusted.` });
        }
        seenQNums[key] = idx;

        // 5. Check clues / panels
        if (!item.cluePanels || !Array.isArray(item.cluePanels) || item.cluePanels.length === 0) {
          warnings.push({ index: idx, questionNumber: qNum, title: item.title, field: 'cluePanels', message: `No 'cluePanels' defined. Standard 2-panel SVG visuals will be auto-generated.` });
        }

        // 6. Track matrix count
        if (itemErrors.length === 0) {
          matrix[`round${rNum}`][sName]++;
          normalizedList.push({
            id: item.id || `q-norm-${crypto.randomUUID()}`,
            round: rNum,
            set: sName,
            questionNumber: qNum,
            title: item.title || item.prompt || `Question ${qNum}`,
            correctAnswer: ans,
            points: Number(item.points) || (rNum === 1 ? 1 : rNum === 2 ? 2 : 3),
            domain: item.domain || 'Computer Science',
            difficulty: item.difficulty || (rNum === 1 ? 'Medium' : rNum === 2 ? 'Hard' : 'Very Hard'),
            aliases: Array.isArray(item.aliases) ? item.aliases : (item.aliases ? String(item.aliases).split(',').map(s => s.trim()) : []),
            explanation: item.explanation || item.title || 'Technical Rebus Visual Clue',
            customImageUrl: item.customImageUrl || (Array.isArray(item.images) ? item.images[0] : undefined),
            images: Array.isArray(item.images) ? item.images : (item.customImageUrl ? [item.customImageUrl] : []),
            cluePanels: item.cluePanels || [
              { panelNumber: 1, description: item.title || 'Visual Clue 1', svgType: 'brain' },
              { panelNumber: 2, description: 'Technical Clue 2', svgType: 'cpu' },
            ],
            rebusFormulaText: item.rebusFormulaText || 'Panel 1 + Panel 2',
          });
        }
      });

      const isValid = errors.length === 0;

      res.json({
        valid: isValid,
        totalQuestions: rawList.length,
        validCount: normalizedList.length,
        invalidCount: rawList.length - normalizedList.length,
        errors,
        warnings,
        matrix,
        normalizedQuestions: normalizedList,
        message: isValid
          ? `Schema Validation PASSED: ${normalizedList.length} valid question(s) across all rounds and sets.`
          : `Schema Validation Failed: ${errors.length} error(s) found in ${rawList.length - normalizedList.length} question(s).`,
      });
    } catch (err: any) {
      res.status(400).json({ valid: false, error: `Validation error: ${err.message}`, errors: [err.message] });
    }
  });

  // Clear Review Queue
  app.post('/api/admin/questions/review-queue/clear', requireAdminOrAbove, (req: Request, res: Response) => {
    const prevCount = importReviewQueue.length;
    importReviewQueue.length = 0;
    res.json({ success: true, message: `Cleared ${prevCount} item(s) from review queue.` });
  });

  app.get('/api/admin/questions/review-queue', requireAdminOrAbove, (req: Request, res: Response) => {
    res.json({ queue: importReviewQueue });
  });

  app.put('/api/admin/questions/review-queue/:id', requireAdminOrAbove, (req: Request, res: Response) => {
    const { id } = req.params;
    const item = importReviewQueue.find(q => q.id === id);
    if (!item) return res.status(404).json({ error: 'Queue item not found' });

    Object.assign(item, req.body);
    res.json({ success: true, item });
  });

  app.post('/api/admin/questions/review-queue/approve', requireAdminOrAbove, (req: Request, res: Response) => {
    const { itemIds } = req.body;
    const adminUser = (req as any).adminUser;

    const ids: string[] = Array.isArray(itemIds) ? itemIds : importReviewQueue.map(q => q.id);
    const approvedItems: Question[] = [];

    ids.forEach(id => {
      const idx = importReviewQueue.findIndex(q => q.id === id);
      if (idx !== -1) {
        const item = importReviewQueue.splice(idx, 1)[0];
        const newQ: Question = {
          id: `q-${crypto.randomUUID()}`,
          round: item.round,
          set: item.set,
          questionNumber: item.questionNumber,
          domain: item.domain,
          difficulty: item.difficulty,
          points: item.points,
          cluePanels: item.cluePanels || [
            { panelNumber: 1, description: item.title, svgType: 'brain' },
            { panelNumber: 2, description: 'Technical Clue', svgType: 'cpu' },
          ],
          rebusFormulaText: item.rebusFormulaText || 'Panel 1 + Panel 2',
          correctAnswer: item.correctAnswer,
          aliases: item.aliases || [],
          explanation: item.explanation || item.title,
          active: true,
          status: 'ACTIVE',
        };

        questions.push(newQ);
        approvedItems.push(newQ);
      }
    });

    recordAudit(
      adminUser.username,
      adminUser.role,
      'APPROVE_IMPORT_QUEUE',
      `${approvedItems.length} questions`,
      undefined,
      'COMMITTED_TO_BANK',
      `Approved and committed ${approvedItems.length} questions from review queue to question bank`
    );

    saveQuestionsToDisk?.();
    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });

    res.json({
      success: true,
      message: `Approved and saved ${approvedItems.length} question(s) to Question Bank`,
      count: approvedItems.length,
      questions: approvedItems,
    });
  });

  app.delete('/api/admin/questions/review-queue/:id', requireAdminOrAbove, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = importReviewQueue.findIndex(q => q.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found in queue' });

    importReviewQueue.splice(idx, 1);
    res.json({ success: true, message: 'Removed item from review queue' });
  });

  // ==========================================
  // 8. QUESTION MANAGEMENT: REORDER, MOVE, STATUS (SECTIONS 16, 17, 21, 24)
  // ==========================================
  app.post('/api/admin/questions/reorder', requireAdminOrAbove, (req: Request, res: Response) => {
    const { round, set, orderedIds } = req.body;
    const adminUser = (req as any).adminUser;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array required' });
    }

    orderedIds.forEach((id: string, idx: number) => {
      const q = questions.find(item => item.id === id);
      if (q) {
        q.questionNumber = idx + 1;
      }
    });

    recordAudit(
      adminUser.username,
      adminUser.role,
      'REORDER_QUESTIONS',
      `Round ${round || 'All'} Set ${set || 'All'}`,
      undefined,
      `${orderedIds.length} re-indexed`,
      'Updated question ordering sequence'
    );

    saveQuestionsToDisk?.();
    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, message: 'Questions reordered successfully' });
  });

  app.post('/api/admin/questions/move-copy', requireAdminOrAbove, (req: Request, res: Response) => {
    const { questionId, action, targetRound, targetSet } = req.body;
    const adminUser = (req as any).adminUser;

    const sourceQ = questions.find(q => q.id === questionId);
    if (!sourceQ) return res.status(404).json({ error: 'Source question not found' });

    const tRound = Number(targetRound) as RoundNumber;
    const tSet = (targetSet || 'A') as QuestionSet;

    if (action === 'MOVE') {
      sourceQ.round = tRound;
      sourceQ.set = tSet;
      recordAudit(
        adminUser.username,
        adminUser.role,
        'MOVE_QUESTION',
        sourceQ.id,
        undefined,
        `R${tRound}-${tSet}`,
        `Moved question to Round ${tRound} Set ${tSet}`
      );
    } else if (action === 'COPY') {
      const cloned: Question = {
        ...JSON.parse(JSON.stringify(sourceQ)),
        id: `q-${crypto.randomUUID()}`,
        round: tRound,
        set: tSet,
      };
      questions.push(cloned);
      recordAudit(
        adminUser.username,
        adminUser.role,
        'COPY_QUESTION',
        cloned.id,
        sourceQ.id,
        `R${tRound}-${tSet}`,
        `Cloned question into Round ${tRound} Set ${tSet}`
      );
    }

    saveQuestionsToDisk?.();
    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, message: `Question ${action.toLowerCase()}d successfully` });
  });

  app.post('/api/admin/question/status', requireAdminOrAbove, (req: Request, res: Response) => {
    const { questionId, status } = req.body;
    const adminUser = (req as any).adminUser;

    const q = questions.find(item => item.id === questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const oldStatus = q.status || (q.active ? 'ACTIVE' : 'DRAFT');
    q.status = status;
    q.active = status === 'ACTIVE';

    recordAudit(
      adminUser.username,
      adminUser.role,
      'SET_QUESTION_STATUS',
      q.id,
      oldStatus,
      status,
      `Changed question status from ${oldStatus} to ${status}`
    );

    saveQuestionsToDisk?.();
    broadcastState();
    broadcast('QUESTIONS_UPDATED', { totalQuestions: questions.length });
    res.json({ success: true, message: `Question status updated to ${status}`, question: q });
  });

  // ==========================================
  // 9. EVENT FEEDBACK SYSTEM (SECTION 32)
  // ==========================================
  app.post('/api/feedback', (req: Request, res: Response) => {
    const { 
      teamId, 
      overallRating, 
      rating, 
      questionQuality, 
      quality, 
      difficulty, 
      userExperience, 
      rebusDesign, 
      eventOrganization, 
      organization, 
      comments,
      round
    } = req.body;

    const targetRound = Number(round) || eventState.currentRound || 1;

    // Check if feedback is globally or round-specifically active
    const isRoundActive = Array.isArray(eventState.feedbackActiveRounds) 
      ? eventState.feedbackActiveRounds.includes(targetRound)
      : Boolean(eventState.feedbackActive);

    if (!eventState.feedbackActive && !isRoundActive) {
      return res.status(403).json({ error: `Feedback collection is currently closed for Round ${targetRound}.` });
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team identification is required.' });
    }

    const effectiveOverall = Number(overallRating || rating);
    if (!effectiveOverall || effectiveOverall < 1 || effectiveOverall > 5) {
      return res.status(400).json({ error: 'Please provide a valid rating (1 to 5 stars).' });
    }

    // Check for duplicate submission for this team in this round
    const existing = eventFeedbacks.find(
      f => f.teamId === teamId && (f.round === targetRound || (!f.round && targetRound === 1))
    );
    if (existing) {
      return res.status(409).json({ 
        error: `Your team has already submitted official feedback for Round ${targetRound}. Thank you!` 
      });
    }

    const team = teams.get(teamId);
    const teamName = team ? team.name : (req.body.teamName || 'Team Contender');
    const college = team ? team.college : (req.body.college || 'ACET');

    const feedback: EventFeedback = {
      id: `fb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      teamId,
      teamName,
      college,
      round: targetRound,
      overallRating: Math.min(5, Math.max(1, effectiveOverall)),
      questionQuality: Math.min(5, Math.max(1, Number(questionQuality || quality) || effectiveOverall)),
      difficulty: Math.min(5, Math.max(1, Number(difficulty) || 3)),
      userExperience: Math.min(5, Math.max(1, Number(userExperience || rebusDesign) || effectiveOverall)),
      eventOrganization: Math.min(5, Math.max(1, Number(eventOrganization || organization) || effectiveOverall)),
      comments: comments?.trim() || undefined,
      timestamp: Date.now(),
    };

    eventFeedbacks.unshift(feedback);
    saveFeedbacks(eventFeedbacks);

    res.json({ 
      success: true, 
      message: `Thank you! Your feedback for Round ${targetRound} has been recorded successfully.`,
      feedbackId: feedback.id
    });
  });

  app.get('/api/admin/feedback', requireModeratorOrAbove, (req: Request, res: Response) => {
    const total = eventFeedbacks.length;
    const eligibleTeamsCount = teams.size;

    const roundStats: Record<number, { total: number; avgRating: number; feedbacks: EventFeedback[] }> = {
      1: { total: 0, avgRating: 0, feedbacks: [] },
      2: { total: 0, avgRating: 0, feedbacks: [] },
      3: { total: 0, avgRating: 0, feedbacks: [] },
    };

    let sumOverall = 0;
    let sumQuality = 0;
    let sumDifficulty = 0;
    let sumUX = 0;
    let sumOrg = 0;
    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    eventFeedbacks.forEach(f => {
      sumOverall += f.overallRating;
      sumQuality += f.questionQuality;
      sumDifficulty += f.difficulty || 3;
      sumUX += f.userExperience || f.overallRating;
      sumOrg += f.eventOrganization || f.overallRating;
      ratingCounts[f.overallRating] = (ratingCounts[f.overallRating] || 0) + 1;

      const r = f.round || 1;
      if (!roundStats[r]) roundStats[r] = { total: 0, avgRating: 0, feedbacks: [] };
      roundStats[r].total += 1;
      roundStats[r].avgRating += f.overallRating;
      roundStats[r].feedbacks.push(f);
    });

    Object.keys(roundStats).forEach(key => {
      const rKey = Number(key);
      if (roundStats[rKey].total > 0) {
        roundStats[rKey].avgRating = Number((roundStats[rKey].avgRating / roundStats[rKey].total).toFixed(2));
      }
    });

    res.json({
      total,
      eligibleTeamsCount,
      feedbackActive: Boolean(eventState.feedbackActive),
      feedbackActiveRounds: eventState.feedbackActiveRounds || (eventState.feedbackActive ? [1, 2, 3] : []),
      averageOverall: total > 0 ? Number((sumOverall / total).toFixed(2)) : 0,
      averageQuality: total > 0 ? Number((sumQuality / total).toFixed(2)) : 0,
      averageDifficulty: total > 0 ? Number((sumDifficulty / total).toFixed(2)) : 0,
      averageUX: total > 0 ? Number((sumUX / total).toFixed(2)) : 0,
      averageOrganization: total > 0 ? Number((sumOrg / total).toFixed(2)) : 0,
      ratingCounts,
      roundStats,
      feedbacks: eventFeedbacks,
    });
  });

  app.post('/api/admin/feedback/toggle', requireAdminOrAbove, (req: Request, res: Response) => {
    const { round, enabled } = req.body;
    
    if (round !== undefined) {
      const targetRound = Number(round);
      if (!Array.isArray(eventState.feedbackActiveRounds)) {
        eventState.feedbackActiveRounds = eventState.feedbackActive ? [1, 2, 3] : [];
      }
      
      const shouldEnable = enabled !== undefined ? Boolean(enabled) : !eventState.feedbackActiveRounds.includes(targetRound);
      
      if (shouldEnable) {
        if (!eventState.feedbackActiveRounds.includes(targetRound)) {
          eventState.feedbackActiveRounds.push(targetRound);
        }
        eventState.feedbackActive = true;
      } else {
        eventState.feedbackActiveRounds = eventState.feedbackActiveRounds.filter(r => r !== targetRound);
        if (eventState.feedbackActiveRounds.length === 0) {
          eventState.feedbackActive = false;
        }
      }
    } else {
      eventState.feedbackActive = enabled !== undefined ? Boolean(enabled) : !eventState.feedbackActive;
      if (eventState.feedbackActive) {
        eventState.feedbackActiveRounds = [1, 2, 3];
      } else {
        eventState.feedbackActiveRounds = [];
      }
    }

    broadcastState();
    res.json({ 
      success: true, 
      feedbackActive: eventState.feedbackActive,
      feedbackActiveRounds: eventState.feedbackActiveRounds
    });
  });

  app.delete('/api/admin/feedback/:id', requireAdminOrAbove, (req: Request, res: Response) => {
    const { id } = req.params;
    const index = eventFeedbacks.findIndex(f => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    eventFeedbacks.splice(index, 1);
    saveFeedbacks(eventFeedbacks);
    res.json({ success: true, message: 'Feedback entry deleted' });
  });

  // ==========================================
  // 10. COMPREHENSIVE EVENT REPORTS & EXPORTS (SECTION 29)
  // ==========================================
  app.get('/api/admin/reports/event-summary', requireModeratorOrAbove, (req: Request, res: Response) => {
    const allTeams = Array.from(teams.values());
    const leaderboard = computeLeaderboard();

    let totalSubmissions = 0;
    let totalCorrect = 0;
    submissions.forEach(s => {
      totalSubmissions++;
      if (s.isCorrect) totalCorrect++;
    });

    const completionRate = totalSubmissions > 0 ? Number(((totalCorrect / totalSubmissions) * 100).toFixed(1)) : 0;

    res.json({
      symposiumName: "TECH BRIDGE '26",
      department: 'Computer Science and Engineering',
      eventTitle: 'Visual Technical Rebus Challenge',
      generatedAt: Date.now(),
      status: eventState.status,
      currentRound: eventState.currentRound,
      stats: {
        totalTeams: allTeams.length,
        activeTeams: allTeams.filter(t => t.status === 'ACTIVE').length,
        warnedTeams: allTeams.filter(t => t.status === 'WARNED').length,
        lockedTeams: allTeams.filter(t => t.status === 'LOCKED').length,
        disqualifiedTeams: allTeams.filter(t => t.status === 'DISQUALIFIED').length,
        totalQuestions: questions.length,
        totalSubmissions,
        totalCorrect,
        completionRate,
        antiCheatViolationsCount: antiCheatEvents.length,
        manualScoreAdjustmentsCount: manualScoreAdjustments.length,
        feedbacksCount: eventFeedbacks.length,
      },
      leaderboardTop10: leaderboard.slice(0, 10),
      recentAdjustments: manualScoreAdjustments.slice(0, 5),
    });
  });

  // Multi-Sheet Excel Export (XLSX) - Supports ?round=1, ?round=2, ?round=3, ?round=all
  app.get('/api/admin/reports/export-xlsx', requireModeratorOrAbove, (req: Request, res: Response) => {
    const roundParam = String(req.query.round || 'all').toLowerCase();
    const wb = XLSX.utils.book_new();
    const leaderboard = computeLeaderboard();
    const dateStr = new Date().toISOString().split('T')[0];

    if (roundParam === '1' || roundParam === 'r1') {
      const r1Sorted = computeLeaderboard(1);
      const r1Data = r1Sorted.map((t, idx) => {
        const team = teams.get(t.teamId);
        const r1Subs = Array.from(submissions.values()).filter(s => s.teamId === t.teamId && s.round === 1);
        const r1Correct = r1Subs.filter(s => s.isCorrect).length;
        return {
          'Round 1 Rank': idx + 1,
          'Team ID': t.teamId,
          'Team Name': t.teamName,
          'Participant 1': team?.participant1 || '',
          'Participant 2': team?.participant2 || '',
          College: t.college,
          Department: team?.department || 'CSE',
          Year: team?.year || '3rd Year',
          Phone: team?.phone || '',
          'Round 1 Score': t.round1Score,
          'Avg Response Time (s)': t.avgTimeR1Seconds || 0,
          'Attempts in R1': r1Subs.length,
          'Correct in R1': r1Correct,
          'Accuracy (%)': r1Subs.length > 0 ? Number(((r1Correct / r1Subs.length) * 100).toFixed(1)) : 0,
          Status: t.status,
        };
      });
      const wsR1 = XLSX.utils.json_to_sheet(r1Data);
      XLSX.utils.book_append_sheet(wb, wsR1, 'Round 1 Standings');

      const r1SubData = Array.from(submissions.values())
        .filter(s => s.round === 1)
        .map(s => ({
          'Team ID': s.teamId,
          'Team Name': s.teamName,
          'Question #': s.questionNumber,
          'Submitted Answer': s.submittedAnswer,
          'Correct?': s.isCorrect ? 'YES' : 'NO',
          'Points Awarded': s.pointsAwarded,
          'Time Taken (s)': s.timeTakenSeconds || 30,
          'Submitted At': new Date(s.submittedAt).toLocaleTimeString(),
        }));
      const wsR1Subs = XLSX.utils.json_to_sheet(r1SubData);
      XLSX.utils.book_append_sheet(wb, wsR1Subs, 'R1 Submissions Log');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="TECH_BRIDGE_26_Round_1_Report_${dateStr}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (roundParam === '2' || roundParam === 'r2') {
      const r2Sorted = computeLeaderboard(2);
      const r2Data = r2Sorted.map((t, idx) => {
        const team = teams.get(t.teamId);
        const r2Subs = Array.from(submissions.values()).filter(s => s.teamId === t.teamId && s.round === 2);
        const r2Correct = r2Subs.filter(s => s.isCorrect).length;
        return {
          'Round 2 Rank': idx + 1,
          'Team ID': t.teamId,
          'Team Name': t.teamName,
          'Participant 1': team?.participant1 || '',
          'Participant 2': team?.participant2 || '',
          College: t.college,
          Department: team?.department || 'CSE',
          Year: team?.year || '3rd Year',
          Phone: team?.phone || '',
          'Round 2 Score': t.round2Score,
          'Avg Response Time (s)': t.avgTimeR2Seconds || 0,
          'Attempts in R2': r2Subs.length,
          'Correct in R2': r2Correct,
          'Accuracy (%)': r2Subs.length > 0 ? Number(((r2Correct / r2Subs.length) * 100).toFixed(1)) : 0,
          Status: t.status,
        };
      });
      const wsR2 = XLSX.utils.json_to_sheet(r2Data);
      XLSX.utils.book_append_sheet(wb, wsR2, 'Round 2 Standings');

      const r2SubData = Array.from(submissions.values())
        .filter(s => s.round === 2)
        .map(s => ({
          'Team ID': s.teamId,
          'Team Name': s.teamName,
          'Question #': s.questionNumber,
          'Submitted Answer': s.submittedAnswer,
          'Correct?': s.isCorrect ? 'YES' : 'NO',
          'Points Awarded': s.pointsAwarded,
          'Time Taken (s)': s.timeTakenSeconds || 30,
          'Submitted At': new Date(s.submittedAt).toLocaleTimeString(),
        }));
      const wsR2Subs = XLSX.utils.json_to_sheet(r2SubData);
      XLSX.utils.book_append_sheet(wb, wsR2Subs, 'R2 Submissions Log');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="TECH_BRIDGE_26_Round_2_Report_${dateStr}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (roundParam === '3' || roundParam === 'r3') {
      const r3Sorted = computeLeaderboard(3);
      const r3Data = r3Sorted.map((t, idx) => {
        const team = teams.get(t.teamId);
        const r3Subs = Array.from(submissions.values()).filter(s => s.teamId === t.teamId && s.round === 3);
        const r3Correct = r3Subs.filter(s => s.isCorrect).length;
        return {
          'Round 3 Rank': idx + 1,
          'Team ID': t.teamId,
          'Team Name': t.teamName,
          'Participant 1': team?.participant1 || '',
          'Participant 2': team?.participant2 || '',
          College: t.college,
          Department: team?.department || 'CSE',
          Year: team?.year || '3rd Year',
          Phone: team?.phone || '',
          'Round 3 Score': t.round3Score,
          'Avg Response Time (s)': t.avgTimeR3Seconds || 0,
          'Buzzer Submissions': r3Subs.length,
          'Correct Answers': r3Correct,
          Status: t.status,
        };
      });
      const wsR3 = XLSX.utils.json_to_sheet(r3Data);
      XLSX.utils.book_append_sheet(wb, wsR3, 'Round 3 Standings');

      const r3SubData = Array.from(submissions.values())
        .filter(s => s.round === 3)
        .map(s => ({
          'Team ID': s.teamId,
          'Team Name': s.teamName,
          'Question #': s.questionNumber,
          'Submitted Answer': s.submittedAnswer,
          'Correct?': s.isCorrect ? 'YES' : 'NO',
          'Points Awarded': s.pointsAwarded,
          'Time Taken (s)': s.timeTakenSeconds || 30,
          'Submitted At': new Date(s.submittedAt).toLocaleTimeString(),
        }));
      const wsR3Subs = XLSX.utils.json_to_sheet(r3SubData);
      XLSX.utils.book_append_sheet(wb, wsR3Subs, 'R3 Submissions Log');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="TECH_BRIDGE_26_Round_3_Report_${dateStr}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    // ALL ROUNDS COMPREHENSIVE WORKBOOK
    // 1. Overall Master Leaderboard Sheet
    const masterLeaderboard = computeLeaderboard();
    const leaderboardData = masterLeaderboard.map(t => {
      const team = teams.get(t.teamId);
      const teamSubs = Array.from(submissions.values()).filter(s => s.teamId === t.teamId);
      const correctSubs = teamSubs.filter(s => s.isCorrect).length;
      return {
        Rank: t.rank,
        'Team ID': t.teamId,
        'Team Name': t.teamName,
        'Participant 1': team?.participant1 || '',
        'Participant 2': team?.participant2 || '',
        College: t.college,
        Department: team?.department || 'CSE',
        Year: team?.year || '3rd Year',
        Phone: team?.phone || '',
        'Round 1 Score': t.round1Score,
        'R1 Avg Time (s)': t.avgTimeR1Seconds || 0,
        'Round 2 Score': t.round2Score,
        'R2 Avg Time (s)': t.avgTimeR2Seconds || 0,
        'Round 3 Score': t.round3Score,
        'R3 Avg Time (s)': t.avgTimeR3Seconds || 0,
        'Total Score': t.totalScore,
        'Overall Avg Time (s)': t.avgTimeOverallSeconds || 0,
        'Total Submissions': teamSubs.length,
        'Total Correct': correctSubs,
        Status: t.status,
      };
    });
    const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
    XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Master Leaderboard');

    // 2. Round 1 Breakdown Sheet
    const r1Breakdown = computeLeaderboard(1).map((t, i) => ({
      'R1 Rank': i + 1,
      'Team ID': t.teamId,
      'Team Name': t.teamName,
      College: t.college,
      'Round 1 Score': t.round1Score,
      'Avg Time (s)': t.avgTimeR1Seconds || 0,
    }));
    const wsR1 = XLSX.utils.json_to_sheet(r1Breakdown);
    XLSX.utils.book_append_sheet(wb, wsR1, 'Round 1 Summary');

    // 3. Round 2 Breakdown Sheet
    const r2Breakdown = computeLeaderboard(2).map((t, i) => ({
      'R2 Rank': i + 1,
      'Team ID': t.teamId,
      'Team Name': t.teamName,
      College: t.college,
      'Round 2 Score': t.round2Score,
      'Avg Time (s)': t.avgTimeR2Seconds || 0,
    }));
    const wsR2 = XLSX.utils.json_to_sheet(r2Breakdown);
    XLSX.utils.book_append_sheet(wb, wsR2, 'Round 2 Summary');

    // 4. Round 3 Breakdown Sheet
    const r3Breakdown = computeLeaderboard(3).map((t, i) => ({
      'R3 Rank': i + 1,
      'Team ID': t.teamId,
      'Team Name': t.teamName,
      College: t.college,
      'Round 3 Score': t.round3Score,
      'Avg Time (s)': t.avgTimeR3Seconds || 0,
    }));
    const wsR3 = XLSX.utils.json_to_sheet(r3Breakdown);
    XLSX.utils.book_append_sheet(wb, wsR3, 'Round 3 Summary');

    // 5. Submissions Sheet
    const subData = Array.from(submissions.values()).map(s => ({
      'Submission ID': s.id,
      'Team ID': s.teamId,
      'Team Name': s.teamName,
      Round: s.round,
      'Question Number': s.questionNumber,
      'Submitted Answer': s.submittedAnswer,
      'Is Correct': s.isCorrect ? 'YES' : 'NO',
      'Points Awarded': s.pointsAwarded,
      'Submitted At': new Date(s.submittedAt).toISOString(),
    }));
    const wsSub = XLSX.utils.json_to_sheet(subData);
    XLSX.utils.book_append_sheet(wb, wsSub, 'All Submissions');

    // 6. Anti-Cheat Violations Sheet
    const acData = antiCheatEvents.map(a => ({
      'Alert ID': a.id,
      'Team ID': a.teamId,
      'Team Name': a.teamName,
      Event: a.eventType,
      Severity: a.severity,
      Details: a.details,
      Round: a.round,
      Timestamp: new Date(a.timestamp).toISOString(),
      'Action Taken': a.actionTaken || 'LOGGED',
    }));
    const wsAC = XLSX.utils.json_to_sheet(acData);
    XLSX.utils.book_append_sheet(wb, wsAC, 'Anti-Cheat Logs');

    // 7. Manual Score Adjustments Sheet
    const adjData = manualScoreAdjustments.map(m => ({
      'Adjustment ID': m.id,
      'Team ID': m.teamId,
      'Team Name': m.teamName,
      Admin: m.adminUsername,
      Round: m.round,
      'Old Score': m.oldScore,
      'New Score': m.newScore,
      Delta: m.adjustment,
      Reason: m.reason,
      Date: new Date(m.timestamp).toISOString(),
    }));
    const wsAdj = XLSX.utils.json_to_sheet(adjData);
    XLSX.utils.book_append_sheet(wb, wsAdj, 'Score Adjustments');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="TECH_BRIDGE_26_Complete_Report_${dateStr}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });

  // ==========================================
  // 9. LIVE MEMORY & STORAGE TELEMETRY METRICS
  // ==========================================
  app.get('/api/admin/system/metrics', requireModeratorOrAbove, (req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const totalSysMem = os.totalmem();
    const freeSysMem = os.freemem();
    const uptimeSec = process.uptime();

    // Calculate disk usage of data folder
    const dataDir = DATA_DIR;
    let diskDataBytes = 0;
    try {
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        for (const file of files) {
          const filePath = path.join(dataDir, file);
          const stat = fs.statSync(filePath);
          diskDataBytes += stat.size;
        }
      }
    } catch (e) {
      // ignore
    }

    res.json({
      timestamp: Date.now(),
      uptimeSeconds: Math.floor(uptimeSec),
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
        externalMB: +(mem.external / 1024 / 1024).toFixed(2),
        heapUsagePercent: +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
        systemTotalRAM_MB: +(totalSysMem / 1024 / 1024).toFixed(2),
        systemFreeRAM_MB: +(freeSysMem / 1024 / 1024).toFixed(2),
      },
      counts: {
        totalTeams: teams.size,
        totalSubmissions: submissions.size,
        antiCheatEventsCount: antiCheatEvents.length,
        teamWarningsCount: teamWarnings.length,
        auditLogsCount: auditLogs.length,
        totalQuestions: questions.length,
        activeAdminAccounts: adminAccounts.length,
      },
      storage: {
        dataFolderBytes: diskDataBytes,
        dataFolderKB: +(diskDataBytes / 1024).toFixed(2),
        isPersistedToDisk: fs.existsSync(path.join(dataDir, 'event_state_snapshot.json')),
      },
    });
  });

  // Local Disk State Snapshot (Saves live in-memory state to disk to free/protect memory)
  app.post('/api/admin/system/snapshot', requireAdminOrAbove, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser;
    const dataDir = DATA_DIR;
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const snapshotFile = path.join(dataDir, 'event_state_snapshot.json');
    const snapshotPayload = {
      savedAt: Date.now(),
      savedBy: adminUser?.username || 'SYSTEM',
      eventState,
      teams: Array.from(teams.values()),
      submissions: Array.from(submissions.values()),
      antiCheatEvents: antiCheatEvents.slice(0, 500),
      teamWarnings,
      auditLogs: auditLogs.slice(0, 500),
      questionsMasterCount: questions.length,
    };

    fs.writeFileSync(snapshotFile, JSON.stringify(snapshotPayload, null, 2), 'utf-8');

    recordAudit(
      adminUser?.username || 'SYSTEM',
      adminUser?.role || 'ADMIN',
      'CREATE_DISK_SNAPSHOT',
      'System State',
      undefined,
      'Saved to /data/event_state_snapshot.json',
      `Persisted ${teams.size} teams, ${submissions.size} submissions to local disk.`
    );

    res.json({
      success: true,
      message: 'State snapshot successfully persisted to server disk.',
      snapshotPath: snapshotFile,
      savedAt: snapshotPayload.savedAt,
      sizeBytes: fs.statSync(snapshotFile).size,
    });
  });

  // Clear In-Memory Logs Only (Clears antiCheatEvents & auditLogs without affecting scores or teams)
  app.post('/api/admin/system/clear-logs', requireSuperAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser;
    antiCheatEvents.length = 0;
    auditLogs.length = 0;
    teamWarnings.length = 0;

    if (global.gc) global.gc();
    const mem = process.memoryUsage();

    recordAudit(
      adminUser?.username || 'SUPER_ADMIN',
      'SUPER_ADMIN',
      'CLEAR_LOGS',
      'System Memory',
      undefined,
      undefined,
      'Cleared all anti-cheat, warning, and audit memory buffers.'
    );

    res.json({
      success: true,
      message: 'All in-memory security logs and audit buffers cleared.',
      currentHeapMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
    });
  });

  // Clear All Submissions (Resets all team scores to 0 and empties submissions without deleting team accounts)
  app.post('/api/admin/system/clear-submissions', requireSuperAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser;
    submissions.clear();

    teams.forEach(t => {
      t.round1Score = 0;
      t.round2Score = 0;
      t.round3Score = 0;
      t.totalScore = 0;
      t.warningsCount = 0;
      t.lockReason = undefined;
      t.status = 'ACTIVE';
    });

    broadcastState();

    recordAudit(
      adminUser?.username || 'SUPER_ADMIN',
      'SUPER_ADMIN',
      'CLEAR_SUBMISSIONS',
      'Submissions Map',
      undefined,
      undefined,
      `Cleared all submissions and reset scores to 0 for ${teams.size} teams.`
    );

    res.json({
      success: true,
      message: `Cleared all submission records and reset scores for ${teams.size} teams.`,
    });
  });
}

