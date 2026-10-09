#!/bin/bash

set -e
pkill -f "serve.py" || true
pkill -f "http.server 8000" || true
echo "Starting HTTP server on port 8000."
exec python3 /workspaces/website/scripts/serve.py
