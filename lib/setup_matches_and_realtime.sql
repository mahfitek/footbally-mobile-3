-- Run this in the Supabase SQL editor to support the Match Center, the
-- "İletişim Kur" / chat flow, and live message updates.

-- Matches created from CreateMatchScreen.
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  location text NOT NULL,
  city text NOT NULL,
  required_players int NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT '5v5',
  category text NOT NULL DEFAULT 'Eğlence',
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Matches created before the "Maç Tipi" (Eğlence/Rekabetçi/Antrenman) picker existed.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Eğlence';

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Users can create matches" ON matches FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own matches" ON matches FOR UPDATE USING (auth.uid() = creator_id);

-- match_applications already exists for opportunity ("Fırsatlar") applications
-- with columns (user_id, opportunity_id, status). Add a nullable match_id so
-- the same table can also track who joined a match.
ALTER TABLE match_applications ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES matches(id);
ALTER TABLE match_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read applications" ON match_applications;
CREATE POLICY "Anyone can read applications" ON match_applications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own applications" ON match_applications;
CREATE POLICY "Users can insert own applications" ON match_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Live updates for ChatScreen.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- Ensures postgres_changes payloads include full old/new row data (required
-- for the ChatScreen realtime subscription to receive complete INSERT rows).
ALTER TABLE messages REPLICA IDENTITY FULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages" ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Receivers can mark messages read" ON messages;
CREATE POLICY "Receivers can mark messages read" ON messages FOR UPDATE
  USING (auth.uid() = receiver_id);
