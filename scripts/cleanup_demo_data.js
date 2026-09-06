// Ödeme entegrasyonu ve şirketleşme tamamlandığında, seed_demo_data*.js ile
// eklenen HER ŞEYİ geri alır. scripts/demo_seed_manifest.json'ı okuyarak
// tam olarak neyin silineceğini bilir.
//
// Kullanım: node scripts/cleanup_demo_data.js
// Not: 4 hero hesabın (demo.oyuncu1/oyuncu2/takim/saha) KENDİSİ silinmez,
// sadece onlara ait seed edilmiş veriler silinir. Hesapları da tamamen
// silmek istersen Dashboard → Authentication → Users üzerinden elle sil,
// ya da bu script'e --delete-heroes bayrağıyla çalıştır.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env.local');
const MANIFEST_PATH = path.join(__dirname, 'demo_seed_manifest.json');
const SUPABASE_URL = 'https://mohsosllyfgevvvpbkkn.supabase.co';
const DELETE_HEROES = process.argv.includes('--delete-heroes');

function loadServiceKey() {
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m);
  if (!match) throw new Error('.env.local içinde SUPABASE_SERVICE_ROLE_KEY bulunamadı.');
  return match[1].trim();
}

const supabase = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log('Manifest bulunamadı, silinecek demo verisi yok.');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const { oyuncu1, oyuncu2, takim, saha } = manifest.heroes;
  const allAuthIds = [...manifest.phantomPlayers, ...manifest.phantomTeamOwners];

  console.log('Halı saha müsaitlik + sahalar siliniyor...');
  if (manifest.venueIds?.length) {
    await supabase.from('venue_availability').delete().in('venue_id', manifest.venueIds);
    await supabase.from('venues').delete().in('id', manifest.venueIds);
  }

  console.log('Takip edilen bölgeler siliniyor...');
  await supabase.from('followed_regions').delete().eq('user_id', oyuncu1);

  console.log('Tribün mesajları siliniyor...');
  if (manifest.tribunMessageIds?.length) {
    await supabase.from('tribun_messages').delete().in('id', manifest.tribunMessageIds);
  }

  console.log('Bağlantılar siliniyor...');
  if (manifest.connectionIds?.length) {
    await supabase.from('connections').delete().in('id', manifest.connectionIds);
  }

  console.log('Bildirimler siliniyor...');
  if (manifest.notificationIds?.length) {
    await supabase.from('notifications').delete().in('id', manifest.notificationIds);
  }

  console.log('Mesajlar + sohbetler siliniyor...');
  if (manifest.messageIds?.length) {
    await supabase.from('messages').delete().in('id', manifest.messageIds);
  }
  if (manifest.conversationIds?.length) {
    await supabase.from('conversations').delete().in('id', manifest.conversationIds);
  }

  console.log('İlanlar siliniyor...');
  if (manifest.opportunityIds?.length) {
    await supabase.from('opportunities').delete().in('id', manifest.opportunityIds);
  }

  console.log('Maçlar siliniyor...');
  if (manifest.matchIds?.length) {
    await supabase.from('matches').delete().in('id', manifest.matchIds);
  }

  console.log('Takımlar siliniyor...');
  if (manifest.teamIds?.length) {
    await supabase.from('teams').delete().in('id', manifest.teamIds);
  }

  console.log('Profiller siliniyor (hero + figüran)...');
  await supabase.from('profiles').delete().in('user_id', [...allAuthIds, oyuncu1, oyuncu2, takim, saha]);

  console.log('Figüran auth hesapları siliniyor (' + allAuthIds.length + ' adet)...');
  for (const uid of allAuthIds) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) console.warn(`  - ${uid} silinemedi: ${error.message}`);
  }

  if (DELETE_HEROES) {
    console.log('Hero hesaplar da siliniyor (--delete-heroes verildi)...');
    for (const uid of [oyuncu1, oyuncu2, takim, saha]) {
      const { error } = await supabase.auth.admin.deleteUser(uid);
      if (error) console.warn(`  - ${uid} silinemedi: ${error.message}`);
    }
  } else {
    console.log('\nHero hesaplar (demo.oyuncu1/oyuncu2/takim/saha) silinmedi — sadece verileri temizlendi.');
    console.log('Hesapları da silmek istersen: node scripts/cleanup_demo_data.js --delete-heroes');
  }

  fs.unlinkSync(MANIFEST_PATH);
  console.log('\nDemo verisi tamamen temizlendi.');
}

main().catch((err) => {
  console.error('\nHATA:', err.message);
  process.exit(1);
});
