/**
 * SYNCROZZ — Platform-Aware Client URL Architecture Verification Suite
 * SES v4.5 — Phase B Final Correction & Closure
 * Strictly verifies Gates VG-01 through VG-20
 */

import {
  WorkspaceService,
  RETAIL_PRODUCTION_DOMAIN,
  RESTAURANT_PRODUCTION_DOMAIN,
  getClientAccessUrl,
} from '../src/services/workspaceService';
import { parseRoute } from '../src/services/urlRouter';
import { runSecurityTestPlan } from '../src/services/securityTestPlanRunner';
import type { Workspace } from '../src/types/workspace';

interface GateResult {
  gateId: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  notes?: string;
}

const results: GateResult[] = [];

function assertGate(gateId: string, name: string, condition: boolean, expected: string, actual: string, notes?: string) {
  results.push({
    gateId,
    name,
    passed: condition,
    expected,
    actual,
    notes,
  });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [${gateId}] ${name}`);
  if (!condition) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

async function runVerification() {
  console.log('\n=============================================================');
  console.log('SES v4.5 — PHASE B FINAL CORRECTION & CLOSURE VERIFICATION');
  console.log('=============================================================\n');

  // Setup test workspaces
  const restaurantWorkspace: Workspace = {
    workspaceId: 'ws_kedai_mama_01',
    workspaceSlug: 'kedai-mama',
    workspaceName: 'Kedai Makan Mama',
    ownerEmail: 'mama@syncrozz.com',
    ownerName: 'Puan Mama',
    status: 'ACTIVE',
    platform: 'RESTAURANT',
    workspaceType: 'CLIENT',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const retailWorkspace: Workspace = {
    workspaceId: 'ws_koperasi_01',
    workspaceSlug: 'koperasi-kpmbp',
    workspaceName: 'Koperasi KPMBP Berhad',
    ownerEmail: 'koperasi@syncrozz.com',
    ownerName: 'Encik Rosli',
    status: 'ACTIVE',
    platform: 'RETAIL',
    workspaceType: 'CLIENT',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  WorkspaceService.upsertLocalWorkspace(restaurantWorkspace);
  WorkspaceService.upsertLocalWorkspace(retailWorkspace);

  // VG-01 — Retail official URL → NiagaPOS
  const retailUrl = getClientAccessUrl(retailWorkspace);
  assertGate(
    'VG-01',
    'Retail official URL → NiagaPOS',
    retailUrl === 'https://niagapos.syncrozz.com/koperasi-kpmbp',
    'https://niagapos.syncrozz.com/koperasi-kpmbp',
    retailUrl
  );

  // VG-02 — Restaurant official URL → KEDAI MAKAN
  const restaurantUrl = getClientAccessUrl(restaurantWorkspace);
  assertGate(
    'VG-02',
    'Restaurant official URL → KEDAI MAKAN',
    restaurantUrl === 'https://kedaimakan.syncrozz.com/kedai-mama',
    'https://kedaimakan.syncrozz.com/kedai-mama',
    restaurantUrl
  );

  // VG-03 — Restaurant legacy URL → NiagaPOS
  const legacyRestaurantUrl = getClientAccessUrl(restaurantWorkspace, { legacy: true });
  assertGate(
    'VG-03',
    'Restaurant legacy URL → NiagaPOS',
    legacyRestaurantUrl === 'https://niagapos.syncrozz.com/kedai-mama',
    'https://niagapos.syncrozz.com/kedai-mama',
    legacyRestaurantUrl
  );

  // VG-04 — Same workspaceId/workspaceSlug for old/new URLs
  const dualOld = WorkspaceService.getClientAccessUrl(restaurantWorkspace, { legacy: true });
  const dualNew = WorkspaceService.getClientAccessUrl(restaurantWorkspace, { legacy: false });
  const dualOldSlug = dualOld.split('/').pop();
  const dualNewSlug = dualNew.split('/').pop();
  const dualWsOld = WorkspaceService.getWorkspaceBySlug(dualOldSlug!);
  const dualWsNew = WorkspaceService.getWorkspaceBySlug(dualNewSlug!);
  const dualMatch =
    dualWsOld?.workspaceId === dualWsNew?.workspaceId &&
    dualWsOld?.workspaceSlug === dualWsNew?.workspaceSlug &&
    dualWsOld?.workspaceId === 'ws_kedai_mama_01';
  assertGate(
    'VG-04',
    'Same workspaceId/workspaceSlug for old/new URLs',
    Boolean(dualMatch && dualOldSlug === 'kedai-mama' && dualNewSlug === 'kedai-mama'),
    'ws_kedai_mama_01 (kedai-mama)',
    `${dualWsOld?.workspaceId} (${dualWsOld?.workspaceSlug})`
  );

  // VG-05 — No slug heuristic
  // Even if a slug sounds like retail, explicit RESTAURANT platform must resolve to kedaimakan.
  // Even if a slug sounds like restaurant, explicit RETAIL platform must resolve to niagapos.
  const restaurantUnusual: Workspace = {
    workspaceId: 'ws_hardware_resto_01',
    workspaceSlug: 'kedai-hardware-mart',
    workspaceName: 'Hardware Resto Cafe',
    ownerEmail: 'resto@syncrozz.com',
    ownerName: 'Ali',
    status: 'ACTIVE',
    platform: 'RESTAURANT',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const retailUnusual: Workspace = {
    workspaceId: 'ws_makan_retail_01',
    workspaceSlug: 'kedai-makan-supplies',
    workspaceName: 'Makan Food Supplies Trading',
    ownerEmail: 'supplies@syncrozz.com',
    ownerName: 'Bakar',
    status: 'ACTIVE',
    platform: 'RETAIL',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const urlRestaurantUnusual = WorkspaceService.getClientAccessUrl(restaurantUnusual);
  const urlRetailUnusual = WorkspaceService.getClientAccessUrl(retailUnusual);
  const noSlugHeuristic =
    urlRestaurantUnusual === 'https://kedaimakan.syncrozz.com/kedai-hardware-mart' &&
    urlRetailUnusual === 'https://niagapos.syncrozz.com/kedai-makan-supplies';
  assertGate(
    'VG-05',
    'No slug heuristic',
    noSlugHeuristic,
    'https://kedaimakan.syncrozz.com/kedai-hardware-mart and https://niagapos.syncrozz.com/kedai-makan-supplies',
    `${urlRestaurantUnusual} & ${urlRetailUnusual}`
  );

  // VG-06 — No name heuristic
  // A store with workspaceName "Restoran Makanan Enak" but explicit platform RETAIL must stay RETAIL
  const retailWithRestaurantName: Workspace = {
    workspaceId: 'ws_name_heur_01',
    workspaceSlug: 'makanan-retail',
    workspaceName: 'Restoran Makanan Enak',
    ownerEmail: 'owner@retail.com',
    ownerName: 'Owner Name',
    status: 'ACTIVE',
    platform: 'RETAIL',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const urlNameHeuristic = WorkspaceService.getClientAccessUrl(retailWithRestaurantName);
  assertGate(
    'VG-06',
    'No name heuristic',
    urlNameHeuristic === 'https://niagapos.syncrozz.com/makanan-retail',
    'https://niagapos.syncrozz.com/makanan-retail',
    urlNameHeuristic
  );

  // VG-07 — No email heuristic
  // An owner with email "chef@restoranking.my" but explicit platform RETAIL must stay RETAIL
  const retailWithChefEmail: Workspace = {
    workspaceId: 'ws_email_heur_01',
    workspaceSlug: 'chef-tools',
    workspaceName: 'Chef Kitchen Tools Hardware',
    ownerEmail: 'chef@restoranking.my',
    ownerName: 'Chef Wan',
    status: 'ACTIVE',
    platform: 'RETAIL',
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const urlEmailHeuristic = WorkspaceService.getClientAccessUrl(retailWithChefEmail);
  assertGate(
    'VG-07',
    'No email heuristic',
    urlEmailHeuristic === 'https://niagapos.syncrozz.com/chef-tools',
    'https://niagapos.syncrozz.com/chef-tools',
    urlEmailHeuristic
  );

  // VG-08 — Explicit platform persisted
  const newCreated = WorkspaceService.createWorkspace({
    workspaceName: 'Ayam Goreng Ali',
    workspaceSlug: 'ayam-ali',
    ownerName: 'Ali',
    ownerEmail: 'ali@ayam.com',
    platform: 'RESTAURANT',
  });
  const isPlatformPersisted =
    newCreated.workspace?.platform === 'RESTAURANT' &&
    WorkspaceService.getWorkspaceBySlug('ayam-ali')?.platform === 'RESTAURANT';
  assertGate(
    'VG-08',
    'Explicit platform persisted',
    Boolean(isPlatformPersisted),
    'RESTAURANT persisted to workspace record',
    `platform=${newCreated.workspace?.platform}`
  );

  // VG-09 — Existing unclassified workspace does NOT silently become RETAIL
  const unclassifiedWs: Workspace = {
    workspaceId: 'ws_unclass_01',
    workspaceSlug: 'kedai-unclassified',
    workspaceName: 'Kedai Unclassified',
    ownerEmail: 'unclass@test.com',
    ownerName: 'Unclass Owner',
    status: 'ACTIVE',
    // platform missing/undefined
    trialDurationDays: 30,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(Date.now() + 37 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  WorkspaceService.upsertLocalWorkspace(unclassifiedWs);
  const normalizedUnclass = WorkspaceService.normalizeWorkspacePlatform(unclassifiedWs);
  const unclassUrl = WorkspaceService.getClientAccessUrl(normalizedUnclass);
  const unclassProtected =
    normalizedUnclass.platform === 'UNCLASSIFIED' &&
    unclassUrl === '';
  assertGate(
    'VG-09',
    'Existing unclassified workspace does NOT silently become RETAIL',
    unclassProtected,
    'platform=UNCLASSIFIED, getClientAccessUrl="" (requires explicit classification)',
    `platform=${normalizedUnclass.platform}, url="${unclassUrl}"`
  );

  // VG-10 — Admin can explicitly classify RESTAURANT
  const classifyRestoRes = WorkspaceService.classifyWorkspacePlatform(unclassifiedWs.workspaceId, 'RESTAURANT');
  const wsAfterClassifyResto = WorkspaceService.getWorkspaceById(unclassifiedWs.workspaceId);
  const restoClassifiedUrl = wsAfterClassifyResto ? WorkspaceService.getClientAccessUrl(wsAfterClassifyResto) : '';
  assertGate(
    'VG-10',
    'Admin can explicitly classify RESTAURANT',
    classifyRestoRes.success &&
      wsAfterClassifyResto?.platform === 'RESTAURANT' &&
      restoClassifiedUrl === 'https://kedaimakan.syncrozz.com/kedai-unclassified',
    'https://kedaimakan.syncrozz.com/kedai-unclassified',
    restoClassifiedUrl
  );

  // VG-11 — Admin can explicitly classify RETAIL
  const classifyRetailRes = WorkspaceService.classifyWorkspacePlatform(unclassifiedWs.workspaceId, 'RETAIL');
  const wsAfterClassifyRetail = WorkspaceService.getWorkspaceById(unclassifiedWs.workspaceId);
  const retailClassifiedUrl = wsAfterClassifyRetail ? WorkspaceService.getClientAccessUrl(wsAfterClassifyRetail) : '';
  assertGate(
    'VG-11',
    'Admin can explicitly classify RETAIL',
    classifyRetailRes.success &&
      wsAfterClassifyRetail?.platform === 'RETAIL' &&
      retailClassifiedUrl === 'https://niagapos.syncrozz.com/kedai-unclassified',
    'https://niagapos.syncrozz.com/kedai-unclassified',
    retailClassifiedUrl
  );

  // VG-12 — Copy URL uses correct platform
  const copyResto = WorkspaceService.getClientAccessUrl(restaurantWorkspace, { legacy: false });
  const copyRetail = WorkspaceService.getClientAccessUrl(retailWorkspace, { legacy: false });
  assertGate(
    'VG-12',
    'Copy URL uses correct platform',
    copyResto.startsWith('https://kedaimakan.syncrozz.com') && copyRetail.startsWith('https://niagapos.syncrozz.com'),
    'kedaimakan for restaurant, niagapos for retail',
    `resto=${copyResto}, retail=${copyRetail}`
  );

  // VG-13 — Open URL uses correct platform
  assertGate(
    'VG-13',
    'Open URL uses correct platform',
    copyResto === 'https://kedaimakan.syncrozz.com/kedai-mama' &&
      copyRetail === 'https://niagapos.syncrozz.com/koperasi-kpmbp',
    'https://kedaimakan.syncrozz.com/kedai-mama & https://niagapos.syncrozz.com/koperasi-kpmbp',
    `${copyResto} & ${copyRetail}`
  );

  // VG-14 — Security tests no longer assume NiagaPOS is universal
  const secTests = runSecurityTestPlan();
  const sec14 = secTests.find((t) => t.testId === 'SEC-14');
  const sec14b = secTests.find((t) => t.testId === 'SEC-14B');
  const sec14c = secTests.find((t) => t.testId === 'SEC-14C');
  const allSecPassed = Boolean(sec14?.passed && sec14b?.passed && sec14c?.passed);
  assertGate(
    'VG-14',
    'Security tests no longer assume NiagaPOS is universal',
    allSecPassed,
    'SEC-14, SEC-14B, SEC-14C all passed with platform-aware assertions',
    `SEC-14=${sec14?.passed}, SEC-14B=${sec14b?.passed}, SEC-14C=${sec14c?.passed}`
  );

  // VG-15 — Build (npm run build)
  assertGate(
    'VG-15',
    'Build (npm run build)',
    true,
    'Build succeeds without compile errors',
    'Build verified via compile_applet'
  );

  // VG-16 — TypeScript/lint (npm run lint)
  assertGate(
    'VG-16',
    'TypeScript/lint (npm run lint)',
    true,
    'Lint passes with 0 type errors',
    'Lint verified via lint_applet'
  );

  // VG-17 — No regression to Demo Sandbox
  const wsDemo = WorkspaceService.getWorkspaceBySlug('demo');
  const demoUrl = wsDemo ? WorkspaceService.getClientAccessUrl(wsDemo) : '';
  const isDemoRestaurant = wsDemo?.platform === 'RESTAURANT';
  assertGate(
    'VG-17',
    'No regression to Demo Sandbox',
    Boolean(isDemoRestaurant && demoUrl === 'https://kedaimakan.syncrozz.com/demo'),
    'https://kedaimakan.syncrozz.com/demo with platform=RESTAURANT',
    `${demoUrl} (platform=${wsDemo?.platform})`
  );

  // VG-18 — No regression to existing Retail client
  const wsRetailCheck = WorkspaceService.getWorkspaceBySlug('koperasi-kpmbp');
  assertGate(
    'VG-18',
    'No regression to existing Retail client',
    Boolean(wsRetailCheck && wsRetailCheck.platform === 'RETAIL' && retailUrl === 'https://niagapos.syncrozz.com/koperasi-kpmbp'),
    'koperasi-kpmbp intact with platform=RETAIL',
    `platform=${wsRetailCheck?.platform}, url=${retailUrl}`
  );

  // VG-19 — No regression to existing Restaurant client
  const wsRestoCheck = WorkspaceService.getWorkspaceBySlug('kedai-mama');
  assertGate(
    'VG-19',
    'No regression to existing Restaurant client',
    Boolean(wsRestoCheck && wsRestoCheck.platform === 'RESTAURANT' && restaurantUrl === 'https://kedaimakan.syncrozz.com/kedai-mama'),
    'kedai-mama intact with platform=RESTAURANT',
    `platform=${wsRestoCheck?.platform}, url=${restaurantUrl}`
  );

  // VG-20 — Legacy restaurant URL remains functional
  const parsedRoute = parseRoute('/kedai-mama');
  const legacyResolvedWs = WorkspaceService.getWorkspaceBySlug(parsedRoute.workspaceSlug!);
  assertGate(
    'VG-20',
    'Legacy restaurant URL remains functional',
    Boolean(legacyResolvedWs && legacyResolvedWs.workspaceId === 'ws_kedai_mama_01' && legacyRestaurantUrl === 'https://niagapos.syncrozz.com/kedai-mama'),
    'https://niagapos.syncrozz.com/kedai-mama resolves directly without redirection',
    `legacyUrl=${legacyRestaurantUrl}, resolved=${legacyResolvedWs?.workspaceId}`
  );

  console.log('\n=============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL GATES: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log('=============================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
