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
} from 'lucide-react';
import { ProductItem } from '../types';

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

  // Available categories or brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.category) set.add(t.category);
      else if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  // Statistics
  const totalItems = tires.length;
  const availablePieces = tires.reduce((acc, t) => acc + (t.actualQty > 0 ? t.actualQty : 0), 0);
  const lowStockItems = tires.filter((t) => t.actualQty <= (t.minStock || 2)).length;
  const totalStockValue = tires.reduce(
    (acc, t) => acc + (t.actualQty > 0 ? t.actualQty * (t.sellingPrice || 0) : 0),
    0
  );

  // Filtered products
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

      let matchStock = true;
      if (stockFilter === 'in_stock') {
        matchStock = (p.actualQty || 0) > 2;
      } else if (stockFilter === 'low_stock') {
        matchStock = (p.actualQty || 0) >= 1 && (p.actualQty || 0) <= 2;
      } else if (stockFilter === 'out_of_stock') {
        matchStock = (p.actualQty || 0) === 0;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [tires, searchQuery, selectedCategory, stockFilter]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBatchPOAction = () => {
    const items = tires.filter((t) => selectedIds.has(t.id));
    if (items.length > 0) {
      onOpenBatchPO(items);
    }
  };

  return (
    <div className="pb-28 pt-2 px-3 space-y-3.5 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Header Overview Card */}
      <div className="bg-[#121c2e] border border-slate-800/90 rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>รายการสินค้า & อะไหล่</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {totalItems} รายการ
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              คลังสินค้าอะไหล่มอเตอร์ไซค์ CRC ThaBo
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedIds(new Set());
              }}
              className={`p-2 rounded-xl text-xs font-medium border transition-all ${
                isMultiSelectMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-[#18263d] text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="เลือกหลายรายการ"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้า</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
          <div className="bg-[#162338] rounded-xl p-2">
            <span className="text-[10px] text-slate-400 block">คงเหลือรวม</span>
            <span className="text-sm font-extrabold text-slate-100 font-mono">
              {availablePieces.toLocaleString()}{' '}
              <span className="text-[10px] font-normal text-slate-400">ชิ้น</span>
            </span>
          </div>

          <div className="bg-[#162338] rounded-xl p-2">
            <span className="text-[10px] text-slate-400 block">ใกล้หมด</span>
            <span className="text-sm font-extrabold text-amber-400 font-mono">
              {lowStockItems}{' '}
              <span className="text-[10px] font-normal text-slate-400">รายการ</span>
            </span>
          </div>

          <div className="bg-[#162338] rounded-xl p-2">
            <span className="text-[10px] text-slate-400 block">มูลค่าขายรวม</span>
            <span className="text-sm font-extrabold text-emerald-400 font-mono">
              ฿{totalStockValue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-select action banner */}
      {isMultiSelectMode && selectedIds.size > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between text-xs animate-in fade-in">
          <span className="text-amber-300 font-medium">
            เลือกไว้ <strong>{selectedIds.size}</strong> รายการ
          </span>
          <button
            onClick={handleBatchPOAction}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 active:scale-95"
          >
            <span>สร้างใบสั่งซื้อ (PO)</span>
          </button>
        </div>
      )}

      {/* 2. Search & Scan bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด, ชั้นวาง..."
            className="w-full bg-[#18263d] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
        <button
          onClick={onOpenScanner}
          title="สแกนบาร์โค้ด"
          className="p-2 rounded-xl bg-[#1c2d47] border border-slate-700 text-cyan-300 hover:text-white transition-all active:scale-95"
        >
          <ScanBarcode className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Stock Status Filters */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#10192a] border border-slate-800 rounded-xl text-[11px] font-medium">
        <button
          onClick={() => setStockFilter('all')}
          className={`py-1.5 rounded-lg transition-all ${
            stockFilter === 'all'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ทั้งหมด ({totalItems})
        </button>
        <button
          onClick={() => setStockFilter('in_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'in_stock'
              ? 'bg-[#1b2f48] text-emerald-300 border border-emerald-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>มีสต็อก</span>
        </button>
        <button
          onClick={() => setStockFilter('low_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'low_stock'
              ? 'bg-[#2b271a] text-amber-300 border border-amber-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>เหลือน้อย</span>
        </button>
        <button
          onClick={() => setStockFilter('out_of_stock')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            stockFilter === 'out_of_stock'
              ? 'bg-[#2e1920] text-rose-300 border border-rose-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>หมด</span>
        </button>
      </div>

      {/* 4. Category Filter Tags (if any exist) */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
          <span className="text-slate-400 font-medium pl-1 flex-shrink-0">หมวด:</span>
          {categories.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded-md font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#1e3a5f] text-cyan-300 border border-cyan-500/50 font-semibold'
                    : 'bg-[#121c2d] text-slate-400 hover:text-slate-200 border border-slate-800/80'
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
          <div className="bg-[#121c2e] border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <p className="text-slate-200 text-sm font-bold">ยังไม่มีข้อมูลสินค้าในคลัง</p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                เริ่มต้นบันทึกอะไหล่มอเตอร์ไซค์ของคุณ สแกนบาร์โค้ด หรือพิมพ์รายละเอียดสินค้า
              </p>
            </div>
            <button
              onClick={onOpenAddModal}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg active:scale-95 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-600 mx-auto mb-1" />
            <p className="text-slate-300 text-sm font-medium">ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข</p>
            <p className="text-slate-500 text-xs">พบในระบบทั้งหมด {tires.length} รายการ แต่อาจถูกกรองออก</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ทั้งหมด');
                setStockFilter('all');
              }}
              className="mt-2 px-3 py-1.5 bg-[#1b2b44] hover:bg-[#24395b] text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold inline-block"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isZero = product.actualQty === 0;
            const isLow = product.actualQty > 0 && product.actualQty <= 2;
            const isSelected = selectedIds.has(product.id);
            const unitLabel = product.unit || 'ชิ้น';

            return (
              <div
                key={product.id}
                className={`bg-[#131e31] hover:bg-[#16233a] border rounded-2xl p-3.5 shadow-sm transition-all relative ${
                  isSelected ? 'border-amber-400/80 bg-[#192742]' : 'border-slate-800/80'
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
                        className="w-4 h-4 rounded text-amber-500 bg-slate-850 border-slate-700 focus:ring-0 flex-shrink-0"
                      />
                    )}

                    {product.imageUrl && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 flex-shrink-0 flex items-center justify-center shadow-inner">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-100">
                          {product.name || product.size}
                        </h4>
                        {product.unit && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#1b2b46] text-blue-300 border border-blue-500/30">
                            {product.unit}
                          </span>
                        )}
                        {product.barcode && (
                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <ScanBarcode className="w-2.5 h-2.5" />
                            <span>{product.barcode}</span>
                          </span>
                        )}
                      </div>

                      {/* Subtitle / Prices */}
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {product.sellingPrice > 0 && (
                          <span className="text-emerald-400 font-bold font-mono">
                            ฿{product.sellingPrice.toLocaleString()}
                          </span>
                        )}
                        {product.costPrice > 0 && (
                          <span className="text-slate-500 text-[11px] font-mono">
                            (ทุน: ฿{product.costPrice.toLocaleString()})
                          </span>
                        )}
                        {product.description && (
                          <span className="text-slate-400 text-xs truncate max-w-[140px]">
                            • {product.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                    {/* Stock Quantity Badge */}
                    {isZero ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>หมด</span>
                      </span>
                    ) : isLow ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{product.actualQty} {unitLabel}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{product.actualQty} {unitLabel}</span>
                      </span>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => onEditTire(product)}
                      title="แก้ไขข้อมูลสินค้า"
                      className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => onDeleteTire(product)}
                      title="ลบรายการ"
                      className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Location & Action row */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <span>🗄</span>
                    <span className="text-slate-300 font-medium">
                      {product.location || 'RACK A-01'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onJumpToAudit(product)}
                      className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-0.5"
                    >
                      <span>นับสต็อก</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
