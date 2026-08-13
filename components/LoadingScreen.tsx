import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.gold} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      marginTop: 16,
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '600',
    },
  });
