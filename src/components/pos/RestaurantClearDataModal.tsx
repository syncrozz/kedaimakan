import React, { useState } from 'react';
import {
  Trash2,
  Layers,
  Filter,
  AlertTriangle,
  UtensilsCrossed,
  Grid3X3,
  Calendar,
  Info,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useStore } from '../../context/StoreContext';

interface RestaurantClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableCount: number;
  menuCount: number;
  reservationCount: number;
  onSuccess?: (message: string) => void;
}

export const RestaurantClearDataModal: React.FC<RestaurantClearDataModalProps> = ({
  isOpen,
  onClose,
  tableCount,
  menuCount,
  reservationCount,
  onSuccess,
}) => {
  const { clearRestaurantData } = useStore();

  const [clearMode, setClearMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [selectedOptions, setSelectedOptions] = useState({
    menu: true,
    tables: true,
    reservations: true,
  });
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleOption = (key: 'menu' | 'tables' | 'reservations') => {
    setSelectedOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    setSelectedOptions({
      menu: select,
      tables: select,
      reservations: select,
    });
  };

  const handleConfirm = async () => {
    const targets =
      clearMode === 'ALL'
        ? { menu: true, tables: true, reservations: true }
        : selectedOptions;

    const anySelected = targets.menu || targets.tables || targets.reservations;
    if (!anySelected) {
      setErrorMessage('Sila pilih sekurang-kurangnya 1 kategori untuk dikosongkan.');
      return;
    }

    setErrorMessage(null);
    setIsClearing(true);

    try {
      const res = await clearRestaurantData(targets);
      onClose();
      if (onSuccess) {
        onSuccess(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengosongkan data.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Modal
      id="restaurant-clear-data-modal"
      isOpen={isOpen}
      onClose={() => !isClearing && onClose()}
      title="Pilihan Mula Dari Kosong (Reset Data Restoran)"
      subtitle="Sediakan kedai sedia untuk klien sebenar dengan memadamkan data demo sedia ada"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Pilihan Mod: Semua Data atau Kategori Pilihan (Konsep Niaga POS) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
          <button
            type="button"
            id="clear-restaurant-all-tab"
            onClick={() => {
              setClearMode('ALL');
              setSelectedOptions({ menu: true, tables: true, reservations: true });
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              clearMode === 'ALL'
                ? 'bg-white text-rose-700 shadow-2xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Semua Data (Penuh)</span>
          </button>

          <button
            type="button"
            id="clear-restaurant-custom-tab"
            onClick={() => {
              setClearMode('CUSTOM');
              setErrorMessage(null);
            }}
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
              <p className="font-bold mb-1">Mod Penuh: Padamkan Semua Data Demo Restoran</p>
              <p className="text-rose-800 leading-relaxed">
                Tindakan ini akan memadamkan serentak keseluruhan <strong>Susun Atur Meja ({tableCount})</strong>, <strong>Katalog Menu ({menuCount})</strong>, dan <strong>Rekod Tempahan ({reservationCount})</strong>. Klien akan menerima platform kosong yang bersih untuk menyusun atur restoran mereka sendiri.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-stone-700">Tandakan bahagian yang ingin dimulakan dari kosong:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="select-all-clear-options"
                  onClick={() => handleSelectAll(true)}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-stone-300">|</span>
                <button
                  type="button"
                  id="deselect-all-clear-options"
                  onClick={() => handleSelectAll(false)}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {/* Kad Pilihan Kustom */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Meja Restoran */}
              <label
                className={`flex flex-col p-3 rounded-xl border transition cursor-pointer select-none ${
                  selectedOptions.tables
                    ? 'border-rose-300 bg-rose-50/60 shadow-2xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                    <Grid3X3 className="w-4 h-4" />
                  </div>
                  <input
                    type="checkbox"
                    id="clear-opt-tables"
                    checked={selectedOptions.tables}
                    onChange={() => handleToggleOption('tables')}
                    className="w-4 h-4 text-rose-600 rounded border-stone-300 focus:ring-rose-500"
                  />
                </div>
                <span className="font-bold text-xs text-stone-900">Meja Restoran</span>
                <span className="text-[11px] text-stone-500 mt-0.5">
                  {tableCount} meja sedia ada
                </span>
                <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                  Padam semua nombor meja (T01-T07, Meja VIP)
                </span>
              </label>

              {/* 2. Menu Hidangan */}
              <label
                className={`flex flex-col p-3 rounded-xl border transition cursor-pointer select-none ${
                  selectedOptions.menu
                    ? 'border-rose-300 bg-rose-50/60 shadow-2xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <input
                    type="checkbox"
                    id="clear-opt-menu"
                    checked={selectedOptions.menu}
                    onChange={() => handleToggleOption('menu')}
                    className="w-4 h-4 text-rose-600 rounded border-stone-300 focus:ring-rose-500"
                  />
                </div>
                <span className="font-bold text-xs text-stone-900">Menu Hidangan</span>
                <span className="text-[11px] text-stone-500 mt-0.5">
                  {menuCount} item makanan & minuman
                </span>
                <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                  Padam variasi, stesen dapur & modifiers
                </span>
              </label>

              {/* 3. Tempahan & Pesanan */}
              <label
                className={`flex flex-col p-3 rounded-xl border transition cursor-pointer select-none ${
                  selectedOptions.reservations
                    ? 'border-rose-300 bg-rose-50/60 shadow-2xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="checkbox"
                    id="clear-opt-reservations"
                    checked={selectedOptions.reservations}
                    onChange={() => handleToggleOption('reservations')}
                    className="w-4 h-4 text-rose-600 rounded border-stone-300 focus:ring-rose-500"
                  />
                </div>
                <span className="font-bold text-xs text-stone-900">Tempahan Meja</span>
                <span className="text-[11px] text-stone-500 mt-0.5">
                  {reservationCount} rekod tempahan
                </span>
                <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                  Padam senarai tempahan pelanggan
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Maklumat keselamatan & Muat Semula Data Contoh */}
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-2.5 text-xs text-stone-600">
          <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-stone-800">Fleksibiliti Penuh: </span>
            Selepas dikosongkan, anda boleh memasukkan data sebenar perniagaan melalui butang Tambah Baharu atau Import CSV. Sekiranya anda mahu mencuba semula dengan data contoh pada masa akan datang, butang <em>"Muat Data Contoh"</em> akan tersedia secara automatik apabila skrin kosong.
          </div>
        </div>

        {/* Mesej Ralat jika ada */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Butang Tindakan */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
          <button
            type="button"
            id="cancel-clear-restaurant-btn"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            id="confirm-clear-restaurant-btn"
            onClick={handleConfirm}
            disabled={isClearing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isClearing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mengosongkan Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sahkan & Mula Dari Kosong</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
