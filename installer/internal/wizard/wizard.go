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
	ui.Say("First: is this the real website, or a copy to play with?")

	// Trying it out first is the safer default, and it is what most people are
	// doing the first time. A re-run offers whatever was chosen before.
	def := 0
	if previous != nil && previous.Exposure == config.ExposeDomain {
		def = 1
	}
	choice := ui.Choice("Which one?", []string{
		"Just on this computer, to try it out\nOpens at http://localhost in your browser. Only you can see it.\nNothing else needed — no domain, no setting anything up online.",
		"The real thing, on the internet\nAnyone can visit it at your own web address, like omegacases.com.\nYou need to own that address already, and to have pointed it at this\ncomputer — setup checks that and tells you exactly what to do.",
	}, def)

	if choice == 0 {
		cfg.Exposure = config.ExposeLocal
		ui.Say("")
		ui.Say("  %s", ui.Dim("Good choice for a first go. Everything works the same as the real"))
		ui.Say("  %s", ui.Dim("site — accounts, cases, chat — it is just only visible to you."))
		port := ui.Ask("Port number (just press Enter unless it is already in use)",
			orDefault(previousPort(previous), "3000"))
		cfg.HTTPPort = sanitisePort(port, "3000")
		cfg.HTTPSPort = ""
		return
	}

	cfg.Exposure = config.ExposeDomain
	ui.Say("")
	ui.Say("  %s", ui.Dim("This is the address people will type in, without the https:// part."))
	for {
		domain := ui.Ask("Your web address (for example omegacases.com)", previousDomain(previous))
		domain = strings.ToLower(strings.TrimSpace(domain))
		domain = strings.TrimPrefix(strings.TrimPrefix(domain, "https://"), "http://")
		domain = strings.TrimSuffix(domain, "/")
		if strings.Contains(domain, "/") {
			domain = strings.SplitN(domain, "/", 2)[0]
		}
		if !domainPattern.MatchString(domain) {
			ui.Warn("That does not look like a web address. Type it like: omegacases.com")
			continue
		}
		if net.ParseIP(domain) != nil {
			ui.Warn("That is a numeric address. Type the name you own instead, like omegacases.com.")
			ui.Say("      %s", ui.Dim("The padlock in the browser cannot be set up for a number."))
			continue
		}
		cfg.Domain = domain
		break
	}

	ui.Say("")
	ui.Say("  %s", ui.Dim("Setup gives your site the padlock in the browser bar (https), free,"))
	ui.Say("  %s", ui.Dim("and renews it by itself. The company that issues it just wants an"))
	ui.Say("  %s", ui.Dim("email address in case something ever goes wrong. It is not shown"))
	ui.Say("  %s", ui.Dim("anywhere on the site and gets no other mail."))
	for {
		email := ui.Ask("Your email address", previousEmail(previous))
		if strings.Count(email, "@") == 1 && !strings.HasPrefix(email, "@") && strings.Contains(email, ".") {
			cfg.ACMEEmail = email
			break
		}
		ui.Warn("That does not look like an email address.")
	}
}

func askDatabase(cfg *config.Config, previous *config.Config) {
	ui.Say("")
	ui.Say("Next: where do the accounts, items and balances get stored?")

	def := 0
	if previous != nil && previous.DBMode == config.DBHosted {
		def = 1
	}
	choice := ui.Choice("Which one?", []string{
		"Store it on this computer (recommended)\nSetup creates the storage and fills in the site's tables for you.\nNothing to sign up for and nothing to pay.",
		"I already have a Supabase account and want to use it\nYou paste your project's address and its two keys. Setup leaves your\nexisting tables alone and shows you what to run yourself.",
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
	ui.Say("Now some optional keys. If you do not have them, press Enter to skip —")
	ui.Say("the site works without them and you can add them later by running this")
	ui.Say("again.")
	ui.Say("")
	ui.Say("  %s", ui.Dim("NOWPayments is the service that takes crypto payments. Skipping it"))
	ui.Say("  %s", ui.Dim("means everything works except adding and cashing out money."))
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
			ui.Say("  %s", ui.Yellow("A password was made up for you. It is shown at the end — write it down."))
			break
		}
		if len(pw) < 8 {
			ui.Warn("Please use at least 8 characters.")
			continue
		}
		cfg.AdminPassword = pw
		break
	}

	// A brand new site has no items at all, so there is nothing to unbox and
	// most pages are empty. Worth offering on a copy you are only trying out;
	// not on a real site, where the owner wants their own items.
	if cfg.Exposure == config.ExposeLocal {
		ui.Say("")
		ui.Say("  %s", ui.Dim("A brand new site starts completely empty — no items, so no cases to"))
		ui.Say("  %s", ui.Dim("open. Setup can add a few test items and give your account some"))
		ui.Say("  %s", ui.Dim("cases and money, so there is something to click on right away."))
		cfg.SeedItems = ui.Confirm("Add test items and give yourself something to spend?", true)
	}
}

// Summary prints what setup is about to do and asks for the go-ahead.
func Summary(cfg *config.Config) bool {
	ui.Say("")
	ui.Say("%s", ui.Bold("Here is what will happen:"))
	ui.Say("")
	ui.Say("  Your site will be at   %s", ui.Cyan(cfg.PublicURL()))
	if cfg.Exposure == config.ExposeDomain {
		ui.Say("  Visible to             %s", "anyone on the internet")
		ui.Say("  Padlock (https)        %s", "set up and renewed for you")
	} else {
		ui.Say("  Visible to             %s", "only you, on this computer")
		ui.Say("  Padlock (https)        %s", ui.Dim("not needed for a local copy"))
	}
	if cfg.DBMode == config.DBLocal {
		ui.Say("  Accounts and items     %s", "stored on this computer")
		ui.Say("  Chat and live feeds    %s", "working")
		ui.Say("  Picture uploads        %s", "working")
	} else {
		ui.Say("  Accounts and items     %s", "your Supabase project at "+cfg.SupabaseURL)
	}
	ui.Say("  Crypto payments        %s", enabledText(cfg.NowPaymentsAPIKey != ""))
	ui.Say("  Discord alerts         %s", enabledText(cfg.DiscordWebhook != ""))
	if cfg.AdminUsername != "" {
		ui.Say("  Your admin login       %s", cfg.AdminUsername)
	}
	ui.Say("")
	ui.Say("  %s", ui.Dim("Two things get added to the project folder: a settings file and an"))
	ui.Say("  %s", ui.Dim("omega-stack folder. Nothing else is touched, and nothing is"))
	ui.Say("  %s", ui.Dim("installed outside of Docker."))
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
