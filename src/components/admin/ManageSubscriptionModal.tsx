/**
 * NiagaPOS & KedaiMakan — Master Admin Subscription Management Modal
 * Handles Monthly (RM10/mo) and Annual (RM110/yr) client subscription renewals.
 */

import React, { useState } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Copy,
  Receipt,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
} from 'lucide-react';
import {
  WorkspaceService,
  SUBSCRIPTION_PRICING,
  getClientAccessUrl,
} from '../../services/workspaceService';
import type {
  Workspace,
  SubscriptionPlan,
  SubscriptionPaymentMethod,
  WorkspacePaymentRecord,
} from '../../types/workspace';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  workspace: Workspace | null;
  onClose: () => void;
  onSuccess: (updatedWorkspace: Workspace, message: string) => void;
}

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  isOpen,
  workspace,
  onClose,
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>('DUITNOW_QR');
  const [referenceNote, setReferenceNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);
  const [lastPaymentDone, setLastPaymentDone] = useState<WorkspacePaymentRecord | null>(null);

  if (!isOpen || !workspace) return null;

  const currentExpiry = workspace.subscriptionExpiresAt
    ? new Date(workspace.subscriptionExpiresAt).getTime()
    : new Date(workspace.trialExpiresAt).getTime();

  const isExpired = Date.now() > currentExpiry;
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const additionalDays = SUBSCRIPTION_PRICING[selectedPlan].periodDays;
  const newProjectedExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);

  const formatDate = (dateStrOrMs: string | number) => {
    try {
      const d = new Date(dateStrOrMs);
      return d.toLocaleDateString('ms-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dateStrOrMs);
    }
  };

  const handleConfirmSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await WorkspaceService.recordSubscriptionPayment(
        workspace.workspaceId,
        selectedPlan,
        {
          paymentMethod,
          referenceNote,
          recordedBy: 'MASTER_ADMIN',
        }
      );

      if (res.success && res.workspace) {
        setLastPaymentDone(res.payment || null);
        const planName = SUBSCRIPTION_PRICING[selectedPlan].name;
        const msg = `Langganan ${planName} berjaya diaktifkan untuk ${res.workspace.workspaceName}.`;
        onSuccess(res.workspace, msg);
      } else {
        setError(res.error || 'Gagal merekodkan pembayaran langganan.');
      }
    } catch {
      setError('Ralat sambungan semasa mengemas kini status langganan.');
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppReceipt = (record?: WorkspacePaymentRecord | null) => {
    const rec = record || lastPaymentDone;
    const planConfig = rec ? SUBSCRIPTION_PRICING[rec.plan] : SUBSCRIPTION_PRICING[selectedPlan];
    const amount = rec ? rec.amount : planConfig.price;
    const expiry = rec ? formatDate(rec.newExpiresAt) : formatDate(newProjectedExpiry.getTime());
    const ref = (rec ? rec.referenceNote : referenceNote) || 'RESIT-' + Date.now().toString().slice(-6);
    const accessUrl = getClientAccessUrl(workspace);

    return `*RESIT PENGESAHAN LANGGANAN PLATFORM*
🏢 Kedai: ${workspace.workspaceName}
📦 Pelan: ${planConfig.name} (${planConfig.priceFormatted} / ${planConfig.durationText})
💰 Jumlah: RM${amount}.00
💳 Kaedah: ${rec?.paymentMethod || paymentMethod}
🔖 Rujukan: ${ref}
📅 Sah Sehingga: ${expiry}
🌐 Pautan Akses: ${accessUrl}

Terima kasih atas sokongan dan langganan anda bersama kami!`;
  };

  const handleCopyReceipt = (record?: WorkspacePaymentRecord | null) => {
    const text = generateWhatsAppReceipt(record);
    navigator.clipboard.writeText(text);
    const key = record?.paymentId || 'latest';
    setCopiedReceipt(key);
    setTimeout(() => setCopiedReceipt(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-4 animate-fadeIn font-sans">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Pengurusan Langganan Klien</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                  {workspace.platform === 'RESTAURANT' ? 'KEDAI MAKAN' : 'NIAGAPOS RUNCIT'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {workspace.workspaceName} <span className="font-mono text-stone-500">({workspace.workspaceSlug})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status Bar */}
          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-stone-400" />
              <div>
                <div className="text-[11px] text-stone-400">Status &amp; Tempoh Semasa:</div>
                <div className="font-semibold text-white">
                  Sah Sehingga: <span className={isExpired ? 'text-rose-400' : 'text-emerald-400'}>{formatDate(currentExpiry)}</span>{' '}
                  {isExpired && <span className="text-rose-400 font-bold">(Tamat Tempoh)</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400">Pelan Semasa:</span>
              <span className="font-bold px-2.5 py-1 rounded bg-stone-800 text-amber-300 border border-stone-700">
                {workspace.subscriptionPlan === 'MONTHLY'
                  ? 'Bulanan (RM10/bln)'
                  : workspace.subscriptionPlan === 'ANNUAL'
                  ? 'Tahunan (RM110/thn)'
                  : 'Percubaan (Trial)'}
              </span>
            </div>
          </div>

          {/* Form */}
          <form id="subscription-form" onSubmit={handleConfirmSubscription} className="space-y-4">
            {/* Plan Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-200 block">
                Pilih Pakej Pembaharuan / Langganan
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Monthly Card */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('MONTHLY')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer relative ${
                    selectedPlan === 'MONTHLY'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Pelan Bulanan</span>
                      <span className="text-emerald-400 font-mono font-bold text-base">RM10</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-1">Tempoh: +30 Hari Akses Penuh</div>
                    <p className="text-[10px] text-stone-500 mt-2">
                      Sesuai untuk bayaran fleksibel bulanan tanpa ikatan kontrak.
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">Kadar:</span>
                    <span className="font-mono text-stone-300">RM10 / bulan</span>
                  </div>
                </button>

                {/* Annual Card */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('ANNUAL')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer relative ${
                    selectedPlan === 'ANNUAL'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="absolute -top-2.5 right-3 bg-amber-500 text-stone-950 font-bold text-[9px] uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 fill-current" />
                    <span>JIMAT RM10</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Pelan Tahunan</span>
                      <span className="text-amber-400 font-mono font-bold text-base">RM110</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-1">Tempoh: +365 Hari (1 Tahun)</div>
                    <p className="text-[10px] text-stone-400 mt-2">
                      Paling jimat! Bayar 11 bulan nikmati 12 bulan (Jimat RM10 berbanding bayaran bulanan).
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">Kadar:</span>
                    <span className="font-mono text-amber-300">RM110 / setahun</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Projection Summary Box */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 flex items-start gap-3">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-xs text-white">
                  Kiraan Tempoh Baharu ({SUBSCRIPTION_PRICING[selectedPlan].name}):
                </div>
                <div className="text-[11px] text-stone-300">
                  Tarikh Luput Baharu:{' '}
                  <strong className="text-emerald-400 font-mono text-xs">
                    {formatDate(newProjectedExpiry.getTime())}
                  </strong>{' '}
                  <span className="text-stone-400">
                    (+{additionalDays} hari dari {isExpired ? 'hari ini' : 'tarikh luput semasa'})
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method & Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300 block">
                  Kaedah Pembayaran Klien
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as SubscriptionPaymentMethod)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition cursor-pointer"
                >
                  <option value="DUITNOW_QR">DuitNow QR / Instant Pay</option>
                  <option value="BANK_TRANSFER">Pindahan Bank (Online Banking)</option>
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="OTHER">Lain-lain Kaedah</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300 block">
                  Nombor Rujukan / Catatan Resit
                </label>
                <input
                  type="text"
                  placeholder="Cth: Ref: MBB-98124 / WhatsApp"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-800 text-stone-300 hover:bg-stone-800 transition font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/30 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengemas kini...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Sahkan Bayaran &amp; Aktifkan ({SUBSCRIPTION_PRICING[selectedPlan].priceFormatted})
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Last Payment Receipt Card (If payment just recorded or exists) */}
          {(lastPaymentDone || (workspace.paymentHistory && workspace.paymentHistory.length > 0)) && (
            <div className="pt-4 border-t border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-200 font-semibold text-xs">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Sejarah Bayaran &amp; Resit Klien ({workspace.paymentHistory?.length || 1})</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyReceipt(null)}
                  className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedReceipt === 'latest' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-stone-400" />
                      <span>Salin Mesej WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              {/* Records List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(workspace.paymentHistory || [lastPaymentDone!])
                  .slice()
                  .reverse()
                  .map((rec) => {
                    if (!rec) return null;
                    return (
                      <div
                        key={rec.paymentId}
                        className="p-3 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {rec.plan === 'MONTHLY' ? 'Pelan Bulanan (+30 Hari)' : 'Pelan Tahunan (+365 Hari)'}
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              RM{rec.amount}.00
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400 flex items-center gap-2">
                            <span>Bayar: {formatDate(rec.paidAt)}</span>
                            <span>•</span>
                            <span>Kaedah: {rec.paymentMethod}</span>
                            {rec.referenceNote && (
                              <>
                                <span>•</span>
                                <span className="text-stone-300 truncate max-w-[150px]">{rec.referenceNote}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyReceipt(rec)}
                          className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
                          title="Salin Resit WhatsApp"
                        >
                          {copiedReceipt === rec.paymentId ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
