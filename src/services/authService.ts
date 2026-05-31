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

const REDIRECT_PENDING_KEY = 'questfit_google_redirect_pending';
const POPUP_PENDING_KEY = 'questfit_google_popup_pending';

let redirectHandled = false;
let redirectResultPending = false;
let redirectError: string | null = null;
let redirectPromise: Promise<any> = Promise.resolve();

const isRedirectPending = () => {
  try { return localStorage.getItem(REDIRECT_PENDING_KEY) === '1'; } catch { return false; }
};
const setRedirectPending = () => {
  try { localStorage.setItem(REDIRECT_PENDING_KEY, '1'); } catch {}
};
const clearRedirectPending = () => {
  try { localStorage.removeItem(REDIRECT_PENDING_KEY); } catch {}
};

const isPopupPending = () => {
  try { return localStorage.getItem(POPUP_PENDING_KEY) === '1'; } catch { return false; }
};
const setPopupPending = () => {
  try { localStorage.setItem(POPUP_PENDING_KEY, '1'); } catch {}
};
const clearPopupPending = () => {
  try { localStorage.removeItem(POPUP_PENDING_KEY); } catch {}
};

// Set up Firebase auth listener if active
if (isFirebaseEnabled && auth) {
  // ── Redirect result ──
  if (!redirectHandled) {
    redirectHandled = true;
    redirectResultPending = true;

    redirectPromise = getRedirectResult(auth)
      .then((result) => {
        redirectResultPending = false;
        clearRedirectPending();
        if (result?.user) {
          console.log('Successfully logged in via redirect:', result.user);
          const session: UserSession = {
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || 'Guerreiro'
          };
          notifyListeners(session);
          return session;
        }
        return null;
      })
      .catch((err) => {
        redirectResultPending = false;
        clearRedirectPending();
        console.error('Redirect sign-in error:', err);
        // Provide user-friendly messages for typical blockages (ITP / cross-site tracking)
        if (err.code === 'auth/web-storage-unsupported' || err.code === 'auth/operation-not-supported-in-this-environment') {
          redirectError = '⚠️ Seu navegador bloqueou o acesso ao armazenamento de login do Google (Bloqueio de Cookies de Terceiros). Para corrigir, use o link "Entrar sem Senha" por e-mail, ou desative "Impedir Rastreamento entre Sites" nos Ajustes do seu Safari.';
        } else {
          redirectError = err.message || 'Erro ao processar o login com o Google via redirecionamento.';
        }
        return null;
      });
  }

  // ── Auth state listener ──
  onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      // Don't finalize auth state if we are waiting for redirect or popup login
      if (isRedirectPending()) return;
      if (redirectResultPending) return; // getRedirectResult() still running
      if (isPopupPending()) return;

      notifyListeners(null);
    } else {
      clearPopupPending();
      clearRedirectPending();
      
      const session: UserSession = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Guerreiro QuestFit'
      };
      notifyListeners(session);
    }
  });
}

export const subscribeToAuth = (callback: AuthCallback) => {
  listeners.push(callback);
  
  // If Firebase is disabled or not initialized, notify immediately to avoid any loading hang
  if (!isFirebaseEnabled || !auth) {
    callback(currentUser);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  let completed = false;
  const safeNotify = () => {
    if (!completed) {
      completed = true;
      callback(currentUser);
    }
  };
  
  // Safe fallback timeout of 2.5 seconds to guarantee the loading screen is never stuck
  const fallbackTimeout = setTimeout(safeNotify, 2500);

  redirectPromise.then(() => {
    clearTimeout(fallbackTimeout);
    safeNotify();
  });

  // Return unsubscribe function
  return () => {
    clearTimeout(fallbackTimeout);
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

export const getRedirectError = (): string | null => {
  return redirectError;
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
    provider.setCustomParameters({ prompt: 'select_account' });
    
    // WebKit/Safari / ITP workaround:
    // 1. Try signInWithPopup with a timeout race (Safari popup blocker can freeze the promise in background).
    // 2. Fall back to signInWithRedirect if popup is blocked, unsupported or throws storage unsupported error.
    try {
      setPopupPending();
      
      const POPUP_TIMEOUT = Symbol('popup-timeout');
      const result = await Promise.race([
        signInWithPopup(auth, provider),
        new Promise<typeof POPUP_TIMEOUT>((resolve) =>
          setTimeout(() => resolve(POPUP_TIMEOUT), 15000)
        ),
      ]);
      
      if (result === POPUP_TIMEOUT) {
        throw { code: 'auth/popup-blocked' };
      }
      
      clearPopupPending();
      
      const session: UserSession = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Guerreiro'
      };
      notifyListeners(session);
      return session;
    } catch (popupErr: any) {
      clearPopupPending();
      const code = popupErr?.code;
      
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw popupErr; // Bubbled up to cancel the loading state in UI
      }
      
      // Fallback conditions:
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/internal-error'
      ) {
        console.log('[Auth] Popup blocked or failed, falling back to redirect...');
        setRedirectPending();
        try {
          await signInWithRedirect(auth, provider);
          // Return a pending promise because the page will redirect and reload
          return new Promise(() => {});
        } catch (redirectErr) {
          clearRedirectPending();
          console.error('[Auth] redirect fallback error:', redirectErr);
          throw redirectErr;
        }
      }
      
      throw popupErr;
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
    return Promise.resolve(session);
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
