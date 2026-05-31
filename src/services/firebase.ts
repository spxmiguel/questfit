import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Check if configuration is complete
const isConfigComplete = 
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId;

let app: any;
let auth: any;
let db: any;
let storage: any;
let isFirebaseEnabled = false;

if (isConfigComplete) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    try {
      auth = initializeAuth(app, {
        persistence: [browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver
      });
    } catch (e: any) {
      if (e.code === 'auth/already-initialized' || auth != null) {
        auth = getAuth(app);
      } else {
        throw e;
      }
    }
    db = getFirestore(app);
    storage = getStorage(app);
    isFirebaseEnabled = true;
    console.log('Firebase initialized successfully with custom resolver.');
  } catch (error) {
    console.warn('Firebase failed to initialize:', error);
  }
} else {
  console.warn('Firebase config missing or incomplete. Running in Mock/LocalStorage mode.');
}

export { app, auth, db, storage, isFirebaseEnabled };
