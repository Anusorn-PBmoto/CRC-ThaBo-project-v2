import React, { useState, useEffect, useRef } from 'react';
import { QrCode, User, FileSpreadsheet, ShoppingCart, Users, Laptop, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenProfile: () => void;
  onOpenAppSheet?: () => void;
  onOpenImageMatch?: () => void;
  onToggleStaffPos?: () => void;
  onOpenCustomers?: () => void;
  isDesktopMode?: boolean;
  onToggleDesktopMode?: () => void;
  isOnline: boolean;
  isQuotaMode?: boolean;
  activeZone?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenScanner,
  onOpenProfile,
  onOpenAppSheet,
  onToggleStaffPos,
  onOpenCustomers,
  isDesktopMode = false,
  onToggleDesktopMode,
  isOnline,
  isQuotaMode = false,
}) => {
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsLogoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#20262D]/95 backdrop-blur-md border-b border-[#3A4750] px-4 py-2.5">
      <div className={`${isDesktopMode ? 'max-w-[1600px]' : 'max-w-md'} mx-auto flex items-center justify-between transition-all duration-300`}>
        {/* Brand Title / Logo Dropdown Menu with 3-line Hamburger Icon */}
        <div className="relative flex items-center gap-2" ref={menuRef}>
          <button
            onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)}
            className="flex items-center gap-2 group cursor-pointer text-left bg-[#252C33] hover:bg-[#2A343D] border border-[#3A4750] px-2.5 py-1.5 rounded-lg transition-all shadow-sm"
            title="คลิกเพื่อเปิดเมนูด่วน CRC THABO (สมาชิกลูกค้า, โหมดพนักงาน, AppSheet)"
          >
            <Menu className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
            <h1 className="text-sm font-black tracking-wider text-[#F6C90E] leading-none group-hover:text-amber-300 transition-colors">
              CRC THABO
            </h1>
          </button>

          {/* Logo Dropdown Menu */}
          {isLogoMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-[#252C33] border border-[#3A4750] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-[#3A4750]/60 mb-1">
                <p className="text-[10px] font-bold text-[#A0ABB5] uppercase tracking-wider">เมนูด่วน CRC THABO</p>
              </div>

              {onOpenCustomers && (
                <button
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    onOpenCustomers();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-[#EEEEEE] hover:bg-amber-400/20 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold">สมาชิกลูกค้า & ระดับเกรด</span>
                </button>
              )}

              {onToggleStaffPos && (
                <button
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    onToggleStaffPos();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-[#EEEEEE] hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">โหมดพนักงานขาย (Staff POS)</span>
                </button>
              )}

              {onOpenAppSheet && (
                <button
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    onOpenAppSheet();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-[#EEEEEE] hover:bg-slate-700/50 hover:text-[#F6C90E] transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#F6C90E]" />
                  <span className="font-semibold">AppSheet & Google Sheets</span>
                </button>
              )}
            </div>
          )}

          {onToggleDesktopMode && (
            <button
              onClick={onToggleDesktopMode}
              aria-label="สลับโหมดหน้าจอคอมพิวเตอร์ / มือถือ"
              title={isDesktopMode ? 'สลับกลับเป็นโหมดมือถือ / แท็บเล็ต' : 'สลับไปโหมด Desktop คอมพิวเตอร์ (เต็มจอ กว้างพิเศษ)'}
              className={`h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                isDesktopMode
                  ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                  : 'bg-[#3A4750] text-[#EEEEEE] hover:bg-[#43525D] border-[#475662]'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>{isDesktopMode ? 'Desktop' : 'Mobile'}</span>
            </button>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
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
