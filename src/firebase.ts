import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString, deleteObject } from 'firebase/storage';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ProductItem, TireItem, AuditSession, AuditLog, StockStatus, Transaction, StockTransfer } from './types';
import { INITIAL_TIRES } from './initialData';
import { cleanLocationName } from './utils/stockUtils';

const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with IndexedDB multi-tab persistent offline cache
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDbId
  );
} catch (e) {
  firestoreInstance = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Configure Storage client to avoid hanging in infinite retry loop on CORS/auth issues
try {
  (storage as any).maxUploadRetryTime = 2500;
  (storage as any).maxOperationRetryTime = 2500;
} catch {}

// Silence Firestore internal log messages to prevent console spam
try {
  setLogLevel('silent');
} catch {}

const STORAGE_CIRCUIT_KEY = 'crc_cloud_storage_blocked';
let isCloudStorageBlocked = false;
try {
  isCloudStorageBlocked = localStorage.getItem(STORAGE_CIRCUIT_KEY) === 'true';
} catch {}

/**
 * Uploads a product image directly to Firebase Cloud Storage (Media Storage)
 * and returns the permanent HTTPS Download URL.
 * Falls back safely and instantly to compressed data URL if Cloud Storage is unconfigured, blocked, or slow (>2.5s).
 */
export async function uploadProductImageToStorage(
  fileOrDataUrl: File | Blob | string,
  fileNameHint?: string,
  timeoutMs = 2500
): Promise<string> {
  // If already a remote web URL, return as-is
  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('http')) {
    return fileOrDataUrl;
  }

  // If Cloud Storage is already known to be blocked by CORS or unactivated, bypass network immediately
  if (isCloudStorageBlocked) {
    if (typeof fileOrDataUrl === 'string') return fileOrDataUrl;
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl as Blob);
    });
  }

  const timestamp = Date.now();
  const safeName = (fileNameHint || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
  const storagePath = `products/${timestamp}_${safeName}.jpg`;

  try {
    const uploadAction = async (): Promise<string> => {
      const storageRef = ref(storage, storagePath);

      if (typeof fileOrDataUrl === 'string') {
        if (fileOrDataUrl.startsWith('data:')) {
          const snapshot = await uploadString(storageRef, fileOrDataUrl, 'data_url', {
            contentType: 'image/jpeg',
          });
          const downloadUrl = await getDownloadURL(snapshot.ref);
          return downloadUrl;
        }
        return fileOrDataUrl;
      } else {
        const snapshot = await uploadBytes(storageRef, fileOrDataUrl, {
          contentType: fileOrDataUrl.type || 'image/jpeg',
        });
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      }
    };

    // Strict race timeout to guarantee the promise never hangs on CORS/SDK retry
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud Storage timeout')), timeoutMs);
    });

    const finalUrl = await Promise.race([uploadAction(), timeoutPromise]);
    return finalUrl;
  } catch (err) {
    console.warn('Cloud Storage upload note (using ultra-fast local fallback):', err);
    // Mark as blocked for this session so subsequent uploads don't wait at all
    isCloudStorageBlocked = true;
    try {
      localStorage.setItem(STORAGE_CIRCUIT_KEY, 'true');
    } catch {}

    if (typeof fileOrDataUrl === 'string') {
      return fileOrDataUrl;
    }
  }

  // Fallback for Blob/File to Data URL
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileOrDataUrl as Blob);
  });
}

/**
 * Optionally removes an image from Firebase Cloud Storage when product is deleted
 */
export async function deleteProductImageFromStorage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) return;
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Could not delete storage image file (non-critical):', err);
  }
}

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
    if (!saved || saved === 'false') return false;
    return saved === new Date().toDateString();
  } catch {
    return false;
  }
}

let quotaExhaustedMemory = isQuotaExhaustedToday();

// Only disable network if quota was genuinely exhausted today
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
            location: cleanLocationName(data.location || 'RACK A-01'),
            frontLocation: cleanLocationName(data.frontLocation),
            frontQty: typeof data.frontQty === 'number' ? data.frontQty : undefined,
            warehouseQty: typeof data.warehouseQty === 'number' ? data.warehouseQty : undefined,
            actualQty: typeof data.actualQty === 'number' ? data.actualQty : 0,
            systemQty: typeof data.systemQty === 'number' ? data.systemQty : 0,
            status: data.status || 'checked',
            minStock: typeof data.minStock === 'number' ? data.minStock : 2,
            minFrontStock: typeof data.minFrontStock === 'number' ? data.minFrontStock : 2,
            description: data.description || '',
            subUnit: data.subUnit || '',
            conversionRate: typeof data.conversionRate === 'number' ? data.conversionRate : undefined,
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

export async function fetchLiveTiresFromCloud(): Promise<ProductItem[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const list: ProductItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        ...(data as any),
        frontLocation: cleanLocationName(data.frontLocation),
        location: cleanLocationName(data.location || 'RACK A-01'),
      });
    });
    return list;
  } catch (err) {
    console.warn('fetchLiveTiresFromCloud error:', err);
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
  const diff = newActualQty - systemQty;
  const status: StockStatus = diff === 0 ? 'checked' : 'discrepancy';

  try {
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

// Sanitizes object for Firestore by removing any undefined values and cleaning location strings
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (key === 'frontLocation' && typeof val === 'string') {
        clean[key] = cleanLocationName(val);
      } else if (key === 'location' && typeof val === 'string') {
        clean[key] = cleanLocationName(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean;
}

// Add new product
export async function addNewTire(item: Omit<ProductItem, 'id'>, customId?: string): Promise<string> {
  const newDocRef = customId ? doc(db, 'products', customId) : doc(collection(db, 'products'));
  const newId = newDocRef.id;

  try {
    const payload = sanitizeForFirestore({
      ...item,
      id: newId,
      updatedAt: item.updatedAt || new Date().toISOString(),
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
  try {
    const payload = sanitizeForFirestore({
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    });
    await setDoc(doc(db, 'products', tireId), payload, { merge: true });
    console.log('Successfully updated product in Firestore:', tireId);
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
  try {
    await deleteDoc(doc(db, 'products', tireId));
    console.log('Successfully deleted product from Firestore:', tireId);
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

// Execute Buy/Sell with Automatic Stock Cutting (supports front/warehouse allocation)
export async function executeTransaction(
  type: 'sale' | 'purchase',
  items: {
    tire: TireItem;
    quantity: number;
    unitPrice: number;
    isSubUnit?: boolean;
  }[],
  customerOrSupplier: string,
  note?: string,
  locationTarget: 'front' | 'warehouse' = 'front'
): Promise<void> {
  const pathTx = 'transactions';
  const pathProducts = 'products';

  try {
    const batch = writeBatch(db);

    for (const item of items) {
      const rate = item.tire.conversionRate && item.tire.conversionRate > 1 ? item.tire.conversionRate : 1;
      const effectiveQty = (type === 'sale' && item.isSubUnit && rate > 1)
        ? item.quantity / rate
        : item.quantity;
      const delta = type === 'sale' ? -effectiveQty : effectiveQty;

      const nextSystemQty = Math.max(0, Math.round((item.tire.systemQty + delta) * 10000) / 10000);
      const nextActualQty = Math.max(0, Math.round((item.tire.actualQty + delta) * 10000) / 10000);
      const diff = Math.round((nextActualQty - nextSystemQty) * 10000) / 10000;
      const nextStatus: StockStatus = Math.abs(diff) < 0.0001 ? 'checked' : 'discrepancy';

      // Distribute to frontQty vs warehouseQty
      let currFront = item.tire.frontQty ?? Math.min(item.tire.actualQty, 2);
      let currWarehouse = item.tire.warehouseQty ?? Math.max(0, item.tire.actualQty - currFront);

      let nextFront = currFront;
      let nextWarehouse = currWarehouse;

      if (type === 'sale') {
        if (locationTarget === 'front') {
          if (nextFront >= effectiveQty) {
            nextFront = Math.round((nextFront - effectiveQty) * 10000) / 10000;
          } else {
            const remainder = effectiveQty - nextFront;
            nextFront = 0;
            nextWarehouse = Math.max(0, Math.round((nextWarehouse - remainder) * 10000) / 10000);
          }
        } else {
          if (nextWarehouse >= effectiveQty) {
            nextWarehouse = Math.round((nextWarehouse - effectiveQty) * 10000) / 10000;
          } else {
            const remainder = effectiveQty - nextWarehouse;
            nextWarehouse = 0;
            nextFront = Math.max(0, Math.round((nextFront - remainder) * 10000) / 10000);
          }
        }
      } else {
        // Purchase (Restock)
        if (locationTarget === 'front') {
          nextFront = Math.round((nextFront + effectiveQty) * 10000) / 10000;
        } else {
          nextWarehouse = Math.round((nextWarehouse + effectiveQty) * 10000) / 10000;
        }
      }

      // 1. Update Product Stock in Batch
      const prodRef = doc(db, pathProducts, item.tire.id);
      batch.set(
        prodRef,
        {
          ...item.tire,
          id: item.tire.id,
          frontQty: nextFront,
          warehouseQty: nextWarehouse,
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
        unit: (item.isSubUnit && item.tire.subUnit) ? item.tire.subUnit : (item.tire.unit || 'ชิ้น'),
        unitPrice: item.unitPrice,
        totalPrice,
        locationTarget,
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

// Execute stock transfer between warehouse and storefront
export async function executeStockTransfer(
  transfer: StockTransfer,
  updatedProduct: ProductItem
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // 1. Update product with new frontQty and warehouseQty
    const prodRef = doc(db, 'products', updatedProduct.id);
    batch.set(prodRef, sanitizeForFirestore(updatedProduct), { merge: true });

    // 2. Log transfer record into audit_logs
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, {
      id: logRef.id,
      productId: updatedProduct.id,
      productName: updatedProduct.name || updatedProduct.size || 'สินค้า',
      brand: updatedProduct.brand || '',
      diff: transfer.quantity,
      previousQty: updatedProduct.actualQty,
      newQty: updatedProduct.actualQty,
      action:
        transfer.fromLocation === 'warehouse'
          ? 'โอนย้าย: คลัง ➡️ หน้าร้าน'
          : 'โอนย้าย: หน้าร้าน ➡️ คลัง',
      timestamp: transfer.timestamp,
      note: transfer.note || `โอนย้ายจำนวน ${transfer.quantity} ${updatedProduct.unit || 'ชิ้น'}`,
    });

    await batch.commit();
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('executeStockTransfer error:', error);
  }
}

// Execute batch stock transfers between warehouse and storefront
export async function executeBatchStockTransfer(
  transfers: { transfer: StockTransfer; updatedProduct: ProductItem }[]
): Promise<void> {
  if (transfers.length === 0) return;
  try {
    const batch = writeBatch(db);

    for (const item of transfers) {
      const prodRef = doc(db, 'products', item.updatedProduct.id);
      batch.set(prodRef, sanitizeForFirestore(item.updatedProduct), { merge: true });

      const logRef = doc(collection(db, 'audit_logs'));
      batch.set(logRef, {
        id: logRef.id,
        productId: item.updatedProduct.id,
        productName: item.updatedProduct.name || item.updatedProduct.size || 'สินค้า',
        brand: item.updatedProduct.brand || '',
        diff: item.transfer.quantity,
        previousQty: item.updatedProduct.actualQty,
        newQty: item.updatedProduct.actualQty,
        action:
          item.transfer.fromLocation === 'warehouse'
            ? 'โอนย้าย: คลัง ➡️ หน้าร้าน'
            : 'โอนย้าย: หน้าร้าน ➡️ คลัง',
        timestamp: item.transfer.timestamp,
        note: item.transfer.note || `โอนย้ายจำนวน ${item.transfer.quantity} ${item.updatedProduct.unit || 'ชิ้น'}`,
      });
    }

    await batch.commit();
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExhausted();
    }
    console.warn('executeBatchStockTransfer error:', error);
  }
}


