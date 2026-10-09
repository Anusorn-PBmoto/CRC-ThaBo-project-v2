export type StockStatus = 'pending' | 'checked' | 'discrepancy';

export type StockLocation = 'front' | 'warehouse';

export interface ProductItem {
  id: string;
  barcode: string;           // 1. ระบบแสกนบาร์โค้ด และรหัสสินค้า
  name: string;              // 2. ชื่อสินค้า
  unit: string;              // 3. หน่วยนับ (ชิ้น, กล่อง, ชุด, เส้น, ขวด, อัน, คู่, แผ่น, ลูก ฯลฯ)
  costPrice: number;         // 4. ราคาซื้อ / ราคาทุน
  sellingPrice: number;      // 5. ราคาขาย
  imageUrl?: string;         // 6. ถ่ายภาพสินค้า
  category?: string;         // หมวดหมู่ (เช่น อะไหล่เครื่องยนต์, ระบบส่งกำลัง, ระบบเบรก, น้ำมันเครื่อง ฯลฯ)
  brand?: string;            // ยี่ห้อ (เช่น Honda, Yamaha, Castrol, Bando, DID, NGK, YSS ฯลฯ)
  location?: string;         // ช่องจัดเก็บ/ชั้นวางในคลังหลังร้าน (เช่น RACK A-01, กล่อง 1, ชั้น 2)
  frontLocation?: string;    // ช่องจัดเก็บ/ชั้นวางหน้าร้าน (เช่น หน้าร้าน A, เคาน์เตอร์, แผงแขวน 1)
  frontQty?: number;         // สต็อกหน้าร้าน (Storefront stock)
  warehouseQty?: number;     // สต็อกคลังหลังร้าน (Warehouse stock)
  systemQty: number;         // ยอดรวมตามระบบ (frontQty + warehouseQty)
  actualQty: number;         // ยอดรวมคงเหลือจริง
  status: StockStatus;       // สถานะตรวจนับ
  minStock?: number;         // จุดเตือนสต็อกรวมต่ำ
  minFrontStock?: number;    // จุดเตือนเติมของหน้าร้านต่ำ
  description?: string;      // รุ่นรถที่รองรับ / รายละเอียด
  updatedAt: string;

  // Compatibility aliases
  size?: string;
  rim?: string;
  price?: number;
  tireId?: string;
  tireName?: string;
  isOem?: boolean;
  oemLabel?: string;
  zone?: string;
}

// Seamless alias for parts
export type TireItem = ProductItem;

export interface StockTransfer {
  id: string;
  productId: string;
  productName: string;
  brand?: string;
  barcode?: string;
  fromLocation: 'warehouse' | 'front';
  toLocation: 'warehouse' | 'front';
  quantity: number;
  note?: string;
  operator?: string;
  timestamp: string;
}

export interface AuditSession {
  id: string;
  code: string;
  zone: string;
  title: string;
  status: 'in_progress' | 'completed';
  totalItems: number;
  checkedItems: number;
  discrepancyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  productId: string;
  productName: string;
  brand?: string;
  diff: number;
  previousQty: number;
  newQty: number;
  action: string;
  timestamp: string;
  note?: string;
  tireId?: string;
  tireName?: string;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'purchase';
  productId: string;
  productName: string;
  brand?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customerOrSupplier: string;
  locationTarget?: 'front' | 'warehouse'; // แหล่งตัดสต็อก (ขาย) หรือ แหล่งเก็บเข้า (ซื้อ)
  note?: string;
  createdAt: string;
  tireId?: string;
  tireName?: string;
}
