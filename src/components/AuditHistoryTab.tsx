import React, { useState } from 'react';
import {
  History,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  FileDown,
  Clock,
  Search,
  Sparkles,
  PackagePlus,
  ArrowDownToLine,
  Filter,
  Tag,
} from 'lucide-react';
import { AuditLog, AuditSession } from '../types';

interface AuditHistoryTabProps {
  logs: AuditLog[];
  sessions: AuditSession[];
}

type HistoryFilterType = 'all' | 'new_product' | 'stock_in' | 'audit';

export const AuditHistoryTab: React.FC<AuditHistoryTabProps> = ({ logs, sessions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<HistoryFilterType>('all');

  const filteredLogs = logs.filter((log) => {
    const action = log.action || '';
    if (filterType === 'new_product') {
      if (!action.includes('เพิ่มสินค้า')) return false;
    } else if (filterType === 'stock_in') {
      if (!action.includes('รับเข้า') && !action.includes('บิล')) return false;
    } else if (filterType === 'audit') {
      if (action.includes('เพิ่มสินค้า') || action.includes('รับเข้า')) return false;
    }

    const name = (log.productName || log.tireName || '').toLowerCase();
    const brand = (log.brand || '').toLowerCase();
    const actionText = action.toLowerCase();
    const note = (log.note || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    return (
      name.includes(term) ||
      brand.includes(term) ||
      actionText.includes(term) ||
      note.includes(term)
    );
  });

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['วันที่เวลา', 'ชื่อสินค้า/อะไหล่', 'แบรนด์', 'ยอดก่อนหน้า', 'ยอดนับใหม่', 'ผลต่าง', 'การกระทำ', 'หมายเหตุ'];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toLocaleString('th-TH'),
      `"${l.productName || l.tireName || 'สินค้า'}"`,
      `"${l.brand || ''}"`,
      l.previousQty,
      l.newQty,
      l.diff,
      `"${l.action}"`,
      `"${l.note || ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `history_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const newProductCount = logs.filter((l) => (l.action || '').includes('เพิ่มสินค้า')).length;
  const stockInCount = logs.filter((l) => (l.action || '').includes('รับเข้า') || (l.action || '').includes('บิล')).length;

  return (
    <div className="pb-28 pt-2 px-3 space-y-3.5 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* 1. Top Header */}
      <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#252C33] text-[#F6C90E] border border-[#475662]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#EEEEEE]">
                ประวัติการเพิ่มสินค้า & ตรวจนับสต็อก
              </h2>
              <p className="text-[11px] text-[#A0ABB5]">
                บันทึกประวัติการเพิ่มสินค้าใหม่ รับเข้าสต็อก และการตรวจนับจริง
              </p>
            </div>
          </div>

          <button
            onClick={exportCSV}
            title="ส่งออกรายงาน CSV"
            className="p-2 rounded-xl bg-[#252C33] hover:bg-[#2C353E] text-[#F6C90E] border border-[#475662] active:scale-95 transition-all shadow-sm flex items-center gap-1 text-xs"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">CSV</span>
          </button>
        </div>

        {/* Sessions Summary Horizontal */}
        <div className="space-y-1.5 pt-2 border-t border-[#475662]">
          <div className="text-[11px] font-semibold text-[#A0ABB5]">รอบการตรวจล่าสุด</div>
          {sessions.slice(0, 2).map((s) => (
            <div
              key={s.id}
              className="bg-[#252C33] border border-[#475662] rounded-xl p-2.5 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-[#EEEEEE] flex items-center gap-2">
                  <span>{s.code}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#3A4750] text-[#F6C90E] border border-[#475662]">
                    {s.zone}
                  </span>
                </div>
                <div className="text-[10px] text-[#A0ABB5] mt-0.5">{s.title}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#A0ABB5] block">นับแล้ว</span>
                <span className="font-bold font-mono text-[#F6C90E]">
                  {s.checkedItems} / {s.totalItems}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Filter Pills & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-[#F6C90E] text-slate-950 font-bold shadow-sm'
                : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662]'
            }`}
          >
            ทั้งหมด ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('new_product')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
              filterType === 'new_product'
                ? 'bg-emerald-400 text-slate-950 font-bold shadow-sm'
                : 'bg-[#252C33] text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ เพิ่มสินค้าใหม่ ({newProductCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('stock_in')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
              filterType === 'stock_in'
                ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                : 'bg-[#252C33] text-sky-400 border border-sky-500/40 hover:bg-sky-500/10'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>📥 รับเข้าสต็อก/บิล ({stockInCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'audit'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662]'
            }`}
          >
            🔍 ตรวจนับสต็อก
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า, แบรนด์, หรือการกระทำ..."
            className="w-full bg-[#252C33] text-[#EEEEEE] placeholder-[#A0ABB5] text-xs rounded-xl pl-9 pr-3 py-2 border border-[#475662] focus:outline-none focus:border-[#F6C90E]"
          />
        </div>
      </div>

      {/* 3. Realtime Logs Stream */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-8 text-center text-[#A0ABB5] text-xs">
            <Clock className="w-8 h-8 text-[#A0ABB5] mx-auto mb-2" />
            ยังไม่มีประวัติการเพิ่มสินค้าหรือปรับปรุงที่ตรงกับเงื่อนไข
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isNewProduct = (log.action || '').includes('เพิ่มสินค้า');
            const isStockIn = (log.action || '').includes('รับเข้า') || (log.action || '').includes('บิล');
            const isEdit = (log.action || '').includes('แก้ไข');
            const isMatch = log.diff === 0;
            const isPlus = log.diff > 0;

            return (
              <div
                key={log.id}
                className="bg-[#3A4750] border border-[#475662] rounded-2xl p-3 shadow-sm flex items-start gap-3 transition-all hover:border-[#F6C90E]/40"
              >
                {/* Icon indicator */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isNewProduct
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isStockIn
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : isEdit
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isMatch
                      ? 'bg-[#252C33] text-emerald-400 border border-emerald-500/30'
                      : isPlus
                      ? 'bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40'
                      : 'bg-[#252C33] text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {isNewProduct ? (
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  ) : isStockIn ? (
                    <ArrowDownToLine className="w-4 h-4 text-sky-400" />
                  ) : isEdit ? (
                    <Tag className="w-4 h-4 text-amber-400" />
                  ) : isMatch ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle
                      className={`w-4 h-4 ${isPlus ? 'text-[#F6C90E]' : 'text-rose-400'}`}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-bold text-xs text-[#EEEEEE] truncate">
                      {log.productName || log.tireName || 'สินค้า'}
                    </div>
                    <span className="text-[10px] text-[#A0ABB5] flex items-center gap-1 font-mono shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isNewProduct
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isStockIn
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : isEdit
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : isMatch
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {log.action}
                    </span>
                    {log.brand && (
                      <span className="text-[10px] text-[#A0ABB5]">
                        แบรนด์: <strong className="text-[#EEEEEE]">{log.brand}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono">
                    <span className="text-[#A0ABB5] text-[11px]">
                      ก่อน: <strong className="text-[#EEEEEE]">{log.previousQty}</strong>
                    </span>
                    <span className="text-[#A0ABB5]">➔</span>
                    <span className="text-[#A0ABB5] text-[11px]">
                      ใหม่: <strong className="text-[#F6C90E]">{log.newQty}</strong>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                        isNewProduct
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isStockIn || isPlus
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : isMatch
                          ? 'bg-[#252C33] text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#252C33] text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {isPlus ? `+${log.diff}` : log.diff}
                    </span>
                  </div>

                  {log.note && (
                    <div className="text-[10px] text-[#A0ABB5] mt-1 italic bg-[#252C33] p-1.5 rounded-lg border border-[#475662]">
                      📝 {log.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
