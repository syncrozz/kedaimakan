/**
 * SYNCROZZ KEDAI MAKAN - Kitchen Order Ticket (KOT) & Kitchen Display System (KDS) Service
 * Fasa 3 — Step 2 (SES v4.5)
 *
 * Implements:
 * - Real-time Firestore synchronization with offline local fallback
 * - Strict multi-tenant isolation by workspaceSlug
 * - Idempotent KOT generation (no duplicates on retry or refresh)
 * - Order item snapshot with change markers (ORIGINAL, ADDED, REMOVED, UPDATED)
 * - Automatic status workflow: NEW -> PREPARING -> READY -> ARCHIVED
 * - Status reversal: READY -> PREPARING upon material order changes
 * - Auto-archive of READY tickets after 5 minutes
 * - In-memory / Web Audio API new KOT sound notification
 * - Comprehensive kitchen audit trail
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { FirebaseService } from './firebaseService';
import {
  KitchenOrderTicket,
  KitchenOrderItemSnapshot,
  KitchenTicketStatus,
  KitchenAuditRecord,
  RestaurantOrderType,
  RestaurantOrderItem,
} from '../types/restaurant';

export class KotService {
  private static activeUnsubscribers: Map<string, Unsubscribe> = new Map();
  private static audioCtx: AudioContext | null = null;

  // Local storage keys
  private static getStorageKey(workspaceSlug: string): string {
    return `niagapos_kot_${(workspaceSlug || 'default').toLowerCase()}`;
  }

  private static getAuditStorageKey(workspaceSlug: string): string {
    return `niagapos_kot_audit_${(workspaceSlug || 'default').toLowerCase()}`;
  }

  // ----------------------------------------------------
  // LOCAL CACHE ACCESS
  // ----------------------------------------------------

  public static getCachedTickets(workspaceSlug: string): KitchenOrderTicket[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey(workspaceSlug));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Ensure all tickets belong strictly to this workspace
      return parsed.filter((t) => t.workspaceSlug === workspaceSlug.toLowerCase());
    } catch {
      return [];
    }
  }

  public static saveTicketsToCache(workspaceSlug: string, tickets: KitchenOrderTicket[]): void {
    try {
      const cleanSlug = workspaceSlug.toLowerCase();
      const filtered = tickets.filter((t) => t.workspaceSlug === cleanSlug);
      localStorage.setItem(this.getStorageKey(cleanSlug), JSON.stringify(filtered));
    } catch (err) {
      console.warn('[KotService] Failed to cache tickets locally:', err);
    }
  }

  public static getCachedAuditLogs(workspaceSlug: string): KitchenAuditRecord[] {
    try {
      const raw = localStorage.getItem(this.getAuditStorageKey(workspaceSlug));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static recordAuditLog(
    workspaceSlug: string,
    entry: Omit<KitchenAuditRecord, 'id' | 'timestamp' | 'workspaceSlug'>
  ): KitchenAuditRecord {
    const cleanSlug = workspaceSlug.toLowerCase();
    const record: KitchenAuditRecord = {
      id: `kaudit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceSlug: cleanSlug,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Save locally
    const logs = this.getCachedAuditLogs(cleanSlug);
    logs.unshift(record);
    if (logs.length > 500) logs.pop();
    try {
      localStorage.setItem(this.getAuditStorageKey(cleanSlug), JSON.stringify(logs));
    } catch {
      // ignore
    }

    // Save to Firestore asynchronously
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const ref = doc(db, 'workspaces', cleanSlug, 'kitchenAudit', record.id);
        setDoc(ref, JSON.parse(JSON.stringify(record))).catch((e) => {
          console.warn('[KotService] Firestore audit log failed:', e);
        });
      } catch {
        // ignore
      }
    }

    return record;
  }

  // ----------------------------------------------------
  // IDEMPOTENT KOT GENERATION (VG-01, VG-02)
  // ----------------------------------------------------

  /**
   * Generates or retrieves an existing KOT for a confirmed order.
   * If a KOT for this workspaceSlug + orderId already exists, returns the existing ticket
   * without creating a duplicate.
   */
  public static async createOrGetKitchenTicket(
    orderData: {
      orderId: string;
      orderNumber?: string;
      tableId?: string;
      tableName?: string;
      orderType: RestaurantOrderType;
      items: RestaurantOrderItem[];
      customerName?: string;
      guestCount?: number;
      notes?: string;
      operator?: string;
    },
    workspaceSlug: string
  ): Promise<{ ticket: KitchenOrderTicket | null; isNew: boolean }> {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();
    const existingTickets = this.getCachedTickets(cleanSlug);

    // Check if KOT already exists for this orderId (Idempotency check)
    const existing = existingTickets.find((t) => t.orderId === orderData.orderId);
    if (existing) {
      return { ticket: existing, isNew: false };
    }

    // Directive 7: Filter out retail items - retail products must not enter KOT/KDS by default (SES v4.5)
    const kitchenEligibleItems = orderData.items.filter((it) => it.itemType !== 'RETAIL');
    if (kitchenEligibleItems.length === 0) {
      return { ticket: null, isNew: false };
    }

    // Convert RestaurantOrderItem to KitchenOrderItemSnapshot
    const snapshotItems: KitchenOrderItemSnapshot[] = kitchenEligibleItems.map((it) => {
      const modifiers = (it.selectedModifiers || []).map(
        (m) => `${m.groupName ? m.groupName + ': ' : ''}${m.optionName}`
      );
      return {
        itemId: it.id,
        productId: it.menuItemId || it.id,
        name: it.nameSnapshot,
        quantity: it.quantity,
        previousQuantity: it.quantity,
        variant: it.selectedVariant ? it.selectedVariant.name : (it.selectedModifiers && it.selectedModifiers.length > 0 ? it.selectedModifiers[0].optionName : undefined),
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        notes: it.specialInstructions,
        unitPrice: it.unitTotal,
        changeType: 'ORIGINAL',
        category: it.categorySnapshot,
        kitchenStation: it.kitchenStation,
        updatedAt: new Date().toISOString(),
      };
    });

    const now = new Date().toISOString();
    const kotId = `KOT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const readableOrderNum = orderData.orderNumber || orderData.orderId;

    const newTicket: KitchenOrderTicket = {
      id: kotId,
      workspaceSlug: cleanSlug,
      orderId: orderData.orderId,
      orderNumber: readableOrderNum,
      tableId: orderData.tableId,
      tableName: orderData.tableName || (orderData.tableId ? `Meja ${orderData.tableId}` : undefined),
      orderType: orderData.orderType,
      status: 'NEW',
      items: snapshotItems,
      createdAt: now,
      updatedAt: now,
      hasUnreadUpdate: true,
      customerName: orderData.customerName,
      guestCount: orderData.guestCount,
      notes: orderData.notes,
      changeHistory: [
        {
          timestamp: now,
          changeDescription: 'Pesanan baharu disahkan dari Restaurant POS',
          changedBy: orderData.operator || 'Cashier',
          itemsSummary: `${snapshotItems.length} hidangan dimasukkan`,
          newStatus: 'NEW',
        },
      ],
    };

    // Save locally
    const updatedTickets = [newTicket, ...existingTickets];
    this.saveTicketsToCache(cleanSlug, updatedTickets);

    // Save to Firestore
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const ref = doc(db, 'workspaces', cleanSlug, 'kitchenOrders', newTicket.id);
        await setDoc(ref, JSON.parse(JSON.stringify(newTicket)));
      } catch (err) {
        console.warn('[KotService] Failed to sync new KOT to Firestore:', err);
      }
    }

    // Record audit event
    this.recordAuditLog(cleanSlug, {
      kotId: newTicket.id,
      orderId: newTicket.orderId,
      action: 'KOT_CREATED',
      performedBy: orderData.operator || 'Cashier',
      newStatus: 'NEW',
      details: {
        orderType: newTicket.orderType,
        table: newTicket.tableName,
        itemsCount: snapshotItems.length,
      },
    });

    return { ticket: newTicket, isNew: true };
  }

  // ----------------------------------------------------
  // ORDER MODIFICATION & CHANGE MARKERS (VG-05, VG-12)
  // ----------------------------------------------------

  /**
   * Synchronizes changes to an existing order (added items, removed items, updated quantities/notes).
   * If the ticket is currently in READY status, material changes revert it to PREPARING.
   * Marks items with ADDED, REMOVED, or UPDATED.
   */
  public static async syncOrderUpdateToKitchenTicket(
    orderId: string,
    newItems: RestaurantOrderItem[],
    newNotes: string | undefined,
    operator: string,
    workspaceSlug: string
  ): Promise<KitchenOrderTicket | null> {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();
    const tickets = this.getCachedTickets(cleanSlug);
    const index = tickets.findIndex((t) => t.orderId === orderId);

    if (index === -1) return null;
    const ticket = tickets[index];

    const now = new Date().toISOString();
    const previousItems = ticket.items;
    const previousStatus = ticket.status;

    // Detect material changes
    const updatedItemsList: KitchenOrderItemSnapshot[] = [];
    const changeDescriptions: string[] = [];

    // Map existing active items
    const existingMap = new Map<string, KitchenOrderItemSnapshot>();
    for (const item of previousItems) {
      existingMap.set(item.productId + '_' + (item.notes || ''), item);
    }

    // Directive 7: Filter out retail items - retail products must not enter KOT/KDS by default (SES v4.5)
    const kitchenEligibleNewItems = newItems.filter((it) => it.itemType !== 'RETAIL');

    // Process new kitchen-eligible items
    for (const newItem of kitchenEligibleNewItems) {
      const prodId = newItem.menuItemId || newItem.id;
      const key = prodId + '_' + (newItem.specialInstructions || '');
      const existing = existingMap.get(key);

      const modifiers = (newItem.selectedModifiers || []).map(
        (m) => `${m.groupName ? m.groupName + ': ' : ''}${m.optionName}`
      );

      if (!existing) {
        // Item added
        updatedItemsList.push({
          itemId: newItem.id,
          productId: prodId,
          name: newItem.nameSnapshot,
          quantity: newItem.quantity,
          previousQuantity: 0,
          variant: newItem.selectedVariant ? newItem.selectedVariant.name : (newItem.selectedModifiers && newItem.selectedModifiers.length > 0 ? newItem.selectedModifiers[0].optionName : undefined),
          modifiers: modifiers.length > 0 ? modifiers : undefined,
          notes: newItem.specialInstructions,
          unitPrice: newItem.unitTotal,
          changeType: 'ADDED',
          category: newItem.categorySnapshot,
          kitchenStation: newItem.kitchenStation,
          updatedAt: now,
        });
        changeDescriptions.push(`Ditambah: +${newItem.quantity}x ${newItem.nameSnapshot}`);
      } else {
        // Item existed: check for quantity or details update
        existingMap.delete(key);
        if (existing.quantity !== newItem.quantity) {
          updatedItemsList.push({
            ...existing,
            quantity: newItem.quantity,
            previousQuantity: existing.quantity,
            notes: newItem.specialInstructions,
            changeType: 'UPDATED',
            updatedAt: now,
          });
          changeDescriptions.push(
            `Diubah: ${newItem.nameSnapshot} (${existing.quantity} &rarr; ${newItem.quantity})`
          );
        } else {
          // Unchanged
          updatedItemsList.push({
            ...existing,
            notes: newItem.specialInstructions,
            updatedAt: existing.updatedAt || now,
          });
        }
      }
    }

    // Any remaining items in existingMap were removed from the order
    for (const [, removedItem] of existingMap.entries()) {
      if (removedItem.changeType !== 'REMOVED') {
        updatedItemsList.push({
          ...removedItem,
          previousQuantity: removedItem.quantity,
          quantity: 0,
          changeType: 'REMOVED',
          updatedAt: now,
        });
        changeDescriptions.push(`Dibatalkan/Dibuang: ${removedItem.name}`);
      }
    }

    const hasMaterialChanges = changeDescriptions.length > 0 || (newNotes && newNotes !== ticket.notes);

    // Rule: If READY and material changes occur, revert back to PREPARING! (VG-12)
    let newStatus = ticket.status;
    if (ticket.status === 'READY' && hasMaterialChanges) {
      newStatus = 'PREPARING';
      changeDescriptions.unshift('Status diundur dari SIAP kembali ke SEDANG DISEDIAKAN kerana pindaan pesanan');
    }

    const updatedTicket: KitchenOrderTicket = {
      ...ticket,
      items: updatedItemsList,
      notes: newNotes !== undefined ? newNotes : ticket.notes,
      status: newStatus,
      updatedAt: now,
      hasUnreadUpdate: true, // Mark as unread so kitchen staff notices
      changeHistory: [
        ...(ticket.changeHistory || []),
        {
          timestamp: now,
          changeDescription: changeDescriptions.join(', ') || 'Pesanan dikemas kini',
          changedBy: operator,
          itemsSummary: `${updatedItemsList.filter((i) => i.changeType !== 'REMOVED').length} hidangan aktif`,
          previousStatus,
          newStatus,
        },
      ],
    };

    // Update local cache
    tickets[index] = updatedTicket;
    this.saveTicketsToCache(cleanSlug, tickets);

    // Update Firestore
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const ref = doc(db, 'workspaces', cleanSlug, 'kitchenOrders', updatedTicket.id);
        await updateDoc(ref, JSON.parse(JSON.stringify(updatedTicket)));
      } catch (err) {
        console.warn('[KotService] Failed to update KOT in Firestore:', err);
      }
    }

    // Record audit
    this.recordAuditLog(cleanSlug, {
      kotId: updatedTicket.id,
      orderId: updatedTicket.orderId,
      action: 'ORDER_MODIFIED',
      performedBy: operator,
      previousStatus,
      newStatus,
      details: {
        changes: changeDescriptions,
        hasMaterialChanges,
      },
    });

    return updatedTicket;
  }

  // ----------------------------------------------------
  // STATUS TRANSITION (VG-04, VG-06)
  // ----------------------------------------------------

  /**
   * Transitions KOT status:
   * NEW -> PREPARING
   * PREPARING -> READY
   * READY -> ARCHIVED
   * READY -> PREPARING (on order change)
   */
  public static async updateTicketStatus(
    ticketId: string,
    newStatus: KitchenTicketStatus,
    operator: string,
    workspaceSlug: string,
    reason?: string
  ): Promise<KitchenOrderTicket | null> {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();
    const tickets = this.getCachedTickets(cleanSlug);
    const index = tickets.findIndex((t) => t.id === ticketId);

    if (index === -1) return null;
    const ticket = tickets[index];
    const previousStatus = ticket.status;

    if (previousStatus === newStatus) {
      // Just clear unread marker if clicked
      if (ticket.hasUnreadUpdate) {
        ticket.hasUnreadUpdate = false;
        tickets[index] = ticket;
        this.saveTicketsToCache(cleanSlug, tickets);
      }
      return ticket;
    }

    const now = new Date().toISOString();
    const patch: Partial<KitchenOrderTicket> = {
      status: newStatus,
      updatedAt: now,
      hasUnreadUpdate: false, // staff acknowledged
    };

    if (newStatus === 'PREPARING' && !ticket.startedAt) {
      patch.startedAt = now;
    } else if (newStatus === 'READY') {
      patch.readyAt = now;
    } else if (newStatus === 'ARCHIVED') {
      patch.archivedAt = now;
    }

    const updatedTicket: KitchenOrderTicket = {
      ...ticket,
      ...patch,
      changeHistory: [
        ...(ticket.changeHistory || []),
        {
          timestamp: now,
          changeDescription: reason || `Status bertukar daripada ${previousStatus} ke ${newStatus}`,
          changedBy: operator,
          itemsSummary: `${ticket.items.length} item`,
          previousStatus,
          newStatus,
        },
      ],
    };

    // Update local cache
    tickets[index] = updatedTicket;
    this.saveTicketsToCache(cleanSlug, tickets);

    // Update Firestore
    const db = FirebaseService.getDb();
    if (db) {
      try {
        const ref = doc(db, 'workspaces', cleanSlug, 'kitchenOrders', updatedTicket.id);
        await updateDoc(ref, JSON.parse(JSON.stringify(patch)));
      } catch (err) {
        console.warn('[KotService] Failed to update ticket status in Firestore:', err);
      }
    }

    // Audit log
    this.recordAuditLog(cleanSlug, {
      kotId: updatedTicket.id,
      orderId: updatedTicket.orderId,
      action: newStatus === 'ARCHIVED' ? 'MANUAL_ARCHIVED' : 'STATUS_CHANGED',
      performedBy: operator,
      previousStatus,
      newStatus,
      details: { reason: reason || 'Manual transition by kitchen staff' },
    });

    return updatedTicket;
  }

  /**
   * Mark unread ticket as read/acknowledged
   */
  public static markAsRead(ticketId: string, workspaceSlug: string): void {
    const cleanSlug = workspaceSlug.toLowerCase();
    const tickets = this.getCachedTickets(cleanSlug);
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index !== -1 && tickets[index].hasUnreadUpdate) {
      tickets[index].hasUnreadUpdate = false;
      this.saveTicketsToCache(cleanSlug, tickets);

      const db = FirebaseService.getDb();
      if (db) {
        try {
          const ref = doc(db, 'workspaces', cleanSlug, 'kitchenOrders', ticketId);
          updateDoc(ref, { hasUnreadUpdate: false }).catch(() => {});
        } catch {
          // ignore
        }
      }
    }
  }

  // ----------------------------------------------------
  // AUTO-ARCHIVE READY TICKETS AFTER 5 MINUTES (VG-06)
  // ----------------------------------------------------

  /**
   * Scans tickets in READY status. If readyAt was >= 5 minutes ago (300,000ms),
   * transitions to ARCHIVED automatically.
   */
  public static async checkAndAutoArchiveTickets(
    workspaceSlug: string,
    operator: string = 'SYSTEM_AUTO_ARCHIVE'
  ): Promise<number> {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();
    const tickets = this.getCachedTickets(cleanSlug);
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    let countArchived = 0;

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'READY' && ticket.readyAt) {
        const readyTime = new Date(ticket.readyAt).getTime();
        if (now - readyTime >= FIVE_MINUTES_MS) {
          const nowIso = new Date().toISOString();
          ticket.status = 'ARCHIVED';
          ticket.archivedAt = nowIso;
          ticket.updatedAt = nowIso;
          ticket.changeHistory = [
            ...(ticket.changeHistory || []),
            {
              timestamp: nowIso,
              changeDescription: 'Auto-archive selepas 5 minit siap dihidang (SES v4.5)',
              changedBy: operator,
              itemsSummary: `${ticket.items.length} item`,
              previousStatus: 'READY',
              newStatus: 'ARCHIVED',
            },
          ];
          countArchived++;

          // Firestore update
          const db = FirebaseService.getDb();
          if (db) {
            try {
              const ref = doc(db, 'workspaces', cleanSlug, 'kitchenOrders', ticket.id);
              updateDoc(ref, {
                status: 'ARCHIVED',
                archivedAt: nowIso,
                updatedAt: nowIso,
              }).catch(() => {});
            } catch {
              // ignore
            }
          }

          // Audit record
          this.recordAuditLog(cleanSlug, {
            kotId: ticket.id,
            orderId: ticket.orderId,
            action: 'AUTO_ARCHIVED',
            performedBy: operator,
            previousStatus: 'READY',
            newStatus: 'ARCHIVED',
            details: { elapsedMinutes: Math.round((now - readyTime) / 60000) },
          });
        }
      }
    }

    if (countArchived > 0) {
      this.saveTicketsToCache(cleanSlug, tickets);
    }

    return countArchived;
  }

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTION & FALLBACK (VG-10)
  // ----------------------------------------------------

  /**
   * Subscribes to real-time KOT updates for the specified workspace.
   * Guarantees single active subscription per workspace (cancels prior subscription).
   */
  public static subscribeToKitchenOrders(
    workspaceSlug: string,
    onUpdate: (tickets: KitchenOrderTicket[], connectionState: 'CONNECTED' | 'SYNCING' | 'OFFLINE_FALLBACK') => void,
    onError?: (err: Error) => void
  ): () => void {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();

    // Clean up prior listener to prevent duplicate listeners
    this.unsubscribe(cleanSlug);

    // Initial delivery from local cache
    const initialLocal = this.getCachedTickets(cleanSlug);
    onUpdate(initialLocal, 'SYNCING');

    const db = FirebaseService.getDb();
    if (!db) {
      // Offline fallback mode
      onUpdate(initialLocal, 'OFFLINE_FALLBACK');
      return () => {};
    }

    try {
      const ordersCol = collection(db, 'workspaces', cleanSlug, 'kitchenOrders');
      const unsubscribe = onSnapshot(
        ordersCol,
        (snapshot) => {
          const tickets: KitchenOrderTicket[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as KitchenOrderTicket;
            if (data && data.workspaceSlug === cleanSlug) {
              tickets.push(data);
            }
          });

          // If Firestore is empty but we have local tickets, merge or preserve
          const finalTickets = tickets.length > 0 ? tickets : initialLocal;
          this.saveTicketsToCache(cleanSlug, finalTickets);
          onUpdate(finalTickets, 'CONNECTED');
        },
        (error) => {
          console.warn('[KotService] Real-time listener error, using fallback:', error);
          if (onError) onError(error);
          // Fallback to local cache
          const cached = this.getCachedTickets(cleanSlug);
          onUpdate(cached, 'OFFLINE_FALLBACK');
        }
      );

      this.activeUnsubscribers.set(cleanSlug, unsubscribe);

      return () => {
        this.unsubscribe(cleanSlug);
      };
    } catch (err) {
      console.warn('[KotService] Exception creating listener:', err);
      const cached = this.getCachedTickets(cleanSlug);
      onUpdate(cached, 'OFFLINE_FALLBACK');
      return () => {};
    }
  }

  public static unsubscribe(workspaceSlug: string): void {
    const cleanSlug = workspaceSlug.toLowerCase();
    const unsub = this.activeUnsubscribers.get(cleanSlug);
    if (unsub) {
      try {
        unsub();
      } catch {
        // ignore
      }
      this.activeUnsubscribers.delete(cleanSlug);
    }
  }

  /**
   * Explicit fetch to refresh KOTs from Firestore with local fallback
   */
  public static async refreshTickets(workspaceSlug: string): Promise<KitchenOrderTicket[]> {
    const cleanSlug = (workspaceSlug || 'default').trim().toLowerCase();
    const db = FirebaseService.getDb();
    if (!db) {
      return this.getCachedTickets(cleanSlug);
    }

    try {
      const ordersCol = collection(db, 'workspaces', cleanSlug, 'kitchenOrders');
      const snap = await getDocs(ordersCol);
      const tickets: KitchenOrderTicket[] = [];
      snap.forEach((d) => {
        const data = d.data() as KitchenOrderTicket;
        if (data && data.workspaceSlug === cleanSlug) {
          tickets.push(data);
        }
      });

      if (tickets.length > 0) {
        this.saveTicketsToCache(cleanSlug, tickets);
        return tickets;
      }
    } catch (err) {
      console.warn('[KotService] refreshTickets failed, returning cache:', err);
    }

    return this.getCachedTickets(cleanSlug);
  }

  // ----------------------------------------------------
  // SOUND NOTIFICATION (Web Audio API)
  // ----------------------------------------------------

  /**
   * Plays a pleasant 2-tone chime (587Hz -> 880Hz, D5 -> A5) for new KOT arrival.
   * Pure Web Audio API: 100% offline, zero external file dependencies.
   */
  public static playNewKotChime(): void {
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // Tone 2: 880.00 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.15);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.18, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.66);
    } catch {
      // Audio playback might be restricted if no user interaction yet, benign ignore
    }
  }
}
