export type StockStatus = 'pending' | 'checked' | 'discrepancy';

export interface TireItem {
  id: string;
  brand: string;
  size: string;
  rim: string; // e.g. "12", "14", "13", "10", "17"
  systemQty: number;
  actualQty: number;
  status: StockStatus;
  category: string; // 'Tubeless' | 'Tube'
  location: string; // e.g. "ช่อง A-01-2" or "RACK A-02"
  zone: string; // e.g. "ห้องยางชั้น 2"
  description: string; // e.g. "ยางสปอร์ต สกู๊ตเตอร์", "Vespa Sprint / Grand Filano หน้า"
  minStock: number;
  price?: number; // Standard selling price in THB
  isOem?: boolean;
  oemLabel?: string; // e.g. "OEM ศูนย์"
  imageUrl?: string;
  updatedAt: string;
}

export interface AuditSession {
  id: string;
  code: string; // "AUD-2410-09"
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
  tireId: string;
  tireName: string;
  brand: string;
  diff: number;
  previousQty: number;
  newQty: number;
  action: string;
  timestamp: string;
  note?: string;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'purchase';
  tireId: string;
  tireName: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customerOrSupplier: string;
  note?: string;
  createdAt: string;
}
