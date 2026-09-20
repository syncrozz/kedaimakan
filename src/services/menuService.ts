/**
 * SYNCROZZ KEDAI MAKAN - Menu Management Service (SES v4.5)
 * Menyediakan pengurusan menu restoran, modifier groups, dan ketersediaan manual (Tersedia / Habis).
 * Mengasingkan data menu secara selamat per workspace tanpa menjejaskan inventori runcit lama.
 */

import { MenuItem, MenuModifierGroup, RestaurantTaxConfig } from '../types/restaurant';

const MENU_STORAGE_PREFIX = 'syncrozz_menu_items_';
const TAX_CONFIG_PREFIX = 'syncrozz_tax_config_';

export const DEFAULT_TAX_CONFIG: RestaurantTaxConfig = {
  taxEnabled: false,
  taxName: 'SST',
  taxRatePercent: 0,
  isTaxInclusive: true, // Harga paparan merangkumi cukai secara lalai
  serviceChargeEnabled: false,
  serviceChargeName: 'Caj Perkhidmatan',
  serviceChargePercent: 0,
};

export const INITIAL_RESTAURANT_MENU: MenuItem[] = [
  {
    id: 'menu-01',
    storeId: 'default',
    code: 'M01',
    name: 'Nasi Lemak Ayam Berempah',
    category: 'Makanan Utama',
    price: 12.50,
    costPrice: 5.50,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Nasi lemak wangi, sambal tumis beringat, timun, kacang, ikan bilis & ayam goreng berempah rangup.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    storeId: 'default',
    code: 'M02',
    name: 'Mee Goreng Mamak Spesial',
    category: 'Makanan Utama',
    price: 8.50,
    costPrice: 3.20,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Mee kuning goreng basah dengan cucur udang, tauhu, taugeh & limau nipis.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    storeId: 'default',
    code: 'M03',
    name: 'Roti Canai Sarang Burung',
    category: 'Sarapan & Roti',
    price: 6.00,
    costPrice: 2.20,
    isAvailable: true,
    kitchenStation: 'KITCHEN',
    description: 'Dua biji telur separuh masak di tengah roti canai garing bersama kuah dhal & kari.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    storeId: 'default',
    code: 'D01',
    name: 'Teh Tarik Pandan Madu',
    category: 'Minuman',
    price: 3.50,
    costPrice: 1.10,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Teh tarik buih berkrim dengan aroma daun pandan wangi.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    storeId: 'default',
    code: 'D02',
    name: 'Kopi Kampung Kaw',
    category: 'Minuman',
    price: 3.20,
    costPrice: 0.90,
    isAvailable: true,
    kitchenStation: 'BAR',
    description: 'Bancuhan biji kopi kampung pekat tradisional.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    storeId: 'default',
    code: 'S01',
    name: 'Cendol Durian Pulut',
    category: 'Pencuci Mulut',
    price: 9.00,
    costPrice: 4.00,
    isAvailable: true,
    kitchenStation: 'DESSERT',
    description: 'Cendol santan sawit segar, gula melaka asli, pulut kukus dan ulas durian.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export class MenuService {
  private static getStorageKey(workspaceId: string = 'default'): string {
    return `${MENU_STORAGE_PREFIX}${workspaceId}`;
  }

  private static getTaxStorageKey(workspaceId: string = 'default'): string {
    return `${TAX_CONFIG_PREFIX}${workspaceId}`;
  }

  static getMenuItems(workspaceId: string = 'default'): MenuItem[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey(workspaceId));
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        // Authoritative data is authoritative: An empty array is a valid state
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      // Check if user has explicitly cleared or started empty
      const isCleared = localStorage.getItem(`syncrozz_menu_cleared_${workspaceId}`) === 'true';
      if (isCleared) {
        return [];
      }
    } catch (e) {
      console.warn('Gagal membaca cache menu dari localStorage:', e);
    }
    // Hanya jika storan belum wujud langsung bagi workspace baharu
    const initial = INITIAL_RESTAURANT_MENU.map(m => ({ ...m, storeId: workspaceId }));
    this.saveMenuItems(initial, workspaceId);
    return initial;
  }

  /**
   * Muat data contoh hanya atas permintaan jelas pengguna (Explicit User Action)
   */
  static loadSampleMenu(workspaceId: string = 'default'): MenuItem[] {
    const initial = INITIAL_RESTAURANT_MENU.map(m => ({ ...m, storeId: workspaceId }));
    this.saveMenuItems(initial, workspaceId);
    localStorage.removeItem(`syncrozz_menu_cleared_${workspaceId}`);
    return initial;
  }

  /**
   * Mengosongkan data menu tanpa kebangkitan semula automatik
   */
  static clearMenu(workspaceId: string = 'default'): void {
    this.saveMenuItems([], workspaceId);
    try {
      localStorage.setItem(`syncrozz_menu_cleared_${workspaceId}`, 'true');
    } catch (e) {
      console.error('Gagal menetapkan tanda menu kosong:', e);
    }
  }

  static saveMenuItems(items: MenuItem[], workspaceId: string = 'default'): void {
    try {
      localStorage.setItem(this.getStorageKey(workspaceId), JSON.stringify(items));
    } catch (e) {
      console.error('Gagal menyimpan menu ke localStorage:', e);
    }
  }

  static toggleAvailability(menuItemId: string, workspaceId: string = 'default'): MenuItem[] {
    const items = this.getMenuItems(workspaceId);
    const updated = items.map(item => {
      if (item.id === menuItemId) {
        return {
          ...item,
          isAvailable: !item.isAvailable,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });
    this.saveMenuItems(updated, workspaceId);
    return updated;
  }

  static saveMenuItem(itemData: Partial<MenuItem> & { name: string; price: number; category: string }, workspaceId: string = 'default'): MenuItem[] {
    const items = this.getMenuItems(workspaceId);
    const now = new Date().toISOString();

    if (itemData.id) {
      // Kemaskini
      const updated = items.map(it => {
        if (it.id === itemData.id) {
          return {
            ...it,
            ...itemData,
            updatedAt: now,
          } as MenuItem;
        }
        return it;
      });
      this.saveMenuItems(updated, workspaceId);
      return updated;
    } else {
      // Tambah baharu
      const newItem: MenuItem = {
        id: `menu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: workspaceId,
        code: itemData.code || `M${items.length + 1}`,
        name: itemData.name,
        category: itemData.category || 'Makanan Utama',
        price: Number(itemData.price) || 0,
        costPrice: Number(itemData.costPrice) || 0,
        isAvailable: itemData.isAvailable !== undefined ? itemData.isAvailable : true,
        kitchenStation: itemData.kitchenStation || 'KITCHEN',
        modifierGroups: itemData.modifierGroups || [],
        description: itemData.description || '',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [newItem, ...items];
      this.saveMenuItems(updated, workspaceId);
      return updated;
    }
  }

  static deleteMenuItem(menuItemId: string, workspaceId: string = 'default'): MenuItem[] {
    const items = this.getMenuItems(workspaceId);
    const updated = items.filter(it => it.id !== menuItemId);
    this.saveMenuItems(updated, workspaceId);
    return updated;
  }

  static getTaxConfig(workspaceId: string = 'default'): RestaurantTaxConfig {
    try {
      const raw = localStorage.getItem(this.getTaxStorageKey(workspaceId));
      if (raw) {
        return { ...DEFAULT_TAX_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Gagal membaca tax config dari localStorage:', e);
    }
    return DEFAULT_TAX_CONFIG;
  }

  static saveTaxConfig(config: RestaurantTaxConfig, workspaceId: string = 'default'): void {
    try {
      localStorage.setItem(this.getTaxStorageKey(workspaceId), JSON.stringify(config));
    } catch (e) {
      console.error('Gagal menyimpan tax config ke localStorage:', e);
    }
  }
}
