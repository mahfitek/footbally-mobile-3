import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { supabase } from './lib/supabase';
import { profiles } from './lib/profiles';
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
import VenuePanelScreen from './screens/VenuePanelScreen';
import VenuesScreen from './screens/VenuesScreen';
import VenueDetailScreen from './screens/VenueDetailScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import UserFollowListScreen from './screens/UserFollowListScreen';
import MerchScreen from './screens/MerchScreen';
import MerchCartScreen from './screens/MerchCartScreen';
import ReportScreen, { ReportTarget } from './screens/ReportScreen';
import BottomNav from './components/BottomNav';
import OfflineBanner from './components/OfflineBanner';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import { parseRecoveryUrl, PASSWORD_RESET_REDIRECT } from './lib/authFlows';
import { useKeyboardOpen } from './lib/useKeyboardOpen';
import { checkAccountAccess } from './lib/accountAccess';
import ErrorBoundary from './components/ErrorBoundary';
import RatingPromptSheet from './components/RatingPromptSheet';
import { shouldShowRatingPrompt, markRatingPromptShown, markRatingPromptResponded } from './lib/appRating';

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
  | 'badges'
  | 'venues'
  | 'venueDetail'
  | 'socialFeed'
  | 'createPost'
  | 'userFollowList'
  | 'merch'
  | 'merchCart'
  | 'report'
  | 'resetPassword';

type TabName = 'home' | 'match' | 'search' | 'messages' | 'profile' | 'teamHome' | 'findOpponent' | 'findPlayer' | 'teamProfile';

// Giriş öncesi akış — bu ekranlarda alt navbar ve kenardan geri kaydırma jesti gösterilmez.
// 'chat' buraya dahil: sohbet ekranında navbar üzerine binmesin diye sekme çubuğu gizlenir.
// 'tribun' (Sahadan) bir navbar sekmesi olduğu için görünür kalır; klavye açıkken
// gizlenmesi AppContent içinde ayrıca ele alınır.
const NO_NAV_SCREENS: Screen[] = ['splash', 'onboarding', 'login', 'register', 'chat', 'report', 'resetPassword'];
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
  'tribun',
  'teamHome',
  'findPlayer',
  'findOpponent',
  'teamSquad',
  'teamProfile',
];

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
  const { lang, t } = useLanguage();
  const [screen, setScreen] = useState<Screen>('splash');
  const [history, setHistory] = useState<Screen[]>([]);
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  // Sosyal Saha: viewing another user's profile (from a post/like/comment/follow
  // list) reuses the same 'profile' screen, just pointed at a different uid —
  // null means "show my own profile" (the tab-bar default).
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  // Same idea as viewedProfileUserId, for viewing another team's profile —
  // null means "show my own team" (the tab-bar default).
  const [viewedTeamOwnerId, setViewedTeamOwnerId] = useState<string | null>(null);
  const [followListTarget, setFollowListTarget] = useState<{ userId: string; type: 'followers' | 'following' } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // Tek hesap türü: oyuncu/takım ayrımı yok. Saha sahipleri (venues) panelden tanımlandığı için ayrı kalır.
  const [userType, setUserType] = useState<'player' | 'venue'>('player');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [settingsFrom, setSettingsFrom] = useState<Screen>('profile');
  const sessionRef = useRef<Session | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  const navigate = (next: string, params?: any) => {
    if (next === 'chat' && params) {
      setChatTarget({ id: String(params.id ?? ''), name: String(params.name ?? '') });
    }
    if (next === 'venueDetail' && params) {
      setSelectedVenueId(String(params.id ?? ''));
    }
    if (next === 'profile') {
      // Bottom nav'daki "Profil" sekmesi params göndermez (kendi profilin);
      // bir gönderi/yorum/takip listesinden gelen navigasyon userId taşır.
      setViewedProfileUserId(params?.userId ? String(params.userId) : null);
    }
    if (next === 'teamProfile') {
      setViewedTeamOwnerId(params?.userId ? String(params.userId) : null);
    }
    if (next === 'userFollowList' && params) {
      setFollowListTarget({
        userId: String(params.userId ?? ''),
        type: params.type === 'following' ? 'following' : 'followers',
      });
    }
    if (next === 'report') {
      setReportTarget(
        params?.id
          ? { type: params.type, id: String(params.id), name: String(params.name ?? '') }
          : null,
      );
    }
    if (next === 'settings') {
      setSettingsFrom(screen);
    }
    // 'profile'/'teamProfile' birer sekme köküdür ama başka bir kullanıcının/
    // takımın profiline (userId param'ıyla) gidilirken bunu tab-switch değil
    // normal bir ileri-geçmiş adımı gibi ele alıyoruz — böylece geri kaydırma
    // jesti geldiği gönderi/takip listesine dönebiliyor.
    const isViewingOtherProfile =
      (next === 'profile' || next === 'teamProfile') && !!params?.userId;
    if (TAB_ROOT_SCREENS.includes(next as Screen) && !isViewingOtherProfile) {
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
    await profiles.updateOwn(userId, { push_token: pushTokenRef.current });
  };

  // Saha sahibi hesaplari kendi kaydiyla degil, panelimizden manuel olusturuluyor
  // (anlasmali/kuratoryel ortaklik). Bu yuzden Login/Register'daki oyuncu/takim
  // rol secimine bagli olmadan, giris yapan kullanicinin bir saha sahibi olup
  // olmadigi venues tablosundan dogrudan kontrol edilir.
  // Her girişte yeniden hesaplanır; saha sahibi olmayan bir hesap önceki oturumdan kalan 'venue' durumunu devralmaz.
  const checkVenueOwnership = async (uid: string): Promise<boolean> => {
    const { data } = await supabase.from('venues').select('id').eq('owner_user_id', uid).maybeSingle();
    const isVenue = !!data;
    setUserType(isVenue ? 'venue' : 'player');
    return isVenue;
  };

  // Giriş/kayıt sonrası çağrılır. Login ekranı ban kontrolünü bu çağrıdan önce yapar ve yasaklıysa çağırmaz.
  const handleAuthSuccess = async () => {
    const uid = sessionRef.current?.user?.id;
    if (uid) {
      savePushToken(uid);
      await checkVenueOwnership(uid);
    }
    navigate('home');
  };

  useEffect(() => {
    // Açılıştaki kayıtlı oturumda ban kontrolü: yasaklıysa oturum kapatılır, doğrulanamazsa (örn. çevrimdışı) oturum korunur.
    const restoreStoredSession = async (session: Session) => {
      const access = await checkAccountAccess(session.user.id);
      if (access.verified && !access.allowed) {
        sessionRef.current = null;
        setCurrentUserId(null);
        setHistory([]);
        setScreen('onboarding');
        Alert.alert('Giriş engellendi', access.message);
        void supabase.auth.signOut();
        return;
      }
      await routeForSession(session);
    };

    const routeForSession = async (session: Session | null) => {
      if (session) {
        savePushToken(session.user.id);
        await checkVenueOwnership(session.user.id);
      }
      setScreen((current) => {
        // Kurtarma (şifre sıfırlama) akışında oturum açılsa da kullanıcı yeni şifre ekranında kalır.
        if (current === 'splash' || current === 'resetPassword') return current;
        setHistory([]);
        return session ? 'home' : 'onboarding';
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      sessionRef.current = session;
      setCurrentUserId(session?.user?.id ?? null);
      // Girişte (SIGNED_IN) ekran geçişi ve push kaydı handleAuthSuccess içinde, ban kontrolünden sonra yapılır.
      if (event === 'SIGNED_IN') return;
      // Ban kontrolü ağ çağrısı yapar; auth callback'i (oturum kilidi altında) beklemesin diye callback dışında çalışır.
      if (event === 'INITIAL_SESSION' && session) {
        setTimeout(() => void restoreStoredSession(session), 0);
        return;
      }
      void routeForSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const timer = setTimeout(async () => {
      if (await shouldShowRatingPrompt()) {
        await markRatingPromptShown();
        setShowRatingPrompt(true);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentUserId]);

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
    Linking.getInitialURL().then((url) => handleJoinTeamUrl(url ?? null));
    const subscription = Linking.addEventListener('url', ({ url }) => handleJoinTeamUrl(url));
    return () => subscription.remove();
  }, []);

  // Şifre sıfırlama bağlantısı: tokenlar bağlantıdan alınır, oturum kurulur, yeni şifre ekranı açılır.
  // Bağlantı geçersizse de ekran açılır ve geçersiz olduğu söylenir (sessiz başarısızlık yok).
  const [recoverySession, setRecoverySession] = useState(false);
  // Splash bu bağlantıdan önce bitmiş olabilir ya da sonra; her iki durumda da kurtarma ekranına gidilmeli.
  const recoveryRef = useRef(false);
  const handleRecoveryUrl = async (url: string | null) => {
    if (!url || !url.startsWith(PASSWORD_RESET_REDIRECT)) return;
    const tokens = parseRecoveryUrl(url);
    let ok = false;
    if (tokens) {
      const { error } = await supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
      ok = !error;
    }
    recoveryRef.current = true;
    setRecoverySession(ok);
    setHistory([]);
    setScreen('resetPassword');
  };
  useEffect(() => {
    Linking.getInitialURL().then((url) => handleRecoveryUrl(url ?? null));
    const subscription = Linking.addEventListener('url', ({ url }) => handleRecoveryUrl(url));
    return () => subscription.remove();
  }, []);

  const keyboardOpen = useKeyboardOpen();
  // Sahadan'da giriş alanı klavyenin altında kalmasın diye klavye açıkken navbar gizlenir.
  const showNav =
    !NO_NAV_SCREENS.includes(screen) &&
    userType !== 'venue' &&
    !((screen === 'tribun' || screen === 'merchCart') && keyboardOpen);

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen onDone={() => navigate(recoveryRef.current ? 'resetPassword' : sessionRef.current ? 'home' : 'onboarding')} />;
      case 'onboarding':
        return <OnboardingScreen onDone={() => navigate('login')} />;
      case 'login':
        return <LoginScreen onLogin={handleAuthSuccess} onRegister={() => navigate('register')} />;
      case 'register':
        return <RegisterScreen onLogin={handleAuthSuccess} onBack={() => navigate('login')} />;
      case 'activities':
        return <ActivitiesScreen />;
      case 'footbally':
        return <PerformanceScreen navigate={navigate} />;
      case 'messages':
        return <MessagesScreen navigate={navigate} />;
      case 'profile':
        return (
          <ProfileScreen
            navigate={navigate}
            userId={viewedProfileUserId ?? currentUserId}
            currentUserId={currentUserId}
            onBack={viewedProfileUserId ? goBack : undefined}
          />
        );
      case 'socialFeed':
        return <SocialFeedScreen navigate={navigate} userId={currentUserId} />;
      case 'createPost':
        return <CreatePostScreen navigate={navigate} userId={currentUserId} />;
      case 'userFollowList':
        return (
          <UserFollowListScreen
            navigate={navigate}
            onBack={goBack}
            userId={followListTarget?.userId ?? ''}
            type={followListTarget?.type ?? 'followers'}
            currentUserId={currentUserId}
          />
        );
      case 'premium':
        return <PremiumScreen navigate={navigate} previousScreen={previousScreen} />;
      case 'merch':
        return <MerchScreen onBack={goBack} onOpenCart={() => navigate('merchCart')} />;
      case 'merchCart':
        return <MerchCartScreen onBack={goBack} />;
      case 'report':
        return <ReportScreen onBack={goBack} target={reportTarget} />;
      case 'resetPassword':
        return (
          <ResetPasswordScreen
            hasRecoverySession={recoverySession}
            onDone={() => {
              recoveryRef.current = false;
              setRecoverySession(false);
              navigate('login');
            }}
          />
        );
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
        return <TribunScreen navigate={navigate} />;
      case 'teamHome':
        return <TeamHomeScreen navigate={navigate} userId={currentUserId} />;
      case 'teamProfile':
        return (
          <TeamProfileScreen
            navigate={navigate}
            userId={viewedTeamOwnerId ?? currentUserId}
            currentUserId={currentUserId}
            onBack={viewedTeamOwnerId ? goBack : undefined}
          />
        );
      case 'teamEdit':
        return <TeamEditScreen navigate={navigate} userId={currentUserId} />;
      case 'teamSquad':
        return <TeamSquadScreen navigate={navigate} userId={currentUserId} />;
      case 'findPlayer':
        return <FindPlayerScreen navigate={navigate} onBack={goBack} />;
      case 'findOpponent':
        return <FindOpponentScreen navigate={navigate} onBack={goBack} />;
      case 'search':
        return <SearchScreen navigate={navigate} />;
      case 'teamStats':
        return <TeamStatsScreen navigate={navigate} userId={currentUserId} />;
      case 'home':
        return userType === 'venue' ? (
          <VenuePanelScreen navigate={navigate} userId={currentUserId} />
        ) : (
          <HomeScreen navigate={navigate} userId={currentUserId} />
        );
      case 'venues':
        return <VenuesScreen navigate={navigate} />;
      case 'venueDetail':
        return <VenueDetailScreen navigate={navigate} venueId={selectedVenueId} />;
      default:
        return <HomeScreen navigate={navigate} userId={currentUserId} />;
    }
  };

  return (
    <ErrorBoundary theme={theme} lang={lang}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {renderScreen()}
        <OfflineBanner />
        {showNav && (
          <BottomNav
            active={
              (screen === 'profile' && viewedProfileUserId) || (screen === 'teamProfile' && viewedTeamOwnerId)
                ? null
                : (screen as TabName)
            }
            onPress={navigate}
          />
        )}
        {history.length > 0 && (
          <GestureDetector gesture={edgeBackGesture}>
            <View style={styles.edgeBackZone} />
          </GestureDetector>
        )}
        <RatingPromptSheet
          visible={showRatingPrompt}
          onClose={() => setShowRatingPrompt(false)}
          onAnswered={() => {
            markRatingPromptResponded();
          }}
          theme={theme}
          t={t}
          userId={currentUserId}
        />
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
