# Mobil ↔ Backend Sözleşmesi

Hedef okuyucu: Web/Backend (Supabase) oturumu.
Bu dosya mobil uygulamanın ihtiyaç duyduğu backend yüzeyini listeler. Canlı Supabase şemasına **bu repo tarafından uygulanmaz**; yalnızca istek olarak belgelenir. Proje ref: `mohsosllyfgevvvpbkkn`.

Durum sütunu anlamı:
- **Canlıda yok** — `RELEASE_CHECKLIST.md` (2026-10-28 kontrolü) bunu belirtir; deploy öncesi yeniden doğrulanmalı.
- **Doğrulanmadı** — mobil kodu çağırıyor, canlı varlığı bu oturumda kontrol edilemedi.
- **Yok** — mobilde UI var ama backend hiç yok.

## 1. RPC'ler

| Ad | Mobil tüketici | Beklenen davranış | Durum |
|---|---|---|---|
| `get_my_profile()` | `lib/profileQueries.ts` → `ownProfile` | Yalnızca `auth.uid()` satırını döner. Parametre almaz. Hassas kolonlar (PII, ban, score yazma alanları) dönmez; mobil yalnızca açıkça istediği alanları okur. | Canlıda yok |
| `refresh_my_score()` | `profileQueries.refreshMyScore` | Kullanıcının kendi tamamlanma/aktivite skorunu hesaplar ve **yazar**. `profiles.score` istemciden doğrudan yazılmaz. | Canlıda yok |
| `clear_my_expired_ban()` | `profileQueries.clearExpiredBan` | Süresi dolmuş kendi banını temizler. Doğrudan ban kolonu UPDATE'i yerine bu RPC kullanılır. | Canlıda yok |
| `nf_create_footbally_monthly_order(...)` | `components/PremiumEftSection.tsx` | Premium EFT siparişi oluşturur. Mobilde ödeme aktivasyonu yok; sipariş yalnızca bekleyen kayıt açar. | Doğrulanmadı |

Mobilin kendi profil alanı için **`profiles.select('*')` kullanılmaz**. Diğer tablolardaki `select('*')` çağrıları (matches, teams, venues, tribun vb.) ayrı bir kolon-daraltma işi olarak takip edilir.

## 2. Public view'lar

| View | Kullanım | Kural |
|---|---|---|
| `profiles_public` | Başka kullanıcıların profili, oyuncu/scout arama | PII kolonu içermez. Eşleme anahtarı `user_id`. |

Mobil, başka kullanıcı profilinde `profiles` tablosunu doğrudan okumaz. Bu kural mobil tarafında testle korunur (`__tests__/profileQueries.test.ts`).

## 3. Edge Function'lar

| Ad | Durum | Notlar |
|---|---|---|
| `analyze-video` | Repoda var (`supabase/functions/analyze-video`) | `AIAnalysisScreen` çağırır. |
| `notify-event` | Repoda var (`supabase/functions/notify-event`) + taslak migration `supabase/drafts/20261028c_notify_event_support.sql` | Push bildirimi. `service_role` yalnızca burada. |
| **`delete-account`** | **Yok — BLOKÖR** | App Store 5.1.1(v) ve Google Play hesap silme zorunluluğu. Gereksinimler aşağıda. |
| **Kullanıcı/içerik şikâyeti** | **Yok — BLOKÖR** | Mobilde şikâyet UI'ı da yok. Aşağıda. |

### 3.1 `delete-account` (bloker)

Mobil şu an bu fonksiyonu çağırmıyor; ayarlar ekranı destek e-postasına yönlendiriyor (sahte silme kaldırıldı).

Beklenen:
- Yalnızca oturumdaki kullanıcının hesabını siler (`auth.uid()`); istemciden gelen `user_id` kabul edilmez.
- Kullanıcıya ait veriler (profil, mesaj, bildirim, maç başvuruları, takım üyelikleri, push token vb.) ve auth kaydı silinir veya anonimleştirilir. Hangisi olduğu bu fonksiyonun dokümantasyonunda yazılmalı.
- Başarı yanıtı **yalnızca** işlem tamamlandıktan sonra dönmeli. Kısmi başarıda hata döner.
- Mobil başarı sonrası oturumu temizler; bu sırada `auth.signOut()` çağrılır.

Mobil entegrasyonu hazır olduğunda: `supabase.functions.invoke('delete-account')` → başarıda `signOut` + onboarding.

### 3.2 Şikâyet (bloker)

Gereksinim: kullanıcı içerik (profil, mesaj, takım, maç) ve hesap şikâyeti gönderebilmeli. Mobilde henüz UI yok; backend tablosu/RPC'si de yok.

Önerilen sözleşme: `submit_report(p_target_type text, p_target_id uuid, p_reason text, p_detail text)` RPC, oturumlu kullanıcı, `reporter_user_id = auth.uid()`. Hedef tipleri ve moderasyon akışı web/admin tarafında kararlaştırılmalı.

## 4. Auth ve oturum

- Giriş, kayıt, e-posta doğrulama, şifre sıfırlama mobilde Supabase Auth ile yapılır.
- **Deep link / redirect URL** Supabase Auth ayarlarında `footbally://` şemasına izin vermeli (şema: `app.json` → `scheme: "footbally"`). Şifre sıfırlama ve e-posta doğrulama dönüş adresi bu şemaya gitmeli.
- Admin yetkisi **asla** `user_metadata` üzerinden verilmez (istemci yazabilir). Yetki sunucu tarafında (`admins` tablosu ya da RLS fonksiyonu) çözülür.
- Premium durumu `subscriptions` tablosundan okunur; `user_metadata` kullanılmaz.

## 5. RLS ve PII kuralları (mobilin varsaydığı)

- `profiles`: kullanıcı yalnızca kendi satırını okur/yazar. Başkasının PII kolonlarına anon/authenticated erişim kapalı.
- `profiles_public`: yalnızca PII dışı kolonlar.
- `profiles.score`: istemci yazmaz; `refresh_my_score` yazar.
- Ban kolonları: istemci doğrudan yazmaz.
- Yeni PII/RLS değişikliği yapılırsa mobil kolon listesi (`lib/profileQueries.ts`) bozulabilir; değişiklik öncesi bu dosya ile birlikte kontrol edilmeli.

## 6. Uyumluluk matrisi (özet)

| Değişiklik | Eski mobil (TestFlight/internal build) | Yeni mobil | Not |
|---|---|---|---|
| `profiles` PII kolon kısıtı | `select('*')` kırılabilir | Güvenli alan listesi | Eski build'lerde kısıt sonrası boş profil görülebilir |
| `get_my_profile` deploy | Eski build RPC'yi çağırmaz | Çağırır | RPC yokken profil boş durumu gösterir, çökmez |
| `delete-account` deploy | Eski build sahte silme yapıyordu (yalnızca çıkış); bu sürüm düzeltildi | Fonksiyonu çağırabilir (ileride) | Eski build'ler sahte silmeyi sürdürür; store'a gitmeden önce bu sürüm zorunlu olmalı |
| Ban kontrolü (RPC deploy) | Ban uygulanmaz (mevcut durum) | `clear_my_expired_ban` + ban kontrolü | RPC deploy sonrası kullanıcı zorla çıkarılmamalı; geçiş penceresi planlanmalı |

Zorunlu güncelleme (force update) mekanizması bu repoda yok. Eklenirse sürüm kontrolü için ayrı bir sözleşme (`app_config` veya RPC) gerekir.

## 7. Release sonrası ortak regression planı

Web, Admin, Scout ve Mobil için aynı senaryolar:
1. Kayıt → e-posta doğrulama → giriş → profil tamamlama → skor güncellemesi.
2. Başka kullanıcının profili: PII kolonları görünmemeli (`profiles_public`).
3. Maç oluşturma, başvuru, sonuç girişi. Bilinen risk: `match_applications.result/goals`, `match_challenges.challenger_goals/opponent_goals`, `team_members.goals`, `teams.clean_sheets` canlıda eksik olabilir; canlı şema ile doğrulanmalı.
4. Mesajlaşma ve bildirim (notify-event).
5. Hesap silme talebi (şu an destek e-postası; `delete-account` deploy sonrası uçtan uca).
6. Şikâyet gönderimi (deploy sonrası).
7. Oturum süresi dolunca yeniden giriş, RLS 403/400 durumlarında kullanıcı mesajı.
