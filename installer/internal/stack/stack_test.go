package stack

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/harsizcool/omegacases/installer/internal/config"
	"github.com/harsizcool/omegacases/installer/internal/runner"
)

func writeStack(t *testing.T, cfg *config.Config) string {
	t.Helper()
	dir := t.TempDir()
	cfg.ProjectDir = dir
	if err := cfg.EnsureSecrets(); err != nil {
		t.Fatal(err)
	}
	r, err := runner.New(dir, filepath.Join(dir, "log.txt"))
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if err := New(cfg, r).Write(); err != nil {
		t.Fatal(err)
	}
	return cfg.StackDir()
}

func read(t *testing.T, dir, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("%s was not written: %v", name, err)
	}
	return string(b)
}

func TestWriteDomainStack(t *testing.T) {
	cfg := &config.Config{
		Exposure: config.ExposeDomain, Domain: "omegacases.com", ACMEEmail: "me@example.com",
		HTTPPort: "80", HTTPSPort: "443", DBMode: config.DBLocal,
	}
	dir := writeStack(t, cfg)

	for _, name := range []string{
		"docker-compose.yml", "Caddyfile", "bootstrap.sql", "init-roles.sql", ".env",
		"Dockerfile.web", "Dockerfile.web.dockerignore",
		"start.cmd", "stop.cmd", "omega.sh",
	} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("%s was not written", name)
		}
	}

	// The service roles' passwords can only be set while the database is being
	// created, so this file has to be mounted where PostgreSQL will run it and
	// has to carry the password the services will use.
	init := read(t, dir, "init-roles.sql")
	if !strings.Contains(init, "'"+cfg.PostgresPassword+"'") {
		t.Error("init-roles.sql does not set this stack's password")
	}
	for _, role := range []string{"authenticator", "supabase_storage_admin", "supabase_admin"} {
		if !strings.Contains(init, role) {
			t.Errorf("init-roles.sql does not provision %s", role)
		}
	}
	if !strings.Contains(read(t, dir, "docker-compose.yml"), "/docker-entrypoint-initdb.d/") {
		t.Error("init-roles.sql is not mounted where PostgreSQL will run it")
	}

	compose := read(t, dir, "docker-compose.yml")
	for _, service := range []string{"db:", "rest:", "realtime:", "storage:", "web:", "proxy:"} {
		if !strings.Contains(compose, service) {
			t.Errorf("compose file is missing the %s service", service)
		}
	}
	if !strings.Contains(compose, `"443:443"`) {
		t.Error("HTTPS port is not published in domain mode")
	}

	caddy := read(t, dir, "Caddyfile")
	if !strings.Contains(caddy, "email {$ACME_EMAIL}") {
		t.Error("automatic HTTPS is not configured in domain mode")
	}
	for _, route := range []string{"/rest/v1/*", "/storage/v1/*", "/realtime/v1/*"} {
		if !strings.Contains(caddy, route) {
			t.Errorf("the proxy does not route %s", route)
		}
	}
	// The site's own server-side code reaches the API through this listener,
	// because the public address resolves back to the site from inside the
	// container network.
	if !strings.Contains(caddy, ":8080 {") {
		t.Error("the internal listener is missing")
	}

	env := config.ReadEnvFile(filepath.Join(dir, ".env"))
	if env["SITE_ADDRESS"] != "omegacases.com" {
		t.Errorf("SITE_ADDRESS is %q", env["SITE_ADDRESS"])
	}
	if env["NEXT_PUBLIC_SUPABASE_URL"] != "https://omegacases.com" {
		t.Errorf("the app points at %q, not its own origin", env["NEXT_PUBLIC_SUPABASE_URL"])
	}
	if env["SUPABASE_INTERNAL_URL"] != "http://proxy:8080" {
		t.Errorf("SUPABASE_INTERNAL_URL is %q", env["SUPABASE_INTERNAL_URL"])
	}
	if env["JWT_SECRET"] == "" || env["ANON_KEY"] == "" || env["SERVICE_ROLE_KEY"] == "" {
		t.Error("the stack secrets were not written")
	}

	// The generated password is embedded in SQL, so it must be quoted there.
	bootstrap := read(t, dir, "bootstrap.sql")
	if !strings.Contains(bootstrap, "'"+cfg.PostgresPassword+"'") {
		t.Error("the database password is not a quoted SQL literal in bootstrap.sql")
	}
}

func TestWriteLocalOnlyStack(t *testing.T) {
	cfg := &config.Config{
		Exposure: config.ExposeLocal, HTTPPort: "3000", DBMode: config.DBLocal,
	}
	dir := writeStack(t, cfg)

	compose := read(t, dir, "docker-compose.yml")
	if strings.Contains(compose, ":443") {
		t.Error("HTTPS is published even though this is a local-only install")
	}
	if !strings.Contains(compose, `"3000:80"`) {
		t.Error("the chosen port is not published")
	}

	caddy := read(t, dir, "Caddyfile")
	if !strings.Contains(caddy, "auto_https off") {
		t.Error("automatic HTTPS should be off without a domain")
	}

	env := config.ReadEnvFile(filepath.Join(dir, ".env"))
	if env["SITE_ADDRESS"] != ":80" {
		t.Errorf("SITE_ADDRESS is %q, want the container-internal port", env["SITE_ADDRESS"])
	}
	if env["NEXT_PUBLIC_APP_URL"] != "http://localhost:3000" {
		t.Errorf("the app URL is %q", env["NEXT_PUBLIC_APP_URL"])
	}
}

// A hosted-Supabase install has no database services of its own and must not
// leak local secrets into the stack env.
func TestWriteHostedStackHasNoLocalServices(t *testing.T) {
	cfg := &config.Config{
		Exposure: config.ExposeDomain, Domain: "omegacases.com", ACMEEmail: "me@example.com",
		HTTPPort: "80", HTTPSPort: "443", DBMode: config.DBHosted,
		SupabaseURL: "https://abc.supabase.co", HostedAnonKey: "anon-key", HostedServiceKey: "service-key",
	}
	dir := writeStack(t, cfg)

	compose := read(t, dir, "docker-compose.yml")
	for _, service := range []string{"  db:", "  rest:", "  realtime:", "  storage:"} {
		if strings.Contains(compose, service) {
			t.Errorf("%s should not be deployed against a hosted Supabase project", strings.TrimSpace(service))
		}
	}
	if !strings.Contains(compose, "  web:") || !strings.Contains(compose, "  proxy:") {
		t.Error("the site and proxy are still required")
	}

	caddy := read(t, dir, "Caddyfile")
	if strings.Contains(caddy, "/rest/v1/*") {
		t.Error("API paths should not be proxied when the API is hosted elsewhere")
	}

	env := config.ReadEnvFile(filepath.Join(dir, ".env"))
	if env["NEXT_PUBLIC_SUPABASE_URL"] != "https://abc.supabase.co" {
		t.Errorf("the app points at %q", env["NEXT_PUBLIC_SUPABASE_URL"])
	}
	if env["POSTGRES_PASSWORD"] != "" || env["JWT_SECRET"] != "" {
		t.Error("local database secrets leaked into a hosted install")
	}
	if env["SUPABASE_INTERNAL_URL"] != "" {
		t.Error("a hosted project is reachable directly; no internal URL should be set")
	}
}

// omega.sh is copied onto Linux machines, where CRLF line endings would make
// the shebang unusable.
func TestShellScriptHasUnixLineEndings(t *testing.T) {
	cfg := &config.Config{Exposure: config.ExposeLocal, HTTPPort: "3000", DBMode: config.DBLocal}
	dir := writeStack(t, cfg)
	if strings.Contains(read(t, dir, "omega.sh"), "\r\n") {
		t.Error("omega.sh has Windows line endings")
	}
}
