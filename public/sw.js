// NiagaPOS Service Worker (Network-First Strategy with Dynamic Workspace Manifest - SES v4.5)
const CACHE_NAME = 'niagapos-pwa-v4.5';

let activeWorkspaceSlug = null;
let activeWorkspaceName = null;

const RESERVED_ROUTES = [
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

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SET_PWA_WORKSPACE') {
    activeWorkspaceSlug = event.data.slug || null;
    activeWorkspaceName = event.data.name || null;
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_ASSET_CACHE') {
    // Selective asset cache clear for recovery without touching user sessions
    caches.delete(CACHE_NAME).then(() => {
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_PRECACHE));
    });
  }
});

const MANIFEST_ICONS = [
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
];

function generateWorkspaceManifest(slug, name) {
  const cleanName = name || slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  return {
    id: `/${slug}`,
    name: `${cleanName} — NiagaPOS`,
    short_name: cleanName,
    description: `NiagaPOS - Sistem POS & Pengurusan Inventori untuk ${cleanName}`,
    start_url: `/${slug}`,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#082f63',
    theme_color: '#082f63',
    icons: MANIFEST_ICONS,
  };
}

const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/manifest.json',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon.svg',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon.ico',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon-96x96.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon-48x48.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon-32x32.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/favicon-16x16.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/apple-touch-icon.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-192x192.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-512x512.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-192x192.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-512x512.png',
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/mstile-150x150.png'
];

self.addEventListener('install', (event) => {
  // Force active immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.debug('Service Worker precache partial warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First for HTML/JS/CSS navigation and code requests so updates are immediate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Dynamic PWA Manifest Interception
  const isManifestRequest =
    url.pathname === '/site.webmanifest' ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/api/manifest/') ||
    url.pathname.endsWith('.webmanifest');

  if (isManifestRequest) {
    let slug = url.searchParams.get('slug') || url.searchParams.get('workspace');
    let name = url.searchParams.get('name');

    if (!slug && url.pathname.startsWith('/api/manifest/')) {
      slug = url.pathname.replace('/api/manifest/', '').split('/')[0];
    }

    // Check Referrer header (e.g. user visiting https://niagapos.syncrozz.com/kedai-mama)
    if (!slug && event.request.referrer) {
      try {
        const refUrl = new URL(event.request.referrer);
        const segs = refUrl.pathname.split('/').map((s) => s.trim()).filter(Boolean);
        if (segs.length > 0) {
          const cand = segs[0].toLowerCase();
          if (!cand.includes('.') && !RESERVED_ROUTES.includes(cand)) {
            slug = cand;
          }
        }
      } catch {}
    }

    // Fallback to active workspace stored via message
    if (!slug && activeWorkspaceSlug) {
      slug = activeWorkspaceSlug;
      name = name || activeWorkspaceName;
    }

    if (slug && !RESERVED_ROUTES.includes(slug.toLowerCase())) {
      const manifest = generateWorkspaceManifest(slug, name);
      event.respondWith(
        new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })
      );
      return;
    }
  }

  // For app navigation and local scripts, use Network-First to ensure instant freshness
  const isNavigation = event.request.mode === 'navigate';
  const isLocalAsset = url.origin === self.location.origin;

  if (isNavigation || isLocalAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache when offline
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (isNavigation) return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Cache-first for external static logos/icons
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
