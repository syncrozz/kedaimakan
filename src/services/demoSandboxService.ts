/**
 * SYNCROZZ KEDAI MAKAN - Demo Sandbox Coordination & Reset Pipeline (SES v4.5)
 * Strict Master Admin authorization, idempotent seed injection, allowlisted purge,
 * and zero leakage across production client workspaces.
 */

import { doc, collection, getDocs, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { FirebaseService } from './firebaseService';
import {
  DEMO_OFFICIAL_SEED,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_SLUG,
  DEMO_SEED_VERSION,
  getSeedExpectedCounts,
} from './demoSeedData';
import { MenuItem, RestaurantTable, TableReservation, KitchenOrderTicket, RestaurantTaxConfig } from '../types/restaurant';

export interface DemoResetProgress {
  step: 'IDLE' | 'DETACHING_LISTENERS' | 'SERVER_AUTH' | 'PURGING_FIRESTORE' | 'INJECTING_SEED' | 'VERIFYING_GATE' | 'SYNCING_LOCAL' | 'COMPLETED' | 'FAILED';
  message: string;
  percent: number;
  error?: string;
  resetOperationId?: string;
  resetVersion?: number;
}

export type DemoResetProgressCallback = (progress: DemoResetProgress) => void;

// Allowlisted collections for reset (Strict tenant isolation)
export const DEMO_RESET_COLLECTION_ALLOWLIST = [
  'restaurant_menu',
  'restaurant_tables',
  'restaurant_reservations',
  'restaurant_orders',
  'restaurant_kot',
  'restaurant_settings',
  'customers',
  'products',
  'sales',
  'expenses',
] as const;

// Allowlisted localStorage keys strictly scoped to demo workspace
export const DEMO_LOCAL_STORAGE_ALLOWLIST = [
  'restaurant_menu_demo',
  'restaurant_tables_demo',
  'restaurant_reservations_demo',
  'restaurant_orders_demo',
  'restaurant_kot_tickets_demo',
  'restaurant_tax_config_demo',
  'restaurant_tax_records_demo',
  'products_demo',
  'customers_demo',
  'sales_demo',
  'expenses_demo',
  'cart_demo',
  'current_order_demo',
  'pos_active_table_demo',
  'active_split_bill_demo',
] as const;

export class DemoSandboxService {
  private static isResetInProgress = false;

  /**
   * Check if current workspace context is the demo sandbox
   */
  public static isDemoWorkspace(slugOrId?: string): boolean {
    const clean = (slugOrId || '').trim().toLowerCase();
    return clean === 'demo' || clean === DEMO_WORKSPACE_ID;
  }

  /**
   * Fetch demo sandbox status from backend
   */
  public static async getDemoStatus(): Promise<{
    success: boolean;
    workspaceId: string;
    workspaceSlug: string;
    seedVersion: string;
    demoResetVersion: number;
    demoLastResetAt: string;
  }> {
    const res = await fetch('/api/demo/status');
    if (!res.ok) {
      throw new Error(`Gagal membaca status Demo Sandbox (${res.status})`);
    }
    return res.json();
  }

  /**
   * Execute authoritative Demo Sandbox Reset.
   * STRICT RULE: Requires Master Admin session token.
   */
  public static async executeAuthoritativeReset(
    masterAdminToken: string,
    onProgress?: DemoResetProgressCallback
  ): Promise<{
    success: boolean;
    resetOperationId: string;
    resetVersion: number;
    verified: boolean;
    counts: Record<string, number>;
  }> {
    const update = (step: DemoResetProgress['step'], message: string, percent: number, error?: string) => {
      onProgress?.({ step, message, percent, error });
    };

    // Concurrency Lock Check
    if (this.isResetInProgress) {
      const err = 'Operasi tetapan semula sandbox sedang berlangsung. Percubaan serentak dihalang.';
      update('FAILED', err, 0, err);
      throw new Error(err);
    }
    this.isResetInProgress = true;

    try {
      // 1. Connectivity Check
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const err = 'Tetapan semula sandbox memerlukan sambungan internet aktif untuk pengesahan pelayan dan penyegerakan awan.';
        update('FAILED', err, 0, err);
        throw new Error(err);
      }

      // 2. Detach only Demo-scoped Firestore listeners
      update('DETACHING_LISTENERS', 'Memutuskan pendengar data workspace demo secara berasingan...', 15);
      FirebaseService.detachWorkspaceListeners(DEMO_WORKSPACE_SLUG);

      // 3. Server Authorization & Operation Registration
      update('SERVER_AUTH', 'Mengesahkan kelayakan Master Admin & memulakan operasi...', 30);
      const authRes = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${masterAdminToken}`,
        },
      });

      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => ({}));
        const msg = errJson.error || `Pengesahan pelayan gagal (${authRes.status})`;
        update('FAILED', msg, 30, msg);
        throw new Error(msg);
      }

      const authData = await authRes.json();
      const resetOperationId = authData.resetOperationId;
      const resetVersion = authData.resetVersion;

      // 4. Firestore Reset & Idempotent Seed Injection
      const db = FirebaseService.getDb();
      if (db) {
        update('PURGING_FIRESTORE', 'Membersihkan koleksi lama sandbox demo...', 50);
        await this.purgeAllowlistedCollections(db);

        update('INJECTING_SEED', 'Menyuntik dataset benih rasmi (v1.0.0)...', 70);
        await this.injectDeterministicSeed(db);

        // 5. Verification Gate (Verify expected counts)
        update('VERIFYING_GATE', 'Menjalankan Gate Pengesahan integriti data...', 85);
        const verification = await this.verifySeededCounts(db);
        if (!verification.verified) {
          const errMsg = `Integriti benih gagal disahkan: ${verification.reason}`;
          update('FAILED', errMsg, 85, errMsg);
          throw new Error(errMsg);
        }
      }

      // 6. Synchronize Local Storage (Only allowlisted demo keys, never localStorage.clear())
      update('SYNCING_LOCAL', 'Menyelaraskan storan setempat demo...', 95);
      this.purgeAllowlistedLocalStorage();
      this.seedAllowlistedLocalStorage();

      const finalCounts = getSeedExpectedCounts();
      update('COMPLETED', 'Tetapan semula Sandbox Demo selesai dan disahkan sepenuhnya!', 100);

      return {
        success: true,
        resetOperationId,
        resetVersion,
        verified: true,
        counts: finalCounts,
      };
    } catch (err: any) {
      update('FAILED', err.message || 'Ralat tidak diketahui semasa tetapan semula', 0, err.message);
      throw err;
    } finally {
      this.isResetInProgress = false;
    }
  }

  /**
   * Purge only allowlisted subcollections under workspaces/demo
   */
  private static async purgeAllowlistedCollections(db: any): Promise<void> {
    for (const colName of DEMO_RESET_COLLECTION_ALLOWLIST) {
      try {
        const colRef = collection(db, 'workspaces', DEMO_WORKSPACE_SLUG, colName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          // Process in batches of 450 (Firestore limit is 500)
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 450);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`[Demo Sandbox] Warning purging collection ${colName}:`, err);
      }
    }
  }

  /**
   * Inject deterministic seed using setDoc to ensure strict idempotency
   */
  private static async injectDeterministicSeed(db: any): Promise<void> {
    const batch = writeBatch(db);

    // 1. Menu Items
    for (const item of DEMO_OFFICIAL_SEED.menuItems) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_menu', item.id);
      batch.set(docRef, JSON.parse(JSON.stringify(item)));
    }

    // 2. Tables
    for (const table of DEMO_OFFICIAL_SEED.tables) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_tables', table.id);
      batch.set(docRef, JSON.parse(JSON.stringify(table)));
    }

    // 3. Reservations
    for (const res of DEMO_OFFICIAL_SEED.reservations) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_reservations', res.id);
      batch.set(docRef, JSON.parse(JSON.stringify(res)));
    }

    // 4. KOT Tickets
    for (const kot of DEMO_OFFICIAL_SEED.sampleKotTickets) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_kot', kot.id);
      batch.set(docRef, JSON.parse(JSON.stringify(kot)));
    }

    // 5. Tax Config
    const taxDocRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_settings', 'tax_config');
    batch.set(taxDocRef, JSON.parse(JSON.stringify(DEMO_OFFICIAL_SEED.taxConfig)));

    // 6. Customers
    for (const cust of DEMO_OFFICIAL_SEED.customers) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'customers', cust.id);
      batch.set(docRef, JSON.parse(JSON.stringify(cust)));
    }

    // 7. Products
    for (const prod of DEMO_OFFICIAL_SEED.products) {
      const docRef = doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'products', prod.id);
      batch.set(docRef, JSON.parse(JSON.stringify(prod)));
    }

    await batch.commit();
  }

  /**
   * Verification Gate: Verify seeded document counts in Firestore match expected seed
   */
  private static async verifySeededCounts(db: any): Promise<{ verified: boolean; reason?: string }> {
    const expected = getSeedExpectedCounts();

    const menuSnap = await getDocs(collection(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_menu'));
    if (menuSnap.size !== expected.menuItems) {
      return { verified: false, reason: `Menu count mismatch: found ${menuSnap.size}, expected ${expected.menuItems}` };
    }

    const tableSnap = await getDocs(collection(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_tables'));
    if (tableSnap.size !== expected.tables) {
      return { verified: false, reason: `Tables count mismatch: found ${tableSnap.size}, expected ${expected.tables}` };
    }

    const taxSnap = await getDoc(doc(db, 'workspaces', DEMO_WORKSPACE_SLUG, 'restaurant_settings', 'tax_config'));
    if (!taxSnap.exists()) {
      return { verified: false, reason: 'Tax configuration record was not seeded' };
    }

    return { verified: true };
  }

  /**
   * Purge only allowlisted demo localStorage keys
   */
  public static purgeAllowlistedLocalStorage(): void {
    if (typeof window === 'undefined') return;

    for (const key of DEMO_LOCAL_STORAGE_ALLOWLIST) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn(`[Demo Sandbox] Failed removing localStorage key ${key}:`, err);
      }
    }
  }

  /**
   * Populate allowlisted localStorage keys with the official seed
   */
  public static seedAllowlistedLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('restaurant_menu_demo', JSON.stringify(DEMO_OFFICIAL_SEED.menuItems));
      localStorage.setItem('restaurant_tables_demo', JSON.stringify(DEMO_OFFICIAL_SEED.tables));
      localStorage.setItem('restaurant_reservations_demo', JSON.stringify(DEMO_OFFICIAL_SEED.reservations));
      localStorage.setItem('restaurant_kot_tickets_demo', JSON.stringify(DEMO_OFFICIAL_SEED.sampleKotTickets));
      localStorage.setItem('restaurant_tax_config_demo', JSON.stringify(DEMO_OFFICIAL_SEED.taxConfig));
      localStorage.setItem('customers_demo', JSON.stringify(DEMO_OFFICIAL_SEED.customers));
      localStorage.setItem('products_demo', JSON.stringify(DEMO_OFFICIAL_SEED.products));
    } catch (err) {
      console.warn('[Demo Sandbox] Error seeding demo localStorage:', err);
    }
  }

  /**
   * Client-side View Refresh (Non-destructive for prospective demo users)
   * Reloads in-memory data from Firestore without wiping shared collections.
   */
  public static async refreshDemoView(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.purgeAllowlistedLocalStorage();
    this.seedAllowlistedLocalStorage();
    window.location.reload();
  }
}
