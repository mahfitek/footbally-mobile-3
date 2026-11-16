#!/usr/bin/env bash
# Yerel PostgreSQL'de migration zinciri + SQL testleri. Canlı veritabanına bağlanmaz.
# Kullanım: PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe" PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres bash supabase/tests/local/run_local.sh
set -euo pipefail
PSQL="${PSQL:-psql}"
PGHOST="${PGHOST:-127.0.0.1}"; PGPORT="${PGPORT:-5432}"; PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-footbally_test}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
conn=(-h "$PGHOST" -p "$PGPORT" -U "$PGUSER")

"$PSQL" "${conn[@]}" -q -c "drop database if exists $DB" -c "create database $DB"
chain=(
  "$ROOT/supabase/tests/local/00_stubs.sql"
  "$ROOT/supabase/tests/local/01_block_stubs.sql"
  "$ROOT/supabase/tests/local/02_teams_list_stubs.sql"
  "$ROOT/supabase/migrations/20261114120000_profile_badge_rewards.sql"
  "$ROOT/supabase/migrations/20261114120100_profile_task_score.sql"
  "$ROOT/supabase/migrations/20261115100000_listing_types_format_lineup.sql"
  "$ROOT/supabase/migrations/20261115100100_referral_system.sql"
  "$ROOT/supabase/migrations/20261115100200_profile_task_exclude_referral.sql"
  "$ROOT/supabase/migrations/20261116110000_reject_match_application.sql"
  "$ROOT/supabase/migrations/20261116110100_block_interaction_guards.sql"
  "$ROOT/supabase/migrations/20261116120000_get_my_blocked_users.sql"
)
for f in "${chain[@]}"; do
  "$PSQL" "${conn[@]}" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done
echo "migrations OK"
"$PSQL" "${conn[@]}" -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/10_referral_listing_tests.sql" | tee /tmp/footbally_local_tests.out
"$PSQL" "${conn[@]}" -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/20_block_reject_tests.sql" | tee /tmp/footbally_local_tests20.out
"$PSQL" "${conn[@]}" -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/30_blocked_users_list_tests.sql" | tee /tmp/footbally_local_tests30.out
grep -q "ALL TESTS PASSED" /tmp/footbally_local_tests.out && grep -q "ALL TESTS PASSED" /tmp/footbally_local_tests20.out && grep -q "ALL TESTS PASSED" /tmp/footbally_local_tests30.out && echo "LOCAL TESTS PASSED"
