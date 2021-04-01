#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Dependency Check

if ! docker -v COMMAND &> /dev/null
then
    echo "Docker must be installed"
    exit 1
fi

if ! jq --version COMMAND &> /dev/null
then
    echo "jq must be installed"
    exit 1
fi

if [ -z "$HOST" ]; then
  echo "ERROR - HOST is a required environment variable."
  exit 1
fi

if [ -z "$USER_EMAIL" ]; then
  echo "ERROR - USER_EMAIL is a required environment variable."
  exit 1
fi

if [ -z "$USER_PASSWORD" ]; then
  echo "ERROR - USER_PASSWORD is a required environment variable."
  exit 1
fi

if [ -z "$CLIENT_ID" ]; then
  echo "ERROR - CLIENT_ID is a required environment variable."
  exit 1
fi

if [ -z "$CLIENT_SECRET" ]; then
  echo "ERROR - CLIENT_SECRET is a required environment variable."
  exit 1
fi

REDIRECT_URI=${REDIRECT_URI:-https://app/after-auth}

get_access_token() {
  local network=""
  if [[ $HOST == *"localhost"* ]]; then
    network="-it --network container:oauth-proxy_oauth-proxy_1"
  fi

  token=$(docker run \
      $network \
      vasdvp/lighthouse-auth-utils:latest auth \
        --redirect-uri="$REDIRECT_URI" \
        --authorization-url="$HOST" \
        --user-email="$USER_EMAIL" \
        --user-password="$USER_PASSWORD" \
        --client-id="$CLIENT_ID" \
        --client-secret="$CLIENT_SECRET" \
        --scope="openid profile" \
      | jq -r ".access_token")

  echo $token
}
