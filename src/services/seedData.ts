/**
 * NiagaPOS - Initial Seed Data for Store
 * Clean Production Baseline: Zero demo items, suppliers, or customers.
 */

import { Store, Product, InventoryMovement, Sale, Supplier, Purchase, Customer, LoyaltyLedgerEntry, StaffUser } from '../types';

export const INITIAL_STORE: Store = {
  id: 'store-niagapos-v2-001',
  name: 'NiagaPOS',
  code: 'NP-01',
  currency: 'RM',
  tagline: 'Sistem POS & Inventori NiagaPOS',
  address: 'No. 12, Jalan Komuniti 3, Bandar Baru Bangi, Selangor',
  phone: '+60 12-345 6789',
  receiptFooter: 'Terima kasih atas urusan anda bersama NiagaPOS!',
  settings: {
    enableCustomerManagement: true,
    enableLoyalty: true,
    enableStaff: true,
    loyaltyPointsPerCurrency: 1,
    loyaltyRedemptionRatio: 100,
  },
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-09-01T08:00:00Z',
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_MOVEMENTS: InventoryMovement[] = [];

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PURCHASES: Purchase[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_LOYALTY_LEDGER: LoyaltyLedgerEntry[] = [];

export const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'stf-001',
    userCode: 'STF-001',
    staffCode: 'STF-001',
    name: 'Pemilik Kedai',
    role: 'OWNER',
    active: true,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'stf-002',
    userCode: 'STF-002',
    staffCode: 'STF-002',
    name: 'Ahmad',
    role: 'CASHIER',
    active: true,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'stf-003',
    userCode: 'STF-003',
    staffCode: 'STF-003',
    name: 'Siti',
    role: 'INVENTORY_STAFF',
    active: true,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
];
