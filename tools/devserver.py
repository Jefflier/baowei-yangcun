"""开发用静态服务器：禁用缓存。用法：python tools/devserver.py [端口]
端口优先级：命令行参数 > 环境变量 PORT（预览工具自动分配时用）> 8123。"""
import http.server, os, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a): pass
if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or 8123)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
