#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════════
#  J.A.R.V.I.S — Quick Launcher
#  Run this from Termux to enter Ubuntu and start JARVIS.
#  Developed by Balaraman
# ═══════════════════════════════════════════════════════════════

# Suppress engine identity — JARVIS only
export CLAWDBOT_PROFILE=jarvis
export OPENCLAW_PROFILE=jarvis

RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
CYN='\033[38;5;51m'; BLU='\033[38;5;27m'; GLD='\033[38;5;220m'
WHT='\033[38;5;231m'; GRN='\033[38;5;48m'; MGT='\033[38;5;213m'

clear
echo -e "${CYN}${BOLD}"
echo '  ╔════════════════════════════════════════════════════════════╗'
echo '  ║                                                            ║'
echo '  ║     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗              ║'
echo '  ║     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝              ║'
echo '  ║     ██║███████║██████╔╝██║   ██║██║███████╗              ║'
echo '  ║ ██  ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║              ║'
echo '  ║ ╚████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║              ║'
echo '  ║  ╚═══╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝              ║'
echo '  ║                                                            ║'
echo -e "  ║${GLD}       Just A Rather Very Intelligent System             ${CYN}║"
echo -e "  ║${DIM}${WHT}              Developed by Balaraman                     ${CYN}║"
echo '  ║                                                            ║'
echo '  ╚════════════════════════════════════════════════════════════╝'
echo -e "${RESET}"

# Animated loading bar
echo -ne "\n  ${GLD}[ JARVIS ]${RESET} ${WHT}Engaging systems${RESET}"
for i in $(seq 1 5); do printf " ${CYN}▓${RESET}"; sleep 0.15; done
echo ""

echo -ne "  ${GLD}[ JARVIS ]${RESET} ${WHT}Entering Ubuntu shell${RESET}"
for i in $(seq 1 5); do printf " ${BLU}▒${RESET}"; sleep 0.1; done
echo ""

echo -ne "  ${GLD}[ JARVIS ]${RESET} ${WHT}Launching AI interface${RESET}"
for i in $(seq 1 5); do printf " ${MGT}░${RESET}"; sleep 0.08; done
echo -e " ${GRN}${BOLD}▶${RESET}\n"

CMD="${1:-}"

if [ -z "$CMD" ]; then
  # Interactive: drop into Ubuntu with jarvis ready
  proot-distro login ubuntu -- bash --rcfile /root/.bashrc
else
  # Non-interactive: run jarvis with the given subcommand
  proot-distro login ubuntu -- jarvis "$@"
fi
