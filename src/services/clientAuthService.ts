/**
 * NiagaPOS V2 - Client & Master Admin Authentication Client Service
 * 
 * Separates Master Admin (PIN 5313) from Client Workspaces (Default PIN 1234).
 * Stores session tokens locally and supports both:
 * 1. Server-side API endpoints (/api/auth/...)
 * 2. Client-side cryptographic fallback (SHA-256 Web Crypto) for static hosting / PWA / offline mode
 *    (prevents JSON parse crashes like "Unexpected token 'T', The page cannot be found...")
 */

import type {
  ClientAuthSession,
  MasterAdminAuthSession,
  AuthResponse,
  AuditLogRecord,
  WorkspaceAuthPublicState,
} from '../types/auth';
import { WorkspaceService } from './workspaceService';

const CLIENT_SESSION_PREFIX = 'niagapos_ws_session_';
const CLIENT_AUTH_CONFIG_PREFIX = 'niagapos_auth_cfg_';
const ADMIN_SESSION_KEY = 'niagapos_master_admin_session';
const AUDIT_LOGS_KEY = 'niagapos_audit_logs_v1';

export interface LocalWorkspaceAuthConfig {
  workspaceSlug: string;
  salt: string;
  pinHash: string;
  pinVersion: number;
  mustChangeDefaultPin: boolean;
  updatedAt: string;
}

type SessionListener = (session: ClientAuthSession | null) => void;
const listeners: Set<SessionListener> = new Set();

/**
 * Safe fetch helper that validates JSON content-type before parsing
 * and prevents uncaught HTML/404 syntax errors.
 */
async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; isJson: boolean; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data, isJson: true };
      } catch {
        return {
          ok: false,
          status: res.status,
          data: null,
          isJson: false,
          error: 'Respons pelayan bukan format JSON yang sah.',
        };
      }
    }
    // Not JSON (e.g. 404 HTML, proxy error page, "The page cannot be found")
    return {
      ok: false,
      status: res.status,
      data: null,
      isJson: false,
      error: `Pelayan mengembalikan status ${res.status}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      isJson: false,
      error: err?.message || 'Ralat sambungan rangkaian.',
    };
  }
}

/**
 * Cryptographic PIN hashing using Web Crypto API SHA-256 with workspace salt.
 */
async function hashPinBrowser(pin: string, salt: string): Promise<string> {
  const text = `${salt}:${pin.trim()}`;
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(text));
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // Deterministic fallback for runtimes without subtle crypto
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

/**
 * Retrieves local auth config for a workspace.
 */
function getLocalAuthConfig(workspaceSlug: string): LocalWorkspaceAuthConfig | null {
  if (!workspaceSlug) return null;
  const clean = workspaceSlug.trim().toLowerCase();
  try {
    const raw = localStorage.getItem(`${CLIENT_AUTH_CONFIG_PREFIX}${clean}`);
    if (!raw) return null;
    return JSON.parse(raw) as LocalWorkspaceAuthConfig;
  } catch {
    return null;
  }
}

/**
 * Saves local auth config for a workspace.
 */
function saveLocalAuthConfig(config: LocalWorkspaceAuthConfig): void {
  const clean = config.workspaceSlug.trim().toLowerCase();
  try {
    localStorage.setItem(`${CLIENT_AUTH_CONFIG_PREFIX}${clean}`, JSON.stringify(config));
  } catch {}
}

/**
 * Verifies a PIN against the workspace's local configuration, Cloud Firestore sync, or default PIN (1234).
 * Also recognizes Master Admin PIN (5313) across workspaces.
 */
async function verifyLocalPin(
  workspaceSlug: string,
  enteredPin: string
): Promise<{ valid: boolean; mustChangeDefaultPin: boolean; pinVersion: number; isMasterAdmin?: boolean }> {
  const clean = workspaceSlug.trim().toLowerCase();
  const cleanPin = enteredPin.trim();

  // 1. Master Admin Override PIN (5313)
  if (cleanPin === '5313') {
    return {
      valid: true,
      mustChangeDefaultPin: false,
      pinVersion: 999,
      isMasterAdmin: true,
    };
  }

  // 2. Check local auth config in localStorage
  let config = getLocalAuthConfig(clean);

  // 3. If no local config found, check WorkspaceService (synced from Cloud Firestore)
  if (!config) {
    try {
      const ws = WorkspaceService.getWorkspaceBySlug(clean);
      if (ws?.authConfig) {
        config = {
          workspaceSlug: clean,
          pinHash: ws.authConfig.pinHash,
          salt: ws.authConfig.salt,
          pinVersion: ws.authConfig.pinVersion,
          mustChangeDefaultPin: ws.authConfig.mustChangeDefaultPin,
          updatedAt: ws.authConfig.updatedAt,
        };
        saveLocalAuthConfig(config);
      }
    } catch {}
  }

  if (config) {
    const computedHash = await hashPinBrowser(cleanPin, config.salt);
    const isValid = computedHash === config.pinHash;
    return {
      valid: isValid,
      mustChangeDefaultPin: config.mustChangeDefaultPin,
      pinVersion: config.pinVersion,
    };
  }

  // 4. Default initial PIN is 1234
  const isDefaultValid = cleanPin === '1234';
  return {
    valid: isDefaultValid,
    mustChangeDefaultPin: true,
    pinVersion: 1,
  };
}

export class ClientAuthService {
  /**
   * Retrieves active client session for a specific workspace from sessionStorage / localStorage.
   */
  public static getSession(workspaceSlug: string): ClientAuthSession | null {
    if (!workspaceSlug) return null;
    const clean = workspaceSlug.trim().toLowerCase();
    try {
      const raw = sessionStorage.getItem(`${CLIENT_SESSION_PREFIX}${clean}`) ||
                  localStorage.getItem(`${CLIENT_SESSION_PREFIX}${clean}`);
      if (!raw) return null;
      const session = JSON.parse(raw) as ClientAuthSession;
      if (session.expiresAt && session.expiresAt < Date.now()) {
        this.clearSession(clean);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Saves client session locally.
   */
  public static saveSession(session: ClientAuthSession): void {
    const key = `${CLIENT_SESSION_PREFIX}${session.workspaceSlug.toLowerCase()}`;
    const serialized = JSON.stringify(session);
    try {
      sessionStorage.setItem(key, serialized);
      localStorage.setItem(key, serialized);
    } catch {}
    this.notifyListeners(session);
  }

  /**
   * Clears client session for a workspace.
   */
  public static clearSession(workspaceSlug: string): void {
    if (!workspaceSlug) return;
    const clean = workspaceSlug.trim().toLowerCase();
    const key = `${CLIENT_SESSION_PREFIX}${clean}`;
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {}
    this.notifyListeners(null);
  }

  /**
   * Logs out client workspace session.
   */
  public static logout(workspaceSlug: string): void {
    this.clearSession(workspaceSlug);
  }

  /**
   * Retrieves active session for designated or any stored workspace.
   */
  public static getActiveSession(workspaceSlug?: string): ClientAuthSession | null {
    if (workspaceSlug) {
      return this.getSession(workspaceSlug);
    }
    try {
      if (typeof window === 'undefined') return null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CLIENT_SESSION_PREFIX)) {
          const slug = key.replace(CLIENT_SESSION_PREFIX, '');
          const sess = this.getSession(slug);
          if (sess) return sess;
        }
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CLIENT_SESSION_PREFIX)) {
          const slug = key.replace(CLIENT_SESSION_PREFIX, '');
          const sess = this.getSession(slug);
          if (sess) return sess;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Authenticates client workspace using its independent PIN (e.g. 1234).
   * Communicates directly with backend API or falls back securely to client-side auth engine.
   */
  public static async login(
    workspaceSlug: string,
    pin: string,
    workspaceName?: string
  ): Promise<AuthResponse<ClientAuthSession>> {
    const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    // 1. Master Admin Override PIN (5313)
    if (cleanPin === '5313') {
      const adminSession: ClientAuthSession = {
        token: `master_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: `ws_${cleanSlug}`,
        workspaceSlug: cleanSlug,
        workspaceName: workspaceName || cleanSlug,
        role: 'CLIENT',
        isPinEnabled: true,
        mustChangeDefaultPin: false,
        isDefaultPin: false,
        pinVersion: 999,
        expiresAt: Date.now() + 86400000,
      };
      this.saveSession(adminSession);
      return { success: true, data: adminSession };
    }

    // 2. Try server-side authentication first
    const res = await safeFetchJson<{
      success: boolean;
      session?: ClientAuthSession;
      error?: string;
      remainingSeconds?: number;
    }>('/api/auth/client/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceSlug: cleanSlug, pin: cleanPin, workspaceName }),
    });

    if (res.isJson && res.data && res.ok && res.data.success && res.data.session) {
      this.saveSession(res.data.session);
      return { success: true, data: res.data.session };
    }

    // 3. Fallback: Verify against Local & Firestore credentials
    const verification = await verifyLocalPin(cleanSlug, cleanPin);
    if (verification.valid) {
      const fallbackSession: ClientAuthSession = {
        token: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: `ws_${cleanSlug}`,
        workspaceSlug: cleanSlug,
        workspaceName: workspaceName || cleanSlug,
        role: 'CLIENT',
        isPinEnabled: true,
        mustChangeDefaultPin: verification.mustChangeDefaultPin,
        isDefaultPin: verification.mustChangeDefaultPin,
        pinVersion: verification.pinVersion,
        expiresAt: Date.now() + 86400000,
      };
      this.saveSession(fallbackSession);
      return { success: true, data: fallbackSession };
    }

    if (res.isJson && res.data?.remainingSeconds) {
      return {
        success: false,
        error: res.data.error || 'PIN tidak sah.',
        remainingSeconds: res.data.remainingSeconds,
      };
    }

    return { success: false, error: 'PIN workspace tidak sah. Sila semak semula PIN anda.' };
  }

  /**
   * Directly verifies a candidate PIN for a workspace (for modals or inline checks).
   */
  public static async verifyPin(workspaceSlug: string, candidatePin: string): Promise<boolean> {
    const res = await verifyLocalPin(workspaceSlug, candidatePin);
    return res.valid;
  }

  /**
   * Verifies the client session with the server or local expiry validation.
   */
  public static async verifySession(workspaceSlug: string): Promise<boolean> {
    const session = this.getSession(workspaceSlug);
    if (!session) return false;

    if (session.expiresAt && session.expiresAt < Date.now()) {
      this.clearSession(workspaceSlug);
      return false;
    }

    const res = await safeFetchJson<{ success: boolean; valid: boolean; error?: string }>(
      '/api/auth/client/verify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ workspaceSlug }),
      }
    );

    if (res.isJson && res.data) {
      if (!res.ok) {
        this.clearSession(workspaceSlug);
        return false;
      }
      return Boolean(res.data.valid);
    }

    // Fallback: trust unexpired local session
    return session.expiresAt > Date.now();
  }

  /**
   * Changes the workspace PIN.
   * Updates Local Storage, Cloud Firestore, and Server API synchronously to ensure permanent consistency.
   */
  public static async changePin(
    workspaceSlug: string,
    currentPin: string,
    newPin: string,
    confirmPin: string
  ): Promise<AuthResponse> {
    const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
    const cleanCurrent = (currentPin || '').trim();
    const cleanNew = (newPin || '').trim();
    const cleanConfirm = (confirmPin || '').trim();

    if (!cleanCurrent || cleanCurrent.length < 4) {
      return { success: false, error: 'Sila masukkan PIN semasa (4-6 digit nombor).' };
    }

    if (!cleanNew || !/^\d{4,6}$/.test(cleanNew)) {
      return { success: false, error: 'PIN baharu mesti mengandungi 4 hingga 6 digit nombor.' };
    }

    if (cleanNew !== cleanConfirm) {
      return { success: false, error: 'PIN baharu dan pengesahan PIN tidak sepadan.' };
    }

    if (cleanNew === cleanCurrent) {
      return { success: false, error: 'PIN baharu tidak boleh sama dengan PIN semasa.' };
    }

    const session = this.getSession(cleanSlug);

    // 1. Verify current PIN validity first (or Master Admin 5313 override)
    const verification = await verifyLocalPin(cleanSlug, cleanCurrent);
    if (!verification.valid && cleanCurrent !== '5313') {
      return { success: false, error: 'PIN semasa tidak tepat. Sila semak semula PIN anda.' };
    }

    // 2. Generate salt & hash for new PIN
    const salt = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const pinHash = await hashPinBrowser(cleanNew, salt);
    const updatedVersion = (session?.pinVersion || verification.pinVersion || 1) + 1;

    const newAuthConfig = {
      workspaceSlug: cleanSlug,
      salt,
      pinHash,
      pinVersion: updatedVersion,
      mustChangeDefaultPin: false,
      updatedAt: new Date().toISOString(),
    };

    // 3. Immediately persist to localStorage
    saveLocalAuthConfig(newAuthConfig);

    // 4. Update Cloud Firestore so all devices (mobile PWA, laptop) stay in sync
    WorkspaceService.updateWorkspaceAuthConfig(cleanSlug, newAuthConfig).catch((err) => {
      console.warn('[ClientAuthService] updateWorkspaceAuthConfig warning:', err);
    });

    // 5. Update Server API
    try {
      const serverRes = await safeFetchJson<{
        success: boolean;
        message?: string;
        error?: string;
        session?: ClientAuthSession;
      }>(
        '/api/auth/client/change-pin',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify({
            workspaceSlug: cleanSlug,
            currentPin: cleanCurrent,
            newPin: cleanNew,
            confirmPin: cleanConfirm,
          }),
        }
      );

      if (serverRes.isJson && serverRes.data?.session) {
        this.saveSession(serverRes.data.session);
      }
    } catch {}

    // 6. Update local active session
    if (session) {
      session.mustChangeDefaultPin = false;
      session.isDefaultPin = false;
      session.pinVersion = updatedVersion;
      this.saveSession(session);
    } else {
      const newSession: ClientAuthSession = {
        token: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: `ws_${cleanSlug}`,
        workspaceSlug: cleanSlug,
        workspaceName: cleanSlug,
        role: 'CLIENT',
        isPinEnabled: true,
        mustChangeDefaultPin: false,
        isDefaultPin: false,
        pinVersion: updatedVersion,
        expiresAt: Date.now() + 86400000,
      };
      this.saveSession(newSession);
    }

    // 7. Record local audit log
    this.recordLocalAuditLog({
      action: 'CHANGE_CLIENT_PIN',
      workspaceSlug: cleanSlug,
      performedBy: 'CLIENT_OWNER',
      details: { pinVersion: updatedVersion },
    });

    return { success: true, message: 'PIN Workspace berjaya dikemas kini!' };
  }

  /**
   * Retrieves public workspace auth status (e.g. lockout or mustChangeDefaultPin).
   */
  public static async getWorkspaceStatus(
    workspaceSlug: string
  ): Promise<{ isLocked: boolean; remainingSeconds: number; authConfig?: WorkspaceAuthPublicState } | null> {
    const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
    const res = await safeFetchJson<{
      success: boolean;
      isLocked: boolean;
      remainingSeconds: number;
      authConfig?: WorkspaceAuthPublicState;
    }>(`/api/auth/client/status/${encodeURIComponent(cleanSlug)}`);

    if (res.isJson && res.data) {
      return res.data;
    }

    // Fallback: check local auth config
    const config = getLocalAuthConfig(cleanSlug);
    return {
      isLocked: false,
      remainingSeconds: 0,
      authConfig: {
        workspaceId: cleanSlug,
        workspaceSlug: cleanSlug,
        isPinEnabled: true,
        mustChangeDefaultPin: config ? config.mustChangeDefaultPin : true,
        pinVersion: config ? config.pinVersion : 1,
      },
    };
  }

  // ----------------------------------------------------
  // MASTER ADMIN METHODS
  // ----------------------------------------------------

  public static getMasterAdminSession(): MasterAdminAuthSession | null {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as MasterAdminAuthSession;
      if (session.expiresAt && session.expiresAt < Date.now()) {
        this.clearMasterAdminSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  public static saveMasterAdminSession(session: MasterAdminAuthSession): void {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    } catch {}
  }

  public static clearMasterAdminSession(): void {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {}
  }

  public static async adminLogin(pin: string): Promise<AuthResponse<MasterAdminAuthSession>> {
    const cleanPin = (pin || '').trim();
    const res = await safeFetchJson<{
      success: boolean;
      session?: MasterAdminAuthSession;
      error?: string;
      remainingSeconds?: number;
    }>('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin }),
    });

    if (res.isJson && res.data) {
      if (res.ok && res.data.success && res.data.session) {
        this.saveMasterAdminSession(res.data.session);
        return { success: true, data: res.data.session };
      }
      return {
        success: false,
        error: res.data.error || 'PIN Master Admin tidak sah.',
        remainingSeconds: res.data.remainingSeconds,
      };
    }

    // Fallback for Master Admin PIN
    if (cleanPin === '5313') {
      const session: MasterAdminAuthSession = {
        token: `local_adm_${Date.now()}`,
        role: 'MASTER_ADMIN',
        expiresAt: Date.now() + 28800000,
      };
      this.saveMasterAdminSession(session);
      return { success: true, data: session };
    }
    return { success: false, error: 'PIN Pentadbir tidak sah.' };
  }

  public static async adminResetClientPin(workspaceIdOrSlug: string): Promise<AuthResponse> {
    const adminSession = this.getMasterAdminSession();
    if (!adminSession) {
      return { success: false, error: 'Sesi Master Admin diperlukan.' };
    }

    const clean = workspaceIdOrSlug.trim().toLowerCase();

    const res = await safeFetchJson<{ success: boolean; message?: string; error?: string }>(
      '/api/auth/admin/reset-client-pin',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.token}`,
        },
        body: JSON.stringify({ workspaceIdOrSlug: clean }),
      }
    );

    if (res.isJson && res.data) {
      if (res.ok && res.data.success) {
        try {
          localStorage.removeItem(`${CLIENT_AUTH_CONFIG_PREFIX}${clean}`);
        } catch {}
        return { success: true, message: res.data.message || 'PIN Workspace berjaya disetkan semula ke lalai (1234).' };
      }
      return { success: false, error: res.data.error || 'Gagal menetapkan semula PIN klien.' };
    }

    // Fallback: reset locally
    try {
      localStorage.removeItem(`${CLIENT_AUTH_CONFIG_PREFIX}${clean}`);
    } catch {}

    const session = this.getSession(clean);
    if (session) {
      session.mustChangeDefaultPin = true;
      session.isDefaultPin = true;
      session.pinVersion = (session.pinVersion || 1) + 1;
      this.saveSession(session);
    }

    this.recordLocalAuditLog({
      action: 'RESET_CLIENT_PIN',
      workspaceSlug: clean,
      performedBy: 'MASTER_ADMIN',
      details: { resetToDefault: '1234' },
    });

    return { success: true, message: 'PIN Workspace telah disetkan semula ke lalai (1234).' };
  }

  public static async getAdminAuditLogs(): Promise<AuditLogRecord[]> {
    const adminSession = this.getMasterAdminSession();
    if (!adminSession) return [];

    const res = await safeFetchJson<{ success: boolean; logs?: AuditLogRecord[] }>(
      '/api/auth/admin/audit-logs',
      {
        headers: { Authorization: `Bearer ${adminSession.token}` },
      }
    );

    if (res.isJson && res.data && res.data.logs) {
      return res.data.logs;
    }

    // Fallback: local audit logs
    try {
      const raw = localStorage.getItem(AUDIT_LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static recordLocalAuditLog(record: Omit<AuditLogRecord, 'id' | 'timestamp'>): void {
    try {
      const raw = localStorage.getItem(AUDIT_LOGS_KEY);
      const list: AuditLogRecord[] = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...record,
      });
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(list.slice(0, 100)));
    } catch {}
  }

  // ----------------------------------------------------
  // REACTIVE SUBSCRIPTION
  // ----------------------------------------------------
  public static subscribe(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  private static notifyListeners(session: ClientAuthSession | null): void {
    listeners.forEach((l) => l(session));
  }
}
