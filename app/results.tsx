import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Platform, Image, Animated, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, ActivityIndicator, PanResponder,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { ClothingItem, Occasion } from '@/types/app';
import { updateWardrobeItem, composeShareImage } from '@/services/api';
import CustomAlert from '@/components/CustomAlert';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const OCCASION_ICONS: Record<Occasion, string> = {
  casual:    'bag-handle-outline',
  work:      'briefcase-outline',
  school:    'school-outline',
  date:      'heart-outline',
  night_out: 'moon-outline',
  interview: 'document-text-outline',
  formal:    'ribbon-outline',
  sport:     'barbell-outline',
  travel:    'airplane-outline',
};

const OCCASION_COLORS: Record<Occasion, string> = {
  casual:    '#FF9F0A',
  work:      '#42b1ed',
  school:    '#30D158',
  date:      '#FF2D55',
  night_out: '#7B61FF',
  interview: '#00C7BE',
  formal:    '#FFD60A',
  sport:     '#FF6B35',
  travel:    '#5AC8FA',
};

const OCCASION_ORDER: Occasion[] = [
  'casual', 'work', 'school', 'date', 'night_out', 'interview', 'formal', 'sport', 'travel',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const IS_IPAD = Platform.OS === 'ios' && Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= 768;
const PHOTO_HEIGHT = IS_IPAD ? Math.round(Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.88) : Math.round(SCREEN_WIDTH * 1.1);

function getScoreColor(score: number) {
  if (score >= 8) return '#30D158';
  if (score >= 6) return '#FF9F0A';
  return '#FF453A';
}

function ClothingChip({ item }: { item: ClothingItem }) {
  const { theme } = useTheme();
  const detail = [item.color, item.material, item.fit].filter(Boolean).join(' · ');
  return (
    <View style={[chipStyles.chip, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}30` }]}>
      <Text style={[chipStyles.name, { color: theme.primary }]}>{item.category}</Text>
      {detail ? <Text style={[chipStyles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  name: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 11, marginTop: 2 },
});

// Mirrors the backend wardrobeKey() exactly — all 6 fields so keys are consistent.
function wardrobeKeyFor(
  category: string,
  color: string | null,
  fit: string | null,
  material: string | null,
  pattern: string | null,
  style: string | null,
): string {
  const clean = (s: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
  const parts = [
    clean(category) || 'item',
    clean(color),
    clean(fit),
    clean(material),
    clean(pattern),
    clean(style),
  ].filter(Boolean);
  return parts.join('_').slice(0, 120);
}

// ── Clothing edit bottom sheet ────────────────────────────────────────────────
interface EditSheetProps {
  item: ClothingItem;
  originalKey: string;
  onSave: (updated: ClothingItem, newKey: string) => void;
  onClose: () => void;
  onAlert: (title: string, message: string, icon?: 'info' | 'error' | 'success' | 'warning') => void;
}

function ClothingEditSheet({ item, originalKey, onSave, onClose, onAlert }: EditSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [category, setCategory] = useState(item.category ?? '');
  const [color, setColor]       = useState(item.color ?? '');
  const [fit, setFit]           = useState(item.fit ?? '');
  const [material, setMaterial] = useState(item.material ?? '');
  const [pattern, setPattern]   = useState(item.pattern ?? '');
  const [style, setStyle]       = useState(item.style ?? '');
  const [saving, setSaving]     = useState(false);

  const anim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const dismiss = (callback?: () => void) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => callback?.());
  };

  const handleClose = () => dismiss(onClose);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => dragY.setValue(0),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) dragY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          dismiss(onClose);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start(),
    })
  ).current;

  const handleSave = async () => {
    const trimmed = {
      category: category.trim(),
      color:    color.trim()    || null,
      fit:      fit.trim()      || null,
      material: material.trim() || null,
      pattern:  pattern.trim()  || null,
      style:    style.trim()    || null,
    };
    if (!trimmed.category) {
      onAlert(t('results.categoryRequired'), t('results.categoryRequiredMsg'), 'warning');
      return;
    }

    // Nothing changed — just close without any request
    const unchanged =
      trimmed.category === (item.category ?? '').trim() &&
      (trimmed.color    ?? '') === (item.color    ?? '').trim() &&
      (trimmed.fit      ?? '') === (item.fit      ?? '').trim() &&
      (trimmed.material ?? '') === (item.material ?? '').trim() &&
      (trimmed.pattern  ?? '') === (item.pattern  ?? '').trim() &&
      (trimmed.style    ?? '') === (item.style    ?? '').trim();
    if (unchanged) { dismiss(onClose); return; }

    setSaving(true);
    try {
      const updated = await updateWardrobeItem(originalKey, { ...trimmed, source: 'results' });
      // Use the server-returned id as the new key — client-side wardrobeKeyFor
      // does not handle non-ASCII (e.g. Chinese) so we must trust the server.
      const newKey = updated.id;
      dismiss(() => onSave({ ...item, ...trimmed } as ClothingItem, newKey));
    } catch (e: any) {
      onAlert(t('results.saveFailed'), e.message ?? t('results.saveFailedMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const es = editStyles(theme);

  return (
    <Modal visible animationType="none" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={es.overlay}
      >
        <Animated.View style={[es.backdrop, { opacity: anim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        <Animated.View
          style={[es.sheet, { backgroundColor: theme.card, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }, { translateY: dragY }] }]}
        >
          {/* Handle */}
          <View style={es.handleContainer} {...panResponder.panHandlers}>
            <View style={[es.handle, { backgroundColor: theme.border }]} />
          </View>

          {/* Header */}
          <View style={es.sheetHeader}>
            <Text style={[es.sheetTitle, { color: theme.text }]}>{t('results.editItem')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={es.fields}>
            {[
              { label: t('wardrobe.fieldCategory'), value: category, set: setCategory, placeholder: t('wardrobe.phCategory') },
              { label: t('wardrobe.fieldColor'),    value: color,    set: setColor,    placeholder: t('wardrobe.phColor') },
              { label: t('wardrobe.fieldFit'),      value: fit,      set: setFit,      placeholder: t('wardrobe.phFit') },
              { label: t('wardrobe.fieldMaterial'), value: material, set: setMaterial, placeholder: t('wardrobe.phMaterial') },
              { label: t('wardrobe.fieldPattern'),  value: pattern,  set: setPattern,  placeholder: t('wardrobe.phPattern') },
              { label: t('wardrobe.fieldStyle'),    value: style,    set: setStyle,    placeholder: t('wardrobe.phStyle') },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} style={es.fieldRow}>
                <Text style={[es.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                <TextInput
                  style={[es.fieldInput, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
                  value={value}
                  onChangeText={set}
                  placeholder={placeholder}
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                />
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[es.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={es.saveBtnText}>{t('common.saveChanges')}</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = (theme: any) => StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end' },
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, maxHeight: '85%' },
  handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 40 },
  handle:          { width: 40, height: 4, borderRadius: 2 },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle:      { fontSize: 17, fontWeight: '700' },
  fields:          { paddingHorizontal: 20, gap: 14, paddingBottom: 6 },
  fieldRow:        { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  saveBtn:    { marginHorizontal: 20, marginTop: 18, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ── Photo slide-up modal ──────────────────────────────────────────────────────
interface PhotoSlideModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

function PhotoSlideModal({ visible, imageUri, onClose }: PhotoSlideModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  // Keep modal mounted until the closing animation finishes
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      setMounted(true);
      // Give one frame for the Modal to render before animating
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) { setMounted(false); onClose(); }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => dragY.setValue(0),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) dragY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start(),
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[photoModalStyles.overlay, { opacity: slideAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          photoModalStyles.sheet,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [Dimensions.get('window').height, 0],
                }),
              },
              { translateY: dragY },
            ],
          },
        ]}
      >
        {/* Handle */}
        <View style={photoModalStyles.handleContainer} {...panResponder.panHandlers}>
          <View style={photoModalStyles.handle} />
        </View>

        {/* Close button */}
        <TouchableOpacity style={photoModalStyles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>

        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={photoModalStyles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={photoModalStyles.placeholder}>
            <Ionicons name="shirt-outline" size={64} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const photoModalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '88%',
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  handleContainer: {
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  image: {
    width: '100%',
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function ResultsScreen() {
  const { theme } = useTheme();
  const { result, imageUri, setResult, clear } = useAnalysis();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const s = makeStyles(theme);
  const insets = useSafeAreaInsets();

  const getScoreLabel = (score: number): string => {
    if (score >= 9) return t('results.scoreLabels.styleIcon');
    if (score >= 8) return t('results.scoreLabels.lookingGreat');
    if (score >= 7) return t('results.scoreLabels.solidLook');
    if (score >= 6) return t('results.scoreLabels.prettyGood');
    if (score >= 5) return t('results.scoreLabels.needsWork');
    return t('results.scoreLabels.majorMakeover');
  };

  // Local editable copy of clothing items — stays in sync with context on edit
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addToWardrobe, setAddToWardrobe] = useState(true);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; icon: 'info' | 'error' | 'success' | 'warning' }>({ visible: false, title: '', message: '', icon: 'info' });
  const showAlert = (title: string, message: string, icon: 'info' | 'error' | 'success' | 'warning' = 'info') =>
    setCustomAlert({ visible: true, title, message, icon });

  const pagerRef = useRef<PagerView>(null);
  const scrollPos = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('@addToWardrobe').then((val) => setAddToWardrobe(val !== 'false'));
  }, []);

  // Fade-in animation for the whole page
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  // Fire review prompt at milestone closes — covers back button, swipe gesture, and router.back()
  const REVIEW_MILESTONES = new Set([1, 3, 5, 8, 10, 15, 20, 25, 30]);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async () => {
      const raw = await AsyncStorage.getItem('@resultCloseCount');
      const next = (parseInt(raw ?? '0', 10) || 0) + 1;
      await AsyncStorage.setItem('@resultCloseCount', String(next));
      if (REVIEW_MILESTONES.has(next)) {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          await StoreReview.requestReview();
        }
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleBack = () => router.back();

  const handleAnalyzeAgain = () => {
    clear();
    router.replace('/(tabs)');
  };

  const handleShare = async () => {
    if (!result) return;
    const scoreColor = getScoreColor(result.score);
    const shareText = `${result.score}/10 — ${getScoreLabel(result.score)}\n\n"${result.feedback}"\n\nRated by MirrorMe`;
    // Prefer the remote Firebase URL for server-side composition;
    // fall back to the local file URI only if unavailable.
    const remoteUri = result.imageUrl;
    const localFallbackUri = imageUri;
    try {
      let localUri: string | undefined;

      if (remoteUri) {
        // Compose score overlay server-side
        try {
          const base64DataUri = await composeShareImage(
            remoteUri,
            result.score,
            getScoreLabel(result.score),
            scoreColor,
          );
          const dest = `${FileSystem.cacheDirectory}share_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(dest, base64DataUri.replace(/^data:image\/jpeg;base64,/, ''), {
            encoding: FileSystem.EncodingType.Base64,
          });
          localUri = dest;
        } catch {
          // Fallback: share original photo without overlay
          const dest = `${FileSystem.cacheDirectory}share_${Date.now()}.jpg`;
          const { uri: downloaded } = await FileSystem.downloadAsync(remoteUri, dest);
          localUri = downloaded;
        }
      } else if (localFallbackUri) {
        localUri = localFallbackUri;
      }

      if (localUri) {
        if (Platform.OS === 'ios') {
          await Share.share({ url: localUri, message: shareText });
        } else {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', dialogTitle: 'Share your style' });
          } else {
            await Share.share({ message: shareText });
          }
        }
      } else {
        await Share.share({ message: shareText });
      }
    } catch { /* dismissed */ }
  };

  if (!result) {
    return (
      <View style={[s.empty, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{t('results.noResult')}</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('results.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreColor = getScoreColor(result.score);
  const hasOccasionTips = !!(result.occasion && (result.occasionTips?.length ?? 0) > 0);
  const occasionIcon = (result.occasion ? OCCASION_ICONS[result.occasion] : 'calendar') as any;
  const TAB_COUNT = hasOccasionTips ? 5 : 4;

  // Only use localized items when the array length matches clothingItems — prevents
  // index mismatches when loading from history where translation may have failed.
  const displayClothingItems =
    Array.isArray(result.clothingItemsLocalized) &&
    result.clothingItemsLocalized.length === result.clothingItems.length
      ? result.clothingItemsLocalized
      : result.clothingItems;

  // Build pages as a guaranteed-real-element array — PagerView crashes on false/null children
  const pagerPages = [
    <ScrollView key="0" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>
      <View style={[s.card, { backgroundColor: theme.card }]}>
        <View style={s.scoreRow}>
          <View style={[s.scoreBadge, { borderColor: scoreColor, shadowColor: scoreColor }]}>
            <Text style={[s.scoreNumber, { color: scoreColor }]}>{result.score.toFixed(1)}</Text>
            <Text style={[s.scoreOutOf, { color: theme.textSecondary }]}>/10</Text>
          </View>
          <View style={s.scoreMeta}>
            <Text style={[s.scoreLabel, { color: scoreColor }]}>{getScoreLabel(result.score)}</Text>
            {result.occasion && OCCASION_ICONS[result.occasion] ? (
              <View style={[s.occasionBadge, { backgroundColor: `${OCCASION_COLORS[result.occasion]}1A`, borderColor: `${OCCASION_COLORS[result.occasion]}40` }]}>
                <Ionicons name={OCCASION_ICONS[result.occasion] as any} size={15} color={OCCASION_COLORS[result.occasion]} />
                <Text style={[s.occasionText, { color: OCCASION_COLORS[result.occasion] }]}>
                  {t(`occasions.${result.occasion}`)}
                </Text>
              </View>
            ) : (
              <Text style={[s.scoreSubLabel, { color: theme.textSecondary }]}>{t('results.styleReport')}</Text>
            )}
          </View>
        </View>
      </View>
      {result.colorPalette && result.colorPalette.length > 0 && (
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name="color-palette" size={16} color={theme.primary} />
            </View>
            <Text style={[s.cardTitle, { color: theme.text }]}>{t('results.colorPalette')}</Text>
          </View>
          <View style={s.paletteRow}>
            {result.colorPalette.map((hex, i) => (
              <View key={i} style={s.paletteItem}>
                <View style={[s.paletteSwatch, { backgroundColor: hex }]} />
                <Text style={[s.paletteHex, { color: theme.textSecondary }]}>{hex.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
    </ScrollView>,

    <ScrollView key="1" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>
      <View style={[s.card, { backgroundColor: theme.card }]}>
        <View style={s.cardHeader}>
          <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
            <Ionicons name="chatbubble-ellipses" size={16} color={theme.primary} />
          </View>
          <Text style={[s.cardTitle, { color: theme.text }]}>{t('results.aiFeedback')}</Text>
        </View>
        <Text style={[s.feedbackText, { color: theme.text }]}>{result.feedback}</Text>
      </View>
      <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
    </ScrollView>,

    <ScrollView key="2" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>
      {result.occasionScores && (
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name="calendar-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[s.cardTitle, { color: theme.text }]}>{t('results.occasionFit')}</Text>
          </View>
          <View style={s.occasionList}>
            {OCCASION_ORDER.map((key) => {
              const sc: number = (result.occasionScores as any)?.[key] ?? 0;
              const color = sc >= 8 ? '#30D158' : sc >= 6 ? '#FF9F0A' : '#FF453A';
              const isSelected = result.occasion === key;
              return (
                <View key={key} style={s.occasionRow}>
                  <Ionicons name={OCCASION_ICONS[key] as any} size={15} color={OCCASION_COLORS[key]} style={s.occasionRowEmoji} />
                  <Text style={[s.occasionRowLabel, { color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '500' }]}>
                    {t(`occasions.${key}`)}
                  </Text>
                  <View style={[s.occasionBarBg, { backgroundColor: `${color}20` }]}>
                    <View style={[s.occasionBarFill, { width: `${(sc / 10) * 100}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={[s.occasionRowScore, { color }]}>{sc.toFixed(1)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
    </ScrollView>,

    <ScrollView key="3" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>
      {(result.styleTips?.length ?? 0) > 0 && (
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name="bulb-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[s.cardTitle, { color: theme.text }]}>{t('results.improveStyle')}</Text>
          </View>
          <View style={s.tipsList}>
            {(result.styleTips ?? []).map((tip, i) => {
              const itemLabel = result.styleTipItems?.[i];
              return (
                <View key={i} style={[s.tipRow, i < (result.styleTips?.length ?? 0) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <Text style={[s.tipIndex, { color: theme.primary }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
                    {itemLabel ? (
                      <TouchableOpacity
                        style={[s.tipItemChip, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}35` }]}
                        onPress={() => setShowPhotoModal(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="shirt-outline" size={11} color={theme.primary} />
                        <Text style={[s.tipItemChipText, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{itemLabel}</Text>
                        <Ionicons name="image-outline" size={11} color={theme.primary} style={{ marginLeft: 2 }} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
    </ScrollView>,

    ...(hasOccasionTips ? [
      <ScrollView key="4" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: `${theme.secondary}18` }]}>
              <Ionicons name={occasionIcon} size={16} color={theme.secondary} />
            </View>
            <Text style={[s.cardTitle, { color: theme.text }]}>
              {result.occasion
                ? t('results.stylingFor', { occasion: t(`occasions.${result.occasion}`) })
                : t('results.eventStyling')}
            </Text>
          </View>
          <View style={s.tipsList}>
            {(result.occasionTips ?? []).map((tip, i) => {
              const itemLabel = result.occasionTipItems?.[i];
              return (
                <View key={i} style={[s.tipRow, i < (result.occasionTips?.length ?? 0) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <Text style={[s.tipIndex, { color: theme.secondary }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
                    {itemLabel ? (
                      <TouchableOpacity
                        style={[s.tipItemChip, { backgroundColor: `${theme.secondary}14`, borderColor: `${theme.secondary}35` }]}
                        onPress={() => setShowPhotoModal(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="shirt-outline" size={11} color={theme.secondary} />
                        <Text style={[s.tipItemChipText, { color: theme.secondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{itemLabel}</Text>
                        <Ionicons name="image-outline" size={11} color={theme.secondary} style={{ marginLeft: 2 }} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
      </ScrollView>,
    ] : []),
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

      {/* ── Hero photo ──────────────────────────────────────────────── */}
      <View style={s.heroContainer}>
        {(imageUri || result.imageUrl) ? (
          <Image source={{ uri: (imageUri || result.imageUrl)! }} style={s.heroImage} resizeMode="cover" />
        ) : (
          <View style={[s.heroPlaceholder, { backgroundColor: theme.card }]}>
            <Ionicons name="shirt-outline" size={64} color={theme.primary} />
          </View>
        )}

        {/* Detected clothing items overlaid at the bottom of the photo */}
        {(result.clothingItems?.length ?? 0) > 0 && (
          <View style={s.photoTagsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoTagsScroll}>
              {displayClothingItems.map((item, i) => (
                addToWardrobe ? (
                  <TouchableOpacity
                    key={i}
                    style={s.photoTag}
                    onPress={() => setEditingIndex(i)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.photoTagText}>
                      {item.category}{item.color ? ` · ${item.color}` : ''}{item.fit ? ` · ${item.fit}` : ''}
                    </Text>
                    <Ionicons name="pencil" size={10} color="rgba(255,255,255,0.8)" style={{ marginLeft: 5 }} />
                  </TouchableOpacity>
                ) : (
                  <View key={i} style={s.photoTag}>
                    <Text style={s.photoTagText}>
                      {item.category}{item.color ? ` · ${item.color}` : ''}{item.fit ? ` · ${item.fit}` : ''}
                    </Text>
                  </View>
                )
              ))}
            </ScrollView>
          </View>
        )}

        {/* Floating header buttons */}
        <View style={s.floatingHeader}>
          <TouchableOpacity style={[s.floatBtn, { backgroundColor: `${theme.background}CC` }]} onPress={handleBack}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.floatBtn, { backgroundColor: `${theme.background}CC` }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Dot indicator bar ──────────────────────────────────────── */}
      <View style={[s.dotBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {Array.from({ length: TAB_COUNT }).map((_, i) => {
          const inputRange = Array.from({ length: TAB_COUNT }, (__, j) => j);
          const dotWidth = scrollPos.interpolate({
            inputRange,
            outputRange: inputRange.map(j => (j === i ? 22 : 6)),
            extrapolate: 'clamp',
          });
          const dotColor = scrollPos.interpolate({
            inputRange,
            outputRange: inputRange.map(j => (j === i ? theme.primary : theme.border)),
            extrapolate: 'clamp',
          });
          const dotRadius = scrollPos.interpolate({
            inputRange,
            outputRange: inputRange.map(j => (j === i ? 4 : 3)),
            extrapolate: 'clamp',
          });
          return (
            <TouchableOpacity
              key={i}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              onPress={() => pagerRef.current?.setPage(i)}
            >
              <Animated.View
                style={[s.dot, { width: dotWidth, backgroundColor: dotColor, borderRadius: dotRadius }]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Swipeable pages ────────────────────────────────────────── */}
      <PagerView
        ref={pagerRef}
        style={s.pager}
        initialPage={0}
        onPageScroll={(e) => {
          const { position, offset } = e.nativeEvent;
          scrollPos.setValue(position + offset);
        }}
        onPageSelected={(e) => {
          scrollPos.setValue(e.nativeEvent.position);
        }}
      >
        {pagerPages}
      </PagerView>

      {/* ── Bottom fade overlay ────────────────────────────────────── */}
      <LinearGradient
        colors={[`${theme.background}00`, theme.background]}
        style={s.bottomFade}
        pointerEvents="none"
      />

      {/* ── Clothing item edit sheet ──────────────────────────────── */}
      {editingIndex !== null && result.clothingItems?.[editingIndex] && (
        <ClothingEditSheet
          item={result.clothingItems[editingIndex]}
          originalKey={
            result.clothingItemKeys?.[editingIndex]
            ?? wardrobeKeyFor(
              result.clothingItems[editingIndex].category,
              result.clothingItems[editingIndex].color,
              result.clothingItems[editingIndex].fit,
              result.clothingItems[editingIndex].material,
              result.clothingItems[editingIndex].pattern,
              result.clothingItems[editingIndex].style,
            )
          }
          onSave={(updatedItem, newKey) => {
            const newItems = result.clothingItems.map((it, i) =>
              i === editingIndex ? updatedItem : it,
            );
            const newKeys = (result.clothingItemKeys ?? result.clothingItems.map(() => null)).map(
              (k, i) => (i === editingIndex ? newKey : k),
            );
            setResult({ ...result, clothingItems: newItems, clothingItemKeys: newKeys });
            setEditingIndex(null);
          }}
          onClose={() => setEditingIndex(null)}
          onAlert={showAlert}
        />
      )}

      {/* ── Photo slide-up modal ──────────────────────────────────── */}
      <PhotoSlideModal
        visible={showPhotoModal}
        imageUri={imageUri || result.imageUrl || null}
        onClose={() => setShowPhotoModal(false)}
      />

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        onClose={() => setCustomAlert((a) => ({ ...a, visible: false }))}
      />
      </Animated.View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  // Hero
  heroContainer: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  photoTagsContainer: { position: 'absolute', bottom: 14, left: 0, right: 0 },
  photoTagsScroll: { paddingHorizontal: 14, gap: 6 },
  photoTag: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap',
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  photoTagText: { color: '#fff', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 0, right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },

  // Dot indicator
  dotBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    height: 6,
  },

  // Pager
  pager: { flex: 1 },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    pointerEvents: 'none',
  },
  pageContent: { padding: 14, paddingBottom: 8, gap: 10 },

  // Score
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  scoreBadge: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center', alignItems: 'center',
    shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  scoreNumber: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  scoreOutOf: { fontSize: 13, fontWeight: '500' },
  scoreMeta: { flex: 1, gap: 6 },
  scoreLabel: { fontSize: 20, fontWeight: '800' },
  scoreSubLabel: { fontSize: 13 },
  occasionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  occasionText: { fontSize: 14, fontWeight: '600' },

  // Occasion scores list
  occasionList: { gap: 10 },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  occasionRowEmoji: { width: 22, textAlign: 'center' },
  occasionRowLabel: { fontSize: 13, width: 76 },
  occasionBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  occasionBarFill: { height: '100%', borderRadius: 4 },
  occasionRowScore: { fontSize: 13, fontWeight: '700', width: 34, textAlign: 'right' },

  // Cards
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  feedbackText: { fontSize: 15, lineHeight: 24 },

  // Color palette
  paletteRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  paletteItem: { alignItems: 'center', gap: 6 },
  paletteSwatch: {
    width: 48, height: 48, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  paletteHex: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

  // Tips
  tipsList: { gap: 0 },
  tipRow: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  tipIndex: { fontSize: 13, fontWeight: '800', width: 24 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 22 },
  tipItemChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  tipItemChipText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },


});

