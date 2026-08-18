import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';

type TeamData = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  league: string | null;
  founded_year: number | null;
  ground_name: string | null;
  description: string | null;
  playing_style: string[] | null;
  formation: string | null;
  match_days: string[] | null;
  needed_positions: string[] | null;
  logo_url: string | null;
  photos: string[] | null;
  videos: string[] | null;
  wins: number;
  losses: number;
  draws: number;
  goals_scored: number;
  goals_conceded: number;
  rating: number;
};

type SquadMember = {
  id: string;
  name: string;
  position: string;
  score: number;
};

type Application = {
  id: string;
  full_name: string;
  position: string;
  age: number;
  city: string;
  score: number;
  status: string;
  applied_at: string;
};

const FAKE_APPLICATIONS: Application[] = [
  { id: '1', full_name: 'Ahmet Yılmaz', position: 'Santrafor (ST)', age: 22, city: 'İstanbul', score: 78, status: 'pending', applied_at: '2 saat önce' },
  { id: '2', full_name: 'Mert Çelik', position: 'Sol Forvet (LS)', age: 19, city: 'İstanbul', score: 65, status: 'pending', applied_at: '1 gün önce' },
];

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

export default function TeamProfileScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [showApplications, setShowApplications] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedPosition, setSelectedPosition] = useState('');

  useEffect(() => {
    loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    await loadTeam();
    setLoading(false);
  };

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const loadTeam = async () => {
    const uid = await resolveUserId();
    if (!uid) return;

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('owner_id', uid)
      .maybeSingle();

    if (error || !data) {
      if (__DEV__ && error) console.log('Takım profili yüklenemedi:', error);
      setTeam(null);
      return;
    }

    setTeam(data as TeamData);
    await loadSquad(data.id);
  };

  const loadSquad = async (teamId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, position, user_id')
      .eq('team_id', teamId);

    if (error || !data) {
      if (__DEV__ && error) console.log('Kadro yüklenemedi:', error);
      setSquad([]);
      return;
    }

    const userIds = data.map((m: any) => m.user_id).filter(Boolean);
    const profilesById = new Map<string, { full_name: string | null; score: number | null }>();

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, score')
        .in('user_id', userIds);

      if (profilesError) {
        if (__DEV__) console.log('Kadro oyuncu profilleri yüklenemedi:', profilesError);
      } else {
        (profilesData ?? []).forEach((p: any) => profilesById.set(p.user_id, p));
      }
    }

    setSquad(
      data.map((m: any) => {
        const profile = profilesById.get(m.user_id);
        return {
          id: m.id,
          name: profile?.full_name ?? 'İsimsiz Oyuncu',
          position: m.position ?? '-',
          score: profile?.score ?? 0,
        };
      })
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'İzin Gerekli',
        'Bunun için ayarlardan galeri iznini açmanız gerekiyor.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const pickTeamLogo = async () => {
    if (!team) return;
    if (!(await requestGalleryPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingLogo(true);
    try {
      const asset = result.assets[0];
      const fileName = `team-logo-${team.id}-${Date.now()}.jpg`;
      const buffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase.from('teams').update({ logo_url: publicUrl }).eq('id', team.id);
      if (updateError) throw updateError;

      setTeam({ ...team, logo_url: publicUrl });
      setToast({ message: 'Takım logosu güncellendi', type: 'success' });
    } catch (err) {
      if (__DEV__) console.log('Logo yüklenemedi:', err);
      setToast({ message: 'Logo yüklenemedi', type: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickTeamPhoto = async () => {
    if (!team) return;
    if (!(await requestGalleryPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const fileName = `team-photo-${team.id}-${Date.now()}.jpg`;
      const buffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const photos = [...(team.photos ?? []), urlData.publicUrl];

      const { error: updateError } = await supabase.from('teams').update({ photos }).eq('id', team.id);
      if (updateError) throw updateError;

      setTeam({ ...team, photos });
      setToast({ message: 'Fotoğraf eklendi', type: 'success' });
    } catch (err) {
      if (__DEV__) console.log('Fotoğraf yüklenemedi:', err);
      setToast({ message: 'Fotoğraf yüklenemedi', type: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickTeamVideo = async () => {
    if (!team) return;
    if (!(await requestGalleryPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingVideo(true);
    try {
      const asset = result.assets[0];
      const fileName = `team-video-${team.id}-${Date.now()}.mp4`;
      const buffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, buffer, { contentType: 'video/mp4', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const videos = [...(team.videos ?? []), urlData.publicUrl];

      const { error: updateError } = await supabase.from('teams').update({ videos }).eq('id', team.id);
      if (updateError) throw updateError;

      setTeam({ ...team, videos });
      setToast({ message: 'Video eklendi', type: 'success' });
    } catch (err) {
      if (__DEV__) console.log('Video yüklenemedi:', err);
      setToast({ message: 'Video yüklenemedi', type: 'error' });
    } finally {
      setUploadingVideo(false);
    }
  };

  const loadApplications = (position: string) => {
    setSelectedPosition(position);
    setApplications(FAKE_APPLICATIONS);
    setShowApplications(true);
  };

  const handleAcceptApplication = (app: Application) => {
    Alert.alert('Kabul Edildi', `${app.full_name} takıma davet edildi!`);
  };

  const handleRejectApplication = (app: Application) => {
    setApplications((prev) => prev.filter((a) => a.id !== app.id));
  };

  if (loading) {
    return <LoadingScreen message="Takım profili yükleniyor..." />;
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="business-outline"
          title="Henüz takımın yok"
          subtitle="Takım profilini oluşturarak başla"
          actionLabel="Takım Oluştur"
          onAction={() => navigate('teamEdit')}
        />
      </SafeAreaView>
    );
  }

  const statsRow = [
    { val: String(team.wins + team.losses + team.draws), label: 'Maç' },
    { val: String(team.wins), label: 'Galibiyet' },
    { val: String(team.draws), label: 'Beraberlik' },
    { val: String(team.losses), label: 'Mağlubiyet' },
    { val: String(team.goals_scored), label: 'Gol Atılan' },
    { val: String(team.goals_conceded), label: 'Gol Yenilen' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TAKIM PROFİLİM</Text>
          <TouchableOpacity onPress={() => navigate('settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <HapticTouchable style={styles.logoWrap} onPress={pickTeamLogo} disabled={uploadingLogo}>
            {team.logo_url ? (
              <Image source={{ uri: team.logo_url }} style={styles.logoImage} />
            ) : (
              <Ionicons name="business-outline" size={36} color={theme.gold} />
            )}
            <View style={styles.logoEditBadge}>
              <Ionicons name="camera-outline" size={13} color={Paper.ink} />
            </View>
          </HapticTouchable>
          <Text style={styles.name}>{team.name}</Text>
          <View style={styles.leagueBadge}>
            <Text style={styles.leagueBadgeText}>{team.league ?? 'Amatör'}</Text>
          </View>
          <Text style={styles.location}>
            {team.city ?? 'Şehir belirtilmedi'}{team.district ? `, ${team.district}` : ''}
          </Text>
          {team.founded_year && <Text style={styles.founded}>Kuruluş: {team.founded_year}</Text>}
          <HapticTouchable style={[styles.editBtn, { flexDirection: 'row', gap: 6 }]} onPress={() => navigate('teamEdit')}>
            <Ionicons name="create-outline" size={13} color={theme.gold} />
            <Text style={styles.editBtnText}>Profili Düzenle</Text>
          </HapticTouchable>
        </View>

        <View style={styles.statsBar}>
          {statsRow.map((s, i) => (
            <View key={i} style={[styles.statItem, i === statsRow.length - 1 && { borderRightWidth: 0 }]}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hakkında</Text>
          <Text style={styles.description}>{team.description || 'Henüz açıklama eklenmedi.'}</Text>

          {team.playing_style && team.playing_style.length > 0 && (
            <View style={styles.pillsRow}>
              {team.playing_style.map((s) => (
                <View key={s} style={styles.pill}>
                  <Text style={styles.pillText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bioRow}>
            <Text style={styles.bioLabel}>Diziliş</Text>
            <Text style={styles.bioValue}>{team.formation ?? '-'}</Text>
          </View>
          <View style={styles.bioRow}>
            <Text style={styles.bioLabel}>Maç Günleri</Text>
            <Text style={styles.bioValue}>{team.match_days?.join(', ') || '-'}</Text>
          </View>
          <View style={[styles.bioRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.bioLabel}>Saha</Text>
            <Text style={styles.bioValue}>{team.ground_name ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.mediaSection}>
          <Text style={styles.mediaSectionTitle}>TAKIM FOTOĞRAFLARI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(team.photos ?? []).map((photo, i) => (
              <Image key={i} source={{ uri: photo }} style={styles.mediaThumb} />
            ))}
            <HapticTouchable style={styles.mediaAddBtn} onPress={pickTeamPhoto} disabled={uploadingPhoto}>
              <Ionicons name="add" size={22} color={theme.gold} />
              <Text style={styles.mediaAddLabel}>{uploadingPhoto ? 'Yükleniyor...' : 'Fotoğraf'}</Text>
            </HapticTouchable>
          </ScrollView>
        </View>

        <View style={styles.mediaSection}>
          <Text style={styles.mediaSectionTitle}>TAKIM VİDEOLARI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(team.videos ?? []).map((_, i) => (
              <View key={i} style={styles.videoThumb}>
                <Ionicons name="play" size={20} color={theme.gold} />
              </View>
            ))}
            <HapticTouchable style={styles.mediaAddBtn} onPress={pickTeamVideo} disabled={uploadingVideo}>
              <Ionicons name="add" size={22} color={theme.gold} />
              <Text style={styles.mediaAddLabel}>{uploadingVideo ? 'Yükleniyor...' : 'Video'}</Text>
            </HapticTouchable>
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>KADRO</Text>
          <HapticTouchable onPress={() => navigate('teamSquad')}>
            <Text style={styles.sectionLink}>Kadroyu Yönet</Text>
          </HapticTouchable>
        </View>
        {squad.length === 0 ? (
          <EmptyState icon="people-outline" title="Kadroda oyuncu yok" subtitle="Oyuncu bularak kadrona ekle" />
        ) : (
          <View style={styles.squadList}>
            {squad.map((p) => (
              <View key={p.id} style={styles.squadRow}>
                <View style={styles.squadAvatar}>
                  <Ionicons name="person-outline" size={17} color={theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.squadName}>{p.name}</Text>
                  <Text style={styles.squadMeta}>{p.position}</Text>
                </View>
                <Text style={styles.squadScore}>{p.score}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ARANILAN POZİSYONLAR</Text>
        </View>
        {(!team.needed_positions || team.needed_positions.length === 0) ? (
          <EmptyState icon="search-outline" title="Aranan pozisyon yok" subtitle="Profili düzenleyerek pozisyon ekleyebilirsin" />
        ) : (
          <View style={styles.openPositions}>
            {team.needed_positions.map((pos, i) => (
              <View key={pos} style={[styles.positionRow, i === team.needed_positions!.length - 1 && { marginBottom: 0 }]}>
                <View>
                  <Text style={styles.positionRowTitle}>{pos}</Text>
                  <Text style={styles.positionRowSub}>Aktif arama</Text>
                </View>
                <HapticTouchable style={styles.viewApplicationsBtn} onPress={() => loadApplications(pos)}>
                  <Text style={styles.viewApplicationsBtnText}>Başvuruları Görüntüle</Text>
                </HapticTouchable>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showApplications} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <View style={styles.appHeader}>
            <HapticTouchable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => setShowApplications(false)}>
              <Ionicons name="chevron-back" size={16} color={theme.gold} />
              <Text style={styles.appBackText}>Geri</Text>
            </HapticTouchable>
            <View style={{ flex: 1 }}>
              <Text style={styles.appTitle}>BAŞVURULAR</Text>
              <Text style={styles.appSubtitle}>{selectedPosition} · {applications.length} başvuru</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {applications.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="mail-open-outline" size={32} color={theme.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={{ color: theme.text, fontSize: 16, fontFamily: FontFamily.bodySemiBold }}>Henüz başvuru yok</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, fontFamily: FontFamily.body }}>Bu pozisyon için başvuru bekleniyor</Text>
              </View>
            ) : (
              applications.map((app) => (
                <View key={app.id} style={styles.appCard}>
                  <View style={styles.appCardTop}>
                    <View style={styles.appAvatar}>
                      <Ionicons name="person-outline" size={19} color={theme.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appName}>{app.full_name}</Text>
                      <Text style={styles.appPosition}>{app.position}</Text>
                      <Text style={styles.appMeta}>{app.city} · {app.age} yaş · {app.applied_at}</Text>
                    </View>
                    <Text style={styles.appScore}>{app.score}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptApplication(app)}>
                      <Text style={styles.acceptBtnText}>Kabul Et</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectApplication(app)}>
                      <Text style={styles.rejectBtnText}>Reddet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.msgBtn} onPress={() => navigate('chat')}>
                      <Text style={styles.msgBtnText}>Mesaj</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginTop: 16,
    },
    headerTitle: { color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5 },
    settingsBtn: {
      width: 40,
      height: 40,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    heroSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
    logoWrap: {
      width: 96, height: 96, borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.gold,
      marginBottom: 12,
    },
    logoImage: { width: 96, height: 96, borderRadius: RADIUS },
    logoEditBadge: {
      position: 'absolute', bottom: 0, right: 0,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      width: 26, height: 26,
      alignItems: 'center', justifyContent: 'center',
    },
    name: { fontFamily: FontFamily.display, fontSize: 22, color: theme.text, textAlign: 'center', marginBottom: 8, letterSpacing: 0.5 },
    leagueBadge: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 10,
    },
    leagueBadgeText: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold, letterSpacing: 0.5 },
    location: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
    founded: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginBottom: 16 },
    editBtn: {
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    editBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    statsBar: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    statVal: { fontFamily: FontFamily.display, fontSize: 15, color: theme.gold },
    statLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: theme.textSecondary, marginTop: 2, textAlign: 'center' },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, marginBottom: 12, letterSpacing: 0.5 },
    description: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, lineHeight: 19, marginBottom: 14 },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    pill: {
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    pillText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    bioRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    bioLabel: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    bioValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    mediaSection: { marginHorizontal: 24, marginBottom: 20 },
    mediaSectionTitle: { fontFamily: FontFamily.display, color: theme.text, fontSize: 15, marginBottom: 12, letterSpacing: 0.5 },
    mediaThumb: { width: 120, height: 80, borderRadius: RADIUS, marginRight: 10 },
    videoThumb: {
      width: 120, height: 80, borderRadius: RADIUS,
      backgroundColor: theme.card2,
      marginRight: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.border,
    },
    mediaAddBtn: {
      width: 120, height: 80, borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
      alignItems: 'center', justifyContent: 'center',
      marginRight: 10,
    },
    mediaAddLabel: { fontFamily: FontFamily.mono, color: theme.gold, fontSize: 11, marginTop: 4 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    sectionLink: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    squadList: { paddingHorizontal: 24, gap: 10, marginBottom: 28 },
    squadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    squadAvatar: {
      width: 38, height: 38,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    squadName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    squadMeta: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    squadScore: { fontFamily: FontFamily.display, fontSize: 17, color: theme.gold },
    openPositions: {
      marginHorizontal: 24,
      marginBottom: 28,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    positionRow: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    positionRowTitle: { fontFamily: FontFamily.bodySemiBold, color: theme.text, fontSize: 14 },
    positionRowSub: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 12, marginTop: 2 },
    viewApplicationsBtn: {
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    viewApplicationsBtnText: { fontFamily: FontFamily.monoMedium, color: Paper.ink, fontSize: 12 },
    appHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    appBackText: { color: theme.gold, fontSize: 13, fontFamily: FontFamily.mono },
    appTitle: { fontFamily: FontFamily.display, color: theme.text, fontSize: 17, letterSpacing: 0.5 },
    appSubtitle: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 12 },
    appCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    appCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    appAvatar: {
      width: 46, height: 46, borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center', justifyContent: 'center',
    },
    appName: { fontFamily: FontFamily.bodySemiBold, color: theme.text, fontSize: 15 },
    appPosition: { fontFamily: FontFamily.mono, color: theme.gold, fontSize: 12 },
    appMeta: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 11 },
    appScore: { fontFamily: FontFamily.display, color: theme.gold, fontSize: 20 },
    acceptBtn: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.success,
    },
    acceptBtnText: { fontFamily: FontFamily.monoMedium, color: theme.success, fontSize: 12 },
    rejectBtn: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.error,
    },
    rejectBtnText: { fontFamily: FontFamily.monoMedium, color: theme.error, fontSize: 12 },
    msgBtn: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    msgBtnText: { fontFamily: FontFamily.monoMedium, color: theme.gold, fontSize: 12 },
  });
