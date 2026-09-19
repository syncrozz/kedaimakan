/**
 * NiagaPOS V2 - Master Admin Control Console (SES v4.4)
 * Complete real client setup and tenant workspace operations:
 * 1. Create client workspace & register slug, owner name/email
 * 2. Securely store in Firestore (/workspaces, /workspace_slugs, /members)
 * 3. Assign OWNER role and generate Firebase Auth invite pack
 * 4. Generate client access URL: https://niagapos.syncrozz.com/{slug}
 * 5. Manage client status (Extend Trial, Suspend, Reactivate)
 * 6. Quick Launch directly into client workspace
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Plus,
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
  Calendar,
  Lock,
  ArrowRight,
  TrendingUp,
  Store,
  Users,
  AlertTriangle,
  KeyRound,
  FileText,
} from 'lucide-react';
import { WorkspaceService, PRODUCTION_DOMAIN } from '../services/workspaceService';
import { ClientAuthService } from '../services/clientAuthService';
import { CreateWorkspaceModal } from '../components/workspace/CreateWorkspaceModal';
import { ResetPinConfirmModal } from '../components/admin/ResetPinConfirmModal';
import { AuditLogsModal } from '../components/admin/AuditLogsModal';
import { useStore } from '../context/StoreContext';
import type { Workspace, ClientAccessDetails } from '../types/workspace';
import type { AuditLogRecord } from '../types/auth';

interface MasterAdminPageProps {
  onExitAdmin?: () => void;
  onSelectWorkspace?: (slug: string) => void;
}

export const MasterAdminPage: React.FC<MasterAdminPageProps> = ({
  onExitAdmin,
  onSelectWorkspace,
}) => {
  const { isAdminMode } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(isAdminMode) || Boolean(ClientAuthService.getMasterAdminSession());
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  // Reset PIN and Audit Log modals
  const [resetPinWorkspace, setResetPinWorkspace] = useState<Workspace | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Load Workspaces
  const loadWorkspaces = async () => {
    setLoadingList(true);
    try {
      const list = await WorkspaceService.getAllWorkspacesAsync();
      setWorkspaces(list);
    } catch (e) {
      console.warn('Failed loading workspaces:', e);
    } finally {
      setLoadingList(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const logs = await ClientAuthService.getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Failed loading audit logs:', e);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
      loadAuditLogs();
    }
  }, [isAuthenticated]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setIsVerifyingPin(true);

    try {
      const res = await ClientAuthService.adminLogin(pinInput);
      if (res.success) {
        setIsAuthenticated(true);
        setPinInput('');
      } else {
        setPinError(res.error || 'PIN Master Admin tidak sah.');
      }
    } catch {
      setPinError('Ralat pengesahan PIN.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCopyUrl = (slug: string) => {
    const url = WorkspaceService.getClientAccessUrl(slug);
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleExtendTrial = async (wsId: string, days: number = 30) => {
    const res = await WorkspaceService.extendTrial(wsId, days);
    if (res.success) {
      setStatusMessage({ text: `Tempoh percubaan dilanjutkan ${days} hari.`, type: 'success' });
      loadWorkspaces();
    } else {
      setStatusMessage({ text: res.error || 'Gagal melanjutkan tempoh percubaan.', type: 'error' });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleToggleSuspend = async (ws: Workspace) => {
    if (ws.status === 'SUSPENDED') {
      const res = await WorkspaceService.reactivateWorkspace(ws.workspaceId);
      if (res.success) {
        setStatusMessage({ text: `Workspace ${ws.workspaceName} telah diaktifkan semula.`, type: 'success' });
        loadWorkspaces();
      }
    } else {
      if (confirm(`Adakah anda pasti untuk menggantung (SUSPEND) workspace "${ws.workspaceName}"? Akses klien akan disekat serta-merta.`)) {
        const res = await WorkspaceService.suspendWorkspace(ws.workspaceId);
        if (res.success) {
          setStatusMessage({ text: `Workspace ${ws.workspaceName} telah digantung.`, type: 'success' });
          loadWorkspaces();
        }
      }
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const filteredWorkspaces = workspaces.filter(
    (w) =>
      w.workspaceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.workspaceSlug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Status Badge Helper
  const renderStatusBadge = (ws: Workspace) => {
    const calculated = WorkspaceService.calculateTrialStatus(ws);
    switch (calculated) {
      case 'ACTIVE':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            Aktif (Trial)
          </span>
        );
      case 'TRIAL_ENDING':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
            Hampir Tamat
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800">
            Tempoh Tangguh
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
            Tamat Tempoh
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
            Digantung
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-300">
            {calculated}
          </span>
        );
    }
  };

  // PIN Login View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-lg text-white tracking-tight">Konsol Master Admin</h2>
            <p className="text-xs text-stone-400">
              NiagaPOS Multi-Client Management &amp; Client Onboarding Platform
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 block text-center">
                Masukkan 4-Digit Nombor PIN Keselamatan
              </label>
              <input
                id="master-admin-pin-input"
                type="password"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={pinInput}
                disabled={isVerifyingPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinInput(val);
                  setPinError(null);
                  if (val.length === 4) {
                    setIsVerifyingPin(true);
                    ClientAuthService.adminLogin(val)
                      .then((res) => {
                        if (res.success) {
                          setIsAuthenticated(true);
                          setPinInput('');
                        } else {
                          setPinError(res.error || 'PIN Master Admin tidak sah. Sila cuba lagi.');
                        }
                      })
                      .finally(() => setIsVerifyingPin(false));
                  }
                }}
                className="w-full text-center text-2xl tracking-[0.6em] font-mono bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 text-white outline-none transition-all"
              />
            </div>

            <button
              id="master-admin-login-btn"
              type="submit"
              disabled={isVerifyingPin || pinInput.length < 4}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isVerifyingPin ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Log Masuk ke Konsol Pentadbir</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={onExitAdmin}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              &larr; Kembali ke Aplikasi Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Master Admin Dashboard View
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-stone-800 bg-stone-900/60 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight">
                NiagaPOS V2 — Master Admin Console
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-stone-800 text-stone-300 border border-stone-700">
                SES v4.4 Multi-Client
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-400">
              Pengurusan Klien, Pendaftaran Workspace, Jemputan Pemilik &amp; Kitaran Hayat Percubaan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap ml-auto sm:ml-0">
          <button
            id="open-audit-logs-btn"
            onClick={() => {
              loadAuditLogs();
              setIsAuditModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
            title="Buka Log Audit Keselamatan"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Log Audit</span>
          </button>

          <button
            id="refresh-workspaces-btn"
            onClick={loadWorkspaces}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors cursor-pointer"
            title="Muat Semula"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="open-create-workspace-modal-btn"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Daftar Klien Baharu</span>
          </button>
          {onExitAdmin && (
            <button
              type="button"
              onClick={() => {
                ClientAuthService.clearMasterAdminSession();
                onExitAdmin();
              }}
              className="px-3 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Keluar Admin
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Status Alert Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-fadeIn ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-red-950/60 border-red-800 text-red-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-medium">Jumlah Workspace Klien</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{workspaces.length}</div>
            <div className="text-[11px] text-stone-500 mt-1">Tenant berdaftar di sistem</div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-medium">Workspace Aktif</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {workspaces.filter((w) => WorkspaceService.calculateTrialStatus(w) === 'ACTIVE').length}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">Beroperasi dalam tempoh percubaan</div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-medium">Hampir Tamat / Tangguh</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {
                workspaces.filter((w) => {
                  const s = WorkspaceService.calculateTrialStatus(w);
                  return s === 'TRIAL_ENDING' || s === 'GRACE_PERIOD';
                }).length
              }
            </div>
            <div className="text-[11px] text-stone-500 mt-1">&le; 7 hari atau fasa tangguh</div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-medium">Digantung / Tamat</span>
              <Ban className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">
              {
                workspaces.filter((w) => {
                  const s = WorkspaceService.calculateTrialStatus(w);
                  return s === 'SUSPENDED' || s === 'EXPIRED';
                }).length
              }
            </div>
            <div className="text-[11px] text-stone-500 mt-1">Sekatan penulisan aktif</div>
          </div>
        </div>

        {/* Workspaces Table Section */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-stone-800 flex flex-col md:flex-row items-center justify-between gap-3 bg-stone-950/40">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-workspace-input"
                type="text"
                placeholder="Cari kedai, slug, nama pemilik, atau emel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-stone-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="text-xs text-stone-400 flex items-center gap-2">
              <span>Domain Pengeluaran:</span>
              <code className="bg-stone-800 px-2 py-0.5 rounded text-emerald-400 font-mono text-[11px]">
                {PRODUCTION_DOMAIN}
              </code>
            </div>
          </div>

          {/* Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950/60 text-stone-400 font-semibold border-b border-stone-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nama Kedai &amp; Slug</th>
                  <th className="px-5 py-3">Pemilik (OWNER)</th>
                  <th className="px-5 py-3">Status Kitaran Hayat</th>
                  <th className="px-5 py-3">Baki Percubaan</th>
                  <th className="px-5 py-3">Pautan Akses Rasmi</th>
                  <th className="px-5 py-3 text-right">Tindakan Pentadbir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-200">
                {filteredWorkspaces.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-500">
                      {workspaces.length === 0 ? (
                        <div className="space-y-3">
                          <Building2 className="w-10 h-10 text-stone-600 mx-auto" />
                          <p className="text-sm font-semibold text-stone-400">Belum Ada Workspace Klien</p>
                          <p className="text-xs text-stone-500 max-w-sm mx-auto">
                            Daftarkan klien pertama anda untuk menjana workspace terpencil dan pautan akses rasmi.
                          </p>
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Daftar Klien Baharu</span>
                          </button>
                        </div>
                      ) : (
                        <span>Tiada workspace sepadan dengan carian "{searchTerm}".</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredWorkspaces.map((ws) => {
                    const remaining = WorkspaceService.getRemainingTime(ws);
                    const accessUrl = WorkspaceService.getClientAccessUrl(ws.workspaceSlug);
                    return (
                      <tr key={ws.workspaceId} className="hover:bg-stone-800/40 transition-colors">
                        {/* Name & Slug */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white text-sm tracking-tight">{ws.workspaceName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded">
                              /{ws.workspaceSlug}
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              ID: {ws.workspaceId}
                            </span>
                          </div>
                        </td>

                        {/* Owner Info */}
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-stone-200">{ws.ownerName}</div>
                          <div className="text-stone-400 text-[11px]">{ws.ownerEmail}</div>
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                            OWNER
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-5 py-3.5">
                          {renderStatusBadge(ws)}
                          <div className="text-[10px] text-stone-500 mt-1">
                            Tamat: {new Date(ws.trialExpiresAt).toLocaleDateString('ms-MY')}
                          </div>
                        </td>

                        {/* Remaining Time */}
                        <td className="px-5 py-3.5">
                          {remaining.isExpired ? (
                            <span className="text-rose-400 font-semibold text-xs">Tamat Tempoh</span>
                          ) : remaining.isGrace ? (
                            <span className="text-orange-400 font-semibold text-xs">
                              {remaining.days}h {remaining.hours}j (Tangguh)
                            </span>
                          ) : (
                            <span className="text-stone-200 font-semibold text-xs">
                              {remaining.days} hari {remaining.hours} jam
                            </span>
                          )}
                          <div className="text-[10px] text-stone-500">
                            Tempoh: {ws.trialDurationDays} hari
                          </div>
                        </td>

                        {/* Access URL */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-stone-300 truncate max-w-[200px]" title={accessUrl}>
                              {accessUrl}
                            </span>
                            <button
                              onClick={() => handleCopyUrl(ws.workspaceSlug)}
                              className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
                              title="Salin Pautan"
                            >
                              {copiedSlug === ws.workspaceSlug ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={`/${ws.workspaceSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
                              title="Buka Workspace"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Launch / Switch Workspace */}
                            <button
                              onClick={() => {
                                if (onSelectWorkspace) {
                                  onSelectWorkspace(ws.workspaceSlug);
                                } else {
                                  window.location.href = `/${ws.workspaceSlug}`;
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Buka Workspace dalam Sesi"
                            >
                              <span>Buka POS</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            {/* Extend Trial */}
                            <button
                              onClick={() => handleExtendTrial(ws.workspaceId, 30)}
                              className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors cursor-pointer"
                              title="Lanjutkan 30 Hari"
                            >
                              +30 Hari
                            </button>

                            {/* Reset Client PIN */}
                            <button
                              onClick={() => setResetPinWorkspace(ws)}
                              className="px-2 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              title="Tetapkan Semula PIN Klien ke 1234"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset PIN</span>
                            </button>

                            {/* Suspend / Reactivate */}
                            <button
                              onClick={() => handleToggleSuspend(ws)}
                              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                ws.status === 'SUSPENDED'
                                  ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                                  : 'bg-stone-800 text-stone-400 hover:text-rose-400 hover:bg-stone-700'
                              }`}
                              title={ws.status === 'SUSPENDED' ? 'Aktifkan Semula' : 'Gantung Workspace'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Client Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(details) => {
          loadWorkspaces();
          loadAuditLogs();
          setStatusMessage({
            text: `Workspace "${details.workspace.workspaceName}" berjaya didaftarkan. Pautan akses: ${details.accessUrl}`,
            type: 'success',
          });
        }}
      />

      {/* Reset Client PIN Confirmation Modal */}
      <ResetPinConfirmModal
        isOpen={Boolean(resetPinWorkspace)}
        workspace={resetPinWorkspace}
        onClose={() => setResetPinWorkspace(null)}
        onSuccess={(msg) => {
          setStatusMessage({ text: msg, type: 'success' });
          loadAuditLogs();
        }}
      />

      {/* Security Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
        onRefresh={loadAuditLogs}
        loading={loadingAuditLogs}
      />
    </div>
  );
};
