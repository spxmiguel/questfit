import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, isFirebaseEnabled } from './firebase';
import { UserProfile } from '../types';

export interface UserSession {
  uid: string;
  email: string;
  displayName: string;
}

type AuthCallback = (user: UserSession | null) => void;

// LocalStorage key for mock session
const MOCK_USER_KEY = 'questfit_mock_user';

// Subscriptions list
const listeners: AuthCallback[] = [];
let currentUser: UserSession | null = null;

// Helper to notify all listeners of auth changes
const notifyListeners = (user: UserSession | null) => {
  currentUser = user;
  listeners.forEach(cb => cb(user));
};

// Initialize current user session from LocalStorage if Mock Mode
if (!isFirebaseEnabled) {
  const cachedUser = localStorage.getItem(MOCK_USER_KEY);
  if (cachedUser) {
    currentUser = JSON.parse(cachedUser);
  }
}

// Set up Firebase auth listener if active
if (isFirebaseEnabled && auth) {
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const session: UserSession = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Guerreiro QuestFit'
      };
      notifyListeners(session);
    } else {
      notifyListeners(null);
    }
  });
}

export const subscribeToAuth = (callback: AuthCallback) => {
  listeners.push(callback);
  // Immediate trigger with current cached state
  callback(currentUser);

  // Return unsubscribe function
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

export const getCurrentUser = (): UserSession | null => {
  return currentUser;
};

export const loginWithEmail = async (email: string, pass: string): Promise<UserSession> => {
  if (isFirebaseEnabled && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const session: UserSession = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'Guerreiro'
    };
    notifyListeners(session);
    return session;
  } else {
    // Mock authentication
    if (pass.length < 4) throw new Error('A senha deve ter no mínimo 4 caracteres.');
    const session: UserSession = {
      uid: `mock_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
      email: email,
      displayName: email.split('@')[0]
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(session));
    notifyListeners(session);
    return session;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string): Promise<UserSession> => {
  if (isFirebaseEnabled && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Note: in a real app, updateProfile could be used here to set displayName
    const session: UserSession = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: name
    };
    notifyListeners(session);
    return session;
  } else {
    // Mock registration
    if (pass.length < 4) throw new Error('A senha deve ter no mínimo 4 caracteres.');
    const session: UserSession = {
      uid: `mock_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
      email: email,
      displayName: name
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(session));
    notifyListeners(session);
    return session;
  }
};

export const loginWithGoogle = async (): Promise<UserSession> => {
  if (isFirebaseEnabled && auth) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const session: UserSession = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'Guerreiro do Fogo'
    };
    notifyListeners(session);
    return session;
  } else {
    // Mock Google login
    const session: UserSession = {
      uid: 'mock_google_user_123',
      email: 'heroi@google.com',
      displayName: 'Herói do Google'
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(session));
    notifyListeners(session);
    return session;
  }
};

export const logoutUser = async (): Promise<void> => {
  if (isFirebaseEnabled && auth) {
    await signOut(auth);
    notifyListeners(null);
  } else {
    localStorage.removeItem(MOCK_USER_KEY);
    notifyListeners(null);
  }
};
