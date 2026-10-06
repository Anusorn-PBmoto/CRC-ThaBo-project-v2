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
  ExternalLink,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  APPSHEET_CSV_FILENAME,
  generateAppSheetCsv,
  downloadAppSheetCsv,
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
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleToggleAuto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoExport(val);
    setAutoCsvExportEnabled(val);
  };

  const handleDownload = () => {
    downloadAppSheetCsv(products);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
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
      <div className="w-full max-w-md bg-[#111c2e] border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>ฐานข้อมูล AppSheet</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold">
                  .CSV
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {APPSHEET_CSV_FILENAME}
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
                <span>พร้อมส่งออกฐานข้อมูล AppSheet</span>
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {products.length} รายการ
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              ไฟล์ <span className="font-mono text-emerald-300 font-semibold">{APPSHEET_CSV_FILENAME}</span> เข้ารหัส UTF-8 BOM รองรับภาษาไทย 100% ใช้งานร่วมกับ AppSheet และ Google Sheets
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleDownload}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-sm"
            >
              <Download className="w-4 h-4" />
              <span>{downloadSuccess ? 'ดาวน์โหลดเรียบร้อยแล้ว!' : 'กดดาวน์โหลดไฟล์ ' + APPSHEET_CSV_FILENAME}</span>
            </button>

            <button
              onClick={handleCopy}
              className="w-full py-2.5 px-3 rounded-xl bg-[#172740] hover:bg-[#1e3456] active:scale-95 text-slate-200 hover:text-white border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-all text-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copied ? 'คัดลอกข้อมูล CSV ทั้งหมดแล้ว!' : 'คัดลอกข้อมูล CSV (สำหรับนำไปวางใน Google Sheets)'}</span>
            </button>
          </div>

          {/* Where is the file saved? */}
          <div className="p-3 rounded-xl bg-[#132238] border border-slate-700/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <FolderDown className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>ไฟล์ที่ดาวน์โหลดจะไปอยู่ที่ไหน?</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong>บนมือถือ iPhone/iPad:</strong> ไฟล์จะอยู่ในแอป <strong>"ไฟล์" (Files) &gt; "รายการดาวน์โหลด" (Downloads)</strong>
              </li>
              <li>
                <strong>บนมือถือ Android:</strong> ไฟล์จะอยู่ในแอป <strong>"Files" หรือ "ตัวจัดการไฟล์" &gt; โฟลเดอร์ Download</strong>
              </li>
              <li>
                <strong>บนคอมพิวเตอร์:</strong> ไฟล์จะอยู่ในโฟลเดอร์ <strong>Downloads</strong>
              </li>
            </ul>
          </div>

          {/* Guide for AppSheet */}
          <div className="p-3 rounded-xl bg-[#0e1726] border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>วิธีนำไฟล์ไปใช้ใน AppSheet</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
              <li>
                นำไฟล์ <span className="font-mono text-emerald-300">{APPSHEET_CSV_FILENAME}</span> อัปโหลดขึ้นไปยัง <strong>Google Drive</strong> ของคุณ
              </li>
              <li>
                ใน AppSheet กดสร้างแอปใหม่ (<strong>Create &gt; App &gt; Start with existing data</strong>)
              </li>
              <li>
                เลือก <strong>Google Sheets / Google Drive</strong> แล้วเลือกไฟล์ <span className="font-mono text-emerald-300">{APPSHEET_CSV_FILENAME}</span> นี้ได้ทันที
              </li>
            </ol>
          </div>

          {/* Optional Auto Export Toggle (Default off) */}
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
                  (ปิดไว้เพื่อไม่ให้มือถือเด้งหน้าต่างดาวน์โหลดขึ้นมาทุกครั้ง)
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1626] border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
