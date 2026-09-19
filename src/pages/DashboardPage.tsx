import React from 'react';
import {
  DollarSign,
  Receipt,
  Package,
  Boxes,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  HelpCircle,
  Clock,
  ShoppingCart,
  Percent,
  XCircle,
  Tag,
  Store as StoreIcon,
  Sparkles,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { StatCard } from '../components/common/StatCard';
import { ActivePage, Product } from '../types';
import type { Workspace } from '../types/workspace';
import { ReportingService } from '../services/reportingService';
import { InventoryService } from '../services/inventoryService';
import { formatProfit, getProfitColorClass } from '../services/formatters';
import { NIAGAPOS_ASSETS } from '../constants/branding';

interface DashboardPageProps {
  onNavigate: (page: ActivePage) => void;
  currentWorkspace?: Workspace | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, currentWorkspace }) => {
  const { store, products, sales } = useStore();

  // Grounded Part 04 KPI calculations
  const kpis = ReportingService.calculateDashboardKPIs(products, sales);
  const allTimeSummary = ReportingService.calculateSalesSummary(sales);

  const lowStockProducts = products.filter((p) => p.active !== false && InventoryService.isLowStock(p));
  const outOfStockProducts = products.filter((p) => p.active !== false && InventoryService.isOutOfStock(p));

  // Today's Gross Margin % (Zero revenue protection)
  const todayGrossMargin =
    kpis.todaySales > 0
      ? Number(((kpis.todayGrossProfit / kpis.todaySales) * 100).toFixed(2))
      : 0;

  // Best sellers for quick overview
  const topBestSellers = ReportingService.getBestSellers(sales, 3);

  return (
    <div className="space-y-6">
      {/* Brand / Hero Area */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-5 sm:p-6 text-white shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4 max-w-xl">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1.5 shadow-sm border border-white/40 flex items-center justify-center shrink-0">
            <img
              src={NIAGAPOS_ASSETS.logoSvg}
              alt="NiagaPOS"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
              }}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-emerald-100 backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>{store.name} • Pusat Kawalan Peruncitan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Selamat Datang ke Niaga<span className="text-red-400">POS</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Sistem pengurusan kedai runcit yang mudah, fleksibel dan lengkap. Pantau jualan harian, baki inventori, dan transaksi secara masa nyata.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            id="dashboard-hero-open-pos-btn"
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs sm:text-sm hover:bg-emerald-50 transition shadow-xs cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            <span>Buka Kaunter POS</span>
          </button>
          <button
            type="button"
            id="dashboard-hero-check-stock-btn"
            onClick={() => onNavigate('inventory')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-900/80 border border-white/20 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <Boxes className="w-4 h-4" />
            <span>Semak Stok</span>
          </button>
          {!currentWorkspace && (
            <button
              type="button"
              id="dashboard-hero-open-konsol-btn"
              onClick={() => onNavigate('konsol')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-900/80 hover:bg-stone-950 border border-stone-700/60 text-emerald-300 font-semibold text-xs sm:text-sm transition cursor-pointer shadow-xs"
              title="Buka Konsol Master Admin NiagaPOS (Pengurusan Klien & Onboarding)"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Konsol Klien</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Dashboard Overview
          </h2>
          <p className="text-xs text-stone-500">
            Real-time retail business intelligence for {store.name}. Grounded in completed sales, cost snapshots, and active inventory.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500 bg-white border border-stone-200 px-3 py-1.5 rounded-xl shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>Currency: <strong>{store.currency}</strong></span>
        </div>
      </div>

      {/* The 4 Fundamental Retail Questions Panel */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            <HelpCircle className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-stone-900 tracking-tight">
            The 4 Fundamental Retail Questions
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:bg-stone-50 transition">
            <span className="font-semibold text-stone-600 block mb-1">1. What products do I sell?</span>
            <div className="text-base font-bold text-stone-900 font-mono">
              {kpis.activeProductsCount} Active SKUs
            </div>
            <span className="text-stone-500 mt-0.5 block">{products.length} total registered in catalog</span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:bg-stone-50 transition">
            <span className="font-semibold text-stone-600 block mb-1">2. How many units do I have?</span>
            <div className="text-base font-bold text-stone-900 font-mono">
              {kpis.totalInventoryUnits} Units on hand
            </div>
            <span className="text-stone-500 mt-0.5 block">
              Worth {store.currency} {kpis.inventoryValue.toFixed(2)} at cost
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:bg-stone-50 transition">
            <span className="font-semibold text-stone-600 block mb-1">3. What products have been sold?</span>
            <div className="text-base font-bold text-stone-900 font-mono">
              {allTimeSummary.totalItemsSold} Items sold
            </div>
            <span className="text-stone-500 mt-0.5 block">Across {allTimeSummary.totalTransactions} recorded transactions</span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:bg-stone-50 transition">
            <span className="font-semibold text-stone-600 block mb-1">4. How much profit generated?</span>
            <div className={`text-base font-bold font-mono ${getProfitColorClass(allTimeSummary.grossProfit)}`}>
              {formatProfit(allTimeSummary.grossProfit, store.currency)}
            </div>
            <span className="text-stone-500 mt-0.5 block">
              Margin: {allTimeSummary.grossMarginPercentage}% (Revenue - COGS)
            </span>
          </div>
        </div>
      </div>

      {/* Part 04: Primary KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Today's Trading Performance (Primary KPIs)
          </h2>
          <span className="text-[11px] text-stone-400 font-mono">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            id="stat-card-today-sales"
            title="Today's Sales"
            value={`${store.currency} ${kpis.todaySales.toFixed(2)}`}
            subtitle={`All-time: ${store.currency} ${allTimeSummary.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            accent="blue"
          />

          <StatCard
            id="stat-card-today-cogs"
            title="Today's COGS"
            value={`${store.currency} ${kpis.todayCOGS.toFixed(2)}`}
            subtitle="Cost of goods sold (historical snapshots)"
            icon={Boxes}
            accent="stone"
          />

          <StatCard
            id="stat-card-today-profit"
            title="Today's Gross Profit"
            value={formatProfit(kpis.todayGrossProfit, store.currency)}
            subtitle={`Margin: ${todayGrossMargin}% (Sales - COGS)`}
            icon={TrendingUp}
            accent={kpis.todayGrossProfit >= 0 ? 'emerald' : 'amber'}
            badgeText={`${todayGrossMargin}% GP`}
          />

          <StatCard
            id="stat-card-today-transactions"
            title="Today's Transactions"
            value={kpis.todayTransactions}
            subtitle={`All-time: ${allTimeSummary.totalTransactions} completed`}
            icon={Receipt}
            accent="stone"
          />
        </div>
      </div>

      {/* Part 04: Secondary KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Store Efficiency & Inventory Health (Secondary KPIs)
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div id="stat-card-items-sold" className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-medium">Items Sold</span>
              <ShoppingCart className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {kpis.todayItemsSold}
            </div>
            <span className="text-[11px] text-stone-400 block mt-0.5">
              Today ({allTimeSummary.totalItemsSold} all-time)
            </span>
          </div>

          <div id="stat-card-atv" className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-medium">Avg Transaction</span>
              <DollarSign className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {store.currency} {kpis.averageTransactionValue.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400 block mt-0.5">
              ATV per sale today
            </span>
          </div>

          <div id="stat-card-inventory-value" className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-medium">Inventory Value</span>
              <Package className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {store.currency} {kpis.inventoryValue.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400 block mt-0.5">
              {kpis.totalInventoryUnits} units on hand
            </span>
          </div>

          <div
            id="stat-card-low-stock"
            onClick={() => {
              sessionStorage.setItem('inventory_initial_filter', 'LOW_STOCK');
              onNavigate('inventory');
            }}
            className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs cursor-pointer hover:bg-amber-50/40 transition-colors"
            title="Click to view Low Stock items in Inventory"
          >
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-xs font-medium">Low Stock</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-700">
              {kpis.lowStockCount}
            </div>
            <span className="text-[11px] text-amber-600/80 block mt-0.5">
              0 &lt; Stock &lt; Minimum
            </span>
          </div>

          <div
            id="stat-card-out-of-stock"
            onClick={() => {
              sessionStorage.setItem('inventory_initial_filter', 'OUT_OF_STOCK');
              onNavigate('inventory');
            }}
            className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs cursor-pointer hover:bg-rose-50/40 transition-colors"
            title="Click to view Out of Stock items in Inventory"
          >
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-xs font-medium">Out of Stock</span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-700">
              {kpis.outOfStockCount}
            </div>
            <span className="text-[11px] text-rose-600/80 block mt-0.5">
              Stock &le; 0 units
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Section: Low Stock Warning & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items Attention Box */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Low & Out of Stock Alerts
              </h3>
              <p className="text-xs text-stone-500">
                Active products requiring replenishment based on Part 01.5 thresholds
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              All inventory levels are currently above minimum thresholds.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {outOfStockProducts.map((prod: Product) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    sessionStorage.setItem('inventory_initial_filter', 'OUT_OF_STOCK');
                    onNavigate('inventory');
                  }}
                  className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/80 rounded-lg px-2 -mx-2 transition-colors"
                  title="View Out of Stock in Inventory"
                >
                  <div>
                    <div className="text-sm font-semibold text-stone-900">
                      {prod.name}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2">
                      <span>SKU: {prod.sku}</span>
                      <span>•</span>
                      <span>Min threshold: {prod.minimumStock} units</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      Out of stock (0)
                    </span>
                  </div>
                </div>
              ))}
              {lowStockProducts.map((prod: Product) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    sessionStorage.setItem('inventory_initial_filter', 'LOW_STOCK');
                    onNavigate('inventory');
                  }}
                  className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/80 rounded-lg px-2 -mx-2 transition-colors"
                  title="View Low Stock in Inventory"
                >
                  <div>
                    <div className="text-sm font-semibold text-stone-900">
                      {prod.name}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2">
                      <span>SKU: {prod.sku}</span>
                      <span>•</span>
                      <span>Min threshold: {prod.minimumStock} units</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {prod.currentStock} units left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions & Top Best Sellers */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Recent Completed Sales
                </h3>
                <p className="text-xs text-stone-500">
                  Auditable completed sales with cost snapshots
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Full Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {sales.filter((s) => s.status === 'COMPLETED').length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No completed sales recorded yet. Use the POS to register transactions.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {sales
                  .filter((s) => s.status === 'COMPLETED')
                  .slice(0, 4)
                  .map((sale) => (
                    <div
                      key={sale.id}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                          <span>{sale.transactionNumber}</span>
                          <span className="text-xs text-stone-400">
                            ({sale.items.reduce((sum, it) => sum + it.quantity, 0)} units)
                          </span>
                        </div>
                        <div className="text-xs text-stone-500">
                          {new Date(sale.dateTime).toLocaleDateString()} at{' '}
                          {new Date(sale.dateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-stone-900">
                          {store.currency} {sale.total.toFixed(2)}
                        </div>
                        <div className={`text-xs font-medium ${getProfitColorClass(sale.grossProfit)}`}>
                          {formatProfit(sale.grossProfit, store.currency)} GP
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {topBestSellers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Top Products by Volume Sold
              </div>
              <div className="grid grid-cols-3 gap-2">
                {topBestSellers.map((item, idx) => (
                  <div key={item.productId} className="p-2 rounded-lg bg-stone-50 border border-stone-100 text-xs">
                    <span className="text-[10px] font-bold text-stone-400 block">#{idx + 1}</span>
                    <span className="font-semibold text-stone-900 truncate block">{item.productName}</span>
                    <span className="text-stone-500 font-mono text-[11px] block">{item.unitsSold} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

