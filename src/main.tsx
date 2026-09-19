import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Purge any stale PWA caches (such as niagapos-pwa-v1) immediately
if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      if (name !== 'niagapos-pwa-v2.6') {
        caches.delete(name).catch(() => {});
      }
    }
  });
}

// Register Service Worker with instant update check
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Force checking for updated service worker
        reg.update().catch(() => {});

        // Listen for updates and apply
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New worker installed, notify or reload if needed
                newWorker.postMessage({ action: 'skipWaiting' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.debug('ServiceWorker registration omitted or failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
