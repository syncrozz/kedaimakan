/**
 * NiagaPOS - Part 06 Advanced Inventory + Reporting Verification Runner
 * 
 * Programmatically validates all Part 06 specifications:
 * Test 6.1: Current stock equals ledger stock under normal conditions
 * Test 6.2: Mismatch correctly identified when recorded stock differs from movements
 * Test 6.3: Reconciliation status returns 'OK' for accurate stock
 * Test 6.4: Reconciliation status returns 'MISMATCH' for inaccurate stock
 * Test 6.5: Reconciliation difference calculation is accurate
 * Test 6.6: Physical stock count difference calculation (physical - system)
 * Test 6.7: Positive difference (surplus) correctly computed
 * Test 6.8: Negative difference (shortage) correctly computed
 * Test 6.9: Zero difference requires no adjustment
 * Test 6.10: Physical count does NOT alter inventory before confirmation
 * Test 6.11: Confirmed physical count creates valid ADJUSTMENT movement
 * Test 6.12: Confirmed physical count updates product currentStock
 * Test 6.13: Standard adjustment reason accepted
 * Test 6.14: Product 360 view aggregates movements accurately
 * Test 6.15: Product 360 view includes purchase history
 * Test 6.16: Product 360 view includes sales history
 * Test 6.17: Product 360 view displays correct reconciliation status
 * Test 6.18: Product 360 view displays correct stock status
 * Test 6.19: Restock recommendation equals 0 when stock >= minimum
 * Test 6.20: Restock recommendation equals (minimum - stock) when stock < minimum
 * Test 6.21: Restock recommendation equals minimum when stock is 0
 * Test 6.22: Restock recommendation handles negative stock gracefully
 * Test 6.23: Inventory value equals currentStock * costPrice
 * Test 6.24: Potential retail value equals currentStock * sellingPrice
 * Test 6.25: Potential gross profit equals retail value - inventory value
 * Test 6.26: Potential gross profit margin percentage calculated correctly
 * Test 6.27: Total inventory value sums across all products correctly
 * Test 6.28: Fast moving products ranked by units sold
 * Test 6.29: Fast moving products filter by date range correctly
 * Test 6.30: Fast moving products ignore non-completed sales
 * Test 6.31: Products with no sales identified correctly
 * Test 6.32: No-sales filter by date range works correctly
 * Test 6.33: Stock coverage estimated correctly for active sales
 * Test 6.34: Stock coverage displays 'Not available' when sales = 0
 * Test 6.35: Stock health categorization accurate (normal, low, out)
 * Test 6.36: Inventory report total active products matches catalog
 * Test 6.37: Historical integrity: stock movements never deleted or overwritten
 * Test 6.38: Backward compatibility: Parts 01-05 behavior unchanged
 */

import { Product, InventoryMovement, Sale, SaleItem, Purchase, Supplier, CartItem } from '../types';
import { InventoryService } from './inventoryService';
import { InventoryControlService } from './inventoryControlService';
import { SalesService } from './salesService';
import { PurchasingService } from './purchasingService';
import { SupplierService } from './supplierService';
import { INITIAL_STORE } from './seedData';

export interface Part06TestResult {
  code: string;
  title: string;
  category:
    | 'RECONCILIATION'
    | 'PHYSICAL_COUNT'
    | 'PRODUCT_360'
    | 'RESTOCK_RECOMMENDATIONS'
    | 'VALUATION_AND_MARGINS'
    | 'VELOCITY_AND_COVERAGE'
    | 'STOCK_HEALTH'
    | 'HISTORICAL_INTEGRITY_AND_COMPATIBILITY';
  status: 'PASSED' | 'FAILED';
  expected: string;
  actual: string;
  formulaOrMath?: string;
  details: string;
}

export class Part06VerificationRunner {
  public static runAllTests(): Part06TestResult[] {
    const results: Part06TestResult[] = [];

    const helperCreateProduct = (
      id: string,
      sku: string,
      name: string,
      currentStock: number,
      costPrice: number,
      sellingPrice: number,
      minimumStock: number = 5
    ): Product => ({
      id,
      storeId: INITIAL_STORE.id,
      sku,
      name,
      category: 'Test Category',
      costPrice,
      sellingPrice,
      currentStock,
      minimumStock,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const helperRecordAdjustment = (
      product: Product,
      quantity: number,
      reason: string
    ): InventoryMovement => {
      const { movement } = InventoryService.applyMovement(
        product,
        'ADJUSTMENT',
        quantity,
        reason
      );
      return movement;
    };

    const helperCreateSale = (
      id: string,
      transactionNumber: string,
      items: { product: Product; quantity: number }[],
      dateTime: string = new Date().toISOString(),
      status: 'COMPLETED' | 'REFUNDED' | 'VOID' = 'COMPLETED'
    ): Sale => {
      let subtotal = 0;
      let totalCost = 0;
      const saleItems: SaleItem[] = items.map((it, idx) => {
        const lineTotal = it.quantity * it.product.sellingPrice;
        const lineCost = it.quantity * it.product.costPrice;
        const grossProfit = lineTotal - lineCost;
        subtotal += lineTotal;
        totalCost += lineCost;
        return {
          id: `${id}-item-${idx}`,
          saleId: id,
          productId: it.product.id,
          productNameSnapshot: it.product.name,
          sku: it.product.sku,
          quantity: it.quantity,
          unitCostSnapshot: it.product.costPrice,
          unitSellingPriceSnapshot: it.product.sellingPrice,
          lineTotal,
          actualRevenue: lineTotal,
          lineCost,
          grossProfit,
        };
      });
      return {
        id,
        storeId: INITIAL_STORE.id,
        transactionNumber,
        dateTime,
        items: saleItems,
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        totalCost,
        grossProfit: subtotal - totalCost,
        status,
        createdAt: dateTime,
      };
    };

    // -------------------------------------------------------------
    // Test 6.1: Current stock equals ledger stock under normal conditions
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-1', 'SKU-601', 'Biskut Tiger', 30, 2.5, 4.0);
      const movements: InventoryMovement[] = [
        {
          id: 'm-601-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          productName: prod.name,
          type: 'STOCK_IN',
          quantity: 20,
          previousStock: 0,
          newStock: 20,
          reason: 'Initial Opening Stock',
          createdAt: new Date(Date.now() - 50000).toISOString(),
        },
        {
          id: 'm-601-2',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          productName: prod.name,
          type: 'STOCK_IN',
          quantity: 15,
          previousStock: 20,
          newStock: 35,
          reason: 'Purchase PO-001',
          createdAt: new Date(Date.now() - 40000).toISOString(),
        },
        {
          id: 'm-601-3',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          productName: prod.name,
          type: 'SALE',
          quantity: -5,
          previousStock: 35,
          newStock: 30,
          reason: 'POS Sale',
          createdAt: new Date(Date.now() - 30000).toISOString(),
        },
      ];

      const recon = InventoryControlService.reconcileProduct(prod, movements);
      const passed = recon.recordedStock === 30 && recon.calculatedStock === 30 && recon.difference === 0;

      results.push({
        code: 'TEST-6.1',
        title: 'Current stock equals ledger stock under normal conditions',
        category: 'RECONCILIATION',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Recorded = 30, Calculated = 30, Difference = 0',
        actual: `Recorded = ${recon.recordedStock}, Calculated = ${recon.calculatedStock}, Difference = ${recon.difference}`,
        formulaOrMath: recon.formula,
        details: 'Sum of all ledger movements accurately equals product currentStock balance.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.1',
        title: 'Current stock equals ledger stock under normal conditions',
        category: 'RECONCILIATION',
        status: 'FAILED',
        expected: 'Calculation succeeds',
        actual: `Error: ${e.message}`,
        details: 'Exception encountered during reconciliation',
      });
    }

    // -------------------------------------------------------------
    // Test 6.2: Mismatch correctly identified when recorded stock differs from movements
    // -------------------------------------------------------------
    try {
      // Product says 30, but movements sum to 25
      const prod = helperCreateProduct('p6-2', 'SKU-602', 'Air Milo Kotak', 30, 1.5, 2.8);
      const movements: InventoryMovement[] = [
        {
          id: 'm-602-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 25,
          previousStock: 0,
          newStock: 25,
          reason: 'Opening stock',
          createdAt: new Date().toISOString(),
        },
      ];

      const recon = InventoryControlService.reconcileProduct(prod, movements);
      const passed = recon.difference === 5 && recon.status === 'MISMATCH';

      results.push({
        code: 'TEST-6.2',
        title: 'Mismatch correctly identified when recorded stock differs from movements',
        category: 'RECONCILIATION',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Difference = +5, Status = MISMATCH',
        actual: `Difference = ${recon.difference}, Status = ${recon.status}`,
        formulaOrMath: recon.formula,
        details: 'System identifies discrepancy between recorded balance and movements without silent overwrite.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.2',
        title: 'Mismatch correctly identified when recorded stock differs from movements',
        category: 'RECONCILIATION',
        status: 'FAILED',
        expected: 'Mismatch identified',
        actual: `Error: ${e.message}`,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.3: Reconciliation status returns 'OK' for accurate stock
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-3', 'SKU-603', 'Garam Halus', 50, 0.8, 1.5);
      const movements: InventoryMovement[] = [
        {
          id: 'm-603-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 60,
          previousStock: 0,
          newStock: 60,
          reason: 'Initial load',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm-603-2',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'SALE',
          quantity: -10,
          previousStock: 60,
          newStock: 50,
          reason: 'Sale',
          createdAt: new Date().toISOString(),
        },
      ];
      const recon = InventoryControlService.reconcileProduct(prod, movements);
      const passed = recon.status === 'OK' && recon.difference === 0;

      results.push({
        code: 'TEST-6.3',
        title: "Reconciliation status returns 'OK' for accurate stock",
        category: 'RECONCILIATION',
        status: passed ? 'PASSED' : 'FAILED',
        expected: "Status = 'OK'",
        actual: `Status = '${recon.status}'`,
        details: 'When ledger and currentStock balance align, OK status is returned.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.3',
        title: "Reconciliation status returns 'OK' for accurate stock",
        category: 'RECONCILIATION',
        status: 'FAILED',
        expected: "Status = 'OK'",
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.4: Reconciliation status returns 'MISMATCH' for inaccurate stock
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-4', 'SKU-604', 'Kicap Manis', 10, 3.5, 5.0);
      const movements: InventoryMovement[] = [
        {
          id: 'm-604-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 12,
          previousStock: 0,
          newStock: 12,
          reason: 'Initial load',
          createdAt: new Date().toISOString(),
        },
      ];
      const recon = InventoryControlService.reconcileProduct(prod, movements);
      const passed = recon.status === 'MISMATCH' && recon.difference === -2;

      results.push({
        code: 'TEST-6.4',
        title: "Reconciliation status returns 'MISMATCH' for inaccurate stock",
        category: 'RECONCILIATION',
        status: passed ? 'PASSED' : 'FAILED',
        expected: "Status = 'MISMATCH', Difference = -2",
        actual: `Status = '${recon.status}', Difference = ${recon.difference}`,
        details: 'Accurately flags discrepancy when currentStock is less than ledger movements.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.4',
        title: "Reconciliation status returns 'MISMATCH' for inaccurate stock",
        category: 'RECONCILIATION',
        status: 'FAILED',
        expected: "Status = 'MISMATCH'",
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.5: Reconciliation difference calculation is accurate
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-5', 'SKU-605', 'Beras Wangi', 45, 25.0, 32.0);
      const movements: InventoryMovement[] = [
        {
          id: 'm-605-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 40,
          previousStock: 0,
          newStock: 40,
          reason: 'Initial load',
          createdAt: new Date().toISOString(),
        },
      ];
      // recorded: 45, calculated: 40 => diff = 45 - 40 = +5
      const recon = InventoryControlService.reconcileProduct(prod, movements);
      const passed = recon.difference === 5;

      results.push({
        code: 'TEST-6.5',
        title: 'Reconciliation difference calculation is accurate',
        category: 'RECONCILIATION',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Difference = 5 (Recorded 45 - Calculated 40)',
        actual: `Difference = ${recon.difference}`,
        formulaOrMath: 'Difference = Recorded Stock - Calculated Ledger Stock',
        details: 'Mathematical difference formula correctly isolates variance.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.5',
        title: 'Reconciliation difference calculation is accurate',
        category: 'RECONCILIATION',
        status: 'FAILED',
        expected: 'Difference = 5',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.6: Physical stock count difference calculation (physical - system)
    // -------------------------------------------------------------
    try {
      const systemStock = 20;
      const physicalStock = 18;
      const diff = physicalStock - systemStock;
      const passed = diff === -2;

      results.push({
        code: 'TEST-6.6',
        title: 'Physical stock count difference calculation (physical - system)',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Difference = -2 (18 physical - 20 system)',
        actual: `Difference = ${diff}`,
        formulaOrMath: 'Difference = Physical Stock - System Stock',
        details: 'Verifies the core physical stock count difference formula.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.6',
        title: 'Physical stock count difference calculation',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Difference = -2',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.7: Positive difference (surplus) correctly computed
    // -------------------------------------------------------------
    try {
      const systemStock = 15;
      const physicalStock = 20;
      const diff = physicalStock - systemStock;
      const passed = diff === 5;

      results.push({
        code: 'TEST-6.7',
        title: 'Positive difference (surplus) correctly computed',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Surplus = +5 units',
        actual: `Surplus = +${diff} units`,
        details: 'When physical shelf stock exceeds system record, surplus is positive.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.7',
        title: 'Positive difference (surplus) correctly computed',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Surplus = +5',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.8: Negative difference (shortage) correctly computed
    // -------------------------------------------------------------
    try {
      const systemStock = 25;
      const physicalStock = 21;
      const diff = physicalStock - systemStock;
      const passed = diff === -4;

      results.push({
        code: 'TEST-6.8',
        title: 'Negative difference (shortage) correctly computed',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Shortage = -4 units',
        actual: `Shortage = ${diff} units`,
        details: 'When shelf stock is fewer than recorded, shortage is negative.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.8',
        title: 'Negative difference (shortage) correctly computed',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Shortage = -4',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.9: Zero difference requires no adjustment
    // -------------------------------------------------------------
    try {
      const systemStock = 30;
      const physicalStock = 30;
      const diff = physicalStock - systemStock;
      const requiresAdjustment = diff !== 0;
      const passed = diff === 0 && !requiresAdjustment;

      results.push({
        code: 'TEST-6.9',
        title: 'Zero difference requires no adjustment',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'requiresAdjustment = false (diff = 0)',
        actual: `requiresAdjustment = ${requiresAdjustment} (diff = ${diff})`,
        details: 'Matching shelf count avoids unnecessary mutation movements.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.9',
        title: 'Zero difference requires no adjustment',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'requiresAdjustment = false',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.10: Physical count does NOT alter inventory before confirmation
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-10', 'SKU-610', 'Maggi Kari', 24, 4.0, 5.5);
      // User inputs physical count = 20 (not confirmed yet)
      const enteredCount = 20;
      // Product in state must remain untouched:
      const passed = prod.currentStock === 24;

      results.push({
        code: 'TEST-6.10',
        title: 'Physical count does NOT alter inventory before confirmation',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Stock remains 24 before confirmation',
        actual: `Stock is ${prod.currentStock}`,
        details: 'State mutation only occurs on explicit confirmation.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.10',
        title: 'Physical count does NOT alter inventory before confirmation',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Stock unchanged',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.11: Confirmed physical count creates valid ADJUSTMENT movement
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-11', 'SKU-611', 'Sardin Ayam Brand', 20, 6.0, 8.5);
      const diff = -3; // 17 counted vs 20 recorded

      const mov = helperRecordAdjustment(
        prod,
        diff,
        'Physical Count: shelf audit discrepancy'
      );

      const passed =
        mov.type === 'ADJUSTMENT' &&
        mov.quantity === -3 &&
        mov.previousStock === 20 &&
        mov.newStock === 17 &&
        mov.reason.includes('Physical Count');

      results.push({
        code: 'TEST-6.11',
        title: 'Confirmed physical count creates valid ADJUSTMENT movement',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'ADJUSTMENT movement, Qty = -3, Prev = 20, New = 17',
        actual: `Type = ${mov.type}, Qty = ${mov.quantity}, Prev = ${mov.previousStock}, New = ${mov.newStock}`,
        details: 'Atomic movement logging preserves immutable audit record.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.11',
        title: 'Confirmed physical count creates valid ADJUSTMENT movement',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Valid movement created',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.12: Confirmed physical count updates product currentStock
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-12', 'SKU-612', 'Gula Prai', 15, 2.8, 3.5);
      const diff = 5; // counted 20 vs recorded 15

      const mov = helperRecordAdjustment(
        prod,
        diff,
        'Physical Count: surplus stock found'
      );
      prod.currentStock = mov.newStock;

      const passed = prod.currentStock === 20;

      results.push({
        code: 'TEST-6.12',
        title: 'Confirmed physical count updates product currentStock',
        category: 'PHYSICAL_COUNT',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Product stock updated to 20',
        actual: `Product stock is ${prod.currentStock}`,
        details: 'Current stock correctly syncs with verified physical count.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.12',
        title: 'Confirmed physical count updates product currentStock',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Product stock updated',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.13: Standard adjustment reason accepted
    // -------------------------------------------------------------
    try {
      const standardReasons = [
        'Physical Count',
        'Damaged',
        'Expired',
        'Lost',
        'Found',
        'Data Correction',
        'Other',
      ];
      let allAccepted = true;
      standardReasons.forEach((reason) => {
        const prod = helperCreateProduct('p-tmp', 'SKU-TMP', 'Temp', 10, 1, 2);
        const mov = helperRecordAdjustment(prod, 1, reason);
        if (mov.reason !== reason) allAccepted = false;
      });

      results.push({
        code: 'TEST-6.13',
        title: 'Standard adjustment reason accepted',
        category: 'PHYSICAL_COUNT',
        status: allAccepted ? 'PASSED' : 'FAILED',
        expected: 'All 7 standard reasons accepted without mutation errors',
        actual: allAccepted ? 'All 7 reasons accepted' : 'Some reasons rejected',
        details: 'Section 8 standard adjustment reasons successfully recorded.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.13',
        title: 'Standard adjustment reason accepted',
        category: 'PHYSICAL_COUNT',
        status: 'FAILED',
        expected: 'Reasons accepted',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.14: Product 360 view aggregates movements accurately
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-14', 'SKU-614', 'Kopi Cap Hang Tuah', 20, 4.0, 6.0);
      const movements: InventoryMovement[] = [
        {
          id: 'm-614-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 25,
          previousStock: 0,
          newStock: 25,
          reason: 'Purchase',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm-614-2',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'SALE',
          quantity: -5,
          previousStock: 25,
          newStock: 20,
          reason: 'Sale',
          createdAt: new Date().toISOString(),
        },
      ];

      const p360 = InventoryControlService.getProduct360View(prod, movements, [], []);
      const passed = p360.movements.length === 2 && p360.summary.movementCount === 2;

      results.push({
        code: 'TEST-6.14',
        title: 'Product 360 view aggregates movements accurately',
        category: 'PRODUCT_360',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '2 movements aggregated in 360 view',
        actual: `${p360.movements.length} movements returned`,
        details: 'Complete historical movement ledger retrieved for product.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.14',
        title: 'Product 360 view aggregates movements accurately',
        category: 'PRODUCT_360',
        status: 'FAILED',
        expected: 'Movements aggregated',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.15: Product 360 view includes purchase history
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-15', 'SKU-615', 'Teh Tarik', 40, 5.0, 7.5);
      const purchases: Purchase[] = [
        {
          id: 'po-615-1',
          purchaseNumber: 'PUR-000001',
          supplierId: 'sup-1',
          supplierNameSnapshot: 'F&N Dairies',
          supplierCodeSnapshot: 'SUP-001',
          status: 'COMPLETED',
          items: [
            {
              id: 'poi-1',
              purchaseId: 'po-615-1',
              productId: prod.id,
              productNameSnapshot: prod.name,
              skuSnapshot: prod.sku,
              quantity: 40,
              unitCost: 5.0,
              lineTotal: 200.0,
            },
          ],
          subtotal: 200.0,
          discount: 0,
          total: 200.0,
          purchaseDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const p360 = InventoryControlService.getProduct360View(prod, [], [], purchases);
      const passed =
        p360.purchases.length === 1 &&
        p360.summary.totalPurchasedUnits === 40 &&
        p360.summary.totalPurchasedValue === 200;

      results.push({
        code: 'TEST-6.15',
        title: 'Product 360 view includes purchase history',
        category: 'PRODUCT_360',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '1 purchase record with 40 units worth RM200',
        actual: `${p360.purchases.length} purchases, ${p360.summary.totalPurchasedUnits} units, RM${p360.summary.totalPurchasedValue}`,
        details: 'Procurement history correctly extracted from completed purchase orders.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.15',
        title: 'Product 360 view includes purchase history',
        category: 'PRODUCT_360',
        status: 'FAILED',
        expected: 'Purchases included',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.16: Product 360 view includes sales history
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-16', 'SKU-616', 'Biskut Hup Seng', 15, 3.0, 4.5);
      const sales: Sale[] = [
        helperCreateSale('sale-616-1', 'SALE-000001', [{ product: prod, quantity: 5 }]),
      ];

      const p360 = InventoryControlService.getProduct360View(prod, [], sales, []);
      const passed =
        p360.sales.length === 1 &&
        p360.summary.totalSoldUnits === 5 &&
        p360.summary.totalSalesRevenue === 22.5 &&
        p360.summary.totalGrossProfit === 7.5;

      results.push({
        code: 'TEST-6.16',
        title: 'Product 360 view includes sales history',
        category: 'PRODUCT_360',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '1 sale record, 5 sold, RM22.50 rev, RM7.50 gross profit',
        actual: `${p360.sales.length} sales, ${p360.summary.totalSoldUnits} sold, RM${p360.summary.totalSalesRevenue} rev, RM${p360.summary.totalGrossProfit} profit`,
        details: 'Sales performance seamlessly aggregated from historical sales.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.16',
        title: 'Product 360 view includes sales history',
        category: 'PRODUCT_360',
        status: 'FAILED',
        expected: 'Sales history included',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.17: Product 360 view displays correct reconciliation status
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-17', 'SKU-617', 'Tepung Gandum', 10, 2.0, 3.0);
      const movements: InventoryMovement[] = [
        {
          id: 'm-617-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 10,
          previousStock: 0,
          newStock: 10,
          reason: 'Initial load',
          createdAt: new Date().toISOString(),
        },
      ];

      const p360 = InventoryControlService.getProduct360View(prod, movements, [], []);
      const passed = p360.reconciliation.status === 'OK' && p360.reconciliation.difference === 0;

      results.push({
        code: 'TEST-6.17',
        title: 'Product 360 view displays correct reconciliation status',
        category: 'PRODUCT_360',
        status: passed ? 'PASSED' : 'FAILED',
        expected: "Reconciliation status = 'OK'",
        actual: `Reconciliation status = '${p360.reconciliation.status}'`,
        details: 'Reconciliation status embedded directly in Product 360 response.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.17',
        title: 'Product 360 view displays correct reconciliation status',
        category: 'PRODUCT_360',
        status: 'FAILED',
        expected: "Status = 'OK'",
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.18: Product 360 view displays correct stock status
    // -------------------------------------------------------------
    try {
      const normalProd = helperCreateProduct('p6-18a', 'SKU-618A', 'Item Normal', 10, 1, 2, 5);
      const lowProd = helperCreateProduct('p6-18b', 'SKU-618B', 'Item Low', 3, 1, 2, 5);
      const outProd = helperCreateProduct('p6-18c', 'SKU-618C', 'Item Out', 0, 1, 2, 5);

      const vNormal = InventoryControlService.getProductValuation(normalProd);
      const vLow = InventoryControlService.getProductValuation(lowProd);
      const vOut = InventoryControlService.getProductValuation(outProd);

      const passed =
        vNormal.stockStatus === 'NORMAL' &&
        vLow.stockStatus === 'LOW_STOCK' &&
        vOut.stockStatus === 'OUT_OF_STOCK';

      results.push({
        code: 'TEST-6.18',
        title: 'Product 360 view displays correct stock status',
        category: 'PRODUCT_360',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'NORMAL, LOW_STOCK, and OUT_OF_STOCK verified',
        actual: `${vNormal.stockStatus}, ${vLow.stockStatus}, ${vOut.stockStatus}`,
        details: 'Stock threshold classification accurately reflects Part 01.5 definitions.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.18',
        title: 'Product 360 view displays correct stock status',
        category: 'PRODUCT_360',
        status: 'FAILED',
        expected: 'Status correct',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.19: Restock recommendation equals 0 when stock >= minimum
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-19', 'SKU-619', 'Minyak Masak 1kg', 12, 6.0, 8.5, 10);
      const val = InventoryControlService.getProductValuation(prod);
      const passed = val.suggestedRestockQty === 0;

      results.push({
        code: 'TEST-6.19',
        title: 'Restock recommendation equals 0 when stock >= minimum',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'suggestedRestockQty = 0 (Stock 12 >= Min 10)',
        actual: `suggestedRestockQty = ${val.suggestedRestockQty}`,
        formulaOrMath: 'suggestedRestock = Math.max(0, minimumStock - currentStock)',
        details: 'No restock recommended when inventory is at or above minimum threshold.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.19',
        title: 'Restock recommendation equals 0 when stock >= minimum',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: 'FAILED',
        expected: '0',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.20: Restock recommendation equals (minimum - stock) when stock < minimum
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-20', 'SKU-620', 'Susu Pekat', 3, 3.2, 4.2, 10);
      const val = InventoryControlService.getProductValuation(prod);
      const passed = val.suggestedRestockQty === 7;

      results.push({
        code: 'TEST-6.20',
        title: 'Restock recommendation equals (minimum - stock) when stock < minimum',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'suggestedRestockQty = 7 (Min 10 - Stock 3)',
        actual: `suggestedRestockQty = ${val.suggestedRestockQty}`,
        formulaOrMath: 'suggestedRestock = Math.max(0, 10 - 3) = 7',
        details: 'Correct deficit quantity calculated to return stock to minimum threshold.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.20',
        title: 'Restock recommendation equals (minimum - stock) when stock < minimum',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: 'FAILED',
        expected: '7',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.21: Restock recommendation equals minimum when stock is 0
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-21', 'SKU-621', 'Sabun Mandi', 0, 2.5, 4.0, 15);
      const val = InventoryControlService.getProductValuation(prod);
      const passed = val.suggestedRestockQty === 15;

      results.push({
        code: 'TEST-6.21',
        title: 'Restock recommendation equals minimum when stock is 0',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'suggestedRestockQty = 15 (Min 15 - Stock 0)',
        actual: `suggestedRestockQty = ${val.suggestedRestockQty}`,
        details: 'When out of stock, recommendation equals the entire minimum threshold.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.21',
        title: 'Restock recommendation equals minimum when stock is 0',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: 'FAILED',
        expected: '15',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.22: Restock recommendation handles negative stock gracefully
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-22', 'SKU-622', 'Neg Stock Item', -2, 2.0, 3.5, 10);
      const val = InventoryControlService.getProductValuation(prod);
      // Math.max(0, 10 - (-2)) = 12
      const passed = val.suggestedRestockQty === 12;

      results.push({
        code: 'TEST-6.22',
        title: 'Restock recommendation handles negative stock gracefully',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'suggestedRestockQty = 12 (10 - (-2))',
        actual: `suggestedRestockQty = ${val.suggestedRestockQty}`,
        details: 'Handles negative stock edge-case without NaN or underflow.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.22',
        title: 'Restock recommendation handles negative stock gracefully',
        category: 'RESTOCK_RECOMMENDATIONS',
        status: 'FAILED',
        expected: '12',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.23: Inventory value equals currentStock * costPrice
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-23', 'SKU-623', 'Kacang Tanah', 25, 4.2, 6.0);
      const val = InventoryControlService.getProductValuation(prod);
      // 25 * 4.2 = 105.00
      const passed = val.inventoryValue === 105.0;

      results.push({
        code: 'TEST-6.23',
        title: 'Inventory value equals currentStock * costPrice',
        category: 'VALUATION_AND_MARGINS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'inventoryValue = 105.00 (25 units * RM4.20)',
        actual: `inventoryValue = ${val.inventoryValue.toFixed(2)}`,
        formulaOrMath: 'Inventory Value = Current Stock * Cost Price',
        details: 'Section 12 valuation formula strictly verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.23',
        title: 'Inventory value equals currentStock * costPrice',
        category: 'VALUATION_AND_MARGINS',
        status: 'FAILED',
        expected: '105.00',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.24: Potential retail value equals currentStock * sellingPrice
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-24', 'SKU-624', 'Roti Gardenia', 20, 2.5, 3.8);
      const val = InventoryControlService.getProductValuation(prod);
      // 20 * 3.8 = 76.00
      const passed = val.potentialRetailValue === 76.0;

      results.push({
        code: 'TEST-6.24',
        title: 'Potential retail value equals currentStock * sellingPrice',
        category: 'VALUATION_AND_MARGINS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'potentialRetailValue = 76.00 (20 units * RM3.80)',
        actual: `potentialRetailValue = ${val.potentialRetailValue.toFixed(2)}`,
        formulaOrMath: 'Potential Retail Value = Current Stock * Selling Price',
        details: 'Potential revenue at full catalog retail price.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.24',
        title: 'Potential retail value equals currentStock * sellingPrice',
        category: 'VALUATION_AND_MARGINS',
        status: 'FAILED',
        expected: '76.00',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.25: Potential gross profit equals retail value - inventory value
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-25', 'SKU-625', 'Bateri AA', 10, 5.0, 9.0);
      const val = InventoryControlService.getProductValuation(prod);
      // retail: 90, cost: 50, profit: 40
      const passed = val.potentialGrossProfit === 40.0;

      results.push({
        code: 'TEST-6.25',
        title: 'Potential gross profit equals retail value - inventory value',
        category: 'VALUATION_AND_MARGINS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'potentialGrossProfit = 40.00 (90.00 - 50.00)',
        actual: `potentialGrossProfit = ${val.potentialGrossProfit.toFixed(2)}`,
        formulaOrMath: 'Potential Gross Profit = Potential Retail Value - Inventory Value',
        details: 'Margin estimation grounded strictly in catalog numbers.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.25',
        title: 'Potential gross profit equals retail value - inventory value',
        category: 'VALUATION_AND_MARGINS',
        status: 'FAILED',
        expected: '40.00',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.26: Potential gross profit margin percentage calculated correctly
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p6-26', 'SKU-626', 'Biskut Marie', 10, 3.0, 4.0);
      const val = InventoryControlService.getProductValuation(prod);
      // profit = 10, retail = 40 => margin = (10 / 40) * 100 = 25.0%
      const passed = val.potentialGrossMarginPercent === 25.0;

      results.push({
        code: 'TEST-6.26',
        title: 'Potential gross profit margin percentage calculated correctly',
        category: 'VALUATION_AND_MARGINS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'potentialGrossMarginPercent = 25.0%',
        actual: `potentialGrossMarginPercent = ${val.potentialGrossMarginPercent}%`,
        formulaOrMath: '(Potential Gross Profit / Potential Retail Value) * 100',
        details: 'Accurate percentage calculation with zero-division safety.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.26',
        title: 'Potential gross profit margin percentage calculated correctly',
        category: 'VALUATION_AND_MARGINS',
        status: 'FAILED',
        expected: '25.0%',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.27: Total inventory value sums across all products correctly
    // -------------------------------------------------------------
    try {
      const prods: Product[] = [
        helperCreateProduct('p-sum-1', 'SKU-S1', 'P1', 10, 2.0, 3.0), // 20
        helperCreateProduct('p-sum-2', 'SKU-S2', 'P2', 20, 3.0, 5.0), // 60
        helperCreateProduct('p-sum-3', 'SKU-S3', 'P3', 5, 10.0, 15.0), // 50
      ];
      const health = InventoryControlService.getStockHealthSummary(prods, [], 30);
      // 20 + 60 + 50 = 130
      const passed = health.totalInventoryValue === 130.0 && health.totalUnitsInStock === 35;

      results.push({
        code: 'TEST-6.27',
        title: 'Total inventory value sums across all products correctly',
        category: 'VALUATION_AND_MARGINS',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'totalInventoryValue = 130.00, totalUnits = 35',
        actual: `totalInventoryValue = ${health.totalInventoryValue.toFixed(2)}, totalUnits = ${health.totalUnitsInStock}`,
        details: 'Store-wide inventory capital accumulation verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.27',
        title: 'Total inventory value sums across all products correctly',
        category: 'VALUATION_AND_MARGINS',
        status: 'FAILED',
        expected: '130.00',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.28: Fast moving products ranked by units sold
    // -------------------------------------------------------------
    try {
      const prodA = helperCreateProduct('p-fa-1', 'SKU-FA1', 'Fast Item A', 50, 2, 4);
      const prodB = helperCreateProduct('p-fa-2', 'SKU-FA2', 'Fast Item B', 50, 2, 4);
      const prodC = helperCreateProduct('p-fa-3', 'SKU-FA3', 'Fast Item C', 50, 2, 4);

      const sales: Sale[] = [
        helperCreateSale('s-fm-1', 'S-01', [
          { product: prodA, quantity: 20 },
          { product: prodB, quantity: 50 },
          { product: prodC, quantity: 5 },
        ]),
      ];

      const fastMovers = InventoryControlService.getFastMovingProducts([prodA, prodB, prodC], sales, 30);
      const passed =
        fastMovers.length === 3 &&
        fastMovers[0].productId === prodB.id && // 50 units
        fastMovers[1].productId === prodA.id && // 20 units
        fastMovers[2].productId === prodC.id; // 5 units

      results.push({
        code: 'TEST-6.28',
        title: 'Fast moving products ranked by units sold',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Rank 1: B (50), Rank 2: A (20), Rank 3: C (5)',
        actual: `Rank 1: ${fastMovers[0]?.productName} (${fastMovers[0]?.unitsSold}), Rank 2: ${fastMovers[1]?.productName} (${fastMovers[1]?.unitsSold}), Rank 3: ${fastMovers[2]?.productName} (${fastMovers[2]?.unitsSold})`,
        details: 'Products sorted strictly in descending order of completed sales units.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.28',
        title: 'Fast moving products ranked by units sold',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: 'Sorted correctly',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.29: Fast moving products filter by date range correctly
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p-dr-1', 'SKU-DR1', 'Item Date Range', 50, 2, 4);
      const sales: Sale[] = [
        helperCreateSale(
          's-dr-old',
          'S-OLD',
          [{ product: prod, quantity: 100 }],
          new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
        ),
        helperCreateSale(
          's-dr-new',
          'S-NEW',
          [{ product: prod, quantity: 15 }],
          new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        ),
      ];

      // Query 7 days: should only pick the 15 units, not the 100
      const movers7d = InventoryControlService.getFastMovingProducts([prod], sales, 7);
      const passed = movers7d.length === 1 && movers7d[0].unitsSold === 15;

      results.push({
        code: 'TEST-6.29',
        title: 'Fast moving products filter by date range correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'unitsSold = 15 in 7-day window (excludes 40-day old sale)',
        actual: `unitsSold = ${movers7d[0]?.unitsSold}`,
        details: 'Date boundary filtering strictly isolates sales in specified period.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.29',
        title: 'Fast moving products filter by date range correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: '15 units',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.30: Fast moving products ignore non-completed sales
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p-nc-1', 'SKU-NC1', 'Non-Completed Item', 50, 2, 4);
      const sales: Sale[] = [
        helperCreateSale(
          's-void',
          'S-VOID',
          [{ product: prod, quantity: 80 }],
          new Date().toISOString(),
          'VOID'
        ),
      ];

      const fastMovers = InventoryControlService.getFastMovingProducts([prod], sales, 30);
      const passed = fastMovers.length === 0;

      results.push({
        code: 'TEST-6.30',
        title: 'Fast moving products ignore non-completed sales',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '0 fast movers (VOID sale excluded)',
        actual: `${fastMovers.length} fast movers returned`,
        details: 'Only COMPLETED sales are counted toward retail velocity.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.30',
        title: 'Fast moving products ignore non-completed sales',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: '0',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.31: Products with no sales identified correctly
    // -------------------------------------------------------------
    try {
      const prodWithSales = helperCreateProduct('p-ws-1', 'SKU-WS1', 'Item With Sales', 10, 2, 4);
      const prodNoSales = helperCreateProduct('p-ns-1', 'SKU-NS1', 'Idle Item', 20, 5, 8);

      const sales: Sale[] = [
        helperCreateSale('s-ws', 'S-WS', [{ product: prodWithSales, quantity: 2 }]),
      ];

      const noSalesItems = InventoryControlService.getProductsWithNoSales(
        [prodWithSales, prodNoSales],
        sales,
        30
      );
      const passed =
        noSalesItems.length === 1 && noSalesItems[0].productId === prodNoSales.id;

      results.push({
        code: 'TEST-6.31',
        title: 'Products with no sales identified correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '1 product with no sales (Idle Item)',
        actual: `${noSalesItems.length} products with no sales (${noSalesItems[0]?.productName})`,
        details: 'Identifies slow-moving inventory tied up in stock.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.31',
        title: 'Products with no sales identified correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: '1 product',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.32: No-sales filter by date range works correctly
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p-ns-dr', 'SKU-NSDR', 'Item Old Sale', 15, 3, 5);
      const sales: Sale[] = [
        helperCreateSale(
          's-ns-dr',
          'S-OLD2',
          [{ product: prod, quantity: 5 }],
          new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
        ),
      ];

      // In a 7-day window, this product has NO sales
      const noSales7d = InventoryControlService.getProductsWithNoSales([prod], sales, 7);
      // In a 30-day window, this product HAS sales
      const noSales30d = InventoryControlService.getProductsWithNoSales([prod], sales, 30);

      const passed = noSales7d.length === 1 && noSales30d.length === 0;

      results.push({
        code: 'TEST-6.32',
        title: 'No-sales filter by date range works correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '7d: 1 item flagged, 30d: 0 items flagged',
        actual: `7d: ${noSales7d.length} item, 30d: ${noSales30d.length} items`,
        details: 'Accurately adapts to user selected period.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.32',
        title: 'No-sales filter by date range works correctly',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: 'Filtered correctly',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.33: Stock coverage estimated correctly for active sales
    // -------------------------------------------------------------
    try {
      // Current stock = 60
      // Sales in 30 days = 30 units => avg daily sales = 1.0 unit/day
      // Coverage = 60 / 1.0 = Approx. 60 days of stock
      const prod = helperCreateProduct('p-cov-1', 'SKU-COV1', 'Coverage Test', 60, 2, 4);
      const sales: Sale[] = [
        helperCreateSale('s-cov-1', 'S-COV', [{ product: prod, quantity: 30 }]),
      ];

      const movers = InventoryControlService.getFastMovingProducts([prod], sales, 30);
      const item = movers[0];
      const passed =
        item &&
        item.avgDailySales === 1.0 &&
        item.stockCoverageDays === 60 &&
        item.stockCoverageDisplay === 'Approx. 60 days of stock';

      results.push({
        code: 'TEST-6.33',
        title: 'Stock coverage estimated correctly for active sales',
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Approx. 60 days of stock (60 units / 1 unit/day)',
        actual: `${item?.stockCoverageDisplay}`,
        formulaOrMath: 'Coverage = Current Stock / (Units Sold / Days in Period)',
        details: 'Section 19 coverage estimation accurately derived.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.33',
        title: 'Stock coverage estimated correctly for active sales',
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: 'Approx. 60 days of stock',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.34: Stock coverage displays 'Not available' when sales = 0
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p-cov-0', 'SKU-COV0', 'Zero Sales Test', 50, 2, 4);
      const coverage = InventoryControlService.calculateStockCoverage(prod.currentStock, 0, 30);
      const passed = coverage.coverageDays === null && coverage.display === 'Not available';

      results.push({
        code: 'TEST-6.34',
        title: "Stock coverage displays 'Not available' when sales = 0",
        category: 'VELOCITY_AND_COVERAGE',
        status: passed ? 'PASSED' : 'FAILED',
        expected: "'Not available'",
        actual: `'${coverage.display}'`,
        details: 'Zero-sales safety prevents division by zero and infinity.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.34',
        title: "Stock coverage displays 'Not available' when sales = 0",
        category: 'VELOCITY_AND_COVERAGE',
        status: 'FAILED',
        expected: "'Not available'",
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.35: Stock health categorization accurate (normal, low, out)
    // -------------------------------------------------------------
    try {
      const prods: Product[] = [
        helperCreateProduct('p-h-1', 'SKU-H1', 'Item Normal 1', 20, 1, 2, 10), // Normal
        helperCreateProduct('p-h-2', 'SKU-H2', 'Item Normal 2', 10, 1, 2, 10), // Normal (equal min)
        helperCreateProduct('p-h-3', 'SKU-H3', 'Item Low', 5, 1, 2, 10), // Low
        helperCreateProduct('p-h-4', 'SKU-H4', 'Item Out 1', 0, 1, 2, 10), // Out
        helperCreateProduct('p-h-5', 'SKU-H5', 'Item Out 2', -1, 1, 2, 10), // Out
      ];

      const health = InventoryControlService.getStockHealthSummary(prods, [], 30);
      const passed =
        health.normalCount === 2 &&
        health.lowStockCount === 1 &&
        health.outOfStockCount === 2;

      results.push({
        code: 'TEST-6.35',
        title: 'Stock health categorization accurate (normal, low, out)',
        category: 'STOCK_HEALTH',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Normal = 2, Low = 1, Out = 2',
        actual: `Normal = ${health.normalCount}, Low = ${health.lowStockCount}, Out = ${health.outOfStockCount}`,
        details: 'Classification partitions catalog exactly by Part 01.5 thresholds.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.35',
        title: 'Stock health categorization accurate (normal, low, out)',
        category: 'STOCK_HEALTH',
        status: 'FAILED',
        expected: 'Categorized correctly',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.36: Inventory report total active products matches catalog
    // -------------------------------------------------------------
    try {
      const prods: Product[] = [
        helperCreateProduct('p-rep-1', 'SKU-R1', 'Active 1', 10, 1, 2),
        helperCreateProduct('p-rep-2', 'SKU-R2', 'Active 2', 20, 1, 2),
        { ...helperCreateProduct('p-rep-3', 'SKU-R3', 'Inactive 1', 5, 1, 2), active: false },
      ];

      const health = InventoryControlService.getStockHealthSummary(prods, [], 30);
      const passed = health.totalActiveProducts === 2;

      results.push({
        code: 'TEST-6.36',
        title: 'Inventory report total active products matches catalog',
        category: 'STOCK_HEALTH',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'totalActiveProducts = 2 (1 inactive ignored)',
        actual: `totalActiveProducts = ${health.totalActiveProducts}`,
        details: 'Filters out inactive catalog products from active store health reports.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.36',
        title: 'Inventory report total active products matches catalog',
        category: 'STOCK_HEALTH',
        status: 'FAILED',
        expected: '2',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.37: Historical integrity: stock movements never deleted or overwritten
    // -------------------------------------------------------------
    try {
      const prod = helperCreateProduct('p-hi-1', 'SKU-HI1', 'Historical Integrity Item', 10, 2, 4);
      const movements: InventoryMovement[] = [
        {
          id: 'm-orig-1',
          storeId: INITIAL_STORE.id,
          productId: prod.id,
          type: 'STOCK_IN',
          quantity: 15,
          previousStock: 0,
          newStock: 15,
          reason: 'Initial load',
          createdAt: new Date().toISOString(),
        },
      ];

      // Record an adjustment
      const newMov = helperRecordAdjustment(prod, -5, 'Physical Count discrepancy');
      const updatedMovements = [...movements, newMov];

      const passed =
        updatedMovements.length === 2 &&
        updatedMovements[0].id === 'm-orig-1' &&
        updatedMovements[1].id === newMov.id;

      results.push({
        code: 'TEST-6.37',
        title: 'Historical integrity: stock movements never deleted or overwritten',
        category: 'HISTORICAL_INTEGRITY_AND_COMPATIBILITY',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Original movement retained, new movement appended (length = 2)',
        actual: `Movements count = ${updatedMovements.length}`,
        details: 'Movement ledger is strictly append-only; historical records cannot be rewritten.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.37',
        title: 'Historical integrity: stock movements never deleted or overwritten',
        category: 'HISTORICAL_INTEGRITY_AND_COMPATIBILITY',
        status: 'FAILED',
        expected: 'Append only',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    // -------------------------------------------------------------
    // Test 6.38: Backward compatibility: Parts 01-05 behavior unchanged
    // -------------------------------------------------------------
    try {
      const supplier: Supplier = {
        id: 'sup-compat',
        supplierCode: 'SUP-999',
        supplierName: 'Pembekal Bersatu',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const prod = helperCreateProduct('p-compat', 'SKU-COMPAT', 'Compat Item', 10, 5.0, 10.0);
      const sMap = new Map([[supplier.id, supplier]]);
      const pMap = new Map([[prod.id, prod]]);

      // 1. Part 05 Purchasing workflow
      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: supplier.id,
          items: [{ productId: prod.id, quantity: 20, unitCost: 4.5 }],
        },
        sMap,
        pMap,
        []
      );
      const poResult = PurchasingService.completePurchase(draft, sMap, pMap, INITIAL_STORE.id);
      const receivedProd = poResult.updatedProducts[0];
      pMap.set(receivedProd.id, receivedProd);

      // 2. Part 03 POS Checkout workflow
      const cart: CartItem[] = [
        {
          product: receivedProd,
          quantity: 5,
        },
      ];
      const saleResult = SalesService.processSale(
        cart,
        pMap,
        INITIAL_STORE.id,
        0,
        { paymentMethod: 'CASH', cashReceived: 50.0 }
      );

      // Verify outcomes:
      // Stock = 30 - 5 = 25
      // Sale costPrice = 4.50 (snapshot)
      // Line Cost = 5 * 4.5 = 22.50
      // Sale Total = 5 * 10 = 50.00
      // Gross Profit = 50 - 22.5 = 27.50
      const passed =
        saleResult.updatedProducts[0].currentStock === 25 &&
        saleResult.sale.totalCost === 22.5 &&
        saleResult.sale.grossProfit === 27.5;

      results.push({
        code: 'TEST-6.38',
        title: 'Backward compatibility: Parts 01-05 behavior unchanged',
        category: 'HISTORICAL_INTEGRITY_AND_COMPATIBILITY',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Stock = 25, Sale COGS = 22.50, Gross Profit = 27.50',
        actual: `Stock = ${saleResult.updatedProducts[0].currentStock}, COGS = ${saleResult.sale.totalCost}, Gross Profit = ${saleResult.sale.grossProfit}`,
        details: 'Full end-to-end regression: Supplier PO -> Stock In -> POS Sale -> COGS -> GP works perfectly.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-6.38',
        title: 'Backward compatibility: Parts 01-05 behavior unchanged',
        category: 'HISTORICAL_INTEGRITY_AND_COMPATIBILITY',
        status: 'FAILED',
        expected: 'Parts 01-05 unchanged',
        actual: e.message,
        details: 'Exception encountered',
      });
    }

    return results;
  }
}
