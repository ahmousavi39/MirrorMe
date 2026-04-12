import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { getHistory } from '@/services/api';
import { HistoryItem } from '@/types/app';
import { useTranslation } from 'react-i18next';

function getScoreColor(score: number): string {
  if (score >= 8) return '#30D158';
  if (score >= 6) return '#FF9F0A';
  return '#FF453A';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HistoryCard({ item, onPress }: { item: HistoryItem; onPress: () => void }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const color = getScoreColor(item.score);
  const s = cardStyles(theme);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.scoreBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
        <Text style={[s.scoreNum, { color }]}>{item.score.toFixed(1)}</Text>
        <Text style={[s.scoreDenom, { color }]}>/10</Text>
      </View>
      <View style={s.info}>
        <Text style={[s.date, { color: theme.textSecondary }]}>{formatDate(item.createdAt)}</Text>
        <Text style={[s.feedback, { color: theme.text }]} numberOfLines={2}>
          {item.feedback}
        </Text>
        {item.clothingItems.length > 0 && (
          <View style={s.tags}>
            {item.clothingItems.slice(0, 3).map((c, i) => (
              <View key={i} style={[s.tag, { backgroundColor: `${theme.primary}18` }]}>
                <Text style={[s.tagText, { color: theme.primary }]}>{c.category}</Text>
              </View>
            ))}
            {item.clothingItems.length > 3 && (
              <Text style={[s.tagMore, { color: theme.textSecondary }]}>
                {t('history.more_other', { count: item.clothingItems.length - 3 })}
              </Text>
            )}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { setResult, setImageUri } = useAnalysis();
  const router = useRouter();

  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getHistory();
      setUploads(data);
    } catch (e: any) {
      setError(e.message || t('history.failedToLoad'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handlePress = (item: HistoryItem) => {
    setResult({
      uploadId: item.id,
      score: item.score,
      feedback: item.feedback,
      styleTips: item.styleTips ?? [],
      styleTipItems: item.styleTipItems ?? [],
      occasionTips: item.occasionTips ?? [],
      occasionTipItems: item.occasionTipItems ?? [],
      clothingItems: item.clothingItems ?? [],
      clothingItemKeys: item.clothingItemKeys,
      occasion: item.occasion ?? null,
      occasionScores: item.occasionScores ?? {} as any,
      colorPalette: item.colorPalette ?? [],
      imageUrl: item.imageUrl ?? null,
      uploadsUsedThisWeek: 0,
      uploadsLimitPerWeek: 2,
      remainingFreeUploads: null,
      isSubscribed: false,
    });
    if (item.imageUrl) setImageUri(item.imageUrl);
    router.push('/results');
  };

  const s = makeStyles(theme);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('history.title')}</Text>
        <Text style={s.subtitle}>{t('history.analysisCount_other', { count: uploads.length })}</Text>
      </View>

      {error ? (
        <View style={[s.center, { flex: 1 }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSecondary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>{t('history.couldntLoad')}</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.primary }]} onPress={() => load()}>
            <Text style={s.retryText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : uploads.length === 0 ? (
        <View style={[s.center, { flex: 1 }]}>
          <Ionicons name="shirt-outline" size={56} color={theme.textSecondary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>{t('history.noAnalyses')}</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            {t('history.noAnalysesSub')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryCard item={item} onPress={() => handlePress(item)} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
        />
      )}
    </View>
  );
}

const cardStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  scoreBadge: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  scoreNum: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  scoreDenom: { fontSize: 11, fontWeight: '500' },
  info: { flex: 1, gap: 4 },
  date: { fontSize: 12 },
  feedback: { fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600' },
  tagMore: { fontSize: 11, alignSelf: 'center' },
});

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  list: { padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
});
