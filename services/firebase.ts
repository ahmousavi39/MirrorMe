import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: 'AIzaSyDvXpEybD2AoXkh00LQr5LdTWxdBCZyekk',
  authDomain: 'ai-stylist-88cbb.firebaseapp.com',
  projectId: 'ai-stylist-88cbb',
  storageBucket: 'ai-stylist-88cbb.firebasestorage.app',
  messagingSenderId: '511134609232',
  appId: '1:511134609232:ios:f8db3c569ab1b29baa8655',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Expo Go + new architecture: AsyncStorage persistence hangs on initializeAuth.
// Use plain getAuth() in Expo Go (session won't persist across restarts, fine for testing).
// Real dev/production builds get full AsyncStorage persistence.
const isExpoGo = Constants.appOwnership === 'expo';

export const auth = (() => {
  if (isExpoGo) {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export default app;
