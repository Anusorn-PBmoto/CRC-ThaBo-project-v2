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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProductItem, TireItem, Transaction } from '../types';

interface BuySellTabProps {
  tires: TireItem[];
  transactions: Transaction[];
  onExecuteTransaction: (
    type: 'sale' | 'purchase',
    items: { tire: TireItem; quantity: number; unitPrice: number }[],
    customerOrSupplier: string,
    note?: string
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
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

  // Suggested price based on transaction type (sale vs purchase)
  const getSuggestedPrice = (item: ProductItem) => {
    if (transactionType === 'sale') {
      return item.sellingPrice || item.price || 0;
    } else {
      return item.costPrice || (item.sellingPrice ? Math.round(item.sellingPrice * 0.7) : 0);
    }
  };

  // Filter products for selection
  const filteredTires = useMemo(() => {
    return tires.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (item.name || item.size || '').toLowerCase().includes(q) ||
        (item.barcode || '').toLowerCase().includes(q) ||
        (item.brand || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);

      const matchBrand =
        selectedBrand === 'ทั้งหมด' ||
        (item.brand || '').toLowerCase() === selectedBrand.toLowerCase() ||
        (item.category || '').toLowerCase() === selectedBrand.toLowerCase();

      return matchSearch && matchBrand;
    });
  }, [tires, searchQuery, selectedBrand]);

  // Add tire to cart
  const addToCart = (tire: TireItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.tire.id === tire.id);
      if (existing) {
        return prev.map((item) =>
          item.tire.id === tire.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            tire,
            quantity: 1,
            unitPrice: getSuggestedPrice(tire),
          },
        ];
      }
    });
  };

  // Update quantity in cart
  const updateCartQty = (tireId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.tire.id === tireId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Update unit price in cart
  const updateCartPrice = (tireId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.tire.id === tireId ? { ...item, unitPrice: Math.max(0, price) } : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (tireId: string) => {
    setCart((prev) => prev.filter((item) => item.tire.id !== tireId));
  };

  // Totals
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Submit Transaction & Auto cut stock
  const handleSubmit = async () => {
    if (cart.length === 0) return;

    // Check stock for sales
    if (transactionType === 'sale') {
      const overStockItem = cart.find((item) => item.quantity > item.tire.actualQty);
      if (overStockItem && overStockItem.tire.actualQty === 0) {
        if (
          !window.confirm(
            `ยาง ${overStockItem.tire.brand} ${overStockItem.tire.size} ในคลังเหลือ 0 เส้น คุณต้องการขายและตัดสต็อกติดลบหรือไม่?`
          )
        ) {
          return;
        }
      }
    }

    setIsProcessing(true);
    try {
      await onExecuteTransaction(
        transactionType,
        cart,
        customer.trim() || (transactionType === 'sale' ? 'ลูกค้าหน้าร้าน' : 'ตัวแทนจำหน่าย'),
        note.trim()
      );

      // Trigger celebratory effect
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: transactionType === 'sale' ? ['#10b981', '#34d399', '#f59e0b'] : ['#38bdf8', '#818cf8'],
      });

      const message =
        transactionType === 'sale'
          ? `ตัดสต็อกขายออก ${totalQuantity} เส้น สำเร็จ!`
          : `รับเข้าคลังและเพิ่มสต็อก ${totalQuantity} เส้น สำเร็จ!`;

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
    <div className="pb-32 pt-2 px-3 space-y-3.5 max-w-md mx-auto">
      {/* 1. Transaction Type Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#121c2e] border border-slate-800 rounded-2xl">
        <button
          onClick={() => setTransactionType('sale')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            transactionType === 'sale'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>ขายออก / ตัดสต็อก</span>
        </button>

        <button
          onClick={() => setTransactionType('purchase')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            transactionType === 'purchase'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span>ซื้อเข้า / รับของ</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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
        <div className="bg-[#121c2e] border border-amber-500/40 rounded-2xl p-3.5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>
                {transactionType === 'sale' ? 'รายการตัดสต็อกขาย' : 'รายการรับเข้าสต็อก'} ({cart.length})
              </span>
            </div>
            <button
              onClick={() => setCart([])}
              className="text-[11px] text-slate-400 hover:text-rose-400"
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
                  className="bg-[#17253d] border border-slate-750 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-100 text-xs truncate">
                      {item.tire.brand} {item.tire.size}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>ในคลัง: {currentStock} เส้น</span>
                      <span>•</span>
                      <span>{item.tire.location}</span>
                    </div>
                    {isInsufficient && (
                      <div className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>ยอดในคลังไม่พอ ({currentStock} เส้น)</span>
                      </div>
                    )}
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateCartQty(item.tire.id, -1)}
                      className="w-7 h-7 rounded-lg bg-[#203250] hover:bg-[#283e63] text-slate-200 font-bold flex items-center justify-center active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold text-amber-300 font-mono text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.tire.id, 1)}
                      className="w-7 h-7 rounded-lg bg-[#203250] hover:bg-[#283e63] text-slate-200 font-bold flex items-center justify-center active:scale-95"
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
                      className="w-full bg-[#0d1626] border border-slate-700 text-slate-100 font-mono text-right rounded-lg px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeFromCart(item.tire.id)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Customer / Vehicle info */}
          <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
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
                className="flex-1 bg-[#16253c] border border-slate-700 text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none text-xs"
              />
            </div>

            {/* Quick Customer presets */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar text-[10px]">
              {['ลูกค้าหน้าร้าน', 'ช่างเบิร์ด ซ่อมรถ', 'Wave 110i', 'PCX160', 'Vespa Filano'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomer(preset)}
                  className="px-2 py-0.5 rounded-lg bg-[#18263d] text-slate-400 hover:text-white border border-slate-750 whitespace-nowrap"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Total Summary & Confirm Button */}
            <div className="bg-[#0e1728] border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">รวม {totalQuantity} เส้น</span>
                <span className="text-base font-extrabold font-mono text-amber-400">
                  ฿{totalAmount.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 ${
                  transactionType === 'sale'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
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

      {/* 3. Search & Tire Selection Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหายางเพื่อตัดสต็อก (รหัส, ขนาด, แบรนด์)"
              className="w-full bg-[#142033] text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-750 focus:outline-none focus:border-amber-400/80"
            />
          </div>

          <button
            onClick={onOpenScanner}
            title="สแกนบาร์โค้ดยาง"
            className="p-2 bg-[#1b2b46] hover:bg-[#23385c] text-cyan-300 rounded-xl border border-slate-750 active:scale-95 transition-all"
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
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'bg-[#152236] text-slate-300 border border-slate-800'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tire Cards for Fast Selection */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 px-1 flex items-center justify-between">
          <span>แตะเพื่อเพิ่มเข้าบิลตัดสต็อก:</span>
          <span>{filteredTires.length} รายการ</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {filteredTires.map((tire) => {
            const price = getSuggestedPrice(tire);
            const isZero = tire.actualQty === 0;

            return (
              <div
                key={tire.id}
                onClick={() => addToCart(tire)}
                className="bg-[#131e31] hover:bg-[#182740] active:scale-[0.99] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-100 text-xs">
                      {tire.name || tire.size}
                    </span>
                    {tire.unit && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#1b2b46] text-cyan-300 border border-cyan-500/20">
                        {tire.unit}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    ช่อง: {tire.location || 'RACK A-01'} {tire.description ? `• ${tire.description}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-xs font-bold font-mono text-amber-400 block">
                      ฿{price.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        isZero ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {isZero ? 'หมด (0)' : `เหลือ ${tire.actualQty} ${tire.unit || 'ชิ้น'}`}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-[#1b2b46] group-hover:bg-amber-400 group-hover:text-slate-950 text-cyan-300 flex items-center justify-center transition-all">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recent Transactions History */}
      <div className="space-y-2 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-1">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-xs font-bold text-slate-200 tracking-wider">
            รายการซื้อขาย & ตัดสต็อกล่าสุด ({transactions.length})
          </h3>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-[#121c2e] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
            ยังไม่มีรายการซื้อขายในระบบ
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 8).map((tx) => {
              const isSale = tx.type === 'sale';
              return (
                <div
                  key={tx.id}
                  className="bg-[#131e31] border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                        isSale
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isSale ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-100 text-xs">
                        {tx.tireName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isSale ? 'ขายให้: ' : 'รับจาก: '}
                        <span className="text-slate-300">{tx.customerOrSupplier}</span>
                        {tx.note && ` • ${tx.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-bold ${
                        isSale ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isSale ? `-${tx.quantity}` : `+${tx.quantity}`} เส้น
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
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
