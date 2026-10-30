import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Check,
  Sparkles,
  SlidersHorizontal,
  Package,
  Layers,
  ArrowRight,
  Info,
  HelpCircle,
  FileDown,
  Trash2,
} from 'lucide-react';
import { ProductItem, AuditLog } from '../types';
import { getProductStockBreakdown } from '../utils/stockUtils';

export type AdjustmentMode = 'set_actual' | 'delta_adjust' | 'stock_in';
export type TargetLocationPreference = 'auto_or_split' | 'front_only' | 'warehouse_only';

export interface ParsedStockItem {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  unit: string;
  fileQty: number;          // Quantity read from the file
  fileFrontQty?: number;    // Specific front qty from file if available
  fileWarehouseQty?: number;// Specific warehouse qty from file if available
  costPrice?: number;
  sellingPrice?: number;
  note?: string;

  // Matching with catalog
  matchedProduct: ProductItem | null;
  matchType: 'barcode' | 'name' | 'none';

  // Computed adjustment values
  originalFrontQty: number;
  originalWarehouseQty: number;
  originalTotalQty: number;

  newFrontQty: number;
  newWarehouseQty: number;
  newTotalQty: number;

  diff: number;             // newTotalQty - originalTotalQty
  selected: boolean;
}

interface StockAdjustmentFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onApplyAdjustments: (
    adjustments: Array<{
      productId: string;
      newFrontQty: number;
      newWarehouseQty: number;
      diff: number;
      note?: string;
    }>,
    summaryText: string
  ) => Promise<void> | void;
}

export const StockAdjustmentFileModal: React.FC<StockAdjustmentFileModalProps> = ({
  isOpen,
  onClose,
  products,
  onApplyAdjustments,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedStockItem[]>([]);
  const [documentTitle, setDocumentTitle] = useState<string>('');

  // Settings
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>('set_actual');
  const [targetLocation, setTargetLocation] = useState<TargetLocationPreference>('auto_or_split');

  // Filter in preview table
  const [filterTab, setFilterTab] = useState<'all' | 'changed' | 'unchanged' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Reset state
  const handleReset = () => {
    setFile(null);
    setParsedItems([]);
    setErrorMessage(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setDocumentTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------------------------------------------
  // 1. Template Generation & Downloads
  // -------------------------------------------------------------
  const downloadSampleTemplate = () => {
    const headers = [
      'รหัสสินค้า (Barcode)',
      'ชื่อสินค้า (Product Name)',
      'ยี่ห้อ (Brand)',
      'ยอดนับหน้าร้าน (Front Qty)',
      'ยอดนับคลังหลัง (Warehouse Qty)',
      'ยอดรวมทั้งหมด (Total Qty)',
      'หน่วยนับ (Unit)',
      'หมายเหตุ (Note)',
    ];

    const sampleRows = [
      ['885286300308', 'บางจาก FURIO SUPER-1 4T 0.8L', 'บางจาก', 12, 24, 36, 'ขวด', 'นับสต็อกประจำงวด'],
      ['885176211159', 'ยางนอก IRC 70/90-17 MAXING NR58', 'IRC', 5, 10, 15, 'เส้น', 'นับสต็อกคลังหลัง'],
      ['5205', 'แบตเตอรี่ YUASA YTZ-5-S (12V 5Ah)', 'YUASA', 4, 8, 12, 'ลูก', ''],
      ['JT-428-106L', 'โซ่ขับมอเตอร์ไซค์ JT 428-106L', 'JT', 6, 6, 12, 'กล่อง', ''],
    ];

    const csvContent =
      '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CRC_Stock_Adjustment_Template_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCurrentCatalogForAudit = () => {
    const headers = [
      'รหัสสินค้า (Barcode)',
      'ชื่อสินค้า (Product Name)',
      'ยี่ห้อ (Brand)',
      'หมวดหมู่ (Category)',
      'สต็อกระบบหน้าร้าน (Current Front)',
      'สต็อกระบบคลังหลัง (Current WH)',
      'สต็อกระบบรวม (Current Total)',
      'ยอดนับจริงหน้าร้าน (Counted Front)',
      'ยอดนับจริงคลังหลัง (Counted WH)',
      'ยอดนับจริงรวม (Counted Total)',
      'หน่วยนับ (Unit)',
      'หมายเหตุ (Note)',
    ];

    const rows = products.map((p) => {
      const b = getProductStockBreakdown(p);
      return [
        `"${p.barcode || p.id}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.brand || ''}"`,
        `"${p.category || ''}"`,
        b.frontQty,
        b.warehouseQty,
        b.totalQty,
        b.frontQty, // Default filled with current for quick audit
        b.warehouseQty,
        b.totalQty,
        `"${p.unit || 'ชิ้น'}"`,
        '""',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CRC_Inventory_Audit_Sheet_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // 2. Intelligent Product Matching
  // -------------------------------------------------------------
  const matchProduct = (
    barcode: string,
    name: string
  ): { product: ProductItem | null; type: 'barcode' | 'name' | 'none' } => {
    const cleanBc = (barcode || '').trim().toLowerCase();
    const cleanName = (name || '').trim().toLowerCase();

    // 1. Match by Barcode
    if (cleanBc) {
      const byBarcode = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === cleanBc) ||
          p.id.toLowerCase() === cleanBc
      );
      if (byBarcode) return { product: byBarcode, type: 'barcode' };
    }

    // 2. Match by exact Name
    if (cleanName) {
      const byExactName = products.find(
        (p) => (p.name || '').trim().toLowerCase() === cleanName
      );
      if (byExactName) return { product: byExactName, type: 'name' };

      // 3. Match by partial/fuzzy Name
      const byIncludes = products.find((p) => {
        const pName = (p.name || '').trim().toLowerCase();
        return pName.length > 5 && (pName.includes(cleanName) || cleanName.includes(pName));
      });
      if (byIncludes) return { product: byIncludes, type: 'name' };
    }

    return { product: null, type: 'none' };
  };

  // Compute recalculated stock numbers based on current mode & location settings
  const calculateItemStocks = (
    raw: {
      fileQty: number;
      fileFrontQty?: number;
      fileWarehouseQty?: number;
    },
    matched: ProductItem | null,
    mode: AdjustmentMode,
    targetLoc: TargetLocationPreference
  ) => {
    const origBreakdown = matched
      ? getProductStockBreakdown(matched)
      : { frontQty: 0, warehouseQty: 0, totalQty: 0 };

    const origFront = origBreakdown.frontQty;
    const origWH = origBreakdown.warehouseQty;
    const origTotal = origBreakdown.totalQty;

    let newFront = origFront;
    let newWH = origWH;

    const hasSpecificColumns =
      typeof raw.fileFrontQty === 'number' || typeof raw.fileWarehouseQty === 'number';

    if (mode === 'set_actual') {
      // REPLACE / SET EXACT
      if (hasSpecificColumns && targetLoc === 'auto_or_split') {
        newFront = Math.max(0, raw.fileFrontQty ?? origFront);
        newWH = Math.max(0, raw.fileWarehouseQty ?? origWH);
      } else if (targetLoc === 'front_only') {
        newFront = Math.max(0, raw.fileQty);
        newWH = origWH;
      } else if (targetLoc === 'warehouse_only') {
        newFront = origFront;
        newWH = Math.max(0, raw.fileQty);
      } else {
        // Distribute or assign to front if unknown
        if (origTotal > 0) {
          const ratioFront = origFront / origTotal;
          newFront = Math.round(raw.fileQty * ratioFront);
          newWH = Math.max(0, raw.fileQty - newFront);
        } else {
          newFront = raw.fileQty;
          newWH = 0;
        }
      }
    } else if (mode === 'delta_adjust') {
      // RELATIVE DELTA (+/-)
      if (hasSpecificColumns && targetLoc === 'auto_or_split') {
        newFront = Math.max(0, origFront + (raw.fileFrontQty || 0));
        newWH = Math.max(0, origWH + (raw.fileWarehouseQty || 0));
      } else if (targetLoc === 'front_only') {
        newFront = Math.max(0, origFront + raw.fileQty);
        newWH = origWH;
      } else if (targetLoc === 'warehouse_only') {
        newFront = origFront;
        newWH = Math.max(0, origWH + raw.fileQty);
      } else {
        newFront = Math.max(0, origFront + raw.fileQty);
        newWH = origWH;
      }
    } else {
      // STOCK IN (Always Positive Add)
      const addQty = Math.max(0, raw.fileQty);
      if (hasSpecificColumns && targetLoc === 'auto_or_split') {
        newFront = origFront + Math.max(0, raw.fileFrontQty || 0);
        newWH = origWH + Math.max(0, raw.fileWarehouseQty || 0);
      } else if (targetLoc === 'front_only') {
        newFront = origFront + addQty;
        newWH = origWH;
      } else if (targetLoc === 'warehouse_only') {
        newFront = origFront;
        newWH = origWH + addQty;
      } else {
        newFront = origFront + addQty;
        newWH = origWH;
      }
    }

    const newTotal = newFront + newWH;
    const diff = newTotal - origTotal;

    return {
      originalFrontQty: origFront,
      originalWarehouseQty: origWH,
      originalTotalQty: origTotal,
      newFrontQty: newFront,
      newWarehouseQty: newWH,
      newTotalQty: newTotal,
      diff,
    };
  };

  // Re-calculate all items when mode or target location changes
  const applySettingsToItems = (
    items: ParsedStockItem[],
    newMode: AdjustmentMode,
    newTargetLoc: TargetLocationPreference
  ): ParsedStockItem[] => {
    return items.map((item) => {
      const calcs = calculateItemStocks(
        {
          fileQty: item.fileQty,
          fileFrontQty: item.fileFrontQty,
          fileWarehouseQty: item.fileWarehouseQty,
        },
        item.matchedProduct,
        newMode,
        newTargetLoc
      );
      return {
        ...item,
        ...calcs,
      };
    });
  };

  // -------------------------------------------------------------
  // 3. File Processing: CSV & XLSX
  // -------------------------------------------------------------
  const processSpreadsheet = async (selectedFile: File) => {
    setIsProcessing(true);
    setProcessingStatus('กำลังอ่านข้อมูลจากไฟล์ตาราง...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('ไม่พบข้อมูล Sheet ในไฟล์นี้');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('ไฟล์นี้ไม่มีแถวข้อมูล หรือตารางว่างเปล่า');
      }

      setProcessingStatus(`พบ ${rawRows.length} แถว กำลังจับคู่รายการสินค้า...`);

      // Header alias normalizer
      const normalizeKey = (key: string) =>
        key
          .toLowerCase()
          .replace(/[\s_\-()]/g, '')
          .trim();

      const items: ParsedStockItem[] = [];

      rawRows.forEach((row, idx) => {
        // Find barcode
        let barcodeVal = '';
        let nameVal = '';
        let brandVal = '';
        let unitVal = 'ชิ้น';
        let qtyVal = 0;
        let frontQtyVal: number | undefined = undefined;
        let whQtyVal: number | undefined = undefined;
        let noteVal = '';

        for (const [rawK, val] of Object.entries(row)) {
          const k = normalizeKey(rawK);
          const str = String(val).trim();

          if (
            k.includes('barcode') ||
            k.includes('บาร์โค้ด') ||
            k.includes('รหัส') ||
            k.includes('code') ||
            k.includes('sku')
          ) {
            if (!barcodeVal && str) barcodeVal = str;
          } else if (
            k.includes('productname') ||
            k.includes('ชื่อสินค้า') ||
            k.includes('ชื่อ') ||
            k.includes('รายการ') ||
            k.includes('item') ||
            k.includes('description')
          ) {
            if (!nameVal && str) nameVal = str;
          } else if (k.includes('brand') || k.includes('ยี่ห้อ')) {
            if (!brandVal && str) brandVal = str;
          } else if (k.includes('unit') || k.includes('หน่วย')) {
            if (str) unitVal = str;
          } else if (
            k.includes('front') ||
            k.includes('หน้าร้าน') ||
            k.includes('countedfront')
          ) {
            const num = parseFloat(str.replace(/,/g, ''));
            if (!isNaN(num)) frontQtyVal = num;
          } else if (
            k.includes('warehouse') ||
            k.includes('wh') ||
            k.includes('คลัง') ||
            k.includes('countedwh')
          ) {
            const num = parseFloat(str.replace(/,/g, ''));
            if (!isNaN(num)) whQtyVal = num;
          } else if (
            k.includes('qty') ||
            k.includes('จำนวน') ||
            k.includes('ยอดนับ') ||
            k.includes('ยอดรวม') ||
            k.includes('total') ||
            k.includes('count') ||
            k.includes('actual')
          ) {
            const num = parseFloat(str.replace(/,/g, ''));
            if (!isNaN(num)) qtyVal = num;
          } else if (k.includes('note') || k.includes('หมายเหตุ')) {
            if (str) noteVal = str;
          }
        }

        // If front & warehouse exist but total qty not set, calculate total
        if (typeof frontQtyVal === 'number' || typeof whQtyVal === 'number') {
          qtyVal = (frontQtyVal || 0) + (whQtyVal || 0);
        }

        // Skip completely empty rows
        if (!barcodeVal && !nameVal) return;

        const match = matchProduct(barcodeVal, nameVal);
        const resolvedName = match.product?.name || nameVal || `รายการแถวที่ #${idx + 1}`;
        const resolvedBarcode = match.product?.barcode || barcodeVal;
        const resolvedBrand = match.product?.brand || brandVal;
        const resolvedUnit = match.product?.unit || unitVal || 'ชิ้น';

        const calcs = calculateItemStocks(
          { fileQty: qtyVal, fileFrontQty: frontQtyVal, fileWarehouseQty: whQtyVal },
          match.product,
          adjustmentMode,
          targetLocation
        );

        items.push({
          id: `parsed-${idx}-${Date.now()}`,
          barcode: resolvedBarcode,
          name: resolvedName,
          brand: resolvedBrand,
          unit: resolvedUnit,
          fileQty: qtyVal,
          fileFrontQty: frontQtyVal,
          fileWarehouseQty: whQtyVal,
          note: noteVal,
          matchedProduct: match.product,
          matchType: match.type,
          selected: true,
          ...calcs,
        });
      });

      if (items.length === 0) {
        throw new Error('ไม่สามารถอ่านข้อมูลรายการสินค้าจากไฟล์ได้ กรุณาตรวจสอบหัวตารางตามตัวอย่าง');
      }

      setDocumentTitle(selectedFile.name);
      setParsedItems(items);
    } catch (err: any) {
      console.error('Spreadsheet parse error:', err);
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการเปิดไฟล์ตาราง');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // -------------------------------------------------------------
  // 4. File Processing: PDF via Gemini AI
  // -------------------------------------------------------------
  const processPdfFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setProcessingStatus('กำลังอัปโหลดเอกสาร PDF และประมวลผลด้วย Gemini AI...');
    setErrorMessage(null);

    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const fileBase64 = await base64Promise;

      setProcessingStatus('Gemini กำลังอ่านตารางสต็อก รายการสินค้า และจำนวนจาก PDF...');

      const response = await fetch('/api/gemini/analyze-stock-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mimeType: selectedFile.type || 'application/pdf',
          fileName: selectedFile.name,
          catalog: products.slice(0, 40).map((p) => ({
            id: p.id,
            barcode: p.barcode,
            name: p.name,
            brand: p.brand,
          })),
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Gemini AI ไม่สามารถอ่านข้อมูลใน PDF ได้');
      }

      const data = resData.data;
      const rawItems = Array.isArray(data.items) ? data.items : [];

      if (rawItems.length === 0) {
        throw new Error('ไม่พบรายการสินค้าหรือตารางสต็อกในเอกสาร PDF นี้');
      }

      setDocumentTitle(data.documentTitle || selectedFile.name);

      const items: ParsedStockItem[] = rawItems.map((item: any, idx: number) => {
        const barcodeVal = item.barcode || '';
        const nameVal = item.name || `สินค้า #${idx + 1}`;
        const match = matchProduct(barcodeVal, nameVal);

        const qtyVal = Number(item.quantity) || 0;
        const frontVal = item.frontQty !== undefined ? Number(item.frontQty) : undefined;
        const whVal = item.warehouseQty !== undefined ? Number(item.warehouseQty) : undefined;

        const calcs = calculateItemStocks(
          { fileQty: qtyVal, fileFrontQty: frontVal, fileWarehouseQty: whVal },
          match.product,
          adjustmentMode,
          targetLocation
        );

        return {
          id: `pdf-${idx}-${Date.now()}`,
          barcode: match.product?.barcode || barcodeVal,
          name: match.product?.name || nameVal,
          brand: match.product?.brand || item.brand || '',
          unit: match.product?.unit || item.unit || 'ชิ้น',
          fileQty: qtyVal,
          fileFrontQty: frontVal,
          fileWarehouseQty: whVal,
          costPrice: Number(item.costPrice) || undefined,
          sellingPrice: Number(item.sellingPrice) || undefined,
          note: item.note || '',
          matchedProduct: match.product,
          matchType: match.type,
          selected: true,
          ...calcs,
        };
      });

      setParsedItems(items);
    } catch (err: any) {
      console.error('PDF AI parse error:', err);
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร PDF ด้วย AI');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // -------------------------------------------------------------
  // 5. File Selection Dispatcher
  // -------------------------------------------------------------
  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    const fileName = selectedFile.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
      processPdfFile(selectedFile);
    } else if (
      fileName.endsWith('.csv') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.tsv')
    ) {
      processSpreadsheet(selectedFile);
    } else if (
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png') ||
      fileName.endsWith('.webp')
    ) {
      // Image support via PDF/Vision Gemini endpoint
      processPdfFile(selectedFile);
    } else {
      setErrorMessage('รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ .CSV, .XLSX, .XLS หรือ .PDF');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
    }
  };

  // -------------------------------------------------------------
  // 6. Inline item edit & toggle
  // -------------------------------------------------------------
  const handleUpdateItemQty = (id: string, newQtyVal: number) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const calcs = calculateItemStocks(
          {
            fileQty: newQtyVal,
            fileFrontQty: item.fileFrontQty,
            fileWarehouseQty: item.fileWarehouseQty,
          },
          item.matchedProduct,
          adjustmentMode,
          targetLocation
        );
        return {
          ...item,
          fileQty: newQtyVal,
          ...calcs,
        };
      })
    );
  };

  const handleToggleSelect = (id: string) => {
    setParsedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setParsedItems((prev) => prev.map((it) => ({ ...it, selected: select })));
  };

  // -------------------------------------------------------------
  // 7. Computed Metrics & Filtered Rows
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = parsedItems.length;
    const matched = parsedItems.filter((i) => i.matchedProduct !== null).length;
    const unmatched = total - matched;
    const changed = parsedItems.filter((i) => i.diff !== 0 && i.matchedProduct !== null).length;
    const unchanged = parsedItems.filter((i) => i.diff === 0 && i.matchedProduct !== null).length;

    let netDiff = 0;
    parsedItems.forEach((i) => {
      if (i.matchedProduct && i.selected) {
        netDiff += i.diff;
      }
    });

    return { total, matched, unmatched, changed, unchanged, netDiff };
  }, [parsedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parsedItems.filter((item) => {
      // Tab filter
      if (filterTab === 'changed' && (item.diff === 0 || !item.matchedProduct)) return false;
      if (filterTab === 'unchanged' && (item.diff !== 0 || !item.matchedProduct)) return false;
      if (filterTab === 'unmatched' && item.matchedProduct !== null) return false;

      // Search query
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchBarcode = (item.barcode || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        return matchName || matchBarcode || matchBrand;
      }

      return true;
    });
  }, [parsedItems, filterTab, searchQuery]);

  // -------------------------------------------------------------
  // 8. Confirm & Apply Adjustments
  // -------------------------------------------------------------
  const handleConfirmApply = async () => {
    const itemsToApply = parsedItems.filter((it) => it.selected && it.matchedProduct !== null);
    if (itemsToApply.length === 0) {
      alert('ไม่มีรายการสินค้าที่ตรงกับระบบที่ถูกเลือก');
      return;
    }

    setIsApplying(true);
    try {
      const modeLabel =
        adjustmentMode === 'set_actual'
          ? 'ตั้งค่ายอดนับจริง'
          : adjustmentMode === 'delta_adjust'
          ? 'ปรับปรุงยอด +/-'
          : 'รับเข้าสต็อก';

      const summaryText = `ปรับสต็อกด้วยไฟล์ ${file?.name || 'เอกสาร'} [โหมด: ${modeLabel}] (${itemsToApply.length} รายการ, ผลต่างรวม ${metrics.netDiff > 0 ? '+' : ''}${metrics.netDiff} ชิ้น)`;

      const adjustments = itemsToApply.map((it) => ({
        productId: it.matchedProduct!.id,
        newFrontQty: it.newFrontQty,
        newWarehouseQty: it.newWarehouseQty,
        diff: it.diff,
        note: it.note || `ปรับสต็อกด้วยไฟล์ ${file?.name || ''}`,
      }));

      await onApplyAdjustments(adjustments, summaryText);
      onClose();
    } catch (err: any) {
      console.error('Apply stock adjustments error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการปรับสต็อก: ' + (err?.message || ''));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-4xl bg-[#252C33] border border-[#3A4750] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1E242B] border-b border-[#3A4750]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-[#F6C90E] flex items-center justify-center border border-amber-400/30">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#EEEEEE] flex items-center gap-2">
                <span>ระบบปรับสต็อกด้วยไฟล์ .PDF / .CSV</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  AI & Excel
                </span>
              </h2>
              <p className="text-xs text-[#A0ABB5]">
                นำเข้าไฟล์รายงานตรวจนับสต็อก สรุปสินค้า หรือเอกสาร PDF เพื่อปรับปรุงยอดในคลังพร้อมกัน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2F3842] transition-colors"
              title="คู่มือการใช้งานไฟล์และรูปแบบที่รองรับ"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2F3842] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Help Guide Accordion */}
          {showHelpGuide && (
            <div className="p-3.5 rounded-xl bg-[#1A1F26] border border-amber-400/40 text-xs text-[#EEEEEE] space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-[#F6C90E]">
                <Info className="w-4 h-4" />
                <span>คำแนะนำการเตรียมไฟล์เพื่อปรับสต็อก:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[#A0ABB5] pl-1">
                <li>
                  <strong className="text-[#EEEEEE]">ไฟล์ Excel / CSV:</strong> สามารถใช้คอลัมน์มาตรฐานได้แก่ <code className="text-[#F6C90E]">บาร์โค้ด</code>, <code className="text-[#F6C90E]">ชื่อสินค้า</code>, <code className="text-[#F6C90E]">ยอดนับหน้าร้าน</code>, <code className="text-[#F6C90E]">ยอดนับคลังหลัง</code> หรือ <code className="text-[#F6C90E]">ยอดนับจริง</code>
                </li>
                <li>
                  <strong className="text-[#EEEEEE]">ไฟล์เอกสาร PDF:</strong> รองรับรายงานตรวจนับสต็อกทางการ, สรุปสินค้าคงคลัง, บิลส่งของ โดยระบบ AI Gemini จะอ่านตารางและถอดรหัสบาร์โค้ด ชื่อสินค้า และจำนวนสต็อกให้อัตโนมัติ
                </li>
                <li>
                  <strong className="text-[#EEEEEE]">การตรวจสอบก่อนปรับจริง:</strong> ระบบจะแสดงเปรียบเทียบยอดเดิม ยอดใหม่ และผลต่าง (+/-) ให้ตรวจสอบและแก้ไขตัวเลขได้ก่อนกดยืนยันบันทึก
                </li>
              </ul>
            </div>
          )}

          {/* Step 1: Upload or Template (when no parsed items yet) */}
          {parsedItems.length === 0 && (
            <div className="space-y-4">
              {/* Dropzone Card */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                  isProcessing
                    ? 'border-amber-400/60 bg-amber-400/5'
                    : 'border-[#475662] hover:border-[#F6C90E] bg-[#1E242B]/60 hover:bg-[#1E242B]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv,.pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2A343D] text-[#F6C90E] border border-[#3A4750] flex items-center justify-center shadow-lg">
                    {isProcessing ? (
                      <RefreshCw className="w-7 h-7 animate-spin text-[#F6C90E]" />
                    ) : (
                      <Upload className="w-7 h-7" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#EEEEEE]">
                      {isProcessing ? 'กำลังประมวลผลไฟล์...' : 'คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่'}
                    </h3>
                    <p className="text-xs text-[#A0ABB5] mt-1">
                      รองรับไฟล์ <strong className="text-emerald-400 font-mono">.CSV</strong>,{' '}
                      <strong className="text-emerald-400 font-mono">.XLSX</strong>,{' '}
                      <strong className="text-rose-400 font-mono">.PDF</strong> หรือภาพถ่ายรายงานตรวจนับ
                    </p>
                  </div>

                  {isProcessing && (
                    <div className="pt-2 text-xs text-[#F6C90E] font-medium animate-pulse flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{processingStatus}</span>
                    </div>
                  )}

                  {!isProcessing && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>เลือกไฟล์จากเครื่อง</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Templates & Quick Action Card */}
              <div className="bg-[#1E242B] border border-[#3A4750] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-[#EEEEEE]">
                      ดาวน์โหลดไฟล์ตัวอย่าง & เอกสารนับสต็อก:
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="p-3 rounded-xl bg-[#252C33] hover:bg-[#2E3740] border border-[#475662] text-left transition-all flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors">
                        ไฟล์ตัวอย่างเปล่า (.CSV)
                      </div>
                      <div className="text-[11px] text-[#A0ABB5] mt-0.5">
                        มีหัวตารางพร้อมตัวอย่าง 4 รายการ สำหรับพิมพ์กรอกข้อมูล
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={exportCurrentCatalogForAudit}
                    className="p-3 rounded-xl bg-[#252C33] hover:bg-[#2E3740] border border-[#475662] text-left transition-all flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-amber-400/10 text-[#F6C90E] border border-amber-400/30 group-hover:scale-105 transition-transform">
                      <FileDown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors">
                        ส่งออกสต็อกปัจจุบันไปนับ ({products.length} รายการ)
                      </div>
                      <div className="text-[11px] text-[#A0ABB5] mt-0.5">
                        ส่งออกสินค้าทั้งหมดพร้อมยอดปัจจุบันเพื่อเดินนับในร้าน
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Parsed Items Preview & Adjustments Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-4">
              {/* Document Banner & Quick Settings */}
              <div className="p-3.5 rounded-xl bg-[#1E242B] border border-[#3A4750] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#EEEEEE] flex items-center gap-2">
                      <span>{documentTitle || file?.name || 'เอกสารนำเข้า'}</span>
                      <span className="text-[10px] text-[#A0ABB5] font-mono">
                        ({parsedItems.length} รายการในไฟล์)
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A0ABB5]">
                      ตรวจสอบยอดสต็อกและปรับเปลี่ยนตัวเลขก่อนกดยืนยันบันทึก
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252C33] hover:bg-[#2E3740] border border-[#475662] text-[#EEEEEE] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์ใหม่</span>
                  </button>
                </div>
              </div>

              {/* Adjustment Mode & Target Location Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#1E242B] p-3.5 rounded-xl border border-[#3A4750]">
                {/* 1. Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#EEEEEE] flex items-center gap-1.5">
                    <span>1. โหมดการปรับสต็อก:</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentMode('set_actual');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, 'set_actual', targetLocation)
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        adjustmentMode === 'set_actual'
                          ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="ยอดสต็อกใหม่จะเท่ากับจำนวนที่ระบุในไฟล์ (เหมาะสำหรับการนับสต็อก)"
                    >
                      ตั้งค่ายอดจริง
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentMode('delta_adjust');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, 'delta_adjust', targetLocation)
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        adjustmentMode === 'delta_adjust'
                          ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="ปรับบวกหรือลบตามจำนวนในไฟล์ (+/-)"
                    >
                      ปรับปรุง +/-
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentMode('stock_in');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, 'stock_in', targetLocation)
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        adjustmentMode === 'stock_in'
                          ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="รับของเข้าสต็อก (บวกเพิ่มเข้าไปในสต็อกเดิม)"
                    >
                      รับเข้าสต็อก
                    </button>
                  </div>
                </div>

                {/* 2. Target Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#EEEEEE] flex items-center gap-1.5">
                    <span>2. จุดสต็อกเป้าหมาย:</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetLocation('auto_or_split');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, adjustmentMode, 'auto_or_split')
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        targetLocation === 'auto_or_split'
                          ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="ใช้ข้อมูลแยกคอลัมน์หน้าร้าน/คลังหลัง ถ้าไม่มีจะกระจายตามสัดส่วนเดิม"
                    >
                      ตามไฟล์ / อัตโนมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetLocation('front_only');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, adjustmentMode, 'front_only')
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        targetLocation === 'front_only'
                          ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="ปรับเฉพาะสต็อกหน้าร้าน คลังหลังคงเดิม"
                    >
                      หน้าร้านเท่านั้น
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetLocation('warehouse_only');
                        setParsedItems((prev) =>
                          applySettingsToItems(prev, adjustmentMode, 'warehouse_only')
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                        targetLocation === 'warehouse_only'
                          ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                      }`}
                      title="ปรับเฉพาะสต็อกคลังหลัง หน้าร้านคงเดิม"
                    >
                      คลังหลังเท่านั้น
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
                  <div className="text-[11px] text-[#A0ABB5]">รายการในไฟล์</div>
                  <div className="text-base font-bold font-mono text-[#EEEEEE] mt-0.5">
                    {metrics.total} <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
                  </div>
                </div>

                <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
                  <div className="text-[11px] text-[#A0ABB5]">พบในระบบ</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                    {metrics.matched}{' '}
                    <span className="text-xs font-normal text-[#A0ABB5]">
                      ({Math.round((metrics.matched / Math.max(1, metrics.total)) * 100)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
                  <div className="text-[11px] text-[#A0ABB5]">มีผลต่างสต็อก</div>
                  <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                    {metrics.changed} <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
                  </div>
                </div>

                <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
                  <div className="text-[11px] text-[#A0ABB5]">ผลต่างสุทธิรวม</div>
                  <div
                    className={`text-base font-bold font-mono mt-0.5 ${
                      metrics.netDiff > 0
                        ? 'text-emerald-400'
                        : metrics.netDiff < 0
                        ? 'text-rose-400'
                        : 'text-[#EEEEEE]'
                    }`}
                  >
                    {metrics.netDiff > 0 ? `+${metrics.netDiff}` : metrics.netDiff}{' '}
                    <span className="text-xs font-normal text-[#A0ABB5]">ชิ้น</span>
                  </div>
                </div>
              </div>

              {/* Filters & Search Table Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-[#1E242B] p-1 rounded-xl border border-[#3A4750] w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold'
                        : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
                    }`}
                  >
                    ทั้งหมด ({metrics.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('changed')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'changed'
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold'
                        : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
                    }`}
                  >
                    ยอดเปลี่ยน ({metrics.changed})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('unchanged')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filterTab === 'unchanged'
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold'
                        : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
                    }`}
                  >
                    ตรงระบบ ({metrics.unchanged})
                  </button>
                  {metrics.unmatched > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterTab('unmatched')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterTab === 'unmatched'
                          ? 'bg-rose-500 text-white font-bold'
                          : 'text-rose-400 hover:text-rose-300'
                      }`}
                    >
                      ไม่พบ ({metrics.unmatched})
                    </button>
                  )}
                </div>

                {/* Search in preview */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ หรือ บาร์โค้ด..."
                    className="w-full bg-[#1E242B] border border-[#3A4750] text-[#EEEEEE] text-xs rounded-xl pl-8 pr-3 py-1.5 focus:border-[#F6C90E] focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-[#3A4750] rounded-xl overflow-hidden bg-[#1E242B]">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#15191E] text-[#A0ABB5] sticky top-0 z-10 border-b border-[#3A4750]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              parsedItems.length > 0 &&
                              parsedItems.filter((i) => i.matchedProduct).every((i) => i.selected)
                            }
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="rounded accent-[#F6C90E] cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3 font-semibold">สินค้า / บาร์โค้ด</th>
                        <th className="py-2.5 px-3 font-semibold text-center">สต็อกเดิม (หน้า|คลัง|รวม)</th>
                        <th className="py-2.5 px-3 font-semibold text-center">
                          {adjustmentMode === 'set_actual'
                            ? 'ยอดนับจริง (แก้ไขได้)'
                            : adjustmentMode === 'delta_adjust'
                            ? 'ปรับยอด +/-'
                            : 'รับเข้า'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-center">สต็อกใหม่</th>
                        <th className="py-2.5 px-3 font-semibold text-center">ผลต่าง</th>
                        <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3A4750]/60">
                      {filteredItems.map((item) => {
                        const isMatched = item.matchedProduct !== null;
                        const hasDiff = item.diff !== 0;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-[#252C33] transition-colors ${
                              !isMatched ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected && isMatched}
                                disabled={!isMatched}
                                onChange={() => handleToggleSelect(item.id)}
                                className="rounded accent-[#F6C90E] cursor-pointer disabled:opacity-30"
                              />
                            </td>

                            {/* Product Info */}
                            <td className="py-2.5 px-3 max-w-[240px]">
                              <div className="font-semibold text-[#EEEEEE] truncate" title={item.name}>
                                {item.name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[#A0ABB5] font-mono mt-0.5">
                                <span>{item.barcode || 'ไม่มีบาร์โค้ด'}</span>
                                {item.brand && (
                                  <>
                                    <span>·</span>
                                    <span className="text-[#F6C90E]">{item.brand}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Original Stock Breakdown */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              {isMatched ? (
                                <div className="text-[11px] text-[#A0ABB5]">
                                  <span className="text-amber-300 font-bold">{item.originalFrontQty}</span>
                                  <span className="mx-1 text-slate-500">|</span>
                                  <span className="text-sky-300 font-bold">{item.originalWarehouseQty}</span>
                                  <span className="mx-1 text-slate-500">|</span>
                                  <span className="text-[#EEEEEE] font-bold">{item.originalTotalQty}</span>
                                </div>
                              ) : (
                                <span className="text-[#A0ABB5] text-[11px]">-</span>
                              )}
                            </td>

                            {/* Counted / File Quantity (Inline Editable Input) */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.fileQty}
                                  onChange={(e) =>
                                    handleUpdateItemQty(item.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 bg-[#252C33] border border-[#475662] text-[#F6C90E] font-bold font-mono text-center rounded-lg py-1 px-1 focus:border-[#F6C90E] focus:outline-none text-xs"
                                />
                                <span className="text-[10px] text-[#A0ABB5]">{item.unit}</span>
                              </div>
                            </td>

                            {/* New Total Stock */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {isMatched ? (
                                <div className="text-[11px]">
                                  <span className="text-amber-300">{item.newFrontQty}</span>
                                  <span className="mx-1 text-slate-500">|</span>
                                  <span className="text-sky-300">{item.newWarehouseQty}</span>
                                  <span className="mx-1 text-slate-500">|</span>
                                  <span className="text-emerald-400 font-bold text-xs">
                                    {item.newTotalQty}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[#A0ABB5]">-</span>
                              )}
                            </td>

                            {/* Diff */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {isMatched ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                                    item.diff > 0
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : item.diff < 0
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                      : 'text-[#A0ABB5]'
                                  }`}
                                >
                                  {item.diff > 0 ? `+${item.diff}` : item.diff}
                                </span>
                              ) : (
                                <span className="text-[#A0ABB5]">-</span>
                              )}
                            </td>

                            {/* Match Status */}
                            <td className="py-2.5 px-3 text-center">
                              {isMatched ? (
                                hasDiff ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-[#F6C90E] border border-amber-400/40">
                                    ปรับยอด
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-[#A0ABB5]">
                                    ตรงระบบ
                                  </span>
                                )
                              ) : (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                  title="ไม่พบบาร์โค้ดหรือชื่อนี้ในฐานข้อมูลปัจจุบัน"
                                >
                                  ไม่พบในระบบ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#3A4750] bg-[#1E242B] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#A0ABB5]">
            {parsedItems.length > 0 ? (
              <span>
                เลือกแล้ว{' '}
                <strong className="text-[#F6C90E]">
                  {parsedItems.filter((i) => i.selected && i.matchedProduct).length}
                </strong>{' '}
                จาก {parsedItems.filter((i) => i.matchedProduct).length} รายการที่ตรงกับระบบ
              </span>
            ) : (
              <span>รองรับทั้งการนับสต็อกประจำปี และการปรับปรุงสินค้าคลาดเคลื่อน</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-[#252C33] hover:bg-[#2E3740] border border-[#475662] text-[#EEEEEE] text-xs font-semibold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>

            {parsedItems.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={
                  isApplying ||
                  parsedItems.filter((i) => i.selected && i.matchedProduct).length === 0
                }
                className="px-5 py-2 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกการปรับสต็อก...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      ยืนยันปรับสต็อก (
                      {parsedItems.filter((i) => i.selected && i.matchedProduct).length} รายการ)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
