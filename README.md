```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗                  ║
║     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝                  ║
║     ██║███████║██████╔╝██║   ██║██║███████╗                  ║
║ ██  ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║                  ║
║ ╚████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║                  ║
║  ╚═══╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝                  ║
║                                                                ║
║           Just A Rather Very Intelligent System                ║
║                    Developed by Balaraman                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

# 🤖 JARVIS — AI System on Termux (ARM64)

> Run **JARVIS** inside Termux on Android (ARM64) using a `proot` Ubuntu environment.

---

## ⚡ One-Shot Installation (Recommended)

### Step 1 — Run in Termux:

```bash
curl -fsSL https://raw.githubusercontent.com/idShdraht/JARVISAgent/main/jarvis.sh | bash
```

> Or clone and run manually:

```bash
git clone https://github.com/YOUR_GITHUB/JARVIS.git
bash JARVIS/jarvis.sh
```

---

## 📱 Requirements

| Requirement | Details |
|---|---|
| Device | Android ARM64 (64-bit) |
| App | [Termux (GitHub)](https://github.com/termux/termux-app/releases) — **NOT Play Store** |
| Storage | ≥ 2 GB free |
| Network | Stable internet connection |

---

## 🛠 Manual Installation (Step-by-Step)

### Step 1 — Prepare Termux

Update packages and install `proot-distro`:

```bash
pkg update -y && pkg upgrade -y && pkg install proot-distro -y
```

---

### Step 2 — Install & Login to Ubuntu (ARM64)

```bash
proot-distro install ubuntu && proot-distro login ubuntu
```

You are now inside the Ubuntu ARM64 environment.

---

### Step 3 — Install Base Dependencies

```bash
apt update -y && apt upgrade -y && \
apt install -y curl git build-essential ca-certificates
```

---

### Step 4 — Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
apt install -y nodejs
```

Verify:

```bash
node -v   # should show v22.x.x
npm -v
```

---

### Step 5 — Install JARVIS AI Core

```bash
npm install -g openclaw@latest
```

---

### Step 6 — Fix `uv_interface_addresses` Error (Critical for proot)

`proot` blocks certain low-level network syscalls used by Node.js. This patch prevents the crash:

```bash
echo "const os = require('os'); os.networkInterfaces = () => ({});" > /root/hijack.js
echo 'export NODE_OPTIONS="--require /root/hijack.js"' >> ~/.bashrc && source ~/.bashrc
```

---

### Step 7 — Install JARVIS Launcher

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB/JARVIS/main/jarvis_quick_launch.sh \
  -o /usr/local/bin/jarvis && chmod +x /usr/local/bin/jarvis
```

---

### Step 8 — Launch JARVIS 🚀

```bash
jarvis onboard
```

---

## 🎨 Colour Theme

JARVIS uses a custom terminal colour palette:

| Role | Colour |
|---|---|
| Primary | ⚡ Electric Cyan `#00FFFF` |
| Secondary | 🔵 Deep Blue `#005FFF` |
| Accent | 🌟 Amber Gold `#FFD700` |
| Success | 💚 Mint Green `#00FF87` |
| Warning | 🟠 Coral `#FF5F5F` |
| Highlight | 💜 Magenta `#FF87FF` |

---

## 🧠 How the Syscall Patch Works

JARVIS (Node.js) tries to enumerate system network interfaces.

Inside `proot`, restricted syscalls cause:

```
uv_interface_addresses returned Unknown system error 13
```

The `hijack.js` override returns an empty object to prevent the crash:

```js
os.networkInterfaces = () => ({})
```

---

## ⚡ One-Shot Full Install (Copy-Paste)

**In Termux:**

```bash
pkg update -y && pkg upgrade -y && pkg install proot-distro -y && \
proot-distro install ubuntu
```

**Login to Ubuntu:**

```bash
proot-distro login ubuntu
```

**Inside Ubuntu:**

```bash
apt update -y && apt upgrade -y && \
apt install -y curl git build-essential ca-certificates && \
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
apt install -y nodejs && \
npm install -g openclaw@latest && \
echo "const os = require('os'); os.networkInterfaces = () => ({});" > /root/hijack.js && \
echo 'export NODE_OPTIONS="--require /root/hijack.js"' >> ~/.bashrc && \
source ~/.bashrc
```

**Start JARVIS:**

```bash
jarvis onboard
```

---

## 📸 Instagram Integration (Auto-Responder)

JARVIS includes a built-in Instagram automation module that:

- 🔑 **Logs you in** to Instagram and stores credentials **encrypted** on-device + in your Aiven cloud DB
- 💬 **Auto-replies to DMs** when someone sends a matching keyword
- 🗨️ **Auto-comments on your posts** when someone comments a matching keyword
- 📊 **Logs all actions** to your cloud database (Aiven MySQL)

### Launch Instagram Bot

```bash
jarvis-ig
# or
jarvis-instagram
```

### First Run — What Happens

1. You're prompted to enter your Instagram username & password
2. Credentials are **AES-256 encrypted** locally at `~/.jarvis/instagram_creds.enc`
3. Credentials are also synced to your **Aiven MySQL cloud DB**
4. You can add keyword triggers — e.g.:
   - DM trigger: `"price"` → `"Thanks! DM me for details 😊"`
   - Comment trigger: `"link"` → `"Check the bio @username!"`
5. Monitors run continuously in the background

### Example Keyword Triggers

| Type | Keyword | Auto-Response |
|---|---|---|
| DM | `price` | `Hey! The price is ₹999. DM for order 🛒` |
| DM | `hi` | `Hello! JARVIS here, how can I help? 🤖` |
| Comment | `link` | `@user Check the bio for the link! 🔗` |
| Comment | `buy` | `@user Click the link in bio to order! 💛` |

---

## 🔄 Troubleshooting

**Error persists after install?** Exit and re-enter Ubuntu:

```bash
exit
proot-distro login ubuntu
```

**JARVIS command not found?** Re-run installer or manually set alias:

```bash
echo 'alias jarvis="jarvis"' >> ~/.bashrc && source ~/.bashrc
```

**Instagram login failed?** Delete the saved session and retry:

```bash
rm ~/.jarvis/instagram_session.json && jarvis-ig
```

---

## 📌 Tested Environment

- ✅ Android ARM64
- ✅ Termux (F-Droid build)
- ✅ proot-distro Ubuntu
- ✅ Node.js v22.x
- ✅ Aiven MySQL (cloud sync)

---

## 👤 Author

**Developed by Balaraman**

*JARVIS — Just A Rather Very Intelligent System*

Built for mobile ARM64 Linux environments running inside Termux.

