import { useEffect, useState } from 'react';
import ListingBoard from '../components/ListingBoard';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, Paper, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { discoveryRpcClient, discoveryBlocksClient } from '../lib/discoveryClient';
import { POSITION_OPTIONS } from '../lib/matchListing';
import {
  applyPlayerFilters,
  fetchBlockedUserIds,
  fetchDiscoverablePlayers,
  isBlockedUser,
  playerProfileRoute,
  type DiscoverablePlayer,
} from '../lib/discovery';
import EmptyState from '../components/EmptyState';
import BlockedTag from '../components/BlockedTag';
import HapticTouchable from '../components/HapticTouchable';
import { TURKEY_CITIES } from '../constants/turkeyCities';

type FilterKey = 'city' | 'district' | 'position' | null;

interface Props {
  navigate: (screen: string, params?: any) => void;
  onBack?: () => void;
}

export default function FindPlayerScreen({ navigate, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [players, setPlayers] = useState<DiscoverablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [ownUserId, setOwnUserId] = useState<string | null>(null);

  // Yayınlanabilir oyuncular (sunucu: tamamlanmış, kısıtlı olmayan profiller) ve kendi engel listem.
  // Engel listesi okunamazsa oyuncular yine gösterilir; yalnızca "Engellendi" etiketi verilmez.
  const loadPlayers = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    setOwnUserId(uid);
    const list = await fetchDiscoverablePlayers(discoveryRpcClient, { limit: 100 });
    const blocked = uid ? await fetchBlockedUserIds(discoveryBlocksClient, uid) : new Set<string>();
    if (!list.ok) {
      setFailed(true);
      setPlayers([]);
    } else {
      setFailed(false);
      setPlayers(list.players);
      setBlockedIds(blocked ?? new Set<string>());
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void loadPlayers();
  }, []);

  const filteredPlayers = failed
    ? []
    : applyPlayerFilters(players, { city: selectedCity, district: selectedDistrict, positions: selectedPositions }, ownUserId);

  const clearFilters = () => {
    setSelectedCity('');
    setSelectedDistrict('');
    setSelectedPositions([]);
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) => (prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => (onBack ? onBack() : navigate('teamHome'))}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('findPlayer_title')}</Text>
        <Text style={styles.count}>{filteredPlayers.length} {t('findPlayer_countSuffix')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListingBoard navigate={navigate} allowedTypes={['players', 'individual']} titleKey="listing_playersBoardTitle" />
        {(selectedCity || selectedDistrict || selectedPositions.length > 0) && (
          <View style={styles.activeChipsRow}>
            {selectedCity && (
              <HapticTouchable style={styles.activeChip} onPress={() => { setSelectedCity(''); setSelectedDistrict(''); }}>
                <Ionicons name="location" size={12} color={theme.gold} />
                <Text style={styles.activeChipText}>{selectedCity}</Text>
                <Ionicons name="close" size={13} color={theme.textSecondary} />
              </HapticTouchable>
            )}
            {selectedDistrict && (
              <HapticTouchable style={styles.activeChip} onPress={() => setSelectedDistrict('')}>
                <Ionicons name="location" size={12} color={theme.gold} />
                <Text style={styles.activeChipText}>{selectedDistrict}</Text>
                <Ionicons name="close" size={13} color={theme.textSecondary} />
              </HapticTouchable>
            )}
            {selectedPositions.map((pos) => (
              <HapticTouchable key={pos} style={styles.activeChip} onPress={() => togglePosition(pos)}>
                <Text style={styles.activeChipText}>{pos}</Text>
                <Ionicons name="close" size={13} color={theme.textSecondary} />
              </HapticTouchable>
            ))}
          </View>
        )}

        <HapticTouchable
          style={[styles.filterBtn, { borderColor: selectedCity ? theme.gold : theme.border }]}
          onPress={() => setOpenFilter(openFilter === 'city' ? null : 'city')}
        >
          <Text style={[styles.filterBtnText, { color: selectedCity ? theme.gold : theme.textSecondary }]}>
            {selectedCity || t('findPlayer_selectCity')}
          </Text>
          <Ionicons name={openFilter === 'city' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
        </HapticTouchable>

        {openFilter === 'city' && (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
              <HapticTouchable
                style={styles.dropdownRow}
                onPress={() => {
                  setSelectedCity('');
                  setSelectedDistrict('');
                  setOpenFilter(null);
                }}
              >
                <Text style={styles.dropdownAllText}>{t('findPlayer_allCities')}</Text>
              </HapticTouchable>
              {TURKEY_CITIES.map((c) => (
                <HapticTouchable
                  key={c.plate}
                  style={styles.dropdownRow}
                  onPress={() => {
                    setSelectedCity(c.name);
                    setSelectedDistrict('');
                    setOpenFilter(null);
                  }}
                >
                  <Text style={styles.dropdownRowText}>{c.plate}. {c.name}</Text>
                  {selectedCity === c.name && <Text style={styles.checkmark}>✓</Text>}
                </HapticTouchable>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedCity && (
          <>
            <HapticTouchable
              style={[styles.filterBtn, { borderColor: selectedDistrict ? theme.gold : theme.border }]}
              onPress={() => setOpenFilter(openFilter === 'district' ? null : 'district')}
            >
              <Text style={[styles.filterBtnText, { color: selectedDistrict ? theme.gold : theme.textSecondary }]}>
                {selectedDistrict || t('findPlayer_selectDistrict')}
              </Text>
              <Ionicons name={openFilter === 'district' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
            </HapticTouchable>

            {openFilter === 'district' && (
              <View style={styles.dropdown}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  <HapticTouchable
                    style={styles.dropdownRow}
                    onPress={() => {
                      setSelectedDistrict('');
                      setOpenFilter(null);
                    }}
                  >
                    <Text style={styles.dropdownAllText}>{t('findPlayer_allDistricts')}</Text>
                  </HapticTouchable>
                  {(TURKEY_CITIES.find((c) => c.name === selectedCity)?.districts ?? []).map((d) => (
                    <HapticTouchable
                      key={d}
                      style={styles.dropdownRow}
                      onPress={() => {
                        setSelectedDistrict(d);
                        setOpenFilter(null);
                      }}
                    >
                      <Text style={styles.dropdownRowText}>{d}</Text>
                      {selectedDistrict === d && <Text style={styles.checkmark}>✓</Text>}
                    </HapticTouchable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

        <HapticTouchable
          style={[styles.filterBtn, { borderColor: selectedPositions.length > 0 ? theme.gold : theme.border }]}
          onPress={() => setOpenFilter(openFilter === 'position' ? null : 'position')}
        >
          <Text style={[styles.filterBtnText, { color: selectedPositions.length > 0 ? theme.gold : theme.textSecondary }]}>
            {selectedPositions.length > 0 ? `${selectedPositions.length} ${t('findPlayer_positionsSelected')}` : t('findPlayer_selectPosition')}
          </Text>
          <Ionicons name={openFilter === 'position' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
        </HapticTouchable>

        {openFilter === 'position' && (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
              <View style={styles.pillsWrap}>
                {POSITION_OPTIONS.map((pos) => {
                  const isSelected = selectedPositions.includes(pos);
                  return (
                    <HapticTouchable
                      key={pos}
                      onPress={() => togglePosition(pos)}
                      style={[styles.positionPill, isSelected && styles.positionPillActive]}
                    >
                      <Text style={[styles.positionPillText, isSelected && styles.positionPillTextActive]}>{pos}</Text>
                    </HapticTouchable>
                  );
                })}
              </View>
              {selectedPositions.length > 0 && (
                <HapticTouchable style={styles.clearPositionsBtn} onPress={() => setSelectedPositions([])}>
                  <Text style={styles.clearText}>{t('findPlayer_clearSelection')}</Text>
                </HapticTouchable>
              )}
            </ScrollView>
          </View>
        )}

        {(selectedCity || selectedPositions.length > 0) && (
          <HapticTouchable style={styles.clearAllBtn} onPress={clearFilters}>
            <Text style={styles.clearText}>{t('findPlayer_clearFilters')}</Text>
          </HapticTouchable>
        )}

        {loading ? (
          <ActivityIndicator color={theme.gold} style={{ marginTop: 24 }} />
        ) : filteredPlayers.length === 0 ? (
          <EmptyState icon="search-outline" title={t('findPlayer_notFound')} subtitle={t('findPlayer_tryDifferentFilters')} />
        ) : (
          filteredPlayers.map((player) => (
            <HapticTouchable
              key={player.user_id}
              style={styles.playerCard}
              onPress={() => {
                const route = playerProfileRoute(player.user_id);
                navigate(route.screen, route.params);
              }}
            >
              <View style={styles.playerHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={24} color={theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{player.full_name || t('match_defaultPlayerName')}</Text>
                  <Text style={styles.playerPosition}>{player.position}</Text>
                  <Text style={styles.playerLocation}>{[player.city, player.district].filter(Boolean).join(' · ')}</Text>
                  {isBlockedUser(player.user_id, blockedIds) && <BlockedTag />}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.playerScore}>{player.score ?? 0}</Text>
                  <Text style={styles.scoreLabel}>{t('findPlayer_score')}</Text>
                </View>
              </View>

              <View style={styles.infoPills}>
                {player.age !== null && (
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillText}>{player.age} {t('findPlayer_age')}</Text>
                  </View>
                )}
                {player.foot && (
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillText}>{player.foot}</Text>
                  </View>
                )}
                {player.club && (
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillText}>{player.club}</Text>
                  </View>
                )}
              </View>
            </HapticTouchable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    count: { color: theme.goldDark, fontSize: 12, marginLeft: 'auto', fontFamily: FontFamily.mono },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    activeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    activeChipText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.text },
    filterBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
    },
    filterBtnText: { fontSize: 14, fontFamily: FontFamily.mono },
    dropdown: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    dropdownRow: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dropdownAllText: { color: theme.goldDark, fontSize: 14, fontFamily: FontFamily.mono },
    dropdownRowText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    checkmark: { color: theme.goldDark, fontWeight: '700' },
    categoryLabel: { color: theme.goldDark, padding: 10, fontFamily: FontFamily.monoMedium, fontSize: 12 },
    pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8, gap: 6 },
    positionPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    positionPillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    positionPillText: { fontSize: 12, fontFamily: FontFamily.monoMedium, color: theme.text },
    positionPillTextActive: { color: Paper.ink },
    clearPositionsBtn: { margin: 12, padding: 10, alignItems: 'center' },
    clearAllBtn: { padding: 8, alignItems: 'center', marginBottom: 8 },
    clearText: { color: theme.error, fontSize: 13, fontFamily: FontFamily.mono },
    playerCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    playerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    playerName: { color: theme.text, fontSize: 16, fontFamily: FontFamily.bodySemiBold },
    playerPosition: { color: theme.goldDark, fontSize: 12, fontFamily: FontFamily.mono, marginTop: 2 },
    playerLocation: { color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono },
    playerScore: { color: theme.goldDark, fontSize: 24, fontFamily: FontFamily.display },
    scoreLabel: { color: theme.textSecondary, fontSize: 10, fontFamily: FontFamily.mono },
    infoPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    infoPill: { backgroundColor: theme.bg, borderRadius: RADIUS, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: theme.border },
    infoPillText: { color: theme.textSecondary, fontSize: 11, fontFamily: FontFamily.mono },
    statsBlock: { gap: 4, marginBottom: 12 },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statLabel: { color: theme.textSecondary, fontSize: 10, fontFamily: FontFamily.mono, width: 28 },
    statTrack: { flex: 1, height: 4, backgroundColor: theme.border },
    statFill: { height: 4, backgroundColor: theme.gold },
    statValue: { color: theme.text, fontSize: 10, fontFamily: FontFamily.monoMedium, width: 24 },
    actionsRow: { flexDirection: 'row', gap: 8 },
    pricedBadge: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    pricedBadgeLabel: { color: theme.goldDark, fontSize: 11, fontFamily: FontFamily.monoMedium },
    pricedBadgeValue: { color: theme.goldDark, fontSize: 13, fontFamily: FontFamily.monoMedium },
    freeBadge: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.success,
    },
    freeBadgeLabel: { color: theme.success, fontSize: 11, fontFamily: FontFamily.monoMedium },
    freeBadgeValue: { color: theme.success, fontSize: 12, fontFamily: FontFamily.mono },
    inviteBtn: {
      flex: 1,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteBtnText: { color: Paper.ink, fontSize: 13, fontFamily: FontFamily.display, letterSpacing: 0.5 },
  });
