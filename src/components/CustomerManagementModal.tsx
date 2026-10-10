import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Percent,
  Sliders,
  Phone,
  Bike,
  Coins,
  Receipt,
  Check,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { CustomerGrade, CustomerItem, CustomerTier } from '../types';
import { getGradeBadge, getTierInfo, generateCustomerCode, getCustomerDisplayCode } from '../utils/pricingUtils';

interface CustomerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  customerTiers: CustomerTier[];
  onSaveCustomer: (customer: CustomerItem) => Promise<void> | void;
  onDeleteCustomer: (customerId: string) => Promise<void> | void;
  onSaveTiers: (tiers: CustomerTier[]) => Promise<void> | void;
}

export const CustomerManagementModal: React.FC<CustomerManagementModalProps> = ({
  isOpen,
  onClose,
  customers,
  customerTiers,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveTiers,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'tiers'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<'all' | CustomerGrade>('all');

  // Customer Edit/Add form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGrade, setFormGrade] = useState<CustomerGrade>('general');
  const [formPlate, setFormPlate] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Tier settings editable copy
  const [editableTiers, setEditableTiers] = useState<CustomerTier[]>(customerTiers);
  const [tierSaveSuccess, setTierSaveSuccess] = useState(false);

  // Sync tiers when prop updates
  React.useEffect(() => {
    setEditableTiers(customerTiers);
  }, [customerTiers]);

  // Open Form for Add
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormGrade('general');
    setFormCode(generateCustomerCode('general', customers));
    setFormName('');
    setFormPhone('');
    setFormPlate('');
    setFormModel('');
    setFormNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (cust: CustomerItem) => {
    setEditingCustomer(cust);
    setFormCode(cust.customerCode || generateCustomerCode(cust.grade, customers));
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormGrade(cust.grade);
    setFormPlate(cust.vehiclePlate || '');
    setFormModel(cust.vehicleModel || '');
    setFormNotes(cust.notes || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Switch grade in form & update customer code automatically
  const handleChangeGrade = (grade: CustomerGrade) => {
    setFormGrade(grade);
    // If code is empty or matches previous auto-code pattern, update code with new prefix
    setFormCode(generateCustomerCode(grade, customers));
  };

  // Submit customer form
  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('กรุณาระบุชื่อลูกค้า');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('กรุณาระบุเบอร์โทรศัพท์');
      return;
    }

    const customerCodeVal = formCode.trim().toUpperCase() || generateCustomerCode(formGrade, customers);
    const now = new Date().toISOString();
    const customerPayload: CustomerItem = {
      id: editingCustomer?.id || `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerCode: customerCodeVal,
      name: formName.trim(),
      phone: formPhone.trim(),
      grade: formGrade,
      vehiclePlate: formPlate.trim() || undefined,
      vehicleModel: formModel.trim() || undefined,
      notes: formNotes.trim() || undefined,
      totalSpend: editingCustomer ? editingCustomer.totalSpend : 0,
      purchaseCount: editingCustomer ? editingCustomer.purchaseCount : 0,
      createdAt: editingCustomer ? editingCustomer.createdAt : now,
      updatedAt: now,
    };

    onSaveCustomer(customerPayload);
    setIsFormOpen(false);
  };

  // Save tier settings
  const handleSaveTierSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTiers(editableTiers);
    setTierSaveSuccess(true);
    setTimeout(() => setTierSaveSuccess(false), 2500);
  };

  // Update a tier discount percent in state
  const handleUpdateTierDiscount = (grade: CustomerGrade, percent: number) => {
    setEditableTiers((prev) =>
      prev.map((t) => (t.grade === grade ? { ...t, discountPercent: Math.max(0, Math.min(100, percent)) } : t))
    );
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchQuery =
        !q ||
        (c.customerCode || '').toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.vehiclePlate || '').toLowerCase().includes(q) ||
        (c.vehicleModel || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q);

      const matchGrade = selectedGradeFilter === 'all' || c.grade === selectedGradeFilter;

      return matchQuery && matchGrade;
    });
  }, [customers, searchQuery, selectedGradeFilter]);

  // Overall stats
  const totalSpendAll = useMemo(() => customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0), [customers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 font-['Prompt',sans-serif] animate-in fade-in">
      <div className="bg-[#20262D] border border-[#475662] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3.5 bg-[#252C33] border-b border-[#3A4750] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#EEEEEE] truncate">ระบบสมาชิกลูกค้า & รหัสกลุ่มส่วนลด</h2>
              <p className="text-[10px] text-[#A0ABB5] truncate">จัดการรายชื่อลูกค้า กำหนดรหัสบ่งชี้ A B C D และเปอร์เซ็นต์ส่วนลด</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#3A4750] text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#43525D] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Customers vs Tier Settings */}
        <div className="px-4 pt-2.5 pb-2 bg-[#20262D] border-b border-[#3A4750]/60 flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#252C33] rounded-xl border border-[#3A4750] flex-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-[#F6C90E] text-[#20262D] shadow-sm'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>รายชื่อลูกค้า ({customers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('tiers')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'tiers'
                  ? 'bg-[#F6C90E] text-[#20262D] shadow-sm'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>ตั้งค่าส่วนลดตามกลุ่มรหัส</span>
            </button>
          </div>

          {activeTab === 'list' && (
            <button
              onClick={handleOpenAdd}
              className="py-2 px-3 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-[#20262D] text-xs font-bold flex items-center gap-1 shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มลูกค้า</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* TAB 1: CUSTOMER DIRECTORY */}
          {activeTab === 'list' && (
            <>
              {/* Overview Strip */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#252C33] border border-[#3A4750] rounded-xl p-2">
                  <span className="text-[10px] text-[#A0ABB5] block">ลูกค้าทั้งหมด</span>
                  <span className="text-sm font-extrabold text-[#EEEEEE] font-mono">{customers.length} คน</span>
                </div>
                <div className="bg-[#252C33] border border-[#3A4750] rounded-xl p-2">
                  <span className="text-[10px] text-[#A0ABB5] block">ช่าง / อู่ (กลุ่ม A)</span>
                  <span className="text-sm font-extrabold text-amber-300 font-mono">
                    {customers.filter((c) => c.grade === 'A').length} คน
                  </span>
                </div>
                <div className="bg-[#252C33] border border-[#3A4750] rounded-xl p-2">
                  <span className="text-[10px] text-[#A0ABB5] block">ยอดซื้อสะสมรวม</span>
                  <span className="text-sm font-extrabold text-[#F6C90E] font-mono">
                    ฿{totalSpendAll.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ABB5]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัสลูกค้า (เช่น A000001), ชื่อ, เบอร์โทร, ทะเบียน..."
                  className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl pl-9 pr-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:outline-none focus:border-[#F6C90E]"
                />
              </div>

              {/* Grade Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
                {(['all', 'A', 'B', 'C', 'D', 'general'] as const).map((grade) => {
                  const isSelected = selectedGradeFilter === grade;
                  const label =
                    grade === 'all'
                      ? 'ทั้งหมด'
                      : grade === 'general'
                      ? 'ทั่วไป'
                      : `กลุ่ม ${grade}`;
                  return (
                    <button
                      key={grade}
                      onClick={() => setSelectedGradeFilter(grade)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#F6C90E] text-[#20262D] font-bold shadow-sm'
                          : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border border-[#3A4750]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Customer List */}
              <div className="space-y-2">
                {filteredCustomers.length === 0 ? (
                  <div className="bg-[#252C33] border border-dashed border-[#3A4750] rounded-2xl p-8 text-center space-y-2">
                    <Users className="w-8 h-8 text-[#A0ABB5] mx-auto mb-1" />
                    <p className="text-xs font-semibold text-[#EEEEEE]">ไม่พบข้อมูลลูกค้า</p>
                    <p className="text-[11px] text-[#A0ABB5]">
                      {searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'แตะปุ่ม "เพิ่มลูกค้า" เพื่อเริ่มบันทึกข้อมูลลูกค้า'}
                    </p>
                  </div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const badge = getGradeBadge(customer.grade);
                    const tier = getTierInfo(customer.grade, customerTiers);
                    const displayCode = customer.customerCode || getCustomerDisplayCode(customer);

                    return (
                      <div
                        key={customer.id}
                        className="bg-[#252C33] hover:bg-[#2C353F] border border-[#3A4750] rounded-2xl p-3 space-y-2 transition-all"
                      >
                        {/* Top: Name & Grade Badge & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                {displayCode}
                              </span>
                              <h3 className="text-xs font-bold text-[#EEEEEE] truncate">{customer.name}</h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${badge.badgeClass}`}
                              >
                                <span>{badge.label}</span>
                                {tier.discountPercent > 0 && (
                                  <span className="opacity-90">• ลด {tier.discountPercent}%</span>
                                )}
                              </span>
                            </div>

                            {/* Phone & Vehicle info */}
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-[#A0ABB5] flex-wrap">
                              <a
                                href={`tel:${customer.phone}`}
                                className="inline-flex items-center gap-1 text-[#F6C90E] hover:underline font-mono"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{customer.phone}</span>
                              </a>

                              {customer.vehiclePlate && (
                                <span className="inline-flex items-center gap-1 text-[#EEEEEE] font-mono">
                                  <Bike className="w-3 h-3 text-[#A0ABB5]" />
                                  <span>{customer.vehiclePlate}</span>
                                </span>
                              )}

                              {customer.vehicleModel && (
                                <span className="text-[#A0ABB5]">({customer.vehicleModel})</span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleOpenEdit(customer)}
                              title="แก้ไขข้อมูล"
                              className="p-1.5 rounded-lg bg-[#3A4750] hover:bg-[#43525D] text-[#A0ABB5] hover:text-[#EEEEEE] transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`ต้องการลบลูกค้า "${customer.name}" ใช่หรือไม่?`)) {
                                  onDeleteCustomer(customer.id);
                                }
                              }}
                              title="ลบข้อมูล"
                              className="p-1.5 rounded-lg bg-[#3A4750] hover:bg-rose-900/40 text-[#A0ABB5] hover:text-rose-400 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom: Notes & Spend summary */}
                        <div className="pt-2 border-t border-[#3A4750]/60 flex items-center justify-between text-[11px] flex-wrap gap-2">
                          <div className="text-[#A0ABB5] truncate max-w-[200px]">
                            {customer.notes ? customer.notes : 'ไม่มีบันทึกเพิ่มเติม'}
                          </div>

                          <div className="flex items-center gap-3 ml-auto font-mono text-right">
                            <span className="text-[#A0ABB5]">
                              ซื้อ <strong className="text-[#EEEEEE]">{customer.purchaseCount || 0}</strong> ครั้ง
                            </span>
                            <span className="text-[#F6C90E] font-bold">
                              รวม ฿{(customer.totalSpend || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* TAB 2: TIER & DISCOUNT SETTINGS */}
          {activeTab === 'tiers' && (
            <form onSubmit={handleSaveTierSettings} className="space-y-3.5">
              <div className="bg-[#252C33] border border-[#3A4750] rounded-2xl p-3 space-y-1 text-xs">
                <span className="font-bold text-[#EEEEEE] flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-[#F6C90E]" />
                  <span>การคำนวณส่วนลดตามกลุ่มรหัสลูกค้า</span>
                </span>
                <p className="text-[11px] text-[#A0ABB5]">
                  เมื่อเลือกลูกค้าในหน้าขาย (Staff POS หรือ ซื้อ/ขาย) ระบบจะนำเปอร์เซ็นต์ส่วนลดของกลุ่มรหัสนั้นมาหักลดราคาขายให้อัตโนมัติ (ปัดเศษขึ้นเต็มจำนวนบาท)
                </p>
              </div>

              {tierSaveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>บันทึกการตั้งค่าส่วนลดตามกลุ่มรหัสเรียบร้อยแล้ว</span>
                </div>
              )}

              <div className="space-y-2.5">
                {editableTiers.map((tier) => {
                  const isGeneral = tier.grade === 'general';

                  return (
                    <div
                      key={tier.grade}
                      className="bg-[#252C33] border border-[#3A4750] rounded-2xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.badgeColor}`}
                          >
                            กลุ่ม {tier.grade.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-[#EEEEEE] truncate">{tier.name}</span>
                        </div>
                        <p className="text-[10px] text-[#A0ABB5] mt-1">{tier.description}</p>
                      </div>

                      {/* Discount % Input */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isGeneral ? (
                          <span className="text-xs font-bold font-mono text-[#A0ABB5] px-2 py-1 bg-[#20262D] rounded-xl border border-[#3A4750]">
                            0% (ราคาปกติ)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 bg-[#20262D] border border-[#3A4750] focus-within:border-[#F6C90E] rounded-xl px-2 py-1">
                            <span className="text-[10px] text-[#A0ABB5]">ลด</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={tier.discountPercent}
                              onChange={(e) => handleUpdateTierDiscount(tier.grade, Number(e.target.value))}
                              className="w-12 text-center font-bold text-[#F6C90E] font-mono text-sm bg-transparent focus:outline-none"
                            />
                            <span className="text-xs font-bold text-[#EEEEEE]">%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#20262D] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#20262D]" />
                  <span>บันทึกการตั้งค่าเปอร์เซ็นต์ส่วนลด</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-[#20262D] border border-[#F6C90E]/40 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-4 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#3A4750]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-[#EEEEEE]">
                  {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้า / สมาชิกใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#3A4750] text-[#A0ABB5] hover:text-[#EEEEEE] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {formError && (
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitCustomer} className="space-y-2.5 text-xs">
              {/* Group Selector First to guide Code */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#A0ABB5] font-semibold">กลุ่มลูกค้ารหัสส่วนลด (A, B, C, D)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['A', 'B', 'C', 'D', 'general'] as const).map((grade) => {
                    const isSelected = formGrade === grade;
                    const tier = getTierInfo(grade, customerTiers);
                    const label =
                      grade === 'general'
                        ? 'ทั่วไป (0%)'
                        : `กลุ่ม ${grade} (${tier.discountPercent}%)`;

                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => handleChangeGrade(grade)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center truncate ${
                          isSelected
                            ? 'bg-[#F6C90E] text-[#20262D] border-[#F6C90E] shadow-sm'
                            : 'bg-[#252C33] text-[#A0ABB5] hover:text-[#EEEEEE] border-[#3A4750]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Code with group indicator (A000001, B000001, etc.) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[#A0ABB5] font-semibold">
                    รหัสลูกค้า (มีตัวบ่งชี้กลุ่ม เช่น A000001) <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormCode(generateCustomerCode(formGrade, customers))}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer font-medium"
                  >
                    รีเฟรชรหัส
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="เช่น A000001, B000001"
                  className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#F6C90E] font-mono font-bold tracking-wider placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                />
                <p className="text-[10px] text-[#A0ABB5]">
                  ตัวบ่งชี้กลุ่มจะอยู่ในรหัสลูกค้า เช่น ลูกค้ากลุ่ม A จะได้รหัส A000001
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] text-[#A0ABB5] font-semibold">
                  ชื่อลูกค้า / ชื่ออู่ / ช่าง <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ช่างเบิร์ด ซ่อมรถ, อู่เจริญยนต์"
                  className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-[11px] text-[#A0ABB5] font-semibold">
                  เบอร์โทรศัพท์ <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                  className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] font-mono placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                />
              </div>

              {/* Vehicle Plate & Model */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#A0ABB5]">ทะเบียนรถ (ถ้ามี)</label>
                  <input
                    type="text"
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    placeholder="เช่น 1กข 4567 หนองคาย"
                    className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[#A0ABB5]">รุ่นรถ (ถ้ามี)</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="เช่น Wave 110i, PCX"
                    className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] text-[#A0ABB5]">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="เช่น ประจำอู่ท่าบ่อ ช่างเล็ก"
                  className="w-full bg-[#252C33] border border-[#3A4750] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] placeholder-[#A0ABB5] focus:border-[#F6C90E] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-2 rounded-xl bg-[#3A4750] text-[#EEEEEE] font-semibold hover:bg-[#43525D] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F6C90E] hover:bg-[#E5B800] text-[#20262D] font-bold shadow-md cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
