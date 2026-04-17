import { useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
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

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);

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
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        <View key="0"><AnalyzeScreen /></View>
        <View key="1"><HistoryScreen /></View>
        <View key="2"><WardrobeScreen /></View>
        <View key="3"><ProfileScreen /></View>
      </PagerView>

      <View style={[s.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {TABS.map((tab, i) => {
          const active = i === page;
          const color = active ? theme.primary : theme.textSecondary;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabItem}
              onPress={() => goToPage(i)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(active ? tab.icon : tab.iconOutline) as any}
                size={26}
                color={color}
              />
              <Text style={[s.tabLabel, { color }]}>
                {t(`tabs.${tab.key}`)}
              </Text>
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
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
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
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
