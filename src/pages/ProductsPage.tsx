import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Trash2,
  Power,
  Image as ImageIcon,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  History,
  ShieldCheck,
  Download,
  UploadCloud,
  FileSpreadsheet,
  SearchCheck,
  Building2,
  Users,
  UserCheck,
  CheckSquare,
  Square,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product, StockStatus, CommitUpsertPayload, UpsertImportCommitResult } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { InventoryService } from '../services/inventoryService';
import { PurchasingService } from '../services/purchasingService';
import { formatCurrency, formatDateTime } from '../services/formatters';
import { CsvService } from '../services/csvService';
import { DuplicateAuditService, DuplicateAuditGroup } from '../services/duplicateAuditService';
import { SmartInputService } from '../services/smartInputService';
import { ProductDeleteEligibility } from '../services/productService';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { DuplicateAuditModal } from '../components/common/DuplicateAuditModal';

export const ProductsPage: React.FC = () => {
  const {
    store,
    products,
    purchases,
    addProduct,
    importProducts,
    commitProductsUpsertImport,
    updateProduct,
    toggleProductActive,
    deleteProduct,
    deactivateProduct,
    checkProductDeleteEligibility,
    isSkuAvailable,
    isAdminMode,
    requireAdmin,
    clearAllStoreData,
    clearStoreCategories,
    suppliers,
    customers,
    staffUsers,
    loyaltyLedger,
    sales,
    movements,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [productStatusFilter, setProductStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | StockStatus>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingEligibility, setDeletingEligibility] = useState<ProductDeleteEligibility | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);
  const [isClearCatalogModalOpen, setIsClearCatalogModalOpen] = useState(false);
  const [isClearingCatalog, setIsClearingCatalog] = useState(false);
  const [clearMode, setClearMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [selectedClearCategories, setSelectedClearCategories] = useState<{
    products: boolean;
    suppliers: boolean;
    customers: boolean;
    staff: boolean;
  }>({
    products: true,
    suppliers: true,
    customers: true,
    staff: true,
  });

  // Duplicate audit groups (SES 4.4 Locked Part E)
  const duplicateAuditGroups = useMemo(
    () => DuplicateAuditService.auditProducts(products),
    [products]
  );

  // Notifications / feedback
  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Snacks & Biscuits',
    costPrice: 1.5,
    sellingPrice: 2.2,
    currentStock: 10,
    minimumStock: 5,
    imageUrl: '',
    active: true,
  });

  const [formError, setFormError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Derived stock status mapping
  const getProductStockStatus = (p: Product): StockStatus => {
    return InventoryService.getStockStatus(p);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === 'ALL' || p.category === selectedCategory;

      const matchesProductStatus =
        productStatusFilter === 'ALL'
          ? true
          : productStatusFilter === 'ACTIVE'
          ? p.active
          : !p.active;

      const pStockStatus = getProductStockStatus(p);
      const matchesStockStatus =
        stockStatusFilter === 'ALL' || pStockStatus === stockStatusFilter;

      return matchesSearch && matchesCategory && matchesProductStatus && matchesStockStatus;
    });
  }, [products, searchQuery, selectedCategory, productStatusFilter, stockStatusFilter]);

  const openAddModal = () => {
    setFormError(null);
    setFormData({
      sku: `NP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      name: '',
      category: 'Snacks & Biscuits',
      costPrice: 1.5,
      sellingPrice: 2.2,
      currentStock: 10,
      minimumStock: 5,
      imageUrl: '',
      active: true,
    });
    setIsAddModalOpen(true);
  };

  const handleAddClick = () => {
    requireAdmin(openAddModal, 'Tambah Produk Baru');
  };

  const openEditModal = (product: Product) => {
    setFormError(null);
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      imageUrl: product.imageUrl || '',
      active: product.active,
    });
  };

  const handleEditClick = (p: Product) => {
    requireAdmin(() => openEditModal(p), `Kemaskini Produk ${p.name}`);
  };

  const handleToggleActiveClick = (p: Product) => {
    requireAdmin(() => toggleProductActive(p.id), `Tukar Status Produk ${p.name}`);
  };

  const handleDeleteClick = (p: Product) => {
    const elig = checkProductDeleteEligibility(p.id);
    const actionLabel = elig.hasHistoricalReferences ? 'Nyahaktifkan Produk' : 'Padam Produk';
    requireAdmin(() => {
      setDeletingEligibility(elig);
      setDeletingProduct(p);
    }, `${actionLabel} ${p.name}`);
  };

  const handleImportCsvClick = () => {
    requireAdmin(() => setIsCsvImportOpen(true), 'Import Produk Melalui CSV');
  };

  const handleExportCsvClick = () => {
    CsvService.exportProducts(filteredProducts);
    setNotification({
      type: 'success',
      message: `Fail CSV untuk ${filteredProducts.length} produk telah dijana dan dimuat turun.`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCommitCsvImport = (
    items: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const count = importProducts(items);
    setNotification({
      type: 'success',
      message: `Berjaya mengimport ${count} produk ke dalam katalog ${store.name}.`,
    });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCommitCsvUpsert = (payload: CommitUpsertPayload): UpsertImportCommitResult => {
    const result = commitProductsUpsertImport(payload);
    let msg = `Import selesai: ${result.newCount} baru ditambah, ${result.updatedCount} dikemas kini.`;
    if (result.skippedCount > 0) {
      msg += ` (${result.skippedCount} dilangkau)`;
    }
    setNotification({
      type: 'success',
      message: msg,
    });
    setTimeout(() => setNotification(null), 5000);
    return result;
  };

  const handleClearCatalogClick = () => {
    requireAdmin(() => {
      setClearMode('ALL');
      setSelectedClearCategories({
        products: true,
        suppliers: true,
        customers: true,
        staff: true,
      });
      setIsClearCatalogModalOpen(true);
    }, 'Mula Dari Kosong (Pilihan Kategori)');
  };

  const handleConfirmClearCatalog = async () => {
    const targets =
      clearMode === 'ALL'
        ? { products: true, suppliers: true, customers: true, staff: true }
        : selectedClearCategories;

    const anySelected = targets.products || targets.suppliers || targets.customers || targets.staff;
    if (!anySelected) {
      setNotification({
        type: 'warning',
        message: 'Sila pilih sekurang-kurangnya 1 kategori untuk dikosongkan.',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    setIsClearingCatalog(true);
    try {
      const result = await clearStoreCategories(targets);
      setIsClearCatalogModalOpen(false);
      setNotification({
        type: 'success',
        message: result.message,
      });
      setTimeout(() => setNotification(null), 6000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Gagal mengosongkan data: ' + (err?.message || 'Ralat tidak diketahui'),
      });
    } finally {
      setIsClearingCatalog(false);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Smart Form input normalization (SES 4.4 Locked Part B)
    const trimmedName = SmartInputService.normalizeName(formData.name);
    const trimmedSku = SmartInputService.normalizeCode(formData.sku);
    const costPrice = SmartInputService.parseNumeric(formData.costPrice);
    const sellingPrice = SmartInputService.parseNumeric(formData.sellingPrice);
    const currentStock = Math.max(0, Math.floor(SmartInputService.parseNumeric(formData.currentStock)));
    const minimumStock = Math.max(0, Math.floor(SmartInputService.parseNumeric(formData.minimumStock)));

    if (!trimmedName) {
      setFormError('Product name cannot be empty.');
      return;
    }
    if (!trimmedSku) {
      setFormError('Product SKU cannot be empty.');
      return;
    }
    if (!isSkuAvailable(trimmedSku)) {
      setFormError(`SKU "${trimmedSku}" already exists in this store. SKU must be unique.`);
      return;
    }
    if (costPrice < 0) {
      setFormError('Cost price cannot be negative.');
      return;
    }
    if (sellingPrice < 0) {
      setFormError('Selling price cannot be negative.');
      return;
    }

    try {
      const created = addProduct({
        sku: trimmedSku,
        name: trimmedName,
        category: formData.category.trim() || 'General',
        costPrice,
        sellingPrice,
        currentStock,
        minimumStock,
        imageUrl: formData.imageUrl.trim() || undefined,
        active: formData.active,
      });

      setIsAddModalOpen(false);
      setNotification({
        type: 'success',
        message: `Product "${created.name}" (${created.sku}) added successfully with opening stock of ${created.currentStock} units.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add product.');
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFormError(null);

    // Smart Form input normalization (SES 4.4 Locked Part B)
    const trimmedName = SmartInputService.normalizeName(formData.name);
    const trimmedSku = SmartInputService.normalizeCode(formData.sku);
    const costPrice = SmartInputService.parseNumeric(formData.costPrice);
    const sellingPrice = SmartInputService.parseNumeric(formData.sellingPrice);
    const minimumStock = Math.max(0, Math.floor(SmartInputService.parseNumeric(formData.minimumStock)));

    if (!trimmedName) {
      setFormError('Product name cannot be empty.');
      return;
    }
    if (!trimmedSku) {
      setFormError('Product SKU cannot be empty.');
      return;
    }
    if (!isSkuAvailable(trimmedSku, editingProduct.id)) {
      setFormError(`SKU "${trimmedSku}" is already in use by another product in this store.`);
      return;
    }
    if (costPrice < 0) {
      setFormError('Cost price cannot be negative.');
      return;
    }
    if (sellingPrice < 0) {
      setFormError('Selling price cannot be negative.');
      return;
    }

    try {
      updateProduct(editingProduct.id, {
        sku: trimmedSku,
        name: trimmedName,
        category: formData.category.trim() || 'General',
        costPrice,
        sellingPrice,
        minimumStock,
        imageUrl: formData.imageUrl.trim() || undefined,
        active: formData.active,
      });

      setEditingProduct(null);
      setNotification({
        type: 'success',
        message: `Product "${trimmedName}" updated. Historical transactions remain immutable.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update product.');
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    if (deletingEligibility?.hasHistoricalReferences) {
      const result = deactivateProduct(deletingProduct.id);
      setDeletingProduct(null);
      setDeletingEligibility(null);
      setNotification({
        type: result.success ? 'success' : 'warning',
        message: result.message,
      });
    } else {
      const confirmWithStock = deletingProduct.currentStock > 0;
      const result = deleteProduct(deletingProduct.id, confirmWithStock);
      setDeletingProduct(null);
      setDeletingEligibility(null);
      setNotification({
        type: result.success ? 'success' : 'warning',
        message: result.message,
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // Profit calculation for add/edit preview
  const previewCost = Number(formData.costPrice) || 0;
  const previewSelling = Number(formData.sellingPrice) || 0;
  const previewProfit = previewSelling - previewCost;
  const previewMargin = previewSelling > 0 ? ((previewProfit / previewSelling) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Product Management
          </h1>
          <p className="text-sm text-stone-500">
            Define items, prices, cost structure, and active statuses for {store.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicate Audit Button (SES 4.4 Locked Part E) */}
          <button
            type="button"
            id="audit-duplicates-btn"
            onClick={() => setIsDuplicateAuditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Semak pertindihan nama atau SKU produk"
          >
            <SearchCheck className="w-4 h-4 text-stone-600" />
            <span>Audit Duplikasi</span>
            {duplicateAuditGroups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                {duplicateAuditGroups.length}
              </span>
            )}
          </button>

          {/* Export CSV Button (SES 4.4 Locked Part D) */}
          <button
            type="button"
            id="export-products-csv-btn"
            onClick={handleExportCsvClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Eksport senarai produk semasa ke fail CSV"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV Button (SES 4.4 Locked Part D: Admin Gated) */}
          <button
            type="button"
            id="import-products-csv-btn"
            onClick={handleImportCsvClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Import senarai produk dari fail CSV (PIN Admin diperlukan)"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Import CSV</span>
          </button>

          {/* Purge Demo & Start Fresh Button */}
          {(products.length > 0 || (suppliers && suppliers.length > 0) || (customers && customers.length > 0) || (staffUsers && staffUsers.length > 0)) && (
            <button
              type="button"
              id="clear-catalog-zero-btn"
              onClick={handleClearCatalogClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 bg-rose-50/90 text-rose-700 text-xs sm:text-sm font-semibold hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Mula dari kosong bagi semua kategori atau pilihan kategori: Product, Supplier, Customer, Staff"
            >
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Mula Dari Kosong</span>
            </button>
          )}

          {/* New Product Button (SES 4.4 Locked Part A: Admin Gated) */}
          <button
            type="button"
            id="add-product-btn"
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          id="product-notification-banner"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : notification.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Architectural Concept Banner: Product Status vs Stock Status */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 text-xs text-stone-600">
        <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5 sm:space-y-1">
          <div>
            <strong className="text-stone-800">Section 8 & 9 — Architecture Decoupling:</strong>{' '}
            <span className="font-semibold text-emerald-800">Product Status</span> (Active / Inactive) determines whether an item is eligible for POS checkout.{' '}
            <span className="font-semibold text-stone-800">Stock Status</span> (Normal / Low Stock / Out of Stock) dynamically reflects on-hand inventory levels.
          </div>
          <div className="hidden sm:block text-[11px] text-stone-500">
            Historical transaction snapshots remain immutable when current product prices are updated. Non-destructive deactivation protects audit trails.
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-2.5 sm:p-4 shadow-2xs space-y-2 sm:space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
          {/* Search by Product Name or SKU */}
          <div className="relative w-full md:flex-1 md:max-w-md">
            <Search className="w-4 h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              id="product-search-input"
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-stone-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap md:items-center gap-1.5 sm:gap-2 text-xs w-full md:w-auto">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100/80 px-2 sm:px-2.5 py-1.5 rounded-lg border border-stone-200 min-w-0 transition-colors">
              <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="text-stone-500 font-medium shrink-0">Category:</span>
              <select
                id="product-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 focus:outline-hidden w-full cursor-pointer truncate"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Status Filter: ALL, ACTIVE, INACTIVE */}
            <div className="flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100/80 px-2 sm:px-2.5 py-1.5 rounded-lg border border-stone-200 min-w-0 transition-colors">
              <span className="text-stone-500 font-medium shrink-0">
                <span className="hidden sm:inline">Product </span>Status:
              </span>
              <select
                id="product-status-filter"
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-stone-800 focus:outline-hidden w-full cursor-pointer truncate"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {/* Stock Status Filter: ALL, NORMAL, LOW_STOCK, OUT_OF_STOCK */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100/80 px-2 sm:px-2.5 py-1.5 rounded-lg border border-stone-200 min-w-0 transition-colors">
              <span className="text-stone-500 font-medium shrink-0">
                <span className="hidden sm:inline">Stock </span>Status:
              </span>
              <select
                id="stock-status-filter"
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-stone-800 focus:outline-hidden w-full cursor-pointer truncate"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="NORMAL">Normal Stock (≥ Min)</option>
                <option value="LOW_STOCK">Low Stock (&lt; Min)</option>
                <option value="OUT_OF_STOCK">Out of Stock (≤ 0)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar if filtered */}
        {(searchQuery || selectedCategory !== 'ALL' || productStatusFilter !== 'ALL' || stockStatusFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 pt-1.5 sm:pt-2 border-t border-stone-100 text-[11px] sm:text-xs text-stone-500">
            <span>Showing {filteredProducts.length} of {products.length} products</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setProductStatusFilter('ALL');
                setStockStatusFilter('ALL');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {products.length === 0 ? (
          <div className="py-16 px-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100 shadow-2xs">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-900 mb-1">
              Katalog Anda Masih Kosong
            </h3>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed">
              Semua item demo telah dibersihkan sepenuhnya. Anda kini sedia untuk mendaftarkan inventori dan produk sebenar kedai anda dari awal (zero baseline).
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                id="empty-state-add-first-product-btn"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk Pertama</span>
              </button>
              <button
                type="button"
                id="empty-state-import-csv-btn"
                onClick={handleImportCsvClick}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>Import CSV Produk</span>
              </button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Package}
              title="No products match your filters"
              description="Try adjusting your search query, status filters, or create a new product item."
              actionLabel="Add New Product"
              onAction={openAddModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-5 py-3.5">Product & SKU</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Cost Price</th>
                  <th className="px-4 py-3.5 text-right">Selling Price</th>
                  <th className="px-4 py-3.5 text-right">Unit Margin</th>
                  <th className="px-4 py-3.5 text-center">Stock / Min</th>
                  <th className="px-4 py-3.5 text-center">Stock Status</th>
                  <th className="px-4 py-3.5 text-center">Product Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((p) => {
                  const unitProfit = p.sellingPrice - p.costPrice;
                  const unitMarginPct =
                    p.sellingPrice > 0
                      ? ((unitProfit / p.sellingPrice) * 100).toFixed(1)
                      : '0.0';
                  const stockStatus = getProductStockStatus(p);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        !p.active ? 'bg-stone-50/40 text-stone-500' : ''
                      }`}
                    >
                      {/* Product & SKU */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-contain p-0.5 bg-white border border-stone-200 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-400 flex items-center justify-center shrink-0 border border-stone-200">
                              <Package className="w-5 h-5 text-stone-400" />
                            </div>
                          )}
                          <div>
                            <div className={`font-semibold ${p.active ? 'text-stone-900' : 'text-stone-500'}`}>
                              {p.name}
                            </div>
                            <div className="text-xs font-mono text-stone-400 mt-0.5 flex items-center gap-2">
                              <span>{p.sku}</span>
                              {p.sku === 'TEST-001' && (
                                <span className="text-[10px] px-1 rounded bg-stone-200 text-stone-700 font-sans">
                                  Audit Control
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4 text-xs text-stone-600">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                          {p.category}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="px-4 py-4 text-right font-mono text-stone-600 text-xs">
                        {store.currency} {p.costPrice.toFixed(2)}
                      </td>

                      {/* Selling Price */}
                      <td className="px-4 py-4 text-right font-mono font-semibold text-stone-900">
                        {store.currency} {p.sellingPrice.toFixed(2)}
                      </td>

                      {/* Unit Profit */}
                      <td className="px-4 py-4 text-right">
                        {unitProfit > 0 ? (
                          <>
                            <div className="text-xs font-mono font-bold text-emerald-700">
                              +{store.currency} {unitProfit.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {unitMarginPct}% margin
                            </div>
                          </>
                        ) : unitProfit === 0 ? (
                          <>
                            <div className="text-xs font-mono font-medium text-stone-500">
                              {store.currency} 0.00
                            </div>
                            <div className="text-[10px] text-stone-400">
                              Break-even
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-mono font-bold text-rose-700">
                              -{store.currency} {Math.abs(unitProfit).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-rose-500">
                              Loss ({unitMarginPct}%)
                            </div>
                          </>
                        )}
                      </td>

                      {/* Stock / Min */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-mono text-xs font-semibold text-stone-800">
                          <span className="text-sm font-bold text-stone-900">{p.currentStock}</span>
                          <span className="text-stone-400 ml-1">/ {p.minimumStock} min</span>
                        </div>
                      </td>

                      {/* Stock Status (NORMAL, LOW_STOCK, OUT_OF_STOCK) */}
                      <td className="px-4 py-4 text-center">
                        {stockStatus === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>NORMAL</span>
                          </span>
                        )}
                        {stockStatus === 'LOW_STOCK' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>LOW STOCK</span>
                          </span>
                        )}
                        {stockStatus === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>OUT OF STOCK</span>
                          </span>
                        )}
                      </td>

                      {/* Product Status (ACTIVE, INACTIVE) */}
                      <td className="px-4 py-4 text-center">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-200 text-stone-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {(() => {
                          const eligibility = checkProductDeleteEligibility(p.id);
                          return (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedProductForHistory(p)}
                                title="Lihat sejarah pembelian dan kos"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                              >
                                <History className="w-3 h-3" />
                                <span>Sejarah</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditClick(p)}
                                title="Kemaskini maklumat produk (PIN Admin diperlukan)"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-md transition"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {eligibility.hasHistoricalReferences ? (
                                p.active ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(p)}
                                    title="Nyahaktifkan Produk (Mempunyai rekod sejarah)"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-md transition"
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>Nyahaktif</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActiveClick(p)}
                                    title="Aktifkan semula produk untuk jualan POS"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>Aktifkan</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(p)}
                                  title={
                                    p.currentStock > 0
                                      ? 'Padam Produk Bersama Stok Semasa'
                                      : 'Padam Produk Secara Kekal'
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-md transition"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Padam</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD PRODUCT MODAL */}
      <Modal
        id="add-product-modal"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Retail Product"
        subtitle={`Assigns new unique SKU to store ${store.name}`}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                SKU / Barcode <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. NP-BISKUT-01"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-400 mt-0.5 block">
                Must be unique within {store.name}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Snacks & Biscuits"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cream-O Biscuits Pink & Ungu"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Cost Price ({store.currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Selling Price ({store.currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(e) =>
                  setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Dynamic Profit / Loss Calculation preview (Section 4) */}
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
            <span className="text-stone-600">Projected Unit Margin:</span>
            <div className="font-mono text-right">
              {previewProfit > 0 ? (
                <span className="font-bold text-emerald-700">
                  +{store.currency} {previewProfit.toFixed(2)} ({previewMargin}%)
                </span>
              ) : previewProfit === 0 ? (
                <span className="font-medium text-stone-600">
                  {store.currency} 0.00 (Break-even)
                </span>
              ) : (
                <span className="font-bold text-rose-600">
                  -{store.currency} {Math.abs(previewProfit).toFixed(2)} (Loss {previewMargin}%)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Opening Stock Units <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.currentStock}
                onChange={(e) =>
                  setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Automatically logs initial traceable STOCK_IN movement.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Minimum Stock Alert Level <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.minimumStock}
                onChange={(e) =>
                  setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Triggers Low Stock warning when stock &lt; minimum.
              </span>
            </div>
          </div>

          {/* Optional Image URL (Section 20) */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <span className="text-[11px] text-stone-400 mt-0.5 block">
              Leave blank if no image available. Products and POS remain 100% functional without an image.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="new-product-active-checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label
              htmlFor="new-product-active-checkbox"
              className="text-xs font-medium text-stone-800 cursor-pointer"
            >
              Active for Sale (Inactive items are blocked from POS selection)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition cursor-pointer"
            >
              Register Product
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        id="edit-product-modal"
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Edit Product Details"
        subtitle={`Updating SKU: ${editingProduct?.sku}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                SKU Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-400 mt-0.5 block">
                Validated for uniqueness across active and inactive products
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Cost Price ({store.currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-400 mt-0.5 block">
                Modifying cost will not alter past sales snapshots
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Selling Price ({store.currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(e) =>
                  setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Minimum Stock Alert Level <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              value={formData.minimumStock}
              onChange={(e) =>
                setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Current Stock Notice (Section 6 & 10) */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 space-y-1">
            <div className="font-semibold text-stone-900">
              Current Stock: {editingProduct?.currentStock} units
            </div>
            <p className="text-[11px] text-stone-500">
              To preserve mathematical traceability, current stock cannot be arbitrarily overwritten here. Use the <strong>Inventory</strong> tab to record a Stock In or Stock Adjustment with an explicit reason.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="edit-product-active-checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label
              htmlFor="edit-product-active-checkbox"
              className="text-xs font-medium text-stone-800 cursor-pointer"
            >
              Active for Sale (Uncheck to block this item from POS checkout)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="px-4 py-2 text-xs font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE / DEACTIVATE MODAL (Scenarios A, B, C) */}
      {deletingProduct && deletingEligibility && (
        <Modal
          id="delete-product-modal"
          isOpen={!!deletingProduct}
          onClose={() => {
            setDeletingProduct(null);
            setDeletingEligibility(null);
          }}
          title={
            deletingEligibility.hasHistoricalReferences
              ? 'Nyahaktifkan Produk'
              : deletingProduct.currentStock > 0
              ? 'Padam Produk Bersama Stok Semasa'
              : 'Padam Produk Secara Kekal'
          }
          subtitle={`Pengesahan Tindakan: ${deletingProduct.name} (${deletingProduct.sku})`}
        >
          <div className="space-y-4 text-sm text-stone-600">
            {deletingEligibility.hasHistoricalReferences ? (
              // Scenario B: Has historical references
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-amber-950 font-semibold">Integriti Rekod Sejarah Dipelihara</strong>
                    <p>
                      Produk ini mempunyai rekod sejarah jualan, pembelian atau inventori dan tidak boleh dipadam.
                    </p>
                    <p className="text-amber-800">
                      Demi memelihara ketepatan lejar perakaunan, COGS, dan laporan sejarah, produk ini hanya boleh dinyahaktifkan.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 space-y-1.5">
                  <p className="font-semibold text-stone-900">Nyahaktifkan produk ini?</p>
                  <ul className="list-disc list-inside space-y-1 text-stone-600">
                    <li>Rekod jualan, pembelian dan inventori lama akan dikekalkan.</li>
                    <li>Produk tidak akan lagi muncul dalam katalog jualan.</li>
                    <li>Kod SKU (<code>{deletingProduct.sku}</code>) akan kekal dikhaskan untuk integriti data.</li>
                  </ul>
                </div>
              </div>
            ) : deletingProduct.currentStock > 0 ? (
              // Scenario C: No history but stock > 0
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-amber-950 font-semibold">Amaran Baki Stok Semasa</strong>
                    <p>
                      Produk ini mempunyai baki stok semasa sebanyak <strong>{deletingProduct.currentStock} unit</strong> tetapi tiada rekod sejarah jualan atau pembelian.
                    </p>
                    <p className="text-amber-800">
                      Padam produk ini bersama stok semasa secara kekal? Tindakan ini tidak boleh dibatalkan.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-stone-500">
                  Kod SKU (<code>{deletingProduct.sku}</code>) akan dilepaskan dan boleh digunakan semula jika diperlukan.
                </p>
              </div>
            ) : (
              // Scenario A: No history and 0 stock
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                  <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-rose-950 font-semibold">Padam Kekal (Tiada Sejarah)</strong>
                    <p>
                      Padam produk ini secara kekal? Produk ini tiada rekod sejarah.
                    </p>
                    <p className="text-rose-700 font-medium">
                      Tindakan ini tidak boleh dibatalkan.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-stone-500">
                  Produk akan dipadamkan sepenuhnya dari sistem dan kod SKU (<code>{deletingProduct.sku}</code>) akan dilepaskan untuk kegunaan semula.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setDeletingProduct(null);
                  setDeletingEligibility(null);
                }}
                className="px-4 py-2 text-xs font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition"
              >
                Batal
              </button>
              {deletingEligibility.hasHistoricalReferences ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition cursor-pointer"
                >
                  Nyahaktifkan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition cursor-pointer"
                >
                  {deletingProduct.currentStock > 0 ? 'Padam Kekal Bersama Stok' : 'Padam Kekal'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Product Purchase & Cost History Modal */}
      {selectedProductForHistory && (
        <Modal
          isOpen={!!selectedProductForHistory}
          onClose={() => setSelectedProductForHistory(null)}
          title={`Purchase & Cost History: ${selectedProductForHistory.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-stone-400 font-medium block uppercase text-[10px]">Product & SKU</span>
                <span className="font-bold text-stone-900 text-sm">{selectedProductForHistory.name}</span>
                <span className="text-stone-500 font-mono ml-2">({selectedProductForHistory.sku})</span>
              </div>
              <div className="text-right">
                <span className="text-stone-400 font-medium block uppercase text-[10px]">Current Cost Price</span>
                <span className="font-mono font-bold text-stone-900 text-sm">
                  {formatCurrency(selectedProductForHistory.costPrice, store.currency)}
                </span>
              </div>
            </div>

            {(() => {
              const history = PurchasingService.getProductPurchaseHistory(
                selectedProductForHistory.id,
                purchases
              );

              if (history.length === 0) {
                return (
                  <div className="py-8 text-center bg-stone-50 rounded-lg border border-stone-200 text-stone-500">
                    No completed purchases recorded for this product yet.
                  </div>
                );
              }

              return (
                <div className="rounded-lg border border-stone-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Supplier</th>
                        <th className="py-2 px-3">PO #</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {history.map((record, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/70">
                          <td className="py-2 px-3 text-stone-600">
                            {formatDateTime(record.purchaseDate)}
                          </td>
                          <td className="py-2 px-3 font-medium text-stone-800">
                            {record.supplierNameSnapshot}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-stone-800">
                            {record.purchaseNumber}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-stone-800">
                            {record.quantity}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-800">
                            {formatCurrency(record.unitCost, store.currency)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-stone-900">
                            {formatCurrency(record.lineTotal, store.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <p className="text-[11px] text-stone-500 italic">
              "How much have I been paying for this product?" — shows completed procurement records and received unit costs over time.
            </p>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedProductForHistory(null)}
                className="px-4 py-2 text-xs font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CSV Import Modal (SES 4.4 Locked Part D) */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onCommit={handleCommitCsvImport}
        onCommitUpsertImport={handleCommitCsvUpsert}
        existingProducts={products}
      />

      {/* Duplicate Audit Modal (SES 4.4 Locked Part E) */}
      <DuplicateAuditModal
        isOpen={isDuplicateAuditOpen}
        onClose={() => setIsDuplicateAuditOpen(false)}
        auditGroups={duplicateAuditGroups}
        entityType="Produk"
      />

      {/* Modal Sahkan Kosongkan Katalog (Mula Dari Kosong - Semua atau Kategori Pilihan) */}
      <Modal
        isOpen={isClearCatalogModalOpen}
        onClose={() => !isClearingCatalog && setIsClearCatalogModalOpen(false)}
        title="Pilihan Mula Dari Kosong (Reset Data)"
        subtitle="Pilih sama ada ingin mengosongkan semua kategori serentak atau hanya kategori tertentu (Product, Supplier, Customer, Staff)"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Pilihan Mod: Semua Kategori atau Kategori Pilihan */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
            <button
              type="button"
              id="clear-mode-all-tab"
              onClick={() => {
                setClearMode('ALL');
                setSelectedClearCategories({
                  products: true,
                  suppliers: true,
                  customers: true,
                  staff: true,
                });
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                clearMode === 'ALL'
                  ? 'bg-white text-rose-700 shadow-2xs border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua Kategori (Penuh)</span>
            </button>

            <button
              type="button"
              id="clear-mode-custom-tab"
              onClick={() => setClearMode('CUSTOM')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                clearMode === 'CUSTOM'
                  ? 'bg-white text-rose-700 shadow-2xs border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Kategori Pilihan (Kustom)</span>
            </button>
          </div>

          {/* Penerangan Mod */}
          {clearMode === 'ALL' ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Mod Penuh: Pembersihan Menyeluruh Semua Kategori</p>
                <p className="text-rose-800 leading-relaxed">
                  Semua rekod Product, Supplier, Customer, dan Staff beserta pergerakan stok, transaksi jualan, pesanan belian, dan lejar mata ganjaran akan dipadamkan serentak untuk membolehkan kedai bermula dari sifar (0).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Tandakan kategori yang ingin dimulakan dari kosong:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedClearCategories({
                          products: true,
                          suppliers: true,
                          customers: true,
                          staff: true,
                        })
                      }
                      className="text-2xs font-bold text-amber-800 hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedClearCategories({
                          products: false,
                          suppliers: false,
                          customers: false,
                          staff: false,
                        })
                      }
                      className="text-2xs font-bold text-amber-800 hover:underline cursor-pointer"
                    >
                      Nyahpilih
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Senarai Kad Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Product */}
            <div
              id="clear-cat-product-card"
              onClick={() => {
                if (clearMode === 'CUSTOM') {
                  setSelectedClearCategories((prev) => ({ ...prev, products: !prev.products }));
                }
              }}
              className={`p-3 rounded-xl border transition-all ${
                clearMode === 'ALL' || selectedClearCategories.products
                  ? 'border-rose-300 bg-rose-50/50 text-stone-900'
                  : 'border-stone-200 bg-stone-50/60 text-stone-500 opacity-60'
              } ${clearMode === 'CUSTOM' ? 'cursor-pointer hover:border-rose-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${clearMode === 'ALL' || selectedClearCategories.products ? 'bg-rose-100 text-rose-700' : 'bg-stone-200 text-stone-500'}`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Product (Produk)</h4>
                    <span className="text-2xs text-stone-500">Katalog &amp; Inventori</span>
                  </div>
                </div>
                {clearMode === 'CUSTOM' ? (
                  selectedClearCategories.products ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )
                ) : (
                  <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-800">Semua</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-2xs text-stone-600">
                <span>{products.length} produk &bull; {movements.length} log stok</span>
                <span className="font-mono font-semibold text-rose-700">{products.length} item</span>
              </div>
            </div>

            {/* 2. Supplier */}
            <div
              id="clear-cat-supplier-card"
              onClick={() => {
                if (clearMode === 'CUSTOM') {
                  setSelectedClearCategories((prev) => ({ ...prev, suppliers: !prev.suppliers }));
                }
              }}
              className={`p-3 rounded-xl border transition-all ${
                clearMode === 'ALL' || selectedClearCategories.suppliers
                  ? 'border-rose-300 bg-rose-50/50 text-stone-900'
                  : 'border-stone-200 bg-stone-50/60 text-stone-500 opacity-60'
              } ${clearMode === 'CUSTOM' ? 'cursor-pointer hover:border-rose-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${clearMode === 'ALL' || selectedClearCategories.suppliers ? 'bg-rose-100 text-rose-700' : 'bg-stone-200 text-stone-500'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Supplier (Pembekal)</h4>
                    <span className="text-2xs text-stone-500">Profil &amp; Belian Stok</span>
                  </div>
                </div>
                {clearMode === 'CUSTOM' ? (
                  selectedClearCategories.suppliers ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )
                ) : (
                  <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-800">Semua</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-2xs text-stone-600">
                <span>{suppliers.length} pembekal &bull; {purchases.length} pesanan belian</span>
                <span className="font-mono font-semibold text-rose-700">{suppliers.length} pembekal</span>
              </div>
            </div>

            {/* 3. Customer */}
            <div
              id="clear-cat-customer-card"
              onClick={() => {
                if (clearMode === 'CUSTOM') {
                  setSelectedClearCategories((prev) => ({ ...prev, customers: !prev.customers }));
                }
              }}
              className={`p-3 rounded-xl border transition-all ${
                clearMode === 'ALL' || selectedClearCategories.customers
                  ? 'border-rose-300 bg-rose-50/50 text-stone-900'
                  : 'border-stone-200 bg-stone-50/60 text-stone-500 opacity-60'
              } ${clearMode === 'CUSTOM' ? 'cursor-pointer hover:border-rose-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${clearMode === 'ALL' || selectedClearCategories.customers ? 'bg-rose-100 text-rose-700' : 'bg-stone-200 text-stone-500'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Customer (Pelanggan)</h4>
                    <span className="text-2xs text-stone-500">Ahli &amp; Mata Ganjaran</span>
                  </div>
                </div>
                {clearMode === 'CUSTOM' ? (
                  selectedClearCategories.customers ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )
                ) : (
                  <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-800">Semua</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-2xs text-stone-600">
                <span>{customers.length} pelanggan &bull; {loyaltyLedger.length} log mata</span>
                <span className="font-mono font-semibold text-rose-700">{customers.length} pelanggan</span>
              </div>
            </div>

            {/* 4. Staff */}
            <div
              id="clear-cat-staff-card"
              onClick={() => {
                if (clearMode === 'CUSTOM') {
                  setSelectedClearCategories((prev) => ({ ...prev, staff: !prev.staff }));
                }
              }}
              className={`p-3 rounded-xl border transition-all ${
                clearMode === 'ALL' || selectedClearCategories.staff
                  ? 'border-rose-300 bg-rose-50/50 text-stone-900'
                  : 'border-stone-200 bg-stone-50/60 text-stone-500 opacity-60'
              } ${clearMode === 'CUSTOM' ? 'cursor-pointer hover:border-rose-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${clearMode === 'ALL' || selectedClearCategories.staff ? 'bg-rose-100 text-rose-700' : 'bg-stone-200 text-stone-500'}`}>
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Staff (Pekerja)</h4>
                    <span className="text-2xs text-stone-500">Direktori &amp; Akaun Staf</span>
                  </div>
                </div>
                {clearMode === 'CUSTOM' ? (
                  selectedClearCategories.staff ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )
                ) : (
                  <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-800">Semua</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-2xs text-stone-600">
                <span>{staffUsers.length} akaun staf (direset ke Pemilik)</span>
                <span className="font-mono font-semibold text-rose-700">{staffUsers.length} staf</span>
              </div>
            </div>
          </div>

          {/* Ringkasan Kesan Pembersihan */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-700">Status Tindakan:</span>
              <span className="font-bold text-rose-700 font-mono">
                {clearMode === 'ALL'
                  ? '4 Kategori Dipilih (Pembersihan Menyeluruh)'
                  : `${
                      (selectedClearCategories.products ? 1 : 0) +
                      (selectedClearCategories.suppliers ? 1 : 0) +
                      (selectedClearCategories.customers ? 1 : 0) +
                      (selectedClearCategories.staff ? 1 : 0)
                    } Kategori Dipilih`}
              </span>
            </div>
            <p className="text-2xs text-stone-500 leading-relaxed">
              Data yang dikosongkan akan dipadamkan daripada storan setempat dan diselaraskan secara langsung di pangkalan data awan Firebase Firestore.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              disabled={isClearingCatalog}
              onClick={() => setIsClearCatalogModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              id="confirm-purge-catalog-btn"
              disabled={
                isClearingCatalog ||
                (clearMode === 'CUSTOM' &&
                  !selectedClearCategories.products &&
                  !selectedClearCategories.suppliers &&
                  !selectedClearCategories.customers &&
                  !selectedClearCategories.staff)
              }
              onClick={handleConfirmClearCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingCatalog ? (
                <span>Sedang Memadamkan Dari Awan...</span>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {clearMode === 'ALL'
                      ? 'Sahkan & Padam Semua (Bermula Kosong)'
                      : 'Sahkan & Padam Kategori Terpilih'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
