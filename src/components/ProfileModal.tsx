import React, { useState } from 'react';
import {
  X,
  User,
  Database,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  Trash2,
  Smartphone,
  Cloud,
  Check,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onClearAllProducts: () => Promise<void>;
  onForceSyncCloud?: () => Promise<void>;
  totalProducts: number;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  onClearAllProducts,
  onForceSyncCloud,
  totalProducts,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClearAll = async () => {
    if (
      window.confirm(
        '⚠️ คุณต้องการนำข้อมูลรายการสินค้าทั้งหมดออกจากระบบ (ตั้งต้นเป็น 0 รายการ) หรือไม่?\n\nข้อมูลเดิมจะถูกล้างออกจากทั้งคลาวด์และหน่วยความจำ เพื่อให้คุณเริ่มต้นบันทึกอะไหล่ใหม่ได้อย่างสะอาด'
      )
    ) {
      setIsProcessing(true);
      try {
        await onClearAllProducts();
        setSyncStatusMsg('นำรายการสินค้าทั้งหมดออกเรียบร้อยแล้ว (0 รายการ)');
        setTimeout(() => setSyncStatusMsg(null), 3000);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSyncCloud = async () => {
    setIsProcessing(true);
    try {
      if (onForceSyncCloud) {
        await onForceSyncCloud();
      }
      setSyncStatusMsg('ซิงค์ข้อมูลกับคลาวด์ Firestore สำเร็จ');
      setTimeout(() => setSyncStatusMsg(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252C33] border-b border-[#475662]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3A4750] text-[#F6C90E] flex items-center justify-center border border-[#475662]">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#EEEEEE]">
              ข้อมูลระบบ & สถานะคลาวด์
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs overflow-y-auto max-h-[80vh]">
          {/* User info */}
          <div className="bg-[#252C33] border border-[#475662] rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F6C90E] text-[#252C33] font-extrabold flex items-center justify-center text-sm shadow-md flex-shrink-0">
              CT
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#EEEEEE] text-sm truncate">CRC ThaBo Manager</div>
              <div className="text-[11px] text-[#A0ABB5] truncate">dooddeetv@gmail.com</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3A4750] text-[#F6C90E] border border-[#475662] inline-block mt-0.5 font-medium">
                ระบบจัดการคลังอะไหล่มอเตอร์ไซค์
              </span>
            </div>
          </div>

          {/* Device & Cloud Sync Explanation Banner */}
          <div className="p-2.5 rounded-xl bg-[#252C33] border border-[#475662] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#F6C90E] font-bold text-xs">
              <Smartphone className="w-4 h-4 text-[#F6C90E] flex-shrink-0" />
              <span>การใช้งานร่วมกับมือถือและแชร์ลิงก์</span>
            </div>
            <p className="text-[11px] text-[#EEEEEE] leading-relaxed">
              ข้อมูลจะถูกบันทึกลงใน <span className="text-[#F6C90E] font-semibold">Firebase Firestore</span> อัตโนมัติ เมื่อเปิดใช้งานบนมือถือหรือแชร์ลิงก์ ข้อมูลจะอัปเดตตรงกันทุกอุปกรณ์แบบ Real-Time ทันที
            </p>
          </div>

          {/* Database info */}
          <div className="bg-[#252C33] border border-[#475662] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#A0ABB5] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#F6C90E]" />
                <span>ฐานข้อมูลคลาวด์:</span>
              </span>
              <span className="font-mono text-[#EEEEEE] font-semibold">Firebase Firestore</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#A0ABB5] flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>สถานะการเชื่อมต่อ:</span>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>{isOnline ? 'ออนไลน์แบบเรียลไทม์' : 'ออฟไลน์'}</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#475662] text-[11px]">
              <span className="text-[#A0ABB5]">จำนวนสินค้าในคลัง:</span>
              <span className="font-mono text-[#F6C90E] font-bold">{totalProducts} รายการ</span>
            </div>
          </div>

          {/* Status Message */}
          {syncStatusMsg && (
            <div className="p-2.5 bg-[#252C33] border border-[#F6C90E] rounded-xl flex items-center gap-2 text-[#F6C90E] text-xs font-semibold animate-in fade-in">
              <Check className="w-4 h-4 text-[#F6C90E] flex-shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* Sync Cloud Button */}
            <button
              onClick={handleSyncCloud}
              disabled={isProcessing}
              className="w-full py-2.5 px-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] rounded-xl font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20 disabled:opacity-50"
            >
              <Cloud className="w-4 h-4 text-[#252C33]" />
              <span>ซิงค์ข้อมูลกับคลาวด์ทันที (Sync to Cloud)</span>
            </button>

            {/* Clear All Data Button */}
            <button
              onClick={handleClearAll}
              disabled={isProcessing}
              className="w-full py-2.5 px-3 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 rounded-xl font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างข้อมูลรายการสินค้าทั้งหมด (เริ่มต้น 0 รายการ)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#252C33] border-t border-[#475662] text-center text-[10px] text-[#A0ABB5]">
          CRC ThaBo Part Inventory • v2.0
        </div>
      </div>
    </div>
  );
};
