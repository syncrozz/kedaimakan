export type WorkspaceStatus =
  | 'ACTIVE'
  | 'TRIAL_ENDING'
  | 'EXPIRED'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type WorkspaceMemberRole = 'OWNER' | 'STAFF';

export type MemberAccountStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';

export interface WorkspaceMember {
  uid: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: WorkspaceMemberRole;
  status: MemberAccountStatus;
  joinedAt: string;
  invitedBy?: string;
  inviteSentAt?: string;
}

export interface WorkspaceAuthConfigData {
  pinHash: string;
  salt: string;
  pinVersion: number;
  mustChangeDefaultPin: boolean;
  updatedAt: string;
}

export type WorkspaceType = 'CLIENT' | 'DEMO';

export type WorkspacePlatform = 'RESTAURANT' | 'RETAIL' | 'UNCLASSIFIED';

export type SubscriptionPlan = 'TRIAL' | 'MONTHLY' | 'ANNUAL';

export type SubscriptionPaymentMethod = 'DUITNOW_QR' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';

export interface WorkspacePaymentRecord {
  paymentId: string;
  plan: 'MONTHLY' | 'ANNUAL';
  amount: number; // 10 (Monthly) or 110 (Annual)
  currency: string; // 'MYR'
  periodDays: number; // 30 or 365
  paidAt: string;
  previousExpiresAt: string;
  newExpiresAt: string;
  paymentMethod: SubscriptionPaymentMethod;
  referenceNote?: string;
  recordedBy?: string;
}

export interface WorkspaceDemoMetadata {
  demoSeedVersion: string;
  demoAccessEnabled: boolean;
  demoResetVersion: number;
  demoLastResetAt?: string;
  demoLastResetBy?: string;
  demoAnalyticsEnabled: boolean;
}

export interface Workspace {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  ownerEmail: string;
  ownerName: string;
  ownerUid?: string;
  status: WorkspaceStatus;
  trialDurationDays: number;
  trialStartedAt: string;
  trialExpiresAt: string;
  gracePeriodDays: number;
  gracePeriodEndsAt: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  authConfig?: WorkspaceAuthConfigData;
  metricsSummary?: {
    productCount: number;
    saleCount: number;
    totalRevenue: number;
    lastSaleAt?: string;
  };
  workspaceType?: WorkspaceType;
  platform?: WorkspacePlatform;
  demoMetadata?: WorkspaceDemoMetadata;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionPrice?: number;
  subscriptionCurrency?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  lastPaymentAt?: string;
  lastPaymentAmount?: number;
  lastPaymentReference?: string;
  paymentHistory?: WorkspacePaymentRecord[];
}

export interface WorkspaceSlugRecord {
  slug: string;
  workspaceId: string;
  createdAt: string;
}

export interface CreateWorkspaceInput {
  workspaceName: string;
  workspaceSlug: string;
  ownerEmail: string;
  ownerName: string;
  trialDurationDays?: number;
  platform?: WorkspacePlatform;
}

export interface ClientAccessDetails {
  workspace: Workspace;
  ownerMember: WorkspaceMember;
  accessUrl: string;
  inviteMethod: 'FIREBASE_AUTH_INVITE' | 'DIRECT_LINK';
  inviteToken?: string;
  defaultPin?: string;
}

export * from './auth';
