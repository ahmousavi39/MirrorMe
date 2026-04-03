import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase project: ai-stylist-88cbb
// These values are safe to include in the client — they only identify the project.
// Access is controlled by Firebase Security Rules, not by keeping these secret.
const firebaseConfig = {
  apiKey: 'AIzaSyDvXpEybD2AoXkh00LQr5LdTWxdBCZyekk',
  authDomain: 'ai-stylist-88cbb.firebaseapp.com',
  projectId: 'ai-stylist-88cbb',
  storageBucket: 'ai-stylist-88cbb.firebasestorage.app',
  messagingSenderId: '511134609232',
  appId: '1:511134609232:ios:f8db3c569ab1b29baa8655',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// initializeAuth with AsyncStorage persistence (remembers login across app restarts)
// Falls back to getAuth if already initialized (e.g. hot reload)
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export default app;
