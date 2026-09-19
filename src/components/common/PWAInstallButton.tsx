import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle, Monitor, Store } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { NIAGAPOS_ASSETS } from '../../constants/branding';
import { useStore } from '../../context/StoreContext';
import { parseRoute } from '../../services/urlRouter';
import { formatSlugToName } from '../../services/pwaManifestService';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'card' | 'badge';
  workspaceName?: string;
  workspaceSlug?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
  workspaceName: propWorkspaceName,
  workspaceSlug: propWorkspaceSlug,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { store } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const parsed = parseRoute(typeof window !== 'undefined' ? window.location.pathname : '');
  const activeSlug = propWorkspaceSlug || parsed.workspaceSlug;
  const isWorkspace = Boolean(activeSlug);

  const activeName =
    propWorkspaceName ||
    (store.name && store.name !== 'NiagaPOS'
      ? store.name
      : activeSlug
      ? formatSlugToName(activeSlug)
      : 'NiagaPOS');

  const fullUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${activeSlug ? `/${activeSlug}` : ''}`
      : `https://niagapos.syncrozz.com${activeSlug ? `/${activeSlug}` : ''}`;

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowModal(true);
    }
  };

  if (isInstalled && variant === 'header') {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          id="pwa-header-install-btn"
          onClick={handleInstallClick}
          disabled={isInstalling}
          aria-label={`Pasang Aplikasi ${activeName}`}
          title={`Pasang ${activeName} ke Skrin Utama Telefon (PWA)`}
          className={`flex items-center justify-center p-2 rounded-lg text-white bg-linear-to-r from-blue-700 to-[#082f63] hover:from-blue-800 hover:to-[#06244f] transition shadow-2xs cursor-pointer border border-blue-600/50 shrink-0 ${className}`}
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          id="pwa-sidebar-install-btn"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition border border-stone-200 shadow-2xs ${className}`}
        >
          <div className="flex items-center gap-2 truncate">
            <Download className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="truncate">Pasang {isWorkspace ? activeName : 'Aplikasi NiagaPOS'}</span>
          </div>
          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
            PWA
          </span>
        </button>
      )}

      {variant === 'card' && (
        <div className={`p-4 rounded-xl border border-stone-200 bg-white shadow-2xs ${className}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#082f63]/5 border border-[#082f63]/10 flex items-center justify-center shrink-0 p-1.5">
              <img
                src={NIAGAPOS_ASSETS.logoSvg}
                alt="NiagaPOS"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
                }}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-stone-900 truncate">
                  Pasang {activeName}
                </h4>
                {isInstalled && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    <CheckCircle className="w-3 h-3" /> Dipasang
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                {isWorkspace
                  ? `Akses pantas terus ke ruang kerja ${activeName} (${fullUrl}) dari skrin utama telefon anda.`
                  : 'Akses pantas dari skrin utama peranti anda dengan fungsi luar talian (offline) dan navigasi pantas.'}
              </p>
              {!isInstalled && (
                <button
                  type="button"
                  id="pwa-card-install-btn"
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#082f63] hover:bg-[#06244f] transition shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isInstallable ? 'Pasang Sekarang' : 'Panduan Pemasangan'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guided Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-stone-200 relative">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 p-1 shadow-2xs flex items-center justify-center shrink-0">
                <img
                  src={NIAGAPOS_ASSETS.logoSvg}
                  alt="NiagaPOS"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
                  }}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-stone-900 truncate">
                  Pasang {activeName}
                </h3>
                <p className="text-xs text-stone-500 flex items-center gap-1.5">
                  <Store className="w-3 h-3 text-blue-600" />
                  <span className="font-mono text-[11px] text-blue-700 font-medium truncate">
                    {isWorkspace ? `/${activeSlug}` : 'Platform Utama'}
                  </span>
                </p>
              </div>
            </div>

            {isWorkspace && (
              <div className="mb-4 p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900">
                <div className="font-semibold flex items-center gap-1">
                  <span>Pautan Khusus Workspace:</span>
                </div>
                <div className="font-mono text-[11px] text-blue-700 mt-0.5 break-all">
                  {fullUrl}
                </div>
                <div className="text-[11px] text-blue-800/90 mt-1">
                  Aplikasi akan disimpan khusus ke ruang kerja ini. Apabila dibuka pada telefon, ia akan terus memaparkan <strong>{activeName}</strong> tanpa kembali ke laman utama.
                </div>
              </div>
            )}

            {isIOS ? (
              <div className="space-y-3 text-xs text-stone-700">
                <p className="font-medium text-stone-900">
                  Untuk memasang pada iPhone / iPad (Safari):
                </p>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                  <Share className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Langkah 1:</span> Tekan butang <strong>Kongsi (Share)</strong> di bar navigasi bawah Safari.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                  <PlusSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Langkah 2:</span> Skrol ke bawah dan tekan <strong>"Tambah ke Skrin Utama" (Add to Home Screen)</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Langkah 3:</span> Pastikan nama dipaparkan sebagai <strong>"{activeName}"</strong> dan tekan <strong>"Tambah" (Add)</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-stone-700">
                <p className="font-medium text-stone-900">
                  Pemasangan untuk Telefon Android (Chrome) atau Desktop:
                </p>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                  <Smartphone className="w-4 h-4 text-[#082f63] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Android (Chrome):</span> Tekan menu tiga titik (⋮) di bucu kanan atas pelayar dan pilih <strong>"Pasang aplikasi" (Install app)</strong> atau <strong>"Tambah ke skrin utama"</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                  <Monitor className="w-4 h-4 text-[#082f63] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Desktop (Chrome/Edge):</span> Klik ikon <strong>Pasang (Install)</strong> di bar alamat URL pelayar anda.
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white transition shadow-2xs"
              >
                Faham
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
