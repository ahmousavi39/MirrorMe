import '@/services/i18n';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

// ── Auth guard — redirects based on login state ───────────────────────────────────
function RootNavigator() {
  const { user, loading, isNewUser } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="results" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalysisProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AnalysisProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
