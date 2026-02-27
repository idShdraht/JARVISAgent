#!/bin/bash

# JARVIS - Automated Termux/Ubuntu Setup Script
# Rebranded from OpenClaw for the JARVIS project

set -e

echo "🦞 Welcome to the JARVIS Setup Wizard"
echo "--------------------------------------"
echo "This script will automate the installation of JARVIS on your Android device via Termux/Ubuntu."

# 1. Update Termux and install proot-distro
echo "Step 1: Updating Termux packages..."
pkg update -y && pkg upgrade -y
pkg install proot-distro git curl -y

# 2. Install Ubuntu
if proot-distro list | grep -q "ubuntu (installed)"; then
    echo "Ubuntu is already installed."
else
    echo "Step 2: Installing Ubuntu..."
    proot-distro install ubuntu
fi

# 3. Create a wrapper script to run inside Ubuntu
cat << 'EOF' > jarvis_ubuntu_setup.sh
#!/bin/bash
set -e
echo "Step 3: Configuring Ubuntu environment..."
apt update -y && apt upgrade -y
apt install -y curl git build-essential ca-certificates

# Install Node.js 22
echo "Step 4: Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Create Network Fix (hijack.js)
echo "Step 5: Applying Termux Network Fix..."
echo "const os = require('os'); os.networkInterfaces = () => ({});" > /root/hijack.js
if ! grep -q "hijack.js" ~/.bashrc; then
    echo 'export NODE_OPTIONS="--require /root/hijack.js"' >> ~/.bashrc
fi

# Clone and setup JARVIS (from the local source or global)
# For now, we'll install the rebranded core if available, or fallback to the latest openclaw rebranded on the fly
echo "Step 6: Installing JARVIS CLI..."
npm install -g openclaw@latest # Ideally this would be the rebranded 'jarvis' pkg if published
# Note: Since 'jarvis' brand is local, we advise running the local core setup if needed

echo "--------------------------------------"
echo "✅ JARVIS Environment is ready!"
echo "To start onboarding, run: openclaw onboard"
echo "(Note: CLI command is still 'openclaw' until the package is fully renamed in registry)"
echo "--------------------------------------"
EOF

# 4. Login to Ubuntu and run the setup
echo "Entering Ubuntu to complete setup..."
proot-distro login ubuntu -- bash /data/data/com.termux/files/home/jarvis_ubuntu_setup.sh

# Cleanup
rm jarvis_ubuntu_setup.sh

echo "Done! You can now access your JARVIS by running 'proot-distro login ubuntu' and then 'openclaw onboard'."
