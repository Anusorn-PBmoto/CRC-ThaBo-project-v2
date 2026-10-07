import React, { useState, useMemo } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  CheckCircle2,
  Clock,
  MoreVertical,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  Trash2,
  Package,
  X,
  Maximize2,
} from 'lucide-react';
import { ProductItem, AuditSession } from '../types';
import { resolveProductImage } from '../utils/productImages';

interface QuickAuditTabProps {
  tires: ProductItem[];
  activeSession: AuditSession | null;
  onUpdateQty: (product: ProductItem, newQty: number) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onSaveAudit: () => void;
  onEditTire: (product: ProductItem) => void;
  onDeleteTire?: (product: ProductItem) => void;
  onRestoreInitialData?: () => void;
}

export const QuickAuditTab: React.FC<QuickAuditTabProps> = ({
  tires,
  activeSession,
  onUpdateQty,
  onOpenAddModal,
  onOpenScanner,
  onSaveAudit,
  onEditTire,
  onDeleteTire,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [activeMenuTireId, setActiveMenuTireId] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);

  // Available categories or brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.category) set.add(t.category);
      else if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return tires.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (p.name || p.size || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);

      const matchCategory =
        selectedCategory === 'ทั้งหมด' ||
        (p.category || '').toLowerCase() === selectedCategory.toLowerCase() ||
        (p.brand || '').toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [tires, searchQuery, selectedCategory]);

  // Progress stats
  const totalCount = tires.length;
  const checkedCount = tires.filter((t) => t.status === 'checked').length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const remainingPieces = tires.filter((t) => t.status !== 'checked').length;
  const exactMatchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const modifiedCount = tires.filter((t) => t.status === 'checked' || t.status === 'discrepancy').length;

  return (
    <div className="pb-32 pt-2 px-3 space-y-3 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Audit Progress & Search Header Card */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3.5 shadow-md">
        {/* Title & Progress Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F6C90E] animate-pulse shadow-sm shadow-[#F6C90E]/50" />
            <h2 className="text-sm font-bold tracking-wide text-[#EEEEEE]">
              นับสต็อกด่วน (Quick Audit)
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EEEEEE] bg-[#252C33] border border-[#475662] px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#F6C90E]" />
            <span>
              {checkedCount} / {totalCount} รายการ ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#252C33] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[#F6C90E] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Search input + Action buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด, ชั้นวาง..."
              className="w-full bg-[#252C33] border border-[#475662] rounded-xl pl-9 pr-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:outline-none focus:border-[#F6C90E] transition-colors"
            />
          </div>

          {/* Quick Scanner Action Button */}
          <button
            onClick={onOpenScanner}
            title="เปิดกล้องสแกนบาร์โค้ด"
            className="p-2 rounded-xl bg-[#252C33] border border-[#475662] text-[#F6C90E] hover:text-[#252C33] hover:bg-[#F6C90E] transition-all active:scale-95 shadow-sm"
          >
            <ScanBarcode className="w-4 h-4" />
          </button>

          {/* Add Product Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#252C33]" />
            <span>เพิ่มสินค้า</span>
          </button>
        </div>
      </div>

      {/* 2. Category Filters (if categories exist) */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-md shadow-[#F6C90E]/20'
                    : 'bg-[#3A4750] text-[#EEEEEE] hover:bg-[#43525D] border border-[#475662]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Zone Header Card */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F6C90E]" />
            <span className="text-xs font-semibold text-[#EEEEEE]">
              คลังอะไหล่มอเตอร์ไซค์ CRC ThaBo
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#252C33] text-[#F6C90E] border border-[#475662]">
              {activeSession?.code || 'AUD-STOCK'}
            </span>
          </div>
          <p className="text-[11px] text-[#A0ABB5] mt-1">
            ตรวจนับและเช็กสต็อกสินค้าทุกประเภท
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#A0ABB5] block">คงเหลือตรวจ</span>
          <span className="text-xl font-extrabold text-[#F6C90E] leading-none">
            {remainingPieces}{' '}
            <span className="text-xs font-normal text-[#EEEEEE]/80">รายการ</span>
          </span>
        </div>
      </div>

      {/* 4. Products Audit List */}
      <div className="space-y-2.5">
        {totalCount === 0 ? (
          /* Empty state when catalog is cleared */
          <div className="bg-[#3A4750] border border-dashed border-[#475662] rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#252C33] border border-[#F6C90E]/30 text-[#F6C90E] flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-[#EEEEEE] text-sm font-bold">ยังไม่มีสินค้าในระบบ</h3>
              <p className="text-[#A0ABB5] text-xs mt-1 max-w-xs mx-auto">
                พร้อมเริ่มต้นบันทึกสต็อกอะไหล่มอเตอร์ไซค์ของคุณ กดปุ่มด้านล่างเพื่อสแกนบาร์โค้ดและเริ่มเพิ่มสินค้า
              </p>
            </div>
            <button
              onClick={onOpenAddModal}
              className="py-2.5 px-5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-lg shadow-[#F6C90E]/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#252C33]" />
              <span>เพิ่มสินค้าชิ้นแรก</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-8 text-center">
            <Layers className="w-10 h-10 text-[#A0ABB5] mx-auto mb-2" />
            <p className="text-[#EEEEEE] text-sm font-medium">ไม่พบสินค้าที่ตรงกับการค้นหา</p>
            <p className="text-[#A0ABB5] text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดเพิ่มสินค้าใหม่</p>
            <button
              onClick={onOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6C90E] text-[#252C33] rounded-xl text-xs font-bold hover:bg-[#E5B800] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-[#252C33]" /> เพิ่มสินค้าใหม่
            </button>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isMatch = product.actualQty === product.systemQty;
            const diff = product.actualQty - product.systemQty;
            const isChecked = product.status === 'checked';
            const unitLabel = product.unit || 'ชิ้น';

            return (
              <div
                key={product.id}
                className="bg-[#3A4750] hover:bg-[#43525D] border border-[#475662] rounded-2xl p-3.5 shadow-sm transition-all relative overflow-hidden"
              >
                {/* Top Section: Left Photo (Red box in screenshot) + Right Info */}
                <div className="flex items-start gap-3">
                  {/* Left Side: Product Photo */}
                  {product.imageUrl && product.imageUrl.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setPreviewProduct(product)}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-[#252C33] border border-[#475662] flex-shrink-0 flex items-center justify-center shadow-md relative group hover:border-[#F6C90E] transition-all active:scale-95 cursor-zoom-in"
                      title="แตะเพื่อดูภาพขนาดใหญ่"
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.name || 'สินค้า'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-4 h-4 text-[#F6C90E]" />
                      </div>
                    </button>
                  )}

                  {/* Right Side: Product Details & Menu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-[#EEEEEE] tracking-wide">
                            {product.name || product.size}
                          </h3>
                          {product.unit && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#252C33] text-[#EEEEEE] border border-[#475662]">
                              {product.unit}
                            </span>
                          )}
                        </div>

                        {product.barcode && (
                          <div className="mt-1">
                            <span className="inline-flex text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40 items-center gap-1">
                              <ScanBarcode className="w-2.5 h-2.5" />
                              <span>{product.barcode}</span>
                            </span>
                          </div>
                        )}

                        {/* Subtitle: Prices & Location (ตัดการแสดงผลราคาต้นทุนออก) */}
                        <div className="text-xs text-[#A0ABB5] mt-1 flex items-center gap-2 flex-wrap">
                          {product.sellingPrice > 0 && (
                            <span className="text-[#F6C90E] font-bold font-mono">
                              ฿{product.sellingPrice.toLocaleString()}
                            </span>
                          )}
                          <span>•</span>
                          <span className="text-[#EEEEEE]">{product.location || 'RACK A-01'}</span>
                          {product.description && (
                            <>
                              <span>•</span>
                              <span className="text-[#A0ABB5] truncate max-w-[130px]">
                                {product.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status badge & Menu */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isChecked ? (
                          <span className="flex items-center gap-1 text-[11px] text-[#F6C90E] font-medium bg-[#252C33] px-2 py-0.5 rounded-full border border-[#475662]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#F6C90E]" />
                            <span>ตรวจแล้ว</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-[#A0ABB5]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>รอตรวจ</span>
                          </span>
                        )}

                        {/* Menu button */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuTireId(activeMenuTireId === product.id ? null : product.id)
                            }
                            className="p-1 text-[#A0ABB5] hover:text-[#EEEEEE] rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuTireId === product.id && (
                            <div className="absolute right-0 top-6 z-20 w-36 bg-[#252C33] border border-[#475662] rounded-xl shadow-xl py-1 text-xs text-[#EEEEEE]">
                              <button
                                onClick={() => {
                                  onEditTire(product);
                                  setActiveMenuTireId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-[#3A4750] flex items-center justify-between"
                              >
                                <span>แก้ไขข้อมูล</span>
                                <ChevronRight className="w-3 h-3 text-[#A0ABB5]" />
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateQty(product, product.systemQty);
                                  setActiveMenuTireId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-[#3A4750] flex items-center justify-between text-[#F6C90E]"
                              >
                                <span>รีเซ็ตตามระบบ</span>
                                <RotateCcw className="w-3 h-3" />
                              </button>
                              {onDeleteTire && (
                                <button
                                  onClick={() => {
                                    onDeleteTire(product);
                                    setActiveMenuTireId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-rose-950/40 flex items-center justify-between text-rose-400 border-t border-[#475662]"
                                >
                                  <span>ลบรายการสินค้า</span>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Count and Stepper */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#475662]/60">
                  {/* Left: Actual Count Status badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#A0ABB5] font-medium">นับจริง:</span>
                    {isMatch ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#252C33] border border-emerald-500/40 text-emerald-400">
                        <span>✓ ตรงระบบ</span>
                      </span>
                    ) : diff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#252C33] border border-[#F6C90E]/50 text-[#F6C90E]">
                        <span>⚠ เกินระบบ +{diff}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#252C33] border border-rose-500/50 text-rose-400">
                        <span>⚠ คลาดเคลื่อน {diff}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Stepper [-] [Number] [+] (พิมพ์กรอกตัวเลขได้) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateQty(product, Math.max(0, product.actualQty - 1))}
                      className="w-8 h-8 rounded-xl bg-[#252C33] hover:bg-[#2C353E] active:scale-95 text-[#EEEEEE] font-bold flex items-center justify-center border border-[#475662] transition-all text-base"
                      title="ลดจำนวน"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={product.actualQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = parseInt(val, 10);
                        onUpdateQty(product, isNaN(parsed) || parsed < 0 ? 0 : parsed);
                      }}
                      className="w-12 h-8 text-center font-mono text-base font-extrabold text-[#F6C90E] bg-[#252C33] border border-[#475662] rounded-xl focus:border-[#F6C90E] focus:outline-none px-1"
                      title="พิมพ์กรอกจำนวนนับได้"
                    />

                    <button
                      onClick={() => onUpdateQty(product, product.actualQty + 1)}
                      className="w-8 h-8 rounded-xl bg-[#252C33] hover:bg-[#2C353E] active:scale-95 text-[#EEEEEE] font-bold flex items-center justify-center border border-[#475662] transition-all text-base"
                      title="เพิ่มจำนวน"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Floating Bottom Save Bar */}
      {totalCount > 0 && modifiedCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 p-3 z-20 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="bg-[#20262D]/95 backdrop-blur-md border border-[#F6C90E]/50 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#EEEEEE] block">
                  ปรับปรุงแล้ว: {modifiedCount} รายการ
                </span>
                <span className="text-[11px] text-[#A0ABB5]">
                  สต็อกตรง {exactMatchedCount} รายการ • คลาดเคลื่อน {discrepancyCount}
                </span>
              </div>

              <button
                onClick={onSaveAudit}
                className="py-2.5 px-4 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-[#F6C90E]/25 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4 text-[#252C33]" />
                <span>บันทึกผลการนับ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Product Photo Full-Screen / Lightbox Preview Modal */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-[#3A4750] border border-[#F6C90E]/40 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] font-bold text-[#F6C90E] block">
                  {previewProduct.brand || 'อะไหล่มอเตอร์ไซค์'}
                </span>
                <h4 className="text-sm font-bold text-[#EEEEEE] truncate">
                  {previewProduct.name || previewProduct.size}
                </h4>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-full bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] flex items-center justify-center active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#252C33] border border-[#475662] flex items-center justify-center relative shadow-inner">
              <img
                src={previewProduct.imageUrl}
                alt={previewProduct.name || 'สินค้า'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#475662]">
              <div className="space-y-0.5">
                <span className="text-[#A0ABB5] block text-[11px]">รหัสบาร์โค้ด:</span>
                <span className="font-mono text-[#F6C90E] font-semibold">{previewProduct.barcode || '-'}</span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[#A0ABB5] block text-[11px]">ราคาขาย:</span>
                <span className="font-mono text-[#F6C90E] font-bold text-sm">
                  ฿{(previewProduct.sellingPrice || previewProduct.price || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
