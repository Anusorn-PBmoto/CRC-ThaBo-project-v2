import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Search,
  X,
  Loader2,
  Volume2,
  CheckCircle,
  Tag,
  Warehouse,
  Store,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { ProductItem } from '../types';
import { searchVoiceWithGeminiFlash, VoiceSearchResult } from '../utils/geminiClient';
import { resolveProductImage } from '../utils/productImages';

interface GeminiVoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onApplySearchText?: (query: string) => void;
}

export const GeminiVoiceSearchModal: React.FC<GeminiVoiceSearchModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSelectProduct,
  onApplySearchText,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceSearchResult | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  // Initialize SpeechRecognition if available in browser
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  // Reset states when opened or closed
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setErrorMsg(null);
      setResult(null);
      setIsListening(false);
    } else {
      stopListening();
    }
  }, [isOpen, stopListening]);

  if (!isOpen) return null;

  const startListening = () => {
    setErrorMsg(null);
    setResult(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('เบราว์เซอร์นี้ไม่รองรับ Web Speech API (แนะนำให้ใช้ Google Chrome)');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'th-TH'; // Thai language recognition
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('กรุณาอนุญาตการเข้าถึงไมโครโฟนในการตั้งค่าเบราว์เซอร์');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`เกิดข้อผิดพลาดในการรับเสียง: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed starting speech recognition:', err);
      setErrorMsg('ไม่สามารถเปิดใช้งานไมโครโฟนได้: ' + (err?.message || ''));
      setIsListening(false);
    }
  };

  // Submit voice transcript or manual test query to Gemini Flash
  const handleQueryAi = async (queryText?: string) => {
    const textToQuery = (queryText || transcript).trim();
    if (!textToQuery) {
      setErrorMsg('กรุณาพูดหรือระบุคำค้นหาก่อน');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await searchVoiceWithGeminiFlash(textToQuery, catalog);
      if (res.data) {
        setResult(res.data);
      }
    } catch (err: any) {
      console.error('Voice search failed:', err);
      setErrorMsg(err?.message || 'การค้นหาด้วย Gemini Flash ขัดข้อง โปรดลองใหม่อีกครั้ง');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectMatchedItem = (item: ProductItem) => {
    onSelectProduct(item);
    onClose();
  };

  const handleApplyKeywordToSearch = (keyword: string) => {
    if (onApplySearchText) {
      onApplySearchText(keyword);
    }
    onClose();
  };

  const quickPrompts = [
    'มียาง IRC 120/70-14 มั้ย',
    'เช็คยาง Wave 110i เบอร์ 70/90-17',
    'น้ำมันเครื่อง Castrol เหลือเท่าไหร่',
    'ยางขอบ 14 มีตัวไหนบ้าง',
    'สินค้าที่ของหมดสต็อก',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-sm bg-[#3A4750] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252C33] border-b border-[#475662]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-[#F6C90E] text-[#252C33] flex items-center justify-center font-bold shadow-md">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-1.5">
                <span>ค้นหาด้วยเสียง AI</span>
                <span className="text-[9px] bg-[#F6C90E]/20 text-[#F6C90E] font-bold px-1.5 py-0.5 rounded border border-[#F6C90E]/30">
                  ⚡ Flash Voice
                </span>
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">สั่งค้นหาสต็อกด้วยเสียงภาษาไทยเป็นธรรมชาติ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* Mic Button & Wave Animation */}
          <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-4 text-center space-y-3">
            <div className="relative inline-flex items-center justify-center">
              {isListening && (
                <div className="absolute inset-0 rounded-full bg-[#F6C90E] animate-ping opacity-30" />
              )}
              <button
                onClick={isListening ? stopListening : startListening}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                  isListening
                    ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-rose-500/30'
                    : 'bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] shadow-[#F6C90E]/30'
                }`}
                title={isListening ? 'กดเพื่อหยุดฟัง' : 'กดเพื่อเริ่มพูด'}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-[#EEEEEE]">
                {isListening
                  ? 'กำลังฟังเสียงพูดของคุณ...'
                  : transcript
                  ? 'เสียงที่บันทึกได้:'
                  : 'แตะที่ไมโครโฟน แล้วพูดชื่อยางหรืออะไหล่'}
              </div>
              <p className="text-[11px] text-[#A0ABB5]">
                {isListening
                  ? 'พูดเป็นภาษาไทยได้ตามธรรมชาติ เช่น "มียางไออาร์ซีเบอร์ร้อยยี่สิบทับเจ็ดสิบสิบสี่มั้ย"'
                  : 'เช่น "เช็คยางเวฟร้อยสิบ", "น้ำมันเครื่องเหลือเท่าไหร่", "ยางขอบ 14"'}
              </p>
            </div>

            {/* Transcript Input / Display */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQueryAi()}
                placeholder="ข้อความเสียง หรือพิมพ์ค้นหาด้วยภาษาพูด..."
                className="flex-1 bg-[#3A4750] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F6C90E]"
              />
              <button
                onClick={() => handleQueryAi()}
                disabled={isProcessing || !transcript.trim()}
                className="px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl flex items-center gap-1 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-[#F6C90E]/20"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>ค้นหา</span>
              </button>
            </div>
          </div>

          {/* Quick Voice Prompt Chips */}
          {!result && !isProcessing && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-[#A0ABB5] font-semibold px-1">
                หรือแตะประโยคตัวอย่างเพื่อทดสอบ:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setTranscript(p);
                      handleQueryAi(p);
                    }}
                    className="px-2.5 py-1 bg-[#252C33] hover:bg-[#43525D] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662] rounded-xl text-[11px] text-left transition-all active:scale-95"
                  >
                    💬 {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-4 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-[#F6C90E] animate-spin mx-auto" />
              <div className="text-xs font-bold text-[#EEEEEE]">
                Gemini Flash กำลังถอดรหัสความหมายและค้นหาสต็อก...
              </div>
              <p className="text-[10px] text-[#A0ABB5]">
                แปลคำพูดเป็นสเปกยาง และค้นหาในคลัง CRC THABO
              </p>
            </div>
          )}

          {/* Search Result Card */}
          {result && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
              {/* Spoken AI Reply Box */}
              <div className="bg-gradient-to-r from-amber-500/15 via-[#F6C90E]/15 to-amber-500/15 border border-[#F6C90E]/50 rounded-2xl p-3 shadow-md space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 font-bold text-[#F6C90E]">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>คำตอบจาก Gemini Flash:</span>
                  </span>
                  {result.extractedKeyword && (
                    <button
                      onClick={() => handleApplyKeywordToSearch(result.extractedKeyword)}
                      className="text-[10px] bg-[#3A4750] hover:bg-[#475662] text-[#EEEEEE] px-2 py-0.5 rounded-lg border border-[#475662] flex items-center gap-1"
                      title="นำคำค้นหานี้ไปกรองในรายการสินค้า"
                    >
                      <Search className="w-3 h-3 text-[#F6C90E]" />
                      <span>กรองคำนี้: "{result.extractedKeyword}"</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#EEEEEE] font-medium leading-relaxed bg-[#252C33]/70 p-2.5 rounded-xl border border-[#475662]/50">
                  {result.spokenReply}
                </p>
              </div>

              {/* Matched Products List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] text-[#A0ABB5] font-semibold">
                  <span>รายการสินค้าที่ตรงกับคำพูด ({result.matchedProducts?.length || 0}):</span>
                  {result.matchedProducts?.length > 0 && (
                    <span className="text-[#F6C90E]">แตะเพื่อเลือก</span>
                  )}
                </div>

                {(!result.matchedProducts || result.matchedProducts.length === 0) ? (
                  <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-3.5 text-center text-[#A0ABB5]">
                    ไม่พบสินค้าที่ตรงกับคำว่า "{result.extractedKeyword || transcript}" ในคลัง
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {result.matchedProducts.map((item) => {
                      const itemImg = resolveProductImage(item);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectMatchedItem(item)}
                          className="bg-[#252C33] hover:bg-[#43525D] border border-[#475662] hover:border-[#F6C90E] rounded-xl p-2.5 flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {itemImg && (
                              <img
                                src={itemImg}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover bg-black flex-shrink-0 border border-[#475662]"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#EEEEEE] text-xs truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-[#A0ABB5] mt-0.5 flex items-center gap-1.5">
                                <span className="text-[#F6C90E] font-bold">
                                  คงเหลือ: {item.actualQty ?? item.systemQty ?? 0} {item.unit || 'ชิ้น'}
                                </span>
                                <span>•</span>
                                <span>{item.location || item.frontLocation || 'หน้าร้าน'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[#F6C90E] flex-shrink-0">
                            <span className="text-xs font-bold font-mono">
                              ฿{item.price ?? item.sellingPrice ?? 0}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
