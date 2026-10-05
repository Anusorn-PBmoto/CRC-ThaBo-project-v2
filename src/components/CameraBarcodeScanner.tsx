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
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

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
  subtitle = 'นำกล้องส่องที่บาร์โค้ด EAN-13 หรือ QR Code บนฉลากยาง',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const lastScannedTimeRef = useRef<number>(0);

  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [supportedZoomRange, setSupportedZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineType, setEngineType] = useState<'native' | 'zxing'>('zxing');
  const [isReady, setIsReady] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

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
      osc.frequency.value = 920;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}

    setScannedFeedback(code);
    setTimeout(() => setScannedFeedback(null), 1500);
  }, []);

  // Handle successful detection
  const handleDetected = useCallback(
    (code: string) => {
      const now = Date.now();
      // Debounce detections (at least 1.2s between same scans)
      if (now - lastScannedTimeRef.current < 1200) return;
      lastScannedTimeRef.current = now;

      triggerFeedback(code);
      onScan(code.trim());
    },
    [onScan, triggerFeedback]
  );

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

  // Set Camera Zoom Level
  const setZoom = async (zoomLevel: number) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomLevel } as any],
      });
      setCurrentZoom(zoomLevel);
    } catch (err) {
      console.warn('Zoom change failed:', err);
    }
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
            const detector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
            });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0) {
              handleDetected(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        // Fallback to ZXing file decode
        try {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints);
          const result = await reader.decodeFromImageUrl(img.src);
          if (result) {
            handleDetected(result.getText());
          }
        } catch {
          alert('ไม่พบบาร์โค้ดในรูปภาพที่เลือก กรุณาลองถ่ายให้ชัดขึ้นหรือมีแสงสว่างเพียงพอ');
        }
      };
    } catch (err) {
      console.warn('File decode failed:', err);
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    let isMounted = true;
    isScanningActiveRef.current = true;
    let animationFrameId: number | null = null;

    const startCamera = async () => {
      setCameraError(null);
      setIsReady(false);

      try {
        // High Definition Full HD stream request with continuous autofocus
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            // Request continuous focus if supported
            advanced: [{ focusMode: 'continuous' }] as any,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check camera track capabilities
        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps: any = track.getCapabilities();
          if (caps.torch) {
            setHasTorch(true);
          }
          if (caps.zoom) {
            setSupportedZoomRange({
              min: caps.zoom.min || 1,
              max: Math.min(caps.zoom.max || 5, 4),
              step: caps.zoom.step || 0.1,
            });
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (isMounted) setIsReady(true);
        }

        // 1. Check if hardware-accelerated Native BarcodeDetector is available
        const hasNative = 'BarcodeDetector' in window;
        let nativeDetector: any = null;

        if (hasNative) {
          try {
            nativeDetector = new (window as any).BarcodeDetector({
              formats: [
                'ean_13',
                'ean_8',
                'code_128',
                'code_39',
                'upc_a',
                'upc_e',
                'qr_code',
              ],
            });
            setEngineType('native');
          } catch (e) {
            nativeDetector = null;
          }
        }

        if (!nativeDetector) {
          setEngineType('zxing');
        }

        // 2. Setup ZXing Reader with high performance hints
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const zxingReader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 80,
        });
        zxingReaderRef.current = zxingReader;

        // Scanning Loop
        let lastDetectTime = 0;
        let isDetecting = false;

        const scanLoop = async () => {
          if (!isMounted || !isScanningActiveRef.current) return;

          const now = performance.now();
          // Scan ~18-20 times per second for maximum responsiveness
          if (now - lastDetectTime > 55 && !isDetecting && videoRef.current && videoRef.current.readyState >= 2) {
            lastDetectTime = now;
            isDetecting = true;

            try {
              if (nativeDetector) {
                // Native Shape Detection API (Fastest on iOS 17+ & Android)
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const rawValue = barcodes[0].rawValue;
                  if (rawValue) {
                    handleDetected(rawValue);
                  }
                }
              } else if (zxingReaderRef.current && videoRef.current) {
                // ZXing Fallback Engine
                try {
                  const result = zxingReaderRef.current.decode(videoRef.current);
                  if (result) {
                    handleDetected(result.getText());
                  }
                } catch {
                  // Not found in this frame, continue
                }
              }
            } catch (err) {
              // Frame dropped, continue
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
            'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบว่าเบราว์เซอร์ได้รับสิทธิ์การใช้งานกล้องแล้ว'
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
  }, [handleDetected]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-slate-700/80 shadow-2xl flex flex-col">
      {/* Hidden File Input for Image Scanning */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileScan}
        className="hidden"
      />

      {/* Camera Video Stream */}
      <div className="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Loading Spinner */}
        {!isReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-amber-400 gap-2">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <span className="text-xs font-semibold">กำลังเชื่อมต่อกล้อง HD...</span>
          </div>
        )}

        {/* Viewfinder Target Guidelines (Tailored for 1D Tire Barcode Stickers) */}
        {isReady && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* Viewfinder Horizontal Barcode Frame */}
            <div className="w-[88%] max-w-[280px] h-32 relative rounded-xl border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex flex-col justify-between p-1 bg-black/15">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <span className="w-4 h-4 border-t-3 border-l-3 border-cyan-400 -mt-1 -ml-1" />
                <span className="w-4 h-4 border-t-3 border-r-3 border-cyan-400 -mt-1 -mr-1" />
              </div>

              {/* Red Laser Scanning Beam Animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse" />

              <div className="flex justify-between">
                <span className="w-4 h-4 border-b-3 border-l-3 border-cyan-400 -mb-1 -ml-1" />
                <span className="w-4 h-4 border-b-3 border-r-3 border-cyan-400 -mb-1 -mr-1" />
              </div>
            </div>

            {/* Instruction pill */}
            <div className="mt-3">
              <span className="text-[11px] font-medium bg-black/75 backdrop-blur-md text-cyan-200 px-3 py-1 rounded-full border border-cyan-500/30 shadow-md">
                ทาบเส้นเลเซอร์สีแดงให้พาดผ่านแท่งบาร์โค้ด
              </span>
            </div>
          </div>
        )}

        {/* Scanned Success Flash Feedback */}
        {scannedFeedback && (
          <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-xs flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
            <div className="bg-emerald-950/95 border-2 border-emerald-400 text-emerald-300 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl">
              <CheckCircle className="w-5 h-5 text-emerald-400 animate-bounce" />
              <div className="text-left">
                <div className="text-xs font-bold">ตรวจพบบาร์โค้ดแล้ว!</div>
                <div className="text-[11px] font-mono text-emerald-200">{scannedFeedback}</div>
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
              className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลดรูปภาพฉลากแทน</span>
            </button>
          </div>
        )}

        {/* Top Floating Controls: Flashlight & Engine Badge */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
          {/* Engine indicator */}
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-700/60 text-[9px] text-slate-300">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>{engineType === 'native' ? 'Hardware AI Engine (60 FPS)' : 'ZXing HD Engine'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Flashlight Button */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉายช่วยส่อง'}
                className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
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
              title="สแกนจากรูปภาพ / อัลบั้ม"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-slate-200 border border-slate-700 flex items-center justify-center backdrop-blur-md active:scale-90"
            >
              <Upload className="w-3.5 h-3.5 text-teal-300" />
            </button>
          </div>
        </div>

        {/* Bottom Zoom Preset Buttons */}
        {supportedZoomRange && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2 py-1 rounded-full border border-slate-700 pointer-events-auto">
            <ZoomIn className="w-3 h-3 text-cyan-400 ml-0.5" />
            {[1, 1.5, 2, 2.5].map((z) => {
              if (z > (supportedZoomRange.max || 4)) return null;
              const isActive = Math.abs(currentZoom - z) < 0.2;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {z}x
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Helpful bottom tips banner */}
      <div className="p-2.5 bg-[#0a111c] border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>ระบบตรวจจับอัตโนมัติ 1D EAN-13 & QR Code</span>
        </span>
        {hasTorch && (
          <span className="text-[10px] text-amber-300/90">
            {isTorchOn ? '💡 เปิดไฟฉายอยู่' : '💡 กดปุ่มไฟฉายหากมืด'}
          </span>
        )}
      </div>
    </div>
  );
};
