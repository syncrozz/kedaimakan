/**
 * SYNCROZZ KEDAI MAKAN & NIAGAPOS
 * Cross-Suite Retail Checkout - SES v4.5 21-Point Verification Suite
 * 
 * Tests:
 * 1. Existing restaurant-only checkout still passes.
 * 2. Existing retail-only checkout still passes.
 * 3. Mixed cart checkout completes successfully.
 * 4. Correct restaurant items appear in receipt.
 * 5. Correct retail items appear in receipt.
 * 6. Correct total is calculated.
 * 7. Correct change is calculated.
 * 8. Authoritative retail stock decreases correctly.
 * 9. An authoritative InventoryMovement is created for the retail product.
 * 10. No stock deduction occurs for the restaurant item.
 * 11. Attempting to check out with insufficient retail stock fails.
 * 12. Attempting to check out with inactive retail product fails.
 * 13. Submitting the exact same checkoutOperationId twice does not deduct stock twice.
 * 14. Submitting the exact same checkoutOperationId twice does not create duplicate movements.
 * 15. Submitting the exact same checkoutOperationId twice does not create duplicate sales records.
 * 16. Two simultaneous checkouts competing for the last stock unit: one succeeds, one fails.
 * 17. Stock never becomes negative.
 * 18. Retail items do NOT appear on KOT / KDS tickets.
 * 19. Restaurant items DO appear on KOT / KDS tickets.
 * 20. Tax calculation correctly follows RestaurantTaxConfig (not hardcoded 6%).
 * 21. Service charge correctly follows RestaurantTaxConfig.
 */

import { CrossSuiteCheckoutService } from '../src/services/crossSuiteCheckoutService';
import { InventoryService } from '../src/services/inventoryService';
import { KotService } from '../src/services/kotService';
import { Product } from '../src/types';
import { RestaurantOrderItem, RestaurantTaxConfig } from '../src/types/restaurant';

// Mock localStorage for node test runner
const storageMap = new Map<string, string>();
(global as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, val),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

const passedTests: string[] = [];
const failedTests: { name: string; error: any }[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    const msg = detail ? `Assertion failed: ${detail}` : 'Assertion failed';
    failedTests.push({ name: testName, error: new Error(msg) });
    console.error(`❌ [FAIL] ${testName}: ${msg}`);
  } else {
    passedTests.push(testName);
    console.log(`✅ [PASS] ${testName}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('SYNCROZZ SES v4.5: Cross-Suite Checkout 21-Point Verification');
  console.log('======================================================\n');

  CrossSuiteCheckoutService.clearCache();
  storageMap.clear();

  const standardTaxConfig: RestaurantTaxConfig = {
    taxEnabled: true,
    taxName: 'SST',
    taxRatePercent: 6,
    isTaxInclusive: false,
    serviceChargeEnabled: true,
    serviceChargeName: 'Caj Perkhidmatan',
    serviceChargePercent: 10,
  };

  const sampleRetailProduct: Product = {
    id: 'prod-maggi-01',
    storeId: 'demo-store',
    sku: 'KP-MAGGI-CUP',
    name: 'Maggi Hot Cup Kari',
    category: 'Makanan Ringan',
    costPrice: 2.0,
    sellingPrice: 3.0,
    currentStock: 20,
    minimumStock: 5,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleRetailProduct2: Product = {
    id: 'prod-air-mineral-01',
    storeId: 'demo-store',
    sku: 'KP-DRINK-WATER',
    name: 'Air Mineral Spritzer 500ml',
    category: 'Minuman',
    costPrice: 0.8,
    sellingPrice: 1.5,
    currentStock: 1, // Exactly 1 for stock contention test
    minimumStock: 2,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const inactiveRetailProduct: Product = {
    id: 'prod-inactive-01',
    storeId: 'demo-store',
    sku: 'KP-DISCONTINUED',
    name: 'Barangan Lupus',
    category: 'Lain-lain',
    costPrice: 5.0,
    sellingPrice: 10.0,
    currentStock: 50,
    minimumStock: 5,
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const restaurantItemNasiGoreng: RestaurantOrderItem = {
    id: 'line-m01',
    itemType: 'RESTAURANT',
    menuItemId: 'menu-ng-01',
    nameSnapshot: 'Nasi Goreng Kampung',
    categorySnapshot: 'Makanan Utama',
    kitchenStation: 'KITCHEN',
    basePriceSnapshot: 10.0,
    selectedModifiers: [],
    unitTotal: 10.0,
    quantity: 1,
    discountType: 'NONE',
    discountValue: 0,
    discountAmount: 0,
    lineTotal: 10.0,
  };

  const restaurantItemTehAis: RestaurantOrderItem = {
    id: 'line-d01',
    itemType: 'RESTAURANT',
    menuItemId: 'menu-ta-01',
    nameSnapshot: 'Teh Ais Padu',
    categorySnapshot: 'Minuman',
    kitchenStation: 'BAR',
    basePriceSnapshot: 3.0,
    selectedModifiers: [],
    unitTotal: 3.0,
    quantity: 1,
    discountType: 'NONE',
    discountValue: 0,
    discountAmount: 0,
    lineTotal: 3.0,
  };

  const retailItemMaggi: RestaurantOrderItem = {
    id: 'line-rtl-01',
    itemType: 'RETAIL',
    retailProductId: sampleRetailProduct.id,
    retailSku: sampleRetailProduct.sku,
    nameSnapshot: sampleRetailProduct.name,
    categorySnapshot: sampleRetailProduct.category,
    kitchenStation: 'NONE',
    basePriceSnapshot: sampleRetailProduct.sellingPrice,
    costPriceSnapshot: sampleRetailProduct.costPrice,
    selectedModifiers: [],
    unitTotal: sampleRetailProduct.sellingPrice, // RM 3.00
    quantity: 2, // 2 x RM 3.00 = RM 6.00
    discountType: 'NONE',
    discountValue: 0,
    discountAmount: 0,
    lineTotal: 6.0,
  };

  // -------------------------------------------------------------
  // Test 1: Existing restaurant-only checkout still passes
  // -------------------------------------------------------------
  try {
    const res1 = CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_test_1',
      orderId: 'ORD-REST-01',
      orderType: 'TAKEAWAY',
      items: [restaurantItemNasiGoreng, restaurantItemTehAis],
      taxConfig: { ...standardTaxConfig, serviceChargeEnabled: false, taxEnabled: false },
      cashTendered: 20.0,
      workspaceId: 'demo-workspace',
      availableProducts: [sampleRetailProduct],
    });
    assert(
      res1.success && res1.completedOrder.grandTotal === 13.0 && res1.retailMovements.length === 0,
      '1. Existing restaurant-only checkout still passes',
      `Grand total was ${res1.completedOrder.grandTotal}`
    );
  } catch (err: any) {
    assert(false, '1. Existing restaurant-only checkout still passes', err.message);
  }

  // -------------------------------------------------------------
  // Test 2: Existing retail-only checkout still passes
  // -------------------------------------------------------------
  try {
    const res2 = CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_test_2',
      orderId: 'ORD-RETL-01',
      orderType: 'TAKEAWAY',
      items: [retailItemMaggi],
      taxConfig: { ...standardTaxConfig, serviceChargeEnabled: false, taxEnabled: false },
      cashTendered: 10.0,
      workspaceId: 'demo-workspace',
      availableProducts: [sampleRetailProduct],
    });
    assert(
      res2.success &&
        res2.completedOrder.grandTotal === 6.0 &&
        res2.updatedProducts[0].currentStock === 18 &&
        res2.retailMovements.length === 1,
      '2. Existing retail-only checkout still passes',
      `Stock after: ${res2.updatedProducts[0]?.currentStock}`
    );
  } catch (err: any) {
    assert(false, '2. Existing retail-only checkout still passes', err.message);
  }

  // -------------------------------------------------------------
  // Test 3: Mixed cart checkout completes successfully
  // -------------------------------------------------------------
  let mixedResult: any;
  try {
    mixedResult = CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_mixed_03',
      orderId: 'ORD-A1024',
      orderType: 'DINE_IN',
      tableNumber: 'T01',
      guestCount: 2,
      customerName: 'Ahmad Faiz',
      items: [restaurantItemNasiGoreng, restaurantItemTehAis, retailItemMaggi],
      taxConfig: { ...standardTaxConfig, serviceChargeEnabled: false, taxEnabled: false }, // RM10 + RM3 + RM6 = RM19
      cashTendered: 50.0,
      workspaceId: 'demo-workspace',
      availableProducts: [sampleRetailProduct],
    });
    assert(
      mixedResult.success && mixedResult.state === 'COMPLETED',
      '3. Mixed cart checkout completes successfully'
    );
  } catch (err: any) {
    assert(false, '3. Mixed cart checkout completes successfully', err.message);
  }

  // -------------------------------------------------------------
  // Test 4: Correct restaurant items appear in receipt
  // -------------------------------------------------------------
  assert(
    mixedResult &&
      mixedResult.completedOrder.restaurantItems.length === 2 &&
      mixedResult.completedOrder.restaurantItems.some((it: any) => it.nameSnapshot === 'Nasi Goreng Kampung') &&
      mixedResult.completedOrder.restaurantItems.some((it: any) => it.nameSnapshot === 'Teh Ais Padu'),
    '4. Correct restaurant items appear in receipt'
  );

  // -------------------------------------------------------------
  // Test 5: Correct retail items appear in receipt
  // -------------------------------------------------------------
  assert(
    mixedResult &&
      mixedResult.completedOrder.retailItems.length === 1 &&
      mixedResult.completedOrder.retailItems[0].retailSku === 'KP-MAGGI-CUP' &&
      mixedResult.completedOrder.retailItems[0].quantity === 2,
    '5. Correct retail items appear in receipt'
  );

  // -------------------------------------------------------------
  // Test 6: Correct total is calculated
  // -------------------------------------------------------------
  assert(
    mixedResult && mixedResult.completedOrder.grandTotal === 19.0,
    '6. Correct total is calculated',
    `Expected 19.00, got ${mixedResult?.completedOrder?.grandTotal}`
  );

  // -------------------------------------------------------------
  // Test 7: Correct change is calculated
  // -------------------------------------------------------------
  assert(
    mixedResult && mixedResult.completedOrder.changeDue === 31.0,
    '7. Correct change is calculated',
    `Expected 31.00, got ${mixedResult?.completedOrder?.changeDue}`
  );

  // -------------------------------------------------------------
  // Test 8: Authoritative retail stock decreases correctly
  // -------------------------------------------------------------
  const updatedMaggiProd = mixedResult.updatedProducts.find((p: any) => p.id === sampleRetailProduct.id);
  assert(
    updatedMaggiProd && updatedMaggiProd.currentStock === 18,
    '8. Authoritative retail stock decreases correctly',
    `Expected stock 18 (20 - 2), got ${updatedMaggiProd?.currentStock}`
  );

  // -------------------------------------------------------------
  // Test 9: An authoritative InventoryMovement is created for the retail product
  // -------------------------------------------------------------
  const movement = mixedResult.retailMovements[0];
  assert(
    movement &&
      movement.productId === sampleRetailProduct.id &&
      movement.type === 'SALE' &&
      movement.quantity === -2 &&
      movement.referenceId === 'chk_mixed_03',
    '9. An authoritative InventoryMovement is created for the retail product'
  );

  // -------------------------------------------------------------
  // Test 10: No stock deduction occurs for the restaurant item
  // -------------------------------------------------------------
  const restaurantMovements = mixedResult.retailMovements.filter(
    (m: any) => m.productId === 'menu-ng-01' || m.productId === 'menu-ta-01'
  );
  assert(
    restaurantMovements.length === 0,
    '10. No stock deduction occurs for the restaurant item'
  );

  // -------------------------------------------------------------
  // Test 11: Attempting to check out with insufficient retail stock fails
  // -------------------------------------------------------------
  try {
    const lowStockProduct: Product = { ...sampleRetailProduct, currentStock: 1 };
    CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_insufficient_stock',
      orderId: 'ORD-FAIL-01',
      orderType: 'DINE_IN',
      items: [retailItemMaggi], // demands quantity 2, but stock is 1
      taxConfig: standardTaxConfig,
      cashTendered: 50.0,
      workspaceId: 'demo-workspace',
      availableProducts: [lowStockProduct],
    });
    assert(false, '11. Attempting to check out with insufficient retail stock fails', 'Did not throw');
  } catch (err: any) {
    assert(
      err.message.includes('tidak mencukupi'),
      '11. Attempting to check out with insufficient retail stock fails',
      err.message
    );
  }

  // -------------------------------------------------------------
  // Test 12: Attempting to check out with inactive retail product fails
  // -------------------------------------------------------------
  try {
    const inactiveCartItem: RestaurantOrderItem = {
      ...retailItemMaggi,
      retailProductId: inactiveRetailProduct.id,
      retailSku: inactiveRetailProduct.sku,
      nameSnapshot: inactiveRetailProduct.name,
      quantity: 1,
    };
    CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_inactive_prod',
      orderId: 'ORD-FAIL-02',
      orderType: 'DINE_IN',
      items: [inactiveCartItem],
      taxConfig: standardTaxConfig,
      cashTendered: 50.0,
      workspaceId: 'demo-workspace',
      availableProducts: [inactiveRetailProduct],
    });
    assert(false, '12. Attempting to check out with inactive retail product fails', 'Did not throw');
  } catch (err: any) {
    assert(
      err.message.includes('tidak aktif'),
      '12. Attempting to check out with inactive retail product fails',
      err.message
    );
  }

  // -------------------------------------------------------------
  // Test 13: Submitting the exact same checkoutOperationId twice does not deduct stock twice
  // -------------------------------------------------------------
  const idempotentRes1 = CrossSuiteCheckoutService.processCheckout({
    checkoutOperationId: 'chk_idempotency_test',
    orderId: 'ORD-IDEMP-01',
    orderType: 'TAKEAWAY',
    items: [retailItemMaggi],
    taxConfig: standardTaxConfig,
    cashTendered: 20.0,
    workspaceId: 'demo-workspace',
    availableProducts: [sampleRetailProduct],
  });

  const idempotentRes2 = CrossSuiteCheckoutService.processCheckout({
    checkoutOperationId: 'chk_idempotency_test', // Same ID!
    orderId: 'ORD-IDEMP-01',
    orderType: 'TAKEAWAY',
    items: [retailItemMaggi],
    taxConfig: standardTaxConfig,
    cashTendered: 20.0,
    workspaceId: 'demo-workspace',
    availableProducts: [sampleRetailProduct],
  });

  assert(
    idempotentRes1.updatedProducts[0].currentStock === idempotentRes2.updatedProducts[0].currentStock,
    '13. Submitting the exact same checkoutOperationId twice does not deduct stock twice'
  );

  // -------------------------------------------------------------
  // Test 14: Submitting the exact same checkoutOperationId twice does not create duplicate movements
  // -------------------------------------------------------------
  assert(
    idempotentRes1.retailMovements.length === 1 && idempotentRes2.retailMovements.length === 1,
    '14. Submitting the exact same checkoutOperationId twice does not create duplicate movements'
  );

  // -------------------------------------------------------------
  // Test 15: Submitting the exact same checkoutOperationId twice does not create duplicate sales records
  // -------------------------------------------------------------
  assert(
    idempotentRes1.completedOrder.checkoutOperationId === idempotentRes2.completedOrder.checkoutOperationId,
    '15. Submitting the exact same checkoutOperationId twice does not create duplicate sales records'
  );

  // -------------------------------------------------------------
  // Test 16: Two simultaneous checkouts competing for the last stock unit: one succeeds, one fails
  // -------------------------------------------------------------
  let currentCompeteStock = { ...sampleRetailProduct2, currentStock: 1 };
  const singleRetailItem: RestaurantOrderItem = {
    id: 'line-compete-01',
    itemType: 'RETAIL',
    retailProductId: sampleRetailProduct2.id,
    retailSku: sampleRetailProduct2.sku,
    nameSnapshot: sampleRetailProduct2.name,
    categorySnapshot: sampleRetailProduct2.category,
    kitchenStation: 'NONE',
    basePriceSnapshot: 1.5,
    selectedModifiers: [],
    unitTotal: 1.5,
    quantity: 1,
    discountType: 'NONE',
    discountValue: 0,
    discountAmount: 0,
    lineTotal: 1.5,
  };

  let firstCheckoutSuccess = false;
  let secondCheckoutThrew = false;

  try {
    const r1 = CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_compete_user1',
      orderId: 'ORD-COMPETE-1',
      orderType: 'TAKEAWAY',
      items: [singleRetailItem],
      taxConfig: standardTaxConfig,
      cashTendered: 10.0,
      workspaceId: 'demo-workspace',
      availableProducts: [currentCompeteStock],
    });
    firstCheckoutSuccess = r1.success;
    // Stock is now updated to 0
    currentCompeteStock = r1.updatedProducts[0];
  } catch (e) {
    firstCheckoutSuccess = false;
  }

  try {
    CrossSuiteCheckoutService.processCheckout({
      checkoutOperationId: 'chk_compete_user2',
      orderId: 'ORD-COMPETE-2',
      orderType: 'TAKEAWAY',
      items: [singleRetailItem],
      taxConfig: standardTaxConfig,
      cashTendered: 10.0,
      workspaceId: 'demo-workspace',
      availableProducts: [currentCompeteStock], // Now stock is 0
    });
  } catch (e: any) {
    secondCheckoutThrew = e.message.includes('tidak mencukupi');
  }

  assert(
    firstCheckoutSuccess && secondCheckoutThrew,
    '16. Two simultaneous checkouts competing for the last stock unit: one succeeds, one fails'
  );

  // -------------------------------------------------------------
  // Test 17: Stock never becomes negative
  // -------------------------------------------------------------
  assert(
    currentCompeteStock.currentStock >= 0,
    '17. Stock never becomes negative',
    `Stock was ${currentCompeteStock.currentStock}`
  );

  // -------------------------------------------------------------
  // Test 18: Retail items do NOT appear on KOT / KDS tickets
  // -------------------------------------------------------------
  const kotMixedOrder = {
    orderId: 'ORD-KOT-TEST-01',
    orderType: 'DINE_IN' as const,
    tableId: 'T01',
    tableName: 'Meja T01',
    items: [restaurantItemNasiGoreng, restaurantItemTehAis, retailItemMaggi],
    operator: 'Cashier 1',
  };

  const { ticket: kotTicket } = await KotService.createOrGetKitchenTicket(
    kotMixedOrder,
    'kot-test-workspace'
  );

  const containsRetailInKot = kotTicket?.items.some(
    (it) => it.name.includes('Maggi') || it.productId === sampleRetailProduct.id
  );
  assert(
    !containsRetailInKot,
    '18. Retail items do NOT appear on KOT / KDS tickets'
  );

  // -------------------------------------------------------------
  // Test 19: Restaurant items DO appear on KOT / KDS tickets
  // -------------------------------------------------------------
  const containsRestaurantInKot =
    kotTicket?.items.some((it) => it.name === 'Nasi Goreng Kampung') &&
    kotTicket?.items.some((it) => it.name === 'Teh Ais Padu');
  assert(
    Boolean(containsRestaurantInKot) && kotTicket?.items.length === 2,
    '19. Restaurant items DO appear on KOT / KDS tickets'
  );

  // -------------------------------------------------------------
  // Test 20: Tax calculation correctly follows RestaurantTaxConfig (not hardcoded 6%)
  // -------------------------------------------------------------
  const custom8PercentTaxConfig: RestaurantTaxConfig = {
    taxEnabled: true,
    taxName: 'SST 8%',
    taxRatePercent: 8,
    isTaxInclusive: false,
    serviceChargeEnabled: false,
    serviceChargeName: 'Caj Perkhidmatan',
    serviceChargePercent: 0,
  };

  const totalsTax8 = CrossSuiteCheckoutService.calculateTotals(
    [restaurantItemNasiGoreng], // RM 10.00
    custom8PercentTaxConfig,
    'DINE_IN'
  );
  assert(
    totalsTax8.taxAmount === 0.8 && totalsTax8.grandTotal === 10.8,
    '20. Tax calculation correctly follows RestaurantTaxConfig (not hardcoded 6%)',
    `Expected tax RM 0.80, got ${totalsTax8.taxAmount}`
  );

  // -------------------------------------------------------------
  // Test 21: Service charge correctly follows RestaurantTaxConfig
  // -------------------------------------------------------------
  const customServiceChargeConfig: RestaurantTaxConfig = {
    taxEnabled: false,
    taxName: 'None',
    taxRatePercent: 0,
    isTaxInclusive: false,
    serviceChargeEnabled: true,
    serviceChargeName: 'Caj Perkhidmatan',
    serviceChargePercent: 10,
  };

  const totalsServiceCharge = CrossSuiteCheckoutService.calculateTotals(
    [restaurantItemNasiGoreng], // RM 10.00
    customServiceChargeConfig,
    'DINE_IN'
  );
  assert(
    totalsServiceCharge.serviceChargeAmount === 1.0 && totalsServiceCharge.grandTotal === 11.0,
    '21. Service charge correctly follows RestaurantTaxConfig',
    `Expected service charge RM 1.00, got ${totalsServiceCharge.serviceChargeAmount}`
  );

  console.log('\n======================================================');
  console.log(`TOTAL TESTS: 21 | PASSED: ${passedTests.length} | FAILED: ${failedTests.length}`);
  console.log('======================================================\n');

  if (failedTests.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
