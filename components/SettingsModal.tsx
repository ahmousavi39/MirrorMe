import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Animated, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '@/services/firebase';
import CustomAlert, { AlertButton } from './CustomAlert';
import ProfileEditModal from './ProfileEditModal';
import { getSettings, saveSettings, deleteAccount } from '@/services/api';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { theme, isDark, toggleTheme } = useTheme();
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

  const handleAbout = () => {
    setAlertConfig({
      title: 'About This App',
      message: 'Your app description goes here. Update this in SettingsModal.tsx',
      icon: 'info',
      buttons: [{ text: 'OK' }],
    });
    setAlertVisible(true);
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://your-website.com/policy.html');
  };

  const handleTerms = () => {
    Linking.openURL('https://your-website.com/terms.html');
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
      // Auth state change will sign the user out automatically
    } catch (e: any) {
      const code = e.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please try again.');
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
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                })
              }]
            }
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile</Text>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={() => setProfileEditVisible(true)}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Edit Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
              
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
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Wardrobe</Text>

              <View style={[styles.settingItem, { backgroundColor: theme.card }]}>
                <View style={[styles.settingLeft, { flex: 1, marginRight: 12 }]}>
                  <Ionicons name="shirt-outline" size={24} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>Share My Wardrobe</Text>
                    <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>Use wardrobe for better suggestions</Text>
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
                    <Text style={[styles.settingText, { color: theme.text }]}>Add to Wardrobe</Text>
                    <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>Save detected items automatically</Text>
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
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Legal</Text>
              
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={handlePrivacyPolicy}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Privacy Policy
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
                    Terms of Use
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text, color: theme.error }]}>Danger Zone</Text>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: `${theme.error}12`, borderWidth: 1, borderColor: `${theme.error}30` }]}
                onPress={() => { setDeleteStep('warning'); setDeletePassword(''); setDeleteError(''); }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="trash-outline" size={24} color={theme.error} />
                  <Text style={[styles.settingText, { color: theme.error, fontWeight: '600' }]}>Delete Account</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
              
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.card }]}
                onPress={handleAbout}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="information-circle" size={24} color={theme.primary} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    About
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
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
            <Text style={[styles.dangerTitle, { color: theme.text }]}>Delete Account?</Text>
            <Text style={[styles.dangerBody, { color: theme.textSecondary }]}>
              This will permanently delete your account and all associated data including:
            </Text>
            <View style={styles.dangerList}>
              {['Your profile and preferences', 'All analysis history and photos', 'Your wardrobe items', 'Any active subscription (no refund)'].map((item, i) => (
                <View key={i} style={styles.dangerListRow}>
                  <Ionicons name="close-circle" size={16} color={theme.error} />
                  <Text style={[styles.dangerListText, { color: theme.textSecondary }]}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.dangerNote, { color: theme.error }]}>This action cannot be undone.</Text>
            <View style={styles.dangerBtns}>
              <TouchableOpacity style={[styles.dangerBtnSecondary, { borderColor: theme.border }]} onPress={() => setDeleteStep('idle')}>
                <Text style={[styles.dangerBtnSecondaryText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtnPrimary, { backgroundColor: theme.error }]} onPress={() => setDeleteStep('confirm')}>
                <Text style={styles.dangerBtnPrimaryText}>Continue</Text>
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
              {isEmailUser ? 'Confirm Your Password' : 'Final Confirmation'}
            </Text>
            <Text style={[styles.dangerBody, { color: theme.textSecondary }]}>
              {isEmailUser
                ? 'Enter your password to confirm account deletion.'
                : 'Are you sure you want to permanently delete your account and all your data?'}
            </Text>

            {isEmailUser && (
              <View style={[styles.passwordWrapper, { backgroundColor: theme.inputBackground, borderColor: deleteError ? theme.error : theme.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} />
                <TextInput
                  style={[styles.passwordInput, { color: theme.text }]}
                  placeholder="Password"
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
                <Text style={[styles.dangerBtnSecondaryText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtnPrimary, { backgroundColor: theme.error, opacity: deleteLoading || (isEmailUser && !deletePassword) ? 0.6 : 1 }]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || (isEmailUser && !deletePassword)}
              >
                {deleteLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.dangerBtnPrimaryText}>Delete My Account</Text>
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
  dangerBtnPrimary: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dangerBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 12 },
  passwordInput: { flex: 1, fontSize: 15 },
  deleteErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  deleteErrorText: { fontSize: 13, flex: 1 },
});
