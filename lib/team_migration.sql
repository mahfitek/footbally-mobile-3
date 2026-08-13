CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  district text,
  league text DEFAULT 'Amatör',
  founded_year int,
  ground_name text,
  description text,
  playing_style text[],
  formation text DEFAULT '4-4-2',
  match_days text[],
  needed_positions text[],
  whatsapp_link text,
  contact_number text,
  logo_url text,
  wins int DEFAULT 0,
  losses int DEFAULT 0,
  draws int DEFAULT 0,
  goals_scored int DEFAULT 0,
  goals_conceded int DEFAULT 0,
  rating int DEFAULT 50,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'player',
  position text,
  jersey_number int,
  joined_at timestamp DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.match_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_team_id uuid REFERENCES teams(id),
  opponent_team_id uuid REFERENCES teams(id),
  date text,
  time text,
  location text,
  format text DEFAULT '11v11',
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Owners can manage team" ON teams FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can read members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Team owners can manage members" ON team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_id = auth.uid())
);
CREATE POLICY "Anyone can read challenges" ON match_challenges FOR SELECT USING (true);
CREATE POLICY "Teams can create challenges" ON match_challenges FOR INSERT WITH CHECK (true);
