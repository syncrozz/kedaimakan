/**
 * SYNCROZZ KEDAI MAKAN - Table Management & Reservation Service (SES v4.5)
 * Mengendalikan kitaran hidup 6 status meja, sambungan pesanan aktif,
 * amaran tempahan akan datang, dan audit trail per-workspace.
 * Tiada perubahan pada data runcit sedia ada.
 */

import {
  RestaurantTable,
  TableStatus,
  TableReservation,
  TableStatusAuditEntry,
  RestaurantActiveOrderSummary,
} from '../types/restaurant';
import { getLocalDateString } from './formatters';

const TABLE_STORAGE_PREFIX = 'syncrozz_tables_';
const RESERVATION_STORAGE_PREFIX = 'syncrozz_reservations_';
const TABLE_AUDIT_STORAGE_PREFIX = 'syncrozz_table_audit_';

export const INITIAL_TABLES: RestaurantTable[] = [
  {
    id: 'tbl-01',
    storeId: 'default',
    tableNumber: 'T01',
    zone: 'Dalam',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-02',
    storeId: 'default',
    tableNumber: 'T02',
    zone: 'Dalam',
    capacity: 2,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-03',
    storeId: 'default',
    tableNumber: 'T03',
    zone: 'Dalam',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-04',
    storeId: 'default',
    tableNumber: 'T04',
    zone: 'Dalam',
    capacity: 6,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-05',
    storeId: 'default',
    tableNumber: 'T05',
    zone: 'Luar / Terbuka',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-06',
    storeId: 'default',
    tableNumber: 'T06',
    zone: 'Luar / Terbuka',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-07',
    storeId: 'default',
    tableNumber: 'T07',
    zone: 'Luar / Terbuka',
    capacity: 8,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-08',
    storeId: 'default',
    tableNumber: 'VIP1',
    zone: 'Meja VIP',
    capacity: 10,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
];

export class TableService {
  private static getTableStorageKey(workspaceSlug: string = 'default'): string {
    return `${TABLE_STORAGE_PREFIX}${workspaceSlug}`;
  }

  private static getReservationStorageKey(workspaceSlug: string = 'default'): string {
    return `${RESERVATION_STORAGE_PREFIX}${workspaceSlug}`;
  }

  private static getAuditStorageKey(workspaceSlug: string = 'default'): string {
    return `${TABLE_AUDIT_STORAGE_PREFIX}${workspaceSlug}`;
  }

  /**
   * Migrasi automatik SES v4.5:
   * - Menukar zon 'Dewan Utama' / 'dewan utama' -> 'Dalam'
   * - Menukar zon 'Bilik VIP' / 'bilik vip' -> 'Meja VIP'
   * - Menukar format nombor meja 'VIP-1' -> 'VIP1', 'VIP-2' -> 'VIP2'
   */
  static migrateLegacyZonesAndTableNumbers(tables: RestaurantTable[]): RestaurantTable[] {
    return tables.map((t) => {
      let newZone = t.zone;
      let newTableNumber = t.tableNumber;

      if (t.zone?.trim().toLowerCase() === 'dewan utama') {
        newZone = 'Dalam';
      }

      if (t.zone?.trim().toLowerCase() === 'bilik vip' || t.zone?.trim() === 'Bilik VIP') {
        newZone = 'Meja VIP';
      }

      // Tukar format 'VIP-1' -> 'VIP1' atau 'VIP-2' -> 'VIP2'
      const vipMatch = t.tableNumber.match(/^VIP-(\d+)$/i);
      if (vipMatch) {
        newTableNumber = `VIP${vipMatch[1]}`;
      }

      if (newZone !== t.zone || newTableNumber !== t.tableNumber) {
        return { ...t, zone: newZone, tableNumber: newTableNumber };
      }
      return t;
    });
  }

  /**
   * Dapatkan semua meja untuk workspace aktif, disegerakkan dengan tempahan aktif
   */
  static getTables(workspaceSlug: string = 'default'): RestaurantTable[] {
    let tables: RestaurantTable[] = [];
    let hasStorageRecord = false;

    try {
      const raw = localStorage.getItem(this.getTableStorageKey(workspaceSlug));
      if (raw !== null) {
        hasStorageRecord = true;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tables = parsed;
        }
      }
      // Semak jika pengguna telah memilih untuk mengosongkan meja
      const isCleared = localStorage.getItem(`syncrozz_tables_cleared_${workspaceSlug}`) === 'true';
      if (isCleared && tables.length === 0) {
        return [];
      }
    } catch (e) {
      console.warn('Gagal membaca senarai meja dari localStorage:', e);
    }

    if (!hasStorageRecord) {
      tables = INITIAL_TABLES.map((t) => ({ ...t, storeId: workspaceSlug }));
      this.saveTables(tables, workspaceSlug);
    } else if (tables.length > 0) {
      // Migrasi automatik SES v4.5: 'Dewan Utama' -> 'Dalam' dan 'VIP-1' -> 'VIP1'
      const migrated = this.migrateLegacyZonesAndTableNumbers(tables);
      const wasUpdated = migrated.some(
        (t, idx) => t.zone !== tables[idx]?.zone || t.tableNumber !== tables[idx]?.tableNumber
      );
      if (wasUpdated) {
        tables = migrated;
        this.saveTables(tables, workspaceSlug);
      }
    }

    // Segerakkan amaran tempahan akan datang / aktif
    const reservations = this.getReservations(workspaceSlug);
    return tables.map((tbl) => {
      const tableReservations = reservations.filter(
        (r) => r.tableId === tbl.id && r.status === 'PENDING'
      );
      // Susun mengikut masa tempahan secara kronologi
      tableReservations.sort(
        (a, b) =>
          this.parseReservationDateTime(a).getTime() - this.parseReservationDateTime(b).getTime()
      );

      // Cari tempahan hari ini terlebih dahulu, atau tempahan akan datang terdekat
      const todayPending = tableReservations.filter((r) => this.isReservationForToday(r));
      const activeRes = todayPending.length > 0 ? todayPending[0] : (tableReservations.length > 0 ? tableReservations[0] : undefined);

      return {
        ...tbl,
        activeReservation: activeRes,
        upcomingReservations: tableReservations,
      };
    });
  }

  /**
   * Muat meja contoh hanya atas arahan jelas pengguna (Explicit User Action)
   */
  static loadSampleTables(workspaceSlug: string = 'default'): RestaurantTable[] {
    const tables = INITIAL_TABLES.map((t) => ({ ...t, storeId: workspaceSlug }));
    this.saveTables(tables, workspaceSlug);
    localStorage.removeItem(`syncrozz_tables_cleared_${workspaceSlug}`);
    return tables;
  }

  /**
   * Mengosongkan data meja tanpa kebangkitan semula automatik
   */
  static clearTables(workspaceSlug: string = 'default'): void {
    this.saveTables([], workspaceSlug);
    try {
      localStorage.setItem(`syncrozz_tables_cleared_${workspaceSlug}`, 'true');
    } catch (e) {
      console.error('Gagal menetapkan tanda meja kosong:', e);
    }
  }

  /**
   * Pembantu untuk menghuraikan tarikh & masa tempahan ke objek Date yang sah
   */
  static parseReservationDateTime(reservation: TableReservation): Date {
    const todayStr = getLocalDateString();
    const dateStr =
      reservation.reservationDate ||
      (reservation.createdAt ? reservation.createdAt.split('T')[0] : todayStr);
    const timeStr = (reservation.reservationTime || '').trim();

    if (timeStr.includes('T')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) return d;
    }

    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const d = new Date(dateStr + 'T00:00:00');
      d.setHours(hours, minutes, 0, 0);
      return d;
    }

    const fallback = new Date(`${dateStr} ${timeStr}`);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  }

  /**
   * Menyemak sama ada tempahan adalah pada hari berkenaan (hari ini)
   */
  static isReservationForToday(reservation: TableReservation): boolean {
    if (reservation.status !== 'PENDING') return false;
    const targetDate = this.parseReservationDateTime(reservation);
    const today = new Date();
    return (
      targetDate.getFullYear() === today.getFullYear() &&
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getDate() === today.getDate()
    );
  }

  /**
   * Menjana label jarak masa tempahan (tidak dihadkan kepada 60 minit)
   * Menyokong amaran beberapa jam lagi pada hari yang sama.
   */
  static getReservationTimeDiffLabel(reservation: TableReservation): string {
    const target = this.parseReservationDateTime(reservation);
    const now = new Date();
    const diffMinutes = Math.round((target.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes < -15) {
      return 'Lewat';
    } else if (diffMinutes <= 0) {
      return 'Masa Sekarang';
    } else if (diffMinutes < 60) {
      return `Lagi ${diffMinutes} minit`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (mins === 0) {
        return `Lagi ${hours} jam`;
      }
      return `Lagi ${hours}j ${mins}m`;
    }
  }

  static saveTables(tables: RestaurantTable[], workspaceSlug: string = 'default'): void {
    try {
      localStorage.setItem(this.getTableStorageKey(workspaceSlug), JSON.stringify(tables));
    } catch (e) {
      console.error('Gagal menyimpan data meja ke localStorage:', e);
    }
  }

  /**
   * Mengemas kini status meja beserta Audit Trail (SES v4.5)
   */
  static updateTableStatus(
    tableId: string,
    newStatus: TableStatus,
    operatorName: string = 'Cashier',
    reason?: string,
    orderSummary?: RestaurantActiveOrderSummary,
    workspaceSlug: string = 'default'
  ): { updatedTable: RestaurantTable | null; tables: RestaurantTable[] } {
    const tables = this.getTables(workspaceSlug);
    let updatedTarget: RestaurantTable | null = null;

    const updatedTables = tables.map((tbl) => {
      if (tbl.id === tableId) {
        const prevStatus = tbl.status;
        const now = new Date().toISOString();

        // Rakam audit trail
        this.recordAuditEntry({
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tableId: tbl.id,
          tableNumber: tbl.tableNumber,
          previousStatus: prevStatus,
          newStatus,
          changedBy: operatorName,
          timestamp: now,
          reason: reason || `Status ditukar daripada ${prevStatus} kepada ${newStatus}`,
          orderId: orderSummary?.orderId || tbl.currentOrderId,
        }, workspaceSlug);

        const updated: RestaurantTable = {
          ...tbl,
          status: newStatus,
          updatedAt: now,
        };

        if (newStatus === 'OCCUPIED') {
          if (orderSummary) {
            updated.currentOrderId = orderSummary.orderId;
            updated.activeOrder = orderSummary;
            updated.activeGuestCount = orderSummary.pax;
          }
          if (!updated.occupiedSince) {
            updated.occupiedSince = now;
          }
        } else if (newStatus === 'AVAILABLE') {
          // Bersihkan pesanan aktif apabila kembali tersedia
          updated.currentOrderId = undefined;
          updated.activeOrder = undefined;
          updated.activeGuestCount = undefined;
          updated.occupiedSince = undefined;
        } else if (newStatus === 'CLEANING') {
          // Tetamu selesai bayar, rekod pesanan selesai disimpan
          updated.currentOrderId = undefined;
          updated.activeOrder = undefined;
          updated.activeGuestCount = undefined;
          updated.occupiedSince = undefined;
        } else if (newStatus === 'WAITING_PAYMENT') {
          // Kekalkan pesanan aktif sementara bil dibayar
          if (orderSummary) {
            updated.activeOrder = orderSummary;
          }
        }

        updatedTarget = updated;
        return updated;
      }
      return tbl;
    });

    this.saveTables(updatedTables, workspaceSlug);
    return { updatedTable: updatedTarget, tables: updatedTables };
  }

  /**
   * Menghubungkan pesanan Dine-In yang disahkan kepada Meja (Status bertukar ke OCCUPIED)
   */
  static bindActiveOrderToTable(
    tableNumber: string,
    orderSummary: RestaurantActiveOrderSummary,
    operatorName: string = 'Cashier',
    workspaceSlug: string = 'default'
  ): RestaurantTable[] {
    const tables = this.getTables(workspaceSlug);
    const target = tables.find(
      (t) => t.tableNumber.toUpperCase() === tableNumber.toUpperCase()
    );

    if (target) {
      const res = this.updateTableStatus(
        target.id,
        'OCCUPIED',
        operatorName,
        `Pesanan Dine-In disahkan #${orderSummary.orderId.slice(-6)}`,
        orderSummary,
        workspaceSlug
      );
      return res.tables;
    }
    return tables;
  }

  /**
   * Menjana nombor meja VIP baharu secara automatik (VIP1, VIP2, VIP3, ...)
   */
  static getNextVipTableNumber(tables: RestaurantTable[]): string {
    let maxVipNum = 0;
    tables.forEach((t) => {
      const match = t.tableNumber.match(/^VIP-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxVipNum) maxVipNum = num;
      }
    });
    return `VIP${maxVipNum + 1}`;
  }

  /**
   * Menjana nombor meja biasa baharu secara automatik (T01, T02, ...)
   */
  static getNextTableNumber(tables: RestaurantTable[]): string {
    let maxT = 0;
    tables.forEach((t) => {
      const match = t.tableNumber.match(/^T(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxT) maxT = num;
      }
    });
    return `T${String(maxT + 1).padStart(2, '0')}`;
  }

  /**
   * Menambah atau mengemas kini struktur Meja (Kapasiti, Zon, Nombor)
   */
  static saveTableDefinition(
    tableData: Partial<RestaurantTable> & { tableNumber: string; capacity: number; zone: string },
    workspaceSlug: string = 'default'
  ): RestaurantTable[] {
    const tables = this.getTables(workspaceSlug);
    const now = new Date().toISOString();

    if (tableData.id) {
      const updated = tables.map((tbl) => {
        if (tbl.id === tableData.id) {
          let tableNumber = (tableData.tableNumber || tbl.tableNumber).trim().toUpperCase();
          const vipMatch = tableNumber.match(/^VIP[-\s]?(\d+)$/i);
          if (vipMatch) tableNumber = `VIP${parseInt(vipMatch[1], 10)}`;

          // Pengesahan pencegahan nombor meja bertindih (SES v4.5)
          const isDuplicate = tables.some(
            (other) => other.id !== tbl.id && other.tableNumber.trim().toUpperCase() === tableNumber
          );
          if (isDuplicate) {
            throw new Error(`Nombor meja "${tableNumber}" sudah wujud. Sila pilih nombor lain.`);
          }

          return {
            ...tbl,
            ...tableData,
            tableNumber,
            updatedAt: now,
          };
        }
        return tbl;
      });
      this.saveTables(updated, workspaceSlug);
      return updated;
    } else {
      let finalTableNumber = (tableData.tableNumber || '').trim().toUpperCase();
      const finalZone = tableData.zone.trim() || 'Dalam';

      // Selaras format jika ditaip VIP-1 / VIP 1 / vip-2 -> VIP1 / VIP2
      const vipMatch = finalTableNumber.match(/^VIP[-\s]?(\d+)$/i);
      if (vipMatch) {
        finalTableNumber = `VIP${parseInt(vipMatch[1], 10)}`;
      }

      // Jika nombor meja tidak diisi, berikan nombor auto mengikut zon
      if (!finalTableNumber) {
        if (finalZone === 'Meja VIP' || finalZone === 'Bilik VIP') {
          finalTableNumber = this.getNextVipTableNumber(tables);
        } else {
          finalTableNumber = this.getNextTableNumber(tables);
        }
      }

      // Pengesahan pencegahan nombor meja bertindih (SES v4.5)
      const isDuplicate = tables.some(
        (tbl) => tbl.tableNumber.trim().toUpperCase() === finalTableNumber
      );
      if (isDuplicate) {
        throw new Error(`Nombor meja "${finalTableNumber}" sudah wujud. Sila gunakan nombor meja lain.`);
      }

      const newTable: RestaurantTable = {
        id: `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: workspaceSlug,
        tableNumber: finalTableNumber,
        zone: finalZone,
        capacity: Number(tableData.capacity) || 4,
        status: 'AVAILABLE',
        updatedAt: now,
      };
      const updated = [...tables, newTable];
      this.saveTables(updated, workspaceSlug);
      return updated;
    }
  }

  static deleteTableDefinition(tableId: string, workspaceSlug: string = 'default'): RestaurantTable[] {
    const tables = this.getTables(workspaceSlug);
    const updated = tables.filter((t) => t.id !== tableId);
    this.saveTables(updated, workspaceSlug);
    return updated;
  }

  // ==========================================
  // TEMPAHAN / RESERVATION MANAGEMENT (SES v4.5)
  // ==========================================

  static getReservations(workspaceSlug: string = 'default'): TableReservation[] {
    try {
      const raw = localStorage.getItem(this.getReservationStorageKey(workspaceSlug));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          let resMigrated = false;
          const cleaned = parsed.map((r: TableReservation) => {
            const m = r.tableNumber?.match(/^VIP-(\d+)$/i);
            if (m) {
              resMigrated = true;
              return { ...r, tableNumber: `VIP${m[1]}` };
            }
            return r;
          });
          if (resMigrated) {
            this.saveReservations(cleaned, workspaceSlug);
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca senarai tempahan dari localStorage:', e);
    }
    return [];
  }

  static saveReservations(reservations: TableReservation[], workspaceSlug: string = 'default'): void {
    try {
      localStorage.setItem(this.getReservationStorageKey(workspaceSlug), JSON.stringify(reservations));
    } catch (e) {
      console.error('Gagal menyimpan tempahan ke localStorage:', e);
    }
  }

  static addReservation(
    input: Omit<TableReservation, 'id' | 'createdAt' | 'updatedAt' | 'storeId'> & {
      setTableStatusReserved?: boolean;
    },
    operatorName: string = 'Cashier',
    workspaceSlug: string = 'default'
  ): { reservation: TableReservation; tables: RestaurantTable[] } {
    const reservations = this.getReservations(workspaceSlug);
    const now = new Date().toISOString();
    const todayStr = getLocalDateString();
    const newRes: TableReservation = {
      ...input,
      id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      storeId: workspaceSlug,
      reservationDate: input.reservationDate || todayStr,
      createdAt: now,
      updatedAt: now,
    };

    const updatedReservations = [newRes, ...reservations];
    this.saveReservations(updatedReservations, workspaceSlug);

    // SES v4.5: Amaran tempahan aktif & tempahan akan datang pada hari berkenaan.
    // Jika setTableStatusReserved !== false, status meja bertukar ke RESERVED.
    // Jika false (meja masih beberapa jam lagi dan dibenarkan guna walk-in),
    // status meja kekal sedia ada dan lencana amaran tempahan akan dipaparkan dengan jelas.
    if (input.setTableStatusReserved !== false) {
      this.updateTableStatus(
        input.tableId,
        'RESERVED',
        operatorName,
        `Tempahan oleh ${input.customerName} (${input.pax} pax) pada ${input.reservationTime}`,
        undefined,
        workspaceSlug
      );
    }

    const updatedTables = this.getTables(workspaceSlug);
    return { reservation: newRes, tables: updatedTables };
  }

  static updateReservationStatus(
    reservationId: string,
    newStatus: 'SEATED' | 'CANCELLED' | 'NO_SHOW',
    operatorName: string = 'Cashier',
    workspaceSlug: string = 'default'
  ): { tables: RestaurantTable[] } {
    const reservations = this.getReservations(workspaceSlug);
    let targetTableId: string | null = null;

    const updatedRes = reservations.map((r) => {
      if (r.id === reservationId) {
        targetTableId = r.tableId;
        return {
          ...r,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    this.saveReservations(updatedRes, workspaceSlug);

    if (targetTableId) {
      if (newStatus === 'CANCELLED' || newStatus === 'NO_SHOW') {
        this.updateTableStatus(
          targetTableId,
          'AVAILABLE',
          operatorName,
          `Tempahan ditandakan sebagai ${newStatus}`,
          undefined,
          workspaceSlug
        );
      }
    }

    const tables = this.getTables(workspaceSlug);
    return { tables };
  }

  // ==========================================
  // AUDIT TRAIL LOGGING (SES v4.5)
  // ==========================================

  static getAuditEntries(workspaceSlug: string = 'default'): TableStatusAuditEntry[] {
    try {
      const raw = localStorage.getItem(this.getAuditStorageKey(workspaceSlug));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca audit log meja dari localStorage:', e);
    }
    return [];
  }

  private static recordAuditEntry(entry: TableStatusAuditEntry, workspaceSlug: string = 'default'): void {
    try {
      const logs = this.getAuditEntries(workspaceSlug);
      const updated = [entry, ...logs.slice(0, 199)]; // Simpan 200 rekod audit terkini
      localStorage.setItem(this.getAuditStorageKey(workspaceSlug), JSON.stringify(updated));
    } catch (e) {
      console.error('Gagal merekod audit status meja:', e);
    }
  }
}
