import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { RestaurantOrderItem } from '../../types/restaurant';
import { Search, X, Package, Plus, Check, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../services/formatters';

interface RetailItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentCartItems: RestaurantOrderItem[];
  onSelectProduct: (product: Product) => void;
}

export const RetailItemPickerModal: React.FC<RetailItemPickerModalProps> = ({
  isOpen,
  onClose,
  products,
  currentCartItems,
  onSelectProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });
  }, [products, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Pilih Item Runcit (NiagaPOS)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                  Cross-Suite SES v4.5
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Pilih barangan runcit untuk dimasukkan ke dalam bil pesanan restoran ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3 border-b border-stone-800 bg-stone-900/50 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="retail-picker-search"
              placeholder="Cari produk runcit mengikut nama, SKU, atau kod bar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-blue-500"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer text-[11px] ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product List Grid */}
        <div className="p-3.5 flex-1 overflow-y-auto min-h-[250px]">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              Tiada produk runcit ditemui untuk carian &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredProducts.map((product) => {
                const inCart = currentCartItems.find(
                  (it) => it.itemType === 'RETAIL' && (it.retailProductId === product.id || it.retailSku === product.sku)
                );
                const currentCartQty = inCart ? inCart.quantity : 0;
                const remainingStock = Math.max(0, product.currentStock - currentCartQty);
                const isOutOfStock = remainingStock <= 0;
                const isInactive = product.active === false;

                return (
                  <div
                    key={product.id}
                    className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                      isInactive
                        ? 'bg-stone-950/40 border-stone-900 opacity-50'
                        : isOutOfStock
                        ? 'bg-stone-950/60 border-stone-800/80 opacity-70'
                        : inCart
                        ? 'bg-blue-950/20 border-blue-600/40 hover:border-blue-500'
                        : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                          {product.sku}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isInactive ? (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-900 px-1.5 py-0.5 rounded">
                              Tidak Aktif
                            </span>
                          ) : isOutOfStock ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-900 px-1.5 py-0.5 rounded">
                              Habis Stok
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded">
                              Baki: {remainingStock} unit
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-2">
                        {product.name}
                      </h4>
                      {product.category && (
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {product.category}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-blue-400 font-mono">
                          {formatCurrency(product.sellingPrice)}
                        </span>
                        {product.costPrice > 0 && (
                          <span className="text-[10px] text-stone-500 ml-1.5">
                            (Kos: {formatCurrency(product.costPrice)})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isInactive || isOutOfStock}
                        onClick={() => onSelectProduct(product)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isInactive || isOutOfStock
                            ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                            : inCart
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                            : 'bg-stone-800 hover:bg-blue-600 text-stone-200 hover:text-white'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Tambah ({currentCartQty})</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Pilih</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-800 bg-stone-950 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
            <span>Stok ditolak secara automatik daripada inventori NiagaPOS apabila bil selesai dibayar.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded-xl transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
