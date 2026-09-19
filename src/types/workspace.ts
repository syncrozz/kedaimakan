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
