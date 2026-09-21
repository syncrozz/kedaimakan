/**
 * SYNCROZZ KEDAI MAKAN - Official Demo Seed Dataset (SES v4.5)
 * Versioned, reproducible, deterministic seed isolated strictly to the Demo Sandbox.
 * 
 * Rules:
 * 1. Strict extension of existing INITIAL_RESTAURANT_MENU & INITIAL_RESTAURANT_TABLES.
 * 2. Deterministic IDs for all entities (no random ID generation during seeding).
 * 3. Dynamic verification helpers (no hardcoded count assumptions).
 * 4. Configurable RestaurantTaxConfig without hardcoded tax rate assertions.
 */

import { MenuItem, RestaurantTable, TableReservation, KitchenOrderTicket, RestaurantTaxConfig } from '../types/restaurant';
import { Customer, Product } from '../types';

export const DEMO_SEED_VERSION = '1.0.0';
export const DEMO_WORKSPACE_ID = 'ws_demo_sandbox_001';
export const DEMO_WORKSPACE_SLUG = 'demo';
export const DEMO_WORKSPACE_NAME = 'Kedai Makan Demo (Sandbox)';

export interface DemoOfficialSeedData {
  version: string;
  workspaceId: string;
  workspaceSlug: string;
  menuItems: MenuItem[];
  tables: RestaurantTable[];
  reservations: TableReservation[];
  sampleKotTickets: KitchenOrderTicket[];
  taxConfig: RestaurantTaxConfig;
  customers: Customer[];
  products: Product[];
}

export const DEMO_TAX_CONFIG: RestaurantTaxConfig = {
  taxEnabled: true,
  taxName: 'SST',
  taxRatePercent: 6,
  isTaxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeName: 'Caj Perkhidmatan',
  serviceChargePercent: 0,
};

export const DEMO_SEED_MENU_ITEMS: MenuItem[] = [
  // 1-6: Verbatim preservation of existing INITIAL_RESTAURANT_MENU
  {
    id: 'menu-01',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M01',
    name: 'Nasi Lemak Ayam Berempah',
    category: 'Makanan Utama',
    price: 12.50,
    costPrice: 5.50,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Nasi lemak wangi, sambal tumis beringat, timun, kacang, ikan bilis & ayam goreng berempah rangup.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-nl-sambal',
        name: 'Pilihan Sambal & Kepedasan',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-sambal-biasa', name: 'Sambal Biasa (Pedas Manis)', price: 0 },
          { id: 'opt-sambal-pedas', name: 'Sambal Extra Pedas', price: 0 },
          { id: 'opt-sambal-asing', name: 'Sambal Asing', price: 0 }
        ]
      },
      {
        id: 'mod-nl-lauk',
        name: 'Tambahan Lauk',
        minSelection: 0,
        maxSelection: 3,
        options: [
          { id: 'opt-telur-mata', name: 'Telur Mata Goyang', price: 1.50 },
          { id: 'opt-sambal-sotong', name: 'Sambal Sotong', price: 4.00 },
          { id: 'opt-rendang-daging', name: 'Rendang Daging Tok', price: 4.50 },
          { id: 'opt-extra-nasi', name: 'Tambah Nasi Lemak', price: 2.00 }
        ]
      }
    ]
  },
  {
    id: 'menu-02',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M02',
    name: 'Mee Goreng Mamak Spesial',
    category: 'Makanan Utama',
    price: 8.50,
    costPrice: 3.20,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Mee kuning goreng basah dengan cucur udang, tauhu, taugeh & limau nipis.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-mee-telur',
        name: 'Pilihan Telur',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-telur-mata-mee', name: 'Tambah Telur Mata', price: 1.50 },
          { id: 'opt-telur-dada', name: 'Tambah Telur Dadar', price: 2.00 }
        ]
      },
      {
        id: 'mod-mee-pedas',
        name: 'Tahap Pedas',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-kurang-pedas', name: 'Kurang Pedas', price: 0 },
          { id: 'opt-pedas-kaw', name: 'Pedas Kaw (+Cili Padi)', price: 0.50 }
        ]
      }
    ]
  },
  {
    id: 'menu-03',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M03',
    name: 'Roti Canai Sarang Burung',
    category: 'Sarapan & Roti',
    price: 6.00,
    costPrice: 2.20,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Dua biji telur separuh masak di tengah roti canai garing bersama kuah dhal & kari.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-kuah',
        name: 'Pilihan Kuah',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-kuah-campur', name: 'Kuah Campur (Kari + Dhal + Sambal)', price: 0 },
          { id: 'opt-kuah-dhal', name: 'Dhal Sahaja', price: 0 },
          { id: 'opt-kuah-kari', name: 'Kari Ikan Sahaja', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'menu-04',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'D01',
    name: 'Teh Tarik Pandan Madu',
    category: 'Minuman',
    price: 3.50,
    costPrice: 1.10,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Teh tarik buih berkrim dengan aroma daun pandan wangi.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-teh-suhu',
        name: 'Suhu & Saiz',
        minSelection: 1,
        maxSelection: 1,
        options: [
          { id: 'opt-teh-panas', name: 'Panas', price: 0 },
          { id: 'opt-teh-ais', name: 'Ais (Sejuk)', price: 0.50 }
        ]
      },
      {
        id: 'mod-teh-manis',
        name: 'Kemanisan',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-kurang-manis', name: 'Kurang Manis (Kurang Gula/Susu)', price: 0 },
          { id: 'opt-manis-biasa', name: 'Manis Sedang', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'menu-05',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'D02',
    name: 'Kopi Kampung Kaw',
    category: 'Minuman',
    price: 3.20,
    costPrice: 0.90,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Bancuhan biji kopi kampung pekat tradisional.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-kopi-suhu',
        name: 'Pilihan Suhu',
        minSelection: 1,
        maxSelection: 1,
        options: [
          { id: 'opt-kopi-panas', name: 'Panas', price: 0 },
          { id: 'opt-kopi-ais', name: 'Ais', price: 0.50 }
        ]
      }
    ]
  },
  {
    id: 'menu-06',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'S01',
    name: 'Cendol Durian Pulut',
    category: 'Pencuci Mulut',
    price: 9.00,
    costPrice: 4.00,
    isAvailable: true,
    kitchenStation: 'DESSERT',
    description: 'Cendol santan sawit segar, gula melaka asli, pulut kukus dan ulas durian.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  // 7-12: Authentic Extensions
  {
    id: 'menu-07',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M04',
    name: 'Nasi Goreng Kampung Berapi',
    category: 'Makanan Utama',
    price: 9.50,
    costPrice: 3.50,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Nasi digoreng wangi bersama kangkung segar, ikan bilis tumbuk garing dan cili padi kampung.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modifierGroups: [
      {
        id: 'mod-ngk-telur',
        name: 'Pilihan Telur',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-ngk-telur-mata', name: 'Telur Mata', price: 1.50 },
          { id: 'opt-ngk-telur-dadar', name: 'Telur Dadar', price: 2.00 }
        ]
      }
    ]
  },
  {
    id: 'menu-08',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M05',
    name: 'Kuey Teow Goreng Kerang Basah',
    category: 'Makanan Utama',
    price: 9.00,
    costPrice: 3.40,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Kuey teow digoreng panas aroma kuali dengan kerang segar, taugeh rangup dan kuchai.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'menu-09',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'M06',
    name: 'Sup Daging Utk Tok & Nasi',
    category: 'Makanan Utama',
    price: 13.00,
    costPrice: 5.80,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Sup herba tulang empuk berempah ratus, dihidang bersama semangkuk nasi putih dan sambal kicap.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'menu-10',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'D03',
    name: 'Teh O Ais Limau Kasturi',
    category: 'Minuman',
    price: 3.00,
    costPrice: 0.70,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Minuman teh segar bersama perahan limau kasturi asli yang menyejukkan tekak.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'menu-11',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'D04',
    name: 'Sirap Bandung Cincau Selasih',
    category: 'Minuman',
    price: 4.00,
    costPrice: 1.20,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Campuran sirap ros manis, susu sejat berkrim, cincau hitam dan biji selasih.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'menu-12',
    storeId: DEMO_WORKSPACE_SLUG,
    code: 'S02',
    name: 'Pisang Goreng Cheese Coklat',
    category: 'Pencuci Mulut',
    price: 7.50,
    costPrice: 2.80,
    isAvailable: true,
    kitchenStation: 'DESSERT',
    description: 'Pisang tanduk digoreng garing bersalut limpahan keju cheddar parut dan sos coklat pekat.',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

export const DEMO_SEED_TABLES: RestaurantTable[] = [
  // Preserving tbl-01 to tbl-08 + adding tbl-09 & tbl-10
  {
    id: 'tbl-01',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T01',
    zone: 'Dalam',
    capacity: 4,
    status: 'OCCUPIED',
    currentOrderId: 'order-demo-01',
    occupiedSince: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
  },
  {
    id: 'tbl-02',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T02',
    zone: 'Dalam',
    capacity: 2,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-03',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T03',
    zone: 'Dalam',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-04',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T04',
    zone: 'Dalam',
    capacity: 6,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-05',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T05',
    zone: 'Luar / Terbuka',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-06',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T06',
    zone: 'Luar / Terbuka',
    capacity: 4,
    status: 'OCCUPIED',
    currentOrderId: 'order-demo-02',
    occupiedSince: '2026-01-01T12:15:00.000Z',
    updatedAt: '2026-01-01T12:15:00.000Z',
  },
  {
    id: 'tbl-07',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T07',
    zone: 'Luar / Terbuka',
    capacity: 8,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-08',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'VIP1',
    zone: 'Meja VIP',
    capacity: 10,
    status: 'RESERVED',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-09',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'T08',
    zone: 'Luar / Terbuka',
    capacity: 2,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tbl-10',
    storeId: DEMO_WORKSPACE_SLUG,
    tableNumber: 'VIP2',
    zone: 'Meja VIP',
    capacity: 10,
    status: 'AVAILABLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
];

export const DEMO_SEED_RESERVATIONS: TableReservation[] = [
  {
    id: 'res-demo-01',
    storeId: DEMO_WORKSPACE_ID,
    tableId: 'tbl-08',
    tableNumber: 'T08',
    customerName: 'Dato Seri Azlan',
    customerPhone: '012-3456789',
    reservationTime: '2026-01-01T20:00:00.000Z',
    pax: 8,
    notes: 'Makan malam keluarga. Sediakan kerusi bayi.',
    status: 'PENDING',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
];

export const DEMO_SEED_KOT_TICKETS: KitchenOrderTicket[] = [
  {
    id: 'kot-demo-01',
    workspaceSlug: DEMO_WORKSPACE_SLUG,
    orderId: 'order-demo-01',
    orderNumber: 'ORD-101',
    tableId: 'tbl-01',
    tableName: 'T01',
    orderType: 'DINE_IN',
    status: 'PREPARING',
    hasUnreadUpdate: false,
    items: [
      {
        itemId: 'kot-item-01',
        productId: 'menu-01',
        name: 'Nasi Lemak Ayam Berempah',
        quantity: 2,
        notes: 'Sambal asing, 1 telur mata goyang',
        modifiers: ['Sambal Asing', 'Telur Mata Goyang'],
        unitPrice: 12.5,
        changeType: 'ORIGINAL',
        kitchenStation: 'KITCHEN',
      },
    ],
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:05:00.000Z',
  },
  {
    id: 'kot-demo-02',
    workspaceSlug: DEMO_WORKSPACE_SLUG,
    orderId: 'order-demo-02',
    orderNumber: 'ORD-102',
    tableId: 'tbl-06',
    tableName: 'T06',
    orderType: 'DINE_IN',
    status: 'READY',
    hasUnreadUpdate: false,
    items: [
      {
        itemId: 'kot-item-02',
        productId: 'menu-02',
        name: 'Mee Goreng Mamak Spesial',
        quantity: 1,
        notes: 'Pedas kaw',
        modifiers: ['Pedas Kaw (+Cili Padi)'],
        unitPrice: 9.0,
        changeType: 'ORIGINAL',
        kitchenStation: 'KITCHEN',
      },
    ],
    createdAt: '2026-01-01T12:15:00.000Z',
    updatedAt: '2026-01-01T12:22:00.000Z',
  },
];

export const DEMO_SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-demo-01',
    customerCode: 'CUS-000001',
    customerName: 'Ahmad Faiz',
    phone: '013-9876543',
    email: 'faiz.ahmad@example.com',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cust-demo-02',
    customerCode: 'CUS-000002',
    customerName: 'Siti Nurhaliza',
    phone: '017-8889999',
    email: 'siti.vip@example.com',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEMO_SEED_PRODUCTS: Product[] = [
  {
    id: 'prod-demo-01',
    storeId: DEMO_WORKSPACE_ID,
    sku: 'SAMBAL-BOTOL-01',
    barcode: 'SAMBAL-BOTOL-01',
    name: 'Sambal Ikan Bilis Berapi (Botol)',
    category: 'Produk Bungkus',
    costPrice: 8.0,
    sellingPrice: 15.0,
    currentStock: 25,
    minimumStock: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-demo-02',
    storeId: DEMO_WORKSPACE_ID,
    sku: 'KOPI-BUBUK-01',
    barcode: 'KOPI-BUBUK-01',
    name: 'Serbuk Kopi Kampung 500g',
    category: 'Produk Bungkus',
    costPrice: 7.0,
    sellingPrice: 14.0,
    currentStock: 18,
    minimumStock: 4,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEMO_OFFICIAL_SEED: DemoOfficialSeedData = {
  version: DEMO_SEED_VERSION,
  workspaceId: DEMO_WORKSPACE_ID,
  workspaceSlug: DEMO_WORKSPACE_SLUG,
  menuItems: DEMO_SEED_MENU_ITEMS,
  tables: DEMO_SEED_TABLES,
  reservations: DEMO_SEED_RESERVATIONS,
  sampleKotTickets: DEMO_SEED_KOT_TICKETS,
  taxConfig: DEMO_TAX_CONFIG,
  customers: DEMO_SEED_CUSTOMERS,
  products: DEMO_SEED_PRODUCTS,
};

/**
 * Dynamic count helpers derived authoritatively from DEMO_OFFICIAL_SEED.
 * Never hardcodes expected counts in assertions!
 */
export function getSeedExpectedCounts() {
  return {
    menuItems: DEMO_OFFICIAL_SEED.menuItems.length,
    tables: DEMO_OFFICIAL_SEED.tables.length,
    reservations: DEMO_OFFICIAL_SEED.reservations.length,
    kotTickets: DEMO_OFFICIAL_SEED.sampleKotTickets.length,
    customers: DEMO_OFFICIAL_SEED.customers.length,
    products: DEMO_OFFICIAL_SEED.products.length,
    categories: Array.from(new Set(DEMO_OFFICIAL_SEED.menuItems.map(m => m.category))).length,
    zones: Array.from(new Set(DEMO_OFFICIAL_SEED.tables.map(t => t.zone))).length,
    stations: Array.from(new Set(DEMO_OFFICIAL_SEED.menuItems.map(m => m.kitchenStation || 'KITCHEN'))).length,
  };
}
