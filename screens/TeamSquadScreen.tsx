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
import { profiles } from '../lib/profiles';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';
import FormationPitch from '../components/FormationPitch';
import { FORMATIONS, getFormationSlots, type FormationSlot, type MatchFormat } from '../lib/formations';

type SquadMember = {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  score: number;
  jersey_number: number | null;
};

const PLAYER_COUNTS = [5, 7, 8, 11] as const;

const getFirstName = (name: string) => (name ? name.split(' ')[0] : '');

const getAllPositions = (playerCount: number | null, formation: string): FormationSlot[] =>
  playerCount ? getFormationSlots(playerCount, formation) : [];


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
      const { data: squadProfiles, error: profilesError } = await profiles.publicProfiles(userIds, 'user_id, full_name, position, score');

      if (profilesError) {
        if (__DEV__) console.log('Kadro oyuncu profilleri yüklenemedi:', profilesError);
      } else {
        (squadProfiles ?? []).forEach((p: any) => profilesById.set(p.user_id, p));
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

  useEffect(() => {
    loadSquad();
  }, [userId]);

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
                setSelectedFormation(FORMATIONS[count][0]);
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
                <Text style={{ color: theme.goldDark, fontSize: 20, fontFamily: FontFamily.display }}>{count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.bodySemiBold }}>{count}v{count}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontFamily: FontFamily.mono }}>
                  {count === 5 ? t('teamSquad_format5') : count === 7 ? t('teamSquad_format7') : count === 8 ? t('teamSquad_format8') : t('teamSquad_format11')}
                </Text>
                <Text style={{ color: theme.goldDark, fontSize: 12, fontFamily: FontFamily.mono, marginTop: 2 }}>{FORMATIONS[count].length} {t('teamSquad_formationsCount')}</Text>
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
            <Text style={{ color: theme.goldDark, fontSize: 13, fontFamily: FontFamily.mono }}>{playerCount}v{playerCount} {t('teamSquad_changeFormat')}</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 16 }}>
              {playerCount}v{playerCount} {t('teamSquad_formationsHeader')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {(FORMATIONS[playerCount as MatchFormat] ?? []).map((f) => (
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


          <FormationPitch
            slots={slots}
            lang={lang}
            seats={finalPositions.map((m, index) =>
              m ? { label: getFirstName(m.full_name), number: m.jersey_number || index + 1 } : null
            )}
            onSeatPress={handlePlayerSpotPress}
          />

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
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text, letterSpacing: 0.2 },
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
    squadName: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    squadMeta: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 2 },
    squadScore: { fontFamily: FontFamily.display, fontSize: 15, color: theme.goldDark },
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
