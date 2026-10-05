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
} from 'lucide-react';
import { TireItem } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface AddEditTireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tireData: Omit<TireItem, 'id'>, id?: string) => Promise<void>;
  initialTire?: TireItem | null;
}

// Compress image via offscreen Canvas to keep storage lightweight (<80KB)
async function compressImageFile(file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<string> {
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

// Intelligent barcode text parser
function parseBarcode(text: string) {
  const clean = text.trim();
  const result: { brand?: string; size?: string; rim?: string; barcode: string } = {
    barcode: clean,
  };

  const brands = [
    'Camal',
    'Fujiyama',
    'Deestone',
    'Exella',
    'IRC',
    'Quick',
    'Michelin',
    'Maxxis',
    'Pirelli',
    'Veerubber',
  ];
  for (const b of brands) {
    if (new RegExp(b, 'i').test(clean)) {
      result.brand = b;
      break;
    }
  }

  // Matches 110/70-12 or 90/90-14 or 130/70-13 etc
  const sizeMatch = clean.match(/(\d{2,3})[/-](\d{2,3})[-/R](\d{2})/i);
  if (sizeMatch) {
    result.size = `${sizeMatch[1]}/${sizeMatch[2]}-${sizeMatch[3]}`;
    result.rim = sizeMatch[3];
  } else {
    const partialSize = clean.match(/(\d{2,3})[/-](\d{2,3})/);
    if (partialSize) {
      result.size = `${partialSize[1]}/${partialSize[2]}`;
    }
    const rimMatch = clean.match(/\b(10|12|13|14|15|16|17)\b/);
    if (rimMatch) {
      result.rim = rimMatch[1];
    }
  }

  return result;
}

export const AddEditTireModal: React.FC<AddEditTireModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTire,
}) => {
  const [brand, setBrand] = useState('Camal');
  const [size, setSize] = useState('');
  const [rim, setRim] = useState('14');
  const [barcode, setBarcode] = useState('');
  const [systemQty, setSystemQty] = useState(5);
  const [actualQty, setActualQty] = useState(5);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [location, setLocation] = useState('RACK A-01');
  const [zone, setZone] = useState('ห้องยางชั้น 2');
  const [description, setDescription] = useState('');
  const [minStock, setMinStock] = useState(3);
  const [isOem, setIsOem] = useState(false);
  const [oemLabel, setOemLabel] = useState('OEM ศูนย์');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Barcode scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);

  // File upload refs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    if (initialTire) {
      setBrand(initialTire.brand);
      setSize(initialTire.size);
      setRim(initialTire.rim);
      setBarcode(initialTire.barcode || '');
      setSystemQty(initialTire.systemQty);
      setActualQty(initialTire.actualQty);
      setPrice(initialTire.price);
      setLocation(initialTire.location);
      setZone(initialTire.zone || 'ห้องยางชั้น 2');
      setDescription(initialTire.description || '');
      setMinStock(initialTire.minStock || 3);
      setIsOem(Boolean(initialTire.isOem));
      setOemLabel(initialTire.oemLabel || 'OEM ศูนย์');
      setImageUrl(initialTire.imageUrl || '');
    } else {
      setBrand('Camal');
      setSize('');
      setRim('14');
      setBarcode('');
      setSystemQty(5);
      setActualQty(5);
      setPrice(undefined);
      setLocation('RACK A-01');
      setZone('ห้องยางชั้น 2');
      setDescription('');
      setMinStock(3);
      setIsOem(false);
      setOemLabel('OEM ศูนย์');
      setImageUrl('');
    }
    setIsScanning(false);
    setScanSuccessMsg(null);
  }, [initialTire, isOpen]);

  // Handle scanned barcode text
  const handleScannedBarcode = (decodedText: string) => {
    const parsed = parseBarcode(decodedText);
    setBarcode(parsed.barcode);

    if (parsed.brand) {
      setBrand(parsed.brand);
    }
    if (parsed.size) {
      setSize(parsed.size);
    }
    if (parsed.rim) {
      setRim(parsed.rim);
    }

    setScanSuccessMsg(`สแกนสำเร็จ: ${parsed.barcode}`);
    setIsScanning(false);
    setTimeout(() => setScanSuccessMsg(null), 4000);
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!size.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(
        {
          brand,
          size: size.trim(),
          rim,
          barcode: barcode.trim() || undefined,
          systemQty: Number(systemQty),
          actualQty: Number(actualQty),
          price: price !== undefined && !isNaN(price) ? Number(price) : undefined,
          status: Number(actualQty) === Number(systemQty) ? 'checked' : 'discrepancy',
          category: 'Tubeless',
          location: location.trim(),
          zone: zone.trim(),
          description: description.trim(),
          minStock: Number(minStock),
          isOem,
          oemLabel: isOem ? oemLabel : undefined,
          imageUrl: imageUrl.trim() || undefined,
          updatedAt: new Date().toISOString(),
        },
        initialTire ? initialTire.id : undefined
      );
      setIsScanning(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#111c2e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#0d1626]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              {initialTire ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {initialTire ? 'แก้ไขข้อมูลขนาดยาง' : 'เพิ่มขนาดยางใหม่ในระบบ'}
              </h3>
              <p className="text-[10px] text-slate-400">คลังยางเรเดียล Tubeless • ห้องยางชั้น 2</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsScanning(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* 1. Barcode Scanner Action Banner */}
          {!isScanning ? (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <ScanBarcode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>แสกนบาร์โค้ดจากยาง</span>
                    <span className="text-[9px] bg-amber-400/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded">
                      กล้อง HD Pro
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">สแกนรหัส EAN-13 หรือ QR ฉลากเพื่อเติมข้อมูลอัตโนมัติ</p>
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
                  <span>กำลังสแกน... นำกล้องส่องที่ฉลากยาง</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsScanning(false)}
                  className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
                >
                  ปิดกล้อง
                </button>
              </div>

              {/* High-Performance Camera Barcode Scanner */}
              <CameraBarcodeScanner onScan={handleScannedBarcode} />
            </div>
          )}

          {/* Success scan banner */}
          {scanSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/90 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{scanSuccessMsg}</span>
            </div>
          )}

          {/* Barcode input field */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
              <span>รหัสบาร์โค้ด / สติกเกอร์ยาง (Barcode)</span>
              <span className="text-[10px] text-slate-500">ไม่บังคับ</span>
            </label>
            <div className="relative">
              <ScanBarcode className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="เช่น 8851234567890 หรือยิงบาร์โค้ดที่นี่"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2 focus:border-amber-400 focus:outline-none font-mono text-xs"
              />
            </div>
          </div>

          {/* Brand & Rim */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">แบรนด์ยาง</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                <option value="Camal">Camal</option>
                <option value="Fujiyama">Fujiyama</option>
                <option value="Deestone">Deestone</option>
                <option value="Exella">Exella</option>
                <option value="IRC">IRC</option>
                <option value="Quick">Quick</option>
                <option value="Michelin">Michelin</option>
                <option value="Maxxis">Maxxis</option>
                <option value="Pirelli">Pirelli</option>
                <option value="Veerubber">Veerubber</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">ขอบล้อ (นิ้ว)</label>
              <select
                value={rim}
                onChange={(e) => setRim(e.target.value)}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                <option value="10">10 นิ้ว</option>
                <option value="12">12 นิ้ว</option>
                <option value="13">13 นิ้ว</option>
                <option value="14">14 นิ้ว</option>
                <option value="15">15 นิ้ว</option>
                <option value="16">16 นิ้ว</option>
                <option value="17">17 นิ้ว</option>
              </select>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              เบอร์ขนาดยาง (เช่น 110/70-12, 140/70-14, 90/90-12) <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="เช่น 110/70-12 หรือ 90/90-14"
              className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono text-sm"
            />
          </div>

          {/* System Qty & Actual Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">ยอดตามระบบ (เส้น)</label>
              <input
                type="number"
                min="0"
                value={systemQty}
                onChange={(e) => setSystemQty(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">ยอดตรวจนับจริง (เส้น)</label>
              <input
                type="number"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-amber-400 font-bold rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Location & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">ตำแหน่งช่องจัดเก็บ</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น RACK G-03 หรือ ช่อง A-01"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">ราคาขายมาตรฐาน (บาท)</label>
              <input
                type="number"
                min="0"
                value={price !== undefined ? price : ''}
                onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="เช่น 790 หรือ 850"
                className="w-full bg-[#17253d] border border-slate-700 text-emerald-400 font-bold rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Description & Min stock */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-400 font-medium mb-1">รายละเอียด / รุ่นรถที่รองรับ</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น Scoopy-i, Vespa, Grand Filano, PCX"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">สต็อกเตือนต่ำ</label>
              <input
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* OEM Badge toggle */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              id="isOem"
              checked={isOem}
              onChange={(e) => setIsOem(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-0"
            />
            <label htmlFor="isOem" className="text-slate-300 font-medium cursor-pointer">
              เป็นยาง OEM แท้ศูนย์ (มีป้ายกำกับ)
            </label>
          </div>

          {/* 2. REAL TIRE PHOTO CAPTURE & UPLOAD SECTION */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>ภาพถ่ายจริงของยาง (Tire Photo)</span>
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
                    alt={`${brand} ${size}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>ภาพถ่ายจริงของยาง</span>
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
              /* If No Image, show photo take / upload options */
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
                  <span className="text-[9px] text-slate-400">ถ่ายภาพยางจริงทันที</span>
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
                    <span>ลิงก์ URL รูปภาพ (URL Hotlink)</span>
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
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-1.5 focus:border-amber-400 focus:outline-none text-[11px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 flex items-center gap-2 border-t border-slate-800">
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
              {isSubmitting ? 'กำลังบันทึก...' : initialTire ? 'บันทึกการแก้ไข' : 'เพิ่มลงฐานข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
