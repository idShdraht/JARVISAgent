#!/bin/bash
set -e

LOCK_FILE="UPSTREAM_LOCK.json"

if [ ! -f "$LOCK_FILE" ]; then
    echo "FATAL: $LOCK_FILE not found. Supply chain defense broken."
    exit 1
fi

EXPECTED_SHA256=$(node -p "require('./$LOCK_FILE').sha256")
EXPECTED_COMMIT=$(node -p "require('./$LOCK_FILE').commit_sha")

echo "Fetching OpenClaw core payload anchored to commit $EXPECTED_COMMIT..."

# Download directly by verified commit rather than malleable version tags
curl -sL "https://github.com/openclaw/openclaw/archive/${EXPECTED_COMMIT}.tar.gz" -o upstream.tar.gz

# Verify SHA256 integrity mechanically prior to extraction
if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_SHA256=$(sha256sum upstream.tar.gz | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_SHA256=$(shasum -a 256 upstream.tar.gz | awk '{print $1}')
else
    echo "FATAL: sha256sum or shasum not available in build environment."
    exit 1
fi

if [ "$EXPECTED_SHA256" != "$ACTUAL_SHA256" ]; then
    echo "FATAL: Upstream integrity hash mismatch! Possible supply chain attack."
    echo "Expected: $EXPECTED_SHA256"
    echo "Actual:   $ACTUAL_SHA256"
    exit 1
fi
echo "$ACTUAL_SHA256  upstream.tar.gz" > upstream.sha256
echo "Calculated SHA256 matches locking schema!"

rm -rf package
tar -xzf upstream.tar.gz
rm upstream.tar.gz

# Double-verify extracted folder structure matches the hard commit ID payload exactly
if [ ! -d "openclaw-${EXPECTED_COMMIT}" ]; then
    echo "FATAL: Extracted source commit_sha directory does not match locking boundary expectation."
    exit 1
fi

mv "openclaw-${EXPECTED_COMMIT}" package
echo "Successfully extracted OpenClaw payload to ./package/"
