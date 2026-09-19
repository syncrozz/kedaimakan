/**
 * NiagaPOS - Purchasing Service
 * Part 05: Purchasing + Supplier Management
 *
 * Core Retail Cycle:
 * SUPPLIER → PURCHASE → PURCHASE ITEMS → STOCK RECEIVED → INVENTORY (STOCK_IN) → POS → SALES → COGS → GROSS PROFIT
 *
 * Architectural Principles:
 * 1. Completing a purchase atomically updates Product.currentStock, updates Product.costPrice to latest received unit cost,
 *    and logs traceable STOCK_IN InventoryMovements referencing the purchase ID.
 * 2. Duplicate completion is strictly prevented.
 * 3. Historical supplier and product snapshots are preserved immutably.
 * 4. Completed purchases cannot be cancelled or deleted destructively.
 */

import {
  Purchase,
  PurchaseItem,
  PurchaseStatus,
  Supplier,
  Product,
  InventoryMovement,
} from '../types';

export interface CreatePurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
  discount?: number;
}

export interface CreatePurchaseInput {
  supplierId: string;
  purchaseDate?: string;
  items: CreatePurchaseItemInput[];
  discount?: number;
  notes?: string;
}

export interface CompletePurchaseResult {
  completedPurchase: Purchase;
  updatedProducts: Product[];
  newMovements: InventoryMovement[];
}

export interface PurchasingSummary {
  totalPurchases: number;
  completedPurchases: number;
  draftPurchases: number;
  cancelledPurchases: number;
  totalPurchaseValue: number; // Sum of completed purchases totals
  totalUnitsPurchased: number; // Sum of completed purchases item quantities
  uniqueSuppliersCount: number;
  activeSuppliers: number;
}

export class PurchasingService {
  /**
   * Generates a sequential human-readable purchase number: PUR-000001, PUR-000002, etc.
   */
  static generatePurchaseNumber(existingPurchases: Purchase[]): string {
    let maxNum = 0;
    const regex = /^PUR-(\d+)$/i;

    existingPurchases.forEach((p) => {
      const match = p.purchaseNumber.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `PUR-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Calculates item line total: (quantity * unitCost) - discount
   */
  static calculateLineTotal(quantity: number, unitCost: number, discount = 0): number {
    const rawTotal = quantity * unitCost - (discount || 0);
    return Math.max(0, Math.round(rawTotal * 100) / 100);
  }

  /**
   * Calculates subtotal and final total for purchase items.
   */
  static calculatePurchaseTotals(
    items: { quantity: number; unitCost: number; discount?: number }[],
    purchaseDiscount = 0
  ): { subtotal: number; discount: number; total: number } {
    const subtotal = items.reduce((sum, item) => {
      return sum + item.quantity * item.unitCost;
    }, 0);

    const safeDiscount = Math.max(0, Number(purchaseDiscount) || 0);
    const total = Math.max(0, subtotal - safeDiscount);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(safeDiscount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Validates inputs for creating a new purchase.
   */
  static validatePurchaseForCreation(
    input: CreatePurchaseInput,
    suppliersMap: Map<string, Supplier>,
    productsMap: Map<string, Product>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Supplier validation
    if (!input.supplierId || !input.supplierId.trim()) {
      errors.push('Supplier is required.');
    } else {
      const supplier = suppliersMap.get(input.supplierId);
      if (!supplier) {
        errors.push('Selected supplier does not exist.');
      } else if (!supplier.active) {
        errors.push(`Supplier "${supplier.supplierName}" is inactive and cannot be used for new purchases.`);
      }
    }

    // Items validation
    if (!input.items || input.items.length === 0) {
      errors.push('Purchase must contain at least one item.');
    } else {
      input.items.forEach((item, index) => {
        const itemNum = index + 1;
        const product = productsMap.get(item.productId);

        if (!product) {
          errors.push(`Item #${itemNum}: Product not found.`);
        } else if (!product.active) {
          errors.push(`Item #${itemNum}: Product "${product.name}" is inactive.`);
        }

        const qty = Number(item.quantity);
        if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
          errors.push(`Item #${itemNum}: Quantity must be a positive whole number greater than 0.`);
        }

        const cost = Number(item.unitCost);
        if (isNaN(cost) || cost < 0) {
          errors.push(`Item #${itemNum}: Unit cost cannot be negative.`);
        }
      });
    }

    // Purchase-level discount validation
    if (input.discount !== undefined) {
      const discount = Number(input.discount);
      if (isNaN(discount) || discount < 0) {
        errors.push('Purchase discount cannot be negative.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Creates a new purchase document in DRAFT status.
   */
  static createDraftPurchase(
    input: CreatePurchaseInput,
    suppliersMap: Map<string, Supplier>,
    productsMap: Map<string, Product>,
    existingPurchases: Purchase[]
  ): Purchase {
    const validation = PurchasingService.validatePurchaseForCreation(
      input,
      suppliersMap,
      productsMap
    );

    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const supplier = suppliersMap.get(input.supplierId)!;
    const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const purchaseNumber = PurchasingService.generatePurchaseNumber(existingPurchases);
    const now = new Date().toISOString();

    const purchaseItems: PurchaseItem[] = input.items.map((item, idx) => {
      const product = productsMap.get(item.productId)!;
      const lineTotal = PurchasingService.calculateLineTotal(
        item.quantity,
        item.unitCost,
        item.discount
      );

      return {
        id: `puri-${purchaseId}-${idx + 1}`,
        purchaseId,
        productId: item.productId,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: item.quantity,
        unitCost: item.unitCost,
        discount: item.discount || 0,
        lineTotal,
      };
    });

    const { subtotal, discount, total } = PurchasingService.calculatePurchaseTotals(
      purchaseItems,
      input.discount || 0
    );

    return {
      id: purchaseId,
      purchaseNumber,
      supplierId: supplier.id,
      supplierCodeSnapshot: supplier.supplierCode,
      supplierNameSnapshot: supplier.supplierName,
      purchaseDate: input.purchaseDate || now,
      status: 'DRAFT',
      items: purchaseItems,
      subtotal,
      discount,
      total,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Completes a purchase atomically:
   * 1. Validates purchase is DRAFT (duplicate completion protection)
   * 2. Validates supplier is active
   * 3. Validates all products are active and valid
   * 4. Updates Product.currentStock += received quantity
   * 5. Updates Product.costPrice = latest received unit cost (Section 13)
   * 6. Generates STOCK_IN InventoryMovements referencing purchase ID
   * 7. Marks purchase as COMPLETED
   *
   * If any step fails, an error is thrown and no mutation occurs.
   */
  static completePurchase(
    purchase: Purchase,
    suppliersMap: Map<string, Supplier>,
    productsMap: Map<string, Product>,
    storeId: string = 'store-niagapos-v2-001'
  ): CompletePurchaseResult {
    // 1. Duplicate completion protection
    if (purchase.status === 'COMPLETED') {
      throw new Error(`Purchase ${purchase.purchaseNumber} is already completed and stock has been received.`);
    }

    if (purchase.status === 'CANCELLED') {
      throw new Error(`Purchase ${purchase.purchaseNumber} has been cancelled and cannot be received.`);
    }

    // 2. Validate supplier
    const supplier = suppliersMap.get(purchase.supplierId);
    if (!supplier) {
      throw new Error('Associated supplier not found.');
    }
    if (!supplier.active) {
      throw new Error(`Supplier "${supplier.supplierName}" is inactive. Cannot receive purchase.`);
    }

    // 3. Validate items and products
    if (!purchase.items || purchase.items.length === 0) {
      throw new Error('Cannot complete a purchase with no items.');
    }

    // Pre-validate all products before executing any mutation (Atomicity guarantee)
    for (const item of purchase.items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        throw new Error(`Product with ID "${item.productId}" no longer exists in catalog.`);
      }
      if (!product.active) {
        throw new Error(`Product "${product.name}" (${product.sku}) is inactive. Cannot receive stock for inactive product.`);
      }
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        throw new Error(`Invalid quantity ${item.quantity} for product "${product.name}".`);
      }
      if (item.unitCost < 0 || isNaN(item.unitCost)) {
        throw new Error(`Invalid unit cost ${item.unitCost} for product "${product.name}".`);
      }
    }

    const now = new Date().toISOString();
    const updatedProducts: Product[] = [];
    const newMovements: InventoryMovement[] = [];

    // Clone working products map to avoid partial mutations if any error occurs
    const workingProductsMap = new Map<string, Product>(
      Array.from(productsMap.entries()).map(([k, v]) => [k, { ...v }])
    );

    for (const item of purchase.items) {
      const product = workingProductsMap.get(item.productId)!;
      const previousStock = product.currentStock;
      const newStock = previousStock + item.quantity;

      // Update product current stock and update costPrice to latest received unit cost
      const updatedProduct: Product = {
        ...product,
        currentStock: newStock,
        costPrice: item.unitCost, // Update latest purchase cost as per Part 05 Section 13
        updatedAt: now,
      };

      workingProductsMap.set(item.productId, updatedProduct);
      updatedProducts.push(updatedProduct);

      // Create STOCK_IN movement referencing the purchase
      const movement: InventoryMovement = {
        id: `mov-pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId,
        productId: item.productId,
        productName: product.name,
        type: 'STOCK_IN',
        quantity: item.quantity,
        previousStock,
        newStock,
        referenceId: purchase.id,
        reason: `Purchase ${purchase.purchaseNumber} received`,
        createdAt: now,
      };

      newMovements.push(movement);
    }

    const completedPurchase: Purchase = {
      ...purchase,
      status: 'COMPLETED',
      updatedAt: now,
    };

    return {
      completedPurchase,
      updatedProducts,
      newMovements,
    };
  }

  /**
   * Cancels a draft purchase.
   * Completed purchases cannot be cancelled to avoid silent inventory corruption.
   */
  static cancelPurchase(purchase: Purchase): Purchase {
    if (purchase.status === 'COMPLETED') {
      throw new Error(
        'Cannot cancel a completed purchase. Completed purchases cannot be cancelled. Record manual inventory adjustments or returns instead.'
      );
    }

    if (purchase.status === 'CANCELLED') {
      return purchase;
    }

    return {
      ...purchase,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates overall purchasing metrics from a list of purchases.
   */
  static calculatePurchasingSummary(
    purchases: Purchase[],
    activeSuppliersCount = 0
  ): PurchasingSummary {
    let completedCount = 0;
    let draftCount = 0;
    let cancelledCount = 0;
    let totalValue = 0;
    let totalUnits = 0;
    const supplierIds = new Set<string>();

    purchases.forEach((p) => {
      if (p.status === 'COMPLETED') {
        completedCount++;
        totalValue += p.total;
        supplierIds.add(p.supplierId);
        p.items.forEach((item) => {
          totalUnits += item.quantity;
        });
      } else if (p.status === 'DRAFT') {
        draftCount++;
      } else if (p.status === 'CANCELLED') {
        cancelledCount++;
      }
    });

    return {
      totalPurchases: purchases.length,
      completedPurchases: completedCount,
      draftPurchases: draftCount,
      cancelledPurchases: cancelledCount,
      totalPurchaseValue: Math.round(totalValue * 100) / 100,
      totalUnitsPurchased: totalUnits,
      uniqueSuppliersCount: activeSuppliersCount || supplierIds.size,
      activeSuppliers: activeSuppliersCount || supplierIds.size,
    };
  }

  /**
   * Retrieves purchasing breakdown by supplier for completed purchases.
   */
  static getSupplierPurchasingBreakdown(
    purchases: Purchase[],
    suppliers: Supplier[]
  ): {
    supplierId: string;
    supplierName: string;
    supplierCode: string;
    purchasesCount: number;
    totalUnits: number;
    totalValue: number;
  }[] {
    const breakdownMap = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        supplierCode: string;
        purchasesCount: number;
        totalUnits: number;
        totalValue: number;
      }
    >();

    const completed = purchases.filter((p) => p.status === 'COMPLETED');
    completed.forEach((p) => {
      const existing = breakdownMap.get(p.supplierId) || {
        supplierId: p.supplierId,
        supplierName: p.supplierNameSnapshot,
        supplierCode: p.supplierCodeSnapshot,
        purchasesCount: 0,
        totalUnits: 0,
        totalValue: 0,
      };

      existing.purchasesCount += 1;
      existing.totalValue = Math.round((existing.totalValue + p.total) * 100) / 100;
      existing.totalUnits += p.items.reduce((sum, it) => sum + it.quantity, 0);

      breakdownMap.set(p.supplierId, existing);
    });

    return Array.from(breakdownMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }

  /**
   * Retrieves purchase history for a specific product from completed purchases.
   */
  static getProductPurchaseHistory(
    productId: string,
    purchases: Purchase[]
  ): {
    purchaseId: string;
    purchaseNumber: string;
    date: string;
    purchaseDate: string;
    supplierName: string;
    supplierNameSnapshot: string;
    supplierCode: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }[] {
    const history: {
      purchaseId: string;
      purchaseNumber: string;
      date: string;
      purchaseDate: string;
      supplierName: string;
      supplierNameSnapshot: string;
      supplierCode: string;
      quantity: number;
      unitCost: number;
      lineTotal: number;
    }[] = [];

    // Filter only completed purchases
    purchases
      .filter((p) => p.status === 'COMPLETED')
      .forEach((p) => {
        p.items
          .filter((item) => item.productId === productId)
          .forEach((item) => {
            history.push({
              purchaseId: p.id,
              purchaseNumber: p.purchaseNumber,
              date: p.purchaseDate,
              purchaseDate: p.purchaseDate,
              supplierName: p.supplierNameSnapshot,
              supplierNameSnapshot: p.supplierNameSnapshot,
              supplierCode: p.supplierCodeSnapshot,
              quantity: item.quantity,
              unitCost: item.unitCost,
              lineTotal: item.lineTotal,
            });
          });
      });

    // Sort descending by date
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Retrieves purchasing summary for a specific supplier.
   */
  static getSupplierPurchasingSummary(
    supplierId: string,
    purchases: Purchase[]
  ): {
    totalPurchases: number;
    completedPurchases: number;
    totalValue: number;
    totalUnits: number;
    lastPurchaseDate?: string;
  } {
    const supplierPurchases = purchases.filter((p) => p.supplierId === supplierId);
    const completedPurchases = supplierPurchases.filter((p) => p.status === 'COMPLETED');

    const totalValue = completedPurchases.reduce((sum, p) => sum + p.total, 0);
    const totalUnits = completedPurchases.reduce(
      (sum, p) => sum + p.items.reduce((iSum, item) => iSum + item.quantity, 0),
      0
    );

    let lastPurchaseDate: string | undefined;
    if (supplierPurchases.length > 0) {
      const sorted = [...supplierPurchases].sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      );
      lastPurchaseDate = sorted[0].purchaseDate;
    }

    return {
      totalPurchases: supplierPurchases.length,
      completedPurchases: completedPurchases.length,
      totalValue: Math.round(totalValue * 100) / 100,
      totalUnits,
      lastPurchaseDate,
    };
  }

  /**
   * Filters purchases by date range, supplier, status, or search term.
   */
  static filterPurchases(
    purchases: Purchase[],
    filters: {
      startDate?: string | Date;
      endDate?: string | Date;
      supplierId?: string;
      status?: PurchaseStatus;
      search?: string;
    }
  ): Purchase[] {
    return purchases.filter((p) => {
      // Date filter
      const purchaseDateStr = p.purchaseDate || p.createdAt;
      if (filters.startDate && purchaseDateStr) {
        const pDate = new Date(purchaseDateStr).getTime();
        const start = new Date(filters.startDate).getTime();
        if (!isNaN(pDate) && !isNaN(start) && pDate < start) return false;
      }
      if (filters.endDate && purchaseDateStr) {
        const pDate = new Date(purchaseDateStr).getTime();
        const end = new Date(filters.endDate).getTime();
        if (!isNaN(pDate) && !isNaN(end) && pDate > end) return false;
      }

      // Supplier filter
      if (filters.supplierId && p.supplierId !== filters.supplierId) {
        return false;
      }

      // Status filter
      if (filters.status && p.status !== filters.status) {
        return false;
      }

      // Search filter
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const numMatch = (p.purchaseNumber || '').toLowerCase().includes(q);
        const suppNameMatch = (p.supplierNameSnapshot || '').toLowerCase().includes(q);
        const suppCodeMatch = (p.supplierCodeSnapshot || '').toLowerCase().includes(q);
        const notesMatch = (p.notes || '').toLowerCase().includes(q);
        const itemMatch = (p.items || []).some(
          (i) =>
            (i.productNameSnapshot || '').toLowerCase().includes(q) ||
            (i.skuSnapshot || '').toLowerCase().includes(q)
        );
        if (!numMatch && !suppNameMatch && !suppCodeMatch && !itemMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
      const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
    });
  }
}
