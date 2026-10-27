import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { requestNativeReview } from '../lib/appRating';
import BottomSheet from './BottomSheet';
import HapticTouchable from './HapticTouchable';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAnswered: () => void;
  theme: Theme;
  t: (key: any) => string;
  userId: string | null;
}

export default function RatingPromptSheet({ visible, onClose, onAnswered, theme, t, userId }: Props) {
  const styles = createStyles(theme);
  const [step, setStep] = useState<'ask' | 'feedback' | 'thanks'>('ask');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setStep('ask');
    setFeedback('');
    setSending(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 250);
  };

  const handleYes = () => {
    onAnswered();
    requestNativeReview();
    handleClose();
  };

  const handleNo = () => {
    onAnswered();
    setStep('feedback');
  };

  const handleSubmitFeedback = async () => {
    const message = feedback.trim();
    if (!message || !userId) return;
    setSending(true);
    const { error } = await supabase.from('app_feedback').insert({ user_id: userId, message });
    setSending(false);
    if (!error) {
      setStep('thanks');
      setTimeout(handleClose, 1600);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} theme={theme}>
      {step === 'ask' && (
        <View style={styles.wrap}>
          <View style={styles.iconWrap}>
            <Ionicons name="star" size={24} color={theme.gold} />
          </View>
          <Text style={styles.question}>{t('rating_question')}</Text>
          <HapticTouchable style={styles.primaryBtn} onPress={handleYes}>
            <Text style={styles.primaryBtnText}>{t('rating_yes')}</Text>
          </HapticTouchable>
          <HapticTouchable style={styles.secondaryBtn} onPress={handleNo}>
            <Text style={styles.secondaryBtnText}>{t('rating_no')}</Text>
          </HapticTouchable>
        </View>
      )}

      {step === 'feedback' && (
        <View style={styles.wrap}>
          <Text style={styles.question}>{t('rating_feedbackTitle')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('rating_feedbackPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            autoFocus
          />
          <HapticTouchable
            style={[styles.primaryBtn, !feedback.trim() && styles.primaryBtnDisabled]}
            onPress={handleSubmitFeedback}
            disabled={!feedback.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={Paper.ink} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('rating_feedbackSubmit')}</Text>
            )}
          </HapticTouchable>
        </View>
      )}

      {step === 'thanks' && (
        <View style={styles.wrap}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
          </View>
          <Text style={styles.question}>{t('rating_feedbackThanks')}</Text>
        </View>
      )}
    </BottomSheet>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, alignItems: 'center' },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: CARD_RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    question: {
      fontSize: 16,
      fontFamily: FontFamily.display,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 22,
    },
    primaryBtn: {
      width: '100%',
      height: 48,
      borderRadius: CARD_RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    primaryBtnDisabled: { backgroundColor: theme.border },
    primaryBtnText: { fontSize: 14, fontFamily: FontFamily.bodySemiBold, color: Paper.ink },
    secondaryBtn: {
      width: '100%',
      height: 48,
      borderRadius: CARD_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryBtnText: { fontSize: 14, fontFamily: FontFamily.bodySemiBold, color: theme.textSecondary },
    input: {
      width: '100%',
      minHeight: 90,
      backgroundColor: theme.card2,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      fontSize: 14,
      fontFamily: FontFamily.mono,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
      textAlignVertical: 'top',
    },
  });
