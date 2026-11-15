#!/bin/bash
# Copy the public result files into the site and deploy (Vercel CLI via the local forwarder if api.vercel.com is blocked).
set -e; cd "$(dirname "$0")/.."
mkdir -p public/data && cp data/run.json data/eval.json data/campaign.json data/offers.json public/data/
export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH
curl -s -o /dev/null -m 8 https://api.vercel.com && unset HTTPS_PROXY || export HTTPS_PROXY=http://127.0.0.1:8899
D=$(vercel deploy --prod --yes 2>/dev/null | grep -oE 'https://aisle-[a-z0-9]+-imprint-hashs-projects\.vercel\.app' | head -1)
echo "deployed $D"; vercel alias set "$D" aisle-ads.vercel.app 2>&1 | grep -E 'Success|Error'
