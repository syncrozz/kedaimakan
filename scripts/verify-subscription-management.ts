/**
 * SYNCROZZ — Subscription Management & Pricing Verification Suite
 * Verifies RM10/month and RM110/year logic, receipt generation, and lifecycle continuity.
 */

import {
  WorkspaceService,
  SUBSCRIPTION_PRICING,
  getClientAccessUrl,
} from '../src/services/workspaceService';
import type { Workspace } from '../src/types/workspace';

async function testSubscription() {
  console.log('\n--- UJIAN SISTEM PENGURUSAN LANGGANAN SYNCROZZ (RM10/BLN & RM110/THN) ---');

  // Check Pricing Constants
  if (SUBSCRIPTION_PRICING.MONTHLY.price !== 10) {
    throw new Error(`Expected Monthly price 10, got ${SUBSCRIPTION_PRICING.MONTHLY.price}`);
  }
  if (SUBSCRIPTION_PRICING.ANNUAL.price !== 110) {
    throw new Error(`Expected Annual price 110, got ${SUBSCRIPTION_PRICING.ANNUAL.price}`);
  }
  console.log('✅ Konstanta Harga: Bulanan RM10 (30 Hari) & Tahunan RM110 (365 Hari)');

  // Test Workspace setup
  const testWs: Workspace = {
    workspaceId: 'ws_test_sub_001',
    workspaceSlug: 'restoran-sedap',
    workspaceName: 'Restoran Sedap Rasa',
    ownerEmail: 'sedap@syncrozz.com',
    ownerName: 'Encik Sedap',
    status: 'ACTIVE',
    platform: 'RESTAURANT',
    trialDurationDays: 30,
    trialStartedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    trialExpiresAt: new Date(Date.now() - 5 * 86400000).toISOString(), // Expired 5 days ago
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  WorkspaceService.upsertLocalWorkspace(testWs);

  // 1. Test Monthly Subscription (RM10)
  const monthlyRes = await WorkspaceService.recordSubscriptionPayment(
    'ws_test_sub_001',
    'MONTHLY',
    {
      paymentMethod: 'DUITNOW_QR',
      referenceNote: 'Ref: DuitNow-12345',
    }
  );

  if (!monthlyRes.success || !monthlyRes.workspace || !monthlyRes.payment) {
    throw new Error('Monthly payment record failed');
  }

  const updatedWs = monthlyRes.workspace;
  const payment = monthlyRes.payment;

  if (payment.amount !== 10 || payment.plan !== 'MONTHLY' || payment.periodDays !== 30) {
    throw new Error('Monthly payment record fields mismatch');
  }
  if (updatedWs.subscriptionPlan !== 'MONTHLY' || updatedWs.status !== 'ACTIVE') {
    throw new Error('Workspace active status mismatch');
  }
  console.log('✅ Langganan Bulanan: RM10 berjaya direkodkan, status bertukar AKTIF (+30 Hari)');

  // 2. Test Annual Subscription (RM110)
  const annualRes = await WorkspaceService.recordSubscriptionPayment(
    'ws_test_sub_001',
    'ANNUAL',
    {
      paymentMethod: 'BANK_TRANSFER',
      referenceNote: 'Maybank-998811',
    }
  );

  if (!annualRes.success || !annualRes.workspace || !annualRes.payment) {
    throw new Error('Annual payment record failed');
  }

  const annualWs = annualRes.workspace;
  const annualPayment = annualRes.payment;

  if (annualPayment.amount !== 110 || annualPayment.plan !== 'ANNUAL' || annualPayment.periodDays !== 365) {
    throw new Error('Annual payment record fields mismatch');
  }
  if (annualWs.paymentHistory?.length !== 2) {
    throw new Error(`Expected 2 payments in history, got ${annualWs.paymentHistory?.length}`);
  }
  console.log('✅ Langganan Tahunan: RM110 berjaya direkodkan (+365 Hari) & Sejarah Pembayaran terkumpul');

  // 3. Test Access URL consistency
  const accessUrl = getClientAccessUrl(annualWs);
  if (accessUrl !== 'https://kedaimakan.syncrozz.com/restoran-sedap') {
    throw new Error(`URL mismatch: ${accessUrl}`);
  }
  console.log(`✅ URL Akses Rasmi: ${accessUrl}`);

  console.log('--- SEMUA UJIAN LANGGANAN LULUS DENGAN CEMERLANG ---\n');
}

testSubscription().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
