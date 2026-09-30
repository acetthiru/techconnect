import React from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Check, 
  ArrowLeft, 
  Layers, 
  Lock, 
  ShieldAlert, 
  Users, 
  Award,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { AppViewMode } from './TopNav';

interface CompetitionRulesPageProps {
  onAcknowledgeAndEnter: () => void;
  onBackToLanding: () => void;
}

export const CompetitionRulesPage: React.FC<CompetitionRulesPageProps> = ({
  onAcknowledgeAndEnter,
  onBackToLanding,
}) => {
  return (
    <div id="rules-page-root" className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Bar with Back option */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            id="btn-back-to-landing"
            onClick={onBackToLanding}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Poster</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono-code px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase tracking-wider">
              MANDATORY
            </span>
          </div>
        </div>
      </header>

      {/* Main Rules Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-8">
        {/* Header Block */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 pb-6 border-b border-slate-800"
        >
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-amber-500/40 shadow-xl bg-black p-1.5 ring-1 ring-amber-400/20">
              <img
                src="/tech_bridge_logo.jpg"
                alt="TECH BRIDGE '26 Crest Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono-code text-xs font-bold uppercase tracking-widest">
            ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY
          </div>
          <h1 className="font-tech text-2xl sm:text-4xl font-extrabold text-white tracking-wider">
            TECH BRIDGE '26 RULES
          </h1>
          <p className="text-xs sm:text-sm font-mono-code text-cyan-400 font-semibold tracking-wide uppercase">
            Department of Computer Science and Engineering (CSE)
          </p>
        </motion.div>

        {/* Section 1: Competition Format & Structure */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-2.5 text-amber-400 font-tech font-bold text-base sm:text-lg tracking-wide border-b border-slate-800/80 pb-3">
            <Layers className="w-5 h-5 text-amber-400 shrink-0" />
            <h2>1. COMPETITION FORMAT & STRUCTURE</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Round 1 */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-tech text-base font-bold text-white tracking-wide">
                  Round 1 — Foundations
                </h3>
                <span className="text-[10px] font-mono-code bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-bold">
                  STAGE 1
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                <li><strong className="text-slate-100 font-medium">Challenge:</strong> Rebus</li>
                <li><strong className="text-slate-100 font-medium">Total Questions:</strong> 30 Questions</li>
                <li><strong className="text-slate-100 font-medium">Duration:</strong> 30 Minutes</li>
                <li><strong className="text-slate-100 font-medium">Scoring:</strong> 1 Point Each</li>
              </ul>
            </div>

            {/* Round 2 */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-tech text-base font-bold text-white tracking-wide">
                  Round 2 — Systems
                </h3>
                <span className="text-[10px] font-mono-code bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-bold">
                  STAGE 2
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                <li><strong className="text-slate-100 font-medium">Challenge:</strong> Rebus</li>
                <li><strong className="text-slate-100 font-medium">Duration:</strong> 15 Minutes</li>
                <li><strong className="text-slate-100 font-medium">Scoring:</strong> 2 Points Each</li>
              </ul>
            </div>
          </div>

          {/* Tie-Breaker Policy Callout */}
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-1">
            <div className="font-tech font-bold uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
              <span>⚡ Tie-Breaker Policy</span>
            </div>
            <p className="text-slate-300">
              If there is a tie between participants, selection and ranking are determined based on the <strong className="text-amber-300">average time taken to submit answers</strong>, or resolved by <strong className="text-amber-300">asking a new tie-breaker question</strong>.
            </p>
          </div>

          {/* Additional Stage Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs text-cyan-200">
            <div className="font-tech font-bold uppercase tracking-wide text-cyan-400 mb-1">
              Additional Stage Notice
            </div>
            <p className="italic text-slate-300">
              “An additional stage may be conducted based on the decision of the Event Coordinators.”
            </p>
          </div>
        </motion.section>

        {/* Section 2: Single Submission & Auto-Grading Policy */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-3"
        >
          <div className="flex items-center gap-2.5 text-emerald-400 font-tech font-bold text-base sm:text-lg tracking-wide border-b border-slate-800/80 pb-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2>2. SINGLE SUBMISSION & AUTO-GRADING POLICY</h2>
          </div>

          <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              • Exactly <strong className="text-white">ONE submission</strong> is permitted per question. Answers are locked permanently upon submission.
            </p>
            <p>
              • <strong className="text-white">Self-Navigation:</strong> Participants can freely navigate between questions using Previous and Next controls within the round at their own pace.
            </p>
            <p>
              • The auto-grading engine is case-insensitive and trims extraneous whitespace and punctuation.
            </p>
            <p>
              • Common industry acronyms and recognized technical variations are accepted.
            </p>
          </div>
        </motion.section>

        {/* Section 3: Automated Anti-Cheat & Proctoring */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-3"
        >
          <div className="flex items-center gap-2.5 text-rose-400 font-tech font-bold text-base sm:text-lg tracking-wide border-b border-slate-800/80 pb-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <h2>3. AUTOMATED ANTI-CHEAT & PROCTORING</h2>
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The competition session is monitored under the <strong className="text-white">ACET CSE Security Protocol</strong>.
            </p>
            <p>
              Leaving the application window, switching browser tabs, opening split-screen views, minimizing or backgrounding the application, or attempting other prohibited activities may trigger a security response.
            </p>

            {/* Immediate Lockout Callout */}
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200">
              <span className="font-tech font-bold text-rose-300 block uppercase tracking-wide text-xs">
                Immediate Lockout Policy:
              </span>
              <p className="font-semibold text-white mt-1">
                “Any detected malpractice or prohibited activity will result in immediate lockout from the competition.”
              </p>
            </div>
          </div>
        </motion.section>

        {/* Section 4: Code of Conduct & Fairness */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-3"
        >
          <div className="flex items-center gap-2.5 text-cyan-400 font-tech font-bold text-base sm:text-lg tracking-wide border-b border-slate-800/80 pb-3">
            <Users className="w-5 h-5 text-cyan-400 shrink-0" />
            <h2>4. CODE OF CONDUCT & FAIRNESS</h2>
          </div>

          <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              • Collaboration is strictly restricted to your registered teammate.
            </p>
            <p>
              • The use of secondary search devices, AI assistants, unauthorized aids, or any other prohibited assistance is strictly forbidden and may result in immediate disqualification.
            </p>
            <p>
              • <strong className="text-white">Screen Sleep Prevention:</strong> Display timeout is automatically disabled while in the competition arena so that the screen remains continuously active without dimming or shutting down.
            </p>
            <p>
              • Decisions of the symposium faculty jury and Department of CSE organizers are final.
            </p>
          </div>
        </motion.section>

        {/* Section 5: Symposium Coordinators & Department Contacts */}
        <motion.section 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-2.5 text-amber-400 font-tech font-bold text-base sm:text-lg tracking-wide border-b border-slate-800/80 pb-3">
            <Award className="w-5 h-5 text-amber-400 shrink-0" />
            <h2>5. SYMPOSIUM ORGANIZING COMMITTEE & COORDINATORS</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event Faculty Coordinator */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-[10px] font-mono-code uppercase text-amber-400 font-bold tracking-wider">
                EVENT FACULTY COORDINATOR
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-tech">
                Mrs. K. Janani
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Assistant Professor (AP), Department of Computer Science & Engineering
              </div>
            </div>

            {/* Student Coordinators */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-[10px] font-mono-code uppercase text-cyan-400 font-bold tracking-wider">
                STUDENT COORDINATORS
              </div>
              <div className="space-y-1.5 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-tech text-sm">Ms. Angel R</span>
                  <a href="tel:9487883582" className="text-cyan-400 font-mono-code hover:underline">
                    9487883582
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-tech text-sm">Mr. Thirumurugan S</span>
                  <a href="tel:9042789495" className="text-cyan-400 font-mono-code hover:underline">
                    9042789495
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* II Year Student Coordinators */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-mono-code uppercase text-purple-400 font-bold tracking-wider">
              II YEAR STUDENT COORDINATORS
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                'A. Kamalambiga',
                'R. Dharshini',
                'P. Arthi',
                'Gowsikram V',
                'Swedha Sree. M'
              ].map((name) => (
                <span 
                  key={name} 
                  className="px-3 py-1 bg-slate-900 border border-purple-500/30 text-purple-200 rounded-lg text-xs font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center pt-1 text-[11px] font-mono-code text-slate-400">
            Department of Computer Science and Engineering &bull; Achariya College of Engineering Technology
          </div>
        </motion.section>

        {/* Acknowledgement and CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-5 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-cyan-300 font-mono-code font-semibold">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>Session monitored by ACET CSE Security Protocol</span>
          </div>

          <button
            id="btn-agree-enter-arena"
            type="button"
            onClick={onAcknowledgeAndEnter}
            className="w-full sm:w-auto px-10 py-4 rounded-xl font-tech font-bold text-base sm:text-lg tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:from-amber-300 hover:via-orange-300 hover:to-amber-200 shadow-xl shadow-amber-500/20 transition-all duration-300 cursor-pointer inline-flex items-center justify-center gap-2.5 border border-amber-200/60"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span>I AGREE & ENTER COMPETITION ARENA</span>
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500 font-mono-code">
        ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY • Department of Computer Science and Engineering
      </footer>
    </div>
  );
};
