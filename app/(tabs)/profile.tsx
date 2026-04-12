import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionStatus, getProfile } from '@/services/api';
import { SubscriptionStatus } from '@/types/app';
import SettingsModal from '@/components/SettingsModal';
import CustomAlert from '@/components/CustomAlert';
import { RC_PREMIUM_ENTITLEMENT, RC_OFFERING_ID } from '@/constants/config';
import { useTranslation } from 'react-i18next';

// RevenueCat — native modules, not available in Expo Go
let Purchases: any = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {};
try {
  Purchases = require('react-native-purchases').default;
  const rcUI = require('react-native-purchases-ui');
  RevenueCatUI = rcUI.default;
  PAYWALL_RESULT = rcUI.PAYWALL_RESULT;
} catch { /* Expo Go */ }

function getInitials(name: string, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; icon: 'info' | 'error' | 'success' | 'warning' }>({
    visible: false, title: '', message: '', icon: 'info',
  });
  const showAlert = (title: string, message: string, icon: 'info' | 'error' | 'success' | 'warning' = 'info') =>
    setCustomAlert({ visible: true, title, message, icon });

  const loadStatus = useCallback(async () => {
    try {
      const s = await getSubscriptionStatus();
      setStatus(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getProfile().then((p) => { if (p.name) setProfileName(p.name); }).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const handleUpgrade = async () => {
    if (!RevenueCatUI) {
      showAlert(t('profile.devBuildRequired'), t('profile.devBuildMsg'), 'info');
      return;
    }
    setPurchaseLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const offering = offerings.all[RC_OFFERING_ID] ?? offerings.current;
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: RC_PREMIUM_ENTITLEMENT,
        offering,
      });
      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        showAlert(t('profile.premiumSuccess'), t('profile.premiumSuccessMsg'), 'success');
        loadStatus();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        showAlert(t('profile.purchaseFailed'), e.message || t('common.tryAgain'), 'error');
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleManage = async () => {
    if (!Purchases) return;
    try {
      await Purchases.showManageSubscriptions();
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    }
  };

  const handleSignOut = () => {
    setCustomAlert({
      visible: true, title: t('profile.signOutConfirmTitle'), message: t('profile.signOutConfirmMsg'), icon: 'warning',
    });
  };

  const s = makeStyles(theme);
  const email = user?.email || '';
  const initials = getInitials(profileName, email);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('profile.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={[s.avatar, { backgroundColor: theme.primary }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          {profileName ? (
            <Text style={[s.displayName, { color: theme.text }]}>{profileName}</Text>
          ) : null}
          <Text style={[s.email, { color: theme.textSecondary }]}>{email}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {/* Subscription card */}
            <View style={[s.card, { backgroundColor: status?.isSubscribed ? `${theme.success}12` : theme.card }]}>
              <View style={s.cardRow}>
                <Ionicons
                  name={status?.isSubscribed ? 'star' : 'star-outline'}
                  size={22}
                  color={status?.isSubscribed ? '#FFD60A' : theme.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: theme.text }]}>
                    {status?.isSubscribed ? t('profile.premiumMember') : t('profile.freePlan')}
                  </Text>
                  <Text style={[s.cardSub, { color: theme.textSecondary }]}>
                    {status?.isSubscribed
                      ? t('profile.monthlyScans', { used: status?.monthlyUploadsUsed ?? 0, limit: status?.monthlyUploadsLimit ?? 100 })
                      : t('profile.weeklyUploads', { used: status?.uploadsUsedThisWeek ?? 0, limit: status?.uploadsLimitPerWeek ?? 2 })
                    }
                  </Text>
                </View>
                {status?.isSubscribed && (
                  <View style={[s.badge, { backgroundColor: '#FFD60A20' }]}>
                    <Text style={[s.badgeText, { color: '#B8860B' }]}>PRO</Text>
                  </View>
                )}
              </View>

              {/* Progress bar for free users */}
              {!status?.isSubscribed && (
                <View style={[s.barBg, { backgroundColor: theme.border }]}>
                  <View style={[
                    s.barFill,
                    {
                      width: `${Math.min(((status?.uploadsUsedThisWeek ?? 0) / (status?.uploadsLimitPerWeek ?? 2)) * 100, 100)}%`,
                      backgroundColor: (status?.remainingFreeUploads ?? 1) === 0 ? theme.error : theme.primary,
                    }
                  ]} />
                </View>
              )}
            </View>

            {/* Upgrade section */}
            {!status?.isSubscribed && (
              <View style={[s.upgradeCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
                <Text style={[s.upgradeTitle, { color: theme.text }]}>{t('profile.goPremium')}</Text>
                <Text style={[s.upgradeSub, { color: theme.textSecondary }]}>
                  {t('profile.goPremiumSub')}
                </Text>
                <View style={s.perks}>
                  {[t('profile.perk1'), t('profile.perk2'), t('profile.perk3')].map((perk) => (
                    <View style={s.perkRow} key={perk}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                      <Text style={[s.perkText, { color: theme.text }]}>{perk}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.upgradeBtn, { backgroundColor: theme.primary }]}
                  onPress={handleUpgrade}
                  disabled={purchaseLoading}
                  activeOpacity={0.85}
                >
                  {purchaseLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.upgradeBtnText}>{t('profile.upgradeToPremium')}</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Manage subscription */}
            {status?.isSubscribed && (
              <TouchableOpacity
                style={[s.row, { backgroundColor: theme.card }]}
                onPress={handleManage}
              >
                <Ionicons name="card-outline" size={20} color={theme.textSecondary} />
                <Text style={[s.rowText, { color: theme.text }]}>{t('profile.manageSubscription')}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Settings rows */}
        <View style={s.section}>
          <TouchableOpacity
            style={[s.row, { backgroundColor: theme.card }]}
            onPress={toggleTheme}
          >
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={theme.textSecondary} />
            <Text style={[s.rowText, { color: theme.text }]}>{isDark ? t('profile.darkMode') : t('profile.lightMode')}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.row, { backgroundColor: theme.card }]}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
            <Text style={[s.rowText, { color: theme.text }]}>{t('profile.settings')}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[s.row, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}25` }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={[s.rowText, { color: theme.error }]}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        buttons={
          customAlert.title === t('profile.signOutConfirmTitle')
            ? [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
              ]
            : [{ text: t('common.ok') }]
        }
        onClose={() => setCustomAlert((a) => ({ ...a, visible: false }))}
      />
    </View>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  scroll: { padding: 20, gap: 14, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', gap: 10, marginBottom: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  email: { fontSize: 13, fontWeight: '400', marginTop: 2 },
  card: { borderRadius: 14, padding: 14, gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  barBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  upgradeCard: {
    borderRadius: 14, padding: 18, gap: 12,
    borderWidth: 1,
  },
  upgradeTitle: { fontSize: 18, fontWeight: '800' },
  upgradeSub: { fontSize: 14 },
  perks: { gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 14 },
  upgradeBtn: {
    height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '500' },
});
