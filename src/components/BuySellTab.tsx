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
  Sparkles,
  Layers,
  Banknote,
  Store,
  Warehouse,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProductItem, TireItem, Transaction } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown } from '../utils/stockUtils';

interface BuySellTabProps {
  tires: TireItem[];
  transactions: Transaction[];
  onExecuteTransaction: (
    type: 'sale' | 'purchase',
    items: { tire: TireItem; quantity: number; unitPrice: number }[],
    customerOrSupplier: string,
    note?: string,
    locationTarget?: 'front' | 'warehouse'
  ) => Promise<void>;
  onOpenScanner: () => void;
}

interface CartItem {
  tire: TireItem;
  quantity: number;
  unitPrice: number;
}

export const BuySellTab: React.FC<BuySellTabProps> = ({
  tires,
  transactions,
  onExecuteTransaction,
  onOpenScanner,
}) => {
  const [transactionType, setTransactionType] = useState<'sale' | 'purchase'>('sale');
  const [locationTarget, setLocationTarget] = useState<'front' | 'warehouse'>('front');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available brands
  const brands = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.brand) set.add(t.brand);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [tires]);

  // Suggested price based on transaction type
  const getSuggestedPrice = (tire: TireItem): number => {
    if (transactionType === 'sale') {
      return tire.sellingPrice || tire.price || (tire.costPrice ? Math.round(tire.costPrice * 1.3) : 850);
    } else {
      return tire.costPrice || Math.round((tire.sellingPrice || tire.price || 850) * 0.7);
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
    return tires.filter((t) => {
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
    });
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
        })),
        customer.trim() || (transactionType === 'sale' ? 'ลูกค้าหน้าร้าน' : 'ซัพพลายเออร์ทั่วไป'),
        note.trim() || undefined,
        locationTarget
      );

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      const message =
        transactionType === 'sale'
          ? `ตัดสต็อกขายออก ${totalQuantity} รายการ สำเร็จ!`
          : `รับเข้าคลังและเพิ่มสต็อก ${totalQuantity} รายการ สำเร็จ!`;

      setSuccessMessage(message);
      setErrorMessage(null);
      setCart([]);
      setCustomer('');
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

      {/* Target Location Toggle (หน้าร้าน vs คลังหลังร้าน) */}
      <div className="bg-[#252C33] border border-[#475662] rounded-2xl p-2.5 flex items-center justify-between text-xs">
        <span className="text-[#A0ABB5] text-[11px] font-medium flex items-center gap-1">
          {transactionType === 'sale' ? (
            <>
              <Store className="w-3.5 h-3.5 text-[#F6C90E]" />
              <span>ตัดสต็อกจาก:</span>
            </>
          ) : (
            <>
              <Warehouse className="w-3.5 h-3.5 text-sky-400" />
              <span>นำเข้าจัดเก็บที่:</span>
            </>
          )}
        </span>

        <div className="flex items-center gap-1 bg-[#20262D] p-0.5 rounded-xl border border-[#3A4750]">
          <button
            type="button"
            onClick={() => setLocationTarget('front')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
              locationTarget === 'front'
                ? 'bg-[#F6C90E] text-[#252C33] shadow-sm'
                : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Store className="w-3 h-3" />
            <span>หน้าร้าน</span>
          </button>
          <button
            type="button"
            onClick={() => setLocationTarget('warehouse')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
              locationTarget === 'warehouse'
                ? 'bg-[#F6C90E] text-[#252C33] shadow-sm'
                : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Warehouse className="w-3 h-3" />
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
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#EEEEEE]">
              <Receipt className="w-4 h-4 text-[#F6C90E]" />
              <span>
                {transactionType === 'sale' ? 'รายการตัดสต็อกขาย' : 'รายการรับเข้าสต็อก'} ({cart.length})
              </span>
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

          {/* Customer / Vehicle info */}
          <div className="pt-2 border-t border-[#475662] space-y-2 text-xs">
            <div className="flex gap-2">
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder={
                  transactionType === 'sale'
                    ? 'ชื่อลูกค้า / ทะเบียนรถ (เช่น ช่างอาร์ต, กข 5678)'
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
                        {locationTarget === 'front' ? `ชั้นโชว์: ${breakdown.frontLocation}` : `ช่อง: ${breakdown.warehouseLocation}`}
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
                        targetQty === 0 ? 'text-amber-400' : isZero ? 'text-rose-400' : 'text-[#EEEEEE]'
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

                  <div className="text-right">
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
