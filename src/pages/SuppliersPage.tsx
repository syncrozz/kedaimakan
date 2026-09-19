/**
 * NiagaPOS - Suppliers Management Page
 * Part 05: Purchasing + Supplier Management
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Eye,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  Receipt,
  X,
  Download,
  UploadCloud,
  SearchCheck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Supplier, Purchase } from '../types';
import { formatCurrency, formatDateTime } from '../services/formatters';
import { PurchasingService } from '../services/purchasingService';
import { SupplierService } from '../services/supplierService';
import { CsvService } from '../services/csvService';
import { DuplicateAuditService } from '../services/duplicateAuditService';
import { SmartInputService } from '../services/smartInputService';
import { DuplicateAuditModal } from '../components/common/DuplicateAuditModal';
import { EntityCsvImportModal } from '../components/common/EntityCsvImportModal';

export const SuppliersPage: React.FC = () => {
  const {
    store,
    suppliers,
    purchases,
    addSupplier,
    updateSupplier,
    toggleSupplierActive,
    deleteSupplier,
    commitSuppliersUpsertImport,
    isAdminMode,
    requireAdmin,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState<Supplier | null>(null);
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);

  // Duplicate audit groups (SES 4.4 Locked Part E)
  const duplicateAuditGroups = useMemo(
    () => DuplicateAuditService.auditSuppliers(suppliers),
    [suppliers]
  );

  // Keyboard Escape listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedSupplierForDetail) {
          setSelectedSupplierForDetail(null);
        } else if (isAddModalOpen || editingSupplier) {
          setIsAddModalOpen(false);
          setEditingSupplier(null);
        }
      }
    };
    if (isAddModalOpen || editingSupplier || selectedSupplierForDetail) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddModalOpen, editingSupplier, selectedSupplierForDetail]);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter === 'ACTIVE' && !s.active) return false;
      if (statusFilter === 'INACTIVE' && s.active) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = s.supplierCode.toLowerCase().includes(q);
        const nameMatch = s.supplierName.toLowerCase().includes(q);
        const contactMatch = s.contactPerson?.toLowerCase().includes(q) || false;
        const phoneMatch = s.phone?.toLowerCase().includes(q) || false;
        if (!codeMatch && !nameMatch && !contactMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [suppliers, statusFilter, searchQuery]);

  // Overall metrics
  const activeCount = suppliers.filter((s) => s.active).length;
  const totalCompletedPurchases = purchases.filter((p) => p.status === 'COMPLETED').length;
  const totalPurchasingValue = purchases
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.total, 0);

  const openAddModal = () => {
    const nextCode = SupplierService.generateNextSupplierCode(suppliers);
    setFormCode(nextCode);
    setFormName('');
    setFormContact('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setFormActive(true);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormCode(supplier.supplierCode);
    setFormName(supplier.supplierName);
    setFormContact(supplier.contactPerson || '');
    setFormPhone(supplier.phone || '');
    setFormEmail(supplier.email || '');
    setFormAddress(supplier.address || '');
    setFormNotes(supplier.notes || '');
    setFormActive(supplier.active);
    setFormError(null);
  };

  const handleAddClick = () => {
    requireAdmin(openAddModal, 'Tambah Pembekal Baru');
  };

  const handleEditClick = (supplier: Supplier) => {
    requireAdmin(() => openEditModal(supplier), `Kemaskini Pembekal ${supplier.supplierName}`);
  };

  const handleToggleClick = (supplier: Supplier) => {
    requireAdmin(() => toggleSupplierActive(supplier.id), `Tukar Status Pembekal ${supplier.supplierName}`);
  };

  const handleDeleteClick = (supplier: Supplier) => {
    requireAdmin(() => handleDelete(supplier), `Padam Pembekal ${supplier.supplierName}`);
  };

  const handleExportCsvClick = () => {
    CsvService.exportSuppliers(filteredSuppliers);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Smart Form input normalization (SES 4.4 Locked Part B)
    const normName = SmartInputService.normalizeName(formName);
    const normCode = SmartInputService.normalizeCode(formCode);
    const normContact = SmartInputService.normalizeName(formContact);
    const normPhone = SmartInputService.normalizePhone(formPhone);

    if (!normName) {
      setFormError('Nama pembekal tidak boleh kosong.');
      return;
    }
    if (!normCode) {
      setFormError('Kod pembekal tidak boleh kosong.');
      return;
    }

    try {
      if (editingSupplier) {
        updateSupplier(editingSupplier.id, {
          supplierCode: normCode,
          supplierName: normName,
          contactPerson: normContact,
          phone: normPhone,
          email: formEmail.trim(),
          address: formAddress.trim(),
          notes: formNotes.trim(),
          active: formActive,
        });
        setEditingSupplier(null);
      } else {
        addSupplier({
          supplierCode: normCode,
          supplierName: normName,
          contactPerson: normContact,
          phone: normPhone,
          email: formEmail.trim(),
          address: formAddress.trim(),
          notes: formNotes.trim(),
        });
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save supplier.');
    }
  };

  const handleDelete = (supplier: Supplier) => {
    const result = deleteSupplier(supplier.id);
    if (!result.success) {
      setDeleteNotice(result.message);
    } else {
      setDeleteNotice(result.message);
    }
    setTimeout(() => setDeleteNotice(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Suppliers</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Part 05
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Manage vendors, purchasing sources, contact profiles, and procurement histories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicate Audit Button (SES 4.4 Locked Part E) */}
          <button
            type="button"
            id="audit-suppliers-btn"
            onClick={() => setIsDuplicateAuditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Semak pertindihan nama atau kod pembekal"
          >
            <SearchCheck className="w-4 h-4 text-stone-600" />
            <span>Audit Duplikasi</span>
            {duplicateAuditGroups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                {duplicateAuditGroups.length}
              </span>
            )}
          </button>

          {/* Export CSV Button (SES 4.4 Locked Part D) */}
          <button
            type="button"
            id="export-suppliers-csv-btn"
            onClick={handleExportCsvClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Eksport senarai pembekal semasa ke fail CSV"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV Button */}
          <button
            type="button"
            id="import-suppliers-csv-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs sm:text-sm font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Import senarai pembekal dari fail CSV"
          >
            <UploadCloud className="w-4 h-4 text-stone-600" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            id="btn-add-supplier"
            onClick={handleAddClick}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Notice Banner if delete redirected to deactivation */}
      {deleteNotice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Supplier Audit Protection</p>
            <p className="mt-0.5 text-amber-800">{deleteNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            className="text-amber-700 hover:text-amber-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Suppliers</span>
          <div className="text-2xl font-bold text-stone-900 mt-1">{suppliers.length}</div>
          <span className="text-xs text-stone-400 mt-1 block">Registered in catalog</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Active Suppliers</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</div>
          <span className="text-xs text-stone-400 mt-1 block">Available for purchasing</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Completed Purchases</span>
          <div className="text-2xl font-bold text-stone-900 mt-1">{totalCompletedPurchases}</div>
          <span className="text-xs text-stone-400 mt-1 block">Stock receipts processed</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Procurement Value</span>
          <div className="text-2xl font-bold text-stone-900 mt-1">{formatCurrency(totalPurchasingValue, store.currency)}</div>
          <span className="text-xs text-stone-400 mt-1 block">Received stock expenditure</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            id="supplier-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, name, or phone..."
            className="w-full pl-9.5 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                statusFilter === status
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center text-stone-500 px-4">
            <Building2 className="w-12 h-12 mx-auto text-stone-300 mb-3" />
            <p className="text-base font-medium text-stone-700">No suppliers found</p>
            <p className="text-xs text-stone-400 mt-1">
              {searchQuery ? 'Try adjusting your search criteria.' : 'Click "Add Supplier" to register your first vendor.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-stone-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Purchases</th>
                  <th className="py-3.5 px-4 text-right">Total Value</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filteredSuppliers.map((supplier) => {
                  const summary = PurchasingService.getSupplierPurchasingSummary(
                    supplier.id,
                    purchases
                  );

                  return (
                    <tr key={supplier.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-stone-700">
                        {supplier.supplierCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900">{supplier.supplierName}</div>
                        {supplier.address && (
                          <div className="text-xs text-stone-400 truncate max-w-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{supplier.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        {supplier.contactPerson && (
                          <div className="font-medium text-stone-800">{supplier.contactPerson}</div>
                        )}
                        {supplier.phone && (
                          <div className="text-stone-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        {!supplier.contactPerson && !supplier.phone && (
                          <span className="text-stone-300 italic">None provided</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            supplier.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          {supplier.active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-stone-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-stone-800">{summary.completedPurchases}</span>
                        <span className="text-xs text-stone-400 block">
                          {summary.totalPurchases > summary.completedPurchases
                            ? `(${summary.totalPurchases} total)`
                            : 'orders'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-stone-900">
                        {formatCurrency(summary.totalValue, store.currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="View Supplier Details & History"
                            onClick={() => setSelectedSupplierForDetail(supplier)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Supplier (Admin PIN required)"
                            onClick={() => handleEditClick(supplier)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={supplier.active ? 'Deactivate Supplier (Admin PIN required)' : 'Activate Supplier (Admin PIN required)'}
                            onClick={() => handleToggleClick(supplier)}
                            className={`px-2 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                              supplier.active
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {supplier.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-stone-900">
                  {editingSupplier ? `Edit Supplier: ${editingSupplier.supplierCode}` : 'Register New Supplier'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Supplier Code <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SUP-001"
                    className="w-full px-3 py-2 text-sm font-mono uppercase bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">Must be unique</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setFormActive(e.target.value === 'ACTIVE')}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  >
                    <option value="ACTIVE">Active (Available)</option>
                    <option value="INACTIVE">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Supplier Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Syarikat Pembekal Makanan Jaya Sdn Bhd"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="e.g. En. Ahmad / Mr. Tan"
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +60 12-345 6789"
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sales@vendor.com.my"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Physical / Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street, warehouse location, city..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Notes / Terms
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Regular Tuesday delivery, minimum order RM200"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                {editingSupplier ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingSupplier)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50"
                  >
                    Delete / Deactivate
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingSupplier(null);
                    }}
                    className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium shadow-xs"
                  >
                    {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Detail Drawer / Modal */}
      {selectedSupplierForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-stone-200 flex items-start justify-between bg-stone-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200">
                    {selectedSupplierForDetail.supplierCode}
                  </span>
                  <h3 className="font-bold text-lg text-stone-900">
                    {selectedSupplierForDetail.supplierName}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedSupplierForDetail.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {selectedSupplierForDetail.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Registered: {formatDateTime(selectedSupplierForDetail.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplierForDetail(null)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Details */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-400 block mb-0.5 uppercase tracking-wider font-medium">Contact Person</span>
                  <span className="font-semibold text-stone-900">{selectedSupplierForDetail.contactPerson || '—'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 uppercase tracking-wider font-medium">Phone</span>
                  <span className="font-semibold text-stone-900">{selectedSupplierForDetail.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 uppercase tracking-wider font-medium">Email</span>
                  <span className="font-semibold text-stone-900">{selectedSupplierForDetail.email || '—'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 uppercase tracking-wider font-medium">Address</span>
                  <span className="font-semibold text-stone-900">{selectedSupplierForDetail.address || '—'}</span>
                </div>
                {selectedSupplierForDetail.notes && (
                  <div className="col-span-2 pt-2 border-t border-stone-200">
                    <span className="text-stone-400 block mb-0.5 uppercase tracking-wider font-medium">Notes / Terms</span>
                    <span className="text-stone-700">{selectedSupplierForDetail.notes}</span>
                  </div>
                )}
              </div>

              {/* Purchasing Summary Cards */}
              {(() => {
                const summary = PurchasingService.getSupplierPurchasingSummary(
                  selectedSupplierForDetail.id,
                  purchases
                );
                const supplierPurchases = purchases.filter(
                  (p) => p.supplierId === selectedSupplierForDetail.id
                );

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold block">
                          Total Purchases
                        </span>
                        <span className="text-xl font-bold text-stone-900 mt-1 block">
                          {summary.totalPurchases}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {summary.completedPurchases} completed
                        </span>
                      </div>

                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold block">
                          Units Received
                        </span>
                        <span className="text-xl font-bold text-emerald-700 mt-1 block">
                          {summary.totalUnits}
                        </span>
                        <span className="text-[10px] text-stone-400">total items</span>
                      </div>

                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold block">
                          Total Value
                        </span>
                        <span className="text-xl font-bold text-stone-900 mt-1 block">
                          {formatCurrency(summary.totalValue, store.currency)}
                        </span>
                        <span className="text-[10px] text-stone-400">received value</span>
                      </div>
                    </div>

                    {/* Historical Purchases Table */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2.5 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-stone-500" />
                        <span>Purchasing History</span>
                      </h4>

                      {supplierPurchases.length === 0 ? (
                        <div className="py-8 text-center bg-stone-50 rounded-xl border border-stone-200 text-stone-500 text-xs">
                          No purchase history recorded for this supplier yet.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-stone-200 overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-semibold">
                              <tr>
                                <th className="py-2.5 px-3">Purchase #</th>
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3 text-center">Items</th>
                                <th className="py-2.5 px-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {supplierPurchases.map((p) => (
                                <tr key={p.id} className="hover:bg-stone-50/70">
                                  <td className="py-2.5 px-3 font-mono font-bold text-stone-800">
                                    {p.purchaseNumber}
                                  </td>
                                  <td className="py-2.5 px-3 text-stone-600">
                                    {formatDateTime(p.purchaseDate)}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        p.status === 'COMPLETED'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : p.status === 'DRAFT'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-stone-700 font-medium">
                                    {p.items.length}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                                    {formatCurrency(p.total, store.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSupplierForDetail(null)}
                className="px-4 py-2 text-sm bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Audit Modal (SES 4.4 Locked Part E) */}
      <DuplicateAuditModal
        isOpen={isDuplicateAuditOpen}
        onClose={() => setIsDuplicateAuditOpen(false)}
        auditGroups={duplicateAuditGroups}
        entityType="Pembekal"
      />

      {/* Supplier CSV Import Modal */}
      <EntityCsvImportModal
        id="supplier-csv-import-modal"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Pembekal"
        entityType="SUPPLIER"
        onDownloadTemplate={() => CsvService.downloadSuppliersCsvTemplate()}
        onValidate={(rows) => CsvService.validateSuppliersUpsert(rows, suppliers)}
        onCommit={(res) => commitSuppliersUpsertImport(res)}
      />
    </div>
  );
};
