/**
 * NiagaPOS V2 - Kitchen PIN Management Modal
 * SYNCROZZ KEDAI MAKAN (Fasa 3 — Step 2, SES v4.5)
 *
 * Allows Client Owner or Kitchen Manager to change the Kitchen PIN:
 * - Validates current PIN (supports current kitchen PIN, owner PIN, or master override 5313)
 * - Requires 4-6 numeric digits
 * - Updates server-side & local hash
 * - Eliminates default PIN (9999) security warning
 */

import React, { useState } from 'react';
import { Lock, KeyRound, CheckCircle2, AlertCircle, X, Eye, EyeOff, ChefHat, ShieldCheck } from 'lucide-react';
import { KitchenAuthService } from '../../services/kitchenAuthService';

interface ChangeKitchenPinModalProps {
  isOpen: boolean;
  workspaceSlug: string;
  onClose: () => void;
  onSuccess?: (message?: string) => void;
}

export const ChangeKitchenPinModal: React.FC<ChangeKitchenPinModalProps> = ({
  isOpen,
  workspaceSlug,
  onClose,
  onSuccess,
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
      setError('Sila masukkan PIN semasa (atau PIN Pemilik / PIN Lalai 9999).');
      return;
    }

    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      setError('PIN Dapur baharu mesti mengandungi 4 hingga 6 digit angka.');
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

    if (newPin === '9999' || newPin === '8888') {
      setError('PIN baharu tidak boleh menggunakan PIN lalai sistem (9999 / 8888).');
      return;
    }

    setLoading(true);

    try {
      const res = await KitchenAuthService.changePin(workspaceSlug, currentPin, newPin, confirmPin);

      if (res.success) {
        setSuccessMessage(res.message || 'PIN Dapur berjaya dikemas kini!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');

        // If active session exists, update isDefaultPin to false
        const currentSession = KitchenAuthService.getSession(workspaceSlug);
        if (currentSession) {
          currentSession.isDefaultPin = false;
          KitchenAuthService.saveSession(currentSession);
        }

        setTimeout(() => {
          if (onSuccess) onSuccess(res.message || 'PIN Dapur berjaya dikemas kini!');
          onClose();
        }, 1200);
      } else {
        const rawErr = res.error || '';
        const safeError =
          rawErr.includes('JSON') || rawErr.includes('token')
            ? 'PIN semasa tidak tepat atau sambungan terputus. Sila semak semula PIN anda.'
            : rawErr || 'Gagal mengemas kini PIN Dapur. Sila semak PIN semasa anda.';
        setError(safeError);
      }
    } catch (err: any) {
      setError(err?.message || 'Ralat semasa memproses penukaran PIN Dapur. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden text-stone-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Tukar PIN Dapur (KDS)</h3>
              <p className="text-[11px] text-stone-400">Ruang Kerja: /{workspaceSlug}</p>
            </div>
          </div>
          <button
            type="button"
            id="change-kitchen-pin-close-btn"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block font-medium text-stone-300">
              PIN Semasa / PIN Pemilik / PIN Lalai (9999)
            </label>
            <div className="relative">
              <input
                type={showPins ? 'text' : 'password'}
                id="kitchen-current-pin-input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="cth. 9999 atau PIN Pemilik"
                disabled={loading || !!successMessage}
                className="w-full pl-9 pr-10 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                required
                autoFocus
              />
              <KeyRound className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-stone-500">
              Boleh disahkan menggunakan PIN Dapur semasa, PIN Pemilik kedai, atau PIN Lalai (9999/8888).
            </p>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-stone-300">PIN Dapur Baharu (4-6 Digit)</label>
            <div className="relative">
              <input
                type={showPins ? 'text' : 'password'}
                id="kitchen-new-pin-input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 hingga 6 digit nombor"
                disabled={loading || !!successMessage}
                className="w-full pl-9 pr-10 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                required
              />
              <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-stone-300">Sahkan PIN Dapur Baharu</label>
            <div className="relative">
              <input
                type={showPins ? 'text' : 'password'}
                id="kitchen-confirm-pin-input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan semula PIN baharu"
                disabled={loading || !!successMessage}
                className="w-full pl-9 pr-10 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                required
              />
              <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              id="kitchen-toggle-show-pins"
              onClick={() => setShowPins(!showPins)}
              className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1.5 transition"
            >
              {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPins ? 'Sembunyikan Nombor' : 'Papar Nombor PIN'}</span>
            </button>
          </div>

          <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="change-kitchen-pin-cancel-btn"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800 font-semibold text-xs transition"
            >
              Batal
            </button>
            <button
              type="submit"
              id="change-kitchen-pin-submit-btn"
              disabled={loading || !!successMessage}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan PIN Dapur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
