import React, { useState } from 'react';
import {
  AlertTriangle,
  ShoppingCart,
  CheckCheck,
  TrendingDown,
  RotateCw,
  Copy,
  Check,
  FileText,
  Boxes,
  Send,
} from 'lucide-react';
import { TireItem } from '../types';

interface SummaryAlertsTabProps {
  tires: TireItem[];
  onOpenPO: (tire: TireItem) => void;
  onSyncAllSystemStock: () => void;
  onJumpToAudit: (tire: TireItem) => void;
}

export const SummaryAlertsTab: React.FC<SummaryAlertsTabProps> = ({
  tires,
  onOpenPO,
  onSyncAllSystemStock,
  onJumpToAudit,
}) => {
  const [copiedText, setCopiedText] = useState(false);

  // Discrepancy items
  const discrepancyItems = tires.filter((t) => t.actualQty !== t.systemQty);

  // Out of stock & low stock
  const outOfStockItems = tires.filter((t) => t.actualQty === 0);
  const lowStockItems = tires.filter((t) => t.actualQty > 0 && t.actualQty <= (t.minStock || 2));

  // Generate PO order text
  const generatePOText = () => {
    const lines = [
      '📋 [ใบสั่งซื้อยางเรเดียล Tubeless - CRC THABO]',
      `วันที่: ${new Date().toLocaleDateString('th-TH')} | ห้องยางชั้น 2`,
      '--------------------------------',
    ];

    const needs = [...outOfStockItems, ...lowStockItems];
    if (needs.length === 0) {
      lines.push('ไม่มีรายการยางที่ต้องสั่งเพิ่มในขณะนี้');
    } else {
      needs.forEach((item, idx) => {
        const orderQty = Math.max(5, (item.minStock || 3) * 2 - item.actualQty);
        lines.push(
          `${idx + 1}. ${item.brand} ${item.size} (${item.rim}") - สั่ง ${orderQty} เส้น [คงเหลือ: ${item.actualQty}]`
        );
      });
    }

    lines.push('--------------------------------');
    lines.push('ส่งโดย: คลังสินค้า CRC ThaBo project');
    return lines.join('\n');
  };

  const handleCopyPO = () => {
    const text = generatePOText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="pb-28 pt-2 px-3 space-y-3.5 max-w-md mx-auto">
      {/* 1. Header Card */}
      <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              สรุปยอดความคลาดเคลื่อน & แจ้งเตือนสินค้า
            </h2>
            <p className="text-[11px] text-slate-400">
              ตรวจสอบสต็อกที่ไม่ตรงระบบ และรายการที่ต้องเติมเข้าคลัง
            </p>
          </div>
        </div>

        {/* Quick summary grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80">
          <div className="bg-[#16243b] border border-slate-750 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-400">คลาดเคลื่อนจากการนับ</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
              {discrepancyItems.length}{' '}
              <span className="text-xs font-normal text-slate-300">รายการ</span>
            </div>
          </div>
          <div className="bg-[#16243b] border border-slate-750 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-400">ต้องสั่งซื้อเพิ่ม (PO)</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
              {outOfStockItems.length + lowStockItems.length}{' '}
              <span className="text-xs font-normal text-slate-300">รุ่น</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Audit Discrepancies Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider">
              รายการคลาดเคลื่อนจากการนับล่าสุด ({discrepancyItems.length})
            </h3>
          </div>
          {discrepancyItems.length > 0 && (
            <button
              onClick={onSyncAllSystemStock}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>ปรับสต็อกตามที่นับ</span>
            </button>
          )}
        </div>

        {discrepancyItems.length === 0 ? (
          <div className="bg-[#131e31] border border-emerald-500/20 rounded-2xl p-4 text-center">
            <CheckCheck className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-emerald-300">
              ยอดนับตรงกับระบบ 100%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ไม่มีสินค้าที่คลาดเคลื่อนในการตรวจนับรอบปัจจุบัน
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {discrepancyItems.map((tire) => {
              const diff = tire.actualQty - tire.systemQty;
              return (
                <div
                  key={tire.id}
                  className="bg-[#131e31] border border-amber-500/30 rounded-2xl p-3 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">
                        {tire.brand} {tire.size}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                        {tire.rim}&quot;
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      ระบบ: <span className="font-mono text-slate-200">{tire.systemQty}</span> | นับได้:{' '}
                      <span className="font-mono font-bold text-amber-400">{tire.actualQty}</span> (
                      {tire.location})
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                        diff > 0
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                    <button
                      onClick={() => onJumpToAudit(tire)}
                      className="px-2 py-1 bg-[#1c2c47] hover:bg-[#25395c] text-slate-300 rounded-lg text-[11px]"
                    >
                      ตรวจซ้ำ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Urgent Replenishment / PO Generator Section */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider">
              ยางที่ต้องสั่งซื้อด่วน ({outOfStockItems.length + lowStockItems.length})
            </h3>
          </div>
          <button
            onClick={handleCopyPO}
            className="text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-[#18263d] border border-slate-700 flex items-center gap-1 transition-all"
          >
            {copiedText ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>คัดลอกใบสั่ง</span>
              </>
            )}
          </button>
        </div>

        {/* List of items needing PO */}
        <div className="space-y-2">
          {[...outOfStockItems, ...lowStockItems].map((tire) => {
            const isZero = tire.actualQty === 0;
            const suggestedOrder = Math.max(5, (tire.minStock || 3) * 2 - tire.actualQty);

            return (
              <div
                key={tire.id}
                className="bg-[#131e31] border border-slate-800 rounded-2xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-100">
                      {tire.brand} {tire.size}
                    </h4>
                    {isZero ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-500/40">
                        หมด (0)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/40">
                        เหลือ {tire.actualQty}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {tire.description || 'ยางมาตรฐาน'} • แนะนำสั่ง {suggestedOrder} เส้น
                  </p>
                </div>

                <button
                  onClick={() => onOpenPO(tire)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-rose-600/20"
                >
                  <ShoppingCart className="w-3 h-3" />
                  <span>เปิด PO</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
