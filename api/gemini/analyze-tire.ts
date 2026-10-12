import type { Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export const config = {
  maxDuration: 60,
};

const VALID_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
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

    const { imageBase64, mimeType = 'image/jpeg', catalog = [] } = body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพ (imageBase64 is required)' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = imageBase64.startsWith('data:')
      ? imageBase64.substring(5, imageBase64.indexOf(';'))
      : mimeType;

    const catalogSummary =
      Array.isArray(catalog) && catalog.length > 0
        ? `รายการสินค้าตัวอย่างในคลัง CRC THABO เพื่อช่วยเทียบเคียง (${catalog.length} รายการ):\n` +
          catalog
            .slice(0, 30)
            .map(
              (c: any) =>
                `- [${c.barcode || 'ไม่มีบาร์โค้ด'}] ${c.brand || ''} ${c.size || ''} ${c.name} (คงเหลือ: ${
                  c.actualQty ?? c.systemQty ?? 0
                })`
            )
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

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let response: any = null;
    let usedModel = VALID_MODELS[0];
    let lastError: any = null;

    for (const model of VALID_MODELS) {
      const isLite = model.includes('lite');
      const callConfig: any = {
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
      };

      if (!isLite) {
        callConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
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

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout with model ${model}`)), 22000)
          );

          const result: any = await Promise.race([genPromise, timeoutPromise]);
          if (result) {
            response = result;
            usedModel = model;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || '');
          if (
            attempt === 1 &&
            (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE'))
          ) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }

      if (response) break;
    }

    if (!response) {
      throw lastError || new Error('ทุกโมเดลของ Gemini AI ไม่พร้อมให้บริการชั่วคราว');
    }

    const rawText = response.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawText);
      if (
        !parsedData.confidence ||
        !['HIGH', 'MEDIUM', 'LOW'].includes(parsedData.confidence.toUpperCase())
      ) {
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

    // Match in catalog
    let matchedItem: any = null;
    if (Array.isArray(catalog) && catalog.length > 0) {
      const cleanBarcode = (parsedData.barcode || '').replace(/[^0-9]/g, '');
      const cleanSize = (parsedData.size || '').toLowerCase().replace(/[\s-]/g, '');
      const cleanBrand = (parsedData.brand || '').toLowerCase().trim();

      if (cleanBarcode) {
        matchedItem = catalog.find(
          (c: any) => (c.barcode || '').replace(/[^0-9]/g, '') === cleanBarcode
        );
      }

      if (!matchedItem && cleanSize) {
        matchedItem = catalog.find((c: any) => {
          const cSize = (c.size || c.name || '').toLowerCase().replace(/[\s-]/g, '');
          const cBrand = (c.brand || '').toLowerCase().trim();
          const brandMatches = cleanBrand
            ? cBrand.includes(cleanBrand) || cleanBrand.includes(cBrand)
            : true;
          return brandMatches && cSize.includes(cleanSize);
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      model: usedModel,
      durationMs,
      data: parsedData,
      matchedItem,
    });
  } catch (error: any) {
    console.error('Error analyzing tire:', error);
    let errorMsg = String(error?.message || error || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ');
    if (
      errorMsg.includes('503') ||
      errorMsg.includes('high demand') ||
      errorMsg.includes('UNAVAILABLE')
    ) {
      errorMsg = 'โมเดล AI กำลังมีผู้ใช้งานหนาแน่นชั่วคราว (503 High Demand) กรุณาลองใหม่อีกครั้ง';
    }
    return res.status(500).json({
      success: false,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    });
  }
}
