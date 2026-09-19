import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertOctagon,
  Clock,
  ShieldCheck,
  Calendar,
  DollarSign,
  Package,
  Boxes,
  HelpCircle,
  Eye,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Product, Sale, InventoryMovement } from '../../types';
import { Badge } from '../common/Badge';
import {
  InventoryControlService,
  FastMovingProductItem,
  NoSalesProductItem,
  StockHealthSummary,
} from '../../services/inventoryControlService';

interface InventoryAnalysisViewProps {
  products: Product[];
  sales: Sale[];
  movements: InventoryMovement[];
  currency: string;
  onOpenProduct360: (product: Product) => void;
  onOpenReconciliation: () => void;
}

export const InventoryAnalysisView: React.FC<InventoryAnalysisViewProps> = ({
  products,
  sales,
  movements,
  currency,
  onOpenProduct360,
  onOpenReconciliation,
}) => {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [subTab, setSubTab] = useState<'summary' | 'fast_moving' | 'no_sales'>('summary');

  const healthSummary: StockHealthSummary = useMemo(() => {
    return InventoryControlService.getStockHealthSummary(products, sales, selectedDays);
  }, [products, sales, selectedDays]);

  const fastMovingProducts: FastMovingProductItem[] = useMemo(() => {
    return InventoryControlService.getFastMovingProducts(products, sales, selectedDays);
  }, [products, sales, selectedDays]);

  const noSalesProducts: NoSalesProductItem[] = useMemo(() => {
    return InventoryControlService.getProductsWithNoSales(products, sales, selectedDays);
  }, [products, sales, selectedDays]);

  return (
    <div className="space-y-6">
      {/* Period Selection & Control Header */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight">
            Inventory Analytics & Stock Health Control
          </h2>
          <p className="text-xs text-stone-500">
            Historical stock movement velocity, velocity ranking, non-moving inventory, and capital exposure. (Strictly factual history; no AI speculation).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>Period:</span>
          </span>
          <div className="inline-flex rounded-lg border border-stone-300 p-0.5 bg-stone-50">
            {[
              { days: 7, label: '7 Days' },
              { days: 30, label: '30 Days' },
              { days: 60, label: '60 Days' },
              { days: 90, label: '90 Days' },
            ].map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setSelectedDays(option.days)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedDays === option.days
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenReconciliation}
            className="ml-2 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Reconciliation Audit</span>
          </button>
        </div>
      </div>

      {/* Stock Summary & Valuation Strip (Section 21) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-stone-500 block">Total Active Products</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {healthSummary.totalActiveProducts}
          </div>
          <span className="text-[11px] text-stone-400">{healthSummary.totalUnitsInStock} total units</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-stone-500 block">Inventory Valuation (Cost)</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {currency} {healthSummary.totalInventoryValue.toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-400">Capital tied up in stock</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-stone-500 block">Potential Retail Value</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {currency} {healthSummary.totalPotentialRetailValue.toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-400">At current selling prices</span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-emerald-800 font-semibold block">Potential Gross Profit</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {currency} {healthSummary.totalPotentialGrossProfit.toFixed(2)}
          </div>
          <span className="text-[11px] text-emerald-600">Retail Value - Cost Valuation</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-xs text-stone-500 block">Non-Moving Items ({selectedDays}d)</span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            {healthSummary.noSalesCount}
          </div>
          <span className="text-[11px] text-stone-400">Zero sales in selected period</span>
        </div>
      </div>

      {/* Stock Health Breakdown Grid */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
          Stock Health Distribution
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
            <span className="font-semibold text-emerald-900 block">Normal Stock</span>
            <div className="text-2xl font-bold text-emerald-800 font-mono mt-1">
              {healthSummary.normalCount}
            </div>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              Stock ≥ Minimum Threshold
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200">
            <span className="font-semibold text-amber-900 block">Low Stock Alert</span>
            <div className="text-2xl font-bold text-amber-800 font-mono mt-1">
              {healthSummary.lowStockCount}
            </div>
            <span className="text-[11px] text-amber-700 mt-0.5 block">
              0 &lt; Stock &lt; Minimum Threshold
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-rose-50/60 border border-rose-200">
            <span className="font-semibold text-rose-900 block">Out of Stock</span>
            <div className="text-2xl font-bold text-rose-800 font-mono mt-1">
              {healthSummary.outOfStockCount}
            </div>
            <span className="text-[11px] text-rose-700 mt-0.5 block">
              Stock ≤ 0 Units on hand
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-stone-100 border border-stone-200">
            <span className="font-semibold text-stone-700 block">No Sales in {selectedDays} Days</span>
            <div className="text-2xl font-bold text-stone-800 font-mono mt-1">
              {healthSummary.noSalesCount}
            </div>
            <span className="text-[11px] text-stone-500 mt-0.5 block">
              Candidate for promotion / review
            </span>
          </div>
        </div>
      </div>

      {/* Subtabs for Fast Moving vs No Sales */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
          <button
            type="button"
            onClick={() => setSubTab('fast_moving')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'fast_moving'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Fast Moving Products ({fastMovingProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('no_sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'no_sales'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>No Sales in Selected Period ({noSalesProducts.length})</span>
          </button>
        </div>

        {/* Subtab 1: Fast Moving Products */}
        {subTab === 'fast_moving' && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                  Top Moving Products (Last {selectedDays} Days)
                </h4>
                <p className="text-[11px] text-stone-500">
                  Ranked by actual units sold from completed sales, with estimated stock coverage.
                </p>
              </div>
              <span className="text-xs text-stone-500 font-mono">
                {fastMovingProducts.length} Active Movers
              </span>
            </div>

            {fastMovingProducts.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs">
                No sales recorded in the past {selectedDays} days.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">Rank / Product</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                      <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                      <th className="py-2.5 px-3 text-right">Avg Daily Sales</th>
                      <th className="py-2.5 px-3 text-center">Estimated Stock Coverage</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {fastMovingProducts.map((item, idx) => {
                      const matchingProd = products.find((p) => p.id === item.productId);
                      return (
                        <tr key={item.productId} className="hover:bg-stone-50/70">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-stone-900">{item.productName}</div>
                                <span className="font-mono text-[10px] text-stone-400">{item.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                            {item.unitsSold}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                            {item.currentStock}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-900">
                            {currency} {item.salesRevenue.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {currency} {item.grossProfit.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                            {item.avgDailySales.toFixed(2)} / day
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium font-mono ${
                                item.stockCoverageDays !== null && item.stockCoverageDays < 7
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {item.stockCoverageDisplay}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {matchingProd && (
                              <button
                                type="button"
                                onClick={() => onOpenProduct360(matchingProd)}
                                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                              >
                                View 360°
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Subtab 2: No Sales in Selected Period */}
        {subTab === 'no_sales' && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                  No Sales in Selected Period ({selectedDays} Days)
                </h4>
                <p className="text-[11px] text-stone-500">
                  Active products with 0 units sold in the selected {selectedDays}-day window. Identify capital tied up in slow-moving inventory.
                </p>
              </div>
              <span className="text-xs text-stone-500 font-mono">
                {noSalesProducts.length} Idle SKUs
              </span>
            </div>

            {noSalesProducts.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs">
                All active products have had sales within the past {selectedDays} days!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">Product / SKU</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Tied-Up Capital (Value)</th>
                      <th className="py-2.5 px-3 text-center">Stock Status</th>
                      <th className="py-2.5 px-3">Last Recorded Sale</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {noSalesProducts.map((item) => {
                      const matchingProd = products.find((p) => p.id === item.productId);
                      return (
                        <tr key={item.productId} className="hover:bg-stone-50/70">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-stone-900">{item.productName}</div>
                            <span className="font-mono text-[10px] text-stone-400">{item.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                            {item.currentStock}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                            {currency} {item.costPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                            {currency} {item.inventoryValue.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.stockStatus === 'NORMAL' && (
                              <Badge variant="success">Normal</Badge>
                            )}
                            {item.stockStatus === 'LOW_STOCK' && (
                              <Badge variant="warning">Low Stock</Badge>
                            )}
                            {item.stockStatus === 'OUT_OF_STOCK' && (
                              <Badge variant="danger">Out of Stock</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 font-mono text-[11px]">
                            {item.daysSinceLastSaleDisplay}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {matchingProd && (
                              <button
                                type="button"
                                onClick={() => onOpenProduct360(matchingProd)}
                                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                              >
                                View 360°
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
