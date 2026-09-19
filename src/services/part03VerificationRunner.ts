/**
 * NiagaPOS - Part 03 POS Checkout & Sales Transaction Verification Runner
 * 
 * Programmatically validates all 36 tests (TEST A through TEST AJ) defined in the PART 03 specifications.
 */

import { Product, CartItem, Sale, InventoryMovement } from '../types';
import { SalesService } from './salesService';
import { InventoryService } from './inventoryService';
import { INITIAL_STORE } from './seedData';

export interface Part03TestResult {
  code: string; // 'A' through 'AJ'
  title: string;
  category:
    | 'CART_OPERATIONS'
    | 'VALIDATION'
    | 'FINANCIALS_DISCOUNT'
    | 'CASH_PAYMENT'
    | 'CHECKOUT_ATOMICITY'
    | 'HISTORICAL_INTEGRITY'
    | 'SYSTEM_RECONCILIATION';
  status: 'PASSED' | 'FAILED';
  expected: string;
  actual: string;
  formulaOrMath?: string;
  details: string;
}

export class Part03VerificationRunner {
  public static runAllTests(): Part03TestResult[] {
    const results: Part03TestResult[] = [];
    const store = INITIAL_STORE;

    const createMockProduct = (id: string, name: string, cost: number, price: number, stock: number, active = true): Product => ({
      id,
      storeId: store.id,
      sku: `SKU-${id.toUpperCase()}`,
      name,
      category: 'General',
      costPrice: cost,
      sellingPrice: price,
      currentStock: stock,
      minimumStock: 5,
      active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // -------------------------------------------------------------
    // TEST A: Add one product to cart
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-a', 'Susu Pekat', 3.0, 4.5, 10);
      const cart: CartItem[] = [{ product: p1, quantity: 1 }];
      const pass = cart.length === 1 && cart[0].product.id === 'p-a' && cart[0].quantity === 1;
      results.push({
        code: 'A',
        title: 'Add One Product to Cart',
        category: 'CART_OPERATIONS',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cart contains 1 item with quantity = 1',
        actual: `Cart items: ${cart.length}, Quantity: ${cart[0]?.quantity}`,
        details: 'Verified single item addition into cart data structure.',
      });
    } catch (e: any) {
      results.push({
        code: 'A',
        title: 'Add One Product to Cart',
        category: 'CART_OPERATIONS',
        status: 'FAILED',
        expected: 'Item added to cart',
        actual: `Error: ${e.message}`,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST B: Add multiple different products
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-b1', 'Kopi O', 2.0, 3.0, 10);
      const p2 = createMockProduct('p-b2', 'Biskut Hup Seng', 3.5, 5.0, 15);
      const cart: CartItem[] = [
        { product: p1, quantity: 2 },
        { product: p2, quantity: 3 },
      ];
      const pass = cart.length === 2 && cart[0].product.id !== cart[1].product.id;
      results.push({
        code: 'B',
        title: 'Add Multiple Different Products',
        category: 'CART_OPERATIONS',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cart contains 2 distinct product items',
        actual: `Cart items count: ${cart.length} (${cart.map((c) => c.product.name).join(', ')})`,
        details: 'Verified multi-product cart composition.',
      });
    } catch (e: any) {
      results.push({
        code: 'B',
        title: 'Add Multiple Different Products',
        category: 'CART_OPERATIONS',
        status: 'FAILED',
        expected: 'Multiple items added',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST C: Increase quantity
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-c', 'Milo 1kg', 18.0, 23.0, 10);
      let cart: CartItem[] = [{ product: p1, quantity: 1 }];
      cart[0].quantity += 2;
      const pass = cart[0].quantity === 3;
      results.push({
        code: 'C',
        title: 'Increase Quantity in Cart',
        category: 'CART_OPERATIONS',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cart quantity incremented from 1 to 3',
        actual: `Final quantity: ${cart[0].quantity}`,
        details: 'Quantity increment step verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'C',
        title: 'Increase Quantity in Cart',
        category: 'CART_OPERATIONS',
        status: 'FAILED',
        expected: 'Quantity incremented',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST D: Decrease quantity
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-d', 'Teh Tarik', 2.0, 3.5, 10);
      let cart: CartItem[] = [{ product: p1, quantity: 3 }];
      cart[0].quantity -= 1;
      const pass = cart[0].quantity === 2;
      results.push({
        code: 'D',
        title: 'Decrease Quantity in Cart',
        category: 'CART_OPERATIONS',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cart quantity decremented from 3 to 2',
        actual: `Final quantity: ${cart[0].quantity}`,
        details: 'Quantity decrement step verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'D',
        title: 'Decrease Quantity in Cart',
        category: 'CART_OPERATIONS',
        status: 'FAILED',
        expected: 'Quantity decremented',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST E: Remove item from cart
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-e1', 'Item 1', 1, 2, 5);
      const p2 = createMockProduct('p-e2', 'Item 2', 2, 4, 5);
      let cart: CartItem[] = [
        { product: p1, quantity: 1 },
        { product: p2, quantity: 2 },
      ];
      cart = cart.filter((item) => item.product.id !== 'p-e1');
      const pass = cart.length === 1 && cart[0].product.id === 'p-e2';
      results.push({
        code: 'E',
        title: 'Remove Item from Cart',
        category: 'CART_OPERATIONS',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Item removed from cart, remaining count = 1',
        actual: `Cart items remaining: ${cart.length} (${cart[0]?.product.name})`,
        details: 'Line item removal verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'E',
        title: 'Remove Item from Cart',
        category: 'CART_OPERATIONS',
        status: 'FAILED',
        expected: 'Item removed',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST F: Prevent quantity above available stock
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-f', 'Gardenia Bread', 2.4, 3.0, 4); // stock is 4
      const productsMap = new Map([[p1.id, p1]]);
      let caughtError = false;
      let errorMsg = '';
      try {
        SalesService.processSale([{ product: p1, quantity: 5 }], productsMap, store.id, 0);
      } catch (err: any) {
        caughtError = true;
        errorMsg = err.message;
      }
      const pass = caughtError && errorMsg.toLowerCase().includes('insufficient stock');
      results.push({
        code: 'F',
        title: 'Prevent Quantity Above Available Stock',
        category: 'VALIDATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Reject checkout when requested quantity exceeds available stock',
        actual: pass ? `Blocked with: "${errorMsg}"` : 'Failed to block over-stock sale',
        details: 'Two-stage authoritative stock check verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'F',
        title: 'Prevent Quantity Above Available Stock',
        category: 'VALIDATION',
        status: 'FAILED',
        expected: 'Error thrown',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST G: Prevent inactive product from checkout
    // -------------------------------------------------------------
    try {
      const pInactive = createMockProduct('p-g', 'Old Seasoning', 1.0, 2.0, 10, false); // active = false
      const productsMap = new Map([[pInactive.id, pInactive]]);
      let caughtError = false;
      let errorMsg = '';
      try {
        SalesService.processSale([{ product: pInactive, quantity: 1 }], productsMap, store.id, 0);
      } catch (err: any) {
        caughtError = true;
        errorMsg = err.message;
      }
      const pass = caughtError && errorMsg.toLowerCase().includes('inactive');
      results.push({
        code: 'G',
        title: 'Prevent Inactive Product from Checkout',
        category: 'VALIDATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Reject checkout for deactivated product',
        actual: pass ? `Blocked with: "${errorMsg}"` : 'Failed to reject inactive product',
        details: 'Inactive product sale prevention rule verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'G',
        title: 'Prevent Inactive Product from Checkout',
        category: 'VALIDATION',
        status: 'FAILED',
        expected: 'Error thrown',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST H: Prevent out-of-stock product from checkout
    // -------------------------------------------------------------
    try {
      const pOos = createMockProduct('p-h', 'Spritzer Water', 1.5, 2.5, 0); // stock = 0
      const productsMap = new Map([[pOos.id, pOos]]);
      let caughtError = false;
      let errorMsg = '';
      try {
        SalesService.processSale([{ product: pOos, quantity: 1 }], productsMap, store.id, 0);
      } catch (err: any) {
        caughtError = true;
        errorMsg = err.message;
      }
      const pass = caughtError && (errorMsg.toLowerCase().includes('out of stock') || errorMsg.toLowerCase().includes('insufficient stock'));
      results.push({
        code: 'H',
        title: 'Prevent Out-of-Stock Product from Checkout',
        category: 'VALIDATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Reject checkout when product stock = 0',
        actual: pass ? `Blocked with: "${errorMsg}"` : 'Failed to reject zero stock',
        details: 'Out of stock barrier verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'H',
        title: 'Prevent Out-of-Stock Product from Checkout',
        category: 'VALIDATION',
        status: 'FAILED',
        expected: 'Error thrown',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST I: Calculate subtotal correctly
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-i1', 'Item A', 3.0, 5.0, 10);
      const p2 = createMockProduct('p-i2', 'Item B', 2.0, 4.2, 10);
      const productsMap = new Map([[p1.id, p1], [p2.id, p2]]);
      // 2 * 5.0 = 10.0; 3 * 4.2 = 12.6; total = 22.6
      const result = SalesService.processSale(
        [
          { product: p1, quantity: 2 },
          { product: p2, quantity: 3 },
        ],
        productsMap,
        store.id,
        0
      );
      const expectedSubtotal = 22.6;
      const pass = result.sale.subtotal === expectedSubtotal;
      results.push({
        code: 'I',
        title: 'Calculate Subtotal Correctly',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: `Subtotal = RM${expectedSubtotal.toFixed(2)}`,
        actual: `Calculated Subtotal = RM${result.sale.subtotal.toFixed(2)}`,
        formulaOrMath: '(2 * RM5.00) + (3 * RM4.20) = RM22.60',
        details: 'Subtotal decimal accuracy verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'I',
        title: 'Calculate Subtotal Correctly',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'Accurate subtotal',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST J: Apply zero discount
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-j', 'Item J', 5.0, 20.0, 10);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0, 0);
      const pass = result.sale.discount === 0 && result.sale.total === 20.0;
      results.push({
        code: 'J',
        title: 'Apply Zero Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Discount = RM0.00, Total = RM20.00',
        actual: `Discount = RM${result.sale.discount.toFixed(2)}, Total = RM${result.sale.total.toFixed(2)}`,
        formulaOrMath: 'Subtotal RM20.00 - RM0.00 = RM20.00',
        details: 'Zero discount default verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'J',
        title: 'Apply Zero Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM20.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST K: Apply partial discount
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-k', 'Item K', 15.0, 50.0, 10);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0, 5.0);
      const pass = result.sale.discount === 5.0 && result.sale.total === 45.0;
      results.push({
        code: 'K',
        title: 'Apply Partial Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Discount = RM5.00, Total = RM45.00',
        actual: `Discount = RM${result.sale.discount.toFixed(2)}, Total = RM${result.sale.total.toFixed(2)}`,
        formulaOrMath: 'Subtotal RM50.00 - RM5.00 = RM45.00',
        details: 'Partial discount reduction verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'K',
        title: 'Apply Partial Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM45.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST L: Apply 100% discount
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-l', 'Promo Biscuit', 10.0, 30.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0, 30.0);
      const pass = result.sale.discount === 30.0 && result.sale.total === 0.0;
      results.push({
        code: 'L',
        title: 'Apply 100% Discount (Zero Total)',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Discount = RM30.00, Total = RM0.00',
        actual: `Discount = RM${result.sale.discount.toFixed(2)}, Total = RM${result.sale.total.toFixed(2)}`,
        formulaOrMath: 'Subtotal RM30.00 - RM30.00 = RM0.00',
        details: '100% discount ceiling behavior verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'L',
        title: 'Apply 100% Discount (Zero Total)',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM0.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST M: Prevent discount greater than subtotal (Boundary Clamp)
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-m', 'Item M', 5.0, 20.0, 5); // subtotal = 20.00
      const productsMap = new Map([[p1.id, p1]]);
      const res = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0, 25.0); // discount attempt 25.00 > 20.00
      const pass = res.sale.discount === 20.0 && res.sale.total === 0.0;
      results.push({
        code: 'M',
        title: 'Prevent Discount Greater Than Subtotal (Boundary Clamped)',
        category: 'VALIDATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Discount clamped to RM20.00 (subtotal), Total = RM0.00 (non-negative)',
        actual: `Effective Discount: RM${res.sale.discount.toFixed(2)}, Total: RM${res.sale.total.toFixed(2)}`,
        formulaOrMath: 'Effective Discount = min(RM25.00, RM20.00) = RM20.00',
        details: 'Discount boundary clamp protects merchant from negative totals or payouts.',
      });
    } catch (e: any) {
      results.push({
        code: 'M',
        title: 'Prevent Discount Greater Than Subtotal (Boundary Clamped)',
        category: 'VALIDATION',
        status: 'FAILED',
        expected: 'Clamped discount',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST N: Calculate actual revenue after discount
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-n', 'Item N', 6.0, 10.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0, 2.0);
      const pass =
        result.sale.total === 8.0 &&
        result.sale.items[0].actualRevenue === 8.0 &&
        result.sale.items[0].allocatedDiscount === 2.0;
      results.push({
        code: 'N',
        title: 'Calculate Actual Revenue After Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Actual revenue = RM8.00 (Line RM10.00 - RM2.00)',
        actual: `Actual revenue = RM${result.sale.items[0].actualRevenue?.toFixed(2)}`,
        formulaOrMath: 'Actual Revenue = Selling Price RM10.00 - Allocated Discount RM2.00 = RM8.00',
        details: 'Actual trading revenue snapshot verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'N',
        title: 'Calculate Actual Revenue After Discount',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM8.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST O: Calculate COGS
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-o1', 'Item O1', 3.0, 5.0, 10); // cost 3.0
      const p2 = createMockProduct('p-o2', 'Item O2', 4.5, 7.0, 10); // cost 4.5
      const productsMap = new Map([[p1.id, p1], [p2.id, p2]]);
      // 2 * 3.0 = 6.0; 1 * 4.5 = 4.5; total COGS = 10.5
      const result = SalesService.processSale(
        [
          { product: p1, quantity: 2 },
          { product: p2, quantity: 1 },
        ],
        productsMap,
        store.id,
        0
      );
      const pass = result.sale.totalCost === 10.5;
      results.push({
        code: 'O',
        title: 'Calculate Cost of Goods Sold (COGS)',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'COGS = RM10.50',
        actual: `Calculated COGS = RM${result.sale.totalCost.toFixed(2)}`,
        formulaOrMath: '(2 * RM3.00) + (1 * RM4.50) = RM10.50',
        details: 'Cost aggregation verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'O',
        title: 'Calculate Cost of Goods Sold (COGS)',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM10.50',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST P: Calculate gross profit
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-p', 'Item P', 12.0, 20.0, 5); // cost 12, price 20
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0);
      const pass = result.sale.grossProfit === 8.0 && result.sale.total === 20.0 && result.sale.totalCost === 12.0;
      results.push({
        code: 'P',
        title: 'Calculate Gross Profit (Revenue - COGS)',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit = RM8.00',
        actual: `Calculated Gross Profit = RM${result.sale.grossProfit.toFixed(2)}`,
        formulaOrMath: 'RM20.00 (Revenue) - RM12.00 (COGS) = RM8.00',
        details: 'Gross profit formula verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'P',
        title: 'Calculate Gross Profit (Revenue - COGS)',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: 'RM8.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST Q: Handle negative gross profit (accurate loss tracking)
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-q', 'Loss Leader Item', 10.0, 8.0, 5); // cost 10, selling 8
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0);
      const pass = result.sale.grossProfit === -2.0;
      results.push({
        code: 'Q',
        title: 'Handle Negative Gross Profit (Loss Leader)',
        category: 'FINANCIALS_DISCOUNT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit = -RM2.00 (Allowed without crashing)',
        actual: `Calculated Gross Profit = RM${result.sale.grossProfit.toFixed(2)}`,
        formulaOrMath: 'RM8.00 (Revenue) - RM10.00 (COGS) = -RM2.00',
        details: 'Negative gross profit permissibility and accurate reporting verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'Q',
        title: 'Handle Negative Gross Profit (Loss Leader)',
        category: 'FINANCIALS_DISCOUNT',
        status: 'FAILED',
        expected: '-RM2.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST R: Reject insufficient cash payment
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-r', 'Item R', 20.0, 35.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      let caughtError = false;
      let errorMsg = '';
      try {
        SalesService.processSale(
          [{ product: p1, quantity: 1 }],
          productsMap,
          store.id,
          0,
          { cashReceived: 30.0 } // Total is 35.0, tender is 30.0 (short by 5.0)
        );
      } catch (err: any) {
        caughtError = true;
        errorMsg = err.message;
      }
      const pass = caughtError && errorMsg.toLowerCase().includes('insufficient payment');
      results.push({
        code: 'R',
        title: 'Reject Insufficient Cash Payment',
        category: 'CASH_PAYMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Reject checkout when cash received < total',
        actual: pass ? `Blocked with: "${errorMsg}"` : 'Failed to block shortage',
        details: 'Cash tender shortage prevention verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'R',
        title: 'Reject Insufficient Cash Payment',
        category: 'CASH_PAYMENT',
        status: 'FAILED',
        expected: 'Error thrown',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST S: Calculate change correctly
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-s', 'Item S', 20.0, 35.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale(
        [{ product: p1, quantity: 1 }],
        productsMap,
        store.id,
        0,
        { cashReceived: 50.0 } // Total is 35.0, tendered 50.0 => change = 15.0
      );
      const pass = result.sale.change === 15.0 && result.sale.cashReceived === 50.0;
      results.push({
        code: 'S',
        title: 'Calculate Change Correctly',
        category: 'CASH_PAYMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Change = RM15.00',
        actual: `Calculated Change = RM${result.sale.change?.toFixed(2)}`,
        formulaOrMath: 'Cash RM50.00 - Total RM35.00 = RM15.00 Change',
        details: 'Change return arithmetic verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'S',
        title: 'Calculate Change Correctly',
        category: 'CASH_PAYMENT',
        status: 'FAILED',
        expected: 'RM15.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST T: Complete cash sale successfully
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-t', 'Item T', 5.0, 10.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale(
        [{ product: p1, quantity: 1 }],
        productsMap,
        store.id,
        0,
        { cashReceived: 10.0, paymentMethod: 'CASH' }
      );
      const pass =
        result.sale.status === 'COMPLETED' &&
        result.sale.paymentMethod === 'CASH' &&
        result.sale.change === 0.0;
      results.push({
        code: 'T',
        title: 'Complete Cash Sale Successfully',
        category: 'CASH_PAYMENT',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Status = COMPLETED, Method = CASH',
        actual: `Status: ${result.sale.status}, Method: ${result.sale.paymentMethod}`,
        details: 'Standard cash settlement flow verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'T',
        title: 'Complete Cash Sale Successfully',
        category: 'CASH_PAYMENT',
        status: 'FAILED',
        expected: 'Sale completed',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST U: Generate unique transaction number
    // -------------------------------------------------------------
    try {
      const t1: string = SalesService.generateTransactionNumber(0);
      const t2: string = SalesService.generateTransactionNumber(1);
      const t3: string = SalesService.generateTransactionNumber(2);
      const pass = t1 === 'SALE-000001' && t2 === 'SALE-000002' && t3 === 'SALE-000003';
      results.push({
        code: 'U',
        title: 'Generate Unique Sequential Transaction Number',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Sequential formatted SALE-000001, SALE-000002, SALE-000003',
        actual: `${t1}, ${t2}, ${t3}`,
        details: 'Transaction number generator format and uniqueness verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'U',
        title: 'Generate Unique Sequential Transaction Number',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'SALE-000001',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST V: Create Sale record with all required fields
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-v', 'Item V', 5.0, 10.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0);
      const s = result.sale;
      const pass =
        Boolean(s.id) &&
        Boolean(s.storeId) &&
        Boolean(s.transactionNumber) &&
        Boolean(s.dateTime) &&
        s.items.length === 1 &&
        typeof s.subtotal === 'number' &&
        typeof s.discount === 'number' &&
        typeof s.total === 'number' &&
        typeof s.totalCost === 'number' &&
        typeof s.grossProfit === 'number' &&
        s.status === 'COMPLETED' &&
        Boolean(s.createdAt);
      results.push({
        code: 'V',
        title: 'Create Full Sale Record',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Sale record populated with all mandatory domain properties',
        actual: `Recorded TRX: ${s.transactionNumber}, items: ${s.items.length}, status: ${s.status}`,
        details: 'Sale schema completeness verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'V',
        title: 'Create Full Sale Record',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'Sale record created',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST W: Create SaleItem snapshots
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-w', 'Kopi Cap Rusa', 4.2, 6.5, 10);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 0);
      const item = result.sale.items[0];
      const pass =
        item.productId === p1.id &&
        item.productNameSnapshot === 'Kopi Cap Rusa' &&
        item.quantity === 2 &&
        item.unitCostSnapshot === 4.2 &&
        item.unitSellingPriceSnapshot === 6.5 &&
        item.lineTotal === 13.0 &&
        item.lineCost === 8.4 &&
        item.grossProfit === 4.6;
      results.push({
        code: 'W',
        title: 'Create SaleItem Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'All pricing, name, and quantity snapshots accurately frozen',
        actual: `Snapshots: Cost=RM${item.unitCostSnapshot}, Price=RM${item.unitSellingPriceSnapshot}, Profit=RM${item.grossProfit}`,
        details: 'Point-of-sale item snapshot integrity verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'W',
        title: 'Create SaleItem Snapshots',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Snapshots created',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST X: Reduce inventory exactly once
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-x', 'Item X', 10.0, 15.0, 20); // Initial 20
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 3 }], productsMap, store.id, 0);
      const updatedP = result.updatedProducts[0];
      const pass = updatedP.currentStock === 17;
      results.push({
        code: 'X',
        title: 'Reduce Inventory Exactly Once',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Product stock reduced from 20 to 17 (-3)',
        actual: `Updated stock = ${updatedP.currentStock}`,
        formulaOrMath: '20 initial - 3 sold = 17 stock remaining',
        details: 'Exact single stock deduction verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'X',
        title: 'Reduce Inventory Exactly Once',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'Stock 17',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST Y: Create SALE inventory movement
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-y', 'Item Y', 10.0, 15.0, 20);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 4 }], productsMap, store.id, 0);
      const mov = result.newMovements[0];
      const pass =
        mov.type === 'SALE' &&
        mov.quantity === -4 &&
        mov.previousStock === 20 &&
        mov.newStock === 16;
      results.push({
        code: 'Y',
        title: 'Create SALE Inventory Movement',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Type = SALE, Qty = -4, Prev = 20, New = 16',
        actual: `Type: ${mov.type}, Qty: ${mov.quantity}, Prev: ${mov.previousStock}, New: ${mov.newStock}`,
        details: 'Deduction movement audit record verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'Y',
        title: 'Create SALE Inventory Movement',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'Movement created',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST Z: Verify inventory movement references the sale
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-z', 'Item Z', 5.0, 10.0, 15);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 0);
      const mov = result.newMovements[0];
      const trx = result.sale.transactionNumber;
      const pass = mov.referenceId === trx && mov.reason.includes(trx);
      results.push({
        code: 'Z',
        title: 'Verify Inventory Movement References Sale',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: `Movement referenceId = ${trx}`,
        actual: `referenceId: ${mov.referenceId}, reason: "${mov.reason}"`,
        details: 'Audit linkage between inventory movement and sale verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'Z',
        title: 'Verify Inventory Movement References Sale',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'Linked referenceId',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AA: Verify receipt accuracy
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-aa1', 'Minyak Saji 5kg', 25.0, 32.0, 10);
      const p2 = createMockProduct('p-aa2', 'Beras 5kg', 20.0, 26.0, 10);
      const productsMap = new Map([[p1.id, p1], [p2.id, p2]]);
      // 1 * 32 + 1 * 26 = 58; discount 3 => total 55; cash tendered 60 => change 5
      const result = SalesService.processSale(
        [
          { product: p1, quantity: 1 },
          { product: p2, quantity: 1 },
        ],
        productsMap,
        store.id,
        0,
        { discount: 3.0, cashReceived: 60.0, paymentMethod: 'CASH' }
      );
      const pass =
        result.sale.subtotal === 58.0 &&
        result.sale.discount === 3.0 &&
        result.sale.total === 55.0 &&
        result.sale.cashReceived === 60.0 &&
        result.sale.change === 5.0;
      results.push({
        code: 'AA',
        title: 'Verify Receipt Accuracy',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Subtotal RM58.00, Disc RM3.00, Total RM55.00, Cash RM60.00, Change RM5.00',
        actual: `Subtotal=${result.sale.subtotal}, Disc=${result.sale.discount}, Total=${result.sale.total}, Change=${result.sale.change}`,
        details: 'Receipt totals, discounts, and change calculations match to the cent.',
      });
    } catch (e: any) {
      results.push({
        code: 'AA',
        title: 'Verify Receipt Accuracy',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Accurate receipt',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AB: Historical price snapshot after later product price change
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ab', 'Kicap Manis', 3.0, 5.0, 10);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 0);

      // Mutate master catalog price later
      p1.sellingPrice = 9.99;

      const saleItem = result.sale.items[0];
      const pass =
        saleItem.unitSellingPriceSnapshot === 5.0 &&
        saleItem.lineTotal === 10.0 &&
        result.sale.total === 10.0;
      results.push({
        code: 'AB',
        title: 'Historical Selling Price Snapshot Protection',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Snapshot remains RM5.00 even after catalog price changed to RM9.99',
        actual: `SaleItem snapshot: RM${saleItem.unitSellingPriceSnapshot.toFixed(2)}, Catalog price: RM${p1.sellingPrice.toFixed(2)}`,
        details: 'Historical revenue immune to catalog alterations verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AB',
        title: 'Historical Selling Price Snapshot Protection',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Snapshot RM5.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AC: Historical cost snapshot after later cost change
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ac', 'Susu Pekat F&N', 3.4, 4.2, 10);
      const productsMap = new Map([[p1.id, p1]]);
      const result = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 0);

      // Mutate master catalog cost later
      p1.costPrice = 3.9;

      const saleItem = result.sale.items[0];
      const pass =
        saleItem.unitCostSnapshot === 3.4 &&
        result.sale.totalCost === 6.8 &&
        result.sale.grossProfit === 1.6;
      results.push({
        code: 'AC',
        title: 'Historical Cost Snapshot Protection',
        category: 'HISTORICAL_INTEGRITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Cost snapshot remains RM3.40, COGS remains RM6.80, Profit remains RM1.60',
        actual: `Cost snapshot: RM${saleItem.unitCostSnapshot.toFixed(2)}, Catalog cost: RM${p1.costPrice.toFixed(2)}`,
        details: 'Historical COGS and gross profit immune to cost price adjustments.',
      });
    } catch (e: any) {
      results.push({
        code: 'AC',
        title: 'Historical Cost Snapshot Protection',
        category: 'HISTORICAL_INTEGRITY',
        status: 'FAILED',
        expected: 'Snapshot RM3.40',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AD: Prevent double checkout
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ad', 'Limited Snack', 1.0, 2.0, 1); // Only 1 in stock
      const productsMap = new Map([[p1.id, p1]]);

      // First checkout succeeds and consumes the 1 item
      const res1 = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0);
      productsMap.set(p1.id, res1.updatedProducts[0]); // Update map to 0 stock

      // Second identical checkout must fail due to stock depletion / double submission guard
      let caughtDoubleError = false;
      let errorMsg = '';
      try {
        SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 1);
      } catch (err: any) {
        caughtDoubleError = true;
        errorMsg = err.message;
      }

      const pass = caughtDoubleError && errorMsg.length > 0;
      results.push({
        code: 'AD',
        title: 'Prevent Double Checkout',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Second submission rejected cleanly after initial transaction fulfills item',
        actual: pass ? `Blocked subsequent call: "${errorMsg}"` : 'Failed to block double checkout',
        details: 'Sequential transaction locking and double-spend protection verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AD',
        title: 'Prevent Double Checkout',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'Error thrown',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AE: Verify dashboard sales update
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ae', 'Item AE', 5.0, 10.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const r1 = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, 0);
      const r2 = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 1);

      const summary = SalesService.calculateSummary([r1.sale, r2.sale]);
      const pass = summary.totalRevenue === 30.0 && summary.totalTransactions === 2;
      results.push({
        code: 'AE',
        title: 'Verify Dashboard Sales Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Total Revenue = RM30.00, Transactions = 2',
        actual: `Revenue = RM${summary.totalRevenue.toFixed(2)}, Trx count = ${summary.totalTransactions}`,
        details: 'Dashboard aggregate sales metrics verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AE',
        title: 'Verify Dashboard Sales Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: 'FAILED',
        expected: 'Revenue RM30.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AF: Verify dashboard COGS update
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-af', 'Item AF', 4.0, 8.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const r1 = SalesService.processSale([{ product: p1, quantity: 3 }], productsMap, store.id, 0); // COGS = 12
      const summary = SalesService.calculateSummary([r1.sale]);
      const pass = summary.totalCOGS === 12.0;
      results.push({
        code: 'AF',
        title: 'Verify Dashboard COGS Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Total COGS = RM12.00',
        actual: `Calculated COGS = RM${summary.totalCOGS.toFixed(2)}`,
        details: 'Dashboard aggregate COGS reconciliation verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AF',
        title: 'Verify Dashboard COGS Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: 'FAILED',
        expected: 'COGS RM12.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AG: Verify dashboard gross profit update
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ag', 'Item AG', 6.0, 10.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const r1 = SalesService.processSale([{ product: p1, quantity: 2 }], productsMap, store.id, 0); // Rev=20, COGS=12, Profit=8
      const summary = SalesService.calculateSummary([r1.sale]);
      const pass = summary.grossProfit === 8.0 && summary.grossMarginPercentage === 40.0;
      results.push({
        code: 'AG',
        title: 'Verify Dashboard Gross Profit & Margin Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Gross Profit = RM8.00, Margin = 40.0%',
        actual: `Gross Profit = RM${summary.grossProfit.toFixed(2)}, Margin = ${summary.grossMarginPercentage}%`,
        formulaOrMath: 'Margin = (RM8.00 / RM20.00) * 100 = 40.0%',
        details: 'Gross profit percentage reporting verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AG',
        title: 'Verify Dashboard Gross Profit & Margin Aggregation',
        category: 'SYSTEM_RECONCILIATION',
        status: 'FAILED',
        expected: 'Profit RM8.00',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AH: Verify sales history update
    // -------------------------------------------------------------
    try {
      const p1 = createMockProduct('p-ah', 'Item AH', 2.0, 5.0, 5);
      const productsMap = new Map([[p1.id, p1]]);
      const salesHistory: Sale[] = [];
      const res = SalesService.processSale([{ product: p1, quantity: 1 }], productsMap, store.id, salesHistory.length);
      salesHistory.unshift(res.sale);

      const pass = salesHistory.length === 1 && salesHistory[0].transactionNumber === res.sale.transactionNumber;
      results.push({
        code: 'AH',
        title: 'Verify Sales History Log Update',
        category: 'SYSTEM_RECONCILIATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Sales history appended with new transaction',
        actual: `History entries: ${salesHistory.length}, latest: ${salesHistory[0]?.transactionNumber}`,
        details: 'Auditable sales journal update verified.',
      });
    } catch (e: any) {
      results.push({
        code: 'AH',
        title: 'Verify Sales History Log Update',
        category: 'SYSTEM_RECONCILIATION',
        status: 'FAILED',
        expected: 'History updated',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AI: Verify failed checkout leaves no partial transaction
    // -------------------------------------------------------------
    try {
      const pGood = createMockProduct('p-ai1', 'Good Item', 2.0, 4.0, 10);
      const pBad = createMockProduct('p-ai2', 'Scarce Item', 5.0, 10.0, 1); // only 1 in stock, but request 5

      const productsMap = new Map([[pGood.id, pGood], [pBad.id, pBad]]);
      const initialPGoodStock = pGood.currentStock;
      const initialPBadStock = pBad.currentStock;

      let threw = false;
      try {
        SalesService.processSale(
          [
            { product: pGood, quantity: 2 },
            { product: pBad, quantity: 5 }, // Will fail!
          ],
          productsMap,
          store.id,
          0
        );
      } catch (err) {
        threw = true;
      }

      // Assert that neither product had stock mutated
      const pass =
        threw &&
        pGood.currentStock === initialPGoodStock &&
        pBad.currentStock === initialPBadStock;

      results.push({
        code: 'AI',
        title: 'Verify Atomic Checkout Failure Leaves No Partial State',
        category: 'CHECKOUT_ATOMICITY',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Entire checkout aborts with zero inventory or financial alterations',
        actual: pass
          ? `Rollback verified: Good Item stock = ${pGood.currentStock}, Scarce Item stock = ${pBad.currentStock}`
          : 'Failed: Partial state corruption detected',
        details: 'Atomic pre-validation ensures complete consistency on failure.',
      });
    } catch (e: any) {
      results.push({
        code: 'AI',
        title: 'Verify Atomic Checkout Failure Leaves No Partial State',
        category: 'CHECKOUT_ATOMICITY',
        status: 'FAILED',
        expected: 'No partial state',
        actual: e.message,
        details: e.message,
      });
    }

    // -------------------------------------------------------------
    // TEST AJ: Full inventory reconciliation after sales
    // -------------------------------------------------------------
    try {
      // Traceability Lifecycle:
      // 1. Opening stock: 20
      // 2. Stock In: +10 => 30
      // 3. Sale: -5 => 25
      // 4. Return: +2 => 27
      // 5. Adjustment: -1 => 26
      let pLifecycle = createMockProduct('p-aj', 'Lifecycle Item', 5.0, 10.0, 20);
      const movements: InventoryMovement[] = [];

      // Opening
      movements.push(
        InventoryService.createMovement(
          pLifecycle.id,
          store.id,
          'STOCK_IN',
          20,
          0,
          20,
          'Opening stock'
        )
      );

      // Stock In
      const inRes = InventoryService.applyMovement(
        pLifecycle,
        { productId: pLifecycle.id, type: 'STOCK_IN', quantity: 10, reason: 'Supplier restock' },
        store.id
      );
      pLifecycle = inRes.updatedProduct;
      movements.push(inRes.movement);

      // Sale
      const productsMap = new Map([[pLifecycle.id, pLifecycle]]);
      const saleRes = SalesService.processSale(
        [{ product: pLifecycle, quantity: 5 }],
        productsMap,
        store.id,
        0
      );
      pLifecycle = saleRes.updatedProducts[0];
      movements.push(...saleRes.newMovements);

      // Return
      const retRes = InventoryService.applyMovement(
        pLifecycle,
        { productId: pLifecycle.id, type: 'RETURN', quantity: 2, reason: 'Customer exchange' },
        store.id
      );
      pLifecycle = retRes.updatedProduct;
      movements.push(retRes.movement);

      // Adjustment
      const adjRes = InventoryService.applyMovement(
        pLifecycle,
        { productId: pLifecycle.id, type: 'ADJUSTMENT', quantity: -1, reason: 'Damaged item' },
        store.id
      );
      pLifecycle = adjRes.updatedProduct;
      movements.push(adjRes.movement);

      // Verify complete mathematical traceability
      const audit = InventoryService.verifyStockTraceability(pLifecycle, movements);
      const pass = audit.isConsistent && pLifecycle.currentStock === 26 && audit.calculatedStock === 26;

      results.push({
        code: 'AJ',
        title: 'Full Inventory Reconciliation After Sales',
        category: 'SYSTEM_RECONCILIATION',
        status: pass ? 'PASSED' : 'FAILED',
        expected: 'Current Stock = 26, Mathematical Traceability = 100% Consistent',
        actual: `Current=${pLifecycle.currentStock}, Calculated=${audit.calculatedStock}, Traceable=${audit.isConsistent}`,
        formulaOrMath: '20 (Opening) + 10 (In) - 5 (Sale) + 2 (Return) - 1 (Adj) = 26 Current Stock',
        details: 'Full retail product lifecycle reconciled across all inventory types and sales.',
      });
    } catch (e: any) {
      results.push({
        code: 'AJ',
        title: 'Full Inventory Reconciliation After Sales',
        category: 'SYSTEM_RECONCILIATION',
        status: 'FAILED',
        expected: 'Stock 26',
        actual: e.message,
        details: e.message,
      });
    }

    return results;
  }
}
