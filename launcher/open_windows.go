package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

// openWindow 用 Edge（或 Chrome）的应用模式开一个独立窗口；都没有就交给默认浏览器。
// 浏览器资料单独放在 %LOCALAPPDATA%\BaoweiYangcun\browser：存档（localStorage）就存在这里，
// 和平时上网用的浏览器互不影响，卸载时删掉这个文件夹即可。
func openWindow(url string) bool {
	profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "BaoweiYangcun", "browser")
	for _, exe := range browsers() {
		cmd := exec.Command(exe,
			"--app="+url,
			"--user-data-dir="+profile,
			"--window-size=1300,790",
			"--no-first-run",
			"--no-default-browser-check",
			"--autoplay-policy=no-user-gesture-required", // 开场音乐不用先点一下
			"--disable-background-mode",                  // 窗口关了就彻底退出，别在后台挂着
		)
		if cmd.Start() == nil {
			go cmd.Wait()
			return true
		}
	}
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start() == nil
}

// browsers 按 Edge 优先、Chrome 其次列出装在常见位置的浏览器。
func browsers() []string {
	var out []string
	for _, rel := range []string{`Microsoft\Edge\Application\msedge.exe`, `Google\Chrome\Application\chrome.exe`} {
		for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
			if base := os.Getenv(env); base != "" {
				if p := filepath.Join(base, rel); fileExists(p) {
					out = append(out, p)
				}
			}
		}
	}
	return out
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// notify 弹一个系统消息框（exe 没有控制台窗口，出错只能这样告诉玩家）。
func notify(msg string) {
	title, _ := syscall.UTF16PtrFromString("保卫羊村 · 怀旧服")
	text, _ := syscall.UTF16PtrFromString(msg)
	const mbIconInformation = 0x40
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0,
		uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), mbIconInformation)
}
