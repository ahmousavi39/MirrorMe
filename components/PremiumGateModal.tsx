import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { RC_PREMIUM_ENTITLEMENT, RC_OFFERING_ID } from '@/constants/config';
import CustomAlert from '@/components/CustomAlert';
import { useTranslation } from 'react-i18next';

// RevenueCat — native module, not available in Expo Go
let Purchases: any = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {};
try {
  Purchases = require('react-native-purchases').default;
  const rcUI = require('react-native-purchases-ui');
  RevenueCatUI = rcUI.default;
  PAYWALL_RESULT = rcUI.PAYWALL_RESULT;
} catch { /* Expo Go */ }

interface PremiumGateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful purchase/restore so the parent can refresh status */
  onUpgraded?: () => void;
}

const PERKS = [
  '100 outfit analyses per month',
  'Priority AI processing',
  'Full history access',
];

export default function PremiumGateModal({ visible, onClose, onUpgraded }: PremiumGateModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; icon: 'info' | 'error' | 'success' | 'warning' }>({ visible: false, title: '', message: '', icon: 'info' });
  const showAlert = (title: string, message: string, icon: 'info' | 'error' | 'success' | 'warning' = 'info') =>
    setCustomAlert({ visible: true, title, message, icon });

  const PERKS = [
    t('premiumGate.perk1'),
    t('premiumGate.perk2'),
    t('premiumGate.perk3'),
  ];

  const handleUpgrade = async () => {
    if (!RevenueCatUI) {
      showAlert(t('premiumGate.devBuildRequired'), t('premiumGate.devBuildMsg'), 'info');
      return;
    }
    setLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const offering = offerings.all[RC_OFFERING_ID] ?? offerings.current;
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: RC_PREMIUM_ENTITLEMENT,
        offering,
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        showAlert(t('premiumGate.premiumSuccess'), t('premiumGate.premiumSuccessMsg'), 'success');
        onUpgraded?.();
        onClose();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        showAlert(t('premiumGate.purchaseFailed'), e.message || 'Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>

          {/* Icon */}
          <View style={[styles.iconBg, { backgroundColor: `${theme.primary}18` }]}>
            <Ionicons name="star" size={36} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{t('premiumGate.title')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('premiumGate.subtitle')}
          </Text>

          {/* Perks */}
          <View style={[styles.perksBox, { backgroundColor: `${theme.primary}0D`, borderColor: `${theme.primary}25` }]}>
            {PERKS.map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                <Text style={[styles.perkText, { color: theme.text }]}>{perk}</Text>
              </View>
            ))}
          </View>

          {/* Upgrade button */}
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
            onPress={handleUpgrade}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <Ionicons name="star" size={16} color="#fff" />
                  <Text style={styles.upgradeBtnText}>{t('premiumGate.upgradeNow')}</Text>
                </>
              )
            }
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: theme.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>{t('premiumGate.notNow')}</Text>
          </TouchableOpacity>

        </View>
      </View>

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        onClose={() => setCustomAlert((a) => ({ ...a, visible: false }))}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  perksBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  upgradeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 4,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
