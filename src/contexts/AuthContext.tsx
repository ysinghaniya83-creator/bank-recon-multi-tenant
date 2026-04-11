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
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AppUser;
    }
    
    // New user: create doc
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const appData = await ensureUserDocExists(user);
          setCurrentUser(user);
          setAppUser(appData);
          setIsMasterAdmin(user.email === MASTER_ADMIN_EMAIL);
        } else {
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

    return () => unsub();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('[Auth] Sign in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setAppUser(null);
      setIsMasterAdmin(false);
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
      throw err;
    }
  };

  const refreshUser = async () => {
    if (currentUser) {
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
