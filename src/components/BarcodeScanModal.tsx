import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scan,
  QrCode,
  Search,
  CheckCircle,
  ArrowRight,
  Camera,
  Layers,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { TireItem } from '../types';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tires: TireItem[];
  onSelectTire: (tire: TireItem) => void;
}

export const BarcodeScanModal: React.FC<BarcodeScanModalProps> = ({
  isOpen,
  onClose,
  tires,
  onSelectTire,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<TireItem | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-reader';

  // Start live camera
  useEffect(() => {
    let isMounted = true;

    if (isOpen && activeMode === 'camera') {
      const startScanner = async () => {
        setCameraError(null);
        try {
          // Delay briefly to allow DOM element to render
          await new Promise((resolve) => setTimeout(resolve, 200));

          const container = document.getElementById(scannerContainerId);
          if (!container) return;

          // Stop any existing instance
          if (html5QrCodeRef.current) {
            try {
              await html5QrCodeRef.current.stop();
            } catch (e) {
              // ignore
            }
          }

          const html5QrCode = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
            verbose: false,
          });

          html5QrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 12,
              qrbox: { width: 250, height: 180 },
              aspectRatio: 1.33,
            },
            (decodedText) => {
              if (!isMounted) return;
              handleDecodedBarcode(decodedText);
            },
            (errorMessage) => {
              // Standard scan frame miss, ignore
            }
          );

          if (isMounted) {
            setIsCameraActive(true);
          }
        } catch (err: any) {
          console.warn('Camera scan initialization failed:', err);
          if (isMounted) {
            setCameraError(
              'ไม่สามารถเปิดกล้องได้ (เบราว์เซอร์อาจไม่ได้รับสิทธิ์ หรือไม่มีอุปกรณ์กล้อง)'
            );
            setActiveMode('manual');
          }
        }
      };

      startScanner();
    }

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            html5QrCodeRef.current = null;
            setIsCameraActive(false);
          });
      }
    };
  }, [isOpen, activeMode]);

  if (!isOpen) return null;

  // Handle scanned barcode text
  const handleDecodedBarcode = (code: string) => {
    const cleanCode = code.trim().toLowerCase();

    // Match by size, id, brand, or location
    const matched = tires.find(
      (t) =>
        t.size.toLowerCase().includes(cleanCode) ||
        cleanCode.includes(t.size.toLowerCase()) ||
        t.id.toLowerCase() === cleanCode ||
        t.location.toLowerCase() === cleanCode ||
        t.brand.toLowerCase() === cleanCode
    );

    if (matched) {
      setScannedResult(matched);
      // Play a quick pleasant audio beep if Web Audio API is available
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // audio context blocked or not supported
      }
    } else {
      // Find closest partial match
      const partial = tires.find(
        (t) => cleanCode.includes(t.rim) || cleanCode.includes(t.brand.toLowerCase())
      );
      if (partial) {
        setScannedResult(partial);
      }
    }
  };

  const handleSearchCode = (code: string) => {
    handleDecodedBarcode(code);
  };

  const confirmSelection = (tire: TireItem) => {
    onSelectTire(tire);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#111c2e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                สแกนเนอร์บาร์โค้ดยาง (Live Scanner)
              </h3>
              <span className="text-[10px] text-cyan-300">กล้องมือถือจริง & บาร์โค้ดสินค้า</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode switcher tabs: Live Camera vs Quick Presets */}
        <div className="grid grid-cols-2 gap-1 p-2 bg-[#0a111c] border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveMode('camera')}
            className={`py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'camera'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>📷 กล้องมือถือจริง</span>
          </button>

          <button
            onClick={() => setActiveMode('manual')}
            className={`py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'manual'
                ? 'bg-[#1b2b46] text-amber-300 shadow-md border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>⚡ จำลองยิงด่วน / พิมพ์</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          {activeMode === 'camera' ? (
            <div className="space-y-2">
              {/* HTML5 QR Code Scanner Target Container */}
              <div className="relative aspect-video rounded-2xl bg-black border border-slate-700 overflow-hidden flex flex-col items-center justify-center">
                <div
                  id={scannerContainerId}
                  className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />

                {/* Overlay guideline box if camera is active */}
                {isCameraActive && (
                  <div className="absolute inset-4 pointer-events-none border-2 border-dashed border-cyan-400/70 rounded-xl flex flex-col justify-between p-2">
                    <div className="flex justify-between">
                      <span className="w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                      <span className="w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                    </div>
                    {/* Laser scanline */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                    <div className="flex justify-between">
                      <span className="w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                      <span className="w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
                  <span className="text-[10px] bg-black/70 backdrop-blur-sm text-cyan-200 px-2.5 py-1 rounded-full border border-cyan-500/30">
                    นำกล้องส่องที่บาร์โค้ดหน้ายาง หรือ QR Code
                  </span>
                </div>
              </div>

              {cameraError && (
                <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span>{cameraError}</span>
                    <button
                      onClick={() => setActiveMode('manual')}
                      className="block mt-1 text-cyan-400 underline font-semibold"
                    >
                      สลับไปใช้การยิงด่วน / พิมพ์ค้นหา
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual / Quick Presets Mode */
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">
                  จำลองการยิงบาร์โค้ดด่วน (Warehouse Quick Scan):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {tires.slice(0, 6).map((tire) => (
                    <button
                      key={tire.id}
                      onClick={() => confirmSelection(tire)}
                      className="p-2 text-left bg-[#16253c] hover:bg-[#1d3150] border border-slate-750 rounded-xl text-slate-200 transition-all flex items-center justify-between active:scale-95"
                    >
                      <div className="truncate">
                        <div className="font-bold text-[11px] text-amber-300 truncate">
                          {tire.size}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {tire.brand} • {tire.location}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="block text-slate-400 font-medium mb-1">
                  หรือพิมพ์รหัสบาร์โค้ด / เบอร์ยาง:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      handleSearchCode(e.target.value);
                    }}
                    placeholder="เช่น 110/70-12 หรือ A-01"
                    className="flex-1 bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleSearchCode(manualCode)}
                    className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold active:scale-95"
                  >
                    ค้นหา
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Matched Scan Result */}
          {scannedResult && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 shadow-lg animate-in slide-in-from-bottom-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-emerald-300 text-xs">
                    สแกนพบยาง: {scannedResult.brand} {scannedResult.size}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900 text-emerald-200">
                  {scannedResult.rim}&quot;
                </span>
              </div>

              <div className="text-[11px] text-slate-300 flex items-center justify-between">
                <span>ช่องจัดเก็บ: {scannedResult.location}</span>
                <span>
                  ยอดคงเหลือ:{' '}
                  <strong className="text-amber-300 font-mono">
                    {scannedResult.actualQty}
                  </strong>{' '}
                  เส้น
                </span>
              </div>

              <button
                onClick={() => confirmSelection(scannedResult)}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span>เลือกรายการนี้เพื่อตรวจนับ / ตัดสต็อก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
