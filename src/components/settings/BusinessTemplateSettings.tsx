import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Sparkles,
  Check,
  CheckCircle2,
  Layers,
  Store,
  Sliders,
  Coffee,
  Flame,
  ShoppingBag,
  Info,
  AlertCircle,
  Plus,
  Trash2,
  ChefHat,
  Truck,
  Grid3X3,
  X,
  HelpCircle,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { TemplateService } from '../../services/templateService';
import {
  BusinessTemplate,
  BusinessTemplateId,
  TableManagementMode,
  RestaurantOrderType,
} from '../../types/restaurant';

export const BusinessTemplateSettings: React.FC = () => {
  const {
    businessConfig,
    updateBusinessConfig,
    applyBusinessTemplate,
  } = useStore();

  const templates = TemplateService.getAllTemplates();

  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<BusinessTemplate | null>(null);
  const [loadSampleMenu, setLoadSampleMenu] = useState(true);
  const [resetExistingMenu, setResetExistingMenu] = useState(false);
  const [updateTableMode, setUpdateTableMode] = useState(true);

  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  const handleOpenApplyModal = (tpl: BusinessTemplate) => {
    setSelectedTemplateForModal(tpl);
    setLoadSampleMenu(tpl.sampleMenuItems.length > 0);
    setResetExistingMenu(false);
    setUpdateTableMode(true);
  };

  const handleConfirmApplyTemplate = () => {
    if (!selectedTemplateForModal) return;

    try {
      applyBusinessTemplate(selectedTemplateForModal.id, {
        loadSampleMenu,
        resetExistingMenu,
        updateTableMode,
      });

      showFeedback(
        `Templat "${selectedTemplateForModal.name}" berjaya digunakan! Konfigurasi operasi & jenis pesanan telah diselaraskan.`
      );
      setSelectedTemplateForModal(null);
    } catch (e) {
      console.error(e);
      showFeedback('Gagal memohon templat. Sila cuba lagi.', 'error');
    }
  };

  const handleToggleOrderType = (type: RestaurantOrderType) => {
    if (!businessConfig) return;
    const currentTypes = businessConfig.enabledOrderTypes || ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
    const exists = currentTypes.includes(type);

    if (exists) {
      if (currentTypes.length <= 1) {
        showFeedback('Sekurang-kurangnya satu jenis pesanan mesti kekal aktif.', 'error');
        return;
      }
      const updated = currentTypes.filter((t) => t !== type);
      updateBusinessConfig({
        ...businessConfig,
        enabledOrderTypes: updated,
      });
      showFeedback(`Jenis pesanan "${getOrderTypeLabel(type)}" dinyahaktifkan.`);
    } else {
      const updated = [...currentTypes, type];
      updateBusinessConfig({
        ...businessConfig,
        enabledOrderTypes: updated,
      });
      showFeedback(`Jenis pesanan "${getOrderTypeLabel(type)}" diaktifkan.`);
    }
  };

  const handleSetTableMode = (mode: TableManagementMode) => {
    if (!businessConfig) return;
    updateBusinessConfig({
      ...businessConfig,
      tableMode: mode,
    });
    showFeedback(`Mod Meja ditukar kepada: ${getTableModeLabel(mode)}.`);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim();
    if (!clean) return;

    if (!businessConfig) return;
    if (businessConfig.categories.includes(clean)) {
      showFeedback(`Kategori "${clean}" sudah wujud.`, 'error');
      return;
    }

    const updatedCategories = [...businessConfig.categories, clean];
    updateBusinessConfig({
      ...businessConfig,
      categories: updatedCategories,
    });

    setNewCategoryInput('');
    showFeedback(`Kategori "${clean}" berjaya ditambah.`);
  };

  const handleRemoveCategory = (catName: string) => {
    if (!businessConfig) return;
    if (businessConfig.categories.length <= 1) {
      showFeedback('Sekurang-kurangnya satu kategori menu mesti kekal.', 'error');
      return;
    }

    const updatedCategories = businessConfig.categories.filter((c) => c !== catName);
    updateBusinessConfig({
      ...businessConfig,
      categories: updatedCategories,
    });
    showFeedback(`Kategori "${catName}" telah dipadam.`);
  };

  const getTemplateIcon = (id: BusinessTemplateId) => {
    switch (id) {
      case 'MAMAK_CAPATI':
        return <UtensilsCrossed className="w-5 h-5 text-amber-600" />;
      case 'TOMYAM':
        return <Flame className="w-5 h-5 text-rose-600" />;
      case 'CAFE':
        return <Coffee className="w-5 h-5 text-emerald-600" />;
      case 'GERAI':
        return <ShoppingBag className="w-5 h-5 text-sky-600" />;
      case 'CUSTOM':
      default:
        return <Sliders className="w-5 h-5 text-purple-600" />;
    }
  };

  const getOrderTypeLabel = (type: RestaurantOrderType) => {
    switch (type) {
      case 'DINE_IN':
        return 'Makan Di Sini (Dine-In)';
      case 'TAKEAWAY':
        return 'Bungkus / Bawa Pulang (Takeaway)';
      case 'DELIVERY':
        return 'Penghantaran (Delivery)';
    }
  };

  const getTableModeLabel = (mode: TableManagementMode) => {
    switch (mode) {
      case 'FULL':
        return 'Grid Penuh 6 Status Meja (Disyorkan untuk Dine-in)';
      case 'TABLE_NUMBER_ONLY':
        return 'Nombor Meja Sahaja (Walk-In Laju)';
      case 'DISABLED':
        return 'Lumpuhkan Pengurusan Meja (Gerai / Bungkus Sahaja)';
    }
  };

  return (
    <div id="business-template-settings-container" className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-6">
      {/* Header Seksyen SES v4.5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-stone-900">
              Konfigurasi Template Perniagaan &amp; Operasi (SES v4.5)
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              Simple by Default • Powerful When Needed
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl">
            Pilih template perniagaan sebagai titik permulaan operasi, kemudian suaikan tetapan meja, stesen dapur,
            dan jenis pesanan mengikut keperluan premis anda tanpa mengunci aliran kerja.
          </p>
        </div>

        {businessConfig && (
          <div className="shrink-0 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-right">
            <span className="text-[10px] text-stone-500 block uppercase font-bold tracking-wider">Template Aktif</span>
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 justify-end mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{businessConfig.templateName}</span>
            </span>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          id="template-feedback-banner"
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedbackMessage.text}</span>
        </div>
      )}

      {/* 1. Grid Pilihan Business Template */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Pilih Business Template</span>
          </h3>
          <span className="text-[11px] text-stone-500">
            {templates.length} template sedia ada
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {templates.map((tpl) => {
            const isActive = businessConfig?.templateId === tpl.id;
            return (
              <div
                key={tpl.id}
                id={`template-card-${tpl.id.toLowerCase()}`}
                className={`rounded-xl border p-4 flex flex-col justify-between transition relative ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-xs">
                      {getTemplateIcon(tpl.id)}
                    </div>
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Aktif Sekarang</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-stone-200/80 text-stone-700 text-[10px] font-semibold">
                        {tpl.badge}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-stone-900">{tpl.name}</h4>
                  <p className="text-[11px] font-medium text-stone-600 mt-0.5">{tpl.subtitle}</p>
                  <p className="text-[11px] text-stone-500 mt-2 line-clamp-3 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-stone-200/60 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="text-stone-500">Mod Meja:</span>
                      <span className="font-semibold text-stone-800">
                        {tpl.tableMode === 'FULL' ? 'Grid 6 Status' : tpl.tableMode === 'TABLE_NUMBER_ONLY' ? 'Nombor Meja' : 'Tiada Meja'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="text-stone-500">Stesen Dapur:</span>
                      <span className="font-semibold text-stone-800">
                        {tpl.kitchenStations.map((s) => s.name).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="text-stone-500">Sampel Hidangan:</span>
                      <span className="font-semibold text-stone-800">
                        {tpl.sampleMenuItems.length} Menu
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200">
                  {isActive ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-default"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Sedang Digunakan</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id={`apply-template-btn-${tpl.id.toLowerCase()}`}
                      onClick={() => handleOpenApplyModal(tpl)}
                      className="w-full py-2 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Guna Template Ini</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Tetapan Operasi Fleksibel (Table Mode & Order Types) */}
      <div className="pt-4 border-t border-stone-200">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-emerald-700" />
          <span>Tetapan Operasi Fleksibel</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mod Pengurusan Meja */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-3">
            <div className="flex items-start gap-2.5">
              <Grid3X3 className="w-4 h-4 text-emerald-700 mt-0.5" />
              <div>
                <div className="font-semibold text-xs text-stone-900">Mod Pengurusan Meja</div>
                <div className="text-[11px] text-stone-500">
                  Kawal paparan dan kedalaman aliran kerja meja mengikut susun atur premis.
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {[
                {
                  mode: 'FULL' as TableManagementMode,
                  title: 'Mod Penuh (6 Status Meja)',
                  desc: 'Menyokong grid meja, audit trail, tempahan, dan penjejakan status meja (Tersedia, Diduduki, Minta Bil, Ditempah, Pembersihan).',
                },
                {
                  mode: 'TABLE_NUMBER_ONLY' as TableManagementMode,
                  title: 'Nombor Meja Sahaja',
                  desc: 'Masukkan nombor meja secara manual semasa pesanan tanpa memantau status setiap meja.',
                },
                {
                  mode: 'DISABLED' as TableManagementMode,
                  title: 'Lumpuhkan Pengurusan Meja',
                  desc: 'Sesuai untuk gerai, trak makanan, atau kedai bungkus / pandu lalu tanpa meja fizikal.',
                },
              ].map((item) => {
                const isSelected = businessConfig?.tableMode === item.mode;
                return (
                  <label
                    key={item.mode}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'bg-white border-emerald-600 ring-1 ring-emerald-500/30'
                        : 'bg-white/80 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tableManagementMode"
                      value={item.mode}
                      checked={isSelected}
                      onChange={() => handleSetTableMode(item.mode)}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <div className={`font-semibold ${isSelected ? 'text-emerald-900' : 'text-stone-800'}`}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-stone-500 leading-normal mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Jenis Pesanan Dibenarkan */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShoppingBag className="w-4 h-4 text-emerald-700 mt-0.5" />
              <div>
                <div className="font-semibold text-xs text-stone-900">Jenis Pesanan Dibenarkan</div>
                <div className="text-[11px] text-stone-500">
                  Aktifkan jenis pesanan yang disokong oleh kedai anda.
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {[
                {
                  type: 'DINE_IN' as RestaurantOrderType,
                  title: 'Makan Di Sini (Dine-In)',
                  desc: 'Pesanan di meja restoran dengan bilangan tetamu (Pax).',
                  icon: <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-700" />,
                },
                {
                  type: 'TAKEAWAY' as RestaurantOrderType,
                  title: 'Bungkus / Bawa Pulang (Takeaway)',
                  desc: 'Pesanan bungkus dengan nama atau rujukan pelanggan.',
                  icon: <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />,
                },
                {
                  type: 'DELIVERY' as RestaurantOrderType,
                  title: 'Penghantaran (Delivery)',
                  desc: 'Pesanan dihantar ke lokasi pelanggan.',
                  icon: <Truck className="w-3.5 h-3.5 text-sky-600" />,
                },
              ].map((item) => {
                const isEnabled = businessConfig?.enabledOrderTypes.includes(item.type);
                return (
                  <label
                    key={item.type}
                    className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                      isEnabled
                        ? 'bg-white border-emerald-600/70 ring-1 ring-emerald-500/20'
                        : 'bg-white/60 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{item.icon}</div>
                      <div className="text-xs">
                        <div className={`font-semibold ${isEnabled ? 'text-stone-900' : 'text-stone-500'}`}>
                          {item.title}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleOrderType(item.type)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pengurusan Kategori Menu & Stesen Dapur */}
      <div className="pt-4 border-t border-stone-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Senarai Kategori Menu */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Kategori Menu Semasa ({businessConfig?.categories.length || 0})</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {businessConfig?.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-medium text-stone-800 shadow-xs"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-stone-400 hover:text-rose-600 transition ml-0.5"
                    title={`Padam kategori "${cat}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Nama kategori baharu (Cth: Pencuci Mulut)"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </form>
          </div>

          {/* Stesen Dapur (Kitchen Stations) */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-3">
            <div className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-emerald-700" />
              <span>Stesen Dapur &amp; KOT Routing</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Setiap hidangan akan dihalakan ke stesen dapur yang sepadan untuk pesanan Kitchen Order Ticket (KOT).
            </p>

            <div className="space-y-2 pt-1">
              {businessConfig?.kitchenStations.map((station) => (
                <div
                  key={station.id}
                  className="p-2.5 rounded-lg bg-white border border-stone-200 flex items-start justify-between gap-2 shadow-xs"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded bg-stone-100 font-mono text-[10px] text-stone-600 border border-stone-200">
                        {station.id}
                      </span>
                      <span>{station.name}</span>
                    </div>
                    {station.description && (
                      <div className="text-[11px] text-stone-500 mt-0.5">{station.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Pengesahan Guna Template */}
      {selectedTemplateForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            id="apply-template-confirm-modal"
            className="bg-white rounded-2xl border border-stone-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Guna Template: {selectedTemplateForModal.name}
                  </h3>
                  <p className="text-xs text-stone-500">Tetapkan konfigurasi permulaan perniagaan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplateForModal(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                <p className="font-semibold text-emerald-900">
                  Prinsip SES v4.5: Template tidak mengunci anda!
                </p>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Menerapkan template ini hanya akan menyediakan konfigurasi permulaan (kategori, stesen dapur, mod meja, dan jenis pesanan). Anda bebas menambah hidangan atau mengubah tetapan pada bila-bila masa.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loadSampleMenu}
                    onChange={(e) => setLoadSampleMenu(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-stone-900">
                      Masukkan Sampel Menu &amp; Variasi ({selectedTemplateForModal.sampleMenuItems.length} item)
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Memuatkan hidangan contoh dengan modifier dan variasi harga khas untuk template ini ke dalam POS anda.
                    </div>
                  </div>
                </label>

                {loadSampleMenu && (
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetExistingMenu}
                      onChange={(e) => setResetExistingMenu(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span>Gantikan Senarai Menu Sedia Ada</span>
                        {resetExistingMenu && (
                          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Perhatian: Padam Menu Lama
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Jika TIDAK ditandakan (lalai), menu baharu akan digabungkan secara selamat tanpa memadam hidangan anda yang sedia ada.
                      </div>
                    </div>
                  </label>
                )}

                <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateTableMode}
                    onChange={(e) => setUpdateTableMode(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-stone-900">
                      Selaraskan Mod Meja ({selectedTemplateForModal.tableMode === 'FULL' ? 'Grid 6 Status' : 'Nombor Sahaja'})
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Menukar tetapan meja mengikut amalan terbaik template ini.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedTemplateForModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-apply-template-btn"
                onClick={handleConfirmApplyTemplate}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Sahkan &amp; Guna Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
