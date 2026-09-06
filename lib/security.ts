import { TranslationKey } from './i18n';

// ---------------------------------------------------------------------------
// PostgREST filter-string sanitization
// ---------------------------------------------------------------------------
// supabase-js's `.or("full_name.ilike.%<term>%,...")` builds a raw PostgREST
// filter string. Commas and parentheses are structural in that syntax, so an
// unescaped comma/paren in user input lets them append extra OR conditions
// (e.g. typing `x,id.eq.1`) instead of just searching for their own text.
// `%`/`_` are SQL LIKE wildcards, and `\` is the LIKE escape character, so
// those need escaping too or a search for "50%" would match everything.
// Stripping/escaping here keeps the term a plain, literal search string.
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()]/g, '') // structural in PostgREST's or() syntax — drop entirely
    .replace(/\\/g, '\\\\') // escape the LIKE escape character itself first
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim()
    .slice(0, 100);
}

// ---------------------------------------------------------------------------
// Chat / message content moderation
// ---------------------------------------------------------------------------
// Two independent checks applied before a message is sent or a public post
// (Sahadan) is published:
//  1. Malicious code: script/HTML injection payloads. React Native's <Text>
//     never executes this, but the same content could later be rendered
//     unsafely elsewhere (a future web admin panel, a webview, etc.), so it's
//     rejected at the source rather than relying on every future renderer to
//     be safe.
//  2. Personal data (KVKK/GDPR): TC Kimlik No, card numbers, IBAN and phone
//     numbers are blocked from being posted in chat/Sahadan to reduce the
//     chance of a user (often unknowingly) exposing their own or someone
//     else's personal data in a space other members can read.

const MALICIOUS_CODE_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /<\/script>/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /javascript:/i,
  /data:text\/html/i,
  /on\w+\s*=\s*["']/i, // onerror=, onclick=, onload=, ...
  /\bdocument\.(cookie|write|location)\b/i,
  /\bwindow\.location\b/i,
  /\beval\s*\(/i,
  /\bnew\s+Function\s*\(/i,
];

export function containsMaliciousCode(text: string): boolean {
  return MALICIOUS_CODE_PATTERNS.some((pattern) => pattern.test(text));
}

// Turkish national ID (TC Kimlik No) checksum — real algorithm, so this only
// flags strings that are actually valid IDs rather than any 11-digit run.
function isValidTcKimlik(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || digits[0] === '0') return false;
  const d = digits.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  const digit10 = ((oddSum * 7) - evenSum) % 10;
  if (((digit10 % 10) + 10) % 10 !== d[9]) return false;
  const sumFirst10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sumFirst10 % 10 === d[10];
}

// Luhn checksum for card numbers, to avoid flagging arbitrary long digit runs.
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

const TR_IBAN_RE = /\bTR\d{2}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{2}\b/i;
const TR_PHONE_RE = /(?:\+90|0)?[\s.-]?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/;

export function containsPersonalData(text: string): boolean {
  if (TR_IBAN_RE.test(text)) return true;
  if (TR_PHONE_RE.test(text)) return true;

  const elevenDigitRuns = text.match(/\d{11}/g) ?? [];
  if (elevenDigitRuns.some(isValidTcKimlik)) return true;

  const cardCandidates = text.match(/\b(?:\d[ -]?){13,19}\b/g) ?? [];
  if (cardCandidates.some((c) => passesLuhn(c.replace(/[ -]/g, '')))) return true;

  return false;
}

export type ModerationResult = { allowed: true } | { allowed: false; reasonKey: TranslationKey };

export function moderateMessage(text: string): ModerationResult {
  if (containsMaliciousCode(text)) return { allowed: false, reasonKey: 'moderation_maliciousCode' };
  if (containsPersonalData(text)) return { allowed: false, reasonKey: 'moderation_personalData' };
  return { allowed: true };
}
