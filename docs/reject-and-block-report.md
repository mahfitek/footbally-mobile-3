# Başvuru reddetme ve iki yönlü engel kuralları — Rapor

Dal: `feat/reject-and-block-rules` (`feat/home-discover-cleanup` üzerinden açıldı). Hedef kitle: uygulamanın sahibi ve geliştiriciler.

## a) Bölüm bölüm yapılanlar ve commit'ler

**Bölüm 1 — Başvuruyu reddetme**

| Commit | Açıklama |
|---|---|
| `afee1ea` | `supabase/migrations/20261116110000_reject_match_application.sql`: `users_blocked_either_way`, `reject_match_application`, `match_applications_guard` (ekleme ve silme) |
| `cb50453` | `lib/interactionGuard.ts`: hata sınıflandırma, düğme erişilebilirliği, reddetme RPC sarmalayıcısı; testler; TR/EN metinler |
| `83f0534` | Takım sahibinin başvuru listesinde "Reddet" (onaylı) ve reddedilenler için "Reddedildi" etiketi; reddedilenler listede kalır |
| `89fbf6c` | İlan detayında katılımcı satırında sahibe "Reddet"; başvuran tarafında "Reddedildi" ve yeniden katılım engeli |

**Bölüm 2 — İki yönlü engel**

| Commit | Açıklama |
|---|---|
| `53cf6e4` | `supabase/migrations/20261116110100_block_interaction_guards.sql`: beğeni, yorum, takip, bağlantı, meydan okuma, takım daveti, yeni sohbet, scout konuşması ve scout mesajı için BEFORE INSERT trigger'ları |
| `f474009` | `supabase/tests/local/01_block_stubs.sql`, `20_block_reject_tests.sql`, `run_local.sh` (yerel SQL testleri) |
| `3c0d57d` | `supabase/migrations/20261116100000_sahadan_moderated_feed.sql`: yalnızca BEN engellediklerimin mesajları gizlenir |
| `2b6dadc` | Engel hatalarında tek tip mesaj (beğeni, yorum, sohbet, scout, takip, katılım, meydan okuma); engellediğim profilde takip pasif ve "Engeli kaldır" |

**Ek commit'ler:** `a5837fb` (uygulanan migration metniyle dosyayı eşitleme), `cb50453` içinde çeviriler, son commit (`docs(db)`: Sahadan migration'ının uygulandığını işaretleme).

Her commit İngilizce mesajlı ve `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` satırı taşıyor.

## b) Canlıya uygulanan migration'lar

Sıra ve uygulama şekli: `apply_migration` ile, yalnızca ekleme (yeni fonksiyon ve trigger). DROP, DELETE, UPDATE veya politika değişikliği yok. Canlıda test verisi bırakılmadı.

1. `20261116110000_reject_match_application` — uygulandı.
   - Doğrulama (SELECT): `users_blocked_either_way`, `reject_match_application`, `match_applications_guard` mevcut; üçü de `security definer` ve `search_path=public, pg_temp`; `anon` çalıştıramaz; `reject_match_application` ve `get_sahadan_messages` `authenticated` tarafından çalıştırılabilir, diğerleri değil.
   - Trigger: `match_applications_guard_trg` (BEFORE INSERT OR DELETE), durum `enabled=O`.
   - Kısıt çakışması: `match_applications` üzerinde `status` için CHECK yok; `rejected` değeri engellenmedi.
   - Rol testi (işlemde geri alındı): `authenticated` rolüyle `get_sahadan_messages` çağrısı hatasız döndü.
2. `20261116110100_block_interaction_guards` — uygulandı.
   - Doğrulama: 9 trigger fonksiyonu mevcut, hepsi `security definer`, `anon` çalıştıramaz; 9 trigger `enabled=O`.
3. `20261116100000_sahadan_moderated_feed` — uygulandı (tek yönlü engel sürümü).
   - Doğrulama: `get_sahadan_messages` `security definer`, `anon` çalıştıramaz, `authenticated` çalıştırabilir. Çağrı sonucu: boş tablo, hata yok.

Canlı SELECT özeti (uygulama sonrası): `match_applications=11` (uygulama öncesindeki kayıtlar), `rejected=0`, `user_blocks=0`, `notifications` içinde test bildirimi yok.

Uygulanmayan migration: yok.

Yerel doğrulama: `bash supabase/tests/local/run_local.sh` → `migrations OK`, `LOCAL TESTS PASSED` (tüm zincir ve 110 kontrol).

## c) Trigger envanteri: eklenen, zaten korunan, atlanan

| Tablo | Durum | Trigger / koruma | Karşı taraf |
|---|---|---|---|
| `match_applications` | Eklendi | `match_applications_guard_trg` (ekleme: reddedilmiş kayıt ve engel; silme: reddedilmiş kaydı başvuran silemez) | İlan sahibi (`matches.creator_id`), takım sahibi (`teams.owner_id`) |
| `post_likes` | Eklendi | `post_likes_block_guard_trg` | Gönderi sahibi (`posts.user_id`) |
| `post_comments` | Eklendi | `post_comments_block_guard_trg` | Gönderi sahibi |
| `follows` | Eklendi | `follows_block_guard_trg` | `followed_id` |
| `connections` | Eklendi | `connections_block_guard_trg` | `target_id` |
| `match_challenges` | Eklendi | `match_challenges_block_guard_trg` | İki takımın sahipleri |
| `team_invitations` | Eklendi | `team_invitations_block_guard_trg` | Davet edilen (`user_id`) ve takım sahibi; `user_id` boşsa kontrol yok |
| `conversations` | Eklendi | `conversations_block_guard_trg` | `participant_a` ve `participant_b` |
| `scout_conversations` | Eklendi | `scout_conversations_block_guard_trg` (`resolve_recipient`'tan sonra çalışır) | Scout ve hedefin sahibi/profili |
| `scout_messages` | Eklendi | `scout_messages_block_guard_trg` | Konuşmanın iki tarafı |
| `messages` | Zaten korunuyordu | `messages_enforce_block` (iki yön, hata kodu `blocked_user`) | Değiştirilmedi |
| `match_applications` (opportunity_id) | Atlandı | Karşı taraf tanımlı değil (fırsat sahibi kolonu yok) | — |
| `team_invitations` (yalnızca e-posta) | Atlandı | `user_id` boş; karşı taraf bilinmiyor | — |

Atlanan ek kapsam: `teams` yönetim işlemleri ve `posts` oluşturma (kapsam dışı).

## d) Varsayılan kararlar ve nasıl değiştirilir

1. **Reddetme sahipliği.** Yalnızca ilanın sahibi (`creator_id`) veya bağlı takımın sahibi reddedebilir. Değiştirmek için: `reject_match_application` içindeki `v_is_owner` koşulu (yeni migration ile).
2. **Kabul yok.** Yalnızca reddetme eklendi, kabul düğmesi yok.
3. **Reddedilenin yeniden başvurusu.** Aynı ilana yeniden başvuru ve reddedilmiş kaydın silinmesi engelli. Değiştirmek için `match_applications_guard` içindeki iki kontrol.
4. **Bildirim.** Yalnızca uygulama içi `notifications` satırı; metin TR/EN ile `screen='match'`. Push bildirimi yapılmadı: mevcut `notify-event` edge fonksiyonu bu olayı tanımıyor ve edge function deploy edilmedi (bu iş kapsamında yasak). Push istenirse yeni bir olay türü ve deploy gerekir.
5. **Engel yönü.** İki yönlü etkileşim engeli (sunucu). Görünürlük tek yönlü: yalnızca BEN engellediklerim listelerden ve Sahadan'dan gizlenir; beni engelleyenler görünür.
6. **Sahadan medya filtresi.** Yönetici kaldırmış medya (`removed_by_admin`) gizli kalır; artık medya doğrulaması RPC ile yapılır, istemcideki güvenli mod RPC varken devre dışı.
7. **Hata mesajı.** Tüm engel hataları tek mesaj: "Bu kullanıcıyla etkileşime geçemezsin." Kim kimi engellediği gösterilmez.
8. **Engellediğim profil.** Takip ve diğer etkileşim düğmeleri pasif; "Engeli kaldır" görünür. Beni engelleyenin profili açık kalır ve düğmeler çalışır; sunucu reddeder.
9. **Mevcut tablo kısıtları.** `match_applications(match_id, user_id)` benzersiz kısıtı korunur; yeniden başvuru yalnızca silme yoluyla değil, trigger ile de engellenir.

Değiştirme yolu: her karar yukarıdaki fonksiyon veya istemci dosyasında; yeni davranış için yeni migration yazılır (mevcut fonksiyon değiştirilmez).

## e) tsc / test sonuçları, build numarası, submit sonucu

- `npx tsc --noEmit`: **0 hata** (son çalıştırma).
- `npm test`: **289 test, 289 geçti, 0 başarısız** (yeni: `__tests__/interactionGuard.test.ts`).
- Yerel SQL testleri: **110 kontrol geçti** (reddetme: sahip, sahip olmayan, takım sahibi, çift çağrı tek bildirim, silme engeli, yeniden başvuru engeli, ilansız başvuru, olmayan başvuru, kısıtlı hesap; engel: 10 tablo iki yönde, engel yokken normal çalışma, mevcut satırların korunması, `messages` mevcut engeli, yardımcı fonksiyon).
- Build ve submit: aşağıda.

- **Build — başarılı.** `eas build -p ios --profile production --non-interactive` tamamlandı. Build numarası **9 → 10** (EAS `autoIncrement`; `app.json`/`eas.json` sürüm ve build alanlarına dokunulmadı). Build: https://expo.dev/accounts/osmantemur/projects/footbally/builds/57a91fa9-c542-4945-8d56-17e1336e25b6 · IPA: https://expo.dev/artifacts/eas/zE5r0hDklD1U43nFNTBQWZvNuNucFrFxo-EtgOuCkmM.ipa
- **Submit — başarılı (yalnızca TestFlight).** `eas submit -p ios --latest --non-interactive` build 10'u App Store Connect'e yükledi. Submission: https://expo.dev/accounts/osmantemur/projects/footbally/submissions/1a6f2082-3349-4df9-974a-6162ab90ae91 . İnceleme gönderimi, sürüm ve metadata değişikliği yapılmadı.

## f) Telefonda elle test edilecekler

1. **Reddetme (takım sahibi).** Takım profilinde başvurular → "Reddet" → onay → "Başvuru reddedildi." Satır "Reddedildi" olur.
2. **Reddetme (ilan sahibi).** İlan detayında katılımcı satırında "Reddet" → onay → "Reddedildi" etiketi.
3. **Başvuran tarafı.** Reddedilen ilanda katılım düğmesi yerine "Reddedildi"; ilan kartında durum "Reddedildi".
4. **Reddedilenin tekrar başvurusu.** Aynı ilana tekrar katılmayı dene → "Bu ilana daha önce yapılan başvuru reddedildi."
5. **Bildirim.** Başvuran uygulama içi bildirimde "Başvurun reddedildi" görür; dokununca ilan listesi açılır.
6. **Engelleme (ben engelledim).** Engellediğim kişinin profilinde takip pasif; "Engeli kaldır" görünür. Kaldırınca düğmeler geri gelir.
7. **Engelleme (beni engelledi).** Beni engelleyen kişinin profili açık; beğeni, yorum, takip, sohbet, meydan okuma ve başvuru denemesi "Bu kullanıcıyla etkileşime geçemezsin." mesajı verir.
8. **Sahadan.** Beni engelleyenin mesajları görünür; benim engellediklerimin mesajları görünmez; yönetici kaldırmış medya gösterilmez.
9. **Ana sayfa önizlemesi.** Medyalı mesajlar görünür (RPC uygulandığı için güvenli mod kapalı).

## g) Web sitesinde yapılması gereken karşılık değişiklikler

- Başvuru listesinde (web ilan sahibi paneli) "Reddet" düğmesi ve `reject_match_application` RPC'si kullanılmalı. Yeniden başvuru sunucuda zaten engelli.
- Engel uygulanmış etkileşimler için web aynı hata metnini (`blocked_interaction`, `blocked_user`, `application_rejected`) ele almalı.
- Web'de engellenen kullanıcıları gösteren veya gizleyen her liste, yalnızca kendi engellediklerini (`user_blocks.blocker_id = auth.uid()`) süzmeli; beni engelleyenler görünür kalır. Bu yeni kural ile tutarlı olmalı.
- Web'deki `messages` gönderimi zaten iki yönlü (`messages_enforce_block`); hata kodu `blocked_user`.

## h) Doğrulanamayan her şey

- **Canlı işlev testi.** Canlıda reddetme ve engel trigger'ları yalnızca SELECT ile doğrulandı (fonksiyon tanımı, yetki, trigger durumu). Gerçek kullanıcı akışı canlıda test edilmedi; yerelde test edildi.
- **Opportunity başvuruları.** Fırsat başvurularında reddetme ve engel kontrolü kapsam dışı; karşı taraf kolonu yok.
- **E-posta ile takım daveti.** `user_id` boş davetlerde engel kontrolü yapılmıyor.
- **Push bildirimi.** Yapılmadı; yalnızca uygulama içi bildirim var.
- **Yönetici medya kaldırma eşleşmesi.** `media_ref = tribun_messages.media_url` eşleşmesi, medya yolunun yönetici kaydıyla birebir aynı biçimde tutulduğuna dayanıyor; canlı veriyle doğrulanmadı (tabloda kayıt yok).
- **Telefon testi yapılmadı.** Düğme düzeni, onay diyaloğu ve bildirim akışı yalnızca koddan doğrulandı.
- **Karşılıklı görünürlük.** Beni engelleyenlerin listelerde görünmeye devam etmesi bilinçli; istemci bunu bilmez (engel listesinin yalnızca kendi satırlarım okunabiliyor). Görünürlük kararının etkileri ayrıca gözden geçirilmeli.
- **Eski ekranlar.** Takım daveti (`team_invitations`) için istemcide yazma akışı bulunamadı; trigger hazır ama istemci yolu test edilemedi.
