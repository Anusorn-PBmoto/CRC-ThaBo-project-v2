import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Camera,
  Upload,
  Receipt,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  PackagePlus,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Building,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  analyzeInvoiceWithGeminiFlash,
  InvoiceAnalysisResult,
  InvoiceItemResult,
} from '../utils/geminiClient';
import { resolveProductImage } from '../utils/productImages';

interface GeminiInvoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ProductItem[];
  onConfirmBatchIntake: (
    supplier: string,
    invoiceNo: string,
    items: Array<{ product: ProductItem; quantity: number; costPrice: number }>,
    note?: string
  ) => Promise<void>;
  onOpenAddNewProduct?: (prefilled: Partial<ProductItem>) => void;
}

// Compress file before upload to Gemini Flash (< 100KB)
async function compressImageForGemini(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลไฟล์รูปภาพได้'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.readAsDataURL(file);
  });
}

function generateSampleInvoiceDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px Prompt, sans-serif';
  ctx.fillText('บจก. สยามสปอร์ตสต็อก (ใบส่งของ / รับเข้าสินค้า)', 24, 45);

  ctx.fillStyle = '#4B5563';
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText('เลขที่บิล: IV-202610-098   |   วันที่: 08/10/2026', 24, 80);

  // Table header
  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(20, 105, 560, 36);

  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 15px Prompt, sans-serif';
  ctx.fillText('รายการสินค้า', 35, 128);
  ctx.fillText('จำนวน', 360, 128);
  ctx.fillText('ราคา/หน่วย', 440, 128);

  // Rows
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText('1. ยาง IRC 120/70-14 SCT-001', 35, 175);
  ctx.fillText('4 เส้น', 360, 175);
  ctx.fillText('850.-', 440, 175);

  ctx.fillText('2. ยาง Camel 70/90-17 CM503', 35, 215);
  ctx.fillText('10 เส้น', 360, 215);
  ctx.fillText('320.-', 440, 215);

  ctx.fillText('3. ยาง Michelin City Grip 90/90-14', 35, 255);
  ctx.fillText('6 เส้น', 360, 255);
  ctx.fillText('920.-', 440, 255);

  // Total
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px Prompt, sans-serif';
  ctx.fillText('ยอดรวมทั้งสิ้น:  12,120 บาท', 35, 315);

  return canvas.toDataURL('image/jpeg', 0.9);
}

export const GeminiInvoiceIntakeModal: React.FC<GeminiInvoiceIntakeModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onConfirmBatchIntake,
  onOpenAddNewProduct,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceAnalysisResult | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [editableItems, setEditableItems] = useState<
    Array<{
      id: string;
      rawName: string;
      matchedProduct: ProductItem | null;
      quantity: number;
      costPrice: number;
      unit: string;
      brand?: string;
      size?: string;
    }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      setInvoiceData(null);
      setSuccessMsg(null);
      const compressed = await compressImageForGemini(file);
      setSelectedImage(compressed);
      runInvoiceOcr(compressed);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดรูปบิล: ' + (err?.message || ''));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const runInvoiceOcr = async (base64Img: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await analyzeInvoiceWithGeminiFlash(base64Img, catalog);
      if (res.data) {
        setInvoiceData(res.data);
        setSupplierName(res.data.supplier || 'ซัพพลายเออร์ทั่วไป');
        setInvoiceNo(res.data.invoiceNo || '');

        // Map items to state
        const mapped = (res.data.items || []).map((it, idx) => ({
          id: `inv-item-${idx}-${Date.now()}`,
          rawName: it.rawName,
          matchedProduct: it.matchedProduct || null,
          quantity: it.quantity || 1,
          costPrice: it.costPrice || 0,
          unit: it.unit || 'ชิ้น',
          brand: it.brand,
          size: it.size,
        }));
        setEditableItems(mapped);
      }
    } catch (err: any) {
      console.error('Invoice analysis failed:', err);
      setErrorMsg(err?.message || 'การอ่านบิลด้วย Gemini Flash ขัดข้อง โปรดลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateItemQty = (id: string, delta: number) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = Math.max(1, item.quantity + delta);
          return { ...item, quantity: next };
        }
        return item;
      })
    );
  };

  const updateItemCost = (id: string, cost: number) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, costPrice: cost } : item))
    );
  };

  const removeItem = (id: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleManualMapProduct = (itemId: string, product: ProductItem) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              matchedProduct: product,
              costPrice: item.costPrice || product.costPrice || 0,
            }
          : item
      )
    );
  };

  const handleConfirmIntake = async () => {
    if (editableItems.length === 0) {
      setErrorMsg('ไม่มีรายการสินค้าในบิล');
      return;
    }

    // Check if any item lacks matched product
    const unmatched = editableItems.filter((i) => !i.matchedProduct);
    if (unmatched.length > 0) {
      setErrorMsg(
        `มี ${unmatched.length} รายการที่ยังไม่ได้จับคู่กับสินค้าในระบบ กรุณาเลือกสินค้าหรือเพิ่มเป็นสินค้าใหม่ก่อน`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payloadItems = editableItems.map((i) => ({
        product: i.matchedProduct!,
        quantity: i.quantity,
        costPrice: i.costPrice,
      }));

      await onConfirmBatchIntake(
        supplierName.trim() || 'ซัพพลายเออร์บิลส่งของ',
        invoiceNo.trim() || '',
        payloadItems,
        `รับเข้าจากภาพถ่ายบิลด้วย Gemini Flash (${editableItems.length} รายการ)`
      );

      setSuccessMsg('รับเข้าสินค้าลงสต็อกสำเร็จเรียบร้อย!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Batch intake error:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกรับเข้าสต็อก: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQty = editableItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalCost = editableItems.reduce((acc, i) => acc + i.quantity * i.costPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252C33] border-b border-[#475662]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-[#F6C90E] text-[#252C33] flex items-center justify-center font-bold shadow-md">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-1.5">
                <span>รับเข้าสินค้าด้วยภาพถ่ายบิล</span>
                <span className="text-[9px] bg-[#F6C90E]/20 text-[#F6C90E] font-bold px-1.5 py-0.5 rounded border border-[#F6C90E]/30">
                  ⚡ Flash OCR
                </span>
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">อ่านบิลส่งของ • ใบเสร็จ • รับเข้าสต็อกอัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Initial capture view */}
          {!selectedImage && (
            <div className="space-y-3">
              <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-4 text-center space-y-2.5">
                <div className="w-14 h-14 rounded-2xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center mx-auto border border-[#475662] shadow-inner">
                  <Receipt className="w-7 h-7" />
                </div>
                <h4 className="text-xs font-bold text-[#EEEEEE]">
                  ถ่ายรูปบิลส่งของ / ใบกำกับภาษี / บิลเงินสด
                </h4>
                <p className="text-[11px] text-[#A0ABB5] leading-relaxed">
                  Gemini Flash จะอ่านตารางสินค้าทุกแถว สกัดจำนวน ต้นทุน ยี่ห้อ และจับคู่กับสินค้าในร้านให้ทันทีเพื่อรับเข้าคลังในคลิกเดียว
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ถ่ายรูปบิล</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-semibold rounded-xl border border-[#475662] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Upload className="w-4 h-4 text-[#F6C90E]" />
                    <span>เลือกรูปบิล</span>
                  </button>
                </div>

                {/* 1-Click Sample Invoice Test Button */}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInvoiceData(null);
                    setSuccessMsg(null);
                    const sampleUrl = generateSampleInvoiceDataUrl();
                    setSelectedImage(sampleUrl);
                    runInvoiceOcr(sampleUrl);
                  }}
                  className="w-full py-2 px-3 bg-[#3A4750]/80 hover:bg-[#43525D] text-[#F6C90E] border border-[#F6C90E]/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span>🧪 ทดสอบอ่านด้วยบิลตัวอย่าง (1-Click Test)</span>
                </button>
              </div>

              {/* Tips */}
              <div className="bg-[#252C33]/60 border border-[#475662]/60 rounded-xl p-3 text-[11px] text-[#A0ABB5] space-y-1">
                <div className="font-semibold text-[#EEEEEE]">💡 คำแนะนำ:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>วางบิลบนพื้นราบและถ่ายให้เห็นตารางรายการสินค้าให้ชัดเจน</li>
                  <li>รองรับทั้งบิลเขียนมือและบิลพิมพ์จากคอมพิวเตอร์</li>
                  <li>ระบบจะตรวจจับชื่อร้านผู้จำหน่ายและยอดรวมให้อัตโนมัติ</li>
                </ul>
              </div>
            </div>
          )}

          {/* Image thumbnail & preview */}
          {selectedImage && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-[#475662] bg-black max-h-40 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Invoice Preview"
                  className="w-full h-40 object-contain"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-center p-3">
                    <Loader2 className="w-8 h-8 text-[#F6C90E] animate-spin" />
                    <div className="text-xs font-bold text-[#EEEEEE]">
                      Gemini Flash กำลังแกะข้อมูลในบิล...
                    </div>
                    <div className="text-[10px] text-[#A0ABB5]">
                      กำลังอ่านหัวบิล ตารางรายการสินค้า จำนวน และราคา
                    </div>
                  </div>
                )}

                {!isAnalyzing && (
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setInvoiceData(null);
                      setEditableItems([]);
                      setErrorMsg(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-[#EEEEEE] hover:bg-black/90 backdrop-blur-md"
                    title="ถ่ายบิลใหม่"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Error Notification */}
              {errorMsg && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>{errorMsg}</div>
                    <button
                      onClick={() => selectedImage && runInvoiceOcr(selectedImage)}
                      className="px-2 py-0.5 bg-rose-500/30 hover:bg-rose-500/50 rounded text-[10px] font-bold text-white flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> ลองอ่านบิลอีกครั้ง
                    </button>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {successMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Extracted Invoice Metadata */}
              {invoiceData && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#475662]">
                      <span className="font-bold text-[#F6C90E] flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        <span>ข้อมูลหัวบิล</span>
                      </span>
                      <span className="text-[10px] text-[#A0ABB5]">
                        {invoiceData.summary}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-[#A0ABB5] block">ชื่อซัพพลายเออร์/ผู้จำหน่าย</label>
                        <input
                          type="text"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder="ชื่อบริษัท/ร้านส่ง"
                          className="w-full bg-[#3A4750] border border-[#475662] rounded-lg px-2.5 py-1 text-xs text-[#EEEEEE] focus:border-[#F6C90E] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#A0ABB5] block">เลขที่บิล / ใบกำกับ</label>
                        <input
                          type="text"
                          value={invoiceNo}
                          onChange={(e) => setInvoiceNo(e.target.value)}
                          placeholder="เช่น INV-2026-001"
                          className="w-full bg-[#3A4750] border border-[#475662] rounded-lg px-2.5 py-1 text-xs text-[#EEEEEE] focus:border-[#F6C90E] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[#A0ABB5]">
                      <span>รายการที่อ่านได้จากบิล ({editableItems.length} รายการ):</span>
                      <span className="text-[#F6C90E]">รวม {totalQty} ชิ้น</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                      {editableItems.map((item) => {
                        const isMatched = Boolean(item.matchedProduct);
                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border transition-all ${
                              isMatched
                                ? 'bg-[#252C33] border-[#475662]'
                                : 'bg-amber-950/30 border-amber-500/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-[#EEEEEE] truncate">
                                  {item.rawName}
                                </div>

                                {isMatched ? (
                                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>ตรงกับ: {item.matchedProduct!.name}</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>ยังไม่พบสินค้าตรงในคลัง</span>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-[#A0ABB5] hover:text-rose-400"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Controls: Quantity & Cost Price */}
                            <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[#475662]/50 text-xs">
                              {/* Quantity */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[#A0ABB5]">จำนวน:</span>
                                <button
                                  onClick={() => updateItemQty(item.id, -1)}
                                  className="w-6 h-6 rounded bg-[#3A4750] text-[#EEEEEE] flex items-center justify-center border border-[#475662]"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-8 text-center font-bold text-[#F6C90E] font-mono">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateItemQty(item.id, 1)}
                                  className="w-6 h-6 rounded bg-[#3A4750] text-[#EEEEEE] flex items-center justify-center border border-[#475662]"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <span className="text-[10px] text-[#A0ABB5] ml-0.5">{item.unit}</span>
                              </div>

                              {/* Cost Price */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[#A0ABB5]">ทุน/หน่วย:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.costPrice}
                                  onChange={(e) => updateItemCost(item.id, Number(e.target.value))}
                                  className="w-16 bg-[#3A4750] border border-[#475662] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#F6C90E] focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* If unmatched, show actions to select or create product */}
                            {!isMatched && (
                              <div className="mt-2 pt-1.5 border-t border-amber-500/20 flex gap-1.5">
                                <select
                                  onChange={(e) => {
                                    const found = catalog.find((c) => c.id === e.target.value);
                                    if (found) handleManualMapProduct(item.id, found);
                                  }}
                                  defaultValue=""
                                  className="flex-1 bg-[#3A4750] border border-[#475662] text-[10px] text-[#EEEEEE] rounded px-2 py-1 focus:outline-none"
                                >
                                  <option value="" disabled>
                                    🔍 เลือกจับคู่สินค้าที่มีอยู่...
                                  </option>
                                  {catalog.slice(0, 50).map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.brand} {c.size} {c.name}
                                    </option>
                                  ))}
                                </select>

                                {onOpenAddNewProduct && (
                                  <button
                                    onClick={() => {
                                      onOpenAddNewProduct({
                                        name: item.rawName,
                                        brand: item.brand,
                                        size: item.size,
                                        costPrice: item.costPrice,
                                        unit: item.unit,
                                      });
                                    }}
                                    className="px-2 py-1 bg-[#F6C90E] text-[#252C33] font-bold rounded text-[10px] whitespace-nowrap active:scale-95"
                                  >
                                    + เพิ่มสินค้าใหม่
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary & Confirm Button */}
                  <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A0ABB5]">รวมทั้งสิ้น ({editableItems.length} รายการ):</span>
                      <span className="font-extrabold font-mono text-[#F6C90E] text-base">
                        ฿{totalCost.toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={handleConfirmIntake}
                      disabled={isSubmitting || editableItems.length === 0}
                      className="w-full py-2.5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังบันทึกรับเข้าคลัง...</span>
                        </>
                      ) : (
                        <>
                          <PackagePlus className="w-4 h-4" />
                          <span>📥 ยืนยันรับเข้าสต็อก ({totalQty} ชิ้น)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
