import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Receipt,
  AlertCircle,
  Tag,
  ShoppingBag,
  History,
  Coins,
  UtensilsCrossed,
  Settings,
  Percent,
  Clock,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  MenuItem,
  RestaurantOrderItem,
  RestaurantOrderType,
  SelectedModifierSnapshot,
  SelectedVariantSnapshot,
  DiscountType,
} from '../../types/restaurant';
import { RestaurantOrderTypeSelector } from './RestaurantOrderTypeSelector';
import { MenuItemModifierModal } from './MenuItemModifierModal';
import { ItemDiscountModal } from './ItemDiscountModal';
import { MenuManagementModal } from '../menu/MenuManagementModal';
import { TableGridView } from '../tables/TableGridView';
import { TableDetailModal } from '../tables/TableDetailModal';
import { ReservationModal } from '../tables/ReservationModal';
import { TableDefinitionModal } from '../tables/TableDefinitionModal';
import { formatCurrency } from '../../services/formatters';
import { AdminAuthService } from '../../services/adminAuthService';
import { pushRoute } from '../../services/urlRouter';
import { KotService } from '../../services/kotService';
import { LayoutGrid, Layers, PlusCircle, ChefHat, ShieldAlert, Download, UploadCloud } from 'lucide-react';
import { DuplicateAuditModal } from '../common/DuplicateAuditModal';
import { DuplicateAuditService, DuplicateGroup } from '../../services/duplicateAuditService';
import { RestaurantCsvService } from '../../services/restaurantCsvService';
import { RestaurantCsvImportModal } from '../menu/RestaurantCsvImportModal';

export const RestaurantPosView: React.FC = () => {
  const {
    store,
    menuItems,
    menuCategories,
    taxConfig,
    toggleMenuItemAvailability,
    saveMenuItem,
    deleteMenuItem,
    activeStaff,
    tables,
    reservations,
    tableAuditLogs,
    updateTableStatus,
    bindActiveOrderToTable,
    saveTableDefinition,
    deleteTableDefinition,
    addTableReservation,
    refreshTablesData,
    refreshMenuData,
    businessConfig,
  } = useStore();

  // Search & Category Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Restaurant View Tab: 'MENU' | 'TABLES' (SES v4.5 Default Table Grid or Fast Menu)
  const [activeRestaurantTab, setActiveRestaurantTab] = useState<'TABLES' | 'MENU'>(() => {
    return businessConfig?.tableMode === 'DISABLED' ? 'MENU' : 'TABLES';
  });

  // Duplicate Audit & CSV Import states (SES v4.5)
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);
  const [auditGroups, setAuditGroups] = useState<DuplicateGroup<any>[]>([]);
  const [auditTitle, setAuditTitle] = useState<string>('Rekod');
  const [auditType, setAuditType] = useState<'TABLE' | 'MENU_ITEM'>('TABLE');
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  // Restaurant Order Header State
  const [orderType, setOrderType] = useState<RestaurantOrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState<string>(() => {
    return tables.length > 0 ? tables[0].tableNumber : 'T01';
  });
  const [guestCount, setGuestCount] = useState<number>(2);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Cart / Active Order Items
  const [orderItems, setOrderItems] = useState<RestaurantOrderItem[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [kitchenNotes, setKitchenNotes] = useState<string>('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<any | null>(null);

  // Table Management Modals State
  const [selectedTableForDetail, setSelectedTableForDetail] = useState<any | null>(null);
  const [tableForReservation, setTableForReservation] = useState<any | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);

  // Modals
  const [selectedMenuItemForModal, setSelectedMenuItemForModal] = useState<MenuItem | null>(null);
  const [discountingItem, setDiscountingItem] = useState<RestaurantOrderItem | null>(null);
  const [isMenuManagementOpen, setIsMenuManagementOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeWorkspaceSlug = AdminAuthService.detectActiveWorkspaceSlug() || undefined;

  // Filter Menu Items by Category & Search
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.active) return false;
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Handle click on Menu Card
  const handleItemCardClick = (item: MenuItem) => {
    if (!item.isAvailable) {
      setErrorMessage(`Hidangan "${item.name}" kini kehabisan stok (Sold out). Boleh ditukar dalam Pengurusan Menu.`);
      return;
    }
    setErrorMessage(null);
    // Buka modal pilihan modifier/variasi
    setSelectedMenuItemForModal(item);
  };

  // Add Item to Order with Selected Modifiers & Instructions & Variant
  const handleConfirmAddItem = (
    item: MenuItem,
    quantity: number,
    selectedModifiers: SelectedModifierSnapshot[],
    specialInstructions: string,
    selectedVariant?: SelectedVariantSnapshot
  ) => {
    const basePrice = selectedVariant ? selectedVariant.price : item.price;
    const modifiersTotal = selectedModifiers.reduce((acc, mod) => acc + mod.price, 0);
    const unitTotal = basePrice + modifiersTotal;
    const initialLineTotal = unitTotal * quantity;
    const displayName = selectedVariant ? `${item.name} (${selectedVariant.name})` : item.name;

    // Setiap item baharu tidak mewarisi diskaun item terdahulu (SES v4.5)
    const newOrderItem: RestaurantOrderItem = {
      id: `order-line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: item.id,
      nameSnapshot: displayName,
      categorySnapshot: item.category,
      kitchenStation: item.kitchenStation,
      basePriceSnapshot: basePrice,
      selectedVariant,
      selectedModifiers,
      unitTotal,
      quantity,
      discountType: 'NONE',
      discountValue: 0,
      discountAmount: 0,
      lineTotal: initialLineTotal,
      specialInstructions: specialInstructions || undefined,
    };

    setOrderItems((prev) => [...prev, newOrderItem]);
  };

  // Update item quantity safely & recalculate discount for multiple qty
  const handleUpdateItemQuantity = (lineId: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== lineId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;

          const gross = item.unitTotal * newQty;
          let newDiscountAmount = 0;

          if (item.discountType === 'PERCENTAGE') {
            newDiscountAmount = (gross * item.discountValue) / 100;
          } else if (item.discountType === 'FIXED') {
            // Diskaun tetap terhad kepada nilai baru
            newDiscountAmount = Math.min(item.discountValue, gross);
          }

          newDiscountAmount = Math.min(newDiscountAmount, gross);
          newDiscountAmount = Math.max(0, newDiscountAmount);

          return {
            ...item,
            quantity: newQty,
            discountAmount: newDiscountAmount,
            lineTotal: Math.max(0, gross - newDiscountAmount),
          };
        })
        .filter(Boolean) as RestaurantOrderItem[]
    );
  };

  // Direct remove from order
  const handleRemoveItem = (lineId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.id !== lineId));
  };

  // Apply Discount per Item (SES v4.5 Rules: <=10% Cashier, >10% Owner PIN)
  const handleApplyItemDiscount = (
    itemId: string,
    discountType: DiscountType,
    discountValue: number,
    discountAmount: number,
    approvedBy: 'CASHIER' | 'OWNER'
  ) => {
    setOrderItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const gross = it.unitTotal * it.quantity;
        const boundedDiscount = Math.min(discountAmount, gross);
        const newLineTotal = Math.max(0, gross - boundedDiscount);

        return {
          ...it,
          discountType,
          discountValue,
          discountAmount: boundedDiscount,
          discountApprovedBy: approvedBy,
          isLockedAfterApproval: approvedBy === 'OWNER', // Dikunci jika diluluskan oleh Owner
          lineTotal: newLineTotal,
        };
      })
    );
  };

  const handleRemoveItemDiscount = (itemId: string) => {
    setOrderItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const gross = it.unitTotal * it.quantity;
        return {
          ...it,
          discountType: 'NONE',
          discountValue: 0,
          discountAmount: 0,
          discountApprovedBy: undefined,
          isLockedAfterApproval: false,
          lineTotal: gross,
        };
      })
    );
  };

  // Subtotals & Taxes Calculation (Config-driven, no hardcoding)
  const grossSubtotal = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.unitTotal * it.quantity, 0);
  }, [orderItems]);

  const totalItemDiscounts = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.discountAmount, 0);
  }, [orderItems]);

  const netFoodSubtotal = Math.max(0, grossSubtotal - totalItemDiscounts);

  // Service Charge
  const serviceChargeAmount = useMemo(() => {
    if (!taxConfig.serviceChargeEnabled || taxConfig.serviceChargePercent <= 0) return 0;
    return (netFoodSubtotal * taxConfig.serviceChargePercent) / 100;
  }, [netFoodSubtotal, taxConfig]);

  // Tax (SST / Cukai Jualan berdasarkan konfigurasi)
  const taxAmount = useMemo(() => {
    if (!taxConfig.taxEnabled || taxConfig.taxRatePercent <= 0) return 0;
    if (taxConfig.isTaxInclusive) {
      // Inclusive: Nilai cukai terkandung dalam harga
      return netFoodSubtotal - netFoodSubtotal / (1 + taxConfig.taxRatePercent / 100);
    } else {
      // Exclusive: Tambahan ke atas bil
      return (netFoodSubtotal * taxConfig.taxRatePercent) / 100;
    }
  }, [netFoodSubtotal, taxConfig]);

  const grandTotal = useMemo(() => {
    let total = netFoodSubtotal + serviceChargeAmount;
    if (taxConfig.taxEnabled && !taxConfig.isTaxInclusive) {
      total += taxAmount;
    }
    return Math.max(0, total);
  }, [netFoodSubtotal, serviceChargeAmount, taxAmount, taxConfig]);

  const cashTendered = parseFloat(cashReceivedInput) || grandTotal;
  const changeDue = Math.max(0, cashTendered - grandTotal);

  // Clear Cart
  const handleClearOrder = () => {
    if (orderItems.length === 0) return;
    if (confirm('Kosongkan semua item dalam pesanan semasa?')) {
      setOrderItems([]);
      setCashReceivedInput('');
      setKitchenNotes('');
      setErrorMessage(null);
    }
  };

  // Simpan / Sahkan Pesanan Dine-In (Mengunci Status OCCUPIED pada Meja & Hantar KOT ke KDS)
  const handleConfirmDineInOrder = async () => {
    if (orderItems.length === 0) {
      setErrorMessage('Sila pilih sekurang-kurangnya satu hidangan untuk pesanan Dine-In.');
      return;
    }

    const existingTable = tables.find((t) => t.tableNumber === tableNumber);
    const orderId = editingOrderId || existingTable?.activeOrder?.orderId || `ORD-${Date.now().toString().slice(-6)}`;
    const isModifyingExistingOrder = Boolean(editingOrderId || existingTable?.activeOrder?.orderId);

    const summary = {
      orderId,
      orderType: 'DINE_IN' as RestaurantOrderType,
      tableNumber,
      pax: guestCount,
      itemsCount: orderItems.reduce((acc, item) => acc + item.quantity, 0),
      grossAmount: grossSubtotal,
      discountAmount: totalItemDiscounts,
      netAmount: grandTotal,
      openedAt: existingTable?.activeOrder?.openedAt || new Date().toISOString(),
      items: orderItems,
    };

    // Panggil bindActiveOrderToTable: Meja sah bertukar ke OCCUPIED dengan rekod audit
    bindActiveOrderToTable(tableNumber, summary);

    // KOT Synchronization ke Kitchen Display System (SES v4.5)
    const currentSlug = activeWorkspaceSlug || 'default';
    const cashierName = activeStaff ? activeStaff.name : 'Cashier';

    try {
      if (isModifyingExistingOrder) {
        // Sync modified order to KDS with item change markers (ADDED, UPDATED, REMOVED)
        await KotService.syncOrderUpdateToKitchenTicket(
          orderId,
          orderItems,
          kitchenNotes,
          cashierName,
          currentSlug
        );
        KotService.playNewKotChime();
      } else {
        // Create new KOT
        const { isNew } = await KotService.createOrGetKitchenTicket(
          {
            orderId,
            tableId: tableNumber,
            tableName: `Meja ${tableNumber}`,
            orderType: 'DINE_IN',
            items: orderItems,
            guestCount,
            notes: kitchenNotes,
            operator: cashierName,
          },
          currentSlug
        );
        if (isNew) {
          KotService.playNewKotChime();
        }
      }
    } catch (kotErr) {
      console.error('[RestaurantPosView] KOT sync error:', kotErr);
    }

    // Buka tab grid meja semula atau maklumkan pesanan disimpan
    setErrorMessage(null);
    alert(`Pesanan Meja ${tableNumber} (${guestCount} Pax) berjaya disahkan & dihantar ke Dapur! Meja kini OCCUPIED.`);
    setOrderItems([]);
    setEditingOrderId(null);
    setCashReceivedInput('');
    setKitchenNotes('');
    setActiveRestaurantTab('TABLES');
  };

  // Selesaikan Pesanan Restoran & Bayaran (Status Meja bertukar ke CLEANING atau AVAILABLE)
  const handleCompleteOrder = () => {
    if (orderItems.length === 0) {
      setErrorMessage('Sila pilih sekurang-kurangnya satu hidangan.');
      return;
    }

    if (cashTendered < grandTotal) {
      setErrorMessage(
        `Tunai diterima (${formatCurrency(cashTendered)}) kurang daripada jumlah bil (${formatCurrency(grandTotal)}).`
      );
      return;
    }

    const orderRecord = {
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      orderType,
      tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
      guestCount: orderType === 'DINE_IN' ? guestCount : undefined,
      customerName: customerName || (orderType === 'DINE_IN' ? `Meja ${tableNumber}` : 'Pelanggan Walk-in'),
      items: orderItems,
      grossSubtotal,
      totalDiscounts: totalItemDiscounts,
      serviceChargeAmount,
      taxAmount,
      grandTotal,
      cashTendered,
      changeDue,
      timestamp: new Date().toISOString(),
      cashierName: activeStaff ? activeStaff.name : 'Store Owner',
    };

    // Jika Dine-In, kemas kini meja kepada status CLEANING (Perlu dibersihkan)
    if (orderType === 'DINE_IN') {
      const targetTable = tables.find((t) => t.tableNumber === tableNumber);
      if (targetTable) {
        updateTableStatus(
          targetTable.id,
          'CLEANING',
          `Bayaran bil ${orderRecord.orderId} selesai, meja perlu dibersihkan`
        );
      }
    }

    // KOT Synchronization for completed order / Takeaway / Delivery (SES v4.5)
    const currentSlug = activeWorkspaceSlug || 'default';
    KotService.createOrGetKitchenTicket(
      {
        orderId: orderRecord.orderId,
        tableId: orderType === 'DINE_IN' ? tableNumber : undefined,
        tableName: orderType === 'DINE_IN' ? `Meja ${tableNumber}` : undefined,
        orderType,
        items: orderItems,
        customerName: orderRecord.customerName,
        guestCount: orderType === 'DINE_IN' ? guestCount : undefined,
        notes: kitchenNotes,
        operator: orderRecord.cashierName,
      },
      currentSlug
    ).then(({ isNew }) => {
      if (isNew) {
        KotService.playNewKotChime();
      }
    }).catch(console.error);

    setLastCompletedOrder(orderRecord);
    setIsSuccessModalOpen(true);
    setOrderItems([]);
    setEditingOrderId(null);
    setCashReceivedInput('');
    setKitchenNotes('');
    setErrorMessage(null);
  };

  return (
    <div className="space-y-4">
      {/* Bar Alat POS Restoran & Penukar Tab (SES v4.5) */}
      <div className="flex items-center justify-between gap-2.5 bg-stone-900 border border-stone-800 p-2.5 sm:p-3 rounded-2xl flex-wrap">
        {/* Navigation Mode Switcher & KDS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-stone-950 rounded-xl border border-stone-800">
            <button
              type="button"
              id="restaurant-tab-tables-btn"
              onClick={() => setActiveRestaurantTab('TABLES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeRestaurantTab === 'TABLES'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid Meja ({tables.length})</span>
            </button>
            <button
              type="button"
              id="restaurant-tab-menu-btn"
              onClick={() => setActiveRestaurantTab('MENU')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeRestaurantTab === 'MENU'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Menu &amp; Pesanan</span>
            </button>
          </div>

          <button
            type="button"
            id="restaurant-kds-open-btn"
            onClick={() => {
              const slug = activeWorkspaceSlug;
              pushRoute(slug ? `/${slug}/kds` : '/kds');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition shadow-sm cursor-pointer"
          >
            <ChefHat className="w-4 h-4" />
            <span>Dapur</span>
          </button>
        </div>

        {/* SES v4.5 Standardized Actions: [Audit Duplikasi] -> [Eksport CSV] -> [Import CSV] -> [Tambah Baharu] */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Audit Duplikasi */}
          <button
            type="button"
            id="restaurant-audit-duplikasi-btn"
            onClick={() => {
              if (activeRestaurantTab === 'TABLES') {
                const groups = DuplicateAuditService.auditTables(tables);
                setAuditGroups(groups);
                setAuditTitle('Meja Restoran');
                setAuditType('TABLE');
              } else {
                const groups = DuplicateAuditService.auditMenuItems(menuItems);
                setAuditGroups(groups);
                setAuditTitle('Menu Restoran');
                setAuditType('MENU_ITEM');
              }
              setIsDuplicateAuditOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-amber-950/40 text-amber-300 border border-amber-500/30 transition cursor-pointer"
            title="Audit Duplikasi (SES v4.5)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Audit Duplikasi</span>
          </button>

          {/* 2. Eksport CSV */}
          <button
            type="button"
            id="restaurant-export-csv-btn"
            onClick={() => {
              if (activeRestaurantTab === 'TABLES') {
                RestaurantCsvService.exportTablesToCsv(tables, activeWorkspaceSlug);
              } else {
                RestaurantCsvService.exportMenuToCsv(menuItems, activeWorkspaceSlug);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition cursor-pointer"
            title="Eksport CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Eksport CSV</span>
          </button>

          {/* 3. Import CSV */}
          <button
            type="button"
            id="restaurant-import-csv-btn"
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition cursor-pointer"
            title="Import Menu CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          {/* 4. Tambah Baharu */}
          {activeRestaurantTab === 'TABLES' ? (
            <button
              type="button"
              id="add-table-definition-btn"
              onClick={() => setIsAddTableModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Meja</span>
            </button>
          ) : (
            <button
              type="button"
              id="open-menu-management-btn"
              onClick={() => setIsMenuManagementOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Menu</span>
            </button>
          )}
        </div>
      </div>

      {/* Ralat Mesej Alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-3 flex items-center justify-between gap-2 text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-stone-400 hover:text-white text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Paparan Utama: Grid Meja Interaktif ATAU Paparan Katalog Pesanan */}
      {activeRestaurantTab === 'TABLES' ? (
        <TableGridView
          tables={tables}
          onRefresh={refreshTablesData}
          onSelectTable={(table) => {
            setSelectedTableForDetail(table);
          }}
          onOpenNewTableModal={() => setIsAddTableModalOpen(true)}
        />
      ) : null}

      {/* Grid Utama: Kiri (Katalog Menu Restoran) | Kanan (Troli & Bil Pesanan) */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start ${activeRestaurantTab === 'TABLES' ? 'hidden' : ''}`}>
        {/* Kolum Kiri: Pilihan Menu & Kategori (7 Lajur) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Carian & Kategori */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 space-y-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Cari hidangan atau kod menu (cth: Nasi Lemak, M01, Teh Tarik)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Tab Kategori Menu */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Semua ({menuItems.length})
              </button>
              {menuCategories.map((cat) => {
                const count = menuItems.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Kad Menu Restoran */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMenuItems.map((item) => {
              const countInCart = orderItems
                .filter((oi) => oi.menuItemId === item.id)
                .reduce((a, b) => a + b.quantity, 0);

              return (
                <div
                  key={item.id}
                  id={`menu-card-${item.id}`}
                  onClick={() => handleItemCardClick(item)}
                  className={`relative p-3 rounded-2xl border flex flex-col justify-between transition-all select-none cursor-pointer ${
                    !item.isAvailable
                      ? 'bg-stone-950/60 border-stone-800/80 opacity-60'
                      : 'bg-stone-900 border-stone-800 hover:border-emerald-500/60 hover:bg-stone-850 hover:shadow-md'
                  }`}
                >
                  {/* Bilangan Dalam Troli Badge */}
                  {countInCart > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold font-mono flex items-center justify-center ring-2 ring-stone-900 shadow-xs">
                      {countInCart}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800">
                        {item.code}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                          item.isAvailable
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                            : 'text-rose-400 border-rose-500/30 bg-rose-950/30'
                        }`}
                      >
                        {item.isAvailable ? 'Tersedia' : 'Habis'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-2 mt-1 leading-snug">
                      {item.name}
                    </h4>

                    {item.modifierGroups && item.modifierGroups.length > 0 && (
                      <span className="inline-block text-[10px] text-emerald-400/90 mt-1 font-medium">
                        +{item.modifierGroups.length} pilihan variasi
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-800/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {formatCurrency(item.price)}
                    </span>
                    <button
                      type="button"
                      disabled={!item.isAvailable}
                      className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMenuItems.length === 0 && (
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-8 text-center text-xs text-stone-500">
              Tiada hidangan ditemui mengikut carian atau kategori ini.
            </div>
          )}
        </div>

        {/* Kolum Kanan: Maklumat Meja, Troli & Pembayaran (5 Lajur) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Pemilih Jenis Pesanan & Nombor Meja */}
          <RestaurantOrderTypeSelector
            orderType={orderType}
            tableNumber={tableNumber}
            guestCount={guestCount}
            customerName={customerName}
            customerPhone={customerPhone}
            availableTables={tables}
            enabledOrderTypes={businessConfig?.enabledOrderTypes}
            tableMode={businessConfig?.tableMode}
            onOrderTypeChange={setOrderType}
            onTableNumberChange={setTableNumber}
            onGuestCountChange={setGuestCount}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
            onViewTableGrid={() => setActiveRestaurantTab('TABLES')}
          />

          {/* Kotak Troli Pesanan */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xs flex flex-col">
            <div className="p-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">
                  Pesanan Semasa ({orderItems.reduce((a, b) => a + b.quantity, 0)} item)
                </span>
              </div>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearOrder}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* Senarai Item dalam Troli */}
            <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto">
              {orderItems.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500">
                  Pesanan masih kosong. Klik pada mana-mana menu hidangan untuk menambah ke pesanan.
                </div>
              ) : (
                orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-white leading-tight">
                            {item.nameSnapshot}
                          </h5>
                          {item.discountAmount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                              {item.isLockedAfterApproval && <ShieldCheck className="w-3 h-3 text-amber-400" />}
                              <span>Diskaun {item.discountApprovedBy === 'OWNER' && '(Owner)'}</span>
                            </span>
                          )}
                        </div>

                        {/* Modifiers dipilih */}
                        {item.selectedModifiers.length > 0 && (
                          <div className="text-[11px] text-stone-400 mt-1 space-y-0.5">
                            {item.selectedModifiers.map((mod) => (
                              <div key={mod.optionId} className="flex items-center gap-1">
                                <span className="text-stone-500">&bull;</span>
                                <span>{mod.optionName}</span>
                                {mod.price > 0 && (
                                  <span className="text-emerald-400/90 font-mono">
                                    (+{formatCurrency(mod.price)})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Arahan Khas Dapur */}
                        {item.specialInstructions && (
                          <div className="text-[10px] text-amber-400/90 italic mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 shrink-0" />
                            <span>Nota: {item.specialInstructions}</span>
                          </div>
                        )}
                      </div>

                      {/* Harga Garisan */}
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-emerald-400">
                          {formatCurrency(item.lineTotal)}
                        </div>
                        {item.discountAmount > 0 && (
                          <div className="text-[10px] text-stone-500 line-through">
                            {formatCurrency(item.unitTotal * item.quantity)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Kawalan Baris: Kuantiti & Butang Diskaun Per Item */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-800/60 text-xs">
                      {/* Butang Diskaun Item (SES v4.5) */}
                      <button
                        type="button"
                        onClick={() => setDiscountingItem(item)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                          item.discountAmount > 0
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800 hover:bg-amber-950'
                            : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                        }`}
                      >
                        <Percent className="w-3 h-3" />
                        <span>
                          {item.discountAmount > 0
                            ? `Diskaun -${formatCurrency(item.discountAmount)}`
                            : 'Set Diskaun Item'}
                        </span>
                      </button>

                      {/* Kawalan Kuantiti */}
                      <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-white text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-stone-500 hover:text-rose-400 p-1 ml-1"
                          title="Buang hidangan"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ringkasan Bayaran & Pengiraan Cukai Konfigurasi */}
            {orderItems.length > 0 && (
              <div className="p-3.5 bg-stone-950 border-t border-stone-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal Hidangan:</span>
                  <span>{formatCurrency(grossSubtotal)}</span>
                </div>

                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Jumlah Diskaun Item:</span>
                    <span>-{formatCurrency(totalItemDiscounts)}</span>
                  </div>
                )}

                {serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-stone-400">
                    <span>
                      {taxConfig.serviceChargeName} ({taxConfig.serviceChargePercent}%):
                    </span>
                    <span>+{formatCurrency(serviceChargeAmount)}</span>
                  </div>
                )}

                {taxAmount > 0 && (
                  <div className="flex justify-between text-stone-400">
                    <span>
                      {taxConfig.taxName} ({taxConfig.taxRatePercent}%)
                      {taxConfig.isTaxInclusive && ' (Termasuk)'}:
                    </span>
                    <span>
                      {taxConfig.isTaxInclusive ? '' : '+'}
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-stone-800 font-sans">
                  <span>Jumlah Bersih:</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(grandTotal)}</span>
                </div>

                {/* Input Tunai Diterima */}
                <div className="pt-2 border-t border-stone-800/80 space-y-1.5 font-sans">
                  <div className="flex items-center justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tunai Diterima (RM)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCashReceivedInput(grandTotal.toFixed(2))}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Nilai Tepat (Exact)
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder={grandTotal.toFixed(2)}
                    value={cashReceivedInput}
                    onChange={(e) => setCashReceivedInput(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  {cashTendered > grandTotal && (
                    <div className="flex justify-between text-xs text-emerald-400 font-mono pt-1">
                      <span>Baki Pulangan:</span>
                      <span className="font-bold">{formatCurrency(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* Butang Tindakan Pesanan Mengikut Jenis */}
                <div className="space-y-2 mt-2">
                  {orderType === 'DINE_IN' && (
                    <button
                      type="button"
                      id="restaurant-save-dinein-order-btn"
                      onClick={handleConfirmDineInOrder}
                      className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      <span>Sahkan Pesanan Meja ({tableNumber}) &rarr; Set OCCUPIED</span>
                    </button>
                  )}

                  {/* Butang Selesaikan Pesanan & Bayar Segera */}
                  <button
                    type="button"
                    id="restaurant-complete-order-btn"
                    onClick={handleCompleteOrder}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Terima Bayaran &amp; Selesaikan ({formatCurrency(grandTotal)})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Pilihan Variasi/Modifier */}
      <MenuItemModifierModal
        isOpen={Boolean(selectedMenuItemForModal)}
        menuItem={selectedMenuItemForModal}
        onClose={() => setSelectedMenuItemForModal(null)}
        onConfirm={handleConfirmAddItem}
      />

      {/* Modal Diskaun Per Item (SES v4.5 dengan Pengesahan PIN Owner) */}
      <ItemDiscountModal
        isOpen={Boolean(discountingItem)}
        item={discountingItem}
        workspaceSlug={activeWorkspaceSlug}
        onClose={() => setDiscountingItem(null)}
        onApplyDiscount={handleApplyItemDiscount}
        onRemoveDiscount={handleRemoveItemDiscount}
      />

      {/* Modal Pengurusan Menu Restoran */}
      <MenuManagementModal
        isOpen={isMenuManagementOpen}
        menuItems={menuItems}
        categories={menuCategories}
        onClose={() => setIsMenuManagementOpen(false)}
        onSaveItem={saveMenuItem}
        onDeleteItem={deleteMenuItem}
        onToggleAvailability={toggleMenuItemAvailability}
        onRefreshMenu={refreshMenuData}
      />

      {/* Modal Pengesahan Kejayaan Pesanan Selesai */}
      {isSuccessModalOpen && lastCompletedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-5 text-center shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pesanan Berjaya Direkodkan!</h3>
              <p className="text-xs text-stone-400 mt-1">
                ID Pesanan: <span className="font-mono text-stone-200">{lastCompletedOrder.orderId}</span>
              </p>
              {lastCompletedOrder.orderType === 'DINE_IN' && (
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  Meja: {lastCompletedOrder.tableNumber} &bull; {lastCompletedOrder.guestCount} Pax
                </p>
              )}
            </div>

            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs font-mono space-y-1.5 text-left">
              <div className="flex justify-between text-stone-400">
                <span>Jumlah Bil:</span>
                <span className="text-white font-bold">{formatCurrency(lastCompletedOrder.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Tunai Diterima:</span>
                <span>{formatCurrency(lastCompletedOrder.cashTendered)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-stone-800">
                <span>Baki Pulangan:</span>
                <span>{formatCurrency(lastCompletedOrder.changeDue)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              Pesanan Baharu
            </button>
          </div>
        </div>
      )}

      {/* Modal Terperinci Meja (Status, Audit Trail, Buka Pesanan Baru) */}
      <TableDetailModal
        isOpen={Boolean(selectedTableForDetail)}
        table={selectedTableForDetail}
        auditLogs={tableAuditLogs}
        onClose={() => setSelectedTableForDetail(null)}
        onUpdateStatus={(tableId, newStatus, reason) => {
          updateTableStatus(tableId, newStatus, reason);
          if (selectedTableForDetail && selectedTableForDetail.id === tableId) {
            setSelectedTableForDetail({
              ...selectedTableForDetail,
              status: newStatus,
              updatedAt: new Date().toISOString(),
            });
          }
        }}
        onStartOrder={(table, pax) => {
          // Navigasi ke pesanan tanpa tukar status serta-merta (SES v4.5)
          setOrderType('DINE_IN');
          setTableNumber(table.tableNumber);
          setGuestCount(pax || table.capacity || 2);
          if (table.activeOrder && table.activeOrder.items) {
            setOrderItems(table.activeOrder.items);
            setEditingOrderId(table.activeOrder.orderId);
          } else {
            setOrderItems([]);
            setEditingOrderId(null);
          }
          setSelectedTableForDetail(null);
          setActiveRestaurantTab('MENU');
        }}
        onOpenReservationModal={(table) => {
          setSelectedTableForDetail(null);
          setTableForReservation(table);
        }}
      />

      {/* Modal Tempahan Meja (Reservation) */}
      <ReservationModal
        isOpen={Boolean(tableForReservation)}
        table={tableForReservation}
        onClose={() => setTableForReservation(null)}
        onAddReservation={(reservationData) => {
          addTableReservation(reservationData);
          setTableForReservation(null);
        }}
      />

      {/* Modal Tambah Meja Baharu */}
      <TableDefinitionModal
        isOpen={isAddTableModalOpen}
        tables={tables}
        existingZones={Array.from(new Set(tables.map((t) => t.zone)))}
        onClose={() => setIsAddTableModalOpen(false)}
        onSaveTable={(tableData) => {
          saveTableDefinition(tableData);
          setIsAddTableModalOpen(false);
        }}
      />

      {/* Modal Audit Duplikasi (SES v4.5) */}
      <DuplicateAuditModal
        isOpen={isDuplicateAuditOpen}
        onClose={() => setIsDuplicateAuditOpen(false)}
        entityTitle={auditTitle}
        entityType={auditType}
        auditGroups={auditGroups}
      />

      {/* Modal Import CSV Menu Restoran (SES v4.5) */}
      <RestaurantCsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        workspaceSlug={activeWorkspaceSlug}
        onImportSuccess={() => {
          refreshMenuData();
        }}
      />
    </div>
  );
};
