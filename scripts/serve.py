#!/usr/bin/env python3
"""Serve src/ on :8000 for local preview, mapping /images/ to ./images.
In production the worker serves /images/* from the R2 bucket (see
infra/worker.py), and the images live outside src/, so plain http.server
cannot see them. This maps them for local viewing only.
"""

import functools
import http.server
from pathlib import Path

REPO = Path(__file__).parent.parent
SRC = REPO / "src"
IMAGES = REPO / "images"
PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith("/images/"):
            rel = path.removeprefix("/images/").lstrip("/")
            return str(IMAGES / rel)
        return super().translate_path(path)

def main():
    handler = functools.partial(Handler, directory=SRC)
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"Serving src/ on http://localhost:{PORT}/  (images from ./images)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
