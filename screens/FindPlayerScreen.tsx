import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { sendLocalNotification } from '../lib/notifications';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import { FOOTBALL_POSITIONS } from '../constants/footballPositions';

type FakePlayer = {
  id: string;
  full_name: string;
  position: string;
  age: number;
  city: string;
  district: string;
  foot: string;
  score: number;
  club: string | null;
  isPremium: boolean;
  price: number;
  stats: { hiz: number; pas: number; sut: number; dayaniklilik: number; dribbling: number; savunma: number };
};

const FAKE_PLAYERS: FakePlayer[] = [
  {
    id: '1',
    full_name: 'Ahmet Yılmaz',
    position: 'Santrafor (ST)',
    age: 22,
    city: 'İstanbul',
    district: 'Kadıköy',
    foot: 'Sağ Ayak',
    score: 78,
    club: 'Kadıköy United',
    isPremium: true,
    price: 0,
    stats: { hiz: 82, pas: 71, sut: 85, dayaniklilik: 76, dribbling: 79, savunma: 45 },
  },
  {
    id: '2',
    full_name: 'Mehmet Demir',
    position: 'Kaleci (GK)',
    age: 25,
    city: 'İstanbul',
    district: 'Beşiktaş',
    foot: 'Sağ Ayak',
    score: 82,
    club: 'Beşiktaş Amatör',
    isPremium: true,
    price: 500,
    stats: { hiz: 65, pas: 72, sut: 55, dayaniklilik: 80, dribbling: 58, savunma: 88 },
  },
  {
    id: '3',
    full_name: 'Emre Kaya',
    position: 'Sol Bek (LB)',
    age: 19,
    city: 'İstanbul',
    district: 'Maltepe',
    foot: 'Sol Ayak',
    score: 65,
    club: null,
    isPremium: false,
    price: 0,
    stats: { hiz: 78, pas: 68, sut: 62, dayaniklilik: 74, dribbling: 71, savunma: 75 },
  },
  {
    id: '4',
    full_name: 'Burak Şahin',
    position: 'Ofansif Orta Saha (CAM)',
    age: 21,
    city: 'Ankara',
    district: 'Çankaya',
    foot: 'Her İkisi',
    score: 74,
    club: 'Ankara Gençlik',
    isPremium: false,
    price: 0,
    stats: { hiz: 75, pas: 84, sut: 76, dayaniklilik: 72, dribbling: 82, savunma: 58 },
  },
  {
    id: '5',
    full_name: 'Can Öztürk',
    position: 'Stoper (CB)',
    age: 24,
    city: 'İzmir',
    district: 'Karşıyaka',
    foot: 'Sağ Ayak',
    score: 71,
    club: 'Karşıyaka SK',
    isPremium: true,
    price: 1000,
    stats: { hiz: 68, pas: 65, sut: 58, dayaniklilik: 82, dribbling: 60, savunma: 84 },
  },
  {
    id: '6',
    full_name: 'Enes Arslan',
    position: 'Sağ Kanat (RW)',
    age: 18,
    city: 'İstanbul',
    district: 'Ümraniye',
    foot: 'Sol Ayak',
    score: 68,
    club: null,
    isPremium: false,
    price: 0,
    stats: { hiz: 88, pas: 70, sut: 72, dayaniklilik: 68, dribbling: 85, savunma: 42 },
  },
  {
    id: '7',
    full_name: 'Mert Çelik',
    position: 'Savunma Orta Saha (CDM)',
    age: 26,
    city: 'Bursa',
    district: 'Nilüfer',
    foot: 'Sağ Ayak',
    score: 76,
    club: 'Nilüfer Belediyespor',
    isPremium: true,
    price: 750,
    stats: { hiz: 72, pas: 78, sut: 65, dayaniklilik: 85, dribbling: 68, savunma: 82 },
  },
  {
    id: '8',
    full_name: 'Furkan Güneş',
    position: 'Sol Kanat (LW)',
    age: 20,
    city: 'İstanbul',
    district: 'Fatih',
    foot: 'Sol Ayak',
    score: 69,
    club: null,
    isPremium: false,
    price: 0,
    stats: { hiz: 86, pas: 72, sut: 74, dayaniklilik: 70, dribbling: 83, savunma: 40 },
  },
];

type FilterKey = 'city' | 'district' | 'position' | null;

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function FindPlayerScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [minScore] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const filteredPlayers = FAKE_PLAYERS.filter((p) => {
    if (selectedCity && p.city !== selectedCity) return false;
    if (selectedDistrict && p.district !== selectedDistrict) return false;
    if (selectedPositions.length > 0 && !selectedPositions.includes(p.position)) return false;
    if (p.score < minScore) return false;
    return true;
  });

  const clearFilters = () => {
    setSelectedCity('');
    setSelectedDistrict('');
    setSelectedPositions([]);
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) => (prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]));
  };

  const handleInvite = (player: FakePlayer) => {
    setToast({ message: `${player.full_name} adlı oyuncuya davet gönderildi`, type: 'success' });
    sendLocalNotification('Davet Gönderildi 📨', `${player.full_name} oyuncusuna takım daveti gönderildi.`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('teamHome')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>OYUNCU BUL</Text>
        <Text style={styles.count}>{filteredPlayers.length} oyuncu</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <HapticTouchable
          style={[styles.filterBtn, { borderColor: selectedCity ? theme.gold : theme.border }]}
          onPress={() => setOpenFilter(openFilter === 'city' ? null : 'city')}
        >
          <Text style={[styles.filterBtnText, { color: selectedCity ? theme.gold : theme.textSecondary }]}>
            {selectedCity || 'Şehir Seç'}
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
                <Text style={styles.dropdownAllText}>Tümü (Şehir Seçme)</Text>
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
                {selectedDistrict || 'İlçe Seç (Opsiyonel)'}
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
                    <Text style={styles.dropdownAllText}>Tümü (İlçe Seçme)</Text>
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
            {selectedPositions.length > 0 ? `${selectedPositions.length} pozisyon seçildi` : 'Pozisyon Seç'}
          </Text>
          <Ionicons name={openFilter === 'position' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
        </HapticTouchable>

        {openFilter === 'position' && (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
              {FOOTBALL_POSITIONS.map((cat) => (
                <View key={cat.category}>
                  <Text style={styles.categoryLabel}>{cat.category}</Text>
                  <View style={styles.pillsWrap}>
                    {cat.positions.map((pos) => {
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
                </View>
              ))}
              {selectedPositions.length > 0 && (
                <HapticTouchable style={styles.clearPositionsBtn} onPress={() => setSelectedPositions([])}>
                  <Text style={styles.clearText}>Seçimi Temizle</Text>
                </HapticTouchable>
              )}
            </ScrollView>
          </View>
        )}

        {(selectedCity || selectedPositions.length > 0) && (
          <HapticTouchable style={styles.clearAllBtn} onPress={clearFilters}>
            <Text style={styles.clearText}>Filtreleri Temizle</Text>
          </HapticTouchable>
        )}

        {filteredPlayers.length === 0 ? (
          <EmptyState icon="search-outline" title="Oyuncu bulunamadı" subtitle="Farklı filtreler deneyin" />
        ) : (
          filteredPlayers.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerHeader}>
                <View style={[styles.avatar, { borderColor: player.isPremium ? theme.gold : theme.border }]}>
                  <Ionicons name="person-outline" size={24} color={theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.playerName}>{player.full_name}</Text>
                    {player.isPremium && <Ionicons name="star" size={12} color={theme.gold} />}
                  </View>
                  <Text style={styles.playerPosition}>{player.position}</Text>
                  <Text style={styles.playerLocation}>{player.city} · {player.district}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.playerScore}>{player.score}</Text>
                  <Text style={styles.scoreLabel}>SKOR</Text>
                </View>
              </View>

              <View style={styles.infoPills}>
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillText}>{player.age} yaş</Text>
                </View>
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillText}>{player.foot}</Text>
                </View>
                {player.club && (
                  <View style={styles.infoPill}>
                    <Text style={styles.infoPillText}>{player.club}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsBlock}>
                {[
                  { label: 'HIZ', value: player.stats.hiz },
                  { label: 'PAS', value: player.stats.pas },
                  { label: 'ŞUT', value: player.stats.sut },
                ].map((stat) => (
                  <View key={stat.label} style={styles.statRow}>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <View style={styles.statTrack}>
                      <View style={[styles.statFill, { width: `${stat.value}%` }]} />
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.actionsRow}>
                {player.price > 0 ? (
                  <View style={styles.pricedBadge}>
                    <Text style={styles.pricedBadgeLabel}>Ücretli Oyuncu</Text>
                    <Text style={styles.pricedBadgeValue}>₺{player.price}/ay</Text>
                  </View>
                ) : (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeLabel}>Ücretsiz Oyuncu</Text>
                    <Text style={styles.freeBadgeValue}>Serbest Transfer</Text>
                  </View>
                )}
                <HapticTouchable style={styles.inviteBtn} onPress={() => handleInvite(player)}>
                  <Text style={styles.inviteBtnText}>Davet Et</Text>
                </HapticTouchable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    content: { paddingHorizontal: 16, paddingBottom: 40 },
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
    dropdownAllText: { color: theme.gold, fontSize: 14, fontFamily: FontFamily.mono },
    dropdownRowText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    checkmark: { color: theme.gold, fontWeight: '700' },
    categoryLabel: { color: theme.gold, padding: 10, fontFamily: FontFamily.monoMedium, fontSize: 12 },
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
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    playerName: { color: theme.text, fontSize: 16, fontFamily: FontFamily.bodySemiBold },
    playerPosition: { color: theme.gold, fontSize: 12, fontFamily: FontFamily.mono, marginTop: 2 },
    playerLocation: { color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono },
    playerScore: { color: theme.gold, fontSize: 24, fontFamily: FontFamily.display },
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
    pricedBadgeLabel: { color: theme.gold, fontSize: 11, fontFamily: FontFamily.monoMedium },
    pricedBadgeValue: { color: theme.gold, fontSize: 13, fontFamily: FontFamily.monoMedium },
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
