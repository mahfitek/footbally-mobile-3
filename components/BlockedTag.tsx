// Engellediğim kişi veya takımın liste satırında gösterilen küçük etiket. Satır yerinde kalır (tıklanınca profil açılır);
// mesaj, meydan okuma ve davet kısayolları ise bu etiketli satırlarda gösterilmez.
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, PILL_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

export default function BlockedTag() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{t('block_blockedLabel')}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    tag: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: PILL_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
    },
    text: { fontFamily: FontFamily.monoMedium, fontSize: 10, color: theme.textMuted, letterSpacing: 0.4 },
  });
