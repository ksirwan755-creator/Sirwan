import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  addDoc,
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
  PaymentMethod,
  RecordCollection,
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

export async function createRecord(
  name: RecordCollection,
  input: WritableRecord,
): Promise<string> {
  assertOwner();
  const createdAt = new Date().toISOString();
  const data = {
    ...input,
    createdAt,
    updatedAt: createdAt,
  };
  validateRecord(name, data);
  const result = await addDoc(ownerCollection(name), data);
  return result.id;
}

export async function updateRecord(
  name: RecordCollection,
  id: string,
  changes: Record<string, unknown>,
): Promise<void> {
  assertOwner();
  if (!id.trim()) throw new Error('A record ID is required.');
  const data = { ...changes, updatedAt: new Date().toISOString() };
  validateRecord(name, data, true);
  await setDoc(doc(ownerCollection(name), id), data, { merge: true });
}

export async function deleteRecord(
  name: RecordCollection,
  id: string,
): Promise<void> {
  assertOwner();
  if (!id.trim()) throw new Error('A record ID is required.');
  await deleteDoc(doc(ownerCollection(name), id));
}

function validateRecord(
  name: RecordCollection,
  data: Record<string, unknown>,
  partial = false,
) {
  if (name === 'products' && (!partial || 'priceIqd' in data)) {
    assertWholeAmount(Number(data.priceIqd), 'Product price', true);
  }
  if (name === 'tables' && (!partial || 'seats' in data)) {
    assertWholeAmount(Number(data.seats), 'Table seats');
  }
  if (name === 'expenses' && (!partial || 'amountIqd' in data)) {
    assertWholeAmount(Number(data.amountIqd), 'Expense amount');
  }
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
  const totalIqd = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceIqd,
    0,
  );
  assertWholeAmount(totalIqd, 'Order total', true);

  const createdAt = new Date().toISOString();
  const result = await addDoc(ownerCollection('orders'), {
    tableId: input.tableId || null,
    customerId: input.customerId || null,
    items,
    notes: input.notes?.trim() ?? '',
    status: 'open',
    totalIqd,
    payments: [],
    createdAt,
    paidAt: null,
  });
  return result.id;
}

export async function addPayment(
  orderId: string,
  input: { amountIqd: number; method: PaymentMethod },
): Promise<void> {
  assertOwner();
  assertWholeAmount(input.amountIqd, 'Payment amount');
  if (!db) throw new Error('Firebase is not configured for this app.');
  const orderRef = doc(ownerCollection('orders'), orderId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = snapshot.data() as Omit<CafeOrder, 'id'>;
    if (order.status !== 'open') {
      throw new Error('Only open orders can receive payments.');
    }
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
    const isPaid =
      nextPayments.reduce((sum, payment) => sum + payment.amountIqd, 0) >=
      order.totalIqd;
    transaction.update(orderRef, {
      payments: nextPayments,
      status: isPaid ? 'paid' : 'open',
      paidAt: isPaid ? new Date().toISOString() : null,
    });
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
    if (order.status !== 'open') {
      throw new Error('Only open orders can be cancelled.');
    }
    if (order.payments?.length) {
      throw new Error('An order with payments cannot be cancelled.');
    }
    transaction.update(orderRef, { status: 'cancelled' });
  });
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
    let recordUnsubs: (() => void)[] = [];
    const stopRecords = () => {
      recordUnsubs.forEach((unsubscribe) => unsubscribe());
      recordUnsubs = [];
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
            const records = snapshot.docs.map((item) =>
              withId(item.id, item.data()),
            );
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
          next.settings = snapshot.exists()
            ? withId('current', snapshot.data())
            : null;
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
    addPayment,
    cancelOrder,
    saveSettings,
  };
}
