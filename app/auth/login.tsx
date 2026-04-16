import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import SocialSignInButtons from '@/components/SocialSignInButtons';
import { useTranslation } from 'react-i18next';

function firebaseErrorMessage(code: string, t: (key: string) => string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return t('login.errorInvalidCredential');
    case 'auth/invalid-email':
      return t('login.errorInvalidEmail');
    case 'auth/too-many-requests':
      return t('login.errorTooManyRequests');
    case 'auth/network-request-failed':
      return t('login.errorNetwork');
    default:
      return t('login.errorDefault');
  }
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);
  const [resending, setResending] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('login.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (!cred.user.emailVerified) {
        // Sign out immediately and prompt them to verify
        setUnverifiedUser(cred.user);
        await signOut(auth);
        setError(t('login.verifyEmail'));
        setLoading(false);
        return;
      }
      // Auth guard in _layout.tsx automatically redirects to (tabs)
      // Keep loading=true until the component unmounts on navigation
    } catch (e: any) {
      setError(firebaseErrorMessage(e.code, t));
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setResending(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setError(t('login.verificationResent'));
    } catch {
      setError(t('login.resendFailed'));
    } finally {
      setResending(false);
      setUnverifiedUser(null);
    }
  };

  const s = styles(theme);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoContainer}>
          <Image source={require('@/assets/signin.png')} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
          <Text style={s.appName}>{t('login.appName')}</Text>
          <Text style={s.tagline}>{t('login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          {error ? (
            <View>
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
              {unverifiedUser && (
                <TouchableOpacity style={s.resendBtn} onPress={handleResendVerification} disabled={resending}>
                  {resending
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <Text style={[s.resendText, { color: theme.primary }]}>{t('login.resendVerification')}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View style={s.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={t('login.emailPlaceholder')}
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
              placeholder={t('login.passwordPlaceholder')}
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

          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/auth/forgot-password')}>
            <Text style={[s.forgotText, { color: theme.primary }]}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>{t('login.signIn')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Social sign-in */}
        <SocialSignInButtons onError={setError} onLoadingChange={setLoading} />

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t('login.noAccount')}</Text>
          <Link href="/auth/register" asChild>
            <TouchableOpacity>
              <Text style={s.linkText}>{t('login.createOne')}</Text>
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
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 32, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: theme.textSecondary, marginTop: 6 },
  form: { gap: 14 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${theme.error}18`, borderWidth: 1,
    borderColor: `${theme.error}40`, borderRadius: 10, padding: 12,
  },
  errorText: { color: theme.error, fontSize: 14, flex: 1 },
  resendBtn: { alignItems: 'center', paddingTop: 8 },
  resendText: { fontSize: 14, fontWeight: '600' },
  forgotBtn: { alignItems: 'flex-end' },
  forgotText: { fontSize: 14, fontWeight: '600' },
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
});
