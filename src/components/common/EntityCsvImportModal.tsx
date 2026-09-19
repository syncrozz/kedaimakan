import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  X,
  Building2,
  Users,
  UserCheck,
} from 'lucide-react';
import { Modal } from './Modal';
import { CsvService, CsvEntityUpsertValidationResult } from '../../services/csvService';

interface EntityCsvImportModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  entityName: string; // e.g. "Pembekal", "Pelanggan", "Pekerja"
  entityType: 'SUPPLIER' | 'CUSTOMER' | 'STAFF';
  onDownloadTemplate: () => void;
  onValidate: (rows: Record<string, string>[]) => CsvEntityUpsertValidationResult<any, any>;
  onCommit: (
    validationResult: CsvEntityUpsertValidationResult<any, any>
  ) => Promise<{ added: number; updated: number }> | { added: number; updated: number };
}

type TabFilter = 'ALL' | 'NEW' | 'UPDATE' | 'INVALID';

export const EntityCsvImportModal: React.FC<EntityCsvImportModalProps> = ({
  id = 'entity-csv-import-modal',
  isOpen,
  onClose,
  entityName,
  entityType,
  onDownloadTemplate,
  onValidate,
  onCommit,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<CsvEntityUpsertValidationResult<any, any> | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [commitResult, setCommitResult] = useState<{ added: number; updated: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setIsDragging(false);
    setParseError(null);
    setValidationResult(null);
    setActiveTab('ALL');
    setIsSubmitting(false);
    setCommitResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileProcess = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Sila pilih fail dengan format .csv sahaja.');
      return;
    }

    setParseError(null);
    setFile(selectedFile);
    setCommitResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        if (!text.trim()) {
          setParseError('Fail CSV yang dipilih adalah kosong.');
          return;
        }

        const { rows } = CsvService.parseCsvText(text);
        if (!rows || rows.length === 0) {
          setParseError('Tiada baris data yang sah dijumpai dalam fail CSV ini.');
          return;
        }

        const result = onValidate(rows);
        setValidationResult(result);
      } catch (err: any) {
        setParseError(`Ralat semasa membaca fail: ${err?.message || 'Format fail tidak sah'}`);
      }
    };

    reader.onerror = () => {
      setParseError('Gagal membaca fail CSV. Sila cuba lagi.');
    };

    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCommit = async () => {
    if (!validationResult) return;
    setIsSubmitting(true);
    try {
      const res = await onCommit(validationResult);
      setCommitResult(res);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setParseError(`Ralat semasa menyimpan data: ${err?.message || 'Ralat tidak diketahui'}`);
      setIsSubmitting(false);
    }
  };

  const getEntityIcon = () => {
    switch (entityType) {
      case 'SUPPLIER':
        return <Building2 className="w-5 h-5 text-stone-700" />;
      case 'CUSTOMER':
        return <Users className="w-5 h-5 text-stone-700" />;
      case 'STAFF':
        return <UserCheck className="w-5 h-5 text-stone-700" />;
      default:
        return <FileText className="w-5 h-5 text-stone-700" />;
    }
  };

  const filteredRows = validationResult?.rows.filter((r) => {
    if (activeTab === 'NEW') return r.action === 'NEW';
    if (activeTab === 'UPDATE') return r.action === 'UPDATE';
    if (activeTab === 'INVALID') return r.action === 'INVALID';
    return true;
  });

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={handleClose}
      title={`Import Data ${entityName} (CSV)`}
      subtitle={`Muat naik fail CSV untuk menambah atau mengemaskini maklumat ${entityName.toLowerCase()} secara pukal.`}
      maxWidth="4xl"
    >
      <div className="p-6 space-y-6">
        {/* Success Banner */}
        {commitResult && (
          <div
            id="csv-import-success-banner"
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 animate-in fade-in"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Import Berjaya!</p>
              <p className="text-xs text-emerald-700">
                {commitResult.added} {entityName.toLowerCase()} baru ditambah, {commitResult.updated}{' '}
                dikemaskini.
              </p>
            </div>
          </div>
        )}

        {/* Upload Zone (If no valid file or user clicked change file) */}
        {!validationResult ? (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-stone-800 mb-1">
                Pilih atau seret fail CSV {entityName.toLowerCase()} ke sini
              </h4>
              <p className="text-xs text-stone-500 mb-4 max-w-md mx-auto">
                Sistem akan memadankan rekod secara automatik berdasarkan Kod atau Nama untuk mod Upsert.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-medium text-stone-700 shadow-2xs">
                {getEntityIcon()}
                <span>Format disokong: .CSV (UTF-8)</span>
              </div>
            </div>

            {parseError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Template Download Section */}
            <div className="p-4 rounded-xl border border-stone-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-stone-800">
                  Perlukan contoh format lajur {entityName}?
                </p>
                <p className="text-[11px] text-stone-500">
                  Muat turun templat CSV pra-format dengan contoh data yang sedia diisi.
                </p>
              </div>
              <button
                type="button"
                id="download-entity-template-btn"
                onClick={onDownloadTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-700 text-xs font-medium hover:bg-stone-100 transition shadow-2xs cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Muat Turun Templat CSV</span>
              </button>
            </div>
          </div>
        ) : (
          /* Validation Review Screen */
          <div className="space-y-4">
            {/* File info and change button */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-stone-200 bg-stone-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-600" />
                <span className="text-xs font-medium text-stone-800">{file?.name}</span>
                <span className="text-[11px] text-stone-500">
                  ({validationResult.totalRows} baris dijumpai)
                </span>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="text-xs text-stone-600 hover:text-stone-900 underline font-medium cursor-pointer"
              >
                Tukar fail CSV
              </button>
            </div>

            {/* Metrics Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`p-3 rounded-xl border text-left transition ${
                  activeTab === 'ALL'
                    ? 'border-stone-800 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                <p className="text-[11px] opacity-70">Jumlah Rekod</p>
                <p className="text-lg font-bold">{validationResult.totalRows}</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NEW')}
                className={`p-3 rounded-xl border text-left transition ${
                  activeTab === 'NEW'
                    ? 'border-emerald-700 bg-emerald-800 text-white'
                    : 'border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <p className="text-[11px] opacity-70">Rekod Baru (NEW)</p>
                <p className="text-lg font-bold">+{validationResult.newCount}</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('UPDATE')}
                className={`p-3 rounded-xl border text-left transition ${
                  activeTab === 'UPDATE'
                    ? 'border-blue-700 bg-blue-800 text-white'
                    : 'border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-50'
                }`}
              >
                <p className="text-[11px] opacity-70">Kemaskini (UPDATE)</p>
                <p className="text-lg font-bold">{validationResult.updateCount}</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('INVALID')}
                className={`p-3 rounded-xl border text-left transition ${
                  activeTab === 'INVALID'
                    ? 'border-rose-700 bg-rose-800 text-white'
                    : 'border-rose-200 bg-rose-50/50 text-rose-800 hover:bg-rose-50'
                }`}
              >
                <p className="text-[11px] opacity-70">Ralat (INVALID)</p>
                <p className="text-lg font-bold">{validationResult.invalidCount}</p>
              </button>
            </div>

            {/* Preview Table */}
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Kod</th>
                      <th className="py-2.5 px-3">Nama {entityName}</th>
                      <th className="py-2.5 px-3">Maklumat</th>
                      <th className="py-2.5 px-3">Tindakan</th>
                      <th className="py-2.5 px-3">Catatan / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredRows && filteredRows.length > 0 ? (
                      filteredRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/80 transition">
                          <td className="py-2 px-3 text-center text-stone-400 font-mono text-[11px]">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-stone-800">
                            {row.code}
                          </td>
                          <td className="py-2 px-3 font-medium text-stone-900">
                            {row.title}
                          </td>
                          <td className="py-2 px-3 text-stone-500 text-[11px]">
                            {row.subtitle || '-'}
                          </td>
                          <td className="py-2 px-3">
                            {row.action === 'NEW' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                BARU
                              </span>
                            )}
                            {row.action === 'UPDATE' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                KEMASKINI
                              </span>
                            )}
                            {row.action === 'INVALID' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                TIDAK SAH
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-stone-600 text-[11px]">
                            {row.reason}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400">
                          Tiada rekod untuk paparan tab ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {parseError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            Batal
          </button>

          {validationResult && (
            <button
              type="button"
              id="confirm-entity-csv-import-btn"
              onClick={handleCommit}
              disabled={
                isSubmitting ||
                (validationResult.newCount === 0 && validationResult.updateCount === 0)
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sedang Memproses...</span>
                </>
              ) : (
                <>
                  <span>
                    Sahkan & Import ({validationResult.newCount + validationResult.updateCount} Item)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
