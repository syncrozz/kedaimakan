import React, { useState } from 'react';
import {
  MenuItem,
  MenuModifierGroup,
  SelectedModifierSnapshot,
  SelectedVariantSnapshot,
  MenuVariant,
} from '../../types/restaurant';
import { X, Plus, Minus, Check, Utensils, AlertCircle, Layers } from 'lucide-react';
import { formatCurrency } from '../../services/formatters';

interface MenuItemModifierModalProps {
  isOpen: boolean;
  menuItem: MenuItem | null;
  onClose: () => void;
  onConfirm: (
    item: MenuItem,
    quantity: number,
    selectedModifiers: SelectedModifierSnapshot[],
    specialInstructions: string,
    selectedVariant?: SelectedVariantSnapshot
  ) => void;
}

export const MenuItemModifierModal: React.FC<MenuItemModifierModalProps> = ({
  isOpen,
  menuItem,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !menuItem) return null;

  const [quantity, setQuantity] = useState<number>(1);
  
  // Variasi Pilihan (e.g., Biasa / Besar, Panas / Sejuk / Bungkus)
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariantSnapshot | undefined>(() => {
    if (menuItem.variants && menuItem.variants.length > 0) {
      const defaultVar = menuItem.variants.find(v => v.isDefault) || menuItem.variants[0];
      return {
        id: defaultVar.id,
        name: defaultVar.name,
        price: defaultVar.price,
      };
    }
    return undefined;
  });

  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifierSnapshot[]>(() => {
    const initial: SelectedModifierSnapshot[] = [];
    // Auto-select single mandatory options if minSelection === 1
    if (menuItem.modifierGroups) {
      menuItem.modifierGroups.forEach(group => {
        if (group.minSelection === 1 && group.maxSelection === 1 && group.options.length > 0) {
          initial.push({
            groupId: group.id,
            groupName: group.name,
            optionId: group.options[0].id,
            optionName: group.options[0].name,
            price: group.options[0].price,
          });
        }
      });
    }
    return initial;
  });
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelectVariant = (variant: MenuVariant) => {
    setSelectedVariant({
      id: variant.id,
      name: variant.name,
      price: variant.price,
    });
  };

  const handleToggleModifier = (group: MenuModifierGroup, optionId: string) => {
    setValidationError(null);
    const option = group.options.find(opt => opt.id === optionId);
    if (!option) return;

    const existingInGroup = selectedModifiers.filter(sm => sm.groupId === group.id);
    const isAlreadySelected = existingInGroup.some(sm => sm.optionId === optionId);

    if (group.maxSelection === 1) {
      // Single selection
      if (isAlreadySelected) {
        if (group.minSelection === 1) {
          // Mandatory single choice cannot be unselected
          return;
        }
        setSelectedModifiers(prev => prev.filter(sm => sm.groupId !== group.id));
      } else {
        setSelectedModifiers(prev => [
          ...prev.filter(sm => sm.groupId !== group.id),
          {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
          },
        ]);
      }
    } else {
      // Multiple selection up to maxSelection
      if (isAlreadySelected) {
        setSelectedModifiers(prev => prev.filter(sm => sm.optionId !== optionId));
      } else {
        if (existingInGroup.length >= group.maxSelection) {
          setValidationError(`Maksimum ${group.maxSelection} pilihan dibenarkan untuk ${group.name}.`);
          return;
        }
        setSelectedModifiers(prev => [
          ...prev,
          {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
          },
        ]);
      }
    }
  };

  const calculateUnitTotal = (): number => {
    const base = selectedVariant ? selectedVariant.price : menuItem.price;
    const modifiersTotal = selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
    return base + modifiersTotal;
  };

  const unitTotal = calculateUnitTotal();
  const grandTotal = unitTotal * quantity;

  const handleConfirm = () => {
    // Validate mandatory groups
    if (menuItem.modifierGroups) {
      for (const group of menuItem.modifierGroups) {
        const countInGroup = selectedModifiers.filter(sm => sm.groupId === group.id).length;
        if (countInGroup < group.minSelection) {
          setValidationError(`Sila pilih sekurang-kurangnya ${group.minSelection} pilihan untuk "${group.name}".`);
          return;
        }
      }
    }

    onConfirm(menuItem, quantity, selectedModifiers, specialInstructions.trim(), selectedVariant);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        id="menu-modifier-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{menuItem.name}</h3>
              <p className="text-xs text-stone-400">
                {menuItem.category} &bull; Kod: <span className="font-mono text-stone-300">{menuItem.code}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {validationError && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-lg p-2.5 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Penerangan Menu jika ada */}
          {menuItem.description && (
            <p className="text-xs text-stone-400 bg-stone-950/40 p-2.5 rounded-lg border border-stone-800/50">
              {menuItem.description}
            </p>
          )}

          {/* Variasi Menu (Saiz / Pilihan Harga Berbeza) */}
          {menuItem.variants && menuItem.variants.length > 0 && (
            <div className="space-y-2 border-b border-stone-800/60 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pilihan Variasi / Saiz</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium">
                    Wajib Pilih 1
                  </span>
                </span>
                <span className="text-[11px] text-stone-400">Harga mengikut variasi</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {menuItem.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      id={`variant-btn-${v.id}`}
                      onClick={() => handleSelectVariant(v)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-500/50'
                          : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700 hover:bg-stone-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{v.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        {formatCurrency(v.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kumpulan Modifier */}
          {menuItem.modifierGroups && menuItem.modifierGroups.length > 0 ? (
            menuItem.modifierGroups.map((group) => {
              const selectedInGroup = selectedModifiers.filter(sm => sm.groupId === group.id);
              const isMandatory = group.minSelection > 0;

              return (
                <div key={group.id} className="space-y-2 border-b border-stone-800/60 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                      {group.name}
                      {isMandatory && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-medium">
                          Wajib
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {group.maxSelection === 1 ? 'Pilih 1' : `Pilih sehingga ${group.maxSelection}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.options.map((opt) => {
                      const isSelected = selectedInGroup.some(sm => sm.optionId === opt.id);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          id={`modifier-option-${opt.id}`}
                          onClick={() => handleToggleModifier(group, opt.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-500/50'
                              : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700 hover:bg-stone-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'border-stone-700 bg-stone-900'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span>{opt.name}</span>
                          </div>
                          {opt.price > 0 && (
                            <span className="text-[11px] font-mono font-semibold text-emerald-400">
                              +{formatCurrency(opt.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            !menuItem.variants?.length && (
              <p className="text-xs text-stone-400 italic">
                Tiada pilihan modifier khusus untuk hidangan ini.
              </p>
            )
          )}

          {/* Arahan Khas Dapur */}
          <div>
            <label htmlFor="special-instructions-input" className="block text-xs font-semibold text-stone-300 mb-1.5">
              Arahan Khas Dapur / Bar
            </label>
            <input
              id="special-instructions-input"
              type="text"
              placeholder="Cth: Kurang manis, tanpa taugeh, kuah asing, pedas kaw"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Kuantiti Pesanan */}
          <div className="pt-2 border-t border-stone-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-300">Kuantiti Hidangan</span>
            <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="w-7 h-7 rounded bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-bold font-mono text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(prev => prev + 1)}
                className="w-7 h-7 rounded bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer & Pengesahan */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-stone-400">Jumlah Bersih</div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {formatCurrency(grandTotal)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-400 hover:text-white bg-stone-800/60 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              id="confirm-add-modifier-item-btn"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah ke Pesanan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
