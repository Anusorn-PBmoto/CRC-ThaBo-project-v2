import React, { useState, useEffect } from 'react';
import {
  X,
  Scan,
  Search,
  CheckCircle,
  ArrowRight,
  Camera,
  Layers,
  AlertTriangle,
  Link,
  Plus,
  Zap,
  Sparkles,
} from 'lucide-react';
import { TireItem } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { resolveProductImage } from '../utils/productImages';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tires: TireItem[];
  onSelectTire: (tire: TireItem) => void;
  onBindBarcode?: (tireId: string, barcode: string) => void;
  onOpenAddModalWithBarcode?: (barcode: string) => void;
  onOpenGeminiFlashScan?: () => void;
}

// Known Thai motorcycle tire EAN-13 barcodes dictionary
const KNOWN_BARCODE_CATALOG: Record<string, { brand: string; size: string; name: string }> = {
  '8858722105389': { brand: 'IRC', size: '120/70-14', name: 'IRC SCT-001 Mobicity 120/70-14' },
  '8858722105372': { brand: 'IRC', size: '110/70-14', name: 'IRC SCT-001 Mobicity 110/70-14' },
  '8858722105396': { brand: 'IRC', size: '140/70-14', name: 'IRC SCT-001 Mobicity 140/70-14' },
  '8858722105358': { brand: 'IRC', size: '90/80-14', name: 'IRC SCT-001 Mobicity 90/80-14' },
  '8858722105365': { brand: 'IRC', size: '90/90-14', name: 'IRC SCT-001 Mobicity 90/90-14' },
  '8858722105334': { brand: 'IRC', size: '80/90-14', name: 'IRC SCT-001 Mobicity 80/90-14' },
  '8858722105341': { brand: 'IRC', size: '100/90-14', name: 'IRC SCT-001 Mobicity 100/90-14' },
  '8858722105402': { brand: 'IRC', size: '130/70-13', name: 'IRC SCT-001 Mobicity 130/70-13' },
  '8858722105419': { brand: 'IRC', size: '110/70-13', name: 'IRC SCT-001 Mobicity 110/70-13' },
  '8858722105426': { brand: 'IRC', size: '120/70-12', name: 'IRC Mobicity 120/70-12' },
  '8858722105433': { brand: 'IRC', size: '110/70-12', name: 'IRC Mobicity 110/70-12' },
  '8858722105440': { brand: 'IRC', size: '130/70-12', name: 'IRC Mobicity 130/70-12' },
};

export const BarcodeScanModal: React.FC<BarcodeScanModalProps> = ({
  isOpen,
  onClose,
  tires,
  onSelectTire,
  onBindBarcode,
  onOpenAddModalWithBarcode,
  onOpenGeminiFlashScan,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<TireItem | null>(null);
  const [unmatchedBarcode, setUnmatchedBarcode] = useState<string | null>(null);

  // Binding search states
  const [bindSearchQuery, setBindSearchQuery] = useState('');
  const [isBindingOpen, setIsBindingOpen] = useState(false);

  // Reset states when modal re-opens
  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      setUnmatchedBarcode(null);
      setIsBindingOpen(false);
      setBindSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Intelligent Barcode Matching Logic
  const handleDecodedBarcode = (code: string) => {
    const rawCode = code.trim();
    const cleanDigits = rawCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 1. Direct match with registered barcode in database
    let matched = tires.find((t) => {
      if (!t.barcode) return false;
      const tBarcode = t.barcode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return tBarcode === cleanDigits || tBarcode === rawCode.toLowerCase();
    });

    // 2. Known manufacturer barcode dictionary (EAN-13 catalog)
    if (!matched && cleanDigits) {
      const known = KNOWN_BARCODE_CATALOG[cleanDigits];
      if (known) {
        matched = tires.find((t) => {
          const tName = (t.name || t.size || '').toLowerCase();
          const tBrand = (t.brand || '').toLowerCase();
          return (
            tBrand === known.brand.toLowerCase() &&
            (tName.includes(known.size.toLowerCase()) || known.size.toLowerCase().includes(tName))
          );
        });
      }
    }

    // 3. Exact or partial match with Product Name, Code, ID, or Location
    if (!matched) {
      matched = tires.find((t) => {
        const tName = (t.name || t.size || '').toLowerCase();
        const tId = t.id.toLowerCase();
        const tLoc = (t.location || '').toLowerCase();
        const q = rawCode.toLowerCase();
        return tName === q || tId === q || tLoc === q;
      });
    }

    // 4. Match if barcode text explicitly contains full tire size e.g. "120/70-14" or "90/90-12"
    if (!matched) {
      const sizePatternMatch = rawCode.match(/(\d{2,3})[/-](\d{2,3})[-/R](\d{2})/i);
      if (sizePatternMatch) {
        const extractedSize = `${sizePatternMatch[1]}/${sizePatternMatch[2]}-${sizePatternMatch[3]}`.toLowerCase();
        matched = tires.find((t) =>
          (t.size || t.name || '').toLowerCase().replace(/\s+/g, '').includes(extractedSize)
        );
      }
    }

    if (matched) {
      setScannedResult(matched);
      setUnmatchedBarcode(null);
      setIsBindingOpen(false);
    } else {
      // Barcode not found in catalog
      setScannedResult(null);
      setUnmatchedBarcode(rawCode);
      setBindSearchQuery('');
    }
  };

  const handleSearchCode = (code: string) => {
    handleDecodedBarcode(code);
  };

  const confirmSelection = (tire: TireItem) => {
    onSelectTire(tire);
    onClose();
  };

  // Handle binding barcode to selected tire
  const handleConfirmBind = (tire: TireItem) => {
    if (!unmatchedBarcode) return;
    if (onBindBarcode) {
      onBindBarcode(tire.id, unmatchedBarcode);
    }
    // Set as scanned result
    const updatedTire = { ...tire, barcode: unmatchedBarcode };
    setScannedResult(updatedTire);
    setUnmatchedBarcode(null);
    setIsBindingOpen(false);
  };

  // Filter products for binding search
  const bindFilteredTires = tires.filter((t) => {
    if (!bindSearchQuery.trim()) return true;
    const q = bindSearchQuery.toLowerCase();
    return (
      (t.name || t.size || '').toLowerCase().includes(q) ||
      (t.barcode || '').toLowerCase().includes(q) ||
      (t.brand || '').toLowerCase().includes(q) ||
      (t.location || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }).slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252C33] border-b border-[#475662]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3A4750] text-[#F6C90E] flex items-center justify-center border border-[#475662]">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-1.5">
                <span>สแกนเนอร์บาร์โค้ดอะไหล่</span>
                <span className="text-[9px] bg-[#F6C90E]/20 text-[#F6C90E] font-bold px-1.5 py-0.2 rounded">
                  HD PRO
                </span>
              </h3>
              <span className="text-[10px] text-[#A0ABB5]">กล้อง HD • โฟกัสอัตโนมัติ</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode switcher tabs */}
        <div className="grid grid-cols-2 gap-1 p-2 bg-[#252C33] border-b border-[#475662] text-xs font-semibold">
          <button
            onClick={() => setActiveMode('camera')}
            className={`py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'camera'
                ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-md'
                : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>📷 กล้อง HD Pro</span>
          </button>

          <button
            onClick={() => setActiveMode('manual')}
            className={`py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'manual'
                ? 'bg-[#3A4750] text-[#EEEEEE] border border-[#475662]'
                : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>⚡ ค้นหา / พิมพ์รหัส</span>
          </button>
        </div>

        {/* Gemini Flash Smart Tire & Label AI Scanner option */}
        {onOpenGeminiFlashScan && (
          <div className="px-3 pt-2 pb-1 bg-[#252C33] border-b border-[#475662]">
            <button
              onClick={() => {
                onClose();
                onOpenGeminiFlashScan();
              }}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-500/20 via-[#F6C90E]/20 to-amber-500/20 hover:from-amber-500/30 hover:to-[#F6C90E]/30 border border-[#F6C90E]/50 text-[#F6C90E] rounded-xl text-xs font-bold flex items-center justify-between active:scale-95 transition-all shadow-sm group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F6C90E] group-hover:scale-110 transition-transform" />
                <span>สแกนแก้มยางด้วย Gemini Flash AI</span>
              </div>
              <span className="text-[9px] bg-[#F6C90E] text-[#252C33] px-2 py-0.5 rounded-md font-black tracking-wider">
                ⚡ FLASH
              </span>
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          {activeMode === 'camera' ? (
            <div className="space-y-2">
              <CameraBarcodeScanner onScan={handleDecodedBarcode} />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[#A0ABB5] font-medium mb-1">
                  พิมพ์รหัสบาร์โค้ด หรือชื่ออะไหล่:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      handleSearchCode(e.target.value);
                    }}
                    placeholder="เช่น 8851234567890 หรือชื่อสินค้า"
                    className="flex-1 bg-[#252C33] border border-[#475662] text-[#EEEEEE] rounded-xl px-3 py-2 text-xs focus:border-[#F6C90E] focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleSearchCode(manualCode)}
                    className="px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs active:scale-95"
                  >
                    ค้นหา
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. MATCHED SCAN RESULT */}
          {scannedResult && (
            <div className="p-3 rounded-2xl bg-[#252C33] border border-[#F6C90E] shadow-xl animate-in slide-in-from-bottom-2 space-y-2.5 overflow-hidden">
              {(scannedResult.imageUrl || resolveProductImage(scannedResult)) && (
                <div className="w-full h-40 -mt-3 -mx-3 mb-1 w-[calc(100%+1.5rem)] overflow-hidden bg-[#20262D] border-b border-[#475662]">
                  <img
                    src={scannedResult.imageUrl || resolveProductImage(scannedResult)}
                    alt={scannedResult.name || 'สินค้า'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#F6C90E] flex-shrink-0" />
                  <span className="font-bold text-[#EEEEEE] text-xs">
                    สแกนพบสินค้า: {scannedResult.name || scannedResult.size}
                  </span>
                </div>
                {scannedResult.unit && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3A4750] text-[#F6C90E] font-bold border border-[#475662]">
                    {scannedResult.unit}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-[#A0ABB5] flex items-center justify-between">
                <span>ช่องจัดเก็บ: <strong className="text-[#EEEEEE]">{scannedResult.location || 'RACK A-01'}</strong></span>
                <span>
                  ยอดคงเหลือ:{' '}
                  <strong className="text-[#F6C90E] font-mono text-sm">
                    {scannedResult.actualQty}
                  </strong>{' '}
                  {scannedResult.unit || 'ชิ้น'}
                </span>
              </div>

              {scannedResult.sellingPrice > 0 && (
                <div className="text-[11px] text-[#F6C90E] font-bold font-mono">
                  ราคาขาย: ฿{scannedResult.sellingPrice.toLocaleString()}
                </div>
              )}

              <button
                onClick={() => confirmSelection(scannedResult)}
                className="w-full py-2.5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span>เลือกรายการนี้เพื่อตรวจนับ / ตัดสต็อก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 2. UNMATCHED BARCODE FOUND */}
          {unmatchedBarcode && !scannedResult && (
            <div className="p-3.5 rounded-2xl bg-[#252C33] border border-[#F6C90E]/50 shadow-xl animate-in slide-in-from-bottom-2 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[#F6C90E] font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-[#F6C90E] flex-shrink-0" />
                    <span>สแกนพบรหัส: {unmatchedBarcode}</span>
                  </div>
                  <p className="text-[11px] text-[#A0ABB5] mt-0.5">
                    รหัสนี้ยังไม่ได้ผูกกับสินค้าในระบบ
                  </p>
                </div>
              </div>

              {!isBindingOpen ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsBindingOpen(true)}
                    className="py-2 px-2.5 rounded-xl bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-[#475662]"
                  >
                    <Link className="w-3.5 h-3.5 text-[#F6C90E]" />
                    <span>ผูกกับสินค้าที่มี</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenAddModalWithBarcode?.(unmatchedBarcode);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มเป็นสินค้าใหม่</span>
                  </button>
                </div>
              ) : (
                /* Product Search & Bind Selector */
                <div className="pt-2 border-t border-[#475662] space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-[#EEEEEE] font-medium">
                    <span>ค้นหาสินค้าเพื่อผูกรหัสบาร์โค้ดนี้:</span>
                    <button
                      onClick={() => setIsBindingOpen(false)}
                      className="text-[10px] text-[#A0ABB5] hover:text-[#EEEEEE]"
                    >
                      ยกเลิก
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
                    <input
                      type="text"
                      value={bindSearchQuery}
                      onChange={(e) => setBindSearchQuery(e.target.value)}
                      placeholder="พิมพ์ชื่อสินค้า เช่น สายพาน, ผ้าเบรก"
                      className="w-full bg-[#3A4750] border border-[#475662] text-[#EEEEEE] rounded-xl pl-8 pr-3 py-1.5 text-xs focus:border-[#F6C90E] focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {bindFilteredTires.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleConfirmBind(t)}
                        className="w-full p-2 rounded-xl bg-[#3A4750] hover:bg-[#43525D] border border-[#475662] text-left flex items-center justify-between text-[#EEEEEE] transition-all text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#EEEEEE]">
                            {t.name || t.size}
                          </div>
                          <div className="text-[10px] text-[#A0ABB5]">{t.location || 'RACK A-01'} • คงเหลือ {t.actualQty} {t.unit || 'ชิ้น'}</div>
                        </div>
                        <span className="text-[10px] bg-[#252C33] text-[#F6C90E] font-bold px-2 py-1 rounded-lg border border-[#F6C90E]/30">
                          ผูกรหัสนี้
                        </span>
                      </button>
                    ))}
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
