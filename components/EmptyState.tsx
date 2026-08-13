import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import GoldButton from './GoldButton';

interface Props {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <GoldButton title={actionLabel} onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    icon: { fontSize: 48, marginBottom: 16, color: theme.gold },
    title: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 6, textAlign: 'center' },
    subtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
    action: { width: 200, height: 48, marginTop: 20 },
  });
