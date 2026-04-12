import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface UsageBannerProps {
  used: number;
  limit: number;
  isSubscribed: boolean;
  monthlyUsed?: number | null;
  monthlyLimit?: number | null;
}

export default function UsageBanner({ used, limit, isSubscribed, monthlyUsed, monthlyLimit }: UsageBannerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  if (isSubscribed) {
    const mUsed = monthlyUsed ?? 0;
    const mLimit = monthlyLimit ?? 100;
    const mRemaining = mLimit - mUsed;
    const isAtMonthlyLimit = mRemaining <= 0;

    return (
      <View style={[styles.container, { backgroundColor: isAtMonthlyLimit ? `${theme.error}12` : `${theme.success}15`, borderColor: isAtMonthlyLimit ? `${theme.error}40` : `${theme.success}30` }]}>
        <View style={styles.row}>
          <Ionicons
            name={isAtMonthlyLimit ? 'ban-outline' : 'checkmark-circle'}
            size={18}
            color={isAtMonthlyLimit ? theme.error : theme.success}
          />
          <Text style={[styles.text, { color: isAtMonthlyLimit ? theme.error : theme.success }]}>
            {isAtMonthlyLimit ? t('usage.premiumMonthlyLimit') : t('usage.premiumScansLeft', { count: mRemaining })}
          </Text>
        </View>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
        {t('usage.premiumUsage', { used: mUsed, limit: mLimit })}
        </Text>
      </View>
    );
  }

  const remaining = limit - used;
  const isAtLimit = remaining <= 0;
  const barColor = isAtLimit ? theme.error : remaining === 1 ? '#FF9F0A' : theme.primary;

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: isAtLimit ? `${theme.error}40` : theme.border }
      ]}>
        <View style={styles.row}>
          <Ionicons
            name={isAtLimit ? 'ban-outline' : 'cloud-upload-outline'}
            size={18}
            color={isAtLimit ? theme.error : theme.textSecondary}
          />
          <Text style={[styles.text, { color: isAtLimit ? theme.error : theme.text }]}>
            {isAtLimit
              ? t('usage.weeklyLimitReached')
              : t('usage.weeklyUploadsLeft', { count: remaining })
            }
          </Text>
        </View>

        {/* Progress bar */}
        <View style={[styles.barBg, { backgroundColor: theme.border }]}>
          <View style={[
            styles.barFill,
            { width: `${Math.min((used / limit) * 100, 100)}%`, backgroundColor: barColor }
          ]} />
        </View>

        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {t('usage.weeklyUsage', { used, limit })}
        </Text>
      </View>

      {isAtLimit && (
        <TouchableOpacity
          style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.85}
        >
          <Ionicons name="star" size={16} color="#fff" />
          <Text style={styles.upgradeText}>{t('usage.upgradeToPremium')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  container: {
    borderRadius: 12, borderWidth: 1,
    padding: 12, gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 14, fontWeight: '600', flex: 1 },
  barBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  sub: { fontSize: 12 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: 12,
  },
  upgradeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
