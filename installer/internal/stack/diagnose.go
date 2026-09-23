package stack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/harsizcool/omegacases/installer/internal/config"
	"github.com/harsizcool/omegacases/installer/internal/runner"
)

// Check is one diagnostic result. Hint says what to do when it failed.
type Check struct {
	Name   string
	OK     bool
	Detail string
	Hint   string
}

// Diagnose works through the chain a page load actually depends on, in order,
// so the first failure names the layer at fault.
//
// The site is several parts talking to each other, and "it does not work" looks
// the same from a browser whichever part is broken. Reading the site through the
// browser only exercises half of it: pages fetch data directly, while signing up,
// logging in and every other write goes through the site's own server, which
// reaches the database by a different route. That is why a site can look fine and
// still refuse to create an account.
func (s *Stack) Diagnose() []Check {
	var checks []Check
	add := func(c Check) bool {
		checks = append(checks, c)
		return c.OK
	}

	if !add(s.checkContainers()) {
		return checks
	}
	if !add(s.checkSite()) {
		return checks
	}

	if s.cfg.DBMode == config.DBLocal {
		add(s.checkInternalURLSet())
		add(s.checkImageHasInternalRewrite())
		add(s.checkAnonRead())
		add(s.checkServiceWrite())
	}

	// The end-to-end one: the site's own server doing a write, which is what
	// signing up is. It is last because the checks above say why it failed.
	add(s.checkSignup())
	return checks
}

func (s *Stack) checkContainers() Check {
	out, err := s.compose([]string{"ps", "--format", "{{.Name}} {{.State}}"}, runner.Timeout(2*time.Minute))
	if err != nil {
		return Check{Name: "Containers", Detail: "could not ask Docker what is running",
			Hint: "Is Docker running? On Windows and macOS, open Docker Desktop."}
	}

	var stopped []string
	running := 0
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		name, state, found := strings.Cut(strings.TrimSpace(line), " ")
		if !found {
			continue
		}
		if strings.Contains(state, "running") {
			running++
		} else {
			stopped = append(stopped, name+" ("+state+")")
		}
	}

	switch {
	case running == 0 && len(stopped) == 0:
		return Check{Name: "Containers", Detail: "nothing is running",
			Hint: "The site is stopped. Start it, then run this check again."}
	case running == 0:
		// Stopped rather than never started, which is a different problem and a
		// different place to look.
		return Check{Name: "Containers",
			Detail: "all stopped: " + strings.Join(stopped, ", "),
			Hint: "These started and then quit, so the reason is in their logs:\n" +
				"    setup logs\n" +
				"Start the site again once you know why.",
		}
	case len(stopped) > 0:
		return Check{Name: "Containers",
			Detail: fmt.Sprintf("%d running, but not: %s", running, strings.Join(stopped, ", ")),
			Hint:   "Look at what those said before quitting:\n    setup logs",
		}
	}
	return Check{Name: "Containers", OK: true, Detail: fmt.Sprintf("%d running", running)}
}

func (s *Stack) checkSite() Check {
	status, err := waitForHTTP(s.probeClient(), s.cfg.PublicURL()+"/", 30*time.Second)
	if err != nil {
		return Check{Name: "Website", Detail: err.Error(),
			Hint: "The site itself is not answering. Check the web container's logs."}
	}
	return Check{Name: "Website", OK: true, Detail: fmt.Sprintf("answers on %s (%d)", s.cfg.PublicURL(), status)}
}

// checkInternalURLSet confirms the running web container knows the inside route
// to the database. Without it, every sign-up and every other write asks the
// site's own address for data, which points back at the site.
func (s *Stack) checkInternalURLSet() Check {
	out, err := s.compose([]string{"exec", "-T", "web", "printenv", "SUPABASE_INTERNAL_URL"},
		runner.Timeout(2*time.Minute))
	value := strings.TrimSpace(lastLine(out))

	if err != nil || value == "" {
		return Check{
			Name:   "Inside route to the database",
			Detail: "the web container has no SUPABASE_INTERNAL_URL set",
			Hint: "This is what breaks sign-ups while the rest of the site looks fine.\n" +
				"Run setup again and choose to update — it rewrites the settings and\n" +
				"restarts the site with them.",
		}
	}
	return Check{Name: "Inside route to the database", OK: true, Detail: value}
}

// checkImageHasInternalRewrite looks for the code that uses that route. A site
// built before it existed ignores the setting entirely, which looks identical
// from outside — and a stale image is the likeliest cause of that.
func (s *Stack) checkImageHasInternalRewrite() Check {
	out, err := s.compose(
		[]string{"exec", "-T", "web", "grep", "-l", "SUPABASE_INTERNAL_URL", "lib/supabase/server.ts"},
		runner.Timeout(2*time.Minute))
	if err != nil || !strings.Contains(out, "server.ts") {
		return Check{
			Name:   "Site build",
			Detail: "the running site was built before the sign-up fix",
			Hint: "The code in this folder is newer than what is running. Rebuild it:\n" +
				"    setup update\n" +
				"That is almost certainly the problem.",
		}
	}
	return Check{Name: "Site build", OK: true, Detail: "includes the inside-route fix"}
}

func (s *Stack) checkAnonRead() Check {
	anon, _ := s.cfg.Keys()
	status, body, err := s.apiRequest("GET", "/rest/v1/items?select=id&limit=1", anon, nil)
	if err != nil {
		return Check{Name: "Reading data (what pages use)", Detail: err.Error(),
			Hint: "The data service is not reachable. Check the rest container's logs."}
	}
	if status != http.StatusOK {
		return Check{Name: "Reading data (what pages use)",
			Detail: fmt.Sprintf("replied %d: %s", status, short(body)),
			Hint:   "Pages will show nothing. Check the rest container's logs."}
	}
	return Check{Name: "Reading data (what pages use)", OK: true, Detail: "working"}
}

// checkServiceWrite proves the key the site writes with is accepted and allowed
// to write, using a settings row it removes afterwards.
func (s *Stack) checkServiceWrite() Check {
	_, service := s.cfg.Keys()
	const key = "_omega_write_test"

	payload, _ := json.Marshal([]map[string]any{{"key": key, "value": json.RawMessage(`"ok"`)}})
	status, body, err := s.apiRequest("POST", "/rest/v1/game_settings?on_conflict=key", service, payload)
	if err != nil {
		return Check{Name: "Writing data (what sign-ups use)", Detail: err.Error(),
			Hint: "The data service is not reachable for writes."}
	}

	// Tidy up whatever the attempt left behind before reporting.
	defer func() {
		_, _, _ = s.apiRequest("DELETE", "/rest/v1/game_settings?key=eq."+key, service, nil)
	}()

	if status >= 300 {
		hint := "The site can read but not write, so nothing can be created."
		switch {
		case status == http.StatusUnauthorized:
			hint = "The database is rejecting the site's key. The keys and the database\n" +
				"no longer match — most likely the database was kept from an older\n" +
				"install. On a test copy, the fix is to start its storage fresh:\n" +
				"    cd omega-stack && docker compose down -v\n" +
				"then run setup again. That deletes the site's data."
		case strings.Contains(strings.ToLower(string(body)), "row-level security"):
			hint = "The database is refusing writes from the site's role. Run setup\n" +
				"again and let it apply the database scripts."
		case strings.Contains(strings.ToLower(string(body)), "permission denied"):
			hint = "The site's role is missing permission on the tables. Run setup\n" +
				"again and let it apply the database scripts."
		}
		return Check{Name: "Writing data (what sign-ups use)",
			Detail: fmt.Sprintf("replied %d: %s", status, short(body)), Hint: hint}
	}
	return Check{Name: "Writing data (what sign-ups use)", OK: true, Detail: "working"}
}

// checkSignup creates a throwaway account through the site's own sign-up page,
// exactly as a visitor would, then removes it again.
func (s *Stack) checkSignup() Check {
	name := fmt.Sprintf("omegacheck%d", time.Now().Unix()%100000)

	payload, _ := json.Marshal(map[string]string{"username": name, "password": "check-only-password"})
	req, err := http.NewRequest("POST", s.cfg.PublicURL()+"/api/auth/register", bytes.NewReader(payload))
	if err != nil {
		return Check{Name: "Creating an account", Detail: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.probeClient().Do(req)
	if err != nil {
		return Check{Name: "Creating an account", Detail: err.Error(),
			Hint: "The site did not answer at all."}
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	resp.Body.Close()

	if s.cfg.DBMode == config.DBLocal {
		defer func() {
			_, _ = s.ExecSQL(fmt.Sprintf("DELETE FROM public.users WHERE username = %s;", sqlLiteral(name)))
		}()
	}

	if resp.StatusCode >= 300 {
		return Check{Name: "Creating an account",
			Detail: fmt.Sprintf("the site replied %d: %s", resp.StatusCode, short(body)),
			Hint: "This is the sign-up problem itself. The checks above say which\n" +
				"part is at fault; if they all passed, send this line on.",
		}
	}
	return Check{Name: "Creating an account", OK: true, Detail: "working"}
}

// apiRequest calls the data API the way the site does, with the given key.
func (s *Stack) apiRequest(method, path, key string, body []byte) (int, []byte, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, s.cfg.SupabaseEndpoint()+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		// Replace a row of the same key rather than failing on it, so a repeated
		// check does not trip over its own leftovers.
		req.Header.Set("Prefer", "resolution=merge-duplicates")
	}

	resp, err := s.probeClient().Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return resp.StatusCode, out, nil
}

func short(body []byte) string {
	text := strings.TrimSpace(string(body))
	text = strings.ReplaceAll(text, "\n", " ")
	if len(text) > 200 {
		text = text[:200] + "…"
	}
	if text == "" {
		return "(no message)"
	}
	return text
}
