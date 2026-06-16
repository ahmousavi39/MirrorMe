import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  applyActionCode, verifyPasswordResetCode, confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type Mode = 'verifyEmail' | 'resetPassword' | 'recoverEmail' | string;
type Status = 'idle' | 'loading' | 'success' | 'error';

export default function EmailActionScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { mode, oobCode } = useLocalSearchParams<{ mode: Mode; oobCode: string }>();

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Password-reset state ───────────────────────────────────────────────────
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // ── Email verification — handle automatically on mount ────────────────────
  useEffect(() => {
    if (mode !== 'verifyEmail') return;
    if (!oobCode) {
      setErrorMsg(t('emailAction.invalidLink'));
      setStatus('error');
      return;
    }
    setStatus('loading');
    applyActionCode(auth, oobCode)
      .then(() => setStatus('success'))
      .catch((e) => {
        const code: string = e?.code ?? '';
        const msg =
          code === 'auth/expired-action-code' ? t('emailAction.linkExpired')
          : code === 'auth/invalid-action-code' ? t('emailAction.linkAlreadyUsed')
          : t('emailAction.verifyFailed');
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [mode, oobCode]);

  // ── Password reset — verify the code first to surface the email ───────────
  useEffect(() => {
    if (mode !== 'resetPassword') return;
    if (!oobCode) {
      setErrorMsg(t('emailAction.invalidLink'));
      setStatus('error');
      return;
    }
    setStatus('loading');
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setResetEmail(email);
        setStatus('idle');
      })
      .catch((e) => {
        const code: string = e?.code ?? '';
        const msg =
          code === 'auth/expired-action-code' ? t('emailAction.linkExpired')
          : code === 'auth/invalid-action-code' ? t('emailAction.linkAlreadyUsed')
          : t('emailAction.resetVerifyFailed');
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [mode, oobCode]);

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      setErrorMsg(t('emailAction.fillAllFields'));
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg(t('emailAction.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('emailAction.passwordMismatch'));
      return;
    }
    setErrorMsg('');
    setStatus('loading');
    try {
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setStatus('success');
    } catch (e: any) {
      const code: string = e?.code ?? '';
      const msg =
        code === 'auth/expired-action-code' ? t('emailAction.linkExpired')
        : code === 'auth/invalid-action-code' ? t('emailAction.linkAlreadyUsed')
        : code === 'auth/weak-password' ? t('emailAction.passwordMinLength')
        : t('emailAction.resetFailed');
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const s = styles(theme);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[s.subtitle, { marginTop: 16 }]}>
          {mode === 'verifyEmail' ? t('emailAction.verifying') : t('emailAction.verifying')}
        </Text>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <View style={[s.container, s.centered, { padding: 32 }]}>
        <View style={[s.iconCircle, { backgroundColor: theme.error }]}>
          <Ionicons name="close-outline" size={44} color="#fff" />
        </View>
        <Text style={[s.title, { marginTop: 24, textAlign: 'center' }]}>{t('emailAction.errorTitle')}</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>{errorMsg}</Text>
        <TouchableOpacity style={[s.button, { marginTop: 40, width: '100%' }]} onPress={() => router.replace('/auth/login')}>
          <Text style={s.buttonText}>{t('emailAction.backToSignIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Email verified success ─────────────────────────────────────────────────
  if (mode === 'verifyEmail' && status === 'success') {
    return (
      <View style={[s.container, s.centered, { padding: 32 }]}>
        <View style={[s.iconCircle, { backgroundColor: '#22C55E' }]}>
          <Ionicons name="checkmark-outline" size={44} color="#fff" />
        </View>
        <Text style={[s.title, { marginTop: 24, textAlign: 'center' }]}>{t('emailAction.verifiedTitle')}</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
          {t('emailAction.verifiedMsg')}
        </Text>
        <TouchableOpacity style={[s.button, { marginTop: 40, width: '100%' }]} onPress={() => router.replace('/auth/login')}>
          <Text style={s.buttonText}>{t('emailAction.signIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Password reset success ─────────────────────────────────────────────────
  if (mode === 'resetPassword' && status === 'success') {
    return (
      <View style={[s.container, s.centered, { padding: 32 }]}>
        <View style={[s.iconCircle, { backgroundColor: '#22C55E' }]}>
          <Ionicons name="checkmark-outline" size={44} color="#fff" />
        </View>
        <Text style={[s.title, { marginTop: 24, textAlign: 'center' }]}>{t('emailAction.resetSuccessTitle')}</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
          {t('emailAction.resetSuccessMsg')}
        </Text>
        <TouchableOpacity style={[s.button, { marginTop: 40, width: '100%' }]} onPress={() => router.replace('/auth/login')}>
          <Text style={s.buttonText}>{t('emailAction.signIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Password reset form ────────────────────────────────────────────────────
  if (mode === 'resetPassword') {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.iconCircle}>
              <Ionicons name="lock-open-outline" size={44} color="#fff" />
            </View>
            <Text style={s.title}>{t('emailAction.resetTitle')}</Text>
            {resetEmail ? (
              <Text style={s.subtitle}>{t('emailAction.resetFor', { email: resetEmail })}</Text>
            ) : null}
          </View>

          <View style={s.form}>
            {errorMsg ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={s.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t('emailAction.newPasswordPlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.placeholder} />
              </TouchableOpacity>
            </View>

            <View style={s.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t('emailAction.confirmPasswordPlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[s.button, status === 'loading' && s.buttonDisabled]}
              onPress={handlePasswordReset}
              disabled={status === 'loading'}
            >
              {status === 'loading'
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.buttonText}>{t('emailAction.savePassword')}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Unknown / unsupported mode ─────────────────────────────────────────────
  return (
    <View style={[s.container, s.centered, { padding: 32 }]}>
      <Text style={s.subtitle}>{t('emailAction.invalidLink')}</Text>
      <TouchableOpacity style={[s.button, { marginTop: 24 }]} onPress={() => router.replace('/auth/login')}>
        <Text style={s.buttonText}>{t('emailAction.backToSignIn')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 32 },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: 'center',
      marginTop: 8,
    },
    form: { gap: 16 },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      height: 52,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: theme.text },
    eyeBtn: { padding: 4 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.errorBg ?? theme.card,
      borderRadius: 10,
      padding: 12,
    },
    errorText: { fontSize: 13, color: theme.error, flex: 1 },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
