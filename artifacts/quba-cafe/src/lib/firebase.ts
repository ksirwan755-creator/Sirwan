import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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

export function listenForOwnerAuth(
  callback: (user: User | null) => void,
): () => void {
  if (!auth || !isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, (user) => {
    callback(user?.uid === ownerUid ? user : null);
    if (user && user.uid !== ownerUid) {
      void signOut(auth);
    }
  });
}
