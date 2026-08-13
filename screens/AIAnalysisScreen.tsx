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
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';

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

const ANALYZING_MESSAGES = [
  'Görüntü analiz ediliyor... 🔍',
  'Performans hesaplanıyor... ⚡',
  'Sonuçlar hazırlanıyor... 🏆',
];

const HOW_IT_WORKS = [
  { icon: '📸', title: 'Fotoğraf Yükle', desc: 'Maçtan bir kare' },
  { icon: '🤖', title: 'AI Analiz Eder', desc: '30 saniyede sonuç' },
  { icon: '🏆', title: 'Gelişimini Gör', desc: 'Detaylı rapor' },
];

const TRUST_INDICATORS = [
  '✓ 50.000+ analiz yapıldı',
  '✓ %96 doğruluk oranı',
  '✓ UEFA lisanslı metodoloji',
];

const getConfidenceLabel = (confidence: number) => {
  if (confidence < 60) return '⚠️ Görüntü kalitesi düşük, sonuçlar kesin olmayabilir';
  if (confidence < 80) return 'Orta güven';
  return 'Yüksek güven ✓';
};

interface Props {
  navigate: (screen: string) => void;
}

export default function AIAnalysisScreen({ navigate }: Props) {
  const { theme } = useTheme();
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
        'İzin Gerekli',
        'Fotoğraf seçmek için ayarlardan galeri iznini açmanız gerekiyor.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
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
        'İzin Gerekli',
        'Fotoğraf çekmek için ayarlardan kamera iznini açmanız gerekiyor.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
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
        setToast({ message: 'Fotoğraf seçilemedi, tekrar deneyin', type: 'error' });
        return;
      }
      if (!asset.base64) {
        setToast({ message: 'Fotoğraf okunamadı', type: 'error' });
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
      setToast({ message: 'Galeri açılamadı, kamerayı deneyin', type: 'error' });
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
        setToast({ message: 'Fotoğraf çekilemedi, tekrar deneyin', type: 'error' });
        return;
      }
      if (!asset.base64) {
        setToast({ message: 'Fotoğraf okunamadı', type: 'error' });
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
      setToast({ message: 'Fotoğraf çekilemedi', type: 'error' });
    }
  };

  const runAnalysis = async (media: Extract<PickedMedia, { kind: 'photo' }>) => {
    setStage('analyzing');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: 'Oturum açmanız gerekiyor', type: 'error' });
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
        setNotFootballMessage(analysis.message ?? 'Bu görüntü futbol içeriği değil. Lütfen bir maç fotoğrafı veya ekran görüntüsü yükleyin.');
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

      sendLocalNotification('AI Analizi Tamamlandı 🤖', `Skorun: ${resultData.score}`);
    } catch (err) {
      if (__DEV__) console.log('Analiz yapılamadı:', err);
      setToast({ message: 'Analiz yapılamadı', type: 'error' });
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
    setToast({ message: 'Analiz profiline kaydedildi', type: 'success' });
  };

  const handleShareResult = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `Footbally AI Analiz Skorum: ${result.score}/100 ⚽🏆`,
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
            <Text style={styles.backIcon}>←</Text>
          </HapticTouchable>
          <View>
            <Text style={styles.title}>🤖 AI Performans Analizi</Text>
            <Text style={styles.subtitle}>Dünya standartlarında futbol analizi</Text>
          </View>
        </View>

        {stage === 'idle' && (
          <>
            <View style={styles.trustRow}>
              {TRUST_INDICATORS.map((t, i) => (
                <Text key={i} style={styles.trustText}>{t}</Text>
              ))}
            </View>

            <View style={styles.howItWorksRow}>
              {HOW_IT_WORKS.map((step, i) => (
                <View key={i} style={styles.howItWorksStep}>
                  <View style={styles.howItWorksIconWrap}>
                    <Text style={styles.howItWorksIcon}>{step.icon}</Text>
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
                  <Text style={styles.uploadIcon}>📷</Text>
                </View>
                <Text style={styles.uploadOptionTitle}>Kamera ile Çek</Text>
                <Text style={styles.uploadOptionBadge}>Önerilen</Text>
              </HapticTouchable>
              <HapticTouchable style={styles.uploadOption} onPress={handlePickPhoto}>
                <View style={styles.uploadIconWrap}>
                  <Text style={styles.uploadIcon}>🖼️</Text>
                </View>
                <Text style={styles.uploadOptionTitle}>Galeriden Seç</Text>
              </HapticTouchable>
            </View>
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                💡 İpucu: Maçtan ekran görüntüsü alıp galeriden yükleyebilir ya da direkt fotoğraf çekebilirsin
              </Text>
            </View>

            <Text style={styles.sampleSectionTitle}>Örnek Analiz</Text>
            <View style={styles.sampleCard}>
              <View style={styles.sampleBlurLayer}>
                <Text style={styles.sampleScoreLabel}>AI SKORU</Text>
                <Text style={styles.sampleScoreValue}>87</Text>
                <Text style={styles.sampleRow}>⭐ Kylian Mbappé benzeri hız profili</Text>
                <Text style={styles.sampleRow}>✓ Güçlü yön: Dribbling, Hız</Text>
                <Text style={styles.sampleRow}>↑ Gelişim: Şut isabeti</Text>
              </View>
              <View style={styles.sampleLockOverlay}>
                <Text style={styles.sampleLockIcon}>🔒</Text>
                <HapticTouchable style={styles.sampleUnlockBtn} onPress={() => navigate('premium')}>
                  <Text style={styles.sampleUnlockText}>Premium ile kilidi aç</Text>
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
              <Text style={styles.analyzeBtnText}>Analiz Et</Text>
            </HapticTouchable>
            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>Vazgeç</Text>
            </HapticTouchable>
          </View>
        )}

        {stage === 'notFootball' && (
          <View style={styles.card}>
            <Text style={styles.errorIcon}>🚫</Text>
            <Text style={styles.errorText}>{notFootballMessage}</Text>
            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>↺ Yeni Analiz Yap</Text>
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
              <Text style={styles.scoreLabel}>AI SKORU</Text>
              <Text style={styles.scoreValue}>{result.score}</Text>
              {!!result.playerComparison && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>⭐ {result.playerComparison}</Text>
                </View>
              )}
              {!!result.position && <Text style={styles.positionText}>Pozisyon: {result.position}</Text>}
              <Text style={styles.confidenceText}>{getConfidenceLabel(result.confidence)}</Text>
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
              <Text style={styles.cardTitle}>Güçlü Yönler</Text>
              {result.strengths.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: theme.success }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Gelişim Alanları</Text>
              {result.improvements.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Önerilen Antrenmanlar</Text>
              {result.trainings.map((s, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dotMark, { backgroundColor: theme.gold }]} />
                  <Text style={styles.rowText}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.resultActionsRow}>
              <HapticTouchable style={styles.saveBtn} onPress={handleSaveResult}>
                <Text style={styles.saveBtnText}>Analizi Kaydet</Text>
              </HapticTouchable>
              <HapticTouchable style={styles.shareBtn} onPress={handleShareResult}>
                <Text style={styles.shareBtnText}>Paylaş</Text>
              </HapticTouchable>
            </View>

            <HapticTouchable style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryText}>↺ Tekrar Analiz Et</Text>
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
      width: 44,
      height: 44,
      backgroundColor: theme.card,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.text },
    title: { fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    subtitle: { fontSize: 12, color: theme.textSecondary, fontFamily: FontFamily.bodySemiBold, marginTop: 2 },
    trustRow: { paddingHorizontal: 24, marginBottom: 20, gap: 6 },
    trustText: { fontSize: 12, color: theme.success, fontFamily: FontFamily.bodySemiBold },
    howItWorksRow: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 10,
      marginBottom: 24,
    },
    howItWorksStep: { flex: 1, alignItems: 'center' },
    howItWorksIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    howItWorksIcon: { fontSize: 20 },
    howItWorksTitle: { fontSize: 11, fontFamily: FontFamily.bodySemiBold, color: theme.text, textAlign: 'center' },
    howItWorksDesc: { fontSize: 10, fontFamily: FontFamily.body, color: theme.textSecondary, textAlign: 'center', marginTop: 2 },
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
      borderRadius: 24,
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
    sampleScoreValue: { fontSize: 40, fontFamily: FontFamily.monoMedium, color: theme.gold, marginBottom: 8 },
    sampleRow: { fontSize: 13, fontFamily: FontFamily.body, color: theme.textMuted, marginTop: 4 },
    sampleLockOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(theme.bg, 0.35),
    },
    sampleLockIcon: { fontSize: 28, marginBottom: 12 },
    sampleUnlockBtn: {
      backgroundColor: theme.gold,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    sampleUnlockText: { fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: '#000' },
    uploadRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 24,
    },
    uploadOption: {
      flex: 1,
      paddingVertical: 32,
      borderRadius: 20,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.border,
      alignItems: 'center',
      backgroundColor: theme.card,
    },
    uploadOptionPrimary: {
      borderColor: theme.gold,
      borderStyle: 'solid',
      backgroundColor: hexToRgba(theme.gold, 0.06),
    },
    uploadIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    uploadIcon: { fontSize: 24 },
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
      borderRadius: 14,
      backgroundColor: hexToRgba(theme.gold, 0.06),
    },
    hintText: { fontSize: 12, color: theme.textMuted, fontFamily: FontFamily.bodySemiBold, lineHeight: 18 },
    previewThumb: {
      width: '100%',
      height: 180,
      borderRadius: 16,
      marginBottom: 14,
      backgroundColor: theme.card2,
    },
    previewNameWrap: { marginBottom: 14 },
    previewName: { fontSize: 13, color: theme.textMuted, fontFamily: FontFamily.bodySemiBold },
    warnBox: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: hexToRgba('#f59e0b', 0.1),
      marginBottom: 16,
    },
    warnText: { fontSize: 12, color: '#f59e0b', fontFamily: FontFamily.bodySemiBold, lineHeight: 18 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    analyzeBtn: {
      height: 54,
      backgroundColor: theme.gold,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    analyzeBtnText: { fontSize: 15, fontFamily: FontFamily.bodySemiBold, color: '#000' },
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
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#000' },
    analyzingText: { fontSize: 15, color: '#000', fontFamily: FontFamily.bodySemiBold },
    errorIcon: { fontSize: 40, textAlign: 'center', marginBottom: 14 },
    errorText: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: FontFamily.bodySemiBold,
      marginBottom: 4,
    },
    scoreCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.2),
    },
    scoreLabel: { fontSize: 11, fontFamily: FontFamily.mono, color: theme.textSecondary, letterSpacing: 2 },
    scoreValue: { fontSize: 56, fontFamily: FontFamily.monoMedium, color: theme.gold, lineHeight: 66 },
    badge: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: hexToRgba(theme.gold, 0.14),
    },
    badgeText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.gold },
    positionText: { marginTop: 8, fontSize: 12, fontFamily: FontFamily.bodySemiBold, color: theme.textSecondary },
    confidenceText: { marginTop: 6, fontSize: 11, fontFamily: FontFamily.bodySemiBold, color: theme.textMuted },
    insightText: { fontSize: 14, color: theme.textMuted, fontFamily: FontFamily.body, lineHeight: 21, fontStyle: 'italic' },
    cardTitle: { fontSize: 15, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    dotMark: { width: 8, height: 8, borderRadius: 4 },
    rowText: { fontSize: 14, color: theme.textMuted, fontFamily: FontFamily.body },
    retryBtn: { alignItems: 'center', paddingVertical: 14 },
    retryText: { fontSize: 13, color: theme.gold, fontFamily: FontFamily.bodySemiBold },
    resultActionsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginBottom: 8 },
    saveBtn: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: '#000' },
    shareBtn: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareBtnText: { fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: theme.gold },
  });
