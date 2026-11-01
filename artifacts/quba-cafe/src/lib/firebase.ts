import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';

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

let phoneRecaptcha: RecaptchaVerifier | null = null;

export async function startEmployeePhoneLogin(phone: string): Promise<ConfirmationResult> {
  if (!auth || !db || !isFirebaseConfigured) throw new Error('Firebase is not configured.');
  const normalized = phone.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('Enter the phone number in international format, for example +9647XXXXXXXXX.');
  const employeeSnapshot = await getDoc(doc(db, 'owners', ownerUid, 'employees', normalized));
  if (!employeeSnapshot.exists() || employeeSnapshot.data().active !== true) {
    throw new Error('This phone number is not registered as an active QUBA employee.');
  }
  if (phoneRecaptcha) {
    phoneRecaptcha.clear();
    phoneRecaptcha = null;
  }
  phoneRecaptcha = new RecaptchaVerifier(auth, 'employee-recaptcha', { size: 'normal' });
  await phoneRecaptcha.render();
  return signInWithPhoneNumber(auth, normalized, phoneRecaptcha);
}

export async function getActiveEmployeeProfile(user: User): Promise<Record<string, any> | null> {
  if (!db || !ownerUid || !user.phoneNumber) return null;
  const snapshot = await getDoc(doc(db, 'owners', ownerUid, 'employees', user.phoneNumber));
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  if (profile.active !== true) return null;
  return { ...profile, phoneE164: user.phoneNumber };
}

export function listenForAppAuth(callback: (user: User | null) => void): () => void {
  if (!auth || !isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}
