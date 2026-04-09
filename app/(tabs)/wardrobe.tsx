import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
  Modal, StatusBar, Platform, Animated, KeyboardAvoidingView, TextInput, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getWardrobe, deleteWardrobeItem, addWardrobeItem, getSubscriptionStatus, updateWardrobeItem } from '@/services/api';
import { WardrobeItem } from '@/types/app';

// ── Wardrobe item edit sheet ──────────────────────────────────────────────────
interface WardrobeEditSheetProps {
  item: WardrobeItem;
  onSave: (updated: WardrobeItem) => void;
  onClose: () => void;
}

function WardrobeEditSheet({ item, onSave, onClose }: WardrobeEditSheetProps) {
  const { theme } = useTheme();
  const [category, setCategory] = useState(item.category ?? '');
  const [color, setColor]       = useState(item.color ?? '');
  const [fit, setFit]           = useState(item.fit ?? '');
  const [material, setMaterial] = useState(item.material ?? '');
  const [pattern, setPattern]   = useState(item.pattern ?? '');
  const [style, setStyle]       = useState(item.style ?? '');
  const [saving, setSaving]     = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => cb?.());

  const handleClose = () => dismiss(onClose);

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
      Alert.alert('Category required', 'Please enter a category for this item.');
      return;
    }
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
      const updated = await updateWardrobeItem(item.id, { ...trimmed, source: 'wardrobe' });
      dismiss(() => onSave(updated));
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Could not update this item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const es = wardrobeEditStyles(theme);
  return (
    <Modal visible animationType="none" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={es.overlay}>
        <Animated.View style={[es.backdrop, { opacity: anim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        <Animated.View style={[es.sheet, { backgroundColor: theme.card, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] }]}>
          <View style={[es.handle, { backgroundColor: theme.border }]} />
          <View style={es.sheetHeader}>
            <Text style={[es.sheetTitle, { color: theme.text }]}>Edit Item</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={es.fields}>
            {([
              { label: 'Category *', value: category, set: setCategory, placeholder: 'e.g. T-Shirt, Jeans' },
              { label: 'Color',      value: color,    set: setColor,    placeholder: 'e.g. Navy Blue' },
              { label: 'Fit',        value: fit,      set: setFit,      placeholder: 'e.g. Slim, Regular, Oversized' },
              { label: 'Material',   value: material, set: setMaterial, placeholder: 'e.g. Cotton, Linen' },
              { label: 'Pattern',    value: pattern,  set: setPattern,  placeholder: 'e.g. Solid, Striped, Floral' },
              { label: 'Style',      value: style,    set: setStyle,    placeholder: 'e.g. Casual, Formal' },
            ] as const).map(({ label, value, set, placeholder }) => (
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={es.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

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
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setEditingItem(item)} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
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

      {editingItem && (
        <WardrobeEditSheet
          item={editingItem}
          onSave={(updated) => {
            setItems((prev) => prev.map((i) => i.id === editingItem.id ? updated : i));
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

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
          data={items.filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)}
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
  actions: { gap: 12, alignItems: 'center' },
});

const wardrobeEditStyles = (theme: any) => StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, maxHeight: '85%' },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  fields:     { paddingHorizontal: 20, gap: 14, paddingBottom: 6 },
  fieldRow:   { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  saveBtn:    { marginHorizontal: 20, marginTop: 18, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});
