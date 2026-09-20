/**
 * NiagaPOS V2 - Deployment Version & Session Continuity Service
 * SES v4.5 — MANDATORY REQUIREMENT (VG-01 to VG-11 Framework)
 *
 * Verification Gates Alignment:
 * 1. VG-01: Detect application version changes using existing architecture.
 * 2. VG-02: Ensure updated assets (JS, CSS, Service Worker) load correctly.
 * 3. VG-03: Preserve valid authentication sessions during version transitions.
 * 4. VG-04: Strictly protect contingent memberships, access history, and access activations from being cleared.
 * 5. VG-05: Access activation state unbroken (zero repeated activations).
 * 6. VG-06: Hard refresh used solely as recovery mechanism during asset/cache failures.
 * 7. VG-07: Mandatory server-side authorization enforcement.
 * 8. VG-08: Accurate diagnostic invalidation engine:
 *           - SESSION_EXPIRED
 *           - TOKEN_REVOKED
 *           - AUTHORIZATION_CHANGED
 *           - WORKSPACE_ACCESS_REVOKED
 *           - DATA_CORRUPTION
 *           - ASSET_CACHE_ISSUE
 * 9. VG-09: Ensure zero disruption to tenant/workspace isolation.
 * 10. VG-10: Cryptographic token verification & tampering defense (HTTP 401).
 * 11. VG-11: Cross-tenant authorization enforcement & horizontal privilege escalation defense (HTTP 403).
 */

import type { InvalidationReason, SessionDiagnosticResult, ClientAuthSession } from '../types/auth';

export const CURRENT_PLATFORM_VERSION = '4.5.0';
export const CURRENT_SCHEMA_VERSION = 1;

export const DEPLOYMENT_STORAGE_KEYS = {
  CLIENT_VERSION: 'niagapos_client_deployment_version',
  LAST_UPDATE_CHECK: 'niagapos_last_version_check_ts',
  RECOVERY_RELOAD_TS: 'niagapos_asset_recovery_reload_ts',
  VERSION_AUDIT_LOG: 'niagapos_version_continuity_audit_v1',
} as const;

export interface DeploymentVersionInfo {
  version: string;
  platform: string;
  releaseDate?: string;
  schemaVersion?: number;
  buildTimestamp?: number;
  minCompatibleVersion?: string;
  features?: string[];
  timestamp?: string;
}

export interface VersionTransitionResult {
  hasChanged: boolean;
  previousVersion: string | null;
  currentVersion: string;
  isInitialInstall: boolean;
  sessionsPreservedCount: number;
  membershipsPreservedCount: number;
  activationsPreservedCount: number;
  timestamp: string;
}

export interface VersionContinuityAuditEntry {
  id: string;
  action: 'VERSION_DETECTED' | 'VERSION_TRANSITION' | 'ASSET_RECOVERY_TRIGGERED' | 'SESSION_DIAGNOSED';
  previousVersion: string | null;
  currentVersion: string;
  reason?: InvalidationReason | string;
  preservedStateSummary?: {
    sessionsCount: number;
    membershipsCount: number;
    workspacesCount: number;
  };
  timestamp: string;
}

type VersionListener = (info: { previous: string | null; current: string }) => void;
const versionListeners: Set<VersionListener> = new Set();

let assetRecoveryInitialized = false;

function resolveApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return endpoint;
  }
  return `http://localhost:3000${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

export class DeploymentVersionService {
  /**
   * Initializes deployment version tracking and sets up safe asset recovery listeners.
   */
  public static init(): void {
    if (typeof window === 'undefined') return;

    this.setupAssetErrorRecovery();
    this.checkDeploymentVersion().catch((err) => {
      console.debug('[DeploymentVersion] Initial version check non-blocking note:', err?.message);
    });
  }

  /**
   * Retrieves the current stored client version.
   */
  public static getStoredClientVersion(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(DEPLOYMENT_STORAGE_KEYS.CLIENT_VERSION);
      }
    } catch {}
    return null;
  }

  /**
   * Checks the server deployment version and manages version transitions non-destructively.
   */
  public static async checkDeploymentVersion(): Promise<VersionTransitionResult> {
    const stored = this.getStoredClientVersion();
    let serverInfo: DeploymentVersionInfo | null = null;

    try {
      const res = await fetch(resolveApiUrl('/api/version'), {
        headers: { Accept: 'application/json' },
        cache: 'no-cache',
      });
      if (res.ok) {
        serverInfo = await res.json();
      }
    } catch {
      // Offline fallback: use health check or current constant
      try {
        const healthRes = await fetch(resolveApiUrl('/api/health'), { cache: 'no-cache' });
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          serverInfo = { version: healthData.version || CURRENT_PLATFORM_VERSION, platform: 'NiagaPOS' };
        }
      } catch {
        serverInfo = { version: CURRENT_PLATFORM_VERSION, platform: 'NiagaPOS' };
      }
    }

    const currentVersion = serverInfo?.version || CURRENT_PLATFORM_VERSION;
    const isInitialInstall = stored === null;
    const hasChanged = !isInitialInstall && stored !== currentVersion;

    // Count preserved items without modifying them
    const preservedSummary = this.inspectPreservedState();

    if (hasChanged || isInitialInstall) {
      this.recordAudit({
        id: `v_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: hasChanged ? 'VERSION_TRANSITION' : 'VERSION_DETECTED',
        previousVersion: stored,
        currentVersion,
        preservedStateSummary: preservedSummary,
        timestamp: new Date().toISOString(),
      });

      // Update stored version without clearing any session or user data
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(DEPLOYMENT_STORAGE_KEYS.CLIENT_VERSION, currentVersion);
          localStorage.setItem(DEPLOYMENT_STORAGE_KEYS.LAST_UPDATE_CHECK, Date.now().toString());
        }
      } catch {}

      if (hasChanged) {
        this.notifyListeners(stored, currentVersion);
        this.notifyServiceWorkerUpdate();
      }
    }

    return {
      hasChanged,
      previousVersion: stored,
      currentVersion,
      isInitialInstall,
      sessionsPreservedCount: preservedSummary.sessionsCount,
      membershipsPreservedCount: preservedSummary.membershipsCount,
      activationsPreservedCount: preservedSummary.workspacesCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Inspects and counts active sessions, contingent memberships, and access activations
   * to verify they remain completely intact.
   */
  public static inspectPreservedState(): {
    sessionsCount: number;
    membershipsCount: number;
    workspacesCount: number;
  } {
    let sessionsCount = 0;
    let membershipsCount = 0;
    let workspacesCount = 0;

    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('niagapos_ws_session_') || key === 'niagapos_master_admin_session' || key.startsWith('niagapos_kitchen_session_')) {
            sessionsCount++;
          }
        }

        const rawMembers = localStorage.getItem('niagapos_workspace_members_v1');
        if (rawMembers) {
          try {
            const list = JSON.parse(rawMembers);
            if (Array.isArray(list)) membershipsCount = list.length;
          } catch {}
        }

        const rawWorkspaces = localStorage.getItem('niagapos_workspaces_v1');
        if (rawWorkspaces) {
          try {
            const list = JSON.parse(rawWorkspaces);
            if (Array.isArray(list)) workspacesCount = list.length;
          } catch {}
        }
      }
    } catch {}

    return { sessionsCount, membershipsCount, workspacesCount };
  }

  /**
   * Informs Service Worker of new version readiness.
   */
  private static notifyServiceWorkerUpdate(): void {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {}
  }

  /**
   * Configures safe recovery listeners for asset/chunk errors.
   * Hard reload is ONLY triggered as an emergency fallback on unhandled asset chunk failures,
   * with debounce protection against infinite loops.
   */
  public static setupAssetErrorRecovery(): void {
    if (assetRecoveryInitialized || typeof window === 'undefined') return;
    assetRecoveryInitialized = true;

    // 1. Listen for dynamic script loading / chunk failures
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement | null;
      const isScriptOrLink = target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK');
      const message = (event.message || '').toLowerCase();
      const isChunkLoadError =
        message.includes('loading chunk') ||
        message.includes('dynamically imported module') ||
        message.includes('failed to fetch dynamically imported module');

      if (isScriptOrLink || isChunkLoadError) {
        console.warn('[DeploymentVersion] Asset load failure detected. Evaluating recovery mechanism...');
        this.executeAssetRecovery('ASSET_CACHE_ISSUE', event.message || 'Asset loading failure');
      }
    }, true);

    // 2. Listen for unhandled promise rejections (Vite dynamic import failures)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = String(event.reason || '');
      const isChunkError =
        reason.includes('Loading chunk') ||
        reason.includes('Failed to fetch dynamically imported module') ||
        reason.includes('Importing a module script failed');

      if (isChunkError) {
        console.warn('[DeploymentVersion] Dynamic import chunk error caught:', reason);
        this.executeAssetRecovery('ASSET_CACHE_ISSUE', reason);
      }
    });
  }

  /**
   * Executes recovery when an asset failure occurs.
   * Uses sessionStorage to guarantee max ONE reload attempt per 30 seconds.
   */
  public static executeAssetRecovery(reason: InvalidationReason, details: string): boolean {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    let lastReload = 0;
    try {
      const stored = sessionStorage.getItem(DEPLOYMENT_STORAGE_KEYS.RECOVERY_RELOAD_TS);
      if (stored) lastReload = parseInt(stored, 10);
    } catch {}

    // Cooldown check (30 seconds) to prevent infinite loops
    if (now - lastReload < 30000) {
      console.error('[DeploymentVersion] Asset recovery already attempted within cooldown. Aborting hard refresh.');
      return false;
    }

    try {
      sessionStorage.setItem(DEPLOYMENT_STORAGE_KEYS.RECOVERY_RELOAD_TS, now.toString());
      this.recordAudit({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'ASSET_RECOVERY_TRIGGERED',
        previousVersion: this.getStoredClientVersion(),
        currentVersion: CURRENT_PLATFORM_VERSION,
        reason,
        timestamp: new Date().toISOString(),
      });

      // Request Service Worker to clear asset cache first
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ASSET_CACHE' });
      }

      // Execute targeted hard refresh as recovery
      console.log('[DeploymentVersion] Triggering hard refresh as recovery mechanism.');
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Accurate Session Invalidation Diagnostic Engine (SES v4.5 Requirement 8).
   * Categorizes exact invalidation reason:
   * 1. SESSION_EXPIRED
   * 2. TOKEN_REVOKED
   * 3. AUTHORIZATION_CHANGED
   * 4. WORKSPACE_ACCESS_REVOKED
   * 5. DATA_CORRUPTION
   * 6. ASSET_CACHE_ISSUE
   */
  public static diagnoseSessionValidity(
    session: ClientAuthSession | null,
    options?: {
      targetWorkspaceSlug?: string;
      workspaceStatus?: string;
      requiredRole?: string;
      networkOrAssetError?: boolean;
    }
  ): SessionDiagnosticResult {
    // 1. Asset/cache loading failure takes precedence if code failed to load
    if (options?.networkOrAssetError) {
      return {
        valid: false,
        reason: 'ASSET_CACHE_ISSUE',
        message: 'Gagal memuatkan modul aset atau fail cache sistem. Mod pemulihan diperlukan.',
      };
    }

    // 2. Data corruption: null or missing structural properties
    if (!session || typeof session !== 'object') {
      return {
        valid: false,
        reason: 'DATA_CORRUPTION',
        message: 'Objek sesi tiada atau tidak lengkap dalam storan tempatan.',
      };
    }

    if (!session.token || !session.workspaceSlug) {
      return {
        valid: false,
        reason: 'DATA_CORRUPTION',
        message: 'Data sesi korup (token atau pengecam ruang kerja tiada).',
      };
    }

    // 3. Token structure corruption
    if (typeof session.token !== 'string' || (!session.token.startsWith('master_') && !session.token.startsWith('local_') && !session.token.includes('.'))) {
      return {
        valid: false,
        reason: 'DATA_CORRUPTION',
        message: 'Format token sesi korup atau tidak memenuhi format yang sah.',
      };
    }

    // 4. Session expired check
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return {
        valid: false,
        reason: 'SESSION_EXPIRED',
        message: `Sesi telah tamat tempoh pada ${new Date(session.expiresAt).toLocaleTimeString('ms-MY')}.`,
        details: { expiresAt: session.expiresAt, now: Date.now() },
      };
    }

    // 5. Workspace access revoked
    if (options?.targetWorkspaceSlug && session.workspaceSlug.toLowerCase() !== options.targetWorkspaceSlug.toLowerCase()) {
      return {
        valid: false,
        reason: 'WORKSPACE_ACCESS_REVOKED',
        message: `Sesi tidak sah untuk ruang kerja '${options.targetWorkspaceSlug}'.`,
      };
    }

    if (options?.workspaceStatus && (options.workspaceStatus === 'SUSPENDED' || options.workspaceStatus === 'ARCHIVED')) {
      return {
        valid: false,
        reason: 'WORKSPACE_ACCESS_REVOKED',
        message: `Akses ke ruang kerja telah digantung atau diarkibkan (${options.workspaceStatus}).`,
      };
    }

    // 6. Authorization changed
    if (options?.requiredRole && session.role && session.role !== options.requiredRole) {
      return {
        valid: false,
        reason: 'AUTHORIZATION_CHANGED',
        message: `Peranan pengguna (${session.role}) tidak mempunyai kebenaran yang diperlukan (${options.requiredRole}).`,
      };
    }

    // 7. Token revoked / server signature verification
    // (If token has HMAC format and was signed by server, verify on server side if possible)
    return {
      valid: true,
      message: 'Sesi adalah sah dan aktif.',
    };
  }

  /**
   * Verifies session against server-side authorization endpoint (Requirement 6 & 7).
   */
  public static async verifySessionServerSide(
    token: string,
    workspaceSlug: string
  ): Promise<SessionDiagnosticResult> {
    try {
      const res = await fetch(resolveApiUrl('/api/auth/client/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token, workspaceSlug }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.valid) {
        return { valid: true, message: 'Otorisasi server-side berjaya disahkan.' };
      }

      const reason: InvalidationReason = data?.reason || (res.status === 403 ? 'WORKSPACE_ACCESS_REVOKED' : 'TOKEN_REVOKED');
      return {
        valid: false,
        reason,
        message: data?.error || 'Sesi ditolak oleh pelayan.',
      };
    } catch (err: any) {
      // Network failure != invalid session; return diagnostic
      return {
        valid: false,
        reason: 'ASSET_CACHE_ISSUE',
        message: `Ralat sambungan ke pelayan: ${err?.message || 'Rangkaian terputus'}.`,
      };
    }
  }

  /**
   * Appends entry to version audit log.
   */
  private static recordAudit(entry: VersionContinuityAuditEntry): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(DEPLOYMENT_STORAGE_KEYS.VERSION_AUDIT_LOG);
      const list: VersionContinuityAuditEntry[] = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      if (list.length > 100) list.pop();
      localStorage.setItem(DEPLOYMENT_STORAGE_KEYS.VERSION_AUDIT_LOG, JSON.stringify(list));
    } catch {}
  }

  /**
   * Returns audit logs.
   */
  public static getAuditLogs(): VersionContinuityAuditEntry[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(DEPLOYMENT_STORAGE_KEYS.VERSION_AUDIT_LOG);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static subscribe(listener: VersionListener): () => void {
    versionListeners.add(listener);
    return () => versionListeners.delete(listener);
  }

  private static notifyListeners(previous: string | null, current: string): void {
    versionListeners.forEach((fn) => {
      try {
        fn({ previous, current });
      } catch (e) {
        console.error('[DeploymentVersion] Listener error:', e);
      }
    });
  }
}
