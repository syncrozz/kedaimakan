/**
 * SYNCROZZ KEDAI MAKAN - Kitchen Display System (KDS)
 * Fasa 3 — Step 2 (SES v4.5)
 *
 * Fullscreen tablet-optimized display for kitchen staff:
 * - 3 Columns: BARU (NEW), SEDANG DISEDIAKAN (PREPARING), SIAP (READY)
 * - Newest KOT at the top of each column
 * - Change tracking badges: ADDED, UPDATED, REMOVED with previous qty
 * - Web Audio API chime for new KOT arrival
 * - Real-time Firestore sync with offline fallback
 * - Auto-archive for READY tickets after 5 minutes
 * - Dedicated KITCHEN PIN authentication
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChefHat,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RefreshCw,
  History,
  LogOut,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Play,
  Check,
  AlertTriangle,
  Flame,
  Coffee,
  Sparkles,
  Wifi,
  WifiOff,
  Bell,
  Lock,
} from 'lucide-react';
import { KitchenOrderTicket, KitchenTicketStatus, KitchenStation } from '../../types/restaurant';
import { KotService } from '../../services/kotService';
import { KitchenAuthService } from '../../services/kitchenAuthService';
import { KitchenPinLoginModal } from './KitchenPinLoginModal';
import { KitchenHistoryModal } from './KitchenHistoryModal';
import { ChangeKitchenPinModal } from '../auth/ChangeKitchenPinModal';
import type { KitchenAuthSession } from '../../types/auth';

interface KitchenDisplayViewProps {
  workspaceSlug: string;
  workspaceName?: string;
  onBackToPos?: () => void;
}

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  workspaceSlug,
  workspaceName,
  onBackToPos,
}) => {
  const [tickets, setTickets] = useState<KitchenOrderTicket[]>([]);
  const [session, setSession] = useState<KitchenAuthSession | null>(() =>
    KitchenAuthService.getSession(workspaceSlug)
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(!session);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [isDefaultPinState, setIsDefaultPinState] = useState<boolean>(() => session?.isDefaultPin ?? true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [syncStatus, setSyncStatus] = useState<'CONNECTED' | 'SYNCING' | 'OFFLINE'>('SYNCING');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const previousTicketIdsRef = useRef<Set<string>>(new Set());

  // Clock ticker for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if workspace is using default kitchen PIN
  useEffect(() => {
    if (session) {
      KitchenAuthService.getStatus(workspaceSlug)
        .then((st) => {
          setIsDefaultPinState(st.isDefaultPin);
        })
        .catch(() => {});
    }
  }, [session, workspaceSlug]);

  // Subscribe to Kitchen Auth session changes
  useEffect(() => {
    const unsub = KitchenAuthService.subscribe((newSession) => {
      setSession(newSession);
      if (!newSession) {
        setIsLoginModalOpen(true);
      }
    });
    return unsub;
  }, []);

  // Check and initialize tickets & real-time sync
  useEffect(() => {
    if (!session) return;

    // Load initial local tickets immediately
    const cached = KotService.getCachedTickets(workspaceSlug);
    setTickets(cached);
    cached.forEach((t) => previousTicketIdsRef.current.add(t.id));

    // Subscribe to real-time sync
    setSyncStatus('SYNCING');
    const unsubSync = KotService.subscribeToKitchenOrders(
      workspaceSlug,
      (updatedTickets, connState) => {
        setTickets(updatedTickets);
        setSyncStatus(
          connState === 'CONNECTED'
            ? 'CONNECTED'
            : connState === 'OFFLINE_FALLBACK'
            ? 'OFFLINE'
            : 'SYNCING'
        );

        // Check if new tickets arrived to trigger chime
        const currentIds = new Set(updatedTickets.map((t) => t.id));
        let hasBrandNew = false;
        let hasUpdated = false;

        updatedTickets.forEach((t) => {
          if (!previousTicketIdsRef.current.has(t.id) && t.status === 'NEW') {
            hasBrandNew = true;
          }
          if (t.hasUnreadUpdate) {
            hasUpdated = true;
          }
        });

        previousTicketIdsRef.current = currentIds;

        if ((hasBrandNew || hasUpdated) && soundEnabled) {
          KotService.playNewKotChime();
        }
      },
      () => {
        setSyncStatus('OFFLINE');
      }
    );

    // Auto-archive runner: Check every 10 seconds for READY tickets older than 5 minutes
    const archiveInterval = setInterval(async () => {
      const archivedCount = await KotService.checkAndAutoArchiveTickets(workspaceSlug);
      if (archivedCount > 0) {
        setTickets(KotService.getCachedTickets(workspaceSlug));
      }
    }, 10000);

    return () => {
      unsubSync();
      clearInterval(archiveInterval);
    };
  }, [workspaceSlug, session, soundEnabled]);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Handle Action: NEW -> PREPARING
  const handleStartPreparing = async (ticketId: string) => {
    const operator = session?.role || 'KITCHEN';
    const updated = await KotService.updateTicketStatus(ticketId, 'PREPARING', operator, workspaceSlug);
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
  };

  // Handle Action: PREPARING -> READY
  const handleMarkReady = async (ticketId: string) => {
    const operator = session?.role || 'KITCHEN';
    const updated = await KotService.updateTicketStatus(ticketId, 'READY', operator, workspaceSlug);
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
  };

  // Handle Action: READY -> ARCHIVED
  const handleArchive = async (ticketId: string) => {
    const operator = session?.role || 'KITCHEN';
    const updated = await KotService.updateTicketStatus(ticketId, 'ARCHIVED', operator, workspaceSlug);
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
  };

  // Acknowledge update badge
  const handleAcknowledgeUpdate = (ticketId: string) => {
    KotService.markAsRead(ticketId, workspaceSlug);
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, hasUnreadUpdate: false } : t))
    );
  };

  // Manual Refresh
  const handleManualRefresh = () => {
    setSyncStatus('SYNCING');
    const fresh = KotService.getCachedTickets(workspaceSlug);
    setTickets(fresh);
    setTimeout(() => {
      setSyncStatus('CONNECTED');
    }, 400);
  };

  // Logout handler
  const handleLogout = () => {
    KitchenAuthService.logout(workspaceSlug);
    setSession(null);
    setIsLoginModalOpen(true);
  };

  // Filter tickets by station if requested
  const filteredTickets = useMemo(() => {
    if (selectedStation === 'ALL') return tickets;
    return tickets.filter((t) => t.items.some((it) => it.kitchenStation === selectedStation));
  }, [tickets, selectedStation]);

  // Split tickets into 3 columns: NEW, PREPARING, READY (Excludes ARCHIVED)
  // Newest KOT at the top of each column
  const newTickets = useMemo(() => {
    return filteredTickets
      .filter((t) => t.status === 'NEW')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredTickets]);

  const preparingTickets = useMemo(() => {
    return filteredTickets
      .filter((t) => t.status === 'PREPARING')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filteredTickets]);

  const readyTickets = useMemo(() => {
    return filteredTickets
      .filter((t) => t.status === 'READY')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filteredTickets]);

  const archivedCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'ARCHIVED').length;
  }, [tickets]);

  // Format Elapsed time
  const getElapsedTime = (isoString?: string) => {
    if (!isoString) return '00:00';
    try {
      const elapsedMs = Math.max(0, currentTime - new Date(isoString).getTime());
      const totalSecs = Math.floor(elapsedMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } catch {
      return '00:00';
    }
  };

  // Calculate Auto-Archive countdown for READY tickets (5 mins = 300s)
  const getAutoArchiveRemaining = (readyAtIso?: string) => {
    if (!readyAtIso) return '05:00';
    try {
      const readyTime = new Date(readyAtIso).getTime();
      const expireTime = readyTime + 5 * 60 * 1000;
      const remainingMs = Math.max(0, expireTime - currentTime);
      const totalSecs = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } catch {
      return '00:00';
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none overflow-x-hidden"
    >
      {/* KDS Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ChefHat className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>DAPUR</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  SES v4.5
                </span>
              </h1>
              <span className="text-xs text-stone-400 font-medium hidden md:inline">
                &bull; {workspaceName || workspaceSlug}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-400">
              {/* Sync Status Badge */}
              <div className="flex items-center gap-1.5">
                {syncStatus === 'CONNECTED' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-medium">Real-time Aktif</span>
                  </>
                ) : syncStatus === 'SYNCING' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-400 font-medium">Menyegerak...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-rose-400 font-medium">Mod Sandaran Luar Talian</span>
                  </>
                )}
              </div>

              <span className="text-stone-600">&bull;</span>
              <span>Aktif: <strong className="text-white font-mono">{newTickets.length + preparingTickets.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Station Filter (Optional) */}
          <div className="hidden lg:flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedStation('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedStation === 'ALL'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Semua Stesen
            </button>
            <button
              type="button"
              onClick={() => setSelectedStation('KITCHEN')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedStation === 'KITCHEN'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Dapur
            </button>
            <button
              type="button"
              onClick={() => setSelectedStation('BAR')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedStation === 'BAR'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Bar Air
            </button>
          </div>

          {/* Sound Toggle & Test */}
          <button
            type="button"
            id="kds-sound-toggle-btn"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) KotService.playNewKotChime();
            }}
            title={soundEnabled ? 'Bunyi Notifikasi Aktif' : 'Bunyi Dimatikan'}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            id="kds-refresh-btn"
            onClick={handleManualRefresh}
            title="Muat Semula Tiket"
            className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* History Button */}
          <button
            type="button"
            id="kds-history-btn"
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Sejarah</span>
            <span className="px-1.5 py-0.5 rounded-full bg-stone-900 text-[10px] font-mono font-bold text-stone-300">
              {archivedCount}
            </span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            id="kds-fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Skrin Penuh' : 'Skrin Penuh Tablet'}
            className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Back to POS Button */}
          {onBackToPos && (
            <button
              type="button"
              id="kds-back-to-pos-btn"
              onClick={onBackToPos}
              className="px-3 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 hover:text-white flex items-center gap-1 text-xs font-semibold transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Ke POS</span>
            </button>
          )}

          {/* Logout Kitchen Session */}
          <button
            type="button"
            id="kds-logout-btn"
            onClick={handleLogout}
            title="Log Keluar Dapur"
            className="w-10 h-10 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 flex items-center justify-center transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Default PIN Security Warning Banner */}
      {isDefaultPinState && (
        <div
          id="kds-default-pin-warning-banner"
          className="bg-amber-950/80 border-b border-amber-600/60 px-4 sm:px-6 py-2.5 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Perhatian Keselamatan PIN Dapur:</strong> Akses Dapur sedang menggunakan PIN Lalai (9999/8888). Sila tukar PIN Dapur untuk menjamin privasi operasi kedai anda.
            </span>
          </div>
          <button
            type="button"
            id="kds-change-pin-banner-btn"
            onClick={() => setIsChangePinModalOpen(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Tukar PIN Dapur</span>
          </button>
        </div>
      )}

      {/* Main KDS Grid: 3 Columns */}
      <main className="flex-1 p-3 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
        {/* ======================================================== */}
        {/* COLUMN 1: BARU (NEW) */}
        {/* ======================================================== */}
        <section
          id="kds-column-new"
          className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl overflow-hidden shadow-xl"
        >
          {/* Column Header */}
          <div className="px-4 py-3.5 bg-amber-950/40 border-b border-amber-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-sm font-black text-amber-300 tracking-wider uppercase">
                Pesanan Baru
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/40">
              {newTickets.length}
            </span>
          </div>

          {/* Tickets List */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[300px]">
            {newTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 text-xs py-16">
                <ChefHat className="w-10 h-10 mb-2 opacity-30" />
                <span>Tiada pesanan baru saat ini.</span>
              </div>
            ) : (
              newTickets.map((ticket) => (
                <KitchenTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  elapsedTime={getElapsedTime(ticket.createdAt)}
                  onAcknowledgeUpdate={() => handleAcknowledgeUpdate(ticket.id)}
                  actionButton={
                    <button
                      type="button"
                      id={`kds-btn-start-${ticket.id}`}
                      onClick={() => handleStartPreparing(ticket.id)}
                      className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>MULA SEDIAKAN</span>
                    </button>
                  }
                />
              ))
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* COLUMN 2: SEDANG DISEDIAKAN (PREPARING) */}
        {/* ======================================================== */}
        <section
          id="kds-column-preparing"
          className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl overflow-hidden shadow-xl"
        >
          {/* Column Header */}
          <div className="px-4 py-3.5 bg-sky-950/40 border-b border-sky-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <h2 className="text-sm font-black text-sky-300 tracking-wider uppercase">
                Sedang Disediakan
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs font-mono font-bold border border-sky-500/40">
              {preparingTickets.length}
            </span>
          </div>

          {/* Tickets List */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[300px]">
            {preparingTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 text-xs py-16">
                <Flame className="w-10 h-10 mb-2 opacity-30" />
                <span>Tiada pesanan sedang dimasak.</span>
              </div>
            ) : (
              preparingTickets.map((ticket) => (
                <KitchenTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  elapsedTime={getElapsedTime(ticket.startedAt || ticket.createdAt)}
                  onAcknowledgeUpdate={() => handleAcknowledgeUpdate(ticket.id)}
                  actionButton={
                    <button
                      type="button"
                      id={`kds-btn-ready-${ticket.id}`}
                      onClick={() => handleMarkReady(ticket.id)}
                      className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-stone-950 font-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>SIAP DIHIDANG</span>
                    </button>
                  }
                />
              ))
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* COLUMN 3: SIAP (READY) */}
        {/* ======================================================== */}
        <section
          id="kds-column-ready"
          className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl overflow-hidden shadow-xl"
        >
          {/* Column Header */}
          <div className="px-4 py-3.5 bg-emerald-950/40 border-b border-emerald-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-black text-emerald-300 tracking-wider uppercase">
                Siap Dihidang
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/40">
              {readyTickets.length}
            </span>
          </div>

          {/* Tickets List */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[300px]">
            {readyTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 text-xs py-16">
                <CheckCircle2 className="w-10 h-10 mb-2 opacity-30" />
                <span>Tiada pesanan menunggu untuk diambil / dihantar.</span>
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <KitchenTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  elapsedTime={getElapsedTime(ticket.readyAt || ticket.createdAt)}
                  autoArchiveRemaining={getAutoArchiveRemaining(ticket.readyAt)}
                  onAcknowledgeUpdate={() => handleAcknowledgeUpdate(ticket.id)}
                  actionButton={
                    <button
                      type="button"
                      id={`kds-btn-archive-${ticket.id}`}
                      onClick={() => handleArchive(ticket.id)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-98 text-stone-200 font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 border border-stone-700 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>SELESAI / ARKIB SEKARANG</span>
                    </button>
                  }
                />
              ))
            )}
          </div>
        </section>
      </main>

      {/* PIN Login Modal if session expired or locked */}
      <KitchenPinLoginModal
        isOpen={isLoginModalOpen}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        onSuccess={(authSession) => {
          setSession(authSession);
          setIsLoginModalOpen(false);
        }}
        onCancel={() => {
          if (onBackToPos) onBackToPos();
        }}
      />

      {/* KOT History Modal */}
      <KitchenHistoryModal
        isOpen={isHistoryModalOpen}
        tickets={tickets}
        workspaceSlug={workspaceSlug}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Change Kitchen PIN Modal */}
      <ChangeKitchenPinModal
        isOpen={isChangePinModalOpen}
        workspaceSlug={workspaceSlug}
        onClose={() => setIsChangePinModalOpen(false)}
        onSuccess={() => {
          setIsDefaultPinState(false);
        }}
      />
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: KITCHEN TICKET CARD
// ============================================================================

interface KitchenTicketCardProps {
  ticket: KitchenOrderTicket;
  elapsedTime: string;
  autoArchiveRemaining?: string;
  actionButton: React.ReactNode;
  onAcknowledgeUpdate: () => void;
}

const KitchenTicketCard: React.FC<KitchenTicketCardProps> = ({
  ticket,
  elapsedTime,
  autoArchiveRemaining,
  actionButton,
  onAcknowledgeUpdate,
}) => {
  const isTakeaway = ticket.orderType === 'TAKEAWAY';
  const isDelivery = ticket.orderType === 'DELIVERY';

  return (
    <div
      id={`kds-card-${ticket.id}`}
      className={`rounded-2xl border p-4 flex flex-col transition shadow-md ${
        ticket.hasUnreadUpdate
          ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/50 animate-pulse'
          : ticket.status === 'READY'
          ? 'bg-stone-900/90 border-emerald-900/60'
          : ticket.status === 'PREPARING'
          ? 'bg-stone-900/90 border-sky-900/60'
          : 'bg-stone-900/90 border-stone-800'
      }`}
    >
      {/* Unread Update Banner */}
      {ticket.hasUnreadUpdate && (
        <div
          onClick={onAcknowledgeUpdate}
          className="mb-3 p-2 bg-amber-500 text-stone-950 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer active:scale-98 transition shadow-md"
        >
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>KEMAS KINI PESANAN BAHARU!</span>
          </div>
          <span className="text-[10px] bg-stone-950/20 px-2 py-0.5 rounded font-bold">
            Klik Sahkan
          </span>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start justify-between border-b border-stone-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-sm text-white">{ticket.orderNumber}</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isTakeaway
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                  : isDelivery
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                  : 'bg-stone-800 text-stone-300 border border-stone-700'
              }`}
            >
              {ticket.tableName || (isTakeaway ? 'BUNGKUS' : 'DELIVERY')}
            </span>
          </div>

          <div className="text-xs text-stone-400 mt-1 flex items-center gap-2">
            {ticket.guestCount ? (
              <span>{ticket.guestCount} Pax</span>
            ) : ticket.customerName ? (
              <span>{ticket.customerName}</span>
            ) : null}
            {ticket.operator && (
              <>
                <span className="text-stone-600">&bull;</span>
                <span className="text-stone-500">Staf: {ticket.operator}</span>
              </>
            )}
          </div>
        </div>

        {/* Elapsed Timer / Auto-archive counter */}
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-stone-950 px-2 py-1 rounded-lg border border-stone-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{elapsedTime}</span>
          </div>
          {autoArchiveRemaining && (
            <span className="text-[10px] text-stone-500 block mt-1">
              Auto-arkib: {autoArchiveRemaining}
            </span>
          )}
        </div>
      </div>

      {/* Kitchen Notes (if present) */}
      {ticket.notes && (
        <div className="my-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong className="font-bold">Nota Khas:</strong> {ticket.notes}
          </div>
        </div>
      )}

      {/* Item List (Large typography for touch tablet glanceability) */}
      <div className="py-3 space-y-2 flex-1">
        {ticket.items.map((item, idx) => {
          const isAdded = item.changeType === 'ADDED';
          const isUpdated = item.changeType === 'UPDATED';
          const isRemoved = item.changeType === 'REMOVED';

          return (
            <div
              key={idx}
              className={`p-2 rounded-xl border transition ${
                isRemoved
                  ? 'bg-rose-950/20 border-rose-900/50 text-rose-300/60 line-through'
                  : isAdded
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-100 ring-1 ring-emerald-500/30'
                  : isUpdated
                  ? 'bg-amber-950/20 border-amber-800/60 text-amber-100 ring-1 ring-amber-500/30'
                  : 'bg-stone-950/50 border-stone-850 text-stone-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`font-mono text-base font-black px-2 py-0.5 rounded-lg ${
                      isRemoved
                        ? 'bg-rose-950 text-rose-400'
                        : isAdded
                        ? 'bg-emerald-600 text-white'
                        : isUpdated
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-800 text-stone-100'
                    }`}
                  >
                    {item.quantity}x
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white tracking-tight">{item.name}</span>
                      {isAdded && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-600 text-white tracking-wider">
                          + BAHARU
                        </span>
                      )}
                      {isUpdated && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-600 text-white tracking-wider">
                          DIUBAH (Asal: {item.previousQuantity})
                        </span>
                      )}
                      {isRemoved && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white tracking-wider">
                          BATAL
                        </span>
                      )}
                    </div>

                    {/* Modifiers Snapshot */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-[11px] text-stone-400 mt-0.5 font-medium">
                        {item.modifiers.join(', ')}
                      </p>
                    )}

                    {/* Line Notes */}
                    {item.notes && (
                      <p className="text-[11px] text-amber-300/90 font-medium italic mt-0.5">
                        &bull; {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button Footer */}
      <div className="pt-2 border-t border-stone-800/80 mt-auto">{actionButton}</div>
    </div>
  );
};
