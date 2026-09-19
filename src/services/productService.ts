import { Product, Sale, Purchase, InventoryMovement } from '../types';

export interface ProductDeleteEligibility {
  canHardDelete: boolean;
  hasHistoricalReferences: boolean;
  hasStockWithoutHistory: boolean;
  historyDetails: {
    salesCount: number;
    purchasesCount: number;
    movementsCount: number;
  };
  reason?: string;
  stockWarning?: string;
  suggestedAction: 'HARD_DELETE' | 'DEACTIVATE';
}

export interface HardDeleteResult {
  updatedProducts: Product[];
  updatedMovements: InventoryMovement[];
  deletedProduct: Product;
  success: boolean;
  message: string;
}

export interface DeactivateResult {
  updatedProducts: Product[];
  deactivatedProduct: Product;
  success: boolean;
  message: string;
}

export class ProductService {
  /**
   * Evaluates whether a movement is an initial registration opening stock movement
   * versus a subsequent business transaction (adjustments, returns, sales, or purchases).
   */
  public static isOpeningStockMovement(m: InventoryMovement): boolean {
    const isOpeningReason =
      m.reason.toLowerCase().includes('opening') ||
      m.referenceId?.toUpperCase().startsWith('OPENING') ||
      m.referenceId?.toUpperCase().startsWith('INIT');
    const isStockIn = m.type === 'STOCK_IN' || (m.type as string) === 'IN';
    return isStockIn && isOpeningReason && m.previousStock === 0;
  }

  /**
   * Determine delete eligibility for a product.
   * Hard Delete is only allowed if the product has zero authoritative historical references:
   * - No Sales / SaleItems
   * - No Purchases / PurchaseItems
   * - No historical InventoryMovements (beyond initial opening stock)
   * - No Returns or Stock Adjustments
   */
  public static checkDeleteEligibility(
    product: Product,
    sales: Sale[],
    purchases: Purchase[],
    movements: InventoryMovement[]
  ): ProductDeleteEligibility {
    // 1. Check historical sales
    const salesWithProduct = sales.filter((s) =>
      s.items?.some((item) => item.productId === product.id)
    );

    // 2. Check historical purchases
    const purchasesWithProduct = purchases.filter((p) =>
      p.items?.some((item) => item.productId === product.id)
    );

    // 3. Check inventory movements (filter out initial opening stock movement if it's the sole movement)
    const productMovements = movements.filter((m) => m.productId === product.id);
    const nonOpeningMovements = productMovements.filter(
      (m) => !ProductService.isOpeningStockMovement(m)
    );

    // If there are multiple movements, even if labelled opening, stock was moved multiple times
    const hasHistoricalMovements =
      nonOpeningMovements.length > 0 || productMovements.length > 1;

    const hasHistoricalReferences =
      salesWithProduct.length > 0 ||
      purchasesWithProduct.length > 0 ||
      hasHistoricalMovements;

    if (hasHistoricalReferences) {
      return {
        canHardDelete: false,
        hasHistoricalReferences: true,
        hasStockWithoutHistory: false,
        historyDetails: {
          salesCount: salesWithProduct.length,
          purchasesCount: purchasesWithProduct.length,
          movementsCount: productMovements.length,
        },
        suggestedAction: 'DEACTIVATE',
        reason:
          'Produk ini mempunyai rekod sejarah dan tidak boleh dipadam. Nyahaktifkan produk untuk menghentikan jualan baharu.',
      };
    }

    // Zero historical business references
    const hasStock = product.currentStock > 0;

    return {
      canHardDelete: true,
      hasHistoricalReferences: false,
      hasStockWithoutHistory: hasStock,
      historyDetails: {
        salesCount: 0,
        purchasesCount: 0,
        movementsCount: productMovements.length,
      },
      suggestedAction: 'HARD_DELETE',
      stockWarning: hasStock
        ? `Produk mempunyai stok semasa (${product.currentStock} unit) tetapi tiada rekod sejarah. Padam produk ini bersama stok semasa?`
        : undefined,
    };
  }

  /**
   * Safely permanently deletes a product if eligible.
   * Removes initial opening stock movements if any, so no orphaned records remain.
   */
  public static hardDeleteProduct(
    productId: string,
    existingProducts: Product[],
    existingMovements: InventoryMovement[],
    sales: Sale[],
    purchases: Purchase[],
    confirmWithStock: boolean = false
  ): HardDeleteResult {
    const product = existingProducts.find((p) => p.id === productId);
    if (!product) {
      throw new Error('Produk tidak dijumpai.');
    }

    const eligibility = ProductService.checkDeleteEligibility(
      product,
      sales,
      purchases,
      existingMovements
    );

    if (eligibility.hasHistoricalReferences) {
      throw new Error(
        eligibility.reason ||
          'Produk ini mempunyai rekod sejarah dan tidak boleh dipadam. Nyahaktifkan produk untuk menghentikan jualan baharu.'
      );
    }

    if (product.currentStock > 0 && !confirmWithStock) {
      throw new Error(
        `Produk mempunyai stok semasa (${product.currentStock} unit) tetapi tiada rekod sejarah. Pengesahan pemadaman bersama stok diperlukan.`
      );
    }

    const updatedProducts = existingProducts.filter((p) => p.id !== productId);
    // Remove opening movement for this product to prevent orphaned records
    const updatedMovements = existingMovements.filter((m) => m.productId !== productId);

    return {
      updatedProducts,
      updatedMovements,
      deletedProduct: product,
      success: true,
      message: `Produk "${product.name}" berjaya dipadam secara kekal.`,
    };
  }

  /**
   * Deactivates a product with historical records.
   * Preserves product record, movements, and historical financial records.
   */
  public static deactivateProduct(
    productId: string,
    existingProducts: Product[]
  ): DeactivateResult {
    const product = existingProducts.find((p) => p.id === productId);
    if (!product) {
      throw new Error('Produk tidak dijumpai.');
    }

    const updatedProduct: Product = {
      ...product,
      active: false,
      updatedAt: new Date().toISOString(),
    };

    const updatedProducts = existingProducts.map((p) =>
      p.id === productId ? updatedProduct : p
    );

    return {
      updatedProducts,
      deactivatedProduct: updatedProduct,
      success: true,
      message: `Produk "${product.name}" telah dinyahaktifkan. Rekod sejarah kekal terpelihara.`,
    };
  }
}
