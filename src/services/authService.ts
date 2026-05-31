import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth, isFirebaseEnabled } from './firebase';

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
  if (user) {
    localStorage.setItem('questfit_user_session', JSON.stringify(user));
  } else {
    localStorage.removeItem('questfit_user_session');
  }
  listeners.forEach(cb => cb(user));
};

// Initialize current user session from LocalStorage cache (works for both Firebase and Mock)
const cachedSession = localStorage.getItem('questfit_user_session');
if (cachedSession) {
  try {
    currentUser = JSON.parse(cachedSession);
  } catch (e) {}
} else if (!isFirebaseEnabled) {
  const cachedUser = localStorage.getItem(MOCK_USER_KEY);
  if (cachedUser) {
    try {
      currentUser = JSON.parse(cachedUser);
    } catch (e) {}
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

  // Handle redirect results in case Google Login fallback was triggered
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        console.log('Successfully logged in via redirect:', result.user);
        const session: UserSession = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Guerreiro'
        };
        notifyListeners(session);
      }
    })
    .catch((err) => {
      console.error('Redirect sign-in error:', err);
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
    try {
      const cred = await signInWithPopup(auth, provider);
      const session: UserSession = {
        uid: cred.user.uid,
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'Guerreiro do Fogo'
      };
      notifyListeners(session);
      return session;
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        console.warn('Popup blocked by browser. Retrying with redirect...');
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      }
      throw err;
    }
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

export const sendPasswordlessLink = async (email: string): Promise<void> => {
  if (isFirebaseEnabled && auth) {
    const actionCodeSettings = {
      // Dynamic base URL for localhost or spxmiguel.github.io
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  } else {
    // Mock Mode
    console.log(`[Mock] Link de login enviado para ${email}`);
    window.localStorage.setItem('emailForSignIn', email);
    const mockLink = `${window.location.origin}${window.location.pathname}?mode=signIn&email=${encodeURIComponent(email)}&mock=true`;
    console.log(`[Mock] Clique no link abaixo para simular a conclusão do login:\n${mockLink}`);
  }
};

export const isEmailSignInLink = (): boolean => {
  if (isFirebaseEnabled && auth) {
    return isSignInWithEmailLink(auth, window.location.href);
  } else {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'signIn' && !!params.get('email');
  }
};

export const handleIncomingEmailLink = async (): Promise<UserSession | null> => {
  if (isFirebaseEnabled && auth) {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Por favor, informe seu e-mail para confirmação do login:');
      }
      if (!email) {
        throw new Error('E-mail de confirmação é obrigatório para concluir o login.');
      }
      const cred = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      
      const session: UserSession = {
        uid: cred.user.uid,
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'Guerreiro'
      };
      notifyListeners(session);
      
      // Clear query params so it doesn't trigger auth again on page reload
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
      }
      return session;
    }
  } else {
    // Mock Mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signIn' && params.get('email')) {
      const email = params.get('email') || '';
      const session: UserSession = {
        uid: `mock_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        email: email,
        displayName: email.split('@')[0]
      };
      localStorage.setItem(MOCK_USER_KEY, JSON.stringify(session));
      notifyListeners(session);
      
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
      }
      return session;
    }
  }
  return null;
};
