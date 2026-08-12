#!/usr/bin/env bash
# One-shot smoke test against a booted emulator.
#
# Bundled into a single script deliberately: this machine is memory-tight and the
# emulator may not survive long, so every check runs back-to-back rather than
# across separate round-trips.
set -u

ADB="C:/Users/surya/AppData/Local/Android/Sdk/platform-tools/adb.exe"
PKG="app.kinetic.running"
APK="dist/Kinetic-1.0.0-universal.apk"
SHOTS="${SHOTS:-shots}"

mkdir -p "$SHOTS"
say() { echo ""; echo "### $*"; }

say "waiting for boot"
for i in $(seq 1 120); do
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 5
done
"$ADB" shell getprop sys.boot_completed | tr -d '\r'

say "clearing logcat"
"$ADB" logcat -c 2>/dev/null

say "installing"
"$ADB" install -r "$APK" 2>&1 | tail -2

say "granting location"
"$ADB" shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION 2>&1
"$ADB" shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION 2>&1
"$ADB" shell pm grant $PKG android.permission.ACCESS_BACKGROUND_LOCATION 2>&1
"$ADB" shell dumpsys package $PKG | grep -E "LOCATION: granted" | sed 's/^ *//'

say "seeding a location fix so GPS locks"
"$ADB" emu geo fix 77.5929 12.9763 920

say "launching"
"$ADB" shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 2>&1 | tail -1
sleep 12

say "process alive?"
"$ADB" shell pidof $PKG | tr -d '\r'

say "fatal exceptions in logcat"
"$ADB" logcat -d -t 400 2>/dev/null | grep -iE "FATAL EXCEPTION|AndroidRuntime: |ReactNativeJS.*Error|E ReactNative" | head -20
echo "--- end of crash scan ---"

say "screenshot: home"
"$ADB" shell screencap -p /sdcard/s1.png && "$ADB" pull /sdcard/s1.png "$SHOTS/01-home.png" 2>&1 | tail -1
