/**
 * NiagaPOS - Search-First Product Picker
 * Targeted UX enhancement for Purchase Order Module
 * 
 * Features:
 * - Search by product name or SKU (case-insensitive, whitespace trimmed)
 * - Dynamic matching results display with Name, SKU, Current Stock, Cost Price
 * - "Tiada produk sepadan." empty state when no match is found
 * - Optional "Produk Baru Dibeli" section based on real purchase history
 * - Full keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Click outside detection
 * - Mobile and desktop responsive design
 * - Preserves Active-only product eligibility
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Check, Package, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency } from '../../services/formatters';

export interface ProductSearchPickerProps {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product) => void;
  onClearProduct: () => void;
  currency: string;
  recentlyPurchasedProducts?: Product[];
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
}

export const ProductSearchPicker: React.FC<ProductSearchPickerProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  onClearProduct,
  currency,
  recentlyPurchasedProducts = [],
  disabled = false,
  placeholder = 'Cari nama produk atau SKU...',
  hasError = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Synchronize input text with selected product or search query
  useEffect(() => {
    if (selectedProduct) {
      setSearchQuery(selectedProduct.name);
    } else {
      setSearchQuery('');
    }
  }, [selectedProduct]);

  // Cleaned search term: trimmed and lowercase
  const cleanTerm = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Filter active products dynamically based on search query
  const matchingProducts = useMemo(() => {
    // If the input text currently equals the selected product name and dropdown is not actively searching with new characters,
    // show active products or matches
    if (!cleanTerm) {
      return products;
    }

    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(cleanTerm);
      const skuMatch = p.sku.toLowerCase().includes(cleanTerm);
      const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(cleanTerm) : false;
      return nameMatch || skuMatch || barcodeMatch;
    });
  }, [products, cleanTerm]);

  // Filter recent products that are active and match query if any
  const filteredRecentProducts = useMemo(() => {
    if (!recentlyPurchasedProducts || recentlyPurchasedProducts.length === 0) return [];
    if (!cleanTerm) return recentlyPurchasedProducts;
    return recentlyPurchasedProducts.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(cleanTerm);
      const skuMatch = p.sku.toLowerCase().includes(cleanTerm);
      return nameMatch || skuMatch;
    });
  }, [recentlyPurchasedProducts, cleanTerm]);

  // Flatten items for keyboard navigation:
  // When no query is typed, we have recent products (if any) and active products (excluding duplicates)
  const displayItems = useMemo(() => {
    if (cleanTerm) {
      return matchingProducts;
    }
    // When cleanTerm is empty:
    if (filteredRecentProducts.length > 0) {
      const recentIds = new Set(filteredRecentProducts.map((p) => p.id));
      const remaining = products.filter((p) => !recentIds.has(p.id));
      return [...filteredRecentProducts, ...remaining];
    }
    return products;
  }, [cleanTerm, matchingProducts, filteredRecentProducts, products]);

  // Reset highlighted index when display items change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [displayItems.length, isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If user closed without selecting and we had a selected product, restore input text
        if (selectedProduct) {
          setSearchQuery(selectedProduct.name);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, selectedProduct]);

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const highlightedEl = listboxRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      ) as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setSearchQuery(product.name);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onClearProduct();
    setSearchQuery('');
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    // If a product is already selected, select all text so typing replaces it immediately
    if (selectedProduct && inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!isOpen) {
      setIsOpen(true);
    }
    // If user edited the input away from the selected product, clear current selection
    if (selectedProduct && val !== selectedProduct.name) {
      onClearProduct();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < displayItems.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(displayItems.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : displayItems.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && displayItems[highlightedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(displayItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      if (selectedProduct) {
        setSearchQuery(selectedProduct.name);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" id="purchase-product-picker-container">
      {/* Search Input Box */}
      <div
        className={`relative flex items-center bg-stone-50 border rounded-lg transition ${
          hasError
            ? 'border-rose-400 ring-2 ring-rose-200'
            : isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-white'
            : 'border-stone-200 hover:border-stone-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="pl-3 pr-1 text-stone-400 flex items-center pointer-events-none">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          id="purchase-product-search-input"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="purchase-product-listbox"
          aria-autocomplete="list"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full py-1.5 px-2 text-xs bg-transparent focus:outline-hidden text-stone-900 placeholder:text-stone-400 font-medium"
        />

        {/* Selected Product Badge / Clear Button */}
        <div className="flex items-center gap-1 pr-2 shrink-0">
          {selectedProduct ? (
            <div className="flex items-center gap-1">
              <span className="hidden sm:inline-flex text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                {selectedProduct.sku}
              </span>
              <button
                type="button"
                id="clear-selected-product-btn"
                onClick={handleClear}
                title="Tukar / Padam produk yang dipilih"
                className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : searchQuery.length > 0 ? (
            <button
              type="button"
              id="clear-search-query-btn"
              onClick={() => {
                setSearchQuery('');
                if (inputRef.current) inputRef.current.focus();
              }}
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="p-1 text-stone-400 hover:text-stone-600 transition"
              tabIndex={-1}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Selected Product Confirmation Info (shown right beneath the input when selected and dropdown is closed) */}
      {selectedProduct && !isOpen && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500 bg-emerald-50/70 border border-emerald-200/80 px-2.5 py-1 rounded-md">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="font-mono text-stone-700 font-semibold">{selectedProduct.sku}</span>
            <span className="text-stone-400">•</span>
            <span>Stok Semasa: <strong className="text-stone-800">{selectedProduct.currentStock}</strong></span>
          </div>
          <span className="font-mono text-emerald-800 font-bold ml-2 shrink-0">
            {formatCurrency(selectedProduct.costPrice, currency)}
          </span>
        </div>
      )}

      {/* Search-First Dropdown Listbox */}
      {isOpen && (
        <div
          ref={listboxRef}
          id="purchase-product-listbox"
          role="listbox"
          className="absolute left-0 top-full mt-1 w-full sm:w-[420px] max-w-[92vw] z-40 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Section 1: Empty State */}
          {cleanTerm && matchingProducts.length === 0 ? (
            <div className="p-5 text-center" id="purchase-product-no-match">
              <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                <Search className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-stone-800">Tiada produk sepadan.</p>
              <p className="text-[11px] text-stone-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                Tiada produk aktif dengan nama atau SKU &ldquo;<span className="text-stone-600 font-medium">{searchQuery.trim()}</span>&rdquo;. Sila cuba carian lain.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-stone-100">
              {/* Optional Section: Recently Purchased Products (Only when query is empty and records exist) */}
              {!cleanTerm && filteredRecentProducts.length > 0 && (
                <div className="bg-stone-50/80">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 border-b border-stone-200/60">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>Produk Baru Dibeli (Recently Purchased)</span>
                  </div>
                  {filteredRecentProducts.map((p, idx) => {
                    const isSelected = selectedProductId === p.id;
                    const isHighlighted = highlightedIndex === idx;

                    return (
                      <button
                        type="button"
                        role="option"
                        key={`recent-${p.id}`}
                        data-index={idx}
                        aria-selected={isSelected}
                        onClick={() => handleSelect(p)}
                        className={`w-full text-left px-3 py-2.5 transition flex items-center justify-between gap-3 cursor-pointer ${
                          isHighlighted
                            ? 'bg-emerald-100/70 text-emerald-950'
                            : isSelected
                            ? 'bg-emerald-50/90 text-emerald-900'
                            : 'hover:bg-emerald-50/50 text-stone-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-stone-900 truncate">
                              {p.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-stone-600 bg-white border border-stone-200 px-1 py-0.2 rounded text-[10px]">
                              {p.sku}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span>
                              Current Stock:{' '}
                              <strong className={p.currentStock <= p.minimumStock ? 'text-amber-700' : 'text-stone-700'}>
                                {p.currentStock}
                              </strong>
                            </span>
                            {p.currentStock <= p.minimumStock && (
                              <span className="text-[9px] font-semibold text-amber-800 bg-amber-100/80 px-1 rounded">
                                Rendah
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-mono font-bold text-emerald-800">
                            {formatCurrency(p.costPrice, currency)}
                          </div>
                          <div className="text-[10px] text-stone-400">Kos Asal</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main Matching Products List */}
              <div>
                {!cleanTerm && filteredRecentProducts.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-50/80 border-b border-stone-200/60">
                    Semua Produk Aktif ({products.length})
                  </div>
                )}

                {matchingProducts.map((p, idx) => {
                  // If recent products header is shown and query is empty, calculate offset index
                  const actualIndex =
                    !cleanTerm && filteredRecentProducts.length > 0
                      ? filteredRecentProducts.length + idx
                      : idx;
                  const isSelected = selectedProductId === p.id;
                  const isHighlighted = highlightedIndex === actualIndex;

                  return (
                    <button
                      type="button"
                      role="option"
                      key={p.id}
                      data-index={actualIndex}
                      aria-selected={isSelected}
                      onClick={() => handleSelect(p)}
                      className={`w-full text-left px-3 py-2.5 transition flex items-center justify-between gap-3 border-b border-stone-100 last:border-b-0 cursor-pointer ${
                        isHighlighted
                          ? 'bg-emerald-100/70 text-emerald-950'
                          : isSelected
                          ? 'bg-emerald-50/90 text-emerald-900'
                          : 'hover:bg-stone-50 text-stone-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-stone-900 truncate">
                            {p.name}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-stone-600 bg-stone-100 px-1 py-0.2 rounded text-[10px]">
                            {p.sku}
                          </span>
                          <span className="text-stone-300">•</span>
                          <span>
                            Current Stock:{' '}
                            <strong className={p.currentStock <= p.minimumStock ? 'text-amber-700' : 'text-stone-700'}>
                              {p.currentStock}
                            </strong>
                          </span>
                          {p.currentStock <= p.minimumStock && (
                            <span className="text-[9px] font-semibold text-amber-800 bg-amber-100/80 px-1 rounded">
                              Rendah
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-mono font-bold text-emerald-800">
                          {formatCurrency(p.costPrice, currency)}
                        </div>
                        <div className="text-[10px] text-stone-400">Kos Asal</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer note indicating active only constraint */}
          <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between text-[10px] text-stone-500">
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <Package className="w-3 h-3" />
              <span>Hanya Produk Aktif (Active Only)</span>
            </span>
            <span className="text-stone-400 font-mono">
              {matchingProducts.length} produk
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
