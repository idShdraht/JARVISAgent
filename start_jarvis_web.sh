#!/bin/bash
# JARVIS Web Portal Launcher — Developed by Balaraman
set -e
RESET='\033[0m'; CYN='\033[38;5;51m'; GLD='\033[38;5;220m'; GRN='\033[38;5;48m'; BOLD='\033[1m'

echo -e "\n  ${CYN}${BOLD}╔══════════════════════════════════════════════╗"
echo "  ║   J.A.R.V.I.S — Web Setup Portal             ║"
echo -e "  ║${GLD}   Developed by Balaraman${CYN}                     ║"
echo -e "  ╚══════════════════════════════════════════════╝${RESET}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/web"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "  ${GLD}[!]${RESET} Node.js not found. Install it from https://nodejs.org"
  exit 1
fi

# Install deps
if [ ! -d "node_modules" ]; then
  echo -e "  ${CYN}[*]${RESET} Installing dependencies..."
  npm install --no-fund --no-audit
fi

# Copy env
if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo -e "  ${GLD}[!]${RESET} .env created. Fill in GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
fi

echo -e "  ${GRN}[*]${RESET} Starting JARVIS Web Portal at http://localhost:3000\n"

# Open browser in background
if command -v xdg-open &>/dev/null; then
  (sleep 1.5 && xdg-open http://localhost:3000) &
elif command -v open &>/dev/null; then
  (sleep 1.5 && open http://localhost:3000) &
fi

node server.js
