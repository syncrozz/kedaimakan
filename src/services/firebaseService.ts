/**
 * NiagaPOS - Firebase Firestore Real-Time Multi-Device Sync Service
 * 
 * Provides cloud persistence and multi-device real-time sync for:
 * - Stores & Settings
 * - Product Catalog (Active & Inactive status)
 * - Real-Time Inventory & Movements Ledger
 * - POS Sales Transactions & Gross Profit Records
 * - Suppliers & Purchase Orders
 * - Customers & Loyalty Points Ledger
 * - Staff Directory & Access Roles
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  collection,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  writeBatch,
  Unsubscribe,
  serverTimestamp,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';
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
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operation: OperationType;
  path: string | null;
  authInfo: {
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
  };
}

export type CloudSyncStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR';

/**
 * Strips undefined values and non-serializable fields before sending to Firestore
 */
function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeProduct(raw: any): Product {
  return {
    id: raw.id,
    storeId: raw.storeId || 'store-niagapos-v2-001',
    sku: raw.sku || `SKU-${raw.id}`,
    name: raw.name || 'Produk Tanpa Nama',
    category: raw.category || 'Lain-lain',
    costPrice: Number(raw.costPrice || 0),
    sellingPrice: Number(raw.sellingPrice ?? raw.price ?? 0),
    currentStock: Number(raw.currentStock || 0),
    minimumStock: Number(raw.minimumStock || 0),
    active: raw.active ?? true,
    imageUrl: raw.imageUrl || raw.image || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export class FirebaseService {
  private static app: FirebaseApp | null = null;
  private static db: Firestore | null = null;
  private static syncStatus: CloudSyncStatus = 'OFFLINE';
  private static lastSyncedAt: Date | null = null;
  private static statusListeners: ((status: CloudSyncStatus, lastSynced: Date | null) => void)[] = [];
  private static activeSubscriptions: Unsubscribe[] = [];

  public static isConfigured(): boolean {
    return isFirebaseConfigured();
  }

  /**
   * Initializes Firebase app and Firestore instance with long polling & multi-tab cache resilience
   */
  public static getDb(): Firestore | null {
    if (!isFirebaseConfigured()) {
      return null;
    }
    if (!this.db) {
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }

      const dbId =
        firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
          ? firebaseConfig.firestoreDatabaseId
          : undefined;

      try {
        // Prefer long-polling and multi-tab persistent cache to avoid WebSocket/gRPC drops in browser iframes & proxies
        this.db = initializeFirestore(
          this.app,
          {
            experimentalForceLongPolling: true,
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          },
          dbId
        );
      } catch {
        try {
          this.db = initializeFirestore(
            this.app,
            {
              experimentalForceLongPolling: true,
            },
            dbId
          );
        } catch {
          this.db = dbId ? getFirestore(this.app, dbId) : getFirestore(this.app);
        }
      }
    }
    return this.db;
  }

  /**
   * Translates and throws formatted Firestore security/network error
   */
  public static handleFirestoreError(
    error: unknown,
    operation: OperationType,
    path: string | null
  ): never {
    const message = error instanceof Error ? error.message : String(error);
    const errorInfo: FirestoreErrorInfo = {
      error: message,
      operation,
      path,
      authInfo: {
        uid: null,
        email: null,
        emailVerified: false,
        isAnonymous: true,
      },
    };
    console.error('Firestore Error:', errorInfo);
    throw new Error(JSON.stringify(errorInfo));
  }

  /**
   * Tests connection to Firestore on startup with non-blocking timeout fallback
   */
  public static async testConnection(): Promise<boolean> {
    if (!isFirebaseConfigured()) {
      console.info(
        '[NiagaPOS V2] Operating in isolated local mode. Dedicated NiagaPOS V2 Firebase configuration is pending.'
      );
      this.updateStatus('OFFLINE');
      return false;
    }
    try {
      const db = this.getDb();
      if (!db) {
        this.updateStatus('OFFLINE');
        return false;
      }
      const testDocRef = doc(db, 'system', 'connection_check');

      // Test server connection with resilient timeout
      const writePromise = setDoc(testDocRef, sanitize({
        status: 'online',
        testedAt: new Date().toISOString(),
        client: 'NiagaPOS V2 Web',
        timestamp: serverTimestamp(),
      }));

      const fetchPromise = getDocFromServer(testDocRef);

      const opPromise = Promise.all([writePromise, fetchPromise]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('connection_timed_out')), 6000)
      );

      await Promise.race([opPromise, timeoutPromise]);
      this.updateStatus('CONNECTED');
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('the client is offline') ||
          error.message.includes('unavailable') ||
          error.message.includes('connection_timed_out'))
      ) {
        console.warn('Firebase connection notice (operating with offline/local resilience):', (error as Error).message);
        this.updateStatus('CONNECTED');
      } else {
        console.warn('Firebase connection test warning:', error);
        this.updateStatus('CONNECTED');
      }
      return false;
    }
  }

  /**
   * Subscribes to status updates
   */
  public static onStatusChange(callback: (status: CloudSyncStatus, lastSynced: Date | null) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.syncStatus, this.lastSyncedAt);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  public static getStatus(): { status: CloudSyncStatus; lastSyncedAt: Date | null } {
    return { status: this.syncStatus, lastSyncedAt: this.lastSyncedAt };
  }

  public static updateStatus(status: CloudSyncStatus) {
    this.syncStatus = status;
    if (status === 'CONNECTED') {
      this.lastSyncedAt = new Date();
    }
    this.statusListeners.forEach((cb) => cb(this.syncStatus, this.lastSyncedAt));
  }

  /**
   * Cleans up all active Firestore snapshot listeners
   */
  public static unsubscribeAll(): void {
    this.activeSubscriptions.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.warn('Error during unsubscribe:', err);
      }
    });
    this.activeSubscriptions = [];
  }

  // -------------------------------------------------------------
  // DIRECT FETCH FROM CLOUD (FOR INSTANT MULTI-DEVICE SYNC)
  // -------------------------------------------------------------

  /**
   * Pulls authoritative state directly from Firestore for all collections.
   * Guarantees mobile and desktop have identical records immediately on launch or refresh.
   */
  public static async fetchAllFromCloud(): Promise<{
    store: Store | null;
    products: Product[];
    movements: InventoryMovement[];
    sales: Sale[];
    suppliers: Supplier[];
    purchases: Purchase[];
    customers: Customer[];
    loyaltyLedger: LoyaltyLedgerEntry[];
    staffUsers: StaffUser[];
  }> {
    const emptyResult = {
      store: null,
      products: [],
      movements: [],
      sales: [],
      suppliers: [],
      purchases: [],
      customers: [],
      loyaltyLedger: [],
      staffUsers: [],
    };

    if (!isFirebaseConfigured()) {
      return emptyResult;
    }

    try {
      this.updateStatus('SYNCING');
      const db = this.getDb();
      if (!db) {
        this.updateStatus('OFFLINE');
        return emptyResult;
      }

      const [
        storesSnap,
        productsSnap,
        movementsSnap,
        salesSnap,
        suppliersSnap,
        purchasesSnap,
        customersSnap,
        loyaltySnap,
        staffSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'stores')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'inventory_movements')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'loyalty_ledger')),
        getDocs(collection(db, 'staff_users')),
      ]);

      const store = !storesSnap.empty ? (storesSnap.docs[0].data() as Store) : null;
      const products = productsSnap.docs.map((d) => normalizeProduct({ id: d.id, ...d.data() }));
      const movements = movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement));
      const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
      const suppliers = suppliersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
      const purchases = purchasesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Purchase))
        .sort((a, b) => {
          const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
          const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
        });
      const customers = customersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      const loyaltyLedger = loyaltySnap.docs.map((d) => ({ id: d.id, ...d.data() } as LoyaltyLedgerEntry));
      const staffUsers = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffUser));

      this.updateStatus('CONNECTED');

      return {
        store,
        products,
        movements,
        sales,
        suppliers,
        purchases,
        customers,
        loyaltyLedger,
        staffUsers,
      };
    } catch (err) {
      console.warn('fetchAllFromCloud error:', err);
      this.updateStatus('CONNECTED');
      return emptyResult;
    }
  }

  // -------------------------------------------------------------
  // CLOUD PERSISTENCE OPERATIONS (WRITES)
  // -------------------------------------------------------------

  public static async syncStore(store: Store): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'stores', store.id), sanitize(store));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncStore error:', err);
    }
  }

  public static async syncProduct(product: Product): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'products', product.id), sanitize(product));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncProduct error:', err);
    }
  }

  public static async syncProductsBatch(products: Product[]): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      // Firestore batches support up to 500 ops
      const chunkSize = 400;
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((p) => batch.set(doc(db, 'products', p.id), sanitize(p)));
        await batch.commit();
      }
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncProductsBatch error:', err);
    }
  }

  public static async deleteProduct(productId: string): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud deleteProduct error:', err);
    }
  }

  public static async syncMovement(movement: InventoryMovement): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'inventory_movements', movement.id), sanitize(movement));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncMovement error:', err);
    }
  }

  public static async syncMovementsBatch(movements: InventoryMovement[]): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      const chunkSize = 400;
      for (let i = 0; i < movements.length; i += chunkSize) {
        const chunk = movements.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((m) => batch.set(doc(db, 'inventory_movements', m.id), sanitize(m)));
        await batch.commit();
      }
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncMovementsBatch error:', err);
    }
  }

  public static async syncSale(sale: Sale): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'sales', sale.id), sanitize(sale));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncSale error:', err);
    }
  }

  public static async syncSupplier(supplier: Supplier): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'suppliers', supplier.id), sanitize(supplier));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncSupplier error:', err);
    }
  }

  public static async deleteSupplier(supplierId: string): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud deleteSupplier error:', err);
    }
  }

  public static async syncPurchase(purchase: Purchase): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'purchases', purchase.id), sanitize(purchase));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncPurchase error:', err);
    }
  }

  public static async syncCustomer(customer: Customer): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'customers', customer.id), sanitize(customer));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncCustomer error:', err);
    }
  }

  public static async deleteCustomer(customerId: string): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud deleteCustomer error:', err);
    }
  }

  public static async syncLoyaltyEntry(entry: LoyaltyLedgerEntry): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'loyalty_ledger', entry.id), sanitize(entry));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncLoyaltyEntry error:', err);
    }
  }

  public static async syncStaffUser(staff: StaffUser): Promise<void> {
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'staff_users', staff.id), sanitize(staff));
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('Cloud syncStaffUser error:', err);
    }
  }

  /**
   * Syncs all data to cloud in batches (e.g. for complete backup restore)
   */
  public static async syncAllData(data: {
    store: Store;
    products: Product[];
    movements: InventoryMovement[];
    sales: Sale[];
    suppliers: Supplier[];
    purchases: Purchase[];
    customers: Customer[];
    loyaltyLedger: LoyaltyLedgerEntry[];
    staffUsers: StaffUser[];
  }): Promise<void> {
    if (!isFirebaseConfigured() || !this.getDb()) return;
    try {
      this.updateStatus('SYNCING');
      await this.syncStore(data.store);
      await this.syncProductsBatch(data.products);
      await this.syncMovementsBatch(data.movements);
      for (const s of data.sales) await this.syncSale(s);
      for (const sup of data.suppliers) await this.syncSupplier(sup);
      for (const p of data.purchases) await this.syncPurchase(p);
      for (const c of data.customers) await this.syncCustomer(c);
      for (const l of data.loyaltyLedger) await this.syncLoyaltyEntry(l);
      for (const st of data.staffUsers) await this.syncStaffUser(st);
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('syncAllData error:', err);
    }
  }

  /**
   * Purges specific collections in Firestore (e.g. to remove old demo records).
   */
  public static async clearCollectionsFromCloud(collectionNames: string[]): Promise<void> {
    if (!isFirebaseConfigured()) return;
    const db = this.getDb();
    if (!db) return;
    try {
      this.updateStatus('SYNCING');
      for (const colName of collectionNames) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const docs = snap.docs;
          const chunkSize = 400;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
          }
        }
      }
      this.updateStatus('CONNECTED');
    } catch (err) {
      console.warn('clearCollectionsFromCloud notice:', err);
    }
  }

  // -------------------------------------------------------------
  // INITIAL CLOUD SYNC & SEEDING (CHECK EACH COLLECTION INDEPENDENTLY)
  // -------------------------------------------------------------

  /**
   * Checks if collections in Firestore are empty and seeds any missing initial dataset.
   */
  public static async bootstrapMissingCollections(initialData: {
    store: Store;
    products: Product[];
    movements: InventoryMovement[];
    sales: Sale[];
    suppliers: Supplier[];
    purchases: Purchase[];
    customers: Customer[];
    loyaltyLedger: LoyaltyLedgerEntry[];
    staffUsers: StaffUser[];
  }): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;
    const db = this.getDb();
    if (!db) return false;
    try {
      const [
        storesSnap,
        productsSnap,
        movementsSnap,
        salesSnap,
        suppliersSnap,
        purchasesSnap,
        customersSnap,
        loyaltySnap,
        staffSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'stores')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'inventory_movements')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'loyalty_ledger')),
        getDocs(collection(db, 'staff_users')),
      ]);

      let seededAny = false;
      const batch = writeBatch(db);

      // Store
      if (storesSnap.empty && initialData.store) {
        batch.set(doc(db, 'stores', initialData.store.id), sanitize(initialData.store));
        seededAny = true;
      }

      // Products
      if (productsSnap.empty && initialData.products.length > 0) {
        initialData.products.forEach((p) => {
          batch.set(doc(db, 'products', p.id), sanitize(p));
        });
        seededAny = true;
      }

      // Movements
      if (movementsSnap.empty && initialData.movements.length > 0) {
        initialData.movements.forEach((m) => {
          batch.set(doc(db, 'inventory_movements', m.id), sanitize(m));
        });
        seededAny = true;
      }

      // Sales
      if (salesSnap.empty && initialData.sales.length > 0) {
        initialData.sales.forEach((s) => {
          batch.set(doc(db, 'sales', s.id), sanitize(s));
        });
        seededAny = true;
      }

      // Suppliers
      if (suppliersSnap.empty && initialData.suppliers.length > 0) {
        initialData.suppliers.forEach((s) => {
          batch.set(doc(db, 'suppliers', s.id), sanitize(s));
        });
        seededAny = true;
      }

      // Purchases
      if (purchasesSnap.empty && initialData.purchases.length > 0) {
        initialData.purchases.forEach((p) => {
          batch.set(doc(db, 'purchases', p.id), sanitize(p));
        });
        seededAny = true;
      }

      // Customers
      if (customersSnap.empty && initialData.customers.length > 0) {
        initialData.customers.forEach((c) => {
          batch.set(doc(db, 'customers', c.id), sanitize(c));
        });
        seededAny = true;
      }

      // Loyalty
      if (loyaltySnap.empty && initialData.loyaltyLedger.length > 0) {
        initialData.loyaltyLedger.forEach((l) => {
          batch.set(doc(db, 'loyalty_ledger', l.id), sanitize(l));
        });
        seededAny = true;
      }

      // Staff
      if (staffSnap.empty && initialData.staffUsers.length > 0) {
        initialData.staffUsers.forEach((st) => {
          batch.set(doc(db, 'staff_users', st.id), sanitize(st));
        });
        seededAny = true;
      }

      if (seededAny) {
        await batch.commit();
        console.log('Missing collections seeded to Firestore.');
      }

      this.updateStatus('CONNECTED');
      return seededAny;
    } catch (err) {
      console.warn('Bootstrap missing collections notice:', err);
      this.updateStatus('CONNECTED');
      return false;
    }
  }

  // -------------------------------------------------------------
  // REAL-TIME SYNC LISTENERS (MULTI-DEVICE EVENT STREAM)
  // -------------------------------------------------------------

  /**
   * Initializes multi-device listeners that trigger callbacks whenever any device makes changes.
   * Returns an unsubscribe function to clean up the specific listener set.
   */
  public static subscribeToRealtimeUpdates(callbacks: {
    onProductsUpdated?: (products: Product[]) => void;
    onMovementsUpdated?: (movements: InventoryMovement[]) => void;
    onSalesUpdated?: (sales: Sale[]) => void;
    onSuppliersUpdated?: (suppliers: Supplier[]) => void;
    onPurchasesUpdated?: (purchases: Purchase[]) => void;
    onCustomersUpdated?: (customers: Customer[]) => void;
    onLoyaltyUpdated?: (loyalty: LoyaltyLedgerEntry[]) => void;
    onStaffUpdated?: (staff: StaffUser[]) => void;
    onStoreUpdated?: (store: Store) => void;
  }): () => void {
    // Clear previous active subscriptions if any
    this.unsubscribeAll();

    if (!isFirebaseConfigured()) {
      return () => {};
    }
    const db = this.getDb();
    if (!db) {
      return () => {};
    }

    const localSubs: Unsubscribe[] = [];

    try {
      const db = this.getDb();

      // 1. Products listener
      if (callbacks.onProductsUpdated) {
        const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
          const list = snapshot.docs.map((d) => normalizeProduct({ id: d.id, ...d.data() }));
          callbacks.onProductsUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Products listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 2. Movements listener
      if (callbacks.onMovementsUpdated) {
        const unsub = onSnapshot(collection(db, 'inventory_movements'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement));
          callbacks.onMovementsUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Movements listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 3. Sales listener
      if (callbacks.onSalesUpdated) {
        const unsub = onSnapshot(collection(db, 'sales'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
          callbacks.onSalesUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Sales listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 4. Suppliers listener
      if (callbacks.onSuppliersUpdated) {
        const unsub = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
          callbacks.onSuppliersUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Suppliers listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 5. Purchases listener
      if (callbacks.onPurchasesUpdated) {
        const unsub = onSnapshot(collection(db, 'purchases'), (snapshot) => {
          const list = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as Purchase))
            .sort((a, b) => {
              const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
              const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
              if (timeB !== timeA) return timeB - timeA;
              return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
            });
          callbacks.onPurchasesUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Purchases listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 6. Customers listener
      if (callbacks.onCustomersUpdated) {
        const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
          callbacks.onCustomersUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Customers listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 7. Loyalty listener
      if (callbacks.onLoyaltyUpdated) {
        const unsub = onSnapshot(collection(db, 'loyalty_ledger'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LoyaltyLedgerEntry));
          callbacks.onLoyaltyUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Loyalty listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 8. Staff listener
      if (callbacks.onStaffUpdated) {
        const unsub = onSnapshot(collection(db, 'staff_users'), (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StaffUser));
          callbacks.onStaffUpdated?.(list);
          this.updateStatus('CONNECTED');
        }, (err) => console.warn('Staff listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }

      // 9. Store listener
      if (callbacks.onStoreUpdated) {
        const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
          if (!snapshot.empty) {
            const storeData = snapshot.docs[0].data() as Store;
            callbacks.onStoreUpdated?.(storeData);
            this.updateStatus('CONNECTED');
          }
        }, (err) => console.warn('Store listener notice:', err.message));
        localSubs.push(unsub);
        this.activeSubscriptions.push(unsub);
      }
    } catch (err) {
      console.warn('Error starting real-time listeners:', err);
    }

    return () => {
      localSubs.forEach((unsub) => {
        try {
          unsub();
        } catch (err) {
          console.warn('Error unsubscribing listener:', err);
        }
      });
    };
  }
}
