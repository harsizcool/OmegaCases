// Package dbmigrate applies the project's SQL scripts to the database and then
// checks the result against what the application code actually queries.
package dbmigrate

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/harsizcool/omegacases/installer/internal/ui"
)

// Executor is the subset of the stack that migrations need.
type Executor interface {
	ExecSQL(sql string) (string, error)
	QuerySQL(query string) (string, error)
}

// order lists the scripts in dependency order rather than alphabetically:
// 002 inserts into game_settings, so the table has to be created first, and
// the seed data has to land after the table it seeds.
var order = []string{
	"001_create_schema.sql",
	"create-game-settings.sql",
	"add-plus-column.sql",
	"add-plus-to-users.sql",
	"add-first-unboxed-by.sql",
	"002_zites_and_pools.sql",
	"003_atomic_mining_and_balance_fixes.sql",
	"004_app_schema_alignment.sql",
	"005_buyer_protection.sql",
	"006_support_tickets.sql",
	"add-case-prices-setting.sql",
}

const ledger = `CREATE TABLE IF NOT EXISTS public._omega_migrations (
  filename   TEXT PRIMARY KEY,
  checksum   TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`

// Plan returns the scripts to apply, in order: the known ones first, then any
// other .sql file in the directory so scripts added later are not skipped.
func Plan(scriptsDir string) ([]string, error) {
	entries, err := os.ReadDir(scriptsDir)
	if err != nil {
		return nil, fmt.Errorf("cannot read %s: %w", scriptsDir, err)
	}
	present := map[string]bool{}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			present[e.Name()] = true
		}
	}

	var plan []string
	known := map[string]bool{}
	for _, name := range order {
		known[name] = true
		if present[name] {
			plan = append(plan, name)
		}
	}
	var extra []string
	for name := range present {
		if !known[name] {
			extra = append(extra, name)
		}
	}
	sort.Strings(extra)
	return append(plan, extra...), nil
}

// Apply runs every planned script that has not been applied before, statement
// by statement, and records what it applied.
func Apply(ex Executor, scriptsDir string) error {
	if _, err := ex.ExecSQL(ledger); err != nil {
		return fmt.Errorf("could not create the migration ledger: %w", err)
	}

	applied, err := appliedSet(ex)
	if err != nil {
		return err
	}

	plan, err := Plan(scriptsDir)
	if err != nil {
		return err
	}

	for _, name := range plan {
		raw, err := os.ReadFile(filepath.Join(scriptsDir, name))
		if err != nil {
			return err
		}
		sum := sha256.Sum256(raw)
		checksum := hex.EncodeToString(sum[:])

		if previous, seen := applied[name]; seen {
			if previous == checksum {
				ui.Done("%s already applied", name)
				continue
			}
			ui.Step("%s changed since it was applied — running it again", name)
		} else {
			ui.Step("applying %s", name)
		}

		statements := Split(string(raw))
		var batch strings.Builder
		batch.WriteString("BEGIN;\n")
		for _, statement := range statements {
			batch.WriteString(MakeIdempotent(statement))
			batch.WriteString(";\n")
		}
		// ALTER SYSTEM and CREATE INDEX CONCURRENTLY cannot run inside a
		// transaction; none of the project's scripts use them, and the ledger
		// write belongs in the same transaction as the script itself so a
		// failure leaves no half-recorded migration.
		batch.WriteString(fmt.Sprintf(
			"INSERT INTO public._omega_migrations (filename, checksum) VALUES (%s, %s)\n"+
				"  ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now();\n",
			quote(name), quote(checksum)))
		batch.WriteString("COMMIT;\n")

		if out, err := ex.ExecSQL(batch.String()); err != nil {
			return fmt.Errorf("%s failed to apply.\n%s", name, firstError(out))
		}
		ui.Done("%s applied (%d statements)", name, len(statements))
	}
	return nil
}

func appliedSet(ex Executor) (map[string]string, error) {
	out, err := ex.QuerySQL("SELECT filename || '\t' || checksum FROM public._omega_migrations")
	if err != nil {
		return nil, fmt.Errorf("could not read the migration ledger: %w", err)
	}
	applied := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		name, checksum, found := strings.Cut(strings.TrimSpace(line), "\t")
		if found {
			applied[name] = checksum
		}
	}
	return applied, nil
}

// firstError pulls the useful line out of psql's output, which otherwise
// buries the message under notices.
func firstError(out string) string {
	var kept []string
	for _, line := range strings.Split(out, "\n") {
		if strings.Contains(line, "ERROR:") || strings.Contains(line, "DETAIL:") ||
			strings.Contains(line, "HINT:") || strings.Contains(line, "LINE ") {
			kept = append(kept, strings.TrimSpace(line))
		}
	}
	if len(kept) == 0 {
		return strings.TrimSpace(out)
	}
	return strings.Join(kept, "\n")
}

// ─── verification ───────────────────────────────────────────────────────────

// expected is the schema the application code relies on: every table it reads
// or writes, with the columns it names. It is the counterpart to the migration
// scripts — if a future feature queries something the scripts do not create,
// this check is what says so, instead of the site failing at run time.
var expected = map[string][]string{
	"users": {"id", "username", "password", "profile_picture", "balance", "zites_balance",
		"admin", "plus", "cases", "cases_remaining", "session_token", "created_at"},
	"items": {"id", "name", "image_url", "rarity", "likelihood", "market_price", "rap",
		"limited_time", "first_unboxed_by", "created_at"},
	"inventory":     {"id", "user_id", "item_id", "obtained_at"},
	"listings":      {"id", "seller_id", "item_id", "inventory_id", "price", "status", "created_at"},
	"sales":         {"id", "item_id", "seller_id", "buyer_id", "price", "sold_at"},
	"deposits":      {"id", "user_id", "payment_id", "order_id", "amount_usd", "crypto", "status", "created_at"},
	"withdrawals":   {"id", "user_id", "amount_usd", "fee_usd", "net_usd", "crypto", "wallet_address", "status"},
	"game_settings": {"key", "value"},
	"battles": {"id", "creator_id", "joiner_id", "joiner2_id", "joiner3_id", "winner_id",
		"case_count", "exclusive", "max_players", "status", "created_at", "completed_at"},
	"battle_rolls":  {"id", "battle_id", "user_id", "item_id", "roll_index", "rap"},
	"messages":      {"id", "sender_id", "receiver_id", "content", "type", "read", "created_at"},
	"notifications": {"id", "user_id", "type", "title", "body", "link", "read", "created_at"},
	"rolls":         {"id", "user_id", "item_id", "server_seed", "server_seed_hash", "client_seed", "nonce", "created_at"},
	"trades": {"id", "sender_id", "receiver_id", "sender_balance", "receiver_balance",
		"status", "created_at", "updated_at"},
	"trade_items": {"id", "trade_id", "inventory_id", "side"},
	"support_tickets": {"id", "user_id", "subject", "category", "status",
		"last_message_at", "unread_for_user", "unread_for_staff", "created_at"},
	"support_messages": {"id", "ticket_id", "author_id", "from_staff", "body", "created_at"},
	"oauth_apps":       {"id", "user_id", "name", "client_id", "client_secret", "scopes"},
	"oauth_tokens":     {"id", "app_id", "user_id", "token", "scopes", "last_used_at"},
	"oauth_requests": {"id", "user_id", "service_name", "callback_url", "redirect_url",
		"get_user_id", "get_username", "get_balance"},
	"mining_pools": {"id", "owner_id", "name", "host", "port", "status", "api_key_hash",
		"api_key_prefix", "last_heartbeat_at", "member_count"},
	"mining_pool_members":    {"id", "pool_id", "user_id"},
	"mining_pool_heartbeats": {"id", "pool_id", "ok", "latency_ms", "created_at"},
	"mining_pool_shares":     {"id", "pool_id", "user_id", "shares"},
	"mining_blocks":          {"id", "pool_id", "height", "hash", "found_at", "reward_zites"},
	"zites_orders": {"id", "user_id", "side", "order_type", "price", "quantity",
		"remaining_quantity", "status"},
	"zites_trades": {"id", "buy_order_id", "sell_order_id", "buyer_id", "seller_id",
		"price", "quantity", "executed_at"},
}

// expectedFunctions are the stored procedures the app calls through .rpc().
var expectedFunctions = []string{
	"execute_zites_trade",
	"credit_zites_balance",
	"claim_mining_block",
	"apply_difficulty_retarget",
}

// Verify compares the live schema with what the code needs. Findings are
// returned as human-readable lines; an empty result means everything matched.
func Verify(ex Executor) ([]string, error) {
	out, err := ex.QuerySQL(
		"SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = 'public'")
	if err != nil {
		return nil, err
	}
	live := map[string]bool{}
	tables := map[string]bool{}
	for _, entry := range strings.Split(out, "\n") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		live[entry] = true
		if table, _, ok := strings.Cut(entry, "."); ok {
			tables[table] = true
		}
	}

	var findings []string
	names := make([]string, 0, len(expected))
	for table := range expected {
		names = append(names, table)
	}
	sort.Strings(names)

	for _, table := range names {
		if !tables[table] {
			findings = append(findings, fmt.Sprintf("table %q is missing entirely", table))
			continue
		}
		var missing []string
		for _, column := range expected[table] {
			if !live[table+"."+column] {
				missing = append(missing, column)
			}
		}
		if len(missing) > 0 {
			findings = append(findings,
				fmt.Sprintf("table %q is missing: %s", table, strings.Join(missing, ", ")))
		}
	}

	fnOut, err := ex.QuerySQL(
		"SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'")
	if err != nil {
		return findings, nil
	}
	liveFns := map[string]bool{}
	for _, fn := range strings.Split(fnOut, "\n") {
		liveFns[strings.TrimSpace(fn)] = true
	}
	for _, fn := range expectedFunctions {
		if !liveFns[fn] {
			findings = append(findings, fmt.Sprintf("database function %q is missing", fn))
		}
	}
	return findings, nil
}

// RealtimeTables reports which of the live-feed tables are published to
// Realtime, so setup can say plainly whether live updates will work.
func RealtimeTables(ex Executor) ([]string, error) {
	out, err := ex.QuerySQL(
		"SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename")
	if err != nil {
		return nil, err
	}
	var names []string
	for _, line := range strings.Split(out, "\n") {
		if name := strings.TrimSpace(line); name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}
