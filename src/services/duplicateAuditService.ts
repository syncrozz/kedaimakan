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

export interface DuplicateGroup<T> {
  entityType: 'PRODUCT' | 'SUPPLIER' | 'CUSTOMER' | 'STAFF';
  field: string;
  duplicateValue: string;
  items: T[];
  message: string;
}

export type DuplicateAuditGroup<T> = DuplicateGroup<T>;

export class DuplicateAuditService {
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
