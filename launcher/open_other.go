//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// 非 Windows 平台只用来本地调试启动器：打印地址，有 xdg-open / open 就顺手打开。
func openWindow(url string) bool {
	fmt.Println(url)
	for _, c := range []string{"xdg-open", "open"} {
		if p, err := exec.LookPath(c); err == nil {
			return exec.Command(p, url).Start() == nil
		}
	}
	return true
}

func notify(msg string) { fmt.Fprintln(os.Stderr, msg) }
