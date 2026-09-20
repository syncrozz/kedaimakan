/**
 * SYNCROZZ KEDAI MAKAN - Restaurant Menu CSV Import & Validation Service
 * SES v4.5 Locked Architecture
 *
 * Supports:
 * - Product Name (Wajib)
 * - Category (Wajib)
 * - Base Price (Wajib, decimal format)
 * - Cost Price (Pilihan)
 * - Variants (Pilihan, e.g. "Panas:2.50|Sejuk:3.00|Bungkus:3.20")
 * - Modifier Groups (Pilihan, e.g. "Pilihan Kuah:Dhal,Kari,Campur|Manis:Kurang,Sedang")
 * - Kitchen Station (Pilihan: KITCHEN, BAR, DESSERT)
 * - Availability (Pilihan: true/false, Tersedia/Habis, 1/0)
 * - Description (Pilihan)
 * - Schema validation, preview, duplicate detection, safe upsert, tenant isolation
 */

import { MenuItem, MenuVariant, MenuModifierGroup, KitchenStation, RestaurantTable } from '../types/restaurant';
import { MenuService } from './menuService';
import { CsvService } from './csvService';
import { getLocalDateString } from './formatters';

export interface ParsedCsvMenuItem {
  rowNumber: number;
  code?: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  isAvailable: boolean;
  kitchenStation: KitchenStation;
  description?: string;
  variants: MenuVariant[];
  modifierGroups: MenuModifierGroup[];
  isDuplicate: boolean;
  isDuplicateInDb?: boolean;
  isDuplicateInFile?: boolean;
  errors: string[];
}

export interface RestaurantCsvValidationReport {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  duplicatesInDbCount: number;
  duplicatesInFileCount: number;
  parsedItems: ParsedCsvMenuItem[];
  globalErrors: string[];
}

export class RestaurantCsvService {
  /**
   * Menghasilkan dan memuat turun eksport CSV menu restoran lengkap mengikut piawaian RFC 4180 dan UTF-8 BOM
   */
  public static exportMenuToCsv(
    menuItems: MenuItem[],
    workspaceSlug: string = 'default',
    customFilename?: string
  ): void {
    const headers = [
      'Product Name',
      'Category',
      'Base Price',
      'Cost Price',
      'Variants',
      'Modifier Groups',
      'Kitchen Station',
      'Availability',
      'Description',
      'Menu Code',
    ];

    const rows = menuItems.map((item) => {
      // Format variasi: "Panas:2.50|Sejuk:3.00"
      const variantsStr = (item.variants || [])
        .map((v) => `${v.name}:${(v.price || 0).toFixed(2)}`)
        .join('|');

      // Format modifier: "Pilihan Kuah:Dhal:0,Kari:1.00|Pedas:Kurang:0,Kaw:0.50"
      const modifiersStr = (item.modifierGroups || [])
        .map((g) => {
          const opts = (g.options || [])
            .map((o) => `${o.name}:${(o.price || 0).toFixed(2)}`)
            .join(',');
          return `${g.name}:${opts}`;
        })
        .join('|');

      return [
        item.name,
        item.category,
        item.price.toFixed(2),
        (item.costPrice || 0).toFixed(2),
        variantsStr,
        modifiersStr,
        item.kitchenStation || 'KITCHEN',
        item.isAvailable ? 'Tersedia' : 'Habis',
        item.description || '',
        item.code || '',
      ];
    });

    const dateStr = getLocalDateString();
    const filename = customFilename || `POS_Restoran_menu_${workspaceSlug}_${dateStr}.csv`;
    CsvService.downloadCsv(filename, headers, rows);
  }

  /**
   * Menghasilkan dan memuat turun eksport CSV senarai meja restoran mengikut RFC 4180
   */
  public static exportTablesToCsv(
    tables: RestaurantTable[],
    workspaceSlug: string = 'default',
    customFilename?: string
  ): void {
    const headers = [
      'Table Number',
      'Zone',
      'Capacity',
      'Status',
      'Last Updated',
    ];

    const rows = tables.map((t) => [
      t.tableNumber,
      t.zone || 'Utama',
      t.capacity.toString(),
      t.status,
      t.updatedAt || '',
    ]);

    const dateStr = getLocalDateString();
    const filename = customFilename || `POS_Restoran_tables_${workspaceSlug}_${dateStr}.csv`;
    CsvService.downloadCsv(filename, headers, rows);
  }

  /**
   * Memuat turun templat CSV rasmi untuk import menu
   */
  public static downloadMenuCsvTemplate(type: 'WALI_CAPATI' | 'TOMYAM' | 'STANDARD' = 'WALI_CAPATI'): void {
    const csvContent = this.generateSampleCsv(type);
    const dateStr = getLocalDateString();
    const filename = `POS_Restoran_menu_template_${type.toLowerCase()}_${dateStr}.csv`;
    const { headers, rows } = CsvService.parseCsvText(csvContent);
    const formattedRows = rows.map((r) => headers.map((h) => r[h] || ''));
    CsvService.downloadCsv(filename, headers, formattedRows);
  }
  /**
   * Menghasilkan contoh CSV untuk dimuat turun oleh Owner (Wali Capati Nan & Tomyam)
   */
  public static generateSampleCsv(type: 'WALI_CAPATI' | 'TOMYAM' | 'STANDARD' = 'WALI_CAPATI'): string {
    const headers = 'Product Name,Category,Base Price,Cost Price,Variants,Modifier Groups,Kitchen Station,Availability,Description';

    if (type === 'WALI_CAPATI') {
      const rows = [
        '"Teh Tarik Pandan","Minuman","2.50","0.90","Panas:2.50|Sejuk:3.00|Bungkus:3.20","Kemanisan:Kurang Manis,Sedang,Kaw","BAR","Tersedia","Teh tarik buih wangi asli"',
        '"Capati Panas Gebu","Roti & Capati","2.50","0.80","","Pilihan Kuah:Dhal:0,Kari Ayam:3.50,Kari Kambing:4.50","KITCHEN","Tersedia","Capati gandum bakar panas"',
        '"Roti Canai Sarang Burung","Roti & Capati","6.00","2.20","","Pilihan Kuah:Campur:0,Dhal:0,Kari:0","KITCHEN","Tersedia","Roti canai telur mata goyang"',
        '"Mee Goreng Mamak Spesial","Makanan Panas / Goreng","8.50","3.20","Biasa:8.50|Tambah Telur:10.00","Tahap Pedas:Kurang Pedas:0,Pedas Kaw:0.50","KITCHEN","Tersedia","Mee kuning goreng basah mamak"',
        '"Nescafe Tarik","Minuman","3.00","1.20","Panas:3.00|Ais:3.50","","BAR","Tersedia","Nescafe pekat berkrim"',
      ];
      return [headers, ...rows].join('\n');
    }

    if (type === 'TOMYAM') {
      const rows = [
        '"Tomyam Ayam Kelate","Tomyam & Sup","8.50","3.50","Biasa (1-2 Pax):8.50|Besar (3-4 Pax):14.00","Kuah:Merah:0,Putih:0|Pedas:Kurang:0,Sedang:0,Pedas Kaw:0|Tambahan:Telur Dadar:2.00,Seafood:4.00","KITCHEN","Tersedia","Tomyam ayam asli daun limau purut"',
        '"Nasi Goreng Kampung","Nasi Goreng","8.00","3.10","Biasa:8.00|Tambah Telur Mata:9.50","Pedas:Normal:0,Extra Pedas:0.50","KITCHEN","Tersedia","Nasi goreng kangkung dan bilis rangup"',
        '"Kailan Ikan Masin","Sayur & Telur","7.50","2.80","","","KITCHEN","Tersedia","Kailan tumis kuali ikan masin"',
        '"Teh O Ais Limau","Minuman","2.80","0.80","Ais:2.80|Bungkus:3.00","Kemanisan:Kurang Manis:0,Biasa:0","BAR","Tersedia","Teh O sejuk limau kasturi"',
      ];
      return [headers, ...rows].join('\n');
    }

    const standardRows = [
      '"Nasi Goreng Ayam","Makanan","9.00","3.50","Biasa:9.00|Besar:11.50","Pedas:Kurang,Pedas","KITCHEN","Tersedia","Nasi goreng bersama ayam goreng"',
      '"Milo Ais","Minuman","3.20","1.10","Ais:3.20|Panas:2.80|Bungkus:3.50","","BAR","Tersedia","Milo pekat sejuk"',
    ];
    return [headers, ...standardRows].join('\n');
  }

  /**
   * Menghuraikan teks variasi seperti: "Panas:2.50|Sejuk:3.00|Bungkus:3.20"
   */
  public static parseVariants(variantStr: string): MenuVariant[] {
    if (!variantStr || !variantStr.trim()) return [];
    const parts = variantStr.split('|');
    const variants: MenuVariant[] = [];

    parts.forEach((part, index) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const [name, priceRaw] = trimmed.split(':');
      if (name) {
        const price = priceRaw ? parseFloat(priceRaw.trim()) : 0;
        variants.push({
          id: `var-csv-${Date.now()}-${index}`,
          name: name.trim(),
          price: isNaN(price) ? 0 : price,
          isDefault: index === 0,
        });
      }
    });

    return variants;
  }

  /**
   * Menghuraikan teks modifier seperti:
   * "Pilihan Kuah:Dhal:0,Kari:0,Campur:0|Pedas:Kurang:0,Kaw:0.50"
   */
  public static parseModifierGroups(modifierStr: string): MenuModifierGroup[] {
    if (!modifierStr || !modifierStr.trim()) return [];
    const groupsRaw = modifierStr.split('|');
    const groups: MenuModifierGroup[] = [];

    groupsRaw.forEach((gRaw, gIdx) => {
      const trimmed = gRaw.trim();
      if (!trimmed) return;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) return;

      const groupName = trimmed.substring(0, colonIdx).trim();
      const optionsRaw = trimmed.substring(colonIdx + 1).split(',');

      const options = optionsRaw
        .map((opt, oIdx) => {
          const optTrimmed = opt.trim();
          if (!optTrimmed) return null;
          const pieces = optTrimmed.split(':');
          const optName = pieces[0].trim();
          const optPrice = pieces[1] ? parseFloat(pieces[1].trim()) : 0;
          return {
            id: `opt-csv-${gIdx}-${oIdx}`,
            name: optName,
            price: isNaN(optPrice) ? 0 : optPrice,
          };
        })
        .filter((o): o is { id: string; name: string; price: number } => o !== null);

      if (options.length > 0) {
        groups.push({
          id: `mod-csv-${gIdx}-${Date.now()}`,
          name: groupName,
          minSelection: 0,
          maxSelection: 1,
          options,
        });
      }
    });

    return groups;
  }

  /**
   * Memvalidasi dan menghuraikan rentetan fail CSV
   */
  public static validateCsv(csvText: string, workspaceSlug: string = 'default'): RestaurantCsvValidationReport {
    const lines = csvText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      return {
        isValid: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        duplicateCount: 0,
        duplicatesInDbCount: 0,
        duplicatesInFileCount: 0,
        parsedItems: [],
        globalErrors: ['Fail CSV kosong atau tidak mengandungi sebarang data.'],
      };
    }

    // Ambil baris pengepala (header)
    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map(h => h.toLowerCase().trim());

    // Semak lajur wajib
    const nameIdx = headers.findIndex(h => h.includes('product') || h.includes('name') || h.includes('nama') || h.includes('item'));
    const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('kategori'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('harga') || h.includes('base price'));

    const globalErrors: string[] = [];
    if (nameIdx === -1) globalErrors.push('Lajur wajib "Product Name" tidak dijumpai.');
    if (categoryIdx === -1) globalErrors.push('Lajur wajib "Category" tidak dijumpai.');
    if (priceIdx === -1) globalErrors.push('Lajur wajib "Base Price" tidak dijumpai.');

    if (globalErrors.length > 0) {
      return {
        isValid: false,
        totalRows: lines.length - 1,
        validRows: 0,
        invalidRows: lines.length - 1,
        duplicateCount: 0,
        duplicatesInDbCount: 0,
        duplicatesInFileCount: 0,
        parsedItems: [],
        globalErrors,
      };
    }

    // Indeks pilihan
    const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('kos'));
    const variantsIdx = headers.findIndex(h => h.includes('variant') || h.includes('variasi'));
    const modifiersIdx = headers.findIndex(h => h.includes('modifier') || h.includes('pilihan'));
    const stationIdx = headers.findIndex(h => h.includes('station') || h.includes('stesen') || h.includes('dapur'));
    const availIdx = headers.findIndex(h => h.includes('avail') || h.includes('tersedia') || h.includes('status'));
    const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('keterangan') || h.includes('penerangan'));

    // Senarai menu sedia ada untuk semakan duplikasi
    const existingMenu = MenuService.getMenuItems(workspaceSlug);
    const existingNames = new Set(existingMenu.map(m => m.name.toLowerCase().trim()));
    const seenNamesInFile = new Set<string>();

    const parsedItems: ParsedCsvMenuItem[] = [];
    let duplicateCount = 0;
    let duplicatesInDbCount = 0;
    let duplicatesInFileCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const rawCols = this.parseCsvLine(lines[i]);
      const rowErrors: string[] = [];

      const rawName = (rawCols[nameIdx] || '').trim();
      const rawCat = (rawCols[categoryIdx] || '').trim();
      const rawPrice = (rawCols[priceIdx] || '').trim().replace(/[^0-9.]/g, '');

      if (!rawName) {
        rowErrors.push('Nama produk tidak boleh kosong');
      }

      if (!rawCat) {
        rowErrors.push('Kategori tidak boleh kosong');
      }

      const price = parseFloat(rawPrice);
      if (isNaN(price) || price < 0) {
        rowErrors.push(`Format harga tidak sah: "${rawCols[priceIdx] || ''}"`);
      }

      let costPrice = 0;
      if (costIdx !== -1 && rawCols[costIdx]) {
        const cleanCost = rawCols[costIdx].replace(/[^0-9.]/g, '');
        costPrice = parseFloat(cleanCost) || 0;
      }

      // Stesen dapur
      let station: KitchenStation = 'KITCHEN';
      if (stationIdx !== -1 && rawCols[stationIdx]) {
        const stUpper = rawCols[stationIdx].toUpperCase().trim();
        if (stUpper.includes('BAR') || stUpper.includes('MINUM') || stUpper.includes('DRINK')) {
          station = 'BAR';
        } else if (stUpper.includes('DESSERT') || stUpper.includes('PENCUCI') || stUpper.includes('SWEET')) {
          station = 'DESSERT';
        } else {
          station = 'KITCHEN';
        }
      }

      // Ketersediaan
      let isAvailable = true;
      if (availIdx !== -1 && rawCols[availIdx]) {
        const val = rawCols[availIdx].toLowerCase().trim();
        if (val === 'false' || val === 'habis' || val === 'tidak' || val === '0' || val === 'no') {
          isAvailable = false;
        }
      }

      const description = descIdx !== -1 ? (rawCols[descIdx] || '').trim() : undefined;
      const variants = variantsIdx !== -1 ? this.parseVariants(rawCols[variantsIdx] || '') : [];
      const modifierGroups = modifiersIdx !== -1 ? this.parseModifierGroups(rawCols[modifiersIdx] || '') : [];

      // Semakan duplikasi
      const nameKey = rawName.toLowerCase();
      const isDuplicateInDb = existingNames.has(nameKey);
      const isDuplicateInFile = seenNamesInFile.has(nameKey);
      const isDuplicate = isDuplicateInDb || isDuplicateInFile;

      if (isDuplicateInDb) duplicatesInDbCount++;
      if (isDuplicateInFile) duplicatesInFileCount++;
      if (isDuplicate) duplicateCount++;

      seenNamesInFile.add(nameKey);

      parsedItems.push({
        rowNumber,
        name: rawName,
        category: rawCat,
        price: isNaN(price) ? 0 : price,
        costPrice,
        isAvailable,
        kitchenStation: station,
        description,
        variants,
        modifierGroups,
        isDuplicate,
        isDuplicateInDb,
        isDuplicateInFile,
        errors: rowErrors,
      });
    }

    const validRows = parsedItems.filter(p => p.errors.length === 0).length;
    const invalidRows = parsedItems.length - validRows;

    return {
      isValid: invalidRows === 0 && parsedItems.length > 0,
      totalRows: parsedItems.length,
      validRows,
      invalidRows,
      duplicateCount,
      duplicatesInDbCount,
      duplicatesInFileCount,
      parsedItems,
      globalErrors,
    };
  }

  /**
   * Memasukkan rekod yang disahkan ke dalam storan menu secara selamat dengan pilihan resolusi duplikasi
   */
  public static commitImport(
    itemsToImport: ParsedCsvMenuItem[],
    workspaceSlug: string = 'default',
    options: {
      actionOnDuplicates?: 'SKIP' | 'UPDATE' | 'ABORT';
      overwriteDuplicates?: boolean;
    } = { actionOnDuplicates: 'SKIP' }
  ): { importedCount: number; updatedCount: number; totalMenuCount: number; aborted?: boolean } {
    const existingMenu = MenuService.getMenuItems(workspaceSlug);
    const now = new Date().toISOString();

    const action = options.actionOnDuplicates || (options.overwriteDuplicates ? 'UPDATE' : 'SKIP');

    const existingMap = new Map<string, MenuItem>();
    existingMenu.forEach(item => {
      existingMap.set(item.name.toLowerCase().trim(), item);
    });

    // Jika pengguna pilih ABORT apabila terdapat duplikasi dalam fail atau pangkalan data
    if (action === 'ABORT') {
      const hasAnyDuplicate = itemsToImport.some(item => {
        const key = item.name.toLowerCase().trim();
        return existingMap.has(key) || item.isDuplicate;
      });
      if (hasAnyDuplicate) {
        return {
          importedCount: 0,
          updatedCount: 0,
          totalMenuCount: existingMenu.length,
          aborted: true,
        };
      }
    }

    let importedCount = 0;
    let updatedCount = 0;

    const finalMenuList = [...existingMenu];

    itemsToImport.forEach(item => {
      if (item.errors.length > 0) return; // Langkau rekod tidak sah

      const key = item.name.toLowerCase().trim();
      const existing = existingMap.get(key);

      if (existing) {
        if (action === 'UPDATE') {
          // Kemaskini rekod sedia ada mengikut pilihan jelas pentadbir
          const index = finalMenuList.findIndex(m => m.id === existing.id);
          if (index !== -1) {
            finalMenuList[index] = {
              ...existing,
              category: item.category,
              price: item.price,
              costPrice: item.costPrice,
              kitchenStation: item.kitchenStation,
              isAvailable: item.isAvailable,
              description: item.description || existing.description,
              variants: item.variants.length > 0 ? item.variants : existing.variants,
              modifierGroups: item.modifierGroups.length > 0 ? item.modifierGroups : existing.modifierGroups,
              updatedAt: now,
            };
            updatedCount++;
          }
        }
        // Jika action === 'SKIP', abaikan dan jangan ubah rekod sedia ada
      } else {
        // Cipta rekod menu baharu
        const codeNum = finalMenuList.length + 1;
        const prefix = item.kitchenStation === 'BAR' ? 'D' : 'M';
        const code = `${prefix}-${String(codeNum).padStart(2, '0')}`;

        const newMenuItem: MenuItem = {
          id: `menu-csv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          storeId: workspaceSlug,
          code,
          name: item.name,
          category: item.category,
          price: item.price,
          costPrice: item.costPrice,
          isAvailable: item.isAvailable,
          kitchenStation: item.kitchenStation,
          description: item.description,
          variants: item.variants,
          modifierGroups: item.modifierGroups,
          active: true,
          createdAt: now,
          updatedAt: now,
        };

        finalMenuList.push(newMenuItem);
        existingMap.set(key, newMenuItem);
        importedCount++;
      }
    });

    MenuService.saveMenuItems(finalMenuList, workspaceSlug);

    return {
      importedCount,
      updatedCount,
      totalMenuCount: finalMenuList.length,
      aborted: false,
    };
  }

  /**
   * Pembantu penghurai baris CSV mengambil kira tanda petikan ("...")
   */
  private static parseCsvLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }
}
