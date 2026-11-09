import { TranslationKey } from './i18n';

// Maps known Supabase Auth error messages to a translated, user-safe message.
// Anything not explicitly recognized here falls back to a generic message —
// the raw Supabase/Postgres error text is never shown to the user (it can
// contain internal details that shouldn't be exposed).
const KNOWN_AUTH_ERRORS: { match: (msg: string) => boolean; key: TranslationKey }[] = [
  { match: (m) => m === 'Invalid login credentials', key: 'login_invalidCredentials' },
  { match: (m) => m === 'User already registered', key: 'register_emailTaken' },
  { match: (m) => m.startsWith('Password should be at least'), key: 'register_passwordTooShort' },
  { match: (m) => m.toLowerCase().includes('invalid') && m.toLowerCase().includes('email'), key: 'register_invalidEmail' },
  { match: (m) => m.toLowerCase().includes('email not confirmed'), key: 'auth_emailNotConfirmed' },
  { match: (m) => m.toLowerCase().includes('rate limit') || m.includes('429'), key: 'auth_rateLimited' },
  { match: (m) => m.toLowerCase().includes('network') || m.toLowerCase().includes('fetch'), key: 'auth_networkError' },
];

export const translateAuthError = (message: string, t: (key: TranslationKey) => string): string => {
  const found = KNOWN_AUTH_ERRORS.find((entry) => entry.match(message));
  return t(found ? found.key : 'auth_genericError');
};
