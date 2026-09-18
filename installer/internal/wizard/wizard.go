// Package wizard is the interview: the questions setup asks before it changes
// anything, written for someone who has not deployed a web application before.
package wizard

import (
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"

	"github.com/harsizcool/omegacases/installer/internal/config"
	"github.com/harsizcool/omegacases/installer/internal/ui"
)

var domainPattern = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$`)

// Run collects the configuration. previous, when present, supplies defaults
// from an earlier run so a re-run is mostly pressing Enter.
func Run(projectDir string, previous *config.Config) (*config.Config, error) {
	cfg := &config.Config{
		ProjectDir: projectDir,
		HTTPPort:   "80",
		HTTPSPort:  "443",
		Exposure:   config.ExposeDomain,
		DBMode:     config.DBLocal,
	}
	if previous != nil {
		// Secrets carry over so the running containers keep working.
		cfg.PostgresPassword = previous.PostgresPassword
		cfg.JWTSecret = previous.JWTSecret
		cfg.AnonKey = previous.AnonKey
		cfg.ServiceRoleKey = previous.ServiceRoleKey
		cfg.RealtimeEncKey = previous.RealtimeEncKey
		cfg.RealtimeSecret = previous.RealtimeSecret
		cfg.HTTPPort = orDefault(previous.HTTPPort, "80")
		cfg.HTTPSPort = orDefault(previous.HTTPSPort, "443")
	}

	askExposure(cfg, previous)
	askDatabase(cfg, previous)
	askIntegrations(cfg)
	askAdmin(cfg, previous)

	return cfg, nil
}

func askExposure(cfg *config.Config, previous *config.Config) {
	ui.Say("")
	ui.Say("First, how should people reach the site?")

	def := 0
	if previous != nil && previous.Exposure == config.ExposeLocal {
		def = 1
	}
	choice := ui.Choice("Where will this run?", []string{
		"On a real domain, with HTTPS\nSetup gets and renews the certificate itself. You need a domain whose\nDNS A record already points at this machine, and ports 80 and 443 free.",
		"On this computer only, for trying it out\nReachable at http://localhost. No domain or certificate needed.",
	}, def)

	if choice == 1 {
		cfg.Exposure = config.ExposeLocal
		port := ui.Ask("Which port should the site use?", orDefault(previousPort(previous), "3000"))
		cfg.HTTPPort = sanitisePort(port, "3000")
		cfg.HTTPSPort = ""
		return
	}

	cfg.Exposure = config.ExposeDomain
	for {
		domain := ui.Ask("What is the domain?", previousDomain(previous))
		domain = strings.ToLower(strings.TrimSpace(domain))
		domain = strings.TrimPrefix(strings.TrimPrefix(domain, "https://"), "http://")
		domain = strings.TrimSuffix(domain, "/")
		if strings.Contains(domain, "/") {
			domain = strings.SplitN(domain, "/", 2)[0]
		}
		if !domainPattern.MatchString(domain) {
			ui.Warn("That does not look like a domain. Type it like: omegacases.com")
			continue
		}
		if net.ParseIP(domain) != nil {
			ui.Warn("A certificate cannot be issued for an IP address. Use a domain name.")
			continue
		}
		cfg.Domain = domain
		break
	}

	ui.Say("")
	ui.Say("  %s", ui.Dim("Let's Encrypt needs an email address to warn you if a certificate"))
	ui.Say("  %s", ui.Dim("is about to expire. It is not shown on the site."))
	for {
		email := ui.Ask("Email address for certificate notices", previousEmail(previous))
		if strings.Count(email, "@") == 1 && !strings.HasPrefix(email, "@") && strings.Contains(email, ".") {
			cfg.ACMEEmail = email
			break
		}
		ui.Warn("Please enter a valid email address.")
	}
}

func askDatabase(cfg *config.Config, previous *config.Config) {
	ui.Say("")
	ui.Say("Next, where should the data live?")

	def := 0
	if previous != nil && previous.DBMode == config.DBHosted {
		def = 1
	}
	choice := ui.Choice("Which database?", []string{
		"Set one up on this machine (recommended)\nSetup installs and configures everything: the database, the data API,\nlive updates and image storage. Nothing to sign up for.",
		"Use a Supabase project I already have\nYou paste the project URL and its two keys. Setup will not create or\nchange tables unless you let it run the migrations.",
	}, def)

	if choice == 0 {
		cfg.DBMode = config.DBLocal
		return
	}

	cfg.DBMode = config.DBHosted
	ui.Say("")
	ui.Say("  %s", ui.Dim("Find these in your Supabase dashboard under Project Settings → API."))
	for {
		url := strings.TrimRight(strings.TrimSpace(ui.Ask("Supabase project URL", previousSupabaseURL(previous))), "/")
		if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
			cfg.SupabaseURL = url
			break
		}
		ui.Warn("That should start with https:// — for example https://abcdefgh.supabase.co")
	}
	for cfg.HostedAnonKey == "" {
		cfg.HostedAnonKey = ui.AskSecret("Supabase anon / publishable key")
		if cfg.HostedAnonKey == "" {
			ui.Warn("The site cannot read any data without this key.")
		}
	}
	for cfg.HostedServiceKey == "" {
		cfg.HostedServiceKey = ui.AskSecret("Supabase service role / secret key")
		if cfg.HostedServiceKey == "" {
			ui.Warn("The site's own API routes cannot write without this key.")
		}
	}
}

func askIntegrations(cfg *config.Config) {
	ui.Say("")
	ui.Say("Now the optional API keys. Skip any you do not have — the site runs")
	ui.Say("without them, and you can re-run setup later to fill them in.")
	ui.Say("")
	ui.Say("  %s", ui.Dim("NOWPayments handles crypto deposits and withdrawals."))
	ui.Say("  %s", ui.Dim("Without it, everything except paying in and cashing out works."))
	cfg.NowPaymentsAPIKey = ui.AskSecret("NOWPayments API key")
	if cfg.NowPaymentsAPIKey != "" {
		cfg.NowPaymentsIPNSecret = ui.AskSecret("NOWPayments IPN secret")
		if cfg.NowPaymentsIPNSecret == "" {
			ui.Warn("Without the IPN secret, deposits cannot be confirmed automatically.")
		}
	}

	ui.Say("")
	ui.Say("  %s", ui.Dim("A Discord webhook posts a message when someone deposits or withdraws."))
	cfg.DiscordWebhook = ui.AskOptional("Discord webhook URL")
	if cfg.DiscordWebhook != "" && !strings.HasPrefix(cfg.DiscordWebhook, "https://") {
		ui.Warn("That does not look like a webhook URL; it will be saved as typed.")
	}
}

func askAdmin(cfg *config.Config, previous *config.Config) {
	if cfg.DBMode != config.DBLocal {
		// On an existing Supabase project the accounts are already there.
		return
	}
	ui.Say("")
	ui.Say("Last thing: the first account. Setup creates it and makes it an admin,")
	ui.Say("so you can add cases and items as soon as the site is up.")

	def := "admin"
	if previous != nil && previous.AdminUsername != "" {
		def = previous.AdminUsername
	}
	for {
		name := strings.TrimSpace(ui.Ask("Admin username", def))
		if len(name) < 3 || len(name) > 20 {
			ui.Warn("The site requires a username between 3 and 20 characters.")
			continue
		}
		cfg.AdminUsername = name
		break
	}
	for {
		pw := ui.AskSecret("Admin password (at least 8 characters)")
		if pw == "" {
			generated, err := config.RandomToken(16)
			if err != nil {
				ui.Warn("Could not generate a password; please type one.")
				continue
			}
			cfg.AdminPassword = generated
			ui.Say("  %s", ui.Yellow("A password was generated for you. It is shown at the end — write it down."))
			return
		}
		if len(pw) < 8 {
			ui.Warn("Please use at least 8 characters.")
			continue
		}
		cfg.AdminPassword = pw
		return
	}
}

// Summary prints what setup is about to do and asks for the go-ahead.
func Summary(cfg *config.Config) bool {
	ui.Say("")
	ui.Say("%s", ui.Bold("Here is what will happen:"))
	ui.Say("")
	ui.Say("  Site address     %s", ui.Cyan(cfg.PublicURL()))
	if cfg.Exposure == config.ExposeDomain {
		ui.Say("  HTTPS            %s", "certificate requested automatically for "+cfg.Domain)
	} else {
		ui.Say("  HTTPS            %s", ui.Dim("not used — this is a local-only install"))
	}
	if cfg.DBMode == config.DBLocal {
		ui.Say("  Database         %s", "created on this machine, with the project's tables applied")
		ui.Say("  Data API         %s", "served on the same address under /rest/v1")
		ui.Say("  Live updates     %s", "enabled for chat, rolls, blocks and trades")
		ui.Say("  Image uploads    %s", "stored on this machine")
	} else {
		ui.Say("  Database         %s", "your existing Supabase project at "+cfg.SupabaseURL)
	}
	ui.Say("  Crypto payments  %s", enabledText(cfg.NowPaymentsAPIKey != ""))
	ui.Say("  Discord alerts   %s", enabledText(cfg.DiscordWebhook != ""))
	if cfg.AdminUsername != "" {
		ui.Say("  Admin account    %s", cfg.AdminUsername)
	}
	ui.Say("")
	ui.Say("  %s", ui.Dim("Files written: .env.local, and a new omega-stack/ folder."))
	ui.Say("  %s", ui.Dim("Nothing else in the project is modified."))
	ui.Say("")
	return ui.Confirm("Go ahead?", true)
}

func enabledText(on bool) string {
	if on {
		return ui.Green("configured")
	}
	return ui.Dim("skipped")
}

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func sanitisePort(v, def string) string {
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n < 1 || n > 65535 {
		ui.Warn("%q is not a usable port; using %s.", v, def)
		return def
	}
	return strconv.Itoa(n)
}

func previousPort(p *config.Config) string {
	if p == nil || p.Exposure != config.ExposeLocal {
		return ""
	}
	return p.HTTPPort
}

func previousDomain(p *config.Config) string {
	if p == nil {
		return ""
	}
	return p.Domain
}

func previousEmail(p *config.Config) string {
	if p == nil {
		return ""
	}
	return p.ACMEEmail
}

func previousSupabaseURL(p *config.Config) string {
	if p == nil {
		return ""
	}
	return p.SupabaseURL
}

// DescribePort is used in preflight messages.
func DescribePort(port string) string { return fmt.Sprintf("port %s", port) }
