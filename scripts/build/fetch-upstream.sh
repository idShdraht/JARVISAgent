#!/bin/bash
set -e

LOCK_FILE="UPSTREAM_LOCK.json"
LOCAL_SOURCE="core"

if [ ! -f "$LOCK_FILE" ]; then
    echo "FATAL: $LOCK_FILE not found. Supply chain defense broken."
    exit 1
fi

EXPECTED_SHA256=$(node -p "require('./$LOCK_FILE').sha256")
EXPECTED_COMMIT=$(node -p "require('./$LOCK_FILE').commit_sha")

rm -rf package

# ── Attempt remote fetch first ──────────────────────────────
REMOTE_OK=false
echo "Attempting upstream fetch anchored to commit $EXPECTED_COMMIT..."

if curl -sfL "https://github.com/openclaw/openclaw/archive/${EXPECTED_COMMIT}.tar.gz" -o upstream.tar.gz 2>/dev/null; then
    # Verify SHA256 integrity
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_SHA256=$(sha256sum upstream.tar.gz | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        ACTUAL_SHA256=$(shasum -a 256 upstream.tar.gz | awk '{print $1}')
    else
        echo "WARNING: sha256sum/shasum not available. Skipping remote integrity check."
        rm -f upstream.tar.gz
    fi

    if [ -n "$ACTUAL_SHA256" ]; then
        if [ "$EXPECTED_SHA256" = "$ACTUAL_SHA256" ]; then
            echo "Remote SHA256 matches locking schema."
            tar -xzf upstream.tar.gz
            rm upstream.tar.gz

            if [ -d "openclaw-${EXPECTED_COMMIT}" ]; then
                mv "openclaw-${EXPECTED_COMMIT}" package
                REMOTE_OK=true
                echo "Successfully extracted remote upstream payload to ./package/"
            else
                echo "WARNING: Extracted directory mismatch. Falling back to local source."
            fi
        else
            echo "WARNING: SHA256 mismatch (expected=$EXPECTED_SHA256, actual=$ACTUAL_SHA256). Falling back to local source."
            rm -f upstream.tar.gz
        fi
    fi
else
    echo "WARNING: Remote upstream fetch failed (network/URL issue). Falling back to local source."
    rm -f upstream.tar.gz
fi

# ── Fallback: copy local core/ directory ────────────────────
if [ "$REMOTE_OK" = "false" ]; then
    if [ -d "$LOCAL_SOURCE" ]; then
        echo "Using local core/ directory as upstream source..."
        cp -r "$LOCAL_SOURCE" package
        echo "Successfully copied local upstream payload to ./package/"
    else
        echo "FATAL: Neither remote fetch nor local core/ directory available."
        exit 1
    fi
fi

echo "Upstream source ready at ./package/"
