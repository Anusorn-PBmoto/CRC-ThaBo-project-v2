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
import { GeminiStockAdvisorCard } from './GeminiStockAdvisorCard';

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
      '📋 [ใบสั่งซื้ออะไหล่มอเตอร์ไซค์ - CRC THABO]',
      `วันที่: ${new Date().toLocaleDateString('th-TH')} | คลังอะไหล่`,
      '--------------------------------',
    ];

    const needs = [...outOfStockItems, ...lowStockItems];
    if (needs.length === 0) {
      lines.push('ไม่มีรายการอะไหล่ที่ต้องสั่งเพิ่มในขณะนี้');
    } else {
      needs.forEach((item, idx) => {
        const orderQty = Math.max(5, (item.minStock || 3) * 2 - item.actualQty);
        lines.push(
          `${idx + 1}. ${item.name || `${item.brand} ${item.size}`} - สั่ง ${orderQty} ${item.unit || 'ชิ้น'} [คงเหลือ: ${item.actualQty}]`
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
    <div className="pb-28 pt-2 px-3 space-y-3.5 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Header Card */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-4 shadow-md">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#252C33] text-[#F6C90E] border border-[#475662] flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#EEEEEE]">
              สรุปยอดความคลาดเคลื่อน & แจ้งเตือนสินค้า
            </h2>
            <p className="text-[11px] text-[#A0ABB5]">
              ตรวจสอบสต็อกที่ไม่ตรงระบบ และรายการที่ต้องเติมเข้าคลัง
            </p>
          </div>
        </div>

        {/* Quick summary grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#475662]">
          <div className="bg-[#252C33] border border-[#475662] rounded-xl p-2.5">
            <div className="text-[11px] text-[#A0ABB5]">คลาดเคลื่อนจากการนับ</div>
            <div className="text-xl font-bold font-mono text-[#F6C90E] mt-0.5">
              {discrepancyItems.length}{' '}
              <span className="text-xs font-normal text-[#EEEEEE]">รายการ</span>
            </div>
          </div>
          <div className="bg-[#252C33] border border-[#475662] rounded-xl p-2.5">
            <div className="text-[11px] text-[#A0ABB5]">ต้องสั่งซื้อเพิ่ม (PO)</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
              {outOfStockItems.length + lowStockItems.length}{' '}
              <span className="text-xs font-normal text-[#EEEEEE]">รุ่น</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini Flash AI Stock Advisor */}
      <GeminiStockAdvisorCard tires={tires} />

      {/* 2. Audit Discrepancies Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F6C90E]" />
            <h3 className="text-xs font-bold text-[#EEEEEE] tracking-wider">
              รายการคลาดเคลื่อนจากการนับล่าสุด ({discrepancyItems.length})
            </h3>
          </div>
          {discrepancyItems.length > 0 && (
            <button
              onClick={onSyncAllSystemStock}
              className="text-[11px] text-[#F6C90E] hover:text-[#E5B800] font-bold flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>ปรับสต็อกตามที่นับ</span>
            </button>
          )}
        </div>

        {discrepancyItems.length === 0 ? (
          <div className="bg-[#3A4750] border border-emerald-500/30 rounded-2xl p-4 text-center">
            <CheckCheck className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-emerald-300">
              ยอดนับตรงกับระบบ 100%
            </p>
            <p className="text-[11px] text-[#A0ABB5] mt-0.5">
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
                  className="bg-[#3A4750] border border-[#F6C90E]/30 rounded-2xl p-3 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#EEEEEE]">
                        {tire.name || `${tire.brand} ${tire.size}`}
                      </h4>
                      {tire.unit && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#252C33] text-[#EEEEEE] border border-[#475662]">
                          {tire.unit}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#A0ABB5] mt-0.5">
                      ระบบ: <span className="font-mono text-[#EEEEEE]">{tire.systemQty}</span> | นับได้:{' '}
                      <span className="font-mono font-bold text-[#F6C90E]">{tire.actualQty}</span> (
                      {tire.location})
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                        diff > 0
                          ? 'bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40'
                          : 'bg-[#252C33] text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                    <button
                      onClick={() => onJumpToAudit(tire)}
                      className="px-2 py-1 bg-[#252C33] hover:bg-[#2C353E] text-[#EEEEEE] border border-[#475662] rounded-lg text-[11px]"
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
            <h3 className="text-xs font-bold text-[#EEEEEE] tracking-wider">
              อะไหล่ที่ต้องสั่งซื้อด่วน ({outOfStockItems.length + lowStockItems.length})
            </h3>
          </div>
          <button
            onClick={handleCopyPO}
            className="text-[11px] text-[#EEEEEE] hover:bg-[#43525D] px-2.5 py-1 rounded-lg bg-[#252C33] border border-[#475662] flex items-center gap-1 transition-all"
          >
            {copiedText ? (
              <>
                <Check className="w-3 h-3 text-[#F6C90E]" />
                <span className="text-[#F6C90E] font-bold">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#F6C90E]" />
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
                className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#EEEEEE]">
                      {tire.name || `${tire.brand} ${tire.size}`}
                    </h4>
                    {isZero ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#252C33] text-rose-400 border border-rose-500/40">
                        หมด (0)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40">
                        เหลือ {tire.actualQty}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#A0ABB5] mt-0.5">
                    {tire.description || 'อะไหล่มาตรฐาน'} • แนะนำสั่ง {suggestedOrder} {tire.unit || 'ชิ้น'}
                  </p>
                </div>

                <button
                  onClick={() => onOpenPO(tire)}
                  className="px-3 py-1.5 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-[#F6C90E]/20"
                >
                  <ShoppingCart className="w-3 h-3 text-[#252C33]" />
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
