// Açık kolon listeleri. Canlı PostgREST şemasından (2026-10-29 kontrolü) türetildi.
// `select('*')` yerine bunlar kullanılır: yeni/hassas kolonlar istemciye yanlışlıkla sızmaz.
//
// Kural: başka kullanıcıların (veya başka takımların) satırlarında ban/yönetim alanları
// (account_status, banned_until, ban_is_permanent, ban_reason, banned_by, banned_at) asla seçilmez.
// Kendi ban durumu yalnızca lib/accountAccess.ts üzerinden okunur.
//
// Not: Supabase istemcisinin sonuç tipini çıkarabilmesi için her liste bir string literal'dir
// (`as const`). Birleştirilmiş (join) string'ler tipi bozar; bu yüzden liste tek satır tutulur.

export const TEAM_COLUMNS = 'id, owner_id, name, city, district, league, founded_year, ground_name, description, playing_style, formation, match_days, needed_positions, whatsapp_link, contact_number, logo_url, wins, losses, draws, goals_scored, goals_conceded, rating, created_at, photos, videos, photo_urls, video_urls, is_looking_for_players, level, preferred_format, updated_at' as const;

export const VENUE_COLUMNS = 'id, owner_user_id, name, city, district, address, phone, whatsapp, price_per_hour, description, is_active, created_at' as const;

export const MESSAGE_COLUMNS = 'id, conversation_id, sender_user_id, body, created_at, read' as const;

export const NOTIFICATION_COLUMNS = 'id, user_id, title, body, read, screen, created_at' as const;

export const MATCH_COLUMNS = 'id, title, date, time, location, city, district, type, description, required_players, team_payment, travel_covered, food_covered, needed_positions, creator_id, status, created_at, category' as const;

export const POST_COLUMNS = 'id, user_id, post_type, media_url, youtube_video_id, highlight_start_seconds, highlight_end_seconds, venue_name, match_date, caption, likes_count, comments_count, created_at' as const;

export const POST_COMMENT_COLUMNS = 'id, post_id, user_id, content, created_at' as const;

export const TRIBUN_MESSAGE_COLUMNS = 'id, sender_id, content, media_url, media_type, created_at' as const;

export const OPPORTUNITY_COLUMNS = 'id, title, subtitle, badge, badge_color, location, age_range, deadline, created_at' as const;
