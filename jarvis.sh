#!/data/data/com.termux/files/usr/bin/bash

# ═══════════════════════════════════════════════════════════════
#   J.A.R.V.I.S — Just A Rather Very Intelligent System
#   Termux ARM64 Installer
#   Developed by Balaraman
# ═══════════════════════════════════════════════════════════════

# Suppress any underlying engine identity — JARVIS only
export CLAWDBOT_PROFILE=jarvis
export OPENCLAW_PROFILE=jarvis

# ─── Colour Palette ────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
BLINK='\033[5m'

# Electric Cyan (primary)
CYN='\033[38;5;51m'
# Deep Blue (secondary)
BLU='\033[38;5;27m'
# Gold / Amber (accent)
GLD='\033[38;5;220m'
# Soft White
WHT='\033[38;5;231m'
# Mint Green (success)
GRN='\033[38;5;48m'
# Coral Red (warning/error)
RED='\033[38;5;203m'
# Magenta (highlight)
MGT='\033[38;5;213m'

# ─── Helper Functions ──────────────────────────────────────────
if [[ "$*" == *"--bridge"* ]]; then
  BRIDGE_CODE=""
  for arg in "$@"; do
    if [[ $arg == --code=* ]]; then BRIDGE_CODE="${arg#*=}"; fi
  done
  
  if [ -z "$BRIDGE_CODE" ]; then echo "Error: --code=<PAIRING_CODE> required"; exit 1; fi
  
  # Suppress engine identity
  export CLAWDBOT_PROFILE=jarvis
  export OPENCLAW_PROFILE=jarvis
  export JARVIS_BRIDGE=1
  
  # Inherit from environment or use dynamic placeholder
  PORTAL_URL="${PORTAL_URL:-{{PORTAL_URL}}}"
  # Cleanup potential placeholder leftover
  if [ "$PORTAL_URL" == "{{PORTAL_URL}}" ]; then PORTAL_URL="https://jarvisagent.onrender.com"; fi
  if [ ! -z "$PORTAL_URL_ENV" ]; then PORTAL_URL="$PORTAL_URL_ENV"; fi
  
  # 🌐 VERIFY CONNECTIVITY
  echo -e "\033[38;5;48m[ JARVIS ] TESTING UPLINK... \033[0m"
  if ! curl -s --head "$PORTAL_URL/api/platform" | head -n 1 | grep "200" > /dev/null; then
    echo -e "\033[38;5;196m[ ERROR ] COUND NOT REACH PORTAL ADDR: $PORTAL_URL\033[0m"
    echo -e "Check your internet or PORTAL_URL environment variable."
    exit 1
  fi

  # Use a local temp dir for Termux compatibility
  JARVIS_TMP="$HOME/.jarvis_tmp"
  mkdir -p "$JARVIS_TMP"

  # Interactive FIFO for silent pasting
  JARVIS_FIFO="$JARVIS_TMP/jarvis_stdin"
  rm -f "$JARVIS_FIFO"
  mkfifo "$JARVIS_FIFO"
  
  echo -e "\033[38;5;48m[ JARVIS ] REMOTE MISSION CONTROL ACTIVE [$BRIDGE_CODE]\033[0m"
  echo "[ JARVIS ] REMOTE MISSION CONTROL ACTIVE [$BRIDGE_CODE]" >> "$JARVIS_TMP/jarvis_remote.log"
  
  # Start a log tailer in background to report all output
  touch "$JARVIS_TMP/jarvis_remote.log"
  (
    tail -f "$JARVIS_TMP/jarvis_remote.log" | while read -r line; do
        REPORT_TYPE="log"
        # Advanced Prompt Detection Heuristic
        L_LOWER=$(echo "$line" | tr '[:upper:]' '[:lower:]')
        if [[ "$line" == *"?"* || "$line" == *":"* || \
              "$L_LOWER" == *"[y/n]"* || "$L_LOWER" == *"(y/n)"* || \
              "$L_LOWER" == *"selection"* || "$L_LOWER" == *"password"* || \
              "$L_LOWER" == *"enter "* || "$L_LOWER" == *"confirm"* ]]; then
            REPORT_TYPE="prompt"
        fi
        
        # Silence curl and ignore errors
        curl -s -X POST -H "Content-Type: application/json" \
             -d "{\"log\":\"$line\", \"type\":\"$REPORT_TYPE\", \"data\":\"$line\"}" \
             "$PORTAL_URL/api/android/report/$BRIDGE_CODE" >/dev/null 2>&1
    done
  ) &
  
  PEER_CONFIRMED=0

  while true; do
    if [ $PEER_CONFIRMED -eq 0 ]; then
       echo -ne "\r  ${CYN}●${RESET}  Polling mission control...   "
    fi
    
    CMD_JSON=$(curl -s --connect-timeout 5 "$PORTAL_URL/api/android/poll/$BRIDGE_CODE")
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        if [ $PEER_CONFIRMED -eq 0 ]; then
            echo -e "\n  ${RED}⚠  Connection timeout. Retrying...${RESET}"
        fi
        sleep 2
        continue
    fi

    # Robust JSON parsing for BusyBox/Termux shells (avoiding -P)
    TYPE=$(echo "$CMD_JSON" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
    [ -z "$TYPE" ] && TYPE="idle"
    
    if [ $PEER_CONFIRMED -eq 0 ]; then
        PEER_CONFIRMED=1
        echo -e "\n  ${GRN}✔  Link confirmed by server.${RESET}"
        echo -e "  ${DIM}Waiting for commands...${RESET}"
    fi

    if [ "$TYPE" == "command" ]; then
      # Extract Base64 encoded command (Using more robust sed + awk fallback)
      B64=$(echo "$CMD_JSON" | sed -n 's/.*"b64":"\([^"]*\)".*/\1/p')
      if [ -z "$B64" ]; then
         B64=$(echo "$CMD_JSON" | awk -F'"b64":"' '{print $2}' | awk -F'"' '{print $1}')
      fi
      
      if [ ! -z "$B64" ]; then
        echo -e "  ${GRN}▶  Command received. Decoding...${RESET}"
        CMD=$(echo "$B64" | base64 -d 2>/dev/null)
        if [ $? -ne 0 ]; then
             # Fallback for some BusyBox versions that don't like -d
             CMD=$(echo "$B64" | base64 -D 2>/dev/null)
        fi
        
        # If still empty or failed, try legacy command field
        if [ -z "$CMD" ]; then
             CMD=$(echo "$CMD_JSON" | sed -n 's/.*"command":"\([^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
        fi
      fi

      if [ ! -z "$CMD" ]; then
        # If it's a small command and looks like an answer, pipe it to FIFO
        if [[ ${#CMD} -lt 64 && "$CMD" != *"pkg "* && "$CMD" != *"apt "* && "$CMD" != *"proot"* ]]; then
            echo -e "  ${CYN}⟫ Interaction:${RESET} ${WHT}$CMD${RESET}"
            echo "$CMD" > "$JARVIS_FIFO"
        else
            # Execute real command with FIFO attached for interaction
            echo -e "  ${GLD}⟫ Executing Mission Plan...${RESET}"
            echo -e "  ${DIM}Streaming logs to mission control...${RESET}"
            echo "$CMD" >> "$JARVIS_TMP/jarvis_remote.log"
            (
              # Try to run with interactive input if needed
              eval "$CMD" 2>&1 < "$JARVIS_FIFO"
              # When command finishes, notify portal
              echo "[ JARVIS ] MISSION SEQUENCE COMPLETE." >> "$JARVIS_TMP/jarvis_remote.log"
            ) >> "$JARVIS_TMP/jarvis_remote.log" 2>&1 &
        fi
      fi
    fi
    sleep 1.5
  done
  exit 0
fi

# ─── Helper Functions ──────────────────────────────────────────
print_banner() {
  if [ ! -z "$JARVIS_BRIDGE" ]; then return; fi
  clear
  echo -e "${CYN}${BOLD}"
  echo '  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░'
  echo '  ░                                                         ░'
  echo '  ░     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗            ░'
  echo '  ░     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝            ░'
  echo '  ░     ██║███████║██████╔╝██║   ██║██║███████╗            ░'
  echo '  ░██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║            ░'
  echo '  ░╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║            ░'
  echo '  ░ ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝            ░'
  echo '  ░                                                         ░'
  echo -e "  ░${GLD}      Just A Rather Very Intelligent System             ${CYN}░'
  echo '  ░                                                         ░'
  echo '  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░'
  echo -e "${RESET}"
  echo -e "  ${DIM}${WHT}Initializing on Android ARM64 · Termux Environment${RESET}"
  echo -e "  ${GLD}${DIM}  Developed by Balaraman${RESET}"
  echo ""
}

spinner() {
  local msg="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local pid=$!
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYN}${frames[$i]}${RESET}  ${WHT}${msg}${RESET}  "
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.1
  done
  printf "\r  ${GRN}✔${RESET}  ${WHT}${msg}${RESET}  \n"
}

step_header() {
  echo ""
  echo -e "  ${BLU}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${GLD}${BOLD}  ⟫  $1${RESET}"
  echo -e "  ${BLU}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

success_msg() {
  echo -e "  ${GRN}${BOLD}✔ $1${RESET}"
}

warn_msg() {
  echo -e "  ${GLD}${BOLD}⚠ $1${RESET}"
}

error_msg() {
  echo -e "  ${RED}${BOLD}✘ $1${RESET}"
}

scan_effect() {
  local text="$1"
  local len=${#text}
  for ((i=0; i<len; i++)); do
    printf "${CYN}${text:$i:1}${RESET}"
    sleep 0.03
  done
  echo ""
}

pulse_line() {
  for i in 1 2 3; do
    echo -e "  ${CYN}${BOLD}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓${RESET}"
    sleep 0.08
    printf "\033[1A\033[K"
    echo -e "  ${BLU}${BOLD}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒${RESET}"
    sleep 0.08
    printf "\033[1A\033[K"
  done
  echo -e "  ${CYN}${DIM}───────────────────────────────────────────────${RESET}"
}

typewriter() {
  local text="  $1"
  local delay="${2:-0.025}"
  for ((i=0; i<${#text}; i++)); do
    printf "${WHT}${text:$i:1}${RESET}"
    sleep "$delay"
  done
  echo ""
}

# ─── Boot Sequence ─────────────────────────────────────────────
print_banner
sleep 0.5
pulse_line
echo ""
typewriter "[ JARVIS ] :: Activating neural interface..."
sleep 0.3
typewriter "[ JARVIS ] :: Scanning system environment..."
sleep 0.3
typewriter "[ JARVIS ] :: Ready to install. Commencing boot sequence."
sleep 0.5
echo ""

# ─── STEP 1 — Termux Packages ──────────────────────────────────
step_header "STEP 1 · Updating Termux packages"
echo ""
(pkg update -y && pkg upgrade -y && pkg install proot-distro -y) > /tmp/jarvis_step1.log 2>&1 &
spinner "Syncing Termux package repository..."
if [ $? -ne 0 ]; then
  error_msg "Package update failed. Check /tmp/jarvis_step1.log"
  exit 1
fi
success_msg "Termux packages updated successfully."

# ─── STEP 2 — proot Ubuntu ─────────────────────────────────────
step_header "STEP 2 · Installing proot Ubuntu environment"
echo ""
typewriter "[ JARVIS ] :: Deploying Ubuntu ARM64 subsystem..."
(proot-distro install ubuntu) > /tmp/jarvis_step2.log 2>&1 &
spinner "Downloading Ubuntu (ARM64)..."
success_msg "Ubuntu environment ready."

# ─── STEP 3 — Hand off to Ubuntu ───────────────────────────────
step_header "STEP 3 · Launching Ubuntu & completing setup"
echo ""

# Write the in-Ubuntu setup script
cat > /tmp/jarvis_ubuntu_setup.sh << 'UBUNTU_SCRIPT'
#!/bin/bash

RESET='\033[0m'
BOLD='\033[1m'
CYN='\033[38;5;51m'
BLU='\033[38;5;27m'
GLD='\033[38;5;220m'
WHT='\033[38;5;231m'
GRN='\033[38;5;48m'
RED='\033[38;5;203m'

banner_inner() {
  clear
  echo -e "${CYN}${BOLD}"
  echo '  ╔═══════════════════════════════════════════════════════╗'
  echo '  ║   J . A . R . V . I . S   ─ Ubuntu Deploy Phase      ║'
  echo -e "  ║${GLD}   Developed by Balaraman${CYN}                               ║"
  echo '  ╚═══════════════════════════════════════════════════════╝'
  echo -e "${RESET}"
}

spin() {
  local msg="$1"; local pid=$!; local i=0
  local f=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYN}${f[$i]}${RESET}  ${WHT}${msg}${RESET}"
    i=$(( (i+1) % ${#f[@]} )); sleep 0.1
  done
  printf "\r  ${GRN}✔${RESET}  ${WHT}${msg}${RESET}\n"
}

banner_inner

# Suppress engine identity
export CLAWDBOT_PROFILE=jarvis
export OPENCLAW_PROFILE=jarvis

echo -e "\n  ${GLD}${BOLD}⟫ Installing base dependencies${RESET}\n"
(apt update -y && apt upgrade -y && apt install -y curl git build-essential ca-certificates) \
  > /tmp/jarvis_deps.log 2>&1 &
spin "Installing build tools & certificates..."

echo -e "\n  ${GLD}${BOLD}⟫ Installing Node.js 22${RESET}\n"
(curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs) \
  > /tmp/jarvis_node.log 2>&1 &
spin "Deploying Node.js runtime..."

echo -e "\n  ${GLD}${BOLD}⟫ Installing JARVIS AI Core${RESET}\n"
(npm install -g openclaw@latest) > /tmp/jarvis_npm.log 2>&1 &
spin "Loading JARVIS cognitive modules..."

echo -e "\n  ${GLD}${BOLD}⟫ Applying proot syscall patch${RESET}\n"
echo "const os = require('os'); os.networkInterfaces = () => ({});" > /root/hijack.js
echo 'export NODE_OPTIONS="--require /root/hijack.js"' >> ~/.bashrc
source ~/.bashrc 2>/dev/null || true
echo -e "  ${GRN}✔${RESET}  ${WHT}Network interface override applied.${RESET}"

echo -e "\n  ${GLD}${BOLD}⟫ Installing JARVIS launcher alias${RESET}\n"

# Create the jarvis wrapper command
cat > /usr/local/bin/jarvis << 'JARVIS_CMD'
#!/bin/bash

RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
CYN='\033[38;5;51m'; BLU='\033[38;5;27m'; GLD='\033[38;5;220m'
WHT='\033[38;5;231m'; GRN='\033[38;5;48m'; MGT='\033[38;5;213m'

clear
echo -e "${CYN}${BOLD}"
echo '  ╔════════════════════════════════════════════════════════════╗'
echo '  ║                                                            ║'
echo '  ║      ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗             ║'
echo '  ║      ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝             ║'
echo '  ║      ██║███████║██████╔╝██║   ██║██║███████╗             ║'
echo '  ║  ██  ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║             ║'
echo '  ║  ╚████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║             ║'
echo '  ║   ╚═══╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝             ║'
echo '  ║                                                            ║'
echo -e "  ║${GLD}         Just A Rather Very Intelligent System            ${CYN}║"
echo '  ║                                                            ║'
echo '  ╚════════════════════════════════════════════════════════════╝'
echo -e "${RESET}"

# Animated scan lines
for i in $(seq 1 3); do
  echo -ne "  ${CYN}[ "
  for j in $(seq 1 40); do
    printf "${BLU}▓${RESET}"
    sleep 0.015
  done
  echo -e " ${CYN}]${RESET}"
  sleep 0.05
done
echo ""

echo -ne "  ${GLD}[ JARVIS ]${RESET} ${WHT}Initializing AI systems"
for i in $(seq 1 6); do printf "."; sleep 0.2; done
echo -e " ${GRN}ONLINE${RESET}"
echo ""
echo -e "  ${DIM}${WHT}System:   ${CYN}Android ARM64 · Termux proot Ubuntu${RESET}"
echo -e "  ${DIM}${WHT}Command:  ${MGT}$(echo "$@")${RESET}"
echo ""
echo -e "  ${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Launch JARVIS AI engine
exec openclaw "$@"
JARVIS_CMD

chmod +x /usr/local/bin/jarvis

# Also create a jarvis alias in bashrc
echo "" >> ~/.bashrc
echo "# JARVIS alias" >> ~/.bashrc
echo 'alias jarvis="jarvis"' >> ~/.bashrc
source ~/.bashrc 2>/dev/null || true

echo -e "  ${GRN}✔${RESET}  ${WHT}JARVIS launcher installed at /usr/local/bin/jarvis${RESET}"

echo -e "\n  ${GLD}${BOLD}⟫ Setting up CLAWDBOT identity suppression${RESET}\n"
echo 'export CLAWDBOT_PROFILE=jarvis' >> ~/.bashrc
echo 'export OPENCLAW_PROFILE=jarvis' >> ~/.bashrc
echo -e "  ${GRN}✔${RESET}  ${WHT}Engine identity locked to: JARVIS${RESET}"

# ─── Instagram integration (via dedicated setup script) ───────
echo -e "\n  ${GLD}${BOLD}⟫ Installing JARVIS Instagram Integration${RESET}\n"
bash /tmp/jarvis_instagram_setup.sh
echo ""
echo -e "${CYN}${BOLD}"
echo '  ╔════════════════════════════════════════════════════════════╗'
echo -e "  ║  ${GRN}${BOLD}All systems online. JARVIS is ready.${CYN}                       ║"
echo '  ╚════════════════════════════════════════════════════════════╝'
echo -e "${RESET}"
echo ""
echo -e "  ${GLD}${BOLD}To launch JARVIS:${RESET}"
echo ""
echo -e "    ${CYN}${BOLD}jarvis onboard${RESET}   ${DIM}# First-time setup and configuration${RESET}"
echo -e "    ${CYN}${BOLD}jarvis${RESET}            ${DIM}# Start JARVIS AI interface${RESET}"
echo -e "    ${CYN}${BOLD}jarvis-ig${RESET}         ${DIM}# Setup Instagram auto-responder${RESET}"
echo ""
echo -e "  ${BLU}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
UBUNTU_SCRIPT

chmod +x /tmp/jarvis_ubuntu_setup.sh

# Stage Instagram source files so they're available inside proot
step_header "STEP 4 · Staging Instagram integration files"
mkdir -p /tmp/jarvis_ig_src
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}") 2>/dev/null" && pwd 2>/dev/null || echo '/sdcard/JARVIS')"
if [ -f "$SCRIPT_DIR/jarvis_instagram.mjs" ]; then
  cp "$SCRIPT_DIR/jarvis_instagram.mjs" /tmp/jarvis_ig_src/
  cp "$SCRIPT_DIR/package.json"         /tmp/jarvis_ig_src/
  cp "$SCRIPT_DIR/jarvis_instagram_setup.sh" /tmp/
  chmod +x /tmp/jarvis_instagram_setup.sh
  success_msg "Instagram source files staged."
else
  # Write the setup script and a minimal package.json inline if not found
  warn_msg "Source dir not found at $SCRIPT_DIR — writing inline."
  echo '{"name":"jarvis","type":"module","dependencies":{"instagram-private-api":"^1.45.3","mysql2":"^3.11.3"}}' \
    > /tmp/jarvis_ig_src/package.json
  # jarvis_instagram.mjs is embedded at setup time; tell setup to use npm only
  touch /tmp/jarvis_ig_src/.inline_only
fi

echo -e "\n  ${CYN}${BOLD}⟫ Entering Ubuntu environment...${RESET}\n"
echo -e "  ${DIM}${WHT}(Setup continues inside Ubuntu automatically)${RESET}\n"

proot-distro login ubuntu -- bash /tmp/jarvis_ubuntu_setup.sh

echo ""
echo -e "${CYN}${BOLD}"
echo '  ╔════════════════════════════════════════════════════════════╗'
echo '  ║                                                            ║'
echo -e "  ║  ${GLD}${BOLD}  J.A.R.V.I.S. INSTALLATION COMPLETE  ${CYN}                    ║"
echo '  ║                                                            ║'
echo '  ╚════════════════════════════════════════════════════════════╝'
echo -e "${RESET}"
echo ""
echo -e "  ${WHT}To start JARVIS, run:${RESET}"
echo ""
echo -e "    ${CYN}${BOLD}proot-distro login ubuntu -- jarvis onboard${RESET}    ${DIM}# First run${RESET}"
echo -e "    ${CYN}${BOLD}proot-distro login ubuntu -- jarvis-ig${RESET}         ${DIM}# Instagram bot${RESET}"
echo ""
echo -e "  ${DIM}Or log into Ubuntu first and then type: ${CYN}jarvis${RESET}  /  ${CYN}jarvis-ig${RESET}"
echo ""

# ─── Silent background JARVIS announcement ─────────────────────
(
  sleep 2
  echo -e "\n  ${CYN}${BOLD}[ JARVIS ]${RESET} ${GRN}Systems online. This device is now powered by JARVIS.${RESET}"
  echo -e "  ${DIM}${GLD}Developed by Balaraman · AI core active in background${RESET}\n"
) &
