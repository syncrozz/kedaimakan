/**
 * NiagaPOS - Customer Management & Loyalty Page
 * Part 07: Optional Retail Modules
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Eye,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  Award,
  ShoppingBag,
  TrendingUp,
  Receipt,
  X,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Download,
  UploadCloud,
  SearchCheck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Customer, Sale, LoyaltyLedgerEntry } from '../types';
import { formatCurrency, formatDateTime } from '../services/formatters';
import { CustomerService } from '../services/customerService';
import { LoyaltyService } from '../services/loyaltyService';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { CsvService } from '../services/csvService';
import { DuplicateAuditService } from '../services/duplicateAuditService';
import { SmartInputService } from '../services/smartInputService';
import { DuplicateAuditModal } from '../components/common/DuplicateAuditModal';
import { EntityCsvImportModal } from '../components/common/EntityCsvImportModal';

export const CustomersPage: React.FC = () => {
  const {
    store,
    customers,
    sales,
    loyaltyLedger,
    addCustomer,
    updateCustomer,
    toggleCustomerActive,
    deleteCustomer,
    isCustomerCodeAvailable,
    commitCustomersUpsertImport,
    redeemLoyaltyPoints,
    isAdminMode,
    requireAdmin,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'POINTS' | 'SPEND' | 'ORDERS'>('NAME');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [viewReceiptSale, setViewReceiptSale] = useState<Sale | null>(null);
  const [customerDetailTab, setCustomerDetailTab] = useState<'HISTORY' | 'LOYALTY'>('HISTORY');
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);

  // Duplicate audit groups (SES 4.4 Locked Part E)
  const duplicateAuditGroups = useMemo(
    () => DuplicateAuditService.auditCustomers(customers),
    [customers]
  );

  // Keyboard Escape listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewReceiptSale) {
          setViewReceiptSale(null);
        } else if (selectedCustomerForDetail) {
          setSelectedCustomerForDetail(null);
        } else if (isAddModalOpen || editingCustomer) {
          setIsAddModalOpen(false);
          setEditingCustomer(null);
        }
      }
    };
    if (isAddModalOpen || editingCustomer || selectedCustomerForDetail || viewReceiptSale) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddModalOpen, editingCustomer, selectedCustomerForDetail, viewReceiptSale]);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Redemption Form State inside Customer 360 modal
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState<number>(50);
  const [redeemReason, setRedeemReason] = useState<string>('Store discount voucher');
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Calculate customer metrics mapping for fast lookup
  const customerMetricsMap = useMemo(() => {
    const map = new Map<string, { totalSpend: number; totalOrders: number; pointsBalance: number; lastOrderDate?: string }>();
    customers.forEach((c) => {
      const metrics = CustomerService.calculateCustomerMetrics(c.id, sales, loyaltyLedger);
      map.set(c.id, metrics);
    });
    return map;
  }, [customers, sales, loyaltyLedger]);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        if (statusFilter === 'ACTIVE' && !c.active) return false;
        if (statusFilter === 'INACTIVE' && c.active) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const codeMatch = c.customerCode.toLowerCase().includes(q);
          const nameMatch = c.customerName.toLowerCase().includes(q);
          const phoneMatch = c.phone?.toLowerCase().includes(q) || false;
          const emailMatch = c.email?.toLowerCase().includes(q) || false;
          if (!codeMatch && !nameMatch && !phoneMatch && !emailMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const metA = customerMetricsMap.get(a.id) || { totalSpend: 0, totalOrders: 0, pointsBalance: 0 };
        const metB = customerMetricsMap.get(b.id) || { totalSpend: 0, totalOrders: 0, pointsBalance: 0 };

        if (sortBy === 'POINTS') return metB.pointsBalance - metA.pointsBalance;
        if (sortBy === 'SPEND') return metB.totalSpend - metA.totalSpend;
        if (sortBy === 'ORDERS') return metB.totalOrders - metA.totalOrders;
        return a.customerName.localeCompare(b.customerName);
      });
  }, [customers, statusFilter, searchQuery, sortBy, customerMetricsMap]);

  // Overall metrics
  const activeCount = customers.filter((c) => c.active).length;
  const totalCustomerSpend = useMemo(() => {
    return sales
      .filter((s) => s.status === 'COMPLETED' && s.customerId)
      .reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  const totalPointsIssued = useMemo(() => {
    return loyaltyLedger
      .filter((entry) => entry.type === 'EARNED')
      .reduce((sum, e) => sum + e.points, 0);
  }, [loyaltyLedger]);

  const handleOpenAddModal = () => {
    setFormCode(CustomerService.generateNextCustomerCode(customers));
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setFormActive(true);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormCode(cust.customerCode);
    setFormName(cust.customerName);
    setFormPhone(cust.phone || '');
    setFormEmail(cust.email || '');
    setFormNotes(cust.notes || '');
    setFormActive(cust.active);
    setFormError(null);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Smart Form input normalization (SES 4.4 Locked Part B)
    const normName = SmartInputService.normalizeName(formName);
    const normCode = SmartInputService.normalizeCode(formCode);
    const normPhone = SmartInputService.normalizePhone(formPhone);

    if (!normName) {
      setFormError('Nama pelanggan tidak boleh kosong.');
      return;
    }
    if (!normCode) {
      setFormError('Kod pelanggan tidak boleh kosong.');
      return;
    }

    try {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, {
          customerName: normName,
          phone: normPhone,
          email: formEmail.trim(),
          notes: formNotes.trim(),
          active: formActive,
        });
        setEditingCustomer(null);
        setFeedbackNotice({ type: 'success', text: `Customer "${normName}" updated successfully.` });
      } else {
        addCustomer({
          customerCode: normCode,
          customerName: normName,
          phone: normPhone,
          email: formEmail.trim(),
          notes: formNotes.trim(),
          active: formActive,
        });
        setIsAddModalOpen(false);
        setFeedbackNotice({ type: 'success', text: `Customer "${normName}" registered successfully.` });
      }
    } catch (err: any) {
      setFormError(err.message || 'Validation error.');
    }
  };

  const handleAddClick = () => {
    requireAdmin(handleOpenAddModal, 'Daftar Pelanggan Baru');
  };

  const handleEditClick = (cust: Customer) => {
    requireAdmin(() => handleOpenEditModal(cust), `Kemaskini Pelanggan ${cust.customerName}`);
  };

  const handleToggleClick = (cust: Customer) => {
    requireAdmin(() => toggleCustomerActive(cust.id), `Tukar Status Pelanggan ${cust.customerName}`);
  };

  const handleDeleteClick = (cust: Customer) => {
    requireAdmin(() => handleDelete(cust), `Padam Pelanggan ${cust.customerName}`);
  };

  const handleExportCsvClick = () => {
    CsvService.exportCustomers(filteredCustomers, loyaltyLedger);
  };

  const handleDelete = (cust: Customer) => {
    const result = deleteCustomer(cust.id);
    setFeedbackNotice({
      type: result.success ? 'success' : 'info',
      text: result.message,
    });
  };

  // Customer 360° Data
  const detailSales = useMemo(() => {
    if (!selectedCustomerForDetail) return [];
    return sales.filter(
      (s) => s.customerId === selectedCustomerForDetail.id && s.status === 'COMPLETED'
    );
  }, [selectedCustomerForDetail, sales]);

  const detailLoyalty = useMemo(() => {
    if (!selectedCustomerForDetail) return [];
    return loyaltyLedger.filter((l) => l.customerId === selectedCustomerForDetail.id);
  }, [selectedCustomerForDetail, loyaltyLedger]);

  const selectedMetrics = selectedCustomerForDetail
    ? customerMetricsMap.get(selectedCustomerForDetail.id) || { totalSpend: 0, totalOrders: 0, pointsBalance: 0 }
    : { totalSpend: 0, totalOrders: 0, pointsBalance: 0 };

  const handleRedeemPointsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForDetail) return;
    setRedeemError(null);

    try {
      redeemLoyaltyPoints(
        selectedCustomerForDetail.id,
        redeemPointsAmount,
        `VCH-${Date.now().toString().slice(-6)}`,
        redeemReason
      );
      setIsRedeeming(false);
      setFeedbackNotice({
        type: 'success',
        text: `Redeemed ${redeemPointsAmount} loyalty points for ${selectedCustomerForDetail.customerName}.`,
      });
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to redeem points.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Customers & Membership
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Retail Module
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Customer directory, purchase history 360°, and loyalty points ledger for {store.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicate Audit Button (SES 4.4 Locked Part E) */}
          <button
            type="button"
            id="audit-customers-btn"
            onClick={() => setIsDuplicateAuditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Semak pertindihan nama atau telefon pelanggan"
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
            id="export-customers-csv-btn"
            onClick={handleExportCsvClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Eksport senarai pelanggan semasa ke fail CSV"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV Button */}
          <button
            type="button"
            id="import-customers-csv-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Import senarai pelanggan dari fail CSV"
          >
            <UploadCloud className="w-4 h-4 text-stone-600" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            id="add-customer-btn"
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-xs ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{feedbackNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-stone-400 hover:text-stone-700 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-medium text-stone-500">Total Customers</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{customers.length}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Registered in store</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-medium text-stone-500">Active Members</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">{activeCount}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Eligible at checkout</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-medium text-stone-500">Member Sales Value</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            {formatCurrency(totalCustomerSpend, store.currency)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Attributed sales revenue</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-medium text-stone-500">Points Issued</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{totalPointsIssued} pts</div>
          <div className="text-[11px] text-stone-400 mt-0.5">1 pt per {store.currency} 1.00 spent</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="customer-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, code (CUS-000001), phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 focus:outline-none"
            >
              <option value="ALL">All Status ({customers.length})</option>
              <option value="ACTIVE">Active Only ({activeCount})</option>
              <option value="INACTIVE">Inactive Only ({customers.length - activeCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 focus:outline-none"
            >
              <option value="NAME">Name (A-Z)</option>
              <option value="POINTS">Points Balance</option>
              <option value="SPEND">Total Spend</option>
              <option value="ORDERS">Completed Orders</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Customer Code</th>
                <th className="px-4 py-3">Name & Contact</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Total Spend</th>
                <th className="px-4 py-3 text-right">Points Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-stone-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-600">No customers found</p>
                    <p className="text-[11px] text-stone-400 mt-1">Try adjusting your filters or register a new customer.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const metrics = customerMetricsMap.get(cust.id) || {
                    totalSpend: 0,
                    totalOrders: 0,
                    pointsBalance: 0,
                  };

                  return (
                    <tr key={cust.id} className="hover:bg-stone-50/70 transition">
                      <td className="px-4 py-3 font-mono font-bold text-stone-800">
                        {cust.customerCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-stone-900">{cust.customerName}</div>
                        <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-0.5">
                          {cust.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              {cust.phone}
                            </span>
                          )}
                          {cust.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-stone-400" />
                              {cust.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleClick(cust)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                            cust.active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
                          }`}
                          title="Click to toggle status (Admin PIN required)"
                        >
                          {cust.active ? (
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
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        {metrics.totalOrders}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-900">
                        {formatCurrency(metrics.totalSpend, store.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>{metrics.pointsBalance} pts</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForDetail(cust);
                              setCustomerDetailTab('HISTORY');
                            }}
                            className="p-1.5 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900 cursor-pointer"
                            title="Customer 360° View & History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditClick(cust)}
                            className="p-1.5 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900 cursor-pointer"
                            title="Edit Customer (Admin PIN required)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(cust)}
                            className="p-1.5 rounded hover:bg-rose-50 text-stone-400 hover:text-rose-600 cursor-pointer"
                            title="Delete or Deactivate (Admin PIN required)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {(isAddModalOpen || editingCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-stone-900 text-sm">
                  {editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Customer Code <span className="text-stone-400 font-normal">(System format: CUS-000001)</span>
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  disabled={!!editingCustomer}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:bg-stone-100 disabled:text-stone-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name / Display Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Kak Rosmah, Encik Halim"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 012-3456789"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. rosmah@gmail.com"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Operational Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Neighbor next door, prefers digital receipt..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700"
                  />
                  <span className="text-xs text-stone-700 font-medium">
                    Active membership status (eligible at POS register)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition"
                >
                  {editingCustomer ? 'Save Changes' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360° / Detail & History Modal */}
      {selectedCustomerForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900 text-sm">
                      {selectedCustomerForDetail.customerName}
                    </h3>
                    <span className="font-mono text-xs bg-stone-200/70 text-stone-700 px-1.5 py-0.2 rounded">
                      {selectedCustomerForDetail.customerCode}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                        selectedCustomerForDetail.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {selectedCustomerForDetail.active ? 'Active Member' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-3 mt-0.5">
                    {selectedCustomerForDetail.phone && <span>Tel: {selectedCustomerForDetail.phone}</span>}
                    {selectedCustomerForDetail.email && <span>Email: {selectedCustomerForDetail.email}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerForDetail(null);
                  setIsRedeeming(false);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Summary Statistics Bar */}
            <div className="grid grid-cols-4 border-b border-stone-200 bg-white divide-x divide-stone-100 text-center py-3">
              <div>
                <div className="text-[10px] font-medium text-stone-500 uppercase">Total Spend</div>
                <div className="text-sm font-bold font-mono text-stone-900 mt-0.5">
                  {formatCurrency(selectedMetrics.totalSpend, store.currency)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-stone-500 uppercase">Completed Orders</div>
                <div className="text-sm font-bold font-mono text-stone-900 mt-0.5">
                  {selectedMetrics.totalOrders}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-stone-500 uppercase">Points Balance</div>
                <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5 flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>{selectedMetrics.pointsBalance} pts</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-stone-500 uppercase">AOV</div>
                <div className="text-sm font-bold font-mono text-stone-900 mt-0.5">
                  {selectedMetrics.totalOrders > 0
                    ? formatCurrency(selectedMetrics.totalSpend / selectedMetrics.totalOrders, store.currency)
                    : formatCurrency(0, store.currency)}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-stone-200 bg-stone-50/50 px-4 pt-2">
              <button
                type="button"
                onClick={() => setCustomerDetailTab('HISTORY')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                  customerDetailTab === 'HISTORY'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Purchase History ({detailSales.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomerDetailTab('LOYALTY')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                  customerDetailTab === 'LOYALTY'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Loyalty Points Ledger ({detailLoyalty.length})</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {customerDetailTab === 'HISTORY' ? (
                <div className="space-y-3">
                  {detailSales.length === 0 ? (
                    <div className="py-12 text-center text-stone-400 text-xs">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                      <p className="font-semibold text-stone-700">No purchase history recorded</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Transactions rung up at POS attached to this member will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                      {detailSales.map((s) => (
                        <div key={s.id} className="p-3 flex items-center justify-between hover:bg-stone-50/60 transition">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-stone-900">
                                {s.transactionNumber}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                {formatDateTime(s.dateTime)}
                              </span>
                              {s.cashierNameSnapshot && (
                                <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                                  Cashier: {s.cashierNameSnapshot}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 mt-1">
                              {s.items.length} item(s) • Total Cost: {formatCurrency(s.totalCost, store.currency)}
                              {s.pointsEarned ? (
                                <span className="ml-2 font-semibold text-emerald-700">
                                  (+{s.pointsEarned} pts earned)
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-mono font-bold text-xs text-stone-900">
                                {formatCurrency(s.total, store.currency)}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-mono">
                                +{formatCurrency(s.grossProfit, store.currency)} profit
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewReceiptSale(s)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3 text-stone-500" />
                              <span>Receipt</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Points Action Toolbar */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-semibold text-emerald-900">
                        Current Available Balance: {selectedMetrics.pointsBalance} pts
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsRedeeming(!isRedeeming)}
                      className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
                    >
                      {isRedeeming ? 'Cancel Redemption' : 'Redeem Points'}
                    </button>
                  </div>

                  {/* Redemption Form */}
                  {isRedeeming && (
                    <form onSubmit={handleRedeemPointsSubmit} className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
                      <div className="text-xs font-bold text-stone-900">Redeem Loyalty Points</div>
                      {redeemError && (
                        <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                          {redeemError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Points to Redeem
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={selectedMetrics.pointsBalance}
                            value={redeemPointsAmount}
                            onChange={(e) => setRedeemPointsAmount(Number(e.target.value))}
                            className="w-full px-2.5 py-1 text-xs rounded border border-stone-300 font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Redemption Note / Reason
                          </label>
                          <input
                            type="text"
                            value={redeemReason}
                            onChange={(e) => setRedeemReason(e.target.value)}
                            placeholder="e.g. RM 5.00 cash voucher"
                            className="w-full px-2.5 py-1 text-xs rounded border border-stone-300"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsRedeeming(false)}
                          className="px-3 py-1 text-xs text-stone-600 rounded hover:bg-stone-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1 text-xs bg-emerald-800 text-white font-semibold rounded hover:bg-emerald-900"
                        >
                          Confirm Deduction
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Loyalty Ledger List */}
                  {detailLoyalty.length === 0 ? (
                    <div className="py-8 text-center text-stone-400 text-xs">
                      <Award className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                      <p className="font-semibold text-stone-700">No loyalty ledger entries</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                      {detailLoyalty.map((entry) => (
                        <div key={entry.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-stone-50/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  entry.type === 'EARNED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : entry.type === 'REDEEMED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-stone-100 text-stone-700'
                                }`}
                              >
                                {entry.type}
                              </span>
                              <span className="font-mono text-[11px] text-stone-500">
                                {formatDateTime(entry.dateTime)}
                              </span>
                              {entry.referenceId && (
                                <span className="font-mono text-[10px] text-stone-400">
                                  Ref: {entry.referenceId}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-600 mt-0.5">
                              {entry.description || (entry.type === 'EARNED' ? 'POS transaction award' : 'Points redemption')}
                            </div>
                          </div>

                          <div className="text-right font-mono font-bold">
                            {entry.points > 0 ? (
                              <span className="text-emerald-700 flex items-center gap-0.5">
                                <ArrowUpRight className="w-3.5 h-3.5" />+{entry.points} pts
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center gap-0.5">
                                <ArrowDownRight className="w-3.5 h-3.5" />{entry.points} pts
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-stone-200 flex justify-end bg-stone-50">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerForDetail(null);
                  setIsRedeeming(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-900 transition"
              >
                Close 360° View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Receipt Modal from Customer 360 */}
      {viewReceiptSale && (
        <ReceiptModal
          isOpen={!!viewReceiptSale}
          onClose={() => setViewReceiptSale(null)}
          sale={viewReceiptSale}
          store={store}
        />
      )}

      {/* Duplicate Audit Modal (SES 4.4 Locked Part E) */}
      <DuplicateAuditModal
        isOpen={isDuplicateAuditOpen}
        onClose={() => setIsDuplicateAuditOpen(false)}
        auditGroups={duplicateAuditGroups}
        entityType="Pelanggan"
      />

      {/* Customer CSV Import Modal */}
      <EntityCsvImportModal
        id="customer-csv-import-modal"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Pelanggan"
        entityType="CUSTOMER"
        onDownloadTemplate={() => CsvService.downloadCustomersCsvTemplate()}
        onValidate={(rows) => CsvService.validateCustomersUpsert(rows, customers)}
        onCommit={(res) => commitCustomersUpsertImport(res)}
      />
    </div>
  );
};
