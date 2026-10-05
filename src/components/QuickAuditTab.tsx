import React, { useState, useMemo } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  CheckCircle2,
  Clock,
  MoreVertical,
  CloudUpload,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { TireItem, AuditSession } from '../types';

interface QuickAuditTabProps {
  tires: TireItem[];
  activeSession: AuditSession | null;
  onUpdateQty: (tire: TireItem, newQty: number) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onSaveAudit: () => void;
  onEditTire: (tire: TireItem) => void;
  onDeleteTire?: (tire: TireItem) => void;
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
  onRestoreInitialData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [selectedRim, setSelectedRim] = useState('ทุกขอบ');
  const [activeMenuTireId, setActiveMenuTireId] = useState<string | null>(null);

  // Available brands and rims
  const brands = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  const rims = ['ทุกขอบ', '10"', '12"', '13"', '14"', '15"', '16"', '17"'];

  // Filter tires
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
      const cleanRim = selectedRim.replace('"', '');
      const matchRim = selectedRim === 'ทุกขอบ' || tire.rim === cleanRim;

      return matchSearch && matchBrand && matchRim;
    });
  }, [tires, searchQuery, selectedBrand, selectedRim]);

  // Calculations for stats
  const totalCount = tires.length;
  const checkedTires = tires.filter((t) => t.status === 'checked');
  const checkedCount = checkedTires.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Remaining to check in units (pieces)
  const remainingPieces = tires
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.systemQty || 0), 0);

  // Matched vs Discrepancies
  const exactMatchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const modifiedCount = tires.filter((t) => t.status === 'checked' || t.status === 'discrepancy').length;

  return (
    <div className="pb-32 pt-2 px-3 space-y-3 max-w-md mx-auto">
      {/* 1. Audit Progress & Search Header Card */}
      <div className="bg-[#121c2e] border border-slate-800/90 rounded-2xl p-3.5 shadow-md">
        {/* Title & Progress Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <h2 className="text-sm font-semibold text-amber-300">
              นับสต็อกด่วน (Quick Audit)
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {checkedCount} / {totalCount} รายการ ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3.5 flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสยาง, ขนาด, แบรนด์"
              className="w-full bg-[#18263d] text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-700/60 focus:outline-none focus:border-amber-400/80 transition-all"
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
            className="px-2.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-medium flex items-center gap-1 active:scale-95 transition-all flex-shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มขนาดยาง</span>
          </button>
        </div>
      </div>

      {/* 2. Brand Filters Horizontal Scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {brands.map((brand) => {
          const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase();
          return (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                  : 'bg-[#152236] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {brand}
            </button>
          );
        })}
      </div>

      {/* 3. Rim Filters (ขอบล้อ) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <span className="text-slate-400 font-medium pl-1 flex-shrink-0">ขอบล้อ:</span>
        {rims.map((rim) => {
          const isSelected = selectedRim === rim;
          return (
            <button
              key={rim}
              onClick={() => setSelectedRim(rim)}
              className={`px-2.5 py-0.5 rounded-md font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#1e3a5f] text-cyan-300 border border-cyan-500/50 font-semibold'
                  : 'bg-[#121c2d] text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {rim}
            </button>
          );
        })}
      </div>

      {/* 4. Zone Header Card */}
      <div className="bg-gradient-to-r from-[#142136] to-[#121b2d] border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-slate-100">
              โซน: ห้องยางชั้น 2
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {activeSession?.code || 'AUD-2410-09'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            คลังยางเรเดียล Tubeless • รอบเช้า
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block">คงเหลือตรวจ</span>
          <span className="text-xl font-extrabold text-amber-400 leading-none">
            {remainingPieces}{' '}
            <span className="text-xs font-normal text-amber-200/80">เส้น</span>
          </span>
        </div>
      </div>

      {/* 5. Tire Audit List */}
      <div className="space-y-2.5">
        {filteredTires.length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-8 text-center">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-medium">ไม่พบขนาดยางที่ค้นหา</p>
            <p className="text-slate-500 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดเพิ่มขนาดยางใหม่</p>
            <button
              onClick={onOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-semibold hover:bg-amber-400 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่มขนาดยางในระบบ
            </button>
          </div>
        ) : (
          filteredTires.map((tire) => {
            const isMatch = tire.actualQty === tire.systemQty;
            const diff = tire.actualQty - tire.systemQty;
            const isChecked = tire.status === 'checked';

            return (
              <div
                key={tire.id}
                className="bg-[#131e31] hover:bg-[#15233a] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm transition-all relative overflow-hidden"
              >
                {/* Top Row: Brand & Size + Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
                        <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                          {tire.brand} {tire.size}
                        </h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1b2b46] text-blue-300 border border-blue-500/30">
                          {tire.rim}&quot;
                        </span>
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

                      {/* Subtitle: System quantity & location */}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-300 font-medium">
                          ระบบ: {tire.systemQty} เส้น
                        </span>
                        <span>•</span>
                        <span>{tire.location}</span>
                        {tire.description && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 truncate max-w-[150px]">
                              {tire.description}
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
                          setActiveMenuTireId(activeMenuTireId === tire.id ? null : tire.id)
                        }
                        className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuTireId === tire.id && (
                        <div className="absolute right-0 top-6 z-20 w-36 bg-[#1a2942] border border-slate-700 rounded-xl shadow-xl py-1 text-xs text-slate-200">
                          <button
                            onClick={() => {
                              onEditTire(tire);
                              setActiveMenuTireId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/60 flex items-center justify-between"
                          >
                            <span>แก้ไขข้อมูล</span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            onClick={() => {
                              onUpdateQty(tire, tire.systemQty);
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
                                onDeleteTire(tire);
                                setActiveMenuTireId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-rose-950/40 flex items-center justify-between text-rose-400 border-t border-slate-700/60"
                            >
                              <span>ลบรายการยาง</span>
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
                      onClick={() => onUpdateQty(tire, Math.max(0, tire.actualQty - 1))}
                      aria-label="ลดจำนวน"
                      className="w-9 h-8 rounded-xl bg-[#1c2c47] hover:bg-[#25395c] active:bg-[#15233a] border border-slate-700/60 text-slate-200 font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-sm"
                    >
                      −
                    </button>

                    <span className="min-w-[32px] text-center font-bold text-lg text-amber-400 font-mono">
                      {tire.actualQty}
                    </span>

                    <button
                      onClick={() => onUpdateQty(tire, tire.actualQty + 1)}
                      aria-label="เพิ่มจำนวน"
                      className="w-9 h-8 rounded-xl bg-[#1c2c47] hover:bg-[#25395c] active:bg-[#15233a] border border-slate-700/60 text-slate-200 font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-sm"
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

      {/* 6. Floating Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-20 px-3 py-2 pointer-events-none">
        <div className="max-w-md mx-auto bg-[#0f192b]/95 backdrop-blur-md border border-slate-750/90 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between pointer-events-auto">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              ปรับปรุงแล้ว:{' '}
              <span className="text-amber-400 font-mono font-bold">
                {modifiedCount}
              </span>{' '}
              รายการ
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span>สต็อกตรง {exactMatchedCount} รายการ</span>
              <span>•</span>
              <span className={discrepancyCount > 0 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                คลาดเคลื่อน {discrepancyCount}
              </span>
            </div>
          </div>

          <button
            onClick={onSaveAudit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
          >
            <CloudUpload className="w-4 h-4" />
            <span>บันทึกผลการนับ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
