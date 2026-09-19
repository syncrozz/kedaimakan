/**
 * SYNCROZZ KEDAI MAKAN - KOT History Modal (SES v4.5)
 * Displays archived & completed kitchen tickets with timestamps, snapshot items, and audit logs.
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  Search,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Filter,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { KitchenOrderTicket } from '../../types/restaurant';

interface KitchenHistoryModalProps {
  isOpen: boolean;
  tickets: KitchenOrderTicket[];
  workspaceSlug: string;
  onClose: () => void;
}

export const KitchenHistoryModal: React.FC<KitchenHistoryModalProps> = ({
  isOpen,
  tickets,
  workspaceSlug,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<KitchenOrderTicket | null>(null);

  const archivedTickets = useMemo(() => {
    return tickets
      .filter((t) => t.status === 'ARCHIVED')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return archivedTickets;
    const q = searchQuery.toLowerCase();
    return archivedTickets.filter((t) => {
      const matchOrder = t.orderNumber.toLowerCase().includes(q) || t.orderId.toLowerCase().includes(q);
      const matchTable = (t.tableName || '').toLowerCase().includes(q);
      const matchCustomer = (t.customerName || '').toLowerCase().includes(q);
      const matchItem = t.items.some((it) => it.name.toLowerCase().includes(q));
      return matchOrder || matchTable || matchCustomer || matchItem;
    });
  }, [archivedTickets, searchQuery]);

  if (!isOpen) return null;

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString('ms-MY', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const calculateDuration = (startIso?: string, endIso?: string) => {
    if (!startIso || !endIso) return '-';
    try {
      const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Sejarah KOT Dapur ({archivedTickets.length})
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-stone-300 uppercase">
                  {workspaceSlug}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Arkib tiket pesanan yang selesai dimasak dan dihidang (Auto-arkib 5 minit).
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-kitchen-history-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-stone-800/80 bg-stone-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Cari nombor pesanan, meja, atau nama hidangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Content Body: Left List & Right Detail */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Ticket List (5 cols) */}
          <div className="md:col-span-5 border-r border-stone-800 overflow-y-auto p-3 space-y-2 max-h-[60vh] md:max-h-none">
            {filteredTickets.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <span>Tiada rekod tiket diarkibkan ditemui.</span>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                const itemCount = t.items.reduce((acc, i) => acc + i.quantity, 0);
                const prepDuration = calculateDuration(t.startedAt, t.readyAt);

                return (
                  <div
                    key={t.id}
                    id={`history-ticket-card-${t.id}`}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3 rounded-2xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                        : 'bg-stone-950/60 border-stone-800/80 hover:bg-stone-850 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-white">{t.orderNumber}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        SIAP &bull; {prepDuration}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-400 mt-1.5">
                      <span>{t.tableName || (t.orderType === 'DINE_IN' ? 'Dine-In' : 'Bungkus')}</span>
                      <span className="font-mono text-stone-300">{itemCount} item</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-2 pt-2 border-t border-stone-850">
                      <Clock className="w-3 h-3" />
                      <span>Masuk: {formatTime(t.createdAt)} &bull; Arkib: {formatTime(t.archivedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Ticket Detail (7 cols) */}
          <div className="md:col-span-7 p-4 sm:p-5 overflow-y-auto bg-stone-950/40">
            {selectedTicket ? (
              <div className="space-y-4">
                {/* Detail Header */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">{selectedTicket.orderNumber}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {selectedTicket.tableName || selectedTicket.orderType} &bull; {selectedTicket.guestCount || 1} Pax
                      {selectedTicket.customerName ? ` &bull; ${selectedTicket.customerName}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-800 text-stone-200 border border-stone-700">
                      ARKIB
                    </span>
                  </div>
                </div>

                {/* Timeline Timestamps */}
                <div className="grid grid-cols-3 gap-2 bg-stone-900/60 border border-stone-800 rounded-2xl p-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-stone-500 block">Pesanan Dibuat</span>
                    <span className="font-mono font-bold text-stone-200">{formatTime(selectedTicket.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block">Mula Masak</span>
                    <span className="font-mono font-bold text-amber-400">{formatTime(selectedTicket.startedAt)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block">Selesai Siap</span>
                    <span className="font-mono font-bold text-emerald-400">{formatTime(selectedTicket.readyAt)}</span>
                  </div>
                </div>

                {/* Item List Snapshot */}
                <div>
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                    Snapshot Senarai Hidangan ({selectedTicket.items.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedTicket.items.map((it, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border flex items-start justify-between text-xs ${
                          it.changeType === 'REMOVED'
                            ? 'bg-rose-950/20 border-rose-900/40 text-rose-300/70 line-through'
                            : it.changeType === 'ADDED'
                            ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                            : it.changeType === 'UPDATED'
                            ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                            : 'bg-stone-900 border-stone-800/80 text-stone-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{it.quantity}x</span>
                            <span className="font-medium">{it.name}</span>
                            {it.changeType === 'ADDED' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white">
                                + BAHARU
                              </span>
                            )}
                            {it.changeType === 'UPDATED' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-600 text-white">
                                DIUBAH (Asal: {it.previousQuantity})
                              </span>
                            )}
                            {it.changeType === 'REMOVED' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white">
                                BATAL
                              </span>
                            )}
                          </div>
                          {it.modifiers && it.modifiers.length > 0 && (
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              {it.modifiers.join(', ')}
                            </p>
                          )}
                          {it.notes && (
                            <p className="text-[10px] text-amber-400/90 italic mt-0.5">
                              Nota: {it.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Change History Trail */}
                {selectedTicket.changeHistory && selectedTicket.changeHistory.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Kronologi &amp; Jejak Audit Perubahan
                    </h4>
                    <div className="space-y-1.5">
                      {selectedTicket.changeHistory.map((h, i) => (
                        <div
                          key={i}
                          className="text-[11px] p-2 bg-stone-900 border border-stone-800/80 rounded-xl flex items-start gap-2 text-stone-300"
                        >
                          <span className="font-mono text-stone-500 shrink-0">{formatTime(h.timestamp)}</span>
                          <div>
                            <span className="font-semibold text-white">{h.changedBy}:</span>{' '}
                            <span>{h.changeDescription}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs py-16">
                <FileText className="w-10 h-10 mb-2 opacity-30" />
                <span>Pilih tiket dari senarai kiri untuk melihat butiran lengkap.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
