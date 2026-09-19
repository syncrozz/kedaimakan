/**
 * NiagaPOS V2 - Client Workspace Change PIN Modal
 * 
 * Secure Self-Service PIN Change for Client Workspace Owner:
 * - Validates current PIN
 * - Requires 4-6 digit numeric new PIN + confirmation
 * - Enforces server-side PBKDF2 hashing
 * - Dismisses "Must Change Default PIN" status upon success
 */

import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, CheckCircle2, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { ClientAuthService } from '../../services/clientAuthService';

interface ChangePinModalProps {
  isOpen: boolean;
  workspaceSlug: string;
  onClose: () => void;
  onSuccess?: (message?: string) => void;
  isMandatoryChange?: boolean;
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({
  isOpen,
  workspaceSlug,
  onClose,
  onSuccess,
  isMandatoryChange = false,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPin || currentPin.length < 4) {
      setError('Sila masukkan PIN semasa (4 digit).');
      return;
    }

    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      setError('PIN baharu mesti mengandungi 4 hingga 6 digit nombor.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PIN baharu dan pengesahan PIN tidak sepadan.');
      return;
    }

    if (newPin === currentPin) {
      setError('PIN baharu tidak boleh sama dengan PIN semasa.');
      return;
    }

    setLoading(true);

    try {
      const res = await ClientAuthService.changePin(workspaceSlug, currentPin, newPin, confirmPin);

      if (res.success) {
        setSuccessMessage(res.message || 'PIN Workspace berjaya dikemas kini!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          if (onSuccess) onSuccess(res.message || 'PIN Workspace berjaya dikemas kini!');
          onClose();
        }, 1200);
      } else {
        const rawErr = res.error || '';
        const safeError = rawErr.includes('JSON') || rawErr.includes('token') || rawErr.includes('The page')
          ? 'PIN semasa tidak tepat atau sambungan terputus. Sila semak semula PIN anda.'
          : rawErr || 'Gagal mengemas kini PIN. Sila periksa PIN semasa anda.';
        setError(safeError);
      }
    } catch (err: any) {
      const msg = typeof err?.message === 'string' && !err.message.includes('JSON') && !err.message.includes('token')
        ? err.message
        : 'Ralat semasa memproses penukaran PIN. Sila cuba lagi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 backdrop-blur-xs p-4 animate-fadeIn font-sans">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Tukar PIN Workspace
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                /{workspaceSlug}
              </p>
            </div>
          </div>

          {!isMandatoryChange && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isMandatoryChange && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Tindakan Keselamatan Diperlukan</strong>
                Akaun anda masih menggunakan PIN lalai (1234). Sila cipta PIN peribadi baharu untuk melindungi data kedai anda.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                PIN Semasa
              </label>
              <div className="relative">
                <input
                  type={showPins ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 1234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                PIN Baharu (4-6 Digit Nombor)
              </label>
              <input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 hingga 6 digit"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Sahkan PIN Baharu
              </label>
              <input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ulang PIN baharu"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPins(!showPins)}
                className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1 cursor-pointer"
              >
                {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPins ? 'Sembunyikan Digit' : 'Tunjukkan Digit'}</span>
              </button>

              <span className="text-[11px] text-stone-400">
                Disulitkan dengan PBKDF2 (Salt)
              </span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            {!isMandatoryChange && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !currentPin || !newPin || !confirmPin}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-300 dark:disabled:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Simpan PIN Baharu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
