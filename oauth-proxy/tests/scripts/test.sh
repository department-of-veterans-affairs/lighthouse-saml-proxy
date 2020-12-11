#!/bin/bash
# Team Pivot!
REDIRECT_URI="https://app/after-auth"

token="$(mktemp)"
expired="$(mktemp)"

echo "Starting ..."

CODE=$(docker run \
     vasdvp/lighthouse-auth-utils:latest auth \
     --redirect-uri="$REDIRECT_URI" \
     --authorization-url="$HOST" \
     --user-email="$USER_EMAIL" \
     --user-password="$USER_PASSWORD" \
     --client-id="$CLIENT_ID" \
     --client-secret="$CLIENT_SECRET" \
     --code-only=true  | jq ".code" | tr -d '"')

./token_tests.sh $HOST $CODE $token $expired