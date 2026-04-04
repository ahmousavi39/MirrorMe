import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { analyzePhoto, getSubscriptionStatus } from '@/services/api';
import UsageBanner from '@/components/UsageBanner';
import SettingsModal from '@/components/SettingsModal';
import { SubscriptionStatus } from '@/types/app';
import { RC_PREMIUM_ENTITLEMENT, RC_OFFERING_ID } from '@/constants/config';

// RevenueCat paywall UI — native module, not available in Expo Go
let Purchases: any = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {};
try {
  Purchases = require('react-native-purchases').default;
  const rcUI = require('react-native-purchases-ui');
  RevenueCatUI = rcUI.default;
  PAYWALL_RESULT = rcUI.PAYWALL_RESULT;
} catch { /* Expo Go */ }

export default function AnalyzeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { setResult } = useAnalysis();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Load usage status when screen focuses
  const loadStatus = useCallback(async () => {
    if (loadingStatus) return;
    setLoadingStatus(true);
    try {
      const s = await getSubscriptionStatus();
      setStatus(s);
    } catch {
      // Non-critical — banner just won't show until loaded
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Reload status every time this tab is focused (catches post-purchase state)
  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const pickFromGallery = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to pick photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMime(result.assets[0].mimeType || 'image/jpeg');
    }
  };

  const takePhoto = async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMime(result.assets[0].mimeType || 'image/jpeg');
    }
  };

  const handleAnalyze = async () => {
    if (!imageUri) return;
    setLoading(true);
    try {
      const result = await analyzePhoto(imageUri, imageMime);
      setResult(result);
      // Refresh usage counter after a successful analysis
      loadStatus();
      router.push('/results');
    } catch (e: any) {
      if (e.code === 'LIMIT_REACHED') {
        if (RevenueCatUI) {
          try {
            const offerings = await Purchases.getOfferings();
            const offering = offerings.all[RC_OFFERING_ID] ?? offerings.current;
            const result = await RevenueCatUI.presentPaywallIfNeeded({
              requiredEntitlementIdentifier: RC_PREMIUM_ENTITLEMENT,
              offering,
            });
            if (
              result === PAYWALL_RESULT.PURCHASED ||
              result === PAYWALL_RESULT.RESTORED
            ) {
              Alert.alert('🎉 You\'re Premium!', 'Enjoy unlimited outfit analyses.');
              loadStatus();
            }
          } catch (paywallErr: any) {
            if (!paywallErr.userCancelled) {
              Alert.alert('Purchase failed', paywallErr.message || 'Please try again.');
            }
          }
        } else {
          // Expo Go fallback
          Alert.alert(
            '📊 Weekly Limit Reached',
            'You\'ve used all 2 free uploads for this week.\nUpgrade to Premium for unlimited access.',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Upgrade ✨', onPress: () => router.push('/(tabs)/profile') },
            ]
          );
        }
      } else {
        Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>AI Stylist</Text>
          <Text style={s.headerSub}>Get your outfit rated</Text>
        </View>
        <TouchableOpacity style={s.settingsBtn} onPress={() => setSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Usage banner */}
        {status && (
          <UsageBanner
            used={status.uploadsUsedThisWeek}
            limit={status.uploadsLimitPerWeek}
            isSubscribed={status.isSubscribed}
          />
        )}

        {/* Photo area */}
        <TouchableOpacity
          style={s.photoArea}
          onPress={pickFromGallery}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
          ) : (
            <View style={s.placeholder}>
              <View style={[s.placeholderIcon, { backgroundColor: `${theme.primary}18` }]}>
                <Ionicons name="person-outline" size={56} color={theme.primary} />
              </View>
              <Text style={s.placeholderTitle}>Upload Your Outfit</Text>
              <Text style={s.placeholderSub}>Tap to choose a photo from your gallery</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Pick buttons */}
        <View style={s.pickRow}>
          <TouchableOpacity style={[s.pickBtn, { borderColor: theme.border }]} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={20} color={theme.primary} />
            <Text style={[s.pickBtnText, { color: theme.text }]}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickBtn, { borderColor: theme.border }]} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={20} color={theme.primary} />
            <Text style={[s.pickBtnText, { color: theme.text }]}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Analyze button */}
        <TouchableOpacity
          style={[s.analyzeBtn, !imageUri && s.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!imageUri || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={s.analyzeBtnText}>Analyze My Style</Text>
            </>
          )}
        </TouchableOpacity>

        {loading && (
          <Text style={[s.loadingHint, { color: theme.textSecondary }]}>
            Identifying clothing with AI… this takes ~10 seconds
          </Text>
        )}

        {/* Tips */}
        {!imageUri && (
          <View style={[s.tipsCard, { backgroundColor: theme.card }]}>
            <Text style={[s.tipsTitle, { color: theme.text }]}>📸 Tips for best results</Text>
            {['Full body shot shows the complete outfit', 'Good lighting makes colors accurate', 'Avoid heavy filters', 'Stand in front of a plain background'].map((tip) => (
              <View style={s.tipRow} key={tip}>
                <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                <Text style={[s.tipText, { color: theme.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Loading overlay */}
      {loading && (
        <View style={s.overlay}>
          <View style={[s.overlayCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[s.overlayTitle, { color: theme.text }]}>Analyzing your style…</Text>
            <Text style={[s.overlaySub, { color: theme.textSecondary }]}>
              Identifying clothes · Getting AI feedback
            </Text>
          </View>
        </View>
      )}

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  photoArea: {
    height: 320, borderRadius: 20, overflow: 'hidden',
    backgroundColor: theme.card,
    borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed',
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  placeholderIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  placeholderSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1, height: 46, borderRadius: 12,
    borderWidth: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.card,
  },
  pickBtnText: { fontSize: 15, fontWeight: '600' },
  analyzeBtn: {
    height: 56, borderRadius: 16, backgroundColor: theme.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingHint: { textAlign: 'center', fontSize: 13 },
  tipsCard: { borderRadius: 14, padding: 16, gap: 10 },
  tipsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { fontSize: 14, flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  overlayCard: { borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, width: 240 },
  overlayTitle: { fontSize: 17, fontWeight: '700' },
  overlaySub: { fontSize: 13, textAlign: 'center' },
});
