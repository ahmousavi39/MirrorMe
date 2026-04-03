import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import StyleScore from '@/components/StyleScore';
import { ClothingItem } from '@/types/app';

function ClothingTag({ item }: { item: ClothingItem }) {
  const { theme } = useTheme();
  const detail = [item.color, item.material, item.fit]
    .filter(Boolean).join(' · ');

  return (
    <View style={[tagStyles.wrapper, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}25` }]}>
      <Text style={[tagStyles.category, { color: theme.primary }]}>{item.category}</Text>
      {detail ? <Text style={[tagStyles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

const tagStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  category: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 11, marginTop: 1 },
});

export default function ResultsScreen() {
  const { theme } = useTheme();
  const { result, clear } = useAnalysis();
  const router = useRouter();
  const s = makeStyles(theme);

  const handleBack = () => {
    router.back();
  };

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
    } catch {
      // user dismissed
    }
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

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Ionicons name="chevron-down" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Your Style Result</Text>
        <TouchableOpacity onPress={handleShare} style={s.shareBtn}>
          <Ionicons name="share-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Score */}
        <View style={s.scoreSection}>
          <StyleScore score={result.score} />
        </View>

        {/* Feedback */}
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.cardHeader}>
            <Ionicons name="chatbubble-ellipses" size={18} color={theme.primary} />
            <Text style={[s.cardTitle, { color: theme.text }]}>AI Feedback</Text>
          </View>
          <Text style={[s.feedbackText, { color: theme.text }]}>{result.feedback}</Text>
        </View>

        {/* Clothing items */}
        {result.clothingItems.length > 0 && (
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.cardHeader}>
              <Ionicons name="shirt" size={18} color={theme.primary} />
              <Text style={[s.cardTitle, { color: theme.text }]}>
                Detected Items ({result.clothingItems.length})
              </Text>
            </View>
            <View style={s.clothingGrid}>
              {result.clothingItems.map((item, i) => (
                <ClothingTag key={i} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.cardHeader}>
              <Ionicons name="bulb" size={18} color={theme.primary} />
              <Text style={[s.cardTitle, { color: theme.text }]}>Style Tips</Text>
            </View>
            <View style={s.suggestions}>
              {result.suggestions.map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={[s.tipNumber, { backgroundColor: `${theme.primary}18` }]}>
                    <Text style={[s.tipNumberText, { color: theme.primary }]}>{i + 1}</Text>
                  </View>
                  <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Usage note */}
        {!result.isSubscribed && result.remainingFreeUploads !== null && (
          <View style={[s.usageNote, { backgroundColor: `${theme.secondary}12` }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.secondary} />
            <Text style={[s.usageNoteText, { color: theme.secondary }]}>
              {result.remainingFreeUploads === 0
                ? 'You\'ve used all free uploads this week. Upgrade for unlimited access.'
                : `${result.remainingFreeUploads} free upload${result.remainingFreeUploads === 1 ? '' : 's'} remaining this week`
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={s.bottom}>
        <TouchableOpacity
          style={[s.analyzeBtn, { backgroundColor: theme.primary }]}
          onPress={handleAnalyzeAgain}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={s.analyzeBtnText}>Analyze Another Outfit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 16, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: theme.text },
  shareBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  scoreSection: { alignItems: 'center', paddingVertical: 24 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  feedbackText: { fontSize: 15, lineHeight: 24 },
  clothingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestions: { gap: 12 },
  tipRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipNumber: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  tipNumberText: { fontSize: 13, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 14, lineHeight: 22 },
  usageNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 12,
  },
  usageNoteText: { flex: 1, fontSize: 13 },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: theme.background,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  analyzeBtn: {
    height: 54, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});


