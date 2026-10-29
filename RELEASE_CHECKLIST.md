# Footbally Mobil — Gerçek Cihaz ve Dağıtım Kontrol Listesi

Son mobil temel commit: `4f99152`. Bu liste yalnızca mobil projeye aittir (`C:\Users\miyas\footbally-mobile-3`).

## 1. Dağıtım engelleyicileri (store öncesi zorunlu)

- [ ] **Hesap silme gerçek değil.** `screens/SettingsScreen.tsx` içindeki `handleDeleteAccount` yalnızca çıkış yapıyor. App Store (5.1.1(v)) ve Google Play hesap silme gereksinimi için sunucu tarafında gerçek silme (RPC/edge function) gerekir. Bu web/Supabase tarafı işidir; mobil tarafta sahte silme bırakılmamalı.
- [ ] **Ban kontrolü canlıda devre dışı.** `get_my_profile` RPC'si canlı Supabase'de yok. `lib/accountAccess.ts` `fetchAccountBanRow` içinde profil satırı alınamayınca `null` dönüyor ve giriş izin veriliyor. Profil bazlı yasaklar RPC deploy edilene kadar uygulanmaz.
- [ ] **Eksik RPC'ler (canlı şema kontrolü):** `get_my_profile`, `refresh_my_score`, `clear_my_expired_ban`. Uygulama çökmüyor, ancak kendi profil yüklemesi (Ana ekran, Profil, Maç, Rozet, Ayarlar, Premium, Performans) boş dönüyor. Deploy için web repo migration'ları (20261028a/b) gerekir.
- [ ] **Bundle'da service role anahtarı yok** (iOS/Android export kontrol edildi). `.env.local` git'te ignore ediliyor. Yine de bu dosya yalnızca yerel betikler içindir.

## 2. Gerçek cihaz testi

Test hesabı: inceleme için ayrı bir hesap kullanın (üretim kullanıcısı değil).

| Alan | Kontrol | iOS | Android |
|---|---|---|---|
| Açılış | Uygulama soğuk açılıyor, splash kayboluyor | [ ] | [ ] |
| Giriş | Geçerli e-posta/şifre ile giriş; yanlış şifre anlamlı hata | [ ] | [ ] |
| Kayıt | Yeni hesap oluşturma; e-posta doğrulama akışı | [ ] | [ ] |
| Ana ekran | Hızlı erişim kartları açılıyor; RPC eksikken boş durum görünüyor, çökme yok | [ ] | [ ] |
| Profil | Yükleme, düzenleme, kaydetme, tamamlanma skoru değişiyor | [ ] | [ ] |
| Profil fotoğrafı | Galeri/kamera izni istenir ve reddedilirse uygulama çökmez | [ ] | [ ] |
| Takım | Listeleme; kapalı takım katılımı düğmesi görünmüyor/kapalı | [ ] | [ ] |
| Maç | Liste sekmeleri; katılım; sonuç girişi (eksik kolon nedeniyle beklenen kısıt) | [ ] | [ ] |
| Oyuncular/Scout | Arama, filtre, profil açma | [ ] | [ ] |
| Sahadan | Liste ve detay açılıyor | [ ] | [ ] |
| Mesajlar | Sohbet listesi, yeni mesaj, gerçek zamanlı mesaj | [ ] | [ ] |
| Bildirimler | İzin isteği, bildirim listesi, bildirim dokununca doğru ekrana gidiş | [ ] | [ ] |
| Premium | Ödeme/EFT bölümü görünmüyor (yalnızca geliştirme derlemesinde açılır) | [ ] | [ ] |
| Ödül | Ödül talebi düğmesi görünmüyor | [ ] | [ ] |
| Merch | Katalog okunuyor; sepete ekleme ve adres kaydetme "Yakında" | [ ] | [ ] |
| Ayarlar | Gizlilik politikası ve kullanım koşulları linkleri açılıyor | [ ] | [ ] |
| Çıkış | Çıkış yapınca onboarding'e dönülüyor; tekrar giriş çalışıyor | [ ] | [ ] |
| Dönüş | Uygulama arka plana alınıp dönünce oturum korunuyor | [ ] | [ ] |
| Klavye/Güvenli alan | Çentik ve klavye açılınca alt düğmeler kapanmıyor | [ ] | [ ] |

## 3. Derleme ve doğrulama (bu makinede yapıldı)

- `npm test`: 23/23 geçti
- `npx tsc --noEmit`: hata yok (exit 0)
- `npx expo export --platform ios` ve `--platform android`: başarılı
- `npx expo config --type public`: `bundleIdentifier` / `package` = `com.footbally.app`, `ITSAppUsesNonExemptEncryption: false`
- Gizlilik politikası (`https://getfootbally.com/privacy`) ve kullanım koşulları (`/terms`): 200

## 4. EAS ve mağaza hesapları

- EAS: `osmantemur` hesabıyla giriş yapılmış; proje ID `5c7da171-4aeb-470d-8fe0-5f3ba986fa63`.
- Mevcut tek build: Android `preview` (SDK 54, 20.06.2026). SDK 58 için yeni build gerekir.
- iOS build kaydı yok.
- Credential durumu (iOS sertifika/provisioning, Android keystore, push anahtarı) bu CLI ile non-interactive okunamadı. Apple ve Google Play Console hesaplarının varlığı doğrulanmadı.

## 5. Mağaza gereksinimleri

- [ ] Ekran görüntüleri (iPhone 6.7"/6.9" ve Android telefon; en az 2'şer adet)
- [ ] Uygulama açıklaması (TR), kısa açıklama, anahtar kelimeler
- [ ] Gizlilik politikası URL'si: `https://getfootbally.com/privacy` (erişilebilir)
- [ ] Hesap silme: uygulama içinde ve web'de erişilebilir bir silme yolu (blokör, bkz. 1)
- [ ] İnceleme hesabı ve demo verisi (Apple ve Google inceleyicileri için)
- [ ] Veri güvenliği formu (Google Play) ve gizlilik beslemesi (App Store)
- [ ] Yaş derecelendirmesi anketi (Google Play)

## 6. Kullanıcı onayı gereken adımlar

Aşağıdakiler yalnızca kullanıcının onayı ve kimlik doğrulamasıyla yapılabilir:

- EAS build başlatma (iOS için Apple hesabı girişi, dağıtım sertifikası oluşturma)
- TestFlight'a yükleme ve Google Play internal testing'e gönderim
- Production store gönderimi
