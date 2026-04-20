import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { setPendingOnboarding } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import SocialSignInButtons from '@/components/SocialSignInButtons';
import { useTranslation } from 'react-i18next';
import i18n from '@/services/i18n';

const getLangSlug = () => {
  const lang = i18n.language?.toLowerCase() ?? 'en';
  if (lang.startsWith('zh')) return 'zh';
  const base = lang.split('-')[0];
  return ['de', 'es', 'fr', 'ja'].includes(base) ? base : 'en';
};

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      setError(t('register.fillAllFields'));
      return;
    }
    if (password.length < 6) {
      setError(t('register.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }
    if (!termsAccepted) {
      setError(t('register.mustAcceptTerms'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await sendEmailVerification(cred.user);
      // Sign out immediately — user must verify before accessing the app
      await signOut(auth);
      setSent(true);
    } catch (e: any) {
      const msg =
        e.code === 'auth/email-already-in-use' ? t('register.emailInUse')
        : e.code === 'auth/invalid-email' ? t('register.invalidEmail')
        : e.code === 'auth/weak-password' ? t('register.passwordMinLength')
        : t('register.registrationFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(theme);

  // ── Verification sent screen ───────────────────────────────────────────────
  if (sent) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={s.logoCircle}>
          <Ionicons name="mail-outline" size={44} color="#fff" />
        </View>
        <Text style={[s.title, { marginTop: 24, textAlign: 'center' }]}>{t('register.checkInbox')}</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
          {t('register.checkInboxMsg', { email: email.trim().toLowerCase() })}
        </Text>
        <TouchableOpacity style={[s.button, { marginTop: 40, width: '100%' }]} onPress={() => router.replace('/auth/login')}>
          <Text style={s.buttonText}>{t('register.goToSignIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoCircle}>
            <Ionicons name="shirt" size={44} color="#fff" />
          </View>
          <Text style={s.title}>{t('register.title')}</Text>
          <Text style={s.subtitle}>{t('register.subtitle')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={t('register.emailPlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder={t('register.passwordPlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.placeholder}
              />
            </TouchableOpacity>
          </View>

          <View style={s.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={t('register.confirmPasswordPlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <View style={s.checkboxRow}>
            <TouchableOpacity
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
              style={[s.checkbox, termsAccepted && s.checkboxChecked]}
            >
              {termsAccepted && <Ionicons name="checkmark" size={13} color="#fff" />}
            </TouchableOpacity>
            <Text style={s.checkboxLabel}>
              {t('register.agreePrefix')}
              <Text
                style={s.checkboxLink}
                onPress={() => Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/terms/`)}
              >
                {t('register.termsLink')}
              </Text>
              {t('register.agreeMiddle')}
              <Text
                style={s.checkboxLink}
                onPress={() => Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/policy/`)}
              >
                {t('register.policyLink')}
              </Text>
              {t('register.agreeSuffix')}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>{t('register.createAccount')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Social sign-in */}
        <SocialSignInButtons onError={setError} onLoadingChange={setLoading} />
        <Text style={s.consentNote}>
          {t('register.socialConsentPrefix')}
          <Text
            style={s.consentNoteLink}
            onPress={() => Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/terms/`)}
          >
            {t('register.termsLink')}
          </Text>
          {t('register.socialConsentMiddle')}
          <Text
            style={s.consentNoteLink}
            onPress={() => Linking.openURL(`https://mirrorme.ahmousavi.com/${getLangSlug()}/policy/`)}
          >
            {t('register.policyLink')}
          </Text>
          {t('register.socialConsentSuffix')}
        </Text>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t('register.haveAccount')}</Text>
          <Link href="/auth/login" asChild>
            <TouchableOpacity>
              <Text style={s.linkText}>{t('register.signIn')}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  title: { fontSize: 30, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: theme.textSecondary, marginTop: 6 },
  form: { gap: 14 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${theme.error}18`, borderWidth: 1,
    borderColor: `${theme.error}40`, borderRadius: 10, padding: 12,
  },
  errorText: { color: theme.error, fontSize: 14, flex: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBackground, borderRadius: 12,
    borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: theme.text, fontSize: 16 },
  eyeBtn: { padding: 4 },
  button: {
    height: 54, borderRadius: 14, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: theme.textSecondary, fontSize: 15 },
  linkText: { color: theme.primary, fontSize: 15, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: theme.border, justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: theme.primary, borderColor: theme.primary },
  checkboxLabel: { flex: 1, color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
  checkboxLink: { color: theme.primary, fontWeight: '600' },
  consentNote: {
    textAlign: 'center', color: theme.textSecondary, fontSize: 12,
    lineHeight: 18, marginTop: 4,
  },
  consentNoteLink: { color: theme.primary, fontWeight: '600' },
});
