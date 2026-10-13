import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Store,
  Warehouse,
  RefreshCw,
  FileText,
  DollarSign,
  Tag,
  Layers,
  ChevronDown,
  CheckSquare,
  Square,
  FlipHorizontal,
  Info,
  RotateCw,
  Sun,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProductItem, TireItem } from '../types';
import { cleanLocationName, getProductStockBreakdown } from '../utils/stockUtils';
import { safeStringify } from '../utils/safeJSON';

export interface ExtractedBillItem {
  id: string;
  rawName: string;
  name: string;
  brand?: string;
  size?: string;
  category: string;
  quantity: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  lineTotal?: number;
  barcode?: string;
  matchedCatalogId?: string | null;
  matchedProduct?: ProductItem | null;
  isNew: boolean;
  selected: boolean;
}

export interface BillData {
  supplier: string;
  invoiceNo: string;
  date: string;
  grandTotal: number;
  summary: string;
  items: ExtractedBillItem[];
}

interface BillScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCatalog: ProductItem[];
  onBatchSaveProducts: (
    itemsToCreate: Array<Omit<ProductItem, 'id'>>,
    itemsToUpdate: Array<{ id: string; updates: Partial<ProductItem> }>
  ) => Promise<void>;
  onSuccessNotice?: (message: string) => void;
}

const CATEGORIES = [
  'ยางนอก',
  'ยางใน',
  'น้ำมันและเคมีภัณฑ์',
  'ระบบส่งกำลัง',
  'ระบบเบรก',
  'อะไหล่ทั่วไป',
  'แบตเตอรี่และระบบไฟ',
];

const UNITS = ['เส้น', 'ชิ้น', 'คู่', 'กล่อง', 'ลัง', 'ขวด', 'กระป๋อง', 'ชุด', 'อัน', 'แผ่น'];

export function getModelDisplayName(model: string): string {
  if (model.includes('3.8')) return 'Gemini 3.8 Flash (แม่นยำสูงสุด)';
  if (model.includes('3.1') || model.includes('lite')) return 'Gemini 3.1 Flash-Lite (ความเร็วสูง/โควตาสูง)';
  if (model.includes('flash')) return 'Gemini Flash (มาตรฐาน)';
  return model;
}

// Helper to compress image before uploading to Gemini API while keeping high clarity for OCR (~400KB - 750KB)
async function compressImageFile(file: File | Blob, maxWidth = 1600, maxHeight = 2200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = () => {
        // Fallback: If image decode fails in browser canvas (e.g. HEIC / special formats), resolve dataUrl directly
        resolve(dataUrl);
      };

      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Rotate image 90 degrees clockwise
async function rotateImageFile(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Boost contrast for faint or thermal receipts
async function boostImageContrast(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.filter = 'contrast(135%) brightness(105%)';
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Generate demo bill image on HTML5 canvas for testing
function generateDemoBillDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 650;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, 650, 800);

  // Border & Header Box
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 610, 760);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ใบส่งของ / ใบแจ้งหนี้ (DELIVERY ORDER)', 40, 65);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('ผู้จำหน่าย: บจก. สยามกลการอะไหล่มอเตอร์ไซค์ ท่าบ่อ', 40, 95);
  ctx.fillText('ลูกค้า: CRC THABO (ร้านยางและอะไหล่)', 40, 120);
  ctx.fillText(`เลขที่บิล: INV-2026-${Math.floor(1000 + Math.random() * 9000)}`, 400, 95);
  ctx.fillText(`วันที่: ${new Date().toISOString().slice(0, 10)}`, 400, 120);

  // Table Header
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(40, 150, 570, 32);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(40, 150, 570, 32);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ลำดับ', 50, 171);
  ctx.fillText('รายการสินค้า', 100, 171);
  ctx.fillText('จำนวน', 330, 171);
  ctx.fillText('หน่วย', 390, 171);
  ctx.fillText('ราคา/หน่วย', 450, 171);
  ctx.fillText('รวมเงิน', 540, 171);

  // Rows
  const sampleItems = [
    { no: '1', name: 'ยางนอก IRC SCT-001 120/70-14 TL', qty: '4', unit: 'เส้น', price: '680.00', total: '2,720.00' },
    { no: '2', name: 'ยางนอก Michelin City Grip 90/90-14 TL', qty: '6', unit: 'เส้น', price: '590.00', total: '3,540.00' },
    { no: '3', name: 'น้ำมันเครื่อง Castrol Power1 10W-40 0.8L', qty: '12', unit: 'ขวด', price: '135.00', total: '1,620.00' },
    { no: '4', name: 'หัวเทียน NGK CR7HSA Wave110i', qty: '10', unit: 'ชิ้น', price: '65.00', total: '650.00' },
    { no: '5', name: 'ผ้าเบรกหน้า Bendix MD25 Honda Wave', qty: '5', unit: 'ชุด', price: '120.00', total: '600.00' },
  ];

  let y = 210;
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#1E293B';
  sampleItems.forEach((it) => {
    ctx.fillText(it.no, 55, y);
    ctx.fillText(it.name, 100, y);
    ctx.fillText(it.qty, 345, y);
    ctx.fillText(it.unit, 395, y);
    ctx.fillText(it.price, 455, y);
    ctx.fillText(it.total, 540, y);
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(40, y + 10);
    ctx.lineTo(610, y + 10);
    ctx.stroke();
    y += 40;
  });

  // Footer Total
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('ยอดรวมสุทธิ (Grand Total):', 350, y + 30);
  ctx.fillStyle = '#D97706';
  ctx.fillText('9,130.00 บาท', 520, y + 30);

  ctx.fillStyle = '#64748B';
  ctx.font = 'italic 11px sans-serif';
  ctx.fillText('* สินค้าได้รับครบถ้วนตามรายการ ถูกต้องเรียบร้อย', 40, y + 70);

  return canvas.toDataURL('image/jpeg', 0.9);
}

export const BillScannerModal: React.FC<BillScannerModalProps> = ({
  isOpen,
  onClose,
  existingCatalog,
  onBatchSaveProducts,
  onSuccessNotice,
}) => {
  // Step: 'capture' | 'review'
  const [step, setStep] = useState<'capture' | 'review'>('capture');

  // Capture mode: 'camera' | 'upload'
  const [inputMode, setInputMode] = useState<'camera' | 'upload'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // AI Model Selection state: 'auto' | 'gemini-3.8-flash' | 'gemini-flash-latest' | 'gemini-3.1-flash-lite'
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gemini-3.8-flash' | 'gemini-flash-latest' | 'gemini-3.1-flash-lite'>('auto');
  const [usedModel, setUsedModel] = useState<string>('gemini-3.8-flash');
  const [isRotating, setIsRotating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Extracted Bill Data & Review state
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [summaryNote, setSummaryNote] = useState('');
  const [extractedItems, setExtractedItems] = useState<ExtractedBillItem[]>([]);
  const [destinationLocation, setDestinationLocation] = useState<'front' | 'warehouse'>('front');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Manual Merge state
  const [mergingItemId, setMergingItemId] = useState<string | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup camera stream
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start camera
  const startCamera = async () => {
    stopCameraStream();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง หรือเลือกอัปโหลดไฟล์ภาพแทน');
      setIsCameraActive(false);
    }
  };

  // Toggle front/back camera
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Whenever inputMode is camera or facingMode changes, manage camera
  useEffect(() => {
    if (isOpen && inputMode === 'camera' && !imagePreview) {
      startCamera();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, inputMode, facingMode, imagePreview]);

  // Handle snap photo from video
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setImagePreview(dataUrl);
    stopCameraStream();
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAnalysisError(null);
      const compressed = await compressImageFile(file);
      setImagePreview(compressed);
    } catch (err: any) {
      console.error('File compression error:', err);
      setAnalysisError('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + (err?.message || ''));
    } finally {
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  // Handle load demo bill
  const handleLoadDemoBill = () => {
    const demoUrl = generateDemoBillDataUrl();
    setImagePreview(demoUrl);
    setAnalysisError(null);
  };

  // Handle rotate image 90 degrees
  const handleRotateImage = async () => {
    if (!imagePreview || isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageFile(imagePreview);
      setImagePreview(rotated);
    } catch (e) {
      console.warn('Rotate failed:', e);
    } finally {
      setIsRotating(false);
    }
  };

  // Handle boost image contrast for faint receipts
  const handleEnhanceImage = async () => {
    if (!imagePreview || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await boostImageContrast(imagePreview);
      setImagePreview(enhanced);
    } catch (e) {
      console.warn('Enhance failed:', e);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Call Server-side Gemini API (/api/gemini/analyze-invoice)
  const handleAnalyzeBill = async (overrideModel?: string) => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    const modelToUse = overrideModel || selectedModel;

    try {
      // Send only a lightweight sample (first 25 items) to keep payload small and fast
      const payloadCatalog = existingCatalog.slice(0, 25).map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        size: c.size,
        barcode: c.barcode,
      }));

      const res = await fetch('/api/gemini/analyze-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          imageBase64: imagePreview,
          mimeType: 'image/jpeg',
          catalog: payloadCatalog,
          preferredModel: modelToUse,
        }),
      });

      const responseText = await res.text();
      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        if (res.status === 405) {
          throw new Error(
            'เกิดข้อผิดพลาด 405 บน Vercel: เนื่องจาก Vercel ยังไม่ได้อัปเดตไฟล์ API ล่าสุด กรุณารอ Deploy อัปเดตใหม่ หรือเปิดใช้งานผ่าน AI Studio'
          );
        } else if (res.status === 413) {
          throw new Error('รูปภาพมีขนาดไฟล์ใหญ่เกินไป กรุณาถ่ายภาพใหม่หรือลดขนาดภาพ');
        } else if (res.status === 504 || res.status === 502) {
          throw new Error('การประมวลผลบิลใช้เวลานานเกินไป กรุณากด "ลองสแกนอีกครั้ง" หรือเลือกโมเดล Gemini Flash-Lite');
        }
        throw new Error(
          `เกิดข้อผิดพลาดในการรับข้อมูลจากเซิร์ฟเวอร์ (${res.status}): ${
            responseText.slice(0, 100) || 'ไม่มีข้อความตอบกลับ'
          }`
        );
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถวิเคราะห์บิลได้ กรุณาลองใหม่อีกครั้ง');
      }

      const data: BillData = result.data;
      setUsedModel(result.model || (modelToUse === 'auto' ? 'gemini-3.8-flash' : modelToUse));
      setSupplier(data.supplier || 'ร้านค้าคู่ค้า');
      setInvoiceNo(data.invoiceNo || `BILL-${Date.now().toString().slice(-4)}`);
      setInvoiceDate(data.date || new Date().toISOString().slice(0, 10));
      setSummaryNote(data.summary || '');

      // Parse items
      const rawItems = Array.isArray(data.items) ? data.items : [];
      if (rawItems.length === 0) {
        throw new Error('ไม่พบรายการสินค้าในภาพบิลนี้ กรุณาถ่ายภาพให้เห็นตารางรายการสินค้าชัดเจนขึ้น');
      }

      const formattedItems: ExtractedBillItem[] = rawItems.map((item, idx) => {
        const cost = Number(item.costPrice) || 0;
        let sell = Number(item.sellingPrice) || 0;
        if (sell <= cost && cost > 0) {
          const raw = cost * 1.25;
          sell = raw >= 100 ? Math.round(raw / 10) * 10 : Math.round(raw);
        }

        // Check if matched in catalog
        const matched = item.matchedProduct || existingCatalog.find((c) => c.id === item.matchedCatalogId) || null;

        return {
          id: `item-${Date.now()}-${idx}`,
          rawName: item.rawName || item.name,
          name: item.name || item.rawName || `สินค้าใหม่ #${idx + 1}`,
          brand: item.brand || matched?.brand || '',
          size: item.size || matched?.size || '',
          category: item.category || matched?.category || 'อะไหล่ทั่วไป',
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit: item.unit || matched?.unit || 'ชิ้น',
          costPrice: cost,
          sellingPrice: sell,
          lineTotal: (Number(item.quantity) || 1) * cost,
          barcode: item.barcode || matched?.barcode || '',
          matchedCatalogId: matched?.id || null,
          matchedProduct: matched,
          isNew: !matched,
          selected: true,
        };
      });

      setExtractedItems(formattedItems);
      setStep('review');
    } catch (err: any) {
      console.error('Invoice analysis error:', err);
      setAnalysisError(err?.message || 'เกิดข้อผิดพลาดในการประมวลผลบิลด้วย AI');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle selection of item
  const handleToggleSelect = (id: string) => {
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select / Deselect all
  const handleToggleSelectAll = () => {
    const allSelected = extractedItems.every((it) => it.selected);
    setExtractedItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
  };

  // Update item field
  const handleUpdateItem = (id: string, updates: Partial<ExtractedBillItem>) => {
    setExtractedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.costPrice !== undefined || updates.quantity !== undefined) {
          updated.lineTotal = (updated.quantity || 1) * (updated.costPrice || 0);
        }
        return updated;
      })
    );
  };

  // Remove item row
  const handleDeleteItem = (id: string) => {
    setExtractedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Add manual empty row
  const handleAddManualRow = () => {
    const newItem: ExtractedBillItem = {
      id: `manual-${Date.now()}`,
      rawName: '',
      name: '',
      brand: '',
      size: '',
      category: 'อะไหล่ทั่วไป',
      quantity: 1,
      unit: 'ชิ้น',
      costPrice: 0,
      sellingPrice: 0,
      lineTotal: 0,
      barcode: '',
      isNew: true,
      selected: true,
    };
    setExtractedItems((prev) => [...prev, newItem]);
  };

  // Reset back to capture
  const handleReset = () => {
    setImagePreview(null);
    setExtractedItems([]);
    setAnalysisError(null);
    setStep('capture');
  };

  // Save selected items into Firestore & inventory
  const handleConfirmSave = async () => {
    const selectedItems = extractedItems.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      setSaveError('กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการเพื่อบันทึก');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const itemsToCreate: Array<Omit<ProductItem, 'id'>> = [];
      const itemsToUpdate: Array<{ id: string; updates: Partial<ProductItem> }> = [];

      selectedItems.forEach((item, idx) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const cost = Number(item.costPrice) || 0;
        const sell = Number(item.sellingPrice) || 0;

        const matched =
          item.matchedProduct ||
          (item.matchedCatalogId ? existingCatalog.find((c) => c.id === item.matchedCatalogId) : null);

        if (matched && !item.isNew) {
          // Existing product: increase stock accurately using getProductStockBreakdown
          const breakdown = getProductStockBreakdown(matched);
          const currentFront = breakdown.frontQty;
          const currentWarehouse = breakdown.warehouseQty;

          const newFront = destinationLocation === 'front' ? currentFront + qty : currentFront;
          const newWarehouse = destinationLocation === 'warehouse' ? currentWarehouse + qty : currentWarehouse;
          const newTotal = newFront + newWarehouse;

          itemsToUpdate.push({
            id: matched.id,
            updates: {
              frontQty: newFront,
              warehouseQty: newWarehouse,
              systemQty: newTotal,
              actualQty: newTotal,
              costPrice: cost > 0 ? cost : matched.costPrice,
              sellingPrice: sell > 0 ? sell : matched.sellingPrice,
              updatedAt: new Date().toISOString(),
            },
          });
        } else {
          // New product
          const autoBarcode =
            item.barcode?.trim() ||
            `CRC-${Date.now().toString().slice(-6)}-${(idx + 1).toString().padStart(2, '0')}`;

          const newProduct: Omit<ProductItem, 'id'> = {
            barcode: autoBarcode,
            name: item.name.trim() || `สินค้าใหม่ (${item.rawName || 'บิล'})`,
            unit: item.unit || 'ชิ้น',
            costPrice: cost,
            sellingPrice: sell,
            category: item.category || 'อะไหล่ทั่วไป',
            brand: item.brand?.trim() || '',
            size: item.size?.trim() || '',
            frontQty: destinationLocation === 'front' ? qty : 0,
            warehouseQty: destinationLocation === 'warehouse' ? qty : 0,
            frontLocation: destinationLocation === 'front' ? 'หน้าร้าน A' : '',
            location: destinationLocation === 'warehouse' ? 'RACK A-01' : '',
            systemQty: qty,
            actualQty: qty,
            status: 'checked',
            minStock: 2,
            minFrontStock: 2,
            description: `รับเข้าจากบิล: ${supplier || 'ทั่วไป'} ${invoiceNo ? `เลขที่ ${invoiceNo}` : ''}`.trim(),
            updatedAt: new Date().toISOString(),
          };

          itemsToCreate.push(newProduct);
        }
      });

      await onBatchSaveProducts(itemsToCreate, itemsToUpdate);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      const totalCount = itemsToCreate.length + itemsToUpdate.length;
      const message = `✅ เพิ่มสินค้าและอัปเดตสต็อกเรียบร้อยแล้ว ${totalCount} รายการ (สินค้าใหม่ ${itemsToCreate.length} ชิ้น, อัปเดต ${itemsToUpdate.length} ชิ้น)`;
      if (onSuccessNotice) {
        onSuccessNotice(message);
      }

      // Close modal
      handleClose();
    } catch (err: any) {
      console.error('Batch save error:', err);
      setSaveError(err?.message || 'ไม่สามารถบันทึกสินค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopCameraStream();
    setImagePreview(null);
    setExtractedItems([]);
    setStep('capture');
    setIsAnalyzing(false);
    setIsSaving(false);
    setAnalysisError(null);
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = extractedItems.filter((i) => i.selected).length;
  const totalPieces = extractedItems
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalCost = extractedItems
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + (Number(i.lineTotal) || (Number(i.quantity) || 0) * (Number(i.costPrice) || 0)), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#20262D] border border-[#3A4750] w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#3A4750] flex items-center justify-between bg-[#252C33]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F6C90E] to-amber-500 text-slate-950 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[#EEEEEE]">
                  AI ถ่ายรูปบิลเพิ่มสินค้าใหม่
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F6C90E]/20 text-[#F6C90E] border border-[#F6C90E]/40">
                  Gemini Flash
                </span>
              </div>
              <p className="text-xs text-[#A0ABB5]">
                {step === 'capture'
                  ? 'ถ่ายรูปหรืออัปโหลดบิลส่งของ/ใบเสร็จ AI จะสกัดชื่อสินค้า ต้นทุน และจำนวนให้อัตโนมัติ'
                  : `ตรวจสอบและปรับแต่งรายการสินค้าที่สกัดได้จากบิล (${extractedItems.length} รายการ)`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* STEP 1: CAPTURE & UPLOAD SCREEN */}
          {step === 'capture' && (
            <div className="space-y-4">
              {/* Method Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Gallery / Scanned file picker */}
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('upload');
                    stopCameraStream();
                    galleryInputRef.current?.click();
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all group ${
                    inputMode === 'upload' && !imagePreview
                      ? 'bg-[#2A343D] border-[#F6C90E] shadow-sm'
                      : 'bg-[#252C33] border-[#3A4750] hover:border-[#F6C90E]/60 text-[#EEEEEE]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#3A4750] group-hover:bg-[#F6C90E] group-hover:text-slate-950 text-[#F6C90E] flex items-center justify-center transition-colors">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors">
                    เลือกรูปจากอัลบั้ม
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] line-clamp-1">
                    คลังภาพ / ไฟล์บิลสแกน
                  </span>
                </button>

                {/* 2. Direct mobile camera */}
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('upload');
                    stopCameraStream();
                    cameraInputRef.current?.click();
                  }}
                  className="p-3 rounded-xl bg-[#252C33] border border-[#3A4750] hover:border-[#F6C90E]/60 text-left flex flex-col gap-1 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#3A4750] group-hover:bg-[#F6C90E] group-hover:text-slate-950 text-[#F6C90E] flex items-center justify-center transition-colors">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors">
                    ถ่ายรูปด้วยกล้อง
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] line-clamp-1">
                    เปิดแอปกล้องมือถือถ่ายทันที
                  </span>
                </button>

                {/* 3. Live webcam video */}
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('camera');
                    setImagePreview(null);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all group ${
                    inputMode === 'camera' && !imagePreview
                      ? 'bg-[#2A343D] border-[#F6C90E] shadow-sm'
                      : 'bg-[#252C33] border-[#3A4750] hover:border-[#F6C90E]/60 text-[#EEEEEE]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#3A4750] group-hover:bg-[#F6C90E] group-hover:text-slate-950 text-[#F6C90E] flex items-center justify-center transition-colors">
                    <FlipHorizontal className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors">
                    กล้องเว็บแคมสด
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] line-clamp-1">
                    ส่องภาพสดในเบราว์เซอร์
                  </span>
                </button>

                {/* 4. Demo bill */}
                <button
                  type="button"
                  onClick={handleLoadDemoBill}
                  className="p-3 rounded-xl bg-[#252C33] border border-amber-500/40 hover:border-amber-400 text-left flex flex-col gap-1 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-amber-300">
                    ทดลองบิลตัวอย่าง
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] line-clamp-1">
                    คลิกเดียวทดสอบ AI ทันที
                  </span>
                </button>
              </div>

              {/* Hidden File Inputs */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,.jpg,.jpeg,.png,.webp,.heic,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Camera Preview Mode */}
              {inputMode === 'camera' && !imagePreview && (
                <div className="relative bg-black rounded-2xl overflow-hidden border border-[#3A4750] aspect-[4/3] max-h-[420px] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {cameraError && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center text-rose-400 gap-2">
                      <AlertCircle className="w-10 h-10" />
                      <p className="text-xs font-medium">{cameraError}</p>
                      <button
                        onClick={startCamera}
                        className="mt-2 px-4 py-2 bg-[#F6C90E] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> ลองใหม่อีกครั้ง
                      </button>
                    </div>
                  )}

                  {/* Camera Controls Overlay */}
                  {isCameraActive && !cameraError && (
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-4">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="w-11 h-11 rounded-full bg-black/60 text-white border border-white/20 flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all shadow-lg"
                        title="สลับกล้องหน้า/หลัง"
                      >
                        <FlipHorizontal className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSnapPhoto}
                        className="w-16 h-16 rounded-full bg-[#F6C90E] hover:bg-[#E5B800] text-slate-950 p-1.5 shadow-xl active:scale-90 transition-all flex items-center justify-center border-4 border-white/80"
                        title="กดเพื่อถ่ายภาพบิล"
                      >
                        <div className="w-11 h-11 rounded-full bg-slate-950 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-[#F6C90E]" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Guide Frame Overlay */}
                  <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-[#F6C90E]/60 rounded-xl flex items-start justify-center pt-2">
                    <span className="bg-black/70 text-[#F6C90E] text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      วางบิลให้อยู่ในกรอบ และให้เห็นตัวอักษรชัดเจน
                    </span>
                  </div>
                </div>
              )}

              {/* Upload Dropzone Mode */}
              {inputMode === 'upload' && !imagePreview && (
                <div
                  onClick={() => galleryInputRef.current?.click()}
                  className="bg-[#252C33] border-2 border-dashed border-[#3A4750] hover:border-[#F6C90E] rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all space-y-4 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#3A4750] group-hover:bg-[#F6C90E]/20 text-[#A0ABB5] group-hover:text-[#F6C90E] flex items-center justify-center mx-auto transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#EEEEEE]">
                      คลิกเพื่อเลือกภาพถ่ายบิล หรือเอกสารบิลสแกนจากเครื่อง
                    </p>
                    <p className="text-xs text-[#A0ABB5] mt-1">
                      รองรับไฟล์ภาพ JPEG, PNG, WebP หรือรูปจากอัลบั้มมือถือ/คอมพิวเตอร์
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        galleryInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F6C90E] text-slate-950 text-xs font-bold hover:bg-[#E5B800] shadow-sm transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      เปิดคลังรูปภาพ / อัลบั้ม
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cameraInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3A4750] text-[#EEEEEE] text-xs font-semibold hover:bg-[#43525D] transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#F6C90E]" />
                      ถ่ายด้วยกล้องมือถือ
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview & Ready to Analyze */}
              {imagePreview && (
                <div className="bg-[#252C33] rounded-2xl p-4 border border-[#3A4750] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#EEEEEE] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      รูปภาพพร้อมสำหรับการวิเคราะห์
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        if (inputMode === 'camera') startCamera();
                      }}
                      className="text-xs text-[#A0ABB5] hover:text-[#EEEEEE] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      ถ่ายใหม่ / เลือกรูปอื่น
                    </button>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black max-h-[360px] flex items-center justify-center border border-[#3A4750]">
                    <img
                      src={imagePreview}
                      alt="Bill Preview"
                      className="max-h-[360px] w-auto object-contain"
                    />

                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F6C90E] to-amber-500 animate-spin flex items-center justify-center p-1">
                            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
                              <Sparkles className="w-7 h-7 text-[#F6C90E] animate-pulse" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-[#EEEEEE]">
                            Gemini AI กำลังอ่านและวิเคราะห์บิล...
                          </p>
                          <p className="text-xs text-[#A0ABB5] max-w-xs">
                            กำลังสกัดชื่อสินค้า ยี่ห้อ สเปก ราคาต้นทุน จำนวน และจับคู่กับคลังสินค้า
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {analysisError && (
                    <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  {!isAnalyzing && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeBill()}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#F6C90E] via-amber-400 to-[#F6C90E] hover:from-[#E5B800] hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F6C90E]/20 active:scale-[0.98] transition-all"
                    >
                      <Sparkles className="w-5 h-5 fill-slate-950" />
                      <span>สแกนและดึงข้อมูลสินค้าด้วย AI ทันที</span>
                    </button>
                  )}
                </div>
              )}

              {/* Tips Banner */}
              <div className="bg-[#252C33]/80 rounded-xl p-3.5 border border-[#3A4750] flex items-start gap-3 text-xs text-[#A0ABB5]">
                <Info className="w-4 h-4 text-[#F6C90E] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[#EEEEEE]">
                    💡 คำแนะนำเพื่อความแม่นยำสูงสุดในการสแกนบิล:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-[#A0ABB5]">
                    <li>
                      <strong className="text-amber-300">ใช้ภาพสแกนเอกสาร:</strong> หากใช้แอปสแกนเนอร์ เช่น CamScanner หรือ Google Drive Scan ถ่ายภาพบิลให้ขอบตรง แสงสว่างสม่ำเสมอ AI จะอ่านชื่อ รหัสอะไหล่ และราคาได้แม่นยำสูงสุด 100%
                    </li>
                    <li>
                      <strong>กรณีถ่ายด้วยกล้อง:</strong> ควรวางกระดาษบิลบนพื้นราบ แสงสว่างเพียงพอ ไม่ให้มีเงาบังหรือแสงไฟสะท้อนบนกระดาษ
                    </li>
                    <li>
                      <strong>รองรับทุกรูปแบบ:</strong> บิลส่งของ ใบเสร็จ ใบสั่งของจากร้านค้าหรือผู้แทนจำหน่าย (เช่น IRC, Michelin, บางจาก, YUASA ฯลฯ)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT EXTRACTED ITEMS SCREEN */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Bill Meta & Target Location Banner */}
              <div className="bg-[#252C33] rounded-2xl p-4 border border-[#3A4750] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3A4750] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-[#EEEEEE]">
                      ผลการวิเคราะห์จากบิล ({extractedItems.length} รายการ)
                    </span>
                    {summaryNote && (
                      <span className="text-[11px] text-[#A0ABB5] hidden sm:inline">
                        • {summaryNote}
                      </span>
                    )}
                  </div>

                  {/* Destination Location Toggle */}
                  <div className="flex items-center gap-2 bg-[#20262D] p-1 rounded-xl border border-[#3A4750]">
                    <span className="text-[11px] font-semibold text-[#A0ABB5] pl-2">
                      บันทึกเข้าที่:
                    </span>
                    <button
                      type="button"
                      onClick={() => setDestinationLocation('front')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        destinationLocation === 'front'
                          ? 'bg-[#F6C90E] text-slate-950 shadow-sm'
                          : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>หน้าร้าน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationLocation('warehouse')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        destinationLocation === 'warehouse'
                          ? 'bg-[#F6C90E] text-slate-950 shadow-sm'
                          : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
                      }`}
                    >
                      <Warehouse className="w-3.5 h-3.5" />
                      <span>คลังหลังร้าน</span>
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                    <button type="button" onClick={() => setSaveError(null)} className="text-rose-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Editable Bill Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                      ชื่อผู้จำหน่าย / บริษัท
                    </label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="เช่น บจก. สยามกลการ"
                      className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                      เลขที่บิล / เอกสาร
                    </label>
                    <input
                      type="text"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      placeholder="INV-..."
                      className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                      วันที่ในบิล
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                    />
                  </div>
                </div>
              </div>

              {/* Items Actions Bar */}
              <div className="flex items-center justify-between text-xs px-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 text-[#EEEEEE] hover:text-[#F6C90E] font-semibold transition-colors"
                >
                  {extractedItems.every((i) => i.selected) ? (
                    <CheckSquare className="w-4 h-4 text-[#F6C90E]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#A0ABB5]" />
                  )}
                  <span>
                    เลือกทั้งหมด ({selectedCount}/{extractedItems.length} รายการ)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-2.5 py-1 rounded-xl bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span>เพิ่มรายการเอง</span>
                </button>
              </div>

              {/* Items Cards / Table */}
              <div className="space-y-3">
                {extractedItems.map((item, idx) => {
                  const profit = (item.sellingPrice || 0) - (item.costPrice || 0);
                  const marginPct =
                    item.costPrice > 0 ? Math.round((profit / item.costPrice) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-3.5 border transition-all ${
                        item.selected
                          ? 'bg-[#252C33] border-[#475662]'
                          : 'bg-[#20262D]/60 border-[#3A4750]/40 opacity-60'
                      }`}
                    >
                      {/* Item Top Row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="p-1 text-[#F6C90E] hover:opacity-80"
                          >
                            {item.selected ? (
                              <CheckSquare className="w-4 h-4 text-[#F6C90E]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#A0ABB5]" />
                            )}
                          </button>
                          <span className="text-xs font-bold text-[#A0ABB5]">#{idx + 1}</span>

                          {/* New vs Matched Badge & Manual Merge Button */}
                          {item.isNew ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                สินค้าใหม่ ✨
                              </span>
                              <button
                                type="button"
                                onClick={() => setMergingItemId(item.id)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1 transition-all"
                                title="คลิกเพื่อเลือกสินค้าในคลังมาผูก/รวมกับรายการนี้"
                              >
                                <span>🔗 ผูกกับสินค้าเดิม (Merge)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-sky-400" />
                                มีในระบบแล้ว ({item.matchedProduct?.name || ''})
                              </span>
                              <button
                                type="button"
                                onClick={() => setMergingItemId(item.id)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-1 transition-all"
                                title="เปลี่ยนสินค้าที่ผูก หรือตั้งเป็นสินค้าใหม่"
                              >
                                <span>เปลี่ยนสินค้า / แยกเป็นสินค้าใหม่</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-[#A0ABB5] hover:text-rose-400 rounded-lg hover:bg-[#3A4750] transition-colors"
                          title="ลบรายการนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Main Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        {/* Product Name */}
                        <div className="sm:col-span-5">
                          <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                            ชื่อสินค้า (ภาษาไทย)
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                            placeholder="เช่น ยางนอก IRC SCT-001 120/70-14"
                            className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] font-medium focus:outline-none focus:border-[#F6C90E]"
                          />
                        </div>

                        {/* Category */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                            หมวดหมู่
                          </label>
                          <select
                            value={item.category}
                            onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                            className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity & Unit */}
                        <div className="sm:col-span-4 flex items-center gap-1.5">
                          <div className="flex-1">
                            <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                              จำนวนรับเข้า
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] font-bold text-center focus:outline-none focus:border-[#F6C90E]"
                            />
                          </div>
                          <div className="w-20">
                            <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                              หน่วยนับ
                            </label>
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                              className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2 py-1.5 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Cost Price */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                            ราคาทุน/ชิ้น (฿)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.costPrice || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                costPrice: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] font-mono focus:outline-none focus:border-[#F6C90E]"
                          />
                        </div>

                        {/* Selling Price */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                            ราคาขายปลีก (฿)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.sellingPrice || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                sellingPrice: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#F6C90E] font-bold font-mono focus:outline-none focus:border-[#F6C90E]"
                          />
                        </div>

                        {/* Barcode / Code */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-[#A0ABB5] font-semibold block mb-1">
                            รหัสสินค้า / บาร์โค้ด
                          </label>
                          <input
                            type="text"
                            value={item.barcode || ''}
                            onChange={(e) => handleUpdateItem(item.id, { barcode: e.target.value })}
                            placeholder="เว้นว่างเพื่อสร้างรหัสอัตโนมัติ"
                            className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-2.5 py-1.5 text-xs text-[#EEEEEE] font-mono focus:outline-none focus:border-[#F6C90E]"
                          />
                        </div>

                        {/* Profit preview badge */}
                        <div className="sm:col-span-3 flex flex-col justify-end">
                          <div className="bg-[#20262D] rounded-xl px-2.5 py-1.5 border border-[#475662]/60 flex items-center justify-between text-[11px]">
                            <span className="text-[#A0ABB5]">กำไร/ชิ้น:</span>
                            <span
                              className={`font-bold font-mono ${
                                profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              ฿{profit.toLocaleString()} ({marginPct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#3A4750] bg-[#252C33]/90 flex flex-wrap items-center justify-between gap-3">
          {step === 'review' ? (
            <>
              <div className="flex items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[#A0ABB5] hover:text-[#EEEEEE] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  สแกนรูปใหม่
                </button>

                <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-[#3A4750]">
                  <span className="text-[#A0ABB5]">
                    เลือก <strong className="text-[#EEEEEE]">{selectedCount}</strong> รายการ
                  </span>
                  <span className="text-[#A0ABB5]">
                    รวม <strong className="text-[#F6C90E]">{totalPieces}</strong> ชิ้น
                  </span>
                  <span className="text-[#A0ABB5]">
                    ทุนรวม <strong className="text-emerald-400 font-mono">฿{totalCost.toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  disabled={selectedCount === 0 || isSaving}
                  onClick={handleConfirmSave}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#F6C90E] to-amber-500 hover:from-[#E5B800] hover:to-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-[#F6C90E]/20 active:scale-95 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>กำลังบันทึกสินค้า...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3] text-slate-950" />
                      <span>
                        ยืนยันบันทึกสินค้า {selectedCount} รายการ ({destinationLocation === 'front' ? 'หน้าร้าน' : 'คลังหลังร้าน'})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-[#A0ABB5]">
                ระบบจะใช้โมเดล Gemini Flash ในการสแกนและสกัดข้อมูล
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Manual Merge Catalog Modal */}
      {mergingItemId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#252C33] border border-[#475662] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#3A4750] flex items-center justify-between bg-[#20262D]">
              <div>
                <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-2">
                  <span className="text-[#F6C90E]">🔗</span> ผูกรายการบิลนี้กับสินค้าที่มีอยู่แล้วในคลัง (Manual Merge)
                </h3>
                <p className="text-[11px] text-[#A0ABB5] mt-0.5">
                  เลือกสินค้าในคลังที่ตรงกับรายการนี้ เพื่อให้อัปสต็อกเข้าสินค้าเดิมแทนการสร้างสินค้าใหม่
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMergingItemId(null)}
                className="p-1.5 text-[#A0ABB5] hover:text-[#EEEEEE] rounded-lg hover:bg-[#3A4750]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[#3A4750] bg-[#20262D]/50 flex flex-col gap-3">
              <input
                type="text"
                value={catalogSearchQuery}
                onChange={(e) => setCatalogSearchQuery(e.target.value)}
                placeholder="🔍 ค้นหาชื่อสินค้า, แบรนด์, หรือบาร์โค้ดในคลัง..."
                className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] focus:outline-none focus:border-[#F6C90E]"
                autoFocus
              />

              <button
                type="button"
                onClick={() => {
                  handleUpdateItem(mergingItemId, {
                    matchedCatalogId: null,
                    matchedProduct: null,
                    isNew: true,
                  });
                  setMergingItemId(null);
                }}
                className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>✨ ตั้งเป็นสินค้าใหม่ (ไม่ผูกกับใคร สร้างรายการใหม่)</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {existingCatalog
                .filter((p) => {
                  const q = catalogSearchQuery.toLowerCase();
                  if (!q) return true;
                  return (
                    p.name?.toLowerCase().includes(q) ||
                    p.brand?.toLowerCase().includes(q) ||
                    p.barcode?.toLowerCase().includes(q) ||
                    p.category?.toLowerCase().includes(q)
                  );
                })
                .slice(0, 50)
                .map((product) => (
                  <div
                    key={product.id}
                    className="p-3 bg-[#20262D] hover:bg-[#2A343D] border border-[#3A4750] rounded-xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#252C33] border border-[#475662] flex items-center justify-center overflow-hidden shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Tag className="w-5 h-5 text-[#A0ABB5]" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#EEEEEE]">{product.name}</div>
                        <div className="text-[10px] text-[#A0ABB5] flex items-center gap-2 mt-0.5">
                          <span>บาร์โค้ด: <strong className="font-mono text-[#F6C90E]">{product.barcode || '-'}</strong></span>
                          <span>แบรนด์: {product.brand || '-'}</span>
                          <span>หมวดหมู่: {product.category || '-'}</span>
                          <span>สต็อกเดิม: <strong className="text-emerald-400">{product.systemQty ?? product.actualQty ?? 0} {product.unit}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!mergingItemId) return;
                        const billItem = extractedItems.find((it) => it.id === mergingItemId);
                        handleUpdateItem(mergingItemId, {
                          matchedCatalogId: product.id,
                          matchedProduct: product,
                          isNew: false,
                          name: product.name,
                          brand: product.brand || billItem?.brand || '',
                          category: product.category || billItem?.category || 'อะไหล่ทั่วไป',
                          unit: product.unit || billItem?.unit || 'ชิ้น',
                          costPrice: billItem && billItem.costPrice > 0 ? billItem.costPrice : (product.costPrice || 0),
                          sellingPrice: billItem && billItem.sellingPrice > 0 ? billItem.sellingPrice : (product.sellingPrice || 0),
                          barcode: product.barcode || billItem?.barcode || '',
                        });
                        setMergingItemId(null);
                      }}
                      className="px-3 py-1.5 bg-[#F6C90E] hover:bg-[#E5B800] text-slate-950 font-black rounded-xl text-xs shrink-0 flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                    >
                      <span>🔗 เลือกผูกสินค้านี้</span>
                    </button>
                  </div>
                ))}

              {existingCatalog.length === 0 && (
                <div className="text-center py-10 text-xs text-[#A0ABB5]">
                  ไม่มีสินค้าในคลัง
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#3A4750] bg-[#20262D] flex justify-end">
              <button
                type="button"
                onClick={() => setMergingItemId(null)}
                className="px-4 py-2 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] rounded-xl text-xs font-semibold"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
