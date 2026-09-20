/**
 * NiagaPOS - Store Context & State Management
 * Part 01: Foundation & Application Architecture
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Store,
  Product,
  InventoryMovement,
  Sale,
  CartItem,
  UserProfile,
  Supplier,
  Purchase,
  Customer,
  LoyaltyLedgerEntry,
  StaffUser,
  StoreBackupPayload,
  CommitUpsertPayload,
  UpsertImportCommitResult,
  MasterCatalogSyncPayload,
  MasterCatalogSyncCommitResult,
  LastCatalogSyncInfo,
} from '../types';
import {
  INITIAL_STORE,
  INITIAL_PRODUCTS,
  INITIAL_MOVEMENTS,
  INITIAL_SALES,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
  INITIAL_CUSTOMERS,
  INITIAL_LOYALTY_LEDGER,
  INITIAL_STAFF,
} from '../services/seedData';
import { InventoryService } from '../services/inventoryService';
import { SalesService, ProcessSaleOptions } from '../services/salesService';
import { SupplierService, CreateSupplierInput, UpdateSupplierInput } from '../services/supplierService';
import { PurchasingService, CreatePurchaseInput, CompletePurchaseResult } from '../services/purchasingService';
import { CustomerService, CreateCustomerInput, UpdateCustomerInput } from '../services/customerService';
import { LoyaltyService } from '../services/loyaltyService';
import { StaffService, CreateStaffInput, UpdateStaffInput } from '../services/staffService';
import { SmartInputService } from '../services/smartInputService';
import { ProductService, ProductDeleteEligibility } from '../services/productService';
import {
  StorageService,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
} from '../services/storageService';
import { AdminAuthService } from '../services/adminAuthService';
import { AdminPinModal } from '../components/common/AdminPinModal';
import { FirebaseService, CloudSyncStatus } from '../services/firebaseService';
import { parseRoute } from '../services/urlRouter';
import {
  MenuItem,
  RestaurantTaxConfig,
  RestaurantTable,
  TableStatus,
  TableReservation,
  TableStatusAuditEntry,
  RestaurantActiveOrderSummary,
  BusinessConfiguration,
  BusinessTemplateId,
} from '../types/restaurant';
import { MenuService, DEFAULT_TAX_CONFIG } from '../services/menuService';
import { TableService } from '../services/tableService';
import { TemplateService } from '../services/templateService';

export interface ClearCategoriesOptions {
  products?: boolean;
  suppliers?: boolean;
  customers?: boolean;
  staff?: boolean;
}

interface StoreContextType {
  store: Store;
  currentUser: UserProfile;
  products: Product[];
  movements: InventoryMovement[];
  sales: Sale[];
  suppliers: Supplier[];
  purchases: Purchase[];
  customers: Customer[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  staffUsers: StaffUser[];
  activeStaff: StaffUser | null;
  isLoading: boolean;
  // Multi-Device Cloud Sync (Firebase Firestore)
  cloudSyncStatus: CloudSyncStatus;
  lastCloudSync: Date | null;
  syncAllToCloud: () => Promise<void>;
  pullAllFromCloud: () => Promise<boolean>;
  // Admin Mode Controls (Part A & Part J)
  isAdminMode: boolean;
  isPinModalOpen: boolean;
  openPinModal: (description?: string, onApproved?: () => void) => void;
  closePinModal: () => void;
  enterAdminMode: (pin: string) => { success: boolean; error?: string };
  exitAdminMode: () => void;
  requireAdmin: (action: () => void, description?: string) => void;
  // Core Domain Operations
  addProduct: (newProduct: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>) => Product;
  importProducts: (newProducts: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[]) => number;
  commitProductsUpsertImport: (payload: CommitUpsertPayload) => UpsertImportCommitResult;
  commitMasterCatalogSync: (payload: MasterCatalogSyncPayload) => MasterCatalogSyncCommitResult;
  lastCatalogSyncInfo: LastCatalogSyncInfo | null;
  updateProduct: (id: string, updates: Partial<Product>) => Product;
  toggleProductActive: (id: string) => void;
  deleteProduct: (
    id: string,
    confirmWithStock?: boolean
  ) => { success: boolean; message: string; action?: 'DELETED' | 'BLOCKED' };
  deactivateProduct: (id: string) => { success: boolean; message: string };
  checkProductDeleteEligibility: (id: string) => ProductDeleteEligibility;
  isSkuAvailable: (sku: string, excludeProductId?: string) => boolean;
  recordStockIn: (productId: string, quantity: number, reason: string, referenceId?: string) => void;
  recordAdjustment: (productId: string, quantityChange: number, reason: string) => void;
  recordReturn: (productId: string, quantity: number, reason: string, referenceId?: string) => void;
  processSale: (
    cartItems: CartItem[],
    optionsOrDiscount?: number | ProcessSaleOptions,
    notes?: string
  ) => Sale;
  // Supplier & Purchasing Domain Operations (Part 05)
  addSupplier: (input: CreateSupplierInput) => Supplier;
  updateSupplier: (id: string, updates: UpdateSupplierInput) => Supplier;
  toggleSupplierActive: (id: string) => void;
  deleteSupplier: (id: string) => { success: boolean; message: string };
  isSupplierCodeAvailable: (code: string, excludeId?: string) => boolean;
  commitSuppliersUpsertImport: (payload: {
    newItems: CreateSupplierInput[];
    updateItems: { id: string; updates: UpdateSupplierInput }[];
  }) => { added: number; updated: number };
  createPurchase: (input: CreatePurchaseInput) => Purchase;
  completePurchase: (purchaseId: string, preloadedPurchase?: Purchase) => CompletePurchaseResult;
  createAndCompletePurchase: (input: CreatePurchaseInput) => CompletePurchaseResult;
  cancelPurchase: (purchaseId: string, preloadedPurchase?: Purchase) => Purchase;
  // Customer & Loyalty Domain Operations (Part 07)
  addCustomer: (input: CreateCustomerInput) => Customer;
  updateCustomer: (id: string, updates: UpdateCustomerInput) => Customer;
  toggleCustomerActive: (id: string) => void;
  deleteCustomer: (id: string) => { success: boolean; message: string };
  isCustomerCodeAvailable: (code: string, excludeId?: string) => boolean;
  commitCustomersUpsertImport: (payload: {
    newItems: CreateCustomerInput[];
    updateItems: { id: string; updates: UpdateCustomerInput }[];
  }) => { added: number; updated: number };
  awardLoyaltyPoints: (sale: Sale, customerId: string) => LoyaltyLedgerEntry | null;
  redeemLoyaltyPoints: (customerId: string, points: number, referenceId: string, description?: string) => LoyaltyLedgerEntry;
  // Staff Operations (Part 07)
  addStaff: (input: CreateStaffInput) => StaffUser;
  updateStaff: (id: string, updates: UpdateStaffInput) => StaffUser;
  toggleStaffActive: (id: string) => void;
  setActiveStaff: (staff: StaffUser | null) => void;
  commitStaffUpsertImport: (payload: {
    newItems: CreateStaffInput[];
    updateItems: { id: string; updates: UpdateStaffInput }[];
  }) => { added: number; updated: number };
  resetToDemo: () => void;
  clearAllStoreData: () => Promise<{ success: boolean; message: string }>;
  clearStoreCategories: (options: ClearCategoriesOptions) => Promise<{ success: boolean; message: string }>;
  updateStoreDetails: (details: Partial<Store>) => void;
  updateStore: (details: Partial<Store>) => void;
  // Backup & Recovery Operations (Part 08)
  exportStoreData: () => StoreBackupPayload;
  downloadBackup: () => void;
  restoreStoreData: (payload: StoreBackupPayload) => { success: boolean; message: string };
  // SYNCROZZ KEDAI MAKAN - Business Template & Flexible Configuration (SES v4.5)
  businessConfig: BusinessConfiguration;
  updateBusinessConfig: (config: BusinessConfiguration) => void;
  applyBusinessTemplate: (
    templateId: BusinessTemplateId,
    options?: { loadSampleMenu?: boolean; resetExistingMenu?: boolean; updateTableMode?: boolean }
  ) => void;
  refreshBusinessConfig: () => void;
  // SYNCROZZ KEDAI MAKAN - Restaurant Menu Operations (Fasa 2 - SES v4.5)
  menuItems: MenuItem[];
  menuCategories: string[];
  taxConfig: RestaurantTaxConfig;
  toggleMenuItemAvailability: (menuItemId: string) => void;
  saveMenuItem: (itemData: Partial<MenuItem> & { name: string; price: number; category: string }) => void;
  deleteMenuItem: (menuItemId: string) => void;
  updateTaxConfig: (config: RestaurantTaxConfig) => void;
  // SYNCROZZ KEDAI MAKAN - Table Management & Reservation (Fasa 3 - Langkah 1)
  tables: RestaurantTable[];
  reservations: TableReservation[];
  tableAuditLogs: TableStatusAuditEntry[];
  updateTableStatus: (
    tableId: string,
    newStatus: TableStatus,
    reason?: string,
    orderSummary?: RestaurantActiveOrderSummary
  ) => void;
  bindActiveOrderToTable: (tableNumber: string, orderSummary: RestaurantActiveOrderSummary) => void;
  saveTableDefinition: (
    tableData: Partial<RestaurantTable> & { tableNumber: string; capacity: number; zone: string }
  ) => void;
  deleteTableDefinition: (tableId: string) => void;
  addTableReservation: (
    input: Omit<TableReservation, 'id' | 'createdAt' | 'updatedAt' | 'storeId'>
  ) => void;
  updateReservationStatus: (
    reservationId: string,
    newStatus: 'SEATED' | 'CANCELLED' | 'NO_SHOW'
  ) => void;
  refreshTablesData: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ensure schema version is stamped on initialization
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
    } catch {
      // Ignore if localStorage unavailable
    }
  }, []);

  const [store, setStore] = useState<Store>(() => {
    const loaded = StorageService.safeParse<Store>(
      localStorage.getItem(STORAGE_KEYS.STORE),
      INITIAL_STORE,
      (val) => !!val && typeof val === 'object' && !Array.isArray(val) && !!(val as any).id
    );
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    if (!currentRoute.workspaceSlug && loaded.name !== 'NiagaPOS') {
      const updated = { ...loaded, name: 'NiagaPOS', code: 'NP-01' };
      try {
        localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    }
    return loaded;
  });

  // Current primary role: Admin / Store Owner (foundation ready for future roles)
  const [currentUser] = useState<UserProfile>({
    id: 'user-owner-001',
    name: 'Store Owner',
    role: 'ADMIN',
    storeId: INITIAL_STORE.id,
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const loaded = StorageService.safeParse<Product[]>(
      localStorage.getItem(STORAGE_KEYS.PRODUCTS),
      INITIAL_PRODUCTS,
      (val) => Array.isArray(val)
    );
    // Tally cached products with verified catalog updates (e.g. MAGGI HOT CUP Selling Price RM3.00)
    return loaded.map((p) => {
      const seedMatch = INITIAL_PRODUCTS.find((init) => init.sku === p.sku);
      if (
        seedMatch &&
        (p.name !== seedMatch.name ||
          p.sellingPrice !== seedMatch.sellingPrice ||
          p.costPrice !== seedMatch.costPrice)
      ) {
        if (
          p.sku.startsWith('KP-MAGGI-') ||
          (p.costPrice === p.sellingPrice && seedMatch.costPrice !== seedMatch.sellingPrice)
        ) {
          return {
            ...p,
            name: seedMatch.name,
            costPrice: seedMatch.costPrice,
            sellingPrice: seedMatch.sellingPrice,
            currentStock: seedMatch.currentStock,
            minimumStock: seedMatch.minimumStock,
          };
        }
      }
      return p;
    });
  });

  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    return StorageService.safeParse<InventoryMovement[]>(
      localStorage.getItem(STORAGE_KEYS.MOVEMENTS),
      INITIAL_MOVEMENTS,
      (val) => Array.isArray(val)
    );
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    return StorageService.safeParse<Sale[]>(
      localStorage.getItem(STORAGE_KEYS.SALES),
      INITIAL_SALES,
      (val) => Array.isArray(val)
    );
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    return StorageService.safeParse<Supplier[]>(
      localStorage.getItem(STORAGE_KEYS.SUPPLIERS),
      INITIAL_SUPPLIERS,
      (val) => Array.isArray(val)
    );
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    const list = StorageService.safeParse<Purchase[]>(
      localStorage.getItem(STORAGE_KEYS.PURCHASES),
      INITIAL_PURCHASES,
      (val) => Array.isArray(val) && val.length > 0
    );
    return [...list].sort((a, b) => {
      const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
      const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
    });
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    return StorageService.safeParse<Customer[]>(
      localStorage.getItem(STORAGE_KEYS.CUSTOMERS),
      INITIAL_CUSTOMERS,
      (val) => Array.isArray(val)
    );
  });

  const [loyaltyLedger, setLoyaltyLedger] = useState<LoyaltyLedgerEntry[]>(() => {
    return StorageService.safeParse<LoyaltyLedgerEntry[]>(
      localStorage.getItem(STORAGE_KEYS.LOYALTY),
      INITIAL_LOYALTY_LEDGER,
      (val) => Array.isArray(val)
    );
  });

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => {
    const loaded = StorageService.safeParse<StaffUser[]>(
      localStorage.getItem(STORAGE_KEYS.STAFF),
      INITIAL_STAFF,
      (val) => Array.isArray(val)
    );
    const sanitized = loaded.map((s) =>
      s.name.toLowerCase().includes('pak samad') || s.name.toLowerCase().includes('samad')
        ? { ...s, name: 'Pemilik Kedai' }
        : s
    );
    if (JSON.stringify(loaded) !== JSON.stringify(sanitized)) {
      try {
        localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(sanitized));
      } catch {
        // ignore
      }
    }
    return sanitized;
  });

  const [activeStaff, setActiveStaff] = useState<StaffUser | null>(() => {
    const savedStaff = StorageService.safeParse<StaffUser[]>(
      localStorage.getItem(STORAGE_KEYS.STAFF),
      INITIAL_STAFF,
      (val) => Array.isArray(val)
    );
    const sanitizedStaff = savedStaff.map((s) =>
      s.name.toLowerCase().includes('pak samad') || s.name.toLowerCase().includes('samad')
        ? { ...s, name: 'Pemilik Kedai' }
        : s
    );
    const activeCashiers = StaffService.getActiveCashiers(sanitizedStaff);
    if (activeCashiers.length === 0) {
      return null;
    }
    const savedStore = StorageService.safeParse<Store>(
      localStorage.getItem(STORAGE_KEYS.STORE),
      INITIAL_STORE,
      (val) => !!val && typeof val === 'object'
    );
    const savedCashierId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CASHIER_ID);
    if (savedCashierId === 'store-owner') {
      return null;
    }
    if (savedCashierId) {
      const match = activeCashiers.find((s) => s.id === savedCashierId);
      if (match) return match;
    }
    const adminDefaultCashierId = savedStore?.settings?.defaultCashierId;
    if (adminDefaultCashierId && adminDefaultCashierId !== 'store-owner') {
      const defaultMatch = activeCashiers.find((c) => c.id === adminDefaultCashierId);
      if (defaultMatch) return defaultMatch;
    }
    // Default Cashier = Store Owner (null)
    return null;
  });

  const [lastCatalogSyncInfo, setLastCatalogSyncInfo] = useState<LastCatalogSyncInfo | null>(() => {
    return StorageService.safeGet<LastCatalogSyncInfo | null>(STORAGE_KEYS.LAST_SYNC_METADATA, null);
  });

  const [isLoading, setIsLoading] = useState(false);

  // Synchronized refs to eliminate race conditions and stale closures
  const purchasesRef = useRef<Purchase[]>(purchases);
  purchasesRef.current = purchases;

  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  const suppliersRef = useRef<Supplier[]>(suppliers);
  suppliersRef.current = suppliers;

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOYALTY, JSON.stringify(loyaltyLedger));
  }, [loyaltyLedger]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffUsers));
  }, [staffUsers]);

  useEffect(() => {
    if (activeStaff) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CASHIER_ID, activeStaff.id);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CASHIER_ID, 'store-owner');
    }
  }, [activeStaff]);

  useEffect(() => {
    if (activeStaff) {
      const isStillActiveCashier = staffUsers.some(
        (s) => s.id === activeStaff.id && s.active && s.role === 'CASHIER'
      );
      if (!isStillActiveCashier) {
        const remainingCashiers = StaffService.getActiveCashiers(staffUsers);
        const adminDefaultCashierId = store.settings?.defaultCashierId;
        const defaultMatch =
          adminDefaultCashierId && adminDefaultCashierId !== 'store-owner'
            ? remainingCashiers.find((c) => c.id === adminDefaultCashierId)
            : null;
        setActiveStaff(defaultMatch || null);
      }
    }
  }, [staffUsers, activeStaff]);

  // Multi-Device Cloud Sync State & Real-time Integration
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('SYNCING');
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);

  const isMountedRef = useRef(true);

  const pullAllFromCloud = async (): Promise<boolean> => {
    setCloudSyncStatus('SYNCING');
    try {
      const cloudData = await FirebaseService.fetchAllFromCloud();
      if (cloudData.products && cloudData.products.length > 0) {
        setProducts(cloudData.products);
        StorageService.safeSet(STORAGE_KEYS.PRODUCTS, cloudData.products);
      }
      if (cloudData.store) {
        setStore(cloudData.store);
        StorageService.safeSet(STORAGE_KEYS.STORE, cloudData.store);
      }
      if (cloudData.movements && cloudData.movements.length > 0) {
        setMovements(cloudData.movements);
        StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, cloudData.movements);
      }
      if (cloudData.sales && cloudData.sales.length > 0) {
        setSales(cloudData.sales);
        StorageService.safeSet(STORAGE_KEYS.SALES, cloudData.sales);
      }
      if (cloudData.suppliers && cloudData.suppliers.length > 0) {
        setSuppliers(cloudData.suppliers);
        StorageService.safeSet(STORAGE_KEYS.SUPPLIERS, cloudData.suppliers);
      }
      if (cloudData.purchases && cloudData.purchases.length > 0) {
        const sortedPurchases = [...cloudData.purchases].sort((a, b) => {
          const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
          const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
        });
        setPurchases(sortedPurchases);
        StorageService.safeSet(STORAGE_KEYS.PURCHASES, sortedPurchases);
      }
      if (cloudData.customers && cloudData.customers.length > 0) {
        setCustomers(cloudData.customers);
        StorageService.safeSet(STORAGE_KEYS.CUSTOMERS, cloudData.customers);
      }
      if (cloudData.loyaltyLedger && cloudData.loyaltyLedger.length > 0) {
        setLoyaltyLedger(cloudData.loyaltyLedger);
        StorageService.safeSet(STORAGE_KEYS.LOYALTY, cloudData.loyaltyLedger);
      }
      if (cloudData.staffUsers && cloudData.staffUsers.length > 0) {
        const sanitized = StaffService.sanitizeStaffMembers(cloudData.staffUsers);
        setStaffUsers(sanitized);
        StorageService.safeSet(STORAGE_KEYS.STAFF, sanitized);
      }
      setLastCloudSync(new Date());
      return true;
    } catch (err) {
      console.warn('Pull all from cloud notice:', err);
      setCloudSyncStatus('CONNECTED');
      return false;
    }
  };

  const syncAllToCloud = async () => {
    setCloudSyncStatus('SYNCING');
    try {
      await FirebaseService.syncAllData({
        store,
        products,
        movements,
        sales,
        suppliers,
        purchases,
        customers,
        loyaltyLedger,
        staffUsers,
      });
      setCloudSyncStatus('CONNECTED');
      setLastCloudSync(new Date());
    } catch (err) {
      console.warn('Manual cloud sync notice:', err);
      setCloudSyncStatus('CONNECTED');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    let unsubStatus: (() => void) | undefined;
    let unsubRealtime: (() => void) | undefined;

    async function initCloudSync() {
      unsubStatus = FirebaseService.onStatusChange((status, lastSynced) => {
        if (!isMountedRef.current) return;
        setCloudSyncStatus(status);
        setLastCloudSync(lastSynced);
      });

      // 1. Validate connection to Firestore
      await FirebaseService.testConnection();

      // 2. Bootstrap any missing collections
      await FirebaseService.bootstrapMissingCollections({
        store,
        products,
        movements,
        sales,
        suppliers,
        purchases,
        customers,
        loyaltyLedger,
        staffUsers,
      });

      // 3. Immediately pull latest authoritative data from Firestore
      // This guarantees that mobile devices immediately load the exact same data as desktop on launch!
      const cloudData = await FirebaseService.fetchAllFromCloud();
      if (!isMountedRef.current) return;

      if (cloudData.products && cloudData.products.length > 0) {
        setProducts(cloudData.products);
        StorageService.safeSet(STORAGE_KEYS.PRODUCTS, cloudData.products);
      }
      if (cloudData.store) {
        setStore(cloudData.store);
        StorageService.safeSet(STORAGE_KEYS.STORE, cloudData.store);
      }
      if (cloudData.movements && cloudData.movements.length > 0) {
        setMovements(cloudData.movements);
        StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, cloudData.movements);
      }
      if (cloudData.sales && cloudData.sales.length > 0) {
        setSales(cloudData.sales);
        StorageService.safeSet(STORAGE_KEYS.SALES, cloudData.sales);
      }
      if (cloudData.suppliers && cloudData.suppliers.length > 0) {
        setSuppliers(cloudData.suppliers);
        StorageService.safeSet(STORAGE_KEYS.SUPPLIERS, cloudData.suppliers);
      }
      if (cloudData.purchases && cloudData.purchases.length > 0) {
        const sortedPurchases = [...cloudData.purchases].sort((a, b) => {
          const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
          const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
        });
        setPurchases(sortedPurchases);
        StorageService.safeSet(STORAGE_KEYS.PURCHASES, sortedPurchases);
      }
      if (cloudData.customers && cloudData.customers.length > 0) {
        setCustomers(cloudData.customers);
        StorageService.safeSet(STORAGE_KEYS.CUSTOMERS, cloudData.customers);
      }
      if (cloudData.loyaltyLedger && cloudData.loyaltyLedger.length > 0) {
        setLoyaltyLedger(cloudData.loyaltyLedger);
        StorageService.safeSet(STORAGE_KEYS.LOYALTY, cloudData.loyaltyLedger);
      }
      if (cloudData.staffUsers && cloudData.staffUsers.length > 0) {
        const sanitized = StaffService.sanitizeStaffMembers(cloudData.staffUsers);
        setStaffUsers(sanitized);
        StorageService.safeSet(STORAGE_KEYS.STAFF, sanitized);
      }

      // 4. Real-time listener: receive updates instantly when any device updates data
      unsubRealtime = FirebaseService.subscribeToRealtimeUpdates({
        onProductsUpdated: (remoteProducts) => {
          if (!isMountedRef.current || !remoteProducts || remoteProducts.length === 0) return;
          setProducts(remoteProducts);
          StorageService.safeSet(STORAGE_KEYS.PRODUCTS, remoteProducts);
        },
        onMovementsUpdated: (remoteMovements) => {
          if (!isMountedRef.current || !remoteMovements) return;
          setMovements(remoteMovements);
          StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, remoteMovements);
        },
        onSalesUpdated: (remoteSales) => {
          if (!isMountedRef.current || !remoteSales) return;
          setSales(remoteSales);
          StorageService.safeSet(STORAGE_KEYS.SALES, remoteSales);
        },
        onSuppliersUpdated: (remoteSuppliers) => {
          if (!isMountedRef.current || !remoteSuppliers) return;
          setSuppliers(remoteSuppliers);
          StorageService.safeSet(STORAGE_KEYS.SUPPLIERS, remoteSuppliers);
        },
        onPurchasesUpdated: (remotePurchases) => {
          if (!isMountedRef.current || !remotePurchases) return;
          if (remotePurchases.length === 0) return;
          const sortedPurchases = [...remotePurchases].sort((a, b) => {
            const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
            const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
          });
          setPurchases(sortedPurchases);
          StorageService.safeSet(STORAGE_KEYS.PURCHASES, sortedPurchases);
        },
        onCustomersUpdated: (remoteCustomers) => {
          if (!isMountedRef.current || !remoteCustomers) return;
          setCustomers(remoteCustomers);
          StorageService.safeSet(STORAGE_KEYS.CUSTOMERS, remoteCustomers);
        },
        onLoyaltyUpdated: (remoteLoyalty) => {
          if (!isMountedRef.current || !remoteLoyalty) return;
          setLoyaltyLedger(remoteLoyalty);
          StorageService.safeSet(STORAGE_KEYS.LOYALTY, remoteLoyalty);
        },
        onStaffUpdated: (remoteStaff) => {
          if (!isMountedRef.current || !remoteStaff) return;
          const sanitized = StaffService.sanitizeStaffMembers(remoteStaff);
          setStaffUsers(sanitized);
          StorageService.safeSet(STORAGE_KEYS.STAFF, sanitized);
        },
        onStoreUpdated: (remoteStore) => {
          if (!isMountedRef.current || !remoteStore) return;
          setStore(remoteStore);
          StorageService.safeSet(STORAGE_KEYS.STORE, remoteStore);
        },
      });
    }

    initCloudSync();

    // Auto-refresh when tab gains focus or mobile phone wakes up
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pullAllFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (unsubStatus) unsubStatus();
      if (unsubRealtime) unsubRealtime();
      FirebaseService.unsubscribeAll();
    };
  }, []);

  // Admin Mode state (SES 4.4 Locked Part A & Part J)
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [adminActionDesc, setAdminActionDesc] = useState<string | undefined>(undefined);
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null);

  const openPinModal = (desc?: string, onApproved?: () => void) => {
    setAdminActionDesc(desc);
    if (onApproved) {
      setPendingAdminAction(() => onApproved);
    } else {
      setPendingAdminAction(null);
    }
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
    setPendingAdminAction(null);
    setAdminActionDesc(undefined);
  };

  const enterAdminMode = (pin: string) => {
    const activeSlug = AdminAuthService.detectActiveWorkspaceSlug() || undefined;
    const res = AdminAuthService.verifyPin(pin, activeSlug);
    if (res.success) {
      setIsAdminMode(true);
      setIsPinModalOpen(false);
      if (pendingAdminAction) {
        const actionToRun = pendingAdminAction;
        setPendingAdminAction(null);
        actionToRun();
      }
    }
    return res;
  };

  const exitAdminMode = () => {
    setIsAdminMode(false);
    setPendingAdminAction(null);
  };

  const requireAdmin = (action: () => void, desc?: string) => {
    if (isAdminMode) {
      action();
    } else {
      openPinModal(desc, action);
    }
  };

  /**
   * Check SKU uniqueness across all products within the store context
   */
  const isSkuAvailable = (sku: string, excludeProductId?: string): boolean => {
    if (!sku || !sku.trim()) return false;
    const normalized = sku.trim().toLowerCase();
    return !products.some(
      (p) => p.sku.trim().toLowerCase() === normalized && p.id !== excludeProductId
    );
  };

  /**
   * Add a new product into the catalog.
   * Enforces Part 02 Section 4 & 5 validations.
   * If initial currentStock is specified > 0, an initial STOCK_IN movement is automatically logged.
   */
  const addProduct = (
    newProductData: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
  ): Product => {
    const trimmedName = newProductData.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Product name cannot be empty.');
    }

    const trimmedSku = newProductData.sku?.trim() || '';
    if (!trimmedSku) {
      throw new Error('Product SKU cannot be empty.');
    }

    if (!isSkuAvailable(trimmedSku)) {
      throw new Error(`SKU "${trimmedSku}" is already in use by another product in this store.`);
    }

    const costPrice = Number(newProductData.costPrice);
    if (isNaN(costPrice) || costPrice < 0) {
      throw new Error('Cost price cannot be negative.');
    }

    const sellingPrice = Number(newProductData.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      throw new Error('Selling price cannot be negative.');
    }

    const openingStock = Number(newProductData.currentStock ?? 0);
    if (isNaN(openingStock) || openingStock < 0) {
      throw new Error('Opening stock cannot be negative.');
    }

    const minimumStock = Number(newProductData.minimumStock ?? 0);
    if (isNaN(minimumStock) || minimumStock < 0) {
      throw new Error('Minimum stock cannot be negative.');
    }

    const productId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const createdProduct: Product = {
      ...newProductData,
      id: productId,
      storeId: store.id,
      name: trimmedName,
      sku: trimmedSku,
      costPrice,
      sellingPrice,
      currentStock: openingStock,
      minimumStock,
      active: newProductData.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    setProducts((prev) => [createdProduct, ...prev]);
    FirebaseService.syncProduct(createdProduct);

    // Data Integrity Principle: If opening stock > 0, log traceable STOCK_IN movement!
    if (createdProduct.currentStock > 0) {
      const initialMovement: InventoryMovement = {
        id: `mov-init-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: store.id,
        productId: createdProduct.id,
        productName: createdProduct.name,
        type: 'STOCK_IN',
        quantity: createdProduct.currentStock,
        previousStock: 0,
        newStock: createdProduct.currentStock,
        referenceId: `OPENING-${createdProduct.sku}`,
        reason: 'Opening stock',
        createdAt: now,
      };
      setMovements((prev) => [initialMovement, ...prev]);
      FirebaseService.syncMovement(initialMovement);
    }

    return createdProduct;
  };

  /**
   * Safe atomic upsert import for products (SES 4.4 Locked & Safe Upsert Mode).
   * - Inserts new products and registers opening STOCK_IN movements.
   * - Updates existing product catalog fields (name, category, costPrice, sellingPrice, minStock, active).
   * - CRITICAL: Never modifies currentStock or inventory movements of existing products.
   * - Atomic: Validates everything before applying; either all changes commit or none do.
   */
  const commitProductsUpsertImport = (
    payload: CommitUpsertPayload
  ): UpsertImportCommitResult => {
    const { newItems, updateItems, skippedCount = 0, invalidCount = 0 } = payload;
    const now = new Date().toISOString();

    // 1. Validation phase (Atomic guarantee)
    // Check updateItems: all existingProductId must exist
    for (const u of updateItems) {
      const found = products.find((p) => p.id === u.existingProductId);
      if (!found) {
        throw new Error(`Atomic Import Aborted: Produk sedia ada dengan ID "${u.existingProductId}" tidak dijumpai.`);
      }
    }

    // Check newItems: no SKU collision with existing products (unless part of update)
    const existingSkuMap = new Map(products.map((p) => [SmartInputService.normalizeCode(p.sku), p.id]));
    const newSkuSet = new Set<string>();

    for (const n of newItems) {
      const normalizedSku = SmartInputService.normalizeCode(n.sku);
      if (!normalizedSku) {
        throw new Error('Atomic Import Aborted: Terdapat item baru dengan SKU kosong.');
      }
      if (newSkuSet.has(normalizedSku)) {
        throw new Error(`Atomic Import Aborted: Terdapat duplikasi SKU "${normalizedSku}" dalam kumpulan item baru.`);
      }
      newSkuSet.add(normalizedSku);

      if (existingSkuMap.has(normalizedSku)) {
        throw new Error(`Atomic Import Aborted: SKU "${normalizedSku}" sudah wujud dalam katalog.`);
      }
    }

    // 2. Prepare mutations
    const updateMap = new Map<string, (typeof updateItems)[0]>();
    updateItems.forEach((u) => updateMap.set(u.existingProductId, u));

    const nextProducts: Product[] = products.map((prod) => {
      const updateData = updateMap.get(prod.id);
      if (updateData) {
        return {
          ...prod,
          name: updateData.name,
          category: updateData.category,
          costPrice: updateData.costPrice,
          sellingPrice: updateData.sellingPrice,
          minimumStock: updateData.minimumStock,
          active: updateData.active,
          imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : prod.imageUrl,
          updatedAt: now,
          // Note: currentStock is strictly preserved from prod.currentStock!
          // Note: id is strictly preserved from prod.id!
          // Note: sku is strictly preserved from prod.sku!
        };
      }
      return prod;
    });

    const addedProducts: Product[] = [];
    const openingMovements: InventoryMovement[] = [];

    newItems.forEach((item, idx) => {
      const id = `prod-import-${Date.now()}-${idx}`;
      const product: Product = {
        ...item,
        id,
        storeId: store.id,
        imageUrl: item.imageUrl || undefined,
        createdAt: now,
        updatedAt: now,
      };
      addedProducts.push(product);

      if (item.currentStock > 0) {
        openingMovements.push({
          id: `mov-imp-${Date.now()}-${idx}`,
          storeId: store.id,
          productId: id,
          productName: item.name,
          type: 'STOCK_IN',
          quantity: item.currentStock,
          previousStock: 0,
          newStock: item.currentStock,
          reason: 'Import CSV Pembukaan Stok',
          adjustedBySnapshot: currentUser.name,
          createdAt: now,
        });
      }
    });

    const finalProducts = [...nextProducts, ...addedProducts];
    const finalMovements = [...openingMovements, ...movements];

    // 3. Commit state & storage atomically
    setProducts(finalProducts);
    setMovements(finalMovements);
    StorageService.safeSet(STORAGE_KEYS.PRODUCTS, finalProducts);
    StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, finalMovements);

    // Sync imported products and movements to Firebase Firestore
    FirebaseService.syncProductsBatch(finalProducts);
    if (openingMovements.length > 0) {
      FirebaseService.syncMovementsBatch(openingMovements);
    }

    return {
      newCount: addedProducts.length,
      updatedCount: updateItems.length,
      skippedCount,
      invalidCount,
    };
  };

  /**
   * Bulk import validated products from CSV (SES 4.4 Locked Part D).
   * Automatically initializes opening inventory movements for stock > 0.
   */
  const importProducts = (
    newItems: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[]
  ): number => {
    if (!newItems || newItems.length === 0) return 0;
    const res = commitProductsUpsertImport({
      mode: 'SKIP_EXISTING',
      newItems,
      updateItems: [],
    });
    return res.newCount;
  };

  /**
   * MASTER CATALOG SYNC / OVERRIDE MODE (Permanent Operational Workflow)
   * The imported CSV acts as the authoritative CURRENT MASTER CATALOG:
   * 1. Creates full safety backup snapshot (Part 08) before sync. Fails fast if backup fails.
   * 2. Matches products strictly by SKU:
   *    - Existing SKU -> updates current catalog fields (name, category, cost, price, minStock, active)
   *      and synchronizes stock:
   *      * Stock difference != 0 -> creates ADJUSTMENT movement (+/-) with reason "CSV Master Catalog Sync"
   *      * Stock difference == 0 -> no movement created
   *    - New SKU -> registers new product + opening stock (STOCK_IN)
   *    - Products missing from CSV:
   *      * With historical references (sales/purchases/movements) -> DEACTIVATE (active = false)
   *      * Demo/unused without history -> safely REMOVED from active catalog
   * 3. Guarantees 100% historical immutability (historical Sale, SaleItem, Purchase, movements untouched).
   * 4. Atomic: complete sync commits cleanly or aborts with zero partial mutations.
   */
  const commitMasterCatalogSync = (
    payload: MasterCatalogSyncPayload
  ): MasterCatalogSyncCommitResult => {
    const { validatedRows, missingProducts } = payload;
    const now = new Date().toISOString();

    // 1. Mandatory Safety Backup Snapshot (Section 20)
    let backupSnapshot: StoreBackupPayload;
    try {
      backupSnapshot = StorageService.createBackupPayload({
        store,
        products,
        movements,
        sales,
        suppliers,
        purchases,
        customers,
        loyaltyLedger,
        staffUsers,
      });
      const validation = StorageService.validateBackupPayload(backupSnapshot);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Backup validation failed.');
      }
      StorageService.safeSet(STORAGE_KEYS.PRE_SYNC_BACKUP, backupSnapshot);
    } catch (err: any) {
      throw new Error(`Master Catalog Sync Dibatalkan: Gagal mengambil sandaran keselamatan (backup) sebelum penyelarasan: ${err.message}`);
    }

    // 2. Pre-commit Validation & Atomicity Check (Section 8, 19, 29)
    const invalidRow = validatedRows.find((r) => r.action === 'INVALID');
    if (invalidRow) {
      throw new Error(`Master Catalog Sync Dibatalkan: Baris SKU "${invalidRow.sku}" tidak sah (${invalidRow.reason}). Tiada data diubah.`);
    }

    const seenSkus = new Set<string>();
    for (const row of validatedRows) {
      const norm = SmartInputService.normalizeCode(row.sku);
      if (seenSkus.has(norm)) {
        throw new Error(`Master Catalog Sync Dibatalkan: Duplikasi SKU "${norm}" dikesan dalam fail CSV.`);
      }
      seenSkus.add(norm);
    }

    for (const row of validatedRows) {
      if (row.action === 'UPDATE' || row.action === 'UNCHANGED') {
        const found = products.find((p) => p.id === row.existingProductId);
        if (!found) {
          throw new Error(`Master Catalog Sync Dibatalkan: Produk ID "${row.existingProductId}" tidak dijumpai.`);
        }
      }
    }

    // 3. Execution Phase (In-Memory first)
    const newMovements: InventoryMovement[] = [];
    const rowsBySku = new Map<string, (typeof validatedRows)[0]>();
    validatedRows.forEach((r) => {
      rowsBySku.set(SmartInputService.normalizeCode(r.sku), r);
    });

    const missingMap = new Map<string, (typeof missingProducts)[0]>();
    missingProducts.forEach((m) => {
      missingMap.set(m.product.id, m);
    });

    const nextExistingProducts: Product[] = [];
    let deactivatedCount = 0;
    let removedCount = 0;
    const removedProductIds = new Set<string>();

    for (const prod of products) {
      const normSku = SmartInputService.normalizeCode(prod.sku);
      const csvRow = rowsBySku.get(normSku);

      if (csvRow) {
        // Matched existing SKU -> Override current catalog data & synchronize stock
        const currentStock = prod.currentStock;
        const targetStock = csvRow.csvStock;
        const stockDiff = targetStock - currentStock;

        if (stockDiff !== 0) {
          newMovements.push({
            id: `mov-sync-adj-${Date.now()}-${nextExistingProducts.length}`,
            storeId: store.id,
            productId: prod.id,
            productName: csvRow.name,
            type: 'ADJUSTMENT',
            quantity: stockDiff,
            previousStock: currentStock,
            newStock: targetStock,
            reason: 'CSV Master Catalog Sync',
            adjustedBySnapshot: currentUser.name,
            createdAt: now,
          });
        }

        nextExistingProducts.push({
          ...prod,
          name: csvRow.name,
          category: csvRow.category,
          costPrice: csvRow.costPrice,
          sellingPrice: csvRow.sellingPrice,
          minimumStock: csvRow.minimumStock,
          currentStock: targetStock,
          active: csvRow.active,
          imageUrl: csvRow.imageUrl !== undefined ? csvRow.imageUrl : prod.imageUrl,
          updatedAt: now,
        });
      } else {
        // Product NOT in CSV (Section 15, 16, 17)
        const missingInfo = missingMap.get(prod.id);
        if (missingInfo?.action === 'REMOVE') {
          // Zero historical references (demo/unused) -> safe removal
          removedCount++;
          removedProductIds.add(prod.id);
        } else {
          // Has historical references (sales/purchases/movements) -> deactivate/archive
          deactivatedCount++;
          nextExistingProducts.push({
            ...prod,
            active: false,
            updatedAt: now,
          });
        }
      }
    }

    // Add genuinely new products
    const addedProducts: Product[] = [];
    const newRows = validatedRows.filter((r) => r.action === 'NEW');

    newRows.forEach((r, idx) => {
      const newId = `prod-sync-${Date.now()}-${idx}`;
      const newProduct: Product = {
        id: newId,
        storeId: store.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        currentStock: r.csvStock,
        minimumStock: r.minimumStock,
        active: r.active,
        imageUrl: r.imageUrl || undefined,
        createdAt: now,
        updatedAt: now,
      };
      addedProducts.push(newProduct);

      if (r.csvStock > 0) {
        newMovements.push({
          id: `mov-sync-in-${Date.now()}-${idx}`,
          storeId: store.id,
          productId: newId,
          productName: r.name,
          type: 'STOCK_IN',
          quantity: r.csvStock,
          previousStock: 0,
          newStock: r.csvStock,
          reason: 'Import CSV Pembukaan Stok',
          adjustedBySnapshot: currentUser.name,
          createdAt: now,
        });
      }
    });

    // Remove opening movements for genuinely removed demo products to avoid orphans
    const nextMovements = movements.filter((m) => !removedProductIds.has(m.productId));
    const finalMovements = [...newMovements, ...nextMovements];
    const finalProducts = [...nextExistingProducts, ...addedProducts];

    // 4. Atomically commit state & storage
    setProducts(finalProducts);
    setMovements(finalMovements);
    StorageService.safeSet(STORAGE_KEYS.PRODUCTS, finalProducts);
    StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, finalMovements);

    // Sync master catalog changes to Firebase Firestore
    FirebaseService.syncProductsBatch(finalProducts);
    if (newMovements.length > 0) {
      FirebaseService.syncMovementsBatch(newMovements);
    }
    removedProductIds.forEach((id) => FirebaseService.deleteProduct(id));

    const updatedRowsCount = validatedRows.filter((r) => r.action === 'UPDATE').length;
    const unchangedRowsCount = validatedRows.filter((r) => r.action === 'UNCHANGED').length;

    const syncMetadata: LastCatalogSyncInfo = {
      importedFilename: payload.filename || 'katalog_master.csv',
      importedAt: now,
      totalRows: validatedRows.length,
      newCount: addedProducts.length,
      updatedCount: updatedRowsCount,
      unchangedCount: unchangedRowsCount,
      stockAdjustmentsCount: newMovements.length,
      deactivatedCount,
      removedCount,
    };
    StorageService.safeSet(STORAGE_KEYS.LAST_SYNC_METADATA, syncMetadata);
    setLastCatalogSyncInfo(syncMetadata);

    return {
      success: true,
      newCount: addedProducts.length,
      updatedCount: updatedRowsCount,
      unchangedCount: unchangedRowsCount,
      stockAdjustmentsCount: newMovements.length,
      deactivatedCount,
      removedCount,
      invalidCount: 0,
      backupSnapshotAt: backupSnapshot.exportedAt,
      message: 'Master Catalog Sync berjaya diselesaikan.',
    };
  };

  /**
   * Update product metadata (cost, price, name, etc.).
   * Note: Direct stock mutations are forbidden; must be done via movement methods!
   * Historical transaction snapshots are never modified.
   */
  const updateProduct = (id: string, updates: Partial<Product>): Product => {
    const existing = products.find((p) => p.id === id);
    if (!existing) {
      throw new Error('Product not found.');
    }

    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error('Product name cannot be empty.');
    }

    if (updates.sku !== undefined) {
      const trimmedSku = updates.sku.trim();
      if (!trimmedSku) {
        throw new Error('Product SKU cannot be empty.');
      }
      if (!isSkuAvailable(trimmedSku, id)) {
        throw new Error(`SKU "${trimmedSku}" is already in use by another product in this store.`);
      }
    }

    if (updates.costPrice !== undefined && (isNaN(Number(updates.costPrice)) || Number(updates.costPrice) < 0)) {
      throw new Error('Cost price cannot be negative.');
    }

    if (updates.sellingPrice !== undefined && (isNaN(Number(updates.sellingPrice)) || Number(updates.sellingPrice) < 0)) {
      throw new Error('Selling price cannot be negative.');
    }

    if (updates.minimumStock !== undefined && (isNaN(Number(updates.minimumStock)) || Number(updates.minimumStock) < 0)) {
      throw new Error('Minimum stock cannot be negative.');
    }

    // Guard: Disallow direct arbitrary alteration of currentStock without movement audit
    const safeUpdates = { ...updates };
    delete safeUpdates.currentStock;

    let updatedResult: Product = existing;
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === id) {
          updatedResult = {
            ...prod,
            ...safeUpdates,
            updatedAt: new Date().toISOString(),
          };
          return updatedResult;
        }
        return prod;
      })
    );

    FirebaseService.syncProduct(updatedResult);
    return updatedResult;
  };

  /**
   * Toggle product active/inactive status safely
   */
  const toggleProductActive = (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    updateProduct(id, { active: !target.active });
  };

  /**
   * Determine delete eligibility for a product:
   * Inspects historical sales, purchases, movements, and current stock.
   */
  const checkProductDeleteEligibility = (id: string): ProductDeleteEligibility => {
    const target = products.find((p) => p.id === id);
    if (!target) {
      return {
        canHardDelete: false,
        hasHistoricalReferences: false,
        hasStockWithoutHistory: false,
        historyDetails: { salesCount: 0, purchasesCount: 0, movementsCount: 0 },
        suggestedAction: 'DEACTIVATE',
        reason: 'Produk tidak dijumpai.',
      };
    }
    return ProductService.checkDeleteEligibility(target, sales, purchases, movements);
  };

  /**
   * Product Deletion Semantics:
   * HARD DELETE is ONLY permitted when product has zero authoritative historical references
   * (Sales, SaleItems, Purchases, PurchaseItems, InventoryMovements beyond opening, Returns, Adjustments).
   * If any historical reference exists, hard delete is strictly rejected.
   * If product has currentStock > 0 without history, explicit stock confirmation is required.
   */
  const deleteProduct = (
    id: string,
    confirmWithStock: boolean = false
  ): { success: boolean; message: string; action?: 'DELETED' | 'BLOCKED' } => {
    const target = products.find((p) => p.id === id);
    if (!target) {
      return { success: false, message: 'Produk tidak dijumpai.', action: 'BLOCKED' };
    }

    try {
      const outcome = ProductService.hardDeleteProduct(
        id,
        products,
        movements,
        sales,
        purchases,
        confirmWithStock
      );
      setProducts(outcome.updatedProducts);
      setMovements(outcome.updatedMovements);
      FirebaseService.deleteProduct(id);
      return {
        success: true,
        message: outcome.message,
        action: 'DELETED',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat memadam produk.',
        action: 'BLOCKED',
      };
    }
  };

  /**
   * Deactivate a product:
   * Sets active = false while preserving all historical references, audit trails, and financial records.
   */
  const deactivateProduct = (id: string): { success: boolean; message: string } => {
    const target = products.find((p) => p.id === id);
    if (!target) {
      return { success: false, message: 'Produk tidak dijumpai.' };
    }

    try {
      const outcome = ProductService.deactivateProduct(id, products);
      setProducts(outcome.updatedProducts);
      FirebaseService.syncProduct(outcome.deactivatedProduct);
      return {
        success: true,
        message: outcome.message,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat menyahaktifkan produk.',
      };
    }
  };

  /**
   * Traceable Return (customer return or stock recovery)
   */
  const recordReturn = (
    productId: string,
    quantity: number,
    reason: string,
    referenceId?: string
  ) => {
    if (quantity <= 0) {
      throw new Error('Return quantity must be greater than zero.');
    }
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) throw new Error('Product not found.');

    const { updatedProduct, movement } = InventoryService.applyMovement(
      targetProduct,
      {
        productId,
        type: 'RETURN',
        quantity,
        reason: reason || 'Customer return item',
        referenceId,
      },
      store.id
    );

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? updatedProduct : p))
    );
    setMovements((prev) => [movement, ...prev]);
    FirebaseService.syncProduct(updatedProduct);
    FirebaseService.syncMovement(movement);
  };

  /**
   * Traceable Stock In (supplier delivery or replenishment)
   */
  const recordStockIn = (
    productId: string,
    quantity: number,
    reason: string,
    referenceId?: string
  ) => {
    if (quantity <= 0) {
      throw new Error('Stock in quantity must be greater than zero.');
    }

    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) throw new Error('Product not found.');

    const { updatedProduct, movement } = InventoryService.applyMovement(
      targetProduct,
      {
        productId,
        type: 'STOCK_IN',
        quantity,
        reason: reason || 'Restock replenishment',
        referenceId,
      },
      store.id
    );

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? updatedProduct : p))
    );
    setMovements((prev) => [movement, ...prev]);
    FirebaseService.syncProduct(updatedProduct);
    FirebaseService.syncMovement(movement);
  };

  /**
   * Traceable Stock Adjustment (spoilage, damage, physical inventory audit discrepancy)
   */
  const recordAdjustment = (
    productId: string,
    quantityChange: number,
    reason: string
  ) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) throw new Error('Product not found.');

    const { updatedProduct, movement } = InventoryService.applyMovement(
      targetProduct,
      {
        productId,
        type: 'ADJUSTMENT',
        quantity: quantityChange,
        reason,
      },
      store.id
    );

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? updatedProduct : p))
    );
    setMovements((prev) => [movement, ...prev]);
    FirebaseService.syncProduct(updatedProduct);
    FirebaseService.syncMovement(movement);
  };

  /**
   * POS Sale Processing (Part 03: Atomic Checkout):
   * 1. Pre-validates items, active status, authoritative stock, and payment
   * 2. Snapshots costs & selling prices
   * 3. Allocates discounts deterministically
   * 4. Decreases stock & generates SALE inventory movements
   * 5. Atomically commits changes with double-submission & zero-partial-state guarantees
   */
  const processSale = (
    cartItems: CartItem[],
    optionsOrDiscount: number | ProcessSaleOptions = 0,
    notes?: string
  ): Sale => {
    const productsMap = new Map<string, Product>(products.map((p) => [p.id, p]));

    // Atomic execution: validation happens inside processSale BEFORE any state mutation.
    // If anything fails, an error is thrown and no state is changed.
    const result = SalesService.processSale(
      cartItems,
      productsMap,
      store.id,
      sales,
      optionsOrDiscount,
      notes
    );

    // Update products stock atomically
    setProducts((prev) => {
      const updatedMap = new Map<string, Product>(result.updatedProducts.map((p) => [p.id, p]));
      return prev.map((p) => updatedMap.get(p.id) || p);
    });

    // Add inventory movements
    setMovements((prev) => [...result.newMovements, ...prev]);

    // Add sale record
    setSales((prev) => [result.sale, ...prev]);

    // Cloud sync for sale, updated products, and movements
    FirebaseService.syncSale(result.sale);
    result.updatedProducts.forEach((p) => FirebaseService.syncProduct(p));
    result.newMovements.forEach((m) => FirebaseService.syncMovement(m));

    // Handle Loyalty point accumulation for customer if enabled
    const opts = typeof optionsOrDiscount === 'object' ? optionsOrDiscount : {};
    const customerId = opts.customerId || result.sale.customerId;
    const isLoyaltyEnabled = store.settings?.enableLoyalty !== false;

    if (customerId && isLoyaltyEnabled && result.sale.status === 'COMPLETED') {
      const targetCustomer = customers.find((c) => c.id === customerId);
      if (targetCustomer) {
        const ratio = store.settings?.loyaltyPointsPerCurrency || 1;
        const newEntry = LoyaltyService.awardPointsForSale(
          result.sale,
          customerId,
          loyaltyLedger,
          ratio
        );
        if (newEntry) {
          setLoyaltyLedger((prev) => [newEntry, ...prev]);
          FirebaseService.syncLoyaltyEntry(newEntry);
        }
      }
    }

    return result.sale;
  };

  // Customer Management (Part 07)
  const isCustomerCodeAvailable = (code: string, excludeId?: string): boolean => {
    return CustomerService.isCustomerCodeUnique(code, customers, excludeId);
  };

  const addCustomer = (input: CreateCustomerInput): Customer => {
    const created = CustomerService.createCustomer(input, customers);
    setCustomers((prev) => [created, ...prev]);
    FirebaseService.syncCustomer(created);
    return created;
  };

  const updateCustomer = (id: string, updates: UpdateCustomerInput): Customer => {
    const updated = CustomerService.updateCustomer(id, updates, customers);
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    FirebaseService.syncCustomer(updated);
    return updated;
  };

  const toggleCustomerActive = (id: string) => {
    const target = customers.find((c) => c.id === id);
    if (!target) return;
    updateCustomer(id, { active: !target.active });
  };

  const deleteCustomer = (id: string): { success: boolean; message: string } => {
    const target = customers.find((c) => c.id === id);
    if (!target) {
      return { success: false, message: 'Customer not found.' };
    }
    const check = CustomerService.canDeleteCustomer(id, sales);
    if (!check.canDelete) {
      updateCustomer(id, { active: false });
      return {
        success: false,
        message: check.reason || 'Customer has purchase history and was deactivated.',
      };
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    FirebaseService.deleteCustomer(id);
    return {
      success: true,
      message: `Customer "${target.customerName}" was successfully removed.`,
    };
  };

  const commitCustomersUpsertImport = (payload: {
    newItems: CreateCustomerInput[];
    updateItems: { id: string; updates: UpdateCustomerInput }[];
  }): { added: number; updated: number } => {
    let currentCustomers = [...customers];
    let updatedCount = 0;
    let addedCount = 0;

    for (const item of payload.updateItems) {
      const existing = currentCustomers.find((c) => c.id === item.id);
      if (existing) {
        const updated = CustomerService.updateCustomer(item.id, item.updates, currentCustomers);
        currentCustomers = currentCustomers.map((c) => (c.id === item.id ? updated : c));
        FirebaseService.syncCustomer(updated);
        updatedCount++;
      }
    }

    for (const item of payload.newItems) {
      const created = CustomerService.createCustomer(item, currentCustomers);
      currentCustomers = [created, ...currentCustomers];
      FirebaseService.syncCustomer(created);
      addedCount++;
    }

    setCustomers(currentCustomers);
    StorageService.safeSet(STORAGE_KEYS.CUSTOMERS, currentCustomers);
    return { added: addedCount, updated: updatedCount };
  };

  // Loyalty & Rewards (Part 07)
  const awardLoyaltyPoints = (sale: Sale, customerId: string): LoyaltyLedgerEntry | null => {
    const ratio = store.settings?.loyaltyPointsPerCurrency || 1;
    const entry = LoyaltyService.awardPointsForSale(sale, customerId, loyaltyLedger, ratio);
    if (entry) {
      setLoyaltyLedger((prev) => [entry, ...prev]);
      FirebaseService.syncLoyaltyEntry(entry);
    }
    return entry;
  };

  const redeemLoyaltyPoints = (
    customerId: string,
    points: number,
    referenceId: string,
    description?: string
  ): LoyaltyLedgerEntry => {
    const entry = LoyaltyService.redeemPoints(
      customerId,
      points,
      referenceId,
      loyaltyLedger,
      description
    );
    setLoyaltyLedger((prev) => [entry, ...prev]);
    FirebaseService.syncLoyaltyEntry(entry);
    return entry;
  };

  // Staff Foundation (Part 07)
  const addStaff = (input: CreateStaffInput): StaffUser => {
    const created = StaffService.createStaff(input, staffUsers);
    setStaffUsers((prev) => [created, ...prev]);
    FirebaseService.syncStaffUser(created);
    return created;
  };

  const updateStaff = (id: string, updates: UpdateStaffInput): StaffUser => {
    const updated = StaffService.updateStaff(id, updates, staffUsers);
    const newStaffList = staffUsers.map((s) => (s.id === id ? updated : s));
    setStaffUsers(newStaffList);
    if (activeStaff && activeStaff.id === id) {
      if (!updated.active || updated.role !== 'CASHIER') {
        const remainingCashiers = StaffService.getActiveCashiers(newStaffList);
        setActiveStaff(remainingCashiers[0] || null);
      } else {
        setActiveStaff(updated);
      }
    }
    FirebaseService.syncStaffUser(updated);
    return updated;
  };

  const toggleStaffActive = (id: string) => {
    const target = staffUsers.find((s) => s.id === id);
    if (!target) return;
    updateStaff(id, { active: !target.active });
  };

  const commitStaffUpsertImport = (payload: {
    newItems: CreateStaffInput[];
    updateItems: { id: string; updates: UpdateStaffInput }[];
  }): { added: number; updated: number } => {
    let currentStaff = [...staffUsers];
    let updatedCount = 0;
    let addedCount = 0;

    for (const item of payload.updateItems) {
      const existing = currentStaff.find((s) => s.id === item.id);
      if (existing) {
        const updated = StaffService.updateStaff(item.id, item.updates, currentStaff);
        currentStaff = currentStaff.map((s) => (s.id === item.id ? updated : s));
        FirebaseService.syncStaffUser(updated);
        updatedCount++;
      }
    }

    for (const item of payload.newItems) {
      const created = StaffService.createStaff(item, currentStaff);
      currentStaff = [created, ...currentStaff];
      FirebaseService.syncStaffUser(created);
      addedCount++;
    }

    setStaffUsers(currentStaff);
    StorageService.safeSet(STORAGE_KEYS.STAFF, currentStaff);
    return { added: addedCount, updated: updatedCount };
  };

  const isSupplierCodeAvailable = (code: string, excludeId?: string): boolean => {
    return SupplierService.isSupplierCodeUnique(code, suppliers, excludeId);
  };

  const addSupplier = (input: CreateSupplierInput): Supplier => {
    const created = SupplierService.createSupplier(input, suppliers);
    setSuppliers((prev) => [created, ...prev]);
    FirebaseService.syncSupplier(created);
    return created;
  };

  const updateSupplier = (id: string, updates: UpdateSupplierInput): Supplier => {
    const updated = SupplierService.updateSupplier(id, updates, suppliers);
    setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
    FirebaseService.syncSupplier(updated);
    return updated;
  };

  const toggleSupplierActive = (id: string) => {
    const target = suppliers.find((s) => s.id === id);
    if (!target) return;
    updateSupplier(id, { active: !target.active });
  };

  const deleteSupplier = (id: string): { success: boolean; message: string } => {
    const target = suppliers.find((s) => s.id === id);
    if (!target) {
      return { success: false, message: 'Supplier not found.' };
    }

    const check = SupplierService.canDeleteSupplier(id, purchases);
    if (!check.canDelete) {
      updateSupplier(id, { active: false });
      return {
        success: false,
        message: `Supplier "${target.supplierName}" has historical purchase records. It was safely deactivated (Active: false) to preserve audit trails.`,
      };
    }

    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    FirebaseService.deleteSupplier(id);
    return {
      success: true,
      message: `Supplier "${target.supplierName}" was successfully removed.`,
    };
  };

  const commitSuppliersUpsertImport = (payload: {
    newItems: CreateSupplierInput[];
    updateItems: { id: string; updates: UpdateSupplierInput }[];
  }): { added: number; updated: number } => {
    let currentSuppliers = [...suppliers];
    let updatedCount = 0;
    let addedCount = 0;

    for (const item of payload.updateItems) {
      const existing = currentSuppliers.find((s) => s.id === item.id);
      if (existing) {
        const updated = SupplierService.updateSupplier(item.id, item.updates, currentSuppliers);
        currentSuppliers = currentSuppliers.map((s) => (s.id === item.id ? updated : s));
        FirebaseService.syncSupplier(updated);
        updatedCount++;
      }
    }

    for (const item of payload.newItems) {
      const created = SupplierService.createSupplier(item, currentSuppliers);
      currentSuppliers = [created, ...currentSuppliers];
      FirebaseService.syncSupplier(created);
      addedCount++;
    }

    setSuppliers(currentSuppliers);
    suppliersRef.current = currentSuppliers;
    StorageService.safeSet(STORAGE_KEYS.SUPPLIERS, currentSuppliers);
    return { added: addedCount, updated: updatedCount };
  };

  const createPurchase = (input: CreatePurchaseInput): Purchase => {
    const suppliersMap = new Map<string, Supplier>(suppliersRef.current.map((s) => [s.id, s]));
    const productsMap = new Map<string, Product>(productsRef.current.map((p) => [p.id, p]));
    const draft = PurchasingService.createDraftPurchase(input, suppliersMap, productsMap, purchasesRef.current);
    purchasesRef.current = [draft, ...purchasesRef.current];
    setPurchases(purchasesRef.current);
    StorageService.safeSet(STORAGE_KEYS.PURCHASES, purchasesRef.current);
    FirebaseService.syncPurchase(draft);
    return draft;
  };

  const completePurchase = (purchaseId: string, preloadedPurchase?: Purchase): CompletePurchaseResult => {
    let purchase: Purchase | undefined =
      preloadedPurchase ||
      purchasesRef.current.find((p) => p.id === purchaseId) ||
      purchases.find((p) => p.id === purchaseId);

    if (!purchase) {
      const cached = StorageService.safeParse<Purchase[]>(localStorage.getItem(STORAGE_KEYS.PURCHASES), []);
      purchase = cached.find((p) => p.id === purchaseId);
    }

    if (!purchase) {
      throw new Error(`Purchase not found: ${purchaseId}`);
    }

    const suppliersMap = new Map<string, Supplier>(suppliersRef.current.map((s) => [s.id, s]));
    const productsMap = new Map<string, Product>(productsRef.current.map((p) => [p.id, p]));

    const result = PurchasingService.completePurchase(
      purchase,
      suppliersMap,
      productsMap,
      store.id
    );

    // Update products atomically
    setProducts((prev) => {
      const updatedMap = new Map<string, Product>(result.updatedProducts.map((p) => [p.id, p]));
      const next = prev.map((p) => updatedMap.get(p.id) || p);
      productsRef.current = next;
      StorageService.safeSet(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });

    // Add inventory movements
    setMovements((prev) => {
      const next = [...result.newMovements, ...prev];
      StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, next);
      return next;
    });

    // Update purchase in purchases list
    setPurchases((prev) => {
      const exists = prev.some((p) => p.id === purchaseId);
      const next = exists
        ? prev.map((p) => (p.id === purchaseId ? result.completedPurchase : p))
        : [result.completedPurchase, ...prev];
      purchasesRef.current = next;
      StorageService.safeSet(STORAGE_KEYS.PURCHASES, next);
      return next;
    });

    FirebaseService.syncPurchase(result.completedPurchase);
    result.updatedProducts.forEach((p) => FirebaseService.syncProduct(p));
    result.newMovements.forEach((m) => FirebaseService.syncMovement(m));

    return result;
  };

  const createAndCompletePurchase = (input: CreatePurchaseInput): CompletePurchaseResult => {
    const suppliersMap = new Map<string, Supplier>(suppliersRef.current.map((s) => [s.id, s]));
    const productsMap = new Map<string, Product>(productsRef.current.map((p) => [p.id, p]));
    const draft = PurchasingService.createDraftPurchase(input, suppliersMap, productsMap, purchasesRef.current);
    purchasesRef.current = [draft, ...purchasesRef.current];
    setPurchases(purchasesRef.current);
    StorageService.safeSet(STORAGE_KEYS.PURCHASES, purchasesRef.current);
    FirebaseService.syncPurchase(draft);
    return completePurchase(draft.id, draft);
  };

  const cancelPurchase = (purchaseId: string, preloadedPurchase?: Purchase): Purchase => {
    let purchase: Purchase | undefined =
      preloadedPurchase ||
      purchasesRef.current.find((p) => p.id === purchaseId) ||
      purchases.find((p) => p.id === purchaseId);

    if (!purchase) {
      const cached = StorageService.safeParse<Purchase[]>(localStorage.getItem(STORAGE_KEYS.PURCHASES), []);
      purchase = cached.find((p) => p.id === purchaseId);
    }

    if (!purchase) {
      throw new Error(`Purchase not found: ${purchaseId}`);
    }

    const cancelled = PurchasingService.cancelPurchase(purchase);
    setPurchases((prev) => {
      const next = prev.map((p) => (p.id === purchaseId ? cancelled : p));
      purchasesRef.current = next;
      StorageService.safeSet(STORAGE_KEYS.PURCHASES, next);
      return next;
    });
    FirebaseService.syncPurchase(cancelled);
    return cancelled;
  };

  const updateStoreDetails = useCallback((details: Partial<Store>) => {
    setStore((prev) => {
      const updatedStore = {
        ...prev,
        ...details,
        updatedAt: new Date().toISOString(),
      };
      FirebaseService.syncStore(updatedStore);
      return updatedStore;
    });
  }, []);

  const resetToDemo = () => {
    setStore(INITIAL_STORE);
    setProducts(INITIAL_PRODUCTS);
    setMovements(INITIAL_MOVEMENTS);
    setSales(INITIAL_SALES);
    setSuppliers(INITIAL_SUPPLIERS);
    setPurchases(INITIAL_PURCHASES);
    setCustomers(INITIAL_CUSTOMERS);
    setLoyaltyLedger(INITIAL_LOYALTY_LEDGER);
    setStaffUsers(INITIAL_STAFF);
    setActiveStaff(StaffService.getActiveCashiers(INITIAL_STAFF)[0] || null);
    localStorage.removeItem(STORAGE_KEYS.STORE);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.MOVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    localStorage.removeItem(STORAGE_KEYS.PURCHASES);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.LOYALTY);
    localStorage.removeItem(STORAGE_KEYS.STAFF);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CASHIER_ID);
    FirebaseService.clearCollectionsFromCloud([
      'products',
      'suppliers',
      'customers',
      'sales',
      'purchases',
      'inventory_movements',
      'loyalty_ledger',
    ]).catch((err) => console.warn('Firestore purge error during reset:', err));
    FirebaseService.syncStore(INITIAL_STORE);
  };

  const clearStoreCategories = async (
    options: ClearCategoriesOptions
  ): Promise<{ success: boolean; message: string }> => {
    const isAll = !!(options.products && options.suppliers && options.customers && options.staff);
    const collectionsToClear: string[] = [];
    const clearedNames: string[] = [];

    if (options.products) {
      setProducts([]);
      productsRef.current = [];
      setMovements([]);
      setSales([]);
      StorageService.safeSet(STORAGE_KEYS.PRODUCTS, []);
      StorageService.safeSet(STORAGE_KEYS.MOVEMENTS, []);
      StorageService.safeSet(STORAGE_KEYS.SALES, []);
      collectionsToClear.push('products', 'sales', 'inventory_movements');
      clearedNames.push('Produk & Jualan');
    }

    if (options.suppliers) {
      setSuppliers([]);
      suppliersRef.current = [];
      setPurchases([]);
      StorageService.safeSet(STORAGE_KEYS.SUPPLIERS, []);
      StorageService.safeSet(STORAGE_KEYS.PURCHASES, []);
      collectionsToClear.push('suppliers', 'purchases');
      clearedNames.push('Pembekal & Pembelian');
    }

    if (options.customers) {
      setCustomers([]);
      setLoyaltyLedger([]);
      StorageService.safeSet(STORAGE_KEYS.CUSTOMERS, []);
      StorageService.safeSet(STORAGE_KEYS.LOYALTY, []);
      collectionsToClear.push('customers', 'loyalty_ledger');
      clearedNames.push('Pelanggan & Ganjaran');
    }

    if (options.staff) {
      setStaffUsers([]);
      setActiveStaff(null);
      StorageService.safeSet(STORAGE_KEYS.STAFF, []);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CASHIER_ID);
      collectionsToClear.push('staff_users');
      clearedNames.push('Pekerja / Staf');
    }

    if (isAll) {
      setStore(INITIAL_STORE);
      StorageService.safeSet(STORAGE_KEYS.STORE, INITIAL_STORE);
    }

    try {
      if (collectionsToClear.length > 0) {
        await FirebaseService.clearCollectionsFromCloud(collectionsToClear);
      }
      if (isAll) {
        await FirebaseService.syncStore(INITIAL_STORE);
      }
      return {
        success: true,
        message: isAll
          ? 'Semua kategori telah berjaya dikosongkan. Sistem sedia bermula dari kosong.'
          : `Kategori [${clearedNames.join(', ')}] telah dikosongkan dan sedia bermula dari kosong.`,
      };
    } catch (err: any) {
      console.error('Error clearing store categories:', err);
      return {
        success: true,
        message: `Data tempatan [${clearedNames.join(', ')}] telah dikosongkan. Ralat penyelarasan awan: ${err?.message || 'Gagal selaras awan'}`,
      };
    }
  };

  const clearAllStoreData = async (): Promise<{ success: boolean; message: string }> => {
    return clearStoreCategories({
      products: true,
      suppliers: true,
      customers: true,
      staff: true,
    });
  };

  const exportStoreData = (): StoreBackupPayload => {
    return StorageService.createBackupPayload({
      store,
      products,
      movements,
      sales,
      suppliers,
      purchases,
      customers,
      loyaltyLedger,
      staffUsers,
    });
  };

  const downloadBackup = (): void => {
    const payload = exportStoreData();
    StorageService.downloadBackup(payload);
  };

  const restoreStoreData = (payload: StoreBackupPayload): { success: boolean; message: string } => {
    const validation = StorageService.validateBackupPayload(payload);
    if (!validation.isValid || !validation.data) {
      throw new Error(validation.error || 'Invalid backup structure.');
    }

    const data = validation.data;
    setStore(data.store);
    setProducts(data.products);
    setMovements(data.movements);
    setSales(data.sales);
    setSuppliers(data.suppliers);
    setPurchases(data.purchases);
    setCustomers(data.customers);
    setLoyaltyLedger(data.loyaltyLedger);
    setStaffUsers(data.staffUsers);
    setActiveStaff(StaffService.getActiveCashiers(data.staffUsers)[0] || null);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CASHIER_ID);

    FirebaseService.syncAllData({
      store: data.store,
      products: data.products,
      movements: data.movements,
      sales: data.sales,
      suppliers: data.suppliers,
      purchases: data.purchases,
      customers: data.customers,
      loyaltyLedger: data.loyaltyLedger,
      staffUsers: data.staffUsers,
    });

    return {
      success: true,
      message: `Store data successfully restored from backup (${data.products.length} products, ${data.sales.length} sales, ${data.purchases.length} purchases).`,
    };
  };

  // SYNCROZZ KEDAI MAKAN - Business Configuration State (SES v4.5)
  const [businessConfig, setBusinessConfig] = useState<BusinessConfiguration>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return TemplateService.getBusinessConfig(slug);
  });

  // SYNCROZZ KEDAI MAKAN - Restaurant Menu & Tax Operations (Fasa 2 - SES v4.5)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return MenuService.getMenuItems(slug);
  });

  const [taxConfig, setTaxConfig] = useState<RestaurantTaxConfig>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return MenuService.getTaxConfig(slug);
  });

  const updateBusinessConfig = (newConfig: BusinessConfiguration) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const saved = TemplateService.saveBusinessConfig(newConfig, slug);
    setBusinessConfig(saved);
  };

  const applyBusinessTemplate = (
    templateId: BusinessTemplateId,
    options?: { loadSampleMenu?: boolean; resetExistingMenu?: boolean; updateTableMode?: boolean }
  ) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const res = TemplateService.applyTemplate(templateId, slug, options);
    setBusinessConfig(res.config);
    setMenuItems(MenuService.getMenuItems(slug));
  };

  const refreshBusinessConfig = () => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    setBusinessConfig(TemplateService.getBusinessConfig(slug));
    setMenuItems(MenuService.getMenuItems(slug));
  };

  const menuCategories = React.useMemo(() => {
    const set = new Set<string>();
    // Kekalkan kategori yang telah dikonfigurasi oleh owner
    if (businessConfig?.categories) {
      businessConfig.categories.forEach((c) => {
        if (c.trim()) set.add(c.trim());
      });
    }
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category.trim());
    });
    if (set.size === 0) {
      set.add('Makanan Utama');
      set.add('Minuman');
    }
    return Array.from(set);
  }, [menuItems, businessConfig]);

  const toggleMenuItemAvailability = (menuItemId: string) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const updated = MenuService.toggleAvailability(menuItemId, slug);
    setMenuItems(updated);
  };

  const saveMenuItem = (itemData: Partial<MenuItem> & { name: string; price: number; category: string }) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const updated = MenuService.saveMenuItem(itemData, slug);
    setMenuItems(updated);
  };

  const deleteMenuItem = (menuItemId: string) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const updated = MenuService.deleteMenuItem(menuItemId, slug);
    setMenuItems(updated);
  };

  const updateTaxConfig = (config: RestaurantTaxConfig) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    MenuService.saveTaxConfig(config, slug);
    setTaxConfig(config);
  };

  // SYNCROZZ KEDAI MAKAN - Table Management & Reservation (Fasa 3 - Langkah 1)
  const [tables, setTables] = useState<RestaurantTable[]>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return TableService.getTables(slug);
  });

  const [reservations, setReservations] = useState<TableReservation[]>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return TableService.getReservations(slug);
  });

  const [tableAuditLogs, setTableAuditLogs] = useState<TableStatusAuditEntry[]>(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    return TableService.getAuditEntries(slug);
  });

  const refreshTablesData = useCallback(() => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    setTables(TableService.getTables(slug));
    setReservations(TableService.getReservations(slug));
    setTableAuditLogs(TableService.getAuditEntries(slug));
  }, []);

  const updateTableStatus = (
    tableId: string,
    newStatus: TableStatus,
    reason?: string,
    orderSummary?: RestaurantActiveOrderSummary
  ) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const operator = activeStaff ? activeStaff.name : 'Pemilik Kedai';
    const res = TableService.updateTableStatus(
      tableId,
      newStatus,
      operator,
      reason,
      orderSummary,
      slug
    );
    setTables(res.tables);
    setTableAuditLogs(TableService.getAuditEntries(slug));
  };

  const bindActiveOrderToTable = (tableNumber: string, orderSummary: RestaurantActiveOrderSummary) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const operator = activeStaff ? activeStaff.name : 'Pemilik Kedai';
    const updated = TableService.bindActiveOrderToTable(tableNumber, orderSummary, operator, slug);
    setTables(updated);
    setTableAuditLogs(TableService.getAuditEntries(slug));
  };

  const saveTableDefinition = (
    tableData: Partial<RestaurantTable> & { tableNumber: string; capacity: number; zone: string }
  ) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const updated = TableService.saveTableDefinition(tableData, slug);
    setTables(updated);
  };

  const deleteTableDefinition = (tableId: string) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const updated = TableService.deleteTableDefinition(tableId, slug);
    setTables(updated);
  };

  const addTableReservation = (
    input: Omit<TableReservation, 'id' | 'createdAt' | 'updatedAt' | 'storeId'>
  ) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const operator = activeStaff ? activeStaff.name : 'Pemilik Kedai';
    const res = TableService.addReservation(input, operator, slug);
    setReservations(TableService.getReservations(slug));
    setTables(res.tables);
    setTableAuditLogs(TableService.getAuditEntries(slug));
  };

  const updateReservationStatus = (
    reservationId: string,
    newStatus: 'SEATED' | 'CANCELLED' | 'NO_SHOW'
  ) => {
    const currentRoute = typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { workspaceSlug: null };
    const slug = currentRoute.workspaceSlug || 'default';
    const operator = activeStaff ? activeStaff.name : 'Pemilik Kedai';
    const res = TableService.updateReservationStatus(reservationId, newStatus, operator, slug);
    setReservations(TableService.getReservations(slug));
    setTables(res.tables);
    setTableAuditLogs(TableService.getAuditEntries(slug));
  };

  return (
    <StoreContext.Provider
      value={{
        store,
        currentUser,
        products,
        movements,
        sales,
        suppliers,
        purchases,
        customers,
        loyaltyLedger,
        staffUsers,
        activeStaff,
        isLoading,
        isAdminMode,
        isPinModalOpen,
        openPinModal,
        closePinModal,
        enterAdminMode,
        exitAdminMode,
        requireAdmin,
        addProduct,
        importProducts,
        commitProductsUpsertImport,
        commitMasterCatalogSync,
        lastCatalogSyncInfo,
        updateProduct,
        toggleProductActive,
        deleteProduct,
        deactivateProduct,
        checkProductDeleteEligibility,
        isSkuAvailable,
        recordStockIn,
        recordAdjustment,
        recordReturn,
        processSale,
        addSupplier,
        updateSupplier,
        toggleSupplierActive,
        deleteSupplier,
        isSupplierCodeAvailable,
        commitSuppliersUpsertImport,
        createPurchase,
        completePurchase,
        createAndCompletePurchase,
        cancelPurchase,
        addCustomer,
        updateCustomer,
        toggleCustomerActive,
        deleteCustomer,
        isCustomerCodeAvailable,
        commitCustomersUpsertImport,
        awardLoyaltyPoints,
        redeemLoyaltyPoints,
        addStaff,
        updateStaff,
        toggleStaffActive,
        setActiveStaff,
        commitStaffUpsertImport,
        resetToDemo,
        clearAllStoreData,
        clearStoreCategories,
        updateStoreDetails,
        updateStore: updateStoreDetails,
        exportStoreData,
        downloadBackup,
        restoreStoreData,
        cloudSyncStatus,
        lastCloudSync,
        syncAllToCloud,
        pullAllFromCloud,
        businessConfig,
        updateBusinessConfig,
        applyBusinessTemplate,
        refreshBusinessConfig,
        menuItems,
        menuCategories,
        taxConfig,
        toggleMenuItemAvailability,
        saveMenuItem,
        deleteMenuItem,
        updateTaxConfig,
        tables,
        reservations,
        tableAuditLogs,
        updateTableStatus,
        bindActiveOrderToTable,
        saveTableDefinition,
        deleteTableDefinition,
        addTableReservation,
        updateReservationStatus,
        refreshTablesData,
      }}
    >
      {children}
      <AdminPinModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onSuccess={() => {
          setIsAdminMode(true);
          if (pendingAdminAction) {
            const actionToRun = pendingAdminAction;
            setPendingAdminAction(null);
            actionToRun();
          }
        }}
        actionDescription={adminActionDesc}
        workspaceSlug={AdminAuthService.detectActiveWorkspaceSlug() || undefined}
      />
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
