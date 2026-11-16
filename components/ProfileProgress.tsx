// Kişisel ilerleme: skor görevleri, görev penceresi ve günlük ipucu. Yalnızca kendi profilinde gösterilir (ProfileScreen).
// Ana sayfadan taşındı; görev durumları sunucudan gelir (get_my_score_breakdown). Skor yenileme ana sayfada kalır.
import { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { profiles } from '../lib/profiles';
import { buildProfileTaskRows, parseScoreBreakdown, ProfileTaskRow } from '../lib/profileTasks';
import HapticTouchable from './HapticTouchable';
import type { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

type Task = {
  id: string;
  title: string;
  desc: string;
  points: number;
  done: boolean;
  screen: string;
  icon: IoniconName;
};

const getDailyTips = (t: (key: TranslationKey) => string) => [
  t('home_tip1'),
  t('home_tip2'),
  t('home_tip3'),
  t('home_tip4'),
  t('home_tip5'),
];

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function ProfileProgress({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [dayIndex] = useState(() => Math.floor(Date.now() / 86400000));
  const dailyTips = getDailyTips(t);
  const dailyTip = dailyTips[dayIndex % dailyTips.length];

  const toHomeTask = (row: ProfileTaskRow): Task => ({
    id: row.id,
    title: t(row.titleKey),
    desc: t(row.descKey),
    points: row.points,
    done: row.done,
    screen: row.screen,
    icon: row.icon as IoniconName,
  });

  // Sunucu görev durumunu veremediyse yerel tahmin yapılmaz; görev listesi gizlenir.
  const loadTasks = async () => {
    const { data: breakdownRaw, error } = await profiles.scoreBreakdown();
    const breakdown = error ? null : parseScoreBreakdown(breakdownRaw);
    setTasks(breakdown ? buildProfileTaskRows(breakdown).map(toHomeTask) : []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void loadTasks();
  }, []);

  const completedPoints = tasks.filter((task) => task.done).reduce((sum, task) => sum + task.points, 0);
  const totalPoints = tasks.reduce((sum, task) => sum + task.points, 0);
  const pendingTasks = tasks.filter((task) => !task.done).slice(0, 3);
  const taskProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  return (
    <>
        {/* Daily Tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>{dailyTip}</Text>
        </View>
        {/* Score completion tasks */}
        {tasks.length > 0 && (
          <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>{t('home_completeScore')}</Text>
              <Text style={{ color: theme.goldDark, fontSize: 13, fontFamily: FontFamily.monoMedium }}>{completedPoints}/{totalPoints} puan</Text>
            </View>

            <View style={{ height: 4, backgroundColor: theme.border, marginBottom: 16 }}>
              <View style={{ height: 4, backgroundColor: theme.gold, width: `${taskProgress}%` }} />
            </View>

            {pendingTasks.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: RADIUS,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.gold,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: theme.goldDark, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>{t('home_allTasksCompleted')}</Text>
              </View>
            ) : (
              pendingTasks.map((task) => (
                <HapticTouchable
                  key={task.id}
                  onPress={() => navigate(task.screen)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: theme.card,
                    borderRadius: RADIUS,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      backgroundColor: theme.card2,
                      borderRadius: RADIUS,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={task.icon} size={17} color={theme.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, marginBottom: 2 }}>{task.title}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{task.desc}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: theme.goldDark, fontSize: 12, fontFamily: FontFamily.monoMedium }}>+{task.points}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 10, fontFamily: FontFamily.body }}>{t('home_point')}</Text>
                  </View>
                </HapticTouchable>
              ))
            )}

            <HapticTouchable
              onPress={() => setShowAllTasks(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 12,
                borderRadius: RADIUS,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ color: theme.goldDark, fontSize: 13, fontFamily: FontFamily.monoMedium }}>{t('home_seeAllTasks')}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.gold} />
            </HapticTouchable>
          </View>
        )}
      <Modal visible={showAllTasks} animationType="slide" onRequestClose={() => setShowAllTasks(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <HapticTouchable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => setShowAllTasks(false)}>
              <Ionicons name="chevron-back" size={16} color={theme.gold} />
              <Text style={{ color: theme.goldDark, fontFamily: FontFamily.mono, fontSize: 13 }}>{t('common_back')}</Text>
            </HapticTouchable>
            <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>{t('home_tasks')}</Text>
            <Text style={{ color: theme.goldDark, fontFamily: FontFamily.monoMedium, fontSize: 13 }}>{completedPoints}/{totalPoints}</Text>
          </View>

          <View style={{ margin: 16, backgroundColor: theme.card2, borderRadius: RADIUS, padding: 16, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontFamily: FontFamily.mono, fontSize: 12 }}>{t('home_overallProgress')}</Text>
              <Text style={{ color: theme.goldDark, fontFamily: FontFamily.monoMedium, fontSize: 12 }}>{Math.round(taskProgress)}%</Text>
            </View>
            <View style={{ height: 4, backgroundColor: theme.border }}>
              <View style={{ height: 4, backgroundColor: theme.gold, width: `${taskProgress}%` }} />
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {tasks.map((task) => (
              <HapticTouchable
                key={task.id}
                onPress={() => {
                  setShowAllTasks(false);
                  if (!task.done) navigate(task.screen);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: theme.card,
                  borderRadius: RADIUS,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: task.done ? theme.success : theme.border,
                  opacity: task.done ? 0.8 : 1,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: theme.card2,
                    borderRadius: RADIUS,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={task.done ? 'checkmark-circle' : task.icon} size={18} color={task.done ? theme.success : theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: task.done ? theme.success : theme.text,
                      fontSize: 14,
                      fontFamily: FontFamily.bodySemiBold,
                      marginBottom: 2,
                      textDecorationLine: task.done ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{task.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: task.done ? theme.success : theme.goldDark, fontSize: 13, fontFamily: FontFamily.monoMedium }}>
                    {task.done ? '✓' : `+${task.points}`}
                  </Text>
                </View>
              </HapticTouchable>
            ))}

            {tasks.length > 0 && completedPoints === totalPoints && (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: RADIUS,
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.gold,
                }}
              >
                <Text style={{ color: theme.goldDark, fontSize: 18, fontFamily: FontFamily.display, marginBottom: 4, letterSpacing: 0.5 }}>{t('home_congrats')}</Text>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', fontFamily: FontFamily.body }}>
                  {t('home_allTasksDone')}
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    tipCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tipText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
  });
