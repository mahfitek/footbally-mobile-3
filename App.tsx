import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { supabase } from './lib/supabase';
import { registerForPushNotificationsAsync, setupNotificationHandler } from './lib/notifications';
import { extractTeamIdFromJoinUrl, joinTeam } from './lib/teamJoin';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import ActivitiesScreen from './screens/ActivitiesScreen';
import MessagesScreen from './screens/MessagesScreen';
import PerformanceScreen from './screens/PerformanceScreen';
import PremiumScreen from './screens/PremiumScreen';
import AIAnalysisScreen from './screens/AIAnalysisScreen';
import SettingsScreen from './screens/SettingsScreen';
import ScoutScreen from './screens/ScoutScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MatchScreen from './screens/MatchScreen';
import CreateMatchScreen from './screens/CreateMatchScreen';
import ChatScreen from './screens/ChatScreen';
import TribunScreen from './screens/TribunScreen';
import TeamHomeScreen from './screens/TeamHomeScreen';
import TeamProfileScreen from './screens/TeamProfileScreen';
import TeamSquadScreen from './screens/TeamSquadScreen';
import TeamEditScreen from './screens/TeamEditScreen';
import FindPlayerScreen from './screens/FindPlayerScreen';
import FindOpponentScreen from './screens/FindOpponentScreen';
import SearchScreen from './screens/SearchScreen';
import TeamStatsScreen from './screens/TeamStatsScreen';
import RegionsScreen from './screens/RegionsScreen';
import BadgesScreen from './screens/BadgesScreen';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';

type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'register'
  | 'home'
  | 'activities'
  | 'footbally'
  | 'messages'
  | 'profile'
  | 'premium'
  | 'ai'
  | 'settings'
  | 'scout'
  | 'notifications'
  | 'match'
  | 'createMatch'
  | 'chat'
  | 'tribun'
  | 'teamHome'
  | 'teamProfile'
  | 'teamEdit'
  | 'teamSquad'
  | 'findPlayer'
  | 'findOpponent'
  | 'search'
  | 'teamStats'
  | 'regions'
  | 'badges';

type TabName = 'home' | 'activities' | 'footbally' | 'messages' | 'profile' | 'findPlayer' | 'findOpponent' | 'teamSquad' | 'teamProfile' | 'teamHome';

// Giriş öncesi akış — bu ekranlarda alt navbar ve kenardan geri kaydırma jesti gösterilmez.
// 'chat' ve 'tribun' da buraya dahil: bu ekranların altta sabit bir mesaj
// giriş çubuğu var ve navbar üzerine binmesin diye (mesajlaşma uygulamalarında
// standart olduğu gibi) sohbet açıkken sekme çubuğu gizlenir.
const NO_NAV_SCREENS: Screen[] = ['splash', 'onboarding', 'login', 'register', 'chat', 'tribun'];
const EDGE_BACK_WIDTH = 28;
const EDGE_BACK_THRESHOLD = 80;

// Alttaki navbar'daki sekme kök ekranları. Bunlardan birine geçildiğinde geri
// geçmişi sıfırlanır — böylece kenardan geri kaydırma jesti farklı bir
// sekmenin ekranlarına asla sızmaz; en fazla o sekmenin kök ekranına kadar
// geri gider ve orada durur.
const TAB_ROOT_SCREENS: Screen[] = [
  'home',
  'activities',
  'footbally',
  'messages',
  'profile',
  'teamHome',
  'findPlayer',
  'findOpponent',
  'teamSquad',
  'teamProfile',
];

const USER_TYPE_STORAGE_KEY = '@footbally/userType';

export default function App() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            {fontsLoaded ? <AppContent /> : <SplashScreen onDone={() => {}} />}
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { theme, isDark } = useTheme();
  const { lang } = useLanguage();
  const [screen, setScreen] = useState<Screen>('splash');
  const [history, setHistory] = useState<Screen[]>([]);
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string } | null>(null);
  const [userType, setUserType] = useState<'player' | 'team'>('player');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [settingsFrom, setSettingsFrom] = useState<Screen>('profile');
  const sessionRef = useRef<Session | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const userTypeRef = useRef<'player' | 'team'>('player');

  const navigate = (next: string, params?: any) => {
    if (next === 'chat' && params) {
      setChatTarget({ id: String(params.id ?? ''), name: String(params.name ?? '') });
    }
    if (next === 'settings') {
      setSettingsFrom(screen);
    }
    if (TAB_ROOT_SCREENS.includes(next as Screen)) {
      // Bir sekme köküne geçiş, geri geçmişini sıfırlar — sekmeler arası
      // "geri kaydırma" sızıntısını engeller.
      setHistory([]);
    } else {
      setHistory((prev) => [...prev, screen]);
    }
    setScreen(next as Screen);
  };

  const previousScreen = history[history.length - 1] ?? 'home';

  const goBack = () => {
    if (history.length === 0) return;
    const target = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setScreen(target);
  };

  // Ekranın sol kenarındaki dar şeritten (edgeBackZone) başlayıp sağa doğru
  // yeterince kaydırınca bir önceki ekrana dön (iOS'taki gibi). Şerit dar
  // olduğu için ekranın geri kalanındaki buton/scroll'larla çakışmaz; jest bir
  // kez başladıktan sonra parmak şeridin dışına çıksa bile takip edilmeye
  // devam eder (Gesture Handler'ın standart davranışı).
  const edgeBackGesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-30, 30])
    .onEnd((e) => {
      if (e.translationX > EDGE_BACK_THRESHOLD) {
        runOnJS(goBack)();
      }
    });

  const savePushToken = async (userId: string) => {
    if (!pushTokenRef.current) return;
    await supabase.from('profiles').update({ push_token: pushTokenRef.current }).eq('user_id', userId);
  };

  const handleAuthSuccess = (type: 'player' | 'team') => {
    setUserType(type);
    userTypeRef.current = type;
    AsyncStorage.setItem(USER_TYPE_STORAGE_KEY, type);
    navigate(type === 'team' ? 'teamHome' : 'home');
  };

  useEffect(() => {
    AsyncStorage.getItem(USER_TYPE_STORAGE_KEY).then((stored) => {
      if (stored === 'player' || stored === 'team') {
        setUserType(stored);
        userTypeRef.current = stored;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionRef.current = session;
      setCurrentUserId(session?.user?.id ?? null);
      if (session) savePushToken(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session;
      setCurrentUserId(session?.user?.id ?? null);
      if (session) savePushToken(session.user.id);
      setScreen((current) => {
        if (current === 'splash') return current;
        setHistory([]);
        return session ? (userTypeRef.current === 'team' ? 'teamHome' : 'home') : 'onboarding';
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setupNotificationHandler();

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        pushTokenRef.current = token;
        if (token && sessionRef.current) savePushToken(sessionRef.current.user.id);
      } catch {
        // ignore push registration failures
      }
    })();

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const targetScreen = response.notification.request.content.data?.screen;
      navigate(typeof targetScreen === 'string' ? targetScreen : 'notifications');
    });

    return () => responseListener.remove();
  }, []);

  const handleJoinTeamUrl = async (url: string | null) => {
    if (!url) return;
    const teamId = extractTeamIdFromJoinUrl(url);
    if (!teamId) return;

    const uid = sessionRef.current?.user?.id;
    if (!uid) return;

    const { error, alreadyMember } = await joinTeam(teamId, uid);
    if (error) {
      Alert.alert('Katılım Başarısız', 'Takıma katılırken bir hata oluştu.');
      return;
    }
    Alert.alert(alreadyMember ? 'Zaten Kadrodasın' : 'Takıma Katıldın! 🏆', alreadyMember ? 'Bu takımın kadrosunda zaten yer alıyorsun.' : 'Takım kadrosuna başarıyla eklendin.');
    navigate('home');
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleJoinTeamUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleJoinTeamUrl(url));
    return () => subscription.remove();
  }, []);

  const showNav = !NO_NAV_SCREENS.includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen onDone={() => navigate(sessionRef.current ? 'home' : 'onboarding')} />;
      case 'onboarding':
        return <OnboardingScreen onDone={() => navigate('login')} />;
      case 'login':
        return <LoginScreen onLogin={handleAuthSuccess} onRegister={(type) => { setUserType(type); navigate('register'); }} />;
      case 'register':
        return <RegisterScreen onLogin={handleAuthSuccess} onBack={() => navigate('login')} />;
      case 'activities':
        return <ActivitiesScreen />;
      case 'footbally':
        return <PerformanceScreen navigate={navigate} />;
      case 'messages':
        return <MessagesScreen navigate={navigate} />;
      case 'profile':
        return <ProfileScreen navigate={navigate} userId={currentUserId} />;
      case 'premium':
        return <PremiumScreen navigate={navigate} previousScreen={previousScreen} />;
      case 'ai':
        return <AIAnalysisScreen navigate={navigate} />;
      case 'settings':
        return <SettingsScreen navigate={navigate} userId={currentUserId} fromScreen={settingsFrom} />;
      case 'regions':
        return <RegionsScreen navigate={navigate} userId={currentUserId} />;
      case 'badges':
        return <BadgesScreen navigate={navigate} userId={currentUserId} />;
      case 'scout':
        return <ScoutScreen navigate={navigate} />;
      case 'notifications':
        return <NotificationsScreen navigate={navigate} />;
      case 'match':
        return <MatchScreen navigate={navigate} />;
      case 'createMatch':
        return <CreateMatchScreen navigate={navigate} />;
      case 'chat':
        return (
          <ChatScreen
            navigate={navigate}
            otherUserId={chatTarget?.id ?? ''}
            otherUserName={chatTarget?.name ?? ''}
          />
        );
      case 'tribun':
        return <TribunScreen navigate={navigate} userType={userType} />;
      case 'teamHome':
        return <TeamHomeScreen navigate={navigate} userId={currentUserId} />;
      case 'teamProfile':
        return <TeamProfileScreen navigate={navigate} userId={currentUserId} />;
      case 'teamEdit':
        return <TeamEditScreen navigate={navigate} userId={currentUserId} />;
      case 'teamSquad':
        return <TeamSquadScreen navigate={navigate} userId={currentUserId} />;
      case 'findPlayer':
        return <FindPlayerScreen navigate={navigate} onBack={goBack} />;
      case 'findOpponent':
        return <FindOpponentScreen navigate={navigate} onBack={goBack} />;
      case 'search':
        return <SearchScreen navigate={navigate} userType={userType} />;
      case 'teamStats':
        return <TeamStatsScreen navigate={navigate} userId={currentUserId} />;
      case 'home':
        return userType === 'team' ? (
          <TeamHomeScreen navigate={navigate} userId={currentUserId} />
        ) : (
          <HomeScreen navigate={navigate} userId={currentUserId} />
        );
      default:
        return userType === 'team' ? (
          <TeamHomeScreen navigate={navigate} userId={currentUserId} />
        ) : (
          <HomeScreen navigate={navigate} userId={currentUserId} />
        );
    }
  };

  return (
    <ErrorBoundary theme={theme} lang={lang}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {renderScreen()}
        {showNav && (
          <BottomNav active={screen as TabName} onPress={navigate} userType={userType} />
        )}
        {history.length > 0 && (
          <GestureDetector gesture={edgeBackGesture}>
            <View style={styles.edgeBackZone} />
          </GestureDetector>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Gerçek ekranın en solunda, dar (EDGE_BACK_WIDTH) ve görünmez bir şerit —
  // buradan başlayan bir sürükleme, parmak ekranın ortasına kadar gitse bile
  // Gesture Handler tarafından takip edilmeye devam eder (RNGH'nin standart
  // "edge swipe" tekniği). Böylece tüm ekranı kaplayan bir algılayıcının diğer
  // buton/scroll'larla çakışması engellenmiş olur.
  edgeBackZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_BACK_WIDTH,
  },
});
