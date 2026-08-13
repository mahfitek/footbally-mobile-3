import { Colors } from '../constants/colors';

/** @deprecated Sample player profile, no longer used. Real data comes from the Supabase `profiles` table. */
export const playerData = {
  name: 'Kerem Güneş',
  position: 'Orta Saha (CAM)',
  age: 21,
  height: 178,
  weight: 72,
  city: 'İstanbul, TR',
  foot: 'Sağ Ayak',
  club: 'İstanbul Amatör FC',
  score: 78,
  stats: {
    speed: 89,
    pass: 84,
    shot: 76,
    stamina: 81,
    dribbling: 90,
    defense: 62,
  },
};

export const gridItemsData = [
  { icon: '📈', title: 'Performans', sub: 'İstatistiklerin', screen: 'footbally' },
  { icon: '⏱️', title: 'Maç Analizi', sub: '3 Yeni maç', screen: 'match' },
  { icon: '🎯', title: 'Kariyer', sub: 'Profil %84', screen: 'profile' },
  { icon: '⭐', title: 'Fırsatlar', sub: '7 Davet', screen: 'activities' },
  { icon: '🤖', title: 'AI Analiz', sub: 'Video yükle', screen: 'ai' },
  { icon: '🔍', title: 'Scout Ağı', sub: '12 Online', screen: 'scout' },
];

/** @deprecated Sample matches, no longer used. HomeScreen now starts from an empty list until real match data exists. */
export const matchesData = [
  {
    id: 1,
    icon: '⚽',
    name: 'U21 Amatör Lig',
    date: 'Cumartesi',
    time: '16:00',
    location: 'Ataşehir, İstanbul',
    participants: 22,
    tag: 'Yaklaşan',
    tagColor: Colors.gold,
  },
  {
    id: 2,
    icon: '🏆',
    name: 'Deneme Kampı',
    date: 'Pazar',
    time: '10:00',
    location: 'Kadıköy, İstanbul',
    participants: 18,
    tag: 'Onaylandı',
    tagColor: '#3ddc84',
  },
  {
    id: 3,
    icon: '🥅',
    name: 'Dostluk Maçı',
    date: 'Çarşamba',
    time: '19:30',
    location: 'Beşiktaş, İstanbul',
    participants: 14,
    tag: 'Yaklaşan',
    tagColor: Colors.gold,
  },
  {
    id: 4,
    icon: '🏟️',
    name: 'Halı Saha Turnuvası',
    date: 'Cuma',
    time: '21:00',
    location: 'Maltepe, İstanbul',
    participants: 20,
    tag: 'Davet',
    tagColor: '#a855f7',
  },
  {
    id: 5,
    icon: '🎯',
    name: 'Scout Gözlem Maçı',
    date: 'Pazartesi',
    time: '17:30',
    location: 'Şişli, İstanbul',
    participants: 22,
    tag: 'Onaylandı',
    tagColor: '#3ddc84',
  },
];

/** @deprecated Sample opportunities, no longer used. ActivitiesScreen now fetches the `opportunities` table and falls back to an empty state. */
export const opportunitiesData = [
  {
    id: 1,
    icon: '🦁',
    title: 'Galatasaray Altyapı',
    subtitle: 'U21 kategorisi için altyapı oyuncusu aranıyor',
    badge: 'Profesyonel',
    badgeColor: Colors.gold,
    location: 'İstanbul, TR',
    age: '18-21 yaş',
    deadline: '12 Temmuz',
  },
  {
    id: 2,
    icon: '🏕️',
    title: 'Trabzonspor Deneme',
    subtitle: 'Yetenek avcılığı deneme kampına davetlisin',
    badge: 'Deneme Kampı',
    badgeColor: '#3ddc84',
    location: 'Trabzon, TR',
    age: '16-23 yaş',
    deadline: '20 Temmuz',
  },
  {
    id: 3,
    icon: '🎓',
    title: 'Fenerbahçe Akademi',
    subtitle: 'Akademi bünyesinde gelişim programına katıl',
    badge: 'Akademi',
    badgeColor: '#a855f7',
    location: 'İstanbul, TR',
    age: '15-19 yaş',
    deadline: '5 Ağustos',
  },
  {
    id: 4,
    icon: '🔍',
    title: 'Scout Keşfet Talebi',
    subtitle: 'Bir scout profilini inceledi ve görüşme talep etti',
    badge: 'Scout',
    badgeColor: '#ef4444',
    location: 'Avrupa',
    age: 'Tüm yaşlar',
    deadline: '3 gün içinde',
  },
  {
    id: 5,
    icon: '🦅',
    title: 'Beşiktaş JK',
    subtitle: 'Profesyonel kadro deneme daveti',
    badge: 'Profesyonel',
    badgeColor: Colors.gold,
    location: 'İstanbul, TR',
    age: '19-24 yaş',
    deadline: '15 Ağustos',
  },
  {
    id: 6,
    icon: '🐎',
    title: 'Konyaspor Altyapı',
    subtitle: 'Bölgesel yetenek taraması için aday aranıyor',
    badge: 'Akademi',
    badgeColor: '#a855f7',
    location: 'Konya, TR',
    age: '16-20 yaş',
    deadline: '28 Ağustos',
  },
];

export const activityFiltersData = [
  'Tümü',
  'Profesyonel',
  'Deneme Kampı',
  'Akademi',
  'Scout',
  'Türkiye',
  'Avrupa',
];

/** @deprecated Sample online users, no longer used. There is no real presence tracking yet. */
export const onlineUsersData = [
  { id: 1, emoji: '🦁', name: 'GS Scout' },
  { id: 2, emoji: '⚓', name: 'TS Ekip' },
  { id: 3, emoji: '👤', name: 'Murat Y.' },
  { id: 4, emoji: '🌍', name: 'Hans M.' },
];

/** @deprecated Sample chats, no longer used. MessagesScreen now fetches the `messages` table and falls back to an empty state. */
export const messagesData = [
  {
    id: 1,
    emoji: '🦁',
    name: 'GS Akademi Scout',
    preview: 'Video kayıtlarını inceledik, harika oynuyorsun',
    time: '2 dk',
    unread: 2,
    online: true,
  },
  {
    id: 2,
    emoji: '⚓',
    name: 'Trabzonspor Ekip',
    preview: 'Deneme kampı için seni bekliyoruz',
    time: '15 dk',
    unread: 0,
    online: false,
  },
  {
    id: 3,
    emoji: '👤',
    name: 'Murat Yıldız',
    preview: 'Maçta harika oynadın, tebrikler!',
    time: '1 sa',
    unread: 1,
    online: true,
  },
  {
    id: 4,
    emoji: '🌍',
    name: 'Hans Mueller',
    preview: 'Are you available for a trial in August?',
    time: '3 sa',
    unread: 0,
    online: true,
  },
  {
    id: 5,
    emoji: '🟡',
    name: 'FB Akademi',
    preview: 'Başvurunuz değerlendirme aşamasında',
    time: 'Dün',
    unread: 0,
    online: false,
  },
];

/** @deprecated Sample notifications, no longer used. HomeScreen and NotificationsScreen now start from an empty list until real notifications exist. */
export const notificationsData = [
  {
    id: 1,
    icon: '🏟️',
    msg: 'Beşiktaş Akademi profilini inceledi',
    time: '2 dakika önce',
    unread: true,
  },
  {
    id: 2,
    icon: '🎯',
    msg: 'AI analizin tamamlandı. Skor: 82',
    time: '1 saat önce',
    unread: true,
  },
  {
    id: 3,
    icon: '👤',
    msg: 'Murat Yıldız seni maça davet etti',
    time: '3 saat önce',
    unread: false,
  },
  {
    id: 4,
    icon: '📩',
    msg: 'Trabzonspor Ekip sana mesaj gönderdi',
    time: '5 saat önce',
    unread: false,
  },
  {
    id: 5,
    icon: '⭐',
    msg: 'Profilin 4 yeni scout tarafından görüntülendi',
    time: 'Dün',
    unread: false,
  },
];
