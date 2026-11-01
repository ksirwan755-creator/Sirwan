import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, ownerUid } from './firebase';
import type {
  CafeCategory,
  CafeCustomer,
  CafeDataSnapshot,
  CafeExpense,
  CafeOrder,
  CafeProduct,
  CafeSettings,
  CafeTable,
  CreateOrderInput,
  OrderStatus,
  PaymentMethod,
  RecordCollection,
  TableStatus,
} from './types';

const emptySnapshot: CafeDataSnapshot = {
  categories: [],
  products: [],
  tables: [],
  orders: [],
  expenses: [],
  customers: [],
  settings: null,
};

const collectionNames: RecordCollection[] = [
  'categories',
  'products',
  'tables',
  'orders',
  'expenses',
  'customers',
];

type WritableRecord =
  | Omit<CafeCategory, 'id'>
  | Omit<CafeProduct, 'id'>
  | Omit<CafeTable, 'id'>
  | Omit<CafeExpense, 'id'>
  | Omit<CafeCustomer, 'id'>;

function ownerCollection(name: string) {
  if (!db || !ownerUid) {
    throw new Error('Firebase is not configured for this app.');
  }
  return collection(db, 'owners', ownerUid, name);
}

function assertOwner() {
  if (!isFirebaseConfigured || !db || !ownerUid) {
    throw new Error('Firebase is not configured for this app.');
  }
  if (!auth?.currentUser || auth.currentUser.uid !== ownerUid) {
    throw new Error('Sign in with the cafe owner account to continue.');
  }
}

function assertWholeAmount(value: number, label: string, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be a whole IQD amount.`);
  }
}

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

function normalizeTableStatus(status?: TableStatus | null): TableStatus {
  return status === 'available' || status === 'occupied' || status === 'reserved' || status === 'closed'
    ? status
    : 'available';
}

function normalizeOrderStatus(status?: OrderStatus | null): OrderStatus {
  return status === 'new' || status === 'preparing' || status === 'ready' || status === 'delivered' || status === 'paid' || status === 'cancelled'
    ? status
    : 'new';
}

export async function createRecord(name: RecordCollection, input: WritableRecord): Promise<string> {
  assertOwner();
  const createdAt = new Date().toISOString();
  const payload = {
    ...input,
    createdAt,
    updatedAt: createdAt,
  } as Record<string, unknown>;
  validateRecord(name, payload);
  const result = await addDoc(ownerCollection(name), payload);
  return result.id;
}

export async function updateRecord(name: RecordCollection, id: string, changes: Record<string, unknown>): Promise<void> {
  assertOwner();
  if (!id.trim()) throw new Error('A record ID is required.');
  const payload = { ...changes, updatedAt: new Date().toISOString() } as Record<string, unknown>;
  validateRecord(name, payload, true);
  await setDoc(doc(ownerCollection(name), id), payload, { merge: true });
}

export async function deleteRecord(name: RecordCollection, id: string): Promise<void> {
  assertOwner();
  if (name === 'products' || name === 'customers' || name === 'orders') {
    throw new Error('This record type is protected and cannot be deleted from the app.');
  }
  if (!id.trim()) throw new Error('A record ID is required.');
  await deleteDoc(doc(ownerCollection(name), id));
}

function validateRecord(name: RecordCollection, data: Record<string, unknown>, partial = false) {
  if (name === 'products' && (!partial || 'priceIqd' in data)) {
    const value = Number(data.priceIqd ?? 0);
    assertWholeAmount(value, 'Product price', true);
  }
  if (name === 'tables' && (!partial || 'seats' in data)) {
    const value = Number(data.seats ?? 0);
    assertWholeAmount(value, 'Table seats');
  }
  if (name === 'expenses' && (!partial || 'amountIqd' in data)) {
    const value = Number(data.amountIqd ?? 0);
    assertWholeAmount(value, 'Expense amount');
  }
  if (name === 'tables' && 'status' in data) {
    const maybeStatus = String(data.status ?? 'available');
    const statuses = new Set(['available', 'occupied', 'reserved', 'closed']);
    if (!statuses.has(maybeStatus)) {
      throw new Error('Table status must be available, occupied, reserved, or closed.');
    }
  }
  if (name === 'orders' && 'status' in data) {
    const maybeStatus = String(data.status ?? 'new');
    const statuses = new Set(['new', 'preparing', 'ready', 'delivered', 'paid', 'cancelled']);
    if (!statuses.has(maybeStatus)) {
      throw new Error('Order status is invalid.');
    }
  }
}

export async function upsertCustomer(input: { name?: string; phone?: string; notes?: string }): Promise<string | null> {
  assertOwner();
  const name = input.name?.trim() ?? '';
  const phone = input.phone?.trim() ?? '';
  if (!name && !phone) return null;

  const customersRef = ownerCollection('customers');
  const queryRef = phone ? query(customersRef, where('phone', '==', phone)) : query(customersRef, where('name', '==', name));
  const found = await getDocs(queryRef);
  if (!found.empty) {
    const docId = found.docs[0].id;
    await updateDoc(doc(customersRef, docId), {
      name: name || found.docs[0].data().name,
      phone: phone || found.docs[0].data().phone,
      notes: input.notes ?? found.docs[0].data().notes ?? '',
      updatedAt: new Date().toISOString(),
    });
    return docId;
  }

  const created = await addDoc(customersRef, {
    name,
    phone,
    notes: input.notes ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return created.id;
}

export async function ensureDefaultTables(): Promise<void> {
  assertOwner();
  const snapshot = await getDocs(ownerCollection('tables'));
  const existingNumbers = new Set<number>();
  snapshot.docs.forEach((item) => {
    const label = String(item.data().label ?? '');
    const match = label.match(/\\d+/);
    if (match) {
      const number = Number(match[0]);
      if (number >= 1 && number <= 40) existingNumbers.add(number);
    }
  });
  const now = new Date().toISOString();
  for (let number = 1; number <= 40; number += 1) {
    if (existingNumbers.has(number)) continue;
    await addDoc(ownerCollection('tables'), {
      label: String(number),
      seats: 4,
      status: 'available',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function appendOrderItems(orderId: string, items: CreateOrderInput['items']): Promise<void> {
  assertOwner();
  if (!db) throw new Error('Firebase is not configured for this app.');
  if (!items.length) throw new Error('Add at least one item to the order.');
  items.forEach((item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Item quantity must be a positive whole number.');
    assertWholeAmount(item.unitPriceIqd, 'Item price', true);
  });
  const orderRef = doc(ownerCollection('orders'), orderId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = snapshot.data() as Omit<CafeOrder, 'id'>;
    if (order.status === 'paid' || order.status === 'cancelled') throw new Error('This table order is already closed.');
    const nextItems = [...(order.items ?? []), ...items];
    const nextTotal = nextItems.reduce((sum, item) => sum + item.quantity * item.unitPriceIqd, 0);
    assertWholeAmount(nextTotal, 'Order total', true);
    transaction.update(orderRef, {
      items: nextItems,
      totalIqd: nextTotal,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  assertOwner();
  if (input.items.length === 0) {
    throw new Error('Add at least one item to the order.');
  }

  const items = input.items.map((item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Item quantity must be a positive whole number.');
    }
    assertWholeAmount(item.unitPriceIqd, 'Item price', true);
    return { ...item };
  });
  const totalIqd = items.reduce((total, item) => total + item.quantity * item.unitPriceIqd, 0);
  assertWholeAmount(totalIqd, 'Order total', true);

  const createdAt = new Date().toISOString();
  const status = normalizeOrderStatus(input.status ?? 'new');
  const result = await addDoc(ownerCollection('orders'), {
    tableId: input.tableId || null,
    customerId: input.customerId || null,
    items,
    notes: input.notes?.trim() ?? '',
    status,
    totalIqd,
    payments: [],
    createdAt,
    paidAt: null,
    updatedAt: createdAt,
  });

  if (input.tableId) {
    const tableRef = doc(ownerCollection('tables'), input.tableId);
    const tableSnap = await getDocs(query(ownerCollection('tables'), where('__name__', '==', input.tableId)));
    if (!tableSnap.empty) {
      const tableData = tableSnap.docs[0].data() as Partial<CafeTable>;
      const nextStatus = status === 'paid' || status === 'cancelled' ? 'available' : 'occupied';
      await setDoc(tableRef, {
        status: normalizeTableStatus(nextStatus),
        active: true,
        updatedAt: createdAt,
      }, { merge: true });
    }
  }

  return result.id;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  assertOwner();
  if (!db) throw new Error('Firebase is not configured for this app.');
  const orderRef = doc(ownerCollection('orders'), orderId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = snapshot.data() as Omit<CafeOrder, 'id'>;
    const nextStatus = normalizeOrderStatus(status);

    transaction.update(orderRef, {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      paidAt: nextStatus === 'paid' ? new Date().toISOString() : order.paidAt ?? null,
    });

    if (order.tableId) {
      const tableRef = doc(ownerCollection('tables'), order.tableId);
      const tableSnap = await transaction.get(tableRef);
      if (tableSnap.exists()) {
        const nextTableStatus = nextStatus === 'paid' || nextStatus === 'cancelled' ? 'available' : 'occupied';
        transaction.update(tableRef, {
          status: normalizeTableStatus(nextTableStatus),
          active: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function addPayment(orderId: string, input: { amountIqd: number; method: PaymentMethod }): Promise<void> {
  assertOwner();
  assertWholeAmount(input.amountIqd, 'Payment amount');
  if (!db) throw new Error('Firebase is not configured for this app.');
  const orderRef = doc(ownerCollection('orders'), orderId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = snapshot.data() as Omit<CafeOrder, 'id'>;
    if (order.status === 'cancelled') throw new Error('Cancelled orders cannot receive payments.');

    const payments = order.payments ?? [];
    const paidIqd = payments.reduce((sum, payment) => sum + payment.amountIqd, 0);
    const dueIqd = order.totalIqd - paidIqd;
    if (input.amountIqd > dueIqd) {
      throw new Error('Payment cannot exceed the remaining order balance.');
    }

    const nextPayments = [
      ...payments,
      {
        amountIqd: input.amountIqd,
        method: input.method,
        createdAt: new Date().toISOString(),
      },
    ];
    const isPaid = nextPayments.reduce((sum, payment) => sum + payment.amountIqd, 0) >= order.totalIqd;

    transaction.update(orderRef, {
      payments: nextPayments,
      status: isPaid ? 'paid' : 'delivered',
      paidAt: isPaid ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });

    if (order.tableId) {
      const tableRef = doc(ownerCollection('tables'), order.tableId);
      const tableSnap = await transaction.get(tableRef);
      if (tableSnap.exists()) {
        const nextTableStatus = isPaid ? 'available' : 'occupied';
        transaction.update(tableRef, {
          status: normalizeTableStatus(nextTableStatus),
          active: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  assertOwner();
  if (!db) throw new Error('Firebase is not configured for this app.');
  const orderRef = doc(ownerCollection('orders'), orderId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = snapshot.data() as Omit<CafeOrder, 'id'>;
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new Error('This order cannot be cancelled.');
    }
    transaction.update(orderRef, { status: 'cancelled', updatedAt: new Date().toISOString() });

    if (order.tableId) {
      const tableRef = doc(ownerCollection('tables'), order.tableId);
      const tableSnap = await transaction.get(tableRef);
      if (tableSnap.exists()) {
        transaction.update(tableRef, {
          status: 'available',
          active: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function updateTableStatus(tableId: string, status: TableStatus): Promise<void> {
  assertOwner();
  const targetStatus = normalizeTableStatus(status);
  await setDoc(doc(ownerCollection('tables'), tableId), {
    status: targetStatus,
    active: targetStatus !== 'closed',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function saveSettings(settings: CafeSettings): Promise<void> {
  assertOwner();
  await setDoc(doc(ownerCollection('settings'), 'current'), {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

export function useCafeData() {
  const [data, setData] = useState<CafeDataSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !auth) {
      setData(emptySnapshot);
      setLoading(false);
      return;
    }

    let active = true;
    const recordUnsubs: (() => void)[] = [];
    const stopRecords = () => {
      recordUnsubs.forEach((unsubscribe) => unsubscribe());
    };

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopRecords();
      setData(emptySnapshot);
      setError(null);

      if (!user) {
        setLoading(false);
        return;
      }
      if (user.uid !== ownerUid) {
        setLoading(false);
        setError('This account is not authorized as the cafe owner.');
        return;
      }

      setLoading(true);
      const next: CafeDataSnapshot = { ...emptySnapshot };
      const loaded = new Set<string>();
      const markLoaded = (key: string) => {
        loaded.add(key);
        if (loaded.size === collectionNames.length + 1) {
          setLoading(false);
        }
      };

      for (const name of collectionNames) {
        const unsubscribe = onSnapshot(
          ownerCollection(name),
          (snapshot) => {
            const records = snapshot.docs.map((item) => withId(item.id, item.data()));
            Object.assign(next, { [name]: records });
            if (active) setData({ ...next });
            markLoaded(name);
          },
          (snapshotError) => {
            if (!active) return;
            setError(snapshotError.message);
            setLoading(false);
          },
        );
        recordUnsubs.push(unsubscribe);
      }

      const settingsUnsubscribe = onSnapshot(
        doc(ownerCollection('settings'), 'current'),
        (snapshot) => {
          next.settings = snapshot.exists() ? withId('current', snapshot.data()) : null;
          if (active) setData({ ...next });
          markLoaded('settings');
        },
        (snapshotError) => {
          if (!active) return;
          setError(snapshotError.message);
          setLoading(false);
        },
      );
      recordUnsubs.push(settingsUnsubscribe);
    });

    return () => {
      active = false;
      stopRecords();
      stopAuth();
    };
  }, []);

  return {
    data,
    loading,
    error,
    createRecord,
    updateRecord,
    deleteRecord,
    createOrder,
    updateOrderStatus,
    addPayment,
    cancelOrder,
    updateTableStatus,
    upsertCustomer,
    saveSettings,
  };
}
