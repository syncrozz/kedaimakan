/**
 * SYNCROZZ KEDAI MAKAN - Interactive Table Grid Component (SES v4.5)
 * Paparan grid meja interaktif dengan 6 status meja berkod warna,
 * amaran tempahan akan datang, penapis zon, dan integrasi pesanan POS.
 */

import React, { useState, useMemo } from 'react';
import { RestaurantTable, TableStatus, TableReservation } from '../../types/restaurant';
import { formatCurrency } from '../../services/formatters';
import { TableService } from '../../services/tableService';
import {
  Users,
  Clock,
  Receipt,
  Calendar,
  Sparkles,
  Ban,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react';

interface TableGridViewProps {
  tables: RestaurantTable[];
  onSelectTable: (table: RestaurantTable) => void;
  onOpenNewTableModal?: () => void;
  onRefresh?: () => void;
}

export const TableGridView: React.FC<TableGridViewProps> = ({
  tables,
  onSelectTable,
  onOpenNewTableModal,
  onRefresh,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'ALL'>('ALL');

  // Senarai zon unik
  const zones = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => {
      const z = t.zone?.toLowerCase() === 'dewan utama' ? 'Dalam' : t.zone;
      if (z) set.add(z);
    });
    return Array.from(set);
  }, [tables]);

  // Statistik status meja
  const stats = useMemo(() => {
    return {
      total: tables.length,
      available: tables.filter((t) => t.status === 'AVAILABLE').length,
      occupied: tables.filter((t) => t.status === 'OCCUPIED').length,
      waitingPayment: tables.filter((t) => t.status === 'WAITING_PAYMENT').length,
      reserved: tables.filter((t) => t.status === 'RESERVED').length,
      cleaning: tables.filter((t) => t.status === 'CLEANING').length,
      unavailable: tables.filter((t) => t.status === 'UNAVAILABLE').length,
    };
  }, [tables]);

  // Kenal pasti semua tempahan aktif & akan datang pada hari berkenaan (SES v4.5)
  // Tidak terhad kepada 60 minit; meliputi tempahan beberapa jam lagi pada hari yang sama.
  const todayReservations = useMemo(() => {
    const list: { table: RestaurantTable; reservation: TableReservation }[] = [];
    tables.forEach((t) => {
      const candidates =
        t.upcomingReservations && t.upcomingReservations.length > 0
          ? t.upcomingReservations
          : t.activeReservation
          ? [t.activeReservation]
          : [];

      candidates.forEach((r) => {
        if (TableService.isReservationForToday(r)) {
          if (!list.some((item) => item.reservation.id === r.id)) {
            list.push({ table: t, reservation: r });
          }
        }
      });
    });

    // Susun mengikut masa tempahan secara kronologi
    return list.sort(
      (a, b) =>
        TableService.parseReservationDateTime(a.reservation).getTime() -
        TableService.parseReservationDateTime(b.reservation).getTime()
    );
  }, [tables]);

  // Penapisan meja mengikut zon dan status
  const filteredTables = useMemo(() => {
    return tables.filter((tbl) => {
      const tblZone = tbl.zone?.toLowerCase() === 'dewan utama' ? 'Dalam' : tbl.zone;
      const matchZone = selectedZone === 'ALL' || tblZone === selectedZone;
      const matchStatus = statusFilter === 'ALL' || tbl.status === statusFilter;
      return matchZone && matchStatus;
    });
  }, [tables, selectedZone, statusFilter]);

  const getStatusColorConfig = (status: TableStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          bg: 'bg-stone-900 hover:border-emerald-500/80 border-stone-800',
          badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          accent: 'text-emerald-400',
          dot: 'bg-emerald-500',
          label: 'Tersedia',
        };
      case 'OCCUPIED':
        return {
          bg: 'bg-sky-950/20 hover:border-sky-500/80 border-sky-800/60',
          badgeBg: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
          accent: 'text-sky-400',
          dot: 'bg-sky-500',
          label: 'Diduduki',
        };
      case 'WAITING_PAYMENT':
        return {
          bg: 'bg-amber-950/20 hover:border-amber-500/80 border-amber-800/60 ring-1 ring-amber-500/30',
          badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          accent: 'text-amber-400',
          dot: 'bg-amber-500 animate-pulse',
          label: 'Minta Bil',
        };
      case 'RESERVED':
        return {
          bg: 'bg-purple-950/20 hover:border-purple-500/80 border-purple-800/60',
          badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
          accent: 'text-purple-400',
          dot: 'bg-purple-500',
          label: 'Ditempah',
        };
      case 'CLEANING':
        return {
          bg: 'bg-yellow-950/20 hover:border-yellow-500/80 border-yellow-800/60',
          badgeBg: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/60',
          accent: 'text-yellow-400',
          dot: 'bg-yellow-500',
          label: 'Perlu Dibersihkan',
        };
      case 'UNAVAILABLE':
        return {
          bg: 'bg-stone-900/50 border-stone-800/60 opacity-60',
          badgeBg: 'bg-stone-800 text-stone-400 border-stone-700',
          accent: 'text-stone-500',
          dot: 'bg-stone-600',
          label: 'Tutup / Rosak',
        };
    }
  };

  return (
    <div id="restaurant-table-grid-view" className="space-y-4">
      {/* Bar Statistik Status Meja (6 Status SES v4.5) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'AVAILABLE'
              ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Tersedia</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.available}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'OCCUPIED'
              ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Diduduki</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.occupied}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'WAITING_PAYMENT' ? 'ALL' : 'WAITING_PAYMENT')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'WAITING_PAYMENT'
              ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Minta Bil</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.waitingPayment}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'RESERVED' ? 'ALL' : 'RESERVED')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'RESERVED'
              ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Ditempah</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.reserved}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'CLEANING' ? 'ALL' : 'CLEANING')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'CLEANING'
              ? 'bg-yellow-950/40 border-yellow-500 ring-1 ring-yellow-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Bersihkan</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.cleaning}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'UNAVAILABLE' ? 'ALL' : 'UNAVAILABLE')}
          className={`p-2.5 rounded-xl border transition text-left ${
            statusFilter === 'UNAVAILABLE'
              ? 'bg-stone-800 border-stone-600 ring-1 ring-stone-500'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400">
            <span className="w-2 h-2 rounded-full bg-stone-600" />
            <span>Tutup</span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">{stats.unavailable}</div>
        </button>
      </div>

      {/* Bar Kawalan: Penapis Zon & Butang Tambahan */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-2.5 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedZone('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedZone === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            Semua Zon ({tables.length})
          </button>

          {zones.map((zone) => {
            const countInZone = tables.filter(
              (t) => (t.zone?.toLowerCase() === 'dewan utama' ? 'Dalam' : t.zone) === zone
            ).length;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setSelectedZone(zone)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedZone === zone
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {zone} ({countInZone})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="text-xs text-stone-400 hover:text-white underline px-2"
            >
              Kosongkan Penapis
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
              title="Muat Semula Status Meja"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Banner Amaran Tempahan Hari Ini (SES v4.5 - Kenal pasti tempahan aktif & beberapa jam lagi) */}
      {todayReservations.length > 0 && (
        <div
          id="today-reservations-warning-banner"
          className="p-3 bg-purple-950/40 border border-purple-800/80 rounded-2xl shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-600/30 text-purple-300">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Peringatan Tempahan Hari Ini</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-mono">
                    {todayReservations.length} Tempahan
                  </span>
                </h4>
                <p className="text-[11px] text-purple-300">
                  Tempahan aktif &amp; akan datang pada hari ini. Maklumat dipaparkan tanpa menghalang operasi meja walk-in sedia ada.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {todayReservations.map(({ table, reservation }) => {
              const timeDiff = TableService.getReservationTimeDiffLabel(reservation);
              return (
                <button
                  key={reservation.id}
                  type="button"
                  onClick={() => onSelectTable(table)}
                  className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/60 border border-purple-700/60 text-left transition"
                  title={`Klik untuk lihat Meja ${table.tableNumber}`}
                >
                  <span className="font-mono font-bold text-xs text-white bg-purple-950 px-1.5 py-0.5 rounded border border-purple-700/80">
                    {table.tableNumber}
                  </span>
                  <div className="text-[11px] leading-tight">
                    <div className="font-semibold text-purple-100 flex items-center gap-1">
                      <span>{reservation.customerName}</span>
                      <span className="text-[10px] text-purple-300">({reservation.pax} Pax)</span>
                    </div>
                    <div className="text-[10px] text-purple-300 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-white">{reservation.reservationTime}</span>
                      <span>&bull;</span>
                      <span className="text-amber-300 font-medium">{timeDiff}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Kad Meja */}
      {filteredTables.length === 0 ? (
        <div className="py-16 text-center bg-stone-900/40 border border-stone-800 rounded-2xl">
          <LayoutGrid className="w-10 h-10 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">Tiada meja dijumpai.</p>
          <p className="text-xs text-stone-500 mt-1">Cuba ubah penapis zon atau status di atas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3.5">
          {filteredTables.map((table) => {
            const config = getStatusColorConfig(table.status);
            const activeRes = table.activeReservation;
            const hasActiveReservation = Boolean(activeRes);
            const isToday = activeRes ? TableService.isReservationForToday(activeRes) : false;
            const timeDiffLabel = activeRes ? TableService.getReservationTimeDiffLabel(activeRes) : '';

            return (
              <div
                key={table.id}
                id={`table-card-${table.tableNumber.toLowerCase()}`}
                onClick={() => onSelectTable(table)}
                className={`cursor-pointer border rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-150 transform hover:-translate-y-0.5 shadow-sm ${config.bg}`}
              >
                {/* Atas: Nombor Meja & Lencana Status */}
                <div>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-9 min-w-[2.25rem] px-2 rounded-xl border flex items-center justify-center font-mono font-bold text-sm ${
                          table.tableNumber.startsWith('VIP')
                            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                            : 'bg-stone-950 border-stone-800 text-white'
                        }`}
                      >
                        {table.tableNumber.replace(/^VIP-(\d+)$/i, 'VIP$1')}
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block leading-tight">
                          {table.zone?.toLowerCase() === 'dewan utama' ? 'Dalam' : table.zone}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                          <Users className="w-3 h-3 text-stone-500" />
                          <span>{table.capacity} Pax</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${config.badgeBg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        <span>{config.label}</span>
                      </span>

                      {/* Lencana Peringatan Tempahan Hari Ini jika meja belum berstatus RESERVED */}
                      {hasActiveReservation && table.status !== 'RESERVED' && isToday && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-purple-300">
                          Tempahan Hari Ini
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amaran Tempahan Aktif / Akan Datang (SES v4.5 Mandatori) */}
                  {/* Memaparkan nama pelanggan, masa tempahan, bilangan pax, dan jarak masa */}
                  {hasActiveReservation && activeRes && (
                    <div className="my-2 p-2.5 rounded-xl bg-purple-950/60 border border-purple-700/70 text-purple-200 text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-1 font-bold text-purple-300">
                        <span className="flex items-center gap-1 truncate">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span className="truncate">{activeRes.customerName}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/90 text-amber-300 font-mono font-semibold shrink-0">
                          {timeDiffLabel}
                        </span>
                      </div>

                      <div className="text-[10px] text-stone-300 flex items-center justify-between">
                        <span>Masa: <strong className="text-white font-mono">{activeRes.reservationTime}</strong></span>
                        <span className="font-semibold text-purple-200">{activeRes.pax} Pax</span>
                      </div>

                      {/* Peringatan SES v4.5: Jangan sekat operasi berlebihan jika meja masih AVAILABLE */}
                      {table.status === 'AVAILABLE' && (
                        <div className="text-[10px] text-amber-300/90 pt-1 border-t border-purple-800/40 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Tersedia untuk walk-in sebelum {activeRes.reservationTime}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bawah: Maklumat Pesanan Aktif jika diduduki atau menunggu bayaran */}
                {table.activeOrder && (
                  <div className="pt-2 border-t border-stone-800/60 mt-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1 text-stone-400">
                        <Receipt className="w-3 h-3 text-sky-400" />
                        <span>{table.activeOrder.itemsCount} item</span>
                      </div>
                      <span className="font-bold text-emerald-400 text-sm">
                        {formatCurrency(table.activeOrder.netAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
