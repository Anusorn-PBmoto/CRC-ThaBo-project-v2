import React, { useState, useMemo } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  Pencil,
  Trash2,
  Package,
  Layers,
  ChevronRight,
  TrendingUp,
  X,
  Sparkles,
} from 'lucide-react';
import { ProductItem } from '../types';
import { resolveProductImage } from '../utils/productImages';

interface InventoryListTabProps {
  tires: ProductItem[];
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onEditTire: (product: ProductItem) => void;
  onDeleteTire: (product: ProductItem) => void;
  onJumpToAudit: (product: ProductItem) => void;
  onOpenPO: (product: ProductItem) => void;
  onOpenBatchPO: (selectedProducts: ProductItem[]) => void;
  onRestoreInitialData?: () => void;
}

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export const InventoryListTab: React.FC<InventoryListTabProps> = ({
  tires,
  onOpenAddModal,
  onOpenScanner,
  onEditTire,
  onDeleteTire,
  onJumpToAudit,
  onOpenPO,
  onOpenBatchPO,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // Filter products by search query, stock status, and category
  const filteredProducts = useMemo(() => {
    return tires.filter((p) => {
      // 1. Search text filter
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (p.name || p.size || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);

      // 2. Category filter
      const matchCategory =
        selectedCategory === 'ทั้งหมด' ||
        (p.category || '').toLowerCase() === selectedCategory.toLowerCase() ||
        (p.brand || '').toLowerCase() === selectedCategory.toLowerCase();

      // 3. Stock filter
      let matchStock = true;
      if (stockFilter === 'in_stock') {
        matchStock = p.actualQty > 0;
      } else if (stockFilter === 'low_stock') {
        matchStock = p.actualQty > 0 && p.actualQty <= (p.minStock || 2);
      } else if (stockFilter === 'out_of_stock') {
        matchStock = p.actualQty === 0;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [tires, searchQuery, selectedCategory, stockFilter]);

  // Overall catalog summary stats
  const totalItems = tires.length;
  const availablePieces = tires.reduce((acc, t) => acc + (t.actualQty || 0), 0);
  const lowStockItems = tires.filter(
    (t) => t.actualQty > 0 && t.actualQty <= (t.minStock || 2)
  ).length;
  const outOfStockItems = tires.filter((t) => t.actualQty === 0).length;
  const totalStockValue = tires.reduce(
    (acc, t) => acc + (t.actualQty || 0) * (t.sellingPrice || t.price || 0),
    0
  );

  // Toggle selection in multi-select mode
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBatchPOAction = () => {
    const selected = tires.filter((t) => selectedIds.has(t.id));
    if (selected.length > 0) {
      onOpenBatchPO(selected);
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  return (
    <div className="pb-32 pt-2 px-3 space-y-3 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Header Catalog Overview Card */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3.5 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#F6C90E]" />
              <span>แคตตาล็อกอะไหล่ (Inventory)</span>
            </h2>
            <span className="text-[11px] text-[#A0ABB5]">
              ทั้งหมด {totalItems} รายการ • รวม {availablePieces.toLocaleString()} ชิ้น
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                isMultiSelectMode
                  ? 'bg-[#F6C90E] text-[#252C33] border-[#F6C90E] font-bold'
                  : 'bg-[#252C33] text-[#EEEEEE] border-[#475662] hover:bg-[#43525D]'
              }`}
            >
              {isMultiSelectMode ? 'ยกเลิกเลือก' : 'เลือกสั่งซื้อ'}
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-[#252C33]" />
              <span>เพิ่มสินค้า</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#475662]/80 text-center">
          <div className="bg-[#252C33] rounded-xl p-2 border border-[#475662]/50">
            <span className="text-[10px] text-[#A0ABB5] block">คงเหลือรวม</span>
            <span className="text-sm font-extrabold text-[#EEEEEE] font-mono">
              {availablePieces.toLocaleString()}{' '}
              <span className="text-[10px] font-normal text-[#A0ABB5]">ชิ้น</span>
            </span>
          </div>

          <div className="bg-[#252C33] rounded-xl p-2 border border-[#475662]/50">
            <span className="text-[10px] text-[#A0ABB5] block">ใกล้หมด</span>
            <span className="text-sm font-extrabold text-[#F6C90E] font-mono">
              {lowStockItems}{' '}
              <span className="text-[10px] font-normal text-[#A0ABB5]">รายการ</span>
            </span>
          </div>

          <div className="bg-[#252C33] rounded-xl p-2 border border-[#475662]/50">
            <span className="text-[10px] text-[#A0ABB5] block">มูลค่าขายรวม</span>
            <span className="text-sm font-extrabold text-[#F6C90E] font-mono">
              ฿{totalStockValue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-select action banner */}
      {isMultiSelectMode && selectedIds.size > 0 && (
        <div className="bg-[#F6C90E]/15 border border-[#F6C90E]/50 rounded-xl p-2.5 flex items-center justify-between text-xs animate-in fade-in">
          <span className="text-[#F6C90E] font-medium">
            เลือกไว้ <strong>{selectedIds.size}</strong> รายการ
          </span>
          <button
            onClick={handleBatchPOAction}
            className="px-3 py-1 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-lg text-xs flex items-center gap-1 active:scale-95"
          >
            <span>สร้างใบสั่งซื้อ (PO)</span>
          </button>
        </div>
      )}

      {/* 2. Search & Scan bar */}
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
        <button
          onClick={onOpenScanner}
          title="สแกนบาร์โค้ด"
          className="p-2 rounded-xl bg-[#3A4750] border border-[#475662] text-[#F6C90E] hover:bg-[#43525D] transition-all active:scale-95"
        >
          <ScanBarcode className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Stock Status Filters */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#252C33] border border-[#475662] rounded-xl text-[11px] font-medium">
        <button
          onClick={() => setStockFilter('all')}
          className={`py-1.5 rounded-lg transition-all ${
            stockFilter === 'all'
              ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          ทั้งหมด ({totalItems})
        </button>
        <button
          onClick={() => setStockFilter('in_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'in_stock'
              ? 'bg-[#3A4750] text-[#EEEEEE] border border-[#475662] font-bold'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>มีสต็อก</span>
        </button>
        <button
          onClick={() => setStockFilter('low_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'low_stock'
              ? 'bg-[#3A4750] text-[#F6C90E] border border-[#F6C90E]/40 font-bold'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#F6C90E]" />
          <span>เหลือน้อย</span>
        </button>
        <button
          onClick={() => setStockFilter('out_of_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'out_of_stock'
              ? 'bg-[#3A4750] text-rose-300 border border-rose-500/40 font-bold'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>หมด</span>
        </button>
      </div>

      {/* 4. Category Filter Tags (if any exist) */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
          <span className="text-[#A0ABB5] font-medium pl-1 flex-shrink-0">หมวด:</span>
          {categories.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded-md font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                    : 'bg-[#3A4750] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* 5. Products List */}
      <div className="space-y-2.5">
        {totalItems === 0 ? (
          /* Empty Catalog State */
          <div className="bg-[#3A4750] border border-dashed border-[#475662] rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#252C33] border border-[#F6C90E]/30 text-[#F6C90E] flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[#EEEEEE] text-sm font-bold">ยังไม่มีข้อมูลสินค้าในคลัง</p>
              <p className="text-[#A0ABB5] text-xs mt-1 max-w-xs mx-auto">
                เริ่มต้นบันทึกอะไหล่มอเตอร์ไซค์ของคุณ สแกนบาร์โค้ด หรือพิมพ์รายละเอียดสินค้า
              </p>
            </div>
            <button
              onClick={onOpenAddModal}
              className="py-2.5 px-4 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-lg active:scale-95 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#252C33]" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-8 text-center space-y-2">
            <Package className="w-10 h-10 text-[#A0ABB5] mx-auto mb-1" />
            <p className="text-[#EEEEEE] text-sm font-medium">ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข</p>
            <p className="text-[#A0ABB5] text-xs">พบในระบบทั้งหมด {tires.length} รายการ แต่อาจถูกกรองออก</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ทั้งหมด');
                setStockFilter('all');
              }}
              className="mt-2 px-3 py-1.5 bg-[#252C33] hover:bg-[#2C353E] text-[#F6C90E] border border-[#475662] rounded-xl text-xs font-semibold inline-block"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isZero = product.actualQty === 0;
            const isLow = product.actualQty > 0 && product.actualQty <= (product.minStock || 2);
            const isSelected = selectedIds.has(product.id);
            const unitLabel = product.unit || 'ชิ้น';

            return (
              <div
                key={product.id}
                className={`bg-[#3A4750] hover:bg-[#43525D] border rounded-2xl p-3.5 shadow-sm transition-all relative ${
                  isSelected ? 'border-[#F6C90E] bg-[#43525D]' : 'border-[#475662]'
                }`}
              >
                {/* Top Row: Product Info & Actions */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {isMultiSelectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(product.id)}
                        className="w-4 h-4 rounded text-[#F6C90E] bg-[#252C33] border-[#475662] focus:ring-0 flex-shrink-0"
                      />
                    )}

                    {/* Product Photo Thumbnail (only if uploaded) */}
                    {product.imageUrl && product.imageUrl.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setPreviewProduct(product)}
                        className="w-12 h-12 rounded-xl overflow-hidden bg-[#252C33] border border-[#475662] flex-shrink-0 flex items-center justify-center shadow-md relative group hover:border-[#F6C90E] transition-all active:scale-95 cursor-zoom-in"
                        title="กดเพื่อดูรูปภาพขนาดใหญ่"
                      >
                        <img
                          src={product.imageUrl}
                          alt={product.name || 'สินค้า'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-[#EEEEEE]">
                          {product.name || product.size}
                        </h4>
                        {product.unit && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#252C33] text-[#EEEEEE] border border-[#475662]">
                            {product.unit}
                          </span>
                        )}
                        {product.barcode && (
                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40 flex items-center gap-1">
                            <ScanBarcode className="w-2.5 h-2.5" />
                            <span>{product.barcode}</span>
                          </span>
                        )}
                      </div>

                      {/* Subtitle / Prices */}
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {product.sellingPrice > 0 && (
                          <span className="text-[#F6C90E] font-bold font-mono">
                            ฿{product.sellingPrice.toLocaleString()}
                          </span>
                        )}
                        {product.costPrice > 0 && (
                          <span className="text-[#A0ABB5] text-[11px] font-mono">
                            (ทุน: ฿{product.costPrice.toLocaleString()})
                          </span>
                        )}
                        {product.description && (
                          <span className="text-[#A0ABB5] text-xs truncate max-w-[140px]">
                            • {product.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                    {/* Stock Quantity Badge */}
                    {isZero ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#252C33] border border-rose-500/50 text-rose-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>หมด</span>
                      </span>
                    ) : isLow ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#252C33] border border-[#F6C90E]/50 text-[#F6C90E] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F6C90E]" />
                        <span>{product.actualQty} {unitLabel}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#252C33] border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{product.actualQty} {unitLabel}</span>
                      </span>
                    )}

                    {/* Quick PO Button */}
                    <button
                      onClick={() => onOpenPO(product)}
                      title="สั่งซื้อเพิ่ม (PO)"
                      className="p-1 text-[#A0ABB5] hover:text-[#F6C90E] rounded-lg transition-colors"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => onEditTire(product)}
                      title="แก้ไขข้อมูล"
                      className="p-1 text-[#A0ABB5] hover:text-[#EEEEEE] rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => onDeleteTire(product)}
                      title="ลบรายการ"
                      className="p-1 text-[#A0ABB5] hover:text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Location & Action row */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#475662]/60 text-xs">
                  <div className="flex items-center gap-1 text-[#A0ABB5]">
                    <span>🗄</span>
                    <span className="text-[#EEEEEE] font-medium">
                      {product.location || 'RACK A-01'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onJumpToAudit(product)}
                      className="text-[#F6C90E] hover:text-[#E5B800] text-[11px] font-bold flex items-center gap-0.5"
                    >
                      <span>นับสต็อก</span>
                      <ChevronRight className="w-3 h-3 text-[#F6C90E]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Product Photo Full-Screen / Lightbox Preview Modal */}
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
