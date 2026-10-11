import React from 'react';
import { RestaurantOrderType, RestaurantTable, TableManagementMode } from '../../types/restaurant';
import { TableService } from '../../services/tableService';
import { UtensilsCrossed, ShoppingBag, Truck, Hash, Users, LayoutGrid, Calendar, Clock } from 'lucide-react';

interface RestaurantOrderTypeSelectorProps {
  orderType: RestaurantOrderType;
  tableNumber: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  availableTables?: RestaurantTable[];
  enabledOrderTypes?: RestaurantOrderType[];
  tableMode?: TableManagementMode;
  onOrderTypeChange: (type: RestaurantOrderType) => void;
  onTableNumberChange: (table: string) => void;
  onGuestCountChange: (count: number) => void;
  onCustomerNameChange: (name: string) => void;
  onCustomerPhoneChange: (phone: string) => void;
  onViewTableGrid?: () => void;
}

export const RestaurantOrderTypeSelector: React.FC<RestaurantOrderTypeSelectorProps> = ({
  orderType,
  tableNumber,
  guestCount,
  customerName,
  customerPhone,
  availableTables,
  enabledOrderTypes,
  tableMode = 'FULL',
  onOrderTypeChange,
  onTableNumberChange,
  onGuestCountChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onViewTableGrid,
}) => {
  // Tentukan jenis pesanan yang dibenarkan mengikut konfigurasi kedai (SES v4.5)
  const allowedTypes: RestaurantOrderType[] =
    enabledOrderTypes && enabledOrderTypes.length > 0
      ? enabledOrderTypes
      : ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];

  return (
    <div id="restaurant-order-type-selector" className="bg-stone-900/70 border border-stone-800 rounded-xl p-3 mb-3 shadow-xs">
      {/* Tab Pilihan Jenis Pesanan */}
      <div
        className="grid gap-1.5 p-1 bg-stone-950/80 rounded-lg border border-stone-800/80"
        style={{ gridTemplateColumns: `repeat(${allowedTypes.length}, minmax(0, 1fr))` }}
      >
        {allowedTypes.includes('DINE_IN') && (
          <button
            type="button"
            id="order-type-dine-in-btn"
            onClick={() => onOrderTypeChange('DINE_IN')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              orderType === 'DINE_IN'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Dine-in</span>
          </button>
        )}

        {allowedTypes.includes('TAKEAWAY') && (
          <button
            type="button"
            id="order-type-takeaway-btn"
            onClick={() => onOrderTypeChange('TAKEAWAY')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              orderType === 'TAKEAWAY'
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bungkus</span>
          </button>
        )}

        {allowedTypes.includes('DELIVERY') && (
          <button
            type="button"
            id="order-type-delivery-btn"
            onClick={() => onOrderTypeChange('DELIVERY')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              orderType === 'DELIVERY'
                ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-500'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Delivery</span>
          </button>
        )}
      </div>

      {/* Medan Khusus Mengikut Jenis Pesanan */}
      {orderType === 'DINE_IN' && tableMode !== 'DISABLED' && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-800/60 space-y-2.5">
          {/* Baris 1: Meja Terpilih & Tetamu (Pax) - Bersebelahan & Seimbang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Status & Maklumat Meja */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-stone-400 flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  <span>Meja Terpilih</span>
                </span>
                {tableMode === 'FULL' && onViewTableGrid && (
                  <button
                    type="button"
                    id="view-table-grid-btn"
                    onClick={onViewTableGrid}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Grid Meja</span>
                  </button>
                )}
              </div>

              {tableMode === 'FULL' && availableTables && availableTables.length > 0 ? (
                <div className="flex items-center justify-between bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${tableNumber ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'}`} />
                    <span className="font-bold text-white">
                      {tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja Di Bawah'}
                    </span>
                  </div>
                  {tableNumber && (() => {
                    const found = availableTables.find((t) => t.tableNumber === tableNumber);
                    return found ? (
                      <span className="text-[10px] text-stone-300 bg-stone-900 px-2 py-0.5 rounded border border-stone-800 font-medium">
                        {found.zone} • {found.capacity}p
                      </span>
                    ) : null;
                  })()}
                </div>
              ) : (
                <input
                  id="order-table-input"
                  type="text"
                  placeholder="Cth: 1, T-04, VIP1"
                  value={tableNumber}
                  onChange={(e) => onTableNumberChange(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              )}
            </div>

            {/* Bilangan Tetamu (Pax) */}
            <div>
              <label htmlFor="order-pax-input" className="block text-[11px] font-medium text-stone-400 mb-1 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>Bilangan Tetamu (Pax)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="order-pax-input"
                  type="number"
                  min="1"
                  max="50"
                  value={guestCount || 1}
                  onChange={(e) => onGuestCountChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-stone-950 border border-stone-700/80 rounded-lg px-2 py-1.5 text-xs text-white text-center font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex-1 grid grid-cols-4 gap-1">
                  {[1, 2, 4, 6].map((pax) => (
                    <button
                      key={pax}
                      type="button"
                      onClick={() => onGuestCountChange(pax)}
                      className={`py-1 text-[11px] rounded border font-medium transition-colors cursor-pointer text-center ${
                        guestCount === pax
                          ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500 font-bold'
                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      {pax}p
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Baris 2: Quick Table Chips (Penuh Selebar Kad, Sangat Selesa & Mesra Sentuhan) */}
          {tableMode === 'FULL' && availableTables && availableTables.length > 0 && (
            <div className="bg-stone-950/70 border border-stone-800/80 rounded-xl p-2.5 space-y-2">
              {/* Elemen tersembunyi untuk rujukan programatik */}
              <select
                id="order-table-select"
                value={tableNumber}
                onChange={(e) => {
                  const selected = e.target.value;
                  onTableNumberChange(selected);
                  const found = availableTables.find((t) => t.tableNumber === selected);
                  if (found && found.capacity) {
                    onGuestCountChange(found.capacity);
                  }
                }}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              >
                <option value="">Tiada Meja Dipilih</option>
                {availableTables.map((tbl) => (
                  <option key={tbl.id} value={tbl.tableNumber}>
                    {tbl.tableNumber} - {tbl.zone} ({tbl.capacity}p)
                  </option>
                ))}
              </select>

              {/* Tajuk & Petunjuk Status Legend */}
              <div className="flex items-center justify-between text-[11px] font-medium px-0.5">
                <span className="text-stone-300 font-semibold flex items-center gap-1.5">
                  <span>Pilihan Meja</span>
                  <span className="text-[10px] text-stone-500 font-normal">({availableTables.length} Meja)</span>
                </span>
                <div className="flex items-center gap-2.5 text-[10px] text-stone-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Kosong
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Guna
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span> Tempah
                  </span>
                </div>
              </div>

              {/* Grid Butang Meja yang Luas, Kontras Tinggi & Jelas Terhadap Latar Hitam */}
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 p-1.5 bg-stone-900/60 rounded-xl border border-stone-800/80">
                {availableTables.map((tbl) => {
                  const isSelected = tableNumber === tbl.tableNumber;
                  const isOccupied = tbl.status === 'OCCUPIED';
                  const isReserved = Boolean(tbl.activeReservation) || tbl.status === 'RESERVED';
                  const isWaiting = tbl.status === 'WAITING_PAYMENT';

                  let dotColor = 'bg-emerald-400 shadow-sm shadow-emerald-400/40';
                  let baseBg = 'bg-stone-800/90 hover:bg-stone-700 border-stone-600/90 text-stone-100 shadow-xs hover:border-emerald-500/50';

                  if (isSelected) {
                    baseBg = 'bg-emerald-600 border-emerald-300 text-white shadow-md ring-2 ring-emerald-400 scale-[1.02]';
                  } else if (isOccupied) {
                    dotColor = 'bg-rose-500 shadow-sm shadow-rose-500/40';
                    baseBg = 'bg-rose-950/50 border-rose-700/80 text-rose-100 hover:bg-rose-900/60 hover:border-rose-500';
                  } else if (isWaiting) {
                    dotColor = 'bg-amber-400 shadow-sm shadow-amber-400/40';
                    baseBg = 'bg-amber-950/50 border-amber-700/80 text-amber-100 hover:bg-amber-900/60 hover:border-amber-500';
                  } else if (isReserved) {
                    dotColor = 'bg-purple-400 shadow-sm shadow-purple-400/40';
                    baseBg = 'bg-purple-950/50 border-purple-700/80 text-purple-100 hover:bg-purple-900/60 hover:border-purple-500';
                  }

                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      id={`quick-table-chip-${tbl.tableNumber}`}
                      onClick={() => {
                        onTableNumberChange(tbl.tableNumber);
                        if (tbl.capacity) {
                          onGuestCountChange(tbl.capacity);
                        }
                      }}
                      className={`flex flex-col justify-between p-2 rounded-lg border text-left transition-all cursor-pointer min-h-[52px] ${baseBg}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`font-black text-xs tracking-wide ${isSelected ? 'text-white' : 'text-white'}`}>
                          {tbl.tableNumber}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isSelected ? 'bg-white ring-2 ring-emerald-300' : dotColor
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full text-[10px] mt-1">
                        <span className={`truncate max-w-[50px] font-medium ${isSelected ? 'text-emerald-100' : 'text-stone-300'}`}>
                          {tbl.zone || 'Utama'}
                        </span>
                        <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-amber-300'}`}>
                          {tbl.capacity}p
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amaran Tempahan Meja Pilihan (SES v4.5) */}
          {tableMode === 'FULL' && (() => {
            const selectedTableData = availableTables?.find((t) => t.tableNumber === tableNumber);
            const selectedTableRes = selectedTableData?.activeReservation;
            if (!selectedTableRes) return null;

            const timeDiff = TableService.getReservationTimeDiffLabel(selectedTableRes);
            return (
              <div
                id="selected-table-reservation-warning"
                className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-700/70 text-purple-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-1 font-bold text-purple-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">Tempahan: {selectedTableRes.customerName}</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900 border border-purple-700 text-amber-300 font-mono font-semibold shrink-0">
                    {timeDiff}
                  </span>
                </div>
                <div className="text-[11px] text-stone-300 flex items-center justify-between">
                  <span>Masa: <strong className="text-white font-mono">{selectedTableRes.reservationTime}</strong></span>
                  <span className="font-semibold text-purple-200">{selectedTableRes.pax} Pax</span>
                </div>
                {selectedTableData?.status === 'AVAILABLE' && (
                  <div className="text-[10px] text-amber-300/90 pt-1 border-t border-purple-800/40 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Meja dibenarkan untuk walk-in jika selesai sebelum {selectedTableRes.reservationTime}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Dine-In apabila tableMode === 'DISABLED' */}
      {orderType === 'DINE_IN' && tableMode === 'DISABLED' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-stone-800/60">
          <div>
            <label htmlFor="order-customer-name-input" className="block text-[11px] font-medium text-stone-400 mb-1">
              Nama Pelanggan / No. Giliran (Pilihan)
            </label>
            <input
              id="order-customer-name-input"
              type="text"
              placeholder="Cth: No. 12, En. Kamal"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="order-pax-input" className="block text-[11px] font-medium text-stone-400 mb-1">
              Bilangan Tetamu (Pax)
            </label>
            <input
              id="order-pax-input"
              type="number"
              min="1"
              max="20"
              value={guestCount || 1}
              onChange={(e) => onGuestCountChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {(orderType === 'TAKEAWAY' || orderType === 'DELIVERY') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-stone-800/60">
          <div>
            <label htmlFor="order-customer-name-input" className="block text-[11px] font-medium text-stone-400 mb-1">
              Nama Pelanggan / Rujukan
            </label>
            <input
              id="order-customer-name-input"
              type="text"
              placeholder="Cth: En. Azman, Grab #4912"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label htmlFor="order-customer-phone-input" className="block text-[11px] font-medium text-stone-400 mb-1">
              No. Telefon (Pilihan)
            </label>
            <input
              id="order-customer-phone-input"
              type="tel"
              placeholder="Cth: 012-3456789"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
};
