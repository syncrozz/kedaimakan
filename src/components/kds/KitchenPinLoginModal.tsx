/**
 * SYNCROZZ KEDAI MAKAN - Kitchen PIN Login Modal
 * Fasa 3 — Step 2 (SES v4.5)
 *
 * Dedicated KITCHEN role authentication:
 * - Touch-friendly numeric keypad for tablet use
 * - Server-side validation with rate limiting (5 attempts -> 30s lockout)
 * - Session stored until manual logout
 */

import React, { useState, useEffect } from 'react';
import { ChefHat, Lock, Delete, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { KitchenAuthService } from '../../services/kitchenAuthService';
import type { KitchenAuthSession } from '../../types/auth';

interface KitchenPinLoginModalProps {
  isOpen: boolean;
  workspaceSlug: string;
  workspaceName?: string;
  onSuccess: (session: KitchenAuthSession) => void;
  onCancel: () => void;
}

export const KitchenPinLoginModal: React.FC<KitchenPinLoginModalProps> = ({
  isOpen,
  workspaceSlug,
  workspaceName,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Check lockout on mount and periodically
  useEffect(() => {
    if (!isOpen) return;
    const check = KitchenAuthService.checkLocalLockout(workspaceSlug);
    if (check.locked) {
      setRemainingSeconds(check.remainingSeconds);
    }
  }, [isOpen, workspaceSlug]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (remainingSeconds > 0 || isLoading) return;
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);
      if (nextPin.length >= 4) {
        // Automatically attempt login when 4 or 6 digits entered
        // Wait briefly so user sees the 4th digit fill
        if (nextPin.length === 4) {
          submitPin(nextPin);
        }
      }
    }
  };

  const handleDelete = () => {
    if (remainingSeconds > 0 || isLoading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (remainingSeconds > 0 || isLoading) return;
    setPin('');
    setError(null);
  };

  const submitPin = async (pinToSubmit: string) => {
    if (pinToSubmit.length < 4) {
      setError('Sila masukkan sekurang-kurangnya 4 digit PIN.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await KitchenAuthService.login(workspaceSlug, pinToSubmit, workspaceName);
      if (res.success && res.data) {
        setPin('');
        onSuccess(res.data);
      } else {
        setError(res.error || 'PIN Dapur tidak sah.');
        if (res.remainingSeconds) {
          setRemainingSeconds(res.remainingSeconds);
        }
        setPin('');
      }
    } catch {
      setError('Ralat semasa menghubungi pelayan.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
          <ChefHat className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          Akses Dapur
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Ruang Kerja: <span className="text-amber-400 font-semibold">{workspaceName || workspaceSlug}</span>
        </p>
        <p className="text-[11px] text-stone-500 mt-0.5">
          Masukkan PIN Dapur (Peranan KITCHEN) untuk membuka skrin pesanan.
        </p>

        {/* Lockout Warning */}
        {remainingSeconds > 0 ? (
          <div className="my-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              Akses disekat kerana terlalu banyak percubaan. Tunggu <strong>{remainingSeconds} saat</strong>.
            </span>
          </div>
        ) : (
          /* Masked PIN Indicators */
          <div className="flex items-center gap-3 my-5">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > idx
                    ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                    : 'border-stone-700 bg-stone-950'
                }`}
              />
            ))}
            {pin.length > 4 && (
              <div className="w-4 h-4 rounded-full border-2 bg-amber-400 border-amber-400 scale-110" />
            )}
          </div>
        )}

        {/* Error message */}
        {error && remainingSeconds <= 0 && (
          <div className="mb-3 p-2 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad (Touch-Friendly for Tablets) */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] my-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              id={`kitchen-pin-key-${digit}`}
              disabled={remainingSeconds > 0 || isLoading}
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 active:bg-amber-500/20 active:scale-95 border border-stone-800 text-xl font-bold text-white transition flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            id="kitchen-pin-key-clear"
            disabled={remainingSeconds > 0 || isLoading || pin.length === 0}
            onClick={handleClear}
            className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 active:scale-95 border border-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
          >
            Kosongkan
          </button>

          <button
            type="button"
            id="kitchen-pin-key-0"
            disabled={remainingSeconds > 0 || isLoading}
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 active:bg-amber-500/20 active:scale-95 border border-stone-800 text-xl font-bold text-white transition flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
          >
            0
          </button>

          <button
            type="button"
            id="kitchen-pin-key-delete"
            disabled={remainingSeconds > 0 || isLoading || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-stone-950 hover:bg-stone-800 active:scale-95 border border-stone-800 text-stone-400 hover:text-white transition flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit button (if 4+ digits entered) */}
        {pin.length >= 4 && remainingSeconds <= 0 && (
          <button
            type="button"
            id="kitchen-pin-submit-btn"
            disabled={isLoading}
            onClick={() => submitPin(pin)}
            className="w-full max-w-[260px] mt-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isLoading ? 'Mengesahkan...' : 'Sahkan & Masuk'}</span>
          </button>
        )}

        {/* Demo Hint & Cancel */}
        <div className="mt-4 pt-3 border-t border-stone-800/80 w-full flex items-center justify-between text-xs">
          <button
            type="button"
            id="kitchen-pin-cancel-btn"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-200 flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>

          <span className="text-[10px] text-stone-500">
            PIN Lalai: <strong className="text-stone-400 font-mono">9999</strong> (atau 8888)
          </span>
        </div>
      </div>
    </div>
  );
};
