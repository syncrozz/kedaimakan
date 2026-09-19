import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, X, KeyRound } from 'lucide-react';
import { AdminAuthService } from '../../services/adminAuthService';
import { NIAGAPOS_ASSETS } from '../../constants/branding';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionDescription?: string;
  workspaceSlug?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionDescription,
  workspaceSlug,
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and reset on open
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setIsVerifying(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleValidate = async (candidatePin: string) => {
    if (isVerifying) return;
    setIsVerifying(true);

    const result = await AdminAuthService.verifyPinAsync(candidatePin, workspaceSlug);

    if (result.success) {
      setErrorMessage(null);
      setPin('');
      setIsVerifying(false);
      onSuccess();
      onClose();
    } else {
      setErrorMessage(result.error || 'PIN salah. Sila cuba lagi.');
      setPin('');
      setIsVerifying(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Strictly numeric only, 4 to 6 digits
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    setErrorMessage(null);

    // Auto-submit immediately when 4th digit is entered
    if (digitsOnly.length === 4) {
      handleValidate(digitsOnly);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (pin.length >= 4) {
        handleValidate(pin);
      } else if (pin.length > 0 && pin.length < 4) {
        setErrorMessage('Sila masukkan sekurang-kurangnya 4-digit PIN keselamatan.');
      }
    }
  };

  if (!isOpen) return null;

  const lockout = AdminAuthService.isLockedOut();

  return (
    <div
      id="admin-pin-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-pin-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center p-1 shrink-0">
              <img
                src={NIAGAPOS_ASSETS.logoSvg}
                alt="NiagaPOS"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
                }}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 id="admin-pin-modal-title" className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>Mod Pentadbir NiagaPOS</span>
              </h3>
              {actionDescription ? (
                <p className="text-[11px] text-stone-500 line-clamp-1">{actionDescription}</p>
              ) : (
                <p className="text-[11px] text-stone-500">Kebenaran Pentadbir Diperlukan</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/60 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length === 4) handleValidate(pin);
          }}
          className="p-5 space-y-4"
        >
          <p className="text-xs text-stone-600 text-center italic">
            Sila masukkan 4-digit PIN keselamatan.
          </p>

          {/* Error Message */}
          {errorMessage && (
            <div
              id="admin-pin-error-alert"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Lockout alert */}
          {lockout.locked && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-medium">
              Sistem dikunci sementara. Sila tunggu {lockout.remainingSeconds} saat.
            </div>
          )}

          {/* Single 4-6 digit PIN Password Input */}
          <div className="relative">
            <input
              ref={inputRef}
              id="admin-pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              disabled={lockout.locked || isVerifying}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Masukkan PIN (4-6 digit)"
              autoFocus
              autoComplete="off"
              className="w-full text-center text-lg tracking-[0.6em] font-mono px-4 py-3 rounded-xl border-2 border-stone-200 focus:border-stone-900 focus:outline-hidden focus:ring-4 focus:ring-stone-100 transition placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-stone-400 text-stone-900 bg-stone-50/50 focus:bg-white disabled:bg-stone-100 disabled:text-stone-400 shadow-2xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 text-xs font-semibold rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 hover:border-stone-300 transition active:scale-98 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              id="admin-pin-submit-btn"
              disabled={lockout.locked || pin.length < 4 || isVerifying}
              className="w-2/3 py-2.5 text-xs font-semibold rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>🔑 Sahkan PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
