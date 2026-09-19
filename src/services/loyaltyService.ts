/**
 * NiagaPOS - Loyalty & Rewards Domain Service
 * Part 07: Optional Retail Modules - Loyalty Ledger & Rewards
 *
 * Rules:
 * 1. Ledger-based accounting (every point earned, redeemed, or adjusted is an immutable ledger entry).
 * 2. Points calculated strictly from actual realized sales revenue (sale.total, after discount).
 * 3. Points awarded ONLY for completed sales (never void or failed).
 * 4. Duplicate point awards prevented (idempotency check by referenceId).
 * 5. Negative point balances strictly prohibited on redemption.
 */

import { Sale, LoyaltyLedgerEntry, LoyaltyEntryType } from '../types';

export class LoyaltyService {
  /**
   * Calculates points earned from realized revenue.
   * Default ratio: RM 1 = 1 point.
   */
  public static calculatePointsEarned(
    realizedRevenue: number,
    pointsPerCurrency: number = 1
  ): number {
    if (isNaN(realizedRevenue) || realizedRevenue <= 0) {
      return 0;
    }
    const ratio = isNaN(pointsPerCurrency) || pointsPerCurrency <= 0 ? 1 : pointsPerCurrency;
    return Math.floor(realizedRevenue * ratio);
  }

  /**
   * Computes the current net points balance for a customer from the immutable ledger.
   */
  public static calculatePointsBalance(
    customerId: string,
    ledger: LoyaltyLedgerEntry[]
  ): number {
    const total = ledger
      .filter((entry) => entry.customerId === customerId)
      .reduce((sum, entry) => sum + entry.points, 0);
    return Math.max(0, total);
  }

  /**
   * Awards loyalty points for a completed sale.
   * Enforces status validation and duplicate award protection.
   */
  public static awardPointsForSale(
    sale: Sale,
    customerId: string,
    existingLedger: LoyaltyLedgerEntry[],
    pointsPerCurrency: number = 1
  ): LoyaltyLedgerEntry | null {
    // Rule: Points awarded ONLY on COMPLETED sales
    if (sale.status !== 'COMPLETED') {
      return null;
    }

    // Rule: Sale must have positive realized revenue
    if (sale.total <= 0) {
      return null;
    }

    // Rule: Duplicate prevention - check if points for this sale have already been awarded
    const alreadyAwarded = existingLedger.some(
      (e) =>
        e.customerId === customerId &&
        e.type === 'EARNED' &&
        e.referenceId === sale.transactionNumber
    );
    if (alreadyAwarded) {
      return null;
    }

    const points = this.calculatePointsEarned(sale.total, pointsPerCurrency);
    if (points <= 0) {
      return null;
    }

    const entry: LoyaltyLedgerEntry = {
      id: `loy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId,
      points,
      type: 'EARNED',
      referenceId: sale.transactionNumber,
      description: `Earned from purchase ${sale.transactionNumber} (Total: RM ${sale.total.toFixed(2)})`,
      createdAt: sale.dateTime || new Date().toISOString(),
    };

    return entry;
  }

  /**
   * Processes a point redemption.
   * Throws error if redemption would cause a negative balance.
   */
  public static redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    referenceId: string,
    existingLedger: LoyaltyLedgerEntry[],
    description?: string
  ): LoyaltyLedgerEntry {
    if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
      throw new Error('Points to redeem must be a positive number.');
    }

    const currentBalance = this.calculatePointsBalance(customerId, existingLedger);
    if (currentBalance < pointsToRedeem) {
      throw new Error(
        `Insufficient loyalty points. Available: ${currentBalance}, Requested: ${pointsToRedeem}.`
      );
    }

    const entry: LoyaltyLedgerEntry = {
      id: `loy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId,
      points: -pointsToRedeem, // negative for redemption
      type: 'REDEEMED',
      referenceId,
      description: description || `Redeemed ${pointsToRedeem} points for reference ${referenceId}`,
      createdAt: new Date().toISOString(),
    };

    return entry;
  }

  /**
   * Creates a manual points adjustment (e.g. customer goodwill or administrative correction).
   */
  public static adjustPoints(
    customerId: string,
    adjustmentPoints: number,
    reason: string,
    existingLedger: LoyaltyLedgerEntry[]
  ): LoyaltyLedgerEntry {
    if (adjustmentPoints === 0) {
      throw new Error('Adjustment points cannot be zero.');
    }

    if (adjustmentPoints < 0) {
      const currentBalance = this.calculatePointsBalance(customerId, existingLedger);
      if (currentBalance + adjustmentPoints < 0) {
        throw new Error(
          `Adjustment of ${adjustmentPoints} would result in negative balance (Current: ${currentBalance}).`
        );
      }
    }

    const entry: LoyaltyLedgerEntry = {
      id: `loy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId,
      points: adjustmentPoints,
      type: 'ADJUSTMENT',
      referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
      description: reason || `Manual points adjustment of ${adjustmentPoints > 0 ? '+' : ''}${adjustmentPoints}`,
      createdAt: new Date().toISOString(),
    };

    return entry;
  }
}
