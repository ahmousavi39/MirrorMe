import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { saveProfile, getProfile, UserProfile } from '@/services/api';

const STYLE_CATEGORIES = [
  { id: 'classic',      label: 'Classic',      icon: 'shirt-outline' },
  { id: 'streetwear',   label: 'Streetwear',   icon: 'basketball-outline' },
  { id: 'casual',       label: 'Casual',       icon: 'sunny-outline' },
  { id: 'formal',       label: 'Formal',       icon: 'briefcase-outline' },
  { id: 'sporty',       label: 'Sporty',       icon: 'fitness-outline' },
  { id: 'bohemian',     label: 'Bohemian',     icon: 'leaf-outline' },
  { id: 'minimalist',   label: 'Minimalist',   icon: 'remove-outline' },
  { id: 'vintage',      label: 'Vintage',      icon: 'time-outline' },
  { id: 'preppy',       label: 'Preppy',       icon: 'school-outline' },
  { id: 'techwear',     label: 'Techwear',     icon: 'hardware-chip-outline' },
];

const ALL_STEPS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { completeOnboarding } = useAuth();
  const router = useRouter();

  // Which step indices (0/1/2) actually need to be filled
  const [activeSteps, setActiveSteps] = useState<number[]>([0, 1, 2]);
  // Index into activeSteps (not the raw step number)
  const [stepIndex, setStepIndex] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Existing profile — used to merge fields that were skipped
  const [existingProfile, setExistingProfile] = useState<Partial<UserProfile>>({});

  // Step 0 — Name
  const [name, setName] = useState('');

  // Step 1 — Body stats
  const [sex, setSex] = useState<'male' | 'female' | 'other' | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 2 — Style categories
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Load existing profile on mount → pre-fill fields, compute which steps to show
  useEffect(() => {
    getProfile().then((p) => {
      setExistingProfile(p);
      if (p.name)               setName(p.name);
      if (p.sex)                setSex(p.sex);
      if (p.age)                setAge(String(p.age));
      if (p.heightCm)           setHeight(String(p.heightCm));
      if (p.weightKg)           setWeight(String(p.weightKg));
      if (p.styleCategories?.length) setSelectedStyles(p.styleCategories);

      const missing: number[] = [];
      if (!p.name)                                                           missing.push(0);
      if (!p.sex || !p.age || !p.heightCm || !p.weightKg)                   missing.push(1);
      if (!p.styleCategories?.length)                                        missing.push(2);
      // Show all steps if somehow nothing is missing (shouldn't happen, but safe fallback)
      setActiveSteps(missing.length > 0 ? missing : [0, 1, 2]);
      setProfileLoading(false);
    }).catch(() => {
      setActiveSteps([0, 1, 2]);
      setProfileLoading(false);
    });
  }, []);

  // The actual step number (0, 1, or 2) for the current position
  const step = activeSteps[stepIndex];

  const animateTo = (nextIndex: number) => {
    const direction = nextIndex > stepIndex ? -1 : 1;
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction * SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction * -SCREEN_WIDTH,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setStepIndex(nextIndex);
  };

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step === 0) {
      if (!name.trim()) { Alert.alert('Please enter your name'); return; }
    }
    animateTo(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex > 0) animateTo(stepIndex - 1);
  };

  const handleFinish = async () => {
    if (step === 2 && selectedStyles.length === 0) {
      Alert.alert('Pick at least one style', 'Select 1 or more style categories to help us personalize your ratings.');
      return;
    }
    setSaving(true);
    try {
      // Merge: use form values for steps that were shown, keep existing data for skipped steps
      const profile: UserProfile = {
        name:             activeSteps.includes(0) ? name.trim()                       : (existingProfile.name      ?? ''),
        sex:              activeSteps.includes(1) ? sex                               : (existingProfile.sex       ?? null),
        age:              activeSteps.includes(1) ? (age    ? parseInt(age, 10)    : null) : (existingProfile.age       ?? null),
        heightCm:         activeSteps.includes(1) ? (height ? parseFloat(height)   : null) : (existingProfile.heightCm  ?? null),
        weightKg:         activeSteps.includes(1) ? (weight ? parseFloat(weight)   : null) : (existingProfile.weightKg  ?? null),
        styleCategories:  activeSteps.includes(2) ? selectedStyles                    : (existingProfile.styleCategories ?? []),
      };
      await saveProfile(profile);
      completeOnboarding();
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(theme);

  if (profileLoading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Progress bar */}
      <View style={s.progressRow}>
        {Array.from({ length: activeSteps.length }).map((_, i) => (
          <View key={i} style={[s.progressDot, i <= stepIndex && s.progressDotActive]} />
        ))}
      </View>

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── STEP 0: Name ── */}
          {step === 0 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}>
                <Ionicons name="person-outline" size={40} color="#fff" />
              </View>
              <Text style={s.stepTitle}>What's your name?</Text>
              <Text style={s.stepSubtitle}>We'll personalize your style experience</Text>

              <View style={s.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Your first name"
                  placeholderTextColor={theme.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                />
              </View>
            </View>
          )}

          {/* ── STEP 1: Body stats ── */}
          {step === 1 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}>
                <Ionicons name="body-outline" size={40} color="#fff" />
              </View>
              <Text style={s.stepTitle}>Tell us about yourself</Text>
              <Text style={s.stepSubtitle}>Optional — helps us give more accurate advice</Text>

              {/* Sex */}
              <Text style={s.fieldLabel}>Sex</Text>
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
              <Text style={s.fieldLabel}>Age</Text>
              <View style={s.inputWrapper}>
                <Ionicons name="calendar-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="e.g. 25"
                  placeholderTextColor={theme.placeholder}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
              </View>

              {/* Height */}
              <Text style={s.fieldLabel}>Height (cm)</Text>
              <View style={s.inputWrapper}>
                <Ionicons name="resize-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="e.g. 178"
                  placeholderTextColor={theme.placeholder}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
              </View>

              {/* Weight */}
              <Text style={s.fieldLabel}>Weight (kg)</Text>
              <View style={s.inputWrapper}>
                <Ionicons name="barbell-outline" size={20} color={theme.placeholder} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="e.g. 75"
                  placeholderTextColor={theme.placeholder}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>
          )}

          {/* ── STEP 2: Style categories ── */}
          {step === 2 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}>
                <Ionicons name="color-palette-outline" size={40} color="#fff" />
              </View>
              <Text style={s.stepTitle}>Your style vibe</Text>
              <Text style={s.stepSubtitle}>Pick all that apply — you can have more than one!</Text>

              <View style={s.styleGrid}>
                {STYLE_CATEGORIES.map((cat) => {
                  const active = selectedStyles.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[s.styleChip, active && s.styleChipActive]}
                      onPress={() => toggleStyle(cat.id)}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={18}
                        color={active ? '#fff' : theme.textSecondary}
                      />
                      <Text style={[s.styleChipText, active && s.styleChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Bottom navigation */}
      <View style={s.bottomBar}>
        {stepIndex > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}

        {stepIndex < activeSteps.length - 1 ? (
          <TouchableOpacity style={s.nextBtn} onPress={handleNext}>
            <Text style={s.nextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.nextBtn} onPress={handleFinish} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={s.nextBtnText}>Let's go!</Text>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 60,
      paddingBottom: 12,
    },
    progressDot: {
      width: 28,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    progressDotActive: {
      backgroundColor: theme.primary,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      flexGrow: 1,
    },
    stepContainer: {
      flex: 1,
      paddingTop: 16,
    },
    iconCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 24,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
    },
    stepTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    stepSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
    },
    fieldLabel: {
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
      marginBottom: 16,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 24,
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
      marginTop: 4,
    },
    styleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    styleChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    styleChipText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    styleChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    bottomBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 10,
      minWidth: 80,
    },
    backBtnText: {
      fontSize: 16,
      color: theme.text,
      fontWeight: '500',
    },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 28,
      minWidth: 130,
      justifyContent: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    nextBtnText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '700',
    },
  });
}
