import * as XLSX from 'xlsx';
import { ProductItem } from '../types';
import { getProductStockBreakdown } from './stockUtils';

export const APPSHEET_CSV_FILENAME = 'crc-thano-project-v2.csv';
export const APPSHEET_EXCEL_FILENAME = 'crc-thano-project-v2.xlsx';
export const LOCAL_STORAGE_KEY_AUTO_CSV = 'crc_thano_auto_csv_export';
export const LOCAL_STORAGE_KEY_LAST_CSV = 'crc_thano_last_csv_content';

/**
 * Cleans image URL for spreadsheet export.
 * If the image is a massive Base64 data string (data:image/...),
 * placing it directly into a CSV or Sheet cell breaks Excel's 32,767 character limit
 * and corrupts sheet rows, causing subsequent columns and rows to shift.
 * In AppSheet and Google Sheets, image paths should be clean filenames or web URLs.
 */
export function sanitizeImageUrlForSpreadsheet(
  url: string | undefined,
  itemId: string,
  barcode?: string
): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:image/')) {
    // Generate clean AppSheet-compatible image path
    const safeKey = (barcode || itemId || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `crc-thano-project-v2_Images/${safeKey}.jpg`;
  }

  // Remove leading slash if it's a local public path so AppSheet/Drive can resolve
  if (trimmed.startsWith('/products/')) {
    return trimmed.replace(/^\//, '');
  }

  return trimmed;
}

/**
 * Formats ISO date into clean, spreadsheet-friendly 'YYYY-MM-DD HH:mm:ss'
 */
export function formatSpreadsheetDate(dateStr?: string): string {
  if (!dateStr) {
    const d = new Date();
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return dateStr;
  }
}

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
 * Generates AppSheet compliant CSV text with UTF-8 BOM.
 * Sanitizes base64 images so rows never overflow Excel / Sheets character limits.
 */
export function generateAppSheetCsv(
  products: ProductItem[],
  options: { preserveBase64?: boolean } = {}
): string {
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

    const safeImg = options.preserveBase64
      ? item.imageUrl || ''
      : sanitizeImageUrlForSpreadsheet(item.imageUrl, item.id, item.barcode);

    const safeDate = formatSpreadsheetDate(item.updatedAt);

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
      escapeCsvField(safeImg),
      escapeCsvField(item.status || 'checked'),
      escapeCsvField(safeDate),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) for Thai language compatibility in AppSheet & Excel
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers a browser download of crc-thano-project-v2.csv
 */
export function downloadAppSheetCsv(
  products: ProductItem[],
  fileName = APPSHEET_CSV_FILENAME,
  options: { preserveBase64?: boolean } = {}
): void {
  const csvContent = generateAppSheetCsv(products, options);

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
 * Generates and downloads a clean Microsoft Excel (.xlsx) file.
 * Solves the issue where Excel auto-converts 13-digit barcodes into scientific notation (e.g. 8.85E+12).
 * Formats headers, data types, numbers, and column widths neatly.
 */
export function downloadAppSheetExcel(
  products: ProductItem[],
  fileName = APPSHEET_EXCEL_FILENAME
): void {
  const dataRows = products.map((item) => {
    const cost = item.costPrice || 0;
    const sell = item.sellingPrice || item.price || 0;
    const profit = sell - cost;
    const name = item.name || item.size || '';
    const breakdown = getProductStockBreakdown(item);
    const safeImg = sanitizeImageUrlForSpreadsheet(item.imageUrl, item.id, item.barcode);
    const safeDate = formatSpreadsheetDate(item.updatedAt);

    return {
      ProductID: String(item.id || ''),
      Barcode: String(item.barcode || ''),
      ProductName: name,
      Unit: item.unit || 'ชิ้น',
      CostPrice: cost,
      SellingPrice: sell,
      Profit: profit,
      ActualQty: item.actualQty ?? 0,
      SystemQty: item.systemQty ?? 0,
      FrontQty: breakdown.frontQty,
      WarehouseQty: breakdown.warehouseQty,
      FrontLocation: breakdown.frontLocation,
      Location: breakdown.warehouseLocation,
      Brand: item.brand || '',
      Category: item.category || '',
      ImageURL: safeImg,
      Status: item.status || 'checked',
      UpdatedAt: safeDate,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);

  // Set explicit column widths for professional presentation
  worksheet['!cols'] = [
    { wch: 16 }, // ProductID
    { wch: 18 }, // Barcode
    { wch: 38 }, // ProductName
    { wch: 8 },  // Unit
    { wch: 12 }, // CostPrice
    { wch: 12 }, // SellingPrice
    { wch: 10 }, // Profit
    { wch: 10 }, // ActualQty
    { wch: 10 }, // SystemQty
    { wch: 10 }, // FrontQty
    { wch: 12 }, // WarehouseQty
    { wch: 20 }, // FrontLocation
    { wch: 16 }, // Location
    { wch: 14 }, // Brand
    { wch: 16 }, // Category
    { wch: 36 }, // ImageURL
    { wch: 10 }, // Status
    { wch: 20 }, // UpdatedAt
  ];

  // Ensure Barcode & ProductID cells are typed as text ('s') so Excel never converts to 8.85E+12
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    // Column A = ProductID (c = 0)
    const cellA = worksheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cellA) cellA.t = 's';

    // Column B = Barcode (c = 1)
    const cellB = worksheet[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cellB) {
      cellB.t = 's';
      cellB.z = '@'; // Explicit text format
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CRC_THABO_Stock');

  // Trigger download
  XLSX.writeFile(workbook, fileName);
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
