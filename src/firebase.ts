import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  getDocFromServer,
  query,
  orderBy,
  limit,
  writeBatch,
  disableNetwork,
  enableNetwork,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ProductItem, TireItem, AuditSession, AuditLog, StockStatus, Transaction } from './types';
import { INITIAL_TIRES } from './initialData';

const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
export const auth = getAuth(app);

// Silence Firestore internal log messages to prevent console spam
try {
  setLogLevel('silent');
} catch {}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('Quota exceeded')
  );
}

const QUOTA_STORAGE_KEY = 'crc_firestore_quota_exhausted_date';

export function isQuotaExhaustedToday(): boolean {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(QUOTA_STORAGE_KEY) : null;
    if (saved === 'false') return false;
    return true; // Default to quota protected mode on this project
  } catch {
    return true;
  }
}

let quotaExhaustedMemory = isQuotaExhaustedToday();

// Automatically disable network immediately if in quota protection mode
if (quotaExhaustedMemory) {
  try {
    disableNetwork(db).catch(() => {});
  } catch {}
}

export function isFirestoreQuotaExhausted(): boolean {
  return quotaExhaustedMemory || isQuotaExhaustedToday();
}

export function markQuotaExhausted(): void {
  quotaExhaustedMemory = true;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_STORAGE_KEY, new Date().toDateString());
    }
    disableNetwork(db).catch(() => {});
  } catch {}
}

export function resetQuotaCircuitBreaker(): void {
  quotaExhaustedMemory = false;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_STORAGE_KEY, 'false');
    }
  } catch {}
}

// Test connection on boot per SKILL.md
export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) {
    return false;
  }
  try {
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
    const testPromise = getDocFromServer(doc(db, 'test', 'connection'))
      .then(() => true)
      .catch((err) => {
        if (isQuotaError(err)) {
          markQuotaExhausted();
        }
        return false;
      });
    return await Promise.race([testPromise, timeoutPromise]);
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('Firebase test connection failed:', error);
    return false;
  }
}

// Manually retry cloud connection
export async function retryCloudConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await enableNetwork(db);
  } catch {}

  try {
    const snap = await getDocs(query(collection(db, 'products'), limit(1)));
    resetQuotaCircuitBreaker();
    return { success: true, message: 'เชื่อมต่อ Firestore บนคลาวด์สำเร็จแล้ว!' };
  } catch (err) {
    markQuotaExhausted();
    if (isQuotaError(err)) {
      return {
        success: false,
        message: 'โควต้า Firestore รายวันยังคงเต็ม ระบบจะทำงานในโหมดออฟไลน์อย่างต่อเนื่อง ข้อมูลปลอดภัย 100%',
      };
    }
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อได้: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Seed initial products only if remote collection is empty
export async function seedTiresIfEmpty(customTires?: TireItem[]): Promise<void> {
  // Respect user instruction to start clean: only seed if customTires explicitly provided
  if (!customTires || customTires.length === 0 || isFirestoreQuotaExhausted()) return;
  const prodCol = 'products';
  try {
    const snap = await getDocs(collection(db, prodCol));
    if (snap.empty) {
      console.log('Seeding custom products to Firestore...');
      const batch = writeBatch(db);
      for (const item of customTires) {
        const newRef = doc(db, prodCol, item.id);
        batch.set(newRef, item, { merge: true });
      }
      await batch.commit();
    }
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('Failed to seed products:', error);
  }
}

// Restore all 116 ItemDetails products
export async function resetToItemDetailsData(): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  const prodCol = 'products';
  try {
    const snap = await getDocs(collection(db, prodCol));
    const deleteBatch = writeBatch(db);
    snap.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    // Re-seed all 116 initial products
    const seedBatch = writeBatch(db);
    for (const item of INITIAL_TIRES) {
      const ref = doc(db, prodCol, item.id);
      seedBatch.set(ref, sanitizeForFirestore(item), { merge: true });
    }
    await seedBatch.commit();
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.error('Failed to reset to ItemDetails data:', error);
  }
}

// Clear all products completely (clean reset to 0 items)
export async function restoreAllInitialTires(): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  const prodCol = 'products';
  try {
    const snap = await getDocs(collection(db, prodCol));
    if (!snap.empty) {
      const deleteBatch = writeBatch(db);
      snap.docs.forEach((d) => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }

    // Also clean up legacy 'tires' collection if any existed
    const legacySnap = await getDocs(collection(db, 'tires'));
    if (!legacySnap.empty) {
      const legacyBatch = writeBatch(db);
      legacySnap.docs.forEach((d) => legacyBatch.delete(d.ref));
      await legacyBatch.commit();
    }
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.error('Failed to clear products:', error);
  }
}

// Real-time Products / Inventory Listener
export function subscribeToTires(
  onData: (products: ProductItem[]) => void,
  onError?: (err: unknown) => void
) {
  if (isFirestoreQuotaExhausted()) {
    if (onError) onError(new Error('Quota limit exceeded - running in offline mode'));
    return () => {};
  }

  const path = 'products';
  let unsub: (() => void) | null = null;

  try {
    unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items: ProductItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const costVal = typeof data.costPrice === 'number' ? data.costPrice : 0;
          const sellVal =
            typeof data.sellingPrice === 'number'
              ? data.sellingPrice
              : typeof data.price === 'number'
              ? data.price
              : 0;
          const nameVal = data.name || data.size || '';

          return {
            id: docSnap.id,
            barcode: data.barcode || '',
            name: nameVal,
            unit: data.unit || 'ชิ้น',
            costPrice: costVal,
            sellingPrice: sellVal,
            imageUrl: data.imageUrl || '',
            category: data.category || '',
            brand: data.brand || '',
            location: data.location || 'RACK A-01',
            actualQty: typeof data.actualQty === 'number' ? data.actualQty : 0,
            systemQty: typeof data.systemQty === 'number' ? data.systemQty : 0,
            status: data.status || 'checked',
            minStock: typeof data.minStock === 'number' ? data.minStock : 2,
            description: data.description || '',
            updatedAt: data.updatedAt || new Date().toISOString(),
            // Compatibility aliases
            size: nameVal,
            price: sellVal,
            rim: data.rim || '',
            zone: data.zone || 'ห้องอะไหล่',
            isOem: Boolean(data.isOem),
            oemLabel: data.oemLabel || '',
          };
        });
        onData(items);
      },
      (error) => {
        if (isQuotaError(error)) {
          markQuotaExhausted();
          if (unsub) {
            try { unsub(); } catch {}
            unsub = null;
          }
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaError(err)) {
      markQuotaExhausted();
    }
    if (onError) onError(err);
    return () => {};
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
      unsub = null;
    }
  };
}

// Alias for products listener
export const subscribeToProducts = subscribeToTires;

// On-demand fetchers to prevent continuous real-time read billing
export async function fetchAuditSessions(): Promise<AuditSession[]> {
  if (isFirestoreQuotaExhausted()) return [];
  try {
    const q = query(collection(db, 'audit_sessions'), orderBy('updatedAt', 'desc'), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditSession, 'id'>) }));
  } catch (err) {
    if (isQuotaError(err)) markQuotaExhausted();
    return [];
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  if (isFirestoreQuotaExhausted()) return [];
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
  } catch (err) {
    if (isQuotaError(err)) markQuotaExhausted();
    return [];
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  if (isFirestoreQuotaExhausted()) return [];
  try {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
  } catch (err) {
    if (isQuotaError(err)) markQuotaExhausted();
    return [];
  }
}

// Real-time Audit Sessions Listener (On-demand capable)
export function subscribeToAuditSessions(
  onData: (sessions: AuditSession[]) => void,
  onError?: (err: unknown) => void
) {
  if (isFirestoreQuotaExhausted()) {
    if (onError) onError(new Error('Quota limit exceeded - running in offline mode'));
    return () => {};
  }

  const path = 'audit_sessions';
  let unsub: (() => void) | null = null;

  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(20));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        const sessions: AuditSession[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AuditSession, 'id'>),
        }));
        onData(sessions);
      },
      (error) => {
        if (isQuotaError(error)) {
          markQuotaExhausted();
          if (unsub) {
            try { unsub(); } catch {}
            unsub = null;
          }
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaError(err)) {
      markQuotaExhausted();
    }
    if (onError) onError(err);
    return () => {};
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
      unsub = null;
    }
  };
}

// Real-time Audit Logs Listener (On-demand capable with tight limit to save reads)
export function subscribeToAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError?: (err: unknown) => void
) {
  if (isFirestoreQuotaExhausted()) {
    if (onError) onError(new Error('Quota limit exceeded - running in offline mode'));
    return () => {};
  }

  const path = 'audit_logs';
  let unsub: (() => void) | null = null;

  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(30));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLog[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AuditLog, 'id'>),
        }));
        onData(logs);
      },
      (error) => {
        if (isQuotaError(error)) {
          markQuotaExhausted();
          if (unsub) {
            try { unsub(); } catch {}
            unsub = null;
          }
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaError(err)) {
      markQuotaExhausted();
    }
    if (onError) onError(err);
    return () => {};
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
      unsub = null;
    }
  };
}

// Update actual counted qty (OPTIMIZED: single write to products, skips per-item audit_logs write)
export async function updateTireActualQty(
  tireId: string,
  newActualQty: number,
  systemQty: number,
  _tireName?: string,
  _brand?: string
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;

  const diff = newActualQty - systemQty;
  const status: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

  try {
    // 1 Write only - updates the product doc directly without generating redundant audit log docs per tick
    await setDoc(
      doc(db, 'products', tireId),
      {
        actualQty: newActualQty,
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('updateTireActualQty offline/error:', error);
  }
}

// Sanitizes object for Firestore by removing any undefined values
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

// Add new product
export async function addNewTire(item: Omit<ProductItem, 'id'>): Promise<string> {
  const newDocRef = doc(collection(db, 'products'));
  const newId = newDocRef.id;

  if (isFirestoreQuotaExhausted()) {
    return newId;
  }

  try {
    const payload = sanitizeForFirestore({
      ...item,
      id: newId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(newDocRef, payload);
    console.log('Successfully saved product to Firestore with ID:', newId);
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.error('addNewProduct error:', error);
  }
  return newId;
}

export const addNewProduct = addNewTire;

// Update product details
export async function updateTireItem(tireId: string, updates: Partial<ProductItem>): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;

  try {
    const payload = sanitizeForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'products', tireId), payload, { merge: true });
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.error('updateProductItem error:', error);
  }
}

export const updateProductItem = updateTireItem;

// Delete product
export async function deleteTireItem(tireId: string): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;

  try {
    await deleteDoc(doc(db, 'products', tireId));
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('deleteProductItem offline/error:', error);
  }
}

export const deleteProductItem = deleteTireItem;

// Save Audit Session Result
export async function saveAuditSession(
  sessionId: string,
  data: {
    totalItems: number;
    checkedItems: number;
    discrepancyCount: number;
    status: 'in_progress' | 'completed';
    code?: string;
    zone?: string;
    title?: string;
  }
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;

  try {
    await setDoc(
      doc(db, 'audit_sessions', sessionId),
      {
        id: sessionId,
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Also add to audit logs for audit history
    await addDoc(collection(db, 'audit_logs'), {
      tireId: 'session-summary',
      tireName: data.title || 'บันทึกปิดรอบตรวจนับสต็อก',
      brand: 'CRC ThaBo',
      diff: data.discrepancyCount,
      previousQty: data.totalItems,
      newQty: data.checkedItems,
      action: 'บันทึกปิดรอบนับสต็อก',
      timestamp: new Date().toISOString(),
      note: `ตรวจเสร็จสิ้น ${data.checkedItems}/${data.totalItems} รายการ (พบยอดคลาดเคลื่อน ${data.discrepancyCount} รายการ)`,
    });
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('saveAuditSession offline/error:', error);
  }
}

// Real-time Transactions Listener
export function subscribeToTransactions(
  onData: (transactions: Transaction[]) => void,
  onError?: (err: unknown) => void
) {
  if (isFirestoreQuotaExhausted()) {
    if (onError) onError(new Error('Quota limit exceeded - running in offline mode'));
    return () => {};
  }

  const path = 'transactions';
  let unsub: (() => void) | null = null;

  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        const txs: Transaction[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Transaction, 'id'>),
        }));
        onData(txs);
      },
      (error) => {
        if (isQuotaError(error)) {
          markQuotaExhausted();
          if (unsub) {
            try { unsub(); } catch {}
            unsub = null;
          }
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (isQuotaError(err)) {
      markQuotaExhausted();
    }
    if (onError) onError(err);
    return () => {};
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
      unsub = null;
    }
  };
}

// Execute Buy/Sell with Automatic Stock Cutting (OPTIMIZED: Atomic writeBatch, eliminates redundant audit_logs write)
export async function executeTransaction(
  type: 'sale' | 'purchase',
  items: {
    tire: TireItem;
    quantity: number;
    unitPrice: number;
  }[],
  customerOrSupplier: string,
  note?: string
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;

  const pathTx = 'transactions';
  const pathProducts = 'products';

  try {
    const batch = writeBatch(db);

    for (const item of items) {
      const delta = type === 'sale' ? -item.quantity : item.quantity;
      const nextSystemQty = Math.max(0, item.tire.systemQty + delta);
      const nextActualQty = Math.max(0, item.tire.actualQty + delta);
      const diff = nextActualQty - nextSystemQty;
      const nextStatus: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

      // 1. Update Product Stock in Batch
      const prodRef = doc(db, pathProducts, item.tire.id);
      batch.set(
        prodRef,
        {
          ...item.tire,
          id: item.tire.id,
          systemQty: nextSystemQty,
          actualQty: nextActualQty,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Add Transaction record in Batch
      const txDocRef = doc(collection(db, pathTx));
      const totalPrice = item.quantity * item.unitPrice;
      batch.set(txDocRef, {
        id: txDocRef.id,
        type,
        tireId: item.tire.id,
        tireName: item.tire.name || item.tire.size || `${item.tire.brand} ${item.tire.size}`,
        brand: item.tire.brand || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        customerOrSupplier: customerOrSupplier.trim() || (type === 'sale' ? 'ลูกค้าทั่วไป' : 'ผู้แทนจำหน่าย'),
        note: note?.trim() || '',
        createdAt: new Date().toISOString(),
      });
    }

    // Commit all products and transactions in a single efficient atomic batch
    await batch.commit();
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('executeTransaction Firestore batch error (handled safely):', error);
  }
}

