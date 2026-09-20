/**
 * SYNCROZZ KEDAI MAKAN - Business Template & Flexible Configuration Engine
 * SES v4.5 Locked Architecture
 * 
 * Implements:
 * - Extensible Business Templates: Mamak / Capati (Wali Capati Nan), Tomyam, Cafe, Gerai, Custom
 * - Tenant-Isolated Business Configuration (workspaceSlug)
 * - Safe Non-destructive Migrations & Fallbacks
 * - Flexible Order Types (Dine-in, Takeaway, Delivery)
 * - Table Management Modes (Full 6-status grid, Table Number Only, Disabled)
 * - Custom Kitchen Stations
 */

import {
  BusinessTemplate,
  BusinessTemplateId,
  BusinessConfiguration,
  TableManagementMode,
  RestaurantOrderType,
  KitchenStationDefinition,
  MenuItem,
} from '../types/restaurant';
import { MenuService } from './menuService';
import { TableService } from './tableService';

const BIZ_CONFIG_PREFIX = 'syncrozz_biz_config_';

export const BUSINESS_TEMPLATES: Record<BusinessTemplateId, BusinessTemplate> = {
  MAMAK_CAPATI: {
    id: 'MAMAK_CAPATI',
    name: 'Mamak / Capati (Wali Capati Nan)',
    subtitle: 'Roti canai, capati, masakan panas & teh tarik buih',
    description: 'Sesuai untuk restoran mamak 24 jam, kedai capati dan roti canai. Menyokong pesanan meja laju, pelbagai kuah, variasi panas/sejuk/bungkus serta routing ke Dapur Panas dan Bar Minuman.',
    badge: 'Popular • Capati / Mamak',
    defaultOrderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
    tableMode: 'FULL',
    defaultPax: 2,
    defaultCategories: [
      'Roti & Capati',
      'Makanan Panas / Goreng',
      'Minuman',
      'Lauk & Kuah Tambahan',
    ],
    kitchenStations: [
      { id: 'KITCHEN', name: 'Dapur Panas & Goreng', description: 'Masakan goreng, kuali, mi & capati' },
      { id: 'BAR', name: 'Bar Minuman & Teh Tarik', description: 'Bancuhan teh, kopi, sirap & jus' },
    ],
    sampleModifiers: [
      {
        id: 'mod-teh-suhu-wali',
        name: 'Pilihan Suhu & Format',
        minSelection: 1,
        maxSelection: 1,
        options: [
          { id: 'opt-teh-panas', name: 'Panas', price: 0 },
          { id: 'opt-teh-sejuk', name: 'Sejuk (Ais)', price: 0.50 },
          { id: 'opt-teh-bungkus', name: 'Bungkus Ikat Tepi (+RM0.20)', price: 0.20 },
        ],
      },
      {
        id: 'mod-teh-kemanisan',
        name: 'Tahap Manis',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-kurang-manis', name: 'Kurang Manis', price: 0 },
          { id: 'opt-manis-biasa', name: 'Manis Sedang', price: 0 },
          { id: 'opt-kaw', name: 'Kaw / Pekat', price: 0 },
        ],
      },
      {
        id: 'mod-kuah-roti',
        name: 'Pilihan Kuah Utama',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-kuah-campur', name: 'Kuah Campur (Kari + Dhal + Sambal)', price: 0 },
          { id: 'opt-kuah-dhal', name: 'Dhal Sahaja', price: 0 },
          { id: 'opt-kuah-kari', name: 'Kari Ikan Sahaja', price: 0 },
        ],
      },
    ],
    sampleMenuItems: [
      {
        code: 'W01',
        name: 'Teh Tarik Pandan Madu',
        category: 'Minuman',
        price: 2.50,
        costPrice: 0.90,
        isAvailable: true,
        kitchenStation: 'BAR',
        description: 'Bancuhan daun teh wangi pekat berbuih.',
        active: true,
        variants: [
          { id: 'var-panas', name: 'Panas', price: 2.50, costPrice: 0.90, isDefault: true },
          { id: 'var-sejuk', name: 'Sejuk (Ais)', price: 3.00, costPrice: 1.10 },
          { id: 'var-bungkus', name: 'Bungkus Ikat Tepi', price: 3.20, costPrice: 1.15 },
        ],
        modifierGroups: [
          {
            id: 'mod-wali-manis',
            name: 'Kemanisan',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-kurang-gula', name: 'Kurang Manis', price: 0 },
              { id: 'opt-tanpa-gula', name: 'Kosong / Tanpa Gula', price: 0 },
              { id: 'opt-extra-susu', name: 'Tambah Susu', price: 0.50 },
            ],
          },
        ],
      },
      {
        code: 'W02',
        name: 'Capati Panas Gebu',
        category: 'Roti & Capati',
        price: 2.50,
        costPrice: 0.80,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Capati gandum asli lembut dibakar di atas kuali rata panas.',
        active: true,
        modifierGroups: [
          {
            id: 'mod-kuah-capati',
            name: 'Pilihan Kuah & Lauk',
            minSelection: 0,
            maxSelection: 2,
            options: [
              { id: 'opt-dhal-free', name: 'Kuah Dhal (Percuma)', price: 0 },
              { id: 'opt-kari-kambing', name: 'Kuah Kari Kambing Pekat', price: 4.50 },
              { id: 'opt-kari-ayam', name: 'Kuah Kari Ayam Mamak', price: 3.50 },
            ],
          },
        ],
      },
      {
        code: 'W03',
        name: 'Roti Canai Sarang Burung',
        category: 'Roti & Capati',
        price: 6.00,
        costPrice: 2.20,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Dua biji telur separuh masak di tengah roti canai garing bersama kuah kari & dhal.',
        active: true,
        modifierGroups: [
          {
            id: 'mod-roti-kuah',
            name: 'Pilihan Kuah',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-campur', name: 'Kuah Campur (Kari + Dhal + Sambal)', price: 0 },
              { id: 'opt-dhal', name: 'Dhal Sahaja', price: 0 },
              { id: 'opt-kari', name: 'Kari Ikan Sahaja', price: 0 },
            ],
          },
        ],
      },
      {
        code: 'W04',
        name: 'Mee Goreng Mamak Spesial',
        category: 'Makanan Panas / Goreng',
        price: 8.50,
        costPrice: 3.20,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Mee kuning goreng basah dengan cucur udang, tauhu, taugeh & limau nipis.',
        active: true,
        variants: [
          { id: 'var-mee-biasa', name: 'Biasa', price: 8.50, costPrice: 3.20, isDefault: true },
          { id: 'var-mee-telur-mata', name: 'Tambah Telur Mata', price: 10.00, costPrice: 3.90 },
        ],
        modifierGroups: [
          {
            id: 'mod-pedas-mee',
            name: 'Tahap Pedas',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-kurang-pedas', name: 'Kurang Pedas', price: 0 },
              { id: 'opt-pedas-kaw', name: 'Pedas Kaw (+Cili Padi)', price: 0.50 },
            ],
          },
        ],
      },
    ],
  },

  TOMYAM: {
    id: 'TOMYAM',
    name: 'Tomyam & Masakan Panas',
    subtitle: 'Tomyam merah/putih, masakan kuali, sup & seafood',
    description: 'Sesuai untuk restoran masakan Thai, kedai tomyam kelate dan masakan panas malam. Dilengkapi variasi saiz mangkuk (Biasa / Besar), pilihan kuah merah/putih, tahap kepedasan, dan pilihan tambahan seafood/telur.',
    badge: 'Thai • Masakan Panas',
    defaultOrderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
    tableMode: 'FULL',
    defaultPax: 4,
    defaultCategories: [
      'Tomyam & Sup',
      'Masakan Ayam & Daging',
      'Ikan & Seafood',
      'Nasi Goreng',
      'Sayur & Telur',
      'Minuman',
    ],
    kitchenStations: [
      { id: 'KITCHEN', name: 'Kuali Masakan Panas', description: 'Goreng-goreng, tomyam, sup & lauk panas' },
      { id: 'BAR', name: 'Bar Minuman & Jus', description: 'Teh O Ais Limau, sirap, jus tembikai & kelapa' },
    ],
    sampleModifiers: [
      {
        id: 'mod-tomyam-pedas',
        name: 'Tahap Kepedasan',
        minSelection: 1,
        maxSelection: 1,
        options: [
          { id: 'opt-ty-tidak-pedas', name: 'Tidak Pedas (Kanak-kanak)', price: 0 },
          { id: 'opt-ty-sederhana', name: 'Sederhana Pedas', price: 0 },
          { id: 'opt-ty-pedas', name: 'Pedas Kaw Cili Padi', price: 0 },
        ],
      },
      {
        id: 'mod-tomyam-kuah',
        name: 'Pilihan Kuah Tomyam',
        minSelection: 1,
        maxSelection: 1,
        options: [
          { id: 'opt-kuah-merah', name: 'Tomyam Merah (Tradisional)', price: 0 },
          { id: 'opt-kuah-putih', name: 'Tomyam Putih (Santan & Serai)', price: 0 },
        ],
      },
      {
        id: 'mod-tomyam-tambahan',
        name: 'Tambahan Hidangan',
        minSelection: 0,
        maxSelection: 3,
        options: [
          { id: 'opt-tambah-telur', name: 'Telur Dadar Rangup', price: 2.00 },
          { id: 'opt-tambah-sayur', name: 'Extra Sayur / Cendawan', price: 1.50 },
          { id: 'opt-tambah-seafood', name: 'Extra Udang & Sotong', price: 4.00 },
        ],
      },
    ],
    sampleMenuItems: [
      {
        code: 'TY01',
        name: 'Tomyam Ayam Kelate',
        category: 'Tomyam & Sup',
        price: 8.50,
        costPrice: 3.50,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Tomyam ayam asli pekat dengan daun limau purut, serai dan herba Thai.',
        active: true,
        variants: [
          { id: 'var-ty-biasa', name: 'Saiz Biasa (1-2 Pax)', price: 8.50, costPrice: 3.50, isDefault: true },
          { id: 'var-ty-besar', name: 'Saiz Besar (3-4 Pax)', price: 14.00, costPrice: 5.80 },
        ],
        modifierGroups: [
          {
            id: 'mod-ty01-kuah',
            name: 'Pilihan Kuah',
            minSelection: 1,
            maxSelection: 1,
            options: [
              { id: 'opt-merah', name: 'Kuah Merah', price: 0 },
              { id: 'opt-putih', name: 'Kuah Putih', price: 0 },
            ],
          },
          {
            id: 'mod-ty01-pedas',
            name: 'Tahap Pedas',
            minSelection: 1,
            maxSelection: 1,
            options: [
              { id: 'opt-sedang', name: 'Sederhana Pedas', price: 0 },
              { id: 'opt-kaw', name: 'Pedas Kaw', price: 0 },
              { id: 'opt-kurang', name: 'Kurang Pedas', price: 0 },
            ],
          },
          {
            id: 'mod-ty01-tambah',
            name: 'Tambahan Lauk',
            minSelection: 0,
            maxSelection: 3,
            options: [
              { id: 'opt-add-telur', name: 'Tambah Telur Dadar', price: 2.00 },
              { id: 'opt-add-cendawan', name: 'Tambah Cendawan Tiram', price: 1.50 },
              { id: 'opt-add-seafood', name: 'Tambah Seafood (Udang/Sotong)', price: 4.00 },
            ],
          },
        ],
      },
      {
        code: 'TY02',
        name: 'Nasi Goreng Kampung Spesial',
        category: 'Nasi Goreng',
        price: 8.00,
        costPrice: 3.10,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Nasi goreng berasap dengan kangkung kampung, ikan bilis rangup dan cili padi.',
        active: true,
        variants: [
          { id: 'var-ng-biasa', name: 'Biasa', price: 8.00, costPrice: 3.10, isDefault: true },
          { id: 'var-ng-telur-mata', name: 'Tambah Telur Mata', price: 9.50, costPrice: 3.80 },
        ],
        modifierGroups: [
          {
            id: 'mod-ng-pedas',
            name: 'Pedas Cili Padi',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-pedas-normal', name: 'Pedas Normal', price: 0 },
              { id: 'opt-extra-pedas', name: 'Extra Cili Padi Ketuk', price: 0.50 },
            ],
          },
        ],
      },
      {
        code: 'TY03',
        name: 'Kailan Ikan Masin',
        category: 'Sayur & Telur',
        price: 7.50,
        costPrice: 2.80,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Sayur kailan segar ditumis kuali bersama hirisan isi ikan masin tenggiri.',
        active: true,
      },
      {
        code: 'TY04',
        name: 'Teh O Ais Limau Kasturi',
        category: 'Minuman',
        price: 2.80,
        costPrice: 0.80,
        isAvailable: true,
        kitchenStation: 'BAR',
        description: 'Teh O sejuk segar diperah limau kasturi.',
        active: true,
        variants: [
          { id: 'var-ais', name: 'Ais Biasa', price: 2.80, costPrice: 0.80, isDefault: true },
          { id: 'var-bungkus-ikat', name: 'Bungkus Ikat Tepi (+RM0.20)', price: 3.00, costPrice: 0.90 },
        ],
      },
    ],
  },

  CAFE: {
    id: 'CAFE',
    name: 'Cafe & Kopi Moden',
    subtitle: 'Espresso, pastri, brunch & minuman estetik',
    description: 'Sesuai untuk artisan coffee bar, bakery cafe dan bistro. Menyokong pilihan susu alternatif (Oat, Soy, Almond), shot espresso tambahan, takeaway tumbler dan brunch all-day.',
    badge: 'Artisan • Kopi & Brunch',
    defaultOrderTypes: ['DINE_IN', 'TAKEAWAY'],
    tableMode: 'FULL',
    defaultPax: 2,
    defaultCategories: [
      'Espresso & Kopi',
      'Non-Coffee & Teh',
      'All-Day Brunch',
      'Pastri & Pencuci Mulut',
    ],
    kitchenStations: [
      { id: 'BAR', name: 'Barista Counter', description: 'Mesin espresso, pour over & bancuhan minuman' },
      { id: 'KITCHEN', name: 'Cafe Kitchen', description: 'Brunch, pasta, sourdough & pastri panas' },
    ],
    sampleModifiers: [
      {
        id: 'mod-milk-choice',
        name: 'Pilihan Susu',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-dairy', name: 'Fresh Milk (Standard)', price: 0 },
          { id: 'opt-oat', name: 'Oat Milk (Barista Edition)', price: 2.50 },
          { id: 'opt-soy', name: 'Soy Milk', price: 2.00 },
        ],
      },
      {
        id: 'mod-extra-shot',
        name: 'Shot Espresso',
        minSelection: 0,
        maxSelection: 1,
        options: [
          { id: 'opt-single-extra', name: 'Extra Shot Espresso', price: 3.00 },
        ],
      },
    ],
    sampleMenuItems: [
      {
        code: 'CF01',
        name: 'Cafe Latte Beraroma',
        category: 'Espresso & Kopi',
        price: 11.00,
        costPrice: 3.20,
        isAvailable: true,
        kitchenStation: 'BAR',
        description: 'Espresso double shot dengan susu kukus berkrim baldu.',
        active: true,
        variants: [
          { id: 'var-latte-hot', name: 'Hot (8oz)', price: 11.00, costPrice: 3.20, isDefault: true },
          { id: 'var-latte-iced', name: 'Iced (12oz)', price: 12.50, costPrice: 3.60 },
        ],
        modifierGroups: [
          {
            id: 'mod-latte-milk',
            name: 'Pilihan Susu',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-oat-latte', name: 'Tukar Susu Oat (+RM2.50)', price: 2.50 },
              { id: 'opt-soy-latte', name: 'Tukar Susu Soya (+RM2.00)', price: 2.00 },
            ],
          },
          {
            id: 'mod-latte-syrup',
            name: 'Perisa Sirap',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-vanilla', name: 'Madagascar Vanilla (+RM1.50)', price: 1.50 },
              { id: 'opt-caramel', name: 'Salted Caramel (+RM1.50)', price: 1.50 },
            ],
          },
        ],
      },
      {
        code: 'CF02',
        name: 'Butter Croissant Emas',
        category: 'Pastri & Pencuci Mulut',
        price: 7.50,
        costPrice: 2.50,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Pastri butter Perancis berlapis rangup di luar, lembut di dalam.',
        active: true,
        modifierGroups: [
          {
            id: 'mod-croissant-serv',
            name: 'Cara Hidangan',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-panaskan', name: 'Panaskan / Toasted', price: 0 },
              { id: 'opt-butter-jam', name: 'Tambah Mentega & Jem Beri', price: 1.50 },
            ],
          },
        ],
      },
    ],
  },

  GERAI: {
    id: 'GERAI',
    name: 'Gerai & Kiosk Pantas',
    subtitle: 'Nasi bajet, burger gerai, pisang goreng & air balang',
    description: 'Sesuai untuk peniaga gerai tepi jalan, medan selera (food court) dan kiosk tanpa keperluan pengurusan meja yang kompleks. Dioptimumkan untuk bungkus laju atau makan santai nombor meja ringkas.',
    badge: 'Pantas • Kiosk & Gerai',
    defaultOrderTypes: ['TAKEAWAY', 'DINE_IN'],
    tableMode: 'TABLE_NUMBER_ONLY', // Sesuai untuk gerai: tiada grid meja kompleks, nombor meja manual sahaja
    defaultPax: 1,
    defaultCategories: [
      'Menu Utama Gerai',
      'Lauk Tambahan',
      'Minuman Balang',
    ],
    kitchenStations: [
      { id: 'KITCHEN', name: 'Kaunter Gerai', description: 'Stesen persediaan laju gerai' },
    ],
    sampleModifiers: [
      {
        id: 'mod-gerai-lauk',
        name: 'Pilihan Kuah & Sambal',
        minSelection: 0,
        maxSelection: 2,
        options: [
          { id: 'opt-kuah-banjir', name: 'Kuah Campur Banjir', price: 0 },
          { id: 'opt-extra-sambal', name: 'Extra Sambal Belacan', price: 0.50 },
          { id: 'opt-telur-mata-gerai', name: 'Tambah Telur Mata', price: 1.50 },
        ],
      },
    ],
    sampleMenuItems: [
      {
        code: 'G01',
        name: 'Nasi Bajet Ayam Kunyit Panas',
        category: 'Menu Utama Gerai',
        price: 6.50,
        costPrice: 2.80,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Ayam goreng kunyit rangup dengan kacang panjang, bawang holland, sambal belacan & kicap manis.',
        active: true,
        variants: [
          { id: 'var-nasi-biasa', name: 'Biasa', price: 6.50, costPrice: 2.80, isDefault: true },
          { id: 'var-nasi-tambah-ayam', name: 'Double Ayam', price: 9.50, costPrice: 4.20 },
        ],
        modifierGroups: [
          {
            id: 'mod-g01-telur',
            name: 'Pilihan Telur',
            minSelection: 0,
            maxSelection: 1,
            options: [
              { id: 'opt-telur-mata', name: 'Telur Mata Goyang', price: 1.50 },
              { id: 'opt-telur-dadar', name: 'Telur Dadar', price: 1.50 },
            ],
          },
        ],
      },
      {
        code: 'G02',
        name: 'Air Balang Mangga Susu',
        category: 'Minuman Balang',
        price: 3.00,
        costPrice: 0.90,
        isAvailable: true,
        kitchenStation: 'KITCHEN',
        description: 'Air balang mangga pekat berkrim sejuk berais.',
        active: true,
        variants: [
          { id: 'var-cawan-kecil', name: 'Cawan Biasa (16oz)', price: 3.00, costPrice: 0.90, isDefault: true },
          { id: 'var-cawan-besar', name: 'Cawan Jumbo (32oz)', price: 5.00, costPrice: 1.50 },
        ],
      },
    ],
  },

  CUSTOM: {
    id: 'CUSTOM',
    name: 'Konfigurasi Bebas (Custom)',
    subtitle: 'Reka struktur kategori, stesen dapur & menu anda sendiri',
    description: 'Bermula dari kanvas kosong atau konfigurasi peribadi tanpa sebarang pratetap terikat. Anda bebas menentukan mod meja, stesen dapur dan kategori mengikut keunikan perniagaan anda.',
    badge: 'Fleksibel • Dari Awal',
    defaultOrderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
    tableMode: 'FULL',
    defaultPax: 2,
    defaultCategories: [
      'Makanan Utama',
      'Minuman',
      'Sampingan',
    ],
    kitchenStations: [
      { id: 'KITCHEN', name: 'Dapur Utama', description: 'Stesen masakan utama' },
    ],
    sampleModifiers: [],
    sampleMenuItems: [],
  },
};

export class TemplateService {
  private static getStorageKey(workspaceSlug: string = 'default'): string {
    return `${BIZ_CONFIG_PREFIX}${workspaceSlug}`;
  }

  /**
   * Mendapatkan senarai semua templat perniagaan yang sedia ada
   */
  public static getAllTemplates(): BusinessTemplate[] {
    return Object.values(BUSINESS_TEMPLATES);
  }

  /**
   * Mendapatkan templat mengikut ID
   */
  public static getTemplateById(id: BusinessTemplateId): BusinessTemplate {
    return BUSINESS_TEMPLATES[id] || BUSINESS_TEMPLATES.MAMAK_CAPATI;
  }

  /**
   * Mengambil konfigurasi perniagaan untuk sesuatu workspace.
   * Jika belum ada, membina konfigurasi default (MAMAK_CAPATI / Wali Capati) tanpa memusnahkan data sedia ada.
   */
  public static getBusinessConfig(workspaceSlug: string = 'default'): BusinessConfiguration {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.getStorageKey(workspaceSlug));
        if (raw) {
          const parsed = JSON.parse(raw) as BusinessConfiguration;
          if (parsed && parsed.templateId) {
            // Pastikan fallback nilai yang mungkin hilang dalam versi terdahulu
            return {
              workspaceSlug,
              templateId: parsed.templateId,
              templateName: parsed.templateName || BUSINESS_TEMPLATES[parsed.templateId]?.name || 'Mamak / Capati',
              enabledOrderTypes: parsed.enabledOrderTypes || ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
              tableMode: parsed.tableMode || 'FULL',
              defaultPax: parsed.defaultPax || 2,
              categories: parsed.categories || ['Makanan Utama', 'Minuman'],
              kitchenStations: parsed.kitchenStations || [{ id: 'KITCHEN', name: 'Dapur Utama' }],
              appliedAt: parsed.appliedAt || new Date().toISOString(),
              updatedAt: parsed.updatedAt || new Date().toISOString(),
            };
          }
        }
      }
    } catch (e) {
      console.warn('[TemplateService] Gagal membaca konfigurasi perniagaan:', e);
    }

    // Default starting config jika belum pernah dikonfigurasi
    const defaultTemplate = BUSINESS_TEMPLATES.MAMAK_CAPATI;
    const initialConfig: BusinessConfiguration = {
      workspaceSlug,
      templateId: defaultTemplate.id,
      templateName: defaultTemplate.name,
      enabledOrderTypes: [...defaultTemplate.defaultOrderTypes],
      tableMode: defaultTemplate.tableMode,
      defaultPax: defaultTemplate.defaultPax,
      categories: [...defaultTemplate.defaultCategories],
      kitchenStations: [...defaultTemplate.kitchenStations],
      appliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Simpan ke storage jika boleh
    this.saveBusinessConfig(initialConfig, workspaceSlug);
    return initialConfig;
  }

  /**
   * Menyimpan konfigurasi perniagaan secara terasing (tenant-isolated)
   */
  public static saveBusinessConfig(
    config: BusinessConfiguration,
    workspaceSlug: string = 'default'
  ): BusinessConfiguration {
    const updated: BusinessConfiguration = {
      ...config,
      workspaceSlug,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getStorageKey(workspaceSlug), JSON.stringify(updated));
      }
    } catch (e) {
      console.error('[TemplateService] Gagal menyimpan konfigurasi perniagaan:', e);
    }
    return updated;
  }

  /**
   * Memohon (Apply) templat kepada workspace dengan pilihan untuk mengisi sampel menu
   */
  public static applyTemplate(
    templateId: BusinessTemplateId,
    workspaceSlug: string = 'default',
    options: {
      loadSampleMenu?: boolean;
      resetExistingMenu?: boolean;
      updateTableMode?: boolean;
    } = { loadSampleMenu: true, resetExistingMenu: false, updateTableMode: true }
  ): { config: BusinessConfiguration; menuItemsCount: number } {
    const template = this.getTemplateById(templateId);
    const now = new Date().toISOString();

    const newConfig: BusinessConfiguration = {
      workspaceSlug,
      templateId: template.id,
      templateName: template.name,
      enabledOrderTypes: [...template.defaultOrderTypes],
      tableMode: template.tableMode,
      defaultPax: template.defaultPax,
      categories: [...template.defaultCategories],
      kitchenStations: [...template.kitchenStations],
      appliedAt: now,
      updatedAt: now,
    };

    this.saveBusinessConfig(newConfig, workspaceSlug);

    let menuCount = 0;

    // Jika pengguna memilih untuk memasukkan sampel menu templat
    if (options.loadSampleMenu && template.sampleMenuItems.length > 0) {
      const existingMenu = MenuService.getMenuItems(workspaceSlug);
      const newItems: MenuItem[] = template.sampleMenuItems.map((item, idx) => ({
        ...item,
        id: `menu-tpl-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: workspaceSlug,
        createdAt: now,
        updatedAt: now,
      }));

      if (options.resetExistingMenu) {
        MenuService.saveMenuItems(newItems, workspaceSlug);
        menuCount = newItems.length;
      } else {
        // Gabungkan tanpa duplikasi nama
        const existingNames = new Set(existingMenu.map(m => m.name.toLowerCase().trim()));
        const filteredNew = newItems.filter(m => !existingNames.has(m.name.toLowerCase().trim()));
        const merged = [...filteredNew, ...existingMenu];
        MenuService.saveMenuItems(merged, workspaceSlug);
        menuCount = merged.length;
      }
    } else {
      menuCount = MenuService.getMenuItems(workspaceSlug).length;
    }

    return {
      config: newConfig,
      menuItemsCount: menuCount,
    };
  }

  /**
   * Menambah atau mengemaskini kategori menu
   */
  public static addCategory(categoryName: string, workspaceSlug: string = 'default'): BusinessConfiguration {
    const config = this.getBusinessConfig(workspaceSlug);
    const clean = categoryName.trim();
    if (clean && !config.categories.includes(clean)) {
      config.categories = [...config.categories, clean];
      return this.saveBusinessConfig(config, workspaceSlug);
    }
    return config;
  }

  /**
   * Memadam kategori menu
   */
  public static removeCategory(categoryName: string, workspaceSlug: string = 'default'): BusinessConfiguration {
    const config = this.getBusinessConfig(workspaceSlug);
    config.categories = config.categories.filter(c => c !== categoryName);
    return this.saveBusinessConfig(config, workspaceSlug);
  }

  /**
   * Menogol pengaktifan jenis pesanan (DINE_IN, TAKEAWAY, DELIVERY)
   */
  public static toggleOrderType(
    orderType: RestaurantOrderType,
    workspaceSlug: string = 'default'
  ): BusinessConfiguration {
    const config = this.getBusinessConfig(workspaceSlug);
    const exists = config.enabledOrderTypes.includes(orderType);
    if (exists) {
      // Pastikan sekurang-kurangnya 1 jenis pesanan kekal aktif
      if (config.enabledOrderTypes.length > 1) {
        config.enabledOrderTypes = config.enabledOrderTypes.filter(t => t !== orderType);
      }
    } else {
      config.enabledOrderTypes = [...config.enabledOrderTypes, orderType];
    }
    return this.saveBusinessConfig(config, workspaceSlug);
  }

  /**
   * Menetapkan mod pengurusan meja
   */
  public static setTableMode(
    mode: TableManagementMode,
    workspaceSlug: string = 'default'
  ): BusinessConfiguration {
    const config = this.getBusinessConfig(workspaceSlug);
    config.tableMode = mode;
    return this.saveBusinessConfig(config, workspaceSlug);
  }
}
