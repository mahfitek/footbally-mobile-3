-- Run this in the Supabase SQL editor. Adds everything needed for: real
-- notifications, profile view tracking, match result tracking (feeds the
-- Performance screen), and team challenge scoring (feeds Team Stats).

-- Notifications (read by NotificationsScreen/HomeScreen/TeamHomeScreen,
-- written by lib/notify.ts whenever another user triggers an event).
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  icon text DEFAULT '🔔',
  message text NOT NULL,
  screen text DEFAULT 'notifications',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can mark own notifications read" ON notifications;
CREATE POLICY "Users can mark own notifications read" ON notifications FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Profile view tracking (who looked at whose profile, e.g. from ScoutScreen).
CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id uuid REFERENCES auth.users(id),
  viewed_user_id uuid REFERENCES auth.users(id),
  viewer_name text,
  created_at timestamp DEFAULT now()
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert views" ON profile_views;
CREATE POLICY "Users can insert views" ON profile_views FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can read own views" ON profile_views;
CREATE POLICY "Users can read own views" ON profile_views FOR SELECT USING (auth.uid() = viewed_user_id);

-- Self-reported match result per participant, so the Performance screen can
-- show real matches played / wins / goals instead of zeros.
ALTER TABLE match_applications ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('win', 'loss', 'draw'));
ALTER TABLE match_applications ADD COLUMN IF NOT EXISTS goals int NOT NULL DEFAULT 0;

-- Per-player goal tally inside a team's squad (Top Scorers on Team Stats).
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS goals int NOT NULL DEFAULT 0;

-- Clean sheets counter, updated alongside wins/losses/draws when a team
-- challenge score is submitted.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS clean_sheets int NOT NULL DEFAULT 0;

-- Final score for a completed team challenge, so both teams' records can be
-- updated from one source of truth.
ALTER TABLE match_challenges ADD COLUMN IF NOT EXISTS challenger_goals int;
ALTER TABLE match_challenges ADD COLUMN IF NOT EXISTS opponent_goals int;
DROP POLICY IF EXISTS "Team owners can update their challenges" ON match_challenges;
CREATE POLICY "Team owners can update their challenges" ON match_challenges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE (teams.id = match_challenges.challenger_team_id OR teams.id = match_challenges.opponent_team_id)
    AND teams.owner_id = auth.uid()
  )
);

-- Optional target position for an opportunity, so matching players can be
-- notified automatically when one is added.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS position text;

CREATE OR REPLACE FUNCTION notify_matching_opportunity()
RETURNS trigger AS $$
BEGIN
  IF NEW.position IS NOT NULL THEN
    INSERT INTO notifications (user_id, icon, message, screen)
    SELECT user_id, '⚡', 'Yeni fırsat: ' || NEW.title, 'activities'
    FROM profiles
    WHERE position = NEW.position;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_opportunity_created ON opportunities;
CREATE TRIGGER on_opportunity_created
  AFTER INSERT ON opportunities
  FOR EACH ROW EXECUTE FUNCTION notify_matching_opportunity();
