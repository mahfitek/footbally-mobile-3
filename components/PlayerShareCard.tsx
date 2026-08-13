import { View, Text, StyleSheet, Image } from 'react-native';
import { FontFamily } from '../constants/fonts';

interface PlayerCardStats {
  hiz: number;
  pas: number;
  sut: number;
  dayaniklilik: number;
  dribbling: number;
  savunma: number;
}

interface PlayerCardProps {
  name: string;
  position: string;
  score: number;
  city: string;
  club: string;
  avatarUrl: string | null;
  stats: PlayerCardStats;
  isPremium: boolean;
}

export default function PlayerShareCard({
  name,
  position,
  score,
  club,
  avatarUrl,
  stats,
  isPremium,
}: PlayerCardProps) {
  const scoreColor = score >= 80 ? '#FFD700' : score >= 65 ? '#C0C0C0' : '#CD7F32';

  return (
    <View style={styles.card}>
      <View style={styles.cardBg}>
        <View style={styles.shimmerTop} />

        <View style={styles.topLeft}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
          <Text style={styles.positionShort}>{getShortPosition(position)}</Text>
          <View style={styles.flags}>
            <Text style={styles.flagEmoji}>🇹🇷</Text>
            <Text style={styles.clubInitial}>{club ? club[0] : '?'}</Text>
          </View>
        </View>

        <View style={styles.avatarSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.playerImage} />
          ) : (
            <View style={styles.playerImagePlaceholder}>
              <Text style={{ fontSize: 60 }}>⚽</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <Text style={styles.playerName} numberOfLines={1}>
          {name ? name.toUpperCase() : 'OYUNCU'}
        </Text>

        <View style={styles.statsRow}>
          <StatItem label="HIZ" value={stats.hiz} color={scoreColor} />
          <StatItem label="PAS" value={stats.pas} color={scoreColor} />
          <StatItem label="ŞUT" value={stats.sut} color={scoreColor} />
          <StatItem label="DAY" value={stats.dayaniklilik} color={scoreColor} />
          <StatItem label="DRB" value={stats.dribbling} color={scoreColor} />
          <StatItem label="SAV" value={stats.savunma} color={scoreColor} />
        </View>

        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>FOOTBALLY</Text>
          {isPremium && <Text style={styles.premiumBadge}>⭐ PRO</Text>}
        </View>

        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 18, fontFamily: FontFamily.monoMedium }}>{value || 50}</Text>
      <Text style={{ color: '#888', fontSize: 9, fontFamily: FontFamily.mono, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

function getShortPosition(pos: string): string {
  if (!pos) return 'CM';
  if (pos.includes('GK') || pos.includes('Kaleci')) return 'GK';
  if (pos.includes('CB') || pos.includes('Stoper')) return 'CB';
  if (pos.includes('RB') || pos.includes('Sağ Bek')) return 'RB';
  if (pos.includes('LB') || pos.includes('Sol Bek')) return 'LB';
  if (pos.includes('CDM') || pos.includes('Savunma Orta')) return 'CDM';
  if (pos.includes('CAM') || pos.includes('Ofansif')) return 'CAM';
  if (pos.includes('CM') || pos.includes('Orta Saha')) return 'CM';
  if (pos.includes('RW') || pos.includes('Sağ Kanat')) return 'RW';
  if (pos.includes('LW') || pos.includes('Sol Kanat')) return 'LW';
  if (pos.includes('ST') || pos.includes('Santrafor')) return 'ST';
  if (pos.includes('RM') || pos.includes('Sağ Açık')) return 'RM';
  if (pos.includes('LM') || pos.includes('Sol Açık')) return 'LM';
  return pos.split(' ')[0].substring(0, 3).toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFB347',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  cardBg: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFB347',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0E1524',
  },
  shimmerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FFB347',
    opacity: 0.8,
  },
  topLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  scoreNum: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    lineHeight: 44,
  },
  positionShort: {
    fontFamily: FontFamily.mono,
    color: '#FFB347',
    fontSize: 14,
    letterSpacing: 1,
  },
  flags: {
    marginTop: 4,
    alignItems: 'center',
    gap: 4,
  },
  flagEmoji: {
    fontSize: 16,
  },
  clubInitial: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarSection: {
    marginTop: 16,
    width: 160,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerImage: {
    width: 160,
    height: 180,
    resizeMode: 'cover',
  },
  playerImagePlaceholder: {
    width: 160,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,179,71,0.05)',
    borderRadius: 12,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#FFB347',
    opacity: 0.4,
    marginVertical: 8,
  },
  playerName: {
    fontFamily: FontFamily.display,
    color: '#FFFFFF',
    fontSize: 26,
    letterSpacing: 3,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  watermark: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    alignItems: 'flex-end',
  },
  watermarkText: {
    fontFamily: FontFamily.display,
    color: 'rgba(255,179,71,0.4)',
    fontSize: 12,
    letterSpacing: 2,
  },
  premiumBadge: {
    fontFamily: FontFamily.mono,
    color: '#FFB347',
    fontSize: 9,
  },
  cornerTL: { position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: 'rgba(255,179,71,0.5)', borderTopLeftRadius: 4 },
  cornerTR: { position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: 'rgba(255,179,71,0.5)', borderTopRightRadius: 4 },
  cornerBL: { position: 'absolute', bottom: 8, left: 8, width: 12, height: 12, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: 'rgba(255,179,71,0.5)', borderBottomLeftRadius: 4 },
  cornerBR: { position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: 'rgba(255,179,71,0.5)', borderBottomRightRadius: 4 },
});
