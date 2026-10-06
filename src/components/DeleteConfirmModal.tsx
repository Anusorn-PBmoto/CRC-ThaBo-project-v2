import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ProductItem } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  product: ProductItem | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
}) => {
  if (!isOpen || !product) return null;

  const productName = product.name || product.size || 'สินค้านี้';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#111c2e] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#181119] border-b border-rose-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-rose-200">
              ยืนยันการลบรายการสินค้า
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          <div className="p-3 bg-[#191524] border border-rose-500/20 rounded-xl space-y-2">
            <div className="flex items-start gap-2.5">
              {product.imageUrl ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={productName}
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-950/50 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block">รายการที่จะลบ:</span>
                <p className="text-sm font-bold text-slate-100 truncate mt-0.5">
                  {productName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  {product.barcode && <span>รหัส: {product.barcode}</span>}
                  {product.location && <span>• ช่อง: {product.location}</span>}
                </div>
              </div>
            </div>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed text-center">
            คุณแน่ใจหรือไม่ว่าต้องการลบรายการสินค้านี้ออกจากคลัง? <br />
            <span className="text-rose-400 text-[11px] font-medium">
              (ข้อมูลจะถูกลบออกจากทั้งบน Cloud และในเครื่องทันที)
            </span>
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-[#17253d] hover:bg-[#203252] active:scale-95 text-slate-300 hover:text-white font-medium text-xs transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ยืนยันการลบ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
