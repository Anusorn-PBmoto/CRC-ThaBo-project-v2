import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  testConnection,
  seedTiresIfEmpty,
  subscribeToTires,
  fetchAuditSessions,
  fetchAuditLogs,
  fetchTransactions,
  executeTransaction,
  executeStockTransfer,
  executeBatchStockTransfer,
  updateTireActualQty,
  addNewTire,
  updateTireItem,
  deleteTireItem,
  saveAuditSession,
  restoreAllInitialTires,
  sanitizeForFirestore,
  isQuotaError,
  isFirestoreQuotaExhausted,
  markQuotaExhausted,
  resetQuotaCircuitBreaker,
  retryCloudConnection,
  fetchLiveTiresFromCloud,
  db,
} from './firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { AlertTriangle, CloudOff, RefreshCw, Download } from 'lucide-react';
import { ProductItem, TireItem, AuditSession, AuditLog, Transaction, StockStatus, StockTransfer } from './types';
import { INITIAL_PRODUCTS, INITIAL_TIRES } from './initialData';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { QuickAuditTab } from './components/QuickAuditTab';
import { InventoryListTab } from './components/InventoryListTab';
import { BuySellTab } from './components/BuySellTab';
import { SummaryAlertsTab } from './components/SummaryAlertsTab';
import { AuditHistoryTab } from './components/AuditHistoryTab';
import { AddEditProductModal } from './components/AddEditProductModal';
import { BarcodeScanModal } from './components/BarcodeScanModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { AuditSaveConfirmModal } from './components/AuditSaveConfirmModal';
import { ProfileModal } from './components/ProfileModal';
import { AppSheetSyncModal } from './components/AppSheetSyncModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ImageMatchBackupModal } from './components/ImageMatchBackupModal';
import { StockTransferModal } from './components/StockTransferModal';
import { BatchStockTransferModal } from './components/BatchStockTransferModal';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { StaffPosView } from './components/StaffPosView';
import {
  generateAppSheetCsv,
  downloadAppSheetCsv,
  APPSHEET_CSV_FILENAME,
} from './utils/appsheetCsv';
import { resolveProductImage } from './utils/productImages';
import { cleanLocationName } from './utils/stockUtils';

const LOCAL_STORAGE_KEY_TIRES = 'crc_thabo_parts_itemdetails_v5';
const LOCAL_STORAGE_KEY_TRANSACTIONS = 'crc_thabo_transactions_itemdetails_v5';
const LOCAL_STORAGE_KEY_SESSIONS = 'crc_thabo_sessions_itemdetails_v5';
const LOCAL_STORAGE_KEY_LOGS = 'crc_thabo_logs_itemdetails_v5';

const defaultTiresList: ProductItem[] = INITIAL_PRODUCTS.map((p) => ({
  ...p,
  frontLocation: cleanLocationName(p.frontLocation),
  location: cleanLocationName(p.location || 'RACK A-01'),
}));

export default function App() {
  const [tires, setTires] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TIRES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map((p: ProductItem) => {
            const recImg = resolveProductImage(p);
            return {
              ...p,
              imageUrl: (!p.imageUrl || p.imageUrl.trim() === '') && recImg ? recImg : p.imageUrl,
              frontLocation: cleanLocationName(p.frontLocation),
              location: cleanLocationName(p.location || 'RACK A-01'),
            };
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_TIRES, JSON.stringify(cleaned));
          } catch {}
          return cleaned;
        }
      }

      // Migrate from legacy v4 if available
      const legacySaved = localStorage.getItem('crc_thabo_parts_itemdetails_v4');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map((p: ProductItem) => {
            const recImg = resolveProductImage(p);
            return {
              ...p,
              imageUrl: (!p.imageUrl || p.imageUrl.trim() === '') && recImg ? recImg : p.imageUrl,
              frontLocation: cleanLocationName(p.frontLocation),
              location: cleanLocationName(p.location || 'RACK A-01'),
            };
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_TIRES, JSON.stringify(cleaned));
          } catch {}
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Failed reading products from localStorage', e);
    }
    return defaultTiresList;
  });

  const [sessions, setSessions] = useState<AuditSession[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SESSIONS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [logs, setLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [currentTab, setCurrentTab] = useState<TabType>('audit');
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state helpers to guarantee localStorage is always updated
  const persistTires = (updater: TireItem[] | ((prev: TireItem[]) => TireItem[])) => {
    setTires((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_TIRES, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const persistTransactions = (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    setTransactions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_TRANSACTIONS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const persistSessions = (updater: AuditSession[] | ((prev: AuditSession[]) => AuditSession[])) => {
    setSessions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_SESSIONS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const persistLogs = (updater: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => {
    setLogs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingTire, setEditingTire] = useState<TireItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPOOpen, setIsPOOpen] = useState(false);
  const [poItems, setPoItems] = useState<TireItem[]>([]);
  const [isAuditConfirmOpen, setIsAuditConfirmOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAppSheetOpen, setIsAppSheetOpen] = useState(false);
  const [appSheetToast, setAppSheetToast] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isImageMatchOpen, setIsImageMatchOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferProduct, setTransferProduct] = useState<ProductItem | null>(null);
  const [isBatchTransferOpen, setIsBatchTransferOpen] = useState(false);
  const [batchTransferItems, setBatchTransferItems] = useState<ProductItem[]>([]);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => isFirestoreQuotaExhausted());
  const [isRetryingCloud, setIsRetryingCloud] = useState(false);
  const [isStaffPosMode, setIsStaffPosMode] = useState(false);
  const [staffScannedProduct, setStaffScannedProduct] = useState<ProductItem | null>(null);

  // Auto-detect Dev Preview environment: ais-dev-... or localhost
  const isDevPreviewEnv =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('ais-dev-') ||
      window.location.hostname === 'localhost' ||
      window.location.port === '3000');

  // Sandbox Mode: Defaults to ON in Dev Preview so tests never alter live Cloud data!
  const [isSandboxMode, setIsSandboxMode] = useState(() => {
    try {
      const saved = localStorage.getItem('crc_thabo_sandbox_mode');
      if (saved !== null) return saved === 'true';
    } catch {}
    return isDevPreviewEnv;
  });

  const toggleSandboxMode = () => {
    setIsSandboxMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('crc_thabo_sandbox_mode', String(next));
      } catch {}
      setAppSheetToast(
        next
          ? '🧪 เปิดโหมดทดสอบ (Sandbox): การซื้อ-ขาย-ตัดสต็อกจะไม่บันทึกลงคลาวด์จริง'
          : '☁️ เปิดโหมดจริง (Live Cloud): ทุกรายการจะถูกบันทึกลงคลาวด์จริง'
      );
      setTimeout(() => setAppSheetToast(null), 3500);
      return next;
    });
  };

  // Reset local state back to pristine live Firestore state (discards any test changes)
  const handleResetToLiveCloud = async () => {
    try {
      setAppSheetToast('🔄 กำลังดึงข้อมูลล่าสุดจากคลาวด์...');
      const freshProducts = await fetchLiveTiresFromCloud();
      if (freshProducts.length > 0) {
        persistTires(freshProducts);
        setAppSheetToast('✅ รีเซ็ตข้อมูลกลับสู่ค่าจริงบนคลาวด์เรียบร้อยแล้ว');
      } else {
        setAppSheetToast('⚠️ ไม่พบข้อมูลบนคลาวด์');
      }
      setTimeout(() => setAppSheetToast(null), 3500);
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  const handleRetryCloud = async () => {
    setIsRetryingCloud(true);
    try {
      const res = await retryCloudConnection();
      if (res.success) {
        setIsQuotaExceeded(false);
        setIsOnline(true);
        setAppSheetToast('✅ ' + res.message);
      } else {
        setIsQuotaExceeded(true);
        setIsOnline(false);
        setAppSheetToast('⚠️ ' + res.message);
      }
    } catch (e) {
      setIsQuotaExceeded(true);
      setIsOnline(false);
      setAppSheetToast('⚠️ ยังไม่สามารถเชื่อมต่อได้ ทำงานในโหมดออฟไลน์');
    } finally {
      setIsRetryingCloud(false);
    }
  };

  // Listen to browser network online/offline events for seamless offline-first experience
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAppSheetToast('🟢 เชื่อมต่ออินเทอร์เน็ตแล้ว: ระบบกำลังซิงค์ข้อมูลกับคลาวด์ Firestore อัตโนมัติ');
      setTimeout(() => setAppSheetToast(null), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setAppSheetToast('📶 โหมดออฟไลน์: บันทึกข้อมูลลงในเครื่องได้ตามปกติ และจะซิงค์ขึ้นคลาวด์ทันทีเมื่อต่อเน็ต');
      setTimeout(() => setAppSheetToast(null), 4500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
    }

    // Proactively clean any legacy keys or stale localStorage entries
    try {
      const keys = [LOCAL_STORAGE_KEY_TIRES, 'crc_thabo_parts_itemdetails_v4', 'crc_thabo_tires_inventory_v3'];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw && (raw.includes('เชลฟ์') || raw.includes('โชว์'))) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const cleaned = arr.map((item: any) => ({
                ...item,
                frontLocation: cleanLocationName(item.frontLocation),
                location: cleanLocationName(item.location || 'RACK A-01'),
              }));
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          } catch {}
        }
      }
    } catch {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize and subscribe (Streamlined: Single product listener, zero eager fetches)
  useEffect(() => {
    let unsubscribeTires: (() => void) | undefined;

    const initFirebase = async () => {
      // If quota was already exhausted, stay in local offline mode immediately
      if (isFirestoreQuotaExhausted()) {
        setIsQuotaExceeded(true);
        setIsOnline(false);
        return;
      }

      try {
        // 1. Attach single real-time listener for products only (the essential live stock data)
        unsubscribeTires = subscribeToTires(
          (remoteData) => {
            if (remoteData && remoteData.length > 0) {
              setTires((currentTires) => {
                const localMap = new Map(currentTires.map((t) => [t.id, t]));
                const remoteIds = new Set(remoteData.map((p) => p.id));

                const mergedRemote = remoteData.map((remoteItem) => {
                  const localItem = localMap.get(remoteItem.id);
                  const recoveredImg = resolveProductImage(remoteItem);
                  const effectiveImg =
                    remoteItem.imageUrl && remoteItem.imageUrl.trim() !== ''
                      ? remoteItem.imageUrl
                      : localItem?.imageUrl && localItem.imageUrl.trim() !== ''
                      ? localItem.imageUrl
                      : recoveredImg || '';

                  // Preserve local front/warehouse quantities if remote has not persisted them yet
                  const hasLocalFront = localItem && typeof localItem.frontQty === 'number';
                  const hasRemoteFront = typeof remoteItem.frontQty === 'number';

                  return {
                    ...remoteItem,
                    imageUrl: effectiveImg,
                    frontQty: hasRemoteFront ? remoteItem.frontQty : hasLocalFront ? localItem.frontQty : undefined,
                    warehouseQty: hasRemoteFront ? remoteItem.warehouseQty : hasLocalFront ? localItem.warehouseQty : undefined,
                    frontLocation: cleanLocationName(remoteItem.frontLocation || localItem?.frontLocation),
                    location: cleanLocationName(remoteItem.location || localItem?.location || 'RACK A-01'),
                  };
                });

                // Preserve any product that was created locally and not yet synced to remoteData
                const locallyAdded = currentTires.filter((t) => !remoteIds.has(t.id));

                const nextCombined = [...locallyAdded, ...mergedRemote];
                try {
                  localStorage.setItem(LOCAL_STORAGE_KEY_TIRES, JSON.stringify(nextCombined));
                } catch (e) {}
                return nextCombined;
              });
            } else {
              // Remote collection is empty: check if local storage has products that need preserving
              try {
                const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TIRES);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    persistTires(parsed);
                    setIsOnline(true);
                    return;
                  }
                }
              } catch (e) {
                console.warn('Error checking local storage fallback:', e);
              }
              persistTires(INITIAL_PRODUCTS);
            }
            setIsOnline(true);
          },
          (err) => {
            console.warn('Products listener note:', err);
            if (isQuotaError(err)) {
              markQuotaExhausted();
              setIsQuotaExceeded(true);
            }
            setIsOnline(false);
          }
        );
      } catch (error) {
        if (isQuotaError(error)) {
          markQuotaExhausted();
          setIsQuotaExceeded(true);
        }
        console.warn('Firebase initialization note (offline mode active):', error);
      }
    };

    initFirebase();

    return () => {
      if (unsubscribeTires) unsubscribeTires();
    };
  }, []);

  // 2. Lazy-load history & transactions on demand only when switching to relevant tabs
  useEffect(() => {
    if (isFirestoreQuotaExhausted()) return;

    if (currentTab === 'history') {
      fetchAuditSessions()
        .then((remoteSessions) => {
          if (remoteSessions && remoteSessions.length > 0) {
            persistSessions(remoteSessions);
          }
        })
        .catch(() => {});

      fetchAuditLogs()
        .then((remoteLogs) => {
          if (remoteLogs && remoteLogs.length > 0) {
            persistLogs(remoteLogs);
          }
        })
        .catch(() => {});
    } else if (currentTab === 'buysell' || currentTab === 'alerts') {
      fetchTransactions()
        .then((remoteTx) => {
          if (remoteTx && remoteTx.length > 0) {
            persistTransactions(remoteTx);
          }
        })
        .catch(() => {});
    }
  }, [currentTab]);

  const activeSession = sessions[0] || null;

  // Stepper quantity update (Instant optimistic UI + local storage + single product cloud write)
  const handleUpdateQty = async (tire: TireItem, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    const diff = safeQty - tire.systemQty;
    const status: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

    // 1. Instant optimistic update + localStorage persist
    persistTires((prev) =>
      prev.map((t) =>
        t.id === tire.id
          ? { ...t, actualQty: safeQty, status, updatedAt: new Date().toISOString() }
          : t
      )
    );

    // 2. Record locally in audit logs for UI history without burning cloud write quota
    const localLog: AuditLog = {
      id: `local-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: tire.id,
      tireId: tire.id,
      productName: tire.name || tire.size || 'สินค้า',
      tireName: tire.name || tire.size || 'สินค้า',
      brand: tire.brand || '',
      diff,
      previousQty: tire.systemQty,
      newQty: safeQty,
      action: diff === 0 ? 'ตรวจนับตรงระบบ' : `คลาดเคลื่อน (${diff > 0 ? '+' : ''}${diff})`,
      timestamp: new Date().toISOString(),
      note: diff === 0 ? 'ยอดตรวจตรงกับระบบ' : `ปรับค่ายอดนับจริงเป็น ${safeQty}`,
    };
    persistLogs((prev) => [localLog, ...prev.slice(0, 49)]);

    // 3. Persist single product document to Firestore (skipping if in Sandbox mode!)
    if (isSandboxMode) {
      console.log('🧪 [Sandbox Mode] Skipping updateTireActualQty cloud write');
      return;
    }

    try {
      await updateTireActualQty(
        tire.id,
        safeQty,
        tire.systemQty,
        tire.name || tire.size || 'สินค้า',
        tire.brand || ''
      );
    } catch (error) {
      console.warn('Failed to sync quantity to Firestore:', error);
    }
  };

  // Add / Edit Product
  const handleSaveTire = async (tireData: Omit<TireItem, 'id'>, id?: string) => {
    try {
      const sanitizedTireData: Omit<TireItem, 'id'> = {
        ...tireData,
        frontLocation: cleanLocationName(tireData.frontLocation),
        location: cleanLocationName(tireData.location || 'RACK A-01'),
      };
      let nextList: ProductItem[] = [];

      if (id) {
        // Optimistic update
        nextList = tires.map((t) =>
          t.id === id ? { ...t, ...sanitizedTireData, updatedAt: new Date().toISOString() } : t
        );
        persistTires(nextList);
        await updateTireItem(id, sanitizedTireData);
      } else {
        // Generate permanent Firestore document ID upfront
        const newId = doc(collection(db, 'products')).id;
        const newTire: TireItem = {
          ...sanitizedTireData,
          id: newId,
          updatedAt: new Date().toISOString(),
        };
        nextList = [newTire, ...tires];
        persistTires(nextList);

        await addNewTire(sanitizedTireData, newId);
      }

      // Cache latest CSV data quietly in background without triggering browser download popup
      try {
        const csvContent = generateAppSheetCsv(nextList);
        localStorage.setItem('crc_thano_last_csv_content', csvContent);
        localStorage.setItem('crc_thano_last_csv_timestamp', new Date().toISOString());
      } catch (csvErr) {
        console.warn('AppSheet CSV cache note:', csvErr);
      }

      setIsAddEditOpen(false);
      setEditingTire(null);
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  };

  // Delete Product - Open Custom In-App Modal
  const handleDeleteTire = (tire: TireItem) => {
    setProductToDelete(tire);
  };

  // Batch update products (used by ImageMatchBackupModal & restore utilities)
  const handleBatchUpdateProducts = async (updatedList: ProductItem[]) => {
    persistTires(updatedList);
    if (isFirestoreQuotaExhausted()) {
      return;
    }
    try {
      // Chunk batch updates into batches of 80 items to avoid Firestore batch size limit & timeouts
      const CHUNK_SIZE = 80;
      for (let i = 0; i < updatedList.length; i += CHUNK_SIZE) {
        const chunk = updatedList.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const ref = doc(db, 'products', item.id);
          batch.set(ref, sanitizeForFirestore(item), { merge: true });
        });
        await batch.commit();
      }
      console.log('Successfully batch updated products to Firestore:', updatedList.length);
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExhausted();
        setIsQuotaExceeded(true);
      }
      console.warn('Failed batch updating products to Firestore (saved locally):', err);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const target = productToDelete;
    setProductToDelete(null);

    // Optimistic delete + localStorage persist
    persistTires((prev) => prev.filter((t) => t.id !== target.id));
    try {
      await deleteTireItem(target.id);
      console.log('Successfully deleted product from Firestore:', target.id);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Save Audit Session
  const handleConfirmAuditSave = async (syncToSystem: boolean) => {
    try {
      const checkedCount = tires.filter((t) => t.status === 'checked').length;
      const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;

      const sessionId = activeSession?.id || `AUD-${Date.now()}`;
      const sessionCode = activeSession?.code || `AUD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;

      const savedSession: AuditSession = {
        id: sessionId,
        code: sessionCode,
        zone: 'คลังอะไหล่',
        title: 'คลังอะไหล่มอเตอร์ไซค์ • บันทึกผลนับสต็อก',
        status: 'completed',
        totalItems: tires.length,
        checkedItems: checkedCount,
        discrepancyCount: syncToSystem ? 0 : discrepancyCount,
        createdAt: activeSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Optimistic update session
      persistSessions((prev) => [savedSession, ...prev.filter((s) => s.id !== sessionId)]);

      // 2. Optimistic audit log
      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        productId: 'audit-session',
        productName: 'สรุปการนับสต็อกคลังอะไหล่',
        tireId: 'audit-session',
        tireName: 'สรุปการนับสต็อกคลังอะไหล่',
        brand: 'CRC ThaBo',
        diff: syncToSystem ? 0 : discrepancyCount,
        previousQty: tires.length,
        newQty: checkedCount,
        action: 'บันทึกปิดรอบตรวจนับ',
        timestamp: new Date().toISOString(),
        note: `ตรวจเสร็จ ${checkedCount}/${tires.length} รายการ (พบยอดต่าง ${discrepancyCount} รายการ)${syncToSystem ? ' • ปรับยอดสต็อกในระบบให้ตรงกับยอดนับจริงแล้ว' : ''}`,
      };
      persistLogs((prev) => [newLog, ...prev]);

      // 3. If user chose to sync system stock to actual counts:
      if (syncToSystem) {
        persistTires((prev) =>
          prev.map((tire) => ({
            ...tire,
            systemQty: tire.actualQty,
            status: 'checked',
            updatedAt: new Date().toISOString(),
          }))
        );

        // Batch update to Firestore (Skip if in Sandbox mode!)
        if (!isSandboxMode) {
          try {
            const batch = writeBatch(db);
            tires.forEach((tire) => {
              if (tire.actualQty !== tire.systemQty) {
                const prodRef = doc(db, 'products', tire.id);
                batch.set(
                  prodRef,
                  {
                    systemQty: tire.actualQty,
                    status: 'checked',
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
              }
            });
            await batch.commit();
          } catch (err) {
            console.warn('Batch stock sync warning:', err);
          }
        }
      }

      // 4. Save session to Firestore (Skip if in Sandbox mode!)
      if (!isSandboxMode) {
        saveAuditSession(sessionId, {
          code: sessionCode,
          zone: 'คลังอะไหล่',
          title: 'คลังอะไหล่มอเตอร์ไซค์ • บันทึกผลนับสต็อก',
          totalItems: tires.length,
          checkedItems: checkedCount,
          discrepancyCount: syncToSystem ? 0 : discrepancyCount,
          status: 'completed',
        }).catch(console.warn);
      }

      setIsAuditConfirmOpen(false);

      // Trigger celebratory confetti
      confetti({
        particleCount: 100,
        spread: 75,
        origin: { y: 0.65 },
        colors: ['#f59e0b', '#10b981', '#38bdf8', '#fbbf24'],
      });
    } catch (error) {
      console.error('Failed to save audit session:', error);
    }
  };

  // Clear all products (reset to 0 items per user instruction)
  const handleClearAllProducts = async () => {
    try {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY_TIRES);
      } catch (e) {}
      await restoreAllInitialTires();
      persistTires([]);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (error) {
      console.error('Failed to clear products:', error);
    }
  };

  // Force sync local products to Firestore Cloud
  const handleForceSyncCloud = async () => {
    try {
      if (tires.length > 0) {
        const batch = writeBatch(db);
        for (const item of tires) {
          const itemRef = doc(db, 'products', item.id);
          batch.set(itemRef, item, { merge: true });
        }
        await batch.commit();
      }
      setIsOnline(true);
    } catch (error) {
      console.error('Failed to force sync with cloud:', error);
    }
  };

  // Stock Transfer between Warehouse & Storefront
  const handleOpenTransferModal = (product: ProductItem) => {
    setTransferProduct(product);
    setIsTransferOpen(true);
  };

  const handleConfirmStockTransfer = async (
    transfer: StockTransfer,
    updatedProduct: ProductItem
  ) => {
    // 1. Optimistic update of products list + localStorage
    persistTires((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );

    // 2. Optimistic update of audit logs + localStorage
    const logEntry: AuditLog = {
      id: `log-txf-${Date.now()}`,
      productId: updatedProduct.id,
      productName: updatedProduct.name || updatedProduct.size || 'สินค้า',
      brand: updatedProduct.brand,
      diff: transfer.quantity,
      previousQty: updatedProduct.actualQty,
      newQty: updatedProduct.actualQty,
      action:
        transfer.fromLocation === 'warehouse'
          ? 'โอนย้าย: คลัง ➡️ หน้าร้าน'
          : 'โอนย้าย: หน้าร้าน ➡️ คลัง',
      timestamp: transfer.timestamp,
      note: transfer.note || `โอนย้ายจำนวน ${transfer.quantity} ${updatedProduct.unit || 'ชิ้น'}`,
    };
    persistLogs((prev) => [logEntry, ...prev]);

    // 3. Persist to Firestore Cloud (Skip if in Sandbox mode!)
    if (!isSandboxMode) {
      try {
        await executeStockTransfer(transfer, updatedProduct);
      } catch (err) {
        console.warn('executeStockTransfer error:', err);
      }
    }

    setAppSheetToast(
      transfer.fromLocation === 'warehouse'
        ? `✅ เติมสต็อกหน้าร้าน (+${transfer.quantity} ${updatedProduct.unit || 'ชิ้น'}) เรียบร้อย`
        : `✅ ส่งคืนคลังสินค้า (+${transfer.quantity} ${updatedProduct.unit || 'ชิ้น'}) เรียบร้อย`
    );
  };

  // Batch Stock Transfer
  const handleOpenBatchTransfer = (selectedProducts: ProductItem[]) => {
    setBatchTransferItems(selectedProducts);
    setIsBatchTransferOpen(true);
  };

  const handleConfirmBatchStockTransfer = async (
    batchList: { transfer: StockTransfer; updatedProduct: ProductItem }[]
  ) => {
    if (batchList.length === 0) return;

    // 1. Optimistic update of tires state + localStorage
    const updatedMap = new Map(
      batchList.map((item) => [item.updatedProduct.id, item.updatedProduct])
    );
    persistTires((prev) => prev.map((p) => updatedMap.get(p.id) || p));

    // 2. Optimistic update of audit logs + localStorage
    const newLogs: AuditLog[] = batchList.map((item) => ({
      id: `log-txf-${Date.now()}-${item.updatedProduct.id}`,
      productId: item.updatedProduct.id,
      productName: item.updatedProduct.name || item.updatedProduct.size || 'สินค้า',
      brand: item.updatedProduct.brand,
      diff: item.transfer.quantity,
      previousQty: item.updatedProduct.actualQty,
      newQty: item.updatedProduct.actualQty,
      action:
        item.transfer.fromLocation === 'warehouse'
          ? 'โอนย้าย: คลัง ➡️ หน้าร้าน'
          : 'โอนย้าย: หน้าร้าน ➡️ คลัง',
      timestamp: item.transfer.timestamp,
      note:
        item.transfer.note ||
        `โอนย้ายจำนวน ${item.transfer.quantity} ${item.updatedProduct.unit || 'ชิ้น'}`,
    }));
    persistLogs((prev) => [...newLogs, ...prev]);

    // 3. Persist to Firebase Cloud (Skip if in Sandbox mode!)
    if (!isSandboxMode) {
      try {
        await executeBatchStockTransfer(batchList);
      } catch (err) {
        console.warn('executeBatchStockTransfer error:', err);
      }
    }

    const totalQty = batchList.reduce(
      (acc, curr) => acc + curr.transfer.quantity,
      0
    );
    setAppSheetToast(
      `✅ โอนย้ายสต็อกสำเร็จ ${batchList.length} รายการ (รวม ${totalQty} ชิ้น) เรียบร้อย`
    );
  };

  // Quick navigation helpers
  const handleJumpToAudit = (tire: TireItem) => {
    setCurrentTab('audit');
  };

  const handleOpenSinglePO = (tire: TireItem) => {
    setPoItems([tire]);
    setIsPOOpen(true);
  };

  const handleOpenBatchPO = (selectedTires: TireItem[]) => {
    setPoItems(selectedTires);
    setIsPOOpen(true);
  };

  // Execute Buy / Sell transaction with auto stock deduction
  const handleExecuteTransaction = async (
    type: 'sale' | 'purchase',
    items: { tire: TireItem; quantity: number; unitPrice: number; isSubUnit?: boolean }[],
    customerOrSupplier: string,
    note?: string,
    locationTarget: 'front' | 'warehouse' = 'front'
  ) => {
    // 1. Instant optimistic update of tire stocks in UI + localStorage
    persistTires((prevTires) => {
      let updated = [...prevTires];
      for (const item of items) {
        const rate = item.tire.conversionRate && item.tire.conversionRate > 1 ? item.tire.conversionRate : 1;
        const effectiveQty = (type === 'sale' && item.isSubUnit && rate > 1)
          ? item.quantity / rate
          : item.quantity;
        const delta = type === 'sale' ? -effectiveQty : effectiveQty;

        updated = updated.map((t) => {
          if (t.id === item.tire.id) {
            const nextSystemQty = Math.max(0, Math.round((t.systemQty + delta) * 10000) / 10000);
            const nextActualQty = Math.max(0, Math.round((t.actualQty + delta) * 10000) / 10000);
            const diff = Math.round((nextActualQty - nextSystemQty) * 10000) / 10000;
            const nextStatus: StockStatus = Math.abs(diff) < 0.0001 ? 'checked' : 'discrepancy';

            // Calculate front and warehouse allocation
            let currFront = t.frontQty ?? Math.min(t.actualQty, 2);
            let currWarehouse = t.warehouseQty ?? Math.max(0, t.actualQty - currFront);
            let nextFront = currFront;
            let nextWarehouse = currWarehouse;

            if (type === 'sale') {
              if (locationTarget === 'front') {
                if (nextFront >= effectiveQty) {
                  nextFront = Math.round((nextFront - effectiveQty) * 10000) / 10000;
                } else {
                  const rem = effectiveQty - nextFront;
                  nextFront = 0;
                  nextWarehouse = Math.max(0, Math.round((nextWarehouse - rem) * 10000) / 10000);
                }
              } else {
                if (nextWarehouse >= effectiveQty) {
                  nextWarehouse = Math.round((nextWarehouse - effectiveQty) * 10000) / 10000;
                } else {
                  const rem = effectiveQty - nextWarehouse;
                  nextWarehouse = 0;
                  nextFront = Math.max(0, Math.round((nextFront - rem) * 10000) / 10000);
                }
              }
            } else {
              if (locationTarget === 'front') {
                nextFront = Math.round((nextFront + effectiveQty) * 10000) / 10000;
              } else {
                nextWarehouse = Math.round((nextWarehouse + effectiveQty) * 10000) / 10000;
              }
            }

            return {
              ...t,
              frontQty: nextFront,
              warehouseQty: nextWarehouse,
              systemQty: nextSystemQty,
              actualQty: nextActualQty,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });
      }
      return updated;
    });

    // 2. Optimistic update of transactions list + localStorage
    const newTransactions: Transaction[] = items.map((item, idx) => {
      const prodName = item.tire.name || item.tire.size || 'สินค้า';
      const unitLabel = item.isSubUnit && item.tire.subUnit ? item.tire.subUnit : (item.tire.unit || 'ชิ้น');
      return {
        id: `tx-${Date.now()}-${idx}`,
        type,
        productId: item.tire.id,
        productName: prodName,
        tireId: item.tire.id,
        tireName: prodName,
        brand: item.tire.brand,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: unitLabel,
        totalPrice: item.quantity * item.unitPrice,
        locationTarget,
        customerOrSupplier: customerOrSupplier.trim() || (type === 'sale' ? 'ลูกค้าหน้าร้าน' : 'ตัวแทนจำหน่าย'),
        note: note?.trim() || '',
        createdAt: new Date().toISOString(),
      };
    });
    persistTransactions((prev) => [...newTransactions, ...prev]);

    // 3. Optimistic update of audit logs + localStorage
    const newLogs: AuditLog[] = items.map((item, idx) => {
      const rate = item.tire.conversionRate && item.tire.conversionRate > 1 ? item.tire.conversionRate : 1;
      const effectiveQty = (type === 'sale' && item.isSubUnit && rate > 1)
        ? item.quantity / rate
        : item.quantity;
      const delta = type === 'sale' ? -effectiveQty : effectiveQty;
      const prodName = item.tire.name || item.tire.size || 'สินค้า';
      const unitLabel = item.isSubUnit && item.tire.subUnit ? item.tire.subUnit : (item.tire.unit || 'ชิ้น');
      return {
        id: `log-tx-${Date.now()}-${idx}`,
        productId: item.tire.id,
        productName: prodName,
        tireId: item.tire.id,
        tireName: prodName,
        brand: item.tire.brand,
        diff: delta,
        previousQty: item.tire.actualQty,
        newQty: Math.max(0, Math.round((item.tire.actualQty + delta) * 10000) / 10000),
        action:
          type === 'sale'
            ? `ตัดสต็อกขาย (${locationTarget === 'front' ? 'หน้าร้าน' : 'คลัง'}) -${item.quantity} ${unitLabel}`
            : `รับเข้าสต็อก (${locationTarget === 'front' ? 'หน้าร้าน' : 'คลัง'}) +${item.quantity} ${unitLabel}`,
        timestamp: new Date().toISOString(),
        note: `${type === 'sale' ? 'ขายให้: ' : 'รับจาก: '}${customerOrSupplier.trim() || 'หน้าร้าน'} ${note ? `(${note})` : ''}`,
      };
    });
    persistLogs((prev) => [...newLogs, ...prev]);

    // 4. Background persist to Firestore safely (Skip if in Sandbox mode!)
    if (isSandboxMode) {
      console.log('🧪 [Sandbox Mode] Skipping executeTransaction Firestore write');
      setAppSheetToast('🧪 โหมดทดสอบ (Sandbox): ตัดสต็อกเฉพาะในหน้าจอนี้ ไม่ถูกบันทึกลงคลาวด์จริง');
      setTimeout(() => setAppSheetToast(null), 3500);
      return;
    }

    try {
      await executeTransaction(type, items, customerOrSupplier, note, locationTarget);
    } catch (err) {
      console.warn('executeTransaction Firestore sync warning:', err);
    }
  };

  // Bind scanned barcode to tire
  const handleBindBarcode = async (tireId: string, newBarcode: string) => {
    persistTires((prev) =>
      prev.map((t) => (t.id === tireId ? { ...t, barcode: newBarcode, updatedAt: new Date().toISOString() } : t))
    );
    try {
      await updateTireItem(tireId, { barcode: newBarcode });
    } catch (e) {
      console.warn('Failed to save barcode to tire:', e);
    }
  };

  // Counts for Badges
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const lowStockCount = tires.filter((t) => t.actualQty <= (t.minStock || 2)).length;
  const checkedCount = tires.filter((t) => t.status === 'checked').length;
  const matchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;

  // Dedicated Staff POS Mode (Simplified Counter Sales for Staff - Light Theme)
  if (isStaffPosMode) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 font-['Prompt',sans-serif]">
        <StaffPosView
          tires={tires}
          onExecuteTransaction={handleExecuteTransaction}
          onExitStaffMode={() => setIsStaffPosMode(false)}
          onOpenScanner={() => setIsScannerOpen(true)}
          scannedProduct={staffScannedProduct}
          onClearScannedProduct={() => setStaffScannedProduct(null)}
          isSandboxMode={isSandboxMode}
          onResetToLiveCloud={handleResetToLiveCloud}
          onToggleSandboxMode={toggleSandboxMode}
        />

        <BarcodeScanModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          tires={tires}
          onSelectTire={(tire) => {
            setStaffScannedProduct(tire);
            setIsScannerOpen(false);
          }}
          onBindBarcode={handleBindBarcode}
          isLightMode={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#252C33] text-[#EEEEEE] flex flex-col font-['Prompt',sans-serif]">
      {/* Top Header */}
      <Header
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAppSheet={() => setIsAppSheetOpen(true)}
        onToggleStaffPos={() => setIsStaffPosMode(true)}
        isOnline={isOnline && !isQuotaExceeded}
        isQuotaMode={isQuotaExceeded}
        activeZone="คลังอะไหล่มอเตอร์ไซค์"
        subtitle={
          currentTab === 'audit'
            ? 'นับสต็อกด่วน • อะไหล่มอเตอร์ไซค์ทุกชนิด'
            : currentTab === 'buysell'
            ? 'ซื้อ-ขายอะไหล่ • ตัดสต็อกอัตโนมัติ'
            : currentTab === 'alerts'
            ? 'สรุปยอดสินค้า & แจ้งเตือนสินค้าใกล้หมด'
            : currentTab === 'history'
            ? 'ประวัติการเคลื่อนไหวสต็อกอะไหล่'
            : 'รายการสินค้า & แคตตาล็อกอะไหล่'
        }
      />

      {/* Sandbox Test Mode Banner (Shows in Dev Preview or when user turns on Sandbox) */}
      {isSandboxMode && (
        <div className="bg-gradient-to-r from-amber-950/90 via-[#2E2516] to-[#252C33] border-b border-amber-500/40 px-3 py-1.5 text-xs font-['Prompt',sans-serif] z-20 shadow-md">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-[11px] font-bold text-amber-300 truncate">
                🧪 โหมดทดสอบ (Sandbox): ไม่บันทึกลงคลาวด์จริง
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleResetToLiveCloud}
                title="ดึงข้อมูลล่าสุดจากคลาวด์ใหม่ ยกเลิกการทดสอบทั้งหมด"
                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>รีเซ็ตค่าจริง</span>
              </button>

              <button
                type="button"
                onClick={toggleSandboxMode}
                title="สลับโหมด"
                className="px-1.5 py-0.5 rounded-lg bg-[#252C33] hover:bg-[#323B44] text-[#A0ABB5] text-[10px] border border-[#475662] transition-colors cursor-pointer"
              >
                สลับโหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AppSheet Real-Time Notification Toast */}
      {appSheetToast && (
        <div className="fixed top-16 left-0 right-0 z-40 px-3 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200 font-['Prompt',sans-serif]">
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="bg-[#0b281f]/95 border border-emerald-500/50 backdrop-blur-md rounded-xl p-2.5 shadow-2xl flex items-center justify-between gap-2.5 text-xs text-emerald-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="font-semibold truncate">{appSheetToast}</span>
              </div>
              <button
                onClick={() => setAppSheetToast(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded text-[11px]"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
            <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">กำลังโหลดข้อมูลคลังยาง CRC ThaBo...</p>
          </div>
        ) : (
          <>
            {currentTab === 'audit' && (
              <QuickAuditTab
                tires={tires}
                activeSession={activeSession}
                onUpdateQty={handleUpdateQty}
                onOpenAddModal={() => {
                  setEditingTire(null);
                  setIsAddEditOpen(true);
                }}
                onOpenScanner={() => setIsScannerOpen(true)}
                onSaveAudit={() => setIsAuditConfirmOpen(true)}
                onEditTire={(tire) => {
                  setEditingTire(tire);
                  setIsAddEditOpen(true);
                }}
                onDeleteTire={handleDeleteTire}
              />
            )}

            {currentTab === 'inventory' && (
              <InventoryListTab
                tires={tires}
                onOpenAddModal={() => {
                  setEditingTire(null);
                  setIsAddEditOpen(true);
                }}
                onOpenScanner={() => setIsScannerOpen(true)}
                onEditTire={(tire) => {
                  setEditingTire(tire);
                  setIsAddEditOpen(true);
                }}
                onDeleteTire={handleDeleteTire}
                onJumpToAudit={handleJumpToAudit}
                onOpenPO={handleOpenSinglePO}
                onOpenBatchPO={handleOpenBatchPO}
                onOpenImageMatch={() => setIsImageMatchOpen(true)}
                onOpenTransferModal={handleOpenTransferModal}
                onOpenBatchTransfer={handleOpenBatchTransfer}
              />
            )}

            {currentTab === 'buysell' && (
              <BuySellTab
                tires={tires}
                transactions={transactions}
                onExecuteTransaction={handleExecuteTransaction}
                onOpenScanner={() => setIsScannerOpen(true)}
                onOpenStaffPos={() => setIsStaffPosMode(true)}
              />
            )}

            {currentTab === 'alerts' && (
              <SummaryAlertsTab
                tires={tires}
                onOpenPO={handleOpenSinglePO}
                onSyncAllSystemStock={() => setIsAuditConfirmOpen(true)}
                onJumpToAudit={handleJumpToAudit}
              />
            )}

            {currentTab === 'history' && (
              <AuditHistoryTab logs={logs} sessions={sessions} />
            )}
          </>
        )}
      </main>

      {/* Quick Scroll to Top Shortcut Button */}
      <ScrollToTopButton />

      {/* Fixed Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        discrepancyCount={discrepancyCount}
        lowStockCount={lowStockCount}
      />

      {/* Modals */}
      <AddEditProductModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingTire(null);
        }}
        onSave={handleSaveTire}
        onDelete={handleDeleteTire}
        initialProduct={editingTire}
      />

      <BarcodeScanModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        tires={tires}
        onSelectTire={(tire) => {
          if (currentTab !== 'buysell') {
            setCurrentTab('audit');
          }
        }}
        onBindBarcode={handleBindBarcode}
        onOpenAddModalWithBarcode={() => {
          setEditingTire(null);
          setIsAddEditOpen(true);
        }}
      />

      <PurchaseOrderModal
        isOpen={isPOOpen}
        onClose={() => setIsPOOpen(false)}
        items={poItems}
        onConfirmPO={(summary) => {
          console.log('PO Created:', summary);
        }}
      />

      <AuditSaveConfirmModal
        isOpen={isAuditConfirmOpen}
        onClose={() => setIsAuditConfirmOpen(false)}
        onConfirm={handleConfirmAuditSave}
        session={activeSession}
        totalTires={tires.length}
        checkedCount={checkedCount}
        matchedCount={matchedCount}
        discrepancyCount={discrepancyCount}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        isOnline={isOnline && !isQuotaExceeded}
        isQuotaMode={isQuotaExceeded}
        onRetryCloud={handleRetryCloud}
        onForceSyncCloud={handleForceSyncCloud}
        onOpenImageMatch={() => setIsImageMatchOpen(true)}
        totalProducts={tires.length}
      />

      <AppSheetSyncModal
        isOpen={isAppSheetOpen}
        onClose={() => setIsAppSheetOpen(false)}
        products={tires}
      />

      <DeleteConfirmModal
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDeleteProduct}
        product={productToDelete}
      />

      <ImageMatchBackupModal
        isOpen={isImageMatchOpen}
        onClose={() => setIsImageMatchOpen(false)}
        products={tires}
        onUpdateProducts={handleBatchUpdateProducts}
      />

      <StockTransferModal
        isOpen={isTransferOpen}
        onClose={() => {
          setIsTransferOpen(false);
          setTransferProduct(null);
        }}
        product={transferProduct}
        onConfirmTransfer={handleConfirmStockTransfer}
      />

      <BatchStockTransferModal
        isOpen={isBatchTransferOpen}
        onClose={() => {
          setIsBatchTransferOpen(false);
          setBatchTransferItems([]);
        }}
        items={batchTransferItems}
        onConfirmBatchTransfer={handleConfirmBatchStockTransfer}
      />
    </div>
  );
}
