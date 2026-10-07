import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  CheckCircle2,
  Upload,
  RefreshCw,
  Download,
  FileJson,
  QrCode,
  Tag,
  Package,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  Check,
  HardDriveDownload,
  FolderSync,
} from 'lucide-react';
import { ProductItem } from '../types';
import {
  SYSTEM_BACKUP_IMAGES,
  SystemBackupImage,
  matchImageFileNameToProduct,
  MatchResult,
  resolveProductImage,
} from '../utils/productImages';

interface ImageMatchBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onUpdateProducts: (updatedList: ProductItem[]) => Promise<void> | void;
}

interface UploadedMatchItem {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string;
  dataUrl: string;
  matchResult: MatchResult;
  selectedProductId: string;
}

export const ImageMatchBackupModal: React.FC<ImageMatchBackupModalProps> = ({
  isOpen,
  onClose,
  products,
  onUpdateProducts,
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'upload' | 'backup'>('system');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [previewZoomImage, setPreviewZoomImage] = useState<{ url: string; title: string } | null>(null);

  // Upload tab state
  const [uploadedMatches, setUploadedMatches] = useState<UploadedMatchItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Sync & Restore all 6 built-in system backup images to matched products
  const handleRestoreAllSystemImages = async () => {
    setIsProcessing(true);
    try {
      let updatedCount = 0;
      const nextProducts = products.map((prod) => {
        const foundBackup = SYSTEM_BACKUP_IMAGES.find(
          (b) =>
            b.id === prod.id ||
            (b.barcode && prod.barcode && b.barcode === prod.barcode) ||
            b.name.toLowerCase() === prod.name.toLowerCase() ||
            b.name.toLowerCase() === (prod.size || '').toLowerCase()
        );

        if (foundBackup) {
          if (prod.imageUrl !== foundBackup.url) {
            updatedCount++;
            return {
              ...prod,
              imageUrl: foundBackup.url,
              updatedAt: new Date().toISOString(),
            };
          }
        } else {
          // Check resolveProductImage fallback
          const autoImg = resolveProductImage(prod);
          if (autoImg && prod.imageUrl !== autoImg) {
            updatedCount++;
            return {
              ...prod,
              imageUrl: autoImg,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        return prod;
      });

      await onUpdateProducts(nextProducts);
      showToast(`กู้คืนและบันทึกรูปภาพสินค้าเรียบร้อยแล้ว (${updatedCount} รายการ)`);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการบันทึกรูปภาพ');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Handle files picked for batch upload & auto-matching
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newMatches: UploadedMatchItem[] = [];
    const fileList = Array.from(files);

    fileList.forEach((file) => {
      // Create local object URL for instant preview
      const previewUrl = URL.createObjectURL(file);
      const matchResult = matchImageFileNameToProduct(file.name, products);

      const reader = new FileReader();
      const matchItem: UploadedMatchItem = {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        previewUrl,
        dataUrl: '',
        matchResult,
        selectedProductId: matchResult.product ? matchResult.product.id : '',
      };

      reader.onload = (e) => {
        matchItem.dataUrl = (e.target?.result as string) || '';
      };
      reader.readAsDataURL(file);

      newMatches.push(matchItem);
    });

    setUploadedMatches((prev) => [...newMatches, ...prev]);
    showToast(`โหลดรูปภาพ ${newMatches.length} ไฟล์ พร้อมจับคู่ข้อมูลอัตโนมัติ`);
  };

  // 3. Save uploaded & matched images into products
  const handleSaveUploadedMatches = async () => {
    const validMatches = uploadedMatches.filter((m) => m.selectedProductId);
    if (validMatches.length === 0) {
      showToast('กรุณาเลือกรายการสินค้าที่ต้องการจับคู่รูปภาพ');
      return;
    }

    setIsProcessing(true);
    try {
      const matchMap = new Map<string, string>();
      validMatches.forEach((m) => {
        // Use dataUrl if ready, otherwise fallback to previewUrl
        const imgUrl = m.dataUrl || m.previewUrl;
        if (imgUrl) {
          matchMap.set(m.selectedProductId, imgUrl);
        }
      });

      let updatedCount = 0;
      const nextProducts = products.map((prod) => {
        if (matchMap.has(prod.id)) {
          updatedCount++;
          return {
            ...prod,
            imageUrl: matchMap.get(prod.id)!,
            updatedAt: new Date().toISOString(),
          };
        }
        return prod;
      });

      await onUpdateProducts(nextProducts);
      setUploadedMatches([]);
      showToast(`บันทึกรูปภาพสำเร็จ ${updatedCount} รายการ และสำรองข้อมูลเรียบร้อย`);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการบันทึกรูปภาพ');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Download Full JSON Backup (products + image data)
  const handleDownloadFullBackup = () => {
    try {
      const backupData = {
        version: '5.0',
        exportedAt: new Date().toISOString(),
        totalItems: products.length,
        systemImagesCount: SYSTEM_BACKUP_IMAGES.length,
        products: products,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crc-thabo-products-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      showToast('ไม่สามารถดาวน์โหลดไฟล์สำรองได้');
    }
  };

  // 5. Restore from Uploaded JSON Backup file
  const handleRestoreFromBackupFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let items: ProductItem[] = [];

        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && Array.isArray(parsed.products)) {
          items = parsed.products;
        }

        if (items.length > 0) {
          setIsProcessing(true);
          await onUpdateProducts(items);
          showToast(`กู้คืนข้อมูลสำเร็จทั้งหมด ${items.length} รายการ`);
        } else {
          showToast('ไม่พบข้อมูลรายการสินค้าในไฟล์สำรอง');
        }
      } catch (err) {
        console.error(err);
        showToast('ไฟล์ JSON ไม่ถูกต้องหรือไม่สามารถอ่านได้');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Prompt',sans-serif]">
      <div className="w-full max-w-lg bg-[#252C33] border border-[#475662] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#20262D] border-b border-[#3A4750]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center border border-[#F6C90E]/40">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEEEEE] flex items-center gap-2">
                <span>จัดการรูปภาพ & สำรองไฟล์สินค้า</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F6C90E]/20 text-[#F6C90E] font-medium border border-[#F6C90E]/30">
                  ระบบจับคู่อัจฉริยะ
                </span>
              </h3>
              <p className="text-[10px] text-[#A0ABB5]">
                จับคู่รูปภาพจากชื่อไฟล์ด้วย รหัสสินค้า, คิวอาร์โค้ด หรือชื่อสินค้า
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0ABB5] hover:text-[#EEEEEE] hover:bg-[#3A4750] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#3A4750] bg-[#20262D]/60 px-3 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'system'
                ? 'border-[#F6C90E] text-[#F6C90E]'
                : 'border-transparent text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>รูปภาพสำรองในระบบ ({SYSTEM_BACKUP_IMAGES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-[#F6C90E] text-[#F6C90E]'
                : 'border-transparent text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>อัปโหลด & จับคู่ชื่อไฟล์</span>
            {uploadedMatches.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#F6C90E] text-[#252C33] text-[10px] font-bold flex items-center justify-center">
                {uploadedMatches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'backup'
                ? 'border-[#F6C90E] text-[#F6C90E]'
                : 'border-transparent text-[#A0ABB5] hover:text-[#EEEEEE]'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>สำรอง / กู้คืน JSON</span>
          </button>
        </div>

        {/* Toast alert banner */}
        {toastMsg && (
          <div className="bg-[#F6C90E] text-[#252C33] font-bold text-xs px-4 py-2 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
          {/* TAB 1: System Built-in Images */}
          {activeTab === 'system' && (
            <div className="space-y-3.5">
              <div className="bg-[#3A4750] border border-[#475662] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#EEEEEE] text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>รูปภาพถ่ายสินค้าที่สำรองไว้ในระบบ</span>
                  </h4>
                  <p className="text-[11px] text-[#A0ABB5] mt-0.5">
                    มีรูปภาพสำรองความละเอียดสูง 6 รายการ พร้อมเชื่อมโยงกับฐานข้อมูล
                  </p>
                </div>
                <button
                  disabled={isProcessing}
                  onClick={handleRestoreAllSystemImages}
                  className="px-3 py-2 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-[#F6C90E]/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  <FolderSync className="w-4 h-4" />
                  <span>{isProcessing ? 'กำลังบันทึก...' : 'ซิงค์และบันทึกทั้งหมด'}</span>
                </button>
              </div>

              {/* Grid of 6 Backed up Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SYSTEM_BACKUP_IMAGES.map((img) => {
                  const matchedProd = products.find(
                    (p) =>
                      p.id === img.id ||
                      (img.barcode && p.barcode === img.barcode) ||
                      p.name.toLowerCase() === img.name.toLowerCase()
                  );

                  return (
                    <div
                      key={img.id}
                      className="bg-[#3A4750]/60 border border-[#475662] hover:border-[#F6C90E]/60 rounded-xl p-2.5 flex gap-2.5 items-center transition-all group"
                    >
                      {/* Image Thumbnail */}
                      <div
                        onClick={() => setPreviewZoomImage({ url: img.url, title: img.name })}
                        className="w-16 h-16 rounded-lg bg-[#252C33] border border-[#475662] overflow-hidden flex-shrink-0 cursor-pointer relative group-hover:scale-105 transition-transform"
                        title="คลิกเพื่อขยายดูรูปภาพ"
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-bold text-[#EEEEEE] text-xs truncate">
                          {img.name}
                        </div>
                        <div className="text-[10px] text-[#A0ABB5] truncate font-mono">
                          📁 {img.fileName}
                        </div>

                        {/* Match Badges */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#252C33] text-[#F6C90E] border border-[#475662] font-mono">
                            รหัส: {img.id.slice(0, 8)}...
                          </span>
                          {img.barcode && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#252C33] text-emerald-300 border border-[#475662] font-mono">
                              บาร์โค้ด: {img.barcode}
                            </span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="text-[10px] flex items-center gap-1 text-emerald-400 font-medium">
                          <Check className="w-3 h-3" />
                          <span>
                            {matchedProd ? `เชื่อมกับสินค้าในคลังแล้ว` : 'รอจับคู่กับสินค้า'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Batch Upload & Auto-matching by Filename */}
          {activeTab === 'upload' && (
            <div className="space-y-3.5">
              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#F6C90E]/60 hover:border-[#F6C90E] bg-[#3A4750]/40 hover:bg-[#3A4750]/80 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <div className="w-12 h-12 rounded-2xl bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center mx-auto border border-[#F6C90E]/40">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-[#EEEEEE] text-sm block">
                    คลิกเพื่อเลือกไฟล์รูปภาพ หรือลากรูปภาพมาวางที่นี่
                  </span>
                  <span className="text-[11px] text-[#A0ABB5] mt-1 block">
                    ระบบจะวิเคราะห์ชื่อไฟล์เพื่อจับคู่กับ <strong className="text-[#F6C90E]">รหัสสินค้า</strong>,{' '}
                    <strong className="text-[#F6C90E]">รหัสคิวอาร์โค้ด/บาร์โค้ด</strong> หรือ{' '}
                    <strong className="text-[#F6C90E]">ชื่อสินค้า</strong> ให้อัตโนมัติ
                  </span>
                </div>
              </div>

              {/* Matched Items List */}
              {uploadedMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#EEEEEE]">
                      รายการรูปภาพที่ตรวจพบ ({uploadedMatches.length} ไฟล์):
                    </span>
                    <button
                      onClick={handleSaveUploadedMatches}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-[#F6C90E] hover:bg-[#E5B800] text-[#252C33] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isProcessing ? 'กำลังบันทึก...' : 'บันทึกรูปภาพทั้งหมดเข้าระบบ'}</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {uploadedMatches.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#3A4750] border border-[#475662] rounded-xl p-2.5 flex items-center gap-3"
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.fileName}
                          className="w-14 h-14 rounded-lg object-cover border border-[#475662] flex-shrink-0"
                        />

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-bold text-[#EEEEEE] truncate text-xs">
                            {item.fileName}
                          </div>

                          {/* Match info tag */}
                          <div className="flex items-center gap-1 text-[10px]">
                            {item.matchResult.matchType !== 'none' ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {item.matchResult.matchLabel}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-medium">
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                                ไม่พบอัตโนมัติ - โปรดเลือกสินค้าด้านล่าง
                              </span>
                            )}
                          </div>

                          {/* Dropdown selector for product pairing */}
                          <select
                            value={item.selectedProductId}
                            onChange={(e) => {
                              const newId = e.target.value;
                              setUploadedMatches((prev) =>
                                prev.map((m) =>
                                  m.id === item.id ? { ...m, selectedProductId: newId } : m
                                )
                              );
                            }}
                            className="w-full bg-[#252C33] border border-[#475662] text-[#EEEEEE] rounded-lg px-2 py-1 text-xs focus:border-[#F6C90E] outline-none"
                          >
                            <option value="">-- เลือกสินค้าที่ตรงกับรูปนี้ --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || p.size} ({p.id}) {p.barcode ? `• คิวอาร์: ${p.barcode}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Remove item button */}
                        <button
                          onClick={() => {
                            setUploadedMatches((prev) => prev.filter((m) => m.id !== item.id));
                          }}
                          className="p-1 rounded-lg text-[#A0ABB5] hover:text-rose-400 hover:bg-[#252C33] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Full JSON Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-3.5">
              {/* Backup Card */}
              <div className="bg-[#3A4750] border border-[#475662] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#EEEEEE] text-sm">
                      สำรองไฟล์ข้อมูลสินค้าและรูปภาพ (Export JSON)
                    </h4>
                    <p className="text-[11px] text-[#A0ABB5]">
                      ดาวน์โหลดข้อมูลสินค้าทั้งหมด {products.length} รายการ พร้อมข้อมูลรูปภาพเพื่อสำรองไว้ในเครื่อง
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadFullBackup}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.JSON)</span>
                </button>
              </div>

              {/* Restore Card */}
              <div className="bg-[#3A4750] border border-[#475662] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F6C90E]/20 text-[#F6C90E] flex items-center justify-center border border-[#F6C90E]/40">
                    <HardDriveDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#EEEEEE] text-sm">
                      นำเข้าไฟล์สำรองเพื่อกู้คืน (Restore JSON)
                    </h4>
                    <p className="text-[11px] text-[#A0ABB5]">
                      หากข้อมูลหรือรูปภาพสูญหาย สามารถเลือกไฟล์สำรองเพื่อกู้คืนข้อมูลกลับมาได้ทันที
                    </p>
                  </div>
                </div>

                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRestoreFromBackupFile(file);
                  }}
                />

                <button
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-3 bg-[#252C33] hover:bg-[#1E2329] border border-[#475662] text-[#EEEEEE] font-bold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <HardDriveDownload className="w-4 h-4 text-[#F6C90E]" />
                  <span>เลือกไฟล์ JSON จากเครื่องเพื่อกู้คืน</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#20262D] border-t border-[#3A4750] flex items-center justify-between text-xs">
          <span className="text-[#A0ABB5]">
            สินค้าทั้งหมด <strong className="text-[#F6C90E]">{products.length}</strong> รายการ
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3A4750] hover:bg-[#43525D] text-[#EEEEEE] rounded-xl font-semibold transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {previewZoomImage && (
        <div
          onClick={() => setPreviewZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="max-w-md w-full bg-[#252C33] border border-[#475662] rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative">
              <img
                src={previewZoomImage.url}
                alt={previewZoomImage.title}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <button
                onClick={() => setPreviewZoomImage(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 text-center font-bold text-[#EEEEEE] text-sm">
              {previewZoomImage.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
