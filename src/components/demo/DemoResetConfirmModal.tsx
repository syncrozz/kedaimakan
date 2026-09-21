import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, X, Lock } from 'lucide-react';
import { DemoSandboxService, DemoResetProgress } from '../../services/demoSandboxService';

interface DemoResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterAdminToken: string;
  onResetComplete?: () => void;
}

export const DemoResetConfirmModal: React.FC<DemoResetConfirmModalProps> = ({
  isOpen,
  onClose,
  masterAdminToken,
  onResetComplete,
}) => {
  const [progress, setProgress] = useState<DemoResetProgress | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmedByUser, setConfirmedByUser] = useState(false);

  if (!isOpen) return null;

  const handleStartReset = async () => {
    setIsExecuting(true);
    try {
      await DemoSandboxService.executeAuthoritativeReset(masterAdminToken, (p) => {
        setProgress(p);
      });
      setTimeout(() => {
        setIsExecuting(false);
        onResetComplete?.();
        onClose();
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setIsExecuting(false);
      // Progress is set to FAILED with error message
    }
  };

  return (
    <div
      id="demo-reset-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        id="demo-reset-modal-container"
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">Tetapan Semula Global Sandbox Demo</h3>
              <p className="text-xs text-amber-900 font-medium">Pengesahan Kuasa Penuh Master Admin (SES v4.5)</p>
            </div>
          </div>
          {!isExecuting && (
            <button
              id="btn-close-demo-reset-modal"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm text-slate-600">
          {!progress || progress.step === 'IDLE' ? (
            <>
              <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                <strong>Peringatan Penting:</strong> Tindakan ini akan mengembalikan pangkalan data sandbox demo (`ws_demo_sandbox_001`) kepada <strong>Dataset Benih Rasmi v1.0.0</strong> (12 Menu, 10 Meja, 2 Pesanan Contoh & Konfigurasi SST). Ruang kerja klien sebenar <strong>tidak akan disentuh sama sekali</strong>.
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-semibold text-slate-700">Skop Pembersihan Dibenarkan:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Memutuskan pendengar Firestore khusus demo (tanpa mengganggu sesi lain).</li>
                  <li>Memadam koleksi lama menu, meja, pesanan, KOT dan pelanggan demo.</li>
                  <li>Menyuntik benih rasmi secara berstruktur (idempotent).</li>
                  <li>Melaksanakan Gate Pengesahan integriti kiraan data.</li>
                  <li>Menyelaraskan storan setempat berkaitan demo sahaja.</li>
                </ul>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  id="checkbox-confirm-demo-reset"
                  type="checkbox"
                  checked={confirmedByUser}
                  onChange={(e) => setConfirmedByUser(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-medium text-slate-700 select-none">
                  Saya mengesahkan arahan tetapan semula global untuk sandbox demo.
                </span>
              </label>
            </>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{progress.message}</span>
                <span>{progress.percent}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    progress.step === 'FAILED'
                      ? 'bg-rose-600'
                      : progress.step === 'COMPLETED'
                      ? 'bg-emerald-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* State feedback */}
              {progress.step === 'FAILED' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block font-semibold">Operasi Gagal:</strong>
                    <span>{progress.error}</span>
                  </div>
                </div>
              )}

              {progress.step === 'COMPLETED' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Sandbox demo berjaya disetkan semula dan disahkan secara rasmi!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          {!progress || progress.step === 'IDLE' ? (
            <>
              <button
                id="btn-cancel-demo-reset"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                id="btn-execute-demo-reset"
                type="button"
                disabled={!confirmedByUser || isExecuting}
                onClick={handleStartReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Laksanakan Tetapan Semula Rasmi
              </button>
            </>
          ) : progress.step === 'FAILED' ? (
            <>
              <button
                id="btn-close-failed-reset"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                id="btn-retry-demo-reset"
                type="button"
                onClick={handleStartReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Cuba Semula (1-Click Retry)
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Sila tunggu sebentar...</span>
          )}
        </div>
      </div>
    </div>
  );
};
