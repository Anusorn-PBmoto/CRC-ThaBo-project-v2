import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  analyzeTireImageWithGeminiFlash,
  GeminiTireAnalysisResult,
  AnalyzeTireResponse,
} from '../utils/geminiClient';
import { resolveProductImage } from '../utils/productImages';

interface GeminiFlashScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onOpenAddWithAiData?: (aiData: Partial<ProductItem>) => void;
}

// Compress image via offscreen Canvas before sending to Gemini Flash (< 100KB)
async function compressForGemini(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.85): Promise<string> {
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

export const GeminiFlashScanModal: React.FC<GeminiFlashScanModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSelectProduct,
  onOpenAddWithAiData,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeTireResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      setAnalysisResult(null);
      const compressed = await compressForGemini(file);
      setSelectedImage(compressed);
      runGeminiFlashAnalysis(compressed);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + (err?.message || ''));
    }
  };

  const runGeminiFlashAnalysis = async (base64Img: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const result = await analyzeTireImageWithGeminiFlash(base64Img, catalog);
      setAnalysisResult(result);
    } catch (err: any) {
      setErrorMsg(err?.message || 'การเชื่อมต่อ Gemini Flash ขัดข้อง โปรดลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseMatchedItem = (item: ProductItem) => {
    onSelectProduct(item);
    onClose();
  };

  const handleCreateNewProductFromAI = () => {
    if (!analysisResult?.data || !onOpenAddWithAiData) return;
    const d = analysisResult.data;
    onOpenAddWithAiData({
      name: d.suggestedName,
      brand: d.brand,
      size: d.size,
      barcode: d.barcode || '',
      unit: d.unit || 'เส้น',
      imageUrl: selectedImage || undefined,
      description: `${d.model ? `รุ่น ${d.model}` : ''} ${d.dotCode ? `DOT: ${d.dotCode}` : ''} ${d.summary ? `• ${d.summary}` : ''}`.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252C33] border-b border-[#475662]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-[#F6C90E] text-[#252C33] flex items-center justify-center font-bold shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-1.5">
                <span>Gemini Flash AI Scanner</span>
                <span className="text-[9px] bg-[#F6C90E]/20 text-[#F6C90E] font-bold px-1.5 py-0.5 rounded border border-[#F6C90E]/30">
                  ⚡ Flash Model
                </span>
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">สแกนแก้มยาง • สติกเกอร์ฉลาก • ป้ายบาร์โค้ด</p>
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
        <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Hidden inputs */}
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

          {/* Action Buttons: Camera / Upload */}
          {!selectedImage && (
            <div className="space-y-2.5">
              <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center mx-auto shadow-inner border border-[#475662]">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-xs font-bold text-[#EEEEEE]">
                  ถ่ายรูปยางหรือฉลากสินค้าเพื่อสแกนด้วย AI
                </h4>
                <p className="text-[11px] text-[#A0ABB5] leading-relaxed">
                  Gemini Flash จะอ่านเบอร์ยาง (เช่น 120/70-14, 205/55R16), ยี่ห้อ, รหัส DOT สัปดาห์ปี และเทียบกับสินค้าในคลังให้ทันที
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ถ่ายรูปด้วยกล้อง</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-semibold rounded-xl border border-[#475662] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Upload className="w-4 h-4 text-[#F6C90E]" />
                    <span>เลือกจากคลังภาพ</span>
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-[#252C33]/60 border border-[#475662]/60 rounded-xl p-3 text-[11px] text-[#A0ABB5] space-y-1">
                <div className="font-semibold text-[#EEEEEE] flex items-center gap-1">
                  <span>💡 เคล็ดลับการถ่ายรูปให้ AI อ่านแม่นยำ:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>ถ่ายให้เห็นตัวเลขขนาดยางบนแก้มยางชัดเจน เช่น <code className="text-[#F6C90E]">120/70-14</code></li>
                  <li>ถ่ายสติกเกอร์ฉลากยางหรือบาร์โค้ดในที่มีแสงเพียงพอ</li>
                  <li>Gemini Flash ประมวลผลในเวลาเพียง 1-2 วินาที</li>
                </ul>
              </div>
            </div>
          )}

          {/* Image Preview & Status */}
          {selectedImage && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-[#475662] bg-black max-h-48 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Tire Scan Preview"
                  className="w-full h-48 object-contain"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-center p-3">
                    <Loader2 className="w-8 h-8 text-[#F6C90E] animate-spin" />
                    <div className="text-xs font-bold text-[#EEEEEE]">
                      Gemini Flash กำลังวิเคราะห์รูปภาพ...
                    </div>
                    <div className="text-[10px] text-[#A0ABB5]">
                      กำลังอ่านตัวอักษรแก้มยาง ลายดอก และค้นหาในสต็อก CRC THABO
                    </div>
                  </div>
                )}

                {!isAnalyzing && (
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setAnalysisResult(null);
                        setErrorMsg(null);
                      }}
                      className="p-1.5 rounded-lg bg-black/60 text-[#EEEEEE] hover:bg-black/90 backdrop-blur-md"
                      title="ถ่ายใหม่"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div className="space-y-1">
                    <div className="font-bold text-xs">เกิดข้อผิดพลาด</div>
                    <div className="text-[11px] leading-tight">{errorMsg}</div>
                    <button
                      onClick={() => selectedImage && runGeminiFlashAnalysis(selectedImage)}
                      className="mt-1 px-2.5 py-1 bg-rose-500/30 hover:bg-rose-500/50 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> ลองใหม่อีกครั้ง
                    </button>
                  </div>
                </div>
              )}

              {/* Analysis Results Display */}
              {analysisResult?.data && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Model Performance Pill */}
                  <div className="flex items-center justify-between px-1 text-[11px]">
                    <span className="flex items-center gap-1 text-[#F6C90E] font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analysisResult.model}</span>
                    </span>
                    <span className="text-[#A0ABB5] font-mono text-[10px]">
                      ⏱️ {Math.round(analysisResult.durationMs)} ms ({analysisResult.data.confidence || 'HIGH'})
                    </span>
                  </div>

                  {/* Extracted Specifications Card */}
                  <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3 space-y-2.5 shadow-md">
                    <div>
                      <div className="text-[10px] text-[#A0ABB5] uppercase tracking-wider">
                        ชื่อสินค้าที่ AI ตรวจพบ
                      </div>
                      <div className="text-sm font-bold text-[#EEEEEE] mt-0.5 leading-tight">
                        {analysisResult.data.suggestedName}
                      </div>
                    </div>

                    {/* Spec Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {analysisResult.data.brand && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#F6C90E] font-bold text-[11px] border border-[#475662]">
                          🏷️ {analysisResult.data.brand}
                        </span>
                      )}
                      {analysisResult.data.size && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#EEEEEE] font-mono font-bold text-[11px] border border-[#475662]">
                          📏 {analysisResult.data.size}
                        </span>
                      )}
                      {analysisResult.data.model && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#A0ABB5] text-[11px] border border-[#475662]">
                          🌀 {analysisResult.data.model}
                        </span>
                      )}
                      {analysisResult.data.dotCode && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#A0ABB5] font-mono text-[11px] border border-[#475662]">
                          📅 DOT: {analysisResult.data.dotCode}
                        </span>
                      )}
                      {analysisResult.data.barcode && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#A0ABB5] font-mono text-[11px] border border-[#475662]">
                          🔢 {analysisResult.data.barcode}
                        </span>
                      )}
                      {analysisResult.data.unit && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#3A4750] text-[#A0ABB5] text-[11px] border border-[#475662]">
                          📦 {analysisResult.data.unit}
                        </span>
                      )}
                    </div>

                    {/* Summary text */}
                    {analysisResult.data.summary && (
                      <p className="text-[11px] text-[#A0ABB5] bg-[#3A4750]/50 rounded-xl p-2 border border-[#475662]/50">
                        {analysisResult.data.summary}
                      </p>
                    )}
                  </div>

                  {/* Catalog Matching Section */}
                  {analysisResult.matchedItem ? (
                    <div className="bg-[#252C33] border border-[#F6C90E] rounded-2xl p-3 space-y-2 shadow-lg animate-in slide-in-from-bottom-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#F6C90E]">
                        <CheckCircle className="w-4 h-4 text-[#F6C90E]" />
                        <span>พบสินค้าตรงในคลัง CRC THABO!</span>
                      </div>

                      <div className="bg-[#3A4750] rounded-xl p-2.5 flex items-center justify-between border border-[#475662]">
                        <div>
                          <div className="font-bold text-xs text-[#EEEEEE]">
                            {analysisResult.matchedItem.name}
                          </div>
                          <div className="text-[11px] text-[#A0ABB5] mt-0.5">
                            บาร์โค้ด: <span className="font-mono text-[#EEEEEE]">{analysisResult.matchedItem.barcode || '-'}</span> | จุดเก็บ: {analysisResult.matchedItem.location || 'A1'}
                          </div>
                          <div className="text-[11px] text-[#A0ABB5] mt-0.5">
                            ยอดระบบ: <span className="font-mono text-[#EEEEEE]">{analysisResult.matchedItem.systemQty}</span> | นับได้: <span className="font-mono font-bold text-[#F6C90E]">{analysisResult.matchedItem.actualQty}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUseMatchedItem(analysisResult.matchedItem!)}
                          className="px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                        >
                          <span>ใช้นับสต็อก</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EEEEEE]">
                        <span>ℹ️ ไม่พบรายการที่ตรงเป๊ะในคลัง</span>
                      </div>
                      <p className="text-[11px] text-[#A0ABB5]">
                        สามารถเพิ่มเป็นสินค้าใหม่เข้าสู่ระบบได้ทันที โดย AI จะช่วยกรอกชื่อ ยี่ห้อ ขนาด และรูปภาพให้อัตโนมัติ
                      </p>

                      {onOpenAddWithAiData && (
                        <button
                          onClick={handleCreateNewProductFromAI}
                          className="w-full py-2.5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                        >
                          <Plus className="w-4 h-4" />
                          <span>เพิ่มเป็นสินค้าใหม่ด้วยข้อมูล AI</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action to scan another */}
                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setAnalysisResult(null);
                        setErrorMsg(null);
                      }}
                      className="w-full py-2 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] rounded-xl text-xs font-semibold border border-[#475662] flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#F6C90E]" />
                      <span>สแกนยางเส้นต่อไป</span>
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
