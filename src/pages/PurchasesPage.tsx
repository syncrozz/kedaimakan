/**
 * NiagaPOS - Purchases & Stock Receiving Page
 * Part 05: Purchasing + Supplier Management
 *
 * Core Workflow:
 * SUPPLIER → PURCHASE → STOCK RECEIVED → INVENTORY (STOCK_IN)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Check,
  Clock,
  XCircle,
  Eye,
  Calendar,
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  Building2,
  Trash2,
  X,
  FileCheck2,
  RotateCcw,
  FilterX,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Purchase, PurchaseStatus, Product } from '../types';
import { formatCurrency, formatDateTime } from '../services/formatters';
import { PurchasingService } from '../services/purchasingService';
import { ProductSearchPicker } from '../components/purchases/ProductSearchPicker';

interface PurchasesPageProps {
  onNavigate?: (page: any) => void;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({ onNavigate }) => {
  const {
    store,
    suppliers,
    products,
    purchases,
    createPurchase,
    completePurchase,
    createAndCompletePurchase,
    cancelPurchase,
    pullAllFromCloud,
  } = useStore();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const hasActiveFilters = Boolean(
    searchQuery.trim() !== '' ||
    supplierFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    customStartDate !== '' ||
    customEndDate !== ''
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSupplierFilter('ALL');
    setStatusFilter('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Modals
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [selectedPurchaseForDetail, setSelectedPurchaseForDetail] = useState<Purchase | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Keyboard Escape listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPurchaseForDetail) {
          setSelectedPurchaseForDetail(null);
        } else if (isNewPurchaseModalOpen) {
          setIsNewPurchaseModalOpen(false);
        }
      }
    };
    if (isNewPurchaseModalOpen || selectedPurchaseForDetail) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNewPurchaseModalOpen, selectedPurchaseForDetail]);

  // New Purchase Form State
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [formNotes, setFormNotes] = useState('');
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formItems, setFormItems] = useState<
    { productId: string; quantity: number; unitCost: number }[]
  >([]);

  // Item addition draft
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitCost, setItemUnitCost] = useState<number>(0);
  const [itemError, setItemError] = useState<string | null>(null);

  // Item addition feedback state (flash indicator & audio feedback)
  const [isItemAddedSuccess, setIsItemAddedSuccess] = useState(false);
  const [recentlyAddedItemInfo, setRecentlyAddedItemInfo] = useState<{
    productId: string;
    name: string;
    quantity: number;
  } | null>(null);

  // Save & Receive feedback states
  const [saveButtonFeedback, setSaveButtonFeedback] = useState<'IDLE' | 'RECEIVING' | 'DRAFTING'>('IDLE');
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState<string | null>(null);
  const [stepItemFlash, setStepItemFlash] = useState(false);

  // Synthesize positive confirmation audio chime via Web Audio API (POS Confirmation Chime)
  const playAddItemSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Crisp POS positive confirmation chime: E5 (659.25Hz) -> A5 (880Hz)
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Gracefully ignore
    }
  };

  // Synthesize dual-tone triumphant success chime for Receive Stock / Save Purchase
  const playPositiveSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      
      // Tone 1: E5 (659.25Hz) -> G5 (784Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(784.0, now + 0.08);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Tone 2: C6 (1046.5Hz) - bright confirmation
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18);
      gain2.gain.setValueAtTime(0.3, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    } catch {
      // Gracefully ignore
    }
  };

  // Warning buzz chime if user clicks action when no items or required fields missing
  const playWarningSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(240, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Gracefully ignore
    }
  };

  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active), [suppliers]);
  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  // Section 6: Extract recently purchased active products from actual purchase history
  const recentlyPurchasedProducts = useMemo(() => {
    const seenProductIds = new Set<string>();
    const recentList: Product[] = [];
    const sorted = [...purchases].sort(
      (a, b) => new Date(b.purchaseDate || b.createdAt).getTime() - new Date(a.purchaseDate || a.createdAt).getTime()
    );
    for (const purchase of sorted) {
      if (!purchase.items) continue;
      for (const item of purchase.items) {
        if (!seenProductIds.has(item.productId)) {
          seenProductIds.add(item.productId);
          const prod = activeProducts.find((p) => p.id === item.productId);
          if (prod) {
            recentList.push(prod);
            if (recentList.length >= 5) break;
          }
        }
      }
      if (recentList.length >= 5) break;
    }
    return recentList;
  }, [purchases, activeProducts]);

  // Date boundary calculation
  const dateBounds = useMemo(() => {
    const now = new Date();
    if (datePreset === 'ALL') return {};

    if (datePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (datePreset === 'WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
      return { start: monday.toISOString(), end: now.toISOString() };
    }

    if (datePreset === 'MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    }

    if (datePreset === 'CUSTOM') {
      return {
        start: customStartDate ? new Date(`${customStartDate}T00:00:00`).toISOString() : undefined,
        end: customEndDate ? new Date(`${customEndDate}T23:59:59.999`).toISOString() : undefined,
      };
    }

    return {};
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered & sorted purchases (newest purchase first: descending by date / purchase number)
  const filteredPurchases = useMemo(() => {
    const list = PurchasingService.filterPurchases(purchases, {
      startDate: dateBounds.start,
      endDate: dateBounds.end,
      supplierId: supplierFilter === 'ALL' ? undefined : supplierFilter,
      status: statusFilter === 'ALL' ? undefined : (statusFilter as PurchaseStatus),
      search: searchQuery,
    });

    return [...list].sort((a, b) => {
      const timeB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
      const timeA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (b.purchaseNumber || '').localeCompare(a.purchaseNumber || '');
    });
  }, [purchases, dateBounds, supplierFilter, statusFilter, searchQuery]);

  const openNewPurchaseModal = () => {
    setFormSupplierId(activeSuppliers[0]?.id || '');
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormNotes('');
    setFormDiscount(0);
    setFormItems([]);
    setSelectedProductId('');
    setItemUnitCost(0);
    setItemQuantity(10);
    setItemError(null);
    setActionErrorMessage(null);
    setIsItemAddedSuccess(false);
    setRecentlyAddedItemInfo(null);
    setIsNewPurchaseModalOpen(true);
  };

  const handleProductSelectionChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setItemUnitCost(prod.costPrice);
      setItemError(null);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setItemUnitCost(product.costPrice);
    setItemError(null);
  };

  const handleClearProduct = () => {
    setSelectedProductId('');
    setItemUnitCost(0);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);

    if (!selectedProductId) {
      setItemError('Please choose a product.');
      return;
    }

    if (itemQuantity <= 0 || !Number.isInteger(Number(itemQuantity))) {
      setItemError('Quantity must be a positive whole number.');
      return;
    }

    if (itemUnitCost < 0 || isNaN(Number(itemUnitCost))) {
      setItemError('Unit cost cannot be negative.');
      return;
    }

    const currentProductId = selectedProductId;
    const addedProduct = products.find((p) => p.id === currentProductId);
    const addedQty = Number(itemQuantity);

    const existingIndex = formItems.findIndex((i) => i.productId === currentProductId);
    if (existingIndex >= 0) {
      // Update existing line
      const updated = [...formItems];
      updated[existingIndex].quantity += Number(itemQuantity);
      updated[existingIndex].unitCost = Number(itemUnitCost);
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          productId: currentProductId,
          quantity: Number(itemQuantity),
          unitCost: Number(itemUnitCost),
        },
      ]);
    }

    // 1. Play POS confirmation audio chime
    playAddItemSound();

    // 2. Trigger visual confirmation state on button & highlight notification banner
    setIsItemAddedSuccess(true);
    setRecentlyAddedItemInfo({
      productId: currentProductId,
      name: addedProduct?.name || 'Produk',
      quantity: addedQty,
    });

    // Reset button flash back to normal after 1.5 seconds
    setTimeout(() => {
      setIsItemAddedSuccess(false);
    }, 1500);

    // Fade out row highlight and notification banner after 2.8 seconds
    setTimeout(() => {
      setRecentlyAddedItemInfo((prev) => (prev?.productId === currentProductId ? null : prev));
    }, 2800);

    // Reset product selection and draft fields so user can immediately search & add next product
    setSelectedProductId('');
    setItemUnitCost(0);
    setItemQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Form subtotal and total calculations
  const formTotals = useMemo(() => {
    return PurchasingService.calculatePurchaseTotals(formItems, formDiscount);
  }, [formItems, formDiscount]);

  const handleSavePurchase = (autoComplete = false) => {
    setActionErrorMessage(null);
    setItemError(null);

    // Auto-detect if user has picked a product in step 2 but hasn't clicked "+ Add Item" yet!
    let effectiveItems = [...formItems];
    if (selectedProductId) {
      const pendingProduct = products.find((p) => p.id === selectedProductId);
      if (pendingProduct) {
        const qty = Math.max(1, Number(itemQuantity) || 1);
        const cost = Number(itemUnitCost) >= 0 ? Number(itemUnitCost) : (pendingProduct.costPrice || 0);
        const existingIdx = effectiveItems.findIndex((i) => i.productId === selectedProductId);
        if (existingIdx >= 0) {
          effectiveItems[existingIdx].quantity += qty;
          effectiveItems[existingIdx].unitCost = cost;
        } else {
          effectiveItems.push({
            productId: pendingProduct.id,
            quantity: qty,
            unitCost: cost,
          });
        }
        setFormItems(effectiveItems);
        setSelectedProductId('');
      }
    }

    if (!formSupplierId) {
      playWarningSound();
      setActionErrorMessage('Sila pilih pembekal aktif terlebih dahulu (Please select an active supplier).');
      return;
    }

    if (effectiveItems.length === 0) {
      playWarningSound();
      setItemError('Sila pilih produk dan masukkan sekurang-kurangnya 1 item ke dalam senarai!');
      setStepItemFlash(true);
      setTimeout(() => setStepItemFlash(false), 2500);
      return;
    }

    try {
      // 1. Play rich positive confirmation audio chime
      playPositiveSound();

      // 2. Trigger instant button flash feedback
      setSaveButtonFeedback(autoComplete ? 'RECEIVING' : 'DRAFTING');

      // 3. Atomically execute purchase operation
      let targetId = '';
      if (autoComplete) {
        const result = createAndCompletePurchase({
          supplierId: formSupplierId,
          purchaseDate: new Date(`${formDate}T12:00:00Z`).toISOString(),
          items: effectiveItems,
          discount: Number(formDiscount) || 0,
          notes: formNotes,
        });
        targetId = result.completedPurchase.id;
        setActionSuccessMessage(
          `✓ Pembelian ${result.completedPurchase.purchaseNumber} berjaya direkodkan & stok dimasukkan ke inventori!`
        );
      } else {
        const created = createPurchase({
          supplierId: formSupplierId,
          purchaseDate: new Date(`${formDate}T12:00:00Z`).toISOString(),
          items: effectiveItems,
          discount: Number(formDiscount) || 0,
          notes: formNotes,
        });
        targetId = created.id;
        setActionSuccessMessage(`✓ Pesanan ${created.purchaseNumber} disimpan sebagai Draf.`);
      }

      // Highlight the newly created purchase at the top of the list
      setHighlightedPurchaseId(targetId);
      setTimeout(() => setHighlightedPurchaseId(null), 5000);

      // Give user brief time to observe the success chime & flash indicator before closing modal
      setTimeout(() => {
        setIsNewPurchaseModalOpen(false);
        setSaveButtonFeedback('IDLE');
        setTimeout(() => setActionSuccessMessage(null), 6000);
      }, 350);
    } catch (err: any) {
      playWarningSound();
      setSaveButtonFeedback('IDLE');
      setActionErrorMessage(err.message || 'Gagal memproses pembelian.');
    }
  };

  const handleCompleteExisting = (purchaseId: string) => {
    setActionErrorMessage(null);
    try {
      const result = completePurchase(purchaseId);
      setActionSuccessMessage(
        `Purchase ${result.completedPurchase.purchaseNumber} received! ${result.newMovements.length} inventory movements recorded.`
      );
      if (selectedPurchaseForDetail?.id === purchaseId) {
        setSelectedPurchaseForDetail(result.completedPurchase);
      }
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to complete purchase.');
    }
  };

  const handleCancelExisting = (purchaseId: string) => {
    setActionErrorMessage(null);
    try {
      const cancelled = cancelPurchase(purchaseId);
      setActionSuccessMessage(`Purchase ${cancelled.purchaseNumber} cancelled.`);
      if (selectedPurchaseForDetail?.id === purchaseId) {
        setSelectedPurchaseForDetail(cancelled);
      }
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to cancel purchase.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Purchasing</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Part 05
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Supplier orders, stock receiving, unit cost snapshots, and automatic inventory replenishment.
          </p>
        </div>

        <button
          type="button"
          id="btn-new-purchase"
          onClick={openNewPurchaseModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase</span>
        </button>
      </div>

      {/* Action Messages */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button type="button" onClick={() => setActionSuccessMessage(null)} className="text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span className="font-medium">{actionErrorMessage}</span>
          </div>
          <button type="button" onClick={() => setActionErrorMessage(null)} className="text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              id="purchases-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search purchase #, supplier, or product..."
              className="w-full pl-9.5 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Supplier Filter */}
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierCode} - {s.supplierName}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed (Received)</option>
              <option value="DRAFT">Draft (Pending)</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-stone-400 mr-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date:
            </span>
            {(['ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                  datePreset === preset
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {preset === 'ALL'
                  ? 'All Time'
                  : preset === 'TODAY'
                  ? 'Today'
                  : preset === 'WEEK'
                  ? 'This Week'
                  : preset === 'MONTH'
                  ? 'This Month'
                  : 'Custom'}
              </button>
            ))}

            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                />
                <span className="text-xs text-stone-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                />
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              id="btn-reset-filters-top"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        {filteredPurchases.length === 0 ? (
          <div className="py-16 text-center text-stone-500 px-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
              {hasActiveFilters ? <FilterX className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
            </div>
            <p className="text-base font-semibold text-stone-800">
              {hasActiveFilters
                ? 'Tiada Rekod Pembelian Sepadan (No Matching Purchases)'
                : 'Tiada Rekod Pembelian (No Purchase Records Found)'}
            </p>
            <p className="text-xs text-stone-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? `Tiada pesanan pembelian menepati tapisan semasa (${[
                    searchQuery ? `carian "${searchQuery}"` : null,
                    supplierFilter !== 'ALL' ? 'pembekal terpilih' : null,
                    statusFilter !== 'ALL' ? `status ${statusFilter}` : null,
                    datePreset !== 'ALL' ? `tarikh: ${datePreset}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}). Sila klik butang di bawah untuk menunjukkan semua rekod.`
                : 'Belum ada pesanan pembelian pembekal direkodkan. Klik butang di bawah untuk membina pesanan baharu atau segerak semula dari awan Firestore.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
              {hasActiveFilters && (
                <button
                  type="button"
                  id="btn-reset-filters"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Set Semula Penapis (Tunjuk Semua)</span>
                </button>
              )}
              <button
                type="button"
                id="btn-empty-new-purchase"
                onClick={openNewPurchaseModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bina Pesanan Baharu</span>
              </button>
              <button
                type="button"
                id="btn-sync-cloud-purchases"
                onClick={async () => {
                  await pullAllFromCloud();
                  setActionSuccessMessage('Data pembelian berjaya disegerakkan daripada Firestore.');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Segerak Dari Firestore</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-stone-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Purchase #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4 text-center">Items</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filteredPurchases.map((purchase) => {
                  const isJustAdded = purchase.id === highlightedPurchaseId;
                  return (
                    <tr
                      key={purchase.id}
                      className={`transition-all duration-500 ${
                        isJustAdded
                          ? 'bg-emerald-100/90 ring-2 ring-emerald-500 font-medium'
                          : 'hover:bg-stone-50/60'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-xs text-stone-900">
                        <div className="flex items-center gap-1.5">
                          {isJustAdded && (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                          )}
                          <span>{purchase.purchaseNumber}</span>
                          {isJustAdded && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-sans uppercase font-bold tracking-wider">
                              Baru
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        {formatDateTime(purchase.purchaseDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900">{purchase.supplierNameSnapshot}</div>
                        <div className="text-xs text-stone-400 font-mono">
                          {purchase.supplierCodeSnapshot}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-stone-800">{purchase.items.length}</span>
                        <span className="text-xs text-stone-400 block">
                          ({purchase.items.reduce((s, i) => s + i.quantity, 0)} units)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-stone-900">
                          {formatCurrency(purchase.total, store.currency)}
                        </div>
                        {purchase.discount > 0 && (
                          <div className="text-[10px] text-amber-600">
                            Disc: {formatCurrency(purchase.discount, store.currency)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            purchase.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : purchase.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {purchase.status === 'COMPLETED' && (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Received</span>
                            </>
                          )}
                          {purchase.status === 'DRAFT' && (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Draft</span>
                            </>
                          )}
                          {purchase.status === 'CANCELLED' && (
                            <>
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>Cancelled</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="View Purchase Details"
                            onClick={() => setSelectedPurchaseForDetail(purchase)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {purchase.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                title="Complete Purchase & Receive Stock"
                                onClick={() => handleCompleteExisting(purchase.id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-2xs"
                              >
                                Receive
                              </button>
                              <button
                                type="button"
                                title="Cancel Draft Purchase"
                                onClick={() => handleCancelExisting(purchase.id)}
                                className="px-2 py-1 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Purchase Modal */}
      {isNewPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-stone-900">Create Supplier Purchase Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPurchaseModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {actionErrorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionErrorMessage}</span>
                </div>
              )}

              {/* Step 1: Supplier & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Select Active Supplier <span className="text-rose-600">*</span>
                  </label>
                  {activeSuppliers.length === 0 ? (
                    <div className="text-xs text-rose-600 p-2 bg-rose-50 rounded border border-rose-200">
                      No active suppliers found. Please register or activate a supplier first.
                    </div>
                  ) : (
                    <select
                      value={formSupplierId}
                      onChange={(e) => setFormSupplierId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    >
                      {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.supplierCode} - {s.supplierName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Purchase Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Step 2: Add Line Item */}
              <div
                className={`p-4 rounded-xl border bg-white space-y-3 transition-all duration-300 ${
                  stepItemFlash
                    ? 'border-rose-400 ring-4 ring-rose-200/80 bg-rose-50/30'
                    : 'border-stone-200'
                }`}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Add Products to Purchase</span>
                </h4>

                {itemError && (
                  <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {itemError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label htmlFor="purchase-product-search-input" className="block text-[11px] font-medium text-stone-600 mb-1">
                      Product (Active Only) <span className="text-rose-600">*</span>
                    </label>
                    <ProductSearchPicker
                      products={activeProducts}
                      selectedProductId={selectedProductId}
                      onSelectProduct={handleSelectProduct}
                      onClearProduct={handleClearProduct}
                      currency={store.currency}
                      recentlyPurchasedProducts={recentlyPurchasedProducts}
                      placeholder="Cari nama produk atau SKU (cth: Botan)..."
                      hasError={!!itemError && !selectedProductId}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 text-center font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Unit Cost ({store.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemUnitCost}
                      onChange={(e) => setItemUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono text-right"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      id="add-purchase-item-btn"
                      onClick={handleAddItem}
                      className={`w-full px-3 py-2 text-xs rounded-lg font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                        isItemAddedSuccess
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1 scale-[1.02]'
                          : 'bg-stone-900 hover:bg-stone-800 text-white'
                      }`}
                    >
                      {isItemAddedSuccess ? (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>✓ Ditambah!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Item</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Visual Feedback Flash Notification */}
                {recentlyAddedItemInfo && (
                  <div
                    id="purchase-item-added-alert"
                    className="mt-2.5 px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center justify-between gap-2 shadow-xs transition-all duration-200"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Item berjaya masuk ke senarai:{' '}
                        <strong className="font-semibold text-emerald-950">
                          {recentlyAddedItemInfo.quantity}x {recentlyAddedItemInfo.name}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded shrink-0 border border-emerald-300">
                      ✓ Masuk List
                    </span>
                  </div>
                )}
              </div>

              {/* Items List Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Purchase Order Items ({formItems.length})
                </h4>

                {formItems.length === 0 ? (
                  <div className="py-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-300 text-stone-400 text-xs">
                    No items added yet. Select a product above and click "+ Add Item".
                  </div>
                ) : (
                  <div className="rounded-xl border border-stone-200 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3 text-center">Quantity</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                          <th className="py-2.5 px-3 text-center">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {formItems.map((item, idx) => {
                          const prod = products.find((p) => p.id === item.productId);
                          const lineTotal = item.quantity * item.unitCost;
                          const isRecentlyAdded = recentlyAddedItemInfo?.productId === item.productId;

                          return (
                            <tr
                              key={idx}
                              className={`transition-colors duration-500 ${
                                isRecentlyAdded
                                  ? 'bg-emerald-100/90 ring-2 ring-inset ring-emerald-400 font-medium'
                                  : 'hover:bg-stone-50/70'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="font-medium text-stone-900">{prod?.name || 'Unknown'}</div>
                                  {isRecentlyAdded && (
                                    <span className="text-[9px] bg-emerald-600 text-white font-bold px-1 py-0.2 rounded shrink-0">
                                      Baru Ditambah
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-stone-400 font-mono">{prod?.sku}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-stone-800">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                                {formatCurrency(item.unitCost, store.currency)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                                {formatCurrency(lineTotal, store.currency)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-stone-400 hover:text-rose-600 p-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Discount, Notes, and Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Notes / Delivery Reference
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Invoice #INV-89102, received by En. Azman"
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
                  />
                </div>

                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-stone-900">
                      {formatCurrency(formTotals.subtotal, store.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-stone-600">
                    <span>Purchase Discount ({store.currency}):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 px-2 py-1 text-xs text-right font-mono bg-white border border-stone-200 rounded focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-bold text-stone-900">
                    <span>Total Purchase:</span>
                    <span className="text-base text-emerald-800 font-extrabold">
                      {formatCurrency(formTotals.total, store.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsNewPurchaseModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg font-medium"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  id="btn-save-purchase-draft"
                  disabled={saveButtonFeedback !== 'IDLE'}
                  onClick={() => handleSavePurchase(false)}
                  className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    saveButtonFeedback === 'DRAFTING'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-400 scale-[1.02] shadow-sm'
                      : 'bg-stone-200 hover:bg-stone-300 text-stone-800 active:scale-95'
                  }`}
                >
                  {saveButtonFeedback === 'DRAFTING' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>✓ Disimpan!</span>
                    </>
                  ) : (
                    <span>Save as Draft</span>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-save-purchase-receive"
                  disabled={saveButtonFeedback !== 'IDLE'}
                  onClick={() => handleSavePurchase(true)}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm rounded-lg font-semibold transition-all duration-200 shadow-sm cursor-pointer active:scale-95 ${
                    saveButtonFeedback === 'RECEIVING'
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 ring-offset-2 scale-[1.03] animate-pulse shadow-md'
                      : formItems.length === 0 && !selectedProductId
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white hover:ring-2 hover:ring-emerald-400'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white ring-1 ring-emerald-600 hover:shadow-md'
                  }`}
                >
                  {saveButtonFeedback === 'RECEIVING' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>✓ Item & Stok Berjaya Dimasukkan!</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      <span>Receive Stock Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Detail Modal */}
      {selectedPurchaseForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-stone-200 flex items-start justify-between bg-stone-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-stone-900 text-white">
                    {selectedPurchaseForDetail.purchaseNumber}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedPurchaseForDetail.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedPurchaseForDetail.status === 'DRAFT'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {selectedPurchaseForDetail.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Recorded: {formatDateTime(selectedPurchaseForDetail.purchaseDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchaseForDetail(null)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Supplier Snapshot Card */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                    Supplier Snapshot (Immutably Preserved)
                  </span>
                  <div className="font-semibold text-stone-900 mt-0.5">
                    {selectedPurchaseForDetail.supplierNameSnapshot}
                  </div>
                  <div className="text-xs font-mono text-stone-500">
                    Code: {selectedPurchaseForDetail.supplierCodeSnapshot}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2.5 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-stone-500" />
                  <span>Purchased Items Snapshot</span>
                </h4>

                <div className="rounded-xl border border-stone-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {selectedPurchaseForDetail.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/70">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-stone-900">
                              {item.productNameSnapshot}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">
                              {item.skuSnapshot}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-stone-800">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                            {formatCurrency(item.unitCost, store.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                            {formatCurrency(item.lineTotal, store.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-stone-900">
                    {formatCurrency(selectedPurchaseForDetail.subtotal, store.currency)}
                  </span>
                </div>
                {selectedPurchaseForDetail.discount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount:</span>
                    <span>-{formatCurrency(selectedPurchaseForDetail.discount, store.currency)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-bold text-stone-900">
                  <span>Total Received Value:</span>
                  <span className="text-base text-emerald-800 font-extrabold">
                    {formatCurrency(selectedPurchaseForDetail.total, store.currency)}
                  </span>
                </div>
              </div>

              {selectedPurchaseForDetail.notes && (
                <div className="p-3 bg-stone-50 rounded-lg text-xs text-stone-600">
                  <span className="font-semibold block text-stone-700 mb-0.5">Notes:</span>
                  {selectedPurchaseForDetail.notes}
                </div>
              )}

              {/* Inventory Effect / Audit Trail (Section 22) */}
              <div
                className={`p-4 rounded-xl border ${
                  selectedPurchaseForDetail.status === 'COMPLETED'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/60 border-amber-200 text-amber-950'
                }`}
              >
                <h5 className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {selectedPurchaseForDetail.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600" />
                  )}
                  <span>Inventory Receiving Status</span>
                </h5>
                <p className="text-xs mt-1">
                  {selectedPurchaseForDetail.status === 'COMPLETED'
                    ? `Stock received into inventory. Each item generated a traceable STOCK_IN movement referencing ID "${selectedPurchaseForDetail.id}". Product cost prices were updated to latest unit costs without altering historical SaleItem COGS.`
                    : 'Draft purchase order. Inventory levels and product cost prices are NOT affected until this purchase is confirmed and marked Complete.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/50 flex justify-between items-center">
              {selectedPurchaseForDetail.status === 'DRAFT' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCancelExisting(selectedPurchaseForDetail.id)}
                    className="px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium"
                  >
                    Cancel Order
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompleteExisting(selectedPurchaseForDetail.id)}
                    className="px-4 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Complete & Receive Stock</span>
                  </button>
                </div>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedPurchaseForDetail(null)}
                className="px-4 py-2 text-sm bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
