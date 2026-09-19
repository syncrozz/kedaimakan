import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Store,
  UserCheck,
  Shield,
  Layers,
  RotateCcw,
  CheckCircle2,
  Info,
  Users,
  Award,
  Plus,
  Edit2,
  X,
  AlertTriangle,
  Download,
  Upload,
  UploadCloud,
  Database,
  HardDrive,
  FileCheck,
  Cloud,
  CloudOff,
  RefreshCw,
  Smartphone,
  Laptop,
  Building2,
  ExternalLink,
  KeyRound,
  Lock,
  ChefHat,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { UserRole, StaffRole, StaffUser } from '../types';
import { VerificationAuditSuite } from '../components/verification/VerificationAuditSuite';
import { NIAGAPOS_ASSETS } from '../constants/branding';
import { PWAInstallButton } from '../components/common/PWAInstallButton';
import { StaffService } from '../services/staffService';
import { StorageService, StoreBackupPayload } from '../services/storageService';
import { pushRoute, parseRoute } from '../services/urlRouter';
import { ClientAuthService } from '../services/clientAuthService';
import { ChangePinModal } from '../components/auth/ChangePinModal';
import { ChangeKitchenPinModal } from '../components/auth/ChangeKitchenPinModal';
import { KitchenAuthService } from '../services/kitchenAuthService';
import { CsvService } from '../services/csvService';
import { EntityCsvImportModal } from '../components/common/EntityCsvImportModal';

export const SettingsPage: React.FC = () => {
  const {
    store,
    currentUser,
    updateStoreDetails,
    resetToDemo,
    staffUsers,
    addStaff,
    updateStaff,
    toggleStaffActive,
    commitStaffUpsertImport,
    products,
    movements,
    sales,
    suppliers,
    purchases,
    customers,
    loyaltyLedger,
    downloadBackup,
    restoreStoreData,
    clearAllStoreData,
    cloudSyncStatus,
    lastCloudSync,
    syncAllToCloud,
    pullAllFromCloud,
    isAdminMode,
    requireAdmin,
  } = useStore();

  const [isResetting, setIsResetting] = useState(false);

  // Cloud Sync Feedback
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMsg(null);
    try {
      await pullAllFromCloud();
      await syncAllToCloud();
      setCloudSyncMsg('Data berjaya diselaraskan sepenuhnya secara 2-hala dengan Firebase Firestore!');
      setTimeout(() => setCloudSyncMsg(null), 4000);
    } catch {
      setCloudSyncMsg('Gagal menyegerakkan data ke Cloud. Sila periksa sambungan internet.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMsg(null);
    try {
      const ok = await pullAllFromCloud();
      if (ok) {
        setCloudSyncMsg('Data terkini berjaya dimuat turun daripada Cloud Firestore!');
      } else {
        setCloudSyncMsg('Tiada data baharu atau ralat semasa memuat turun data.');
      }
      setTimeout(() => setCloudSyncMsg(null), 4000);
    } catch {
      setCloudSyncMsg('Gagal memuat turun data daripada Cloud.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Store Profile State
  const [storeName, setStoreName] = useState(store.name);
  const [storeCode, setStoreCode] = useState(store.code);
  const [currency, setCurrency] = useState(store.currency);
  const [address, setAddress] = useState(store.address || '');
  const [phone, setPhone] = useState(store.phone || '');
  const [tagline, setTagline] = useState(store.tagline || '');
  const [receiptFooter, setReceiptFooter] = useState(store.receiptFooter || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Module Settings State
  const [enableCustomers, setEnableCustomers] = useState(store.settings?.enableCustomers !== false);
  const [enableLoyalty, setEnableLoyalty] = useState(store.settings?.enableLoyalty !== false);
  const [loyaltyPointsPerCurrency, setLoyaltyPointsPerCurrency] = useState(store.settings?.loyaltyPointsPerCurrency || 1);
  const [enableStaff, setEnableStaff] = useState(store.settings?.enableStaff !== false);
  const [defaultCashierId, setDefaultCashierId] = useState(store.settings?.defaultCashierId || 'store-owner');
  const [moduleSettingsSuccess, setModuleSettingsSuccess] = useState(false);

  // Backup & Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoreConfirmPayload, setRestoreConfirmPayload] = useState<StoreBackupPayload | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isStaffImportModalOpen, setIsStaffImportModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [staffFormCode, setStaffFormCode] = useState('');
  const [staffFormName, setStaffFormName] = useState('');
  const [staffFormRole, setStaffFormRole] = useState<StaffRole>('CASHIER');
  const [staffFormActive, setStaffFormActive] = useState(true);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);

  // Client Workspace PIN & Auth State
  const [activeSession, setActiveSession] = useState(() => ClientAuthService.getActiveSession());
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  // Kitchen PIN Security State (Fasa 3 — SES v4.5)
  const [isChangeKitchenPinOpen, setIsChangeKitchenPinOpen] = useState(false);
  const [kitchenPinStatus, setKitchenPinStatus] = useState<{ isDefaultPin: boolean; hasCustomPin: boolean } | null>(null);
  const [kitchenPinSuccessMsg, setKitchenPinSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ClientAuthService.subscribe((sess) => {
      setActiveSession(sess);
    });
    return unsub;
  }, []);

  const routeInfo = parseRoute(typeof window !== 'undefined' ? window.location.pathname : '');
  const activeWorkspaceSlug = activeSession?.workspaceSlug || routeInfo.workspaceSlug || 'demo';

  useEffect(() => {
    KitchenAuthService.getStatus(activeWorkspaceSlug)
      .then((st) => setKitchenPinStatus({ isDefaultPin: st.isDefaultPin, hasCustomPin: st.hasCustomPin }))
      .catch(() => {});
  }, [activeWorkspaceSlug]);

  // Keyboard Escape listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (restoreConfirmPayload) {
          setRestoreConfirmPayload(null);
        } else if (isResetModalOpen) {
          setIsResetModalOpen(false);
        } else if (isStaffModalOpen) {
          setIsStaffModalOpen(false);
          setEditingStaff(null);
        }
      }
    };
    if (isStaffModalOpen || restoreConfirmPayload || isResetModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStaffModalOpen, restoreConfirmPayload, isResetModalOpen]);

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    requireAdmin(() => {
      updateStoreDetails({
        name: storeName.trim(),
        code: storeCode.trim(),
        currency: currency.trim(),
        address: address.trim(),
        phone: phone.trim(),
        tagline: tagline.trim(),
        receiptFooter: receiptFooter.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 'Kemaskini Maklumat Kedai');
  };

  const handleSaveModules = (e: React.FormEvent) => {
    e.preventDefault();
    requireAdmin(() => {
      updateStoreDetails({
        settings: {
          ...store.settings,
          enableCustomers,
          enableLoyalty,
          loyaltyPointsPerCurrency: Math.max(1, loyaltyPointsPerCurrency),
          enableStaff,
          defaultCashierId: defaultCashierId || 'store-owner',
        },
      });
      setModuleSettingsSuccess(true);
      setTimeout(() => setModuleSettingsSuccess(false), 3000);
    }, 'Ubah Tetapan Modul');
  };

  const handleDownloadBackup = () => {
    try {
      downloadBackup();
      setBackupMessage({
        type: 'success',
        text: `Authoritative backup generated & downloaded successfully (${products.length} products, ${sales.length} sales).`,
      });
      setTimeout(() => setBackupMessage(null), 5000);
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: `Failed to download backup: ${err.message}` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = StorageService.validateBackupPayload(parsed);

        if (!validation.isValid || !validation.data) {
          setBackupMessage({
            type: 'error',
            text: `Invalid backup file: ${validation.error || 'Verification failed.'}`,
          });
          return;
        }

        setRestoreConfirmPayload(validation.data);
        setBackupMessage(null);
      } catch (err: any) {
        setBackupMessage({
          type: 'error',
          text: `Corrupted JSON file: ${err.message}`,
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!restoreConfirmPayload) return;
    requireAdmin(() => {
      const result = restoreStoreData(restoreConfirmPayload);
      if (result.success) {
        setBackupMessage({
          type: 'success',
          text: `Store successfully restored from backup (${restoreConfirmPayload.products.length} products, ${restoreConfirmPayload.sales.length} sales restored).`,
        });
        setRestoreConfirmPayload(null);
        setTimeout(() => setBackupMessage(null), 6000);
      } else {
        setBackupMessage({
          type: 'error',
          text: `Restore error: ${result.message}`,
        });
      }
    }, 'Pulihkan Data Kedai');
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const result = await clearAllStoreData();
      setIsResetModalOpen(false);
      setBackupMessage({
        type: 'success',
        text: result.message,
      });
      setTimeout(() => setBackupMessage(null), 6000);
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: `Gagal memadamkan data: ${err?.message || 'Ralat tidak diketahui'}`,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenAddStaff = () => {
    requireAdmin(() => {
      setStaffFormCode(StaffService.generateNextStaffCode(staffUsers));
      setStaffFormName('');
      setStaffFormRole('CASHIER');
      setStaffFormActive(true);
      setStaffFormError(null);
      setEditingStaff(null);
      setIsStaffModalOpen(true);
    }, 'Daftar Staf Baru');
  };

  const handleOpenEditStaff = (staff: StaffUser) => {
    requireAdmin(() => {
      setEditingStaff(staff);
      setStaffFormCode(staff.staffCode);
      setStaffFormName(staff.name);
      setStaffFormRole(staff.role);
      setStaffFormActive(staff.active);
      setStaffFormError(null);
      setIsStaffModalOpen(true);
    }, `Kemaskini Maklumat Staf ${staff.name}`);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);

    try {
      if (editingStaff) {
        updateStaff(editingStaff.id, {
          name: staffFormName.trim(),
          role: staffFormRole,
          active: staffFormActive,
        });
      } else {
        addStaff({
          staffCode: staffFormCode.trim(),
          name: staffFormName.trim(),
          role: staffFormRole,
          active: staffFormActive,
        });
      }
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    } catch (err: any) {
      setStaffFormError(err.message || 'Validation error.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Store & System Settings
        </h1>
        <p className="text-sm text-stone-500">
          Configure store profile parameters, optional retail modules, staff directory, and system verification.
        </p>
      </div>

      {/* PWA & System Installation Card */}
      <PWAInstallButton variant="card" />

      {/* Store Profile Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-stone-900">
              Retail Store Profile
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            Active Store
          </span>
        </div>

        <form onSubmit={handleSaveStore} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Store Code (Identifier)
              </label>
              <input
                type="text"
                required
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Operating Currency Symbol
              </label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-stone-400 mt-0.5 block">
                Default: RM (Malaysian Ringgit)
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Store Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Kedai Mesra Komuniti"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Receipt Footer Message
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. Terima kasih, sila datang lagi!"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Store Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Store profile updated successfully</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition shadow-xs"
            >
              Save Store Profile
            </button>
          </div>
        </form>
      </div>

      {/* Optional Retail Modules Settings (Part 07) */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-emerald-700" />
          <h2 className="text-base font-bold text-stone-900">
            Optional Retail Modules (Part 07)
          </h2>
        </div>
        <p className="text-xs text-stone-500 mb-5">
          Enable or disable optional retail extensions. The core inventory and POS checkout logic remains 100% stable regardless of which optional modules are toggled.
        </p>

        <form onSubmit={handleSaveModules} className="space-y-4">
          <div className="space-y-3">
            {/* Customer Management */}
            <div className="p-4 rounded-xl border border-stone-200 flex items-start justify-between gap-4 bg-stone-50/60">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-stone-900">Customer Management</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Enables customer directory, member profile lookup at POS register, and lifetime purchase history.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableCustomers}
                  onChange={(e) => setEnableCustomers(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
              </label>
            </div>

            {/* Loyalty & Rewards */}
            <div className="p-4 rounded-xl border border-stone-200 flex items-start justify-between gap-4 bg-stone-50/60">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 mt-0.5">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-stone-900">Loyalty Points & Rewards</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Accumulate points on completed checkout and track balances using immutable ledger audit trails.
                  </div>
                  {enableLoyalty && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-stone-600 font-medium">Award Ratio:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={loyaltyPointsPerCurrency}
                        onChange={(e) => setLoyaltyPointsPerCurrency(Number(e.target.value))}
                        className="w-16 px-2 py-0.5 border border-stone-300 rounded font-mono text-center text-xs"
                      />
                      <span className="text-stone-500 text-[11px]">pt(s) per {store.currency} 1.00 spent</span>
                    </div>
                  )}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableLoyalty}
                  onChange={(e) => setEnableLoyalty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
              </label>
            </div>

            {/* Staff Attribution */}
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-800 mt-0.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-stone-900">Staff & Cashier Attribution</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Allow selecting active cashier at checkout and snapshots cashier name directly on receipts.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={enableStaff}
                    onChange={(e) => setEnableStaff(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
                </label>
              </div>

              {enableStaff && (
                <div className="pt-3 border-t border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label htmlFor="setting-default-cashier-select" className="text-xs font-semibold text-stone-800 block">
                      Default Cashier
                    </label>
                    <div className="text-[11px] text-stone-500">
                      Jurutera/kakitangan lalai semasa membuka POS jika tidak diubah. (Lalai: Store Owner)
                    </div>
                  </div>
                  <select
                    id="setting-default-cashier-select"
                    value={defaultCashierId}
                    onChange={(e) => setDefaultCashierId(e.target.value)}
                    className="text-xs font-semibold text-stone-800 bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-600 focus:outline-none cursor-pointer shrink-0"
                  >
                    <option value="store-owner">Store Owner (Default)</option>
                    {staffUsers
                      .filter((s) => s.active && s.role === 'CASHIER')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staffCode || s.userCode})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {moduleSettingsSuccess ? (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Module settings updated successfully</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition shadow-xs"
            >
              Update Module Settings
            </button>
          </div>
        </form>
      </div>

      {/* Staff Directory & Management Card (Part 07) */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-stone-900">
              Staff Directory ({staffUsers.length})
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="export-staff-csv-btn"
              onClick={() => CsvService.exportStaff(staffUsers)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
              title="Eksport senarai pekerja ke fail CSV"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              id="import-staff-csv-btn"
              onClick={() => setIsStaffImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
              title="Import senarai pekerja dari fail CSV"
            >
              <UploadCloud className="w-3.5 h-3.5 text-stone-600" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddStaff}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff User</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Manage cashier and staff credentials for register attribution and inventory movements.
        </p>

        <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden text-xs">
          {staffUsers.map((staff) => (
            <div key={staff.id} className="p-3 flex items-center justify-between bg-white hover:bg-stone-50/70 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-700 text-xs">
                  {staff.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">{staff.name}</span>
                    <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                      {staff.staffCode}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-stone-100 text-stone-700">
                      {staff.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => requireAdmin(() => toggleStaffActive(staff.id), `Tukar Status Staf ${staff.name}`)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                    staff.active
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border border-stone-200'
                  }`}
                >
                  {staff.active ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditStaff(staff)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 cursor-pointer"
                  title="Edit staff details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-stone-900 text-sm">
                  {editingStaff ? 'Edit Staff Profile' : 'Add Staff User'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-4 space-y-3.5 text-xs">
              {staffFormError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{staffFormError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Staff Code
                </label>
                <input
                  type="text"
                  value={staffFormCode}
                  onChange={(e) => setStaffFormCode(e.target.value.toUpperCase())}
                  disabled={!!editingStaff}
                  className="w-full px-3 py-1.5 font-mono rounded-lg border border-stone-300 focus:outline-none disabled:bg-stone-100"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={staffFormName}
                  onChange={(e) => setStaffFormName(e.target.value)}
                  placeholder="e.g. Siti Sarah"
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  System Role
                </label>
                <select
                  value={staffFormRole}
                  onChange={(e) => setStaffFormRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-none"
                >
                  <option value="CASHIER">CASHIER (Point of sale register)</option>
                  <option value="INVENTORY_STAFF">INVENTORY_STAFF (Stock In & Movements)</option>
                  <option value="MANAGER">MANAGER (Operations & Approvals)</option>
                  <option value="OWNER">OWNER (Full administrative access)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffFormActive}
                    onChange={(e) => setStaffFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span className="text-stone-700 font-medium">Active staff user</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white font-semibold hover:bg-emerald-900 shadow-xs"
                >
                  {editingStaff ? 'Save Changes' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Device Real-Time Cloud Sync (Firebase Firestore) */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-700" />
              <h3 className="font-bold text-sm text-stone-900">
                Penyegerakan Cloud Masa Nyata (Multi-Device Cloud Sync)
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  cloudSyncStatus === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : cloudSyncStatus === 'SYNCING'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-stone-100 text-stone-600 border-stone-200'
                }`}
              >
                {cloudSyncStatus === 'CONNECTED' ? '● Aktif (Connected)' : cloudSyncStatus === 'SYNCING' ? 'Menyegerak...' : 'Luar Talian'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1 max-w-2xl">
              Data kedai (Produk, Jualan POS, Stok Inventori, Pelanggan, Pembekal, dan Staf) disegerakkan secara langsung menggunakan <strong>Google Firebase Firestore</strong>. Sebarang transaksi atau kemas kini di mana-mana peranti (telefon pintar, tablet, atau komputer juruwang) akan dikemas kini secara automatik dalam beberapa milisaat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="settings-pull-cloud-btn"
              onClick={handlePullFromCloud}
              disabled={isCloudSyncing}
              title="Muat turun data terkini daripada cloud (sesuai untuk telefon/tablet mendapatkan data dari desktop)"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Tarik Data Terkini (Pull)</span>
            </button>

            <button
              type="button"
              id="settings-sync-all-btn"
              onClick={handleManualCloudSync}
              disabled={isCloudSyncing}
              title="Segerakkan kedua-dua hala (tarik data terkini dan tolak perubahan tempatan ke Cloud)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>{isCloudSyncing ? 'Sedang Menyegerak...' : 'Segerak 2-Hala'}</span>
            </button>
          </div>
        </div>

        {/* Sync message if any */}
        {cloudSyncMsg && (
          <div
            className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
              cloudSyncMsg.includes('berjaya')
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cloudSyncMsg}</span>
          </div>
        )}

        {/* Device Sync Matrix & Counters */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="text-[11px] text-stone-500 font-medium">Status Sambungan</div>
            <div className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Firebase Aktif
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="text-[11px] text-stone-500 font-medium">Katalog Produk</div>
            <div className="text-sm font-bold text-stone-900 mt-0.5">
              {products.length} Item ({products.filter((p) => p.active).length} Aktif di POS)
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="text-[11px] text-stone-500 font-medium">Transaksi Jualan</div>
            <div className="text-sm font-bold text-stone-900 mt-0.5">
              {sales.length} Resit Jualan
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="text-[11px] text-stone-500 font-medium">Penyegerakan Terakhir</div>
            <div className="text-sm font-semibold text-stone-700 mt-0.5">
              {lastCloudSync ? lastCloudSync.toLocaleTimeString() : 'Baru sahaja'}
            </div>
          </div>
        </div>

        {/* Multi-Device Support Info Box */}
        <div className="mt-4 p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-start gap-3">
          <div className="flex items-center gap-1 text-emerald-800 shrink-0 mt-0.5">
            <Smartphone className="w-4 h-4" />
            <Laptop className="w-4 h-4" />
          </div>
          <div className="text-xs text-stone-700 space-y-1">
            <p className="font-semibold text-stone-900">
              Bagaimana data disegerakkan antara peranti?
            </p>
            <p className="text-stone-600">
              Buka aplikasi ini pada peranti lain (contohnya tablet juruwang, telefon pengurus kedai, atau komputer stok). Semua peranti mendengar perubahan secara masa nyata (<em>real-time Firestore listeners</em>). Apabila juruwang membuat jualan di kaunter, baki stok dan rekod jualan akan terus dikemas kini di telefon pengurus tanpa perlu menekan butang <em>refresh</em>.
            </p>
          </div>
        </div>
      </div>

      {/* Disaster Recovery & Data Backup Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-800" />
              <h3 className="font-bold text-sm text-stone-900">
                Store Data Backup &amp; Disaster Recovery
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Schema v1 · LocalStorage
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Export an authoritative JSON snapshot of your entire retail database (products, sales history, inventory ledger, supplier records, and audit logs). Restore anytime to recover from hardware failure or data corruption.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Backup</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />
          </div>
        </div>

        {/* Status / Alert Banner */}
        {backupMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              backupMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {backupMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{backupMessage.text}</span>
          </div>
        )}

        {/* Database Inventory Matrix */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Products</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{products.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Movements</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{movements.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Sales</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{sales.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Purchases</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{purchases.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Suppliers</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{suppliers.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80">
            <span className="text-stone-500 block text-[11px]">Customers</span>
            <span className="font-bold text-stone-900 font-mono text-sm">{customers.length}</span>
          </div>
        </div>
      </div>

      {/* Konsol Klien & Master Admin Access Card */}
      <div className="bg-stone-900 rounded-xl border border-stone-800 p-6 shadow-sm text-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">
                Konsol Klien NiagaPOS (Master Admin)
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                SES v4.4 Multi-Client
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1 max-w-xl leading-relaxed">
              Urus pendaftaran klien baharu, pengagihan workspace, pemantauan status percubaan kedai (Active / Trial Ending / Expired), dan jemputan onboarding pemilik kedai runcit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="settings-open-master-admin-btn"
            onClick={() => {
              pushRoute('/admin');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>Buka Konsol Klien</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>

      {/* Client Workspace PIN Security Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-stone-900">
                Keselamatan &amp; PIN Akses Workspace
              </h2>
              {activeSession?.isDefaultPin ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  PIN Lalai (1234)
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PIN Terselamat
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Setiap workspace klien dilindungi dengan 4-digit PIN keselamatan bebas. PIN dienkripsi dengan selamat (PBKDF2) dan diasingkan sepenuhnya daripada Master Admin.
            </p>
          </div>

          <button
            type="button"
            id="settings-change-pin-btn"
            onClick={() => setIsChangePinOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Tukar PIN Workspace</span>
          </button>
        </div>

        {pinSuccessMsg && (
          <div className="mt-4 p-3 rounded-lg text-xs bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pinSuccessMsg}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/70 space-y-1">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pengasingan Akses Multi-Tenant</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              PIN ini hanya sah untuk workspace <strong>/{activeWorkspaceSlug}</strong>. Master Admin PIN (5313) kekal eksklusif untuk platform admin dan tidak boleh digunakan untuk log masuk akaun klien.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/70 space-y-1">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Perlindungan Brute-Force</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Sistem mengehadkan maksimum 5 percubaan PIN salah. Sekatan sementara 30 saat dikuatkuasakan secara automatik di peringkat pelayan untuk menghalang sebarang serangan kata laluan.
            </p>
          </div>
        </div>
      </div>

      {/* Kitchen PIN & KDS Access Control Card (Fasa 3 — SES v4.5) */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-stone-900">
                Keselamatan PIN Akses Dapur (KDS)
              </h2>
              {kitchenPinStatus?.isDefaultPin ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>PIN Lalai (9999) — Perlu Ditukar</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>PIN Dapur Terselamat</span>
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Akses paparan Kitchen Display System (KDS) dikawal oleh PIN Dapur bebas. Staf dapur yang log masuk dengan peranan <strong>KITCHEN</strong> tidak boleh mengakses laporan jualan, data kewangan, atau tetapan pemilik.
            </p>
          </div>

          <button
            type="button"
            id="settings-change-kitchen-pin-btn"
            onClick={() => setIsChangeKitchenPinOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            <KeyRound className="w-4 h-4 text-stone-950" />
            <span>Tukar PIN Dapur</span>
          </button>
        </div>

        {kitchenPinSuccessMsg && (
          <div className="mt-4 p-3 rounded-lg text-xs bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{kitchenPinSuccessMsg}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/70 space-y-1">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Privasi Operasi &amp; Sekatan Peranan</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Peranan <strong>KITCHEN</strong> hanya dibenarkan melihat tiket pesanan dapur (KOT) dan mengemas kini status masakan (Baru &rarr; Sedang Masak &rarr; Siap). Semua endpoint kewangan dan inventori disekat di peringkat pelayan.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/70 space-y-1">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Kadar Percubaan &amp; Kunci Server-Side</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Sekiranya berlaku 5 kali cubaan salah pada PIN Dapur, sistem mengunci akses selama 30 saat untuk mencegah serangan brute-force.
            </p>
          </div>
        </div>
      </div>

      {/* Regression & Verification Testing Suite */}
      <VerificationAuditSuite />

      {/* Data Integrity & Zero Reset Box */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-stone-900">
              Pembersihan Data &amp; Mula Dari Kosong (Fresh Store Reset)
            </h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              Bermula Dari Sifar
            </span>
          </div>
          <p className="text-xs text-stone-500 max-w-md mt-1 leading-relaxed">
            Padamkan semua item katalog demo lama (seperti Beras Wangi Cap Rambutan dll), rekod pembekal, pelanggan, dan transaksi untuk membolehkan Klien / Pengguna bermula dari kosong sepenuhnya.
          </p>
        </div>

        <button
          type="button"
          id="btn-purge-all-zero"
          onClick={() => requireAdmin(() => setIsResetModalOpen(true), 'Kosongkan Semua Data Kedai') }
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 transition cursor-pointer shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          <span>Kosongkan Semua &amp; Mula Dari Kosong</span>
        </button>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreConfirmPayload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-stone-900">Confirm Store Data Restore</h3>
            </div>
            <p className="text-xs text-stone-600 mb-4">
              You are about to overwrite your active store records with the backup file from{' '}
              <span className="font-semibold text-stone-800">
                {new Date(restoreConfirmPayload.exportedAt).toLocaleString()}
              </span>
              . Current unsaved edits will be replaced.
            </p>

            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs mb-4 space-y-1">
              <div><strong className="text-stone-700">Store Name:</strong> {restoreConfirmPayload.store.name} ({restoreConfirmPayload.store.code})</div>
              <div><strong className="text-stone-700">Schema Version:</strong> v{restoreConfirmPayload.schemaVersion}</div>
              <div><strong className="text-stone-700">Products:</strong> {restoreConfirmPayload.products.length} records</div>
              <div><strong className="text-stone-700">Sales Transactions:</strong> {restoreConfirmPayload.sales.length} records</div>
              <div><strong className="text-stone-700">Stock Movements:</strong> {restoreConfirmPayload.movements.length} records</div>
              <div><strong className="text-stone-700">Purchases:</strong> {restoreConfirmPayload.purchases.length} records</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmPayload(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center gap-2 mb-3 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-stone-900">Kosongkan Semua Data Kedai?</h3>
            </div>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Tindakan ini akan memadamkan secara kekal semua item katalog, pembekal, pelanggan, dan transaksi daripada storan tempatan serta Cloud Firestore supaya anda boleh bermula dengan kedai yang bersih (0 rekod).
            </p>

            <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200 text-xs mb-4 space-y-1.5">
              <div className="font-semibold text-stone-700 mb-1">Data yang akan dibersihkan:</div>
              <div className="flex justify-between text-stone-600">
                <span>Produk:</span>
                <span className="font-mono font-bold text-stone-900">{products.length} rekod</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Pembekal:</span>
                <span className="font-mono font-bold text-stone-900">{suppliers.length} rekod</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Pelanggan:</span>
                <span className="font-mono font-bold text-stone-900">{customers.length} rekod</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Transaksi Jualan:</span>
                <span className="font-mono font-bold text-stone-900">{sales.length} rekod</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Pergerakan Stok:</span>
                <span className="font-mono font-bold text-stone-900">{movements.length} rekod</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-purge-zero"
                disabled={isResetting}
                onClick={handleConfirmReset}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-700 text-white hover:bg-rose-800 shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isResetting ? (
                  <span>Sedang Memadamkan...</span>
                ) : (
                  <span>Sahkan &amp; Padam Semua</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Workspace PIN Modal */}
      <ChangePinModal
        isOpen={isChangePinOpen}
        workspaceSlug={activeWorkspaceSlug}
        onClose={() => setIsChangePinOpen(false)}
        onSuccess={(msg) => {
          setPinSuccessMsg(msg);
          setTimeout(() => setPinSuccessMsg(null), 6000);
        }}
      />

      {/* Change Kitchen PIN Modal (Fasa 3 — SES v4.5) */}
      <ChangeKitchenPinModal
        isOpen={isChangeKitchenPinOpen}
        workspaceSlug={activeWorkspaceSlug}
        onClose={() => setIsChangeKitchenPinOpen(false)}
        onSuccess={(msg) => {
          setKitchenPinSuccessMsg(msg || 'PIN Dapur berjaya dikemas kini!');
          setKitchenPinStatus({ isDefaultPin: false, hasCustomPin: true });
          setTimeout(() => setKitchenPinSuccessMsg(null), 6000);
        }}
      />

      {/* Staff CSV Import Modal */}
      <EntityCsvImportModal
        id="staff-csv-import-modal"
        isOpen={isStaffImportModalOpen}
        onClose={() => setIsStaffImportModalOpen(false)}
        entityName="Pekerja"
        entityType="STAFF"
        onDownloadTemplate={() => CsvService.downloadStaffCsvTemplate()}
        onValidate={(rows) => CsvService.validateStaffUpsert(rows, staffUsers)}
        onCommit={(res) => commitStaffUpsertImport(res)}
      />
    </div>
  );
};

