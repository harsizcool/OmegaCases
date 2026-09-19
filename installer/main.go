// Command setup installs and runs OmegaCases on one machine.
//
// It asks for the API keys and the domain, writes the application's environment
// file, generates a Docker deployment (database, data API, live updates, image
// storage, the site itself and a reverse proxy that gets its own HTTPS
// certificate), applies the project's SQL migrations, creates the first admin
// account, and finishes by explaining how to start and stop the site.
//
// Run it with no arguments for the guided install. The other subcommands —
// start, stop, status, logs, update, uninstall — operate on an install that
// already exists.
package main

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/harsizcool/omegacases/installer/internal/bootstrap"
	"github.com/harsizcool/omegacases/installer/internal/config"
	"github.com/harsizcool/omegacases/installer/internal/dbmigrate"
	"github.com/harsizcool/omegacases/installer/internal/doctor"
	"github.com/harsizcool/omegacases/installer/internal/runner"
	"github.com/harsizcool/omegacases/installer/internal/stack"
	"github.com/harsizcool/omegacases/installer/internal/ui"
	"github.com/harsizcool/omegacases/installer/internal/wizard"
)

// version and buildStamp are set at build time with
// -ldflags "-X main.version=… -X main.buildStamp=…". The stamp is what tells a
// bug report which binary actually ran, which a version number alone does not.
var (
	version    = "1.0.0"
	buildStamp = "dev"
)

const totalSteps = 7

// Options that apply to the whole run, pulled out of the arguments before the
// subcommand is worked out.
var (
	branchFlag = new(string)
	dirFlag    = new(string)
)

func main() {
	ui.Init()

	args := parseOptions(os.Args[1:])

	command := ""
	if len(args) > 0 {
		command = strings.TrimPrefix(strings.ToLower(args[0]), "--")
	}

	switch command {
	case "", "install", "setup":
		exit(install())
	case "start", "stop", "restart", "status", "logs", "update":
		exit(control(command, logsArg(args)))
	case "uninstall", "remove":
		exit(uninstall())
	case "version", "v":
		fmt.Printf("omegacases-setup %s (build %s, %s/%s)\n",
			version, buildStamp, runtime.GOOS, runtime.GOARCH)
	case "help", "h", "?":
		usage()
	default:
		fmt.Printf("Unknown command %q.\n\n", args[0])
		usage()
		os.Exit(2)
	}
}

// parseOptions pulls --branch and --dir out of the arguments, in either the
// "--flag value" or "--flag=value" spelling, and returns what is left.
func parseOptions(args []string) []string {
	var rest []string
	for i := 0; i < len(args); i++ {
		arg := args[i]
		name, value, hasValue := strings.Cut(arg, "=")

		var target *string
		switch strings.ToLower(name) {
		case "--branch", "-b":
			target = branchFlag
		case "--dir", "--directory", "-d":
			target = dirFlag
		default:
			rest = append(rest, arg)
			continue
		}

		if hasValue {
			*target = value
			continue
		}
		if i+1 < len(args) {
			i++
			*target = args[i]
			continue
		}
		fmt.Printf("%s needs a value.\n", name)
		os.Exit(2)
	}
	return rest
}

// logsArg is the optional service name for the logs subcommand, after the
// options have been stripped out.
func logsArg(args []string) string {
	if len(args) > 1 {
		return args[1]
	}
	return ""
}

func usage() {
	fmt.Println(`OmegaCases setup

  (no arguments)   Guided install: downloads the source code and Docker if they
                   are not here yet, asks for your keys and domain, sets
                   everything up, and tells you how to run it.

  start            Start the site.
  stop             Stop the site. Data is kept.
  restart          Restart the site.
  status           Show what is running.
  logs [service]   Follow the logs.
  update           Rebuild the site from the current source code.
  uninstall        Stop and remove everything, with a confirmation first.
  version          Print the version.

Options:

  --dir PATH       Where the source code is, or should be downloaded to.
                   Default when downloading: ` + bootstrap.DefaultProjectDir() + `
  --branch NAME    Which branch to download. Default: ` + bootstrap.DefaultBranch)
}

// exit closes the program, holding the window open when it was double-clicked
// so the last message can actually be read.
func exit(err error) {
	if err != nil {
		ui.Say("")
		ui.Fail("%s", err)
		ui.Say("")
		ui.Say("  Nothing is broken by stopping here. Fix the problem above and run")
		ui.Say("  setup again — it picks up where it left off.")
		holdWindow()
		os.Exit(1)
	}
	holdWindow()
}

func holdWindow() {
	if runtime.GOOS == "windows" && os.Getenv("OMEGA_NO_PAUSE") == "" {
		ui.Pause("Press Enter to close this window.")
	}
}

// ─── install ────────────────────────────────────────────────────────────────

func install() error {
	ui.Banner(version + " · build " + buildStamp)
	ui.Say("  This will set up the OmegaCases website on this machine: the database,")
	ui.Say("  the site itself, and an HTTPS address to reach it on. It takes about")
	ui.Say("  ten minutes, most of which is downloading and building.")
	ui.Say("")
	ui.Say("  %s", ui.Dim("Anything missing — the source code, Docker — setup offers to install."))
	ui.Say("  %s", ui.Dim("For a public site you will need a domain pointed at this machine."))

	ui.Section(1, totalSteps, "Checking this machine")

	// The log lives beside the project, so it cannot be opened until the
	// project's location is known — which may mean downloading it first.
	tempRun, err := runner.New(workingDir(), filepath.Join(os.TempDir(), "omega-setup-bootstrap.log"))
	if err != nil {
		return err
	}

	projectDir, err := locateOrFetchProject(tempRun)
	tempRun.Close()
	if err != nil {
		return err
	}

	run, err := runner.New(projectDir, filepath.Join(projectDir, "omega-setup.log"))
	if err != nil {
		return err
	}
	defer run.Close()
	run.Note("setup %s (build %s) on %s/%s, project %s",
		version, buildStamp, runtime.GOOS, runtime.GOARCH, projectDir)

	if err := checkPrerequisites(run); err != nil {
		return err
	}

	ui.Section(2, totalSteps, "Your settings")
	previous, hadPrevious := config.Load(projectDir)
	if hadPrevious {
		ui.Say("  %s", ui.Dim("A previous install was found; its answers are offered as defaults."))
	}
	cfg, err := wizard.Run(projectDir, previous)
	if err != nil {
		return err
	}

	if cfg.Exposure == config.ExposeDomain {
		if err := checkPublicPorts(cfg, run); err != nil {
			return err
		}
		if res := doctor.DNS(cfg.Domain); !res.OK {
			ui.Warn("%s", res.Detail)
			if res.Remedy != "" {
				ui.Say("      %s", ui.Dim(res.Remedy))
			}
			ui.Say("")
			if !ui.Confirm("Continue anyway? (the site will work once DNS updates)", true) {
				return errors.New("stopped so the domain's DNS record can be set up first")
			}
		} else {
			ui.Done("%s %s", cfg.Domain, res.Detail)
		}
	} else if res := doctor.Port(cfg.HTTPPort, false, "the website"); !res.OK {
		ui.Warn("%s", res.Detail)
		if !ui.Confirm("Continue anyway?", false) {
			return errors.New("stopped so the port conflict can be resolved first")
		}
	}

	if !wizard.Summary(cfg) {
		return errors.New("setup cancelled — nothing was changed")
	}

	if err := cfg.EnsureSecrets(); err != nil {
		return err
	}

	ui.Section(3, totalSteps, "Writing the configuration")
	envPath := filepath.Join(projectDir, ".env.local")
	backup, err := config.WriteEnvFile(envPath, config.AppEnvHeader(), cfg.AppEnv())
	if err != nil {
		return fmt.Errorf("could not write %s: %w", envPath, err)
	}
	ui.Done("wrote .env.local")
	if backup != "" {
		ui.Done("kept your previous one as %s", filepath.Base(backup))
	}

	st := stack.New(cfg, run)
	if err := st.Write(); err != nil {
		return fmt.Errorf("could not write the deployment files: %w", err)
	}
	ui.Done("wrote omega-stack/ (deployment, proxy config, start and stop scripts)")
	if err := cfg.Save(); err != nil {
		ui.Warn("could not save your answers for next time: %s", err)
	}
	if err := ensureGitIgnored(projectDir); err != nil {
		ui.Warn("could not update .gitignore: %s", err)
	}

	ui.Section(4, totalSteps, "Building the site")
	ui.Say("  This is the slow part: it downloads Node.js, installs the project's")
	ui.Say("  dependencies and compiles the site. Ten minutes is normal the first time.")
	ui.Say("")
	if err := st.Build(); err != nil {
		return fmt.Errorf("the site could not be built: %w", err)
	}
	ui.Done("site built")

	ui.Section(5, totalSteps, "Starting everything")
	if err := st.Up(); err != nil {
		return fmt.Errorf("the containers could not be started: %w", err)
	}
	ui.Done("containers started")

	if cfg.DBMode == config.DBLocal {
		ui.Section(6, totalSteps, "Setting up the database")
		if err := setUpDatabase(cfg, st); err != nil {
			return err
		}
	} else {
		ui.Section(6, totalSteps, "Your Supabase project")
		ui.Say("  Setup does not change a database it did not create. To apply the")
		ui.Say("  project's tables, open the SQL editor in your Supabase dashboard and")
		ui.Say("  run the files in scripts/ in this order:")
		plan, _ := dbmigrate.Plan(filepath.Join(projectDir, "scripts"))
		for _, name := range plan {
			ui.Say("      %s", ui.Dim(name))
		}
	}

	ui.Section(7, totalSteps, "Checking it works")
	if err := verifyDeployment(cfg, st, run); err != nil {
		return err
	}

	if cfg.DBMode == config.DBLocal && cfg.AdminUsername != "" {
		createAdmin(cfg, st)
	}

	if err := writeInstructions(cfg); err != nil {
		ui.Warn("could not write HOW-TO-RUN.md: %s", err)
	}
	printFinalInstructions(cfg, run.LogPath())
	return nil
}

// locateOrFetchProject finds the source tree, or offers to download it when
// this is a bare machine with nothing checked out yet.
func locateOrFetchProject(run *runner.Runner) (string, error) {
	if dir, found := searchForProject(); found {
		ui.Done("source code found at %s", dir)
		return dir, nil
	}

	ui.Say("")
	ui.Say("  The OmegaCases source code is not here yet.")
	ui.Say("")
	choice := ui.Choice("What should setup do?", []string{
		"Download it for me (recommended)\nFetches the code from GitHub into a folder of your choosing.",
		"It is already on this machine\nYou type the path to it.",
	}, 0)

	if choice == 1 {
		for attempt := 0; attempt < 3; attempt++ {
			answer := strings.Trim(strings.TrimSpace(ui.Ask("Full path to the project folder", "")), `"`)
			if isProjectDir(answer) {
				return filepath.Clean(answer), nil
			}
			ui.Warn("%s does not look like the OmegaCases project.", answer)
			ui.Say("      %s", ui.Dim("It should contain package.json, an app folder and a scripts folder."))
		}
		return "", errors.New("could not find the project — run setup from inside the project folder")
	}

	// --dir doubles as the download destination when nothing is there yet.
	destination := bootstrap.DefaultProjectDir()
	if *dirFlag != "" {
		destination = filepath.Clean(strings.Trim(*dirFlag, `"`))
	}
	dir := ui.Ask("Where should it go?", destination)
	dir = filepath.Clean(strings.Trim(strings.TrimSpace(dir), `"`))
	if !filepath.IsAbs(dir) {
		if abs, err := filepath.Abs(dir); err == nil {
			dir = abs
		}
	}

	branch := bootstrap.DefaultBranch
	if *branchFlag != "" {
		branch = *branchFlag
	}
	ui.Say("")
	ui.Say("  Setup will download the %s branch of", ui.Bold(branch))
	ui.Say("      %s", ui.Cyan(bootstrap.Repo))
	ui.Say("  into %s", ui.Cyan(dir))
	ui.Say("")
	if !ui.Confirm("Go ahead?", true) {
		return "", errors.New("stopped before downloading anything")
	}

	if err := bootstrap.FetchSource(run, dir, branch); err != nil {
		return "", err
	}
	if !isProjectDir(dir) {
		return "", fmt.Errorf("the download finished but %s does not look like the project — "+
			"check that the %q branch is the right one", dir, branch)
	}
	ui.Done("source code ready at %s", dir)
	return dir, nil
}

func checkPrerequisites(run *runner.Runner) error {
	dockerCheck := doctor.Docker(run)

	// Nothing installed at all: offer to do it, where setup is able to.
	if !dockerCheck.OK && !runner.Look("docker") {
		method, can := bootstrap.DockerInstallable()
		if can {
			ui.Say("")
			ui.Say("  Docker is not installed. It is what runs the database and the site.")
			ui.Say("")
			ui.Say("  %s", bootstrap.DescribeInstall(method))
			ui.Say("")
			if ui.Confirm("Install Docker now?", true) {
				if err := bootstrap.InstallDocker(run, method); err != nil {
					ui.Fail("%s", err)
					ui.Say("")
					ui.Say("  %s Install it yourself, then run setup again:", ui.Bold("What to do:"))
					ui.Say("      %s", ui.Cyan(manualDockerHint()))
					return errors.New("Docker could not be installed automatically")
				}
				if note := bootstrap.NeedsRestartAfterInstall(method); note != "" {
					ui.Say("")
					ui.Say("  %s", note)
					return errors.New("Docker needs a restart before setup can continue")
				}
				dockerCheck = doctor.Docker(run)
			}
		} else if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
			// Docker Desktop cannot be installed unattended without winget.
			ui.Say("")
			ui.Say("  Docker is not installed, and setup cannot install it on this machine.")
			ui.Say("")
			ui.Say("  %s Download and install Docker Desktop from:", ui.Bold("What to do:"))
			ui.Say("      %s", ui.Cyan("https://www.docker.com/products/docker-desktop/"))
			ui.Say("  Open it once, wait until it says it is running, then run setup again.")
			return errors.New("Docker has to be installed before setup can continue")
		}
	}

	if !dockerCheck.OK && runner.Look("docker") {
		// The engine is installed but not answering yet, which is far more often
		// a machine that has just booted than a broken installation.
		ui.Step("Docker is not answering yet — waiting in case it is still starting")
		if doctor.WaitForDocker(run, 3*time.Minute, func(waited time.Duration) {
			ui.Say("      %s", ui.Dim(fmt.Sprintf("still waiting (%s)", waited)))
		}) {
			dockerCheck = doctor.Docker(run)
		}
	}
	checks := []doctor.Result{dockerCheck}
	if checks[0].OK {
		checks = append(checks, doctor.Compose(run))
	}
	for _, res := range checks {
		if res.OK {
			detail := ""
			if res.Detail != "" {
				detail = " — " + res.Detail
			}
			ui.Done("%s is ready%s", res.Name, detail)
			continue
		}
		ui.Fail("%s: %s", res.Name, res.Detail)
		if res.Remedy != "" {
			ui.Say("")
			ui.Say("  %s %s", ui.Bold("What to do:"), res.Remedy)
		}
		if res.Fatal {
			return fmt.Errorf("%s has to be working before setup can continue", res.Name)
		}
	}
	return nil
}

// checkPublicPorts verifies 80 and 443 are free. Both are required: the
// certificate is issued over port 80 and served on 443, and neither can be
// moved elsewhere.
func checkPublicPorts(cfg *config.Config, run *runner.Runner) error {
	for _, check := range []struct {
		port, purpose string
	}{
		{cfg.HTTPPort, "the certificate check and the redirect to HTTPS"},
		{cfg.HTTPSPort, "the website itself"},
	} {
		res := doctor.Port(check.port, true, check.purpose)
		if res.OK {
			ui.Done("port %s is free", check.port)
			continue
		}
		ui.Fail("%s", res.Detail)
		ui.Say("")
		ui.Say("  %s A web server is probably already running on this machine.", ui.Bold("What to do:"))
		ui.Say("  Stop it, then run setup again. On Linux this is usually:")
		ui.Say("      %s", ui.Cyan("sudo systemctl stop nginx apache2"))
		ui.Say("  If it is a previous OmegaCases install, run: %s", ui.Cyan("setup stop"))
		// A previous run of this same stack holding the port is recoverable.
		if isOurStack(cfg, run) {
			ui.Say("")
			if ui.Confirm("An earlier OmegaCases install is using it. Stop that one and carry on?", true) {
				if err := stack.New(cfg, run).Down(); err == nil {
					if doctor.Port(check.port, true, check.purpose).OK {
						ui.Done("port %s is free now", check.port)
						continue
					}
				}
			}
		}
		return fmt.Errorf("port %s must be free before setup can continue", check.port)
	}
	return nil
}

func isOurStack(cfg *config.Config, run *runner.Runner) bool {
	if _, err := os.Stat(filepath.Join(cfg.StackDir(), "docker-compose.yml")); err != nil {
		return false
	}
	out, err := run.Quiet("docker", []string{"compose", "ps", "-q"},
		runner.In(cfg.StackDir()), runner.Timeout(60*time.Second))
	return err == nil && strings.TrimSpace(out) != ""
}

func setUpDatabase(cfg *config.Config, st *stack.Stack) error {
	ui.Step("waiting for the database to accept connections")
	if err := st.WaitForDatabase(5 * time.Minute); err != nil {
		ui.Say("")
		ui.Say("  %s", ui.Dim(lastLines(st.Logs("db", 20), 12)))
		return err
	}
	ui.Done("database is up")

	// Named to avoid shadowing the bootstrap package.
	bootstrapSQL, err := os.ReadFile(filepath.Join(cfg.StackDir(), "bootstrap.sql"))
	if err != nil {
		return err
	}
	ui.Step("preparing roles, schemas and replication")
	out, execErr := st.ExecSQL(string(bootstrapSQL))
	if execErr != nil {
		return fmt.Errorf("the database could not be prepared: %w\n%s", execErr, lastLines(out, 10))
	}
	ui.Done("database prepared")

	// Turning on logical replication is a server-level change, so it only takes
	// effect after a restart. The bootstrap script says when it made one.
	if strings.Contains(out, "OMEGA_RESTART_REQUIRED") {
		ui.Step("restarting the database to enable live updates")
		if err := st.RestartDatabase(); err != nil {
			ui.Warn("the restart failed: %s", err)
			ui.Say("      %s", ui.Dim("Live feeds will need a page refresh until the database restarts."))
		} else {
			ui.Done("database restarted")
		}
	}

	ui.Step("applying the project's SQL scripts")
	scriptsDir := filepath.Join(cfg.ProjectDir, "scripts")
	if err := dbmigrate.Apply(st, scriptsDir); err != nil {
		return err
	}

	// The data services sign in with passwords, and the image does not set them
	// from this stack's, so they are checked and corrected before the services
	// are restarted against them.
	ui.Step("checking the data services can sign in to the database")

	// Image uploads and live updates each break on their own if these cannot log
	// in, but the site still works, so they are reported rather than fatal.
	if err := st.EnsureServiceLogins("supabase_storage_admin"); err != nil {
		ui.Warn("%s", err)
		ui.Say("      %s", ui.Dim("Profile pictures and item images will not upload."))
	}
	if err := st.EnsureServiceLogins("supabase_admin"); err != nil {
		ui.Warn("%s", err)
		ui.Say("      %s", ui.Dim("Live feeds will need a page refresh to show new activity."))
	}

	// Nothing works without this one: it is the role every query travels over.
	if err := st.EnsureServiceLogins("authenticator"); err != nil {
		ui.Say("")
		ui.Say("  %s", ui.Dim("The database is set up, but the services that read it cannot log in."))
		ui.Say("  %s", ui.Dim("This is recoverable: deleting the database volume and running setup"))
		ui.Say("  %s", ui.Dim("again rebuilds it from scratch with matching passwords —"))
		ui.Say("      %s", ui.Cyan("cd omega-stack && docker compose down -v"))
		ui.Say("  %s", ui.Dim("That deletes the site's data, so only do it on a fresh install."))
		return err
	}

	// Storage and Realtime run their own migrations on connect, and both were
	// started before these roles existed, so they get one restart here.
	ui.Step("restarting the data services now the database is ready")
	for _, service := range []string{"rest", "realtime", "storage"} {
		if err := st.RestartService(service); err != nil {
			ui.Warn("could not restart %s: %s", service, err)
		}
	}
	ui.Done("data services restarted")
	return nil
}

func verifyDeployment(cfg *config.Config, st *stack.Stack, run *runner.Runner) error {
	ui.Step("waiting for the site to answer")
	if err := st.WaitForSite(6 * time.Minute); err != nil {
		ui.Say("")
		ui.Say("  %s", ui.Dim(lastLines(st.Logs("web", 30), 20)))
		return fmt.Errorf("the site did not start: %w", err)
	}
	ui.Done("the site is answering")

	if cfg.DBMode == config.DBLocal {
		if err := st.CheckDataAPI(); err != nil {
			ui.Say("")
			ui.Say("  %s", ui.Dim(lastLines(st.Logs("rest", 20), 12)))
			return fmt.Errorf("the site is up but cannot read its data: %w", err)
		}
		ui.Done("the site can read and write its data")

		if err := st.EnsureBuckets("avatars", "itemstuffs"); err != nil {
			ui.Warn("%s", err)
			ui.Say("      %s", ui.Dim("Profile pictures and item images will fail to upload until this works."))
		}

		findings, err := dbmigrate.Verify(st)
		if err != nil {
			ui.Warn("could not check the database schema: %s", err)
		} else if len(findings) > 0 {
			ui.Say("")
			ui.Warn("The database is missing things the site expects:")
			for _, finding := range findings {
				ui.Say("      %s %s", ui.Yellow("·"), finding)
			}
			ui.Say("      %s", ui.Dim("The pages that use them will error. Everything else works."))
		} else {
			ui.Done("every table, column and function the site uses is present")
		}

		if live, err := dbmigrate.RealtimeTables(st); err == nil {
			if len(live) == 0 {
				ui.Warn("live updates are not published — feeds will need a page refresh")
			} else {
				ui.Done("live updates enabled for %s", strings.Join(live, ", "))
			}
		}
	}

	if cfg.Exposure == config.ExposeDomain {
		ui.Step("checking the HTTPS certificate for %s", cfg.Domain)
		// Issuance normally takes a few seconds once DNS is correct, but a
		// pending DNS change can make it take much longer, and that is not a
		// failed install.
		if _, err := stack.WaitForHTTP("https://"+cfg.Domain+"/", 90*time.Second); err != nil {
			ui.Warn("%s is not serving HTTPS yet.", cfg.Domain)
			ui.Say("      %s", ui.Dim("This is normal if the domain's DNS was changed recently. The"))
			ui.Say("      %s", ui.Dim("certificate is retried automatically; check again in a few minutes."))
			run.Note("acme not ready: %v", err)
		} else {
			ui.Done("HTTPS is working on %s", cfg.Domain)
		}
	}
	return nil
}

// createAdmin registers the first account through the site's own API, so the
// password is hashed exactly the way the login page expects, then promotes it.
func createAdmin(cfg *config.Config, st *stack.Stack) {
	ui.Step("creating the admin account %q", cfg.AdminUsername)

	existing, err := st.QuerySQL(fmt.Sprintf(
		"SELECT count(*) FROM public.users WHERE username = %s", sqlLiteral(cfg.AdminUsername)))
	if err == nil && strings.TrimSpace(existing) != "0" {
		if _, err := st.ExecSQL(fmt.Sprintf(
			"UPDATE public.users SET admin = TRUE WHERE username = %s;", sqlLiteral(cfg.AdminUsername))); err == nil {
			ui.Done("%q already existed and is now an admin", cfg.AdminUsername)
			return
		}
	}

	if err := st.RegisterUser(cfg.AdminUsername, cfg.AdminPassword); err != nil {
		ui.Warn("could not create the admin account: %s", err)
		ui.Say("      %s", ui.Dim("Sign up on the site as normal, then re-run setup to make that account an admin."))
		return
	}
	if _, err := st.ExecSQL(fmt.Sprintf(
		"UPDATE public.users SET admin = TRUE, cases = 0, cases_remaining = 0 WHERE username = %s;",
		sqlLiteral(cfg.AdminUsername))); err != nil {
		ui.Warn("the account was created but could not be made an admin: %s", err)
		return
	}
	ui.Done("admin account %q created", cfg.AdminUsername)
}

// ─── other subcommands ──────────────────────────────────────────────────────

func control(command, logsService string) error {
	cfg, st, run, err := openExisting()
	if err != nil {
		return err
	}
	defer run.Close()

	switch command {
	case "start":
		if err := st.Up(); err != nil {
			return err
		}
		ui.Done("started — %s will answer in about a minute", cfg.PublicURL())
	case "stop":
		if err := st.Down(); err != nil {
			return err
		}
		ui.Done("stopped, and your data is kept")
	case "restart":
		if err := st.Down(); err != nil {
			return err
		}
		if err := st.Up(); err != nil {
			return err
		}
		ui.Done("restarted")
	case "status":
		if err := st.Status(); err != nil {
			return err
		}
		ui.Say("")
		ui.Say("  Address: %s", ui.Cyan(cfg.PublicURL()))
	case "logs":
		args := []string{"compose", "logs", "-f", "--tail=100"}
		if logsService != "" {
			args = append(args, logsService)
		}
		_, err := run.Run("docker", args, runner.Stream(), runner.In(cfg.StackDir()))
		return err
	case "update":
		ui.Step("rebuilding the site from the current source code")
		if err := st.Build(); err != nil {
			return err
		}
		if err := st.UpService("web"); err != nil {
			return err
		}
		if cfg.DBMode == config.DBLocal {
			ui.Step("applying any new SQL scripts")
			if err := dbmigrate.Apply(st, filepath.Join(cfg.ProjectDir, "scripts")); err != nil {
				return err
			}
		}
		ui.Done("updated — %s is serving the new version", cfg.PublicURL())
	}
	return nil
}

func uninstall() error {
	cfg, st, run, err := openExisting()
	if err != nil {
		return err
	}
	defer run.Close()

	ui.Say("")
	ui.Say("  %s", ui.Bold("This removes the OmegaCases containers from this machine."))
	ui.Say("")
	if !ui.Confirm("Stop and remove the containers?", false) {
		return errors.New("nothing was removed")
	}
	if err := st.Down(); err != nil {
		return err
	}
	ui.Done("containers removed")

	if cfg.DBMode != config.DBLocal {
		return nil
	}
	ui.Say("")
	ui.Say("  %s", ui.Red("The database still holds every account, item and balance."))
	ui.Say("  %s", ui.Dim("Deleting it cannot be undone."))
	ui.Say("")
	if !ui.Confirm("Also delete all of the site's data?", false) {
		ui.Done("data kept — run 'setup start' to bring the site back")
		return nil
	}
	if strings.ToLower(strings.TrimSpace(ui.Ask("Type DELETE to confirm", ""))) != "delete" {
		ui.Done("data kept")
		return nil
	}
	if _, err := run.Run("docker", []string{"compose", "down", "-v"},
		runner.Stream(), runner.In(cfg.StackDir()), runner.Timeout(5*time.Minute)); err != nil {
		return err
	}
	ui.Done("all data deleted")
	return nil
}

func openExisting() (*config.Config, *stack.Stack, *runner.Runner, error) {
	projectDir, err := findProjectDir()
	if err != nil {
		return nil, nil, nil, err
	}
	cfg, ok := config.Load(projectDir)
	if !ok {
		return nil, nil, nil, fmt.Errorf(
			"no install was found in %s — run setup with no arguments first", projectDir)
	}
	run, err := runner.New(projectDir, filepath.Join(projectDir, "omega-setup.log"))
	if err != nil {
		return nil, nil, nil, err
	}
	// The secrets live in omega-stack/.env, which stays the source of truth for
	// the containers; the values needed for HTTP checks are read back here.
	env := config.ReadEnvFile(filepath.Join(cfg.StackDir(), ".env"))
	if cfg.DBMode == config.DBHosted {
		cfg.HostedAnonKey = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
		cfg.HostedServiceKey = env["SUPABASE_SERVICE_ROLE_KEY"]
	}
	return cfg, stack.New(cfg, run), run, nil
}

// ─── finishing up ───────────────────────────────────────────────────────────

func printFinalInstructions(cfg *config.Config, logPath string) {
	ui.Say("")
	ui.Say("%s", ui.Green("  ═══════════════════════════════════════════════════════"))
	ui.Say("%s", ui.Bold(ui.Green("   Done. OmegaCases is running.")))
	ui.Say("%s", ui.Green("  ═══════════════════════════════════════════════════════"))
	ui.Say("")
	ui.Say("  %s  %s", ui.Bold("Open your site:"), ui.Cyan(cfg.PublicURL()))
	if cfg.AdminUsername != "" {
		ui.Say("")
		ui.Say("  %s", ui.Bold("Sign in as the admin:"))
		ui.Say("      username   %s", cfg.AdminUsername)
		ui.Say("      password   %s", cfg.AdminPassword)
		ui.Say("      %s", ui.Yellow("Write this password down now — it is not stored anywhere."))
	}
	ui.Say("")
	ui.Say("  %s", ui.Bold("Day to day:"))
	if runtime.GOOS == "windows" {
		ui.Say("      Start it     double-click  %s", ui.Cyan("omega-stack\\start.cmd"))
		ui.Say("      Stop it      double-click  %s", ui.Cyan("omega-stack\\stop.cmd"))
	} else {
		ui.Say("      Start it     %s", ui.Cyan("./omega-stack/omega.sh start"))
		ui.Say("      Stop it      %s", ui.Cyan("./omega-stack/omega.sh stop"))
		ui.Say("      See logs     %s", ui.Cyan("./omega-stack/omega.sh logs"))
	}
	ui.Say("      Is it up?    %s", ui.Cyan(binaryName()+" status"))
	ui.Say("      New code     %s", ui.Cyan(binaryName()+" update"))
	ui.Say("")
	ui.Say("  The site restarts by itself when this machine reboots, so there is")
	ui.Say("  nothing to do after a power cut.")
	ui.Say("")
	if cfg.NowPaymentsAPIKey != "" {
		ui.Say("  %s", ui.Bold("One thing left, in your NOWPayments dashboard:"))
		ui.Say("      Set the IPN callback URL to  %s",
			ui.Cyan(cfg.PublicURL()+"/api/payments/webhook"))
		ui.Say("      %s", ui.Dim("Without it, deposits stay pending instead of crediting."))
		ui.Say("")
	}
	ui.Say("  %s", ui.Dim("Written for you: HOW-TO-RUN.md (the same instructions, to keep)"))
	ui.Say("  %s", ui.Dim("Full transcript of this install: "+filepath.Base(logPath)))
	ui.Say("")
}

func writeInstructions(cfg *config.Config) error {
	control := "./omega-stack/omega.sh start"
	stop := "./omega-stack/omega.sh stop"
	if runtime.GOOS == "windows" {
		control = "double-click omega-stack\\start.cmd"
		stop = "double-click omega-stack\\stop.cmd"
	}

	admin := ""
	if cfg.AdminUsername != "" {
		admin = fmt.Sprintf(`
## Signing in

Your admin account is **%s**. The password was shown at the end of setup and is
not saved anywhere — if it is lost, sign up for a new account on the site and
run `+"`setup`"+` again with that username as the admin.

The admin area is where you add cases and items, and set prices.
`, cfg.AdminUsername)
	}

	payments := ""
	if cfg.NowPaymentsAPIKey != "" {
		payments = fmt.Sprintf(`
## Crypto payments

In your NOWPayments dashboard, set the IPN callback URL to:

    %s/api/payments/webhook

Deposits stay pending until that is set, because NOWPayments has no way to tell
the site a payment arrived.
`, cfg.PublicURL())
	}

	doc := fmt.Sprintf(`# Running OmegaCases

Your site is at **%s**

Everything runs in Docker on this machine. Docker has to be running for the
site to be up; on Windows and macOS that means Docker Desktop is open.

## The four things you will need

| What you want            | What to do                          |
|--------------------------|-------------------------------------|
| Start the site           | %s |
| Stop the site            | %s |
| Check whether it is up   | `+"`%s status`"+`   |
| Publish new code         | `+"`%s update`"+`   |

The site starts itself again whenever this machine reboots.
%s%s
## Changing a setting or a key

Run the setup program again. It remembers your answers, so most questions are
just Enter, and it keeps a dated backup of the previous `+"`.env.local`"+`.

## If something looks wrong

1. `+"`%s status`"+` — every line should say "running".
2. `+"`%s logs`"+` — the error is usually in the last few lines.
3. `+"`omega-setup.log`"+` in this folder holds the full install transcript.

## What setup created

    .env.local          the site's settings and keys
    omega-stack/        the deployment: database, site, proxy, start and stop scripts
    omega-stack/.env    the generated passwords and keys — keep this private, and back it up
    scripts/            the database's SQL, applied for you during setup

`+"`omega-stack/.env`"+` is the one file worth backing up. The keys in it are what
the site's data is signed with, and they cannot be recovered if it is lost.

## What is not included

Two background jobs from the original hosting (the mining-pool uptime sweep and
the pool liveness test) are not part of this deployment. Mining pools still
work; their uptime percentages simply do not update on their own.
`,
		cfg.PublicURL(), control, stop, binaryName(), binaryName(), admin, payments,
		binaryName(), binaryName())

	return os.WriteFile(filepath.Join(cfg.ProjectDir, "HOW-TO-RUN.md"), []byte(doc), 0o644)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func workingDir() string {
	if cwd, err := os.Getwd(); err == nil {
		return cwd
	}
	return "."
}

// searchForProject looks for the source tree: where --dir says, then outward
// from the working directory and the program's own location, then in the
// default download folder. That covers the binary being run from inside the
// project, dropped beside it, or run from a desktop after a previous download.
func searchForProject() (string, bool) {
	if *dirFlag != "" {
		dir := filepath.Clean(strings.Trim(*dirFlag, `"`))
		if isProjectDir(dir) {
			return dir, true
		}
		ui.Warn("%s does not look like the OmegaCases project.", dir)
		return "", false
	}

	var starts []string
	starts = append(starts, workingDir())
	if exe, err := os.Executable(); err == nil {
		starts = append(starts, filepath.Dir(exe))
	}

	for _, start := range starts {
		dir := start
		for i := 0; i < 5; i++ {
			if isProjectDir(dir) {
				return dir, true
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
		// Also look one level down, for a binary sitting next to the checkout.
		if entries, err := os.ReadDir(start); err == nil {
			for _, entry := range entries {
				candidate := filepath.Join(start, entry.Name())
				if entry.IsDir() && isProjectDir(candidate) {
					return candidate, true
				}
			}
		}
	}

	if fallback := bootstrap.DefaultProjectDir(); isProjectDir(fallback) {
		return fallback, true
	}
	return "", false
}

// findProjectDir is the non-installing lookup used by the other subcommands,
// which act on a deployment that already exists.
func findProjectDir() (string, error) {
	if dir, found := searchForProject(); found {
		return dir, nil
	}
	ui.Say("")
	ui.Warn("The OmegaCases source code could not be found from here.")
	answer := strings.Trim(strings.TrimSpace(ui.Ask("Full path to the project folder", "")), `"`)
	if isProjectDir(answer) {
		return filepath.Clean(answer), nil
	}
	return "", fmt.Errorf("%s does not look like the OmegaCases project "+
		"(it should contain package.json and a scripts folder)", answer)
}

func manualDockerHint() string {
	if runtime.GOOS == "linux" {
		return "curl -fsSL https://get.docker.com | sudo sh"
	}
	return "https://www.docker.com/products/docker-desktop/"
}

func isProjectDir(dir string) bool {
	if dir == "" {
		return false
	}
	pkg, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return false
	}
	if !bytes.Contains(pkg, []byte(`"next"`)) {
		return false
	}
	if _, err := os.Stat(filepath.Join(dir, "scripts")); err != nil {
		return false
	}
	_, err = os.Stat(filepath.Join(dir, "app"))
	return err == nil
}

// ensureGitIgnored keeps the generated secrets out of version control.
func ensureGitIgnored(projectDir string) error {
	path := filepath.Join(projectDir, ".gitignore")
	current, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	needed := []string{"omega-stack/", "omega-setup.log", "HOW-TO-RUN.md", ".env.local.backup-*"}
	var missing []string
	for _, entry := range needed {
		if !bytes.Contains(current, []byte(entry)) {
			missing = append(missing, entry)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	addition := "\n# Generated by the OmegaCases setup program\n" + strings.Join(missing, "\n") + "\n"
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(addition)
	return err
}

func binaryName() string {
	if runtime.GOOS == "windows" {
		return "SETUP.EXE"
	}
	return "omegacases-setup"
}

func lastLines(s string, n int) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n  ")
}

func sqlLiteral(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
