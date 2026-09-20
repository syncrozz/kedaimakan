import React, { useState, useMemo } from 'react';
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
  DollarSign,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Loader2,
  Coins,
  FileText,
  User,
  UserCheck,
  X,
  Users,
  Barcode,
  Package,
  UtensilsCrossed,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product, CartItem, Sale, Customer } from '../types';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { RestaurantPosView } from '../components/pos/RestaurantPosView';
import { Modal } from '../components/common/Modal';
import { CustomerService } from '../services/customerService';
import { LoyaltyService } from '../services/loyaltyService';
import { SalesService } from '../services/salesService';
import { NIAGAPOS_ASSETS } from '../constants/branding';
import { InventoryService } from '../services/inventoryService';
import { StaffService, STORE_OWNER_ID, STORE_OWNER_NAME } from '../services/staffService';
import { STORAGE_KEYS } from '../services/storageService';

interface CategoryPastelTheme {
  cardBg: string;
  cardBorder: string;
  hoverBorder: string;
  hoverBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  profitText: string;
}

const PASTEL_PALETTES: CategoryPastelTheme[] = [
  // 0: Soft Warm Amber / Buttercream (Staples & Grains)
  {
    cardBg: 'bg-amber-50/75',
    cardBorder: 'border-amber-200/90',
    hoverBorder: 'hover:border-amber-400',
    hoverBg: 'hover:bg-amber-50',
    badgeBg: 'bg-amber-100/90',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-300/80',
    profitText: 'text-amber-800',
  },
  // 1: Soft Sky / Baby Blue (Beverages / Minuman)
  {
    cardBg: 'bg-sky-50/75',
    cardBorder: 'border-sky-200/90',
    hoverBorder: 'hover:border-sky-400',
    hoverBg: 'hover:bg-sky-50',
    badgeBg: 'bg-sky-100/90',
    badgeText: 'text-sky-900',
    badgeBorder: 'border-sky-300/80',
    profitText: 'text-sky-800',
  },
  // 2: Soft Mint / Sage Green (Fresh & Dairy)
  {
    cardBg: 'bg-emerald-50/70',
    cardBorder: 'border-emerald-200/90',
    hoverBorder: 'hover:border-emerald-400',
    hoverBg: 'hover:bg-emerald-50',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300/80',
    profitText: 'text-emerald-800',
  },
  // 3: Soft Violet / Iris Pastel (Snacks & Biscuits / Rak Depan)
  {
    cardBg: 'bg-violet-50/75',
    cardBorder: 'border-violet-200/90',
    hoverBorder: 'hover:border-violet-400',
    hoverBg: 'hover:bg-violet-50',
    badgeBg: 'bg-violet-100/90',
    badgeText: 'text-violet-900',
    badgeBorder: 'border-violet-300/80',
    profitText: 'text-violet-800',
  },
  // 4: Soft Lavender / Lilac (Household / Personal Care)
  {
    cardBg: 'bg-purple-50/70',
    cardBorder: 'border-purple-200/90',
    hoverBorder: 'hover:border-purple-400',
    hoverBg: 'hover:bg-purple-50',
    badgeBg: 'bg-purple-100/90',
    badgeText: 'text-purple-900',
    badgeBorder: 'border-purple-300/80',
    profitText: 'text-purple-800',
  },
  // 5: Soft Peach / Warm Apricot (Cooking Essentials)
  {
    cardBg: 'bg-orange-50/70',
    cardBorder: 'border-orange-200/90',
    hoverBorder: 'hover:border-orange-400',
    hoverBg: 'hover:bg-orange-50',
    badgeBg: 'bg-orange-100/90',
    badgeText: 'text-orange-900',
    badgeBorder: 'border-orange-300/80',
    profitText: 'text-orange-800',
  },
  // 6: Soft Aqua / Seafoam Teal (Frozen / Seafood / Others)
  {
    cardBg: 'bg-teal-50/70',
    cardBorder: 'border-teal-200/90',
    hoverBorder: 'hover:border-teal-400',
    hoverBg: 'hover:bg-teal-50',
    badgeBg: 'bg-teal-100/90',
    badgeText: 'text-teal-900',
    badgeBorder: 'border-teal-300/80',
    profitText: 'text-teal-800',
  },
  // 7: Soft Periwinkle / Indigo (Instant Food / Noodles)
  {
    cardBg: 'bg-indigo-50/70',
    cardBorder: 'border-indigo-200/90',
    hoverBorder: 'hover:border-indigo-400',
    hoverBg: 'hover:bg-indigo-50',
    badgeBg: 'bg-indigo-100/90',
    badgeText: 'text-indigo-900',
    badgeBorder: 'border-indigo-300/80',
    profitText: 'text-indigo-800',
  },
  // 8: Soft Honey Wheat / Golden Pastel (Bakery & Bread)
  {
    cardBg: 'bg-yellow-50/75',
    cardBorder: 'border-yellow-200/90',
    hoverBorder: 'hover:border-yellow-400',
    hoverBg: 'hover:bg-yellow-50',
    badgeBg: 'bg-yellow-100/90',
    badgeText: 'text-yellow-900',
    badgeBorder: 'border-yellow-300/80',
    profitText: 'text-yellow-800',
  },
  // 9: Soft Pistachio / Herb Green (Confectionery / Sweets)
  {
    cardBg: 'bg-lime-50/75',
    cardBorder: 'border-lime-200/90',
    hoverBorder: 'hover:border-lime-400',
    hoverBg: 'hover:bg-lime-50',
    badgeBg: 'bg-lime-100/90',
    badgeText: 'text-lime-900',
    badgeBorder: 'border-lime-300/80',
    profitText: 'text-lime-800',
  },
  // 10: Soft Cyan / Glacier (Chilled / Ice)
  {
    cardBg: 'bg-cyan-50/70',
    cardBorder: 'border-cyan-200/90',
    hoverBorder: 'hover:border-cyan-400',
    hoverBg: 'hover:bg-cyan-50',
    badgeBg: 'bg-cyan-100/90',
    badgeText: 'text-cyan-900',
    badgeBorder: 'border-cyan-300/80',
    profitText: 'text-cyan-800',
  },
];

const getCategoryPastelTheme = (category: string): CategoryPastelTheme => {
  const norm = (category || '').trim().toLowerCase();

  // Priority specific mapping so neighboring categories have distinct pastel hues:
  // Snacks & Biscuits -> Soft Blush / Rose Pink (Palet 3)
  if (norm.includes('snack') || norm.includes('biscuit') || norm.includes('kuih') || norm.includes('biskut') || norm.includes('keropok') || norm.includes('kerepek')) {
    return PASTEL_PALETTES[3]; // Blush / Rose Pink
  }
  // Staples & Grains -> Soft Warm Amber / Buttercream (Palet 0)
  if (norm.includes('grain') || norm.includes('staple') || norm.includes('beras') || norm.includes('gula') || norm.includes('flour') || norm.includes('tepung')) {
    return PASTEL_PALETTES[0]; // Warm Amber
  }
  // Beverages -> Soft Sky / Baby Blue (Palet 1)
  if (norm.includes('beverage') || norm.includes('minum') || norm.includes('drink') || norm.includes('water') || norm.includes('air') || norm.includes('juice') || norm.includes('kopi')) {
    return PASTEL_PALETTES[1]; // Sky Blue
  }
  // Fresh & Dairy -> Soft Mint / Sage Green (Palet 2)
  if (norm.includes('fresh') || norm.includes('dairy') || norm.includes('sayur') || norm.includes('telur') || norm.includes('susu') || norm.includes('segar')) {
    return PASTEL_PALETTES[2]; // Mint / Sage Green
  }
  // Bakery -> Soft Honey Wheat / Golden Butter (Palet 8)
  if (norm.includes('baker') || norm.includes('roti') || norm.includes('bread') || norm.includes('kek') || norm.includes('cake')) {
    return PASTEL_PALETTES[8]; // Honey Wheat / Golden
  }
  // Cooking Essentials -> Soft Peach / Warm Apricot (Palet 5)
  if (norm.includes('cook') || norm.includes('minyak') || norm.includes('oil') || norm.includes('rempah') || norm.includes('sos') || norm.includes('kicap') || norm.includes('masakan')) {
    return PASTEL_PALETTES[5]; // Peach / Apricot
  }
  // Instant Food -> Soft Periwinkle / Indigo (Palet 7)
  if (norm.includes('instant') || norm.includes('noodle') || norm.includes('maggi') || norm.includes('mee') || norm.includes('pasta') || norm.includes('bihun')) {
    return PASTEL_PALETTES[7]; // Indigo / Periwinkle
  }
  // Household & Personal Care -> Soft Lavender / Lilac (Palet 4)
  if (norm.includes('clean') || norm.includes('house') || norm.includes('sabun') || norm.includes('personal') || norm.includes('beauty') || norm.includes('kebersihan')) {
    return PASTEL_PALETTES[4]; // Lavender / Lilac
  }
  // Frozen & Seafood -> Soft Seafoam Teal (Palet 6)
  if (norm.includes('frozen') || norm.includes('seafood') || norm.includes('beku') || norm.includes('ikan') || norm.includes('daging') || norm.includes('ayam')) {
    return PASTEL_PALETTES[6]; // Teal / Aqua
  }

  // Deterministic hash for any other custom category
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_PALETTES.length;
  return PASTEL_PALETTES[index];
};

export const PosPage: React.FC = () => {
  const {
    store,
    products,
    sales,
    processSale,
    customers,
    loyaltyLedger,
    activeStaff,
    staffUsers,
    setActiveStaff,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  // SYNCROZZ KEDAI MAKAN - Mode Operasi POS (Restoran vs Runcit Tradisional)
  const [posMode, setPosMode] = useState<'RESTAURANT' | 'RETAIL'>('RESTAURANT');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Customer & Staff State (Part 07)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Modals
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [viewHistorySale, setViewHistorySale] = useState<Sale | null>(null);
  const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active cashiers resolution: only staff with active === true and role === 'CASHIER'
  const activeCashiers = useMemo(() => {
    return StaffService.getActiveCashiers(staffUsers);
  }, [staffUsers]);

  // Determine currently active cashier with Store Owner fallback
  const currentCashier = useMemo(() => {
    if (store.settings?.enableStaff === false || activeCashiers.length === 0) {
      return null;
    }
    if (activeStaff && activeCashiers.some((c) => c.id === activeStaff.id)) {
      return activeStaff;
    }
    const savedCashierId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CASHIER_ID);
    if (savedCashierId === 'store-owner') {
      return null;
    }
    if (savedCashierId) {
      const match = activeCashiers.find((c) => c.id === savedCashierId);
      if (match) return match;
    }
    // Check if Admin configured a specific default cashier in Store Settings
    const adminDefaultCashierId = store.settings?.defaultCashierId;
    if (adminDefaultCashierId && adminDefaultCashierId !== 'store-owner') {
      const defaultMatch = activeCashiers.find((c) => c.id === adminDefaultCashierId);
      if (defaultMatch) return defaultMatch;
    }
    // Default fallback: Store Owner (null)
    return null;
  }, [store.settings?.enableStaff, store.settings?.defaultCashierId, activeCashiers, activeStaff]);

  const selectedCashierValue = currentCashier ? currentCashier.id : 'store-owner';

  // POS Core Rule: Catalog must only display active products (Product.active === true)
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.active);
  }, [products]);

  // Categories derived exclusively from active products
  const categories = useMemo(() => {
    return SalesService.getPosCategories(products);
  }, [products]);

  // Catalog filtering: Active products only, filtered by category and search (name / SKU)
  const filteredProducts = useMemo(() => {
    return SalesService.filterPosCatalog(products, selectedCategory, searchQuery);
  }, [products, selectedCategory, searchQuery]);

  // Synchronize cart with latest live product data
  const liveCart = useMemo(() => {
    return cart.map((item) => {
      const liveProduct = products.find((p) => p.id === item.product.id) || item.product;
      return {
        ...item,
        product: liveProduct,
      };
    });
  }, [cart, products]);

  // Financial calculations
  const cartSubtotal = useMemo(() => {
    return liveCart.reduce(
      (acc, item) => acc + item.quantity * item.product.sellingPrice,
      0
    );
  }, [liveCart]);

  const cartTotalCost = useMemo(() => {
    return liveCart.reduce(
      (acc, item) => acc + item.quantity * item.product.costPrice,
      0
    );
  }, [liveCart]);

  const roundedSubtotal = Number(cartSubtotal.toFixed(2));
  const effectiveDiscount = Number(Math.max(0, Math.min(discount, roundedSubtotal)).toFixed(2));
  const cartTotal = Number(Math.max(0, roundedSubtotal - effectiveDiscount).toFixed(2));
  const projectedGrossProfit = Number((cartTotal - cartTotalCost).toFixed(2));
  const profitMarginPercent = cartTotal > 0 ? ((projectedGrossProfit / cartTotal) * 100).toFixed(1) : '0.0';

  // Cash payment calculations
  const numericCashReceived = useMemo(() => {
    if (!cashReceivedInput.trim()) return 0;
    const val = parseFloat(cashReceivedInput);
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }, [cashReceivedInput]);

  const isCashEntered = cashReceivedInput.trim() !== '';
  const isPaymentSufficient = numericCashReceived >= cartTotal;
  const changeDue = Number(Math.max(0, numericCashReceived - cartTotal).toFixed(2));
  const remainingDue = Number(Math.max(0, cartTotal - numericCashReceived).toFixed(2));

  // Cart operations
  const addToCart = (product: Product) => {
    setErrorMessage(null);

    // Rule 1: Product must be active
    if (!product.active) {
      setErrorMessage(`Cannot add "${product.name}": Product is inactive.`);
      return;
    }

    // Rule 2: Product must have stock
    if (product.currentStock <= 0) {
      setErrorMessage(`Cannot add "${product.name}": Product is out of stock.`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const currentQtyInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    // Rule 3: Cannot exceed available stock
    if (currentQtyInCart + 1 > product.currentStock) {
      setErrorMessage(
        `Insufficient stock for "${product.name}". Available: ${product.currentStock}.`
      );
      return;
    }

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setErrorMessage(null);
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex === -1) return;

    const item = cart[existingIndex];
    const liveProd = products.find((p) => p.id === productId) || item.product;
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      setCart(cart.filter((i) => i.product.id !== productId));
      return;
    }

    if (newQty > liveProd.currentStock) {
      setErrorMessage(
        `Insufficient stock for "${liveProd.name}". Available: ${liveProd.currentStock}.`
      );
      return;
    }

    const updated = [...cart];
    updated[existingIndex].quantity = newQty;
    setCart(updated);
  };

  const handleDirectQuantityChange = (productId: string, rawVal: string) => {
    setErrorMessage(null);
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex === -1) return;

    const val = parseInt(rawVal, 10);
    const liveProd = products.find((p) => p.id === productId) || cart[existingIndex].product;

    if (isNaN(val) || val <= 0) {
      // If user clears input or types 0, remove or keep at 1 on blur
      if (rawVal === '') {
        const updated = [...cart];
        updated[existingIndex].quantity = 1;
        setCart(updated);
        return;
      }
      setCart(cart.filter((i) => i.product.id !== productId));
      return;
    }

    if (val > liveProd.currentStock) {
      setErrorMessage(
        `Cannot set quantity to ${val}. Insufficient stock for "${liveProd.name}". Available: ${liveProd.currentStock}.`
      );
      const updated = [...cart];
      updated[existingIndex].quantity = liveProd.currentStock;
      setCart(updated);
      return;
    }

    const updated = [...cart];
    updated[existingIndex].quantity = val;
    setCart(updated);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCashReceivedInput('');
    setSaleNotes('');
    setErrorMessage(null);
  };

  // Quick cash helpers
  const handleQuickExactCash = () => {
    setCashReceivedInput(cartTotal.toFixed(2));
  };

  const handleQuickDenomination = (amount: number) => {
    setCashReceivedInput(amount.toFixed(2));
  };

  const handleIncrementCash = (increment: number) => {
    const current = numericCashReceived > 0 ? numericCashReceived : cartTotal;
    setCashReceivedInput((current + increment).toFixed(2));
  };

  // Checkout execution
  const handleCheckout = () => {
    if (isProcessing) return;
    setErrorMessage(null);

    if (liveCart.length === 0) {
      setErrorMessage('Cannot process an empty cart.');
      return;
    }

    // Two-stage authoritative inventory re-validation
    for (const item of liveCart) {
      const liveProd = products.find((p) => p.id === item.product.id);
      if (!liveProd) {
        setErrorMessage(`Product "${item.product.name}" no longer exists in store catalog.`);
        return;
      }
      if (!liveProd.active) {
        setErrorMessage(`Cannot checkout: "${liveProd.name}" has been deactivated.`);
        return;
      }
      if (liveProd.currentStock <= 0) {
        setErrorMessage(`Cannot checkout: "${liveProd.name}" is out of stock.`);
        return;
      }
      if (liveProd.currentStock < item.quantity) {
        setErrorMessage(
          `Cannot checkout: Insufficient stock for "${liveProd.name}". Available: ${liveProd.currentStock}, Required: ${item.quantity}.`
        );
        return;
      }
    }

    // Validate cash payment
    const finalCash = isCashEntered ? numericCashReceived : cartTotal;
    if (finalCash < cartTotal) {
      setErrorMessage(
        `Insufficient payment. Remaining: ${store.currency} ${(cartTotal - finalCash).toFixed(2)}`
      );
      return;
    }

    // Prevent double submission
    setIsProcessing(true);

    try {
      const cashierSnapshot = StaffService.getCashierSnapshot(currentCashier);

      const sale = processSale(
        liveCart,
        {
          discount: effectiveDiscount,
          cashReceived: finalCash,
          paymentMethod: 'CASH',
          notes: saleNotes.trim() || undefined,
          customerId: selectedCustomer ? selectedCustomer.id : null,
          customerIdSnapshot: selectedCustomer ? selectedCustomer.id : undefined,
          customerNameSnapshot: selectedCustomer ? selectedCustomer.customerName : undefined,
          cashierIdSnapshot: cashierSnapshot.cashierIdSnapshot,
          cashierNameSnapshot: cashierSnapshot.cashierNameSnapshot,
        }
      );

      setCompletedSale(sale);
      clearCart();
      setSelectedCustomer(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered customers for member selection modal
  const selectableCustomers = useMemo(() => {
    const activeList = CustomerService.getActiveCustomers(customers);
    return CustomerService.searchCustomers(customerSearchQuery, activeList);
  }, [customers, customerSearchQuery]);

  // Today's recent sales (menggunakan perbandingan tarikh kalendar tempatan pengguna)
  const todaySales = useMemo(() => {
    const today = new Date();
    return sales.filter((s) => {
      if (s.status !== 'COMPLETED') return false;
      const d = new Date(s.dateTime);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [sales]);

  const scrollToCart = () => {
    const cartEl = document.getElementById('pos-cart-section');
    if (cartEl) {
      cartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {posMode === 'RESTAURANT' ? 'POS Restoran' : 'POS Runcit & Barcode'}
          </h1>
        </div>

        {/* Switcher Antara Mod Restoran & Mod Runcit (Data Lama Kekal Terpelihara) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 shadow-2xs">
            <button
              type="button"
              id="switch-to-restaurant-pos-btn"
              onClick={() => setPosMode('RESTAURANT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                posMode === 'RESTAURANT'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Restoran</span>
            </button>
            <button
              type="button"
              id="switch-to-retail-pos-btn"
              onClick={() => setPosMode('RETAIL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                posMode === 'RETAIL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>POS Runcit</span>
            </button>
          </div>
          {store.settings?.enableStaff !== false && activeCashiers.length > 0 ? (
            <div
              id="pos-cashier-container"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-700 shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-stone-500">Cashier:</span>
              <select
                id="pos-cashier-select"
                value={selectedCashierValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'store-owner' || !val) {
                    setActiveStaff(null);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_CASHIER_ID, 'store-owner');
                  } else {
                    const found = activeCashiers.find((s) => s.id === val);
                    if (found) {
                      setActiveStaff(found);
                      localStorage.setItem(STORAGE_KEYS.ACTIVE_CASHIER_ID, found.id);
                    }
                  }
                }}
                className="bg-transparent font-semibold text-stone-900 border-none focus:outline-none cursor-pointer"
              >
                <option value="store-owner">Store Owner</option>
                {activeCashiers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.staffCode || s.userCode})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div
              id="pos-cashier-container"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-700 shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-stone-500">Cashier:</span>
              <span id="pos-cashier-label" className="font-semibold text-stone-900">
                Store Owner
              </span>
            </div>
          )}

          <button
            type="button"
            id="recent-receipts-btn"
            onClick={() => setShowRecentSalesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 shadow-2xs transition"
          >
            <History className="w-3.5 h-3.5 text-stone-500" />
            <span>Recent Receipts</span>
            {todaySales.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-700 text-white text-[10px] font-mono font-bold">
                {todaySales.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error / Alert Banner */}
      {errorMessage && (
        <div
          id="pos-error-banner"
          className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-rose-800 shadow-2xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-[11px] underline shrink-0 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Paparan POS Mengikut Mod Terpilih (Restoran Fasa 2 vs Runcit Tradisional) */}
      {posMode === 'RESTAURANT' ? (
        <RestaurantPosView />
      ) : (
        /* Main Two-Column POS Layout (Retail) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Product Selection Grid (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Search bar & Category chips */}
          <div className="order-2 lg:order-1 sticky bottom-2 lg:top-2 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border-2 border-emerald-500/40 shadow-lg shadow-stone-900/5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pos-search-input" className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 tracking-wide uppercase">
                <Barcode className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Carian & Imbasan Barcode</span>
                <span className="sm:hidden">Carian Barcode</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-stone-500 hidden md:inline">
                  {filteredProducts.length} produk sedia ada
                </span>
                <button
                  type="button"
                  id="pos-direct-to-cart-btn"
                  onClick={scrollToCart}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border ${
                    liveCart.length > 0
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 shadow-emerald-700/20 active:scale-95'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                  }`}
                  title="Terus ke Troli & Checkout"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Ke Troli</span>
                  {liveCart.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white text-emerald-800 text-[10px] font-mono font-black">
                      {liveCart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input
                id="pos-search-input"
                type="text"
                placeholder="Scan barcode or search by product name / SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = searchQuery.trim().toLowerCase();
                    if (!trimmed) return;
                    const exactMatch = filteredProducts.find(
                      (p) => p.sku.toLowerCase() === trimmed || p.name.toLowerCase() === trimmed
                    );
                    if (exactMatch && exactMatch.currentStock > 0) {
                      addToCart(exactMatch);
                      setSearchQuery('');
                    } else if (filteredProducts.length === 1 && filteredProducts[0].currentStock > 0) {
                      addToCart(filteredProducts[0]);
                      setSearchQuery('');
                    }
                  }
                }}
                className="w-full pl-11 pr-24 py-3 text-sm sm:text-base font-medium rounded-xl border-2 border-emerald-500 bg-emerald-50/20 text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 focus:bg-white shadow-xs transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-semibold px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 rounded-md select-none">
                    <Barcode className="w-3.5 h-3.5" /> Scan / Cari
                  </span>
                )}
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categories.map((cat, idx) => {
                const isSelected = selectedCategory === cat;
                const catPastel = cat === 'ALL' ? null : getCategoryPastelTheme(cat);
                const buttonId = `category-filter-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                return (
                  <button
                    key={cat}
                    id={buttonId}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap font-semibold transition text-xs flex items-center gap-1.5 shadow-2xs ${
                      isSelected
                        ? catPastel
                          ? `bg-emerald-700 text-white ring-2 ring-emerald-600 shadow-xs`
                          : 'bg-emerald-700 text-white shadow-xs'
                        : catPastel
                        ? `${catPastel.cardBg} ${catPastel.badgeText} border ${catPastel.badgeBorder} hover:brightness-95 hover:shadow-xs`
                        : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    {catPastel && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-white' : `${catPastel.badgeBg} border ${catPastel.cardBorder}`
                        }`}
                      />
                    )}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Catalog Cards Grid & Empty States Container */}
          <div className="order-1 lg:order-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredProducts.map((product) => {
                const inStock = product.currentStock > 0;
                const cartItem = liveCart.find((i) => i.product.id === product.id);
                const qtyInCart = cartItem ? cartItem.quantity : 0;
                const isLowStock = InventoryService.isLowStock(product);
                const unitProfit = Number((product.sellingPrice - product.costPrice).toFixed(2));
                const pastel = getCategoryPastelTheme(product.category);

                return (
                  <div
                    key={product.id}
                    id={`product-card-${product.id}`}
                    title={`${product.name} (SKU: ${product.sku} | ${product.category})`}
                    onClick={() => {
                      if (inStock) addToCart(product);
                    }}
                    className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between transition text-left select-none relative shadow-2xs ${
                      !inStock
                        ? 'opacity-60 border-stone-200 cursor-not-allowed bg-stone-50'
                        : `${pastel.cardBg} ${pastel.cardBorder} ${pastel.hoverBorder} ${pastel.hoverBg} hover:shadow-xs cursor-pointer active:scale-98`
                    }`}
                  >
                    {/* Badge showing quantity in active ticket */}
                    {qtyInCart > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-xs z-10 ring-2 ring-white">
                        {qtyInCart}
                      </span>
                    )}

                    <div>
                      {/* Product Image / Retail Thumbnail */}
                      <div className="w-full h-28 sm:h-32 mb-2.5 rounded-xl overflow-hidden bg-white border border-stone-200/70 p-2 relative flex items-center justify-center shadow-2xs">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="max-h-full max-w-full object-contain transition-transform duration-200 hover:scale-105"
                          />
                        ) : (
                          <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center p-2 ${pastel.cardBg}`}>
                            <img
                              src={NIAGAPOS_ASSETS.logoSvg}
                              alt="NiagaPOS"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
                              }}
                              className="w-8 h-8 object-contain opacity-60"
                            />
                            <span className="text-[10px] text-stone-400 font-medium mt-1">NiagaPOS</span>
                          </div>
                        )}
                      </div>

                      {/* Category & SKU kept accessible in DOM for search/filtering functions */}
                      <span className="sr-only" data-category={product.category}>
                        {product.category}
                      </span>
                      <span className="sr-only" data-sku={product.sku}>
                        {product.sku}
                      </span>

                      <h4 className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2 leading-snug min-h-[2rem]">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-end justify-between gap-1">
                      <div>
                        <div className="text-sm sm:text-base font-bold font-mono text-stone-900">
                          {store.currency} {product.sellingPrice.toFixed(2)}
                        </div>
                        <div className={`text-[10px] font-semibold ${pastel.profitText}`}>
                          +{store.currency} {unitProfit.toFixed(2)} untung
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {!inStock ? (
                          <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            Habis Stok
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${
                              isLowStock
                                ? 'bg-amber-100/90 text-amber-900 border border-amber-300/80 font-bold animate-pulse'
                                : 'text-stone-700 bg-white border border-stone-200 shadow-2xs'
                            }`}
                          >
                            {product.currentStock} baki
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeProducts.length === 0 ? (
              <div id="pos-empty-active-state" className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-400 text-xs shadow-2xs">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="font-semibold text-stone-700 text-sm">No active products available for sale.</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Activate products in the Products catalog to enable them for POS sales.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div id="pos-no-match-state" className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-400 text-xs shadow-2xs">
                <Search className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="font-semibold text-stone-600">No matching products found</p>
                <p className="text-[11px] text-stone-400 mt-1">Try modifying your search or selecting a different category.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column: Active Order Ticket & Checkout (5 cols) */}
        <div id="pos-cart-section" className="lg:col-span-5 space-y-4 scroll-mt-6">
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs flex flex-col overflow-hidden">
            {/* Ticket Header */}
            <div className="p-4 border-b border-stone-200/80 flex items-center justify-between bg-stone-50/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800">
                  <ShoppingBag className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Active Cart ({liveCart.reduce((a, b) => a + b.quantity, 0)} items)
                </h3>
              </div>
              {liveCart.length > 0 && (
                <button
                  type="button"
                  id="pos-clear-ticket-btn"
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
                >
                  Clear Ticket
                </button>
              )}
            </div>

            {/* Customer Attribution (Optional Module) */}
            {store.settings?.enableCustomers !== false && (
              <div className="px-4 py-2.5 bg-stone-50/90 border-b border-stone-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded-md ${
                      selectedCustomer
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-200/80 text-stone-600'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {selectedCustomer ? selectedCustomer.customerName : 'Walk-in Customer'}
                    </div>
                    <div className="text-[10px] text-stone-500 flex items-center gap-1.5 font-mono">
                      {selectedCustomer ? (
                        <>
                          <span>{selectedCustomer.customerCode}</span>
                          {store.settings?.enableLoyalty !== false && (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-sans">
                              {LoyaltyService.calculatePointsBalance(selectedCustomer.id, loyaltyLedger)} pts
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-sans text-stone-400">Default • No member attached</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {selectedCustomer && (
                    <button
                      type="button"
                      id="pos-remove-customer-btn"
                      onClick={() => setSelectedCustomer(null)}
                      className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200/60 transition"
                      title="Clear customer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    id="pos-attach-customer-btn"
                    onClick={() => {
                      setCustomerSearchQuery('');
                      setShowCustomerModal(true);
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 shadow-2xs transition"
                  >
                    {selectedCustomer ? 'Change' : 'Attach Member'}
                  </button>
                </div>
              </div>
            )}

            {/* Ticket Line Items */}
            <div className="p-4 overflow-y-auto max-h-[320px] divide-y divide-stone-100">
              {liveCart.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  <p className="font-semibold text-stone-700">Ticket is empty</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Click products from the catalog to ring up a sale.
                  </p>
                </div>
              ) : (
                liveCart.map((item) => {
                  const lineTotal = item.quantity * item.product.sellingPrice;
                  const lineCost = item.quantity * item.product.costPrice;
                  const lineProfit = lineTotal - lineCost;

                  return (
                    <div key={item.product.id} className="py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-stone-900 leading-snug break-words">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                            {item.product.sku && <span className="mr-1.5 font-sans text-stone-500">[{item.product.sku}]</span>}
                            <span>{store.currency} {item.product.sellingPrice.toFixed(2)} each</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold font-mono text-stone-900">
                            {store.currency} {lineTotal.toFixed(2)}
                          </span>
                          <div className="text-[10px] text-emerald-700 font-mono">
                            +{store.currency} {lineProfit.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Stepper + Manual Quantity Input */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 rounded text-stone-600 hover:bg-white hover:text-stone-900 transition"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            min="1"
                            max={item.product.currentStock}
                            value={item.quantity}
                            onChange={(e) => handleDirectQuantityChange(item.product.id, e.target.value)}
                            className="w-12 text-center text-xs font-mono font-bold bg-white rounded border border-stone-200 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />

                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 rounded text-stone-600 hover:bg-white hover:text-stone-900 transition"
                            title="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400 font-mono">
                            Avail: {item.product.currentStock}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-stone-400 hover:text-rose-600 p-1 transition"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Financial Summary & Calculations */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
              {/* Optional Discount Input */}
              {liveCart.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-stone-200">
                  <span className="text-stone-600 font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-stone-400" />
                    <span>Cart Discount ({store.currency})</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    max={roundedSubtotal}
                    value={discount || ''}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (val > roundedSubtotal) {
                        setErrorMessage(`Discount cannot exceed cart subtotal (${store.currency} ${roundedSubtotal.toFixed(2)})`);
                        setDiscount(roundedSubtotal);
                      } else {
                        setErrorMessage(null);
                        setDiscount(Math.max(0, val));
                      }
                    }}
                    className="w-24 px-2 py-1 text-right text-xs rounded border border-stone-300 font-mono font-bold focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Cost & Subtotal Breakdown */}
              <div className="space-y-1.5 text-xs text-stone-600 pt-1">
                <div className="flex justify-between">
                  <span>Cart Subtotal:</span>
                  <span className="font-mono text-stone-900 font-semibold">
                    {store.currency} {roundedSubtotal.toFixed(2)}
                  </span>
                </div>

                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>Discount Applied:</span>
                    <span className="font-mono">
                      -{store.currency} {effectiveDiscount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total Amount Due:</span>
                  <span className="font-mono text-emerald-800 text-lg">
                    {store.currency} {cartTotal.toFixed(2)}
                  </span>
                </div>

                {/* Live Gross Profit Preview for Cashier / Owner */}
                {liveCart.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-dashed border-stone-300 flex items-center justify-between text-[11px] text-stone-500">
                    <span>
                      COGS: {store.currency} {cartTotalCost.toFixed(2)}
                    </span>
                    <span className="font-semibold text-emerald-800">
                      Profit: {store.currency} {projectedGrossProfit.toFixed(2)} ({profitMarginPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Cash Payment Section (Section 12, 13) */}
              {liveCart.length > 0 && (
                <div className="pt-3 border-t border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Cash Tendered ({store.currency})</span>
                    </span>
                    <span className="text-[11px] text-stone-400 font-normal">
                      Cash Only
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-stone-400 text-xs">
                      {store.currency}
                    </span>
                    <input
                      id="pos-cash-input"
                      type="number"
                      min={0}
                      step="0.50"
                      placeholder={cartTotal.toFixed(2)}
                      value={cashReceivedInput}
                      onChange={(e) => {
                        setCashReceivedInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="w-full pl-10 pr-3 py-2 text-sm font-mono font-bold rounded-lg border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>

                  {/* Quick Cash Buttons for Cashier Speed */}
                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      id="quick-cash-exact"
                      onClick={handleQuickExactCash}
                      className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded border border-emerald-200 transition"
                    >
                      Exact
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDenomination(10)}
                      className="py-1.5 px-2 bg-white hover:bg-stone-100 text-stone-700 font-mono font-semibold rounded border border-stone-200 transition"
                    >
                      RM10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDenomination(20)}
                      className="py-1.5 px-2 bg-white hover:bg-stone-100 text-stone-700 font-mono font-semibold rounded border border-stone-200 transition"
                    >
                      RM20
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDenomination(50)}
                      className="py-1.5 px-2 bg-white hover:bg-stone-100 text-stone-700 font-mono font-semibold rounded border border-stone-200 transition"
                    >
                      RM50
                    </button>
                  </div>

                  {/* Increments */}
                  <div className="flex gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleIncrementCash(1)}
                      className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded transition"
                    >
                      +RM1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIncrementCash(5)}
                      className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded transition"
                    >
                      +RM5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIncrementCash(10)}
                      className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded transition"
                    >
                      +RM10
                    </button>
                  </div>

                  {/* Change / Shortage Status Display */}
                  {isCashEntered && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                        isPaymentSufficient
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <span className="font-sans font-semibold">
                        {isPaymentSufficient ? 'Change Due:' : 'Insufficient Payment:'}
                      </span>
                      <span className="font-bold text-sm">
                        {isPaymentSufficient
                          ? `${store.currency} ${changeDue.toFixed(2)}`
                          : `Remaining: ${store.currency} ${remainingDue.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {/* Sale Notes / Reference */}
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Optional notes / customer ref..."
                      value={saleNotes}
                      onChange={(e) => setSaleNotes(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded border border-stone-200 bg-white placeholder:text-stone-400"
                    />
                  </div>
                </div>
              )}

              {/* Checkout Action Button with Double Submission Protection */}
              <button
                type="button"
                id="pos-checkout-btn"
                disabled={
                  liveCart.length === 0 ||
                  isProcessing ||
                  (isCashEntered && !isPaymentSufficient)
                }
                onClick={handleCheckout}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 select-none"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      Complete Sale ({store.currency} {cartTotal.toFixed(2)})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Completed Sale Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          isOpen={!!completedSale}
          onClose={() => setCompletedSale(null)}
          sale={completedSale}
          store={store}
          isNewSaleSuccess={true}
        />
      )}

      {/* Re-print / View Past Sale Receipt Modal */}
      {viewHistorySale && (
        <ReceiptModal
          isOpen={!!viewHistorySale}
          onClose={() => setViewHistorySale(null)}
          sale={viewHistorySale}
          store={store}
          isNewSaleSuccess={false}
        />
      )}

      {/* Recent Receipts Modal */}
      {showRecentSalesModal && (
        <Modal
          id="recent-sales-modal"
          isOpen={showRecentSalesModal}
          onClose={() => setShowRecentSalesModal(false)}
          title="Today's Sales & Receipts"
          subtitle={`${todaySales.length} transaction(s) recorded today • ${store.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {todaySales.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="font-semibold text-stone-700">No sales recorded today yet</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Completed transactions will be accessible here for immediate viewing and reprinting.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200 max-h-[380px] overflow-y-auto">
                {todaySales.map((s) => (
                  <div
                    key={s.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900">
                          {s.transactionNumber}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(s.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {s.items.length} line item(s) • Method: {s.paymentMethod || 'CASH'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-stone-900">
                          {store.currency} {s.total.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-mono">
                          +{store.currency} {s.grossProfit.toFixed(2)} profit
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setViewHistorySale(s);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-medium text-xs flex items-center gap-1 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-stone-500" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowRecentSalesModal(false)}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <Modal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          title="Select Customer / Member"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Search by customer name, code (e.g. CUS-000001), or phone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                {selectableCustomers.length} active customer(s) found
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowCustomerModal(false);
                }}
                className="text-xs text-stone-500 hover:text-stone-900 font-medium underline"
              >
                Reset to Walk-in
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
              {selectableCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <User className="w-6 h-6 mx-auto mb-1 text-stone-300" />
                  <p className="font-semibold text-stone-600">No matching active customers</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">Try searching with different keywords.</p>
                </div>
              ) : (
                selectableCustomers.map((cust) => {
                  const balance = LoyaltyService.calculatePointsBalance(cust.id, loyaltyLedger);
                  const isSelected = selectedCustomer?.id === cust.id;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setShowCustomerModal(false);
                      }}
                      className={`p-3 flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-50/80 hover:bg-emerald-50'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">
                            {cust.customerName}
                          </span>
                          <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                            {cust.customerCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {cust.phone ? `Phone: ${cust.phone}` : 'No phone number'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {store.settings?.enableLoyalty !== false && (
                          <div className="text-right">
                            <span className="text-xs font-bold font-mono text-emerald-800">
                              {balance} pts
                            </span>
                            <div className="text-[9px] text-stone-400">Balance</div>
                          </div>
                        )}
                        <button
                          type="button"
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition ${
                            isSelected
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
