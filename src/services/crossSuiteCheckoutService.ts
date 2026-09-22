/**
 * SYNCROZZ KEDAI MAKAN & NIAGAPOS
 * Cross-Suite Retail Checkout Service (SES v4.5)
 * 
 * Standard: Simple by Default. Powerful When Needed.
 * 
 * Responsibilities:
 * 1. Coordinates mixed Restaurant + NiagaPOS Retail checkout.
 * 2. Strict Authoritative Source Rule:
 *    - Restaurant menu / dining data belongs to KEDAI MAKAN.
 *    - Retail product definition, price, and stock belongs to NIAGAPOS.
 * 3. Authoritative Inventory Deduction:
 *    - Reuses InventoryService.applyMovement() to prevent negative stock.
 * 4. Checkout Idempotency:
 *    - Enforces unique checkoutOperationId to prevent duplicate movements, sales, or payments.
 * 5. State Machine:
 *    - INITIATED -> VALIDATING -> PAYMENT_PROCESSING -> RETAIL_INVENTORY_COMMITTED -> COMPLETED.
 * 6. Configurable Tax & Service Charge:
 *    - Fully respects RestaurantTaxConfig without hardcoded tax rates.
 */

import { Product, InventoryMovement } from '../types';
import {
  RestaurantOrderItem,
  RestaurantOrderType,
  RestaurantTaxConfig,
  CrossSuiteCheckoutState,
  UnifiedCompletedOrderRecord,
} from '../types/restaurant';
import { InventoryService } from './inventoryService';

export interface CrossSuiteCheckoutRequest {
  checkoutOperationId: string;
  orderId: string;
  orderType: RestaurantOrderType;
  tableNumber?: string;
  guestCount?: number;
  customerName?: string;
  cashierName?: string;
  items: RestaurantOrderItem[];
  taxConfig: RestaurantTaxConfig;
  cashTendered: number;
  workspaceId: string;
  availableProducts: Product[];
}

export interface CrossSuiteCheckoutResult {
  success: boolean;
  state: CrossSuiteCheckoutState;
  checkoutOperationId: string;
  completedOrder: UnifiedCompletedOrderRecord;
  updatedProducts: Product[];
  retailMovements: InventoryMovement[];
  message: string;
}

// In-memory idempotency cache for completed operations (with tenant isolation)
const completedOperationsCache = new Map<string, CrossSuiteCheckoutResult>();
// Concurrency mutex set for active in-flight checkout operations
const inFlightOperations = new Set<string>();

export class CrossSuiteCheckoutService {
  /**
   * Clears the in-memory idempotency cache (useful for testing or reset)
   */
  public static clearCache(): void {
    completedOperationsCache.clear();
    inFlightOperations.clear();
  }

  /**
   * Generates a deterministic or random unique checkoutOperationId
   */
  public static generateOperationId(prefix: string = 'chk'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Calculates financial breakdown using the authoritative RestaurantTaxConfig
   */
  public static calculateTotals(
    items: RestaurantOrderItem[],
    taxConfig: RestaurantTaxConfig,
    orderType: RestaurantOrderType
  ): {
    grossSubtotal: number;
    totalDiscounts: number;
    serviceChargeAmount: number;
    taxAmount: number;
    grandTotal: number;
  } {
    const grossSubtotal = Math.round(
      items.reduce((sum, it) => sum + (it.unitTotal * it.quantity), 0) * 100
    ) / 100;

    const totalDiscounts = Math.round(
      items.reduce((sum, it) => sum + (it.discountAmount || 0), 0) * 100
    ) / 100;

    const netFoodSubtotal = Math.max(0, grossSubtotal - totalDiscounts);

    const serviceChargeAmount =
      taxConfig.serviceChargeEnabled && orderType === 'DINE_IN'
        ? Math.round((netFoodSubtotal * (taxConfig.serviceChargePercent / 100)) * 100) / 100
        : 0;

    const taxableBase = netFoodSubtotal + serviceChargeAmount;

    let taxAmount = 0;
    let grandTotal = 0;

    if (taxConfig.taxEnabled && taxConfig.taxRatePercent > 0) {
      if (taxConfig.isTaxInclusive) {
        // Cukai Termasuk: Cukai diekstrak daripada jumlah asas
        taxAmount = Math.round((taxableBase - taxableBase / (1 + taxConfig.taxRatePercent / 100)) * 100) / 100;
        grandTotal = taxableBase;
      } else {
        // Cukai Ditambah (Eksklusif): Cukai ditambah di atas jumlah bil
        taxAmount = Math.round((taxableBase * (taxConfig.taxRatePercent / 100)) * 100) / 100;
        grandTotal = Math.round((taxableBase + taxAmount) * 100) / 100;
      }
    } else {
      grandTotal = taxableBase;
    }

    return {
      grossSubtotal,
      totalDiscounts,
      serviceChargeAmount,
      taxAmount,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }

  /**
   * Executes a cross-suite checkout atomically and idempotently.
   */
  public static processCheckout(request: CrossSuiteCheckoutRequest): CrossSuiteCheckoutResult {
    const {
      checkoutOperationId,
      orderId,
      orderType,
      tableNumber,
      guestCount,
      customerName,
      cashierName = 'Cashier',
      items,
      taxConfig,
      cashTendered,
      workspaceId,
      availableProducts,
    } = request;

    // 1. Check Idempotency (Directive 3)
    const idempotencyKey = `${workspaceId}::${checkoutOperationId}`;
    if (completedOperationsCache.has(idempotencyKey)) {
      return completedOperationsCache.get(idempotencyKey)!;
    }

    // Check Concurrency Conflict
    if (inFlightOperations.has(idempotencyKey)) {
      throw new Error(
        `Operasi checkout "${checkoutOperationId}" sedang diproses. Sila tunggu seketika.`
      );
    }

    inFlightOperations.add(idempotencyKey);
    let currentState: CrossSuiteCheckoutState = 'INITIATED';

    try {
      // 2. State: VALIDATING
      currentState = 'VALIDATING';

      if (!items || items.length === 0) {
        throw new Error('Pesanan mestilah mengandungi sekurang-kurangnya satu item.');
      }

      // Separate items by suite
      const restaurantItems = items.filter((it) => it.itemType !== 'RETAIL');
      const retailItems = items.filter((it) => it.itemType === 'RETAIL');

      // Validate all retail items against authoritative NiagaPOS catalog
      const retailProductMap = new Map<string, Product>();
      availableProducts.forEach((p) => retailProductMap.set(p.id, p));

      for (const retailItem of retailItems) {
        const prodId = retailItem.retailProductId || retailItem.menuItemId;
        if (!prodId) {
          throw new Error(`Item runcit "${retailItem.nameSnapshot}" tidak mempunyai ID produk yang sah.`);
        }

        const liveProduct = retailProductMap.get(prodId);
        if (!liveProduct) {
          throw new Error(`Produk runcit "${retailItem.nameSnapshot}" tidak dijumpai dalam inventori NiagaPOS.`);
        }

        // Product active validation (Directive 8.12)
        if (liveProduct.active === false) {
          throw new Error(`Produk runcit "${liveProduct.name}" tidak aktif dan tidak boleh dijual.`);
        }

        // Stock sufficiency validation (Directive 8.11)
        if (liveProduct.currentStock < retailItem.quantity) {
          throw new Error(
            `Stok produk runcit "${liveProduct.name}" tidak mencukupi (Baki: ${liveProduct.currentStock}, Diminta: ${retailItem.quantity}).`
          );
        }
      }

      // 3. State: PAYMENT_PROCESSING
      currentState = 'PAYMENT_PROCESSING';

      const totals = this.calculateTotals(items, taxConfig, orderType);

      if (cashTendered < totals.grandTotal) {
        throw new Error(
          `Tunai diterima (RM ${cashTendered.toFixed(2)}) kurang daripada jumlah bil (RM ${totals.grandTotal.toFixed(2)}).`
        );
      }

      const changeDue = Math.round((cashTendered - totals.grandTotal) * 100) / 100;

      // 4. State: RETAIL_INVENTORY_COMMITTED
      // Authoritative deduction using InventoryService.applyMovement() (Directive 2)
      currentState = 'RETAIL_INVENTORY_COMMITTED';

      const updatedProducts: Product[] = [];
      const retailMovements: InventoryMovement[] = [];

      for (const retailItem of retailItems) {
        const prodId = retailItem.retailProductId || retailItem.menuItemId!;
        const liveProduct = retailProductMap.get(prodId)!;

        // Apply movement authoritatively (throws if resulting stock would be negative)
        const { updatedProduct, movement } = InventoryService.applyMovement(
          liveProduct,
          {
            productId: liveProduct.id,
            type: 'SALE',
            quantity: -retailItem.quantity,
            reason: `Cross-suite Retail Sale (Order #${orderId})`,
            referenceId: checkoutOperationId,
          },
          workspaceId
        );

        updatedProducts.push(updatedProduct);
        retailMovements.push(movement);

        // Update map for multi-item deduplication within the same order
        retailProductMap.set(prodId, updatedProduct);
      }

      // 5. State: COMPLETED
      currentState = 'COMPLETED';

      const completedOrder: UnifiedCompletedOrderRecord = {
        orderId,
        checkoutOperationId,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        guestCount: orderType === 'DINE_IN' ? guestCount : undefined,
        customerName: customerName || (orderType === 'DINE_IN' ? `Meja ${tableNumber || '-'}` : 'Pelanggan Walk-in'),
        items,
        restaurantItems,
        retailItems,
        grossSubtotal: totals.grossSubtotal,
        totalDiscounts: totals.totalDiscounts,
        serviceChargeAmount: totals.serviceChargeAmount,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        cashTendered,
        changeDue,
        timestamp: new Date().toISOString(),
        cashierName,
        status: 'COMPLETED',
      };

      const result: CrossSuiteCheckoutResult = {
        success: true,
        state: 'COMPLETED',
        checkoutOperationId,
        completedOrder,
        updatedProducts,
        retailMovements,
        message: 'Pesanan campuran Restoran + Runcit berjaya diselesaikan.',
      };

      // Store in idempotency cache
      completedOperationsCache.set(idempotencyKey, result);

      return result;
    } catch (err: any) {
      // If error occurred after committing partial inventory, state is RECOVERY_REQUIRED
      if (currentState === 'RETAIL_INVENTORY_COMMITTED') {
        currentState = 'RECOVERY_REQUIRED';
      } else {
        currentState = 'FAILED';
      }
      throw err;
    } finally {
      inFlightOperations.delete(idempotencyKey);
    }
  }
}
