/**
 * NiagaPOS Multi-Client Workspace, Client Onboarding & Trial Management Domain Service
 * 
 * Supports both:
 * 1. Cloud Firestore live multi-tenant backend (when Firebase credentials configured)
 * 2. Isolated local storage fallback with zero NiagaPOS V1 contamination
 * 
 * Complies with SES v4.4:
 * - Creates workspace document in /workspaces/{workspaceId}
 * - Registers unique slug in /workspace_slugs/{slug}
 * - Creates OWNER membership in /workspaces/{workspaceId}/members/{ownerUid}
 * - Generates official client access URL: https://niagapos.syncrozz.com/{workspaceSlug}
 * - Generates secure Firebase Auth invitation payload
 */

import {
  Workspace,
  WorkspaceStatus,
  WorkspaceMember,
  WorkspacePlatform,
  SubscriptionPlan,
  SubscriptionPaymentMethod,
  WorkspacePaymentRecord,
  CreateWorkspaceInput,
  ClientAccessDetails,
} from '../types/workspace';
import { isValidSlug } from './urlRouter';
import { FirebaseService, OperationType } from './firebaseService';
import { TemplateService } from './templateService';
import { doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, deleteDoc } from 'firebase/firestore';

const WORKSPACES_LOCAL_KEY = 'niagapos_workspaces_v1';
const WORKSPACE_MEMBERS_LOCAL_KEY = 'niagapos_workspace_members_v1';
const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const RETAIL_PRODUCTION_DOMAIN = 'https://niagapos.syncrozz.com';
export const RESTAURANT_PRODUCTION_DOMAIN = 'https://kedaimakan.syncrozz.com';
export const PRODUCTION_DOMAIN = RETAIL_PRODUCTION_DOMAIN;

export const SUBSCRIPTION_PRICING = {
  MONTHLY: {
    plan: 'MONTHLY' as const,
    name: 'Pelan Bulanan',
    price: 10,
    currency: 'MYR',
    periodDays: 30,
    priceFormatted: 'RM10',
    billingCycleText: 'setiap bulan',
    durationText: '30 Hari',
    description: 'Sesuai untuk perniagaan fleksibel tanpa komitmen jangka panjang.',
    savingsBadge: null,
  },
  ANNUAL: {
    plan: 'ANNUAL' as const,
    name: 'Pelan Tahunan (Jimat)',
    price: 110,
    currency: 'MYR',
    periodDays: 365,
    priceFormatted: 'RM110',
    billingCycleText: 'setiap tahun',
    durationText: '365 Hari (1 Tahun)',
    description: 'Paling jimat & berbaloi! Nikmati 12 bulan pada harga RM110 (Jimat RM10 berbanding bayaran bulanan).',
    savingsBadge: 'JIMAT RM10',
  },
} as const;

export const DEFAULT_DEMO_WORKSPACE: Workspace = {
  workspaceId: 'ws_demo_sandbox_001',
  workspaceSlug: 'demo',
  workspaceName: 'Kedai Makan Demo (Sandbox)',
  ownerEmail: 'demo@niagapos.syncrozz.com',
  ownerName: 'Pelanggan Demo NiagaPOS',
  status: 'ACTIVE',
  trialDurationDays: 365,
  trialStartedAt: '2026-01-01T00:00:00.000Z',
  trialExpiresAt: '2027-01-01T00:00:00.000Z',
  gracePeriodDays: 30,
  gracePeriodEndsAt: '2027-01-31T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workspaceType: 'DEMO',
  platform: 'RESTAURANT',
  demoMetadata: {
    demoSeedVersion: '1.0.0',
    demoAccessEnabled: true,
    demoResetVersion: 1,
    demoAnalyticsEnabled: true,
  },
  authConfig: {
    pinHash: 'd404559f602eab6fd602ac7680dacbfaadd13630335e951f097af3900e9de176b6db28512f2e000b9d04fba5133e8b1c6e8df59db3a8ab9d60be4b97cc9e81db',
    salt: 'demo_salt_constant_001',
    pinVersion: 1,
    mustChangeDefaultPin: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

// In-memory fallback for non-browser runtimes (unit tests / node)
const memoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorage.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memoryStorage.set(key, value);
}

export class WorkspaceService {
  /**
   * Helper to sanitize payload for Firestore
   */
  private static sanitize<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Authoritative platform normalization (SES v4.5):
   * 1. If ws.platform is explicitly RESTAURANT or RETAIL, preserve it.
   * 2. If existing authoritative restaurant configuration exists, classify as RESTAURANT.
   * 3. Otherwise default to RETAIL.
   * 
   * Strict Rule: Zero slug/name/email heuristics.
   */
  public static normalizeWorkspacePlatform(ws: Workspace): Workspace {
    if (!ws) return ws;
    if (ws.platform === 'RESTAURANT' || ws.platform === 'RETAIL') {
      return ws;
    }
    if (TemplateService.hasAuthoritativeRestaurantConfig(ws.workspaceSlug)) {
      return { ...ws, platform: 'RESTAURANT' };
    }
    return { ...ws, platform: 'RETAIL' };
  }

  /**
   * Generates authoritative platform-aware Client Access URL:
   * RESTAURANT → https://kedaimakan.syncrozz.com/{workspaceSlug}
   * RETAIL     → https://niagapos.syncrozz.com/{workspaceSlug}
   * LEGACY     → https://niagapos.syncrozz.com/{workspaceSlug} (when legacy: true)
   * 
   * Strict rule: Zero slug heuristics (no name/substring/email inference).
   */
  public static getClientAccessUrl(
    workspaceOrSlug: Workspace | string,
    options?: { legacy?: boolean }
  ): string {
    let ws: Workspace | null = null;
    let slug = '';

    if (typeof workspaceOrSlug === 'string') {
      slug = workspaceOrSlug.trim().toLowerCase();
      ws = this.getWorkspaceBySlug(slug);
    } else if (workspaceOrSlug && typeof workspaceOrSlug === 'object') {
      ws = this.normalizeWorkspacePlatform(workspaceOrSlug);
      slug = (ws.workspaceSlug || '').trim().toLowerCase();
    }

    if (!slug) return RETAIL_PRODUCTION_DOMAIN;

    // Legacy override: always returns niagapos.syncrozz.com/{slug}
    if (options?.legacy) {
      return `${RETAIL_PRODUCTION_DOMAIN}/${slug}`;
    }

    const platform = ws?.platform;
    if (platform === 'RESTAURANT') {
      return `${RESTAURANT_PRODUCTION_DOMAIN}/${slug}`;
    }

    // Default to Retail / NiagaPOS domain (no slug heuristics)
    return `${RETAIL_PRODUCTION_DOMAIN}/${slug}`;
  }

  /**
   * Retrieves all registered workspaces (from Firestore if connected, fallback to isolated local store).
   */
  public static async getAllWorkspacesAsync(): Promise<Workspace[]> {
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const colRef = collection(db, 'workspaces');
        const snap = await getDocs(colRef);
        const list: Workspace[] = [];
        snap.forEach((d) => {
          list.push(this.normalizeWorkspacePlatform(d.data() as Workspace));
        });
        // Keep local cache synced
        this.saveWorkspacesLocal(list);
        return list;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore fetch error, falling back to local isolated store:', err);
      }
    }
    return this.getAllWorkspacesLocal();
  }

  /**
   * Synchronous accessor for components requiring instant local state
   */
  public static getAllWorkspaces(): Workspace[] {
    return this.getAllWorkspacesLocal();
  }

  private static getAllWorkspacesLocal(): Workspace[] {
    try {
      const raw = safeGetItem(WORKSPACES_LOCAL_KEY);
      let list: Workspace[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      // Guarantee DEMO sandbox workspace presence
      if (!list.some((w) => w.workspaceSlug.toLowerCase() === 'demo' || w.workspaceId === 'ws_demo_sandbox_001')) {
        list.push(DEFAULT_DEMO_WORKSPACE);
      }
      return list.map((w) => this.normalizeWorkspacePlatform(w));
    } catch {
      return [DEFAULT_DEMO_WORKSPACE];
    }
  }

  private static saveWorkspacesLocal(workspaces: Workspace[]): void {
    safeSetItem(WORKSPACES_LOCAL_KEY, JSON.stringify(workspaces));
  }

  /**
   * Retrieves workspace members
   */
  public static async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const membersCol = collection(db, 'workspaces', workspaceId, 'members');
        const snap = await getDocs(membersCol);
        const list: WorkspaceMember[] = [];
        snap.forEach((d) => {
          list.push(d.data() as WorkspaceMember);
        });
        return list;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore getWorkspaceMembers error:', err);
      }
    }
    // Fallback local members
    try {
      const raw = safeGetItem(`${WORKSPACE_MEMBERS_LOCAL_KEY}_${workspaceId}`);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch {
      return [];
    }
  }

  private static saveWorkspaceMembersLocal(workspaceId: string, members: WorkspaceMember[]): void {
    safeSetItem(`${WORKSPACE_MEMBERS_LOCAL_KEY}_${workspaceId}`, JSON.stringify(members));
  }

  public static upsertLocalWorkspace(workspace: Workspace): void {
    try {
      const all = this.getAllWorkspacesLocal();
      const idx = all.findIndex(
        (w) =>
          w.workspaceId === workspace.workspaceId ||
          w.workspaceSlug.toLowerCase() === workspace.workspaceSlug.toLowerCase()
      );
      if (idx >= 0) {
        all[idx] = workspace;
      } else {
        all.push(workspace);
      }
      this.saveWorkspacesLocal(all);

      if (workspace.authConfig && typeof localStorage !== 'undefined') {
        try {
          const cfgKey = `np_auth_cfg_${workspace.workspaceSlug.toLowerCase()}`;
          localStorage.setItem(cfgKey, JSON.stringify({
            workspaceSlug: workspace.workspaceSlug.toLowerCase(),
            ...workspace.authConfig,
          }));
        } catch {}
      }
    } catch {}
  }

  /**
   * Updates PIN authentication configuration for a workspace across Firestore and local storage.
   */
  public static async updateWorkspaceAuthConfig(
    workspaceSlug: string,
    authConfig: {
      pinHash: string;
      salt: string;
      pinVersion: number;
      mustChangeDefaultPin: boolean;
      updatedAt: string;
    }
  ): Promise<boolean> {
    const clean = workspaceSlug.trim().toLowerCase();
    const all = this.getAllWorkspacesLocal();
    const index = all.findIndex((w) => w.workspaceSlug.toLowerCase() === clean);

    if (index !== -1) {
      all[index].authConfig = authConfig;
      all[index].updatedAt = new Date().toISOString();
      this.saveWorkspacesLocal(all);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`np_auth_cfg_${clean}`, JSON.stringify({
          workspaceSlug: clean,
          ...authConfig,
        }));
      } catch {}
    }

    const db = FirebaseService.getDb();
    if (db) {
      try {
        let wsId = index !== -1 ? all[index].workspaceId : null;
        if (!wsId) {
          const ws = await this.getWorkspaceBySlugAsync(clean);
          wsId = ws?.workspaceId || `ws_${clean}`;
        }
        const wsRef = doc(db, 'workspaces', wsId);
        await setDoc(wsRef, {
          authConfig: this.sanitize(authConfig),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        return true;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore updateWorkspaceAuthConfig warning:', err);
      }
    }
    return true;
  }

  /**
   * Looks up a workspace by its unique URL slug.
   * Multi-tier resolution:
   * 1. Check /workspace_slugs/{slug} index document
   * 2. Fallback query /workspaces where workspaceSlug == slug
   * 3. Fallback direct /workspaces/{slug} document
   * 4. Fallback local isolated store
   */
  public static async getWorkspaceBySlugAsync(slug: string): Promise<Workspace | null> {
    if (!slug) return null;
    const clean = slug.trim().toLowerCase();

    const db = FirebaseService.getDb();
    if (db) {
      try {
        // 1. Primary: Look up slug registry index
        const slugDocRef = doc(db, 'workspace_slugs', clean);
        const slugSnap = await getDoc(slugDocRef);
        if (slugSnap.exists()) {
          const { workspaceId } = slugSnap.data() as { workspaceId: string };
          if (workspaceId) {
            const wsDocRef = doc(db, 'workspaces', workspaceId);
            const wsSnap = await getDoc(wsDocRef);
            if (wsSnap.exists()) {
              const ws = this.normalizeWorkspacePlatform(wsSnap.data() as Workspace);
              this.upsertLocalWorkspace(ws);
              return ws;
            }
          }
        }

        // 2. Secondary: Query /workspaces collection by workspaceSlug
        const wsQuery = query(collection(db, 'workspaces'), where('workspaceSlug', '==', clean));
        const wsQuerySnap = await getDocs(wsQuery);
        if (!wsQuerySnap.empty) {
          const ws = this.normalizeWorkspacePlatform(wsQuerySnap.docs[0].data() as Workspace);
          this.upsertLocalWorkspace(ws);
          // Self-heal the slug registry index in Firestore
          try {
            const healSlugRef = doc(db, 'workspace_slugs', clean);
            await setDoc(healSlugRef, this.sanitize({
              slug: clean,
              workspaceId: ws.workspaceId,
              createdAt: ws.createdAt || new Date().toISOString(),
            }), { merge: true });
          } catch {}
          return ws;
        }

        // 3. Tertiary: Check if workspace document ID matches clean slug
        const directWsRef = doc(db, 'workspaces', clean);
        const directSnap = await getDoc(directWsRef);
        if (directSnap.exists()) {
          const ws = this.normalizeWorkspacePlatform(directSnap.data() as Workspace);
          this.upsertLocalWorkspace(ws);
          return ws;
        }
      } catch (err) {
        console.warn('[WorkspaceService] Firestore getWorkspaceBySlugAsync error:', err);
      }
    }

    const all = this.getAllWorkspacesLocal();
    const found = all.find((w) => w.workspaceSlug.toLowerCase() === clean);
    return found ? this.normalizeWorkspacePlatform(found) : null;
  }

  public static getWorkspaceBySlug(slug: string): Workspace | null {
    if (!slug) return null;
    const clean = slug.trim().toLowerCase();
    const all = this.getAllWorkspacesLocal();
    const found = all.find((w) => w.workspaceSlug.toLowerCase() === clean);
    return found ? this.normalizeWorkspacePlatform(found) : null;
  }

  public static getWorkspaceById(id: string): Workspace | null {
    if (!id) return null;
    const all = this.getAllWorkspacesLocal();
    return all.find((w) => w.workspaceId === id) || null;
  }

  /**
   * Complete Real Client Onboarding Flow:
   * 1. Validates input and slug reservation immunity
   * 2. Checks slug uniqueness (Firestore + Local)
   * 3. Provisions workspace ID and trial timestamps
   * 4. Provisions owner UID & membership document with role = 'OWNER'
   * 5. Atomically writes to Firestore (/workspaces, /workspace_slugs, /workspaces/{id}/members/{uid})
   * 6. Generates secure client access URL: https://niagapos.syncrozz.com/{slug}
   */
  public static async createClientWorkspace(
    input: CreateWorkspaceInput
  ): Promise<{ success: boolean; details?: ClientAccessDetails; error?: string }> {
    const cleanSlug = input.workspaceSlug.trim().toLowerCase();

    // 1. Slug format & reserved route check
    if (!isValidSlug(cleanSlug)) {
      return {
        success: false,
        error: `Slug '${cleanSlug}' tidak sah atau merupakan laluan sistem terlindung (cth: admin, pos, login, settings).`,
      };
    }

    const db = FirebaseService.getDb();

    // 2. Check if slug exists in Firestore
    if (db) {
      try {
        const slugDocRef = doc(db, 'workspace_slugs', cleanSlug);
        const slugSnap = await getDoc(slugDocRef);
        if (slugSnap.exists()) {
          return { success: false, error: `Slug '${cleanSlug}' sudah didaftarkan oleh pelanggan lain di Cloud Firestore.` };
        }
      } catch (err) {
        console.warn('[WorkspaceService] Firestore slug check warning:', err);
      }
    } else {
      const existing = this.getWorkspaceBySlug(cleanSlug);
      if (existing) {
        return { success: false, error: `Slug '${cleanSlug}' sudah digunakan oleh pelanggan lain.` };
      }
    }

    const now = new Date();
    const trialDays = input.trialDurationDays && input.trialDurationDays > 0 ? input.trialDurationDays : 30;
    
    const trialExpiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const gracePeriodEndsAt = new Date(
      now.getTime() + (trialDays + DEFAULT_GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000
    ).toISOString();

    const workspaceId = `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const ownerUid = `owner_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const platform = input.platform || 'RETAIL';

    const newWorkspace: Workspace = {
      workspaceId,
      workspaceSlug: cleanSlug,
      workspaceName: input.workspaceName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      ownerName: input.ownerName.trim(),
      ownerUid,
      status: 'ACTIVE',
      trialDurationDays: trialDays,
      trialStartedAt: now.toISOString(),
      trialExpiresAt,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      gracePeriodEndsAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      metricsSummary: {
        productCount: 0,
        saleCount: 0,
        totalRevenue: 0,
      },
      workspaceType: 'CLIENT',
      platform,
    };

    const ownerMember: WorkspaceMember = {
      uid: ownerUid,
      workspaceId,
      email: input.ownerEmail.trim().toLowerCase(),
      displayName: input.ownerName.trim(),
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: now.toISOString(),
      invitedBy: 'MASTER_ADMIN',
      inviteSentAt: now.toISOString(),
    };

    // 3. Atomically write to Cloud Firestore if connected
    if (db) {
      try {
        const batch = writeBatch(db);

        // a. Workspace root document
        const wsRef = doc(db, 'workspaces', workspaceId);
        batch.set(wsRef, this.sanitize(newWorkspace));

        // b. Slug registry index
        const slugRef = doc(db, 'workspace_slugs', cleanSlug);
        batch.set(slugRef, this.sanitize({
          slug: cleanSlug,
          workspaceId,
          createdAt: now.toISOString(),
        }));

        // c. Owner member binding
        const memberRef = doc(db, 'workspaces', workspaceId, 'members', ownerUid);
        batch.set(memberRef, this.sanitize(ownerMember));

        // d. Initial Store Configuration document
        const storeRef = doc(db, 'workspaces', workspaceId, 'store', 'config');
        batch.set(storeRef, this.sanitize({
          id: `store_${workspaceId}`,
          workspaceId,
          name: input.workspaceName.trim(),
          code: cleanSlug.toUpperCase(),
          currency: 'MYR',
          address: '',
          phone: '',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }));

        await batch.commit();
        console.info(`[WorkspaceService] Workspace ${workspaceId} successfully created in Firestore.`);
      } catch (err) {
        console.error('[WorkspaceService] Failed to commit workspace to Firestore:', err);
        return {
          success: false,
          error: `Gagal mencipta workspace di Cloud Firestore: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // 4. Update local isolated store for seamless offline/fast access
    const all = this.getAllWorkspacesLocal();
    all.push(newWorkspace);
    this.saveWorkspacesLocal(all);
    this.saveWorkspaceMembersLocal(workspaceId, [ownerMember]);

    // 5. Initialize Client PIN Authentication with Default PIN: 1234
    try {
      fetch('/api/auth/client/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          workspaceSlug: cleanSlug,
          customPin: '1234',
        }),
      }).catch((e) => console.warn('[WorkspaceService] Server PIN init async notice:', e));
    } catch {}

    const accessUrl = this.getClientAccessUrl(newWorkspace);

    return {
      success: true,
      details: {
        workspace: newWorkspace,
        ownerMember,
        accessUrl,
        inviteMethod: 'FIREBASE_AUTH_INVITE',
        inviteToken: `inv_${workspaceId}_${ownerUid}`,
        defaultPin: '1234',
      },
    };
  }

  /**
   * Synchronous wrapper for legacy compatibility
   */
  public static createWorkspace(
    input: CreateWorkspaceInput
  ): { success: boolean; workspace?: Workspace; error?: string } {
    const cleanSlug = input.workspaceSlug.trim().toLowerCase();

    if (!isValidSlug(cleanSlug)) {
      return { success: false, error: 'Slug tidak sah atau merupakan laluan sistem terlindung (cth: admin, pos, login).' };
    }

    const existing = this.getWorkspaceBySlug(cleanSlug);
    if (existing) {
      return { success: false, error: `Slug '${cleanSlug}' sudah digunakan oleh pelanggan lain.` };
    }

    const now = new Date();
    const trialDays = input.trialDurationDays && input.trialDurationDays > 0 ? input.trialDurationDays : 30;
    
    const trialExpiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const gracePeriodEndsAt = new Date(
      now.getTime() + (trialDays + DEFAULT_GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000
    ).toISOString();

    const workspaceId = `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const ownerUid = `owner_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const platform = input.platform || 'RETAIL';

    const newWorkspace: Workspace = {
      workspaceId,
      workspaceSlug: cleanSlug,
      workspaceName: input.workspaceName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      ownerName: input.ownerName.trim(),
      ownerUid,
      status: 'ACTIVE',
      trialDurationDays: trialDays,
      trialStartedAt: now.toISOString(),
      trialExpiresAt,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      gracePeriodEndsAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      metricsSummary: {
        productCount: 0,
        saleCount: 0,
        totalRevenue: 0,
      },
      workspaceType: 'CLIENT',
      platform,
    };

    const ownerMember: WorkspaceMember = {
      uid: ownerUid,
      workspaceId,
      email: input.ownerEmail.trim().toLowerCase(),
      displayName: input.ownerName.trim(),
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: now.toISOString(),
      invitedBy: 'MASTER_ADMIN',
      inviteSentAt: now.toISOString(),
    };

    const all = this.getAllWorkspacesLocal();
    all.push(newWorkspace);
    this.saveWorkspacesLocal(all);
    this.saveWorkspaceMembersLocal(workspaceId, [ownerMember]);

    // Async persist to Firestore to ensure durable cloud persistence
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'workspaces', workspaceId), this.sanitize(newWorkspace));
        batch.set(doc(db, 'workspace_slugs', cleanSlug), this.sanitize({
          slug: cleanSlug,
          workspaceId,
          createdAt: now.toISOString(),
        }));
        batch.set(doc(db, 'workspaces', workspaceId, 'members', ownerUid), this.sanitize(ownerMember));
        batch.commit().catch((err) => {
          console.warn('[WorkspaceService] Async Firestore write failed in createWorkspace:', err);
        });
      } catch (err) {
        console.warn('[WorkspaceService] Error queueing Firestore batch in createWorkspace:', err);
      }
    }

    return { success: true, workspace: newWorkspace };
  }

  /**
   * Dynamically calculates trial status based on timestamps.
   */
  public static calculateTrialStatus(workspace: Workspace): WorkspaceStatus {
    if (workspace.status === 'SUSPENDED' || workspace.status === 'ARCHIVED') {
      return workspace.status;
    }

    const now = Date.now();
    const expiresAt = new Date(workspace.trialExpiresAt).getTime();
    const graceEndsAt = new Date(workspace.gracePeriodEndsAt).getTime();

    if (now > graceEndsAt) {
      return 'EXPIRED';
    }

    if (now > expiresAt) {
      return 'GRACE_PERIOD';
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (expiresAt - now <= sevenDaysMs) {
      return 'TRIAL_ENDING';
    }

    return 'ACTIVE';
  }

  /**
   * Calculates remaining days and hours in trial.
   */
  public static getRemainingTime(workspace: Workspace): { days: number; hours: number; isGrace: boolean; isExpired: boolean } {
    const now = Date.now();
    const expiresAt = new Date(workspace.trialExpiresAt).getTime();
    const graceEndsAt = new Date(workspace.gracePeriodEndsAt).getTime();

    if (now > graceEndsAt) {
      return { days: 0, hours: 0, isGrace: false, isExpired: true };
    }

    if (now > expiresAt) {
      const diffMs = graceEndsAt - now;
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      return { days, hours, isGrace: true, isExpired: false };
    }

    const diffMs = expiresAt - now;
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return { days, hours, isGrace: false, isExpired: false };
  }

  /**
   * Extends the trial window by a designated number of days.
   */
  public static async extendTrial(
    workspaceId: string,
    additionalDays: number
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const all = this.getAllWorkspacesLocal();
    const index = all.findIndex((w) => w.workspaceId === workspaceId);
    if (index === -1) return { success: false, error: 'Workspace tidak dijumpai.' };

    const ws = all[index];
    const currentExpiry = new Date(ws.trialExpiresAt).getTime();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);
    const newGrace = new Date(newExpiry.getTime() + ws.gracePeriodDays * 24 * 60 * 60 * 1000);

    ws.trialExpiresAt = newExpiry.toISOString();
    ws.gracePeriodEndsAt = newGrace.toISOString();
    ws.status = 'ACTIVE';
    ws.updatedAt = new Date().toISOString();

    const db = FirebaseService.getDb();
    if (db) {
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        await setDoc(wsRef, this.sanitize(ws), { merge: true });
      } catch (err) {
        console.warn('[WorkspaceService] Firestore extendTrial warning:', err);
      }
    }

    all[index] = ws;
    this.saveWorkspacesLocal(all);

    return { success: true, workspace: ws };
  }

  /**
   * Suspends a workspace (Hard Lockdown).
   */
  public static async suspendWorkspace(
    workspaceId: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const all = this.getAllWorkspacesLocal();
    const index = all.findIndex((w) => w.workspaceId === workspaceId);
    if (index === -1) return { success: false, error: 'Workspace tidak dijumpai.' };

    all[index].status = 'SUSPENDED';
    all[index].updatedAt = new Date().toISOString();

    const db = FirebaseService.getDb();
    if (db) {
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        await setDoc(wsRef, { status: 'SUSPENDED', updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn('[WorkspaceService] Firestore suspendWorkspace warning:', err);
      }
    }

    this.saveWorkspacesLocal(all);
    return { success: true, workspace: all[index] };
  }

  /**
   * Reactivates a suspended workspace.
   */
  public static async reactivateWorkspace(
    workspaceId: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const all = this.getAllWorkspacesLocal();
    const index = all.findIndex((w) => w.workspaceId === workspaceId);
    if (index === -1) return { success: false, error: 'Workspace tidak dijumpai.' };

    const calculated = this.calculateTrialStatus({ ...all[index], status: 'ACTIVE' });
    all[index].status = calculated;
    all[index].updatedAt = new Date().toISOString();

    const db = FirebaseService.getDb();
    if (db) {
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        await setDoc(wsRef, { status: calculated, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn('[WorkspaceService] Firestore reactivateWorkspace warning:', err);
      }
    }

    this.saveWorkspacesLocal(all);
    return { success: true, workspace: all[index] };
  }

  /**
   * Records a client subscription payment and activates/extends workspace access.
   * Plan options:
   * - MONTHLY: RM10 / month (+30 days)
   * - ANNUAL: RM110 / year (+365 days, saves RM10)
   */
  public static async recordSubscriptionPayment(
    workspaceId: string,
    plan: 'MONTHLY' | 'ANNUAL',
    options?: {
      paymentMethod?: SubscriptionPaymentMethod;
      referenceNote?: string;
      customAmount?: number;
      recordedBy?: string;
    }
  ): Promise<{ success: boolean; workspace?: Workspace; payment?: WorkspacePaymentRecord; error?: string }> {
    const all = this.getAllWorkspacesLocal();
    const index = all.findIndex((w) => w.workspaceId === workspaceId);
    if (index === -1) return { success: false, error: 'Workspace tidak dijumpai.' };

    const ws = all[index];
    const planConfig = SUBSCRIPTION_PRICING[plan];
    const amount = options?.customAmount ?? planConfig.price;
    const additionalDays = planConfig.periodDays;

    const currentExpiry = ws.subscriptionExpiresAt
      ? new Date(ws.subscriptionExpiresAt).getTime()
      : new Date(ws.trialExpiresAt).getTime();

    // If subscription is still valid, append days to existing expiry; otherwise start from now
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);
    const newGrace = new Date(newExpiry.getTime() + (ws.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000);
    const nowIso = new Date().toISOString();

    const payment: WorkspacePaymentRecord = {
      paymentId: `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      plan,
      amount,
      currency: 'MYR',
      periodDays: additionalDays,
      paidAt: nowIso,
      previousExpiresAt: new Date(baseTime).toISOString(),
      newExpiresAt: newExpiry.toISOString(),
      paymentMethod: options?.paymentMethod || 'DUITNOW_QR',
      referenceNote: options?.referenceNote?.trim() || undefined,
      recordedBy: options?.recordedBy || 'MASTER_ADMIN',
    };

    ws.subscriptionPlan = plan;
    ws.subscriptionPrice = amount;
    ws.subscriptionCurrency = 'MYR';
    ws.subscriptionStartedAt = ws.subscriptionStartedAt || nowIso;
    ws.subscriptionExpiresAt = newExpiry.toISOString();
    ws.trialExpiresAt = newExpiry.toISOString();
    ws.gracePeriodEndsAt = newGrace.toISOString();
    ws.status = 'ACTIVE';
    ws.lastPaymentAt = nowIso;
    ws.lastPaymentAmount = amount;
    if (options?.referenceNote) {
      ws.lastPaymentReference = options.referenceNote.trim();
    }
    ws.paymentHistory = [...(ws.paymentHistory || []), payment];
    ws.updatedAt = nowIso;

    const db = FirebaseService.getDb();
    if (db) {
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        await setDoc(wsRef, this.sanitize(ws), { merge: true });
      } catch (err) {
        console.warn('[WorkspaceService] Firestore recordSubscriptionPayment warning:', err);
      }
    }

    all[index] = ws;
    this.saveWorkspacesLocal(all);

    return { success: true, workspace: ws, payment };
  }
}

/**
 * Authoritative Central URL Resolver function (SES v4.5)
 * Preferred shape:
 * getClientAccessUrl(workspace: Workspace, options?: { legacy?: boolean }): string
 */
export function getClientAccessUrl(
  workspace: Workspace | string,
  options?: { legacy?: boolean }
): string {
  return WorkspaceService.getClientAccessUrl(workspace, options);
}
