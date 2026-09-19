import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Product } from '../../types';
import { Badge } from '../common/Badge';
import { InventoryControlService } from '../../services/inventoryControlService';

interface PhysicalStockCountViewProps {
  products: Product[];
  currency: string;
  onRecordAdjustment: (productId: string, quantityChange: number, reason: string) => void;
  onOpenProduct360?: (product: Product) => void;
}

export const PhysicalStockCountView: React.FC<PhysicalStockCountViewProps> = ({
  products,
  currency,
  onRecordAdjustment,
  onOpenProduct360,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [physicalCountInput, setPhysicalCountInput] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('Physical Count');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Derived calculation
  const systemStock = selectedProduct ? selectedProduct.currentStock : 0;
  const parsedPhysicalCount = physicalCountInput === '' ? null : Number(physicalCountInput);
  const isValidCount = parsedPhysicalCount !== null && !isNaN(parsedPhysicalCount) && parsedPhysicalCount >= 0;
  const difference = isValidCount ? parsedPhysicalCount - systemStock : 0;

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setPhysicalCountInput(String(product.currentStock));
    setFeedback(null);
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedProduct) {
      setFeedback({ type: 'error', message: 'Please select a product first.' });
      return;
    }

    if (!isValidCount || parsedPhysicalCount === null) {
      setFeedback({ type: 'error', message: 'Please enter a valid physical stock count (0 or higher).' });
      return;
    }

    if (difference === 0) {
      setFeedback({
        type: 'success',
        message: `Physical count matches system stock perfectly (${systemStock} units). No adjustment required!`,
      });
      return;
    }

    // Build traceable audit reason
    const fullReason = customNotes.trim()
      ? `${reasonCategory}: ${customNotes.trim()} (Count: ${parsedPhysicalCount}, System: ${systemStock})`
      : `${reasonCategory} audit (Count: ${parsedPhysicalCount}, System: ${systemStock})`;

    try {
      setIsSubmitting(true);
      onRecordAdjustment(selectedProduct.id, difference, fullReason);
      
      const diffStr = difference > 0 ? `+${difference}` : `${difference}`;
      setFeedback({
        type: 'success',
        message: `Adjustment confirmed! Logged ${diffStr} units for "${selectedProduct.name}". New stock balance: ${parsedPhysicalCount}.`,
      });
      
      // Reset form
      setCustomNotes('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record stock adjustment.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Guidance */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                Physical Stock Count & Variance Reconciliation
              </h2>
              <p className="text-xs text-stone-500">
                Audit shelf inventory against recorded system stock. Atomic safety ensures stock is never mutated until explicitly confirmed.
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5 text-stone-400" />
            <span>Catalog: <strong>{products.length} Products</strong></span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-stone-400 hover:text-stone-600 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two Column Layout: Selector + Count Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selection (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Step 1: Select Product
              </label>
              <span className="text-[11px] text-stone-400">
                {filteredProducts.length} matching
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by SKU, name, category..."
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden bg-stone-50/50"
              />
            </div>

            <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto border border-stone-200 rounded-lg">
              {filteredProducts.map((p) => {
                const isSelected = p.id === selectedProductId;
                const status = InventoryControlService.getStockStatus(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`w-full text-left p-3 transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50 border-l-4 border-emerald-700'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-stone-900 truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                        <span className="font-mono text-stone-600">{p.sku}</span>
                        <span>•</span>
                        <span>{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-stone-900">
                        {p.currentStock} units
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {status === 'NORMAL' && <span className="text-emerald-700 font-medium">Normal</span>}
                        {status === 'LOW_STOCK' && <span className="text-amber-700 font-medium">Low</span>}
                        {status === 'OUT_OF_STOCK' && <span className="text-rose-700 font-medium">Out</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Physical Count & Variance Calculator (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Step 2: Enter Physical Stock & Review Variance
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Calculate difference automatically. Stock will NOT change until you review and confirm.
              </p>
            </div>

            {!selectedProduct ? (
              <div className="text-center py-12 border border-dashed border-stone-200 rounded-xl text-stone-500 text-xs">
                <Boxes className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                <p className="font-semibold text-stone-700">No Product Selected</p>
                <p className="text-stone-400 mt-0.5">
                  Select a product from the list on the left to start physical count.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmAdjustment} className="space-y-4">
                {/* Active Product Details Box */}
                <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                      Selected Item
                    </span>
                    <h4 className="font-bold text-stone-900 text-sm">{selectedProduct.name}</h4>
                    <div className="text-xs text-stone-500 font-mono mt-0.5">
                      SKU: {selectedProduct.sku} | Cost: {currency} {selectedProduct.costPrice.toFixed(2)} | Min: {selectedProduct.minimumStock}
                    </div>
                  </div>
                  {onOpenProduct360 && (
                    <button
                      type="button"
                      onClick={() => onOpenProduct360(selectedProduct)}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      360° History
                    </button>
                  )}
                </div>

                {/* Stock Comparison Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* System Stock */}
                  <div className="p-3 bg-stone-100/70 border border-stone-200 rounded-lg text-center">
                    <span className="text-xs text-stone-500 block">System Stock</span>
                    <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                      {systemStock}
                    </div>
                    <span className="text-[10px] text-stone-400">Current on-hand record</span>
                  </div>

                  {/* Physical Count Input */}
                  <div className="p-3 bg-white border-2 border-emerald-600/60 rounded-lg text-center">
                    <label
                      htmlFor="physical-count-input"
                      className="text-xs font-bold text-stone-800 block"
                    >
                      Physical Shelf Count
                    </label>
                    <input
                      id="physical-count-input"
                      type="number"
                      min="0"
                      step="1"
                      value={physicalCountInput}
                      onChange={(e) => setPhysicalCountInput(e.target.value)}
                      placeholder="Counted units..."
                      className="w-full text-center text-2xl font-bold font-mono text-stone-900 mt-1 p-1 border border-stone-300 rounded focus:ring-1 focus:ring-emerald-700 outline-hidden bg-emerald-50/20"
                    />
                    <span className="text-[10px] text-stone-400">Enter counted quantity</span>
                  </div>

                  {/* Calculated Difference */}
                  <div
                    className={`p-3 border rounded-lg text-center ${
                      difference === 0
                        ? 'bg-stone-50 border-stone-200'
                        : difference > 0
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : 'bg-rose-50/80 border-rose-300'
                    }`}
                  >
                    <span className="text-xs text-stone-500 block">Calculated Difference</span>
                    <div
                      className={`text-2xl font-bold font-mono mt-1 ${
                        difference === 0
                          ? 'text-stone-700'
                          : difference > 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {difference > 0 ? `+${difference}` : difference}
                    </div>
                    <span className="text-[10px] text-stone-400">Physical - System</span>
                  </div>
                </div>

                {/* Live Variance Callout */}
                {isValidCount && (
                  <div>
                    {difference === 0 ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Shelf stock matches recorded system stock. No discrepancy found.</span>
                      </div>
                    ) : difference > 0 ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Surplus (+{difference} units):</strong> Shelf has more stock than recorded. Confirming will create an ADJUSTMENT movement (+{difference}) to update inventory to {parsedPhysicalCount}.
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          <strong>Shortage ({difference} units):</strong> Shelf has fewer units than recorded. Confirming will create an ADJUSTMENT movement ({difference}) to reduce inventory to {parsedPhysicalCount}.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit Reason Selector (Section 8) */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-stone-800 block">
                    Audit Reason (Mandatory Traceability)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      'Physical Count',
                      'Damaged',
                      'Expired',
                      'Lost',
                      'Found',
                      'Data Correction',
                      'Other',
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReasonCategory(reason)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border text-center transition-colors ${
                          reasonCategory === reason
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label
                      htmlFor="adjustment-custom-notes"
                      className="text-[11px] text-stone-500 block mb-1"
                    >
                      Additional audit notes / reference (optional):
                    </label>
                    <input
                      id="adjustment-custom-notes"
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="e.g. Monthly stock take shelf B-04 discrepancy..."
                      className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-700 outline-hidden bg-stone-50/50"
                    />
                  </div>
                </div>

                {/* Review & Submit Action */}
                <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-stone-500">
                    {difference !== 0 ? (
                      <span>
                        Resulting New Stock: <strong>{parsedPhysicalCount} units</strong>
                      </span>
                    ) : (
                      <span>No stock mutation pending.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProduct) {
                          setPhysicalCountInput(String(selectedProduct.currentStock));
                          setFeedback(null);
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                    >
                      Reset Count
                    </button>

                    <button
                      type="submit"
                      id="confirm-stock-count-adjustment-btn"
                      disabled={isSubmitting || !isValidCount || difference === 0}
                      className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Confirm Adjustment ({difference > 0 ? `+${difference}` : difference})</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
