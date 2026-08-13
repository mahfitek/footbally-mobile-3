-- profiles.id is an auto-generated identity column (bigint), not the user's
-- uuid. The actual link to auth.users is profiles.user_id, so policies must
-- check against that column instead.
-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Allow users to read all profiles
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
-- Allow users to update own profile
DROP POLICY IF EXISTS "Herkes kendi profilini güncelleyebilir" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Store the Expo push token for sending push notifications to this user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
