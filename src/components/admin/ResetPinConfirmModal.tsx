/**
 * NiagaPOS V2 - Master Admin Reset Client PIN Confirmation Modal
 */

import React, { useState } from 'react';
import { KeyRound, AlertTriangle, CheckCircle2, X, Lock } from 'lucide-react';
import { ClientAuthService } from '../../services/clientAuthService';
import type { Workspace } from '../../types/workspace';

interface ResetPinConfirmModalProps {
  isOpen: boolean;
  workspace: Workspace | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ResetPinConfirmModal: React.FC<ResetPinConfirmModalProps> = ({
  isOpen,
  workspace,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !workspace) return null;

  const handleReset = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await ClientAuthService.adminResetClientPin(workspace.workspaceSlug);
      if (res.success) {
        onSuccess(res.message || `PIN bagi workspace ${workspace.workspaceName} berjaya ditetapkan semula ke 1234.`);
        onClose();
      } else {
        setError(res.error || 'Gagal menetapkan semula PIN klien.');
      }
    } catch {
      setError('Ralat semasa menghubungi pelayan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-4 animate-fadeIn font-sans">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Tetapkan Semula PIN Klien</h3>
              <p className="text-xs text-stone-400">/{workspace.workspaceSlug}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Tindakan Pentadbir Platform</span>
              <span>
                PIN keselamatan bagi <strong>"{workspace.workspaceName}"</strong> akan ditetapkan semula kepada PIN lalai:
              </span>
              <div className="font-mono font-bold text-white text-sm bg-stone-950/80 px-2 py-1 rounded inline-block my-1 border border-stone-800">
                1234
              </div>
            </div>
          </div>

          <p className="text-stone-300 leading-relaxed">
            Klien akan diminta untuk menukar PIN baharu sebaik sahaja log masuk. Tindakan ini akan disimpan dalam Log Audit Keselamatan platform.
          </p>

          <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80 text-stone-400 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pengasingan Keselamatan Terjamin</span>
            </div>
            <p className="text-[11px]">
              Master Admin PIN (5313) kekal rahsia dan tidak pernah dikongsi atau dibenarkan untuk kegunaan klien.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-stone-400 hover:bg-stone-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Sahkan Reset PIN ke 1234</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
