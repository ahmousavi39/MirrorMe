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

interface Props {
  onError: (msg: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function SocialSignInButtons({ onError, onLoadingChange }: Props) {
  const { theme } = useTheme();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const socialErrorMessage = (e: any): string => {
    switch (e?.code) {
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Please contact support.';
      case 'auth/invalid-credential':
      case 'auth/invalid-verification-token':
        return 'Sign-in credential was invalid. Please try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
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
      const result = await promptAsync();
      if (result.type === 'success') {
        // expo-auth-session PKCE flow may return idToken, accessToken, or both.
        // GoogleAuthProvider.credential accepts (idToken, accessToken) — use whichever is available.
        const idToken = result.authentication?.idToken ?? null;
        const accessToken = result.authentication?.accessToken ?? null;
        if (!idToken && !accessToken) {
          onError('Google sign-in failed: no token received. Please try again.');
          return;
        }
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await finishSocialAuth(credential as any);
      }
      // type === 'cancel' | 'dismiss' → user backed out, do nothing
    } catch (e: any) {
      console.error('[Google sign-in error]', e?.code, e?.message);
      onError(socialErrorMessage(e) ?? 'Google sign-in failed. Please try again.');
    } finally {
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
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
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
        onError('Apple sign-in failed: no identity token received. Please try again.');
        return;
      }
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({ idToken: identityToken, rawNonce });
      await finishSocialAuth(firebaseCredential as any);
    } catch (e: any) {
      // ERR_REQUEST_CANCELED / ERR_CANCELED = user dismissed the sheet
      if (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED') return;
      console.error('[Apple sign-in error]', e?.code, e?.message);
      onError(socialErrorMessage(e) ?? 'Apple sign-in failed. Please try again.');
    } finally {
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
        <Text style={s.dividerText}>or continue with</Text>
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
            <Text style={s.socialBtnText}>Continue with Google</Text>
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
              <Text style={[s.socialBtnText, { color: '#fff' }]}>Continue with Apple</Text>
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
