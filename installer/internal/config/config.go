// Package config holds the answers setup collects, the secrets it mints, and
// the reading and writing of the two env files: the app's .env.local and the
// Docker stack's own .env.
package config

import (
	"bufio"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// DBMode selects where the application's data lives.
type DBMode string

const (
	// DBLocal runs Postgres, PostgREST, Realtime and Storage on this machine.
	DBLocal DBMode = "local"
	// DBHosted points the app at an existing Supabase project.
	DBHosted DBMode = "hosted"
)

// Exposure selects how the site is reached from outside.
type Exposure string

const (
	// ExposeDomain serves a real domain over HTTPS with certificates from
	// Let's Encrypt.
	ExposeDomain Exposure = "domain"
	// ExposeLocal serves plain HTTP on this machine only.
	ExposeLocal Exposure = "local"
)

// Config is everything setup needs to write the stack out. It is persisted to
// omega-setup.json next to the generated stack so a re-run can offer the
// previous answers as defaults.
type Config struct {
	Version string `json:"version"`
	Saved   string `json:"saved_at"`

	ProjectDir string   `json:"project_dir"`
	Exposure   Exposure `json:"exposure"`
	Domain     string   `json:"domain"`
	ACMEEmail  string   `json:"acme_email"`
	HTTPPort   string   `json:"http_port"`
	HTTPSPort  string   `json:"https_port"`

	DBMode DBMode `json:"db_mode"`

	// Local stack secrets. Generated once and then reused, because rotating
	// them would invalidate the keys already baked into a built image.
	PostgresPassword string `json:"postgres_password,omitempty"`
	JWTSecret        string `json:"jwt_secret,omitempty"`
	AnonKey          string `json:"anon_key,omitempty"`
	ServiceRoleKey   string `json:"service_role_key,omitempty"`
	RealtimeEncKey   string `json:"realtime_enc_key,omitempty"`
	RealtimeSecret   string `json:"realtime_secret_key_base,omitempty"`

	// Hosted Supabase details, used when DBMode is DBHosted.
	SupabaseURL string `json:"supabase_url,omitempty"`

	// Integrations. Secrets are kept in the app env file rather than here.
	NowPaymentsAPIKey    string `json:"-"`
	NowPaymentsIPNSecret string `json:"-"`
	DiscordWebhook       string `json:"-"`
	HostedAnonKey        string `json:"-"`
	HostedServiceKey     string `json:"-"`

	AdminUsername string `json:"admin_username,omitempty"`
	AdminPassword string `json:"-"`
	SeedItems     bool   `json:"seed_items"`
}

// StackDir is the directory the generated Docker stack is written to.
func (c *Config) StackDir() string { return filepath.Join(c.ProjectDir, "omega-stack") }

// SavePath is where the reusable answers live.
func (c *Config) SavePath() string { return filepath.Join(c.StackDir(), "omega-setup.json") }

// PublicURL is the address the finished site answers on.
func (c *Config) PublicURL() string {
	if c.Exposure == ExposeDomain {
		return "https://" + c.Domain
	}
	port := c.HTTPPort
	if port == "" || port == "80" {
		return "http://localhost"
	}
	return "http://localhost:" + port
}

// SupabaseEndpoint is the URL the app talks to for data. On a local stack the
// reverse proxy serves the Supabase API paths on the same origin as the site,
// which keeps it to a single DNS name and a single certificate.
func (c *Config) SupabaseEndpoint() string {
	if c.DBMode == DBHosted {
		return strings.TrimRight(c.SupabaseURL, "/")
	}
	return c.PublicURL()
}

// Keys returns the anon and service role keys for the chosen database.
func (c *Config) Keys() (anon, service string) {
	if c.DBMode == DBHosted {
		return c.HostedAnonKey, c.HostedServiceKey
	}
	return c.AnonKey, c.ServiceRoleKey
}

// EnsureSecrets mints any local-stack secret that is not already set, so a
// re-run keeps the keys the running containers were built with.
func (c *Config) EnsureSecrets() error {
	if c.DBMode != DBLocal {
		return nil
	}
	var err error
	if c.PostgresPassword == "" {
		if c.PostgresPassword, err = randomAlphanumeric(32); err != nil {
			return err
		}
	}
	if c.JWTSecret == "" {
		// PostgREST requires at least 32 characters for an HS256 secret.
		if c.JWTSecret, err = randomAlphanumeric(48); err != nil {
			return err
		}
	}
	if c.RealtimeEncKey == "" {
		// Realtime encrypts tenant rows with AES-128, so this must be 16 bytes.
		if c.RealtimeEncKey, err = randomAlphanumeric(16); err != nil {
			return err
		}
	}
	if c.RealtimeSecret == "" {
		if c.RealtimeSecret, err = randomAlphanumeric(64); err != nil {
			return err
		}
	}
	// The API keys are JWTs over the same secret, so they are always
	// regenerated when the secret changes and reused when it does not.
	if c.AnonKey == "" {
		if c.AnonKey, err = SignSupabaseJWT(c.JWTSecret, "anon"); err != nil {
			return err
		}
	}
	if c.ServiceRoleKey == "" {
		if c.ServiceRoleKey, err = SignSupabaseJWT(c.JWTSecret, "service_role"); err != nil {
			return err
		}
	}
	return nil
}

// SignSupabaseJWT mints the long-lived HS256 token that PostgREST, Realtime
// and Storage all accept as an API key for the given role.
func SignSupabaseJWT(secret, role string) (string, error) {
	now := time.Now()
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	claims := map[string]any{
		"role": role,
		"iss":  "supabase",
		"iat":  now.Unix(),
		"exp":  now.AddDate(10, 0, 0).Unix(),
	}
	encode := func(v any) (string, error) {
		b, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return base64.RawURLEncoding.EncodeToString(b), nil
	}
	h, err := encode(header)
	if err != nil {
		return "", err
	}
	p, err := encode(claims)
	if err != nil {
		return "", err
	}
	signingInput := h + "." + p
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return signingInput + "." + sig, nil
}

func randomAlphanumeric(n int) (string, error) {
	// Hex keeps the value safe to paste into YAML, shell and URLs without
	// quoting, which matters because these land in several file formats.
	buf := make([]byte, (n+1)/2)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("cannot generate a secure random value: %w", err)
	}
	return hex.EncodeToString(buf)[:n], nil
}

// RandomToken is used for one-off values such as a generated admin password.
func RandomToken(n int) (string, error) { return randomAlphanumeric(n) }

// Save writes the reusable answers next to the stack.
func (c *Config) Save() error {
	c.Saved = time.Now().Format(time.RFC3339)
	if err := os.MkdirAll(c.StackDir(), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.SavePath(), append(b, '\n'), 0o600)
}

// Load reads previously saved answers. A missing file is not an error: it
// simply means this is a first run.
func Load(projectDir string) (*Config, bool) {
	path := filepath.Join(projectDir, "omega-stack", "omega-setup.json")
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	var c Config
	if json.Unmarshal(b, &c) != nil {
		return nil, false
	}
	c.ProjectDir = projectDir
	return &c, true
}

// ─── env files ──────────────────────────────────────────────────────────────

// ReadEnvFile parses a KEY=VALUE file, ignoring comments and blank lines.
// Values wrapped in matching quotes are unwrapped.
func ReadEnvFile(path string) map[string]string {
	values := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return values
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
		value = strings.TrimSpace(value)
		if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
			value = value[1 : len(value)-1]
		}
		values[key] = value
	}
	return values
}

// WriteEnvFile writes values to path, preserving any keys already in the file
// that setup does not manage, and keeping a timestamped backup of what was
// there before. Nothing the operator had configured by hand is lost.
func WriteEnvFile(path, header string, managed map[string]string) (backup string, err error) {
	existing := ReadEnvFile(path)

	if _, statErr := os.Stat(path); statErr == nil {
		backup = fmt.Sprintf("%s.backup-%s", path, time.Now().Format("20060102-150405"))
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return "", readErr
		}
		if err := os.WriteFile(backup, data, 0o600); err != nil {
			return "", err
		}
	}

	// Managed keys win; unmanaged keys are carried over underneath.
	var carried []string
	for key := range existing {
		if _, isManaged := managed[key]; !isManaged {
			carried = append(carried, key)
		}
	}
	sort.Strings(carried)

	managedKeys := make([]string, 0, len(managed))
	for key := range managed {
		managedKeys = append(managedKeys, key)
	}
	sort.Strings(managedKeys)

	var b strings.Builder
	b.WriteString(header)
	for _, key := range managedKeys {
		if managed[key] == "" {
			continue
		}
		fmt.Fprintf(&b, "%s=%s\n", key, managed[key])
	}
	if len(carried) > 0 {
		b.WriteString("\n# Kept from the previous version of this file.\n")
		for _, key := range carried {
			fmt.Fprintf(&b, "%s=%s\n", key, existing[key])
		}
	}

	if err := os.WriteFile(path, []byte(b.String()), 0o600); err != nil {
		return backup, err
	}
	return backup, nil
}

// AppEnv is the set of variables the Next.js application reads.
func (c *Config) AppEnv() map[string]string {
	anon, service := c.Keys()
	endpoint := c.SupabaseEndpoint()
	env := map[string]string{
		"NEXT_PUBLIC_SUPABASE_URL":      endpoint,
		"NEXT_PUBLIC_SUPABASE_ANON_KEY": anon,
		"SUPABASE_SERVICE_ROLE_KEY":     service,
		"NEXT_PUBLIC_APP_URL":           c.PublicURL(),
	}
	if c.NowPaymentsAPIKey != "" {
		env["NOWPAYMENTS_API_KEY"] = c.NowPaymentsAPIKey
	}
	if c.NowPaymentsIPNSecret != "" {
		env["NOWPAYMENTS_IPN_SECRET"] = c.NowPaymentsIPNSecret
	}
	if c.DiscordWebhook != "" {
		env["DISCORD_WEBHOOK_URL"] = c.DiscordWebhook
	}
	return env
}

// AppEnvHeader explains the generated app env file to whoever opens it next.
func AppEnvHeader() string {
	return "# Generated by the OmegaCases setup program.\n" +
		"# Re-run setup to change these values; hand edits are kept but a backup\n" +
		"# of the previous file is written alongside it.\n\n"
}
