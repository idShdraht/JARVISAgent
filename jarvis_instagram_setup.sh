#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  J.A.R.V.I.S — Instagram Integration Setup
#  Developed by Balaraman
#  Run inside Ubuntu AFTER jarvis.sh, OR called automatically.
# ═══════════════════════════════════════════════════════════════

set -e
export CLAWDBOT_PROFILE=jarvis
export OPENCLAW_PROFILE=jarvis
export NODE_OPTIONS="--require /root/hijack.js"

RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
CYN='\033[38;5;51m'; BLU='\033[38;5;27m'; GLD='\033[38;5;220m'
WHT='\033[38;5;231m'; GRN='\033[38;5;48m'; RED='\033[38;5;203m'

spin() {
  local msg="$1"; local pid=$!; local i=0
  local f=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYN}${f[$i]}${RESET}  ${WHT}${msg}${RESET}"
    i=$(( (i+1) % ${#f[@]} )); sleep 0.1
  done
  printf "\r  ${GRN}✔${RESET}  ${WHT}${msg}${RESET}\n"
}

hdr() { echo -e "\n  ${GLD}${BOLD}⟫ $1${RESET}\n"; }

clear
echo -e "${CYN}${BOLD}"
echo '  ╔══════════════════════════════════════════════════════════╗'
echo '  ║   J.A.R.V.I.S  ─  Instagram Setup                       ║'
echo -e "  ║${GLD}   Developed by Balaraman${CYN}                                 ║"
echo '  ╚══════════════════════════════════════════════════════════╝'
echo -e "${RESET}"

# ─── Locate the JARVIS source dir ─────────────────────────────
# When called from jarvis.sh the IG files are in /tmp/jarvis_ig_src/
# When run manually, detect the location of this script.
if [ -d "/tmp/jarvis_ig_src" ]; then
  SRC="/tmp/jarvis_ig_src"
else
  SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

IG_DIR="/root/JARVIS"
mkdir -p "$IG_DIR"

hdr "Copying Instagram module to $IG_DIR"
cp "$SRC/jarvis_instagram.mjs" "$IG_DIR/"
cp "$SRC/package.json"         "$IG_DIR/"
echo -e "  ${GRN}✔${RESET}  Files copied"

hdr "Installing npm packages"
(cd "$IG_DIR" && npm install --no-fund --no-audit 2>&1) > /tmp/jarvis_ig_npm.log 2>&1 &
spin "Installing instagram-private-api and mysql2..."

if ! grep -q '"instagram-private-api"' /tmp/jarvis_ig_npm.log 2>/dev/null && \
   [ ! -d "$IG_DIR/node_modules/instagram-private-api" ]; then
  # Second attempt if something went wrong
  (cd "$IG_DIR" && npm install --legacy-peer-deps --no-fund) > /tmp/jarvis_ig_npm2.log 2>&1
fi
echo -e "  ${GRN}✔${RESET}  npm packages installed"

hdr "Registering jarvis-ig command"
cat > /usr/local/bin/jarvis-ig << 'IGBIN'
#!/bin/bash
export CLAWDBOT_PROFILE=jarvis
export OPENCLAW_PROFILE=jarvis
export NODE_OPTIONS="--require /root/hijack.js"
cd /root/JARVIS && node jarvis_instagram.mjs "$@"
IGBIN
chmod +x /usr/local/bin/jarvis-ig
ln -sf /usr/local/bin/jarvis-ig /usr/local/bin/jarvis-instagram
echo -e "  ${GRN}✔${RESET}  Commands ready: ${CYN}jarvis-ig${RESET} / ${CYN}jarvis-instagram${RESET}"

# Source .jarvis_env if present
if [ -f "$IG_DIR/.jarvis_env" ]; then
  source "$IG_DIR/.jarvis_env" 2>/dev/null || true
fi

echo ""
echo -e "${CYN}${BOLD}"
echo '  ╔══════════════════════════════════════════════════════════╗'
echo -e "  ║  ${GRN}${BOLD}Instagram integration ready!${CYN}                             ║"
echo '  ╠══════════════════════════════════════════════════════════╣'
echo -e "  ║  Run: ${WHT}jarvis-ig${CYN}                                         ║"
echo '  ╚══════════════════════════════════════════════════════════╝'
echo -e "${RESET}"
