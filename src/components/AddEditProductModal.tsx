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
  Sparkles,
  ExternalLink,
  Layers,
  Tag,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { ProductItem } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<ProductItem, 'id'>, id?: string) => Promise<void>;
  initialProduct?: ProductItem | null;
  initialTire?: ProductItem | null; // Compatibility alias
}

// Compress image via offscreen Canvas to keep storage lightweight (<80KB)
async function compressImageFile(file: File, maxWidth = 800, maxHeight = 800, quality = 0.82): Promise<string> {
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
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('ไม่สามารถโหลดไฟล์รูปภาพได้'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
    reader.readAsDataURL(file);
  });
}

// Common units for motorcycle spare parts
const COMMON_UNITS = ['ชิ้น', 'เส้น', 'กล่อง', 'ชุด', 'ขวด', 'อัน', 'คู่', 'แผ่น', 'ลูก', 'กระป๋อง'];

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
  initialTire,
}) => {
  const currentItem = initialProduct || initialTire;

  // 1. ระบบแสกนบาร์โค้ด และรหัสสินค้า
  const [barcode, setBarcode] = useState('');
  // 2. ชื่อสินค้า
  const [name, setName] = useState('');
  // 3. หน่วยนับ
  const [unit, setUnit] = useState('ชิ้น');
  // 4. ราคาซื้อ / ราคาทุน
  const [costPrice, setCostPrice] = useState<number | string>('');
  // 5. ราคาขาย
  const [sellingPrice, setSellingPrice] = useState<number | string>('');
  // 6. ภาพถ่ายสินค้า
  const [imageUrl, setImageUrl] = useState('');

  // Optional supporting fields
  const [stockQty, setStockQty] = useState<number>(1);
  const [location, setLocation] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  // Scanner & UI states
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentItem) {
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
      setImageUrl(currentItem.imageUrl || '');
      setStockQty(currentItem.actualQty !== undefined ? currentItem.actualQty : 1);
      setLocation(currentItem.location || '');
      setBrand(currentItem.brand || '');
      setCategory(currentItem.category || '');
      setDescription(currentItem.description || '');
    } else {
      setBarcode('');
      setName('');
      setUnit('ชิ้น');
      setCostPrice('');
      setSellingPrice('');
      setImageUrl('');
      setStockQty(1);
      setLocation('RACK A-01');
      setBrand('');
      setCategory('');
      setDescription('');
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

  // Handle image upload from camera or gallery
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const compressedDataUrl = await compressImageFile(file, 800, 800, 0.82);
      setImageUrl(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress image:', err);
      alert('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // Calculate profit margin
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
      const numericQty = Number(stockQty) || 0;

      const productPayload: Omit<ProductItem, 'id'> = {
        barcode: barcode.trim(),
        name: name.trim(),
        unit: unit.trim() || 'ชิ้น',
        costPrice: numericCost,
        sellingPrice: numericSell,
        imageUrl: imageUrl.trim() || '',
        category: category.trim() || '',
        brand: brand.trim() || '',
        location: location.trim() || 'RACK A-01',
        systemQty: numericQty,
        actualQty: numericQty,
        status: 'checked',
        minStock: 2,
        description: description.trim() || '',
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
      <div className="w-full max-w-md bg-[#111c2e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#0d1626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              {currentItem ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {currentItem ? 'แก้ไขข้อมูลสินค้า / อะไหล่' : 'เพิ่มสินค้า / อะไหล่มอเตอร์ไซค์ใหม่'}
              </h3>
              <p className="text-[10px] text-slate-400">ระบบคลังสินค้า CRC ThaBo</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsScanning(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <ScanBarcode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <span>1. สแกนบาร์โค้ดสินค้า</span>
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 font-semibold px-1.5 py-0.2 rounded">
                        HD PRO
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">เปิดกล้องส่องฉลากอะไหล่ หรือ EAN-13</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all flex-shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปิดกล้อง</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 animate-pulse" />
                    <span>กำลังสแกนบาร์โค้ด... นำกล้องส่องที่ฉลากสินค้า</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsScanning(false)}
                    className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
                  >
                    ปิดกล้อง
                  </button>
                </div>
                <CameraBarcodeScanner onScan={handleScannedBarcode} />
              </div>
            )}

            {scanSuccessMsg && (
              <div className="p-2 bg-emerald-950/90 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{scanSuccessMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>รหัสสินค้า / บาร์โค้ด (Barcode)</span>
                <span className="text-[10px] text-slate-500">พิมพ์หรือยิงบาร์โค้ด</span>
              </label>
              <div className="relative">
                <ScanBarcode className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="เช่น 8851234567890 หรือ H-23100-K0J-N01"
                  className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2 focus:border-amber-400 focus:outline-none font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 2. ชื่อสินค้า (Product Name) */}
          {/* ============================================================ */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              2. ชื่อสินค้า / รายการอะไหล่ <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สายพานแท้ Click 125i, ผ้าเบรกหน้า Wave 110i, น้ำมันเครื่อง 4T 0.8L"
              className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 focus:border-amber-400 focus:outline-none text-xs font-medium"
            />
          </div>

          {/* ============================================================ */}
          {/* 3. หน่วยนับ (Unit) */}
          {/* ============================================================ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">
                3. หน่วยนับ <span className="text-amber-400">*</span>
              </label>
              <span className="text-[10px] text-slate-400">เลือกด่วนหรือพิมพ์เอง</span>
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
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-[#17253d] text-slate-300 hover:text-white border border-slate-700/80'
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
              className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none text-xs"
            />
          </div>

          {/* ============================================================ */}
          {/* 4. ราคาซื้อ & 5. ราคาขาย */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                4. ราคาซื้อ / ทุน (บาท)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">฿</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#17253d] border border-slate-700 text-amber-300 font-bold rounded-xl pl-7 pr-3 py-2 focus:border-amber-400 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                5. ราคาขาย (บาท) <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">฿</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#17253d] border border-slate-700 text-emerald-400 font-bold rounded-xl pl-7 pr-3 py-2 focus:border-emerald-400 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Profit Calculation Highlight Banner */}
          {sellNum > 0 && costNum > 0 && (
            <div className="p-2 rounded-xl bg-[#0e1e33] border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in">
              <span className="text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>กำไรต่อ {unit || 'ชิ้น'}:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {profit >= 0 ? `+฿${profit.toLocaleString()}` : `-฿${Math.abs(profit).toLocaleString()}`}
                </span>
                {profitMargin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold">
                    {profitMargin}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Initial Stock Quantity & Storage Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                จำนวนสต็อกเริ่มต้น ({unit || 'ชิ้น'})
              </label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                ตำแหน่งจัดเก็บ / ชั้นวาง
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น RACK A-01, กล่อง 2"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 6. ถ่ายภาพสินค้า (Product Photo) */}
          {/* ============================================================ */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
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
              <div className="relative rounded-2xl overflow-hidden border border-amber-500/40 bg-slate-900 group">
                <div className="w-full h-44 overflow-hidden flex items-center justify-center bg-slate-950">
                  <img
                    src={imageUrl}
                    alt={name || 'สินค้า'}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>ภาพถ่ายสินค้าจริง</span>
                </div>

                {/* Floating actions */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-black/80 hover:bg-black text-white text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-slate-700 flex items-center gap-1 backdrop-blur-md active:scale-95 transition-all"
                  >
                    <Camera className="w-3 h-3 text-amber-400" />
                    <span>ถ่ายใหม่</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="bg-black/80 hover:bg-black text-white text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-slate-700 flex items-center gap-1 backdrop-blur-md active:scale-95 transition-all"
                  >
                    <Upload className="w-3 h-3 text-teal-400" />
                    <span>เปลี่ยนรูป</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If No Image, show photo take / upload buttons */
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-gradient-to-b from-[#18263d] to-[#121c2e] hover:from-[#203250] hover:to-[#17253d] border border-slate-700/80 hover:border-amber-500/50 text-slate-100 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[11px] text-slate-200">ถ่ายรูปด้วยกล้อง</span>
                  <span className="text-[9px] text-slate-400">ถ่ายภาพอะไหล่จริงทันที</span>
                </button>

                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-gradient-to-b from-[#18263d] to-[#121c2e] hover:from-[#203250] hover:to-[#17253d] border border-slate-700/80 hover:border-teal-500/50 text-slate-100 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm group"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[11px] text-slate-200">อัปโหลดจากเครื่อง</span>
                  <span className="text-[9px] text-slate-400">เลือกจากคลังภาพในมือถือ</span>
                </button>
              </div>
            )}

            {isUploadingImage && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-amber-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังประมวลผลและบีบอัดรูปภาพ...</span>
              </div>
            )}

            {/* Optional URL Toggle */}
            <div className="pt-1">
              {!showUrlInput ? (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(true)}
                  className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>หรือต้องการใส่ลิงก์ URL รูปภาพ?</span>
                </button>
              ) : (
                <div className="space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>ลิงก์ URL รูปภาพ</span>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      ซ่อน
                    </button>
                  </div>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-1.5 focus:border-amber-400 focus:outline-none text-[11px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AppSheet Real-Time Sync Indicator */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-300/90 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>บันทึกฐานข้อมูลลงไฟล์ AppSheet (crc-thano-project-v2.csv) ทันที</span>
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsScanning(false);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#17253d] hover:bg-[#203252] text-slate-300 font-medium active:scale-95 transition-all text-xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 transition-all shadow-md shadow-amber-500/25 disabled:opacity-50 text-xs"
            >
              {isSubmitting ? 'กำลังบันทึก...' : currentItem ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้าลงระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
