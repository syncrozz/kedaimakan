/**
 * NiagaPOS V2 - Client & Master Admin Authentication Types
 * Strict separation between Master Admin (PIN 5313) and Client Workspaces (Default PIN 1234)
 */

export interface WorkspaceAuthConfig {
  workspaceId: string;
  workspaceSlug: string;
  pinHash: string;
  kitchenPinHash?: string;
  pinVersion: number;
  isPinEnabled: boolean;
  mustChangeDefaultPin: boolean;
  updatedAt: string;
  updatedBy: string; // 'SYSTEM_INITIALIZATION' | 'MASTER_ADMIN' | 'CLIENT_OWNER'
}

export interface WorkspaceAuthPublicState {
  workspaceId: string;
  workspaceSlug: string;
  isPinEnabled: boolean;
  mustChangeDefaultPin: boolean;
  pinVersion: number;
}

export interface ClientAuthSession {
  token: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: 'CLIENT';
  isPinEnabled: boolean;
  mustChangeDefaultPin: boolean;
  isDefaultPin?: boolean;
  pinVersion: number;
  expiresAt: number;
}

export interface KitchenAuthSession {
  token: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName?: string;
  role: 'KITCHEN';
  isDefaultPin?: boolean;
  authenticatedAt: string;
  expiresAt: number;
}

export interface MasterAdminAuthSession {
  token: string;
  role: 'MASTER_ADMIN';
  expiresAt: number;
}

export type InvalidationReason =
  | 'SESSION_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'AUTHORIZATION_CHANGED'
  | 'WORKSPACE_ACCESS_REVOKED'
  | 'DATA_CORRUPTION'
  | 'ASSET_CACHE_ISSUE';

export interface SessionDiagnosticResult {
  valid: boolean;
  reason?: InvalidationReason;
  message?: string;
  details?: Record<string, any>;
}

export interface AuditLogRecord {
  id: string;
  action:
    | 'RESET_CLIENT_PIN'
    | 'CHANGE_CLIENT_PIN'
    | 'INIT_CLIENT_PIN'
    | 'FAILED_LOGIN_LOCKOUT'
    | 'MASTER_ADMIN_LOGIN'
    | 'KITCHEN_LOGIN'
    | 'CHANGE_KITCHEN_PIN'
    | 'KITCHEN_LOGOUT'
    | 'DEPLOYMENT_VERSION_UPDATED'
    | 'SESSION_DIAGNOSTIC_FAILURE';
  workspaceId?: string;
  workspaceSlug?: string;
  performedBy: string; // 'MASTER_ADMIN' | 'CLIENT_OWNER' | 'KITCHEN' | 'SYSTEM'
  timestamp: string;
  details?: Record<string, any>;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  remainingSeconds?: number;
  message?: string;
}
