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
} from 'lucide-react';
import { ProductItem, AuditSession } from '../types';

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

  // Calculations for stats
  const totalCount = tires.length;
  const checkedProducts = tires.filter((t) => t.status === 'checked');
  const checkedCount = checkedProducts.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Remaining to check in units
  const remainingPieces = tires
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.systemQty || 0), 0);

  // Exact matched vs discrepancies
  const exactMatchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const modifiedCount = tires.filter((t) => t.status === 'checked' || t.status === 'discrepancy').length;

  return (
    <div className="pb-32 pt-2 px-3 space-y-3 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Audit Progress & Search Header Card */}
      <div className="bg-[#121c2e] border border-slate-800/90 rounded-2xl p-3.5 shadow-md">
        {/* Title & Progress Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <h2 className="text-sm font-bold tracking-wide text-slate-100">
              นับสต็อกด่วน (Quick Audit)
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {checkedCount} / {totalCount} รายการ ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Search input + Action buttons */}
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

          {/* Quick Scanner Action Button */}
          <button
            onClick={onOpenScanner}
            title="เปิดกล้องสแกนบาร์โค้ด"
            className="p-2 rounded-xl bg-[#1c2d47] border border-slate-700 text-cyan-300 hover:text-white hover:bg-cyan-600 transition-all active:scale-95 shadow-sm"
          >
            <ScanBarcode className="w-4 h-4" />
          </button>

          {/* Add Product Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
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
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                    : 'bg-[#152236] text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Zone Header Card */}
      <div className="bg-gradient-to-r from-[#142136] to-[#121b2d] border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-slate-100">
              คลังอะไหล่มอเตอร์ไซค์ CRC ThaBo
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {activeSession?.code || 'AUD-STOCK'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ตรวจนับและเช็กสต็อกสินค้าทุกประเภท
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block">คงเหลือตรวจ</span>
          <span className="text-xl font-extrabold text-amber-400 leading-none">
            {remainingPieces}{' '}
            <span className="text-xs font-normal text-amber-200/80">รายการ</span>
          </span>
        </div>
      </div>

      {/* 4. Products Audit List */}
      <div className="space-y-2.5">
        {totalCount === 0 ? (
          /* Empty state when catalog is cleared */
          <div className="bg-[#121c2e] border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-slate-100 text-sm font-bold">ยังไม่มีสินค้าในระบบ</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                พร้อมเริ่มต้นบันทึกสต็อกอะไหล่มอเตอร์ไซค์ของคุณ กดปุ่มด้านล่างเพื่อสแกนบาร์โค้ดและเริ่มเพิ่มสินค้า
              </p>
            </div>
            <button
              onClick={onOpenAddModal}
              className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าชิ้นแรก</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-8 text-center">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-medium">ไม่พบสินค้าที่ตรงกับการค้นหา</p>
            <p className="text-slate-500 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดเพิ่มสินค้าใหม่</p>
            <button
              onClick={onOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-semibold hover:bg-amber-400 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่มสินค้าใหม่
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
                className="bg-[#131e31] hover:bg-[#15233a] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm transition-all relative overflow-hidden"
              >
                {/* Top Row: Product Info & Menu */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
                        <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                          {product.name || product.size}
                        </h3>
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

                      {/* Subtitle: Prices & Location */}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
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
                        <span>•</span>
                        <span className="text-slate-300">{product.location || 'RACK A-01'}</span>
                        {product.description && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 truncate max-w-[130px]">
                              {product.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    {/* Status badge */}
                    {isChecked ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ตรวจแล้ว</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
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
                        className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuTireId === product.id && (
                        <div className="absolute right-0 top-6 z-20 w-36 bg-[#1a2942] border border-slate-700 rounded-xl shadow-xl py-1 text-xs text-slate-200">
                          <button
                            onClick={() => {
                              onEditTire(product);
                              setActiveMenuTireId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/60 flex items-center justify-between"
                          >
                            <span>แก้ไขข้อมูล</span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            onClick={() => {
                              onUpdateQty(product, product.systemQty);
                              setActiveMenuTireId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/60 flex items-center justify-between text-amber-300"
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
                              className="w-full px-3 py-1.5 text-left hover:bg-rose-950/40 flex items-center justify-between text-rose-400 border-t border-slate-700/60"
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

                {/* Count and Stepper Row */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
                  {/* Left: Actual Count Status badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-medium">นับจริง:</span>
                    {isMatch ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                        <span>✓ ตรงระบบ</span>
                      </span>
                    ) : diff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400">
                        <span>⚠ เกินระบบ +{diff}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400">
                        <span>⚠ คลาดเคลื่อน {diff}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Stepper [-] [Number] [+] */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQty(product, Math.max(0, product.actualQty - 1))}
                      className="w-8 h-8 rounded-xl bg-[#1b2b46] hover:bg-[#223659] active:scale-95 text-slate-100 font-bold flex items-center justify-center border border-slate-700 transition-all text-base"
                    >
                      -
                    </button>

                    <span className="font-mono text-base font-extrabold text-amber-400 min-w-[28px] text-center">
                      {product.actualQty}
                    </span>

                    <button
                      onClick={() => onUpdateQty(product, product.actualQty + 1)}
                      className="w-8 h-8 rounded-xl bg-[#1b2b46] hover:bg-[#223659] active:scale-95 text-slate-100 font-bold flex items-center justify-center border border-slate-700 transition-all text-base"
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
            <div className="bg-[#0f172a]/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-100 block">
                  ปรับปรุงแล้ว: {modifiedCount} รายการ
                </span>
                <span className="text-[11px] text-slate-400">
                  สต็อกตรง {exactMatchedCount} รายการ • คลาดเคลื่อน {discrepancyCount}
                </span>
              </div>

              <button
                onClick={onSaveAudit}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>บันทึกผลการนับ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
