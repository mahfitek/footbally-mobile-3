# Gece raporu: profil görevleri, AI CV, video, rozet beklemesi

Kapsam: `feat/apple-iap` dalı. Yazılan migration'lar **uygulanmadı**; canlı veritabanında yalnızca SELECT çalıştırıldı.
Yazım işlemi, DDL, edge function deploy, eas build/submit yapılmadı. package.json, app.json, eas.json, lib/iap.ts,
screens/PremiumScreen.tsx ve supabase/.temp/cli-latest değişmedi.

## a) Maddeler: kök neden, değişiklik, commit

**1. Kalan sahte metinler.** Kök neden: `api/mockData.ts` içinde sahte oyuncu, maç, fırsat, mesaj ve bildirim
dışa aktarımları vardı; yalnızca `activityFiltersData` içe aktarılıyordu. Ana sayfadaki "%3 artır" iddiası sabitti.
Değişiklik: import edilmeyen dışa aktarımlar silindi, yalnızca filtre etiketleri kaldı; "%3" ifadesi iki dilde kaldırıldı.
Grep ile "Galatasaray", "Bundesliga scout", "Mehmet Yılmaz", "Hans Mueller", "Ahmet Demir", "Online Scout", "12 scout",
"Profil %84", "12 Online", "3 Yeni maç", "7 Davet", "%3 artır" aranıyor: sonuç yok. Commit: `452bab2`.

**2. AI analiz görevi (15 puan).** Kök neden: analiz tamamlandığında video kaydı `ai_video_jobs.video_url` alanında
kalıyor, `profiles.video_urls` ise güncellenmiyordu. Canlı şema: `ai_video_jobs` kolonları `user_id`, `video_url`,
`status`; `status` değerleri `completed`, `pending`, `in_review`. Değişiklik: yeni migration'da `ai_video_jobs`
üzerinde trigger. Analiz `completed` olduğunda `video_url` (yalnızca video uzantılı, `.mp4 .mov .m4v .webm .3gp`)
`profiles.video_urls` listesine bir kez eklenir; admin tarafından kaldırılmış medya atlanır. Edge function değişmedi.
Tamamlanma kontrolü aynı kalır (`completed` analiz). Commit: `d12f0e4` (trigger), `517d5af` (video uzantısı filtresi).

**3. Maç videosu görevi (20 puan).** Kök neden: uygulamada video yükleme yoktu. Fotoğraf galerisi `player_gallery`
tablosuna ve `videos` bucket'ına yazıyor; `profiles.photo_urls` güncellenmiyor (sapma: madde metni `photo_urls` diyordu).
Değişiklik: galeri bölümünde "Video ekle" döşemesi (aynı stil). Video herkese açık `profile-media` bucket'ında
`<uid>/videos/<zaman>.<uzantı>` yoluna `upsert: false` ile yüklenir; listeye web sitesiyle aynı biçimde açık bağlantı
(`getPublicUrl`) eklenir, skor yenilenir. Tür (MP4, MOV, WebM, M4V) ve boyut (200 MB) yüklemeden önce kontrol edilir,
TR/EN toast gösterilir. Commit: `acefcf4`. (İlk sürümdeki depolama yolu yazımı bu commit ile değişti.) Trigger kontrolü: `protect_profile_trusted_columns`
`video_urls`'i kapsamıyor; `guard_removed_profile_media` yalnızca admin tarafından kaldırılmış medyayı engelliyor.
İstisna eklenmedi. Yükleme limiti yok. Commit: `5ded3da`.

**4. AI CV görevi (15 puan).** Kök neden: yazım yolu yoktu, `profiles.ai_cv_text` hiçbir yerden yazılmıyordu.
Değişiklik: `lib/aiCv.ts` deterministik metin üretiyor (ad, pozisyon, yaş, boy, kilo, ayak, konum, kulüp, profil
skoru, AI puanı, güçlü yönler, hakkımda; boş alanlar atlanır; 4000 karakterde kesilir). Yapay zeka çağrısı yok.
Profil kartına "AI CV oluştur" düğmesi eklendi; metin `save_my_ai_cv(p_text)` RPC'si ile yazılır
(`security definer`, `auth.uid()`, boş metin ve 4000 karakter kontrolü). Trigger `ai_cv_text`'i korumadığı için RPC
zorunlu değil; yine de düğme RPC'yi kullanır. Commit: `9b2ddbf` (üretici), `d12f0e4` (RPC), `1878993` (düğme ve
istemci sarmalayıcısı).

**5. Aylık limit aşılınca rozet.** Kök neden: limit doluyken rozet `claimed_badge_keys`'e ekleniyor ve gün
verilmeden kapanıyordu. Değişiklik: rozetin tüm günleri kalan limite sığmıyorsa rozet işaretlenmez, gün ve
bildirim verilmez; sonraki skor yenilemesinde ve yeni ayda tekrar denenir. Commit: `a79ef51`.

**6. "Premium'a geç" görevi.** Kök neden: `plan <> 'reward'` dışındaki her abonelik sayılıyordu. Canlı veride
yönetici hediyeleri `amount` boş bırakılıyor. Değişiklik: sayılması için etkin, süresi dolmamış, `plan <> 'reward'`
ve (`amount > 0` veya `payment_provider = 'apple'` veya `plan = 'admin'`) olmalı. Yönetici hediyesinin sayılması canlıda
elle uygulanmıştı; migration ve istemci kuralı buna göre eşitlendi (commit `a56a876`). Aynı kural
`lib/profileTasks.ts` içinde `countsAsPaidPremium` olarak tanımlı ve test ediliyor. İlk commit: `07f88f6`.

**7. Maç ve başvuru görevleri.** Kök neden: `match_applications` satırı durumdan bağımsız sayılıyordu. Canlı
değerler: `status` yalnızca `applied` (11 satır); onaylı bir durum yok. Değişiklik: `rejected`, `cancelled`,
`canceled`, `withdrawn`, `declined` hariç her başvuru sayılır (küçük harf karşılaştırması). Onaylı durum yokken
"başvuru yeterli" kuralı geçerli. `countsAsApplication` istemci tarafında tanımlı ve test ediliyor. Commit: `07f88f6`.

**8. Skor yenileme hatası.** Kök neden: hata yalnızca `console.warn` ile loglanıyordu. Değişiklik: ProfileScreen,
HomeScreen ve BadgesScreen başarısız yenilemede "Puan güncellenemedi, daha sonra tekrar deneyin." toast'u
gösteriyor (TR/EN). Profil kaydında skor uyarısı başarı mesajının yerine geçiyor. Loglama sürüyor. Commit: `55bfd39`.

**9. Mevcut skorlar.** İlk yenilemede yeniden hesaplanması kabul edildi; ek işlem yok.

**10. Yerelleştirme.** Kök neden: önceki turda mevki ve ayak düzeltilmişti; kalan bir eksik yoktu. Düzenleme
ekranında `t()` dışında kalan metinler yalnızca geliştirici logları ve yorumlar. Gösterim çevirisi için kapsam
genişletilmedi; cinsiyet seçimi ekranda yok. Şehir/ilçe Türkiye için olduğu gibi kaldı. Kod değişikliği yok;
eklenen tüm anahtarlar TR/EN için test ediliyor (`c305653`).

## b) Varsayılan kararlar ve değiştirme notları

- **Madde 2, analiz kapsamı:** Analiz ekranı yalnızca görüntü (`type: 'image'`) gönderiyor. Görüntü analizleri
  video listesine girmez (uzantı filtresi). AI analiz görevi yine görüntü analizleriyle tamamlanır. *Değiştirmek için:*
  `add_video_from_completed_analysis` içindeki uzantı kontrolünü kaldırın.
- **Madde 3, depolama ve kayıt:** Video `profile-media` deposunda herkese açık bağlantıyla `profiles.video_urls`
  içinde saklanıyor (fotoğrafların `player_gallery` kaydından farklı). Video listesi profil ekranında gösterilmiyor;
  uygulamada `video_urls` okuyan ekran yok. *Değiştirmek için:* video listesini galeri gibi göstermek ayrı bir iş.
  `ai_video_jobs` trigger'ı hâlâ depolama yolunu (açık bağlantı değil) yazıyor; analiz yalnızca görüntü olduğu için
  bu pratikte tetiklenmiyor.
- **Madde 4, CV yazımı:** Düğme RPC kullanıyor. `ai_cv_text` istemcinin doğrudan güncellemesine bilerek açık: web
  sitesi bu alanı doğrudan güncelliyor. Kapatmak için `protect_profile_trusted_columns` içine eklenir (web sitesini
  de etkiler).
- **Madde 5, bekleme kuralı:** Kısmi gün verilmez; rozet ya tam günleriyle verilir ya da beklemede kalır. *Değiştirmek
  için:* `if v_grant < r.reward_days` koşulunu kaldırıp kalan günleri vermek.
- **Madde 6, admin hediyeleri:** Yönetici hediyesi (`plan='admin'`) artık "Premium'a geç" görevini tamamlıyor; canlı
  kuralla eşitlendi. *Değiştirmek için:* koşuldan `or lower(coalesce(s.plan, '')) = 'admin'` ifadesini çıkarın ve
  istemci yardımcısını buna göre güncelleyin.
- **Madde 7, başvuru statüleri:** Tabloda onaylı bir statü olmadığı için olumsuz olmayan her başvuru sayılıyor.
  *Değiştirmek için:* onaylı statüler tabloya eklenince "maça katıl" için onaylı statüyü şart koşmak.
- **Madde 8, toast metni ve öncelik:** Kayıt başarılıysa ama skor yenilenemediyse toast skor uyarısı oluyor.
  *Değiştirmek için:* iki mesajı birleştirmek.

## c) Değişen dosyalar

- `api/mockData.ts`: yalnızca `activityFiltersData` kaldı.
- `lib/i18n.ts`: ana sayfa ipucu düzeltmesi; yeni görev, AI CV, video, skor uyarısı ve rozet beklemesi anahtarları (TR/EN).
- `lib/profileTasks.ts`: `countsAsApplication`, `countsAsPaidPremium`, olumsuz durum listesi.
- `lib/aiCv.ts` (yeni): CV üreticisi.
- `lib/profileQueries.ts`: `saveAiCv` (RPC sarmalayıcısı).
- `lib/rewards.ts`: değişiklik bu turda yok.
- `screens/ProfileScreen.tsx`: video ekleme, AI CV düğmesi, skor uyarısı toast'u.
- `screens/HomeScreen.tsx`, `screens/BadgesScreen.tsx`: skor uyarısı toast'u.
- `supabase/migrations/20261114120000_profile_badge_rewards.sql`: bekleme kuralı.
- `supabase/migrations/20261114120100_profile_task_score.sql`: premium ve başvuru kuralları.
- `supabase/migrations/20261114120200_profile_ai_video_cv.sql` (yeni): analiz→video trigger'ı, `save_my_ai_cv`.
- Testler: `__tests__/aiCv.test.ts` (yeni), `__tests__/i18nOvernightKeys.test.ts` (yeni), `__tests__/profileTasks.test.ts`, `__tests__/profileQueries.test.ts`.
- `docs/overnight-report.md` (bu dosya).

## d) Migration'lar

Uygulama sırası (önce kontrol, sonra uygula):
1. `supabase/migrations/20261114120000_profile_badge_rewards.sql`
2. `supabase/migrations/20261114120100_profile_task_score.sql`
3. `supabase/migrations/20261114120200_profile_ai_video_cv.sql`
4. `supabase/migrations/20261114120300_premium_expiry_sync.sql` (süresi dolan premium'ları 15 dakikada bir kapatır;
   `pg_cron` eklentisi gerektirir ve `cron.schedule` çağrısı içerir; yerel testte kapsanmadı)

Yerel test: PostgreSQL 16.2 (geçici, proje dışında), Supabase şemasını taklit eden bir stub üzerinde üç dosya
sırayla uygulandı. Senaryo betiği: `C:\Users\miyas\AppData\Local\Temp\claude\0a528e0ac0c24724\7c5a844a-05d1-43df-9a82-a4ddb6d914c9\scratchpad\run_sql_checks_v2.py`
Sonuç: 56 kontrol geçti. Kapsanan: puan toplamı 100, rozet bekleme ve yeni ayda verilme, aylık 7 gün limiti,
bildirim yalnızca gün verilince, premium ve başvuru kuralları, analiz→video trigger'ı (uzantı ve kaldırılmış medya),
`save_my_ai_cv` (boş, 4000 karakter, kimliksiz), istemci korumalı alanları. **Kapsanmayan:** gerçek RLS politikaları ve
Supabase'in tam şeması; uygulamadan önce canlıda bir kez test edilmeli.

## e) tsc ve npm test

- `npx tsc --noEmit`: 0 hata.
- `npm test`: 226 test, 226 geçti, 0 başarısız.

## f) Uygulamada elle test edilecekler

- **AI CV oluştur:** Profil ekranında düğmeye basın; `profiles.ai_cv_text` dolmalı, "AI CV" görevi tamamlanmalı,
  skor güncellenmeli.
- **Video ekle:** Galeri bölümündeki "Video ekle" ile bir video seçin; `profiles.video_urls` güncellenmeli, "Maç
  videosu" görevi tamamlanmalı.
- **AI analiz tamamlanınca:** Video uzantılı bir analizin yolu video listesine eklenmeli. Görüntü analizi eklememeli,
  ama "AI analiz" görevini tamamlamalı.
- **Rozet bekleme:** Ay sayacı dolu bir hesapta rozet verilmemeli; yeni ayda (veya `reward_premium_month_key`
  değiştirildiğinde) verilmeli. Bildirim yalnızca gün verilince gelmeli.
- **Ödül aboneliği:** Yalnızca `plan='reward'` olan hesapta "Premium'a geç" görevi tamamlanmamalı.
- **Skor uyarısı:** Ağ kesilirken profil kaydedilirse "Puan güncellenemedi..." toast'u çıkmalı.
- **İngilizce:** Pozisyon, ayak ve AI CV etiketleri İngilizce görünmeli; kayıtlı değer Türkçe kalmalı.

## g) Açık kalanlar ve tahminler

- **Migration'lar uygulanmadı.** Web repo'daki resmi migration klasörüyle senkron tutulmaları gerekebilir.
- **Mevcut skorlar** ilk yenilemede yeni formüle göre yeniden yazılır (madde 9 kararı).
- **Video yolu formatı:** `profiles.video_urls` depolama yolu saklıyor; takım tarafındaki `video_urls` ise URL bekliyor olabilir.
  Gösterim eklendiğinde bu tutarlı hale getirilmeli.
- **Video moderasyonu:** Yüklenen videolar için moderasyon yok; admin kaldırması dışında kontrol yok.
- **SDK notu:** İstekte "Expo SDK 54" yazıyor, `AGENTS.md` SDK 58 diyor. Bu turda bir etkisi olmadı.
