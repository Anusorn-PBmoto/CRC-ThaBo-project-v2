import { ProductItem, StockTransfer } from '../types';

/**
 * Normalizes and extracts storefront and warehouse quantities safely.
 * If frontQty and warehouseQty are not explicitly saved yet:
 * - If totalQty > 2: allocates 2 to front, rest to warehouse
 * - If totalQty <= 2: allocates all to front, 0 to warehouse
 */
export function getProductStockBreakdown(product: ProductItem): {
  frontQty: number;
  warehouseQty: number;
  totalQty: number;
  isFrontLow: boolean;
  canRestockFromWarehouse: boolean;
  frontLocation: string;
  warehouseLocation: string;
} {
  const total = typeof product.actualQty === 'number' ? Math.max(0, product.actualQty) : 0;
  const minFront = product.minFrontStock ?? 2;

  let front = 0;
  let warehouse = 0;

  if (typeof product.frontQty === 'number' && typeof product.warehouseQty === 'number') {
    front = Math.max(0, product.frontQty);
    warehouse = Math.max(0, product.warehouseQty);
  } else if (typeof product.frontQty === 'number') {
    front = Math.max(0, product.frontQty);
    warehouse = Math.max(0, total - front);
  } else if (typeof product.warehouseQty === 'number') {
    warehouse = Math.max(0, product.warehouseQty);
    front = Math.max(0, total - warehouse);
  } else {
    // Graceful default for legacy products
    if (total > 2) {
      front = 2;
      warehouse = total - 2;
    } else {
      front = total;
      warehouse = 0;
    }
  }

  const isFrontLow = front <= minFront;
  const canRestockFromWarehouse = warehouse > 0;

  return {
    frontQty: front,
    warehouseQty: warehouse,
    totalQty: front + warehouse,
    isFrontLow,
    canRestockFromWarehouse,
    frontLocation: product.frontLocation || 'หน้าร้าน',
    warehouseLocation: product.location || 'RACK A-01',
  };
}

/**
 * Calculates updated ProductItem after moving stock between storefront and warehouse.
 * Total actualQty and systemQty remain constant, ensuring data consistency!
 */
export function computeTransferredProduct(
  product: ProductItem,
  qty: number,
  direction: 'to_front' | 'to_warehouse'
): {
  updatedProduct: ProductItem;
  transferLog: Omit<StockTransfer, 'id'>;
} {
  const breakdown = getProductStockBreakdown(product);
  const transferQty = Math.max(1, Math.floor(qty));

  let nextFront = breakdown.frontQty;
  let nextWarehouse = breakdown.warehouseQty;

  if (direction === 'to_front') {
    // Restock from warehouse to front
    const actualMove = Math.min(transferQty, breakdown.warehouseQty);
    nextWarehouse = breakdown.warehouseQty - actualMove;
    nextFront = breakdown.frontQty + actualMove;
  } else {
    // Return from front to warehouse
    const actualMove = Math.min(transferQty, breakdown.frontQty);
    nextFront = breakdown.frontQty - actualMove;
    nextWarehouse = breakdown.warehouseQty + actualMove;
  }

  const updatedProduct: ProductItem = {
    ...product,
    frontQty: nextFront,
    warehouseQty: nextWarehouse,
    actualQty: nextFront + nextWarehouse,
    systemQty: nextFront + nextWarehouse,
    updatedAt: new Date().toISOString(),
  };

  const transferLog: Omit<StockTransfer, 'id'> = {
    productId: product.id,
    productName: product.name || product.size || 'สินค้า',
    brand: product.brand || '',
    barcode: product.barcode || '',
    fromLocation: direction === 'to_front' ? 'warehouse' : 'front',
    toLocation: direction === 'to_front' ? 'front' : 'warehouse',
    quantity: transferQty,
    timestamp: new Date().toISOString(),
  };

  return { updatedProduct, transferLog };
}
