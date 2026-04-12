import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/config';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError(t('forgotPassword.fillEmail'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Check if email is registered before sending the reset link
      const res = await fetch(`${BACKEND_URL}/api/user/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 404) {
        setError(t('forgotPassword.noAccount'));
        return;
      }
      if (!res.ok) {
        setError(t('forgotPassword.wentWrong'));
        return;
      }
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      const msg =
        e.code === 'auth/invalid-email' ? t('forgotPassword.invalidEmail')
        : e.code === 'auth/too-many-requests' ? t('forgotPassword.tooManyRequests')
        : t('forgotPassword.wentWrong');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(theme);

  if (sent) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={s.logoCircle}>
          <Ionicons name="mail-outline" size={44} color="#fff" />
        </View>
        <Text style={[s.title, { marginTop: 24, textAlign: 'center' }]}>{t('forgotPassword.checkInbox')}</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
          {t('forgotPassword.checkInboxMsg', { email: email.trim().toLowerCase() })}
        </Text>
        <TouchableOpacity
          style={[s.button, { marginTop: 40, width: '100%' }]}
          onPress={() => router.replace('/auth/login')}
        >
          <Text style={s.buttonText}>{t('forgotPassword.backToSignIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.logoContainer}>
          <View style={s.logoCircle}>
            <Ionicons name="lock-open-outline" size={44} color="#fff" />
          </View>
          <Text style={s.appName}>{t('forgotPassword.title')}</Text>
          <Text style={s.tagline}>{t('forgotPassword.tagline')}</Text>
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
              placeholder={t('forgotPassword.emailPlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>{t('forgotPassword.sendResetLink')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t('forgotPassword.rememberPassword')}</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={s.linkText}>{t('forgotPassword.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 30, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },
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
});
