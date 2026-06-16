import '@/services/i18n';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';

// ── Parse a Firebase Auth action URL and navigate to the in-app handler ───────────
// Firebase sends links like:
//   https://ai-stylist-88cbb.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=XXX
// With handleCodeInApp:true the OS opens the app instead of a browser; we
// intercept here and push the dedicated email-action screen.
function handleFirebaseAuthUrl(url: string, router: ReturnType<typeof useRouter>) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname !== 'ai-stylist-88cbb.firebaseapp.com' ||
      !parsed.pathname.startsWith('/__/auth/action')
    ) return;

    const mode = parsed.searchParams.get('mode');
    const oobCode = parsed.searchParams.get('oobCode');

    if (!mode || !oobCode) return;
    if (!['verifyEmail', 'resetPassword', 'recoverEmail'].includes(mode)) return;

    router.push({
      pathname: '/auth/email-action',
      params: { mode, oobCode },
    });
  } catch {
    // Not a valid URL — ignore
  }
}

// ── Auth guard — redirects based on login state ───────────────────────────────────
function RootNavigator() {
  const { user, loading, isNewUser } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // ── Firebase email action deep-link handler (replaces Dynamic Links) ──────
  useEffect(() => {
    // Handle URL when app is already open (foreground / background)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleFirebaseAuthUrl(url, router);
    });

    // Handle URL when app is launched cold by tapping the link
    Linking.getInitialURL().then((url) => {
      if (url) handleFirebaseAuthUrl(url, router);
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    const inResults = segments[0] === 'results';
    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace(isNewUser ? '/onboarding' : '/(tabs)');
    } else if (user && isNewUser && !inOnboarding) {
      // Came back to app mid-onboarding (e.g. app killed)
      router.replace('/onboarding');
    } else if (user && !isNewUser && !inTabs && !inResults) {
      // Reopened app as a returning user — land on index, redirect to tabs
      router.replace('/(tabs)');
    }
  }, [user, loading, isNewUser, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="results" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <AuthProvider>
        <AnalysisProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AnalysisProvider>
      </AuthProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
