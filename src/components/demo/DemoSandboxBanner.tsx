import React, { useState, useEffect } from 'react';
import { PlayCircle, RotateCcw, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { DemoAnalyticsService } from '../../services/demoAnalyticsService';
import { DemoSandboxService } from '../../services/demoSandboxService';
import { DemoResetConfirmModal } from './DemoResetConfirmModal';

interface DemoSandboxBannerProps {
  workspaceSlug?: string;
}

export const DemoSandboxBanner: React.FC<DemoSandboxBannerProps> = ({ workspaceSlug }) => {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [masterAdminToken, setMasterAdminToken] = useState<string | null>(null);

  const isDemo = DemoSandboxService.isDemoWorkspace(workspaceSlug);

  useEffect(() => {
    if (!isDemo) return;

    // Initialize telemetry session
    const session = DemoAnalyticsService.initSession();
    setSessionSeconds(session.activeSeconds);

    const interval = setInterval(() => {
      const s = DemoAnalyticsService.getSession();
      if (s) setSessionSeconds(s.activeSeconds);
    }, 1000);

    // Check if Master Admin token exists in localStorage/sessionStorage
    try {
      const token = localStorage.getItem('niagapos_admin_token') || sessionStorage.getItem('niagapos_admin_token');
      if (token) setMasterAdminToken(token);
    } catch {}

    return () => {
      clearInterval(interval);
    };
  }, [isDemo]);

  if (!isDemo) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  const handleRefreshView = async () => {
    await DemoSandboxService.refreshDemoView();
  };

  return (
    <>
      <div
        id="demo-sandbox-global-banner"
        className="bg-amber-900 text-amber-50 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-amber-800/80 shadow-xs z-40 select-none"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-800/90 text-amber-200 border border-amber-700/60 uppercase tracking-wide">
            <PlayCircle className="w-3 h-3 text-amber-400" />
            Sandbox Demo
          </span>
          <span className="hidden sm:inline font-medium text-amber-100/90">
            Ruang Ujian Kongsi Kedai Makan (SES v4.5) &bull; PIN Rasmi: <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">1234</code>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1 text-amber-200/80">
            <Clock className="w-3.5 h-3.5" />
            <span>Sesi: {formatTime(sessionSeconds)}</span>
          </div>

          <button
            id="btn-demo-refresh-view"
            type="button"
            onClick={handleRefreshView}
            title="Muat semula paparan data tempatan tanpa merosakkan pangkalan data awan"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-100 bg-amber-800/80 hover:bg-amber-700/90 rounded border border-amber-700/80 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Muat Semula Paparan</span>
          </button>

          {masterAdminToken && (
            <button
              id="btn-trigger-master-reset"
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              title="Tetapan Semula Penuh Pangkalan Data (Hanya Master Admin)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-100 bg-rose-900/90 hover:bg-rose-800 rounded border border-rose-700 transition-colors shadow-2xs"
            >
              <ShieldCheck className="w-3 h-3 text-rose-300" />
              <span>Reset Global (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {masterAdminToken && (
        <DemoResetConfirmModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          masterAdminToken={masterAdminToken}
        />
      )}
    </>
  );
};
