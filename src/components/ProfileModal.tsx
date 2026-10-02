import React from 'react';
import { X, User, Database, CheckCircle, RefreshCw, ShieldCheck, HardDrive } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onResetSampleData: () => Promise<void>;
  totalTires: number;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  onResetSampleData,
  totalTires,
}) => {
  const [isResetting, setIsResetting] = React.useState(false);

  if (!isOpen) return null;

  const handleReset = async () => {
    if (window.confirm('คุณต้องการรีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      setIsResetting(true);
      try {
        await onResetSampleData();
      } finally {
        setIsResetting(false);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#111c2e] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              ข้อมูลผู้ใช้ & สถานะระบบ
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          {/* User info */}
          <div className="bg-[#15233a] border border-slate-750 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md">
              CT
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm">CRC ThaBo Manager</div>
              <div className="text-[11px] text-slate-400">dooddeetv@gmail.com</div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-500/30 inline-block mt-0.5">
                เจ้าหน้าที่คลังยางเรเดียล
              </span>
            </div>
          </div>

          {/* Database info */}
          <div className="bg-[#15233a] border border-slate-750 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>ฐานข้อมูล:</span>
              </span>
              <span className="font-mono text-cyan-300 font-semibold">Firebase Firestore</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>โปรเจกต์:</span>
              </span>
              <span className="text-slate-200 font-medium">CRC ThaBo project</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>สถานะซิงค์ข้อมูล:</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isOnline ? 'ออนไลน์แบบเรียลไทม์' : 'ออฟไลน์'}</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">จำนวนรายการในคลัง:</span>
              <span className="font-mono text-slate-200 font-bold">{totalTires} รายการ</span>
            </div>
          </div>

          {/* Reset sample data */}
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1c2b44] hover:bg-[#233757] border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'กำลังกู้คืน...' : 'กู้คืนข้อมูลสินค้าตามไฟล์ CSV (80 รายการ)'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1626] border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
