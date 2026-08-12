#!/usr/bin/env bash
#
# One-shot Linux setup for building and emulator-testing Kinetic.
#
#   bash scripts/setup-linux.sh
#
# Idempotent — safe to re-run after a failed step. Installs JDK 21, the Android
# SDK (platform 36, build-tools 36, NDK 27.1), the emulator, and creates an AVD.
#
# Expect ~6-8 GB of downloads unless you reuse the system image from the Windows
# partition (see REUSE below), which saves about 1.5 GB of it.
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
API=36
BUILD_TOOLS="36.0.0"
NDK="27.1.12297006"
# google_apis, NOT google_apis_playstore. No Google Play services means a much
# smaller memory footprint, and `adb root` works — which the Play image forbids.
IMAGE="system-images;android-${API};google_apis;x86_64"
AVD_NAME="kinetic_test"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m!!\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------ #
# 1. Hardware acceleration
# ------------------------------------------------------------------ #
say "Checking KVM"
if [ ! -e /dev/kvm ]; then
  die "/dev/kvm missing. Enable virtualization (VT-x/AMD-V) in BIOS, then re-run."
fi
if [ ! -w /dev/kvm ]; then
  warn "/dev/kvm not writable by $USER — adding you to the kvm group."
  sudo usermod -aG kvm "$USER" || true
  warn "Log out and back in (or run 'newgrp kvm') for this to take effect."
fi

# ------------------------------------------------------------------ #
# 2. System packages
# ------------------------------------------------------------------ #
say "Installing system packages"
if command -v apt-get >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y openjdk-21-jdk-headless curl unzip git \
    libpulse0 libnss3 libxcursor1 libxdamage1 libxcomposite1 libasound2t64 \
    || sudo apt-get install -y openjdk-21-jdk-headless curl unzip git \
       libpulse0 libnss3 libxcursor1 libxdamage1 libxcomposite1 libasound2
elif command -v dnf >/dev/null; then
  sudo dnf install -y java-21-openjdk-devel curl unzip git alsa-lib nss libXcursor
elif command -v pacman >/dev/null; then
  sudo pacman -Sy --needed --noconfirm jdk21-openjdk curl unzip git alsa-lib nss
else
  die "Unrecognised distro. Install JDK 21, curl, unzip and git manually, then re-run."
fi

# ------------------------------------------------------------------ #
# 3. Node
# ------------------------------------------------------------------ #
say "Checking Node"
NEED_NODE=1
if command -v node >/dev/null; then
  major=$(node -p "process.versions.node.split('.')[0]")
  [ "$major" -ge 20 ] && NEED_NODE=0 && echo "node $(node -v) is fine"
fi
if [ "$NEED_NODE" = 1 ]; then
  echo "Installing Node 22 via nvm"
  export NVM_DIR="$HOME/.nvm"
  [ -d "$NVM_DIR" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm alias default 22
fi

# ------------------------------------------------------------------ #
# 4. Android SDK
# ------------------------------------------------------------------ #
say "Installing Android SDK to $SDK_ROOT"
mkdir -p "$SDK_ROOT/cmdline-tools"

if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/tools.zip" \
    https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q "$tmp/tools.zip" -d "$tmp"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$tmp"
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true

# REUSE: system images are plain disk images and are portable across host OSes,
# unlike the NDK and emulator binaries. If the Windows partition is mounted,
# copying the image across saves a ~1.5 GB download.
WIN_IMAGE=""
for mnt in /mnt/windows /media/"$USER"/Windows /mnt/c /media/"$USER"/OS; do
  cand="$mnt/Users/surya/AppData/Local/Android/Sdk/system-images/android-${API}"
  [ -d "$cand" ] && WIN_IMAGE="$cand" && break
done
if [ -n "$WIN_IMAGE" ] && [ ! -d "$SDK_ROOT/system-images/android-${API}" ]; then
  say "Reusing system image from the Windows partition ($WIN_IMAGE)"
  mkdir -p "$SDK_ROOT/system-images"
  cp -r "$WIN_IMAGE" "$SDK_ROOT/system-images/" || warn "copy failed; will download instead"
fi

say "Fetching SDK packages (this is the long part)"
"$SDKMANAGER" --install \
  "platform-tools" \
  "platforms;android-${API}" \
  "build-tools;${BUILD_TOOLS}" \
  "ndk;${NDK}" \
  "emulator" \
  "$IMAGE"

# ------------------------------------------------------------------ #
# 5. AVD
# ------------------------------------------------------------------ #
say "Creating AVD '$AVD_NAME'"
AVDMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
echo "no" | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$IMAGE" -d pixel_7 --force

CFG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
if [ -f "$CFG" ]; then
  grep -vE '^\s*(hw\.ramSize|vm\.heapSize|hw\.lcd\.(width|height|density))\s*=' "$CFG" > "$CFG.tmp"
  cat >> "$CFG.tmp" <<'EOF'
hw.ramSize = 2048
vm.heapSize = 256M
hw.lcd.width = 1080
hw.lcd.height = 2400
hw.lcd.density = 420
EOF
  mv "$CFG.tmp" "$CFG"
fi

# ------------------------------------------------------------------ #
# 6. Shell environment
# ------------------------------------------------------------------ #
RC="$HOME/.bashrc"; [ -n "${ZSH_VERSION:-}" ] && RC="$HOME/.zshrc"
if ! grep -q 'ANDROID_SDK_ROOT' "$RC" 2>/dev/null; then
  say "Adding SDK paths to $RC"
  cat >> "$RC" <<EOF

# Android SDK (added by Kinetic setup)
export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export PATH="\$PATH:\$ANDROID_SDK_ROOT/platform-tools:\$ANDROID_SDK_ROOT/emulator:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin"
EOF
fi

echo "sdk.dir=$SDK_ROOT" > android/local.properties 2>/dev/null || true

say "Done."
cat <<EOF

Next steps (new shell, so the PATH and kvm group apply):

  npm install --legacy-peer-deps
  npx expo prebuild -p android --clean
  echo "sdk.dir=$SDK_ROOT" > android/local.properties
  cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64

Then boot the emulator and install:

  emulator -avd $AVD_NAME -no-window -gpu swiftshader_indirect &
  adb wait-for-device
  adb install -r android/app/build/outputs/apk/release/app-release.apk

Build for a phone with arm64-v8a instead of x86_64.
EOF
