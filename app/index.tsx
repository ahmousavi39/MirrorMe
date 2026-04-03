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

  const { theme } = useTheme();
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Your App Name</Text>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: theme.card }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Ionicons name="rocket" size={48} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome!</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            This is a template app with theme support, navigation, and reusable components.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => {
            // Add your action here
            console.log('Button pressed');
          }}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>
            Get Started
          </Text>
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            ✨ Light and Dark theme support
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            📱 Cross-platform (iOS, Android, Web)
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            🎨 Customizable colors and styles
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            ⚙️ Settings modal included
          </Text>
        </View>
      </ScrollView>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
  },
  settingsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoContainer: {
    paddingVertical: 20,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
});
