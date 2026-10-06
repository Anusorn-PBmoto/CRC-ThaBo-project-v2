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
    <header className="sticky top-0 z-30 bg-[#0e1626]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left: App Logo & Zone */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-[1.5px] shadow-lg shadow-amber-500/20 flex-shrink-0">
            <div className="w-full h-full bg-[#111c30] rounded-[10px] flex items-center justify-center text-amber-400">
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
              <h1 className="text-lg font-bold tracking-wider text-amber-400 leading-tight">
                CRC THABO
              </h1>
              {activeZone && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
                  {activeZone}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
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
              className="h-9 px-2.5 rounded-lg bg-[#142922] hover:bg-[#1a382e] text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold tracking-tight">AppSheet</span>
            </button>
          )}

          {/* Barcode/QR Scanner button */}
          <button
            onClick={onOpenScanner}
            aria-label="สแกนเนอร์กล้อง / บาร์โค้ด"
            title="เปิดกล้องสแกนบาร์โค้ด"
            className="w-9 h-9 rounded-lg bg-[#18253b] hover:bg-[#20314d] text-slate-200 border border-slate-700/60 flex items-center justify-center transition-all active:scale-95 shadow-sm"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Profile / Connection status button */}
          <button
            onClick={onOpenProfile}
            aria-label="ข้อมูลผู้ใช้งานและระบบ"
            title="โปรไฟล์และสถานะ Firebase"
            className="w-9 h-9 rounded-lg bg-[#f59e0b] hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-all active:scale-95 shadow-md shadow-amber-500/20 relative"
          >
            <User className="w-4 h-4" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0e1626] ${
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
