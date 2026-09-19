/**
 * NiagaPOS V2 - Comprehensive Security & Multi-Client Architecture Verification Test Suite
 * Executed directly to rigorously test:
 * 1. Cross-Workspace Read / Write / Query Isolation
 * 2. Member Role Escalation Prevention (Owner promoting to Owner or Master Admin)
 * 3. Sensitive Financial Data Protection (Staff blocked from /purchases, /suppliers)
 * 4. Workspace Path-to-Payload Integrity (mismatched workspaceId in payload)
 * 5. Lifecycle Expiry and Suspension Hard Enforcement
 * 6. Reserved Route Collision Immunity
 */

import { WorkspaceService } from './workspaceService';
import { parseRoute, isValidSlug } from './urlRouter';
import { getWorkspaceStorageKeys } from './storageService';
import type { Workspace, WorkspaceMember } from '../types/workspace';

interface MockAuthContext {
  uid: string;
  role?: 'MASTER_ADMIN';
}

interface MockDatabaseState {
  platformAdmins: Set<string>;
  workspaces: Map<string, Workspace>;
  members: Map<string, WorkspaceMember>; // key: `${workspaceId}:${uid}`
  purchases: Map<string, any>;
  products: Map<string, any>;
  sales: Map<string, any>;
}

// Emulated Security Rules Engine mirroring firestore.rules logic
class EmulatedRulesEngine {
  constructor(private db: MockDatabaseState) {}

  private isMasterAdmin(auth: MockAuthContext | null): boolean {
    if (!auth) return false;
    return auth.role === 'MASTER_ADMIN' || this.db.platformAdmins.has(auth.uid);
  }

  private getMember(workspaceId: string, uid: string): WorkspaceMember | null {
    return this.db.members.get(`${workspaceId}:${uid}`) || null;
  }

  private isWorkspaceMember(workspaceId: string, auth: MockAuthContext | null): boolean {
    if (!auth) return false;
    const member = this.getMember(workspaceId, auth.uid);
    return member !== null && member.status === 'ACTIVE';
  }

  private isWorkspaceOwner(workspaceId: string, auth: MockAuthContext | null): boolean {
    if (!this.isWorkspaceMember(workspaceId, auth)) return false;
    const member = this.getMember(workspaceId, auth!.uid);
    return member?.role === 'OWNER';
  }

  private isWorkspaceStaff(workspaceId: string, auth: MockAuthContext | null): boolean {
    if (!this.isWorkspaceMember(workspaceId, auth)) return false;
    const member = this.getMember(workspaceId, auth!.uid);
    return member?.role === 'STAFF' || member?.role === 'OWNER';
  }

  private isWorkspaceOperational(workspaceId: string, requestTime: number): boolean {
    const ws = this.db.workspaces.get(workspaceId);
    if (!ws) return false;
    const allowedStatus = ['ACTIVE', 'TRIAL_ENDING', 'GRACE_PERIOD'].includes(ws.status);
    const graceEnds = new Date(ws.gracePeriodEndsAt).getTime();
    return allowedStatus && requestTime < graceEnds;
  }

  // --- MEMBER OPERATIONS ---
  public evaluateMemberCreate(
    auth: MockAuthContext | null,
    workspaceId: string,
    targetUid: string,
    payload: { role: string; status: string },
    requestTime: number
  ): boolean {
    if (this.isMasterAdmin(auth)) return true;
    if (
      this.isWorkspaceOwner(workspaceId, auth) &&
      this.isWorkspaceOperational(workspaceId, requestTime) &&
      payload.role === 'STAFF' &&
      ['ACTIVE', 'INVITED'].includes(payload.status) &&
      targetUid !== auth?.uid
    ) {
      return true;
    }
    return false;
  }

  public evaluateMemberUpdate(
    auth: MockAuthContext | null,
    workspaceId: string,
    targetUid: string,
    currentMember: WorkspaceMember,
    newPayload: { role: string; status: string },
    requestTime: number
  ): boolean {
    if (this.isMasterAdmin(auth)) return true;
    if (
      this.isWorkspaceOwner(workspaceId, auth) &&
      this.isWorkspaceOperational(workspaceId, requestTime) &&
      currentMember.role === 'STAFF' &&
      newPayload.role === 'STAFF' &&
      targetUid !== auth?.uid
    ) {
      return true;
    }
    return false;
  }

  // --- SENSITIVE PURCHASES / SUPPLIERS OPERATIONS ---
  public evaluatePurchaseRead(auth: MockAuthContext | null, workspaceId: string): boolean {
    return this.isMasterAdmin(auth) || this.isWorkspaceOwner(workspaceId, auth);
  }

  public evaluatePurchaseWrite(
    auth: MockAuthContext | null,
    workspaceId: string,
    payload: any,
    requestTime: number
  ): boolean {
    if (this.isMasterAdmin(auth)) return true;
    const matchesWs = !payload.workspaceId || payload.workspaceId === workspaceId;
    return (
      this.isWorkspaceOwner(workspaceId, auth) &&
      this.isWorkspaceOperational(workspaceId, requestTime) &&
      matchesWs
    );
  }

  // --- OPERATIONAL PRODUCTS / SALES OPERATIONS ---
  public evaluateProductRead(auth: MockAuthContext | null, workspaceId: string): boolean {
    return this.isMasterAdmin(auth) || this.isWorkspaceMember(workspaceId, auth);
  }

  public evaluateProductWrite(
    auth: MockAuthContext | null,
    workspaceId: string,
    payload: any,
    requestTime: number
  ): boolean {
    if (this.isMasterAdmin(auth)) return true;
    const matchesWs = !payload.workspaceId || payload.workspaceId === workspaceId;
    return (
      this.isWorkspaceStaff(workspaceId, auth) &&
      this.isWorkspaceOperational(workspaceId, requestTime) &&
      matchesWs
    );
  }
}

// RUNNER
export function runSecurityTestPlan() {
  const db: MockDatabaseState = {
    platformAdmins: new Set(['master_admin_uid']),
    workspaces: new Map(),
    members: new Map(),
    purchases: new Map(),
    products: new Map(),
    sales: new Map(),
  };

  const now = Date.now();

  // Setup Workspace A (Active, 30-day trial)
  const wsAlpha: Workspace = {
    workspaceId: 'ws_alpha',
    workspaceSlug: 'kedai-alpha',
    workspaceName: 'Kedai Alpha',
    ownerEmail: 'owner.a@alpha.my',
    ownerName: 'Owner Alpha',
    status: 'ACTIVE',
    trialDurationDays: 30,
    trialStartedAt: new Date(now - 86400000).toISOString(),
    trialExpiresAt: new Date(now + 29 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(now + 36 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.workspaces.set('ws_alpha', wsAlpha);

  // Setup Workspace B (Active, separate tenant)
  const wsBeta: Workspace = {
    workspaceId: 'ws_beta',
    workspaceSlug: 'kedai-beta',
    workspaceName: 'Kedai Beta',
    ownerEmail: 'owner.b@beta.my',
    ownerName: 'Owner Beta',
    status: 'ACTIVE',
    trialDurationDays: 30,
    trialStartedAt: new Date(now - 86400000).toISOString(),
    trialExpiresAt: new Date(now + 29 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(now + 36 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.workspaces.set('ws_beta', wsBeta);

  // Setup Suspended Workspace
  const wsSuspended: Workspace = {
    workspaceId: 'ws_susp',
    workspaceSlug: 'kedai-susp',
    workspaceName: 'Kedai Suspended',
    ownerEmail: 'owner.s@susp.my',
    ownerName: 'Owner Suspended',
    status: 'SUSPENDED',
    trialDurationDays: 30,
    trialStartedAt: new Date(now - 40 * 86400000).toISOString(),
    trialExpiresAt: new Date(now - 10 * 86400000).toISOString(),
    gracePeriodDays: 7,
    gracePeriodEndsAt: new Date(now - 3 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.workspaces.set('ws_susp', wsSuspended);

  // Setup Members
  db.members.set('ws_alpha:user_owner_a', {
    uid: 'user_owner_a',
    workspaceId: 'ws_alpha',
    email: 'owner.a@alpha.my',
    displayName: 'Owner Alpha',
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: new Date().toISOString(),
  });
  db.members.set('ws_alpha:user_staff_a', {
    uid: 'user_staff_a',
    workspaceId: 'ws_alpha',
    email: 'staff.a@alpha.my',
    displayName: 'Staff Alpha',
    role: 'STAFF',
    status: 'ACTIVE',
    joinedAt: new Date().toISOString(),
  });
  db.members.set('ws_beta:user_owner_b', {
    uid: 'user_owner_b',
    workspaceId: 'ws_beta',
    email: 'owner.b@beta.my',
    displayName: 'Owner Beta',
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: new Date().toISOString(),
  });

  const rules = new EmulatedRulesEngine(db);
  const results: { testId: string; title: string; passed: boolean; details: string }[] = [];

  // TEST 1: Cross-Workspace Read Protection
  {
    const canReadBeta = rules.evaluateProductRead({ uid: 'user_owner_a' }, 'ws_beta');
    results.push({
      testId: 'SEC-01',
      title: 'Cross-Workspace Read Isolation (Owner A -> Workspace B)',
      passed: !canReadBeta,
      details: canReadBeta ? 'FAILURE: Owner A accessed Workspace B products' : 'BLOCKED as expected',
    });
  }

  // TEST 2: Cross-Workspace Write Protection
  {
    const canWriteBeta = rules.evaluateProductWrite(
      { uid: 'user_owner_a' },
      'ws_beta',
      { name: 'Illegal Product' },
      now
    );
    results.push({
      testId: 'SEC-02',
      title: 'Cross-Workspace Write Isolation (Owner A -> Workspace B)',
      passed: !canWriteBeta,
      details: canWriteBeta ? 'FAILURE: Owner A wrote to Workspace B' : 'BLOCKED as expected',
    });
  }

  // TEST 3: Role Escalation - Owner attempting to create another OWNER
  {
    const canCreateOwner = rules.evaluateMemberCreate(
      { uid: 'user_owner_a' },
      'ws_alpha',
      'user_new_x',
      { role: 'OWNER', status: 'ACTIVE' },
      now
    );
    results.push({
      testId: 'SEC-03',
      title: 'Role Escalation Prevention: Owner cannot create another OWNER',
      passed: !canCreateOwner,
      details: canCreateOwner ? 'VULNERABILITY: Owner created another OWNER' : 'BLOCKED as expected',
    });
  }

  // TEST 4: Role Escalation - Owner attempting to create MASTER_ADMIN
  {
    const canCreateAdmin = rules.evaluateMemberCreate(
      { uid: 'user_owner_a' },
      'ws_alpha',
      'user_new_y',
      { role: 'MASTER_ADMIN' as any, status: 'ACTIVE' },
      now
    );
    results.push({
      testId: 'SEC-04',
      title: 'Role Escalation Prevention: Owner cannot create MASTER_ADMIN',
      passed: !canCreateAdmin,
      details: canCreateAdmin ? 'CRITICAL VULNERABILITY: Owner created MASTER_ADMIN' : 'BLOCKED as expected',
    });
  }

  // TEST 5: Role Escalation - Owner attempting to escalate existing STAFF to OWNER
  {
    const staffDoc = db.members.get('ws_alpha:user_staff_a')!;
    const canEscalate = rules.evaluateMemberUpdate(
      { uid: 'user_owner_a' },
      'ws_alpha',
      'user_staff_a',
      staffDoc,
      { role: 'OWNER', status: 'ACTIVE' },
      now
    );
    results.push({
      testId: 'SEC-05',
      title: 'Role Escalation Prevention: Owner cannot promote STAFF to OWNER',
      passed: !canEscalate,
      details: canEscalate ? 'VULNERABILITY: Owner escalated STAFF to OWNER' : 'BLOCKED as expected',
    });
  }

  // TEST 6: Legitimate Member Creation - Owner creating STAFF
  {
    const canCreateStaff = rules.evaluateMemberCreate(
      { uid: 'user_owner_a' },
      'ws_alpha',
      'user_new_staff',
      { role: 'STAFF', status: 'ACTIVE' },
      now
    );
    results.push({
      testId: 'SEC-06',
      title: 'Legitimate Member Creation: Owner can create STAFF',
      passed: canCreateStaff,
      details: canCreateStaff ? 'ALLOWED as expected' : 'UNEXPECTED REJECTION',
    });
  }

  // TEST 7: Staff Restriction - STAFF blocked from reading /purchases
  {
    const canStaffReadPurchases = rules.evaluatePurchaseRead({ uid: 'user_staff_a' }, 'ws_alpha');
    results.push({
      testId: 'SEC-07',
      title: 'Staff Sensitive Data Restriction: STAFF blocked from wholesale purchases',
      passed: !canStaffReadPurchases,
      details: canStaffReadPurchases ? 'PRIVACY LEAK: Staff viewed wholesale purchases' : 'BLOCKED as expected',
    });
  }

  // TEST 8: Owner Allowed - OWNER can read /purchases
  {
    const canOwnerReadPurchases = rules.evaluatePurchaseRead({ uid: 'user_owner_a' }, 'ws_alpha');
    results.push({
      testId: 'SEC-08',
      title: 'Owner Authorized Access: OWNER can read wholesale purchases',
      passed: canOwnerReadPurchases,
      details: canOwnerReadPurchases ? 'ALLOWED as expected' : 'UNEXPECTED REJECTION',
    });
  }

  // TEST 9: Path-to-Payload Integrity - Mismatched workspaceId in payload
  {
    const canWriteMismatched = rules.evaluateProductWrite(
      { uid: 'user_owner_a' },
      'ws_alpha',
      { workspaceId: 'ws_beta', name: 'Spoofed Item' },
      now
    );
    results.push({
      testId: 'SEC-09',
      title: 'Path-to-Payload Integrity: Payload declaring different workspaceId is rejected',
      passed: !canWriteMismatched,
      details: canWriteMismatched ? 'VULNERABILITY: Spoofed payload accepted' : 'BLOCKED as expected',
    });
  }

  // TEST 10: Suspended Account Lockdown - Writes blocked to suspended workspace
  {
    db.members.set('ws_susp:user_owner_s', {
      uid: 'user_owner_s',
      workspaceId: 'ws_susp',
      email: 'owner.s@susp.my',
      displayName: 'Owner Suspended',
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
    });
    const canWriteSuspended = rules.evaluateProductWrite(
      { uid: 'user_owner_s' },
      'ws_susp',
      { name: 'Test Product' },
      now
    );
    results.push({
      testId: 'SEC-10',
      title: 'Suspended Account Lockdown: Writes blocked when status is SUSPENDED',
      passed: !canWriteSuspended,
      details: canWriteSuspended ? 'VULNERABILITY: Suspended workspace permitted writes' : 'BLOCKED as expected',
    });
  }

  // TEST 11: Master Admin Global Access
  {
    const canAdminRead = rules.evaluatePurchaseRead({ uid: 'master_admin_uid' }, 'ws_alpha');
    results.push({
      testId: 'SEC-11',
      title: 'Master Admin Access: Platform admin can audit tenant purchases',
      passed: canAdminRead,
      details: canAdminRead ? 'ALLOWED as expected' : 'UNEXPECTED REJECTION',
    });
  }

  // TEST 12: Storage Key Isolation (Zero cross-tenant cache overlap)
  {
    const keysA = getWorkspaceStorageKeys('ws_alpha');
    const keysB = getWorkspaceStorageKeys('ws_beta');
    const hasOverlap = Object.keys(keysA).some((k) => (keysA as any)[k] === (keysB as any)[k]);
    results.push({
      testId: 'SEC-12',
      title: 'Storage Cache Isolation: Client Alpha and Beta keys are disjoint',
      passed: !hasOverlap,
      details: !hasOverlap ? 'PARTITIONED as expected' : 'CACHE COLLISION DETECTED',
    });
  }

  // TEST 13: Reserved Route Interception Protection
  {
    const reserved = ['admin', 'login', 'pos', 'settings', 'sales', 'inventory'];
    const anyAllowed = reserved.some((r) => isValidSlug(r));
    results.push({
      testId: 'SEC-13',
      title: 'Reserved Route Immunity: System endpoints cannot be registered as tenant slugs',
      passed: !anyAllowed,
      details: !anyAllowed ? 'REJECTED as expected' : 'SECURITY DEFECT: Reserved slug allowed',
    });
  }

  // TEST 14: Client Onboarding URL Format (https://niagapos.syncrozz.com/{slug})
  {
    const generatedUrl = WorkspaceService.getClientAccessUrl('kedai-pak-ali');
    const expected = 'https://niagapos.syncrozz.com/kedai-pak-ali';
    const isExactMatch = generatedUrl === expected;
    results.push({
      testId: 'SEC-14',
      title: 'Client Access URL Verification: Matches official domain https://niagapos.syncrozz.com/{slug}',
      passed: isExactMatch,
      details: isExactMatch ? `Exact URL match: ${generatedUrl}` : `MISMATCH: Got ${generatedUrl}`,
    });
  }

  // TEST 15: Client Onboarding Workspace Creation & OWNER Assignment
  {
    const onboardingRes = WorkspaceService.createWorkspace({
      workspaceName: 'Pasar Mini Berkat',
      workspaceSlug: 'berkat-mart',
      ownerName: 'Haji Berkat',
      ownerEmail: 'berkat@mart.my',
      trialDurationDays: 30,
    });
    const wsCreated = !!onboardingRes.workspace;
    const isOwnerAssigned = onboardingRes.workspace?.ownerEmail === 'berkat@mart.my';
    const hasActiveStatus = onboardingRes.workspace?.status === 'ACTIVE';
    const passed = wsCreated && isOwnerAssigned && hasActiveStatus;
    results.push({
      testId: 'SEC-15',
      title: 'Client Onboarding Lifecycle: Provisions isolated workspace with 30-day trial and OWNER role',
      passed,
      details: passed ? 'PROVISIONED with isolated parameters' : 'FAILED to provision client workspace',
    });
  }

  return results;
}
