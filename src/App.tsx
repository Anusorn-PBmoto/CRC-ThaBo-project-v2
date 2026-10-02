import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  testConnection,
  seedTiresIfEmpty,
  subscribeToTires,
  subscribeToAuditSessions,
  subscribeToAuditLogs,
  subscribeToTransactions,
  executeTransaction,
  updateTireActualQty,
  addNewTire,
  updateTireItem,
  deleteTireItem,
  saveAuditSession,
  restoreAllInitialTires,
  db,
} from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { TireItem, AuditSession, AuditLog, Transaction } from './types';
import { INITIAL_TIRES } from './initialData';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { QuickAuditTab } from './components/QuickAuditTab';
import { InventoryListTab } from './components/InventoryListTab';
import { BuySellTab } from './components/BuySellTab';
import { SummaryAlertsTab } from './components/SummaryAlertsTab';
import { AuditHistoryTab } from './components/AuditHistoryTab';
import { AddEditTireModal } from './components/AddEditTireModal';
import { BarcodeScanModal } from './components/BarcodeScanModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { AuditSaveConfirmModal } from './components/AuditSaveConfirmModal';
import { ProfileModal } from './components/ProfileModal';

export default function App() {
  const [tires, setTires] = useState<TireItem[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('audit');
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingTire, setEditingTire] = useState<TireItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPOOpen, setIsPOOpen] = useState(false);
  const [poItems, setPoItems] = useState<TireItem[]>([]);
  const [isAuditConfirmOpen, setIsAuditConfirmOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Initialize and subscribe
  useEffect(() => {
    let unsubscribeTires: (() => void) | undefined;
    let unsubscribeSessions: (() => void) | undefined;
    let unsubscribeLogs: (() => void) | undefined;
    let unsubscribeTransactions: (() => void) | undefined;

    const initFirebase = async () => {
      const fallbackList: TireItem[] = INITIAL_TIRES.map((t, idx) => ({
        ...t,
        id: `local-tire-${idx + 1}`,
      }));

      // Fallback timer so UI NEVER hangs if network is delayed
      const safetyTimer = setTimeout(() => {
        setIsLoading((loading) => {
          if (loading) {
            console.warn('Initial connection taking time, rendering local tire catalog');
            setTires((prev) => (prev.length > 0 ? prev : fallbackList));
            return false;
          }
          return false;
        });
      }, 900);

      try {
        // Attach real-time listeners immediately
        unsubscribeTires = subscribeToTires(
          (data) => {
            clearTimeout(safetyTimer);
            if (data && data.length > 0) {
              setTires(data);
              setIsLoading(false);
              setIsOnline(true);

              // Auto-sync 80 CSV items if Firestore had previous count (e.g. 74) or unsynced
              if (data.length !== INITIAL_TIRES.length && !localStorage.getItem('crc_csv_v3_synced')) {
                localStorage.setItem('crc_csv_v3_synced', 'true');
                restoreAllInitialTires().catch(console.warn);
              }
            } else {
              // Remote collection empty, display fallback right away and seed in background
              setTires(fallbackList);
              setIsLoading(false);
              setIsOnline(true);
              seedTiresIfEmpty(true).catch(console.warn);
            }
          },
          (err) => {
            console.warn('Tires listener error:', err);
            clearTimeout(safetyTimer);
            setTires((prev) => (prev.length > 0 ? prev : fallbackList));
            setIsLoading(false);
            setIsOnline(false);
          }
        );

        unsubscribeSessions = subscribeToAuditSessions(
          (data) => setSessions(data),
          (err) => console.warn('Sessions listener error:', err)
        );

        unsubscribeLogs = subscribeToAuditLogs(
          (data) => setLogs(data),
          (err) => console.warn('Logs listener error:', err)
        );

        unsubscribeTransactions = subscribeToTransactions(
          (data) => setTransactions(data),
          (err) => console.warn('Transactions listener error:', err)
        );

        // Test server connection asynchronously
        testConnection().then((connected) => {
          setIsOnline(connected);
        });
      } catch (error) {
        console.error('Firebase initialization error:', error);
        clearTimeout(safetyTimer);
        setTires((prev) => (prev.length > 0 ? prev : fallbackList));
        setIsLoading(false);
        setIsOnline(false);
      }
    };

    initFirebase();

    return () => {
      if (unsubscribeTires) unsubscribeTires();
      if (unsubscribeSessions) unsubscribeSessions();
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, []);

  const activeSession = sessions[0] || null;

  // Stepper quantity update
  const handleUpdateQty = async (tire: TireItem, newQty: number) => {
    try {
      await updateTireActualQty(
        tire.id,
        newQty,
        tire.systemQty,
        `${tire.brand} ${tire.size}`,
        tire.brand
      );
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  // Add / Edit Tire
  const handleSaveTire = async (tireData: Omit<TireItem, 'id'>, id?: string) => {
    try {
      if (id) {
        await updateTireItem(id, tireData);
      } else {
        await addNewTire(tireData);
      }
      setIsAddEditOpen(false);
      setEditingTire(null);
    } catch (error) {
      console.error('Failed to save tire:', error);
    }
  };

  // Delete Tire
  const handleDeleteTire = async (tire: TireItem) => {
    if (window.confirm(`ยืนยันการลบ ${tire.brand} ${tire.size} ออกจากระบบ?`)) {
      try {
        await deleteTireItem(tire.id);
      } catch (error) {
        console.error('Failed to delete tire:', error);
      }
    }
  };

  // Save Audit Session
  const handleConfirmAuditSave = async (syncToSystem: boolean) => {
    try {
      const checkedCount = tires.filter((t) => t.status === 'checked').length;
      const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;

      if (activeSession) {
        await saveAuditSession(activeSession.id, {
          totalItems: tires.length,
          checkedItems: checkedCount,
          discrepancyCount,
          status: 'completed',
        });
      }

      // If user chose to sync system stock to actual counts
      if (syncToSystem) {
        for (const tire of tires) {
          if (tire.actualQty !== tire.systemQty) {
            await updateTireItem(tire.id, {
              systemQty: tire.actualQty,
              status: 'checked',
            });
          }
        }
      }

      setIsAuditConfirmOpen(false);

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#10b981', '#38bdf8', '#fbbf24'],
      });
    } catch (error) {
      console.error('Failed to save audit session:', error);
    }
  };

  // Reset sample data
  const handleResetSampleData = async () => {
    try {
      await restoreAllInitialTires();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (error) {
      console.error('Failed to reset sample data:', error);
    }
  };

  // Restore all 74 tires
  const handleRestoreAllData = async () => {
    try {
      await restoreAllInitialTires();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#38bdf8'],
      });
    } catch (error) {
      console.error('Failed to restore initial tires:', error);
    }
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
    items: { tire: TireItem; quantity: number; unitPrice: number }[],
    customerOrSupplier: string,
    note?: string
  ) => {
    await executeTransaction(type, items, customerOrSupplier, note);
  };

  // Counts for Badges
  const discrepancyCount = tires.filter((t) => t.actualQty !== t.systemQty).length;
  const lowStockCount = tires.filter((t) => t.actualQty <= (t.minStock || 2)).length;
  const checkedCount = tires.filter((t) => t.status === 'checked').length;
  const matchedCount = tires.filter((t) => t.actualQty === t.systemQty && t.status === 'checked').length;

  return (
    <div className="min-h-screen bg-[#090e18] text-slate-100 flex flex-col font-['Prompt',sans-serif]">
      {/* Top Header */}
      <Header
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        isOnline={isOnline}
        activeZone="ห้องยางชั้น 2"
        subtitle={
          currentTab === 'audit'
            ? 'นับสต็อกด่วน • คลังยางเรเดียล Tubeless'
            : currentTab === 'buysell'
            ? 'ซื้อขายอย่างง่าย • ตัดสต็อกอัตโนมัติ'
            : currentTab === 'alerts'
            ? 'สรุปยอดความคลาดเคลื่อน & แจ้งเตือน'
            : currentTab === 'history'
            ? 'ประวัติการตัดสต็อก & บันทึกเรียลไทม์'
            : 'ยางนอก Tubeless • ชั้น 2 - ห้องยาง'
        }
      />

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
                onRestoreInitialData={handleRestoreAllData}
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
                onRestoreInitialData={handleRestoreAllData}
              />
            )}

            {currentTab === 'buysell' && (
              <BuySellTab
                tires={tires}
                transactions={transactions}
                onExecuteTransaction={handleExecuteTransaction}
                onOpenScanner={() => setIsScannerOpen(true)}
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

      {/* Fixed Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        discrepancyCount={discrepancyCount}
        lowStockCount={lowStockCount}
      />

      {/* Modals */}
      <AddEditTireModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingTire(null);
        }}
        onSave={handleSaveTire}
        initialTire={editingTire}
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
        isOnline={isOnline}
        onResetSampleData={handleResetSampleData}
        totalTires={tires.length}
      />
    </div>
  );
}
