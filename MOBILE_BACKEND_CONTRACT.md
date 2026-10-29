# Mobil ↔ Backend Sözleşmesi

Hedef okuyucu: Web/Backend (Supabase) oturumu.
Bu dosya mobil uygulamanın ihtiyaç duyduğu backend yüzeyini listeler. Canlı Supabase şemasına **bu repo tarafından uygulanmaz**; yalnızca istek olarak belgelenir. Proje ref: `mohsosllyfgevvvpbkkn`.

Son canlı kontrol: **2026-10-29**. Kontrol yalnızca okuma yoluyla yapıldı: PostgREST OpenAPI kökü (service_role) ve anonim (publishable) anahtarla okuma denemeleri. Hiçbir migration uygulanmadı, hiçbir veri değiştirilmedi.

Durum sütunu anlamı:
- **Canlıda var** — 2026-10-29 OpenAPI kökünde görüldü.
- **Canlıda yok** — 2026-10-29 OpenAPI kökünde yok.
- **Doğrulanmadı** — mobil çağırıyor, canlı varlığı kontrol edilemedi.
- **Yok** — mobilde UI var ya da planlandı, backend hiç yok.

---

## 0. Öncelikli güvenlik bulguları (2026-10-29, DB değişikliği gerekiyor)

Bunlar mobil koddan bağımsızdır. Publishable anahtar mobil pakette herkese açıktır; yani aşağıdaki okumalar uygulamayı indiren herkes için mümkündür. **Düzeltme üretim DB değişikliği gerektirir; kullanıcı onayı olmadan yapılmadı.**

| # | Tablo | Anonim okuma sonucu | Risk | Önerilen düzeltme |
|---|---|---|---|---|
| S1 | `users` | **200, 38 satır**. Kolonlar: `id, email, full_name, position, city, club, score, role, is_active, created_at, last_login` | **Kritik.** Kullanıcı e-postaları ve rol bilgisi herkese açık. Mobil bu tabloyu kullanmıyor (`grep` ile doğrulandı). | `REVOKE SELECT ON public.users FROM anon, authenticated;` ya da RLS açıp yalnızca admin/service politikası. Web tarafında kullanım varsa önce orada doğrulanmalı. |
| S2 | `teams` | **200, 9 satır**. Ban kolonları dahil 37 kolon: `account_status, banned_until, ban_is_permanent, ban_reason, banned_by, banned_at, owner_id` | **Yüksek.** Takım ban gerekçeleri ve moderatör kimlikleri herkese açık. Mobil kolon daraltması yalnızca istemci tarafında; DB korumalı değil. | Column-level grant: anon ve authenticated için ban kolonlarını `REVOKE`; sahibi kendi ban durumunu okuyabilsin diye `get_my_account_status()` gibi bir RPC kullanılsın. |
| S3 | `profiles` | 401 (`permission denied`) | Doğru. Anonim erişim kapalı. | Korunmalı. |
| S4 | `nf_merchant_bank_accounts`, `nf_payment_orders`, `content_reports` | 401 | Doğru. | Korunmalı. |
| S5 | `messages`, `admins`, `subscriptions`, `premium`, `payment_requests`, `ban_requests`, `profile_reports` | 200, 0 satır | Boş ya da RLS ile filtrelenmiş olabilir; ayırt edilemedi. | RLS politikaları gözden geçirilmeli. |

Not: `teams` ve `profiles_public`'in genel okunabilir olması ürün gereği olabilir; ancak ban ve moderasyon kolonları bu kapsamda değildir.

---

## 1. RPC'ler

| Ad | Mobil tüketici | Beklenen davranış | Durum |
|---|---|---|---|
| `get_my_profile()` | `lib/profileQueries.ts` → `ownProfile` | Yalnızca `auth.uid()` satırını döner. Parametre almaz. Hassas kolonlar dönmez; mobil yalnızca açıkça istediği alanları okur. | **Canlıda var** (2026-10-29). Kolon kapsamı doğrulanmadı. |
| `clear_my_expired_ban()` | `profileQueries.clearExpiredBan` → `accountAccess.clearExpiredBan('profiles')` | Süresi dolmuş kendi (profil) banını temizler. | **Canlıda var** (2026-10-29). |
| `refresh_my_score()` | `profileQueries.refreshMyScore` → `ProfileScreen` | Kullanıcının kendi skorunu hesaplar ve **yazar**. `profiles.score` istemciden yazılmaz. Hata mobilde yalnızca loglanır; kullanıcıya başarı gösterilmez. | **Canlıda yok** (2026-10-29). |
| `nf_create_footbally_monthly_order(...)` | `components/PremiumEftSection.tsx` | Premium EFT siparişi açar; ödeme aktivasyonu yok. | Doğrulanmadı |
| `get_my_account_status()` | — (önerilen) | Kendi hesap durumu (profil veya takım), ban alanlarını yalnızca sahibine döndürür. Mobil ban kontrolünü bu RPC ile yapmalı (bkz. §4.2). | **Canlıda var** (2026-10-29), şekli doğrulanmadı |
| `account_deletion_blockers(p_user_id uuid)` | — | Web tarafının silme engelleyicileri. Kendi kullanıcı için çağrılıyor olabilir. | **Canlıda var**; `delete-account` içinde kullanılması önerilir (bkz. §3.1). |
| `account_deletion_storage_objects(p_user_id uuid)` | — | Silinecek storage nesnelerini listeler. | **Canlıda var**; `delete-account` içinde kullanılması önerilir. |
| `update_my_contact(p_city, p_full_name, p_phone)` | — (mobil kullanmıyor) | Kendi iletişim bilgisini günceller. | **Canlıda var**. |
| `report_content_media(p_media_url, p_reason)` | — (mobil kullanmıyor) | Medya içeriği şikâyeti. | **Canlıda var**. Bkz. §3.2. |
| `submit_report(...)` | `lib/reports.ts` → `ReportScreen` | Kullanıcı/içerik şikâyeti. | **Canlıda yok.** Mobil RPC yoksa "kullanılamıyor" gösterir. |

Mobilin kendi profil alanı için `profiles.select('*')` kullanılmaz. Diğer tablolar için mobil açık kolon listeleri kullanır (`lib/columns.ts`).

---

## 2. Public view'lar

| View | Kullanım | Kural |
|---|---|---|
| `profiles_public` | Başka kullanıcıların profili, oyuncu/scout arama | PII kolonu içermez. Eşleme anahtarı `user_id`. Canlıda var. |

Mobil, başka kullanıcı profilinde `profiles` tablosunu doğrudan okumaz (`__tests__/profileQueries.test.ts`).

---

## 3. Edge Function'lar

| Ad | Durum | Notlar |
|---|---|---|
| `analyze-video` | Repoda var (`supabase/functions/analyze-video`) | `AIAnalysisScreen` çağırır. **Videoları Google Gemini API'ye gönderir.** Gizlilik politikası ve Data Safety'de belirtilmeli (bkz. `STORE_PREP.md`). |
| `notify-event` | Repoda var + taslak migration `supabase/drafts/20261028c_notify_event_support.sql` | Push bildirimi. `service_role` yalnızca burada. Push token'lar Expo servisine iletilir. |
| **`delete-account`** | **Yok — BLOKÖR** | App Store 5.1.1(v), Google Play hesap silme zorunluluğu. Sözleşme §3.1. |
| **`submit_report`** | **Yok — BLOKÖR** | Şikâyet RPC'si. Sözleşme §3.2. |

### 3.1 `delete-account` (bloker)

Mobil `supabase.functions.invoke('delete-account', { body: {} })` çağırır. `lib/accountDeletion.ts` yalnızca şu yanıtlara güvenir:

| Durum | Sunucu yanıtı | Mobil davranışı |
|---|---|---|
| Başarı | HTTP 200, gövde `{ "deleted": true }` | Oturum kapatılır, onboarding'e dönülür. |
| Fonksiyon yok | HTTP 404 (gateway) | "Uygulama içinden kullanılamıyor" + destek e-postası seçeneği. |
| Diğer hata | 4xx/5xx veya ağ hatası | "Silinemedi, tekrar dene". |
| 200 ama `deleted` yok | — | Başarı **sayılmaz** ("failed"). |

Gereksinimler:
- Yalnızca oturumdaki kullanıcının hesabı silinir (`auth.uid()` JWT'den). İstemciden `user_id` kabul edilmez.
- Önce `account_deletion_blockers(auth.uid())` kontrol edilmeli; engel varsa hata döner, kısmi silme yapılmaz.
- Profil, mesaj, bildirim, başvuru, takım üyeliği, push token vb. ile auth kaydı silinir veya anonimleştirilir. Hangisi olduğu fonksiyon dokümantasyonunda yazılmalı.
- `account_deletion_storage_objects` ile profil fotoğrafları ve medya da silinmeli.
- Başarı yanıtı yalnızca işlem tamamlandıktan sonra dönmeli; kısmi başarıda hata.

### 3.2 Şikâyet (bloker)

Mobil `lib/reports.ts` ile `submit_report(p_target_type, p_target_id, p_reason, p_detail)` çağırır:
- `p_target_type`: `profile` | `team` | `post` | `comment` | `message`
- `p_reason`: `harassment` | `spam` | `inappropriate` | `fake` | `other`
- `p_detail`: en fazla 500 karakter, isteğe bağlı (`other` için zorunlu; istemci doğrular)
- `reporter_user_id = auth.uid()` (sunucuda, istemciden alınmaz).
- Hata kodları: RPC yoksa PGRST202 / 42883 → mobil "kullanılamıyor" gösterir; diğerleri "gönderilemedi".

Canlıda zaten var olan şikâyet tabloları (web tarafı, şemaları farklı; mobil doğrudan yazmaz):
- `profile_reports`: `reported_user_id, reported_team_id, reported_type!, reported_name!, reported_by, reported_by_name, reason!, detail, severity!, status!`
- `comment_reports`: `author_user_id, author_name!, match_id, comment!, flag_reason, status!`
- `content_reports`: `reporter_id, target_type, target_owner_id, target_team_id, media_url!, reason!, status!`
- RPC `report_content_media(p_media_url, p_reason)`.

Öneri: web/admin ekibi bunları tek bir `submit_report` RPC'sinde birleştirsin (ya da mevcut tablolara yönlendirsin). Mobil yalnızca RPC'yi bilir; tablo şemasına bağlı değildir.

---

## 4. Auth, oturum ve ban

### 4.1 Oturum
- Giriş, kayıt, e-posta doğrulama, şifre sıfırlama Supabase Auth ile yapılır.
- Token yenileme mobilde `AppState` ile yönetilir: arka planda durur, öndeyken başlar (`lib/supabase.ts`).
- Deep link: Supabase Auth ayarlarında `footbally://` şemasına izin verilmeli (`app.json` → `scheme: "footbally"`).
- Admin yetkisi asla `user_metadata` üzerinden verilmez.
- Premium durumu `subscriptions` tablosundan okunur; `user_metadata` kullanılmaz.

### 4.2 Ban kontrolü (istek)
- Mobil ban durumunu profil satırından (`get_my_profile`) ya da takım satırından (`teams.owner_id`) okur. Takım satırı anonimde okunabildiği için (bkz. S2) ban alanları sahibine özel olmalı.
- **İstek:** `get_my_account_status()` RPC'si: kendi profil veya takım ban durumunu (`account_status, banned_until, ban_is_permanent, ban_reason`) döner. Mobil bunu kullanacak şekilde güncellenecek.
- Süresi dolmuş geçici yasak mobilde izin verilir (`evaluateAccountAccess`).
- **Takım için temizleme:** İstemci artık `teams` ban kolonlarını yazmaz (kendi yasağını kaldırma riski). Takım için `clear_my_expired_team_ban()` RPC'si isteniyor; yoksa süresi dolmuş takım yasağı DB'de "banned" olarak kalır, ama mobil yine izin verir.

### 4.3 Engelleme (istek, App Store 1.2)
- Kullanıcı kötüye kullanan başka bir kullanıcıyı engelleyebilmeli. Mobil UI ve `blocks` tablosu yok.
- Önerilen: `blocks(blocker_id, blocked_id, created_at)` tablosu, `block_user(p_user_id)` ve `unblock_user(p_user_id)` RPC'leri. Engellenen kullanıcının mesajları, gönderileri ve aramada görünürlüğü filtrelenmeli.

---

## 5. RLS ve PII kuralları (mobilin varsaydığı)

- `profiles`: kullanıcı yalnızca kendi satırını okur/yazar. Anonim erişim kapalı (bkz. S3, doğrulandı).
- `profiles_public`: yalnızca PII dışı kolonlar.
- `profiles.score`: istemci yazmaz; `refresh_my_score` yazar.
- Ban kolonları (`profiles`, `teams`): istemci yazmaz.
- `teams` ban kolonları: anonim okunamamalı (bkz. S2). **Mobil varsayımı şu an karşılanmıyor.**
- `users`: anonim okunamamalı (bkz. S1). Mobil kullanmıyor.
- Yeni PII/RLS değişikliği yapılırsa `lib/profileQueries.ts` ve `lib/columns.ts` ile birlikte kontrol edilmeli.

---

## 6. Canlı şema uyumsuzlukları

### 6.1 Mobil tarafında düzeltildi (bu repo, 2026-10-29)
- `posts.highlight_start_sec / highlight_end_sec` → canlıda `highlight_start_seconds / highlight_end_seconds`. Mobil yazma ve okuma buna göre güncellendi. Önceki hâlinde YouTube paylaşımı her zaman hata veriyordu.
- `messages.receiver_id` → canlıda yok. Okunmamış sayacı `neq('sender_user_id', ...)` ile çalışıyor.

### 6.2 Canlıda eksik (ertelenmiş, kullanıcı kararı)
Bu kolonlar mobilde kullanılıyor, canlıda yok. Mobil tarafında tip açıklandı ama sorgular değiştirilmedi:
- `match_applications.result`, `match_applications.goals`
- `match_challenges.challenger_goals`, `match_challenges.opponent_goals`
- `team_members.goals`
- `teams.clean_sheets`

Eklenmesi güvenli ve additive (nullable). Yalnızca kullanıcı onayıyla uygulanmalı.

---

## 7. Uyumluluk matrisi (özet)

| Değişiklik | Eski mobil | Yeni mobil | Not |
|---|---|---|---|
| `delete-account` deploy | Destek e-postası (sahte silme kaldırıldı) | Fonksiyonu çağırır | Deploy edilene kadar "kullanılamıyor" gösterir; sahte başarı yok |
| `submit_report` deploy | — | RPC'yi çağırır | Deploy edilene kadar "kullanılamıyor" gösterir |
| `get_my_account_status` deploy | Profil satırından ban okur | RPC ile okur (istek) | Geçiş döneminde mevcut yöntem sürer |
| `teams` anonim okuma kapatılması (S2) | Takım profilleri doğrudan okur | Değişiklik gerekmez (sahibi ve sahibi olmayan okumaları ayrı RPC ile) | Column-level grant ile yapılmalı; mobil takım sorguları bozulmamalı (test edilmeli) |
| `users` anonim okuma kapatılması (S1) | Kullanmıyor | Kullanmıyor | Web tarafı etkisi doğrulanmalı |

Zorunlu güncelleme (force update) mekanizması bu repoda yok. Eklenirse sürüm kontrolü için ayrı bir sözleşme gerekir.

---

## 8. Release sonrası ortak regression planı

Web, Admin, Scout ve Mobil için aynı senaryolar:
1. Kayıt → e-posta doğrulama → giriş → profil tamamlama → skor güncellemesi.
2. Başka kullanıcının profili: PII kolonları görünmemeli (`profiles_public`).
3. Anonim okuma: `users`, `teams` ban kolonları kapatıldıktan sonra tekrar kontrol edilmeli (bkz. §0).
4. Maç oluşturma, başvuru, sonuç girişi (§6.2 eksik kolonlar).
5. Mesajlaşma ve bildirim (`notify-event`); okunmamış mesaj rozeti.
6. Hesap silme: `delete-account` deploy sonrası uçtan uca (başarı, 404, hata).
7. Şikâyet gönderimi: `submit_report` deploy sonrası (başarı, "kullanılamıyor", hata).
8. YouTube maç videosu paylaşımı (highlight sütunları).
9. Oturum süresi dolunca yeniden giriş; arka plandan dönüşte oturumun korunması.
