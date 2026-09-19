/**
 * SYNCROZZ KEDAI MAKAN - Table Definition Modal (SES v4.5)
 * Membolehkan penambahan & penetapan meja baharu (Nombor meja, zon, muatan pax).
 */

import React, { useState } from 'react';
import { RestaurantTable } from '../../types/restaurant';
import { X, Hash, Users, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

interface TableDefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTable: (
    data: Partial<RestaurantTable> & { tableNumber: string; capacity: number; zone: string }
  ) => void;
  existingZones: string[];
}

export const TableDefinitionModal: React.FC<TableDefinitionModalProps> = ({
  isOpen,
  onClose,
  onSaveTable,
  existingZones,
}) => {
  if (!isOpen) return null;

  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState<number>(4);
  const [zone, setZone] = useState('Dewan Utama');
  const [customZone, setCustomZone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultZoneOptions = Array.from(
    new Set(['Dewan Utama', 'Luar / Terbuka', 'Bilik VIP', ...existingZones])
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNumber = tableNumber.trim();
    if (!cleanNumber) {
      setErrorMsg('Sila masukkan nombor atau label meja (cth: T09).');
      return;
    }

    const finalZone = zone === 'LAIN' ? customZone.trim() : zone;
    if (!finalZone) {
      setErrorMsg('Sila nyatakan zon bagi meja ini.');
      return;
    }

    onSaveTable({
      tableNumber: cleanNumber,
      capacity: Number(capacity) || 2,
      zone: finalZone,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        id="table-definition-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Tambah Meja Baharu</h3>
              <p className="text-xs text-stone-400">Daftar meja restoran ke dalam grid</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-300 mb-1">
              Nombor / Kod Meja <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                required
                placeholder="Cth: T09, VIP-02, Bar-1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white uppercase font-mono placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Muatan Kerusi (Pax)
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 2)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Zon / Bahagian Restoran
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {defaultZoneOptions.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                  <option value="LAIN">+ Zon Baharu...</option>
                </select>
              </div>
            </div>
          </div>

          {zone === 'LAIN' && (
            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Nama Zon Baharu
              </label>
              <input
                type="text"
                placeholder="Cth: Ruang Rooftop, Tingkat 2"
                value={customZone}
                onChange={(e) => setCustomZone(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-stone-400 hover:text-white bg-stone-800/80 rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Daftar Meja</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
