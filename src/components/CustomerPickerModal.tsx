import React, { useState, useMemo } from 'react';
import { X, Search, Plus, User, Phone, Bike, Check, Users } from 'lucide-react';
import { CustomerItem, CustomerTier } from '../types';
import { getGradeBadge, getTierInfo, getCustomerDisplayCode } from '../utils/pricingUtils';

interface CustomerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  customerTiers: CustomerTier[];
  selectedCustomer: CustomerItem | null;
  onSelectCustomer: (customer: CustomerItem | null) => void;
  onOpenAddNewCustomer?: () => void;
}

export const CustomerPickerModal: React.FC<CustomerPickerModalProps> = ({
  isOpen,
  onClose,
  customers,
  customerTiers,
  selectedCustomer,
  onSelectCustomer,
  onOpenAddNewCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.customerCode || '').toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.vehiclePlate || '').toLowerCase().includes(q) ||
        (c.vehicleModel || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 font-['Prompt',sans-serif] animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#20262D] border border-[#475662] rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#252C33] border-b border-[#3A4750] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#EEEEEE]">เลือกลูกค้า / สมาชิกเพื่อรับส่วนลด</h3>
              <p className="text-[10px] text-[#A0ABB5]">ระบบจะคำนวณราคาตามรหัสกลุ่ม A B C D อัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#3A4750] text-[#A0ABB5] hover:text-[#EEEEEE] flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search and Action Bar */}
        <div className="p-3 bg-[#20262D] border-b border-[#3A4750]/60 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสลูกค้า (เช่น A000001), ชื่อ, เบอร์โทร..."
              className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl pl-9 pr-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:outline-none focus:border-[#F6C90E]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* General Customer Option (No discount / Retail) */}
            <button
              type="button"
              onClick={() => {
                onSelectCustomer(null);
                onClose();
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedCustomer === null
                  ? 'bg-amber-400 text-slate-900 border-amber-400 font-bold'
                  : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#3A4750]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>ลูกค้าทั่วไป (ราคาปกติ)</span>
            </button>

            {/* Quick Add New Customer Button */}
            {onOpenAddNewCustomer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddNewCustomer();
                }}
                className="py-1.5 px-2.5 rounded-xl bg-[#3A4750] hover:bg-[#43525D] text-[#F6C90E] border border-[#475662] text-xs font-bold flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มลูกค้าใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 space-y-1 text-[#A0ABB5]">
              <p className="text-xs">ไม่พบรายชื่อลูกค้าที่ค้นหา</p>
              <p className="text-[10px]">แตะปุ่ม "เพิ่มลูกค้าใหม่" เพื่อสร้างข้อมูล</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const isSelected = selectedCustomer?.id === customer.id;
              const badge = getGradeBadge(customer.grade);
              const tier = getTierInfo(customer.grade, customerTiers);
              const displayCode = customer.customerCode || getCustomerDisplayCode(customer);

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(customer);
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#3A4750] border-[#F6C90E] shadow-sm'
                      : 'bg-[#252C33] hover:bg-[#2C353F] border-[#3A4750]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        {displayCode}
                      </span>
                      <span className="text-xs font-bold text-[#EEEEEE] truncate">{customer.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${badge.badgeClass}`}
                      >
                        {badge.shortLabel} {tier.discountPercent > 0 && `(ลด ${tier.discountPercent}%)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-[#A0ABB5] font-mono">
                      <span className="flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5 text-[#F6C90E]" />
                        <span>{customer.phone}</span>
                      </span>
                      {customer.vehiclePlate && (
                        <span>• ทะเบียน {customer.vehiclePlate}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right font-mono text-[10px]">
                      <span className="text-[#A0ABB5] block">สะสม</span>
                      <span className="text-[#F6C90E] font-bold">฿{(customer.totalSpend || 0).toLocaleString()}</span>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#F6C90E] text-[#20262D] flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
