import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ',
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
      fileBase64,
      imageBase64,
      mimeType = 'application/pdf',
      catalog = [],
      preferredModel = 'auto',
    } = body || {};

    const rawBase64 = fileBase64 || imageBase64;
    if (!rawBase64) {
      return res.status(400).json({
        success: false,
        error: 'ไม่พบข้อมูลไฟล์เอกสาร (fileBase64 is required)',
      });
    }

    const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = rawBase64.startsWith('data:')
      ? rawBase64.substring(5, rawBase64.indexOf(';'))
      : mimeType;

    const catalogMiniList =
      Array.isArray(catalog) && catalog.length > 0
        ? `ตัวอย่างแคตตาล็อกสินค้าในระบบ CRC THABO สำหรับเทียบรหัส/ชื่อ (${catalog.length} รายการ):\n` +
          catalog
            .slice(0, 40)
            .map((c: any) => `- ID: ${c.id} | Barcode: ${c.barcode || '-'} | Name: ${c.name || ''}`)
            .join('\n')
        : 'ยังไม่มีแคตตาล็อกสินค้า';

    const systemPrompt = `คุณคือผู้ช่วยจัดการสต็อกสินค้าอัจฉริยะ (AI Inventory & Stock Audit Assistant) สำหรับร้านอะไหล่รถจักรยานยนต์และยานยนต์ CRC THABO
หน้าที่ของคุณคืออ่านเอกสาร "รายงานตรวจนับสต็อก / สรุปสินค้าคงเหลือ / ใบตรวจนับคลัง / บิลส่งของ (Stock Audit / Inventory Count / Delivery Sheet)"
ที่แนบมาในรูปแบบ PDF หรือรูปภาพ และสกัดข้อมูลสินค้าทุกรายการเพื่อนำไปปรับปรุงยอดสต็อกจริงในระบบ:

1. สกัดรายการสินค้า (items) แต่ละรายการ:
   - barcode: รหัสสินค้า หรือรหัสบาร์โค้ด (เช่น 5205, YTZ6, 885123456001 ฯลฯ)
   - name: ชื่อสินค้าภาษาไทยที่ถูกต้องและอ่านง่าย (เช่น 'ยางนอก IRC 70/90-17 MAXING', 'น้ำมันเครื่อง Furio 4T 0.8L', 'หัวเทียน NGK C6HSA')
   - brand: ยี่ห้อสินค้า (เช่น IRC, Michelin, Honda, Yamaha, บางจาก, YUASA, NGK ฯลฯ)
   - quantity: จำนวนสต็อกที่ตรวจนับได้ หรือจำนวนคงเหลือในเอกสาร (ตัวเลขจำนวนเต็ม)
   - frontQty: จำนวนหน้าร้าน (ถ้ามีระบุแยก)
   - warehouseQty: จำนวนคลังหลัง (ถ้ามีระบุแยก)
   - unit: หน่วยนับ (เช่น ชิ้น, เส้น, ลัง, ขวด, อัน, ตัว, กล่อง, ชุด)
   - costPrice: ราคาทุน (ถ้ามี)
   - sellingPrice: ราคาขาย (ถ้ามี)
   - location: ตำแหน่งจัดเก็บหรือชั้นวาง (ถ้ามี)
   - note: หมายเหตุเพิ่มเติม
2. documentTitle: ชื่อเอกสาร (เช่น รายงานตรวจนับสินค้าปลายงวด, สรุปสต็อกคลัง)
3. summary: สรุปภาพรวมสั้นๆ เป็นภาษาไทย เช่น "พบ 28 รายการตรวจนับ ยอดรวม 240 ชิ้น"`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const candidateModels =
      preferredModel && preferredModel !== 'auto'
        ? [preferredModel, 'gemini-2.5-flash', 'gemini-2.0-flash']
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    let lastError: any = null;
    let responseText = '';
    let usedModel = candidateModels[0];

    for (const modelName of candidateModels) {
      try {
        const resp = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: detectedMime || 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              text: systemPrompt + '\n\n' + catalogMiniList,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                documentTitle: { type: Type.STRING },
                date: { type: Type.STRING },
                summary: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      barcode: { type: Type.STRING },
                      name: { type: Type.STRING },
                      brand: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      frontQty: { type: Type.NUMBER },
                      warehouseQty: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      costPrice: { type: Type.NUMBER },
                      sellingPrice: { type: Type.NUMBER },
                      location: { type: Type.STRING },
                      note: { type: Type.STRING },
                    },
                    required: ['name', 'quantity'],
                  },
                },
              },
              required: ['items'],
            },
          },
        });

        if (resp && resp.text) {
          responseText = resp.text;
          usedModel = modelName;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Stock PDF AI] Model ${modelName} attempt failed:`, err?.message);
      }
    }

    if (!responseText) {
      throw lastError || new Error('ไม่สามารถอ่านเอกสารด้วย Gemini AI ได้ กรุณาลองใหม่อีกครั้ง');
    }

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const parsedData = JSON.parse(cleanJson);
    return res.status(200).json({
      success: true,
      model: usedModel,
      durationMs: Date.now() - startTime,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error analyzing stock file with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์เอกสารสต็อกด้วย Gemini',
      durationMs: Date.now() - startTime,
    });
  }
}
