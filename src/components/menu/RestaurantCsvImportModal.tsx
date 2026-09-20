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
  UtensilsCrossed,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { RestaurantCsvService, RestaurantCsvValidationReport, ParsedCsvMenuItem } from '../../services/restaurantCsvService';
import { MenuItem } from '../../types/restaurant';

interface RestaurantCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug?: string;
  onImportSuccess: (importedCount: number, updatedCount: number) => void;
}

type TabFilter = 'ALL' | 'VALID' | 'DUPLICATES' | 'INVALID';

export const RestaurantCsvImportModal: React.FC<RestaurantCsvImportModalProps> = ({
  isOpen,
  onClose,
  workspaceSlug = 'default',
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<RestaurantCsvValidationReport | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'SKIP' | 'UPDATE' | 'ABORT'>('SKIP');
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setIsDragging(false);
    setParseError(null);
    setReport(null);
    setActiveTab('ALL');
    setIsSubmitting(false);
    setSuccessMessage(null);
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
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setParseError('Fail CSV tidak mengandungi data.');
          return;
        }
        const validation = RestaurantCsvService.validateCsv(text, workspaceSlug);
        setReport(validation);
      } catch (err: any) {
        setParseError(err.message || 'Gagal memproses kandungan fail CSV.');
      }
    };
    reader.onerror = () => {
      setParseError('Ralat membaca fail dari peranti.');
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCommit = async () => {
    if (!report || report.parsedItems.length === 0) return;

    const validItems = report.parsedItems.filter((item) => item.errors.length === 0);
    if (validItems.length === 0) {
      setParseError('Tiada rekod sah untuk diimport.');
      return;
    }

    setIsSubmitting(true);
    setParseError(null);

    try {
      const result = RestaurantCsvService.commitImport(validItems, workspaceSlug, {
        actionOnDuplicates: duplicateAction,
      });

      if (result.aborted) {
        setParseError('Import dibatalkan kerana terdapat rekod duplikasi dalam fail atau pangkalan data.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `Berjaya mengimport ${result.importedCount} hidangan baharu dan mengemaskini ${result.updatedCount} hidangan sedia ada.`
      );
      onImportSuccess(result.importedCount, result.updatedCount);
    } catch (err: any) {
      setParseError(err.message || 'Gagal menyimpan rekod yang diimport ke pangkalan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems: ParsedCsvMenuItem[] = report
    ? report.parsedItems.filter((item) => {
        if (activeTab === 'VALID') return item.errors.length === 0;
        if (activeTab === 'DUPLICATES') return item.isDuplicate;
        if (activeTab === 'INVALID') return item.errors.length > 0;
        return true;
      })
    : [];

  return (
    <div
      id="restaurant-csv-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none"
    >
      <div
        id="restaurant-csv-import-modal"
        className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Import Menu Restoran Melalui CSV</h3>
              <p className="text-[11px] text-stone-400">
                Piawaian SES v4.5: Sokongan Nama, Kategori, Harga, Variasi, Modifier, dan Stesen Dapur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Download Templates Banner */}
          <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-stone-300">
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Muat turun templat CSV rasmi untuk rujukan format:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => RestaurantCsvService.downloadMenuCsvTemplate('WALI_CAPATI')}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 font-medium transition"
              >
                Capati &amp; Nan
              </button>
              <button
                type="button"
                onClick={() => RestaurantCsvService.downloadMenuCsvTemplate('TOMYAM')}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 font-medium transition"
              >
                Tomyam Kelate
              </button>
              <button
                type="button"
                onClick={() => RestaurantCsvService.downloadMenuCsvTemplate('STANDARD')}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 font-medium transition"
              >
                Standard
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {parseError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Upload Area */}
          {!report && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-950/20'
                  : 'border-stone-800 hover:border-stone-700 bg-stone-950/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-center text-stone-300 mb-3">
                <UploadCloud className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                Pilih atau seret fail CSV menu ke sini
              </h4>
              <p className="text-xs text-stone-400 max-w-sm">
                Sistem akan memvalidasi nama, kategori, harga, dan format modifier sebelum data dimasukkan.
              </p>
            </div>
          )}

          {/* Validation & Preview Report */}
          {report && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-[10px] text-stone-500 block uppercase font-mono">Jumlah Rekod</span>
                  <span className="text-lg font-bold font-mono text-white">{report.totalRows}</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-[10px] text-emerald-500 block uppercase font-mono">Sah (Sedia Import)</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{report.validRows}</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-[10px] text-amber-500 block uppercase font-mono">Duplikasi Dikesan</span>
                  <span className="text-lg font-bold font-mono text-amber-400">{report.duplicateCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-[10px] text-rose-500 block uppercase font-mono">Ralat Baris</span>
                  <span className="text-lg font-bold font-mono text-rose-400">{report.invalidRows}</span>
                </div>
              </div>

              {/* Duplicate Resolution Options */}
              <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="font-semibold text-white block">Tindakan terhadap Rekod Duplikasi:</span>
                  <span className="text-stone-400 text-[11px]">
                    {duplicateAction === 'SKIP' && 'Langkau rekod duplikasi, kekalkan data menu sedia ada.'}
                    {duplicateAction === 'UPDATE' && 'Kemaskini harga, variasi & maklumat menu yang sama nama.'}
                    {duplicateAction === 'ABORT' && 'Batalkan keseluruhan import jika terdapat duplikasi.'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-lg border border-stone-800">
                  <button
                    type="button"
                    onClick={() => setDuplicateAction('SKIP')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      duplicateAction === 'SKIP' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Langkau (Skip)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateAction('UPDATE')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      duplicateAction === 'UPDATE' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Kemaskini (Update)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateAction('ABORT')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      duplicateAction === 'ABORT' ? 'bg-rose-600 text-white' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Batal (Abort)
                  </button>
                </div>
              </div>

              {/* Table Filter Tabs */}
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'ALL' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Semua ({report.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('VALID')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'VALID' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Sah ({report.validRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('DUPLICATES')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'DUPLICATES' ? 'bg-stone-800 text-amber-400' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Duplikasi ({report.duplicateCount})
                  </button>
                  {report.invalidRows > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('INVALID')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        activeTab === 'INVALID' ? 'bg-stone-800 text-rose-400' : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      Ralat ({report.invalidRows})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetState}
                  className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Pilih Fail Lain</span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-stone-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-950 text-stone-400 border-b border-stone-800 font-mono text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2.5 w-12">Baris</th>
                      <th className="p-2.5">Nama Hidangan</th>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5">Harga</th>
                      <th className="p-2.5">Variasi / Modifiers</th>
                      <th className="p-2.5">Stesen</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-850">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.rowNumber}
                        className={`hover:bg-stone-800/40 transition ${
                          item.errors.length > 0
                            ? 'bg-rose-950/20 text-rose-300'
                            : item.isDuplicate
                            ? 'bg-amber-950/10'
                            : ''
                        }`}
                      >
                        <td className="p-2.5 font-mono text-stone-500">{item.rowNumber}</td>
                        <td className="p-2.5 font-medium text-stone-200">
                          {item.name || '<Kosong>'}
                          {item.description && (
                            <span className="block text-[10px] text-stone-500 truncate max-w-xs">
                              {item.description}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-stone-400">{item.category}</td>
                        <td className="p-2.5 font-mono text-emerald-400 font-semibold">
                          RM {item.price.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-stone-400">
                          {item.variants.length > 0 && (
                            <span className="text-[10px] bg-stone-800 px-1.5 py-0.5 rounded text-stone-300 mr-1">
                              {item.variants.length} Variasi
                            </span>
                          )}
                          {item.modifierGroups.length > 0 && (
                            <span className="text-[10px] bg-stone-800 px-1.5 py-0.5 rounded text-stone-300">
                              {item.modifierGroups.length} Modifier
                            </span>
                          )}
                          {item.variants.length === 0 && item.modifierGroups.length === 0 && (
                            <span className="text-stone-600">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-stone-400 text-[11px] font-mono">{item.kitchenStation}</td>
                        <td className="p-2.5">
                          {item.errors.length > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                              {item.errors.join(', ')}
                            </span>
                          ) : item.isDuplicate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                              {item.isDuplicateInDb ? 'Wujud dlm DB' : 'Duplikasi dlm Fail'}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              Sedia
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 flex items-center justify-between bg-stone-950/60">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition"
          >
            Tutup
          </button>

          {report && (
            <button
              type="button"
              id="confirm-import-csv-menu-btn"
              disabled={isSubmitting || report.validRows === 0}
              onClick={handleCommit}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memasukkan ke Pangkalan Data...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sahkan &amp; Import ({report.validRows} Hidangan)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
