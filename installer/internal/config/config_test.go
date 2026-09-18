package config

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The API keys are HS256 tokens over the stack's JWT secret. If they do not
// verify, PostgREST rejects every request, so this is the one piece of crypto
// worth asserting directly.
func TestSignSupabaseJWTVerifies(t *testing.T) {
	const secret = "0123456789abcdef0123456789abcdef0123456789abcdef"
	token, err := SignSupabaseJWT(secret, "service_role")
	if err != nil {
		t.Fatal(err)
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("expected three JWT segments, got %d", len(parts))
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0] + "." + parts[1]))
	want := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if parts[2] != want {
		t.Error("the signature does not verify against the secret")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	var claims map[string]any
	if err := json.Unmarshal(payload, &claims); err != nil {
		t.Fatal(err)
	}
	if claims["role"] != "service_role" {
		t.Errorf("role claim is %v, want service_role", claims["role"])
	}
	if claims["iss"] != "supabase" {
		t.Errorf("iss claim is %v, want supabase", claims["iss"])
	}
	exp, ok := claims["exp"].(float64)
	if !ok || exp <= 0 {
		t.Errorf("exp claim is missing or unusable: %v", claims["exp"])
	}
}

func TestEnsureSecretsIsStableAcrossRuns(t *testing.T) {
	cfg := &Config{DBMode: DBLocal}
	if err := cfg.EnsureSecrets(); err != nil {
		t.Fatal(err)
	}
	first := *cfg
	if err := cfg.EnsureSecrets(); err != nil {
		t.Fatal(err)
	}
	// Re-running setup must not rotate keys the running containers were built
	// with, or the site would lose access to its own data.
	if cfg.JWTSecret != first.JWTSecret || cfg.AnonKey != first.AnonKey ||
		cfg.ServiceRoleKey != first.ServiceRoleKey || cfg.PostgresPassword != first.PostgresPassword {
		t.Error("secrets changed on a second call")
	}
	if len(cfg.JWTSecret) < 32 {
		t.Errorf("JWT secret is %d characters; PostgREST requires at least 32", len(cfg.JWTSecret))
	}
	if len(cfg.RealtimeEncKey) != 16 {
		t.Errorf("realtime encryption key is %d bytes, must be 16", len(cfg.RealtimeEncKey))
	}
}

func TestWriteEnvFileKeepsUnmanagedKeysAndBacksUp(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env.local")
	original := "HAND_WRITTEN=keep-me\nNEXT_PUBLIC_APP_URL=http://old\n"
	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}

	backup, err := WriteEnvFile(path, "# header\n", map[string]string{
		"NEXT_PUBLIC_APP_URL": "https://new",
		"EMPTY_IS_SKIPPED":    "",
	})
	if err != nil {
		t.Fatal(err)
	}
	if backup == "" {
		t.Error("no backup was taken of the previous file")
	} else if data, err := os.ReadFile(backup); err != nil || string(data) != original {
		t.Error("the backup does not hold the previous contents")
	}

	written := ReadEnvFile(path)
	if written["HAND_WRITTEN"] != "keep-me" {
		t.Error("a hand-written key was lost")
	}
	if written["NEXT_PUBLIC_APP_URL"] != "https://new" {
		t.Errorf("managed key was not updated: %q", written["NEXT_PUBLIC_APP_URL"])
	}
	if _, present := written["EMPTY_IS_SKIPPED"]; present {
		t.Error("an empty value should not be written")
	}
}

func TestSupabaseEndpointMatchesExposure(t *testing.T) {
	local := &Config{DBMode: DBLocal, Exposure: ExposeDomain, Domain: "omegacases.com"}
	if got := local.SupabaseEndpoint(); got != "https://omegacases.com" {
		t.Errorf("local stack endpoint is %q, want the site's own origin", got)
	}

	hosted := &Config{DBMode: DBHosted, SupabaseURL: "https://abc.supabase.co/"}
	if got := hosted.SupabaseEndpoint(); got != "https://abc.supabase.co" {
		t.Errorf("hosted endpoint is %q, want the trailing slash removed", got)
	}

	onPort := &Config{DBMode: DBLocal, Exposure: ExposeLocal, HTTPPort: "3000"}
	if got := onPort.PublicURL(); got != "http://localhost:3000" {
		t.Errorf("local URL is %q", got)
	}
}
