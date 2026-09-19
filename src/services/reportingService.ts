/**
 * NiagaPOS - Sales & Profit Management / Reporting Domain Service
 * Part 04: Sales & Profit Management / Reporting
 * 
 * Core Accounting Principles:
 * 1. Sales Revenue = Sum of actual SaleItem revenue (after discount allocation).
 * 2. COGS = Sum(quantity * historical unit cost snapshot).
 * 3. Gross Profit = Sales Revenue - COGS.
 * 4. Gross Margin % = (Gross Profit / Sales Revenue) * 100. (If Sales Revenue == 0 -> 0%).
 * 5. NEVER call it Net Profit / Net Income / Final Profit (store expenses are untracked).
 * 6. Supports negative Gross Profit (e.g. -RM0.20, -20.00%).
 * 7. Completed sales only (excludes void, refunded, incomplete, or abandoned sales).
 * 8. Strict historical snapshot protection: Never recalculate historical prices using current Product records.
 */

import { Product, Sale, SaleItem } from '../types';
import { InventoryService } from './inventoryService';

export type DateRangePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL_TIME' | 'CUSTOM';

export interface DateRangeFilter {
  preset: DateRangePreset;
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string;   // YYYY-MM-DD
}

export interface DashboardKPIs {
  // Primary KPI Cards
  todaySales: number;
  todayCOGS: number;
  todayGrossProfit: number;
  todayTransactions: number;
  // Secondary KPI Cards
  todayItemsSold: number;
  averageTransactionValue: number;
  inventoryValue: number;
  totalInventoryUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  normalStockCount: number;
  activeProductsCount: number;
}

export interface SalesSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercentage: number;
  totalTransactions: number;
  totalItemsSold: number;
  averageTransactionValue: number;
}

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercentage: number;
}

export interface TimeAnalyticsBucket {
  key: string;
  label: string;
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercentage: number;
  transactionCount: number;
  itemsSold: number;
}

export class ReportingService {
  /**
   * Formats a local Date into YYYY-MM-DD string
   */
  public static toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Computes store-local start and end timestamps for any date range preset.
   */
  public static getDateRangeBounds(
    filter: DateRangeFilter,
    referenceDate: Date = new Date()
  ): { start: Date; end: Date; label: string } {
    const ref = new Date(referenceDate);

    switch (filter.preset) {
      case 'TODAY': {
        const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
        return { start, end, label: "Today" };
      }
      case 'YESTERDAY': {
        const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        return { start, end, label: "Yesterday" };
      }
      case 'THIS_WEEK': {
        // Monday-based week start
        const currentDay = ref.getDay(); // 0 = Sunday, 1 = Monday, ...
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday);
        const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        const end = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
        return { start, end, label: "This Week" };
      }
      case 'THIS_MONTH': {
        const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
        const nextMonthFirst = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
        const end = new Date(nextMonthFirst.getTime() - 1);
        return { start, end, label: "This Month" };
      }
      case 'CUSTOM': {
        let start: Date;
        let end: Date;
        if (filter.customStartDate) {
          const parts = filter.customStartDate.split('-').map(Number);
          start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        } else {
          start = new Date(1970, 0, 1, 0, 0, 0, 0);
        }

        if (filter.customEndDate) {
          const parts = filter.customEndDate.split('-').map(Number);
          end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
        } else {
          end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
        }

        const label = filter.customStartDate && filter.customEndDate
          ? `${filter.customStartDate} to ${filter.customEndDate}`
          : "Custom Range";
        return { start, end, label };
      }
      case 'ALL_TIME':
      default: {
        return {
          start: new Date(1970, 0, 1, 0, 0, 0, 0),
          end: new Date(2100, 11, 31, 23, 59, 59, 999),
          label: "All Time",
        };
      }
    }
  }

  /**
   * Filters sales strictly by status === 'COMPLETED' and date range boundaries.
   */
  public static filterSales(
    sales: Sale[],
    filter: DateRangeFilter,
    referenceDate: Date = new Date()
  ): Sale[] {
    const { start, end } = this.getDateRangeBounds(filter, referenceDate);
    const startTime = start.getTime();
    const endTime = end.getTime();

    return sales.filter((sale) => {
      if (sale.status !== 'COMPLETED') return false;
      const saleTime = new Date(sale.dateTime).getTime();
      return saleTime >= startTime && saleTime <= endTime;
    });
  }

  /**
   * Computes standard retail summary on a list of completed sales.
   * Zero revenue protection: Margin = 0.00% when Revenue = 0.
   */
  public static calculateSalesSummary(sales: Sale[]): SalesSummary {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalItemsSold = 0;
    let completedCount = 0;

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;
      completedCount++;
      totalRevenue += sale.total;
      totalCOGS += sale.totalCost;

      for (const item of sale.items) {
        totalItemsSold += item.quantity;
      }
    }

    totalRevenue = Number(totalRevenue.toFixed(2));
    totalCOGS = Number(totalCOGS.toFixed(2));
    const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2));

    const grossMarginPercentage =
      totalRevenue > 0
        ? Number(((grossProfit / totalRevenue) * 100).toFixed(2))
        : 0;

    const averageTransactionValue =
      completedCount > 0
        ? Number((totalRevenue / completedCount).toFixed(2))
        : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMarginPercentage,
      totalTransactions: completedCount,
      totalItemsSold,
      averageTransactionValue,
    };
  }

  /**
   * Computes full dashboard KPIs adhering to Part 01.5 rules and Part 04 requirements.
   */
  public static calculateDashboardKPIs(
    products: Product[],
    sales: Sale[],
    referenceDate: Date = new Date()
  ): DashboardKPIs {
    // 1. Filter Today's completed sales
    const todaySales = this.filterSales(sales, { preset: 'TODAY' }, referenceDate);
    const todaySummary = this.calculateSalesSummary(todaySales);

    // 2. Inventory calculations across active products
    const activeProducts = products.filter((p) => p.active !== false);
    let inventoryValue = 0;
    let totalInventoryUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let normalStockCount = 0;

    for (const product of activeProducts) {
      totalInventoryUnits += product.currentStock;
      inventoryValue += product.currentStock * product.costPrice;

      // Part 01.5 Rule:
      // currentStock <= 0 -> OUT_OF_STOCK
      // 0 < currentStock < minimumStock -> LOW_STOCK
      // currentStock >= minimumStock -> NORMAL
      if (InventoryService.isOutOfStock(product)) {
        outOfStockCount++;
      } else if (InventoryService.isLowStock(product)) {
        lowStockCount++;
      } else {
        normalStockCount++;
      }
    }

    inventoryValue = Number(inventoryValue.toFixed(2));

    return {
      todaySales: todaySummary.totalRevenue,
      todayCOGS: todaySummary.totalCOGS,
      todayGrossProfit: todaySummary.grossProfit,
      todayTransactions: todaySummary.totalTransactions,
      todayItemsSold: todaySummary.totalItemsSold,
      averageTransactionValue: todaySummary.averageTransactionValue,
      inventoryValue,
      totalInventoryUnits,
      lowStockCount,
      outOfStockCount,
      normalStockCount,
      activeProductsCount: activeProducts.length,
    };
  }

  /**
   * Computes product performance aggregated by product.
   * Derives metrics strictly from historical snapshots stored in SaleItem.
   * Never relies on current Product.costPrice or Product.sellingPrice.
   */
  public static calculateProductPerformance(sales: Sale[]): ProductPerformanceItem[] {
    const productMap = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      unitsSold: number;
      salesRevenue: number;
      cogs: number;
    }>();

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;

      for (const item of sale.items) {
        const prodKey = item.productId || item.productNameSnapshot;
        const current = productMap.get(prodKey) || {
          productId: item.productId,
          productName: item.productNameSnapshot,
          sku: item.sku || 'N/A',
          unitsSold: 0,
          salesRevenue: 0,
          cogs: 0,
        };

        const itemRevenue =
          typeof item.actualRevenue === 'number'
            ? item.actualRevenue
            : Number((item.lineTotal - (item.allocatedDiscount || 0)).toFixed(2));

        const itemCost =
          typeof item.lineCost === 'number'
            ? item.lineCost
            : Number((item.quantity * item.unitCostSnapshot).toFixed(2));

        current.unitsSold += item.quantity;
        current.salesRevenue = Number((current.salesRevenue + itemRevenue).toFixed(2));
        current.cogs = Number((current.cogs + itemCost).toFixed(2));
        if (item.sku && current.sku === 'N/A') {
          current.sku = item.sku;
        }

        productMap.set(prodKey, current);
      }
    }

    const result: ProductPerformanceItem[] = [];
    for (const item of productMap.values()) {
      const grossProfit = Number((item.salesRevenue - item.cogs).toFixed(2));
      const grossMarginPercentage =
        item.salesRevenue > 0
          ? Number(((grossProfit / item.salesRevenue) * 100).toFixed(2))
          : 0;

      result.push({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unitsSold: item.unitsSold,
        salesRevenue: item.salesRevenue,
        cogs: item.cogs,
        grossProfit,
        grossMarginPercentage,
      });
    }

    return result;
  }

  /**
   * Best Selling Products: Ranked by Total Quantity Sold descending.
   */
  public static getBestSellers(sales: Sale[], limit?: number): ProductPerformanceItem[] {
    const items = this.calculateProductPerformance(sales);
    items.sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) {
        return b.unitsSold - a.unitsSold;
      }
      return b.salesRevenue - a.salesRevenue;
    });

    return limit ? items.slice(0, limit) : items;
  }

  /**
   * Profit by Product: Ranked by Gross Profit descending (supports negative gross profit).
   */
  public static getProfitByProduct(
    sales: Sale[],
    sortBy: 'grossProfit' | 'revenue' | 'unitsSold' | 'margin' = 'grossProfit',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): ProductPerformanceItem[] {
    const items = this.calculateProductPerformance(sales);

    items.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'revenue':
          comparison = a.salesRevenue - b.salesRevenue;
          break;
        case 'unitsSold':
          comparison = a.unitsSold - b.unitsSold;
          break;
        case 'margin':
          comparison = a.grossMarginPercentage - b.grossMarginPercentage;
          break;
        case 'grossProfit':
        default:
          comparison = a.grossProfit - b.grossProfit;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return items;
  }

  /**
   * Computes time series analytics for daily, weekly, or monthly intervals.
   */
  public static calculateTimeAnalytics(
    sales: Sale[],
    interval: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    referenceDate: Date = new Date()
  ): TimeAnalyticsBucket[] {
    const completedSales = sales.filter((s) => s.status === 'COMPLETED');
    const bucketsMap = new Map<string, {
      key: string;
      label: string;
      salesRevenue: number;
      cogs: number;
      transactionCount: number;
      itemsSold: number;
      sortKey: string;
    }>();

    for (const sale of completedSales) {
      const saleDate = new Date(sale.dateTime);
      let key = '';
      let label = '';
      let sortKey = '';

      if (interval === 'DAILY') {
        key = this.toLocalDateString(saleDate);
        sortKey = key;
        label = saleDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      } else if (interval === 'WEEKLY') {
        // Find Monday of the week
        const day = saleDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate() + diff);
        key = `W-${this.toLocalDateString(monday)}`;
        sortKey = key;
        label = `Wk of ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      } else if (interval === 'MONTHLY') {
        const year = saleDate.getFullYear();
        const month = String(saleDate.getMonth() + 1).padStart(2, '0');
        key = `${year}-${month}`;
        sortKey = key;
        label = saleDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      }

      const existing = bucketsMap.get(key) || {
        key,
        label,
        salesRevenue: 0,
        cogs: 0,
        transactionCount: 0,
        itemsSold: 0,
        sortKey,
      };

      existing.salesRevenue = Number((existing.salesRevenue + sale.total).toFixed(2));
      existing.cogs = Number((existing.cogs + sale.totalCost).toFixed(2));
      existing.transactionCount += 1;
      for (const it of sale.items) {
        existing.itemsSold += it.quantity;
      }

      bucketsMap.set(key, existing);
    }

    // Sort buckets chronologically
    const sorted = Array.from(bucketsMap.values()).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );

    return sorted.map((b) => {
      const grossProfit = Number((b.salesRevenue - b.cogs).toFixed(2));
      const grossMarginPercentage =
        b.salesRevenue > 0
          ? Number(((grossProfit / b.salesRevenue) * 100).toFixed(2))
          : 0;

      return {
        key: b.key,
        label: b.label,
        salesRevenue: b.salesRevenue,
        cogs: b.cogs,
        grossProfit,
        grossMarginPercentage,
        transactionCount: b.transactionCount,
        itemsSold: b.itemsSold,
      };
    });
  }
}
