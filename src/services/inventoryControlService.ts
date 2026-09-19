/**
 * NiagaPOS - Advanced Inventory Control & Analysis Domain Service
 * Part 06: Advanced Inventory + Reporting
 * 
 * Core Principles:
 * 1. Inventory Valuation = Current Stock × Current Cost Price (for active products).
 * 2. Potential Retail Value = Current Stock × Current Selling Price.
 * 3. Potential Gross Profit = Potential Retail Value - Inventory Valuation.
 * 4. Deterministic Stock Status:
 *    - Stock <= 0: OUT_OF_STOCK
 *    - 0 < Stock < minimumStock: LOW_STOCK
 *    - Stock >= minimumStock: NORMAL
 * 5. Suggested Restock Quantity = Math.max(0, minimumStock - currentStock).
 * 6. Reconciliation:
 *    Calculated Ledger Stock = Opening Stock + STOCK_IN + RETURN + positive ADJUSTMENTS - SALE - negative ADJUSTMENTS.
 *    Mismatch detected when recorded currentStock != calculated ledger stock.
 *    No automatic silent correction!
 * 7. Stock Coverage:
 *    Average Daily Units Sold = Units Sold / Number of Days in Selected Period.
 *    Estimated Stock Coverage = Current Stock / Average Daily Units Sold.
 *    If Units Sold == 0 -> "Not available" (Zero-sales safety, no infinity).
 * 8. Movement Traceability:
 *    STOCK_IN (+), SALE (-), ADJUSTMENT (+/-), RETURN (+).
 * 9. Strictly NO AI forecasting, ML, or predictive purchasing.
 */

import { Product, InventoryMovement, Sale, Purchase, StockStatus } from '../types';
import { InventoryService } from './inventoryService';

export interface ProductReconciliationResult {
  productId: string;
  productName: string;
  sku: string;
  recordedStock: number;
  calculatedStock: number;
  difference: number; // recordedStock - calculatedStock
  status: 'OK' | 'MISMATCH';
  breakdown: {
    openingStock: number;
    stockIn: number;
    returns: number;
    sales: number;
    positiveAdjustments: number;
    negativeAdjustments: number;
  };
  movementCount: number;
  formula: string;
  isConsistent: boolean;
}

export interface StoreReconciliationSummary {
  totalProducts: number;
  okCount: number;
  mismatchCount: number;
  results: ProductReconciliationResult[];
}

export interface ProductValuation {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  inventoryValue: number; // currentStock * costPrice
  potentialRetailValue: number; // currentStock * sellingPrice
  potentialGrossProfit: number; // potentialRetailValue - inventoryValue
  potentialGrossMarginPercent: number;
  stockStatus: StockStatus;
  suggestedRestockQty: number;
}

export interface FastMovingProductItem {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  currentStock: number;
  salesRevenue: number;
  grossProfit: number;
  avgDailySales: number;
  stockCoverageDays: number | null;
  stockCoverageDisplay: string;
}

export interface NoSalesProductItem {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
  costPrice: number;
  inventoryValue: number;
  stockStatus: StockStatus;
  lastSaleDate?: string;
  daysSinceLastSaleDisplay: string;
}

export interface StockHealthSummary {
  totalActiveProducts: number;
  totalUnitsInStock: number;
  totalInventoryValue: number;
  totalPotentialRetailValue: number;
  totalPotentialGrossProfit: number;
  normalCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  noSalesCount: number;
}

export interface StockLedgerEntry {
  id: string;
  date: string;
  time: string;
  formattedDateTime: string;
  productId: string;
  productName: string;
  type: 'STOCK_IN' | 'SALE' | 'ADJUSTMENT' | 'RETURN';
  direction: '+' | '-';
  quantity: number;
  signedQuantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  reason: string;
  runningBalance: number;
}

export interface Product360ViewData {
  product: Product;
  stockStatus: StockStatus;
  valuation: ProductValuation;
  reconciliation: ProductReconciliationResult;
  movements: StockLedgerEntry[];
  purchases: {
    purchaseId: string;
    purchaseNumber: string;
    date: string;
    supplierName: string;
    supplierCode: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }[];
  sales: {
    saleId: string;
    transactionNumber: string;
    date: string;
    quantity: number;
    unitSellingPriceSnapshot: number;
    lineRevenue: number;
    unitCostSnapshot: number;
    lineCost: number;
    lineGrossProfit: number;
  }[];
  summary: {
    totalPurchasedUnits: number;
    totalPurchasedValue: number;
    totalSoldUnits: number;
    totalSalesRevenue: number;
    totalGrossProfit: number;
    movementCount: number;
  };
}

export class InventoryControlService {
  /**
   * Deterministic Stock Status Rule (Section 11):
   * - currentStock <= 0: OUT_OF_STOCK
   * - 0 < currentStock < minimumStock: LOW_STOCK
   * - currentStock >= minimumStock: NORMAL
   */
  public static getStockStatus(product: { currentStock: number; minimumStock: number }): StockStatus {
    if (product.currentStock <= 0) return 'OUT_OF_STOCK';
    if (product.currentStock < product.minimumStock) return 'LOW_STOCK';
    return 'NORMAL';
  }

  /**
   * Restock Recommendation Rule (Section 12):
   * Suggested Restock Quantity = Math.max(0, Minimum Stock - Current Stock)
   * Never returns negative.
   */
  public static calculateSuggestedRestock(product: { currentStock: number; minimumStock: number }): number {
    return Math.max(0, product.minimumStock - product.currentStock);
  }

  /**
   * Inventory Valuation at Cost (Section 14):
   * Inventory Value = Current Stock × Current Cost Price
   * Only positive stock contributes to positive valuation.
   */
  public static calculateInventoryValue(product: { currentStock: number; costPrice: number }): number {
    const units = Math.max(0, product.currentStock);
    return Number((units * product.costPrice).toFixed(2));
  }

  /**
   * Potential Retail Value at Selling Price (Section 15):
   * Potential Retail Value = Current Stock × Current Selling Price
   */
  public static calculatePotentialRetailValue(product: { currentStock: number; sellingPrice: number }): number {
    const units = Math.max(0, product.currentStock);
    return Number((units * product.sellingPrice).toFixed(2));
  }

  /**
   * Potential Gross Profit at Current Prices (Section 16):
   * Potential Gross Profit = Potential Retail Value - Inventory Value
   */
  public static calculatePotentialGrossProfit(product: {
    currentStock: number;
    costPrice: number;
    sellingPrice: number;
  }): number {
    const retail = this.calculatePotentialRetailValue(product);
    const cost = this.calculateInventoryValue(product);
    return Number((retail - cost).toFixed(2));
  }

  /**
   * Full Product Valuation
   */
  public static getProductValuation(product: Product): ProductValuation {
    const inventoryValue = this.calculateInventoryValue(product);
    const potentialRetailValue = this.calculatePotentialRetailValue(product);
    const potentialGrossProfit = Number((potentialRetailValue - inventoryValue).toFixed(2));
    const potentialGrossMarginPercent =
      potentialRetailValue > 0
        ? Number(((potentialGrossProfit / potentialRetailValue) * 100).toFixed(2))
        : 0;

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      inventoryValue,
      potentialRetailValue,
      potentialGrossProfit,
      potentialGrossMarginPercent,
      stockStatus: this.getStockStatus(product),
      suggestedRestockQty: this.calculateSuggestedRestock(product),
    };
  }

  /**
   * Stock Reconciliation Calculation (Section 6 & 7):
   * Current Stock = Opening Stock + STOCK_IN + RETURN + positive ADJUSTMENTS - SALE - negative ADJUSTMENTS
   * 
   * Compares Product.currentStock with historical movements.
   * If recordedStock != calculatedStock -> MISMATCH
   * Does NOT auto-correct.
   */
  public static reconcileProduct(
    product: Product,
    movements: InventoryMovement[]
  ): ProductReconciliationResult {
    const productMovements = movements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let openingStock = 0;
    let stockIn = 0;
    let returns = 0;
    let sales = 0;
    let positiveAdjustments = 0;
    let negativeAdjustments = 0;

    for (const m of productMovements) {
      if (m.type === 'STOCK_IN') {
        const isOpening =
          openingStock === 0 &&
          m.previousStock === 0 &&
          (m.reason.toLowerCase().includes('opening') ||
            m.reason.toLowerCase().includes('initial') ||
            (m.referenceId && m.referenceId.toLowerCase().includes('opening')));

        if (isOpening) {
          openingStock += m.quantity;
        } else {
          stockIn += m.quantity;
        }
      } else if (m.type === 'RETURN') {
        returns += Math.abs(m.quantity);
      } else if (m.type === 'SALE') {
        sales += Math.abs(m.quantity);
      } else if (m.type === 'ADJUSTMENT') {
        if (m.quantity >= 0) {
          positiveAdjustments += m.quantity;
        } else {
          negativeAdjustments += Math.abs(m.quantity);
        }
      }
    }

    // Calculated Ledger Stock = Opening + StockIn + Returns + PosAdj - Sales - NegAdj
    const calculatedStock =
      openingStock +
      stockIn +
      returns +
      positiveAdjustments -
      sales -
      negativeAdjustments;

    const difference = product.currentStock - calculatedStock;
    const isConsistent = difference === 0;
    const status: 'OK' | 'MISMATCH' = isConsistent ? 'OK' : 'MISMATCH';

    const formula = `${openingStock} (Opening) + ${stockIn} (Stock In) + ${returns} (Returns) + ${positiveAdjustments} (+Adj) - ${sales} (Sales) - ${negativeAdjustments} (-Adj) = ${calculatedStock} (Ledger Stock)`;

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      recordedStock: product.currentStock,
      calculatedStock,
      difference,
      status,
      breakdown: {
        openingStock,
        stockIn,
        returns,
        sales,
        positiveAdjustments,
        negativeAdjustments,
      },
      movementCount: productMovements.length,
      formula,
      isConsistent,
    };
  }

  /**
   * Reconciles all products in catalog
   */
  public static reconcileAll(
    products: Product[],
    movements: InventoryMovement[]
  ): StoreReconciliationSummary {
    const results = products.map((p) => this.reconcileProduct(p, movements));
    const okCount = results.filter((r) => r.status === 'OK').length;
    const mismatchCount = results.filter((r) => r.status === 'MISMATCH').length;

    return {
      totalProducts: products.length,
      okCount,
      mismatchCount,
      results,
    };
  }

  /**
   * Stock Coverage (Section 19):
   * Average Daily Units Sold = Units Sold / Number of Days in Selected Period
   * Estimated Stock Coverage = Current Stock / Average Daily Units Sold
   * Zero-sales safety: If sales == 0, returns "Not available" (no infinity).
   */
  public static calculateStockCoverage(
    currentStock: number,
    unitsSold: number,
    days: number
  ): {
    avgDailySales: number;
    coverageDays: number | null;
    display: string;
  } {
    const safeDays = Math.max(1, days);
    const avgDailySales = Number((unitsSold / safeDays).toFixed(2));

    if (unitsSold <= 0 || avgDailySales <= 0) {
      return {
        avgDailySales: 0,
        coverageDays: null,
        display: 'Not available',
      };
    }

    const safeStock = Math.max(0, currentStock);
    const coverageDays = Number((safeStock / avgDailySales).toFixed(1));

    return {
      avgDailySales,
      coverageDays,
      display: `Approx. ${coverageDays} days of stock`,
    };
  }

  /**
   * Fast-Moving Products (Section 18):
   * Ranked by Units Sold over selected period from completed sales.
   */
  public static getFastMovingProducts(
    products: Product[],
    sales: Sale[],
    days: number = 30,
    limit?: number,
    referenceDate: Date = new Date()
  ): FastMovingProductItem[] {
    const cutoff = new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffTime = cutoff.getTime();

    // Aggregate completed sales in period
    const productSalesMap = new Map<string, { unitsSold: number; revenue: number; cogs: number }>();

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;
      const saleTime = new Date(sale.dateTime).getTime();
      if (saleTime < cutoffTime) continue;

      for (const item of sale.items) {
        const current = productSalesMap.get(item.productId) || { unitsSold: 0, revenue: 0, cogs: 0 };
        const rev = typeof item.actualRevenue === 'number' ? item.actualRevenue : item.lineTotal;
        const cost = typeof item.lineCost === 'number' ? item.lineCost : item.quantity * item.unitCostSnapshot;

        current.unitsSold += item.quantity;
        current.revenue = Number((current.revenue + rev).toFixed(2));
        current.cogs = Number((current.cogs + cost).toFixed(2));
        productSalesMap.set(item.productId, current);
      }
    }

    const items: FastMovingProductItem[] = [];

    for (const product of products) {
      const saleData = productSalesMap.get(product.id);
      const unitsSold = saleData ? saleData.unitsSold : 0;
      if (unitsSold <= 0) continue; // Only products that actually sold

      const revenue = saleData ? saleData.revenue : 0;
      const cogs = saleData ? saleData.cogs : 0;
      const grossProfit = Number((revenue - cogs).toFixed(2));
      const coverage = this.calculateStockCoverage(product.currentStock, unitsSold, days);

      items.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitsSold,
        currentStock: product.currentStock,
        salesRevenue: revenue,
        grossProfit,
        avgDailySales: coverage.avgDailySales,
        stockCoverageDays: coverage.coverageDays,
        stockCoverageDisplay: coverage.display,
      });
    }

    // Rank by Units Sold descending, then by revenue
    items.sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      return b.salesRevenue - a.salesRevenue;
    });

    return limit ? items.slice(0, limit) : items;
  }

  /**
   * Dead Stock / Slow Moving Products (Section 17):
   * Products with NO sales during the selected period.
   * Terminology: "No Sales in Selected Period"
   */
  public static getProductsWithNoSales(
    products: Product[],
    sales: Sale[],
    days: number = 30,
    referenceDate: Date = new Date()
  ): NoSalesProductItem[] {
    const cutoff = new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffTime = cutoff.getTime();

    // Map of product sales across all time to know last sale date
    const lastSaleMap = new Map<string, { latestSaleTime: number; latestSaleDate: string; hasSaleInPeriod: boolean }>();

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;
      const saleTime = new Date(sale.dateTime).getTime();
      const inPeriod = saleTime >= cutoffTime;

      for (const item of sale.items) {
        const existing = lastSaleMap.get(item.productId);
        if (!existing || saleTime > existing.latestSaleTime) {
          lastSaleMap.set(item.productId, {
            latestSaleTime: saleTime,
            latestSaleDate: sale.dateTime,
            hasSaleInPeriod: (existing?.hasSaleInPeriod || false) || inPeriod,
          });
        } else if (inPeriod) {
          existing.hasSaleInPeriod = true;
        }
      }
    }

    const noSalesItems: NoSalesProductItem[] = [];

    // Filter active products
    const activeProducts = products.filter((p) => p.active !== false);

    for (const p of activeProducts) {
      const saleInfo = lastSaleMap.get(p.id);
      const soldInPeriod = saleInfo ? saleInfo.hasSaleInPeriod : false;

      if (!soldInPeriod) {
        let daysSinceLastSaleDisplay = 'Never sold';
        if (saleInfo) {
          const diffMs = referenceDate.getTime() - saleInfo.latestSaleTime;
          const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          daysSinceLastSaleDisplay = `${diffDays} days ago`;
        }

        noSalesItems.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
          minimumStock: p.minimumStock,
          costPrice: p.costPrice,
          inventoryValue: this.calculateInventoryValue(p),
          stockStatus: this.getStockStatus(p),
          lastSaleDate: saleInfo?.latestSaleDate,
          daysSinceLastSaleDisplay,
        });
      }
    }

    // Sort by inventory value descending (highest value tied up first)
    noSalesItems.sort((a, b) => b.inventoryValue - a.inventoryValue);

    return noSalesItems;
  }

  /**
   * Stock Summary & Stock Health (Section 21)
   */
  public static getStockHealthSummary(
    products: Product[],
    sales: Sale[],
    days: number = 30,
    referenceDate: Date = new Date()
  ): StockHealthSummary {
    const activeProducts = products.filter((p) => p.active !== false);

    let totalUnitsInStock = 0;
    let totalInventoryValue = 0;
    let totalPotentialRetailValue = 0;
    let normalCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of activeProducts) {
      totalUnitsInStock += p.currentStock;
      totalInventoryValue += this.calculateInventoryValue(p);
      totalPotentialRetailValue += this.calculatePotentialRetailValue(p);

      const status = this.getStockStatus(p);
      if (status === 'NORMAL') normalCount++;
      else if (status === 'LOW_STOCK') lowStockCount++;
      else if (status === 'OUT_OF_STOCK') outOfStockCount++;
    }

    totalInventoryValue = Number(totalInventoryValue.toFixed(2));
    totalPotentialRetailValue = Number(totalPotentialRetailValue.toFixed(2));
    const totalPotentialGrossProfit = Number((totalPotentialRetailValue - totalInventoryValue).toFixed(2));

    const noSalesProducts = this.getProductsWithNoSales(products, sales, days, referenceDate);

    return {
      totalActiveProducts: activeProducts.length,
      totalUnitsInStock,
      totalInventoryValue,
      totalPotentialRetailValue,
      totalPotentialGrossProfit,
      normalCount,
      lowStockCount,
      outOfStockCount,
      noSalesCount: noSalesProducts.length,
    };
  }

  /**
   * Product 360° View Aggregator (Section 22 & 23):
   * Comprehensive authoritative view including:
   * - Product details & stock status
   * - Valuation & Potential Gross Margin
   * - Live Reconciliation
   * - Stock Movement Ledger
   * - Purchase History
   * - Sales Performance
   */
  public static getProduct360View(
    product: Product,
    movements: InventoryMovement[],
    sales: Sale[],
    purchases: Purchase[]
  ): Product360ViewData {
    const valuation = this.getProductValuation(product);
    const reconciliation = this.reconcileProduct(product, movements);

    // Filter and sort movements
    const productMovements = movements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const ledgerEntries: StockLedgerEntry[] = productMovements.map((m) => {
      const dt = new Date(m.createdAt);
      const date = dt.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = dt.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      let direction: '+' | '-' = '+';
      if (m.type === 'SALE' || (m.type === 'ADJUSTMENT' && m.quantity < 0)) {
        direction = '-';
      }

      return {
        id: m.id,
        date,
        time,
        formattedDateTime: `${date} ${time}`,
        productId: m.productId,
        productName: m.productName || product.name,
        type: m.type,
        direction,
        quantity: Math.abs(m.quantity),
        signedQuantity: m.quantity,
        previousStock: m.previousStock,
        newStock: m.newStock,
        referenceId: m.referenceId,
        reason: m.reason,
        runningBalance: m.newStock,
      };
    });

    // Purchases containing this product
    const productPurchases: Product360ViewData['purchases'] = [];
    let totalPurchasedUnits = 0;
    let totalPurchasedValue = 0;

    for (const po of purchases) {
      if (po.status !== 'COMPLETED') continue;
      const matchingItems = po.items.filter((item) => item.productId === product.id);
      for (const item of matchingItems) {
        totalPurchasedUnits += item.quantity;
        totalPurchasedValue += item.lineTotal;
        productPurchases.push({
          purchaseId: po.id,
          purchaseNumber: po.purchaseNumber,
          date: po.purchaseDate || po.createdAt,
          supplierName: po.supplierNameSnapshot,
          supplierCode: po.supplierCodeSnapshot,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal: item.lineTotal,
        });
      }
    }

    productPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Completed sales containing this product
    const productSales: Product360ViewData['sales'] = [];
    let totalSoldUnits = 0;
    let totalSalesRevenue = 0;
    let totalGrossProfit = 0;

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;
      const matchingItems = sale.items.filter((item) => item.productId === product.id);
      for (const item of matchingItems) {
        const rev = typeof item.actualRevenue === 'number' ? item.actualRevenue : item.lineTotal;
        const cost = typeof item.lineCost === 'number' ? item.lineCost : item.quantity * item.unitCostSnapshot;
        const profit = Number((rev - cost).toFixed(2));

        totalSoldUnits += item.quantity;
        totalSalesRevenue += rev;
        totalGrossProfit += profit;

        productSales.push({
          saleId: sale.id,
          transactionNumber: sale.transactionNumber,
          date: sale.dateTime,
          quantity: item.quantity,
          unitSellingPriceSnapshot: item.unitSellingPriceSnapshot,
          lineRevenue: rev,
          unitCostSnapshot: item.unitCostSnapshot,
          lineCost: cost,
          lineGrossProfit: profit,
        });
      }
    }

    productSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      product,
      stockStatus: valuation.stockStatus,
      valuation,
      reconciliation,
      movements: ledgerEntries,
      purchases: productPurchases,
      sales: productSales,
      summary: {
        totalPurchasedUnits,
        totalPurchasedValue: Number(totalPurchasedValue.toFixed(2)),
        totalSoldUnits,
        totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
        totalGrossProfit: Number(totalGrossProfit.toFixed(2)),
        movementCount: ledgerEntries.length,
      },
    };
  }
}
