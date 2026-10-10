import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Save,
  Camera,
  ScanBarcode,
  Upload,
  CheckCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Layers,
  Tag,
  DollarSign,
  TrendingUp,
  Store,
  Warehouse,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProductItem, CustomerGrade } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { resolveProductImage } from '../utils/productImages';
import { uploadProductImageToStorage } from '../firebase';
import { getProductStockBreakdown, cleanLocationName } from '../utils/stockUtils';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<ProductItem, 'id'>, id?: string) => Promise<void>;
  onDelete?: (product: ProductItem) => void;
  initialProduct?: ProductItem | null;
  initialTire?: ProductItem | null; // Compatibility alias
}

// Compress image via offscreen Canvas to keep storage super lightweight (<35KB)
async function compressImageFile(file: File, maxWidth = 480, maxHeight = 480, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Common units for fast selection
const COMMON_UNITS = ['เส้น', 'ชิ้น', 'คู่', 'อัน', 'ชุด', 'กล่อง', 'ลัง', 'ขวด', 'กระป๋อง', 'ม้วน'];

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialProduct,
  initialTire,
}) => {
  const currentItem = initialProduct || initialTire;

  // The 6 Core Fields requested by user:
  // 1. รหัสสินค้า (Barcode / Code)
  // 2. ชื่อสินค้า (Product Name)
  // 3. หน่วยนับ (Unit)
  // 4. ราคาซื้อ (Cost Price)
  // 5. ราคาขาย (Selling Price)
  // 6. รูปภาพ (Image URL / Photo)
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('ชิ้น');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [imageUrl, setImageUrl] = useState('');

  // Multi-location Stock fields (หน้าร้าน vs คลังสินค้า)
  const [frontQty, setFrontQty] = useState<number>(1);
  const [warehouseQty, setWarehouseQty] = useState<number>(0);
  const [frontLocation, setFrontLocation] = useState('');
  const [location, setLocation] = useState('');
  const [minFrontStock, setMinFrontStock] = useState<number>(2);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  
  // Unit conversion for retail / wholesale
  const [subUnit, setSubUnit] = useState('');
  const [conversionRate, setConversionRate] = useState<number | ''>('');

  // Custom grade pricing per product (Grade A, B, C, D)
  const [gradePrices, setGradePrices] = useState<Partial<Record<CustomerGrade, number | ''>>>({
    A: '',
    B: '',
    C: '',
    D: '',
  });
  const [showGradePricing, setShowGradePricing] = useState(false);

  // Scanner & UI states
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentItem) {
      const breakdown = getProductStockBreakdown(currentItem);
      setBarcode(currentItem.barcode || '');
      setName(currentItem.name || currentItem.size || '');
      setUnit(currentItem.unit || 'ชิ้น');
      setCostPrice(currentItem.costPrice !== undefined ? currentItem.costPrice : '');
      setSellingPrice(
        currentItem.sellingPrice !== undefined
          ? currentItem.sellingPrice
          : currentItem.price !== undefined
          ? currentItem.price
          : ''
      );
      setImageUrl(currentItem.imageUrl || resolveProductImage(currentItem) || '');
      setFrontQty(breakdown.frontQty);
      setWarehouseQty(breakdown.warehouseQty);
      setFrontLocation(cleanLocationName(currentItem.frontLocation));
      setLocation(cleanLocationName(currentItem.location || 'RACK A-01'));
      setMinFrontStock(currentItem.minFrontStock !== undefined ? currentItem.minFrontStock : 2);
      setBrand(currentItem.brand || '');
      setCategory(currentItem.category || '');
      setDescription(currentItem.description || '');
      setSubUnit(currentItem.subUnit || '');
      setConversionRate(currentItem.conversionRate !== undefined ? currentItem.conversionRate : '');

      const gp = currentItem.gradePrices || {};
      const hasAnyGradePrice = Boolean(gp.A || gp.B || gp.C || gp.D);
      setGradePrices({
        A: gp.A !== undefined ? gp.A : '',
        B: gp.B !== undefined ? gp.B : '',
        C: gp.C !== undefined ? gp.C : '',
        D: gp.D !== undefined ? gp.D : '',
      });
      setShowGradePricing(hasAnyGradePrice);
    } else {
      setBarcode('');
      setName('');
      setUnit('ชิ้น');
      setCostPrice('');
      setSellingPrice('');
      setImageUrl('');
      setFrontQty(1);
      setWarehouseQty(0);
      setFrontLocation('หน้าร้าน');
      setLocation('RACK A-01');
      setMinFrontStock(2);
      setBrand('');
      setCategory('');
      setDescription('');
      setSubUnit('');
      setConversionRate('');
      setGradePrices({ A: '', B: '', C: '', D: '' });
      setShowGradePricing(false);
    }
    setIsScanning(false);
    setScanSuccessMsg(null);
  }, [currentItem, isOpen]);

  // Handle scanned barcode
  const handleScannedBarcode = (scannedText: string) => {
    const clean = scannedText.trim();
    setBarcode(clean);
    setIsScanning(false);
    setScanSuccessMsg(`สแกนสำเร็จ: ${clean}`);
    setTimeout(() => setScanSuccessMsg(null), 3500);
  };

  // Handle file capture (Camera or Gallery)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadStatusText('กำลังบีบอัดรูปภาพ...');

    try {
      // 1. Instantly compress image on client device (<100ms)
      const compressedDataUrl = await compressImageFile(file, 480, 480, 0.72);
      
      // 2. Optimistically display preview immediately so the user can see their photo instantly!
      setImageUrl(compressedDataUrl);
      setUploadStatusText('กำลังซิงค์รูปภาพขึ้น Cloud Storage...');

      // 3. Attempt upload to Cloud Storage with 2.5s auto-fallback timeout
      const storageUrl = await uploadProductImageToStorage(
        compressedDataUrl,
        name || barcode || file.name || 'product',
        2500
      );

      // 4. If Cloud Storage succeeded with HTTPS URL, swap to it
      if (storageUrl && storageUrl.startsWith('http')) {
        setImageUrl(storageUrl);
      }
    } catch (err) {
      console.warn('Image capture notice:', err);
    } finally {
      setIsUploadingImage(false);
      setUploadStatusText(null);
      // Reset input value so same photo can be re-selected if needed
      e.target.value = '';
    }
  };

  // Calculate profit preview
  const costNum = Number(costPrice) || 0;
  const sellNum = Number(sellingPrice) || 0;
  const profit = sellNum - costNum;
  const profitMargin = sellNum > 0 ? ((profit / sellNum) * 100).toFixed(1) : null;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณากรอกชื่อสินค้า');
      return;
    }

    setIsSubmitting(true);
    try {
      const numericCost = Number(costPrice) || 0;
      const numericSell = Number(sellingPrice) || 0;
      const numFront = Math.max(0, Number(frontQty) || 0);
      const numWarehouse = Math.max(0, Number(warehouseQty) || 0);
      const totalNumericQty = numFront + numWarehouse;

      const productPayload: Omit<ProductItem, 'id'> = {
        barcode: barcode.trim(),
        name: name.trim(),
        unit: unit.trim() || 'ชิ้น',
        costPrice: numericCost,
        sellingPrice: numericSell,
        imageUrl: imageUrl.trim() || '',
        category: category.trim() || '',
        brand: brand.trim() || '',
        location: cleanLocationName(location),
        frontLocation: cleanLocationName(frontLocation),
        frontQty: numFront,
        warehouseQty: numWarehouse,
        systemQty: totalNumericQty,
        actualQty: totalNumericQty,
        status: 'checked',
        minStock: 2,
        minFrontStock: Math.max(1, Number(minFrontStock) || 2),
        description: description.trim() || '',
        subUnit: subUnit.trim() || '',
        conversionRate: conversionRate !== '' ? Number(conversionRate) : undefined,
        gradePrices: (() => {
          const clean: Partial<Record<CustomerGrade, number>> = {};
          if (typeof gradePrices.A === 'number' && gradePrices.A > 0) clean.A = gradePrices.A;
          if (typeof gradePrices.B === 'number' && gradePrices.B > 0) clean.B = gradePrices.B;
          if (typeof gradePrices.C === 'number' && gradePrices.C > 0) clean.C = gradePrices.C;
          if (typeof gradePrices.D === 'number' && gradePrices.D > 0) clean.D = gradePrices.D;
          return Object.keys(clean).length > 0 ? clean : undefined;
        })(),
        updatedAt: new Date().toISOString(),
        // Backwards compatibility fields
        size: name.trim(),
        price: numericSell,
      };

      await onSave(productPayload, currentItem ? currentItem.id : undefined);
      setIsScanning(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-md bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#475662] bg-[#252C33]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center border border-[#475662]">
              {currentItem ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE]">
                {currentItem ? 'แก้ไขข้อมูลสินค้า / อะไหล่' : 'เพิ่มสินค้า / อะไหล่มอเตอร์ไซค์ใหม่'}
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">ระบบคลังสินค้า CRC ThaBo</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsScanning(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* ============================================================ */}
          {/* 1. ระบบแสกนบาร์โค้ด และรหัสสินค้า (Barcode / Product Code) */}
          {/* ============================================================ */}
          <div className="space-y-2">
            {!isScanning ? (
              <div className="p-2.5 rounded-xl bg-[#252C33] border border-[#475662] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#3A4750] flex items-center justify-center text-[#F6C90E] flex-shrink-0">
                    <ScanBarcode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#EEEEEE] flex items-center gap-1.5">
                      <span>1. สแกนบาร์โค้ดสินค้า</span>
                      <span className="text-[9px] bg-[#F6C90E]/20 text-[#F6C90E] font-semibold px-1.5 py-0.2 rounded">
                        HD PRO
                      </span>
                    </div>
                    <p className="text-[10px] text-[#A0ABB5]">เปิดกล้องส่องฉลากอะไหล่ หรือ EAN-13</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  className="py-1.5 px-3 rounded-lg bg-[#F6C90E] hover:bg-[#E5B800] active:scale-95 text-[#252C33] font-bold text-xs flex items-center gap-1 shadow-sm transition-all flex-shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปิดกล้อง</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F6C90E] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 animate-pulse" />
                    <span>กำลังสแกนบาร์โค้ด... นำกล้องส่องที่ฉลากสินค้า</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsScanning(false)}
                    className="text-xs text-[#EEEEEE] hover:bg-[#43525D] px-2 py-0.5 rounded bg-[#252C33] border border-[#475662]"
                  >
                    ปิดกล้อง
                  </button>
                </div>
                <CameraBarcodeScanner onScan={handleScannedBarcode} />
              </div>
            )}

            {scanSuccessMsg && (
              <div className="p-2 bg-[#252C33] border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{scanSuccessMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[#EEEEEE] font-semibold mb-1 flex items-center justify-between">
                <span>รหัสสินค้า / บาร์โค้ด (Barcode)</span>
                <span className="text-[10px] text-[#A0ABB5]">พิมพ์หรือยิงบาร์โค้ด</span>
              </label>
              <div className="relative">
                <ScanBarcode className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="เช่น 8851234567890 หรือ H-23100-K0J-N01"
                  className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] rounded-xl pl-9 pr-3 py-2 focus:border-[#F6C90E] focus:outline-none font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 2. ชื่อสินค้า (Product Name) */}
          {/* ============================================================ */}
          <div>
            <label className="block text-[#EEEEEE] font-semibold mb-1">
              2. ชื่อสินค้า / รายการอะไหล่ <span className="text-[#F6C90E]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สายพานแท้ Click 125i, ผ้าเบรกหน้า Wave 110i, น้ำมันเครื่อง 4T 0.8L"
              className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-2.5 focus:border-[#F6C90E] focus:outline-none text-xs font-medium"
            />
          </div>

          {/* ============================================================ */}
          {/* 3. หน่วยนับ (Unit) */}
          {/* ============================================================ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#EEEEEE] font-semibold">
                3. หน่วยนับ <span className="text-[#F6C90E]">*</span>
              </label>
              <span className="text-[10px] text-[#A0ABB5]">เลือกด่วนหรือพิมพ์เอง</span>
            </div>

            {/* Quick unit pills */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {COMMON_UNITS.map((u) => {
                const isSelected = unit === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                        : 'bg-[#252C33] text-[#EEEEEE] hover:bg-[#43525D] border border-[#475662]'
                    }`}
                  >
                    {u}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="พิมพ์หน่วยนับเอง เช่น ชุด, ลัง, ม้วน"
              className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-2 focus:border-[#F6C90E] focus:outline-none text-xs"
            />

            {/* Optional Unit Conversion (e.g. 1 ลัง = 24 ป๋อง) */}
            <div className="mt-2.5 p-3 bg-[#20262D] border border-[#475662] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-[#EEEEEE]">
                <span className="font-semibold text-amber-400">⚡ ตั้งค่าแปลงหน่วยย่อย (สำหรับขายปลีก-ส่ง)</span>
                <span className="text-[10px] text-[#A0ABB5]">เว้นว่างไว้ถ้าไม่ใช้</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#A0ABB5] mb-1">หน่วยย่อย (เช่น ป๋อง, ชิ้น)</label>
                  <input
                    type="text"
                    value={subUnit}
                    onChange={(e) => setSubUnit(e.target.value)}
                    placeholder="เช่น ป๋อง"
                    className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] rounded-lg px-2.5 py-1.5 text-xs focus:border-[#F6C90E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#A0ABB5] mb-1">1 {unit || 'หน่วยใหญ่'} เท่ากับกี่ {subUnit || 'หน่วยย่อย'}</label>
                  <input
                    type="number"
                    min="1"
                    value={conversionRate}
                    onChange={(e) => setConversionRate(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="เช่น 24"
                    className="w-full bg-[#252C33] border border-[#475662] text-amber-400 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:border-[#F6C90E] focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4. ราคาซื้อ & 5. ราคาขาย */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#EEEEEE] font-semibold text-xs">
                  4. ราคาซื้อ / ต้นทุน
                </label>
                <span className="text-[10px] text-[#A0ABB5]">(ไม่แสดงหน้าร้าน)</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5] font-bold">฿</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] font-bold rounded-xl pl-7 pr-3 py-2 focus:border-[#F6C90E] focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#EEEEEE] font-semibold mb-1 text-xs">
                5. ราคาขาย (บาท) <span className="text-[#F6C90E]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F6C90E] font-bold">฿</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#252C33] border border-[#475662] text-[#F6C90E] font-bold rounded-xl pl-7 pr-3 py-2 focus:border-[#F6C90E] focus:outline-none font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 5.1 กำหนดราคาเฉพาะตามเกรดลูกค้า (ทางเลือก - Overrides tier %) */}
          {/* ============================================================ */}
          <div className="p-3 bg-[#20262D] border border-[#475662] rounded-2xl space-y-2.5">
            <button
              type="button"
              onClick={() => setShowGradePricing(!showGradePricing)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-[#EEEEEE]">
                  กำหนดราคาเฉพาะตามเกรดลูกค้า (A, B, C, D)
                </span>
                <span className="text-[10px] text-amber-300 font-semibold bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                  ทางเลือก
                </span>
              </div>
              <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                <span>{showGradePricing ? 'ซ่อน' : 'ตั้งราคาแยก'}</span>
                {showGradePricing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showGradePricing && (
              <div className="pt-2 border-t border-[#3A4750] space-y-2 animate-in fade-in duration-150">
                <p className="text-[11px] text-[#A0ABB5]">
                  หากระบุ ระบบจะใช้ราคานี้กับลูกค้าเกรดนั้นทันที (แทนที่การคำนวณ % ส่วนลดมาตรฐาน)
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Grade A */}
                  <div className="p-2 rounded-xl bg-[#252C33] border border-amber-400/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-[11px]">เกรด A (ช่าง VIP)</span>
                      {Number(sellingPrice) > 0 && typeof gradePrices.A === 'number' && gradePrices.A > 0 && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          -
                          {Math.round(
                            ((Number(sellingPrice) - gradePrices.A) / Number(sellingPrice)) * 100
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={gradePrices.A}
                        onChange={(e) =>
                          setGradePrices((prev) => ({
                            ...prev,
                            A: e.target.value === '' ? '' : parseFloat(e.target.value),
                          }))
                        }
                        placeholder={sellingPrice ? String(Math.ceil(Number(sellingPrice) * 0.85)) : 'ราคาเกรด A'}
                        className="w-full bg-[#1A1F26] border border-amber-400/30 text-amber-300 font-mono font-bold rounded-lg pl-6 pr-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Grade B */}
                  <div className="p-2 rounded-xl bg-[#252C33] border border-sky-400/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300 text-[11px]">เกรด B (ขายส่ง)</span>
                      {Number(sellingPrice) > 0 && typeof gradePrices.B === 'number' && gradePrices.B > 0 && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          -
                          {Math.round(
                            ((Number(sellingPrice) - gradePrices.B) / Number(sellingPrice)) * 100
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sky-400 font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={gradePrices.B}
                        onChange={(e) =>
                          setGradePrices((prev) => ({
                            ...prev,
                            B: e.target.value === '' ? '' : parseFloat(e.target.value),
                          }))
                        }
                        placeholder={sellingPrice ? String(Math.ceil(Number(sellingPrice) * 0.9)) : 'ราคาเกรด B'}
                        className="w-full bg-[#1A1F26] border border-sky-400/30 text-sky-300 font-mono font-bold rounded-lg pl-6 pr-2 py-1 text-xs focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  {/* Grade C */}
                  <div className="p-2 rounded-xl bg-[#252C33] border border-emerald-400/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 text-[11px]">เกรด C (สมาชิก)</span>
                      {Number(sellingPrice) > 0 && typeof gradePrices.C === 'number' && gradePrices.C > 0 && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          -
                          {Math.round(
                            ((Number(sellingPrice) - gradePrices.C) / Number(sellingPrice)) * 100
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={gradePrices.C}
                        onChange={(e) =>
                          setGradePrices((prev) => ({
                            ...prev,
                            C: e.target.value === '' ? '' : parseFloat(e.target.value),
                          }))
                        }
                        placeholder={sellingPrice ? String(Math.ceil(Number(sellingPrice) * 0.95)) : 'ราคาเกรด C'}
                        className="w-full bg-[#1A1F26] border border-emerald-400/30 text-emerald-300 font-mono font-bold rounded-lg pl-6 pr-2 py-1 text-xs focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Grade D */}
                  <div className="p-2 rounded-xl bg-[#252C33] border border-indigo-400/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 text-[11px]">เกรด D (พิเศษ)</span>
                      {Number(sellingPrice) > 0 && typeof gradePrices.D === 'number' && gradePrices.D > 0 && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          -
                          {Math.round(
                            ((Number(sellingPrice) - gradePrices.D) / Number(sellingPrice)) * 100
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={gradePrices.D}
                        onChange={(e) =>
                          setGradePrices((prev) => ({
                            ...prev,
                            D: e.target.value === '' ? '' : parseFloat(e.target.value),
                          }))
                        }
                        placeholder={sellingPrice ? String(Math.ceil(Number(sellingPrice) * 0.98)) : 'ราคาเกรด D'}
                        className="w-full bg-[#1A1F26] border border-indigo-400/30 text-indigo-300 font-mono font-bold rounded-lg pl-6 pr-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Multi-location Stock Quantity & Storage Location Section */}
          <div className="p-3 bg-[#252C33] border border-[#475662] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#EEEEEE] flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#F6C90E]" />
                <span>การจัดการสต็อกและตำแหน่งจัดเก็บ (2 จุด)</span>
              </span>
              <div className="px-2 py-0.5 rounded-lg bg-[#3A4750] border border-[#475662] text-[11px] font-bold text-[#F6C90E] font-mono">
                รวมทั้งหมด: {(Math.max(0, Number(frontQty) || 0) + Math.max(0, Number(warehouseQty) || 0))} {unit || 'ชิ้น'}
              </div>
            </div>

            {/* Storefront Stock (หน้าร้าน) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[#EEEEEE] font-medium mb-1 text-[11px] flex items-center gap-1">
                  <Store className="w-3 h-3 text-[#F6C90E]" />
                  <span>สต็อกหน้าร้าน ({unit || 'ชิ้น'})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={frontQty}
                  onChange={(e) => setFrontQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-[#20262D] border border-[#475662] text-[#F6C90E] font-bold rounded-xl px-3 py-1.5 focus:border-[#F6C90E] focus:outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[#A0ABB5] font-medium mb-1 text-[11px]">
                  ตำแหน่งชั้นวางหน้าร้าน
                </label>
                <input
                  type="text"
                  value={frontLocation}
                  onChange={(e) => setFrontLocation(e.target.value)}
                  placeholder="เช่น หน้าร้าน A, เคาน์เตอร์"
                  className="w-full bg-[#20262D] border border-[#475662] text-[#EEEEEE] placeholder-[#788896] rounded-xl px-3 py-1.5 focus:border-[#F6C90E] focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Warehouse Stock (คลังหลังร้าน) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#3A4750]">
              <div>
                <label className="block text-[#EEEEEE] font-medium mb-1 text-[11px] flex items-center gap-1">
                  <Warehouse className="w-3 h-3 text-sky-400" />
                  <span>สต็อกคลังหลังร้าน ({unit || 'ชิ้น'})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={warehouseQty}
                  onChange={(e) => setWarehouseQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-[#20262D] border border-[#475662] text-[#EEEEEE] font-bold rounded-xl px-3 py-1.5 focus:border-[#F6C90E] focus:outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[#A0ABB5] font-medium mb-1 text-[11px]">
                  ตำแหน่งในคลังหลังร้าน
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="เช่น RACK A-01, กล่อง 2"
                  className="w-full bg-[#20262D] border border-[#475662] text-[#EEEEEE] placeholder-[#788896] rounded-xl px-3 py-1.5 focus:border-[#F6C90E] focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Min Front Stock Warning threshold */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-[#A0ABB5]">
              <span>เตือนเมื่อหน้าร้านเหลือน้อยกว่า:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  value={minFrontStock}
                  onChange={(e) => setMinFrontStock(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 bg-[#20262D] border border-[#475662] text-center text-[#F6C90E] font-bold rounded-lg py-0.5 text-xs font-mono"
                />
                <span>{unit || 'ชิ้น'}</span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 6. ถ่ายภาพสินค้า (Product Photo) */}
          {/* ============================================================ */}
          <div className="pt-2 border-t border-[#475662] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[#EEEEEE] font-bold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#F6C90E]" />
                <span>6. ภาพถ่ายสินค้า (Product Photo)</span>
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ลบรูปภาพ</span>
                </button>
              )}
            </div>

            {/* Hidden Inputs for Camera and File Picker */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            {/* If Image exists, show preview */}
            {imageUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-2xl overflow-hidden border border-[#F6C90E]/40 bg-[#252C33] group">
                  <div className="w-full h-44 overflow-hidden flex items-center justify-center bg-[#20262D]">
                    <img
                      src={imageUrl}
                      alt={name || 'สินค้า'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Floating badge */}
                  <div className="absolute top-2 left-2 bg-[#252C33]/90 backdrop-blur-md text-[#F6C90E] border border-[#F6C90E]/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                    <span>ภาพถ่ายสินค้าจริง</span>
                  </div>

                  {/* Floating actions */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="bg-[#252C33]/90 hover:bg-[#252C33] text-[#EEEEEE] text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-[#475662] flex items-center gap-1 backdrop-blur-md active:scale-95 transition-all"
                    >
                      <Camera className="w-3 h-3 text-[#F6C90E]" />
                      <span>ถ่ายใหม่</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="bg-[#252C33]/90 hover:bg-[#252C33] text-[#EEEEEE] text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-[#475662] flex items-center gap-1 backdrop-blur-md active:scale-95 transition-all"
                    >
                      <Upload className="w-3 h-3 text-[#F6C90E]" />
                      <span>เปลี่ยนรูป</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* If No Image, show photo take / upload buttons */
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] hover:border-[#F6C90E]/50 text-[#EEEEEE] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[11px] text-[#EEEEEE]">ถ่ายรูปด้วยกล้อง</span>
                  <span className="text-[9px] text-[#A0ABB5]">ถ่ายภาพอะไหล่จริงทันที</span>
                </button>

                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] hover:border-[#F6C90E]/50 text-[#EEEEEE] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[11px] text-[#EEEEEE]">อัปโหลดจากเครื่อง</span>
                  <span className="text-[9px] text-[#A0ABB5]">เลือกจากคลังภาพในมือถือ</span>
                </button>
              </div>
            )}

            {isUploadingImage && (
              <div className="flex items-center justify-between gap-2 py-2 px-3 text-xs text-[#F6C90E] font-medium bg-[#252C33] rounded-xl border border-[#F6C90E]/30 animate-pulse">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#F6C90E]" />
                  <span>{uploadStatusText || 'กำลังประมวลผลรูปภาพ...'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadingImage(false)}
                  className="text-[10px] text-[#A0ABB5] hover:text-[#EEEEEE] underline ml-auto cursor-pointer"
                >
                  ข้าม / บันทึกได้เลย
                </button>
              </div>
            )}

            {/* Optional URL Toggle */}
            <div className="pt-1">
              {!showUrlInput ? (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(true)}
                  className="text-[10px] text-[#A0ABB5] hover:text-[#F6C90E] flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>หรือต้องการใส่ลิงก์ URL รูปภาพ?</span>
                </button>
              ) : (
                <div className="space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] text-[#A0ABB5]">
                    <span>ลิงก์ URL รูปภาพ</span>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="text-[#A0ABB5] hover:text-[#EEEEEE]"
                    >
                      ซ่อน
                    </button>
                  </div>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-1.5 focus:border-[#F6C90E] focus:outline-none text-[11px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AppSheet Real-Time Sync Indicator */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-300 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>บันทึกฐานข้อมูลลงไฟล์ AppSheet (crc-thano-project-v2.csv) ทันที</span>
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center gap-2 border-t border-[#475662]">
            {currentItem && onDelete && (
              <button
                type="button"
                onClick={() => {
                  setIsScanning(false);
                  onClose();
                  onDelete(currentItem);
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 text-rose-400 border border-rose-500/30 flex items-center justify-center gap-1 active:scale-95 transition-all text-xs font-semibold"
                title="ลบรายการสินค้านี้"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsScanning(false);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#252C33] hover:bg-[#2C353E] text-[#EEEEEE] font-medium active:scale-95 transition-all text-xs border border-[#475662]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold active:scale-95 transition-all shadow-md shadow-[#F6C90E]/25 disabled:opacity-50 text-xs"
            >
              {isSubmitting ? 'กำลังบันทึก...' : currentItem ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้าลงระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
