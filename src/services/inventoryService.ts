/**
 * NiagaPOS - Inventory Domain Service
 * Part 01: Foundation & Application Architecture
 * Part 02: Product & Inventory Management
 * 
 * Rules:
 * 1. Stock should not normally become negative.
 * 2. Inactive products cannot be sold.
 * 3. Inventory movements must be traceable (every mutation creates a movement log).
 * 4. Stock adjustments must require a reason.
 * 5. Current stock is derived/updated alongside movement records.
 */

import { Product, InventoryMovement, InventoryMovementType, StockStatus } from '../types';

export interface MovementInput {
  productId: string;
  type: InventoryMovementType;
  quantity: number; // positive for additions, negative for deductions
  reason: string;
  referenceId?: string;
}

export class InventoryService {
  /**
   * Helper to construct an explicit immutable inventory movement record
   */
  public static createMovement(
    productId: string,
    storeId: string,
    type: InventoryMovementType,
    quantity: number,
    previousStock: number,
    newStock: number,
    reason: string,
    referenceId?: string,
    productName?: string
  ): InventoryMovement {
    if (!reason || reason.trim().length === 0) {
      throw new Error('An inventory movement requires a valid reason for audit traceability.');
    }

    return {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      storeId,
      productId,
      productName,
      type,
      quantity,
      previousStock,
      newStock,
      referenceId,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Applies an inventory movement to a product and creates an audit record.
   * Ensures stock integrity and traceability.
   * Overloaded signature supports both MovementInput object and direct parameters.
   */
  public static applyMovement(
    product: Product,
    inputOrType: MovementInput | InventoryMovementType,
    storeIdOrQty: string | number,
    reasonArg?: string,
    refIdArg?: string,
    storeIdArg?: string
  ): { updatedProduct: Product; movement: InventoryMovement } {
    let input: MovementInput;
    let storeId: string;

    if (typeof inputOrType === 'object') {
      input = inputOrType;
      storeId = (storeIdOrQty as string) || product.storeId;
    } else {
      input = {
        productId: product.id,
        type: inputOrType,
        quantity: storeIdOrQty as number,
        reason: reasonArg || 'Stock adjustment',
        referenceId: refIdArg,
      };
      storeId = storeIdArg || product.storeId;
    }

    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error('An inventory movement requires a valid reason for audit traceability.');
    }

    if (input.quantity === 0) {
      throw new Error('Movement quantity cannot be zero.');
    }

    const previousStock = product.currentStock;
    const newStock = previousStock + input.quantity;

    if (newStock < 0) {
      throw new Error(
        `Insufficient inventory for "${product.name}". Current stock is ${previousStock}, but requested change is ${input.quantity}. Resulting stock (${newStock}) cannot be negative.`
      );
    }

    const updatedProduct: Product = {
      ...product,
      currentStock: newStock,
      updatedAt: new Date().toISOString(),
    };

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      storeId,
      productId: product.id,
      productName: product.name,
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      referenceId: input.referenceId,
      reason: input.reason.trim(),
      createdAt: new Date().toISOString(),
    };

    return { updatedProduct, movement };
  }

  /**
   * Helper to verify traceability for a product:
   * Aggregates all movements and confirms they match current stock.
   */
  public static verifyStockTraceability(
    product: Product,
    movements: InventoryMovement[]
  ): {
    calculatedStock: number;
    isConsistent: boolean;
    breakdown: {
      openingStock: number;
      stockIn: number;
      sales: number;
      adjustments: number;
      returns: number;
    };
    formula: string;
  } {
    const productMovements = movements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let openingStock = 0;
    let stockIn = 0;
    let sales = 0;
    let adjustments = 0;
    let returns = 0;

    for (const m of productMovements) {
      if (m.type === 'STOCK_IN') {
        if (
          openingStock === 0 &&
          m.previousStock === 0 &&
          (m.reason.toLowerCase().includes('opening') ||
            m.reason.toLowerCase().includes('initial'))
        ) {
          openingStock += m.quantity;
        } else {
          stockIn += m.quantity;
        }
      } else if (m.type === 'SALE') {
        sales += Math.abs(m.quantity);
      } else if (m.type === 'ADJUSTMENT') {
        adjustments += m.quantity;
      } else if (m.type === 'RETURN') {
        returns += m.quantity;
      }
    }

    const calculatedStock = openingStock + stockIn - sales + adjustments + returns;
    const isConsistent = calculatedStock === product.currentStock;

    return {
      calculatedStock,
      isConsistent,
      breakdown: {
        openingStock,
        stockIn,
        sales,
        adjustments,
        returns,
      },
      formula: `${openingStock} (Opening) + ${stockIn} (Stock In) - ${sales} (Sold) + (${adjustments}) (Adj) + ${returns} (Returns) = ${calculatedStock} (Current)`,
    };
  }

  /**
   * Deterministic Stock Status Rule (Section 11 & Test N):
   * - Stock <= 0: OUT_OF_STOCK
   * - 0 < Stock < minimumStock: LOW_STOCK (e.g. Current 4 < Min 5)
   * - Stock >= minimumStock: NORMAL (e.g. Current 5 == Min 5 is Normal)
   */
  public static isOutOfStock(product: Product): boolean {
    return product.currentStock <= 0;
  }

  public static isLowStock(product: Product): boolean {
    return product.currentStock > 0 && product.currentStock < product.minimumStock;
  }

  public static getStockStatus(product: Product): StockStatus {
    if (product.currentStock <= 0) return 'OUT_OF_STOCK';
    if (product.currentStock < product.minimumStock) return 'LOW_STOCK';
    return 'NORMAL';
  }
}
