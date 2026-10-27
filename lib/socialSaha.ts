// Sosyal Saha (social feed) — shared types + helpers.
// Schema lives in supabase/migrations/20260912000000_add_social_saha.sql:
// posts / follows / post_likes / post_comments + profiles.is_premium/
// followers_count/following_count. RLS already enforces who can write/delete;
// client-side checks here are only for UX (hiding buttons the user has no
// rights to use), never the actual security boundary.
import { supabase } from './supabase';
import { profiles } from './profiles';

export type PostType = 'photo' | 'video' | 'match_video';

export interface PostAuthor {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  /** True if this user owns a row in `teams` — their profile should be
   * opened via TeamProfileScreen, not the player ProfileScreen. */
  is_team: boolean;
}

export interface SocialPost {
  id: string;
  user_id: string;
  post_type: PostType;
  media_url: string | null;
  youtube_video_id: string | null;
  venue_name: string | null;
  match_date: string | null;
  caption: string | null;
  highlight_start_sec: number | null;
  highlight_end_sec: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: PostAuthor;
  liked_by_me?: boolean;
}

export interface PostCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: PostAuthor;
}

// Supports both youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
// and youtube.com/embed/ID, with or without extra query params (e.g. &t=30s).
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

export function formatRelativeTime(iso: string, t: (key: any) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('time_now');
  if (minutes < 60) return `${minutes} ${t('time_minutesAgoSuffix')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('time_hoursAgoSuffix')}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t('time_yesterday');
  return `${days} ${t('time_daysAgoSuffix')}`;
}

// profiles has no FK relationship PostgREST can embed onto posts/follows/etc.
// (posts.user_id references auth.users, not profiles), so authors are always
// fetched separately and merged client-side — same pattern already used by
// MessagesScreen/TeamHomeScreen for sender/member profile lookups.
export async function fetchAuthorsMap(userIds: string[]): Promise<Map<string, PostAuthor>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const [{ data, error }, { data: teamRows }] = await Promise.all([
    profiles.publicProfiles(uniqueIds, 'user_id, full_name, avatar_url, is_premium'),
    supabase.from('teams').select('owner_id').in('owner_id', uniqueIds),
  ]);

  const teamOwnerIds = new Set((teamRows as any[] | null)?.map((r) => r.owner_id) ?? []);

  const map = new Map<string, PostAuthor>();
  if (error || !data) return map;
  for (const row of data as any[]) {
    map.set(row.user_id, {
      user_id: row.user_id,
      full_name: row.full_name ?? null,
      avatar_url: row.avatar_url ?? null,
      is_premium: !!row.is_premium,
      is_team: teamOwnerIds.has(row.user_id),
    });
  }
  return map;
}
