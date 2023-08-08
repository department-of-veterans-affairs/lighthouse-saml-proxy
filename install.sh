#!/usr/bin/env bash
# Team Pivot!

if npm install 2>&1 | grep -q "WARN"; then
    echo ERROR: npm WARN detected
    exit 1
fi

echo "No NPM warnings detected."
exit 0