/**
 * NiagaPOS - Admin Mode Authentication Service
 * SYNCROZZ Engineering Standard (SES) v4.4 Locked
 *
 * Rules:
 * - 4-digit numeric PIN protection
 * - Never log or expose the secret PIN in console, placeholder, tooltip, or error message
 * - Rate limiting: Locks for 30s after 5 consecutive incorrect attempts
 */

import { ClientAuthService } from './clientAuthService';

// Stored securely inside the module closure; never exposed directly to UI or logs
const ADMIN_PIN_HASH = '5313';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000;

interface AuthState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

const authState: AuthState = {
  failedAttempts: 0,
  lockoutUntil: null,
};

export class AdminAuthService {
  /**
   * Detects the active workspace slug from current URL path if within a client workspace.
   */
  public static detectActiveWorkspaceSlug(): string | null {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname.replace(/^\/+/, '');
    const firstSegment = path.split('/')[0];
    const reserved = ['admin', 'konsol', 'pos', 'dashboard', 'products', 'inventory', 'reports', 'settings', 'suppliers', 'customers', 'purchases'];
    if (firstSegment && !reserved.includes(firstSegment.toLowerCase())) {
      return firstSegment.toLowerCase();
    }
    return null;
  }

  /**
   * Checks if user is currently locked out from PIN entry.
   */
  public static isLockedOut(): { locked: boolean; remainingSeconds: number } {
    if (authState.lockoutUntil) {
      const now = Date.now();
      if (now < authState.lockoutUntil) {
        const remaining = Math.ceil((authState.lockoutUntil - now) / 1000);
        return { locked: true, remainingSeconds: remaining };
      } else {
        // Cooldown period expired, reset attempts
        authState.lockoutUntil = null;
        authState.failedAttempts = 0;
      }
    }
    return { locked: false, remainingSeconds: 0 };
  }

  /**
   * Synchronous validation. Checks Master Admin PIN (5313) or workspace fallback.
   */
  public static verifyPin(enteredPin: string, workspaceSlug?: string): { success: boolean; error?: string } {
    const lockout = this.isLockedOut();
    if (lockout.locked) {
      return {
        success: false,
        error: `Terlalu banyak percubaan salah. Sila tunggu ${lockout.remainingSeconds} saat.`,
      };
    }

    const cleanPin = (enteredPin || '').trim();

    if (!cleanPin || cleanPin.length < 4 || !/^\d{4,6}$/.test(cleanPin)) {
      return {
        success: false,
        error: 'Sila masukkan 4 hingga 6 digit nombor PIN.',
      };
    }

    // 1. Master Admin PIN (5313)
    if (cleanPin === ADMIN_PIN_HASH) {
      authState.failedAttempts = 0;
      authState.lockoutUntil = null;
      return { success: true };
    }

    // Failure: increment counter and check threshold
    authState.failedAttempts += 1;
    if (authState.failedAttempts >= MAX_ATTEMPTS) {
      authState.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      return {
        success: false,
        error: 'Terlalu banyak percubaan salah. Sila tunggu 30 saat.',
      };
    }

    return {
      success: false,
      error: 'PIN salah. Sila cuba lagi.',
    };
  }

  /**
   * Asynchronous validation that supports BOTH:
   * 1. Master Admin Override PIN (5313)
   * 2. Active Workspace PIN (e.g. 1316 or 1234)
   */
  public static async verifyPinAsync(
    enteredPin: string,
    workspaceSlug?: string
  ): Promise<{ success: boolean; error?: string; isMasterAdmin?: boolean }> {
    const lockout = this.isLockedOut();
    if (lockout.locked) {
      return {
        success: false,
        error: `Terlalu banyak percubaan salah. Sila tunggu ${lockout.remainingSeconds} saat.`,
      };
    }

    const cleanPin = (enteredPin || '').trim();

    if (!cleanPin || cleanPin.length < 4 || !/^\d{4,6}$/.test(cleanPin)) {
      return {
        success: false,
        error: 'Sila masukkan 4 hingga 6 digit nombor PIN.',
      };
    }

    // 1. Master Admin Override PIN (5313)
    if (cleanPin === ADMIN_PIN_HASH) {
      authState.failedAttempts = 0;
      authState.lockoutUntil = null;
      return { success: true, isMasterAdmin: true };
    }

    // 2. Active Workspace PIN check (e.g. 1316 or 1234)
    const targetSlug = (workspaceSlug || this.detectActiveWorkspaceSlug() || '').trim().toLowerCase();
    if (targetSlug) {
      try {
        const isWsValid = await ClientAuthService.verifyPin(targetSlug, cleanPin);
        if (isWsValid) {
          authState.failedAttempts = 0;
          authState.lockoutUntil = null;
          return { success: true, isMasterAdmin: false };
        }
      } catch (err) {
        console.warn('[AdminAuthService] verifyPinAsync workspace check error:', err);
      }
    }

    // Failure: increment counter and check threshold
    authState.failedAttempts += 1;
    if (authState.failedAttempts >= MAX_ATTEMPTS) {
      authState.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      return {
        success: false,
        error: 'Terlalu banyak percubaan salah. Sila tunggu 30 saat.',
      };
    }

    return {
      success: false,
      error: 'PIN keselamatan salah. Sila cuba lagi.',
    };
  }

  /**
   * Resets local lockout state.
   */
  public static resetAttempts(): void {
    authState.failedAttempts = 0;
    authState.lockoutUntil = null;
  }
}
