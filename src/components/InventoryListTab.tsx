import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  Pencil,
  Trash2,
  Package,
  ChevronRight,
  TrendingUp,
  X,
  Maximize2,
  Store,
  Warehouse,
  ArrowRightLeft,
  ArrowUp,
  Sparkles,
  List,
  Columns3,
  Grid3X3,
  Image as ImageIcon,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { ProductItem } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown } from '../utils/stockUtils';
import { normalizeCategory } from '../utils/categoryUtils';

interface InventoryListTabProps {
  tires: ProductItem[];
  isDesktopMode?: boolean;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onEditTire: (product: ProductItem) => void;
  onDeleteTire: (product: ProductItem) => void;
  onJumpToAudit: (product: ProductItem) => void;
  onOpenPO: (product: ProductItem) => void;
  onOpenBatchPO: (selectedProducts: ProductItem[]) => void;
  onOpenImageMatch?: () => void;
  onOpenTransferModal?: (product: ProductItem) => void;
  onOpenBatchTransfer?: (selectedProducts: ProductItem[]) => void;
  onOpenBillScanner?: () => void;
  incomingSearchQuery?: string;
}

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type LocationFilter = 'all' | 'front' | 'warehouse';
type SortOption = 'updated' | 'name' | 'stockDesc' | 'stockAsc' | 'priceDesc' | 'priceAsc';
export type InventoryViewMode = 'icons' | 'list' | 'columns' | 'gallery';

interface ViewOption {
  id: InventoryViewMode;
  label: string;
  enLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    id: 'icons',
    label: 'ไอคอน',
    enLabel: 'Icons',
    icon: Grid3X3,
    description: 'แสดงแบบไอคอนขนาดกะทัดรัด (show items as icons)',
  },
  {
    id: 'list',
    label: 'รายการ',
    enLabel: 'List',
    icon: List,
    description: 'แสดงเป็นรายการแนวนอน อ่านง่าย ละเอียด (show items in a list)',
  },
  {
    id: 'columns',
    label: 'คอลัมน์',
    enLabel: 'Columns',
    icon: Columns3,
    description: 'แสดงเป็นตารางแยกคอลัมน์ชัดเจน (show items in columns)',
  },
  {
    id: 'gallery',
    label: 'แกลเลอรี',
    enLabel: 'Gallery',
    icon: ImageIcon,
    description: 'แสดงการ์ดรูปภาพใหญ่ สไตล์โชว์รูม (show items in a gallery)',
  },
];

const PAGE_SIZE = 36;

export const InventoryListTab: React.FC<InventoryListTabProps> = ({
  tires,
  isDesktopMode = false,
  onOpenAddModal,
  onOpenScanner,
  onEditTire,
  onDeleteTire,
  onJumpToAudit,
  onOpenPO,
  onOpenBatchPO,
  onOpenImageMatch,
  onOpenTransferModal,
  onOpenBatchTransfer,
  onOpenBillScanner,
  incomingSearchQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState(incomingSearchQuery || '');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [viewMode, setViewMode] = useState<InventoryViewMode>(() => {
    try {
      const saved = localStorage.getItem('crc_catalog_view_mode') as InventoryViewMode;
      if (saved === 'icons' || saved === 'list' || saved === 'columns' || saved === 'gallery') {
        return saved;
      }
      if ((saved as string) === 'grid') return 'gallery';
      if ((saved as string) === 'table') return 'columns';
    } catch {}
    return isDesktopMode ? 'gallery' : 'gallery';
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);

  // Sync incoming search query
  useEffect(() => {
    if (incomingSearchQuery !== undefined) {
      setSearchQuery(incomingSearchQuery);
    }
  }, [incomingSearchQuery]);

  // Reset pagination on filter/search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, locationFilter, stockFilter, selectedCategory, sortBy]);

  const handleSetViewMode = (mode: InventoryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('crc_catalog_view_mode', mode);
    } catch {}
  };

  // Categories list with item counts (unifying redundant categories)
  const categoriesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    tires.forEach((t) => {
      const cat = normalizeCategory(t.category || t.brand);
      map.set(cat, (map.get(cat) || 0) + 1);
    });

    const sortedCats = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return [{ name: 'ทั้งหมด', count: tires.length }, ...sortedCats];
  }, [tires]);

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const result = tires.filter((p) => {
      const breakdown = getProductStockBreakdown(p);

      // Location-specific stock zero filtering
      if (locationFilter === 'front') {
        if (stockFilter === 'out_of_stock' && breakdown.frontQty > 0) return false;
      } else if (locationFilter === 'warehouse') {
        if (stockFilter === 'out_of_stock' && breakdown.warehouseQty > 0) return false;
      }

      // Search match
      if (q) {
        const matchSearch =
          (p.name || p.size || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q) ||
          (p.frontLocation || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // Category match (combining redundant categories seamlessly)
      if (selectedCategory !== 'ทั้งหมด') {
        const itemCat = normalizeCategory(p.category);
        const selCat = normalizeCategory(selectedCategory);
        const matchCategory =
          itemCat.toLowerCase() === selCat.toLowerCase() ||
          (p.brand || '').toLowerCase() === selCat.toLowerCase() ||
          (p.category || '').toLowerCase() === selCat.toLowerCase();
        if (!matchCategory) return false;
      }

      // Stock status filter
      if (stockFilter !== 'all') {
        const effectiveQty =
          locationFilter === 'front'
            ? breakdown.frontQty
            : locationFilter === 'warehouse'
            ? breakdown.warehouseQty
            : breakdown.totalQty;

        const effectiveMin =
          locationFilter === 'front'
            ? p.minFrontStock || 2
            : locationFilter === 'warehouse'
            ? p.minStock || 2
            : p.minStock || 2;

        if (stockFilter === 'in_stock' && effectiveQty <= 0) return false;
        if (stockFilter === 'out_of_stock' && effectiveQty > 0) return false;
        if (stockFilter === 'low_stock' && (effectiveQty <= 0 || effectiveQty > effectiveMin)) return false;
      }

      return true;
    });

    // Sort products
    return result.sort((a, b) => {
      const bkA = getProductStockBreakdown(a);
      const bkB = getProductStockBreakdown(b);

      const qtyA =
        locationFilter === 'front'
          ? bkA.frontQty
          : locationFilter === 'warehouse'
          ? bkA.warehouseQty
          : bkA.totalQty;

      const qtyB =
        locationFilter === 'front'
          ? bkB.frontQty
          : locationFilter === 'warehouse'
          ? bkB.warehouseQty
          : bkB.totalQty;

      const priceA = a.sellingPrice || a.price || 0;
      const priceB = b.sellingPrice || b.price || 0;

      switch (sortBy) {
        case 'name':
          return (a.name || a.size || '').localeCompare(b.name || b.size || '', 'th');
        case 'stockDesc':
          return qtyB - qtyA;
        case 'stockAsc':
          return qtyA - qtyB;
        case 'priceDesc':
          return priceB - priceA;
        case 'priceAsc':
          return priceA - priceB;
        case 'updated':
        default: {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        }
      }
    });
  }, [tires, searchQuery, locationFilter, stockFilter, selectedCategory, sortBy]);

  // Overall statistics
  const { totalItems, availablePieces, storefrontTotalPieces, warehouseTotalPieces, lowStockCount, outOfStockCount } =
    useMemo(() => {
      let pieces = 0;
      let frontPieces = 0;
      let whPieces = 0;
      let low = 0;
      let out = 0;

      tires.forEach((p) => {
        const b = getProductStockBreakdown(p);
        pieces += b.totalQty;
        frontPieces += b.frontQty;
        whPieces += b.warehouseQty;

        if (b.totalQty === 0) {
          out++;
        } else if (b.totalQty <= (p.minStock || 2)) {
          low++;
        }
      });

      return {
        totalItems: tires.length,
        availablePieces: pieces,
        storefrontTotalPieces: frontPieces,
        warehouseTotalPieces: whPieces,
        lowStockCount: low,
        outOfStockCount: out,
      };
    }, [tires]);

  // Paginated slice
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const hasMore = visibleCount < filteredProducts.length;

  return (
    <div
      className={`px-3 ${
        isDesktopMode ? 'sm:px-6 max-w-[1600px] w-full' : 'max-w-md w-full'
      } py-4 mx-auto space-y-4 font-['Prompt',sans-serif] transition-all duration-300`}
    >
      {/* 1. Header Catalog Overview Bar */}
      <div className="bg-[#242C33] border border-[#3A4750] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        {isDesktopMode ? (
          /* ================= DESKTOP HEADER ================= */
          <div className="flex flex-row items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#F6C90E]" />
                </div>
                <h2 className="text-lg font-bold text-[#EEEEEE] tracking-tight">
                  แคตตาล็อกสินค้า & อะไหล่
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A0ABB5] mt-1 pl-10">
                <span>ทั้งหมด {totalItems.toLocaleString()} รายการ</span>
                <span aria-hidden="true">·</span>
                <span>สต็อกรวม {availablePieces.toLocaleString()} ชิ้น</span>
                {filteredProducts.length !== totalItems && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#F6C90E] font-medium">ตรงเงื่อนไข {filteredProducts.length.toLocaleString()} รายการ</span>
                  </>
                )}
              </div>
            </div>

            {/* Desktop Action buttons & View mode toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 4 View Modes Switcher */}
              <div
                className="flex items-center bg-[#1A1F26] p-1 rounded-xl border border-[#3A4750] shadow-inner"
                role="group"
                aria-label="ตัวเลือกรูปแบบการแสดงการ์ดสินค้า"
              >
                {VIEW_OPTIONS.map((opt) => {
                  const isActive = viewMode === opt.id;
                  const IconComponent = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSetViewMode(opt.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                          : 'text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#252C33]'
                      }`}
                      title={`${opt.label} (${opt.enLabel}) - ${opt.description}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {onOpenBillScanner && (
                <button
                  type="button"
                  onClick={onOpenBillScanner}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-[#F6C90E] hover:from-amber-500 hover:to-[#E5B800] text-slate-950 font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  title="ใช้ AI สแกนภาพถ่ายบิล/ใบเสร็จ เพื่อสกัดและเพิ่มสินค้าหลายรายการพร้อมกัน"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                  <span>ถ่ายบิลเพิ่มสินค้า (AI)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#252C33] stroke-[2.5]" />
                <span>เพิ่มสินค้า</span>
              </button>
            </div>
          </div>
        ) : (
          /* ================= MOBILE HEADER (CLEAN & FULL-WIDTH) ================= */
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#F6C90E]" />
                </div>
                <h2 className="text-base font-bold text-[#EEEEEE] tracking-tight">
                  แคตตาล็อกสินค้า & อะไหล่
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A0ABB5] mt-1 pl-10">
                <span>ทั้งหมด {totalItems.toLocaleString()} รายการ</span>
                <span aria-hidden="true">·</span>
                <span>สต็อกรวม {availablePieces.toLocaleString()} ชิ้น</span>
                {filteredProducts.length !== totalItems && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#F6C90E] font-medium">ตรง {filteredProducts.length.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Mobile View Switcher: 4 Equal Grid Columns */}
            <div
              className="grid grid-cols-4 gap-1 p-1 bg-[#1A1F26] rounded-xl border border-[#3A4750] shadow-inner"
              role="group"
              aria-label="ตัวเลือกรูปแบบการแสดงการ์ดสินค้า"
            >
              {VIEW_OPTIONS.map((opt) => {
                const isActive = viewMode === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSetViewMode(opt.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                        : 'text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#252C33]'
                    }`}
                    title={`${opt.label} (${opt.enLabel}) - ${opt.description}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Actions: 2-column Full Width */}
            <div className="grid grid-cols-2 gap-2">
              {onOpenBillScanner && (
                <button
                  type="button"
                  onClick={onOpenBillScanner}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-400 to-[#F6C90E] hover:from-amber-500 hover:to-[#E5B800] text-slate-950 font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  title="ใช้ AI สแกนภาพถ่ายบิล/ใบเสร็จ"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950 flex-shrink-0" />
                  <span className="truncate">ถ่ายบิลเพิ่มสินค้า (AI)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAddModal}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer ${
                  !onOpenBillScanner ? 'col-span-2' : ''
                }`}
              >
                <Plus className="w-4 h-4 text-[#252C33] stroke-[2.5] flex-shrink-0" />
                <span>เพิ่มสินค้า</span>
              </button>
            </div>
          </div>
        )}

        {/* Clean Executive Metrics Strip */}
        <div
          className={`grid ${
            isDesktopMode ? 'grid-cols-4 gap-3' : 'grid-cols-2 gap-2'
          } pt-1 border-t border-[#3A4750]/70`}
        >
          <button
            type="button"
            onClick={() => {
              setLocationFilter((prev) => (prev === 'front' ? 'all' : 'front'));
            }}
            className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
              locationFilter === 'front'
                ? 'bg-amber-400/10 border-amber-400/50 text-[#EEEEEE]'
                : 'bg-[#1F252B] border-[#3A4750]/60 hover:border-[#4E5D6A]'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#A0ABB5] mb-1">
              <span className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-[#F6C90E]" />
                หน้าร้าน
              </span>
              {locationFilter === 'front' && (
                <span className="text-[10px] text-[#F6C90E] font-medium">กำลังกรอง</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#F6C90E]">
              {storefrontTotalPieces.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#A0ABB5]">ชิ้น</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setLocationFilter((prev) => (prev === 'warehouse' ? 'all' : 'warehouse'));
            }}
            className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
              locationFilter === 'warehouse'
                ? 'bg-sky-500/10 border-sky-400/50 text-[#EEEEEE]'
                : 'bg-[#1F252B] border-[#3A4750]/60 hover:border-[#4E5D6A]'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#A0ABB5] mb-1">
              <span className="flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5 text-sky-400" />
                คลังหลัง
              </span>
              {locationFilter === 'warehouse' && (
                <span className="text-[10px] text-sky-400 font-medium">กำลังกรอง</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-sky-400">
              {warehouseTotalPieces.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#A0ABB5]">ชิ้น</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStockFilter((prev) => (prev === 'low_stock' ? 'all' : 'low_stock'));
            }}
            className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
              stockFilter === 'low_stock'
                ? 'bg-amber-400/10 border-amber-400/50 text-[#EEEEEE]'
                : 'bg-[#1F252B] border-[#3A4750]/60 hover:border-[#4E5D6A]'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#A0ABB5] mb-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                สต็อกเหลือน้อย
              </span>
              {stockFilter === 'low_stock' && (
                <span className="text-[10px] text-amber-400 font-medium">กำลังกรอง</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-amber-400">
              {lowStockCount.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStockFilter((prev) => (prev === 'out_of_stock' ? 'all' : 'out_of_stock'));
            }}
            className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
              stockFilter === 'out_of_stock'
                ? 'bg-rose-500/10 border-rose-500/50 text-[#EEEEEE]'
                : 'bg-[#1F252B] border-[#3A4750]/60 hover:border-[#4E5D6A]'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#A0ABB5] mb-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                สต็อกหมด
              </span>
              {stockFilter === 'out_of_stock' && (
                <span className="text-[10px] text-rose-400 font-medium">กำลังกรอง</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-rose-400">
              {outOfStockCount.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#A0ABB5]">รายการ</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Unified Search & Filtering Toolbar */}
      <div className="bg-[#242C33] border border-[#3A4750] rounded-2xl p-3.5 space-y-3 shadow-sm">
        {/* Row 1: Search bar + Scan & Sort */}
        <div className={`flex items-center gap-2 ${isDesktopMode ? 'flex-nowrap' : 'flex-wrap'}`}>
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-[#A0ABB5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า, รหัสบาร์โค้ด, เบอร์ยาง, ตำแหน่งจัดเก็บ..."
              className="w-full bg-[#1A1F26] text-[#EEEEEE] placeholder-[#A0ABB5]/70 pl-10 pr-9 py-2 rounded-xl border border-[#3A4750] focus:border-[#F6C90E] focus:outline-none text-xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0ABB5] hover:text-[#EEEEEE] p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Barcode Scan Button */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1A1F26] hover:bg-[#202730] text-[#F6C90E] border border-[#3A4750] hover:border-[#F6C90E]/60 rounded-xl text-xs font-semibold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            title="เปิดกล้องสแกนบาร์โค้ดสินค้า"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>สแกนบาร์โค้ด</span>
          </button>

          {/* Sort Selector */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#A0ABB5] absolute left-3 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#1A1F26] text-[#EEEEEE] border border-[#3A4750] hover:border-[#4E5D6A] pl-8 pr-7 py-2 rounded-xl text-xs focus:border-[#F6C90E] focus:outline-none transition-colors cursor-pointer appearance-none"
            >
              <option value="updated">อัปเดตล่าสุด</option>
              <option value="name">ชื่อสินค้า ก-ฮ</option>
              <option value="stockDesc">สต็อกมาก → น้อย</option>
              <option value="stockAsc">สต็อกน้อย → มาก</option>
              <option value="priceDesc">ราคาขายสูง → ต่ำ</option>
              <option value="priceAsc">ราคาขายต่ำ → สูง</option>
            </select>
          </div>
        </div>

        {/* Row 2: Location and Stock Status Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-[#3A4750]/60">
          {/* Location Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#1A1F26] rounded-xl border border-[#3A4750]/60 text-xs">
            <span className="text-[11px] text-[#A0ABB5] px-2 font-medium hidden sm:inline">คลัง:</span>
            <button
              type="button"
              onClick={() => setLocationFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                locationFilter === 'all'
                  ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter('front')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                locationFilter === 'front'
                  ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>หน้าร้าน</span>
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter('warehouse')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                locationFilter === 'warehouse'
                  ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>คลังหลัง</span>
            </button>
          </div>

          {/* Stock Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#1A1F26] rounded-xl border border-[#3A4750]/60 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                stockFilter === 'all'
                  ? 'bg-[#3A4750] text-[#EEEEEE] font-bold border border-[#475662]'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              ทั้งหมด ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('in_stock')}
              className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                stockFilter === 'in_stock'
                  ? 'bg-[#3A4750] text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>มีสต็อก</span>
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                stockFilter === 'low_stock'
                  ? 'bg-[#3A4750] text-amber-300 font-bold border border-amber-400/40'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>เหลือน้อย</span>
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                stockFilter === 'out_of_stock'
                  ? 'bg-[#3A4750] text-rose-300 font-bold border border-rose-500/40'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>หมด</span>
            </button>
          </div>
        </div>

        {/* Row 3: Category Filter Tags (Clean Segmented Bar) */}
        {categoriesWithCounts.length > 1 && (
          <div className="pt-1 border-t border-[#3A4750]/60">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
              <span className="text-[11px] text-[#A0ABB5] font-medium pl-1 flex-shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#A0ABB5]" />
                หมวด:
              </span>
              {categoriesWithCounts.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                        : 'bg-[#1A1F26] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750]'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-[#252C33]/20 text-[#252C33]' : 'bg-[#242C33] text-[#A0ABB5]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}

              {(searchQuery || selectedCategory !== 'ทั้งหมด' || stockFilter !== 'all' || locationFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ทั้งหมด');
                    setStockFilter('all');
                    setLocationFilter('all');
                  }}
                  className="px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[11px] font-medium whitespace-nowrap transition-colors ml-auto cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Products Content Area with 4 View Modes (Icons, List, Columns, Gallery) */}
      {totalItems === 0 ? (
        <div className="bg-[#242C33] border border-dashed border-[#3A4750] rounded-2xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#1A1F26] border border-amber-400/30 text-[#F6C90E] flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[#EEEEEE] text-sm font-bold">ยังไม่มีข้อมูลสินค้าในคลัง</p>
            <p className="text-[#A0ABB5] text-xs mt-1 max-w-sm mx-auto">
              เริ่มต้นบันทึกอะไหล่มอเตอร์ไซค์ สแกนบิล หรือเพิ่มสินค้าใหม่เข้าสู่ระบบ
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="py-2.5 px-4 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#252C33] stroke-[2.5]" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
            {onOpenBillScanner && (
              <button
                type="button"
                onClick={onOpenBillScanner}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-400 to-[#F6C90E] hover:from-amber-500 hover:to-[#E5B800] text-slate-950 font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>ถ่ายบิลเพิ่มสินค้า (AI)</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#242C33] border border-[#3A4750] rounded-2xl p-10 text-center space-y-3">
          <Package className="w-10 h-10 text-[#A0ABB5] mx-auto opacity-60" />
          <p className="text-[#EEEEEE] text-sm font-medium">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>
          <p className="text-[#A0ABB5] text-xs">
            มีสินค้าในระบบทั้งหมด {totalItems.toLocaleString()} รายการ แต่อาจถูกคัดกรองออกด้วยคำค้นหาหรือหมวดหมู่
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ทั้งหมด');
              setStockFilter('all');
              setLocationFilter('all');
            }}
            className="mt-2 px-3.5 py-1.5 bg-[#1A1F26] hover:bg-[#202730] text-[#F6C90E] border border-[#3A4750] rounded-xl text-xs font-semibold inline-block transition-colors cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : viewMode === 'icons' ? (
        /* ================= 1. ICONS VIEW (SHOW ITEMS AS ICONS) ================= */
        <div
          className={`grid ${
            isDesktopMode
              ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3'
              : 'grid-cols-3 gap-2'
          }`}
        >
          {paginatedProducts.map((product) => {
            const breakdown = getProductStockBreakdown(product);
            const isZero = breakdown.totalQty === 0;
            const isLow = breakdown.totalQty > 0 && breakdown.totalQty <= (product.minStock || 2);
            const unitLabel = product.unit || 'ชิ้น';
            const productImg = resolveProductImage(product);
            const catName = normalizeCategory(product.category || product.brand);

            return (
              <div
                key={product.id}
                className="bg-[#242C33] hover:bg-[#2A333C] border border-[#3A4750] hover:border-[#F6C90E]/80 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-200 group relative shadow-sm hover:shadow-md"
              >
                {/* Top Image Box */}
                <div>
                  <div className="aspect-square w-full rounded-lg bg-[#1A1F26] overflow-hidden relative flex items-center justify-center border border-[#3A4750]/60 mb-1.5 sm:mb-2">
                    {productImg ? (
                      <button
                        type="button"
                        onClick={() => setPreviewProduct({ ...product, imageUrl: productImg })}
                        className="w-full h-full relative cursor-zoom-in group/img"
                        title="แตะเพื่อดูภาพขนาดใหญ่"
                      >
                        <img
                          src={productImg}
                          alt={product.name || 'สินค้า'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5 text-[#F6C90E]" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-[#A0ABB5]/40">
                        <Package className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                    )}

                    {/* Category mini tag */}
                    <span className="absolute top-1 left-1 px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded bg-black/75 backdrop-blur-xs text-[8px] sm:text-[9px] font-medium text-[#EEEEEE] truncate max-w-[50px] sm:max-w-[65px] pointer-events-none">
                      {catName}
                    </span>

                    {/* Status dot */}
                    <div className="absolute top-1 right-1 pointer-events-none">
                      {isZero ? (
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-500 block ring-2 ring-[#1A1F26]" title="สินค้าหมด" />
                      ) : isLow ? (
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 block ring-2 ring-[#1A1F26]" title="สต็อกเหลือน้อย" />
                      ) : (
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 block ring-2 ring-[#1A1F26]" title="มีสต็อก" />
                      )}
                    </div>

                    {/* Stock pill overlay */}
                    <span className="absolute bottom-1 right-1 px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded bg-[#1A1F26]/90 backdrop-blur-xs text-[9px] sm:text-[10px] font-mono font-bold text-[#EEEEEE] border border-[#3A4750] shadow-sm pointer-events-none">
                      {breakdown.totalQty}
                    </span>
                  </div>

                  {/* Title & Price */}
                  <h4
                    className="text-[11px] sm:text-xs font-semibold text-[#EEEEEE] line-clamp-2 leading-tight group-hover:text-[#F6C90E] transition-colors min-h-[1.8rem] sm:min-h-[2rem]"
                    title={product.name || product.size}
                  >
                    {product.name || product.size}
                  </h4>

                  <div className="mt-0.5 sm:mt-1 font-mono font-bold text-xs sm:text-sm text-[#F6C90E]">
                    ฿{(product.sellingPrice || product.price || 0).toLocaleString()}
                  </div>

                  {/* Stock split micro-line */}
                  <div className="text-[9px] sm:text-[10px] text-[#A0ABB5] font-mono flex items-center justify-between pt-1 border-t border-[#3A4750]/50 mt-1">
                    <span>หน้า: <strong className="text-amber-300 font-bold">{breakdown.frontQty}</strong></span>
                    <span>คลัง: <strong className="text-sky-300 font-bold">{breakdown.warehouseQty}</strong></span>
                  </div>
                </div>

                {/* Quick actions strip */}
                <div className="pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-[#3A4750]/60 flex items-center justify-between gap-1 text-xs">
                  {onOpenTransferModal && (
                    <button
                      type="button"
                      onClick={() => onOpenTransferModal(product)}
                      title="โอนย้ายสต็อก"
                      className="p-1 rounded bg-[#1A1F26] hover:bg-[#202730] text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer flex-1 flex items-center justify-center"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToAudit(product)}
                    title="นับสต็อก"
                    className="p-1 rounded bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer flex-1 flex items-center justify-center"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditTire(product)}
                    title="แก้ไขสินค้า"
                    className="p-1 rounded bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer flex-1 flex items-center justify-center"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {isDesktopMode && (
                    <button
                      type="button"
                      onClick={() => onOpenPO(product)}
                      title="สั่งซื้อเพิ่ม (PO)"
                      className="p-1 rounded bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer flex-1 flex items-center justify-center"
                    >
                      <TrendingUp className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'list' ? (
        /* ================= 2. LIST VIEW (SHOW ITEMS IN A LIST) ================= */
        <div className="space-y-2">
          {paginatedProducts.map((product) => {
            const breakdown = getProductStockBreakdown(product);
            const isZero = breakdown.totalQty === 0;
            const isLow = breakdown.totalQty > 0 && breakdown.totalQty <= (product.minStock || 2);
            const unitLabel = product.unit || 'ชิ้น';
            const productImg = resolveProductImage(product);
            const catName = normalizeCategory(product.category || product.brand);

            return (
              <div
                key={product.id}
                className={`bg-[#242C33] hover:bg-[#2A333C] border border-[#3A4750] hover:border-[#4E5D6A] rounded-xl p-3 flex ${
                  isDesktopMode ? 'flex-row items-center justify-between' : 'flex-col'
                } gap-3 transition-all duration-150 group shadow-sm`}
              >
                {/* Left side: Photo + Product Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Photo Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-[#1A1F26] border border-[#3A4750] flex items-center justify-center flex-shrink-0 relative group/thumb">
                    {productImg ? (
                      <button
                        type="button"
                        onClick={() => setPreviewProduct({ ...product, imageUrl: productImg })}
                        className="w-full h-full relative cursor-zoom-in"
                        title="แตะเพื่อดูภาพขนาดใหญ่"
                      >
                        <img
                          src={productImg}
                          alt={product.name || 'สินค้า'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5 text-[#F6C90E]" />
                        </div>
                      </button>
                    ) : (
                      <Package className="w-6 h-6 text-[#A0ABB5]/40" />
                    )}

                    {/* Status dot overlay */}
                    <div className="absolute top-1 right-1 pointer-events-none">
                      {isZero ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block ring-2 ring-[#1A1F26]" title="สินค้าหมด" />
                      ) : isLow ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block ring-2 ring-[#1A1F26]" title="สต็อกเหลือน้อย" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block ring-2 ring-[#1A1F26]" title="มีสต็อก" />
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-[#1A1F26] border border-[#3A4750] text-[#EEEEEE] font-medium">
                        {catName}
                      </span>
                      {product.barcode && (
                        <span className="inline-flex items-center gap-1 font-mono text-[#F6C90E]">
                          <ScanBarcode className="w-3 h-3" />
                          <span>{product.barcode}</span>
                        </span>
                      )}
                      {product.brand && (
                        <span className="text-[#A0ABB5] hidden sm:inline">แบรนด์: {product.brand}</span>
                      )}
                    </div>

                    <h4
                      className="text-sm sm:text-base font-bold text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors truncate"
                      title={product.name || product.size}
                    >
                      {product.name || product.size}
                    </h4>

                    {/* Locations */}
                    <div className="flex items-center gap-3 text-xs text-[#A0ABB5]">
                      <span>
                        หน้าร้าน:{' '}
                        <span className="text-[#EEEEEE] font-medium">
                          {breakdown.frontLocation || '-'}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        คลังหลัง:{' '}
                        <span className="text-[#EEEEEE] font-medium">
                          {breakdown.warehouseLocation || '-'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Stock Breakdown + Price + Action Buttons */}
                <div
                  className={`flex items-center justify-between ${
                    isDesktopMode ? 'justify-end' : 'pt-2 border-t border-[#3A4750]/50'
                  } gap-3 sm:gap-4 flex-wrap`}
                >
                  {/* Stock chips */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <div className="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 whitespace-nowrap">
                      <span className="text-[10px] text-amber-400/70 mr-1 font-sans">หน้าร้าน</span>
                      <span className="font-bold">{breakdown.frontQty}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-400/30 text-sky-300 whitespace-nowrap">
                      <span className="text-[10px] text-sky-400/70 mr-1 font-sans">คลัง</span>
                      <span className="font-bold">{breakdown.warehouseQty}</span>
                    </div>
                    <div
                      className={`px-2.5 py-1 rounded-lg border font-bold whitespace-nowrap ${
                        isZero
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : isLow
                          ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      <span className="text-[10px] mr-1 font-sans">รวม</span>
                      <span>{breakdown.totalQty}</span> {unitLabel}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right min-w-[80px]">
                    <div className="font-mono font-extrabold text-base sm:text-lg text-[#F6C90E]">
                      ฿{(product.sellingPrice || product.price || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#A0ABB5]">/ {unitLabel}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {onOpenTransferModal && (
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal(product)}
                        title="โอนย้ายสต็อก"
                        className="p-2 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onJumpToAudit(product)}
                      title="นับสต็อก"
                      className="p-2 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPO(product)}
                      title="สั่งซื้อเพิ่ม (PO)"
                      className="p-2 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditTire(product)}
                      title="แก้ไขสินค้า"
                      className="p-2 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      title="ลบรายการ"
                      className="p-2 rounded-lg bg-[#1A1F26] hover:bg-rose-500/20 text-[#A0ABB5] hover:text-rose-400 border border-[#3A4750] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'columns' ? (
        /* ================= 3. COLUMNS VIEW (SHOW ITEMS IN COLUMNS) ================= */
        <div className="bg-[#242C33] border border-[#3A4750] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1A1F26] text-[#A0ABB5] border-b border-[#3A4750] uppercase text-[11px] tracking-wider whitespace-nowrap">
                  <th className="py-3 px-3 w-14">รูป</th>
                  <th className="py-3 px-3">รหัส / บาร์โค้ด</th>
                  <th className="py-3 px-3 min-w-[180px]">ชื่อสินค้า / สเปก</th>
                  <th className="py-3 px-3">หมวดหมู่</th>
                  <th className="py-3 px-3">ตำแหน่งจัดเก็บ</th>
                  <th className="py-3 px-3 text-right">ราคาขาย</th>
                  <th className="py-3 px-3 text-center">หน้าร้าน</th>
                  <th className="py-3 px-3 text-center">คลังหลัง</th>
                  <th className="py-3 px-3 text-center">รวมสต็อก</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A4750]/60">
                {paginatedProducts.map((product) => {
                  const breakdown = getProductStockBreakdown(product);
                  const productImg = resolveProductImage(product);
                  const unitLabel = product.unit || 'ชิ้น';
                  const isZero = breakdown.totalQty === 0;
                  const isLow = breakdown.totalQty > 0 && breakdown.totalQty <= (product.minStock || 2);
                  const catName = normalizeCategory(product.category || product.brand);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-[#2B353E] transition-colors group"
                    >
                      {/* Photo Thumbnail */}
                      <td className="py-2 px-3">
                        {productImg ? (
                          <button
                            type="button"
                            onClick={() => setPreviewProduct({ ...product, imageUrl: productImg })}
                            className="w-10 h-10 rounded-lg overflow-hidden bg-[#1A1F26] border border-[#3A4750] flex items-center justify-center flex-shrink-0 relative group/img hover:border-[#F6C90E] transition-all cursor-zoom-in"
                            title="ดูรูปภาพขนาดใหญ่"
                          >
                            <img
                              src={productImg}
                              alt={product.name || 'สินค้า'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#1A1F26] border border-[#3A4750] flex items-center justify-center text-[#A0ABB5]">
                            <Package className="w-4 h-4 opacity-40" />
                          </div>
                        )}
                      </td>

                      {/* Barcode / SKU */}
                      <td className="py-2 px-3 font-mono text-[11px] text-[#A0ABB5] whitespace-nowrap">
                        {product.barcode ? (
                          <span className="text-[#F6C90E] font-medium">{product.barcode}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Name / Spec */}
                      <td className="py-2 px-3">
                        <div className="font-bold text-[#EEEEEE] text-xs">
                          {product.name || product.size}
                        </div>
                        {product.description && (
                          <div className="text-[11px] text-[#A0ABB5] truncate max-w-xs">
                            {product.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3 text-[#A0ABB5] text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#1A1F26] border border-[#3A4750] text-[#EEEEEE] font-medium">
                          {catName}
                        </span>
                      </td>

                      {/* Locations */}
                      <td className="py-2 px-3 text-[#A0ABB5] text-[11px] whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="block text-amber-300">หน้าร้าน: {breakdown.frontLocation || '-'}</span>
                          <span className="block text-sky-300">คลัง: {breakdown.warehouseLocation || '-'}</span>
                        </div>
                      </td>

                      {/* Selling Price */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-sm text-[#F6C90E] whitespace-nowrap">
                        ฿{(product.sellingPrice || product.price || 0).toLocaleString()}
                      </td>

                      {/* Front Qty */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-amber-300">
                          {breakdown.frontQty}
                        </span>
                      </td>

                      {/* Warehouse Qty */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-sky-300">
                          {breakdown.warehouseQty}
                        </span>
                      </td>

                      {/* Total Qty */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-[#EEEEEE]">
                          {breakdown.totalQty}
                        </span>{' '}
                        <span className="text-[10px] text-[#A0ABB5]">{unitLabel}</span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            หมด
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            เหลือน้อย
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ปกติ
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {onOpenTransferModal && (
                            <button
                              type="button"
                              onClick={() => onOpenTransferModal(product)}
                              title="โอนย้ายสต็อก"
                              className="p-1.5 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onJumpToAudit(product)}
                            title="นับสต็อก"
                            className="p-1.5 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPO(product)}
                            title="สั่งซื้อเพิ่ม (PO)"
                            className="p-1.5 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#F6C90E] border border-[#3A4750] transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTire(product)}
                            title="แก้ไขสินค้า"
                            className="p-1.5 rounded-lg bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            title="ลบสินค้า"
                            className="p-1.5 rounded-lg bg-[#1A1F26] hover:bg-rose-500/20 text-[#A0ABB5] hover:text-rose-400 border border-[#3A4750] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= 4. GALLERY VIEW (SHOW ITEMS IN A GALLERY) ================= */
        <div
          className={`grid ${
            isDesktopMode
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-4'
              : 'grid-cols-1 gap-3'
          }`}
        >
          {paginatedProducts.map((product) => {
            const breakdown = getProductStockBreakdown(product);
            const isZero =
              locationFilter === 'front'
                ? breakdown.frontQty === 0
                : locationFilter === 'warehouse'
                ? breakdown.warehouseQty === 0
                : breakdown.totalQty === 0;

            const isLow =
              locationFilter === 'front'
                ? breakdown.frontQty > 0 && breakdown.frontQty <= (product.minFrontStock || 2)
                : locationFilter === 'warehouse'
                ? breakdown.warehouseQty > 0 && breakdown.warehouseQty <= (product.minStock || 2)
                : breakdown.totalQty > 0 && breakdown.totalQty <= (product.minStock || 2);

            const unitLabel = product.unit || 'ชิ้น';
            const productImg = resolveProductImage(product);
            const catName = normalizeCategory(product.category || product.brand);

            return (
              <div
                key={product.id}
                className="bg-[#242C33] hover:bg-[#2A333C] border border-[#3A4750] hover:border-[#4E5D6A] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
              >
                {/* Top Section: Photo Header + Badges */}
                <div className="relative w-full aspect-[16/10] bg-[#1A1F26] overflow-hidden border-b border-[#3A4750]/60">
                  {productImg && productImg.trim() !== '' ? (
                    <button
                      type="button"
                      onClick={() => setPreviewProduct({ ...product, imageUrl: productImg })}
                      className="w-full h-full relative cursor-zoom-in"
                      title="แตะเพื่อดูภาพขนาดใหญ่"
                    >
                      <img
                        src={productImg}
                        alt={product.name || 'สินค้า'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="p-1.5 rounded-lg bg-black/60 text-[#F6C90E]">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#A0ABB5] bg-gradient-to-b from-[#1E242B] to-[#15191E]">
                      <Package className="w-10 h-10 opacity-30 text-[#A0ABB5]" />
                    </div>
                  )}

                  {/* Top-left: Category Chip */}
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span className="px-2 py-0.5 rounded-lg bg-[#1A1F26]/85 backdrop-blur-md text-[10px] font-semibold text-[#EEEEEE] border border-white/10 shadow-sm">
                      {catName}
                    </span>
                  </div>

                  {/* Top-right: Status Badge */}
                  <div className="absolute top-2.5 right-2.5 pointer-events-none">
                    {isZero ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-950/85 backdrop-blur-md text-[10px] font-bold text-rose-300 border border-rose-500/40 shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        หมด
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-950/85 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-amber-400/40 shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        เหลือน้อย
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-950/85 backdrop-blur-md text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        มีสต็อก
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body: Details & Stock Breakdown */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Barcode & SKU */}
                    <div className="flex items-center justify-between text-[10px] text-[#A0ABB5] font-mono">
                      {product.barcode ? (
                        <span className="inline-flex items-center gap-1 text-[#F6C90E]">
                          <ScanBarcode className="w-3 h-3" />
                          <span>{product.barcode}</span>
                        </span>
                      ) : (
                        <span>รหัสอัตโนมัติ</span>
                      )}
                      {product.unit && (
                        <span className="text-[#A0ABB5]">หน่วย: {product.unit}</span>
                      )}
                    </div>

                    {/* Product Title */}
                    <h4
                      className="text-sm font-bold text-[#EEEEEE] line-clamp-2 mt-1 min-h-[2.5rem] leading-snug group-hover:text-[#F6C90E] transition-colors"
                      title={product.name || product.size}
                    >
                      {product.name || product.size}
                    </h4>

                    {/* Retail Price */}
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold font-mono text-[#F6C90E]">
                        ฿{(product.sellingPrice || product.price || 0).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#A0ABB5]">/ {unitLabel}</span>
                    </div>

                    {/* Stock Breakdown Micro-Grid */}
                    <div className="mt-3 bg-[#1A1F26] rounded-xl p-2 border border-[#3A4750]/70 grid grid-cols-3 gap-1 text-center text-[11px] font-mono">
                      <div>
                        <span className="text-[9px] text-[#A0ABB5] block font-sans">หน้าร้าน</span>
                        <span className="font-bold text-amber-300">
                          {breakdown.frontQty}
                        </span>
                        {breakdown.frontLocation && (
                          <span className="block text-[8px] text-[#A0ABB5] truncate font-sans">
                            {breakdown.frontLocation}
                          </span>
                        )}
                      </div>
                      <div className="border-x border-[#3A4750]/60">
                        <span className="text-[9px] text-[#A0ABB5] block font-sans">คลังหลัง</span>
                        <span className="font-bold text-sky-300">
                          {breakdown.warehouseQty}
                        </span>
                        {breakdown.warehouseLocation && (
                          <span className="block text-[8px] text-[#A0ABB5] truncate font-sans">
                            {breakdown.warehouseLocation}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] text-[#A0ABB5] block font-sans">รวม</span>
                        <span className="font-bold text-[#EEEEEE]">
                          {breakdown.totalQty}
                        </span>
                        <span className="block text-[8px] text-[#A0ABB5] font-sans">
                          {unitLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Bottom Row */}
                  <div className="pt-2 border-t border-[#3A4750]/60 flex items-center justify-between gap-1 text-xs">
                    {/* Transfer Button */}
                    {onOpenTransferModal ? (
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal(product)}
                        title="โอนย้ายสต็อกระหว่างหน้าร้าน-คลัง"
                        className="px-2 py-1 rounded-lg bg-[#1A1F26] hover:bg-[#202730] border border-[#3A4750] hover:border-[#F6C90E]/60 text-[#F6C90E] text-[11px] font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>โอนย้าย</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {/* Quick Tools */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onJumpToAudit(product)}
                        title="นับสต็อกสินค้านี้"
                        className="p-1.5 text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#1A1F26] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPO(product)}
                        title="สั่งซื้อเพิ่ม (PO)"
                        className="p-1.5 text-[#A0ABB5] hover:text-[#F6C90E] hover:bg-[#1A1F26] rounded-lg transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTire(product)}
                        title="แก้ไขข้อมูลสินค้า"
                        className="p-1.5 text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#1A1F26] rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(product)}
                        title="ลบรายการนี้"
                        className="p-1.5 text-[#A0ABB5] hover:text-rose-400 hover:bg-[#1A1F26] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination & Load More */}
      {hasMore && (
        <div className="pt-2 pb-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#242C33] hover:bg-[#2E3740] border border-[#3A4750] hover:border-[#F6C90E] text-[#EEEEEE] text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            แสดงเพิ่มอีก {Math.min(PAGE_SIZE, filteredProducts.length - visibleCount)} รายการ (เหลืออีก {filteredProducts.length - visibleCount} รายการ)
          </button>
          <button
            type="button"
            onClick={() => setVisibleCount(filteredProducts.length)}
            className="text-xs text-[#A0ABB5] hover:text-[#F6C90E] underline transition-colors cursor-pointer"
          >
            แสดงทั้งหมด ({filteredProducts.length} รายการ)
          </button>
        </div>
      )}

      {/* Scroll to Top Button */}
      {paginatedProducts.length > 12 && (
        <div className="pt-2 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#242C33] hover:bg-[#2C353E] text-[#F6C90E] border border-[#3A4750] hover:border-[#F6C90E] text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>กลับขึ้นไปด้านบนสุด</span>
          </button>
        </div>
      )}

      {/* Product Photo Preview Modal */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-[#242C33] border border-amber-400/40 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] font-bold text-[#F6C90E] block">
                  {previewProduct.brand || previewProduct.category || 'อะไหล่มอเตอร์ไซค์'}
                </span>
                <h4 className="text-sm font-bold text-[#EEEEEE] truncate">
                  {previewProduct.name || previewProduct.size}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-full bg-[#1A1F26] text-[#A0ABB5] hover:text-[#EEEEEE] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#1A1F26] border border-[#3A4750] flex items-center justify-center relative shadow-inner">
              <img
                src={previewProduct.imageUrl}
                alt={previewProduct.name || 'สินค้า'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#3A4750]">
              <div className="space-y-0.5">
                <span className="text-[#A0ABB5] block text-[11px]">รหัสบาร์โค้ด:</span>
                <span className="font-mono text-[#F6C90E] font-semibold">{previewProduct.barcode || '-'}</span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[#A0ABB5] block text-[11px]">ราคาขายปลีก:</span>
                <span className="font-mono text-[#F6C90E] font-bold text-sm">
                  ฿{(previewProduct.sellingPrice || previewProduct.price || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setProductToDelete(null)}
        >
          <div
            className="bg-[#242C33] border border-rose-500/50 rounded-2xl max-w-sm w-full p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5 flex-shrink-0" />
              <h4 className="text-sm font-bold text-[#EEEEEE]">ยืนยันการลบสินค้า</h4>
            </div>
            <p className="text-xs text-[#A0ABB5]">
              คุณต้องการลบรายการ <strong className="text-[#EEEEEE]">{productToDelete.name || productToDelete.size}</strong> ออกจากระบบใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3A4750]">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3 py-1.5 rounded-xl bg-[#1A1F26] hover:bg-[#202730] text-[#A0ABB5] text-xs font-semibold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTire(productToDelete);
                  setProductToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
