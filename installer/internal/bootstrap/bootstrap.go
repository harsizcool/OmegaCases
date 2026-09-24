// Package bootstrap handles the case where nothing is installed yet: no copy of
// the source code, and no Docker.
//
// Both steps install software or download files, so neither happens without
// being described first and agreed to.
package bootstrap

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/harsizcool/omegacases/installer/internal/runner"
	"github.com/harsizcool/omegacases/installer/internal/ui"
)

const (
	// Repo is where the source is fetched from.
	Repo = "https://github.com/harsizcool/OmegaCases.git"
	// repoWeb is the same repository over plain HTTPS, for the zip download
	// that is used when git is not installed.
	repoWeb = "https://github.com/harsizcool/OmegaCases"
	// DefaultBranch is fetched unless --branch says otherwise.
	//
	// This is release, not the repository's default branch: main does not carry
	// scripts/004_app_schema_alignment.sql, and a database built without it is
	// missing ten tables the application queries. Once that migration reaches
	// main, this can move back.
	DefaultBranch = "release"
)

// HomeDir is the home directory of the person running setup, which is not the
// same as the process's home when it was started with sudo.
func HomeDir() string {
	if user := os.Getenv("SUDO_USER"); user != "" && runtime.GOOS != "windows" {
		if home := lookupHome(user); home != "" {
			return home
		}
	}
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return "."
}

func lookupHome(user string) string {
	// getent is the correct answer where it exists; /home/<user> is the
	// overwhelmingly common layout where it does not.
	if out, err := exec.Command("getent", "passwd", user).Output(); err == nil {
		fields := strings.Split(strings.TrimSpace(string(out)), ":")
		if len(fields) >= 6 && fields[5] != "" {
			return fields[5]
		}
	}
	candidate := filepath.Join("/home", user)
	if info, err := os.Stat(candidate); err == nil && info.IsDir() {
		return candidate
	}
	return ""
}

// DefaultProjectDir is where the source is put when setup has to fetch it.
func DefaultProjectDir() string {
	return filepath.Join(HomeDir(), "websites", "omegacases")
}

// FetchSource downloads the application's source code into dir. It prefers git,
// because that leaves a repository the operator can pull updates into, and falls
// back to a zip download so a machine without git still works.
func FetchSource(r *runner.Runner, dir, branch string) error {
	if branch == "" {
		branch = DefaultBranch
	}
	if err := os.MkdirAll(filepath.Dir(dir), 0o755); err != nil {
		return fmt.Errorf("cannot create %s: %w", filepath.Dir(dir), err)
	}

	if runner.Look("git") {
		if isGitRepo(dir) {
			ui.Step("updating the existing copy in %s", dir)
			if _, err := r.Run("git", []string{"pull", "--ff-only"},
				runner.In(dir), runner.Stream(), runner.Timeout(10*time.Minute)); err != nil {
				ui.Warn("could not update it: %s", err)
				ui.Say("      %s", ui.Dim("Carrying on with the copy that is already there."))
			}
			return chownToUser(r, dir)
		}
		if err := ensureEmpty(dir); err != nil {
			return err
		}
		ui.Step("downloading the source code with git")
		if _, err := r.Run("git", []string{"clone", "--branch", branch, "--depth", "1", Repo, dir},
			runner.Stream(), runner.Timeout(20*time.Minute)); err != nil {
			return fmt.Errorf("the download failed: %w\n\n%s", err, accessHint())
		}
		return chownToUser(r, dir)
	}

	ui.Step("git is not installed, downloading the source as a zip instead")
	if err := ensureEmpty(dir); err != nil {
		return err
	}
	if err := downloadZip(repoWeb+"/archive/refs/heads/"+branch+".zip", dir); err != nil {
		return err
	}
	return chownToUser(r, dir)
}

func isGitRepo(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, ".git"))
	return err == nil && info.IsDir()
}

// IsGitCheckout reports whether the project can be updated in place.
func IsGitCheckout(dir string) bool { return isGitRepo(dir) && runner.Look("git") }

// Update pulls the latest code into an existing checkout and reports whether
// anything changed, so the caller can skip a rebuild that would do nothing.
//
// Local edits are left alone: a fast-forward pull either applies cleanly or
// fails, and failing is the right outcome. Nobody wants their own changes
// merged away by an installer.
func Update(r *runner.Runner, dir string) (changed bool, err error) {
	if !IsGitCheckout(dir) {
		return false, fmt.Errorf("%s is not a git checkout, so there is nothing to pull.\n"+
			"  It was probably unpacked from a zip. Download the new code over it, or\n"+
			"  install git and let setup clone it next time", dir)
	}

	before, err := headCommit(r, dir)
	if err != nil {
		return false, err
	}

	if out, err := r.Run("git", []string{"pull", "--ff-only"},
		runner.In(dir), runner.Stream(), runner.Timeout(10*time.Minute)); err != nil {
		if strings.Contains(out, "local changes") || strings.Contains(out, "would be overwritten") ||
			strings.Contains(out, "not possible to fast-forward") {
			return false, fmt.Errorf("the update was not applied because this copy has its own " +
				"changes.\n  Commit or discard them first — setup will not overwrite your work")
		}
		return false, fmt.Errorf("could not fetch the new code: %w", err)
	}

	after, err := headCommit(r, dir)
	if err != nil {
		return false, err
	}
	if before == after {
		return false, nil
	}

	// Worth showing: it says what the update actually brought in.
	if log, err := r.Quiet("git", []string{"log", "--oneline", "--no-decorate",
		before + ".." + after}, runner.In(dir), runner.Timeout(2*time.Minute)); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(log), "\n") {
			if line != "" {
				ui.Say("      %s", ui.Dim(line))
			}
		}
	}
	return true, chownToUser(r, dir)
}

func headCommit(r *runner.Runner, dir string) (string, error) {
	out, err := r.Quiet("git", []string{"rev-parse", "HEAD"},
		runner.In(dir), runner.Timeout(2*time.Minute))
	if err != nil {
		return "", fmt.Errorf("could not read the current version of the code: %w", err)
	}
	return strings.TrimSpace(lastLineOf(out)), nil
}

func lastLineOf(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	return strings.TrimSpace(lines[len(lines)-1])
}

// Describe returns a short description of the checked-out version, for showing
// before and after an update.
func Describe(r *runner.Runner, dir string) string {
	if !IsGitCheckout(dir) {
		return "not a git checkout"
	}
	out, err := r.Quiet("git", []string{"log", "-1", "--format=%h %s (%cr)"},
		runner.In(dir), runner.Timeout(2*time.Minute))
	if err != nil {
		return "unknown"
	}
	return lastLineOf(out)
}

// ensureEmpty refuses to unpack over existing files, so a mistyped path cannot
// scatter a checkout through somebody's documents.
func ensureEmpty(dir string) error {
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if len(entries) > 0 {
		return fmt.Errorf("%s already has files in it — empty it, or choose another folder", dir)
	}
	return nil
}

// downloadZip fetches the repository archive and unpacks it, dropping the
// single top-level directory GitHub wraps everything in.
func downloadZip(url, dir string) error {
	client := &http.Client{Timeout: 20 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("the download returned %s for %s\n\n%s", resp.Status, url, accessHint())
	}

	temp, err := os.CreateTemp("", "omegacases-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())
	written, err := io.Copy(temp, resp.Body)
	closeErr := temp.Close()
	if err != nil {
		return fmt.Errorf("the download was interrupted: %w", err)
	}
	if closeErr != nil {
		return closeErr
	}
	ui.Done("downloaded %.1f MB", float64(written)/(1024*1024))

	archive, err := zip.OpenReader(temp.Name())
	if err != nil {
		return fmt.Errorf("the downloaded file is not a valid zip: %w", err)
	}
	defer archive.Close()

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, file := range archive.File {
		if err := extractOne(file, dir); err != nil {
			return err
		}
	}
	ui.Done("unpacked into %s", dir)
	return nil
}

func extractOne(file *zip.File, dir string) error {
	// Drop the "OmegaCases-main/" wrapper GitHub adds.
	name := file.Name
	if idx := strings.IndexByte(name, '/'); idx >= 0 {
		name = name[idx+1:]
	}
	if name == "" {
		return nil
	}

	// A zip entry can name a path outside the destination; refuse those rather
	// than writing wherever they point.
	target := filepath.Join(dir, filepath.FromSlash(name))
	if !strings.HasPrefix(target, filepath.Clean(dir)+string(os.PathSeparator)) {
		return fmt.Errorf("the archive contains an unsafe path: %q", file.Name)
	}

	if file.FileInfo().IsDir() {
		return os.MkdirAll(target, 0o755)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}

	source, err := file.Open()
	if err != nil {
		return err
	}
	defer source.Close()

	out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, file.Mode().Perm()|0o600)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, source)
	return err
}

// chownToUser hands a checkout made under sudo back to the person who ran
// setup, so they can edit it afterwards without root.
func chownToUser(r *runner.Runner, dir string) error {
	user := os.Getenv("SUDO_USER")
	if user == "" || runtime.GOOS == "windows" {
		return nil
	}
	if _, err := r.Quiet("chown", []string{"-R", user + ":" + user, dir},
		runner.Timeout(5*time.Minute)); err != nil {
		ui.Warn("the files belong to root; fix with:  sudo chown -R %s %s", user, dir)
	}
	return nil
}

func accessHint() string {
	return "If the repository is private, sign in first — with the GitHub CLI:\n" +
		"    gh auth login\n" +
		"  then run setup again. Or download the code yourself, unpack it, and\n" +
		"  run setup from inside that folder."
}

// ─── Docker ─────────────────────────────────────────────────────────────────

// DockerInstallable reports whether setup can install Docker on this machine
// without the operator doing it by hand, and how.
func DockerInstallable() (method string, can bool) {
	switch runtime.GOOS {
	case "linux":
		if os.Geteuid() == 0 {
			return "script", true
		}
		return "", false
	case "windows":
		if runner.Look("winget") {
			return "winget", true
		}
		return "", false
	default:
		return "", false
	}
}

// InstallDocker installs the engine. The caller is responsible for having asked
// first: this function does the work and says what it did.
func InstallDocker(r *runner.Runner, method string) error {
	switch method {
	case "script":
		ui.Step("installing Docker (this takes a few minutes)")
		script, err := fetchText("https://get.docker.com")
		if err != nil {
			return err
		}
		if _, err := r.Run("sh", []string{"-s"},
			runner.Stdin(strings.NewReader(script)),
			runner.Stream(), runner.Timeout(20*time.Minute)); err != nil {
			return fmt.Errorf("the Docker installer failed: %w", err)
		}
		// On a server install nothing has started the service yet.
		if runner.Look("systemctl") {
			if _, err := r.Quiet("systemctl", []string{"enable", "--now", "docker"},
				runner.Timeout(3*time.Minute)); err != nil {
				ui.Warn("Docker was installed but would not start: %s", err)
			}
		}
		if user := os.Getenv("SUDO_USER"); user != "" {
			// So the operator can use docker later without sudo. It only takes
			// effect on their next login, which is worth saying out loud.
			if _, err := r.Quiet("usermod", []string{"-aG", "docker", user},
				runner.Timeout(1*time.Minute)); err == nil {
				ui.Done("added %s to the docker group (effective after logging out and back in)", user)
			}
		}
		ui.Done("Docker installed")
		return nil

	case "winget":
		ui.Step("installing Docker Desktop with winget (this takes several minutes)")
		if _, err := r.Run("winget", []string{"install", "--exact", "--id", "Docker.DockerDesktop",
			"--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"},
			runner.Stream(), runner.Timeout(30*time.Minute)); err != nil {
			return fmt.Errorf("winget could not install Docker Desktop: %w", err)
		}
		ui.Done("Docker Desktop installed")
		return nil

	default:
		return fmt.Errorf("setup cannot install Docker on this machine")
	}
}

// DescribeInstall says what setup is about to do, before it asks permission.
// Downloading and running someone else's installer is not something to do
// quietly, even when it is the normal way to install the thing.
func DescribeInstall(method string) string {
	switch method {
	case "script":
		return `Setup can install it for you now. It downloads Docker's own installer
from get.docker.com and runs it — the same thing Docker's instructions
tell you to do by hand. It takes a few minutes.`
	case "winget":
		return `Setup can install it for you now, using winget, the app installer that
comes with Windows. It downloads Docker Desktop from Docker and
installs it. It takes several minutes.`
	default:
		return ""
	}
}

// NeedsRestartAfterInstall reports whether the operator has to do something
// themselves before the engine will answer.
func NeedsRestartAfterInstall(method string) string {
	if method == "winget" {
		return "Docker Desktop is installed but not running yet, and on a first install\n" +
			"  Windows usually needs a reboot to finish enabling its virtual machine.\n" +
			"  Restart this machine, open Docker Desktop once, then run setup again."
	}
	return ""
}

func fetchText(url string) (string, error) {
	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("could not download %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%s returned %s", url, resp.Status)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	return string(body), nil
}
