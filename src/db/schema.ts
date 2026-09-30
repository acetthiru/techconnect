import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users Table (Firebase Auth Sync)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Teams Table
export const teams = pgTable('teams', {
  id: text('id').primaryKey(), // e.g. TB-7001
  name: text('name').notNull(),
  participant1: text('participant_1').notNull(),
  participant2: text('participant_2'),
  college: text('college').notNull(),
  department: text('department'),
  year: text('year'),
  phone: text('phone').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  warningsCount: integer('warnings_count').default(0).notNull(),
  round1Score: integer('round1_score').default(0).notNull(),
  round2Score: integer('round2_score').default(0).notNull(),
  round3Score: integer('round3_score').default(0).notNull(),
  totalScore: integer('total_score').default(0).notNull(),
  lastActive: timestamp('last_active').defaultNow(),
  doorAccessGranted: boolean('door_access_granted').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Submissions Table
export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').references(() => teams.id).notNull(),
  questionId: text('question_id').notNull(),
  round: integer('round').notNull(),
  answer: text('answer').notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
  pointsAwarded: integer('points_awarded').default(0).notNull(),
  timeTakenSeconds: integer('time_taken_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Anti-Cheat Security Violation Logs
export const antiCheatEvents = pgTable('anti_cheat_events', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').references(() => teams.id).notNull(),
  eventType: text('event_type').notNull(),
  details: text('details'),
  timeAwaySeconds: integer('time_away_seconds'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Feedback Submissions
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').references(() => teams.id).notNull(),
  teamName: text('team_name').notNull(),
  college: text('college').notNull(),
  round: integer('round').notNull(),
  rating: integer('rating').notNull(),
  overallRating: integer('overall_rating'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  submissions: many(submissions),
  antiCheatEvents: many(antiCheatEvents),
  feedback: many(feedback),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  team: one(teams, {
    fields: [submissions.teamId],
    references: [teams.id],
  }),
}));
