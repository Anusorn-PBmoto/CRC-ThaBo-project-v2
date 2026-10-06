import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  Plus,
  RefreshCw,
  Sparkles,
  ClipboardPaste,
  Layers,
  ArrowRight,
  Database,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { ProductItem } from '../types';
import { ITEM_DETAILS_SHEET_DATA } from '../initialData';

interface ItemDetailsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProducts: (products: ProductItem[]) => Promise<void>;
  existingCount: number;
}

export const ItemDetailsImportModal: React.FC<ItemDetailsImportModalProps> = ({
  isOpen,
  onClose,
  onImportProducts,
  existingCount,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'paste' | 'file'>('preset');
  const [pastedText, setPastedText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  // Parse CSV/TSV pasted from Google Sheets or Excel
  const parsePastedSheet = (text: string): ProductItem[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const items: ProductItem[] = [];

    // Check if line 1 is header
    const firstLineLower = lines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('รหัส') ||
      firstLineLower.includes('code') ||
      firstLineLower.includes('name') ||
      firstLineLower.includes('ชื่อ') ||
      firstLineLower.includes('price');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, idx) => {
      // Split by tab (Excel/Sheets copy-paste) or comma
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');
      const cleanCols = cols.map((c) => c.trim().replace(/^["']|["']$/g, ''));

      if (cleanCols.length >= 2 && cleanCols[0]) {
        const barcode = cleanCols[0] || `ITEM-${String(idx + 1).padStart(3, '0')}`;
        const name = cleanCols[1] || `สินค้า ${barcode}`;
        const unit = cleanCols[2] || 'ชิ้น';
        const costPrice = parseFloat(cleanCols[3]?.replace(/[^0-9.]/g, '')) || 0;
        const sellingPrice = parseFloat(cleanCols[4]?.replace(/[^0-9.]/g, '')) || costPrice * 1.3 || 0;
        const imageUrl = cleanCols[5]?.startsWith('http') || cleanCols[5]?.startsWith('data:') ? cleanCols[5] : '';
        const qty = parseFloat(cleanCols[6]?.replace(/[^0-9.]/g, '')) || (cleanCols[5] && !isNaN(Number(cleanCols[5])) ? Number(cleanCols[5]) : 10);

        items.push({
          id: barcode || `item-${Date.now()}-${idx}`,
          barcode,
          name,
          unit: unit || 'ชิ้น',
          costPrice,
          sellingPrice,
          imageUrl,
          actualQty: qty,
          systemQty: qty,
          status: 'checked',
          minStock: 3,
          category: 'อะไหล่และอุปกรณ์',
          brand: 'มาตรฐาน',
          location: 'RACK A-01',
          updatedAt: new Date().toISOString(),
          size: name,
          price: sellingPrice,
        });
      }
    });

    return items;
  };

  const handleImportPreset = async () => {
    setIsImporting(true);
    try {
      await onImportProducts(ITEM_DETAILS_SHEET_DATA);
      setImportedCount(ITEM_DETAILS_SHEET_DATA.length);
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPasted = async () => {
    const parsed = parsePastedSheet(pastedText);
    if (parsed.length === 0) {
      alert('ไม่พบข้อมูลรายการสินค้าที่ถูกต้อง กรุณาตรวจสอบข้อความที่วาง (อย่างน้อยต้องมี รหัสสินค้า และ ชื่อสินค้า)');
      return;
    }

    setIsImporting(true);
    try {
      await onImportProducts(parsed);
      setImportedCount(parsed.length);
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const parsed = parsePastedSheet(content);
        if (parsed.length > 0) {
          setIsImporting(true);
          try {
            await onImportProducts(parsed);
            setImportedCount(parsed.length);
            setImportSuccess(true);
            setTimeout(() => {
              setImportSuccess(false);
              onClose();
            }, 1500);
          } finally {
            setIsImporting(false);
          }
        } else {
          alert('ไม่สามารถอ่านข้อมูลจากไฟล์ได้ กรุณาใช้ไฟล์ .CSV ที่มีข้อมูล');
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-lg bg-[#101b2d] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0b1424] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>นำเข้าข้อมูลจากชีท ItemDeteils</span>
                <span className="text-[10px] px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-full font-semibold">
                  7 ฟิลด์หลัก
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                เพิ่มรายการสินค้าเข้าคลัง CRC ThaBo พร้อมบันทึกฐานข้อมูล
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-800 bg-[#0d1626] p-1 gap-1">
          <button
            onClick={() => setActiveTab('preset')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'preset'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ชุดข้อมูลชีท ItemDeteils ({ITEM_DETAILS_SHEET_DATA.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'paste'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>คัดลอก/วางจาก Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'file'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>อัปโหลดไฟล์ CSV</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto flex-1">
          {importSuccess ? (
            <div className="p-6 text-center space-y-3 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-emerald-300">
                นำเข้าข้อมูลสำเร็จแล้ว {importedCount} รายการ!
              </h4>
              <p className="text-xs text-slate-300">
                บันทึกลงฐานข้อมูลคลาวด์และพร้อมสำหรับออกไฟล์ AppSheet เรียบร้อยแล้ว
              </p>
            </div>
          ) : (
            <>
              {/* Field Schema Specs */}
              <div className="p-3 rounded-xl bg-[#14233c] border border-cyan-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                  <span className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    โครงสร้างคอลัมน์ชีท ItemDeteils (7 ช่อง):
                  </span>
                  <span className="text-slate-400 font-normal">
                    ปัจจุบันในระบบ: {existingCount} รายการ
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">1. รหัสสินค้า</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">2. ชื่อสินค้า</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">3. หน่วยนับ</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">4. ราคาซื้อ</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">5. ราคาขาย</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded border border-amber-500/40">6. รูปภาพ (ใส่ทีหลังได้)</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 rounded border border-emerald-500/40">7. จำนวนคงเหลือ</span>
                </div>
              </div>

              {activeTab === 'preset' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-300">
                    รายการสินค้าอะไหล่มอเตอร์ไซค์แท้ศูนย์จากชีท <strong className="text-cyan-300">ItemDeteils</strong> จำนวน {ITEM_DETAILS_SHEET_DATA.length} รายการ พร้อมข้อมูลครบถ้วน:
                  </div>

                  {/* Preview List */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800">
                    {ITEM_DETAILS_SHEET_DATA.map((item, i) => (
                      <div key={item.id} className="pt-1.5 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono font-bold text-cyan-400 text-[10px] w-5 text-right flex-shrink-0">
                            {i + 1}.
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-amber-300 bg-amber-950/50 px-1 py-0.2 rounded border border-amber-500/30">
                                {item.barcode}
                              </span>
                              <span className="truncate">{item.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>หน่วย: <strong className="text-slate-300">{item.unit}</strong></span>
                              <span>ทุน: ฿{item.costPrice}</span>
                              <span className="text-emerald-400">ขาย: ฿{item.sellingPrice}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 rounded font-bold font-mono text-[10px] border border-emerald-500/40">
                            คงเหลือ {item.actualQty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleImportPreset}
                    disabled={isImporting}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all text-sm disabled:opacity-50"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      {isImporting
                        ? 'กำลังบันทึกลงฐานข้อมูล...'
                        : `เพิ่ม ${ITEM_DETAILS_SHEET_DATA.length} รายการจากชีท ItemDeteils ลงแอปทันที`}
                    </span>
                  </button>
                </div>
              )}

              {activeTab === 'paste' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      วางตารางข้อมูลจาก Google Sheets หรือ Excel (ชีท ItemDeteils)
                    </label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="วางแถวข้อมูลที่คัดลอกจากชีท เช่น:&#10;SP-001	น้ำมันเครื่อง 4T	ขวด	95	140		20&#10;SP-002	หัวเทียน Wave110i	หัว	65	110		30"
                      rows={6}
                      className="w-full p-2.5 bg-[#09111e] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    onClick={handleImportPasted}
                    disabled={isImporting || !pastedText.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all text-sm disabled:opacity-50"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ClipboardPaste className="w-4 h-4" />
                    )}
                    <span>
                      {isImporting ? 'กำลังประมวลผลและบันทึก...' : 'นำเข้าข้อมูลที่วางลงระบบ'}
                    </span>
                  </button>
                </div>
              )}

              {activeTab === 'file' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-6 text-center space-y-2 bg-[#09111e]/50 transition-colors">
                    <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
                    <div className="text-xs font-semibold text-slate-200">
                      เลือกไฟล์ .CSV หรือไฟล์ตารางข้อมูลชีท ItemDeteils
                    </div>
                    <p className="text-[10px] text-slate-400">
                      รองรับไฟล์ CSV ที่เข้ารหัส UTF-8
                    </p>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer pt-2"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
