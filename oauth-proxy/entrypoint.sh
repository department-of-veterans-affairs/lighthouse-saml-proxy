#!/usr/bin/env bash

if [ -n "$CUSTOM_CERTS" ]; then
  mkdir -p /tmp/customcerts/
  aws ssm get-parameters --names $CUSTOM_CERTS | jq -r '.Parameters[0].Value' > /tmp/customcerts/certs.cer
  cat /tmp/customcerts/certs.cer >> /ca-certificates/ca-certs.pem
fi

exec "$@"