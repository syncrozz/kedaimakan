/**
 * NiagaPOS - Retail Formatting Utilities
 * Part 01.5: Foundation Verification & Stabilization
 * 
 * Ensures robust display of currency, profit, and stock statuses.
 * Prevents glitchy strings like "+RM -6.00" on loss/negative gross profit.
 */

export const formatProfit = (amount: number, currency: string = 'RM'): string => {
  const fixed = Math.abs(amount).toFixed(2);
  if (amount > 0) return `+${currency} ${fixed}`;
  if (amount < 0) return `-${currency} ${fixed}`;
  return `${currency} 0.00`;
};

export const getProfitColorClass = (amount: number): string => {
  if (amount > 0) return 'text-emerald-700';
  if (amount < 0) return 'text-rose-700';
  return 'text-stone-700';
};

export const getStockStatusBadgeClass = (status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL'): string => {
  switch (status) {
    case 'OUT_OF_STOCK':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'LOW_STOCK':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'NORMAL':
      return 'bg-stone-100 text-stone-800 border-stone-200';
  }
};

export const formatCurrency = (amount: number, currency: string = 'RM'): string => {
  const isNegative = amount < 0;
  const absFormatted = Math.abs(amount).toFixed(2);
  return isNegative ? `-${currency} ${absFormatted}` : `${currency} ${absFormatted}`;
};

export const formatDateTime = (isoString: string): string => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
};

/**
 * Mengembalikan tarikh kalendar tempatan pengguna (format YYYY-MM-DD)
 * Mengelakkan pepijat UTC di mana tarikh terundur ke hari sebelumnya
 * (contoh: di Malaysia GMT+8 apabila dipanggil sebelum jam 8:00 pagi).
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Mengembalikan masa tempatan pengguna (format HH:mm)
 */
export const getLocalTimeString = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};


