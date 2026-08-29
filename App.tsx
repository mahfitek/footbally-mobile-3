import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { LanguageProvider } from './context/LanguageContext';
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
  | 'teamStats';

type TabName = 'home' | 'activities' | 'footbally' | 'messages' | 'profile' | 'findPlayer' | 'findOpponent' | 'teamSquad' | 'teamProfile' | 'teamHome';

const PLAYER_TAB_SCREENS: Screen[] = ['home', 'activities', 'footbally', 'messages', 'profile'];
const TEAM_TAB_SCREENS: Screen[] = ['teamHome', 'findPlayer', 'findOpponent', 'teamSquad', 'teamProfile'];

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
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          {fontsLoaded ? <AppContent /> : <SplashScreen onDone={() => {}} />}
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme, isDark } = useTheme();
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
    setHistory((prev) => [...prev, screen]);
    setScreen(next as Screen);
  };

  const previousScreen = history[history.length - 1] ?? 'home';

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
      setScreen((current) =>
        current === 'splash'
          ? current
          : session
          ? userTypeRef.current === 'team'
            ? 'teamHome'
            : 'home'
          : 'onboarding'
      );
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

  const showNav = (userType === 'team' ? TEAM_TAB_SCREENS : PLAYER_TAB_SCREENS).includes(screen);

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
        return <FindPlayerScreen navigate={navigate} />;
      case 'findOpponent':
        return <FindOpponentScreen navigate={navigate} />;
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
    <ErrorBoundary theme={theme}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {renderScreen()}
        {showNav && (
          <BottomNav active={screen as TabName} onPress={navigate} userType={userType} />
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
