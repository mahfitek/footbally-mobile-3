-- Run this in the Supabase SQL editor to support balances, manual bank
-- transfer top-ups, and AI video analysis jobs.

CREATE TABLE IF NOT EXISTS public.balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  amount numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own balance" ON balances;
CREATE POLICY "Users can read own balance" ON balances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own balance" ON balances;
CREATE POLICY "Users can update own balance" ON balances FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own balance" ON balances;
CREATE POLICY "Users can insert own balance" ON balances FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own payments" ON payment_requests;
CREATE POLICY "Users can read own payments" ON payment_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert payment requests" ON payment_requests;
CREATE POLICY "Users can insert payment requests" ON payment_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI video analysis jobs, written by AIAnalysisScreen after each analysis.
CREATE TABLE IF NOT EXISTS public.ai_video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  video_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_video_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own ai jobs" ON ai_video_jobs;
CREATE POLICY "Users can read own ai jobs" ON ai_video_jobs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own ai jobs" ON ai_video_jobs;
CREATE POLICY "Users can insert own ai jobs" ON ai_video_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage buckets: 'videos' is private (analysis uploads), 'avatars' is
-- public (profile photos). Both use a per-user folder (storage path
-- "<user_id>/filename") so RLS can scope access by the first path segment.
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own videos" ON storage.objects;
CREATE POLICY "Users can upload own videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can read own videos" ON storage.objects;
CREATE POLICY "Users can read own videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
