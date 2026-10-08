import { ProductItem } from '../types';
import { getProductStockBreakdown } from './stockUtils';

export const APPSHEET_CSV_FILENAME = 'crc-thano-project-v2.csv';
export const LOCAL_STORAGE_KEY_AUTO_CSV = 'crc_thano_auto_csv_export';
export const LOCAL_STORAGE_KEY_LAST_CSV = 'crc_thano_last_csv_content';

/**
 * Escapes values according to RFC 4180 CSV standard
 */
function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates AppSheet compliant CSV text with UTF-8 BOM
 */
export function generateAppSheetCsv(products: ProductItem[]): string {
  const headers = [
    'ProductID',
    'Barcode',
    'ProductName',
    'Unit',
    'CostPrice',
    'SellingPrice',
    'Profit',
    'ActualQty',
    'SystemQty',
    'FrontQty',
    'WarehouseQty',
    'FrontLocation',
    'Location',
    'Brand',
    'Category',
    'ImageURL',
    'Status',
    'UpdatedAt',
  ];

  const rows = products.map((item) => {
    const cost = item.costPrice || 0;
    const sell = item.sellingPrice || item.price || 0;
    const profit = sell - cost;
    const name = item.name || item.size || '';
    const breakdown = getProductStockBreakdown(item);

    return [
      escapeCsvField(item.id),
      escapeCsvField(item.barcode || ''),
      escapeCsvField(name),
      escapeCsvField(item.unit || 'ชิ้น'),
      escapeCsvField(cost),
      escapeCsvField(sell),
      escapeCsvField(profit),
      escapeCsvField(item.actualQty ?? 0),
      escapeCsvField(item.systemQty ?? 0),
      escapeCsvField(breakdown.frontQty),
      escapeCsvField(breakdown.warehouseQty),
      escapeCsvField(breakdown.frontLocation),
      escapeCsvField(breakdown.warehouseLocation),
      escapeCsvField(item.brand || ''),
      escapeCsvField(item.category || ''),
      escapeCsvField(item.imageUrl || ''),
      escapeCsvField(item.status || 'checked'),
      escapeCsvField(item.updatedAt || new Date().toISOString()),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) for Thai language compatibility in AppSheet & Excel
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers a browser download of crc-thano-project-v2.csv
 */
export function downloadAppSheetCsv(products: ProductItem[], fileName = APPSHEET_CSV_FILENAME): void {
  const csvContent = generateAppSheetCsv(products);
  
  // Cache the latest CSV content locally for easy retrieval
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_LAST_CSV, csvContent);
    localStorage.setItem('crc_thano_last_csv_timestamp', new Date().toISOString());
  } catch (e) {
    console.warn('Could not cache CSV to localStorage', e);
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Checks if automatic CSV export on every add/update is enabled
 */
export function isAutoCsvExportEnabled(): boolean {
  try {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY_AUTO_CSV);
    return val === 'true'; // Disabled by default to prevent intrusive browser download popups
  } catch {
    return false;
  }
}

/**
 * Sets automatic CSV export setting
 */
export function setAutoCsvExportEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTO_CSV, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save auto CSV preference', e);
  }
}
