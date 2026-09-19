import React from 'react';
import { RestaurantOrderType, RestaurantTable } from '../../types/restaurant';
import { TableService } from '../../services/tableService';
import { UtensilsCrossed, ShoppingBag, Truck, Hash, Users, LayoutGrid, Calendar, Clock } from 'lucide-react';

interface RestaurantOrderTypeSelectorProps {
  orderType: RestaurantOrderType;
  tableNumber: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  availableTables?: RestaurantTable[];
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
  onOrderTypeChange,
  onTableNumberChange,
  onGuestCountChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onViewTableGrid,
}) => {
  return (
    <div id="restaurant-order-type-selector" className="bg-stone-900/70 border border-stone-800 rounded-xl p-3 mb-3 shadow-xs">
      {/* Tab Pilihan Jenis Pesanan */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-950/80 rounded-lg border border-stone-800/80">
        <button
          type="button"
          id="order-type-dine-in-btn"
          onClick={() => onOrderTypeChange('DINE_IN')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
            orderType === 'DINE_IN'
              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>Dine-in (Makan)</span>
        </button>

        <button
          type="button"
          id="order-type-takeaway-btn"
          onClick={() => onOrderTypeChange('TAKEAWAY')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
            orderType === 'TAKEAWAY'
              ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bungkus (Takeaway)</span>
        </button>

        <button
          type="button"
          id="order-type-delivery-btn"
          onClick={() => onOrderTypeChange('DELIVERY')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
            orderType === 'DELIVERY'
              ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-500'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Delivery</span>
        </button>
      </div>

      {/* Medan Khusus Mengikut Jenis Pesanan */}
      {orderType === 'DINE_IN' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-stone-800/60">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="order-table-input" className="text-[11px] font-medium text-stone-400 flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-emerald-400" />
                <span>Nombor Meja / Zon</span>
              </label>
              {onViewTableGrid && (
                <button
                  type="button"
                  id="view-table-grid-btn"
                  onClick={onViewTableGrid}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Lihat Grid Meja</span>
                </button>
              )}
            </div>
            {availableTables && availableTables.length > 0 ? (
              <div className="flex gap-1.5">
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
                  className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                >
                  {availableTables.map((tbl) => (
                    <option key={tbl.id} value={tbl.tableNumber}>
                      {tbl.tableNumber} - {tbl.zone} ({tbl.capacity}p) [{tbl.status}]
                      {tbl.activeReservation ? ` [Tempahan: ${tbl.activeReservation.reservationTime}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                id="order-table-input"
                type="text"
                placeholder="Cth: Meja 1, T-04, VIP"
                value={tableNumber}
                onChange={(e) => onTableNumberChange(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
            )}

            {/* Amaran Tempahan Meja Pilihan (SES v4.5) */}
            {(() => {
              const selectedTableData = availableTables?.find((t) => t.tableNumber === tableNumber);
              const selectedTableRes = selectedTableData?.activeReservation;
              if (!selectedTableRes) return null;

              const timeDiff = TableService.getReservationTimeDiffLabel(selectedTableRes);
              return (
                <div
                  id="selected-table-reservation-warning"
                  className="mt-2 p-2.5 rounded-xl bg-purple-950/50 border border-purple-700/70 text-purple-200 text-xs space-y-1"
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
                className="w-full bg-stone-950 border border-stone-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <div className="flex gap-1">
                {[1, 2, 4, 6].map(pax => (
                  <button
                    key={pax}
                    type="button"
                    onClick={() => onGuestCountChange(pax)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      guestCount === pax 
                        ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500 font-semibold' 
                        : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    {pax}p
                  </button>
                ))}
              </div>
            </div>
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
