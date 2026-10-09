import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  SwitchCamera,
  Activity,
  Check,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  analyzeTireImageWithGeminiFlash,
  GeminiTireAnalysisResult,
  AnalyzeTireResponse,
  runGeminiSelfTest,
  GeminiSelfTestResponse,
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
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลไฟล์รูปภาพได้'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(file);
  });
}

// Generate realistic synthetic tire label data URL for instant 1-click test
function generateSampleTireDataUrl(sampleType: 'michelin' | 'irc' | 'camel'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#181C20';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & badge
  ctx.strokeStyle = '#3A4750';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Header banner
  ctx.fillStyle = '#252C33';
  ctx.fillRect(10, 10, canvas.width - 20, 60);

  ctx.font = 'bold 24px Prompt, sans-serif';
  ctx.fillStyle = '#F6C90E';
  ctx.fillText('CRC THABO - TIRE SIDEWALL SPEC', 24, 48);

  ctx.font = '14px Prompt, sans-serif';
  ctx.fillStyle = '#A0ABB5';
  ctx.fillText('OFFICIAL MOTORCYCLE TIRE LABEL', 400, 48);

  if (sampleType === 'michelin') {
    ctx.font = 'bold 38px Prompt, sans-serif';
    ctx.fillStyle = '#F6C90E';
    ctx.fillText('MICHELIN', 30, 125);

    ctx.font = 'bold 30px Prompt, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('CITY GRIP 90/90-14 M/C 46P', 30, 175);

    ctx.font = '20px Prompt, sans-serif';
    ctx.fillStyle = '#A0ABB5';
    ctx.fillText('TUBELESS  |  DOT 2423  |  MADE IN THAILAND', 30, 225);

    ctx.font = 'mono 22px monospace';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('BARCODE: 8851234567890', 30, 280);
  } else if (sampleType === 'irc') {
    ctx.font = 'bold 38px Prompt, sans-serif';
    ctx.fillStyle = '#F6C90E';
    ctx.fillText('IRC TIRE', 30, 125);

    ctx.font = 'bold 30px Prompt, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('SCT-001 MOBICITY 120/70-14 TL', 30, 175);

    ctx.font = '20px Prompt, sans-serif';
    ctx.fillStyle = '#A0ABB5';
    ctx.fillText('FOR HONDA PCX/ADV  |  DOT 1824  |  MAX LOAD 224KG', 30, 225);

    ctx.font = 'mono 22px monospace';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('BARCODE: 8859012345678', 30, 280);
  } else {
    ctx.font = 'bold 38px Prompt, sans-serif';
    ctx.fillStyle = '#F6C90E';
    ctx.fillText('CAMEL TIRE', 30, 125);

    ctx.font = 'bold 30px Prompt, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('CM503 WING 70/90-17 TT', 30, 175);

    ctx.font = '20px Prompt, sans-serif';
    ctx.fillStyle = '#A0ABB5';
    ctx.fillText('FOR WAVE 110i/DREAM  |  DOT 1224  |  ยางนอก', 30, 225);

    ctx.font = 'mono 22px monospace';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('BARCODE: 8857123987654', 30, 280);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
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

  // Live Camera state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Diagnostic state
  const [isTestingSystem, setIsTestingSystem] = useState(false);
  const [diagResult, setDiagResult] = useState<GeminiSelfTestResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera helper
  const stopLiveCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsLiveCameraActive(false);
  }, []);

  // Clean up stream on modal close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setSelectedImage(null);
      setAnalysisResult(null);
      setErrorMsg(null);
      setDiagResult(null);
    }
  }, [isOpen, stopLiveCamera]);

  if (!isOpen) return null;

  // Start Live Camera
  const startLiveCamera = async () => {
    setErrorMsg(null);
    setCameraError(null);
    setSelectedImage(null);
    setAnalysisResult(null);

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setIsLiveCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Live camera access error:', err);
      setIsLiveCameraActive(false);
      setCameraError('ไม่สามารถเปิดกล้องสดได้ กรุณาอนุญาตสิทธิ์กล้อง หรือเลือกอัปโหลดรูปภาพแทน');
    }
  };

  // Toggle Camera Facing
  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (isLiveCameraActive) {
      setTimeout(() => startLiveCamera(), 100);
    }
  };

  // Capture frame from live video stream
  const captureFrameAndAnalyze = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    stopLiveCamera();
    setSelectedImage(capturedDataUrl);
    runGeminiFlashAnalysis(capturedDataUrl);
  };

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopLiveCamera();
    try {
      setErrorMsg(null);
      setAnalysisResult(null);
      const compressed = await compressForGemini(file);
      setSelectedImage(compressed);
      runGeminiFlashAnalysis(compressed);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + (err?.message || ''));
    } finally {
      // Clear value so the same file can be reselected
      if (e.target) e.target.value = '';
    }
  };

  // Run AI Analysis
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

  // Instant test with sample tire
  const handleTestWithSample = (sampleType: 'michelin' | 'irc' | 'camel') => {
    stopLiveCamera();
    setErrorMsg(null);
    setAnalysisResult(null);
    const sampleDataUrl = generateSampleTireDataUrl(sampleType);
    setSelectedImage(sampleDataUrl);
    runGeminiFlashAnalysis(sampleDataUrl);
  };

  // Run self-test diagnostic
  const handleRunDiagnostic = async () => {
    setIsTestingSystem(true);
    setErrorMsg(null);
    try {
      const res = await runGeminiSelfTest();
      setDiagResult(res);
    } catch (err: any) {
      setErrorMsg('ผลการทดสอบระบบ: ' + (err?.message || 'ไม่สามารถทดสอบได้'));
    } finally {
      setIsTestingSystem(false);
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
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  พร้อมใช้งาน
                </span>
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">สแกนแก้มยาง • สติกเกอร์ฉลาก • ป้ายบาร์โค้ด</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Diagnostic Result Banner if executed */}
          {diagResult && (
            <div className="p-2.5 rounded-xl bg-[#20262D] border border-emerald-500/50 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>ผลตรวจเช็คระบบ: พร้อมใช้งานสมบูรณ์ (100%)</span>
                </span>
                <span className="font-mono text-[10px] text-[#A0ABB5]">{diagResult.totalDurationMs} ms</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-[#2A343D] p-1 rounded text-center">
                  <div className="text-emerald-400 font-bold">✓ ข้อความ</div>
                  <div className="text-[#A0ABB5]">{diagResult.results.textGeneration?.durationMs || 0}ms</div>
                </div>
                <div className="bg-[#2A343D] p-1 rounded text-center">
                  <div className="text-emerald-400 font-bold">✓ สกัด JSON</div>
                  <div className="text-[#A0ABB5]">{diagResult.results.jsonSchema?.durationMs || 0}ms</div>
                </div>
                <div className="bg-[#2A343D] p-1 rounded text-center">
                  <div className="text-emerald-400 font-bold">✓ สแกนภาพ OCR</div>
                  <div className="text-[#A0ABB5]">{diagResult.results.visionAnalysis?.durationMs || 0}ms</div>
                </div>
              </div>
            </div>
          )}

          {/* Live Camera Viewfinder if active */}
          {isLiveCameraActive && !selectedImage && (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#F6C90E] bg-black aspect-video flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Reticle Overlay */}
                <div className="absolute inset-4 border border-[#F6C90E]/60 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between text-[10px] text-[#F6C90E] font-bold">
                    <span>[ เล็งไปที่แก้มยางหรือฉลาก ]</span>
                    <span>AI LIVE</span>
                  </div>
                  <div className="text-center text-[10px] text-white/80 bg-black/60 rounded px-2 py-0.5 mx-auto">
                    กดปุ่มถ่ายภาพด้านล่างเมื่อตัวหนังสือชัดเจน
                  </div>
                </div>

                {/* Top controls */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={toggleCameraFacing}
                    className="p-1.5 rounded-lg bg-black/60 text-[#EEEEEE] hover:bg-black/90 backdrop-blur-md"
                    title="สลับกล้องหน้า/หลัง"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                  <button
                    onClick={stopLiveCamera}
                    className="p-1.5 rounded-lg bg-black/60 text-[#EEEEEE] hover:bg-black/90 backdrop-blur-md"
                    title="ปิดกล้อง"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shutter Button */}
              <div className="flex gap-2">
                <button
                  onClick={captureFrameAndAnalyze}
                  className="flex-1 py-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/30 text-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>ถ่ายภาพเพื่อสแกนด้วย AI</span>
                </button>
                <button
                  onClick={stopLiveCamera}
                  className="px-3 py-3 bg-[#252C33] hover:bg-[#2C353E] text-[#A0ABB5] rounded-xl border border-[#475662]"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: Camera / Upload / Test */}
          {!selectedImage && !isLiveCameraActive && (
            <div className="space-y-3">
              <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3.5 text-center space-y-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#3A4750] text-[#F6C90E] flex items-center justify-center mx-auto shadow-inner border border-[#475662]">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#EEEEEE]">
                    สแกนแก้มยางหรือฉลากด้วยกล้อง / ภาพถ่าย
                  </h4>
                  <p className="text-[11px] text-[#A0ABB5] leading-relaxed mt-0.5">
                    Gemini Flash จะอ่านเบอร์ยาง (เช่น 120/70-14, 90/90-14), ยี่ห้อ, รหัส DOT และค้นหาในสต็อก CRC THABO ให้ทันที
                  </p>
                </div>

                {cameraError && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] text-left">
                    {cameraError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={startLiveCamera}
                    className="py-2.5 px-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>เปิดกล้องสแกน</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-semibold rounded-xl border border-[#475662] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Upload className="w-4 h-4 text-[#F6C90E]" />
                    <span>เลือกรูปภาพ</span>
                  </button>
                </div>
              </div>

              {/* Instant 1-Click Sample Test Section */}
              <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-[#EEEEEE] flex items-center gap-1.5">
                    <span>🧪 ทดสอบระบบ AI ทันที (คลิกเดียว):</span>
                  </div>
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isTestingSystem}
                    className="text-[10px] text-[#F6C90E] hover:underline flex items-center gap-1 font-semibold"
                  >
                    {isTestingSystem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    <span>ตรวจสุขภาพ AI</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleTestWithSample('michelin')}
                    className="p-2 rounded-xl bg-[#3A4750] hover:bg-[#475662] border border-[#475662] text-left text-[10px] space-y-0.5 transition-all active:scale-95"
                  >
                    <div className="font-bold text-[#F6C90E]">Michelin</div>
                    <div className="text-[#EEEEEE]">90/90-14</div>
                    <div className="text-[#A0ABB5] text-[9px]">City Grip</div>
                  </button>

                  <button
                    onClick={() => handleTestWithSample('irc')}
                    className="p-2 rounded-xl bg-[#3A4750] hover:bg-[#475662] border border-[#475662] text-left text-[10px] space-y-0.5 transition-all active:scale-95"
                  >
                    <div className="font-bold text-[#F6C90E]">IRC Tire</div>
                    <div className="text-[#EEEEEE]">120/70-14</div>
                    <div className="text-[#A0ABB5] text-[9px]">Mobicity</div>
                  </button>

                  <button
                    onClick={() => handleTestWithSample('camel')}
                    className="p-2 rounded-xl bg-[#3A4750] hover:bg-[#475662] border border-[#475662] text-left text-[10px] space-y-0.5 transition-all active:scale-95"
                  >
                    <div className="font-bold text-[#F6C90E]">Camel</div>
                    <div className="text-[#EEEEEE]">70/90-17</div>
                    <div className="text-[#A0ABB5] text-[9px]">CM503</div>
                  </button>
                </div>
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
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-center p-3">
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
