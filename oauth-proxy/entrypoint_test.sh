#!/usr/bin/env bash
# Team Pivot!

usage() {
cat <<EOF
Runs oauth proxy's regression tests.

docker run --rm vasdvp/lighthouse-oauth-proxy-tests \
  --user-email="$USER_EMAIL" \
  --user-password="$USER_PASSWORD" \
  --client-id="$CLIENT_ID" \
  --client-secret="$CLIENT_SECRET" \
  --cc-client-id="$CC_CLIENT_ID" \
  --cc-client-secret="$CC_CLIENT_SECRET" \
  --host="$HOST" \
  --test-claims
EOF
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi