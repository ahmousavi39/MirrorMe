import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getWardrobe, deleteWardrobeItem } from '@/services/api';
import { WardrobeItem } from '@/types/app';

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getWardrobe();
      setItems(data);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (item: WardrobeItem) => {
    Alert.alert(
      'Remove from wardrobe?',
      `Remove "${item.category}${item.color ? ` · ${item.color}` : ''}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWardrobeItem(item.id);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch {
              Alert.alert('Error', 'Could not remove item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: WardrobeItem }) => {
    const detail = [item.color, item.fit, item.material].filter(Boolean).join(' · ');
    return (
      <View style={[s.card, { backgroundColor: theme.card }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.thumb} resizeMode="cover" />
        ) : (
          <View style={[s.thumbPlaceholder, { backgroundColor: `${theme.primary}14` }]}>
            <Ionicons name="shirt-outline" size={28} color={theme.primary} />
          </View>
        )}
        <View style={s.info}>
          <Text style={[s.category, { color: theme.text }]}>{item.category}</Text>
          {detail ? <Text style={[s.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
          {item.style ? <Text style={[s.style, { color: theme.textSecondary }]}>{item.style}</Text> : null}
          <View style={s.metaRow}>
            <View style={[s.badge, { backgroundColor: `${theme.primary}14` }]}>
              <Ionicons name="repeat" size={11} color={theme.primary} />
              <Text style={[s.badgeText, { color: theme.primary }]}>{item.timesWorn}×</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.title, { color: theme.text }]}>My Wardrobe</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>
          {items.length} piece{items.length !== 1 ? 's' : ''} detected
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="shirt-outline" size={56} color={`${theme.primary}40`} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>No pieces yet</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            Analyze an outfit and your clothing pieces will appear here automatically.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={theme.primary}
            />
          }
        />
      )}
    </View>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  thumb: { width: 70, height: 90, borderRadius: 10 },
  thumbPlaceholder: {
    width: 70, height: 90, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, gap: 3 },
  category: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 12 },
  style: { fontSize: 12, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: 4 },
});
