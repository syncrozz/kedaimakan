import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  CheckCircle2,
  Receipt,
  AlertCircle,
  Tag,
  ShoppingBag,
  History,
  Coins,
  UtensilsCrossed,
  Utensils,
  Coffee,
  Settings,
  ChevronDown,
  Percent,
  Clock,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
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
import { LayoutGrid, Layers, PlusCircle, ChefHat, ShieldAlert, Download, UploadCloud, Package } from 'lucide-react';
import { DuplicateAuditModal } from '../common/DuplicateAuditModal';
import { DuplicateAuditService, DuplicateGroup } from '../../services/duplicateAuditService';
import { RestaurantCsvService } from '../../services/restaurantCsvService';
import { RestaurantCsvImportModal } from '../menu/RestaurantCsvImportModal';
import { RestaurantClearDataModal } from './RestaurantClearDataModal';
import { Product } from '../../types';
import { UnifiedCompletedOrderRecord } from '../../types/restaurant';
import { CrossSuiteCheckoutService } from '../../services/crossSuiteCheckoutService';
import { RetailItemPickerModal } from './RetailItemPickerModal';
import { UnifiedOrderReceiptModal } from './UnifiedOrderReceiptModal';

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
    clearRestaurantData,
    loadSampleRestaurantData,
    businessConfig,
    products,
    commitCrossSuiteCheckout,
  } = useStore();

  // Search & Category Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSuperCategory, setSelectedSuperCategory] = useState<'ALL' | 'FOOD' | 'BEVERAGE'>('ALL');

  // Helper function to detect if category / item is beverage
  const isDrinkCategory = (categoryName: string) => {
    const lower = (categoryName || '').toLowerCase();
    return (
      lower.includes('minum') ||
      lower.includes('drink') ||
      lower.includes('beverage') ||
      lower.includes('kopi') ||
      lower.includes('teh') ||
      lower.includes('jus') ||
      lower.includes('air')
    );
  };

  const isDrinkItem = (item: MenuItem) => {
    if (item.kitchenStation === 'BAR') return true;
    return isDrinkCategory(item.category);
  };

  // Counts for Food and Beverage
  const foodItemsCount = useMemo(() => {
    return menuItems.filter((m) => m.active && !isDrinkItem(m)).length;
  }, [menuItems]);

  const beverageItemsCount = useMemo(() => {
    return menuItems.filter((m) => m.active && isDrinkItem(m)).length;
  }, [menuItems]);

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
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Close Settings Dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

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

  // Cross-Suite Retail Checkout States (SES v4.5)
  const [isRetailPickerOpen, setIsRetailPickerOpen] = useState(false);
  const [unifiedCompletedOrder, setUnifiedCompletedOrder] = useState<UnifiedCompletedOrderRecord | null>(null);
  const [isUnifiedReceiptOpen, setIsUnifiedReceiptOpen] = useState(false);

  // Add retail item from NiagaPOS catalog to active restaurant order
  const handleAddRetailProduct = (product: Product) => {
    if (product.active === false) {
      setErrorMessage(`Produk "${product.name}" tidak aktif.`);
      return;
    }

    const existingIndex = orderItems.findIndex(
      (it) => it.itemType === 'RETAIL' && (it.retailProductId === product.id || it.retailSku === product.sku)
    );

    if (existingIndex >= 0) {
      const existingItem = orderItems[existingIndex];
      if (existingItem.quantity + 1 > product.currentStock) {
        setErrorMessage(`Stok produk "${product.name}" tidak mencukupi (Baki: ${product.currentStock}).`);
        return;
      }
      const nextItems = [...orderItems];
      const nextQty = existingItem.quantity + 1;
      nextItems[existingIndex] = {
        ...existingItem,
        quantity: nextQty,
        lineTotal: Math.round((existingItem.unitTotal * nextQty - (existingItem.discountAmount || 0)) * 100) / 100,
      };
      setOrderItems(nextItems);
    } else {
      if (product.currentStock < 1) {
        setErrorMessage(`Produk "${product.name}" telah kehabisan stok.`);
        return;
      }
      const newOrderItem: RestaurantOrderItem = {
        id: `ITEM-RTL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemType: 'RETAIL',
        retailProductId: product.id,
        retailSku: product.sku,
        nameSnapshot: product.name,
        categorySnapshot: product.category || 'Barangan Runcit',
        kitchenStation: 'NONE',
        basePriceSnapshot: product.sellingPrice,
        costPriceSnapshot: product.costPrice,
        selectedModifiers: [],
        unitTotal: product.sellingPrice,
        quantity: 1,
        discountType: 'NONE',
        discountValue: 0,
        discountAmount: 0,
        lineTotal: product.sellingPrice,
      };
      setOrderItems((prev) => [...prev, newOrderItem]);
    }
    setErrorMessage(null);
  };
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

  // Filter Menu Items by Super Category (Makanan / Minuman), Subcategory & Search
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.active) return false;

      // Super category filtering (Makanan vs Minuman)
      if (selectedSuperCategory === 'FOOD' && isDrinkItem(item)) {
        return false;
      }
      if (selectedSuperCategory === 'BEVERAGE' && !isDrinkItem(item)) {
        return false;
      }

      // Specific Category filtering
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, selectedSuperCategory, searchQuery]);

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

          // Cross-Suite Retail stock constraint check
          if (item.itemType === 'RETAIL' && delta > 0) {
            const prod = products.find(
              (p) => p.id === (item.retailProductId || item.menuItemId) || p.sku === item.retailSku
            );
            if (prod && newQty > prod.currentStock) {
              setErrorMessage(`Stok produk "${prod.name}" tidak mencukupi (Baki: ${prod.currentStock}).`);
              return item;
            }
          }

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
      setErrorMessage('Sila pilih sekurang-kurangnya satu hidangan atau barangan runcit.');
      return;
    }

    if (cashTendered < grandTotal) {
      setErrorMessage(
        `Tunai diterima (${formatCurrency(cashTendered)}) kurang daripada jumlah bil (${formatCurrency(grandTotal)}).`
      );
      return;
    }

    const currentSlug = activeWorkspaceSlug || 'default';
    const checkoutOperationId = CrossSuiteCheckoutService.generateOperationId();

    try {
      // Authoritative Cross-Suite Checkout with Idempotency & Inventory Deduction (SES v4.5)
      const result = CrossSuiteCheckoutService.processCheckout({
        checkoutOperationId,
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        guestCount: orderType === 'DINE_IN' ? guestCount : undefined,
        customerName: customerName || (orderType === 'DINE_IN' ? `Meja ${tableNumber}` : 'Pelanggan Walk-in'),
        cashierName: activeStaff ? activeStaff.name : 'Store Owner',
        items: orderItems,
        taxConfig,
        cashTendered,
        workspaceId: currentSlug,
        availableProducts: products,
      });

      // Synchronize authoritative stock deductions & movements
      commitCrossSuiteCheckout(result);

      // Jika Dine-In, kemas kini meja kepada status CLEANING (Perlu dibersihkan)
      if (orderType === 'DINE_IN') {
        const targetTable = tables.find((t) => t.tableNumber === tableNumber);
        if (targetTable) {
          updateTableStatus(
            targetTable.id,
            'CLEANING',
            `Bayaran bil ${result.completedOrder.orderId} selesai, meja perlu dibersihkan`
          );
        }
      }

      // KOT Synchronization: KotService automatically excludes retail items (Directive 7)
      KotService.createOrGetKitchenTicket(
        {
          orderId: result.completedOrder.orderId,
          tableId: orderType === 'DINE_IN' ? tableNumber : undefined,
          tableName: orderType === 'DINE_IN' ? `Meja ${tableNumber}` : undefined,
          orderType,
          items: orderItems,
          customerName: result.completedOrder.customerName,
          guestCount: orderType === 'DINE_IN' ? guestCount : undefined,
          notes: kitchenNotes,
          operator: result.completedOrder.cashierName,
        },
        currentSlug
      )
        .then(({ isNew }) => {
          if (isNew) {
            KotService.playNewKotChime();
          }
        })
        .catch(console.error);

      setLastCompletedOrder(result.completedOrder as any);
      setUnifiedCompletedOrder(result.completedOrder);
      setIsUnifiedReceiptOpen(true);
      setOrderItems([]);
      setEditingOrderId(null);
      setCashReceivedInput('');
      setKitchenNotes('');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ralat semasa memproses checkout.');
    }
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeRestaurantTab === 'MENU'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                  : 'text-stone-200 bg-stone-900/80 hover:bg-stone-800 hover:text-white border border-stone-700/60 shadow-xs'
              }`}
            >
              <UtensilsCrossed className={`w-3.5 h-3.5 ${activeRestaurantTab === 'MENU' ? 'text-white' : 'text-emerald-400'}`} />
              <span>Menu &amp; Pesanan</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold transition ${
                  activeRestaurantTab === 'MENU'
                    ? 'bg-emerald-700/80 text-emerald-100'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/40'
                }`}
              >
                {menuItems.length}
              </span>
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

        {/* Bahagian Tetapan (Icon Gear di Hujung Kanan Atas) */}
        <div className="relative" ref={settingsDropdownRef}>
          <button
            type="button"
            id="restaurant-settings-gear-btn"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs ${
              isSettingsOpen
                ? 'bg-stone-800 text-white border-emerald-500/60 ring-2 ring-emerald-500/20'
                : 'bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 hover:text-white border-stone-700/90'
            }`}
            title="Tetapan &amp; Alat Operasi"
          >
            <Settings className={`w-4 h-4 text-emerald-400 group-hover:rotate-45 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : ''}`} />
            <span>Tetapan {activeRestaurantTab === 'TABLES' ? 'Meja' : 'Menu'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Panel Dropdown Tetapan */}
          {isSettingsOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-stone-900/95 backdrop-blur-md border border-stone-700/90 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-stone-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tetapan {activeRestaurantTab === 'TABLES' ? 'Meja' : 'Menu'}</span>
                  </h4>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Konfigurasi, alat sandaran CSV &amp; audit duplikasi
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                  SES v4.5
                </span>
              </div>

              {/* 1. Tambah Baharu */}
              <div className="p-1">
                {activeRestaurantTab === 'TABLES' ? (
                  <button
                    type="button"
                    id="add-table-definition-btn"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsAddTableModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white group-hover:text-emerald-200">
                        Tambah Meja Baharu
                      </div>
                      <div className="text-[11px] text-emerald-400/80 truncate">
                        Daftar nombor meja, zon &amp; kapasiti
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    id="open-menu-management-btn"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsMenuManagementOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white group-hover:text-emerald-200">
                        Tambah Menu Baharu
                      </div>
                      <div className="text-[11px] text-emerald-400/80 truncate">
                        Daftar hidangan, harga &amp; varian
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* 2. Audit Duplikasi */}
              <button
                type="button"
                id="restaurant-audit-duplikasi-btn"
                onClick={() => {
                  setIsSettingsOpen(false);
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
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-stone-800/80 text-stone-200 transition cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-stone-100 group-hover:text-amber-300">
                    Audit Duplikasi
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    Imbas &amp; atasi rekod bertindih (SES v4.5)
                  </div>
                </div>
              </button>

              {/* 3. Eksport CSV */}
              <button
                type="button"
                id="restaurant-export-csv-btn"
                onClick={() => {
                  setIsSettingsOpen(false);
                  if (activeRestaurantTab === 'TABLES') {
                    RestaurantCsvService.exportTablesToCsv(tables, activeWorkspaceSlug);
                  } else {
                    RestaurantCsvService.exportMenuToCsv(menuItems, activeWorkspaceSlug);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-stone-800/80 text-stone-200 transition cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-stone-100 group-hover:text-sky-300">
                    Eksport CSV
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    Muat turun sandaran fail .csv
                  </div>
                </div>
              </button>

              {/* 4. Import CSV */}
              <button
                type="button"
                id="restaurant-import-csv-btn"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsCsvImportOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-stone-800/80 text-stone-200 transition cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <UploadCloud className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-stone-100 group-hover:text-emerald-300">
                    Import CSV
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    Muat naik fail CSV secara pukal
                  </div>
                </div>
              </button>

              {/* 5. Mula Dari Kosong (Zon Padam Data) */}
              {(tables.length > 0 || menuItems.length > 0 || reservations.length > 0) && (
                <>
                  <div className="border-t border-stone-800 my-1" />
                  <button
                    type="button"
                    id="restaurant-clear-data-zero-btn"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsClearDataModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-rose-950/40 text-rose-300 border border-rose-900/30 hover:border-rose-600/50 transition cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-rose-200 group-hover:text-rose-100">
                        Mula Dari Kosong
                      </div>
                      <div className="text-[10px] text-rose-400/80 truncate">
                        Padam data demo meja, tempahan, atau menu
                      </div>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Kejayaan Mesej Alert */}
      {successMessage && (
        <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 flex items-center justify-between gap-2 text-emerald-300 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-stone-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

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
            className="text-stone-400 hover:text-white text-xs underline cursor-pointer"
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
          onLoadSampleTables={() => {
            loadSampleRestaurantData({ tables: true });
            setSuccessMessage('Data contoh pelan meja restoran berjaya dimuatkan semula.');
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
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

            {/* Bar Pemisah Pantas: Makanan vs Minuman (Super Category) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-950 rounded-xl border border-stone-800/80">
              <button
                type="button"
                id="filter-all-supercat-btn"
                onClick={() => {
                  setSelectedSuperCategory('ALL');
                  setSelectedCategory('ALL');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedSuperCategory === 'ALL'
                    ? 'bg-stone-800 text-white shadow-xs border border-stone-700/80'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/50'
                }`}
              >
                <span>Semua Menu</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-900 font-mono text-stone-300">
                  {menuItems.length}
                </span>
              </button>

              <button
                type="button"
                id="filter-food-supercat-btn"
                onClick={() => {
                  setSelectedSuperCategory('FOOD');
                  setSelectedCategory('ALL');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedSuperCategory === 'FOOD'
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400/40'
                    : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-950/20'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Makanan</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedSuperCategory === 'FOOD'
                      ? 'bg-amber-700 text-amber-100'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                  }`}
                >
                  {foodItemsCount}
                </span>
              </button>

              <button
                type="button"
                id="filter-beverage-supercat-btn"
                onClick={() => {
                  setSelectedSuperCategory('BEVERAGE');
                  setSelectedCategory('ALL');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedSuperCategory === 'BEVERAGE'
                    ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400/40 animate-pulse'
                    : 'text-sky-300/80 hover:text-sky-200 hover:bg-sky-950/20'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Minuman</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedSuperCategory === 'BEVERAGE'
                      ? 'bg-sky-700 text-sky-100'
                      : 'bg-sky-950/60 text-sky-300 border border-sky-800/40'
                  }`}
                >
                  {beverageItemsCount}
                </span>
              </button>
            </div>

            {/* Tab Kategori Menu Terperinci */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? selectedSuperCategory === 'BEVERAGE'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : selectedSuperCategory === 'FOOD'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Semua Kategori (
                {selectedSuperCategory === 'FOOD'
                  ? foodItemsCount
                  : selectedSuperCategory === 'BEVERAGE'
                  ? beverageItemsCount
                  : menuItems.length}
                )
              </button>
              {menuCategories
                .filter((cat) => {
                  if (selectedSuperCategory === 'FOOD') return !isDrinkCategory(cat);
                  if (selectedSuperCategory === 'BEVERAGE') return isDrinkCategory(cat);
                  return true;
                })
                .map((cat) => {
                  const isDrink = isDrinkCategory(cat);
                  const count = menuItems.filter((m) => m.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? isDrink
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : isDrink
                          ? 'bg-sky-950/30 text-sky-300 hover:text-sky-100 border border-sky-900/50'
                          : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                      }`}
                    >
                      {isDrink ? (
                        <Coffee className="w-3 h-3 text-sky-400" />
                      ) : (
                        <Utensils className="w-3 h-3 text-amber-400" />
                      )}
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
                      : isDrinkItem(item)
                      ? 'bg-stone-900 border-stone-800 hover:border-sky-500/70 hover:bg-stone-850 hover:shadow-md'
                      : 'bg-stone-900 border-stone-800 hover:border-amber-500/70 hover:bg-stone-850 hover:shadow-md'
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
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800">
                          {item.code}
                        </span>
                        {isDrinkItem(item) ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/50 flex items-center gap-0.5">
                            <Coffee className="w-2.5 h-2.5" />
                            <span>Air</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/50 flex items-center gap-0.5">
                            <Utensils className="w-2.5 h-2.5" />
                            <span>Mkn</span>
                          </span>
                        )}
                      </div>
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

          {menuItems.length === 0 ? (
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3">
                <ChefHat className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-stone-200">Katalog Menu Masih Kosong</p>
              <p className="text-xs text-stone-400 max-w-md mt-1 mb-5">
                Semua menu hidangan demo telah dikosongkan. Anda boleh mendaftar hidangan sebenar kedai anda satu demi satu atau import pukal melalui fail CSV.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  id="empty-menu-add-btn"
                  onClick={() => setIsMenuManagementOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Daftar Menu Baharu</span>
                </button>
                <button
                  type="button"
                  id="empty-menu-import-csv-btn"
                  onClick={() => setIsCsvImportOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Import Menu CSV</span>
                </button>
                <button
                  type="button"
                  id="empty-menu-load-sample-btn"
                  onClick={() => {
                    loadSampleRestaurantData({ menu: true });
                    setSuccessMessage('Data contoh menu hidangan telah dimuatkan semula.');
                    setTimeout(() => setSuccessMessage(null), 5000);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-800/60 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-800 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Data Contoh Menu</span>
                </button>
              </div>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-8 text-center text-xs text-stone-500">
              Tiada hidangan ditemui mengikut carian atau kategori ini.
            </div>
          ) : null}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="restaurant-add-retail-item-btn"
                  onClick={() => setIsRetailPickerOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>+ Runcit (NiagaPOS)</span>
                </button>
                {orderItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearOrder}
                    className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
              </div>
            </div>

            {/* Senarai Item dalam Troli */}
            <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto">
              {/* Petunjuk Pintar: Selesai Makanan -> Lompat Terus ke Menu Minuman */}
              {orderItems.length > 0 &&
                orderItems.some((oi) => oi.itemType !== 'RETAIL' && oi.kitchenStation !== 'BAR' && !isDrinkCategory(oi.categorySnapshot)) &&
                !orderItems.some((oi) => oi.itemType !== 'RETAIL' && (oi.kitchenStation === 'BAR' || isDrinkCategory(oi.categorySnapshot))) && (
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-950/60 to-stone-900 border border-sky-500/40 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-sky-600/30 text-sky-400 flex items-center justify-center shrink-0">
                        <Coffee className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-sky-200 truncate">
                          Selesai pilih makanan?
                        </p>
                        <p className="text-[10px] text-sky-400/80 truncate">
                          Pilih minuman untuk pelanggan
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="quick-jump-beverage-btn"
                      onClick={() => {
                        setSelectedSuperCategory('BEVERAGE');
                        setSelectedCategory('ALL');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white shrink-0 flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <span>Menu Minuman</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="text-xs font-bold text-white leading-tight">
                            {item.nameSnapshot}
                          </h5>
                          {item.itemType === 'RETAIL' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-0.5">
                              <Package className="w-2.5 h-2.5" />
                              <span>Runcit</span>
                            </span>
                          )}
                          {item.discountAmount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                              {item.isLockedAfterApproval && <ShieldCheck className="w-3 h-3 text-amber-400" />}
                              <span>Diskaun {item.discountApprovedBy === 'OWNER' && '(Owner)'}</span>
                            </span>
                          )}
                        </div>
                        {item.itemType === 'RETAIL' && item.retailSku && (
                          <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                            SKU: {item.retailSku} &bull; NiagaPOS
                          </div>
                        )}

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

      {/* Modal Pemilihan Barangan Runcit NiagaPOS (SES v4.5) */}
      <RetailItemPickerModal
        isOpen={isRetailPickerOpen}
        products={products}
        currentCartItems={orderItems}
        onClose={() => setIsRetailPickerOpen(false)}
        onSelectProduct={(p) => {
          handleAddRetailProduct(p);
        }}
      />

      {/* Modal Resit Pembayaran Bersepadu (SES v4.5) */}
      <UnifiedOrderReceiptModal
        isOpen={isUnifiedReceiptOpen}
        order={unifiedCompletedOrder}
        taxConfig={taxConfig}
        storeName={store.name}
        onClose={() => {
          setIsUnifiedReceiptOpen(false);
          setIsSuccessModalOpen(false);
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

      {/* Modal Mula Dari Kosong (Reset Data Restoran) */}
      <RestaurantClearDataModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
        tableCount={tables.length}
        menuCount={menuItems.length}
        reservationCount={reservations.length}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 6000);
        }}
      />
    </div>
  );
};
