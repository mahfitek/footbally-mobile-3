# İlan türleri, maç formatı, diziliş ve davet sistemi — Rapor

Dal: `feat/listings-referral` (`feat/apple-iap` üzerinden açıldı). Hedef kitle: uygulamanın sahibi ve geliştiriciler.

## a) Yapılanlar ve commit'ler

| Bölüm | Commit | Açıklama |
|---|---|---|
| DB | `97cf765` | matches: `listing_type`, `match_format`, `formation`, `lineup`, `fee_note` + kısıtlar + kadro trigger'ı |
| DB | `d885e43` | `referral_codes`, `referrals`, kod/davet/ödül fonksiyonları, profil tamamlanma trigger'ı |
| DB | `4bb7b44` | "Premium'a geç" görevi: `referral` aboneliği sayılmaz (canlı gövdeden yazıldı) |
| Test | `bd65997` | Yerel PostgreSQL test düzeneği (`supabase/tests/local/`) |
| Premium | `3d3c693` | İstemci kuralı `countsAsPaidPremium` ve drift testleri |
| Bölüm 3 | `d908abc` | `lib/formations.ts`: 5v5–11v11 dizilişleri, slot üretimi, otomatik kadro dolumu + testler |
| Bölüm 3 | `2103156` | `components/FormationPitch.tsx`; TeamSquadScreen aynı sahayı ve tek kaynağı kullanır |
| Bölüm 1–4 | `6e9e136` | `lib/matchListing.ts`: tür, format filtresi, taslak doğrulama + testler |
| Bölüm 5 | `57c9aba` | `lib/referral.ts`: kod kuralları, ilerleme, hata eşleme, paylaşım metni, RPC sarmalayıcıları + testler |
| i18n | `22034d5` | TR/EN metinler (`lib/i18n.ts`) |
| Bölüm 5 | `88e6632` | Davet ekranı, profil ("Davet Et") ve ayarlar girişi, kayıtta isteğe bağlı kod |
| Bölüm 1–4 | `d03e220` | İlan oluşturma: tür adımı, format, diziliş/kadro, ücret, doğrulama |
| Bölüm 1–2 | `a326f3b` | Maç kartlarında tür/format etiketi, filtre çubukları, detayda diziliş ve kadro |
| Bölüm 1 | `47a926f` | `components/ListingBoard.tsx`: Rakip, Oyuncu, Aktiviteler ve Arama ekranlarında etiketli ilanlar |
| Bölüm 1 | `48fd4a2` | Kabul edilen takım karşılaşması `listing_type='opponent'` ile yazılır |

Tüm commit'lerde `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` satırı var.

### Bölüm bazında kısa özet
- **İlan türleri.** Üç tür: `individual` (Oyuncuyum, maç arıyorum), `opponent` (Rakip arıyorum), `players` (Oyuncu arıyorum). İlk adım tür seçimi. Her türün alanları ayrı. Rakip ilanı için sahibi olunan takım zorunlu; takım yoksa "Takım oluştur" yönlendirmesi.
- **Format.** 5v5 ile 11v11 arası seçilir; `match_format` kolonuna yazılır. Eski satırlarda `type` metninden ("7v7") okunur.
- **Diziliş ve kadro.** Her format için yalnızca o formatın dizilişleri listelenir. Takım ilanında saha görünür; "Kadroyu otomatik doldur" kaleciyi önce, sonra pozisyon eşleşmesini, kalanları boş slotlara yerleştirir. Her slot elle değiştirilebilir/boşaltılabilir; aynı oyuncu iki slota konamaz. Kadro trigger'ı sunucuda yalnızca takım üyelerinin yazılmasına izin verir.
- **Ücret.** Ücretsiz/ücretli seçimi; ücretli ilanda kişi başı tutar ve kısa not. Ödeme disclaimer'ı oluşturma ekranında ve detayda gösterilir. Ödeme butonu, kart formu, IBAN yok.
- **Davet.** Benzersiz 8 karakterlik kod (sunucuda üretilir). Kayıtta isteğe bağlı kod, kayıttan sonra 7 gün içinde Ayarlar ve Davet ekranından giriş. Paylaşım metni TR/EN, yalnızca `https://www.getfootbally.com`.

## b) Varsayılan kararlar (değiştirmek için)

1. **`listing_type` varsayılanı `'players'`.** Mevcut satırlar "Oyuncu arıyorum" olur; bu mevcut davranışa denk. Değiştirmek için: `supabase/migrations/20261115100000_listing_types_format_lineup.sql` (yeni bir migration ile default değiştirilir).
2. **Ücret için yeni `is_paid` / `fee_per_person` kolonu açılmadı.** `team_payment` web tarafında kişi başı ücret olarak yazılıyor (`price_per_player`); aynı anlam olduğu için kullanıldı. `is_paid` = `team_payment > 0`. Yeni kolon yalnızca `fee_note` (text, null).
3. **`required_players` anlamı.** Bireysel ilan: 1. Rakip ilanı: format (karşı takım). Oyuncu ilanı: eksik oyuncu sayısı (spec'e göre). Eski `players` satırlarında değer hâlâ toplam kadro kapasitesidir; yani eski ve yeni satırlarda aynı kolonun anlamı farklı. Liste ekranı bunu düzeltmeye çalışmaz.
4. **Bireysel ilanda pozisyonlar** `needed_positions` kolonuna yazılır; anlamı "oynayabileceğim pozisyon". Yeni kolon açılmadı.
5. **Konum (saha) tüm türlerde zorunlu.** Bireysel ilanda da istendi; alan "tercih ettiğin saha" olarak düşünülebilir.
6. **Kadro yalnızca takım kapsamında.** Organizatör (takımsız) ilanında diziliş seçilebilir ama kadro yazılamaz (`lineup_requires_team`).
7. **Kabul edilen takım karşılaşması** (`TeamHomeScreen`) `listing_type='opponent'` ile yazılır; aksi halde varsayılan "Oyuncu" olurdu.
8. **Davet — kullanım penceresi** `auth.users.created_at` üzerinden 7 gün.
9. **Davet — kod alfabesi** 31 karakter: A–Z (I, L, O hariç) + 2–9. Kod sunucuda üretilir ve istemcide değiştirilemez.
10. **Davet — niteleme** davet edilenin `profiles.profile_completed_at` dolduğu anda (trigger). Kod, profil zaten tamamlanmışsa kullanım anında nitelenir.
11. **Davet — ödül grubu.** Her 7 geçerli davette 30 gün; ödül mevcut aktif aboneliğin bitişine eklenir (üst üste). Her grup için benzersiz indeks (`referrals_referrer_batch_key`) ile en fazla bir kez.
12. **Davet — kısıtlı davet eden.** Grup numarası işlenir ama Premium verilmez (kısıtlı hesaba ödül kuralı). Bu, grubun tüketildiği ama ödülün verilmediği anlamına gelir. Alternatif: grubu işlemeden bırakmak; bu durumda ödül bir sonraki nitelemede de verilmez. Mevcut davranış bilinçli bir seçim, test edilmedi (bkz. h).
13. **Davet — ilerleme.** `qualified % 7`. 7. davetten sonra 0/7 gösterilir (yeni grup başlar).
14. **Davet — bildirim metni.** "7 kişi davet ettin. 1 aylık Premium hediyen tanımlandı." spec'te sabit olduğu için 14. davette de aynı metin kullanılır.
15. **Kayıt — e-posta doğrulaması.** Oturum yoksa kod yerelde (AsyncStorage) saklanır ve Davet ekranında önceden dolu gelir; sunucuda "bekleyen davet" tablosu yok.
16. **Bildirim yönlendirmesi** için yeni ekran adı `referral` (App.tsx `renderScreen`).
17. **Premium görevi tabanı.** `compute_profile_task_breakdown` canlı gövdesi temel alındı, yalnızca koşul değişti. Repodaki `20261114120100` dosyası canlıdan farklıydı; yeniden uygulanmadı.

## c) Canlıya uygulanan migration'lar

Sıra ve doğrulama (`apply_migration` ile; yalnızca ekleme, DROP/UPDATE/DELETE yok, test verisi bırakılmadı):

1. `20261115100000_listing_types_format_lineup.sql` → canlı adı `listing_types_format_lineup`.
   - Kolonlar: `listing_type` text NOT NULL default `'players'`; `match_format`, `formation`, `lineup`, `fee_note` nullable.
   - Kısıtlar: `matches_listing_type_check`, `matches_match_format_check`, `matches_formation_check`, `matches_lineup_shape_check`.
   - Trigger: `matches_validate_lineup_trg` (BEFORE INSERT/UPDATE OF lineup, team_id).
   - Fonksiyon: `matches_validate_lineup` secdef, `search_path=public, pg_temp`, anon/authenticated çalıştıramaz.
   - `matches` satır sayısı 1 (değişmedi).
2. `20261115100100_referral_system.sql` → canlı adı `referral_system`.
   - `referral_codes`, `referrals`: RLS açık, politika sayısı 0 (yalnızca RPC erişimi).
   - `get_or_create_my_referral_code`, `redeem_referral_code`, `get_my_referral_summary`: secdef, `search_path=public, pg_temp`, anon çalıştıramaz, authenticated çalıştırabilir.
   - `grant_referral_premium`, `qualify_referral_for_user`, `referrals_on_profile_completed`: anon ve authenticated çalıştıramaz.
   - Trigger: `profiles_referral_qualify`.
   - Satır sayıları: `referral_codes=0`, `referrals=0`, `referral` aboneliği=0.
3. `20261115100200_profile_task_exclude_referral.sql` → canlı adı `profile_task_exclude_referral`.
   - Doğrulama: `compute_profile_task_breakdown` tanımında `not in ('reward', 'referral')` var.

Uygulanmayan migration: yok. Migration dosyalarında başta bulunan `drop constraint if exists` / `drop trigger if exists` satırları kuralları gereği kaldırıldı; canlıda hiçbir DROP çalıştırılmadı.

## d) tsc ve test sonuçları

- `npx tsc --noEmit`: 0 hata (son çalıştırma).
- `npm test`: **267 test, 267 geçti, 0 başarısız** (formations 11, matchListing 14, referral 9 test bloğu; profileTasks eklemeleri dahil).
- Yerel SQL testi (`bash supabase/tests/local/run_local.sh`, PostgreSQL 17, boş veritabanı): migration zinciri temiz; **61 kontrol geçti**. Kapsam: kendi kodu, ikinci kullanım, 7 gün sınırı (6 gün geçer, 8 gün reddedilir), kısıtlı hesap ve kısıtlı davet eden, tamamlanmamış profil sayılmaz, profil sonradan tamamlanınca sayılır, 6→7 geçişi (30 gün), 14. davet (ikinci grup, üst üste), çift nitelemede ödül yok, aynı grup ikinci kez işaretlenemez, premium görevi referral aboneliğini saymaz, kadro trigger'ı (takım dışı, takımsız, çift oyuncu), format/diziliş/listing_type kısıtları, istemci yetkileri.
- Paralel yarış testi: aynı davet edene 7 eşzamanlı davet → 7 geçerli davet, **1** grup ödülü, **1** referral aboneliği.
- ESLint: yeni dosyalarda 0 hata (`lib/formations.ts`, `lib/matchListing.ts`, `lib/referral*.ts`, `components/FormationPitch.tsx`, `components/ListingBoard.tsx`, `screens/ReferralScreen.tsx`, `screens/CreateMatchScreen.tsx`). `MatchScreen.tsx`'teki iki hata ve `FindOpponentScreen.tsx` 208. satırındaki hata değişiklikten önce de vardı (MatchScreen'de `git stash` ile doğrulandı).

## e) Build

- **Build — başarılı.** `eas build -p ios --profile production --non-interactive` tamamlandı. Build numarası **7 → 8** (`autoIncrement`; `app.json` / `eas.json` elle değiştirilmedi). Build'i EAS otomatik artırdı.
  - EAS build bağlantısı: https://expo.dev/accounts/osmantemur/projects/footbally/builds/5d8faaae-65a4-4a74-b09a-bd67fd9b7f21
  - IPA: https://expo.dev/artifacts/eas/prq6b8wMkdp2lMixCfiI5aEKiei2qMDDKibqOrsjDck.ipa
  - Credential: uzak (EAS) iOS credential'ı kullanıldı; dağıtım sertifikası ve provisioning profile geçerli (son 2027-11-09).
- **Submit — başarılı (yalnızca TestFlight'a yükleme).** `eas.json` → `submit.production.ios.ascAppId = "6832729841"` (commit `97a72b7`). `eas submit -p ios --latest --non-interactive` build 8'i App Store Connect'e yükledi. Submission: https://expo.dev/accounts/osmantemur/projects/footbally/submissions/66e8e4e1-eb49-4587-b3e5-9fbf3e6c1753 . TestFlight: https://appstoreconnect.apple.com/apps/6832729841/testflight/ios . Apple işlemesi bitince e-posta gelir. İnceleme gönderimi, sürüm ve metadata değişikliği yapılmadı.
  - İlk denemede (`ascAppId` eksikken) submit durmuştu; kimlik eklenip ikinci denemede başarılı oldu.
- Build ile ilgili çıktılar: `scratchpad/eas_build_1.log`, `scratchpad/eas_submit_1.log` (geçici dosyalar).


## f) Telefonda elle test edilecekler

1. **Kayıt.** Davet kodu alanı boşken kayıt olur. Geçersiz kod hata mesajı verir. Geçerli kod ile kayıt sonrası "14 günlük Premium" onayı gelir. E-posta doğrulamalı kayıtta kod, Davet ekranında önceden dolu gelir.
2. **Davet Et (Profil).** Kod görünür; kopyala ve paylaş çalışır (metin TR/EN, web sitesi bağlantısı). Davet edilen sayısı, ilerleme (x/7), kazanılan ay sayacı güncellenir.
3. **Ayarlar → Davet kodu gir.** 7 gün içindeki hesapta giriş açık; 7 günden eski hesapta hata mesajı. Kendi kodunu girince hata.
4. **Yeni ilan — tür adımı.** Üç tür kartı açılır. "Rakip" için takımı yoksa "Takım oluştur" görünür.
5. **Yeni ilan — format.** 5v5 ... 11v11 seçilir. Diziliş listesi yalnızca seçilen formatın dizilişlerini gösterir.
6. **Yeni ilan — kadro.** Takım seçilince kadro yüklenir. "Kadroyu otomatik doldur" kaleciyi kaleci slotuna koyar. Bir slota dokununca oyuncu seçilir; aynı oyuncu iki slotta görünmez. "Boş bırak" çalışır. Bireysel ilanda diziliş/kadro bölümü yoktur.
7. **Yeni ilan — ücret.** Ücretli seçilince tutar ve not alanları açılır; ödeme disclaimer'ı görünür. Tutar boşsa hata.
8. **İlan listesi.** Maç kartında tür, format ve "Ücretli" rozeti görünür; tür ve format filtreleri çalışır. Eski ilanlar (mevcut 1 satır) görünmeye devam eder.
9. **Detay.** Diziliş, kadro (isimler) ve ücret/not görünür.
10. **Rakip ilanları / Oyuncu ilanları / Aktiviteler / Arama.** Etiketler ve tür filtresi çalışır.
11. **Bildirimler.** Davet onayı, "(x/7)" ve "7 kişi davet ettin" bildirimleri gelir; dokununca davet ekranı açılır.
12. **Premium.** Referral aboneliğiyle "Premium'a geç" görevi tamamlanmaz (profil puanı).

## g) Web sitesinde yapılması gereken karşılık değişiklikler

- **İlan türleri.** Web ilan oluşturduğunda `listing_type` yazmaz; yeni web ilanları varsayılan olarak "Oyuncu arıyorum" görünür. Web'in tür seçimini eklemesi ve listede etiketlemesi gerekir.
- **Format.** Web `type` metnini ("7v7") yazmaya devam ediyor; bu uyumlu. İsterse `match_format` de yazılabilir.
- **Diziliş ve kadro.** Web ilan detayında `formation` ve `lineup` (`[{slot, user_id, name}]`) gösterilmeli; `lineup` yalnızca takım üyeleriyle yazılabilir (trigger).
- **Premium sayımı (önemli).** Web'de abonelik sayan her yer `plan = 'reward'` gibi `plan = 'referral'` kayıtlarını da hariç tutmalı (veya "ücretli" saymamalı). Aksi halde davet ödülü ücretli abonelik gibi görünür.
- **Davet.** Web'de kayıt akışına isteğe bağlı kod alanı eklenecekse aynı RPC kullanılmalı (`redeem_referral_code(p_code)`); kural değişikliği yok.
- **Bildirimler.** `notifications.screen = 'referral'` yeni bir değer; web bildirim yönlendirmesinde bu değeri tanımalı.
- **Ücret disclaimer'ı.** Ücretli ilan gösteriminde "Ödeme taraflar arasında yapılır…" metni web'de de yer almalı.

## h) Doğrulanamayan veya tahmin edilen her şey

- **Yerel test ortamı.** Yerel PostgreSQL testleri canlı şemanın tam dökümü yerine, canlı fonksiyon tanımlarından türetilmiş bir iskelet (stub) ile çalıştı. Gerçek `matches` ve `profiles` RLS politikaları yerelde birebir yok. Canlı doğrulama yalnızca SELECT ile yapıldı.
- **Kadro trigger'ı ve yetkiler** canlıda uçtan uca denenmedi; yerel testte doğrulandı.
- **Kısıtlı davet eden senaryosu** yalnızca kullanım anında test edildi. Nitelenme anında davet edenin sonradan kısıtlanması test edilmedi (bkz. b-12).
- **Paralel kullanım.** Yarış testi "aynı davet edene 7 eşzamanlı davet" senaryosunu kapsar. Aynı davetlinin iki eşzamanlı kullanımı yerelde paralel çalıştırılmadı; tasarım gereği `referred_id` benzersiz ve davetli satırı kilitlenir.
- **Mesaj metni.** "7 kişi davet ettin…" bildirimi 14. ve sonraki gruplarda da aynı metni gösterir (spec'e uygun, ama anlamı tam değil).
- **Eski `required_players` anlamı.** Eski satırlar toplam kapasite, yeni `players` satırları eksik sayı tutar. Liste ekranında doluluk gösterimi bu farkı görmez.
- **Kayıt — oturum varsayımı.** E-posta doğrulaması kapalıysa `signUp` oturum döndürür; kod kayıt sonrası hemen kullanılır. Bu varsayım canlıda test edilmedi.
- **Cihaz testi yok.** Bu raporda ekran düzeni, klavye davranışı ve kadro seçici dokunma akışı yalnızca kodla doğrulandı; cihazda denenmedi.
- **Güvenlik danışmanı (canlı).** Yeni `referral_codes` ve `referrals` tabloları için "RLS açık, politika yok" bilgi uyarısı çıkar; bu bilinçli (yalnızca RPC). Yeni RPC'ler authenticated için çalıştırılabilir; anon çalıştıramaz. Mevcut `can_view_post` fonksiyonunun anon tarafından çalıştırılabilmesi bu işin kapsamında değildi, değiştirilmedi.
- **Repo ile canlı farkı.** `20261114120100_profile_task_score.sql` ile canlı `compute_profile_task_breakdown` gövdesi farklıydı (yorumlar ve düzen). Canlı esas alındı; repodaki dosya düzeltilmedi.
