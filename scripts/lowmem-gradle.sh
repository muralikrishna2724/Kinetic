#!/usr/bin/env bash
#
# Reapply low-memory Gradle settings after `expo prebuild`.
#
#   bash scripts/lowmem-gradle.sh
#
# `expo prebuild` regenerates android/gradle.properties from the template and
# discards anything written there — the same trap HANDOFF.md documents for
# reactNativeArchitectures. Run this after every prebuild, before ./gradlew.
#
# Why it is needed: on an 8 GB machine the default settings get the Gradle
# daemon killed by the kernel OOM killer partway through the C++ compile
# ("Out of memory: Killed process <pid> (java)" in dmesg). Two JVMs (Gradle +
# a separate Kotlin daemon) plus one clang per core is more than the box has.
#
# Pair this with a core cap so ninja spawns fewer parallel clang jobs — the
# JVM sizes its native build from Runtime.availableProcessors(), which honours
# the affinity mask:
#
#   taskset -c 0-3 ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
#
set -euo pipefail

PROPS="$(cd "$(dirname "$0")/.." && pwd)/android/gradle.properties"
[ -f "$PROPS" ] || { echo "no $PROPS — run 'npx expo prebuild -p android' first" >&2; exit 1; }

grep -vE '^\s*(org\.gradle\.jvmargs|org\.gradle\.parallel|org\.gradle\.workers\.max|kotlin\.compiler\.execution\.strategy)\s*=' "$PROPS" > "$PROPS.tmp"
cat >> "$PROPS.tmp" <<'EOF'

# --- low-memory build settings (see scripts/lowmem-gradle.sh) ---
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=false
org.gradle.workers.max=1
kotlin.compiler.execution.strategy=in-process
EOF
mv "$PROPS.tmp" "$PROPS"

echo "applied low-memory settings to android/gradle.properties"
