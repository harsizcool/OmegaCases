package dbmigrate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSplitKeepsDollarQuotedBodiesIntact(t *testing.T) {
	script := `
CREATE TABLE a (id int);

CREATE OR REPLACE FUNCTION f() RETURNS void AS $$
BEGIN
  PERFORM 1; PERFORM 2;
END
$$ LANGUAGE plpgsql;

DO $mig$
BEGIN
  IF TRUE THEN
    RAISE NOTICE 'semi; colon';
  END IF;
END
$mig$;
`
	got := Split(script)
	if len(got) != 3 {
		t.Fatalf("expected 3 statements, got %d: %#v", len(got), got)
	}
	if !strings.Contains(got[1], "PERFORM 1; PERFORM 2;") {
		t.Errorf("function body was split apart: %q", got[1])
	}
	if !strings.Contains(got[2], "semi; colon") {
		t.Errorf("tagged dollar body was split apart: %q", got[2])
	}
}

func TestSplitIgnoresSemicolonsInLiteralsAndComments(t *testing.T) {
	script := `
INSERT INTO t (v) VALUES ('a;b', 'it''s; fine'); -- trailing; comment
/* block; comment */ SELECT 1;
SELECT "weird;column" FROM t;
`
	got := Split(script)
	if len(got) != 3 {
		t.Fatalf("expected 3 statements, got %d: %#v", len(got), got)
	}
	if !strings.Contains(got[0], "it''s; fine") {
		t.Errorf("escaped quote handling broke the literal: %q", got[0])
	}
	if !strings.Contains(got[2], `"weird;column"`) {
		t.Errorf("quoted identifier was split: %q", got[2])
	}
}

func TestMakeIdempotentGuardsCreatePolicy(t *testing.T) {
	cases := []struct {
		name string
		in   string
	}{
		// 001 uses a clause PostgreSQL does not actually support.
		{"if not exists", `CREATE POLICY IF NOT EXISTS "users_select_all" ON public.users FOR SELECT USING (true)`},
		// 002 uses a plain create, which fails the second time it runs.
		{"plain", `CREATE POLICY "zites_orders_select_all" ON public.zites_orders FOR SELECT USING (true)`},
		{"unquoted name", `create policy pool_select on mining_pools for select using (true)`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := MakeIdempotent(tc.in)
			if !strings.HasPrefix(out, "DO $omega_guard$") {
				t.Fatalf("statement was not guarded:\n%s", out)
			}
			if strings.Contains(out, "IF NOT EXISTS 'users_select_all'") {
				t.Error("the unsupported clause survived into the executed statement")
			}
			if !strings.Contains(out, "FROM pg_policies") {
				t.Error("the guard does not check pg_policies")
			}
			if strings.Contains(strings.ToUpper(out), "IF NOT EXISTS \"") {
				t.Errorf("the invalid clause is still in the inner statement:\n%s", out)
			}
		})
	}
}

func TestMakeIdempotentLeavesOtherStatementsAlone(t *testing.T) {
	for _, statement := range []string{
		"CREATE TABLE IF NOT EXISTS t (id int)",
		"ALTER TABLE t ENABLE ROW LEVEL SECURITY",
		`DROP POLICY IF EXISTS "x" ON t`,
	} {
		if got := MakeIdempotent(statement); got != statement {
			t.Errorf("%q was rewritten to %q", statement, got)
		}
	}
}

// TestProjectScriptsSplitCleanly runs the splitter over the repository's real
// SQL, which is the input that actually matters.
func TestProjectScriptsSplitCleanly(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "scripts")
	plan, err := Plan(dir)
	if err != nil {
		t.Skipf("scripts directory not available: %v", err)
	}
	if len(plan) == 0 {
		t.Fatal("no SQL scripts were planned")
	}

	for _, name := range plan {
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		statements := Split(string(raw))
		if len(statements) == 0 {
			t.Errorf("%s produced no statements", name)
		}
		for _, statement := range statements {
			// An unbalanced dollar quote is the failure mode that would corrupt
			// a migration, so it is worth asserting directly.
			if strings.Count(statement, "$$")%2 != 0 {
				t.Errorf("%s: unbalanced $$ in statement:\n%s", name, statement)
			}
			if strings.Count(statement, "$mig$")%2 != 0 {
				t.Errorf("%s: unbalanced $mig$ in statement:\n%s", name, statement)
			}
			if after := MakeIdempotent(statement); strings.Contains(
				strings.ToUpper(after), "CREATE POLICY IF NOT EXISTS") {
				t.Errorf("%s: an unsupported CREATE POLICY survived:\n%s", name, after)
			}
		}
	}
}

func TestPlanOrdersDependenciesFirst(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "scripts")
	plan, err := Plan(dir)
	if err != nil {
		t.Skipf("scripts directory not available: %v", err)
	}
	index := map[string]int{}
	for i, name := range plan {
		index[name] = i
	}
	// game_settings has to exist before 002 inserts its mining defaults.
	if a, ok := index["create-game-settings.sql"]; ok {
		if b, ok := index["002_zites_and_pools.sql"]; ok && a > b {
			t.Errorf("create-game-settings.sql (%d) must come before 002 (%d)", a, b)
		}
	}
	if a, ok := index["001_create_schema.sql"]; ok && a != 0 {
		t.Errorf("001 should be applied first, got position %d", a)
	}
}
