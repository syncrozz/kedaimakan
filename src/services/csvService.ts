/**
 * NiagaPOS - Reusable CSV Export & Import Service
 * SYNCROZZ Engineering Standard (SES) v4.4 Locked
 *
 * Requirements:
 * - RFC 4180 standard compliant
 * - UTF-8 with BOM (\uFEFF) for Malay / Windows Excel compatibility
 * - Proper escaping of quotes, commas, and multiline values
 * - Preserves leading zeroes and text values (e.g. phone numbers, codes)
 * - Controlled import validation with pre-commit review summary
 */

import {
  Product,
  Supplier,
  StaffUser,
  Customer,
  LoyaltyLedgerEntry,
  CsvImportMode,
  ProductCatalogUpdatePayload,
  Sale,
  Purchase,
  InventoryMovement,
  MasterCatalogSyncValidationResult,
  MasterSyncProductRow,
  MasterSyncMissingProduct,
  StaffRole,
} from '../types';
import { SmartInputService } from './smartInputService';
import { ProductService } from './productService';
import { CreateSupplierInput, UpdateSupplierInput, SupplierService } from './supplierService';
import { CreateCustomerInput, UpdateCustomerInput, CustomerService } from './customerService';
import { CreateStaffInput, UpdateStaffInput, StaffService } from './staffService';

export interface CsvImportValidationResult<T> {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  validItems: T[];
  duplicates: { rowNumber: number; reason: string; item: T }[];
  errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[];
}

export type { CsvImportMode };
export type CsvRowAction = 'NEW' | 'UPDATE' | 'SKIP' | 'INVALID';
export type CsvEntityRowAction = 'NEW' | 'UPDATE' | 'INVALID';

export interface CsvGenericEntityRow<T> {
  rowNumber: number;
  action: CsvEntityRowAction;
  code: string;
  title: string;
  subtitle?: string;
  tag?: string;
  reason: string;
  existingId?: string;
  payload: T;
  rawRow: Record<string, string>;
}

export interface CsvEntityUpsertValidationResult<T, U = Partial<T>> {
  totalRows: number;
  newCount: number;
  updateCount: number;
  invalidCount: number;
  rows: CsvGenericEntityRow<any>[];
  newItems: T[];
  updateItems: { id: string; updates: U }[];
  errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[];
  isValid: boolean;
}

export interface CsvProductImportRow {
  rowNumber: number;
  action: CsvRowAction;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  csvStock: number;
  minimumStock: number;
  active: boolean;
  imageUrl?: string;
  reason: string;
  stockNote: string;
  existingProductId?: string;
  rawRow: Record<string, string>;
}

export type CsvProductUpdateItem = ProductCatalogUpdatePayload;

export interface CsvProductsUpsertValidationResult
  extends CsvImportValidationResult<Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>> {
  totalRows: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  invalidCount: number;
  existingCount: number;
  mode: CsvImportMode;
  rows: CsvProductImportRow[];
  newItems: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[];
  updateItems: CsvProductUpdateItem[];
}

export class CsvService {
  /**
   * Generates and downloads a standardized CSV file with UTF-8 BOM.
   */
  public static downloadCsv(
    filename: string,
    headers: string[],
    rows: (string | number | boolean | null | undefined)[][]
  ): void {
    const escapeCell = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // If contains quote, comma, or newline, wrap in quotes and escape internal quotes
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCell).join(',');
    const bodyLines = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const csvContent = `\uFEFF${headerLine}\r\n${bodyLines}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates and normalizes product Image URL format.
   * - Empty string, null, or undefined: valid, resolves to undefined (preserves existing).
   * - Valid HTTP/HTTPS, relative paths (/), or data:image/ URIs: valid, returns normalized URL string.
   * - Invalid formats (non-URL strings, unsupported protocols e.g. javascript:, ftp:): invalid.
   */
  public static validateImageUrl(rawUrl: string | null | undefined): {
    isValid: boolean;
    normalizedUrl?: string;
    error?: string;
  } {
    if (rawUrl === null || rawUrl === undefined) {
      return { isValid: true, normalizedUrl: undefined };
    }
    const trimmed = String(rawUrl).trim();
    if (trimmed === '') {
      return { isValid: true, normalizedUrl: undefined };
    }

    // Relative web paths or data URIs
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('data:image/')) {
      return { isValid: true, normalizedUrl: trimmed };
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return { isValid: true, normalizedUrl: trimmed };
      }
      return {
        isValid: false,
        error: `Protokol '${parsed.protocol}' tidak disokong. Hanya HTTP atau HTTPS dibenarkan.`,
      };
    } catch {
      return {
        isValid: false,
        error: `Format URL gambar '${trimmed}' tidak sah.`,
      };
    }
  }

  /**
   * Generates and downloads a standardized CSV template for product catalogue import.
   * Includes Image URL column with clear sample data.
   */
  public static downloadProductsCsvTemplate(): void {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Cost Price (RM)',
      'Selling Price (RM)',
      'Current Stock',
      'Minimum Stock',
      'Status',
      'Image URL',
    ];

    const sampleRows = [
      [
        'PROD-001',
        'Contoh Biskut Coklat 200g',
        'Snacks & Biscuits',
        '2.50',
        '3.80',
        '24',
        '5',
        'ACTIVE',
        'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500',
      ],
      [
        'PROD-002',
        'Contoh Minyak Masak 5kg',
        'Cooking Essentials',
        '28.00',
        '32.50',
        '12',
        '4',
        'ACTIVE',
        '',
      ],
    ];

    this.downloadCsv('niagapos_products_template.csv', headers, sampleRows);
  }

  /**
   * Exports Products catalogue to CSV with Image URL support and standard backup filename.
   * Complies with NiagaPOS specifications:
   * - Includes Image URL (imageUrl) for every product
   * - Preserves all existing product fields
   * - Clear, consistent CSV format
   * - Generates backup filename: niagapos_products_backup_YYYY-MM-DD.csv
   */
  public static exportProducts(products: Product[], customFilename?: string): void {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Cost Price (RM)',
      'Selling Price (RM)',
      'Current Stock',
      'Minimum Stock',
      'Status',
      'Image URL',
    ];

    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.costPrice.toFixed(2),
      p.sellingPrice.toFixed(2),
      p.currentStock,
      p.minimumStock,
      p.active ? 'ACTIVE' : 'INACTIVE',
      p.imageUrl || p.image || '',
    ]);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const filename = customFilename || `niagapos_products_backup_${dateStr}.csv`;
    this.downloadCsv(filename, headers, rows);
  }

  /**
   * Exports Suppliers to CSV.
   */
  public static exportSuppliers(suppliers: Supplier[]): void {
    const headers = [
      'Supplier Code',
      'Supplier Name',
      'Contact Person',
      'Phone',
      'Email',
      'Address',
      'Status',
    ];

    const rows = suppliers.map((s) => [
      s.supplierCode,
      s.supplierName,
      s.contactPerson || '',
      s.phone || '',
      s.email || '',
      s.address || '',
      s.active ? 'ACTIVE' : 'INACTIVE',
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCsv(`niagapos_v2_suppliers_${dateStr}.csv`, headers, rows);
  }

  /**
   * Exports Customers to CSV.
   */
  public static exportCustomers(customers: Customer[], loyaltyLedger?: LoyaltyLedgerEntry[]): void {
    const headers = [
      'Customer Code',
      'Customer Name',
      'Phone',
      'Email',
      'Loyalty Points',
      'Notes',
      'Status',
    ];

    const rows = customers.map((c) => {
      let points = 0;
      if (loyaltyLedger) {
        points = loyaltyLedger
          .filter((l) => l.customerId === c.id)
          .reduce((sum, l) => sum + (l.type === 'EARNED' ? l.points : -l.points), 0);
      }

      return [
        c.customerCode,
        c.customerName,
        c.phone || '',
        c.email || '',
        points.toString(),
        c.notes || '',
        c.active ? 'ACTIVE' : 'INACTIVE',
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCsv(`niagapos_v2_customers_${dateStr}.csv`, headers, rows);
  }

  /**
   * Exports Staff Users (Pekerja) to CSV.
   */
  public static exportStaff(staffUsers: StaffUser[]): void {
    const headers = [
      'Staff Code',
      'Name',
      'Role',
      'Status',
    ];

    const rows = staffUsers.map((s) => [
      s.staffCode || s.userCode || '',
      s.name,
      s.role,
      s.active ? 'ACTIVE' : 'INACTIVE',
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCsv(`niagapos_v2_staff_${dateStr}.csv`, headers, rows);
  }

  /**
   * Generates and downloads a standardized CSV template for supplier import.
   */
  public static downloadSuppliersCsvTemplate(): void {
    const headers = [
      'Supplier Code',
      'Supplier Name',
      'Contact Person',
      'Phone',
      'Email',
      'Address',
      'Status',
    ];

    const sampleRows = [
      [
        'SUP-001',
        'Pembekal Makanan Segar Sdn Bhd',
        'En. Ahmad Farhan',
        '012-3456789',
        'ahmad@segar.com.my',
        'No 12 Jalan Industri 3, Shah Alam, Selangor',
        'ACTIVE',
      ],
      [
        'SUP-002',
        'Pengedar Minuman Nusantara',
        'Pn. Siti Rahmah',
        '019-8765432',
        'sales@nusantara.my',
        'Kawasan Perindustrian Nilai, Negeri Sembilan',
        'ACTIVE',
      ],
    ];

    this.downloadCsv('niagapos_suppliers_template.csv', headers, sampleRows);
  }

  /**
   * Generates and downloads a standardized CSV template for customer import.
   */
  public static downloadCustomersCsvTemplate(): void {
    const headers = [
      'Customer Code',
      'Customer Name',
      'Phone',
      'Email',
      'Notes',
      'Status',
    ];

    const sampleRows = [
      [
        'CUS-000001',
        'Ali bin Hassan',
        '012-3456789',
        'ali.hassan@example.com',
        'Pelanggan VIP Tetap',
        'ACTIVE',
      ],
      [
        'CUS-000002',
        'Noraini binti Ismail',
        '017-9876543',
        'noraini@example.com',
        'Taman Melawati',
        'ACTIVE',
      ],
    ];

    this.downloadCsv('niagapos_customers_template.csv', headers, sampleRows);
  }

  /**
   * Generates and downloads a standardized CSV template for staff import.
   */
  public static downloadStaffCsvTemplate(): void {
    const headers = [
      'Staff Code',
      'Name',
      'Role',
      'Status',
    ];

    const sampleRows = [
      [
        'STF-001',
        'Nurul Izzah',
        'CASHIER',
        'ACTIVE',
      ],
      [
        'STF-002',
        'Khairul Azman',
        'MANAGER',
        'ACTIVE',
      ],
    ];

    this.downloadCsv('niagapos_staff_template.csv', headers, sampleRows);
  }

  /**
   * Parses CSV text into an array of row objects mapping headers to values.
   */
  public static parseCsvText(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
    // Strip BOM if present
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines: string[] = [];
    let curLine = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          curLine += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (curLine.trim()) {
          lines.push(curLine);
        }
        curLine = '';
        if (char === '\r' && nextChar === '\n') i++; // Skip \n in CRLF
      } else {
        curLine += char;
      }
    }
    if (curLine.trim()) {
      lines.push(curLine);
    }

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const parseLineToCells = (line: string): string[] => {
      const cells: string[] = [];
      let cell = '';
      let cellInQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        const nextC = line[j + 1];

        if (c === '"') {
          if (cellInQuotes && nextC === '"') {
            cell += '"';
            j++;
          } else {
            cellInQuotes = !cellInQuotes;
          }
        } else if (c === ',' && !cellInQuotes) {
          cells.push(cell.trim());
          cell = '';
        } else {
          cell += c;
        }
      }
      cells.push(cell.trim());
      return cells;
    };

    const rawHeaders = parseLineToCells(lines[0]);
    const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());

    const rows: Record<string, string>[] = [];
    for (let k = 1; k < lines.length; k++) {
      const cells = parseLineToCells(lines[k]);
      if (cells.every((c) => c === '')) continue; // Skip completely empty lines
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] !== undefined ? cells[idx] : '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  /**
   * Validates products from imported CSV with explicit Upsert & Safe Mode support.
   * Classifies rows into NEW, UPDATE, SKIP, and INVALID with clear reasoning.
   */
  public static validateProductsUpsert(
    csvRows: Record<string, string>[],
    existingProducts: Product[],
    mode: CsvImportMode = 'SKIP_EXISTING'
  ): CsvProductsUpsertValidationResult {
    const existingSkuMap = new Map<string, Product>();
    existingProducts.forEach((p) => {
      existingSkuMap.set(SmartInputService.normalizeCode(p.sku), p);
    });

    const seenBatchSkus = new Set<string>();

    const rows: CsvProductImportRow[] = [];
    const newItems: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[] = [];
    const updateItems: CsvProductUpdateItem[] = [];
    const duplicates: { rowNumber: number; reason: string; item: any }[] = [];
    const errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[] = [];

    let existingCount = 0;

    csvRows.forEach((row, index) => {
      const rowNumber = index + 2; // Account for 1-based index and header line

      // Find keys case-insensitively with optional exclusion filter to prevent collisions
      // e.g. "Cost Price (RM)" must not collide with "Selling Price (RM)"
      const findVal = (keyPattern: RegExp, excludePattern?: RegExp) => {
        const matchingKey = Object.keys(row).find((k) => {
          if (!keyPattern.test(k)) return false;
          if (excludePattern && excludePattern.test(k)) return false;
          return true;
        });
        return matchingKey ? row[matchingKey] : '';
      };

      const rawSku = findVal(/sku|barcode|bar_code|kod/i);
      const rawName = findVal(/name|nama|tajuk|description|item|produk/i);
      const rawCategory = findVal(/category|kategori/i);

      // Cost price: matches cost/kos/modal/beli
      const rawCost = findVal(/cost|kos|modal|beli/i);

      // Selling price: prioritize explicit selling/jual/retail, OR price/harga excluding cost/kos/modal/beli
      const rawPrice =
        findVal(/selling|jual|retail/i) ||
        findVal(/price|harga/i, /cost|kos|modal|beli/i);

      // Current stock: prioritize current_stock/semasa, OR stock/stok/qty excluding min/minimum/ambang
      const rawStock =
        findVal(/current.*stock|stok.*semasa|current|semasa/i) ||
        findVal(/stock|stok|qty|kuantiti/i, /min|minimum|ambang/i);

      const rawMinStock = findVal(/min|minimum|ambang/i);
      const rawStatus = findVal(/status|active|aktif/i);
      const rawImage = findVal(/image.*url|url.*image|imageUrl|gambar|url.*gambar|image|foto|photo/i);
      const hasImageColumn = Object.keys(row).some((k) =>
        /image.*url|url.*image|imageUrl|gambar|url.*gambar|image|foto|photo/i.test(k)
      );
      const imageValidation = CsvService.validateImageUrl(rawImage);

      const sku = SmartInputService.normalizeCode(rawSku);
      const name = SmartInputService.normalizeName(rawName);

      if (!sku) {
        const reason = 'SKU tidak boleh kosong.';
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku: rawSku || '-',
          name: rawName || '-',
          category: rawCategory || '-',
          costPrice: 0,
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - dibatalkan.',
          rawRow: row,
        });
        return;
      }

      if (!name) {
        const reason = 'Nama produk tidak boleh kosong.';
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name: rawName || '-',
          category: rawCategory || '-',
          costPrice: 0,
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - dibatalkan.',
          rawRow: row,
        });
        return;
      }

      // Check duplicate within the same batch
      if (seenBatchSkus.has(sku)) {
        const reason = `SKU '${sku}' berulang dalam fail CSV ini.`;
        errors.push({ rowNumber, reason, rawRow: row });
        duplicates.push({ rowNumber, reason, item: { sku, name } });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name,
          category: rawCategory || 'General',
          costPrice: SmartInputService.parseNumeric(rawCost, 0),
          sellingPrice: SmartInputService.parseNumeric(rawPrice, 0),
          csvStock: Math.max(0, Math.floor(SmartInputService.parseNumeric(rawStock, 0))),
          minimumStock: Math.max(0, Math.floor(SmartInputService.parseNumeric(rawMinStock, 5))),
          active: true,
          reason,
          stockNote: 'Baris pendua dalam fail - dibatalkan.',
          rawRow: row,
        });
        return;
      }

      seenBatchSkus.add(sku);

      const existingProd = existingSkuMap.get(sku);
      const parsedStock = Math.max(0, Math.floor(SmartInputService.parseNumeric(rawStock, 0)));

      // Parse status if present
      let isActive = true;
      if (rawStatus) {
        isActive = !/inactive|tidak|false|0/i.test(rawStatus);
      } else if (existingProd) {
        isActive = existingProd.active;
      }

      if (existingProd) {
        existingCount++;

        const costPrice = rawCost !== ''
          ? SmartInputService.roundToTwoDecimals(SmartInputService.parseNumeric(rawCost, existingProd.costPrice))
          : existingProd.costPrice;
        const sellingPrice = rawPrice !== ''
          ? SmartInputService.roundToTwoDecimals(SmartInputService.parseNumeric(rawPrice, existingProd.sellingPrice))
          : existingProd.sellingPrice;
        const category = rawCategory ? rawCategory.trim() : existingProd.category;
        const minimumStock = rawMinStock !== ''
          ? Math.max(0, Math.floor(SmartInputService.parseNumeric(rawMinStock, existingProd.minimumStock)))
          : existingProd.minimumStock;

        // Image URL: preserve existing if empty/omitted or invalid
        let resolvedImageUrl = existingProd.imageUrl;
        let imageWarning = '';
        if (hasImageColumn && rawImage.trim() !== '') {
          if (imageValidation.isValid && imageValidation.normalizedUrl) {
            resolvedImageUrl = imageValidation.normalizedUrl;
          } else {
            imageWarning = `URL gambar tidak sah ('${rawImage.trim()}') diabaikan demi keselamatan.`;
          }
        } else {
          resolvedImageUrl = existingProd.imageUrl;
        }

        if (mode === 'SKIP_EXISTING') {
          const reasonBase = `SKU '${sku}' sudah wujud dalam katalog (mod Langkau Sedia Ada).`;
          const reason = imageWarning ? `${reasonBase} ${imageWarning}` : reasonBase;
          duplicates.push({ rowNumber, reason, item: { sku, name } });
          rows.push({
            rowNumber,
            action: 'SKIP',
            sku,
            name,
            category,
            costPrice,
            sellingPrice,
            csvStock: parsedStock,
            minimumStock,
            active: isActive,
            imageUrl: resolvedImageUrl,
            reason,
            stockNote: 'Stock column ignored for existing products.',
            existingProductId: existingProd.id,
            rawRow: row,
          });
        } else {
          // UPDATE_EXISTING
          const reasonBase = `SKU '${sku}' sepadan dengan produk sedia ada (${existingProd.name}). Katalog akan dikemas kini.`;
          const reason = imageWarning ? `${reasonBase} ${imageWarning}` : reasonBase;
          const updateItem: CsvProductUpdateItem = {
            existingProductId: existingProd.id,
            sku: existingProd.sku,
            name,
            category: category || 'General',
            costPrice,
            sellingPrice,
            minimumStock,
            active: isActive,
            imageUrl: resolvedImageUrl,
            ignoredCsvStock: parsedStock,
          };
          updateItems.push(updateItem);
          rows.push({
            rowNumber,
            action: 'UPDATE',
            sku,
            name,
            category,
            costPrice,
            sellingPrice,
            csvStock: parsedStock,
            minimumStock,
            active: isActive,
            imageUrl: resolvedImageUrl,
            reason,
            stockNote: 'Stock column ignored for existing products.',
            existingProductId: existingProd.id,
            rawRow: row,
          });
        }
      } else {
        // Genuinely NEW product
        const costPrice = SmartInputService.roundToTwoDecimals(SmartInputService.parseNumeric(rawCost, 0));
        const sellingPrice = SmartInputService.roundToTwoDecimals(SmartInputService.parseNumeric(rawPrice, 0));
        const category = (rawCategory || 'Snacks & Biscuits').trim();
        const minimumStock = Math.max(0, Math.floor(SmartInputService.parseNumeric(rawMinStock, 5)));

        let newProductImageUrl: string | undefined = undefined;
        let imageWarning = '';
        if (hasImageColumn && rawImage.trim() !== '') {
          if (imageValidation.isValid && imageValidation.normalizedUrl) {
            newProductImageUrl = imageValidation.normalizedUrl;
          } else {
            imageWarning = `URL gambar tidak sah ('${rawImage.trim()}') diabaikan demi keselamatan.`;
          }
        }

        const newItem: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'> = {
          sku,
          name,
          category,
          costPrice,
          sellingPrice,
          currentStock: parsedStock,
          minimumStock,
          active: isActive,
          imageUrl: newProductImageUrl,
        };

        newItems.push(newItem);
        rows.push({
          rowNumber,
          action: 'NEW',
          sku,
          name,
          category,
          costPrice,
          sellingPrice,
          csvStock: parsedStock,
          minimumStock,
          active: isActive,
          imageUrl: newProductImageUrl,
          reason: imageWarning
            ? `Produk baru - akan didaftarkan ke katalog. ${imageWarning}`
            : 'Produk baru - akan didaftarkan ke katalog.',
          stockNote:
            parsedStock > 0
              ? `Pembukaan stok: ${parsedStock} unit (STOCK_IN direkodkan)`
              : 'Tiada pembukaan stok (0 unit)',
          rawRow: row,
        });
      }
    });

    const newCount = rows.filter((r) => r.action === 'NEW').length;
    const updateCount = rows.filter((r) => r.action === 'UPDATE').length;
    const skipCount = rows.filter((r) => r.action === 'SKIP').length;
    const invalidCount = rows.filter((r) => r.action === 'INVALID').length;

    return {
      totalRows: csvRows.length,
      validCount: newCount,
      duplicateCount: skipCount,
      invalidCount,
      validItems: newItems,
      duplicates,
      errors,
      newCount,
      updateCount,
      skipCount,
      existingCount,
      mode,
      rows,
      newItems,
      updateItems,
    };
  }

  /**
   * Validates and normalizes products from imported CSV before commit.
   * Preserves backward compatibility by invoking validateProductsUpsert with SKIP_EXISTING.
   */
  public static validateProductsImport(
    csvRows: Record<string, string>[],
    existingProducts: Product[]
  ): CsvImportValidationResult<Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>> {
    return this.validateProductsUpsert(csvRows, existingProducts, 'SKIP_EXISTING');
  }

  /**
   * MASTER CATALOG SYNC / OVERRIDE VALIDATION
   * Validates imported CSV rows where the CSV represents the authoritative CURRENT MASTER CATALOG.
   * - SKU is the primary matching key.
   * - Existing SKU = UPDATE / OVERRIDE CURRENT PRODUCT DATA (or UNCHANGED if identical).
   * - New SKU = NEW PRODUCT (opening stock via STOCK_IN).
   * - Stock differences create ADJUSTMENT movements (+X or -X). Zero diff creates no movement.
   * - Duplicate SKU inside the same CSV is strictly INVALID (Section 29).
   * - Missing products: DEACTIVATED if historical records exist; REMOVED if demo/unused (Section 15-17).
   */
  public static validateMasterCatalogSync(
    csvRows: Record<string, string>[],
    existingProducts: Product[],
    sales: Sale[] = [],
    purchases: Purchase[] = [],
    movements: InventoryMovement[] = []
  ): MasterCatalogSyncValidationResult {
    // 1. Pre-scan SKU frequencies within this CSV batch to detect internal duplicate SKUs
    const skuFrequencyMap = new Map<string, number>();
    csvRows.forEach((row) => {
      const matchingKey = Object.keys(row).find((k) => /sku/i.test(k));
      const rawSku = matchingKey ? row[matchingKey] : '';
      const norm = SmartInputService.normalizeCode(rawSku);
      if (norm) {
        skuFrequencyMap.set(norm, (skuFrequencyMap.get(norm) || 0) + 1);
      }
    });

    const existingSkuMap = new Map<string, Product>();
    existingProducts.forEach((p) => {
      existingSkuMap.set(SmartInputService.normalizeCode(p.sku), p);
    });

    const rows: MasterSyncProductRow[] = [];
    const errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[] = [];
    const validCsvSkus = new Set<string>();

    csvRows.forEach((row, index) => {
      const rowNumber = index + 2; // Header is line 1

      // Find keys case-insensitively with optional exclusion filter to prevent collisions
      // e.g. "Cost Price (RM)" must not collide with "Selling Price (RM)"
      const findVal = (pattern: RegExp, excludePattern?: RegExp) => {
        const matchingKey = Object.keys(row).find((k) => {
          if (!pattern.test(k)) return false;
          if (excludePattern && excludePattern.test(k)) return false;
          return true;
        });
        return matchingKey ? row[matchingKey] : '';
      };

      const rawSku = findVal(/sku|barcode|bar_code|kod/i);
      const rawName = findVal(/name|nama|tajuk|description|item|produk/i);
      const rawCategory = findVal(/category|kategori/i);

      // Cost price: matches cost/kos/modal/beli
      const rawCost = findVal(/cost|kos|modal|beli/i);

      // Selling price: prioritize explicit selling/jual/retail, OR price/harga excluding cost/kos/modal/beli
      const rawPrice =
        findVal(/selling|jual|retail/i) ||
        findVal(/price|harga/i, /cost|kos|modal|beli/i);

      // Current stock: prioritize current_stock/semasa, OR stock/stok/qty excluding min/minimum/ambang
      const rawStock =
        findVal(/current.*stock|stok.*semasa|current|semasa/i) ||
        findVal(/stock|stok|qty|kuantiti/i, /min|minimum|ambang/i);

      const rawMinStock = findVal(/min|minimum|ambang/i);
      const rawStatus = findVal(/status|active|aktif/i);
      const rawImage = findVal(/image.*url|url.*image|imageUrl|gambar|url.*gambar|image|foto|photo/i);
      const hasImageColumn = Object.keys(row).some((k) =>
        /image.*url|url.*image|imageUrl|gambar|url.*gambar|image|foto|photo/i.test(k)
      );
      const imageValidation = CsvService.validateImageUrl(rawImage);

      const sku = SmartInputService.normalizeCode(rawSku);
      const name = SmartInputService.normalizeName(rawName);

      // Validation 1: SKU must be present
      if (!sku) {
        const reason = 'SKU tidak boleh kosong.';
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku: rawSku || '-',
          name: rawName || '-',
          category: rawCategory || '-',
          costPrice: 0,
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - SKU kosong.',
          rawRow: row,
        });
        return;
      }

      // Validation 2: Duplicate SKU inside the same CSV file (Section 29)
      if ((skuFrequencyMap.get(sku) || 0) > 1) {
        const reason = `Duplikasi SKU '${sku}' dikesan dalam fail CSV ini. Setiap baris mesti mempunyai SKU yang unik.`;
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name: name || rawName || '-',
          category: rawCategory || 'General',
          costPrice: SmartInputService.parseNumeric(rawCost, 0),
          sellingPrice: SmartInputService.parseNumeric(rawPrice, 0),
          csvStock: SmartInputService.parseNumeric(rawStock, 0),
          minimumStock: SmartInputService.parseNumeric(rawMinStock, 5),
          active: true,
          reason,
          stockNote: 'Baris pendua dalam fail CSV - pembetulan fail diperlukan.',
          rawRow: row,
        });
        return;
      }

      // Validation 3: Product name must be present
      if (!name) {
        const reason = 'Nama produk tidak boleh kosong.';
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name: rawName || '-',
          category: rawCategory || '-',
          costPrice: 0,
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - Nama kosong.',
          rawRow: row,
        });
        return;
      }

      // Validation 4: Cost Price numeric & >= 0
      const trimmedCost = rawCost.trim();
      const parsedCostNum = trimmedCost !== '' ? Number(trimmedCost.replace(/[^0-9.-]+/g, '')) : NaN;
      if (trimmedCost === '' || isNaN(parsedCostNum) || parsedCostNum < 0 || !isFinite(parsedCostNum)) {
        const reason = `Harga kos '${rawCost}' tidak sah. Sila masukkan nombor bukan negatif.`;
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name,
          category: rawCategory || '-',
          costPrice: 0,
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - Kos tidak sah.',
          rawRow: row,
        });
        return;
      }

      // Validation 5: Selling Price numeric & >= 0
      const trimmedPrice = rawPrice.trim();
      const parsedPriceNum = trimmedPrice !== '' ? Number(trimmedPrice.replace(/[^0-9.-]+/g, '')) : NaN;
      if (trimmedPrice === '' || isNaN(parsedPriceNum) || parsedPriceNum < 0 || !isFinite(parsedPriceNum)) {
        const reason = `Harga jualan '${rawPrice}' tidak sah. Sila masukkan nombor bukan negatif.`;
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name,
          category: rawCategory || '-',
          costPrice: SmartInputService.roundToTwoDecimals(parsedCostNum),
          sellingPrice: 0,
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - Harga jualan tidak sah.',
          rawRow: row,
        });
        return;
      }

      // Validation 6: Stock safety (Section 8: numeric, integer, >= 0, no NaN, no Infinity)
      const trimmedStock = rawStock.trim();
      const parsedStockNum = trimmedStock !== '' ? Number(trimmedStock.replace(/[^0-9.-]+/g, '')) : NaN;
      if (
        trimmedStock === '' ||
        isNaN(parsedStockNum) ||
        parsedStockNum < 0 ||
        !isFinite(parsedStockNum) ||
        !Number.isInteger(parsedStockNum)
      ) {
        const reason = `Nilai stok '${rawStock}' tidak sah. Stok mestilah nombor bulat (integer) bukan negatif.`;
        errors.push({ rowNumber, reason, rawRow: row });
        rows.push({
          rowNumber,
          action: 'INVALID',
          sku,
          name,
          category: rawCategory || '-',
          costPrice: SmartInputService.roundToTwoDecimals(parsedCostNum),
          sellingPrice: SmartInputService.roundToTwoDecimals(parsedPriceNum),
          csvStock: 0,
          minimumStock: 0,
          active: false,
          reason,
          stockNote: 'Baris tidak sah - Nilai stok tidak sah.',
          rawRow: row,
        });
        return;
      }

      const costPrice = SmartInputService.roundToTwoDecimals(parsedCostNum);
      const sellingPrice = SmartInputService.roundToTwoDecimals(parsedPriceNum);
      const csvStock = parsedStockNum;
      const category = (rawCategory || 'Snacks & Biscuits').trim();
      const minimumStock = rawMinStock !== '' ? Math.max(0, Math.floor(SmartInputService.parseNumeric(rawMinStock, 5))) : 5;

      let active = true;
      if (rawStatus) {
        active = !/inactive|tidak|false|0/i.test(rawStatus);
      }

      validCsvSkus.add(sku);

      const existingProd = existingSkuMap.get(sku);

      if (existingProd) {
        // If status column wasn't provided in CSV, preserve existing status
        if (!rawStatus) {
          active = existingProd.active;
        }

        const currentStock = existingProd.currentStock;
        const stockDifference = csvStock - currentStock;
        const costChanged = Math.abs(costPrice - existingProd.costPrice) > 0.0001;
        const sellingPriceChanged = Math.abs(sellingPrice - existingProd.sellingPrice) > 0.0001;
        const stockChanged = stockDifference !== 0;
        const nameChanged = name !== existingProd.name;
        const categoryChanged = (category || 'General') !== (existingProd.category || 'General');
        const minStockChanged = minimumStock !== existingProd.minimumStock;
        const activeChanged = active !== existingProd.active;

        // Image URL handling: preserve existing if empty or invalid, update only if valid and changed
        let resolvedImageUrl = existingProd.imageUrl;
        let imageUrlChanged = false;
        let imageWarning = '';

        if (hasImageColumn && rawImage.trim() !== '') {
          if (imageValidation.isValid && imageValidation.normalizedUrl) {
            resolvedImageUrl = imageValidation.normalizedUrl;
            imageUrlChanged = (existingProd.imageUrl || '') !== resolvedImageUrl;
          } else {
            imageWarning = `URL gambar tidak sah ('${rawImage.trim()}') diabaikan demi keselamatan.`;
          }
        } else {
          resolvedImageUrl = existingProd.imageUrl;
        }

        const isUpdated =
          costChanged ||
          sellingPriceChanged ||
          stockChanged ||
          nameChanged ||
          categoryChanged ||
          minStockChanged ||
          activeChanged ||
          imageUrlChanged;

        const action: 'UPDATE' | 'UNCHANGED' = isUpdated ? 'UPDATE' : 'UNCHANGED';
        let reason = '';
        let stockNote = '';

        if (stockChanged) {
          stockNote =
            stockDifference > 0
              ? `Penyelarasan stok: +${stockDifference} unit (ADJUSTMENT)`
              : `Penyelarasan stok: ${stockDifference} unit (ADJUSTMENT)`;
        } else {
          stockNote = 'Stok tidak berubah (tiada pergerakan inventori)';
        }

        if (isUpdated) {
          const changes: string[] = [];
          if (nameChanged) changes.push(`nama (${existingProd.name} → ${name})`);
          if (costChanged) changes.push(`kos (RM${existingProd.costPrice.toFixed(2)} → RM${costPrice.toFixed(2)})`);
          if (sellingPriceChanged) changes.push(`harga jual (RM${existingProd.sellingPrice.toFixed(2)} → RM${sellingPrice.toFixed(2)})`);
          if (stockChanged) changes.push(`stok (${currentStock} → ${csvStock})`);
          if (categoryChanged) changes.push(`kategori (${existingProd.category} → ${category})`);
          if (minStockChanged) changes.push(`min stok (${existingProd.minimumStock} → ${minimumStock})`);
          if (activeChanged) changes.push(`status (${existingProd.active ? 'Aktif' : 'Tidak Aktif'} → ${active ? 'Aktif' : 'Tidak Aktif'})`);
          if (imageUrlChanged) changes.push('gambar produk dikemas kini');
          reason = `Katalog dikemas kini: ${changes.join(', ')}.`;
        } else {
          reason = 'Data katalog dan stok semasa sepadan sepenuhnya dengan fail CSV.';
        }
        if (imageWarning) {
          reason = `${reason} ${imageWarning}`;
        }

        rows.push({
          rowNumber,
          action,
          sku,
          name,
          category,
          costPrice,
          sellingPrice,
          csvStock,
          currentStock,
          stockDifference,
          minimumStock,
          active,
          imageUrl: resolvedImageUrl,
          imageUrlChanged,
          reason,
          stockNote,
          existingProductId: existingProd.id,
          costChanged,
          sellingPriceChanged,
          stockChanged,
          rawRow: row,
        });
      } else {
        // Genuinely NEW product
        let newProductImageUrl: string | undefined = undefined;
        let imageWarning = '';
        if (hasImageColumn && rawImage.trim() !== '') {
          if (imageValidation.isValid && imageValidation.normalizedUrl) {
            newProductImageUrl = imageValidation.normalizedUrl;
          } else {
            imageWarning = `URL gambar tidak sah ('${rawImage.trim()}') diabaikan demi keselamatan.`;
          }
        }

        const stockNote =
          csvStock > 0
            ? `Pembukaan stok: ${csvStock} unit (STOCK_IN direkodkan)`
            : 'Tiada pembukaan stok (0 unit)';

        const newReason = imageWarning
          ? `Produk baharu - akan didaftarkan ke dalam katalog master. ${imageWarning}`
          : 'Produk baharu - akan didaftarkan ke dalam katalog master.';

        rows.push({
          rowNumber,
          action: 'NEW',
          sku,
          name,
          category,
          costPrice,
          sellingPrice,
          csvStock,
          currentStock: 0,
          stockDifference: csvStock,
          minimumStock,
          active,
          imageUrl: newProductImageUrl,
          reason: newReason,
          stockNote,
          costChanged: true,
          sellingPriceChanged: true,
          stockChanged: csvStock > 0,
          rawRow: row,
        });
      }
    });

    // 2. Identify products in system NOT present in CSV (Section 15, 16, 17)
    const missingProducts: MasterSyncMissingProduct[] = [];
    existingProducts.forEach((p) => {
      const normSku = SmartInputService.normalizeCode(p.sku);
      if (!validCsvSkus.has(normSku)) {
        const eligibility = ProductService.checkDeleteEligibility(p, sales, purchases, movements);
        if (eligibility.hasHistoricalReferences) {
          missingProducts.push({
            product: p,
            action: 'DEACTIVATE',
            reason: 'Produk mempunyai rekod sejarah dan tiada dalam fail CSV. Dinyahaktifkan bagi mengekalkan rekod perniagaan.',
            hasHistoricalReferences: true,
          });
        } else {
          missingProducts.push({
            product: p,
            action: 'REMOVE',
            reason: 'Produk demo/ujian tanpa rekod sejarah dan tiada dalam fail CSV. Dikeluarkan dari katalog secara selamat.',
            hasHistoricalReferences: false,
          });
        }
      }
    });

    const newCount = rows.filter((r) => r.action === 'NEW').length;
    const updateCount = rows.filter((r) => r.action === 'UPDATE').length;
    const unchangedCount = rows.filter((r) => r.action === 'UNCHANGED').length;
    const invalidCount = rows.filter((r) => r.action === 'INVALID').length;
    const stockAdjustmentsCount =
      rows.filter((r) => r.action === 'UPDATE' && (r.stockDifference || 0) !== 0).length +
      rows.filter((r) => r.action === 'NEW' && r.csvStock > 0).length;
    const stockIncreaseCount = rows.filter(
      (r) => (r.action === 'UPDATE' || r.action === 'NEW') && (r.stockDifference || 0) > 0
    ).length;
    const stockDecreaseCount = rows.filter(
      (r) => r.action === 'UPDATE' && (r.stockDifference || 0) < 0
    ).length;
    const deactivatedCount = missingProducts.filter((m) => m.action === 'DEACTIVATE').length;
    const removedCount = missingProducts.filter((m) => m.action === 'REMOVE').length;

    return {
      totalRows: csvRows.length,
      newCount,
      updateCount,
      unchangedCount,
      stockAdjustmentsCount,
      stockIncreaseCount,
      stockDecreaseCount,
      invalidCount,
      missingProductsCount: missingProducts.length,
      deactivatedCount,
      removedCount,
      rows,
      missingProducts,
      errors,
      isValid: invalidCount === 0,
    };
  }

  /**
   * Validates suppliers from imported CSV with upsert support.
   */
  public static validateSuppliersUpsert(
    csvRows: Record<string, string>[],
    existingSuppliers: Supplier[]
  ): CsvEntityUpsertValidationResult<CreateSupplierInput, UpdateSupplierInput> {
    const existingCodeMap = new Map<string, Supplier>();
    const existingNameMap = new Map<string, Supplier>();

    existingSuppliers.forEach((s) => {
      if (s.supplierCode) existingCodeMap.set(SmartInputService.normalizeCode(s.supplierCode), s);
      if (s.supplierName) existingNameMap.set(s.supplierName.trim().toLowerCase(), s);
    });

    const seenBatchCodes = new Set<string>();
    const seenBatchNames = new Set<string>();

    const rows: CsvGenericEntityRow<any>[] = [];
    const newItems: CreateSupplierInput[] = [];
    const updateItems: { id: string; updates: UpdateSupplierInput }[] = [];
    const errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[] = [];

    csvRows.forEach((row, index) => {
      const rowNumber = index + 2;

      const findVal = (keyPattern: RegExp, excludePattern?: RegExp) => {
        const matchingKey = Object.keys(row).find((k) => {
          if (!keyPattern.test(k)) return false;
          if (excludePattern && excludePattern.test(k)) return false;
          return true;
        });
        return matchingKey ? row[matchingKey].trim() : '';
      };

      const rawCode = findVal(/supplier.*code|code|kod/i);
      const rawName = findVal(/supplier.*name|name|nama|syarikat|company/i);
      const rawContact = findVal(/contact|wakil|person|pegawai/i);
      const rawPhone = findVal(/phone|tel|telefon|hp|mobile/i);
      const rawEmail = findVal(/email|emel/i);
      const rawAddress = findVal(/address|alamat/i);
      const rawNotes = findVal(/note|nota|catatan/i);
      const rawStatus = findVal(/status|active|aktif/i);

      if (!rawName) {
        rows.push({
          rowNumber,
          action: 'INVALID',
          code: rawCode || '-',
          title: 'Tidak Sah (Nama Tiada)',
          subtitle: rawPhone || rawEmail || '-',
          reason: 'Nama pembekal wajib diisi.',
          payload: null,
          rawRow: row,
        });
        errors.push({ rowNumber, reason: 'Nama pembekal wajib diisi.', rawRow: row });
        return;
      }

      const normCode = rawCode ? SmartInputService.normalizeCode(rawCode) : '';
      const normName = rawName.toLowerCase();
      const isActive = !/inactive|tidak|palsu|false|0/i.test(rawStatus);

      // Check if matches existing supplier
      let existingMatch: Supplier | undefined;
      if (normCode && existingCodeMap.has(normCode)) {
        existingMatch = existingCodeMap.get(normCode);
      } else if (existingNameMap.has(normName)) {
        existingMatch = existingNameMap.get(normName);
      }

      if (existingMatch) {
        const updates: UpdateSupplierInput = {
          supplierName: rawName,
          contactPerson: rawContact || existingMatch.contactPerson || '',
          phone: rawPhone || existingMatch.phone || '',
          email: rawEmail || existingMatch.email || '',
          address: rawAddress || existingMatch.address || '',
          notes: rawNotes || existingMatch.notes || '',
          active: isActive,
        };
        if (normCode) updates.supplierCode = normCode;

        updateItems.push({ id: existingMatch.id, updates });
        rows.push({
          rowNumber,
          action: 'UPDATE',
          code: normCode || existingMatch.supplierCode,
          title: rawName,
          subtitle: rawContact ? `${rawContact} (${rawPhone || '-'})` : rawPhone || rawEmail || '-',
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: `Kemaskini maklumat pembekal sedia ada (${existingMatch.supplierCode})`,
          existingId: existingMatch.id,
          payload: updates,
          rawRow: row,
        });
      } else {
        // New Supplier
        if (normCode && seenBatchCodes.has(normCode)) {
          rows.push({
            rowNumber,
            action: 'INVALID',
            code: normCode,
            title: rawName,
            reason: `Duplikasi kod pembekal "${normCode}" dalam fail CSV.`,
            payload: null,
            rawRow: row,
          });
          errors.push({
            rowNumber,
            reason: `Duplikasi kod pembekal "${normCode}" dalam fail CSV.`,
            rawRow: row,
          });
          return;
        }

        if (normCode) seenBatchCodes.add(normCode);
        seenBatchNames.add(normName);

        const newItem: CreateSupplierInput = {
          supplierCode: normCode || undefined,
          supplierName: rawName,
          contactPerson: rawContact || undefined,
          phone: rawPhone || undefined,
          email: rawEmail || undefined,
          address: rawAddress || undefined,
          notes: rawNotes || undefined,
        };

        newItems.push(newItem);
        rows.push({
          rowNumber,
          action: 'NEW',
          code: normCode || '(Autogenerate)',
          title: rawName,
          subtitle: rawContact ? `${rawContact} (${rawPhone || '-'})` : rawPhone || rawEmail || '-',
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: 'Pendaftaran pembekal baru',
          payload: newItem,
          rawRow: row,
        });
      }
    });

    const newCount = rows.filter((r) => r.action === 'NEW').length;
    const updateCount = rows.filter((r) => r.action === 'UPDATE').length;
    const invalidCount = rows.filter((r) => r.action === 'INVALID').length;

    return {
      totalRows: csvRows.length,
      newCount,
      updateCount,
      invalidCount,
      rows,
      newItems,
      updateItems,
      errors,
      isValid: invalidCount === 0,
    };
  }

  /**
   * Validates customers from imported CSV with upsert support.
   */
  public static validateCustomersUpsert(
    csvRows: Record<string, string>[],
    existingCustomers: Customer[]
  ): CsvEntityUpsertValidationResult<CreateCustomerInput, UpdateCustomerInput> {
    const existingCodeMap = new Map<string, Customer>();
    const existingPhoneMap = new Map<string, Customer>();

    existingCustomers.forEach((c) => {
      if (c.customerCode) existingCodeMap.set(SmartInputService.normalizeCode(c.customerCode), c);
      if (c.phone) {
        const cleanPhone = c.phone.replace(/\D/g, '');
        if (cleanPhone) existingPhoneMap.set(cleanPhone, c);
      }
    });

    const seenBatchCodes = new Set<string>();
    const seenBatchPhones = new Set<string>();

    const rows: CsvGenericEntityRow<any>[] = [];
    const newItems: CreateCustomerInput[] = [];
    const updateItems: { id: string; updates: UpdateCustomerInput }[] = [];
    const errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[] = [];

    csvRows.forEach((row, index) => {
      const rowNumber = index + 2;

      const findVal = (keyPattern: RegExp, excludePattern?: RegExp) => {
        const matchingKey = Object.keys(row).find((k) => {
          if (!keyPattern.test(k)) return false;
          if (excludePattern && excludePattern.test(k)) return false;
          return true;
        });
        return matchingKey ? row[matchingKey].trim() : '';
      };

      const rawCode = findVal(/customer.*code|code|kod/i);
      const rawName = findVal(/customer.*name|name|nama|pelanggan/i);
      const rawPhone = findVal(/phone|tel|telefon|hp|mobile/i);
      const rawEmail = findVal(/email|emel/i);
      const rawNotes = findVal(/note|nota|catatan/i);
      const rawStatus = findVal(/status|active|aktif/i);

      if (!rawName) {
        rows.push({
          rowNumber,
          action: 'INVALID',
          code: rawCode || '-',
          title: 'Tidak Sah (Nama Tiada)',
          subtitle: rawPhone || rawEmail || '-',
          reason: 'Nama pelanggan wajib diisi.',
          payload: null,
          rawRow: row,
        });
        errors.push({ rowNumber, reason: 'Nama pelanggan wajib diisi.', rawRow: row });
        return;
      }

      const normCode = rawCode ? SmartInputService.normalizeCode(rawCode) : '';
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const isActive = !/inactive|tidak|palsu|false|0/i.test(rawStatus);

      let existingMatch: Customer | undefined;
      if (normCode && existingCodeMap.has(normCode)) {
        existingMatch = existingCodeMap.get(normCode);
      } else if (cleanPhone && existingPhoneMap.has(cleanPhone)) {
        existingMatch = existingPhoneMap.get(cleanPhone);
      }

      if (existingMatch) {
        const updates: UpdateCustomerInput = {
          customerName: rawName,
          phone: rawPhone || existingMatch.phone || '',
          email: rawEmail || existingMatch.email || '',
          notes: rawNotes || existingMatch.notes || '',
          active: isActive,
        };
        if (normCode) updates.customerCode = normCode;

        updateItems.push({ id: existingMatch.id, updates });
        rows.push({
          rowNumber,
          action: 'UPDATE',
          code: normCode || existingMatch.customerCode,
          title: rawName,
          subtitle: rawPhone ? `Tel: ${rawPhone}` : rawEmail || 'Tiada maklumat telefon',
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: `Kemaskini maklumat pelanggan sedia ada (${existingMatch.customerCode})`,
          existingId: existingMatch.id,
          payload: updates,
          rawRow: row,
        });
      } else {
        if (normCode && seenBatchCodes.has(normCode)) {
          rows.push({
            rowNumber,
            action: 'INVALID',
            code: normCode,
            title: rawName,
            reason: `Duplikasi kod pelanggan "${normCode}" dalam fail CSV.`,
            payload: null,
            rawRow: row,
          });
          errors.push({
            rowNumber,
            reason: `Duplikasi kod pelanggan "${normCode}" dalam fail CSV.`,
            rawRow: row,
          });
          return;
        }
        if (normCode) seenBatchCodes.add(normCode);
        if (cleanPhone) seenBatchPhones.add(cleanPhone);

        const newItem: CreateCustomerInput = {
          customerCode: normCode || undefined,
          customerName: rawName,
          phone: rawPhone || undefined,
          email: rawEmail || undefined,
          notes: rawNotes || undefined,
          active: isActive,
        };

        newItems.push(newItem);
        rows.push({
          rowNumber,
          action: 'NEW',
          code: normCode || '(Autogenerate)',
          title: rawName,
          subtitle: rawPhone ? `Tel: ${rawPhone}` : rawEmail || 'Pelanggan Baru',
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: 'Pendaftaran pelanggan baru',
          payload: newItem,
          rawRow: row,
        });
      }
    });

    const newCount = rows.filter((r) => r.action === 'NEW').length;
    const updateCount = rows.filter((r) => r.action === 'UPDATE').length;
    const invalidCount = rows.filter((r) => r.action === 'INVALID').length;

    return {
      totalRows: csvRows.length,
      newCount,
      updateCount,
      invalidCount,
      rows,
      newItems,
      updateItems,
      errors,
      isValid: invalidCount === 0,
    };
  }

  /**
   * Validates staff users from imported CSV with upsert support.
   */
  public static validateStaffUpsert(
    csvRows: Record<string, string>[],
    existingStaff: StaffUser[]
  ): CsvEntityUpsertValidationResult<CreateStaffInput, UpdateStaffInput> {
    const existingCodeMap = new Map<string, StaffUser>();
    const existingNameMap = new Map<string, StaffUser>();

    existingStaff.forEach((s) => {
      const code = s.staffCode || s.userCode;
      if (code) existingCodeMap.set(SmartInputService.normalizeCode(code), s);
      if (s.name) existingNameMap.set(s.name.trim().toLowerCase(), s);
    });

    const seenBatchCodes = new Set<string>();

    const rows: CsvGenericEntityRow<any>[] = [];
    const newItems: CreateStaffInput[] = [];
    const updateItems: { id: string; updates: UpdateStaffInput }[] = [];
    const errors: { rowNumber: number; reason: string; rawRow: Record<string, string> }[] = [];

    csvRows.forEach((row, index) => {
      const rowNumber = index + 2;

      const findVal = (keyPattern: RegExp, excludePattern?: RegExp) => {
        const matchingKey = Object.keys(row).find((k) => {
          if (!keyPattern.test(k)) return false;
          if (excludePattern && excludePattern.test(k)) return false;
          return true;
        });
        return matchingKey ? row[matchingKey].trim() : '';
      };

      const rawCode = findVal(/staff.*code|user.*code|code|kod/i);
      const rawName = findVal(/staff.*name|name|nama|pekerja|staf/i);
      const rawRole = findVal(/role|peranan|jawatan/i);
      const rawStatus = findVal(/status|active|aktif/i);

      if (!rawName) {
        rows.push({
          rowNumber,
          action: 'INVALID',
          code: rawCode || '-',
          title: 'Tidak Sah (Nama Tiada)',
          subtitle: rawRole || '-',
          reason: 'Nama pekerja/staf wajib diisi.',
          payload: null,
          rawRow: row,
        });
        errors.push({ rowNumber, reason: 'Nama pekerja/staf wajib diisi.', rawRow: row });
        return;
      }

      // Parse role
      let role: StaffRole = 'CASHIER';
      const upperRole = rawRole.toUpperCase();
      if (/MANAGER|PENGURUS/i.test(upperRole)) {
        role = 'MANAGER';
      } else if (/OWNER|PEMILIK/i.test(upperRole)) {
        role = 'OWNER';
      } else if (/INVENTORY|STOK/i.test(upperRole)) {
        role = 'INVENTORY_STAFF';
      } else {
        role = 'CASHIER';
      }

      const normCode = rawCode ? SmartInputService.normalizeCode(rawCode) : '';
      const normName = rawName.toLowerCase();
      const isActive = !/inactive|tidak|palsu|false|0/i.test(rawStatus);

      let existingMatch: StaffUser | undefined;
      if (normCode && existingCodeMap.has(normCode)) {
        existingMatch = existingCodeMap.get(normCode);
      } else if (existingNameMap.has(normName)) {
        existingMatch = existingNameMap.get(normName);
      }

      if (existingMatch) {
        const updates: UpdateStaffInput = {
          name: rawName,
          role,
          active: isActive,
        };
        if (normCode) {
          updates.staffCode = normCode;
          updates.userCode = normCode;
        }

        updateItems.push({ id: existingMatch.id, updates });
        rows.push({
          rowNumber,
          action: 'UPDATE',
          code: normCode || existingMatch.staffCode || existingMatch.userCode,
          title: rawName,
          subtitle: `Peranan: ${role}`,
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: `Kemaskini maklumat staf sedia ada (${existingMatch.staffCode || existingMatch.userCode})`,
          existingId: existingMatch.id,
          payload: updates,
          rawRow: row,
        });
      } else {
        if (normCode && seenBatchCodes.has(normCode)) {
          rows.push({
            rowNumber,
            action: 'INVALID',
            code: normCode,
            title: rawName,
            reason: `Duplikasi kod staf "${normCode}" dalam fail CSV.`,
            payload: null,
            rawRow: row,
          });
          errors.push({
            rowNumber,
            reason: `Duplikasi kod staf "${normCode}" dalam fail CSV.`,
            rawRow: row,
          });
          return;
        }
        if (normCode) seenBatchCodes.add(normCode);

        const newItem: CreateStaffInput = {
          staffCode: normCode || undefined,
          userCode: normCode || undefined,
          name: rawName,
          role,
          active: isActive,
        };

        newItems.push(newItem);
        rows.push({
          rowNumber,
          action: 'NEW',
          code: normCode || '(Autogenerate)',
          title: rawName,
          subtitle: `Peranan: ${role}`,
          tag: isActive ? 'ACTIVE' : 'INACTIVE',
          reason: 'Pendaftaran staf/pekerja baru',
          payload: newItem,
          rawRow: row,
        });
      }
    });

    const newCount = rows.filter((r) => r.action === 'NEW').length;
    const updateCount = rows.filter((r) => r.action === 'UPDATE').length;
    const invalidCount = rows.filter((r) => r.action === 'INVALID').length;

    return {
      totalRows: csvRows.length,
      newCount,
      updateCount,
      invalidCount,
      rows,
      newItems,
      updateItems,
      errors,
      isValid: invalidCount === 0,
    };
  }
}

