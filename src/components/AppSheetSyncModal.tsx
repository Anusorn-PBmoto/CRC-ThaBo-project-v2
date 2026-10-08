import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  FolderDown,
  Info,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  APPSHEET_CSV_FILENAME,
  APPSHEET_EXCEL_FILENAME,
  generateAppSheetCsv,
  downloadAppSheetCsv,
  downloadAppSheetExcel,
  isAutoCsvExportEnabled,
  setAutoCsvExportEnabled,
} from '../utils/appsheetCsv';

interface AppSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
}

export const AppSheetSyncModal: React.FC<AppSheetSyncModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [autoExport, setAutoExport] = useState(isAutoCsvExportEnabled);
  const [copied, setCopied] = useState(false);
  const [downloadCsvSuccess, setDownloadCsvSuccess] = useState(false);
  const [downloadExcelSuccess, setDownloadExcelSuccess] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(true);

  if (!isOpen) return null;

  const handleToggleAuto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoExport(val);
    setAutoCsvExportEnabled(val);
  };

  const handleDownloadCsv = () => {
    downloadAppSheetCsv(products);
    setDownloadCsvSuccess(true);
    setTimeout(() => setDownloadCsvSuccess(false), 3500);
  };

  const handleDownloadExcel = () => {
    downloadAppSheetExcel(products);
    setDownloadExcelSuccess(true);
    setTimeout(() => setDownloadExcelSuccess(false), 3500);
  };

  const handleCopy = async () => {
    try {
      const csv = generateAppSheetCsv(products);
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-lg bg-[#111c2e] border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>ส่งออกฐานข้อมูลคลังสินค้า & AppSheet</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold">
                  PRO
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {APPSHEET_CSV_FILENAME} • {products.length} รายการ
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

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto flex-1">
          {/* Main Status Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/20 to-transparent border border-emerald-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>พร้อมส่งออกข้อมูลแบบ Clean Format (ไม่แตกแถว)</span>
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {products.length} รายการ
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              แก้ไขปัญหารูปภาพ Base64 ล้นเซลล์ และบาร์โค้ดเพี้ยนเป็นเลขยกกำลังเรียบร้อยแล้ว รองรับทั้ง <strong>Google Sheets</strong>, <strong>AppSheet</strong> และ <strong>Microsoft Excel</strong>
            </p>
          </div>

          {/* Action Buttons: 2 formats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Excel Button */}
            <button
              onClick={handleDownloadExcel}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/30 transition-all text-xs border border-teal-400/30"
            >
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-200" />
                <span>{downloadExcelSuccess ? 'ดาวน์โหลดแล้ว!' : 'ดาวน์โหลด Excel (.XLSX)'}</span>
              </div>
              <span className="text-[10px] font-normal text-teal-100/80">
                แนะนำสำหรับเปิดในเครื่อง (บาร์โค้ดไม่เพี้ยน)
              </span>
            </button>

            {/* CSV Button */}
            <button
              onClick={handleDownloadCsv}
              className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 font-bold flex flex-col items-center justify-center gap-1 shadow transition-all text-xs border border-slate-600"
            >
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>{downloadCsvSuccess ? 'ดาวน์โหลดแล้ว!' : 'ดาวน์โหลด CSV (.CSV)'}</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400">
                UTF-8 BOM สำหรับ AppSheet / Drive
              </span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-3 rounded-xl bg-[#172740] hover:bg-[#1e3456] active:scale-95 text-slate-200 hover:text-white border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-all text-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copied ? 'คัดลอกข้อมูล CSV ทั้งหมดแล้ว!' : 'คัดลอกข้อความ CSV (เพื่อนำไป Paste ลง Google Sheets โดยตรง)'}</span>
          </button>

          {/* Explanation Box: Why was the file messy previously? */}
          <div className="p-3 rounded-xl bg-[#132238] border border-cyan-500/30 space-y-2">
            <button
              onClick={() => setShowTroubleshoot(!showTroubleshoot)}
              className="w-full flex items-center justify-between text-left font-bold text-cyan-300 text-xs hover:text-cyan-200"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>สาเหตุที่ตารางเคยดูไม่เรียบร้อย และวิธีแก้ไข</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                {showTroubleshoot ? 'ซ่อน ▲' : 'ดูรายละเอียด ▼'}
              </span>
            </button>

            {showTroubleshoot && (
              <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed pt-1 border-t border-slate-800">
                <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
                  <div className="font-semibold text-amber-300 flex items-center gap-1">
                    <span>1. คอลัมน์ ImageURL ขนาดยาวเกินขีดจำกัด (เกิน 32,767 ตัวอักษร)</span>
                  </div>
                  <p className="text-slate-400">
                    เมื่อถ่ายภาพจากกล้อง ข้อมูลภาพจะถูกเก็บเป็นรหัส <strong>Base64</strong> ซึ่งยาวหลายแสนตัวอักษร เมื่อเปิดใน Excel เซลล์จะล้นเกินขีดจำกัด ทำให้แถวแตกตัวอักษร และคอลัมน์ถัดไป (Status, วันที่) ถูกดันกระเด็นไปคนละช่อง
                  </p>
                  <p className="text-emerald-300 font-medium">
                    ✅ <strong>แก้ไขแล้ว:</strong> ระบบแปลง ImageURL เป็นชื่อไฟล์ Clean Path (เช่น <code className="text-xs bg-black/40 px-1 py-0.5 rounded">products/xxxx.jpg</code>) ทำให้ตารางเรียงสวย ไม่แตกแถว และพร้อมนำไปใช้ใน AppSheet ได้ทันที
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
                  <div className="font-semibold text-amber-300 flex items-center gap-1">
                    <span>2. บาร์โค้ด 13 หลัก กลายเป็นเลขยกกำลัง (เช่น 8.85E+12)</span>
                  </div>
                  <p className="text-slate-400">
                    เกิดจาก Excel มองรหัสบาร์โค้ดเป็นตัวเลขยาว จึงย่อเป็นรูปสัญกรณ์วิทยาศาสตร์
                  </p>
                  <p className="text-emerald-300 font-medium">
                    ✅ <strong>แก้ไขแล้ว:</strong> แนะนำให้กดปุ่ม <strong>"ดาวน์โหลด Excel (.XLSX)"</strong> ซึ่งล็อกประเภทเซลล์เป็น Text ให้โดยตรง หรือหากนำเข้า Google Sheets ให้ไปที่เมนู <em>ไฟล์ &gt; นำเข้า (Import)</em> และเอาติ๊กถูกที่ <em>"แปลงข้อความเป็นตัวเลข วันที่ และสูตร"</em> ออก
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Guide for AppSheet & Google Sheets */}
          <div className="p-3 rounded-xl bg-[#0e1726] border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>วิธีนำไปใช้งานต่อใน Google Sheets & AppSheet</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
              <li>
                <strong>เปิดใน Google Sheets:</strong> เปิด Google Sheets เปล่า &gt; ไปที่ <strong>ไฟล์ (File) &gt; นำเข้า (Import) &gt; อัปโหลด</strong> &gt; เลือกไฟล์ <span className="font-mono text-emerald-300">{APPSHEET_CSV_FILENAME}</span>
              </li>
              <li>
                <strong>สำหรับ AppSheet:</strong> วางไฟล์นี้ในโฟลเดอร์ Google Drive ของคุณ จากนั้นเชื่อมโยง Source ใน AppSheet ได้ทันที
              </li>
              <li>
                <strong>สำหรับเปิดดูใน Excel บนคอมพิวเตอร์:</strong> แนะนำกดดาวน์โหลดปุ่มสีเขียว <strong>.XLSX</strong> จะเปิดได้สวยงามทันทีโดยไม่ต้องตั้งค่าใดๆ เพิ่มเติม
              </li>
            </ol>
          </div>

          {/* Optional Auto Export Toggle */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#0d1626] border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={autoExport}
                onChange={handleToggleAuto}
                className="mt-0.5 w-3.5 h-3.5 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-slate-300 font-medium block">
                  ดาวน์โหลดไฟล์ .csv อัตโนมัติทุกครั้งที่กดบันทึกสินค้า
                </span>
                <span className="text-[10px] text-slate-500 block">
                  (ปิดไว้เพื่อไม่ให้หน้าต่างดาวน์โหลดเด้งรบกวนบ่อยๆ)
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1626] border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            ระบบ CRC THABO V2.0
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
