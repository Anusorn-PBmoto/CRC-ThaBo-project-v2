import { ProductItem } from '../types';

export function resolveProductImage(item?: Partial<ProductItem> | null): string {
  if (!item || !item.imageUrl) return '';
  return item.imageUrl;
}
