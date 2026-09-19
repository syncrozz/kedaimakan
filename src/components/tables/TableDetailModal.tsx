/**
 * SYNCROZZ KEDAI MAKAN - Table Detail & Status Action Modal (SES v4.5)
 * Membolehkan pertukaran 6 status meja dengan kawalan kebenaran & audit trail.
 * Tiada pertukaran status OCCUPIED secara automatik sebelum pesanan disahkan.
 */

import React, { useState } from 'react';
import {
  RestaurantTable,
  TableStatus,
  TableStatusAuditEntry,
} from '../../types/restaurant';
import { formatCurrency } from '../../services/formatters';
import { TableService } from '../../services/tableService';
import {
  X,
  Users,
  Clock,
  Receipt,
  Utensils,
  Sparkles,
  Ban,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert,
  Phone,
} from 'lucide-react';

interface TableDetailModalProps {
  isOpen: boolean;
  table: RestaurantTable | null;
  auditLogs: TableStatusAuditEntry[];
  onClose: () => void;
  onUpdateStatus: (tableId: string, newStatus: TableStatus, reason?: string) => void;
  onStartOrder: (table: RestaurantTable, pax: number) => void;
  onOpenReservationModal: (table: RestaurantTable) => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  isOpen,
  table,
  auditLogs,
  onClose,
  onUpdateStatus,
  onStartOrder,
  onOpenReservationModal,
}) => {
  if (!isOpen || !table) return null;

  const [guestCount, setGuestCount] = useState<number>(
    table.activeGuestCount || table.capacity || 2
  );
  const [activeTab, setActiveTab] = useState<'ACTION' | 'AUDIT'>('ACTION');
  const [manualReason, setManualReason] = useState<string>('');

  const tableLogs = auditLogs
    .filter((log) => log.tableId === table.id)
    .slice(0, 10);

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          label: 'Tersedia',
          bg: 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300',
        };
      case 'OCCUPIED':
        return {
          label: 'Diduduki (Occupied)',
          bg: 'bg-sky-950/60 border-sky-700/60 text-sky-300',
        };
      case 'WAITING_PAYMENT':
        return {
          label: 'Menunggu Bayaran',
          bg: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
        };
      case 'RESERVED':
        return {
          label: 'Ditempah (Reserved)',
          bg: 'bg-purple-950/60 border-purple-700/60 text-purple-300',
        };
      case 'CLEANING':
        return {
          label: 'Perlu Dibersihkan',
          bg: 'bg-yellow-950/60 border-yellow-700/60 text-yellow-300',
        };
      case 'UNAVAILABLE':
        return {
          label: 'Tidak Tersedia',
          bg: 'bg-stone-800/80 border-stone-700 text-stone-400',
        };
    }
  };

  const currentBadge = getStatusBadge(table.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        id="table-detail-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-white font-bold text-base font-mono">
              {table.tableNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Meja {table.tableNumber}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentBadge.bg}`}
                >
                  {currentBadge.label}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Zon: <strong className="text-stone-300">{table.zone}</strong> &bull; Muatan: {table.capacity} Pax
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

        {/* Tab Switcher: Tindakan vs Audit Log */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('ACTION')}
            className={`flex-1 py-2.5 px-4 font-semibold text-center border-b-2 transition ${
              activeTab === 'ACTION'
                ? 'border-emerald-500 text-emerald-400 bg-stone-900/50'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Tindakan &amp; Pesanan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`flex-1 py-2.5 px-4 font-semibold text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'AUDIT'
                ? 'border-emerald-500 text-emerald-400 bg-stone-900/50'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail Meja ({tableLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'ACTION' ? (
            <>
              {/* Maklumat Pesanan Aktif (Jika Diduduki atau Menunggu Bayaran) */}
              {table.activeOrder && (
                <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                      <Receipt className="w-4 h-4" />
                      <span>Pesanan Aktif #{table.activeOrder.orderId.slice(-6)}</span>
                    </div>
                    <span className="text-xs font-mono text-stone-400">
                      {table.activeOrder.pax} Pax &bull; {table.activeOrder.itemsCount} Item
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs">
                    <span className="text-stone-400">Jumlah Bil Semasa:</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {formatCurrency(table.activeOrder.netAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Maklumat Tempahan Aktif / Akan Datang (SES v4.5 - Kenal pasti tempahan hari ini) */}
              {table.activeReservation && (
                <div className="bg-purple-950/50 border border-purple-700/80 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 text-purple-200 font-bold">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>Tempahan: {table.activeReservation.customerName}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900 border border-purple-700 text-amber-300 font-mono font-bold">
                      {TableService.getReservationTimeDiffLabel(table.activeReservation)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-300 bg-stone-950/60 p-2 rounded-lg border border-purple-900/50">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Waktu Tempahan:</span>
                      <strong className="text-white font-mono text-xs">{table.activeReservation.reservationTime}</strong>
                      {table.activeReservation.reservationDate && (
                        <span className="text-stone-400 text-[10px] block">({table.activeReservation.reservationDate})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Tetamu / Pax:</span>
                      <strong className="text-white text-xs">{table.activeReservation.pax} Orang</strong>
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[11px] text-stone-300">
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>Tel: <strong className="text-white font-mono">{table.activeReservation.customerPhone}</strong></span>
                    </div>
                  </div>

                  {table.activeReservation.notes && (
                    <p className="text-[11px] text-purple-200/90 italic bg-purple-950/40 p-1.5 rounded">
                      Nota: &ldquo;{table.activeReservation.notes}&rdquo;
                    </p>
                  )}

                  {table.status === 'AVAILABLE' && (
                    <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Peringatan: Meja ini mempunyai tempahan pada <strong>{table.activeReservation.reservationTime}</strong>. Pelanggan walk-in dibenarkan menggunakan meja ini sekiranya mereka boleh selesai sebelum waktu tempahan tersebut.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tindakan Utama Mengikut Status Semasa */}
              {table.status === 'AVAILABLE' && (
                <div className="space-y-3 bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                  <label className="block text-xs font-semibold text-stone-300">
                    Mula Pesanan Dine-In (Tetamu Duduk):
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Users className="w-4 h-4 text-stone-400 shrink-0" />
                      <input
                        id="table-guest-count-input"
                        type="number"
                        min="1"
                        max={table.capacity * 2}
                        value={guestCount}
                        onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                        placeholder="Bilangan Pax"
                      />
                    </div>
                    <button
                      type="button"
                      id="start-dinein-order-btn"
                      onClick={() => {
                        onStartOrder(table, guestCount);
                        onClose();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Buka Menu &amp; Pesan</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    *Peringatan SES v4.5: Status hanya akan bertukar kepada <strong>OCCUPIED</strong> selepas pesanan pertama disahkan/disimpan.
                  </p>
                </div>
              )}

              {table.status === 'OCCUPIED' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    id="table-request-bill-btn"
                    onClick={() => {
                      onUpdateStatus(table.id, 'WAITING_PAYMENT', 'Tetamu meminta bil');
                      onClose();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Minta Bil (Tukar ke WAITING_PAYMENT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStartOrder(table, table.activeGuestCount || 2);
                      onClose();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition flex items-center justify-center gap-2 border border-stone-700"
                  >
                    <Utensils className="w-4 h-4 text-emerald-400" />
                    <span>Tambah Pesanan (Add-on Items)</span>
                  </button>
                </div>
              )}

              {table.status === 'WAITING_PAYMENT' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    id="table-paid-cleaning-btn"
                    onClick={() => {
                      onUpdateStatus(table.id, 'CLEANING', 'Bayaran selesai, meja perlu dibersihkan');
                      onClose();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 text-yellow-300 text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Bayaran Selesai &rarr; Sedia Dibersihkan (CLEANING)</span>
                  </button>
                </div>
              )}

              {table.status === 'CLEANING' && (
                <button
                  type="button"
                  id="table-finish-cleaning-btn"
                  onClick={() => {
                    onUpdateStatus(table.id, 'AVAILABLE', 'Meja telah dibersihkan sepenuhnya');
                    onClose();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesai Bersih &rarr; Set Meja KOSONG (AVAILABLE)</span>
                </button>
              )}

              {/* Pertukaran Status Manual Tambahan */}
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Kawalan Status Pantas (SES v4.5)
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {table.status !== 'AVAILABLE' && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStatus(table.id, 'AVAILABLE', manualReason || 'Dikosongkan secara manual');
                        onClose();
                      }}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-stone-700 text-left"
                    >
                      Set <strong>AVAILABLE</strong>
                    </button>
                  )}

                  {table.status !== 'RESERVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenReservationModal(table);
                        onClose();
                      }}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-purple-300 border border-stone-700 text-left"
                    >
                      Daftar <strong>Tempahan</strong>
                    </button>
                  )}

                  {table.status !== 'CLEANING' && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStatus(table.id, 'CLEANING', manualReason || 'Dihantar untuk pembersihan');
                        onClose();
                      }}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-yellow-300 border border-stone-700 text-left"
                    >
                      Set <strong>CLEANING</strong>
                    </button>
                  )}

                  {table.status !== 'UNAVAILABLE' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStatus(table.id, 'UNAVAILABLE', manualReason || 'Meja ditutup sementara / rosak');
                        onClose();
                      }}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-rose-400 border border-stone-700 text-left"
                    >
                      Set <strong>UNAVAILABLE</strong>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStatus(table.id, 'AVAILABLE', 'Meja dibuka semula selepas penyelenggaraan');
                        onClose();
                      }}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-stone-700 text-left"
                    >
                      Buka Semula (AVAILABLE)
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Audit Trail View */
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-stone-400 mb-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Semua rekod perubahan status meja dijejaki secara audit:</span>
              </div>

              {tableLogs.length === 0 ? (
                <div className="py-8 text-center text-stone-500 text-xs">
                  Tiada rekod perubahan status untuk meja ini setakat ini.
                </div>
              ) : (
                tableLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 space-y-1 font-mono"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-300 font-bold">
                        {log.previousStatus} &rarr; <span className="text-emerald-400">{log.newStatus}</span>
                      </span>
                      <span className="text-stone-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 font-sans flex items-center justify-between">
                      <span>Oleh: <strong className="text-stone-300">{log.changedBy}</strong></span>
                      <span className="italic text-stone-500">{log.reason || 'Tiada catatan'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-stone-800 bg-stone-950/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
