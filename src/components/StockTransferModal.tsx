import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  ArrowRight,
  Store,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Minus,
} from 'lucide-react';
import { ProductItem, StockTransfer } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown, computeTransferredProduct } from '../utils/stockUtils';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  onConfirmTransfer: (transfer: StockTransfer, updatedProduct: ProductItem) => Promise<void>;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirmTransfer,
}) => {
  const [direction, setDirection] = useState<'to_front' | 'to_warehouse'>('to_front');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      const breakdown = getProductStockBreakdown(product);
      // Auto pick smartest default direction
      if (breakdown.warehouseQty > 0) {
        setDirection('to_front');
        setTransferQty(Math.min(breakdown.warehouseQty, 2));
      } else if (breakdown.frontQty > 0) {
        setDirection('to_warehouse');
        setTransferQty(1);
      } else {
        setDirection('to_front');
        setTransferQty(1);
      }
      setNote('');
      setSuccessNotice(null);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const breakdown = getProductStockBreakdown(product);
  const maxAvailable =
    direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;

  const handleQtyChange = (val: number) => {
    const clamped = Math.max(1, Math.min(val, maxAvailable > 0 ? maxAvailable : 1));
    setTransferQty(clamped);
  };

  const handleQuickAdd = (delta: number) => {
    handleQtyChange(transferQty + delta);
  };

  const handleMax = () => {
    if (maxAvailable > 0) setTransferQty(maxAvailable);
  };

  // Preview calculations
  const nextWarehouseQty =
    direction === 'to_front'
      ? Math.max(0, breakdown.warehouseQty - transferQty)
      : breakdown.warehouseQty + transferQty;

  const nextFrontQty =
    direction === 'to_front'
      ? breakdown.frontQty + transferQty
      : Math.max(0, breakdown.frontQty - transferQty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (maxAvailable <= 0) return;

    setIsSubmitting(true);
    try {
      const { updatedProduct, transferLog } = computeTransferredProduct(
        product,
        transferQty,
        direction
      );

      const completeTransfer: StockTransfer = {
        ...transferLog,
        id: `txf_${Date.now()}`,
        note: note.trim() || undefined,
      };

      await onConfirmTransfer(completeTransfer, updatedProduct);
      setSuccessNotice(
        direction === 'to_front'
          ? `เติมหน้าร้าน +${transferQty} ${product.unit || 'ชิ้น'} สำเร็จ!`
          : `ส่งคืนคลัง +${transferQty} ${product.unit || 'ชิ้น'} สำเร็จ!`
      );

      setTimeout(() => {
        setSuccessNotice(null);
        onClose();
      }, 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  const img = product.imageUrl || resolveProductImage(product);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-md bg-[#252C33] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A4750] bg-[#20262D]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center border border-[#F6C90E]/40">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#EEEEEE]">โอนย้ายสต็อก / เบิกเติมสินค้า</h2>
              <p className="text-[10px] text-[#A0ABB5]">
                ย้ายระหว่างคลังหลังร้านและหน้าร้าน (ยอดรวมคงที่)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Brief */}
        <div className="p-3.5 bg-[#2C353D] border-b border-[#3A4750] flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#20262D] border border-[#475662] overflow-hidden flex-shrink-0 flex items-center justify-center">
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-[#A0ABB5]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {product.brand && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3A4750] text-[#F6C90E] font-medium">
                  {product.brand}
                </span>
              )}
              {product.barcode && (
                <span className="text-[10px] text-[#A0ABB5] font-mono">
                  {product.barcode}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-[#EEEEEE] truncate mt-0.5">
              {product.name || product.size}
            </h3>
            <p className="text-[11px] text-[#A0ABB5] mt-0.5">
              ยอดรวมทั้งหมด:{' '}
              <strong className="text-[#EEEEEE]">
                {breakdown.totalQty} {product.unit || 'ชิ้น'}
              </strong>
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Transfer Direction Switcher */}
          <div>
            <label className="text-[11px] font-semibold text-[#A0ABB5] block mb-1.5">
              ทิศทางการโอนย้าย
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirection('to_front');
                  if (breakdown.warehouseQty > 0) {
                    setTransferQty(Math.min(breakdown.warehouseQty, 2));
                  }
                }}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  direction === 'to_front'
                    ? 'bg-[#F6C90E]/15 border-[#F6C90E] text-[#EEEEEE]'
                    : 'bg-[#20262D] border-[#3A4750] text-[#A0ABB5] hover:border-[#475662]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F6C90E]">
                  <Store className="w-3.5 h-3.5" />
                  <span>เติมหน้าร้าน</span>
                </div>
                <div className="text-[10px] text-[#A0ABB5] flex items-center gap-1">
                  <span>คลังหลังร้าน</span>
                  <ArrowRight className="w-3 h-3 text-[#F6C90E]" />
                  <span className="text-[#EEEEEE] font-medium">หน้าร้าน</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirection('to_warehouse');
                  if (breakdown.frontQty > 0) {
                    setTransferQty(1);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  direction === 'to_warehouse'
                    ? 'bg-[#F6C90E]/15 border-[#F6C90E] text-[#EEEEEE]'
                    : 'bg-[#20262D] border-[#3A4750] text-[#A0ABB5] hover:border-[#475662]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>ส่งคืนคลัง</span>
                </div>
                <div className="text-[10px] text-[#A0ABB5] flex items-center gap-1">
                  <span>หน้าร้าน</span>
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  <span className="text-[#EEEEEE] font-medium">คลังหลังร้าน</span>
                </div>
              </button>
            </div>
          </div>

          {/* Current & Source Stock Warning */}
          {maxAvailable <= 0 ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>
                {direction === 'to_front'
                  ? 'ไม่มีสินค้าในคลังหลังร้านสำหรับเติมหน้าร้าน'
                  : 'ไม่มีสินค้าหน้าร้านสำหรับส่งคืนคลัง'}
              </span>
            </div>
          ) : null}

          {/* Quantity Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#A0ABB5]">
                จำนวนที่ต้องการย้าย ({product.unit || 'ชิ้น'})
              </label>
              <span className="text-[10px] text-[#A0ABB5]">
                ย้ายได้สูงสุด:{' '}
                <strong className="text-[#F6C90E] font-mono">{maxAvailable}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={transferQty <= 1 || maxAvailable <= 0}
                onClick={() => handleQtyChange(transferQty - 1)}
                className="w-11 h-11 rounded-xl bg-[#3A4750] hover:bg-[#475662] disabled:opacity-40 text-[#EEEEEE] flex items-center justify-center transition-all active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                min="1"
                max={maxAvailable}
                value={transferQty}
                onChange={(e) => handleQtyChange(Number(e.target.value) || 1)}
                disabled={maxAvailable <= 0}
                className="flex-1 h-11 bg-[#20262D] border border-[#3A4750] rounded-xl text-center text-lg font-bold text-[#F6C90E] font-mono focus:outline-none focus:border-[#F6C90E]"
              />

              <button
                type="button"
                disabled={transferQty >= maxAvailable || maxAvailable <= 0}
                onClick={() => handleQtyChange(transferQty + 1)}
                className="w-11 h-11 rounded-xl bg-[#3A4750] hover:bg-[#475662] disabled:opacity-40 text-[#EEEEEE] flex items-center justify-center transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[1, 2, 5, 10].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  disabled={maxAvailable < pill}
                  onClick={() => handleQtyChange(pill)}
                  className="px-2.5 py-1 rounded-lg bg-[#3A4750] hover:bg-[#475662] disabled:opacity-30 text-[11px] font-semibold text-[#EEEEEE] transition-all"
                >
                  +{pill}
                </button>
              ))}
              <button
                type="button"
                disabled={maxAvailable <= 0}
                onClick={handleMax}
                className="px-2.5 py-1 rounded-lg bg-[#F6C90E]/20 text-[#F6C90E] hover:bg-[#F6C90E]/30 disabled:opacity-30 text-[11px] font-bold transition-all ml-auto"
              >
                ย้ายทั้งหมด ({maxAvailable})
              </button>
            </div>
          </div>

          {/* Real-time Before / After Preview Card */}
          <div className="p-3 bg-[#20262D] rounded-xl border border-[#3A4750] space-y-2">
            <span className="text-[10px] font-bold text-[#A0ABB5] uppercase tracking-wider block">
              สรุปยอดสต็อกก่อนและหลังการย้าย
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Storefront */}
              <div className="p-2 rounded-lg bg-[#252C33] border border-[#3A4750]">
                <div className="flex items-center gap-1 text-[#F6C90E] text-[11px] font-semibold mb-1">
                  <Store className="w-3 h-3" />
                  <span>หน้าร้าน</span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-[#A0ABB5] line-through text-[11px]">
                    {breakdown.frontQty}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#A0ABB5]" />
                  <span className="text-base font-black text-[#EEEEEE]">
                    {nextFrontQty}
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] font-sans">
                    {product.unit || 'ชิ้น'}
                  </span>
                </div>
              </div>

              {/* Warehouse */}
              <div className="p-2 rounded-lg bg-[#252C33] border border-[#3A4750]">
                <div className="flex items-center gap-1 text-sky-400 text-[11px] font-semibold mb-1">
                  <Warehouse className="w-3 h-3" />
                  <span>คลังหลังร้าน</span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-[#A0ABB5] line-through text-[11px]">
                    {breakdown.warehouseQty}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#A0ABB5]" />
                  <span className="text-base font-black text-[#EEEEEE]">
                    {nextWarehouseQty}
                  </span>
                  <span className="text-[10px] text-[#A0ABB5] font-sans">
                    {product.unit || 'ชิ้น'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-[11px] font-medium text-[#A0ABB5] block mb-1">
              หมายเหตุ / เหตุผลการโอนย้าย (ไม่บังคับ)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น เติมชั้นโชว์หน้าร้าน, ลูกค้าจอง, เบิกเปลี่ยนสินค้า"
              className="w-full bg-[#20262D] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#788896] focus:outline-none focus:border-[#F6C90E]"
            />
          </div>

          {/* Success notice */}
          {successNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#3A4750] hover:bg-[#475662] text-xs font-semibold text-[#EEEEEE] transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxAvailable <= 0}
              className="flex-[2] py-2.5 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] disabled:opacity-40 text-[#252C33] text-xs font-black shadow-md shadow-[#F6C90E]/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#252C33]" />
                  <span>ยืนยันการโอนย้ายสต็อก</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
