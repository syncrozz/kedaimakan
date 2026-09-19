/**
 * NiagaPOS V2 - Full Client Multi-Tenant Architecture Entry
 * 
 * Supports:
 * - Master Admin Onboarding Console (`/admin` or admin mode button)
 * - Tenant Client Workspaces (`/{workspaceSlug}`)
 * - Trial Lifecycle Banner & Hard Lockdown for Expired/Suspended Workspaces
 * - Standard POS & Store pages with isolated data per client
 */

import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AppShell } from './components/layout/AppShell';
import { ActivePage } from './types';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { PosPage } from './pages/PosPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MasterAdminPage } from './pages/MasterAdminPage';
import { KitchenDisplayView } from './components/kds/KitchenDisplayView';
import { parseRoute, pushRoute } from './services/urlRouter';
import { WorkspaceService } from './services/workspaceService';
import { updatePWAManifest } from './services/pwaManifestService';
import type { Workspace } from './types/workspace';
import {
  AlertOctagon,
  Clock,
  ShieldAlert,
  Ban,
  ExternalLink,
  Building2,
  AlertTriangle,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ClientLoginScreen } from './components/auth/ClientLoginScreen';
import { ChangePinModal } from './components/auth/ChangePinModal';
import { ClientAuthService } from './services/clientAuthService';
import { DeploymentVersionService } from './services/deploymentVersionService';
import type { ClientAuthSession } from './types/auth';

function WorkspaceTrialBanner({ workspace }: { workspace: Workspace }) {
  const trialStatus = WorkspaceService.calculateTrialStatus(workspace);
  const remaining = WorkspaceService.getRemainingTime(workspace);

  if (trialStatus === 'ACTIVE' && remaining.days > 7) {
    return null;
  }

  if (trialStatus === 'TRIAL_ENDING') {
    return (
      <div className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Peringatan Tempoh Percubaan: Baki {remaining.days} hari {remaining.hours} jam sebelum percubaan akaun{' '}
            <strong>{workspace.workspaceName}</strong> tamat.
          </span>
        </div>
        <span className="text-[11px] bg-amber-600/30 px-2 py-0.5 rounded font-mono">
          Tamat: {new Date(workspace.trialExpiresAt).toLocaleDateString('ms-MY')}
        </span>
      </div>
    );
  }

  if (trialStatus === 'GRACE_PERIOD') {
    return (
      <div className="bg-orange-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>
            Fasa Tangguh (Grace Period): Percubaan telah tamat. Sistem akan disekat dalam {remaining.days} hari {remaining.hours} jam.
          </span>
        </div>
        <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded font-mono">
          Sekatan Penuh: {new Date(workspace.gracePeriodEndsAt).toLocaleDateString('ms-MY')}
        </span>
      </div>
    );
  }

  if (trialStatus === 'EXPIRED' || trialStatus === 'SUSPENDED') {
    return (
      <div className="bg-rose-700 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 shrink-0" />
          <span>
            {trialStatus === 'SUSPENDED'
              ? `Akaun Workspace "${workspace.workspaceName}" telah digantung oleh Pentadbir Platform.`
              : `Tempoh percubaan untuk "${workspace.workspaceName}" telah tamat. Mod Baca Sahaja aktif.`}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider bg-black/30 px-2 py-0.5 rounded">
          SEKATAN PENULISAN AKTIF (SES v4.4)
        </span>
      </div>
    );
  }

  return null;
}

function MainAppContent() {
  const { store, updateStoreDetails, isAdminMode } = useStore();
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [activePage, setActivePage] = useState<ActivePage>(() => route.systemPage || 'pos');
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isResolvingWorkspace, setIsResolvingWorkspace] = useState<boolean>(() => Boolean(route.workspaceSlug));
  const [clientSession, setClientSession] = useState<ClientAuthSession | null>(() => {
    const parsed = parseRoute(typeof window !== 'undefined' ? window.location.pathname : '');
    return parsed.workspaceSlug ? ClientAuthService.getSession(parsed.workspaceSlug) : null;
  });
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  useEffect(() => {
    // Initialize SES v4.5 Deployment Version and Continuity tracking
    DeploymentVersionService.init();

    const handlePopState = () => {
      const parsed = parseRoute(window.location.pathname);
      setRoute(parsed);
      if (parsed.systemPage) {
        setActivePage(parsed.systemPage);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync workspace from route
  useEffect(() => {
    if (route.workspaceSlug) {
      setIsResolvingWorkspace(true);
      WorkspaceService.getWorkspaceBySlugAsync(route.workspaceSlug)
        .then((ws) => {
          if (ws) {
            setCurrentWorkspace(ws);
          } else {
            // If slug not registered yet, check local
            const localWs = WorkspaceService.getWorkspaceBySlug(route.workspaceSlug!);
            setCurrentWorkspace(localWs);
          }
        })
        .finally(() => {
          setIsResolvingWorkspace(false);
        });
    } else {
      setCurrentWorkspace(null);
      setIsResolvingWorkspace(false);
    }
  }, [route.workspaceSlug]);

  // Sync client session when currentWorkspace changes
  useEffect(() => {
    if (currentWorkspace) {
      const sess = ClientAuthService.getSession(currentWorkspace.workspaceSlug);
      setClientSession(sess);
    } else {
      setClientSession(null);
    }
  }, [currentWorkspace]);

  // Subscribe to external ClientAuthService state updates
  useEffect(() => {
    const unsub = ClientAuthService.subscribe((sess) => {
      if (currentWorkspace && sess?.workspaceSlug === currentWorkspace.workspaceSlug) {
        setClientSession(sess);
      } else if (!sess && currentWorkspace) {
        setClientSession(null);
      }
    });
    return unsub;
  }, [currentWorkspace]);

  // Sync document title, store branding, and PWA manifest to active workspace
  useEffect(() => {
    if (currentWorkspace) {
      document.title = `${currentWorkspace.workspaceName} — NiagaPOS`;
      if (currentWorkspace.workspaceName && store.name !== currentWorkspace.workspaceName) {
        updateStoreDetails({
          name: currentWorkspace.workspaceName,
          code: currentWorkspace.workspaceSlug.toUpperCase(),
        });
      }
      updatePWAManifest({
        workspaceSlug: currentWorkspace.workspaceSlug,
        workspaceName: currentWorkspace.workspaceName,
      });
    } else if (route.isMasterAdmin) {
      document.title = 'Konsol Master Admin — NiagaPOS V2';
      updatePWAManifest({
        workspaceSlug: null,
        workspaceName: 'Master Admin',
      });
    } else {
      document.title = 'NiagaPOS';
      if (store.name !== 'NiagaPOS') {
        updateStoreDetails({
          name: 'NiagaPOS',
          code: 'NP-01',
        });
      }
      updatePWAManifest({
        workspaceSlug: route.workspaceSlug,
        workspaceName: null,
      });
    }
  }, [currentWorkspace, route.isMasterAdmin, route.workspaceSlug, store.name, updateStoreDetails]);

  const handleNavigate = (page: ActivePage) => {
    setActivePage(page);
    if (page === 'konsol') {
      pushRoute('/admin');
      setRoute({
        isMasterAdmin: true,
        workspaceSlug: null,
        systemPage: 'konsol',
        rawPath: '/admin',
      });
      return;
    }
    if (route.workspaceSlug) {
      pushRoute(`/${route.workspaceSlug}/${page}`);
    } else {
      pushRoute(`/${page}`);
    }
  };

  // 1. If path is /admin or Master Admin / Konsol Klien is requested
  if (route.isMasterAdmin || activePage === 'konsol') {
    return (
      <MasterAdminPage
        onExitAdmin={() => {
          setActivePage('pos');
          pushRoute('/');
          setRoute(parseRoute('/'));
        }}
        onSelectWorkspace={(slug) => {
          setActivePage('pos');
          pushRoute(`/${slug}/pos`);
          setRoute(parseRoute(`/${slug}/pos`));
        }}
      />
    );
  }

  // 2. Loading state while looking up workspace slug
  if (isResolvingWorkspace) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex items-center gap-3 text-stone-700 bg-white px-5 py-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Memuatkan ruang kerja <strong>{route.workspaceSlug}</strong>...</span>
        </div>
      </div>
    );
  }

  // 3. Workspace not found fallback (if a specific slug was requested but does not exist)
  if (route.workspaceSlug && !isResolvingWorkspace && !currentWorkspace) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mb-4 text-amber-700">
          <Building2 className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Workspace Tidak Ditemui</h1>
        <p className="text-sm text-stone-600 max-w-md mb-6 leading-relaxed">
          Laluan workspace <code className="bg-stone-200/80 px-2 py-0.5 rounded font-mono text-stone-800 text-xs font-semibold">/{route.workspaceSlug}</code> belum didaftarkan di sistem NiagaPOS V2.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              pushRoute('/admin');
              setRoute(parseRoute('/admin'));
            }}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 transition cursor-pointer shadow-xs"
          >
            Buka Konsol Pendaftaran Klien
          </button>
          <button
            type="button"
            onClick={() => {
              pushRoute('/');
              setRoute(parseRoute('/'));
            }}
            className="px-4 py-2 border border-stone-300 bg-white text-stone-700 rounded-lg text-sm font-semibold hover:bg-stone-100 transition cursor-pointer shadow-xs"
          >
            Kembali ke Laman Utama
          </button>
        </div>
      </div>
    );
  }

  // 4. Kitchen Display System (KDS) Dedicated Fullscreen Experience (SES v4.5)
  // Kitchen staff uses dedicated Kitchen PIN (Role KITCHEN) without needing Cashier/Owner credentials
  if (activePage === 'kds') {
    return (
      <KitchenDisplayView
        workspaceSlug={currentWorkspace?.workspaceSlug || route.workspaceSlug || 'default'}
        workspaceName={currentWorkspace?.workspaceName}
        onBackToPos={() => handleNavigate('pos')}
      />
    );
  }

  // 5. Client Workspace PIN Authentication Barrier
  // If workspace is active, user is NOT in Master Admin mode, and has no authenticated session:
  // Prompt for Client PIN
  if (currentWorkspace && !isAdminMode && !clientSession) {
    return (
      <ClientLoginScreen
        workspace={currentWorkspace}
        onAuthenticated={(session) => {
          setClientSession(session);
        }}
        onExit={() => {
          pushRoute('/');
          setRoute(parseRoute('/'));
          setCurrentWorkspace(null);
        }}
      />
    );
  }

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} currentWorkspace={currentWorkspace} />;
      case 'products':
        return <ProductsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'pos':
        return <PosPage />;
      case 'purchases':
        return <PurchasesPage onNavigate={handleNavigate} />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'customers':
        return <CustomersPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} currentWorkspace={currentWorkspace} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Workspace Trial Notification Bar */}
      {currentWorkspace && <WorkspaceTrialBanner workspace={currentWorkspace} />}

      {/* Default PIN Security Warning Banner */}
      {currentWorkspace && (clientSession?.isDefaultPin || clientSession?.mustChangeDefaultPin) && !isAdminMode && (
        <div className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-stone-950" />
            <span>
              Perhatian Keselamatan: Workspace <strong>{currentWorkspace.workspaceName}</strong> masih menggunakan <strong>PIN Keselamatan Lalai (1234)</strong>. Sila tukar PIN anda demi melindungi operasi perniagaan dan akaun jualan anda.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              type="button"
              id="banner-change-pin-btn"
              onClick={() => setIsChangePinModalOpen(true)}
              className="px-3 py-1 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-800 transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Tukar PIN Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Notification toast for PIN change / security notice */}
      {pinNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs z-20 animate-in fade-in">
          <span>{pinNotice}</span>
          <button
            type="button"
            onClick={() => setPinNotice(null)}
            className="text-white hover:opacity-80 ml-2 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <AppShell
        activePage={activePage}
        onNavigate={handleNavigate}
        currentWorkspace={currentWorkspace}
        onLogoutWorkspace={() => {
          if (currentWorkspace) {
            ClientAuthService.logout(currentWorkspace.workspaceSlug);
            setClientSession(null);
          }
        }}
        onChangePin={() => setIsChangePinModalOpen(true)}
      >
        {renderActivePage()}
      </AppShell>

      {/* Change Workspace PIN Modal */}
      {currentWorkspace && (
        <ChangePinModal
          isOpen={isChangePinModalOpen}
          workspaceSlug={currentWorkspace.workspaceSlug}
          onClose={() => setIsChangePinModalOpen(false)}
          onSuccess={(msg) => {
            setPinNotice(msg);
            setTimeout(() => setPinNotice(null), 5000);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MainAppContent />
    </StoreProvider>
  );
}
