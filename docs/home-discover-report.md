# Sahte veri temizliği, keşfet profilleri, ana sayfa sadeleşmesi, Sahadan — Rapor

Dal: `feat/home-discover-cleanup` (`feat/listings-referral` üzerinden açıldı). Hedef kitle: uygulamanın sahibi ve geliştiriciler.

## a) Bölüm bölüm yapılanlar ve commit'ler

| Bölüm | Commit | Açıklama |
|---|---|---|
| 1a | `5abc7bf` | Rakip arama: sahte takım dizisi, `isFake` ve sahte davet dalı kaldırıldı; liste yalnızca gerçek takımlar |
| 1b | `8c5bc61` | Oyuncu arama: `list_discoverable_players` RPC'si; engellenenler gizli; pozisyon filtresi profil kategorileriyle; sahte istatistik/ücret/davet kaldırıldı |
| 1c | `58090ad` | Takım başvuruları gerçek kaynaktan (`match_applications`); kabul/ret kaldırıldı (bkz. d) |
| 1d | `4787fa2` | Kalan sahte içerik: AI ekranındaki doğrulanamayan güven iddiaları, onboarding'deki sabit "847" |
| 2 altyapı | `e0b4a62` | `lib/profileActions.ts`, `lib/useBlockedIds.ts`, `lib/discovery.ts` testleri |
| 2c–d | `8e360f1` | Başka oyuncu ve takım profilinde etiketli "Şikâyet Et" ve "Engelle"; engelleme sonrası geri dönüş; takım şikâyeti `team` hedefi |
| 2a–b | `137db1c` | Keşfet: oyuncu ve takım kartı gövdesi profil açar; mesaj/meydan oku butonları çalışır; engellenenler süzülür |
| 2a–b | `61a250c` | Scout kartı profil açar; takip, Scout, mesaj listesi (sohbet ve bağlantılar) engellenenleri süzer |
| 3 | `08779f1` | Ana sayfa: selamlama, Sahadan, Yaklaşan Maçlar, dört kısayol. Skor görevleri, görev penceresi, ipucu kendi profiline taşındı (`ProfileProgress`) |
| 4 | `a18c804` | `lib/sahadan.ts`, `lib/useSahadanFeed.ts` (ortak akış ve canlı abonelik), `get_sahadan_messages` migration (uygulanmadı) |
| 4 | `5e9e8c1` | Tam ekran Sahadan ortak akışı kullanır; gönderen adına dokununca profil; uzun basınca şikâyet/engelleme; giriş alanı `focus` ile açılır |
| 4 | `a744f1a` | Ana sayfa Sahadan önizlemesi: son 5 mesaj, yazma kutusu, boş durum "İlk mesajı yaz" |
| 4 | `d0a4368` | Mesajlar ekranındaki SAHADAN sekmesi kaldırıldı |
| — | `b19c4d0` | Kullanılmayan import temizliği |

Tüm commit mesajları İngilizce; her commit'te `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` satırı var.

Kontroller: her parçadan sonra `npx tsc --noEmit` ve `npm test` çalıştırıldı. Son durum: tsc 0 hata; `npm test` **282 test, 282 geçti**.

## b) Kaldırılan sahte veriler (tam liste)

Kod tabanında `isFake`, `FAKE_`, `MOCK_`, `DUMMY`, `SAMPLE_`, `DEMO_` kalıpları ve bilinen sabit kişi/takım adları tarandı (test dosyaları hariç).

| Dosya | Ne vardı | Durum |
|---|---|---|
| `screens/FindOpponentScreen.tsx` | `FAKE_TEAMS` (8 uydurma takım: "Kadıköy United FC", "Beşiktaş Amatör", …), `TeamRow.isFake`, sahte takımlara davet göndermeyen dal | Kaldırıldı |
| `screens/FindPlayerScreen.tsx` | `FAKE_PLAYERS` (8 uydurma oyuncu: "Ahmet Yılmaz", "Mehmet Demir", …) ve fiyat/istatistik alanları; "Davet" butonu yalnızca yerel bildirim gösteriyordu | Kaldırıldı; gerçek RPC bağlandı |
| `screens/TeamProfileScreen.tsx` | `FAKE_APPLICATIONS` (2 uydurma başvuru: "Ahmet Yılmaz", "Mert Çelik") | Kaldırıldı; gerçek başvurular bağlandı |
| `screens/OnboardingScreen.tsx` | Başarı slaydında sabit "847" istatistiği | Kaldırıldı |
| `screens/AIAnalysisScreen.tsx` | "50.000+ analiz yapıldı", "%96 doğruluk oranı", "UEFA lisanslı metodoloji" güven satırları (doğrulanamayan iddialar) | Kaldırıldı (`trust1..3` çeviri anahtarları kodda kullanılmıyor, bırakıldı) |
| `api/mockData.ts` | Dosya adı "mock" ama içerik yalnızca Aktiviteler filtre etiketleri (`activityFiltersData`) | Bırakıldı: sahte kayıt yok; yeniden adlandırılması gerekmiyor |

Bilinçli olarak bırakılanlar (sahte kayıt değil):
- `screens/AIAnalysisScreen.tsx`: "87" değeri, "örnek" başlığı altında kilitli bir önizleme kartında. Kullanıcı bunu gerçek çıktı sanmasın diye etiketli; kaldırmak istenirse tek satır.
- `screens/MessagesScreen.tsx`: `online: false` sabiti; çevrimiçi bilgisi yok, nokta hiç gösterilmez (ölü kod, zarar yok).
- Yayınlanmış tüm "12 online" benzeri sayılar bulunmadı.

## c) Varsayılan kararlar ve nasıl değiştirilir

1. **Oyuncu listesi kaynağı.** `list_discoverable_players` RPC'si (tamamlanmış, kısıtlı olmayan profiller; kendi profili hariç). Engellenenler istemcide `user_blocks` (kendi satırlarım) ile süzülür. Değiştirmek için `screens/FindPlayerScreen.tsx` → `loadPlayers`.
2. **Oyuncu filtresi.** Pozisyon seçenekleri profil kategorileri (`POSITION_OPTIONS`: Kaleci, Defans, Orta Saha, Kanat, Forvet). Eski ayrıntılı pozisyonlar (`constants/footballPositions.ts`) artık bu ekranda kullanılmıyor.
3. **FindPlayer kart içeriği.** Fiyat rozeti, istatistik çubukları ve "Davet" butonu kaldırıldı (gerçek veri veya gerçek davet yok). Kart dokunulunca profili açar.
4. **Başvurular.** Liste: takımın maçlarındaki `match_applications` (kapsam: `fetchTeamApplicants`), pozisyona göre süzülür, olumsuz durumlar (`countsAsApplication`) çıkarılır. Kabul/ret butonları kaldırıldı: `match_applications` üzerinde sahibe UPDATE politikası yok (bkz. d).
5. **Engel listesi okunamazsa** (null) listeler boş gösterilir (fail closed). Liste yüklenene kadar da gizli kalır.
6. **Takım şikâyeti.** Hedef `team` (`teams.id`); takım engellenince sahibi (`owner_id`) engellenir.
7. **Sahadan'da şikâyet.** Uzun basma gönderen adında (mesaj balonunda değil). Gönderenin hesabı şikâyet edilir (`profile` hedefi); takımın sahibi bu şekilde şikâyet edilir çünkü `submit_report` mesaj kimliklerini `tribun_messages` için desteklemiyor.
8. **Ana sayfa.** Kalanlar: selamlama/başlık, Sahadan, Yaklaşan Maçlar, Hızlı Erişim (Maç Analizi → `match`, Fırsatlar → `activities`, AI Analiz → `ai`, Scout Ağı → `scout`). Kaldırılanlar: Keşfet kartları, VenuesTeaser, günlük ipucu, skor kartı, skor görevleri, "Son Bildirimler". Performans kısayolu profil menüsüne taşındı; Kariyer kısayolu kaldırıldı (profil zaten skoru gösteriyor).
9. **Skor yenileme.** `refresh_my_score` ana sayfada sessizce çalışmaya devam ediyor. Görev durumu profil ekranında `get_my_score_breakdown` ile okunuyor.
10. **Kendi profili.** `ownOnlySections(viewer, subject).progress` ile gizlenir (test: `__tests__/discovery.test.ts`).
11. **Sahadan canlı abonelik.** `useSahadanFeed(active)`: ekran etkinken açık; `AppState` arka planda kapatır, öne gelince yeniden yükler. Ana sayfadan çıkınca bileşen kalkar, kanal kapanır.
12. **Medya güvenliği (önizleme).** RPC yokken önizlemede medya gösterilmez (`withoutUnverifiedMedia`). Tam ekranda medya eskisi gibi gösterilir (bkz. d).
13. **Giriş alanı.** Ana sayfadaki yazma kutusu bir düğme gibidir; dokununca `navigate('tribun', {focus:true})` ile tam ekran açılır ve klavye hazır gelir (`App.tsx` `tribunAutoFocus`).
14. **Yeni çeviri anahtarı:** yalnızca `sahadan_writeFirst` (TR/EN). Diğer metinler mevcut anahtarlardan.
15. **Ana sayfadaki bildirim listesi** artık gösterilmiyor ama veri yükleme kodu (`notifications` durumu) bırakıldı; gereksiz sorgu olabilir. Temizlemek için `loadAll` içindeki bildirim bloğu.

## d) Veritabanı değişikliği gerektiren ve bu yüzden boş durumla bırakılan yerler

Kural gereği hiçbir DDL/DML çalıştırılmadı. SELECT ile okunan durumlar:

1. **Sahadan kaldırılmış medya ve engel filtresi (sunucu).** Migration yazıldı, **uygulanmadı**: `supabase/migrations/20261116100000_sahadan_moderated_feed.sql` (`get_sahadan_messages` RPC'si). Yerelde test edildi (`footbally_test`): engellenen ve kaldırılmış medya gizlendi, anonim erişim reddedildi. Uygulanmadan önce:
   - Ana sayfa önizlemesi medya mesajlarını **gizler** (boş/güvenli durum).
   - Tam ekran medyayı eski davranışıyla gösterir; yönetici kaldırmış medya görünmeye devam edebilir. Bu bilinçli bir açık risk olarak raporlanır.
   - Uygulama için: migration'ı canlıya uygulamak (yalnızca ekleme) ve sonra istemcinin otomatik olarak RPC'yi kullanmasını doğrulamak. İstemci RPC yoksa tabloya düşer (PGRST202 kontrolü `isMissingRpc`).
2. **Takım başvurularında kabul / ret.** `match_applications` için sahibe UPDATE politikası yok. Butonlar kaldırıldı; liste salt okunur. Kabul/ret için bir politika (sahibi için UPDATE, yalnızca `status` alanı) ve bir RPC gerekir. Bu migration yazılmadı.
3. **Engelleyen kişinin görünmesi (karşılıklı).** `user_blocks` yalnızca kendi satırlarını okutur. Beni engelleyen kullanıcıları istemci bilemez; listelerde yalnızca ben engelleyenler gizlenir. Karşılıklı gizleme için sunucu tarafı bir okuma RPC'si gerekir (migration yazılmadı). Mesaj gönderimi zaten `enforce_message_block` trigger'ıyla engelli.
4. **Tribun mesajı için şikâyet.** `submit_report` yalnızca `messages` (DM) kimliklerini destekliyor, `tribun_messages` kimliklerini değil. Bu yüzden gönderen hesabı şikâyet edilir. Mesaj düzeyi şikâyet için `submit_report` içinde yeni bir hedef türü gerekir (migration yazılmadı).

## e) tsc / test sonuçları, build numarası, submit sonucu

- `npx tsc --noEmit`: **0 hata** (son çalıştırma).
- `npm test`: **282 test, 282 geçti, 0 başarısız** (yeni: `__tests__/discovery.test.ts`, `__tests__/sahadan.test.ts`).
- Yerel SQL doğrulaması (migration `20261116100000`, `footbally_test`): geçti (bkz. d-1).
- ESLint (değişen dosyalar): yeni dosyalarda hata yok; hatalar eski `useEffect` kalıplarında (AIAnalysisScreen, FindOpponentScreen, HomeScreen, MessagesScreen, SocialFeedScreen, TeamProfileScreen, UserFollowListScreen) ve değiştirmediğim satırlarda.
- Build ve submit: aşağıda.

- **Build — başarılı.** `eas build -p ios --profile production --non-interactive`. Build numarası **8 → 9** (EAS `autoIncrement`; `app.json`/`eas.json` sürüm ve build alanları elle değiştirilmedi). Build: https://expo.dev/accounts/osmantemur/projects/footbally/builds/b8539b1c-6a95-4826-a3d8-7e8e133ae7ea · IPA: https://expo.dev/artifacts/eas/OMY9cdPjs2rs3oxRZgauaCYm6cBSbHRr8q-ZLIYXRGI
- **Submit — başarılı (yalnızca TestFlight).** `eas submit -p ios --latest --non-interactive` build 9'u App Store Connect'e yükledi. Submission: https://expo.dev/accounts/osmantemur/projects/footbally/submissions/707873a3-2f29-4498-99ce-1f4c663d56b4 . İnceleme gönderimi, sürüm ve metadata değişikliği yapılmadı. Apple işlemesi bitince e-posta gelir.

## f) Telefonda elle test edilecekler

1. **Keşfet → Oyuncu ara.** Liste gerçek oyuncular (uygulamada tamamlanmış profiller). Kendi profilin yok. Şehir ve pozisyon filtreleri çalışır. Karta dokununca oyuncu profili açılır; geri dönüş çalışır.
2. **Keşfet → Rakip ara.** Yalnızca gerçek takımlar. Takım kartına dokununca takım profili açılır. Meydan oku butonu çalışır. Takım yoksa boş durum.
3. **Keşfet → Ara.** Oyuncu ve takım kartları profil açar; mesaj/meydan oku butonları çalışır. Engellediğin kişi ve takımlar listede yok.
4. **Başka oyuncunun profili.** Takip Et/Takibi Bırak ana buton; "Şikâyet Et" ve "Engelle" etiketli görünür. Engelle → onay sorusu → tamam → geri dönüş. Engellenen kişi aramada, Scout'ta, takipçi listelerinde, gönderilerde, sohbetlerde görünmez.
5. **Başka takımın profili.** Takip, Şikâyet Et (takım), Engelle (sahibi). Kendi takımında bu üç düğme yok.
6. **Kendi profilin.** Üç düğme yok. Skor görevleri, "Tüm Görevleri Gör" penceresi, günlük ipucu ve Performans kısayolu burada.
7. **Ana sayfa.** Selamlama, Sahadan önizlemesi (son mesajlar, gönderen adına dokununca profil), yazma kutusu (dokununca tam ekran, klavye açık), Yaklaşan Maçlar, dört kısayol. Skor kartı, Keşfet, bildirim listesi ve ipucu yok.
8. **Sahadan (tam ekran).** Mesajlar akar. Yeni mesaj gelince canlı güncellenir. Gönderen adına uzun basınca "Şikâyet Et" ve "Engelle" seçenekleri. Arka plandan dönünce liste yenilenir.
9. **Mesajlar.** Yalnızca Mesajlar ve Bağlantılar sekmeleri var; SAHADAN sekmesi yok.
10. **Takım başvuruları.** Takım profilinde "Başvuruları gör" → pozisyona göre liste; kabul/ret düğmeleri yok.
11. **AI analiz.** Güven satırları yok; "Örnek" kartı kilitli.
12. **Onboarding.** Başarı slaydında sabit sayı yok.

## g) Doğrulanamayan her şey

- **Canlı veri.** Oyuncu listesi (RPC), takım başvuruları ve Sahadan canlı verisi, uygulamada gerçek hesaplarla uçtan uca denenmedi; yalnızca kod ve SQL tanımları incelendi.
- **Migration.** `get_sahadan_messages` yalnızca yerel test veritabanında çalıştı (stub tablolarla); canlı `tribun_messages`, `user_blocks` ve `media_moderation` gerçek politikalarıyla test edilmedi. `media_ref` ile `tribun_messages.media_url` eşleşmesi, medya URL'lerinin yönetici kayıtlarıyla birebir aynı biçimde tutulup tutulmadığına bağlı; doğrulanmadı.
- **Keşfet'te oyuncu araması.** `ProfileScreen`/`SearchScreen` içindeki oyuncu araması hâlâ `profiles_public` görünümünü kullanıyor (RPC değil). Bu görünümde yasaklı hesapların görünüp görünmediği doğrulanmadı; bu bölümün kapsamı dışında bırakıldı.
- **Rakip ara takım listesi.** Kısıtlı (ban/arşiv) takımların süzülüp süzülmediği doğrulanmadı; kapsam dışı.
- **Engel yönü.** Beni engelleyen kullanıcılar istemci listelerinde görünebilir (bkz. d-3).
- **Uzun basma.** Mesaj balonu yerine gönderen adında; mesaj balonuna uzun basma kullanıcı beklentisinden farklı olabilir.
- **Telefon testi yapılmadı.** Ekran düzeni, klavye davranışı ve bildirim geri dönüşü yalnızca koddan doğrulandı.
- **Ana sayfa bildirim sorgusu** hâlâ çalışıyor (gösterilmediği halde).
