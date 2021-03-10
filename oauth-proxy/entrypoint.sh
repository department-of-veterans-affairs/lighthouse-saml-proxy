#!/usr/bin/env bash

echo Hello world!
echo $CUSTOM_CERTS

if [ -n "$CUSTOM_CERTS" ]; then
  # copy custom certs to /tmp then append them to existing certs.
  echo custom cert $CUSTOM_CERTS was detected
  aws ssm get-parameters --names $CUSTOM_CERTS | jq '.Parameters[0].Value' > /tmp/customCerts.cer
  cat /tmp/customCerts.cer

fi