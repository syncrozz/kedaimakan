import React, { useState } from 'react';
import { MenuItem, MenuModifierGroup, KitchenStation } from '../../types/restaurant';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, UtensilsCrossed, X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../services/formatters';

interface MenuManagementModalProps {
  isOpen: boolean;
  menuItems: MenuItem[];
  categories: string[];
  onClose: () => void;
  onSaveItem: (itemData: Partial<MenuItem> & { name: string; price: number; category: string }) => void;
  onDeleteItem: (id: string) => void;
  onToggleAvailability: (id: string) => void;
}

export const MenuManagementModal: React.FC<MenuManagementModalProps> = ({
  isOpen,
  menuItems,
  categories,
  onClose,
  onSaveItem,
  onDeleteItem,
  onToggleAvailability,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'LIST' | 'FORM'>('LIST');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Form states
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Makanan Utama');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [kitchenStation, setKitchenStation] = useState<KitchenStation>('KITCHEN');
  const [modifierGroups, setModifierGroups] = useState<MenuModifierGroup[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const startAddNew = () => {
    setEditingItem(null);
    setCode(`M${menuItems.length + 1}`);
    setName('');
    setCategory(categories[0] || 'Makanan Utama');
    setNewCategoryName('');
    setPrice('');
    setCostPrice('');
    setDescription('');
    setKitchenStation('KITCHEN');
    setModifierGroups([]);
    setFormError(null);
    setActiveTab('FORM');
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setCategory(item.category);
    setNewCategoryName('');
    setPrice(item.price.toString());
    setCostPrice(item.costPrice?.toString() || '');
    setDescription(item.description || '');
    setKitchenStation(item.kitchenStation || 'KITCHEN');
    setModifierGroups(item.modifierGroups ? JSON.parse(JSON.stringify(item.modifierGroups)) : []);
    setFormError(null);
    setActiveTab('FORM');
  };

  const handleSave = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Sila masukkan nama hidangan.');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Sila masukkan harga hidangan yang sah.');
      return;
    }

    const finalCategory = newCategoryName.trim() ? newCategoryName.trim() : category;

    onSaveItem({
      id: editingItem?.id,
      code: code.trim(),
      name: name.trim(),
      category: finalCategory,
      price: parsedPrice,
      costPrice: parseFloat(costPrice) || 0,
      description: description.trim(),
      kitchenStation,
      modifierGroups,
      isAvailable: editingItem ? editingItem.isAvailable : true,
    });

    setActiveTab('LIST');
  };

  // Helper untuk Modifier Groups
  const addModifierGroup = () => {
    const newGroup: MenuModifierGroup = {
      id: `group-${Date.now()}`,
      name: 'Kumpulan Pilihan Baharu',
      minSelection: 0,
      maxSelection: 1,
      options: [
        { id: `opt-${Date.now()}-1`, name: 'Pilihan 1', price: 0 },
      ],
    };
    setModifierGroups([...modifierGroups, newGroup]);
  };

  const removeModifierGroup = (groupId: string) => {
    setModifierGroups(modifierGroups.filter(g => g.id !== groupId));
  };

  const addOptionToGroup = (groupId: string) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: [
            ...g.options,
            { id: `opt-${Date.now()}`, name: 'Pilihan Baharu', price: 0 },
          ],
        };
      }
      return g;
    }));
  };

  const filteredItems = menuItems.filter(item => {
    if (filterCategory === 'ALL') return true;
    return item.category === filterCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        id="menu-management-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Pengurusan Menu Restoran (Fasa 2)</h3>
              <p className="text-xs text-stone-400">
                Urus hidangan, kumpulan modifier/variasi, dan kawal ketersediaan menu secara manual.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Nav & Actions */}
        <div className="px-4 py-3 bg-stone-950/40 border-b border-stone-800/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'LIST'
                  ? 'bg-emerald-600 text-white'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              Senarai Menu ({menuItems.length})
            </button>
            <button
              type="button"
              onClick={startAddNew}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'FORM' && !editingItem
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-800/60 text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Hidangan Baharu</span>
            </button>
          </div>

          {activeTab === 'LIST' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400">Kategori:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'LIST' ? (
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  Tiada hidangan dalam senarai. Klik "Tambah Hidangan Baharu" untuk memulakan.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredItems.map(item => (
                    <div
                      key={item.id}
                      className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-stone-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded">
                                {item.code}
                              </span>
                              <h4 className="text-xs font-bold text-white">{item.name}</h4>
                            </div>
                            <p className="text-[11px] text-stone-400 mt-0.5">
                              {item.category} &bull; Stesen: <span className="text-stone-300 font-medium">{item.kitchenStation}</span>
                            </p>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-emerald-400">{formatCurrency(item.price)}</span>
                            {item.costPrice > 0 && (
                              <div className="text-[10px] text-stone-500">Kos: {formatCurrency(item.costPrice)}</div>
                            )}
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-stone-400 line-clamp-2 mt-1.5">
                            {item.description}
                          </p>
                        )}

                        {item.modifierGroups && item.modifierGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.modifierGroups.map(g => (
                              <span key={g.id} className="text-[10px] bg-stone-800/80 text-stone-300 px-1.5 py-0.5 rounded border border-stone-700/50">
                                {g.name} ({g.options.length})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bar Kawalan Bawah: Ketersediaan Manual & Edit */}
                      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-stone-800/60">
                        <button
                          type="button"
                          onClick={() => onToggleAvailability(item.id)}
                          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          {item.isAvailable ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Tersedia</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Habis (Sold Out)</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
                            title="Kemaskini Menu"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Adakah anda pasti mahu memadam hidangan "${item.name}"?`)) {
                                onDeleteItem(item.id);
                              }
                            }}
                            className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg hover:bg-stone-800 transition-colors"
                            title="Padam Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Paparan Form Tambah / Kemaskini Menu */
            <div className="space-y-4 max-w-2xl mx-auto">
              {formError && (
                <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-2.5 flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Kod Hidangan</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Cth: M01"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Nama Hidangan *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Cth: Nasi Goreng Kampung"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Kategori Menu</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Atau Kategori Baharu</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Cth: Minuman Spesial"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Harga Jualan (RM) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Anggaran Kos (RM)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Stesen Penyediaan</label>
                  <select
                    value={kitchenStation}
                    onChange={(e) => setKitchenStation(e.target.value as KitchenStation)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="KITCHEN">Dapur Masak (Kitchen)</option>
                    <option value="BAR">Bar Minuman (Bar)</option>
                    <option value="DESSERT">Pencuci Mulut (Dessert)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Penerangan Hidangan</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ramuan utama, keistimewaan rasa, atau panduan alergen..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Modifier Groups Section */}
              <div className="pt-3 border-t border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">Kumpulan Modifier & Variasi</span>
                  <button
                    type="button"
                    onClick={addModifierGroup}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kumpulan</span>
                  </button>
                </div>

                {modifierGroups.length === 0 ? (
                  <p className="text-[11px] text-stone-500 italic bg-stone-950/40 p-2.5 rounded-lg border border-stone-800/50">
                    Tiada variasi atau modifier. Contoh kumpulan: "Pilihan Suhu (Panas/Ais)", "Tambahan Lauk (Telur Mata/Ayam Goreng)".
                  </p>
                ) : (
                  <div className="space-y-3">
                    {modifierGroups.map((group, gIdx) => (
                      <div key={group.id} className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => {
                              const updated = [...modifierGroups];
                              updated[gIdx].name = e.target.value;
                              setModifierGroups(updated);
                            }}
                            placeholder="Nama Kumpulan (cth: Suhu / Tambahan Lauk)"
                            className="bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeModifierGroup(group.id)}
                            className="text-stone-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-stone-400">
                          <label className="flex items-center gap-1.5">
                            <span>Wajib Pilih?</span>
                            <input
                              type="checkbox"
                              checked={group.minSelection > 0}
                              onChange={(e) => {
                                const updated = [...modifierGroups];
                                updated[gIdx].minSelection = e.target.checked ? 1 : 0;
                                setModifierGroups(updated);
                              }}
                              className="rounded border-stone-700 bg-stone-900 text-emerald-600"
                            />
                          </label>

                          <label className="flex items-center gap-1.5">
                            <span>Pilihan Pelbagai?</span>
                            <input
                              type="checkbox"
                              checked={group.maxSelection > 1}
                              onChange={(e) => {
                                const updated = [...modifierGroups];
                                updated[gIdx].maxSelection = e.target.checked ? 5 : 1;
                                setModifierGroups(updated);
                              }}
                              className="rounded border-stone-700 bg-stone-900 text-emerald-600"
                            />
                          </label>
                        </div>

                        {/* Senarai Pilihan dalam Group */}
                        <div className="space-y-1.5 pt-2 border-t border-stone-800/60">
                          {group.options.map((opt, oIdx) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.name}
                                onChange={(e) => {
                                  const updated = [...modifierGroups];
                                  updated[gIdx].options[oIdx].name = e.target.value;
                                  setModifierGroups(updated);
                                }}
                                placeholder="Nama Pilihan (cth: Panas)"
                                className="bg-stone-900 border border-stone-800 rounded px-2 py-1 text-xs text-stone-200 flex-1"
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-stone-500">+RM</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={opt.price}
                                  onChange={(e) => {
                                    const updated = [...modifierGroups];
                                    updated[gIdx].options[oIdx].price = parseFloat(e.target.value) || 0;
                                    setModifierGroups(updated);
                                  }}
                                  className="w-16 bg-stone-900 border border-stone-800 rounded px-1.5 py-1 text-xs text-white font-mono"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...modifierGroups];
                                  updated[gIdx].options = updated[gIdx].options.filter((_, idx) => idx !== oIdx);
                                  setModifierGroups(updated);
                                }}
                                className="text-stone-500 hover:text-rose-400 p-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addOptionToGroup(group.id)}
                            className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Tambah Pilihan</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Butang Simpan Form */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="px-3.5 py-2 text-xs text-stone-400 hover:text-white bg-stone-800/60 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="save-menu-item-btn"
                  onClick={handleSave}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  {editingItem ? 'Kemaskini Hidangan' : 'Simpan Hidangan'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
