/**
 * SYNCROZZ KEDAI MAKAN - Demo Analytics & Session Tracker (SES v4.5)
 * Privacy-first telemetry: Zero PII, stripped query params, heartbeat-based duration.
 */

export interface DemoSessionInfo {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  originCategory: 'DIRECT' | 'INTERNAL' | 'CAMPAIGN' | 'EXTERNAL';
  eventsCount: number;
}

const SESSION_STORAGE_KEY = 'syncrozz_demo_session_info';
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class DemoAnalyticsService {
  private static timerId: any = null;
  private static cachedSession: DemoSessionInfo | null = null;
  private static lastActivityTimestamp: number = Date.now();

  /**
   * Initializes or restores the current demo session
   */
  public static initSession(): DemoSessionInfo {
    const existing = this.loadStoredSession();
    const now = Date.now();

    if (existing) {
      const lastSeen = new Date(existing.lastSeenAt).getTime();
      // If inactive for more than 5 minutes, rotate session
      if (now - lastSeen < INACTIVITY_TIMEOUT_MS) {
        this.cachedSession = existing;
        this.startHeartbeat();
        this.bindActivityListeners();
        return existing;
      }
    }

    const newSession: DemoSessionInfo = {
      sessionId: `ds_${now}_${Math.random().toString(36).substring(2, 9)}`,
      startedAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      activeSeconds: 0,
      originCategory: this.detectSanitizedOrigin(),
      eventsCount: 0,
    };

    this.saveSession(newSession);
    this.cachedSession = newSession;
    this.startHeartbeat();
    this.bindActivityListeners();
    return newSession;
  }

  /**
   * Record a custom interaction event in the demo sandbox
   */
  public static trackEvent(eventName: string, details?: Record<string, any>): void {
    if (!this.cachedSession) {
      this.initSession();
    }
    if (!this.cachedSession) return;

    this.lastActivityTimestamp = Date.now();
    this.cachedSession.eventsCount += 1;
    this.cachedSession.lastSeenAt = new Date().toISOString();
    this.saveSession(this.cachedSession);

    // Development diagnostic log
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Demo Analytics] ${eventName}`, details || {});
    }
  }

  /**
   * Periodically emit heartbeat to keep session active
   */
  private static startHeartbeat(): void {
    if (this.timerId) return;

    this.timerId = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private static sendHeartbeat(): void {
    if (!this.cachedSession) return;

    const now = Date.now();
    // Check if user has been inactive for > 5 mins
    if (now - this.lastActivityTimestamp > INACTIVITY_TIMEOUT_MS) {
      return;
    }

    this.cachedSession.activeSeconds += Math.round(HEARTBEAT_INTERVAL_MS / 1000);
    this.cachedSession.lastSeenAt = new Date(now).toISOString();
    this.saveSession(this.cachedSession);

    // Call server heartbeat endpoint
    try {
      fetch('/api/demo/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.cachedSession.sessionId,
          lastSeenAt: this.cachedSession.lastSeenAt,
          activeSeconds: this.cachedSession.activeSeconds,
        }),
      }).catch(() => {
        // Heartbeat is best-effort
      });
    } catch (e) {
      // Non-blocking
    }
  }

  private static bindActivityListeners(): void {
    if (typeof window === 'undefined') return;

    const updateActivity = () => {
      this.lastActivityTimestamp = Date.now();
    };

    window.addEventListener('pointerdown', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
  }

  private static detectSanitizedOrigin(): 'DIRECT' | 'INTERNAL' | 'CAMPAIGN' | 'EXTERNAL' {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 'DIRECT';
    try {
      const ref = document.referrer;
      if (!ref) return 'DIRECT';

      const refUrl = new URL(ref);
      if (refUrl.hostname === window.location.hostname) {
        return 'INTERNAL';
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('utm_source') || params.get('ref')) {
        return 'CAMPAIGN';
      }

      return 'EXTERNAL';
    } catch {
      return 'DIRECT';
    }
  }

  private static loadStoredSession(): DemoSessionInfo | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private static saveSession(session: DemoSessionInfo): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  }

  public static getSession(): DemoSessionInfo | null {
    return this.cachedSession || this.loadStoredSession();
  }

  public static cleanup(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
