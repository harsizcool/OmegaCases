//go:build darwin || freebsd || netbsd || openbsd

package ui

const (
	getTermios = 0x40487413 // TIOCGETA
	setTermios = 0x80487414 // TIOCSETA
)
