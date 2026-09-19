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

const TABLE_STORAGE_PREFIX = 'syncrozz_tables_';
const RESERVATION_STORAGE_PREFIX = 'syncrozz_reservations_';
const TABLE_AUDIT_STORAGE_PREFIX = 'syncrozz_table_audit_';

export const INITIAL_TABLES: RestaurantTable[] = [
  {
    id: 'tbl-01',
    storeId: 'default',
    tableNumber: 'T01',
    zone: 'Dewan Utama',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-02',
    storeId: 'default',
    tableNumber: 'T02',
    zone: 'Dewan Utama',
    capacity: 2,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-03',
    storeId: 'default',
    tableNumber: 'T03',
    zone: 'Dewan Utama',
    capacity: 4,
    status: 'AVAILABLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tbl-04',
    storeId: 'default',
    tableNumber: 'T04',
    zone: 'Dewan Utama',
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
    tableNumber: 'VIP-1',
    zone: 'Bilik VIP',
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
   * Dapatkan semua meja untuk workspace aktif, disegerakkan dengan tempahan aktif
   */
  static getTables(workspaceSlug: string = 'default'): RestaurantTable[] {
    let tables: RestaurantTable[] = [];
    try {
      const raw = localStorage.getItem(this.getTableStorageKey(workspaceSlug));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tables = parsed;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca senarai meja dari localStorage:', e);
    }

    if (tables.length === 0) {
      tables = INITIAL_TABLES.map((t) => ({ ...t, storeId: workspaceSlug }));
      this.saveTables(tables, workspaceSlug);
    }

    // Segerakkan amaran tempahan akan datang / aktif
    const reservations = this.getReservations(workspaceSlug);
    return tables.map((tbl) => {
      const tableReservations = reservations.filter(
        (r) => r.tableId === tbl.id && r.status === 'PENDING'
      );
      // Susun mengikut masa tempahan secara kronologi
      tableReservations.sort(
        (a, b) => TableService.parseReservationDateTime(a).getTime() - TableService.parseReservationDateTime(b).getTime()
      );

      // Cari tempahan hari ini terlebih dahulu, atau tempahan akan datang terdekat
      const todayPending = tableReservations.filter((r) => TableService.isReservationForToday(r));
      const activeRes = todayPending.length > 0 ? todayPending[0] : (tableReservations.length > 0 ? tableReservations[0] : undefined);

      return {
        ...tbl,
        activeReservation: activeRes,
        upcomingReservations: tableReservations,
      };
    });
  }

  /**
   * Pembantu untuk menghuraikan tarikh & masa tempahan ke objek Date yang sah
   */
  static parseReservationDateTime(reservation: TableReservation): Date {
    const todayStr = new Date().toISOString().split('T')[0];
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
          return {
            ...tbl,
            ...tableData,
            updatedAt: now,
          };
        }
        return tbl;
      });
      this.saveTables(updated, workspaceSlug);
      return updated;
    } else {
      const newTable: RestaurantTable = {
        id: `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: workspaceSlug,
        tableNumber: tableData.tableNumber.trim().toUpperCase(),
        zone: tableData.zone.trim() || 'Dewan Utama',
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
          return parsed;
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
    const todayStr = now.split('T')[0];
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
