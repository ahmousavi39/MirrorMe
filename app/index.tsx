import { useTheme } from '@/contexts/ThemeContext';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

