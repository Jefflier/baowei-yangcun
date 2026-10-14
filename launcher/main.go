// 保卫羊村怀旧服 · Windows 启动器
//
// 把单文件版游戏（dist/保卫羊村怀旧服.html，gzip 后）打进 exe：
// 在本机 127.0.0.1 起一个只给自己用的小服务器，再用 Edge 的「应用模式」开一个独立窗口来玩
// （没有地址栏和标签页，看起来就是个普通程序；Windows 10/11 都自带 Edge）。找不到 Edge 就用 Chrome，
// 再不行就交给默认浏览器。
//
// 窗口关掉后页面不再发心跳，启动器自己退出。再次双击 exe 时如果已经在运行，就只再开一个窗口。
// 构建：python tools/build_exe.py
package main

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed game.html.gz
var gameGz []byte

const (
	appID = "baowei-yangcun-launcher"
	// 固定端口：存档存在浏览器的 localStorage 里，按「地址 + 端口」区分，端口一变就读不到原来的存档了
	basePort = 18123
	tries    = 10
)

var errRunning = errors.New("already running")

func main() {
	ln, url, err := listen()
	if errors.Is(err, errRunning) { // 已经开着一个了：再开一个窗口就行
		if !openWindow(url) {
			notify("游戏已经在运行，请在浏览器里打开：\n" + url)
		}
		return
	}
	if err != nil {
		notify("无法启动游戏：" + err.Error())
		os.Exit(1)
	}

	var lf life
	// 页面每 5 秒才发一次心跳，空闲连接留久一点，省得反复重连
	srv := &http.Server{Handler: handler(&lf), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 10 * time.Minute}
	go srv.Serve(ln)
	if os.Getenv("BAOWEI_NO_BROWSER") == "" && !openWindow(url) {
		notify("没能自动打开浏览器，请手动打开：\n" + url)
	}
	lf.wait()
}

// listen 占住固定端口；端口被占时看看是不是自己（已经在运行），不是就往后找空端口。
func listen() (net.Listener, string, error) {
	for p := basePort; p < basePort+tries; p++ {
		addr := "127.0.0.1:" + strconv.Itoa(p)
		url := "http://" + addr + "/"
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln, url, nil
		}
		if isOurs(url) {
			return nil, url, errRunning
		}
	}
	return nil, "", fmt.Errorf("本机端口 %d~%d 都被占用了", basePort, basePort+tries-1)
}

func isOurs(url string) bool {
	c := http.Client{Timeout: 2 * time.Second}
	r, err := c.Get(url + "__id")
	if err != nil {
		return false
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 64))
	return string(b) == appID
}

func handler(lf *life) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		h := w.Header()
		h.Set("Content-Type", "text/html; charset=utf-8")
		h.Set("Cache-Control", "no-cache")
		if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") { // 浏览器都支持，直接发压缩的
			h.Set("Content-Encoding", "gzip")
			h.Set("Content-Length", strconv.Itoa(len(gameGz)))
			w.Write(gameGz)
			return
		}
		zr, err := gzip.NewReader(bytes.NewReader(gameGz))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		io.Copy(w, zr)
	})
	mux.HandleFunc("/__id", func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, appID) })
	mux.HandleFunc("/__alive", func(w http.ResponseWriter, r *http.Request) { lf.mark(false); w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("/__bye", func(w http.ResponseWriter, r *http.Request) { lf.mark(true); w.WriteHeader(http.StatusNoContent) })
	return mux
}

// life 记录页面心跳（tools/build_exe.py 往页面里注入了每 5 秒一次的心跳和关闭时的告别）。
// 页面加载完以后就不再需要服务器了（资源全在页面里，存档在浏览器里），所以退出时机宽松一点也无妨。
type life struct {
	mu   sync.Mutex
	seen bool
	last time.Time // 最近一次心跳
	bye  time.Time // 最近一次告别（关窗口或刷新）
}

func (l *life) mark(bye bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if bye {
		l.bye = time.Now()
	} else {
		l.seen, l.last = true, time.Now()
	}
}

func (l *life) wait() {
	start := time.Now()
	for range time.Tick(time.Second) {
		l.mu.Lock()
		seen, last, bye := l.seen, l.last, l.bye
		l.mu.Unlock()
		now := time.Now()
		switch {
		case !seen && now.Sub(start) > 3*time.Minute: // 窗口一直没打开
			return
		case seen && bye.After(last) && now.Sub(bye) > 10*time.Second: // 关掉了（刷新的话马上又会有心跳）
			return
		case seen && now.Sub(last) > 2*time.Minute: // 窗口被强行关掉没来得及道别；最小化时定时器会被限到每分钟一次，所以留足余量
			return
		}
	}
}
