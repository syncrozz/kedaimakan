import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { DuplicateGroup } from '../../services/duplicateAuditService';

export interface DuplicateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityTitle?: string;
  entityType?: string;
  duplicateGroups?: DuplicateGroup<any>[];
  auditGroups?: DuplicateGroup<any>[];
}

export const DuplicateAuditModal: React.FC<DuplicateAuditModalProps> = ({
  isOpen,
  onClose,
  entityTitle,
  entityType,
  duplicateGroups,
  auditGroups,
}) => {
  const title = entityTitle || entityType || 'Rekod';
  const groups = duplicateGroups || auditGroups || [];
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

  return (
    <div
      id="duplicate-audit-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs select-none"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Audit Duplikasi: {title}
              </h3>
              <p className="text-[11px] text-stone-500">
                SES 4.4 Locked: Pengesanan &amp; Semakan Sahaja (Tiada Pemadaman Automatik)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-md hover:bg-stone-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {groups.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">Tiada Duplikasi Dikesan</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Semua entiti dalam kategori {title} adalah unik mengikut kriteria semakan integriti data.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Perhatian Pentadbir:</span> Sila semak rekod yang
                  berkongsi nilai yang sama di bawah. Sebarang pengubahsuaian atau penyelarasan perlu
                  dilakukan secara manual oleh pentadbir bagi mengelakkan kehilangan data.
                </div>
              </div>

              <div className="space-y-3">
                {groups.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="p-3.5 rounded-lg border border-stone-200 bg-stone-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-900">
                        {group.field}: <code className="bg-stone-200 px-1.5 py-0.5 rounded text-stone-800 font-mono">{group.duplicateValue}</code>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {group.items.length} Rekod
                      </span>
                    </div>

                    <p className="text-xs text-stone-600">{group.message}</p>

                    <div className="space-y-1.5 pt-1">
                      {group.items.map((item: any, iIdx: number) => (
                        <div
                          key={item.id || iIdx}
                          className="p-2 rounded bg-white border border-stone-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-stone-800">
                              {item.name || item.supplierName || item.customerName || item.sku || 'Rekod'}
                            </span>
                            <span className="text-stone-400 ml-2 text-[11px]">
                              ID: {item.id}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.active !== false
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {item.active !== false ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
