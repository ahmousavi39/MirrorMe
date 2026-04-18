import { useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform, Animated, Dimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

import AnalyzeScreen from './index';
import HistoryScreen from './history';
import WardrobeScreen from './wardrobe';
import ProfileScreen from './profile';

const TABS = [
  { key: 'analyze', icon: 'camera',        iconOutline: 'camera-outline' },
  { key: 'history', icon: 'time',          iconOutline: 'time-outline' },
  { key: 'wardrobe', icon: 'shirt',        iconOutline: 'shirt-outline' },
  { key: 'profile',  icon: 'person-circle', iconOutline: 'person-circle-outline' },
] as const;

const INPUT_RANGE = TABS.map((_, i) => i); // [0, 1, 2, 3]

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const pagerRef = useRef<PagerView>(null);
  const scrollPos = useRef(new Animated.Value(0)).current;

  function goToPage(index: number) {
    pagerRef.current?.setPage(index);
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <PagerView
        ref={pagerRef}
        style={s.pager}
        initialPage={0}
        overdrag
        onPageScroll={(e) => {
          const { position, offset } = e.nativeEvent;
          scrollPos.setValue(position + offset);
        }}
        onPageSelected={(e) => {
          // Snap to exact integer to prevent float drift
          scrollPos.setValue(e.nativeEvent.position);
        }}
      >
        <View key="0"><AnalyzeScreen /></View>
        <View key="1"><HistoryScreen /></View>
        <View key="2"><WardrobeScreen /></View>
        <View key="3"><ProfileScreen /></View>
      </PagerView>

      <View style={[s.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {TABS.map((tab, i) => {
          const activeFraction = scrollPos.interpolate({
            inputRange: INPUT_RANGE,
            outputRange: INPUT_RANGE.map(j => (j === i ? 1 : 0)),
            extrapolate: 'clamp',
          });

          const color = scrollPos.interpolate({
            inputRange: INPUT_RANGE,
            outputRange: INPUT_RANGE.map(j =>
              j === i ? theme.primary : theme.textSecondary
            ),
            extrapolate: 'clamp',
          });

          const outlineOpacity = Animated.subtract(1, activeFraction);

          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabItem}
              onPress={() => goToPage(i)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Animated.View style={[StyleSheet.absoluteFill, s.iconCenter, { opacity: outlineOpacity }]}>
                  <Ionicons name={tab.iconOutline as any} size={26} color={theme.textSecondary} />
                </Animated.View>
                <Animated.View style={[s.iconCenter, { opacity: activeFraction }]}>
                  <Ionicons name={tab.icon as any} size={26} color={theme.primary} />
                </Animated.View>
              </View>
              <Animated.Text style={[s.tabLabel, { color }]}>
                {t(`tabs.${tab.key}`)}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  pager:  { flex: 1 },
  tabBar: {
    height: Platform.OS === 'ios' && Math.min(Dimensions.get('window').width, Dimensions.get('window').height) >= 768 ? 68 : Platform.OS === 'ios' ? 84 : 68,
    paddingBottom: Platform.OS === 'ios' && Math.min(Dimensions.get('window').width, Dimensions.get('window').height) >= 768 ? 10 : Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 26,
    height: 26,
  },
  iconCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
