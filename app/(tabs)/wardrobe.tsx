import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Modal, StatusBar, Platform, Animated, KeyboardAvoidingView, TextInput, ScrollView, PanResponder,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getWardrobe, deleteWardrobeItem, addWardrobeItem, getSubscriptionStatus, updateWardrobeItem } from '@/services/api';
import { WardrobeItem } from '@/types/app';
import CustomAlert from '@/components/CustomAlert';
import PremiumGateModal from '@/components/PremiumGateModal';
import { useTranslation } from 'react-i18next';

// ── Wardrobe item edit sheet ──────────────────────────────────────────────────
interface WardrobeEditSheetProps {
  item: WardrobeItem;
  onSave: (updated: WardrobeItem) => void;
  onClose: () => void;
  onAlert: (title: string, message: string, icon?: 'info' | 'error' | 'success' | 'warning') => void;
}

function WardrobeEditSheet({ item, onSave, onClose, onAlert }: WardrobeEditSheetProps) {
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
    Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => cb?.());

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
      onAlert(t('wardrobe.categoryRequired'), t('wardrobe.categoryRequiredMsg'), 'warning');
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
      onAlert(t('wardrobe.saveFailed'), e.message ?? t('wardrobe.saveFailedMsg'), 'error');
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
        <Animated.View style={[es.sheet, { backgroundColor: theme.card, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }, { translateY: dragY }] }]}>
          <View style={es.handleContainer} {...panResponder.panHandlers}>
            <View style={[es.handle, { backgroundColor: theme.border }]} />
          </View>
          <View style={es.sheetHeader}>
            <Text style={[es.sheetTitle, { color: theme.text }]}>{t('wardrobe.editItem')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={es.fields}>
            {([
              { label: t('wardrobe.fieldCategory'), value: category, set: setCategory, placeholder: t('wardrobe.phCategory') },
              { label: t('wardrobe.fieldColor'),    value: color,    set: setColor,    placeholder: t('wardrobe.phColor') },
              { label: t('wardrobe.fieldFit'),      value: fit,      set: setFit,      placeholder: t('wardrobe.phFit') },
              { label: t('wardrobe.fieldMaterial'), value: material, set: setMaterial, placeholder: t('wardrobe.phMaterial') },
              { label: t('wardrobe.fieldPattern'),  value: pattern,  set: setPattern,  placeholder: t('wardrobe.phPattern') },
              { label: t('wardrobe.fieldStyle'),    value: style,    set: setStyle,    placeholder: t('wardrobe.phStyle') },
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={es.saveBtnText}>{t('common.saveChanges')}</Text>}
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
  const [premiumGateVisible, setPremiumGateVisible] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<WardrobeItem | null>(null);
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; icon: 'info' | 'error' | 'success' | 'warning' }>({ visible: false, title: '', message: '', icon: 'info' });
  const showAlert = (title: string, message: string, icon: 'info' | 'error' | 'success' | 'warning' = 'info') =>
    setCustomAlert({ visible: true, title, message, icon });
  const { t, i18n } = useTranslation();

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
      setPremiumGateVisible(true);
      return;
    }
    setSourcePickerVisible(true);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    let pickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('common.permissionNeeded'), t('wardrobe.cameraPermissionMsg'), 'warning');
        return;
      }
      pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('common.permissionNeeded'), t('wardrobe.libraryPermissionMsg'), 'warning');
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
        showAlert(t('wardrobe.noItemDetected'), t('wardrobe.noItemDetectedMsg'), 'warning');
      } else if (e.code === 'PREMIUM_REQUIRED') {
        setPremiumGateVisible(true);
      } else {
        showAlert(t('common.error'), e.message || t('common.tryAgain'), 'error');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (item: WardrobeItem) => {
    setPendingDeleteItem(item);
  };

  const renderItem = ({ item }: { item: WardrobeItem }) => {
    const display = item.localized?.[i18n.language] ?? item;
    const detail = [display.color, display.fit, display.material].filter(Boolean).join(' · ');
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
          <Text style={[s.category, { color: theme.text }]}>{display.category ?? item.category}</Text>
          {detail ? <Text style={[s.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
          {display.style ? <Text style={[s.style, { color: theme.textSecondary }]}>{display.style}</Text> : null}
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
            <Ionicons name="trash-outline" size={18} color={theme.error} />
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
          <Text style={[s.title, { color: theme.text }]}>{t('wardrobe.title')}</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>
            {t('wardrobe.pieces_other', { count: items.length })}
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
          onAlert={showAlert}
        />
      )}

      {/* Source picker modal */}
      <CustomAlert
        visible={sourcePickerVisible}
        title={t('wardrobe.addItemTitle')}
        message={t('wardrobe.addItemMsg')}
        icon="info"
        buttons={[
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('analyze.camera'), onPress: () => pickImage('camera') },
          { text: t('wardrobe.photoLibrary'), onPress: () => pickImage('library') },
        ]}
        onClose={() => setSourcePickerVisible(false)}
      />

      {/* Delete confirmation modal */}
      <CustomAlert
        visible={!!pendingDeleteItem}
        title={t('wardrobe.removeTitle')}
        message={pendingDeleteItem ? `${t('common.remove')} "${pendingDeleteItem.category}${pendingDeleteItem.color ? ` · ${pendingDeleteItem.color}` : ''}"?` : ''}
        icon="warning"
        buttons={[
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.remove'),
            style: 'destructive',
            onPress: async () => {
              if (!pendingDeleteItem) return;
              const toDelete = pendingDeleteItem;
              setPendingDeleteItem(null);
              try {
                await deleteWardrobeItem(toDelete.id);
                setItems((prev) => prev.filter((i) => i.id !== toDelete.id));
              } catch {
                showAlert(t('common.error'), t('wardrobe.removeError'), 'error');
              }
            },
          },
        ]}
        onClose={() => setPendingDeleteItem(null)}
      />

      <PremiumGateModal
        visible={premiumGateVisible}
        onClose={() => setPremiumGateVisible(false)}
        onUpgraded={() => { load(); }}
      />

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        onClose={() => setCustomAlert((a) => ({ ...a, visible: false }))}
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="shirt-outline" size={56} color={`${theme.primary}40`} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>{t('wardrobe.noItems')}</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            {t('wardrobe.noItemsSub')}
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
  overlay:       { flex: 1, justifyContent: 'flex-end' },
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, maxHeight: '85%' },
  handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 40 },
  handle:        { width: 40, height: 4, borderRadius: 2 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle:    { fontSize: 17, fontWeight: '700' },
  fields:        { paddingHorizontal: 20, gap: 14, paddingBottom: 6 },
  fieldRow:      { gap: 6 },
  fieldLabel:    { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:    { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  saveBtn:       { marginHorizontal: 20, marginTop: 18, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});
