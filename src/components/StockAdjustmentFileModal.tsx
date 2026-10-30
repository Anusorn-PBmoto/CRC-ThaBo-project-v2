import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  Filter,
  Plus,
  Minus,
  CheckCheck,
} from 'lucide-react';
import { ProductItem, AuditLog } from '../types';
import { getProductStockBreakdown } from '../utils/stockUtils';
import { normalizeCategory } from '../utils/categoryUtils';

export type AdjustmentMode = 'set_actual' | 'delta_adjust' | 'stock_in';
export type TargetLocationPreference = 'auto_or_split' | 'front_only' | 'warehouse_only';

export interface ParsedStockItem {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  unit: string;
  fileQty: number;          // Quantity from file or user edit
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
  isModifiedByUser?: boolean;
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
  const [successFileNotice, setSuccessFileNotice] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [showUploadBox, setShowUploadBox] = useState(false);

  // Settings
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>('set_actual');
  const [targetLocation, setTargetLocation] = useState<TargetLocationPreference>('auto_or_split');

  // Filter in preview table
  const [filterTab, setFilterTab] = useState<'all' | 'changed' | 'unchanged' | 'unmatched'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // Helper: Calculate item stocks based on settings
  // -------------------------------------------------------------
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
      // Stock in
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

  // Convert products list into initial ParsedStockItem[]
  const buildInitialItems = (prods: ProductItem[]): ParsedStockItem[] => {
    return prods.map((p, idx) => {
      const b = getProductStockBreakdown(p);
      const calcs = calculateItemStocks(
        { fileQty: b.totalQty, fileFrontQty: b.frontQty, fileWarehouseQty: b.warehouseQty },
        p,
        'set_actual',
        'auto_or_split'
      );

      return {
        id: `prod-${p.id || idx}`,
        barcode: p.barcode || '',
        name: p.name || `สินค้า #${idx + 1}`,
        brand: p.brand || '',
        category: normalizeCategory(p.category),
        unit: p.unit || 'ชิ้น',
        fileQty: b.totalQty,
        fileFrontQty: b.frontQty,
        fileWarehouseQty: b.warehouseQty,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        note: '',
        matchedProduct: p,
        matchType: 'barcode',
        selected: false,
        isModifiedByUser: false,
        ...calcs,
      };
    });
  };

  const [parsedItems, setParsedItems] = useState<ParsedStockItem[]>(() => buildInitialItems(products));

  // When modal opens or products change, initialize if empty
  useEffect(() => {
    if (isOpen) {
      if (parsedItems.length === 0 || !file) {
        setParsedItems(buildInitialItems(products));
      }
    }
  }, [isOpen, products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(normalizeCategory(p.category));
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [products]);

  // Reset to initial catalog state
  const handleReset = () => {
    setFile(null);
    setParsedItems(buildInitialItems(products));
    setErrorMessage(null);
    setSuccessFileNotice(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setDocumentTitle('');
    setShowUploadBox(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------------------------------------------
  // Template Generation & Downloads
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
        b.frontQty,
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
  // Match Product Helper
  // -------------------------------------------------------------
  const matchProduct = (
    barcode: string,
    name: string
  ): { product: ProductItem | null; type: 'barcode' | 'name' | 'none' } => {
    const cleanBc = (barcode || '').trim().toLowerCase();
    const cleanName = (name || '').trim().toLowerCase();

    if (cleanBc) {
      const byBarcode = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === cleanBc) ||
          p.id.toLowerCase() === cleanBc
      );
      if (byBarcode) return { product: byBarcode, type: 'barcode' };
    }

    if (cleanName) {
      const byExactName = products.find(
        (p) => (p.name || '').trim().toLowerCase() === cleanName
      );
      if (byExactName) return { product: byExactName, type: 'name' };

      const byIncludes = products.find((p) => {
        const pName = (p.name || '').trim().toLowerCase();
        return pName.length > 5 && (pName.includes(cleanName) || cleanName.includes(pName));
      });
      if (byIncludes) return { product: byIncludes, type: 'name' };
    }

    return { product: null, type: 'none' };
  };

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
  // Spreadsheet Processor (.CSV / .XLSX)
  // -------------------------------------------------------------
  const processSpreadsheet = async (selectedFile: File) => {
    setIsProcessing(true);
    setProcessingStatus('กำลังอ่านข้อมูลจากไฟล์ตาราง...');
    setErrorMessage(null);
    setSuccessFileNotice(null);

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

      setProcessingStatus(`พบ ${rawRows.length} แถว กำลังเทียบข้อมูลกับคลังสินค้า...`);

      const normalizeKey = (key: string) =>
        key
          .toLowerCase()
          .replace(/[\s_\-()]/g, '')
          .trim();

      // Start with all current catalog products
      const updatedItemsMap = new Map<string, ParsedStockItem>();
      buildInitialItems(products).forEach((it) => {
        if (it.matchedProduct) {
          updatedItemsMap.set(it.matchedProduct.id, it);
        }
      });

      let matchedCount = 0;
      let unmatchedCount = 0;
      const extraUnmatchedItems: ParsedStockItem[] = [];

      rawRows.forEach((row, idx) => {
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

        if (typeof frontQtyVal === 'number' || typeof whQtyVal === 'number') {
          qtyVal = (frontQtyVal || 0) + (whQtyVal || 0);
        }

        if (!barcodeVal && !nameVal) return;

        const match = matchProduct(barcodeVal, nameVal);
        if (match.product) {
          matchedCount++;
          const calcs = calculateItemStocks(
            { fileQty: qtyVal, fileFrontQty: frontQtyVal, fileWarehouseQty: whQtyVal },
            match.product,
            adjustmentMode,
            targetLocation
          );
          const existing = updatedItemsMap.get(match.product.id);
          if (existing) {
            updatedItemsMap.set(match.product.id, {
              ...existing,
              fileQty: qtyVal,
              fileFrontQty: frontQtyVal,
              fileWarehouseQty: whQtyVal,
              note: noteVal || existing.note,
              selected: calcs.diff !== 0,
              isModifiedByUser: true,
              ...calcs,
            });
          }
        } else {
          unmatchedCount++;
          const calcs = calculateItemStocks(
            { fileQty: qtyVal, fileFrontQty: frontQtyVal, fileWarehouseQty: whQtyVal },
            null,
            adjustmentMode,
            targetLocation
          );
          extraUnmatchedItems.push({
            id: `unmatched-${idx}-${Date.now()}`,
            barcode: barcodeVal,
            name: nameVal || `สินค้าในไฟล์ #${idx + 1}`,
            brand: brandVal,
            unit: unitVal,
            fileQty: qtyVal,
            fileFrontQty: frontQtyVal,
            fileWarehouseQty: whQtyVal,
            note: noteVal,
            matchedProduct: null,
            matchType: 'none',
            selected: false,
            isModifiedByUser: true,
            ...calcs,
          });
        }
      });

      const mergedList = [...Array.from(updatedItemsMap.values()), ...extraUnmatchedItems];

      setDocumentTitle(selectedFile.name);
      setParsedItems(mergedList);
      setShowUploadBox(false);
      setSuccessFileNotice(
        `✅ โหลดข้อมูลจากไฟล์ "${selectedFile.name}" เรียบร้อย (พบตรงกับในคลัง ${matchedCount} รายการ${
          unmatchedCount > 0 ? `, สินค้าใหม่ในไฟล์ ${unmatchedCount} รายการ` : ''
        })`
      );
    } catch (err: any) {
      console.error('Spreadsheet parse error:', err);
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการเปิดไฟล์ตาราง');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // -------------------------------------------------------------
  // PDF Processor via Gemini AI
  // -------------------------------------------------------------
  const processPdfFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setProcessingStatus('กำลังอัปโหลดเอกสาร PDF และประมวลผลด้วย Gemini AI...');
    setErrorMessage(null);
    setSuccessFileNotice(null);

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

      const updatedItemsMap = new Map<string, ParsedStockItem>();
      buildInitialItems(products).forEach((it) => {
        if (it.matchedProduct) {
          updatedItemsMap.set(it.matchedProduct.id, it);
        }
      });

      let matchedCount = 0;
      let unmatchedCount = 0;
      const extraUnmatchedItems: ParsedStockItem[] = [];

      rawItems.forEach((item: any, idx: number) => {
        const barcodeVal = item.barcode || '';
        const nameVal = item.name || `สินค้า #${idx + 1}`;
        const match = matchProduct(barcodeVal, nameVal);

        const qtyVal = Number(item.quantity) || 0;
        const frontVal = item.frontQty !== undefined ? Number(item.frontQty) : undefined;
        const whVal = item.warehouseQty !== undefined ? Number(item.warehouseQty) : undefined;

        if (match.product) {
          matchedCount++;
          const calcs = calculateItemStocks(
            { fileQty: qtyVal, fileFrontQty: frontVal, fileWarehouseQty: whVal },
            match.product,
            adjustmentMode,
            targetLocation
          );
          const existing = updatedItemsMap.get(match.product.id);
          if (existing) {
            updatedItemsMap.set(match.product.id, {
              ...existing,
              fileQty: qtyVal,
              fileFrontQty: frontVal,
              fileWarehouseQty: whVal,
              note: item.note || existing.note,
              selected: calcs.diff !== 0,
              isModifiedByUser: true,
              ...calcs,
            });
          }
        } else {
          unmatchedCount++;
          const calcs = calculateItemStocks(
            { fileQty: qtyVal, fileFrontQty: frontVal, fileWarehouseQty: whVal },
            null,
            adjustmentMode,
            targetLocation
          );
          extraUnmatchedItems.push({
            id: `pdf-unmatched-${idx}-${Date.now()}`,
            barcode: barcodeVal,
            name: nameVal,
            brand: item.brand || '',
            unit: item.unit || 'ชิ้น',
            fileQty: qtyVal,
            fileFrontQty: frontVal,
            fileWarehouseQty: whVal,
            costPrice: Number(item.costPrice) || undefined,
            sellingPrice: Number(item.sellingPrice) || undefined,
            note: item.note || '',
            matchedProduct: null,
            matchType: 'none',
            selected: false,
            isModifiedByUser: true,
            ...calcs,
          });
        }
      });

      const mergedList = [...Array.from(updatedItemsMap.values()), ...extraUnmatchedItems];

      setDocumentTitle(data.documentTitle || selectedFile.name);
      setParsedItems(mergedList);
      setShowUploadBox(false);
      setSuccessFileNotice(
        `✅ โหลดข้อมูลจากไฟล์ "${selectedFile.name}" ด้วย AI เรียบร้อย (พบตรงกับในคลัง ${matchedCount} รายการ${
          unmatchedCount > 0 ? `, รายการใหม่ ${unmatchedCount} รายการ` : ''
        })`
      );
    } catch (err: any) {
      console.error('PDF AI parse error:', err);
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร PDF ด้วย AI');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

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
      processPdfFile(selectedFile);
    } else {
      setErrorMessage('รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ .CSV, .XLSX, .XLS หรือ .PDF');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // -------------------------------------------------------------
  // Inline Quantity adjustments
  // -------------------------------------------------------------
  const handleUpdateItemQty = (id: string, newQtyVal: number) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const calcs = calculateItemStocks(
          {
            fileQty: Math.max(0, newQtyVal),
            fileFrontQty: item.fileFrontQty,
            fileWarehouseQty: item.fileWarehouseQty,
          },
          item.matchedProduct,
          adjustmentMode,
          targetLocation
        );
        return {
          ...item,
          fileQty: Math.max(0, newQtyVal),
          selected: calcs.diff !== 0,
          isModifiedByUser: true,
          ...calcs,
        };
      })
    );
  };

  const handleQuickStep = (id: string, delta: number) => {
    const item = parsedItems.find((i) => i.id === id);
    if (!item) return;
    const next = Math.max(0, item.fileQty + delta);
    handleUpdateItemQty(id, next);
  };

  const handleToggleSelect = (id: string) => {
    setParsedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setParsedItems((prev) => prev.map((it) => ({ ...it, selected: select })));
  };

  // Select all items that have diff
  const handleSelectAllChanged = () => {
    setParsedItems((prev) =>
      prev.map((it) => ({
        ...it,
        selected: it.diff !== 0 && it.matchedProduct !== null,
      }))
    );
  };

  // -------------------------------------------------------------
  // Metrics & Filtered Rows
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = parsedItems.length;
    const matched = parsedItems.filter((i) => i.matchedProduct !== null).length;
    const unmatched = total - matched;
    const changed = parsedItems.filter((i) => i.diff !== 0 && i.matchedProduct !== null).length;
    const unchanged = parsedItems.filter((i) => i.diff === 0 && i.matchedProduct !== null).length;

    let netDiff = 0;
    let selectedCount = 0;
    parsedItems.forEach((i) => {
      if (i.matchedProduct && i.selected) {
        netDiff += i.diff;
        selectedCount++;
      }
    });

    return { total, matched, unmatched, changed, unchanged, netDiff, selectedCount };
  }, [parsedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parsedItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ทั้งหมด') {
        const itemCat = normalizeCategory(item.category || item.matchedProduct?.category);
        if (itemCat !== selectedCategory) return false;
      }

      // Tab filter
      if (filterTab === 'changed' && (item.diff === 0 || !item.matchedProduct)) return false;
      if (filterTab === 'unchanged' && (item.diff !== 0 || !item.matchedProduct)) return false;
      if (filterTab === 'unmatched' && item.matchedProduct !== null) return false;

      // Search query
      if (q) {
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchBarcode = (item.barcode || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        return matchName || matchBarcode || matchBrand;
      }

      return true;
    });
  }, [parsedItems, filterTab, selectedCategory, searchQuery]);

  // -------------------------------------------------------------
  // Apply Adjustments
  // -------------------------------------------------------------
  const handleConfirmApply = async () => {
    const itemsToApply = parsedItems.filter((it) => it.selected && it.matchedProduct !== null);
    if (itemsToApply.length === 0) {
      alert('กรุณาเลือกรายการสินค้าที่ต้องการบันทึกการปรับสต็อก');
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

      const summaryText = `ปรับสต็อก (${itemsToApply.length} รายการ, ผลต่างรวม ${
        metrics.netDiff > 0 ? '+' : ''
      }${metrics.netDiff} ชิ้น) [โหมด: ${modeLabel}]`;

      const adjustments = itemsToApply.map((it) => ({
        productId: it.matchedProduct!.id,
        newFrontQty: it.newFrontQty,
        newWarehouseQty: it.newWarehouseQty,
        diff: it.diff,
        note: it.note || `ปรับสต็อก (${file ? file.name : 'แก้ไขในหน้าจอ'})`,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-5xl bg-[#252C33] border border-[#3A4750] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#1E242B] border-b border-[#3A4750]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#EEEEEE] flex items-center gap-2">
                <span>ระบบปรับสต็อกสินค้า & นำเข้าไฟล์ (.PDF / .CSV)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  {products.length} รายการ
                </span>
              </h2>
              <p className="text-[11px] text-[#A0ABB5]">
                แก้ไขยอดนับสต็อกได้โดยตรงในตาราง หรืออัปโหลดไฟล์รายงานตรวจนับ / บิลส่งของเพื่อปรับอัตโนมัติ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2F3842] transition-colors"
              title="คู่มือการใช้งาน"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2F3842] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Top Action Bar: Upload toggle & Template downloads */}
        <div className="bg-[#1C2229] border-b border-[#3A4750] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowUploadBox(!showUploadBox)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showUploadBox
                  ? 'bg-[#F6C90E] text-slate-950 border-[#F6C90E] shadow-sm'
                  : 'bg-[#252C33] hover:bg-[#2F3842] text-emerald-400 border-emerald-500/40 hover:border-emerald-500/60'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{showUploadBox ? 'ปิดแผงอัปโหลดไฟล์' : 'นำเข้าไฟล์ .PDF / .CSV'}</span>
            </button>

            <button
              type="button"
              onClick={exportCurrentCatalogForAudit}
              className="px-3 py-1.5 rounded-xl bg-[#252C33] hover:bg-[#2F3842] text-[#EEEEEE] hover:text-[#F6C90E] border border-[#475662] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="ส่งออกรายการสินค้าทั้งหมดในร้านเป็นไฟล์ Excel/CSV เพื่อนำไปเดินนับสต็อก"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>ส่งออกสต็อกปัจจุบันไปนับ</span>
            </button>

            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="px-2.5 py-1.5 rounded-xl bg-[#252C33] hover:bg-[#2F3842] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="ดาวน์โหลดไฟล์เทมเพลตตัวอย่างเปล่า"
            >
              <Download className="w-3.5 h-3.5" />
              <span>เทมเพลตเปล่า (.CSV)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-xl bg-[#252C33] hover:bg-[#2F3842] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662] text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
              title="รีเซ็ตค่ากลับสู่สต็อกปัจจุบันในระบบ"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเซ็ตค่าเดิม</span>
            </button>
          </div>
        </div>

        {/* 3. Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
          {/* Success File Notice */}
          {successFileNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successFileNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessFileNotice(null)}
                className="text-emerald-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Help Guide */}
          {showHelpGuide && (
            <div className="p-3.5 rounded-xl bg-[#1A1F26] border border-amber-400/40 text-xs text-[#EEEEEE] space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-[#F6C90E]">
                <Info className="w-4 h-4" />
                <span>คู่มือการใช้งานระบบปรับสต็อก:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[#A0ABB5] pl-1">
                <li>
                  <strong className="text-[#EEEEEE]">แก้ไขตรงในตาราง:</strong> คุณสามารถค้นหาชื่อหรือบาร์โค้ด แล้วพิมพ์ยอดนับจริงในช่อง หรือกดปุ่ม + / - เพื่อปรับเปลี่ยนตัวเลขได้ทันที
                </li>
                <li>
                  <strong className="text-[#EEEEEE]">นำเข้าไฟล์ตาราง (.CSV / .XLSX):</strong> คอลัมน์ที่รองรับคือ <code className="text-[#F6C90E]">บาร์โค้ด</code>, <code className="text-[#F6C90E]">ชื่อสินค้า</code>, <code className="text-[#F6C90E]">ยอดนับหน้าร้าน</code>, <code className="text-[#F6C90E]">ยอดนับคลังหลัง</code> หรือ <code className="text-[#F6C90E]">ยอดนับจริง</code>
                </li>
                <li>
                  <strong className="text-[#EEEEEE]">นำเข้าเอกสาร .PDF:</strong> ระบบมี AI Gemini ช่วยสกัดตารางจากรายงานตรวจนับหรือบิลสินค้า และจับคู่กับสินค้าในร้านให้อัตโนมัติ
                </li>
              </ul>
            </div>
          )}

          {/* Collapsible File Upload Box */}
          {showUploadBox && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                isProcessing
                  ? 'border-amber-400/60 bg-amber-400/5'
                  : 'border-[#475662] hover:border-[#F6C90E] bg-[#1E242B]/80 hover:bg-[#1E242B]'
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

              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#2A343D] text-[#F6C90E] border border-[#3A4750] flex items-center justify-center shadow-lg">
                  {isProcessing ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-[#F6C90E]" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#EEEEEE]">
                    {isProcessing ? 'กำลังอ่านและประมวลผลไฟล์...' : 'คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่'}
                  </h3>
                  <p className="text-[11px] text-[#A0ABB5] mt-0.5">
                    รองรับไฟล์ <strong className="text-emerald-400 font-mono">.CSV</strong>,{' '}
                    <strong className="text-emerald-400 font-mono">.XLSX</strong> หรือ{' '}
                    <strong className="text-rose-400 font-mono">.PDF</strong> (AI OCR สกัดตาราง)
                  </p>
                </div>

                {isProcessing && (
                  <div className="pt-1 text-xs text-[#F6C90E] font-medium animate-pulse flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{processingStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Adjustment Mode & Target Location Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-[#1E242B] p-3 rounded-xl border border-[#3A4750]">
            {/* 1. Mode */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#EEEEEE]">
                1. โหมดการปรับสต็อก:
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentMode('set_actual');
                    setParsedItems((prev) =>
                      applySettingsToItems(prev, 'set_actual', targetLocation)
                    );
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    adjustmentMode === 'set_actual'
                      ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="ยอดสต็อกใหม่จะเท่ากับจำนวนที่ระบุ (เหมาะสำหรับการนับสต็อก)"
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    adjustmentMode === 'delta_adjust'
                      ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="ปรับบวกหรือลบจากสต็อกเดิม (+/-)"
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    adjustmentMode === 'stock_in'
                      ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] shadow-sm font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="รับของเข้าสต็อก (บวกเพิ่มเข้าไปในสต็อกเดิม)"
                >
                  รับเข้าสต็อก
                </button>
              </div>
            </div>

            {/* 2. Target Location */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#EEEEEE]">
                2. จุดสต็อกเป้าหมาย:
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTargetLocation('auto_or_split');
                    setParsedItems((prev) =>
                      applySettingsToItems(prev, adjustmentMode, 'auto_or_split')
                    );
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    targetLocation === 'auto_or_split'
                      ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="ตามไฟล์หรือตามสัดส่วนเดิม"
                >
                  ตามสัดส่วนเดิม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetLocation('front_only');
                    setParsedItems((prev) =>
                      applySettingsToItems(prev, adjustmentMode, 'front_only')
                    );
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    targetLocation === 'front_only'
                      ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="ปรับเฉพาะสต็อกหน้าร้าน"
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                    targetLocation === 'warehouse_only'
                      ? 'bg-amber-400/20 text-[#F6C90E] border-amber-400/60 font-bold'
                      : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#475662]'
                  }`}
                  title="ปรับเฉพาะสต็อกคลังหลัง"
                >
                  คลังหลังเท่านั้น
                </button>
              </div>
            </div>
          </div>

          {/* Summary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
              <div className="text-[11px] text-[#A0ABB5]">สินค้าทั้งหมด</div>
              <div className="text-base font-bold font-mono text-[#EEEEEE] mt-0.5">
                {metrics.total} <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
              </div>
            </div>

            <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
              <div className="text-[11px] text-[#A0ABB5]">ยอดมีการเปลี่ยนแปลง</div>
              <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                {metrics.changed} <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
              </div>
            </div>

            <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
              <div className="text-[11px] text-[#A0ABB5]">เลือกที่จะปรับสต็อก</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                {metrics.selectedCount} <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
              </div>
            </div>

            <div className="bg-[#1E242B] p-2.5 rounded-xl border border-[#3A4750]">
              <div className="text-[11px] text-[#A0ABB5]">ผลต่างสต็อกสุทธิ</div>
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

          {/* Filters, Categories & Search */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#1E242B] p-1 rounded-xl border border-[#3A4750] w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filterTab === 'unmatched'
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-rose-400 hover:text-rose-300'
                    }`}
                  >
                    สินค้าใหม่ในไฟล์ ({metrics.unmatched})
                  </button>
                )}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-72">
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

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              <span className="text-[#A0ABB5] flex-shrink-0 text-xs">หมวดหมู่:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#F6C90E] text-[#252C33] font-bold'
                      : 'bg-[#1E242B] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750]'
                  }`}
                >
                  {cat}
                </button>
              ))}

              {metrics.changed > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllChanged}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-bold flex-shrink-0 underline cursor-pointer"
                >
                  เลือกเฉพาะรายการที่มีผลต่าง ({metrics.changed})
                </button>
              )}
            </div>
          </div>

          {/* 4. Full Products & Adjustments Table */}
          <div className="border border-[#3A4750] rounded-xl overflow-hidden bg-[#1E242B]">
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#15191E] text-[#A0ABB5] sticky top-0 z-10 border-b border-[#3A4750]">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredItems.length > 0 &&
                          filteredItems.filter((i) => i.matchedProduct).every((i) => i.selected)
                        }
                        onChange={(e) => {
                          const check = e.target.checked;
                          const ids = new Set(filteredItems.map((i) => i.id));
                          setParsedItems((prev) =>
                            prev.map((it) => (ids.has(it.id) ? { ...it, selected: check } : it))
                          );
                        }}
                        className="rounded accent-[#F6C90E] cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3 font-semibold min-w-[200px]">สินค้า / บาร์โค้ด</th>
                    <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">
                      สต็อกเดิม (หน้า | คลัง | รวม)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center min-w-[150px]">
                      {adjustmentMode === 'set_actual'
                        ? 'ยอดนับจริง (แก้ไขได้)'
                        : adjustmentMode === 'delta_adjust'
                        ? 'ปรับยอด (+/-)'
                        : 'รับเข้า (+)'}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">
                      สต็อกใหม่ (หน้า | คลัง | รวม)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center">ผลต่าง</th>
                    <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A4750]/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#A0ABB5] text-xs">
                        ไม่พบรายการสินค้าที่ตรงกับคำค้นหาหรือหมวดหมู่ที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isMatched = item.matchedProduct !== null;
                      const hasDiff = item.diff !== 0;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#252C33] transition-colors ${
                            !isMatched
                              ? 'bg-rose-500/5'
                              : hasDiff
                              ? 'bg-amber-400/[0.04]'
                              : ''
                          }`}
                        >
                          {/* Checkbox */}
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
                          <td className="py-2.5 px-3 max-w-[260px]">
                            <div className="font-semibold text-[#EEEEEE] truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A0ABB5] font-mono mt-0.5 flex-wrap">
                              <span>{item.barcode || 'ไม่มีบาร์โค้ด'}</span>
                              {item.brand && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#F6C90E]">{item.brand}</span>
                                </>
                              )}
                              {item.category && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#A0ABB5]">{item.category}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Original Stock (Front | WH | Total) */}
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                            {isMatched ? (
                              <div className="text-[11px] text-[#A0ABB5]">
                                <span className="text-amber-300 font-bold" title="หน้าร้าน">
                                  {item.originalFrontQty}
                                </span>
                                <span className="mx-1 text-slate-500">|</span>
                                <span className="text-sky-300 font-bold" title="คลังหลัง">
                                  {item.originalWarehouseQty}
                                </span>
                                <span className="mx-1 text-slate-500">|</span>
                                <span className="text-[#EEEEEE] font-bold" title="สต็อกรวม">
                                  {item.originalTotalQty}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#A0ABB5]">-</span>
                            )}
                          </td>

                          {/* Counted / Adjustment Input with Quick - / + Buttons */}
                          <td className="py-2 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickStep(item.id, -1)}
                                className="w-6 h-6 rounded bg-[#252C33] hover:bg-[#323B44] text-[#A0ABB5] hover:text-white border border-[#475662] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="ลด 1"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.fileQty}
                                onChange={(e) =>
                                  handleUpdateItemQty(item.id, parseFloat(e.target.value) || 0)
                                }
                                className={`w-16 bg-[#252C33] border font-bold font-mono text-center rounded-lg py-1 px-1 focus:border-[#F6C90E] focus:outline-none text-xs ${
                                  hasDiff
                                    ? 'border-amber-400 text-[#F6C90E] bg-amber-400/10'
                                    : 'border-[#475662] text-[#EEEEEE]'
                                }`}
                              />

                              <button
                                type="button"
                                onClick={() => handleQuickStep(item.id, 1)}
                                className="w-6 h-6 rounded bg-[#252C33] hover:bg-[#323B44] text-[#A0ABB5] hover:text-white border border-[#475662] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="เพิ่ม 1"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              <span className="text-[10px] text-[#A0ABB5] pl-0.5">{item.unit}</span>
                            </div>
                          </td>

                          {/* New Stock */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap">
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
                                className={`px-2 py-0.5 rounded text-[11px] ${
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
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
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
                                title="สินค้าในไฟล์ ไม่พบในฐานข้อมูล"
                              >
                                สินค้าในไฟล์
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 5. Modal Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#3A4750] bg-[#1E242B] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#A0ABB5]">
            <span>
              เลือกปรับสต็อก{' '}
              <strong className="text-[#F6C90E] font-bold font-mono text-sm">
                {metrics.selectedCount}
              </strong>{' '}
              รายการ (มีผลต่างรวม{' '}
              <strong
                className={`font-mono font-bold ${
                  metrics.netDiff > 0
                    ? 'text-emerald-400'
                    : metrics.netDiff < 0
                    ? 'text-rose-400'
                    : 'text-[#EEEEEE]'
                }`}
              >
                {metrics.netDiff > 0 ? `+${metrics.netDiff}` : metrics.netDiff}
              </strong>{' '}
              ชิ้น)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-[#252C33] hover:bg-[#2E3740] border border-[#475662] text-[#EEEEEE] text-xs font-semibold transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>

            <button
              type="button"
              onClick={handleConfirmApply}
              disabled={isApplying || metrics.selectedCount === 0}
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
                    บันทึกการปรับสต็อก ({metrics.selectedCount} รายการ)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
