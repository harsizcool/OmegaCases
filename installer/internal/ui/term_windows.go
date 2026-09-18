//go:build windows

package ui

import (
	"bufio"
	"os"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32           = syscall.NewLazyDLL("kernel32.dll")
	procGetConsoleMode = kernel32.NewProc("GetConsoleMode")
	procSetConsoleMode = kernel32.NewProc("SetConsoleMode")
	procGetStdHandle   = kernel32.NewProc("GetStdHandle")
)

const (
	stdOutputHandle                 = ^uintptr(10) // -11
	stdInputHandle                  = ^uintptr(9)  // -10
	enableVirtualTerminalProcessing = 0x0004
	enableEchoInput                 = 0x0004
	enableLineInput                 = 0x0002
	enableProcessedInput            = 0x0001
)

func stdHandle(which uintptr) syscall.Handle {
	h, _, _ := procGetStdHandle.Call(which)
	return syscall.Handle(h)
}

func getMode(h syscall.Handle) (uint32, bool) {
	var mode uint32
	r, _, _ := procGetConsoleMode.Call(uintptr(h), uintptr(unsafe.Pointer(&mode)))
	return mode, r != 0
}

func setMode(h syscall.Handle, mode uint32) bool {
	r, _, _ := procSetConsoleMode.Call(uintptr(h), uintptr(mode))
	return r != 0
}

// enableVirtualTerminal turns on ANSI escape handling for the console, which
// Windows leaves off for legacy programs. If it cannot be enabled the colour
// codes would be printed literally, so colour is switched off instead.
func enableVirtualTerminal() {
	h := stdHandle(stdOutputHandle)
	mode, ok := getMode(h)
	if !ok {
		colorEnabled = false
		return
	}
	if mode&enableVirtualTerminalProcessing == 0 {
		if !setMode(h, mode|enableVirtualTerminalProcessing) {
			colorEnabled = false
		}
	}
}

func readPassword() (string, bool) {
	h := stdHandle(stdInputHandle)
	mode, ok := getMode(h)
	if !ok {
		line, _ := in.ReadString('\n')
		return strings.TrimRight(line, "\r\n"), false
	}
	setMode(h, mode&^enableEchoInput|enableLineInput|enableProcessedInput)
	defer setMode(h, mode)

	// The shared buffered reader may hold input typed before echo was disabled;
	// reading through it keeps the stream in one place.
	line, err := in.ReadString('\n')
	if err != nil && line == "" {
		r := bufio.NewReader(os.Stdin)
		line, _ = r.ReadString('\n')
	}
	return strings.TrimRight(line, "\r\n"), true
}
