import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ShieldCheck,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
  Archive,
  Trash2,
} from 'lucide-react';
import {
  Product,
  CsvImportMode,
  CommitUpsertPayload,
  UpsertImportCommitResult,
  MasterCatalogSyncPayload,
  MasterCatalogSyncCommitResult,
  MasterSyncProductRow,
  MasterSyncMissingProduct,
} from '../../types';
import {
  CsvService,
  CsvProductsUpsertValidationResult,
  CsvRowAction,
} from '../../services/csvService';
import { useStore } from '../../context/StoreContext';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onCommit?: (items: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[]) => void;
  onCommitImport?: (items: Omit<Product, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>[]) => void;
  onCommitUpsertImport?: (payload: CommitUpsertPayload) => UpsertImportCommitResult;
  onCommitMasterSync?: (payload: MasterCatalogSyncPayload) => MasterCatalogSyncCommitResult;
}

type ActiveFilterTab = 'ALL' | 'NEW' | 'UPDATE' | 'UNCHANGED' | 'STOCK_CHANGED' | 'SKIP' | 'INVALID' | 'NOT_IN_IMPORT';

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  onCommit,
  onCommitImport,
  onCommitUpsertImport,
  onCommitMasterSync,
}) => {
  const { sales, purchases, movements, commitMasterCatalogSync } = useStore();

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [importMode, setImportMode] = useState<CsvImportMode>('MASTER_SYNC');
  const [isUpdateConfirmed, setIsUpdateConfirmed] = useState(false);
  const [isMasterSyncConfirmed, setIsMasterSyncConfirmed] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilterTab>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [commitResult, setCommitResult] = useState<UpsertImportCommitResult | null>(null);
  const [masterCommitResult, setMasterCommitResult] = useState<MasterCatalogSyncCommitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute Master Catalog Sync validation
  const masterSyncResult = useMemo(() => {
    if (!parsedRows || importMode !== 'MASTER_SYNC') return null;
    return CsvService.validateMasterCatalogSync(
      parsedRows,
      existingProducts,
      sales,
      purchases,
      movements
    );
  }, [parsedRows, existingProducts, sales, purchases, movements, importMode]);

  // Compute standard Upsert validation (for SKIP_EXISTING and UPDATE_EXISTING modes)
  const upsertValidationResult: CsvProductsUpsertValidationResult | null = useMemo(() => {
    if (!parsedRows || importMode === 'MASTER_SYNC') return null;
    return CsvService.validateProductsUpsert(parsedRows, existingProducts, importMode);
  }, [parsedRows, existingProducts, importMode]);

  // Filtered rows for the Master Sync preview table
  const filteredMasterRows = useMemo(() => {
    if (!masterSyncResult) return { csvRows: [] as MasterSyncProductRow[], missingRows: [] as MasterSyncMissingProduct[] };

    let csvRows = masterSyncResult.rows;
    let missingRows = masterSyncResult.missingProducts;

    if (activeFilter === 'ALL') {
      return { csvRows, missingRows };
    } else if (activeFilter === 'NEW') {
      return { csvRows: csvRows.filter((r) => r.action === 'NEW'), missingRows: [] };
    } else if (activeFilter === 'UPDATE') {
      return { csvRows: csvRows.filter((r) => r.action === 'UPDATE'), missingRows: [] };
    } else if (activeFilter === 'UNCHANGED') {
      return { csvRows: csvRows.filter((r) => r.action === 'UNCHANGED'), missingRows: [] };
    } else if (activeFilter === 'STOCK_CHANGED') {
      return { csvRows: csvRows.filter((r) => r.stockChanged), missingRows: [] };
    } else if (activeFilter === 'INVALID') {
      return { csvRows: csvRows.filter((r) => r.action === 'INVALID'), missingRows: [] };
    } else if (activeFilter === 'NOT_IN_IMPORT') {
      return { csvRows: [], missingRows };
    }

    return { csvRows, missingRows };
  }, [masterSyncResult, activeFilter]);

  // Filtered rows for standard Upsert table
  const filteredUpsertRows = useMemo(() => {
    if (!upsertValidationResult) return [];
    if (activeFilter === 'ALL') return upsertValidationResult.rows;
    return upsertValidationResult.rows.filter((r) => r.action === activeFilter);
  }, [upsertValidationResult, activeFilter]);

  const handleReset = () => {
    setFileName(null);
    setParsedRows(null);
    setImportMode('MASTER_SYNC');
    setIsUpdateConfirmed(false);
    setIsMasterSyncConfirmed(false);
    setActiveFilter('ALL');
    setCommitResult(null);
    setMasterCommitResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setErrorMessage(null);
    setCommitResult(null);
    setMasterCommitResult(null);
    setIsUpdateConfirmed(false);
    setIsMasterSyncConfirmed(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      try {
        const { rows } = CsvService.parseCsvText(text);
        if (rows.length === 0) {
          setErrorMessage('Fail CSV kosong atau tidak mempunyai data yang sah.');
          setParsedRows(null);
        } else {
          setParsedRows(rows);
        }
      } catch (err) {
        console.error('Failed to parse CSV', err);
        setErrorMessage('Gagal memproses fail CSV. Sila pastikan format teks CSV adalah standard.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleCommit = () => {
    setErrorMessage(null);

    // MODE 1: Master Catalog Sync
    if (importMode === 'MASTER_SYNC') {
      if (!masterSyncResult) return;
      if (!masterSyncResult.isValid) {
        setErrorMessage('Tidak boleh mengkomit fail CSV yang mengandungi baris tidak sah. Sila betulkan fail CSV terlebih dahulu.');
        return;
      }
      if (!isMasterSyncConfirmed) {
        setErrorMessage('Sila tandakan kotak pengesahan Master Catalog Sync sebelum meneruskan.');
        return;
      }

      setIsProcessing(true);
      try {
        const payload: MasterCatalogSyncPayload = {
          filename: fileName || 'katalog_master.csv',
          validatedRows: masterSyncResult.rows,
          missingProducts: masterSyncResult.missingProducts,
        };

        const commitFn = onCommitMasterSync || commitMasterCatalogSync;
        const res = commitFn(payload);
        setMasterCommitResult(res);
      } catch (err: any) {
        console.error('Master Sync commit error:', err);
        setErrorMessage(err.message || 'Ralat berlaku semasa menyelaraskan katalog master.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // MODE 2 & 3: Standard Upsert / Skip Existing
    if (!upsertValidationResult) return;
    try {
      const payload: CommitUpsertPayload = {
        mode: importMode,
        newItems: upsertValidationResult.newItems,
        updateItems: upsertValidationResult.updateItems,
        skippedCount: upsertValidationResult.skipCount,
        invalidCount: upsertValidationResult.invalidCount,
      };

      if (onCommitUpsertImport) {
        const res = onCommitUpsertImport(payload);
        setCommitResult(res);
      } else if (onCommitImport) {
        onCommitImport(upsertValidationResult.newItems);
        setCommitResult({
          newCount: upsertValidationResult.newItems.length,
          updatedCount: 0,
          skippedCount: upsertValidationResult.skipCount,
          invalidCount: upsertValidationResult.invalidCount,
        });
      } else if (onCommit) {
        onCommit(upsertValidationResult.newItems);
        setCommitResult({
          newCount: upsertValidationResult.newItems.length,
          updatedCount: 0,
          skippedCount: upsertValidationResult.skipCount,
          invalidCount: upsertValidationResult.invalidCount,
        });
      }
    } catch (err: any) {
      console.error('Import commit error:', err);
      setErrorMessage(err.message || 'Ralat berlaku semasa mengimport data.');
    }
  };

  const isCommitDisabled = () => {
    if (isProcessing) return true;

    if (importMode === 'MASTER_SYNC') {
      if (!masterSyncResult) return true;
      if (!masterSyncResult.isValid || masterSyncResult.invalidCount > 0) return true;
      if (!isMasterSyncConfirmed) return true;
      return false;
    }

    if (!upsertValidationResult) return true;
    if (importMode === 'UPDATE_EXISTING') {
      const totalActionable = upsertValidationResult.newCount + upsertValidationResult.updateCount;
      if (totalActionable === 0) return true;
      if (upsertValidationResult.updateCount > 0 && !isUpdateConfirmed) return true;
      return false;
    } else {
      return upsertValidationResult.newCount === 0;
    }
  };

  const getCommitButtonLabel = () => {
    if (importMode === 'MASTER_SYNC') {
      if (!masterSyncResult) return 'Komit Penyelarasan Master';
      if (masterSyncResult.invalidCount > 0) {
        return `Terdapat ${masterSyncResult.invalidCount} Baris Tidak Sah (Perlu Dibetulkan)`;
      }
      if (!isMasterSyncConfirmed) {
        return 'Sahkan Penyelarasan Di Atas Untuk Meneruskan';
      }
      return `Komit Penyelarasan Master (${masterSyncResult.newCount} Baru, ${masterSyncResult.updateCount} Kemas Kini, ${masterSyncResult.stockAdjustmentsCount} Pelarasan Stok)`;
    }

    if (!upsertValidationResult) return 'Komit Import';

    if (importMode === 'UPDATE_EXISTING') {
      const { newCount, updateCount } = upsertValidationResult;
      if (newCount > 0 && updateCount > 0) {
        return `Komit Import (${newCount} Baru + ${updateCount} Kemas Kini)`;
      }
      if (newCount > 0 && updateCount === 0) {
        return `Komit Import (${newCount} Produk)`;
      }
      if (newCount === 0 && updateCount > 0) {
        return `Komit Import (${updateCount} Kemas Kini)`;
      }
      return 'Tiada Item Untuk Dikomit';
    } else {
      const { newCount } = upsertValidationResult;
      if (newCount > 0) {
        return `Komit Import (${newCount} Produk)`;
      }
      return 'Tiada Produk Baru (Semua Dilangkau)';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="csv-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs select-none"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Import Katalog Produk (CSV)
                </h3>
                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Master Sync Standard
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Penyelarasan Katalog Master Semasa &amp; Pelarasan Stok Berintegriti
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-md hover:bg-stone-200/60 transition cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Ralat Penyelarasan</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STATE 1: Master Catalog Sync Completed Screen (Section 23) */}
          {masterCommitResult ? (
            <div className="py-6 px-4 text-center space-y-5 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">
                  Penyelarasan Katalog Master Selesai
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  Katalog kedai dan stok fizikal berjaya diselaraskan secara atomik mengikut fail CSV master.
                </p>
              </div>

              {/* Pre-sync Backup Timestamp (Section 20) */}
              <div className="p-2.5 bg-stone-100 rounded-lg text-xs text-stone-600 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Sandaran Keselamatan (Backup) Dibuat Pada:{' '}
                  <strong className="text-stone-900 font-mono">
                    {new Date(masterCommitResult.backupSnapshotAt).toLocaleTimeString('ms-MY', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </strong>
                </span>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Produk Baru Ditambah:</span>
                  <span className="text-base font-bold text-emerald-700">+{masterCommitResult.newCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Produk Dikemas Kini:</span>
                  <span className="text-base font-bold text-indigo-700">{masterCommitResult.updatedCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Pelarasan Stok (ADJUSTMENT):</span>
                  <span className="text-base font-bold text-teal-700">{masterCommitResult.stockAdjustmentsCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Katalog Tidak Berubah:</span>
                  <span className="text-base font-bold text-stone-700">{masterCommitResult.unchangedCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Dinyahaktifkan (Arkib Sejarah):</span>
                  <span className="text-base font-bold text-amber-700">{masterCommitResult.deactivatedCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Dikeluarkan (Tiada Sejarah):</span>
                  <span className="text-base font-bold text-purple-700">{masterCommitResult.removedCount}</span>
                </div>
              </div>

              {/* Historical Immutability Guarantee */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-left flex items-start gap-2.5 text-xs text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">Perlindungan Rekod Perniagaan Lampau 100%</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                    Semua transaksi jualan lepas, snapshot kos/harga dalam SaleItem, dan rekod pergerakan stok lampau tidak diubah sama sekali. Margin keuntungan lepas kekal tepat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="close-master-sync-success-btn"
                onClick={handleClose}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Tutup (Kembali ke Katalog Produk)
              </button>
            </div>
          ) : commitResult ? (
            /* STATE 1B: Legacy Upsert Completed Screen */
            <div className="py-6 px-4 text-center space-y-5 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">Import Selesai</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Transaksi katalog berjaya disempurnakan secara atomik tanpa ralat.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Produk Baru Ditambah:</span>
                  <span className="text-base font-bold text-emerald-700">{commitResult.newCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Produk Dikemas Kini:</span>
                  <span className="text-base font-bold text-indigo-700">{commitResult.updatedCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Produk Dilangkau:</span>
                  <span className="text-base font-bold text-amber-700">{commitResult.skippedCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-xs">
                  <span className="text-[11px] text-stone-500 block">Baris Tidak Sah:</span>
                  <span className="text-base font-bold text-rose-700">{commitResult.invalidCount}</span>
                </div>
              </div>

              <button
                type="button"
                id="close-import-success-btn"
                onClick={handleClose}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          ) : !parsedRows ? (
            /* STATE 2: File Upload Screen */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition bg-stone-50 hover:bg-emerald-50/20 group"
              >
                <UploadCloud className="w-10 h-10 text-stone-400 group-hover:text-emerald-600 mx-auto mb-2 transition" />
                <p className="text-sm font-semibold text-stone-800">
                  Klik atau seret fail CSV katalog ke sini
                </p>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                  Format standard: SKU, Name, Category, Cost Price, Selling Price, Current Stock, Minimum Stock, Status, Image URL (Pilihan)
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    CsvService.downloadProductsCsvTemplate();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Muat Turun Templat CSV Produk</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-xs text-emerald-950 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Sistem Penyelarasan Master Catalog NiagaPOS</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Fail CSV yang dimuat naik akan dianggap sebagai data katalog master semasa. Produk sedia ada akan dikemas kini dan diselaraskan stoknya melalui rekod lejar ADJUSTMENT rasmi. Produk baru akan didaftarkan, manakala semua sejarah jualan lepas kekal 100% terlindung.
                </p>
              </div>

              {isProcessing && (
                <div className="text-center py-4 text-xs text-stone-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Menganalisis fail CSV dan membandingkan dengan katalog kedai...</span>
                </div>
              )}
            </div>
          ) : (
            /* STATE 3: Preview & Mode Selection Screen */
            <div className="space-y-4">
              {/* File Pill */}
              <div className="p-2.5 bg-stone-100 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-600" />
                  <span className="font-semibold text-stone-800">{fileName}</span>
                  <span className="text-[11px] text-stone-500">
                    ({parsedRows.length} baris diimbas)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-stone-600 hover:text-stone-900 underline text-[11px] cursor-pointer"
                >
                  Pilih fail lain
                </button>
              </div>

              {/* Import Mode Selection Cards */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Pilih Mod Import / Penyelarasan:
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Mode 1: MASTER_SYNC */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition ${
                      importMode === 'MASTER_SYNC'
                        ? 'bg-white border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:bg-white text-stone-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="MASTER_SYNC"
                      checked={importMode === 'MASTER_SYNC'}
                      onChange={() => {
                        setImportMode('MASTER_SYNC');
                        setIsMasterSyncConfirmed(false);
                        setActiveFilter('ALL');
                      }}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                        <span>1. Master Catalog Sync</span>
                        <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded-sm font-bold">
                          Standard
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-snug">
                        Fail CSV adalah katalog master terkini. Kemas kini data, selaraskan stok (ADJUSTMENT), tambah produk baru &amp; nyahaktifkan yang tiada.
                      </p>
                    </div>
                  </label>

                  {/* Mode 2: UPDATE_EXISTING */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition ${
                      importMode === 'UPDATE_EXISTING'
                        ? 'bg-white border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:bg-white text-stone-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="UPDATE_EXISTING"
                      checked={importMode === 'UPDATE_EXISTING'}
                      onChange={() => {
                        setImportMode('UPDATE_EXISTING');
                        setIsUpdateConfirmed(false);
                        setActiveFilter('ALL');
                      }}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                        <span>2. Kemas Kini Sahaja</span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-snug">
                        Kemas kini nama, kategori, harga kos &amp; harga jual. Stok fizikal sedia ada tidak disentuh.
                      </p>
                    </div>
                  </label>

                  {/* Mode 3: SKIP_EXISTING */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition ${
                      importMode === 'SKIP_EXISTING'
                        ? 'bg-white border-amber-500 ring-1 ring-amber-500/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:bg-white text-stone-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="SKIP_EXISTING"
                      checked={importMode === 'SKIP_EXISTING'}
                      onChange={() => {
                        setImportMode('SKIP_EXISTING');
                        setIsUpdateConfirmed(false);
                        setActiveFilter('ALL');
                      }}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                        <span>3. Langkau Sedia Ada</span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-snug">
                        Hanya tambah produk dengan SKU baru. Semua SKU sedia ada dilangkau sepenuhnya.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* RENDER MODE-SPECIFIC PREVIEW */}
              {importMode === 'MASTER_SYNC' && masterSyncResult && (
                <>
                  {/* Summary Metric Cards (Section 21) */}
                  <div>
                    <div className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>RINGKASAN PENYELARASAN KATALOG MASTER</span>
                      <span className="text-[11px] font-normal text-stone-500 lowercase">
                        {masterSyncResult.totalRows} baris CSV diproses
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      <div className="p-2 rounded-lg border border-stone-200 bg-stone-50 text-center">
                        <div className="text-sm font-bold text-stone-900">{masterSyncResult.totalRows}</div>
                        <div className="text-[9px] text-stone-500 uppercase font-medium">Baris CSV</div>
                      </div>
                      <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-center">
                        <div className="text-sm font-bold text-emerald-700">+{masterSyncResult.newCount}</div>
                        <div className="text-[9px] text-emerald-700 uppercase font-medium">Produk Baru</div>
                      </div>
                      <div className="p-2 rounded-lg border border-indigo-200 bg-indigo-50 text-center">
                        <div className="text-sm font-bold text-indigo-700">{masterSyncResult.updateCount}</div>
                        <div className="text-[9px] text-indigo-700 uppercase font-medium">Kemas Kini</div>
                      </div>
                      <div className="p-2 rounded-lg border border-teal-200 bg-teal-50 text-center">
                        <div className="text-sm font-bold text-teal-700">
                          {masterSyncResult.stockAdjustmentsCount}
                        </div>
                        <div className="text-[9px] text-teal-700 uppercase font-medium">Pelarasan Stok</div>
                      </div>
                      <div className="p-2 rounded-lg border border-stone-200 bg-stone-100 text-center">
                        <div className="text-sm font-bold text-stone-700">{masterSyncResult.unchangedCount}</div>
                        <div className="text-[9px] text-stone-600 uppercase font-medium">Tidak Berubah</div>
                      </div>
                      <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-center">
                        <div className="text-sm font-bold text-amber-700">{masterSyncResult.missingProductsCount}</div>
                        <div className="text-[9px] text-amber-700 uppercase font-medium">Tiada Dlm CSV</div>
                      </div>
                      <div className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-center">
                        <div className="text-sm font-bold text-rose-700">{masterSyncResult.invalidCount}</div>
                        <div className="text-[9px] text-rose-700 uppercase font-medium">Tidak Sah</div>
                      </div>
                    </div>
                  </div>

                  {/* Stock difference breakdown alert */}
                  <div className="p-2.5 bg-teal-50/80 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-teal-900">Perincian Pelarasan Stok Inventori: </span>
                      {masterSyncResult.stockIncreaseCount} kenaikan stok, {masterSyncResult.stockDecreaseCount} pengurangan stok. Setiap perbezaan stok akan direkodkan sebagai transaksi lejar <code className="px-1 py-0.2 bg-teal-100 rounded text-teal-900 font-mono">ADJUSTMENT</code> rasmi dengan sebab &quot;CSV Master Catalog Sync&quot;.
                    </div>
                  </div>

                  {/* Missing products breakdown alert (Section 15, 16, 17) */}
                  {masterSyncResult.missingProductsCount > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <Archive className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold text-amber-950">
                          {masterSyncResult.missingProductsCount} Produk Sedia Ada Tiada Dalam Fail CSV:
                        </span>{' '}
                        {masterSyncResult.deactivatedCount} produk mempunyai rekod transaksi jualan/pembelian dan akan <strong>dinyahaktifkan (active = false)</strong> untuk memelihara integriti sejarah kewangan. {masterSyncResult.removedCount} produk demo/ujian tanpa sebarang rekod sejarah akan dikeluarkan secara selamat.
                      </div>
                    </div>
                  )}

                  {/* Master Sync Confirmation Box (Section 22) */}
                  <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-stone-900 text-sm">
                          Pengesahan Penyelarasan Katalog Master (Master Sync Confirmation)
                        </p>
                        <p className="text-xs text-stone-700 leading-relaxed">
                          Penyelarasan ini akan menyelaraskan katalog operasi mengikut fail CSV terkini:
                        </p>
                        <ul className="text-[11px] text-stone-700 list-disc list-inside space-y-0.5 ml-1">
                          <li><strong>{masterSyncResult.newCount}</strong> produk baru akan didaftarkan ke dalam sistem.</li>
                          <li><strong>{masterSyncResult.updateCount}</strong> produk sedia ada akan dikemaskini maklumat nama, kos, dan harga jualnya.</li>
                          <li><strong>{masterSyncResult.stockAdjustmentsCount}</strong> pelarasan stok inventori akan direkodkan.</li>
                          {masterSyncResult.deactivatedCount > 0 && (
                            <li><strong>{masterSyncResult.deactivatedCount}</strong> produk dengan sejarah transaksi akan dinyahaktifkan dari senarai aktif.</li>
                          )}
                          {masterSyncResult.removedCount > 0 && (
                            <li><strong>{masterSyncResult.removedCount}</strong> produk demo tanpa sejarah akan dikeluarkan secara selamat.</li>
                          )}
                          <li>Sandaran keselamatan (backup snapshot) akan dicipta secara automatik sebelum perubahan dilakukan.</li>
                        </ul>
                      </div>
                    </div>
                    <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200 text-xs font-medium text-stone-800 cursor-pointer hover:bg-amber-50/50 transition">
                      <input
                        type="checkbox"
                        id="confirm-master-sync-checkbox"
                        checked={isMasterSyncConfirmed}
                        onChange={(e) => setIsMasterSyncConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                      />
                      <span>
                        Saya faham dan mengesahkan pelaksanaan Master Catalog Sync ini.
                      </span>
                    </label>
                  </div>

                  {/* Filter Tabs & Preview Table */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-stone-800">
                        Pratonton Perincian Baris &amp; Pelarasan
                      </h4>
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setActiveFilter('ALL')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'ALL'
                              ? 'bg-stone-800 text-white'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          Semua ({masterSyncResult.rows.length + masterSyncResult.missingProducts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('NEW')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'NEW'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Baru ({masterSyncResult.newCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('UPDATE')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'UPDATE'
                              ? 'bg-indigo-700 text-white'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          Kemas Kini ({masterSyncResult.updateCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('STOCK_CHANGED')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'STOCK_CHANGED'
                              ? 'bg-teal-700 text-white'
                              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                          }`}
                        >
                          Stok Berubah ({masterSyncResult.stockAdjustmentsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('UNCHANGED')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'UNCHANGED'
                              ? 'bg-stone-700 text-white'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          Kekal ({masterSyncResult.unchangedCount})
                        </button>
                        {masterSyncResult.missingProducts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveFilter('NOT_IN_IMPORT')}
                            className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                              activeFilter === 'NOT_IN_IMPORT'
                                ? 'bg-amber-700 text-white'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            Tiada Dlm Fail ({masterSyncResult.missingProducts.length})
                          </button>
                        )}
                        {masterSyncResult.invalidCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveFilter('INVALID')}
                            className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                              activeFilter === 'INVALID'
                                ? 'bg-rose-700 text-white'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            Tidak Sah ({masterSyncResult.invalidCount})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border border-stone-200 rounded-lg overflow-x-auto max-h-60 text-xs shadow-inner">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 border-b border-stone-200 text-[11px] text-stone-600 font-semibold sticky top-0 z-10">
                          <tr>
                            <th className="p-2 w-10 text-center">#</th>
                            <th className="p-2">SKU</th>
                            <th className="p-2">Produk &amp; Kategori</th>
                            <th className="p-2 text-right">Kos / Jual</th>
                            <th className="p-2 text-center">Stok (Semasa → CSV)</th>
                            <th className="p-2 text-center">Tindakan</th>
                            <th className="p-2">Sebab &amp; Nota Pelarasan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {/* CSV Rows */}
                          {filteredMasterRows.csvRows.map((row, idx) => (
                            <tr
                              key={`csv-${idx}`}
                              className={`hover:bg-stone-50/80 transition ${
                                row.action === 'NEW'
                                  ? 'bg-emerald-50/20'
                                  : row.action === 'UPDATE'
                                  ? 'bg-indigo-50/20'
                                  : row.action === 'UNCHANGED'
                                  ? 'bg-stone-50/10'
                                  : 'bg-rose-50/20'
                              }`}
                            >
                              <td className="p-2 text-center text-stone-400 text-[11px]">
                                {row.rowNumber}
                              </td>
                              <td className="p-2 font-mono font-medium text-stone-900 whitespace-nowrap">
                                {row.sku}
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  {row.imageUrl ? (
                                    <img
                                      src={row.imageUrl}
                                      alt=""
                                      className="w-7 h-7 object-cover rounded border border-stone-200 shrink-0"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                  <div>
                                    <div className="font-medium text-stone-900">{row.name}</div>
                                    <div className="text-[10px] text-stone-500">{row.category}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-right whitespace-nowrap text-[11px]">
                                <span className={row.costChanged ? 'font-bold text-amber-700' : 'text-stone-600'}>
                                  RM {row.costPrice.toFixed(2)}
                                </span>
                                <span className="mx-1 text-stone-300">/</span>
                                <span className={row.sellingPriceChanged ? 'font-bold text-indigo-700' : 'font-semibold text-stone-900'}>
                                  RM {row.sellingPrice.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-2 text-center whitespace-nowrap">
                                {row.action === 'NEW' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    0 → {row.csvStock} (+{row.csvStock})
                                  </span>
                                ) : (row.stockDifference || 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {row.currentStock} → {row.csvStock} (+{row.stockDifference})
                                  </span>
                                ) : (row.stockDifference || 0) < 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    {row.currentStock} → {row.csvStock} ({row.stockDifference})
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-stone-500">
                                    {row.currentStock} (Kekal)
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center whitespace-nowrap">
                                {row.action === 'NEW' && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    NEW
                                  </span>
                                )}
                                {row.action === 'UPDATE' && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    UPDATE
                                  </span>
                                )}
                                {row.action === 'UNCHANGED' && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                    UNCHANGED
                                  </span>
                                )}
                                {row.action === 'INVALID' && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    INVALID
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-[11px] max-w-xs">
                                <div className="text-stone-700">{row.reason}</div>
                                {row.stockNote && (
                                  <div className="text-[10px] text-stone-500 mt-0.5 italic">
                                    {row.stockNote}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}

                          {/* Missing Products (Not in CSV) */}
                          {filteredMasterRows.missingRows.map((missing, idx) => (
                            <tr
                              key={`missing-${idx}`}
                              className={
                                missing.action === 'DEACTIVATE'
                                  ? 'bg-amber-50/30 hover:bg-amber-50/50 transition'
                                  : 'bg-purple-50/30 hover:bg-purple-50/50 transition'
                              }
                            >
                              <td className="p-2 text-center text-stone-400 text-[11px]">-</td>
                              <td className="p-2 font-mono font-medium text-stone-700 whitespace-nowrap">
                                {missing.product.sku}
                              </td>
                              <td className="p-2">
                                <div className="font-medium text-stone-800">{missing.product.name}</div>
                                <div className="text-[10px] text-stone-500">{missing.product.category}</div>
                              </td>
                              <td className="p-2 text-right whitespace-nowrap text-[11px] text-stone-500">
                                RM {missing.product.costPrice.toFixed(2)} / RM {missing.product.sellingPrice.toFixed(2)}
                              </td>
                              <td className="p-2 text-center whitespace-nowrap text-[11px] text-stone-500">
                                {missing.product.currentStock} (Stok Ditahan)
                              </td>
                              <td className="p-2 text-center whitespace-nowrap">
                                {missing.action === 'DEACTIVATE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Archive className="w-3 h-3" />
                                    NYAHAKTIF
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Trash2 className="w-3 h-3" />
                                    KELUARKAN
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-[11px] max-w-xs text-stone-600">
                                {missing.reason}
                              </td>
                            </tr>
                          ))}

                          {filteredMasterRows.csvRows.length === 0 && filteredMasterRows.missingRows.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-xs text-stone-500 italic">
                                Tiada rekod untuk tapisan ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* RENDER STANDARD UPSERT / SKIP PREVIEW */}
              {importMode !== 'MASTER_SYNC' && upsertValidationResult && (
                <>
                  <div>
                    <div className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>CSV IMPORT PREVIEW</span>
                      <span className="text-[11px] font-normal text-stone-500 lowercase">
                        {upsertValidationResult.totalRows} total rows
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-center">
                        <div className="text-base font-bold text-stone-900">{upsertValidationResult.totalRows}</div>
                        <div className="text-[10px] text-stone-500 uppercase font-medium">Total Rows</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-center">
                        <div className="text-base font-bold text-emerald-700">{upsertValidationResult.newCount}</div>
                        <div className="text-[10px] text-emerald-600 uppercase font-medium">New</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-center">
                        <div className="text-base font-bold text-indigo-700">{upsertValidationResult.existingCount}</div>
                        <div className="text-[10px] text-indigo-600 uppercase font-medium">Existing</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-center">
                        <div className="text-base font-bold text-rose-700">{upsertValidationResult.invalidCount}</div>
                        <div className="text-[10px] text-rose-600 uppercase font-medium">Invalid</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-amber-800">Perlindungan Stok Sedia Ada: </span>
                      Dalam mod ini, lajur stok diabaikan untuk produk sedia ada bagi mengekalkan kuantiti inventori semasa.
                    </div>
                  </div>

                  {importMode === 'UPDATE_EXISTING' && upsertValidationResult.updateCount > 0 && (
                    <div className="p-3 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-indigo-950">
                            Pengesahan Diperlukan:
                          </p>
                          <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                            {upsertValidationResult.updateCount} produk sedia ada akan dikemas kini katalognya.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 p-2 bg-white/80 rounded-md border border-indigo-200 text-[11px] font-medium text-stone-800 cursor-pointer hover:bg-white">
                        <input
                          type="checkbox"
                          id="confirm-update-existing-checkbox"
                          checked={isUpdateConfirmed}
                          onChange={(e) => setIsUpdateConfirmed(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          Saya faham dan mengesahkan kemas kini katalog bagi {upsertValidationResult.updateCount} produk sedia ada ini.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-stone-800">
                        Pratonton Baris ({upsertValidationResult.rows.length} Baris)
                      </h4>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setActiveFilter('ALL')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'ALL'
                              ? 'bg-stone-800 text-white'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          Semua ({upsertValidationResult.rows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('NEW')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'NEW'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Baru ({upsertValidationResult.newCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('UPDATE')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'UPDATE'
                              ? 'bg-indigo-700 text-white'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          Kemas Kini ({upsertValidationResult.updateCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('SKIP')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'SKIP'
                              ? 'bg-amber-700 text-white'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          Dilangkau ({upsertValidationResult.skipCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('INVALID')}
                          className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            activeFilter === 'INVALID'
                              ? 'bg-rose-700 text-white'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          Tidak Sah ({upsertValidationResult.invalidCount})
                        </button>
                      </div>
                    </div>

                    <div className="border border-stone-200 rounded-lg overflow-x-auto max-h-56 text-xs shadow-inner">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 border-b border-stone-200 text-[11px] text-stone-600 font-semibold sticky top-0 z-10">
                          <tr>
                            <th className="p-2 w-10 text-center">#</th>
                            <th className="p-2">SKU</th>
                            <th className="p-2">Produk</th>
                            <th className="p-2 text-right">Kos / Jual</th>
                            <th className="p-2 text-center">Tindakan</th>
                            <th className="p-2">Sebab &amp; Nota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredUpsertRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-xs text-stone-500 italic">
                                Tiada rekod untuk tapisan ini.
                              </td>
                            </tr>
                          ) : (
                            filteredUpsertRows.map((row, idx) => (
                              <tr
                                key={idx}
                                className={`hover:bg-stone-50/80 transition ${
                                  row.action === 'NEW'
                                    ? 'bg-emerald-50/20'
                                    : row.action === 'UPDATE'
                                    ? 'bg-indigo-50/20'
                                    : row.action === 'SKIP'
                                    ? 'bg-amber-50/10 opacity-80'
                                    : 'bg-rose-50/20'
                                }`}
                              >
                                <td className="p-2 text-center text-stone-400 text-[11px]">
                                  {row.rowNumber}
                                </td>
                                <td className="p-2 font-mono font-medium text-stone-900 whitespace-nowrap">
                                  {row.sku}
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    {row.imageUrl ? (
                                      <img
                                        src={row.imageUrl}
                                        alt=""
                                        className="w-7 h-7 object-cover rounded border border-stone-200 shrink-0"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : null}
                                    <div>
                                      <div className="font-medium text-stone-900">{row.name}</div>
                                      <div className="text-[10px] text-stone-500">{row.category}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2 text-right whitespace-nowrap text-[11px]">
                                  <span className="text-stone-500">RM {row.costPrice.toFixed(2)}</span>
                                  <span className="mx-1 text-stone-300">/</span>
                                  <span className="font-semibold text-stone-900">RM {row.sellingPrice.toFixed(2)}</span>
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">
                                  {row.action === 'NEW' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      NEW
                                    </span>
                                  )}
                                  {row.action === 'UPDATE' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      UPDATE
                                    </span>
                                  )}
                                  {row.action === 'SKIP' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      SKIP
                                    </span>
                                  )}
                                  {row.action === 'INVALID' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      INVALID
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-[11px] max-w-xs">
                                  <div className="text-stone-700">{row.reason}</div>
                                  {row.stockNote && (
                                    <div className="text-[10px] text-amber-700 mt-0.5 italic font-medium">
                                      {row.stockNote}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            {masterCommitResult || commitResult ? 'Selesai' : 'Batal'}
          </button>

          {!masterCommitResult && !commitResult && parsedRows && (
            <button
              type="button"
              id="commit-csv-import-btn"
              onClick={handleCommit}
              disabled={isCommitDisabled()}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                isCommitDisabled()
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : importMode === 'MASTER_SYNC'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : importMode === 'UPDATE_EXISTING'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{getCommitButtonLabel()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

