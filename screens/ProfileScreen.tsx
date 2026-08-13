import { useEffect, useRef, useState } from 'react';
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
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';
import PlayerShareCard from '../components/PlayerShareCard';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import { FOOTBALL_POSITIONS } from '../constants/footballPositions';

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

const skillsFromStats = (s: PlayerCardStats) => [
  { name: 'Hız', value: s.hiz },
  { name: 'Pas', value: s.pas },
  { name: 'Şut', value: s.sut },
  { name: 'Dayanıklılık', value: s.dayaniklilik },
  { name: 'Dribbling', value: s.dribbling },
  { name: 'Savunma', value: s.savunma },
];

const extraStats = [
  { val: '0', label: 'Gol' },
  { val: '0', label: 'Asist' },
  { val: '0', label: 'Maç' },
];

const FOOT_OPTIONS = ['Sol Ayak', 'Sağ Ayak', 'Her İkisi'];

const AGE_OPTIONS = Array.from({ length: 32 }, (_, i) => i + 14);
const HEIGHT_OPTIONS = Array.from({ length: 71 }, (_, i) => i + 150);
const WEIGHT_OPTIONS = Array.from({ length: 76 }, (_, i) => i + 45);

const calculateScore = (profile: {
  full_name?: string | null;
  position?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  city?: string | null;
  district?: string | null;
  foot?: string | null;
  club?: string | null;
  activity_score?: number | null;
}) => {
  let score = 0;

  // Profile completeness (50 points)
  if (profile.full_name) score += 10;
  if (profile.position) score += 10;
  if (profile.age) score += 5;
  if (profile.height) score += 5;
  if (profile.weight) score += 5;
  if (profile.city) score += 5;
  if (profile.district) score += 3;
  if (profile.foot) score += 3;
  if (profile.club) score += 4;

  // Activity (50 points - mock for now, will be real data later from matches/applications)
  score += profile.activity_score || 0;

  return Math.min(score, 100);
};

interface Props {
  navigate: (screen: string) => void;
  userId?: string | null;
}

type PickerType = 'position' | 'age' | 'height' | 'weight' | 'city' | 'district' | null;

export default function ProfileScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

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

  const [editMode, setEditMode] = useState(false);
  const [openPicker, setOpenPicker] = useState<PickerType>(null);

  const [showShareCard, setShowShareCard] = useState(false);
  const [cardStats, setCardStats] = useState<PlayerCardStats>(defaultCardStats(0));
  // Set once an admin has reviewed an AI video-analysis job for this player
  // (profiles.overall_rating, written by ai-jobs.component.ts in admin-app).
  const [aiOverall, setAiOverall] = useState<number | null>(null);
  const cardRef = useRef<ViewShot>(null);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const uid = userId ?? user?.id ?? null;
    if (!uid) {
      setLoading(false);
      return;
    }

    setIsPremium(!!user?.user_metadata?.premium);
    setPremiumUntil(user?.user_metadata?.premium_until ?? null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (data) {
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

      const calculatedScore = calculateScore(data);
      setScore(calculatedScore);

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
        setAiOverall(null);
        setCardStats(defaultCardStats(calculatedScore));
      }

      if (calculatedScore !== (data.score ?? 0)) {
        supabase.from('profiles').update({ score: calculatedScore }).eq('user_id', uid);
      }
    } else if (error) {
      if (__DEV__) console.log('Profil yüklenemedi:', error);
      // Empty code means the request never reached the server (network failure).
      // A real Postgrest error code (e.g. PGRST116) just means no profile exists yet.
      if (!error.code) {
        setToast({ message: 'Profil yüklenemedi', type: 'error' });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = userId ?? session?.user?.id ?? null;
      if (!uid) {
        if (__DEV__) console.log('Profil kaydedilemedi: oturum açmış kullanıcı bulunamadı');
        setToast({ message: 'Kullanıcı oturumu bulunamadı. Çıkış yapıp tekrar giriş deneyin.', type: 'error' });
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
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', uid)
        .select();

      if (updateError) {
        if (__DEV__) console.log('Profil güncellenemedi:', updateError);
        setToast({ message: 'Profil güncellenemedi', type: 'error' });
        setSaving(false);
        return;
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ user_id: uid, ...payload, score: 0 });
        if (insertError) {
          if (__DEV__) console.log('Profil oluşturulamadı:', insertError);
          setToast({ message: 'Profil oluşturulamadı', type: 'error' });
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      setEditMode(false);
      setOpenPicker(null);
      await loadProfile();
      setToast({ message: 'Profil güncellendi', type: 'success' });
      sendLocalNotification('Profil Güncellendi ✅', 'Profiliniz başarıyla kaydedildi.');
    } catch (err) {
      if (__DEV__) console.log('Profil kaydedilirken beklenmeyen hata:', err);
      setToast({ message: 'Beklenmeyen bir hata oluştu', type: 'error' });
      setSaving(false);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Profil Fotoğrafı', 'Fotoğrafını nasıl eklemek istersin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Galeri', onPress: () => pickAvatar('library') },
      { text: 'Kamera', onPress: () => pickAvatar('camera') },
    ]);
  };

  const pickAvatar = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        'İzin Gerekli',
        source === 'camera'
          ? 'Fotoğraf çekmek için ayarlardan kamera iznini açmanız gerekiyor.'
          : 'Fotoğraf seçmek için ayarlardan galeri iznini açmanız gerekiyor.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
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
        setToast({ message: 'Oturum açmanız gerekiyor', type: 'error' });
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

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setToast({ message: 'Profil fotoğrafı güncellendi', type: 'success' });
      sendLocalNotification('Fotoğraf Güncellendi 📸', 'Profil fotoğrafınız başarıyla güncellendi.');
    } catch (err) {
      if (__DEV__) console.log('Profil fotoğrafı yüklenemedi:', err);
      setToast({ message: 'Profil fotoğrafı yüklenemedi', type: 'error' });
    }
    setUploadingAvatar(false);
  };

  const saveToGallery = async (uri: string, showAlert = true) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri iznine ihtiyaç var.');
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    if (showAlert) {
      Alert.alert('✅ Kaydedildi!', 'Oyuncu kartın galeriye kaydedildi.');
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
        'Instagram Hikaye',
        'Kart galeriye kaydedildi! Instagram\'ı açıp hikayeden yükleyebilirsin.',
        [{ text: 'Tamam' }]
      );
    } else {
      Alert.alert('Instagram bulunamadı', 'Instagram yüklü değil.');
    }
  };

  const shareToTwitter = async (uri: string) => {
    await saveToGallery(uri, false);
    const tweetText = encodeURIComponent(
      `Footbally'de oyuncu kartım hazır! 🏆⚽ Skor: ${score}/100\n\n#Footbally #Futbol #Football\ngetfootbally.com`
    );
    const twitterUrl = `twitter://post?message=${tweetText}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    const canOpen = await Linking.canOpenURL(twitterUrl);
    await Linking.openURL(canOpen ? twitterUrl : webUrl);
  };

  const shareToWhatsApp = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'WhatsApp\'ta Paylaş' });
    }
  };

  const shareGeneral = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Footbally Oyuncu Kartını Paylaş',
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
      Alert.alert('Hata', 'Paylaşım sırasında bir sorun oluştu.');
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
    return <LoadingScreen message="Profil yükleniyor..." />;
  }

  const stats = [{ val: String(score), label: 'Skor' }, ...extraStats];

  const isPremiumActive = isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());

  const scoreSuggestions = [
    { key: 'full_name', done: !!rawProfile?.full_name, label: 'İsim ekle', points: 10 },
    { key: 'position', done: !!rawProfile?.position, label: 'Pozisyon ekle', points: 10 },
    { key: 'city', done: !!rawProfile?.city, label: 'Şehir ekle', points: 5 },
    { key: 'age', done: !!rawProfile?.age, label: 'Yaş ekle', points: 5 },
    { key: 'height', done: !!rawProfile?.height, label: 'Boy ekle', points: 5 },
    { key: 'weight', done: !!rawProfile?.weight, label: 'Kilo ekle', points: 5 },
    { key: 'foot', done: !!rawProfile?.foot, label: 'Baskın ayak ekle', points: 3 },
    { key: 'district', done: !!rawProfile?.district, label: 'İlçe ekle', points: 3 },
    { key: 'club', done: !!rawProfile?.club, label: 'Kulüp ekle', points: 4 },
  ].filter((s) => !s.done);

  const bio = [
    { label: 'Pozisyon', value: position || '-' },
    { label: 'Yaş', value: age || '-' },
    {
      label: 'Boy / Kilo',
      value: height || weight ? `${height || '-'} cm / ${weight || '-'} kg` : '-',
    },
    { label: 'Baskın Ayak', value: foot || '-' },
    { label: 'Şehir', value: city ? `${city}${district ? `, ${district}` : ''}` : '-' },
    { label: 'Kulüp', value: club || '-' },
  ];

  if (editMode) {
    return (
      <View style={styles.editSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editHeader, { paddingTop: 60 }]}>
            <TouchableOpacity onPress={() => { setEditMode(false); setOpenPicker(null); }} style={styles.editHeaderBtn} disabled={saving}>
              <Text style={styles.editHeaderCancel}>← İptal</Text>
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Profili Düzenle</Text>
            <TouchableOpacity onPress={handleSave} style={styles.editHeaderBtn} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={theme.gold} />
              ) : (
                <Text style={styles.editHeaderSave}>Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AD SOYAD</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Ad Soyad"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>POZİSYON</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('position')}>
                <Text style={position ? styles.inputValueText : styles.inputPlaceholderText}>
                  {position || 'Pozisyon seçin'} {openPicker === 'position' ? '▲' : '▼'}
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
              <Text style={styles.inputLabel}>YAŞ</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('age')}>
                <Text style={styles.inputValueText}>{age} yaş {openPicker === 'age' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>

            {openPicker === 'age' && (
              <View style={styles.inlinePicker}>
                <Picker selectedValue={age} onValueChange={setAge} itemStyle={{ color: theme.text }}>
                  {AGE_OPTIONS.map((n) => (
                    <Picker.Item key={n} label={`${n} yaş`} value={String(n)} color={theme.text} />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BOY (CM)</Text>
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
              <Text style={styles.inputLabel}>KİLO (KG)</Text>
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
              <Text style={styles.inputLabel}>BASKIN AYAK</Text>
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
              <Text style={styles.inputLabel}>ŞEHİR</Text>
              <TouchableOpacity style={styles.input} onPress={() => togglePicker('city')}>
                <Text style={city ? styles.inputValueText : styles.inputPlaceholderText}>
                  {city || 'Şehir seçin'} {openPicker === 'city' ? '▲' : '▼'}
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
              <Text style={styles.inputLabel}>İLÇE</Text>
              <TouchableOpacity
                style={[styles.input, !city && styles.inputDisabled]}
                onPress={() => city && togglePicker('district')}
                disabled={!city}
              >
                <Text style={district ? styles.inputValueText : styles.inputPlaceholderText}>
                  {district || 'İlçe seçin'} {openPicker === 'district' ? '▲' : '▼'}
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
              <Text style={styles.inputLabel}>KULÜP (OPSİYONEL)</Text>
              <TextInput
                style={styles.input}
                value={club}
                onChangeText={setClub}
                placeholder="Takımınız varsa girin"
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
          <View style={styles.headerSpacer} />
          <Image source={require('../assets/logo-text.png')} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity
            onPress={() => navigate('settings')}
            style={{
              width: 40,
              height: 40,
              backgroundColor: theme.card,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.heroSection}>
          <HapticTouchable
            style={[styles.avatarWrap, isPremiumActive && styles.avatarWrapPremium]}
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
          >
            <View style={[styles.avatar, isPremiumActive && styles.avatarPremium]}>
              {uploadingAvatar ? (
                <ActivityIndicator color={theme.gold} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarEmoji}>⚽</Text>
              )}
            </View>
            {isPremiumActive && (
              <View style={styles.crownBadge}>
                <Text style={styles.crownBadgeIcon}>👑</Text>
              </View>
            )}
            <TouchableOpacity onPress={handleAvatarPress} style={styles.cameraBadge} disabled={uploadingAvatar}>
              <Text style={styles.cameraBadgeIcon}>📷</Text>
            </TouchableOpacity>
          </HapticTouchable>
          <Text style={styles.name}>{fullName || 'İsim giriniz'}</Text>
          <Text style={styles.position}>{position || 'Pozisyon giriniz'}</Text>
          <Text style={styles.club}>🏟️ {club || 'Kulüp giriniz'}</Text>
          {isPremiumActive && (
            <View style={styles.premiumMemberBadge}>
              <Text style={styles.premiumMemberText}>✦ Premium Üye</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Score Progress */}
        <View style={styles.card}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.cardTitle}>Genel Skor</Text>
            <Text style={styles.scoreCardValue}>{score}/100</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${score}%` }]} />
          </View>

          {score < 100 && scoreSuggestions.length > 0 && (
            <>
              <Text style={styles.scoreHint}>Skorunu artırmak için:</Text>
              {scoreSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setEditMode(true)}
                  style={styles.scoreSuggestionRow}
                >
                  <Text style={styles.scoreSuggestionStar}>✦</Text>
                  <Text style={styles.scoreSuggestionText}>
                    {s.label} (+{s.points} puan)
                  </Text>
                  <Text style={styles.scoreSuggestionArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {score >= 100 && (
            <View style={styles.scoreCompleteBanner}>
              <Text style={{ fontSize: 20 }}>🏆</Text>
              <Text style={styles.scoreCompleteText}>Profil tamamlandı! Scoutlar seni görebilir.</Text>
            </View>
          )}
        </View>

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
          <HapticTouchable style={[styles.editBtn, styles.actionBtnFlex]} onPress={() => setEditMode(true)}>
            <Text style={styles.editBtnText}>✎ Düzenle</Text>
          </HapticTouchable>
          <HapticTouchable style={[styles.editBtn, styles.actionBtnFlex]} onPress={() => setShowShareCard(true)}>
            <Text style={styles.editBtnText}>↗ Profil Paylaş</Text>
          </HapticTouchable>
        </View>

        {/* Skills */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yetenek Skorları</Text>
          {skillsFromStats(cardStats).map((s, i) => (
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

        {/* Video Gallery */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Video Galeri</Text>
          <HapticTouchable>
            <Text style={styles.sectionLink}>Tümü →</Text>
          </HapticTouchable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {[1, 2, 3].map((_, i) => (
            <HapticTouchable key={i} style={styles.galleryItem}>
              <View style={styles.playBtn}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </HapticTouchable>
          ))}
          <HapticTouchable style={[styles.galleryItem, styles.galleryAdd]}>
            <Text style={styles.galleryAddIcon}>+</Text>
            <Text style={styles.galleryAddText}>Ekle</Text>
          </HapticTouchable>
        </ScrollView>

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
          <Text style={styles.shareModalTitle}>Oyuncu Kartın</Text>
          <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
            <PlayerShareCard
              name={fullName}
              position={position}
              score={aiOverall ?? score}
              city={city}
              club={club}
              avatarUrl={avatarUrl}
              isPremium={isPremiumActive}
              stats={cardStats}
            />
          </ViewShot>
          <Text style={styles.shareModalHint}>Kartını kaydet veya paylaş</Text>

          <View style={styles.shareOptionsList}>
            <TouchableOpacity
              onPress={() => captureAndShare('instagram')}
              style={[styles.shareOptionRow, { backgroundColor: '#833AB4' }]}
            >
              <Text style={styles.shareOptionIcon}>📸</Text>
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>Instagram Hikaye</Text>
                <Text style={styles.shareOptionSubtitle}>Hikayene ekle</Text>
              </View>
              <Text style={styles.shareOptionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('twitter')}
              style={[styles.shareOptionRow, { backgroundColor: '#000000', borderWidth: 1, borderColor: '#333' }]}
            >
              <Text style={styles.shareOptionIcon}>𝕏</Text>
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>X (Twitter)</Text>
                <Text style={styles.shareOptionSubtitle}>Tweet olarak paylaş</Text>
              </View>
              <Text style={styles.shareOptionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('whatsapp')}
              style={[styles.shareOptionRow, { backgroundColor: '#25D366' }]}
            >
              <Text style={styles.shareOptionIcon}>💬</Text>
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>WhatsApp</Text>
                <Text style={styles.shareOptionSubtitle}>Arkadaşlarınla paylaş</Text>
              </View>
              <Text style={styles.shareOptionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => captureAndShare('gallery')}
              style={[styles.shareOptionRow, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' }]}
            >
              <Text style={styles.shareOptionIcon}>💾</Text>
              <View style={styles.shareOptionTextWrap}>
                <Text style={styles.shareOptionTitle}>Galeriye Kaydet</Text>
                <Text style={styles.shareOptionSubtitle}>Fotoğraf olarak indir</Text>
              </View>
              <Text style={styles.shareOptionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => captureAndShare('general')} style={styles.shareOptionMore}>
              <Text style={styles.shareOptionMoreText}>Diğer uygulamalar →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowShareCard(false)}
              style={[styles.shareModalCloseBtn, styles.shareModalCloseBtnCentered]}
            >
              <Text style={styles.shareModalCloseBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
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
    headerSpacer: { width: 40 },
    heroSection: { alignItems: 'center', paddingVertical: 24 },
    avatarWrap: { position: 'relative', marginBottom: 16 },
    avatarWrapPremium: {
      shadowColor: theme.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 14,
      elevation: 10,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.card2,
      borderWidth: 2,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPremium: {
      borderWidth: 3,
      borderColor: theme.goldLight,
    },
    crownBadge: {
      position: 'absolute',
      top: -10,
      right: -6,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.gold,
    },
    crownBadgeIcon: { fontSize: 16 },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.gold,
      borderRadius: 12,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.bg,
    },
    cameraBadgeIcon: { fontSize: 14 },
    premiumMemberBadge: {
      marginTop: 8,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    premiumMemberText: { fontSize: 11, fontWeight: '800', color: theme.gold, letterSpacing: 0.5 },
    avatarEmoji: { fontSize: 44 },
    avatarImage: { width: 100, height: 100, borderRadius: 50 },
    name: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 },
    position: { fontSize: 13, color: theme.gold, fontWeight: '600', letterSpacing: 1 },
    club: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    statVal: { fontSize: 22, fontWeight: '800', color: theme.gold },
    statLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600', marginTop: 2 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 16 },
    scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    scoreCardValue: { fontSize: 20, fontWeight: '900', color: theme.gold },
    completionTrack: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
    completionFill: { height: 8, backgroundColor: theme.gold, borderRadius: 4 },
    scoreHint: { fontSize: 13, color: theme.textSecondary, marginTop: 12, marginBottom: 10 },
    scoreSuggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: theme.card2,
      borderRadius: 12,
      marginBottom: 6,
    },
    scoreSuggestionStar: { color: theme.gold },
    scoreSuggestionText: { color: theme.text, flex: 1, fontSize: 13 },
    scoreSuggestionArrow: { color: theme.gold, fontSize: 12 },
    scoreCompleteBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      marginTop: 12,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderRadius: 12,
    },
    scoreCompleteText: { color: theme.gold, fontWeight: '700', flex: 1 },
    bioRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    bioLabel: { fontSize: 12, color: theme.textSecondary },
    bioValue: { fontSize: 13, color: theme.text, fontWeight: '600' },
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
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    editBtnText: { fontSize: 13, fontWeight: '700', color: theme.gold },
    skillItem: { marginBottom: 14 },
    skillTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    skillName: { fontSize: 13, color: theme.textMuted },
    skillVal: { fontSize: 13, color: theme.text, fontWeight: '700' },
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
    sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    sectionLink: { fontSize: 13, color: theme.gold, fontWeight: '600' },
    gallery: { paddingLeft: 24, marginBottom: 20 },
    galleryItem: {
      width: 120,
      height: 80,
      backgroundColor: theme.card,
      borderRadius: 14,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    playBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playIcon: { fontSize: 12, color: '#000' },
    galleryAdd: { borderStyle: 'dashed', borderColor: theme.goldDark },
    galleryAddIcon: { fontSize: 20, color: theme.gold },
    galleryAddText: { fontSize: 10, color: theme.gold, fontWeight: '600' },

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
    editHeaderTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    editHeaderCancel: { fontSize: 15, color: theme.gold },
    editHeaderSave: { fontSize: 15, fontWeight: '700', color: theme.gold },
    editContent: { padding: 16, paddingBottom: 60 },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: 14,
      paddingHorizontal: 16,
      justifyContent: 'center',
      color: theme.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputDisabled: { opacity: 0.5 },
    inputValueText: { color: theme.text, fontSize: 14 },
    inputPlaceholderText: { color: theme.textSecondary, fontSize: 14 },
    footRow: { flexDirection: 'row', gap: 8 },
    footPill: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footPillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    footPillText: { color: theme.text, fontWeight: '600', fontSize: 11 },
    footPillTextActive: { color: '#000' },

    // Inline expandable picker (renders directly below the tapped field)
    inlinePicker: {
      backgroundColor: theme.card2,
      borderRadius: 12,
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
    listRowText: { fontSize: 15, color: theme.text },
    checkmark: { fontSize: 15, color: theme.gold, fontWeight: '700' },
    pickerSectionHeader: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.gold,
      letterSpacing: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },

    // Share card modal (always dark, independent of app theme — matches the FIFA card style)
    shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    shareModalTitle: { color: '#E8B820', fontSize: 16, fontWeight: '700', marginBottom: 24 },
    shareModalHint: { color: '#666', fontSize: 12, marginTop: 16, marginBottom: 24 },
    shareModalCloseBtn: { backgroundColor: '#1a1a1a', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333' },
    shareModalCloseBtnCentered: { alignSelf: 'center', marginTop: 4 },
    shareModalCloseBtnText: { color: '#888' },
    shareOptionsList: { width: '100%', paddingHorizontal: 24, gap: 10 },
    shareOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
    shareOptionIcon: { fontSize: 22 },
    shareOptionTextWrap: { flex: 1 },
    shareOptionTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
    shareOptionSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    shareOptionArrow: { color: 'rgba(255,255,255,0.5)' },
    shareOptionMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
    shareOptionMoreText: { color: '#666', fontSize: 14 },
  });
