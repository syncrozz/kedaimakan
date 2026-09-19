/**
 * NiagaPOS - Sales & Gross Profit Domain Service
 * Part 01: Foundation & Application Architecture
 * 
 * Rules:
 * 1. Inactive products cannot be sold.
 * 2. Cost and selling prices MUST be snapshotted at transaction time.
 * 3. Never rely on current product price to calculate historical sales or profit.
 * 4. Gross Profit = Sales Revenue - Cost of Goods Sold (COGS).
 * 5. Every sale item generates an inventory deduction (SALE movement).
 */

import { Product, Sale, SaleItem, InventoryMovement, CartItem, PaymentMethod } from '../types';
import { InventoryService } from './inventoryService';
import { STORE_OWNER_ID, STORE_OWNER_NAME } from './staffService';

export interface SaleProcessingResult {
  sale: Sale;
  updatedProducts: Product[];
  newMovements: InventoryMovement[];
}

export interface ProcessSaleOptions {
  discount?: number;
  cashReceived?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  customerId?: string | null;
  customerIdSnapshot?: string | null;
  customerNameSnapshot?: string | null;
  cashierIdSnapshot?: string;
  cashierNameSnapshot?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
}

export class SalesService {
  /**
   * Generates a unique, human-readable transaction number formatted for retail operations.
   * Format: SALE-000001, SALE-000002, etc. (Section 16)
   * Guaranteed unique within the store; avoids collisions and reuses.
   */
  public static generateTransactionNumber(existingSalesOrCount: Sale[] | number): string {
    let nextSeq = 1;

    if (Array.isArray(existingSalesOrCount)) {
      for (const sale of existingSalesOrCount) {
        if (!sale || !sale.transactionNumber) continue;
        const match = sale.transactionNumber.match(/(?:SALE|TRX)[-_]?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num >= nextSeq) {
            nextSeq = num + 1;
          }
        }
      }
      if (nextSeq <= existingSalesOrCount.length) {
        nextSeq = existingSalesOrCount.length + 1;
      }
    } else {
      nextSeq = Math.max(1, existingSalesOrCount + 1);
    }

    return `SALE-${String(nextSeq).padStart(6, '0')}`;
  }

  /**
   * Validates cart and executes atomic sale transaction.
   * Captures price snapshots, allocates discounts deterministically,
   * calculates COGS and Gross Profit on actual revenue, and creates audit movements.
   */
  public static processSale(
    cartItems: CartItem[],
    productsMap: Map<string, Product>,
    storeId: string,
    existingSalesOrCount: Sale[] | number,
    optionsOrDiscount: number | ProcessSaleOptions = 0,
    legacyNotes?: string
  ): SaleProcessingResult {
    // Normalize options
    let discount = 0;
    let cashReceived: number | undefined = undefined;
    let paymentMethod: PaymentMethod = 'CASH';
    let notes: string | undefined = legacyNotes;
    const options = typeof optionsOrDiscount === 'object' && optionsOrDiscount !== null ? optionsOrDiscount : undefined;

    if (typeof optionsOrDiscount === 'number') {
      discount = optionsOrDiscount;
    } else if (typeof optionsOrDiscount === 'object' && optionsOrDiscount !== null) {
      discount = optionsOrDiscount.discount ?? 0;
      cashReceived = optionsOrDiscount.cashReceived;
      paymentMethod = optionsOrDiscount.paymentMethod ?? 'CASH';
      notes = optionsOrDiscount.notes ?? legacyNotes;
    }

    // 1. Validation: Cart cannot be empty
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cannot process an empty cart.');
    }

    // 2. Pre-validate all cart items
    for (const item of cartItems) {
      if (!item.product || !item.product.id) {
        throw new Error('Invalid product in cart.');
      }
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        throw new Error(`Invalid quantity for "${item.product.name}". Quantity must be a positive integer.`);
      }

      const liveProduct = productsMap.get(item.product.id);
      if (!liveProduct) {
        throw new Error(`Product "${item.product.name}" not found in store catalog.`);
      }

      // Rule: Inactive products cannot be sold
      if (!liveProduct.active) {
        throw new Error(`Product "${liveProduct.name}" is marked as inactive and cannot be sold.`);
      }

      // Rule: Out of stock
      if (liveProduct.currentStock <= 0) {
        throw new Error(`Product "${liveProduct.name}" is out of stock and cannot be sold.`);
      }

      // Rule: Stock sufficiency
      if (liveProduct.currentStock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${liveProduct.name}". Required: ${item.quantity}, Available: ${liveProduct.currentStock}.`
        );
      }
    }

    // 3. Calculate initial subtotal and cost
    let subtotal = 0;
    let totalCost = 0;
    const itemCalculations: {
      liveProduct: Product;
      quantity: number;
      unitCost: number;
      unitSellingPrice: number;
      lineTotal: number;
      lineCost: number;
    }[] = [];

    for (const item of cartItems) {
      const liveProduct = productsMap.get(item.product.id)!;
      const unitCost = liveProduct.costPrice;
      const unitSellingPrice = liveProduct.sellingPrice;
      const lineTotal = Number((item.quantity * unitSellingPrice).toFixed(2));
      const lineCost = Number((item.quantity * unitCost).toFixed(2));

      subtotal += lineTotal;
      totalCost += lineCost;

      itemCalculations.push({
        liveProduct,
        quantity: item.quantity,
        unitCost,
        unitSellingPrice,
        lineTotal,
        lineCost,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalCost = Number(totalCost.toFixed(2));

    // 4. Validate Discount & Clamp to Subtotal (Section 10)
    if (isNaN(discount) || discount < 0) {
      throw new Error('Discount cannot be negative.');
    }

    // Boundary protection: Clamped to subtotal so total is never negative
    const effectiveDiscount = Number(Math.min(discount, subtotal).toFixed(2));
    const total = Number(Math.max(0, subtotal - effectiveDiscount).toFixed(2));

    // 5. Cash Payment & Change Handling (Section 12, 13)
    if (cashReceived !== undefined) {
      if (isNaN(cashReceived) || cashReceived < 0) {
        throw new Error('Cash received must be a valid non-negative amount.');
      }
      if (cashReceived < total) {
        const remaining = Number((total - cashReceived).toFixed(2));
        throw new Error(`Insufficient payment. Remaining: RM${remaining.toFixed(2)}`);
      }
    } else {
      // Default to exact cash if not specified
      cashReceived = total;
    }

    const change = Number((cashReceived - total).toFixed(2));

    // 6. Deterministic Cart Discount Allocation (Section 11, 17)
    // Allocates discount proportionally across items while preserving exact cent matching.
    const saleItems: SaleItem[] = [];
    const updatedProducts: Product[] = [];
    const newMovements: InventoryMovement[] = [];

    const transactionNumber = this.generateTransactionNumber(existingSalesOrCount);
    const saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const saleDateTime = new Date().toISOString();

    let discountAllocatedSoFar = 0;
    const numItems = itemCalculations.length;

    for (let i = 0; i < numItems; i++) {
      const calc = itemCalculations[i];
      let itemAllocatedDiscount = 0;

      if (effectiveDiscount > 0 && subtotal > 0) {
        if (i === numItems - 1) {
          // Last item gets remainder to guarantee sum(itemAllocatedDiscount) === effectiveDiscount
          itemAllocatedDiscount = Number((effectiveDiscount - discountAllocatedSoFar).toFixed(2));
        } else {
          itemAllocatedDiscount = Number(
            ((calc.lineTotal / subtotal) * effectiveDiscount).toFixed(2)
          );
          discountAllocatedSoFar += itemAllocatedDiscount;
        }
      }

      // Actual revenue realized for this item after discount
      const actualRevenue = Number((calc.lineTotal - itemAllocatedDiscount).toFixed(2));
      // Gross Profit for this item = actual revenue - COGS (can be negative if sold below cost or deeply discounted)
      const itemGrossProfit = Number((actualRevenue - calc.lineCost).toFixed(2));

      const saleItem: SaleItem = {
        id: `si-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        saleId,
        productId: calc.liveProduct.id,
        productNameSnapshot: calc.liveProduct.name,
        sku: calc.liveProduct.sku,
        quantity: calc.quantity,
        unitCostSnapshot: calc.unitCost,
        unitSellingPriceSnapshot: calc.unitSellingPrice,
        lineTotal: calc.lineTotal,
        allocatedDiscount: itemAllocatedDiscount,
        actualRevenue,
        lineCost: calc.lineCost,
        grossProfit: itemGrossProfit,
      };
      saleItems.push(saleItem);

      // Apply inventory deduction movement (SALE)
      const { updatedProduct, movement } = InventoryService.applyMovement(
        calc.liveProduct,
        {
          productId: calc.liveProduct.id,
          type: 'SALE',
          quantity: -calc.quantity, // deduction
          reason: `POS Sale ${transactionNumber}`,
          referenceId: transactionNumber,
        },
        storeId
      );

      updatedProducts.push(updatedProduct);
      newMovements.push(movement);
    }

    // Overall sale Gross Profit = Total Revenue (after discount) - Total COGS
    const saleGrossProfit = Number((total - totalCost).toFixed(2));

    const sale: Sale = {
      id: saleId,
      storeId,
      transactionNumber,
      dateTime: saleDateTime,
      items: saleItems,
      subtotal,
      discount: effectiveDiscount,
      tax: 0,
      total,
      paymentMethod,
      cashReceived,
      change,
      totalCost,
      grossProfit: saleGrossProfit,
      status: 'COMPLETED',
      customerId: options?.customerId !== undefined ? options.customerId : null,
      customerIdSnapshot: options?.customerIdSnapshot || options?.customerId || undefined,
      customerNameSnapshot: options?.customerNameSnapshot || undefined,
      cashierIdSnapshot: options?.cashierIdSnapshot !== undefined ? options.cashierIdSnapshot : STORE_OWNER_ID,
      cashierNameSnapshot: options?.cashierNameSnapshot !== undefined ? options.cashierNameSnapshot : STORE_OWNER_NAME,
      pointsEarned: options?.pointsEarned || undefined,
      pointsRedeemed: options?.pointsRedeemed || undefined,
      notes,
      createdAt: saleDateTime,
    };

    return {
      sale,
      updatedProducts,
      newMovements,
    };
  }

  /**
   * Helper to compute total gross profit and margin across a collection of sales.
   */
  public static calculateSummary(sales: Sale[]): {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    grossMarginPercentage: number;
    totalTransactions: number;
    totalItemsSold: number;
  } {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalItemsSold = 0;

    for (const sale of sales) {
      if (sale.status === 'COMPLETED') {
        totalRevenue += sale.total;
        totalCOGS += sale.totalCost;
        for (const item of sale.items) {
          totalItemsSold += item.quantity;
        }
      }
    }

    totalRevenue = Number(totalRevenue.toFixed(2));
    totalCOGS = Number(totalCOGS.toFixed(2));
    const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2));
    const grossMarginPercentage =
      totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMarginPercentage,
      totalTransactions: sales.filter((s) => s.status === 'COMPLETED').length,
      totalItemsSold,
    };
  }

  /**
   * Calculates subtotal, total cost, and gross profit for a collection of line items.
   */
  public static calculateSaleEconomics(
    items: {
      quantity: number;
      unitCostSnapshot: number;
      unitSellingPriceSnapshot: number;
    }[],
    discount: number = 0
  ): {
    subtotal: number;
    totalCost: number;
    grossProfit: number;
    total: number;
  } {
    let subtotal = 0;
    let totalCost = 0;

    for (const item of items) {
      subtotal += Number((item.quantity * item.unitSellingPriceSnapshot).toFixed(2));
      totalCost += Number((item.quantity * item.unitCostSnapshot).toFixed(2));
    }

    subtotal = Number(subtotal.toFixed(2));
    totalCost = Number(totalCost.toFixed(2));
    const effectiveDiscount = Number(Math.min(discount, subtotal).toFixed(2));
    const total = Number(Math.max(0, subtotal - effectiveDiscount).toFixed(2));
    const grossProfit = Number((total - totalCost).toFixed(2));

    return {
      subtotal,
      totalCost,
      grossProfit,
      total,
    };
  }

  /**
   * Filters product catalog for POS point-of-sale display.
   * Core Rule: Only active products (product.active === true) are eligible for POS display and search.
   * Inactive products are completely excluded regardless of stock status.
   */
  public static filterPosCatalog(
    products: Product[],
    selectedCategory: string = 'ALL',
    searchQuery: string = ''
  ): Product[] {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      // 1. Mandatory Core Rule: Active products only (hide inactive from POS completely)
      if (!p.active) return false;

      // 2. Category filter
      const matchesCategory =
        selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchesCategory) return false;

      // 3. Search filter: product name or SKU
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSku = p.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }

      return true;
    });
  }

  /**
   * Retrieves unique categories from active products only for POS category filtering.
   */
  public static getPosCategories(products: Product[]): string[] {
    const activeProducts = products.filter((p) => p.active);
    const cats = Array.from(new Set(activeProducts.map((p) => p.category)));
    return ['ALL', ...cats];
  }
}
