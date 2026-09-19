/**
 * NiagaPOS - Customer Domain Service
 * Part 07: Optional Retail Modules - Customer Management & History
 *
 * Rules:
 * 1. Sequential customer codes (CUS-000001, CUS-000002, etc.).
 * 2. Inactive customers cannot be selected for new customer-linked transactions.
 * 3. Never destructively delete customers with transaction history (soft deactivate).
 * 4. Customer Total Spend = Sum of actual realized sales revenue (sale.total, after discounts) for completed sales.
 * 5. Historical sales preserve customer snapshots; changing customer metadata never alters historical transactions.
 */

import { Customer, Sale, LoyaltyLedgerEntry } from '../types';

export interface CreateCustomerInput {
  customerCode?: string;
  customerName: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
}

export interface UpdateCustomerInput {
  customerCode?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
}

export interface CustomerMetrics {
  totalTransactions: number;
  totalOrders: number;
  totalSpent: number; // Actual realized sales revenue (sale.total, after discount)
  totalSpend: number;
  itemsPurchased: number;
  lastPurchaseDate: string | null;
  lastOrderDate?: string;
  completedSales: Sale[];
  pointsBalance: number;
}

export class CustomerService {
  /**
   * Generates next sequential customer code (e.g. CUS-000001, CUS-000002).
   * Safe against non-contiguous numbers and gaps.
   */
  public static generateCustomerCode(existingCustomers: Customer[]): string {
    let nextNum = 1;
    for (const c of existingCustomers) {
      if (!c || !c.customerCode) continue;
      const match = c.customerCode.match(/CUS[-_]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }
    }
    return `CUS-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Validates uniqueness of customer code (case-insensitive).
   */
  public static isCustomerCodeUnique(
    code: string,
    existingCustomers: Customer[],
    excludeId?: string
  ): boolean {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return false;
    return !existingCustomers.some(
      (c) => c.id !== excludeId && c.customerCode.trim().toUpperCase() === normalized
    );
  }

  public static generateNextCustomerCode(existingCustomers: Customer[]): string {
    return this.generateCustomerCode(existingCustomers);
  }

  public static isCustomerCodeAvailable(
    code: string,
    existingCustomers: Customer[],
    excludeId?: string
  ): boolean {
    return this.isCustomerCodeUnique(code, existingCustomers, excludeId);
  }

  /**
   * Creates a new customer with validation.
   */
  public static createCustomer(
    input: CreateCustomerInput,
    existingCustomers: Customer[]
  ): Customer {
    const trimmedName = input.customerName?.trim();
    if (!trimmedName) {
      throw new Error('Customer name is required.');
    }

    let code = input.customerCode?.trim().toUpperCase();
    if (!code) {
      code = this.generateCustomerCode(existingCustomers);
    } else {
      if (!this.isCustomerCodeUnique(code, existingCustomers)) {
        throw new Error(`Customer code "${code}" is already in use.`);
      }
    }

    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: `cus-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerCode: code,
      customerName: trimmedName,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    return newCustomer;
  }

  /**
   * Updates an existing customer.
   */
  public static updateCustomer(
    customerId: string,
    updates: UpdateCustomerInput,
    existingCustomers: Customer[]
  ): Customer {
    const target = existingCustomers.find((c) => c.id === customerId);
    if (!target) {
      throw new Error(`Customer with ID "${customerId}" not found.`);
    }

    if (updates.customerName !== undefined) {
      const trimmedName = updates.customerName.trim();
      if (!trimmedName) {
        throw new Error('Customer name cannot be empty.');
      }
    }

    if (updates.customerCode !== undefined) {
      const trimmedCode = updates.customerCode.trim().toUpperCase();
      if (!trimmedCode) {
        throw new Error('Customer code cannot be empty.');
      }
      if (!this.isCustomerCodeUnique(trimmedCode, existingCustomers, customerId)) {
        throw new Error(`Customer code "${trimmedCode}" is already in use.`);
      }
    }

    return {
      ...target,
      customerName: updates.customerName !== undefined ? updates.customerName.trim() : target.customerName,
      customerCode: updates.customerCode !== undefined ? updates.customerCode.trim().toUpperCase() : target.customerCode,
      phone: updates.phone !== undefined ? updates.phone.trim() || undefined : target.phone,
      email: updates.email !== undefined ? updates.email.trim() || undefined : target.email,
      notes: updates.notes !== undefined ? updates.notes.trim() || undefined : target.notes,
      active: updates.active !== undefined ? updates.active : target.active,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Safe deletion verification.
   * Customers with historical sales cannot be hard-deleted.
   */
  public static canDeleteCustomer(
    customerId: string,
    sales: Sale[]
  ): { canDelete: boolean; reason?: string } {
    const hasSales = sales.some((s) => s.customerId === customerId);
    if (hasSales) {
      return {
        canDelete: false,
        reason: 'Customer has historical sales records and cannot be permanently deleted. Please deactivate instead to preserve audit history.',
      };
    }
    return { canDelete: true };
  }

  /**
   * Deletes or deactivates customer based on sales history.
   */
  public static deleteCustomer(
    customerId: string,
    existingCustomers: Customer[],
    sales: Sale[]
  ): {
    updatedCustomers: Customer[];
    deactivatedInsteadOfDeleted: boolean;
    message: string;
  } {
    const hasSales = sales.some((s) => s.customerId === customerId);
    if (hasSales) {
      const updatedCustomers = existingCustomers.map((c) =>
        c.id === customerId ? { ...c, active: false, updatedAt: new Date().toISOString() } : c
      );
      return {
        updatedCustomers,
        deactivatedInsteadOfDeleted: true,
        message: 'Customer has sales history and cannot be deleted. Deactivated instead.',
      };
    }

    return {
      updatedCustomers: existingCustomers.filter((c) => c.id !== customerId),
      deactivatedInsteadOfDeleted: false,
      message: 'Customer permanently deleted.',
    };
  }

  /**
   * Filters active customers suitable for new transactions.
   */
  public static getActiveCustomers(customers: Customer[]): Customer[] {
    return customers.filter((c) => c.active);
  }

  /**
   * Search customers by name, code, or phone with normalized matching.
   */
  public static searchCustomers(query: string, customers: Customer[]): Customer[] {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    const digitsOnly = q.replace(/\D/g, '');

    return customers.filter((c) => {
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchCode = c.customerCode.toLowerCase().includes(q);
      const matchPhone = c.phone
        ? c.phone.toLowerCase().includes(q) || (digitsOnly.length >= 3 && c.phone.replace(/\D/g, '').includes(digitsOnly))
        : false;
      return matchName || matchCode || matchPhone;
    });
  }

  public static calculateCustomerMetrics(
    customerOrId: Customer | string,
    sales: Sale[],
    loyaltyEntries: LoyaltyLedgerEntry[] = []
  ): CustomerMetrics {
    const customerId = typeof customerOrId === 'string' ? customerOrId : customerOrId.id;
    // Only completed sales count towards customer metrics
    const completedSales = sales
      .filter((s) => s.customerId === customerId && s.status === 'COMPLETED')
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    let totalSpent = 0;
    let itemsPurchased = 0;

    for (const sale of completedSales) {
      totalSpent += sale.total; // actual realized revenue after discount
      for (const item of sale.items) {
        itemsPurchased += item.quantity;
      }
    }

    // Points balance from ledger
    const pointsBalance = loyaltyEntries
      .filter((e) => e.customerId === customerId)
      .reduce((sum, e) => sum + e.points, 0);

    const spend = Number(totalSpent.toFixed(2));
    const lastDate = completedSales.length > 0 ? completedSales[0].dateTime : null;

    return {
      totalTransactions: completedSales.length,
      totalOrders: completedSales.length,
      totalSpent: spend,
      totalSpend: spend,
      itemsPurchased,
      lastPurchaseDate: lastDate,
      lastOrderDate: lastDate || undefined,
      completedSales,
      pointsBalance: Math.max(0, pointsBalance),
    };
  }

  /**
   * Computes comprehensive customer metrics derived purely from COMPLETED sales:
   * - Total Transactions
   * - Total Realized Spend (sum of sale.total, discounts reflected, not original subtotal)
   * - Items Purchased
   * - Last Purchase Date
   * - Loyalty Points Balance
   */
  public static getCustomerMetrics(
    customer: Customer,
    sales: Sale[],
    loyaltyEntries: LoyaltyLedgerEntry[] = []
  ): CustomerMetrics {
    return this.calculateCustomerMetrics(customer, sales, loyaltyEntries);
  }
}
