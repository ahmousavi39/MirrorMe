import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import i18n from '@/services/i18n';

interface DataConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function DataConsentModal({ visible, onAccept, onDecline }: DataConsentModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const getLangSlug = () => {
    const lang = i18n.language;
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('es')) return 'es';
    return 'en';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>

          {/* Icon */}
          <View style={[styles.iconBg, { backgroundColor: `${theme.primary}18` }]}>
            <Ionicons name="shield-checkmark-outline" size={36} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            {t('dataConsent.title')}
          </Text>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.intro, { color: theme.textSecondary }]}>
              {t('dataConsent.intro')}
            </Text>

            {/* Data sent */}
            <View style={[styles.section, { borderColor: theme.border }]}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>
                {t('dataConsent.dataSentLabel')}
              </Text>
              {(['dataItem1', 'dataItem2'] as const).map((key) => (
                <View key={key} style={styles.bulletRow}>
                  <Ionicons name="ellipse" size={6} color={theme.textSecondary} style={styles.bullet} />
                  <Text style={[styles.bulletText, { color: theme.textSecondary }]}>
                    {t(`dataConsent.${key}`)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Recipients */}
            <View style={[styles.section, { borderColor: theme.border }]}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>
                {t('dataConsent.recipients')}
              </Text>

              {/* Ximilar */}
              <View style={[styles.recipientBox, { backgroundColor: `${theme.primary}0D`, borderColor: `${theme.primary}25` }]}>
                <View style={styles.recipientHeader}>
                  <Ionicons name="scan-outline" size={14} color={theme.primary} />
                  <Text style={[styles.recipientTitle, { color: theme.text }]}>
                    {t('dataConsent.recipient1Title')}
                  </Text>
                </View>
                <Text style={[styles.recipientDesc, { color: theme.textSecondary }]}>
                  {t('dataConsent.recipient1Desc')}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.ximilar.com/privacy/')}
                  accessibilityRole="link"
                  accessibilityLabel={t('dataConsent.ximilarPolicy')}
                >
                  <Text style={[styles.policyLink, { color: theme.primary }]}>
                    {t('dataConsent.ximilarPolicy')} →
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Google Gemini */}
              <View style={[styles.recipientBox, { backgroundColor: `${theme.primary}0D`, borderColor: `${theme.primary}25` }]}>
                <View style={styles.recipientHeader}>
                  <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                  <Text style={[styles.recipientTitle, { color: theme.text }]}>
                    {t('dataConsent.recipient2Title')}
                  </Text>
                </View>
                <Text style={[styles.recipientDesc, { color: theme.textSecondary }]}>
                  {t('dataConsent.recipient2Desc')}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://policies.google.com/privacy')}
                  accessibilityRole="link"
                  accessibilityLabel={t('dataConsent.googlePolicy')}
                >
                  <Text style={[styles.policyLink, { color: theme.primary }]}>
                    {t('dataConsent.googlePolicy')} →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Equal-protection note */}
            <Text style={[styles.policyNote, { color: theme.textSecondary }]}>
              {t('dataConsent.policyNote')}
            </Text>

            {/* Privacy policy link */}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/policy/`)}
              accessibilityRole="link"
              accessibilityLabel={t('dataConsent.viewPrivacyPolicy')}
            >
              <Text style={[styles.policyLink, styles.policyLinkCenter, { color: theme.primary }]}>
                {t('dataConsent.viewPrivacyPolicy')} →
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Accept */}
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: theme.primary }]}
            onPress={onAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('dataConsent.acceptBtn')}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.acceptBtnText}>{t('dataConsent.acceptBtn')}</Text>
          </TouchableOpacity>

          {/* Decline */}
          <TouchableOpacity
            style={[styles.declineBtn, { borderColor: theme.border }]}
            onPress={onDecline}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('dataConsent.declineBtn')}
          >
            <Text style={[styles.declineText, { color: theme.textSecondary }]}>
              {t('dataConsent.declineBtn')}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
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
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollArea: {
    width: '100%',
    maxHeight: 340,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    marginTop: 7,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  recipientBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipientTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recipientDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  policyLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  policyLinkCenter: {
    textAlign: 'center',
    fontSize: 13,
  },
  policyNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  acceptBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  declineBtn: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
