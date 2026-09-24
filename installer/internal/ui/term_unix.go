//go:build !windows

package ui

import (
	"os"
	"strings"
	"syscall"
	"unsafe"
)

// enableVirtualTerminal is a no-op: POSIX terminals handle ANSI natively.
func enableVirtualTerminal() {}

func ioctl(fd uintptr, req uintptr, t *syscall.Termios) bool {
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, fd, req, uintptr(unsafe.Pointer(t)))
	return errno == 0
}

func readPassword() (string, bool) {
	fd := os.Stdin.Fd()
	var original syscall.Termios
	if !ioctl(fd, getTermios, &original) {
		line, _ := in.ReadString('\n')
		return strings.TrimRight(line, "\r\n"), false
	}
	quiet := original
	quiet.Lflag &^= syscall.ECHO
	if !ioctl(fd, setTermios, &quiet) {
		line, _ := in.ReadString('\n')
		return strings.TrimRight(line, "\r\n"), false
	}
	defer ioctl(fd, setTermios, &original)

	line, _ := in.ReadString('\n')
	return strings.TrimRight(line, "\r\n"), true
}
