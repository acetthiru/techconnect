import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

interface OfflineIndicatorProps {
  isConnected: boolean;
  onRetry?: () => void;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isConnected,
  onRetry,
  className = '',
}) => {
  const [retrying, setRetrying] = useState(false);

  const handleManualRetry = () => {
    setRetrying(true);
    if (onRetry) {
      onRetry();
    }
    setTimeout(() => {
      setRetrying(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {!isConnected && (
        <motion.div
          id="offline-sync-warning-banner"
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className={`w-full overflow-hidden bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 text-white shadow-md select-none ${className}`}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-200" />
              </span>

              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold truncate">
                <WifiOff className="w-4 h-4 shrink-0 text-amber-200 animate-pulse" />
                <span className="font-tech tracking-wide uppercase text-amber-100 hidden sm:inline">
                  Offline • Connection Lost:
                </span>
                <span className="font-sans font-medium text-white/95 text-[11px] sm:text-xs">
                  Reconnecting to ACETCM'26 server. Live scores and timer updates are currently paused.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-retry-connection"
                type="button"
                onClick={handleManualRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 active:scale-95 border border-white/30 text-[11px] font-mono-code font-bold tracking-wider text-white transition-all cursor-pointer disabled:opacity-50"
                title="Force instant reconnection attempt"
              >
                <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'CONNECTING...' : 'RETRY NOW'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
