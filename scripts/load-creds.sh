#!/bin/bash

# loads:
# - CLOUDFLARE_API_TOKEN
# - TF_VAR_account_id
# - TF_VAR_zone_id
# - AWS_ACCESS_KEY_ID (for R2)
# - AWS_SECRET_ACCESS_KEY (for R2)

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Error: run this with 'source scripts/load-creds.sh' (executing it cannot set your shell's environment)."
    exit 1
fi

echo "Decrypting credentials..."
age -d -i /workspaces/website/age-key.txt -o /tmp/creds /workspaces/website/infra/creds.age
if [[ -f /tmp/creds ]]; then
    source /tmp/creds
    rm -f /tmp/creds
else
    echo "Error: failed to decrypt credentials."
    rm -f /tmp/creds
    exit 1
fi
