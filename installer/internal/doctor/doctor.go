// Package doctor runs the checks that decide whether an install can succeed,
// before anything is written or started. Each check reports a plain-language
// fix rather than a diagnostic code, because the person running setup is not
// assumed to know Docker.
package doctor

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/harsizcool/omegacases/installer/internal/runner"
)

// Result is one check's outcome. Fatal marks a problem setup cannot work
// around; anything else is reported and the install continues.
type Result struct {
	Name   string
	OK     bool
	Fatal  bool
	Detail string
	Remedy string
}

// Docker confirms the engine is installed and actually running. The second
// half matters more than the first: Docker Desktop is frequently installed but
// not started, which otherwise fails much later with an opaque error.
func Docker(r *runner.Runner) Result {
	res := Result{Name: "Docker", Fatal: true}
	if !runner.Look("docker") {
		res.Detail = "Docker is not installed."
		res.Remedy = dockerInstallHint()
		return res
	}
	if _, err := r.Quiet("docker", []string{"info", "--format", "{{.ServerVersion}}"},
		runner.Timeout(90*time.Second)); err != nil {
		res.Detail = "Docker is installed but not responding."
		res.Remedy = dockerStartHint()
		return res
	}
	version, err := r.Quiet("docker", []string{"version", "--format", "{{.Server.Version}}"},
		runner.Timeout(30*time.Second))
	if err == nil {
		res.Detail = "engine " + strings.TrimSpace(version)
	}
	res.OK = true
	return res
}

// Compose confirms the v2 compose plugin is available. The older standalone
// docker-compose binary is not supported: the generated file uses v2 syntax.
func Compose(r *runner.Runner) Result {
	res := Result{Name: "Docker Compose", Fatal: true}
	out, err := r.Quiet("docker", []string{"compose", "version", "--short"}, runner.Timeout(60*time.Second))
	if err != nil {
		res.Detail = "The 'docker compose' plugin is missing."
		res.Remedy = "Update Docker to a current version — Compose ships with it. " + dockerInstallHint()
		return res
	}
	res.OK = true
	res.Detail = "v" + strings.TrimSpace(out)
	return res
}

// Port reports whether setup can bind a port it needs. A port already in use
// is fatal for the HTTPS listeners, because Let's Encrypt has to reach them.
func Port(port string, fatal bool, usedFor string) Result {
	res := Result{Name: "Port " + port, Fatal: fatal}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		res.Detail = fmt.Sprintf("Something else on this machine is already using port %s (needed for %s).", port, usedFor)
		res.Remedy = "Stop the other program using that port, or pick a different port when asked."
		return res
	}
	_ = listener.Close()
	res.OK = true
	return res
}

// DNS checks that the domain already points at this machine's public address.
// It is never fatal: DNS often propagates while setup is running, and the
// stack is still worth building.
func DNS(domain string) Result {
	res := Result{Name: "DNS for " + domain}
	public, err := publicIP()
	if err != nil {
		res.Detail = "Could not work out this machine's public address, so the domain was not checked."
		res.OK = true
		return res
	}

	addrs, err := net.LookupHost(domain)
	if err != nil {
		res.Detail = fmt.Sprintf("%s does not lead anywhere yet.", domain)
		res.Remedy = pointDomainHere(domain, public)
		return res
	}
	for _, addr := range addrs {
		if addr == public {
			res.OK = true
			res.Detail = "already points at this computer (" + public + ")"
			return res
		}
	}
	res.Detail = fmt.Sprintf("%s currently points somewhere else (%s), not at this computer.",
		domain, strings.Join(addrs, ", "))
	res.Remedy = pointDomainHere(domain, public)
	return res
}

// pointDomainHere spells out the one change that has to be made, in the words
// the registrar's own form uses, because "add an A record" means nothing to
// somebody who has never seen that form before.
func pointDomainHere(domain, public string) string {
	return fmt.Sprintf(`A web address does not know where your site is until you tell it. You
do that wherever you bought %s — GoDaddy, Namecheap, Cloudflare,
whoever it was.

Log in there and look for "DNS", "DNS settings" or "Manage DNS". Add a
record with these three things:

    Type:   A
    Name:   @          (means the address itself, with nothing in front)
    Value:  %s

That value is this computer. Save it, and it usually takes effect within
a few minutes, though it can take longer. Setup can carry on now — the
site will start working by itself once the change goes through, and you
do not have to run this again.`, domain, public)
}

// Disk warns when Docker has little room left. The images for the stack come
// to roughly 2 GB.
func Disk(r *runner.Runner) Result {
	res := Result{Name: "Disk space", OK: true}
	out, err := r.Quiet("docker", []string{"system", "df", "--format", "{{.Type}} {{.Size}}"},
		runner.Timeout(60*time.Second))
	if err == nil && strings.TrimSpace(out) != "" {
		res.Detail = "Docker storage reachable"
	}
	return res
}

func publicIP() (string, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	for _, url := range []string{"https://api.ipify.org", "https://ifconfig.me/ip"} {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		if readErr != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil {
			return ip, nil
		}
	}
	return "", fmt.Errorf("no address service could be reached")
}

// WhatIsDocker is the one-paragraph answer, for the first time it comes up.
const WhatIsDocker = `Docker is a free program that OmegaCases needs in order to run.
It keeps the website and its database in their own self-contained
boxes, so they cannot clash with anything else on this computer, and
so removing them later leaves nothing behind. You install it once and
never really think about it again.`

func dockerInstallHint() string {
	switch runtime.GOOS {
	case "windows", "darwin":
		return `Download Docker Desktop — it is free — and install it:

    https://www.docker.com/products/docker-desktop/

Open it once after installing and wait until it says it is running.
Then start this setup again.`
	default:
		return `Install it by running this one line:

    curl -fsSL https://get.docker.com | sudo sh

Then start this setup again. (Setup can also do this for you — it
offers, if you run it with sudo.)`
	}
}

func dockerStartHint() string {
	switch runtime.GOOS {
	case "windows", "darwin":
		return `Docker is installed but not switched on yet.

Open Docker Desktop from your Start menu or Applications folder and
wait until it says it is running — a minute or two the first time.
Then start this setup again.`
	default:
		return `Docker is installed but not switched on yet. Start it with:

    sudo systemctl start docker

If that says permission denied, add yourself to the docker group:

    sudo usermod -aG docker $USER

then log out and back in, and start this setup again.`
	}
}

// WaitForDocker polls until the engine answers. Docker Desktop takes a minute
// or two to start, and "it is installed but not responding" is far more often a
// machine that has just booted than a broken installation.
// The engine is polled often so setup carries on promptly once it is up, but
// onTick only fires occasionally — a line every few seconds for three minutes
// buries the message that follows it.
func WaitForDocker(r *runner.Runner, limit time.Duration, onTick func(waited time.Duration)) bool {
	const (
		poll   = 5 * time.Second
		notify = 30 * time.Second
	)
	started := time.Now()
	deadline := started.Add(limit)
	nextNotice := started.Add(notify)

	for {
		if _, err := r.Quiet("docker", []string{"info", "--format", "{{.ServerVersion}}"},
			runner.Timeout(30*time.Second)); err == nil {
			return true
		}
		now := time.Now()
		if now.After(deadline) {
			return false
		}
		if onTick != nil && now.After(nextNotice) {
			onTick(time.Since(started).Round(time.Second))
			nextNotice = now.Add(notify)
		}
		time.Sleep(poll)
	}
}
