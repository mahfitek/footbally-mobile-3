-- NOT YET APPLIED — Supabase SQL Editor'de elle çalıştırılacak
-- UYARI: Bu policy web repo'da da aynı isimle eklenecek. Policy isimleri
-- tablo bazında benzersiz olmalı — hangi repo bu SQL'i önce çalıştırırsa
-- diğerinin "Match owner can view applications" policy'sini tekrar eklemeye
-- çalışması hata verir. Sadece BİR kere çalıştırın.

CREATE POLICY "Users can update own applications" ON match_applications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications" ON match_applications
  FOR DELETE USING (auth.uid() = user_id);

-- İlan sahibi kendi ilanına gelen başvuruları görebilsin
CREATE POLICY "Match owner can view applications" ON match_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = match_applications.match_id AND matches.creator_id = auth.uid())
  );
