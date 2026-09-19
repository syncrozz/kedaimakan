/**
 * NiagaPOS - Smart Form Standard Service
 * SYNCROZZ Engineering Standard (SES) v4.4 Locked
 *
 * "USER MASUKKAN DATA, SISTEM URUSKAN FORMAT."
 *
 * Applies smart normalization to existing fields:
 * - Person/Entity Name: UPPERCASE + trim + multiple spaces -> single space
 * - Phone Numbers: Malaysian live input masking (01X-XXXXXXX, 011-XXXXXXXX, etc.)
 * - Codes/SKUs: Uppercase alphanumeric trimming
 * - Currency/Numeric: Strict non-negative number parsing without float corruption
 */

export class SmartInputService {
  /**
   * Normalizes person or entity names:
   * UPPERCASE + trim + collapses multiple internal spaces into a single space.
   * Does NOT alter spelling, translate, shorten, or add/remove words.
   * Example: "nur aina" -> "NUR AINA", "  mohd   ali  " -> "MOHD ALI"
   */
  public static normalizeName(rawName: string): string {
    if (!rawName) return '';
    return rawName
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  /**
   * Formats a phone number as the user types or pastes.
   * Supports standard Malaysian formats:
   * e.g., 0145313756 -> 014-5313756
   * e.g., 01112345678 -> 011-12345678
   * e.g., 60145313756 -> 6014-5313756
   * Prevents double hyphens (014--5313756).
   */
  public static formatPhone(rawValue: string): string {
    if (!rawValue) return '';

    // Remove any character that is not a digit, except optional leading '+'
    const hasLeadingPlus = rawValue.startsWith('+');
    const digitsOnly = rawValue.replace(/\D/g, '');

    if (!digitsOnly) {
      return hasLeadingPlus ? '+' : '';
    }

    // If starts with 601 (e.g. 60145313756 or +60145313756)
    if (digitsOnly.startsWith('601')) {
      const prefix = digitsOnly.slice(0, 4); // 6014 or 6011
      const rest = digitsOnly.slice(4);
      const formatted = rest ? `${prefix}-${rest}` : prefix;
      return hasLeadingPlus ? `+${formatted}` : formatted;
    }

    // If starts with 011 (4-digit prefix e.g. 011-12345678)
    if (digitsOnly.startsWith('011')) {
      const prefix = digitsOnly.slice(0, 3); // 011
      const rest = digitsOnly.slice(3);
      return rest ? `${prefix}-${rest}` : prefix;
    }

    // If starts with 01 (e.g. 012, 013, 014, 016, 017, 018, 019)
    if (digitsOnly.startsWith('01') && digitsOnly.length >= 3) {
      const prefix = digitsOnly.slice(0, 3); // 014
      const rest = digitsOnly.slice(3);
      return rest ? `${prefix}-${rest}` : prefix;
    }

    // If starts with standard landline (e.g. 03, 04, 05, 06, 07, 08, 09)
    if (digitsOnly.startsWith('0') && digitsOnly.length >= 2) {
      const prefix = digitsOnly.slice(0, 2);
      const rest = digitsOnly.slice(2);
      return rest ? `${prefix}-${rest}` : prefix;
    }

    return digitsOnly;
  }

  /**
   * Alias for formatPhone to support standard normalization naming.
   */
  public static normalizePhone(rawValue: string): string {
    return this.formatPhone(rawValue);
  }

  /**
   * Normalizes codes (SKU, Supplier Code, Staff Code, Customer Code)
   * Trims whitespace and enforces uppercase.
   */
  public static normalizeCode(rawCode: string): string {
    if (!rawCode) return '';
    return rawCode.trim().toUpperCase();
  }

  /**
   * Validates and parses non-negative numeric input safely.
   */
  public static parseNumeric(value: string | number, fallback: number = 0): number {
    if (typeof value === 'number') {
      return isNaN(value) || value < 0 ? fallback : value;
    }
    if (!value || typeof value !== 'string') return fallback;
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || parsed < 0 ? fallback : parsed;
  }

  /**
   * Safely formats currency numbers to 2 decimal places.
   */
  public static roundToTwoDecimals(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
}
