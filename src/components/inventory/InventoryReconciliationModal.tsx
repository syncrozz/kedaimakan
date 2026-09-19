import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  Boxes,
  HelpCircle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Product, InventoryMovement } from '../../types';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import {
  InventoryControlService,
  ProductReconciliationResult,
  StoreReconciliationSummary,
} from '../../services/inventoryControlService';

interface InventoryReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  movements: InventoryMovement[];
  currency: string;
  onAdjustProduct?: (product: Product) => void;
  onOpenProduct360?: (product: Product) => void;
}

export const InventoryReconciliationModal: React.FC<InventoryReconciliationModalProps> = ({
  isOpen,
  onClose,
  products,
  movements,
  currency,
  onAdjustProduct,
  onOpenProduct360,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'MISMATCH_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const summary: StoreReconciliationSummary = useMemo(() => {
    return InventoryControlService.reconcileAll(products, movements);
  }, [products, movements]);

  const filteredResults = useMemo(() => {
    return summary.results.filter((res) => {
      if (filterMode === 'MISMATCH_ONLY' && res.status !== 'MISMATCH') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          res.productName.toLowerCase().includes(q) ||
          res.sku.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [summary, filterMode, searchQuery]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Store Inventory Reconciliation Audit"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Header Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <span className="text-xs text-stone-500 block">Total Catalog Products</span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-0.5">
              {summary.totalProducts}
            </div>
            <span className="text-[10px] text-stone-400">Products evaluated</span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-800 font-semibold block">Fully Reconciled (OK)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
              {summary.okCount}
            </div>
            <span className="text-[10px] text-emerald-600">Recorded = Ledger balance</span>
          </div>

          <div
            className={`rounded-lg p-3 border ${
              summary.mismatchCount > 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-stone-50 border-stone-200 text-stone-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold block">Discrepancies (MISMATCH)</span>
              {summary.mismatchCount > 0 && <AlertTriangle className="w-4 h-4 text-rose-600" />}
            </div>
            <div
              className={`text-xl font-bold font-mono mt-0.5 ${
                summary.mismatchCount > 0 ? 'text-rose-700' : 'text-stone-900'
              }`}
            >
              {summary.mismatchCount}
            </div>
            <span className="text-[10px] opacity-75">
              {summary.mismatchCount === 0 ? 'Zero discrepancies detected' : 'Requires review'}
            </span>
          </div>
        </div>

        {/* Audit Guidance Note */}
        <div className="p-3 bg-stone-100/70 rounded-lg border border-stone-200 text-xs text-stone-600 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <div>
            <p>
              <strong>Reconciliation Formula:</strong> Current Stock = Opening Stock + STOCK_IN + RETURN + (+ADJUSTMENTS) - SALE - (-ADJUSTMENTS).
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Notice: The system will <strong>never silently rewrite</strong> balances. If a discrepancy exists, perform an explicit Stock Adjustment with a recorded audit reason.
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              All Products ({summary.totalProducts})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('MISMATCH_ONLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterMode === 'MISMATCH_ONLY'
                  ? 'bg-rose-700 text-white'
                  : summary.mismatchCount > 0
                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>Mismatches Only</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {summary.mismatchCount}
              </span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product or SKU..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-lg outline-hidden focus:ring-1 focus:ring-emerald-700 bg-stone-50/50"
            />
          </div>
        </div>

        {/* Table of Reconciliation Results */}
        <div className="border border-stone-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-right">Recorded Stock</th>
                <th className="py-2.5 px-3 text-right">Ledger Stock</th>
                <th className="py-2.5 px-3 text-right">Difference</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500 text-xs">
                    {filterMode === 'MISMATCH_ONLY'
                      ? 'No reconciliation discrepancies detected. All product balances match ledger movements perfectly!'
                      : 'No products matched your search filter.'}
                  </td>
                </tr>
              ) : (
                filteredResults.map((res) => {
                  const isExpanded = expandedProductId === res.productId;
                  const matchingProd = products.find((p) => p.id === res.productId);

                  return (
                    <React.Fragment key={res.productId}>
                      <tr className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-stone-900">{res.productName}</div>
                          <div className="font-mono text-[11px] text-stone-500">{res.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-stone-900">
                          {res.recordedStock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                          {res.calculatedStock}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            res.difference === 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {res.difference > 0 ? `+${res.difference}` : res.difference}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {res.status === 'OK' ? (
                            <Badge variant="success">OK</Badge>
                          ) : (
                            <Badge variant="danger">MISMATCH</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProductId(isExpanded ? null : res.productId)
                            }
                            className="text-[11px] text-stone-600 hover:text-stone-900 underline px-1.5 py-0.5"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>

                          {matchingProd && onOpenProduct360 && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenProduct360(matchingProd);
                              }}
                              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium px-1.5 py-0.5"
                            >
                              360°
                            </button>
                          )}

                          {res.status === 'MISMATCH' && matchingProd && onAdjustProduct && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onAdjustProduct(matchingProd);
                              }}
                              className="text-[11px] bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 rounded px-2 py-0.5 font-semibold"
                            >
                              Adjust
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-stone-50/90 border-b border-stone-200">
                          <td colSpan={6} className="p-3">
                            <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-2 text-xs">
                              <div className="font-mono text-[11px] text-stone-700">
                                <strong>Formula:</strong> {res.formula}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                                <div className="p-1.5 rounded bg-stone-50 border border-stone-200">
                                  <span className="text-stone-400 block text-[10px]">Opening</span>
                                  <span className="font-mono font-semibold">{res.breakdown.openingStock}</span>
                                </div>
                                <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                                  <span className="text-emerald-700 block text-[10px]">Stock In (+)</span>
                                  <span className="font-mono font-semibold text-emerald-800">+{res.breakdown.stockIn}</span>
                                </div>
                                <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                                  <span className="text-emerald-700 block text-[10px]">Returns (+)</span>
                                  <span className="font-mono font-semibold text-emerald-800">+{res.breakdown.returns}</span>
                                </div>
                                <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                                  <span className="text-emerald-700 block text-[10px]">+Adjustments</span>
                                  <span className="font-mono font-semibold text-emerald-800">+{res.breakdown.positiveAdjustments}</span>
                                </div>
                                <div className="p-1.5 rounded bg-rose-50 border border-rose-200">
                                  <span className="text-rose-700 block text-[10px]">Sales (-)</span>
                                  <span className="font-mono font-semibold text-rose-800">-{res.breakdown.sales}</span>
                                </div>
                                <div className="p-1.5 rounded bg-rose-50 border border-rose-200">
                                  <span className="text-rose-700 block text-[10px]">-Adjustments</span>
                                  <span className="font-mono font-semibold text-rose-800">-{res.breakdown.negativeAdjustments}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>{summary.totalProducts} items audited across {movements.length} total movements</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </Modal>
  );
};
