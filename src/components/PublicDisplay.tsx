import React from 'react';
import { Clock, Tv, Maximize, Radio, Sun, Trophy, Award } from 'lucide-react';
import { EventState, PublicQuestion } from '../types';
import { useScreenWakeLock } from '../utils/wakeLock';

interface PublicDisplayProps {
  eventState: EventState | null;
  currentQuestion: PublicQuestion | null;
  remainingSeconds: number;
}

export const PublicDisplay: React.FC<PublicDisplayProps> = ({
  eventState,
  currentQuestion,
  remainingSeconds,
}) => {
  // Prevent auditorium projector from sleeping during symposium
  const { isActive: isWakeLockActive } = useScreenWakeLock(true);
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getRoundName = (r: number) => {
    switch (r) {
      case 1:
        return 'ROUND 1: FOUNDATIONS & CORE SYSTEMS';
      case 2:
        return 'ROUND 2: DISTRIBUTED ARCHITECTURES & SECURITY';
      case 3:
        return 'ROUND 3: GRAND FINALE & LIVE DIGITAL BUZZER';
      default:
        return 'SYMPOSIUM ARENA';
    }
  };

  const leaderboard = eventState?.leaderboard || [];

  return (
    <div className="w-full min-h-screen bg-[#FFFDF5] text-[#24324A] flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Projector Header */}
      <header className="w-full flex items-center justify-between border-b border-[#E8E3EF] pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#C83A87] to-[#55C7D9] flex items-center justify-center font-tech text-white font-black text-xl shadow-md">
            TB
          </div>
          <div>
            <h1 className="font-tech text-2xl sm:text-3xl font-bold tracking-wider text-[#24324A]">
              ACETCM'26 • TECH BRIDGE
            </h1>
            <p className="text-xs sm:text-sm text-[#C83A87] font-mono-code font-semibold">
              Visual Technical Rebus Challenge • Achariya College of Engineering Technology
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Synchronized Server Timer */}
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white border border-[#E8E3EF] shadow-xs">
            <Clock className="w-6 h-6 text-[#55C7D9]" />
            <div className="text-right">
              <span className="text-[10px] font-mono-code text-[#667085] block uppercase font-bold">
                ROUND TIMER {eventState?.eventLocked ? '(ARENA LOCKED)' : eventState?.isPaused || eventState?.status === 'PAUSED' ? '(PAUSED)' : ''}
              </span>
              <span className={`font-mono-code text-2xl sm:text-3xl font-extrabold ${
                eventState?.eventLocked
                  ? 'text-rose-600'
                  : eventState?.isPaused || eventState?.status === 'PAUSED'
                    ? 'text-amber-600'
                    : remainingSeconds <= 60
                      ? 'text-rose-600 animate-pulse'
                      : 'text-[#24324A]'
              }`}>
                {formatTimer(remainingSeconds)}
              </span>
            </div>
          </div>

          {isWakeLockActive && (
            <div 
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F6D76B]/25 border border-[#F6D76B]/60 text-[#9A7B0C] text-xs font-mono-code font-bold"
              title="Projector Screen Awake: Sleep timeout disabled"
            >
              <Sun className="w-4 h-4 text-[#9A7B0C] animate-pulse" />
              <span>AWAKE</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white hover:bg-[#F7F3FC] border border-[#E8E3EF] text-[#667085] hover:text-[#24324A] transition-all shadow-xs"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Presentation Stage: Live Leaderboard */}
      <main className="w-full flex-1 flex flex-col items-center justify-center py-6">
        <div className="w-full max-w-6xl flex flex-col items-center">
          {/* Header Bar */}
          <div className="w-full flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shadow-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-tech text-xl sm:text-2xl font-extrabold text-[#24324A] tracking-wider flex items-center gap-2">
                  LIVE LEADERBOARD • STANDINGS
                </h2>
                <p className="text-xs text-[#667085] font-mono-code">
                  {getRoundName(eventState?.currentRound || 1)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#F7F3FC] border border-[#E8E3EF] text-[#C83A87] font-mono-code text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE AUDITORIUM VIEW</span>
            </div>
          </div>

          {/* Leaderboard Table Box */}
          <div className="w-full bg-white border border-[#E8E3EF] rounded-3xl p-6 shadow-md overflow-x-auto">
            {!eventState?.showLeaderboard ? (
              <div className="text-center py-16 text-[#667085] font-mono-code text-sm">
                Leaderboard is currently hidden by symposium organizers.
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-16 text-[#667085] font-mono-code text-sm">
                No active teams on the leaderboard yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E3EF] text-xs font-mono-code text-[#667085] uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold">Rank</th>
                    <th className="py-3 px-4 font-bold">Team Name & College</th>
                    <th className="py-3 px-4 font-bold text-center">Round 1</th>
                    <th className="py-3 px-4 font-bold text-center">Round 2</th>
                    <th className="py-3 px-4 font-bold text-center">Round 3</th>
                    <th className="py-3 px-4 font-bold text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {leaderboard.map((entry) => {
                    const isTop3 = entry.rank <= 3;
                    return (
                      <tr key={entry.teamId} className={`hover:bg-[#FAF5FF]/55 transition-colors ${
                        entry.rank === 1 ? 'bg-amber-50/60 font-semibold' : ''
                      }`}>
                        <td className="py-4 px-4 font-mono-code font-extrabold text-sm">
                          <div className="flex items-center gap-2">
                            {entry.rank === 1 ? (
                              <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs">1st</span>
                            ) : entry.rank === 2 ? (
                              <span className="w-7 h-7 rounded-lg bg-slate-300 text-slate-800 flex items-center justify-center text-xs shadow-xs">2nd</span>
                            ) : entry.rank === 3 ? (
                              <span className="w-7 h-7 rounded-lg bg-amber-700/80 text-white flex items-center justify-center text-xs shadow-xs">3rd</span>
                            ) : (
                              <span className="w-7 h-7 rounded-lg bg-slate-100 text-[#667085] flex items-center justify-center text-xs">{entry.rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-tech text-base font-bold text-[#24324A] tracking-wide">
                            {entry.teamName}
                          </div>
                          <div className="text-xs text-[#667085] font-mono-code">
                            {entry.college} • <span className="text-[#C83A87] font-semibold">{entry.teamId}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-mono-code font-bold text-sm text-[#24324A]">
                          {entry.round1Score}
                        </td>
                        <td className="py-4 px-4 text-center font-mono-code font-bold text-sm text-[#24324A]">
                          {entry.round2Score}
                        </td>
                        <td className="py-4 px-4 text-center font-mono-code font-bold text-sm text-[#24324A]">
                          {entry.round3Score}
                        </td>
                        <td className="py-4 px-4 text-right font-mono-code font-black text-lg text-[#C83A87]">
                          {entry.totalScore} PTS
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Display Footer */}
      <footer className="w-full border-t border-[#E8E3EF] pt-4 flex items-center justify-between text-xs text-[#667085] font-mono-code">
        <div>ACETCM'26 • TECH BRIDGE • OFFICIAL AUDITORIUM LIVE LEADERBOARD</div>
        <div>NO PHONE USE OUTSIDE COMPETITION APP • SINGLE SUBMISSION LOCKED</div>
      </footer>
    </div>
  );
};
