import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { initUser } from '@/services/api';
import { RC_IOS_API_KEY } from '@/constants/config';

// ── RevenueCat (native module — not available in Expo Go) ─────────────────────────
// Build with: npx expo run:ios  (dev client)
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {
  console.warn('RevenueCat not available (Expo Go). Use a dev build for subscription features.');
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configure RevenueCat once on app start
    if (Purchases) {
      try {
        Purchases.configure({ apiKey: RC_IOS_API_KEY });
      } catch (e) {
        console.warn('RevenueCat configure error:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Tie the RevenueCat identity to the Firebase UID so subscriptions
        // are always linked to the correct user account
        if (Purchases) {
          try {
            await Purchases.logIn(firebaseUser.uid);
          } catch (e) {
            console.warn('RevenueCat logIn error:', e);
          }
        }
        // Ensure Firestore user document exists
        try {
          await initUser();
        } catch (e) {
          console.warn('User init error:', e);
        }
      } else {
        if (Purchases) {
          try {
            await Purchases.logOut();
          } catch {
            // Ignore — user may not have been logged in
          }
        }
      }
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
