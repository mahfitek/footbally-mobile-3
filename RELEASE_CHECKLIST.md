# Footbally Mobil — Gerçek Cihaz ve Dağıtım Kontrol Listesi

Son güncelleme: 2026-10-29. Bu liste yalnızca mobil projeye aittir (`C:\Users\miyas\footbally-mobile-3`).
Ayrıntılı mağaza formları: `STORE_PREP.md`. Backend sözleşmesi: `MOBILE_BACKEND_CONTRACT.md`.

## 1. Dağıtım engelleyicileri (store öncesi zorunlu)

- [x] **Hesap silme (mobil):** Ayarlar → Hesabımı Sil gerçek `delete-account` çağrısı yapar. Başarı yalnızca sunucu `{ deleted: true }` dönerse gösterilir (`lib/accountDeletion.ts`, test: `__tests__/accountDeletion.test.ts`).
- [ ] **Hesap silme (backend):** `delete-account` Edge Function deploy edilmedi (canlı: yok). Deploy edilene kadar uygulama "kullanılamıyor" gösterir.
- [ ] **Hesap silme (web):** Web'de silme talebi yolu yok (Google Play gereksinimi).
- [x] **Şikâyet (mobil):** Profil ve sohbet ekranından `ReportScreen` açılır; RPC yoksa "kullanılamıyor" gösterir (`lib/reports.ts`, test: `__tests__/reports.test.ts`).
- [ ] **Şikâyet (backend):** `submit_report` RPC'si canlıda yok.
- [x] **Engelleme (mobil):** Profilde Engelle eylemi; `block_user` RPC yoksa "kullanılamıyor" gösterir (`lib/blocking.ts`).
- [ ] **Engelleme (backend):** `block_user` / `unblock_user` RPC'leri ve `blocks` tablosu canlıda yok.
- [x] **Oturum token'ları SecureStore'da:** Keychain / Keystore. Eski AsyncStorage oturumu ilk okumada taşınır (`lib/chunkedStorage.ts`, testli). Cihazda henüz denenmedi.
- [x] **Sahte sosyal giriş kaldırıldı:** Google/Apple düğmeleri kimlik doğrulaması yapmadan oturum açıyordu.
- [x] **Şifre sıfırlama:** Giriş ekranından istek; kurtarma bağlantısı ile yeni şifre ekranı (`lib/authFlows.ts`, testli). Cihazda deep link ile denenmedi.
- [x] **Ban kontrolü (profil):** `get_my_profile` ve `clear_my_expired_ban` canlıda var (2026-10-29). Takım ban temizliği artık istemcide yazılmıyor; takım RPC'si istenmiştir.
- [ ] **`refresh_my_score` canlıda yok.** Hata mobilde loglanır, kullanıcıya başarı gösterilmez.
- [ ] **Anonim okuma güvenlik açığı (S1, S2):** `users` tablosu (38 satır, e-posta dahil) ve `teams` ban kolonları anonim okunabiliyor. Üretim DB değişikliği gerektirir; onay bekliyor. Bkz. `MOBILE_BACKEND_CONTRACT.md` §0.
- [x] **Bundle'da service role anahtarı yok:** iOS, Android ve web export'ları tarandı. `.env.local` EAS arşivine de girmez (`.easignore`).

## 2. Gerçek cihaz testi (bu makinede yapılamadı: cihaz/emülatör yok)

Test hesabı: inceleme için ayrı bir hesap kullanın (üretim kullanıcısı değil).

| Alan | Kontrol | iOS | Android |
|---|---|---|---|
| Açılış | Uygulama soğuk açılıyor, splash kayboluyor | [ ] | [ ] |
| Giriş | Geçerli giriş; yanlış şifre anlamlı hata | [ ] | [ ] |
| Kayıt | Yeni hesap; e-posta doğrulama | [ ] | [ ] |
| Ana ekran | Kartlar açılıyor; boş durum çökmüyor | [ ] | [ ] |
| Alt gezinme | 5 sekme (Ana Sayfa, Maçlar, Keşfet, Mesajlar, Profil); aktif vurgu doğru | [ ] | [ ] |
| Mesaj rozeti | Okunmamış mesaj sayısı görünüyor | [ ] | [ ] |
| Profil | Yükleme, düzenleme, kaydetme | [ ] | [ ] |
| Profil fotoğrafı | İzin reddedilince çökmüyor | [ ] | [ ] |
| Takım | Listeleme; takım profili | [ ] | [ ] |
| Maç | Liste sekmeleri; katılım | [ ] | [ ] |
| Maç sonucu | Beklenen: eksik kolon nedeniyle hata (ertelenmiş) | [ ] | [ ] |
| Sahadan | Liste, gönderi oluşturma, **YouTube maç videosu paylaşımı** (düzeltildi) | [ ] | [ ] |
| Mesajlar | Sohbet listesi, yeni mesaj | [ ] | [ ] |
| Şikâyet | Profil ve sohbetten açılıyor; gönderim sonucu doğru gösteriliyor | [ ] | [ ] |
| Bildirimler | İzin isteği; bildirime dokununca doğru ekran | [ ] | [ ] |
| Ayarlar | Gizlilik ve kullanım koşulları linkleri; hesap silme akışı | [ ] | [ ] |
| Çıkış | Çıkış sonrası onboarding; tekrar giriş | [ ] | [ ] |
| Arka plan | Uygulama arka plana alınıp dönünce oturum korunuyor | [ ] | [ ] |
| Klavye/güvenli alan | Çentik ve klavye açılınca alt düğmeler kapanmıyor | [ ] | [ ] |

## 3. Derleme ve doğrulama (bu makinede yapıldı, 2026-10-29)

- `npm test`: 40/40 geçti.
- `npx tsc --noEmit`: hata yok.
- `npx expo-doctor`: 20/20 geçti.
- `npx expo export --platform all`: iOS, Android ve web başarılı.
- ESLint (`eslint-config-expo`): proje geneli 38 hata, 154 uyarı (önceki 73). Kalanlar: 23 "effect içinde senkron setState" (veri yükleme ekranları), 12 immutability (çoğu Reanimated worklet false positive; 3 kalan TDZ), 2 ref, 1 `AndroidImportance` false positive (enum export ediliyor).
- `npm audit --omit=dev`: 12 güvenlik uyarısı; çoğu `expo` CLI'nin geçişli bağımlılıklarında. `--force` Expo'yu 51'e düşürür; uygulanmadı.
- `expo config --type public --json`: `com.footbally.app`, sürüm 1.0.0, `ios.icon` 1024px şeffafsız, izin metinleri tanımlı, şifreleme muafiyeti `false`.

## 4. EAS ve mağaza hesapları

- EAS girişi: `osmantemur` (Owner). Proje ID `5c7da171-4aeb-470d-8fe0-5f3ba986fa63`.
- Android preview build (SDK 58, commit `f03d13a`): `545ab486-da04-4843-91ac-984d9435bb52`. Durum: 2026-10-29 itibarıyla devam ediyordu.
- Android preview build (HEAD, güvenli saklama ve düzeltmeler dahil): `5b7aaa8f-bbf3-4c33-a78a-3ce81d6ad1d2`. Kuyrukta, sonuç bekleniyor. Log: https://expo.dev/accounts/osmantemur/projects/footbally/builds/545ab486-da04-4843-91ac-984d9435bb52
- Android için `.easignore` eklendi: Windows sembolik linkleri (`.agents/`, `.claude/`) EAS yüklemesini kırıyordu.
- iOS preview build: **başarısız**. Non-interactive modda uygun dağıtım kimlik bilgisi bulunamadı. Apple hesabıyla etkileşimli giriş ve kimlik bilgisi oluşturma gerekli (kullanıcı adımı).
- Google Play ve App Store Connect hesaplarına erişim doğrulanmadı.

## 5. Mağaza gereksinimleri

- [ ] Ekran görüntüleri (iPhone 6.9" en az 3, Android telefon en az 2). Demo hesapla alınmalı.
- [x] Uygulama açıklaması (TR ve EN), kısa açıklama, anahtar kelimeler (`STORE_PREP.md` §5).
- [x] Gizlilik politikası URL'si: `https://getfootbally.com/privacy` (önceki kontrolde 200). İçeriğinde Gemini ve Expo beyanı doğrulanmalı.
- [x] Veri güvenliği (Google Play) ve App Privacy (App Store) taslakları (`STORE_PREP.md` §3-4).
- [ ] Hesap silme: uygulama içi (backend bekliyor) ve web (yok).
- [ ] İnceleme hesabı ve demo verisi temizliği (`cleanup_demo_data.js` çalıştırılıp çalıştırılmadığı doğrulanmadı).
- [ ] Yaş derecelendirmesi anketi (kullanıcı içeriği ve mesajlaşma nedeniyle).
- [x] İkon: iOS 1024×1024 şeffafsız (`assets/icon-ios-1024.png`), Android adaptive icon mevcut.
- [x] Splash arka planı: `#060A12` (marka zemini).

## 6. Kullanıcı onayı gereken adımlar

Aşağıdakiler yalnızca kullanıcı onayı ve kimlik doğrulamasıyla yapılabilir:

- iOS build için Apple hesabı girişi ve dağıtım kimlik bilgisi oluşturma (`eas credentials` etkileşimli).
- Üretim veritabanı değişiklikleri: S1 (`users` anonim okuma) ve S2 (`teams` ban kolonları). `MOBILE_BACKEND_CONTRACT.md` §0.
- Eksik kolonların eklenmesi (ertelenmiş; kullanıcı kararı).
- TestFlight'a yükleme ve Google Play internal testing'e gönderim.
- Production store gönderimi.
