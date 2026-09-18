// Package ui is the terminal front end for the setup program: colours, framed
// headings, the prompt helpers the wizard asks questions with, and the step
// log that narrates the install.
//
// It deliberately avoids a full-screen TUI. Setup spends most of its time
// streaming output from Docker and psql, and a scrolling transcript is both
// easier to read afterwards and easier to paste into a bug report than a
// redrawn screen.
package ui

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

// Colours are disabled when NO_COLOR is set or stdout is not a terminal.
var colorEnabled = true

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	dim    = "\033[2m"
	red    = "\033[31m"
	green  = "\033[32m"
	yellow = "\033[33m"
	blue   = "\033[36m"
	purple = "\033[35m"
)

var in = bufio.NewReader(os.Stdin)

// Init prepares the terminal. On Windows it also asks the console host to
// interpret ANSI escapes, which it does not do by default in older builds.
func Init() {
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		colorEnabled = false
	}
	enableVirtualTerminal()
}

func c(code, s string) string {
	if !colorEnabled {
		return s
	}
	return code + s + reset
}

// Bold, Dim and the colour helpers are exported so callers can highlight
// fragments inside their own sentences.
func Bold(s string) string   { return c(bold, s) }
func Dim(s string) string    { return c(dim, s) }
func Green(s string) string  { return c(green, s) }
func Yellow(s string) string { return c(yellow, s) }
func Red(s string) string    { return c(red, s) }
func Cyan(s string) string   { return c(blue, s) }

// Banner prints the program title block.
func Banner(version string) {
	fmt.Println()
	fmt.Println(c(purple+bold, "  ╔═══════════════════════════════════════════════════╗"))
	fmt.Println(c(purple+bold, "  ║             O M E G A C A S E S   S E T U P       ║"))
	fmt.Println(c(purple+bold, "  ╚═══════════════════════════════════════════════════╝"))
	fmt.Println(c(dim, "                     version "+version))
	fmt.Println()
}

// Section prints a numbered heading for one phase of the install.
func Section(n int, total int, title string) {
	fmt.Println()
	fmt.Printf("%s %s\n", c(purple+bold, fmt.Sprintf("[%d/%d]", n, total)), Bold(title))
	fmt.Println(c(dim, strings.Repeat("─", 55)))
}

// Say prints an ordinary line of explanation.
func Say(format string, a ...any) { fmt.Printf(format+"\n", a...) }

// Step reports work that is starting; Done, Warn and Fail close it out.
func Step(format string, a ...any) {
	fmt.Printf("  %s %s\n", c(blue, "→"), fmt.Sprintf(format, a...))
}
func Done(format string, a ...any) {
	fmt.Printf("  %s %s\n", c(green, "✓"), fmt.Sprintf(format, a...))
}
func Warn(format string, a ...any) {
	fmt.Printf("  %s %s\n", c(yellow, "!"), fmt.Sprintf(format, a...))
}
func Fail(format string, a ...any) { fmt.Printf("  %s %s\n", c(red, "✗"), fmt.Sprintf(format, a...)) }

// Indented wraps a writer so streamed subprocess output is visibly nested
// under the step that produced it.
func Indented(w io.Writer) io.Writer { return &indentWriter{w: w} }

type indentWriter struct {
	w       io.Writer
	midLine bool
}

func (iw *indentWriter) Write(p []byte) (int, error) {
	for _, line := range strings.SplitAfter(string(p), "\n") {
		if line == "" {
			continue
		}
		if !iw.midLine {
			fmt.Fprint(iw.w, c(dim, "      │ "))
		}
		fmt.Fprint(iw.w, c(dim, strings.TrimSuffix(line, "\n")))
		if strings.HasSuffix(line, "\n") {
			fmt.Fprintln(iw.w)
			iw.midLine = false
		} else {
			iw.midLine = true
		}
	}
	return len(p), nil
}

// Ask reads a line of text. An empty answer falls back to def; when def is
// empty the question repeats until something is typed.
func Ask(question, def string) string {
	for {
		if def != "" {
			fmt.Printf("  %s %s %s ", c(blue, "?"), Bold(question), c(dim, "["+def+"]"))
		} else {
			fmt.Printf("  %s %s ", c(blue, "?"), Bold(question))
		}
		line, err := in.ReadString('\n')
		if err != nil && strings.TrimSpace(line) == "" {
			return def
		}
		answer := strings.TrimSpace(line)
		if answer == "" {
			if def != "" {
				return def
			}
			Warn("An answer is needed here.")
			continue
		}
		return answer
	}
}

// AskOptional reads a line that is allowed to stay empty.
func AskOptional(question string) string {
	fmt.Printf("  %s %s %s ", c(blue, "?"), Bold(question), c(dim, "(press Enter to skip)"))
	line, _ := in.ReadString('\n')
	return strings.TrimSpace(line)
}

// AskSecret reads a value that should not be echoed to the screen. If the
// terminal cannot suppress echo the value is read normally and the user is
// told, rather than silently leaking it.
func AskSecret(question string) string {
	fmt.Printf("  %s %s %s ", c(blue, "?"), Bold(question), c(dim, "(hidden, Enter to skip)"))
	s, ok := readPassword()
	fmt.Println()
	if !ok {
		Warn("This terminal will not hide typing, so the value above is visible.")
	}
	return strings.TrimSpace(s)
}

// Confirm asks a yes/no question.
func Confirm(question string, def bool) bool {
	hint := "y/N"
	if def {
		hint = "Y/n"
	}
	for {
		fmt.Printf("  %s %s %s ", c(blue, "?"), Bold(question), c(dim, "["+hint+"]"))
		line, err := in.ReadString('\n')
		answer := strings.ToLower(strings.TrimSpace(line))
		if answer == "" {
			if err != nil {
				fmt.Println()
			}
			return def
		}
		switch answer {
		case "y", "yes":
			return true
		case "n", "no":
			return false
		}
		Warn("Please answer yes or no.")
	}
}

// Choice presents a numbered menu and returns the zero-based index picked.
func Choice(question string, options []string, def int) int {
	fmt.Println()
	fmt.Printf("  %s %s\n", c(blue, "?"), Bold(question))
	for i, opt := range options {
		marker := " "
		if i == def {
			marker = c(green, "•")
		}
		// An option may carry a second line after a newline: it is shown dimmed
		// underneath as explanatory text.
		parts := strings.SplitN(opt, "\n", 2)
		fmt.Printf("      %s %s  %s\n", marker, c(bold, strconv.Itoa(i+1)+")"), parts[0])
		if len(parts) == 2 {
			for _, extra := range strings.Split(parts[1], "\n") {
				fmt.Printf("           %s\n", c(dim, extra))
			}
		}
	}
	for {
		fmt.Printf("    %s ", c(dim, fmt.Sprintf("choose 1-%d [%d]:", len(options), def+1)))
		line, err := in.ReadString('\n')
		answer := strings.TrimSpace(line)
		if answer == "" {
			if err != nil {
				fmt.Println()
			}
			return def
		}
		n, convErr := strconv.Atoi(answer)
		if convErr == nil && n >= 1 && n <= len(options) {
			return n - 1
		}
		Warn("Type one of the numbers listed above.")
	}
}

// Pause holds the window open so a double-clicked installer does not vanish
// before its closing message can be read.
func Pause(message string) {
	fmt.Println()
	fmt.Printf("  %s ", c(dim, message))
	_, _ = in.ReadString('\n')
}
