import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Animated, Linking, Modal, Platform, PanResponder, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import CustomAlert, { AlertButton } from './CustomAlert';
import ProfileEditModal from './ProfileEditModal';
import { getSettings, saveSettings, deleteAccount, AppSettings } from '@/services/api';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage, SUPPORTED_LANGUAGES } from '@/services/i18n';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = React.useState(i18n.language);

  const handleChangeLanguage = async (code: string) => {
    await changeLanguage(code);
    setCurrentLang(code);
    // Persist to backend so the preference survives reinstalls / device switches
    saveSettings({ language: code }).catch(() => {/* non-critical */});
  };
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    buttons?: AlertButton[];
    icon?: 'info' | 'error' | 'success' | 'warning';
  }>({ title: '', message: '' });
  const [profileEditVisible, setProfileEditVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(visible);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'warning' | 'confirm'>('idle');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [shareWardrobe, setShareWardrobe] = useState(true);
  const [addToWardrobe, setAddToWardrobe] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const dragY = React.useRef(new Animated.Value(0)).current;

  // Load wardrobe preferences: AsyncStorage first (instant), then API (source of truth)
  React.useEffect(() => {
    (async () => {
      // Show cached values instantly
      const [sw, atw] = await Promise.all([
        AsyncStorage.getItem('@shareWardrobe'),
        AsyncStorage.getItem('@addToWardrobe'),
      ]);
      setShareWardrobe(sw !== 'false');
      setAddToWardrobe(atw !== 'false');
      // Then sync from the server (overwrites if different)
      try {
        const remote = await getSettings();
        setShareWardrobe(remote.shareWardrobe);
        setAddToWardrobe(remote.addToWardrobe);
        await AsyncStorage.setItem('@shareWardrobe', String(remote.shareWardrobe));
        await AsyncStorage.setItem('@addToWardrobe', String(remote.addToWardrobe));
      } catch { /* non-critical — keep local values */ }
    })();
  }, []);

  const handleShareWardrobeToggle = async (val: boolean) => {
    setShareWardrobe(val);
    await AsyncStorage.setItem('@shareWardrobe', String(val));
    try { await saveSettings({ shareWardrobe: val }); } catch { /* non-critical */ }
  };

  const handleAddToWardrobeToggle = async (val: boolean) => {
    setAddToWardrobe(val);
    await AsyncStorage.setItem('@addToWardrobe', String(val));
    try { await saveSettings({ addToWardrobe: val }); } catch { /* non-critical */ }
  };

  React.useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      setModalVisible(true);
      fadeAnim.setValue(0);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => dragY.setValue(0),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) dragY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start(),
    })
  ).current;

  const handleAbout = () => {
    setAlertConfig({
      title: t('settings.aboutTitle'),
      message: 'MirrorMe is your AI-powered personal stylist.\n\nUpload any outfit photo to receive an instant style score out of 10, personalized feedback, and occasion-specific styling tips. Build your wardrobe automatically and track your fashion journey over time.\n\nVersion 1.0.0\n© 2026 Ahmad Mousavi',
      icon: 'info',
      buttons: [{ text: t('common.ok') }],
    });
    setAlertVisible(true);
  };

  const getLangSlug = () => {
    const lang = i18n.language;
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('es')) return 'es';
    return 'en';
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/policy/`);
  };

  const handleTerms = () => {
    Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/terms/`);
  };

  const isEmailUser = auth.currentUser?.providerData?.some((p) => p.providerId === 'password');

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      if (isEmailUser) {
        // Re-authenticate with password
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email!,
          deletePassword,
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        // Google / Apple users — re-auth not required for fresh sessions
        // (Firebase requires re-auth only if session is old; we attempt delete and
        //  catch 'auth/requires-recent-login' if needed)
      }
      await deleteAccount();
      // Clear all local storage, then sign out the Firebase client session.
      // The auth guard in _layout.tsx will redirect to /auth/login once user = null.
      await AsyncStorage.clear();
      await firebaseSignOut(auth);
    } catch (e: any) {
      const code = e.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteError(t('settings.incorrectPassword'));
      } else if (code === 'auth/requires-recent-login') {
        setDeleteError('Please sign out and sign in again before deleting your account.');
      } else {
        setDeleteError(e.message || 'Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Modal
      visible={modalVisible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.background,
              transform: [
                { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
                { translateY: dragY }
              ]
            }
          ]}
        >
          {/* Drag handle */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settings.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionProfile')}</Text>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={() => setProfileEditVisible(true)}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>{t('settings.editProfile')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionAppearance')}</Text>
              
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={toggleTheme}
              >
                <View style={styles.settingLeft}>
                  <Ionicons 
                    name={isDark ? 'moon' : 'sunny'} 
                    size={24} 
                    color={theme.primary} 
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {isDark ? t('settings.darkMode') : t('settings.lightMode')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionLanguage')}</Text>

              {SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.settingItem, { backgroundColor: theme.card }]}
                  onPress={() => handleChangeLanguage(code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="language-outline" size={24} color={theme.primary} />
                    <Text style={[styles.settingText, { color: theme.text }]}>{t(labelKey)}</Text>
                  </View>
                  {currentLang === code && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionWardrobe')}</Text>

              <View style={[styles.settingItem, { backgroundColor: theme.card }]}>
                <View style={[styles.settingLeft, { flex: 1, marginRight: 12 }]}>
                  <Ionicons name="shirt-outline" size={24} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>{t('settings.shareWardrobe')}</Text>
                    <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>{t('settings.shareWardrobeSub')}</Text>
                  </View>
                </View>
                <Switch
                  value={shareWardrobe}
                  onValueChange={handleShareWardrobeToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.settingItem, { backgroundColor: theme.card }]}>
                <View style={[styles.settingLeft, { flex: 1, marginRight: 12 }]}>
                  <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>{t('settings.addToWardrobe')}</Text>
                    <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>{t('settings.addToWardrobeSub')}</Text>
                  </View>
                </View>
                <Switch
                  value={addToWardrobe}
                  onValueChange={handleAddToWardrobeToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionLegal')}</Text>
              
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={handlePrivacyPolicy}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t('settings.privacyPolicy')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={handleTerms}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="document-text" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t('settings.termsOfUse')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionAbout')}</Text>
              
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={handleAbout}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="information-circle" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t('settings.aboutTitle')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sectionAccount')}</Text>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: `${theme.error}12`, borderWidth: 1, borderColor: `${theme.error}30` }]}
                onPress={() => { setDeleteStep('warning'); setDeletePassword(''); setDeleteError(''); }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="trash-outline" size={24} color={theme.error} />
                  <Text style={[styles.settingText, { color: theme.error, fontWeight: '600' }]}>{t('settings.deleteAccount')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        icon={alertConfig.icon}
        onClose={() => setAlertVisible(false)}
      />

      <ProfileEditModal
        visible={profileEditVisible}
        onClose={() => setProfileEditVisible(false)}
      />

      {/* ── Delete account — warning step ─────────────────────────── */}
      <Modal visible={deleteStep === 'warning'} transparent animationType="fade" onRequestClose={() => setDeleteStep('idle')}>
        <View style={styles.dangerOverlay}>
          <View style={[styles.dangerSheet, { backgroundColor: theme.background }]}>
            <View style={styles.dangerIconRow}>
              <View style={[styles.dangerIconCircle, { backgroundColor: `${theme.error}18` }]}>
                <Ionicons name="warning-outline" size={36} color={theme.error} />
              </View>
            </View>
            <Text style={[styles.dangerTitle, { color: theme.text }]}>{t('settings.deleteWarningTitle')}</Text>
            <Text style={[styles.dangerBody, { color: theme.textSecondary }]}>
              {t('settings.deleteWarningBody')}
            </Text>
            <View style={styles.dangerList}>
              {[t('settings.deleteItem1'), t('settings.deleteItem2'), t('settings.deleteItem3'), t('settings.deleteItem4')].map((item, i) => (
                <View key={i} style={styles.dangerListRow}>
                  <Ionicons name="close-circle" size={16} color={theme.error} />
                  <Text style={[styles.dangerListText, { color: theme.textSecondary }]}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.dangerNote, { color: theme.error }]}>{t('settings.deleteNote')}</Text>
            <View style={styles.dangerBtns}>
              <TouchableOpacity style={[styles.dangerBtnSecondary, { borderColor: theme.border }]} onPress={() => setDeleteStep('idle')}>
                <Text style={[styles.dangerBtnSecondaryText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtnPrimary, { backgroundColor: theme.error }]} onPress={() => setDeleteStep('confirm')}>
                <Text style={styles.dangerBtnPrimaryText}>{t('common.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete account — password confirmation step ────────────── */}
      <Modal visible={deleteStep === 'confirm'} transparent animationType="fade" onRequestClose={() => setDeleteStep('idle')}>
        <View style={styles.dangerOverlay}>
          <View style={[styles.dangerSheet, { backgroundColor: theme.background }]}>
            <Text style={[styles.dangerTitle, { color: theme.text }]}>
              {isEmailUser ? t('settings.confirmPasswordTitle') : t('settings.finalConfirmTitle')}
            </Text>
            <Text style={[styles.dangerBody, { color: theme.textSecondary }]}>
              {isEmailUser
                ? t('settings.confirmPasswordMsg')
                : t('settings.finalConfirmMsg')}
            </Text>

            {isEmailUser && (
              <View style={[styles.passwordWrapper, { backgroundColor: theme.inputBackground, borderColor: deleteError ? theme.error : theme.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} />
                <TextInput
                  style={[styles.passwordInput, { color: theme.text }]}
                  placeholder={t('settings.passwordPlaceholder')}
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showDeletePassword}
                  value={deletePassword}
                  onChangeText={(t) => { setDeletePassword(t); setDeleteError(''); }}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowDeletePassword(!showDeletePassword)}>
                  <Ionicons name={showDeletePassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.placeholder} />
                </TouchableOpacity>
              </View>
            )}

            {deleteError ? (
              <View style={[styles.deleteErrorBox, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.error} />
                <Text style={[styles.deleteErrorText, { color: theme.error }]}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.dangerBtns}>
              <TouchableOpacity style={[styles.dangerBtnSecondary, { borderColor: theme.border }]} onPress={() => setDeleteStep('idle')} disabled={deleteLoading}>
                <Text style={[styles.dangerBtnSecondaryText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtnPrimary, { backgroundColor: theme.error, opacity: deleteLoading || (isEmailUser && !deletePassword) ? 0.6 : 1 }]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || (isEmailUser && !deletePassword)}
              >
                {deleteLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.dangerBtnPrimaryText}>{t('settings.deleteAccountBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  dragHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
  },
  settingSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  dangerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  dangerSheet: { borderRadius: 20, padding: 24 },
  dangerIconRow: { alignItems: 'center', marginBottom: 16 },
  dangerIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  dangerTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  dangerBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  dangerList: { gap: 8, marginBottom: 16 },
  dangerListRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerListText: { fontSize: 13, flex: 1 },
  dangerNote: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  dangerBtns: { flexDirection: 'row', gap: 12 },
  dangerBtnSecondary: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dangerBtnSecondaryText: { fontSize: 15, fontWeight: '600' },
  dangerBtnPrimary: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  dangerBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 12 },
  passwordInput: { flex: 1, fontSize: 15 },
  deleteErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  deleteErrorText: { fontSize: 13, flex: 1 },
});
