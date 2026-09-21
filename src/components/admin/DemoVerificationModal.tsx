import React, { useState } from 'react';
import { ShieldCheck, Play, CheckCircle2, XCircle, AlertCircle, X, RefreshCw } from 'lucide-react';
import { DemoSandboxVerificationRunner, GateTestResult } from '../../services/demoSandboxVerificationRunner';

interface DemoVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoVerificationModal: React.FC<DemoVerificationModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult[];
  } | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await DemoSandboxVerificationRunner.runAllGates();
      setReport(res);
    } catch (e) {
      console.error('Test execution error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      id="demo-verification-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        id="demo-verification-modal-container"
        className="w-full max-w-3xl max-h-[90vh] bg-stone-900 text-stone-100 rounded-2xl shadow-2xl border border-stone-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Ujian Pengesahan Keselamatan Sandbox Demo (SES v4.5)</h3>
              <p className="text-xs text-stone-400">15 Pintu Keselamatan Automatik untuk Kestabilan Pengeluaran</p>
            </div>
          </div>
          <button
            id="btn-close-verification-modal"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!report && !isRunning && (
            <div className="text-center py-10 space-y-4">
              <ShieldCheck className="w-12 h-12 text-emerald-400/80 mx-auto" />
              <div className="max-w-md mx-auto">
                <h4 className="font-semibold text-white text-sm">Jalankan 15 Pintu Pengesahan</h4>
                <p className="text-xs text-stone-400 mt-1">
                  Ujian ini menyemak pemencilan sandbox demo, integriti dataset benih v1.0.0, sekatan PIN pengeluaran, perlindungan allowlist storan dan telemetri tanpa PII.
                </p>
              </div>
              <button
                id="btn-run-all-verification-gates"
                onClick={handleRunTests}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition shadow-md cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Mulakan Ujian Pengesahan Sekarang</span>
              </button>
            </div>
          )}

          {isRunning && (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-stone-300">Menjalankan 15 Pintu Pengesahan Keselamatan...</p>
              <p className="text-2xs text-stone-500">Memeriksa token, pengasingan tenant, batasan allowlist & pembasmian regresi</p>
            </div>
          )}

          {report && !isRunning && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report.passed
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {report.passed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {report.passed
                        ? 'Semua 15 Pintu Keselamatan LULUS dengan Cemerlang'
                        : `${report.failedCount} Daripada ${report.total} Pintu Keselamatan Gagal`}
                    </h4>
                    <p className="text-xs opacity-80">
                      {report.passedCount} lulus / {report.total} jumlah ujian dijalankan
                    </p>
                  </div>
                </div>

                <button
                  id="btn-rerun-verification"
                  onClick={handleRunTests}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-lg transition border border-stone-700 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Uji Semula</span>
                </button>
              </div>

              {/* Individual Gate Cards */}
              <div className="space-y-2">
                {report.results.map((gate) => (
                  <div
                    key={gate.gateId}
                    className="p-3 bg-stone-950/60 border border-stone-800/80 rounded-xl flex items-start gap-3"
                  >
                    <div className="mt-0.5 shrink-0">
                      {gate.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-stone-200">
                          Gate {gate.gateId}: {gate.name}
                        </span>
                        <span
                          className={`text-2xs font-bold px-2 py-0.5 rounded ${
                            gate.passed
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {gate.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <p className="text-2xs text-stone-400 mt-0.5">{gate.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950/60 border-t border-stone-800 flex items-center justify-between">
          <span className="text-2xs text-stone-500 font-mono">Standar Keselamatan: SES v4.5</span>
          <button
            id="btn-close-verification-bottom"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
