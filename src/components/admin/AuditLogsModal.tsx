/**
 * NiagaPOS V2 - Master Admin Security Audit Log Modal
 * Displays administrative events, PIN resets, and lockout alerts.
 */

import React from 'react';
import { ShieldAlert, X, Clock, RefreshCw, KeyRound, Lock, AlertTriangle } from 'lucide-react';
import type { AuditLogRecord } from '../../types/auth';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogRecord[];
  onRefresh: () => void;
  loading?: boolean;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onRefresh,
  loading,
}) => {
  if (!isOpen) return null;

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'RESET_CLIENT_PIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
            <KeyRound className="w-3 h-3" />
            <span>Reset PIN Klien</span>
          </span>
        );
      case 'CHANGE_CLIENT_PIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Tukar PIN (Klien)</span>
          </span>
        );
      case 'FAILED_LOGIN_LOCKOUT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Sekatan Percubaan</span>
          </span>
        );
      case 'INIT_CLIENT_PIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Inisialisasi PIN</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-800 text-stone-300">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-4 animate-fadeIn font-sans">
      <div className="w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Log Audit Keselamatan</h3>
              <p className="text-xs text-stone-400">
                Jejak tindakan pentadbir, tetapan semula PIN, dan amaran sekatan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
              title="Muat Semula Log"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              Tiada rekod audit keselamatan pada masa ini.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-stone-950 border border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {renderActionBadge(log.action)}
                      {log.workspaceSlug && (
                        <span className="font-mono text-stone-300 font-medium">
                          /{log.workspaceSlug}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Dilakukan oleh: <strong className="text-stone-300">{log.performedBy}</strong>
                      {log.details && (
                        <span className="text-stone-500 ml-2">
                          • {JSON.stringify(log.details).replace(/["{}]/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-stone-500 font-mono text-[11px] shrink-0">
                    {new Date(log.timestamp).toLocaleString('ms-MY')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-800 bg-stone-950/40 flex items-center justify-between text-xs text-stone-500">
          <span>{logs.length} rekod audit direkodkan</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
