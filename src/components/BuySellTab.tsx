import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  PackagePlus,
  Search,
  ScanBarcode,
  CheckCircle,
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  Banknote,
  Store,
  Warehouse,
  ArrowRight,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProductItem, TireItem, Transaction, CustomerItem, CustomerTier, CustomerGrade } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown } from '../utils/stockUtils';
import { ReceiptModal, ReceiptData } from './ReceiptModal';
import { CustomerPickerModal } from './CustomerPickerModal';
import { CustomerManagementModal } from './CustomerManagementModal';
import {
  calculateItemPriceForCustomer,
  getGradeBadge,
  getTierInfo,
  DEFAULT_CUSTOMER_TIERS,
} from '../utils/pricingUtils';

interface BuySellTabProps {
  tires: TireItem[];
  transactions: Transaction[];
  customers?: CustomerItem[];
  customerTiers?: CustomerTier[];
  onExecuteTransaction: (
    type: 'sale' | 'purchase',
    items: { tire: TireItem; quantity: number; unitPrice: number; isSubUnit?: boolean }[],
    customerOrSupplier: string,
    note?: string,
    locationTarget?: 'front' | 'warehouse',
    customerId?: string,
    customerGrade?: CustomerGrade
  ) => Promise<void>;
  onOpenScanner: () => void;
  onOpenStaffPos?: () => void;
  incomingSearchQuery?: string;
  onSaveCustomer?: (cust: CustomerItem) => Promise<void> | void;
  onDeleteCustomer?: (customerId: string) => Promise<void> | void;
  onSaveTiers?: (tiers: CustomerTier[]) => Promise<void> | void;
  onUpdateCustomerSpend?: (customerId: string, addAmount: number) => void;
}

interface CartItem {
  tire: TireItem;
  quantity: number;
  unitPrice: number;
  isSubUnit?: boolean;
}

export const BuySellTab: React.FC<BuySellTabProps> = ({
  tires,
  transactions,
  customers = [],
  customerTiers = DEFAULT_CUSTOMER_TIERS,
  onExecuteTransaction,
  onOpenScanner,
  onOpenStaffPos,
  incomingSearchQuery,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveTiers,
  onUpdateCustomerSpend,
}) => {
  const [transactionType, setTransactionType] = useState<'sale' | 'purchase'>('sale');
  const [locationTarget, setLocationTarget] = useState<'front' | 'warehouse'>('front');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isCustomerManagementOpen, setIsCustomerManagementOpen] = useState(false);
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState(incomingSearchQuery || '');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  const openReceiptFromTransaction = (tx: Transaction) => {
    const dateObj = new Date(tx.createdAt || Date.now());
    const receiptPayload: ReceiptData = {
      receiptNo: `REC-${tx.id.slice(-8).toUpperCase()}`,
      dateStr: dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      customer: tx.customerOrSupplier || 'ลูกค้าหน้าร้าน',
      locationTarget: tx.locationTarget || 'front',
      items: [
        {
          name: tx.tireName || tx.productName || 'สินค้า',
          brand: tx.brand,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          totalPrice: tx.totalPrice || tx.quantity * tx.unitPrice,
        },
      ],
      totalAmount: tx.totalPrice || tx.quantity * tx.unitPrice,
      totalQuantity: tx.quantity,
      note: tx.note,
    };
    setActiveReceipt(receiptPayload);
  };

  // Available brands
  const brands = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  // Suggested price based on transaction type and selected customer grade
  const getSuggestedPrice = (tire: TireItem): number => {
    if (transactionType === 'sale') {
      const calc = calculateItemPriceForCustomer(
        tire,
        selectedCustomer,
        customerTiers
      );
      return calc.effectivePrice;
    } else {
      return tire.costPrice || Math.round((tire.sellingPrice || tire.price || 850) * 0.7);
    }
  };

  // Handle selecting customer from picker
  const handleSelectCustomer = (cust: CustomerItem | null) => {
    setSelectedCustomer(cust);
    if (cust) {
      setCustomer(cust.name);
    } else {
      setCustomer('ลูกค้าหน้าร้าน');
    }

    // Recalculate prices in cart based on newly selected customer's grade
    if (transactionType === 'sale') {
      setCart((prev) =>
        prev.map((item) => {
          const calc = calculateItemPriceForCustomer(
            item.tire,
            cust,
            customerTiers,
            Boolean(item.isSubUnit)
          );
          return {
            ...item,
            unitPrice: calc.effectivePrice,
          };
        })
      );
    }
  };

  // Add tire to active bill/cart
  const addToCart = (tire: TireItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.tire.id === tire.id);
      if (existing) {
        return prev.map((item) =>
          item.tire.id === tire.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          tire,
          quantity: 1,
          unitPrice: getSuggestedPrice(tire),
        },
      ];
    });
  };

  // Update item quantity with +/- buttons
  const updateCartQty = (tireId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.tire.id === tireId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Set direct quantity typed by user
  const setCartDirectQty = (tireId: string, val: number | string) => {
    const parsed = typeof val === 'string' ? (val === '' ? 1 : parseInt(val, 10)) : val;
    const safeQty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setCart((prev) =>
      prev.map((item) => (item.tire.id === tireId ? { ...item, quantity: safeQty } : item))
    );
  };

  // Update custom unit price
  const updateCartPrice = (tireId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) => (item.tire.id === tireId ? { ...item, unitPrice: price } : item))
    );
  };

  // Remove single item from bill
  const removeFromCart = (tireId: string) => {
    setCart((prev) => prev.filter((item) => item.tire.id !== tireId));
  };

  // Calculate totals
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Filter tires for selection list
  const filteredTires = useMemo(() => {
    return tires
      .filter((t) => {
        const q = searchQuery.toLowerCase();
        const matchQuery =
          (t.name || t.size || '').toLowerCase().includes(q) ||
          (t.brand || '').toLowerCase().includes(q) ||
          (t.barcode || '').toLowerCase().includes(q) ||
          (t.location || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q);

        const matchBrand =
          selectedBrand === 'ทั้งหมด' || (t.brand || '').toLowerCase() === selectedBrand.toLowerCase();

        return matchQuery && matchBrand;
      })
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [tires, searchQuery, selectedBrand]);

  // Execute transaction (Stock cut or Purchase intake)
  const handleSubmit = async () => {
    if (cart.length === 0) {
      setErrorMessage('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    if (transactionType === 'sale') {
      // Check stock sufficiency
      for (const item of cart) {
        if (item.quantity > item.tire.actualQty) {
          setErrorMessage(
            `สินค้า ${item.tire.brand} ${item.tire.size} มีคงเหลือในคลังเพียง ${item.tire.actualQty} ชิ้น (สั่งขาย ${item.quantity} ชิ้น)`
          );
          return;
        }
      }
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await onExecuteTransaction(
        transactionType,
        cart.map((item) => ({
          tire: item.tire,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isSubUnit: item.isSubUnit,
        })),
        customer.trim() || (transactionType === 'sale' ? 'ลูกค้าหน้าร้าน' : 'ซัพพลายเออร์ทั่วไป'),
        note.trim() || undefined,
        locationTarget,
        selectedCustomer?.id,
        selectedCustomer?.grade
      );

      if (transactionType === 'sale' && selectedCustomer && onUpdateCustomerSpend) {
        onUpdateCustomerSpend(selectedCustomer.id, totalAmount);
      }

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      if (transactionType === 'sale') {
        const now = new Date();
        const receiptNo = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
          now.getDate()
        ).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

        const receiptPayload: ReceiptData = {
          receiptNo,
          dateStr: now.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
          timeStr: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          customer: customer.trim() || 'ลูกค้าหน้าร้าน',
          locationTarget,
          items: cart.map((item) => ({
            name: item.tire.name || item.tire.size || 'สินค้า',
            brand: item.tire.brand,
            size: item.tire.size,
            unit: item.tire.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
          totalAmount,
          totalQuantity,
          note: note.trim() || undefined,
        };
        setActiveReceipt(receiptPayload);
      }

      const message =
        transactionType === 'sale'
          ? `ตัดสต็อกขายออก ${totalQuantity} รายการ สำเร็จ!`
          : `รับเข้าคลังและเพิ่มสต็อก ${totalQuantity} รายการ สำเร็จ!`;

      setSuccessMessage(message);
      setErrorMessage(null);
      setCart([]);
      setCustomer('');
      setSelectedCustomer(null);
      setNote('');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (error) {
      console.error('Transaction execution failed:', error);
      setErrorMessage('เกิดข้อผิดพลาดในการตัดสต็อก กรุณาลองใหม่อีกครั้ง');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pb-32 pt-2 px-3 space-y-3.5 max-w-md mx-auto font-['Prompt',sans-serif]">
      {/* Quick Staff POS Mode Banner */}
      {onOpenStaffPos && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-[#252C33] to-[#252C33] border border-emerald-500/40 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-[#EEEEEE] block">
                โหมดหน้าขายสำหรับพนักงาน (Staff POS)
              </span>
              <span className="text-[10px] text-[#A0ABB5] block truncate">
                โครงสร้างเรียบง่าย ปุ่มใหญ่ สแกนแล้วตัดสต็อกทันที
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenStaffPos}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-sm flex-shrink-0 cursor-pointer"
          >
            <span>ทดลองเปิด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Transaction Type Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#3A4750] border border-[#475662] rounded-2xl">
        <button
          onClick={() => setTransactionType('sale')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            transactionType === 'sale'
              ? 'bg-[#F6C90E] text-[#252C33] shadow-md shadow-[#F6C90E]/20'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>ขายออก / ตัดสต็อก</span>
        </button>

        <button
          onClick={() => {
            setTransactionType('purchase');
            setLocationTarget('warehouse');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            transactionType === 'purchase'
              ? 'bg-[#252C33] text-[#EEEEEE] border border-[#475662] shadow-md'
              : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
          }`}
        >
          <PackagePlus className="w-4 h-4 text-[#F6C90E]" />
          <span>ซื้อเข้า / รับของ</span>
        </button>
      </div>

      {/* Target Location Toggle (หน้าร้าน vs คลังหลังร้าน) - Full Width & Distinct Colors */}
      <div className="bg-[#20262D] border border-[#475662] rounded-2xl p-3 shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs px-0.5">
          <span className="text-[#A0ABB5] text-[11px] font-medium flex items-center gap-1.5">
            {transactionType === 'sale' ? (
              <>
                <Store className="w-3.5 h-3.5 text-[#F6C90E]" />
                <span>ตำแหน่งที่จะตัดสต็อก:</span>
              </>
            ) : (
              <>
                <Warehouse className="w-3.5 h-3.5 text-sky-400" />
                <span>ตำแหน่งที่จะรับเข้าจัดเก็บ:</span>
              </>
            )}
          </span>

          <span className="text-[11px] font-bold">
            {locationTarget === 'front' ? (
              <span className="text-[#F6C90E] bg-[#F6C90E]/15 border border-[#F6C90E]/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Store className="w-3 h-3" /> หน้าร้าน
              </span>
            ) : (
              <span className="text-sky-300 bg-sky-500/15 border border-sky-400/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Warehouse className="w-3 h-3 text-sky-400" /> คลังหลังร้าน
              </span>
            )}
          </span>
        </div>

        {/* Full-width 2-column segmented bar spanning edge-to-edge */}
        <div className="grid grid-cols-2 gap-2 w-full p-1 bg-[#1A1F26] rounded-xl border border-[#3A4750]">
          {/* หน้าร้าน (Gold theme) */}
          <button
            type="button"
            onClick={() => setLocationTarget('front')}
            className={`w-full py-2.5 sm:py-3 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
              locationTarget === 'front'
                ? 'bg-[#F6C90E] text-[#20262D] shadow-md shadow-[#F6C90E]/25 border border-[#F6C90E]'
                : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2C353F] border border-[#3A4750]'
            }`}
          >
            <Store className={`w-4 h-4 ${locationTarget === 'front' ? 'text-[#20262D]' : 'text-[#F6C90E]'}`} />
            <span>หน้าร้าน</span>
          </button>

          {/* คลังหลังร้าน (Vibrant Blue theme) */}
          <button
            type="button"
            onClick={() => setLocationTarget('warehouse')}
            className={`w-full py-2.5 sm:py-3 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
              locationTarget === 'warehouse'
                ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/30 border border-sky-400'
                : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#2C353F] border border-[#3A4750]'
            }`}
          >
            <Warehouse className={`w-4 h-4 ${locationTarget === 'warehouse' ? 'text-white' : 'text-sky-400'}`} />
            <span>คลังหลังร้าน</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3 bg-[#3A4750] border border-[#F6C90E] rounded-2xl flex items-center gap-2 text-[#EEEEEE] text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-[#F6C90E] flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-2xl flex items-center gap-2 text-rose-300 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Active Cart / Bill (If items selected) */}
      {cart.length > 0 && (
        <div className="bg-[#3A4750] border border-[#F6C90E]/40 rounded-2xl p-3.5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#475662]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#EEEEEE] flex-wrap">
              <Receipt className="w-4 h-4 text-[#F6C90E]" />
              <span>
                {transactionType === 'sale' ? 'รายการตัดสต็อกขาย' : 'รายการรับเข้าสต็อก'} ({cart.length})
              </span>
              {locationTarget === 'front' ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F6C90E]/20 text-[#F6C90E] border border-[#F6C90E]/40 inline-flex items-center gap-1">
                  <Store className="w-2.5 h-2.5" /> หน้าร้าน
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 inline-flex items-center gap-1">
                  <Warehouse className="w-2.5 h-2.5" /> คลังหลังร้าน
                </span>
              )}
            </div>
            <button
              onClick={() => setCart([])}
              className="text-[11px] text-[#A0ABB5] hover:text-rose-400"
            >
              ล้างทั้งหมด
            </button>
          </div>

          {/* Cart items list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.map((item) => {
              const currentStock = item.tire.actualQty;
              const isInsufficient = transactionType === 'sale' && item.quantity > currentStock;

              return (
                <div
                  key={item.tire.id}
                  className="bg-[#252C33] border border-[#475662] rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#EEEEEE] text-xs truncate">
                      {item.tire.name || `${item.tire.brand} ${item.tire.size}`}
                    </div>
                    <div className="text-[10px] text-[#A0ABB5] mt-0.5 flex items-center gap-1.5">
                      <span>ในคลัง: {currentStock} {item.tire.unit || 'ชิ้น'}</span>
                      <span>•</span>
                      <span>{item.tire.location}</span>
                    </div>
                    {isInsufficient && (
                      <div className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>ยอดในคลังไม่พอ ({currentStock})</span>
                      </div>
                    )}
                  </div>

                  {/* Quantity controls (รองรับการพิมพ์กรอกตัวเลขโดยตรง) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateCartQty(item.tire.id, -1)}
                      className="w-7 h-7 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-bold flex items-center justify-center active:scale-95 border border-[#475662]"
                      title="ลดจำนวน"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setCartDirectQty(item.tire.id, 1);
                        } else {
                          setCartDirectQty(item.tire.id, parseInt(val, 10) || 1);
                        }
                      }}
                      className="w-12 h-7 text-center font-bold text-[#F6C90E] font-mono text-sm bg-[#3A4750] border border-[#475662] rounded-lg focus:border-[#F6C90E] focus:outline-none px-1 py-0"
                      title="พิมพ์กรอกจำนวนได้"
                    />

                    <button
                      onClick={() => updateCartQty(item.tire.id, 1)}
                      className="w-7 h-7 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] font-bold flex items-center justify-center active:scale-95 border border-[#475662]"
                      title="เพิ่มจำนวน"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Unit price input */}
                  <div className="flex items-center gap-1 flex-shrink-0 w-20">
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateCartPrice(item.tire.id, Number(e.target.value))}
                      className="w-full bg-[#3A4750] border border-[#475662] text-[#F6C90E] font-mono text-right rounded-lg px-2 py-1 text-xs focus:border-[#F6C90E] focus:outline-none"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeFromCart(item.tire.id)}
                    className="p-1 text-[#A0ABB5] hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Customer / Vehicle info with Tier Pricing Support */}
          <div className="pt-2 border-t border-[#475662] space-y-2 text-xs">
            {transactionType === 'sale' && (
              <div className="flex items-center justify-between gap-2 bg-[#252C33] border border-[#475662] rounded-xl p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsCustomerPickerOpen(true)}
                    className="py-1 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>เลือกลูกค้า / สมาชิก</span>
                  </button>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-white text-xs truncate">
                        {selectedCustomer.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          getGradeBadge(selectedCustomer.grade).badgeClass
                        }`}
                      >
                        {getGradeBadge(selectedCustomer.grade).shortLabel}
                        {getTierInfo(selectedCustomer.grade, customerTiers).discountPercent > 0
                          ? ` (-${getTierInfo(selectedCustomer.grade, customerTiers).discountPercent}%)`
                          : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">ลูกค้าทั่วไป (ราคามาตรฐาน)</span>
                  )}
                </div>

                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer(null)}
                    className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-0.5"
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                    setSelectedCustomer(null);
                  }
                }}
                placeholder={
                  transactionType === 'sale'
                    ? 'พิมพ์ชื่อลูกค้า / ทะเบียนรถ หรือกดปุ่มเลือกลูกค้าด้านบน'
                    : 'ชื่อผู้แทนจำหน่าย / บริษัทจัดส่ง'
                }
                className="flex-1 bg-[#252C33] border border-[#475662] text-[#EEEEEE] placeholder-[#A0ABB5] rounded-xl px-3 py-2 focus:border-[#F6C90E] focus:outline-none text-xs"
              />
            </div>

            {/* Quick Customer presets */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar text-[10px]">
              {['ลูกค้าหน้าร้าน', 'ช่างเบิร์ด ซ่อมรถ', 'Wave 110i', 'PCX160', 'Vespa Filano'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomer(preset)}
                  className="px-2 py-0.5 rounded-lg bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662] whitespace-nowrap"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Total Summary & Confirm Button */}
            <div className="bg-[#252C33] border border-[#475662] rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#A0ABB5] block">รวม {totalQuantity} รายการ</span>
                <span className="text-base font-extrabold font-mono text-[#F6C90E]">
                  ฿{totalAmount.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] shadow-[#F6C90E]/20"
              >
                <CheckCircle className="w-4 h-4 text-[#252C33]" />
                <span>
                  {isProcessing
                    ? 'กำลังตัดสต็อก...'
                    : transactionType === 'sale'
                    ? '⚡ ตัดสต็อกและยืนยันการขาย'
                    : '📥 บันทึกรับเข้าและเพิ่มสต็อก'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search & Product Selection Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเพื่อตัดสต็อก (รหัส, ชื่อ, แบรนด์)"
              className="w-full bg-[#252C33] text-[#EEEEEE] placeholder-[#A0ABB5] text-xs rounded-xl pl-9 pr-3 py-2 border border-[#475662] focus:outline-none focus:border-[#F6C90E]"
            />
          </div>

          <button
            onClick={onOpenScanner}
            title="สแกนบาร์โค้ด"
            className="p-2 bg-[#3A4750] hover:bg-[#43525D] text-[#F6C90E] rounded-xl border border-[#475662] active:scale-95 transition-all"
          >
            <ScanBarcode className="w-4 h-4" />
          </button>
        </div>

        {/* Brand chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedBrand.toLowerCase() === b.toLowerCase()
                  ? 'bg-[#F6C90E] text-[#252C33] font-bold shadow-sm'
                  : 'bg-[#3A4750] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#475662]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Product Cards for Fast Selection */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-[#A0ABB5] px-1 flex items-center justify-between">
          <span>แตะเพื่อเพิ่มเข้าบิลตัดสต็อก:</span>
          <span>{filteredTires.length} รายการ</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {filteredTires.map((tire) => {
            const price = getSuggestedPrice(tire);
            const breakdown = getProductStockBreakdown(tire);
            const targetQty = locationTarget === 'front' ? breakdown.frontQty : breakdown.warehouseQty;
            const isZero = tire.actualQty === 0;
            const tireImg = resolveProductImage(tire);

            return (
              <div
                key={tire.id}
                onClick={() => addToCart(tire)}
                className="bg-[#3A4750] hover:bg-[#43525D] active:scale-[0.99] border border-[#475662] rounded-2xl p-3 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  {/* Left Side: Product Photo Thumbnail */}
                  {tireImg && tireImg.trim() !== '' && (
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-[#252C33] border border-[#475662] flex-shrink-0 flex items-center justify-center shadow-inner">
                      <img
                        src={tireImg}
                        alt={tire.name || tire.size || 'สินค้า'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[#EEEEEE] text-xs">
                        {tire.name || tire.size}
                      </span>
                      {tire.unit && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#252C33] text-[#EEEEEE] border border-[#475662]">
                          {tire.unit}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#A0ABB5] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        {locationTarget === 'front' ? `หน้าร้าน: ${breakdown.frontLocation}` : `ช่อง: ${breakdown.warehouseLocation}`}
                      </span>
                      <span>•</span>
                      <span className="text-[#F6C90E]">
                        หน้าร้าน: {breakdown.frontQty}
                      </span>
                      <span>•</span>
                      <span className="text-sky-300">
                        คลัง: {breakdown.warehouseQty}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right flex-shrink-0">
                  <div>
                    <span className="text-xs font-bold font-mono text-[#F6C90E] block">
                      ฿{price.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        targetQty === 0
                          ? 'text-amber-400'
                          : isZero
                          ? 'text-rose-400'
                          : locationTarget === 'warehouse'
                          ? 'text-sky-300 font-bold'
                          : 'text-[#F6C90E] font-bold'
                      }`}
                    >
                      {locationTarget === 'front'
                        ? `หน้าร้าน ${breakdown.frontQty} ${tire.unit || 'ชิ้น'}`
                        : `ในคลัง ${breakdown.warehouseQty} ${tire.unit || 'ชิ้น'}`}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-[#252C33] group-hover:bg-[#F6C90E] group-hover:text-[#252C33] text-[#F6C90E] flex items-center justify-center transition-all border border-[#475662]">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recent Transactions History */}
      <div className="space-y-2 pt-3 border-t border-[#475662]">
        <div className="flex items-center gap-2 px-1">
          <Clock className="w-3.5 h-3.5 text-[#F6C90E]" />
          <h3 className="text-xs font-bold text-[#EEEEEE] tracking-wider">
            รายการซื้อขาย & ตัดสต็อกล่าสุด ({transactions.length})
          </h3>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-[#3A4750] border border-[#475662] rounded-2xl p-6 text-center text-[#A0ABB5] text-xs">
            ยังไม่มีรายการซื้อขายในระบบ
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 8).map((tx) => {
              const isSale = tx.type === 'sale';
              return (
                <div
                  key={tx.id}
                  className="bg-[#3A4750] border border-[#475662] rounded-2xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                        isSale
                          ? 'bg-[#252C33] text-[#F6C90E] border border-[#F6C90E]/40'
                          : 'bg-[#252C33] text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isSale ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-[#EEEEEE] text-xs">
                        {tx.tireName}
                      </div>
                      <div className="text-[10px] text-[#A0ABB5] mt-0.5">
                        {isSale ? 'ขายให้: ' : 'รับจาก: '}
                        <span className="text-[#EEEEEE]">{tx.customerOrSupplier}</span>
                        {tx.note && ` • ${tx.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div
                        className={`font-mono font-bold ${
                          isSale ? 'text-[#F6C90E]' : 'text-emerald-400'
                        }`}
                      >
                        {isSale ? `-${tx.quantity}` : `+${tx.quantity}`} รายการ
                      </div>
                      <div className="text-[10px] text-[#A0ABB5] font-mono">
                        ฿{tx.totalPrice?.toLocaleString() || (tx.quantity * tx.unitPrice).toLocaleString()}
                      </div>
                    </div>

                    {isSale && (
                      <button
                        type="button"
                        onClick={() => openReceiptFromTransaction(tx)}
                        title="ดูและพิมพ์ใบเสร็จ"
                        className="p-2 rounded-xl bg-[#252C33] hover:bg-[#2E3740] text-[#F6C90E] border border-[#475662] hover:border-[#F6C90E] active:scale-95 transition-all shadow-sm cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        receipt={activeReceipt}
      />

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        customers={customers}
        customerTiers={customerTiers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={handleSelectCustomer}
        onOpenAddNewCustomer={() => {
          setIsCustomerPickerOpen(false);
          setIsCustomerManagementOpen(true);
        }}
      />

      {/* Customer Management Modal */}
      <CustomerManagementModal
        isOpen={isCustomerManagementOpen}
        onClose={() => setIsCustomerManagementOpen(false)}
        customers={customers}
        customerTiers={customerTiers}
        onSaveCustomer={onSaveCustomer || (() => {})}
        onDeleteCustomer={onDeleteCustomer || (() => {})}
        onSaveTiers={onSaveTiers || (() => {})}
      />
    </div>
  );
};
