import type { Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export const config = {
  maxDuration: 60,
};

// Valid models according to Google GenAI standards:
// 1. gemini-3.1-flash-lite (Ultra-fast, high quota 1500 RPD, resilient against 503 high demand)
// 2. gemini-flash-latest (Stable high-speed Flash alias)
// 3. gemini-3.8-flash (Multimodal fallback)
const VALID_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

export default async function handler(req: Request, res: Response) {
  // Support CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. กรุณาใช้ POST method สำหรับการวิเคราะห์บิล',
    });
  }

  const startTime = Date.now();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error:
          'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel กรุณาไปที่ Vercel Dashboard > Project Settings > Environment Variables แล้วเพิ่ม GEMINI_API_KEY',
      });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid JSON request body' });
      }
    }

    const {
      imageBase64,
      mimeType = 'image/jpeg',
      catalog = [],
      preferredModel = 'auto',
    } = body || {};

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'ไม่พบข้อมูลรูปภาพบิล (imageBase64 is required)',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = imageBase64.startsWith('data:')
      ? imageBase64.substring(5, imageBase64.indexOf(';'))
      : mimeType;

    const catalogMiniList =
      Array.isArray(catalog) && catalog.length > 0
        ? `รายการสินค้าตัวอย่างในระบบ CRC THABO (${catalog.length} รายการ):\n` +
          catalog
            .slice(0, 30)
            .map((c: any) => `- ID: ${c.id} | Barcode: ${c.barcode || '-'} | Name: ${c.name || ''}`)
            .join('\n')
        : 'ยังไม่มีแคตตาล็อกสินค้า';

    const systemPrompt = `คุณคือผู้ช่วยจัดการสต็อกสินค้าอัจฉริยะ (AI Inventory & Goods Receiving Assistant) สำหรับร้านขายยางรถจักรยานยนต์ ยางรถยนต์ และอะไหล่ยานยนต์ CRC THABO
หน้าที่ของคุณคืออ่าน "ภาพถ่ายบิลส่งของ / ใบเสร็จรับเงิน / ใบกำกับภาษี / ใบส่งสินค้า/ใบวางบิล (Invoice / Delivery Order / Receipt)"
และสกัดรายการสินค้าทุกรายการอย่างละเอียด ถูกต้อง เพื่อนำไปบันทึกเพิ่มเป็นสินค้าใหม่เข้าสู่ระบบคลังสินค้า และอัปเดตสต็อกโดยอัตโนมัติ

แคตตาล็อกสินค้าตัวอย่างในระบบ:
${catalogMiniList}

คำแนะนำการอ่านตารางบิล:
1. ข้อมูลหัวบิล:
   - supplier: ชื่อผู้จำหน่าย/บริษัท/ร้านค้าต้นทาง (เช่น ร้าน เจริญชัย อ.ท่าบ่อ, บจก. สยามกลการ หรือตามที่ปรากฏในบิล ถ้าไม่พบให้ใส่ 'ร้านค้าคู่ค้า')
   - invoiceNo: เลขที่บิล/เลขที่เอกสาร (เช่น ORNC6908000308, ORNC6905000147)
   - date: วันที่ในบิล (เช่น 21/08/2569 หรือ YYYY-MM-DD)
   - grandTotal: ยอดรวมเงินสุทธิทั้งบิล (ตัวเลข ถ้าท้ายบิลถูกตัด ให้คำนวณผลรวมของรายการที่พบ)
2. สกัดรายการสินค้า (items) ทุกรายการในตารางบิล โดยอ่านตามคอลัมน์:
   - คอลัมน์ 'รหัสสินค้า': รหัสอะไหล่หรือบาร์โค้ด (เช่น 300, 212, 210, 231, 211, 8851762085079, MCL-A018, 428-100-PF-H, 8851762112164 ฯลฯ) ให้นำมาใส่ในฟิลด์ barcode
   - คอลัมน์ 'รายการ': ข้อความชื่อสินค้าตามบิล นำมาใส่ใน rawName และแปลงเป็นชื่อสินค้าภาษาไทยที่สะอาดใน name (เช่น 'สีสเปรย์ Redfox-300 สีบรอนซ์', 'โซ่ JT 428HN-106L', 'สเตอร์หลัง JT-WA 428-R-36T')
   - brand: ยี่ห้อสินค้า (เช่น Redfox, JT, PROFIT, JOKER, บางจาก, YUASA ฯลฯ)
   - size: ขนาด เบอร์ หรือสเปก (เช่น 400cc, 428-36T, 106L ฯลฯ)
   - category: หมวดหมู่สินค้า เลือกจาก: 'น้ำมันและเคมีภัณฑ์', 'แบตเตอรี่และระบบไฟ', 'ยางนอก', 'ยางใน', 'ระบบส่งกำลัง', 'ระบบเบรก', 'อะไหล่ทั่วไป'
   - quantity: จำนวนที่ซื้อ (ตัวเลขจำนวนเต็ม เช่น 1, 3, 5, 10)
   - unit: หน่วยนับตามบิล (เช่น ลัง, กระป๋อง, เส้น, อัน, ตัว, ชุด, ชิ้น)
   - costPrice: ราคาต่อหน่วย (ต้นทุน) ตัดเครื่องหมายจุลภาคออก เช่น 380.00 -> 380
   - sellingPrice: ราคาขายปลีกแนะนำ โดยบวกกำไรมาตรฐาน 20-30% จากราคาต้นทุน เช่น ต้นทุน 380บ. -> 480บ.
   - lineTotal: ราคารวมของแถวนี้ (quantity * costPrice)
3. สรุปภาพรวม summary สั้นๆ เป็นภาษาไทย 1 ประโยค เช่น "พบ 13 รายการ ยอดรวม 10,850 บาท จาก ร้าน เจริญชัย"`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Build ordered list of candidate models based on user preference
    const candidateModels: string[] = [];
    if (preferredModel && preferredModel !== 'auto' && VALID_MODELS.includes(preferredModel)) {
      candidateModels.push(preferredModel);
    }
    for (const m of VALID_MODELS) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }

    let response: any = null;
    let usedModel = candidateModels[0];
    let lastError: any = null;

    // Multi-tier fallback and auto-retry for 503 high demand spikes
    for (const model of candidateModels) {
      const isLite = model.includes('lite');
      const callConfig: any = {
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
          required: ['supplier', 'items', 'summary'],
        },
      };

      if (!isLite) {
        callConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      try {
        const genPromise = ai.models.generateContent({
          model,
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
          config: callConfig,
        });

        // Timeout protection (18 seconds per call)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout with model ${model}`)), 18000)
        );

        const result: any = await Promise.race([genPromise, timeoutPromise]);
        if (result) {
          response = result;
          usedModel = model;
          break;
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        console.warn(`[Gemini OCR] Model ${model} unavailable: ${msg.slice(0, 90)}. Fast failover...`);
        lastError = err;
        // Instantly try next model without getting stuck on 503/429
        continue;
      }
    }

    if (!response) {
      throw lastError || new Error('ทุกโมเดลของ Gemini AI ไม่พร้อมให้บริการชั่วคราว');
    }

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

    // Auto-match items against catalog if provided
    if (Array.isArray(parsedData.items)) {
      parsedData.items = parsedData.items.map((item: any, idx: number) => {
        let matched: any = null;
        if (item.matchedCatalogId && Array.isArray(catalog)) {
          matched = catalog.find((c: any) => c.id === item.matchedCatalogId);
        }

        if (!matched && Array.isArray(catalog)) {
          const itemSearch = `${item.brand || ''} ${item.size || ''} ${item.name || item.rawName || ''}`.toLowerCase();
          const cleanBarcode = (item.barcode || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

          matched = catalog.find((c: any) => {
            if (cleanBarcode && c.barcode && c.barcode.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === cleanBarcode) {
              return true;
            }
            const cName = `${c.brand || ''} ${c.size || ''} ${c.name || ''}`.toLowerCase().trim();
            const rawName = (item.name || item.rawName || '').toLowerCase().trim();
            if (rawName && cName && (rawName === cName || (rawName.length >= 8 && cName.includes(rawName)))) {
              return true;
            }
            if (item.brand && item.size && item.brand.length >= 2 && item.size.length >= 3) {
              if (cName.includes(item.brand.toLowerCase()) && cName.includes(item.size.toLowerCase())) {
                return true;
              }
            }
            return false;
          });
        }

        const cost =
          typeof item.costPrice === 'string'
            ? parseFloat(item.costPrice.replace(/,/g, '')) || 0
            : Number(item.costPrice) || 0;
        const qty =
          typeof item.quantity === 'string'
            ? parseFloat(item.quantity.replace(/,/g, '')) || 1
            : Math.max(1, Number(item.quantity) || 1);

        let sellPrice =
          typeof item.sellingPrice === 'string'
            ? parseFloat(item.sellingPrice.replace(/,/g, '')) || 0
            : Number(item.sellingPrice) || 0;

        if (sellPrice <= cost && cost > 0) {
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

      if (!parsedData.grandTotal || parsedData.grandTotal === 0) {
        parsedData.grandTotal = parsedData.items.reduce(
          (sum: number, it: any) => sum + (it.lineTotal || it.quantity * it.costPrice || 0),
          0
        );
      }
    }

    const durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      model: usedModel,
      durationMs,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error analyzing invoice in Vercel API:', error);
    let errorMsg = String(error?.message || error || 'เกิดข้อผิดพลาดในการวิเคราะห์บิลด้วย Gemini AI');

    // Convert raw JSON or technical 503 error into friendly Thai message
    if (
      errorMsg.includes('503') ||
      errorMsg.includes('high demand') ||
      errorMsg.includes('UNAVAILABLE')
    ) {
      errorMsg =
        'โมเดล AI ของ Google มีผู้ใช้งานหนาแน่นชั่วคราว (503 High Demand) กรุณากด "ลองสแกนอีกครั้ง" หรือเลือกโมเดล "Gemini 3.1 Flash-Lite" ด้านบนเพื่อสแกนทันที';
    } else if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      errorMsg =
        'โควตาการเรียกใช้งาน Gemini AI เต็มชั่วคราว กรุณารอสักครู่แล้วลองสแกนอีกครั้ง หรือเลือกโมเดล Gemini 3.1 Flash-Lite';
    }

    return res.status(500).json({
      success: false,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    });
  }
}
