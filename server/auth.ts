/**
 * NiagaPOS V2 - Server-Side Authentication & Cryptographic PIN Manager
 * 
 * Strict Multi-Tenant Authentication:
 * - Master Admin PIN: 5313 (Never exposed to client UI or shared with clients)
 * - Default Client PIN: 1234 (Per-workspace independent auth)
 * - Secure PBKDF2 with salt & timing-safe verification
 * - Rate limiting & brute force lockout protection (5 attempts -> 30s lockout)
 * - HMAC-SHA256 signed session tokens
 * - Audit logging for PIN resets and security events
 */

import crypto from 'crypto';
import type {
  WorkspaceAuthConfig,
  WorkspaceAuthPublicState,
  ClientAuthSession,
  KitchenAuthSession,
  MasterAdminAuthSession,
  AuditLogRecord,
  InvalidationReason,
} from '../src/types/auth';

// Server-only Master Admin Secret PIN (Defaults to 5313)
const MASTER_ADMIN_PIN = process.env.MASTER_ADMIN_PIN || '5313';

// HMAC signing secret for session tokens
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Rate limiting & lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

// In-memory rate limiting map
const lockoutMap = new Map<string, LockoutState>();

// Workspace Auth Config Store
const authConfigStore = new Map<string, WorkspaceAuthConfig>();

// Audit Log Store
const auditLogs: AuditLogRecord[] = [];

/**
 * Derives a PBKDF2 hash for a numeric PIN with salt.
 */
export function hashPin(pin: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
  return `pbkdf2:10000:${salt}:${derived}`;
}

/**
 * Validates a plaintext PIN against a stored PBKDF2 hash using timingSafeEqual.
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  try {
    const parts = storedHash.split(':');
    if (parts.length === 4 && parts[0] === 'pbkdf2') {
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHex = parts[3];
      const derived = crypto.pbkdf2Sync(pin, salt, iterations, 32, 'sha256').toString('hex');
      const bufA = Buffer.from(derived, 'hex');
      const bufB = Buffer.from(expectedHex, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    }
    return false;
  } catch (err) {
    console.error('[ServerAuth] verifyPinHash error:', err);
    return false;
  }
}

/**
 * Checks lockout state for an identifier (workspaceSlug or 'master_admin').
 */
export function checkLockout(identifier: string): { locked: boolean; remainingSeconds: number } {
  const state = lockoutMap.get(identifier);
  if (!state || !state.lockoutUntil) {
    return { locked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < state.lockoutUntil) {
    const remaining = Math.ceil((state.lockoutUntil - now) / 1000);
    return { locked: true, remainingSeconds: remaining };
  }

  // Cooldown elapsed, reset
  lockoutMap.delete(identifier);
  return { locked: false, remainingSeconds: 0 };
}

/**
 * Registers a failed login attempt for an identifier.
 */
export function recordFailedAttempt(identifier: string): { locked: boolean; remainingSeconds: number } {
  const now = Date.now();
  let state = lockoutMap.get(identifier);
  if (!state) {
    state = { failedAttempts: 0, lockoutUntil: null };
    lockoutMap.set(identifier, state);
  }

  state.failedAttempts += 1;
  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.lockoutUntil = now + LOCKOUT_DURATION_MS;
    const remaining = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    recordAuditLog({
      action: 'FAILED_LOGIN_LOCKOUT',
      workspaceSlug: identifier !== 'master_admin' ? identifier : undefined,
      performedBy: identifier === 'master_admin' ? 'MASTER_ADMIN' : 'CLIENT_OWNER',
      details: { attempts: state.failedAttempts, lockoutDurationSeconds: remaining },
    });
    return { locked: true, remainingSeconds: remaining };
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Clears failed attempt counters upon successful login.
 */
export function clearLockout(identifier: string): void {
  lockoutMap.delete(identifier);
}

/**
 * Signs a session payload into a tamper-proof bearer token.
 */
export function generateToken(payload: Record<string, any>): string {
  const data = JSON.stringify(payload);
  const dataBase64 = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(dataBase64).digest('base64url');
  return `${dataBase64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifyToken<T = Record<string, any>>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataBase64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(dataBase64).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const json = Buffer.from(dataBase64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed.exp && parsed.exp < Date.now()) {
      return null; // Expired
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export interface TokenDiagnosticResult<T = Record<string, any>> {
  valid: boolean;
  payload: T | null;
  reason?: InvalidationReason;
  error?: string;
}

/**
 * Verifies session token with precise invalidation cause diagnostics (SES v4.5)
 * Distinguishes: SESSION_EXPIRED, TOKEN_REVOKED, AUTHORIZATION_CHANGED,
 * WORKSPACE_ACCESS_REVOKED, DATA_CORRUPTION, ASSET_CACHE_ISSUE
 */
export function verifyTokenWithDiagnostic<T = Record<string, any>>(
  token: string,
  options?: { expectedRole?: string; expectedWorkspaceSlug?: string }
): TokenDiagnosticResult<T> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      payload: null,
      reason: 'DATA_CORRUPTION',
      error: 'Token sesi tiada atau bukan rentetan teks yang sah.',
    };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return {
      valid: false,
      payload: null,
      reason: 'DATA_CORRUPTION',
      error: 'Format token korup atau rosak (pembahagi format hilang).',
    };
  }

  const [dataBase64, signature] = parts;
  let parsed: any = null;
  try {
    const json = Buffer.from(dataBase64, 'base64url').toString('utf-8');
    parsed = JSON.parse(json);
  } catch {
    return {
      valid: false,
      payload: null,
      reason: 'DATA_CORRUPTION',
      error: 'Kandungan muatan token tidak dapat dinyahsulit (JSON korup).',
    };
  }

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(dataBase64).digest('base64url');
  if (signature !== expectedSig) {
    return {
      valid: false,
      payload: null,
      reason: 'TOKEN_REVOKED',
      error: 'Tandatangan token tidak sah atau telah dibatalkan oleh pelayan (Token Revoked).',
    };
  }

  if (parsed.exp && parsed.exp < Date.now()) {
    return {
      valid: false,
      payload: parsed as T,
      reason: 'SESSION_EXPIRED',
      error: `Sesi telah tamat tempoh pada ${new Date(parsed.exp).toISOString()} (Session Expired).`,
    };
  }

  if (options?.expectedRole && parsed.role && parsed.role !== options.expectedRole) {
    return {
      valid: false,
      payload: parsed as T,
      reason: 'AUTHORIZATION_CHANGED',
      error: `Peranan sesi (${parsed.role}) tidak sepadan dengan kebenaran yang diperlukan (${options.expectedRole}).`,
    };
  }

  if (
    options?.expectedWorkspaceSlug &&
    parsed.workspaceSlug &&
    parsed.workspaceSlug.toLowerCase() !== options.expectedWorkspaceSlug.toLowerCase()
  ) {
    return {
      valid: false,
      payload: parsed as T,
      reason: 'WORKSPACE_ACCESS_REVOKED',
      error: 'Pencerobohan dikesan: Sesi ini tidak dibenarkan mengakses ruang kerja yang diminta.',
    };
  }

  return {
    valid: true,
    payload: parsed as T,
  };
}

/**
 * Records an entry into the administrative audit log.
 */
export function recordAuditLog(entry: Omit<AuditLogRecord, 'id' | 'timestamp'>): AuditLogRecord {
  const log: AuditLogRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 500) {
    auditLogs.pop();
  }
  return log;
}

export function getAuditLogs(): AuditLogRecord[] {
  return [...auditLogs];
}

/**
 * Initializes or ensures default authentication config for a workspace.
 * Default PIN: 1234
 */
export function initWorkspaceAuth(
  workspaceId: string,
  workspaceSlug: string,
  customPin?: string
): WorkspaceAuthConfig {
  const existing = authConfigStore.get(workspaceSlug.toLowerCase()) || authConfigStore.get(workspaceId);
  if (existing) {
    return existing;
  }

  const initialPin = customPin || '1234';
  const config: WorkspaceAuthConfig = {
    workspaceId,
    workspaceSlug: workspaceSlug.toLowerCase(),
    pinHash: hashPin(initialPin),
    pinVersion: 1,
    isPinEnabled: true,
    mustChangeDefaultPin: initialPin === '1234',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM_INITIALIZATION',
  };

  authConfigStore.set(workspaceSlug.toLowerCase(), config);
  authConfigStore.set(workspaceId, config);

  recordAuditLog({
    action: 'INIT_CLIENT_PIN',
    workspaceId,
    workspaceSlug: workspaceSlug.toLowerCase(),
    performedBy: 'SYSTEM',
    details: { isDefaultPin: initialPin === '1234', pinVersion: 1 },
  });

  return config;
}

export function getWorkspaceAuth(identifier: string): WorkspaceAuthConfig | undefined {
  return authConfigStore.get(identifier.toLowerCase());
}

export function getPublicAuthState(identifier: string): WorkspaceAuthPublicState | null {
  const cfg = getWorkspaceAuth(identifier);
  if (!cfg) return null;
  return {
    workspaceId: cfg.workspaceId,
    workspaceSlug: cfg.workspaceSlug,
    isPinEnabled: cfg.isPinEnabled,
    mustChangeDefaultPin: cfg.mustChangeDefaultPin,
    pinVersion: cfg.pinVersion,
  };
}

/**
 * Authenticates a client workspace via PIN.
 */
export function authenticateClient(
  workspaceSlug: string,
  pin: string,
  workspaceName?: string
): { success: boolean; session?: ClientAuthSession; error?: string; remainingSeconds?: number } {
  const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();

  // 1. Check lockout
  const lockout = checkLockout(cleanSlug);
  if (lockout.locked) {
    return {
      success: false,
      error: `Akaun disekat sementara kerana 5 kali percubaan salah. Sila tunggu ${lockout.remainingSeconds} saat.`,
      remainingSeconds: lockout.remainingSeconds,
    };
  }

  // 2. Validate PIN format
  if (!cleanPin || cleanPin.length < 4 || !/^\d{4,6}$/.test(cleanPin)) {
    return {
      success: false,
      error: 'Format PIN tidak sah. Sila masukkan 4 hingga 6 digit nombor.',
    };
  }

  // 3. Retrieve or auto-init workspace auth config
  let authConfig = getWorkspaceAuth(cleanSlug);
  if (!authConfig) {
    authConfig = initWorkspaceAuth(`ws_${cleanSlug}`, cleanSlug, '1234');
  }

  // 4. Verify PIN hash (workspace PIN or Master Admin 5313 override)
  const isMasterOverride = cleanPin === '5313';
  const isValid = isMasterOverride || verifyPinHash(cleanPin, authConfig.pinHash);

  if (!isValid) {
    const failState = recordFailedAttempt(cleanSlug);
    if (failState.locked) {
      return {
        success: false,
        error: `Terlalu banyak percubaan salah (5/5). Akses disekat selama 30 saat.`,
        remainingSeconds: failState.remainingSeconds,
      };
    }
    return {
      success: false,
      error: 'PIN keselamatan tidak sah. Sila cuba lagi.',
    };
  }

  // 5. Success: clear lockout
  clearLockout(cleanSlug);

  // 6. Generate Session Token (24 hours expiry)
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const token = generateToken({
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    role: 'CLIENT',
    pinVersion: authConfig.pinVersion,
    isMasterOverride,
    exp: expiresAt,
  });

  const session: ClientAuthSession = {
    token,
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    workspaceName: workspaceName || authConfig.workspaceSlug,
    role: 'CLIENT',
    isPinEnabled: authConfig.isPinEnabled,
    mustChangeDefaultPin: isMasterOverride ? false : authConfig.mustChangeDefaultPin,
    pinVersion: authConfig.pinVersion,
    expiresAt,
  };

  return { success: true, session };
}

/**
 * Changes a client workspace PIN.
 */
export function changeClientPin(
  workspaceSlug: string,
  currentPin: string,
  newPin: string,
  confirmPin: string
): { success: boolean; error?: string; message?: string; authConfig?: WorkspaceAuthConfig } {
  const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
  let authConfig = getWorkspaceAuth(cleanSlug);

  if (!authConfig) {
    authConfig = initWorkspaceAuth(`ws_${cleanSlug}`, cleanSlug, '1234');
  }

  // Verify current PIN (or Master Admin 5313 override)
  const isMaster = currentPin.trim() === '5313';
  if (!isMaster && !verifyPinHash(currentPin.trim(), authConfig.pinHash)) {
    return { success: false, error: 'PIN semasa tidak tepat.' };
  }

  // Validate new PIN
  const cleanNew = newPin.trim();
  const cleanConfirm = confirmPin.trim();

  if (cleanNew !== cleanConfirm) {
    return { success: false, error: 'PIN baharu dan pengesahan PIN tidak sepadan.' };
  }

  if (!/^\d{4,6}$/.test(cleanNew)) {
    return { success: false, error: 'PIN baharu mesti mengandungi 4 hingga 6 digit nombor sahaja.' };
  }

  if (!isMaster && cleanNew === currentPin.trim()) {
    return { success: false, error: 'PIN baharu tidak boleh sama dengan PIN semasa.' };
  }

  // Update hash with fresh salt
  const newHash = hashPin(cleanNew);
  authConfig.pinHash = newHash;
  authConfig.pinVersion += 1;
  authConfig.mustChangeDefaultPin = false;
  authConfig.updatedAt = new Date().toISOString();
  authConfig.updatedBy = isMaster ? 'MASTER_ADMIN_OVERRIDE' : 'CLIENT_OWNER';

  authConfigStore.set(authConfig.workspaceSlug, authConfig);
  authConfigStore.set(authConfig.workspaceId, authConfig);

  recordAuditLog({
    action: 'CHANGE_CLIENT_PIN',
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    performedBy: isMaster ? 'MASTER_ADMIN' : 'CLIENT_OWNER',
    details: { pinVersion: authConfig.pinVersion },
  });

  return { success: true, message: 'PIN Workspace berjaya dikemas kini.', authConfig };
}

/**
 * Authenticates Master Admin exclusively using Master Admin PIN 5313.
 */
export function authenticateMasterAdmin(
  pin: string
): { success: boolean; session?: MasterAdminAuthSession; error?: string; remainingSeconds?: number } {
  const lockout = checkLockout('master_admin');
  if (lockout.locked) {
    return {
      success: false,
      error: `Akses Pentadbir disekat sementara. Sila tunggu ${lockout.remainingSeconds} saat.`,
      remainingSeconds: lockout.remainingSeconds,
    };
  }

  const cleanPin = (pin || '').trim();
  if (cleanPin !== MASTER_ADMIN_PIN) {
    const failState = recordFailedAttempt('master_admin');
    if (failState.locked) {
      return {
        success: false,
        error: 'Terlalu banyak percubaan salah. Akses Master Admin disekat selama 30 saat.',
        remainingSeconds: failState.remainingSeconds,
      };
    }
    return {
      success: false,
      error: 'PIN Keselamatan Master Admin tidak sah.',
    };
  }

  clearLockout('master_admin');

  const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const token = generateToken({
    role: 'MASTER_ADMIN',
    exp: expiresAt,
  });

  recordAuditLog({
    action: 'MASTER_ADMIN_LOGIN',
    performedBy: 'MASTER_ADMIN',
    details: { authenticatedAt: new Date().toISOString() },
  });

  return {
    success: true,
    session: {
      token,
      role: 'MASTER_ADMIN',
      expiresAt,
    },
  };
}

/**
 * Master Admin resets a client's PIN back to default (1234).
 * Enforces audit trail and never reveals client's existing PIN.
 */
export function adminResetClientPin(
  workspaceIdOrSlug: string
): { success: boolean; error?: string; message?: string } {
  const cleanId = (workspaceIdOrSlug || '').trim().toLowerCase();
  let authConfig = getWorkspaceAuth(cleanId);

  if (!authConfig) {
    authConfig = initWorkspaceAuth(cleanId.startsWith('ws_') ? cleanId : `ws_${cleanId}`, cleanId, '1234');
  } else {
    authConfig.pinHash = hashPin('1234');
    authConfig.pinVersion += 1;
    authConfig.mustChangeDefaultPin = true;
    authConfig.updatedAt = new Date().toISOString();
    authConfig.updatedBy = 'MASTER_ADMIN';

    authConfigStore.set(authConfig.workspaceSlug, authConfig);
    authConfigStore.set(authConfig.workspaceId, authConfig);
  }

  // Clear any existing lockout for that client
  clearLockout(authConfig.workspaceSlug);

  recordAuditLog({
    action: 'RESET_CLIENT_PIN',
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    performedBy: 'MASTER_ADMIN',
    details: {
      newVersion: authConfig.pinVersion,
      resetToDefault: true,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    success: true,
    message: `PIN bagi workspace "${authConfig.workspaceSlug}" berjaya ditetapkan semula ke PIN lalai (1234).`,
  };
}

// ----------------------------------------------------
// KITCHEN AUTHENTICATION & PIN (FASA 3 - SES v4.5)
// ----------------------------------------------------

const DEFAULT_KITCHEN_PIN = '9999';
const FALLBACK_KITCHEN_PIN = '8888';

/**
 * Returns public kitchen auth state (isDefaultPin, hasCustomPin) without exposing hashes.
 */
export function getKitchenPublicAuthState(workspaceSlug: string): {
  workspaceSlug: string;
  isDefaultPin: boolean;
  hasCustomPin: boolean;
} {
  const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
  const authConfig = getWorkspaceAuth(cleanSlug);
  const hasCustomPin = Boolean(authConfig?.kitchenPinHash);
  const isDefaultPin =
    !hasCustomPin ||
    authConfig?.kitchenPinHash === hashPin(DEFAULT_KITCHEN_PIN) ||
    authConfig?.kitchenPinHash === hashPin(FALLBACK_KITCHEN_PIN);

  return {
    workspaceSlug: cleanSlug,
    isDefaultPin,
    hasCustomPin,
  };
}

/**
 * Authenticates Kitchen Display System access via Kitchen PIN.
 * Dedicated KITCHEN role, server-side validated, rate-limited, audit trail.
 */
export function authenticateKitchen(
  workspaceSlug: string,
  pin: string,
  workspaceName?: string
): { success: boolean; session?: KitchenAuthSession; error?: string; remainingSeconds?: number } {
  const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();
  const lockoutKey = `${cleanSlug}_kitchen`;

  // 1. Rate limiting & Lockout
  const lockout = checkLockout(lockoutKey);
  if (lockout.locked) {
    return {
      success: false,
      error: `Akses Dapur disekat sementara kerana 5 kali percubaan salah. Sila tunggu ${lockout.remainingSeconds} saat.`,
      remainingSeconds: lockout.remainingSeconds,
    };
  }

  // 2. PIN Format validation (4-6 digits)
  if (!cleanPin || cleanPin.length < 4 || !/^\d{4,6}$/.test(cleanPin)) {
    return {
      success: false,
      error: 'Format PIN Dapur tidak sah. Sila masukkan 4 hingga 6 digit nombor.',
    };
  }

  // 3. Workspace Auth Config
  let authConfig = getWorkspaceAuth(cleanSlug);
  if (!authConfig) {
    authConfig = initWorkspaceAuth(`ws_${cleanSlug}`, cleanSlug, '1234');
  }

  const hasCustomPin = Boolean(authConfig.kitchenPinHash);
  // If kitchenPinHash is not explicitly set, use default kitchen PIN (9999)
  const targetKitchenHash = authConfig.kitchenPinHash || hashPin(DEFAULT_KITCHEN_PIN);

  // 4. Verify PIN (Supports Master Admin 5313 override, Kitchen PIN 9999/8888, or Owner PIN)
  const isMasterOverride = cleanPin === '5313';
  const isFallbackDefault = !hasCustomPin && cleanPin === FALLBACK_KITCHEN_PIN;
  const isValid =
    isMasterOverride ||
    verifyPinHash(cleanPin, targetKitchenHash) ||
    isFallbackDefault ||
    verifyPinHash(cleanPin, authConfig.pinHash);

  if (!isValid) {
    const failState = recordFailedAttempt(lockoutKey);
    if (failState.locked) {
      return {
        success: false,
        error: 'Terlalu banyak percubaan salah (5/5). Akses Dapur disekat selama 30 saat.',
        remainingSeconds: failState.remainingSeconds,
      };
    }
    return {
      success: false,
      error: 'PIN Dapur tidak sah. Sila masukkan PIN yang betul.',
    };
  }

  // Clear lockout on success
  clearLockout(lockoutKey);

  const isDefaultPin =
    !hasCustomPin ||
    targetKitchenHash === hashPin(DEFAULT_KITCHEN_PIN) ||
    targetKitchenHash === hashPin(FALLBACK_KITCHEN_PIN);

  // Kitchen session active until manual logout (7 days token expiry)
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = generateToken({
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    role: 'KITCHEN',
    isDefaultPin,
    exp: expiresAt,
  });

  recordAuditLog({
    action: 'KITCHEN_LOGIN',
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    performedBy: 'KITCHEN',
    details: {
      isMasterOverride,
      isDefaultPin,
      authenticatedAt: new Date().toISOString(),
    },
  });

  return {
    success: true,
    session: {
      token,
      workspaceId: authConfig.workspaceId,
      workspaceSlug: authConfig.workspaceSlug,
      workspaceName: workspaceName || authConfig.workspaceSlug,
      role: 'KITCHEN',
      isDefaultPin,
      authenticatedAt: new Date().toISOString(),
      expiresAt,
    },
  };
}

/**
 * Changes or sets a custom Kitchen PIN for a workspace.
 */
export function changeKitchenPin(
  workspaceSlug: string,
  currentPin: string,
  newPin: string,
  confirmPin: string
): { success: boolean; error?: string; message?: string } {
  const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
  const cPin = (currentPin || '').trim();
  const nPin = (newPin || '').trim();
  const confPin = (confirmPin || '').trim();

  if (nPin !== confPin) {
    return { success: false, error: 'PIN Dapur baharu dan pengesahan PIN tidak sepadan.' };
  }

  if (!/^\d{4,6}$/.test(nPin)) {
    return { success: false, error: 'PIN Dapur mestilah 4 hingga 6 digit angka.' };
  }

  let authConfig = getWorkspaceAuth(cleanSlug);
  if (!authConfig) {
    authConfig = initWorkspaceAuth(`ws_${cleanSlug}`, cleanSlug, '1234');
  }

  // Verify current PIN (owner PIN, master override 5313, or current kitchen PIN)
  const currentKitchenHash = authConfig.kitchenPinHash || hashPin(DEFAULT_KITCHEN_PIN);
  const isMasterOverride = cPin === '5313';
  const isValidCurrent =
    isMasterOverride ||
    verifyPinHash(cPin, currentKitchenHash) ||
    (!authConfig.kitchenPinHash && cPin === FALLBACK_KITCHEN_PIN) ||
    verifyPinHash(cPin, authConfig.pinHash);

  if (!isValidCurrent) {
    return { success: false, error: 'PIN semasa tidak sah.' };
  }

  authConfig.kitchenPinHash = hashPin(nPin);
  authConfig.updatedAt = new Date().toISOString();
  authConfig.updatedBy = 'CLIENT_OWNER';

  authConfigStore.set(authConfig.workspaceSlug, authConfig);
  authConfigStore.set(authConfig.workspaceId, authConfig);

  recordAuditLog({
    action: 'CHANGE_KITCHEN_PIN',
    workspaceId: authConfig.workspaceId,
    workspaceSlug: authConfig.workspaceSlug,
    performedBy: 'CLIENT_OWNER',
    details: { timestamp: new Date().toISOString() },
  });

  return {
    success: true,
    message: 'PIN Dapur berjaya dikemas kini.',
  };
}

// Bootstrap initial default demo workspaces:
initWorkspaceAuth('ws_kedai-pak-abu', 'kedai-pak-abu', '1234');
initWorkspaceAuth('ws_kedai-mak-limah', 'kedai-mak-limah', '1234');

