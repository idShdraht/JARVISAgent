#!/bin/bash

# J.A.R.V.I.S. Self-Healing Watchdog
# Tailored for Termux environment

# Detect Termux TMPDIR or fallback
TMPDIR="${TMPDIR:-/tmp}"
LOG_FILE="$HOME/.jarvis_watchdog.log"
PORTAL_URL="${PORTAL_URL:-https://jarvisagent.onrender.com}"

echo "[$(date)] J.A.R.V.I.S. Watchdog Guardian Initialized" >> "$LOG_FILE"

while true; do
  # 1. Check if the Node.js Bridge is running
  # We look for the polling process
  BRIDGE_PID=$(pgrep -f "jarvis.sh --bridge")

  if [ -z "$BRIDGE_PID" ]; then
    echo "[$(date)] WARNING: J.A.R.V.I.S. Bridge not detected. Restarting..." >> "$LOG_FILE"
    # Auto-restart command (White-labeled)
    export PORTAL_URL="$PORTAL_URL"
    nohup bash "$HOME/JARVIS/jarvis.sh" --bridge --code="$BRIDGE_CODE" > /dev/null 2>&1 &
  else
    echo "[$(date)] Bridge active (PID: $BRIDGE_PID)" >> "$LOG_FILE"
  fi

  # 2. Heartbeat Ping to Web Portal
  # Lets the portal know the phone is still "alive" and monitoring
  curl -s -X POST "$PORTAL_URL/api/android/report/$BRIDGE_CODE" \
       -H "Content-Type: application/json" \
       -d '{"type": "heartbeat", "data": "Guardian Active", "log": "System health nominal"}' > /dev/null

  # 3. Wait for 30 seconds
  sleep 30
done
