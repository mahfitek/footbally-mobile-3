# Engelleme, liste etiketleri, engellenenler, fırsatlar ve hakkımda — Rapor

Dal: `feat/block-bio-opportunities` (`feat/reject-and-block-rules` üzerinden açıldı). Hedef kitle: uygulamanın sahibi ve geliştiriciler.

## Durum özeti

| Konu | Durum |
|---|---|
| Bölüm 1 — Engelleyince profilde kalma | Tamam (`f5dc7fa`) |
| Bölüm 2 — Listelerde "Engellendi" etiketi | Tamam (`f2d3862`) |
| Bölüm 3 — Engellenen Kullanıcılar + `get_my_blocked_users` | Tamam, migration canlıda (`7419e4f`) |
| Bölüm 4 — Fırsatlar (yalnızca veritabanı) | Tamam (`78c1e03`) |
| Bölüm 5 — Hakkımda | Tamam (`bf1508e`, kayıt düzeltmesi `d06fc24`) |
| tsc | Hatasız |
| npm test | 321 geçti, 0 başarısız |
| Yerel SQL testleri | Tüm zincir geçti (124 PASS, `LOCAL TESTS PASSED`) |
| Push | Yapıldı (`origin/feat/block-bio-opportunities`) |
| iOS production build | **Çalıştırılmadı** — EAS Free plan iOS build kotası doldu (aşağıya bakın) |
| TestFlight gönderimi | **Çalıştırılmadı** — build olmadan gönderilecek yeni bir build yok |

## a) Commit'ler

| Commit | Açıklama |
|---|---|
| `f5dc7fa` | Engelleyince profilde kalma; engel banner'ı; "Engeli Kaldır" onayı; içerik gizleme (ProfileScreen, TeamProfileScreen) |
| `f2d3862` | Liste ekranlarında engelliler kalır, "Engellendi" etiketi alır; mesaj/meydan okuma/bağlantı kısayolları kapanır |
| `7419e4f` | `get_my_blocked_users` migration'ı, yerel test, Engellenen Kullanıcılar ekranı, ortak engel önbelleği |
| `78c1e03` | Fırsatlar: ayrı yükleniyor/hata/boş durumları, başvuru durumu, başarı yalnızca kayıttan sonra |
| `bf1508e` | Hakkımda: düzenleme alanı, 500 karakter, moderasyon, profilde gösterim, engelde gizleme |
| `d06fc24` | Düzeltme: Hakkımda yalnızca değiştiyse denetlenir ve gönderilir |

## b) Uygulanan migration'lar

| Migration | Durum | Doğrulama |
|---|---|---|
| `supabase/migrations/20261116120000_get_my_blocked_users.sql` | **Canlıya uygulandı** (`apply_migration`) | `pg_proc` SELECT: `security_definer = true`, `search_path = public, pg_temp`, dönüş tipi `user_id, full_name, avatar_url, team_name, blocked_at`; `anon` çalıştıramaz, `authenticated` çalıştırabilir, `public` çalıştıramaz |

Yerel: `supabase/tests/local/02_teams_list_stubs.sql` (teams için `created_at`, `archived_at` stub'ı) ve `30_blocked_users_list_tests.sql` (14 doğrulama: sıralama, kendi engelleri, kısıtlı hesap, silinmiş hesap, arşivli takım, diğer engelleyenin izolasyonu, yetkiler). `run_local.sh` zincirine eklendi; tüm zincir yeni bir veritabanında `LOCAL TESTS PASSED` verdi.

Canlı veritabanında hiçbir tablo, politika, mevcut fonksiyon veya satır değiştirilmedi. `opportunities` tablosuna hiçbir yazma yapılmadı.

## c) Engel filtresinin kaldırıldığı ve korunduğu ekranlar

**Kaldırıldı (engelliler listede kalır, "Engellendi" etiketi alır):**

| Ekran | Değişiklik |
|---|---|
| SearchScreen (Keşfet) — oyuncular | Gizleme kaldırıldı; mesaj kısayolu engellilerde yok |
| SearchScreen (Keşfet) — takımlar | Gizleme kaldırıldı; meydan okuma kısayolu engellilerde yok |
| FindPlayerScreen | `applyPlayerFilters` artık engelleneni çıkarmaz; yalnızca kendi profili çıkar. Engel listesi okunamazsa oyuncular yine görünür, yalnızca etiket verilmez |
| FindOpponentScreen | Takım gizleme kaldırıldı; "Meydan oku" düğmesi engelli takımda yok |
| ScoutScreen | Gizleme kaldırıldı; mesaj ve bağlantı isteği düğmeleri engellilerde yok |
| UserFollowListScreen | Gizleme kaldırıldı; satırda etiket |

**Korundu (içerik filtresi, değişmedi):**

| Ekran | Not |
|---|---|
| TribunScreen | Yalnızca benim engellerim gizlenir (Sahadan kuralı) |
| Ana sayfa Sahadan önizlemesi | Aynı kural |
| SocialFeedScreen | Gönderi ve yorum filtresi |
| Yorum listeleri | Aynı |
| MessagesScreen / ChatScreen | Sohbet ve mesaj filtresi |
| SearchScreen — maç ilanları | Engellinin oluşturduğu ilanlar gizli kalır. Bu bir kişi listesi değil, içerik; karar bu yönde |

Beni engelleyenler her listede görünür; etkileşim sunucuda reddedilir ve tek mesaj gösterilir: "Bu kullanıcıyla etkileşime geçemezsin."

## d) Fırsatlar: sabit veriler

- Kodda sabit, örnek veya yedek fırsat listesi **kalmamıştı**. `api/mockData.ts` yalnızca filtre etiketlerini (`activityFiltersData`) tutar; fırsat verisi içermez. `lib/i18n.ts` yalnızca metinleri tutar. Ana sayfa yalnızca bir kısayol kartı gösterir.
- Silinen veya değiştirilen veri yok. Tablodaki **11 fırsat kaydı** ve **10 başvuru** (`match_applications.opportunity_id`) olduğu gibi duruyor; proje sahibi silecek. Bu kayıtlara uygulama hiçbir yazma veya silme yapmaz.
- Üç durum ayrı: yükleniyor, hata (tekrar dene düğmesi ile) ve boş ("Şu an açık fırsat yok. Yeni fırsatlar eklendiğinde burada görünecek."). Hata artık boş liste gibi görünmez.
- Filtre sayıları yüklenen veriden hesaplanır.
- "Başvuruldu" durumu kullanıcının kendi başvurularından gelir; fırsatı silinmiş başvurular atlanır (`appliedOpportunityIds`, test var).
- Düzeltme: "Başvur" eskiden kayıt başarısız olsa bile "başvurunuz alındı" gösteriyordu. Artık yalnızca kayıt başarılı olunca başarı gösterilir; başarısızlıkta hata gösterilir.
- "Bir fırsata başvur" görevi aynen duruyor ve puanı değişmedi; görev `activities` ekranını açar ve boş metni gösterir.

## e) Hakkımda (bio)

**Okuma/yazma yolu (SELECT ile doğrulandı):**
- `profiles.bio`: `text`, uzunluk kısıtı yok.
- Okuma: "Users can read own profile" (kendi satırı) ve `profiles_public` görünümü `bio` alanını içerir. Başkasının profili `publicProfile` ile okur.
- Yazma: "Users can update own profile" politikası. `protect_profile_trusted_columns` tetikleyicisi `bio`'yu korumaz.

**Ne yapıldı:**
- Düzenleme formuna çok satırlı "Hakkımda" alanı eklendi; 500 karakter (kod noktası sayımı, veritabanının `char_length` ile aynı), canlı sayaç.
- Kayıtta kişisel veri ve zararlı kod filtresi (`moderateMessage`) uygulanır; reddedilen metin kaydedilmez.
- Kendi profilimde boşsa "Kendini tanıt…" ipucu ve "Ekle" düğmesi; başkasının profilinde boşsa bölüm gizli.
- Dolu metin 4 satırda kırpılır, "Devamını gör" / "Daha az" ile açılır.
- Engelli kişinin hakkında bölümü gizli (`bioView`).
- Taslak, kaydedilene kadar profilde görünmez; "İptal" taslağı atar.
- Düzeltme (`d06fc24`): profil kaydı bio'yu yalnızca değiştiyse denetler ve gönderir. Bu düzeltme olmadan web sitesinin 500 karakterden uzun CV metni her profil kaydını engelleyecek ve üzerine yazılacaktı.

**Sunucuya uzunluk kısıtı eklenmedi, bilinçli karar:** Web sitesi aynı `profiles.bio` sütununa CV metni yazıyor (`player-profile.component.ts`, `.update({ bio: this.cvText })`). CV metni 500 karakteri aşabileceğinden bir `CHECK` kısıtı web kayıtlarını bozardı. Sınır yalnızca uygulamada uygulanır.

**Takım açıklaması:** Ekleme gerekmedi. `TeamEditScreen` `description` alanını zaten kaydediyor; `TeamProfileScreen` "Hakkında" kartında gösteriyor.

## f) Doğrulama sonuçları

| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | Hatasız (çıkış kodu 0) |
| `npm test` | 321 geçti, 0 başarısız |
| `npx eslint` (değiştirilen yeni dosyalar: `lib/blockStore.ts`, `lib/blockedUsers.ts`, `lib/bio.ts`, `lib/opportunities.ts`, `components/BlockedTag.tsx`, `components/BioText.tsx`, `screens/BlockedUsersScreen.tsx`) | Hata yok |
| Eski ekranlar — ActivitiesScreen, SearchScreen | Başlangıçla aynı: 0 hata, 1 uyarı |
| Eski ekranlar — FindPlayer, FindOpponent, Scout, UserFollowList | Hata sayısı değişmedi (2; önceden var olan `set-state-in-effect`). Uyarı sayısı 22 → 24: yeni import'lar, import sırası uyarısı |
| ProfileScreen | 0 hata, 34 uyarı (başlangıç sayısı ölçülmedi) |
| Yerel SQL zinciri (`run_local.sh`) | `LOCAL TESTS PASSED` |

## g) iOS build ve TestFlight

- `eas build -p ios --profile production --non-interactive` **çalıştırıldı ve başlamadan durdu.** EAS çıktısı: "This account has used its iOS builds from the Free plan this month, which will reset in 14 days (on Tue Dec 01 2026)." Kod arşivi yüklendi, ancak build oluşturulmadı.
- Kota hatası yeniden denemeyle geçmeyeceği için yeniden denenmedi. Planı yükseltmek (`eas billing:subscribe starter --account osmantemur`) bir ödeme kararı; bu sizin onayınızı gerektirir.
- Build olmadığı için `eas submit -p ios --latest --non-interactive` çalıştırılmadı. `--latest` eski build 10'u tekrar gönderebileceğinden bu adım kasıtlı olarak atlandı.
- Build numarası: **yok** (yeni build oluşturulmadı). `app.json` / `eas.json` sürümleri değiştirilmedi.

**Build'i yapmak için:** kotayı yükseltin veya 1 Aralık 2026'dan sonra şu iki komutu çalıştırın: `eas build -p ios --profile production --non-interactive`, ardından `eas submit -p ios --latest --non-interactive`.

## h) Telefonda test listesi

1. Bir kullanıcının profilini engelleyin: profilde kalınır, "Bu kullanıcıyı engelledin." banner'ı ve "Engeli Kaldır" görünür; istatistik, skor, galeri, beceri ve bilgi kartları gizlenir; "Şikâyet Et" çalışır.
2. Banner'dan "Engeli Kaldır" → onay → "Engel kaldırıldı." toast'ı; içerikler geri gelir.
3. Takım profilinde aynı akış (takım sahibi için).
4. Keşfet, Oyuncu Bul, Rakip Bul, Scout ve takipçi listelerinde engelli kişi "Engellendi" etiketiyle görünür; satıra dokununca profil açılır; mesaj/meydan okuma/bağlantı düğmesi yok.
5. Ayarlar → "Engellenen Kullanıcılar": en yeni en üstte; kişi adı veya "Kullanıcı"; takım adı; tarih; "Engeli Kaldır" onaylı; boşken "Engellediğin kullanıcı yok."; satıra dokunma profili açar.
6. Bir listede engel kaldırılınca diğer açık ekranlarda etiket hemen kalkar (ortak önbellek).
7. Keşfet / Fırsatlar: 11 kayıt görünür (silinene kadar); yükleme hatasında "Tekrar dene"; "Başvur" başarısızsa hata toast'ı, başarıda "Başvurunuz alındı".
8. Profil düzenleme: Hakkımda alanı 500 karakterde durur, sayaç doğru; telefon numarası yazınca kayıt reddedilir; boş bırakıp kaydetmek bio'yu temizler.
9. Kendi profilinde boş Hakkımda: ipucu ve "Ekle". Başkasının profilinde boş bio: bölüm yok.
10. Uzun bio: 4 satır, "Devamını gör" çalışır.

## i) Web tarafı için notlar

- **`profiles.bio` çakışması:** Web sitesi bu sütunu CV metni olarak kullanıyor; uygulama ise "Hakkımda" olarak kullanıyor. Aynı alanı iki ürün farklı anlamda yazıyor. Uygulamada değişiklik yapılmadığı sürece web CV metni uygulamada "Hakkımda" olarak görünür. Ayrı bir sütun (örneğin `profiles.about`) düşünülebilir; bu bir veri modeli kararı.
- Web sitesinin uzun CV metni de 500 karakter sınırını aşabilir; sınır yalnızca uygulamada, yalnızca değiştirildiğinde uygulanır.
- `block_unavailable` metni ("Bu özellik henüz etkin değil") eski: engelleme RPC'leri canlıda var. Bu branch'te değiştirilmedi.
- Eski fırsat metin anahtarları (`activities_emptyTitle`, `activities_emptySub`, `activities_emptyFilteredTitle`) artık kullanılmıyor; temizlenmedi.
- Profil görevlerindeki "başvuru" sayımı sunucu fonksiyonunda (`compute_profile_task_breakdown`) yapılıyor; silinmiş fırsatların başvuruları bu sayıda kalabilir. Bu bu branch'te kontrol edilmedi.

## j) Doğrulanamayanlar

- Gerçek cihazda davranış (dokunma, kırpma, banner görünümü, Android'de satır ölçümü): test edilmedi; yalnızca tip denetimi ve birim testleri yapıldı.
- TestFlight işlemesi ve iOS build'i: çalıştırılmadı (yukarıya bakın).
- Canlı veritabanında `get_my_blocked_users` çağrısı yalnızca yetki ve tanım seviyesinde doğrulandı; gerçek bir oturumla satır sonucu yerel testte doğrulandı.
