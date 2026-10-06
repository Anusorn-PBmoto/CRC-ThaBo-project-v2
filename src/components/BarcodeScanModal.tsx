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
} from 'lucide-react';
import { TireItem } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tires: TireItem[];
  onSelectTire: (tire: TireItem) => void;
  onBindBarcode?: (tireId: string, barcode: string) => void;
  onOpenAddModalWithBarcode?: (barcode: string) => void;
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
      // Barcode not found in catalog: DO NOT guess randomly!
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#111c2e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>สแกนเนอร์บาร์โค้ดอะไหล่ HD Pro</span>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded">
                  AI FAST
                </span>
              </h3>
              <span className="text-[10px] text-cyan-300">กล้อง HD 1080p • โฟกัสอัตโนมัติ • มีไฟฉาย</span>
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
            <span>📷 กล้อง HD Pro (คมชัด)</span>
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
            <span>⚡ ค้นหา / พิมพ์รหัส</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          {activeMode === 'camera' ? (
            <div className="space-y-2">
              {/* High-Performance Camera Scanner */}
              <CameraBarcodeScanner onScan={handleDecodedBarcode} />
            </div>
          ) : (
            /* Manual / Preset simulation mode */
            <div className="space-y-2.5">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
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

          {/* 1. MATCHED SCAN RESULT */}
          {scannedResult && (
            <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 shadow-xl animate-in slide-in-from-bottom-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-bold text-emerald-300 text-xs">
                    สแกนพบสินค้า: {scannedResult.name || scannedResult.size}
                  </span>
                </div>
                {scannedResult.unit && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200 font-bold">
                    {scannedResult.unit}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-300 flex items-center justify-between">
                <span>ช่องจัดเก็บ: <strong className="text-slate-100">{scannedResult.location || 'RACK A-01'}</strong></span>
                <span>
                  ยอดคงเหลือ:{' '}
                  <strong className="text-amber-300 font-mono text-sm">
                    {scannedResult.actualQty}
                  </strong>{' '}
                  {scannedResult.unit || 'ชิ้น'}
                </span>
              </div>

              {scannedResult.sellingPrice > 0 && (
                <div className="text-[11px] text-emerald-400 font-bold font-mono">
                  ราคาขาย: ฿{scannedResult.sellingPrice.toLocaleString()}
                </div>
              )}

              <button
                onClick={() => confirmSelection(scannedResult)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span>เลือกรายการนี้เพื่อตรวจนับ / ตัดสต็อก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 2. UNMATCHED BARCODE FOUND */}
          {unmatchedBarcode && !scannedResult && (
            <div className="p-3.5 rounded-2xl bg-[#141b2b] border border-amber-500/50 shadow-xl animate-in slide-in-from-bottom-2 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>สแกนพบรหัส: {unmatchedBarcode}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    รหัสนี้ยังไม่ได้ผูกกับสินค้าในระบบ
                  </p>
                </div>
              </div>

              {!isBindingOpen ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsBindingOpen(true)}
                    className="py-2 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>ผูกกับสินค้าที่มี</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenAddModalWithBarcode?.(unmatchedBarcode);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มเป็นสินค้าใหม่</span>
                  </button>
                </div>
              ) : (
                /* Product Search & Bind Selector */
                <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                    <span>ค้นหาสินค้าเพื่อผูกรหัสบาร์โค้ดนี้:</span>
                    <button
                      onClick={() => setIsBindingOpen(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      ยกเลิก
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={bindSearchQuery}
                      onChange={(e) => setBindSearchQuery(e.target.value)}
                      placeholder="พิมพ์ชื่อสินค้า เช่น สายพาน, ผ้าเบรก"
                      className="w-full bg-[#18263d] border border-slate-700 text-slate-100 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:border-cyan-400 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {bindFilteredTires.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleConfirmBind(t)}
                        className="w-full p-2 rounded-xl bg-[#17253d] hover:bg-cyan-950/50 hover:border-cyan-500/50 border border-slate-800 text-left flex items-center justify-between text-slate-200 transition-all text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-100">
                            {t.name || t.size}
                          </div>
                          <div className="text-[10px] text-slate-400">{t.location || 'RACK A-01'} • คงเหลือ {t.actualQty} {t.unit || 'ชิ้น'}</div>
                        </div>
                        <span className="text-[10px] bg-cyan-600/30 text-cyan-300 font-bold px-2 py-1 rounded-lg">
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
