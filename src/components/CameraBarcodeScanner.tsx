import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  RefreshCw,
  AlertTriangle,
  Upload,
  CheckCircle,
  Zap,
  Crosshair,
  Sliders,
} from 'lucide-react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';

interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onClose,
  title = 'สแกนเนอร์บาร์โค้ดยาง HD Pro',
  subtitle = 'ส่องบาร์โค้ดสินค้า ยาง หรือฉลากลังอะไหล่',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const lastScannedTimeRef = useRef<number>(0);

  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasHardwareZoom, setHasHardwareZoom] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(1.5); // Default 1.5x for best focal distance
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineType, setEngineType] = useState<'native' | 'zxing-enhanced'>('zxing-enhanced');
  const [isReady, setIsReady] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const [contrastBoost, setContrastBoost] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play audio and haptic feedback
  const triggerFeedback = useCallback((code: string) => {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 980;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {}

    setScannedFeedback(code);
    setTimeout(() => setScannedFeedback(null), 1500);
  }, []);

  // Handle successful detection with debouncing
  const handleDetected = useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;

      const now = Date.now();
      if (now - lastScannedTimeRef.current < 1200) return;
      lastScannedTimeRef.current = now;

      triggerFeedback(clean);
      onScan(clean);
    },
    [onScan, triggerFeedback]
  );

  // Listen for external USB / Bluetooth Barcode Scanner Gun
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && timeDiff < 200) {
          e.preventDefault();
          handleDetected(buffer.trim());
          buffer = '';
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 120) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDetected]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newTorchState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as any],
      });
      setIsTorchOn(newTorchState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Set Camera Zoom (Optical if supported, otherwise digital canvas crop zoom)
  const setZoom = async (zoomLevel: number) => {
    setCurrentZoom(zoomLevel);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomLevel } as any],
      });
    } catch {
      // Hardware zoom unsupported; digital crop zoom in canvas will be used automatically
    }
  };

  // Tap on viewfinder to trigger autofocus refocus
  const handleTapToFocus = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as any],
      });
    } catch {}
  };

  // Decode from file/image snapshot
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;

      img.onload = async () => {
        URL.revokeObjectURL(url);

        // Try Native BarcodeDetector first
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector();
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetected(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        // Fallback to ZXing file decode with high contrast
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.naturalWidth || img.width;
          offCanvas.height = img.naturalHeight || img.height;
          const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
            const lumSource = new RGBLuminanceSource(imgData.data, offCanvas.width, offCanvas.height);
            const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));

            if (zxingReaderRef.current) {
              const res = zxingReaderRef.current.decode(bitmap);
              if (res && res.getText()) {
                handleDetected(res.getText());
                return;
              }
            }
          }
        } catch {}

        alert('ไม่พบบาร์โค้ดในรูปภาพที่เลือก กรุณาลองถ่ายให้ชัดขึ้นหรือถือให้ตรงกับบาร์โค้ด');
      };
    } catch (err) {
      console.warn('File decode failed:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Main Camera Initialization & Enhanced Multi-Engine Detection Loop
  useEffect(() => {
    let isMounted = true;
    isScanningActiveRef.current = true;
    let animationFrameId: number | null = null;

    const startCamera = async () => {
      setCameraError(null);
      setIsReady(false);

      try {
        // Optimal resolution for barcode scanning: 720p 30-60 FPS
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            advanced: [
              { focusMode: 'continuous' },
              { exposureMode: 'continuous' },
              { whiteBalanceMode: 'continuous' },
            ] as any,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check camera track capabilities (torch, hardware zoom)
        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps: any = track.getCapabilities();
          if (caps.torch) {
            setHasTorch(true);
          }
          if (caps.zoom) {
            setHasHardwareZoom(true);
            try {
              // Set initial 1.5x zoom to prevent macro focus blur
              track.applyConstraints({ advanced: [{ zoom: 1.5 } as any] });
            } catch {}
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (isMounted) setIsReady(true);
        }

        // 1. Initialize Native BarcodeDetector safely
        let nativeDetector: any = null;
        if ('BarcodeDetector' in window) {
          try {
            let formatsToUse = [
              'ean_13',
              'code_128',
              'code_39',
              'itf',
              'ean_8',
              'upc_a',
              'upc_e',
              'qr_code',
            ];

            if (typeof (window as any).BarcodeDetector.getSupportedFormats === 'function') {
              const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
              formatsToUse = formatsToUse.filter((f) => supported.includes(f));
            }

            if (formatsToUse.length > 0) {
              nativeDetector = new (window as any).BarcodeDetector({ formats: formatsToUse });
              setEngineType('native');
            }
          } catch {
            nativeDetector = null;
          }
        }

        if (!nativeDetector) {
          setEngineType('zxing-enhanced');
        }

        // 2. Initialize ZXing MultiFormatReader with comprehensive formats including ITF for tire cartons
        const hints = new Map<DecodeHintType, any>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF, // Interleaved 2 of 5 (Thai tire box cartons)
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_93,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const zxingReader = new MultiFormatReader();
        zxingReader.setHints(hints);
        zxingReaderRef.current = zxingReader;

        // Setup reusable offscreen canvas for ROI (Region of Interest) cropping & contrast enhancement
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 640;
        offCanvas.height = 360;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        let lastDetectTime = 0;
        let isDetecting = false;
        let frameCount = 0;

        // Scanning Loop (~20-25 times per second)
        const scanLoop = async () => {
          if (!isMounted || !isScanningActiveRef.current) return;

          const now = performance.now();
          if (
            now - lastDetectTime > 45 &&
            !isDetecting &&
            videoRef.current &&
            videoRef.current.readyState >= 2
          ) {
            lastDetectTime = now;
            isDetecting = true;
            frameCount++;

            const video = videoRef.current;
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;

            try {
              // 1. Try Native BarcodeDetector first if available (Instant hardware scan)
              if (nativeDetector) {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  const val = barcodes[0].rawValue;
                  if (val) {
                    handleDetected(val);
                    isDetecting = false;
                    animationFrameId = requestAnimationFrame(scanLoop);
                    return;
                  }
                }
              }

              // 2. High-Performance Canvas ROI (Region of Interest) ZXing Scanner
              if (offCtx && zxingReaderRef.current) {
                // Focus on center viewfinder area (65% width, 50% height) with digital zoom factor
                const zoomFactor = hasHardwareZoom ? 1 : Math.max(1, currentZoom);
                const cropW = (vw * 0.7) / zoomFactor;
                const cropH = (vh * 0.55) / zoomFactor;
                const cropX = (vw - cropW) / 2;
                const cropY = (vh - cropH) / 2;

                offCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, offCanvas.width, offCanvas.height);

                const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
                const data = imgData.data;

                // Alternate frame contrast boost for glossy / curved tire stickers
                if (contrastBoost && frameCount % 2 === 0) {
                  for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    // High-contrast stretch
                    const boosted = gray < 115 ? Math.max(0, gray * 0.7) : Math.min(255, gray * 1.3);
                    data[i] = boosted;
                    data[i + 1] = boosted;
                    data[i + 2] = boosted;
                  }
                }

                try {
                  const lumSource = new RGBLuminanceSource(data, offCanvas.width, offCanvas.height);
                  const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
                  const result = zxingReaderRef.current.decodeWithState(bitmap);

                  if (result && result.getText()) {
                    handleDetected(result.getText());
                  }
                } catch {
                  // Barcode not found in this frame; loop continues
                }
              }
            } catch {
              // Frame dropped safely
            } finally {
              isDetecting = false;
            }
          }

          animationFrameId = requestAnimationFrame(scanLoop);
        };

        animationFrameId = requestAnimationFrame(scanLoop);
      } catch (err: any) {
        console.warn('Camera initialization error:', err);
        if (isMounted) {
          setCameraError(
            'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบว่าเบราว์เซอร์ได้รับสิทธิ์การใช้งานกล้อง และไม่มีแอพอื่นกำลังใช้กล้องอยู่'
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      isScanningActiveRef.current = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [handleDetected, currentZoom, hasHardwareZoom, contrastBoost]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-slate-700/80 shadow-2xl flex flex-col font-['Prompt',sans-serif]">
      {/* Hidden File Input for Image Snapshot Decode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileScan}
        className="hidden"
      />

      {/* Camera Video Stream & Viewfinder */}
      <div
        className="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center cursor-crosshair select-none"
        onClick={handleTapToFocus}
        title="แตะที่หน้าจอเพื่อปรับโฟกัสกล้อง"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Hidden offscreen canvas ref */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading Spinner */}
        {!isReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 text-amber-400 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-semibold">กำลังเชื่อมต่อกล้อง HD Ultra-Fast...</span>
          </div>
        )}

        {/* Target Viewfinder Frame (Optimized for 1D Tire Barcode Stickers) */}
        {isReady && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="w-[84%] max-w-[290px] h-32 relative rounded-xl border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.35)] flex flex-col justify-between p-1 bg-black/15">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <span className="w-5 h-5 border-t-3 border-l-3 border-amber-400 -mt-1 -ml-1 rounded-tl" />
                <span className="w-5 h-5 border-t-3 border-r-3 border-amber-400 -mt-1 -mr-1 rounded-tr" />
              </div>

              {/* Red Laser Scanning Beam */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />

              <div className="flex justify-between">
                <span className="w-5 h-5 border-b-3 border-l-3 border-amber-400 -mb-1 -ml-1 rounded-bl" />
                <span className="w-5 h-5 border-b-3 border-r-3 border-amber-400 -mb-1 -mr-1 rounded-br" />
              </div>
            </div>

            {/* Instruction pill */}
            <div className="mt-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-md text-amber-200 px-3 py-1 rounded-full border border-amber-400/40 shadow-md text-[11px] font-medium">
              <Crosshair className="w-3 h-3 text-amber-400" />
              <span>ถือห่าง 20–30 ซม. ให้เส้นเลเซอร์พาดผ่านแท่งบาร์โค้ด</span>
            </div>
          </div>
        )}

        {/* Success Flash Feedback */}
        {scannedFeedback && (
          <div className="absolute inset-0 bg-emerald-500/35 backdrop-blur-xs flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
            <div className="bg-emerald-950/95 border-2 border-emerald-400 text-emerald-300 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
              <CheckCircle className="w-6 h-6 text-emerald-400 animate-bounce" />
              <div className="text-left">
                <div className="text-xs font-bold">สแกนสำเร็จ!</div>
                <div className="text-xs font-mono font-bold text-white">{scannedFeedback}</div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Error Display */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/95 text-rose-300 text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <p className="text-xs font-medium max-w-xs">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>เลือกภาพจากอัลบั้มแทน</span>
            </button>
          </div>
        )}

        {/* Top Floating Controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
          {/* Engine indicator */}
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-700/60 text-[9px] text-slate-200">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>{engineType === 'native' ? 'Hardware Scanner 60FPS' : 'Enhanced Multi-Format Engine'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Contrast Boost Toggle */}
            <button
              type="button"
              onClick={() => setContrastBoost((prev) => !prev)}
              title={contrastBoost ? 'เปิดโหมดเร่งคอนทราสต์ (ช่วยอ่านฉลากสะท้อนแสง)' : 'ปิดโหมดเร่งคอนทราสต์'}
              className={`px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md transition-all flex items-center gap-1 cursor-pointer ${
                contrastBoost
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-black/60 text-slate-300 border border-slate-700'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>HDR</span>
            </button>

            {/* Flashlight Button */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉายช่วยส่องในที่มืด'}
                className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.6)] font-bold'
                    : 'bg-black/60 text-slate-200 hover:text-white border border-slate-700'
                }`}
              >
                {isTorchOn ? <Flashlight className="w-4 h-4 fill-current" /> : <FlashlightOff className="w-4 h-4" />}
              </button>
            )}

            {/* Photo Upload Fallback */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="สแกนจากรูปภาพในมือถือ"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-slate-200 border border-slate-700 flex items-center justify-center backdrop-blur-md active:scale-90 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Bottom Zoom Preset Buttons */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 pointer-events-auto">
          <ZoomIn className="w-3 h-3 text-amber-400 mr-0.5" />
          {[1, 1.5, 2, 2.5].map((z) => {
            const isActive = Math.abs(currentZoom - z) < 0.2;
            return (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {z}x
              </button>
            );
          })}
        </div>
      </div>

      {/* Helpful bottom tips banner */}
      <div className="p-2.5 bg-[#0a111c] border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>รองรับ EAN-13, Code 128, Code 39, ITF ยางลัง & ปืนยิงสแกนเนอร์ USB</span>
        </span>
        {hasTorch && (
          <span className="text-[10px] text-amber-300">
            {isTorchOn ? '💡 ไฟฉายเปิดอยู่' : '💡 เปิดไฟฉายได้'}
          </span>
        )}
      </div>
    </div>
  );
};
