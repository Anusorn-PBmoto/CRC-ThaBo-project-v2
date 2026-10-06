import React from 'react';
import { QrCode, User, FileSpreadsheet } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenProfile: () => void;
  onOpenAppSheet?: () => void;
  isOnline: boolean;
  activeZone?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenScanner,
  onOpenProfile,
  onOpenAppSheet,
  isOnline,
  activeZone = 'คลังอะไหล่มอเตอร์ไซค์',
  subtitle = 'ระบบสต็อกอะไหล่ • CRC ThaBo',
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#20262D]/95 backdrop-blur-md border-b border-[#3A4750] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left: App Logo & Zone */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F6C90E] to-[#DDA600] p-[1.5px] shadow-lg shadow-[#F6C90E]/20 flex-shrink-0">
            <div className="w-full h-full bg-[#252C33] rounded-[10px] flex items-center justify-center text-[#F6C90E]">
              <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 3v3" />
                <path d="M12 18v3" />
                <path d="M3 12h3" />
                <path d="M18 12h3" />
                <path d="m5.6 5.6 2.1 2.1" />
                <path d="m16.3 16.3 2.1 2.1" />
                <path d="m5.6 18.4 2.1-2.1" />
                <path d="m16.3 7.7 2.1-2.1" />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-wider text-[#F6C90E] leading-tight">
                CRC THABO
              </h1>
              {activeZone && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#3A4750] border border-[#475662] text-[#EEEEEE]">
                  {activeZone}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#A0ABB5] leading-tight mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
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
            title="โปรไฟล์และสถานะ Firebase"
            className="w-9 h-9 rounded-lg bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold flex items-center justify-center transition-all active:scale-95 shadow-md shadow-[#F6C90E]/20 relative"
          >
            <User className="w-4 h-4 text-[#252C33]" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#20262D] ${
                isOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              title={isOnline ? 'Firebase เรียลไทม์ออนไลน์' : 'ออฟไลน์'}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
