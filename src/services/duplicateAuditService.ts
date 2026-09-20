/**
 * NiagaPOS - Duplicate Audit Service
 * SYNCROZZ Engineering Standard (SES) v4.4 Locked
 *
 * Core Principle:
 * DETECT → SHOW → REVIEW (NOT: DETECT → DELETE)
 * Never automatically deletes, merges, or overwrites authoritative records.
 * The administrator remains authoritative.
 */

import { Product, Supplier, Customer, StaffUser } from '../types';
import { MenuItem, RestaurantTable } from '../types/restaurant';

export interface DuplicateGroup<T> {
  entityType: 'PRODUCT' | 'SUPPLIER' | 'CUSTOMER' | 'STAFF' | 'MENU_ITEM' | 'TABLE';
  field: string;
  duplicateValue: string;
  items: T[];
  message: string;
  matchType?: 'EXACT' | 'CASE_WHITESPACE';
}

export type DuplicateAuditGroup<T> = DuplicateGroup<T>;

export class DuplicateAuditService {
  /**
   * Audits Menu Items for identical names or codes (Exact and Case/Whitespace Normalized).
   * Non-destructive detection and review only.
   */
  public static auditMenuItems(menuItems: MenuItem[]): DuplicateGroup<MenuItem>[] {
    const results: DuplicateGroup<MenuItem>[] = [];

    const exactNameMap = new Map<string, MenuItem[]>();
    const normalizedNameMap = new Map<string, MenuItem[]>();
    const codeMap = new Map<string, MenuItem[]>();

    menuItems.forEach((item) => {
      const rawName = (item.name || '').trim();
      const normName = rawName.toLowerCase().replace(/\s+/g, ' ');

      if (rawName) {
        const exactList = exactNameMap.get(rawName) || [];
        exactList.push(item);
        exactNameMap.set(rawName, exactList);

        const normList = normalizedNameMap.get(normName) || [];
        normList.push(item);
        normalizedNameMap.set(normName, normList);
      }

      const code = (item.code || '').trim().toUpperCase();
      if (code) {
        const codeList = codeMap.get(code) || [];
        codeList.push(item);
        codeMap.set(code, codeList);
      }
    });

    // Check code duplicates
    codeMap.forEach((items, code) => {
      if (items.length > 1) {
        results.push({
          entityType: 'MENU_ITEM',
          field: 'Kod Menu',
          duplicateValue: code,
          items,
          message: `${items.length} hidangan berkongsi Kod Menu yang sama: ${code}`,
          matchType: 'EXACT',
        });
      }
    });

    // Check exact name duplicates
    const reportedExactNames = new Set<string>();
    exactNameMap.forEach((items, name) => {
      if (items.length > 1) {
        results.push({
          entityType: 'MENU_ITEM',
          field: 'Nama Hidangan (Tepat)',
          duplicateValue: name,
          items,
          message: `${items.length} hidangan mempunyai nama yang sama tepat: "${name}"`,
          matchType: 'EXACT',
        });
        reportedExactNames.add(name.toLowerCase().replace(/\s+/g, ' '));
      }
    });

    // Check normalized whitespace / case-insensitive duplicates (if not already reported exact)
    normalizedNameMap.forEach((items, normName) => {
      if (items.length > 1 && !reportedExactNames.has(normName)) {
        results.push({
          entityType: 'MENU_ITEM',
          field: 'Nama Hidangan (Variasi Huruf / Ruang)',
          duplicateValue: normName,
          items,
          message: `${items.length} hidangan berkongsi nama hampir serupa (perbezaan huruf/jarak): "${normName}"`,
          matchType: 'CASE_WHITESPACE',
        });
      }
    });

    return results;
  }

  /**
   * Audits Restaurant Tables for duplicate table numbers.
   * Non-destructive detection and review only.
   */
  public static auditTables(tables: RestaurantTable[]): DuplicateGroup<RestaurantTable>[] {
    const results: DuplicateGroup<RestaurantTable>[] = [];
    const tableNoMap = new Map<string, RestaurantTable[]>();

    tables.forEach((t) => {
      const cleanNo = (t.tableNumber || '').trim().toUpperCase().replace(/\s+/g, '');
      if (cleanNo) {
        const group = tableNoMap.get(cleanNo) || [];
        group.push(t);
        tableNoMap.set(cleanNo, group);
      }
    });

    tableNoMap.forEach((items, no) => {
      if (items.length > 1) {
        results.push({
          entityType: 'TABLE',
          field: 'Nombor Meja',
          duplicateValue: no,
          items,
          message: `${items.length} meja berkongsi nombor meja yang sama: ${no}`,
          matchType: 'EXACT',
        });
      }
    });

    return results;
  }
  /**
   * Audits Products for identical SKUs or duplicate Names.
   */
  public static auditProducts(products: Product[]): DuplicateGroup<Product>[] {
    const results: DuplicateGroup<Product>[] = [];

    // Group by SKU
    const skuMap = new Map<string, Product[]>();
    // Group by normalized Name
    const nameMap = new Map<string, Product[]>();

    products.forEach((p) => {
      const cleanSku = (p.sku || '').trim().toUpperCase();
      if (cleanSku) {
        const group = skuMap.get(cleanSku) || [];
        group.push(p);
        skuMap.set(cleanSku, group);
      }

      const cleanName = (p.name || '').trim().toUpperCase();
      if (cleanName) {
        const group = nameMap.get(cleanName) || [];
        group.push(p);
        nameMap.set(cleanName, group);
      }
    });

    skuMap.forEach((items, sku) => {
      if (items.length > 1) {
        results.push({
          entityType: 'PRODUCT',
          field: 'SKU',
          duplicateValue: sku,
          items,
          message: `${items.length} produk berkongsi SKU yang sama: ${sku}`,
        });
      }
    });

    nameMap.forEach((items, name) => {
      if (items.length > 1) {
        results.push({
          entityType: 'PRODUCT',
          field: 'Nama Produk',
          duplicateValue: name,
          items,
          message: `${items.length} produk mempunyai nama yang sama: ${name}`,
        });
      }
    });

    return results;
  }

  /**
   * Audits Suppliers for duplicate Supplier Codes, Names, or Phone Numbers.
   */
  public static auditSuppliers(suppliers: Supplier[]): DuplicateGroup<Supplier>[] {
    const results: DuplicateGroup<Supplier>[] = [];

    const codeMap = new Map<string, Supplier[]>();
    const nameMap = new Map<string, Supplier[]>();
    const phoneMap = new Map<string, Supplier[]>();

    suppliers.forEach((s) => {
      const code = (s.supplierCode || '').trim().toUpperCase();
      if (code) {
        const group = codeMap.get(code) || [];
        group.push(s);
        codeMap.set(code, group);
      }

      const name = (s.supplierName || '').trim().toUpperCase();
      if (name) {
        const group = nameMap.get(name) || [];
        group.push(s);
        nameMap.set(name, group);
      }

      const phone = (s.phone || '').replace(/\D/g, '');
      if (phone && phone.length >= 7) {
        const group = phoneMap.get(phone) || [];
        group.push(s);
        phoneMap.set(phone, group);
      }
    });

    codeMap.forEach((items, code) => {
      if (items.length > 1) {
        results.push({
          entityType: 'SUPPLIER',
          field: 'Kod Pembekal',
          duplicateValue: code,
          items,
          message: `${items.length} pembekal berkongsi kod yang sama: ${code}`,
        });
      }
    });

    nameMap.forEach((items, name) => {
      if (items.length > 1) {
        results.push({
          entityType: 'SUPPLIER',
          field: 'Nama Pembekal',
          duplicateValue: name,
          items,
          message: `${items.length} pembekal mempunyai nama yang sama: ${name}`,
        });
      }
    });

    phoneMap.forEach((items, phone) => {
      if (items.length > 1) {
        results.push({
          entityType: 'SUPPLIER',
          field: 'Nombor Telefon',
          duplicateValue: phone,
          items,
          message: `${items.length} pembekal berkongsi nombor telefon yang sama`,
        });
      }
    });

    return results;
  }

  /**
   * Audits Customers for duplicate Customer Codes, Names, or Phone Numbers.
   */
  public static auditCustomers(customers: Customer[]): DuplicateGroup<Customer>[] {
    const results: DuplicateGroup<Customer>[] = [];

    const codeMap = new Map<string, Customer[]>();
    const nameMap = new Map<string, Customer[]>();
    const phoneMap = new Map<string, Customer[]>();

    customers.forEach((c) => {
      const code = (c.customerCode || '').trim().toUpperCase();
      if (code) {
        const group = codeMap.get(code) || [];
        group.push(c);
        codeMap.set(code, group);
      }

      const name = (c.customerName || '').trim().toUpperCase();
      if (name) {
        const group = nameMap.get(name) || [];
        group.push(c);
        nameMap.set(name, group);
      }

      const phone = (c.phone || '').replace(/\D/g, '');
      if (phone && phone.length >= 7) {
        const group = phoneMap.get(phone) || [];
        group.push(c);
        phoneMap.set(phone, group);
      }
    });

    codeMap.forEach((items, code) => {
      if (items.length > 1) {
        results.push({
          entityType: 'CUSTOMER',
          field: 'Kod Pelanggan',
          duplicateValue: code,
          items,
          message: `${items.length} pelanggan berkongsi kod yang sama: ${code}`,
        });
      }
    });

    nameMap.forEach((items, name) => {
      if (items.length > 1) {
        results.push({
          entityType: 'CUSTOMER',
          field: 'Nama Pelanggan',
          duplicateValue: name,
          items,
          message: `${items.length} pelanggan mempunyai nama yang sama: ${name}`,
        });
      }
    });

    phoneMap.forEach((items, phone) => {
      if (items.length > 1) {
        results.push({
          entityType: 'CUSTOMER',
          field: 'Nombor Telefon',
          duplicateValue: phone,
          items,
          message: `${items.length} pelanggan berkongsi nombor telefon yang sama`,
        });
      }
    });

    return results;
  }
}
