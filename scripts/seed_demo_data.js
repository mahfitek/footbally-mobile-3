// Tanıtım/demo için Supabase'e gerçekçi sahte veri yükler.
// Kullanım: node scripts/seed_demo_data.js
// Gereken: proje kökünde .env.local içinde SUPABASE_SERVICE_ROLE_KEY=... satırı.
// Oluşturulan tüm kimlikler scripts/demo_seed_manifest.json dosyasına kaydedilir
// — temizlik (cleanup_demo_data.js) bu dosyayı okuyarak neyi sileceğini bilir.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env.local');
const MANIFEST_PATH = path.join(__dirname, 'demo_seed_manifest.json');
const SUPABASE_URL = 'https://mohsosllyfgevvvpbkkn.supabase.co';

function loadServiceKey() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env.local bulunamadı: ${ENV_PATH}\nİçine SUPABASE_SERVICE_ROLE_KEY=... satırını ekle.`);
  }
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m);
  if (!match) throw new Error('.env.local içinde SUPABASE_SERVICE_ROLE_KEY bulunamadı.');
  return match[1].trim();
}

const supabase = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NAMES = ['Ali Kaya', 'Burak Demir', 'Cem Yıldız', 'Deniz Arslan', 'Emirhan Koç', 'Furkan Şen', 'Gökhan Aydın', 'Hakan Çelik', 'İbrahim Doğan', 'Kerem Aksoy', 'Levent Yılmaz', 'Onur Polat', 'Selim Aktaş', 'Tolga Er', 'Yusuf Kaplan'];
const POSITIONS = ['Kaleci', 'Defans', 'Orta Saha', 'Kanat', 'Forvet'];
const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana'];
const DISTRICTS = ['Kadıköy', 'Çankaya', 'Bornova', 'Nilüfer', 'Muratpaşa', 'Seyhan'];
const SCORES = [42, 55, 63, 71, 48, 77, 58, 66, 39, 82, 60, 73, 52, 68, 45];
const TEAM_NAMES = ['Yıldızspor', 'Demir Kale', 'Sahil Gençlik', 'Zafer Birlik', 'Metropol FK', 'Boztepe FK'];
const LEAGUES = ['Süper Amatör', 'Amatör', 'Bölgesel'];
const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2'];
const STYLES = ['Hızlı Geçiş', 'Fiziksel', 'Teknik'];
const NEEDED = ['Kaleci', 'Defans', 'Forvet'];

const manifest = {
  heroes: {},
  phantomPlayers: [],
  phantomTeamOwners: [],
  teamIds: [],
  matchIds: [],
  opportunityIds: [],
  conversationIds: [],
  messageIds: [],
  notificationIds: [],
  connectionIds: [],
  tribunMessageIds: [],
  venueIds: [],
};

async function createAuthUser(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) hata: ${error.message}`);
  return data.user.id;
}

async function insertOrThrow(table, rows) {
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`insert(${table}) hata: ${error.message}`);
  return data;
}

async function main() {
  console.log('1/11 Hero hesaplar oluşturuluyor...');
  manifest.heroes.oyuncu1 = await createAuthUser('demo.oyuncu1@footbally.app', 'Demo2026!Oyuncu1');
  manifest.heroes.oyuncu2 = await createAuthUser('demo.oyuncu2@footbally.app', 'Demo2026!Oyuncu2');
  manifest.heroes.takim = await createAuthUser('demo.takim@footbally.app', 'Demo2026!Takim');
  manifest.heroes.saha = await createAuthUser('demo.saha@footbally.app', 'Demo2026!Saha');
  const { oyuncu1, oyuncu2, takim, saha } = manifest.heroes;

  console.log('2/11 Figüran oyuncular oluşturuluyor (15 adet)...');
  for (let i = 0; i < 15; i++) {
    const uid = await createAuthUser(`demo.figuran${i + 1}@footbally.demo`, 'Fig!2026uran');
    manifest.phantomPlayers.push(uid);
    await insertOrThrow('profiles', [{
      user_id: uid,
      full_name: NAMES[i],
      position: POSITIONS[i % 5],
      city: CITIES[i % 6],
      district: DISTRICTS[i % 6],
      score: SCORES[i],
    }]);
  }
  const p = manifest.phantomPlayers;

  console.log('3/11 Figüran takım sahipleri + takımlar oluşturuluyor (6 adet)...');
  for (let i = 0; i < 6; i++) {
    const uid = await createAuthUser(`demo.takimsahibi${i + 1}@footbally.demo`, 'Fig!2026uran');
    manifest.phantomTeamOwners.push(uid);
    const rows = await insertOrThrow('teams', [{
      owner_id: uid,
      name: TEAM_NAMES[i],
      city: CITIES[i % 6],
      district: DISTRICTS[i % 6],
      league: LEAGUES[i % 3],
      formation: FORMATIONS[i % 3],
      playing_style: [STYLES[i % 3]],
      match_days: ['Cumartesi', 'Pazar'],
      needed_positions: [NEEDED[i % 3]],
      founded_year: 2015 + i,
      ground_name: `${TEAM_NAMES[i]} Tesisleri`,
      description: 'Her seviyeden oyuncuya açık, rekabetçi bir kadro kuruyoruz.',
    }]);
    manifest.teamIds.push(rows[0].id);
  }
  const to = manifest.phantomTeamOwners;

  console.log('4/11 Hero profil/takım bilgileri yazılıyor...');
  await insertOrThrow('profiles', [
    { user_id: oyuncu1, full_name: 'Mert Aydın', position: 'Forvet', city: 'İstanbul', district: 'Kadıköy', score: 88, age: 24, height: 181, weight: 76, foot: 'Sağ Ayak', club: 'Amatör Ligi' },
    { user_id: oyuncu2, full_name: 'Emre Şahin', position: 'Orta Saha', city: 'İstanbul', district: 'Beşiktaş', score: 65, age: 27, height: 176, weight: 71, foot: 'Sol Ayak', club: 'Amatör Ligi' },
    { user_id: takim, full_name: 'Kartallar FK Yönetimi' },
    { user_id: saha, full_name: 'Halı Saha Yönetimi' },
  ]);
  const heroTeam = await insertOrThrow('teams', [{
    owner_id: takim,
    name: 'Kartallar FK',
    city: 'İstanbul',
    district: 'Kadıköy',
    league: 'Süper Amatör',
    formation: '4-3-3',
    playing_style: ['Hızlı Geçiş', 'Hücum Ağırlıklı'],
    match_days: ['Cumartesi', 'Pazar'],
    needed_positions: ['Kaleci', 'Stoper'],
    founded_year: 2018,
    ground_name: 'Kartallar Tesisleri',
    description: 'Her hafta düzenli antrenman yapan, rekabetçi bir amatör takımız. Yeni oyuncu arıyoruz.',
    whatsapp_link: 'https://chat.whatsapp.com/ornekkartallarfk',
    contact_number: '0532 000 00 00',
  }]);
  manifest.teamIds.push(heroTeam[0].id);

  console.log('5/11 Maçlar oluşturuluyor...');
  const today = new Date();
  const dayStr = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const matches = await insertOrThrow('matches', [
    { title: 'Hafta Sonu Dostluk Maçı', date: dayStr(2), time: '20:00', location: 'Kadıköy Halı Saha', city: 'İstanbul, Kadıköy', required_players: 14, type: '7v7', category: 'Eğlence', creator_id: oyuncu1 },
    { title: 'Rekabetçi 6v6 Turnuva Provası', date: dayStr(3), time: '21:00', location: 'Zafer Spor Kompleksi', city: 'İstanbul, Beşiktaş', required_players: 12, type: '6v6', category: 'Rekabetçi', creator_id: oyuncu2 },
    { title: 'Akşam Antrenman Maçı', date: dayStr(1), time: '19:00', location: 'Sahil Halı Saha', city: 'İstanbul, Maltepe', required_players: 10, type: '5v5', category: 'Antrenman', creator_id: takim },
    { title: 'Ankara Amatör Buluşması', date: dayStr(4), time: '18:30', location: 'Çankaya Halı Saha', city: 'Ankara, Çankaya', required_players: 14, type: '7v7', category: 'Eğlence', creator_id: p[1] },
    { title: 'İzmir Sahil Maçı', date: dayStr(5), time: '20:30', location: 'Bornova Spor Tesisi', city: 'İzmir, Bornova', required_players: 12, type: '6v6', category: 'Rekabetçi', creator_id: p[4] },
    { title: 'Bursa Gece Maçı', date: dayStr(2), time: '22:00', location: 'Nilüfer Halı Saha', city: 'Bursa, Nilüfer', required_players: 10, type: '5v5', category: 'Eğlence', creator_id: p[7] },
    { title: 'Antalya Turnuva Hazırlık', date: dayStr(6), time: '17:00', location: 'Muratpaşa Spor Kompleksi', city: 'Antalya, Muratpaşa', required_players: 14, type: '7v7', category: 'Rekabetçi', creator_id: to[0] },
    { title: 'Adana Amatör Ligi Provası', date: dayStr(3), time: '19:30', location: 'Seyhan Halı Saha', city: 'Adana, Seyhan', required_players: 12, type: '6v6', category: 'Antrenman', creator_id: to[2] },
  ]);
  manifest.matchIds = matches.map((m) => m.id);

  console.log('6/11 İlanlar oluşturuluyor...');
  const opportunities = await insertOrThrow('opportunities', [
    { title: 'İstanbul Altyapı Forvet Arıyor', subtitle: 'Amatör kulüp, 20-26 yaş forvet pozisyonu için deneme daveti veriyor', location: 'İstanbul, Kadıköy', badge: 'Yeni' },
    { title: 'Ankara Kaleci Denemesi', subtitle: 'Bölgesel amatör lig takımı kaleci arıyor', location: 'Ankara, Çankaya', badge: 'Acil' },
    { title: 'İzmir Genç Yetenek Taraması', subtitle: '18 yaş altı oyuncular için scout gözlem günü', location: 'İzmir, Bornova', badge: 'Yeni' },
    { title: 'Bursa Orta Saha Transferi', subtitle: 'Süper Amatör ekip, deneyimli orta saha oyuncusu arıyor', location: 'Bursa, Nilüfer' },
    { title: 'Antalya Kış Kampı Davetiyesi', subtitle: 'Kış hazırlık kampına katılacak oyuncular aranıyor', location: 'Antalya, Muratpaşa', badge: 'Sınırlı Kontenjan' },
    { title: 'Adana Stoper Arayışı', subtitle: 'Amatör lig ekibi savunma hattını güçlendirmek istiyor', location: 'Adana, Seyhan' },
  ]);
  manifest.opportunityIds = opportunities.map((o) => o.id);

  console.log('7/11 Sohbetler + mesajlar oluşturuluyor...');
  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  async function findOrCreateConversation(a, b) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_a.eq.${a},participant_b.eq.${b}),and(participant_a.eq.${b},participant_b.eq.${a})`)
      .maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_a: a, participant_b: b })
      .select('id')
      .single();
    if (error) throw new Error(`conversations insert hata: ${error.message}`);
    return data.id;
  }

  const convOyuncu1Oyuncu2 = await findOrCreateConversation(oyuncu1, oyuncu2);
  const convPhantomOyuncu1 = await findOrCreateConversation(p[3], oyuncu1);
  const convTakimOyuncu1 = await findOrCreateConversation(takim, oyuncu1);
  manifest.conversationIds = [convOyuncu1Oyuncu2, convPhantomOyuncu1, convTakimOyuncu1];

  const messages = await insertOrThrow('messages', [
    { conversation_id: convOyuncu1Oyuncu2, sender_user_id: oyuncu1, body: 'Selam Emre, hafta sonu ki maça geliyor musun?', created_at: hoursAgo(48), read: true },
    { conversation_id: convOyuncu1Oyuncu2, sender_user_id: oyuncu2, body: 'Selam Mert, geliyorum. Saat kaçta buluşuyoruz?', created_at: hoursAgo(47.9), read: true },
    { conversation_id: convOyuncu1Oyuncu2, sender_user_id: oyuncu1, body: 'Saat 20:00\'de Kadıköy\'deki sahada.', created_at: hoursAgo(47.8), read: true },
    { conversation_id: convOyuncu1Oyuncu2, sender_user_id: oyuncu2, body: 'Tamamdır, forma rengini de söyle.', created_at: hoursAgo(24), read: true },
    { conversation_id: convOyuncu1Oyuncu2, sender_user_id: oyuncu1, body: 'Beyaz forma giyelim, rakip lacivert giyecek.', created_at: hoursAgo(23.9), read: false },
    { conversation_id: convPhantomOyuncu1, sender_user_id: p[3], body: 'Merhaba, profilini gördüm çok iyi görünüyorsun. Takımımıza katılır mısın?', created_at: hoursAgo(6), read: false },
    { conversation_id: convPhantomOyuncu1, sender_user_id: p[3], body: 'Cumartesi günü bir deneme antrenmanımız var, gelebilir misin?', created_at: hoursAgo(5), read: false },
    { conversation_id: convTakimOyuncu1, sender_user_id: takim, body: 'Kartallar FK olarak forvet pozisyonu için seninle görüşmek isteriz.', created_at: hoursAgo(3), read: false },
  ]);
  manifest.messageIds = messages.map((m) => m.id);

  await supabase.from('conversations').update({ last_message_at: hoursAgo(23.9) }).eq('id', convOyuncu1Oyuncu2);
  await supabase.from('conversations').update({ last_message_at: hoursAgo(5) }).eq('id', convPhantomOyuncu1);
  await supabase.from('conversations').update({ last_message_at: hoursAgo(3) }).eq('id', convTakimOyuncu1);

  console.log('8/11 Bildirimler oluşturuluyor...');
  const notifications = await insertOrThrow('notifications', [
    { user_id: oyuncu1, title: 'Yeni Bağlantı', body: 'Burak Demir sana bağlantı isteği gönderdi.', screen: 'notifications', read: false, created_at: hoursAgo(1) },
    { user_id: oyuncu1, title: 'Rozet Kazandın', body: 'Yeni bir rozet kazandın: İyi Seviye!', screen: 'badges', read: false, created_at: hoursAgo(3) },
    { user_id: oyuncu1, title: 'Maç Güncellemesi', body: 'Hafta Sonu Dostluk Maçı\'na 3 yeni katılımcı eklendi.', screen: 'match', read: true, created_at: hoursAgo(24) },
    { user_id: oyuncu1, title: 'Yeni Mesaj', body: 'Kartallar FK sana mesaj gönderdi.', screen: 'chat', read: false, created_at: hoursAgo(3) },
  ]);
  manifest.notificationIds = notifications.map((n) => n.id);

  console.log('9/11 Bağlantılar oluşturuluyor...');
  const connections = await insertOrThrow('connections', [
    { requester_id: p[1], target_id: oyuncu1, status: 'pending' },
    { requester_id: p[5], target_id: oyuncu1, status: 'pending' },
    { requester_id: p[9], target_id: oyuncu1, status: 'accepted' },
    { requester_id: oyuncu1, target_id: oyuncu2, status: 'accepted' },
  ]);
  manifest.connectionIds = connections.map((c) => c.id);

  console.log('10/11 Tribün mesajları oluşturuluyor...');
  const minsAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
  const tribun = await insertOrThrow('tribun_messages', [
    { sender_id: p[2], content: 'Bu hafta sonu İstanbul\'da maç arayan var mı?', created_at: minsAgo(180) },
    { sender_id: oyuncu1, content: 'Kadıköy\'de cumartesi 20:00\'de yer var, katılmak isteyen yazsın.', created_at: minsAgo(170) },
    { sender_id: p[6], content: 'Ben varım, hangi saha?', created_at: minsAgo(160) },
    { sender_id: oyuncu1, content: 'Yıldız Halı Saha, Bağdat Caddesi üzerinde.', created_at: minsAgo(155) },
    { sender_id: to[1], content: 'Yıldızspor olarak rakip arıyoruz, 7v7 uygun olan var mı?', created_at: minsAgo(120) },
    { sender_id: oyuncu2, content: 'Biz Kartallar FK olarak ilgileniriz, DM atıyorum.', created_at: minsAgo(110) },
    { sender_id: p[10], content: 'Ankara\'da halı saha önerisi olan var mı, yeni taşındım.', created_at: minsAgo(60) },
    { sender_id: takim, content: 'Kartallar FK olarak yeni sezon kadromuza forvet ve stoper arıyoruz, ilgilenen DM atsın.', created_at: minsAgo(40) },
    { sender_id: p[12], content: 'Bence bu sezon en iyi gelişen oyuncular arasında Mert Aydın var, tebrikler!', created_at: minsAgo(20) },
    { sender_id: oyuncu1, content: 'Teşekkürler, herkese iyi maçlar!', created_at: minsAgo(10) },
  ]);
  manifest.tribunMessageIds = tribun.map((t) => t.id);

  console.log('11/11 Halı sahalar + müsaitlik + takip edilen bölgeler oluşturuluyor...');
  const venues = await insertOrThrow('venues', [
    { owner_user_id: saha, name: 'Yıldız Halı Saha', city: 'İstanbul', district: 'Kadıköy', address: 'Bağdat Cd. No:120, Kadıköy/İstanbul', phone: '05321112233', whatsapp: '905321112233', price_per_hour: 600, description: 'Suni çim zemin, kapalı otopark, kafeterya. 5v5 ve 6v6 saha.', is_active: true },
    { owner_user_id: saha, name: 'Zafer Spor Kompleksi', city: 'İstanbul', district: 'Beşiktaş', address: 'Levent Mah. Spor Cd. No:45, Beşiktaş/İstanbul', phone: '05322223344', whatsapp: '905322223344', price_per_hour: 750, description: 'Kapalı saha, iklimlendirme, tribün. 6v6 ve 7v7 maçlara uygun.', is_active: true },
    { owner_user_id: saha, name: 'Sahil Halı Saha', city: 'İstanbul', district: 'Maltepe', address: 'Sahil Yolu No:8, Maltepe/İstanbul', phone: '05323334455', whatsapp: '905323334455', price_per_hour: 500, description: 'Deniz manzaralı açık saha, gece aydınlatması mevcut.', is_active: true },
  ]);
  manifest.venueIds = venues.map((v) => v.id);
  const [v1, v2, v3] = manifest.venueIds;

  await insertOrThrow('venue_availability', [
    { venue_id: v1, day_of_week: 0, start_time: '20:00', end_time: '21:00' },
    { venue_id: v1, day_of_week: 0, start_time: '21:00', end_time: '22:00' },
    { venue_id: v1, day_of_week: 0, start_time: '22:00', end_time: '23:00' },
    { venue_id: v1, day_of_week: 2, start_time: '19:00', end_time: '20:00' },
    { venue_id: v1, day_of_week: 2, start_time: '20:00', end_time: '21:00' },
    { venue_id: v1, day_of_week: 4, start_time: '21:00', end_time: '22:00' },
    { venue_id: v1, day_of_week: 4, start_time: '22:00', end_time: '23:00' },
    { venue_id: v2, day_of_week: 1, start_time: '18:00', end_time: '19:00' },
    { venue_id: v2, day_of_week: 1, start_time: '19:00', end_time: '20:00' },
    { venue_id: v2, day_of_week: 1, start_time: '20:00', end_time: '21:00' },
    { venue_id: v2, day_of_week: 3, start_time: '20:00', end_time: '21:00' },
    { venue_id: v2, day_of_week: 3, start_time: '21:00', end_time: '22:00' },
    { venue_id: v2, day_of_week: 5, start_time: '10:00', end_time: '11:00' },
    { venue_id: v2, day_of_week: 5, start_time: '11:00', end_time: '12:00' },
    { venue_id: v3, day_of_week: 6, start_time: '16:00', end_time: '17:00' },
    { venue_id: v3, day_of_week: 6, start_time: '17:00', end_time: '18:00' },
    { venue_id: v3, day_of_week: 6, start_time: '18:00', end_time: '19:00' },
    { venue_id: v3, day_of_week: 6, start_time: '19:00', end_time: '20:00' },
    { venue_id: v3, day_of_week: 3, start_time: '22:00', end_time: '23:00' },
    { venue_id: v3, day_of_week: 4, start_time: '18:00', end_time: '19:00' },
  ]);

  await insertOrThrow('followed_regions', [
    { user_id: oyuncu1, city: 'İstanbul', district: null },
    { user_id: oyuncu1, city: 'Ankara', district: null },
  ]);

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('\nTamamlandı! Manifest kaydedildi:', MANIFEST_PATH);
  console.log('\nGiriş bilgileri:');
  console.log('  demo.oyuncu1@footbally.app / Demo2026!Oyuncu1  (Mert Aydın)');
  console.log('  demo.oyuncu2@footbally.app / Demo2026!Oyuncu2  (Emre Şahin)');
  console.log('  demo.takim@footbally.app   / Demo2026!Takim    (Kartallar FK)');
  console.log('  demo.saha@footbally.app    / Demo2026!Saha     (Halı saha işletmecisi)');
}

main().catch((err) => {
  console.error('\nHATA:', err.message);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.error('Buraya kadar oluşturulanlar manifest dosyasına kaydedildi (kısmi):', MANIFEST_PATH);
  process.exit(1);
});
