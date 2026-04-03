import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage service for managing app data with AsyncStorage
 * All keys are prefixed with @ to follow AsyncStorage conventions
 */

const KEYS = {
  USER_DATA: '@user_data',
  APP_SETTINGS: '@app_settings',
  // Add your storage keys here
};

/**
 * Get user data from storage
 */
export const getUserData = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

/**
 * Save user data to storage
 */
export const saveUserData = async (userData: any) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
};

/**
 * Get app settings from storage
 */
export const getAppSettings = async () => {
  try {
    const settings = await AsyncStorage.getItem(KEYS.APP_SETTINGS);
    return settings ? JSON.parse(settings) : null;
  } catch (error) {
    console.error('Error getting app settings:', error);
    return null;
  }
};

/**
 * Save app settings to storage
 */
export const saveAppSettings = async (settings: any) => {
  try {
    await AsyncStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving app settings:', error);
    return false;
  }
};

/**
 * Clear all app data
 */
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove([KEYS.USER_DATA, KEYS.APP_SETTINGS]);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};

/**
 * Generic get item
 */
export const getItem = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return null;
  }
};

/**
 * Generic set item
 */
export const setItem = async <T>(key: string, value: T): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    return false;
  }
};

/**
 * Generic remove item
 */
export const removeItem = async (key: string): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
    return false;
  }
};

export const storageService = {
  getUserData,
  saveUserData,
  getAppSettings,
  saveAppSettings,
  clearAllData,
  getItem,
  setItem,
  removeItem,
};
