/**
 * Product category definitions and normalization utility
 * Unifies redundant categories:
 * - "ยางมอเตอร์ไซค์" -> "ยางนอก"
 * - "น้ำมันเครื่อง", "น้ำมันและเคมีภัณท์", "น้ำมันเครื่องและเคมีภัณฑ์" -> "น้ำมันและเคมีภัณฑ์"
 */

export const STANDARD_CATEGORIES = [
  'ยางนอก',
  'ยางใน',
  'น้ำมันและเคมีภัณฑ์',
  'ระบบส่งกำลัง',
  'ระบบเบรก',
  'แบตเตอรี่และระบบไฟ',
  'อะไหล่ทั่วไป',
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

export function normalizeCategory(category?: string | null): string {
  if (!category) return 'อะไหล่ทั่วไป';
  const trimmed = category.trim();
  if (!trimmed) return 'อะไหล่ทั่วไป';

  // Merge motorcycle tires into "ยางนอก"
  if (trimmed === 'ยางมอเตอร์ไซค์') {
    return 'ยางนอก';
  }

  // Merge redundant engine oils & chemicals into "น้ำมันและเคมีภัณฑ์"
  if (
    trimmed === 'น้ำมันเครื่อง' ||
    trimmed === 'น้ำมันและเคมีภัณท์' ||
    trimmed === 'น้ำมันและเคมีภัณฑ์' ||
    trimmed === 'น้ำมันเครื่องและเคมีภัณฑ์' ||
    trimmed === 'น้ำมัน' ||
    trimmed === 'เคมีภัณฑ์' ||
    trimmed.startsWith('น้ำมันเครื่อง')
  ) {
    return 'น้ำมันและเคมีภัณฑ์';
  }

  return trimmed;
}
