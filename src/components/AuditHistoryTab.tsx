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
} from 'lucide-react';
import { AuditLog, AuditSession } from '../types';

interface AuditHistoryTabProps {
  logs: AuditLog[];
  sessions: AuditSession[];
}

export const AuditHistoryTab: React.FC<AuditHistoryTabProps> = ({ logs, sessions }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter((log) => {
    return (
      log.tireName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.note && log.note.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['วันที่เวลา', 'ขนาดยาง', 'แบรนด์', 'ยอดก่อนหน้า', 'ยอดนับใหม่', 'ผลต่าง', 'การกระทำ', 'หมายเหตุ'];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toLocaleString('th-TH'),
      `"${l.tireName}"`,
      `"${l.brand}"`,
      l.previousQty,
      l.newQty,
      l.diff,
      `"${l.action}"`,
      `"${l.note || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-28 pt-2 px-3 space-y-3.5 max-w-md mx-auto">
      {/* 1. Top Header */}
      <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                ประวัติการตรวจนับสต็อก (Real-time Logs)
              </h2>
              <p className="text-[11px] text-slate-400">
                บันทึกการปรับปรุงยอดนับจริงใน Firebase
              </p>
            </div>
          </div>

          <button
            onClick={exportCSV}
            title="ส่งออกรายงาน CSV"
            className="p-2 rounded-xl bg-[#1b2b46] hover:bg-[#25395c] text-cyan-300 border border-slate-700 active:scale-95 transition-all"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>

        {/* Sessions Summary Horizontal */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-300">รอบการตรวจล่าสุด</div>
          {sessions.slice(0, 2).map((s) => (
            <div
              key={s.id}
              className="bg-[#162338] border border-slate-750 rounded-xl p-2.5 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-slate-100 flex items-center gap-2">
                  <span>{s.code}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    {s.zone}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.title}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">นับแล้ว</span>
                <span className="font-bold font-mono text-amber-400">
                  {s.checkedItems} / {s.totalItems}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Search Logs */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาประวัติการนับ..."
          className="w-full bg-[#142033] text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-750 focus:outline-none focus:border-amber-400/80"
        />
      </div>

      {/* 3. Realtime Logs Stream */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            ยังไม่มีประวัติการปรับปรุงที่ตรงกับคำค้นหา
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isMatch = log.diff === 0;
            const isPlus = log.diff > 0;

            return (
              <div
                key={log.id}
                className="bg-[#131e31] border border-slate-800/80 rounded-2xl p-3 shadow-sm flex items-start gap-3"
              >
                {/* Icon indicator */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isMatch
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                      : isPlus
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isMatch ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-100 truncate">
                      {log.tireName}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {log.action}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/50">
                    <span>
                      ระบบ: {log.previousQty} ➔ นับจริง:{' '}
                      <span className="font-bold text-amber-400">{log.newQty}</span>
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isMatch ? 'text-emerald-400' : isPlus ? 'text-amber-400' : 'text-rose-400'
                      }`}
                    >
                      {log.diff > 0 ? `+${log.diff}` : log.diff} เส้น
                    </span>
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
