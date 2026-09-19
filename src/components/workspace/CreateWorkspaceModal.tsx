/**
 * NiagaPOS V2 - Create Client Workspace Modal (SES v4.4)
 * Real client setup flow with:
 * - Workspace name, slug, owner name and email
 * - Custom trial duration (default 30 days)
 * - Firestore backend persistence & membership provisioning
 * - Generated client access URL: https://niagapos.syncrozz.com/{slug}
 * - Firebase Auth invite confirmation & copyable onboarding pack
 */

import React, { useState } from 'react';
import {
  Building2,
  Globe,
  Mail,
  User,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import { WorkspaceService } from '../../services/workspaceService';
import { isValidSlug } from '../../services/urlRouter';
import type { ClientAccessDetails } from '../../types/workspace';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (details: ClientAccessDetails) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [trialDays, setTrialDays] = useState(30);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDetails, setCreatedDetails] = useState<ClientAccessDetails | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  if (!isOpen) return null;

  // Auto-slugify name if user hasn't manually edited slug
  const handleNameChange = (val: string) => {
    setWorkspaceName(val);
    const slugified = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    setWorkspaceSlug(slugified);
  };

  const handleSlugChange = (val: string) => {
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 32);
    setWorkspaceSlug(sanitized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = workspaceName.trim();
    const cleanSlug = workspaceSlug.trim().toLowerCase();
    const cleanOwnerName = ownerName.trim();
    const cleanOwnerEmail = ownerEmail.trim().toLowerCase();

    if (!cleanName || !cleanSlug || !cleanOwnerName || !cleanOwnerEmail) {
      setError('Sila lengkapkan semua maklumat pendaftaran.');
      return;
    }

    if (!isValidSlug(cleanSlug)) {
      setError('Slug tidak sah atau merupakan laluan sistem terlindung (cth: admin, pos, login). Gunakan 3-32 aksara alfanumerik.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanOwnerEmail)) {
      setError('Format emel pemilik tidak sah.');
      return;
    }

    setLoading(true);
    try {
      const res = await WorkspaceService.createClientWorkspace({
        workspaceName: cleanName,
        workspaceSlug: cleanSlug,
        ownerName: cleanOwnerName,
        ownerEmail: cleanOwnerEmail,
        trialDurationDays: trialDays,
      });

      if (!res.success || !res.details) {
        setError(res.error || 'Gagal mendaftar workspace.');
        setLoading(false);
        return;
      }

      setCreatedDetails(res.details);
      onSuccess(res.details);
    } catch (err: any) {
      setError(err.message || 'Ralat tidak dijangka berlaku.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'invite') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleClose = () => {
    setWorkspaceName('');
    setWorkspaceSlug('');
    setOwnerName('');
    setOwnerEmail('');
    setTrialDays(30);
    setError(null);
    setCreatedDetails(null);
    onClose();
  };

  return (
    <div
      id="create-workspace-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-stone-900 border border-stone-800 text-stone-100 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                {createdDetails ? 'Workspace Berjaya Didaftarkan' : 'Daftar Workspace Klien Baharu'}
              </h3>
              <p className="text-[11px] text-stone-400">
                {createdDetails ? 'Pautan akses & jemputan pemilik sedia untuk dihantar' : 'NiagaPOS Multi-Client Architecture (SES v4.4)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Ralat Pendaftaran:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {createdDetails ? (
            // Success & Invitation View
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white text-sm">Pendaftaran Klien Selesai</div>
                  <div className="text-[11px] text-emerald-300/90 mt-0.5">
                    Workspace <span className="font-semibold text-white">{createdDetails.workspace.workspaceName}</span> telah didaftarkan dengan ID <code className="bg-stone-800 px-1 py-0.5 rounded text-stone-300">{createdDetails.workspace.workspaceId}</code>.
                  </div>
                </div>
              </div>

              {/* URL Access Box */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                  Pautan Rasmi Akses Klien (Client Access URL)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-stone-900 border border-stone-800 px-3 py-2 rounded-lg text-xs font-mono text-emerald-400 truncate select-all">
                    {createdDetails.accessUrl}
                  </div>
                  <button
                    id="copy-client-url-btn"
                    onClick={() => copyToClipboard(createdDetails.accessUrl, 'url')}
                    className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/${createdDetails.workspace.workspaceSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors shrink-0"
                    title="Buka Pautan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Owner Invitation Card */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    Maklumat Jemputan Pemilik (Firebase Auth)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    OWNER ROLE ASSIGNED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800/80">
                    <span className="text-stone-500 text-[10px] block">Nama Pemilik</span>
                    <span className="font-medium text-white">{createdDetails.workspace.ownerName}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800/80">
                    <span className="text-stone-500 text-[10px] block">Emel Pemilik</span>
                    <span className="font-medium text-white">{createdDetails.workspace.ownerEmail}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800/80">
                    <span className="text-stone-500 text-[10px] block">Tempoh Percubaan</span>
                    <span className="font-medium text-white">{createdDetails.workspace.trialDurationDays} Hari</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800/80">
                    <span className="text-stone-500 text-[10px] block">Tarikh Tamat Percubaan</span>
                    <span className="font-medium text-white">
                      {new Date(createdDetails.workspace.trialExpiresAt).toLocaleDateString('ms-MY')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-emerald-400 text-[10px] block font-semibold">PIN Keselamatan Klien (Lalai)</span>
                      <span className="font-mono font-bold text-white text-sm tracking-wider">1234</span>
                    </div>
                    <span className="text-[10px] text-emerald-300/80">Klien dinasihatkan menukar PIN semasa persediaan</span>
                  </div>
                </div>

                {/* Onboarding Pack Copy */}
                <div className="pt-1">
                  <button
                    id="copy-invite-pack-btn"
                    onClick={() => {
                      const pack = `Salam ${createdDetails.workspace.ownerName},\n\nAkaun NiagaPOS V2 untuk "${createdDetails.workspace.workspaceName}" telah berjaya didaftarkan!\n\nPautan Akses Rasmi:\n${createdDetails.accessUrl}\n\nPIN Lalai Klien: 1234\n(Sila tukar PIN ini dalam menu Tetapan selepas log masuk pertama)\n\nEmel Log Masuk: ${createdDetails.workspace.ownerEmail}\nPeranan: OWNER (Pemilik)\nTempoh Percubaan: ${createdDetails.workspace.trialDurationDays} Hari\n\nSila layari pautan di atas untuk log masuk dan mulakan pengurusan inventori & jualan kedai anda.`;
                      copyToClipboard(pack, 'invite');
                    }}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                  >
                    {copiedInvite ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Mesej Jemputan Disalin ke Papan Keratan!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Salin Mesej Jemputan Lengkap (WhatsApp / Emel)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Registration Form View
            <form id="create-workspace-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Workspace Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nama Perniagaan / Kedai Klien</span>
                </label>
                <input
                  id="ws-name-input"
                  type="text"
                  required
                  placeholder="Cth: Kedai Runcit Makmur, Restoran Al-Barakah"
                  value={workspaceName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 outline-none transition-all"
                />
              </div>

              {/* Workspace Slug */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>URL Slug (Pengecam Unik)</span>
                  </label>
                  <span className="text-[10px] text-stone-500 font-mono">
                    https://niagapos.syncrozz.com/{workspaceSlug || '{slug}'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="bg-stone-800/80 border border-r-0 border-stone-800 px-3 py-2.5 rounded-l-xl text-stone-400 text-xs font-mono select-none">
                    /
                  </span>
                  <input
                    id="ws-slug-input"
                    type="text"
                    required
                    placeholder="kedai-makmur"
                    value={workspaceSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-r-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-stone-600 outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-stone-500">
                  Hanya huruf kecil, nombor, dan sengkang (-). Laluan sistem terhad (admin, pos, login) dihalang secara automatik.
                </p>
              </div>

              {/* Owner Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Owner Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Nama Penuh Pemilik</span>
                  </label>
                  <input
                    id="ws-owner-name-input"
                    type="text"
                    required
                    placeholder="Cth: Encik Khairi"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 outline-none transition-all"
                  />
                </div>

                {/* Owner Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Emel Log Masuk Pemilik</span>
                  </label>
                  <input
                    id="ws-owner-email-input"
                    type="email"
                    required
                    placeholder="pemilik@perniagaan.com"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Trial Duration */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tempoh Percubaan (Hari)</span>
                </label>
                <div className="flex items-center gap-2">
                  {[14, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrialDays(days)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
                        trialDays === days
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {days} Hari
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500">
                  Termasuk tempoh tangguh tambahan 7 hari sebelum sekatan keras dikuatkuasakan mengikut SES v4.4.
                </p>
              </div>

              {/* Security Isolation Notice */}
              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 text-[11px] text-stone-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Workspace baharu akan dicipta dengan pengasingan data 100%, pangkalan data berasingan, dan peranan <strong className="text-stone-200">OWNER</strong> disahkan. Tiada percampuran dengan data NiagaPOS V1.
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/40 flex items-center justify-end gap-2.5">
          {createdDetails ? (
            <button
              id="ws-done-btn"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold transition-colors"
            >
              Tutup
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-workspace-form"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftar di Firestore...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Daftar &amp; Jana Pautan Akses</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
