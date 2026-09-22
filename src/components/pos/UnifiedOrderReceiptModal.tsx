import React from 'react';
import { UnifiedCompletedOrderRecord, RestaurantTaxConfig } from '../../types/restaurant';
import { formatCurrency } from '../../services/formatters';
import { Printer, X, CheckCircle, UtensilsCrossed, Package, ShieldCheck } from 'lucide-react';

interface UnifiedOrderReceiptModalProps {
  isOpen: boolean;
  order: UnifiedCompletedOrderRecord | null;
  taxConfig: RestaurantTaxConfig;
  storeName?: string;
  onClose: () => void;
}

export const UnifiedOrderReceiptModal: React.FC<UnifiedOrderReceiptModalProps> = ({
  isOpen,
  order,
  taxConfig,
  storeName = 'SYNCROZZ KEDAI MAKAN',
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const restaurantItems = order.restaurantItems || order.items.filter((it) => it.itemType !== 'RETAIL');
  const retailItems = order.retailItems || order.items.filter((it) => it.itemType === 'RETAIL');

  const formattedDate = new Date(order.timestamp).toLocaleString('ms-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Action Bar */}
        <div className="p-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Resit Pembayaran Bersepadu
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Body */}
        <div className="p-5 flex-1 overflow-y-auto bg-stone-950/50 font-mono text-xs text-stone-300 space-y-4">
          {/* Store & Order Metadata */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-800">
            <h2 className="text-sm font-black text-white font-sans tracking-wide uppercase">
              {storeName}
            </h2>
            <p className="text-[11px] text-stone-400 font-sans">
              SYNCROZZ Restoran &amp; NiagaPOS Bersepadu
            </p>
            <div className="pt-2 text-[11px] text-stone-400 space-y-0.5">
              <div className="flex justify-between">
                <span>No. Pesanan:</span>
                <span className="text-white font-bold">{order.orderId}</span>
              </div>
              {order.orderType === 'DINE_IN' && (
                <div className="flex justify-between">
                  <span>Meja / Tetamu:</span>
                  <span className="text-emerald-400 font-bold">
                    Meja {order.tableNumber || '-'} ({order.guestCount || 1} Pax)
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Jenis Pesanan:</span>
                <span className="text-stone-300">
                  {order.orderType === 'DINE_IN'
                    ? 'Makan di Restoran (Dine-In)'
                    : order.orderType === 'TAKEAWAY'
                    ? 'Bungkus (Takeaway)'
                    : 'Penghantaran (Delivery)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tarikh &amp; Masa:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Juruwang:</span>
                <span>{order.cashierName}</span>
              </div>
            </div>
          </div>

          {/* Restaurant Items Section */}
          {restaurantItems.length > 0 && (
            <div className="space-y-2 pb-3 border-b border-dashed border-stone-800">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 font-sans uppercase">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Hidangan Restoran</span>
              </div>
              <div className="space-y-1.5">
                {restaurantItems.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-stone-200">
                        {item.nameSnapshot} &times; {item.quantity}
                      </span>
                      <span className="text-white font-bold">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <div className="text-[10px] text-stone-400 pl-2">
                        {item.selectedModifiers.map((m) => m.optionName).join(', ')}
                      </div>
                    )}
                    {item.discountAmount > 0 && (
                      <div className="text-[10px] text-amber-400 pl-2">
                        (Diskaun: -{formatCurrency(item.discountAmount)})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retail Items Section (NiagaPOS) */}
          {retailItems.length > 0 && (
            <div className="space-y-2 pb-3 border-b border-dashed border-stone-800">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 font-sans uppercase">
                <Package className="w-3.5 h-3.5" />
                <span>Barangan Runcit (NiagaPOS)</span>
              </div>
              <div className="space-y-1.5">
                {retailItems.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-stone-200">
                        {item.nameSnapshot} &times; {item.quantity}
                      </span>
                      <span className="text-white font-bold">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 pl-2 flex items-center justify-between">
                      <span>SKU: {item.retailSku || '-'}</span>
                      <span>@{formatCurrency(item.unitTotal)} / unit</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between text-stone-400">
              <span>Subjumlah Kasar:</span>
              <span>{formatCurrency(order.grossSubtotal)}</span>
            </div>

            {order.totalDiscounts > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Jumlah Diskaun:</span>
                <span>-{formatCurrency(order.totalDiscounts)}</span>
              </div>
            )}

            {order.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-stone-400">
                <span>Caj Perkhidmatan ({taxConfig.serviceChargePercent}%):</span>
                <span>+{formatCurrency(order.serviceChargeAmount)}</span>
              </div>
            )}

            {taxConfig.taxEnabled && order.taxAmount > 0 && (
              <div className="flex justify-between text-stone-400">
                <span>
                  {taxConfig.taxName || 'SST'} ({taxConfig.taxRatePercent}%)
                  {taxConfig.isTaxInclusive ? ' [Termasuk]' : ''}:
                </span>
                <span>
                  {taxConfig.isTaxInclusive
                    ? `(${formatCurrency(order.taxAmount)})`
                    : `+${formatCurrency(order.taxAmount)}`}
                </span>
              </div>
            )}

            {/* Total Grand */}
            <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-stone-700">
              <span>JUMLAH BESAR:</span>
              <span className="text-emerald-400 font-bold text-base">
                {formatCurrency(order.grandTotal)}
              </span>
            </div>

            <div className="flex justify-between text-stone-300 pt-1">
              <span>Tunai Diterima:</span>
              <span>{formatCurrency(order.cashTendered)}</span>
            </div>

            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Baki Pulangan:</span>
              <span>{formatCurrency(order.changeDue)}</span>
            </div>
          </div>

          {/* Operation Idempotency Stamp & Footer */}
          <div className="text-center pt-3 border-t border-dashed border-stone-800 space-y-1 text-[10px] text-stone-500 font-sans">
            <div className="flex items-center justify-center gap-1 text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Checkout Operation ID: {order.checkoutOperationId}</span>
            </div>
            <p>Terima kasih kerana mengunjungi {storeName}!</p>
            <p className="text-stone-600">Sila simpan resit ini sebagai bukti pembayaran.</p>
          </div>
        </div>

        {/* Modal Bottom Close */}
        <div className="p-3 border-t border-stone-800 bg-stone-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Selesai / Pesanan Baharu
          </button>
        </div>
      </div>
    </div>
  );
};
