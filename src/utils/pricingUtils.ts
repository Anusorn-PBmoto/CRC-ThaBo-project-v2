import { CustomerGrade, CustomerTier, CustomerItem, ProductItem } from '../types';

export const DEFAULT_CUSTOMER_TIERS: CustomerTier[] = [
  {
    grade: 'A',
    name: 'กลุ่ม A (ช่างประจำ / อู่คู่ค้า)',
    discountPercent: 15,
    description: 'ส่วนลดสูงสุดสำหรับช่างประจำและอู่ซ่อมรถคู่ค้า',
    badgeColor: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
  },
  {
    grade: 'B',
    name: 'กลุ่ม B (ลูกค้าส่ง / ซื้อประจำ)',
    discountPercent: 10,
    description: 'ส่วนลดพิเศษสำหรับลูกค้าซื้อส่งและซื้อประจำ',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
  },
  {
    grade: 'C',
    name: 'กลุ่ม C (สมาชิกทั่วไป)',
    discountPercent: 5,
    description: 'ส่วนลดสำหรับลูกค้าสมาชิกทั่วไปที่ลงทะเบียน',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    grade: 'D',
    name: 'กลุ่ม D (ลูกค้าส่วนลดพิเศษ)',
    discountPercent: 2,
    description: 'ส่วนลดเริ่มต้นหรือลูกค้าราคาพิเศษเฉพาะกลุ่ม',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  {
    grade: 'general',
    name: 'ลูกค้าทั่วไป (ราคาปลีก)',
    discountPercent: 0,
    description: 'ราคาขายปลีกมาตรฐาน ไม่มีส่วนลดพิเศษ',
    badgeColor: 'bg-slate-700/60 text-slate-300 border-slate-600',
  },
];

/**
 * Auto-generate customer code with tier/grade prefix (e.g. A000001, B000001, G000001)
 */
export function generateCustomerCode(grade: CustomerGrade, existingCustomers: CustomerItem[] = []): string {
  const prefix = grade === 'general' ? 'G' : grade.toUpperCase();
  const prefixRegex = new RegExp(`^${prefix}(\\d+)$`, 'i');

  let maxNum = 0;
  for (const c of existingCustomers) {
    const code = c.customerCode || '';
    const match = code.match(prefixRegex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

/**
 * Returns safe display customer code (e.g. A000001)
 */
export function getCustomerDisplayCode(customer: CustomerItem | null | undefined): string {
  if (!customer) return '';
  if (customer.customerCode && customer.customerCode.trim()) {
    return customer.customerCode.trim().toUpperCase();
  }
  const prefix = customer.grade === 'general' ? 'G' : customer.grade.toUpperCase();
  return `${prefix}000001`;
}

/**
 * Get tier definition by grade code
 */
export function getTierInfo(grade: CustomerGrade | string, tiers: CustomerTier[] = DEFAULT_CUSTOMER_TIERS): CustomerTier {
  const matched = tiers.find((t) => t.grade === grade);
  if (matched) return matched;
  return tiers.find((t) => t.grade === 'general') || DEFAULT_CUSTOMER_TIERS[4];
}

/**
 * Get display badge styling and label for a customer group
 */
export function getGradeBadge(grade: CustomerGrade | string): {
  label: string;
  badgeClass: string;
  shortLabel: string;
  codePrefix: string;
} {
  switch (grade) {
    case 'A':
      return {
        label: 'กลุ่ม A (ช่าง VIP)',
        shortLabel: 'กลุ่ม A',
        codePrefix: 'A',
        badgeClass: 'bg-amber-400/20 text-amber-300 border-amber-400/50',
      };
    case 'B':
      return {
        label: 'กลุ่ม B (ขายส่ง)',
        shortLabel: 'กลุ่ม B',
        codePrefix: 'B',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
      };
    case 'C':
      return {
        label: 'กลุ่ม C (สมาชิก)',
        shortLabel: 'กลุ่ม C',
        codePrefix: 'C',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      };
    case 'D':
      return {
        label: 'กลุ่ม D (พิเศษ)',
        shortLabel: 'กลุ่ม D',
        codePrefix: 'D',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
      };
    default:
      return {
        label: 'ลูกค้าทั่วไป',
        shortLabel: 'ทั่วไป',
        codePrefix: 'G',
        badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600',
      };
  }
}

export interface CalculatedItemPrice {
  originalPrice: number;        // ราคาตั้งปกติก่อนหักส่วนลด (ต่อหน่วย)
  effectivePrice: number;       // ราคาจริงหลังคิดเกรด/ส่วนลด (ปัดเศษขึ้นเต็มบาท)
  discountPercent: number;      // % ส่วนลดที่ได้รับ
  savingsPerUnit: number;       // ประหยัดได้ต่อหน่วย (บาท)
  isCustomGradePrice: boolean;  // เป็นราคาเฉพาะสินค้าที่ตั้งไว้โดยตรงหรือไม่
  grade: CustomerGrade;
}

/**
 * Calculates effective unit price for a customer based on hybrid model:
 * 1. If product has custom price set for this grade, use it.
 * 2. Otherwise apply the grade's discount percentage to the retail price (rounded up to full baht).
 */
export function calculateItemPriceForCustomer(
  product: ProductItem,
  customerOrGrade?: CustomerItem | CustomerGrade | null,
  tiers: CustomerTier[] = DEFAULT_CUSTOMER_TIERS,
  isSubUnit: boolean = false
): CalculatedItemPrice {
  const grade: CustomerGrade =
    typeof customerOrGrade === 'object' && customerOrGrade !== null
      ? customerOrGrade.grade
      : typeof customerOrGrade === 'string'
      ? (customerOrGrade as CustomerGrade)
      : 'general';

  const baseRetailPrice = product.sellingPrice || product.price || 0;
  const rate = product.conversionRate && product.conversionRate > 1 ? product.conversionRate : 1;

  // Base price per unit (either main unit or subUnit)
  const originalPrice = isSubUnit ? Math.ceil(baseRetailPrice / rate) : baseRetailPrice;

  // Check 1: Custom price specifically set for this grade on this product
  const customMainPrice = product.gradePrices?.[grade];
  if (typeof customMainPrice === 'number' && customMainPrice > 0) {
    const customPrice = isSubUnit ? Math.ceil(customMainPrice / rate) : customMainPrice;
    const savings = Math.max(0, originalPrice - customPrice);
    const discountPct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

    return {
      originalPrice,
      effectivePrice: customPrice,
      discountPercent: discountPct,
      savingsPerUnit: savings,
      isCustomGradePrice: true,
      grade,
    };
  }

  // Check 2: Tier discount percentage
  const tier = getTierInfo(grade, tiers);
  const discountPct = tier.discountPercent || 0;

  if (discountPct > 0) {
    // Formula: Round up to nearest whole baht (per requirement #6)
    const discounted = Math.ceil(originalPrice * (1 - discountPct / 100));
    const effectivePrice = Math.max(0, discounted);
    const savings = Math.max(0, originalPrice - effectivePrice);

    return {
      originalPrice,
      effectivePrice,
      discountPercent: discountPct,
      savingsPerUnit: savings,
      isCustomGradePrice: false,
      grade,
    };
  }

  // Default: Retail price
  return {
    originalPrice,
    effectivePrice: originalPrice,
    discountPercent: 0,
    savingsPerUnit: 0,
    isCustomGradePrice: false,
    grade,
  };
}

/**
 * Sample initial customers for CRC THABO
 */
export const SAMPLE_CUSTOMERS: CustomerItem[] = [
  {
    id: 'cust-bird-01',
    customerCode: 'A000001',
    name: 'ช่างเบิร์ด ซ่อมรถท่าบ่อ',
    phone: '081-234-5678',
    grade: 'A',
    vehiclePlate: '1กข 4567 หนองคาย',
    vehicleModel: 'Wave 110i / Click 125i',
    notes: 'อู่ช่างเบิร์ด ประจำท่าบ่อ ซื้อน้ำมันเครื่องยกลังและยางนอกประจำ',
    totalSpend: 48500,
    purchaseCount: 38,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-art-02',
    customerCode: 'B000001',
    name: 'พี่อาร์ต มอเตอร์ไบค์',
    phone: '089-876-5432',
    grade: 'B',
    vehiclePlate: '2ขค 8910 อุดรธานี',
    vehicleModel: 'PCX 160 / ADV 160',
    notes: 'ลูกค้าขายส่ง อะไหล่แต่งและสายพาน Bando',
    totalSpend: 24600,
    purchaseCount: 16,
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-somchai-03',
    customerCode: 'C000001',
    name: 'สมชาย ใจดี',
    phone: '086-555-1212',
    grade: 'C',
    vehiclePlate: 'กข 9999 หนองคาย',
    vehicleModel: 'Scoopy-i',
    notes: 'ลูกค้าสมาชิกทั่วไป เปลี่ยนถ่ายน้ำมันเครื่องและหัวเทียน',
    totalSpend: 7800,
    purchaseCount: 7,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-wichai-04',
    customerCode: 'D000001',
    name: 'วิชัย คลินิกมอเตอร์ไซค์',
    phone: '090-111-2233',
    grade: 'D',
    vehiclePlate: '3กง 3344 หนองคาย',
    vehicleModel: 'Wave 125i',
    notes: 'ช่างอิสระ รับงานซ่อมทั่วไป',
    totalSpend: 5400,
    purchaseCount: 4,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
