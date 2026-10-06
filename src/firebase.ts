import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ProductItem, TireItem, AuditSession, AuditLog, StockStatus, Transaction } from './types';
import { INITIAL_TIRES } from './initialData';

const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
export const auth = getAuth(app);

// Authenticate anonymously so Firestore security context is always valid
signInAnonymously(auth).catch((err) => {
  console.warn('Anonymous auth note (app continues offline/local):', err);
});

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

// Test connection on boot per SKILL.md
export async function testConnection(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
    const testPromise = getDocFromServer(doc(db, 'test', 'connection'))
      .then(() => true)
      .catch(() => true);
    return await Promise.race([testPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Firebase test connection failed:', error);
    return false;
  }
}

// Seed initial products only if remote collection is empty
export async function seedTiresIfEmpty(customTires?: TireItem[]): Promise<void> {
  // Respect user instruction to start clean: only seed if customTires explicitly provided
  if (!customTires || customTires.length === 0) return;
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
    console.warn('Failed to seed products:', error);
  }
}

// Restore all initial products (clean reset - wipes catalog to 0 items)
export async function restoreAllInitialTires(): Promise<void> {
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
    console.error('Failed to clear products:', error);
  }
}

// Real-time Products / Inventory Listener
export function subscribeToTires(
  onData: (products: ProductItem[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'products';
  return onSnapshot(
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
      console.warn('subscribeToProducts error:', error);
      if (onError) onError(error);
    }
  );
}

// Alias for products listener
export const subscribeToProducts = subscribeToTires;

// Real-time Audit Sessions Listener
export function subscribeToAuditSessions(
  onData: (sessions: AuditSession[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'audit_sessions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sessions: AuditSession[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AuditSession, 'id'>),
      }));
      onData(sessions);
    },
    (error) => {
      console.warn('subscribeToAuditSessions error:', error);
      if (onError) onError(error);
    }
  );
}

// Real-time Audit Logs Listener
export function subscribeToAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'audit_logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLog[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AuditLog, 'id'>),
      }));
      onData(logs);
    },
    (error) => {
      console.warn('subscribeToAuditLogs error:', error);
      if (onError) onError(error);
    }
  );
}

// Update actual counted qty
export async function updateTireActualQty(
  tireId: string,
  newActualQty: number,
  systemQty: number,
  tireName: string,
  brand: string
): Promise<void> {
  const diff = newActualQty - systemQty;
  const status: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

  try {
    // Use setDoc with merge: true so it never throws NOT_FOUND
    await setDoc(
      doc(db, 'products', tireId),
      {
        actualQty: newActualQty,
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Write audit log
    await addDoc(collection(db, 'audit_logs'), {
      productId: tireId,
      productName: tireName,
      brand: brand || '',
      diff,
      previousQty: systemQty,
      newQty: newActualQty,
      action: diff === 0 ? 'ตรวจนับตรงระบบ' : `คลาดเคลื่อน (${diff > 0 ? '+' : ''}${diff})`,
      timestamp: new Date().toISOString(),
      note: diff === 0 ? 'ยอดตรวจตรงกับระบบ' : `ปรับค่ายอดนับจริงเป็น ${newActualQty}`,
    });
  } catch (error) {
    console.warn('updateTireActualQty offline/error:', error);
  }
}

// Add new product
export async function addNewTire(item: Omit<ProductItem, 'id'>): Promise<string> {
  const newDocRef = doc(collection(db, 'products'));
  const newId = newDocRef.id;
  try {
    await setDoc(newDocRef, {
      ...item,
      id: newId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('addNewProduct offline/error:', error);
  }
  return newId;
}

export const addNewProduct = addNewTire;

// Update product details
export async function updateTireItem(tireId: string, updates: Partial<ProductItem>): Promise<void> {
  try {
    await setDoc(
      doc(db, 'products', tireId),
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('updateProductItem offline/error:', error);
  }
}

export const updateProductItem = updateTireItem;

// Delete product
export async function deleteTireItem(tireId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', tireId));
  } catch (error) {
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
    console.warn('saveAuditSession offline/error:', error);
  }
}

// Real-time Transactions Listener
export function subscribeToTransactions(
  onData: (transactions: Transaction[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'transactions';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const txs: Transaction[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Transaction, 'id'>),
      }));
      onData(txs);
    },
    (error) => {
      console.warn('subscribeToTransactions error:', error);
      if (onError) onError(error);
    }
  );
}

// Execute Buy/Sell with Automatic Stock Cutting
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
  const pathTx = 'transactions';
  const pathProducts = 'products';
  const pathLogs = 'audit_logs';

  try {
    for (const item of items) {
      const delta = type === 'sale' ? -item.quantity : item.quantity;
      const nextSystemQty = Math.max(0, item.tire.systemQty + delta);
      const nextActualQty = Math.max(0, item.tire.actualQty + delta);
      const diff = nextActualQty - nextSystemQty;
      const nextStatus: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

      // 1. Update Product Stock in Firestore (setDoc with merge so it never throws NOT_FOUND)
      await setDoc(
        doc(db, pathProducts, item.tire.id),
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

      // 2. Save Transaction record
      const totalPrice = item.quantity * item.unitPrice;
      await addDoc(collection(db, pathTx), {
        type,
        tireId: item.tire.id,
        tireName: `${item.tire.brand} ${item.tire.size}`,
        brand: item.tire.brand,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        customerOrSupplier: customerOrSupplier.trim() || (type === 'sale' ? 'ลูกค้าทั่วไป' : 'ผู้แทนจำหน่าย'),
        note: note?.trim() || '',
        createdAt: new Date().toISOString(),
      });

      // 3. Save Log
      await addDoc(collection(db, pathLogs), {
        tireId: item.tire.id,
        tireName: `${item.tire.brand} ${item.tire.size}`,
        brand: item.tire.brand,
        diff: delta,
        previousQty: item.tire.actualQty,
        newQty: nextActualQty,
        action: type === 'sale' ? `ตัดสต็อกขายออก (-${item.quantity} เส้น)` : `รับเข้าคลัง (+${item.quantity} เส้น)`,
        timestamp: new Date().toISOString(),
        note: `${type === 'sale' ? 'ขายให้: ' : 'รับจาก: '}${customerOrSupplier.trim() || 'หน้าร้าน'} ${note ? `(${note})` : ''}`,
      });
    }
  } catch (error) {
    console.warn('executeTransaction Firestore sync error (handled safely):', error);
  }
}

