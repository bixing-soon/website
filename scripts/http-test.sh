set -e
pkill -f "http server 8000" || true
echo "Starting HTTP server on port 8000."
python3 -m http.server 8000 -d /workspaces/website/src
