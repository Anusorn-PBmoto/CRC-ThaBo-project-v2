import React, { useState, useMemo } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  CheckCircle2,
  Clock,
  MoreVertical,
  RotateCcw,
  Layers,
  ChevronRight,
  Trash2,
  Package,
  X,
  Maximize2,
  Disc,
  Fuel,
  Filter,
  AlertTriangle,
  Store,
  Warehouse,
  ArrowUp,
} from 'lucide-react';
import { ProductItem, AuditSession } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown } from '../utils/stockUtils';

interface QuickAuditTabProps {
  tires: ProductItem[];
  activeSession: AuditSession | null;
  onUpdateQty: (product: ProductItem, newQty: number) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onSaveAudit: () => void;
  onEditTire: (product: ProductItem) => void;
  onDeleteTire?: (product: ProductItem) => void;
  incomingSearchQuery?: string;
}

type AuditStatusFilter = 'all' | 'pending' | 'checked' | 'discrepancy';

export const QuickAuditTab: React.FC<QuickAuditTabProps> = ({
  tires,
  activeSession,
  onUpdateQty,
  onOpenAddModal,
  onOpenScanner,
  onSaveAudit,
  onEditTire,
  onDeleteTire,
  incomingSearchQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState(incomingSearchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('all');
  const [activeMenuTireId, setActiveMenuTireId] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);

  // Available categories with comprehensive audit stats
  const categoriesWithStats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; checked: number; pending: number; discrepancy: number }
    >();

    tires.forEach((t) => {
      const catName = t.category?.trim() || 'ยางมอเตอร์ไซค์';
      const current = map.get(catName) || { total: 0, checked: 0, pending: 0, discrepancy: 0 };
      current.total += 1;
      if (t.status === 'checked') {
        current.checked += 1;
      } else {
        current.pending += 1;
      }
      if (t.actualQty !== t.systemQty) {
        current.discrepancy += 1;
      }
      map.set(catName, current);
    });

    const list = Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    }));

    // Prioritize standard motorcycle parts categories
    list.sort((a, b) => {
      if (a.name === 'ยางมอเตอร์ไซค์') return -1;
      if (b.name === 'ยางมอเตอร์ไซค์') return 1;
      if (a.name.includes('น้ำมัน')) return -1;
      if (b.name.includes('น้ำมัน')) return 1;
      return a.name.localeCompare(b.name, 'th');
    });

    const totalAll = tires.length;
    const checkedAll = tires.filter((t) => t.status === 'checked').length;
    const pendingAll = tires.filter((t) => t.status !== 'checked').length;
    const discrepancyAll = tires.filter((t) => t.actualQty !== t.systemQty).length;

    return [
      {
        name: 'ทั้งหมด',
        total: totalAll,
        checked: checkedAll,
        pending: pendingAll,
        discrepancy: discrepancyAll,
      },
      ...list,
    ];
  }, [tires]);

  // Current category statistics
  const currentCategoryInfo = useMemo(() => {
    return (
      categoriesWithStats.find(
        (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
      ) || categoriesWithStats[0]
    );
  }, [categoriesWithStats, selectedCategory]);

  // Filter products by Search text, Category, and Audit Status
  const filteredProducts = useMemo(() => {
    return tires.filter((p) => {
      // 1. Text Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.name || p.size || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);

      // 2. Category Filter
      const pCat = p.category?.trim() || 'ยางมอเตอร์ไซค์';
      const matchCategory =
        selectedCategory === 'ทั้งหมด' ||
        pCat.toLowerCase() === selectedCategory.toLowerCase() ||
        (p.brand || '').toLowerCase() === selectedCategory.toLowerCase();

      // 3. Status Filter
      let matchStatus = true;
      if (statusFilter === 'pending') {
        matchStatus = p.status !== 'checked';
      } else if (statusFilter === 'checked') {
        matchStatus = p.status === 'checked';
      } else if (statusFilter === 'discrepancy') {
        matchStatus = p.actualQty !== p.systemQty;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [tires, searchQuery, selectedCategory, statusFilter]);

  // Progress stats for active scope
  const activeScopeTotal = currentCategoryInfo?.total || 0;
  const activeScopeChecked = currentCategoryInfo?.checked || 0;
  const activeScopeRemaining = currentCategoryInfo?.pending || 0;
  const activeScopeProgressPercent =
    activeScopeTotal > 0 ? Math.round((activeScopeChecked / activeScopeTotal) * 100) : 0;

  // Overall stats
  const totalCount = tires.length;
  const checkedCount = tires.filter((t) => t.status === 'checked').length;
  const remainingPieces = tires.filter((t) => t.status !== 'checked').length;
  const exactMatchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const modifiedCount = tires.filter((t) => t.status === 'checked' || t.status === 'discrepancy').length;

  // Helper function to render Category Icon
  const getCategoryIcon = (catName: string) => {
    if (catName === 'ทั้งหมด') return <Layers className="w-3.5 h-3.5" />;
    if (catName.includes('ยาง')) return <Disc className="w-3.5 h-3.5" />;
    if (catName.includes('น้ำมัน') || catName.includes('เคมี'))
      return <Fuel className="w-3.5 h-3.5" />;
    return <Package className="w-3.5 h-3.5" />;
  };

  return (
    <div className="pb-32 pt-2 px-3 space-y-3 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Audit Progress & Search Header Card */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3.5 shadow-md space-y-2.5">
        {/* Title & Progress Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F6C90E] animate-pulse shadow-sm shadow-[#F6C90E]/50" />
            <div>
              <h2 className="text-sm font-bold tracking-wide text-[#EEEEEE] flex items-center gap-1.5">
                <span>นับสต็อกด่วน (Quick Audit)</span>
                {selectedCategory !== 'ทั้งหมด' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F6C90E] text-[#252C33] font-bold">
                    {selectedCategory}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#A0ABB5]">
                {selectedCategory === 'ทั้งหมด'
                  ? 'ตรวจนับสินค้าทุกหมวดหมู่ในคลัง'
                  : `กำลังนับเฉพาะหมวด: ${selectedCategory}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EEEEEE] bg-[#252C33] border border-[#475662] px-2.5 py-1 rounded-full shadow-inner">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#F6C90E]" />
            <span>
              {activeScopeChecked}/{activeScopeTotal} ({activeScopeProgressPercent}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-2.5 bg-[#252C33] rounded-full overflow-hidden p-0.5 border border-[#475662]/50">
            <div
              className="h-full bg-gradient-to-r from-[#F6C90E] to-[#E5B800] transition-all duration-300 rounded-full"
              style={{ width: `${activeScopeProgressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#A0ABB5] px-1">
            <span>
              {selectedCategory !== 'ทั้งหมด' ? `หมวด: ${selectedCategory}` : 'ภาพรวมทั้งคลัง'}
            </span>
            <span>คงเหลือตรวจอีก {activeScopeRemaining} รายการ</span>
          </div>
        </div>

        {/* Search input + Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`ค้นหาใน${selectedCategory === 'ทั้งหมด' ? 'สินค้าทั้งหมด' : selectedCategory}...`}
              className="w-full bg-[#252C33] border border-[#475662] rounded-xl pl-9 pr-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:outline-none focus:border-[#F6C90E] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Scanner Action Button */}
          <button
            onClick={onOpenScanner}
            title="เปิดกล้องสแกนบาร์โค้ด"
            className="p-2 rounded-xl bg-[#252C33] border border-[#475662] text-[#F6C90E] hover:text-[#252C33] hover:bg-[#F6C90E] transition-all active:scale-95 shadow-sm flex-shrink-0"
          >
            <ScanBarcode className="w-4 h-4" />
          </button>

          {/* Add Product Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#252C33]" />
            <span>เพิ่มสินค้า</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Category Filter Bar */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#EEEEEE]">
            <Layers className="w-4 h-4 text-[#F6C90E]" />
            <span>เลือกหมวดหมู่นับสต็อก (Filter Category)</span>
          </div>
          {selectedCategory !== 'ทั้งหมด' && (
            <button
              onClick={() => setSelectedCategory('ทั้งหมด')}
              className="text-[11px] text-[#F6C90E] hover:underline flex items-center gap-1 font-medium"
            >
              <span>รีเซ็ต (ดูทั้งหมด)</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Horizontal Scroll Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {categoriesWithStats.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
            const isComplete = cat.total > 0 && cat.checked === cat.total;

            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border active:scale-95 shadow-sm ${
                  isSelected
                    ? 'bg-[#F6C90E] text-[#252C33] font-bold border-[#F6C90E] shadow-md shadow-[#F6C90E]/25'
                    : isComplete
                    ? 'bg-[#252C33] text-emerald-300 border-emerald-500/40 hover:bg-[#2D3339]'
                    : 'bg-[#252C33] text-[#EEEEEE] border-[#475662] hover:bg-[#2D3339]'
                }`}
              >
                <span className={isSelected ? 'text-[#252C33]' : isComplete ? 'text-emerald-400' : 'text-[#F6C90E]'}>
                  {getCategoryIcon(cat.name)}
                </span>
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected
                      ? 'bg-[#252C33] text-[#F6C90E]'
                      : isComplete
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : 'bg-[#3A4750] text-[#EEEEEE]'
                  }`}
                >
                  {cat.checked}/{cat.total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Sub-Filters (ทั้งหมด / ยังไม่ตรวจ / ตรวจแล้ว / ยอดคลาดเคลื่อน) */}
        <div className="pt-1.5 border-t border-[#475662]/70 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#F6C90E]/20 text-[#F6C90E] border border-[#F6C90E]/40 font-bold'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              ทั้งหมด ({currentCategoryInfo.total})
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <span>⏳ ยังไม่ตรวจ</span>
              <span className="font-mono text-[10px]">({currentCategoryInfo.pending})</span>
            </button>

            <button
              onClick={() => setStatusFilter('checked')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'checked'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <span>✓ ตรวจแล้ว</span>
              <span className="font-mono text-[10px]">({currentCategoryInfo.checked})</span>
            </button>

            {currentCategoryInfo.discrepancy > 0 && (
              <button
                onClick={() => setStatusFilter('discrepancy')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                  statusFilter === 'discrepancy'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <span>⚠️ คลาดเคลื่อน</span>
                <span className="font-mono text-[10px]">({currentCategoryInfo.discrepancy})</span>
              </button>
            )}
          </div>

          <span className="text-[10px] text-[#A0ABB5] whitespace-nowrap pl-2 font-mono">
            แสดง {filteredProducts.length} รายการ
          </span>
        </div>
      </div>

      {/* 3. Zone / Scope Information Card */}
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
            {selectedCategory === 'ทั้งหมด'
              ? 'ตรวจนับสต็อกทุกหมวดหมู่พร้อมบันทึกผลเรียลไทม์'
              : `หมวดหมู่: ${selectedCategory} (ตรวจแล้ว ${activeScopeChecked}/${activeScopeTotal} รายการ)`}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#A0ABB5] block">
            {selectedCategory === 'ทั้งหมด' ? 'คงเหลือทั้งคลัง' : 'เหลือในหมวดนี้'}
          </span>
          <span className="text-xl font-extrabold text-[#F6C90E] leading-none">
            {activeScopeRemaining}{' '}
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
          <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-8 text-center space-y-2">
            <Layers className="w-10 h-10 text-[#A0ABB5] mx-auto mb-1 opacity-70" />
            <p className="text-sm font-bold text-[#EEEEEE]">ไม่พบรายการสินค้าที่ตรงตามเงื่อนไข</p>
            <p className="text-xs text-[#A0ABB5]">
              {selectedCategory !== 'ทั้งหมด' ? `หมวดหมู่: "${selectedCategory}" ` : ''}
              {searchQuery ? `คำค้นหา: "${searchQuery}" ` : ''}
              {statusFilter !== 'all' ? `สถานะ: ${statusFilter === 'pending' ? 'ยังไม่ตรวจ' : statusFilter === 'checked' ? 'ตรวจแล้ว' : 'ยอดคลาดเคลื่อน'}` : ''}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ทั้งหมด');
                setStatusFilter('all');
              }}
              className="mt-3 px-3 py-1.5 bg-[#252C33] hover:bg-[#2D3339] border border-[#475662] text-[#F6C90E] text-xs rounded-xl font-medium transition-all"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const breakdown = getProductStockBreakdown(product);
            const isMatch = product.actualQty === product.systemQty;
            const diff = product.actualQty - product.systemQty;
            const isChecked = product.status === 'checked';
            const unitLabel = product.unit || 'ชิ้น';
            const productImg = resolveProductImage(product);

            return (
              <div
                key={product.id}
                className="bg-[#3A4750] hover:bg-[#43525D] border border-[#475662] rounded-2xl p-3.5 shadow-sm transition-all relative overflow-hidden"
              >
                {/* Top Section: Left Photo (Red box in screenshot) + Right Info */}
                <div className="flex items-start gap-3">
                  {/* Left Side: Product Photo */}
                  {productImg && productImg.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setPreviewProduct({ ...product, imageUrl: productImg })}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-[#252C33] border border-[#475662] flex-shrink-0 flex items-center justify-center shadow-md relative group hover:border-[#F6C90E] transition-all active:scale-95 cursor-zoom-in"
                      title="แตะเพื่อดูภาพขนาดใหญ่"
                    >
                      <img
                        src={productImg}
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

                        {/* Subtitle: Prices & Location */}
                        <div className="text-xs text-[#A0ABB5] mt-1 flex items-center gap-2 flex-wrap">
                          {product.sellingPrice > 0 && (
                            <span className="text-[#F6C90E] font-bold font-mono">
                              ฿{product.sellingPrice.toLocaleString()}
                            </span>
                          )}
                          <span>•</span>
                          <span className="text-[#EEEEEE] flex items-center gap-1">
                            <Store className="w-3 h-3 text-[#F6C90E]" />
                            <span>หน้าร้าน: {breakdown.frontQty}</span>
                          </span>
                          <span>•</span>
                          <span className="text-sky-300 flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-sky-400" />
                            <span>คลัง: {breakdown.warehouseQty}</span>
                          </span>
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

      {/* End of list scroll to top shortcut */}
      {filteredProducts.length > 5 && (
        <div className="pt-2 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#20262D] hover:bg-[#2A333C] text-[#F6C90E] border border-[#475662] hover:border-[#F6C90E] text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>กลับขึ้นไปด้านบนสุด ({filteredProducts.length} รายการ)</span>
          </button>
        </div>
      )}

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
                <CheckCircle2 className="w-4 h-4 text-[#252C33]" />
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
