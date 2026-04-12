import { useState, useCallback, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Platform, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { analyzePhoto, cancelAnalysis, getSubscriptionStatus } from '@/services/api';
import SettingsModal from '@/components/SettingsModal';
import CustomAlert from '@/components/CustomAlert';
import PremiumGateModal from '@/components/PremiumGateModal';
import { Occasion, SubscriptionStatus } from '@/types/app';
import { useTranslation } from 'react-i18next';
import i18n from '@/services/i18n';

const OCCASION_KEYS: { key: Occasion; emoji: string }[] = [
  { key: 'casual',    emoji: '🛍️' },
  { key: 'work',      emoji: '💼' },
  { key: 'school',    emoji: '🎓' },
  { key: 'date',      emoji: '💛' },
  { key: 'night_out', emoji: '🌙' },
  { key: 'interview', emoji: '📋' },
  { key: 'formal',    emoji: '🧐' },
  { key: 'sport',     emoji: '🏋️' },
  { key: 'travel',    emoji: '✈️' },
];

export default function AnalyzeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { setResult, setImageUri } = useAnalysis();
  const router = useRouter();
  const { t } = useTranslation();

  const OCCASIONS = OCCASION_KEYS.map((o) => ({ ...o, label: t(`occasions.${o.key}`) }));

  const [imageUri, setImageUriState] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(false);
  const [premiumGateVisible, setPremiumGateVisible] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; icon: 'info' | 'error' | 'success' | 'warning' }>({
    visible: false, title: '', message: '', icon: 'info',
  });
  const showAlert = (title: string, message: string, icon: 'info' | 'error' | 'success' | 'warning' = 'info') =>
    setCustomAlert({ visible: true, title, message, icon });
  const abortRef = useRef<AbortController | null>(null);
  const cancelTokenRef = useRef<string | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<'detecting' | 'analyzing'>('detecting');
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Compress any image (including HEIC) to JPEG on-device before upload
  const compressImage = async (uri: string): Promise<{ uri: string; mime: string }> => {
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { uri: compressed.uri, mime: 'image/jpeg' };
    } catch {
      // If manipulation fails, send original
      return { uri, mime: 'image/jpeg' };
    }
  };

  const pickFromGallery = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      showAlert(t('common.permissionNeeded'), t('analyze.galleryPermissionMsg'), 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, mime } = await compressImage(result.assets[0].uri);
      setImageUriState(uri);
      setImageMime(mime);
    }
  };

  const takePhoto = async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      showAlert(t('common.permissionNeeded'), t('analyze.cameraPermissionMsg'), 'warning');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, mime } = await compressImage(result.assets[0].uri);
      setImageUriState(uri);
      setImageMime(mime);
    }
  };

  const handleAnalyze = async () => {
    if (!imageUri) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const cToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    cancelTokenRef.current = cToken;
    setLoading(true);
    setAnalysisPhase('detecting');
    phaseTimerRef.current = setTimeout(() => setAnalysisPhase('analyzing'), 3500);
    try {
      const [sw, atw] = await Promise.all([
        AsyncStorage.getItem('@shareWardrobe'),
        AsyncStorage.getItem('@addToWardrobe'),
      ]);
      const result = await analyzePhoto(imageUri, imageMime, occasion, {
        shareWardrobe: sw !== 'false',
        addToWardrobe: atw !== 'false',
      }, controller.signal, cToken, i18n.language);
      setImageUri(imageUri);
      setResult(result);
      // Refresh usage counter after a successful analysis
      loadStatus();
      router.push('/results');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // User cancelled — silently stop
        return;
      }
      if (e.code === 'LIMIT_REACHED') {
        setPremiumGateVisible(true);
      } else if (e.code === 'PREMIUM_LIMIT_REACHED') {
        showAlert(t('analyze.monthlyLimitReached'), t('analyze.monthlyLimitMsg'), 'info');
      } else if (e.code === 'NO_PERSON') {
        showAlert(t('analyze.noPersonTitle'), t('analyze.noPersonMsg'), 'warning');
      } else if (e.code === 'NO_OUTFIT') {
        showAlert(t('analyze.noOutfitTitle'), t('analyze.noOutfitMsg'), 'warning');
      } else {
        showAlert(t('analyze.errorTitle'), e.message || t('common.tryAgain'), 'error');
      }
    } finally {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setLoading(false);
      setAnalysisPhase('detecting');
    }
  };

  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('analyze.title')}</Text>
          <Text style={s.headerSub}>{t('analyze.subtitle')}</Text>
        </View>
        <TouchableOpacity style={s.settingsBtn} onPress={() => setSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
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
              <Text style={s.placeholderTitle}>{t('analyze.uploadTitle')}</Text>
              <Text style={s.placeholderSub}>{t('analyze.uploadSub')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Pick buttons */}
        <View style={s.pickRow}>
          <TouchableOpacity style={[s.pickBtn, { borderColor: theme.border }]} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={20} color={theme.primary} />
            <Text style={[s.pickBtnText, { color: theme.text }]}>{t('analyze.gallery')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickBtn, { borderColor: theme.border }]} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={20} color={theme.primary} />
            <Text style={[s.pickBtnText, { color: theme.text }]}>{t('analyze.camera')}</Text>
          </TouchableOpacity>
        </View>

        {/* Occasion picker */}
        <View style={s.occasionSection}>
          <Text style={[s.occasionTitle, { color: theme.text }]}>{t('analyze.stylingFor')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.occasionRow}>
            {OCCASIONS.map((o) => {
              const selected = occasion === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    s.occasionChip,
                    { borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? `${theme.primary}18` : theme.card },
                  ]}
                  onPress={() => setOccasion(selected ? null : o.key)}
                  activeOpacity={0.75}
                >
                  <Text style={s.occasionEmoji}>{o.emoji}</Text>
                  <Text style={[s.occasionLabel, { color: selected ? theme.primary : theme.text }]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
              <Text style={s.analyzeBtnText}>
                {occasion ? t('analyze.analyzeBtnOccasion', { occasion: OCCASIONS.find(o => o.key === occasion)?.label }) : t('analyze.analyzeBtn')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info link */}
        <TouchableOpacity style={s.infoLink} onPress={() => setTipsVisible(true)} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={12} color={theme.textSecondary} />
          <Text style={[s.infoLinkText, { color: theme.textSecondary }]}>{t('analyze.howItWorks')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Loading overlay */}
      {loading && (
        <View style={s.overlay}>
          <View style={[s.overlayCard, { backgroundColor: theme.card }]}>
            <View style={{ width: 212, height: 212, justifyContent: 'center', alignItems: 'center' }}>
              <LottieView
                key={analysisPhase}
                source={
                  analysisPhase === 'detecting'
                    ? require('@/assets/sales_man_v2.json')
                    : require('@/assets/Searching.json')
                }
                autoPlay
                loop
                style={{ width: analysisPhase === 'detecting' ? 260 : 140, height: analysisPhase === 'detecting' ? 260 : 140 }}
              />
            </View>
            <Text style={[s.overlaySub, { color: theme.textSecondary }]}>
              {analysisPhase === 'detecting' ? t('analyze.detecting') : t('analyze.analyzing')}
            </Text>
            <TouchableOpacity
              style={s.overlayClose}
              onPress={() => {
                abortRef.current?.abort();
                if (cancelTokenRef.current) cancelAnalysis(cancelTokenRef.current);
                if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
                setLoading(false);
                setAnalysisPhase('detecting');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <PremiumGateModal
        visible={premiumGateVisible}
        onClose={() => setPremiumGateVisible(false)}
        onUpgraded={() => { loadStatus(); showAlert(t('analyze.premiumSuccess'), t('analyze.premiumSuccessMsg'), 'success'); }}
      />

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        onClose={() => setCustomAlert((a) => ({ ...a, visible: false }))}
      />

      {/* Tips & disclaimer modal */}
      <Modal visible={tipsVisible} transparent animationType="fade" onRequestClose={() => setTipsVisible(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setTipsVisible(false)}>
          <TouchableOpacity style={[s.modalCard, { backgroundColor: theme.card }]} activeOpacity={1}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.text }]}>{t('analyze.tipsTitle')}</Text>
              <TouchableOpacity onPress={() => setTipsVisible(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {[
              t('analyze.tip1'),
              t('analyze.tip2'),
              t('analyze.tip3'),
              t('analyze.tip4'),
            ].map((tip) => (
              <View style={s.tipRow} key={tip}>
                <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                <Text style={[s.tipText, { color: theme.textSecondary }]}>{tip}</Text>
              </View>
            ))}
            <View style={[s.disclaimerBox, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}30` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.primary} style={{ marginTop: 1 }} />
              <Text style={[s.disclaimerText, { color: theme.textSecondary }]}>
                {t('analyze.disclaimer')}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    height: 370, borderRadius: 20, overflow: 'hidden',
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
  infoLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: -8, paddingVertical: 2 },
  infoLinkText: { fontSize: 11 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { fontSize: 14, flex: 1, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 20, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  disclaimerBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  disclaimerText: { fontSize: 13, flex: 1, lineHeight: 19 },
  // Occasion picker
  occasionSection: { gap: 10 },
  occasionTitle: { fontSize: 15, fontWeight: '700' },
  occasionRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  occasionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5,
  },
  occasionEmoji: { fontSize: 16 },
  occasionLabel: { fontSize: 14, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  overlayCard: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', gap: 8, width: 260, height: 260, justifyContent: 'center' },
  overlayClose: { position: 'absolute', top: 12, right: 12 },
  overlaySub: { fontSize: 13, textAlign: 'center', paddingBottom: 16 },
});
