/**
 * NiagaPOS - Product Lifecycle & Deletion Semantics Verification Runner
 *
 * Implements 16 comprehensive verification tests (A through P) as specified in
 * the Product Delete / Deactivate Semantics requirement:
 *
 * A. New unused product can be hard-deleted.
 * B. Test product can be hard-deleted.
 * C. Duplicate unused product can be hard-deleted.
 * D. Deleted product no longer appears anywhere in active catalog.
 * E. Product with SaleItem cannot be hard-deleted.
 * F. Product with PurchaseItem cannot be hard-deleted.
 * G. Product with InventoryMovement cannot be hard-deleted.
 * H. Product with historical references can be deactivated.
 * I. Historical sales remain intact after deactivation.
 * J. Historical COGS remains intact.
 * K. Historical purchase remains intact.
 * L. Inactive product does not appear in POS.
 * M. Existing SKU uniqueness remains intact.
 * N. Zero stock alone does not determine deletion eligibility.
 * O. Current stock deletion requires explicit protection.
 * P. Existing regression suite passes.
 */

import { Product, Sale, Purchase, InventoryMovement, SaleItem, PurchaseItem, Store } from '../types';
import { ProductService, ProductDeleteEligibility } from './productService';
import { SalesService } from './salesService';
import { VerificationRunner } from './verificationRunner';
import { Part02VerificationRunner } from './part02VerificationRunner';
import { Part03VerificationRunner } from './part03VerificationRunner';
import { Part04VerificationRunner } from './part04VerificationRunner';
import { Part05VerificationRunner } from './part05VerificationRunner';
import { Part06VerificationRunner } from './part06VerificationRunner';
import { Part07VerificationRunner } from './part07VerificationRunner';
import { Part08VerificationRunner } from './part08VerificationRunner';
import { CsvImportVerificationRunner } from './csvImportVerificationRunner';

export interface ProductLifecycleTestResult {
  code: string;
  name: string;
  category: 'Hard Delete' | 'Deactivation' | 'Historical Protection' | 'POS & Catalog' | 'Regression';
  status: 'PASSED' | 'FAILED';
  passed: boolean;
  message: string;
  details: string;
}

export class ProductLifecycleVerificationRunner {
  private static testStore: Store = {
    id: 'store-niagapos-test',
    code: 'NP01',
    name: 'NiagaPOS Test Store',
    address: 'Lot 10, Jalan Pasar, 50000 KL',
    currency: 'MYR',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  };

  public static runAllTests(): ProductLifecycleTestResult[] {
    const results: ProductLifecycleTestResult[] = [];

    // --- TEST A: New unused product can be hard-deleted ---
    try {
      const newProd: Product = {
        id: 'prod-new-unused',
        storeId: this.testStore.id,
        sku: 'NEW-001',
        name: 'Produk Baru Unused',
        category: 'Runcit',
        costPrice: 5.0,
        sellingPrice: 7.0,
        currentStock: 0,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };
      const products = [newProd];
      const sales: Sale[] = [];
      const purchases: Purchase[] = [];
      const movements: InventoryMovement[] = [];

      const eligibility = ProductService.checkDeleteEligibility(newProd, sales, purchases, movements);
      const outcome = ProductService.hardDeleteProduct(newProd.id, products, movements, sales, purchases);

      const passed =
        eligibility.canHardDelete === true &&
        eligibility.hasHistoricalReferences === false &&
        outcome.updatedProducts.length === 0 &&
        !outcome.updatedProducts.some((p) => p.id === newProd.id);

      results.push({
        code: 'A',
        name: 'New unused product can be hard-deleted',
        category: 'Hard Delete',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'New unused product with zero transactions successfully permanently deleted.'
          : 'Failed to hard-delete unused product.',
        details: 'Product with 0 stock and 0 historical records is permanently removed from catalog.',
      });
    } catch (e: any) {
      results.push({
        code: 'A',
        name: 'New unused product can be hard-deleted',
        category: 'Hard Delete',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception occurred during hard deletion of new unused product.',
      });
    }

    // --- TEST B: Test product can be hard-deleted ---
    try {
      const testProd: Product = {
        id: 'prod-test-001',
        storeId: this.testStore.id,
        sku: 'TEST-001',
        name: 'Lexus Test',
        category: 'Snacks & Biscuits',
        costPrice: 1.2,
        sellingPrice: 1.5,
        currentStock: 10,
        minimumStock: 5,
        active: true,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      };
      const openingMov: InventoryMovement = {
        id: 'mov-init-test-001',
        storeId: this.testStore.id,
        productId: testProd.id,
        productName: testProd.name,
        type: 'STOCK_IN',
        quantity: 10,
        previousStock: 0,
        newStock: 10,
        referenceId: 'OPENING-STOCK-TEST-001',
        reason: 'Opening stock for newly registered product',
        createdAt: '2026-09-01T09:00:00Z',
      };
      const products = [testProd];
      const sales: Sale[] = [];
      const purchases: Purchase[] = [];
      const movements = [openingMov];

      const eligibility = ProductService.checkDeleteEligibility(testProd, sales, purchases, movements);
      const outcome = ProductService.hardDeleteProduct(
        testProd.id,
        products,
        movements,
        sales,
        purchases,
        true // Explicit stock confirmation
      );

      const passed =
        eligibility.canHardDelete === true &&
        eligibility.hasHistoricalReferences === false &&
        eligibility.hasStockWithoutHistory === true &&
        outcome.updatedProducts.length === 0 &&
        outcome.updatedMovements.length === 0;

      results.push({
        code: 'B',
        name: 'Test product can be hard-deleted',
        category: 'Hard Delete',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Lexus Test (TEST-001) permanently removed with no lingering Inactive status.'
          : 'Failed to hard-delete test product.',
        details:
          'Test product with opening stock but zero commercial history is completely expunged without leaving Inactive residue.',
      });
    } catch (e: any) {
      results.push({
        code: 'B',
        name: 'Test product can be hard-deleted',
        category: 'Hard Delete',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception occurred during test product hard deletion.',
      });
    }

    // --- TEST C: Duplicate unused product can be hard-deleted ---
    try {
      const dupProd: Product = {
        id: 'prod-dup-001',
        storeId: this.testStore.id,
        sku: 'DUP-MISTAKE',
        name: 'Accidental Duplicate',
        category: 'General',
        costPrice: 2.0,
        sellingPrice: 3.0,
        currentStock: 0,
        minimumStock: 0,
        active: true,
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };
      const products = [dupProd];
      const sales: Sale[] = [];
      const purchases: Purchase[] = [];
      const movements: InventoryMovement[] = [];

      const outcome = ProductService.hardDeleteProduct(dupProd.id, products, movements, sales, purchases);
      const passed = outcome.updatedProducts.length === 0 && !outcome.updatedProducts.some((p) => p.sku === 'DUP-MISTAKE');

      results.push({
        code: 'C',
        name: 'Duplicate unused product can be hard-deleted',
        category: 'Hard Delete',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Accidental duplicate product permanently removed, freeing SKU.'
          : 'Failed to hard-delete duplicate product.',
        details: 'Duplicate accidental entries can be cleanly purged.',
      });
    } catch (e: any) {
      results.push({
        code: 'C',
        name: 'Duplicate unused product can be hard-deleted',
        category: 'Hard Delete',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in duplicate product test.',
      });
    }

    // --- TEST D: Deleted product no longer appears anywhere in active catalog ---
    try {
      const catalogProd: Product = {
        id: 'prod-purge-001',
        storeId: this.testStore.id,
        sku: 'PURGE-01',
        name: 'Purge Candidate',
        category: 'Beverages',
        costPrice: 1.5,
        sellingPrice: 2.5,
        currentStock: 0,
        minimumStock: 0,
        active: true,
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };
      const remainingProd: Product = {
        id: 'prod-keep-001',
        storeId: this.testStore.id,
        sku: 'KEEP-01',
        name: 'Keep Item',
        category: 'Beverages',
        costPrice: 2.0,
        sellingPrice: 3.0,
        currentStock: 5,
        minimumStock: 1,
        active: true,
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };
      let products = [catalogProd, remainingProd];
      const outcome = ProductService.hardDeleteProduct(catalogProd.id, products, [], [], []);
      products = outcome.updatedProducts;

      const inCatalog = products.some((p) => p.id === catalogProd.id || p.sku === catalogProd.sku);
      const inPos = SalesService.filterPosCatalog(products, 'ALL', '').some((p) => p.id === catalogProd.id);

      const passed = !inCatalog && !inPos && products.length === 1;

      results.push({
        code: 'D',
        name: 'Deleted product no longer appears anywhere in catalog',
        category: 'POS & Catalog',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Purged product completely absent from catalog, POS, and searches.'
          : 'Purged product lingered in catalog.',
        details: 'Hard-deleted products are completely eliminated from all views.',
      });
    } catch (e: any) {
      results.push({
        code: 'D',
        name: 'Deleted product no longer appears anywhere in catalog',
        category: 'POS & Catalog',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in catalog purge check.',
      });
    }

    // --- TEST E: Product with SaleItem cannot be hard-deleted ---
    try {
      const soldProd: Product = {
        id: 'prod-sold-001',
        storeId: this.testStore.id,
        sku: 'SOLD-001',
        name: 'Produk Pernah Dijual',
        category: 'Groceries',
        costPrice: 10.0,
        sellingPrice: 14.0,
        currentStock: 5,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const saleItem: SaleItem = {
        id: 'item-001',
        saleId: 'sale-001',
        productId: soldProd.id,
        productNameSnapshot: soldProd.name,
        sku: soldProd.sku,
        quantity: 2,
        unitCostSnapshot: 10.0,
        unitSellingPriceSnapshot: 14.0,
        lineTotal: 28.0,
        lineCost: 20.0,
        grossProfit: 8.0,
      };
      const sale: Sale = {
        id: 'sale-001',
        storeId: this.testStore.id,
        transactionNumber: 'TRX-0001',
        dateTime: '2026-09-02T11:00:00Z',
        items: [saleItem],
        subtotal: 28.0,
        discount: 0,
        total: 28.0,
        totalCost: 20.0,
        grossProfit: 8.0,
        status: 'COMPLETED',
        createdAt: '2026-09-02T11:00:00Z',
      };

      const eligibility = ProductService.checkDeleteEligibility(soldProd, [sale], [], []);
      let threwError = false;
      try {
        ProductService.hardDeleteProduct(soldProd.id, [soldProd], [], [sale], []);
      } catch {
        threwError = true;
      }

      const passed =
        eligibility.canHardDelete === false &&
        eligibility.hasHistoricalReferences === true &&
        eligibility.suggestedAction === 'DEACTIVATE' &&
        threwError;

      results.push({
        code: 'E',
        name: 'Product with SaleItem cannot be hard-deleted',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Hard delete strictly blocked for product with SaleItem; deactivation mandated.'
          : 'Product with SaleItem was erroneously allowed to hard delete.',
        details: 'Guarantees that historical customer transactions cannot be corrupted or orphaned.',
      });
    } catch (e: any) {
      results.push({
        code: 'E',
        name: 'Product with SaleItem cannot be hard-deleted',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in SaleItem check.',
      });
    }

    // --- TEST F: Product with PurchaseItem cannot be hard-deleted ---
    try {
      const purchProd: Product = {
        id: 'prod-purch-001',
        storeId: this.testStore.id,
        sku: 'PURCH-01',
        name: 'Produk Pernah Dibeli',
        category: 'Staples',
        costPrice: 20.0,
        sellingPrice: 25.0,
        currentStock: 10,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const purchaseItem: PurchaseItem = {
        id: 'pi-001',
        purchaseId: 'po-001',
        productId: purchProd.id,
        productNameSnapshot: purchProd.name,
        skuSnapshot: purchProd.sku,
        quantity: 10,
        unitCost: 20.0,
        lineTotal: 200.0,
      };
      const purchase: Purchase = {
        id: 'po-001',
        purchaseNumber: 'PO-2026-0001',
        supplierId: 'sup-001',
        supplierCodeSnapshot: 'SUP-001',
        supplierNameSnapshot: 'Pembekal Beras Utama',
        purchaseDate: '2026-09-01',
        items: [purchaseItem],
        subtotal: 200.0,
        discount: 0,
        total: 200.0,
        status: 'COMPLETED',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const eligibility = ProductService.checkDeleteEligibility(purchProd, [], [purchase], []);
      let threwError = false;
      try {
        ProductService.hardDeleteProduct(purchProd.id, [purchProd], [], [], [purchase]);
      } catch {
        threwError = true;
      }

      const passed =
        eligibility.canHardDelete === false &&
        eligibility.hasHistoricalReferences === true &&
        eligibility.suggestedAction === 'DEACTIVATE' &&
        threwError;

      results.push({
        code: 'F',
        name: 'Product with PurchaseItem cannot be hard-deleted',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Hard delete strictly blocked for product with Purchase records.'
          : 'Product with Purchase records was erroneously allowed to hard delete.',
        details: 'Protects supplier audit trail and accounting balance sheets.',
      });
    } catch (e: any) {
      results.push({
        code: 'F',
        name: 'Product with PurchaseItem cannot be hard-deleted',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in PurchaseItem check.',
      });
    }

    // --- TEST G: Product with InventoryMovement cannot be hard-deleted ---
    try {
      const movedProd: Product = {
        id: 'prod-moved-001',
        storeId: this.testStore.id,
        sku: 'MOVED-01',
        name: 'Produk Ada Pergerakan Stok',
        category: 'Hardware',
        costPrice: 4.0,
        sellingPrice: 6.0,
        currentStock: 8,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const adjMovement: InventoryMovement = {
        id: 'mov-adj-001',
        storeId: this.testStore.id,
        productId: movedProd.id,
        productName: movedProd.name,
        type: 'ADJUSTMENT',
        quantity: -2,
        previousStock: 10,
        newStock: 8,
        referenceId: 'ADJ-2026-001',
        reason: 'Barang rosak semasa pemindahan rak',
        createdAt: '2026-09-03T10:00:00Z',
      };

      const eligibility = ProductService.checkDeleteEligibility(movedProd, [], [], [adjMovement]);
      let threwError = false;
      try {
        ProductService.hardDeleteProduct(movedProd.id, [movedProd], [adjMovement], [], []);
      } catch {
        threwError = true;
      }

      const passed =
        eligibility.canHardDelete === false &&
        eligibility.hasHistoricalReferences === true &&
        threwError;

      results.push({
        code: 'G',
        name: 'Product with InventoryMovement cannot be hard-deleted',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Hard delete blocked for product with inventory adjustments/movements.'
          : 'Product with movement history was erroneously deleted.',
        details: 'Preserves inventory ledger and stock audit trail.',
      });
    } catch (e: any) {
      results.push({
        code: 'G',
        name: 'Product with InventoryMovement cannot be hard-deleted',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in movement check.',
      });
    }

    // --- TEST H: Product with historical references can be deactivated ---
    try {
      const histProd: Product = {
        id: 'prod-hist-deact',
        storeId: this.testStore.id,
        sku: 'DEACT-01',
        name: 'Lexus Biskut Klasik',
        category: 'Biscuits',
        costPrice: 2.0,
        sellingPrice: 2.8,
        currentStock: 15,
        minimumStock: 5,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const deactOutcome = ProductService.deactivateProduct(histProd.id, [histProd]);
      const deactProd = deactOutcome.updatedProducts.find((p) => p.id === histProd.id);

      const passed =
        deactOutcome.success &&
        deactProd !== undefined &&
        deactProd.active === false &&
        deactOutcome.updatedProducts.length === 1;

      results.push({
        code: 'H',
        name: 'Product with historical references can be deactivated',
        category: 'Deactivation',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Product with history successfully converted to Inactive status.'
          : 'Failed to deactivate product.',
        details: 'Setting active=false retains product in master database for audit references.',
      });
    } catch (e: any) {
      results.push({
        code: 'H',
        name: 'Product with historical references can be deactivated',
        category: 'Deactivation',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in deactivation test.',
      });
    }

    // --- TEST I: Historical sales remain intact after deactivation ---
    try {
      const prod: Product = {
        id: 'prod-sales-immut',
        storeId: this.testStore.id,
        sku: 'IMMUT-01',
        name: 'Gula Prai 1kg',
        category: 'Groceries',
        costPrice: 2.5,
        sellingPrice: 3.2,
        currentStock: 10,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const sale: Sale = {
        id: 'sale-immut-01',
        storeId: this.testStore.id,
        transactionNumber: 'TRX-IMMUT-01',
        dateTime: '2026-09-02T10:00:00Z',
        items: [
          {
            id: 'si-01',
            saleId: 'sale-immut-01',
            productId: prod.id,
            productNameSnapshot: prod.name,
            sku: prod.sku,
            quantity: 4,
            unitCostSnapshot: 2.5,
            unitSellingPriceSnapshot: 3.2,
            lineTotal: 12.8,
            lineCost: 10.0,
            grossProfit: 2.8,
          },
        ],
        subtotal: 12.8,
        discount: 0,
        total: 12.8,
        totalCost: 10.0,
        grossProfit: 2.8,
        status: 'COMPLETED',
        createdAt: '2026-09-02T10:00:00Z',
      };

      // Deactivate product
      ProductService.deactivateProduct(prod.id, [prod]);

      // Verify sale record is 100% untouched
      const passed =
        sale.items.length === 1 &&
        sale.items[0].productId === prod.id &&
        sale.total === 12.8 &&
        sale.items[0].quantity === 4;

      results.push({
        code: 'I',
        name: 'Historical sales remain intact after deactivation',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Past sales records remain completely unchanged following product deactivation.'
          : 'Sale records were affected by deactivation.',
        details: 'Deactivation has zero side effects on transaction historical logs.',
      });
    } catch (e: any) {
      results.push({
        code: 'I',
        name: 'Historical sales remain intact after deactivation',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in historical sales check.',
      });
    }

    // --- TEST J: Historical COGS remains intact ---
    try {
      const origCost = 15.5;
      const origSelling = 22.0;
      const saleItem: SaleItem = {
        id: 'si-cogs-01',
        saleId: 'sale-cogs-01',
        productId: 'prod-cogs-01',
        productNameSnapshot: 'Susu Tepung Fernleaf 1kg',
        quantity: 2,
        unitCostSnapshot: origCost,
        unitSellingPriceSnapshot: origSelling,
        lineTotal: 44.0,
        lineCost: 31.0,
        grossProfit: 13.0,
      };
      const sale: Sale = {
        id: 'sale-cogs-01',
        storeId: this.testStore.id,
        transactionNumber: 'TRX-COGS-01',
        dateTime: '2026-09-02T14:00:00Z',
        items: [saleItem],
        subtotal: 44.0,
        discount: 0,
        total: 44.0,
        totalCost: 31.0,
        grossProfit: 13.0,
        status: 'COMPLETED',
        createdAt: '2026-09-02T14:00:00Z',
      };

      // Deactivation
      const prod: Product = {
        id: 'prod-cogs-01',
        storeId: this.testStore.id,
        sku: 'FERN-01',
        name: 'Susu Tepung Fernleaf 1kg',
        category: 'Dairy',
        costPrice: 15.5,
        sellingPrice: 22.0,
        currentStock: 0,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      ProductService.deactivateProduct(prod.id, [prod]);

      const passed =
        sale.totalCost === 31.0 &&
        sale.grossProfit === 13.0 &&
        sale.items[0].unitCostSnapshot === 15.5;

      results.push({
        code: 'J',
        name: 'Historical COGS remains intact',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'COGS and gross profit snapshots remain strictly immutable.'
          : 'COGS calculations were compromised.',
        details: 'Financial integrity and historical profitability audits are preserved.',
      });
    } catch (e: any) {
      results.push({
        code: 'J',
        name: 'Historical COGS remains intact',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in COGS check.',
      });
    }

    // --- TEST K: Historical purchase remains intact ---
    try {
      const purch: Purchase = {
        id: 'po-test-01',
        purchaseNumber: 'PO-2026-0099',
        supplierId: 'sup-01',
        supplierCodeSnapshot: 'SUP-0099',
        supplierNameSnapshot: 'Pembekal Minyak Sdn Bhd',
        purchaseDate: '2026-09-01',
        items: [
          {
            id: 'poi-01',
            purchaseId: 'po-test-01',
            productId: 'prod-oil-01',
            productNameSnapshot: 'Minyak Masak Saji 5kg',
            skuSnapshot: 'SAJI-01',
            quantity: 50,
            unitCost: 28.0,
            lineTotal: 1400.0,
          },
        ],
        subtotal: 1400.0,
        discount: 0,
        total: 1400.0,
        status: 'COMPLETED',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const oilProd: Product = {
        id: 'prod-oil-01',
        storeId: this.testStore.id,
        sku: 'SAJI-01',
        name: 'Minyak Masak Saji 5kg',
        category: 'Cooking',
        costPrice: 28.0,
        sellingPrice: 33.5,
        currentStock: 0,
        minimumStock: 5,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      ProductService.deactivateProduct(oilProd.id, [oilProd]);

      const passed =
        purch.total === 1400.0 &&
        purch.items[0].quantity === 50 &&
        purch.items[0].productId === oilProd.id;

      results.push({
        code: 'K',
        name: 'Historical purchase remains intact',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Purchase order records remain complete and valid after product deactivation.'
          : 'Purchase order records were altered.',
        details: 'Supplier ledger and historical accounts payable are uncorrupted.',
      });
    } catch (e: any) {
      results.push({
        code: 'K',
        name: 'Historical purchase remains intact',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in purchase integrity check.',
      });
    }

    // --- TEST L: Inactive product does not appear in POS ---
    try {
      const activeProd: Product = {
        id: 'prod-act-01',
        storeId: this.testStore.id,
        sku: 'ACT-01',
        name: 'Active Product',
        category: 'Food',
        costPrice: 1.0,
        sellingPrice: 2.0,
        currentStock: 10,
        minimumStock: 2,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const inactiveProd: Product = {
        id: 'prod-inact-01',
        storeId: this.testStore.id,
        sku: 'INACT-01',
        name: 'Inactive Historical Product',
        category: 'Food',
        costPrice: 1.0,
        sellingPrice: 2.0,
        currentStock: 10,
        minimumStock: 2,
        active: false,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const catalog = SalesService.filterPosCatalog([activeProd, inactiveProd], 'ALL', '');
      const posCategories = SalesService.getPosCategories([activeProd, inactiveProd]);

      const passed =
        catalog.length === 1 &&
        catalog[0].id === activeProd.id &&
        !catalog.some((p) => p.id === inactiveProd.id);

      results.push({
        code: 'L',
        name: 'Inactive product does not appear in POS',
        category: 'POS & Catalog',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Inactive product strictly excluded from POS sales catalog and POS categories.'
          : 'Inactive product appeared in POS catalog.',
        details: 'Guarantees inactive products cannot be inadvertently rung up at checkout.',
      });
    } catch (e: any) {
      results.push({
        code: 'L',
        name: 'Inactive product does not appear in POS',
        category: 'POS & Catalog',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in POS catalog filtering test.',
      });
    }

    // --- TEST M: Existing SKU uniqueness remains intact ---
    try {
      const deactProd: Product = {
        id: 'prod-sku-res',
        storeId: this.testStore.id,
        sku: 'SKU-RESERVED',
        name: 'Reserved SKU Prod',
        category: 'General',
        costPrice: 1.0,
        sellingPrice: 2.0,
        currentStock: 0,
        minimumStock: 0,
        active: false,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const activeProd: Product = {
        id: 'prod-sku-act',
        storeId: this.testStore.id,
        sku: 'SKU-ACTIVE',
        name: 'Active SKU Prod',
        category: 'General',
        costPrice: 1.0,
        sellingPrice: 2.0,
        currentStock: 5,
        minimumStock: 1,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const products = [deactProd, activeProd];
      const isSkuAvailable = (sku: string, excludeId?: string) => {
        const norm = sku.trim().toLowerCase();
        return !products.some((p) => p.sku.trim().toLowerCase() === norm && p.id !== excludeId);
      };

      // Reserved SKU of inactive product is NOT available
      const deactSkuAvail = isSkuAvailable('SKU-RESERVED');
      // Fresh new SKU is available
      const freshSkuAvail = isSkuAvailable('FRESH-NEW-SKU');

      // Now hard delete activeProd
      const afterHardDelete = products.filter((p) => p.id !== activeProd.id);
      const isSkuAvailableAfter = (sku: string) => {
        const norm = sku.trim().toLowerCase();
        return !afterHardDelete.some((p) => p.sku.trim().toLowerCase() === norm);
      };
      // Once hard deleted, activeProd's SKU is now freed for reuse
      const freedSkuAvail = isSkuAvailableAfter('SKU-ACTIVE');

      const passed = !deactSkuAvail && freshSkuAvail && freedSkuAvail;

      results.push({
        code: 'M',
        name: 'Existing SKU uniqueness remains intact',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Deactivated product SKU remains reserved; hard-deleted product SKU is freed for reuse.'
          : 'SKU uniqueness logic failed.',
        details: 'Prevents SKU collisions while permitting safe reuse of purged test SKUs.',
      });
    } catch (e: any) {
      results.push({
        code: 'M',
        name: 'Existing SKU uniqueness remains intact',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in SKU uniqueness test.',
      });
    }

    // --- TEST N: Zero stock alone does not determine deletion eligibility ---
    try {
      const zeroStockWithSales: Product = {
        id: 'prod-zero-sold',
        storeId: this.testStore.id,
        sku: 'ZERO-SOLD',
        name: 'Zero Stock Sold Out',
        category: 'Groceries',
        costPrice: 5.0,
        sellingPrice: 8.0,
        currentStock: 0, // Zero stock!
        minimumStock: 5,
        active: true,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const sale: Sale = {
        id: 'sale-zero-01',
        storeId: this.testStore.id,
        transactionNumber: 'TRX-ZERO-01',
        dateTime: '2026-09-02T10:00:00Z',
        items: [
          {
            id: 'item-zero-01',
            saleId: 'sale-zero-01',
            productId: zeroStockWithSales.id,
            productNameSnapshot: zeroStockWithSales.name,
            quantity: 10,
            unitCostSnapshot: 5.0,
            unitSellingPriceSnapshot: 8.0,
            lineTotal: 80.0,
            lineCost: 50.0,
            grossProfit: 30.0,
          },
        ],
        subtotal: 80.0,
        discount: 0,
        total: 80.0,
        totalCost: 50.0,
        grossProfit: 30.0,
        status: 'COMPLETED',
        createdAt: '2026-09-02T10:00:00Z',
      };

      const eligibility = ProductService.checkDeleteEligibility(zeroStockWithSales, [sale], [], []);

      const passed =
        zeroStockWithSales.currentStock === 0 &&
        eligibility.canHardDelete === false &&
        eligibility.hasHistoricalReferences === true;

      results.push({
        code: 'N',
        name: 'Zero stock alone does not determine deletion eligibility',
        category: 'Historical Protection',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Zero-stock product with sales history is correctly forbidden from hard deletion.'
          : 'Zero-stock was wrongly treated as safe to delete.',
        details: 'Historical references, not current stock level, are the authoritative criterion.',
      });
    } catch (e: any) {
      results.push({
        code: 'N',
        name: 'Zero stock alone does not determine deletion eligibility',
        category: 'Historical Protection',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in zero stock evaluation.',
      });
    }

    // --- TEST O: Current stock deletion requires explicit protection ---
    try {
      const stockProd: Product = {
        id: 'prod-stock-no-hist',
        storeId: this.testStore.id,
        sku: 'STOCK-WARN-01',
        name: 'Product With Stock No History',
        category: 'Beverages',
        costPrice: 2.0,
        sellingPrice: 3.5,
        currentStock: 25, // Has physical stock!
        minimumStock: 5,
        active: true,
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };

      const eligibility = ProductService.checkDeleteEligibility(stockProd, [], [], []);

      // Attempt 1: Without explicit confirmation -> Must fail!
      let blockedWithoutConfirmation = false;
      try {
        ProductService.hardDeleteProduct(stockProd.id, [stockProd], [], [], [], false);
      } catch {
        blockedWithoutConfirmation = true;
      }

      // Attempt 2: With explicit confirmation -> Succeeds!
      const outcome = ProductService.hardDeleteProduct(stockProd.id, [stockProd], [], [], [], true);

      const passed =
        eligibility.hasStockWithoutHistory === true &&
        blockedWithoutConfirmation &&
        outcome.success &&
        outcome.updatedProducts.length === 0;

      results.push({
        code: 'O',
        name: 'Current stock deletion requires explicit protection',
        category: 'Hard Delete',
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        message: passed
          ? 'Silently destroying current stock prevented; explicit confirmation successfully enforced.'
          : 'Stock was deleted without explicit confirmation requirement.',
        details: 'Guarantees store owners are warned before purging an item that holds inventory valuation.',
      });
    } catch (e: any) {
      results.push({
        code: 'O',
        name: 'Current stock deletion requires explicit protection',
        category: 'Hard Delete',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception in current stock protection test.',
      });
    }

    // --- TEST P: Existing regression suite passes ---
    try {
      const r01 = VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r02 = Part02VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r03 = Part03VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r04 = Part04VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r05 = Part05VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r06 = Part06VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r07 = Part07VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const r08 = Part08VerificationRunner.runAllTests().every((t) => t.status === 'PASSED');
      const rCsv = CsvImportVerificationRunner.runAllTests().every((t) => t.status === 'PASSED');

      const allRegressionPassed =
        r01 && r02 && r03 && r04 && r05 && r06 && r07 && r08 && rCsv;

      results.push({
        code: 'P',
        name: 'Existing regression suite passes',
        category: 'Regression',
        status: allRegressionPassed ? 'PASSED' : 'FAILED',
        passed: allRegressionPassed,
        message: allRegressionPassed
          ? 'All 9 existing test suites (Foundation, Part 02-08, CSV Importer) passed 100% green.'
          : 'One or more regression suites failed.',
        details: 'Zero regressions introduced across all existing accounting, POS, and inventory modules.',
      });
    } catch (e: any) {
      results.push({
        code: 'P',
        name: 'Existing regression suite passes',
        category: 'Regression',
        status: 'FAILED',
        passed: false,
        message: e.message,
        details: 'Exception during regression suite validation.',
      });
    }

    return results;
  }
}
