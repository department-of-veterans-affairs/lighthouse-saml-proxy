#!/usr/bin/env bash
# Team Pivot!

output=$(npm install --loglevel=error 2>&1)

if npm "$output" | grep -q "WARN"; then
    echo ERROR: npm WARN detected
    exit 1
fi

echo "No NPM warnings detected."
exit 0