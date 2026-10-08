import React from 'react';
import { QrCode, User, FileSpreadsheet, Image as ImageIcon, Sparkles, Receipt, Mic } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenProfile: () => void;
  onOpenAppSheet?: () => void;
  onOpenImageMatch?: () => void;
  onOpenGeminiFlashScan?: () => void;
  onOpenInvoiceScan?: () => void;
  onOpenVoiceSearch?: () => void;
  isOnline: boolean;
  isQuotaMode?: boolean;
  activeZone?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenScanner,
  onOpenProfile,
  onOpenAppSheet,
  onOpenImageMatch,
  onOpenGeminiFlashScan,
  onOpenInvoiceScan,
  onOpenVoiceSearch,
  isOnline,
  isQuotaMode = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#20262D]/95 backdrop-blur-md border-b border-[#3A4750] px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand Title */}
        <div className="flex items-center">
          <h1 className="text-lg font-black tracking-wider text-[#F6C90E] leading-none">
            CRC THABO
          </h1>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Voice Search button (Flash AI) */}
          {onOpenVoiceSearch && (
            <button
              onClick={onOpenVoiceSearch}
              aria-label="ค้นหาด้วยเสียง"
              title="ค้นหาด้วยเสียงภาษาไทย (Gemini Flash AI)"
              className="w-9 h-9 rounded-lg bg-gradient-to-r from-amber-500/20 to-[#F6C90E]/20 hover:from-amber-500/30 hover:to-[#F6C90E]/30 text-[#F6C90E] border border-[#F6C90E]/50 flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              <Mic className="w-4 h-4 text-[#F6C90E]" />
            </button>
          )}

          {/* Invoice OCR Intake button */}
          {onOpenInvoiceScan && (
            <button
              onClick={onOpenInvoiceScan}
              aria-label="รับเข้าสินค้าด้วยภาพถ่ายบิล"
              title="ถ่ายรูปบิลรับเข้าสินค้า (Gemini Flash OCR)"
              className="w-9 h-9 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#F6C90E] border border-[#475662] flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              <Receipt className="w-4 h-4" />
            </button>
          )}

          {/* Gemini Flash Smart Tire Scanner button */}
          {onOpenGeminiFlashScan && (
            <button
              onClick={onOpenGeminiFlashScan}
              aria-label="Gemini Flash สแกนแก้มยางด้วย AI"
              title="สแกนแก้มยาง/ฉลากด้วย Gemini Flash AI"
              className="h-9 px-2 rounded-lg bg-gradient-to-r from-amber-500/20 via-[#F6C90E]/20 to-amber-500/20 hover:from-amber-500/30 hover:to-[#F6C90E]/30 text-[#F6C90E] border border-[#F6C90E]/50 flex items-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F6C90E]" />
              <span className="text-[10px] font-bold tracking-tight">Flash</span>
            </button>
          )}

          {/* AppSheet CSV Sync button */}
          {onOpenAppSheet && (
            <button
              onClick={onOpenAppSheet}
              aria-label="บันทึก AppSheet CSV"
              title="ฐานข้อมูล AppSheet (crc-thano-project-v2.csv)"
              className="h-9 px-2.5 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] border border-[#475662] flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#F6C90E]" />
              <span className="text-[10px] font-bold tracking-tight">AppSheet</span>
            </button>
          )}

          {/* Barcode/QR Scanner button */}
          <button
            onClick={onOpenScanner}
            aria-label="สแกนเนอร์กล้อง / บาร์โค้ด"
            title="เปิดกล้องสแกนบาร์โค้ด"
            className="w-9 h-9 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] border border-[#475662] flex items-center justify-center transition-all active:scale-95 shadow-sm"
          >
            <QrCode className="w-4 h-4 text-[#F6C90E]" />
          </button>

          {/* Profile / Connection status button */}
          <button
            onClick={onOpenProfile}
            aria-label="ข้อมูลผู้ใช้งานและระบบ"
            title={
              isQuotaMode
                ? 'โหมดออฟไลน์ทำงานบนเครื่อง (Firestore Quota เต็มชั่วคราว)'
                : isOnline
                ? 'Firebase Firestore เรียลไทม์ออนไลน์'
                : 'โหมดออฟไลน์'
            }
            className="w-9 h-9 rounded-lg bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold flex items-center justify-center transition-all active:scale-95 shadow-md shadow-[#F6C90E]/20 relative"
          >
            <User className="w-4 h-4 text-[#252C33]" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#20262D] ${
                isQuotaMode
                  ? 'bg-amber-400 animate-pulse'
                  : isOnline
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
