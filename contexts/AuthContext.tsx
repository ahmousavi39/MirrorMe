import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { initUser } from '@/services/api';
import { RC_IOS_API_KEY } from '@/constants/config';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// ── RevenueCat ───────────────────────────────────────────────────────────────────
// Skip native RevenueCat in Expo Go — it requires a development/production build.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Purchases: any = null;
let rcConfigured = false;
if (!isExpoGo) {
  try {
    Purchases = require('react-native-purchases').default;
  } catch {
    // not available
  }
}

// Module-level flag — set synchronously before Firebase creates the user,
// so it's guaranteed to be readable the moment onAuthStateChanged fires.
let _pendingOnboarding = false;
export function setPendingOnboarding(val: boolean) { _pendingOnboarding = val; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isNewUser: boolean;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // Safety net: if Firebase doesn't respond in 5s, stop loading anyway
    const timeout = setTimeout(() => {
      setLoading(false);
      console.warn('Firebase auth timed out — proceeding without auth state');
    }, 5000);

    // Configure RevenueCat once on app start
    if (Purchases) {
      try {
        Purchases.configure({ apiKey: RC_IOS_API_KEY });
        rcConfigured = true;
      } catch (e) {
        console.warn('RevenueCat configure error:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);

      // Unblock UI immediately — don't wait for initUser
      if (_pendingOnboarding) {
        setIsNewUser(true);
        _pendingOnboarding = false;
      } else {
        setIsNewUser(false);
      }
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        if (Purchases && rcConfigured) {
          try { await Purchases.logIn(firebaseUser.uid); } catch (e) {
            console.warn('RevenueCat logIn error:', e);
          }
        }
        // initUser runs in background — isNewUser is set by register.tsx directly
        try { await initUser(); } catch (e) {
          console.warn('User init error:', e);
        }
      } else {
        setIsNewUser(false);
        if (Purchases && rcConfigured) {
          try { await Purchases.logOut(); } catch { /* ignore */ }
        }
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const completeOnboarding = () => setIsNewUser(false);

  return (
    <AuthContext.Provider value={{ user, loading, isNewUser, completeOnboarding, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
