import React, { useState } from 'react';
import { RestaurantOrderItem, DiscountType } from '../../types/restaurant';
import { X, Percent, DollarSign, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../services/formatters';
import { AdminAuthService } from '../../services/adminAuthService';

interface ItemDiscountModalProps {
  isOpen: boolean;
  item: RestaurantOrderItem | null;
  workspaceSlug?: string;
  onClose: () => void;
  onApplyDiscount: (
    itemId: string,
    discountType: DiscountType,
    discountValue: number,
    discountAmount: number,
    approvedBy: 'CASHIER' | 'OWNER'
  ) => void;
  onRemoveDiscount: (itemId: string) => void;
}

export const ItemDiscountModal: React.FC<ItemDiscountModalProps> = ({
  isOpen,
  item,
  workspaceSlug,
  onClose,
  onApplyDiscount,
  onRemoveDiscount,
}) => {
  if (!isOpen || !item) return null;

  const grossItemTotal = item.unitTotal * item.quantity;
  const isCurrentlyLocked = Boolean(item.isLockedAfterApproval);

  const [discountType, setDiscountType] = useState<DiscountType>(
    item.discountType !== 'NONE' ? item.discountType : 'PERCENTAGE'
  );
  const [inputValue, setInputValue] = useState<string>(
    item.discountValue > 0 ? item.discountValue.toString() : ''
  );
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  // Kiraan diskaun dinamik
  const parsedValue = parseFloat(inputValue) || 0;
  let calculatedDiscount = 0;
  let effectivePercent = 0;

  if (discountType === 'PERCENTAGE') {
    effectivePercent = parsedValue;
    calculatedDiscount = (grossItemTotal * parsedValue) / 100;
  } else if (discountType === 'FIXED') {
    calculatedDiscount = parsedValue;
    effectivePercent = grossItemTotal > 0 ? (parsedValue / grossItemTotal) * 100 : 0;
  }

  // Had maksimum diskaun tidak boleh melebihi nilai item
  calculatedDiscount = Math.min(calculatedDiscount, grossItemTotal);
  calculatedDiscount = Math.max(0, calculatedDiscount);

  // Had Cashier adalah 10% (SES v4.5), dan jika item dikunci oleh Owner sebelum ini, perubahan/pemadaman juga memerlukan PIN Owner
  const requiresOwnerPin = isCurrentlyLocked || effectivePercent > 10;
  const newNetLineTotal = Math.max(0, grossItemTotal - calculatedDiscount);

  const handleApply = async () => {
    setErrorMsg(null);

    if (parsedValue <= 0) {
      setErrorMsg('Sila masukkan nilai diskaun yang sah (lebih daripada 0).');
      return;
    }

    if (calculatedDiscount > grossItemTotal) {
      setErrorMsg('Diskaun tidak boleh melebihi jumlah nilai item.');
      return;
    }

    if (requiresOwnerPin) {
      if (!ownerPin || ownerPin.length < 4) {
        setErrorMsg(
          isCurrentlyLocked
            ? 'Diskaun ini telah dikunci oleh Owner. Masukkan PIN Owner untuk menukar diskaun.'
            : 'Diskaun melebihi 10% memerlukan PIN Owner (sekurang-kurangnya 4 digit).'
        );
        return;
      }

      setIsVerifyingPin(true);
      try {
        const slug = workspaceSlug || 'default';
        const verifyRes = await AdminAuthService.verifyPinAsync(ownerPin, slug);
        if (!verifyRes.success) {
          setErrorMsg(verifyRes.error || 'PIN Owner tidak sah. Kelulusan diskaun ditolak.');
          setIsVerifyingPin(false);
          return;
        }
        // Sah berjaya dengan Owner PIN
        onApplyDiscount(item.id, discountType, parsedValue, calculatedDiscount, 'OWNER');
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Ralat semasa mengesahkan PIN.');
      } finally {
        setIsVerifyingPin(false);
      }
    } else {
      // Diskaun dalam had Cashier (<=10%)
      onApplyDiscount(item.id, discountType, parsedValue, calculatedDiscount, 'CASHIER');
      onClose();
    }
  };

  const handleReset = async () => {
    setErrorMsg(null);
    if (isCurrentlyLocked) {
      if (!ownerPin || ownerPin.length < 4) {
        setErrorMsg('Diskaun ini dikunci oleh Owner. Masukkan PIN Owner untuk memadam diskaun.');
        return;
      }
      setIsVerifyingPin(true);
      try {
        const slug = workspaceSlug || 'default';
        const verifyRes = await AdminAuthService.verifyPinAsync(ownerPin, slug);
        if (!verifyRes.success) {
          setErrorMsg(verifyRes.error || 'PIN Owner tidak sah. Pemadaman diskaun ditolak.');
          setIsVerifyingPin(false);
          return;
        }
        onRemoveDiscount(item.id);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Ralat semasa mengesahkan PIN.');
      } finally {
        setIsVerifyingPin(false);
      }
    } else {
      onRemoveDiscount(item.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        id="item-discount-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div>
            <h3 className="text-sm font-bold text-white">Diskaun Item (SES v4.5)</h3>
            <p className="text-xs text-stone-400 truncate max-w-[280px]">
              {item.nameSnapshot} ({item.quantity}x @ {formatCurrency(item.unitTotal)})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Amaran jika dikunci oleh Owner sebelum ini */}
          {isCurrentlyLocked && (
            <div className="bg-amber-950/40 border border-amber-800/70 rounded-lg p-2.5 flex items-start gap-2 text-amber-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Diskaun item ini telah diluluskan oleh Owner sebelum ini dan dikunci daripada pindaan sewenang-wenangnya.
              </span>
            </div>
          )}

          {/* Ralat */}
          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-2.5 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ringkasan Nilai Item */}
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800/80 flex items-center justify-between text-xs">
            <span className="text-stone-400">Jumlah Kasar Baris:</span>
            <span className="font-mono font-bold text-white">{formatCurrency(grossItemTotal)}</span>
          </div>

          {/* Pilihan Jenis Diskaun */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1.5">
              Jenis Potongan
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="discount-type-percent-btn"
                onClick={() => {
                  setDiscountType('PERCENTAGE');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  discountType === 'PERCENTAGE'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-semibold ring-1 ring-emerald-500/40'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Peratusan (%)</span>
              </button>

              <button
                type="button"
                id="discount-type-fixed-btn"
                onClick={() => {
                  setDiscountType('FIXED');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  discountType === 'FIXED'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-semibold ring-1 ring-emerald-500/40'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Jumlah Tetap (RM)</span>
              </button>
            </div>
          </div>

          {/* Input Nilai Diskaun */}
          <div>
            <label htmlFor="discount-input-field" className="block text-xs font-semibold text-stone-300 mb-1.5 flex items-center justify-between">
              <span>{discountType === 'PERCENTAGE' ? 'Kadar Diskaun (%)' : 'Jumlah Diskaun (RM)'}</span>
              <span className="text-[11px] text-stone-500">
                Had Cashier: <strong className="text-stone-300">≤ 10%</strong>
              </span>
            </label>
            <input
              id="discount-input-field"
              type="number"
              step="any"
              min="0"
              placeholder={discountType === 'PERCENTAGE' ? 'Cth: 5 atau 15' : 'Cth: 2.00'}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            />
          </div>

          {/* Petunjuk Had & Pengesahan PIN Owner jika >10% atau Item Dikunci */}
          {requiresOwnerPin && (
            <div className="bg-amber-950/30 border border-amber-700/80 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {isCurrentlyLocked
                    ? 'Diskaun Dikunci oleh Owner — Kebenaran Diperlukan'
                    : `Kelulusan PIN Owner Diperlukan (${effectivePercent.toFixed(1)}% > 10%)`}
                </span>
              </div>
              <p className="text-[11px] text-stone-300">
                {isCurrentlyLocked
                  ? 'Diskaun item ini telah dikunci oleh Owner. Sebarang pindaan atau pemadaman diskaun memerlukan pengesahan PIN Owner.'
                  : 'Diskaun melebihi had 10% wajib disahkan oleh Pemilik (Owner) premis sebelum boleh diguna pakai.'}
              </p>
              <div>
                <label htmlFor="owner-pin-input-field" className="block text-[11px] font-medium text-stone-400 mb-1">
                  Masukkan PIN Owner
                </label>
                <input
                  id="owner-pin-input-field"
                  type="password"
                  maxLength={6}
                  placeholder="PIN Owner (cth: 1234)"
                  value={ownerPin}
                  onChange={(e) => {
                    setOwnerPin(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-stone-950 border border-amber-600/80 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Pratonton Pengiraan */}
          <div className="bg-stone-950/80 rounded-xl p-3 border border-stone-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between text-stone-400">
              <span>Potongan Diskaun:</span>
              <span className="text-amber-400 font-bold">-{formatCurrency(calculatedDiscount)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-200 pt-1 border-t border-stone-800">
              <span className="font-sans font-medium">Baki Bersih Baris Item:</span>
              <span className="text-emerald-400 font-bold text-sm">{formatCurrency(newNetLineTotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between">
          {item.discountAmount > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
            >
              Padam Diskaun
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-stone-400 hover:text-white bg-stone-800/60 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              id="apply-item-discount-btn"
              disabled={isVerifyingPin}
              onClick={handleApply}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isVerifyingPin ? 'Mengesahkan...' : 'Guna Diskaun'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
