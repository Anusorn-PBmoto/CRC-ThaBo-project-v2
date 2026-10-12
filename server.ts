import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase body limit to support camera captures / Base64 images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
      }
      return value;
    },
    space
  );
}


// Initialize GoogleGenAI server-side with telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Multi-tier model candidate list for ultra-fast OCR without rate limits or timeout spikes
// gemini-3.8-flash: Flagship multimodal model for complex Thai receipts and tables
// gemini-flash-latest: Stable fallback alias
// gemini-3.1-flash-lite: Ultra-fast, 1,500 RPD quota, resilient against 503 high demand spikes
const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
const GEMINI_SECONDARY_MODEL = 'gemini-flash-latest';
const GEMINI_TERTIARY_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_FLASH_MODEL = GEMINI_PRIMARY_MODEL;
const GEMINI_FALLBACK_MODEL = GEMINI_SECONDARY_MODEL;

// Resilient helper with multi-tier fallback and timeout racing
async function generateWithGemini(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const candidateModels: string[] = [];
  if (params.preferredModel && params.preferredModel !== 'auto') {
    candidateModels.push(params.preferredModel);
  }
  const defaultList = [
    process.env.GEMINI_MODEL || GEMINI_PRIMARY_MODEL,
    GEMINI_SECONDARY_MODEL,
    GEMINI_TERTIARY_MODEL,
  ];
  for (const m of defaultList) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    const isLite = currentModel.includes('lite');

    const callConfig = {
      ...params.config,
      ...(isLite ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
    };

    // Try up to 2 attempts per model in case of temporary 503 high demand
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const callPromise = ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: callConfig,
        });

        // 25s timeout for vision OCR
        const timeoutMs = 25000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timeout with ${currentModel}`)), timeoutMs)
        );

        const result = (await Promise.race([callPromise, timeoutPromise])) as any;
        if (result) {
          result._usedModel = currentModel;
          return result;
        }
      } catch (err: any) {
        const errMessage = String(err?.message || '');
        console.log(
          `[Gemini AI] Model ${currentModel} attempt ${attempt} failed (${errMessage.slice(0, 80)})...`
        );
        lastError = err;
        // If 503 or high demand, wait 1.2s before retry
        if (
          attempt === 1 &&
          (errMessage.includes('503') ||
            errMessage.includes('high demand') ||
            errMessage.includes('UNAVAILABLE') ||
            errMessage.includes('timeout'))
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        break; // move to next model candidate
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'ทุกโมเดลของ Gemini กำลังประสบปัญหาการใช้งานหนาแน่น (503 High Demand) กรุณาลองใหม่อีกครั้งในอีกสักครู่'
    )
  );
}

// Health check endpoint
app.get('/api/gemini/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    model: GEMINI_FLASH_MODEL,
    fallbackModel: GEMINI_FALLBACK_MODEL,
    hasApiKey: hasKey,
    timestamp: new Date().toISOString(),
  });
});

// Self-test diagnostic endpoint to test all Gemini Flash capabilities
app.get('/api/gemini/self-test', async (_req: Request, res: Response): Promise<void> => {
  const t0 = Date.now();
  const testResults: Record<string, any> = {};

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      success: false,
      error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ',
      hasApiKey: false,
    });
    return;
  }

  // 1. Text Generation test
  try {
    const tStart = Date.now();
    const r1 = await generateWithGemini({
      contents: 'ตอบสั้นๆ ว่า "ระบบพร้อมทำงาน"',
    });
    testResults.textGeneration = {
      status: 'ok',
      durationMs: Date.now() - tStart,
      reply: r1.text?.trim() || '',
    };
  } catch (err: any) {
    testResults.textGeneration = {
      status: 'error',
      error: err?.message,
    };
  }

  // 2. Structured JSON Schema test
  try {
    const tStart = Date.now();
    const r2 = await generateWithGemini({
      contents: 'สกัดยี่ห้อและขนาด: IRC SCT-001 120/70-14',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            size: { type: Type.STRING },
          },
          required: ['brand', 'size'],
        },
      },
    });
    testResults.jsonSchema = {
      status: 'ok',
      durationMs: Date.now() - tStart,
      data: JSON.parse(r2.text || '{}'),
    };
  } catch (err: any) {
    testResults.jsonSchema = {
      status: 'error',
      error: err?.message,
    };
  }

  // 3. Vision / Multimodal OCR test
  try {
    const tStart = Date.now();
    const samplePng = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDv1/64nRAAAAAElFTkSuQmCC';
    const r3 = await generateWithGemini({
      contents: [
        { inlineData: { mimeType: 'image/png', data: samplePng } },
        { text: 'รูปนี้คืออะไร ตอบสั้นๆ' },
      ],
    });
    testResults.visionAnalysis = {
      status: 'ok',
      durationMs: Date.now() - tStart,
      reply: r3.text?.trim() || '',
    };
  } catch (err: any) {
    testResults.visionAnalysis = {
      status: 'error',
      error: err?.message,
    };
  }

  const allPassed =
    testResults.textGeneration?.status === 'ok' &&
    testResults.jsonSchema?.status === 'ok' &&
    testResults.visionAnalysis?.status === 'ok';

  res.json({
    success: allPassed,
    totalDurationMs: Date.now() - t0,
    model: GEMINI_FLASH_MODEL,
    fallbackModel: GEMINI_FALLBACK_MODEL,
    hasApiKey: true,
    results: testResults,
    timestamp: new Date().toISOString(),
  });
});

interface AnalyzeTireRequestBody {
  imageBase64: string;
  mimeType?: string;
  catalog?: Array<{
    id: string;
    name: string;
    brand?: string;
    size?: string;
    barcode?: string;
    systemQty?: number;
    actualQty?: number;
    price?: number;
    unit?: string;
  }>;
}

// Endpoint: AI Tire & Automotive Part Sidewall / Label OCR Analysis
app.post('/api/gemini/analyze-tire', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { imageBase64, mimeType = 'image/jpeg', catalog = [] } = req.body as AnalyzeTireRequestBody;

    if (!imageBase64) {
      res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพ (imageBase64 is required)' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อมระบบ',
      });
      return;
    }

    // Clean data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = imageBase64.startsWith('data:')
      ? imageBase64.substring(5, imageBase64.indexOf(';'))
      : mimeType;

    const catalogSummary = Array.isArray(catalog) && catalog.length > 0
      ? `รายการสินค้าตัวอย่างในคลัง CRC THABO เพื่อช่วยเทียบเคียง (${catalog.length} รายการ):\n` +
        catalog
          .slice(0, 30)
          .map((c) => `- [${c.barcode || 'ไม่มีบาร์โค้ด'}] ${c.brand || ''} ${c.size || ''} ${c.name} (คงเหลือ: ${c.actualQty ?? c.systemQty ?? 0})`)
          .join('\n')
      : 'ยังไม่มีแคตตาล็อกสินค้าในระบบ';

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านยางรถจักรยานยนต์ ยางรถยนต์ และอะไหล่ยานยนต์ในประเทศไทย สำหรับร้านค้า CRC THABO
กรุณาวิเคราะห์รูปภาพนี้อย่างละเอียด รูปอาจเป็น:
- ภาพแก้มยางมอเตอร์ไซค์หรือยางรถยนต์ (ดูขนาดยาง เช่น 120/70-14, 205/55R16, 90/90-14, 2.25-17, 80/90-14, ยี่ห้อ เช่น IRC, Michelin, Dunlop, Vee Rubber, Deestone, Maxxis, ND Rubber, Camel)
- ป้ายสติกเกอร์ฉลากยาง ฉลากราคา หรือบาร์โค้ดสินค้า
- กล่องบรรจุภัณฑ์อะไหล่ หรือตัวอะไหล่

ข้อมูลในแคตตาล็อกร้านค้าปัจจุบัน:
${catalogSummary}

จงสกัดข้อมูลสำคัญให้ออกมาเป็นโครงสร้าง JSON:
1. brand: ยี่ห้อสินค้า (เช่น IRC, Michelin, Dunlop, ND Rubber ฯลฯ)
2. size: ขนาดยางหรือเบอร์สเปก (เช่น 120/70-14, 205/55R16, 90/90-14)
3. model: รุ่นหรือลายดอกยาง (เช่น SCT-001 Mobicity, City Grip, NR73, Pilot Street ฯลฯ ถ้ามี)
4. dotCode: สัปดาห์และปีผลิต 4 หลัก (DOT เช่น 2523, 1424) ถ้ามองเห็น
5. barcode: เลขบาร์โค้ดตัวเลขที่อ่านได้ (ถ้ามี)
6. category: หมวดหมู่ ('ยางนอก', 'ยางใน', 'อะไหล่ทั่วไป', 'น้ำมันและเคมีภัณฑ์')
7. unit: หน่วยนับ ('เส้น', 'ชิ้น', 'คู่', 'กระป๋อง', 'กล่อง')
8. suggestedName: ชื่อสินค้าภาษาไทยที่กระชับและเป็นมาตรฐาน เช่น "ยาง IRC SCT-001 Mobicity 120/70-14 TL"
9. summary: สรุปผลการสแกนเป็นภาษาไทยสั้นๆ 1-2 ประโยค
10. confidence: ความมั่นใจ ('HIGH' | 'MEDIUM' | 'LOW')`;

    const response = await generateWithGemini({
      contents: [
        {
          inlineData: {
            mimeType: detectedMime || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: systemPrompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            size: { type: Type.STRING },
            model: { type: Type.STRING },
            dotCode: { type: Type.STRING },
            barcode: { type: Type.STRING },
            category: { type: Type.STRING },
            unit: { type: Type.STRING },
            suggestedName: { type: Type.STRING },
            summary: { type: Type.STRING },
            confidence: { type: Type.STRING },
          },
          required: ['brand', 'suggestedName', 'summary', 'confidence'],
        },
      },
    });

    const rawText = response.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawText);
      if (!parsedData.confidence || !['HIGH', 'MEDIUM', 'LOW'].includes(parsedData.confidence.toUpperCase())) {
        parsedData.confidence = 'MEDIUM';
      } else {
        parsedData.confidence = parsedData.confidence.toUpperCase();
      }
      if (!parsedData.suggestedName && parsedData.brand) {
        parsedData.suggestedName = `${parsedData.brand} ${parsedData.size || ''}`.trim();
      }
    } catch {
      parsedData = {
        brand: '',
        size: '',
        model: '',
        suggestedName: 'ไม่สามารถแปลงผลลัพธ์เป็น JSON ได้',
        summary: rawText,
        confidence: 'LOW',
      };
    }

    // Try finding exact or fuzzy match in local catalog
    let matchedItem: any = null;
    if (Array.isArray(catalog) && catalog.length > 0) {
      const cleanBarcode = (parsedData.barcode || '').replace(/[^0-9]/g, '');
      const cleanSize = (parsedData.size || '').toLowerCase().replace(/[\s-]/g, '');
      const cleanBrand = (parsedData.brand || '').toLowerCase().trim();

      // 1. Direct barcode match
      if (cleanBarcode) {
        matchedItem = catalog.find((c) => (c.barcode || '').replace(/[^0-9]/g, '') === cleanBarcode);
      }

      // 2. Brand & Size match
      if (!matchedItem && cleanSize) {
        matchedItem = catalog.find((c) => {
          const cSize = (c.size || c.name || '').toLowerCase().replace(/[\s-]/g, '');
          const cBrand = (c.brand || '').toLowerCase().trim();
          const brandMatches = cleanBrand ? cBrand.includes(cleanBrand) || cleanBrand.includes(cBrand) : true;
          return brandMatches && cSize.includes(cleanSize);
        });
      }
    }

    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      model: GEMINI_FLASH_MODEL,
      durationMs,
      data: parsedData,
      matchedItem,
    });
  } catch (error: any) {
    console.error('Error analyzing tire with Gemini Flash:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพด้วย Gemini Flash',
      durationMs: Date.now() - startTime,
    });
  }
});

// Endpoint: AI Invoice / Receipt OCR for Receiving Goods (รับเข้าสินค้าด้วยภาพถ่ายบิล/ใบส่งของ)
app.post('/api/gemini/analyze-invoice', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      catalog = [],
      preferredModel = 'auto',
    } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพบิล (imageBase64 is required)' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อมระบบ',
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = imageBase64.startsWith('data:')
      ? imageBase64.substring(5, imageBase64.indexOf(';'))
      : mimeType;

    const catalogMiniList = Array.isArray(catalog) && catalog.length > 0
      ? `รายการสินค้าในระบบ CRC THABO สำหรับเปรียบเทียบรหัส/ชื่อ (${catalog.length} รายการ):\n` +
        catalog
          .slice(0, 40)
          .map((c: any) => `- ID: ${c.id} | Barcode: ${c.barcode || '-'} | Name: ${c.name} | Brand: ${c.brand || ''} | Size: ${c.size || ''} | Cost: ${c.costPrice || 0}`)
          .join('\n')
      : 'ยังไม่มีแคตตาล็อกสินค้า';

    const systemPrompt = `คุณคือผู้ช่วยจัดการสต็อกสินค้าอัจฉริยะ (AI Inventory & Goods Receiving Assistant) สำหรับร้านขายยางรถจักรยานยนต์ ยางรถยนต์ และอะไหล่ยานยนต์ CRC THABO
หน้าที่ของคุณคืออ่าน "ภาพถ่ายบิลส่งของ / ใบเสร็จรับเงิน / ใบกำกับภาษี / ใบส่งสินค้า/ใบวางบิล (Invoice / Delivery Order / Receipt)"
และสกัดรายการสินค้าทุกรายการอย่างละเอียด ถูกต้อง เพื่อนำไปบันทึกเพิ่มเป็นสินค้าใหม่เข้าสู่ระบบคลังสินค้า และอัปเดตสต็อกโดยอัตโนมัติ

คำแนะนำการอ่านตารางบิล:
1. ข้อมูลหัวบิล:
   - supplier: ชื่อผู้จำหน่าย/บริษัท/ร้านค้าต้นทาง (เช่น ร้าน เจริญชัย อ.ท่าบ่อ, บจก. สยามกลการ หรือตามที่ปรากฏในบิล ถ้าไม่พบให้ใส่ 'ร้านค้าคู่ค้า')
   - invoiceNo: เลขที่บิล/เลขที่เอกสาร (เช่น ORNC6905000147)
   - date: วันที่ในบิล (เช่น 08/05/2569 หรือ YYYY-MM-DD)
   - grandTotal: ยอดรวมเงินสุทธิทั้งบิล (ตัวเลข ถ้าท้ายบิลถูกตัด ให้คำนวณผลรวมของรายการที่พบ)
2. สกัดรายการสินค้า (items) ทุกรายการในตารางบิล โดยอ่านตามคอลัมน์:
   - คอลัมน์ 'รหัสสินค้า': รหัสอะไหล่หรือบาร์โค้ด (เช่น 5205, 5222, YTZ6, OD-YTZ7, OD-YTX7L, KY-H4, ZS-201, 05000, 05002, 2004-070-00, 885286300308, 885176211159 ฯลฯ) ให้นำมาใส่ในฟิลด์ barcode
   - คอลัมน์ 'รายการ': ข้อความชื่อสินค้าตามบิล นำมาใส่ใน rawName และแปลงเป็นชื่อสินค้าภาษาไทยที่สะอาดใน name (เช่น 'บางจาก FURIO SUPER-1 AT-SCT 1L', 'แบตเตอรี่ YUASA YTZ-6-V', 'สเตอร์หลัง JT-NO 428-36T')
   - brand: ยี่ห้อสินค้า (เช่น บางจาก, YUASA, OD, KY, HM, ทรีบอน, JT, IRC, Michelin, Castrol ฯลฯ)
   - size: ขนาด เบอร์ หรือสเปก (เช่น 1.0L, 0.8L, YTZ-6, 428-36T, 120/70-14 ฯลฯ)
   - category: หมวดหมู่สินค้า เลือกจาก: 'น้ำมันและเคมีภัณฑ์', 'แบตเตอรี่และระบบไฟ', 'ยางนอก', 'ยางใน', 'ระบบส่งกำลัง', 'ระบบเบรก', 'อะไหล่ทั่วไป'
   - quantity: จำนวนที่ซื้อ (ตัวเลขจำนวนเต็ม เช่น 1, 6, 10, 60)
   - unit: หน่วยนับตามบิล (เช่น ลัง, ลูก, แพค, อัน, ตัว, ชุด, หลอด, เส้น, ชิ้น)
   - costPrice: ราคาต่อหน่วย (ต้นทุน) ตัดเครื่องหมายจุลภาคออก เช่น 1,595.00 -> 1595
   - sellingPrice: ราคาขายปลีกแนะนำ โดยบวกกำไรมาตรฐาน 20-30% จากราคาต้นทุน
   - lineTotal: ราคารวมของแถวนี้ (quantity * costPrice)
3. สรุปภาพรวม summary สั้นๆ เป็นภาษาไทย 1 ประโยค เช่น "พบ 14 รายการ ยอดรวม 23,450 บาท จาก ร้าน เจริญชัย"`;

    const response = await generateWithGemini({
      contents: [
        {
          inlineData: {
            mimeType: detectedMime || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: systemPrompt,
        },
      ],
      preferredModel,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: { type: Type.STRING },
            invoiceNo: { type: Type.STRING },
            date: { type: Type.STRING },
            grandTotal: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rawName: { type: Type.STRING },
                  name: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  size: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  costPrice: { type: Type.NUMBER },
                  sellingPrice: { type: Type.NUMBER },
                  lineTotal: { type: Type.NUMBER },
                  barcode: { type: Type.STRING },
                  matchedCatalogId: { type: Type.STRING, nullable: true },
                },
                required: ['rawName', 'name'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const rawText = response.text || '{}';
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(cleanJson);
    } catch {
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedData = JSON.parse(match[0]);
        } catch {
          parsedData = {};
        }
      }
    }

    if (!parsedData || typeof parsedData !== 'object') {
      parsedData = {
        supplier: 'ร้านค้าคู่ค้า',
        invoiceNo: '',
        date: '',
        grandTotal: 0,
        summary: 'ไม่สามารถแยกข้อมูลได้',
        items: [],
      };
    }

    // Auto-match items against catalog if not matched
    if (Array.isArray(parsedData.items)) {
      parsedData.items = parsedData.items.map((item: any, idx: number) => {
        let matched: any = null;
        if (item.matchedCatalogId && Array.isArray(catalog)) {
          matched = catalog.find((c: any) => c.id === item.matchedCatalogId);
        }

        if (!matched && Array.isArray(catalog)) {
          // Fuzzy match by name or brand+size or barcode
          const itemSearch = `${item.brand || ''} ${item.size || ''} ${item.name || item.rawName || ''}`.toLowerCase();
          const cleanBarcode = (item.barcode || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

          matched = catalog.find((c: any) => {
            if (cleanBarcode && c.barcode && c.barcode.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === cleanBarcode) {
              return true;
            }
            const cName = `${c.brand || ''} ${c.size || ''} ${c.name || ''}`.toLowerCase();
            return (
              (item.size && cName.includes(item.size.toLowerCase())) ||
              (item.name && cName.includes(item.name.toLowerCase())) ||
              cName.includes(itemSearch.trim())
            );
          });
        }

        const cost = typeof item.costPrice === 'string'
          ? parseFloat(item.costPrice.replace(/,/g, '')) || 0
          : Number(item.costPrice) || 0;
        const qty = typeof item.quantity === 'string'
          ? parseFloat(item.quantity.replace(/,/g, '')) || 1
          : Math.max(1, Number(item.quantity) || 1);

        let sellPrice = typeof item.sellingPrice === 'string'
          ? parseFloat(item.sellingPrice.replace(/,/g, '')) || 0
          : Number(item.sellingPrice) || 0;

        if (sellPrice <= cost && cost > 0) {
          // Recommend 25-30% margin rounded nicely
          const rawSell = cost * 1.25;
          sellPrice = rawSell >= 100 ? Math.round(rawSell / 10) * 10 : Math.round(rawSell);
        }

        return {
          id: `extracted-${Date.now()}-${idx}`,
          ...item,
          name: item.name || item.rawName || `สินค้าใหม่ #${idx + 1}`,
          category: item.category || 'อะไหล่ทั่วไป',
          unit: item.unit || 'ชิ้น',
          quantity: qty,
          costPrice: cost,
          sellingPrice: sellPrice,
          barcode: item.barcode || '',
          isNew: !matched,
          matchedProduct: matched || null,
        };
      });

      // Recalculate grand total if 0
      if (!parsedData.grandTotal || parsedData.grandTotal === 0) {
        parsedData.grandTotal = parsedData.items.reduce(
          (sum: number, it: any) => sum + (it.lineTotal || it.quantity * it.costPrice || 0),
          0
        );
      }
    }

    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      model: (response as any)?._usedModel || GEMINI_FLASH_MODEL,
      durationMs,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error analyzing invoice with Gemini Flash:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการอ่านบิลด้วย Gemini Flash',
      durationMs: Date.now() - startTime,
    });
  }
});

// Endpoint: AI Voice Search & Natural Language Query for Inventory
app.post('/api/gemini/voice-search', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { voiceText, catalog = [] } = req.body;

    if (!voiceText || typeof voiceText !== 'string' || voiceText.trim() === '') {
      res.status(400).json({ error: 'ไม่พบข้อความเสียง (voiceText is required)' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อมระบบ',
      });
      return;
    }

    const catalogList = Array.isArray(catalog)
      ? catalog.map((c: any) => ({
          id: c.id,
          name: c.name,
          brand: c.brand,
          size: c.size,
          barcode: c.barcode,
          actualQty: c.actualQty ?? c.systemQty ?? 0,
          location: c.location,
          frontLocation: c.frontLocation,
          price: c.price ?? c.sellingPrice ?? 0,
          unit: c.unit,
        }))
      : [];

    const prompt = `คุณคือระบบค้นหาสต็อกด้วยเสียงอัจฉริยะ (Voice Search & Natural Language) สำหรับร้านยาง CRC THABO
ผู้ใช้งานพูดสั่งหรือค้นหาด้วยเสียงภาษาไทยว่า: "${voiceText.trim()}"

ตัวอย่างคำพูดที่มักพบ:
- "มียางไออาร์ซีเบอร์ร้อยยี่สิบทับเจ็ดสิบสิบสี่มั้ย" -> แปลเป็น: IRC 120/70-14
- "เช็คยางเวฟร้อยสิบไอหน่อย" -> แปลเป็น: ยาง Wave 110i (เบอร์ 70/90-17, 80/90-17 หรือ 2.25-17, 2.50-17)
- "น้ำมันเครื่องคาสตรอลเหลือเท่าไหร่" -> แปลเป็น: Castrol
- "ยางขอบสิบสี่มีตัวไหนบ้าง" -> ค้นหา: 14 หรือ -14
- "ของที่หมดสต็อกมีอะไรบ้าง" -> กรองสินค้าที่มี actualQty = 0

ฐานข้อมูลสินค้าในร้าน (${catalogList.length} รายการ):
${safeStringify(catalogList.slice(0, 50), 1)}

หน้าที่ของคุณ:
1. วิเคราะห์เจตนาของผู้ใช้ (Intent)
2. ถอดคำค้นหาหลัก searchKeyword ออกมาให้กระชับและตรงตัว (เช่น "IRC 120/70-14", "Wave", "Castrol", "หมดสต็อก")
3. คัดเลือก matchingIds (array ของ id สินค้าที่ตรงกับคำพูดที่สุด เรียงตามความเกี่ยวข้อง)
4. สร้างคำตอบภาษาไทยสั้นๆ ที่เป็นมิตร เหมือนเจ้าหน้าที่คลังตอบกลับ (spokenReply) เช่น "มียาง IRC 120/70-14 คงเหลือ 5 เส้น อยู่ที่ RACK A-02 ครับ"`;

    const response = await generateWithGemini({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedKeyword: { type: Type.STRING },
            intent: { type: Type.STRING },
            matchingIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            spokenReply: { type: Type.STRING },
          },
          required: ['extractedKeyword', 'spokenReply', 'matchingIds'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    let matchedProducts = (parsed.matchingIds || [])
      .map((id: string) => catalog.find((c: any) => c.id === id))
      .filter(Boolean);

    // If no direct ID matched from sample mini-list, search catalog by extracted keyword
    if (matchedProducts.length === 0 && parsed.extractedKeyword && Array.isArray(catalog)) {
      const kw = parsed.extractedKeyword.toLowerCase().trim();
      const tokens = kw.split(/[\s/,-]+/).filter((t: string) => t.length > 1);
      matchedProducts = catalog.filter((c: any) => {
        const fullText = `${c.brand || ''} ${c.size || ''} ${c.name || ''} ${c.barcode || ''}`.toLowerCase();
        return tokens.some((token: string) => fullText.includes(token));
      }).slice(0, 10);
    }

    res.json({
      success: true,
      model: GEMINI_FLASH_MODEL,
      durationMs: Date.now() - startTime,
      voiceText,
      data: {
        ...parsed,
        matchedProducts,
      },
    });
  } catch (error: any) {
    console.error('Error processing voice search with Gemini Flash:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการประมวลผลคำสั่งเสียงด้วย Gemini Flash',
      durationMs: Date.now() - startTime,
    });
  }
});

// Endpoint: AI Smart Stock Advisor & Restock Analytics
app.post('/api/gemini/stock-advisor', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { inventory = [], prompt = '', mode = 'overview' } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อมระบบ',
      });
      return;
    }

    // Summarize inventory items for the prompt
    const totalItems = inventory.length;
    const outOfStock = inventory.filter((i: any) => (i.actualQty ?? i.systemQty ?? 0) === 0);
    const lowStock = inventory.filter((i: any) => {
      const q = i.actualQty ?? i.systemQty ?? 0;
      return q > 0 && q <= (i.minStock || 2);
    });
    const discrepancy = inventory.filter((i: any) => i.actualQty !== undefined && i.actualQty !== i.systemQty);

    const inventorySnapshot = inventory
      .slice(0, 50)
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        brand: i.brand,
        size: i.size,
        barcode: i.barcode,
        systemQty: i.systemQty ?? 0,
        actualQty: i.actualQty ?? 0,
        minStock: i.minStock ?? 3,
        costPrice: i.costPrice ?? 0,
        sellingPrice: i.price ?? i.sellingPrice ?? 0,
      }));

    let instruction = '';
    if (mode === 'reorder') {
      instruction = `เน้นการวิเคราะห์สั่งซื้อสินค้าเพิ่ม (PO / Reorder):
- ระบุรายการที่หมดหรือใกล้หมดอย่างเร่งด่วน
- แนะนำจำนวนสั่งซื้อที่เหมาะสมตามความจำเป็น
- คำนวณประมาณการงบประมาณสั่งซื้อถ้ามีราคาต้นทุน
- จัดรูปแบบข้อความให้สามารถก๊อปปี้ส่งไลน์หาซัพพลายเออร์หรือเถ้าแก่ได้ทันที`;
    } else if (mode === 'discrepancy') {
      instruction = `เน้นการวิเคราะห์ความคลาดเคลื่อนสต็อกจากการนับจริง (Stock Discrepancy):
- รายการไหนที่ของจริงขาดหรือเกินจากระบบมากที่สุด
- ข้อควรระวังและแนวทางแก้ไข เช่น จุดที่ควรนับซ้ำ`;
    } else if (prompt && prompt.trim() !== '') {
      instruction = `ตอบคำถามของผู้ใช้งานเกี่ยวกับคลังสินค้านี้อย่างแม่นยำและเป็นกันเอง: "${prompt}"`;
    } else {
      instruction = `สรุปภาพรวมสุขภาพคลังสินค้า (Inventory Health Overview):
1. สถานะโดยรวม (สินค้าทั้งหมด, หมด, ใกล้หมด, ยอดคลาดเคลื่อน)
2. สินค้าที่ต้องระวังเป็นพิเศษ
3. คำแนะนำเชิงธุรกิจสำหรับร้านยางและอะไหล่ CRC THABO
4. คำคมหรือข้อคิดปิดท้ายสั้นๆ สำหรับทีมคลัง`;
    }

    const aiPrompt = `คุณคือที่ปรึกษาการจัดการคลังสินค้าและสต็อกยาง/อะไหล่ยานยนต์อัจฉริยะ ทำงานด้วย Gemini Flash สำหรับระบบ CRC THABO
สรุปสถานะคลัง:
- จำนวนรายการทั้งหมด: ${totalItems} รายการ
- สินค้าหมดสต็อก: ${outOfStock.length} รายการ
- สินค้าใกล้หมด (ต่ำกว่าจุดสั่งซื้อ): ${lowStock.length} รายการ
- สินค้าที่ยอดนับจริงไม่ตรงกับระบบ: ${discrepancy.length} รายการ

ข้อมูลสินค้าในระบบ (ตัวอย่าง 50 รายการ):
${safeStringify(inventorySnapshot, 2)}

โจทย์ที่ต้องทำ:
${instruction}

ให้ตอบด้วยภาษาไทยที่สุภาพ เป็นมืออาชีพ อ่านง่าย มีหัวข้อ bullet points ชัดเจน และนำไปใช้งานจริงได้ทันที`;

    const response = await generateWithGemini({
      contents: aiPrompt,
    });

    res.json({
      success: true,
      model: GEMINI_FLASH_MODEL,
      durationMs: Date.now() - startTime,
      analysis: response.text || 'ไม่สามารถสร้างบทวิเคราะห์ได้',
      summary: {
        totalItems,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        discrepancyCount: discrepancy.length,
      },
    });
  } catch (error: any) {
    console.error('Error generating stock advice with Gemini Flash:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ด้วย Gemini Flash',
      durationMs: Date.now() - startTime,
    });
  }
});

// Full-stack Vite mounting / static hosting
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Mount Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CRC THABO] Full-stack Gemini Flash Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
