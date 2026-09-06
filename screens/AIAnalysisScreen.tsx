import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
  Linking,
  Share,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

type Stage = 'idle' | 'preview' | 'analyzing' | 'result' | 'notFootball';

type AnalysisResult = {
  score: number;
  confidence: number;
  playerComparison: string;
  position: string;
  strengths: string[];
  improvements: string[];
  trainings: string[];
  insight: string;
  warning: string | null;
};

type PickedMedia = { kind: 'photo'; uri: string; fileName: string; base64: string };

const getAnalyzingMessages = (t: (key: any) => string) => [
  t('aiAnalysis_msg1'),
  t('aiAnalysis_msg2'),
  t('aiAnalysis_msg3'),
];

const getHowItWorks = (t: (key: any) => string): { icon: IoniconName; title: string; desc: string }[] => [
  { icon: 'camera-outline', title: t('aiAnalysis_step1Title'), desc: t('aiAnalysis_step1Desc') },
  { icon: 'hardware-chip-outline', title: t('aiAnalysis_step2Title'), desc: t('aiAnalysis_step2Desc') },
  { icon: 'trophy-outline', title: t('aiAnalysis_step3Title'), desc: t('aiAnalysis_step3Desc') },
];

const getTrustIndicators = (t: (key: any) => string) => [
  t('aiAnalysis_trust1'),
  t('aiAnalysis_trust2'),
  t('aiAnalysis_trust3'),
];

const getConfidenceLabel = (confidence: number, t: (key: any) => string) => {
  if (confidence < 60) return t('aiAnalysis_confidenceLow');
  if (confidence < 80) return t('aiAnalysis_confidenceMid');
  return t('aiAnalysis_confidenceHigh');
};

interface Props {
  navigate: (screen: string) => void;
}

export default function AIAnalysisScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const ANALYZING_MESSAGES = getAnalyzingMessages(t);
  const HOW_IT_WORKS = getHowItWorks(t);
  const TRUST_INDICATORS = getTrustIndicators(t);
  const styles = createStyles(theme);
  const [stage, setStage] = useState<Stage>('idle');
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFootballMessage, setNotFootballMessage] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const dotAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage !== 'analyzing') return;
    const loops = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());

    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ANALYZING_MESSAGES.length);
    }, 1500);

    return () => {
      loops.forEach((loop) => loop.stop());
      clearInterval(interval);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'result') return;
    scoreAnim.setValue(0);
    Animated.spring(scoreAnim, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [stage]);

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        t('aiAnalysis_galleryPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        t('aiAnalysis_cameraPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const handlePickPhoto = async () => {
    try {
      const granted = await requestGalleryPermission();
      if (!granted) return;

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
        exif: false,
      });
      if (__DEV__) console.log('Photo picker result:', picked);
      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      if (!asset) {
        setToast({ message: t('aiAnalysis_pickFailed'), type: 'error' });
        return;
      }
      if (!asset.base64) {
        setToast({ message: t('aiAnalysis_readFailed'), type: 'error' });
        return;
      }

      const photoMedia: PickedMedia = {
        kind: 'photo',
        uri: asset.uri,
        fileName: asset.fileName ?? 'photo.jpg',
        base64: asset.base64,
      };
      setMedia(photoMedia);
      setResult(null);
      setStage('preview');
      await runAnalysis(photoMedia);
    } catch (err) {
      if (__DEV__) console.log('Fotoğraf seçilemedi:', err);
      setToast({ message: t('aiAnalysis_galleryOpenFailed'), type: 'error' });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const granted = await requestCameraPermission();
      if (!granted) return;

      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });
      if (__DEV__) console.log('Camera picker result:', picked);
      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      if (!asset) {
        setToast({ message: t('aiAnalysis_captureFailedRetry'), type: 'error' });
        return;
      }
      if (!asset.base64) {
        setToast({ message: t('aiAnalysis_readFailed'), type: 'error' });
        return;
      }

      const photoMedia: PickedMedia = {
        kind: 'photo',
        uri: asset.uri,
        fileName: asset.fileName ?? 'photo.jpg',
        base64: asset.base64,
      };
      setMedia(photoMedia);
      setResult(null);
      setStage('preview');
      await runAnalysis(photoMedia);
    } catch (err) {
      if (__DEV__) console.log('Fotoğraf çekilemedi:', err);
      setToast({ message: t('aiAnalysis_captureFailed'), type: 'error' });
    }
  };

  const runAnalysis = async (media: Extract<PickedMedia, { kind: 'photo' }>) => {
    setStage('analyzing');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: t('createMatch_needSession'), type: 'error' });
        setStage('preview');
        return;
      }

      const minDelay = new Promise((resolve) => setTimeout(resolve, 3000));

      const work = async () => {
        const ext = media.fileName.includes('.') ? media.fileName.split('.').pop() : 'jpg';
        const storagePath = `${user.id}/${Date.now()}.${ext}`;

        const buffer = await fetch(media.uri).then((r) => r.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(storagePath, buffer, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;

        const { data: analysis, error: fnError } = await supabase.functions.invoke('analyze-video', {
          body: { image: media.base64, userId: user.id, type: 'image', storagePath },
        });
        if (__DEV__) console.log('analyze-video response:', analysis, fnError);
        if (fnError) throw fnError;
        if (!analysis || analysis.error) throw new Error(analysis?.error ?? 'Analiz başarısız');

        return { analysis };
      };

      const [{ analysis }] = await Promise.all([work(), minDelay]);

      if (analysis.valid === false) {
        setNotFootballMessage(analysis.message ?? t('aiAnalysis_notFootballDefault'));
        setStage('notFootball');
        return;
      }

      const resultData: AnalysisResult = {
        score: analysis.score,
        confidence: analysis.confidence ?? 0,
        playerComparison: analysis.playerComparison ?? '',
        position: analysis.position ?? '',
        strengths: analysis.strengths ?? [],
        improvements: analysis.improvements ?? [],
        trainings: analysis.trainings ?? [],
        insight: analysis.insight ?? '',
        warning: analysis.warning ?? null,
      };
      setResult(resultData);
      setStage('result');

      sendLocalNotification(t('aiAnalysis_completedNotifTitle'), `${t('aiAnalysis_completedNotifBodyPrefix')} ${resultData.score}`);
    } catch (err) {
      if (__DEV__) console.log('Analiz yapılamadı:', err);
      setToast({ message: t('aiAnalysis_analysisFailed'), type: 'error' });
      setStage('preview');
    }
  };

  const handleAnalyze = async () => {
    if (!media || media.kind !== 'photo') return;
    await runAnalysis(media);
  };

  const handleReset = () => {
    setMedia(null);
    setResult(null);
    setStage('idle');
  };

  const handleSaveResult = () => {
    setToast({ message: t('aiAnalysis_savedToast'), type: 'success' });
  };

  const handleShareResult = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `${t('aiAnalysis_shareMessagePrefix')} ${result.score}/100`,
      });
    } catch (err) {
      if (__DEV__) console.log('Paylaşılamadı:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <View>
            <Text style={styles.title}>{t('aiAnalysis_title')}</Text>
            <Text style={styles.subtitle}>{t('aiAnalysis_subtitle')}</Text>
          </View>
        </View>

        {stage === 'idle' && (
          <>
            <View style={styles.trustRow}>
              {TRUST_INDICATORS.map((indicator, i) => (
                <Text key={i} style={styles.trustText}>{indicator}</Text>
              ))}
            </View>

            <View style={styles.howItWorksRow}>
              {HOW_IT_WORKS.map((step, i) => (
                <View key={i} style={styles.howItWorksStep}>
                  <View style={styles.howItWorksIconWrap}>
                    <Ionicons name={step.icon} size={20} color={theme.gold} />
                  </View>
                  <Text style={styles.howItWorksTitle}>{step.title}</Text>
                  <Text style={styles.howItWorksDesc}>{step.desc}</Text>
                </View>
              ))}
            </View>

            <View style={styles.uploadRow}>
              <HapticTouchable
                style={[styles.uploadOption, styles.uploadOptionPrimary]}
                onPress={handleTakePhoto}
              >
                <View style={styles.uploadIconWrap}>
                  <Ionicons name="camera-outline" size={24} color={theme.gold} />
                </View>
                <Text style={styles.uploadOptionTitle}>{t('aiAnalysis_takePhoto')}</Text>
                <Text style={styles.uploadOptionBadge}>{t('aiAnalysis_recommended')}</Text>
              </HapticTouchable>
              <HapticTouchable style={styles.uploadOption} onPress={handlePickPhoto}>
                <View style={styles.uploadIconWrap}>
                  <Ionicons name="images-outline" size={24} color={theme.gold} />
                </View>
                <Text style={styles.uploadOptionTitle}>{t('aiAnalysis_pickFromGallery')}</Text>
              </HapticTouchable>
            </View>
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                {t('aiAnalysis_hint')}
              </Text>
            </View>

            <Text style={styles.sampleSectionTitle}>{t('aiAnalysis_sampleSectionTitle')}</Text>
            <View style={styles.sampleCard}>
              <View style={styles.sampleBlurLayer}>
                <Text style={styles.sampleScoreLabel}>{t('aiAnalysis_aiScoreLabel')}</Text>
                <Text style={styles.sampleScoreValue}>87</Text>
                <Text style={styles.sampleRow}>{t('aiAnalysis_sampleComparison')}</Text>
                <Text style={styles.sampleRow}>{t('aiAnalysis_sampleStrength')}</Text>
                <Text style={styles.sampleRow}>{t('aiAnalysis_sampleImprovement')}</Text>
              </View>
              <View style={styles.sampleLockOverlay}>
                <Ionicons name="lock-closed-outline" size={22} color={theme.text} style={{ marginBottom: 12 }} />
                <HapticTouchable style={styles.sampleUnlockBtn} onPress={() => navigate('premium')}>
                  <Text style={styles.sampleUnlockText}>{t('aiAnalysis_unlockWithPremium')}</Text>
                </HapticTouchable>
              </View>
            </View>
          </>
        )}

        {stage === 'preview' && media && media.kind === 'photo' && (
          <View style={styles.card}>
            <Image source={{ uri: media.uri }} style={styles.previewThumb} />
            <View style={styles.previewNameWrap}>
              <Text style={styles.previewName} numberOfLines={1}>{media.fileName}</Text>
            </View>
            <HapticTouchable style={styles.analyzeBtn} onPress={handleAnalyze}>
              <Text style={styles.analyzeBtnText}>{t('aiAnalysis_analyze')}</Text>
            </HapticTouchable>
            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>{t('match_giveUp')}</Text>
            </HapticTouchable>
          </View>
        )}

        {stage === 'notFootball' && (
          <View style={styles.card}>
            <Ionicons name="close-circle-outline" size={32} color={theme.error} style={{ alignSelf: 'center', marginBottom: 14 }} />
            <Text style={styles.errorText}>{notFootballMessage}</Text>
            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>{t('aiAnalysis_newAnalysis')}</Text>
            </HapticTouchable>
          </View>
        )}

        {stage === 'result' && result && (
          <View>
            <Animated.View
              style={[
                styles.scoreCard,
                {
                  opacity: scoreAnim,
                  transform: [
                    {
                      scale: scoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.scoreLabel}>{t('aiAnalysis_aiScoreLabel')}</Text>
              <Text style={styles.scoreValue}>{result.score}</Text>
              {!!result.playerComparison && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{result.playerComparison}</Text>
                </View>
              )}
              {!!result.position && <Text style={styles.positionText}>{t('aiAnalysis_positionPrefix')} {result.position}</Text>}
              <Text style={styles.confidenceText}>{getConfidenceLabel(result.confidence, t)}</Text>
            </Animated.View>

            {!!result.warning && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>{result.warning}</Text>
              </View>
            )}

            {!!result.insight && (
              <View style={styles.card}>
                <Text style={styles.insightText}>{result.insight}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('aiAnalysis_strengthsTitle')}</Text>
              {result.strengths.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: theme.success }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('aiAnalysis_improvementsTitle')}</Text>
              {result.improvements.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('aiAnalysis_trainingsTitle')}</Text>
              {result.trainings.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: theme.gold }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.resultActionsRow}>
              <HapticTouchable style={styles.saveBtn} onPress={handleSaveResult}>
                <Text style={styles.saveBtnText}>{t('aiAnalysis_saveResult')}</Text>
              </HapticTouchable>
              <HapticTouchable style={styles.shareBtn} onPress={handleShareResult}>
                <Text style={styles.shareBtnText}>{t('aiAnalysis_share')}</Text>
              </HapticTouchable>
            </View>

            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>{t('aiAnalysis_retryAnalysis')}</Text>
            </HapticTouchable>
          </View>
        )}
      </ScrollView>

      {stage === 'analyzing' && (
        <View style={styles.analyzingOverlay}>
          <View style={styles.dots}>
            {dotAnims.map((anim, i) => (
              <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
            ))}
          </View>
          <Text style={styles.analyzingText}>{ANALYZING_MESSAGES[messageIndex]}</Text>
        </View>
      )}

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
    },
    backBtn: {
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    subtitle: { fontSize: 12, color: theme.textSecondary, fontFamily: FontFamily.mono, marginTop: 2 },
    trustRow: { paddingHorizontal: 24, marginBottom: 20, gap: 6 },
    trustText: { fontSize: 12, color: theme.success, fontFamily: FontFamily.mono },
    howItWorksRow: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 10,
      marginBottom: 24,
    },
    howItWorksStep: { flex: 1, alignItems: 'center' },
    howItWorksIconWrap: {
      width: 46,
      height: 46,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    howItWorksTitle: { fontSize: 11, fontFamily: FontFamily.bodySemiBold, color: theme.text, textAlign: 'center' },
    howItWorksDesc: { fontSize: 10, fontFamily: FontFamily.mono, color: theme.textSecondary, textAlign: 'center', marginTop: 2 },
    sampleSectionTitle: {
      fontSize: 15,
      fontFamily: FontFamily.display,
      letterSpacing: 0.5,
      color: theme.text,
      paddingHorizontal: 24,
      marginTop: 24,
      marginBottom: 12,
    },
    sampleCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderRadius: RADIUS,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sampleBlurLayer: {
      backgroundColor: theme.card,
      padding: 24,
      alignItems: 'center',
      opacity: 0.35,
    },
    sampleScoreLabel: { fontSize: 11, fontFamily: FontFamily.mono, color: theme.textSecondary, letterSpacing: 2 },
    sampleScoreValue: { fontSize: 40, fontFamily: FontFamily.display, color: theme.gold, marginBottom: 8 },
    sampleRow: { fontSize: 13, fontFamily: FontFamily.mono, color: theme.textMuted, marginTop: 4 },
    sampleLockOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg,
      opacity: 0.9,
    },
    sampleUnlockBtn: {
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    sampleUnlockText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: Paper.ink },
    uploadRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 24,
    },
    uploadOption: {
      flex: 1,
      paddingVertical: 32,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      backgroundColor: theme.card,
    },
    uploadOptionPrimary: {
      borderColor: theme.gold,
      backgroundColor: theme.card,
    },
    uploadIconWrap: {
      width: 54,
      height: 54,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    uploadOptionTitle: { fontSize: 14, fontFamily: FontFamily.bodySemiBold, color: theme.text, textAlign: 'center' },
    uploadOptionBadge: {
      marginTop: 6,
      fontSize: 10,
      fontFamily: FontFamily.monoMedium,
      color: theme.gold,
      letterSpacing: 0.5,
    },
    hintBox: {
      marginHorizontal: 24,
      marginTop: 16,
      padding: 14,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    hintText: { fontSize: 12, color: theme.textMuted, fontFamily: FontFamily.mono, lineHeight: 18 },
    previewThumb: {
      width: '100%',
      height: 180,
      borderRadius: RADIUS,
      marginBottom: 14,
      backgroundColor: theme.card2,
    },
    previewNameWrap: { marginBottom: 14 },
    previewName: { fontSize: 13, color: theme.textMuted, fontFamily: FontFamily.mono },
    warnBox: {
      padding: 12,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: '#f59e0b',
      marginBottom: 16,
    },
    warnText: { fontSize: 12, color: '#f59e0b', fontFamily: FontFamily.mono, lineHeight: 18 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    analyzeBtn: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    analyzeBtnText: { fontSize: 14, fontFamily: FontFamily.display, letterSpacing: 0.5, color: Paper.ink },
    analyzingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      elevation: 100,
    },
    dots: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    dot: { width: 18, height: 3, borderRadius: 1.5, backgroundColor: Paper.ink },
    analyzingText: { fontSize: 14, color: Paper.ink, fontFamily: FontFamily.monoMedium },
    errorText: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: FontFamily.mono,
      marginBottom: 4,
    },
    scoreCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    scoreLabel: { fontSize: 11, fontFamily: FontFamily.mono, color: theme.textSecondary, letterSpacing: 2 },
    scoreValue: { fontSize: 52, fontFamily: FontFamily.display, color: theme.gold, lineHeight: 60 },
    badge: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    badgeText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.gold },
    positionText: { marginTop: 8, fontSize: 12, fontFamily: FontFamily.mono, color: theme.textSecondary },
    confidenceText: { marginTop: 6, fontSize: 11, fontFamily: FontFamily.mono, color: theme.textMuted },
    insightText: { fontSize: 14, color: theme.textMuted, fontFamily: FontFamily.body, lineHeight: 21, fontStyle: 'italic' },
    cardTitle: { fontSize: 15, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    dotMark: { width: 6, height: 6, borderRadius: 3 },
    rowText: { fontSize: 14, color: theme.textMuted, fontFamily: FontFamily.body },
    retryBtn: { alignItems: 'center', paddingVertical: 14 },
    retryText: { fontSize: 12, color: theme.gold, fontFamily: FontFamily.mono },
    resultActionsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginBottom: 8 },
    saveBtn: {
      flex: 1,
      height: 50,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: Paper.ink },
    shareBtn: {
      flex: 1,
      height: 50,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareBtnText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.gold },
  });
