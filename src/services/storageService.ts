/**
 * NiagaPOS - Storage Safety, Versioning, and Backup/Restore Service
 * Part 08: Production Hardening & Release Readiness
 *
 * Core Directives:
 * 1. Schema Versioning: schemaVersion = 1
 * 2. Corrupted data handling: gracefully recovers from malformed localStorage
 * 3. Backup / Export: deterministic JSON operational data dump
 * 4. Safe Restore: deep structural validation before state overwrite
 */

import {
  Store,
  Product,
  InventoryMovement,
  Sale,
  Supplier,
  Purchase,
  Customer,
  LoyaltyLedgerEntry,
  StaffUser,
  StoreBackupPayload,
} from '../types';

export type { StoreBackupPayload };

export const CURRENT_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  SCHEMA_VERSION: 'niagapos_v2_schema_version',
  STORE: 'niagapos_v2_store_v1',
  PRODUCTS: 'niagapos_v2_products_v1',
  MOVEMENTS: 'niagapos_v2_movements_v1',
  SALES: 'niagapos_v2_sales_v1',
  SUPPLIERS: 'niagapos_v2_suppliers_v1',
  PURCHASES: 'niagapos_v2_purchases_v1',
  CUSTOMERS: 'niagapos_v2_customers_v1',
  LOYALTY: 'niagapos_v2_loyalty_v1',
  STAFF: 'niagapos_v2_staff_v1',
  ACTIVE_CASHIER_ID: 'niagapos_v2_active_cashier_id_v1',
  PRE_SYNC_BACKUP: 'niagapos_v2_pre_sync_backup_v1',
  LAST_SYNC_METADATA: 'niagapos_v2_last_sync_metadata_v1',
} as const;

/**
 * Returns isolated storage keys scoped strictly to a specific tenant workspace.
 */
export function getWorkspaceStorageKeys(workspaceId: string) {
  const prefix = `niagapos_ws_${workspaceId}`;
  return {
    STORE: `${prefix}_store_v1`,
    PRODUCTS: `${prefix}_products_v1`,
    MOVEMENTS: `${prefix}_movements_v1`,
    SALES: `${prefix}_sales_v1`,
    CUSTOMERS: `${prefix}_customers_v1`,
    SUPPLIERS: `${prefix}_suppliers_v1`,
    PURCHASES: `${prefix}_purchases_v1`,
  };
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  data?: StoreBackupPayload;
  summary?: {
    storeName: string;
    productCount: number;
    movementCount: number;
    saleCount: number;
    supplierCount: number;
    purchaseCount: number;
    customerCount: number;
    staffCount: number;
    exportedAt: string;
  };
}

export class StorageService {
  /**
   * Safe parser for localStorage: handles null, invalid JSON, or wrong type
   */
  public static safeParse<T>(
    raw: string | null,
    fallback: T,
    typeGuard?: (val: unknown) => boolean
  ): T {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeGuard && !typeGuard(parsed)) {
        console.warn('Storage data failed type guard, reverting to fallback state.');
        return fallback;
      }
      return parsed as T;
    } catch (err) {
      console.warn('Malformed JSON encountered in localStorage, reverting to fallback state.', err);
      return fallback;
    }
  }

  /**
   * Safe getter for localStorage with fallback
   */
  public static safeGet<T>(key: string, fallback: T, typeGuard?: (val: unknown) => boolean): T {
    try {
      const raw = localStorage.getItem(key);
      return this.safeParse<T>(raw, fallback, typeGuard);
    } catch {
      return fallback;
    }
  }

  /**
   * Safe setter for localStorage
   */
  public static safeSet(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to write key "${key}" to localStorage:`, err);
    }
  }

  /**
   * Generates a complete, structured backup payload containing all domain records.
   */
  public static createBackupPayload(data: {
    store: Store;
    products: Product[];
    movements: InventoryMovement[];
    sales: Sale[];
    suppliers: Supplier[];
    purchases: Purchase[];
    customers: Customer[];
    loyaltyLedger: LoyaltyLedgerEntry[];
    staffUsers: StaffUser[];
  }): StoreBackupPayload {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      system: 'NiagaPOS',
      exportedAt: new Date().toISOString(),
      store: data.store,
      products: data.products,
      movements: data.movements,
      sales: data.sales,
      suppliers: data.suppliers,
      purchases: data.purchases,
      customers: data.customers,
      loyaltyLedger: data.loyaltyLedger,
      staffUsers: data.staffUsers,
    };
  }

  /**
   * Deeply validates an imported JSON payload before restoring it into store state.
   */
  public static validateBackupPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'Backup data must be a valid JSON object.' };
    }

    const obj = payload as Record<string, any>;

    // 1. Schema Version Check
    if (typeof obj.schemaVersion !== 'number') {
      return { isValid: false, error: 'Missing or invalid schemaVersion in backup file.' };
    }

    if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        isValid: false,
        error: `Incompatible backup version (${obj.schemaVersion}). Current system supports up to version ${CURRENT_SCHEMA_VERSION}.`,
      };
    }

    // 2. Store Metadata Check
    if (!obj.store || typeof obj.store !== 'object' || !obj.store.id || !obj.store.name) {
      return { isValid: false, error: 'Malformed or missing store metadata in backup.' };
    }

    // 3. Operational Collections Array Checks
    const requiredArrays = [
      'products',
      'movements',
      'sales',
      'suppliers',
      'purchases',
      'customers',
      'loyaltyLedger',
      'staffUsers',
    ];

    for (const key of requiredArrays) {
      if (!Array.isArray(obj[key])) {
        return {
          isValid: false,
          error: `Malformed backup: "${key}" must be an array (found ${typeof obj[key]}).`,
        };
      }
    }

    // 4. Products check
    for (let i = 0; i < obj.products.length; i++) {
      const p = obj.products[i];
      if (!p || typeof p !== 'object' || !p.id || !p.name || typeof p.currentStock !== 'number') {
        return {
          isValid: false,
          error: `Invalid product record at index ${i}. Missing id, name, or currentStock.`,
        };
      }
    }

    const validPayload: StoreBackupPayload = {
      schemaVersion: obj.schemaVersion,
      system: obj.system || 'NiagaPOS',
      exportedAt: obj.exportedAt || new Date().toISOString(),
      store: obj.store,
      products: obj.products,
      movements: obj.movements,
      sales: obj.sales,
      suppliers: obj.suppliers,
      purchases: obj.purchases,
      customers: obj.customers,
      loyaltyLedger: obj.loyaltyLedger,
      staffUsers: obj.staffUsers,
    };

    return {
      isValid: true,
      data: validPayload,
      summary: {
        storeName: validPayload.store.name,
        productCount: validPayload.products.length,
        movementCount: validPayload.movements.length,
        saleCount: validPayload.sales.length,
        supplierCount: validPayload.suppliers.length,
        purchaseCount: validPayload.purchases.length,
        customerCount: validPayload.customers.length,
        staffCount: validPayload.staffUsers.length,
        exportedAt: validPayload.exportedAt,
      },
    };
  }

  /**
   * Triggers client-side browser JSON download for backup.
   */
  public static downloadBackup(payload: StoreBackupPayload): void {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const safeStoreCode = (payload.store.code || 'niagapos').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${safeStoreCode}_backup_${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Reads a user-selected File object and validates its content.
   */
  public static async parseBackupFile(file: File): Promise<ValidationResult> {
    return new Promise((resolve) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
        resolve({ isValid: false, error: 'Selected file is not a JSON file.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          const validation = StorageService.validateBackupPayload(parsed);
          resolve(validation);
        } catch (err: any) {
          resolve({ isValid: false, error: `JSON Parse Error: ${err.message || 'Corrupted file'}` });
        }
      };
      reader.onerror = () => {
        resolve({ isValid: false, error: 'Failed to read file from disk.' });
      };
      reader.readAsText(file);
    });
  }

  /**
   * Calculates local storage usage in bytes/kilobytes for health auditing.
   */
  public static getStorageAudit(): {
    totalBytes: number;
    totalKB: string;
    keysCount: number;
  } {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('niagapos_v2_') || key.startsWith('kedai_papa_'))) {
          const val = localStorage.getItem(key) || '';
          total += key.length + val.length;
        }
      }
    } catch {
      // Ignore if localStorage unavailable
    }
    return {
      totalBytes: total,
      totalKB: (total / 1024).toFixed(1),
      keysCount: Object.keys(STORAGE_KEYS).length,
    };
  }
}
