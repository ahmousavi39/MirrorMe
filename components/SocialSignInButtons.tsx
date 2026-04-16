import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider, OAuthProvider, signInWithCredential, getAdditionalUserInfo,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { setPendingOnboarding } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/constants/config';
import { useTranslation } from 'react-i18next';

interface Props {
  onError: (msg: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function SocialSignInButtons({ onError, onLoadingChange }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [request, googleResponse, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  // ── Process Google response via state (NOT promptAsync return value) ─────────
  // expo-auth-session resolves promptAsync() as soon as the OAuth redirect
  // arrives — before the async PKCE code exchange finishes — so
  // result.authentication is always null at that point.
  // The 'googleResponse' state is only set AFTER the exchange completes,
  // making it the only reliable place to read idToken / accessToken.
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      setGoogleLoading(false);
      onLoadingChange?.(false);
      return;
    }

    if (googleResponse.type === 'error') {
      setGoogleLoading(false);
      onLoadingChange?.(false);
      onError(t('social.googleFailed'));
      return;
    }

    if (googleResponse.type !== 'success') return;

    (async () => {
      try {
        const idToken     = googleResponse.authentication?.idToken
                         ?? (googleResponse.params as any)?.id_token
                         ?? null;
        const accessToken = googleResponse.authentication?.accessToken
                         ?? (googleResponse.params as any)?.access_token
                         ?? null;

        if (!idToken && !accessToken) {
          onError(t('social.googleNoToken'));
          setGoogleLoading(false);
          onLoadingChange?.(false);
          return;
        }
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await finishSocialAuth(credential as any);
        // Keep loading=true — AuthContext is still fetching backend data.
        // The component will unmount on navigation, clearing state naturally.
      } catch (e: any) {
        console.error('[Google sign-in error]', e?.code, e?.message);
        onError(socialErrorMessage(e) ?? t('social.googleFailed'));
        setGoogleLoading(false);
        onLoadingChange?.(false);
      }
    })();
  }, [googleResponse]);

  const socialErrorMessage = (e: any): string => {
    switch (e?.code) {
      case 'auth/operation-not-allowed':
        return t('social.methodNotEnabled');
      case 'auth/invalid-credential':
      case 'auth/invalid-verification-token':
        return t('social.invalidCredential');
      case 'auth/network-request-failed':
        return t('social.networkError');
      case 'auth/too-many-requests':
        return t('social.tooManyRequests');
      default:
        return null as any;
    }
  };

  const finishSocialAuth = async (
    firebaseCredential: ReturnType<typeof GoogleAuthProvider.credential>,
  ) => {
    const userCredential = await signInWithCredential(auth, firebaseCredential as any);
    const info = getAdditionalUserInfo(userCredential);
    if (info?.isNewUser) {
      setPendingOnboarding(true);
    }
  };

  // ── Google ──────────────────────────────────────────────────────────────────
  const handleGooglePress = async () => {
    setGoogleLoading(true);
    onLoadingChange?.(true);
    try {
      await promptAsync();
      // Token handling + loading reset are done in the googleResponse useEffect
    } catch (e: any) {
      console.error('[Google prompt error]', e?.code, e?.message);
      onError(t('social.googleFailed'));
      setGoogleLoading(false);
      onLoadingChange?.(false);
    }
  };

  // ── Apple ───────────────────────────────────────────────────────────────────
  const handleApplePress = async () => {
    setAppleLoading(true);
    onLoadingChange?.(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = (await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      )).toLowerCase();
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        // Pass the HASHED nonce to Apple — Apple embeds it in the JWT as-is.
        // Pass the RAW nonce to Firebase — Firebase hashes it locally and compares.
        nonce: hashedNonce,
      });
      const { identityToken } = appleCredential;
      if (!identityToken) {
        onError(t('social.appleNoToken'));
        return;
      }
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({ idToken: identityToken, rawNonce });
      await finishSocialAuth(firebaseCredential as any);
      // Keep loading=true — AuthContext is still fetching backend data.
      // The component will unmount on navigation, clearing state naturally.
    } catch (e: any) {
      // ERR_REQUEST_CANCELED / ERR_CANCELED = user dismissed the sheet
      if (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED') {
        setAppleLoading(false);
        onLoadingChange?.(false);
        return;
      }
      console.error('[Apple sign-in error]', e?.code, e?.message);
      onError(socialErrorMessage(e) ?? t('social.appleFailed'));
      setAppleLoading(false);
      onLoadingChange?.(false);
    }
  };

  const s = styles(theme);

  return (
    <View style={s.container}>
      {/* ── OR divider ─────────────────────────────────────────────────────── */}
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>{t('social.orContinueWith')}</Text>
        <View style={s.dividerLine} />
      </View>

      {/* ── Google ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.socialBtn}
        onPress={handleGooglePress}
        disabled={!request || googleLoading || appleLoading}
        activeOpacity={0.8}
      >
        {googleLoading ? (
          <ActivityIndicator color={theme.text} size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={s.socialBtnText}>{t('social.continueWithGoogle')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* ── Apple (iOS only, when available) ───────────────────────────────── */}
      {appleAvailable && (
        <TouchableOpacity
          style={[s.socialBtn, s.appleBtn]}
          onPress={handleApplePress}
          disabled={appleLoading || googleLoading}
          activeOpacity={0.8}
        >
          {appleLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={[s.socialBtnText, { color: '#fff' }]}>{t('social.continueWithApple')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { gap: 12 },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.textSecondary, fontSize: 13 },
  socialBtn: {
    height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: theme.inputBackground,
    borderWidth: 1, borderColor: theme.border,
  },
  socialBtnText: { color: theme.text, fontSize: 16, fontWeight: '600' },
  appleBtn: { backgroundColor: '#000', borderColor: '#000' },
});
