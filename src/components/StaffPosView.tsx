import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  X,
  Store,
  Warehouse,
  Receipt,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  User,
  Users,
  Percent,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CustomerGrade, CustomerItem, CustomerTier, ProductItem, TireItem } from '../types';
import { resolveProductImage } from '../utils/productImages';
import { getProductStockBreakdown } from '../utils/stockUtils';
import {
  calculateItemPriceForCustomer,
  DEFAULT_CUSTOMER_TIERS,
  getGradeBadge,
  getTierInfo,
  getCustomerDisplayCode,
} from '../utils/pricingUtils';
import { ReceiptModal, ReceiptData } from './ReceiptModal';
import { CustomerPickerModal } from './CustomerPickerModal';
import { CustomerManagementModal } from './CustomerManagementModal';

interface CartItem {
  tire: TireItem;
  quantity: number;
  unitPrice: number;
  maxStorefrontStock: number;
  isSubUnit?: boolean; // True if selling in subUnit (e.g. cans instead of cartons)
}

interface StaffPosViewProps {
  tires: ProductItem[];
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
  onExitStaffMode: () => void;
  onOpenScanner: () => void;
  scannedProduct?: ProductItem | null;
  onClearScannedProduct?: () => void;
  isSandboxMode?: boolean;
  onResetToLiveCloud?: () => void;
  onToggleSandboxMode?: () => void;
  onSaveCustomer?: (cust: CustomerItem) => Promise<void> | void;
  onDeleteCustomer?: (customerId: string) => Promise<void> | void;
  onSaveTiers?: (tiers: CustomerTier[]) => Promise<void> | void;
  onUpdateCustomerSpend?: (customerId: string, addAmount: number) => void;
}

export const StaffPosView: React.FC<StaffPosViewProps> = ({
  tires,
  customers = [],
  customerTiers,
  onExecuteTransaction,
  onExitStaffMode,
  onOpenScanner,
  scannedProduct,
  onClearScannedProduct,
  isSandboxMode = false,
  onResetToLiveCloud,
  onToggleSandboxMode,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveTiers,
  onUpdateCustomerSpend,
}) => {
  // Staff Mode sells strictly from storefront only
  const locationTarget = 'front' as const;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ทั้งหมด');
  const [stockScope, setStockScope] = useState<'available_only' | 'all'>('available_only');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('ลูกค้าหน้าร้าน');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isCustomerManagementOpen, setIsCustomerManagementOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Modal for unit selection when product has subUnit conversion
  const [unitSelectProduct, setUnitSelectProduct] = useState<ProductItem | null>(null);

  const showToast = (text: string, type: 'success' | 'warn' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Available brands for quick filter
  const brands = useMemo(() => {
    const set = new Set<string>();
    tires.forEach((t) => {
      if (t.brand && t.brand.trim() !== '') set.add(t.brand.trim());
    });
    return ['ทั้งหมด', ...Array.from(set).sort()];
  }, [tires]);

  // Overall catalog storefront stats
  // Overall catalog storefront stats
  const storefrontStats = useMemo(() => {
    let inStockItems = 0;
    let totalPieces = 0;
    tires.forEach((t) => {
      const b = getProductStockBreakdown(t);
      const rate = t.conversionRate && t.conversionRate > 1 ? t.conversionRate : 1;
      const hasSub = Boolean(t.subUnit && rate > 1);
      const stock = hasSub ? Math.round(b.frontQty * rate) : b.frontQty;
      if (stock > 0) {
        inStockItems += 1;
        totalPieces += stock;
      }
    });
    return { inStockItems, totalPieces };
  }, [tires]);

  // Filter products: Brand, Search, and Storefront Availability
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tires
      .filter((p) => {
        const breakdown = getProductStockBreakdown(p);
        const rate = p.conversionRate && p.conversionRate > 1 ? p.conversionRate : 1;
        const hasSub = Boolean(p.subUnit && rate > 1);
        const displayFrontStock = hasSub ? Math.round(breakdown.frontQty * rate) : breakdown.frontQty;

        // When in 'available_only' mode, keep visible as long as any sub-units remain in storefront
        if (stockScope === 'available_only' && displayFrontStock <= 0) {
          return false;
        }

        const matchBrand =
          selectedBrand === 'ทั้งหมด' ||
          (p.brand || '').toLowerCase() === selectedBrand.toLowerCase();

        const matchQuery =
          !q ||
          (p.name || p.size || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.frontLocation || '').toLowerCase().includes(q);

        return matchBrand && matchQuery;
      })
      .sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [tires, searchQuery, selectedBrand, stockScope]);

  // Handle click on product card: sell in subUnit directly if available, otherwise main unit
  const handleProductCardClick = (product: ProductItem) => {
    const breakdown = getProductStockBreakdown(product);
    const rate = product.conversionRate && product.conversionRate > 1 ? product.conversionRate : 1;
    const sellAsSub = Boolean(product.subUnit && rate > 1);
    const maxStock = sellAsSub ? Math.round(breakdown.frontQty * rate) : breakdown.frontQty;

    if (maxStock <= 0) {
      showToast(
        `❌ สินค้า "${product.name || product.size}" หน้าร้านไม่มีสต็อก (มีในคลังหลังร้าน ${sellAsSub ? Math.round(breakdown.warehouseQty * rate) : breakdown.warehouseQty} ${sellAsSub ? product.subUnit : (product.unit || 'ชิ้น')})`,
        'warn'
      );
      return;
    }

    addToCart(product, sellAsSub);
  };

  // Whenever selectedCustomer changes, recalculate prices of items currently in cart
  const handleSelectCustomer = (cust: CustomerItem | null) => {
    setSelectedCustomer(cust);
    if (cust) {
      setCustomer(cust.name);
      const badge = getGradeBadge(cust.grade);
      const tier = getTierInfo(cust.grade, customerTiers);
      showToast(
        `เลือกลูกค้า: ${cust.name} (${badge.shortLabel}${tier.discountPercent > 0 ? ` • ลด ${tier.discountPercent}%` : ''})`,
        'success'
      );
    } else {
      setCustomer('ลูกค้าหน้าร้าน');
      showToast('เลือกเป็นลูกค้าทั่วไป (ราคาปกติ)', 'success');
    }

    setCart((prev) =>
      prev.map((item) => {
        const priceCalc = calculateItemPriceForCustomer(
          item.tire,
          cust,
          customerTiers || DEFAULT_CUSTOMER_TIERS,
          Boolean(item.isSubUnit)
        );
        return {
          ...item,
          unitPrice: priceCalc.effectivePrice,
        };
      })
    );
  };

  // Add product to cart with strict storefront stock limit & tier pricing
  const addToCart = (product: ProductItem, isSubUnit: boolean = false) => {
    const breakdown = getProductStockBreakdown(product);
    const rate = product.conversionRate && product.conversionRate > 1 ? product.conversionRate : 1;
    const maxStock = isSubUnit ? Math.round(breakdown.frontQty * rate) : breakdown.frontQty; // Max units/subUnits in stock

    const priceCalc = calculateItemPriceForCustomer(
      product,
      selectedCustomer,
      customerTiers || DEFAULT_CUSTOMER_TIERS,
      isSubUnit
    );
    const unitPrice = priceCalc.effectivePrice;

    setCart((prev) => {
      const existing = prev.find((item) => item.tire.id === product.id && item.isSubUnit === isSubUnit);

      if (existing) {
        if (existing.quantity >= maxStock) {
          showToast(`⚠️ สต็อกหน้าร้านมีเพียง ${maxStock} ${isSubUnit ? product.subUnit : (product.unit || 'ชิ้น')}`, 'warn');
          return prev;
        }

        showToast(`+1 (${isSubUnit ? product.subUnit : product.unit}) ${product.name || product.size}`, 'success');
        return prev.map((item) =>
          item.tire.id === product.id && item.isSubUnit === isSubUnit
            ? { ...item, quantity: item.quantity + 1, unitPrice }
            : item
        );
      }

      showToast(`เพิ่ม "${product.name || product.size}" (${isSubUnit ? product.subUnit : product.unit}) ลงในบิลแล้ว`, 'success');
      return [...prev, { tire: product, quantity: 1, unitPrice, maxStorefrontStock: maxStock, isSubUnit }];
    });
  };

  // Listen to external barcode scans
  useEffect(() => {
    if (scannedProduct) {
      const sellAsSub = Boolean(scannedProduct.subUnit && scannedProduct.conversionRate && scannedProduct.conversionRate > 1);
      addToCart(scannedProduct, sellAsSub);
      if (onClearScannedProduct) onClearScannedProduct();
    }
  }, [scannedProduct]);

  // Update quantity in cart with strict max limit
  const updateCartQty = (productId: string, isSubUnit: boolean, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.tire.id === productId && item.isSubUnit === isSubUnit) {
            const newQty = item.quantity + delta;
            if (newQty > item.maxStorefrontStock) {
              showToast(`⚠️ สต็อกหน้าร้านมีจำกัดเพียง ${item.maxStorefrontStock} ${isSubUnit ? item.tire.subUnit : (item.tire.unit || 'ชิ้น')}`, 'warn');
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string, isSubUnit: boolean) => {
    setCart((prev) => prev.filter((item) => !(item.tire.id === productId && item.isSubUnit === isSubUnit)));
  };

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Checkout execution strictly to storefront
  const handleConfirmCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const now = new Date();
      const receiptNo = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate()
      ).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      const customerDisplayName = selectedCustomer
        ? `[${selectedCustomer.customerCode || getCustomerDisplayCode(selectedCustomer)}] ${selectedCustomer.name}`
        : (customer || 'ลูกค้าหน้าร้าน');

      const receiptPayload: ReceiptData = {
        receiptNo,
        dateStr: now.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        timeStr: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        customer: customerDisplayName,
        customerGrade: selectedCustomer ? getGradeBadge(selectedCustomer.grade).shortLabel : undefined,
        discountPercent: selectedCustomer ? getTierInfo(selectedCustomer.grade, customerTiers).discountPercent : undefined,
        locationTarget: 'front',
        items: cart.map((i) => ({
          name: i.tire.name || i.tire.size || 'สินค้า',
          brand: i.tire.brand,
          size: i.tire.size,
          unit: i.isSubUnit && i.tire.subUnit ? i.tire.subUnit : (i.tire.unit || 'ชิ้น'),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.quantity * i.unitPrice,
        })),
        totalAmount,
        totalQuantity,
      };

      await onExecuteTransaction(
        'sale',
        cart.map((item) => ({
          tire: item.tire,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isSubUnit: item.isSubUnit,
        })),
        customerDisplayName,
        `ขายหน้าร้าน (โหมดพนักงาน) • ตัดสต็อกหน้าร้านโดยตรง • บิล ${receiptNo}`,
        'front',
        selectedCustomer?.id,
        selectedCustomer?.grade
      );

      if (selectedCustomer && onUpdateCustomerSpend) {
        onUpdateCustomerSpend(selectedCustomer.id, totalAmount);
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#38BDF8'],
      });

      setActiveReceipt(receiptPayload);
      setCart([]);
    } catch (err) {
      console.error('POS Checkout failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-['Prompt',sans-serif]">
      {/* Top Staff Header (Light Theme) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-2.5 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-slate-900 tracking-wider truncate">
                  CRC THABO
                </h1>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-bold">
                  โหมดพนักงาน
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                แคชเชียร์ขายหน้าร้าน • ตัดสต็อกคลังหน้าร้านเท่านั้น
              </p>
            </div>
          </div>

          {/* Exit / Return to Main Manager Mode Button */}
          <button
            type="button"
            onClick={onExitStaffMode}
            title="ออกจากโหมดพนักงาน กลับสู่หน้าระบบหลัก"
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm flex-shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-500" />
            <span>กลับหน้าระบบหลัก</span>
          </button>
        </div>
      </header>

      {/* Sandbox Test Mode Warning Banner in Staff POS (Light Theme) */}
      {isSandboxMode && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 border-b border-amber-200 px-3 py-1.5 text-xs shadow-sm z-20">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <span>🧪 โหมดทดลอง: ไม่บันทึกคลาวด์จริง (ขายเล่นได้)</span>
            </span>

            {onResetToLiveCloud && (
              <button
                type="button"
                onClick={onResetToLiveCloud}
                title="ดึงข้อมูลล่าสุดจากคลาวด์ใหม่ ยกเลิกการทดสอบทั้งหมด"
                className="px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-300 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>รีเซ็ตค่าจริง</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification (Light Theme) */}
      {toastMessage && (
        <div className="fixed top-14 left-0 right-0 z-50 px-4 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-w-md mx-auto pointer-events-auto">
            <div
              className={`p-2.5 rounded-xl border text-xs shadow-xl flex items-center gap-2 font-medium bg-white ${
                toastMessage.type === 'warn'
                  ? 'border-amber-400 text-amber-900'
                  : 'border-emerald-400 text-emerald-900'
              }`}
            >
              <span className="flex-1">{toastMessage.text}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-3 py-3 space-y-3 pb-36">
        {/* 1. Strict Storefront Location Badge (Light Theme) */}
        <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900">
                  คลังหน้าร้าน (Storefront)
                </span>
                <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  ขายได้เฉพาะหน้าร้าน
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                ตัดสต็อกจากชั้นวางหน้าร้านโดยตรง • ไม่อนุญาตให้ตัดคลังหลังร้าน
              </p>
            </div>
          </div>

          <div className="text-right flex-shrink-0 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 block">สินค้าพร้อมขาย</span>
            <span className="text-xs font-black text-amber-700">
              {storefrontStats.inStockItems} รุ่น
            </span>
          </div>
        </div>

        {/* 2. Customer Selection Bar (ตัวเลือกรายชื่อลูกค้าโหมดพนักงาน) */}
        <div className="bg-white border-2 border-slate-200 hover:border-amber-400/80 rounded-2xl p-2.5 shadow-sm transition-all space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold transition-all ${
                  selectedCustomer
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {selectedCustomer ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold">ลูกค้า:</span>
                  {selectedCustomer ? (
                    <>
                      <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        {selectedCustomer.customerCode || getCustomerDisplayCode(selectedCustomer)}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {selectedCustomer.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                          getGradeBadge(selectedCustomer.grade).badgeClass
                        }`}
                      >
                        {getGradeBadge(selectedCustomer.grade).shortLabel}
                        {getTierInfo(selectedCustomer.grade, customerTiers).discountPercent > 0 &&
                          ` (-${getTierInfo(selectedCustomer.grade, customerTiers).discountPercent}%)`}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-slate-700">
                      ลูกค้าหน้าร้าน (ราคาขายปกติ)
                    </span>
                  )}
                </div>

                {selectedCustomer && (
                  <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                    {selectedCustomer.phone}
                    {selectedCustomer.vehiclePlate ? ` • ทะเบียน ${selectedCustomer.vehiclePlate}` : ''}
                    {selectedCustomer.vehicleModel ? ` • ${selectedCustomer.vehicleModel}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomerPickerOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{selectedCustomer ? 'เปลี่ยนลูกค้า' : 'เลือกรายชื่อลูกค้า'}</span>
              </button>

              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => handleSelectCustomer(null)}
                  title="ยกเลิกการเลือกลูกค้า (กลับเป็นราคาปกติ)"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Fast Search & Barcode Button (Light Theme) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ, ขนาด, เบอร์ยาง, รหัสบาร์โค้ด..."
                className="w-full bg-white text-slate-900 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenScanner}
              title="เปิดกล้องสแกนบาร์โค้ด"
              className="p-2.5 bg-white hover:bg-amber-50 text-amber-600 rounded-xl border border-slate-300 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <ScanBarcode className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Selector: Available Only vs All items (Light Theme) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStockScope('available_only')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                stockScope === 'available_only'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>เฉพาะที่มีในหน้าร้าน ({storefrontStats.inStockItems})</span>
            </button>
            <button
              type="button"
              onClick={() => setStockScope('all')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                stockScope === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>สินค้าทั้งหมด ({tires.length})</span>
            </button>
          </div>

          {/* Quick Brand Filter Pills (Light Theme) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {brands.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBrand(b)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedBrand === b
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm border border-amber-400'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-400 shadow-sm'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Product Catalog Grid / Big Touch-Friendly Cards (Light Theme) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1 text-slate-500">
            <span>แตะการ์ดสินค้าเพื่อเพิ่มลงบิล</span>
            <span>แสดง {filteredProducts.length} รายการ</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {filteredProducts.map((tire) => {
              const breakdown = getProductStockBreakdown(tire);
              const rate = tire.conversionRate && tire.conversionRate > 1 ? tire.conversionRate : 1;
              const hasSub = Boolean(tire.subUnit && rate > 1);
              const priceCalc = calculateItemPriceForCustomer(
                tire,
                selectedCustomer,
                customerTiers || DEFAULT_CUSTOMER_TIERS,
                hasSub
              );
              const unitPrice = priceCalc.effectivePrice;
              const displayStock = hasSub ? Math.round(breakdown.frontQty * rate) : breakdown.frontQty;
              const hasFrontStock = displayStock > 0;
              const tireImg = resolveProductImage(tire);
              const inCartItem = cart.find((c) => c.tire.id === tire.id && c.isSubUnit === hasSub);
              const isCartAtMax = inCartItem ? inCartItem.quantity >= displayStock : false;

              return (
                <div
                  key={tire.id}
                  onClick={() => handleProductCardClick(tire)}
                  className={`rounded-2xl overflow-hidden transition-all flex flex-col justify-between shadow-sm border relative aspect-square p-2 ${
                    !hasFrontStock
                      ? 'opacity-60 border-slate-200 bg-slate-100 cursor-not-allowed'
                      : inCartItem
                      ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-50 cursor-pointer'
                      : 'bg-slate-900 border-slate-200 hover:border-amber-400 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {/* Full Background Image */}
                  <div className="absolute inset-0 w-full h-full bg-slate-200">
                    {tireImg && tireImg.trim() !== '' ? (
                      <img
                        src={tireImg}
                        alt={tire.name || tire.size || 'สินค้า'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                        <Store className="w-8 h-8" />
                      </div>
                    )}
                    {/* Dark Vignette Overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
                  </div>

                  {/* Top Bar: Brand & Cart Badge & Unit Switch */}
                  <div className="relative z-10 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {tire.brand && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-300 border border-white/20 uppercase truncate">
                          {tire.brand}
                        </span>
                      )}
                      {hasSub && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUnitSelectProduct(tire);
                          }}
                          title="กดเพื่อเลือกขายหน่วยใหญ่ (ลัง) หรือหน่วยย่อย (ป๋อง)"
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-400/40 cursor-pointer active:scale-95"
                        >
                          {tire.subUnit}
                        </button>
                      )}
                    </div>

                    {inCartItem && (
                      <div className="bg-amber-400 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-lg border border-white flex items-center gap-0.5 flex-shrink-0">
                        <span>×{inCartItem.quantity}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Translucent Overlay with Title, Price & Stock */}
                  <div className="relative z-10 bg-black/60 backdrop-blur-md -mx-2 -mb-2 p-2 border-t border-white/10 space-y-1">
                    <span className="font-bold text-white text-[11px] leading-tight line-clamp-1 block">
                      {tire.name || tire.size}
                    </span>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-black font-mono text-amber-300">
                          ฿{unitPrice.toLocaleString()}
                        </span>
                        {priceCalc.discountPercent > 0 && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/70 px-1 py-0.2 rounded border border-emerald-500/30">
                            -{priceCalc.discountPercent}%
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-[100px] ${
                          !hasFrontStock
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {!hasFrontStock ? 'หมด' : `${displayStock} ${hasSub ? tire.subUnit : (tire.unit || 'ชิ้น')}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-sm my-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">ไม่พบสินค้าในสต็อกหน้าร้าน</p>
                <p className="text-xs text-slate-500">
                  {stockScope === 'available_only'
                    ? 'สินค้าอาจไม่มีสต็อกในคลังหน้าร้าน หรือลองเปลี่ยนคำค้นหา'
                    : 'ลองตรวจสอบการสะกดคำ หรือเปลี่ยนตัวกรองยี่ห้อ'}
                </p>
              </div>
              {stockScope === 'available_only' && (
                <button
                  type="button"
                  onClick={() => setStockScope('all')}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold border border-amber-300 transition-colors cursor-pointer"
                >
                  ดูสินค้าทั้งหมดในระบบ ({tires.length} รายการ)
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar (Light Theme) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl">
          <div className="max-w-md mx-auto space-y-2.5">
            {/* Cart Items Preview / Quick Adjust */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {cart.map((item) => (
                <div
                  key={`${item.tire.id}-${item.isSubUnit ? 'sub' : 'main'}`}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs shadow-sm"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900 text-xs truncate block">
                        {item.tire.name || item.tire.size}
                      </span>
                      <span className={`text-[9px] font-bold px-1 rounded ${item.isSubUnit ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                        {item.isSubUnit ? item.tire.subUnit : item.tire.unit}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600">
                      ฿{item.unitPrice.toLocaleString()} × {item.quantity} ={' '}
                      <strong className="text-amber-600 font-mono">
                        ฿{(item.unitPrice * item.quantity).toLocaleString()}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.tire.id, Boolean(item.isSubUnit), -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-bold flex items-center justify-center active:scale-95 border border-slate-300 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold font-mono text-slate-900 text-xs">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={!item.isSubUnit && item.quantity >= item.maxStorefrontStock}
                      onClick={() => updateCartQty(item.tire.id, Boolean(item.isSubUnit), 1)}
                      className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center active:scale-95 border cursor-pointer ${
                        !item.isSubUnit && item.quantity >= item.maxStorefrontStock
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.tire.id, Boolean(item.isSubUnit))}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer in Floating Cart Bar */}
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[10px] text-slate-500 font-semibold">ลูกค้า:</span>
                {selectedCustomer ? (
                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                    <span className="font-mono font-bold text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {selectedCustomer.customerCode || getCustomerDisplayCode(selectedCustomer)}
                    </span>
                    <span className="font-bold text-slate-900 truncate max-w-[120px] text-xs">
                      {selectedCustomer.name}
                    </span>
                    {getTierInfo(selectedCustomer.grade, customerTiers).discountPercent > 0 && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">
                        ลด {getTierInfo(selectedCustomer.grade, customerTiers).discountPercent}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-600 text-xs">ลูกค้าหน้าร้าน (ราคาปกติ)</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsCustomerPickerOpen(true)}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5 cursor-pointer ml-2 flex-shrink-0"
              >
                <Users className="w-3 h-3" />
                <span>{selectedCustomer ? 'เปลี่ยนลูกค้า' : 'เลือกรายชื่อลูกค้า'}</span>
              </button>
            </div>

            {/* Total & Large Checkout Action Button */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <span className="text-[10px] text-slate-500 block">
                  รวม {totalQuantity} ชิ้น • <strong className="text-amber-700">ตัดสต็อกหน้าร้าน</strong>
                </span>
                <span className="text-lg font-black font-mono text-slate-900">
                  ฿{totalAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-rose-600 text-xs font-semibold border border-slate-200 transition-colors"
                >
                  ล้าง
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCheckout}
                  disabled={isProcessing}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-400/30 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-slate-950" />
                  <span>
                    {isProcessing ? 'กำลังตัดสต็อก...' : `คิดเงินหน้าร้าน ฿${totalAmount.toLocaleString()}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        receipt={activeReceipt}
        isLightMode={true}
      />

      {/* Customer Picker Modal (โหมดพนักงาน) */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        customers={customers}
        customerTiers={customerTiers || DEFAULT_CUSTOMER_TIERS}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={handleSelectCustomer}
        onOpenAddNewCustomer={() => {
          setIsCustomerPickerOpen(false);
          setIsCustomerManagementOpen(true);
        }}
      />

      {/* Customer Management Modal (เพิ่ม/แก้ไขลูกค้าได้จากหน้าพนักงาน) */}
      {onSaveCustomer && (
        <CustomerManagementModal
          isOpen={isCustomerManagementOpen}
          onClose={() => setIsCustomerManagementOpen(false)}
          customers={customers}
          customerTiers={customerTiers || DEFAULT_CUSTOMER_TIERS}
          onSaveCustomer={onSaveCustomer}
          onDeleteCustomer={onDeleteCustomer || (() => {})}
          onSaveTiers={onSaveTiers || (() => {})}
        />
      )}

      {/* Unit Selection Modal (Main Unit vs Sub Unit) */}
      {unitSelectProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xs w-full p-4 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">เลือกหน่วยที่ต้องการขาย</h3>
              <p className="text-xs text-slate-500 truncate">{unitSelectProduct.name || unitSelectProduct.size}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  addToCart(unitSelectProduct, false);
                  setUnitSelectProduct(null);
                }}
                className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-center transition-all cursor-pointer space-y-1"
              >
                <span className="text-xs font-bold text-amber-900 block">ขายหน่วยใหญ่</span>
                <span className="text-lg font-black text-amber-700 block">{unitSelectProduct.unit || 'ลัง'}</span>
                <span className="text-[10px] text-amber-800 font-mono">฿{(unitSelectProduct.sellingPrice || unitSelectProduct.price || 0).toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToCart(unitSelectProduct, true);
                  setUnitSelectProduct(null);
                }}
                className="p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-center transition-all cursor-pointer space-y-1"
              >
                <span className="text-xs font-bold text-sky-900 block">ขายหน่วยย่อย</span>
                <span className="text-lg font-black text-sky-700 block">{unitSelectProduct.subUnit}</span>
                <span className="text-[10px] text-sky-800 font-mono">
                  ฿{Math.round(((unitSelectProduct.sellingPrice || unitSelectProduct.price || 0) / (unitSelectProduct.conversionRate || 1)) * 100) / 100}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setUnitSelectProduct(null)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
