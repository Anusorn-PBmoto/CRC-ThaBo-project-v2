import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Image as ImageIcon, Sparkles } from 'lucide-react';
import { TireItem } from '../types';

interface AddEditTireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tireData: Omit<TireItem, 'id'>, id?: string) => Promise<void>;
  initialTire?: TireItem | null;
}

export const AddEditTireModal: React.FC<AddEditTireModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTire,
}) => {
  const [brand, setBrand] = useState('Camal');
  const [size, setSize] = useState('');
  const [rim, setRim] = useState('14');
  const [systemQty, setSystemQty] = useState(5);
  const [actualQty, setActualQty] = useState(5);
  const [location, setLocation] = useState('RACK A-01');
  const [zone, setZone] = useState('ห้องยางชั้น 2');
  const [description, setDescription] = useState('');
  const [minStock, setMinStock] = useState(3);
  const [isOem, setIsOem] = useState(false);
  const [oemLabel, setOemLabel] = useState('OEM ศูนย์');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialTire) {
      setBrand(initialTire.brand);
      setSize(initialTire.size);
      setRim(initialTire.rim);
      setSystemQty(initialTire.systemQty);
      setActualQty(initialTire.actualQty);
      setLocation(initialTire.location);
      setZone(initialTire.zone || 'ห้องยางชั้น 2');
      setDescription(initialTire.description || '');
      setMinStock(initialTire.minStock || 3);
      setIsOem(Boolean(initialTire.isOem));
      setOemLabel(initialTire.oemLabel || 'OEM ศูนย์');
      setImageUrl(initialTire.imageUrl || '');
    } else {
      setBrand('Camal');
      setSize('');
      setRim('14');
      setSystemQty(5);
      setActualQty(5);
      setLocation('RACK A-01');
      setZone('ห้องยางชั้น 2');
      setDescription('');
      setMinStock(3);
      setIsOem(false);
      setOemLabel('OEM ศูนย์');
      setImageUrl('https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=300&q=80');
    }
  }, [initialTire, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!size.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(
        {
          brand,
          size: size.trim(),
          rim,
          systemQty: Number(systemQty),
          actualQty: Number(actualQty),
          status: Number(actualQty) === Number(systemQty) ? 'checked' : 'discrepancy',
          category: 'Tubeless',
          location: location.trim(),
          zone: zone.trim(),
          description: description.trim(),
          minStock: Number(minStock),
          isOem,
          oemLabel: isOem ? oemLabel : undefined,
          imageUrl: imageUrl.trim() || undefined,
          updatedAt: new Date().toISOString(),
        },
        initialTire ? initialTire.id : undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#111c2e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#0d1626]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              {initialTire ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              {initialTire ? 'แก้ไขข้อมูลขนาดยาง' : 'เพิ่มขนาดยางใหม่ในระบบ'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* Brand & Rim */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">แบรนด์ยาง</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                <option value="Camal">Camal</option>
                <option value="Fujiyama">Fujiyama</option>
                <option value="Deestone">Deestone</option>
                <option value="Exella">Exella</option>
                <option value="IRC">IRC</option>
                <option value="Quick">Quick</option>
                <option value="Michelin">Michelin</option>
                <option value="Maxxis">Maxxis</option>
                <option value="Pirelli">Pirelli</option>
                <option value="Veerubber">Veerubber</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">ขอบล้อ (นิ้ว)</label>
              <select
                value={rim}
                onChange={(e) => setRim(e.target.value)}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                <option value="10">10 นิ้ว</option>
                <option value="12">12 นิ้ว</option>
                <option value="13">13 นิ้ว</option>
                <option value="14">14 นิ้ว</option>
                <option value="15">15 นิ้ว</option>
                <option value="16">16 นิ้ว</option>
                <option value="17">17 นิ้ว</option>
              </select>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              เบอร์ขนาดยาง (เช่น 110/70-12, 140/70-14 Honda) <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="เช่น 110/70-12 หรือ 90/90-14"
              className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
            />
          </div>

          {/* System Qty & Actual Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">ยอดตามระบบ (เส้น)</label>
              <input
                type="number"
                min="0"
                value={systemQty}
                onChange={(e) => setSystemQty(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">ยอดตรวจนับจริง (เส้น)</label>
              <input
                type="number"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-amber-400 font-bold rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Location & Zone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">ตำแหน่งช่องจัดเก็บ</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น ช่อง A-01-2 หรือ RACK D-01"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">โซนคลัง</label>
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Description & Min stock */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-400 font-medium mb-1">รายละเอียด / รุ่นรถที่รองรับ</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น Vespa Sprint / Grand Filano หน้า"
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">สต็อกเตือนต่ำ</label>
              <input
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* OEM Badge toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isOem"
              checked={isOem}
              onChange={(e) => setIsOem(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-0"
            />
            <label htmlFor="isOem" className="text-slate-300 font-medium cursor-pointer">
              เป็นยาง OEM แท้ศูนย์ (มีป้ายกำกับ)
            </label>
          </div>

          {/* Hotlink Image URL */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
              <span>ฮอตลิงก์รูปภาพยาง (Image URL)</span>
              <span className="text-[10px] text-amber-400 font-normal">ฮอตลิงก์รูปภาพจาก HTML</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ImageIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#17253d] border border-slate-700 text-slate-100 rounded-xl pl-8 pr-3 py-2 focus:border-amber-400 focus:outline-none text-[11px]"
                />
              </div>
              {imageUrl && (
                <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#17253d] hover:bg-[#203252] text-slate-300 font-medium active:scale-95 transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 transition-all shadow-md shadow-amber-500/25 disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : initialTire ? 'บันทึกการแก้ไข' : 'เพิ่มลงฐานข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
