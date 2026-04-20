import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, Image, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { getHistory, deleteHistoryItem } from '@/services/api';
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

function HistoryCard({ item, onPress, onDelete }: { item: HistoryItem; onPress: () => void; onDelete: () => void }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const color = getScoreColor(item.score);
  const s = cardStyles(theme);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {/* Thumbnail / score badge */}
      <View style={s.photoWrap}>
        {item.imageUrl ? (
          <>
            <Image source={{ uri: item.imageUrl }} style={s.photo} resizeMode="cover" />
            <View style={[s.scoreOverlay, { backgroundColor: `${color}D9` }]}>
              <Text style={s.scoreOverlayText}>{item.score.toFixed(1)}</Text>
            </View>
          </>
        ) : (
          <View style={[s.scoreBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
            <Text style={[s.scoreNum, { color }]}>{item.score.toFixed(1)}</Text>
            <Text style={[s.scoreDenom, { color }]}>/10</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.info}>
        <Text style={[s.date, { color: theme.textSecondary }]}>{formatDate(item.createdAt)}</Text>
        <Text style={[s.feedback, { color: theme.text }]} numberOfLines={2}>
          {item.feedback}
        </Text>
        {item.clothingItems.length > 0 && (
          <View style={s.tags}>
            {(item.clothingItemsLocalized ?? item.clothingItems).slice(0, 3).map((c, i) => (
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

      {/* Actions */}
      <View style={s.actions}>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginBottom: 8 }} />
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { setResult, setImageUri, analysisVersion } = useAnalysis();
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

  // Load on mount and whenever a new analysis completes — skip useFocusEffect
  // so navigating between tabs doesn't trigger unnecessary refetches.
  useEffect(() => { load(); }, [analysisVersion]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleDelete = (item: HistoryItem) => {
    Alert.alert(
      t('history.deleteTitle'),
      t('history.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHistoryItem(item.id);
              setUploads((prev) => prev.filter((u) => u.id !== item.id));
            } catch {
              Alert.alert(t('history.deleteFailed'));
            }
          },
        },
      ],
    );
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
      clothingItemsLocalized: item.clothingItemsLocalized ?? null,
      clothingItemKeys: item.clothingItemKeys,
      occasion: item.occasion ?? null,
      occasionScores: item.occasionScores ?? {} as any,
      colorPalette: item.colorPalette ?? [],
      imageUrl: item.imageUrl ?? null,
      totalUploadsUsed: 0,
      totalUploadsLimit: 2,
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
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={s.title}>{t('history.title')}</Text>
        <Text style={s.subtitle}>{t('history.analysisCount_other', { count: uploads.length })}</Text>
      </View>

      {error ? (
        <ScrollView
          contentContainerStyle={[s.center, { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
        >
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textSecondary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>{t('history.couldntLoad')}</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.primary }]} onPress={() => load()}>
            <Text style={s.retryText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : uploads.length === 0 ? (
        <ScrollView
          contentContainerStyle={[s.center, { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
        >
          <Ionicons name="shirt-outline" size={56} color={theme.textSecondary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>{t('history.noAnalyses')}</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            {t('history.noAnalysesSub')}
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryCard
              item={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
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
    backgroundColor: theme.card, borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  photoWrap: {
    width: 70, height: 90, borderRadius: 10, overflow: 'hidden',
    backgroundColor: `${theme.primary}14`,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  photo: { width: 70, height: 90 },
  scoreOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 3, alignItems: 'center',
  },
  scoreOverlayText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scoreBadge: {
    width: 70, height: 70, borderRadius: 35,
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
  actions: { alignItems: 'center', justifyContent: 'center', gap: 6 },
});

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  list: { padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
});
