import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Calendar,
  Eye,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Search,
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowUpDown,
  Filter,
  ShoppingCart,
  Percent,
  Truck,
  Building2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Sale, Product } from '../types';
import {
  ReportingService,
  DateRangePreset,
  DateRangeFilter,
} from '../services/reportingService';
import { InventoryService } from '../services/inventoryService';
import { PurchasingService } from '../services/purchasingService';
import { formatProfit, getProfitColorClass, formatCurrency, formatDateTime } from '../services/formatters';
import { SaleStatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ReceiptModal } from '../components/pos/ReceiptModal';

type ReportTab = 'OVERVIEW' | 'HISTORY' | 'PRODUCTS' | 'INVENTORY' | 'PURCHASING';

export const ReportsPage: React.FC = () => {
  const { store, products, sales, movements, suppliers, purchases } = useStore();

  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchSaleQuery, setSearchSaleQuery] = useState<string>('');

  // Analytics Interval
  const [analyticsInterval, setAnalyticsInterval] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');

  // Product Sort State
  const [productSortBy, setProductSortBy] = useState<'grossProfit' | 'revenue' | 'unitsSold' | 'margin'>('grossProfit');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [printReceiptSale, setPrintReceiptSale] = useState<Sale | null>(null);

  // Active Date Filter Object
  const activeDateFilter = useMemo<DateRangeFilter>(() => {
    return {
      preset: datePreset,
      customStartDate: datePreset === 'CUSTOM' ? customStartDate : undefined,
      customEndDate: datePreset === 'CUSTOM' ? customEndDate : undefined,
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered Completed Sales
  const filteredSales = useMemo(() => {
    const list = ReportingService.filterSales(sales, activeDateFilter);
    if (!searchSaleQuery.trim()) return list;

    const query = searchSaleQuery.toLowerCase().trim();
    return list.filter((s) => {
      const matchTrx = s.transactionNumber.toLowerCase().includes(query);
      const matchId = s.id.toLowerCase().includes(query);
      const matchItem = s.items.some((it) =>
        it.productNameSnapshot.toLowerCase().includes(query) ||
        (it.sku && it.sku.toLowerCase().includes(query))
      );
      return matchTrx || matchId || matchItem;
    });
  }, [sales, activeDateFilter, searchSaleQuery]);

  // Financial summary for filtered sales
  const summary = useMemo(() => {
    return ReportingService.calculateSalesSummary(filteredSales);
  }, [filteredSales]);

  // Product performance & best sellers (using filtered completed sales)
  const productPerformance = useMemo(() => {
    return ReportingService.getProfitByProduct(filteredSales, productSortBy, productSortOrder);
  }, [filteredSales, productSortBy, productSortOrder]);

  const bestSellers = useMemo(() => {
    return ReportingService.getBestSellers(filteredSales, 5);
  }, [filteredSales]);

  // Time Analytics for the Trends tab
  const timeAnalytics = useMemo(() => {
    return ReportingService.calculateTimeAnalytics(filteredSales, analyticsInterval);
  }, [filteredSales, analyticsInterval]);

  // Inventory valuation breakdown
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.active !== false);
  }, [products]);

  const inventoryValuation = useMemo(() => {
    const totalValue = activeProducts.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
    const totalUnits = activeProducts.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStock = activeProducts.filter((p) => InventoryService.isLowStock(p));
    const outOfStock = activeProducts.filter((p) => InventoryService.isOutOfStock(p));
    const normalStock = activeProducts.filter(
      (p) => !InventoryService.isLowStock(p) && !InventoryService.isOutOfStock(p)
    );

    return {
      totalValue: Number(totalValue.toFixed(2)),
      totalUnits,
      lowStock,
      outOfStock,
      normalStock,
    };
  }, [activeProducts]);

  // Purchasing analytics for the Purchasing tab
  const filteredPurchases = useMemo(() => {
    const bounds = ReportingService.getDateRangeBounds(activeDateFilter);
    return PurchasingService.filterPurchases(purchases, {
      startDate: bounds.start ?? undefined,
      endDate: bounds.end ?? undefined,
    });
  }, [purchases, activeDateFilter]);

  const purchasingSummary = useMemo(() => {
    const activeSuppliersCount = suppliers.filter((s) => s.active).length;
    return PurchasingService.calculatePurchasingSummary(filteredPurchases, activeSuppliersCount);
  }, [filteredPurchases, suppliers]);

  const supplierBreakdown = useMemo(() => {
    return PurchasingService.getSupplierPurchasingBreakdown(filteredPurchases, suppliers);
  }, [filteredPurchases, suppliers]);

  // Helper to change product sorting
  const handleSortToggle = (column: 'grossProfit' | 'revenue' | 'unitsSold' | 'margin') => {
    if (productSortBy === column) {
      setProductSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setProductSortBy(column);
      setProductSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Sales & Profit Management
          </h1>
          <p className="text-sm text-stone-500">
            Accounting reporting and audit trail for {store.name}. Grounded in completed sales, cost snapshots, and actual revenue.
          </p>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
          <button
            type="button"
            id="tab-overview"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Overview & Trends
          </button>
          <button
            type="button"
            id="tab-history"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Sales History ({filteredSales.length})
          </button>
          <button
            type="button"
            id="tab-products"
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'PRODUCTS'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Product Performance
          </button>
          <button
            type="button"
            id="tab-inventory"
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'INVENTORY'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Inventory Valuation
          </button>
          <button
            type="button"
            id="tab-purchasing"
            onClick={() => setActiveTab('PURCHASING')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'PURCHASING'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Purchasing & Vendors
          </button>
        </div>
      </div>

      {/* Date Range Filtering Toolbar (Applies to all reporting tabs) */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-stone-500 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <span>Filter Period:</span>
          </span>

          {(['ALL_TIME', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'] as DateRangePreset[]).map(
            (preset) => {
              const labelMap: Record<DateRangePreset, string> = {
                ALL_TIME: 'All Time',
                TODAY: 'Today',
                YESTERDAY: 'Yesterday',
                THIS_WEEK: 'This Week',
                THIS_MONTH: 'This Month',
                CUSTOM: 'Custom',
              };

              return (
                <button
                  key={preset}
                  type="button"
                  id={`filter-preset-${preset.toLowerCase()}`}
                  onClick={() => setDatePreset(preset)}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    datePreset === preset
                      ? 'bg-stone-900 text-white font-semibold'
                      : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            }
          )}

          <button
            type="button"
            id="filter-preset-custom"
            onClick={() => setDatePreset('CUSTOM')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              datePreset === 'CUSTOM'
                ? 'bg-stone-900 text-white font-semibold'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs bg-stone-50 p-1.5 rounded-lg border border-stone-200">
            <span className="text-stone-500">From:</span>
            <input
              type="date"
              id="custom-start-date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-300 rounded text-stone-800 text-xs font-mono"
            />
            <span className="text-stone-500">To:</span>
            <input
              type="date"
              id="custom-end-date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-300 rounded text-stone-800 text-xs font-mono"
            />
          </div>
        )}

        <div className="text-xs text-stone-500">
          Viewing <strong>{filteredSales.length}</strong> completed {filteredSales.length === 1 ? 'sale' : 'sales'}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & TRENDS */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Core Retail Accounting Equation Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
                <h2 className="font-bold text-stone-900 text-base">
                  Gross Profit Architecture Formula
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Formula Verified (Part 04)
              </span>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <strong>Gross Profit = Sales Revenue - COGS</strong>. Sales Revenue reflects actual revenue realized after discounts. COGS reflects historical cost snapshots of sold goods. (Store operating expenses are not included, so this is strictly Gross Profit, never Net Profit).
            </p>

            {/* Financial Summary Equation */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <div className="text-xs text-stone-500 mb-1">Sales Revenue</div>
                <div className="text-xl font-bold font-mono text-stone-900">
                  {store.currency} {summary.totalRevenue.toFixed(2)}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Actual net takings after discounts
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <div className="text-xs text-stone-500 mb-1">Cost of Goods Sold (COGS)</div>
                <div className="text-xl font-bold font-mono text-stone-700">
                  {store.currency} {summary.totalCOGS.toFixed(2)}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Historical cost snapshots of sold items
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-900 text-white text-center">
                <div className="text-xs text-emerald-300 mb-1">Gross Profit</div>
                <div className="text-xl font-bold font-mono text-white">
                  {formatProfit(summary.grossProfit, store.currency)}
                </div>
                <div className="text-[11px] text-emerald-200 mt-1">
                  Gross Margin: {summary.grossMarginPercentage}%
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <div className="text-xs text-stone-500 mb-1">Avg Transaction Value</div>
                <div className="text-xl font-bold font-mono text-stone-900">
                  {store.currency} {summary.averageTransactionValue.toFixed(2)}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Across {summary.totalTransactions} transactions ({summary.totalItemsSold} items)
                </div>
              </div>
            </div>
          </div>

          {/* Time Analytics Trends (Daily, Weekly, Monthly) */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-stone-900 text-base">
                  Sales & Gross Profit Trends
                </h3>
                <p className="text-xs text-stone-500">
                  Aggregated performance breakdown over time
                </p>
              </div>

              {/* Interval Switcher */}
              <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-semibold">
                <button
                  type="button"
                  id="interval-daily"
                  onClick={() => setAnalyticsInterval('DAILY')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    analyticsInterval === 'DAILY'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  id="interval-weekly"
                  onClick={() => setAnalyticsInterval('WEEKLY')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    analyticsInterval === 'WEEKLY'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  id="interval-monthly"
                  onClick={() => setAnalyticsInterval('MONTHLY')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    analyticsInterval === 'MONTHLY'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {timeAnalytics.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                No completed sales in this time window.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Chart Bars */}
                <div className="space-y-2 pt-2">
                  {timeAnalytics.map((bucket) => {
                    const maxRevenue = Math.max(...timeAnalytics.map((b) => b.salesRevenue), 1);
                    const revWidth = Math.min(100, Math.max(5, (bucket.salesRevenue / maxRevenue) * 100));
                    const cogsWidth = bucket.salesRevenue > 0
                      ? Math.min(100, (bucket.cogs / bucket.salesRevenue) * revWidth)
                      : 0;

                    return (
                      <div key={bucket.key} className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-stone-900">{bucket.label}</span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-stone-600">
                              Sales: <strong>{store.currency} {bucket.salesRevenue.toFixed(2)}</strong>
                            </span>
                            <span className="text-stone-500">
                              COGS: {store.currency} {bucket.cogs.toFixed(2)}
                            </span>
                            <span className={`font-bold ${getProfitColorClass(bucket.grossProfit)}`}>
                              GP: {formatProfit(bucket.grossProfit, store.currency)} ({bucket.grossMarginPercentage}%)
                            </span>
                          </div>
                        </div>

                        {/* Bar Visualizer */}
                        <div className="w-full bg-stone-200 h-3 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-600 h-full transition-all duration-300 rounded-l-full"
                            style={{ width: `${Math.max(0, revWidth - cogsWidth)}%` }}
                            title="Gross Profit"
                          />
                          <div
                            className="bg-stone-400 h-full transition-all duration-300"
                            style={{ width: `${cogsWidth}%` }}
                            title="COGS"
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-stone-400 mt-1">
                          <span>{bucket.transactionCount} transactions • {bucket.itemsSold} items sold</span>
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-600"></span> Profit
                            <span className="inline-block w-2 h-2 rounded-full bg-stone-400"></span> COGS
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALES HISTORY LOG */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Auditable Completed Sales Log ({filteredSales.length} Transactions)
              </h3>
              <p className="text-xs text-stone-500">
                Only completed transactions are included. Immutable historical records with snapshots.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                id="search-sales-history"
                placeholder="Search transaction # or item..."
                value={searchSaleQuery}
                onChange={(e) => setSearchSaleQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" id="table-sales-history">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3.5">Sale ID</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-3 py-3.5">Time</th>
                  <th className="px-3 py-3.5 text-center">Items</th>
                  <th className="px-4 py-3.5 text-right">Sales Revenue</th>
                  <th className="px-4 py-3.5 text-right">COGS</th>
                  <th className="px-4 py-3.5 text-right">Gross Profit</th>
                  <th className="px-3 py-3.5 text-right">Margin %</th>
                  <th className="px-3 py-3.5 text-center">Payment</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-stone-400 text-xs">
                      No completed sales recorded for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const saleDate = new Date(sale.dateTime);
                    const totalQty = sale.items.reduce((sum, it) => sum + it.quantity, 0);
                    const margin =
                      sale.total > 0
                        ? Number(((sale.grossProfit / sale.total) * 100).toFixed(2))
                        : 0;

                    return (
                      <tr key={sale.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-stone-900">
                          {sale.transactionNumber}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-stone-600">
                          {saleDate.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        <td className="px-3 py-3.5 text-xs text-stone-500 font-mono">
                          {saleDate.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="px-3 py-3.5 text-center text-xs font-mono text-stone-700">
                          {totalQty} {totalQty === 1 ? 'unit' : 'units'}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-stone-900 text-xs">
                          {store.currency} {sale.total.toFixed(2)}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono text-xs text-stone-500">
                          {store.currency} {sale.totalCost.toFixed(2)}
                        </td>

                        <td
                          className={`px-4 py-3.5 text-right font-mono text-xs font-bold ${getProfitColorClass(
                            sale.grossProfit
                          )}`}
                        >
                          {formatProfit(sale.grossProfit, store.currency)}
                        </td>

                        <td className="px-3 py-3.5 text-right font-mono text-xs text-stone-600">
                          {margin}%
                        </td>

                        <td className="px-3 py-3.5 text-center text-[11px] font-semibold">
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            {sale.paymentMethod || 'CASH'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSale(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Sale</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRODUCT PERFORMANCE */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6">
          {/* Best Selling Products Ranking Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-base">
                  Best Selling Products (Ranked by Total Quantity Sold)
                </h3>
                <p className="text-xs text-stone-500">
                  Identifies volume movers based on completed sales items
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                Top Volume Leaders
              </span>
            </div>

            {bestSellers.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No products sold yet in this period.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {bestSellers.map((item, index) => (
                  <div
                    key={item.productId}
                    className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 relative flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          #{index + 1}
                        </span>
                        <span className="text-[11px] font-mono text-stone-400">
                          {item.sku}
                        </span>
                      </div>
                      <div className="font-semibold text-stone-900 text-sm mt-1 truncate">
                        {item.productName}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-200/70 text-xs space-y-0.5">
                      <div className="flex justify-between text-stone-600">
                        <span>Units Sold:</span>
                        <strong className="font-mono text-stone-900">{item.unitsSold}</strong>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Revenue:</span>
                        <span className="font-mono">{store.currency} {item.salesRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Gross Profit:</span>
                        <span className={`font-mono font-semibold ${getProfitColorClass(item.grossProfit)}`}>
                          {formatProfit(item.grossProfit, store.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profit by Product Comprehensive Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Gross Profit by Product
                </h3>
                <p className="text-xs text-stone-500">
                  Item Revenue reflects actual allocated discounts. COGS reflects historical cost snapshots.
                </p>
              </div>

              <div className="text-xs text-stone-500">
                Sorted by: <strong>{productSortBy}</strong> ({productSortOrder.toUpperCase()})
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" id="table-profit-by-product">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5">Product Name</th>
                    <th className="px-3 py-3.5">SKU</th>
                    <th
                      className="px-3 py-3.5 text-center cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle('unitsSold')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Units Sold</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3.5 text-right cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle('revenue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Sales Revenue</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-right">COGS</th>
                    <th
                      className="px-4 py-3.5 text-right cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle('grossProfit')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Gross Profit</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3.5 text-right cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle('margin')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Gross Margin %</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {productPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-stone-400 text-xs">
                        No product sales recorded yet for this period.
                      </td>
                    </tr>
                  ) : (
                    productPerformance.map((item) => (
                      <tr key={item.productId} className="hover:bg-stone-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-stone-900 text-xs">
                          {item.productName}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-stone-500">
                          {item.sku}
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono text-xs text-stone-800">
                          {item.unitsSold}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-stone-900">
                          {store.currency} {item.salesRevenue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-stone-500">
                          {store.currency} {item.cogs.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-right font-mono text-xs font-bold ${getProfitColorClass(
                            item.grossProfit
                          )}`}
                        >
                          {formatProfit(item.grossProfit, store.currency)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono text-xs text-stone-700">
                          {item.grossMarginPercentage}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INVENTORY VALUATION & HEALTH */}
      {/* ========================================================================= */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
          {/* Inventory Valuation Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Total Inventory Value</span>
                <Package className="w-4 h-4 text-stone-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900">
                {store.currency} {inventoryValuation.totalValue.toFixed(2)}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Current Stock × Cost Price (active products)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Units on Hand</span>
                <Boxes className="w-4 h-4 text-stone-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900">
                {inventoryValuation.totalUnits}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Across {activeProducts.length} active SKUs
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-medium">Low Stock Count</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700">
                {inventoryValuation.lowStock.length}
              </div>
              <span className="text-[11px] text-amber-600/80 block mt-0.5">
                0 &lt; Stock &lt; Minimum Threshold
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-xs font-medium">Out of Stock Count</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-700">
                {inventoryValuation.outOfStock.length}
              </div>
              <span className="text-[11px] text-rose-600/80 block mt-0.5">
                Stock &le; 0 units
              </span>
            </div>
          </div>

          {/* Active Inventory Valuation Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50/50">
              <h3 className="font-bold text-stone-900 text-sm">
                Active Catalog Inventory Valuation Breakdown
              </h3>
              <p className="text-xs text-stone-500">
                Current stock holding and cost valuation
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-3 py-3.5">SKU</th>
                    <th className="px-3 py-3.5 text-center">Current Stock</th>
                    <th className="px-3 py-3.5 text-center">Min Threshold</th>
                    <th className="px-3 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Cost Price</th>
                    <th className="px-4 py-3.5 text-right">Selling Price</th>
                    <th className="px-4 py-3.5 text-right">Total Holding Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {activeProducts.map((p) => {
                    const status = InventoryService.getStockStatus(p);
                    const holdingValue = p.currentStock * p.costPrice;

                    return (
                      <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-stone-900 text-xs">
                          {p.name}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-stone-500">
                          {p.sku}
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono text-xs font-bold text-stone-900">
                          {p.currentStock}
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono text-xs text-stone-500">
                          {p.minimumStock}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              status === 'OUT_OF_STOCK'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : status === 'LOW_STOCK'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {status === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : status === 'LOW_STOCK' ? 'LOW STOCK' : 'NORMAL'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-stone-500">
                          {store.currency} {p.costPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-stone-900">
                          {store.currency} {p.sellingPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-stone-900">
                          {store.currency} {holdingValue.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PURCHASING & VENDORS (Part 05 Integration) */}
      {/* ========================================================================= */}
      {activeTab === 'PURCHASING' && (
        <div className="space-y-6">
          {/* Accounting & Profit Clarity Notice (Section 30) */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-900">
                Accounting Notice & Profit Clarity (Retail Accounting Standards)
              </p>
              <p className="text-amber-800 leading-relaxed">
                <strong>Gross Profit = Actual Sales Revenue - COGS.</strong> Total purchase expenditure represents inventory acquisition, not Cost of Goods Sold. Purchasing expenditure is <em>never</em> subtracted directly from sales revenue to compute Gross Profit. COGS is recognized strictly when items are sold via POS transactions.
              </p>
            </div>
          </div>

          {/* Purchasing KPI Cards (Section 29) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Purchases Count</span>
                <Truck className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900">
                {purchasingSummary.completedPurchases}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                {purchasingSummary.draftPurchases > 0
                  ? `${purchasingSummary.draftPurchases} pending draft`
                  : 'Completed orders in period'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Total Purchase Value</span>
                <DollarSign className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900">
                {formatCurrency(purchasingSummary.totalPurchaseValue, store.currency)}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Inventory acquisition cost
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Units Purchased</span>
                <Boxes className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                {purchasingSummary.totalUnitsPurchased}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Total stock received
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium">Active Suppliers</span>
                <Building2 className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900">
                {purchasingSummary.activeSuppliers}
              </div>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Vendors in catalog
              </span>
            </div>
          </div>

          {/* Supplier Breakdown Table (Section 29) */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Supplier Procurement Breakdown</h3>
                <p className="text-xs text-stone-500">
                  Procurement volume and total holding cost by vendor for the selected period
                </p>
              </div>
            </div>

            {supplierBreakdown.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs">
                No completed purchases recorded in the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3.5">Supplier</th>
                      <th className="px-3 py-3.5">Code</th>
                      <th className="px-3 py-3.5 text-center">Purchases</th>
                      <th className="px-3 py-3.5 text-center">Units Received</th>
                      <th className="px-4 py-3.5 text-right">Total Purchase Value</th>
                      <th className="px-4 py-3.5 text-right">% of Procurement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {supplierBreakdown.map((sb) => {
                      const sharePct =
                        purchasingSummary.totalPurchaseValue > 0
                          ? ((sb.totalValue / purchasingSummary.totalPurchaseValue) * 100).toFixed(1)
                          : '0.0';

                      return (
                        <tr key={sb.supplierId} className="hover:bg-stone-50/70 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-stone-900 text-xs">
                            {sb.supplierName}
                          </td>
                          <td className="px-3 py-3.5 font-mono text-xs text-stone-500">
                            {sb.supplierCode}
                          </td>
                          <td className="px-3 py-3.5 text-center font-mono text-xs font-bold text-stone-900">
                            {sb.purchasesCount}
                          </td>
                          <td className="px-3 py-3.5 text-center font-mono text-xs text-stone-700">
                            {sb.totalUnits}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-stone-900">
                            {formatCurrency(sb.totalValue, store.currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs text-stone-600">
                            {sharePct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Received Purchases List */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50/50">
              <h3 className="font-bold text-stone-900 text-sm">Received Purchases in Period</h3>
              <p className="text-xs text-stone-500">
                Audit trail of completed supplier receipts
              </p>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs">
                No purchase records found in the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3">PO #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50/70 text-xs">
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">
                          {p.purchaseNumber}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {formatDateTime(p.purchaseDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-stone-900">{p.supplierNameSnapshot}</span>
                          <span className="font-mono text-stone-400 text-[10px] ml-1">({p.supplierCodeSnapshot})</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-stone-700">
                          {p.items.length}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(p.total, store.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TRANSACTION DETAILS AUDIT MODAL (Section 9) */}
      {/* ========================================================================= */}
      {selectedSale && (
        <Modal
          id="sale-details-modal"
          isOpen={!!selectedSale}
          onClose={() => setSelectedSale(null)}
          title={`Audit Snapshot: ${selectedSale.transactionNumber}`}
          subtitle={`Recorded on ${new Date(selectedSale.dateTime).toLocaleString()}`}
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Snapshot explanation */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Data Integrity Notice:</strong> Unit cost and selling price snapshots are immutable records created at the moment of checkout. Catalog modifications will never overwrite these historical transaction economics.
              </span>
            </div>

            {/* Transaction Information Panel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Sale ID</span>
                <span className="font-mono font-bold text-stone-900">{selectedSale.transactionNumber}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Payment Method</span>
                <span className="font-semibold text-stone-800">{selectedSale.paymentMethod || 'CASH'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Tendered Cash</span>
                <span className="font-mono text-stone-800">
                  {store.currency} {(selectedSale.cashReceived ?? selectedSale.total).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Change Given</span>
                <span className="font-mono text-stone-800">
                  {store.currency} {(selectedSale.change ?? 0).toFixed(2)}
                </span>
              </div>
              {selectedSale.notes && (
                <div className="col-span-2 sm:col-span-4 pt-1 border-t border-stone-200/60 text-stone-500">
                  <span className="font-semibold">Notes:</span> {selectedSale.notes}
                </div>
              )}
            </div>

            {/* Itemized Snapshot Table */}
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 font-semibold text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Item Revenue</th>
                    <th className="px-3 py-2 text-right">Item COGS</th>
                    <th className="px-3 py-2 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {selectedSale.items.map((item) => {
                    const itemRevenue =
                      typeof item.actualRevenue === 'number'
                        ? item.actualRevenue
                        : Number((item.lineTotal - (item.allocatedDiscount || 0)).toFixed(2));
                    const itemCost =
                      typeof item.lineCost === 'number'
                        ? item.lineCost
                        : Number((item.quantity * item.unitCostSnapshot).toFixed(2));
                    const itemGP =
                      typeof item.grossProfit === 'number'
                        ? item.grossProfit
                        : Number((itemRevenue - itemCost).toFixed(2));

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-sans font-medium text-stone-900">
                          {item.productNameSnapshot}
                        </td>
                        <td className="px-2 py-2 text-stone-500 text-[11px]">
                          {item.sku || 'N/A'}
                        </td>
                        <td className="px-2 py-2 text-center text-stone-800">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-stone-700">
                          {store.currency} {item.unitSellingPriceSnapshot.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-stone-500">
                          {store.currency} {item.unitCostSnapshot.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-stone-900">
                          {store.currency} {itemRevenue.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-stone-500">
                          {store.currency} {itemCost.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${getProfitColorClass(itemGP)}`}>
                          {formatProfit(itemGP, store.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Transaction Financial Summary */}
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1 text-right">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span className="font-mono">{store.currency} {selectedSale.subtotal.toFixed(2)}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>Cart Discount Allocated:</span>
                  <span className="font-mono">-{store.currency} {selectedSale.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
                <span>Actual Sales Revenue:</span>
                <span className="font-mono text-sm">{store.currency} {selectedSale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Total COGS (Cost of Goods Sold):</span>
                <span className="font-mono">{store.currency} {selectedSale.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-dashed border-stone-200">
                <span className="text-stone-800">
                  Gross Profit Realized (Margin:{' '}
                  {selectedSale.total > 0
                    ? Number(((selectedSale.grossProfit / selectedSale.total) * 100).toFixed(2))
                    : 0}
                  %):
                </span>
                <span className={`font-mono text-sm ${getProfitColorClass(selectedSale.grossProfit)}`}>
                  {formatProfit(selectedSale.grossProfit, store.currency)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setPrintReceiptSale(selectedSale)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-stone-500" />
                <span>Print Thermal Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Thermal Receipt Modal */}
      {printReceiptSale && (
        <ReceiptModal
          isOpen={!!printReceiptSale}
          onClose={() => setPrintReceiptSale(null)}
          sale={printReceiptSale}
          store={store}
          isNewSaleSuccess={false}
        />
      )}
    </div>
  );
};
