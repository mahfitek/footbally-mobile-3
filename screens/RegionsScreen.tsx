import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

type RegionRow = {
  id: string;
  city: string;
  district: string | null;
  playerCount: number;
  teamCount: number;
};

type FilterKey = 'city' | 'district' | null;

interface Props {
  navigate: (screen: string) => void;
  userId?: string | null;
}

export default function RegionsScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadRegions();
  }, [userId]);

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const loadRegions = async () => {
    setLoading(true);
    const uid = await resolveUserId();
    if (!uid) {
      setRegions([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('followed_regions')
      .select('id, city, district')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (__DEV__ && error) console.log('Bölgeler yüklenemedi:', error);
      setRegions([]);
      setLoading(false);
      return;
    }

    const withCounts = await Promise.all(
      data.map(async (r) => {
        let playerQuery = profiles.publicTable().select('user_id', { count: 'exact', head: true }).eq('city', r.city);
        let teamQuery = supabase.from('teams').select('id', { count: 'exact', head: true }).eq('city', r.city);
        const [{ count: playerCount }, { count: teamCount }] = await Promise.all([playerQuery, teamQuery]);
        return {
          id: r.id,
          city: r.city,
          district: r.district,
          playerCount: playerCount ?? 0,
          teamCount: teamCount ?? 0,
        };
      })
    );

    setRegions(withCounts);
    setLoading(false);
  };

  const addRegion = async () => {
    if (!newCity) return;
    const uid = await resolveUserId();
    if (!uid) {
      Alert.alert(t('regions_error'), t('regions_needLogin'));
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from('followed_regions')
      .insert({ user_id: uid, city: newCity, district: newDistrict || null });
    setAdding(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert(t('regions_alreadyFollowingTitle'), t('regions_alreadyFollowingBody'));
      } else {
        if (__DEV__) console.log('Bölge eklenemedi:', error);
        Alert.alert(t('regions_error'), t('regions_addFailed'));
      }
      return;
    }

    setShowAdd(false);
    setNewCity('');
    setNewDistrict('');
    setOpenFilter(null);
    loadRegions();
  };

  const removeRegion = async (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('followed_regions').delete().eq('id', id);
    if (error && __DEV__) console.log('Bölge kaldırılamadı:', error);
  };

  const selectedCityDistricts = TURKEY_CITIES.find((c) => c.name === newCity)?.districts ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>{t('regions_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('settings')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('regions_title')}</Text>
        <Text style={styles.count}>{regions.length} {t('regions_countSuffix')}</Text>
        <HapticTouchable style={styles.addBtn} onPress={() => setShowAdd((v) => !v)}>
          <Ionicons name={showAdd ? 'close' : 'add'} size={18} color={theme.bg} />
        </HapticTouchable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={theme.gold} />
          <Text style={styles.infoText}>{t('regions_infoText')}</Text>
        </View>

        {showAdd && (
          <View style={styles.addPanel}>
            <HapticTouchable
              style={[styles.filterBtn, { borderColor: newCity ? theme.gold : theme.border }]}
              onPress={() => setOpenFilter(openFilter === 'city' ? null : 'city')}
            >
              <Text style={[styles.filterBtnText, { color: newCity ? theme.gold : theme.textSecondary }]}>
                {newCity || t('createMatch_citySelect')}
              </Text>
              <Ionicons name={openFilter === 'city' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
            </HapticTouchable>

            {openFilter === 'city' && (
              <View style={styles.dropdown}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {TURKEY_CITIES.map((c) => (
                    <HapticTouchable
                      key={c.plate}
                      style={styles.dropdownRow}
                      onPress={() => {
                        setNewCity(c.name);
                        setNewDistrict('');
                        setOpenFilter(null);
                      }}
                    >
                      <Text style={styles.dropdownRowText}>{c.plate}. {c.name}</Text>
                    </HapticTouchable>
                  ))}
                </ScrollView>
              </View>
            )}

            {newCity && (
              <HapticTouchable
                style={[styles.filterBtn, { borderColor: newDistrict ? theme.gold : theme.border, marginTop: 8 }]}
                onPress={() => setOpenFilter(openFilter === 'district' ? null : 'district')}
              >
                <Text style={[styles.filterBtnText, { color: newDistrict ? theme.gold : theme.textSecondary }]}>
                  {newDistrict || t('regions_selectDistrictOptional')}
                </Text>
                <Ionicons name={openFilter === 'district' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
              </HapticTouchable>
            )}

            {openFilter === 'district' && (
              <View style={styles.dropdown}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  <HapticTouchable style={styles.dropdownRow} onPress={() => { setNewDistrict(''); setOpenFilter(null); }}>
                    <Text style={styles.dropdownAllText}>{t('regions_allCityPrefix')} {newCity}</Text>
                  </HapticTouchable>
                  {selectedCityDistricts.map((d) => (
                    <HapticTouchable key={d} style={styles.dropdownRow} onPress={() => { setNewDistrict(d); setOpenFilter(null); }}>
                      <Text style={styles.dropdownRowText}>{d}</Text>
                    </HapticTouchable>
                  ))}
                </ScrollView>
              </View>
            )}

            <HapticTouchable
              style={[styles.addConfirmBtn, (!newCity || adding) && { opacity: 0.6 }]}
              onPress={addRegion}
              disabled={!newCity || adding}
            >
              <Text style={styles.addConfirmBtnText}>{adding ? t('regions_adding') : t('regions_followRegion')}</Text>
            </HapticTouchable>
          </View>
        )}

        {regions.length === 0 && !showAdd ? (
          <EmptyState
            icon="location-outline"
            title={t('regions_emptyTitle')}
            subtitle={t('regions_emptySub')}
            actionLabel={t('regions_addRegion')}
            onAction={() => setShowAdd(true)}
          />
        ) : (
          regions.map((r) => (
            <View key={r.id} style={styles.regionCard}>
              <View style={styles.regionIconWrap}>
                <Ionicons name="location" size={18} color={theme.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionName}>{r.district ? `${r.district} (${r.city})` : r.city}</Text>
                <Text style={styles.regionMeta}>
                  {r.playerCount} {t('regions_registeredPlayersSuffix')} · {r.teamCount} {t('regions_teamsSuffix')}
                </Text>
              </View>
              <HapticTouchable
                style={styles.removeBtn}
                onPress={() => removeRegion(r.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </HapticTouchable>
            </View>
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
    count: { color: theme.gold, fontSize: 12, marginLeft: 'auto', fontFamily: FontFamily.mono },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
    infoBox: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.35),
      borderRadius: RADIUS,
      padding: 14,
      marginBottom: 4,
      alignItems: 'flex-start',
    },
    infoText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
    addPanel: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 4,
      gap: 0,
    },
    filterBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.bg,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
    },
    filterBtnText: { fontSize: 14, fontFamily: FontFamily.mono },
    dropdown: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    dropdownRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    dropdownRowText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    dropdownAllText: { color: theme.gold, fontSize: 14, fontFamily: FontFamily.mono },
    addConfirmBtn: {
      backgroundColor: theme.gold,
      borderRadius: PILL_RADIUS,
      padding: 15,
      alignItems: 'center',
      marginTop: 14,
    },
    addConfirmBtnText: { color: theme.bg, fontFamily: FontFamily.display, fontSize: 13, letterSpacing: 1 },
    regionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    regionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: hexToRgba(theme.gold, 0.14),
      alignItems: 'center',
      justifyContent: 'center',
    },
    regionName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginBottom: 2 },
    regionMeta: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    removeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  });
