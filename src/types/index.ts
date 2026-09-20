/**
 * NiagaPOS - Core Domain Data Types & Interfaces
 * Part 01: Foundation & Application Architecture
 * Part 02: Product & Inventory Management
 */

export type UserRole = 'ADMIN' | 'CASHIER' | 'MANAGER' | 'INVENTORY_STAFF';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  storeId: string;
}

export interface StoreSettings {
  enableCustomers?: boolean;
  enableCustomerManagement?: boolean;
  enableLoyalty?: boolean;
  enableStaff?: boolean;
  defaultCashierId?: string; // 'store-owner' or specific staff id. Defaults to 'store-owner' if not set
  loyaltyPointsPerCurrency?: number; // e.g. 1 point per RM 1 (default: 1)
  loyaltyRedemptionRatio?: number; // e.g. 100 points = RM 1 (default: 100)
}

export interface Store {
  id: string;
  name: string;
  code: string;
  currency: string; // e.g. "RM"
  tagline?: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
  settings?: StoreSettings;
  createdAt: string;
  updatedAt: string;
}

export type StockStatus = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  storeId: string; // Product belongs to store context (multi-store ready)
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  costPrice: number; // Cost price stored as data
  sellingPrice: number; // Selling price stored as data
  currentStock: number; // Current on-hand quantity
  minimumStock: number; // Reorder alert threshold
  active: boolean; // Inactive products cannot be sold
  imageUrl?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType = 'STOCK_IN' | 'SALE' | 'ADJUSTMENT' | 'RETURN';

export interface InventoryMovement {
  id: string;
  storeId: string;
  productId: string;
  productName?: string; // Cache for display convenience
  type: InventoryMovementType;
  quantity: number; // Positive for stock-in/return, negative for sale/downward adjustment
  previousStock: number;
  newStock: number;
  referenceId?: string; // Reference transaction (e.g. TRX-0001 or PO-001)
  reason: string; // Mandatory explanation for traceability
  adjustedBySnapshot?: string; // Optional staff attribution
  createdAt: string;
}

export type SaleStatus = 'COMPLETED' | 'REFUNDED' | 'VOID';

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'E_WALLET' | 'OTHER';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productNameSnapshot: string; // Snapshot at transaction time
  sku?: string;
  quantity: number;
  unitCostSnapshot: number; // Snapshot of cost at sale time (preserves historical COGS)
  unitSellingPriceSnapshot: number; // Snapshot of selling price at sale time
  lineTotal: number; // quantity * unitSellingPriceSnapshot
  allocatedDiscount?: number; // Allocated cart-level discount for this line item
  actualRevenue?: number; // lineTotal - (allocatedDiscount || 0)
  lineCost: number; // quantity * unitCostSnapshot
  grossProfit: number; // actualRevenue - lineCost
}

export interface Sale {
  id: string;
  storeId: string;
  transactionNumber: string; // e.g. SALE-000001
  dateTime: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax?: number; // 0 for now
  total: number; // subtotal - discount + tax
  paymentMethod?: PaymentMethod; // Supported: 'CASH'
  cashReceived?: number;
  change?: number;
  totalCost: number; // Sum of lineCost for COGS
  grossProfit: number; // total - totalCost
  status: SaleStatus;
  // Optional customer attribution (Part 07)
  customerId?: string | null;
  customerIdSnapshot?: string | null;
  customerNameSnapshot?: string | null;
  // Optional staff attribution (Part 07)
  cashierIdSnapshot?: string;
  cashierNameSnapshot?: string;
  // Optional loyalty points tracking (Part 07)
  pointsEarned?: number;
  pointsRedeemed?: number;
  notes?: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Supplier {
  id: string;
  supplierCode: string; // e.g. "SUP-001", unique across active/inactive
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitCost: number;
  discount?: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string; // e.g. "PUR-000001"
  supplierId: string;
  supplierCodeSnapshot: string;
  supplierNameSnapshot: string;
  purchaseDate: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  createdBySnapshot?: string; // Optional staff attribution
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Part 07: Optional Retail Modules (Customer, Loyalty, Staff)
// -------------------------------------------------------------

export interface Customer {
  id: string;
  customerCode: string; // e.g. "CUS-000001", sequential & unique
  customerName: string;
  phone?: string;
  email?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyEntryType = 'EARNED' | 'REDEEMED' | 'ADJUSTMENT';

export interface LoyaltyLedgerEntry {
  id: string;
  customerId: string;
  points: number; // positive for earned, negative for redeemed
  type: LoyaltyEntryType;
  referenceId: string; // e.g. transactionNumber "SALE-000001" or "REWARD-000001"
  description: string;
  createdAt: string;
  dateTime?: string;
}

export type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'INVENTORY_STAFF';

export interface StaffUser {
  id: string;
  userCode: string; // e.g. "STF-001"
  staffCode?: string; // alias for compatibility
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActivePage =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'pos'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'reports'
  | 'settings'
  | 'konsol'
  | 'kds';

export interface StoreBackupManifest {
  storeName: string;
  workspaceSlug?: string;
  schemaVersion: number;
  productsCount: number;
  salesCount: number;
  suppliersCount: number;
  purchasesCount: number;
  customersCount: number;
  staffCount: number;
  movementsCount: number;
  menuItemsCount?: number;
  tablesCount?: number;
  exportedAt: string;
}

export interface StoreBackupPayload {
  schemaVersion: number;
  system: string;
  exportedAt: string;
  workspaceSlug?: string;
  manifest?: StoreBackupManifest;
  store: Store;
  products: Product[];
  movements: InventoryMovement[];
  sales: Sale[];
  suppliers: Supplier[];
  purchases: Purchase[];
  customers: Customer[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  staffUsers: StaffUser[];
  menuItems?: any[];
  tables?: any[];
  businessConfig?: any;
  taxConfig?: any;
  reservations?: any[];
}

export type CsvImportMode = 'MASTER_SYNC' | 'SKIP_EXISTING' | 'UPDATE_EXISTING';

export interface ProductCatalogUpdatePayload {
  existingProductId: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  minimumStock: number;
  active: boolean;
  imageUrl?: string;
  ignoredCsvStock?: number;
}

export interface CommitUpsertPayload {
  mode: CsvImportMode;
  newItems: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[];
  updateItems: ProductCatalogUpdatePayload[];
  skippedCount?: number;
  invalidCount?: number;
}

export interface UpsertImportCommitResult {
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  invalidCount: number;
}

export type MasterSyncAction = 'NEW' | 'UPDATE' | 'UNCHANGED' | 'INVALID';

export interface MasterSyncProductRow {
  rowNumber: number;
  action: MasterSyncAction;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  csvStock: number;
  currentStock?: number;
  stockDifference?: number;
  minimumStock: number;
  active: boolean;
  imageUrl?: string;
  imageUrlChanged?: boolean;
  reason: string;
  stockNote: string;
  existingProductId?: string;
  costChanged?: boolean;
  sellingPriceChanged?: boolean;
  stockChanged?: boolean;
  rawRow: Record<string, string>;
}

export interface MasterSyncMissingProduct {
  product: Product;
  action: 'DEACTIVATE' | 'REMOVE';
  reason: string;
  hasHistoricalReferences: boolean;
}

export interface MasterCatalogSyncValidationResult {
  totalRows: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  stockAdjustmentsCount: number;
  stockIncreaseCount: number;
  stockDecreaseCount: number;
  invalidCount: number;
  missingProductsCount: number;
  deactivatedCount: number;
  removedCount: number;
  rows: MasterSyncProductRow[];
  missingProducts: MasterSyncMissingProduct[];
  errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[];
  isValid: boolean;
}

export interface MasterCatalogSyncPayload {
  filename?: string;
  validatedRows: MasterSyncProductRow[];
  missingProducts: MasterSyncMissingProduct[];
}

export interface MasterCatalogSyncCommitResult {
  success: boolean;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  stockAdjustmentsCount: number;
  deactivatedCount: number;
  removedCount: number;
  invalidCount: number;
  backupSnapshotAt: string;
  message: string;
}

export interface LastCatalogSyncInfo {
  importedFilename: string;
  importedAt: string;
  totalRows: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  stockAdjustmentsCount: number;
  deactivatedCount: number;
  removedCount: number;
}

// SYNCROZZ KEDAI MAKAN - Domain Restoran Extensions (SES v4.5)
export * from './restaurant';


