import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  PlusCircle,
  Sliders,
  History,
  AlertTriangle,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  DollarSign,
  Filter,
  Check,
  AlertCircle,
  ClipboardCheck,
  TrendingUp,
  Eye,
  Calendar,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product, InventoryMovement, InventoryMovementType, StockStatus } from '../types';
import { MovementTypeBadge, Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { InventoryService } from '../services/inventoryService';
import { InventoryControlService } from '../services/inventoryControlService';
import { Product360Modal } from '../components/inventory/Product360Modal';
import { PhysicalStockCountView } from '../components/inventory/PhysicalStockCountView';
import { InventoryReconciliationModal } from '../components/inventory/InventoryReconciliationModal';
import { InventoryAnalysisView } from '../components/inventory/InventoryAnalysisView';

export const STANDARD_ADJUSTMENT_REASONS = [
  'Physical Count',
  'Damaged',
  'Expired',
  'Lost',
  'Found',
  'Data Correction',
  'Other',
];

export const InventoryPage: React.FC = () => {
  const {
    store,
    products,
    movements,
    sales,
    purchases,
    recordStockIn,
    recordAdjustment,
    recordReturn,
    requireAdmin,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'levels' | 'movements' | 'count' | 'analysis'>('levels');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | StockStatus>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [movementProductFilter, setMovementProductFilter] = useState<string>('ALL');
  const [movementDateRange, setMovementDateRange] = useState<string>('ALL');

  // Modals state
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInQty, setStockInQty] = useState<number>(10);
  const [stockInReason, setStockInReason] = useState<string>('Supplier delivery restock');
  const [stockInRef, setStockInRef] = useState<string>('');

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(-1);
  const [adjustReasonCategory, setAdjustReasonCategory] = useState<string>('Damaged');
  const [adjustCustomNotes, setAdjustCustomNotes] = useState<string>('');

  const [returnProduct, setReturnProduct] = useState<Product | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<string>('Customer return - unopened item');
  const [returnRef, setReturnRef] = useState<string>('');

  // 360° View Modal
  const [selected360Product, setSelected360Product] = useState<Product | null>(null);

  // Store-wide Reconciliation Audit Modal
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);

  // Product Traceability Modal (Mathematical audit trail)
  const [auditProduct, setAuditProduct] = useState<Product | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Auto-catch filter from Dashboard navigation (Section 22)
  useEffect(() => {
    const initialFilter = sessionStorage.getItem('inventory_initial_filter');
    if (initialFilter) {
      if (
        initialFilter === 'LOW_STOCK' ||
        initialFilter === 'OUT_OF_STOCK' ||
        initialFilter === 'NORMAL'
      ) {
        setStockStatusFilter(initialFilter as StockStatus);
        setActiveTab('levels');
      }
      sessionStorage.removeItem('inventory_initial_filter');
    }
  }, []);

  // Summary Metrics (Section 10, 17, 21)
  const totalInventoryValuation = useMemo(() => {
    return products.reduce(
      (sum, p) => sum + Math.max(0, p.currentStock) * p.costPrice,
      0
    );
  }, [products]);

  const totalPotentialRetailValuation = useMemo(() => {
    return products.reduce(
      (sum, p) => sum + Math.max(0, p.currentStock) * p.sellingPrice,
      0
    );
  }, [products]);

  const totalPotentialGrossProfit = useMemo(() => {
    return totalPotentialRetailValuation - totalInventoryValuation;
  }, [totalPotentialRetailValuation, totalInventoryValuation]);

  const stockStats = useMemo(() => {
    let normalCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const status = InventoryService.getStockStatus(p);
      if (status === 'NORMAL') normalCount++;
      else if (status === 'LOW_STOCK') lowStockCount++;
      else if (status === 'OUT_OF_STOCK') outOfStockCount++;
    });

    return { normalCount, lowStockCount, outOfStockCount, total: products.length };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query);

      const status = InventoryService.getStockStatus(p);
      const matchesStatus =
        stockStatusFilter === 'ALL' || status === stockStatusFilter;

      const matchesActive =
        activeStatusFilter === 'ALL' ||
        (activeStatusFilter === 'ACTIVE' && p.active !== false) ||
        (activeStatusFilter === 'INACTIVE' && p.active === false);

      return matchesSearch && matchesStatus && matchesActive;
    });
  }, [products, searchQuery, stockStatusFilter, activeStatusFilter]);

  // Filtered movements for Movements Tab (Section 3 & 4)
  const filteredMovements = useMemo(() => {
    const now = new Date();

    return movements.filter((m) => {
      const query = searchQuery.toLowerCase().trim();
      const p = products.find((prod) => prod.id === m.productId);
      const nameMatch =
        query === '' ||
        (m.productName || p?.name || '').toLowerCase().includes(query) ||
        (m.referenceId || '').toLowerCase().includes(query) ||
        m.reason.toLowerCase().includes(query);

      const typeMatch =
        movementTypeFilter === 'ALL' || m.type === movementTypeFilter;

      const productMatch =
        movementProductFilter === 'ALL' || m.productId === movementProductFilter;

      let dateMatch = true;
      if (movementDateRange !== 'ALL') {
        const mDate = new Date(m.createdAt);
        const daysDiff = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24);
        if (movementDateRange === 'TODAY') {
          dateMatch = mDate.toDateString() === now.toDateString();
        } else if (movementDateRange === '7D') {
          dateMatch = daysDiff <= 7;
        } else if (movementDateRange === '30D') {
          dateMatch = daysDiff <= 30;
        } else if (movementDateRange === '90D') {
          dateMatch = daysDiff <= 90;
        }
      }

      return nameMatch && typeMatch && productMatch && dateMatch;
    });
  }, [
    movements,
    products,
    searchQuery,
    movementTypeFilter,
    movementProductFilter,
    movementDateRange,
  ]);

  // Handlers
  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!stockInProduct) return;

    const qty = Number(stockInQty);
    if (isNaN(qty) || qty <= 0) {
      setActionError('Stock In quantity must be greater than 0.');
      return;
    }

    const reason = stockInReason.trim();
    if (!reason) {
      setActionError('Audit reason is required.');
      return;
    }

    try {
      recordStockIn(
        stockInProduct.id,
        qty,
        reason,
        stockInRef.trim() || undefined
      );
      const pName = stockInProduct.name;
      setStockInProduct(null);
      setActionSuccess(`Successfully recorded Stock In (+${qty}) for "${pName}".`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record stock in.');
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!adjustProduct) return;

    const delta = Number(adjustQty);
    if (isNaN(delta) || delta === 0) {
      setActionError('Adjustment quantity must not be zero.');
      return;
    }

    const fullReason = adjustCustomNotes.trim()
      ? `${adjustReasonCategory}: ${adjustCustomNotes.trim()}`
      : adjustReasonCategory;

    if (adjustProduct.currentStock + delta < 0) {
      setActionError(
        `Adjustment would result in negative stock (${adjustProduct.currentStock + delta}). Stock cannot be negative.`
      );
      return;
    }

    try {
      recordAdjustment(adjustProduct.id, delta, fullReason);
      const pName = adjustProduct.name;
      setAdjustProduct(null);
      setActionSuccess(`Successfully recorded adjustment (${delta > 0 ? '+' : ''}${delta}) for "${pName}".`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record adjustment.');
    }
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!returnProduct) return;

    const qty = Number(returnQty);
    if (isNaN(qty) || qty <= 0) {
      setActionError('Return quantity must be greater than 0.');
      return;
    }

    const reason = returnReason.trim();
    if (!reason) {
      setActionError('Reason is mandatory for return.');
      return;
    }

    try {
      recordReturn(
        returnProduct.id,
        qty,
        reason,
        returnRef.trim() || undefined
      );
      const pName = returnProduct.name;
      setReturnProduct(null);
      setActionSuccess(`Successfully recorded Return (+${qty}) for "${pName}".`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record return.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Inventory Management
          </h1>
          <p className="text-sm text-stone-500">
            Stock ledger, physical counts, reconciliation audit, and lifecycle visibility for {store.name}.
          </p>
        </div>

        {/* 4 Main Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            id="tab-levels-btn"
            onClick={() => setActiveTab('levels')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'levels'
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock Overview ({products.length})</span>
          </button>

          <button
            type="button"
            id="tab-movements-btn"
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Stock Movements ({movements.length})</span>
          </button>

          <button
            type="button"
            id="tab-count-btn"
            onClick={() => setActiveTab('count')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'count'
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Stock Count</span>
          </button>

          <button
            type="button"
            id="tab-analysis-btn"
            onClick={() => setActiveTab('analysis')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Inventory Analysis</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* TAB 1: STOCK OVERVIEW */}
      {activeTab === 'levels' && (
        <div className="space-y-5">
          {/* Summary Valuation & Health Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total Valuation */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Inventory Value
                </span>
                <DollarSign className="w-4 h-4 text-stone-400" />
              </div>
              <div className="text-xl font-bold font-mono text-stone-900">
                {store.currency} {totalInventoryValuation.toFixed(2)}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Current Stock &times; Cost Price
              </div>
            </div>

            {/* Potential Retail Value */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Retail Value
                </span>
                <Boxes className="w-4 h-4 text-stone-400" />
              </div>
              <div className="text-xl font-bold font-mono text-stone-900">
                {store.currency} {totalPotentialRetailValuation.toFixed(2)}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                At catalog selling price
              </div>
            </div>

            {/* Normal Stock Items */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Normal Stock
                </span>
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700">
                {stockStats.normalCount} <span className="text-xs font-sans text-stone-400">/ {stockStats.total}</span>
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Stock &ge; Min threshold
              </div>
            </div>

            {/* Low Stock Warning */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-amber-700">
                  Low Stock Alerts
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-800">
                {stockStats.lowStockCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                0 &lt; Stock &lt; Minimum
              </div>
            </div>

            {/* Out of Stock Warning */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-rose-700">
                  Out of Stock
                </span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-800">
                {stockStats.outOfStockCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Stock &le; 0 (Blocked from POS)
              </div>
            </div>
          </div>

          {/* Traceability Invariant Explainer (Section 16) */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-stone-600">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 block">
                  Auditable Inventory Equation (Section 16):
                </span>
                <span className="font-mono text-stone-700">
                  Current Stock = Opening Stock + STOCK_IN + RETURN + (+ADJUSTMENTS) - SALE - (-ADJUSTMENTS)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReconciliationOpen(true)}
              className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 font-semibold text-xs hover:bg-stone-100 shrink-0"
            >
              Reconcile All Products
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="inventory-search-input"
                type="text"
                placeholder="Filter stock by product name, SKU, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-stone-500 font-medium">Stock:</span>
                <select
                  id="inventory-stock-filter"
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg font-semibold text-stone-800"
                >
                  <option value="ALL">All Stock Levels</option>
                  <option value="NORMAL">Normal Stock (≥ Min)</option>
                  <option value="LOW_STOCK">Low Stock (&lt; Min)</option>
                  <option value="OUT_OF_STOCK">Out of Stock (≤ 0)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 font-medium">Status:</span>
                <select
                  value={activeStatusFilter}
                  onChange={(e) => setActiveStatusFilter(e.target.value as any)}
                  className="bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg font-semibold text-stone-800"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* STOCK OVERVIEW TABLE */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5">Product & SKU</th>
                    <th className="px-3 py-3.5">Category</th>
                    <th className="px-3 py-3.5 text-center">Current Stock</th>
                    <th className="px-3 py-3.5 text-center">Min Threshold</th>
                    <th className="px-3 py-3.5 text-center">Stock Status</th>
                    <th className="px-3 py-3.5 text-right">Cost Price</th>
                    <th className="px-3 py-3.5 text-right">Inventory Value</th>
                    <th className="px-3 py-3.5 text-center">Suggested Restock</th>
                    <th className="px-4 py-3.5 text-right">Traceable Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-stone-400 text-xs">
                        No products match your search or stock status filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const status = InventoryService.getStockStatus(product);
                      const inventoryValue = Math.max(0, product.currentStock) * product.costPrice;
                      const suggestedRestock = Math.max(0, product.minimumStock - product.currentStock);

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-stone-50/70 transition-colors"
                        >
                          {/* Product & SKU */}
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-stone-900 text-xs">
                              {product.name}
                            </div>
                            <div className="text-[11px] font-mono text-stone-400 flex items-center gap-1.5 mt-0.5">
                              <span>{product.sku}</span>
                              {!product.active && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-stone-200 text-stone-600">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-3 py-3.5 text-xs text-stone-600">
                            {product.category}
                          </td>

                          {/* Current Stock */}
                          <td className="px-3 py-3.5 text-center">
                            <span
                              className={`text-sm font-bold font-mono ${
                                status === 'OUT_OF_STOCK'
                                  ? 'text-rose-700'
                                  : status === 'LOW_STOCK'
                                  ? 'text-amber-800'
                                  : 'text-stone-900'
                              }`}
                            >
                              {product.currentStock}
                            </span>
                          </td>

                          {/* Minimum Stock */}
                          <td className="px-3 py-3.5 text-center text-xs font-mono text-stone-500">
                            {product.minimumStock}
                          </td>

                          {/* Stock Status */}
                          <td className="px-3 py-3.5 text-center">
                            {status === 'NORMAL' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span>NORMAL</span>
                              </span>
                            )}
                            {status === 'LOW_STOCK' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                <span>LOW STOCK</span>
                              </span>
                            )}
                            {status === 'OUT_OF_STOCK' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-2.5 h-2.5 text-rose-600" />
                                <span>OUT OF STOCK</span>
                              </span>
                            )}
                          </td>

                          {/* Cost Price */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs text-stone-600">
                            {store.currency} {product.costPrice.toFixed(2)}
                          </td>

                          {/* Inventory Value: Current Stock * Cost Price */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs font-semibold text-stone-900">
                            {store.currency} {inventoryValue.toFixed(2)}
                          </td>

                          {/* Restock Need */}
                          <td className="px-3 py-3.5 text-center font-mono text-xs">
                            {suggestedRestock > 0 ? (
                              <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                                +{suggestedRestock}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Traceable Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* 360 View */}
                              <button
                                type="button"
                                id={`product-360-btn-${product.sku}`}
                                onClick={() => setSelected360Product(product)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer"
                                title="View 360° product lifecycle"
                              >
                                <Eye className="w-3 h-3" />
                                <span>360°</span>
                              </button>

                              {/* Stock In */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setStockInProduct(product);
                                  setStockInQty(10);
                                  setStockInRef(`PO-${new Date().getFullYear()}-`);
                                  setStockInReason('Supplier delivery restock');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 border border-stone-200 rounded-md transition cursor-pointer"
                                title="Record traceable stock addition"
                              >
                                <PlusCircle className="w-3 h-3" />
                                <span>In</span>
                              </button>

                              {/* Adjust */}
                              <button
                                type="button"
                                onClick={() => {
                                  requireAdmin(() => {
                                    setActionError(null);
                                    setAdjustProduct(product);
                                    setAdjustQty(-1);
                                    setAdjustReasonCategory('Damaged');
                                    setAdjustCustomNotes('');
                                  }, `Pelarasan Stok ${product.name}`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-white hover:bg-amber-50 border border-stone-200 rounded-md transition cursor-pointer"
                                title="Record traceable adjustment with reason"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Adj</span>
                              </button>

                              {/* Return */}
                              <button
                                type="button"
                                onClick={() => {
                                  requireAdmin(() => {
                                    setActionError(null);
                                    setReturnProduct(product);
                                    setReturnQty(1);
                                    setReturnRef('');
                                    setReturnReason('Customer return - unopened item');
                                  }, `Pemulangan Stok ${product.name}`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-md transition cursor-pointer"
                                title="Record return"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Ret</span>
                              </button>

                              {/* Audit Breakdown */}
                              <button
                                type="button"
                                onClick={() => setAuditProduct(product)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md transition cursor-pointer"
                                title="View mathematical audit breakdown"
                              >
                                <History className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRACEABLE MOVEMENTS LOG (Section 3 & 4) */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Movement Filters Bar */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Filter movements by product, reason, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              {/* Product selector */}
              <div className="flex items-center gap-1">
                <span className="text-stone-500 font-medium">Product:</span>
                <select
                  value={movementProductFilter}
                  onChange={(e) => setMovementProductFilter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg font-semibold text-stone-800 max-w-40 truncate"
                >
                  <option value="ALL">All Products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div className="flex items-center gap-1">
                <span className="text-stone-500 font-medium">Type:</span>
                <select
                  id="movement-type-filter"
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg font-semibold text-stone-800"
                >
                  <option value="ALL">All Types</option>
                  <option value="STOCK_IN">Stock In (+)</option>
                  <option value="SALE">Sale (-)</option>
                  <option value="ADJUSTMENT">Adjustment (±)</option>
                  <option value="RETURN">Return (+)</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1">
                <span className="text-stone-500 font-medium">Range:</span>
                <select
                  value={movementDateRange}
                  onChange={(e) => setMovementDateRange(e.target.value)}
                  className="bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg font-semibold text-stone-800"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today Only</option>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                  <option value="90D">Last 90 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5 text-center">Movement Type</th>
                    <th className="px-4 py-3.5 text-center">Quantity Delta</th>
                    <th className="px-4 py-3.5 text-center">Stock Flow</th>
                    <th className="px-4 py-3.5">Reference ID</th>
                    <th className="px-5 py-3.5">Audit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-stone-400 text-xs">
                        No inventory movements match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const isPositive =
                        m.type === 'STOCK_IN' ||
                        m.type === 'RETURN' ||
                        (m.type === 'ADJUSTMENT' && m.quantity > 0);
                      const sign = isPositive ? '+' : '-';
                      const absQty = Math.abs(m.quantity);

                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-stone-50/70 transition-colors"
                        >
                          <td className="px-5 py-3 text-xs text-stone-500 whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString('en-MY')}{' '}
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td className="px-4 py-3 font-medium text-stone-900 text-xs">
                            {m.productName || 'Catalog Product'}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <MovementTypeBadge type={m.type} />
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-mono text-xs font-bold inline-flex items-center gap-0.5 ${
                                isPositive ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {sign}{absQty}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center text-xs font-mono text-stone-600">
                            <span>{m.previousStock}</span>
                            <span className="text-stone-400 mx-1">&rarr;</span>
                            <span className="font-bold text-stone-900">{m.newStock}</span>
                          </td>

                          <td className="px-4 py-3 text-xs font-mono text-stone-500">
                            {m.referenceId || '—'}
                          </td>

                          <td className="px-5 py-3 text-xs text-stone-700">
                            {m.reason}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PHYSICAL STOCK COUNT (Section 9 & 10) */}
      {activeTab === 'count' && (
        <PhysicalStockCountView
          products={products}
          currency={store.currency}
          onRecordAdjustment={(productId, quantityChange, reason) => {
            recordAdjustment(productId, quantityChange, reason);
            setActionSuccess(`Recorded stock count adjustment (${quantityChange > 0 ? '+' : ''}${quantityChange}) with reason: ${reason}`);
            setTimeout(() => setActionSuccess(null), 5000);
          }}
          onOpenProduct360={(prod) => setSelected360Product(prod)}
        />
      )}

      {/* TAB 4: INVENTORY ANALYSIS (Section 17, 18, 19, 21) */}
      {activeTab === 'analysis' && (
        <InventoryAnalysisView
          products={products}
          sales={sales}
          movements={movements}
          currency={store.currency}
          onOpenProduct360={(prod) => setSelected360Product(prod)}
          onOpenReconciliation={() => setIsReconciliationOpen(true)}
        />
      )}

      {/* 360° PRODUCT VIEW MODAL (Section 13, 14, 15) */}
      <Product360Modal
        product={selected360Product}
        movements={movements}
        sales={sales}
        purchases={purchases}
        currency={store.currency}
        onClose={() => setSelected360Product(null)}
        onAdjustStock={(prod) => {
          setSelected360Product(null);
          setAdjustProduct(prod);
          setAdjustQty(-1);
          setAdjustReasonCategory('Data Correction');
          setAdjustCustomNotes('Reconciliation correction');
        }}
      />

      {/* STORE RECONCILIATION AUDIT MODAL (Section 6, 7) */}
      <InventoryReconciliationModal
        isOpen={isReconciliationOpen}
        onClose={() => setIsReconciliationOpen(false)}
        products={products}
        movements={movements}
        currency={store.currency}
        onAdjustProduct={(prod) => {
          setAdjustProduct(prod);
          setAdjustQty(-1);
          setAdjustReasonCategory('Data Correction');
          setAdjustCustomNotes('Audit reconciliation correction');
        }}
        onOpenProduct360={(prod) => setSelected360Product(prod)}
      />

      {/* STOCK IN MODAL (Section 12) */}
      <Modal
        id="stock-in-modal"
        isOpen={!!stockInProduct}
        onClose={() => setStockInProduct(null)}
        title="Record Traceable Stock In"
        subtitle={`Replenishing inventory for: ${stockInProduct?.name}`}
      >
        <form onSubmit={handleStockInSubmit} className="space-y-4 text-sm">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Current Verified Stock:</span>
              <span className="font-bold text-stone-900">{stockInProduct?.currentStock} units</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Unit Cost Price:</span>
              <span className="font-mono text-stone-900">
                {store.currency} {stockInProduct?.costPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-stone-600 border-t border-stone-200 pt-1 mt-1">
              <span>New Stock Result:</span>
              <span className="font-bold text-emerald-700">
                {(stockInProduct?.currentStock ?? 0) + (Number(stockInQty) || 0)} units
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Quantity to Receive (Units) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              value={stockInQty}
              onChange={(e) => setStockInQty(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Supplier / Batch / Invoice Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. PO-2026-081 or DO-9821"
              value={stockInRef}
              onChange={(e) => setStockInRef(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Audit Reason / Note <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Supplier delivery restock"
              value={stockInReason}
              onChange={(e) => setStockInReason(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setStockInProduct(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Confirm Stock In
            </button>
          </div>
        </form>
      </Modal>

      {/* STOCK ADJUSTMENT MODAL (Section 8: Standard Reasons) */}
      <Modal
        id="adjust-modal"
        isOpen={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        title="Record Stock Adjustment"
        subtitle={`Audit variance adjustment for: ${adjustProduct?.name}`}
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-sm">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Current Stock on Record:</span>
              <span className="font-bold text-stone-900">{adjustProduct?.currentStock} units</span>
            </div>
            <div className="flex justify-between text-stone-600 border-t border-stone-200 pt-1 mt-1">
              <span>Resulting Stock Balance:</span>
              <span
                className={`font-bold font-mono ${
                  (adjustProduct?.currentStock ?? 0) + (Number(adjustQty) || 0) < 0
                    ? 'text-rose-600'
                    : 'text-stone-900'
                }`}
              >
                {(adjustProduct?.currentStock ?? 0) + (Number(adjustQty) || 0)} units
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Quantity Change Delta (+ or -) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              step="1"
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <span className="text-[11px] text-stone-400">
              Use positive numbers (e.g. +5) to increase stock, negative numbers (e.g. -2) to decrease stock.
            </span>
          </div>

          {/* Standard Reasons (Section 8) */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Standard Reason Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
              {STANDARD_ADJUSTMENT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAdjustReasonCategory(r)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    adjustReasonCategory === r
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Additional notes (optional)..."
              value={adjustCustomNotes}
              onChange={(e) => setAdjustCustomNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setAdjustProduct(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* RETURN MODAL (Section 14) */}
      <Modal
        id="return-modal"
        isOpen={!!returnProduct}
        onClose={() => setReturnProduct(null)}
        title="Record Inventory Return"
        subtitle={`Accepting returned stock for: ${returnProduct?.name}`}
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4 text-sm">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Current Verified Stock:</span>
              <span className="font-bold text-stone-900">{returnProduct?.currentStock} units</span>
            </div>
            <div className="flex justify-between text-stone-600 border-t border-stone-200 pt-1 mt-1">
              <span>New Stock Result:</span>
              <span className="font-bold text-emerald-700">
                {(returnProduct?.currentStock ?? 0) + (Number(returnQty) || 0)} units
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Returned Quantity (Units) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              value={returnQty}
              onChange={(e) => setReturnQty(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Original Receipt / Transaction Ref (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. SALE-2026-001"
              value={returnRef}
              onChange={(e) => setReturnRef(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Reason for Return <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setReturnProduct(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Accept Return
            </button>
          </div>
        </form>
      </Modal>

      {/* TRACEABILITY AUDIT MODAL (Section 16) */}
      {auditProduct && (
        <Modal
          id="audit-trail-modal"
          isOpen={!!auditProduct}
          onClose={() => setAuditProduct(null)}
          title={`Traceability Audit: ${auditProduct.name}`}
          subtitle={`SKU: ${auditProduct.sku} • Store: ${store.name}`}
          maxWidth="max-w-2xl"
        >
          {(() => {
            const verification = InventoryService.verifyStockTraceability(
              auditProduct,
              movements
            );
            const productMovements = movements.filter(
              (m) => m.productId === auditProduct.id
            );

            return (
              <div className="space-y-4 text-xs">
                {/* Mathematical Equation Card */}
                <div className="p-4 rounded-xl bg-stone-900 text-white space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-stone-400">
                    Traceability Equation (Section 16)
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                    {verification.breakdown.openingStock > 0 && (
                      <>
                        <span className="text-blue-400">
                          {verification.breakdown.openingStock} Opening
                        </span>
                        <span className="text-stone-400">+</span>
                      </>
                    )}
                    <span className="text-emerald-400">
                      +{verification.breakdown.stockIn} In
                    </span>
                    <span className="text-stone-400">-</span>
                    <span className="text-rose-400">
                      {verification.breakdown.sales} Sold
                    </span>
                    {verification.breakdown.returns > 0 && (
                      <>
                        <span className="text-stone-400">+</span>
                        <span className="text-cyan-400">
                          {verification.breakdown.returns} Returns
                        </span>
                      </>
                    )}
                    <span className="text-stone-400">
                      {verification.breakdown.adjustments >= 0 ? '+' : ''}
                    </span>
                    <span className="text-amber-400">
                      {verification.breakdown.adjustments} Adj
                    </span>
                    <span className="text-stone-400">=</span>
                    <span className="text-base font-bold text-white">
                      {verification.calculatedStock} Units
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-300 flex items-center justify-between pt-1 border-t border-stone-800">
                    <div>
                      Current on-hand: <strong>{auditProduct.currentStock} units</strong>
                    </div>
                    {verification.isConsistent ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        100% Mathematically verified
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Discrepancy detected
                      </span>
                    )}
                  </div>
                </div>

                {/* Movements breakdown for this item */}
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <div className="bg-stone-50 px-3 py-2 font-semibold text-stone-700 border-b border-stone-200 flex justify-between items-center">
                    <span>Recorded Movements ({productMovements.length})</span>
                    <span className="text-[11px] text-stone-400 font-normal">
                      Most recent first
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
                    {productMovements.length === 0 ? (
                      <div className="p-4 text-center text-stone-400">
                        No movements recorded yet for this product.
                      </div>
                    ) : (
                      productMovements.map((m) => (
                        <div
                          key={m.id}
                          className="px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <MovementTypeBadge type={m.type} />
                              <span className="text-stone-800 font-medium">
                                {m.reason}
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {new Date(m.createdAt).toLocaleString()} • Ref: {m.referenceId || 'N/A'}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <span
                              className={
                                m.quantity > 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                              }
                            >
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                            <div className="text-[10px] text-stone-400">
                              {m.previousStock} &rarr; {m.newStock}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setAuditProduct(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 cursor-pointer"
                  >
                    Close Audit
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
