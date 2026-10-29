import { useEffect, useRef, useState, ElementRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
// expo-media-library'nin native modülü web'de yok; import'u statik bırakırsak
// (Metro her platformda değerlendirdiği için) web build'i anında çöküyor. Bu
// yüzden sadece native platformlarda lazy-require ediyoruz.
const MediaLibrary: typeof import('expo-media-library') | null =
  Platform.OS !== 'web' ? require('expo-media-library') : null;
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { calculateProfileCompletion } from '../lib/profileScore';
import { fetchPremiumStatus, INACTIVE_PREMIUM } from '../lib/premium';
import { getLevel, getBadges, currentMonthKey, MAX_REWARD_PREMIUM_DAYS_PER_MONTH } from '../lib/rewards';
import { sendLocalNotification } from '../lib/notifications';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';
import PlayerShareCard from '../components/PlayerShareCard';
import FadeInView from '../components/FadeInView';
import StatCard from '../components/StatCard';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import { FOOTBALL_POSITIONS } from '../constants/footballPositions';

interface GalleryItem {
  id: string;
  storage_path: string;
  url: string;
  created_at: string;
}

interface PlayerCardStats {
  hiz: number;
  pas: number;
  sut: number;
  dayaniklilik: number;
  dribbling: number;
  savunma: number;
}

const defaultCardStats = (score: number): PlayerCardStats => ({
  hiz: Math.max(1, Math.min(99, score + Math.floor(Math.random() * 10) - 5)),
  pas: Math.max(1, Math.min(99, score + Math.floor(Math.random() * 10) - 5)),
  sut: Math.max(1, Math.min(99, score - 5 + Math.floor(Math.random() * 10))),
  dayaniklilik: Math.max(1, Math.min(99, score + Math.floor(Math.random() * 8) - 4)),
  dribbling: Math.max(1, Math.min(99, score + Math.floor(Math.random() * 12) - 6)),
  savunma: Math.max(1, Math.min(99, score - 10 + Math.floor(Math.random() * 15))),
});

const skillsFromStats = (s: PlayerCardStats, t: (key: any) => string) => [
  { name: t('performance_skillSpeed'), value: s.hiz },
  { name: t('performance_skillPass'), value: s.pas },
  { name: t('performance_skillShot'), value: s.sut },
  { name: t('performance_skillStamina'), value: s.dayaniklilik },
  { name: t('performance_skillDribbling'), value: s.dribbling },
  { name: t('performance_skillDefense'), value: s.savunma },
];

const getExtraStats = (t: (key: any) => string) => [
  { val: '0', label: t('performance_goalsLabel') },
  { val: '0', label: t('profile_assistsLabel') },
  { val: '0', label: t('teamProfile_statMatches') },
];

const FOOT_OPTIONS = ['Sol Ayak', 'Sağ Ayak', 'Her İkisi'];

const AGE_OPTIONS = Array.from({ length: 32 }, (_, i) => i + 14);
const HEIGHT_OPTIONS = Array.from({ length: 71 }, (_, i) => i + 150);
const WEIGHT_OPTIONS = Array.from({ length: 76 }, (_, i) => i + 45);

// Kaydetmeden sonra sunucu tarafı skoru yeniler. refresh_my_score canlıda henüz olmayabilir;
// bu yüzden hata (eksik fonksiyon dahil) profil kaydını bozmaz, yalnızca geliştirme günlüğüne düşer.
const refreshServerScore = async (uid: string) => {
  try {
    const { error } = await profiles.refreshMyScore();
    if (error && __DEV__) console.log('Skor yenilenemedi (refresh_my_score):', uid, error.message);
  } catch (err) {
    if (__DEV__) console.log('Skor yenilenirken beklenmeyen hata:', err);
  }
};

interface Props {
  navigate: (screen: string, params?: any) => void;
  /** Görüntülenen profilin sahibi — kendi profilin için oturum kullanıcısı, başka
   * birinin profili için o kullanıcının id'si (bkz. App.tsx viewedProfileUserId). */
  userId?: string | null;
  /** Oturum açmış (görüntüleyen) kullanıcı — userId'den farklıysa "başkasının
   * profili" moduna geçilir (düzenleme/avatar yükleme gizlenir, Takip Et gösterilir). */
  currentUserId?: string | null;
  /** Sadece başkasının profili görüntülenirken verilir (bkz. App.tsx) — geri
   * dönüş için kullanılır; kendi profilinde (sekme kökü) gösterilmez. */
  onBack?: () => void;
}

type PickerType = 'position' | 'age' | 'height' | 'weight' | 'city' | 'district' | null;

export default function ProfileScreen({ navigate, userId, currentUserId, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [uploadingGalleryPhoto, setUploadingGalleryPhoto] = useState(false);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState<string | null>(null);
  const [showGalleryGrid, setShowGalleryGrid] = useState(false);

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [age, setAge] = useState('18');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');
  const [foot, setFoot] = useState('Sağ Ayak');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [club, setClub] = useState('');
  const [score, setScore] = useState(0);
  const [rawProfile, setRawProfile] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);

  // Sosyal Saha — takip sistemi (bkz. supabase/migrations/20261026101200_add_social_saha.sql)
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [openPicker, setOpenPicker] = useState<PickerType>(null);

  const [showShareCard, setShowShareCard] = useState(false);
  const [cardStats, setCardStats] = useState<PlayerCardStats>(defaultCardStats(0));
  // Set once an admin has reviewed an AI video-analysis job for this player
  // (profiles.overall_rating, written by ai-jobs.component.ts in admin-app).
  const [aiOverall, setAiOverall] = useState<number | null>(null);
  const cardRef = useRef<ElementRef<typeof ViewShot>>(null);

  // Görüntülenen profil (userId) oturumdaki kullanıcıdan (currentUserId)
  // farklıysa "başkasının profili" moduna geçilir: düzenleme/avatar
  // yükleme gizlenir, Takip Et butonu gösterilir.
  const isOwnProfile = !currentUserId || !userId || userId === currentUserId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const viewerUid = currentUserId ?? user?.id ?? null;
    const uid = userId ?? viewerUid;
    if (!uid) {
      setLoading(false);
      return;
    }

    // isPremiumActive öncelikle profiles.is_premium'dan okunur (bkz. aşağıdaki
    // hesaplama). Kolon yoksa yedek yol sunucudaki abonelik kaydıdır; user_metadata
    // istemci tarafından yazılabildiği için buradan Premium kararı verilmez.
    if (isOwnProfile && user) {
      const status = await fetchPremiumStatus(user.id).catch(() => INACTIVE_PREMIUM);
      setIsPremium(status.active);
      setPremiumUntil(status.until);
    }

    loadGallery(uid);
    if (!isOwnProfile && viewerUid) loadFollowStatus(uid, viewerUid);

    // Ekranın kullandığı alanlar. Kendi profilinde get_my_profile, başkasınınkinde herkese açık görünüm.
    const profileFields = 'user_id, full_name, position, age, height, weight, foot, city, district, club, avatar_url, score, followers_count, following_count, overall_rating, stat_hiz, stat_pas, stat_sut, stat_dayaniklilik, stat_dribbling, stat_savunma, is_premium, claimed_badge_keys, reward_premium_month_key, reward_premium_days_this_month';
    const { data, error } = isOwnProfile
      ? await profiles.ownProfile(profileFields)
      : await profiles.publicProfile(uid, profileFields);

    if (data) {
      setFollowersCount(data.followers_count ?? 0);
      setFollowingCount(data.following_count ?? 0);
      setFullName(data.full_name || '');
      setPosition(data.position || '');
      setAge(String(data.age || 18));
      setHeight(String(data.height || 175));
      setWeight(String(data.weight || 70));
      setFoot(data.foot || 'Sağ Ayak');
      setCity(data.city || '');
      setDistrict(data.district || '');
      setClub(data.club || '');
      setAvatarUrl(data.avatar_url ?? null);
      setRawProfile(data);

      setScore(calculateProfileCompletion(data));

      if (data.overall_rating != null) {
        setAiOverall(data.overall_rating);
        setCardStats({
          hiz: data.stat_hiz ?? 50,
          pas: data.stat_pas ?? 50,
          sut: data.stat_sut ?? 50,
          dayaniklilik: data.stat_dayaniklilik ?? 50,
          dribbling: data.stat_dribbling ?? 50,
          savunma: data.stat_savunma ?? 50,
        });
      } else {
        // Doğrulanmış yetenek verisi yok: kart değerleri profil tamamlanmasından türetilmez.
        setAiOverall(null);
        setCardStats(defaultCardStats(50));
      }
      // Tamamlanma puanı yalnızca bu ekranda hesaplanır; profiles.score'a yazılmaz.
      // Sunucudaki profiles.score, refresh_my_score() ile kaydetmeden sonra yenilenir.
    } else if (error) {
      if (__DEV__) console.log('Profil yüklenemedi:', error);
      // Empty code means the request never reached the server (network failure).
      // A real Postgrest error code (e.g. PGRST116) just means no profile exists yet.
      if (!error.code) {
        setToast({ message: t('profile_loadFailed'), type: 'error' });
      }
    }
    setLoading(false);
  };

  const loadFollowStatus = async (targetUid: string, viewerUid: string) => {
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewerUid)
      .eq('followed_id', targetUid)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!currentUserId || !userId || isOwnProfile || followBusy) return;
    const wasFollowing = isFollowing;
    setFollowBusy(true);
    // Optimistic update — anında yansıt, hata olursa geri al.
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => Math.max(0, prev + (wasFollowing ? -1 : 1)));

    const { error } = wasFollowing
      ? await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', userId)
      : await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: userId });

    if (error) {
      if (__DEV__) console.log('Takip işlemi başarısız:', error);
      setIsFollowing(wasFollowing);
      setFollowersCount((prev) => Math.max(0, prev + (wasFollowing ? 1 : -1)));
      setToast({ message: t('social_followActionFailed'), type: 'error' });
    }
    setFollowBusy(false);
  };

  const loadGallery = async (uid: string) => {
    const { data, error } = await supabase
      .from('player_gallery')
      .select('id, storage_path, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      if (__DEV__) console.log('Galeri yüklenemedi:', error);
      return;
    }
    if (!data || data.length === 0) {
      setGalleryItems([]);
      return;
    }

    const items = await Promise.all(
      data.map(async (row): Promise<GalleryItem | null> => {
        // 'videos' is a private bucket, so a signed URL is required (a plain
        // getPublicUrl would 400 since the bucket has no public read access).
        const { data: signed } = await supabase.storage
          .from('videos')
          .createSignedUrl(row.storage_path, 3600);
        if (!signed?.signedUrl) return null;
        return {
          id: row.id,
          storage_path: row.storage_path,
          url: signed.signedUrl,
          created_at: row.created_at,
        };
      })
    );

    setGalleryItems(items.filter((item): item is GalleryItem => item !== null));
  };

  const handleGalleryAddPress = () => {
    Alert.alert(t('profile_galleryAlertTitle'), t('profile_howToAddPhoto'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('sahadan_gallery'), onPress: () => pickGalleryPhoto('library') },
      { text: t('sahadan_camera'), onPress: () => pickGalleryPhoto('camera') },
    ]);
  };

  const pickGalleryPhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        source === 'camera'
          ? t('aiAnalysis_cameraPermissionBody')
          : t('aiAnalysis_galleryPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const pickerOptions = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [4, 3] as [number, number],
      quality: 0.7,
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (picked.canceled || !picked.assets[0]) return;

    setUploadingGalleryPhoto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: t('createMatch_needSession'), type: 'error' });
        return;
      }

      const asset = picked.assets[0];
      const path = `${user.id}/gallery/${Date.now()}.jpg`;
      const buffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from('player_gallery')
        .insert({ user_id: user.id, storage_path: path })
        .select()
        .single();
      if (insertError) throw insertError;

      const { data: signed } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600);

      if (signed?.signedUrl) {
        setGalleryItems((prev) => [
          { id: inserted.id, storage_path: path, url: signed.signedUrl, created_at: inserted.created_at },
          ...prev,
        ]);
      }

      setToast({ message: t('profile_photoAddedToGallery'), type: 'success' });
      sendLocalNotification(t('profile_photoAddedNotifTitle'), t('profile_photoAddedNotifBody'));
    } catch (err) {
      if (__DEV__) console.log('Galeri fotoğrafı yüklenemedi:', err);
      setToast({ message: t('teamProfile_photoUploadFailed'), type: 'error' });
    }
    setUploadingGalleryPhoto(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = userId ?? session?.user?.id ?? null;
      if (!uid) {
        if (__DEV__) console.log('Profil kaydedilemedi: oturum açmış kullanıcı bulunamadı');
        setToast({ message: t('teamEdit_noSession'), type: 'error' });
        setSaving(false);
        return;
      }

      const payload = {
        full_name: fullName,
        position,
        age: parseInt(age, 10) || null,
        height: parseInt(height, 10) || null,
        weight: parseInt(weight, 10) || null,
        foot,
        city,
        district: district || null,
        club: club.trim() || null,
      };

      // profiles.id is an auto-generated identity column; the link to the
      // signed-in user is profiles.user_id, so update/insert by that instead.
      const { data: updated, error: updateError } = await profiles.updateOwn(uid, payload);

      if (updateError) {
        if (__DEV__) console.log('Profil güncellenemedi:', updateError);
        setToast({ message: t('profile_updateFailed'), type: 'error' });
        setSaving(false);
        return;
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await profiles.insertOwn(uid, payload);
        if (insertError) {
          if (__DEV__) console.log('Profil oluşturulamadı:', insertError);
          setToast({ message: t('profile_createFailed'), type: 'error' });
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      setEditMode(false);
      setOpenPicker(null);
      await refreshServerScore(uid);
      await loadProfile();
      setToast({ message: t('profile_updateSuccess'), type: 'success' });
      sendLocalNotification(t('profile_updatedNotifTitle'), t('profile_updatedNotifBody'));
    } catch (err) {
      if (__DEV__) console.log('Profil kaydedilirken beklenmeyen hata:', err);
      setToast({ message: t('findOpponent_unexpectedError'), type: 'error' });
      setSaving(false);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(t('profile_avatarAlertTitle'), t('profile_howToAddPhoto'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('sahadan_gallery'), onPress: () => pickAvatar('library') },
      { text: t('sahadan_camera'), onPress: () => pickAvatar('camera') },
    ]);
  };

  const pickAvatar = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        source === 'camera'
          ? t('aiAnalysis_cameraPermissionBody')
          : t('aiAnalysis_galleryPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const pickerOptions = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.7,
      base64: source === 'camera',
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (picked.canceled || !picked.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: t('createMatch_needSession'), type: 'error' });
        return;
      }

      const asset = picked.assets[0];
      const path = `${user.id}/avatar.jpg`;
      const buffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await profiles.updateOwn(user.id, { avatar_url: publicUrl });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setToast({ message: t('profile_avatarUpdated'), type: 'success' });
      sendLocalNotification(t('profile_avatarUpdatedNotifTitle'), t('profile_avatarUpdatedNotifBody'));
    } catch (err) {
      if (__DEV__) console.log('Profil fotoğrafı yüklenemedi:', err);
      setToast({ message: t('profile_avatarUploadFailed'), type: 'error' });
    }
    setUploadingAvatar(false);
  };

  const saveToGallery = async (uri: string, showAlert = true) => {
    if (!MediaLibrary) {
      Alert.alert(t('profile_notSupportedTitle'), t('profile_notSupportedBody'));
      return false;
    }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('teamProfile_permissionTitle'), t('profile_galleryPermissionNeeded'));
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    if (showAlert) {
      Alert.alert(t('profile_savedTitle'), t('profile_savedBody'));
    }
    return true;
  };

  const shareToInstagramStories = async (uri: string) => {
    const saved = await saveToGallery(uri, false);
    if (!saved) return;

    const instagramUrl = 'instagram-stories://share?source_application=com.footbally.app';
    const canOpen = await Linking.canOpenURL(instagramUrl);
    if (canOpen) {
      await Linking.openURL(instagramUrl);
      Alert.alert(
        t('profile_instagramStoryTitle'),
        t('profile_instagramStoryBody'),
        [{ text: t('profile_ok') }]
      );
    } else {
      Alert.alert(t('profile_instagramNotFoundTitle'), t('profile_instagramNotFoundBody'));
    }
  };

  const shareToTwitter = async (uri: string) => {
    await saveToGallery(uri, false);
    const tweetText = encodeURIComponent(
      `${t('profile_tweetText')} ${score}/100\n\n#Footbally #Futbol #Football\ngetfootbally.com`
    );
    const twitterUrl = `twitter://post?message=${tweetText}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    const canOpen = await Linking.canOpenURL(twitterUrl);
    await Linking.openURL(canOpen ? twitterUrl : webUrl);
  };

  const shareToWhatsApp = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('profile_shareOnWhatsappDialogTitle') });
    }
  };

  const shareGeneral = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('profile_shareCardDialogTitle'),
      });
    }
  };

  const captureAndShare = async (platform: 'instagram' | 'twitter' | 'whatsapp' | 'gallery' | 'general') => {
    try {
      const uri = await cardRef.current?.capture?.();
      if (!uri) return;

      switch (platform) {
        case 'instagram':
          await shareToInstagramStories(uri);
          break;
        case 'twitter':
          await shareToTwitter(uri);
          break;
        case 'whatsapp':
          await shareToWhatsApp(uri);
          break;
        case 'gallery':
          await saveToGallery(uri);
          break;
        case 'general':
          await shareGeneral(uri);
          break;
      }
    } catch (err) {
      if (__DEV__) console.log('Paylaşım hatası:', err);
      Alert.alert(t('regions_error'), t('profile_shareErrorBody'));
    } finally {
      setShowShareCard(false);
    }
  };

  const togglePicker = (type: PickerType) => {
    setOpenPicker((prev) => (prev === type ? null : type));
  };

  const handleSelectPosition = (value: string) => {
    setPosition(value);
    setOpenPicker(null);
  };

  const handleSelectCity = (name: string) => {
    setCity(name);
    setDistrict('');
    setOpenPicker(null);
  };

  const handleSelectDistrict = (name: string) => {
    setDistrict(name);
    setOpenPicker(null);
  };

  if (loading) {
    return <LoadingScreen message={t('profile_loading')} />;
  }

  const stats = [{ val: String(score), label: t('profile_completionLabel') }, ...getExtraStats(t)];

  // profiles.is_premium (migration ile eklendi) artık tek doğru kaynak —
  // hem kendi hem başkasının profili için geçerli. Kolon henüz yoksa
  // (migration uygulanmadıysa) rawProfile.is_premium undefined kalır ve eski
  // session-metadata yoluna (yalnızca kendi profilin için) düşülür.
  const isPremiumActive =
    rawProfile && rawProfile.is_premium !== undefined && rawProfile.is_premium !== null
      ? !!rawProfile.is_premium
      : isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());

  const hasProfileBasics = !!(position && city && age);
  const rewardLevel = getLevel(score, t);
  const rewardBadges = getBadges(score, hasProfileBasics, isPremiumActive, t);
  const unlockedBadgesCount = rewardBadges.filter((b) => b.unlocked).length;
  const rewardMonthKey = rawProfile?.reward_premium_month_key ?? null;
  const daysClaimedThisMonth = rewardMonthKey === currentMonthKey() ? rawProfile?.reward_premium_days_this_month ?? 0 : 0;
  const remainingRewardDays = Math.max(0, MAX_REWARD_PREMIUM_DAYS_PER_MONTH - daysClaimedThisMonth);

  const scoreSuggestions = [
    { key: 'full_name', done: !!rawProfile?.full_name, label: t('profile_addName'), points: 10 },
    { key: 'position', done: !!rawProfile?.position, label: t('profile_addPosition'), points: 10 },
    { key: 'city', done: !!rawProfile?.city, label: t('profile_addCity'), points: 5 },
    { key: 'age', done: !!rawProfile?.age, label: t('profile_addAge'), points: 5 },
    { key: 'height', done: !!rawProfile?.height, label: t('profile_addHeight'), points: 5 },
    { key: 'weight', done: !!rawProfile?.weight, label: t('profile_addWeight'), points: 5 },
    { key: 'foot', done: !!rawProfile?.foot, label: t('profile_addFoot'), points: 3 },
    { key: 'district', done: !!rawProfile?.district, label: t('profile_addDistrict'), points: 3 },
    { key: 'club', done: !!rawProfile?.club, label: t('profile_addClub'), points: 4 },
  ].filter((s) => !s.done);

  const bio = [
    { label: t('profile_bioPosition'), value: position || '-' },
    { label: t('profile_bioAge'), value: age || '-' },
    {
      label: t('profile_bioHeightWeight'),
      value: height || weight ? `${height || '-'} cm / ${weight || '-'} kg` : '-',
    },
    { label: t('profile_bioFoot'), value: foot || '-' },
    { label: t('profile_bioCity'), value: city ? `${city}${district ? `, ${district}` : ''}` : '-' },
    { label: t('profile_bioClub'), value: club || '-' },
  ];

  if (editMode) {
    return (
      <View style={styles.editSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editHeader, { paddingTop: 60 }]}>
            <TouchableOpacity onPress={() => { setEditMode(false); setOpenPicker(null); }} style={[styles.editHeaderBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} disabled={saving}>
              <Ionicons name="chevron-back" size={15} color={theme.gold} />
              <Text style={styles.editHeaderCancel}>{t('common_cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>{t('teamProfile_editProfile')}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.editHeaderBtn} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={theme.gold} />
              ) : (
                <Text style={styles.editHeaderSave}>{t('match_save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_fullNameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('profile_fullNamePlaceholder')}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_positionLabel')}</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('position')}>
                <Text style={position ? styles.inputValueText : styles.inputPlaceholderText}>
                  {position || t('profile_selectPosition')} {openPicker === 'position' ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'position' && (
              <View style={styles.inlinePicker}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                  {FOOTBALL_POSITIONS.map((cat) => (
                    <View key={cat.category}>
                      <Text style={styles.pickerSectionHeader}>{cat.category}</Text>
                      {cat.positions.map((pos) => (
                        <TouchableOpacity
                          key={pos}
                          onPress={() => handleSelectPosition(pos)}
                          style={styles.fullListRow}
                        >
                          <Text style={styles.listRowText}>{pos}</Text>
                          {position === pos && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_ageLabel')}</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('age')}>
                <Text style={styles.inputValueText}>{age} {t('teamProfile_ageSuffix')} {openPicker === 'age' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'age' && (
              <View style={styles.inlinePicker}>
                <Picker selectedValue={age} onValueChange={setAge} itemStyle={{ color: theme.text }}>
                  {AGE_OPTIONS.map((n) => (
                    <Picker.Item key={n} label={`${n} ${t('teamProfile_ageSuffix')}`} value={String(n)} color={theme.text} />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_heightLabel')}</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('height')}>
                <Text style={styles.inputValueText}>{height} cm {openPicker === 'height' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'height' && (
              <View style={styles.inlinePicker}>
                <Picker selectedValue={height} onValueChange={setHeight} itemStyle={{ color: theme.text }}>
                  {HEIGHT_OPTIONS.map((n) => (
                    <Picker.Item key={n} label={`${n} cm`} value={String(n)} color={theme.text} />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_weightLabel')}</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('weight')}>
                <Text style={styles.inputValueText}>{weight} kg {openPicker === 'weight' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'weight' && (
              <View style={styles.inlinePicker}>
                <Picker selectedValue={weight} onValueChange={setWeight} itemStyle={{ color: theme.text }}>
                  {WEIGHT_OPTIONS.map((n) => (
                    <Picker.Item key={n} label={`${n} kg`} value={String(n)} color={theme.text} />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_footLabel')}</Text>
              <View style={styles.footRow}>
                {FOOT_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFoot(f)}
                    style={[styles.footPill, foot === f && styles.footPillActive]}
                  >
                    <Text style={[styles.footPillText, foot === f && styles.footPillTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('createMatch_cityLabel')}</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('city')}>
                <Text style={city ? styles.inputValueText : styles.inputPlaceholderText}>
                  {city || t('createMatch_citySelect')} {openPicker === 'city' ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'city' && (
              <View style={styles.inlinePicker}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                  {TURKEY_CITIES.map((c) => (
                    <TouchableOpacity
                      key={c.plate}
                      onPress={() => handleSelectCity(c.name)}
                      style={styles.fullListRow}
                    >
                      <Text style={styles.listRowText}>{c.plate}. {c.name}</Text>
                      {city === c.name && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('createMatch_districtLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, !city && styles.inputDisabled]}
                onPress={() => city && togglePicker('district')}
                disabled={!city}
              >
                <Text style={district ? styles.inputValueText : styles.inputPlaceholderText}>
                  {district || t('createMatch_districtSelect')} {openPicker === 'district' ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'district' && (
              <View style={styles.inlinePicker}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {(TURKEY_CITIES.find((c) => c.name === city)?.districts ?? []).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => handleSelectDistrict(d)}
                      style={styles.fullListRow}
                    >
                      <Text style={styles.listRowText}>{d}</Text>
                      {district === d && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_clubLabel')}</Text>
              <TextInput
                style={styles.input}
                value={club}
                onChangeText={setClub}
                placeholder={t('profile_clubPlaceholder')}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          {isOwnProfile ? (
            <View style={styles.headerSpacer} />
          ) : (
            <HapticTouchable
              onPress={() => (onBack ? onBack() : navigate('socialFeed'))}
              style={styles.headerIconBtn}
            >
              <Ionicons name="chevron-back" size={19} color={theme.text} />
            </HapticTouchable>
          )}
          <Image source={require('../assets/logo-text.png')} style={styles.logo} resizeMode="contain" />
          {isOwnProfile ? (
            <TouchableOpacity onPress={() => navigate('settings')} style={styles.headerIconBtn}>
              <Ionicons name="settings-outline" size={19} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {/* Avatar */}
        <FadeInView style={styles.heroSection} translateY={16} duration={260}>
          <HapticTouchable
            style={[styles.avatarWrap, isPremiumActive && styles.avatarWrapPremium]}
            onPress={isOwnProfile ? handleAvatarPress : undefined}
            disabled={uploadingAvatar || !isOwnProfile}
          >
            <View style={[styles.avatar, isPremiumActive && styles.avatarPremium]}>
              {uploadingAvatar ? (
                <ActivityIndicator color={theme.gold} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-outline" size={40} color={theme.textSecondary} />
              )}
            </View>
            {isPremiumActive && (
              <View style={styles.crownBadge}>
                <Ionicons name="star" size={14} color={theme.gold} />
              </View>
            )}
            {isOwnProfile && (
              <TouchableOpacity onPress={handleAvatarPress} style={styles.cameraBadge} disabled={uploadingAvatar}>
                <Ionicons name="camera-outline" size={14} color={Paper.ink} />
              </TouchableOpacity>
            )}
          </HapticTouchable>
          <Text style={styles.name} numberOfLines={2}>{fullName || t('profile_enterNamePlaceholder')}</Text>
          <Text style={styles.position} numberOfLines={1}>{position || t('profile_enterPositionPlaceholder')}</Text>
          <Text style={styles.club} numberOfLines={1}>{club || t('profile_enterClubPlaceholder')}</Text>
          {isPremiumActive && (
            <View style={styles.premiumMemberBadge}>
              <Text style={styles.premiumMemberText}>{t('profile_premiumMemberBadge')}</Text>
            </View>
          )}
        </FadeInView>

        {/* Sosyal Saha — takipçi/takip edilen sayısı + Takip Et butonu */}
        <View style={styles.followRow}>
          <HapticTouchable
            style={styles.followStat}
            onPress={() => navigate('userFollowList', { userId, type: 'followers' })}
          >
            <Text style={styles.followStatValue}>{followersCount}</Text>
            <Text style={styles.followStatLabel}>{t('social_followers')}</Text>
          </HapticTouchable>
          <View style={styles.followDivider} />
          <HapticTouchable
            style={styles.followStat}
            onPress={() => navigate('userFollowList', { userId, type: 'following' })}
          >
            <Text style={styles.followStatValue}>{followingCount}</Text>
            <Text style={styles.followStatLabel}>{t('social_following')}</Text>
          </HapticTouchable>
          {!isOwnProfile && (
            <HapticTouchable
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={toggleFollow}
              disabled={followBusy}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.gold : Paper.ink} />
              ) : (
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? t('social_following_action') : t('social_follow')}
                </Text>
              )}
            </HapticTouchable>
          )}
          {!isOwnProfile && userId && (
            <HapticTouchable
              style={styles.reportBtn}
              onPress={() => navigate('report', { type: 'profile', id: userId, name: fullName })}
              accessibilityLabel={t('report_entryAction')}
            >
              <Ionicons name="flag-outline" size={16} color={theme.textMuted} />
            </HapticTouchable>
          )}
        </View>

        {/* Stats: yan yana modern kartlar */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <StatCard key={i} label={s.label} value={s.val} />
          ))}
        </View>

        {/* Score Progress */}
        <View style={styles.card}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.cardTitle}>{t('profile_completionLabel')}</Text>
            <Text style={styles.scoreCardValue}>{score}/100</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${score}%` }]} />
          </View>

          {isOwnProfile && score < 100 && scoreSuggestions.length > 0 && (
            <>
              <Text style={styles.scoreHint}>{t('profile_scoreHintPrefix')}</Text>
              {scoreSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setEditMode(true)}
                  style={styles.scoreSuggestionRow}
                >
                  <Ionicons name="star-outline" size={13} color={theme.gold} />
                  <Text style={styles.scoreSuggestionText}>
                    {s.label} (+{s.points} {t('profile_pointsSuffix')})
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={theme.gold} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {isOwnProfile && score >= 100 && (
            <View style={styles.scoreCompleteBanner}>
              <Text style={styles.scoreCompleteText}>{t('profile_completeBannerText')}</Text>
            </View>
          )}
        </View>

        {/* Ödüller & Tecrübe — sadece kendi profilinde tıklanabilir; BadgesScreen
            her zaman oturumdaki kullanıcıyı baz alır, başkasının profiline
            özel bir görünümü yok. */}
        <HapticTouchable style={styles.card} onPress={isOwnProfile ? () => navigate('badges') : undefined}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.cardTitle}>{t('profile_rewardsTitle')}</Text>
            <Text style={[styles.scoreCardValue, { color: theme[rewardLevel.colorKey] }]}>{rewardLevel.label}</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${score}%`, backgroundColor: theme[rewardLevel.colorKey] }]} />
          </View>
          <View style={styles.rewardStatsRow}>
            <Text style={[styles.scoreHint, { flex: 1, marginTop: 0, marginBottom: 0 }]}>{unlockedBadgesCount}/{rewardBadges.length} {t('profile_badgesUnlockedSuffix')}</Text>
            <Text style={[styles.scoreHint, { flex: 1, marginTop: 0, marginBottom: 0, textAlign: 'right' }]}>{daysClaimedThisMonth}/{MAX_REWARD_PREMIUM_DAYS_PER_MONTH} {t('profile_premiumEarnedSuffix')}</Text>
          </View>
          {remainingRewardDays > 0 && (
            <View style={styles.rewardsCta}>
              <Ionicons name="gift-outline" size={14} color={theme.gold} />
              <Text style={styles.rewardsCtaText}>
                {t('badges_remainingRewardPrefix')}{remainingRewardDays}{t('badges_remainingRewardSuffix')}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.gold} />
            </View>
          )}
        </HapticTouchable>

        {/* Bio */}
        <View style={styles.card}>
          {bio.map((b, i) => (
            <View key={i} style={[styles.bioRow, i === bio.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.bioLabel}>{b.label}</Text>
              <Text style={styles.bioValue}>{b.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          {isOwnProfile && (
            <HapticTouchable style={[styles.editBtn, styles.actionBtnFlex, { flexDirection: 'row', gap: 6, justifyContent: 'center' }]} onPress={() => setEditMode(true)}>
              <Ionicons name="create-outline" size={14} color={theme.gold} />
              <Text style={styles.editBtnText}>{t('profile_editBtn')}</Text>
            </HapticTouchable>
          )}
          <HapticTouchable style={[styles.editBtn, styles.actionBtnFlex, { flexDirection: 'row', gap: 6, justifyContent: 'center' }]} onPress={() => setShowShareCard(true)}>
            <Ionicons name="share-outline" size={14} color={theme.gold} />
            <Text style={styles.editBtnText}>{t('profile_shareProfile')}</Text>
          </HapticTouchable>
        </View>

        {/* Skills */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('performance_skillScoresTitle')}</Text>
          {skillsFromStats(cardStats, t).map((s, i) => (
            <View key={i} style={styles.skillItem}>
              <View style={styles.skillTop}>
                <Text style={styles.skillName}>{s.name}</Text>
                <Text style={styles.skillVal}>{s.value}</Text>
              </View>
              <View style={styles.skillTrack}>
                <View style={[styles.skillFill, { width: `${s.value}%` }]} />
              </View>
            </View>
          ))}
        </View>

        {(isOwnProfile || galleryItems.length > 0) && (
          <>
        {/* Photo Gallery */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile_photoGalleryTitle')}</Text>
          <HapticTouchable
            disabled={galleryItems.length <= 4}
            onPress={() => setShowGalleryGrid(true)}
          >
            <Text style={[styles.sectionLink, galleryItems.length <= 4 && { opacity: 0.35 }]}>{t('common_all')}</Text>
          </HapticTouchable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {galleryItems.map((item) => (
            <HapticTouchable
              key={item.id}
              style={styles.galleryItem}
              onPress={() => setGalleryPreviewUrl(item.url)}
            >
              <Image source={{ uri: item.url }} style={styles.galleryImage} />
            </HapticTouchable>
          ))}
          {isOwnProfile && (
            <HapticTouchable
              style={[styles.galleryItem, styles.galleryAdd]}
              onPress={handleGalleryAddPress}
              disabled={uploadingGalleryPhoto}
            >
              {uploadingGalleryPhoto ? (
                <ActivityIndicator size="small" color={theme.gold} />
              ) : (
                <>
                  <Ionicons name="add" size={20} color={theme.gold} />
                  <Text style={styles.galleryAddText}>{t('profile_addLabel')}</Text>
                </>
              )}
            </HapticTouchable>
          )}
        </ScrollView>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <Modal visible={showShareCard} transparent animationType="fade" onRequestClose={() => setShowShareCard(false)}>
        <View style={styles.shareModalOverlay}>
          <Text style={styles.shareModalTitle}>{t('profile_playerCardTitle')}</Text>
          <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
            <PlayerShareCard
              name={fullName}
              position={position}
              score={aiOverall ?? 0}
              city={city}
              club={club}
              avatarUrl={avatarUrl}
              isPremium={isPremiumActive}
              stats={cardStats}
            />
          </ViewShot>
          <Text style={styles.shareModalHint}>{t('profile_shareCardHint')}</Text>

          <View style={styles.shareOptionsList}>
            <TouchableOpacity
              onPress={() => captureAndShare('instagram')}
              style={[styles.shareOptionRow, { backgroundColor: '#833AB4' }]}
            >
              <Ionicons name="logo-instagram" size={20} color="#fff" />
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>{t('profile_instagramStoryOption')}</Text>
                <Text style={styles.shareOptionSubtitle}>{t('profile_instagramStorySub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('twitter')}
              style={[styles.shareOptionRow, { backgroundColor: '#000000', borderWidth: 1, borderColor: '#333' }]}
            >
              <Ionicons name="logo-twitter" size={20} color="#fff" />
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>{t('profile_twitterOption')}</Text>
                <Text style={styles.shareOptionSubtitle}>{t('profile_twitterSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('whatsapp')}
              style={[styles.shareOptionRow, { backgroundColor: '#25D366' }]}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>WhatsApp</Text>
                <Text style={styles.shareOptionSubtitle}>{t('profile_whatsappSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('gallery')}
              style={[styles.shareOptionRow, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' }]}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>{t('profile_saveToGalleryOption')}</Text>
                <Text style={styles.shareOptionSubtitle}>{t('profile_saveToGallerySub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => captureAndShare('general')} style={styles.shareOptionMore}>
              <Text style={styles.shareOptionMoreText}>{t('profile_moreApps')}</Text>
              <Ionicons name="chevron-forward" size={13} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowShareCard(false)}
              style={[styles.shareModalCloseBtn, styles.shareModalCloseBtnCentered]}
            >
              <Text style={styles.shareModalCloseBtnText}>{t('match_close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!galleryPreviewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryPreviewUrl(null)}
      >
        <View style={styles.galleryPreviewOverlay}>
          <TouchableOpacity
            style={styles.galleryPreviewCloseBtn}
            onPress={() => setGalleryPreviewUrl(null)}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {galleryPreviewUrl && (
            <Image
              source={{ uri: galleryPreviewUrl }}
              style={styles.galleryPreviewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showGalleryGrid}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGalleryGrid(false)}
      >
        <View style={styles.galleryGridOverlay}>
          <View style={styles.galleryGridHeader}>
            <Text style={styles.shareModalTitle}>{t('profile_photoGalleryTitle')}</Text>
            <TouchableOpacity onPress={() => setShowGalleryGrid(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.galleryGridContent}>
            {galleryItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.galleryGridItem}
                onPress={() => {
                  setShowGalleryGrid(false);
                  setGalleryPreviewUrl(item.url);
                }}
              >
                <Image source={{ uri: item.url }} style={styles.galleryGridImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    logo: { width: 160, height: 40 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      marginTop: 16,
    },
    headerSpacer: { width: 42 },
    headerIconBtn: {
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    followRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 24,
      marginBottom: 20,
      gap: 12,
    },
    followStat: { alignItems: 'center' },
    followStatValue: { fontFamily: FontFamily.display, fontSize: 20, color: theme.text },
    followStatLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary, marginTop: 2 },
    followDivider: { width: 1, height: 28, backgroundColor: theme.border },
    reportBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    followBtn: {
      flex: 1,
      height: 40,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    followBtnActive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    followBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Paper.ink },
    followBtnTextActive: { color: theme.goldDark },
    heroSection: { alignItems: 'center', paddingVertical: 24 },
    avatarWrap: { position: 'relative', marginBottom: 16 },
    avatarWrapPremium: {},
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPremium: {
      borderWidth: 2,
      borderColor: theme.goldLight,
    },
    crownBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
      width: 28,
      height: 28,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.bg,
    },
    premiumMemberBadge: {
      marginTop: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    premiumMemberText: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.goldDark, letterSpacing: 0.5 },
    avatarImage: { width: 96, height: 96, borderRadius: RADIUS },
    name: { fontFamily: FontFamily.display, fontSize: 26, color: theme.text, marginBottom: 4, textAlign: 'center', paddingHorizontal: 24 },
    position: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.goldDark, textAlign: 'center' },
    club: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginHorizontal: 24,
      marginBottom: 20,
    },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginBottom: 14, letterSpacing: 0.5 },
    scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    scoreCardValue: { fontFamily: FontFamily.monoMedium, fontSize: 20, color: theme.goldDark },
    completionTrack: { height: 4, backgroundColor: theme.border, marginBottom: 4 },
    completionFill: { height: 4, backgroundColor: theme.gold },
    scoreHint: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary, marginTop: 12, marginBottom: 10 },
    scoreSuggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginBottom: 6,
    },
    scoreSuggestionText: { fontFamily: FontFamily.body, color: theme.text, flex: 1, fontSize: 13 },
    scoreCompleteBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      marginTop: 12,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    scoreCompleteText: { fontFamily: FontFamily.bodySemiBold, color: theme.goldDark, flex: 1 },
    rewardStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
    rewardsCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      marginTop: 12,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    rewardsCtaText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.text, lineHeight: 17 },
    bioRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    bioLabel: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    bioValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 24,
      marginBottom: 20,
    },
    actionBtnFlex: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
    editBtn: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingVertical: 12,
      alignItems: 'center',
    },
    editBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.goldDark },
    skillItem: { marginBottom: 14 },
    skillTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    skillName: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted },
    skillVal: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text },
    skillTrack: { height: 4, backgroundColor: theme.border, borderRadius: 2 },
    skillFill: {
      height: 4,
      backgroundColor: theme.gold,
      borderRadius: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, letterSpacing: 0.5 },
    sectionLink: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.goldDark },
    gallery: { paddingLeft: 24, marginBottom: 20 },
    galleryItem: {
      width: 112,
      height: 112,
      backgroundColor: theme.card,
      borderRadius: 16,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    galleryImage: { width: '100%', height: '100%' },
    galleryAdd: { borderColor: theme.goldDark },
    galleryAddText: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.goldDark, marginTop: 4 },

    // Photo gallery lightbox / grid modals (always dark, matches share card modal)
    galleryPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    galleryPreviewImage: { width: '100%', height: '70%' },
    galleryPreviewCloseBtn: { position: 'absolute', top: 60, right: 24, zIndex: 1, padding: 8 },
    galleryGridOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', paddingTop: 60 },
    galleryGridHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    galleryGridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: 8,
    },
    galleryGridItem: {
      width: '31%',
      aspectRatio: 1,
      borderRadius: RADIUS,
      overflow: 'hidden',
      backgroundColor: theme.card,
    },
    galleryGridImage: { width: '100%', height: '100%' },

    // Full-screen edit view (rendered in place of the profile view, no Modal)
    editSafe: { flex: 1, backgroundColor: theme.bg },
    editHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    editHeaderBtn: { padding: 8 },
    editHeaderTitle: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, letterSpacing: 0.5 },
    editHeaderCancel: { fontFamily: FontFamily.body, fontSize: 15, color: theme.goldDark },
    editHeaderSave: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.goldDark },
    editContent: { padding: 16, paddingBottom: 60 },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      justifyContent: 'center',
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputDisabled: { opacity: 0.5 },
    inputValueText: { fontFamily: FontFamily.mono, color: theme.text, fontSize: 14 },
    inputPlaceholderText: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 14 },
    footRow: { flexDirection: 'row', gap: 8 },
    footPill: {
      flex: 1,
      padding: 12,
      borderRadius: RADIUS,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footPillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    footPillText: { fontFamily: FontFamily.bodySemiBold, color: theme.text, fontSize: 11 },
    footPillTextActive: { color: Paper.ink },

    // Inline expandable picker (renders directly below the tapped field)
    inlinePicker: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginTop: -8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    fullListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      justifyContent: 'space-between',
    },
    listRowText: { fontFamily: FontFamily.body, fontSize: 15, color: theme.text },
    checkmark: { fontSize: 15, color: theme.goldDark, fontWeight: '700' },
    pickerSectionHeader: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.gold,
      letterSpacing: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },

    // Share card modal (always dark, independent of app theme — matches the FIFA card style)
    shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    shareModalTitle: { fontFamily: FontFamily.display, color: theme.gold, fontSize: 20, marginBottom: 24, letterSpacing: 0.5 },
    shareModalHint: { fontFamily: FontFamily.body, color: '#666', fontSize: 12, marginTop: 16, marginBottom: 24 },
    shareModalCloseBtn: { backgroundColor: '#1a1a1a', borderRadius: RADIUS, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333' },
    shareModalCloseBtnCentered: { alignSelf: 'center', marginTop: 4 },
    shareModalCloseBtnText: { fontFamily: FontFamily.body, color: '#888' },
    shareOptionsList: { width: '100%', paddingHorizontal: 24, gap: 10 },
    shareOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS, padding: 16 },
    shareOptionTextWrap: { flex: 1 },
    shareOptionTitle: { fontFamily: FontFamily.bodySemiBold, color: '#fff', fontSize: 15 },
    shareOptionSubtitle: { fontFamily: FontFamily.body, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    shareOptionMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
    shareOptionMoreText: { fontFamily: FontFamily.body, color: '#666', fontSize: 14 },
  });
