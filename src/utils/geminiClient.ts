import { ProductItem } from '../types';

export interface GeminiTireAnalysisResult {
  brand?: string;
  size?: string;
  model?: string;
  dotCode?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  suggestedName: string;
  summary: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AnalyzeTireResponse {
  success: boolean;
  model: string;
  durationMs: number;
  data: GeminiTireAnalysisResult;
  matchedItem?: ProductItem | null;
  error?: string;
}

export interface StockAdvisorResponse {
  success: boolean;
  model: string;
  durationMs: number;
  analysis: string;
  summary?: {
    totalItems: number;
    outOfStockCount: number;
    lowStockCount: number;
    discrepancyCount: number;
  };
  error?: string;
}

export interface InvoiceItemResult {
  rawName: string;
  brand?: string;
  size?: string;
  quantity: number;
  unit?: string;
  costPrice?: number;
  lineTotal?: number;
  matchedCatalogId?: string | null;
  matchedProduct?: ProductItem | null;
}

export interface InvoiceAnalysisResult {
  supplier: string;
  invoiceNo?: string;
  date?: string;
  grandTotal?: number;
  summary: string;
  items: InvoiceItemResult[];
}

export interface AnalyzeInvoiceResponse {
  success: boolean;
  model: string;
  durationMs: number;
  data: InvoiceAnalysisResult;
  error?: string;
}

export interface VoiceSearchResult {
  extractedKeyword: string;
  intent?: string;
  matchingIds: string[];
  spokenReply: string;
  matchedProducts: ProductItem[];
}

export interface VoiceSearchResponse {
  success: boolean;
  model: string;
  durationMs: number;
  voiceText: string;
  data: VoiceSearchResult;
  error?: string;
}

/**
 * Call server-side Gemini Flash to analyze tire sidewalls, tread patterns, or label stickers
 */
export async function analyzeTireImageWithGeminiFlash(
  imageBase64: string,
  catalog?: ProductItem[]
): Promise<AnalyzeTireResponse> {
  const res = await fetch('/api/gemini/analyze-tire', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      catalog: catalog?.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        size: c.size,
        barcode: c.barcode,
        systemQty: c.systemQty,
        actualQty: c.actualQty,
        price: c.price,
        unit: c.unit,
      })),
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `การเชื่อมต่อ Gemini Flash ล้มเหลว (${res.status})`);
  }

  return res.json();
}

/**
 * Call server-side Gemini Flash for AI Stock Advisory, Restock calculations & Inventory Q&A
 */
export async function getStockAdviceWithGeminiFlash(
  inventory: ProductItem[],
  prompt?: string,
  mode: 'overview' | 'reorder' | 'discrepancy' | 'query' = 'overview'
): Promise<StockAdvisorResponse> {
  const res = await fetch('/api/gemini/stock-advisor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inventory,
      prompt,
      mode,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `การประมวลผล Gemini Flash ล้มเหลว (${res.status})`);
  }

  return res.json();
}

/**
 * Check Gemini Flash Server Health
 */
export async function checkGeminiFlashStatus(): Promise<{
  status: string;
  model: string;
  hasApiKey: boolean;
}> {
  const res = await fetch('/api/gemini/health');
  if (!res.ok) {
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Gemini Flash ได้');
  }
  return res.json();
}

/**
 * Call server-side Gemini Flash to read delivery order / invoice / receipt photos
 * for fast batch goods receiving (รับเข้าสินค้าด้วยภาพถ่ายบิล)
 */
export async function analyzeInvoiceWithGeminiFlash(
  imageBase64: string,
  catalog?: ProductItem[]
): Promise<AnalyzeInvoiceResponse> {
  const res = await fetch('/api/gemini/analyze-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      catalog: catalog?.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        size: c.size,
        barcode: c.barcode,
        costPrice: c.costPrice,
        price: c.price,
        unit: c.unit,
      })),
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `การอ่านบิลด้วย Gemini Flash ล้มเหลว (${res.status})`);
  }

  return res.json();
}

/**
 * Call server-side Gemini Flash for AI Voice Search and Intent Matching (ค้นหาด้วยเสียง)
 */
export async function searchVoiceWithGeminiFlash(
  voiceText: string,
  catalog?: ProductItem[]
): Promise<VoiceSearchResponse> {
  const res = await fetch('/api/gemini/voice-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceText,
      catalog: catalog?.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        size: c.size,
        barcode: c.barcode,
        actualQty: c.actualQty,
        systemQty: c.systemQty,
        location: c.location,
        frontLocation: c.frontLocation,
        price: c.price,
        unit: c.unit,
      })),
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `การประมวลผลคำสั่งเสียงด้วย Gemini Flash ล้มเหลว (${res.status})`);
  }

  return res.json();
}

export interface GeminiSelfTestResponse {
  success: boolean;
  totalDurationMs: number;
  model: string;
  fallbackModel: string;
  hasApiKey: boolean;
  results: {
    textGeneration?: { status: string; durationMs?: number; reply?: string; error?: string };
    jsonSchema?: { status: string; durationMs?: number; data?: any; error?: string };
    visionAnalysis?: { status: string; durationMs?: number; reply?: string; error?: string };
  };
  timestamp: string;
  error?: string;
}

/**
 * Run full AI Diagnostic Suite
 */
export async function runGeminiSelfTest(): Promise<GeminiSelfTestResponse> {
  const res = await fetch('/api/gemini/self-test');
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `การทดสอบระบบ AI ล้มเหลว (${res.status})`);
  }
  return res.json();
}

