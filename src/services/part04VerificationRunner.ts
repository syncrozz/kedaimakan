/**
 * NiagaPOS - Part 04 Sales & Profit Management / Reporting Verification Runner
 * 
 * Programmatically validates all Part 04 specifications:
 * A. Dashboard KPIs (Today's Sales, COGS, Gross Profit, Transactions, Items Sold, ATV, Inventory Value, Low Stock, Out of Stock)
 * B. Sales History & Auditing (Completed sales appear, Failed/Void do not, Date filtering, Transaction details)
 * C. Historical Integrity Protection (Old price/cost unchanged, Reports strictly use historical snapshots)
 * D. Discount Accounting (Actual revenue realized, GP = Actual Revenue - COGS)
 * E. Product Performance (Units sold, Revenue, COGS, GP, Best Sellers ranking)
 * F. Gross Margin Mathematics (Positive margin, Zero revenue protection, Negative gross profit)
 * G. Inventory Valuation & Thresholds (Active stock valuation, Inactive exclusion, Part 01.5 rules)
 * H. Date Range Filtering Boundaries (Today, Yesterday, This Week, This Month, Custom)
 * I. Empty State Handling (Zero sales, Zero transactions, Zero revenue, No product sales)
 */

import { Product, CartItem, Sale, SaleItem } from '../types';
import { SalesService, ProcessSaleOptions } from './salesService';
import { InventoryService } from './inventoryService';
import {
  ReportingService,
  DashboardKPIs,
} from './reportingService';
import { INITIAL_STORE } from './seedData';

export interface Part04TestResult {
  code: string;
  title: string;
  category:
    | 'DASHBOARD'
    | 'SALES_HISTORY'
    | 'HISTORICAL_INTEGRITY'
    | 'DISCOUNT_ACCOUNTING'
    | 'PRODUCT_PERFORMANCE'
    | 'GROSS_MARGIN'
    | 'INVENTORY_REPORTING'
    | 'DATE_RANGE'
    | 'EMPTY_STATE';
  status: 'PASSED' | 'FAILED';
  expected: string;
  actual: string;
  formulaOrMath?: string;
  details: string;
}

export class Part04VerificationRunner {
  public static runAllTests(): Part04TestResult[] {
    const results: Part04TestResult[] = [];
    const store = INITIAL_STORE;

    const createMockProduct = (
      id: string,
      name: string,
      cost: number,
      price: number,
      stock: number,
      minStock = 5,
      active = true
    ): Product => ({
      id,
      storeId: store.id,
      sku: `SKU-${id.toUpperCase()}`,
      name,
      category: 'General',
      costPrice: cost,
      sellingPrice: price,
      currentStock: stock,
      minimumStock: minStock,
      active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Helper to process sales with Map and optional custom timestamp
    const runSale = (
      items: CartItem[],
      catalog: Product[],
      options?: ProcessSaleOptions,
      customDateTime?: string
    ) => {
      const pMap = new Map<string, Product>();
      catalog.forEach((p) => pMap.set(p.id, p));
      const res = SalesService.processSale(items, pMap, store.id, 0, options || 0);
      if (customDateTime) {
        res.sale.dateTime = customDateTime;
      }
      return res;
    };

    const fixedRefDate = new Date('2026-09-12T14:30:00.000Z');

    // -------------------------------------------------------------
    // CATEGORY A: DASHBOARD
    // -------------------------------------------------------------

    // TEST A1: Today's Sales
    try {
      const p1 = createMockProduct('p-a1', 'Kicap Manis', 2.0, 3.5, 20);
      const { sale: todaySale } = runSale(
        [{ product: p1, quantity: 2 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 10.0 },
        '2026-09-12T10:00:00.000Z'
      );
      const kpis = ReportingService.calculateDashboardKPIs([p1], [todaySale], fixedRefDate);
      const pass = kpis.todaySales === 7.0;
      results.push({
        code: 'A1',
        title: "Dashboard: Today's Sales Revenue",
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Today Sales: RM 7.00',
        actual: `Today Sales: RM ${kpis.todaySales.toFixed(2)}`,
        formulaOrMath: '2 units × RM 3.50 = RM 7.00',
        details: 'Correctly sums actual revenue from completed sales occurring today.',
      });
    } catch (e: any) {
      results.push({
        code: 'A1',
        title: "Dashboard: Today's Sales Revenue",
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Today Sales: RM 7.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A2: Today's COGS
    try {
      const p1 = createMockProduct('p-a2', 'Kicap Manis', 2.0, 3.5, 20);
      const { sale: todaySale } = runSale(
        [{ product: p1, quantity: 3 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 20.0 },
        '2026-09-12T11:00:00.000Z'
      );
      const kpis = ReportingService.calculateDashboardKPIs([p1], [todaySale], fixedRefDate);
      const pass = kpis.todayCOGS === 6.0;
      results.push({
        code: 'A2',
        title: "Dashboard: Today's COGS",
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Today COGS: RM 6.00',
        actual: `Today COGS: RM ${kpis.todayCOGS.toFixed(2)}`,
        formulaOrMath: '3 units × RM 2.00 (historical cost) = RM 6.00',
        details: 'Sums historical cost snapshot of goods sold today.',
      });
    } catch (e: any) {
      results.push({
        code: 'A2',
        title: "Dashboard: Today's COGS",
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Today COGS: RM 6.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A3: Today's Gross Profit
    try {
      const p1 = createMockProduct('p-a3', 'Beras 5kg', 12.0, 16.0, 10);
      const { sale: todaySale } = runSale(
        [{ product: p1, quantity: 2 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 40.0 },
        '2026-09-12T12:00:00.000Z'
      );
      const kpis = ReportingService.calculateDashboardKPIs([p1], [todaySale], fixedRefDate);
      // Revenue = 32.00, COGS = 24.00, Gross Profit = 8.00
      const pass = kpis.todayGrossProfit === 8.0;
      results.push({
        code: 'A3',
        title: "Dashboard: Today's Gross Profit",
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Today Gross Profit: RM 8.00',
        actual: `Today Gross Profit: RM ${kpis.todayGrossProfit.toFixed(2)}`,
        formulaOrMath: 'Sales (RM 32.00) - COGS (RM 24.00) = RM 8.00 GP',
        details: 'Today Gross Profit strictly computed as Today Sales - Today COGS.',
      });
    } catch (e: any) {
      results.push({
        code: 'A3',
        title: "Dashboard: Today's Gross Profit",
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Today Gross Profit: RM 8.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A4: Today's Transactions
    try {
      const p1 = createMockProduct('p-a4', 'Roti Gardenia', 2.0, 2.8, 10);
      const { sale: s1 } = runSale(
        [{ product: p1, quantity: 1 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 5.0 },
        '2026-09-12T09:00:00.000Z'
      );
      const { sale: s2 } = runSale(
        [{ product: p1, quantity: 2 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 10.0 },
        '2026-09-12T14:00:00.000Z'
      );
      const kpis = ReportingService.calculateDashboardKPIs([p1], [s1, s2], fixedRefDate);
      const pass = kpis.todayTransactions === 2;
      results.push({
        code: 'A4',
        title: "Dashboard: Today's Transactions Count",
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Today Transactions: 2',
        actual: `Today Transactions: ${kpis.todayTransactions}`,
        details: 'Accurately counts completed transactions occurring today.',
      });
    } catch (e: any) {
      results.push({
        code: 'A4',
        title: "Dashboard: Today's Transactions Count",
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Today Transactions: 2',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A5: Items Sold
    try {
      const p1 = createMockProduct('p-a5', 'Gula Pasir', 2.5, 3.2, 50);
      const { sale } = runSale(
        [{ product: p1, quantity: 7 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 30.0 },
        '2026-09-12T15:00:00.000Z'
      );
      const kpis = ReportingService.calculateDashboardKPIs([p1], [sale], fixedRefDate);
      const pass = kpis.todayItemsSold === 7;
      results.push({
        code: 'A5',
        title: 'Dashboard: Items Sold Today',
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Items Sold: 7 units',
        actual: `Items Sold: ${kpis.todayItemsSold} units`,
        details: 'Sums individual item quantities across all completed sales items.',
      });
    } catch (e: any) {
      results.push({
        code: 'A5',
        title: 'Dashboard: Items Sold Today',
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Items Sold: 7 units',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A6: Average Transaction Value (ATV)
    try {
      const p1 = createMockProduct('p-a6', 'Minyak Masak', 6.0, 8.0, 30);
      const { sale: s1 } = runSale(
        [{ product: p1, quantity: 1 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 10.0 },
        '2026-09-12T10:00:00.000Z'
      );
      const { sale: s2 } = runSale(
        [{ product: p1, quantity: 3 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 30.0 },
        '2026-09-12T12:00:00.000Z'
      );
      // Total revenue = RM 8.00 + RM 24.00 = RM 32.00, Transactions = 2 => ATV = RM 16.00
      const kpis = ReportingService.calculateDashboardKPIs([p1], [s1, s2], fixedRefDate);
      const pass = kpis.averageTransactionValue === 16.0;
      results.push({
        code: 'A6',
        title: 'Dashboard: Average Transaction Value',
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'ATV: RM 16.00',
        actual: `ATV: RM ${kpis.averageTransactionValue.toFixed(2)}`,
        formulaOrMath: 'RM 32.00 Sales / 2 Transactions = RM 16.00 ATV',
        details: 'Correctly divides sales revenue by transaction count.',
      });
    } catch (e: any) {
      results.push({
        code: 'A6',
        title: 'Dashboard: Average Transaction Value',
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'ATV: RM 16.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A7: Inventory Value
    try {
      const p1 = createMockProduct('p-a7-1', 'Beras', 10.0, 14.0, 5); // 5 * 10 = 50
      const p2 = createMockProduct('p-a7-2', 'Minyak', 5.0, 7.0, 10); // 10 * 5 = 50
      const pInactive = createMockProduct('p-a7-3', 'Old Item', 20.0, 30.0, 4, 5, false); // Inactive excluded
      const kpis = ReportingService.calculateDashboardKPIs([p1, p2, pInactive], [], fixedRefDate);
      const pass = kpis.inventoryValue === 100.0;
      results.push({
        code: 'A7',
        title: 'Dashboard: Total Inventory Value',
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Inventory Value: RM 100.00',
        actual: `Inventory Value: RM ${kpis.inventoryValue.toFixed(2)}`,
        formulaOrMath: '(5 × RM 10) + (10 × RM 5) = RM 100.00 (inactive excluded)',
        details: 'Multiplies Current Stock × Cost Price across active products only.',
      });
    } catch (e: any) {
      results.push({
        code: 'A7',
        title: 'Dashboard: Total Inventory Value',
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Inventory Value: RM 100.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A8: Low Stock (Part 01.5 rule: 0 < currentStock < minimumStock)
    try {
      const pLow = createMockProduct('p-a8-1', 'Low Item', 2.0, 3.0, 3, 5); // 3 < 5 -> LOW
      const pNormal = createMockProduct('p-a8-2', 'Normal Item', 2.0, 3.0, 5, 5); // 5 == 5 -> NORMAL
      const pOut = createMockProduct('p-a8-3', 'Out Item', 2.0, 3.0, 0, 5); // 0 -> OUT
      const kpis = ReportingService.calculateDashboardKPIs([pLow, pNormal, pOut], [], fixedRefDate);
      const pass = kpis.lowStockCount === 1;
      results.push({
        code: 'A8',
        title: 'Dashboard: Low Stock Count (Part 01.5 Rule)',
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Low Stock: 1',
        actual: `Low Stock: ${kpis.lowStockCount}`,
        details: 'Strictly applies 0 < currentStock < minimumStock threshold.',
      });
    } catch (e: any) {
      results.push({
        code: 'A8',
        title: 'Dashboard: Low Stock Count (Part 01.5 Rule)',
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Low Stock: 1',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST A9: Out of Stock (Part 01.5 rule: currentStock <= 0)
    try {
      const pOut1 = createMockProduct('p-a9-1', 'Zero Item', 2.0, 3.0, 0, 5);
      const pOut2 = createMockProduct('p-a9-2', 'Negative Item', 2.0, 3.0, -1, 5);
      const pPositive = createMockProduct('p-a9-3', 'Positive Item', 2.0, 3.0, 2, 5);
      const kpis = ReportingService.calculateDashboardKPIs([pOut1, pOut2, pPositive], [], fixedRefDate);
      const pass = kpis.outOfStockCount === 2;
      results.push({
        code: 'A9',
        title: 'Dashboard: Out of Stock Count (Part 01.5 Rule)',
        category: 'DASHBOARD',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Out of Stock: 2',
        actual: `Out of Stock: ${kpis.outOfStockCount}`,
        details: 'Identifies all active products where currentStock <= 0.',
      });
    } catch (e: any) {
      results.push({
        code: 'A9',
        title: 'Dashboard: Out of Stock Count (Part 01.5 Rule)',
        category: 'DASHBOARD',
        status: 'FAILED',
        expected: 'Out of Stock: 2',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY B: SALES HISTORY
    // -------------------------------------------------------------

    // TEST B1: Completed sale appears in history
    try {
      const p1 = createMockProduct('p-b1', 'Kopi O', 1.0, 1.8, 20);
      const { sale } = runSale(
        [{ product: p1, quantity: 1 }],
        [p1],
        { paymentMethod: 'CASH', cashReceived: 5.0 },
        '2026-09-12T10:00:00.000Z'
      );
      const filtered = ReportingService.filterSales([sale], { preset: 'ALL_TIME' });
      const pass = filtered.length === 1 && filtered[0].id === sale.id;
      results.push({
        code: 'B1',
        title: 'Sales History: Completed Sale Appears',
        category: 'SALES_HISTORY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Completed sale included in report',
        actual: `Found ${filtered.length} completed sale(s)`,
        details: 'Completed transactions are reliably retrieved.',
      });
    } catch (e: any) {
      results.push({
        code: 'B1',
        title: 'Sales History: Completed Sale Appears',
        category: 'SALES_HISTORY',
        status: 'FAILED',
        expected: 'Completed sale included',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST B2: Failed / Non-completed sales do NOT appear
    try {
      const validSale: Sale = {
        id: 'sale-valid',
        storeId: store.id,
        transactionNumber: 'SALE-000101',
        dateTime: '2026-09-12T10:00:00.000Z',
        items: [],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        totalCost: 6,
        grossProfit: 4,
        status: 'COMPLETED',
        createdAt: '2026-09-12T10:00:00.000Z',
      };
      const voidSale: Sale = {
        id: 'sale-void',
        storeId: store.id,
        transactionNumber: 'SALE-000102',
        dateTime: '2026-09-12T11:00:00.000Z',
        items: [],
        subtotal: 15,
        discount: 0,
        tax: 0,
        total: 15,
        totalCost: 10,
        grossProfit: 5,
        status: 'VOID',
        createdAt: '2026-09-12T11:00:00.000Z',
      };
      const refundedSale: Sale = {
        id: 'sale-refunded',
        storeId: store.id,
        transactionNumber: 'SALE-000103',
        dateTime: '2026-09-12T12:00:00.000Z',
        items: [],
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        totalCost: 14,
        grossProfit: 6,
        status: 'REFUNDED',
        createdAt: '2026-09-12T12:00:00.000Z',
      };
      const filtered = ReportingService.filterSales(
        [validSale, voidSale, refundedSale],
        { preset: 'ALL_TIME' }
      );
      const pass = filtered.length === 1 && filtered[0].id === 'sale-valid';
      results.push({
        code: 'B2',
        title: 'Sales History: Non-Completed Sales Excluded',
        category: 'SALES_HISTORY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Only status == COMPLETED included (1 sale)',
        actual: `Filtered sales count: ${filtered.length}`,
        details: 'Void and refunded sales are strictly excluded from sales reports.',
      });
    } catch (e: any) {
      results.push({
        code: 'B2',
        title: 'Sales History: Non-Completed Sales Excluded',
        category: 'SALES_HISTORY',
        status: 'FAILED',
        expected: 'Only completed sales included',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST B3: Date filtering works
    try {
      const sYesterday: Sale = {
        id: 's-yest',
        storeId: store.id,
        transactionNumber: 'SALE-0001',
        dateTime: '2026-09-11T12:00:00.000Z',
        items: [],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        totalCost: 5,
        grossProfit: 5,
        status: 'COMPLETED',
        createdAt: '2026-09-11T12:00:00.000Z',
      };
      const sToday: Sale = {
        id: 's-today',
        storeId: store.id,
        transactionNumber: 'SALE-0002',
        dateTime: '2026-09-12T12:00:00.000Z',
        items: [],
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        totalCost: 12,
        grossProfit: 8,
        status: 'COMPLETED',
        createdAt: '2026-09-12T12:00:00.000Z',
      };
      const filteredToday = ReportingService.filterSales(
        [sYesterday, sToday],
        { preset: 'TODAY' },
        fixedRefDate
      );
      const pass = filteredToday.length === 1 && filteredToday[0].id === 's-today';
      results.push({
        code: 'B3',
        title: 'Sales History: Date Filtering Boundaries',
        category: 'SALES_HISTORY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Filtered Today count: 1 (s-today only)',
        actual: `Filtered Today count: ${filteredToday.length}`,
        details: 'Properly filters out records outside the target date window.',
      });
    } catch (e: any) {
      results.push({
        code: 'B3',
        title: 'Sales History: Date Filtering Boundaries',
        category: 'SALES_HISTORY',
        status: 'FAILED',
        expected: 'Filtered Today count: 1',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST B4: Transaction Detail View Integrity
    try {
      const p1 = createMockProduct('p-b4', 'Biskut Tiger', 1.5, 2.5, 20);
      const { sale } = runSale(
        [{ product: p1, quantity: 2 }],
        [p1],
        {
          paymentMethod: 'CASH',
          cashReceived: 10.0,
          notes: 'Customer asked for paper bag',
        },
        '2026-09-12T16:00:00.000Z'
      );
      const item = sale.items[0];
      const hasAllFields =
        Boolean(sale.transactionNumber) &&
        sale.paymentMethod === 'CASH' &&
        sale.cashReceived === 10.0 &&
        sale.change === 5.0 &&
        sale.notes === 'Customer asked for paper bag' &&
        item.productNameSnapshot === 'Biskut Tiger' &&
        item.quantity === 2 &&
        item.unitCostSnapshot === 1.5 &&
        item.unitSellingPriceSnapshot === 2.5 &&
        item.lineTotal === 5.0 &&
        item.lineCost === 3.0 &&
        item.grossProfit === 2.0;
      results.push({
        code: 'B4',
        title: 'Sales Detail: Full Historical Snapshot Representation',
        category: 'SALES_HISTORY',
        status: hasAllFields ? 'PASSED' : 'FAILED',
        expected: 'All 12 audit fields present with correct snapshots',
        actual: hasAllFields ? 'Complete snapshot audit structure verified' : 'Missing or invalid fields',
        details: 'Audit detail modal displays comprehensive transaction metadata.',
      });
    } catch (e: any) {
      results.push({
        code: 'B4',
        title: 'Sales Detail: Full Historical Snapshot Representation',
        category: 'SALES_HISTORY',
        status: 'FAILED',
        expected: 'All fields present',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY C: HISTORICAL INTEGRITY
    // -------------------------------------------------------------

    // TEST C1: Old selling price remains unchanged when product is updated
    try {
      const p = createMockProduct('p-c1', 'Susu Pekat', 3.0, 4.0, 20);
      const { sale } = runSale(
        [{ product: p, quantity: 1 }],
        [p],
        { paymentMethod: 'CASH', cashReceived: 5.0 }
      );
      // Now update product price in catalog
      const updatedProduct = { ...p, sellingPrice: 5.5 };
      // Sale snapshot must still be 4.0
      const pass =
        sale.items[0].unitSellingPriceSnapshot === 4.0 &&
        updatedProduct.sellingPrice === 5.5;
      results.push({
        code: 'C1',
        title: 'Historical Integrity: Selling Price Snapshot Immutability',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Historical sale item unit selling price remains RM 4.00',
        actual: `Historical price: RM ${sale.items[0].unitSellingPriceSnapshot.toFixed(2)}`,
        details: 'Catalog price modifications do not overwrite past sales.',
      });
    } catch (e: any) {
      results.push({
        code: 'C1',
        title: 'Historical Integrity: Selling Price Snapshot Immutability',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Historical price preserved',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST C2: Old cost remains unchanged when product cost is updated
    try {
      const p = createMockProduct('p-c2', 'Mee Segera', 1.0, 1.8, 30);
      const { sale } = runSale(
        [{ product: p, quantity: 2 }],
        [p],
        { paymentMethod: 'CASH', cashReceived: 5.0 }
      );
      // Catalog cost updated later
      const updatedProduct = { ...p, costPrice: 1.4 };
      const pass =
        sale.items[0].unitCostSnapshot === 1.0 &&
        sale.items[0].lineCost === 2.0 &&
        updatedProduct.costPrice === 1.4;
      results.push({
        code: 'C2',
        title: 'Historical Integrity: Cost Price Snapshot Immutability',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Historical sale item unit cost remains RM 1.00',
        actual: `Historical cost: RM ${sale.items[0].unitCostSnapshot.toFixed(2)}`,
        details: 'Supplier cost changes never alter historical transaction records.',
      });
    } catch (e: any) {
      results.push({
        code: 'C2',
        title: 'Historical Integrity: Cost Price Snapshot Immutability',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Historical cost preserved',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST C3: Report strictly uses historical cost
    try {
      const p = createMockProduct('p-c3', 'Tepung Gandum', 2.0, 3.5, 40);
      const { sale } = runSale(
        [{ product: p, quantity: 2 }],
        [p],
        { paymentMethod: 'CASH', cashReceived: 10.0 }
      );
      // Now catalog cost increases significantly to RM 3.00
      const updatedProduct = { ...p, costPrice: 3.0 };
      // ReportingService computes product performance from sale
      const perf = ReportingService.calculateProductPerformance([sale]);
      // Expected: COGS is 2 * 2.0 = 4.00, Gross Profit = 7.00 - 4.00 = 3.00 (NOT 7.00 - 6.00 = 1.00)
      const pass = perf[0].cogs === 4.0 && perf[0].grossProfit === 3.0;
      results.push({
        code: 'C3',
        title: 'Historical Integrity: Reports Use Historical Cost Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Report COGS: RM 4.00, Gross Profit: RM 3.00',
        actual: `Report COGS: RM ${perf[0].cogs.toFixed(2)}, GP: RM ${perf[0].grossProfit.toFixed(2)}`,
        details: 'Reporting strictly reads SaleItem snapshots and never queries live product cost.',
      });
    } catch (e: any) {
      results.push({
        code: 'C3',
        title: 'Historical Integrity: Reports Use Historical Cost Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Historical cost used in report',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY D: DISCOUNT ACCOUNTING
    // -------------------------------------------------------------

    // TEST D1: Discounted sale uses actual revenue
    try {
      const p = createMockProduct('p-d1', 'Beras Wangi', 10.0, 15.0, 10);
      // Subtotal RM 15.00, Discount RM 3.00 => Actual revenue = RM 12.00
      const { sale } = runSale(
        [{ product: p, quantity: 1 }],
        [p],
        {
          discount: 3.0,
          paymentMethod: 'CASH',
          cashReceived: 12.0,
        }
      );
      const summary = ReportingService.calculateSalesSummary([sale]);
      const pass = summary.totalRevenue === 12.0 && sale.items[0].actualRevenue === 12.0;
      results.push({
        code: 'D1',
        title: 'Discount Accounting: Actual Realized Revenue in Reports',
        category: 'DISCOUNT_ACCOUNTING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Total Revenue: RM 12.00 (Subtotal RM 15 - Discount RM 3)',
        actual: `Reported Revenue: RM ${summary.totalRevenue.toFixed(2)}`,
        details: 'Actual post-discount takings are reported as revenue.',
      });
    } catch (e: any) {
      results.push({
        code: 'D1',
        title: 'Discount Accounting: Actual Realized Revenue in Reports',
        category: 'DISCOUNT_ACCOUNTING',
        status: 'FAILED',
        expected: 'Reported Revenue: RM 12.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST D2: Gross profit calculation with discount: GP = Actual Revenue - COGS
    try {
      const p = createMockProduct('p-d2', 'Minyak Masak', 8.0, 10.0, 20);
      // Subtotal = RM 10.00, Discount = RM 1.00 => Actual Revenue = RM 9.00
      // Cost = RM 8.00 => Gross Profit = RM 9.00 - RM 8.00 = RM 1.00 (NOT RM 10 - RM 8 = RM 2)
      const { sale } = runSale(
        [{ product: p, quantity: 1 }],
        [p],
        { discount: 1.0, paymentMethod: 'CASH', cashReceived: 9.0 }
      );
      const summary = ReportingService.calculateSalesSummary([sale]);
      const pass = summary.grossProfit === 1.0;
      results.push({
        code: 'D2',
        title: 'Discount Accounting: Gross Profit Equation Accuracy',
        category: 'DISCOUNT_ACCOUNTING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit: RM 1.00 (RM 9 Revenue - RM 8 Cost)',
        actual: `Gross Profit: RM ${summary.grossProfit.toFixed(2)}`,
        formulaOrMath: 'Actual Takings (RM 9.00) - COGS (RM 8.00) = RM 1.00 GP',
        details: 'Prevents phantom profit overstatement when discounts are applied.',
      });
    } catch (e: any) {
      results.push({
        code: 'D2',
        title: 'Discount Accounting: Gross Profit Equation Accuracy',
        category: 'DISCOUNT_ACCOUNTING',
        status: 'FAILED',
        expected: 'Gross Profit: RM 1.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY E: PRODUCT PERFORMANCE
    // -------------------------------------------------------------

    // TEST E1: Units sold calculated correctly per product
    try {
      const p1 = createMockProduct('p-e1', 'Item 1', 1.0, 2.0, 50);
      const { sale: s1 } = runSale([{ product: p1, quantity: 3 }], [p1]);
      const { sale: s2 } = runSale([{ product: p1, quantity: 4 }], [p1]);
      const perf = ReportingService.calculateProductPerformance([s1, s2]);
      const pass = perf[0].unitsSold === 7;
      results.push({
        code: 'E1',
        title: 'Product Performance: Total Units Sold Accuracy',
        category: 'PRODUCT_PERFORMANCE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Units Sold: 7 units',
        actual: `Units Sold: ${perf[0].unitsSold} units`,
        details: 'Correctly sums sales quantities across multiple transactions.',
      });
    } catch (e: any) {
      results.push({
        code: 'E1',
        title: 'Product Performance: Total Units Sold Accuracy',
        category: 'PRODUCT_PERFORMANCE',
        status: 'FAILED',
        expected: 'Units Sold: 7 units',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST E2: Revenue calculated correctly
    try {
      const p = createMockProduct('p-e2', 'Item 2', 2.0, 5.0, 50);
      const { sale } = runSale(
        [{ product: p, quantity: 3 }],
        [p],
        { discount: 1.5 } // Net revenue = 3 * 5 - 1.5 = 13.50
      );
      const perf = ReportingService.calculateProductPerformance([sale]);
      const pass = perf[0].salesRevenue === 13.5;
      results.push({
        code: 'E2',
        title: 'Product Performance: Net Sales Revenue Realized',
        category: 'PRODUCT_PERFORMANCE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Sales Revenue: RM 13.50',
        actual: `Sales Revenue: RM ${perf[0].salesRevenue.toFixed(2)}`,
        details: 'Aggregates post-discount item revenue properly.',
      });
    } catch (e: any) {
      results.push({
        code: 'E2',
        title: 'Product Performance: Net Sales Revenue Realized',
        category: 'PRODUCT_PERFORMANCE',
        status: 'FAILED',
        expected: 'Sales Revenue: RM 13.50',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST E3: COGS calculated correctly
    try {
      const p = createMockProduct('p-e3', 'Item 3', 3.2, 6.0, 50);
      const { sale } = runSale([{ product: p, quantity: 4 }], [p]);
      const perf = ReportingService.calculateProductPerformance([sale]);
      // 4 * 3.2 = 12.80
      const pass = perf[0].cogs === 12.8;
      results.push({
        code: 'E3',
        title: 'Product Performance: Product COGS Derivation',
        category: 'PRODUCT_PERFORMANCE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'COGS: RM 12.80',
        actual: `COGS: RM ${perf[0].cogs.toFixed(2)}`,
        details: '4 units × RM 3.20 snapshot cost = RM 12.80.',
      });
    } catch (e: any) {
      results.push({
        code: 'E3',
        title: 'Product Performance: Product COGS Derivation',
        category: 'PRODUCT_PERFORMANCE',
        status: 'FAILED',
        expected: 'COGS: RM 12.80',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST E4: GP calculated correctly
    try {
      const p = createMockProduct('p-e4', 'Item 4', 2.0, 5.0, 50);
      const { sale } = runSale([{ product: p, quantity: 2 }], [p]);
      const perf = ReportingService.calculateProductPerformance([sale]);
      // Revenue 10.00, Cost 4.00 => GP = 6.00
      const pass = perf[0].grossProfit === 6.0;
      results.push({
        code: 'E4',
        title: 'Product Performance: Product Gross Profit Calculation',
        category: 'PRODUCT_PERFORMANCE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit: RM 6.00',
        actual: `Gross Profit: RM ${perf[0].grossProfit.toFixed(2)}`,
        details: 'Gross Profit is accurately computed per product.',
      });
    } catch (e: any) {
      results.push({
        code: 'E4',
        title: 'Product Performance: Product Gross Profit Calculation',
        category: 'PRODUCT_PERFORMANCE',
        status: 'FAILED',
        expected: 'Gross Profit: RM 6.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST E5: Best Sellers ranked by Total Quantity Sold descending
    try {
      const pLow = createMockProduct('p-e5-1', 'Low Volume High Price', 50.0, 100.0, 10);
      const pHigh = createMockProduct('p-e5-2', 'High Volume Low Price', 1.0, 2.0, 100);
      const { sale: s1 } = runSale([{ product: pLow, quantity: 1 }], [pLow]);
      const { sale: s2 } = runSale([{ product: pHigh, quantity: 15 }], [pHigh]);
      const bestSellers = ReportingService.getBestSellers([s1, s2]);
      const pass = bestSellers[0].productId === 'p-e5-2' && bestSellers[0].unitsSold === 15;
      results.push({
        code: 'E5',
        title: 'Product Performance: Best Sellers Volume Ranking',
        category: 'PRODUCT_PERFORMANCE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Top product: p-e5-2 with 15 units sold',
        actual: `Top product: ${bestSellers[0].productName} (${bestSellers[0].unitsSold} units)`,
        details: 'Ranks products strictly by quantity sold descending as per Section 13.',
      });
    } catch (e: any) {
      results.push({
        code: 'E5',
        title: 'Product Performance: Best Sellers Volume Ranking',
        category: 'PRODUCT_PERFORMANCE',
        status: 'FAILED',
        expected: 'Top volume item first',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY F: GROSS MARGIN MATHEMATICS
    // -------------------------------------------------------------

    // TEST F1: Positive gross margin
    try {
      const p = createMockProduct('p-f1', 'Gula', 2.0, 4.0, 50);
      const { sale } = runSale([{ product: p, quantity: 1 }], [p]);
      const summary = ReportingService.calculateSalesSummary([sale]);
      // Revenue 4.00, Cost 2.00, GP 2.00 => Margin = (2/4)*100 = 50.00%
      const pass = summary.grossMarginPercentage === 50.0;
      results.push({
        code: 'F1',
        title: 'Gross Margin: Standard Positive Margin Calculation',
        category: 'GROSS_MARGIN',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Margin: 50.00%',
        actual: `Gross Margin: ${summary.grossMarginPercentage.toFixed(2)}%`,
        formulaOrMath: '(RM 2.00 GP / RM 4.00 Revenue) × 100 = 50.00%',
        details: 'Standard gross margin formula computes precisely.',
      });
    } catch (e: any) {
      results.push({
        code: 'F1',
        title: 'Gross Margin: Standard Positive Margin Calculation',
        category: 'GROSS_MARGIN',
        status: 'FAILED',
        expected: 'Gross Margin: 50.00%',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST F2: Zero revenue protection
    try {
      const summary = ReportingService.calculateSalesSummary([]);
      const pass = summary.grossMarginPercentage === 0;
      results.push({
        code: 'F2',
        title: 'Gross Margin: Zero Revenue Safe Protection',
        category: 'GROSS_MARGIN',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Margin: 0.00% (never NaN% or Infinity%)',
        actual: `Gross Margin: ${summary.grossMarginPercentage.toFixed(2)}%`,
        details: 'Division by zero is safely trapped and returned as 0%.',
      });
    } catch (e: any) {
      results.push({
        code: 'F2',
        title: 'Gross Margin: Zero Revenue Safe Protection',
        category: 'GROSS_MARGIN',
        status: 'FAILED',
        expected: 'Gross Margin: 0.00%',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST F3: Negative gross profit handled correctly
    try {
      // Product sold at a loss or deeply discounted below cost
      // Cost = RM 5.00, Selling Price = RM 4.00 => GP = -RM 1.00, Margin = -25%
      const p = createMockProduct('p-f3', 'Loss Leader', 5.0, 4.0, 50);
      const { sale } = runSale([{ product: p, quantity: 1 }], [p]);
      const summary = ReportingService.calculateSalesSummary([sale]);
      const pass = summary.grossProfit === -1.0 && summary.grossMarginPercentage === -25.0;
      results.push({
        code: 'F3',
        title: 'Gross Margin: Negative Profit Support (No Zero-Clamping)',
        category: 'GROSS_MARGIN',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit: -RM 1.00, Margin: -25.00%',
        actual: `Gross Profit: RM ${summary.grossProfit.toFixed(2)}, Margin: ${summary.grossMarginPercentage.toFixed(2)}%`,
        formulaOrMath: '(RM 4.00 - RM 5.00) = -RM 1.00, (-1 / 4) × 100 = -25.00%',
        details: 'Negative gross profit is preserved and not clamped to zero.',
      });
    } catch (e: any) {
      results.push({
        code: 'F3',
        title: 'Gross Margin: Negative Profit Support (No Zero-Clamping)',
        category: 'GROSS_MARGIN',
        status: 'FAILED',
        expected: 'Gross Profit: -RM 1.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY G: INVENTORY REPORTING
    // -------------------------------------------------------------

    // TEST G1: Inventory value calculated correctly
    try {
      const p1 = createMockProduct('p-g1-1', 'Item A', 10.0, 15.0, 3); // 30
      const p2 = createMockProduct('p-g1-2', 'Item B', 2.5, 4.0, 4);  // 10
      const kpis = ReportingService.calculateDashboardKPIs([p1, p2], [], fixedRefDate);
      const pass = kpis.inventoryValue === 40.0 && kpis.totalInventoryUnits === 7;
      results.push({
        code: 'G1',
        title: 'Inventory: Active Catalog Valuation Accuracy',
        category: 'INVENTORY_REPORTING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Inventory Value: RM 40.00 across 7 units',
        actual: `Inventory Value: RM ${kpis.inventoryValue.toFixed(2)} across ${kpis.totalInventoryUnits} units`,
        details: 'Sum of Current Stock × Cost Price calculated correctly.',
      });
    } catch (e: any) {
      results.push({
        code: 'G1',
        title: 'Inventory: Active Catalog Valuation Accuracy',
        category: 'INVENTORY_REPORTING',
        status: 'FAILED',
        expected: 'Inventory Value: RM 40.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST G2: Low-stock rule matches Part 01.5
    try {
      const p1 = createMockProduct('p-g2-1', 'Item Low', 1.0, 2.0, 4, 5); // 0 < 4 < 5 => true
      const p2 = createMockProduct('p-g2-2', 'Item Min', 1.0, 2.0, 5, 5); // 5 == 5 => false (Normal)
      const p3 = createMockProduct('p-g2-3', 'Item Zero', 1.0, 2.0, 0, 5); // 0 => false (Out)
      const pass =
        InventoryService.isLowStock(p1) === true &&
        InventoryService.isLowStock(p2) === false &&
        InventoryService.isLowStock(p3) === false;
      results.push({
        code: 'G2',
        title: 'Inventory: Low-Stock Rule Alignment with Part 01.5',
        category: 'INVENTORY_REPORTING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'p1: LOW_STOCK, p2: NORMAL, p3: OUT_OF_STOCK',
        actual: `Low stock checks: p1=${InventoryService.isLowStock(p1)}, p2=${InventoryService.isLowStock(p2)}, p3=${InventoryService.isLowStock(p3)}`,
        details: 'Consistent with Part 01.5 deterministic rule (0 < currentStock < minStock).',
      });
    } catch (e: any) {
      results.push({
        code: 'G2',
        title: 'Inventory: Low-Stock Rule Alignment with Part 01.5',
        category: 'INVENTORY_REPORTING',
        status: 'FAILED',
        expected: 'Part 01.5 rule preserved',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST G3: Out-of-stock rule matches Part 01.5
    try {
      const p1 = createMockProduct('p-g3-1', 'Zero Stock', 1.0, 2.0, 0, 5);
      const p2 = createMockProduct('p-g3-2', 'Negative Stock', 1.0, 2.0, -2, 5);
      const p3 = createMockProduct('p-g3-3', 'Positive Stock', 1.0, 2.0, 1, 5);
      const pass =
        InventoryService.isOutOfStock(p1) === true &&
        InventoryService.isOutOfStock(p2) === true &&
        InventoryService.isOutOfStock(p3) === false;
      results.push({
        code: 'G3',
        title: 'Inventory: Out-of-Stock Rule Alignment with Part 01.5',
        category: 'INVENTORY_REPORTING',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'p1: OUT_OF_STOCK, p2: OUT_OF_STOCK, p3: NOT out of stock',
        actual: `Out of stock checks: p1=${InventoryService.isOutOfStock(p1)}, p2=${InventoryService.isOutOfStock(p2)}, p3=${InventoryService.isOutOfStock(p3)}`,
        details: 'Consistent with Part 01.5 deterministic rule (currentStock <= 0).',
      });
    } catch (e: any) {
      results.push({
        code: 'G3',
        title: 'Inventory: Out-of-Stock Rule Alignment with Part 01.5',
        category: 'INVENTORY_REPORTING',
        status: 'FAILED',
        expected: 'Part 01.5 rule preserved',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY H: DATE RANGE
    // -------------------------------------------------------------

    // TEST H1: Today preset
    try {
      const bounds = ReportingService.getDateRangeBounds({ preset: 'TODAY' }, fixedRefDate);
      const pass =
        bounds.start.getDate() === 12 &&
        bounds.start.getHours() === 0 &&
        bounds.end.getDate() === 12 &&
        bounds.end.getHours() === 23;
      results.push({
        code: 'H1',
        title: "Date Range: 'TODAY' Boundary Resolution",
        category: 'DATE_RANGE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Today: 2026-09-12 00:00:00 to 23:59:59',
        actual: `Range: ${bounds.start.toISOString()} to ${bounds.end.toISOString()}`,
        details: "Preset 'TODAY' cleanly binds to local start and end of day.",
      });
    } catch (e: any) {
      results.push({
        code: 'H1',
        title: "Date Range: 'TODAY' Boundary Resolution",
        category: 'DATE_RANGE',
        status: 'FAILED',
        expected: 'Proper boundary resolution',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST H2: Yesterday preset
    try {
      const bounds = ReportingService.getDateRangeBounds({ preset: 'YESTERDAY' }, fixedRefDate);
      const pass =
        bounds.start.getDate() === 11 &&
        bounds.end.getDate() === 11;
      results.push({
        code: 'H2',
        title: "Date Range: 'YESTERDAY' Boundary Resolution",
        category: 'DATE_RANGE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Yesterday: 2026-09-11 00:00:00 to 23:59:59',
        actual: `Range: ${bounds.start.toISOString()} to ${bounds.end.toISOString()}`,
        details: "Preset 'YESTERDAY' cleanly shifts back exactly one day.",
      });
    } catch (e: any) {
      results.push({
        code: 'H2',
        title: "Date Range: 'YESTERDAY' Boundary Resolution",
        category: 'DATE_RANGE',
        status: 'FAILED',
        expected: 'Proper boundary resolution',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST H3: This Week preset
    try {
      const bounds = ReportingService.getDateRangeBounds({ preset: 'THIS_WEEK' }, fixedRefDate);
      // 2026-09-12 was Saturday; Monday was 2026-09-07, Sunday 2026-09-13
      const pass =
        bounds.start.getDate() === 7 &&
        bounds.end.getDate() === 13;
      results.push({
        code: 'H3',
        title: "Date Range: 'THIS_WEEK' Monday-to-Sunday Range",
        category: 'DATE_RANGE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Week: 2026-09-07 (Mon) to 2026-09-13 (Sun)',
        actual: `Range: ${bounds.start.toISOString()} to ${bounds.end.toISOString()}`,
        details: 'Retail standard Monday-start calendar week boundaries.',
      });
    } catch (e: any) {
      results.push({
        code: 'H3',
        title: "Date Range: 'THIS_WEEK' Monday-to-Sunday Range",
        category: 'DATE_RANGE',
        status: 'FAILED',
        expected: 'Proper week boundaries',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST H4: This Month preset
    try {
      const bounds = ReportingService.getDateRangeBounds({ preset: 'THIS_MONTH' }, fixedRefDate);
      const pass =
        bounds.start.getDate() === 1 &&
        bounds.start.getMonth() === 8 && // September is month 8 in 0-indexed Date
        bounds.end.getDate() === 30; // September has 30 days
      results.push({
        code: 'H4',
        title: "Date Range: 'THIS_MONTH' 1st-to-Last Day Range",
        category: 'DATE_RANGE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Month: 2026-09-01 to 2026-09-30',
        actual: `Range: ${bounds.start.toISOString()} to ${bounds.end.toISOString()}`,
        details: 'Month boundaries cover from 1st to last day of current month.',
      });
    } catch (e: any) {
      results.push({
        code: 'H4',
        title: "Date Range: 'THIS_MONTH' 1st-to-Last Day Range",
        category: 'DATE_RANGE',
        status: 'FAILED',
        expected: 'Proper month boundaries',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST H5: Custom date range
    try {
      const bounds = ReportingService.getDateRangeBounds(
        {
          preset: 'CUSTOM',
          customStartDate: '2026-09-03',
          customEndDate: '2026-09-09',
        },
        fixedRefDate
      );
      const pass =
        bounds.start.getDate() === 3 &&
        bounds.end.getDate() === 9;
      results.push({
        code: 'H5',
        title: 'Date Range: Custom Start and End Date Support',
        category: 'DATE_RANGE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Custom: 2026-09-03 00:00:00 to 2026-09-09 23:59:59',
        actual: `Range: ${bounds.start.toISOString()} to ${bounds.end.toISOString()}`,
        details: 'Custom date inputs parsed and applied with day-boundary precision.',
      });
    } catch (e: any) {
      results.push({
        code: 'H5',
        title: 'Date Range: Custom Start and End Date Support',
        category: 'DATE_RANGE',
        status: 'FAILED',
        expected: 'Proper custom boundaries',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // -------------------------------------------------------------
    // CATEGORY I: EMPTY STATE HANDLING
    // -------------------------------------------------------------

    // TEST I1: Zero sales
    try {
      const summary = ReportingService.calculateSalesSummary([]);
      const pass =
        summary.totalRevenue === 0 &&
        summary.totalCOGS === 0 &&
        summary.grossProfit === 0 &&
        summary.totalTransactions === 0;
      results.push({
        code: 'I1',
        title: 'Empty State: Zero Sales Initial State',
        category: 'EMPTY_STATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Revenue: 0, COGS: 0, GP: 0, Transactions: 0',
        actual: `Revenue: ${summary.totalRevenue}, COGS: ${summary.totalCOGS}, GP: ${summary.grossProfit}, Trx: ${summary.totalTransactions}`,
        details: 'Gracefully handles empty sales database without null reference errors.',
      });
    } catch (e: any) {
      results.push({
        code: 'I1',
        title: 'Empty State: Zero Sales Initial State',
        category: 'EMPTY_STATE',
        status: 'FAILED',
        expected: 'Clean zero values',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST I2: Zero transactions ATV
    try {
      const summary = ReportingService.calculateSalesSummary([]);
      const pass = summary.averageTransactionValue === 0;
      results.push({
        code: 'I2',
        title: 'Empty State: Average Transaction Value When Zero Sales',
        category: 'EMPTY_STATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Average Transaction Value: RM 0.00',
        actual: `Average Transaction Value: RM ${summary.averageTransactionValue.toFixed(2)}`,
        details: 'Returns RM 0.00 instead of NaN or error when no transactions exist.',
      });
    } catch (e: any) {
      results.push({
        code: 'I2',
        title: 'Empty State: Average Transaction Value When Zero Sales',
        category: 'EMPTY_STATE',
        status: 'FAILED',
        expected: 'ATV is RM 0.00',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST I3: Zero revenue margin safety
    try {
      const summary = ReportingService.calculateSalesSummary([]);
      const pass = summary.grossMarginPercentage === 0;
      results.push({
        code: 'I3',
        title: 'Empty State: Gross Margin % Safe Default',
        category: 'EMPTY_STATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Margin %: 0.00%',
        actual: `Gross Margin %: ${summary.grossMarginPercentage.toFixed(2)}%`,
        details: 'Guaranteed 0.00% output with no division by zero error.',
      });
    } catch (e: any) {
      results.push({
        code: 'I3',
        title: 'Empty State: Gross Margin % Safe Default',
        category: 'EMPTY_STATE',
        status: 'FAILED',
        expected: 'Margin is 0.00%',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    // TEST I4: No product sales performance
    try {
      const perf = ReportingService.calculateProductPerformance([]);
      const best = ReportingService.getBestSellers([]);
      const pass = perf.length === 0 && best.length === 0;
      results.push({
        code: 'I4',
        title: 'Empty State: Product Performance Empty Handling',
        category: 'EMPTY_STATE',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Empty array returned for performance and best sellers',
        actual: `Performance items: ${perf.length}, Best sellers: ${best.length}`,
        details: 'Returns clean empty arrays ready for empty state UI display.',
      });
    } catch (e: any) {
      results.push({
        code: 'I4',
        title: 'Empty State: Product Performance Empty Handling',
        category: 'EMPTY_STATE',
        status: 'FAILED',
        expected: 'Empty arrays returned',
        actual: `Error: ${e.message}`,
        details: 'Exception caught during test execution',
      });
    }

    return results;
  }
}
