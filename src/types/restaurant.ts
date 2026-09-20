/**
 * SYNCROZZ KEDAI MAKAN - Definisi Domain Restoran (SES v4.5)
 * Memelihara integriti data, modular, dan tidak merosakkan data sedia ada NiagaPOS V2.
 */

export type RestaurantOrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type TableStatus = 
  | 'AVAILABLE' 
  | 'OCCUPIED' 
  | 'WAITING_PAYMENT' 
  | 'RESERVED' 
  | 'CLEANING' 
  | 'UNAVAILABLE';

export type KitchenStation = 'KITCHEN' | 'BAR' | 'DESSERT';

export interface MenuVariant {
  id: string;
  name: string; // cth: "Biasa", "Besar", "Panas", "Sejuk", "Bungkus"
  price: number; // Harga jualan bagi variasi ini (RM)
  costPrice?: number;
  isDefault?: boolean;
}

export interface MenuModifierOption {
  id: string;
  name: string; // cth: "Ais", "Kurang Manis", "Telur Mata", "Extra Sambal"
  price: number; // Caj tambahan (RM)
}

export interface MenuModifierGroup {
  id: string;
  name: string; // cth: "Pilihan Suhu", "Tambahan Lauk", "Pilihan Saiz"
  minSelection: number; // 0 = pilihan, 1 = wajib
  maxSelection: number; // 1 = pilihan tunggal, >1 = pilihan pelbagai
  options: MenuModifierOption[];
}

export interface MenuItem {
  id: string;
  storeId: string;
  code: string; // cth: "M-01", "D-03"
  name: string; // cth: "Nasi Lemak Ayam Berempah"
  category: string; // cth: "Makanan Utama", "Minuman", "Sampingan"
  price: number; // Harga jualan asas dalam RM
  costPrice: number; // Anggaran kos
  isAvailable: boolean; // Kawalan ketersediaan manual (Tersedia / Habis)
  kitchenStation: KitchenStation;
  modifierGroups?: MenuModifierGroup[];
  variants?: MenuVariant[]; // Variasi saiz atau pilihan harga berbeza
  imageUrl?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedModifierSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface SelectedVariantSnapshot {
  id: string;
  name: string;
  price: number;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'NONE';

export interface RestaurantOrderItem {
  id: string; // ID unik bagi baris pesanan
  menuItemId: string;
  nameSnapshot: string;
  categorySnapshot: string;
  kitchenStation: KitchenStation;
  basePriceSnapshot: number; // Harga asas satu unit (mengambil kira variasi jika dipilih)
  selectedVariant?: SelectedVariantSnapshot; // Snapshot variasi terpilih
  selectedModifiers: SelectedModifierSnapshot[];
  unitTotal: number; // basePriceSnapshot + jumlah modifiers per unit
  quantity: number;

  // Kawalan Diskaun Item (SES v4.5)
  discountType: DiscountType;
  discountValue: number; // Nilai diskaun dimasukkan (% atau RM)
  discountAmount: number; // Jumlah potongan diskaun dalam RM untuk baris item ini
  discountApprovedBy?: 'CASHIER' | 'OWNER';
  isLockedAfterApproval?: boolean;

  lineTotal: number; // (unitTotal * quantity) - discountAmount (tidak boleh kurang daripada 0)
  specialInstructions?: string; // cth: "Kurang manis", "Tanpa taugeh"
}

export interface RestaurantTaxConfig {
  taxEnabled: boolean;
  taxName: string; // Nama cukai boleh dikonfigurasikan Owner (cth: "SST", "Cukai Jualan")
  taxRatePercent: number; // Peratusan boleh dikonfigurasikan (cth: 0%, 6%, 8%)
  isTaxInclusive: boolean; // True jika harga menu sudah merangkumi cukai
  serviceChargeEnabled: boolean;
  serviceChargeName: string; // cth: "Caj Perkhidmatan"
  serviceChargePercent: number; // Peratusan boleh dikonfigurasikan (cth: 0%, 5%, 10%)
}

export interface RestaurantOrderHeader {
  orderType: RestaurantOrderType;
  tableNumber?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

// ==========================================
// TABLE MANAGEMENT & RESERVATION (FASA 3 - SES v4.5)
// ==========================================

export interface TableStatusAuditEntry {
  id: string;
  tableId: string;
  tableNumber: string;
  previousStatus: TableStatus;
  newStatus: TableStatus;
  changedBy: string; // Cashier / Owner / System
  timestamp: string; // ISO 8601
  reason?: string;
  orderId?: string;
}

export interface TableReservation {
  id: string;
  storeId: string;
  tableId: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  pax: number;
  reservationTime: string; // ISO 8601 or HH:mm / YYYY-MM-DDTHH:mm
  reservationDate?: string; // YYYY-MM-DD
  notes?: string;
  status: 'PENDING' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantActiveOrderSummary {
  orderId: string;
  orderType: RestaurantOrderType;
  tableNumber: string;
  pax: number;
  itemsCount: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  openedAt: string;
  items: RestaurantOrderItem[];
}

export interface RestaurantTable {
  id: string;
  storeId: string; // Tenant / Workspace ID
  tableNumber: string; // cth: "T01", "T02", "VIP1", "VIP2"
  zone: string; // cth: "Dalam", "Luar / Terbuka", "Meja VIP"
  capacity: number; // Bilangan kerusi (pax)
  status: TableStatus;
  currentOrderId?: string;
  activeOrder?: RestaurantActiveOrderSummary;
  activeGuestCount?: number;
  occupiedSince?: string;
  activeReservation?: TableReservation;
  upcomingReservations?: TableReservation[];
  updatedAt: string;
}

// ==========================================
// KITCHEN ORDER TICKET (KOT) & KITCHEN DISPLAY SYSTEM (KDS)
// FASA 3 — STEP 2 (SES v4.5)
// ==========================================

export type KitchenTicketStatus = 'NEW' | 'PREPARING' | 'READY' | 'ARCHIVED';

export type KitchenItemChangeType = 'ORIGINAL' | 'ADDED' | 'REMOVED' | 'UPDATED';

export interface KitchenOrderItemSnapshot {
  itemId: string;
  productId: string;
  name: string;
  quantity: number;
  previousQuantity?: number;
  variant?: string;
  modifiers?: string[];
  notes?: string;
  unitPrice: number;
  changeType: KitchenItemChangeType;
  category?: string;
  kitchenStation?: KitchenStation;
  updatedAt?: string;
}

export interface KitchenOrderChangeHistoryEntry {
  timestamp: string; // ISO 8601
  changeDescription: string;
  changedBy: string;
  itemsSummary: string;
  previousStatus?: KitchenTicketStatus;
  newStatus?: KitchenTicketStatus;
}

export interface KitchenOrderTicket {
  id: string; // KOT unique ID (e.g. KOT-171800-123)
  workspaceSlug: string; // Tenant isolation key
  orderId: string; // Reference to POS order
  orderNumber: string; // Short readable order reference (e.g. ORD-123456)
  tableId?: string;
  tableName?: string; // e.g. "T01" or "Meja 1"
  orderType: RestaurantOrderType; // DINE_IN | TAKEAWAY | DELIVERY
  status: KitchenTicketStatus; // NEW | PREPARING | READY | ARCHIVED
  items: KitchenOrderItemSnapshot[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  startedAt?: string; // When moved to PREPARING
  readyAt?: string; // When moved to READY
  archivedAt?: string; // When moved to ARCHIVED (auto-archive after 5m)
  hasUnreadUpdate: boolean; // Visual marker for unread updates/changes
  customerName?: string;
  guestCount?: number;
  notes?: string;
  operator?: string;
  changeHistory?: KitchenOrderChangeHistoryEntry[];
}

export interface KitchenAuditRecord {
  id: string;
  workspaceSlug: string;
  kotId: string;
  orderId: string;
  action: 'KOT_CREATED' | 'STATUS_CHANGED' | 'ORDER_MODIFIED' | 'AUTO_ARCHIVED' | 'MANUAL_ARCHIVED' | 'KITCHEN_LOGIN' | 'KITCHEN_LOGOUT';
  performedBy: string;
  timestamp: string;
  previousStatus?: KitchenTicketStatus;
  newStatus?: KitchenTicketStatus;
  details?: Record<string, unknown>;
}

export interface KitchenAuthSession {
  token: string;
  workspaceSlug: string;
  role: 'KITCHEN';
  authenticatedAt: string;
  expiresAt: number;
}

// ==========================================
// BUSINESS TEMPLATE & CONFIGURATION ENGINE
// SES v4.5 — ARCHITECTURE ADJUSTMENT
// ==========================================

export type BusinessTemplateId = 'MAMAK_CAPATI' | 'TOMYAM' | 'CAFE' | 'GERAI' | 'CUSTOM';

export type TableManagementMode = 'FULL' | 'TABLE_NUMBER_ONLY' | 'DISABLED';

export interface KitchenStationDefinition {
  id: string; // cth: "KITCHEN", "BAR", "DESSERT", "GRILL"
  name: string; // cth: "Dapur Panas", "Bar Minuman", "Kaunter Roti & Capati"
  description?: string;
}

export interface BusinessTemplate {
  id: BusinessTemplateId;
  name: string; // cth: "Mamak / Capati (Wali Capati Nan)"
  subtitle: string;
  description: string;
  badge: string;
  defaultOrderTypes: RestaurantOrderType[];
  tableMode: TableManagementMode;
  defaultPax: number;
  defaultCategories: string[];
  kitchenStations: KitchenStationDefinition[];
  sampleModifiers: MenuModifierGroup[];
  sampleMenuItems: Omit<MenuItem, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[];
}

export interface BusinessConfiguration {
  workspaceSlug: string;
  templateId: BusinessTemplateId;
  templateName: string;
  enabledOrderTypes: RestaurantOrderType[]; // Pilihan jenis pesanan yang diaktifkan
  tableMode: TableManagementMode; // Mod pengurusan meja
  defaultPax: number;
  categories: string[];
  kitchenStations: KitchenStationDefinition[];
  appliedAt: string;
  updatedAt: string;
}


