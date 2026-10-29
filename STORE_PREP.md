# Footbally Mobil: Mağaza Hazırlık Dosyası

Kitle: App Store Connect ve Google Play Console formlarını dolduran ekip ile mağaza inceleyicileri.
Durum tarihi: 2026-10-29. Kaynak: kod tabanı (commit `f03d13a` ve sonrası) ve canlı Supabase şema kontrolü (yalnızca okuma).

Bu dosya bir taslaktır. Formlara girilmeden önce her madde ilgili backend ve hukuk onayıyla doğrulanmalıdır.

---

## 1. Uygulama bilgileri

| Alan | Değer |
|---|---|
| Ad | Footbally |
| Bundle ID / Package | `com.footbally.app` |
| Sürüm | 1.0.0 (iOS build ve Android versionCode EAS tarafından uzaktan artırılır) |
| Şifreleme | `ITSAppUsesNonExemptEncryption: false` (yalnızca HTTPS) |
| Desteklenen cihaz | Yalnızca telefon (`supportsTablet: false`), dikey |
| Dil | Türkçe (varsayılan), İngilizce |
| Gizlilik politikası | https://getfootbally.com/privacy |
| Kullanım koşulları | https://getfootbally.com/terms |
| Destek e-postası | info@getfootbally.com |
| Hesap silme (uygulama içi) | Ayarlar → Hesabımı Sil. Sunucu `delete-account` fonksiyonu deploy edilene kadar "kullanılamıyor" gösterir. |
| Hesap silme (web) | Henüz yok. Google Play web üzerinden silme talebi yolu ister; bkz. §6. |

---

## 2. Uygulamanın topladığı veriler (koddan çıkarıldı)

Kaynak dayanakları parantez içinde verilmiştir.

| Veri | Ne için | Nerede | Üçüncü tarafa gider mi |
|---|---|---|---|
| E-posta, şifre | Hesap, giriş | Supabase Auth | Hayır (Supabase altyapısı işler) |
| Ad, soyad, telefon (isteğe bağlı), yaş, şehir, ilçe | Profil, arama | `profiles` (`lib/profileQueries.ts`) | Telefon yalnızca sahibine ait satırda; diğer alanlar `profiles_public` ile başkalarına görünür |
| Boy, kilo, ayak, mevkii, kulüp, biyografi | Oyuncu profili | `profiles` | Hayır (herkese açık profil alanları) |
| Profil fotoğrafı, galeri fotoğrafları, videolar | Profil, performans | Storage `avatars`, `posts-media` (`ProfileScreen`, `CreatePostScreen`) | Hayır |
| Videolar (AI analizi) | Performans analizi | Edge Function `analyze-video` | **Evet: Google Gemini API'ye gönderilir** |
| Gönderiler, yorumlar, YouTube bağlantıları | Sosyal akış (Sahadan) | `posts`, `post_comments` | Herkese açık |
| Mesajlar | Sohbet | `conversations`, `messages` | Yalnızca konuşmanın tarafları |
| Maç başvuruları, takım ve saha bilgileri | Maç ve takım yönetimi | `match_applications`, `teams`, `venues` | Kısmen herkese açık |
| Push token | Bildirim | `profiles.push_token` (sahibi okur) | **Evet: Expo push servisi üzerinden iletilir** |
| Bildirim tercihleri | Bildirim ayarları | `profiles.notify_*` | Hayır |
| Galeriden kaydetme (oyuncu kartı) | Kullanıcı isteğiyle | `expo-media-library` | Hayır |

Toplanmayan veriler (kod incelendi):
- Konum: `expo-location` yok; şehir/ilçe kullanıcının elle seçtiği değer.
- Kişiler, takvim, sağlık verisi: yok.
- Reklam kimliği, analitik, çökme raporlama SDK'sı: yok (`package.json`'da Sentry, Firebase, Amplitude vb. yok).
- Uygulama içi satın alma: yok. Premium, banka havalesi/EFT ile yapılır; kart bilgisi uygulamaya girilmez.

---

## 3. Google Play Data Safety taslağı

- Veri toplanıyor: **Evet**. Veri paylaşılıyor: **Evet** (aşağıdaki iki kalem).
- Aktarım sırasında şifreleme: **Evet** (HTTPS).
- Kullanıcı verisinin silinmesini isteyebilir: **Evet**, ancak yalnızca `delete-account` deploy edildikten sonra doğru olur. Önce bu işaretlenmemeli.

| Veri türü | Toplanır | Paylaşılır | Amaç | İsteğe bağlı |
|---|---|---|---|---|
| E-posta adresi | Evet | Hayır | Hesap yönetimi | Hayır |
| Ad | Evet | Hayır | Uygulama işlevi, profil | Hayır |
| Telefon numarası | Evet | Hayır | Profil (kullanıcı ekleyebilir) | Evet |
| Fotoğraflar ve videolar | Evet | **Evet: Google (Gemini), yalnızca AI analizi için** | Uygulama işlevi | Evet |
| Mesajlar | Evet | Hayır | Uygulama işlevi | Hayır |
| Diğer kullanıcı içeriği (gönderi, yorum) | Evet | Hayır (herkese açık) | Uygulama işlevi | Evet |
| Cihaz veya diğer kimlikler (push token) | Evet | **Evet: Expo push servisi** | Bildirim | Hayır |

Form notu: "Veri, uygulama dışına gönderiliyor" kutusu, Gemini ve Expo için işaretlenmelidir. Gizlilik politikası bu iki alıcıyı açıkça anmalıdır (§7).

---

## 4. App Store App Privacy taslağı

- Takip (tracking): **Hayır**. Reklam SDK'sı yok, ATT gerekmez.
- Veri, kullanıcıyla ilişkilendiriliyor: **Evet**, uygulama işlevi amacıyla.

| Kategori | Veri | Bağlı | Takip |
|---|---|---|---|
| İletişim bilgileri | Ad, e-posta, telefon | Evet | Hayır |
| Kullanıcı içeriği | Fotoğraflar/videolar, mesajlar, diğer kullanıcı içeriği | Evet | Hayır |
| Tanımlayıcılar | Kullanıcı kimliği, push token | Evet | Hayır |

Kullanım amacı: yalnızca "Uygulama işlevi". Analitik ve pazarlama kullanımı yok.

---

## 5. Mağaza metinleri (taslak)

**Kısa açıklama (TR, 80 karakter):** Futbolcular, takımlar ve scoutlar için maç, profil ve performans platformu.

**Kısa açıklama (EN):** Match, profile and performance platform for footballers, teams and scouts.

**Açıklama (TR):**
Footbally; halı saha ve amatör maçlar için oyuncuları, takımları ve maçları bir araya getirir.
- Oyuncu profilini oluştur, pozisyonunu ve istatistiklerini paylaş.
- Şehrindeki ve ilçendeki maçları bul, başvur veya maç oluştur.
- Takımlar rakip ve oyuncu arayabilir.
- Mesajlaş, bildirimleri takip et.
- Performans videolarını yükle ve AI analizi al.

Uygulama Türkiye'deki futbol topluluğu için tasarlanmıştır. Kişisel verilerini Ayarlar'dan yönetebilir ve hesabını uygulama içinden silebilirsin.

**Açıklama (EN):** Footbally brings players, teams and matches together for five-a-side and amateur football.
- Build your player profile and share your position and stats.
- Find matches in your city and district, apply, or create one.
- Teams can search for players and opponents.
- Message other users and manage notifications.
- Upload performance videos for AI analysis.

You can manage your data in Settings and delete your account from within the app.

**Anahtar kelimeler (TR):** futbol, halı saha, maç, futbolcu, scout, takım, amatör, profil.

**Yaş derecelendirmesi:** Kullanıcı tarafından oluşturulan içerik ve mesajlaşma içerdiği için IARC (Google) ve App Store yaş anketi "kullanıcı içeriği: evet" ile doldurulmalıdır. Şiddet, çıplaklık, kumar: yok.

---

## 6. Görseller ve inceleme hesabı

**Ekran görüntüleri (gerekli):**
- iPhone 6.9" (1320×2868 veya 1290×2796): en az 3 adet.
- Android telefon: en az 2 adet, 1080×1920 veya daha büyük.
- Gerçek veri değil, demo hesapla alınmalı. Önce demo verisinin temizlenmesi gerekir (bkz. §8).

**İnceleme hesabı (App Store ve Google Play için):** Gerçek kullanıcı hesabı kullanılmamalı. İnceleyicilere verilecek hesap, demo verisiyle ayrı bir test hesabı olmalı. Bilgileri form alanına girilmeden önce hazırlanmalı; repoda kimlik bilgisi tutulmaz.

**İnceleyiciye not (taslak):** Hesap silme: Ayarlar → Hesabımı Sil. Şikâyet: profil ve sohbet ekranındaki bayrak simgesi. Video analizi üçüncü taraf AI servisi kullanır; Gizlilik Politikası'nda anlatılmıştır.

---

## 7. Gizlilik politikasında olması gerekenler (kontrol edilmeli)

Politika metni bu repoda değil; web tarafında yayınlanır. Aşağıdakilerin orada yer aldığı doğrulanmalı:
- Google Gemini'ye video gönderimi ve amacı.
- Expo push servisi ve push token.
- Hesap silme hakkı ve yolu (uygulama içi ve e-posta).
- Veri saklama süresi ve silme sonrası anonimleştirme/silme kapsamı.
- Şikâyet ve engelleme süreçleri (App Store 1.2 gereği).

---

## 8. Yayın öncesi engeller

| # | Engel | Neden önemli | Sahibi |
|---|---|---|---|
| 1 | `delete-account` Edge Function deploy edilmedi | App Store 5.1.1(v) ve Google Play hesap silme zorunluluğu; uygulama içi silme bu olmadan çalışmaz | Backend |
| 2 | `submit_report` RPC'si canlı değil | Kullanıcı içeriği için şikâyet yolu zorunlu (App Store 1.2). Mobil UI hazır, sunucu yok | Backend |
| 3 | Kullanıcı engelleme özelliği yok | App Store 1.2: kötüye kullanan kullanıcıyı engelleme yöntemi gerekli. Hem UI hem `blocks` tablosu yok | Backend + Mobil |
| 4 | Web tarafı hesap silme yolu yok | Google Play: uygulama dışından da silme talebi yolu ister | Web |
| 5 | Demo verisi kaldırıldı mı doğrulanmadı | Önceki oturum notlarına göre demo seed verisi eklenmişti. Yayından önce `scripts/cleanup_demo_data.js` ile kaldırılmalı; canlı durum bu oturumda kontrol edilmedi | Backend |
| 6 | iOS dağıtım kimlik bilgisi yok (EAS) | Non-interactive build çalışmadı; Apple hesabıyla etkileşimli giriş gerekli | Kullanıcı |
| 7 | Eksik kolonlar (maç sonucu, takım istatistikleri) | Görünür hata veriyor; kullanıcı ertelemiş (`pending_missing_columns`) | Backend |
| 8 | Gizlilik politikası Gemini/Expo'yu anmıyor olabilir | Form beyanı ile politika tutarlı olmalı | Hukuk/Web |

---

## 9. Teknik kontrol özeti

- Expo SDK 58 (expo ~58.0.21, react-native 0.88.1): `expo-doctor` 20/20.
- Bundle: iOS, Android ve web için `expo export` başarılı (web için `react-native-web-webview` peer dep eklendi).
- Bundle'da service_role veya gizli anahtar yok (ios/android .hbc ve web .js tarandı).
- İstemci anahtarı: yalnızca publishable (`sb_publishable_...`). Bu kasıtlı; service_role mobil pakette yok.
- Oturum yenileme: `AppState` ile arka planda durduruluyor (`lib/supabase.ts`).
- Push: izin isteği ve token kaydı `lib/notifications.ts`; projectId `app.json`'dan.
- İOS ikonu: 1024×1024, alfa kanalı yok (`assets/icon-ios-1024.png`).
- Splash arka planı: `#060A12`.
- eas.json: development, preview (internal), production (autoIncrement, app-bundle). Yapılandırma geçerli.
