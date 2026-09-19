/**
 * NiagaPOS - Supplier Service
 * Part 05: Purchasing + Supplier Management
 *
 * Rules:
 * 1. Supplier code is unique across active and inactive suppliers.
 * 2. Supplier name is required and trimmed.
 * 3. Never hard-delete suppliers that have historical purchases. Deactivate instead.
 */

import { Supplier, Purchase } from '../types';

export interface CreateSupplierInput {
  supplierCode?: string;
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  supplierCode?: string;
  supplierName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

export class SupplierService {
  /**
   * Generates the next sequential supplier code (e.g. SUP-001, SUP-002).
   */
  static generateNextSupplierCode(existingSuppliers: Supplier[]): string {
    let maxNum = 0;
    const regex = /^SUP-(\d+)$/i;

    existingSuppliers.forEach((s) => {
      const match = s.supplierCode.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `SUP-${String(nextNum).padStart(3, '0')}`;
  }

  /**
   * Validates supplier code uniqueness across both active and inactive suppliers.
   */
  static isSupplierCodeUnique(
    code: string,
    existingSuppliers: Supplier[],
    excludeSupplierId?: string
  ): boolean {
    if (!code || !code.trim()) return false;
    const normalized = code.trim().toUpperCase();
    return !existingSuppliers.some(
      (s) => s.supplierCode.trim().toUpperCase() === normalized && s.id !== excludeSupplierId
    );
  }

  /**
   * Validates supplier data for creation or updating.
   */
  static validateSupplier(
    input: CreateSupplierInput | UpdateSupplierInput,
    existingSuppliers: Supplier[] = [],
    supplierId?: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Supplier Code validation
    if (input.supplierCode !== undefined) {
      const code = input.supplierCode.trim();
      if (!code) {
        errors.push('Supplier code is required.');
      } else if (!SupplierService.isSupplierCodeUnique(code, existingSuppliers, supplierId)) {
        errors.push(`Supplier code "${code.toUpperCase()}" is already in use.`);
      }
    }

    // Supplier Name validation
    if (input.supplierName !== undefined) {
      const name = input.supplierName.trim();
      if (!name) {
        errors.push('Supplier name is required.');
      } else if (name.length < 2) {
        errors.push('Supplier name must be at least 2 characters.');
      } else if (name.length > 100) {
        errors.push('Supplier name must not exceed 100 characters.');
      }
    }

    // Email validation (optional)
    if (input.email && input.email.trim()) {
      const email = input.email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Invalid email address format.');
      }
    }

    // Phone validation (optional)
    if (input.phone && input.phone.trim()) {
      const phone = input.phone.trim();
      if (phone.length < 5 || phone.length > 25) {
        errors.push('Phone number length is invalid.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Creates a new supplier with validated inputs.
   */
  static createSupplier(
    input: CreateSupplierInput,
    existingSuppliers: Supplier[]
  ): Supplier {
    const code = input.supplierCode?.trim().toUpperCase() || SupplierService.generateNextSupplierCode(existingSuppliers);
    const validation = SupplierService.validateSupplier(
      { ...input, supplierCode: code },
      existingSuppliers
    );

    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const now = new Date().toISOString();
    return {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      supplierCode: code,
      supplierName: input.supplierName.trim(),
      contactPerson: input.contactPerson?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Updates an existing supplier.
   */
  static updateSupplier(
    supplierId: string,
    updates: UpdateSupplierInput,
    existingSuppliers: Supplier[]
  ): Supplier {
    const current = existingSuppliers.find((s) => s.id === supplierId);
    if (!current) {
      throw new Error('Supplier not found.');
    }

    const validation = SupplierService.validateSupplier(
      updates,
      existingSuppliers,
      supplierId
    );

    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const now = new Date().toISOString();
    return {
      ...current,
      supplierCode: updates.supplierCode ? updates.supplierCode.trim().toUpperCase() : current.supplierCode,
      supplierName: updates.supplierName ? updates.supplierName.trim() : current.supplierName,
      contactPerson: updates.contactPerson !== undefined ? updates.contactPerson.trim() || undefined : current.contactPerson,
      phone: updates.phone !== undefined ? updates.phone.trim() || undefined : current.phone,
      email: updates.email !== undefined ? updates.email.trim() || undefined : current.email,
      address: updates.address !== undefined ? updates.address.trim() || undefined : current.address,
      notes: updates.notes !== undefined ? updates.notes.trim() || undefined : current.notes,
      active: updates.active !== undefined ? updates.active : current.active,
      updatedAt: now,
    };
  }

  /**
   * Determines if a supplier can be permanently removed,
   * or must only be deactivated due to historical purchase records.
   */
  static canDeleteSupplier(
    supplierId: string,
    purchases: Purchase[]
  ): { canDelete: boolean; reason?: string } {
    const hasPurchases = purchases.some((p) => p.supplierId === supplierId);
    if (hasPurchases) {
      return {
        canDelete: false,
        reason: 'Supplier has historical purchase records. It can only be deactivated to preserve audit trails.',
      };
    }
    return { canDelete: true };
  }

  /**
   * Filters suppliers by keyword (code, name, contactPerson, phone, email) and active status.
   */
  static filterSuppliers(
    suppliers: Supplier[],
    filters?: {
      search?: string;
      active?: boolean;
    }
  ): Supplier[] {
    if (!filters) return suppliers;

    return suppliers.filter((s) => {
      if (filters.active !== undefined && s.active !== filters.active) {
        return false;
      }

      if (filters.search && filters.search.trim()) {
        const query = filters.search.trim().toLowerCase();
        const matches =
          s.supplierCode.toLowerCase().includes(query) ||
          s.supplierName.toLowerCase().includes(query) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(query)) ||
          (s.phone && s.phone.toLowerCase().includes(query)) ||
          (s.email && s.email.toLowerCase().includes(query));

        if (!matches) return false;
      }

      return true;
    });
  }
}
