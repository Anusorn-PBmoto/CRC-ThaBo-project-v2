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
  Trash2,
  Boxes,
  Zap,
} from 'lucide-react';
import { ProductItem, StockTransfer } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown, computeTransferredProduct } from '../utils/stockUtils';

interface BatchStockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ProductItem[];
  onConfirmBatchTransfer: (
    transfers: { transfer: StockTransfer; updatedProduct: ProductItem }[]
  ) => Promise<void>;
}

export const BatchStockTransferModal: React.FC<BatchStockTransferModalProps> = ({
  isOpen,
  onClose,
  items,
  onConfirmBatchTransfer,
}) => {
  const [direction, setDirection] = useState<'to_front' | 'to_warehouse'>('to_front');
  const [quantities, setQuantities] = useState<{ [id: string]: number }>({});
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [activeItems, setActiveItems] = useState<ProductItem[]>(items);

  // Sync active items when opened or items prop changes
  useEffect(() => {
    setActiveItems(items);
  }, [items, isOpen]);

  // Initialize/recalculate quantities whenever activeItems or direction changes
  useEffect(() => {
    const nextQtys: { [id: string]: number } = {};
    activeItems.forEach((product) => {
      const breakdown = getProductStockBreakdown(product);
      const maxAvailable =
        direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;

      if (maxAvailable <= 0) {
        nextQtys[product.id] = 0;
      } else {
        if (direction === 'to_front') {
          // Default: suggest smart amount (fill up to minStock, or at least 1-2 pieces)
          const needed = Math.max(1, (product.minStock || 2) - breakdown.frontQty);
          nextQtys[product.id] = Math.min(maxAvailable, Math.max(1, needed));
        } else {
          nextQtys[product.id] = Math.min(maxAvailable, 1);
        }
      }
    });
    setQuantities(nextQtys);
    setSuccessCount(null);
  }, [activeItems, direction, isOpen]);

  if (!isOpen || activeItems.length === 0) return null;

  const handleQtyChange = (id: string, val: number, maxAvailable: number) => {
    const clamped = Math.max(0, Math.min(val, maxAvailable));
    setQuantities((prev) => ({
      ...prev,
      [id]: clamped,
    }));
  };

  const handleRemoveItem = (id: string) => {
    setActiveItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick batch adjustment actions
  const handleSetAllMax = () => {
    const nextQtys: { [id: string]: number } = {};
    activeItems.forEach((product) => {
      const breakdown = getProductStockBreakdown(product);
      const max = direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;
      nextQtys[product.id] = max;
    });
    setQuantities(nextQtys);
  };

  const handleSetAllOne = () => {
    const nextQtys: { [id: string]: number } = {};
    activeItems.forEach((product) => {
      const breakdown = getProductStockBreakdown(product);
      const max = direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;
      nextQtys[product.id] = max > 0 ? 1 : 0;
    });
    setQuantities(nextQtys);
  };

  const handleSetFillMin = () => {
    const nextQtys: { [id: string]: number } = {};
    activeItems.forEach((product) => {
      const breakdown = getProductStockBreakdown(product);
      const max = direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;
      if (direction === 'to_front') {
        const needed = Math.max(1, (product.minStock || 2) - breakdown.frontQty);
        nextQtys[product.id] = Math.min(max, Math.max(1, needed));
      } else {
        nextQtys[product.id] = max > 0 ? 1 : 0;
      }
    });
    setQuantities(nextQtys);
  };

  // Compute total statistics
  const validTransfersList = activeItems
    .map((product) => {
      const qty = quantities[product.id] || 0;
      const breakdown = getProductStockBreakdown(product);
      const maxAvailable =
        direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;
      const actualQty = Math.min(qty, maxAvailable);
      return { product, qty: actualQty, maxAvailable };
    })
    .filter((item) => item.qty > 0);

  const totalTransferPieces = validTransfersList.reduce((acc, curr) => acc + curr.qty, 0);
  const totalTransferItems = validTransfersList.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validTransfersList.length === 0) return;

    setIsSubmitting(true);
    try {
      const batchPayload = validTransfersList.map(({ product, qty }) => {
        const { updatedProduct, transferLog } = computeTransferredProduct(
          product,
          qty,
          direction
        );

        const completeTransfer: StockTransfer = {
          ...transferLog,
          id: `txf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          note: note.trim()
            ? `${note.trim()} [ย้ายรวม ${validTransfersList.length} รายการ]`
            : undefined,
        };

        return { transfer: completeTransfer, updatedProduct };
      });

      await onConfirmBatchTransfer(batchPayload);
      setSuccessCount(validTransfersList.length);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Batch stock transfer failed:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#2C353E] border border-[#475662] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-['Prompt',sans-serif]">
        {/* Header */}
        <div className="p-4 bg-[#20262D] border-b border-[#3A4750] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F6C90E] to-amber-600 flex items-center justify-center text-[#252C33] shadow-md shadow-[#F6C90E]/20">
              <ArrowRightLeft className="w-5 h-5 text-[#252C33] stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#EEEEEE] flex items-center gap-2">
                <span>โอนย้ายสต็อกหลายรายการ</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F6C90E]/20 text-[#F6C90E] text-[11px] font-black border border-[#F6C90E]/30">
                  {activeItems.length} รายการ
                </span>
              </h2>
              <p className="text-xs text-[#A0ABB5]">
                ย้ายตำแหน่งระหว่างคลังสินค้า ⇄ หน้าร้านพร้อมกัน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Splash */}
        {successCount !== null ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#EEEEEE]">
                โอนย้ายสต็อกสำเร็จ!
              </h3>
              <p className="text-xs text-[#A0ABB5] mt-1">
                ย้าย {successCount} รายการ รวม {totalTransferPieces} ชิ้น เข้าสู่ระบบเรียบร้อย
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
              {/* Direction Selector */}
              <div>
                <label className="text-xs font-bold text-[#A0ABB5] mb-1.5 block">
                  ทิศทางการโอนย้าย (Direction)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('to_front')}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      direction === 'to_front'
                        ? 'bg-gradient-to-br from-[#F6C90E]/15 to-amber-500/10 border-[#F6C90E] shadow-md shadow-[#F6C90E]/10'
                        : 'bg-[#252C33] border-[#475662] hover:bg-[#20262D] opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Warehouse className="w-3.5 h-3.5" />
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#F6C90E]" />
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-[#F6C90E] flex items-center justify-center">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xs font-black text-[#EEEEEE]">
                      คลัง ➡️ หน้าร้าน
                    </div>
                    <div className="text-[10px] text-[#A0ABB5]">
                      (เบิกเติมสต็อกสำหรับขาย)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirection('to_warehouse')}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      direction === 'to_warehouse'
                        ? 'bg-gradient-to-br from-[#F6C90E]/15 to-amber-500/10 border-[#F6C90E] shadow-md shadow-[#F6C90E]/10'
                        : 'bg-[#252C33] border-[#475662] hover:bg-[#20262D] opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-[#F6C90E] flex items-center justify-center">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Warehouse className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xs font-black text-[#EEEEEE]">
                      หน้าร้าน ➡️ คลัง
                    </div>
                    <div className="text-[10px] text-[#A0ABB5]">
                      (เก็บส่งคืนคลังหลังร้าน)
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Batch Adjust Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-[#A0ABB5] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span>ทางลัดปรับยอด:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSetAllMax}
                    className="px-2 py-1 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[10px] font-bold text-[#F6C90E] border border-[#475662] transition-all"
                  >
                    สูงสุดทั้งหมด (Max)
                  </button>
                  <button
                    type="button"
                    onClick={handleSetFillMin}
                    className="px-2 py-1 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[10px] font-bold text-[#EEEEEE] border border-[#475662] transition-all"
                  >
                    เติมเต็มจุดปลอดภัย
                  </button>
                  <button
                    type="button"
                    onClick={handleSetAllOne}
                    className="px-2 py-1 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[10px] font-bold text-[#A0ABB5] border border-[#475662] transition-all"
                  >
                    1 ชิ้น
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {activeItems.map((product) => {
                  const breakdown = getProductStockBreakdown(product);
                  const maxAvailable =
                    direction === 'to_front' ? breakdown.warehouseQty : breakdown.frontQty;
                  const currentQty = quantities[product.id] || 0;
                  const hasStock = maxAvailable > 0;

                  // Preview values
                  const nextWarehouse =
                    direction === 'to_front'
                      ? Math.max(0, breakdown.warehouseQty - currentQty)
                      : breakdown.warehouseQty + currentQty;
                  const nextFront =
                    direction === 'to_front'
                      ? breakdown.frontQty + currentQty
                      : Math.max(0, breakdown.frontQty - currentQty);

                  return (
                    <div
                      key={product.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        !hasStock
                          ? 'bg-[#20262D]/60 border-red-500/30 opacity-75'
                          : currentQty > 0
                          ? 'bg-[#252C33] border-[#F6C90E]/40 shadow-sm'
                          : 'bg-[#252C33] border-[#475662]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Product Image & Details */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <img
                            src={resolveProductImage(product)}
                            alt={product.name || 'product'}
                            className="w-10 h-10 rounded-xl object-cover bg-[#20262D] border border-[#475662] flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-[#EEEEEE] truncate">
                              {product.name || product.size}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A0ABB5] mt-0.5">
                              {product.brand && (
                                <span className="text-[#F6C90E] font-medium">
                                  {product.brand}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                มีให้โอน:{' '}
                                <strong
                                  className={
                                    hasStock ? 'text-emerald-400' : 'text-rose-400'
                                  }
                                >
                                  {maxAvailable}
                                </strong>{' '}
                                {product.unit || 'ชิ้น'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(product.id)}
                          title="ลบออกจากรายการโอนย้ายนี้"
                          className="p-1.5 text-[#A0ABB5] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Stock Quantity Stepper & Preview */}
                      <div className="mt-2.5 pt-2 border-t border-[#3A4750] flex items-center justify-between gap-2">
                        {/* Live Stock Comparison */}
                        <div className="text-[10px] text-[#A0ABB5] flex items-center gap-1.5">
                          <span className="flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-sky-400" />
                            <span>
                              {breakdown.warehouseQty} ➔{' '}
                              <strong className="text-[#EEEEEE]">{nextWarehouse}</strong>
                            </span>
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <Store className="w-3 h-3 text-[#F6C90E]" />
                            <span>
                              {breakdown.frontQty} ➔{' '}
                              <strong className="text-[#EEEEEE]">{nextFront}</strong>
                            </span>
                          </span>
                        </div>

                        {/* Controls */}
                        {hasStock ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(product.id, currentQty - 1, maxAvailable)
                              }
                              disabled={currentQty <= 0}
                              className="w-7 h-7 rounded-lg bg-[#3A4750] hover:bg-[#43525D] disabled:opacity-30 disabled:pointer-events-none text-[#EEEEEE] flex items-center justify-center transition-all"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={maxAvailable}
                              value={currentQty}
                              onChange={(e) =>
                                handleQtyChange(
                                  product.id,
                                  parseInt(e.target.value) || 0,
                                  maxAvailable
                                )
                              }
                              className="w-12 h-7 bg-[#20262D] border border-[#475662] focus:border-[#F6C90E] rounded-lg text-center text-xs font-bold text-[#EEEEEE] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(product.id, currentQty + 1, maxAvailable)
                              }
                              disabled={currentQty >= maxAvailable}
                              className="w-7 h-7 rounded-lg bg-[#3A4750] hover:bg-[#43525D] disabled:opacity-30 disabled:pointer-events-none text-[#EEEEEE] flex items-center justify-center transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(product.id, maxAvailable, maxAvailable)
                              }
                              className="px-1.5 h-7 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[10px] font-bold text-[#F6C90E] border border-[#475662]"
                            >
                              Max
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>สต็อกต้นทางหมด</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note input */}
              <div className="pt-1">
                <label className="text-xs font-bold text-[#A0ABB5] mb-1 block">
                  หมายเหตุการโอนย้าย (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น เติมสต็อกรอบเช้า, จัดระเบียบชั้นวาง..."
                  className="w-full bg-[#20262D] border border-[#475662] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:outline-none focus:border-[#F6C90E]"
                />
              </div>
            </div>

            {/* Footer Summary & Submit */}
            <div className="p-4 bg-[#20262D] border-t border-[#3A4750] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="text-[#A0ABB5] flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[#F6C90E]" />
                  <span>สรุปยอดที่เลือกโอนย้าย:</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#F6C90E]">
                    {totalTransferItems} รายการ
                  </span>
                  <span className="text-xs text-[#EEEEEE] ml-1.5">
                    (รวม <strong>{totalTransferPieces}</strong> ชิ้น)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-1/3 py-2.5 rounded-xl bg-[#3A4750] hover:bg-[#43525D] text-xs font-bold text-[#EEEEEE] transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={totalTransferPieces === 0 || isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-[#F6C90E] to-amber-500 hover:from-[#E5B800] hover:to-amber-600 disabled:opacity-40 disabled:pointer-events-none text-[#252C33] text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#F6C90E]/20 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin text-[#252C33]" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4 text-[#252C33] stroke-[2.5]" />
                      <span>ยืนยันโอนย้าย ({totalTransferPieces} ชิ้น)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
