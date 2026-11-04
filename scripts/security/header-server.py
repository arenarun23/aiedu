# vercel.json 의 headers 를 그대로 적용하는 임시 정적 서버(시험용)
import http.server, json, re, sys

ROOT = sys.argv[1]
PORT = int(sys.argv[2])
CFG = json.load(open(sys.argv[3]))
RULES = [(re.compile('^' + r['source'] + '$'), r['headers']) for r in CFG.get('headers', [])]


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        path = self.path.split('?')[0]
        for rx, hs in RULES:
            if rx.match(path):
                for h in hs:
                    self.send_header(h['key'], h['value'])
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
