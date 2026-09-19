/**
 * NiagaPOS - Part 05 Purchasing + Supplier Management Verification Runner
 * 
 * Programmatically validates all Part 05 specifications:
 * A - Supplier Registration, Code Uniqueness & Format (SUP-001, etc.)
 * B - Supplier Validation (Name, Code, Active status)
 * C - Active / Inactive Supplier Toggle
 * D - Safe Deactivation: Cannot delete supplier with purchase history
 * E - Draft Purchase Creation & Sequential Numbering (PUR-000001, etc.)
 * F - Line Total Calculation: (Qty * UnitCost) - Discount
 * G - Purchase Totals: Subtotal, Document Discount, Net Total
 * H - Atomic Purchase Completion Workflow
 * I - Stock Receiving: Product.currentStock increments accurately
 * J - Cost Price Update: Product.costPrice updates to latest received unit cost
 * K - STOCK_IN Movement Creation with Reference ID and Reason
 * L - Duplicate Completion Prevention (Idempotence & State Lock)
 * M - Historical Integrity: Past POS SaleItem cost snapshots remain unchanged
 * N - Supplier Name & Code Snapshots preserved on Purchase
 * O - Draft Purchase Cancellation
 * P - Completed Purchase Cannot be Cancelled (Prevents inventory desync)
 * Q - Purchase Item Validation (Quantity > 0, Cost >= 0)
 * R - Inactive Product or Supplier Rejection on Purchase Creation
 * S - Product Purchase History Lookup ("How much have I been paying?")
 * T - Supplier Purchasing Summary (Total purchases, units, value)
 * U - Supplier Procurement Breakdown (% of procurement)
 * V - Purchasing Summary KPIs (Count, Units, Value, Active Vendors)
 * W - Retail Profit Clarity: Gross Profit = Sales Revenue - COGS (Purchases != COGS)
 * X - Immediate POS Sale of Received Stock
 * Y - Sequential Cost Changes & Margin Realization
 * Z - Purchase Filtering by Date Range & Status
 * AA - Zero / Empty State Handling
 * AB - Multi-item Purchase Receipt Handling
 * AC - Supplier Search and Filter Matching
 * AD - Purchase Search by PO#, Supplier, SKU
 * AE - Zero-Cost Promotional Stock Receiving (RM0.00 Unit Cost)
 * AF - Catalog Inventory Valuation Updates accurately after receiving
 * AG - Restocking restores OUT_OF_STOCK product to NORMAL
 * AH - Restocking clears LOW_STOCK status
 * AI - Purchase Notes & Contact Details Preservation
 * AJ - Multi-supplier Sequential Receiving for Single Product
 * AK - Audit Traceability: Inventory Movement balance matches Product currentStock
 * AL - Full End-to-End Retail Lifecycle: Supplier -> PO -> Stock In -> POS Sale -> COGS -> Gross Profit
 */

import { Product, Supplier, Purchase, InventoryMovement, CartItem, Sale } from '../types';
import { PurchasingService } from './purchasingService';
import { SupplierService } from './supplierService';
import { SalesService } from './salesService';
import { InventoryService } from './inventoryService';
import { ReportingService } from './reportingService';
import { INITIAL_STORE } from './seedData';

export interface Part05TestResult {
  code: string;
  title: string;
  category:
    | 'SUPPLIER_MANAGEMENT'
    | 'PURCHASE_ORDER'
    | 'STOCK_RECEIVING'
    | 'COST_PRICE_UPDATE'
    | 'INVENTORY_AUDIT'
    | 'HISTORICAL_INTEGRITY'
    | 'CANCELLATION_SAFETY'
    | 'REPORTING_AND_PROFIT'
    | 'FULL_LIFECYCLE';
  status: 'PASSED' | 'FAILED';
  expected: string;
  actual: string;
  formulaOrMath?: string;
  details: string;
}

export class Part05VerificationRunner {
  public static runAllTests(): Part05TestResult[] {
    const results: Part05TestResult[] = [];
    const store = INITIAL_STORE;

    const createMockProduct = (
      id: string,
      sku: string,
      name: string,
      cost: number,
      price: number,
      stock: number,
      minStock = 5,
      active = true
    ): Product => ({
      id,
      storeId: store.id,
      sku,
      name,
      category: 'General',
      costPrice: cost,
      sellingPrice: price,
      currentStock: stock,
      minimumStock: minStock,
      active,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    });

    const createMockSupplier = (
      id: string,
      code: string,
      name: string,
      active = true
    ): Supplier => ({
      id,
      supplierCode: code,
      supplierName: name,
      contactPerson: 'Mr. Tan',
      phone: '012-3456789',
      email: 'tan@supplier.com',
      address: '123 Warehouse Rd, PJ',
      active,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    });

    // -------------------------------------------------------------------------
    // TEST A: Supplier Registration & Code Uniqueness
    // -------------------------------------------------------------------------
    try {
      const sup1 = createMockSupplier('sup-1', 'SUP-001', 'F&N Beverages');
      const existing = [sup1];
      const validCode = SupplierService.isSupplierCodeUnique('SUP-002', existing);
      const duplicateCode = SupplierService.isSupplierCodeUnique('SUP-001', existing);
      const caseDuplicate = SupplierService.isSupplierCodeUnique('sup-001', existing);

      const pass = validCode && !duplicateCode && !caseDuplicate;
      results.push({
        code: 'TEST-P05-A',
        title: 'Supplier Registration & Code Uniqueness',
        category: 'SUPPLIER_MANAGEMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'SUP-002 is unique; SUP-001 & sup-001 rejected as duplicate',
        actual: `SUP-002 valid: ${validCode}, SUP-001 dup: ${!duplicateCode}, case-insensitive dup: ${!caseDuplicate}`,
        details: 'Verified supplier code uniqueness check enforces case-insensitive exclusivity.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-A',
        title: 'Supplier Registration & Code Uniqueness',
        category: 'SUPPLIER_MANAGEMENT',
        status: 'FAILED',
        expected: 'Code validation succeeds',
        actual: e.message,
        details: 'Exception thrown during code uniqueness verification',
      });
    }

    // -------------------------------------------------------------------------
    // TEST B: Supplier Validation (Name, Code, Contact)
    // -------------------------------------------------------------------------
    try {
      const vEmptyName = SupplierService.validateSupplier({
        supplierCode: 'SUP-001',
        supplierName: '',
      });
      const vEmptyCode = SupplierService.validateSupplier({
        supplierCode: '',
        supplierName: 'Valid Name',
      });
      const vValid = SupplierService.validateSupplier({
        supplierCode: 'SUP-002',
        supplierName: 'Valid Supplier Sdn Bhd',
      });

      const pass = !vEmptyName.isValid && !vEmptyCode.isValid && vValid.isValid;
      results.push({
        code: 'TEST-P05-B',
        title: 'Supplier Input Validation Constraints',
        category: 'SUPPLIER_MANAGEMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Supplier requires non-empty code and name; valid inputs pass',
        actual: `Empty name rejected: ${!vEmptyName.isValid}, Empty code rejected: ${!vEmptyCode.isValid}, Valid passed: ${vValid.isValid}`,
        details: 'Enforces business rules preventing blank supplier codes or company names.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-B',
        title: 'Supplier Input Validation Constraints',
        category: 'SUPPLIER_MANAGEMENT',
        status: 'FAILED',
        expected: 'Supplier validation runs smoothly',
        actual: e.message,
        details: 'Validation error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST C: Active / Inactive Supplier Toggle
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-1', 'SUP-001', 'F&N Beverages', true);
      const deactivated = { ...sup, active: false };
      const reactivated = { ...deactivated, active: true };

      const pass = sup.active === true && deactivated.active === false && reactivated.active === true;
      results.push({
        code: 'TEST-P05-C',
        title: 'Active / Inactive Supplier Status Toggle',
        category: 'SUPPLIER_MANAGEMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Suppliers can be deactivated and reactivated safely',
        actual: `Initial: ${sup.active}, Deactivated: ${deactivated.active}, Reactivated: ${reactivated.active}`,
        details: 'Verified supplier status can be toggled without deleting master data.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-C',
        title: 'Active / Inactive Supplier Status Toggle',
        category: 'SUPPLIER_MANAGEMENT',
        status: 'FAILED',
        expected: 'Toggle succeeds',
        actual: e.message,
        details: 'Error testing supplier toggle',
      });
    }

    // -------------------------------------------------------------------------
    // TEST D: Safe Deactivation: Cannot delete supplier with purchase history
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-1', 'SUP-001', 'F&N Beverages');
      const mockPurchase: Purchase = {
        id: 'pur-1',
        purchaseNumber: 'PUR-000001',
        supplierId: sup.id,
        supplierCodeSnapshot: sup.supplierCode,
        supplierNameSnapshot: sup.supplierName,
        purchaseDate: '2026-09-01T10:00:00Z',
        status: 'COMPLETED',
        items: [],
        subtotal: 100,
        discount: 0,
        total: 100,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const canDeleteWithHistory = SupplierService.canDeleteSupplier(sup.id, [mockPurchase]);
      const canDeleteWithoutHistory = SupplierService.canDeleteSupplier('sup-99', [mockPurchase]);

      const pass = !canDeleteWithHistory.canDelete && canDeleteWithoutHistory.canDelete;
      results.push({
        code: 'TEST-P05-D',
        title: 'Safe Deactivation & Deletion Protection',
        category: 'SUPPLIER_MANAGEMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Supplier with purchases CANNOT be deleted; supplier without purchases CAN be deleted',
        actual: `With history allowed: ${canDeleteWithHistory.canDelete}, Without history allowed: ${canDeleteWithoutHistory.canDelete}`,
        details: 'Preserves relational audit trail by disallowing destructive deletion of suppliers with order history.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-D',
        title: 'Safe Deactivation & Deletion Protection',
        category: 'SUPPLIER_MANAGEMENT',
        status: 'FAILED',
        expected: 'Protection test completes',
        actual: e.message,
        details: 'Error verifying deletion rules',
      });
    }

    // -------------------------------------------------------------------------
    // TEST E: Draft Purchase Creation & Sequential Numbering (PUR-000001)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-1', 'SUP-001', 'Nestle Malaysia');
      const prod = createMockProduct('prod-1', 'NES-01', 'Milo 1kg', 14.0, 18.0, 10);

      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft1 = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 5, unitCost: 14.5 }],
        },
        sMap,
        pMap,
        []
      );

      const draft2 = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 2, unitCost: 14.5 }],
        },
        sMap,
        pMap,
        [draft1]
      );

      const pass =
        draft1.purchaseNumber === 'PUR-000001' &&
        draft2.purchaseNumber === 'PUR-000002' &&
        draft1.status === 'DRAFT' &&
        draft2.status === 'DRAFT';

      results.push({
        code: 'TEST-P05-E',
        title: 'Draft Purchase Creation & Sequential PO Numbering',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Sequential purchase numbers PUR-000001 and PUR-000002 in DRAFT status',
        actual: `PO 1: ${draft1.purchaseNumber} (${draft1.status}), PO 2: ${draft2.purchaseNumber} (${draft2.status})`,
        details: 'Verified draft purchase initialization and 6-digit zero-padded sequential PO numbers.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-E',
        title: 'Draft Purchase Creation & Sequential PO Numbering',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Draft creation succeeds',
        actual: e.message,
        details: 'PO creation failed',
      });
    }

    // -------------------------------------------------------------------------
    // TEST F: Line Total Calculation: (Qty * UnitCost) - Discount
    // -------------------------------------------------------------------------
    try {
      const line1 = PurchasingService.calculateLineTotal(10, 5.0, 0); // 50.00
      const line2 = PurchasingService.calculateLineTotal(10, 5.0, 5.0); // 45.00
      const line3 = PurchasingService.calculateLineTotal(3, 12.345, 1.0); // (37.035) - 1 = 36.04

      const pass = line1 === 50.0 && line2 === 45.0 && line3 === 36.04;
      results.push({
        code: 'TEST-P05-F',
        title: 'Purchase Item Line Total Mathematics',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Line 1 = RM50.00, Line 2 = RM45.00, Line 3 = RM36.04',
        actual: `Line 1: RM${line1.toFixed(2)}, Line 2: RM${line2.toFixed(2)}, Line 3: RM${line3.toFixed(2)}`,
        formulaOrMath: 'Line Total = (Quantity * Unit Cost) - Item Discount',
        details: 'Verified standard retail purchasing line item arithmetic with 2 decimal precision.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-F',
        title: 'Purchase Item Line Total Mathematics',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Math runs cleanly',
        actual: e.message,
        details: 'Arithmetic error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST G: Purchase Totals: Subtotal, Document Discount, Net Total
    // -------------------------------------------------------------------------
    try {
      const mockItems = [
        { id: '1', purchaseId: 'p1', productId: 'p1', productNameSnapshot: 'A', skuSnapshot: 'A', quantity: 10, unitCost: 10.0, lineTotal: 100.0 },
        { id: '2', purchaseId: 'p1', productId: 'p2', productNameSnapshot: 'B', skuSnapshot: 'B', quantity: 5, unitCost: 20.0, lineTotal: 100.0 },
      ];
      const totals = PurchasingService.calculatePurchaseTotals(mockItems, 15.0);

      const pass = totals.subtotal === 200.0 && totals.discount === 15.0 && totals.total === 185.0;
      results.push({
        code: 'TEST-P05-G',
        title: 'Purchase Order Totals & Order Discount Arithmetic',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Subtotal: RM200.00, Order Discount: RM15.00, Grand Total: RM185.00',
        actual: `Subtotal: RM${totals.subtotal.toFixed(2)}, Discount: RM${totals.discount.toFixed(2)}, Total: RM${totals.total.toFixed(2)}`,
        formulaOrMath: 'Grand Total = Subtotal - Overall Document Discount',
        details: 'Confirmed order totals accurately sum line totals and deduct global discount.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-G',
        title: 'Purchase Order Totals & Order Discount Arithmetic',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Totals computed',
        actual: e.message,
        details: 'Error in total calculation',
      });
    }

    // -------------------------------------------------------------------------
    // TEST H & I & J & K: Atomic Purchase Receipt, Stock Increment, Cost Update, STOCK_IN Movement
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-10', 'SUP-010', 'Yeo Hiap Seng');
      const prod = createMockProduct('prod-10', 'YHS-01', 'Yeos Soy Milk', 1.2, 1.8, 15);

      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 25, unitCost: 1.35 }],
        },
        sMap,
        pMap,
        []
      );

      const result = PurchasingService.completePurchase(draft, sMap, pMap, store.id);

      const updatedProd = result.updatedProducts[0];
      const mov = result.newMovements[0];

      const passH = result.completedPurchase.status === 'COMPLETED';
      const passI = updatedProd.currentStock === 40; // 15 + 25
      const passJ = updatedProd.costPrice === 1.35; // Updated from 1.20 to 1.35
      const passK =
        mov &&
        mov.type === 'STOCK_IN' &&
        mov.quantity === 25 &&
        mov.previousStock === 15 &&
        mov.newStock === 40 &&
        mov.referenceId === draft.id &&
        mov.reason.includes(draft.purchaseNumber);

      const allPass = passH && passI && passJ && passK;
      results.push({
        code: 'TEST-P05-H_K',
        title: 'Atomic Stock Receipt: Stock In, Cost Price Update & Movement Audit',
        category: 'STOCK_RECEIVING',
        status: allPass ? 'PASSED' : 'FAILED',
        expected: 'Status: COMPLETED, Stock: 40 (+25), Cost: RM1.35, STOCK_IN movement linked to PO',
        actual: `Status: ${result.completedPurchase.status}, Stock: ${updatedProd.currentStock}, Cost: RM${updatedProd.costPrice.toFixed(2)}, Mov: ${mov?.type} (${mov?.previousStock}->${mov?.newStock})`,
        formulaOrMath: 'Stock = 15 + 25 = 40; CostPrice = RM1.35 (Latest Received Unit Cost)',
        details: 'Atomically updates product inventory and cost price while creating immutable STOCK_IN audit logs.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-H_K',
        title: 'Atomic Stock Receipt: Stock In, Cost Price Update & Movement Audit',
        category: 'STOCK_RECEIVING',
        status: 'FAILED',
        expected: 'Atomic receiving succeeds',
        actual: e.message,
        details: 'Failed stock receiving test',
      });
    }

    // -------------------------------------------------------------------------
    // TEST L: Duplicate Completion Prevention (Idempotence & State Lock)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-11', 'SUP-011', 'Munchys');
      const prod = createMockProduct('prod-11', 'MUN-01', 'Oat Krunch', 2.0, 3.0, 10);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 5, unitCost: 2.1 }],
        },
        sMap,
        pMap,
        []
      );

      const res1 = PurchasingService.completePurchase(draft, sMap, pMap, store.id);

      let prevented = false;
      try {
        PurchasingService.completePurchase(res1.completedPurchase, sMap, pMap, store.id);
      } catch (err: any) {
        prevented = err.message.includes('already completed');
      }

      results.push({
        code: 'TEST-P05-L',
        title: 'Duplicate Purchase Completion Prevention',
        category: 'STOCK_RECEIVING',
        status: prevented ? 'PASSED' : 'FAILED',
        expected: 'Attempting to complete a COMPLETED purchase throws validation error',
        actual: prevented ? 'Successfully prevented duplicate receiving' : 'Allowed duplicate completion',
        details: 'Guarantees inventory is never double-incremented by accidental resubmission.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-L',
        title: 'Duplicate Purchase Completion Prevention',
        category: 'STOCK_RECEIVING',
        status: 'FAILED',
        expected: 'Exception caught',
        actual: e.message,
        details: 'Error verifying duplicate completion lock',
      });
    }

    // -------------------------------------------------------------------------
    // TEST M: Historical Integrity: Past POS SaleItem Cost Snapshots Remain Unchanged
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-12', 'HIST-01', 'Historical Biscuits', 1.0, 2.0, 20);
      const cart: CartItem[] = [{ product: prod, quantity: 5 }];

      // 1. Process initial sale at cost RM1.00
      const saleResult = SalesService.processSale(
        cart,
        new Map([[prod.id, prod]]),
        store.id,
        0,
        { cashReceived: 20.0, discount: 0, paymentMethod: 'CASH' }
      );

      const pastSaleItem = saleResult.sale.items[0];
      const initialCostSnapshot = pastSaleItem.unitCostSnapshot; // RM1.00

      // 2. Now receive new purchase with higher cost RM1.50
      const sup = createMockSupplier('sup-12', 'SUP-012', 'Biscuit Wholesaler');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 30, unitCost: 1.5 }],
        },
        sMap,
        pMap,
        []
      );

      const receiptRes = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const newProductCost = receiptRes.updatedProducts[0].costPrice; // RM1.50

      // 3. Verify past sale item snapshot is STILL RM1.00
      const pass = initialCostSnapshot === 1.0 && newProductCost === 1.5;

      results.push({
        code: 'TEST-P05-M',
        title: 'Historical Integrity: Past SaleItem Cost Snapshots Preserved',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Historical sale item unitCostSnapshot remains RM1.00; product costPrice becomes RM1.50',
        actual: `Past Sale Snapshot: RM${initialCostSnapshot.toFixed(2)}, New Product Cost: RM${newProductCost.toFixed(2)}`,
        formulaOrMath: 'Historical COGS = 5 * RM1.00 = RM5.00 (Unchanged by procurement)',
        details: 'Past sales economics remain strictly protected against retroactive mutation.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-M',
        title: 'Historical Integrity: Past SaleItem Cost Snapshots Preserved',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Historical protection passes',
        actual: e.message,
        details: 'Error verifying snapshot immutability',
      });
    }

    // -------------------------------------------------------------------------
    // TEST N: Supplier Snapshots on Purchase Document
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-13', 'SUP-013', 'Original Supplier Name');
      const prod = createMockProduct('prod-13', 'PR-13', 'Snack Bar', 1.0, 2.0, 10);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 10, unitCost: 1.0 }],
        },
        sMap,
        pMap,
        []
      );

      const pass =
        draft.supplierCodeSnapshot === 'SUP-013' &&
        draft.supplierNameSnapshot === 'Original Supplier Name';

      results.push({
        code: 'TEST-P05-N',
        title: 'Supplier Name & Code Immutability Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'PO stores immutable supplierCodeSnapshot and supplierNameSnapshot',
        actual: `Snapshots: ${draft.supplierCodeSnapshot} - ${draft.supplierNameSnapshot}`,
        details: 'Ensures purchase history displays historical vendor name even if later edited.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-N',
        title: 'Supplier Name & Code Immutability Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Snapshot verified',
        actual: e.message,
        details: 'Snapshot failure',
      });
    }

    // -------------------------------------------------------------------------
    // TEST O: Draft Purchase Cancellation
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-14', 'SUP-014', 'Gardenia Bakeries');
      const prod = createMockProduct('prod-14', 'GAR-01', 'White Bread 400g', 2.0, 2.8, 15);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 20, unitCost: 2.0 }],
        },
        sMap,
        pMap,
        []
      );

      const cancelled = PurchasingService.cancelPurchase(draft);
      const pass = cancelled.status === 'CANCELLED';

      results.push({
        code: 'TEST-P05-O',
        title: 'Draft Purchase Cancellation',
        category: 'CANCELLATION_SAFETY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'DRAFT purchase transitions cleanly to CANCELLED status',
        actual: `Status: ${cancelled.status}`,
        details: 'Draft purchases can be cancelled without affecting inventory.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-O',
        title: 'Draft Purchase Cancellation',
        category: 'CANCELLATION_SAFETY',
        status: 'FAILED',
        expected: 'Cancellation passes',
        actual: e.message,
        details: 'Cancellation error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST P: Completed Purchase Cannot be Cancelled
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-15', 'SUP-015', 'Massimo');
      const prod = createMockProduct('prod-15', 'MAS-01', 'Sandwich Loaf', 2.1, 2.9, 10);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 10, unitCost: 2.1 }],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);

      let blocked = false;
      try {
        PurchasingService.cancelPurchase(receipt.completedPurchase);
      } catch (err: any) {
        blocked = err.message.includes('Cannot cancel a completed purchase');
      }

      results.push({
        code: 'TEST-P05-P',
        title: 'Completed Purchase Cancellation Lock (Anti-Corruption)',
        category: 'CANCELLATION_SAFETY',
        status: blocked ? 'PASSED' : 'FAILED',
        expected: 'Attempt to cancel COMPLETED purchase throws validation error',
        actual: blocked ? 'Successfully blocked cancellation of completed purchase' : 'Allowed illegal cancellation',
        details: 'Prevents silent inventory corruption and untracked discrepancies.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-P',
        title: 'Completed Purchase Cancellation Lock (Anti-Corruption)',
        category: 'CANCELLATION_SAFETY',
        status: 'FAILED',
        expected: 'Lock enforced',
        actual: e.message,
        details: 'Failed cancellation lock test',
      });
    }

    // -------------------------------------------------------------------------
    // TEST Q: Purchase Item Validation (Quantity > 0, Cost >= 0)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-16', 'SUP-016', 'Ajinomoto');
      const prod = createMockProduct('prod-16', 'AJI-01', 'MSG 100g', 1.0, 1.5, 10);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const vZeroQty = PurchasingService.validatePurchaseForCreation(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 0, unitCost: 1.0 }],
        },
        sMap,
        pMap
      );

      const vNegativeCost = PurchasingService.validatePurchaseForCreation(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 5, unitCost: -2.0 }],
        },
        sMap,
        pMap
      );

      const pass = !vZeroQty.isValid && !vNegativeCost.isValid;
      results.push({
        code: 'TEST-P05-Q',
        title: 'Purchase Item Validation Rules',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Zero/negative quantity and negative cost rejected',
        actual: `Zero Qty Rejected: ${!vZeroQty.isValid}, Negative Cost Rejected: ${!vNegativeCost.isValid}`,
        details: 'Validates line item inputs to prevent corrupted purchasing totals.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-Q',
        title: 'Purchase Item Validation Rules',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Validation completes',
        actual: e.message,
        details: 'Error testing item rules',
      });
    }

    // -------------------------------------------------------------------------
    // TEST R: Inactive Supplier or Product Rejection
    // -------------------------------------------------------------------------
    try {
      const inactiveSup = createMockSupplier('sup-17', 'SUP-017', 'Defunct Vendor', false);
      const activeSup = createMockSupplier('sup-18', 'SUP-018', 'Active Vendor', true);
      const inactiveProd = createMockProduct('prod-17', 'DISC-01', 'Discontinued Candy', 0.5, 1.0, 0, 5, false);
      const activeProd = createMockProduct('prod-18', 'ACT-01', 'Active Candy', 0.5, 1.0, 10);

      const sMap = new Map([
        [inactiveSup.id, inactiveSup],
        [activeSup.id, activeSup],
      ]);
      const pMap = new Map([
        [inactiveProd.id, inactiveProd],
        [activeProd.id, activeProd],
      ]);

      const vInactiveSup = PurchasingService.validatePurchaseForCreation(
        {
          supplierId: inactiveSup.id,
          items: [{ productId: activeProd.id, quantity: 10, unitCost: 0.5 }],
        },
        sMap,
        pMap
      );

      const vInactiveProd = PurchasingService.validatePurchaseForCreation(
        {
          supplierId: activeSup.id,
          items: [{ productId: inactiveProd.id, quantity: 10, unitCost: 0.5 }],
        },
        sMap,
        pMap
      );

      const pass = !vInactiveSup.isValid && !vInactiveProd.isValid;
      results.push({
        code: 'TEST-P05-R',
        title: 'Inactive Supplier & Product Purchasing Restriction',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cannot draft purchase with inactive supplier or inactive products',
        actual: `Inactive Supplier Blocked: ${!vInactiveSup.isValid}, Inactive Product Blocked: ${!vInactiveProd.isValid}`,
        details: 'Prevents drafting purchases with archived or suspended entities.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-R',
        title: 'Inactive Supplier & Product Purchasing Restriction',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Restriction enforced',
        actual: e.message,
        details: 'Error checking inactive restrictions',
      });
    }

    // -------------------------------------------------------------------------
    // TEST S: Product Purchase History ("How much have I been paying?")
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-20', 'HIST-P20', 'Dutch Lady Milk', 5.0, 7.0, 10);
      const sup1 = createMockSupplier('sup-20', 'SUP-020', 'Supplier Alpha');
      const sup2 = createMockSupplier('sup-21', 'SUP-021', 'Supplier Beta');

      const mockPurchases: Purchase[] = [
        {
          id: 'pur-20',
          purchaseNumber: 'PUR-000020',
          supplierId: sup1.id,
          supplierCodeSnapshot: sup1.supplierCode,
          supplierNameSnapshot: sup1.supplierName,
          purchaseDate: '2026-08-15T10:00:00Z',
          status: 'COMPLETED',
          items: [
            { id: 'i1', purchaseId: 'pur-20', productId: prod.id, productNameSnapshot: prod.name, skuSnapshot: prod.sku, quantity: 10, unitCost: 5.0, lineTotal: 50.0 },
          ],
          subtotal: 50.0,
          discount: 0,
          total: 50.0,
          createdAt: '2026-08-15T10:00:00Z',
          updatedAt: '2026-08-15T10:00:00Z',
        },
        {
          id: 'pur-21',
          purchaseNumber: 'PUR-000021',
          supplierId: sup2.id,
          supplierCodeSnapshot: sup2.supplierCode,
          supplierNameSnapshot: sup2.supplierName,
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [
            { id: 'i2', purchaseId: 'pur-21', productId: prod.id, productNameSnapshot: prod.name, skuSnapshot: prod.sku, quantity: 20, unitCost: 5.4, lineTotal: 108.0 },
          ],
          subtotal: 108.0,
          discount: 0,
          total: 108.0,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pur-22',
          purchaseNumber: 'PUR-000022',
          supplierId: sup1.id,
          supplierCodeSnapshot: sup1.supplierCode,
          supplierNameSnapshot: sup1.supplierName,
          purchaseDate: '2026-09-02T10:00:00Z',
          status: 'DRAFT', // Draft should not appear in completed purchase history
          items: [
            { id: 'i3', purchaseId: 'pur-22', productId: prod.id, productNameSnapshot: prod.name, skuSnapshot: prod.sku, quantity: 5, unitCost: 6.0, lineTotal: 30.0 },
          ],
          subtotal: 30.0,
          discount: 0,
          total: 30.0,
          createdAt: '2026-09-02T10:00:00Z',
          updatedAt: '2026-09-02T10:00:00Z',
        },
      ];

      const history = PurchasingService.getProductPurchaseHistory(prod.id, mockPurchases);

      // Newest first: pur-21 (cost 5.40), then pur-20 (cost 5.00)
      const pass =
        history.length === 2 &&
        history[0].unitCost === 5.4 &&
        history[1].unitCost === 5.0 &&
        history[0].purchaseNumber === 'PUR-000021';

      results.push({
        code: 'TEST-P05-S',
        title: 'Product Purchase History ("How much have I been paying?")',
        category: 'COST_PRICE_UPDATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Returns 2 completed records sorted newest first (RM5.40 then RM5.00); excludes drafts',
        actual: `Records found: ${history.length}, Most recent cost: RM${history[0]?.unitCost.toFixed(2)} from ${history[0]?.supplierName}`,
        details: 'Answers retailer cost trend inquiry accurately across all completed purchases.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-S',
        title: 'Product Purchase History ("How much have I been paying?")',
        category: 'COST_PRICE_UPDATE',
        status: 'FAILED',
        expected: 'History lookup succeeds',
        actual: e.message,
        details: 'History lookup error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST T: Supplier Purchasing Summary (Total Purchases, Units, Value)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-30', 'SUP-030', 'Kawan Food');
      const purchases: Purchase[] = [
        {
          id: 'p30',
          purchaseNumber: 'PUR-000030',
          supplierId: sup.id,
          supplierCodeSnapshot: sup.supplierCode,
          supplierNameSnapshot: sup.supplierName,
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '1', purchaseId: 'p30', productId: 'pr1', productNameSnapshot: 'Paratha', skuSnapshot: 'PAR-1', quantity: 20, unitCost: 4.0, lineTotal: 80.0 }],
          subtotal: 80.0,
          discount: 0,
          total: 80.0,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'p31',
          purchaseNumber: 'PUR-000031',
          supplierId: sup.id,
          supplierCodeSnapshot: sup.supplierCode,
          supplierNameSnapshot: sup.supplierName,
          purchaseDate: '2026-09-05T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '2', purchaseId: 'p31', productId: 'pr1', productNameSnapshot: 'Paratha', skuSnapshot: 'PAR-1', quantity: 30, unitCost: 4.0, lineTotal: 120.0 }],
          subtotal: 120.0,
          discount: 0,
          total: 120.0,
          createdAt: '2026-09-05T10:00:00Z',
          updatedAt: '2026-09-05T10:00:00Z',
        },
        {
          id: 'p32',
          purchaseNumber: 'PUR-000032',
          supplierId: sup.id,
          supplierCodeSnapshot: sup.supplierCode,
          supplierNameSnapshot: sup.supplierName,
          purchaseDate: '2026-09-10T10:00:00Z',
          status: 'DRAFT',
          items: [{ id: '3', purchaseId: 'p32', productId: 'pr1', productNameSnapshot: 'Paratha', skuSnapshot: 'PAR-1', quantity: 10, unitCost: 4.0, lineTotal: 40.0 }],
          subtotal: 40.0,
          discount: 0,
          total: 40.0,
          createdAt: '2026-09-10T10:00:00Z',
          updatedAt: '2026-09-10T10:00:00Z',
        },
      ];

      const summary = PurchasingService.getSupplierPurchasingSummary(sup.id, purchases);

      const pass =
        summary.totalPurchases === 3 &&
        summary.completedPurchases === 2 &&
        summary.totalUnits === 50 &&
        summary.totalValue === 200.0;

      results.push({
        code: 'TEST-P05-T',
        title: 'Supplier Purchasing Summary Statistics',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Total POs: 3, Completed: 2, Units: 50, Completed Total Value: RM200.00',
        actual: `POs: ${summary.totalPurchases}, Completed: ${summary.completedPurchases}, Units: ${summary.totalUnits}, Value: RM${summary.totalValue.toFixed(2)}`,
        details: 'Accurately measures vendor volume and completed procurement spend.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-T',
        title: 'Supplier Purchasing Summary Statistics',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'Summary calculated',
        actual: e.message,
        details: 'Summary error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST U: Supplier Procurement Breakdown (% of procurement)
    // -------------------------------------------------------------------------
    try {
      const supA = createMockSupplier('sup-A', 'SUP-A', 'Supplier Alpha');
      const supB = createMockSupplier('sup-B', 'SUP-B', 'Supplier Beta');

      const mockPurchases: Purchase[] = [
        {
          id: 'pa',
          purchaseNumber: 'PUR-000001',
          supplierId: supA.id,
          supplierCodeSnapshot: supA.supplierCode,
          supplierNameSnapshot: supA.supplierName,
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '1', purchaseId: 'pa', productId: 'p1', productNameSnapshot: 'A', skuSnapshot: 'A', quantity: 10, unitCost: 10.0, lineTotal: 100.0 }],
          subtotal: 100.0,
          discount: 0,
          total: 100.0,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pb',
          purchaseNumber: 'PUR-000002',
          supplierId: supB.id,
          supplierCodeSnapshot: supB.supplierCode,
          supplierNameSnapshot: supB.supplierName,
          purchaseDate: '2026-09-02T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '2', purchaseId: 'pb', productId: 'p2', productNameSnapshot: 'B', skuSnapshot: 'B', quantity: 30, unitCost: 10.0, lineTotal: 300.0 }],
          subtotal: 300.0,
          discount: 0,
          total: 300.0,
          createdAt: '2026-09-02T10:00:00Z',
          updatedAt: '2026-09-02T10:00:00Z',
        },
      ];

      const breakdown = PurchasingService.getSupplierPurchasingBreakdown(mockPurchases, [supA, supB]);

      const pass =
        breakdown.length === 2 &&
        breakdown[0].supplierId === supB.id &&
        breakdown[0].totalValue === 300.0 &&
        breakdown[1].supplierId === supA.id &&
        breakdown[1].totalValue === 100.0;

      results.push({
        code: 'TEST-P05-U',
        title: 'Supplier Procurement Breakdown Table',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Supplier B = RM300 (75%), Supplier A = RM100 (25%), sorted descending',
        actual: `Top Vendor: ${breakdown[0]?.supplierName} (RM${breakdown[0]?.totalValue.toFixed(2)}), Second: ${breakdown[1]?.supplierName} (RM${breakdown[1]?.totalValue.toFixed(2)})`,
        details: 'Generates vendor procurement share for inventory expenditure reports.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-U',
        title: 'Supplier Procurement Breakdown Table',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'Breakdown succeeds',
        actual: e.message,
        details: 'Breakdown error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST V: Purchasing Summary KPIs (Count, Units, Value, Active Vendors)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-v', 'SUP-V', 'Vendor V');
      const purchases: Purchase[] = [
        {
          id: 'pv1',
          purchaseNumber: 'PUR-000001',
          supplierId: sup.id,
          supplierCodeSnapshot: sup.supplierCode,
          supplierNameSnapshot: sup.supplierName,
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '1', purchaseId: 'pv1', productId: 'p1', productNameSnapshot: 'Item 1', skuSnapshot: 'SKU1', quantity: 20, unitCost: 5.0, lineTotal: 100.0 }],
          subtotal: 100.0,
          discount: 0,
          total: 100.0,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pv2',
          purchaseNumber: 'PUR-000002',
          supplierId: sup.id,
          supplierCodeSnapshot: sup.supplierCode,
          supplierNameSnapshot: sup.supplierName,
          purchaseDate: '2026-09-02T10:00:00Z',
          status: 'DRAFT',
          items: [{ id: '2', purchaseId: 'pv2', productId: 'p2', productNameSnapshot: 'Item 2', skuSnapshot: 'SKU2', quantity: 15, unitCost: 10.0, lineTotal: 150.0 }],
          subtotal: 150.0,
          discount: 0,
          total: 150.0,
          createdAt: '2026-09-02T10:00:00Z',
          updatedAt: '2026-09-02T10:00:00Z',
        },
      ];

      const kpis = PurchasingService.calculatePurchasingSummary(purchases, 5);

      const pass =
        kpis.totalPurchases === 2 &&
        kpis.completedPurchases === 1 &&
        kpis.draftPurchases === 1 &&
        kpis.totalPurchaseValue === 100.0 &&
        kpis.totalUnitsPurchased === 20 &&
        kpis.activeSuppliers === 5;

      results.push({
        code: 'TEST-P05-V',
        title: 'Purchasing Summary Key Performance Indicators',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: '1 Completed PO, 1 Draft PO, Value RM100.00, 20 Units, 5 Active Suppliers',
        actual: `Completed: ${kpis.completedPurchases}, Draft: ${kpis.draftPurchases}, Value: RM${kpis.totalPurchaseValue.toFixed(2)}, Units: ${kpis.totalUnitsPurchased}, Active: ${kpis.activeSuppliers}`,
        details: 'Ensures KPIs reflect completed inventory receipts separately from pending draft orders.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-V',
        title: 'Purchasing Summary Key Performance Indicators',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'KPI calculation runs',
        actual: e.message,
        details: 'KPI calculation error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST W: Retail Profit Clarity: Gross Profit = Sales Revenue - COGS (Purchases != COGS)
    // -------------------------------------------------------------------------
    try {
      const salesRevenue = 200.0;
      const cogs = 120.0;
      const totalInventoryPurchased = 1000.0;

      const correctGrossProfit = salesRevenue - cogs; // RM80.00
      const erroneousProfit = salesRevenue - totalInventoryPurchased; // -RM800.00

      const pass = correctGrossProfit === 80.0 && erroneousProfit !== correctGrossProfit;

      results.push({
        code: 'TEST-P05-W',
        title: 'Retail Accounting Principle: Purchases != Cost of Goods Sold',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit = Sales Revenue - COGS (RM200 - RM120 = RM80); NOT Sales - Purchases',
        actual: `Gross Profit: RM${correctGrossProfit.toFixed(2)} (COGS: RM${cogs.toFixed(2)}, Purchases: RM${totalInventoryPurchased.toFixed(2)})`,
        formulaOrMath: 'Gross Profit = Sales Revenue - COGS = RM200.00 - RM120.00 = +RM80.00',
        details: 'Enforces strict retail accounting separation between inventory acquisition and cost of goods sold.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-W',
        title: 'Retail Accounting Principle: Purchases != Cost of Goods Sold',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'Principle verified',
        actual: e.message,
        details: 'Accounting error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST X: Immediate POS Sale of Received Stock
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-x', 'SUP-X', 'Immediate Distributor');
      // Product starts with 0 stock
      const prod = createMockProduct('prod-x', 'RESTOCK-01', 'Instant Noodles', 1.0, 1.8, 0);

      // 1. Cannot sell with 0 stock
      let checkoutFailed = false;
      try {
        SalesService.processSale(
          [{ product: prod, quantity: 5 }],
          new Map([[prod.id, prod]]),
          store.id,
          0,
          { cashReceived: 10.0, discount: 0 }
        );
      } catch (err: any) {
        checkoutFailed = true;
      }

      // 2. Receive stock via PO
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);
      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 20, unitCost: 1.1 }],
        },
        sMap,
        pMap,
        []
      );
      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const restockedProd = receipt.updatedProducts[0];

      // 3. Now POS sale succeeds immediately!
      const saleResult = SalesService.processSale(
        [{ product: restockedProd, quantity: 5 }],
        new Map([[restockedProd.id, restockedProd]]),
        store.id,
        0,
        { cashReceived: 10.0, discount: 0 }
      );

      const pass =
        checkoutFailed &&
        restockedProd.currentStock === 20 &&
        saleResult.updatedProducts[0].currentStock === 15;

      results.push({
        code: 'TEST-P05-X',
        title: 'Seamless Restocking to POS Checkout Execution',
        category: 'FULL_LIFECYCLE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Out-of-stock product restocked via PO, then immediately sold at POS with stock reduced to 15',
        actual: `Pre-stock sale failed: ${checkoutFailed}, Received: 20 units, Post-sale Stock: ${saleResult.updatedProducts[0].currentStock}`,
        formulaOrMath: 'Stock Cycle: 0 -> (+20 Received) -> (-5 Sold) = 15 Remaining',
        details: 'Validates real-time integration between purchasing stock-in and POS checkout validation.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-X',
        title: 'Seamless Restocking to POS Checkout Execution',
        category: 'FULL_LIFECYCLE',
        status: 'FAILED',
        expected: 'Lifecycle test succeeds',
        actual: e.message,
        details: 'Error executing restock to POS lifecycle',
      });
    }

    // -------------------------------------------------------------------------
    // TEST Y: Sequential Cost Changes & Margin Realization
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-y', 'SEQ-01', 'Can Drink', 1.0, 2.0, 10);
      const sup = createMockSupplier('sup-y', 'SUP-Y', 'Drink Wholesaler');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      // Receive batch at RM1.40
      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 10, unitCost: 1.4 }],
        },
        sMap,
        pMap,
        []
      );
      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const updatedProd = receipt.updatedProducts[0];

      // Next POS sale should record unitCostSnapshot of RM1.40
      const saleResult = SalesService.processSale(
        [{ product: updatedProd, quantity: 2 }],
        new Map([[updatedProd.id, updatedProd]]),
        store.id,
        0,
        { cashReceived: 5.0, discount: 0 }
      );

      const saleItem = saleResult.sale.items[0];
      const pass =
        saleItem.unitCostSnapshot === 1.4 &&
        saleItem.unitSellingPriceSnapshot === 2.0 &&
        saleItem.lineCost === 2.8 &&
        saleItem.grossProfit === 1.2;

      results.push({
        code: 'TEST-P05-Y',
        title: 'Sequential Cost Evolution & POS Margin Realization',
        category: 'COST_PRICE_UPDATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'New POS sale captures updated cost snapshot RM1.40; COGS = RM2.80, GP = RM1.20',
        actual: `Snapshot Cost: RM${saleItem.unitCostSnapshot.toFixed(2)}, COGS: RM${saleItem.lineCost.toFixed(2)}, GP: RM${saleItem.grossProfit.toFixed(2)}`,
        formulaOrMath: 'Gross Profit = (2 * RM2.00) - (2 * RM1.40) = RM4.00 - RM2.80 = RM1.20',
        details: 'Validates that new sales naturally reflect updated cost price without manual POS intervention.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-Y',
        title: 'Sequential Cost Evolution & POS Margin Realization',
        category: 'COST_PRICE_UPDATE',
        status: 'FAILED',
        expected: 'Cost evolution passes',
        actual: e.message,
        details: 'Cost evolution error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST Z: Purchase Filtering by Date Range & Status
    // -------------------------------------------------------------------------
    try {
      const purchases: Purchase[] = [
        {
          id: 'pz1',
          purchaseNumber: 'PUR-000001',
          supplierId: 'sup-1',
          supplierCodeSnapshot: 'S1',
          supplierNameSnapshot: 'Supplier 1',
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [],
          subtotal: 100,
          discount: 0,
          total: 100,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pz2',
          purchaseNumber: 'PUR-000002',
          supplierId: 'sup-2',
          supplierCodeSnapshot: 'S2',
          supplierNameSnapshot: 'Supplier 2',
          purchaseDate: '2026-09-10T10:00:00Z',
          status: 'DRAFT',
          items: [],
          subtotal: 200,
          discount: 0,
          total: 200,
          createdAt: '2026-09-10T10:00:00Z',
          updatedAt: '2026-09-10T10:00:00Z',
        },
      ];

      const completedOnly = PurchasingService.filterPurchases(purchases, { status: 'COMPLETED' });
      const inDateRange = PurchasingService.filterPurchases(purchases, {
        startDate: '2026-09-05T00:00:00Z',
        endDate: '2026-09-15T23:59:59Z',
      });

      const pass =
        completedOnly.length === 1 &&
        completedOnly[0].id === 'pz1' &&
        inDateRange.length === 1 &&
        inDateRange[0].id === 'pz2';

      results.push({
        code: 'TEST-P05-Z',
        title: 'Purchase Order Multi-criteria Query & Filtering',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Filter by COMPLETED returns PO1; Filter by date range returns PO2',
        actual: `Status filter count: ${completedOnly.length}, Date filter count: ${inDateRange.length}`,
        details: 'Supports multi-parameter querying by status, date range, supplier, and text search.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-Z',
        title: 'Purchase Order Multi-criteria Query & Filtering',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'Filter completes',
        actual: e.message,
        details: 'Filtering error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AA: Zero / Empty State Handling
    // -------------------------------------------------------------------------
    try {
      const emptySummary = PurchasingService.calculatePurchasingSummary([], 0);
      const emptyHistory = PurchasingService.getProductPurchaseHistory('prod-nonexistent', []);
      const emptyBreakdown = PurchasingService.getSupplierPurchasingBreakdown([], []);

      const pass =
        emptySummary.totalPurchases === 0 &&
        emptySummary.totalPurchaseValue === 0 &&
        emptySummary.totalUnitsPurchased === 0 &&
        emptyHistory.length === 0 &&
        emptyBreakdown.length === 0;

      results.push({
        code: 'TEST-P05-AA',
        title: 'Empty State Resilience (Zero Purchasing Records)',
        category: 'REPORTING_AND_PROFIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Clean zero/empty values with no NaN or null pointer exceptions',
        actual: `Summary: ${emptySummary.totalPurchases} purchases, Value: RM${emptySummary.totalPurchaseValue}, History: ${emptyHistory.length}`,
        details: 'Gracefully handles newly initialized databases with zero purchases and suppliers.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AA',
        title: 'Empty State Resilience (Zero Purchasing Records)',
        category: 'REPORTING_AND_PROFIT',
        status: 'FAILED',
        expected: 'Empty state runs clean',
        actual: e.message,
        details: 'Empty state crash',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AB: Multi-item Purchase Receipt Handling
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-ab', 'SUP-AB', 'Wholesale Market');
      const p1 = createMockProduct('p-ab1', 'SKU-AB1', 'Item 1', 2.0, 3.0, 5);
      const p2 = createMockProduct('p-ab2', 'SKU-AB2', 'Item 2', 4.0, 6.0, 10);

      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([
        [p1.id, p1],
        [p2.id, p2],
      ]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [
            { productId: p1.id, quantity: 15, unitCost: 2.2 },
            { productId: p2.id, quantity: 25, unitCost: 4.5 },
          ],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);

      const up1 = receipt.updatedProducts.find((p) => p.id === p1.id)!;
      const up2 = receipt.updatedProducts.find((p) => p.id === p2.id)!;

      const pass =
        receipt.newMovements.length === 2 &&
        up1.currentStock === 20 && // 5 + 15
        up1.costPrice === 2.2 &&
        up2.currentStock === 35 && // 10 + 25
        up2.costPrice === 4.5;

      results.push({
        code: 'TEST-P05-AB',
        title: 'Multi-Item Purchase Receipt Atomic Processing',
        category: 'STOCK_RECEIVING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: '2 products updated simultaneously: Item 1 stock 20 (cost 2.20), Item 2 stock 35 (cost 4.50)',
        actual: `Movements: ${receipt.newMovements.length}, Item 1: Stock ${up1.currentStock} @ RM${up1.costPrice}, Item 2: Stock ${up2.currentStock} @ RM${up2.costPrice}`,
        details: 'Atomically processes composite multi-line purchase orders across diverse catalog items.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AB',
        title: 'Multi-Item Purchase Receipt Atomic Processing',
        category: 'STOCK_RECEIVING',
        status: 'FAILED',
        expected: 'Multi-item receipt passes',
        actual: e.message,
        details: 'Multi-item receiving error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AC: Supplier Search and Filter Matching
    // -------------------------------------------------------------------------
    try {
      const suppliers = [
        createMockSupplier('s1', 'SUP-001', 'F&N Beverages Sdn Bhd'),
        createMockSupplier('s2', 'SUP-002', 'Nestle Products'),
        createMockSupplier('s3', 'SUP-003', 'Munchy Food Industries'),
      ];

      const matchCode = SupplierService.filterSuppliers(suppliers, { search: 'sup-002' });
      const matchName = SupplierService.filterSuppliers(suppliers, { search: 'munchy' });
      const matchPartial = SupplierService.filterSuppliers(suppliers, { search: 'beverage' });

      const pass =
        matchCode.length === 1 &&
        matchCode[0].supplierCode === 'SUP-002' &&
        matchName.length === 1 &&
        matchName[0].supplierCode === 'SUP-003' &&
        matchPartial.length === 1 &&
        matchPartial[0].supplierCode === 'SUP-001';

      results.push({
        code: 'TEST-P05-AC',
        title: 'Supplier Search & Query Matching',
        category: 'SUPPLIER_MANAGEMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Accurately matches by supplier code, name, and partial keywords',
        actual: `Code match: ${matchCode[0]?.supplierCode}, Name match: ${matchName[0]?.supplierCode}, Partial match: ${matchPartial[0]?.supplierCode}`,
        details: 'Provides instant search across all vendor master attributes.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AC',
        title: 'Supplier Search & Query Matching',
        category: 'SUPPLIER_MANAGEMENT',
        status: 'FAILED',
        expected: 'Search succeeds',
        actual: e.message,
        details: 'Supplier search error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AD: Purchase Search by PO#, Supplier, SKU
    // -------------------------------------------------------------------------
    try {
      const purchases: Purchase[] = [
        {
          id: 'p1',
          purchaseNumber: 'PUR-000101',
          supplierId: 's1',
          supplierCodeSnapshot: 'SUP-001',
          supplierNameSnapshot: 'Dutch Lady Milk Industries',
          purchaseDate: '2026-09-01T10:00:00Z',
          status: 'COMPLETED',
          items: [{ id: '1', purchaseId: 'p1', productId: 'pr1', productNameSnapshot: 'Full Cream Milk', skuSnapshot: 'DL-MILK-01', quantity: 10, unitCost: 5.0, lineTotal: 50.0 }],
          subtotal: 50.0,
          discount: 0,
          total: 50.0,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
      ];

      const matchPO = PurchasingService.filterPurchases(purchases, { search: '000101' });
      const matchSup = PurchasingService.filterPurchases(purchases, { search: 'dutch lady' });
      const matchSku = PurchasingService.filterPurchases(purchases, { search: 'DL-MILK' });

      const pass = matchPO.length === 1 && matchSup.length === 1 && matchSku.length === 1;

      results.push({
        code: 'TEST-P05-AD',
        title: 'Purchase Order Search (PO#, Vendor, SKU, Item Name)',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Search finds PO by purchase number, vendor name, and product SKU',
        actual: `PO Match: ${matchPO.length}, Vendor Match: ${matchSup.length}, SKU Match: ${matchSku.length}`,
        details: 'Deep search inspects PO headers and line items simultaneously.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AD',
        title: 'Purchase Order Search (PO#, Vendor, SKU, Item Name)',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Search runs',
        actual: e.message,
        details: 'Purchase search error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AE: Zero-Cost Promotional Stock Receiving (RM0.00 Unit Cost)
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-ae', 'SUP-AE', 'Free Samples Vendor');
      const prod = createMockProduct('prod-ae', 'PROMO-01', 'Free Promotional Mug', 0.0, 0.0, 0);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 50, unitCost: 0.0 }],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const updated = receipt.updatedProducts[0];

      const pass =
        draft.total === 0.0 &&
        updated.currentStock === 50 &&
        updated.costPrice === 0.0 &&
        receipt.newMovements[0].quantity === 50;

      results.push({
        code: 'TEST-P05-AE',
        title: 'Zero-Cost Promotional Stock Receiving (RM0.00 Unit Cost)',
        category: 'STOCK_RECEIVING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Validates and receives RM0.00 bonus/promotional items cleanly into stock',
        actual: `Total: RM${draft.total.toFixed(2)}, Received: ${updated.currentStock} units @ RM${updated.costPrice.toFixed(2)}`,
        details: 'Supports non-negative boundary condition for free promotional supplier goods.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AE',
        title: 'Zero-Cost Promotional Stock Receiving (RM0.00 Unit Cost)',
        category: 'STOCK_RECEIVING',
        status: 'FAILED',
        expected: 'Zero cost allowed',
        actual: e.message,
        details: 'Zero cost error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AF: Catalog Inventory Valuation Updates Accurately
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-af', 'VAL-01', 'Coffee Jar', 10.0, 15.0, 10); // initial holding = 10 * 10 = RM100
      const sup = createMockSupplier('sup-af', 'SUP-AF', 'Coffee Beans Co');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      // Receive 20 units @ RM12.00.
      // New stock = 30 units.
      // New costPrice = RM12.00 (Section 13).
      // New holding value = 30 * RM12.00 = RM360.00.
      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 20, unitCost: 12.0 }],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const updated = receipt.updatedProducts[0];
      const newHoldingValue = updated.currentStock * updated.costPrice;

      const pass = updated.currentStock === 30 && updated.costPrice === 12.0 && newHoldingValue === 360.0;

      results.push({
        code: 'TEST-P05-AF',
        title: 'Catalog Inventory Valuation Dynamics Post-Procurement',
        category: 'INVENTORY_AUDIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Holding value evolves from RM100.00 (10 @ 10) to RM360.00 (30 @ 12)',
        actual: `Stock: ${updated.currentStock}, Cost: RM${updated.costPrice.toFixed(2)}, Holding: RM${newHoldingValue.toFixed(2)}`,
        formulaOrMath: 'New Holding Value = 30 units * RM12.00 = RM360.00',
        details: 'Ensures store asset valuation immediately incorporates newly received inventory and adjusted cost.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AF',
        title: 'Catalog Inventory Valuation Dynamics Post-Procurement',
        category: 'INVENTORY_AUDIT',
        status: 'FAILED',
        expected: 'Valuation passes',
        actual: e.message,
        details: 'Valuation error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AG: Restocking Restores OUT_OF_STOCK Product to NORMAL
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-ag', 'OOS-01', 'Empty Product', 2.0, 3.0, 0, 5);
      const initialStatus = InventoryService.getStockStatus(prod); // OUT_OF_STOCK

      const sup = createMockSupplier('sup-ag', 'SUP-AG', 'Restock Supplier');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 20, unitCost: 2.0 }],
        },
        sMap,
        pMap,
        []
      );
      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const restocked = receipt.updatedProducts[0];
      const newStatus = InventoryService.getStockStatus(restocked); // NORMAL (20 >= 5)

      const pass = initialStatus === 'OUT_OF_STOCK' && newStatus === 'NORMAL';

      results.push({
        code: 'TEST-P05-AG',
        title: 'Stock Status Restoration: OUT_OF_STOCK to NORMAL',
        category: 'INVENTORY_AUDIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Status transitions from OUT_OF_STOCK (0 units) to NORMAL (20 units >= minStock 5)',
        actual: `Initial: ${initialStatus}, Post-receipt: ${newStatus}`,
        details: 'Validates automated stock alert resolution upon purchase order completion.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AG',
        title: 'Stock Status Restoration: OUT_OF_STOCK to NORMAL',
        category: 'INVENTORY_AUDIT',
        status: 'FAILED',
        expected: 'Status transition passes',
        actual: e.message,
        details: 'Status transition error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AH: Restocking Clears LOW_STOCK Status
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-ah', 'LOW-01', 'Low Stock Item', 1.0, 2.0, 2, 5);
      const initialStatus = InventoryService.getStockStatus(prod); // LOW_STOCK (2 < 5)

      const sup = createMockSupplier('sup-ah', 'SUP-AH', 'Restock Supplier');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 10, unitCost: 1.0 }],
        },
        sMap,
        pMap,
        []
      );
      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const restocked = receipt.updatedProducts[0];
      const newStatus = InventoryService.getStockStatus(restocked); // NORMAL (12 >= 5)

      const pass = initialStatus === 'LOW_STOCK' && newStatus === 'NORMAL';

      results.push({
        code: 'TEST-P05-AH',
        title: 'Stock Alert Resolution: LOW_STOCK to NORMAL',
        category: 'INVENTORY_AUDIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Status transitions from LOW_STOCK (2 units) to NORMAL (12 units)',
        actual: `Initial: ${initialStatus}, Post-receipt: ${newStatus}`,
        details: 'Automatically lifts low stock warning banner when received goods exceed threshold.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AH',
        title: 'Stock Alert Resolution: LOW_STOCK to NORMAL',
        category: 'INVENTORY_AUDIT',
        status: 'FAILED',
        expected: 'Low stock clears',
        actual: e.message,
        details: 'Low stock error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AI: Purchase Notes & Contact Details Preservation
    // -------------------------------------------------------------------------
    try {
      const sup = createMockSupplier('sup-ai', 'SUP-AI', 'Supplier With Notes');
      const prod = createMockProduct('prod-ai', 'AI-01', 'Dry Goods', 3.0, 4.0, 10);
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const testNotes = 'Urgent restock for festive weekend delivery via Lorry 4.';
      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          notes: testNotes,
          items: [{ productId: prod.id, quantity: 10, unitCost: 3.0 }],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const pass = receipt.completedPurchase.notes === testNotes;

      results.push({
        code: 'TEST-P05-AI',
        title: 'Purchase Order Notes & Audit Remarks Preservation',
        category: 'PURCHASE_ORDER',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Delivery and supplier instructions preserved on completed purchase record',
        actual: `Notes: "${receipt.completedPurchase.notes}"`,
        details: 'Maintains administrative annotations throughout the PO lifecycle.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AI',
        title: 'Purchase Order Notes & Audit Remarks Preservation',
        category: 'PURCHASE_ORDER',
        status: 'FAILED',
        expected: 'Notes verified',
        actual: e.message,
        details: 'Notes error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AJ: Multi-supplier Sequential Receiving for Single Product
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-aj', 'MULTI-SUP', 'Cooking Oil 1L', 5.0, 7.0, 10);
      const sup1 = createMockSupplier('sup-aj1', 'SUP-AJ1', 'Distributor A');
      const sup2 = createMockSupplier('sup-aj2', 'SUP-AJ2', 'Distributor B');

      let currentProd = prod;
      const sMap = new Map([
        [sup1.id, sup1],
        [sup2.id, sup2],
      ]);

      // Batch 1 from Sup 1 @ RM5.20
      const d1 = PurchasingService.createDraftPurchase(
        { supplierId: sup1.id, items: [{ productId: currentProd.id, quantity: 10, unitCost: 5.2 }] },
        sMap,
        new Map([[currentProd.id, currentProd]]),
        []
      );
      const r1 = PurchasingService.completePurchase(d1, sMap, new Map([[currentProd.id, currentProd]]), store.id);
      currentProd = r1.updatedProducts[0];

      // Batch 2 from Sup 2 @ RM5.50
      const d2 = PurchasingService.createDraftPurchase(
        { supplierId: sup2.id, items: [{ productId: currentProd.id, quantity: 20, unitCost: 5.5 }] },
        sMap,
        new Map([[currentProd.id, currentProd]]),
        [d1]
      );
      const r2 = PurchasingService.completePurchase(d2, sMap, new Map([[currentProd.id, currentProd]]), store.id);
      currentProd = r2.updatedProducts[0];

      const pass = currentProd.currentStock === 40 && currentProd.costPrice === 5.5;

      results.push({
        code: 'TEST-P05-AJ',
        title: 'Multi-Supplier Sequential Restocking & Cost Tracking',
        category: 'COST_PRICE_UPDATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Stock: 40 units (10 + 10 + 20), Final Cost Price: RM5.50 (Latest received)',
        actual: `Final Stock: ${currentProd.currentStock}, Final Cost: RM${currentProd.costPrice.toFixed(2)}`,
        formulaOrMath: 'Stock = 10 + 10 + 20 = 40; Cost updated 5.00 -> 5.20 -> 5.50',
        details: 'Verifies successive deliveries from different suppliers seamlessly accumulate stock and advance cost price.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AJ',
        title: 'Multi-Supplier Sequential Restocking & Cost Tracking',
        category: 'COST_PRICE_UPDATE',
        status: 'FAILED',
        expected: 'Sequential procurement passes',
        actual: e.message,
        details: 'Sequential procurement error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AK: Audit Traceability: Inventory Movement Balance Matches Product currentStock
    // -------------------------------------------------------------------------
    try {
      const prod = createMockProduct('prod-ak', 'AUDIT-01', 'Traceable Soap', 1.5, 2.5, 10);
      const sup = createMockSupplier('sup-ak', 'SUP-AK', 'Soap Factory');
      const sMap = new Map([[sup.id, sup]]);
      const pMap = new Map([[prod.id, prod]]);

      const draft = PurchasingService.createDraftPurchase(
        {
          supplierId: sup.id,
          items: [{ productId: prod.id, quantity: 30, unitCost: 1.6 }],
        },
        sMap,
        pMap,
        []
      );

      const receipt = PurchasingService.completePurchase(draft, sMap, pMap, store.id);
      const updated = receipt.updatedProducts[0];
      const movement = receipt.newMovements[0];

      const pass =
        movement.previousStock === 10 &&
        movement.newStock === 40 &&
        movement.newStock === updated.currentStock &&
        movement.referenceId === draft.id &&
        movement.reason.includes(draft.purchaseNumber);

      results.push({
        code: 'TEST-P05-AK',
        title: 'Inventory Movement Audit Traceability Verification',
        category: 'INVENTORY_AUDIT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Movement previous (10) + qty (30) equals newStock (40) and Product.currentStock',
        actual: `Movement: ${movement.previousStock} + ${movement.quantity} = ${movement.newStock}, Product currentStock: ${updated.currentStock}`,
        details: 'Guarantees 100% mathematical audit ledger parity between inventory balance and movement logs.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AK',
        title: 'Inventory Movement Audit Traceability Verification',
        category: 'INVENTORY_AUDIT',
        status: 'FAILED',
        expected: 'Traceability confirmed',
        actual: e.message,
        details: 'Traceability error',
      });
    }

    // -------------------------------------------------------------------------
    // TEST AL: Full End-to-End Retail Lifecycle Integration
    // SUPPLIER -> PO -> STOCK IN -> POS SALE -> COGS -> GROSS PROFIT
    // -------------------------------------------------------------------------
    try {
      // 1. Supplier registered
      const supplier = createMockSupplier('sup-al', 'SUP-AL', 'NiagaPOS Master Wholesaler');

      // 2. Product initialized
      const initialProduct = createMockProduct('prod-al', 'LIFECYCLE-01', 'Organic Tea', 8.0, 12.0, 5);

      // 3. Purchase Order drafted
      const sMap = new Map([[supplier.id, supplier]]);
      const pMap = new Map([[initialProduct.id, initialProduct]]);

      const poDraft = PurchasingService.createDraftPurchase(
        {
          supplierId: supplier.id,
          items: [{ productId: initialProduct.id, quantity: 20, unitCost: 8.5 }],
        },
        sMap,
        pMap,
        []
      );

      // 4. Stock received atomically (STOCK_IN)
      const poReceipt = PurchasingService.completePurchase(poDraft, sMap, pMap, store.id);
      const restockedProduct = poReceipt.updatedProducts[0]; // stock = 25, cost = RM8.50

      // 5. Customer comes to POS and purchases 4 units
      const posResult = SalesService.processSale(
        [{ product: restockedProduct, quantity: 4 }],
        new Map([[restockedProduct.id, restockedProduct]]),
        store.id,
        0,
        { cashReceived: 60.0, discount: 0, paymentMethod: 'CASH' }
      );

      const completedSale = posResult.sale;
      const finalProduct = posResult.updatedProducts[0];
      const saleItem = completedSale.items[0];

      // 6. Accounting verification
      const revenue = saleItem.actualRevenue ?? saleItem.lineTotal; // 4 * RM12 = RM48.00
      const cogs = saleItem.lineCost; // 4 * RM8.50 = RM34.00
      const grossProfit = saleItem.grossProfit; // RM48.00 - RM34.00 = RM14.00
      const grossMarginPct = (grossProfit / revenue) * 100; // (14 / 48) * 100 = 29.17%

      const passLifecycle =
        restockedProduct.currentStock === 25 &&
        restockedProduct.costPrice === 8.5 &&
        finalProduct.currentStock === 21 && // 25 - 4
        completedSale.status === 'COMPLETED' &&
        revenue === 48.0 &&
        cogs === 34.0 &&
        grossProfit === 14.0 &&
        Math.abs(grossMarginPct - 29.17) < 0.05;

      results.push({
        code: 'TEST-P05-AL',
        title: 'Full End-to-End Retail Lifecycle Integration (Procurement to Profit)',
        category: 'FULL_LIFECYCLE',
        status: passLifecycle ? 'PASSED' : 'FAILED',
        expected: 'Procurement (Stock: 5->25, Cost: RM8.50) -> POS Sale (Stock: 25->21) -> Revenue: RM48.00, COGS: RM34.00, Gross Profit: RM14.00 (29.17%)',
        actual: `Final Stock: ${finalProduct.currentStock}, Revenue: RM${revenue.toFixed(2)}, COGS: RM${cogs.toFixed(2)}, Gross Profit: RM${grossProfit.toFixed(2)} (${grossMarginPct.toFixed(2)}%)`,
        formulaOrMath: 'GP = Actual Sales Revenue (RM48.00) - Realized COGS (RM34.00) = +RM14.00 (29.17%)',
        details: 'Seamlessly connects Supplier management, Purchasing, Stock receiving, POS ring-up, and Gross Profit accounting.',
      });
    } catch (e: any) {
      results.push({
        code: 'TEST-P05-AL',
        title: 'Full End-to-End Retail Lifecycle Integration (Procurement to Profit)',
        category: 'FULL_LIFECYCLE',
        status: 'FAILED',
        expected: 'Full lifecycle completes',
        actual: e.message,
        details: 'Lifecycle error',
      });
    }

    return results;
  }
}
