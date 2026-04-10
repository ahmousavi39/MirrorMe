import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionStatus, getProfile } from '@/services/api';
import { SubscriptionStatus } from '@/types/app';
import SettingsModal from '@/components/SettingsModal';
import { RC_PREMIUM_ENTITLEMENT, RC_OFFERING_ID } from '@/constants/config';

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

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileName, setProfileName] = useState<string>('');

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

  useEffect(() => { loadStatus(); }, []);

  const handleUpgrade = async () => {
    if (!RevenueCatUI) {
      Alert.alert(
        'Dev Build Required',
        'Subscriptions require a native build. RevenueCat is not available in Expo Go.',
      );
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
        Alert.alert('🎉 You\'re Premium!', 'Enjoy unlimited outfit analyses.');
        loadStatus();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message || 'Please try again.');
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
      Alert.alert('Error', e.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const s = makeStyles(theme);
  const email = user?.email || '';
  const initials = getInitials(profileName, email);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
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
                    {status?.isSubscribed ? 'Premium Member ✨' : 'Free Plan'}
                  </Text>
                  <Text style={[s.cardSub, { color: theme.textSecondary }]}>
                    {status?.isSubscribed
                      ? `${status?.monthlyUploadsUsed ?? 0}/${status?.monthlyUploadsLimit ?? 100} scans used this month`
                      : `${status?.uploadsUsedThisWeek ?? 0}/${status?.uploadsLimitPerWeek ?? 2} free uploads used this week`
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

              {/* Progress bar for premium users */}
              {status?.isSubscribed && (
                <View style={[s.barBg, { backgroundColor: theme.border }]}>
                  <View style={[
                    s.barFill,
                    {
                      width: `${Math.min(((status?.monthlyUploadsUsed ?? 0) / (status?.monthlyUploadsLimit ?? 100)) * 100, 100)}%`,
                      backgroundColor: (status?.remainingPremiumUploads ?? 1) === 0 ? theme.error : theme.primary,
                    }
                  ]} />
                </View>
              )}
            </View>

            {/* Upgrade section */}
            {!status?.isSubscribed && (
              <View style={[s.upgradeCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
                <Text style={[s.upgradeTitle, { color: theme.text }]}>Go Premium ✨</Text>
                <Text style={[s.upgradeSub, { color: theme.textSecondary }]}>
                  Get up to 100 outfit analyses per month with Premium.
                </Text>
                <View style={s.perks}>
                  {['100 analyses per month', 'Priority AI processing', 'Full history access'].map((perk) => (
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
                    : <Text style={s.upgradeBtnText}>Upgrade to Premium</Text>
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
                <Text style={[s.rowText, { color: theme.text }]}>Manage Subscription</Text>
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
            <Text style={[s.rowText, { color: theme.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.row, { backgroundColor: theme.card }]}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
            <Text style={[s.rowText, { color: theme.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[s.row, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}25` }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={[s.rowText, { color: theme.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
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
