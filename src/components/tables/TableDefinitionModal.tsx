/**
 * SYNCROZZ KEDAI MAKAN - Table Definition Modal (SES v4.5)
 * Membolehkan penambahan & penetapan meja baharu (Nombor meja, zon, muatan pax).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { RestaurantTable } from '../../types/restaurant';
import { X, Hash, Users, MapPin, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface TableDefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTable: (
    data: Partial<RestaurantTable> & { tableNumber: string; capacity: number; zone: string }
  ) => void;
  existingZones: string[];
  tables?: RestaurantTable[];
}

export const TableDefinitionModal: React.FC<TableDefinitionModalProps> = ({
  isOpen,
  onClose,
  onSaveTable,
  existingZones,
  tables = [],
}) => {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState<number>(4);
  const [zone, setZone] = useState('Dalam');
  const [customZone, setCustomZone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mengira nombor meja seterusnya secara pintar (VIP1, VIP2... dan T01, T02...)
  const nextVipNumber = useMemo(() => {
    let maxVipNum = 0;
    tables.forEach((t) => {
      const match = t.tableNumber.match(/^VIP-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxVipNum) maxVipNum = num;
      }
    });
    return `VIP${maxVipNum + 1}`;
  }, [tables]);

  const nextTableNumber = useMemo(() => {
    let maxT = 0;
    tables.forEach((t) => {
      const match = t.tableNumber.match(/^T(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxT) maxT = num;
      }
    });
    return `T${String(maxT + 1).padStart(2, '0')}`;
  }, [tables]);

  // Set nilai awal apabila modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (zone === 'Meja VIP' || zone === 'Bilik VIP') {
        setTableNumber(nextVipNumber);
        setCapacity(10);
      } else {
        setTableNumber(nextTableNumber);
        setCapacity(4);
      }
      setErrorMsg(null);
    }
  }, [isOpen, nextVipNumber, nextTableNumber]);

  const handleZoneChange = (newZone: string) => {
    setZone(newZone);
    // Jika pengguna belum ubah secara manual atau bertukar ke/daripada VIP, cadangkan nombor sesuai
    if (!tableNumber || tableNumber.startsWith('VIP') || tableNumber.startsWith('T')) {
      if (newZone === 'Meja VIP' || newZone === 'Bilik VIP') {
        setTableNumber(nextVipNumber);
        setCapacity(10);
      } else if (newZone === 'Dalam' || newZone === 'Luar / Terbuka') {
        setTableNumber(nextTableNumber);
        setCapacity(4);
      }
    }
  };

  const defaultZoneOptions = Array.from(
    new Set(['Dalam', 'Luar / Terbuka', 'Meja VIP', ...existingZones.map((z) => (z === 'Dewan Utama' ? 'Dalam' : (z === 'Bilik VIP' ? 'Meja VIP' : z)))])
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let cleanNumber = tableNumber.trim().toUpperCase();
    const finalZone = zone === 'LAIN' ? customZone.trim() : (zone === 'Bilik VIP' ? 'Meja VIP' : zone);

    // Normalisasi format VIP-X / VIP X / vip x kepada VIPX (cth: VIP-1 / VIP 1 -> VIP1, VIP-2 / VIP 2 -> VIP2)
    const vipMatch = cleanNumber.match(/^VIP[-\s]?(\d+)$/i);
    if (vipMatch) {
      cleanNumber = `VIP${parseInt(vipMatch[1], 10)}`;
    }

    // Jika nombor meja kosong, guna penomboran automatik
    if (!cleanNumber) {
      cleanNumber = (finalZone === 'Meja VIP' || finalZone === 'Bilik VIP') ? nextVipNumber : nextTableNumber;
    }

    // Pengesahan pencegahan nombor meja bertindih (SES v4.5)
    const isDuplicate = tables.some(
      (tbl) => tbl.tableNumber.trim().toUpperCase() === cleanNumber
    );
    if (isDuplicate) {
      setErrorMsg(`Nombor meja "${cleanNumber}" sudah wujud. Sila pilih nombor meja lain.`);
      return;
    }

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

  if (!isOpen) return null;

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
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-stone-300">
                Nombor / Kod Meja <span className="text-rose-400">*</span>
              </label>
              {(zone === 'Meja VIP' || zone === 'Bilik VIP') && (
                <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/60">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Auto: {nextVipNumber}
                </span>
              )}
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                required
                placeholder={(zone === 'Meja VIP' || zone === 'Bilik VIP') ? `Cth: ${nextVipNumber}` : `Cth: ${nextTableNumber}, VIP2`}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white uppercase font-mono placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {(zone === 'Meja VIP' || zone === 'Bilik VIP') && (
              <p className="text-[11px] text-stone-400 mt-1">
                Sistem menetapkan susunan meja VIP secara automatik (VIP1, VIP2, VIP3...).
              </p>
            )}
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
                  onChange={(e) => handleZoneChange(e.target.value)}
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
