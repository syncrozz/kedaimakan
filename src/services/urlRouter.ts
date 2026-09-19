/**
 * URL Slug Parser & Reserved Route Protection for NiagaPOS
 */

export const MASTER_ADMIN_KEYWORDS = [
  'admin',
  'client',
  'clients',
  'klien',
  'konsol',
  'konsol-klien',
  'master-admin',
  'workspace-admin',
];

export const RESERVED_ROUTES = [
  'admin',
  'client',
  'clients',
  'klien',
  'konsol',
  'konsol-klien',
  'master-admin',
  'workspace-admin',
  'login',
  'setup',
  'settings',
  'products',
  'inventory',
  'pos',
  'sales',
  'purchases',
  'suppliers',
  'customers',
  'reports',
  'dashboard',
  'api',
  'assets',
  'sw.js',
  'site.webmanifest',
  'manifest.json',
  'favicon.ico',
  'favicon.svg',
  'index.html',
];

export interface ParsedRoute {
  isMasterAdmin: boolean;
  workspaceSlug: string | null;
  systemPage: 'pos' | 'products' | 'customers' | 'reports' | 'settings' | 'inventory' | 'suppliers' | 'purchases' | 'dashboard' | 'konsol' | 'kds' | null;
  rawPath: string;
}

export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  const clean = slug.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 32) return false;
  // Alphanumeric with single hyphens
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return false;
  if (RESERVED_ROUTES.includes(clean)) return false;
  return true;
}

export function parseRoute(pathname: string = window.location.pathname): ParsedRoute {
  // Support query parameter or hash triggers like ?admin=true, ?page=admin, ?konsol=true, #admin, #konsol
  const searchStr = typeof window !== 'undefined' ? (window.location.search || '').toLowerCase() : '';
  const hashStr = typeof window !== 'undefined' ? (window.location.hash || '').toLowerCase() : '';
  if (
    searchStr.includes('admin') ||
    searchStr.includes('konsol') ||
    hashStr.includes('admin') ||
    hashStr.includes('konsol')
  ) {
    return {
      isMasterAdmin: true,
      workspaceSlug: null,
      systemPage: 'konsol',
      rawPath: pathname,
    };
  }

  const segments = pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      isMasterAdmin: false,
      workspaceSlug: null,
      systemPage: 'pos',
      rawPath: pathname,
    };
  }

  const first = segments[0].toLowerCase();

  // Check if Master Admin / Konsol Klien route
  if (MASTER_ADMIN_KEYWORDS.includes(first)) {
    return {
      isMasterAdmin: true,
      workspaceSlug: null,
      systemPage: 'konsol',
      rawPath: pathname,
    };
  }

  // Check if first segment is a direct system page (standalone legacy mode)
  if (
    ['pos', 'dashboard', 'products', 'customers', 'reports', 'settings', 'inventory', 'suppliers', 'purchases', 'kds'].includes(
      first
    )
  ) {
    return {
      isMasterAdmin: false,
      workspaceSlug: null,
      systemPage: first as any,
      rawPath: pathname,
    };
  }

  // If first segment has a file extension or is a reserved route/invalid slug, do not treat as workspace slug
  if (first.includes('.') || RESERVED_ROUTES.includes(first) || !isValidSlug(first)) {
    return {
      isMasterAdmin: false,
      workspaceSlug: null,
      systemPage: 'pos',
      rawPath: pathname,
    };
  }

  // Otherwise, first segment is treated as a tenant workspace slug
  const workspaceSlug = first;
  const second = segments[1]?.toLowerCase();
  let systemPage: any = 'pos';

  if (
    second &&
    ['pos', 'dashboard', 'products', 'customers', 'reports', 'settings', 'inventory', 'suppliers', 'purchases', 'kds'].includes(
      second
    )
  ) {
    systemPage = second;
  }

  return {
    isMasterAdmin: false,
    workspaceSlug,
    systemPage,
    rawPath: pathname,
  };
}

export function pushRoute(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
