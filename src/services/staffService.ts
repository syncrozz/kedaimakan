/**
 * NiagaPOS - Staff Domain Service
 * Part 07: Optional Retail Modules - Staff & Cashier Foundation
 *
 * Rules:
 * 1. Simple, robust user/staff model for cashier and operational attribution.
 * 2. Roles: OWNER, MANAGER, CASHIER, INVENTORY_STAFF.
 * 3. Attribution snapshot on sales, purchases, and inventory movements.
 */

import { StaffUser, StaffRole } from '../types';

export const STORE_OWNER_ID = 'store-owner';
export const STORE_OWNER_NAME = 'Store Owner';

export const VALID_STAFF_ROLES: StaffRole[] = [
  'OWNER',
  'MANAGER',
  'CASHIER',
  'INVENTORY_STAFF',
];

export interface CreateStaffInput {
  userCode?: string;
  staffCode?: string;
  name: string;
  role: StaffRole;
  active?: boolean;
}

export interface UpdateStaffInput {
  userCode?: string;
  staffCode?: string;
  name?: string;
  role?: StaffRole;
  active?: boolean;
}

export class StaffService {
  /**
   * Generates next sequential user code (e.g. STF-001, STF-002).
   */
  public static generateUserCode(existingStaff: StaffUser[]): string {
    let nextNum = 1;
    for (const s of existingStaff) {
      if (!s) continue;
      const codeToMatch = s.userCode || s.staffCode;
      if (!codeToMatch) continue;
      const match = codeToMatch.match(/STF[-_]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }
    }
    return `STF-${String(nextNum).padStart(3, '0')}`;
  }

  public static generateNextStaffCode(existingStaff: StaffUser[]): string {
    return this.generateUserCode(existingStaff);
  }

  /**
   * Checks user code uniqueness.
   */
  public static isUserCodeUnique(
    code: string,
    existingStaff: StaffUser[],
    excludeId?: string
  ): boolean {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return false;
    return !existingStaff.some(
      (s) =>
        s.id !== excludeId &&
        ((s.userCode && s.userCode.trim().toUpperCase() === normalized) ||
          (s.staffCode && s.staffCode.trim().toUpperCase() === normalized))
    );
  }

  /**
   * Creates a new staff member.
   */
  public static createStaff(
    input: CreateStaffInput,
    existingStaff: StaffUser[]
  ): StaffUser {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      throw new Error('Staff name is required.');
    }

    if (!VALID_STAFF_ROLES.includes(input.role)) {
      throw new Error(`Invalid role "${input.role}". Allowed roles: ${VALID_STAFF_ROLES.join(', ')}.`);
    }

    let code = (input.staffCode || input.userCode)?.trim().toUpperCase();
    if (!code) {
      code = this.generateUserCode(existingStaff);
    } else {
      if (!this.isUserCodeUnique(code, existingStaff)) {
        throw new Error(`Staff code "${code}" is already in use.`);
      }
    }

    const now = new Date().toISOString();
    return {
      id: `stf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userCode: code,
      staffCode: code,
      name: trimmedName,
      role: input.role,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Updates an existing staff member.
   */
  public static updateStaff(
    staffId: string,
    updates: UpdateStaffInput,
    existingStaff: StaffUser[]
  ): StaffUser {
    const target = existingStaff.find((s) => s.id === staffId);
    if (!target) {
      throw new Error(`Staff with ID "${staffId}" not found.`);
    }

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Staff name cannot be empty.');
      }
    }

    if (updates.role !== undefined) {
      if (!VALID_STAFF_ROLES.includes(updates.role)) {
        throw new Error(`Invalid role "${updates.role}". Allowed roles: ${VALID_STAFF_ROLES.join(', ')}.`);
      }
    }

    const newCode = (updates.staffCode || updates.userCode)?.trim().toUpperCase();
    if (newCode !== undefined) {
      if (!newCode) {
        throw new Error('Staff code cannot be empty.');
      }
      if (!this.isUserCodeUnique(newCode, existingStaff, staffId)) {
        throw new Error(`Staff code "${newCode}" is already in use.`);
      }
    }

    const resolvedCode = newCode !== undefined ? newCode : (target.userCode || target.staffCode || '');

    return {
      ...target,
      name: updates.name !== undefined ? updates.name.trim() : target.name,
      role: updates.role !== undefined ? updates.role : target.role,
      userCode: resolvedCode,
      staffCode: resolvedCode,
      active: updates.active !== undefined ? updates.active : target.active,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns active staff members.
   */
  public static getActiveStaff(staff: StaffUser[]): StaffUser[] {
    return staff.filter((s) => s.active);
  }

  public static getActiveStaffMembers(staff: StaffUser[]): StaffUser[] {
    return this.getActiveStaff(staff);
  }

  /**
   * Returns active staff members with CASHIER role who can operate the POS register.
   */
  public static getActiveCashiers(staff: StaffUser[]): StaffUser[] {
    if (!Array.isArray(staff)) return [];
    return staff.filter((s) => s && s.active && s.role === 'CASHIER');
  }

  /**
   * Sanitizes staff members to remove any legacy unauthorized or outdated names.
   */
  public static sanitizeStaffMembers(staff: StaffUser[]): StaffUser[] {
    if (!Array.isArray(staff)) return [];
    return staff.map((s) => {
      if (!s || !s.name) return s;
      const lower = s.name.toLowerCase();
      if (lower.includes('pak samad') || lower.includes('samad')) {
        return {
          ...s,
          name: s.role === 'OWNER' ? 'Pemilik Kedai' : 'Kakitangan Kedai',
        };
      }
      return s;
    });
  }

  /**
   * Resolves the current cashier name snapshot for POS transactions.
   * If a valid active cashier staff is provided, uses their name.
   * Otherwise falls back strictly to "Store Owner".
   */
  public static getCashierSnapshot(staffUser?: StaffUser | null): {
    cashierIdSnapshot: string;
    cashierNameSnapshot: string;
  } {
    if (staffUser && staffUser.active && staffUser.role === 'CASHIER') {
      return {
        cashierIdSnapshot: staffUser.id,
        cashierNameSnapshot: staffUser.name,
      };
    }
    return {
      cashierIdSnapshot: STORE_OWNER_ID,
      cashierNameSnapshot: STORE_OWNER_NAME,
    };
  }
}
