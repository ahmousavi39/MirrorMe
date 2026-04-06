import { useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Platform, Image, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { ClothingItem, Occasion } from '@/types/app';

const OCCASION_META: Record<Occasion, { label: string; emoji: string }> = {
  casual:    { label: 'Casual',    emoji: '🛍️' },
  work:      { label: 'Work',      emoji: '💼' },
  school:    { label: 'School',    emoji: '🎓' },
  date:      { label: 'Date',      emoji: '💛' },
  night_out: { label: 'Night Out', emoji: '🌙' },
  interview: { label: 'Interview', emoji: '📋' },
  formal:    { label: 'Formal',    emoji: '🧐' },
  sport:     { label: 'Sport',     emoji: '🏋️' },
  travel:    { label: 'Travel',    emoji: '✈️' },
};

const OCCASION_ORDER: Occasion[] = [
  'casual', 'work', 'school', 'date', 'night_out', 'interview', 'formal', 'sport', 'travel',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * 1.35);

function getScoreColor(score: number) {
  if (score >= 8) return '#30D158';
  if (score >= 6) return '#FF9F0A';
  return '#FF453A';
}

function getScoreLabel(score: number) {
  if (score >= 9) return 'Style Icon ✨';
  if (score >= 8) return 'Looking Great!';
  if (score >= 7) return 'Solid Look 👍';
  if (score >= 6) return 'Pretty Good';
  if (score >= 5) return 'Needs Work';
  return 'Major Makeover';
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

export default function ResultsScreen() {
  const { theme } = useTheme();
  const { result, imageUri, clear } = useAnalysis();
  const router = useRouter();
  const s = makeStyles(theme);

  // Fade-in animation for the content card
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBack = () => router.back();

  const handleAnalyzeAgain = () => {
    clear();
    router.replace('/(tabs)');
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `My AI Stylist score: ${result.score}/10 ✨\n\n"${result.feedback}"\n\nGet your style rated at AI Stylist!`,
      });
    } catch { /* dismissed */ }
  };

  if (!result) {
    return (
      <View style={[s.empty, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>No result to display.</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreColor = getScoreColor(result.score);

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Hero photo ─────────────────────────────────────────────── */}
        <View style={s.heroContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.heroImage} resizeMode="cover" />
          ) : (
            <View style={[s.heroPlaceholder, { backgroundColor: theme.card }]}>
              <Ionicons name="shirt-outline" size={64} color={theme.primary} />
            </View>
          )}
          {/* Gradient-like fade at the bottom of the photo */}
          <View style={[s.heroFade, { backgroundColor: theme.background }]} />

          {/* Detected clothing items — overlaid at the bottom of the photo */}
          {result.clothingItems.length > 0 && (
            <View style={s.photoTagsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoTagsScroll}>
                {result.clothingItems.map((item, i) => (
                  <View key={i} style={s.photoTag}>
                    <Text style={s.photoTagText}>
                      {item.category}{item.color ? ` · ${item.color}` : ''}
                    </Text>
                  </View>
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

        {/* ── Score card — overlaps photo ────────────────────────────── */}
        <Animated.View style={[s.scoreCard, { backgroundColor: theme.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[s.scoreBadge, { borderColor: scoreColor, shadowColor: scoreColor }]}>
            <Text style={[s.scoreNumber, { color: scoreColor }]}>{result.score.toFixed(1)}</Text>
            <Text style={[s.scoreOutOf, { color: theme.textSecondary }]}>/10</Text>
          </View>
          <View style={s.scoreMeta}>
            <Text style={[s.scoreLabel, { color: scoreColor }]}>{getScoreLabel(result.score)}</Text>
            {result.occasion && OCCASION_META[result.occasion] ? (
              <View style={[s.occasionBadge, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}28` }]}>
                <Text style={s.occasionEmoji}>{OCCASION_META[result.occasion].emoji}</Text>
                <Text style={[s.occasionText, { color: theme.primary }]}>
                  {OCCASION_META[result.occasion].label}
                </Text>
              </View>
            ) : (
              <Text style={[s.scoreSubLabel, { color: theme.textSecondary }]}>Style Report</Text>
            )}
          </View>
        </Animated.View>

        {/* ── Sections ───────────────────────────────────────────────── */}
        <Animated.View style={[s.sections, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Color palette */}
          {result.colorPalette && result.colorPalette.length > 0 && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
                  <Ionicons name="color-palette" size={16} color={theme.primary} />
                </View>
                <Text style={[s.cardTitle, { color: theme.text }]}>Color Palette</Text>
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

          {/* Feedback */}
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.cardHeader}>
              <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
                <Ionicons name="chatbubble-ellipses" size={16} color={theme.primary} />
              </View>
              <Text style={[s.cardTitle, { color: theme.text }]}>AI Feedback</Text>
            </View>
            <Text style={[s.feedbackText, { color: theme.text }]}>{result.feedback}</Text>
          </View>

          {/* Occasion scores breakdown */}
          {result.occasionScores && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
                  <Ionicons name="calendar" size={16} color={theme.primary} />
                </View>
                <Text style={[s.cardTitle, { color: theme.text }]}>Occasion Fit</Text>
              </View>
              <View style={s.occasionList}>
                {OCCASION_ORDER.map((key) => {
                  const meta = OCCASION_META[key];
                  const sc: number = (result.occasionScores as any)[key] ?? 0;
                  const color = sc >= 8 ? '#30D158' : sc >= 6 ? '#FF9F0A' : '#FF453A';
                  const isSelected = result.occasion === key;
                  return (
                    <View key={key} style={s.occasionRow}>
                      <Text style={s.occasionRowEmoji}>{meta.emoji}</Text>
                      <Text style={[s.occasionRowLabel, { color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '500' }]}>
                        {meta.label}
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

          {/* Style improvement tips */}
          {result.styleTips.length > 0 && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIcon, { backgroundColor: `${theme.primary}18` }]}>
                  <Ionicons name="color-palette" size={16} color={theme.primary} />
                </View>
                <Text style={[s.cardTitle, { color: theme.text }]}>Improve Your Style</Text>
              </View>
              <View style={s.tipsList}>
                {result.styleTips.map((tip, i) => (
                  <View key={i} style={[s.tipRow, i < result.styleTips.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <Text style={[s.tipIndex, { color: theme.primary }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Occasion tips */}
          {result.occasionTips.length > 0 && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIcon, { backgroundColor: `${theme.secondary}18` }]}>
                  <Ionicons name="calendar" size={16} color={theme.secondary} />
                </View>
                <Text style={[s.cardTitle, { color: theme.text }]}>
                  {result.occasion ? `Styling for ${OCCASION_META[result.occasion].emoji} ${OCCASION_META[result.occasion].label}` : 'Event Styling'}
                </Text>
              </View>
              <View style={s.tipsList}>
                {result.occasionTips.map((tip, i) => (
                  <View key={i} style={[s.tipRow, i < result.occasionTips.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <Text style={[s.tipIndex, { color: theme.secondary }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Usage note */}
          {!result.isSubscribed && result.remainingFreeUploads !== null && (
            <View style={[s.usageNote, { backgroundColor: `${theme.secondary}12`, borderColor: `${theme.secondary}25` }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.secondary} />
              <Text style={[s.usageNoteText, { color: theme.secondary }]}>
                {result.remainingFreeUploads === 0
                  ? 'You\'ve used all free uploads this week. Upgrade for unlimited access.'
                  : `${result.remainingFreeUploads} free upload${result.remainingFreeUploads === 1 ? '' : 's'} remaining this week`}
              </Text>
            </View>
          )}

          {/* Analyze again button */}
          <TouchableOpacity
            style={[s.analyzeBtn, { backgroundColor: theme.primary }]}
            onPress={handleAnalyzeAgain}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={s.analyzeBtnText}>Analyze Another Outfit</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  // Hero
  heroContainer: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 80, opacity: 0.9,
  },
  photoTagsContainer: {
    position: 'absolute', bottom: 42, left: 0, right: 0,
  },
  photoTagsScroll: {
    paddingHorizontal: 14, gap: 6,
  },
  photoTag: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  photoTagText: {
    color: '#fff', fontSize: 12, fontWeight: '600',
  },
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

  // Score card
  scoreCard: {
    marginHorizontal: 20,
    marginTop: -28,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
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
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  occasionEmoji: { fontSize: 13 },
  occasionText: { fontSize: 13, fontWeight: '600' },

  // Occasion scores list
  occasionList: { gap: 10 },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  occasionRowEmoji: { fontSize: 15, width: 22, textAlign: 'center' },
  occasionRowLabel: { fontSize: 13, width: 76 },
  occasionBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  occasionBarFill: { height: '100%', borderRadius: 4 },
  occasionRowScore: { fontSize: 13, fontWeight: '700', width: 34, textAlign: 'right' },

  // Sections
  sections: { padding: 20, gap: 14 },
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
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  countText: { fontSize: 12, fontWeight: '700' },
  feedbackText: { fontSize: 15, lineHeight: 24 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

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

  // Usage
  usageNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  usageNoteText: { flex: 1, fontSize: 13, lineHeight: 20 },

  // Button
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
