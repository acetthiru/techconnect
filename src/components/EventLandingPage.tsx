import React, { useState } from 'react';
import { AppViewMode } from './TopNav';
import { ResponsiveImage } from './ResponsiveImage';

interface EventLandingPageProps {
  onEnterEvent: (mode?: AppViewMode) => void;
  eventStatus?: string;
  currentRound?: number;
  totalTeams?: number;
}

export const EventLandingPage: React.FC<EventLandingPageProps> = ({
  onEnterEvent,
}) => {
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);

  return (
    <div 
      id="event-landing-root" 
      className="fixed inset-0 w-full h-full h-[100dvh] max-w-[100vw] max-h-[100dvh] overflow-hidden bg-black text-slate-100 flex flex-col justify-between items-center select-none"
    >
      {/* High-Performance GPU Ambient Glow Backdrop */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-35 blur-3xl scale-110 transform-gpu bg-[radial-gradient(circle_at_50%_45%,rgba(200,58,135,0.35),rgba(246,215,107,0.25),transparent_70%)]"
      />

      {/* Subtle Top Header Tag - Compact to leave 90%+ vertical space for the image */}
      <header className="relative z-10 shrink-0 w-full pt-[max(0.5rem,env(safe-area-inset-top))] px-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono-code font-bold tracking-wider uppercase bg-amber-400/10 text-amber-300 border border-amber-400/20 backdrop-blur-sm">
            ACETCM'26 &bull; CSE
          </span>
        </div>

        {/* Quick Zoom/Expand hint on mobile */}
        <button
          type="button"
          onClick={() => setShowFullscreenModal(true)}
          className="pointer-events-auto text-[11px] sm:text-xs font-mono-code text-slate-300 hover:text-amber-300 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer"
          title="View entire poster in full screen"
        >
          <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <span>Full Image</span>
        </button>
      </header>

      {/* Main Foreground Poster Stage - Guarantees 100% of the entire image is shown without clipping */}
      <main className="relative z-10 flex-1 w-full max-w-full min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div 
          onClick={() => setShowFullscreenModal(true)}
          className="relative w-full h-full flex items-center justify-center cursor-pointer group"
          title="Click to view entire poster in full screen"
        >
          <ResponsiveImage
            id="landing-event-poster-img"
            src="/tech_bridge_landing.webp"
            alt="TECH BRIDGE '26 National Symposium Poster - Achariya College of Engineering Technology"
            widths={[360, 480, 768, 1080, 1440]}
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 96vw, (max-width: 1200px) 90vw, 1200px"
            priority
            fallbackSrc="/tech_bridge_poster.webp"
            style={{ objectFit: 'contain' }}
            className="w-auto h-auto max-w-full max-h-full object-contain object-center block drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.01]"
            containerClassName="w-full h-full flex items-center justify-center"
          />

          {/* Discreet tap-to-expand badge for mobile guidance */}
          <div className="sm:hidden absolute top-2 right-2 bg-black/60 backdrop-blur-md text-amber-300 text-[10px] font-mono-code px-2 py-0.5 rounded-md border border-amber-400/20 opacity-75">
            Tap to zoom
          </div>
        </div>
      </main>

      {/* Bottom Action Dock - Cleanly separated so it NEVER overlaps or blocks the poster */}
      <footer className="relative z-20 shrink-0 w-full flex flex-col items-center justify-center px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-1.5 bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Clearly Visible ENTER Button with Fullscreen Quick Toggle */}
        <div className="flex items-center gap-3 w-full max-w-sm justify-center">
          <button
            id="btn-enter-event-main"
            type="button"
            onClick={() => onEnterEvent('rules')}
            aria-label="Enter TECH BRIDGE 26 Competition Rules and Arena"
            className="flex-1 group relative overflow-hidden px-8 sm:px-14 py-3 sm:py-4 rounded-2xl font-tech font-extrabold text-base sm:text-2xl tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:from-amber-300 hover:via-orange-300 hover:to-amber-200 shadow-2xl shadow-amber-500/50 hover:shadow-amber-500/80 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-amber-200/90 inline-flex items-center justify-center gap-2.5 sm:gap-3.5 focus:outline-none focus:ring-4 focus:ring-amber-400/50"
          >
            {/* Animated shimmer sweep */}
            <span className="absolute inset-0 w-1/2 h-full bg-white/40 skew-x-12 -translate-x-full group-hover:translate-x-[350%] transition-transform duration-1000" />
            
            <span className="relative z-10 uppercase tracking-widest font-black">ENTER</span>
            <svg 
              className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 text-slate-950 group-hover:translate-x-1.5 transition-transform" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>

          {/* Mobile Fullscreen trigger button */}
          <button
            type="button"
            onClick={() => setShowFullscreenModal(true)}
            aria-label="Open Fullscreen Poster View"
            className="p-3 sm:p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-amber-300 transition-all flex items-center justify-center cursor-pointer"
            title="Expand Full Poster"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>

        <span className="text-[10px] sm:text-xs font-mono-code text-amber-300/90 font-semibold tracking-wider uppercase flex items-center gap-1.5 drop-shadow">
          <svg 
            className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 fill-amber-400" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
          </svg>
          Department of Computer Science and Engineering &bull; ACETCM'26
        </span>
      </footer>

      {/* Interactive Mobile Fullscreen Poster Modal */}
      {showFullscreenModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen symposium poster view"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-tech font-bold text-amber-300 text-sm tracking-wider uppercase">
                TECH BRIDGE '26 &bull; Official Symposium Poster
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFullscreenModal(false)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white font-mono-code text-xs transition-all cursor-pointer flex items-center gap-1 border border-white/10"
              aria-label="Close full screen view"
            >
              <span>✕ Close</span>
            </button>
          </div>

          {/* Modal Zoom/Pan Canvas */}
          <div className="flex-1 w-full min-h-0 overflow-auto flex items-center justify-center p-1 sm:p-4 touch-pan-x touch-pan-y">
            <ResponsiveImage
              src="/tech_bridge_landing.webp"
              alt="TECH BRIDGE '26 Official Poster Full View"
              widths={[768, 1080, 1440]}
              sizes="100vw"
              priority
              fallbackSrc="/tech_bridge_poster.webp"
              style={{ objectFit: 'contain' }}
              className="max-w-full max-h-full w-auto h-auto object-contain block mx-auto rounded-lg shadow-2xl"
              containerClassName="w-full h-full flex items-center justify-center"
            />
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0 gap-3">
            <span className="text-[11px] font-mono-code text-slate-400 hidden sm:inline">
              Pinch or scroll to inspect symposium details, rules & contact info
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowFullscreenModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono-code text-slate-300 transition-all cursor-pointer"
              >
                Back to Stage
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFullscreenModal(false);
                  onEnterEvent('rules');
                }}
                className="flex-1 sm:flex-initial px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-tech font-bold text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-500/30 cursor-pointer"
              >
                Enter Rules & Arena &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
