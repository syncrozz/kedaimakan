import React, { useState } from 'react';
import { Printer, CheckCircle, Store as StoreIcon, ShieldCheck, Tag, Info } from 'lucide-react';
import { Sale, Store } from '../../types';
import { Modal } from '../common/Modal';
import { NIAGAPOS_ASSETS } from '../../constants/branding';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  store?: Store;
  isNewSaleSuccess?: boolean;
}

const DEFAULT_STORE_FALLBACK: Store = {
  id: 'store-default',
  name: 'NiagaPOS',
  code: 'STORE-1',
  currency: 'RM',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  store = DEFAULT_STORE_FALLBACK,
  isNewSaleSuccess = false,
}) => {
  const [showAuditDetails, setShowAuditDetails] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  const cashReceived = sale.cashReceived ?? sale.total;
  const change = sale.change ?? Math.max(0, cashReceived - sale.total);
  const marginPercentage =
    sale.total > 0 ? ((sale.grossProfit / sale.total) * 100).toFixed(1) : '0.0';

  return (
    <Modal
      id="pos-receipt-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={isNewSaleSuccess ? 'Transaction Completed' : 'Sales Transaction Receipt'}
      subtitle={`${sale.transactionNumber} • ${new Date(sale.dateTime).toLocaleString()}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Printable Receipt Paper Container */}
        <div
          id="receipt-print-area"
          className="bg-stone-50 p-5 sm:p-6 rounded-xl border border-stone-200 font-mono text-xs text-stone-900 shadow-inner space-y-4"
        >
          {/* Header Section */}
          <div className="text-center pb-3 border-b border-dashed border-stone-300">
            <div className="flex items-center justify-center gap-2 font-black text-lg text-stone-900 tracking-tight uppercase">
              <img
                src={NIAGAPOS_ASSETS.logoSvg}
                alt="NiagaPOS"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = NIAGAPOS_ASSETS.local.logoSvg;
                }}
                className="w-5 h-5 object-contain rounded-xs shrink-0"
              />
              <span>{store.name}</span>
            </div>
            {store.tagline && (
              <div className="text-[11px] text-stone-500 font-sans mt-0.5">{store.tagline}</div>
            )}
            {store.address && (
              <div className="text-[10px] text-stone-400 font-sans mt-0.5">{store.address}</div>
            )}
            {store.phone && (
              <div className="text-[10px] text-stone-400 font-sans">Tel: {store.phone}</div>
            )}

            <div className="mt-2 pt-2 border-t border-dotted border-stone-200 flex justify-between text-[10px] text-stone-600">
              <span>Receipt #{sale.transactionNumber}</span>
              <span>{new Date(sale.dateTime).toLocaleDateString()} {new Date(sale.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {(sale.customerNameSnapshot || sale.cashierNameSnapshot) && (
              <div className="mt-1 flex justify-between text-[10px] text-stone-600">
                {sale.customerNameSnapshot ? (
                  <span>Customer: <strong className="text-stone-800">{sale.customerNameSnapshot}</strong></span>
                ) : <span />}
                {sale.cashierNameSnapshot ? (
                  <span>Cashier: <strong className="text-stone-800">{sale.cashierNameSnapshot}</strong></span>
                ) : null}
              </div>
            )}
          </div>

          {/* Itemized Snapshot Table */}
          <div className="space-y-2 py-1">
            <div className="flex justify-between font-bold text-[10px] text-stone-400 uppercase tracking-wider pb-1 border-b border-stone-200">
              <span>Item & Qty</span>
              <span>Total</span>
            </div>

            <div className="divide-y divide-stone-200/60">
              {sale.items.map((item) => (
                <div key={item.id} className="py-2 flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900 leading-snug break-words">
                      {item.productNameSnapshot}
                    </div>
                    <div className="text-[10px] text-stone-500 font-mono flex items-center gap-2 mt-0.5">
                      {item.sku && <span className="text-stone-400">[{item.sku}]</span>}
                      <span>
                        {item.quantity} × {store.currency} {item.unitSellingPriceSnapshot.toFixed(2)}
                      </span>
                      {item.allocatedDiscount && item.allocatedDiscount > 0 ? (
                        <span className="text-rose-600">(-{store.currency} {item.allocatedDiscount.toFixed(2)})</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="font-bold text-stone-900 font-mono text-right shrink-0">
                    {store.currency} {item.lineTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="pt-2 border-t border-dashed border-stone-300 space-y-1.5 text-stone-700">
            <div className="flex justify-between text-xs">
              <span>Subtotal</span>
              <span className="font-bold">{store.currency} {sale.subtotal.toFixed(2)}</span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-xs text-rose-700">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Discount</span>
                </span>
                <span className="font-bold">-{store.currency} {sale.discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t-2 border-stone-900">
              <span>TOTAL</span>
              <span>{store.currency} {sale.total.toFixed(2)}</span>
            </div>

            {/* Payment & Change breakdown */}
            <div className="pt-2 border-t border-dotted border-stone-200 space-y-1 text-[11px] text-stone-600">
              <div className="flex justify-between">
                <span>Payment Method</span>
                <span className="font-bold text-stone-800">{sale.paymentMethod || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Received</span>
                <span className="font-bold text-stone-800">{store.currency} {cashReceived.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-stone-900 text-xs pt-1 border-t border-stone-200">
                <span>Change Returned</span>
                <span className="text-emerald-800">{store.currency} {change.toFixed(2)}</span>
              </div>
              {sale.pointsEarned ? (
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-dotted border-emerald-200">
                  <span>Loyalty Points Earned</span>
                  <span>+{sale.pointsEarned} pts</span>
                </div>
              ) : null}
            </div>

            {sale.notes && (
              <div className="pt-2 text-[10px] text-stone-500 italic border-t border-stone-200">
                Notes: {sale.notes}
              </div>
            )}
          </div>

          {/* Store Owner / Staff Gross Profit Audit Box */}
          {showAuditDetails && (
            <div className="mt-3 pt-3 border-t border-dashed border-stone-300 bg-white p-2.5 rounded-lg border border-stone-200 text-[10px] text-stone-600 space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-stone-800">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Gross Profit Snapshot</span>
                </span>
                <span className="text-emerald-700 font-bold">Margin: {marginPercentage}%</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Total Cost of Goods (COGS):</span>
                <span className="font-mono">{store.currency} {sale.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <span>Realized Gross Profit:</span>
                <span className="font-mono">{store.currency} {sale.grossProfit.toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-stone-400 pt-0.5 italic flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                <span>Inventory stock deducted and verified. Historical price & cost locked.</span>
              </div>
            </div>
          )}

          {/* Receipt Footer */}
          <div className="text-center pt-2 text-[10px] text-stone-400 border-t border-dotted border-stone-200 space-y-0.5">
            <p className="font-medium text-stone-600">{store.receiptFooter || `Thank you for shopping at ${store.name}!`}</p>
            <p className="text-[9px] text-stone-400">Please keep this receipt for reference.</p>
          </div>
        </div>

        {/* Modal Action Buttons (Hidden when printing) */}
        <div className="flex items-center justify-between pt-2 no-print">
          <button
            type="button"
            onClick={() => setShowAuditDetails(!showAuditDetails)}
            className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium transition"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showAuditDetails ? 'Hide' : 'Show'} Profit Audit</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="print-receipt-btn"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              id="next-customer-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isNewSaleSuccess ? 'New Sale / Next Customer' : 'Close Receipt'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
