import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  TrendingDown,
  ShoppingCart,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { ProductItem } from '../types';
import { getStockAdviceWithGeminiFlash, StockAdvisorResponse, runGeminiSelfTest, GeminiSelfTestResponse } from '../utils/geminiClient';

interface GeminiStockAdvisorCardProps {
  tires: ProductItem[];
}

export const GeminiStockAdvisorCard: React.FC<GeminiStockAdvisorCardProps> = ({ tires }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<StockAdvisorResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagInfo, setDiagInfo] = useState<GeminiSelfTestResponse | null>(null);

  const handleRunAdvice = async (mode: 'overview' | 'reorder' | 'discrepancy' | 'query', customPrompt?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await getStockAdviceWithGeminiFlash(tires, customPrompt || prompt, mode);
      setResponse(result);
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการประมวลผล Gemini Flash');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = () => {
    if (!response?.analysis) return;
    navigator.clipboard.writeText(response.analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-[#3A4750] border border-[#F6C90E]/30 rounded-2xl p-4 shadow-lg space-y-3 font-['Prompt',sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-[#F6C90E] text-[#252C33] flex items-center justify-center font-bold shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-[#EEEEEE]">
                Gemini Flash AI ผู้ช่วยคลังสินค้า
              </h3>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ออนไลน์
              </span>
            </div>
            <p className="text-[11px] text-[#A0ABB5]">
              วิเคราะห์สต็อก คำนวณสั่งซื้อ แนะนำโปรโมชั่น ตอบคำถามอัตโนมัติ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            setIsDiagnosing(true);
            try {
              const res = await runGeminiSelfTest();
              setDiagInfo(res);
            } catch (e: any) {
              setErrorMsg(e?.message);
            } finally {
              setIsDiagnosing(false);
            }
          }}
          disabled={isDiagnosing}
          className="px-2 py-1 bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] text-[#F6C90E] rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
        >
          {isDiagnosing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>{diagInfo ? '✓ AI พร้อม 100%' : 'ทดสอบ AI'}</span>
        </button>
      </div>

      {diagInfo && (
        <div className="bg-[#20262D] border border-emerald-500/40 rounded-xl p-2 text-[10px] text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span>✓ ระบบ AI ทำงานปกติ: ตอบข้อความ ({diagInfo.results.textGeneration?.durationMs || 0}ms) • ถอดรหัส JSON ({diagInfo.results.jsonSchema?.durationMs || 0}ms)</span>
          <button onClick={() => setDiagInfo(null)} className="text-[#A0ABB5] hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => handleRunAdvice('overview')}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] text-[#EEEEEE] text-[11px] font-medium flex flex-col items-center gap-1 text-center transition-all active:scale-95 disabled:opacity-50"
        >
          <Lightbulb className="w-4 h-4 text-[#F6C90E]" />
          <span>วิเคราะห์ภาพรวม</span>
        </button>

        <button
          onClick={() => handleRunAdvice('reorder')}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] text-[#EEEEEE] text-[11px] font-medium flex flex-col items-center gap-1 text-center transition-all active:scale-95 disabled:opacity-50"
        >
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          <span>คำนวณสั่งซื้อ (PO)</span>
        </button>

        <button
          onClick={() => handleRunAdvice('discrepancy')}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#252C33] hover:bg-[#2C353E] border border-[#475662] text-[#EEEEEE] text-[11px] font-medium flex flex-col items-center gap-1 text-center transition-all active:scale-95 disabled:opacity-50"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>ยอดไม่ตรงระบบ</span>
        </button>
      </div>

      {/* Free-form Custom Prompt Input */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim() && !isLoading) {
              handleRunAdvice('query', prompt);
            }
          }}
          placeholder="ถาม AI เช่น 'ยางเบอร์ไหนควรจัดโปร?', 'สรุปส่งไลน์ให้เถ้าแก่'"
          className="flex-1 bg-[#252C33] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-2 text-xs focus:border-[#F6C90E] focus:outline-none"
        />
        <button
          onClick={() => prompt.trim() && handleRunAdvice('query', prompt)}
          disabled={isLoading || !prompt.trim()}
          className="px-3 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-[#252C33] border border-[#475662] text-center space-y-2">
          <Loader2 className="w-6 h-6 text-[#F6C90E] animate-spin mx-auto" />
          <div className="text-xs font-bold text-[#EEEEEE]">
            Gemini Flash กำลังประมวลผลข้อมูลคลังสินค้า...
          </div>
          <div className="text-[10px] text-[#A0ABB5]">
            วิเคราะห์ระดับสต็อก อัตราการเคลื่อนไหว และร่างข้อแนะนำ
          </div>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* AI Result Card */}
      {response?.analysis && !isLoading && (
        <div className="bg-[#252C33] border border-[#475662] rounded-xl p-3 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#3A4750]">
            <span className="flex items-center gap-1 font-bold text-[#F6C90E]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ผลการวิเคราะห์จาก {response.model}</span>
            </span>
            <span className="text-[#A0ABB5] font-mono text-[10px]">
              ⏱️ {Math.round(response.durationMs)} ms
            </span>
          </div>

          {/* Formatted Text */}
          <div className="text-xs text-[#EEEEEE] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto space-y-1 pr-1 font-sans">
            {response.analysis}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#3A4750]">
            <button
              onClick={handleCopyText}
              className="px-2.5 py-1.5 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] text-[11px] font-medium flex items-center gap-1 border border-[#475662] active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span className="text-[#F6C90E] font-bold">คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span>คัดลอกข้อความ (ส่ง LINE)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
