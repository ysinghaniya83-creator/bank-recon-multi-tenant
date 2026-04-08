import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser } from '../types';

const MASTER_ADMIN_EMAIL = 'ysinghaniya83@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  appUser: AppUser | null;
  isMasterAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

async function ensureUserDocExists(user: User): Promise<AppUser | null> {
  const ref = doc(db, 'users', user.uid);
  
  try {
    console.log('[Auth] Checking user doc for:', user.email);
    
    const snap = await getDoc(ref);
    if (snap.exists()) {
      console.log('[Auth] User doc found');
      return snap.data() as AppUser;
    }
    
    // New user: create doc
    console.log('[Auth] Creating new user doc for:', user.email);
    const newUser: AppUser = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: user.email === MASTER_ADMIN_EMAIL ? 'admin' : 'pending',
      orgId: null,
      pinHash: null,
      pinSet: false,
      createdAt: serverTimestamp() as any,
      lastLogin: serverTimestamp() as any,
    };
    
    await setDoc(ref, newUser);
    console.log('[Auth] User doc created successfully');
    
    return newUser;
  } catch (err) {
    console.error('[Auth] Error in ensureUserDocExists:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Main auth state listener
  useEffect(() => {
    console.log('[Auth] Setting up auth listener');
    
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          console.log('[Auth] User signed in:', user.email);
          const appData = await ensureUserDocExists(user);
          
          setCurrentUser(user);
          setAppUser(appData);
          setIsMasterAdmin(user.email === MASTER_ADMIN_EMAIL);
          
          console.log('[Auth] Auth state updated:', {
            email: user.email,
            isMaster: user.email === MASTER_ADMIN_EMAIL,
            hasAppData: !!appData,
          });
        } else {
          console.log('[Auth] User signed out');
          setCurrentUser(null);
          setAppUser(null);
          setIsMasterAdmin(false);
        }
      } catch (err) {
        console.error('[Auth] Error in onAuthStateChanged:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      unsub();
    };
  }, []);

  const signIn = async () => {
    try {
      console.log('[Auth] Starting sign in');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('[Auth] Sign in complete');
    } catch (err) {
      console.error('[Auth] Sign in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out');
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setAppUser(null);
      setIsMasterAdmin(false);
      console.log('[Auth] Sign out complete');
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
      throw err;
    }
  };

  const refreshUser = async () => {
    if (currentUser) {
      console.log('[Auth] Refreshing user data');
      const appData = await ensureUserDocExists(currentUser);
      setAppUser(appData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        appUser,
        isMasterAdmin,
        loading,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
