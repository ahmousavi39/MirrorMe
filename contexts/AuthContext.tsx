import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { initUser, getProfile, getSettings } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

      if (!firebaseUser) {
        // Signed out — unblock immediately
        setIsNewUser(false);
        setUser(null);
        setLoading(false);
        if (Purchases && rcConfigured) {
          try { await Purchases.logOut(); } catch { /* ignore */ }
        }
        return;
      }

      // Signed in — keep loading=true until we know if onboarding is needed
      if (Purchases && rcConfigured) {
        try { await Purchases.logIn(firebaseUser.uid); } catch (e) {
          console.warn('RevenueCat logIn error:', e);
        }
      }

      let needsOnboarding = _pendingOnboarding;
      _pendingOnboarding = false;

      try {
        await initUser();
        const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
        if (!profile.name) needsOnboarding = true;
        await Promise.all([
          AsyncStorage.setItem('@shareWardrobe', String(settings.shareWardrobe)),
          AsyncStorage.setItem('@addToWardrobe', String(settings.addToWardrobe)),
        ]);
      } catch (e) {
        console.warn('User init / profile check error:', e);
      }

      setIsNewUser(needsOnboarding);
      setUser(firebaseUser);
      setLoading(false);
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
