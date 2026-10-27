import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { extractYouTubeId } from '../lib/socialSaha';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';

const RADIUS = CARD_RADIUS;

type Mode = 'media' | 'match_video';

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

function formatDateForSupabase(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CreatePostScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const styles = createStyles(theme);

  const [mode, setMode] = useState<Mode>('media');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Photo / video upload
  const [pickedAsset, setPickedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Match video (YouTube)
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [venueName, setVenueName] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [highlightStart, setHighlightStart] = useState('');
  const [highlightEnd, setHighlightEnd] = useState('');

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        t('aiAnalysis_galleryPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPickedAsset(result.assets[0]);
  };

  const resolveUid = async (): Promise<string | null> => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const handleSubmitMedia = async () => {
    if (!pickedAsset) {
      setToast({ message: t('social_selectMediaFirst'), type: 'error' });
      return;
    }
    const uid = await resolveUid();
    if (!uid) {
      setToast({ message: t('createMatch_needSession'), type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const isVideo = pickedAsset.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${uid}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
      const buffer = await fetch(pickedAsset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('posts-media')
        .upload(path, buffer, { contentType: isVideo ? 'video/mp4' : 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('posts-media').getPublicUrl(path);

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: uid,
        post_type: isVideo ? 'video' : 'photo',
        media_url: urlData.publicUrl,
        caption: caption.trim() || null,
      });
      if (insertError) throw insertError;

      setToast({ message: t('social_postCreated'), type: 'success' });
      setTimeout(() => navigate('socialFeed'), 600);
    } catch (err) {
      if (__DEV__) console.log('Paylaşım oluşturulamadı:', err);
      setToast({ message: t('social_postCreateFailed'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMatchVideo = async () => {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      setToast({ message: t('social_invalidYoutubeUrl'), type: 'error' });
      return;
    }
    const uid = await resolveUid();
    if (!uid) {
      setToast({ message: t('createMatch_needSession'), type: 'error' });
      return;
    }

    const startSec = highlightStart.trim() ? parseInt(highlightStart, 10) : null;
    const endSec = highlightEnd.trim() ? parseInt(highlightEnd, 10) : null;

    setSaving(true);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: uid,
        post_type: 'match_video',
        media_url: youtubeUrl.trim(),
        youtube_video_id: videoId,
        venue_name: venueName.trim() || null,
        match_date: formatDateForSupabase(matchDate),
        caption: caption.trim() || null,
        highlight_start_sec: Number.isFinite(startSec) ? startSec : null,
        highlight_end_sec: Number.isFinite(endSec) ? endSec : null,
      });
      if (error) throw error;

      setToast({ message: t('social_postCreated'), type: 'success' });
      setTimeout(() => navigate('socialFeed'), 600);
    } catch (err) {
      if (__DEV__) console.log('Maç videosu paylaşılamadı:', err);
      setToast({ message: t('social_postCreateFailed'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'media') handleSubmitMedia();
    else handleSubmitMatchVideo();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('socialFeed')} disabled={saving}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('social_createPost')}</Text>
          <HapticTouchable onPress={handleSubmit} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color={theme.gold} /> : <Text style={styles.saveBtnText}>{t('social_shareButton')}</Text>}
          </HapticTouchable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.modeRow}>
            <HapticTouchable
              style={[styles.modePill, mode === 'media' && styles.modePillActive]}
              onPress={() => setMode('media')}
            >
              <Ionicons name="image-outline" size={14} color={mode === 'media' ? Paper.ink : theme.textSecondary} />
              <Text style={[styles.modePillText, mode === 'media' && styles.modePillTextActive]}>
                {t('social_postTypePhotoVideo')}
              </Text>
            </HapticTouchable>
            <HapticTouchable
              style={[styles.modePill, mode === 'match_video' && styles.modePillActive]}
              onPress={() => setMode('match_video')}
            >
              <Ionicons name="logo-youtube" size={14} color={mode === 'match_video' ? Paper.ink : theme.textSecondary} />
              <Text style={[styles.modePillText, mode === 'match_video' && styles.modePillTextActive]}>
                {t('social_postTypeMatchVideo')}
              </Text>
            </HapticTouchable>
          </View>

          {mode === 'media' ? (
            <HapticTouchable style={styles.mediaPicker} onPress={pickMedia}>
              {pickedAsset ? (
                pickedAsset.type === 'video' ? (
                  <View style={styles.mediaPreviewVideo}>
                    <Ionicons name="videocam" size={28} color={theme.gold} />
                    <Text style={styles.mediaPreviewVideoText}>{t('social_videoSelected')}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: pickedAsset.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
                )
              ) : (
                <View style={styles.mediaPickerEmpty}>
                  <Ionicons name="add-circle-outline" size={28} color={theme.gold} />
                  <Text style={styles.mediaPickerText}>{t('social_selectMedia')}</Text>
                </View>
              )}
            </HapticTouchable>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('social_youtubeLinkLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  placeholder={t('social_youtubeLinkPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('social_venueLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={venueName}
                  onChangeText={setVenueName}
                  placeholder={t('social_venuePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('social_matchDateLabel')}</Text>
                <HapticTouchable style={styles.input} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.inputValueText}>
                    {matchDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </HapticTouchable>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={matchDate}
                  mode="date"
                  display="spinner"
                  locale={dateLocale}
                  maximumDate={new Date()}
                  onChange={(_event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setMatchDate(selectedDate);
                  }}
                />
              )}

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.inputLabel}>{t('social_highlightStartLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={highlightStart}
                    onChangeText={setHighlightStart}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.inputLabel}>{t('social_highlightEndLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={highlightEnd}
                    onChangeText={setHighlightEnd}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('social_captionLabel')}</Text>
            <TextInput
              style={[styles.input, styles.captionInput]}
              value={caption}
              onChangeText={setCaption}
              placeholder={t('social_captionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
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
    title: { color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5 },
    saveBtn: { paddingHorizontal: 4, paddingVertical: 8, minWidth: 42, alignItems: 'flex-end' },
    saveBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.gold },
    content: { paddingHorizontal: 24, paddingBottom: 60 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    modePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      paddingVertical: 10,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
    },
    modePillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    modePillText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textSecondary },
    modePillTextActive: { color: Paper.ink },
    mediaPicker: {
      height: 200,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 16,
    },
    mediaPickerEmpty: { alignItems: 'center', gap: 8 },
    mediaPickerText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    mediaPreviewImage: { width: '100%', height: '100%' },
    mediaPreviewVideo: { alignItems: 'center', gap: 8 },
    mediaPreviewVideoText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      minHeight: 48,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'center',
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    captionInput: { minHeight: 90, textAlignVertical: 'top' },
    inputValueText: { fontFamily: FontFamily.mono, color: theme.text, fontSize: 14 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
  });
