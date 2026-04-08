import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const firebaseConfig = {
  apiKey: 'AIzaSyDvXpEybD2AoXkh00LQr5LdTWxdBCZyekk',
  authDomain: 'ai-stylist-88cbb.firebaseapp.com',
  projectId: 'ai-stylist-88cbb',
  storageBucket: 'ai-stylist-88cbb.firebasestorage.app',
  messagingSenderId: '511134609232',
  appId: '1:511134609232:ios:f8db3c569ab1b29baa8655',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Expo Go (StoreClient) + new architecture hangs when initializeAuth is called
// with AsyncStorage persistence. Use plain getAuth() there — session won't
// persist across Expo Go restarts, but that's fine for development/testing.
// Real dev-client and production builds get full AsyncStorage persistence.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const auth = (() => {
  if (isExpoGo) {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Auth already initialized (e.g. fast refresh) — getAuth returns the same
    // instance which already has AsyncStorage persistence configured.
    return getAuth(app);
  }
})();

export default app;