import React, { useState, useEffect } from 'react';
import { X, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// LOCKED RAW QR IMAGE URL - DO NOT MODIFY OR USE BLOB/PLACEHOLDER
const LOCKED_QR_URL =
  'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/Bank%20QR/QR%20RYT%20for%20Sumbangan.jpg';

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [howToPayOpen, setHowToPayOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveQr = async () => {
    setIsDownloading(true);
    try {
      // Attempt to fetch blob and download directly
      const response = await fetch(LOCKED_QR_URL);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'QR-Sumbangan-Syncrozz.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Reliable fallback: open locked raw image in new tab for user to save
      window.open(LOCKED_QR_URL, '_blank', 'noopener,noreferrer');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      id="support-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      <div
        id="support-modal-content"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto p-5 sm:p-7 text-center animate-in zoom-in-95 duration-200"
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          id="support-modal-close-x"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Header Badge */}
        <div className="mb-2">
          <span
            id="support-modal-badge"
            className="inline-block px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-amber-800 bg-amber-50 border border-amber-200/70 rounded-full"
          >
            Sumbangan Sukarela
          </span>
        </div>

        {/* 2. Header Title */}
        <h2
          id="support-modal-title"
          className="text-lg sm:text-xl font-bold text-stone-900 flex items-center justify-center gap-1.5 mb-2"
        >
          <span>Sokong Inovasi Ini</span>
          <span className="text-rose-500">❤️</span>
        </h2>

        {/* 3. Description */}
        <p className="text-xs text-stone-600 leading-relaxed max-w-sm mx-auto mb-4">
          Platform ini dibangunkan secara berterusan bagi memudahkan warga pendidik dan komuniti.
          Sokongan ikhlas anda membantu kesinambungan pelayanan dan pembangunan inovasi seterusnya.
        </p>

        {/* 4. REAL QR IMAGE - Locked Raw URL */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-xs inline-block mx-auto mb-3 max-w-[260px] sm:max-w-[280px]">
          <img
            id="support-modal-qr-image"
            src={LOCKED_QR_URL}
            alt="DuitNow QR Sumbangan Syncrozz"
            className="w-full h-auto aspect-square object-contain mx-auto rounded-lg select-none"
            loading="eager"
            crossOrigin="anonymous"
          />
        </div>

        {/* 5. Support Information */}
        <div className="space-y-0.5 mb-4">
          <p className="text-xs font-semibold text-stone-800">
            DuitNow QR / Mana-mana Bank &amp; e-Wallet Malaysia
          </p>
          <p className="text-[11px] text-stone-500">
            RM1 pun amat dihargai 👏
          </p>
        </div>

        {/* 6. Save QR Code Button */}
        <button
          type="button"
          id="support-save-qr-btn"
          onClick={handleSaveQr}
          disabled={isDownloading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer mb-2.5 disabled:opacity-75"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Menyimpan...' : 'Save QR Code'}</span>
        </button>

        {/* 7. How to Pay Accordion */}
        <div className="border border-stone-200 rounded-xl overflow-hidden mb-2 text-left transition-all">
          <button
            type="button"
            id="support-how-to-pay-toggle"
            onClick={() => setHowToPayOpen((prev) => !prev)}
            className="w-full flex items-center justify-between py-2.5 px-3.5 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <span>Cara Bayar Guna Galeri (How To Pay)</span>
            {howToPayOpen ? (
              <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
            )}
          </button>

          {howToPayOpen && (
            <div
              id="support-how-to-pay-content"
              className="p-3.5 bg-white border-t border-stone-100 text-xs text-stone-600 space-y-1.5 animate-in slide-in-from-top-1 duration-150"
            >
              <ol className="list-decimal list-inside space-y-1 text-stone-600 leading-relaxed text-[11px] sm:text-xs">
                <li>Save QR Code ke device.</li>
                <li>Buka aplikasi banking / e-wallet.</li>
                <li>Pilih fungsi QR payment atau scan from gallery.</li>
                <li>Pilih QR yang telah disimpan.</li>
                <li>Lengkapkan pembayaran mengikut langkah aplikasi bank / e-wallet.</li>
              </ol>
            </div>
          )}
        </div>

        {/* 8. Secondary Close Action: Kembali ke SYNCROZZ */}
        <button
          type="button"
          id="support-modal-back-btn"
          onClick={onClose}
          className="w-full py-2 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer"
        >
          Kembali ke SYNCROZZ
        </button>
      </div>
    </div>
  );
};
