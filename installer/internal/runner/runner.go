// Package runner executes the external commands setup depends on (docker,
// docker compose, psql inside the database container) and keeps a transcript.
//
// Everything a subprocess prints goes to the log file unconditionally and to
// the screen only when the caller asks for it, so a long `compose build` can
// stay quiet while still leaving a full record behind for diagnosis.
package runner

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/harsizcool/omegacases/installer/internal/ui"
)

// Runner runs commands in a fixed working directory.
type Runner struct {
	Dir     string
	logFile *os.File
}

// New opens (or creates) the transcript at logPath.
func New(dir, logPath string) (*Runner, error) {
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, fmt.Errorf("cannot write the setup log at %s: %w", logPath, err)
	}
	fmt.Fprintf(f, "\n===== setup run started %s =====\n", time.Now().Format(time.RFC3339))
	return &Runner{Dir: dir, logFile: f}, nil
}

// Close finishes the transcript.
func (r *Runner) Close() {
	if r.logFile != nil {
		_ = r.logFile.Close()
	}
}

// LogPath reports where the transcript is being written.
func (r *Runner) LogPath() string {
	if r.logFile == nil {
		return ""
	}
	return r.logFile.Name()
}

// Note writes a line to the transcript only.
func (r *Runner) Note(format string, a ...any) {
	if r.logFile != nil {
		fmt.Fprintf(r.logFile, "# "+format+"\n", a...)
	}
}

type options struct {
	stdin   io.Reader
	env     []string
	show    bool
	dir     string
	timeout time.Duration
}

// Option adjusts one command invocation.
type Option func(*options)

// Stream echoes the command's output to the screen as it arrives.
func Stream() Option { return func(o *options) { o.show = true } }

// Stdin feeds data to the command.
func Stdin(r io.Reader) Option { return func(o *options) { o.stdin = r } }

// Env appends KEY=VALUE pairs to the command's environment.
func Env(pairs ...string) Option { return func(o *options) { o.env = append(o.env, pairs...) } }

// In overrides the working directory for one call.
func In(dir string) Option { return func(o *options) { o.dir = dir } }

// Timeout caps how long the command may run.
func Timeout(d time.Duration) Option { return func(o *options) { o.timeout = d } }

// Run executes a command and returns its combined output. The error, when
// there is one, already carries the tail of that output, so callers can
// surface something useful without re-reading the log.
func (r *Runner) Run(name string, args []string, opts ...Option) (string, error) {
	o := &options{dir: r.Dir}
	for _, apply := range opts {
		apply(o)
	}

	ctx := context.Background()
	if o.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, o.timeout)
		defer cancel()
	}

	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = o.dir
	if len(o.env) > 0 {
		cmd.Env = append(os.Environ(), o.env...)
	}
	cmd.Stdin = o.stdin

	var captured bytes.Buffer
	sinks := []io.Writer{&captured}
	if r.logFile != nil {
		sinks = append(sinks, r.logFile)
	}
	if o.show {
		sinks = append(sinks, ui.Indented(os.Stdout))
	}
	out := io.MultiWriter(sinks...)
	cmd.Stdout = out
	cmd.Stderr = out

	r.Note("$ %s %s (in %s)", name, strings.Join(args, " "), o.dir)
	err := cmd.Run()
	text := captured.String()

	if ctx.Err() == context.DeadlineExceeded {
		return text, fmt.Errorf("%s timed out after %s", name, o.timeout)
	}
	if err != nil {
		return text, fmt.Errorf("%s %s failed: %w%s", name, strings.Join(args, " "), err, tail(text))
	}
	return text, nil
}

// Quiet runs a command purely to inspect its result, keeping output off screen.
func (r *Runner) Quiet(name string, args []string, opts ...Option) (string, error) {
	return r.Run(name, args, opts...)
}

// Look reports whether an executable is on PATH.
func Look(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func tail(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	lines := strings.Split(s, "\n")
	if len(lines) > 12 {
		lines = lines[len(lines)-12:]
	}
	return "\n        " + strings.Join(lines, "\n        ")
}
