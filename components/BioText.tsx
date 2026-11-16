// Hakkımda metni: en fazla 4 satır gösterilir, "Devamını gör" ile tamamı açılır.
// Kırpılma kararı: metin uzun ya da çok satırlıysa, ayrıca ekran ölçümü 4 satırı aşarsa.
import { useState } from 'react';
import { Text, StyleSheet, type TextLayoutEvent } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';

const COLLAPSED_LINES = 4;

export default function BioText({ text }: { text: string }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const [measuredOverflow, setMeasuredOverflow] = useState(false);

  const mayOverflow = text.length > 180 || text.split('\n').length > COLLAPSED_LINES;
  const showToggle = expanded || mayOverflow || measuredOverflow;

  const onTextLayout = (event: TextLayoutEvent) => {
    if (!expanded) setMeasuredOverflow(event.nativeEvent.lines.length > COLLAPSED_LINES);
  };

  return (
    <>
      <Text
        style={styles.text}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
        onTextLayout={onTextLayout}
      >
        {text}
      </Text>
      {showToggle && (
        <HapticTouchable style={styles.toggle} onPress={() => setExpanded((value) => !value)}>
          <Text style={styles.toggleText}>{expanded ? t('bio_less') : t('bio_more')}</Text>
        </HapticTouchable>
      )}
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    text: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 21, color: theme.textSecondary },
    toggle: { marginTop: 8, alignSelf: 'flex-start' },
    toggleText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.gold },
  });
