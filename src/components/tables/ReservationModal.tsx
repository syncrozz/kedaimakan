/**
 * SYNCROZZ KEDAI MAKAN - Reservation Modal (SES v4.5)
 * Membolehkan pendaftaran tempahan meja baharu atau kemas kini status tempahan.
 */

import React, { useState } from 'react';
import { RestaurantTable, TableReservation } from '../../types/restaurant';
import { X, Calendar, Clock, Users, Phone, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReservationModalProps {
  isOpen: boolean;
  table: RestaurantTable | null;
  onClose: () => void;
  onAddReservation: (
    input: Omit<TableReservation, 'id' | 'createdAt' | 'updatedAt' | 'storeId'> & {
      setTableStatusReserved?: boolean;
    }
  ) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  table,
  onClose,
  onAddReservation,
}) => {
  if (!isOpen || !table) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pax, setPax] = useState<number>(table.capacity || 4);
  const [reservationDate, setReservationDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reservationTime, setReservationTime] = useState(() => {
    // Default 1 jam dari sekarang
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const [setTableStatusReserved, setSetTableStatusReserved] = useState(true);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('Sila masukkan nama pelanggan.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMsg('Sila masukkan nombor telefon untuk dihubungi.');
      return;
    }

    onAddReservation({
      tableId: table.id,
      tableNumber: table.tableNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      pax: Number(pax) || 1,
      reservationDate: reservationDate.trim(),
      reservationTime: reservationTime.trim(),
      notes: notes.trim() || undefined,
      status: 'PENDING',
      setTableStatusReserved,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        id="reservation-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Daftar Tempahan Meja</h3>
              <p className="text-xs text-stone-400">
                Meja {table.tableNumber} &bull; Zon: {table.zone} ({table.capacity} Pax)
              </p>
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
              Nama Pelanggan <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cth: Encik Hafiz"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-300 mb-1">
              Nombor Telefon <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Cth: 012-3456789"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Tarikh Tempahan
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="date"
                  required
                  value={reservationDate}
                  onChange={(e) => setReservationDate(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-2 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Waktu Tempahan
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="time"
                  required
                  value={reservationTime}
                  onChange={(e) => setReservationTime(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-300 mb-1">
              Bilangan Pax
            </label>
            <div className="relative">
              <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="number"
                min="1"
                max={table.capacity * 2}
                value={pax}
                onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-300 mb-1">
              Catatan / Permintaan Khas (Pilihan)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cth: Sambutan hari jadi, kerusi bayi diperlukan..."
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-white placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* SES v4.5 Pilihan Kunci Status Meja */}
          <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={setTableStatusReserved}
                onChange={(e) => setSetTableStatusReserved(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-purple-600 rounded border-stone-700 bg-stone-900 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Kunci status meja kepada RESERVED serta-merta
                </span>
                <span className="text-[11px] text-stone-400 block mt-0.5">
                  Nyahpilih jika tempahan masih beberapa jam lagi dan meja masih boleh digunakan oleh pelanggan walk-in sekarang.
                </span>
              </div>
            </label>
          </div>

          <div className="p-2.5 bg-purple-950/30 border border-purple-800/60 rounded-xl text-[11px] text-purple-300">
            * Peringatan SES v4.5: Lencana amaran tempahan akan sentiasa dipaparkan pada kad meja dan pesanan untuk makluman Cashier/Owner sepanjang hari berkenaan.
          </div>

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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Tempahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
