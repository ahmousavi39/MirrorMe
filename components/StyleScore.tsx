import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface StyleScoreProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#30D158';  // green
  if (score >= 6) return '#FF9F0A';  // orange
  return '#FF453A';                  // red
}

function getScoreLabel(score: number): string {
  if (score >= 9) return 'Style Icon';
  if (score >= 8) return 'Looking Great!';
  if (score >= 7) return 'Solid Look';
  if (score >= 6) return 'Pretty Good';
  if (score >= 5) return 'Needs Work';
  return 'Major Makeover';
}

export default function StyleScore({ score }: StyleScoreProps) {
  const { theme } = useTheme();
  const color = getScoreColor(score);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.circle, { borderColor: color, backgroundColor: theme.card }]}>
        <Text style={[styles.number, { color }]}>{score.toFixed(1)}</Text>
        <Text style={[styles.outOf, { color: theme.textSecondary }]}>/10</Text>
      </View>
      <Text style={[styles.label, { color }]}>{getScoreLabel(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  number: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 50,
  },
  outOf: {
    fontSize: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
  },
});
