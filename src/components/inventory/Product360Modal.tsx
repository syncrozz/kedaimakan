import React, { useState } from 'react';
import {
  Package,
  Layers,
  Truck,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Boxes,
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Product, InventoryMovement, Sale, Purchase } from '../../types';
import { Modal } from '../common/Modal';
import { Badge, MovementTypeBadge } from '../common/Badge';
import { InventoryControlService, Product360ViewData } from '../../services/inventoryControlService';

interface Product360ModalProps {
  product: Product | null;
  movements: InventoryMovement[];
  sales: Sale[];
  purchases: Purchase[];
  currency: string;
  onClose: () => void;
  onAdjustStock?: (product: Product) => void;
}

export const Product360Modal: React.FC<Product360ModalProps> = ({
  product,
  movements,
  sales,
  purchases,
  currency,
  onClose,
  onAdjustStock,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'purchases' | 'sales' | 'reconciliation'>('overview');

  if (!product) return null;

  const data: Product360ViewData = InventoryControlService.getProduct360View(
    product,
    movements,
    sales,
    purchases
  );

  const { valuation, reconciliation, movements: ledgerEntries, purchases: poList, sales: salesList, summary } = data;

  return (
    <Modal
      isOpen={!!product}
      onClose={onClose}
      title={`Product 360° View: ${product.name}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Header Ribbon / Identification */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-stone-900 text-lg">{product.name}</h3>
                <span className="font-mono text-xs bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-600 font-semibold">
                  SKU: {product.sku}
                </span>
                <span className="text-xs text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded">
                  {product.category}
                </span>
                {!product.active && (
                  <span className="text-xs bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-medium">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Grounded 360° retail lifecycle: stock ledger, procurement history, completed sales performance, and audit verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {valuation.stockStatus === 'NORMAL' && (
              <Badge variant="success">Normal Stock ({product.currentStock})</Badge>
            )}
            {valuation.stockStatus === 'LOW_STOCK' && (
              <Badge variant="warning">Low Stock ({product.currentStock} / Min {product.minimumStock})</Badge>
            )}
            {valuation.stockStatus === 'OUT_OF_STOCK' && (
              <Badge variant="danger">Out of Stock ({product.currentStock})</Badge>
            )}
          </div>
        </div>

        {/* Key Retail Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <span className="text-stone-500 block">Current Cost Price</span>
            <div className="text-base font-bold text-stone-900 mt-0.5 font-mono">
              {currency} {product.costPrice.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400">Latest active purchase cost</span>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <span className="text-stone-500 block">Current Selling Price</span>
            <div className="text-base font-bold text-stone-900 mt-0.5 font-mono">
              {currency} {product.sellingPrice.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400">Catalog retail price</span>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <span className="text-stone-500 block">Inventory Valuation (Cost)</span>
            <div className="text-base font-bold text-stone-900 mt-0.5 font-mono">
              {currency} {valuation.inventoryValue.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400">
              {product.currentStock} units × {currency} {product.costPrice.toFixed(2)}
            </span>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <span className="text-stone-500 block">Potential Retail Value</span>
            <div className="text-base font-bold text-stone-900 mt-0.5 font-mono">
              {currency} {valuation.potentialRetailValue.toFixed(2)}
            </div>
            <span className="text-[11px] text-stone-400">
              {product.currentStock} units × {currency} {product.sellingPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Secondary Info Bar: Potential Margin & Suggested Restock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-900">
                Potential Gross Profit at Current Prices
              </span>
              <span className="font-bold text-emerald-800 font-mono text-sm">
                {currency} {valuation.potentialGrossProfit.toFixed(2)} ({valuation.potentialGrossMarginPercent}%)
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">
              Estimated margin based strictly on current catalog prices. (Not historical realized profit).
            </p>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-900">
                Suggested Restock Recommendation
              </span>
              <span className="font-bold text-amber-800 font-mono text-sm">
                {valuation.suggestedRestockQty > 0 ? `+${valuation.suggestedRestockQty} units` : 'Adequate Stock (0)'}
              </span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Formula: Math.max(0, Minimum Stock {product.minimumStock} - Current Stock {product.currentStock}).
            </p>
          </div>
        </div>

        {/* Inner Tabs Navigation */}
        <div className="border-b border-stone-200 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            id="tab-btn-360-ledger"
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock Ledger ({ledgerEntries.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-360-purchases"
            onClick={() => setActiveTab('purchases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'purchases'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Purchase History ({poList.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-360-sales"
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sales'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Sales Performance ({salesList.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-360-reconcile"
            onClick={() => setActiveTab('reconciliation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'reconciliation'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Reconciliation</span>
            {reconciliation.status === 'OK' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
        </div>

        {/* Tab 1: Stock Movement Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Authoritative chronological ledger of every inventory mutation.</span>
              <span className="font-mono">Current Balance: {product.currentStock} units</span>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="text-center py-8 bg-stone-50 rounded-lg border border-dashed border-stone-200 text-stone-500 text-xs">
                No inventory movements yet recorded for this product.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-center">Stock Transition</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-stone-50/80">
                        <td className="py-2 px-3 text-stone-600 whitespace-nowrap">
                          {entry.formattedDateTime}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <MovementTypeBadge type={entry.type} />
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            entry.direction === '+' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {entry.direction}
                          {entry.quantity}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-stone-600 whitespace-nowrap">
                          <span className="text-stone-400">{entry.previousStock}</span>
                          <span className="mx-1.5 text-stone-400">→</span>
                          <span className="font-semibold text-stone-900">{entry.newStock}</span>
                        </td>
                        <td className="py-2 px-3 text-stone-700 font-mono text-[11px] whitespace-nowrap">
                          {entry.referenceId || '—'}
                        </td>
                        <td className="py-2 px-3 text-stone-600 max-w-xs truncate" title={entry.reason}>
                          {entry.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Purchase History */}
        {activeTab === 'purchases' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>
                Total Procurement: <strong>{summary.totalPurchasedUnits} units</strong> worth{' '}
                <strong>{currency} {summary.totalPurchasedValue.toFixed(2)}</strong>
              </span>
              <span className="text-stone-400 text-[11px]">Completed purchases only</span>
            </div>

            {poList.length === 0 ? (
              <div className="text-center py-8 bg-stone-50 rounded-lg border border-dashed border-stone-200 text-stone-500 text-xs">
                No purchase history available for this product.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Purchase #</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {poList.map((po, idx) => (
                      <tr key={`${po.purchaseId}-${idx}`} className="hover:bg-stone-50/80">
                        <td className="py-2 px-3 text-stone-600 whitespace-nowrap">
                          {new Date(po.date).toLocaleDateString('en-MY')}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-stone-900 whitespace-nowrap">
                          {po.purchaseNumber}
                        </td>
                        <td className="py-2 px-3 text-stone-700 whitespace-nowrap">
                          <div>{po.supplierName}</div>
                          <span className="text-[10px] text-stone-400 font-mono">{po.supplierCode}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                          +{po.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-800 whitespace-nowrap">
                          {currency} {po.unitCost.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                          {currency} {po.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sales Performance */}
        {activeTab === 'sales' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>
                Total Sold: <strong>{summary.totalSoldUnits} units</strong> | Revenue:{' '}
                <strong>{currency} {summary.totalSalesRevenue.toFixed(2)}</strong> | Gross Profit:{' '}
                <strong className="text-emerald-700 font-mono">
                  {currency} {summary.totalGrossProfit.toFixed(2)}
                </strong>
              </span>
              <span className="text-stone-400 text-[11px]">Realized historical sales</span>
            </div>

            {salesList.length === 0 ? (
              <div className="text-center py-8 bg-stone-50 rounded-lg border border-dashed border-stone-200 text-stone-500 text-xs">
                No sales data available for this product in recorded history.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3 text-right">Sold Qty</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Cost Snapshot</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {salesList.map((s, idx) => (
                      <tr key={`${s.saleId}-${idx}`} className="hover:bg-stone-50/80">
                        <td className="py-2 px-3 text-stone-600 whitespace-nowrap">
                          {new Date(s.date).toLocaleDateString('en-MY')}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-stone-900 whitespace-nowrap">
                          {s.transactionNumber}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                          -{s.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {currency} {s.unitSellingPriceSnapshot.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-500 whitespace-nowrap">
                          {currency} {s.unitCostSnapshot.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900 whitespace-nowrap">
                          {currency} {s.lineRevenue.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {currency} {s.lineGrossProfit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Audit Reconciliation */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border ${
                reconciliation.status === 'OK'
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : 'bg-rose-50/80 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {reconciliation.status === 'OK' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <h4 className="text-sm font-bold text-stone-900">
                    {reconciliation.status === 'OK'
                      ? 'Stock Reconciliation Verified (OK)'
                      : 'Stock Mismatch Detected!'}
                  </h4>
                </div>
                <Badge variant={reconciliation.status === 'OK' ? 'success' : 'danger'} size="md">
                  Status: {reconciliation.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs mt-3 bg-white/70 rounded-lg p-3 border border-stone-200/60">
                <div>
                  <span className="text-stone-500 block">Recorded Stock</span>
                  <div className="text-base font-bold text-stone-900 font-mono">
                    {reconciliation.recordedStock}
                  </div>
                  <span className="text-[10px] text-stone-400">Product.currentStock</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Calculated Ledger Stock</span>
                  <div className="text-base font-bold text-stone-900 font-mono">
                    {reconciliation.calculatedStock}
                  </div>
                  <span className="text-[10px] text-stone-400">Sum of all ledger movements</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Difference</span>
                  <div
                    className={`text-base font-bold font-mono ${
                      reconciliation.difference === 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {reconciliation.difference > 0 ? `+${reconciliation.difference}` : reconciliation.difference}
                  </div>
                  <span className="text-[10px] text-stone-400">Recorded - Calculated</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-stone-700 bg-white/80 rounded-lg p-3 border border-stone-200/70 font-mono text-[11px]">
                <strong>Audit Formula:</strong> {reconciliation.formula}
              </div>

              {reconciliation.status === 'MISMATCH' && (
                <div className="mt-3 p-3 bg-rose-100/70 border border-rose-200 rounded-lg text-xs text-rose-800">
                  <p className="font-semibold">Integrity Warning:</p>
                  <p className="mt-0.5">
                    The system will NOT silently alter the stock balance. To resolve this discrepancy, please review physical shelf inventory and submit an explicit Stock Adjustment audit record.
                  </p>
                  {onAdjustStock && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onAdjustStock(product);
                      }}
                      className="mt-2 px-3 py-1.5 bg-rose-700 text-white rounded text-xs font-semibold hover:bg-rose-800 transition-colors"
                    >
                      Perform Stock Adjustment
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reconciliation Ledger Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">Opening Stock</span>
                <span className="text-sm font-bold text-stone-900 font-mono">
                  {reconciliation.breakdown.openingStock}
                </span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">Total Stock In (+)</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  +{reconciliation.breakdown.stockIn}
                </span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">Customer Returns (+)</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  +{reconciliation.breakdown.returns}
                </span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">Positive Adjustments (+)</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  +{reconciliation.breakdown.positiveAdjustments}
                </span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">POS Sales (-)</span>
                <span className="text-sm font-bold text-rose-700 font-mono">
                  -{reconciliation.breakdown.sales}
                </span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                <span className="text-stone-500 block">Negative Adjustments (-)</span>
                <span className="text-sm font-bold text-rose-700 font-mono">
                  -{reconciliation.breakdown.negativeAdjustments}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            {summary.movementCount} ledger movements | {poList.length} purchase orders | {salesList.length} sales
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close 360° View
          </button>
        </div>
      </div>
    </Modal>
  );
};
