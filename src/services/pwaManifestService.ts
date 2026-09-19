/**
 * PWA Dynamic Manifest Service for NiagaPOS
 * Allows each workspace (e.g. /kedai-mama) to be installed as an independent,
 * dedicated PWA on Android, iOS, Windows, and macOS with its own:
 * - Unique App ID: `/{workspaceSlug}`
 * - Direct Start URL: `/{workspaceSlug}`
 * - Custom App Name: `{Workspace Name} — NiagaPOS`
 * - Custom Short Name: `{Workspace Name}`
 */

import { RESERVED_ROUTES } from './urlRouter';

export interface DynamicManifestConfig {
  workspaceSlug?: string | null;
  workspaceName?: string | null;
}

const DEFAULT_BRANDING = {
  name: 'NiagaPOS',
  shortName: 'NiagaPOS',
  description: 'NiagaPOS - Sistem POS & Pengurusan Inventori Runcit',
  themeColor: '#082f63',
  backgroundColor: '#082f63',
  icons: [
    {
      src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/android-chrome-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/android-chrome-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/web-app-manifest-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/web-app-manifest-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

/**
 * Format a slug into a clean Title Case display name
 * e.g. "kedai-mama" -> "Kedai Mama"
 */
export function formatSlugToName(slug: string): string {
  if (!slug) return 'NiagaPOS';
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract workspace slug from a URL pathname
 */
export function extractSlugFromPath(pathname: string = window.location.pathname): string | null {
  const segments = pathname.split('/').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const first = segments[0].toLowerCase();
  if (first.includes('.') || RESERVED_ROUTES.includes(first)) {
    return null;
  }
  return first;
}

let activeBlobUrl: string | null = null;

/**
 * Dynamically updates the browser's PWA Manifest, Apple Web App meta tags,
 * and notifies the Service Worker so that installing from `/kedai-mama`
 * configures `start_url: '/kedai-mama'` and `id: '/kedai-mama'`.
 */
export function updatePWAManifest({ workspaceSlug, workspaceName }: DynamicManifestConfig): void {
  if (typeof window === 'undefined') return;

  const slug = (workspaceSlug || extractSlugFromPath(window.location.pathname))?.trim()?.toLowerCase() || null;
  const isWorkspace = Boolean(slug && !RESERVED_ROUTES.includes(slug));

  const effectiveSlug = isWorkspace ? slug : null;
  const effectiveName = isWorkspace
    ? (workspaceName?.trim() || formatSlugToName(slug!))
    : DEFAULT_BRANDING.name;

  const displayName = isWorkspace ? `${effectiveName} — NiagaPOS` : DEFAULT_BRANDING.name;
  const shortName = effectiveName;
  const startUrl = isWorkspace ? `/${effectiveSlug}` : '/';
  const appId = isWorkspace ? `/${effectiveSlug}` : '/';
  const description = isWorkspace
    ? `Aplikasi POS & Pengurusan Inventori untuk ${effectiveName}`
    : DEFAULT_BRANDING.description;

  // 1. Build Manifest Object
  const manifestData = {
    id: appId,
    name: displayName,
    short_name: shortName,
    description: description,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: DEFAULT_BRANDING.backgroundColor,
    theme_color: DEFAULT_BRANDING.themeColor,
    icons: DEFAULT_BRANDING.icons,
  };

  // 2. Persist active workspace in localStorage for SW/offline fallback
  try {
    if (isWorkspace && effectiveSlug) {
      localStorage.setItem('niagapos_pwa_active_workspace', effectiveSlug);
      localStorage.setItem('niagapos_pwa_active_name', effectiveName);
    } else {
      localStorage.removeItem('niagapos_pwa_active_workspace');
      localStorage.removeItem('niagapos_pwa_active_name');
    }
  } catch {}

  // 3. Inform Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_PWA_WORKSPACE',
        slug: effectiveSlug,
        name: effectiveName,
      });
    } catch {}
  }

  // 4. Update Apple / iOS Mobile Web App Meta Tags
  try {
    let appleTitleMeta = document.getElementById('apple-app-title-meta') as HTMLMetaElement | null;
    if (!appleTitleMeta) {
      appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    }
    if (appleTitleMeta) {
      appleTitleMeta.content = shortName;
    }

    let appNameMeta = document.getElementById('app-name-meta') as HTMLMetaElement | null;
    if (!appNameMeta) {
      appNameMeta = document.querySelector('meta[name="application-name"]');
    }
    if (appNameMeta) {
      appNameMeta.content = shortName;
    }
  } catch {}

  // 5. Update or recreate `<link rel="manifest">`
  try {
    let manifestLink = document.getElementById('app-manifest-link') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.querySelector('link[rel="manifest"]');
    }

    // Clean up previous blob URL if any
    if (activeBlobUrl) {
      try {
        URL.revokeObjectURL(activeBlobUrl);
      } catch {}
      activeBlobUrl = null;
    }

    // Build URL with query parameters so both Service Worker and Server can parse it immediately
    const queryParams = isWorkspace
      ? `?slug=${encodeURIComponent(effectiveSlug!)}&name=${encodeURIComponent(effectiveName)}`
      : '';
    const dynamicManifestPath = `/site.webmanifest${queryParams}`;

    if (manifestLink) {
      // Re-attaching or changing href triggers Chrome to re-evaluate the manifest
      manifestLink.setAttribute('href', dynamicManifestPath);
    } else {
      const newLink = document.createElement('link');
      newLink.id = 'app-manifest-link';
      newLink.rel = 'manifest';
      newLink.href = dynamicManifestPath;
      document.head.appendChild(newLink);
    }

    // Also update dynamic blob as secondary fallback for browsers supporting blob manifests
    try {
      const blob = new Blob([JSON.stringify(manifestData, null, 2)], {
        type: 'application/manifest+json',
      });
      activeBlobUrl = URL.createObjectURL(blob);
    } catch {}
  } catch (err) {
    console.debug('[PWA] Error updating dynamic manifest:', err);
  }
}
