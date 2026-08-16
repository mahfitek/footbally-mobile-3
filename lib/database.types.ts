export type Profile = {
  id: string;
  email: string;
  full_name: string;
  position: string;
  age: number;
  height: number;
  weight: number;
  city: string;
  district: string | null;
  foot: string;
  club: string | null;
  score: number;
  avatar_url: string | null;
  created_at: string;
};

export type Match = {
  id: number; // bigint identity in the live DB — PostgREST/supabase-js return it as a JS number, not a uuid string
  title: string;
  date: string;
  time: string;
  location: string;
  city: string;
  required_players: number;
  type: string;
  category: string;
  creator_id: string;
  status: string;
  created_at: string;
};

export type Opportunity = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badge_color: string;
  location: string;
  age_range: string;
  deadline: string;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
};
