import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const ownerUid = import.meta.env.VITE_CAFE_OWNER_UID?.trim() ?? '';

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId && ownerUid,
);

const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(config)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

export async function signInOwner(email: string, password: string): Promise<User> {
  if (!auth || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured for this app.');
  }

  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (result.user.uid !== ownerUid) {
    await signOut(auth);
    throw new Error('This account is not authorized as the cafe owner.');
  }

  return result.user;
}

export async function signOutOwner(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

function employeeLoginEmail(phone: string): string {
  const digits = phone.replace(/\\D/g, '');
  return `employee-${digits}@qubacafe.app`;
}

export async function signInEmployee(phone: string, password: string): Promise<User> {
  if (!auth || !isFirebaseConfigured) throw new Error('Firebase is not configured.');
  const normalized = phone.trim();
  if (!/^\\+[1-9]\\d{7,14}$/.test(normalized)) throw new Error('Enter the phone number in international format, for example +9647XXXXXXXXX.');
  const result = await signInWithEmailAndPassword(auth, employeeLoginEmail(normalized), password);
  return result.user;
}

export async function createEmployeeAuthAccount(phone: string, password: string): Promise<string> {
  if (!app || !isFirebaseConfigured) throw new Error('Firebase is not configured.');
  if (password.length < 6) throw new Error('Employee password must be at least 6 characters.');
  const secondaryName = 'quba-employee-provisioning';
  const secondaryApp = getApps().find((item) => item.name === secondaryName) ?? initializeApp(config, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: User | null = null;
  try {
    const result = await createUserWithEmailAndPassword(secondaryAuth, employeeLoginEmail(phone), password);
    createdUser = result.user;
    return result.user.uid;
  } catch (error) {
    throw error;
  } finally {
    if (createdUser) await deleteUser(createdUser).catch(() => undefined);
    await signOut(secondaryAuth).catch(() => undefined);
  }
}

export async function createEmployeeProfileRecords(input: {
  uid: string;
  phoneE164: string;
  name: string;
  assignedTableIds: string[];
  assignedTables: { id: string; label: string }[];
}): Promise<void> {
  if (!db || !ownerUid) throw new Error('Firebase is not configured.');
  const now = new Date().toISOString();
  const profile = {
    authUid: input.uid,
    phoneE164: input.phoneE164,
    name: input.name,
    assignedTableIds: input.assignedTableIds,
    assignedTables: input.assignedTables,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'owners', ownerUid, 'employees', input.phoneE164), profile);
  await setDoc(doc(db, 'owners', ownerUid, 'employeeAccess', input.uid), {
    ...profile,
    phoneE164: input.phoneE164,
    updatedAt: now,
  });
}

export async function getActiveEmployeeProfile(user: User): Promise<Record<string, any> | null> {
  if (!db || !ownerUid) return null;
  const snapshot = await getDoc(doc(db, 'owners', ownerUid, 'employeeAccess', user.uid));
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  if (profile.active !== true || profile.authUid !== user.uid) return null;
  return { ...profile, phoneE164: String(profile.phoneE164 || '') };
}

export function listenForAppAuth(callback: (user: User | null) => void): () => void {
  if (!auth || !isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}
