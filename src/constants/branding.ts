/**
 * OFFICIAL NIAGAPOS BRAND ASSETS
 * Authoritative Single Source of Truth:
 * https://github.com/syncrozz/syncrozz-assets/tree/main/logo/NiagaPOS
 * 
 * SES v4.5 Compliant
 */

export const NIAGAPOS_ASSET_BASE =
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS';

export const NIAGAPOS_ASSETS = {
  // Official Logo / Vector Graphic (SVG)
  logoSvg: `${NIAGAPOS_ASSET_BASE}/favicon.svg`,

  // High-Resolution PNG Logomarks
  logo512: `${NIAGAPOS_ASSET_BASE}/android-chrome-512x512.png`,
  logo192: `${NIAGAPOS_ASSET_BASE}/android-chrome-192x192.png`,

  // PWA / App Icons
  icon192: `${NIAGAPOS_ASSET_BASE}/android-chrome-192x192.png`,
  icon512: `${NIAGAPOS_ASSET_BASE}/android-chrome-512x512.png`,
  androidChrome192: `${NIAGAPOS_ASSET_BASE}/android-chrome-192x192.png`,
  androidChrome512: `${NIAGAPOS_ASSET_BASE}/android-chrome-512x512.png`,
  appleTouchIcon: `${NIAGAPOS_ASSET_BASE}/apple-touch-icon.png`,
  webAppManifest192: `${NIAGAPOS_ASSET_BASE}/web-app-manifest-192x192.png`,
  webAppManifest512: `${NIAGAPOS_ASSET_BASE}/web-app-manifest-512x512.png`,

  // Favicons
  faviconIco: `${NIAGAPOS_ASSET_BASE}/favicon.ico`,
  faviconSvg: `${NIAGAPOS_ASSET_BASE}/favicon.svg`,
  favicon16: `${NIAGAPOS_ASSET_BASE}/favicon-16x16.png`,
  favicon32: `${NIAGAPOS_ASSET_BASE}/favicon-32x32.png`,
  favicon48: `${NIAGAPOS_ASSET_BASE}/favicon-48x48.png`,
  favicon96: `${NIAGAPOS_ASSET_BASE}/favicon-96x96.png`,

  // Windows / Microsoft Tiles
  mstile150: `${NIAGAPOS_ASSET_BASE}/mstile-150x150.png`,

  // Web App Manifest
  siteManifest: `${NIAGAPOS_ASSET_BASE}/site.webmanifest`,

  // Local fallback paths (servable from /public directory)
  local: {
    logoSvg: '/favicon.svg',
    androidChrome192: '/android-chrome-192x192.png',
    androidChrome512: '/android-chrome-512x512.png',
    webAppManifest192: '/web-app-manifest-192x192.png',
    webAppManifest512: '/web-app-manifest-512x512.png',
    appleTouchIcon: '/apple-touch-icon.png',
    faviconIco: '/favicon.ico',
    faviconSvg: '/favicon.svg',
    favicon96: '/favicon-96x96.png',
    mstile150: '/mstile-150x150.png',
    manifest: '/site.webmanifest',
  },
} as const;

