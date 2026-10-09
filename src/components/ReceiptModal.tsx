import React, { useState } from 'react';
import {
  Printer,
  Copy,
  Check,
  X,
  Receipt,
  Store,
  Warehouse,
  Share2,
  CheckCircle2,
} from 'lucide-react';

export interface ReceiptItemData {
  name: string;
  brand?: string;
  size?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface ReceiptData {
  receiptNo: string;
  dateStr: string;
  timeStr: string;
  customer: string;
  locationTarget: 'front' | 'warehouse';
  items: ReceiptItemData[];
  totalAmount: number;
  totalQuantity: number;
  note?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
  isLightMode?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  isLightMode = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    // Open print dialog or print printable receipt element directly
    try {
      const printContents = document.getElementById('printable-receipt')?.innerHTML;
      if (!printContents) {
        window.print();
        return;
      }

      const printWindow = window.open('', '_blank', 'height=600,width=400');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>ใบเสร็จรับเงิน - ${receipt.receiptNo}</title>
              <style>
                body {
                  font-family: 'Prompt', sans-serif, sans-serif;
                  padding: 16px;
                  color: #000;
                  background: #fff;
                  max-width: 80mm;
                  margin: 0 auto;
                }
                .text-center { text-align: center; }
                .font-black { font-weight: 900; }
                .font-bold { font-weight: 700; }
                .font-mono { font-family: monospace; }
                .border-b { border-bottom: 1px solid #ccc; }
                .border-dashed { border-style: dashed; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .items-baseline { align-items: baseline; }
                .text-xs { font-size: 12px; }
                .text-sm { font-size: 14px; }
                .text-base { font-size: 16px; }
                .space-y-1 > * + * { margin-top: 4px; }
                .space-y-3 > * + * { margin-top: 12px; }
                .pt-2 { padding-top: 8px; }
                .pb-2 { padding-bottom: 8px; }
                .mt-2 { margin-top: 8px; }
                .py-1 { padding-top: 4px; padding-bottom: 4px; }
                .bg-emerald-50 { background: #ecfdf5; color: #047857; }
                .border-emerald-200 { border: 1px solid #a7f3d0; }
                .rounded-lg { border-radius: 8px; }
                .text-center { text-align: center; }
              </style>
            </head>
            <body>
              ${printContents}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Fallback to standard window.print', err);
      window.print();
    }
  };

  const handleCopyText = async () => {
    const lines = [
      '🧾 ใบเสร็จรับเงิน / สลิปการขาย - CRC ThaBo',
      `เลขที่บิล: ${receipt.receiptNo}`,
      `วันที่: ${receipt.dateStr} เวลา ${receipt.timeStr} น.`,
      `ลูกค้า: ${receipt.customer || 'ลูกค้าหน้าร้าน'}`,
      `จุดจำหน่าย: ${receipt.locationTarget === 'front' ? 'คลังหน้าร้าน' : 'คลังหลังร้าน'}`,
      '----------------------------------------',
      ...receipt.items.map(
        (item, idx) =>
          `${idx + 1}. ${item.name || item.size} × ${item.quantity} = ฿${(
            item.unitPrice * item.quantity
          ).toLocaleString()}`
      ),
      '----------------------------------------',
      `รวมทั้งสิ้น: ${receipt.totalQuantity} ชิ้น`,
      `💰 ยอดสุทธิ: ฿${receipt.totalAmount.toLocaleString()} บาท`,
      '----------------------------------------',
      'ขอบคุณที่ใช้บริการ CRC ThaBo ครับ 🙏',
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      {/* Print Specific CSS to ensure clean thermal slip / document print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={`${
          isLightMode
            ? 'bg-white border border-slate-300 text-slate-800'
            : 'bg-[#20262D] border border-[#F6C90E]/50 text-[#EEEEEE]'
        } rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl space-y-3 p-4 my-auto relative animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Controls */}
        <div
          className={`flex items-center justify-between no-print pb-2 border-b ${
            isLightMode ? 'border-slate-200' : 'border-[#3A4750]'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg ${
                isLightMode ? 'bg-amber-400 text-slate-900' : 'bg-[#F6C90E] text-[#252C33]'
              } flex items-center justify-center font-bold`}
            >
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3
                className={`text-xs font-bold ${
                  isLightMode ? 'text-slate-900' : 'text-[#EEEEEE]'
                }`}
              >
                ใบเสร็จรับเงิน
              </h3>
              <span
                className={`text-[10px] block font-mono ${
                  isLightMode ? 'text-slate-500' : 'text-[#A0ABB5]'
                }`}
              >
                {receipt.receiptNo}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
              isLightMode
                ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Printable Slip Section (Paper Thermal Receipt Look) */}
        <div
          id="printable-receipt"
          className="bg-white text-slate-900 rounded-2xl p-4 shadow-inner font-sans text-xs space-y-3 border border-slate-200"
        >
          {/* Slip Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-2.5">
            <h2 className="text-base font-black tracking-wider text-slate-900">
              CRC THABO
            </h2>
            <p className="text-[11px] font-semibold text-slate-600">
              คลังยางและอะไหล่มอเตอร์ไซค์ ท่าบ่อ
            </p>
            <p className="text-[9px] text-slate-500">
              ใบเสร็จรับเงิน / ใบส่งสินค้า (RECEIPT)
            </p>
          </div>

          {/* Slip Metadata */}
          <div className="text-[11px] text-slate-600 space-y-1 border-b border-dashed border-slate-300 pb-2.5">
            <div className="flex justify-between">
              <span>เลขที่บิล:</span>
              <span className="font-mono font-bold text-slate-800">
                {receipt.receiptNo}
              </span>
            </div>
            <div className="flex justify-between">
              <span>วันที่ / เวลา:</span>
              <span>
                {receipt.dateStr} {receipt.timeStr} น.
              </span>
            </div>
            <div className="flex justify-between">
              <span>ลูกค้า / รถ:</span>
              <span className="font-bold text-slate-800">
                {receipt.customer || 'ลูกค้าหน้าร้าน'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>จุดจำหน่าย:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                {receipt.locationTarget === 'front' ? 'คลังหน้าร้าน' : 'คลังหลังร้าน'}
              </span>
            </div>
          </div>

          {/* Slip Items Table */}
          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2.5">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase pb-0.5">
              <span>รายการ</span>
              <span>จำนวน × ราคา</span>
            </div>

            {receipt.items.map((item, idx) => {
              const subtotal = item.unitPrice * item.quantity;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-[11px] font-medium text-slate-800">
                    <span className="truncate pr-1">
                      {idx + 1}. {item.name || item.size}
                    </span>
                    <span className="font-mono font-bold text-slate-900 flex-shrink-0">
                      ฿{subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 pl-3">
                    {item.quantity} {item.unit || 'ชิ้น'} × ฿{item.unitPrice.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slip Total Summary */}
          <div className="space-y-1 pt-0.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>รวมจำนวนสินค้า:</span>
              <span className="font-bold text-slate-800">
                {receipt.totalQuantity} ชิ้น
              </span>
            </div>

            <div className="flex justify-between items-baseline text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>ยอดรวมสุทธิ:</span>
              <span className="text-base font-black font-mono text-slate-950">
                ฿{receipt.totalAmount.toLocaleString()} บาท
              </span>
            </div>

            <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 py-1 rounded-lg mt-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ชำระเงินเรียบร้อย • ตัดสต็อกแล้ว</span>
            </div>
          </div>

          {/* Slip Footer Message */}
          <div className="text-center text-[10px] text-slate-500 border-t border-dashed border-slate-300 pt-2 space-y-0.5">
            <p className="font-semibold text-slate-700">
              ขอบคุณที่ใช้บริการ CRC ThaBo
            </p>
            <p className="text-[9px]">
              สินค้าซื้อแล้วโปรดตรวจสอบก่อนออกจากร้าน
            </p>
          </div>
        </div>

        {/* Action Buttons (Not Printed) */}
        <div className="grid grid-cols-2 gap-2 pt-1 no-print">
          <button
            type="button"
            onClick={handleCopyText}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
              isLightMode
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-[#252C33] hover:bg-[#2F3740] text-[#EEEEEE] border border-[#475662]'
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">คัดลอกแล้ว!</span>
              </>
            ) : (
              <>
                <Copy className={`w-4 h-4 ${isLightMode ? 'text-amber-500' : 'text-[#F6C90E]'}`} />
                <span>คัดลอกส่ง LINE</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
              isLightMode
                ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-400/20'
                : 'bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33]'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ใบเสร็จ / PDF</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors no-print cursor-pointer ${
            isLightMode
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              : 'bg-[#252C33] hover:bg-[#2C353F] text-[#A0ABB5]'
          }`}
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
};
