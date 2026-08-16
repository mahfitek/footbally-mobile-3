-- NOT YET APPLIED — Supabase SQL Editor'de elle çalıştırılacak

CREATE POLICY "Users can update own applications" ON match_applications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications" ON match_applications
  FOR DELETE USING (auth.uid() = user_id);
