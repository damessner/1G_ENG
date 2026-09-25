#!/usr/bin/env python
"""
serve.py -- a local dev server for the game.

    python tools\\serve.py            # http://127.0.0.1:8777
    python tools\\serve.py 9000

Same as `python -m http.server` but sends `Cache-Control: no-store`, so the
browser never serves a stale copy of a file you just edited.

This matters more than it looks. `http.server` sends no Cache-Control at all,
so Chrome applies *heuristic* caching: it invents a freshness lifetime from
the file's Last-Modified, typically around 10% of the age of the file. The
result is a page that half-updates -- new engine, old topic pack -- which
looks exactly like a code bug and is not one. GitHub Pages has the same
10-minute cache in production; see DEPLOY.md.

To see production behaviour locally, just use the real thing:
    python -m http.server 8777
"""
from __future__ import annotations

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):        # quieter than the default
        pass


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Word Quest dev server: http://127.0.0.1:{port}/")
        print("Ctrl+C to stop.  Caching disabled, so edits appear on reload.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
