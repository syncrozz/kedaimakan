/**
 * NiagaPOS V2 - Client Workspace PIN Authentication Screen
 * 
 * Multi-Tenant Independent Authentication:
 * - Displays Workspace Name, Slug, and Owner identification
 * - 4-digit PIN entry with mobile-friendly keypad + keyboard support
 * - Clear authentication feedback & lockout countdown
 * - Default PIN hint (1234) for convenient onboarding
 * - Never reveals Master Admin PIN or Master Admin console
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Store as StoreIcon,
  ShieldCheck,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Delete,
  CheckCircle2,
} from 'lucide-react';
import { ClientAuthService } from '../../services/clientAuthService';
import type { Workspace } from '../../types/workspace';
import type { ClientAuthSession } from '../../types/auth';
import { NIAGAPOS_ASSETS } from '../../constants/branding';

interface ClientLoginScreenProps {
  workspace: Workspace;
  onAuthenticated: (session: ClientAuthSession) => void;
  onExit?: () => void;
}

export const ClientLoginScreen: React.FC<ClientLoginScreenProps> = ({
  workspace,
  onAuthenticated,
  onExit,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Check initial lockout & status from server
  useEffect(() => {
    ClientAuthService.getWorkspaceStatus(workspace.workspaceSlug).then((status) => {
      if (status && status.isLocked && status.remainingSeconds > 0) {
        setLockoutSeconds(status.remainingSeconds);
      }
    });
  }, [workspace.workspaceSlug]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleDigitPress = (digit: string) => {
    if (lockoutSeconds > 0 || loading || loginSuccess) return;
    setError(null);
    if (pin.length < 6) {
      const updated = pin + digit;
      setPin(updated);
      if (updated.length === 4) {
        // Auto-submit on 4 digits for fast mobile flow
        executeLogin(updated);
      }
    }
  };

  const handleDelete = () => {
    if (lockoutSeconds > 0 || loading || loginSuccess) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockoutSeconds > 0 || loading || loginSuccess) return;
    setError(null);
    setPin('');
  };

  const executeLogin = async (pinToVerify: string) => {
    if (!pinToVerify || pinToVerify.length < 4) {
      setError('Sila masukkan sekurang-kurangnya 4 digit PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await ClientAuthService.login(
        workspace.workspaceSlug,
        pinToVerify,
        workspace.workspaceName
      );

      if (res.success && res.data) {
        setLoginSuccess(true);
        setTimeout(() => {
          onAuthenticated(res.data!);
        }, 500);
      } else {
        setError(res.error || 'PIN keselamatan salah. Sila cuba lagi.');
        if (res.remainingSeconds) {
          setLockoutSeconds(res.remainingSeconds);
        }
        setPin('');
      }
    } catch {
      setError('Ralat semasa mengesahkan PIN. Sila cuba lagi.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(pin);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between items-center p-4 sm:p-6 font-sans relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-stone-800/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between z-10 pt-2 sm:pt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1 flex items-center justify-center">
            <img
              src={NIAGAPOS_ASSETS.logoSvg}
              alt="NiagaPOS"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
              }}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            Niaga<span className="text-red-500">POS</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-stone-400 bg-stone-900/80 border border-stone-800 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-[11px]">Pengasingan Klien</span>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="w-full max-w-md my-auto py-6 z-10">
        <div className="bg-stone-900/90 border border-stone-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Workspace Identification Header */}
          <div className="text-center mb-6 space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
              <StoreIcon className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50">
                Ruang Kerja Klien
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-1">
                {workspace.workspaceName}
              </h1>
              <div className="flex items-center justify-center gap-1 text-xs text-stone-400 font-mono">
                <span>/{workspace.workspaceSlug}</span>
                {workspace.ownerName && (
                  <span className="text-stone-500">• Pemilik: {workspace.ownerName}</span>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-400 pt-1">
              Masukkan 4-digit PIN keselamatan workspace anda untuk memulakan sesi POS.
            </p>
          </div>

          {/* Error / Lockout Banner */}
          {lockoutSeconds > 0 ? (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/50 border border-amber-800/70 text-amber-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <span className="font-semibold block">Sekatan Keselamatan Sementara</span>
                <span>Sila tunggu <strong>{lockoutSeconds} saat</strong> sebelum mencuba lagi.</span>
              </div>
            </div>
          ) : error ? (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Success Banner */}
          {loginSuccess && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PIN disahkan! Membuka ruang kerja anda...</span>
            </div>
          )}

          {/* PIN Display Dots */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center gap-3 justify-center py-2">
                {[0, 1, 2, 3].map((index) => {
                  const hasChar = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-11 h-13 rounded-xl border flex items-center justify-center transition-all ${
                        hasChar
                          ? 'border-emerald-500 bg-emerald-950/30 text-emerald-400 text-xl font-mono font-bold shadow-xs'
                          : 'border-stone-800 bg-stone-950/70 text-stone-700'
                      }`}
                    >
                      {hasChar ? (showPin ? pin[index] : '•') : ''}
                    </div>
                  );
                })}
              </div>

              {/* Secret toggle & direct keyboard input for desktop */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-stone-400 hover:text-stone-200 text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? 'Sembunyi' : 'Papar Nombor'}</span>
                </button>
              </div>

              {/* Hidden keyboard input for native typing */}
              <input
                id="client-pin-native-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={pin}
                disabled={lockoutSeconds > 0 || loading || loginSuccess}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(val);
                  setError(null);
                  if (val.length === 4) {
                    executeLogin(val);
                  }
                }}
                className="opacity-0 w-1 h-1 absolute pointer-events-none"
                aria-label="PIN Input"
              />
            </div>

            {/* Mobile Touch Keypad (1 to 9, Clear, 0, Backspace) */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto select-none">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  id={`keypad-digit-${digit}`}
                  onClick={() => handleDigitPress(digit)}
                  disabled={lockoutSeconds > 0 || loading || loginSuccess}
                  className="h-12 rounded-xl bg-stone-950 border border-stone-800 hover:border-emerald-500/50 hover:bg-stone-800/80 active:bg-emerald-900/40 text-stone-100 font-semibold text-lg flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                id="keypad-clear-btn"
                onClick={handleClear}
                disabled={lockoutSeconds > 0 || loading || pin.length === 0}
                className="h-12 rounded-xl bg-stone-950 border border-stone-800 hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 text-xs font-medium flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Padam
              </button>

              <button
                type="button"
                id="keypad-digit-0"
                onClick={() => handleDigitPress('0')}
                disabled={lockoutSeconds > 0 || loading || loginSuccess}
                className="h-12 rounded-xl bg-stone-950 border border-stone-800 hover:border-emerald-500/50 hover:bg-stone-800/80 active:bg-emerald-900/40 text-stone-100 font-semibold text-lg flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
              >
                0
              </button>

              <button
                type="button"
                id="keypad-backspace-btn"
                onClick={handleDelete}
                disabled={lockoutSeconds > 0 || loading || pin.length === 0}
                className="h-12 rounded-xl bg-stone-950 border border-stone-800 hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Login Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="client-pin-login-btn"
                disabled={pin.length < 4 || loading || lockoutSeconds > 0 || loginSuccess}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Log Masuk Ruang Kerja</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Onboarding Notice for Default PIN */}
          <div className="mt-6 pt-5 border-t border-stone-800/80 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Pendaftaran baharu? PIN lalai ialah <strong className="text-emerald-300 font-mono">1234</strong>
              </span>
            </div>
            <p className="text-[10px] text-stone-500 mt-2">
              Selepas log masuk, anda boleh menukar PIN ini pada bila-bila masa dalam menu Tetapan.
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        {onExit && (
          <div className="text-center mt-4">
            <button
              onClick={onExit}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              &larr; Kembali ke Laman Utama
            </button>
          </div>
        )}
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-md text-center text-[11px] text-stone-600 pb-2 z-10">
        NiagaPOS V2 Client Architecture • Keselamatan Multi-Tenant Aktif
      </footer>
    </div>
  );
};
