#!/bin/bash

if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
    echo "Error: CLOUDFLARE_API_TOKEN not set."
    exit 1
else
    echo "CLOUDFLARE_API_TOKEN is set, installing wrangler."
    npm install wrangler
fi
