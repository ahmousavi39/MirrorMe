import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDvXpEybD2AoXkh00LQr5LdTWxdBCZyekk',
  authDomain: 'ai-stylist-88cbb.firebaseapp.com',
  projectId: 'ai-stylist-88cbb',
  storageBucket: 'ai-stylist-88cbb.firebasestorage.app',
  messagingSenderId: '511134609232',
  appId: '1:511134609232:ios:f8db3c569ab1b29baa8655',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Always use AsyncStorage persistence so the user stays logged in across restarts.
// The try/catch handles the "already initialized" error from hot-reloads.
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Auth already initialized (e.g. hot reload) — getAuth returns the same instance
    // which already has AsyncStorage persistence applied.
    return getAuth(app);
  }
})();

export default app;