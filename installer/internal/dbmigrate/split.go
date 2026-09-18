package dbmigrate

import (
	"fmt"
	"regexp"
	"strings"
)

// Split breaks a SQL script into individual statements. It is aware of single
// quotes, double-quoted identifiers, dollar-quoted bodies (including tagged
// ones such as $mig$) and both comment styles, so a semicolon inside a
// function body does not end the statement.
func Split(script string) []string {
	var (
		statements []string
		current    strings.Builder
		runes      = []rune(script)
	)

	const (
		normal = iota
		inSingle
		inDouble
		inLineComment
		inBlockComment
		inDollar
	)
	state := normal
	dollarTag := ""

	flush := func() {
		text := strings.TrimSpace(current.String())
		if text != "" {
			statements = append(statements, text)
		}
		current.Reset()
	}

	for i := 0; i < len(runes); i++ {
		ch := runes[i]
		next := rune(0)
		if i+1 < len(runes) {
			next = runes[i+1]
		}

		switch state {
		case normal:
			switch {
			case ch == '-' && next == '-':
				state = inLineComment
				current.WriteRune(ch)
			case ch == '/' && next == '*':
				state = inBlockComment
				current.WriteRune(ch)
			case ch == '\'':
				state = inSingle
				current.WriteRune(ch)
			case ch == '"':
				state = inDouble
				current.WriteRune(ch)
			case ch == '$':
				if tag, width := dollarTagAt(runes, i); width > 0 {
					dollarTag = tag
					state = inDollar
					current.WriteString(string(runes[i : i+width]))
					i += width - 1
				} else {
					current.WriteRune(ch)
				}
			case ch == ';':
				flush()
			default:
				current.WriteRune(ch)
			}

		case inLineComment:
			current.WriteRune(ch)
			if ch == '\n' {
				state = normal
			}

		case inBlockComment:
			current.WriteRune(ch)
			if ch == '*' && next == '/' {
				current.WriteRune(next)
				i++
				state = normal
			}

		case inSingle:
			current.WriteRune(ch)
			if ch == '\'' {
				if next == '\'' { // an escaped quote inside the literal
					current.WriteRune(next)
					i++
				} else {
					state = normal
				}
			}

		case inDouble:
			current.WriteRune(ch)
			if ch == '"' {
				if next == '"' {
					current.WriteRune(next)
					i++
				} else {
					state = normal
				}
			}

		case inDollar:
			current.WriteRune(ch)
			if ch == '$' && strings.HasPrefix(string(runes[i:]), dollarTag) {
				current.WriteString(dollarTag[1:])
				i += len(dollarTag) - 1
				state = normal
				dollarTag = ""
			}
		}
	}
	flush()
	return statements
}

// dollarTagAt recognises a dollar-quote opener at position i, returning the tag
// ("$$" or "$name$") and how many runes it spans.
func dollarTagAt(runes []rune, i int) (string, int) {
	if runes[i] != '$' {
		return "", 0
	}
	for j := i + 1; j < len(runes); j++ {
		ch := runes[j]
		if ch == '$' {
			return string(runes[i : j+1]), j + 1 - i
		}
		isIdent := ch == '_' ||
			(ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
			(ch >= '0' && ch <= '9' && j > i+1)
		if !isIdent {
			return "", 0
		}
	}
	return "", 0
}

// createPolicy matches the statements that need guarding, capturing the policy
// name and the table it is attached to.
var createPolicy = regexp.MustCompile(
	`(?is)^CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_][\w$]*))\s+ON\s+(?:"?([A-Za-z_][\w$]*)"?\s*\.\s*)?"?([A-Za-z_][\w$]*)"?`,
)

// MakeIdempotent rewrites statements that would fail on a second run.
//
// The project's 001 script uses "CREATE POLICY IF NOT EXISTS", which no version
// of PostgreSQL accepts, and 002 uses a plain CREATE POLICY that fails once the
// policy exists. Both become a guarded DO block, so the scripts stay as they
// are in the repository and still apply cleanly to a fresh or an existing
// database.
func MakeIdempotent(statement string) string {
	trimmed := strings.TrimSpace(stripLeadingComments(statement))
	m := createPolicy.FindStringSubmatch(trimmed)
	if m == nil {
		return statement
	}

	policy := m[1]
	if policy == "" {
		policy = m[2]
	}
	schema := m[3]
	if schema == "" {
		schema = "public"
	}
	table := m[4]

	// The original statement, with the invalid clause removed so PostgreSQL
	// will accept it, re-quoted for EXECUTE.
	clean := regexp.MustCompile(`(?is)^(CREATE\s+POLICY\s+)IF\s+NOT\s+EXISTS\s+`).
		ReplaceAllString(trimmed, "$1")

	return fmt.Sprintf(`DO $omega_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = %s AND tablename = %s AND policyname = %s
  ) THEN
    EXECUTE %s;
  END IF;
END
$omega_guard$`,
		quote(schema), quote(table), quote(policy), quote(clean))
}

func stripLeadingComments(s string) string {
	for {
		s = strings.TrimSpace(s)
		switch {
		case strings.HasPrefix(s, "--"):
			if idx := strings.IndexByte(s, '\n'); idx >= 0 {
				s = s[idx+1:]
				continue
			}
			return ""
		case strings.HasPrefix(s, "/*"):
			if idx := strings.Index(s, "*/"); idx >= 0 {
				s = s[idx+2:]
				continue
			}
			return ""
		}
		return s
	}
}

func quote(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
