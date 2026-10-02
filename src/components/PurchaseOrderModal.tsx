import React, { useState } from 'react';
import { X, ShoppingCart, Check, Copy, Printer, FileText } from 'lucide-react';
import { TireItem } from '../types';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TireItem[];
  onConfirmPO: (orderSummary: { poNumber: string; items: { tire: TireItem; qty: number }[] }) => void;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  items,
  onConfirmPO,
}) => {
  const [quantities, setQuantities] = useState<{ [id: string]: number }>(() => {
    const map: { [id: string]: number } = {};
    items.forEach((t) => {
      map[t.id] = Math.max(5, (t.minStock || 3) * 2 - t.actualQty);
    });
    return map;
  });

  const [poNumber] = useState(
    () => `PO-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || items.length === 0) return null;

  const handleQtyChange = (id: string, qty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, qty),
    }));
  };

  const totalTires = Object.values(quantities).reduce((a, b) => a + b, 0);

  const getPOText = () => {
    const lines = [
      `📦 [ใบสั่งซื้อยางเรเดียล Tubeless: ${poNumber}]`,
      `ผู้สั่งซื้อ: คลังสินค้า CRC ThaBo project (ชั้น 2 - ห้องยาง)`,
      `วันที่: ${new Date().toLocaleDateString('th-TH')}`,
      '----------------------------------------',
    ];
    items.forEach((item, i) => {
      const orderQty = quantities[item.id] || 5;
      lines.push(
        `${i + 1}. [${item.brand}] ${item.size} (${item.rim}") จำนวน ${orderQty} เส้น (คงเหลือในคลัง: ${item.actualQty})`
      );
    });
    lines.push('----------------------------------------');
    lines.push(`รวมทั้งหมด: ${totalTires} เส้น`);
    lines.push('กรุณายืนยันกำหนดการส่งสินค้า ขอบคุณครับ');
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPOText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    const orderItems = items.map((tire) => ({
      tire,
      qty: quantities[tire.id] || 5,
    }));
    onConfirmPO({ poNumber, items: orderItems });
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#111c2e] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1626] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                เปิดใบสั่งซื้อยาง (Purchase Order)
              </h3>
              <span className="text-[10px] text-cyan-300 font-mono">{poNumber}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div className="text-slate-300">
            รายการยางที่ต้องสั่งเติมเข้าคลังห้องยางชั้น 2 ({items.length} รายการ):
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-[#15233a] border border-slate-750 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-100 text-xs">
                    {item.brand} {item.size}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    คงเหลือในระบบ: <span className="text-rose-400 font-bold">{item.actualQty}</span> เส้น
                    • ช่อง: {item.location}
                  </div>
                </div>

                {/* Quantity to order stepper */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">สั่ง:</span>
                  <button
                    onClick={() => handleQtyChange(item.id, (quantities[item.id] || 5) - 1)}
                    className="w-7 h-7 rounded-lg bg-[#1c2c47] text-slate-200 font-bold flex items-center justify-center hover:bg-slate-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantities[item.id] || 5}
                    onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                    className="w-12 text-center bg-[#0d1626] border border-slate-700 text-amber-400 font-mono font-bold rounded-lg py-1 text-xs"
                  />
                  <button
                    onClick={() => handleQtyChange(item.id, (quantities[item.id] || 5) + 1)}
                    className="w-7 h-7 rounded-lg bg-[#1c2c47] text-slate-200 font-bold flex items-center justify-center hover:bg-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total summary */}
          <div className="bg-[#0e1728] border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">จำนวนรวมทั้งหมดที่สั่ง:</span>
            <span className="text-base font-extrabold font-mono text-amber-400">
              {totalTires} <span className="text-xs font-normal text-slate-300">เส้น</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1626] border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-[#18263d] hover:bg-[#203250] text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกใบสั่ง'}</span>
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSuccess}
            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 active:scale-95 transition-all"
          >
            {isSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>บันทึก PO สำเร็จ!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>ยืนยันบันทึกใบสั่งซื้อ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
