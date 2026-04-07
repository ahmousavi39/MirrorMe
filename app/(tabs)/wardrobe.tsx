import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
  Modal, StatusBar, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getWardrobe, deleteWardrobeItem, addWardrobeItem, getSubscriptionStatus } from '@/services/api';
import { WardrobeItem } from '@/types/app';

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, status] = await Promise.all([getWardrobe(), getSubscriptionStatus()]);
      setItems(data);
      setIsSubscribed(status.isSubscribed);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAddItem = async () => {
    if (!isSubscribed) {
      Alert.alert(
        'Premium Feature',
        'Manually adding wardrobe items is available for premium subscribers. Upgrade to unlock this feature!',
        [{ text: 'OK' }]
      );
      return;
    }

    // Let user choose source
    Alert.alert('Add Wardrobe Item', 'Choose a photo source', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Photo Library', onPress: () => pickImage('library') },
    ]);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    let pickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access.');
        return;
      }
      pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access.');
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.9,
      });
    }
    if (pickerResult.canceled || !pickerResult.assets[0]) return;

    setAdding(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const newItem = await addWardrobeItem(compressed.uri);
      setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
    } catch (e: any) {
      if (e.code === 'NO_ITEM') {
        Alert.alert('No item detected', 'Could not detect a clothing item in this photo. Try a clearer photo of a single piece.');
      } else if (e.code === 'PREMIUM_REQUIRED') {
        Alert.alert('Premium Required', e.message);
      } else {
        Alert.alert('Error', e.message || 'Failed to add item. Please try again.');
      }
    } finally {
      setAdding(false);
    }
  };

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
        <TouchableOpacity
          onPress={() => item.imageUrl && setPhotoUrl(item.imageUrl)}
          activeOpacity={item.imageUrl ? 0.8 : 1}
        >
          {item.imageUrl ? (
            <View>
              <Image source={{ uri: item.imageUrl }} style={s.thumb} resizeMode="cover" />
              <View style={s.thumbOverlay}>
                <Ionicons name="expand-outline" size={14} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={[s.thumbPlaceholder, { backgroundColor: `${theme.primary}14` }]}>
              <Ionicons name="shirt-outline" size={28} color={theme.primary} />
            </View>
          )}
        </TouchableOpacity>
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
      {/* Fullscreen photo viewer */}
      <Modal
        visible={!!photoUrl}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPhotoUrl(null)}
      >
        <View style={s.modalBg}>
          <Image
            source={{ uri: photoUrl! }}
            style={s.modalImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={s.modalClose} onPress={() => setPhotoUrl(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>My Wardrobe</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>
            {items.length} piece{items.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={handleAddItem}
          activeOpacity={0.8}
          disabled={adding}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="add" size={22} color="#fff" />}
        </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
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
  thumbOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 5, padding: 3,
  },
  // Fullscreen modal
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalImage: { width: '100%', height: '85%' },
  modalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, padding: 8,
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
