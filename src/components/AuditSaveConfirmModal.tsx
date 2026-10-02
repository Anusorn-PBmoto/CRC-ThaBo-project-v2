import React from 'react';
import { X, CheckCircle2, AlertTriangle, CloudUpload, ArrowRight } from 'lucide-react';
import { AuditSession } from '../types';

interface AuditSaveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (syncToSystem: boolean) => void;
  session: AuditSession | null;
  totalTires: number;
  checkedCount: number;
  matchedCount: number;
  discrepancyCount: number;
}

export const AuditSaveConfirmModal: React.FC<AuditSaveConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  session,
  totalTires,
  checkedCount,
  matchedCount,
  discrepancyCount,
}) => {
  const [syncToSystem, setSyncToSystem] = React.useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#111c2e] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <CloudUpload className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              ยืนยันการบันทึกผลการนับสต็อก
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs">
          <div className="text-slate-300">
            สรุปผลการตรวจนับรอบ <span className="font-mono text-cyan-300 font-bold">{session?.code || 'AUD-2410-09'}</span> โซนห้องยางชั้น 2:
          </div>

          <div className="bg-[#15233a] border border-slate-750 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">รายการที่ตรวจนับแล้ว:</span>
              <span className="font-mono font-bold text-slate-100">
                {checkedCount} / {totalTires} รายการ
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ตรงตามระบบ:</span>
              </span>
              <span className="font-mono font-bold">{matchedCount} รายการ</span>
            </div>

            <div className="flex items-center justify-between text-amber-400">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ยอดคลาดเคลื่อน:</span>
              </span>
              <span className="font-mono font-bold">{discrepancyCount} รายการ</span>
            </div>
          </div>

          {/* Sync Option Checkbox */}
          <div className="p-2.5 rounded-xl bg-[#142238] border border-slate-750 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="syncOpt"
              checked={syncToSystem}
              onChange={(e) => setSyncToSystem(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-750 focus:ring-0"
            />
            <label htmlFor="syncOpt" className="text-slate-300 leading-tight cursor-pointer">
              <span className="font-semibold text-amber-300 block">ปรับปรุงยอดตามระบบ (Auto-adjust)</span>
              <span className="text-[11px] text-slate-400">
                อัปเดตยอดคงเหลือในระบบให้ตรงกับที่นับได้จริงในคลังสินค้าทันที
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1626] border-t border-slate-800 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-[#17253d] hover:bg-[#203252] text-slate-300 font-medium"
          >
            ย้อนกลับ
          </button>
          <button
            onClick={() => onConfirm(syncToSystem)}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            บันทึกลง Firebase
          </button>
        </div>
      </div>
    </div>
  );
};
