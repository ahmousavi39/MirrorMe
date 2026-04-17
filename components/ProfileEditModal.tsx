import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, Platform,
  Animated, KeyboardAvoidingView, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfile, saveProfile, UserProfile } from '@/services/api';

const STYLE_CATEGORIES = [
  { id: 'classic',    label: 'Classic',    icon: 'shirt-outline' },
  { id: 'streetwear', label: 'Streetwear', icon: 'basketball-outline' },
  { id: 'casual',     label: 'Casual',     icon: 'sunny-outline' },
  { id: 'formal',     label: 'Formal',     icon: 'briefcase-outline' },
  { id: 'sporty',     label: 'Sporty',     icon: 'fitness-outline' },
  { id: 'bohemian',   label: 'Bohemian',   icon: 'leaf-outline' },
  { id: 'minimalist', label: 'Minimalist', icon: 'remove-outline' },
  { id: 'vintage',    label: 'Vintage',    icon: 'time-outline' },
  { id: 'preppy',     label: 'Preppy',     icon: 'school-outline' },
  { id: 'techwear',   label: 'Techwear',   icon: 'hardware-chip-outline' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileEditModal({ visible, onClose }: Props) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const dragY = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      slideAnim.setValue(600);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }).start();
      loadProfile();
    }
  }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const p = await getProfile();
      setName(p.name ?? '');
      setSex(p.sex ?? null);
      setAge(p.age != null ? String(p.age) : '');
      setHeight(p.heightCm != null ? String(p.heightCm) : '');
      setWeight(p.weightKg != null ? String(p.weightKg) : '');
      setSelectedStyles(p.styleCategories ?? []);
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => dragY.setValue(0),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) dragY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start(),
    })
  ).current;

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (selectedStyles.length === 0) {
      Alert.alert('Style required', 'Please select at least one style category.');
      return;
    }
    setSaving(true);
    try {
      const profile: UserProfile = {
        name: name.trim(),
        sex,
        age: age ? parseInt(age, 10) : null,
        heightCm: height ? parseFloat(height) : null,
        weightKg: weight ? parseFloat(weight) : null,
        styleCategories: selectedStyles,
      };
      await saveProfile(profile);
      Alert.alert('Saved!', 'Your profile has been updated.');
      handleClose();
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }, { translateY: dragY }] }]}>
          {/* Drag handle */}
          <View style={s.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
          </View>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={20}
            >
              <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Name */}
                <Text style={s.label}>Name</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Your first name"
                    placeholderTextColor={theme.placeholder}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Sex */}
                <Text style={s.label}>Sex</Text>
                <View style={s.sexRow}>
                  {(['male', 'female', 'other'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.sexBtn, sex === opt && s.sexBtnActive]}
                      onPress={() => setSex(opt)}
                    >
                      <Text style={[s.sexBtnText, sex === opt && s.sexBtnTextActive]}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Age */}
                <Text style={s.label}>Age</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="calendar-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 25"
                    placeholderTextColor={theme.placeholder}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                  />
                </View>

                {/* Height */}
                <Text style={s.label}>Height (cm)</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="resize-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 178"
                    placeholderTextColor={theme.placeholder}
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                  />
                </View>

                {/* Weight */}
                <Text style={s.label}>Weight (kg)</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="barbell-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 75"
                    placeholderTextColor={theme.placeholder}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                  />
                </View>

                {/* Style categories */}
                <Text style={s.label}>Style Categories</Text>
                <View style={s.styleGrid}>
                  {STYLE_CATEGORIES.map((cat) => {
                    const active = selectedStyles.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => toggleStyle(cat.id)}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={16}
                          color={active ? '#fff' : theme.textSecondary}
                        />
                        <Text style={[s.chipText, active && s.chipTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Save button */}
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
      minHeight: '60%',
    },
    dragHandleContainer: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    closeBtn: { padding: 4 },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 52,
      marginBottom: 20,
    },
    inputIcon: { marginRight: 10 },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    sexBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    sexBtnActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '18',
    },
    sexBtnText: {
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    sexBtnTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    styleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 28,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    chipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    chipText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    chipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
