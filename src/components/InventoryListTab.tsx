import React, { useState, useMemo } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ShoppingCart,
  Layers,
  ChevronRight,
  Archive,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { TireItem } from '../types';

interface InventoryListTabProps {
  tires: TireItem[];
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onEditTire: (tire: TireItem) => void;
  onDeleteTire: (tire: TireItem) => void;
  onJumpToAudit: (tire: TireItem) => void;
  onOpenPO: (tire: TireItem) => void;
  onOpenBatchPO: (selectedTires: TireItem[]) => void;
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
  onRestoreInitialData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Available brands
  const brands = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  // Total statistics
  const totalModels = tires.length;
  const availablePieces = tires.reduce((acc, t) => acc + (t.actualQty > 0 ? t.actualQty : 0), 0);
  const needOrderModels = tires.filter((t) => t.actualQty <= (t.minStock || 2)).length;
  const coveragePercent =
    totalModels > 0
      ? Math.round(((totalModels - tires.filter((t) => t.actualQty === 0).length) / totalModels) * 100)
      : 0;

  // Filtered tires
  const filteredTires = useMemo(() => {
    return tires.filter((tire) => {
      const matchSearch =
        (tire.size || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tire.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tire.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tire.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchBrand =
        selectedBrand === 'ทั้งหมด' ||
        (tire.brand || '').toLowerCase() === selectedBrand.toLowerCase();

      let matchStock = true;
      if (stockFilter === 'in_stock') {
        matchStock = (tire.actualQty || 0) > 2;
      } else if (stockFilter === 'low_stock') {
        matchStock = (tire.actualQty || 0) >= 1 && (tire.actualQty || 0) <= 2;
      } else if (stockFilter === 'out_of_stock') {
        matchStock = (tire.actualQty || 0) === 0;
      }

      return matchSearch && matchBrand && matchStock;
    });
  }, [tires, searchQuery, selectedBrand, stockFilter]);

  // Group tires by brand
  const groupedByBrand = useMemo(() => {
    const groups: { [brand: string]: TireItem[] } = {};
    filteredTires.forEach((tire) => {
      const b = tire.brand.toUpperCase();
      if (!groups[b]) groups[b] = [];
      groups[b].push(tire);
    });
    return groups;
  }, [filteredTires]);

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
    <div className="pb-36 pt-2 px-3 space-y-3 max-w-md mx-auto">
      {/* 1. Tubeless Overview Header Card */}
      <div className="bg-[#121c2e] border border-slate-800/90 rounded-2xl p-3.5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-xs font-semibold text-slate-100">
              ภาพรวมสต็อก Tubeless
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            ทั้งหมด {totalModels} รายการ
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Total Models */}
          <div className="bg-[#16243a] border border-slate-750 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-2xl font-black text-slate-100 font-mono leading-none">
              {totalModels}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">รุ่นทั้งหมด</div>
          </div>

          {/* Available */}
          <div className="bg-[#16243a] border border-slate-750 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-2xl font-black text-emerald-400 font-mono leading-none">
              {availablePieces}
            </div>
            <div className="text-[10px] text-emerald-400/90 mt-1 font-medium">พร้อมจ่าย (เส้น)</div>
          </div>

          {/* Low / Need Order */}
          <div className="bg-[#16243a] border border-slate-750 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-2xl font-black text-rose-400 font-mono leading-none">
              {needOrderModels}
            </div>
            <div className="text-[10px] text-rose-400/90 mt-1 font-medium">ต้องสั่งเพิ่ม</div>
          </div>
        </div>

        {/* Coverage Bar */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
          <span>ความพร้อมจ่ายในคลัง</span>
          <span className="text-emerald-400 font-semibold">{coveragePercent}% ครอบคลุม</span>
        </div>
      </div>

      {/* 2. Search & Action Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาแบรนด์, เบอร์ยาง"
            className="w-full bg-[#142033] text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-750 focus:outline-none focus:border-amber-400/80 transition-all"
          />
        </div>

        <button
          onClick={onOpenScanner}
          title="สแกนบาร์โค้ด"
          className="p-2 bg-[#1b2b46] hover:bg-[#23385c] text-cyan-300 rounded-xl border border-slate-700/60 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
        >
          <ScanBarcode className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenAddModal}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all flex-shrink-0 shadow-md shadow-amber-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่มยาง</span>
        </button>
      </div>

      {/* 3. Stock Level Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <button
          onClick={() => setStockFilter('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition-all font-medium ${
            stockFilter === 'all'
              ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
              : 'bg-[#152236] text-slate-300 border border-slate-800'
          }`}
        >
          ทั้งหมด ({totalModels})
        </button>

        <button
          onClick={() => setStockFilter('in_stock')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 font-medium ${
            stockFilter === 'in_stock'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'bg-[#152236] text-emerald-400 border border-emerald-900/40'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>มีสินค้า (&gt;2)</span>
        </button>

        <button
          onClick={() => setStockFilter('low_stock')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 font-medium ${
            stockFilter === 'low_stock'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'bg-[#152236] text-amber-400 border border-amber-900/40'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>ใกล้หมด (1-2)</span>
        </button>

        <button
          onClick={() => setStockFilter('out_of_stock')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 font-medium ${
            stockFilter === 'out_of_stock'
              ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
              : 'bg-[#152236] text-rose-400 border border-rose-900/40'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>หมด (0)</span>
        </button>
      </div>

      {/* 4. Brand Filter Tags */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <span className="text-slate-400 font-medium pl-1 flex-shrink-0">แบรนด์:</span>
        {brands.map((brand) => {
          const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase();
          return (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-2.5 py-0.5 rounded-md font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#1e3a5f] text-cyan-300 border border-cyan-500/50 font-semibold'
                  : 'bg-[#121c2d] text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {brand}
            </button>
          );
        })}
      </div>

      {/* 5. Grouped Items List by Brand */}
      <div className="space-y-4">
        {tires.length === 0 ? (
          <div className="bg-[#121c2e] border border-amber-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-200 text-sm font-bold">ยังไม่มีข้อมูลสินค้าในคลัง</p>
              <p className="text-slate-400 text-xs mt-1">สามารถกดกู้คืนรายการยางมาตรฐานห้องยางชั้น 2 (80 รุ่น) กลับคืนมาได้ทันที</p>
            </div>
            {onRestoreInitialData && (
              <button
                onClick={onRestoreInitialData}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg active:scale-95 transition-all inline-flex items-center gap-2"
              >
                <span>🔄 กู้คืนข้อมูลยางเริ่มต้น 80 รายการ</span>
              </button>
            )}
          </div>
        ) : Object.keys(groupedByBrand).length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <Archive className="w-10 h-10 text-slate-600 mx-auto mb-1" />
            <p className="text-slate-300 text-sm font-medium">ไม่พบรายการยางที่ตรงกับเงื่อนไข</p>
            <p className="text-slate-500 text-xs">พบยางในระบบทั้งหมด {tires.length} รายการ แต่อาจถูกกรองออก</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedBrand('ทั้งหมด');
                setStockFilter('all');
              }}
              className="mt-2 px-3 py-1.5 bg-[#1b2b44] hover:bg-[#24395b] text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold inline-block"
            >
              ล้างตัวกรองทั้งหมด ({tires.length} รายการ)
            </button>
          </div>
        ) : (
          Object.entries(groupedByBrand).map(([brandName, items]) => (
            <div key={brandName} className="space-y-2">
              {/* Brand Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <h3 className="text-xs font-bold text-slate-200 tracking-wider">
                    {brandName}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {items.length} รุ่น
                </span>
              </div>

              {/* Items in this brand */}
              <div className="space-y-2">
                {items.map((tire) => {
                  const isZero = tire.actualQty === 0;
                  const isLow = tire.actualQty > 0 && tire.actualQty <= 2;
                  const isSelected = selectedIds.has(tire.id);

                  return (
                    <div
                      key={tire.id}
                      className={`bg-[#131e31] hover:bg-[#16233a] border rounded-2xl p-3.5 shadow-sm transition-all relative ${
                        isSelected
                          ? 'border-amber-400/80 bg-[#192742]'
                          : 'border-slate-800/80'
                      }`}
                    >
                      {/* Top Row: Title, Badge, Edit/Trash */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {isMultiSelectMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(tire.id)}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-850 border-slate-700 focus:ring-0 flex-shrink-0"
                            />
                          )}

                          {tire.imageUrl && (
                            <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 flex-shrink-0 flex items-center justify-center shadow-inner">
                              <img
                                src={tire.imageUrl}
                                alt={`${tire.brand} ${tire.size}`}
                                className="w-full h-full object-cover"
                                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-100">
                                {tire.size}
                              </h4>
                              {tire.isOem && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-600/40">
                                  {tire.oemLabel || 'OEM ศูนย์'}
                                </span>
                              )}
                              {tire.barcode && (
                                <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <ScanBarcode className="w-2.5 h-2.5" />
                                  <span>{tire.barcode}</span>
                                </span>
                              )}
                            </div>
                            {/* Subtitle / Vehicle description */}
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {tire.description || `${tire.brand} ขอบ ${tire.rim} นิ้ว`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                          {/* Stock Quantity Badge */}
                          {isZero ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              <span>หมด (0)</span>
                            </span>
                          ) : isLow ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span>{tire.actualQty} เส้น</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>{tire.actualQty} เส้น</span>
                            </span>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => onEditTire(tire)}
                            title="แก้ไขข้อมูลยาง"
                            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => onDeleteTire(tire)}
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
                            {tire.zone || 'ห้องยางชั้น 2'} • {tire.location}
                          </span>
                        </div>

                        {/* Action: Open PO if zero stock, else นับสต็อก */}
                        {isZero ? (
                          <button
                            onClick={() => onOpenPO(tire)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-sm"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>เปิด PO</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onJumpToAudit(tire)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#1b2b46] hover:bg-[#25395c] text-slate-200 border border-slate-700/60 font-medium text-xs active:scale-95 transition-all"
                          >
                            <span>📝</span>
                            <span>นับสต็อก</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 6. Bottom Floating Bar for Inventory Screen */}
      <div className="fixed bottom-16 left-0 right-0 z-20 px-3 py-2 pointer-events-none">
        <div className="max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
          {/* Multi-Select Toggle / Batch Action */}
          <button
            onClick={() => {
              if (isMultiSelectMode && selectedIds.size > 0) {
                handleBatchPOAction();
              } else {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) setSelectedIds(new Set());
              }
            }}
            className={`flex-1 py-2.5 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg backdrop-blur-md transition-all active:scale-95 ${
              isMultiSelectMode && selectedIds.size > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
                : isMultiSelectMode
                ? 'bg-[#1e2f4a] text-cyan-300 border-cyan-500/50'
                : 'bg-[#131e31]/95 text-slate-200 hover:text-white border-slate-700/80'
            }`}
          >
            <span>⚑</span>
            <span>
              {isMultiSelectMode && selectedIds.size > 0
                ? `เปิด PO รวม (${selectedIds.size})`
                : isMultiSelectMode
                ? 'ยกเลิกการเลือก'
                : 'เลือกหลายรายการ'}
            </span>
          </button>

          {/* Add Tire Button */}
          <button
            onClick={onOpenAddModal}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-400/20 active:scale-95 transition-all"
          >
            <span>⊕</span>
            <span>เพิ่มขนาดยาง</span>
          </button>
        </div>
      </div>
    </div>
  );
};
