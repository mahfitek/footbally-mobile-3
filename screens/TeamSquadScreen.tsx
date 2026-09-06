import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';

type SquadMember = {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  score: number;
  jersey_number: number | null;
};

type FormationCoord = { x: number; y: number };
type FormationSlot = FormationCoord & { role: string };

const FORMATIONS_BY_COUNT: Record<number, Record<string, Record<string, FormationCoord[]>>> = {
  5: {
    '1-2-1 (Elmas)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 50, y: 68 }],
      MID: [{ x: 28, y: 48 }, { x: 72, y: 48 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '2-1-1 (Dengeli)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 30, y: 68 }, { x: 70, y: 68 }],
      MID: [{ x: 50, y: 48 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '1-1-2 (Hücum)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 50, y: 68 }],
      MID: [{ x: 50, y: 48 }],
      FWD: [{ x: 30, y: 22 }, { x: 70, y: 22 }],
    },
    '2-2 (Savunma)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 30, y: 70 }, { x: 70, y: 70 }],
      MID: [{ x: 30, y: 40 }, { x: 70, y: 40 }],
      FWD: [],
    },
    '3-1 (Üçlü Defans)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 20, y: 68 }, { x: 50, y: 68 }, { x: 80, y: 68 }],
      MID: [],
      FWD: [{ x: 50, y: 22 }],
    },
  },
  7: {
    '2-3-1 (En İyi)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 28, y: 70 }, { x: 72, y: 70 }],
      MID: [{ x: 18, y: 50 }, { x: 50, y: 48 }, { x: 82, y: 50 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '3-2-1 (Güçlü Defans)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 20, y: 70 }, { x: 50, y: 70 }, { x: 80, y: 70 }],
      MID: [{ x: 32, y: 50 }, { x: 68, y: 50 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '2-1-2-1 (Elmas)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 28, y: 72 }, { x: 72, y: 72 }],
      DM: [{ x: 50, y: 58 }],
      MID: [{ x: 28, y: 42 }, { x: 72, y: 42 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '1-3-2 (Orta Saha Hükm.)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 50, y: 72 }],
      MID: [{ x: 20, y: 52 }, { x: 50, y: 50 }, { x: 80, y: 52 }],
      FWD: [{ x: 32, y: 22 }, { x: 68, y: 22 }],
    },
    '2-2-2 (Dengeli)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 28, y: 72 }, { x: 72, y: 72 }],
      MID: [{ x: 28, y: 50 }, { x: 72, y: 50 }],
      FWD: [{ x: 28, y: 25 }, { x: 72, y: 25 }],
    },
    '3-1-2 (Hücum)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 20, y: 72 }, { x: 50, y: 72 }, { x: 80, y: 72 }],
      MID: [{ x: 50, y: 52 }],
      FWD: [{ x: 32, y: 22 }, { x: 68, y: 22 }],
    },
  },
  8: {
    '3-3-1 (Dengeli)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 20, y: 70 }, { x: 50, y: 70 }, { x: 80, y: 70 }],
      MID: [{ x: 20, y: 50 }, { x: 50, y: 48 }, { x: 80, y: 50 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '2-3-2 (Hücum)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 28, y: 72 }, { x: 72, y: 72 }],
      MID: [{ x: 18, y: 52 }, { x: 50, y: 50 }, { x: 82, y: 52 }],
      FWD: [{ x: 32, y: 25 }, { x: 68, y: 25 }],
    },
    '3-2-2 (Güçlü)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 20, y: 72 }, { x: 50, y: 72 }, { x: 80, y: 72 }],
      MID: [{ x: 32, y: 52 }, { x: 68, y: 52 }],
      FWD: [{ x: 32, y: 25 }, { x: 68, y: 25 }],
    },
    '2-4-1 (Orta Saha)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 28, y: 72 }, { x: 72, y: 72 }],
      MID: [{ x: 15, y: 52 }, { x: 38, y: 52 }, { x: 62, y: 52 }, { x: 85, y: 52 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '4-2-1 (Savunma)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      MID: [{ x: 32, y: 50 }, { x: 68, y: 50 }],
      FWD: [{ x: 50, y: 22 }],
    },
    '1-3-2-1 (Elmas)': {
      GK: [{ x: 50, y: 88 }],
      SW: [{ x: 50, y: 76 }],
      DEF: [{ x: 20, y: 64 }, { x: 50, y: 64 }, { x: 80, y: 64 }],
      MID: [{ x: 30, y: 46 }, { x: 70, y: 46 }],
      FWD: [{ x: 50, y: 22 }],
    },
  },
  11: {
    '4-4-2 (Klasik)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      MID: [{ x: 15, y: 52 }, { x: 38, y: 52 }, { x: 62, y: 52 }, { x: 85, y: 52 }],
      FWD: [{ x: 35, y: 25 }, { x: 65, y: 25 }],
    },
    '4-3-3 (Hücum)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      MID: [{ x: 25, y: 52 }, { x: 50, y: 50 }, { x: 75, y: 52 }],
      FWD: [{ x: 20, y: 22 }, { x: 50, y: 18 }, { x: 80, y: 22 }],
    },
    '4-2-3-1 (Modern)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      DM: [{ x: 35, y: 58 }, { x: 65, y: 58 }],
      ATT: [{ x: 20, y: 40 }, { x: 50, y: 38 }, { x: 80, y: 40 }],
      FWD: [{ x: 50, y: 20 }],
    },
    '3-5-2 (Orta Saha)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 25, y: 72 }, { x: 50, y: 72 }, { x: 75, y: 72 }],
      MID: [{ x: 10, y: 52 }, { x: 30, y: 50 }, { x: 50, y: 48 }, { x: 70, y: 50 }, { x: 90, y: 52 }],
      FWD: [{ x: 35, y: 22 }, { x: 65, y: 22 }],
    },
    '5-3-2 (Savunma)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 10, y: 72 }, { x: 28, y: 70 }, { x: 50, y: 70 }, { x: 72, y: 70 }, { x: 90, y: 72 }],
      MID: [{ x: 25, y: 50 }, { x: 50, y: 48 }, { x: 75, y: 50 }],
      FWD: [{ x: 35, y: 22 }, { x: 65, y: 22 }],
    },
    '4-1-4-1 (Dengeli)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      DM: [{ x: 50, y: 60 }],
      MID: [{ x: 10, y: 45 }, { x: 32, y: 45 }, { x: 68, y: 45 }, { x: 90, y: 45 }],
      FWD: [{ x: 50, y: 20 }],
    },
    '3-4-3 (Toplam Futbol)': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 25, y: 72 }, { x: 50, y: 72 }, { x: 75, y: 72 }],
      MID: [{ x: 15, y: 52 }, { x: 38, y: 52 }, { x: 62, y: 52 }, { x: 85, y: 52 }],
      FWD: [{ x: 20, y: 22 }, { x: 50, y: 18 }, { x: 80, y: 22 }],
    },
    '4-4-2 Elmas': {
      GK: [{ x: 50, y: 88 }],
      DEF: [{ x: 15, y: 72 }, { x: 38, y: 72 }, { x: 62, y: 72 }, { x: 85, y: 72 }],
      DM: [{ x: 50, y: 58 }],
      MID: [{ x: 25, y: 48 }, { x: 75, y: 48 }],
      ATT: [{ x: 50, y: 36 }],
      FWD: [{ x: 35, y: 22 }, { x: 65, y: 22 }],
    },
  },
};

const PLAYER_COUNTS = [5, 7, 8, 11] as const;

const PITCH_WIDTH = 320;
const PITCH_HEIGHT = 420;

const POSITION_LABELS_TR: Record<string, string> = { GK: 'KAL', DEF: 'DEF', MID: 'ORT', FWD: 'FOR', ATT: 'ATK', DM: 'DMF', SW: 'LIB' };
const POSITION_LABELS_EN: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', ATT: 'AM', DM: 'DM', SW: 'SW' };

const getFirstName = (name: string) => (name ? name.split(' ')[0] : '');

const getPositionLabel = (role: string, lang: 'tr' | 'en') =>
  (lang === 'tr' ? POSITION_LABELS_TR : POSITION_LABELS_EN)[role] || role;

const getAllPositions = (playerCount: number | null, formation: string): FormationSlot[] => {
  if (!playerCount) return [];
  const f = FORMATIONS_BY_COUNT[playerCount]?.[formation];
  if (!f) return [];
  const positions: FormationSlot[] = [];
  Object.entries(f).forEach(([role, coords]) => {
    coords.forEach((coord) => positions.push({ ...coord, role }));
  });
  return positions;
};

const autoAssignPlayers = (members: SquadMember[], playerCount: number | null, formation: string): (SquadMember | null)[] => {
  const positions = getAllPositions(playerCount, formation);
  const assigned: (SquadMember | null)[] = new Array(positions.length).fill(null);

  const findSlot = (roles: string[]) =>
    positions.findIndex((p, i) => roles.includes(p.role) && !assigned[i]);

  members.forEach((member) => {
    const pos = member.position || '';
    let roleIndex = -1;

    if (pos.includes('GK') || pos.includes('Kaleci')) {
      roleIndex = findSlot(['GK']);
    } else if (pos.includes('Libero') || pos.includes('SW')) {
      roleIndex = findSlot(['SW', 'DEF']);
    } else if (pos.includes('Stoper') || pos.includes('CB') || pos.includes('Bek') || pos.includes('DEF')) {
      roleIndex = findSlot(['DEF', 'SW']);
    } else if (pos.includes('CDM') || pos.includes('Savunma Orta') || pos.includes('DM')) {
      roleIndex = findSlot(['DM', 'MID']);
    } else if (pos.includes('Orta Saha') || pos.includes('CM') || pos.includes('CAM') || pos.includes('MID')) {
      roleIndex = findSlot(['MID', 'ATT']);
    } else if (pos.includes('Kanat') || pos.includes('Wing') || pos.includes('RW') || pos.includes('LW')) {
      roleIndex = findSlot(['FWD', 'ATT', 'MID']);
    } else if (pos.includes('Forvet') || pos.includes('ST') || pos.includes('FWD')) {
      roleIndex = findSlot(['FWD']);
    }

    if (roleIndex !== -1) {
      assigned[roleIndex] = member;
    }
  });

  return assigned;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

export default function TeamSquadScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [selectedFormation, setSelectedFormation] = useState('');
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [overrides, setOverrides] = useState<Record<number, SquadMember | null>>({});
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadSquad();
  }, [userId]);

  useEffect(() => {
    setOverrides({});
  }, [playerCount, selectedFormation]);

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const loadSquad = async () => {
    setLoading(true);
    const uid = await resolveUserId();
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('owner_id', uid)
      .maybeSingle();

    if (teamError || !team) {
      if (__DEV__ && teamError) console.log('Takım yüklenemedi:', teamError);
      setTeamId(null);
      setLoading(false);
      return;
    }

    setTeamId(team.id);
    setTeamName(team.name);

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, user_id, jersey_number')
      .eq('team_id', team.id);

    if (membersError || !members) {
      if (__DEV__ && membersError) console.log('Kadro yüklenemedi:', membersError);
      setSquadMembers([]);
      setLoading(false);
      return;
    }

    const userIds = members.map((m: any) => m.user_id).filter(Boolean);
    const profilesById = new Map<string, { full_name: string | null; position: string | null; score: number | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, position, score')
        .in('user_id', userIds);

      if (profilesError) {
        if (__DEV__) console.log('Kadro oyuncu profilleri yüklenemedi:', profilesError);
      } else {
        (profiles ?? []).forEach((p: any) => profilesById.set(p.user_id, p));
      }
    }

    setSquadMembers(
      members.map((m: any) => {
        const profile = profilesById.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          full_name: profile?.full_name ?? t('match_defaultPlayerName'),
          position: profile?.position ?? '',
          score: profile?.score ?? 50,
          jersey_number: m.jersey_number,
        };
      })
    );
    setLoading(false);
  };

  const basePositions = useMemo(
    () => autoAssignPlayers(squadMembers, playerCount, selectedFormation),
    [squadMembers, playerCount, selectedFormation]
  );
  const slots = useMemo(() => getAllPositions(playerCount, selectedFormation), [playerCount, selectedFormation]);
  const finalPositions = useMemo(
    () => basePositions.map((p, i) => (i in overrides ? overrides[i] : p)),
    [basePositions, overrides]
  );

  const placedUserIds = new Set(finalPositions.filter(Boolean).map((m) => (m as SquadMember).user_id));
  const unassignedMembers = squadMembers.filter((m) => !placedUserIds.has(m.user_id));

  const handlePlayerSpotPress = (index: number) => {
    const member = finalPositions[index];
    if (member) {
      Alert.alert(
        member.full_name,
        `${member.position || t('teamSquad_positionUnspecified')} · ${t('teamSquad_scoreLabel')}: ${member.score}`,
        [
          { text: t('teamSquad_removeFromPosition'), onPress: () => setOverrides((prev) => ({ ...prev, [index]: null })) },
          { text: t('teamSquad_removeFromSquad'), style: 'destructive', onPress: () => handleRemoveMember(member) },
          { text: t('match_close'), style: 'cancel' },
        ]
      );
    } else {
      setPickerSlotIndex(index);
    }
  };

  const assignToSlot = (member: SquadMember) => {
    if (pickerSlotIndex === null) return;
    setOverrides((prev) => ({ ...prev, [pickerSlotIndex]: member }));
    setPickerSlotIndex(null);
  };

  const handleRemoveMember = (member: SquadMember) => {
    Alert.alert(
      t('teamSquad_removeFromSquad'),
      `${t('teamSquad_removeConfirmPrefix')}${member.full_name}${t('teamSquad_removeConfirmSuffix')}`,
      [
        { text: t('match_giveUp'), style: 'cancel' },
        { text: t('teamSquad_remove'), style: 'destructive', onPress: () => removeMember(member.id) },
      ]
    );
  };

  const removeMember = async (memberId: string) => {
    setRemovingId(memberId);
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      if (__DEV__) console.log('Oyuncu çıkarılamadı:', error);
      setToast({ message: t('teamSquad_removeFailed'), type: 'error' });
    } else {
      setToast({ message: t('teamSquad_removeSuccess'), type: 'success' });
      await loadSquad();
    }
    setRemovingId(null);
  };

  const handleInvite = async () => {
    if (!teamId) return;
    const inviteLink = `https://getfootbally.com/join-team/${teamId}`;
    try {
      await Share.share({
        message: `${t('teamSquad_inviteSharePrefix')}${teamName}${t('teamSquad_inviteShareSuffix')}\n${inviteLink}`,
        title: t('teamSquad_inviteShareTitle'),
      });
    } catch {
      setToast({ message: t('teamSquad_inviteShareFailed'), type: 'error' });
    }
  };

  if (loading) {
    return <LoadingScreen message={t('teamSquad_loading')} />;
  }

  if (!teamId) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="business-outline"
          title={t('teamHome_noTeamTitle')}
          subtitle={t('teamSquad_noTeamSub')}
          actionLabel={t('teamHome_createTeam')}
          onAction={() => navigate('teamEdit')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('teamHome')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('teamSquad_title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      {playerCount === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontFamily: FontFamily.display, letterSpacing: 0.5, marginBottom: 8 }}>{t('teamSquad_howManyTitle')}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, fontFamily: FontFamily.body, marginBottom: 32 }}>{t('teamSquad_howManySub')}</Text>
          {PLAYER_COUNTS.map((count) => (
            <TouchableOpacity
              key={count}
              onPress={() => {
                setPlayerCount(count);
                setSelectedFormation(Object.keys(FORMATIONS_BY_COUNT[count])[0]);
              }}
              style={{
                width: '100%',
                backgroundColor: theme.card,
                borderRadius: RADIUS,
                padding: 20,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <View style={{ width: 52, height: 52, borderRadius: RADIUS, backgroundColor: theme.card2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: theme.gold, fontSize: 20, fontFamily: FontFamily.display }}>{count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.bodySemiBold }}>{count}v{count}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontFamily: FontFamily.mono }}>
                  {count === 5 ? t('teamSquad_format5') : count === 7 ? t('teamSquad_format7') : count === 8 ? t('teamSquad_format8') : t('teamSquad_format11')}
                </Text>
                <Text style={{ color: theme.gold, fontSize: 12, fontFamily: FontFamily.mono, marginTop: 2 }}>{Object.keys(FORMATIONS_BY_COUNT[count]).length} {t('teamSquad_formationsCount')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setPlayerCount(null)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, paddingHorizontal: 16 }}
          >
            <Ionicons name="chevron-back" size={13} color={theme.gold} />
            <Text style={{ color: theme.gold, fontSize: 13, fontFamily: FontFamily.mono }}>{playerCount}v{playerCount} {t('teamSquad_changeFormat')}</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 16 }}>
              {playerCount}v{playerCount} {t('teamSquad_formationsHeader')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {Object.keys(FORMATIONS_BY_COUNT[playerCount] || {}).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedFormation(f)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: RADIUS,
                    minWidth: 100,
                    alignItems: 'center',
                    backgroundColor: selectedFormation === f ? theme.gold : theme.card,
                    borderWidth: 1,
                    borderColor: selectedFormation === f ? theme.gold : theme.border,
                  }}
                >
                  <Text style={{ color: selectedFormation === f ? Paper.ink : theme.text, fontFamily: FontFamily.monoMedium, fontSize: 13 }}>{f.split(' ')[0]}</Text>
                  <Text style={{ color: selectedFormation === f ? Paper.ink : theme.textSecondary, fontSize: 10, fontFamily: FontFamily.mono, marginTop: 2 }}>
                    {f.includes('(') ? f.match(/\(([^)]+)\)/)?.[1] : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.pitch}>
            <View style={styles.centerCircle} />
            <View style={styles.centerLine} />
            <View style={styles.centerDot} />
            <View style={[styles.goalArea, { top: 0, borderTopWidth: 0 }]} />
            <View style={[styles.goalArea, { bottom: 0, borderBottomWidth: 0 }]} />
            <View style={[styles.penaltyArea, { top: 0, borderTopWidth: 0 }]} />
            <View style={[styles.penaltyArea, { bottom: 0, borderBottomWidth: 0 }]} />

            {slots.map((pos, index) => {
              const member = finalPositions[index];
              const x = (pos.x / 100) * PITCH_WIDTH;
              const y = (pos.y / 100) * PITCH_HEIGHT;

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePlayerSpotPress(index)}
                  style={{ position: 'absolute', left: x - 24, top: y - 32, alignItems: 'center', width: 48 }}
                >
                  <View style={[styles.playerDot, member ? styles.playerDotFilled : styles.playerDotEmpty]}>
                    {member ? (
                      <Text style={styles.playerDotNumber}>{member.jersey_number || index + 1}</Text>
                    ) : (
                      <Text style={styles.playerDotPlus}>+</Text>
                    )}
                  </View>
                  <View style={styles.playerNameTag}>
                    <Text style={styles.playerNameText} numberOfLines={1}>
                      {member ? getFirstName(member.full_name) : getPositionLabel(pos.role, lang)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('teamSquad_squadHeader')}</Text>
            <Text style={styles.sectionCount}>{squadMembers.length} {t('teamSquad_playersCount')}</Text>
          </View>

          {squadMembers.length === 0 ? (
            <EmptyState icon="people-outline" title={t('teamSquad_emptySquadTitle')} subtitle={t('teamSquad_emptySquadSub')} />
          ) : (
            <View style={styles.squadList}>
              {squadMembers.map((m) => (
                <View key={m.id} style={styles.squadRow}>
                  <View style={styles.squadAvatar}>
                    <Ionicons name="person-outline" size={17} color={theme.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.squadName}>{m.full_name}</Text>
                    <Text style={styles.squadMeta}>{m.position || t('teamSquad_positionUnspecified')}</Text>
                  </View>
                  <Text style={styles.squadScore}>{m.score}</Text>
                  <HapticTouchable
                    style={styles.removeBtn}
                    onPress={() => handleRemoveMember(m)}
                    disabled={removingId === m.id}
                  >
                    {removingId === m.id ? (
                      <ActivityIndicator size="small" color={theme.error} />
                    ) : (
                      <Ionicons name="close" size={15} color={theme.error} />
                    )}
                  </HapticTouchable>
                </View>
              ))}
            </View>
          )}

          <HapticTouchable style={[styles.inviteBtn, { flexDirection: 'row', gap: 6, justifyContent: 'center' }]} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={15} color={Paper.ink} />
            <Text style={styles.inviteBtnText}>{t('teamSquad_inviteBtn')}</Text>
          </HapticTouchable>
        </ScrollView>
      )}

      <BottomSheet
        visible={pickerSlotIndex !== null}
        onClose={() => setPickerSlotIndex(null)}
        theme={theme}
        contentStyle={{ maxHeight: '75%' }}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('teamSquad_pickPlayerTitle')}</Text>
          <HapticTouchable onPress={() => setPickerSlotIndex(null)}>
            <Ionicons name="close" size={19} color={theme.textSecondary} />
          </HapticTouchable>
        </View>
        {unassignedMembers.length === 0 ? (
          <View style={{ paddingVertical: 32 }}>
            <EmptyState icon="person-outline" title={t('teamSquad_noUnassignedTitle')} subtitle={t('teamSquad_noUnassignedSub')} />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {unassignedMembers.map((m) => (
              <TouchableOpacity key={m.id} style={styles.pickerRow} onPress={() => assignToSlot(m)}>
                <View style={styles.squadAvatar}>
                  <Ionicons name="person-outline" size={17} color={theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.squadName}>{m.full_name}</Text>
                  <Text style={styles.squadMeta}>{m.position || t('teamSquad_positionUnspecified')}</Text>
                </View>
                <Text style={styles.squadScore}>{m.score}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </BottomSheet>

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
      width: 42, height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    pitch: {
      width: PITCH_WIDTH,
      height: PITCH_HEIGHT,
      backgroundColor: '#2d5a1b',
      borderRadius: RADIUS,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      alignSelf: 'center',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 28,
    },
    centerCircle: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 40,
      left: PITCH_WIDTH / 2 - 40,
      width: 80, height: 80, borderRadius: 40,
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    },
    centerLine: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 1,
      left: 0, right: 0, height: 1.5,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    centerDot: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 3,
      left: PITCH_WIDTH / 2 - 3,
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    goalArea: {
      position: 'absolute',
      left: PITCH_WIDTH * 0.3,
      width: PITCH_WIDTH * 0.4,
      height: PITCH_HEIGHT * 0.12,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    penaltyArea: {
      position: 'absolute',
      left: PITCH_WIDTH * 0.15,
      width: PITCH_WIDTH * 0.7,
      height: PITCH_HEIGHT * 0.2,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    playerDot: {
      width: 36, height: 36, borderRadius: 18,
      borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    playerDotFilled: { backgroundColor: theme.gold, borderColor: '#fff' },
    playerDotEmpty: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)' },
    playerDotNumber: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: Paper.ink },
    playerDotPlus: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
    playerNameTag: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      marginTop: 2,
    },
    playerNameText: { fontFamily: FontFamily.bodySemiBold, color: '#fff', fontSize: 9, textAlign: 'center' },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    sectionCount: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    squadList: { paddingHorizontal: 24, gap: 10, marginBottom: 24 },
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
    squadScore: { fontFamily: FontFamily.display, fontSize: 15, color: theme.gold },
    removeBtn: {
      width: 30, height: 30,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.error,
    },
    inviteBtn: {
      height: 52,
      marginHorizontal: 24,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteBtnText: { fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 0.5, color: Paper.ink },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 32,
      maxHeight: '75%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
  });
